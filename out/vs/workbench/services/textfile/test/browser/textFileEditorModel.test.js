import assert from "assert";
import { TextFileEditorModel } from "../../common/textFileEditorModel.js";
import { EncodingMode, TextFileEditorModelState, snapshotToString, isTextFileEditorModel } from "../../common/textfiles.js";
import { createFileEditorInput, workbenchInstantiationService, TestServiceAccessor, TestReadonlyTextFileEditorModel, getLastResolvedFileStat } from "../../../../test/browser/workbenchTestServices.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { FileOperationResult, FileOperationError, NotModifiedSinceFileOperationError } from "../../../../../platform/files/common/files.js";
import { DeferredPromise, timeout } from "../../../../../base/common/async.js";
import { assertIsDefined } from "../../../../../base/common/types.js";
import { createTextBufferFactory } from "../../../../../editor/common/model/textModel.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { SaveReason, SaveSourceRegistry } from "../../../../common/editor.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { UTF16be } from "../../common/encoding.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { URI } from "../../../../../base/common/uri.js";
suite("Files - TextFileEditorModel", () => {
  function getLastModifiedTime(model) {
    const stat = getLastResolvedFileStat(model);
    return stat ? stat.mtime : -1;
  }
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  let content;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    content = accessor.fileService.getContent();
    disposables.add(accessor.textFileService.files);
    disposables.add(toDisposable(() => accessor.fileService.setContent(content)));
  });
  teardown(async () => {
    for (const textFileEditorModel of accessor.textFileService.files.models) {
      textFileEditorModel.dispose();
    }
    disposables.clear();
  });
  test("basic events", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    accessor.workingCopyService.testUnregisterWorkingCopy(model);
    let onDidResolveCounter = 0;
    disposables.add(model.onDidResolve(() => onDidResolveCounter++));
    await model.resolve();
    assert.strictEqual(onDidResolveCounter, 1);
    let onDidChangeContentCounter = 0;
    disposables.add(model.onDidChangeContent(() => onDidChangeContentCounter++));
    let onDidChangeDirtyCounter = 0;
    disposables.add(model.onDidChangeDirty(() => onDidChangeDirtyCounter++));
    model.updateTextEditorModel(createTextBufferFactory("bar"));
    assert.strictEqual(onDidChangeContentCounter, 1);
    assert.strictEqual(onDidChangeDirtyCounter, 1);
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.strictEqual(onDidChangeContentCounter, 2);
    assert.strictEqual(onDidChangeDirtyCounter, 1);
    await model.revert();
    assert.strictEqual(onDidChangeDirtyCounter, 2);
  });
  test("isTextFileEditorModel", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    assert.strictEqual(isTextFileEditorModel(model), true);
    model.dispose();
  });
  test("save", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
    let savedEvent = void 0;
    disposables.add(model.onDidSave((e) => savedEvent = e));
    await model.save();
    assert.ok(!savedEvent);
    model.updateTextEditorModel(createTextBufferFactory("bar"));
    assert.ok(getLastModifiedTime(model) <= Date.now());
    assert.ok(model.hasState(TextFileEditorModelState.DIRTY));
    assert.ok(model.isModified());
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    const source = SaveSourceRegistry.registerSource("testSource", "Hello Save");
    const pendingSave = model.save({ reason: SaveReason.AUTO, source });
    assert.ok(model.hasState(TextFileEditorModelState.PENDING_SAVE));
    await Promise.all([pendingSave, model.joinState(TextFileEditorModelState.PENDING_SAVE)]);
    assert.ok(model.hasState(TextFileEditorModelState.SAVED));
    assert.ok(!model.isDirty());
    assert.ok(!model.isModified());
    assert.ok(savedEvent);
    assert.ok(savedEvent.stat);
    assert.strictEqual(savedEvent.reason, SaveReason.AUTO);
    assert.strictEqual(savedEvent.source, source);
    assert.ok(workingCopyEvent);
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
    savedEvent = void 0;
    await model.save({ force: true });
    assert.ok(savedEvent);
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("save - touching also emits saved event", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    let savedEvent = false;
    disposables.add(model.onDidSave(() => savedEvent = true));
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    await model.save({ force: true });
    assert.ok(savedEvent);
    assert.ok(!workingCopyEvent);
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("save - touching with error turns model dirty", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    let saveErrorEvent = false;
    disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
    let savedEvent = false;
    disposables.add(model.onDidSave(() => savedEvent = true));
    accessor.fileService.writeShouldThrowError = new Error("failed to write");
    try {
      await model.save({ force: true });
      assert.ok(model.hasState(TextFileEditorModelState.ERROR));
      assert.ok(model.isDirty());
      assert.ok(model.isModified());
      assert.ok(saveErrorEvent);
      assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
      assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    await model.save({ force: true });
    assert.ok(savedEvent);
    assert.strictEqual(model.isDirty(), false);
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("save - returns false when save fails", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    accessor.fileService.writeShouldThrowError = new Error("failed to write");
    try {
      const res2 = await model.save({ force: true });
      assert.strictEqual(res2, false);
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    const res = await model.save({ force: true });
    assert.strictEqual(res, true);
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("save error (generic)", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("bar"));
    let saveErrorEvent = false;
    disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
    accessor.fileService.writeShouldThrowError = new Error("failed to write");
    try {
      const pendingSave = model.save();
      assert.ok(model.hasState(TextFileEditorModelState.PENDING_SAVE));
      await pendingSave;
      assert.ok(model.hasState(TextFileEditorModelState.ERROR));
      assert.ok(model.isDirty());
      assert.ok(model.isModified());
      assert.ok(saveErrorEvent);
      assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
      assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
      model.dispose();
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
  });
  test("save error (conflict)", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("bar"));
    let saveErrorEvent = false;
    disposables.add(model.onDidSaveError(() => saveErrorEvent = true));
    accessor.fileService.writeShouldThrowError = new FileOperationError("save conflict", FileOperationResult.FILE_MODIFIED_SINCE);
    try {
      const pendingSave = model.save();
      assert.ok(model.hasState(TextFileEditorModelState.PENDING_SAVE));
      await pendingSave;
      assert.ok(model.hasState(TextFileEditorModelState.CONFLICT));
      assert.ok(model.isDirty());
      assert.ok(model.isModified());
      assert.ok(saveErrorEvent);
      assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
      assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
      model.dispose();
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
  });
  test("setEncoding - encode", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    let encodingEvent = false;
    disposables.add(model.onDidChangeEncoding(() => encodingEvent = true));
    await model.setEncoding("utf8", EncodingMode.Encode);
    assert.strictEqual(getLastModifiedTime(model), -1);
    assert.ok(!encodingEvent);
    await model.setEncoding("utf16", EncodingMode.Encode);
    assert.ok(encodingEvent);
    assert.ok(getLastModifiedTime(model) <= Date.now());
  });
  test("setEncoding - decode", async function() {
    let model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    accessor.workingCopyService.testUnregisterWorkingCopy(model);
    await model.setEncoding("utf16", EncodingMode.Decode);
    model = accessor.workingCopyService.get(model);
    assert.ok(model.isResolved());
  });
  test("setEncoding - decode dirty file saves first", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    accessor.workingCopyService.testUnregisterWorkingCopy(model);
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("bar"));
    assert.strictEqual(model.isDirty(), true);
    await model.setEncoding("utf16", EncodingMode.Decode);
    assert.strictEqual(model.isDirty(), false);
  });
  test("encoding updates with language based configuration", async function() {
    const languageId = "text-file-model-test";
    disposables.add(accessor.languageService.registerLanguage({
      id: languageId
    }));
    accessor.testConfigurationService.setOverrideIdentifiers("files.encoding", [languageId]);
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    accessor.workingCopyService.testUnregisterWorkingCopy(model);
    await model.resolve();
    const deferredPromise = new DeferredPromise();
    disposables.add(accessor.workingCopyService.onDidRegister((e) => {
      if (isEqual(e.resource, model.resource)) {
        deferredPromise.complete(model);
      }
    }));
    accessor.testConfigurationService.setUserConfiguration("files.encoding", UTF16be);
    model.setLanguageId(languageId);
    await deferredPromise.p;
  });
  test("create with language", async function() {
    const languageId = "text-file-model-test";
    disposables.add(accessor.languageService.registerLanguage({
      id: languageId
    }));
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", languageId);
    await model.resolve();
    assert.strictEqual(model.textEditorModel.getLanguageId(), languageId);
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("disposes when underlying model is destroyed", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve();
    model.textEditorModel.dispose();
    assert.ok(model.isDisposed());
  });
  test("Resolve does not trigger save", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index.txt"), "utf8", void 0);
    assert.ok(model.hasState(TextFileEditorModelState.SAVED));
    disposables.add(model.onDidSave(() => assert.fail()));
    disposables.add(model.onDidChangeDirty(() => assert.fail()));
    await model.resolve();
    assert.ok(model.isResolved());
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("Resolve returns dirty model as long as model is dirty", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(model.isDirty());
    assert.ok(model.hasState(TextFileEditorModelState.DIRTY));
    await model.resolve();
    assert.ok(model.isDirty());
  });
  test("Resolve with contents", async function() {
    const model = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0);
    await model.resolve({ contents: createTextBufferFactory("Hello World") });
    assert.strictEqual(model.textEditorModel?.getValue(), "Hello World");
    assert.strictEqual(model.isDirty(), true);
    await model.resolve({ contents: createTextBufferFactory("Hello Changes") });
    assert.strictEqual(model.textEditorModel?.getValue(), "Hello Changes");
    assert.strictEqual(model.isDirty(), true);
    await model.textEditorModel.undo();
    assert.ok(model.isDirty());
    model.dispose();
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("Revert", async function() {
    let eventCounter = 0;
    let model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(model.onDidRevert(() => eventCounter++));
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(model.isDirty());
    assert.ok(model.isModified());
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
    accessor.workingCopyService.testUnregisterWorkingCopy(model);
    await model.revert();
    model = accessor.workingCopyService.get(model);
    assert.strictEqual(model.isDirty(), false);
    assert.strictEqual(model.isModified(), false);
    assert.strictEqual(eventCounter, 1);
    assert.ok(workingCopyEvent);
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
  });
  test("Revert (soft)", async function() {
    let eventCounter = 0;
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(model.onDidRevert(() => eventCounter++));
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(model.isDirty());
    assert.ok(model.isModified());
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
    await model.revert({ soft: true });
    assert.strictEqual(model.isDirty(), false);
    assert.strictEqual(model.isModified(), false);
    assert.strictEqual(model.textEditorModel.getValue(), "foo");
    assert.strictEqual(eventCounter, 1);
    assert.ok(workingCopyEvent);
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 0);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), false);
  });
  test("Undo to saved state turns model non-dirty", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("Hello Text"));
    assert.ok(model.isDirty());
    await model.textEditorModel.undo();
    assert.ok(!model.isDirty());
  });
  test("Resolve and undo turns model dirty", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    accessor.fileService.setContent("Hello Change");
    await model.resolve();
    await model.textEditorModel.undo();
    assert.ok(model.isDirty());
    assert.strictEqual(accessor.workingCopyService.dirtyCount, 1);
    assert.strictEqual(accessor.workingCopyService.isDirty(model.resource, model.typeId), true);
  });
  test("Update Dirty", async function() {
    let eventCounter = 0;
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    model.setDirty(true);
    assert.ok(!model.isDirty());
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(model.isDirty());
    await model.revert({ soft: true });
    assert.strictEqual(model.isDirty(), false);
    disposables.add(model.onDidChangeDirty(() => eventCounter++));
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    model.setDirty(true);
    assert.ok(model.isDirty());
    assert.strictEqual(eventCounter, 1);
    assert.ok(workingCopyEvent);
    model.setDirty(false);
    assert.strictEqual(model.isDirty(), false);
    assert.strictEqual(eventCounter, 2);
  });
  test("No Dirty or saving for readonly models", async function() {
    let workingCopyEvent = false;
    disposables.add(accessor.workingCopyService.onDidChangeDirty((e) => {
      if (e.resource.toString() === model.resource.toString()) {
        workingCopyEvent = true;
      }
    }));
    const model = disposables.add(instantiationService.createInstance(TestReadonlyTextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    let saveEvent = false;
    disposables.add(model.onDidSave(() => {
      saveEvent = true;
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(!model.isDirty());
    await model.save({ force: true });
    assert.strictEqual(saveEvent, false);
    await model.revert({ soft: true });
    assert.ok(!model.isDirty());
    assert.ok(!workingCopyEvent);
  });
  test("File not modified error is handled gracefully", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    const mtime = getLastModifiedTime(model);
    accessor.textFileService.setReadStreamErrorOnce(new FileOperationError("error", FileOperationResult.FILE_NOT_MODIFIED_SINCE));
    await model.resolve();
    assert.ok(model);
    assert.strictEqual(getLastModifiedTime(model), mtime);
  });
  test("stat.readonly and stat.locked can change when decreased mtime is ignored", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    const stat = assertIsDefined(getLastResolvedFileStat(model));
    accessor.textFileService.setReadStreamErrorOnce(new NotModifiedSinceFileOperationError("error", { ...stat, mtime: stat.mtime - 1, readonly: !stat.readonly, locked: !stat.locked }));
    await model.resolve();
    assert.ok(model);
    assert.strictEqual(getLastModifiedTime(model), stat.mtime, "mtime should not decrease");
    assert.notStrictEqual(getLastResolvedFileStat(model)?.readonly, stat.readonly, "readonly should have changed despite simultaneous attempt to decrease mtime");
    assert.notStrictEqual(getLastResolvedFileStat(model)?.locked, stat.locked, "locked should have changed despite simultaneous attempt to decrease mtime");
  });
  test("Resolve error is handled gracefully if model already exists", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await model.resolve();
    accessor.textFileService.setReadStreamErrorOnce(new FileOperationError("error", FileOperationResult.FILE_NOT_FOUND));
    await model.resolve();
    assert.ok(model);
  });
  test("save() and isDirty() - proper with check for mtimes", async function() {
    const input1 = disposables.add(createFileEditorInput(instantiationService, toResource.call(this, "/path/index_async2.txt")));
    const input2 = disposables.add(createFileEditorInput(instantiationService, toResource.call(this, "/path/index_async.txt")));
    const model1 = disposables.add(await input1.resolve());
    const model2 = disposables.add(await input2.resolve());
    model1.updateTextEditorModel(createTextBufferFactory("foo"));
    const m1Mtime = assertIsDefined(getLastResolvedFileStat(model1)).mtime;
    const m2Mtime = assertIsDefined(getLastResolvedFileStat(model2)).mtime;
    assert.ok(m1Mtime > 0);
    assert.ok(m2Mtime > 0);
    assert.ok(accessor.textFileService.isDirty(toResource.call(this, "/path/index_async2.txt")));
    assert.ok(!accessor.textFileService.isDirty(toResource.call(this, "/path/index_async.txt")));
    model2.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(accessor.textFileService.isDirty(toResource.call(this, "/path/index_async.txt")));
    await timeout(10);
    await accessor.textFileService.save(toResource.call(this, "/path/index_async.txt"));
    await accessor.textFileService.save(toResource.call(this, "/path/index_async2.txt"));
    assert.ok(!accessor.textFileService.isDirty(toResource.call(this, "/path/index_async.txt")));
    assert.ok(!accessor.textFileService.isDirty(toResource.call(this, "/path/index_async2.txt")));
    if (isWeb) {
      assert.ok(assertIsDefined(getLastResolvedFileStat(model1)).mtime >= m1Mtime);
      assert.ok(assertIsDefined(getLastResolvedFileStat(model2)).mtime >= m2Mtime);
    } else {
      assert.ok(assertIsDefined(getLastResolvedFileStat(model1)).mtime > m1Mtime);
      assert.ok(assertIsDefined(getLastResolvedFileStat(model2)).mtime > m2Mtime);
    }
  });
  test("Save Participant", async function() {
    let eventCounter = 0;
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(model.onDidSave(() => {
      assert.strictEqual(snapshotToString(model.createSnapshot()), eventCounter === 1 ? "bar" : "foobar");
      assert.ok(!model.isDirty());
      eventCounter++;
    }));
    const participant = accessor.textFileService.files.addSaveParticipant({
      participate: async (model2) => {
        assert.ok(model2.isDirty());
        model2.updateTextEditorModel(createTextBufferFactory("bar"));
        assert.ok(model2.isDirty());
        eventCounter++;
      }
    });
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    assert.ok(model.isDirty());
    await model.save();
    assert.strictEqual(eventCounter, 2);
    participant.dispose();
    model.updateTextEditorModel(createTextBufferFactory("foobar"));
    assert.ok(model.isDirty());
    await model.save();
    assert.strictEqual(eventCounter, 3);
  });
  test("Save Participant - skip", async function() {
    let eventCounter = 0;
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: async () => {
        eventCounter++;
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    await model.save({ skipSaveParticipants: true });
    assert.strictEqual(eventCounter, 0);
  });
  test("Save Participant, async participant", async function() {
    let eventCounter = 0;
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(model.onDidSave(() => {
      assert.ok(!model.isDirty());
      eventCounter++;
    }));
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: (model2) => {
        assert.ok(model2.isDirty());
        model2.updateTextEditorModel(createTextBufferFactory("bar"));
        assert.ok(model2.isDirty());
        eventCounter++;
        return timeout(10);
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    const now = Date.now();
    await model.save();
    assert.strictEqual(eventCounter, 2);
    assert.ok(Date.now() - now >= 10);
  });
  test("Save Participant, bad participant", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: async () => {
        new Error("boom");
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    await model.save();
  });
  test("Save Participant, participant cancelled when saved again", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    const participations = [];
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: async (model2, context, progress, token) => {
        await timeout(10);
        if (!token.isCancellationRequested) {
          participations.push(true);
        }
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    const p1 = model.save();
    model.updateTextEditorModel(createTextBufferFactory("foo 1"));
    const p2 = model.save();
    model.updateTextEditorModel(createTextBufferFactory("foo 2"));
    const p3 = model.save();
    model.updateTextEditorModel(createTextBufferFactory("foo 3"));
    const p4 = model.save();
    await Promise.all([p1, p2, p3, p4]);
    assert.strictEqual(participations.length, 1);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (sync save, no model change)", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await testSaveFromSaveParticipant(model, false, false, false);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (async save, no model change)", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await testSaveFromSaveParticipant(model, true, false, false);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (sync save, model change)", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await testSaveFromSaveParticipant(model, false, true, false);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (async save, model change)", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await testSaveFromSaveParticipant(model, true, true, false);
  });
  test("Save Participant, calling save from within is unsupported but does not explode (force)", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    await testSaveFromSaveParticipant(model, false, false, true);
  });
  async function testSaveFromSaveParticipant(model, async, modelChange, force) {
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: async () => {
        if (async) {
          await timeout(10);
        }
        if (modelChange) {
          model.updateTextEditorModel(createTextBufferFactory("bar"));
          const newSavePromise = model.save(force ? { force } : void 0);
          assert.notStrictEqual(savePromise, newSavePromise);
          await newSavePromise;
        } else {
          const newSavePromise = model.save(force ? { force } : void 0);
          assert.strictEqual(savePromise, newSavePromise);
          await savePromise;
        }
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    const savePromise = model.save(force ? { force } : void 0);
    await savePromise;
  }
  test("Save Participant carries context", async function() {
    const model = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/index_async.txt"), "utf8", void 0));
    const from = URI.file("testFrom");
    let e = void 0;
    disposables.add(accessor.textFileService.files.addSaveParticipant({
      participate: async (wc, context) => {
        try {
          assert.strictEqual(context.reason, SaveReason.EXPLICIT);
          assert.strictEqual(context.savedFrom?.toString(), from.toString());
        } catch (error) {
          e = error;
        }
      }
    }));
    await model.resolve();
    model.updateTextEditorModel(createTextBufferFactory("foo"));
    await model.save({ force: true, from });
    if (e) {
      throw e;
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvdGVzdC9icm93c2VyL3RleHRGaWxlRWRpdG9yTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgVGV4dEZpbGVFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IEVuY29kaW5nTW9kZSwgVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLCBzbmFwc2hvdFRvU3RyaW5nLCBpc1RleHRGaWxlRWRpdG9yTW9kZWwsIElUZXh0RmlsZUVkaXRvck1vZGVsU2F2ZUV2ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGaWxlRWRpdG9ySW5wdXQsIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0U2VydmljZUFjY2Vzc29yLCBUZXN0UmVhZG9ubHlUZXh0RmlsZUVkaXRvck1vZGVsLCBnZXRMYXN0UmVzb2x2ZWRGaWxlU3RhdCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlLCB0b1Jlc291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlT3BlcmF0aW9uRXJyb3IsIE5vdE1vZGlmaWVkU2luY2VGaWxlT3BlcmF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlLCB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0SXNEZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTYXZlUmVhc29uLCBTYXZlU291cmNlUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IGlzRXF1YWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVRGMTZiZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9lbmNvZGluZy5qcyc7XG5pbXBvcnQgeyBpc1dlYiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5cbnN1aXRlKCdGaWxlcyAtIFRleHRGaWxlRWRpdG9yTW9kZWwnLCAoKSA9PiB7XG5cblx0ZnVuY3Rpb24gZ2V0TGFzdE1vZGlmaWVkVGltZShtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCk6IG51bWJlciB7XG5cdFx0Y29uc3Qgc3RhdCA9IGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KG1vZGVsKTtcblxuXHRcdHJldHVybiBzdGF0ID8gc3RhdC5tdGltZSA6IC0xO1xuXHR9XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgYWNjZXNzb3I6IFRlc3RTZXJ2aWNlQWNjZXNzb3I7XG5cdGxldCBjb250ZW50OiBzdHJpbmc7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0YWNjZXNzb3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U2VydmljZUFjY2Vzc29yKTtcblx0XHRjb250ZW50ID0gYWNjZXNzb3IuZmlsZVNlcnZpY2UuZ2V0Q29udGVudCgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCg8VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnNldENvbnRlbnQoY29udGVudCkpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGZvciAoY29uc3QgdGV4dEZpbGVFZGl0b3JNb2RlbCBvZiBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMubW9kZWxzKSB7XG5cdFx0XHR0ZXh0RmlsZUVkaXRvck1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdiYXNpYyBldmVudHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UudGVzdFVucmVnaXN0ZXJXb3JraW5nQ29weShtb2RlbCk7IC8vIGNhdXNlcyBpc3N1ZXMgd2l0aCBzdWJzZXF1ZW50IHJlc29sdmVzIG90aGVyd2lzZVxuXG5cdFx0bGV0IG9uRGlkUmVzb2x2ZUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFJlc29sdmUoKCkgPT4gb25EaWRSZXNvbHZlQ291bnRlcisrKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob25EaWRSZXNvbHZlQ291bnRlciwgMSk7XG5cblx0XHRsZXQgb25EaWRDaGFuZ2VDb250ZW50Q291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiBvbkRpZENoYW5nZUNvbnRlbnRDb3VudGVyKyspKTtcblxuXHRcdGxldCBvbkRpZENoYW5nZURpcnR5Q291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlRGlydHkoKCkgPT4gb25EaWRDaGFuZ2VEaXJ0eUNvdW50ZXIrKykpO1xuXG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdiYXInKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob25EaWRDaGFuZ2VDb250ZW50Q291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uRGlkQ2hhbmdlRGlydHlDb3VudGVyLCAxKTtcblxuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnZm9vJykpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9uRGlkQ2hhbmdlQ29udGVudENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkRpZENoYW5nZURpcnR5Q291bnRlciwgMSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXZlcnQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvbkRpZENoYW5nZURpcnR5Q291bnRlciwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzVGV4dEZpbGVFZGl0b3JNb2RlbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1RleHRGaWxlRWRpdG9yTW9kZWwobW9kZWwpLCB0cnVlKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuZGlydHlDb3VudCwgMCk7XG5cblx0XHRsZXQgc2F2ZWRFdmVudDogSVRleHRGaWxlRWRpdG9yTW9kZWxTYXZlRXZlbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkU2F2ZShlID0+IHNhdmVkRXZlbnQgPSBlKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5zYXZlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFzYXZlZEV2ZW50KTtcblxuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnYmFyJykpO1xuXHRcdGFzc2VydC5vayhnZXRMYXN0TW9kaWZpZWRUaW1lKG1vZGVsKSA8PSBEYXRlLm5vdygpKTtcblx0XHRhc3NlcnQub2sobW9kZWwuaGFzU3RhdGUoVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLkRJUlRZKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzTW9kaWZpZWQoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSwgbW9kZWwudHlwZUlkKSwgdHJ1ZSk7XG5cblx0XHRsZXQgd29ya2luZ0NvcHlFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uub25EaWRDaGFuZ2VEaXJ0eShlID0+IHtcblx0XHRcdGlmIChlLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IG1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0d29ya2luZ0NvcHlFdmVudCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc291cmNlID0gU2F2ZVNvdXJjZVJlZ2lzdHJ5LnJlZ2lzdGVyU291cmNlKCd0ZXN0U291cmNlJywgJ0hlbGxvIFNhdmUnKTtcblx0XHRjb25zdCBwZW5kaW5nU2F2ZSA9IG1vZGVsLnNhdmUoeyByZWFzb246IFNhdmVSZWFzb24uQVVUTywgc291cmNlIH0pO1xuXHRcdGFzc2VydC5vayhtb2RlbC5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuUEVORElOR19TQVZFKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbcGVuZGluZ1NhdmUsIG1vZGVsLmpvaW5TdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuUEVORElOR19TQVZFKV0pO1xuXG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5TQVZFRCkpO1xuXHRcdGFzc2VydC5vayghbW9kZWwuaXNEaXJ0eSgpKTtcblx0XHRhc3NlcnQub2soIW1vZGVsLmlzTW9kaWZpZWQoKSk7XG5cdFx0YXNzZXJ0Lm9rKHNhdmVkRXZlbnQpO1xuXHRcdGFzc2VydC5vaygoc2F2ZWRFdmVudCBhcyBJVGV4dEZpbGVFZGl0b3JNb2RlbFNhdmVFdmVudCkuc3RhdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChzYXZlZEV2ZW50IGFzIElUZXh0RmlsZUVkaXRvck1vZGVsU2F2ZUV2ZW50KS5yZWFzb24sIFNhdmVSZWFzb24uQVVUTyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChzYXZlZEV2ZW50IGFzIElUZXh0RmlsZUVkaXRvck1vZGVsU2F2ZUV2ZW50KS5zb3VyY2UsIHNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtpbmdDb3B5RXZlbnQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UsIG1vZGVsLnR5cGVJZCksIGZhbHNlKTtcblxuXHRcdHNhdmVkRXZlbnQgPSB1bmRlZmluZWQ7XG5cblx0XHRhd2FpdCBtb2RlbC5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0Lm9rKHNhdmVkRXZlbnQpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5vayghYWNjZXNzb3IubW9kZWxTZXJ2aWNlLmdldE1vZGVsKG1vZGVsLnJlc291cmNlKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUgLSB0b3VjaGluZyBhbHNvIGVtaXRzIHNhdmVkIGV2ZW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXG5cdFx0bGV0IHNhdmVkRXZlbnQgPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRTYXZlKCgpID0+IHNhdmVkRXZlbnQgPSB0cnVlKSk7XG5cblx0XHRsZXQgd29ya2luZ0NvcHlFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uub25EaWRDaGFuZ2VEaXJ0eShlID0+IHtcblx0XHRcdGlmIChlLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IG1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0d29ya2luZ0NvcHlFdmVudCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSh7IGZvcmNlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHNhdmVkRXZlbnQpO1xuXHRcdGFzc2VydC5vayghd29ya2luZ0NvcHlFdmVudCk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY2Nlc3Nvci5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwobW9kZWwucmVzb3VyY2UpKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSAtIHRvdWNoaW5nIHdpdGggZXJyb3IgdHVybnMgbW9kZWwgZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRsZXQgc2F2ZUVycm9yRXZlbnQgPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRTYXZlRXJyb3IoKCkgPT4gc2F2ZUVycm9yRXZlbnQgPSB0cnVlKSk7XG5cblx0XHRsZXQgc2F2ZWRFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFNhdmUoKCkgPT4gc2F2ZWRFdmVudCA9IHRydWUpKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBFcnJvcignZmFpbGVkIHRvIHdyaXRlJyk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IG1vZGVsLnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5FUlJPUikpO1xuXHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0XHRhc3NlcnQub2sobW9kZWwuaXNNb2RpZmllZCgpKTtcblx0XHRcdGFzc2VydC5vayhzYXZlRXJyb3JFdmVudCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuZGlydHlDb3VudCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UsIG1vZGVsLnR5cGVJZCksIHRydWUpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSh7IGZvcmNlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHNhdmVkRXZlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLm1vZGVsU2VydmljZS5nZXRNb2RlbChtb2RlbC5yZXNvdXJjZSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIC0gcmV0dXJucyBmYWxzZSB3aGVuIHNhdmUgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSBuZXcgRXJyb3IoJ2ZhaWxlZCB0byB3cml0ZScpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCByZXMgPSBhd2FpdCBtb2RlbC5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLCBmYWxzZSk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCBtb2RlbC5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcywgdHJ1ZSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY2Nlc3Nvci5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwobW9kZWwucmVzb3VyY2UpKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSBlcnJvciAoZ2VuZXJpYyknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2JhcicpKTtcblxuXHRcdGxldCBzYXZlRXJyb3JFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFNhdmVFcnJvcigoKSA9PiBzYXZlRXJyb3JFdmVudCA9IHRydWUpKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBFcnJvcignZmFpbGVkIHRvIHdyaXRlJyk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHBlbmRpbmdTYXZlID0gbW9kZWwuc2F2ZSgpO1xuXHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmhhc1N0YXRlKFRleHRGaWxlRWRpdG9yTW9kZWxTdGF0ZS5QRU5ESU5HX1NBVkUpKTtcblxuXHRcdFx0YXdhaXQgcGVuZGluZ1NhdmU7XG5cblx0XHRcdGFzc2VydC5vayhtb2RlbC5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuRVJST1IpKTtcblx0XHRcdGFzc2VydC5vayhtb2RlbC5pc0RpcnR5KCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzTW9kaWZpZWQoKSk7XG5cdFx0XHRhc3NlcnQub2soc2F2ZUVycm9yRXZlbnQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5pc0RpcnR5KG1vZGVsLnJlc291cmNlLCBtb2RlbC50eXBlSWQpLCB0cnVlKTtcblxuXHRcdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS53cml0ZVNob3VsZFRocm93RXJyb3IgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIGVycm9yIChjb25mbGljdCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2JhcicpKTtcblxuXHRcdGxldCBzYXZlRXJyb3JFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFNhdmVFcnJvcigoKSA9PiBzYXZlRXJyb3JFdmVudCA9IHRydWUpKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IoJ3NhdmUgY29uZmxpY3QnLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9ESUZJRURfU0lOQ0UpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBwZW5kaW5nU2F2ZSA9IG1vZGVsLnNhdmUoKTtcblx0XHRcdGFzc2VydC5vayhtb2RlbC5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuUEVORElOR19TQVZFKSk7XG5cblx0XHRcdGF3YWl0IHBlbmRpbmdTYXZlO1xuXG5cdFx0XHRhc3NlcnQub2sobW9kZWwuaGFzU3RhdGUoVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLkNPTkZMSUNUKSk7XG5cdFx0XHRhc3NlcnQub2sobW9kZWwuaXNEaXJ0eSgpKTtcblx0XHRcdGFzc2VydC5vayhtb2RlbC5pc01vZGlmaWVkKCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNhdmVFcnJvckV2ZW50KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSwgbW9kZWwudHlwZUlkKSwgdHJ1ZSk7XG5cblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc2V0RW5jb2RpbmcgLSBlbmNvZGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdGxldCBlbmNvZGluZ0V2ZW50ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkQ2hhbmdlRW5jb2RpbmcoKCkgPT4gZW5jb2RpbmdFdmVudCA9IHRydWUpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnNldEVuY29kaW5nKCd1dGY4JywgRW5jb2RpbmdNb2RlLkVuY29kZSk7IC8vIG5vLW9wXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldExhc3RNb2RpZmllZFRpbWUobW9kZWwpLCAtMSk7XG5cblx0XHRhc3NlcnQub2soIWVuY29kaW5nRXZlbnQpO1xuXG5cdFx0YXdhaXQgbW9kZWwuc2V0RW5jb2RpbmcoJ3V0ZjE2JywgRW5jb2RpbmdNb2RlLkVuY29kZSk7XG5cblx0XHRhc3NlcnQub2soZW5jb2RpbmdFdmVudCk7XG5cblx0XHRhc3NlcnQub2soZ2V0TGFzdE1vZGlmaWVkVGltZShtb2RlbCkgPD0gRGF0ZS5ub3coKSk7IC8vIGluZGljYXRlcyBtb2RlbCB3YXMgc2F2ZWQgZHVlIHRvIGVuY29kaW5nIGNoYW5nZVxuXHR9KTtcblxuXHR0ZXN0KCdzZXRFbmNvZGluZyAtIGRlY29kZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UudGVzdFVucmVnaXN0ZXJXb3JraW5nQ29weShtb2RlbCk7IC8vIGNhdXNlcyBpc3N1ZXMgd2l0aCBzdWJzZXF1ZW50IHJlc29sdmVzIG90aGVyd2lzZVxuXG5cdFx0YXdhaXQgbW9kZWwuc2V0RW5jb2RpbmcoJ3V0ZjE2JywgRW5jb2RpbmdNb2RlLkRlY29kZSk7XG5cblx0XHQvLyB3ZSBoYXZlIHRvIGdldCB0aGUgbW9kZWwgYWdhaW4gZnJvbSB3b3JraW5nIGNvcHkgc2VydmljZVxuXHRcdC8vIGJlY2F1c2UgYHNldEVuY29kaW5nYCB3aWxsIHJlc29sdmUgaXQgYWdhaW4gdGhyb3VnaCB0aGVcblx0XHQvLyB0ZXh0IGZpbGUgc2VydmljZSB3aGljaCBpcyBvdXRzaWRlIG91ciBzY29wZVxuXHRcdG1vZGVsID0gYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmdldChtb2RlbCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbDtcblxuXHRcdGFzc2VydC5vayhtb2RlbC5pc1Jlc29sdmVkKCkpOyAvLyBtb2RlbCBnb3QgcmVzb2x2ZWQgZHVlIHRvIGRlY29kaW5nXG5cdH0pO1xuXG5cdHRlc3QoJ3NldEVuY29kaW5nIC0gZGVjb2RlIGRpcnR5IGZpbGUgc2F2ZXMgZmlyc3QnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UudGVzdFVucmVnaXN0ZXJXb3JraW5nQ29weShtb2RlbCk7IC8vIGNhdXNlcyBpc3N1ZXMgd2l0aCBzdWJzZXF1ZW50IHJlc29sdmVzIG90aGVyd2lzZVxuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdiYXInKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHRhd2FpdCBtb2RlbC5zZXRFbmNvZGluZygndXRmMTYnLCBFbmNvZGluZ01vZGUuRGVjb2RlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZW5jb2RpbmcgdXBkYXRlcyB3aXRoIGxhbmd1YWdlIGJhc2VkIGNvbmZpZ3VyYXRpb24nLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICd0ZXh0LWZpbGUtbW9kZWwtdGVzdCc7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHtcblx0XHRcdGlkOiBsYW5ndWFnZUlkLFxuXHRcdH0pKTtcblxuXHRcdGFjY2Vzc29yLnRlc3RDb25maWd1cmF0aW9uU2VydmljZS5zZXRPdmVycmlkZUlkZW50aWZpZXJzKCdmaWxlcy5lbmNvZGluZycsIFtsYW5ndWFnZUlkXSk7XG5cblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXHRcdGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS50ZXN0VW5yZWdpc3RlcldvcmtpbmdDb3B5KG1vZGVsKTsgLy8gY2F1c2VzIGlzc3VlcyB3aXRoIHN1YnNlcXVlbnQgcmVzb2x2ZXMgb3RoZXJ3aXNlXG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRjb25zdCBkZWZlcnJlZFByb21pc2UgPSBuZXcgRGVmZXJyZWRQcm9taXNlPFRleHRGaWxlRWRpdG9yTW9kZWw+KCk7XG5cblx0XHQvLyBXZSB1c2UgdGhpcyBsaXN0ZW5lciBhcyBhIHdheSB0byBmaWd1cmUgb3V0IHRoYXQgdGhlIHdvcmtpbmdcblx0XHQvLyBjb3B5IHdhcyByZXNvbHZlZCBhZ2FpbiBhcyBwYXJ0IG9mIHRoZSBsYW5ndWFnZSBjaGFuZ2Vcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLm9uRGlkUmVnaXN0ZXIoZSA9PiB7XG5cdFx0XHRpZiAoaXNFcXVhbChlLnJlc291cmNlLCBtb2RlbC5yZXNvdXJjZSkpIHtcblx0XHRcdFx0ZGVmZXJyZWRQcm9taXNlLmNvbXBsZXRlKG1vZGVsIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGFjY2Vzc29yLnRlc3RDb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbignZmlsZXMuZW5jb2RpbmcnLCBVVEYxNmJlKTtcblxuXHRcdG1vZGVsLnNldExhbmd1YWdlSWQobGFuZ3VhZ2VJZCk7XG5cblx0XHRhd2FpdCBkZWZlcnJlZFByb21pc2UucDsgLy8gdGhpcyBhc3NlcnRzIHRoYXQgdGhlIG1vZGVsIHdhcyByZWxvYWRlZCBkdWUgdG8gdGhlIGxhbmd1YWdlIGNoYW5nZVxuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgd2l0aCBsYW5ndWFnZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ3RleHQtZmlsZS1tb2RlbC10ZXN0Jztcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IubGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2Uoe1xuXHRcdFx0aWQ6IGxhbmd1YWdlSWQsXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIGxhbmd1YWdlSWQpO1xuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnRleHRFZGl0b3JNb2RlbCEuZ2V0TGFuZ3VhZ2VJZCgpLCBsYW5ndWFnZUlkKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLm1vZGVsU2VydmljZS5nZXRNb2RlbChtb2RlbC5yZXNvdXJjZSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXNwb3NlcyB3aGVuIHVuZGVybHlpbmcgbW9kZWwgaXMgZGVzdHJveWVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXG5cdFx0bW9kZWwudGV4dEVkaXRvck1vZGVsIS5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlzcG9zZWQoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Jlc29sdmUgZG9lcyBub3QgdHJpZ2dlciBzYXZlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleC50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5oYXNTdGF0ZShUZXh0RmlsZUVkaXRvck1vZGVsU3RhdGUuU0FWRUQpKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZFNhdmUoKCkgPT4gYXNzZXJ0LmZhaWwoKSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZENoYW5nZURpcnR5KCgpID0+IGFzc2VydC5mYWlsKCkpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRhc3NlcnQub2sobW9kZWwuaXNSZXNvbHZlZCgpKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY2Nlc3Nvci5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwobW9kZWwucmVzb3VyY2UpKTtcblx0fSk7XG5cblx0dGVzdCgnUmVzb2x2ZSByZXR1cm5zIGRpcnR5IG1vZGVsIGFzIGxvbmcgYXMgbW9kZWwgaXMgZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbycpKTtcblx0XHRhc3NlcnQub2sobW9kZWwuaXNEaXJ0eSgpKTtcblx0XHRhc3NlcnQub2sobW9kZWwuaGFzU3RhdGUoVGV4dEZpbGVFZGl0b3JNb2RlbFN0YXRlLkRJUlRZKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Jlc29sdmUgd2l0aCBjb250ZW50cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoeyBjb250ZW50czogY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ0hlbGxvIFdvcmxkJykgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsPy5nZXRWYWx1ZSgpLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoeyBjb250ZW50czogY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ0hlbGxvIENoYW5nZXMnKSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC50ZXh0RWRpdG9yTW9kZWw/LmdldFZhbHVlKCksICdIZWxsbyBDaGFuZ2VzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHQvLyB2ZXJpZnkgdGhhdCB3ZSBkbyBub3QgbWFyayB0aGUgbW9kZWwgYXMgc2F2ZWQgd2hlbiB1bmRvaW5nIG9uY2UgYmVjYXVzZVxuXHRcdC8vIHdlIG5ldmVyIHJlYWxseSBoYWQgYSBzYXZlZCBzdGF0ZVxuXHRcdGF3YWl0IG1vZGVsLnRleHRFZGl0b3JNb2RlbC51bmRvKCk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY2Nlc3Nvci5tb2RlbFNlcnZpY2UuZ2V0TW9kZWwobW9kZWwucmVzb3VyY2UpKTtcblx0fSk7XG5cblx0dGVzdCgnUmV2ZXJ0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXG5cdFx0bGV0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRSZXZlcnQoKCkgPT4gZXZlbnRDb3VudGVyKyspKTtcblxuXHRcdGxldCB3b3JraW5nQ29weUV2ZW50ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5vbkRpZENoYW5nZURpcnR5KGUgPT4ge1xuXHRcdFx0aWYgKGUucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gbW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHR3b3JraW5nQ29weUV2ZW50ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzTW9kaWZpZWQoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSwgbW9kZWwudHlwZUlkKSwgdHJ1ZSk7XG5cblx0XHRhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UudGVzdFVucmVnaXN0ZXJXb3JraW5nQ29weShtb2RlbCk7IC8vIGNhdXNlcyBpc3N1ZXMgd2l0aCBzdWJzZXF1ZW50IHJlc29sdmVzIG90aGVyd2lzZVxuXG5cdFx0YXdhaXQgbW9kZWwucmV2ZXJ0KCk7XG5cblx0XHQvLyB3ZSBoYXZlIHRvIGdldCB0aGUgbW9kZWwgYWdhaW4gZnJvbSB3b3JraW5nIGNvcHkgc2VydmljZVxuXHRcdC8vIGJlY2F1c2UgYHNldEVuY29kaW5nYCB3aWxsIHJlc29sdmUgaXQgYWdhaW4gdGhyb3VnaCB0aGVcblx0XHQvLyB0ZXh0IGZpbGUgc2VydmljZSB3aGljaCBpcyBvdXRzaWRlIG91ciBzY29wZVxuXHRcdG1vZGVsID0gYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmdldChtb2RlbCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXNNb2RpZmllZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMSk7XG5cblx0XHRhc3NlcnQub2sod29ya2luZ0NvcHlFdmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UsIG1vZGVsLnR5cGVJZCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnUmV2ZXJ0IChzb2Z0KScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZXZlbnRDb3VudGVyID0gMDtcblxuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRSZXZlcnQoKCkgPT4gZXZlbnRDb3VudGVyKyspKTtcblxuXHRcdGxldCB3b3JraW5nQ29weUV2ZW50ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5vbkRpZENoYW5nZURpcnR5KGUgPT4ge1xuXHRcdFx0aWYgKGUucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gbW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHR3b3JraW5nQ29weUV2ZW50ID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzTW9kaWZpZWQoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSwgbW9kZWwudHlwZUlkKSwgdHJ1ZSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXZlcnQoeyBzb2Z0OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXNNb2RpZmllZCgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnRleHRFZGl0b3JNb2RlbC5nZXRWYWx1ZSgpLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMSk7XG5cblx0XHRhc3NlcnQub2sod29ya2luZ0NvcHlFdmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UsIG1vZGVsLnR5cGVJZCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnVW5kbyB0byBzYXZlZCBzdGF0ZSB0dXJucyBtb2RlbCBub24tZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdIZWxsbyBUZXh0JykpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5pc0RpcnR5KCkpO1xuXG5cdFx0YXdhaXQgbW9kZWwudGV4dEVkaXRvck1vZGVsLnVuZG8oKTtcblx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Jlc29sdmUgYW5kIHVuZG8gdHVybnMgbW9kZWwgZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uuc2V0Q29udGVudCgnSGVsbG8gQ2hhbmdlJyk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0YXdhaXQgbW9kZWwudGV4dEVkaXRvck1vZGVsIS51bmRvKCk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSwgbW9kZWwudHlwZUlkKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VwZGF0ZSBEaXJ0eScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZXZlbnRDb3VudGVyID0gMDtcblxuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRtb2RlbC5zZXREaXJ0eSh0cnVlKTtcblx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7IC8vIG5lZWRzIHRvIGJlIHJlc29sdmVkXG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXZlcnQoeyBzb2Z0OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbC5vbkRpZENoYW5nZURpcnR5KCgpID0+IGV2ZW50Q291bnRlcisrKSk7XG5cblx0XHRsZXQgd29ya2luZ0NvcHlFdmVudCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uub25EaWRDaGFuZ2VEaXJ0eShlID0+IHtcblx0XHRcdGlmIChlLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IG1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0d29ya2luZ0NvcHlFdmVudCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bW9kZWwuc2V0RGlydHkodHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtpbmdDb3B5RXZlbnQpO1xuXG5cdFx0bW9kZWwuc2V0RGlydHkoZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudGVyLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnTm8gRGlydHkgb3Igc2F2aW5nIGZvciByZWFkb25seSBtb2RlbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IHdvcmtpbmdDb3B5RXZlbnQgPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLm9uRGlkQ2hhbmdlRGlydHkoZSA9PiB7XG5cdFx0XHRpZiAoZS5yZXNvdXJjZS50b1N0cmluZygpID09PSBtb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHdvcmtpbmdDb3B5RXZlbnQgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RSZWFkb25seVRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRsZXQgc2F2ZUV2ZW50ID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkU2F2ZSgoKSA9PiB7XG5cdFx0XHRzYXZlRXZlbnQgPSB0cnVlO1xuXHRcdH0pKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbycpKTtcblx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5zYXZlKHsgZm9yY2U6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFdmVudCwgZmFsc2UpO1xuXG5cdFx0YXdhaXQgbW9kZWwucmV2ZXJ0KHsgc29mdDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7XG5cblx0XHRhc3NlcnQub2soIXdvcmtpbmdDb3B5RXZlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIG5vdCBtb2RpZmllZCBlcnJvciBpcyBoYW5kbGVkIGdyYWNlZnVsbHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblxuXHRcdGNvbnN0IG10aW1lID0gZ2V0TGFzdE1vZGlmaWVkVGltZShtb2RlbCk7XG5cdFx0YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLnNldFJlYWRTdHJlYW1FcnJvck9uY2UobmV3IEZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX01PRElGSUVEX1NJTkNFKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQub2sobW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRMYXN0TW9kaWZpZWRUaW1lKG1vZGVsKSwgbXRpbWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGF0LnJlYWRvbmx5IGFuZCBzdGF0LmxvY2tlZCBjYW4gY2hhbmdlIHdoZW4gZGVjcmVhc2VkIG10aW1lIGlzIGlnbm9yZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblxuXHRcdGNvbnN0IHN0YXQgPSBhc3NlcnRJc0RlZmluZWQoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQobW9kZWwpKTtcblx0XHRhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2Uuc2V0UmVhZFN0cmVhbUVycm9yT25jZShuZXcgTm90TW9kaWZpZWRTaW5jZUZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCB7IC4uLnN0YXQsIG10aW1lOiBzdGF0Lm10aW1lIC0gMSwgcmVhZG9ubHk6ICFzdGF0LnJlYWRvbmx5LCBsb2NrZWQ6ICFzdGF0LmxvY2tlZCB9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQub2sobW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRMYXN0TW9kaWZpZWRUaW1lKG1vZGVsKSwgc3RhdC5tdGltZSwgJ210aW1lIHNob3VsZCBub3QgZGVjcmVhc2UnKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQobW9kZWwpPy5yZWFkb25seSwgc3RhdC5yZWFkb25seSwgJ3JlYWRvbmx5IHNob3VsZCBoYXZlIGNoYW5nZWQgZGVzcGl0ZSBzaW11bHRhbmVvdXMgYXR0ZW1wdCB0byBkZWNyZWFzZSBtdGltZScpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChnZXRMYXN0UmVzb2x2ZWRGaWxlU3RhdChtb2RlbCk/LmxvY2tlZCwgc3RhdC5sb2NrZWQsICdsb2NrZWQgc2hvdWxkIGhhdmUgY2hhbmdlZCBkZXNwaXRlIHNpbXVsdGFuZW91cyBhdHRlbXB0IHRvIGRlY3JlYXNlIG10aW1lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Jlc29sdmUgZXJyb3IgaXMgaGFuZGxlZCBncmFjZWZ1bGx5IGlmIG1vZGVsIGFscmVhZHkgZXhpc3RzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLnNldFJlYWRTdHJlYW1FcnJvck9uY2UobmV3IEZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVsKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSgpIGFuZCBpc0RpcnR5KCkgLSBwcm9wZXIgd2l0aCBjaGVjayBmb3IgbXRpbWVzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0MSA9IGRpc3Bvc2FibGVzLmFkZChjcmVhdGVGaWxlRWRpdG9ySW5wdXQoaW5zdGFudGlhdGlvblNlcnZpY2UsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMyLnR4dCcpKSk7XG5cdFx0Y29uc3QgaW5wdXQyID0gZGlzcG9zYWJsZXMuYWRkKGNyZWF0ZUZpbGVFZGl0b3JJbnB1dChpbnN0YW50aWF0aW9uU2VydmljZSwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwxID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0MS5yZXNvbHZlKCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbCk7XG5cdFx0Y29uc3QgbW9kZWwyID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0Mi5yZXNvbHZlKCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbCk7XG5cblx0XHRtb2RlbDEudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cblx0XHRjb25zdCBtMU10aW1lID0gYXNzZXJ0SXNEZWZpbmVkKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KG1vZGVsMSkpLm10aW1lO1xuXHRcdGNvbnN0IG0yTXRpbWUgPSBhc3NlcnRJc0RlZmluZWQoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQobW9kZWwyKSkubXRpbWU7XG5cdFx0YXNzZXJ0Lm9rKG0xTXRpbWUgPiAwKTtcblx0XHRhc3NlcnQub2sobTJNdGltZSA+IDApO1xuXG5cdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5pc0RpcnR5KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMyLnR4dCcpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eSh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpKSk7XG5cblx0XHRtb2RlbDIudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5pc0RpcnR5KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JykpKTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMTApO1xuXHRcdGF3YWl0IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5zYXZlKHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JykpO1xuXHRcdGF3YWl0IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5zYXZlKHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMyLnR4dCcpKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5pc0RpcnR5KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JykpKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5pc0RpcnR5KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMyLnR4dCcpKSk7XG5cblx0XHRpZiAoaXNXZWIpIHtcblx0XHRcdC8vIHdlYiB0ZXN0cyBkb2VzIG5vdCBlbnN1cmUgdGltZW91dHMgYXJlIHJlc3BlY3RlZCBhdCBhbGwsIHNvIHdlIGNhbm5vdFxuXHRcdFx0Ly8gcmVhbGx5IGFzc2VydCB0aGUgbXRpbWUgdG8gYmUgZGlmZmVyZW50LCBvbmx5IHRoYXQgaXQgaXMgZXF1YWwgb3IgZ3JlYXRlci5cblx0XHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNjE4ODZcblx0XHRcdGFzc2VydC5vayhhc3NlcnRJc0RlZmluZWQoZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQobW9kZWwxKSkubXRpbWUgPj0gbTFNdGltZSk7XG5cdFx0XHRhc3NlcnQub2soYXNzZXJ0SXNEZWZpbmVkKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KG1vZGVsMikpLm10aW1lID49IG0yTXRpbWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBvbiBkZXNrdG9wIHdlIHdhbnQgdG8gYXNzZXJ0IHRoaXMgY29uZGl0aW9uIG1vcmUgc3RyaWN0bHkgdGhvdWdoXG5cdFx0XHRhc3NlcnQub2soYXNzZXJ0SXNEZWZpbmVkKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KG1vZGVsMSkpLm10aW1lID4gbTFNdGltZSk7XG5cdFx0XHRhc3NlcnQub2soYXNzZXJ0SXNEZWZpbmVkKGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KG1vZGVsMikpLm10aW1lID4gbTJNdGltZSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwub25EaWRTYXZlKCgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzbmFwc2hvdFRvU3RyaW5nKG1vZGVsLmNyZWF0ZVNuYXBzaG90KCkhKSwgZXZlbnRDb3VudGVyID09PSAxID8gJ2JhcicgOiAnZm9vYmFyJyk7XG5cdFx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5hZGRTYXZlUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jIG1vZGVsID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0XHRcdChtb2RlbCBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKS51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2JhcicpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKG1vZGVsLmlzRGlydHkoKSk7XG5cdFx0XHRcdGV2ZW50Q291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnZm9vJykpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5pc0RpcnR5KCkpO1xuXG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDIpO1xuXG5cdFx0cGFydGljaXBhbnQuZGlzcG9zZSgpO1xuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnZm9vYmFyJykpO1xuXHRcdGFzc2VydC5vayhtb2RlbC5pc0RpcnR5KCkpO1xuXG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50IC0gc2tpcCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZXZlbnRDb3VudGVyID0gMDtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5hZGRTYXZlUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgbW9kZWwucmVzb2x2ZSgpO1xuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnZm9vJykpO1xuXG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSh7IHNraXBTYXZlUGFydGljaXBhbnRzOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50LCBhc3luYyBwYXJ0aWNpcGFudCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgZXZlbnRDb3VudGVyID0gMDtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsLm9uRGlkU2F2ZSgoKSA9PiB7XG5cdFx0XHRhc3NlcnQub2soIW1vZGVsLmlzRGlydHkoKSk7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLmFkZFNhdmVQYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogbW9kZWwgPT4ge1xuXHRcdFx0XHRhc3NlcnQub2sobW9kZWwuaXNEaXJ0eSgpKTtcblx0XHRcdFx0KG1vZGVsIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnYmFyJykpO1xuXHRcdFx0XHRhc3NlcnQub2sobW9kZWwuaXNEaXJ0eSgpKTtcblx0XHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cblx0XHRcdFx0cmV0dXJuIHRpbWVvdXQoMTApO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbycpKTtcblxuXHRcdGNvbnN0IG5vdyA9IERhdGUubm93KCk7XG5cdFx0YXdhaXQgbW9kZWwuc2F2ZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5vayhEYXRlLm5vdygpIC0gbm93ID49IDEwKTtcblx0fSk7XG5cblx0dGVzdCgnU2F2ZSBQYXJ0aWNpcGFudCwgYmFkIHBhcnRpY2lwYW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLmFkZFNhdmVQYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRuZXcgRXJyb3IoJ2Jvb20nKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cblx0XHRhd2FpdCBtb2RlbC5zYXZlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NhdmUgUGFydGljaXBhbnQsIHBhcnRpY2lwYW50IGNhbmNlbGxlZCB3aGVuIHNhdmVkIGFnYWluJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRjb25zdCBwYXJ0aWNpcGF0aW9uczogYm9vbGVhbltdID0gW107XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLmFkZFNhdmVQYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKG1vZGVsLCBjb250ZXh0LCBwcm9ncmVzcywgdG9rZW4pID0+IHtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cblx0XHRcdFx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHBhcnRpY2lwYXRpb25zLnB1c2godHJ1ZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbycpKTtcblx0XHRjb25zdCBwMSA9IG1vZGVsLnNhdmUoKTtcblxuXHRcdG1vZGVsLnVwZGF0ZVRleHRFZGl0b3JNb2RlbChjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnZm9vIDEnKSk7XG5cdFx0Y29uc3QgcDIgPSBtb2RlbC5zYXZlKCk7XG5cblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbyAyJykpO1xuXHRcdGNvbnN0IHAzID0gbW9kZWwuc2F2ZSgpO1xuXG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28gMycpKTtcblx0XHRjb25zdCBwNCA9IG1vZGVsLnNhdmUoKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtwMSwgcDIsIHAzLCBwNF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0aWNpcGF0aW9ucy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTYXZlIFBhcnRpY2lwYW50LCBjYWxsaW5nIHNhdmUgZnJvbSB3aXRoaW4gaXMgdW5zdXBwb3J0ZWQgYnV0IGRvZXMgbm90IGV4cGxvZGUgKHN5bmMgc2F2ZSwgbm8gbW9kZWwgY2hhbmdlKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXG5cdFx0YXdhaXQgdGVzdFNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50KG1vZGVsLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnU2F2ZSBQYXJ0aWNpcGFudCwgY2FsbGluZyBzYXZlIGZyb20gd2l0aGluIGlzIHVuc3VwcG9ydGVkIGJ1dCBkb2VzIG5vdCBleHBsb2RlIChhc3luYyBzYXZlLCBubyBtb2RlbCBjaGFuZ2UpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRhd2FpdCB0ZXN0U2F2ZUZyb21TYXZlUGFydGljaXBhbnQobW9kZWwsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NhdmUgUGFydGljaXBhbnQsIGNhbGxpbmcgc2F2ZSBmcm9tIHdpdGhpbiBpcyB1bnN1cHBvcnRlZCBidXQgZG9lcyBub3QgZXhwbG9kZSAoc3luYyBzYXZlLCBtb2RlbCBjaGFuZ2UpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRhd2FpdCB0ZXN0U2F2ZUZyb21TYXZlUGFydGljaXBhbnQobW9kZWwsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NhdmUgUGFydGljaXBhbnQsIGNhbGxpbmcgc2F2ZSBmcm9tIHdpdGhpbiBpcyB1bnN1cHBvcnRlZCBidXQgZG9lcyBub3QgZXhwbG9kZSAoYXN5bmMgc2F2ZSwgbW9kZWwgY2hhbmdlKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4X2FzeW5jLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXG5cdFx0YXdhaXQgdGVzdFNhdmVGcm9tU2F2ZVBhcnRpY2lwYW50KG1vZGVsLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NhdmUgUGFydGljaXBhbnQsIGNhbGxpbmcgc2F2ZSBmcm9tIHdpdGhpbiBpcyB1bnN1cHBvcnRlZCBidXQgZG9lcyBub3QgZXhwbG9kZSAoZm9yY2UpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfYXN5bmMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRhd2FpdCB0ZXN0U2F2ZUZyb21TYXZlUGFydGljaXBhbnQobW9kZWwsIGZhbHNlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RTYXZlRnJvbVNhdmVQYXJ0aWNpcGFudChtb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCwgYXN5bmM6IGJvb2xlYW4sIG1vZGVsQ2hhbmdlOiBib29sZWFuLCBmb3JjZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5hZGRTYXZlUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGltZW91dCgxMCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobW9kZWxDaGFuZ2UpIHtcblx0XHRcdFx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2JhcicpKTtcblxuXHRcdFx0XHRcdGNvbnN0IG5ld1NhdmVQcm9taXNlID0gbW9kZWwuc2F2ZShmb3JjZSA/IHsgZm9yY2UgfSA6IHVuZGVmaW5lZCk7XG5cblx0XHRcdFx0XHQvLyBhc3NlcnQgdGhhdCB0aGlzIGlzIG5vdCB0aGUgc2FtZSBwcm9taXNlIGFzIHRoZSBvdXRlciBvbmVcblx0XHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwoc2F2ZVByb21pc2UsIG5ld1NhdmVQcm9taXNlKTtcblxuXHRcdFx0XHRcdGF3YWl0IG5ld1NhdmVQcm9taXNlO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IG5ld1NhdmVQcm9taXNlID0gbW9kZWwuc2F2ZShmb3JjZSA/IHsgZm9yY2UgfSA6IHVuZGVmaW5lZCk7XG5cblx0XHRcdFx0XHQvLyBhc3NlcnQgdGhhdCB0aGlzIGlzIHRoZSBzYW1lIHByb21pc2UgYXMgdGhlIG91dGVyIG9uZVxuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlUHJvbWlzZSwgbmV3U2F2ZVByb21pc2UpO1xuXG5cdFx0XHRcdFx0YXdhaXQgc2F2ZVByb21pc2U7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0bW9kZWwudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdmb28nKSk7XG5cblx0XHRjb25zdCBzYXZlUHJvbWlzZSA9IG1vZGVsLnNhdmUoZm9yY2UgPyB7IGZvcmNlIH0gOiB1bmRlZmluZWQpO1xuXHRcdGF3YWl0IHNhdmVQcm9taXNlO1xuXHR9XG5cblx0dGVzdCgnU2F2ZSBQYXJ0aWNpcGFudCBjYXJyaWVzIGNvbnRleHQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleF9hc3luYy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdGNvbnN0IGZyb20gPSBVUkkuZmlsZSgndGVzdEZyb20nKTtcblx0XHRsZXQgZTogRXJyb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5hZGRTYXZlUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jICh3YywgY29udGV4dCkgPT4ge1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZXh0LnJlYXNvbiwgU2F2ZVJlYXNvbi5FWFBMSUNJVCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHQuc2F2ZWRGcm9tPy50b1N0cmluZygpLCBmcm9tLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdGUgPSBlcnJvcjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRtb2RlbC51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2ZvbycpKTtcblxuXHRcdGF3YWl0IG1vZGVsLnNhdmUoeyBmb3JjZTogdHJ1ZSwgZnJvbSB9KTtcblxuXHRcdGlmIChlKSB7XG5cdFx0XHR0aHJvdyBlO1xuXHRcdH1cblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUVuQixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLGNBQWMsMEJBQTBCLGtCQUFrQiw2QkFBNEQ7QUFDL0gsU0FBUyx1QkFBdUIsK0JBQStCLHFCQUFxQixpQ0FBaUMsK0JBQStCO0FBQ3BKLFNBQVMseUNBQXlDLGtCQUFrQjtBQUVwRSxTQUFTLHFCQUFxQixvQkFBb0IsMENBQTBDO0FBQzVGLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxpQkFBaUIsb0JBQW9CO0FBQzlDLFNBQVMsWUFBWSwwQkFBMEI7QUFDL0MsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZTtBQUN4QixTQUFTLGFBQWE7QUFDdEIsU0FBUyxXQUFXO0FBRXBCLE1BQU0sK0JBQStCLE1BQU07QUFFMUMsV0FBUyxvQkFBb0IsT0FBb0M7QUFDaEUsVUFBTSxPQUFPLHdCQUF3QixLQUFLO0FB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
