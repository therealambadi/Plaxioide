import assert from "assert";
import { TextFileEditorModel } from "../../../textfile/common/textFileEditorModel.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { workbenchInstantiationService, TestServiceAccessor } from "../../../../test/browser/workbenchTestServices.js";
import { FileOperation } from "../../../../../platform/files/common/files.js";
import { TestWorkingCopy } from "../../../../test/common/workbenchTestServices.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { timeout } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
suite("WorkingCopyFileService", () => {
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    disposables.add(accessor.textFileService.files);
  });
  teardown(() => {
    disposables.clear();
  });
  test("create - dirty file", async function() {
    await testCreate(toResource.call(this, "/path/file.txt"), VSBuffer.fromString("Hello World"));
  });
  test("delete - dirty file", async function() {
    await testDelete([toResource.call(this, "/path/file.txt")]);
  });
  test("delete multiple - dirty files", async function() {
    await testDelete([
      toResource.call(this, "/path/file1.txt"),
      toResource.call(this, "/path/file2.txt"),
      toResource.call(this, "/path/file3.txt"),
      toResource.call(this, "/path/file4.txt")
    ]);
  });
  test("move - dirty file", async function() {
    await testMoveOrCopy([{ source: toResource.call(this, "/path/file.txt"), target: toResource.call(this, "/path/file_target.txt") }], true);
  });
  test("move - source identical to target", async function() {
    const sourceModel = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file.txt"), "utf8", void 0);
    accessor.textFileService.files.add(sourceModel.resource, sourceModel);
    const eventCounter = await testEventsMoveOrCopy([{ file: { source: sourceModel.resource, target: sourceModel.resource }, overwrite: true }], true);
    sourceModel.dispose();
    assert.strictEqual(eventCounter, 3);
  });
  test("move - one source == target and another source != target", async function() {
    const sourceModel1 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file1.txt"), "utf8", void 0);
    const sourceModel2 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file2.txt"), "utf8", void 0);
    const targetModel2 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file_target2.txt"), "utf8", void 0);
    accessor.textFileService.files.add(sourceModel1.resource, sourceModel1);
    accessor.textFileService.files.add(sourceModel2.resource, sourceModel2);
    accessor.textFileService.files.add(targetModel2.resource, targetModel2);
    const eventCounter = await testEventsMoveOrCopy([
      { file: { source: sourceModel1.resource, target: sourceModel1.resource }, overwrite: true },
      { file: { source: sourceModel2.resource, target: targetModel2.resource }, overwrite: true }
    ], true);
    sourceModel1.dispose();
    sourceModel2.dispose();
    targetModel2.dispose();
    assert.strictEqual(eventCounter, 3);
  });
  test("move multiple - dirty file", async function() {
    await testMoveOrCopy(
      [
        { source: toResource.call(this, "/path/file1.txt"), target: toResource.call(this, "/path/file1_target.txt") },
        { source: toResource.call(this, "/path/file2.txt"), target: toResource.call(this, "/path/file2_target.txt") }
      ],
      true
    );
  });
  test("move - dirty file (target exists and is dirty)", async function() {
    await testMoveOrCopy([{ source: toResource.call(this, "/path/file.txt"), target: toResource.call(this, "/path/file_target.txt") }], true, true);
  });
  test("copy - dirty file", async function() {
    await testMoveOrCopy([{ source: toResource.call(this, "/path/file.txt"), target: toResource.call(this, "/path/file_target.txt") }], false);
  });
  test("copy - source identical to target", async function() {
    const sourceModel = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file.txt"), "utf8", void 0);
    accessor.textFileService.files.add(sourceModel.resource, sourceModel);
    const eventCounter = await testEventsMoveOrCopy([{ file: { source: sourceModel.resource, target: sourceModel.resource }, overwrite: true }]);
    sourceModel.dispose();
    assert.strictEqual(eventCounter, 3);
  });
  test("copy - one source == target and another source != target", async function() {
    const sourceModel1 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file1.txt"), "utf8", void 0);
    const sourceModel2 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file2.txt"), "utf8", void 0);
    const targetModel2 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file_target2.txt"), "utf8", void 0);
    accessor.textFileService.files.add(sourceModel1.resource, sourceModel1);
    accessor.textFileService.files.add(sourceModel2.resource, sourceModel2);
    accessor.textFileService.files.add(targetModel2.resource, targetModel2);
    const eventCounter = await testEventsMoveOrCopy([
      { file: { source: sourceModel1.resource, target: sourceModel1.resource }, overwrite: true },
      { file: { source: sourceModel2.resource, target: targetModel2.resource }, overwrite: true }
    ]);
    sourceModel1.dispose();
    sourceModel2.dispose();
    targetModel2.dispose();
    assert.strictEqual(eventCounter, 3);
  });
  test("copy multiple - dirty file", async function() {
    await testMoveOrCopy(
      [
        { source: toResource.call(this, "/path/file1.txt"), target: toResource.call(this, "/path/file_target1.txt") },
        { source: toResource.call(this, "/path/file2.txt"), target: toResource.call(this, "/path/file_target2.txt") },
        { source: toResource.call(this, "/path/file3.txt"), target: toResource.call(this, "/path/file_target3.txt") }
      ],
      false
    );
  });
  test("copy - dirty file (target exists and is dirty)", async function() {
    await testMoveOrCopy([{ source: toResource.call(this, "/path/file.txt"), target: toResource.call(this, "/path/file_target.txt") }], false, true);
  });
  test("getDirty", async function() {
    const model1 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file-1.txt"), "utf8", void 0);
    accessor.textFileService.files.add(model1.resource, model1);
    const model2 = instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file-2.txt"), "utf8", void 0);
    accessor.textFileService.files.add(model2.resource, model2);
    let dirty = accessor.workingCopyFileService.getDirty(model1.resource);
    assert.strictEqual(dirty.length, 0);
    await model1.resolve();
    model1.textEditorModel.setValue("foo");
    dirty = accessor.workingCopyFileService.getDirty(model1.resource);
    assert.strictEqual(dirty.length, 1);
    assert.strictEqual(dirty[0], model1);
    dirty = accessor.workingCopyFileService.getDirty(toResource.call(this, "/path"));
    assert.strictEqual(dirty.length, 1);
    assert.strictEqual(dirty[0], model1);
    await model2.resolve();
    model2.textEditorModel.setValue("bar");
    dirty = accessor.workingCopyFileService.getDirty(toResource.call(this, "/path"));
    assert.strictEqual(dirty.length, 2);
    model1.dispose();
    model2.dispose();
  });
  test("registerWorkingCopyProvider", async function() {
    const model1 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/file-1.txt"), "utf8", void 0));
    accessor.textFileService.files.add(model1.resource, model1);
    await model1.resolve();
    model1.textEditorModel.setValue("foo");
    const testWorkingCopy = disposables.add(new TestWorkingCopy(toResource.call(this, "/path/file-2.txt"), true));
    const registration = accessor.workingCopyFileService.registerWorkingCopyProvider(() => {
      return [model1, testWorkingCopy];
    });
    let dirty = accessor.workingCopyFileService.getDirty(model1.resource);
    assert.strictEqual(dirty.length, 2, "Should return default working copy + working copy from provider");
    assert.strictEqual(dirty[0], model1);
    assert.strictEqual(dirty[1], testWorkingCopy);
    registration.dispose();
    dirty = accessor.workingCopyFileService.getDirty(model1.resource);
    assert.strictEqual(dirty.length, 1, "Should have unregistered our provider");
    assert.strictEqual(dirty[0], model1);
  });
  test("createFolder", async function() {
    let eventCounter = 0;
    let correlationId = void 0;
    const resource = toResource.call(this, "/path/folder");
    disposables.add(accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files, operation) => {
        assert.strictEqual(files.length, 1);
        const file = files[0];
        assert.strictEqual(file.target.toString(), resource.toString());
        assert.strictEqual(operation, FileOperation.CREATE);
        eventCounter++;
      }
    }));
    disposables.add(accessor.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => {
      assert.strictEqual(e.files.length, 1);
      const file = e.files[0];
      assert.strictEqual(file.target.toString(), resource.toString());
      assert.strictEqual(e.operation, FileOperation.CREATE);
      correlationId = e.correlationId;
      eventCounter++;
    }));
    disposables.add(accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => {
      assert.strictEqual(e.files.length, 1);
      const file = e.files[0];
      assert.strictEqual(file.target.toString(), resource.toString());
      assert.strictEqual(e.operation, FileOperation.CREATE);
      assert.strictEqual(e.correlationId, correlationId);
      eventCounter++;
    }));
    await accessor.workingCopyFileService.createFolder([{ resource }], CancellationToken.None);
    assert.strictEqual(eventCounter, 3);
  });
  test("cancellation of participants", async function() {
    const resource = toResource.call(this, "/path/folder");
    let canceled = false;
    disposables.add(accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files, operation, info, t, token) => {
        await timeout(0);
        canceled = token.isCancellationRequested;
      }
    }));
    let cts = new CancellationTokenSource();
    let promise = accessor.workingCopyFileService.create([{ resource }], cts.token);
    cts.cancel();
    await promise;
    assert.strictEqual(canceled, true);
    canceled = false;
    cts = new CancellationTokenSource();
    promise = accessor.workingCopyFileService.createFolder([{ resource }], cts.token);
    cts.cancel();
    await promise;
    assert.strictEqual(canceled, true);
    canceled = false;
    cts = new CancellationTokenSource();
    promise = accessor.workingCopyFileService.move([{ file: { source: resource, target: resource } }], cts.token);
    cts.cancel();
    await promise;
    assert.strictEqual(canceled, true);
    canceled = false;
    cts = new CancellationTokenSource();
    promise = accessor.workingCopyFileService.copy([{ file: { source: resource, target: resource } }], cts.token);
    cts.cancel();
    await promise;
    assert.strictEqual(canceled, true);
    canceled = false;
    cts = new CancellationTokenSource();
    promise = accessor.workingCopyFileService.delete([{ resource }], cts.token);
    cts.cancel();
    await promise;
    assert.strictEqual(canceled, true);
    canceled = false;
  });
  async function testEventsMoveOrCopy(files, move) {
    let eventCounter = 0;
    const participant = accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files2) => {
        eventCounter++;
      }
    });
    const listener1 = accessor.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => {
      eventCounter++;
    });
    const listener2 = accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => {
      eventCounter++;
    });
    if (move) {
      await accessor.workingCopyFileService.move(files, CancellationToken.None);
    } else {
      await accessor.workingCopyFileService.copy(files, CancellationToken.None);
    }
    participant.dispose();
    listener1.dispose();
    listener2.dispose();
    return eventCounter;
  }
  async function testMoveOrCopy(files, move, targetDirty) {
    let eventCounter = 0;
    const models = await Promise.all(files.map(async ({ source, target }, i) => {
      const sourceModel = instantiationService.createInstance(TextFileEditorModel, source, "utf8", void 0);
      const targetModel = instantiationService.createInstance(TextFileEditorModel, target, "utf8", void 0);
      accessor.textFileService.files.add(sourceModel.resource, sourceModel);
      accessor.textFileService.files.add(targetModel.resource, targetModel);
      await sourceModel.resolve();
      sourceModel.textEditorModel.setValue("foo" + i);
      assert.ok(accessor.textFileService.isDirty(sourceModel.resource));
      if (targetDirty) {
        await targetModel.resolve();
        targetModel.textEditorModel.setValue("bar" + i);
        assert.ok(accessor.textFileService.isDirty(targetModel.resource));
      }
      return { sourceModel, targetModel };
    }));
    const participant = accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files2, operation) => {
        for (let i = 0; i < files2.length; i++) {
          const { target, source } = files2[i];
          const { targetModel, sourceModel } = models[i];
          assert.strictEqual(target.toString(), targetModel.resource.toString());
          assert.strictEqual(source?.toString(), sourceModel.resource.toString());
        }
        eventCounter++;
        assert.strictEqual(operation, move ? FileOperation.MOVE : FileOperation.COPY);
      }
    });
    let correlationId;
    const listener1 = accessor.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => {
      for (let i = 0; i < e.files.length; i++) {
        const { target, source } = files[i];
        const { targetModel, sourceModel } = models[i];
        assert.strictEqual(target.toString(), targetModel.resource.toString());
        assert.strictEqual(source?.toString(), sourceModel.resource.toString());
      }
      eventCounter++;
      correlationId = e.correlationId;
      assert.strictEqual(e.operation, move ? FileOperation.MOVE : FileOperation.COPY);
    });
    const listener2 = accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => {
      for (let i = 0; i < e.files.length; i++) {
        const { target, source } = files[i];
        const { targetModel, sourceModel } = models[i];
        assert.strictEqual(target.toString(), targetModel.resource.toString());
        assert.strictEqual(source?.toString(), sourceModel.resource.toString());
      }
      eventCounter++;
      assert.strictEqual(e.operation, move ? FileOperation.MOVE : FileOperation.COPY);
      assert.strictEqual(e.correlationId, correlationId);
    });
    if (move) {
      await accessor.workingCopyFileService.move(models.map((model) => ({ file: { source: model.sourceModel.resource, target: model.targetModel.resource }, options: { overwrite: true } })), CancellationToken.None);
    } else {
      await accessor.workingCopyFileService.copy(models.map((model) => ({ file: { source: model.sourceModel.resource, target: model.targetModel.resource }, options: { overwrite: true } })), CancellationToken.None);
    }
    for (let i = 0; i < models.length; i++) {
      const { sourceModel, targetModel } = models[i];
      assert.strictEqual(targetModel.textEditorModel.getValue(), "foo" + i);
      if (move) {
        assert.ok(!accessor.textFileService.isDirty(sourceModel.resource));
      } else {
        assert.ok(accessor.textFileService.isDirty(sourceModel.resource));
      }
      assert.ok(accessor.textFileService.isDirty(targetModel.resource));
      sourceModel.dispose();
      targetModel.dispose();
    }
    assert.strictEqual(eventCounter, 3);
    participant.dispose();
    listener1.dispose();
    listener2.dispose();
  }
  async function testDelete(resources) {
    const models = await Promise.all(resources.map(async (resource) => {
      const model = instantiationService.createInstance(TextFileEditorModel, resource, "utf8", void 0);
      accessor.textFileService.files.add(model.resource, model);
      await model.resolve();
      model.textEditorModel.setValue("foo");
      assert.ok(accessor.workingCopyService.isDirty(model.resource));
      return model;
    }));
    let eventCounter = 0;
    let correlationId = void 0;
    const participant = accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files, operation) => {
        for (let i = 0; i < models.length; i++) {
          const model = models[i];
          const file = files[i];
          assert.strictEqual(file.target.toString(), model.resource.toString());
        }
        assert.strictEqual(operation, FileOperation.DELETE);
        eventCounter++;
      }
    });
    const listener1 = accessor.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => {
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const file = e.files[i];
        assert.strictEqual(file.target.toString(), model.resource.toString());
      }
      assert.strictEqual(e.operation, FileOperation.DELETE);
      correlationId = e.correlationId;
      eventCounter++;
    });
    const listener2 = accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => {
      for (let i = 0; i < models.length; i++) {
        const model = models[i];
        const file = e.files[i];
        assert.strictEqual(file.target.toString(), model.resource.toString());
      }
      assert.strictEqual(e.operation, FileOperation.DELETE);
      assert.strictEqual(e.correlationId, correlationId);
      eventCounter++;
    });
    await accessor.workingCopyFileService.delete(models.map((model) => ({ resource: model.resource })), CancellationToken.None);
    for (const model of models) {
      assert.ok(!accessor.workingCopyService.isDirty(model.resource));
      model.dispose();
    }
    assert.strictEqual(eventCounter, 3);
    participant.dispose();
    listener1.dispose();
    listener2.dispose();
  }
  async function testCreate(resource, contents) {
    const model = instantiationService.createInstance(TextFileEditorModel, resource, "utf8", void 0);
    accessor.textFileService.files.add(model.resource, model);
    await model.resolve();
    model.textEditorModel.setValue("foo");
    assert.ok(accessor.workingCopyService.isDirty(model.resource));
    let eventCounter = 0;
    let correlationId = void 0;
    disposables.add(accessor.workingCopyFileService.addFileOperationParticipant({
      participate: async (files, operation) => {
        assert.strictEqual(files.length, 1);
        const file = files[0];
        assert.strictEqual(file.target.toString(), model.resource.toString());
        assert.strictEqual(operation, FileOperation.CREATE);
        eventCounter++;
      }
    }));
    disposables.add(accessor.workingCopyFileService.onWillRunWorkingCopyFileOperation((e) => {
      assert.strictEqual(e.files.length, 1);
      const file = e.files[0];
      assert.strictEqual(file.target.toString(), model.resource.toString());
      assert.strictEqual(e.operation, FileOperation.CREATE);
      correlationId = e.correlationId;
      eventCounter++;
    }));
    disposables.add(accessor.workingCopyFileService.onDidRunWorkingCopyFileOperation((e) => {
      assert.strictEqual(e.files.length, 1);
      const file = e.files[0];
      assert.strictEqual(file.target.toString(), model.resource.toString());
      assert.strictEqual(e.operation, FileOperation.CREATE);
      assert.strictEqual(e.correlationId, correlationId);
      eventCounter++;
    }));
    await accessor.workingCopyFileService.create([{ resource, contents }], CancellationToken.None);
    assert.ok(!accessor.workingCopyService.isDirty(model.resource));
    model.dispose();
    assert.strictEqual(eventCounter, 3);
  }
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9icm93c2VyL3dvcmtpbmdDb3B5RmlsZVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFRleHRGaWxlRWRpdG9yTW9kZWwgfSBmcm9tICcuLi8uLi8uLi90ZXh0ZmlsZS9jb21tb24vdGV4dEZpbGVFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3RleHRmaWxlL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSwgdG9SZXNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UsIFRlc3RTZXJ2aWNlQWNjZXNzb3IsIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXIgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IFRlc3RXb3JraW5nQ29weSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJQ29weU9wZXJhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi93b3JraW5nQ29weUZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuc3VpdGUoJ1dvcmtpbmdDb3B5RmlsZVNlcnZpY2UnLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgYWNjZXNzb3I6IFRlc3RTZXJ2aWNlQWNjZXNzb3I7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0YWNjZXNzb3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U2VydmljZUFjY2Vzc29yKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoPFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgLSBkaXJ0eSBmaWxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHRlc3RDcmVhdGUodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlLnR4dCcpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbyBXb3JsZCcpKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIC0gZGlydHkgZmlsZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB0ZXN0RGVsZXRlKFt0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUudHh0JyldKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIG11bHRpcGxlIC0gZGlydHkgZmlsZXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgdGVzdERlbGV0ZShbXG5cdFx0XHR0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUxLnR4dCcpLFxuXHRcdFx0dG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlMi50eHQnKSxcblx0XHRcdHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZTMudHh0JyksXG5cdFx0XHR0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGU0LnR4dCcpXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgLSBkaXJ0eSBmaWxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHRlc3RNb3ZlT3JDb3B5KFt7IHNvdXJjZTogdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlLnR4dCcpLCB0YXJnZXQ6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZV90YXJnZXQudHh0JykgfV0sIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIC0gc291cmNlIGlkZW50aWNhbCB0byB0YXJnZXQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgc291cmNlTW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHQoPElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKS5hZGQoc291cmNlTW9kZWwucmVzb3VyY2UsIHNvdXJjZU1vZGVsKTtcblxuXHRcdGNvbnN0IGV2ZW50Q291bnRlciA9IGF3YWl0IHRlc3RFdmVudHNNb3ZlT3JDb3B5KFt7IGZpbGU6IHsgc291cmNlOiBzb3VyY2VNb2RlbC5yZXNvdXJjZSwgdGFyZ2V0OiBzb3VyY2VNb2RlbC5yZXNvdXJjZSB9LCBvdmVyd3JpdGU6IHRydWUgfV0sIHRydWUpO1xuXG5cdFx0c291cmNlTW9kZWwuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIC0gb25lIHNvdXJjZSA9PSB0YXJnZXQgYW5kIGFub3RoZXIgc291cmNlICE9IHRhcmdldCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzb3VyY2VNb2RlbDE6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUxLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cdFx0Y29uc3Qgc291cmNlTW9kZWwyOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlMi50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IHRhcmdldE1vZGVsMjogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZV90YXJnZXQyLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cdFx0KDxJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcykuYWRkKHNvdXJjZU1vZGVsMS5yZXNvdXJjZSwgc291cmNlTW9kZWwxKTtcblx0XHQoPElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKS5hZGQoc291cmNlTW9kZWwyLnJlc291cmNlLCBzb3VyY2VNb2RlbDIpO1xuXHRcdCg8SVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcj5hY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMpLmFkZCh0YXJnZXRNb2RlbDIucmVzb3VyY2UsIHRhcmdldE1vZGVsMik7XG5cblx0XHRjb25zdCBldmVudENvdW50ZXIgPSBhd2FpdCB0ZXN0RXZlbnRzTW92ZU9yQ29weShbXG5cdFx0XHR7IGZpbGU6IHsgc291cmNlOiBzb3VyY2VNb2RlbDEucmVzb3VyY2UsIHRhcmdldDogc291cmNlTW9kZWwxLnJlc291cmNlIH0sIG92ZXJ3cml0ZTogdHJ1ZSB9LFxuXHRcdFx0eyBmaWxlOiB7IHNvdXJjZTogc291cmNlTW9kZWwyLnJlc291cmNlLCB0YXJnZXQ6IHRhcmdldE1vZGVsMi5yZXNvdXJjZSB9LCBvdmVyd3JpdGU6IHRydWUgfVxuXHRcdF0sIHRydWUpO1xuXG5cdFx0c291cmNlTW9kZWwxLmRpc3Bvc2UoKTtcblx0XHRzb3VyY2VNb2RlbDIuZGlzcG9zZSgpO1xuXHRcdHRhcmdldE1vZGVsMi5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21vdmUgbXVsdGlwbGUgLSBkaXJ0eSBmaWxlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHRlc3RNb3ZlT3JDb3B5KFtcblx0XHRcdHsgc291cmNlOiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUxLnR4dCcpLCB0YXJnZXQ6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZTFfdGFyZ2V0LnR4dCcpIH0sXG5cdFx0XHR7IHNvdXJjZTogdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlMi50eHQnKSwgdGFyZ2V0OiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUyX3RhcmdldC50eHQnKSB9XSxcblx0XHRcdHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdtb3ZlIC0gZGlydHkgZmlsZSAodGFyZ2V0IGV4aXN0cyBhbmQgaXMgZGlydHkpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHRlc3RNb3ZlT3JDb3B5KFt7IHNvdXJjZTogdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlLnR4dCcpLCB0YXJnZXQ6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZV90YXJnZXQudHh0JykgfV0sIHRydWUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb3B5IC0gZGlydHkgZmlsZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB0ZXN0TW92ZU9yQ29weShbeyBzb3VyY2U6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZS50eHQnKSwgdGFyZ2V0OiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGVfdGFyZ2V0LnR4dCcpIH1dLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHkgLSBzb3VyY2UgaWRlbnRpY2FsIHRvIHRhcmdldCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBzb3VyY2VNb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZS50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXHRcdCg8SVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcj5hY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMpLmFkZChzb3VyY2VNb2RlbC5yZXNvdXJjZSwgc291cmNlTW9kZWwpO1xuXG5cdFx0Y29uc3QgZXZlbnRDb3VudGVyID0gYXdhaXQgdGVzdEV2ZW50c01vdmVPckNvcHkoW3sgZmlsZTogeyBzb3VyY2U6IHNvdXJjZU1vZGVsLnJlc291cmNlLCB0YXJnZXQ6IHNvdXJjZU1vZGVsLnJlc291cmNlIH0sIG92ZXJ3cml0ZTogdHJ1ZSB9XSk7XG5cblx0XHRzb3VyY2VNb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHkgLSBvbmUgc291cmNlID09IHRhcmdldCBhbmQgYW5vdGhlciBzb3VyY2UgIT0gdGFyZ2V0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHNvdXJjZU1vZGVsMTogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZTEudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHRjb25zdCBzb3VyY2VNb2RlbDI6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUyLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cdFx0Y29uc3QgdGFyZ2V0TW9kZWwyOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlX3RhcmdldDIudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHQoPElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKS5hZGQoc291cmNlTW9kZWwxLnJlc291cmNlLCBzb3VyY2VNb2RlbDEpO1xuXHRcdCg8SVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcj5hY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMpLmFkZChzb3VyY2VNb2RlbDIucmVzb3VyY2UsIHNvdXJjZU1vZGVsMik7XG5cdFx0KDxJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcykuYWRkKHRhcmdldE1vZGVsMi5yZXNvdXJjZSwgdGFyZ2V0TW9kZWwyKTtcblxuXHRcdGNvbnN0IGV2ZW50Q291bnRlciA9IGF3YWl0IHRlc3RFdmVudHNNb3ZlT3JDb3B5KFtcblx0XHRcdHsgZmlsZTogeyBzb3VyY2U6IHNvdXJjZU1vZGVsMS5yZXNvdXJjZSwgdGFyZ2V0OiBzb3VyY2VNb2RlbDEucmVzb3VyY2UgfSwgb3ZlcndyaXRlOiB0cnVlIH0sXG5cdFx0XHR7IGZpbGU6IHsgc291cmNlOiBzb3VyY2VNb2RlbDIucmVzb3VyY2UsIHRhcmdldDogdGFyZ2V0TW9kZWwyLnJlc291cmNlIH0sIG92ZXJ3cml0ZTogdHJ1ZSB9XG5cdFx0XSk7XG5cblx0XHRzb3VyY2VNb2RlbDEuZGlzcG9zZSgpO1xuXHRcdHNvdXJjZU1vZGVsMi5kaXNwb3NlKCk7XG5cdFx0dGFyZ2V0TW9kZWwyLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudGVyLCAzKTtcblx0fSk7XG5cblx0dGVzdCgnY29weSBtdWx0aXBsZSAtIGRpcnR5IGZpbGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgdGVzdE1vdmVPckNvcHkoW1xuXHRcdFx0eyBzb3VyY2U6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZTEudHh0JyksIHRhcmdldDogdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlX3RhcmdldDEudHh0JykgfSxcblx0XHRcdHsgc291cmNlOiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUyLnR4dCcpLCB0YXJnZXQ6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZV90YXJnZXQyLnR4dCcpIH0sXG5cdFx0XHR7IHNvdXJjZTogdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9maWxlMy50eHQnKSwgdGFyZ2V0OiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGVfdGFyZ2V0My50eHQnKSB9XSxcblx0XHRcdGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnY29weSAtIGRpcnR5IGZpbGUgKHRhcmdldCBleGlzdHMgYW5kIGlzIGRpcnR5KScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB0ZXN0TW92ZU9yQ29weShbeyBzb3VyY2U6IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZS50eHQnKSwgdGFyZ2V0OiB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGVfdGFyZ2V0LnR4dCcpIH1dLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldERpcnR5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsMSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZS0xLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cdFx0KDxJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcykuYWRkKG1vZGVsMS5yZXNvdXJjZSwgbW9kZWwxKTtcblxuXHRcdGNvbnN0IG1vZGVsMiA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvZmlsZS0yLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCk7XG5cdFx0KDxJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcykuYWRkKG1vZGVsMi5yZXNvdXJjZSwgbW9kZWwyKTtcblxuXHRcdGxldCBkaXJ0eSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuZ2V0RGlydHkobW9kZWwxLnJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkubGVuZ3RoLCAwKTtcblxuXHRcdGF3YWl0IG1vZGVsMS5yZXNvbHZlKCk7XG5cdFx0bW9kZWwxLnRleHRFZGl0b3JNb2RlbCEuc2V0VmFsdWUoJ2ZvbycpO1xuXG5cdFx0ZGlydHkgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmdldERpcnR5KG1vZGVsMS5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5WzBdLCBtb2RlbDEpO1xuXG5cdFx0ZGlydHkgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmdldERpcnR5KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5WzBdLCBtb2RlbDEpO1xuXG5cdFx0YXdhaXQgbW9kZWwyLnJlc29sdmUoKTtcblx0XHRtb2RlbDIudGV4dEVkaXRvck1vZGVsIS5zZXRWYWx1ZSgnYmFyJyk7XG5cblx0XHRkaXJ0eSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuZ2V0RGlydHkodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkubGVuZ3RoLCAyKTtcblxuXHRcdG1vZGVsMS5kaXNwb3NlKCk7XG5cdFx0bW9kZWwyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVnaXN0ZXJXb3JraW5nQ29weVByb3ZpZGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG1vZGVsMTogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUtMS50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHQoPElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKS5hZGQobW9kZWwxLnJlc291cmNlLCBtb2RlbDEpO1xuXHRcdGF3YWl0IG1vZGVsMS5yZXNvbHZlKCk7XG5cdFx0bW9kZWwxLnRleHRFZGl0b3JNb2RlbCEuc2V0VmFsdWUoJ2ZvbycpO1xuXG5cdFx0Y29uc3QgdGVzdFdvcmtpbmdDb3B5OiBUZXN0V29ya2luZ0NvcHkgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RXb3JraW5nQ29weSh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2ZpbGUtMi50eHQnKSwgdHJ1ZSkpO1xuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbiA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UucmVnaXN0ZXJXb3JraW5nQ29weVByb3ZpZGVyKCgpID0+IHtcblx0XHRcdHJldHVybiBbbW9kZWwxLCB0ZXN0V29ya2luZ0NvcHldO1xuXHRcdH0pO1xuXG5cdFx0bGV0IGRpcnR5ID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5nZXREaXJ0eShtb2RlbDEucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eS5sZW5ndGgsIDIsICdTaG91bGQgcmV0dXJuIGRlZmF1bHQgd29ya2luZyBjb3B5ICsgd29ya2luZyBjb3B5IGZyb20gcHJvdmlkZXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHlbMF0sIG1vZGVsMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5WzFdLCB0ZXN0V29ya2luZ0NvcHkpO1xuXG5cdFx0cmVnaXN0cmF0aW9uLmRpc3Bvc2UoKTtcblxuXHRcdGRpcnR5ID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5nZXREaXJ0eShtb2RlbDEucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eS5sZW5ndGgsIDEsICdTaG91bGQgaGF2ZSB1bnJlZ2lzdGVyZWQgb3VyIHByb3ZpZGVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5WzBdLCBtb2RlbDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVGb2xkZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0bGV0IGV2ZW50Q291bnRlciA9IDA7XG5cdFx0bGV0IGNvcnJlbGF0aW9uSWQ6IG51bWJlciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9mb2xkZXInKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKGZpbGVzLCBvcGVyYXRpb24pID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1swXTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGUudGFyZ2V0LnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlcmF0aW9uLCBGaWxlT3BlcmF0aW9uLkNSRUFURSk7XG5cdFx0XHRcdGV2ZW50Q291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uV2lsbFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmZpbGVzLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBmaWxlID0gZS5maWxlc1swXTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlLnRhcmdldC50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLm9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5DUkVBVEUpO1xuXHRcdFx0Y29ycmVsYXRpb25JZCA9IGUuY29ycmVsYXRpb25JZDtcblx0XHRcdGV2ZW50Q291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uRGlkUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuZmlsZXMubGVuZ3RoLCAxKTtcblx0XHRcdGNvbnN0IGZpbGUgPSBlLmZpbGVzWzBdO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGUudGFyZ2V0LnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUub3BlcmF0aW9uLCBGaWxlT3BlcmF0aW9uLkNSRUFURSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5jb3JyZWxhdGlvbklkLCBjb3JyZWxhdGlvbklkKTtcblx0XHRcdGV2ZW50Q291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKFt7IHJlc291cmNlIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdjYW5jZWxsYXRpb24gb2YgcGFydGljaXBhbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9mb2xkZXInKTtcblxuXHRcdGxldCBjYW5jZWxlZCA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKGZpbGVzLCBvcGVyYXRpb24sIGluZm8sIHQsIHRva2VuKSA9PiB7XG5cdFx0XHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cdFx0XHRcdGNhbmNlbGVkID0gdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Ly8gQ3JlYXRlXG5cdFx0bGV0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGxldCBwcm9taXNlOiBQcm9taXNlPHVua25vd24+ID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UgfV0sIGN0cy50b2tlbik7XG5cdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdGF3YWl0IHByb21pc2U7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbmNlbGVkLCB0cnVlKTtcblx0XHRjYW5jZWxlZCA9IGZhbHNlO1xuXG5cdFx0Ly8gQ3JlYXRlIEZvbGRlclxuXHRcdGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHByb21pc2UgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihbeyByZXNvdXJjZSB9XSwgY3RzLnRva2VuKTtcblx0XHRjdHMuY2FuY2VsKCk7XG5cdFx0YXdhaXQgcHJvbWlzZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuY2VsZWQsIHRydWUpO1xuXHRcdGNhbmNlbGVkID0gZmFsc2U7XG5cblx0XHQvLyBNb3ZlXG5cdFx0Y3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0cHJvbWlzZSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UubW92ZShbeyBmaWxlOiB7IHNvdXJjZTogcmVzb3VyY2UsIHRhcmdldDogcmVzb3VyY2UgfSB9XSwgY3RzLnRva2VuKTtcblx0XHRjdHMuY2FuY2VsKCk7XG5cdFx0YXdhaXQgcHJvbWlzZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuY2VsZWQsIHRydWUpO1xuXHRcdGNhbmNlbGVkID0gZmFsc2U7XG5cblx0XHQvLyBDb3B5XG5cdFx0Y3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0cHJvbWlzZSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY29weShbeyBmaWxlOiB7IHNvdXJjZTogcmVzb3VyY2UsIHRhcmdldDogcmVzb3VyY2UgfSB9XSwgY3RzLnRva2VuKTtcblx0XHRjdHMuY2FuY2VsKCk7XG5cdFx0YXdhaXQgcHJvbWlzZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuY2VsZWQsIHRydWUpO1xuXHRcdGNhbmNlbGVkID0gZmFsc2U7XG5cblx0XHQvLyBEZWxldGVcblx0XHRjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRwcm9taXNlID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5kZWxldGUoW3sgcmVzb3VyY2UgfV0sIGN0cy50b2tlbik7XG5cdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdGF3YWl0IHByb21pc2U7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbmNlbGVkLCB0cnVlKTtcblx0XHRjYW5jZWxlZCA9IGZhbHNlO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0RXZlbnRzTW92ZU9yQ29weShmaWxlczogSUNvcHlPcGVyYXRpb25bXSwgbW92ZT86IGJvb2xlYW4pOiBQcm9taXNlPG51bWJlcj4ge1xuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgZmlsZXMgPT4ge1xuXHRcdFx0XHRldmVudENvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyMSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4ge1xuXHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBsaXN0ZW5lcjIgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm9uRGlkUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4ge1xuXHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cdFx0fSk7XG5cblx0XHRpZiAobW92ZSkge1xuXHRcdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5tb3ZlKGZpbGVzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5jb3B5KGZpbGVzLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHR9XG5cblx0XHRwYXJ0aWNpcGFudC5kaXNwb3NlKCk7XG5cdFx0bGlzdGVuZXIxLmRpc3Bvc2UoKTtcblx0XHRsaXN0ZW5lcjIuZGlzcG9zZSgpO1xuXHRcdHJldHVybiBldmVudENvdW50ZXI7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0TW92ZU9yQ29weShmaWxlczogeyBzb3VyY2U6IFVSSTsgdGFyZ2V0OiBVUkkgfVtdLCBtb3ZlOiBib29sZWFuLCB0YXJnZXREaXJ0eT86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IG1vZGVscyA9IGF3YWl0IFByb21pc2UuYWxsKGZpbGVzLm1hcChhc3luYyAoeyBzb3VyY2UsIHRhcmdldCB9LCBpKSA9PiB7XG5cdFx0XHRjb25zdCBzb3VyY2VNb2RlbDogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHNvdXJjZSwgJ3V0ZjgnLCB1bmRlZmluZWQpO1xuXHRcdFx0Y29uc3QgdGFyZ2V0TW9kZWw6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0YXJnZXQsICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHRcdCg8SVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcj5hY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMpLmFkZChzb3VyY2VNb2RlbC5yZXNvdXJjZSwgc291cmNlTW9kZWwpO1xuXHRcdFx0KDxJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyPmFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcykuYWRkKHRhcmdldE1vZGVsLnJlc291cmNlLCB0YXJnZXRNb2RlbCk7XG5cblx0XHRcdGF3YWl0IHNvdXJjZU1vZGVsLnJlc29sdmUoKTtcblx0XHRcdHNvdXJjZU1vZGVsLnRleHRFZGl0b3JNb2RlbCEuc2V0VmFsdWUoJ2ZvbycgKyBpKTtcblx0XHRcdGFzc2VydC5vayhhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eShzb3VyY2VNb2RlbC5yZXNvdXJjZSkpO1xuXHRcdFx0aWYgKHRhcmdldERpcnR5KSB7XG5cdFx0XHRcdGF3YWl0IHRhcmdldE1vZGVsLnJlc29sdmUoKTtcblx0XHRcdFx0dGFyZ2V0TW9kZWwudGV4dEVkaXRvck1vZGVsIS5zZXRWYWx1ZSgnYmFyJyArIGkpO1xuXHRcdFx0XHRhc3NlcnQub2soYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmlzRGlydHkodGFyZ2V0TW9kZWwucmVzb3VyY2UpKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHsgc291cmNlTW9kZWwsIHRhcmdldE1vZGVsIH07XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcGFydGljaXBhbnQgPSBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmFkZEZpbGVPcGVyYXRpb25QYXJ0aWNpcGFudCh7XG5cdFx0XHRwYXJ0aWNpcGF0ZTogYXN5bmMgKGZpbGVzLCBvcGVyYXRpb24pID0+IHtcblx0XHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmaWxlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IHsgdGFyZ2V0LCBzb3VyY2UgfSA9IGZpbGVzW2ldO1xuXHRcdFx0XHRcdGNvbnN0IHsgdGFyZ2V0TW9kZWwsIHNvdXJjZU1vZGVsIH0gPSBtb2RlbHNbaV07XG5cblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LnRvU3RyaW5nKCksIHRhcmdldE1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2U/LnRvU3RyaW5nKCksIHNvdXJjZU1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZXJhdGlvbiwgbW92ZSA/IEZpbGVPcGVyYXRpb24uTU9WRSA6IEZpbGVPcGVyYXRpb24uQ09QWSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRsZXQgY29ycmVsYXRpb25JZDogbnVtYmVyO1xuXG5cdFx0Y29uc3QgbGlzdGVuZXIxID0gYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5vbldpbGxSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGUuZmlsZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgeyB0YXJnZXQsIHNvdXJjZSB9ID0gZmlsZXNbaV07XG5cdFx0XHRcdGNvbnN0IHsgdGFyZ2V0TW9kZWwsIHNvdXJjZU1vZGVsIH0gPSBtb2RlbHNbaV07XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldC50b1N0cmluZygpLCB0YXJnZXRNb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZT8udG9TdHJpbmcoKSwgc291cmNlTW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cblx0XHRcdGV2ZW50Q291bnRlcisrO1xuXG5cdFx0XHRjb3JyZWxhdGlvbklkID0gZS5jb3JyZWxhdGlvbklkO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUub3BlcmF0aW9uLCBtb3ZlID8gRmlsZU9wZXJhdGlvbi5NT1ZFIDogRmlsZU9wZXJhdGlvbi5DT1BZKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyMiA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25EaWRSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGUuZmlsZXMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgeyB0YXJnZXQsIHNvdXJjZSB9ID0gZmlsZXNbaV07XG5cdFx0XHRcdGNvbnN0IHsgdGFyZ2V0TW9kZWwsIHNvdXJjZU1vZGVsIH0gPSBtb2RlbHNbaV07XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQudG9TdHJpbmcoKSwgdGFyZ2V0TW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzb3VyY2U/LnRvU3RyaW5nKCksIHNvdXJjZU1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0fVxuXG5cdFx0XHRldmVudENvdW50ZXIrKztcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUub3BlcmF0aW9uLCBtb3ZlID8gRmlsZU9wZXJhdGlvbi5NT1ZFIDogRmlsZU9wZXJhdGlvbi5DT1BZKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmNvcnJlbGF0aW9uSWQsIGNvcnJlbGF0aW9uSWQpO1xuXHRcdH0pO1xuXG5cdFx0aWYgKG1vdmUpIHtcblx0XHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UubW92ZShtb2RlbHMubWFwKG1vZGVsID0+ICh7IGZpbGU6IHsgc291cmNlOiBtb2RlbC5zb3VyY2VNb2RlbC5yZXNvdXJjZSwgdGFyZ2V0OiBtb2RlbC50YXJnZXRNb2RlbC5yZXNvdXJjZSB9LCBvcHRpb25zOiB7IG92ZXJ3cml0ZTogdHJ1ZSB9IH0pKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY29weShtb2RlbHMubWFwKG1vZGVsID0+ICh7IGZpbGU6IHsgc291cmNlOiBtb2RlbC5zb3VyY2VNb2RlbC5yZXNvdXJjZSwgdGFyZ2V0OiBtb2RlbC50YXJnZXRNb2RlbC5yZXNvdXJjZSB9LCBvcHRpb25zOiB7IG92ZXJ3cml0ZTogdHJ1ZSB9IH0pKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtb2RlbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHsgc291cmNlTW9kZWwsIHRhcmdldE1vZGVsIH0gPSBtb2RlbHNbaV07XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXRNb2RlbC50ZXh0RWRpdG9yTW9kZWwhLmdldFZhbHVlKCksICdmb28nICsgaSk7XG5cblx0XHRcdGlmIChtb3ZlKSB7XG5cdFx0XHRcdGFzc2VydC5vayghYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmlzRGlydHkoc291cmNlTW9kZWwucmVzb3VyY2UpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5vayhhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuaXNEaXJ0eShzb3VyY2VNb2RlbC5yZXNvdXJjZSkpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5pc0RpcnR5KHRhcmdldE1vZGVsLnJlc291cmNlKSk7XG5cblx0XHRcdHNvdXJjZU1vZGVsLmRpc3Bvc2UoKTtcblx0XHRcdHRhcmdldE1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMyk7XG5cblx0XHRwYXJ0aWNpcGFudC5kaXNwb3NlKCk7XG5cdFx0bGlzdGVuZXIxLmRpc3Bvc2UoKTtcblx0XHRsaXN0ZW5lcjIuZGlzcG9zZSgpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdERlbGV0ZShyZXNvdXJjZXM6IFVSSVtdKSB7XG5cblx0XHRjb25zdCBtb2RlbHMgPSBhd2FpdCBQcm9taXNlLmFsbChyZXNvdXJjZXMubWFwKGFzeW5jIHJlc291cmNlID0+IHtcblx0XHRcdGNvbnN0IG1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgcmVzb3VyY2UsICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHRcdCg8SVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcj5hY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMpLmFkZChtb2RlbC5yZXNvdXJjZSwgbW9kZWwpO1xuXG5cdFx0XHRhd2FpdCBtb2RlbC5yZXNvbHZlKCk7XG5cdFx0XHRtb2RlbC50ZXh0RWRpdG9yTW9kZWwhLnNldFZhbHVlKCdmb28nKTtcblx0XHRcdGFzc2VydC5vayhhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuaXNEaXJ0eShtb2RlbC5yZXNvdXJjZSkpO1xuXHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdH0pKTtcblxuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXHRcdGxldCBjb3JyZWxhdGlvbklkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBwYXJ0aWNpcGFudCA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuYWRkRmlsZU9wZXJhdGlvblBhcnRpY2lwYW50KHtcblx0XHRcdHBhcnRpY2lwYXRlOiBhc3luYyAoZmlsZXMsIG9wZXJhdGlvbikgPT4ge1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1vZGVscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxzW2ldO1xuXHRcdFx0XHRcdGNvbnN0IGZpbGUgPSBmaWxlc1tpXTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZS50YXJnZXQudG9TdHJpbmcoKSwgbW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5ERUxFVEUpO1xuXHRcdFx0XHRldmVudENvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyMSA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25XaWxsUnVuV29ya2luZ0NvcHlGaWxlT3BlcmF0aW9uKGUgPT4ge1xuXHRcdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBtb2RlbHMubGVuZ3RoOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBtb2RlbHNbaV07XG5cdFx0XHRcdGNvbnN0IGZpbGUgPSBlLmZpbGVzW2ldO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZS50YXJnZXQudG9TdHJpbmcoKSwgbW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHR9XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5vcGVyYXRpb24sIEZpbGVPcGVyYXRpb24uREVMRVRFKTtcblx0XHRcdGNvcnJlbGF0aW9uSWQgPSBlLmNvcnJlbGF0aW9uSWQ7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KTtcblxuXHRcdGNvbnN0IGxpc3RlbmVyMiA9IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2Uub25EaWRSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IG1vZGVscy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IG1vZGVsc1tpXTtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IGUuZmlsZXNbaV07XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlLnRhcmdldC50b1N0cmluZygpLCBtb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdH1cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLm9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5ERUxFVEUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuY29ycmVsYXRpb25JZCwgY29ycmVsYXRpb25JZCk7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KTtcblxuXHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuZGVsZXRlKG1vZGVscy5tYXAobW9kZWwgPT4gKHsgcmVzb3VyY2U6IG1vZGVsLnJlc291cmNlIH0pKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0Zm9yIChjb25zdCBtb2RlbCBvZiBtb2RlbHMpIHtcblx0XHRcdGFzc2VydC5vayghYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UpKTtcblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudGVyLCAzKTtcblxuXHRcdHBhcnRpY2lwYW50LmRpc3Bvc2UoKTtcblx0XHRsaXN0ZW5lcjEuZGlzcG9zZSgpO1xuXHRcdGxpc3RlbmVyMi5kaXNwb3NlKCk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB0ZXN0Q3JlYXRlKHJlc291cmNlOiBVUkksIGNvbnRlbnRzOiBWU0J1ZmZlcikge1xuXHRcdGNvbnN0IG1vZGVsID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgcmVzb3VyY2UsICd1dGY4JywgdW5kZWZpbmVkKTtcblx0XHQoPElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKS5hZGQobW9kZWwucmVzb3VyY2UsIG1vZGVsKTtcblxuXHRcdGF3YWl0IG1vZGVsLnJlc29sdmUoKTtcblx0XHRtb2RlbC50ZXh0RWRpdG9yTW9kZWwhLnNldFZhbHVlKCdmb28nKTtcblx0XHRhc3NlcnQub2soYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UpKTtcblxuXHRcdGxldCBldmVudENvdW50ZXIgPSAwO1xuXHRcdGxldCBjb3JyZWxhdGlvbklkOiBudW1iZXIgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5hZGRGaWxlT3BlcmF0aW9uUGFydGljaXBhbnQoe1xuXHRcdFx0cGFydGljaXBhdGU6IGFzeW5jIChmaWxlcywgb3BlcmF0aW9uKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlcy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRjb25zdCBmaWxlID0gZmlsZXNbMF07XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlLnRhcmdldC50b1N0cmluZygpLCBtb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5DUkVBVEUpO1xuXHRcdFx0XHRldmVudENvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5vbldpbGxSdW5Xb3JraW5nQ29weUZpbGVPcGVyYXRpb24oZSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5maWxlcy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgZmlsZSA9IGUuZmlsZXNbMF07XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZS50YXJnZXQudG9TdHJpbmcoKSwgbW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5vcGVyYXRpb24sIEZpbGVPcGVyYXRpb24uQ1JFQVRFKTtcblx0XHRcdGNvcnJlbGF0aW9uSWQgPSBlLmNvcnJlbGF0aW9uSWQ7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5vbkRpZFJ1bldvcmtpbmdDb3B5RmlsZU9wZXJhdGlvbihlID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLmZpbGVzLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBmaWxlID0gZS5maWxlc1swXTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlLnRhcmdldC50b1N0cmluZygpLCBtb2RlbC5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlLm9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5DUkVBVEUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuY29ycmVsYXRpb25JZCwgY29ycmVsYXRpb25JZCk7XG5cdFx0XHRldmVudENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRhd2FpdCBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLmNyZWF0ZShbeyByZXNvdXJjZSwgY29udGVudHMgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5vayghYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmlzRGlydHkobW9kZWwucmVzb3VyY2UpKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRDb3VudGVyLCAzKTtcblx0fVxuXG5cdGVuc3Vy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
