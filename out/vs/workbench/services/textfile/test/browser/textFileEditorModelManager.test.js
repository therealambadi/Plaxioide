import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { workbenchInstantiationService, TestServiceAccessor } from "../../../../test/browser/workbenchTestServices.js";
import { TextFileEditorModel } from "../../common/textFileEditorModel.js";
import { FileChangesEvent, FileChangeType, FileOperationError, FileOperationResult } from "../../../../../platform/files/common/files.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { createTextBufferFactory } from "../../../../../editor/common/model/textModel.js";
import { timeout } from "../../../../../base/common/async.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
suite("Files - TextFileEditorModelManager", () => {
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    disposables.add(toDisposable(() => accessor.textFileService.files));
  });
  teardown(() => {
    disposables.clear();
  });
  test("add, remove, clear, get, getAll", function() {
    const manager = accessor.textFileService.files;
    const model1 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random1.txt"), "utf8", void 0));
    const model2 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random2.txt"), "utf8", void 0));
    const model3 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random3.txt"), "utf8", void 0));
    manager.add(URI.file("/test.html"), model1);
    manager.add(URI.file("/some/other.html"), model2);
    manager.add(URI.file("/some/this.txt"), model3);
    const fileUpper = URI.file("/TEST.html");
    assert(!manager.get(URI.file("foo")));
    assert.strictEqual(manager.get(URI.file("/test.html")), model1);
    assert.ok(!manager.get(fileUpper));
    let results = manager.models;
    assert.strictEqual(3, results.length);
    let result = manager.get(URI.file("/yes"));
    assert.ok(!result);
    result = manager.get(URI.file("/some/other.txt"));
    assert.ok(!result);
    result = manager.get(URI.file("/some/other.html"));
    assert.ok(result);
    result = manager.get(fileUpper);
    assert.ok(!result);
    manager.remove(URI.file(""));
    results = manager.models;
    assert.strictEqual(3, results.length);
    manager.remove(URI.file("/some/other.html"));
    results = manager.models;
    assert.strictEqual(2, results.length);
    manager.remove(fileUpper);
    results = manager.models;
    assert.strictEqual(2, results.length);
    manager.dispose();
    results = manager.models;
    assert.strictEqual(0, results.length);
  });
  test("resolve", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/test.html");
    const encoding = "utf8";
    const events = [];
    disposables.add(manager.onDidCreate((model) => {
      events.push(model);
    }));
    const modelPromise = manager.resolve(resource, { encoding });
    assert.ok(manager.get(resource));
    const model1 = await modelPromise;
    assert.ok(model1);
    assert.strictEqual(model1.getEncoding(), encoding);
    assert.strictEqual(manager.get(resource), model1);
    const model2 = await manager.resolve(resource, { encoding });
    assert.strictEqual(model2, model1);
    model1.dispose();
    const model3 = await manager.resolve(resource, { encoding });
    assert.notStrictEqual(model3, model2);
    assert.strictEqual(manager.get(resource), model3);
    model3.dispose();
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].resource.toString(), model1.resource.toString());
    assert.strictEqual(events[1].resource.toString(), model2.resource.toString());
  });
  test("resolve (async)", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    let didResolve = false;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve();
        }
      }));
    });
    manager.resolve(resource, { reload: { async: true } });
    await onDidResolve;
    assert.strictEqual(didResolve, true);
  });
  test("resolve (sync)", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    let didResolve = false;
    disposables.add(manager.onDidResolve(({ model }) => {
      if (model.resource.toString() === resource.toString()) {
        didResolve = true;
      }
    }));
    await manager.resolve(resource, { reload: { async: false } });
    assert.strictEqual(didResolve, true);
  });
  test("resolve (sync) - model disposed when error and first call to resolve", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    accessor.textFileService.setReadStreamErrorOnce(new FileOperationError("fail", FileOperationResult.FILE_OTHER_ERROR));
    let error = void 0;
    try {
      disposables.add(await manager.resolve(resource));
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.strictEqual(manager.models.length, 0);
  });
  test("resolve (sync) - model not disposed when error and model existed before", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    accessor.textFileService.setReadStreamErrorOnce(new FileOperationError("fail", FileOperationResult.FILE_OTHER_ERROR));
    let error = void 0;
    try {
      disposables.add(await manager.resolve(resource, { reload: { async: false } }));
    } catch (e) {
      error = e;
    }
    assert.ok(error);
    assert.strictEqual(manager.models.length, 1);
  });
  test("resolve with initial contents", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/test.html");
    const model = disposables.add(await manager.resolve(resource, { contents: createTextBufferFactory("Hello World") }));
    assert.strictEqual(model.textEditorModel?.getValue(), "Hello World");
    assert.strictEqual(model.isDirty(), true);
    disposables.add(await manager.resolve(resource, { contents: createTextBufferFactory("More Changes") }));
    assert.strictEqual(model.textEditorModel?.getValue(), "More Changes");
    assert.strictEqual(model.isDirty(), true);
  });
  test("multiple resolves execute in sequence", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/test.html");
    let resolvedModel;
    const contents = [];
    disposables.add(manager.onDidResolve((e) => {
      if (e.model.resource.toString() === resource.toString()) {
        resolvedModel = disposables.add(e.model);
        contents.push(e.model.textEditorModel.getValue());
      }
    }));
    await Promise.all([
      manager.resolve(resource),
      manager.resolve(resource, { contents: createTextBufferFactory("Hello World") }),
      manager.resolve(resource, { reload: { async: false } }),
      manager.resolve(resource, { contents: createTextBufferFactory("More Changes") })
    ]);
    assert.ok(resolvedModel instanceof TextFileEditorModel);
    assert.strictEqual(resolvedModel.textEditorModel?.getValue(), "More Changes");
    assert.strictEqual(resolvedModel.isDirty(), true);
    assert.strictEqual(contents[0], "Hello Html");
    assert.strictEqual(contents[1], "Hello World");
    assert.strictEqual(contents[2], "More Changes");
  });
  test("removed from cache when model disposed", function() {
    const manager = accessor.textFileService.files;
    const model1 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random1.txt"), "utf8", void 0));
    const model2 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random2.txt"), "utf8", void 0));
    const model3 = disposables.add(instantiationService.createInstance(TextFileEditorModel, toResource.call(this, "/path/random3.txt"), "utf8", void 0));
    manager.add(URI.file("/test.html"), model1);
    manager.add(URI.file("/some/other.html"), model2);
    manager.add(URI.file("/some/this.txt"), model3);
    assert.strictEqual(manager.get(URI.file("/test.html")), model1);
    model1.dispose();
    assert(!manager.get(URI.file("/test.html")));
  });
  test("events", async function() {
    const manager = accessor.textFileService.files;
    const resource1 = toResource.call(this, "/path/index.txt");
    const resource2 = toResource.call(this, "/path/other.txt");
    let resolvedCounter = 0;
    let removedCounter = 0;
    let gotDirtyCounter = 0;
    let gotNonDirtyCounter = 0;
    let revertedCounter = 0;
    let savedCounter = 0;
    let encodingCounter = 0;
    disposables.add(manager.onDidResolve(({ model }) => {
      if (model.resource.toString() === resource1.toString()) {
        resolvedCounter++;
      }
    }));
    disposables.add(manager.onDidRemove((resource) => {
      if (resource.toString() === resource1.toString() || resource.toString() === resource2.toString()) {
        removedCounter++;
      }
    }));
    disposables.add(manager.onDidChangeDirty((model) => {
      if (model.resource.toString() === resource1.toString()) {
        if (model.isDirty()) {
          gotDirtyCounter++;
        } else {
          gotNonDirtyCounter++;
        }
      }
    }));
    disposables.add(manager.onDidRevert((model) => {
      if (model.resource.toString() === resource1.toString()) {
        revertedCounter++;
      }
    }));
    disposables.add(manager.onDidSave(({ model }) => {
      if (model.resource.toString() === resource1.toString()) {
        savedCounter++;
      }
    }));
    disposables.add(manager.onDidChangeEncoding((model) => {
      if (model.resource.toString() === resource1.toString()) {
        encodingCounter++;
      }
    }));
    const model1 = await manager.resolve(resource1, { encoding: "utf8" });
    assert.strictEqual(resolvedCounter, 1);
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource: resource1, type: FileChangeType.DELETED }], false));
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource: resource1, type: FileChangeType.ADDED }], false));
    const model2 = await manager.resolve(resource2, { encoding: "utf8" });
    assert.strictEqual(resolvedCounter, 2);
    model1.updateTextEditorModel(createTextBufferFactory("changed"));
    model1.updatePreferredEncoding("utf16");
    await model1.revert();
    model1.updateTextEditorModel(createTextBufferFactory("changed again"));
    await model1.save();
    model1.dispose();
    model2.dispose();
    await model1.revert();
    assert.strictEqual(removedCounter, 2);
    assert.strictEqual(gotDirtyCounter, 2);
    assert.strictEqual(gotNonDirtyCounter, 2);
    assert.strictEqual(revertedCounter, 1);
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(encodingCounter, 2);
    model1.dispose();
    model2.dispose();
    assert.ok(!accessor.modelService.getModel(resource1));
    assert.ok(!accessor.modelService.getModel(resource2));
  });
  test("disposing model takes it out of the manager", async function() {
    const manager = accessor.textFileService.files;
    const resource = toResource.call(this, "/path/index_something.txt");
    const model = await manager.resolve(resource, { encoding: "utf8" });
    model.dispose();
    assert.ok(!manager.get(resource));
    assert.ok(!accessor.modelService.getModel(model.resource));
  });
  test("canDispose with dirty model", async function() {
    const manager = accessor.textFileService.files;
    const resource = toResource.call(this, "/path/index_something.txt");
    const model = disposables.add(await manager.resolve(resource, { encoding: "utf8" }));
    model.updateTextEditorModel(createTextBufferFactory("make dirty"));
    const canDisposePromise = manager.canDispose(model);
    assert.ok(canDisposePromise instanceof Promise);
    let canDispose = false;
    (async () => {
      canDispose = await canDisposePromise;
    })();
    assert.strictEqual(canDispose, false);
    model.revert({ soft: true });
    await timeout(0);
    assert.strictEqual(canDispose, true);
    const canDispose2 = manager.canDispose(model);
    assert.strictEqual(canDispose2, true);
  });
  test("language", async function() {
    const languageId = "text-file-model-manager-test";
    disposables.add(accessor.languageService.registerLanguage({
      id: languageId
    }));
    const manager = accessor.textFileService.files;
    const resource = toResource.call(this, "/path/index_something.txt");
    let model = disposables.add(await manager.resolve(resource, { languageId }));
    assert.strictEqual(model.textEditorModel.getLanguageId(), languageId);
    model = await manager.resolve(resource, { languageId: "text" });
    assert.strictEqual(model.textEditorModel.getLanguageId(), PLAINTEXT_LANGUAGE_ID);
  });
  test("file change events trigger reload (on a resolved model)", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    let didResolve = false;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve();
        }
      }));
    });
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
    await onDidResolve;
    assert.strictEqual(didResolve, true);
  });
  test("file change events trigger reload (after a model is resolved: https://github.com/microsoft/vscode/issues/132765)", async () => {
    const manager = accessor.textFileService.files;
    const resource = URI.file("/path/index.txt");
    manager.resolve(resource);
    let didResolve = false;
    let resolvedCounter = 0;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        disposables.add(model);
        if (model.resource.toString() === resource.toString()) {
          resolvedCounter++;
          if (resolvedCounter === 2) {
            didResolve = true;
            resolve();
          }
        }
      }));
    });
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
    await onDidResolve;
    assert.strictEqual(didResolve, true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dGZpbGUvdGVzdC9icm93c2VyL3RleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdFNlcnZpY2VBY2Nlc3NvciwgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVGV4dEZpbGVFZGl0b3JNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsLmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VzRXZlbnQsIEZpbGVDaGFuZ2VUeXBlLCBGaWxlT3BlcmF0aW9uRXJyb3IsIEZpbGVPcGVyYXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlLCB0b1Jlc291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBQTEFJTlRFWFRfTEFOR1VBR0VfSUQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9tb2Rlc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElUZXh0RmlsZUVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbnN1aXRlKCdGaWxlcyAtIFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTtcblx0bGV0IGFjY2Vzc29yOiBUZXN0U2VydmljZUFjY2Vzc29yO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMgYXMgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcikpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgnYWRkLCByZW1vdmUsIGNsZWFyLCBnZXQsIGdldEFsbCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cblx0XHRjb25zdCBtb2RlbDE6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9yYW5kb20xLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXHRcdGNvbnN0IG1vZGVsMjogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL3JhbmRvbTIudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cdFx0Y29uc3QgbW9kZWwzOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvcmFuZG9tMy50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblxuXHRcdG1hbmFnZXIuYWRkKFVSSS5maWxlKCcvdGVzdC5odG1sJyksIG1vZGVsMSk7XG5cdFx0bWFuYWdlci5hZGQoVVJJLmZpbGUoJy9zb21lL290aGVyLmh0bWwnKSwgbW9kZWwyKTtcblx0XHRtYW5hZ2VyLmFkZChVUkkuZmlsZSgnL3NvbWUvdGhpcy50eHQnKSwgbW9kZWwzKTtcblxuXHRcdGNvbnN0IGZpbGVVcHBlciA9IFVSSS5maWxlKCcvVEVTVC5odG1sJyk7XG5cblx0XHRhc3NlcnQoIW1hbmFnZXIuZ2V0KFVSSS5maWxlKCdmb28nKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLmdldChVUkkuZmlsZSgnL3Rlc3QuaHRtbCcpKSwgbW9kZWwxKTtcblxuXHRcdGFzc2VydC5vayghbWFuYWdlci5nZXQoZmlsZVVwcGVyKSk7XG5cblx0XHRsZXQgcmVzdWx0cyA9IG1hbmFnZXIubW9kZWxzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCByZXN1bHRzLmxlbmd0aCk7XG5cblx0XHRsZXQgcmVzdWx0ID0gbWFuYWdlci5nZXQoVVJJLmZpbGUoJy95ZXMnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZXN1bHQpO1xuXG5cdFx0cmVzdWx0ID0gbWFuYWdlci5nZXQoVVJJLmZpbGUoJy9zb21lL290aGVyLnR4dCcpKTtcblx0XHRhc3NlcnQub2soIXJlc3VsdCk7XG5cblx0XHRyZXN1bHQgPSBtYW5hZ2VyLmdldChVUkkuZmlsZSgnL3NvbWUvb3RoZXIuaHRtbCcpKTtcblx0XHRhc3NlcnQub2socmVzdWx0KTtcblxuXHRcdHJlc3VsdCA9IG1hbmFnZXIuZ2V0KGZpbGVVcHBlcik7XG5cdFx0YXNzZXJ0Lm9rKCFyZXN1bHQpO1xuXG5cdFx0bWFuYWdlci5yZW1vdmUoVVJJLmZpbGUoJycpKTtcblxuXHRcdHJlc3VsdHMgPSBtYW5hZ2VyLm1vZGVscztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMywgcmVzdWx0cy5sZW5ndGgpO1xuXG5cdFx0bWFuYWdlci5yZW1vdmUoVVJJLmZpbGUoJy9zb21lL290aGVyLmh0bWwnKSk7XG5cdFx0cmVzdWx0cyA9IG1hbmFnZXIubW9kZWxzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgyLCByZXN1bHRzLmxlbmd0aCk7XG5cblx0XHRtYW5hZ2VyLnJlbW92ZShmaWxlVXBwZXIpO1xuXHRcdHJlc3VsdHMgPSBtYW5hZ2VyLm1vZGVscztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMiwgcmVzdWx0cy5sZW5ndGgpO1xuXG5cdFx0bWFuYWdlci5kaXNwb3NlKCk7XG5cdFx0cmVzdWx0cyA9IG1hbmFnZXIubW9kZWxzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgwLCByZXN1bHRzLmxlbmd0aCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKTtcblx0XHRjb25zdCBlbmNvZGluZyA9ICd1dGY4JztcblxuXHRcdGNvbnN0IGV2ZW50czogSVRleHRGaWxlRWRpdG9yTW9kZWxbXSA9IFtdO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkQ3JlYXRlKG1vZGVsID0+IHtcblx0XHRcdGV2ZW50cy5wdXNoKG1vZGVsKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlbFByb21pc2UgPSBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgZW5jb2RpbmcgfSk7XG5cdFx0YXNzZXJ0Lm9rKG1hbmFnZXIuZ2V0KHJlc291cmNlKSk7IC8vIG1vZGVsIGtub3duIGV2ZW4gYmVmb3JlIHJlc29sdmVkKClcblxuXHRcdGNvbnN0IG1vZGVsMSA9IGF3YWl0IG1vZGVsUHJvbWlzZTtcblx0XHRhc3NlcnQub2sobW9kZWwxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwxLmdldEVuY29kaW5nKCksIGVuY29kaW5nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci5nZXQocmVzb3VyY2UpLCBtb2RlbDEpO1xuXG5cdFx0Y29uc3QgbW9kZWwyID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IGVuY29kaW5nIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbDIsIG1vZGVsMSk7XG5cdFx0bW9kZWwxLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IG1vZGVsMyA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyBlbmNvZGluZyB9KTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwobW9kZWwzLCBtb2RlbDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLmdldChyZXNvdXJjZSksIG1vZGVsMyk7XG5cdFx0bW9kZWwzLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzWzBdLnJlc291cmNlLnRvU3RyaW5nKCksIG1vZGVsMS5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzWzFdLnJlc291cmNlLnRvU3RyaW5nKCksIG1vZGVsMi5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAoYXN5bmMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1hbmFnZXIgPSBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMgYXMgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcjtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9pbmRleC50eHQnKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UpKTtcblxuXHRcdGxldCBkaWRSZXNvbHZlID0gZmFsc2U7XG5cdFx0Y29uc3Qgb25EaWRSZXNvbHZlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFJlc29sdmUoKHsgbW9kZWwgfSkgPT4ge1xuXHRcdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdGRpZFJlc29sdmUgPSB0cnVlO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0bWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IHJlbG9hZDogeyBhc3luYzogdHJ1ZSB9IH0pO1xuXG5cdFx0YXdhaXQgb25EaWRSZXNvbHZlO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZFJlc29sdmUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIChzeW5jKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXgudHh0Jyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKSk7XG5cblx0XHRsZXQgZGlkUmVzb2x2ZSA9IGZhbHNlO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkUmVzb2x2ZSgoeyBtb2RlbCB9KSA9PiB7XG5cdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRkaWRSZXNvbHZlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgcmVsb2FkOiB7IGFzeW5jOiBmYWxzZSB9IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRSZXNvbHZlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAoc3luYykgLSBtb2RlbCBkaXNwb3NlZCB3aGVuIGVycm9yIGFuZCBmaXJzdCBjYWxsIHRvIHJlc29sdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLnNldFJlYWRTdHJlYW1FcnJvck9uY2UobmV3IEZpbGVPcGVyYXRpb25FcnJvcignZmFpbCcsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9PVEhFUl9FUlJPUikpO1xuXG5cdFx0bGV0IGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSkpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGVycm9yID0gZTtcblx0XHR9XG5cblx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLm1vZGVscy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIChzeW5jKSAtIG1vZGVsIG5vdCBkaXNwb3NlZCB3aGVuIGVycm9yIGFuZCBtb2RlbCBleGlzdGVkIGJlZm9yZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXgudHh0Jyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKSk7XG5cblx0XHRhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2Uuc2V0UmVhZFN0cmVhbUVycm9yT25jZShuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCdmYWlsJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX09USEVSX0VSUk9SKSk7XG5cblx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZXJyb3IgPSBlO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhlcnJvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIubW9kZWxzLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgd2l0aCBpbml0aWFsIGNvbnRlbnRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1hbmFnZXIgPSBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMgYXMgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcjtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvdGVzdC5odG1sJyk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgY29udGVudHM6IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdIZWxsbyBXb3JsZCcpIH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsPy5nZXRWYWx1ZSgpLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgY29udGVudHM6IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdNb3JlIENoYW5nZXMnKSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnRleHRFZGl0b3JNb2RlbD8uZ2V0VmFsdWUoKSwgJ01vcmUgQ2hhbmdlcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pc0RpcnR5KCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXBsZSByZXNvbHZlcyBleGVjdXRlIGluIHNlcXVlbmNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1hbmFnZXIgPSBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMgYXMgSVRlc3RUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlcjtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvdGVzdC5odG1sJyk7XG5cblx0XHRsZXQgcmVzb2x2ZWRNb2RlbDogdW5rbm93bjtcblxuXHRcdGNvbnN0IGNvbnRlbnRzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkUmVzb2x2ZShlID0+IHtcblx0XHRcdGlmIChlLm1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0cmVzb2x2ZWRNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChlLm1vZGVsIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpO1xuXHRcdFx0XHRjb250ZW50cy5wdXNoKGUubW9kZWwudGV4dEVkaXRvck1vZGVsIS5nZXRWYWx1ZSgpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UpLFxuXHRcdFx0bWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IGNvbnRlbnRzOiBjcmVhdGVUZXh0QnVmZmVyRmFjdG9yeSgnSGVsbG8gV29ybGQnKSB9KSxcblx0XHRcdG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyByZWxvYWQ6IHsgYXN5bmM6IGZhbHNlIH0gfSksXG5cdFx0XHRtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgY29udGVudHM6IGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdNb3JlIENoYW5nZXMnKSB9KVxuXHRcdF0pO1xuXG5cdFx0YXNzZXJ0Lm9rKHJlc29sdmVkTW9kZWwgaW5zdGFuY2VvZiBUZXh0RmlsZUVkaXRvck1vZGVsKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZE1vZGVsLnRleHRFZGl0b3JNb2RlbD8uZ2V0VmFsdWUoKSwgJ01vcmUgQ2hhbmdlcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZE1vZGVsLmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudHNbMF0sICdIZWxsbyBIdG1sJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRlbnRzWzFdLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudHNbMl0sICdNb3JlIENoYW5nZXMnKTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlZCBmcm9tIGNhY2hlIHdoZW4gbW9kZWwgZGlzcG9zZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXG5cdFx0Y29uc3QgbW9kZWwxOiBUZXh0RmlsZUVkaXRvck1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRleHRGaWxlRWRpdG9yTW9kZWwsIHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvcmFuZG9tMS50eHQnKSwgJ3V0ZjgnLCB1bmRlZmluZWQpKTtcblx0XHRjb25zdCBtb2RlbDI6IFRleHRGaWxlRWRpdG9yTW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGV4dEZpbGVFZGl0b3JNb2RlbCwgdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9yYW5kb20yLnR4dCcpLCAndXRmOCcsIHVuZGVmaW5lZCkpO1xuXHRcdGNvbnN0IG1vZGVsMzogVGV4dEZpbGVFZGl0b3JNb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXh0RmlsZUVkaXRvck1vZGVsLCB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL3JhbmRvbTMudHh0JyksICd1dGY4JywgdW5kZWZpbmVkKSk7XG5cblx0XHRtYW5hZ2VyLmFkZChVUkkuZmlsZSgnL3Rlc3QuaHRtbCcpLCBtb2RlbDEpO1xuXHRcdG1hbmFnZXIuYWRkKFVSSS5maWxlKCcvc29tZS9vdGhlci5odG1sJyksIG1vZGVsMik7XG5cdFx0bWFuYWdlci5hZGQoVVJJLmZpbGUoJy9zb21lL3RoaXMudHh0JyksIG1vZGVsMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci5nZXQoVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKSksIG1vZGVsMSk7XG5cblx0XHRtb2RlbDEuZGlzcG9zZSgpO1xuXHRcdGFzc2VydCghbWFuYWdlci5nZXQoVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UxID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleC50eHQnKTtcblx0XHRjb25zdCByZXNvdXJjZTIgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL290aGVyLnR4dCcpO1xuXG5cdFx0bGV0IHJlc29sdmVkQ291bnRlciA9IDA7XG5cdFx0bGV0IHJlbW92ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgZ290RGlydHlDb3VudGVyID0gMDtcblx0XHRsZXQgZ290Tm9uRGlydHlDb3VudGVyID0gMDtcblx0XHRsZXQgcmV2ZXJ0ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgc2F2ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgZW5jb2RpbmdDb3VudGVyID0gMDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkUmVzb2x2ZSgoeyBtb2RlbCB9KSA9PiB7XG5cdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0cmVzb2x2ZWRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZW1vdmUocmVzb3VyY2UgPT4ge1xuXHRcdFx0aWYgKHJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMS50b1N0cmluZygpIHx8IHJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMi50b1N0cmluZygpKSB7XG5cdFx0XHRcdHJlbW92ZWRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRDaGFuZ2VEaXJ0eShtb2RlbCA9PiB7XG5cdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0aWYgKG1vZGVsLmlzRGlydHkoKSkge1xuXHRcdFx0XHRcdGdvdERpcnR5Q291bnRlcisrO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGdvdE5vbkRpcnR5Q291bnRlcisrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXZlcnQobW9kZWwgPT4ge1xuXHRcdFx0aWYgKG1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMS50b1N0cmluZygpKSB7XG5cdFx0XHRcdHJldmVydGVkQ291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkU2F2ZSgoeyBtb2RlbCB9KSA9PiB7XG5cdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0c2F2ZWRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRDaGFuZ2VFbmNvZGluZyhtb2RlbCA9PiB7XG5cdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0ZW5jb2RpbmdDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwxID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlMSwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZENvdW50ZXIsIDEpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVDaGFuZ2VzKG5ldyBGaWxlQ2hhbmdlc0V2ZW50KFt7IHJlc291cmNlOiByZXNvdXJjZTEsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfV0sIGZhbHNlKSk7XG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVDaGFuZ2VzKG5ldyBGaWxlQ2hhbmdlc0V2ZW50KFt7IHJlc291cmNlOiByZXNvdXJjZTEsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkFEREVEIH1dLCBmYWxzZSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwyID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlMiwgeyBlbmNvZGluZzogJ3V0ZjgnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZENvdW50ZXIsIDIpO1xuXG5cdFx0KG1vZGVsMSBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKS51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ2NoYW5nZWQnKSk7XG5cdFx0bW9kZWwxLnVwZGF0ZVByZWZlcnJlZEVuY29kaW5nKCd1dGYxNicpO1xuXG5cdFx0YXdhaXQgbW9kZWwxLnJldmVydCgpO1xuXHRcdChtb2RlbDEgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbCkudXBkYXRlVGV4dEVkaXRvck1vZGVsKGNyZWF0ZVRleHRCdWZmZXJGYWN0b3J5KCdjaGFuZ2VkIGFnYWluJykpO1xuXG5cdFx0YXdhaXQgbW9kZWwxLnNhdmUoKTtcblx0XHRtb2RlbDEuZGlzcG9zZSgpO1xuXHRcdG1vZGVsMi5kaXNwb3NlKCk7XG5cblx0XHRhd2FpdCBtb2RlbDEucmV2ZXJ0KCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlbW92ZWRDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ290RGlydHlDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ290Tm9uRGlydHlDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2ZXJ0ZWRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW5jb2RpbmdDb3VudGVyLCAyKTtcblxuXHRcdG1vZGVsMS5kaXNwb3NlKCk7XG5cdFx0bW9kZWwyLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZTEpKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLm1vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZTIpKTtcblx0fSk7XG5cblx0dGVzdCgnZGlzcG9zaW5nIG1vZGVsIHRha2VzIGl0IG91dCBvZiB0aGUgbWFuYWdlcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfc29tZXRoaW5nLnR4dCcpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgZW5jb2Rpbmc6ICd1dGY4JyB9KTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0Lm9rKCFtYW5hZ2VyLmdldChyZXNvdXJjZSkpO1xuXHRcdGFzc2VydC5vayghYWNjZXNzb3IubW9kZWxTZXJ2aWNlLmdldE1vZGVsKG1vZGVsLnJlc291cmNlKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbkRpc3Bvc2Ugd2l0aCBkaXJ0eSBtb2RlbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfc29tZXRoaW5nLnR4dCcpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IGVuY29kaW5nOiAndXRmOCcgfSkpO1xuXHRcdChtb2RlbCBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKS51cGRhdGVUZXh0RWRpdG9yTW9kZWwoY3JlYXRlVGV4dEJ1ZmZlckZhY3RvcnkoJ21ha2UgZGlydHknKSk7XG5cblx0XHRjb25zdCBjYW5EaXNwb3NlUHJvbWlzZSA9IG1hbmFnZXIuY2FuRGlzcG9zZShtb2RlbCBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKTtcblx0XHRhc3NlcnQub2soY2FuRGlzcG9zZVByb21pc2UgaW5zdGFuY2VvZiBQcm9taXNlKTtcblxuXHRcdGxldCBjYW5EaXNwb3NlID0gZmFsc2U7XG5cdFx0KGFzeW5jICgpID0+IHtcblx0XHRcdGNhbkRpc3Bvc2UgPSBhd2FpdCBjYW5EaXNwb3NlUHJvbWlzZTtcblx0XHR9KSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbkRpc3Bvc2UsIGZhbHNlKTtcblx0XHRtb2RlbC5yZXZlcnQoeyBzb2Z0OiB0cnVlIH0pO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5EaXNwb3NlLCB0cnVlKTtcblxuXHRcdGNvbnN0IGNhbkRpc3Bvc2UyID0gbWFuYWdlci5jYW5EaXNwb3NlKG1vZGVsIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5EaXNwb3NlMiwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xhbmd1YWdlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICd0ZXh0LWZpbGUtbW9kZWwtbWFuYWdlci10ZXN0Jztcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IubGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2Uoe1xuXHRcdFx0aWQ6IGxhbmd1YWdlSWQsXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2U6IFVSSSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXhfc29tZXRoaW5nLnR4dCcpO1xuXG5cdFx0bGV0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyBsYW5ndWFnZUlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsIS5nZXRMYW5ndWFnZUlkKCksIGxhbmd1YWdlSWQpO1xuXG5cdFx0bW9kZWwgPSBhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgbGFuZ3VhZ2VJZDogJ3RleHQnIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC50ZXh0RWRpdG9yTW9kZWwhLmdldExhbmd1YWdlSWQoKSwgUExBSU5URVhUX0xBTkdVQUdFX0lEKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsZSBjaGFuZ2UgZXZlbnRzIHRyaWdnZXIgcmVsb2FkIChvbiBhIHJlc29sdmVkIG1vZGVsKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtYW5hZ2VyID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzIGFzIElUZXN0VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXgudHh0Jyk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKSk7XG5cblx0XHRsZXQgZGlkUmVzb2x2ZSA9IGZhbHNlO1xuXHRcdGNvbnN0IG9uRGlkUmVzb2x2ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXNvbHZlKCh7IG1vZGVsIH0pID0+IHtcblx0XHRcdFx0aWYgKG1vZGVsLnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRkaWRSZXNvbHZlID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9XSwgZmFsc2UpKTtcblxuXHRcdGF3YWl0IG9uRGlkUmVzb2x2ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkUmVzb2x2ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgY2hhbmdlIGV2ZW50cyB0cmlnZ2VyIHJlbG9hZCAoYWZ0ZXIgYSBtb2RlbCBpcyByZXNvbHZlZDogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzMjc2NSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbWFuYWdlciA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcyBhcyBJVGVzdFRleHRGaWxlRWRpdG9yTW9kZWxNYW5hZ2VyO1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0bWFuYWdlci5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGxldCBkaWRSZXNvbHZlID0gZmFsc2U7XG5cdFx0bGV0IHJlc29sdmVkQ291bnRlciA9IDA7XG5cdFx0Y29uc3Qgb25EaWRSZXNvbHZlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFJlc29sdmUoKHsgbW9kZWwgfSkgPT4ge1xuXHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXHRcdFx0XHRpZiAobW9kZWwucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdHJlc29sdmVkQ291bnRlcisrO1xuXHRcdFx0XHRcdGlmIChyZXNvbHZlZENvdW50ZXIgPT09IDIpIHtcblx0XHRcdFx0XHRcdGRpZFJlc29sdmUgPSB0cnVlO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVDaGFuZ2VzKG5ldyBGaWxlQ2hhbmdlc0V2ZW50KFt7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEIH1dLCBmYWxzZSkpO1xuXG5cdFx0YXdhaXQgb25EaWRSZXNvbHZlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRSZXNvbHZlLCB0cnVlKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLFdBQVc7QUFFcEIsU0FBUywrQkFBK0IsMkJBQTREO0FBQ3BHLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsa0JBQWtCLGdCQUFnQixvQkFBb0IsMkJBQTJCO0FBQzFGLFNBQVMseUNBQXlDLGtCQUFrQjtBQUNwRSxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsb0JBQW9CO0FBRTlDLE1BQU0sc0NBQXNDLE1BQU07QUFFakQsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBQ3hDLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsMkJBQXVCLDhCQUE4QixRQUFXLFdBQVc7QUFDM0UsZUFBVyxxQkFBcUIsZUFBZSxtQkFBbUI7QUFDbEUsZ0JBQVksSUFBSSxhQUFhLE1BQU0sU0FBUyxnQkFBZ0IsS0FBd0MsQ0FBQztBQUFB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
