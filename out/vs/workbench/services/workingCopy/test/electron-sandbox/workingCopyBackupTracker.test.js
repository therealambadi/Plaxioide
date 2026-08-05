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
import { isMacintosh, isWindows } from "../../../../../base/common/platform.js";
import { join } from "../../../../../base/common/path.js";
import { URI } from "../../../../../base/common/uri.js";
import { hash } from "../../../../../base/common/hash.js";
import { NativeWorkingCopyBackupTracker } from "../../electron-sandbox/workingCopyBackupTracker.js";
import { IEditorService } from "../../../editor/common/editorService.js";
import { IEditorGroupsService } from "../../../editor/common/editorGroupsService.js";
import { EditorService } from "../../../editor/browser/editorService.js";
import { IWorkingCopyBackupService } from "../../common/workingCopyBackup.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { IFilesConfigurationService } from "../../../filesConfiguration/common/filesConfigurationService.js";
import { IWorkingCopyService } from "../../common/workingCopyService.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { HotExitConfiguration } from "../../../../../platform/files/common/files.js";
import { ShutdownReason, ILifecycleService } from "../../../lifecycle/common/lifecycle.js";
import { IFileDialogService, ConfirmResult, IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { INativeHostService } from "../../../../../platform/native/common/native.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { createEditorPart, registerTestFileEditor, TestBeforeShutdownEvent, TestEnvironmentService, TestFilesConfigurationService, TestFileService, TestTextResourceConfigurationService, workbenchTeardown } from "../../../../test/browser/workbenchTestServices.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { TestWorkspace, Workspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { IProgressService } from "../../../../../platform/progress/common/progress.js";
import { IWorkingCopyEditorService } from "../../common/workingCopyEditorService.js";
import { TestContextService, TestMarkerService, TestWorkingCopy } from "../../../../test/common/workbenchTestServices.js";
import { WorkingCopyCapabilities } from "../../common/workingCopy.js";
import { Event, Emitter } from "../../../../../base/common/event.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import { Schemas } from "../../../../../base/common/network.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { TestServiceAccessor, workbenchInstantiationService } from "../../../../test/electron-sandbox/workbenchTestServices.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
suite("WorkingCopyBackupTracker (native)", function() {
  let TestWorkingCopyBackupTracker = class extends NativeWorkingCopyBackupTracker {
    constructor(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, fileDialogService, dialogService, contextService, nativeHostService, logService, editorService, environmentService, progressService, workingCopyEditorService, editorGroupService) {
      super(workingCopyBackupService, filesConfigurationService, workingCopyService, lifecycleService, fileDialogService, dialogService, contextService, nativeHostService, logService, environmentService, progressService, workingCopyEditorService, editorService, editorGroupService);
      this._onDidResume = this._register(new Emitter());
      this.onDidResume = this._onDidResume.event;
      this._onDidSuspend = this._register(new Emitter());
      this.onDidSuspend = this._onDidSuspend.event;
    }
    getBackupScheduleDelay() {
      return 10;
    }
    waitForReady() {
      return this.whenReady;
    }
    get pendingBackupOperationCount() {
      return this.pendingBackupOperations.size;
    }
    dispose() {
      super.dispose();
      for (const [_, pending] of this.pendingBackupOperations) {
        pending.cancel();
        pending.disposable.dispose();
      }
    }
    suspendBackupOperations() {
      const { resume } = super.suspendBackupOperations();
      this._onDidSuspend.fire();
      return {
        resume: () => {
          resume();
          this._onDidResume.fire();
        }
      };
    }
  };
  TestWorkingCopyBackupTracker = __decorateClass([
    __decorateParam(0, IWorkingCopyBackupService),
    __decorateParam(1, IFilesConfigurationService),
    __decorateParam(2, IWorkingCopyService),
    __decorateParam(3, ILifecycleService),
    __decorateParam(4, IFileDialogService),
    __decorateParam(5, IDialogService),
    __decorateParam(6, IWorkspaceContextService),
    __decorateParam(7, INativeHostService),
    __decorateParam(8, ILogService),
    __decorateParam(9, IEditorService),
    __decorateParam(10, IEnvironmentService),
    __decorateParam(11, IProgressService),
    __decorateParam(12, IWorkingCopyEditorService),
    __decorateParam(13, IEditorGroupsService)
  ], TestWorkingCopyBackupTracker);
  let testDir;
  let backupHome;
  let workspaceBackupPath;
  let accessor;
  const disposables = new DisposableStore();
  setup(async () => {
    testDir = URI.file(join(generateUuid(), "vsctests", "workingcopybackuptracker")).with({ scheme: Schemas.inMemory });
    backupHome = joinPath(testDir, "Backups");
    const workspacesJsonPath = joinPath(backupHome, "workspaces.json");
    const workspaceResource = URI.file(isWindows ? "c:\\workspace" : "/workspace").with({ scheme: Schemas.inMemory });
    workspaceBackupPath = joinPath(backupHome, hash(workspaceResource.toString()).toString(16));
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    disposables.add(accessor.textFileService.files);
    disposables.add(registerTestFileEditor());
    await accessor.fileService.createFolder(backupHome);
    await accessor.fileService.createFolder(workspaceBackupPath);
    return accessor.fileService.writeFile(workspacesJsonPath, VSBuffer.fromString(""));
  });
  teardown(() => {
    disposables.clear();
  });
  async function createTracker(autoSaveEnabled = false) {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const configurationService = new TestConfigurationService();
    if (autoSaveEnabled) {
      configurationService.setUserConfiguration("files", { autoSave: "afterDelay", autoSaveDelay: 1 });
    } else {
      configurationService.setUserConfiguration("files", { autoSave: "off", autoSaveDelay: 1 });
    }
    instantiationService.stub(IConfigurationService, configurationService);
    instantiationService.stub(IFilesConfigurationService, disposables.add(new TestFilesConfigurationService(
      instantiationService.createInstance(MockContextKeyService),
      configurationService,
      new TestContextService(TestWorkspace),
      TestEnvironmentService,
      disposables.add(new UriIdentityService(disposables.add(new TestFileService()))),
      disposables.add(new TestFileService()),
      new TestMarkerService(),
      new TestTextResourceConfigurationService(configurationService)
    )));
    const part = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, part);
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    accessor = instantiationService.createInstance(TestServiceAccessor);
    const tracker = instantiationService.createInstance(TestWorkingCopyBackupTracker);
    const cleanup = async () => {
      await accessor.workingCopyBackupService.waitForAllBackups();
      await workbenchTeardown(instantiationService);
      part.dispose();
      tracker.dispose();
    };
    return { accessor, part, tracker, instantiationService, cleanup };
  }
  test("Track backups (file, auto save off)", function() {
    return trackBackupsTest(toResource.call(this, "/path/index.txt"), false);
  });
  test("Track backups (file, auto save on)", function() {
    return trackBackupsTest(toResource.call(this, "/path/index.txt"), true);
  });
  async function trackBackupsTest(resource, autoSave) {
    const { accessor: accessor2, cleanup } = await createTracker(autoSave);
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const fileModel = accessor2.textFileService.files.get(resource);
    assert.ok(fileModel);
    fileModel.textEditorModel?.setValue("Super Good");
    await accessor2.workingCopyBackupService.joinBackupResource();
    assert.strictEqual(accessor2.workingCopyBackupService.hasBackupSync(fileModel), true);
    fileModel.dispose();
    await accessor2.workingCopyBackupService.joinDiscardBackup();
    assert.strictEqual(accessor2.workingCopyBackupService.hasBackupSync(fileModel), false);
    await cleanup();
  }
  test("onWillShutdown - no veto if no dirty files", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    await cleanup();
  });
  test("onWillShutdown - veto if user cancels (hot.exit: off)", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const model = accessor2.textFileService.files.get(resource);
    accessor2.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);
    accessor2.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: "off" } });
    await model?.resolve();
    model?.textEditorModel?.setValue("foo");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(veto);
    await cleanup();
  });
  test("onWillShutdown - no veto if auto save is on", async function() {
    const { accessor: accessor2, cleanup } = await createTracker(
      true
      /* auto save enabled */
    );
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const model = accessor2.textFileService.files.get(resource);
    await model?.resolve();
    model?.textEditorModel?.setValue("foo");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 0);
    await cleanup();
  });
  test("onWillShutdown - no veto and backups cleaned up if user does not want to save (hot.exit: off)", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const model = accessor2.textFileService.files.get(resource);
    accessor2.fileDialogService.setConfirmResult(ConfirmResult.DONT_SAVE);
    accessor2.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: "off" } });
    await model?.resolve();
    model?.textEditorModel?.setValue("foo");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    assert.ok(accessor2.workingCopyBackupService.discardedBackups.length > 0);
    await cleanup();
  });
  test("onWillShutdown - no backups discarded when shutdown without dirty but tracker not ready", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    assert.ok(!accessor2.workingCopyBackupService.discardedAllBackups);
    await cleanup();
  });
  test("onWillShutdown - backups discarded when shutdown without dirty", async function() {
    const { accessor: accessor2, tracker, cleanup } = await createTracker();
    await tracker.waitForReady();
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    assert.ok(accessor2.workingCopyBackupService.discardedAllBackups);
    await cleanup();
  });
  test("onWillShutdown - save (hot.exit: off)", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const model = accessor2.textFileService.files.get(resource);
    accessor2.fileDialogService.setConfirmResult(ConfirmResult.SAVE);
    accessor2.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: "off" } });
    await model?.resolve();
    model?.textEditorModel?.setValue("foo");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    const event = new TestBeforeShutdownEvent();
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(!veto);
    assert.ok(!model?.isDirty());
    await cleanup();
  });
  test("onWillShutdown - veto if backup fails", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    class TestBackupWorkingCopy extends TestWorkingCopy {
      constructor(resource2) {
        super(resource2);
        this._register(accessor2.workingCopyService.registerWorkingCopy(this));
      }
      async backup(token) {
        throw new Error("unable to backup");
      }
    }
    const resource = toResource.call(this, "/path/custom.txt");
    const customWorkingCopy = disposables.add(new TestBackupWorkingCopy(resource));
    customWorkingCopy.setDirty(true);
    const event = new TestBeforeShutdownEvent();
    event.reason = ShutdownReason.QUIT;
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(veto);
    const finalVeto = await event.finalValue?.();
    assert.ok(finalVeto);
    await cleanup();
  });
  test("onWillShutdown - scratchpads - veto if backup fails", async function() {
    const { accessor: accessor2, cleanup } = await createTracker();
    class TestBackupWorkingCopy extends TestWorkingCopy {
      constructor(resource2) {
        super(resource2);
        this.capabilities = WorkingCopyCapabilities.Untitled | WorkingCopyCapabilities.Scratchpad;
        this._register(accessor2.workingCopyService.registerWorkingCopy(this));
      }
      async backup(token) {
        throw new Error("unable to backup");
      }
      isDirty() {
        return false;
      }
      isModified() {
        return true;
      }
    }
    const resource = toResource.call(this, "/path/custom.txt");
    disposables.add(new TestBackupWorkingCopy(resource));
    const event = new TestBeforeShutdownEvent();
    event.reason = ShutdownReason.QUIT;
    accessor2.lifecycleService.fireBeforeShutdown(event);
    const veto = await event.value;
    assert.ok(veto);
    const finalVeto = await event.finalValue?.();
    assert.ok(finalVeto);
    await cleanup();
  });
  test("onWillShutdown - pending backup operations canceled and tracker suspended/resumsed", async function() {
    const { accessor: accessor2, tracker, cleanup } = await createTracker();
    const resource = toResource.call(this, "/path/index.txt");
    await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
    const model = accessor2.textFileService.files.get(resource);
    await model?.resolve();
    model?.textEditorModel?.setValue("foo");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    const onSuspend = Event.toPromise(tracker.onDidSuspend);
    const event = new TestBeforeShutdownEvent();
    event.reason = ShutdownReason.QUIT;
    accessor2.lifecycleService.fireBeforeShutdown(event);
    await onSuspend;
    assert.strictEqual(tracker.pendingBackupOperationCount, 0);
    model?.textEditorModel?.setValue("bar");
    assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
    assert.strictEqual(tracker.pendingBackupOperationCount, 0);
    const onResume = Event.toPromise(tracker.onDidResume);
    await event.value;
    model?.textEditorModel?.setValue("foo");
    await onResume;
    assert.strictEqual(tracker.pendingBackupOperationCount, 1);
    await cleanup();
  });
  suite("Hot Exit", () => {
    suite('"onExit" setting', () => {
      test("should hot exit on non-Mac (reason: CLOSE, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, true, !!isMacintosh);
      });
      test("should hot exit on non-Mac (reason: CLOSE, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, false, !!isMacintosh);
      });
      test("should NOT hot exit (reason: CLOSE, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, true, true);
      });
      test("should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, false, true);
      });
      test("should hot exit (reason: QUIT, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, true, false);
      });
      test("should hot exit (reason: QUIT, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, false, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, true, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, false, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, true, true);
      });
      test("should NOT hot exit (reason: LOAD, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, false, true);
      });
      test("should NOT hot exit (reason: LOAD, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, true, true);
      });
      test("should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, false, true);
      });
    });
    suite('"onExitAndWindowClose" setting', () => {
      test("should hot exit (reason: CLOSE, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, true, false);
      });
      test("should hot exit (reason: CLOSE, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, false, !!isMacintosh);
      });
      test("should hot exit (reason: CLOSE, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, true, false);
      });
      test("should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, false, true);
      });
      test("should hot exit (reason: QUIT, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, true, false);
      });
      test("should hot exit (reason: QUIT, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, false, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, true, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, false, false);
      });
      test("should hot exit (reason: LOAD, windows: single, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: single, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, false, true);
      });
      test("should hot exit (reason: LOAD, windows: multiple, workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)", function() {
        return hotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, false, true);
      });
    });
    suite('"onExit" setting - scratchpad', () => {
      test("should hot exit (reason: CLOSE, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, true, false);
      });
      test("should hot exit (reason: CLOSE, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, false, false, !!isMacintosh);
      });
      test("should hot exit (reason: CLOSE, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, true, false);
      });
      test("should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.CLOSE, true, false, true);
      });
      test("should hot exit (reason: QUIT, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, true, false);
      });
      test("should hot exit (reason: QUIT, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, false, false, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, true, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.QUIT, true, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, false, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.RELOAD, true, false, false);
      });
      test("should hot exit (reason: LOAD, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, false, false, true);
      });
      test("should hot exit (reason: LOAD, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT, ShutdownReason.LOAD, true, false, true);
      });
    });
    suite('"onExitAndWindowClose" setting - scratchpad', () => {
      test("should hot exit (reason: CLOSE, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, true, false);
      });
      test("should hot exit (reason: CLOSE, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, false, false, !!isMacintosh);
      });
      test("should hot exit (reason: CLOSE, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, true, false);
      });
      test("should NOT hot exit (reason: CLOSE, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.CLOSE, true, false, true);
      });
      test("should hot exit (reason: QUIT, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, true, false);
      });
      test("should hot exit (reason: QUIT, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, false, false, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, true, false);
      });
      test("should hot exit (reason: QUIT, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.QUIT, true, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, false, false, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, true, false);
      });
      test("should hot exit (reason: RELOAD, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.RELOAD, true, false, false);
      });
      test("should hot exit (reason: LOAD, windows: single, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: single, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, false, false, true);
      });
      test("should hot exit (reason: LOAD, windows: multiple, workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, true, false);
      });
      test("should NOT hot exit (reason: LOAD, windows: multiple, empty workspace)", function() {
        return scratchpadHotExitTest.call(this, HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE, ShutdownReason.LOAD, true, false, true);
      });
    });
    async function hotExitTest(setting, shutdownReason, multipleWindows, workspace, shouldVeto) {
      const { accessor: accessor2, cleanup } = await createTracker();
      const resource = toResource.call(this, "/path/index.txt");
      await accessor2.editorService.openEditor({ resource, options: { pinned: true } });
      const model = accessor2.textFileService.files.get(resource);
      accessor2.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: setting } });
      if (!workspace) {
        accessor2.contextService.setWorkspace(new Workspace("empty:1508317022751"));
      }
      if (multipleWindows) {
        accessor2.nativeHostService.windowCount = Promise.resolve(2);
      }
      accessor2.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);
      await model?.resolve();
      model?.textEditorModel?.setValue("foo");
      assert.strictEqual(accessor2.workingCopyService.dirtyCount, 1);
      const event = new TestBeforeShutdownEvent();
      event.reason = shutdownReason;
      accessor2.lifecycleService.fireBeforeShutdown(event);
      const veto = await event.value;
      assert.ok(typeof event.finalValue === "function");
      assert.strictEqual(accessor2.workingCopyBackupService.discardedBackups.length, 0);
      assert.strictEqual(veto, shouldVeto);
      await cleanup();
    }
    async function scratchpadHotExitTest(setting, shutdownReason, multipleWindows, workspace, shouldVeto) {
      const { accessor: accessor2, cleanup } = await createTracker();
      class TestBackupWorkingCopy extends TestWorkingCopy {
        constructor(resource2) {
          super(resource2);
          this.capabilities = WorkingCopyCapabilities.Untitled | WorkingCopyCapabilities.Scratchpad;
          this._register(accessor2.workingCopyService.registerWorkingCopy(this));
        }
        isDirty() {
          return false;
        }
        isModified() {
          return true;
        }
      }
      accessor2.filesConfigurationService.testOnFilesConfigurationChange({ files: { hotExit: setting } });
      if (!workspace) {
        accessor2.contextService.setWorkspace(new Workspace("empty:1508317022751"));
      }
      if (multipleWindows) {
        accessor2.nativeHostService.windowCount = Promise.resolve(2);
      }
      accessor2.fileDialogService.setConfirmResult(ConfirmResult.CANCEL);
      const resource = toResource.call(this, "/path/custom.txt");
      disposables.add(new TestBackupWorkingCopy(resource));
      const event = new TestBeforeShutdownEvent();
      event.reason = shutdownReason;
      accessor2.lifecycleService.fireBeforeShutdown(event);
      const veto = await event.value;
      assert.ok(typeof event.finalValue === "function");
      assert.strictEqual(accessor2.workingCopyBackupService.discardedBackups.length, 0);
      assert.strictEqual(veto, shouldVeto);
      await cleanup();
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9lbGVjdHJvbi1zYW5kYm94L3dvcmtpbmdDb3B5QmFja3VwVHJhY2tlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaXNNYWNpbnRvc2gsIGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBOYXRpdmVXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIgfSBmcm9tICcuLi8uLi9lbGVjdHJvbi1zYW5kYm94L3dvcmtpbmdDb3B5QmFja3VwVHJhY2tlci5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3RleHRmaWxlL2NvbW1vbi90ZXh0RmlsZUVkaXRvck1vZGVsTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydC5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtpbmdDb3B5QmFja3VwLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUsIHRvUmVzb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZmlsZXNDb25maWd1cmF0aW9uL2NvbW1vbi9maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElXb3JraW5nQ29weVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vd29ya2luZ0NvcHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSG90RXhpdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgU2h1dGRvd25SZWFzb24sIElMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUZpbGVEaWFsb2dTZXJ2aWNlLCBDb25maXJtUmVzdWx0LCBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGNyZWF0ZUVkaXRvclBhcnQsIHJlZ2lzdGVyVGVzdEZpbGVFZGl0b3IsIFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50LCBUZXN0RW52aXJvbm1lbnRTZXJ2aWNlLCBUZXN0RmlsZXNDb25maWd1cmF0aW9uU2VydmljZSwgVGVzdEZpbGVTZXJ2aWNlLCBUZXN0VGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UsIHdvcmtiZW5jaFRlYXJkb3duIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgVGVzdFdvcmtzcGFjZSwgV29ya3NwYWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL3Rlc3QvY29tbW9uL3Rlc3RXb3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJV29ya2luZ0NvcHlFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtpbmdDb3B5RWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0Q29udGV4dFNlcnZpY2UsIFRlc3RNYXJrZXJTZXJ2aWNlLCBUZXN0V29ya2luZ0NvcHkgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwLCBXb3JraW5nQ29weUNhcGFiaWxpdGllcyB9IGZyb20gJy4uLy4uL2NvbW1vbi93b3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBFdmVudCwgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgVGVzdFNlcnZpY2VBY2Nlc3Nvciwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2VsZWN0cm9uLXNhbmRib3gvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UuanMnO1xuXG5zdWl0ZSgnV29ya2luZ0NvcHlCYWNrdXBUcmFja2VyIChuYXRpdmUpJywgZnVuY3Rpb24gKCkge1xuXG5cdGNsYXNzIFRlc3RXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIgZXh0ZW5kcyBOYXRpdmVXb3JraW5nQ29weUJhY2t1cFRyYWNrZXIge1xuXG5cdFx0Y29uc3RydWN0b3IoXG5cdFx0XHRASVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB3b3JraW5nQ29weUJhY2t1cFNlcnZpY2U6IElXb3JraW5nQ29weUJhY2t1cFNlcnZpY2UsXG5cdFx0XHRASUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UgZmlsZXNDb25maWd1cmF0aW9uU2VydmljZTogSUZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRASVdvcmtpbmdDb3B5U2VydmljZSB3b3JraW5nQ29weVNlcnZpY2U6IElXb3JraW5nQ29weVNlcnZpY2UsXG5cdFx0XHRASUxpZmVjeWNsZVNlcnZpY2UgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdFx0XHRASUZpbGVEaWFsb2dTZXJ2aWNlIGZpbGVEaWFsb2dTZXJ2aWNlOiBJRmlsZURpYWxvZ1NlcnZpY2UsXG5cdFx0XHRASURpYWxvZ1NlcnZpY2UgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIGNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0XHRASU5hdGl2ZUhvc3RTZXJ2aWNlIG5hdGl2ZUhvc3RTZXJ2aWNlOiBJTmF0aXZlSG9zdFNlcnZpY2UsXG5cdFx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0XHRASUVkaXRvclNlcnZpY2UgZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsXG5cdFx0XHRASUVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHRASVByb2dyZXNzU2VydmljZSBwcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0XHRASVdvcmtpbmdDb3B5RWRpdG9yU2VydmljZSB3b3JraW5nQ29weUVkaXRvclNlcnZpY2U6IElXb3JraW5nQ29weUVkaXRvclNlcnZpY2UsXG5cdFx0XHRASUVkaXRvckdyb3Vwc1NlcnZpY2UgZWRpdG9yR3JvdXBTZXJ2aWNlOiBJRWRpdG9yR3JvdXBzU2VydmljZVxuXHRcdCkge1xuXHRcdFx0c3VwZXIod29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLCBmaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCB3b3JraW5nQ29weVNlcnZpY2UsIGxpZmVjeWNsZVNlcnZpY2UsIGZpbGVEaWFsb2dTZXJ2aWNlLCBkaWFsb2dTZXJ2aWNlLCBjb250ZXh0U2VydmljZSwgbmF0aXZlSG9zdFNlcnZpY2UsIGxvZ1NlcnZpY2UsIGVudmlyb25tZW50U2VydmljZSwgcHJvZ3Jlc3NTZXJ2aWNlLCB3b3JraW5nQ29weUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UsIGVkaXRvckdyb3VwU2VydmljZSk7XG5cdFx0fVxuXG5cdFx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldEJhY2t1cFNjaGVkdWxlRGVsYXkoKTogbnVtYmVyIHtcblx0XHRcdHJldHVybiAxMDsgLy8gUmVkdWNlIHRpbWVvdXQgZm9yIHRlc3RzXG5cdFx0fVxuXG5cdFx0d2FpdEZvclJlYWR5KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0cmV0dXJuIHRoaXMud2hlblJlYWR5O1xuXHRcdH1cblxuXHRcdGdldCBwZW5kaW5nQmFja3VwT3BlcmF0aW9uQ291bnQoKTogbnVtYmVyIHsgcmV0dXJuIHRoaXMucGVuZGluZ0JhY2t1cE9wZXJhdGlvbnMuc2l6ZTsgfVxuXG5cdFx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdFx0Zm9yIChjb25zdCBbXywgcGVuZGluZ10gb2YgdGhpcy5wZW5kaW5nQmFja3VwT3BlcmF0aW9ucykge1xuXHRcdFx0XHRwZW5kaW5nLmNhbmNlbCgpO1xuXHRcdFx0XHRwZW5kaW5nLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVzdW1lID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdFx0cmVhZG9ubHkgb25EaWRSZXN1bWUgPSB0aGlzLl9vbkRpZFJlc3VtZS5ldmVudDtcblxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkU3VzcGVuZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdHJlYWRvbmx5IG9uRGlkU3VzcGVuZCA9IHRoaXMuX29uRGlkU3VzcGVuZC5ldmVudDtcblxuXHRcdHByb3RlY3RlZCBvdmVycmlkZSBzdXNwZW5kQmFja3VwT3BlcmF0aW9ucygpOiB7IHJlc3VtZTogKCkgPT4gdm9pZCB9IHtcblx0XHRcdGNvbnN0IHsgcmVzdW1lIH0gPSBzdXBlci5zdXNwZW5kQmFja3VwT3BlcmF0aW9ucygpO1xuXG5cdFx0XHR0aGlzLl9vbkRpZFN1c3BlbmQuZmlyZSgpO1xuXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXN1bWU6ICgpID0+IHtcblx0XHRcdFx0XHRyZXN1bWUoKTtcblxuXHRcdFx0XHRcdHRoaXMuX29uRGlkUmVzdW1lLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRsZXQgdGVzdERpcjogVVJJO1xuXHRsZXQgYmFja3VwSG9tZTogVVJJO1xuXHRsZXQgd29ya3NwYWNlQmFja3VwUGF0aDogVVJJO1xuXG5cdGxldCBhY2Nlc3NvcjogVGVzdFNlcnZpY2VBY2Nlc3NvcjtcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0dGVzdERpciA9IFVSSS5maWxlKGpvaW4oZ2VuZXJhdGVVdWlkKCksICd2c2N0ZXN0cycsICd3b3JraW5nY29weWJhY2t1cHRyYWNrZXInKSkud2l0aCh7IHNjaGVtZTogU2NoZW1hcy5pbk1lbW9yeSB9KTtcblx0XHRiYWNrdXBIb21lID0gam9pblBhdGgodGVzdERpciwgJ0JhY2t1cHMnKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VzSnNvblBhdGggPSBqb2luUGF0aChiYWNrdXBIb21lLCAnd29ya3NwYWNlcy5qc29uJyk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VSZXNvdXJjZSA9IFVSSS5maWxlKGlzV2luZG93cyA/ICdjOlxcXFx3b3Jrc3BhY2UnIDogJy93b3Jrc3BhY2UnKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLmluTWVtb3J5IH0pO1xuXHRcdHdvcmtzcGFjZUJhY2t1cFBhdGggPSBqb2luUGF0aChiYWNrdXBIb21lLCBoYXNoKHdvcmtzcGFjZVJlc291cmNlLnRvU3RyaW5nKCkpLnRvU3RyaW5nKDE2KSk7XG5cblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKCg8VGV4dEZpbGVFZGl0b3JNb2RlbE1hbmFnZXI+YWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzKSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUZXN0RmlsZUVkaXRvcigpKTtcblxuXHRcdGF3YWl0IGFjY2Vzc29yLmZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihiYWNrdXBIb21lKTtcblx0XHRhd2FpdCBhY2Nlc3Nvci5maWxlU2VydmljZS5jcmVhdGVGb2xkZXIod29ya3NwYWNlQmFja3VwUGF0aCk7XG5cblx0XHRyZXR1cm4gYWNjZXNzb3IuZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHdvcmtzcGFjZXNKc29uUGF0aCwgVlNCdWZmZXIuZnJvbVN0cmluZygnJykpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlVHJhY2tlcihhdXRvU2F2ZUVuYWJsZWQgPSBmYWxzZSk6IFByb21pc2U8eyBhY2Nlc3NvcjogVGVzdFNlcnZpY2VBY2Nlc3NvcjsgcGFydDogRWRpdG9yUGFydDsgdHJhY2tlcjogVGVzdFdvcmtpbmdDb3B5QmFja3VwVHJhY2tlcjsgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZTsgY2xlYW51cDogKCkgPT4gUHJvbWlzZTx2b2lkPiB9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGlmIChhdXRvU2F2ZUVuYWJsZWQpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb25TZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCdmaWxlcycsIHsgYXV0b1NhdmU6ICdhZnRlckRlbGF5JywgYXV0b1NhdmVEZWxheTogMSB9KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2ZpbGVzJywgeyBhdXRvU2F2ZTogJ29mZicsIGF1dG9TYXZlRGVsYXk6IDEgfSk7XG5cdFx0fVxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlKFxuXHRcdFx0PElDb250ZXh0S2V5U2VydmljZT5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNb2NrQ29udGV4dEtleVNlcnZpY2UpLFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHRuZXcgVGVzdENvbnRleHRTZXJ2aWNlKFRlc3RXb3Jrc3BhY2UpLFxuXHRcdFx0VGVzdEVudmlyb25tZW50U2VydmljZSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVXJpSWRlbnRpdHlTZXJ2aWNlKGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEZpbGVTZXJ2aWNlKCkpKSksXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlU2VydmljZSgpKSxcblx0XHRcdG5ldyBUZXN0TWFya2VyU2VydmljZSgpLFxuXHRcdFx0bmV3IFRlc3RUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZShjb25maWd1cmF0aW9uU2VydmljZSlcblx0XHQpKSk7XG5cblx0XHRjb25zdCBwYXJ0ID0gYXdhaXQgY3JlYXRlRWRpdG9yUGFydChpbnN0YW50aWF0aW9uU2VydmljZSwgZGlzcG9zYWJsZXMpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIHBhcnQpO1xuXG5cdFx0Y29uc3QgZWRpdG9yU2VydmljZTogRWRpdG9yU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShFZGl0b3JTZXJ2aWNlLCB1bmRlZmluZWQpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JTZXJ2aWNlLCBlZGl0b3JTZXJ2aWNlKTtcblxuXHRcdGFjY2Vzc29yID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3Nvcik7XG5cblx0XHRjb25zdCB0cmFja2VyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFdvcmtpbmdDb3B5QmFja3VwVHJhY2tlcik7XG5cblx0XHRjb25zdCBjbGVhbnVwID0gYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLndhaXRGb3JBbGxCYWNrdXBzKCk7IC8vIEZpbGUgY2hhbmdlcyBjb3VsZCBhbHNvIHNjaGVkdWxlIHNvbWUgYmFja3VwIG9wZXJhdGlvbnMgc28gd2UgbmVlZCB0byB3YWl0IGZvciB0aGVtIGJlZm9yZSBmaW5pc2hpbmcgdGhlIHRlc3RcblxuXHRcdFx0YXdhaXQgd29ya2JlbmNoVGVhcmRvd24oaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRwYXJ0LmRpc3Bvc2UoKTtcblx0XHRcdHRyYWNrZXIuZGlzcG9zZSgpO1xuXHRcdH07XG5cblx0XHRyZXR1cm4geyBhY2Nlc3NvciwgcGFydCwgdHJhY2tlciwgaW5zdGFudGlhdGlvblNlcnZpY2UsIGNsZWFudXAgfTtcblx0fVxuXG5cdHRlc3QoJ1RyYWNrIGJhY2t1cHMgKGZpbGUsIGF1dG8gc2F2ZSBvZmYpJywgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0cmFja0JhY2t1cHNUZXN0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXgudHh0JyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnVHJhY2sgYmFja3VwcyAoZmlsZSwgYXV0byBzYXZlIG9uKScsIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdHJhY2tCYWNrdXBzVGVzdCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4LnR4dCcpLCB0cnVlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdHJhY2tCYWNrdXBzVGVzdChyZXNvdXJjZTogVVJJLCBhdXRvU2F2ZTogYm9vbGVhbikge1xuXHRcdGNvbnN0IHsgYWNjZXNzb3IsIGNsZWFudXAgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoYXV0b1NhdmUpO1xuXG5cdFx0YXdhaXQgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cblx0XHRjb25zdCBmaWxlTW9kZWwgPSBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuZ2V0KHJlc291cmNlKTtcblx0XHRhc3NlcnQub2soZmlsZU1vZGVsKTtcblx0XHRmaWxlTW9kZWwudGV4dEVkaXRvck1vZGVsPy5zZXRWYWx1ZSgnU3VwZXIgR29vZCcpO1xuXG5cdFx0YXdhaXQgYWNjZXNzb3Iud29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmpvaW5CYWNrdXBSZXNvdXJjZSgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKGZpbGVNb2RlbCksIHRydWUpO1xuXG5cdFx0ZmlsZU1vZGVsLmRpc3Bvc2UoKTtcblxuXHRcdGF3YWl0IGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5qb2luRGlzY2FyZEJhY2t1cCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5oYXNCYWNrdXBTeW5jKGZpbGVNb2RlbCksIGZhbHNlKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fVxuXG5cdHRlc3QoJ29uV2lsbFNodXRkb3duIC0gbm8gdmV0byBpZiBubyBkaXJ0eSBmaWxlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKCk7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXgudHh0Jyk7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cblx0XHRjb25zdCBldmVudCA9IG5ldyBUZXN0QmVmb3JlU2h1dGRvd25FdmVudCgpO1xuXHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCBldmVudC52YWx1ZTtcblx0XHRhc3NlcnQub2soIXZldG8pO1xuXG5cdFx0YXdhaXQgY2xlYW51cCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbldpbGxTaHV0ZG93biAtIHZldG8gaWYgdXNlciBjYW5jZWxzIChob3QuZXhpdDogb2ZmKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKCk7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXgudHh0Jyk7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZURpYWxvZ1NlcnZpY2Uuc2V0Q29uZmlybVJlc3VsdChDb25maXJtUmVzdWx0LkNBTkNFTCk7XG5cdFx0YWNjZXNzb3IuZmlsZXNDb25maWd1cmF0aW9uU2VydmljZS50ZXN0T25GaWxlc0NvbmZpZ3VyYXRpb25DaGFuZ2UoeyBmaWxlczogeyBob3RFeGl0OiAnb2ZmJyB9IH0pO1xuXG5cdFx0YXdhaXQgbW9kZWw/LnJlc29sdmUoKTtcblx0XHRtb2RlbD8udGV4dEVkaXRvck1vZGVsPy5zZXRWYWx1ZSgnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAxKTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0YWNjZXNzb3IubGlmZWN5Y2xlU2VydmljZS5maXJlQmVmb3JlU2h1dGRvd24oZXZlbnQpO1xuXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IGV2ZW50LnZhbHVlO1xuXHRcdGFzc2VydC5vayh2ZXRvKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBubyB2ZXRvIGlmIGF1dG8gc2F2ZSBpcyBvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKHRydWUgLyogYXV0byBzYXZlIGVuYWJsZWQgKi8pO1xuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2luZGV4LnR4dCcpO1xuXHRcdGF3YWl0IGFjY2Vzc29yLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH0pO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMuZ2V0KHJlc291cmNlKTtcblxuXHRcdGF3YWl0IG1vZGVsPy5yZXNvbHZlKCk7XG5cdFx0bW9kZWw/LnRleHRFZGl0b3JNb2RlbD8uc2V0VmFsdWUoJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuZGlydHlDb3VudCwgMSk7XG5cblx0XHRjb25zdCBldmVudCA9IG5ldyBUZXN0QmVmb3JlU2h1dGRvd25FdmVudCgpO1xuXHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCBldmVudC52YWx1ZTtcblx0XHRhc3NlcnQub2soIXZldG8pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAwKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBubyB2ZXRvIGFuZCBiYWNrdXBzIGNsZWFuZWQgdXAgaWYgdXNlciBkb2VzIG5vdCB3YW50IHRvIHNhdmUgKGhvdC5leGl0OiBvZmYpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHsgYWNjZXNzb3IsIGNsZWFudXAgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoKTtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleC50eHQnKTtcblx0XHRhd2FpdCBhY2Nlc3Nvci5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9KTtcblxuXHRcdGNvbnN0IG1vZGVsID0gYWNjZXNzb3IudGV4dEZpbGVTZXJ2aWNlLmZpbGVzLmdldChyZXNvdXJjZSk7XG5cblx0XHRhY2Nlc3Nvci5maWxlRGlhbG9nU2VydmljZS5zZXRDb25maXJtUmVzdWx0KENvbmZpcm1SZXN1bHQuRE9OVF9TQVZFKTtcblx0XHRhY2Nlc3Nvci5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RPbkZpbGVzQ29uZmlndXJhdGlvbkNoYW5nZSh7IGZpbGVzOiB7IGhvdEV4aXQ6ICdvZmYnIH0gfSk7XG5cblx0XHRhd2FpdCBtb2RlbD8ucmVzb2x2ZSgpO1xuXHRcdG1vZGVsPy50ZXh0RWRpdG9yTW9kZWw/LnNldFZhbHVlKCdmb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0YWNjZXNzb3IubGlmZWN5Y2xlU2VydmljZS5maXJlQmVmb3JlU2h1dGRvd24oZXZlbnQpO1xuXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IGV2ZW50LnZhbHVlO1xuXHRcdGFzc2VydC5vayghdmV0byk7XG5cdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5kaXNjYXJkZWRCYWNrdXBzLmxlbmd0aCA+IDApO1xuXG5cdFx0YXdhaXQgY2xlYW51cCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbldpbGxTaHV0ZG93biAtIG5vIGJhY2t1cHMgZGlzY2FyZGVkIHdoZW4gc2h1dGRvd24gd2l0aG91dCBkaXJ0eSBidXQgdHJhY2tlciBub3QgcmVhZHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgeyBhY2Nlc3NvciwgY2xlYW51cCB9ID0gYXdhaXQgY3JlYXRlVHJhY2tlcigpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgVGVzdEJlZm9yZVNodXRkb3duRXZlbnQoKTtcblx0XHRhY2Nlc3Nvci5saWZlY3ljbGVTZXJ2aWNlLmZpcmVCZWZvcmVTaHV0ZG93bihldmVudCk7XG5cblx0XHRjb25zdCB2ZXRvID0gYXdhaXQgZXZlbnQudmFsdWU7XG5cdFx0YXNzZXJ0Lm9rKCF2ZXRvKTtcblx0XHRhc3NlcnQub2soIWFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5kaXNjYXJkZWRBbGxCYWNrdXBzKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBiYWNrdXBzIGRpc2NhcmRlZCB3aGVuIHNodXRkb3duIHdpdGhvdXQgZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgeyBhY2Nlc3NvciwgdHJhY2tlciwgY2xlYW51cCB9ID0gYXdhaXQgY3JlYXRlVHJhY2tlcigpO1xuXG5cdFx0YXdhaXQgdHJhY2tlci53YWl0Rm9yUmVhZHkoKTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0YWNjZXNzb3IubGlmZWN5Y2xlU2VydmljZS5maXJlQmVmb3JlU2h1dGRvd24oZXZlbnQpO1xuXG5cdFx0Y29uc3QgdmV0byA9IGF3YWl0IGV2ZW50LnZhbHVlO1xuXHRcdGFzc2VydC5vayghdmV0byk7XG5cdFx0YXNzZXJ0Lm9rKGFjY2Vzc29yLndvcmtpbmdDb3B5QmFja3VwU2VydmljZS5kaXNjYXJkZWRBbGxCYWNrdXBzKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBzYXZlIChob3QuZXhpdDogb2ZmKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKCk7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXgudHh0Jyk7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXG5cdFx0YWNjZXNzb3IuZmlsZURpYWxvZ1NlcnZpY2Uuc2V0Q29uZmlybVJlc3VsdChDb25maXJtUmVzdWx0LlNBVkUpO1xuXHRcdGFjY2Vzc29yLmZpbGVzQ29uZmlndXJhdGlvblNlcnZpY2UudGVzdE9uRmlsZXNDb25maWd1cmF0aW9uQ2hhbmdlKHsgZmlsZXM6IHsgaG90RXhpdDogJ29mZicgfSB9KTtcblxuXHRcdGF3YWl0IG1vZGVsPy5yZXNvbHZlKCk7XG5cdFx0bW9kZWw/LnRleHRFZGl0b3JNb2RlbD8uc2V0VmFsdWUoJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuZGlydHlDb3VudCwgMSk7XG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgVGVzdEJlZm9yZVNodXRkb3duRXZlbnQoKTtcblx0XHRhY2Nlc3Nvci5saWZlY3ljbGVTZXJ2aWNlLmZpcmVCZWZvcmVTaHV0ZG93bihldmVudCk7XG5cblx0XHRjb25zdCB2ZXRvID0gYXdhaXQgZXZlbnQudmFsdWU7XG5cdFx0YXNzZXJ0Lm9rKCF2ZXRvKTtcblx0XHRhc3NlcnQub2soIW1vZGVsPy5pc0RpcnR5KCkpO1xuXG5cdFx0YXdhaXQgY2xlYW51cCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbldpbGxTaHV0ZG93biAtIHZldG8gaWYgYmFja3VwIGZhaWxzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHsgYWNjZXNzb3IsIGNsZWFudXAgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoKTtcblxuXHRcdGNsYXNzIFRlc3RCYWNrdXBXb3JraW5nQ29weSBleHRlbmRzIFRlc3RXb3JraW5nQ29weSB7XG5cblx0XHRcdGNvbnN0cnVjdG9yKHJlc291cmNlOiBVUkkpIHtcblx0XHRcdFx0c3VwZXIocmVzb3VyY2UpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5yZWdpc3RlcldvcmtpbmdDb3B5KHRoaXMpKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgYmFja3VwKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVdvcmtpbmdDb3B5QmFja3VwPiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigndW5hYmxlIHRvIGJhY2t1cCcpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9jdXN0b20udHh0Jyk7XG5cdFx0Y29uc3QgY3VzdG9tV29ya2luZ0NvcHkgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RCYWNrdXBXb3JraW5nQ29weShyZXNvdXJjZSkpO1xuXHRcdGN1c3RvbVdvcmtpbmdDb3B5LnNldERpcnR5KHRydWUpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgVGVzdEJlZm9yZVNodXRkb3duRXZlbnQoKTtcblx0XHRldmVudC5yZWFzb24gPSBTaHV0ZG93blJlYXNvbi5RVUlUO1xuXHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCBldmVudC52YWx1ZTtcblx0XHRhc3NlcnQub2sodmV0byk7XG5cblx0XHRjb25zdCBmaW5hbFZldG8gPSBhd2FpdCBldmVudC5maW5hbFZhbHVlPy4oKTtcblx0XHRhc3NlcnQub2soZmluYWxWZXRvKTsgLy8gYXNzZXJ0IHRoZSB0cmFja2VyIHVzZXMgdGhlIGludGVybmFsIGZpbmFsVmV0byBBUElcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBzY3JhdGNocGFkcyAtIHZldG8gaWYgYmFja3VwIGZhaWxzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHsgYWNjZXNzb3IsIGNsZWFudXAgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoKTtcblxuXHRcdGNsYXNzIFRlc3RCYWNrdXBXb3JraW5nQ29weSBleHRlbmRzIFRlc3RXb3JraW5nQ29weSB7XG5cblx0XHRcdGNvbnN0cnVjdG9yKHJlc291cmNlOiBVUkkpIHtcblx0XHRcdFx0c3VwZXIocmVzb3VyY2UpO1xuXG5cdFx0XHRcdHRoaXMuX3JlZ2lzdGVyKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5yZWdpc3RlcldvcmtpbmdDb3B5KHRoaXMpKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgY2FwYWJpbGl0aWVzID0gV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuVW50aXRsZWQgfCBXb3JraW5nQ29weUNhcGFiaWxpdGllcy5TY3JhdGNocGFkO1xuXG5cdFx0XHRvdmVycmlkZSBhc3luYyBiYWNrdXAodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJV29ya2luZ0NvcHlCYWNrdXA+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCd1bmFibGUgdG8gYmFja3VwJyk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIGlzRGlydHkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgaXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2N1c3RvbS50eHQnKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RCYWNrdXBXb3JraW5nQ29weShyZXNvdXJjZSkpO1xuXG5cdFx0Y29uc3QgZXZlbnQgPSBuZXcgVGVzdEJlZm9yZVNodXRkb3duRXZlbnQoKTtcblx0XHRldmVudC5yZWFzb24gPSBTaHV0ZG93blJlYXNvbi5RVUlUO1xuXHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdGNvbnN0IHZldG8gPSBhd2FpdCBldmVudC52YWx1ZTtcblx0XHRhc3NlcnQub2sodmV0byk7XG5cblx0XHRjb25zdCBmaW5hbFZldG8gPSBhd2FpdCBldmVudC5maW5hbFZhbHVlPy4oKTtcblx0XHRhc3NlcnQub2soZmluYWxWZXRvKTsgLy8gYXNzZXJ0IHRoZSB0cmFja2VyIHVzZXMgdGhlIGludGVybmFsIGZpbmFsVmV0byBBUElcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0dGVzdCgnb25XaWxsU2h1dGRvd24gLSBwZW5kaW5nIGJhY2t1cCBvcGVyYXRpb25zIGNhbmNlbGVkIGFuZCB0cmFja2VyIHN1c3BlbmRlZC9yZXN1bXNlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB7IGFjY2Vzc29yLCB0cmFja2VyLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKCk7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL3BhdGgvaW5kZXgudHh0Jyk7XG5cdFx0YXdhaXQgYWNjZXNzb3IuZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2UsIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXG5cdFx0YXdhaXQgbW9kZWw/LnJlc29sdmUoKTtcblx0XHRtb2RlbD8udGV4dEVkaXRvck1vZGVsPy5zZXRWYWx1ZSgnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLndvcmtpbmdDb3B5U2VydmljZS5kaXJ0eUNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5wZW5kaW5nQmFja3VwT3BlcmF0aW9uQ291bnQsIDEpO1xuXG5cdFx0Y29uc3Qgb25TdXNwZW5kID0gRXZlbnQudG9Qcm9taXNlKHRyYWNrZXIub25EaWRTdXNwZW5kKTtcblxuXHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0ZXZlbnQucmVhc29uID0gU2h1dGRvd25SZWFzb24uUVVJVDtcblx0XHRhY2Nlc3Nvci5saWZlY3ljbGVTZXJ2aWNlLmZpcmVCZWZvcmVTaHV0ZG93bihldmVudCk7XG5cblx0XHRhd2FpdCBvblN1c3BlbmQ7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJhY2tlci5wZW5kaW5nQmFja3VwT3BlcmF0aW9uQ291bnQsIDApO1xuXG5cdFx0Ly8gT3BzIGFyZSBzdXNwZW5kZWQgZHVyaW5nIHNodXRkb3duIVxuXHRcdG1vZGVsPy50ZXh0RWRpdG9yTW9kZWw/LnNldFZhbHVlKCdiYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLmRpcnR5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cmFja2VyLnBlbmRpbmdCYWNrdXBPcGVyYXRpb25Db3VudCwgMCk7XG5cblx0XHRjb25zdCBvblJlc3VtZSA9IEV2ZW50LnRvUHJvbWlzZSh0cmFja2VyLm9uRGlkUmVzdW1lKTtcblx0XHRhd2FpdCBldmVudC52YWx1ZTtcblxuXHRcdC8vIE9wcyBhcmUgcmVzdW1lZCBhZnRlciBzaHV0ZG93biFcblx0XHRtb2RlbD8udGV4dEVkaXRvck1vZGVsPy5zZXRWYWx1ZSgnZm9vJyk7XG5cdFx0YXdhaXQgb25SZXN1bWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRyYWNrZXIucGVuZGluZ0JhY2t1cE9wZXJhdGlvbkNvdW50LCAxKTtcblxuXHRcdGF3YWl0IGNsZWFudXAoKTtcblx0fSk7XG5cblx0c3VpdGUoJ0hvdCBFeGl0JywgKCkgPT4ge1xuXHRcdHN1aXRlKCdcIm9uRXhpdFwiIHNldHRpbmcnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgb24gbm9uLU1hYyAocmVhc29uOiBDTE9TRSwgd2luZG93czogc2luZ2xlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIHRydWUsICEhaXNNYWNpbnRvc2gpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgb24gbm9uLU1hYyAocmVhc29uOiBDTE9TRSwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIGZhbHNlLCAhIWlzTWFjaW50b3NoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLkNMT1NFLCB0cnVlLCB0cnVlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLkNMT1NFLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBRVUlULCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBRVUlULCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlFVSVQsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFFVSVQsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5RVUlULCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFJFTE9BRCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uUkVMT0FELCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogc2luZ2xlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCBmYWxzZSwgdHJ1ZSwgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgTk9UIGhvdCBleGl0IChyZWFzb246IExPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCB0cnVlLCB0cnVlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgZW1wdHkgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uTE9BRCwgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnXCJvbkV4aXRBbmRXaW5kb3dDbG9zZVwiIHNldHRpbmcnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogQ0xPU0UsIHdpbmRvd3M6IHNpbmdsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IENMT1NFLCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIGZhbHNlLCBmYWxzZSwgISFpc01hY2ludG9zaCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFFVSVQsIHdpbmRvd3M6IHNpbmdsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5RVUlULCBmYWxzZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uUVVJVCwgdHJ1ZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uUVVJVCwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFJFTE9BRCwgd2luZG93czogc2luZ2xlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFJFTE9BRCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgdHJ1ZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgZW1wdHkgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uTE9BRCwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBob3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uTE9BRCwgZmFsc2UsIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IExPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gaG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLkxPQUQsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgZW1wdHkgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIGhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5MT0FELCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdcIm9uRXhpdFwiIHNldHRpbmcgLSBzY3JhdGNocGFkJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IENMT1NFLCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IENMT1NFLCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIGZhbHNlLCAhIWlzTWFjaW50b3NoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IENMT1NFLCB3aW5kb3dzOiBtdWx0aXBsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLkNMT1NFLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgaG90IGV4aXQgKHJlYXNvbjogQ0xPU0UsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFFVSVQsIHdpbmRvd3M6IHNpbmdsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBRVUlULCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5RVUlULCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFFVSVQsIHdpbmRvd3M6IG11bHRpcGxlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uUVVJVCwgdHJ1ZSwgdHJ1ZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5RVUlULCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IHNpbmdsZSwgZW1wdHkgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVQsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uUkVMT0FELCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uUkVMT0FELCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogc2luZ2xlLCB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVCwgU2h1dGRvd25SZWFzb24uTE9BRCwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElULCBTaHV0ZG93blJlYXNvbi5MT0FELCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdcIm9uRXhpdEFuZFdpbmRvd0Nsb3NlXCIgc2V0dGluZyAtIHNjcmF0Y2hwYWQnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogQ0xPU0UsIHdpbmRvd3M6IHNpbmdsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5DTE9TRSwgZmFsc2UsIGZhbHNlLCAhIWlzTWFjaW50b3NoKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IENMT1NFLCB3aW5kb3dzOiBtdWx0aXBsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uQ0xPU0UsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBDTE9TRSwgd2luZG93czogbXVsdGlwbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLkNMT1NFLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBRVUlULCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBRVUlULCB3aW5kb3dzOiBzaW5nbGUsIGVtcHR5IHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlFVSVQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUVVJVCwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlFVSVQsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFFVSVQsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5RVUlULCB0cnVlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLlJFTE9BRCwgZmFsc2UsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGhvdCBleGl0IChyZWFzb246IFJFTE9BRCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogUkVMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uUkVMT0FELCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBSRUxPQUQsIHdpbmRvd3M6IG11bHRpcGxlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5SRUxPQUQsIHRydWUsIGZhbHNlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBzaW5nbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLkxPQUQsIGZhbHNlLCB0cnVlLCBmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogc2luZ2xlLCBlbXB0eSB3b3Jrc3BhY2UpJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRyZXR1cm4gc2NyYXRjaHBhZEhvdEV4aXRUZXN0LmNhbGwodGhpcywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFLCBTaHV0ZG93blJlYXNvbi5MT0FELCBmYWxzZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdzaG91bGQgaG90IGV4aXQgKHJlYXNvbjogTE9BRCwgd2luZG93czogbXVsdGlwbGUsIHdvcmtzcGFjZSknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdHJldHVybiBzY3JhdGNocGFkSG90RXhpdFRlc3QuY2FsbCh0aGlzLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UsIFNodXRkb3duUmVhc29uLkxPQUQsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIE5PVCBob3QgZXhpdCAocmVhc29uOiBMT0FELCB3aW5kb3dzOiBtdWx0aXBsZSwgZW1wdHkgd29ya3NwYWNlKScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0cmV0dXJuIHNjcmF0Y2hwYWRIb3RFeGl0VGVzdC5jYWxsKHRoaXMsIEhvdEV4aXRDb25maWd1cmF0aW9uLk9OX0VYSVRfQU5EX1dJTkRPV19DTE9TRSwgU2h1dGRvd25SZWFzb24uTE9BRCwgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblxuXHRcdGFzeW5jIGZ1bmN0aW9uIGhvdEV4aXRUZXN0KHRoaXM6IGFueSwgc2V0dGluZzogc3RyaW5nLCBzaHV0ZG93blJlYXNvbjogU2h1dGRvd25SZWFzb24sIG11bHRpcGxlV2luZG93czogYm9vbGVhbiwgd29ya3NwYWNlOiBib29sZWFuLCBzaG91bGRWZXRvOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRjb25zdCB7IGFjY2Vzc29yLCBjbGVhbnVwIH0gPSBhd2FpdCBjcmVhdGVUcmFja2VyKCk7XG5cblx0XHRcdGNvbnN0IHJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvcGF0aC9pbmRleC50eHQnKTtcblx0XHRcdGF3YWl0IGFjY2Vzc29yLmVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH0pO1xuXG5cdFx0XHRjb25zdCBtb2RlbCA9IGFjY2Vzc29yLnRleHRGaWxlU2VydmljZS5maWxlcy5nZXQocmVzb3VyY2UpO1xuXG5cdFx0XHQvLyBTZXQgaG90IGV4aXQgY29uZmlnXG5cdFx0XHRhY2Nlc3Nvci5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RPbkZpbGVzQ29uZmlndXJhdGlvbkNoYW5nZSh7IGZpbGVzOiB7IGhvdEV4aXQ6IHNldHRpbmcgfSB9KTtcblxuXHRcdFx0Ly8gU2V0IGVtcHR5IHdvcmtzcGFjZSBpZiByZXF1aXJlZFxuXHRcdFx0aWYgKCF3b3Jrc3BhY2UpIHtcblx0XHRcdFx0YWNjZXNzb3IuY29udGV4dFNlcnZpY2Uuc2V0V29ya3NwYWNlKG5ldyBXb3Jrc3BhY2UoJ2VtcHR5OjE1MDgzMTcwMjI3NTEnKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNldCBtdWx0aXBsZSB3aW5kb3dzIGlmIHJlcXVpcmVkXG5cdFx0XHRpZiAobXVsdGlwbGVXaW5kb3dzKSB7XG5cdFx0XHRcdGFjY2Vzc29yLm5hdGl2ZUhvc3RTZXJ2aWNlLndpbmRvd0NvdW50ID0gUHJvbWlzZS5yZXNvbHZlKDIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTZXQgY2FuY2VsIHRvIGZvcmNlIGEgdmV0byBpZiBob3QgZXhpdCBkb2VzIG5vdCB0cmlnZ2VyXG5cdFx0XHRhY2Nlc3Nvci5maWxlRGlhbG9nU2VydmljZS5zZXRDb25maXJtUmVzdWx0KENvbmZpcm1SZXN1bHQuQ0FOQ0VMKTtcblxuXHRcdFx0YXdhaXQgbW9kZWw/LnJlc29sdmUoKTtcblx0XHRcdG1vZGVsPy50ZXh0RWRpdG9yTW9kZWw/LnNldFZhbHVlKCdmb28nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weVNlcnZpY2UuZGlydHlDb3VudCwgMSk7XG5cblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0XHRldmVudC5yZWFzb24gPSBzaHV0ZG93blJlYXNvbjtcblx0XHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdFx0Y29uc3QgdmV0byA9IGF3YWl0IGV2ZW50LnZhbHVlO1xuXHRcdFx0YXNzZXJ0Lm9rKHR5cGVvZiBldmVudC5maW5hbFZhbHVlID09PSAnZnVuY3Rpb24nKTsgLy8gYXNzZXJ0IHRoZSB0cmFja2VyIHVzZXMgdGhlIGludGVybmFsIGZpbmFsVmV0byBBUElcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuZGlzY2FyZGVkQmFja3Vwcy5sZW5ndGgsIDApOyAvLyBXaGVuIGhvdCBleGl0IGlzIHNldCwgYmFja3VwcyBzaG91bGQgbmV2ZXIgYmUgY2xlYW5lZCBzaW5jZSB0aGUgY29uZmlybSByZXN1bHQgaXMgY2FuY2VsXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmV0bywgc2hvdWxkVmV0byk7XG5cblx0XHRcdGF3YWl0IGNsZWFudXAoKTtcblx0XHR9XG5cblx0XHRhc3luYyBmdW5jdGlvbiBzY3JhdGNocGFkSG90RXhpdFRlc3QodGhpczogYW55LCBzZXR0aW5nOiBzdHJpbmcsIHNodXRkb3duUmVhc29uOiBTaHV0ZG93blJlYXNvbiwgbXVsdGlwbGVXaW5kb3dzOiBib29sZWFuLCB3b3Jrc3BhY2U6IGJvb2xlYW4sIHNob3VsZFZldG86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IHsgYWNjZXNzb3IsIGNsZWFudXAgfSA9IGF3YWl0IGNyZWF0ZVRyYWNrZXIoKTtcblxuXHRcdFx0Y2xhc3MgVGVzdEJhY2t1cFdvcmtpbmdDb3B5IGV4dGVuZHMgVGVzdFdvcmtpbmdDb3B5IHtcblxuXHRcdFx0XHRjb25zdHJ1Y3RvcihyZXNvdXJjZTogVVJJKSB7XG5cdFx0XHRcdFx0c3VwZXIocmVzb3VyY2UpO1xuXG5cdFx0XHRcdFx0dGhpcy5fcmVnaXN0ZXIoYWNjZXNzb3Iud29ya2luZ0NvcHlTZXJ2aWNlLnJlZ2lzdGVyV29ya2luZ0NvcHkodGhpcykpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3ZlcnJpZGUgY2FwYWJpbGl0aWVzID0gV29ya2luZ0NvcHlDYXBhYmlsaXRpZXMuVW50aXRsZWQgfCBXb3JraW5nQ29weUNhcGFiaWxpdGllcy5TY3JhdGNocGFkO1xuXG5cdFx0XHRcdG92ZXJyaWRlIGlzRGlydHkoKTogYm9vbGVhbiB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0b3ZlcnJpZGUgaXNNb2RpZmllZCgpOiBib29sZWFuIHtcblx0XHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBTZXQgaG90IGV4aXQgY29uZmlnXG5cdFx0XHRhY2Nlc3Nvci5maWxlc0NvbmZpZ3VyYXRpb25TZXJ2aWNlLnRlc3RPbkZpbGVzQ29uZmlndXJhdGlvbkNoYW5nZSh7IGZpbGVzOiB7IGhvdEV4aXQ6IHNldHRpbmcgfSB9KTtcblxuXHRcdFx0Ly8gU2V0IGVtcHR5IHdvcmtzcGFjZSBpZiByZXF1aXJlZFxuXHRcdFx0aWYgKCF3b3Jrc3BhY2UpIHtcblx0XHRcdFx0YWNjZXNzb3IuY29udGV4dFNlcnZpY2Uuc2V0V29ya3NwYWNlKG5ldyBXb3Jrc3BhY2UoJ2VtcHR5OjE1MDgzMTcwMjI3NTEnKSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFNldCBtdWx0aXBsZSB3aW5kb3dzIGlmIHJlcXVpcmVkXG5cdFx0XHRpZiAobXVsdGlwbGVXaW5kb3dzKSB7XG5cdFx0XHRcdGFjY2Vzc29yLm5hdGl2ZUhvc3RTZXJ2aWNlLndpbmRvd0NvdW50ID0gUHJvbWlzZS5yZXNvbHZlKDIpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBTZXQgY2FuY2VsIHRvIGZvcmNlIGEgdmV0byBpZiBob3QgZXhpdCBkb2VzIG5vdCB0cmlnZ2VyXG5cdFx0XHRhY2Nlc3Nvci5maWxlRGlhbG9nU2VydmljZS5zZXRDb25maXJtUmVzdWx0KENvbmZpcm1SZXN1bHQuQ0FOQ0VMKTtcblxuXHRcdFx0Y29uc3QgcmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9wYXRoL2N1c3RvbS50eHQnKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEJhY2t1cFdvcmtpbmdDb3B5KHJlc291cmNlKSk7XG5cblx0XHRcdGNvbnN0IGV2ZW50ID0gbmV3IFRlc3RCZWZvcmVTaHV0ZG93bkV2ZW50KCk7XG5cdFx0XHRldmVudC5yZWFzb24gPSBzaHV0ZG93blJlYXNvbjtcblx0XHRcdGFjY2Vzc29yLmxpZmVjeWNsZVNlcnZpY2UuZmlyZUJlZm9yZVNodXRkb3duKGV2ZW50KTtcblxuXHRcdFx0Y29uc3QgdmV0byA9IGF3YWl0IGV2ZW50LnZhbHVlO1xuXHRcdFx0YXNzZXJ0Lm9rKHR5cGVvZiBldmVudC5maW5hbFZhbHVlID09PSAnZnVuY3Rpb24nKTsgLy8gYXNzZXJ0IHRoZSB0cmFja2VyIHVzZXMgdGhlIGludGVybmFsIGZpbmFsVmV0byBBUElcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci53b3JraW5nQ29weUJhY2t1cFNlcnZpY2UuZGlzY2FyZGVkQmFja3Vwcy5sZW5ndGgsIDApOyAvLyBXaGVuIGhvdCBleGl0IGlzIHNldCwgYmFja3VwcyBzaG91bGQgbmV2ZXIgYmUgY2xlYW5lZCBzaW5jZSB0aGUgY29uZmlybSByZXN1bHQgaXMgY2FuY2VsXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmV0bywgc2hvdWxkVmV0byk7XG5cblx0XHRcdGF3YWl0IGNsZWFudXAoKTtcblx0XHR9XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGFBQWEsaUJBQWlCO0FBQ3ZDLFNBQVMsWUFBWTtBQUNyQixTQUFTLFdBQVc7QUFDcEIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsc0NBQXNDO0FBRS9DLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMseUNBQXlDLGtCQUFrQjtBQUNwRSxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLGdCQUFnQix5QkFBeUI7QUFDbEQsU0FBUyxvQkFBb0IsZUFBZSxzQkFBc0I7QUFDbEUsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxrQkFBa0Isd0JBQXdCLHlCQUF5Qix3QkFBd0IsK0JBQStCLGlCQUFpQixzQ0FBc0MseUJBQXlCO0FBQ25O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QixtQkFBbUIsS0FBSztBQUVsRCxZQUFNLE9BQU8sTUFBTSxNQUFNO0FBQ3pCLGFBQU8sR0FBRyxPQUFPLE1BQU0sZUFBZSxVQUFVO0FBQ2hELGFBQU8sWUFBWUEsVUFBUyx5QkFBeUIsaUJBQWlCLFFBQVEsQ0FBQztBQUMvRSxhQUFPLFlBQVksTUFBTSxVQUFVO0FBRW5DLFlBQU0sUUFBUTtBQUFBLElBQ2Y7QUFFQSxtQkFBZSxzQkFBaUMsU0FBaUIsZ0JBQWdDLGlCQUEwQixXQUFvQixZQUFvQztBQUNsTCxZQUFNLEVBQUUsVUFBQUEsV0FBVSxRQUFRLElBQUksTUFBTSxjQUFjO0FBQUEsTUFFbEQsTUFBTSw4QkFBOEIsZ0JBQWdCO0FBQUEsUUFFbkQsWUFBWUMsV0FBZTtBQUMxQixnQkFBTUEsU0FBUTtBQUtmLGVBQVMsZUFBZSx3QkFBd0IsV0FBVyx3QkFBd0I7QUFIbEYsZUFBSyxVQUFVRCxVQUFTLG1CQUFtQixvQkFBb0IsSUFBSSxDQUFDO0FBQUEsUUFDckU7QUFBQSxRQUlTLFVBQW1CO0FBQzNCLGlCQUFPO0FBQUEsUUFDUjtBQUFBLFFBRVMsYUFBc0I7QUFDOUIsaUJBQU87QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUdBLE1BQUFBLFVBQVMsMEJBQTBCLCtCQUErQixFQUFFLE9BQU8sRUFBRSxTQUFTLFFBQVEsRUFBRSxDQUFDO0FBR2pHLFVBQUksQ0FBQyxXQUFXO0FBQ2YsUUFBQUEsVUFBUyxlQUFlLGFBQWEsSUFBSSxVQUFVLHFCQUFxQixDQUFDO0FBQUEsTUFDMUU7QUFHQSxVQUFJLGlCQUFpQjtBQUNwQixRQUFBQSxVQUFTLGtCQUFrQixjQUFjLFFBQVEsUUFBUSxDQUFDO0FBQUEsTUFDM0Q7QUFHQSxNQUFBQSxVQUFTLGtCQUFrQixpQkFBaUIsY0FBYyxNQUFNO0FBRWhFLFlBQU0sV0FBVyxXQUFXLEtBQUssTUFBTSxrQkFBa0I7QUFDekQsa0JBQVksSUFBSSxJQUFJLHNCQUFzQixRQUFRLENBQUM7QUFFbkQsWUFBTSxRQUFRLElBQUksd0JBQXdCO0FBQzFDLFlBQU0sU0FBUztBQUNmLE1BQUFBLFVBQVMsaUJBQWlCLG1CQUFtQixLQUFLO0FBRWxELFlBQU0sT0FBTyxNQUFNLE1BQU07QUFDekIsYUFBTyxHQUFHLE9BQU8sTUFBTSxlQUFlLFVBQVU7QUFDaEQsYUFBTyxZQUFZQSxVQUFTLHlCQUF5QixpQkFBaUIsUUFBUSxDQUFDO0FBQy9FLGFBQU8sWUFBWSxNQUFNLFVBQVU7QUFFbkMsWUFBTSxRQUFRO0FBQUEsSUFDZjtBQUFBLEVBQ0QsQ0FBQztBQUVELDBDQUF3QztBQUN6QyxDQUFDOyIsCiAgIm5hbWVzIjogWyJhY2Nlc3NvciIsICJyZXNvdXJjZSJdCn0K
