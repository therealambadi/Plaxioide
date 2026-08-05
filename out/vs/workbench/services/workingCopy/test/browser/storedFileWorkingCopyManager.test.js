import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { workbenchInstantiationService, TestServiceAccessor, TestWillShutdownEvent } from "../../../../test/browser/workbenchTestServices.js";
import { StoredFileWorkingCopyManager } from "../../common/storedFileWorkingCopyManager.js";
import { bufferToStream, VSBuffer } from "../../../../../base/common/buffer.js";
import { FileChangesEvent, FileChangeType, FileOperationError, FileOperationResult } from "../../../../../platform/files/common/files.js";
import { timeout } from "../../../../../base/common/async.js";
import { TestStoredFileWorkingCopyModelFactory } from "./storedFileWorkingCopy.test.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { InMemoryFileSystemProvider } from "../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { isWeb } from "../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("StoredFileWorkingCopyManager", () => {
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  let manager;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    manager = disposables.add(new StoredFileWorkingCopyManager(
      "testStoredFileWorkingCopyType",
      new TestStoredFileWorkingCopyModelFactory(),
      accessor.fileService,
      accessor.lifecycleService,
      accessor.labelService,
      accessor.logService,
      accessor.workingCopyFileService,
      accessor.workingCopyBackupService,
      accessor.uriIdentityService,
      accessor.filesConfigurationService,
      accessor.workingCopyService,
      accessor.notificationService,
      accessor.workingCopyEditorService,
      accessor.editorService,
      accessor.elevatedFileService,
      accessor.progressService
    ));
  });
  teardown(() => {
    for (const workingCopy of manager.workingCopies) {
      workingCopy.dispose();
    }
    disposables.clear();
  });
  test("resolve", async () => {
    const resource = URI.file("/test.html");
    const events = [];
    const listener = manager.onDidCreate((workingCopy) => {
      events.push(workingCopy);
    });
    const resolvePromise = manager.resolve(resource);
    assert.ok(manager.get(resource));
    assert.strictEqual(manager.workingCopies.length, 1);
    const workingCopy1 = await resolvePromise;
    assert.ok(workingCopy1);
    assert.ok(workingCopy1.model);
    assert.strictEqual(workingCopy1.typeId, "testStoredFileWorkingCopyType");
    assert.strictEqual(workingCopy1.resource.toString(), resource.toString());
    assert.strictEqual(manager.get(resource), workingCopy1);
    const workingCopy2 = await manager.resolve(resource);
    assert.strictEqual(workingCopy2, workingCopy1);
    assert.strictEqual(manager.workingCopies.length, 1);
    workingCopy1.dispose();
    const workingCopy3 = await manager.resolve(resource);
    assert.notStrictEqual(workingCopy3, workingCopy2);
    assert.strictEqual(manager.workingCopies.length, 1);
    assert.strictEqual(manager.get(resource), workingCopy3);
    workingCopy3.dispose();
    assert.strictEqual(manager.workingCopies.length, 0);
    assert.strictEqual(events.length, 2);
    assert.strictEqual(events[0].resource.toString(), workingCopy1.resource.toString());
    assert.strictEqual(events[1].resource.toString(), workingCopy2.resource.toString());
    listener.dispose();
    workingCopy1.dispose();
    workingCopy2.dispose();
    workingCopy3.dispose();
  });
  test("resolve (async)", async () => {
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    let didResolve = false;
    let onDidResolve = new Promise((resolve2) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model?.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve2();
        }
      }));
    });
    const resolve = manager.resolve(resource, { reload: { async: true } });
    await onDidResolve;
    assert.strictEqual(didResolve, true);
    didResolve = false;
    onDidResolve = new Promise((resolve2) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model?.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve2();
        }
      }));
    });
    manager.resolve(resource, { reload: { async: true, force: true } });
    await onDidResolve;
    assert.strictEqual(didResolve, true);
    disposables.add(await resolve);
  });
  test("resolve (sync)", async () => {
    const resource = URI.file("/path/index.txt");
    await manager.resolve(resource);
    let didResolve = false;
    disposables.add(manager.onDidResolve(({ model }) => {
      if (model?.resource.toString() === resource.toString()) {
        didResolve = true;
      }
    }));
    disposables.add(await manager.resolve(resource, { reload: { async: false } }));
    assert.strictEqual(didResolve, true);
    didResolve = false;
    disposables.add(await manager.resolve(resource, { reload: { async: false, force: true } }));
    assert.strictEqual(didResolve, true);
  });
  test("resolve (sync) - model disposed when error and first call to resolve", async () => {
    const resource = URI.file("/path/index.txt");
    accessor.fileService.readShouldThrowError = new FileOperationError("fail", FileOperationResult.FILE_OTHER_ERROR);
    try {
      let error = void 0;
      try {
        await manager.resolve(resource);
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.strictEqual(manager.workingCopies.length, 0);
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
  });
  test("resolve (sync) - model not disposed when error and model existed before", async () => {
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    accessor.fileService.readShouldThrowError = new FileOperationError("fail", FileOperationResult.FILE_OTHER_ERROR);
    try {
      let error = void 0;
      try {
        await manager.resolve(resource, { reload: { async: false } });
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.strictEqual(manager.workingCopies.length, 1);
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
  });
  test("resolve with initial contents", async () => {
    const resource = URI.file("/test.html");
    const workingCopy = await manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("Hello World")) });
    assert.strictEqual(workingCopy.model?.contents, "Hello World");
    assert.strictEqual(workingCopy.isDirty(), true);
    await manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("More Changes")) });
    assert.strictEqual(workingCopy.model?.contents, "More Changes");
    assert.strictEqual(workingCopy.isDirty(), true);
    workingCopy.dispose();
  });
  test("multiple resolves execute in sequence (same resources)", async () => {
    const resource = URI.file("/test.html");
    const firstPromise = manager.resolve(resource);
    const secondPromise = manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("Hello World")) });
    const thirdPromise = manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("More Changes")) });
    await firstPromise;
    await secondPromise;
    const workingCopy = await thirdPromise;
    assert.strictEqual(workingCopy.model?.contents, "More Changes");
    assert.strictEqual(workingCopy.isDirty(), true);
    workingCopy.dispose();
  });
  test("multiple resolves execute in parallel (different resources)", async () => {
    const resource1 = URI.file("/test1.html");
    const resource2 = URI.file("/test2.html");
    const resource3 = URI.file("/test3.html");
    const firstPromise = manager.resolve(resource1);
    const secondPromise = manager.resolve(resource2);
    const thirdPromise = manager.resolve(resource3);
    const [workingCopy1, workingCopy2, workingCopy3] = await Promise.all([firstPromise, secondPromise, thirdPromise]);
    assert.strictEqual(manager.workingCopies.length, 3);
    assert.strictEqual(workingCopy1.resource.toString(), resource1.toString());
    assert.strictEqual(workingCopy2.resource.toString(), resource2.toString());
    assert.strictEqual(workingCopy3.resource.toString(), resource3.toString());
    workingCopy1.dispose();
    workingCopy2.dispose();
    workingCopy3.dispose();
  });
  test("removed from cache when working copy or model gets disposed", async () => {
    const resource = URI.file("/test.html");
    let workingCopy = await manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("Hello World")) });
    assert.strictEqual(manager.get(URI.file("/test.html")), workingCopy);
    workingCopy.dispose();
    assert(!manager.get(URI.file("/test.html")));
    workingCopy = await manager.resolve(resource, { contents: bufferToStream(VSBuffer.fromString("Hello World")) });
    assert.strictEqual(manager.get(URI.file("/test.html")), workingCopy);
    workingCopy.model?.dispose();
    assert(!manager.get(URI.file("/test.html")));
  });
  test("events", async () => {
    const resource1 = URI.file("/path/index.txt");
    const resource2 = URI.file("/path/other.txt");
    let createdCounter = 0;
    let resolvedCounter = 0;
    let removedCounter = 0;
    let gotDirtyCounter = 0;
    let gotNonDirtyCounter = 0;
    let revertedCounter = 0;
    let savedCounter = 0;
    let saveErrorCounter = 0;
    disposables.add(manager.onDidCreate(() => {
      createdCounter++;
    }));
    disposables.add(manager.onDidRemove((resource) => {
      if (resource.toString() === resource1.toString() || resource.toString() === resource2.toString()) {
        removedCounter++;
      }
    }));
    disposables.add(manager.onDidResolve((workingCopy) => {
      if (workingCopy.resource.toString() === resource1.toString()) {
        resolvedCounter++;
      }
    }));
    disposables.add(manager.onDidChangeDirty((workingCopy) => {
      if (workingCopy.resource.toString() === resource1.toString()) {
        if (workingCopy.isDirty()) {
          gotDirtyCounter++;
        } else {
          gotNonDirtyCounter++;
        }
      }
    }));
    disposables.add(manager.onDidRevert((workingCopy) => {
      if (workingCopy.resource.toString() === resource1.toString()) {
        revertedCounter++;
      }
    }));
    let lastSaveEvent = void 0;
    disposables.add(manager.onDidSave((e) => {
      if (e.workingCopy.resource.toString() === resource1.toString()) {
        lastSaveEvent = e;
        savedCounter++;
      }
    }));
    disposables.add(manager.onDidSaveError((workingCopy) => {
      if (workingCopy.resource.toString() === resource1.toString()) {
        saveErrorCounter++;
      }
    }));
    const workingCopy1 = disposables.add(await manager.resolve(resource1));
    assert.strictEqual(resolvedCounter, 1);
    assert.strictEqual(createdCounter, 1);
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource: resource1, type: FileChangeType.DELETED }], false));
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource: resource1, type: FileChangeType.ADDED }], false));
    const workingCopy2 = disposables.add(await manager.resolve(resource2));
    assert.strictEqual(resolvedCounter, 2);
    assert.strictEqual(createdCounter, 2);
    workingCopy1.model?.updateContents("changed");
    await workingCopy1.revert();
    workingCopy1.model?.updateContents("changed again");
    await workingCopy1.save();
    try {
      accessor.fileService.writeShouldThrowError = new FileOperationError("write error", FileOperationResult.FILE_PERMISSION_DENIED);
      await workingCopy1.save({ force: true });
    } finally {
      accessor.fileService.writeShouldThrowError = void 0;
    }
    workingCopy1.dispose();
    workingCopy2.dispose();
    await workingCopy1.revert();
    assert.strictEqual(removedCounter, 2);
    assert.strictEqual(gotDirtyCounter, 3);
    assert.strictEqual(gotNonDirtyCounter, 2);
    assert.strictEqual(revertedCounter, 1);
    assert.strictEqual(savedCounter, 1);
    assert.strictEqual(lastSaveEvent.workingCopy, workingCopy1);
    assert.ok(lastSaveEvent.stat);
    assert.strictEqual(saveErrorCounter, 1);
    assert.strictEqual(createdCounter, 2);
    workingCopy1.dispose();
    workingCopy2.dispose();
  });
  test("resolve registers as working copy and dispose clears", async () => {
    const resource1 = URI.file("/test1.html");
    const resource2 = URI.file("/test2.html");
    const resource3 = URI.file("/test3.html");
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    const firstPromise = manager.resolve(resource1);
    const secondPromise = manager.resolve(resource2);
    const thirdPromise = manager.resolve(resource3);
    await Promise.all([firstPromise, secondPromise, thirdPromise]);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 3);
    assert.strictEqual(manager.workingCopies.length, 3);
    manager.dispose();
    assert.strictEqual(manager.workingCopies.length, 0);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 3);
    disposables.add(await firstPromise);
    disposables.add(await secondPromise);
    disposables.add(await thirdPromise);
  });
  test("destroy", async () => {
    const resource1 = URI.file("/test1.html");
    const resource2 = URI.file("/test2.html");
    const resource3 = URI.file("/test3.html");
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    const firstPromise = manager.resolve(resource1);
    const secondPromise = manager.resolve(resource2);
    const thirdPromise = manager.resolve(resource3);
    await Promise.all([firstPromise, secondPromise, thirdPromise]);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 3);
    assert.strictEqual(manager.workingCopies.length, 3);
    await manager.destroy();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    assert.strictEqual(manager.workingCopies.length, 0);
  });
  test("destroy saves dirty working copies", async () => {
    const resource = URI.file("/path/source.txt");
    const workingCopy = await manager.resolve(resource);
    let saved = false;
    disposables.add(workingCopy.onDidSave(() => {
      saved = true;
    }));
    workingCopy.model?.updateContents("hello create");
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 1);
    assert.strictEqual(manager.workingCopies.length, 1);
    await manager.destroy();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    assert.strictEqual(manager.workingCopies.length, 0);
    assert.strictEqual(saved, true);
  });
  test("destroy falls back to using backup when save fails", async () => {
    const resource = URI.file("/path/source.txt");
    const workingCopy = await manager.resolve(resource);
    workingCopy.model?.setThrowOnSnapshot();
    let unexpectedSave = false;
    disposables.add(workingCopy.onDidSave(() => {
      unexpectedSave = true;
    }));
    workingCopy.model?.updateContents("hello create");
    assert.strictEqual(workingCopy.isDirty(), true);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 1);
    assert.strictEqual(manager.workingCopies.length, 1);
    assert.strictEqual(accessor.workingCopyBackupService.resolved.has(workingCopy), true);
    await manager.destroy();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    assert.strictEqual(manager.workingCopies.length, 0);
    assert.strictEqual(unexpectedSave, false);
  });
  test("file change event triggers working copy resolve", async () => {
    const resource = URI.file("/path/index.txt");
    await manager.resolve(resource);
    let didResolve = false;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model?.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve();
        }
      }));
    });
    accessor.fileService.fireFileChanges(new FileChangesEvent([{ resource, type: FileChangeType.UPDATED }], false));
    await onDidResolve;
    assert.strictEqual(didResolve, true);
  });
  test("file change event triggers working copy resolve (when working copy is pending to resolve)", async () => {
    const resource = URI.file("/path/index.txt");
    manager.resolve(resource);
    let didResolve = false;
    let resolvedCounter = 0;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model?.resource.toString() === resource.toString()) {
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
  test("file system provider change triggers working copy resolve", async () => {
    const resource = URI.file("/path/index.txt");
    disposables.add(await manager.resolve(resource));
    let didResolve = false;
    const onDidResolve = new Promise((resolve) => {
      disposables.add(manager.onDidResolve(({ model }) => {
        if (model?.resource.toString() === resource.toString()) {
          didResolve = true;
          resolve();
        }
      }));
    });
    accessor.fileService.fireFileSystemProviderCapabilitiesChangeEvent({ provider: disposables.add(new InMemoryFileSystemProvider()), scheme: resource.scheme });
    await onDidResolve;
    assert.strictEqual(didResolve, true);
  });
  test("working copy file event handling: create", async () => {
    const resource = URI.file("/path/source.txt");
    const workingCopy = await manager.resolve(resource);
    workingCopy.model?.updateContents("hello create");
    assert.strictEqual(workingCopy.isDirty(), true);
    await accessor.workingCopyFileService.create([{ resource }], CancellationToken.None);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("working copy file event handling: move", () => {
    return testMoveCopyFileWorkingCopy(true);
  });
  test("working copy file event handling: copy", () => {
    return testMoveCopyFileWorkingCopy(false);
  });
  async function testMoveCopyFileWorkingCopy(move) {
    const source = URI.file("/path/source.txt");
    const target = URI.file("/path/other.txt");
    const sourceWorkingCopy = await manager.resolve(source);
    sourceWorkingCopy.model?.updateContents("hello move or copy");
    assert.strictEqual(sourceWorkingCopy.isDirty(), true);
    if (move) {
      await accessor.workingCopyFileService.move([{ file: { source, target } }], CancellationToken.None);
    } else {
      await accessor.workingCopyFileService.copy([{ file: { source, target } }], CancellationToken.None);
    }
    const targetWorkingCopy = await manager.resolve(target);
    assert.strictEqual(targetWorkingCopy.isDirty(), true);
    assert.strictEqual(targetWorkingCopy.model?.contents, "hello move or copy");
  }
  test("working copy file event handling: delete", async () => {
    const resource = URI.file("/path/source.txt");
    const workingCopy = await manager.resolve(resource);
    workingCopy.model?.updateContents("hello delete");
    assert.strictEqual(workingCopy.isDirty(), true);
    await accessor.workingCopyFileService.delete([{ resource }], CancellationToken.None);
    assert.strictEqual(workingCopy.isDirty(), false);
  });
  test("working copy file event handling: move to same resource", async () => {
    const source = URI.file("/path/source.txt");
    const sourceWorkingCopy = await manager.resolve(source);
    sourceWorkingCopy.model?.updateContents("hello move");
    assert.strictEqual(sourceWorkingCopy.isDirty(), true);
    await accessor.workingCopyFileService.move([{ file: { source, target: source } }], CancellationToken.None);
    assert.strictEqual(sourceWorkingCopy.isDirty(), true);
    assert.strictEqual(sourceWorkingCopy.model?.contents, "hello move");
  });
  test("canDispose with dirty working copy", async () => {
    const resource = URI.file("/path/index_something.txt");
    const workingCopy = await manager.resolve(resource);
    workingCopy.model?.updateContents("make dirty");
    const canDisposePromise = manager.canDispose(workingCopy);
    assert.ok(canDisposePromise instanceof Promise);
    let canDispose = false;
    (async () => {
      canDispose = await canDisposePromise;
    })();
    assert.strictEqual(canDispose, false);
    workingCopy.revert({ soft: true });
    await timeout(0);
    assert.strictEqual(canDispose, true);
    const canDispose2 = manager.canDispose(workingCopy);
    assert.strictEqual(canDispose2, true);
  });
  (isWeb ? test.skip : test)("pending saves join on shutdown", async () => {
    const resource1 = URI.file("/path/index_something1.txt");
    const resource2 = URI.file("/path/index_something2.txt");
    const workingCopy1 = disposables.add(await manager.resolve(resource1));
    workingCopy1.model?.updateContents("make dirty");
    const workingCopy2 = disposables.add(await manager.resolve(resource2));
    workingCopy2.model?.updateContents("make dirty");
    let saved1 = false;
    workingCopy1.save().then(() => {
      saved1 = true;
    });
    let saved2 = false;
    workingCopy2.save().then(() => {
      saved2 = true;
    });
    const event = new TestWillShutdownEvent();
    accessor.lifecycleService.fireWillShutdown(event);
    assert.ok(event.value.length > 0);
    await Promise.all(event.value);
    assert.strictEqual(saved1, true);
    assert.strictEqual(saved2, true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9icm93c2VyL3N0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0U2VydmljZUFjY2Vzc29yLCBUZXN0V2lsbFNodXRkb3duRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIsIElTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyLCBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5U2F2ZUV2ZW50IH0gZnJvbSAnLi4vLi4vY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXIuanMnO1xuaW1wb3J0IHsgSVN0b3JlZEZpbGVXb3JraW5nQ29weSwgSVN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3N0b3JlZEZpbGVXb3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBidWZmZXJUb1N0cmVhbSwgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZXNFdmVudCwgRmlsZUNoYW5nZVR5cGUsIEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5IH0gZnJvbSAnLi9zdG9yZWRGaWxlV29ya2luZ0NvcHkudGVzdC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuc3VpdGUoJ1N0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXInLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgYWNjZXNzb3I6IFRlc3RTZXJ2aWNlQWNjZXNzb3I7XG5cblx0bGV0IG1hbmFnZXI6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlNYW5hZ2VyPFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD47XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0YWNjZXNzb3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U2VydmljZUFjY2Vzc29yKTtcblxuXHRcdG1hbmFnZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFN0b3JlZEZpbGVXb3JraW5nQ29weU1hbmFnZXI8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPihcblx0XHRcdCd0ZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5VHlwZScsXG5cdFx0XHRuZXcgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeSgpLFxuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UsIGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UsIGFjY2Vzc29yLmxhYmVsU2VydmljZSwgYWNjZXNzb3IubG9nU2VydmljZSxcblx0XHRcdGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgYWNjZXNzb3IudXJpSWRlbnRpdHlTZXJ2aWNlLFxuXHRcdFx0YWNjZXNzb3IuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLCBhY2Nlc3Nvci5ub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0YWNjZXNzb3Iud29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lbGV2YXRlZEZpbGVTZXJ2aWNlLFxuXHRcdFx0YWNjZXNzb3IucHJvZ3Jlc3NTZXJ2aWNlXG5cdFx0KSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRmb3IgKGNvbnN0IHdvcmtpbmdDb3B5IG9mIG1hbmFnZXIud29ya2luZ0NvcGllcykge1xuXHRcdFx0d29ya2luZ0NvcHkuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBVUkkuZmlsZSgnL3Rlc3QuaHRtbCcpO1xuXG5cdFx0Y29uc3QgZXZlbnRzOiBJU3RvcmVkRmlsZVdvcmtpbmdDb3B5PElTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbD5bXSA9IFtdO1xuXHRcdGNvbnN0IGxpc3RlbmVyID0gbWFuYWdlci5vbkRpZENyZWF0ZSh3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRldmVudHMucHVzaCh3b3JraW5nQ29weSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXNvbHZlUHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKG1hbmFnZXIuZ2V0KHJlc291cmNlKSk7IC8vIHdvcmtpbmcgY29weSBrbm93biBldmVuIGJlZm9yZSByZXNvbHZlZCgpXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDEpO1xuXG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkxID0gYXdhaXQgcmVzb2x2ZVByb21pc2U7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtpbmdDb3B5MSk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtpbmdDb3B5MS5tb2RlbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS50eXBlSWQsICd0ZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5VHlwZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIuZ2V0KHJlc291cmNlKSwgd29ya2luZ0NvcHkxKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MiA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Miwgd29ya2luZ0NvcHkxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci53b3JraW5nQ29waWVzLmxlbmd0aCwgMSk7XG5cdFx0d29ya2luZ0NvcHkxLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MyA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Mywgd29ya2luZ0NvcHkyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci53b3JraW5nQ29waWVzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIuZ2V0KHJlc291cmNlKSwgd29ya2luZ0NvcHkzKTtcblx0XHR3b3JraW5nQ29weTMuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHNbMF0ucmVzb3VyY2UudG9TdHJpbmcoKSwgd29ya2luZ0NvcHkxLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHNbMV0ucmVzb3VyY2UudG9TdHJpbmcoKSwgd29ya2luZ0NvcHkyLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXG5cdFx0d29ya2luZ0NvcHkxLmRpc3Bvc2UoKTtcblx0XHR3b3JraW5nQ29weTIuZGlzcG9zZSgpO1xuXHRcdHdvcmtpbmdDb3B5My5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKGFzeW5jKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9pbmRleC50eHQnKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UpKTtcblxuXHRcdGxldCBkaWRSZXNvbHZlID0gZmFsc2U7XG5cdFx0bGV0IG9uRGlkUmVzb2x2ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXNvbHZlKCh7IG1vZGVsIH0pID0+IHtcblx0XHRcdFx0aWYgKG1vZGVsPy5yZXNvdXJjZS50b1N0cmluZygpID09PSByZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0ZGlkUmVzb2x2ZSA9IHRydWU7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cblx0XHRjb25zdCByZXNvbHZlID0gbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IHJlbG9hZDogeyBhc3luYzogdHJ1ZSB9IH0pO1xuXG5cdFx0YXdhaXQgb25EaWRSZXNvbHZlO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZFJlc29sdmUsIHRydWUpO1xuXG5cdFx0ZGlkUmVzb2x2ZSA9IGZhbHNlO1xuXG5cdFx0b25EaWRSZXNvbHZlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFJlc29sdmUoKHsgbW9kZWwgfSkgPT4ge1xuXHRcdFx0XHRpZiAobW9kZWw/LnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRkaWRSZXNvbHZlID0gdHJ1ZTtcblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyByZWxvYWQ6IHsgYXN5bmM6IHRydWUsIGZvcmNlOiB0cnVlIH0gfSk7XG5cblx0XHRhd2FpdCBvbkRpZFJlc29sdmU7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkUmVzb2x2ZSwgdHJ1ZSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgcmVzb2x2ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKHN5bmMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0YXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGxldCBkaWRSZXNvbHZlID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXNvbHZlKCh7IG1vZGVsIH0pID0+IHtcblx0XHRcdGlmIChtb2RlbD8ucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRkaWRSZXNvbHZlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZFJlc29sdmUsIHRydWUpO1xuXG5cdFx0ZGlkUmVzb2x2ZSA9IGZhbHNlO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyByZWxvYWQ6IHsgYXN5bmM6IGZhbHNlLCBmb3JjZTogdHJ1ZSB9IH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkUmVzb2x2ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKHN5bmMpIC0gbW9kZWwgZGlzcG9zZWQgd2hlbiBlcnJvciBhbmQgZmlyc3QgY2FsbCB0byByZXNvbHZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCdmYWlsJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX09USEVSX0VSUk9SKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0ZXJyb3IgPSBlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgKHN5bmMpIC0gbW9kZWwgbm90IGRpc3Bvc2VkIHdoZW4gZXJyb3IgYW5kIG1vZGVsIGV4aXN0ZWQgYmVmb3JlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSkpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UucmVhZFNob3VsZFRocm93RXJyb3IgPSBuZXcgRmlsZU9wZXJhdGlvbkVycm9yKCdmYWlsJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX09USEVSX0VSUk9SKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IHJlbG9hZDogeyBhc3luYzogZmFsc2UgfSB9KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0ZXJyb3IgPSBlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDEpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgd2l0aCBpbml0aWFsIGNvbnRlbnRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IGNvbnRlbnRzOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbyBXb3JsZCcpKSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnTW9yZSBDaGFuZ2VzJykpIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdNb3JlIENoYW5nZXMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgcmVzb2x2ZXMgZXhlY3V0ZSBpbiBzZXF1ZW5jZSAoc2FtZSByZXNvdXJjZXMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKTtcblxuXHRcdGNvbnN0IGZpcnN0UHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0Y29uc3Qgc2Vjb25kUHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8gV29ybGQnKSkgfSk7XG5cdFx0Y29uc3QgdGhpcmRQcm9taXNlID0gbWFuYWdlci5yZXNvbHZlKHJlc291cmNlLCB7IGNvbnRlbnRzOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCdNb3JlIENoYW5nZXMnKSkgfSk7XG5cblx0XHRhd2FpdCBmaXJzdFByb21pc2U7XG5cdFx0YXdhaXQgc2Vjb25kUHJvbWlzZTtcblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IHRoaXJkUHJvbWlzZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5tb2RlbD8uY29udGVudHMsICdNb3JlIENoYW5nZXMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgcmVzb2x2ZXMgZXhlY3V0ZSBpbiBwYXJhbGxlbCAoZGlmZmVyZW50IHJlc291cmNlcyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UxID0gVVJJLmZpbGUoJy90ZXN0MS5odG1sJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UyID0gVVJJLmZpbGUoJy90ZXN0Mi5odG1sJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UzID0gVVJJLmZpbGUoJy90ZXN0My5odG1sJyk7XG5cblx0XHRjb25zdCBmaXJzdFByb21pc2UgPSBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UxKTtcblx0XHRjb25zdCBzZWNvbmRQcm9taXNlID0gbWFuYWdlci5yZXNvbHZlKHJlc291cmNlMik7XG5cdFx0Y29uc3QgdGhpcmRQcm9taXNlID0gbWFuYWdlci5yZXNvbHZlKHJlc291cmNlMyk7XG5cblx0XHRjb25zdCBbd29ya2luZ0NvcHkxLCB3b3JraW5nQ29weTIsIHdvcmtpbmdDb3B5M10gPSBhd2FpdCBQcm9taXNlLmFsbChbZmlyc3RQcm9taXNlLCBzZWNvbmRQcm9taXNlLCB0aGlyZFByb21pc2VdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkxLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlMS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkyLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlMi50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkzLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlMy50b1N0cmluZygpKTtcblxuXHRcdHdvcmtpbmdDb3B5MS5kaXNwb3NlKCk7XG5cdFx0d29ya2luZ0NvcHkyLmRpc3Bvc2UoKTtcblx0XHR3b3JraW5nQ29weTMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdmVkIGZyb20gY2FjaGUgd2hlbiB3b3JraW5nIGNvcHkgb3IgbW9kZWwgZ2V0cyBkaXNwb3NlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvdGVzdC5odG1sJyk7XG5cblx0XHRsZXQgd29ya2luZ0NvcHkgPSBhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UsIHsgY29udGVudHM6IGJ1ZmZlclRvU3RyZWFtKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvIFdvcmxkJykpIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIuZ2V0KFVSSS5maWxlKCcvdGVzdC5odG1sJykpLCB3b3JraW5nQ29weSk7XG5cblx0XHR3b3JraW5nQ29weS5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0KCFtYW5hZ2VyLmdldChVUkkuZmlsZSgnL3Rlc3QuaHRtbCcpKSk7XG5cblx0XHR3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSwgeyBjb250ZW50czogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8gV29ybGQnKSkgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci5nZXQoVVJJLmZpbGUoJy90ZXN0Lmh0bWwnKSksIHdvcmtpbmdDb3B5KTtcblxuXHRcdHdvcmtpbmdDb3B5Lm1vZGVsPy5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0KCFtYW5hZ2VyLmdldChVUkkuZmlsZSgnL3Rlc3QuaHRtbCcpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZTEgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXgudHh0Jyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UyID0gVVJJLmZpbGUoJy9wYXRoL290aGVyLnR4dCcpO1xuXG5cdFx0bGV0IGNyZWF0ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgcmVzb2x2ZWRDb3VudGVyID0gMDtcblx0XHRsZXQgcmVtb3ZlZENvdW50ZXIgPSAwO1xuXHRcdGxldCBnb3REaXJ0eUNvdW50ZXIgPSAwO1xuXHRcdGxldCBnb3ROb25EaXJ0eUNvdW50ZXIgPSAwO1xuXHRcdGxldCByZXZlcnRlZENvdW50ZXIgPSAwO1xuXHRcdGxldCBzYXZlZENvdW50ZXIgPSAwO1xuXHRcdGxldCBzYXZlRXJyb3JDb3VudGVyID0gMDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkQ3JlYXRlKCgpID0+IHtcblx0XHRcdGNyZWF0ZWRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZW1vdmUocmVzb3VyY2UgPT4ge1xuXHRcdFx0aWYgKHJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMS50b1N0cmluZygpIHx8IHJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMi50b1N0cmluZygpKSB7XG5cdFx0XHRcdHJlbW92ZWRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXNvbHZlKHdvcmtpbmdDb3B5ID0+IHtcblx0XHRcdGlmICh3b3JraW5nQ29weS5yZXNvdXJjZS50b1N0cmluZygpID09PSByZXNvdXJjZTEudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRyZXNvbHZlZENvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZENoYW5nZURpcnR5KHdvcmtpbmdDb3B5ID0+IHtcblx0XHRcdGlmICh3b3JraW5nQ29weS5yZXNvdXJjZS50b1N0cmluZygpID09PSByZXNvdXJjZTEudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRpZiAod29ya2luZ0NvcHkuaXNEaXJ0eSgpKSB7XG5cdFx0XHRcdFx0Z290RGlydHlDb3VudGVyKys7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Z290Tm9uRGlydHlDb3VudGVyKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFJldmVydCh3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRpZiAod29ya2luZ0NvcHkucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0cmV2ZXJ0ZWRDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGxhc3RTYXZlRXZlbnQ6IElTdG9yZWRGaWxlV29ya2luZ0NvcHlTYXZlRXZlbnQ8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFNhdmUoKGUpID0+IHtcblx0XHRcdGlmIChlLndvcmtpbmdDb3B5LnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlMS50b1N0cmluZygpKSB7XG5cdFx0XHRcdGxhc3RTYXZlRXZlbnQgPSBlO1xuXHRcdFx0XHRzYXZlZENvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFNhdmVFcnJvcih3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRpZiAod29ya2luZ0NvcHkucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UxLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0c2F2ZUVycm9yQ291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UxKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVkQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWRDb3VudGVyLCAxKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZTogcmVzb3VyY2UxLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH1dLCBmYWxzZSkpO1xuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZTogcmVzb3VyY2UxLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9XSwgZmFsc2UpKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MiA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UyKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc29sdmVkQ291bnRlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZWRDb3VudGVyLCAyKTtcblxuXHRcdHdvcmtpbmdDb3B5MS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2NoYW5nZWQnKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5MS5yZXZlcnQoKTtcblx0XHR3b3JraW5nQ29weTEubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdjaGFuZ2VkIGFnYWluJyk7XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weTEuc2F2ZSgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndyaXRlU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBGaWxlT3BlcmF0aW9uRXJyb3IoJ3dyaXRlIGVycm9yJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX1BFUk1JU1NJT05fREVOSUVEKTtcblxuXHRcdFx0YXdhaXQgd29ya2luZ0NvcHkxLnNhdmUoeyBmb3JjZTogdHJ1ZSB9KTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHdvcmtpbmdDb3B5MS5kaXNwb3NlKCk7XG5cdFx0d29ya2luZ0NvcHkyLmRpc3Bvc2UoKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5MS5yZXZlcnQoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlZENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnb3REaXJ0eUNvdW50ZXIsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChnb3ROb25EaXJ0eUNvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZlcnRlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZENvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0U2F2ZUV2ZW50IS53b3JraW5nQ29weSwgd29ya2luZ0NvcHkxKTtcblx0XHRhc3NlcnQub2sobGFzdFNhdmVFdmVudCEuc3RhdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVFcnJvckNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjcmVhdGVkQ291bnRlciwgMik7XG5cblx0XHR3b3JraW5nQ29weTEuZGlzcG9zZSgpO1xuXHRcdHdvcmtpbmdDb3B5Mi5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgcmVnaXN0ZXJzIGFzIHdvcmtpbmcgY29weSBhbmQgZGlzcG9zZSBjbGVhcnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UxID0gVVJJLmZpbGUoJy90ZXN0MS5odG1sJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UyID0gVVJJLmZpbGUoJy90ZXN0Mi5odG1sJyk7XG5cdFx0Y29uc3QgcmVzb3VyY2UzID0gVVJJLmZpbGUoJy90ZXN0My5odG1sJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblxuXHRcdGNvbnN0IGZpcnN0UHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZTEpO1xuXHRcdGNvbnN0IHNlY29uZFByb21pc2UgPSBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UyKTtcblx0XHRjb25zdCB0aGlyZFByb21pc2UgPSBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UzKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtmaXJzdFByb21pc2UsIHNlY29uZFByb21pc2UsIHRoaXJkUHJvbWlzZV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS53b3JraW5nQ29waWVzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDMpO1xuXG5cdFx0bWFuYWdlci5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci53b3JraW5nQ29waWVzLmxlbmd0aCwgMCk7XG5cblx0XHQvLyBkaXNwb3NlIGRvZXMgbm90IHJlbW92ZSBmcm9tIHdvcmtpbmcgY29weSBzZXJ2aWNlLCBvbmx5IGBkZXN0cm95YCBzaG91bGRcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAzKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhd2FpdCBmaXJzdFByb21pc2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChhd2FpdCBzZWNvbmRQcm9taXNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYXdhaXQgdGhpcmRQcm9taXNlKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzdHJveScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZTEgPSBVUkkuZmlsZSgnL3Rlc3QxLmh0bWwnKTtcblx0XHRjb25zdCByZXNvdXJjZTIgPSBVUkkuZmlsZSgnL3Rlc3QyLmh0bWwnKTtcblx0XHRjb25zdCByZXNvdXJjZTMgPSBVUkkuZmlsZSgnL3Rlc3QzLmh0bWwnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgZmlyc3RQcm9taXNlID0gbWFuYWdlci5yZXNvbHZlKHJlc291cmNlMSk7XG5cdFx0Y29uc3Qgc2Vjb25kUHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZTIpO1xuXHRcdGNvbnN0IHRoaXJkUHJvbWlzZSA9IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZTMpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2ZpcnN0UHJvbWlzZSwgc2Vjb25kUHJvbWlzZSwgdGhpcmRQcm9taXNlXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci53b3JraW5nQ29waWVzLmxlbmd0aCwgMyk7XG5cblx0XHRhd2FpdCBtYW5hZ2VyLmRlc3Ryb3koKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnZGVzdHJveSBzYXZlcyBkaXJ0eSB3b3JraW5nIGNvcGllcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9zb3VyY2UudHh0Jyk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cblx0XHRsZXQgc2F2ZWQgPSBmYWxzZTtcblx0XHRkaXNwb3NhYmxlcy5hZGQod29ya2luZ0NvcHkub25EaWRTYXZlKCgpID0+IHtcblx0XHRcdHNhdmVkID0gdHJ1ZTtcblx0XHR9KSk7XG5cblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIGNyZWF0ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS53b3JraW5nQ29waWVzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIud29ya2luZ0NvcGllcy5sZW5ndGgsIDEpO1xuXG5cdFx0YXdhaXQgbWFuYWdlci5kZXN0cm95KCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci53b3JraW5nQ29waWVzLmxlbmd0aCwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZXN0cm95IGZhbGxzIGJhY2sgdG8gdXNpbmcgYmFja3VwIHdoZW4gc2F2ZSBmYWlscycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9zb3VyY2UudHh0Jyk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnNldFRocm93T25TbmFwc2hvdCgpO1xuXG5cdFx0bGV0IHVuZXhwZWN0ZWRTYXZlID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdvcmtpbmdDb3B5Lm9uRGlkU2F2ZSgoKSA9PiB7XG5cdFx0XHR1bmV4cGVjdGVkU2F2ZSA9IHRydWU7XG5cdFx0fSkpO1xuXG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBjcmVhdGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UucmVzb2x2ZWQuaGFzKHdvcmtpbmdDb3B5KSwgdHJ1ZSk7XG5cblx0XHRhd2FpdCBtYW5hZ2VyLmRlc3Ryb3koKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmV4cGVjdGVkU2F2ZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIGNoYW5nZSBldmVudCB0cmlnZ2VycyB3b3JraW5nIGNvcHkgcmVzb2x2ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9pbmRleC50eHQnKTtcblxuXHRcdGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cblx0XHRsZXQgZGlkUmVzb2x2ZSA9IGZhbHNlO1xuXHRcdGNvbnN0IG9uRGlkUmVzb2x2ZSA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG1hbmFnZXIub25EaWRSZXNvbHZlKCh7IG1vZGVsIH0pID0+IHtcblx0XHRcdFx0aWYgKG1vZGVsPy5yZXNvdXJjZS50b1N0cmluZygpID09PSByZXNvdXJjZS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0ZGlkUmVzb2x2ZSA9IHRydWU7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0fSk7XG5cblx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5maXJlRmlsZUNoYW5nZXMobmV3IEZpbGVDaGFuZ2VzRXZlbnQoW3sgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfV0sIGZhbHNlKSk7XG5cblx0XHRhd2FpdCBvbkRpZFJlc29sdmU7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkUmVzb2x2ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgY2hhbmdlIGV2ZW50IHRyaWdnZXJzIHdvcmtpbmcgY29weSByZXNvbHZlICh3aGVuIHdvcmtpbmcgY29weSBpcyBwZW5kaW5nIHRvIHJlc29sdmUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0bWFuYWdlci5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGxldCBkaWRSZXNvbHZlID0gZmFsc2U7XG5cdFx0bGV0IHJlc29sdmVkQ291bnRlciA9IDA7XG5cdFx0Y29uc3Qgb25EaWRSZXNvbHZlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci5vbkRpZFJlc29sdmUoKHsgbW9kZWwgfSkgPT4ge1xuXHRcdFx0XHRpZiAobW9kZWw/LnJlc291cmNlLnRvU3RyaW5nKCkgPT09IHJlc291cmNlLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRyZXNvbHZlZENvdW50ZXIrKztcblx0XHRcdFx0XHRpZiAocmVzb2x2ZWRDb3VudGVyID09PSAyKSB7XG5cdFx0XHRcdFx0XHRkaWRSZXNvbHZlID0gdHJ1ZTtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9KTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmZpcmVGaWxlQ2hhbmdlcyhuZXcgRmlsZUNoYW5nZXNFdmVudChbeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9XSwgZmFsc2UpKTtcblxuXHRcdGF3YWl0IG9uRGlkUmVzb2x2ZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRSZXNvbHZlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsZSBzeXN0ZW0gcHJvdmlkZXIgY2hhbmdlIHRyaWdnZXJzIHdvcmtpbmcgY29weSByZXNvbHZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL2luZGV4LnR4dCcpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSkpO1xuXG5cdFx0bGV0IGRpZFJlc29sdmUgPSBmYWxzZTtcblx0XHRjb25zdCBvbkRpZFJlc29sdmUgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLm9uRGlkUmVzb2x2ZSgoeyBtb2RlbCB9KSA9PiB7XG5cdFx0XHRcdGlmIChtb2RlbD8ucmVzb3VyY2UudG9TdHJpbmcoKSA9PT0gcmVzb3VyY2UudG9TdHJpbmcoKSkge1xuXHRcdFx0XHRcdGRpZFJlc29sdmUgPSB0cnVlO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllc0NoYW5nZUV2ZW50KHsgcHJvdmlkZXI6IGRpc3Bvc2FibGVzLmFkZChuZXcgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSksIHNjaGVtZTogcmVzb3VyY2Uuc2NoZW1lIH0pO1xuXG5cdFx0YXdhaXQgb25EaWRSZXNvbHZlO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZFJlc29sdmUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCd3b3JraW5nIGNvcHkgZmlsZSBldmVudCBoYW5kbGluZzogY3JlYXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL3NvdXJjZS50eHQnKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHJlc291cmNlKTtcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ2hlbGxvIGNyZWF0ZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIHRydWUpO1xuXG5cdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5jcmVhdGUoW3sgcmVzb3VyY2UgfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnd29ya2luZyBjb3B5IGZpbGUgZXZlbnQgaGFuZGxpbmc6IG1vdmUnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RNb3ZlQ29weUZpbGVXb3JraW5nQ29weSh0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnd29ya2luZyBjb3B5IGZpbGUgZXZlbnQgaGFuZGxpbmc6IGNvcHknLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RNb3ZlQ29weUZpbGVXb3JraW5nQ29weShmYWxzZSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RNb3ZlQ29weUZpbGVXb3JraW5nQ29weShtb3ZlOiBib29sZWFuKSB7XG5cdFx0Y29uc3Qgc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL3NvdXJjZS50eHQnKTtcblx0XHRjb25zdCB0YXJnZXQgPSBVUkkuZmlsZSgnL3BhdGgvb3RoZXIudHh0Jyk7XG5cblx0XHRjb25zdCBzb3VyY2VXb3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShzb3VyY2UpO1xuXHRcdHNvdXJjZVdvcmtpbmdDb3B5Lm1vZGVsPy51cGRhdGVDb250ZW50cygnaGVsbG8gbW92ZSBvciBjb3B5Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZVdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHRpZiAobW92ZSkge1xuXHRcdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlGaWxlU2VydmljZS5tb3ZlKFt7IGZpbGU6IHsgc291cmNlLCB0YXJnZXQgfSB9XSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuY29weShbeyBmaWxlOiB7IHNvdXJjZSwgdGFyZ2V0IH0gfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRhcmdldFdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHRhcmdldCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldFdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRhcmdldFdvcmtpbmdDb3B5Lm1vZGVsPy5jb250ZW50cywgJ2hlbGxvIG1vdmUgb3IgY29weScpO1xuXHR9XG5cblx0dGVzdCgnd29ya2luZyBjb3B5IGZpbGUgZXZlbnQgaGFuZGxpbmc6IGRlbGV0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9zb3VyY2UudHh0Jyk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBkZWxldGUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UuZGVsZXRlKFt7IHJlc291cmNlIH1dLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dvcmtpbmcgY29weSBmaWxlIGV2ZW50IGhhbmRsaW5nOiBtb3ZlIHRvIHNhbWUgcmVzb3VyY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc291cmNlID0gVVJJLmZpbGUoJy9wYXRoL3NvdXJjZS50eHQnKTtcblxuXHRcdGNvbnN0IHNvdXJjZVdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHNvdXJjZSk7XG5cdFx0c291cmNlV29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdoZWxsbyBtb3ZlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZVdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cblx0XHRhd2FpdCBhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLm1vdmUoW3sgZmlsZTogeyBzb3VyY2UsIHRhcmdldDogc291cmNlIH0gfV0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZVdvcmtpbmdDb3B5LmlzRGlydHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNvdXJjZVdvcmtpbmdDb3B5Lm1vZGVsPy5jb250ZW50cywgJ2hlbGxvIG1vdmUnKTtcblx0fSk7XG5cblx0dGVzdCgnY2FuRGlzcG9zZSB3aXRoIGRpcnR5IHdvcmtpbmcgY29weScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvcGF0aC9pbmRleF9zb21ldGhpbmcudHh0Jyk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZSk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdtYWtlIGRpcnR5Jyk7XG5cblx0XHRjb25zdCBjYW5EaXNwb3NlUHJvbWlzZSA9IG1hbmFnZXIuY2FuRGlzcG9zZSh3b3JraW5nQ29weSk7XG5cdFx0YXNzZXJ0Lm9rKGNhbkRpc3Bvc2VQcm9taXNlIGluc3RhbmNlb2YgUHJvbWlzZSk7XG5cblx0XHRsZXQgY2FuRGlzcG9zZSA9IGZhbHNlO1xuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjYW5EaXNwb3NlID0gYXdhaXQgY2FuRGlzcG9zZVByb21pc2U7XG5cdFx0fSkoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5EaXNwb3NlLCBmYWxzZSk7XG5cdFx0d29ya2luZ0NvcHkucmV2ZXJ0KHsgc29mdDogdHJ1ZSB9KTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuRGlzcG9zZSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBjYW5EaXNwb3NlMiA9IG1hbmFnZXIuY2FuRGlzcG9zZSh3b3JraW5nQ29weSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbkRpc3Bvc2UyLCB0cnVlKTtcblx0fSk7XG5cblx0KGlzV2ViID8gdGVzdC5za2lwIDogdGVzdCkoJ3BlbmRpbmcgc2F2ZXMgam9pbiBvbiBzaHV0ZG93bicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZTEgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXhfc29tZXRoaW5nMS50eHQnKTtcblx0XHRjb25zdCByZXNvdXJjZTIgPSBVUkkuZmlsZSgnL3BhdGgvaW5kZXhfc29tZXRoaW5nMi50eHQnKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnJlc29sdmUocmVzb3VyY2UxKSk7XG5cdFx0d29ya2luZ0NvcHkxLm1vZGVsPy51cGRhdGVDb250ZW50cygnbWFrZSBkaXJ0eScpO1xuXG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkyID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIucmVzb2x2ZShyZXNvdXJjZTIpKTtcblx0XHR3b3JraW5nQ29weTIubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdtYWtlIGRpcnR5Jyk7XG5cblx0XHRsZXQgc2F2ZWQxID0gZmFsc2U7XG5cdFx0d29ya2luZ0NvcHkxLnNhdmUoKS50aGVuKCgpID0+IHtcblx0XHRcdHNhdmVkMSA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRsZXQgc2F2ZWQyID0gZmFsc2U7XG5cdFx0d29ya2luZ0NvcHkyLnNhdmUoKS50aGVuKCgpID0+IHtcblx0XHRcdHNhdmVkMiA9IHRydWU7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBldmVudCA9IG5ldyBUZXN0V2lsbFNodXRkb3duRXZlbnQoKTtcblx0XHRhY2Nlc3Nvci5saWZlY3ljbGVTZXJ2aWNlLmZpcmVXaWxsU2h1dGRvd24oZXZlbnQpO1xuXG5cdFx0YXNzZXJ0Lm9rKGV2ZW50LnZhbHVlLmxlbmd0aCA+IDApO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKGV2ZW50LnZhbHVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZDEsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZDIsIHRydWUpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsV0FBVztBQUVwQixTQUFTLCtCQUErQixxQkFBcUIsNkJBQTZCO0FBQzFGLFNBQVMsb0NBQW9HO0FBRTdHLFNBQVMsZ0JBQWdCLGdCQUFnQjtBQUN6QyxTQUFTLGtCQUFrQixnQkFBZ0Isb0JBQW9CLDJCQUEyQjtBQUMxRixTQUFTLGVBQWU7QUFDeEIsU0FBeUMsNkNBQTZDO0FBQ3RGLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsYUFBYTtBQUN0QixTQUFTLCtDQUErQztBQUV4RCxNQUFNLGdDQUFnQyxNQUFNO0FBRTNDLFFBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxNQUFJO0FBQ0osTUFBSTtBQUVKLE1BQUk7QUFFSixRQUFNLE1BQU07QUFDWCwyQkFBdUIsOEJBQThCLFFBQVcsV0FBVztBQUMzRSxlQUFXLHFCQUFxQixlQUFlLG1CQUFtQjtBQUVsRSxjQUFVLFlBQVksSUFBSSxJQUFJO0FBQUEsTUFDN0I7QUFBQSxNQUNBLElBQUksc0NBQXNDO0FBQUEsTUFDMUMsU0FBUztBQUFBLE1BQWEsU0FBUztBQUFBLE1BQWtCLFNBQVM7QUFBQSxNQUFjLFNBQVM7QUFBQSxNQUNqRixTQUFTO0FBQUEsTUFBd0IsU0FBUztBQUFBLE1BQTBCLFNBQVM7QUFBQSxNQUM3RSxTQUFTO0FBQUEsTUFBMkIsU0FBUztBQUFBLE1BQW9CLFNBQVM7QUFBQSxNQUMxRSxTQUFTO0FBQUEsTUFBMEIsU0FBUztBQUFBLE1BQWUsU0FBUztBQUFBLE1BQ3BFLFNBQVM7QUFBQSxJQUNWLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxXQUFTLE1BQU07QUFDZCxlQUFXLGVBQWUsUUFBUSxlQUFlO0FBQ2hELGtCQUFZLFFBQVE7QUFBQSxJQUNyQjtBQUVBLGdCQUFZLE1BQU07QUFBQSxFQUNuQixDQUFDO0FBRUQsT0FBSyxXQUFXLFlBQVk7QUFDM0IsVUFBTSxXQUFXLElBQUksS0FBSyxZQUFZO0FBRXRDLFVBQU0sU0FBZ0UsQ0FBQztBQUN2RSxVQUFNLFdBQVcsUUFBUSxZQUFZLGlCQUFlO0FBQ25ELGFBQU8sS0FBSyxXQUFXO0FBQUEsSUFDeEIsQ0FBQztBQUVELFVBQU0saUJBQWlCLFFBQVEsUUFBUSxRQUFRO0FBQy9DLFdBQU8sR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDO0FBQy9CLFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBRWxELFVBQU0sZUFBZSxNQUFNO0FBQzNCLFdBQU8sR0FBRyxZQUFZO0FBQ3RCLFdBQU8sR0FBRyxhQUFhLEtBQUs7QUFDNUIsV0FBTyxZQUFZLGFBQWEsUUFBUSwrQkFBK0I7QUFDdkUsV0FBTyxZQUFZLGFBQWEsU0FBUyxTQUFTLEdBQUcsU0FBUyxTQUFTLENBQUM7QUFDeEUsV0FBTyxZQUFZLFFBQVEsSUFBSSxRQUFRLEdBQUcsWUFBWTtBQUV0RCxVQUFNLGVBQWUsTUFBTSxRQUFRLFFBQVEsUUFBUTtBQUNuRCxXQUFPLFlBQVksY0FBYyxZQUFZO0FBQzdDLFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBQ2xELGlCQUFhLFFBQVE7QUFFckIsVUFBTSxlQUFlLE1BQU0sUUFBUSxRQUFRLFFBQVE7QUFDbkQsV0FBTyxlQUFlLGNBQWMsWUFBWTtBQUNoRCxXQUFPLFlBQVksUUFBUSxjQUFjLFFBQVEsQ0FBQztBQUNsRCxXQUFPLFlBQVksUUFBUSxJQUFJLFFBQVEsR0FBRyxZQUFZO0FBQ3RELGlCQUFhLFFBQVE7QUFFckIsV0FBTyxZQUFZLFFBQVEsY0FBYyxRQUFRLENBQUM7QUFFbEQsV0FBTyxZQUFZLE9BQU8sUUFBUSxDQUFDO0FBQ25DLFdBQU8sWUFBWSxPQUFPLENBQUMsRUFBRSxTQUFTLFNBQVMsR0FBRyxhQUFhLFNBQVMsU0FBUyxDQUFDO0FBQ2xGLFdBQU8sWUFBWSxPQUFPLENBQUMsRUFBRSxTQUFTLFNBQVMsR0FBRyxhQUFhLFNBQVMsU0FBUyxDQUFDO0FBRWxGLGFBQVMsUUFBUTtBQUVqQixpQkFBYSxRQUFRO0FBQ3JCLGlCQUFhLFFBQVE7QUFDckIsaUJBQWEsUUFBUTtBQUFBLEVBQ3RCLENBQUM7QUFFRCxPQUFLLG1CQUFtQixZQUFZO0FBQ25DLFVBQU0sV0FBVyxJQUFJLEtBQUssaUJBQWlCO0FBRTNDLGdCQUFZLElBQUksTUFBTSxRQUFRLFFBQVEsUUFBUSxDQUFDO0FBRS9DLFFBQUksYUFBYTtBQUNqQixRQUFJLGVBQWUsSUFBSSxRQUFjLENBQUFBLGFBQVc7QUFDL0Msa0JBQVksSUFBSSxRQUFRLGFBQWEsQ0FBQyxFQUFFLE1BQU0sTUFBTTtBQUNuRCxZQUFJLE9BQU8sU0FBUyxTQUFTLE1BQU0sU0FBUyxTQUFTLEdBQUc7QUFDdkQsdUJBQWE7QUFDYixVQUFBQSxTQUFRO0FBQUEsUUFDVDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSCxDQUFDO0FBRUQsVUFBTSxVQUFVLFFBQVEsUUFBUSxVQUFVLEVBQUUsUUFBUSxFQUFFLE9BQU8sS0FBSyxFQUFFLENBQUM7QUFFckUsVUFBTTtBQUVOLFdBQU8sWUFBWSxZQUFZLElBQUk7QUFFbkMsaUJBQWE7QUFFYixtQkFBZSxJQUFJLFFBQWMsQ0FBQUEsYUFBVztBQUMzQyxrQkFBWSxJQUFJLFFBQVEsYUFBYSxDQUFDLEVBQUUsTUFBTSxNQUFNO0FBQ25ELFlBQUksT0FBTyxTQUFTLFNBQVMsTUFBTSxTQUFTLFNBQVMsR0FBRztBQUN2RCx1QkFBYTtBQUNiLFVBQUFBLFNBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNILENBQUM7QUFFRCxZQUFRLFFBQVEsVUFBVSxFQUFFLFFBQVEsRUFBRSxPQUFPLE1BQU0sT0FBTyxLQUFLLEVBQUUsQ0FBQztBQUVsRSxVQUFNO0FBRU4sV0FBTyxZQUFZLFlBQVksSUFBSTtBQUVuQyxnQkFBWSxJQUFJLE1BQU0sT0FBTztBQUFBLEVBQzlCLENBQUM7QUFFRCxPQUFLLGtCQUFrQixZQUFZO0FBQ2xDLFVBQU0sV0FBVyxJQUFJLEtBQUssaUJBQWlCO0FBRTNDLFVBQU0sUUFBUSxRQUFRLFFBQVE7QUFFOUIsUUFBSSxhQUFhO0FBQ2pCLGdCQUFZLElBQUksUUFBUSxhQUFhLENBQUMsRUFBRSxNQUFNLE1BQU07QUFDbkQsVUFBSSxPQUFPLFNBQVMsU0FBUyxNQUFNLFNBQVMsU0FBUyxHQUFHO0FBQ3ZELHFCQUFhO0FBQUEsTUFDZDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsZ0JBQVksSUFBSSxNQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsUUFBUSxFQUFFLE9BQU8sTUFBTSxFQUFFLENBQUMsQ0FBQztBQUM3RSxXQUFPLFlBQVksWUFBWSxJQUFJO0FBRW5DLGlCQUFhO0FBRWIsZ0JBQVksSUFBSSxNQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsUUFBUSxFQUFFLE9BQU8sT0FBTyxPQUFPLEtBQUssRUFBRSxDQUFDLENBQUM7QUFDMUYsV0FBTyxZQUFZLFlBQVksSUFBSTtBQUFBLEVBQ3BDLENBQUM7QUFFRCxPQUFLLHdFQUF3RSxZQUFZO0FBQ3hGLFVBQU0sV0FBVyxJQUFJLEtBQUssaUJBQWlCO0FBRTNDLGFBQVMsWUFBWSx1QkFBdUIsSUFBSSxtQkFBbUIsUUFBUSxvQkFBb0IsZ0JBQWdCO0FBRS9HLFFBQUk7QUFDSCxVQUFJLFFBQTJCO0FBQy9CLFVBQUk7QUFDSCxjQUFNLFFBQVEsUUFBUSxRQUFRO0FBQUEsTUFDL0IsU0FBUyxHQUFHO0FBQ1gsZ0JBQVE7QUFBQSxNQUNUO0FBRUEsYUFBTyxHQUFHLEtBQUs7QUFDZixhQUFPLFlBQVksUUFBUSxjQUFjLFFBQVEsQ0FBQztBQUFBLElBQ25ELFVBQUU7QUFDRCxlQUFTLFlBQVksdUJBQXVCO0FBQUEsSUFDN0M7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDJFQUEyRSxZQUFZO0FBQzNGLFVBQU0sV0FBVyxJQUFJLEtBQUssaUJBQWlCO0FBRTNDLGdCQUFZLElBQUksTUFBTSxRQUFRLFFBQVEsUUFBUSxDQUFDO0FBRS9DLGFBQVMsWUFBWSx1QkFBdUIsSUFBSSxtQkFBbUIsUUFBUSxvQkFBb0IsZ0JBQWdCO0FBRS9HLFFBQUk7QUFDSCxVQUFJLFFBQTJCO0FBQy9CLFVBQUk7QUFDSCxjQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsUUFBUSxFQUFFLE9BQU8sTUFBTSxFQUFFLENBQUM7QUFBQSxNQUM3RCxTQUFTLEdBQUc7QUFDWCxnQkFBUTtBQUFBLE1BQ1Q7QUFFQSxhQUFPLEdBQUcsS0FBSztBQUNmLGFBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBQUEsSUFDbkQsVUFBRTtBQUNELGVBQVMsWUFBWSx1QkFBdUI7QUFBQSxJQUM3QztBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssaUNBQWlDLFlBQVk7QUFDakQsVUFBTSxXQUFXLElBQUksS0FBSyxZQUFZO0FBRXRDLFVBQU0sY0FBYyxNQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsVUFBVSxlQUFlLFNBQVMsV0FBVyxhQUFhLENBQUMsRUFBRSxDQUFDO0FBQ3BILFdBQU8sWUFBWSxZQUFZLE9BQU8sVUFBVSxhQUFhO0FBQzdELFdBQU8sWUFBWSxZQUFZLFFBQVEsR0FBRyxJQUFJO0FBRTlDLFVBQU0sUUFBUSxRQUFRLFVBQVUsRUFBRSxVQUFVLGVBQWUsU0FBUyxXQUFXLGNBQWMsQ0FBQyxFQUFFLENBQUM7QUFDakcsV0FBTyxZQUFZLFlBQVksT0FBTyxVQUFVLGNBQWM7QUFDOUQsV0FBTyxZQUFZLFlBQVksUUFBUSxHQUFHLElBQUk7QUFFOUMsZ0JBQVksUUFBUTtBQUFBLEVBQ3JCLENBQUM7QUFFRCxPQUFLLDBEQUEwRCxZQUFZO0FBQzFFLFVBQU0sV0FBVyxJQUFJLEtBQUssWUFBWTtBQUV0QyxVQUFNLGVBQWUsUUFBUSxRQUFRLFFBQVE7QUFDN0MsVUFBTSxnQkFBZ0IsUUFBUSxRQUFRLFVBQVUsRUFBRSxVQUFVLGVBQWUsU0FBUyxXQUFXLGFBQWEsQ0FBQyxFQUFFLENBQUM7QUFDaEgsVUFBTSxlQUFlLFFBQVEsUUFBUSxVQUFVLEVBQUUsVUFBVSxlQUFlLFNBQVMsV0FBVyxjQUFjLENBQUMsRUFBRSxDQUFDO0FBRWhILFVBQU07QUFDTixVQUFNO0FBQ04sVUFBTSxjQUFjLE1BQU07QUFFMUIsV0FBTyxZQUFZLFlBQVksT0FBTyxVQUFVLGNBQWM7QUFDOUQsV0FBTyxZQUFZLFlBQVksUUFBUSxHQUFHLElBQUk7QUFFOUMsZ0JBQVksUUFBUTtBQUFBLEVBQ3JCLENBQUM7QUFFRCxPQUFLLCtEQUErRCxZQUFZO0FBQy9FLFVBQU0sWUFBWSxJQUFJLEtBQUssYUFBYTtBQUN4QyxVQUFNLFlBQVksSUFBSSxLQUFLLGFBQWE7QUFDeEMsVUFBTSxZQUFZLElBQUksS0FBSyxhQUFhO0FBRXhDLFVBQU0sZUFBZSxRQUFRLFFBQVEsU0FBUztBQUM5QyxVQUFNLGdCQUFnQixRQUFRLFFBQVEsU0FBUztBQUMvQyxVQUFNLGVBQWUsUUFBUSxRQUFRLFNBQVM7QUFFOUMsVUFBTSxDQUFDLGNBQWMsY0FBYyxZQUFZLElBQUksTUFBTSxRQUFRLElBQUksQ0FBQyxjQUFjLGVBQWUsWUFBWSxDQUFDO0FBRWhILFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBQ2xELFdBQU8sWUFBWSxhQUFhLFNBQVMsU0FBUyxHQUFHLFVBQVUsU0FBUyxDQUFDO0FBQ3pFLFdBQU8sWUFBWSxhQUFhLFNBQVMsU0FBUyxHQUFHLFVBQVUsU0FBUyxDQUFDO0FBQ3pFLFdBQU8sWUFBWSxhQUFhLFNBQVMsU0FBUyxHQUFHLFVBQVUsU0FBUyxDQUFDO0FBRXpFLGlCQUFhLFFBQVE7QUFDckIsaUJBQWEsUUFBUTtBQUNyQixpQkFBYSxRQUFRO0FBQUEsRUFDdEIsQ0FBQztBQUVELE9BQUssK0RBQStELFlBQVk7QUFDL0UsVUFBTSxXQUFXLElBQUksS0FBSyxZQUFZO0FBRXRDLFFBQUksY0FBYyxNQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsVUFBVSxlQUFlLFNBQVMsV0FBVyxhQUFhLENBQUMsRUFBRSxDQUFDO0FBRWxILFdBQU8sWUFBWSxRQUFRLElBQUksSUFBSSxLQUFLLFlBQVksQ0FBQyxHQUFHLFdBQVc7QUFFbkUsZ0JBQVksUUFBUTtBQUNwQixXQUFPLENBQUMsUUFBUSxJQUFJLElBQUksS0FBSyxZQUFZLENBQUMsQ0FBQztBQUUzQyxrQkFBYyxNQUFNLFFBQVEsUUFBUSxVQUFVLEVBQUUsVUFBVSxlQUFlLFNBQVMsV0FBVyxhQUFhLENBQUMsRUFBRSxDQUFDO0FBRTlHLFdBQU8sWUFBWSxRQUFRLElBQUksSUFBSSxLQUFLLFlBQVksQ0FBQyxHQUFHLFdBQVc7QUFFbkUsZ0JBQVksT0FBTyxRQUFRO0FBQzNCLFdBQU8sQ0FBQyxRQUFRLElBQUksSUFBSSxLQUFLLFlBQVksQ0FBQyxDQUFDO0FBQUEsRUFDNUMsQ0FBQztBQUVELE9BQUssVUFBVSxZQUFZO0FBQzFCLFVBQU0sWUFBWSxJQUFJLEtBQUssaUJBQWlCO0FBQzVDLFVBQU0sWUFBWSxJQUFJLEtBQUssaUJBQWlCO0FBRTVDLFFBQUksaUJBQWlCO0FBQ3JCLFFBQUksa0JBQWtCO0FBQ3RCLFFBQUksaUJBQWlCO0FBQ3JCLFFBQUksa0JBQWtCO0FBQ3RCLFFBQUkscUJBQXFCO0FBQ3pCLFFBQUksa0JBQWtCO0FBQ3RCLFFBQUksZUFBZTtBQUNuQixRQUFJLG1CQUFtQjtBQUV2QixnQkFBWSxJQUFJLFFBQVEsWUFBWSxNQUFNO0FBQ3pDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixnQkFBWSxJQUFJLFFBQVEsWUFBWSxjQUFZO0FBQy9DLFVBQUksU0FBUyxTQUFTLE1BQU0sVUFBVSxTQUFTLEtBQUssU0FBUyxTQUFTLE1BQU0sVUFBVSxTQUFTLEdBQUc7QUFDakc7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixnQkFBWSxJQUFJLFFBQVEsYUFBYSxpQkFBZTtBQUNuRCxVQUFJLFlBQVksU0FBUyxTQUFTLE1BQU0sVUFBVSxTQUFTLEdBQUc7QUFDN0Q7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFFRixnQkFBWSxJQUFJLFFBQVEsaUJBQWlCLGlCQUFlO0FBQ3ZELFVBQUksWUFBWSxTQUFTLFNBQVMsTUFBTSxVQUFVLFNBQVMsR0FBRztBQUM3RCxZQUFJLFlBQVksUUFBUSxHQUFHO0FBQzFCO0FBQUEsUUFDRCxPQUFPO0FBQ047QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsZ0JBQVksSUFBSSxRQUFRLFlBQVksaUJBQWU7QUFDbEQsVUFBSSxZQUFZLFNBQVMsU0FBUyxNQUFNLFVBQVUsU0FBUyxHQUFHO0FBQzdEO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsUUFBSSxnQkFBNkY7QUFDakcsZ0JBQVksSUFBSSxRQUFRLFVBQVUsQ0FBQyxNQUFNO0FBQ3hDLFVBQUksRUFBRSxZQUFZLFNBQVMsU0FBUyxNQUFNLFVBQVUsU0FBUyxHQUFHO0FBQy9ELHdCQUFnQjtBQUNoQjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLGdCQUFZLElBQUksUUFBUSxlQUFlLGlCQUFlO0FBQ3JELFVBQUksWUFBWSxTQUFTLFNBQVMsTUFBTSxVQUFVLFNBQVMsR0FBRztBQUM3RDtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUVGLFVBQU0sZUFBZSxZQUFZLElBQUksTUFBTSxRQUFRLFFBQVEsU0FBUyxDQUFDO0FBQ3JFLFdBQU8sWUFBWSxpQkFBaUIsQ0FBQztBQUNyQyxXQUFPLFlBQVksZ0JBQWdCLENBQUM7QUFFcEMsYUFBUyxZQUFZLGdCQUFnQixJQUFJLGlCQUFpQixDQUFDLEVBQUUsVUFBVSxXQUFXLE1BQU0sZUFBZSxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUM7QUFDekgsYUFBUyxZQUFZLGdCQUFnQixJQUFJLGlCQUFpQixDQUFDLEVBQUUsVUFBVSxXQUFXLE1BQU0sZUFBZSxNQUFNLENBQUMsR0FBRyxLQUFLLENBQUM7QUFFdkgsVUFBTSxlQUFlLFlBQVksSUFBSSxNQUFNLFFBQVEsUUFBUSxTQUFTLENBQUM7QUFDckUsV0FBTyxZQUFZLGlCQUFpQixDQUFDO0FBQ3JDLFdBQU8sWUFBWSxnQkFBZ0IsQ0FBQztBQUVwQyxpQkFBYSxPQUFPLGVBQWUsU0FBUztBQUU1QyxVQUFNLGFBQWEsT0FBTztBQUMxQixpQkFBYSxPQUFPLGVBQWUsZUFBZTtBQUVsRCxVQUFNLGFBQWEsS0FBSztBQUV4QixRQUFJO0FBQ0gsZUFBUyxZQUFZLHdCQUF3QixJQUFJLG1CQUFtQixlQUFlLG9CQUFvQixzQkFBc0I7QUFFN0gsWUFBTSxhQUFhLEtBQUssRUFBRSxPQUFPLEtBQUssQ0FBQztBQUFBLElBQ3hDLFVBQUU7QUFDRCxlQUFTLFlBQVksd0JBQXdCO0FBQUEsSUFDOUM7QUFFQSxpQkFBYSxRQUFRO0FBQ3JCLGlCQUFhLFFBQVE7QUFFckIsVUFBTSxhQUFhLE9BQU87QUFDMUIsV0FBTyxZQUFZLGdCQUFnQixDQUFDO0FBQ3BDLFdBQU8sWUFBWSxpQkFBaUIsQ0FBQztBQUNyQyxXQUFPLFlBQVksb0JBQW9CLENBQUM7QUFDeEMsV0FBTyxZQUFZLGlCQUFpQixDQUFDO0FBQ3JDLFdBQU8sWUFBWSxjQUFjLENBQUM7QUFDbEMsV0FBTyxZQUFZLGNBQWUsYUFBYSxZQUFZO0FBQzNELFdBQU8sR0FBRyxjQUFlLElBQUk7QUFDN0IsV0FBTyxZQUFZLGtCQUFrQixDQUFDO0FBQ3RDLFdBQU8sWUFBWSxnQkFBZ0IsQ0FBQztBQUVwQyxpQkFBYSxRQUFRO0FBQ3JCLGlCQUFhLFFBQVE7QUFBQSxFQUN0QixDQUFDO0FBRUQsT0FBSyx3REFBd0QsWUFBWTtBQUN4RSxVQUFNLFlBQVksSUFBSSxLQUFLLGFBQWE7QUFDeEMsVUFBTSxZQUFZLElBQUksS0FBSyxhQUFhO0FBQ3hDLFVBQU0sWUFBWSxJQUFJLEtBQUssYUFBYTtBQUV4QyxXQUFPLFlBQVksU0FBUyxtQkFBbUIsY0FBYyxRQUFRLENBQUM7QUFFdEUsVUFBTSxlQUFlLFFBQVEsUUFBUSxTQUFTO0FBQzlDLFVBQU0sZ0JBQWdCLFFBQVEsUUFBUSxTQUFTO0FBQy9DLFVBQU0sZUFBZSxRQUFRLFFBQVEsU0FBUztBQUU5QyxVQUFNLFFBQVEsSUFBSSxDQUFDLGNBQWMsZUFBZSxZQUFZLENBQUM7QUFFN0QsV0FBTyxZQUFZLFNBQVMsbUJBQW1CLGNBQWMsUUFBUSxDQUFDO0FBQ3RFLFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBRWxELFlBQVEsUUFBUTtBQUVoQixXQUFPLFlBQVksUUFBUSxjQUFjLFFBQVEsQ0FBQztBQUdsRCxXQUFPLFlBQVksU0FBUyxtQkFBbUIsY0FBYyxRQUFRLENBQUM7QUFFdEUsZ0JBQVksSUFBSSxNQUFNLFlBQVk7QUFDbEMsZ0JBQVksSUFBSSxNQUFNLGFBQWE7QUFDbkMsZ0JBQVksSUFBSSxNQUFNLFlBQVk7QUFBQSxFQUNuQyxDQUFDO0FBRUQsT0FBSyxXQUFXLFlBQVk7QUFDM0IsVUFBTSxZQUFZLElBQUksS0FBSyxhQUFhO0FBQ3hDLFVBQU0sWUFBWSxJQUFJLEtBQUssYUFBYTtBQUN4QyxVQUFNLFlBQVksSUFBSSxLQUFLLGFBQWE7QUFFeEMsV0FBTyxZQUFZLFNBQVMsbUJBQW1CLGNBQWMsUUFBUSxDQUFDO0FBRXRFLFVBQU0sZUFBZSxRQUFRLFFBQVEsU0FBUztBQUM5QyxVQUFNLGdCQUFnQixRQUFRLFFBQVEsU0FBUztBQUMvQyxVQUFNLGVBQWUsUUFBUSxRQUFRLFNBQVM7QUFFOUMsVUFBTSxRQUFRLElBQUksQ0FBQyxjQUFjLGVBQWUsWUFBWSxDQUFDO0FBRTdELFdBQU8sWUFBWSxTQUFTLG1CQUFtQixjQUFjLFFBQVEsQ0FBQztBQUN0RSxXQUFPLFlBQVksUUFBUSxjQUFjLFFBQVEsQ0FBQztBQUVsRCxVQUFNLFFBQVEsUUFBUTtBQUV0QixXQUFPLFlBQVksU0FBUyxtQkFBbUIsY0FBYyxRQUFRLENBQUM7QUFDdEUsV0FBTyxZQUFZLFFBQVEsY0FBYyxRQUFRLENBQUM7QUFBQSxFQUNuRCxDQUFDO0FBRUQsT0FBSyxzQ0FBc0MsWUFBWTtBQUN0RCxVQUFNLFdBQVcsSUFBSSxLQUFLLGtCQUFrQjtBQUU1QyxVQUFNLGNBQWMsTUFBTSxRQUFRLFFBQVEsUUFBUTtBQUVsRCxRQUFJLFFBQVE7QUFDWixnQkFBWSxJQUFJLFlBQVksVUFBVSxNQUFNO0FBQzNDLGNBQVE7QUFBQSxJQUNULENBQUMsQ0FBQztBQUVGLGdCQUFZLE9BQU8sZUFBZSxjQUFjO0FBQ2hELFdBQU8sWUFBWSxZQUFZLFFBQVEsR0FBRyxJQUFJO0FBRTlDLFdBQU8sWUFBWSxTQUFTLG1CQUFtQixjQUFjLFFBQVEsQ0FBQztBQUN0RSxXQUFPLFlBQVksUUFBUSxjQUFjLFFBQVEsQ0FBQztBQUVsRCxVQUFNLFFBQVEsUUFBUTtBQUV0QixXQUFPLFlBQVksU0FBUyxtQkFBbUIsY0FBYyxRQUFRLENBQUM7QUFDdEUsV0FBTyxZQUFZLFFBQVEsY0FBYyxRQUFRLENBQUM7QUFFbEQsV0FBTyxZQUFZLE9BQU8sSUFBSTtBQUFBLEVBQy9CLENBQUM7QUFFRCxPQUFLLHNEQUFzRCxZQUFZO0FBQ3RFLFVBQU0sV0FBVyxJQUFJLEtBQUssa0JBQWtCO0FBRTVDLFVBQU0sY0FBYyxNQUFNLFFBQVEsUUFBUSxRQUFRO0FBQ2xELGdCQUFZLE9BQU8sbUJBQW1CO0FBRXRDLFFBQUksaUJBQWlCO0FBQ3JCLGdCQUFZLElBQUksWUFBWSxVQUFVLE1BQU07QUFDM0MsdUJBQWlCO0FBQUEsSUFDbEIsQ0FBQyxDQUFDO0FBRUYsZ0JBQVksT0FBTyxlQUFlLGNBQWM7QUFDaEQsV0FBTyxZQUFZLFlBQVksUUFBUSxHQUFHLElBQUk7QUFFOUMsV0FBTyxZQUFZLFNBQVMsbUJBQW1CLGNBQWMsUUFBUSxDQUFDO0FBQ3RFLFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBRWxELFdBQU8sWUFBWSxTQUFTLHlCQUF5QixTQUFTLElBQUksV0FBVyxHQUFHLElBQUk7QUFFcEYsVUFBTSxRQUFRLFFBQVE7QUFFdEIsV0FBTyxZQUFZLFNBQVMsbUJBQW1CLGNBQWMsUUFBUSxDQUFDO0FBQ3RFLFdBQU8sWUFBWSxRQUFRLGNBQWMsUUFBUSxDQUFDO0FBRWxELFdBQU8sWUFBWSxnQkFBZ0IsS0FBSztBQUFBLEVBQ3pDLENBQUM7QUFFRCxPQUFLLG1EQUFtRCxZQUFZO0FBQ25FLFVBQU0sV0FBVyxJQUFJLEtBQUssaUJBQWlCO0FBRTNDLFVBQU0sUUFBUSxRQUFRLFFBQVE7QUFFOUIsUUFBSSxhQUFhO0FBQ2pCLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUNqRCxrQkFBWSxJQUFJLFFBQVEsYUFBYSxDQUFDLEVBQUUsTUFBTSxNQUFNO0FBQ25ELFlBQUksT0FBTyxTQUFTLFNBQVMsTUFBTSxTQUFTLFNBQVMsR0FBRztBQUN2RCx1QkFBYTtBQUNiLGtCQUFRO0FBQUEsUUFDVDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSCxDQUFDO0FBRUQsYUFBUyxZQUFZLGdCQUFnQixJQUFJLGlCQUFpQixDQUFDLEVBQUUsVUFBVSxNQUFNLGVBQWUsUUFBUSxDQUFDLEdBQUcsS0FBSyxDQUFDO0FBRTlHLFVBQU07QUFFTixXQUFPLFlBQVksWUFBWSxJQUFJO0FBQUEsRUFDcEMsQ0FBQztBQUVELE9BQUssNkZBQTZGLFlBQVk7QUFDN0csVUFBTSxXQUFXLElBQUksS0FBSyxpQkFBaUI7QUFFM0MsWUFBUSxRQUFRLFFBQVE7QUFFeEIsUUFBSSxhQUFhO0FBQ2pCLFFBQUksa0JBQWtCO0FBQ3RCLFVBQU0sZUFBZSxJQUFJLFFBQWMsYUFBVztBQUNqRCxrQkFBWSxJQUFJLFFBQVEsYUFBYSxDQUFDLEVBQUUsTUFBTSxNQUFNO0FBQ25ELFlBQUksT0FBTyxTQUFTLFNBQVMsTUFBTSxTQUFTLFNBQVMsR0FBRztBQUN2RDtBQUNBLGNBQUksb0JBQW9CLEdBQUc7QUFDMUIseUJBQWE7QUFDYixvQkFBUTtBQUFBLFVBQ1Q7QUFBQSxRQUNEO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNILENBQUM7QUFFRCxhQUFTLFlBQVksZ0JBQWdCLElBQUksaUJBQWlCLENBQUMsRUFBRSxVQUFVLE1BQU0sZUFBZSxRQUFRLENBQUMsR0FBRyxLQUFLLENBQUM7QUFFOUcsVUFBTTtBQUVOLFdBQU8sWUFBWSxZQUFZLElBQUk7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSyw2REFBNkQsWUFBWTtBQUM3RSxVQUFNLFdBQVcsSUFBSSxLQUFLLGlCQUFpQjtBQUUzQyxnQkFBWSxJQUFJLE1BQU0sUUFBUSxRQUFRLFFBQVEsQ0FBQztBQUUvQyxRQUFJLGFBQWE7QUFDakIsVUFBTSxlQUFlLElBQUksUUFBYyxhQUFXO0FBQ2pELGtCQUFZLElBQUksUUFBUSxhQUFhLENBQUMsRUFBRSxNQUFNLE1BQU07QUFDbkQsWUFBSSxPQUFPLFNBQVMsU0FBUyxNQUFNLFNBQVMsU0FBUyxHQUFHO0FBQ3ZELHVCQUFhO0FBQ2Isa0JBQVE7QUFBQSxRQUNUO0FBQUEsTUFDRCxDQUFDLENBQUM7QUFBQSxJQUNILENBQUM7QUFFRCxhQUFTLFlBQVksOENBQThDLEVBQUUsVUFBVSxZQUFZLElBQUksSUFBSSwyQkFBMkIsQ0FBQyxHQUFHLFFBQVEsU0FBUyxPQUFPLENBQUM7QUFFM0osVUFBTTtBQUVOLFdBQU8sWUFBWSxZQUFZLElBQUk7QUFBQSxFQUNwQyxDQUFDO0FBRUQsT0FBSyw0Q0FBNEMsWUFBWTtBQUM1RCxVQUFNLFdBQVcsSUFBSSxLQUFLLGtCQUFrQjtBQUU1QyxVQUFNLGNBQWMsTUFBTSxRQUFRLFFBQVEsUUFBUTtBQUNsRCxnQkFBWSxPQUFPLGVBQWUsY0FBYztBQUNoRCxXQUFPLFlBQVksWUFBWSxRQUFRLEdBQUcsSUFBSTtBQUU5QyxVQUFNLFNBQVMsdUJBQXVCLE9BQU8sQ0FBQyxFQUFFLFNBQVMsQ0FBQyxHQUFHLGtCQUFrQixJQUFJO0FBQ25GLFdBQU8sWUFBWSxZQUFZLFFBQVEsR0FBRyxLQUFLO0FBQUEsRUFDaEQsQ0FBQztBQUVELE9BQUssMENBQTBDLE1BQU07QUFDcEQsV0FBTyw0QkFBNEIsSUFBSTtBQUFBLEVBQ3hDLENBQUM7QUFFRCxPQUFLLDBDQUEwQyxNQUFNO0FBQ3BELFdBQU8sNEJBQTRCLEtBQUs7QUFBQSxFQUN6QyxDQUFDO0FBRUQsaUJBQWUsNEJBQTRCLE1BQWU7QUFDekQsVUFBTSxTQUFTLElBQUksS0FBSyxrQkFBa0I7QUFDMUMsVUFBTSxTQUFTLElBQUksS0FBSyxpQkFBaUI7QUFFekMsVUFBTSxvQkFBb0IsTUFBTSxRQUFRLFFBQVEsTUFBTTtBQUN0RCxzQkFBa0IsT0FBTyxlQUFlLG9CQUFvQjtBQUM1RCxXQUFPLFlBQVksa0JBQWtCLFFBQVEsR0FBRyxJQUFJO0FBRXBELFFBQUksTUFBTTtBQUNULFlBQU0sU0FBUyx1QkFBdUIsS0FBSyxDQUFDLEVBQUUsTUFBTSxFQUFFLFFBQVEsT0FBTyxFQUFFLENBQUMsR0FBRyxrQkFBa0IsSUFBSTtBQUFBLElBQ2xHLE9BQU87QUFDTixZQUFNLFNBQVMsdUJBQXVCLEtBQUssQ0FBQyxFQUFFLE1BQU0sRUFBRSxRQUFRLE9BQU8sRUFBRSxDQUFDLEdBQUcsa0JBQWtCLElBQUk7QUFBQSxJQUNsRztBQUVBLFVBQU0sb0JBQW9CLE1BQU0sUUFBUSxRQUFRLE1BQU07QUFDdEQsV0FBTyxZQUFZLGtCQUFrQixRQUFRLEdBQUcsSUFBSTtBQUNwRCxXQUFPLFlBQVksa0JBQWtCLE9BQU8sVUFBVSxvQkFBb0I7QUFBQSxFQUMzRTtBQUVBLE9BQUssNENBQTRDLFlBQVk7QUFDNUQsVUFBTSxXQUFXLElBQUksS0FBSyxrQkFBa0I7QUFFNUMsVUFBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLFFBQVE7QUFDbEQsZ0JBQVksT0FBTyxlQUFlLGNBQWM7QUFDaEQsV0FBTyxZQUFZLFlBQVksUUFBUSxHQUFHLElBQUk7QUFFOUMsVUFBTSxTQUFTLHVCQUF1QixPQUFPLENBQUMsRUFBRSxTQUFTLENBQUMsR0FBRyxrQkFBa0IsSUFBSTtBQUNuRixXQUFPLFlBQVksWUFBWSxRQUFRLEdBQUcsS0FBSztBQUFBLEVBQ2hELENBQUM7QUFFRCxPQUFLLDJEQUEyRCxZQUFZO0FBQzNFLFVBQU0sU0FBUyxJQUFJLEtBQUssa0JBQWtCO0FBRTFDLFVBQU0sb0JBQW9CLE1BQU0sUUFBUSxRQUFRLE1BQU07QUFDdEQsc0JBQWtCLE9BQU8sZUFBZSxZQUFZO0FBQ3BELFdBQU8sWUFBWSxrQkFBa0IsUUFBUSxHQUFHLElBQUk7QUFFcEQsVUFBTSxTQUFTLHVCQUF1QixLQUFLLENBQUMsRUFBRSxNQUFNLEVBQUUsUUFBUSxRQUFRLE9BQU8sRUFBRSxDQUFDLEdBQUcsa0JBQWtCLElBQUk7QUFFekcsV0FBTyxZQUFZLGtCQUFrQixRQUFRLEdBQUcsSUFBSTtBQUNwRCxXQUFPLFlBQVksa0JBQWtCLE9BQU8sVUFBVSxZQUFZO0FBQUEsRUFDbkUsQ0FBQztBQUVELE9BQUssc0NBQXNDLFlBQVk7QUFDdEQsVUFBTSxXQUFXLElBQUksS0FBSywyQkFBMkI7QUFFckQsVUFBTSxjQUFjLE1BQU0sUUFBUSxRQUFRLFFBQVE7QUFDbEQsZ0JBQVksT0FBTyxlQUFlLFlBQVk7QUFFOUMsVUFBTSxvQkFBb0IsUUFBUSxXQUFXLFdBQVc7QUFDeEQsV0FBTyxHQUFHLDZCQUE2QixPQUFPO0FBRTlDLFFBQUksYUFBYTtBQUNqQixLQUFDLFlBQVk7QUFDWixtQkFBYSxNQUFNO0FBQUEsSUFDcEIsR0FBRztBQUVILFdBQU8sWUFBWSxZQUFZLEtBQUs7QUFDcEMsZ0JBQVksT0FBTyxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBRWpDLFVBQU0sUUFBUSxDQUFDO0FBRWYsV0FBTyxZQUFZLFlBQVksSUFBSTtBQUVuQyxVQUFNLGNBQWMsUUFBUSxXQUFXLFdBQVc7QUFDbEQsV0FBTyxZQUFZLGFBQWEsSUFBSTtBQUFBLEVBQ3JDLENBQUM7QUFFRCxHQUFDLFFBQVEsS0FBSyxPQUFPLE1BQU0sa0NBQWtDLFlBQVk7QUFDeEUsVUFBTSxZQUFZLElBQUksS0FBSyw0QkFBNEI7QUFDdkQsVUFBTSxZQUFZLElBQUksS0FBSyw0QkFBNEI7QUFFdkQsVUFBTSxlQUFlLFlBQVksSUFBSSxNQUFNLFFBQVEsUUFBUSxTQUFTLENBQUM7QUFDckUsaUJBQWEsT0FBTyxlQUFlLFlBQVk7QUFFL0MsVUFBTSxlQUFlLFlBQVksSUFBSSxNQUFNLFFBQVEsUUFBUSxTQUFTLENBQUM7QUFDckUsaUJBQWEsT0FBTyxlQUFlLFlBQVk7QUFFL0MsUUFBSSxTQUFTO0FBQ2IsaUJBQWEsS0FBSyxFQUFFLEtBQUssTUFBTTtBQUM5QixlQUFTO0FBQUEsSUFDVixDQUFDO0FBRUQsUUFBSSxTQUFTO0FBQ2IsaUJBQWEsS0FBSyxFQUFFLEtBQUssTUFBTTtBQUM5QixlQUFTO0FBQUEsSUFDVixDQUFDO0FBRUQsVUFBTSxRQUFRLElBQUksc0JBQXNCO0FBQ3hDLGFBQVMsaUJBQWlCLGlCQUFpQixLQUFLO0FBRWhELFdBQU8sR0FBRyxNQUFNLE1BQU0sU0FBUyxDQUFDO0FBQ2hDLFVBQU0sUUFBUSxJQUFJLE1BQU0sS0FBSztBQUU3QixXQUFPLFlBQVksUUFBUSxJQUFJO0FBQy9CLFdBQU8sWUFBWSxRQUFRLElBQUk7QUFBQSxFQUNoQyxDQUFDO0FBRUQsMENBQXdDO0FBQ3pDLENBQUM7IiwKICAibmFtZXMiOiBbInJlc29sdmUiXQp9Cg==
