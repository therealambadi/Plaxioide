import assert from "assert";
import { Event, Emitter } from "../../../../../base/common/event.js";
import { URI } from "../../../../../base/common/uri.js";
import { StoredFileWorkingCopy, StoredFileWorkingCopyState, isStoredFileWorkingCopySaveEvent } from "../../common/storedFileWorkingCopy.js";
import { bufferToStream, newWriteableBufferStream, streamToBuffer, VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Disposable, DisposableStore } from "../../../../../base/common/lifecycle.js";
import { getLastResolvedFileStat, TestServiceAccessor, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { basename } from "../../../../../base/common/resources.js";
import { FileChangesEvent, FileChangeType, FileOperationError, FileOperationResult, NotModifiedSinceFileOperationError } from "../../../../../platform/files/common/files.js";
import { SaveReason, SaveSourceRegistry } from "../../../../common/editor.js";
import { Promises, timeout } from "../../../../../base/common/async.js";
import { consumeReadable, consumeStream, isReadableStream } from "../../../../../base/common/stream.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { assertIsDefined } from "../../../../../base/common/types.js";
class TestStoredFileWorkingCopyModel extends Disposable {
  constructor(resource, contents) {
    super();
    this.resource = resource;
    this.contents = contents;
    this._onDidChangeContent = this._register(new Emitter());
    this.onDidChangeContent = this._onDidChangeContent.event;
    this._onWillDispose = this._register(new Emitter());
    this.onWillDispose = this._onWillDispose.event;
    this.throwOnSnapshot = false;
    this.versionId = 0;
    this.pushedStackElement = false;
  }
  fireContentChangeEvent(event) {
    this._onDidChangeContent.fire(event);
  }
  updateContents(newContents) {
    this.doUpdate(newContents);
  }
  setThrowOnSnapshot() {
    this.throwOnSnapshot = true;
  }
  async snapshot(context, token) {
    if (this.throwOnSnapshot) {
      throw new Error("Fail");
    }
    const stream = newWriteableBufferStream();
    stream.end(VSBuffer.fromString(this.contents));
    return stream;
  }
  async update(contents, token) {
    this.doUpdate((await streamToBuffer(contents)).toString());
  }
  doUpdate(newContents) {
    this.contents = newContents;
    this.versionId++;
    this._onDidChangeContent.fire({ isRedoing: false, isUndoing: false });
  }
  pushStackElement() {
    this.pushedStackElement = true;
  }
  dispose() {
    this._onWillDispose.fire();
    super.dispose();
  }
}
class TestStoredFileWorkingCopyModelWithCustomSave extends TestStoredFileWorkingCopyModel {
  constructor() {
    super(...arguments);
    this.saveCounter = 0;
    this.throwOnSave = false;
    this.saveOperation = void 0;
  }
  async save(options, token) {
    if (this.throwOnSave) {
      throw new Error("Fail");
    }
    if (this.saveOperation) {
      await this.saveOperation;
    }
    if (token.isCancellationRequested) {
      throw new Error("Canceled");
    }
    this.saveCounter++;
    return {
      resource: this.resource,
      ctime: 0,
      etag: "",
      isDirectory: false,
      isFile: true,
      mtime: 0,
      name: "resource2",
      size: 0,
      isSymbolicLink: false,
      readonly: false,
      locked: false,
      children: void 0
    };
  }
}
class TestStoredFileWorkingCopyModelFactory {
  async createModel(resource, contents, token) {
    return new TestStoredFileWorkingCopyModel(resource, (await streamToBuffer(contents)).toString());
  }
}
class TestStoredFileWorkingCopyModelWithCustomSaveFactory {
  async createModel(resource, contents, token) {
    return new TestStoredFileWorkingCopyModelWithCustomSave(resource, (await streamToBuffer(contents)).toString());
  }
}
suite("StoredFileWorkingCopy (with custom save)", function() {
  const factory = new TestStoredFileWorkingCopyModelWithCustomSaveFactory();
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  let workingCopy;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    const resource = URI.file("test/resource");
    workingCopy = disposables.add(new StoredFileWorkingCopy("testStoredFileWorkingCopyType", resource, basename(resource), factory, (options) => workingCopy.resolve(options), accessor.fileService, accessor.logService, accessor.workingCopyFileService, accessor.filesConfigurationService, accessor.workingCopyBackupService, accessor.workingCopyService, accessor.notificationService, accessor.workingCopyEditorService, accessor.editorService, accessor.elevatedFileService, accessor.progressService));
  });
  teardown(() => {
    disposables.clear();
  });
  test("save (custom implemented)", async () => {
    let savedCounter = 0;
    let lastSaveEvent = void 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
      lastSaveEvent = e;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.save();
    assert.strictEqual(savedCounter, 0);
    assert.strictEqual(saveErrorCounter, 0);
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello save");
    await workingCopy.save();
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(lastSaveEvent.reason, SaveReason.EXPLICIT);
    assert.ok(lastSaveEvent.stat);
    assert.ok(isStoredFileWorkingCopySaveEvent(lastSaveEvent));
    assert.strictEqual(workingCopy.model?.pushedStackElement, true);
    assert.strictEqual(workingCopy.model.saveCounter, 1);
    workingCopy.model?.updateContents("hello save error");
    workingCopy.model.throwOnSave = true;
    await workingCopy.save();
    assert.strictEqual(saveErrorCounter, 1);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), true);
  });
  test("save cancelled (custom implemented)", async () => {
    let savedCounter = 0;
    let lastSaveEvent = void 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
      lastSaveEvent = e;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    let resolve;
    workingCopy.model.saveOperation = new Promise((r) => resolve = r);
    workingCopy.model?.updateContents("first");
    const firstSave = workingCopy.save();
    workingCopy.model?.updateContents("second");
    const secondSave = workingCopy.save();
    resolve();
    await firstSave;
    await secondSave;
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(lastSaveEvent.reason, SaveReason.EXPLICIT);
    assert.ok(lastSaveEvent.stat);
    assert.ok(isStoredFileWorkingCopySaveEvent(lastSaveEvent));
    assert.strictEqual(workingCopy.model?.pushedStackElement, true);
    assert.strictEqual(workingCopy.model.saveCounter, 1);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("StoredFileWorkingCopy", function() {
  const factory = new TestStoredFileWorkingCopyModelFactory();
  const disposables = new DisposableStore();
  const resource = URI.file("test/resource");
  let instantiationService;
  let accessor;
  let workingCopy;
  function createWorkingCopy(uri = resource) {
    const workingCopy2 = new StoredFileWorkingCopy("testStoredFileWorkingCopyType", uri, basename(uri), factory, (options) => workingCopy2.resolve(options), accessor.fileService, accessor.logService, accessor.workingCopyFileService, accessor.filesConfigurationService, accessor.workingCopyBackupService, accessor.workingCopyService, accessor.notificationService, accessor.workingCopyEditorService, accessor.editorService, accessor.elevatedFileService, accessor.progressService);
    return workingCopy2;
  }
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    workingCopy = disposables.add(createWorkingCopy());
  });
  teardown(() => {
    workingCopy.dispose();
    for (const workingCopy2 of accessor.workingCopyService.workingCopies) {
      workingCopy2.dispose();
    }
    disposables.clear();
  });
  test("registers with working copy service", async () => {
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 1);
    workingCopy.dispose();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
  });
  test("orphaned tracking", async () => {
    return runWithFakedTimers({}, async () => {
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), false);
      let onDidChangeOrphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
      accessor.fileService.notExistsSet.set(resource, true);
      accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.DELETED }], false));
      await onDidChangeOrphanedPromise;
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      onDidChangeOrphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
      accessor.fileService.notExistsSet.delete(resource);
      accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.ADDED }], false));
      await onDidChangeOrphanedPromise;
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), false);
    });
  });
  test("dirty / modified", async () => {
    assert.strictEqual(workingCopy.isModified(), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isResolved(), true);
    let changeDirtyCounter = 0;
    disposables.add(workingCopy.onDidChangeDirty(() => {
      changeDirtyCounter++;
    }));
    let contentChangeCounter = 0;
    disposables.add(workingCopy.onDidChangeContent(() => {
      contentChangeCounter++;
    }));
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave(() => {
      savedCounter++;
    }));
    workingCopy.model?.updateContents("hello dirty");
    assert.strictEqual(contentChangeCounter, 1);
    assert.strictEqual(workingCopy.isModified(), true);
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), true);
    assert.strictEqual(changeDirtyCounter, 1);
    await workingCopy.save();
    assert.strictEqual(workingCopy.isModified(), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    assert.strictEqual(changeDirtyCounter, 2);
    assert.strictEqual(savedCounter, 1);
    await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello dirty stream")) });
    assert.strictEqual(contentChangeCounter, 2);
    assert.strictEqual(workingCopy.isModified(), true);
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), true);
    assert.strictEqual(changeDirtyCounter, 3);
    await workingCopy.revert({ soft: true });
    assert.strictEqual(workingCopy.isModified(), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    assert.strictEqual(changeDirtyCounter, 4);
    workingCopy.markModified();
    assert.strictEqual(workingCopy.isModified(), true);
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), true);
    assert.strictEqual(changeDirtyCounter, 5);
    await workingCopy.revert();
    assert.strictEqual(workingCopy.isModified(), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    assert.strictEqual(changeDirtyCounter, 6);
  });
  test("dirty - working copy marks non-dirty when undo reaches saved version ID", async () => {
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello saved state");
    await workingCopy.save();
    assert.strictEqual(workingCopy.isDirty(), false);
    workingCopy.model?.updateContents("changing content once");
    assert.strictEqual(workingCopy.isDirty(), true);
    workingCopy.model.versionId--;
    workingCopy.model?.fireContentChangeEvent({ isRedoing: false, isUndoing: true });
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("resolve (without backup)", async () => {
    let onDidResolveCounter = 0;
    disposables.add(workingCopy.onDidResolve(() => {
      onDidResolveCounter++;
    }));
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isResolved(), true);
    assert.strictEqual(onDidResolveCounter, 1);
    assert.strictEqual(workingCopy.model?.contents, "Hello Html");
    workingCopy.model?.updateContents("hello resolve");
    assert.strictEqual(workingCopy.isDirty(), true);
    await workingCopy.resolve();
    assert.strictEqual(onDidResolveCounter, 1);
    assert.strictEqual(workingCopy.model?.contents, "hello resolve");
    await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello initial contents")) });
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.model?.contents, "hello initial contents");
    assert.strictEqual(onDidResolveCounter, 2);
    const pendingSave = workingCopy.save();
    await workingCopy.resolve();
    await pendingSave;
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.model?.contents, "hello initial contents");
    assert.strictEqual(onDidResolveCounter, 2);
    workingCopy.dispose();
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isDisposed(), true);
    assert.strictEqual(onDidResolveCounter, 2);
  });
  test("resolve (with backup)", async () => {
    await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello backup")) });
    const backup = await workingCopy.backup(CancellationToken.None);
    await accessor.workingCopyBackupService.backup(workingCopy, backup.content, void 0, backup.meta);
    assert.strictEqual(accessor.workingCopyBackupService.hasBackupSync(workingCopy), true);
    workingCopy.dispose();
    workingCopy = createWorkingCopy();
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.isReadonly(), false);
    assert.strictEqual(workingCopy.model?.contents, "hello backup");
    workingCopy.model.updateContents("hello updated");
    await workingCopy.save();
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.model?.contents, "Hello Html");
  });
  test("resolve (with backup, preserves metadata and orphaned state)", async () => {
    return runWithFakedTimers({}, async () => {
      await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello backup")) });
      const orphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
      accessor.fileService.notExistsSet.set(resource, true);
      accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.DELETED }], false));
      await orphanedPromise;
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      const backup = await workingCopy.backup(CancellationToken.None);
      await accessor.workingCopyBackupService.backup(workingCopy, backup.content, void 0, backup.meta);
      assert.strictEqual(accessor.workingCopyBackupService.hasBackupSync(workingCopy), true);
      workingCopy.dispose();
      workingCopy = createWorkingCopy();
      await workingCopy.resolve();
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      const backup2 = await workingCopy.backup(CancellationToken.None);
      assert.deepStrictEqual(backup.meta, backup2.meta);
    });
  });
  test("resolve (updates orphaned state accordingly)", async () => {
    return runWithFakedTimers({}, async () => {
      await workingCopy.resolve();
      const orphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
      accessor.fileService.notExistsSet.set(resource, true);
      accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.DELETED }], false));
      await orphanedPromise;
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      accessor.fileService.notExistsSet.delete(resource);
      await workingCopy.resolve({ forceReadFromFile: true });
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), false);
      try {
        accessor.fileService.readShouldThrowError = new FileOperationError("file not found", FileOperationResult.FILE_NOT_FOUND);
        await workingCopy.resolve();
        assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      } finally {
        accessor.fileService.readShouldThrowError = void 0;
      }
    });
  });
  test("stat.readonly and stat.locked can change when decreased mtime is ignored", async function() {
    await workingCopy.resolve();
    const stat = assertIsDefined(getLastResolvedFileStat(workingCopy));
    try {
      accessor.fileService.readShouldThrowError = new NotModifiedSinceFileOperationError("error", { ...stat, mtime: stat.mtime - 1, readonly: !stat.readonly, locked: !stat.locked });
      await workingCopy.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(getLastResolvedFileStat(workingCopy)?.mtime, stat.mtime, "mtime should not decrease");
    assert.notStrictEqual(getLastResolvedFileStat(workingCopy)?.readonly, stat.readonly, "readonly should have changed despite simultaneous attempt to decrease mtime");
    assert.notStrictEqual(getLastResolvedFileStat(workingCopy)?.locked, stat.locked, "locked should have changed despite simultaneous attempt to decrease mtime");
  });
  test("resolve (FILE_NOT_MODIFIED_SINCE can be handled for resolved working copies)", async () => {
    await workingCopy.resolve();
    try {
      accessor.fileService.readShouldThrowError = new FileOperationError("file not modified since", FileOperationResult.FILE_NOT_MODIFIED_SINCE);
      await workingCopy.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(workingCopy.model?.contents, "Hello Html");
  });
  test("resolve (FILE_NOT_MODIFIED_SINCE still updates readonly state)", async () => {
    let readonlyChangeCounter = 0;
    disposables.add(workingCopy.onDidChangeReadonly(() => readonlyChangeCounter++));
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isReadonly(), false);
    const stat = await accessor.fileService.resolve(workingCopy.resource, { resolveMetadata: true });
    try {
      accessor.fileService.readShouldThrowError = new NotModifiedSinceFileOperationError("file not modified since", { ...stat, readonly: true });
      await workingCopy.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(!!workingCopy.isReadonly(), true);
    assert.strictEqual(readonlyChangeCounter, 1);
    try {
      accessor.fileService.readShouldThrowError = new NotModifiedSinceFileOperationError("file not modified since", { ...stat, readonly: false });
      await workingCopy.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(workingCopy.isReadonly(), false);
    assert.strictEqual(readonlyChangeCounter, 2);
  });
  test("resolve does not alter content when model content changed in parallel", async () => {
    await workingCopy.resolve();
    const resolvePromise = workingCopy.resolve();
    workingCopy.model?.updateContents("changed content");
    await resolvePromise;
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(workingCopy.model?.contents, "changed content");
  });
  test("backup", async () => {
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello backup");
    const backup = await workingCopy.backup(CancellationToken.None);
    assert.ok(backup.meta);
    let backupContents = void 0;
    if (backup.content instanceof VSBuffer) {
      backupContents = backup.content.toString();
    } else if (isReadableStream(backup.content)) {
      backupContents = (await consumeStream(backup.content, (chunks) => VSBuffer.concat(chunks))).toString();
    } else if (backup.content) {
      backupContents = consumeReadable(backup.content, (chunks) => VSBuffer.concat(chunks)).toString();
    }
    assert.strictEqual(backupContents, "hello backup");
  });
  test("save (no errors) - simple", async () => {
    let savedCounter = 0;
    let lastSaveEvent = void 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
      lastSaveEvent = e;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.save();
    assert.strictEqual(savedCounter, 0);
    assert.strictEqual(saveErrorCounter, 0);
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello save");
    await workingCopy.save();
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(lastSaveEvent.reason, SaveReason.EXPLICIT);
    assert.ok(lastSaveEvent.stat);
    assert.ok(isStoredFileWorkingCopySaveEvent(lastSaveEvent));
    assert.strictEqual(workingCopy.model?.pushedStackElement, true);
  });
  test("save (no errors) - save reason", async () => {
    let savedCounter = 0;
    let lastSaveEvent = void 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
      lastSaveEvent = e;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello save");
    const source = SaveSourceRegistry.registerSource("testSource", "Hello Save");
    await workingCopy.save({ reason: SaveReason.AUTO, source });
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(lastSaveEvent.reason, SaveReason.AUTO);
    assert.strictEqual(lastSaveEvent.source, source);
  });
  test("save (no errors) - multiple", async () => {
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello save");
    await Promises.settled([
      workingCopy.save({ reason: SaveReason.AUTO }),
      workingCopy.save({ reason: SaveReason.EXPLICIT }),
      workingCopy.save({ reason: SaveReason.WINDOW_CHANGE })
    ]);
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("save (no errors) - multiple, cancellation", async () => {
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello save");
    const firstSave = workingCopy.save();
    workingCopy.model?.updateContents("hello save more");
    const secondSave = workingCopy.save();
    await Promises.settled([firstSave, secondSave]);
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("save (no errors) - not forced but not dirty", async () => {
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    await workingCopy.save();
    assert.strictEqual(savedCounter, 0);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("save (no errors) - forced but not dirty", async () => {
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave((e) => {
      savedCounter++;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    await workingCopy.save({ force: true });
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 0);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("save (no errors) - save clears orphaned", async () => {
    return runWithFakedTimers({}, async () => {
      let savedCounter = 0;
      disposables.add(workingCopy.onDidSave((e) => {
        savedCounter++;
      }));
      let saveErrorCounter = 0;
      disposables.add(workingCopy.onDidSaveError(() => {
        saveErrorCounter++;
      }));
      await workingCopy.resolve();
      const orphanedPromise = Event.toPromise(workingCopy.onDidChangeOrphaned);
      accessor.fileService.notExistsSet.set(resource, true);
      accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.DELETED }], false));
      await orphanedPromise;
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), true);
      await workingCopy.save({ force: true });
      assert.strictEqual(savedCounter, 1);
      assert.strictEqual(saveErrorCounter, 0);
      assert.strictEqual(workingCopy.isDirty(), false);
      assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ORPHAN), false);
    });
  });
  test("save (errors)", async () => {
    let savedCounter = 0;
    disposables.add(workingCopy.onDidSave((reason) => {
      savedCounter++;
    }));
    let saveErrorCounter = 0;
    disposables.add(workingCopy.onDidSaveError(() => {
      saveErrorCounter++;
    }));
    await workingCopy.resolve();
    try {
      accessor.fileService.writeShouldThrowError = new FileOperationError("write error", FileOperationResult.FILE_PERMISSION_DENIED);
      await workingCopy.save({ force: true });
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    assert.strictEqual(savedCounter, 0);
    assert.strictEqual(saveErrorCounter, 1);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.CONFLICT), false);
    assert.strictEqual(workingCopy.isDirty(), true);
    await workingCopy.save({ reason: SaveReason.AUTO });
    assert.strictEqual(savedCounter, 0);
    assert.strictEqual(saveErrorCounter, 1);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.CONFLICT), false);
    assert.strictEqual(workingCopy.isDirty(), true);
    await workingCopy.save({ reason: SaveReason.EXPLICIT });
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 1);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.CONFLICT), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    try {
      accessor.fileService.writeShouldThrowError = new FileOperationError("write error conflict", FileOperationResult.FILE_MODIFIED_SINCE);
      await workingCopy.save({ force: true });
    } catch (error) {
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(saveErrorCounter, 2);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.CONFLICT), true);
    assert.strictEqual(workingCopy.isDirty(), true);
    await workingCopy.save({ reason: SaveReason.EXPLICIT });
    assert.strictEqual(savedCounter, 2);
    assert.strictEqual(saveErrorCounter, 2);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.ERROR), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.CONFLICT), false);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("save (errors, bubbles up with `ignoreErrorHandler`)", async () => {
    await workingCopy.resolve();
    let error = void 0;
    try {
      accessor.fileService.writeShouldThrowError = new FileOperationError("write error", FileOperationResult.FILE_PERMISSION_DENIED);
      await workingCopy.save({ force: true, ignoreErrorHandler: true });
    } catch (e) {
      error = e;
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    assert.ok(error);
  });
  test("save - returns false when save fails", async function() {
    await workingCopy.resolve();
    try {
      accessor.fileService.writeShouldThrowError = new FileOperationError("write error", FileOperationResult.FILE_PERMISSION_DENIED);
      const res2 = await workingCopy.save({ force: true });
      assert.strictEqual(res2, false);
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    const res = await workingCopy.save({ force: true });
    assert.strictEqual(res, true);
  });
  test("save participant", async () => {
    await workingCopy.resolve();
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, false);
    let participationCounter = 0;
    const disposable = accessor.workingCopyFileService.addSaveParticipant({
      participate: async (wc) => {
        if (workingCopy === wc) {
          participationCounter++;
        }
      }
    });
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, true);
    await workingCopy.save({ force: true });
    assert.strictEqual(participationCounter, 1);
    await workingCopy.save({ force: true, skipSaveParticipants: true });
    assert.strictEqual(participationCounter, 1);
    disposable.dispose();
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, false);
    await workingCopy.save({ force: true });
    assert.strictEqual(participationCounter, 1);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (sync save)", async function() {
    await workingCopy.resolve();
    await testSaveFromSaveParticipant(workingCopy, false);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (async save)", async function() {
    await workingCopy.resolve();
    await testSaveFromSaveParticipant(workingCopy, true);
  });
  async function testSaveFromSaveParticipant(workingCopy2, async) {
    const from = URI.file("testFrom");
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, false);
    const disposable = accessor.workingCopyFileService.addSaveParticipant({
      participate: async (wc, context) => {
        if (async) {
          await timeout(10);
        }
        await workingCopy2.save({ force: true });
      }
    });
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, true);
    await workingCopy2.save({ force: true, from });
    disposable.dispose();
  }
  test("Save Participant carries context", async function() {
    await workingCopy.resolve();
    const from = URI.file("testFrom");
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, false);
    let e = void 0;
    const disposable = accessor.workingCopyFileService.addSaveParticipant({
      participate: async (wc, context) => {
        try {
          assert.strictEqual(context.reason, SaveReason.EXPLICIT);
          assert.strictEqual(context.savedFrom?.toString(), from.toString());
        } catch (error) {
          e = error;
        }
      }
    });
    assert.strictEqual(accessor.workingCopyFileService.hasSaveParticipants, true);
    await workingCopy.save({ force: true, from });
    if (e) {
      throw e;
    }
    disposable.dispose();
  });
  test("revert", async () => {
    await workingCopy.resolve();
    workingCopy.model?.updateContents("hello revert");
    let revertedCounter = 0;
    disposables.add(workingCopy.onDidRevert(() => {
      revertedCounter++;
    }));
    await workingCopy.revert({ soft: true });
    assert.strictEqual(revertedCounter, 1);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(workingCopy.model?.contents, "hello revert");
    await workingCopy.revert();
    assert.strictEqual(revertedCounter, 1);
    assert.strictEqual(workingCopy.model?.contents, "hello revert");
    await workingCopy.revert({ force: true });
    assert.strictEqual(revertedCounter, 2);
    assert.strictEqual(workingCopy.model?.contents, "Hello Html");
    try {
      workingCopy.model?.updateContents("hello revert");
      accessor.fileService.readShouldThrowError = new FileOperationError("error", FileOperationResult.FILE_PERMISSION_DENIED);
      await workingCopy.revert({ force: true });
    } catch (error) {
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(revertedCounter, 2);
    assert.strictEqual(workingCopy.isDirty(), true);
    try {
      workingCopy.model?.updateContents("hello revert");
      accessor.fileService.readShouldThrowError = new FileOperationError("error", FileOperationResult.FILE_NOT_FOUND);
      await workingCopy.revert({ force: true });
    } catch (error) {
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(revertedCounter, 3);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("state", async () => {
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), true);
    await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello state")) });
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), true);
    const savePromise = workingCopy.save();
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), true);
    await savePromise;
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
  });
  test("joinState", async () => {
    await workingCopy.resolve({ contents: bufferToStream(VSBuffer.fromString("hello state")) });
    workingCopy.save();
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), true);
    await workingCopy.joinState(StoredFileWorkingCopyState.PENDING_SAVE);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.DIRTY), false);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.SAVED), true);
    assert.strictEqual(workingCopy.hasState(StoredFileWorkingCopyState.PENDING_SAVE), false);
  });
  test("isReadonly, isResolved, dispose, isDisposed", async () => {
    assert.strictEqual(workingCopy.isResolved(), false);
    assert.strictEqual(workingCopy.isReadonly(), false);
    assert.strictEqual(workingCopy.isDisposed(), false);
    await workingCopy.resolve();
    assert.ok(workingCopy.model);
    assert.strictEqual(workingCopy.isResolved(), true);
    assert.strictEqual(workingCopy.isReadonly(), false);
    assert.strictEqual(workingCopy.isDisposed(), false);
    let disposedEvent = false;
    disposables.add(workingCopy.onWillDispose(() => {
      disposedEvent = true;
    }));
    let disposedModelEvent = false;
    disposables.add(workingCopy.model.onWillDispose(() => {
      disposedModelEvent = true;
    }));
    workingCopy.dispose();
    assert.strictEqual(workingCopy.isDisposed(), true);
    assert.strictEqual(disposedEvent, true);
    assert.strictEqual(disposedModelEvent, true);
  });
  test("readonly change event", async () => {
    accessor.fileService.readonly = true;
    await workingCopy.resolve();
    assert.strictEqual(!!workingCopy.isReadonly(), true);
    accessor.fileService.readonly = false;
    let readonlyEvent = false;
    disposables.add(workingCopy.onDidChangeReadonly(() => {
      readonlyEvent = true;
    }));
    await workingCopy.resolve();
    assert.strictEqual(workingCopy.isReadonly(), false);
    assert.strictEqual(readonlyEvent, true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
export {
  TestStoredFileWorkingCopyModel,
  TestStoredFileWorkingCopyModelFactory,
  TestStoredFileWorkingCopyModelWithCustomSave,
  TestStoredFileWorkingCopyModelWithCustomSaveFactory
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9icm93c2VyL3N0b3JlZEZpbGVXb3JraW5nQ29weS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgU3RvcmVkRmlsZVdvcmtpbmdDb3B5LCBTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxDb250ZW50Q2hhbmdlZEV2ZW50LCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5LCBpc1N0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudCwgSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zdG9yZWRGaWxlV29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSwgc3RyZWFtVG9CdWZmZXIsIFZTQnVmZmVyLCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBnZXRMYXN0UmVzb2x2ZWRGaWxlU3RhdCwgVGVzdFNlcnZpY2VBY2Nlc3Nvciwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZXNFdmVudCwgRmlsZUNoYW5nZVR5cGUsIEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvblJlc3VsdCwgSUZpbGVTdGF0V2l0aE1ldGFkYXRhLCBJV3JpdGVGaWxlT3B0aW9ucywgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBTYXZlUmVhc29uLCBTYXZlU291cmNlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFByb21pc2VzLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgY29uc3VtZVJlYWRhYmxlLCBjb25zdW1lU3RyZWFtLCBpc1JlYWRhYmxlU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFNuYXBzaG90Q29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlV29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuXG5leHBvcnQgY2xhc3MgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VDb250ZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8SVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsQ29udGVudENoYW5nZWRFdmVudD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQ29udGVudCA9IHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbldpbGxEaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uV2lsbERpc3Bvc2UgPSB0aGlzLl9vbldpbGxEaXNwb3NlLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IHJlc291cmNlOiBVUkksIHB1YmxpYyBjb250ZW50czogc3RyaW5nKSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdGZpcmVDb250ZW50Q2hhbmdlRXZlbnQoZXZlbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUNvbnRlbnQuZmlyZShldmVudCk7XG5cdH1cblxuXHR1cGRhdGVDb250ZW50cyhuZXdDb250ZW50czogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5kb1VwZGF0ZShuZXdDb250ZW50cyk7XG5cdH1cblxuXHRwcml2YXRlIHRocm93T25TbmFwc2hvdCA9IGZhbHNlO1xuXHRzZXRUaHJvd09uU25hcHNob3QoKTogdm9pZCB7XG5cdFx0dGhpcy50aHJvd09uU25hcHNob3QgPSB0cnVlO1xuXHR9XG5cblx0YXN5bmMgc25hcHNob3QoY29udGV4dDogU25hcHNob3RDb250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFZTQnVmZmVyUmVhZGFibGVTdHJlYW0+IHtcblx0XHRpZiAodGhpcy50aHJvd09uU25hcHNob3QpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZUJ1ZmZlclN0cmVhbSgpO1xuXHRcdHN0cmVhbS5lbmQoVlNCdWZmZXIuZnJvbVN0cmluZyh0aGlzLmNvbnRlbnRzKSk7XG5cblx0XHRyZXR1cm4gc3RyZWFtO1xuXHR9XG5cblx0YXN5bmMgdXBkYXRlKGNvbnRlbnRzOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmRvVXBkYXRlKChhd2FpdCBzdHJlYW1Ub0J1ZmZlcihjb250ZW50cykpLnRvU3RyaW5nKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBkb1VwZGF0ZShuZXdDb250ZW50czogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5jb250ZW50cyA9IG5ld0NvbnRlbnRzO1xuXG5cdFx0dGhpcy52ZXJzaW9uSWQrKztcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ29udGVudC5maXJlKHsgaXNSZWRvaW5nOiBmYWxzZSwgaXNVbmRvaW5nOiBmYWxzZSB9KTtcblx0fVxuXG5cdHZlcnNpb25JZCA9IDA7XG5cblx0cHVzaGVkU3RhY2tFbGVtZW50ID0gZmFsc2U7XG5cblx0cHVzaFN0YWNrRWxlbWVudCgpOiB2b2lkIHtcblx0XHR0aGlzLnB1c2hlZFN0YWNrRWxlbWVudCA9IHRydWU7XG5cdH1cblxuXHRvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uV2lsbERpc3Bvc2UuZmlyZSgpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxXaXRoQ3VzdG9tU2F2ZSBleHRlbmRzIFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbCB7XG5cblx0c2F2ZUNvdW50ZXIgPSAwO1xuXHR0aHJvd09uU2F2ZSA9IGZhbHNlO1xuXHRzYXZlT3BlcmF0aW9uOiBQcm9taXNlPHZvaWQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGFzeW5jIHNhdmUob3B0aW9uczogSVdyaXRlRmlsZU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUZpbGVTdGF0V2l0aE1ldGFkYXRhPiB7XG5cdFx0aWYgKHRoaXMudGhyb3dPblNhdmUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignRmFpbCcpO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLnNhdmVPcGVyYXRpb24pIHtcblx0XHRcdGF3YWl0IHRoaXMuc2F2ZU9wZXJhdGlvbjtcblx0XHR9XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2FuY2VsZWQnKTtcblx0XHR9XG5cblx0XHR0aGlzLnNhdmVDb3VudGVyKys7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2U6IHRoaXMucmVzb3VyY2UsXG5cdFx0XHRjdGltZTogMCxcblx0XHRcdGV0YWc6ICcnLFxuXHRcdFx0aXNEaXJlY3Rvcnk6IGZhbHNlLFxuXHRcdFx0aXNGaWxlOiB0cnVlLFxuXHRcdFx0bXRpbWU6IDAsXG5cdFx0XHRuYW1lOiAncmVzb3VyY2UyJyxcblx0XHRcdHNpemU6IDAsXG5cdFx0XHRpc1N5bWJvbGljTGluazogZmFsc2UsXG5cdFx0XHRyZWFkb25seTogZmFsc2UsXG5cdFx0XHRsb2NrZWQ6IGZhbHNlLFxuXHRcdFx0Y2hpbGRyZW46IHVuZGVmaW5lZFxuXHRcdH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbEZhY3RvcnkgaW1wbGVtZW50cyBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5PFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD4ge1xuXG5cdGFzeW5jIGNyZWF0ZU1vZGVsKHJlc291cmNlOiBVUkksIGNvbnRlbnRzOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD4ge1xuXHRcdHJldHVybiBuZXcgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsKHJlc291cmNlLCAoYXdhaXQgc3RyZWFtVG9CdWZmZXIoY29udGVudHMpKS50b1N0cmluZygpKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsV2l0aEN1c3RvbVNhdmVGYWN0b3J5IGltcGxlbWVudHMgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeTxUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxXaXRoQ3VzdG9tU2F2ZT4ge1xuXG5cdGFzeW5jIGNyZWF0ZU1vZGVsKHJlc291cmNlOiBVUkksIGNvbnRlbnRzOiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbFdpdGhDdXN0b21TYXZlPiB7XG5cdFx0cmV0dXJuIG5ldyBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxXaXRoQ3VzdG9tU2F2ZShyZXNvdXJjZSwgKGF3YWl0IHN0cmVhbVRvQnVmZmVyKGNvbnRlbnRzKSkudG9TdHJpbmcoKSk7XG5cdH1cbn1cblxuc3VpdGUoJ1N0b3JlZEZpbGVXb3JraW5nQ29weSAod2l0aCBjdXN0b20gc2F2ZSknLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZmFjdG9yeSA9IG5ldyBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxXaXRoQ3VzdG9tU2F2ZUZhY3RvcnkoKTtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IGFjY2Vzc29yOiBUZXN0U2VydmljZUFjY2Vzc29yO1xuXHRsZXQgd29ya2luZ0NvcHk6IFN0b3JlZEZpbGVXb3JraW5nQ29weTxUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxXaXRoQ3VzdG9tU2F2ZT47XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0YWNjZXNzb3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U2VydmljZUFjY2Vzc29yKTtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3Rlc3QvcmVzb3VyY2UnKTtcblx0XHR3b3JraW5nQ29weSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RvcmVkRmlsZVdvcmtpbmdDb3B5PFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbFdpdGhDdXN0b21TYXZlPigndGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weVR5cGUnLCByZXNvdXJjZSwgYmFzZW5hbWUocmVzb3VyY2UpLCBmYWN0b3J5LCBvcHRpb25zID0+IHdvcmtpbmdDb3B5LnJlc29sdmUob3B0aW9ucyksIGFjY2Vzc29yLmZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci5sb2dTZXJ2aWNlLCBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZSwgYWNjZXNzb3Iubm90aWZpY2F0aW9uU2VydmljZSwgYWNjZXNzb3Iud29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lbGV2YXRlZEZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci5wcm9ncmVzc1NlcnZpY2UpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKGN1c3RvbSBpbXBsZW1lbnRlZCknLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHNhdmVkQ291bnRlciA9IDA7XG5cdFx0bGV0IGxhc3RTYXZlRXZlbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdHNhdmVkQ291bnRlcisrO1xuXHRcdFx0bGFzdFNhdmVFdmVudCA9IGU7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHNhdmVFcnJvckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRzYXZlRXJyb3JDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gdW5yZXNvbHZlZFxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZUVycm9yQ291bnRlciwgMCk7XG5cblx0XHQvLyBzaW1wbGVcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBzYXZlJyk7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuc2F2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFNhdmVFdmVudCEucmVhc29uLCBTYXZlUmVhc29uLkVYUExJQ0lUKTtcblx0XHRhc3NlcnQub2sobGFzdFNhdmVFdmVudCEuc3RhdCk7XG5cdFx0YXNzZXJ0Lm9rKGlzU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50KGxhc3RTYXZlRXZlbnQhKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lm1vZGVsPy5wdXNoZWRTdGFja0VsZW1lbnQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgod29ya2luZ0NvcHkubW9kZWwgYXMgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsV2l0aEN1c3RvbVNhdmUpLnNhdmVDb3VudGVyLCAxKTtcblxuXHRcdC8vIGVycm9yXG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBzYXZlIGVycm9yJyk7XG5cdFx0KHdvcmtpbmdDb3B5Lm1vZGVsIGFzIFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbFdpdGhDdXN0b21TYXZlKS50aHJvd09uU2F2ZSA9IHRydWU7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuc2F2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5FUlJPUiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIGNhbmNlbGxlZCAoY3VzdG9tIGltcGxlbWVudGVkKScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgc2F2ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgbGFzdFNhdmVFdmVudDogSVN0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRkaXNwb3NhYmxlcy5hZGQod29ya2luZ0NvcHkub25EaWRTYXZlKGUgPT4ge1xuXHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0XHRsYXN0U2F2ZUV2ZW50ID0gZTtcblx0XHR9KSk7XG5cblx0XHRsZXQgc2F2ZUVycm9yQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZUVycm9yKCgpID0+IHtcblx0XHRcdHNhdmVFcnJvckNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0bGV0IHJlc29sdmU6ICgpID0+IHZvaWQ7XG5cdFx0KHdvcmtpbmdDb3B5Lm1vZGVsIGFzIFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbFdpdGhDdXN0b21TYXZlKS5zYXZlT3BlcmF0aW9uID0gbmV3IFByb21pc2UociA9PiByZXNvbHZlID0gcik7XG5cblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2ZpcnN0Jyk7XG5cdFx0Y29uc3QgZmlyc3RTYXZlID0gd29ya2luZ0NvcHkuc2F2ZSgpO1xuXHRcdC8vIGNhbmNlbCB0aGUgZmlyc3Qgc2F2ZSBieSByZXF1ZXN0aW5nIGEgc2Vjb25kIHdoaWxlIGl0IGlzIHN0aWxsIG1pZCBvcGVyYXRpb25cblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ3NlY29uZCcpO1xuXHRcdGNvbnN0IHNlY29uZFNhdmUgPSB3b3JraW5nQ29weS5zYXZlKCk7XG5cdFx0cmVzb2x2ZSEoKTtcblx0XHRhd2FpdCBmaXJzdFNhdmU7XG5cdFx0YXdhaXQgc2Vjb25kU2F2ZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlRXJyb3JDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RTYXZlRXZlbnQhLnJlYXNvbiwgU2F2ZVJlYXNvbi5FWFBMSUNJVCk7XG5cdFx0YXNzZXJ0Lm9rKGxhc3RTYXZlRXZlbnQhLnN0YXQpO1xuXHRcdGFzc2VydC5vayhpc1N0b3JlZEZpbGVXb3JraW5nQ29weVNhdmVFdmVudChsYXN0U2F2ZUV2ZW50ISkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8ucHVzaGVkU3RhY2tFbGVtZW50LCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKHdvcmtpbmdDb3B5Lm1vZGVsIGFzIFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbFdpdGhDdXN0b21TYXZlKS5zYXZlQ291bnRlciwgMSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG5cbnN1aXRlKCdTdG9yZWRGaWxlV29ya2luZ0NvcHknLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZmFjdG9yeSA9IG5ldyBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5KCk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJ3Rlc3QvcmVzb3VyY2UnKTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBhY2Nlc3NvcjogVGVzdFNlcnZpY2VBY2Nlc3Nvcjtcblx0bGV0IHdvcmtpbmdDb3B5OiBTdG9yZWRGaWxlV29ya2luZ0NvcHk8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPjtcblxuXHRmdW5jdGlvbiBjcmVhdGVXb3JraW5nQ29weSh1cmk6IFVSSSA9IHJlc291cmNlKSB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHk6IFN0b3JlZEZpbGVXb3JraW5nQ29weTxUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWw+ID0gbmV3IFN0b3JlZEZpbGVXb3JraW5nQ29weTxUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWw+KCd0ZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5VHlwZScsIHVyaSwgYmFzZW5hbWUodXJpKSwgZmFjdG9yeSwgb3B0aW9ucyA9PiB3b3JraW5nQ29weS5yZXNvbHZlKG9wdGlvbnMpLCBhY2Nlc3Nvci5maWxlU2VydmljZSwgYWNjZXNzb3IubG9nU2VydmljZSwgYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZSwgYWNjZXNzb3IuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgYWNjZXNzb3Iud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLCBhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UsIGFjY2Vzc29yLm5vdGlmaWNhdGlvblNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5RWRpdG9yU2VydmljZSwgYWNjZXNzb3IuZWRpdG9yU2VydmljZSwgYWNjZXNzb3IuZWxldmF0ZWRGaWxlU2VydmljZSwgYWNjZXNzb3IucHJvZ3Jlc3NTZXJ2aWNlKTtcblxuXHRcdHJldHVybiB3b3JraW5nQ29weTtcblx0fVxuXG5cdHNldHVwKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cblx0XHR3b3JraW5nQ29weSA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVXb3JraW5nQ29weSgpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblxuXHRcdGZvciAoY29uc3Qgd29ya2luZ0NvcHkgb2YgYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMpIHtcblx0XHRcdCh3b3JraW5nQ29weSBhcyBTdG9yZWRGaWxlV29ya2luZ0NvcHk8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPikuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZ2lzdGVycyB3aXRoIHdvcmtpbmcgY29weSBzZXJ2aWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDEpO1xuXG5cdFx0d29ya2luZ0NvcHkuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS53b3JraW5nQ29waWVzLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ29ycGhhbmVkIHRyYWNraW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5PUlBIQU4pLCBmYWxzZSk7XG5cblx0XHRcdGxldCBvbkRpZENoYW5nZU9ycGhhbmVkUHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh3b3JraW5nQ29weS5vbkRpZENoYW5nZU9ycGhhbmVkKTtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLm5vdEV4aXN0c1NldC5zZXQocmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVDaGFuZ2VzKG5ldyBGaWxlQ2hhbmdlc0V2ZW50KFt7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH1dLCBmYWxzZSkpO1xuXG5cdFx0XHRhd2FpdCBvbkRpZENoYW5nZU9ycGhhbmVkUHJvbWlzZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5PUlBIQU4pLCB0cnVlKTtcblxuXHRcdFx0b25EaWRDaGFuZ2VPcnBoYW5lZFByb21pc2UgPSBFdmVudC50b1Byb21pc2Uod29ya2luZ0NvcHkub25EaWRDaGFuZ2VPcnBoYW5lZCk7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5ub3RFeGlzdHNTZXQuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuQURERUQgfV0sIGZhbHNlKSk7XG5cblx0XHRcdGF3YWl0IG9uRGlkQ2hhbmdlT3JwaGFuZWRQcm9taXNlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLk9SUEhBTiksIGZhbHNlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZGlydHkgLyBtb2RpZmllZCcsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNNb2RpZmllZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5ESVJUWSksIGZhbHNlKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNSZXNvbHZlZCgpLCB0cnVlKTtcblxuXHRcdGxldCBjaGFuZ2VEaXJ0eUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZENoYW5nZURpcnR5KCgpID0+IHtcblx0XHRcdGNoYW5nZURpcnR5Q291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGxldCBjb250ZW50Q2hhbmdlQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7XG5cdFx0XHRjb250ZW50Q2hhbmdlQ291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGxldCBzYXZlZENvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmUoKCkgPT4ge1xuXHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gRGlydHkgZnJvbTogTW9kZWwgY29udGVudCBjaGFuZ2Vcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIGRpcnR5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRlbnRDaGFuZ2VDb3VudGVyLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc01vZGlmaWVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5ESVJUWSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2VEaXJ0eUNvdW50ZXIsIDEpO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuc2F2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRElSVFkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZURpcnR5Q291bnRlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cblx0XHQvLyBEaXJ0eSBmcm9tOiBJbml0aWFsIGNvbnRlbnRzXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSh7IGNvbnRlbnRzOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCdoZWxsbyBkaXJ0eSBzdHJlYW0nKSkgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudENoYW5nZUNvdW50ZXIsIDIpOyAvLyBjb250ZW50IG9mIG1vZGVsIGRpZCBub3QgY2hhbmdlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLkRJUlRZKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZURpcnR5Q291bnRlciwgMyk7XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXZlcnQoeyBzb2Z0OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRElSVFkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZURpcnR5Q291bnRlciwgNCk7XG5cblx0XHQvLyBNb2RpZmllZCBmcm9tOiBBUElcblx0XHR3b3JraW5nQ29weS5tYXJrTW9kaWZpZWQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc01vZGlmaWVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5ESVJUWSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2VEaXJ0eUNvdW50ZXIsIDUpO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmV2ZXJ0KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNNb2RpZmllZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5ESVJUWSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlRGlydHlDb3VudGVyLCA2KTtcblx0fSk7XG5cblx0dGVzdCgnZGlydHkgLSB3b3JraW5nIGNvcHkgbWFya3Mgbm9uLWRpcnR5IHdoZW4gdW5kbyByZWFjaGVzIHNhdmVkIHZlcnNpb24gSUQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBzYXZlZCBzdGF0ZScpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2NoYW5naW5nIGNvbnRlbnQgb25jZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXG5cdFx0Ly8gU2ltdWxhdGUgYW4gdW5kbyB0aGF0IGdvZXMgYmFjayB0byB0aGUgbGFzdCAoc2F2ZWQpIHZlcnNpb24gSURcblx0XHR3b3JraW5nQ29weS5tb2RlbCEudmVyc2lvbklkLS07XG5cblx0XHR3b3JraW5nQ29weS5tb2RlbD8uZmlyZUNvbnRlbnRDaGFuZ2VFdmVudCh7IGlzUmVkb2luZzogZmFsc2UsIGlzVW5kb2luZzogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKHdpdGhvdXQgYmFja3VwKScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgb25EaWRSZXNvbHZlQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkUmVzb2x2ZSgoKSA9PiB7XG5cdFx0XHRvbkRpZFJlc29sdmVDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gcmVzb2x2ZSBmcm9tIGZpbGVcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzUmVzb2x2ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uRGlkUmVzb2x2ZUNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdIZWxsbyBIdG1sJyk7XG5cblx0XHQvLyBkaXJ0eSByZXNvbHZlIHJldHVybnMgZWFybHlcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIHJlc29sdmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uRGlkUmVzb2x2ZUNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdoZWxsbyByZXNvbHZlJyk7XG5cblx0XHQvLyBkaXJ0eSByZXNvbHZlIHdpdGggY29udGVudHMgdXBkYXRlcyBjb250ZW50c1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnaGVsbG8gaW5pdGlhbCBjb250ZW50cycpKSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnaGVsbG8gaW5pdGlhbCBjb250ZW50cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkRpZFJlc29sdmVDb3VudGVyLCAyKTtcblxuXHRcdC8vIHJlc29sdmUgd2l0aCBwZW5kaW5nIHNhdmUgcmV0dXJucyBkaXJlY3RseVxuXHRcdGNvbnN0IHBlbmRpbmdTYXZlID0gd29ya2luZ0NvcHkuc2F2ZSgpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHRhd2FpdCBwZW5kaW5nU2F2ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lm1vZGVsPy5jb250ZW50cywgJ2hlbGxvIGluaXRpYWwgY29udGVudHMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob25EaWRSZXNvbHZlQ291bnRlciwgMik7XG5cblx0XHQvLyBkaXNwb3NlZCByZXNvbHZlIGlzIG5vdCB0aHJvd2luZyBhbiBlcnJvclxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlzcG9zZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uRGlkUmVzb2x2ZUNvdW50ZXIsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlICh3aXRoIGJhY2t1cCknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSh7IGNvbnRlbnRzOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCdoZWxsbyBiYWNrdXAnKSkgfSk7XG5cblx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB3b3JraW5nQ29weS5iYWNrdXAoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmJhY2t1cCh3b3JraW5nQ29weSwgYmFja3VwLmNvbnRlbnQsIHVuZGVmaW5lZCwgYmFja3VwLm1ldGEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKHdvcmtpbmdDb3B5KSwgdHJ1ZSk7XG5cblx0XHR3b3JraW5nQ29weS5kaXNwb3NlKCk7XG5cblx0XHQvLyBmaXJzdCByZXNvbHZlIGxvYWRzIGZyb20gYmFja3VwXG5cdFx0d29ya2luZ0NvcHkgPSBjcmVhdGVXb3JraW5nQ29weSgpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc1JlYWRvbmx5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnaGVsbG8gYmFja3VwJyk7XG5cblx0XHR3b3JraW5nQ29weS5tb2RlbC51cGRhdGVDb250ZW50cygnaGVsbG8gdXBkYXRlZCcpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblxuXHRcdC8vIHN1YnNlcXVlbnQgcmVzb2x2ZSBpZ25vcmVzIGFueSBiYWNrdXBzXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdIZWxsbyBIdG1sJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKHdpdGggYmFja3VwLCBwcmVzZXJ2ZXMgbWV0YWRhdGEgYW5kIG9ycGhhbmVkIHN0YXRlKScsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKHsgY29udGVudHM6IGJ1ZmZlclRvU3RyZWFtKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2hlbGxvIGJhY2t1cCcpKSB9KTtcblxuXHRcdFx0Y29uc3Qgb3JwaGFuZWRQcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKHdvcmtpbmdDb3B5Lm9uRGlkQ2hhbmdlT3JwaGFuZWQpO1xuXG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5ub3RFeGlzdHNTZXQuc2V0KHJlc291cmNlLCB0cnVlKTtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9XSwgZmFsc2UpKTtcblxuXHRcdFx0YXdhaXQgb3JwaGFuZWRQcm9taXNlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLk9SUEhBTiksIHRydWUpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB3b3JraW5nQ29weS5iYWNrdXAoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhd2FpdCBhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuYmFja3VwKHdvcmtpbmdDb3B5LCBiYWNrdXAuY29udGVudCwgdW5kZWZpbmVkLCBiYWNrdXAubWV0YSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuaGFzQmFja3VwU3luYyh3b3JraW5nQ29weSksIHRydWUpO1xuXG5cdFx0XHR3b3JraW5nQ29weS5kaXNwb3NlKCk7XG5cblx0XHRcdHdvcmtpbmdDb3B5ID0gY3JlYXRlV29ya2luZ0NvcHkoKTtcblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLk9SUEhBTiksIHRydWUpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXAyID0gYXdhaXQgd29ya2luZ0NvcHkuYmFja3VwKENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChiYWNrdXAubWV0YSwgYmFja3VwMi5tZXRhKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAodXBkYXRlcyBvcnBoYW5lZCBzdGF0ZSBhY2NvcmRpbmdseSknLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0XHRjb25zdCBvcnBoYW5lZFByb21pc2UgPSBFdmVudC50b1Byb21pc2Uod29ya2luZ0NvcHkub25EaWRDaGFuZ2VPcnBoYW5lZCk7XG5cblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLm5vdEV4aXN0c1NldC5zZXQocmVzb3VyY2UsIHRydWUpO1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVDaGFuZ2VzKG5ldyBGaWxlQ2hhbmdlc0V2ZW50KFt7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH1dLCBmYWxzZSkpO1xuXG5cdFx0XHRhd2FpdCBvcnBoYW5lZFByb21pc2U7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuT1JQSEFOKSwgdHJ1ZSk7XG5cblx0XHRcdC8vIHJlc29sdmluZyBjbGVhcnMgb3JwaGFuZWQgc3RhdGUgd2hlbiBzdWNjZXNzZnVsXG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5ub3RFeGlzdHNTZXQuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoeyBmb3JjZVJlYWRGcm9tRmlsZTogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5PUlBIQU4pLCBmYWxzZSk7XG5cblx0XHRcdC8vIHJlc29sdmluZyBhZGRzIG9ycGhhbmVkIHN0YXRlIHdoZW4gZmFpbCB0byByZWFkXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IoJ2ZpbGUgbm90IGZvdW5kJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cdFx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLk9SUEhBTiksIHRydWUpO1xuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXQucmVhZG9ubHkgYW5kIHN0YXQubG9ja2VkIGNhbiBjaGFuZ2Ugd2hlbiBkZWNyZWFzZWQgbXRpbWUgaXMgaWdub3JlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdGNvbnN0IHN0YXQgPSBhc3NlcnRJc0RlZmluZWQoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQod29ya2luZ0NvcHkpKTtcblx0XHR0cnkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSBuZXcgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCB7IC4uLnN0YXQsIG10aW1lOiBzdGF0Lm10aW1lIC0gMSwgcmVhZG9ubHk6ICFzdGF0LnJlYWRvbmx5LCBsb2NrZWQ6ICFzdGF0LmxvY2tlZCB9KTtcblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KHdvcmtpbmdDb3B5KT8ubXRpbWUsIHN0YXQubXRpbWUsICdtdGltZSBzaG91bGQgbm90IGRlY3JlYXNlJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KHdvcmtpbmdDb3B5KT8ucmVhZG9ubHksIHN0YXQucmVhZG9ubHksICdyZWFkb25seSBzaG91bGQgaGF2ZSBjaGFuZ2VkIGRlc3BpdGUgc2ltdWx0YW5lb3VzIGF0dGVtcHQgdG8gZGVjcmVhc2UgbXRpbWUnKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQod29ya2luZ0NvcHkpPy5sb2NrZWQsIHN0YXQubG9ja2VkLCAnbG9ja2VkIHNob3VsZCBoYXZlIGNoYW5nZWQgZGVzcGl0ZSBzaW11bHRhbmVvdXMgYXR0ZW1wdCB0byBkZWNyZWFzZSBtdGltZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIChGSUxFX05PVF9NT0RJRklFRF9TSU5DRSBjYW4gYmUgaGFuZGxlZCBmb3IgcmVzb2x2ZWQgd29ya2luZyBjb3BpZXMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IoJ2ZpbGUgbm90IG1vZGlmaWVkIHNpbmNlJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9NT0RJRklFRF9TSU5DRSk7XG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdIZWxsbyBIdG1sJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKEZJTEVfTk9UX01PRElGSUVEX1NJTkNFIHN0aWxsIHVwZGF0ZXMgcmVhZG9ubHkgc3RhdGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCByZWFkb25seUNoYW5nZUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZENoYW5nZVJlYWRvbmx5KCgpID0+IHJlYWRvbmx5Q2hhbmdlQ291bnRlcisrKSk7XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNSZWFkb25seSgpLCBmYWxzZSk7XG5cblx0XHRjb25zdCBzdGF0ID0gYXdhaXQgYWNjZXNzb3IuZmlsZVNlcnZpY2UucmVzb2x2ZSh3b3JraW5nQ29weS5yZXNvdXJjZSwgeyByZXNvbHZlTWV0YWRhdGE6IHRydWUgfSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSBuZXcgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvcignZmlsZSBub3QgbW9kaWZpZWQgc2luY2UnLCB7IC4uLnN0YXQsIHJlYWRvbmx5OiB0cnVlIH0pO1xuXHRcdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoISF3b3JraW5nQ29weS5pc1JlYWRvbmx5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWFkb25seUNoYW5nZUNvdW50ZXIsIDEpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRTaG91bGRUaHJvd0Vycm9yID0gbmV3IE5vdE1vZGlmaWVkU2luY2VGaWxlT3BlcmF0aW9uRXJyb3IoJ2ZpbGUgbm90IG1vZGlmaWVkIHNpbmNlJywgeyAuLi5zdGF0LCByZWFkb25seTogZmFsc2UgfSk7XG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc1JlYWRvbmx5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVhZG9ubHlDaGFuZ2VDb3VudGVyLCAyKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBkb2VzIG5vdCBhbHRlciBjb250ZW50IHdoZW4gbW9kZWwgY29udGVudCBjaGFuZ2VkIGluIHBhcmFsbGVsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdGNvbnN0IHJlc29sdmVQcm9taXNlID0gd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdjaGFuZ2VkIGNvbnRlbnQnKTtcblxuXHRcdGF3YWl0IHJlc29sdmVQcm9taXNlO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lm1vZGVsPy5jb250ZW50cywgJ2NoYW5nZWQgY29udGVudCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdiYWNrdXAnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXHRcdHdvcmtpbmdDb3B5Lm1vZGVsPy51cGRhdGVDb250ZW50cygnaGVsbG8gYmFja3VwJyk7XG5cblx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCB3b3JraW5nQ29weS5iYWNrdXAoQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRhc3NlcnQub2soYmFja3VwLm1ldGEpO1xuXG5cdFx0bGV0IGJhY2t1cENvbnRlbnRzOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKGJhY2t1cC5jb250ZW50IGluc3RhbmNlb2YgVlNCdWZmZXIpIHtcblx0XHRcdGJhY2t1cENvbnRlbnRzID0gYmFja3VwLmNvbnRlbnQudG9TdHJpbmcoKTtcblx0XHR9IGVsc2UgaWYgKGlzUmVhZGFibGVTdHJlYW0oYmFja3VwLmNvbnRlbnQpKSB7XG5cdFx0XHRiYWNrdXBDb250ZW50cyA9IChhd2FpdCBjb25zdW1lU3RyZWFtKGJhY2t1cC5jb250ZW50LCBjaHVua3MgPT4gVlNCdWZmZXIuY29uY2F0KGNodW5rcykpKS50b1N0cmluZygpO1xuXHRcdH0gZWxzZSBpZiAoYmFja3VwLmNvbnRlbnQpIHtcblx0XHRcdGJhY2t1cENvbnRlbnRzID0gY29uc3VtZVJlYWRhYmxlKGJhY2t1cC5jb250ZW50LCBjaHVua3MgPT4gVlNCdWZmZXIuY29uY2F0KGNodW5rcykpLnRvU3RyaW5nKCk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cENvbnRlbnRzLCAnaGVsbG8gYmFja3VwJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKG5vIGVycm9ycykgLSBzaW1wbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHNhdmVkQ291bnRlciA9IDA7XG5cdFx0bGV0IGxhc3RTYXZlRXZlbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdHNhdmVkQ291bnRlcisrO1xuXHRcdFx0bGFzdFNhdmVFdmVudCA9IGU7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHNhdmVFcnJvckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRzYXZlRXJyb3JDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gdW5yZXNvbHZlZFxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZUVycm9yQ291bnRlciwgMCk7XG5cblx0XHQvLyBzaW1wbGVcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBzYXZlJyk7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuc2F2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFNhdmVFdmVudCEucmVhc29uLCBTYXZlUmVhc29uLkVYUExJQ0lUKTtcblx0XHRhc3NlcnQub2sobGFzdFNhdmVFdmVudCEuc3RhdCk7XG5cdFx0YXNzZXJ0Lm9rKGlzU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50KGxhc3RTYXZlRXZlbnQhKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lm1vZGVsPy5wdXNoZWRTdGFja0VsZW1lbnQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIChubyBlcnJvcnMpIC0gc2F2ZSByZWFzb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHNhdmVkQ291bnRlciA9IDA7XG5cdFx0bGV0IGxhc3RTYXZlRXZlbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdHNhdmVkQ291bnRlcisrO1xuXHRcdFx0bGFzdFNhdmVFdmVudCA9IGU7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHNhdmVFcnJvckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRzYXZlRXJyb3JDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gc2F2ZSByZWFzb25cblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBzYXZlJyk7XG5cblx0XHRjb25zdCBzb3VyY2UgPSBTYXZlU291cmNlUmVnaXN0cnkucmVnaXN0ZXJTb3VyY2UoJ3Rlc3RTb3VyY2UnLCAnSGVsbG8gU2F2ZScpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uQVVUTywgc291cmNlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFNhdmVFdmVudCEucmVhc29uLCBTYXZlUmVhc29uLkFVVE8pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0U2F2ZUV2ZW50IS5zb3VyY2UsIHNvdXJjZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKG5vIGVycm9ycykgLSBtdWx0aXBsZScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgc2F2ZWRDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQod29ya2luZ0NvcHkub25EaWRTYXZlKGUgPT4ge1xuXHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHNhdmVFcnJvckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRzYXZlRXJyb3JDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gbXVsdGlwbGUgc2F2ZXMgaW4gcGFyYWxsZWwgYXJlIGZpbmUgYW5kIHJlc3VsdFxuXHRcdC8vIGluIGEgc2luZ2xlIHNhdmUgd2hlbiBjb250ZW50IGRvZXMgbm90IGNoYW5nZVxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIHNhdmUnKTtcblx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKFtcblx0XHRcdHdvcmtpbmdDb3B5LnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uQVVUTyB9KSxcblx0XHRcdHdvcmtpbmdDb3B5LnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSksXG5cdFx0XHR3b3JraW5nQ29weS5zYXZlKHsgcmVhc29uOiBTYXZlUmVhc29uLldJTkRPV19DSEFOR0UgfSlcblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlRXJyb3JDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKG5vIGVycm9ycykgLSBtdWx0aXBsZSwgY2FuY2VsbGF0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzYXZlZENvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmUoZSA9PiB7XG5cdFx0XHRzYXZlZENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRsZXQgc2F2ZUVycm9yQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZUVycm9yKCgpID0+IHtcblx0XHRcdHNhdmVFcnJvckNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHQvLyBtdWx0aXBsZSBzYXZlcyBpbiBwYXJhbGxlbCBhcmUgZmluZSBhbmQgcmVzdWx0XG5cdFx0Ly8gaW4ganVzdCBvbmUgc2F2ZSBvcGVyYXRpb24gKHRoZSBzZWNvbmQgb25lXG5cdFx0Ly8gY2FuY2VscyB0aGUgZmlyc3QpXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXHRcdHdvcmtpbmdDb3B5Lm1vZGVsPy51cGRhdGVDb250ZW50cygnaGVsbG8gc2F2ZScpO1xuXHRcdGNvbnN0IGZpcnN0U2F2ZSA9IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIHNhdmUgbW9yZScpO1xuXHRcdGNvbnN0IHNlY29uZFNhdmUgPSB3b3JraW5nQ29weS5zYXZlKCk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5zZXR0bGVkKFtmaXJzdFNhdmUsIHNlY29uZFNhdmVdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZUVycm9yQ291bnRlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIChubyBlcnJvcnMpIC0gbm90IGZvcmNlZCBidXQgbm90IGRpcnR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzYXZlZENvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmUoZSA9PiB7XG5cdFx0XHRzYXZlZENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRsZXQgc2F2ZUVycm9yQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZUVycm9yKCgpID0+IHtcblx0XHRcdHNhdmVFcnJvckNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHQvLyBubyBzYXZlIHdoZW4gbm90IGZvcmNlZCBhbmQgbm90IGRpcnR5XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZUVycm9yQ291bnRlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIChubyBlcnJvcnMpIC0gZm9yY2VkIGJ1dCBub3QgZGlydHknLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHNhdmVkQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdHNhdmVkQ291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGxldCBzYXZlRXJyb3JDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQod29ya2luZ0NvcHkub25EaWRTYXZlRXJyb3IoKCkgPT4ge1xuXHRcdFx0c2F2ZUVycm9yQ291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdC8vIHNhdmUgd2hlbiBmb3JjZWQgZXZlbiB3aGVuIG5vdCBkaXJ0eVxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSAobm8gZXJyb3JzKSAtIHNhdmUgY2xlYXJzIG9ycGhhbmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGxldCBzYXZlZENvdW50ZXIgPSAwO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0XHR9KSk7XG5cblx0XHRcdGxldCBzYXZlRXJyb3JDb3VudGVyID0gMDtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRcdHNhdmVFcnJvckNvdW50ZXIrKztcblx0XHRcdH0pKTtcblxuXHRcdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0XHQvLyBzYXZlIGNsZWFycyBvcnBoYW5lZFxuXHRcdFx0Y29uc3Qgb3JwaGFuZWRQcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKHdvcmtpbmdDb3B5Lm9uRGlkQ2hhbmdlT3JwaGFuZWQpO1xuXG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5ub3RFeGlzdHNTZXQuc2V0KHJlc291cmNlLCB0cnVlKTtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9XSwgZmFsc2UpKTtcblxuXHRcdFx0YXdhaXQgb3JwaGFuZWRQcm9taXNlO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLk9SUEhBTiksIHRydWUpO1xuXG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlRXJyb3JDb3VudGVyLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5PUlBIQU4pLCBmYWxzZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKGVycm9ycyknLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IHNhdmVkQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZShyZWFzb24gPT4ge1xuXHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHNhdmVFcnJvckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZFNhdmVFcnJvcigoKSA9PiB7XG5cdFx0XHRzYXZlRXJyb3JDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0Ly8gc2F2ZSBlcnJvcjogYW55IGVycm9yIG1hcmtzIHdvcmtpbmcgY29weSBkaXJ0eVxuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCd3cml0ZSBlcnJvcicsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRCk7XG5cblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZENvdW50ZXIsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlRXJyb3JDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRVJST1IpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuQ09ORkxJQ1QpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHQvLyBzYXZlIGlzIGEgbm8tb3AgdW5sZXNzIGZvcmNlZCB3aGVuIGluIGVycm9yIGNhc2Vcblx0XHRhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgcmVhc29uOiBTYXZlUmVhc29uLkFVVE8gfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5FUlJPUiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5TQVZFRCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuUEVORElOR19TQVZFKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5DT05GTElDVCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdC8vIHNhdmUgY2xlYXJzIGVycm9yIGZsYWdzIHdoZW4gc3VjY2Vzc2Z1bFxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5FUlJPUiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuUEVORElOR19TQVZFKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5DT05GTElDVCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cblx0XHQvLyBzYXZlIGVycm9yOiBjb25mbGljdFxuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCd3cml0ZSBlcnJvciBjb25mbGljdCcsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT0RJRklFRF9TSU5DRSk7XG5cblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gZXJyb3IgaXMgZXhwZWN0ZWRcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlRXJyb3JDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRVJST1IpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuQ09ORkxJQ1QpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdC8vIHNhdmUgY2xlYXJzIGVycm9yIGZsYWdzIHdoZW4gc3VjY2Vzc2Z1bFxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uRVhQTElDSVQgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkQ291bnRlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5FUlJPUiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuUEVORElOR19TQVZFKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5oYXNTdGF0ZShTdG9yZWRGaWxlV29ya2luZ0NvcHlTdGF0ZS5DT05GTElDVCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgKGVycm9ycywgYnViYmxlcyB1cCB3aXRoIGBpZ25vcmVFcnJvckhhbmRsZXJgKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cblx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCd3cml0ZSBlcnJvcicsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9QRVJNSVNTSU9OX0RFTklFRCk7XG5cblx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSwgaWdub3JlRXJyb3JIYW5kbGVyOiB0cnVlIH0pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGVycm9yID0gZTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhlcnJvcik7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgLSByZXR1cm5zIGZhbHNlIHdoZW4gc2F2ZSBmYWlscycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cblx0XHR0cnkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gbmV3IEZpbGVPcGVyYXRpb25FcnJvcignd3JpdGUgZXJyb3InLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfUEVSTUlTU0lPTl9ERU5JRUQpO1xuXG5cdFx0XHRjb25zdCByZXMgPSBhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcywgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgcGFydGljaXBhbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuaGFzU2F2ZVBhcnRpY2lwYW50cywgZmFsc2UpO1xuXG5cdFx0bGV0IHBhcnRpY2lwYXRpb25Db3VudGVyID0gMDtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5hZGRTYXZlUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jICh3YykgPT4ge1xuXHRcdFx0XHRpZiAod29ya2luZ0NvcHkgPT09IHdjKSB7XG5cdFx0XHRcdFx0cGFydGljaXBhdGlvbkNvdW50ZXIrKztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuaGFzU2F2ZVBhcnRpY2lwYW50cywgdHJ1ZSk7XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weS5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRpY2lwYXRpb25Db3VudGVyLCAxKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSwgc2tpcFNhdmVQYXJ0aWNpcGFudHM6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnRpY2lwYXRpb25Db3VudGVyLCAxKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmhhc1NhdmVQYXJ0aWNpcGFudHMsIGZhbHNlKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydGljaXBhdGlvbkNvdW50ZXIsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50LCBjYWxsaW5nIHNhdmUgZnJvbSB3aXRoaW4gaXMgdW5zdXBwb3J0ZWQgYnV0IGRvZXMgbm90IGV4cGxvZGUgKHN5bmMgc2F2ZSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0YXdhaXQgdGVzdFNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50KHdvcmtpbmdDb3B5LCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NhdmUgUGFydGljaXBhbnQsIGNhbGxpbmcgc2F2ZSBmcm9tIHdpdGhpbiBpcyB1bnN1cHBvcnRlZCBidXQgZG9lcyBub3QgZXhwbG9kZSAoYXN5bmMgc2F2ZSknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0YXdhaXQgdGVzdFNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50KHdvcmtpbmdDb3B5LCB0cnVlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdFNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50KHdvcmtpbmdDb3B5OiBTdG9yZWRGaWxlV29ya2luZ0NvcHk8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPiwgYXN5bmM6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmcm9tID0gVVJJLmZpbGUoJ3Rlc3RGcm9tJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuaGFzU2F2ZVBhcnRpY2lwYW50cywgZmFsc2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuYWRkU2F2ZVBhcnRpY2lwYW50KHtcblx0XHRcdHBhcnRpY2lwYXRlOiBhc3luYyAod2MsIGNvbnRleHQpID0+IHtcblxuXHRcdFx0XHRpZiAoYXN5bmMpIHtcblx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmhhc1NhdmVQYXJ0aWNpcGFudHMsIHRydWUpO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuc2F2ZSh7IGZvcmNlOiB0cnVlLCBmcm9tIH0pO1xuXG5cdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdH1cblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50IGNhcnJpZXMgY29udGV4dCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXNvbHZlKCk7XG5cblx0XHRjb25zdCBmcm9tID0gVVJJLmZpbGUoJ3Rlc3RGcm9tJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuaGFzU2F2ZVBhcnRpY2lwYW50cywgZmFsc2UpO1xuXG5cdFx0bGV0IGU6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmFkZFNhdmVQYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKHdjLCBjb250ZXh0KSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQucmVhc29uLCBTYXZlUmVhc29uLkVYUExJQ0lUKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dC5zYXZlZEZyb20/LnRvU3RyaW5nKCksIGZyb20udG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdFx0ZSA9IGVycm9yO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5oYXNTYXZlUGFydGljaXBhbnRzLCB0cnVlKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoeyBmb3JjZTogdHJ1ZSwgZnJvbSB9KTtcblxuXHRcdGlmIChlKSB7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXZlcnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXHRcdHdvcmtpbmdDb3B5Lm1vZGVsPy51cGRhdGVDb250ZW50cygnaGVsbG8gcmV2ZXJ0Jyk7XG5cblx0XHRsZXQgcmV2ZXJ0ZWRDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQod29ya2luZ0NvcHkub25EaWRSZXZlcnQoKCkgPT4ge1xuXHRcdFx0cmV2ZXJ0ZWRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Ly8gcmV2ZXJ0OiBzb2Z0XG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmV2ZXJ0KHsgc29mdDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZlcnRlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnaGVsbG8gcmV2ZXJ0Jyk7XG5cblx0XHQvLyByZXZlcnQ6IG5vdCBmb3JjZWRcblx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXZlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2ZXJ0ZWRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnaGVsbG8gcmV2ZXJ0Jyk7XG5cblx0XHQvLyByZXZlcnQ6IGZvcmNlZFxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJldmVydCh7IGZvcmNlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZlcnRlZENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdIZWxsbyBIdG1sJyk7XG5cblx0XHQvLyByZXZlcnQ6IGZvcmNlZCwgZXJyb3Jcblx0XHR0cnkge1xuXHRcdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyByZXZlcnQnKTtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRTaG91bGRUaHJvd0Vycm9yID0gbmV3IEZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfUEVSTUlTU0lPTl9ERU5JRUQpO1xuXG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXZlcnQoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gZXhwZWN0ZWQgKG91ciBlcnJvcilcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmVydGVkQ291bnRlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHQvLyByZXZlcnQ6IGZvcmNlZCwgZmlsZSBub3QgZm91bmQgZXJyb3IgaXMgaWdub3JlZFxuXHRcdHRyeSB7XG5cdFx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIHJldmVydCcpO1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCdlcnJvcicsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9OT1RfRk9VTkQpO1xuXG5cdFx0XHRhd2FpdCB3b3JraW5nQ29weS5yZXZlcnQoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gZXhwZWN0ZWQgKG91ciBlcnJvcilcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmVydGVkQ291bnRlciwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGF0ZScsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCB0cnVlKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnaGVsbG8gc3RhdGUnKSkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLkRJUlRZKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBzYXZlUHJvbWlzZSA9IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRElSVFkpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuU0FWRUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIHRydWUpO1xuXG5cdFx0YXdhaXQgc2F2ZVByb21pc2U7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRElSVFkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlNBVkVEKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnam9pblN0YXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnaGVsbG8gc3RhdGUnKSkgfSk7XG5cblx0XHR3b3JraW5nQ29weS5zYXZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIHRydWUpO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkuam9pblN0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaGFzU3RhdGUoU3RvcmVkRmlsZVdvcmtpbmdDb3B5U3RhdGUuRElSVFkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlNBVkVEKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc1N0YXRlKFN0b3JlZEZpbGVXb3JraW5nQ29weVN0YXRlLlBFTkRJTkdfU0FWRSksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaXNSZWFkb25seSwgaXNSZXNvbHZlZCwgZGlzcG9zZSwgaXNEaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNSZXNvbHZlZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzUmVhZG9ubHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0Rpc3Bvc2VkKCksIGZhbHNlKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5vayh3b3JraW5nQ29weS5tb2RlbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzUmVzb2x2ZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzUmVhZG9ubHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0Rpc3Bvc2VkKCksIGZhbHNlKTtcblxuXHRcdGxldCBkaXNwb3NlZEV2ZW50ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0ZGlzcG9zZWRFdmVudCA9IHRydWU7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGRpc3Bvc2VkTW9kZWxFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5tb2RlbC5vbldpbGxEaXNwb3NlKCgpID0+IHtcblx0XHRcdGRpc3Bvc2VkTW9kZWxFdmVudCA9IHRydWU7XG5cdFx0fSkpO1xuXG5cdFx0d29ya2luZ0NvcHkuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlzcG9zZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VkRXZlbnQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXNwb3NlZE1vZGVsRXZlbnQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWFkb25seSBjaGFuZ2UgZXZlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZG9ubHkgPSB0cnVlO1xuXG5cdFx0YXdhaXQgd29ya2luZ0NvcHkucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCEhd29ya2luZ0NvcHkuaXNSZWFkb25seSgpLCB0cnVlKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRvbmx5ID0gZmFsc2U7XG5cblx0XHRsZXQgcmVhZG9ubHlFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh3b3JraW5nQ29weS5vbkRpZENoYW5nZVJlYWRvbmx5KCgpID0+IHtcblx0XHRcdHJlYWRvbmx5RXZlbnQgPSB0cnVlO1xuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5LnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc1JlYWRvbmx5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVhZG9ubHlFdmVudCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxPQUFPLGVBQWU7QUFDL0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsdUJBQXVCLDRCQUE2SSx3Q0FBeUU7QUFDdFAsU0FBUyxnQkFBZ0IsMEJBQTBCLGdCQUFnQixnQkFBd0M7QUFDM0csU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLHlCQUF5QixxQkFBcUIscUNBQXFDO0FBRTVGLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCLGdCQUFnQixvQkFBb0IscUJBQStELDBDQUEwQztBQUN4SyxTQUFTLFlBQVksMEJBQTBCO0FBQy9DLFNBQVMsVUFBVSxlQUFlO0FBQ2xDLFNBQVMsaUJBQWlCLGVBQWUsd0JBQXdCO0FBQ2pFLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsdUJBQXVCO0FBRXpCLE1BQU0sdUNBQXVDLFdBQWtEO0FBQUEsRUFRckcsWUFBcUIsVUFBc0IsVUFBa0I7QUFDNUQsVUFBTTtBQURjO0FBQXNCO0FBTjNDLFNBQWlCLHNCQUFzQixLQUFLLFVBQVUsSUFBSSxRQUF3RCxDQUFDO0FBQ25ILFNBQVMscUJBQXFCLEtBQUssb0JBQW9CO0FBRXZELFNBQWlCLGlCQUFpQixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDcEUsU0FBUyxnQkFBZ0IsS0FBSyxlQUFlO0FBYzdDLFNBQVEsa0JBQWtCO0FBNEIxQixx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LE9BQUssYUFBYSxZQUFZO0FBQzdCLFVBQU0sWUFBWSxRQUFRLEVBQUUsVUFBVSxlQUFlLFNBQVMsV0FBVyxhQUFhLENBQUMsRUFBRSxDQUFDO0FBRTFGLGdCQUFZLEtBQUs7QUFDakIsV0FBTyxZQUFZLFlBQVksU0FBUywyQkFBMkIsWUFBWSxHQUFHLElBQUk7QUFFdEYsVUFBTSxZQUFZLFVBQVUsMkJBQTJCLFlBQVk7QUFFbkUsV0FBTyxZQUFZLFlBQVksU0FBUywyQkFBMkIsS0FBSyxHQUFHLEtBQUs7QUFDaEYsV0FBTyxZQUFZLFlBQVksU0FBUywyQkFBMkIsS0FBSyxHQUFHLElBQUk7QUFDL0UsV0FBTyxZQUFZLFlBQVksU0FBUywyQkFBMkIsWUFBWSxHQUFHLEtBQUs7QUFBQSxFQUN4RixDQUFDO0FBRUQsT0FBSywrQ0FBK0MsWUFBWTtBQUMvRCxXQUFPLFlBQVksWUFBWSxXQUFXLEdBQUcsS0FBSztBQUNsRCxXQUFPLFlBQVksWUFBWSxXQUFXLEdBQUcsS0FBSztBQUNsRCxXQUFPLFlBQVksWUFBWSxXQUFXLEdBQUcsS0FBSztBQUVsRCxVQUFNLFlBQVksUUFBUTtBQUUxQixXQUFPLEdBQUcsWUFBWSxLQUFLO0FBQzNCLFdBQU8sWUFBWSxZQUFZLFdBQVcsR0FBRyxJQUFJO0FBQ2pELFdBQU8sWUFBWSxZQUFZLFdBQVcsR0FBRyxLQUFLO0FBQ2xELFdBQU8sWUFBWSxZQUFZLFdBQVcsR0FBRyxLQUFLO0FBRWxELFFBQUksZ0JBQWdCO0FBQ3BCLGdCQUFZLElBQUksWUFBWSxjQUFjLE1BQU07QUFDL0Msc0JBQWdCO0FBQUEsSUFDakIsQ0FBQyxDQUFDO0FBRUYsUUFBSSxxQkFBcUI7QUFDekIsZ0JBQVksSUFBSSxZQUFZLE1BQU0sY0FBYyxNQUFNO0FBQ3JELDJCQUFxQjtBQUFBLElBQ3RCLENBQUMsQ0FBQztBQUVGLGdCQUFZLFFBQVE7QUFFcEIsV0FBTyxZQUFZLFlBQVksV0FBVyxHQUFHLElBQUk7QUFDakQsV0FBTyxZQUFZLGVBQWUsSUFBSTtBQUN0QyxXQUFPLFlBQVksb0JBQW9CLElBQUk7QUFBQSxFQUM1QyxDQUFDO0FBRUQsT0FBSyx5QkFBeUIsWUFBWTtBQUN6QyxhQUFTLFlBQVksV0FBVztBQUVoQyxVQUFNLFlBQVksUUFBUTtBQUUxQixXQUFPLFlBQVksQ0FBQyxDQUFDLFlBQVksV0FBVyxHQUFHLElBQUk7QUFFbkQsYUFBUyxZQUFZLFdBQVc7QUFFaEMsUUFBSSxnQkFBZ0I7QUFDcEIsZ0JBQVksSUFBSSxZQUFZLG9CQUFvQixNQUFNO0FBQ3JELHNCQUFnQjtBQUFBLElBQ2pCLENBQUMsQ0FBQztBQUVGLFVBQU0sWUFBWSxRQUFRO0FBRTFCLFdBQU8sWUFBWSxZQUFZLFdBQVcsR0FBRyxLQUFLO0FBQ2xELFdBQU8sWUFBWSxlQUFlLElBQUk7QUFBQSxFQUN2QyxDQUFDO0FBRUQsMENBQXdDO0FBQ3pDLENBQUM7IiwKICAibmFtZXMiOiBbIndvcmtpbmdDb3B5IiwgInJlcyJdCn0K
