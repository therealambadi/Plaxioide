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
import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { IEditorService } from "../../../editor/common/editorService.js";
import { IEditorGroupsService } from "../../../editor/common/editorGroupsService.js";
import { EditorService } from "../../../editor/browser/editorService.js";
import { IWorkingCopyBackupService } from "../../common/workingCopyBackup.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { IFilesConfigurationService } from "../../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../../common/workingCopyService.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { ILifecycleService, LifecyclePhase } from "../../../lifecycle/common/lifecycle.js";
import { UntitledTextEditorInput } from "../../../untitled/common/untitledTextEditorInput.js";
import { createEditorPart, InMemoryTestWorkingCopyBackupService, registerTestResourceEditor, TestServiceAccessor, toTypedWorkingCopyId, toUntypedWorkingCopyId, workbenchInstantiationService, workbenchTeardown } from "../../../../test/browser/workbenchTestServices.js";
import { TestWorkingCopy } from "../../../../test/common/workbenchTestServices.js";
import { timeout } from "../../../../../base/common/async.js";
import { BrowserWorkingCopyBackupTracker } from "../../browser/workingCopyBackupTracker.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { IWorkingCopyEditorService } from "../../common/workingCopyEditorService.js";
import { bufferToReadable, VSBuffer } from "../../../../../base/common/buffer.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { Schemas } from "../../../../../base/common/network.js";
suite("WorkingCopyBackupTracker (browser)", function() {
  let accessor;
  const disposables = new DisposableStore();
  setup(() => {
    disposables.add(registerTestResourceEditor());
  });
  teardown(async () => {
    await workbenchTeardown(accessor.instantiationService);
    disposables.clear();
  });
  let TestWorkingCopyBackupTracker = class extends BrowserWorkingCopyBackupTracker {
    constructor(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, logService, workingCopyEditorService, editorService, editorGroupService) {
      super(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, logService, workingCopyEditorService, editorService, editorGroupService);
    }
    getBackupScheduleDelay() {
      return 10;
    }
    get pendingBackupOperationCount() {
      return this.pendingBackupOperations.size;
    }
    getUnrestoredBackups() {
      return this.unrestoredBackups;
    }
    async testRestoreBackups(handler) {
      return super.restoreBackups(handler);
    }
  };
  TestWorkingCopyBackupTracker = __decorateClass([
    __decorateParam(0, IWorkingCopyBackupService),
    __decorateParam(1, IFilesConfigurationService),
    __decorateParam(2, IWorkingCopyService),
    __decorateParam(3, ILifecycleService),
    __decorateParam(4, ILogService),
    __decorateParam(5, IWorkingCopyEditorService),
    __decorateParam(6, IEditorService),
    __decorateParam(7, IEditorGroupsService)
  ], TestWorkingCopyBackupTracker);
  class TestUntitledTextEditorInput extends UntitledTextEditorInput {
    constructor() {
      super(...arguments);
      this.resolved = false;
    }
    resolve() {
      this.resolved = true;
      return super.resolve();
    }
  }
  async function createTracker() {
    const workingCopyBackupService = disposables.add(new InMemoryTestWorkingCopyBackupService());
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    instantiationService.stub(IWorkingCopyBackupService, workingCopyBackupService);
    const part = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, part);
    disposables.add(registerTestResourceEditor());
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    const tracker = disposables.add(instantiationService.createInstance(TestWorkingCopyBackupTracker));
    return { accessor, part, tracker, workingCopyBackupService, instantiationService };
  }
  async function untitledBackupTest(untitled = { resource: void 0 }) {
    const { accessor: accessor2, workingCopyBackupService } = await createTracker();
    const untitledTextEditor = disposables.add((await accessor2.editorService.openEditor(untitled))?.input);
    const untitledTextModel = disposables.add(await untitledTextEditor.resolve());
    if (!untitled?.contents) {
      untitledTextModel.textEditorModel?.setValue("Super Good");
    }
    await workingCopyBackupService.joinBackupResource();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(untitledTextModel), true);
    untitledTextModel.dispose();
    await workingCopyBackupService.joinDiscardBackup();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(untitledTextModel), false);
  }
  test("Track backups (untitled)", function() {
    return untitledBackupTest();
  });
  test("Track backups (untitled with initial contents)", function() {
    return untitledBackupTest({ resource: void 0, contents: "Foo Bar" });
  });
  test("Track backups (custom)", async function() {
    const { accessor: accessor2, tracker, workingCopyBackupService } = await createTracker();
    class TestBackupWorkingCopy extends TestWorkingCopy {
      constructor(resource2) {
        super(resource2);
        this.backupDelay = 10;
        disposables.add(accessor2.workingCopyService.registerWorkingCopy(this));
      }
      async backup(token) {
        await timeout(0);
        return {};
      }
    }
    const resource = toResource.call(this, "/path/custom.txt");
    const customWorkingCopy = disposables.add(new TestBackupWorkingCopy(resource));
    customWorkingCopy.setDirty(true);
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    await workingCopyBackupService.joinBackupResource();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(customWorkingCopy), true);
    customWorkingCopy.setDirty(false);
    customWorkingCopy.setDirty(true);
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    await workingCopyBackupService.joinBackupResource();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(customWorkingCopy), true);
    customWorkingCopy.setDirty(false);
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    await workingCopyBackupService.joinDiscardBackup();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(customWorkingCopy), false);
    customWorkingCopy.setDirty(true);
    await timeout(0);
    customWorkingCopy.setDirty(false);
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    await workingCopyBackupService.joinDiscardBackup();
    assert.strictEqual(workingCopyBackupService.hasBackupSync(customWorkingCopy), false);
  });
  async function restoreBackupsInit() {
    const fooFile = URI.file(isWindows ? "c:\\Foo" : "/Foo");
    const barFile = URI.file(isWindows ? "c:\\Bar" : "/Bar");
    const untitledFile1 = URI.from({ scheme: Schemas.untitled, path: "Untitled-1" });
    const untitledFile2 = URI.from({ scheme: Schemas.untitled, path: "Untitled-2" });
    const workingCopyBackupService = disposables.add(new InMemoryTestWorkingCopyBackupService());
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    instantiationService.stub(IWorkingCopyBackupService, workingCopyBackupService);
    const part = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, part);
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    const untitledFile1WorkingCopyId = toUntypedWorkingCopyId(untitledFile1);
    const untitledFile2WorkingCopyId = toTypedWorkingCopyId(untitledFile2);
    await workingCopyBackupService.backup(untitledFile1WorkingCopyId, bufferToReadable(VSBuffer.fromString("untitled-1")));
    await workingCopyBackupService.backup(untitledFile2WorkingCopyId, bufferToReadable(VSBuffer.fromString("untitled-2")));
    const fooFileWorkingCopyId = toUntypedWorkingCopyId(fooFile);
    const barFileWorkingCopyId = toTypedWorkingCopyId(barFile);
    await workingCopyBackupService.backup(fooFileWorkingCopyId, bufferToReadable(VSBuffer.fromString("fooFile")));
    await workingCopyBackupService.backup(barFileWorkingCopyId, bufferToReadable(VSBuffer.fromString("barFile")));
    const tracker = disposables.add(instantiationService.createInstance(TestWorkingCopyBackupTracker));
    accessor.lifecycleService.phase = LifecyclePhase.Restored;
    return [tracker, accessor];
  }
  test("Restore backups (basics, some handled)", async function() {
    const [tracker, accessor2] = await restoreBackupsInit();
    assert.strictEqual(tracker.getUnrestoredBackups().size, 0);
    let handlesCounter = 0;
    let isOpenCounter = 0;
    let createEditorCounter = 0;
    await tracker.testRestoreBackups({
      handles: (workingCopy) => {
        handlesCounter++;
        return workingCopy.typeId === "testBackupTypeId";
      },
      isOpen: (workingCopy, editor) => {
        isOpenCounter++;
        return false;
      },
      createEditor: (workingCopy) => {
        createEditorCounter++;
        return disposables.add(accessor2.instantiationService.createInstance(TestUntitledTextEditorInput, accessor2.untitledTextEditorService.create({ initialValue: "foo" })));
      }
    });
    assert.strictEqual(handlesCounter, 4);
    assert.strictEqual(isOpenCounter, 0);
    assert.strictEqual(createEditorCounter, 2);
    assert.strictEqual(accessor2.editorService.count, 2);
    assert.ok(accessor2.editorService.editors.every((editor) => editor.isDirty()));
    assert.strictEqual(tracker.getUnrestoredBackups().size, 2);
    for (const editor of accessor2.editorService.editors) {
      assert.ok(editor instanceof TestUntitledTextEditorInput);
      assert.strictEqual(editor.resolved, true);
    }
  });
  test("Restore backups (basics, none handled)", async function() {
    const [tracker, accessor2] = await restoreBackupsInit();
    await tracker.testRestoreBackups({
      handles: (workingCopy) => false,
      isOpen: (workingCopy, editor) => {
        throw new Error("unexpected");
      },
      createEditor: (workingCopy) => {
        throw new Error("unexpected");
      }
    });
    assert.strictEqual(accessor2.editorService.count, 0);
    assert.strictEqual(tracker.getUnrestoredBackups().size, 4);
  });
  test("Restore backups (basics, error case)", async function() {
    const [tracker] = await restoreBackupsInit();
    try {
      await tracker.testRestoreBackups({
        handles: (workingCopy) => true,
        isOpen: (workingCopy, editor) => {
          throw new Error("unexpected");
        },
        createEditor: (workingCopy) => {
          throw new Error("unexpected");
        }
      });
    } catch (error) {
    }
    assert.strictEqual(tracker.getUnrestoredBackups().size, 4);
  });
  test("Restore backups (multiple handlers)", async function() {
    const [tracker, accessor2] = await restoreBackupsInit();
    const firstHandler = tracker.testRestoreBackups({
      handles: (workingCopy) => {
        return workingCopy.typeId === "testBackupTypeId";
      },
      isOpen: (workingCopy, editor) => {
        return false;
      },
      createEditor: (workingCopy) => {
        return disposables.add(accessor2.instantiationService.createInstance(TestUntitledTextEditorInput, accessor2.untitledTextEditorService.create({ initialValue: "foo" })));
      }
    });
    const secondHandler = tracker.testRestoreBackups({
      handles: (workingCopy) => {
        return workingCopy.typeId.length === 0;
      },
      isOpen: (workingCopy, editor) => {
        return false;
      },
      createEditor: (workingCopy) => {
        return disposables.add(accessor2.instantiationService.createInstance(TestUntitledTextEditorInput, accessor2.untitledTextEditorService.create({ initialValue: "foo" })));
      }
    });
    await Promise.all([firstHandler, secondHandler]);
    assert.strictEqual(accessor2.editorService.count, 4);
    assert.ok(accessor2.editorService.editors.every((editor) => editor.isDirty()));
    assert.strictEqual(tracker.getUnrestoredBackups().size, 0);
    for (const editor of accessor2.editorService.editors) {
      assert.ok(editor instanceof TestUntitledTextEditorInput);
      assert.strictEqual(editor.resolved, true);
    }
  });
  test("Restore backups (editors already opened)", async function() {
    const [tracker, accessor2] = await restoreBackupsInit();
    assert.strictEqual(tracker.getUnrestoredBackups().size, 0);
    let handlesCounter = 0;
    let isOpenCounter = 0;
    const editor1 = disposables.add(accessor2.instantiationService.createInstance(TestUntitledTextEditorInput, accessor2.untitledTextEditorService.create({ initialValue: "foo" })));
    const editor2 = disposables.add(accessor2.instantiationService.createInstance(TestUntitledTextEditorInput, accessor2.untitledTextEditorService.create({ initialValue: "foo" })));
    await accessor2.editorService.openEditors([{ editor: editor1 }, { editor: editor2 }]);
    editor1.resolved = false;
    editor2.resolved = false;
    await tracker.testRestoreBackups({
      handles: (workingCopy) => {
        handlesCounter++;
        return workingCopy.typeId === "testBackupTypeId";
      },
      isOpen: (workingCopy, editor) => {
        isOpenCounter++;
        return true;
      },
      createEditor: (workingCopy) => {
        throw new Error("unexpected");
      }
    });
    assert.strictEqual(handlesCounter, 4);
    assert.strictEqual(isOpenCounter, 4);
    assert.strictEqual(accessor2.editorService.count, 2);
    assert.strictEqual(tracker.getUnrestoredBackups().size, 2);
    for (const editor of accessor2.editorService.editors) {
      assert.ok(editor instanceof TestUntitledTextEditorInput);
      if (accessor2.editorService.isVisible(editor)) {
        assert.strictEqual(editor.resolved, false);
      } else {
        assert.strictEqual(editor.resolved, true);
      }
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9icm93c2VyL3dvcmtpbmdDb3B5QmFja3VwVHJhY2tlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvclBhcnQgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQYXJ0LmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSwgdG9SZXNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlc0NvbmZpZ3VyYXRpb24vY29tbW9uL2ZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi93b3JraW5nQ29weVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtpbmdDb3B5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uL3VudGl0bGVkL2NvbW1vbi91bnRpdGxlZFRleHRFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVFZGl0b3JQYXJ0LCBJbk1lbW9yeVRlc3RXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIHJlZ2lzdGVyVGVzdFJlc291cmNlRWRpdG9yLCBUZXN0U2VydmljZUFjY2Vzc29yLCB0b1R5cGVkV29ya2luZ0NvcHlJZCwgdG9VbnR5cGVkV29ya2luZ0NvcHlJZCwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UsIHdvcmtiZW5jaFRlYXJkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBUZXN0V29ya2luZ0NvcHkgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IEJyb3dzZXJXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL3dvcmtpbmdDb3B5QmFja3VwVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5RWRpdG9ySGFuZGxlciwgSVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi93b3JraW5nQ29weUVkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYnVmZmVyVG9SZWFkYWJsZSwgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuXG5zdWl0ZSgnV29ya2luZ0NvcHlCYWNrdXBUcmFja2VyIChicm93c2VyKScsIGZ1bmN0aW9uICgpIHtcblx0bGV0IGFjY2Vzc29yOiBUZXN0U2VydmljZUFjY2Vzc29yO1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVGVzdFJlc291cmNlRWRpdG9yKCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd29ya2JlbmNoVGVhcmRvd24oYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0Y2xhc3MgVGVzdFdvcmtpbmdDb3B5QmFja3VwVHJhY2tlciBleHRlbmRzIEJyb3dzZXJXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIge1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRASVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRASVdvcmtpbmdDb3B5U2VydmljZSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0XHRASVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB3b3JraW5nQ29weUVkaXRvclNlcnZpY2U6IElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsXG5cdFx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZVxuXHRcdCkge1xuXHRcdFx0c3VwZXIod29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB3b3JraW5nQ29weVNlcnZpY2UsIGxpZmVjeWNsZVNlcnZpY2UsIGxvZ1NlcnZpY2UsIHdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSwgZWRpdG9yU2VydmljZSwgZWRpdG9yR3JvdXBTZXJ2aWNlKTtcblx0XHR9XG5cblx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgZ2V0QmFja3VwU2NoZWR1bGVEZWxheSgpOiBudW1iZXIge1xuXHRcdFx0cmV0dXJuIDEwOyAvLyBSZWR1Y2UgdGltZW91dCBmb3IgdGVzdHNcblx0XHR9XG5cblx0XHRnZXQgcGVuZGluZ0JhY2t1cE9wZXJhdGlvbkNvdW50KCk6IG51bWJlciB7IHJldHVybiB0aGlzLnBlbmRpbmdCYWNrdXBPcGVyYXRpb25zLnNpemU7IH1cblxuXHRcdGdldFVucmVzdG9yZWRCYWNrdXBzKCkge1xuXHRcdFx0cmV0dXJuIHRoaXMudW5yZXN0b3JlZEJhY2t1cHM7XG5cdFx0fVxuXG5cdFx0YXN5bmMgdGVzdFJlc3RvcmVCYWNrdXBzKGhhbmRsZXI6IElXb3JraW5nQ29weUVkaXRvckhhbmRsZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdHJldHVybiBzdXBlci5yZXN0b3JlQmFja3VwcyhoYW5kbGVyKTtcblx0XHR9XG5cdH1cblxuXHRjbGFzcyBUZXN0VW50aXRsZWRUZXh0RWRpdG9ySW5wdXQgZXh0ZW5kcyBVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCB7XG5cblx0XHRyZXNvbHZlZCA9IGZhbHNlO1xuXG5cdFx0b3ZlcnJpZGUgcmVzb2x2ZSgpIHtcblx0XHRcdHRoaXMucmVzb2x2ZWQgPSB0cnVlO1xuXG5cdFx0XHRyZXR1cm4gc3VwZXIucmVzb2x2ZSgpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIGNyZWF0ZVRyYWNrZXIoKTogUHJvbWlzZTx7IGFjY2Vzc29yOiBUZXN0U2VydmljZUFjY2Vzc29yOyBwYXJ0OiBFZGl0b3JQYXJ0OyB0cmFja2VyOiBUZXN0V29ya2luZ0NvcHlCYWNrdXBUcmFja2VyOyB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IEluTWVtb3J5VGVzdFdvcmtpbmdDb3B5QmFja3VwU2VydmljZTsgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSB9PiB7XG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeVRlc3RXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIHdvcmtpbmdDb3B5QmFja3VwU2VydmljZSk7XG5cblx0XHRjb25zdCBwYXJ0ID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnQpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVGVzdFJlc291cmNlRWRpdG9yKCkpO1xuXG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZTogRWRpdG9yU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JTZXJ2aWNlLCB1bmRlZmluZWQpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cblx0XHRjb25zdCB0cmFja2VyID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIpKTtcblxuXHRcdHJldHVybiB7IGFjY2Vzc29yLCBwYXJ0LCB0cmFja2VyLCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IHdvcmtpbmdDb3B5QmFja3VwU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UgfTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHVudGl0bGVkQmFja3VwVGVzdCh1bnRpdGxlZDogSVVudGl0bGVkVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiB1bmRlZmluZWQgfSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHsgYWNjZXNzb3IsIHdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9ID0gYXdhaXQgY3JlYXRlVHJhY2tlcigpO1xuXG5cdFx0Y29uc3QgdW50aXRsZWRUZXh0RWRpdG9yID0gZGlzcG9zYWJsZXMuYWRkKChhd2FpdCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IodW50aXRsZWQpKT8uaW5wdXQgYXMgVW50aXRsZWRUZXh0RWRpdG9ySW5wdXQpO1xuXHRcdGNvbnN0IHVudGl0bGVkVGV4dE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IHVudGl0bGVkVGV4dEVkaXRvci5yZXNvbHZlKCkpO1xuXG5cdFx0aWYgKCF1bnRpdGxlZD8uY29udGVudHMpIHtcblx0XHRcdHVudGl0bGVkVGV4dE1vZGVsLnRleHRFZGl0b3JNb2RlbD8uc2V0VmFsdWUoJ1N1cGVyIEdvb2QnKTtcblx0XHR9XG5cblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2Uuam9pbkJhY2t1cFJlc291cmNlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmhhc0JhY2t1cFN5bmModW50aXRsZWRUZXh0TW9kZWwpLCB0cnVlKTtcblxuXHRcdHVudGl0bGVkVGV4dE1vZGVsLmRpc3Bvc2UoKTtcblxuXHRcdGF3YWl0IHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5qb2luRGlzY2FyZEJhY2t1cCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKHVudGl0bGVkVGV4dE1vZGVsKSwgZmFsc2UpO1xuXHR9XG5cblx0dGVzdCgnVHJhY2sgYmFja3VwcyAodW50aXRsZWQpJywgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB1bnRpdGxlZEJhY2t1cFRlc3QoKTtcblx0fSk7XG5cblx0dGVzdCgnVHJhY2sgYmFja3VwcyAodW50aXRsZWQgd2l0aCBpbml0aWFsIGNvbnRlbnRzKScsIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdW50aXRsZWRCYWNrdXBUZXN0KHsgcmVzb3VyY2U6IHVuZGVmaW5lZCwgY29udGVudHM6ICdGb28gQmFyJyB9KTtcblx0fSk7XG5cblx0dGVzdCgnVHJhY2sgYmFja3VwcyAoY3VzdG9tKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCB0cmFja2VyLCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoKTtcblxuXHRcdGNsYXNzIFRlc3RCYWNrdXBXb3JraW5nQ29weSBleHRlbmRzIFRlc3RXb3JraW5nQ29weSB7XG5cblx0XHRcdGNvbnN0cnVjdG9yKHJlc291cmNlOiBVUkkpIHtcblx0XHRcdFx0c3VwZXIocmVzb3VyY2UpO1xuXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UucmVnaXN0ZXJXb3JraW5nQ29weSh0aGlzKSk7XG5cdFx0XHR9XG5cblx0XHRcdHJlYWRvbmx5IGJhY2t1cERlbGF5ID0gMTA7XG5cblx0XHRcdG92ZXJyaWRlIGFzeW5jIGJhY2t1cCh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElXb3JraW5nQ29weUJhY2t1cD4ge1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXG5cdFx0XHRcdHJldHVybiB7fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByZXNvdXJjZTogVVJJID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9jdXN0b20udHh0Jyk7XG5cdFx0Y29uc3QgY3VzdG9tV29ya2luZ0NvcHkgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RCYWNrdXBXb3JraW5nQ29weShyZXNvdXJjZSkpO1xuXG5cdFx0Ly8gTm9ybWFsXG5cdFx0Y3VzdG9tV29ya2luZ0NvcHkuc2V0RGlydHkodHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIucGVuZGluZ0JhY2t1cE9wZXJhdGlvbkNvdW50LCAxKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2Uuam9pbkJhY2t1cFJlc291cmNlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKGN1c3RvbVdvcmtpbmdDb3B5KSwgdHJ1ZSk7XG5cblx0XHRjdXN0b21Xb3JraW5nQ29weS5zZXREaXJ0eShmYWxzZSk7XG5cdFx0Y3VzdG9tV29ya2luZ0NvcHkuc2V0RGlydHkodHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIucGVuZGluZ0JhY2t1cE9wZXJhdGlvbkNvdW50LCAxKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2Uuam9pbkJhY2t1cFJlc291cmNlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKGN1c3RvbVdvcmtpbmdDb3B5KSwgdHJ1ZSk7XG5cblx0XHRjdXN0b21Xb3JraW5nQ29weS5zZXREaXJ0eShmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIucGVuZGluZ0JhY2t1cE9wZXJhdGlvbkNvdW50LCAxKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2Uuam9pbkRpc2NhcmRCYWNrdXAoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmhhc0JhY2t1cFN5bmMoY3VzdG9tV29ya2luZ0NvcHkpLCBmYWxzZSk7XG5cblx0XHQvLyBDYW5jZWxsYXRpb25cblx0XHRjdXN0b21Xb3JraW5nQ29weS5zZXREaXJ0eSh0cnVlKTtcblx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdGN1c3RvbVdvcmtpbmdDb3B5LnNldERpcnR5KGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5wZW5kaW5nQmFja3VwT3BlcmF0aW9uQ291bnQsIDEpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5qb2luRGlzY2FyZEJhY2t1cCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuaGFzQmFja3VwU3luYyhjdXN0b21Xb3JraW5nQ29weSksIGZhbHNlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gcmVzdG9yZUJhY2t1cHNJbml0KCk6IFByb21pc2U8W1Rlc3RXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIsIFRlc3RTZXJ2aWNlQWNjZXNzb3JdPiB7XG5cdFx0Y29uc3QgZm9vRmlsZSA9IFVSSS5maWxlKGlzV2luZG93cyA/ICdjOlxcXFxGb28nIDogJy9Gb28nKTtcblx0XHRjb25zdCBiYXJGaWxlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXEJhcicgOiAnL0JhcicpO1xuXHRcdGNvbnN0IHVudGl0bGVkRmlsZTEgPSBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCwgcGF0aDogJ1VudGl0bGVkLTEnIH0pO1xuXHRcdGNvbnN0IHVudGl0bGVkRmlsZTIgPSBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCwgcGF0aDogJ1VudGl0bGVkLTInIH0pO1xuXG5cdFx0Y29uc3Qgd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeVRlc3RXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsIHdvcmtpbmdDb3B5QmFja3VwU2VydmljZSk7XG5cblx0XHRjb25zdCBwYXJ0ID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnQpO1xuXG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZTogRWRpdG9yU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JTZXJ2aWNlLCB1bmRlZmluZWQpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cblx0XHQvLyBCYWNrdXAgMiBub3JtYWwgZmlsZXMgYW5kIDIgdW50aXRsZWQgZmlsZXNcblx0XHRjb25zdCB1bnRpdGxlZEZpbGUxV29ya2luZ0NvcHlJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodW50aXRsZWRGaWxlMSk7XG5cdFx0Y29uc3QgdW50aXRsZWRGaWxlMldvcmtpbmdDb3B5SWQgPSB0b1R5cGVkV29ya2luZ0NvcHlJZCh1bnRpdGxlZEZpbGUyKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuYmFja3VwKHVudGl0bGVkRmlsZTFXb3JraW5nQ29weUlkLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3VudGl0bGVkLTEnKSkpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5iYWNrdXAodW50aXRsZWRGaWxlMldvcmtpbmdDb3B5SWQsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndW50aXRsZWQtMicpKSk7XG5cblx0XHRjb25zdCBmb29GaWxlV29ya2luZ0NvcHlJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0Y29uc3QgYmFyRmlsZVdvcmtpbmdDb3B5SWQgPSB0b1R5cGVkV29ya2luZ0NvcHlJZChiYXJGaWxlKTtcblx0XHRhd2FpdCB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuYmFja3VwKGZvb0ZpbGVXb3JraW5nQ29weUlkLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ2Zvb0ZpbGUnKSkpO1xuXHRcdGF3YWl0IHdvcmtpbmdDb3B5QmFja3VwU2VydmljZS5iYWNrdXAoYmFyRmlsZVdvcmtpbmdDb3B5SWQsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygnYmFyRmlsZScpKSk7XG5cblx0XHRjb25zdCB0cmFja2VyID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIpKTtcblxuXHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UucGhhc2UgPSBMaWZlY3ljbGVQaGFzZS5SZXN0b3JlZDtcblxuXHRcdHJldHVybiBbdHJhY2tlciwgYWNjZXNzb3JdO1xuXHR9XG5cblx0dGVzdCgnUmVzdG9yZSBiYWNrdXBzIChiYXNpY3MsIHNvbWUgaGFuZGxlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgW3RyYWNrZXIsIGFjY2Vzc29yXSA9IGF3YWl0IHJlc3RvcmVCYWNrdXBzSW5pdCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuZ2V0VW5yZXN0b3JlZEJhY2t1cHMoKS5zaXplLCAwKTtcblxuXHRcdGxldCBoYW5kbGVzQ291bnRlciA9IDA7XG5cdFx0bGV0IGlzT3BlbkNvdW50ZXIgPSAwO1xuXHRcdGxldCBjcmVhdGVFZGl0b3JDb3VudGVyID0gMDtcblxuXHRcdGF3YWl0IHRyYWNrZXIudGVzdFJlc3RvcmVCYWNrdXBzKHtcblx0XHRcdGhhbmRsZXM6IHdvcmtpbmdDb3B5ID0+IHtcblx0XHRcdFx0aGFuZGxlc0NvdW50ZXIrKztcblxuXHRcdFx0XHRyZXR1cm4gd29ya2luZ0NvcHkudHlwZUlkID09PSAndGVzdEJhY2t1cFR5cGVJZCc7XG5cdFx0XHR9LFxuXHRcdFx0aXNPcGVuOiAod29ya2luZ0NvcHksIGVkaXRvcikgPT4ge1xuXHRcdFx0XHRpc09wZW5Db3VudGVyKys7XG5cblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUVkaXRvcjogd29ya2luZ0NvcHkgPT4ge1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JDb3VudGVyKys7XG5cblx0XHRcdFx0cmV0dXJuIGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VW50aXRsZWRUZXh0RWRpdG9ySW5wdXQsIGFjY2Vzc29yLnVudGl0bGVkVGV4dEVkaXRvclNlcnZpY2UuY3JlYXRlKHsgaW5pdGlhbFZhbHVlOiAnZm9vJyB9KSkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhhbmRsZXNDb3VudGVyLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNPcGVuQ291bnRlciwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNyZWF0ZUVkaXRvckNvdW50ZXIsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvclNlcnZpY2UuY291bnQsIDIpO1xuXHRcdGFzc2VydC5vayhhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLmVkaXRvcnMuZXZlcnkoZWRpdG9yID0+IGVkaXRvci5pc0RpcnR5KCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5nZXRVbnJlc3RvcmVkQmFja3VwcygpLnNpemUsIDIpO1xuXG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5lZGl0b3JzKSB7XG5cdFx0XHRhc3NlcnQub2soZWRpdG9yIGluc3RhbmNlb2YgVGVzdFVudGl0bGVkVGV4dEVkaXRvcklucHV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IucmVzb2x2ZWQsIHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnUmVzdG9yZSBiYWNrdXBzIChiYXNpY3MsIG5vbmUgaGFuZGxlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgW3RyYWNrZXIsIGFjY2Vzc29yXSA9IGF3YWl0IHJlc3RvcmVCYWNrdXBzSW5pdCgpO1xuXG5cdFx0YXdhaXQgdHJhY2tlci50ZXN0UmVzdG9yZUJhY2t1cHMoe1xuXHRcdFx0aGFuZGxlczogd29ya2luZ0NvcHkgPT4gZmFsc2UsXG5cdFx0XHRpc09wZW46ICh3b3JraW5nQ29weSwgZWRpdG9yKSA9PiB7IHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCcpOyB9LFxuXHRcdFx0Y3JlYXRlRWRpdG9yOiB3b3JraW5nQ29weSA9PiB7IHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCcpOyB9XG5cdFx0fSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZWRpdG9yU2VydmljZS5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuZ2V0VW5yZXN0b3JlZEJhY2t1cHMoKS5zaXplLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnUmVzdG9yZSBiYWNrdXBzIChiYXNpY3MsIGVycm9yIGNhc2UpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFt0cmFja2VyXSA9IGF3YWl0IHJlc3RvcmVCYWNrdXBzSW5pdCgpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRyYWNrZXIudGVzdFJlc3RvcmVCYWNrdXBzKHtcblx0XHRcdFx0aGFuZGxlczogd29ya2luZ0NvcHkgPT4gdHJ1ZSxcblx0XHRcdFx0aXNPcGVuOiAod29ya2luZ0NvcHksIGVkaXRvcikgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ3VuZXhwZWN0ZWQnKTsgfSxcblx0XHRcdFx0Y3JlYXRlRWRpdG9yOiB3b3JraW5nQ29weSA9PiB7IHRocm93IG5ldyBFcnJvcigndW5leHBlY3RlZCcpOyB9XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Ly8gaWdub3JlXG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIuZ2V0VW5yZXN0b3JlZEJhY2t1cHMoKS5zaXplLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnUmVzdG9yZSBiYWNrdXBzIChtdWx0aXBsZSBoYW5kbGVycyknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgW3RyYWNrZXIsIGFjY2Vzc29yXSA9IGF3YWl0IHJlc3RvcmVCYWNrdXBzSW5pdCgpO1xuXG5cdFx0Y29uc3QgZmlyc3RIYW5kbGVyID0gdHJhY2tlci50ZXN0UmVzdG9yZUJhY2t1cHMoe1xuXHRcdFx0aGFuZGxlczogd29ya2luZ0NvcHkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gd29ya2luZ0NvcHkudHlwZUlkID09PSAndGVzdEJhY2t1cFR5cGVJZCc7XG5cdFx0XHR9LFxuXHRcdFx0aXNPcGVuOiAod29ya2luZ0NvcHksIGVkaXRvcikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9LFxuXHRcdFx0Y3JlYXRlRWRpdG9yOiB3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVudGl0bGVkVGV4dEVkaXRvcklucHV0LCBhY2Nlc3Nvci51bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlLmNyZWF0ZSh7IGluaXRpYWxWYWx1ZTogJ2ZvbycgfSkpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IHNlY29uZEhhbmRsZXIgPSB0cmFja2VyLnRlc3RSZXN0b3JlQmFja3Vwcyh7XG5cdFx0XHRoYW5kbGVzOiB3b3JraW5nQ29weSA9PiB7XG5cdFx0XHRcdHJldHVybiB3b3JraW5nQ29weS50eXBlSWQubGVuZ3RoID09PSAwO1xuXHRcdFx0fSxcblx0XHRcdGlzT3BlbjogKHdvcmtpbmdDb3B5LCBlZGl0b3IpID0+IHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fSxcblx0XHRcdGNyZWF0ZUVkaXRvcjogd29ya2luZ0NvcHkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCwgYWNjZXNzb3IudW50aXRsZWRUZXh0RWRpdG9yU2VydmljZS5jcmVhdGUoeyBpbml0aWFsVmFsdWU6ICdmb28nIH0pKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbZmlyc3RIYW5kbGVyLCBzZWNvbmRIYW5kbGVyXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZWRpdG9yU2VydmljZS5jb3VudCwgNCk7XG5cdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLmVkaXRvclNlcnZpY2UuZWRpdG9ycy5ldmVyeShlZGl0b3IgPT4gZWRpdG9yLmlzRGlydHkoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmdldFVucmVzdG9yZWRCYWNrdXBzKCkuc2l6ZSwgMCk7XG5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLmVkaXRvcnMpIHtcblx0XHRcdGFzc2VydC5vayhlZGl0b3IgaW5zdGFuY2VvZiBUZXN0VW50aXRsZWRUZXh0RWRpdG9ySW5wdXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvci5yZXNvbHZlZCwgdHJ1ZSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdSZXN0b3JlIGJhY2t1cHMgKGVkaXRvcnMgYWxyZWFkeSBvcGVuZWQpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFt0cmFja2VyLCBhY2Nlc3Nvcl0gPSBhd2FpdCByZXN0b3JlQmFja3Vwc0luaXQoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmdldFVucmVzdG9yZWRCYWNrdXBzKCkuc2l6ZSwgMCk7XG5cblx0XHRsZXQgaGFuZGxlc0NvdW50ZXIgPSAwO1xuXHRcdGxldCBpc09wZW5Db3VudGVyID0gMDtcblxuXHRcdGNvbnN0IGVkaXRvcjEgPSBkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVudGl0bGVkVGV4dEVkaXRvcklucHV0LCBhY2Nlc3Nvci51bnRpdGxlZFRleHRFZGl0b3JTZXJ2aWNlLmNyZWF0ZSh7IGluaXRpYWxWYWx1ZTogJ2ZvbycgfSkpKTtcblx0XHRjb25zdCBlZGl0b3IyID0gZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVbnRpdGxlZFRleHRFZGl0b3JJbnB1dCwgYWNjZXNzb3IudW50aXRsZWRUZXh0RWRpdG9yU2VydmljZS5jcmVhdGUoeyBpbml0aWFsVmFsdWU6ICdmb28nIH0pKSk7XG5cblx0XHRhd2FpdCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogZWRpdG9yMSB9LCB7IGVkaXRvcjogZWRpdG9yMiB9XSk7XG5cblx0XHRlZGl0b3IxLnJlc29sdmVkID0gZmFsc2U7XG5cdFx0ZWRpdG9yMi5yZXNvbHZlZCA9IGZhbHNlO1xuXG5cdFx0YXdhaXQgdHJhY2tlci50ZXN0UmVzdG9yZUJhY2t1cHMoe1xuXHRcdFx0aGFuZGxlczogd29ya2luZ0NvcHkgPT4ge1xuXHRcdFx0XHRoYW5kbGVzQ291bnRlcisrO1xuXG5cdFx0XHRcdHJldHVybiB3b3JraW5nQ29weS50eXBlSWQgPT09ICd0ZXN0QmFja3VwVHlwZUlkJztcblx0XHRcdH0sXG5cdFx0XHRpc09wZW46ICh3b3JraW5nQ29weSwgZWRpdG9yKSA9PiB7XG5cdFx0XHRcdGlzT3BlbkNvdW50ZXIrKztcblxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH0sXG5cdFx0XHRjcmVhdGVFZGl0b3I6IHdvcmtpbmdDb3B5ID0+IHsgdGhyb3cgbmV3IEVycm9yKCd1bmV4cGVjdGVkJyk7IH1cblx0XHR9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChoYW5kbGVzQ291bnRlciwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzT3BlbkNvdW50ZXIsIDQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvclNlcnZpY2UuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLmdldFVucmVzdG9yZWRCYWNrdXBzKCkuc2l6ZSwgMik7XG5cblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLmVkaXRvcnMpIHtcblx0XHRcdGFzc2VydC5vayhlZGl0b3IgaW5zdGFuY2VvZiBUZXN0VW50aXRsZWRUZXh0RWRpdG9ySW5wdXQpO1xuXG5cdFx0XHQvLyBhc3NlcnQgdGhhdCB3ZSBvbmx5IGNhbGwgYHJlc29sdmVgIG9uIGluYWN0aXZlIGVkaXRvcnNcblx0XHRcdGlmIChhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLmlzVmlzaWJsZShlZGl0b3IpKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IucmVzb2x2ZWQsIGZhbHNlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IucmVzb2x2ZWQsIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsV0FBVztBQUNwQixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHFCQUFxQjtBQUU5QixTQUFTLGlDQUFpQztBQUMxQyxTQUFTLHlDQUF5QyxrQkFBa0I7QUFDcEUsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywyQkFBMkI7QUFFcEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxtQkFBbUIsc0JBQXNCO0FBRWxELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0JBQWtCLHNDQUFzQyw0QkFBNEIscUJBQXFCLHNCQUFzQix3QkFBd0IsK0JBQStCLHlCQUF5QjtBQUN4TixTQUFTLHVCQUF1QjtBQUVoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBb0MsaUNBQWlDO0FBQ3JFLFNBQVMsa0JBQWtCLGdCQUFn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
