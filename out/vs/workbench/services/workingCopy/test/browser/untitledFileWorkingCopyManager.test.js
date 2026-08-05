import assert from "assert";
import { bufferToStream, VSBuffer } from "../../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { FileWorkingCopyManager } from "../../common/fileWorkingCopyManager.js";
import { NO_TYPE_ID, WorkingCopyCapabilities } from "../../common/workingCopy.js";
import { TestStoredFileWorkingCopyModelFactory } from "./storedFileWorkingCopy.test.js";
import { TestUntitledFileWorkingCopyModelFactory } from "./untitledFileWorkingCopy.test.js";
import { TestInMemoryFileSystemProvider, TestServiceAccessor, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("UntitledFileWorkingCopyManager", () => {
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  let manager;
  setup(() => {
    instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    disposables.add(accessor.fileService.registerProvider(Schemas.file, disposables.add(new TestInMemoryFileSystemProvider())));
    disposables.add(accessor.fileService.registerProvider(Schemas.vscodeRemote, disposables.add(new TestInMemoryFileSystemProvider())));
    manager = disposables.add(new FileWorkingCopyManager(
      "testUntitledFileWorkingCopyType",
      new TestStoredFileWorkingCopyModelFactory(),
      new TestUntitledFileWorkingCopyModelFactory(),
      accessor.fileService,
      accessor.lifecycleService,
      accessor.labelService,
      accessor.logService,
      accessor.workingCopyFileService,
      accessor.workingCopyBackupService,
      accessor.uriIdentityService,
      accessor.fileDialogService,
      accessor.filesConfigurationService,
      accessor.workingCopyService,
      accessor.notificationService,
      accessor.workingCopyEditorService,
      accessor.editorService,
      accessor.elevatedFileService,
      accessor.pathService,
      accessor.environmentService,
      accessor.dialogService,
      accessor.decorationsService,
      accessor.progressService
    ));
  });
  teardown(() => {
    for (const workingCopy of [...manager.untitled.workingCopies, ...manager.stored.workingCopies]) {
      workingCopy.dispose();
    }
    disposables.clear();
  });
  test("basics", async () => {
    let createCounter = 0;
    disposables.add(manager.untitled.onDidCreate((e) => {
      createCounter++;
    }));
    let disposeCounter = 0;
    disposables.add(manager.untitled.onWillDispose((e) => {
      disposeCounter++;
    }));
    let dirtyCounter = 0;
    disposables.add(manager.untitled.onDidChangeDirty((e) => {
      dirtyCounter++;
    }));
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    assert.strictEqual(manager.untitled.workingCopies.length, 0);
    assert.strictEqual(manager.untitled.get(URI.file("/some/invalidPath")), void 0);
    assert.strictEqual(manager.untitled.get(URI.file("/some/invalidPath").with({ scheme: Schemas.untitled })), void 0);
    const workingCopy1 = await manager.untitled.resolve();
    const workingCopy2 = await manager.untitled.resolve();
    assert.strictEqual(workingCopy1.typeId, "testUntitledFileWorkingCopyType");
    assert.strictEqual(workingCopy1.resource.scheme, Schemas.untitled);
    assert.strictEqual(createCounter, 2);
    assert.strictEqual(manager.untitled.get(workingCopy1.resource), workingCopy1);
    assert.strictEqual(manager.untitled.get(workingCopy2.resource), workingCopy2);
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 2);
    assert.strictEqual(manager.untitled.workingCopies.length, 2);
    assert.notStrictEqual(workingCopy1.resource.toString(), workingCopy2.resource.toString());
    for (const workingCopy of [workingCopy1, workingCopy2]) {
      assert.strictEqual(workingCopy.capabilities, WorkingCopyCapabilities.Untitled);
      assert.strictEqual(workingCopy.isDirty(), false);
      assert.strictEqual(workingCopy.isModified(), false);
      assert.ok(workingCopy.model);
    }
    workingCopy1.model?.updateContents("Hello World");
    assert.strictEqual(workingCopy1.isDirty(), true);
    assert.strictEqual(workingCopy1.isModified(), true);
    assert.strictEqual(dirtyCounter, 1);
    workingCopy1.model?.updateContents("");
    assert.strictEqual(workingCopy1.isDirty(), false);
    assert.strictEqual(workingCopy1.isModified(), false);
    assert.strictEqual(dirtyCounter, 2);
    workingCopy2.model?.fireContentChangeEvent({ isInitial: false });
    assert.strictEqual(workingCopy2.isDirty(), true);
    assert.strictEqual(workingCopy2.isModified(), true);
    assert.strictEqual(dirtyCounter, 3);
    workingCopy1.dispose();
    assert.strictEqual(manager.untitled.workingCopies.length, 1);
    assert.strictEqual(manager.untitled.get(workingCopy1.resource), void 0);
    workingCopy2.dispose();
    assert.strictEqual(manager.untitled.workingCopies.length, 0);
    assert.strictEqual(manager.untitled.get(workingCopy2.resource), void 0);
    assert.strictEqual(disposeCounter, 2);
  });
  test("dirty - scratchpads are never dirty", async () => {
    let dirtyCounter = 0;
    disposables.add(manager.untitled.onDidChangeDirty((e) => {
      dirtyCounter++;
    }));
    const workingCopy1 = await manager.resolve({
      untitledResource: URI.from({ scheme: Schemas.untitled, path: `/myscratchpad` }),
      isScratchpad: true
    });
    assert.strictEqual(workingCopy1.resource.scheme, Schemas.untitled);
    assert.strictEqual(manager.untitled.workingCopies.length, 1);
    workingCopy1.model?.updateContents("contents");
    assert.strictEqual(workingCopy1.isDirty(), false);
    assert.strictEqual(workingCopy1.isModified(), true);
    workingCopy1.model?.fireContentChangeEvent({ isInitial: true });
    assert.strictEqual(workingCopy1.isDirty(), false);
    assert.strictEqual(workingCopy1.isModified(), false);
    assert.strictEqual(dirtyCounter, 0);
    workingCopy1.dispose();
  });
  test("resolve - with initial value", async () => {
    let dirtyCounter = 0;
    disposables.add(manager.untitled.onDidChangeDirty((e) => {
      dirtyCounter++;
    }));
    const workingCopy1 = await manager.untitled.resolve({ contents: { value: bufferToStream(VSBuffer.fromString("Hello World")) } });
    assert.strictEqual(workingCopy1.isModified(), true);
    assert.strictEqual(workingCopy1.isDirty(), true);
    assert.strictEqual(dirtyCounter, 1);
    assert.strictEqual(workingCopy1.model?.contents, "Hello World");
    workingCopy1.dispose();
    const workingCopy2 = await manager.untitled.resolve({ contents: { value: bufferToStream(VSBuffer.fromString("Hello World")), markModified: true } });
    assert.strictEqual(workingCopy2.isModified(), true);
    assert.strictEqual(workingCopy2.isDirty(), true);
    assert.strictEqual(dirtyCounter, 2);
    assert.strictEqual(workingCopy2.model?.contents, "Hello World");
    workingCopy2.dispose();
  });
  test("resolve - with initial value but markDirty: false", async () => {
    let dirtyCounter = 0;
    disposables.add(manager.untitled.onDidChangeDirty((e) => {
      dirtyCounter++;
    }));
    const workingCopy = await manager.untitled.resolve({ contents: { value: bufferToStream(VSBuffer.fromString("Hello World")), markModified: false } });
    assert.strictEqual(workingCopy.isModified(), false);
    assert.strictEqual(workingCopy.isDirty(), false);
    assert.strictEqual(dirtyCounter, 0);
    assert.strictEqual(workingCopy.model?.contents, "Hello World");
    workingCopy.dispose();
  });
  test("resolve begins counter from 1 for disposed untitled", async () => {
    const untitled1 = await manager.untitled.resolve();
    untitled1.dispose();
    const untitled1Again = disposables.add(await manager.untitled.resolve());
    assert.strictEqual(untitled1.resource.toString(), untitled1Again.resource.toString());
  });
  test("resolve - existing", async () => {
    let createCounter = 0;
    disposables.add(manager.untitled.onDidCreate((e) => {
      createCounter++;
    }));
    const workingCopy1 = await manager.untitled.resolve();
    assert.strictEqual(createCounter, 1);
    const workingCopy2 = await manager.untitled.resolve({ untitledResource: workingCopy1.resource });
    assert.strictEqual(workingCopy1, workingCopy2);
    assert.strictEqual(createCounter, 1);
    const workingCopy3 = await manager.untitled.resolve({ untitledResource: URI.file("/invalid/untitled") });
    assert.strictEqual(workingCopy3.resource.scheme, Schemas.untitled);
    workingCopy1.dispose();
    workingCopy2.dispose();
    workingCopy3.dispose();
  });
  test("resolve - untitled resource used for new working copy", async () => {
    const invalidUntitledResource = URI.file("my/untitled.txt");
    const validUntitledResource = invalidUntitledResource.with({ scheme: Schemas.untitled });
    const workingCopy1 = await manager.untitled.resolve({ untitledResource: invalidUntitledResource });
    assert.notStrictEqual(workingCopy1.resource.toString(), invalidUntitledResource.toString());
    const workingCopy2 = await manager.untitled.resolve({ untitledResource: validUntitledResource });
    assert.strictEqual(workingCopy2.resource.toString(), validUntitledResource.toString());
    workingCopy1.dispose();
    workingCopy2.dispose();
  });
  test("resolve - with associated resource", async () => {
    const workingCopy = await manager.untitled.resolve({ associatedResource: { path: "/some/associated.txt" } });
    assert.strictEqual(workingCopy.hasAssociatedFilePath, true);
    assert.strictEqual(workingCopy.resource.path, "/some/associated.txt");
    workingCopy.dispose();
  });
  test("save - without associated resource", async () => {
    let savedEvent = void 0;
    disposables.add(manager.untitled.onDidSave((e) => {
      savedEvent = e;
    }));
    const workingCopy = await manager.untitled.resolve();
    workingCopy.model?.updateContents("Simple Save");
    accessor.fileDialogService.setPickFileToSave(URI.file("simple/file.txt"));
    const result = await workingCopy.save();
    assert.ok(result);
    assert.strictEqual(manager.untitled.get(workingCopy.resource), void 0);
    assert.strictEqual(savedEvent.source.toString(), workingCopy.resource.toString());
    assert.strictEqual(savedEvent.target.toString(), URI.file("simple/file.txt").toString());
    workingCopy.dispose();
  });
  test("save - with associated resource", async () => {
    let savedEvent = void 0;
    disposables.add(manager.untitled.onDidSave((e) => {
      savedEvent = e;
    }));
    const workingCopy = await manager.untitled.resolve({ associatedResource: { path: "/some/associated.txt" } });
    workingCopy.model?.updateContents("Simple Save with associated resource");
    accessor.fileService.notExistsSet.set(URI.from({ scheme: Schemas.file, path: "/some/associated.txt" }), true);
    const result = await workingCopy.save();
    assert.ok(result);
    assert.strictEqual(manager.untitled.get(workingCopy.resource), void 0);
    assert.strictEqual(savedEvent.source.toString(), workingCopy.resource.toString());
    assert.strictEqual(savedEvent.target.toString(), URI.file("/some/associated.txt").toString());
    workingCopy.dispose();
  });
  test("save - with associated resource (asks to overwrite)", async () => {
    const workingCopy = await manager.untitled.resolve({ associatedResource: { path: "/some/associated.txt" } });
    workingCopy.model?.updateContents("Simple Save with associated resource");
    let result = await workingCopy.save();
    assert.ok(!result);
    assert.strictEqual(manager.untitled.get(workingCopy.resource), workingCopy);
    accessor.dialogService.setConfirmResult({ confirmed: true });
    result = await workingCopy.save();
    assert.ok(result);
    assert.strictEqual(manager.untitled.get(workingCopy.resource), void 0);
    workingCopy.dispose();
  });
  test("destroy", async () => {
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    await manager.untitled.resolve();
    await manager.untitled.resolve();
    await manager.untitled.resolve();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 3);
    assert.strictEqual(manager.untitled.workingCopies.length, 3);
    await manager.untitled.destroy();
    assert.strictEqual(accessor.workingCopyService.workingCopies.length, 0);
    assert.strictEqual(manager.untitled.workingCopies.length, 0);
  });
  test("manager with different types produce different URIs", async () => {
    try {
      manager = disposables.add(new FileWorkingCopyManager(
        "someOtherUntitledTypeId",
        new TestStoredFileWorkingCopyModelFactory(),
        new TestUntitledFileWorkingCopyModelFactory(),
        accessor.fileService,
        accessor.lifecycleService,
        accessor.labelService,
        accessor.logService,
        accessor.workingCopyFileService,
        accessor.workingCopyBackupService,
        accessor.uriIdentityService,
        accessor.fileDialogService,
        accessor.filesConfigurationService,
        accessor.workingCopyService,
        accessor.notificationService,
        accessor.workingCopyEditorService,
        accessor.editorService,
        accessor.elevatedFileService,
        accessor.pathService,
        accessor.environmentService,
        accessor.dialogService,
        accessor.decorationsService,
        accessor.progressService
      ));
      const untitled1OriginalType = disposables.add(await manager.untitled.resolve());
      const untitled1OtherType = disposables.add(await manager.untitled.resolve());
      assert.notStrictEqual(untitled1OriginalType.resource.toString(), untitled1OtherType.resource.toString());
    } finally {
      manager.destroy();
    }
  });
  test("manager without typeId produces backwards compatible URIs", async () => {
    try {
      manager = disposables.add(new FileWorkingCopyManager(
        NO_TYPE_ID,
        new TestStoredFileWorkingCopyModelFactory(),
        new TestUntitledFileWorkingCopyModelFactory(),
        accessor.fileService,
        accessor.lifecycleService,
        accessor.labelService,
        accessor.logService,
        accessor.workingCopyFileService,
        accessor.workingCopyBackupService,
        accessor.uriIdentityService,
        accessor.fileDialogService,
        accessor.filesConfigurationService,
        accessor.workingCopyService,
        accessor.notificationService,
        accessor.workingCopyEditorService,
        accessor.editorService,
        accessor.elevatedFileService,
        accessor.pathService,
        accessor.environmentService,
        accessor.dialogService,
        accessor.decorationsService,
        accessor.progressService
      ));
      const result = disposables.add(await manager.untitled.resolve());
      assert.strictEqual(result.resource.scheme, Schemas.untitled);
      assert.ok(result.resource.path.length > 0);
      assert.strictEqual(result.resource.query, "");
      assert.strictEqual(result.resource.authority, "");
      assert.strictEqual(result.resource.fragment, "");
    } finally {
      manager.destroy();
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9icm93c2VyL3VudGl0bGVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgYnVmZmVyVG9TdHJlYW0sIFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IEZpbGVXb3JraW5nQ29weU1hbmFnZXIsIElGaWxlV29ya2luZ0NvcHlNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2ZpbGVXb3JraW5nQ29weU1hbmFnZXIuanMnO1xuaW1wb3J0IHsgTk9fVFlQRV9JRCwgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMgfSBmcm9tICcuLi8uLi9jb21tb24vd29ya2luZ0NvcHkuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBUZXN0U3RvcmVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5IH0gZnJvbSAnLi9zdG9yZWRGaWxlV29ya2luZ0NvcHkudGVzdC5qcyc7XG5pbXBvcnQgeyBUZXN0VW50aXRsZWRGaWxlV29ya2luZ0NvcHlNb2RlbCwgVGVzdFVudGl0bGVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5IH0gZnJvbSAnLi91bnRpdGxlZEZpbGVXb3JraW5nQ29weS50ZXN0LmpzJztcbmltcG9ydCB7IFRlc3RJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciwgVGVzdFNlcnZpY2VBY2Nlc3Nvciwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuc3VpdGUoJ1VudGl0bGVkRmlsZVdvcmtpbmdDb3B5TWFuYWdlcicsICgpID0+IHtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBhY2Nlc3NvcjogVGVzdFNlcnZpY2VBY2Nlc3NvcjtcblxuXHRsZXQgbWFuYWdlcjogSUZpbGVXb3JraW5nQ29weU1hbmFnZXI8VGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsLCBUZXN0VW50aXRsZWRGaWxlV29ya2luZ0NvcHlNb2RlbD47XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0YWNjZXNzb3IgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U2VydmljZUFjY2Vzc29yKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5maWxlU2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0SW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IuZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLnZzY29kZVJlbW90ZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0SW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSkpKTtcblxuXHRcdG1hbmFnZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbGVXb3JraW5nQ29weU1hbmFnZXIoXG5cdFx0XHQndGVzdFVudGl0bGVkRmlsZVdvcmtpbmdDb3B5VHlwZScsXG5cdFx0XHRuZXcgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeSgpLFxuXHRcdFx0bmV3IFRlc3RVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeSgpLFxuXHRcdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UsIGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UsIGFjY2Vzc29yLmxhYmVsU2VydmljZSwgYWNjZXNzb3IubG9nU2VydmljZSxcblx0XHRcdGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgYWNjZXNzb3IudXJpSWRlbnRpdHlTZXJ2aWNlLCBhY2Nlc3Nvci5maWxlRGlhbG9nU2VydmljZSxcblx0XHRcdGFjY2Vzc29yLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZSwgYWNjZXNzb3Iubm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRcdGFjY2Vzc29yLndvcmtpbmdDb3B5RWRpdG9yU2VydmljZSwgYWNjZXNzb3IuZWRpdG9yU2VydmljZSwgYWNjZXNzb3IuZWxldmF0ZWRGaWxlU2VydmljZSwgYWNjZXNzb3IucGF0aFNlcnZpY2UsXG5cdFx0XHRhY2Nlc3Nvci5lbnZpcm9ubWVudFNlcnZpY2UsIGFjY2Vzc29yLmRpYWxvZ1NlcnZpY2UsIGFjY2Vzc29yLmRlY29yYXRpb25zU2VydmljZSwgYWNjZXNzb3IucHJvZ3Jlc3NTZXJ2aWNlXG5cdFx0KSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRmb3IgKGNvbnN0IHdvcmtpbmdDb3B5IG9mIFsuLi5tYW5hZ2VyLnVudGl0bGVkLndvcmtpbmdDb3BpZXMsIC4uLm1hbmFnZXIuc3RvcmVkLndvcmtpbmdDb3BpZXNdKSB7XG5cdFx0XHR3b3JraW5nQ29weS5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgnYmFzaWNzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBjcmVhdGVDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci51bnRpdGxlZC5vbkRpZENyZWF0ZShlID0+IHtcblx0XHRcdGNyZWF0ZUNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRsZXQgZGlzcG9zZUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLnVudGl0bGVkLm9uV2lsbERpc3Bvc2UoZSA9PiB7XG5cdFx0XHRkaXNwb3NlQ291bnRlcisrO1xuXHRcdH0pKTtcblxuXHRcdGxldCBkaXJ0eUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLnVudGl0bGVkLm9uRGlkQ2hhbmdlRGlydHkoZSA9PiB7XG5cdFx0XHRkaXJ0eUNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC53b3JraW5nQ29waWVzLmxlbmd0aCwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC5nZXQoVVJJLmZpbGUoJy9zb21lL2ludmFsaWRQYXRoJykpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLnVudGl0bGVkLmdldChVUkkuZmlsZSgnL3NvbWUvaW52YWxpZFBhdGgnKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnVudGl0bGVkIH0pKSwgdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MSA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSgpO1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MiA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS50eXBlSWQsICd0ZXN0VW50aXRsZWRGaWxlV29ya2luZ0NvcHlUeXBlJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5yZXNvdXJjZS5zY2hlbWUsIFNjaGVtYXMudW50aXRsZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUNvdW50ZXIsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIudW50aXRsZWQuZ2V0KHdvcmtpbmdDb3B5MS5yZXNvdXJjZSksIHdvcmtpbmdDb3B5MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIudW50aXRsZWQuZ2V0KHdvcmtpbmdDb3B5Mi5yZXNvdXJjZSksIHdvcmtpbmdDb3B5Mik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC53b3JraW5nQ29waWVzLmxlbmd0aCwgMik7XG5cblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwod29ya2luZ0NvcHkxLnJlc291cmNlLnRvU3RyaW5nKCksIHdvcmtpbmdDb3B5Mi5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGZvciAoY29uc3Qgd29ya2luZ0NvcHkgb2YgW3dvcmtpbmdDb3B5MSwgd29ya2luZ0NvcHkyXSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmNhcGFiaWxpdGllcywgV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuVW50aXRsZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzRGlydHkoKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Lm9rKHdvcmtpbmdDb3B5Lm1vZGVsKTtcblx0XHR9XG5cblx0XHR3b3JraW5nQ29weTEubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdIZWxsbyBXb3JsZCcpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5pc0RpcnR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEuaXNNb2RpZmllZCgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHlDb3VudGVyLCAxKTtcblxuXHRcdHdvcmtpbmdDb3B5MS5tb2RlbD8udXBkYXRlQ29udGVudHMoJycpOyAvLyBjaGFuZ2UgdG8gZW1wdHkgY2xlYXJzIGRpcnR5L21vZGlmaWVkIGZsYWdzXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkxLmlzTW9kaWZpZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eUNvdW50ZXIsIDIpO1xuXG5cdFx0d29ya2luZ0NvcHkyLm1vZGVsPy5maXJlQ29udGVudENoYW5nZUV2ZW50KHsgaXNJbml0aWFsOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkyLmlzRGlydHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Mi5pc01vZGlmaWVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eUNvdW50ZXIsIDMpO1xuXG5cdFx0d29ya2luZ0NvcHkxLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLnVudGl0bGVkLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC5nZXQod29ya2luZ0NvcHkxLnJlc291cmNlKSwgdW5kZWZpbmVkKTtcblxuXHRcdHdvcmtpbmdDb3B5Mi5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC53b3JraW5nQ29waWVzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1hbmFnZXIudW50aXRsZWQuZ2V0KHdvcmtpbmdDb3B5Mi5yZXNvdXJjZSksIHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlzcG9zZUNvdW50ZXIsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaXJ0eSAtIHNjcmF0Y2hwYWRzIGFyZSBuZXZlciBkaXJ0eScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgZGlydHlDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci51bnRpdGxlZC5vbkRpZENoYW5nZURpcnR5KGUgPT4ge1xuXHRcdFx0ZGlydHlDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkxID0gYXdhaXQgbWFuYWdlci5yZXNvbHZlKHtcblx0XHRcdHVudGl0bGVkUmVzb3VyY2U6IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLnVudGl0bGVkLCBwYXRoOiBgL215c2NyYXRjaHBhZGAgfSksXG5cdFx0XHRpc1NjcmF0Y2hwYWQ6IHRydWVcblx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEucmVzb3VyY2Uuc2NoZW1lLCBTY2hlbWFzLnVudGl0bGVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC53b3JraW5nQ29waWVzLmxlbmd0aCwgMSk7XG5cblx0XHR3b3JraW5nQ29weTEubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdjb250ZW50cycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5pc01vZGlmaWVkKCksIHRydWUpO1xuXG5cdFx0d29ya2luZ0NvcHkxLm1vZGVsPy5maXJlQ29udGVudENoYW5nZUV2ZW50KHsgaXNJbml0aWFsOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEuaXNEaXJ0eSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5pc01vZGlmaWVkKCksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eUNvdW50ZXIsIDApO1xuXG5cdFx0d29ya2luZ0NvcHkxLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAtIHdpdGggaW5pdGlhbCB2YWx1ZScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgZGlydHlDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci51bnRpdGxlZC5vbkRpZENoYW5nZURpcnR5KGUgPT4ge1xuXHRcdFx0ZGlydHlDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkxID0gYXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKHsgY29udGVudHM6IHsgdmFsdWU6IGJ1ZmZlclRvU3RyZWFtKFZTQnVmZmVyLmZyb21TdHJpbmcoJ0hlbGxvIFdvcmxkJykpIH0gfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkxLmlzTW9kaWZpZWQoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MS5pc0RpcnR5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eUNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTEubW9kZWw/LmNvbnRlbnRzLCAnSGVsbG8gV29ybGQnKTtcblxuXHRcdHdvcmtpbmdDb3B5MS5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weTIgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoeyBjb250ZW50czogeyB2YWx1ZTogYnVmZmVyVG9TdHJlYW0oVlNCdWZmZXIuZnJvbVN0cmluZygnSGVsbG8gV29ybGQnKSksIG1hcmtNb2RpZmllZDogdHJ1ZSB9IH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Mi5pc01vZGlmaWVkKCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weTIuaXNEaXJ0eSgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHlDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkyLm1vZGVsPy5jb250ZW50cywgJ0hlbGxvIFdvcmxkJyk7XG5cblx0XHR3b3JraW5nQ29weTIuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIC0gd2l0aCBpbml0aWFsIHZhbHVlIGJ1dCBtYXJrRGlydHk6IGZhbHNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBkaXJ0eUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLnVudGl0bGVkLm9uRGlkQ2hhbmdlRGlydHkoZSA9PiB7XG5cdFx0XHRkaXJ0eUNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSh7IGNvbnRlbnRzOiB7IHZhbHVlOiBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCdIZWxsbyBXb3JsZCcpKSwgbWFya01vZGlmaWVkOiBmYWxzZSB9IH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LmlzTW9kaWZpZWQoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weS5pc0RpcnR5KCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHlDb3VudGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkubW9kZWw/LmNvbnRlbnRzLCAnSGVsbG8gV29ybGQnKTtcblxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBiZWdpbnMgY291bnRlciBmcm9tIDEgZm9yIGRpc3Bvc2VkIHVudGl0bGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHVudGl0bGVkMSA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSgpO1xuXHRcdHVudGl0bGVkMS5kaXNwb3NlKCk7XG5cblx0XHRjb25zdCB1bnRpdGxlZDFBZ2FpbiA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkMS5yZXNvdXJjZS50b1N0cmluZygpLCB1bnRpdGxlZDFBZ2Fpbi5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAtIGV4aXN0aW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBjcmVhdGVDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci51bnRpdGxlZC5vbkRpZENyZWF0ZShlID0+IHtcblx0XHRcdGNyZWF0ZUNvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weTEgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlQ291bnRlciwgMSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weTIgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoeyB1bnRpdGxlZFJlc291cmNlOiB3b3JraW5nQ29weTEucmVzb3VyY2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5MSwgd29ya2luZ0NvcHkyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY3JlYXRlQ291bnRlciwgMSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weTMgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoeyB1bnRpdGxlZFJlc291cmNlOiBVUkkuZmlsZSgnL2ludmFsaWQvdW50aXRsZWQnKSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHkzLnJlc291cmNlLnNjaGVtZSwgU2NoZW1hcy51bnRpdGxlZCk7XG5cblx0XHR3b3JraW5nQ29weTEuZGlzcG9zZSgpO1xuXHRcdHdvcmtpbmdDb3B5Mi5kaXNwb3NlKCk7XG5cdFx0d29ya2luZ0NvcHkzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSAtIHVudGl0bGVkIHJlc291cmNlIHVzZWQgZm9yIG5ldyB3b3JraW5nIGNvcHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaW52YWxpZFVudGl0bGVkUmVzb3VyY2UgPSBVUkkuZmlsZSgnbXkvdW50aXRsZWQudHh0Jyk7XG5cdFx0Y29uc3QgdmFsaWRVbnRpdGxlZFJlc291cmNlID0gaW52YWxpZFVudGl0bGVkUmVzb3VyY2Uud2l0aCh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCB9KTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5MSA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSh7IHVudGl0bGVkUmVzb3VyY2U6IGludmFsaWRVbnRpdGxlZFJlc291cmNlIH0pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh3b3JraW5nQ29weTEucmVzb3VyY2UudG9TdHJpbmcoKSwgaW52YWxpZFVudGl0bGVkUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weTIgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoeyB1bnRpdGxlZFJlc291cmNlOiB2YWxpZFVudGl0bGVkUmVzb3VyY2UgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Mi5yZXNvdXJjZS50b1N0cmluZygpLCB2YWxpZFVudGl0bGVkUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHR3b3JraW5nQ29weTEuZGlzcG9zZSgpO1xuXHRcdHdvcmtpbmdDb3B5Mi5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgLSB3aXRoIGFzc29jaWF0ZWQgcmVzb3VyY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHkgPSBhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoeyBhc3NvY2lhdGVkUmVzb3VyY2U6IHsgcGF0aDogJy9zb21lL2Fzc29jaWF0ZWQudHh0JyB9IH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5Lmhhc0Fzc29jaWF0ZWRGaWxlUGF0aCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5LnJlc291cmNlLnBhdGgsICcvc29tZS9hc3NvY2lhdGVkLnR4dCcpO1xuXG5cdFx0d29ya2luZ0NvcHkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlIC0gd2l0aG91dCBhc3NvY2lhdGVkIHJlc291cmNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBzYXZlZEV2ZW50OiB7IHNvdXJjZTogVVJJOyB0YXJnZXQ6IFVSSSB9IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtYW5hZ2VyLnVudGl0bGVkLm9uRGlkU2F2ZShlID0+IHtcblx0XHRcdHNhdmVkRXZlbnQgPSBlO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKCk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdTaW1wbGUgU2F2ZScpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZURpYWxvZ1NlcnZpY2Uuc2V0UGlja0ZpbGVUb1NhdmUoVVJJLmZpbGUoJ3NpbXBsZS9maWxlLnR4dCcpKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQub2socmVzdWx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLnVudGl0bGVkLmdldCh3b3JraW5nQ29weS5yZXNvdXJjZSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkRXZlbnQhLnNvdXJjZS50b1N0cmluZygpLCB3b3JraW5nQ29weS5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZWRFdmVudCEudGFyZ2V0LnRvU3RyaW5nKCksIFVSSS5maWxlKCdzaW1wbGUvZmlsZS50eHQnKS50b1N0cmluZygpKTtcblxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSAtIHdpdGggYXNzb2NpYXRlZCByZXNvdXJjZScsIGFzeW5jICgpID0+IHtcblx0XHRsZXQgc2F2ZWRFdmVudDogeyBzb3VyY2U6IFVSSTsgdGFyZ2V0OiBVUkkgfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRkaXNwb3NhYmxlcy5hZGQobWFuYWdlci51bnRpdGxlZC5vbkRpZFNhdmUoZSA9PiB7XG5cdFx0XHRzYXZlZEV2ZW50ID0gZTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB3b3JraW5nQ29weSA9IGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSh7IGFzc29jaWF0ZWRSZXNvdXJjZTogeyBwYXRoOiAnL3NvbWUvYXNzb2NpYXRlZC50eHQnIH0gfSk7XG5cdFx0d29ya2luZ0NvcHkubW9kZWw/LnVwZGF0ZUNvbnRlbnRzKCdTaW1wbGUgU2F2ZSB3aXRoIGFzc29jaWF0ZWQgcmVzb3VyY2UnKTtcblxuXHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLm5vdEV4aXN0c1NldC5zZXQoVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMuZmlsZSwgcGF0aDogJy9zb21lL2Fzc29jaWF0ZWQudHh0JyB9KSwgdHJ1ZSk7XG5cblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB3b3JraW5nQ29weS5zYXZlKCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC5nZXQod29ya2luZ0NvcHkucmVzb3VyY2UpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlZEV2ZW50IS5zb3VyY2UudG9TdHJpbmcoKSwgd29ya2luZ0NvcHkucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhdmVkRXZlbnQhLnRhcmdldC50b1N0cmluZygpLCBVUkkuZmlsZSgnL3NvbWUvYXNzb2NpYXRlZC50eHQnKS50b1N0cmluZygpKTtcblxuXHRcdHdvcmtpbmdDb3B5LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZSAtIHdpdGggYXNzb2NpYXRlZCByZXNvdXJjZSAoYXNrcyB0byBvdmVyd3JpdGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHdvcmtpbmdDb3B5ID0gYXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKHsgYXNzb2NpYXRlZFJlc291cmNlOiB7IHBhdGg6ICcvc29tZS9hc3NvY2lhdGVkLnR4dCcgfSB9KTtcblx0XHR3b3JraW5nQ29weS5tb2RlbD8udXBkYXRlQ29udGVudHMoJ1NpbXBsZSBTYXZlIHdpdGggYXNzb2NpYXRlZCByZXNvdXJjZScpO1xuXG5cdFx0bGV0IHJlc3VsdCA9IGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQub2soIXJlc3VsdCk7IC8vIG5vdCBjb25maXJtZWRcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLnVudGl0bGVkLmdldCh3b3JraW5nQ29weS5yZXNvdXJjZSksIHdvcmtpbmdDb3B5KTtcblxuXHRcdGFjY2Vzc29yLmRpYWxvZ1NlcnZpY2Uuc2V0Q29uZmlybVJlc3VsdCh7IGNvbmZpcm1lZDogdHJ1ZSB9KTtcblxuXHRcdHJlc3VsdCA9IGF3YWl0IHdvcmtpbmdDb3B5LnNhdmUoKTtcblx0XHRhc3NlcnQub2socmVzdWx0KTsgLy8gY29uZmlybWVkXG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC5nZXQod29ya2luZ0NvcHkucmVzb3VyY2UpLCB1bmRlZmluZWQpO1xuXG5cdFx0d29ya2luZ0NvcHkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZXN0cm95JywgYXN5bmMgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXG5cdFx0YXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKCk7XG5cdFx0YXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKCk7XG5cdFx0YXdhaXQgbWFuYWdlci51bnRpdGxlZC5yZXNvbHZlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFuYWdlci51bnRpdGxlZC53b3JraW5nQ29waWVzLmxlbmd0aCwgMyk7XG5cblx0XHRhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLmRlc3Ryb3koKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2Uud29ya2luZ0NvcGllcy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYW5hZ2VyLnVudGl0bGVkLndvcmtpbmdDb3BpZXMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnbWFuYWdlciB3aXRoIGRpZmZlcmVudCB0eXBlcyBwcm9kdWNlIGRpZmZlcmVudCBVUklzJywgYXN5bmMgKCkgPT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRtYW5hZ2VyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlV29ya2luZ0NvcHlNYW5hZ2VyKFxuXHRcdFx0XHQnc29tZU90aGVyVW50aXRsZWRUeXBlSWQnLFxuXHRcdFx0XHRuZXcgVGVzdFN0b3JlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeSgpLFxuXHRcdFx0XHRuZXcgVGVzdFVudGl0bGVkRmlsZVdvcmtpbmdDb3B5TW9kZWxGYWN0b3J5KCksXG5cdFx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci5saWZlY3ljbGVTZXJ2aWNlLCBhY2Nlc3Nvci5sYWJlbFNlcnZpY2UsIGFjY2Vzc29yLmxvZ1NlcnZpY2UsXG5cdFx0XHRcdGFjY2Vzc29yLndvcmtpbmdDb3B5RmlsZVNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgYWNjZXNzb3IudXJpSWRlbnRpdHlTZXJ2aWNlLCBhY2Nlc3Nvci5maWxlRGlhbG9nU2VydmljZSxcblx0XHRcdFx0YWNjZXNzb3IuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLCBhY2Nlc3Nvci5ub3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHRhY2Nlc3Nvci53b3JraW5nQ29weUVkaXRvclNlcnZpY2UsIGFjY2Vzc29yLmVkaXRvclNlcnZpY2UsIGFjY2Vzc29yLmVsZXZhdGVkRmlsZVNlcnZpY2UsIGFjY2Vzc29yLnBhdGhTZXJ2aWNlLFxuXHRcdFx0XHRhY2Nlc3Nvci5lbnZpcm9ubWVudFNlcnZpY2UsIGFjY2Vzc29yLmRpYWxvZ1NlcnZpY2UsIGFjY2Vzc29yLmRlY29yYXRpb25zU2VydmljZSwgYWNjZXNzb3IucHJvZ3Jlc3NTZXJ2aWNlXG5cdFx0XHQpKTtcblxuXHRcdFx0Y29uc3QgdW50aXRsZWQxT3JpZ2luYWxUeXBlID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IG1hbmFnZXIudW50aXRsZWQucmVzb2x2ZSgpKTtcblx0XHRcdGNvbnN0IHVudGl0bGVkMU90aGVyVHlwZSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoKSk7XG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh1bnRpdGxlZDFPcmlnaW5hbFR5cGUucmVzb3VyY2UudG9TdHJpbmcoKSwgdW50aXRsZWQxT3RoZXJUeXBlLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtYW5hZ2VyLmRlc3Ryb3koKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ21hbmFnZXIgd2l0aG91dCB0eXBlSWQgcHJvZHVjZXMgYmFja3dhcmRzIGNvbXBhdGlibGUgVVJJcycsIGFzeW5jICgpID0+IHtcblx0XHR0cnkge1xuXHRcdFx0bWFuYWdlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmlsZVdvcmtpbmdDb3B5TWFuYWdlcihcblx0XHRcdFx0Tk9fVFlQRV9JRCxcblx0XHRcdFx0bmV3IFRlc3RTdG9yZWRGaWxlV29ya2luZ0NvcHlNb2RlbEZhY3RvcnkoKSxcblx0XHRcdFx0bmV3IFRlc3RVbnRpdGxlZEZpbGVXb3JraW5nQ29weU1vZGVsRmFjdG9yeSgpLFxuXHRcdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZSwgYWNjZXNzb3IubGlmZWN5Y2xlU2VydmljZSwgYWNjZXNzb3IubGFiZWxTZXJ2aWNlLCBhY2Nlc3Nvci5sb2dTZXJ2aWNlLFxuXHRcdFx0XHRhY2Nlc3Nvci53b3JraW5nQ29weUZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIGFjY2Vzc29yLnVyaUlkZW50aXR5U2VydmljZSwgYWNjZXNzb3IuZmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0XHRcdGFjY2Vzc29yLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsIGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZSwgYWNjZXNzb3Iubm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRcdFx0YWNjZXNzb3Iud29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLCBhY2Nlc3Nvci5lbGV2YXRlZEZpbGVTZXJ2aWNlLCBhY2Nlc3Nvci5wYXRoU2VydmljZSxcblx0XHRcdFx0YWNjZXNzb3IuZW52aXJvbm1lbnRTZXJ2aWNlLCBhY2Nlc3Nvci5kaWFsb2dTZXJ2aWNlLCBhY2Nlc3Nvci5kZWNvcmF0aW9uc1NlcnZpY2UsIGFjY2Vzc29yLnByb2dyZXNzU2VydmljZVxuXHRcdFx0KSk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBtYW5hZ2VyLnVudGl0bGVkLnJlc29sdmUoKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnJlc291cmNlLnNjaGVtZSwgU2NoZW1hcy51bnRpdGxlZCk7XG5cdFx0XHRhc3NlcnQub2socmVzdWx0LnJlc291cmNlLnBhdGgubGVuZ3RoID4gMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnJlc291cmNlLnF1ZXJ5LCAnJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnJlc291cmNlLmF1dGhvcml0eSwgJycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5yZXNvdXJjZS5mcmFnbWVudCwgJycpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRtYW5hZ2VyLmRlc3Ryb3koKTtcblx0XHR9XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0IsZ0JBQWdCO0FBQ3pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyw4QkFBdUQ7QUFDaEUsU0FBUyxZQUFZLCtCQUErQjtBQUNwRCxTQUF5Qyw2Q0FBNkM7QUFDdEYsU0FBMkMsK0NBQStDO0FBQzFGLFNBQVMsZ0NBQWdDLHFCQUFxQixxQ0FBcUM7QUFFbkcsTUFBTSxrQ0FBa0MsTUFBTTtBQUU3QyxRQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsTUFBSTtBQUNKLE1BQUk7QUFFSixNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsMkJBQXVCLDhCQUE4QixRQUFXLFdBQVc7QUFDM0UsZUFBVyxxQkFBcUIsZUFBZSxtQkFBbUI7QUFFbEUsZ0JBQVksSUFBSSxTQUFTLFlBQVksaUJBQWlCLFFBQVEsTUFBTSxZQUFZLElBQUksSUFBSSwrQkFBK0IsQ0FBQyxDQUFDLENBQUM7QUFDMUgsZ0JBQVksSUFBSSxT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
