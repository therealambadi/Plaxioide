import assert from "assert";
import { EditorActivation } from "../../../../../platform/editor/common/editor.js";
import { URI } from "../../../../../base/common/uri.js";
import { Event } from "../../../../../base/common/event.js";
import { DEFAULT_EDITOR_ASSOCIATION, EditorCloseContext, EditorsOrder, isEditorInputWithOptions, SideBySideEditor, isEditorInput, EditorInputCapabilities } from "../../../../common/editor.js";
import { workbenchInstantiationService, TestServiceAccessor, registerTestEditor, TestFileEditorInput, registerTestResourceEditor, registerTestSideBySideEditor, createEditorPart, registerTestFileEditor, TestTextFileEditor, TestSingletonFileEditorInput, workbenchTeardown } from "../../../../test/browser/workbenchTestServices.js";
import { EditorService } from "../../browser/editorService.js";
import { IEditorGroupsService, GroupDirection, GroupsArrangement } from "../../common/editorGroupsService.js";
import { ACTIVE_GROUP, IEditorService, SIDE_GROUP } from "../../common/editorService.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { FileEditorInput } from "../../../../contrib/files/browser/editors/fileEditorInput.js";
import { timeout } from "../../../../../base/common/async.js";
import { FileOperationEvent, FileOperation } from "../../../../../platform/files/common/files.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { MockScopableContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { RegisteredEditorPriority } from "../../common/editorResolverService.js";
import { WorkspaceTrustUriResponse } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { SideBySideEditorInput } from "../../../../common/editor/sideBySideEditorInput.js";
import { ErrorPlaceholderEditor } from "../../../../browser/parts/editor/editorPlaceholder.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("EditorService", () => {
  const TEST_EDITOR_ID = "MyTestEditorForEditorService";
  const TEST_EDITOR_INPUT_ID = "testEditorInputForEditorService";
  const disposables = new DisposableStore();
  let testLocalInstantiationService = void 0;
  setup(() => {
    disposables.add(registerTestEditor(TEST_EDITOR_ID, [new SyncDescriptor(TestFileEditorInput), new SyncDescriptor(TestSingletonFileEditorInput)], TEST_EDITOR_INPUT_ID));
    disposables.add(registerTestResourceEditor());
    disposables.add(registerTestSideBySideEditor());
  });
  teardown(async () => {
    if (testLocalInstantiationService) {
      await workbenchTeardown(testLocalInstantiationService);
      testLocalInstantiationService = void 0;
    }
    disposables.clear();
  });
  async function createEditorService(instantiationService = workbenchInstantiationService(void 0, disposables)) {
    const part = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, part);
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    testLocalInstantiationService = instantiationService;
    return [part, editorService, instantiationService.createInstance(TestServiceAccessor)];
  }
  function createTestFileEditorInput(resource, typeId) {
    return disposables.add(new TestFileEditorInput(resource, typeId));
  }
  test("openEditor() - basics", async () => {
    const [, service, accessor] = await createEditorService();
    await testOpenBasics(service, accessor.editorPaneService);
  });
  test("openEditor() - basics (scoped)", async () => {
    const [part, service, accessor] = await createEditorService();
    const scoped = service.createScoped("main", disposables);
    await part.whenReady;
    await testOpenBasics(scoped, accessor.editorPaneService);
  });
  async function testOpenBasics(editorService, editorPaneService) {
    let input = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    let otherInput = createTestFileEditorInput(URI.parse("my://resource2-basics"), TEST_EDITOR_INPUT_ID);
    let activeEditorChangeEventCounter = 0;
    disposables.add(editorService.onDidActiveEditorChange(() => {
      activeEditorChangeEventCounter++;
    }));
    let visibleEditorChangeEventCounter = 0;
    disposables.add(editorService.onDidVisibleEditorsChange(() => {
      visibleEditorChangeEventCounter++;
    }));
    let willOpenEditorListenerCounter = 0;
    disposables.add(editorService.onWillOpenEditor(() => {
      willOpenEditorListenerCounter++;
    }));
    let didCloseEditorListenerCounter = 0;
    disposables.add(editorService.onDidCloseEditor(() => {
      didCloseEditorListenerCounter++;
    }));
    let willInstantiateEditorPaneListenerCounter = 0;
    disposables.add(editorPaneService.onWillInstantiateEditorPane((e) => {
      if (e.typeId === TEST_EDITOR_ID) {
        willInstantiateEditorPaneListenerCounter++;
      }
    }));
    let editor = await editorService.openEditor(input, { pinned: true });
    assert.strictEqual(editor?.getId(), TEST_EDITOR_ID);
    assert.strictEqual(editor, editorService.activeEditorPane);
    assert.strictEqual(1, editorService.count);
    assert.strictEqual(input, editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].editor);
    assert.strictEqual(input, editorService.getEditors(EditorsOrder.SEQUENTIAL)[0].editor);
    assert.strictEqual(input, editorService.activeEditor);
    assert.strictEqual(editorService.visibleEditorPanes.length, 1);
    assert.strictEqual(editorService.visibleEditorPanes[0], editor);
    assert.ok(!editorService.activeTextEditorControl);
    assert.ok(!editorService.activeTextEditorLanguageId);
    assert.strictEqual(editorService.visibleTextEditorControls.length, 0);
    assert.strictEqual(editorService.getVisibleTextEditorControls(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(editorService.isOpened(input), true);
    assert.strictEqual(editorService.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), true);
    assert.strictEqual(editorService.isOpened({ resource: input.resource, typeId: input.typeId, editorId: "unknownTypeId" }), false);
    assert.strictEqual(editorService.isOpened({ resource: input.resource, typeId: "unknownTypeId", editorId: input.editorId }), false);
    assert.strictEqual(editorService.isOpened({ resource: input.resource, typeId: "unknownTypeId", editorId: "unknownTypeId" }), false);
    assert.strictEqual(editorService.isVisible(input), true);
    assert.strictEqual(editorService.isVisible(otherInput), false);
    assert.strictEqual(willOpenEditorListenerCounter, 1);
    assert.strictEqual(activeEditorChangeEventCounter, 1);
    assert.strictEqual(visibleEditorChangeEventCounter, 1);
    assert.ok(editorPaneService.didInstantiateEditorPane(TEST_EDITOR_ID));
    assert.strictEqual(willInstantiateEditorPaneListenerCounter, 1);
    await editor?.group.closeEditor(input);
    assert.strictEqual(0, editorService.count);
    assert.strictEqual(0, editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length);
    assert.strictEqual(0, editorService.getEditors(EditorsOrder.SEQUENTIAL).length);
    assert.strictEqual(didCloseEditorListenerCounter, 1);
    assert.strictEqual(activeEditorChangeEventCounter, 2);
    assert.strictEqual(visibleEditorChangeEventCounter, 2);
    assert.ok(input.gotDisposed);
    await editorService.openEditor(input, { pinned: true });
    assert.strictEqual(0, editorService.count);
    input = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-basics"), TEST_EDITOR_INPUT_ID);
    await editorService.openEditor(input, { pinned: true });
    editor = await editorService.openEditor(otherInput, { pinned: true });
    assert.strictEqual(2, editorService.count);
    assert.strictEqual(otherInput, editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].editor);
    assert.strictEqual(input, editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].editor);
    assert.strictEqual(input, editorService.getEditors(EditorsOrder.SEQUENTIAL)[0].editor);
    assert.strictEqual(otherInput, editorService.getEditors(EditorsOrder.SEQUENTIAL)[1].editor);
    assert.strictEqual(editorService.visibleEditorPanes.length, 1);
    assert.strictEqual(editorService.isOpened(input), true);
    assert.strictEqual(editorService.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), true);
    assert.strictEqual(editorService.isOpened(otherInput), true);
    assert.strictEqual(editorService.isOpened({ resource: otherInput.resource, typeId: otherInput.typeId, editorId: otherInput.editorId }), true);
    assert.strictEqual(activeEditorChangeEventCounter, 4);
    assert.strictEqual(willOpenEditorListenerCounter, 3);
    assert.strictEqual(visibleEditorChangeEventCounter, 4);
    const stickyInput = createTestFileEditorInput(URI.parse("my://resource3-basics"), TEST_EDITOR_INPUT_ID);
    await editorService.openEditor(stickyInput, { sticky: true });
    assert.strictEqual(3, editorService.count);
    const allSequentialEditors = editorService.getEditors(EditorsOrder.SEQUENTIAL);
    assert.strictEqual(allSequentialEditors.length, 3);
    assert.strictEqual(stickyInput, allSequentialEditors[0].editor);
    assert.strictEqual(input, allSequentialEditors[1].editor);
    assert.strictEqual(otherInput, allSequentialEditors[2].editor);
    const sequentialEditorsExcludingSticky = editorService.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true });
    assert.strictEqual(sequentialEditorsExcludingSticky.length, 2);
    assert.strictEqual(input, sequentialEditorsExcludingSticky[0].editor);
    assert.strictEqual(otherInput, sequentialEditorsExcludingSticky[1].editor);
    const mruEditorsExcludingSticky = editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true });
    assert.strictEqual(mruEditorsExcludingSticky.length, 2);
    assert.strictEqual(input, sequentialEditorsExcludingSticky[0].editor);
    assert.strictEqual(otherInput, sequentialEditorsExcludingSticky[1].editor);
  }
  test("openEditor() - multiple calls are cancelled and indicated as such", async () => {
    const [, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-basics"), TEST_EDITOR_INPUT_ID);
    let activeEditorChangeEventCounter = 0;
    const activeEditorChangeListener = service.onDidActiveEditorChange(() => {
      activeEditorChangeEventCounter++;
    });
    let visibleEditorChangeEventCounter = 0;
    const visibleEditorChangeListener = service.onDidVisibleEditorsChange(() => {
      visibleEditorChangeEventCounter++;
    });
    const editorP1 = service.openEditor(input, { pinned: true });
    const editorP2 = service.openEditor(otherInput, { pinned: true });
    const editor1 = await editorP1;
    assert.strictEqual(editor1, void 0);
    const editor2 = await editorP2;
    assert.strictEqual(editor2?.input, otherInput);
    assert.strictEqual(activeEditorChangeEventCounter, 1);
    assert.strictEqual(visibleEditorChangeEventCounter, 1);
    activeEditorChangeListener.dispose();
    visibleEditorChangeListener.dispose();
  });
  test("openEditor() - same input does not cancel previous one - https://github.com/microsoft/vscode/issues/136684", async () => {
    const [, service] = await createEditorService();
    let input = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    let editorP1 = service.openEditor(input, { pinned: true });
    let editorP2 = service.openEditor(input, { pinned: true });
    let editor1 = await editorP1;
    assert.strictEqual(editor1?.input, input);
    let editor2 = await editorP2;
    assert.strictEqual(editor2?.input, input);
    assert.ok(editor2.group);
    await editor2.group.closeAllEditors();
    input = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    const inputSame = createTestFileEditorInput(URI.parse("my://resource-basics"), TEST_EDITOR_INPUT_ID);
    editorP1 = service.openEditor(input, { pinned: true });
    editorP2 = service.openEditor(inputSame, { pinned: true });
    editor1 = await editorP1;
    assert.strictEqual(editor1?.input, input);
    editor2 = await editorP2;
    assert.strictEqual(editor2?.input, input);
  });
  test("openEditor() - singleton typed editors reveal instead of split", async () => {
    const [part, service] = await createEditorService();
    const input1 = disposables.add(new TestSingletonFileEditorInput(URI.parse("my://resource-basics1"), TEST_EDITOR_INPUT_ID));
    const input2 = disposables.add(new TestSingletonFileEditorInput(URI.parse("my://resource-basics2"), TEST_EDITOR_INPUT_ID));
    const input1Group = (await service.openEditor(input1, { pinned: true }))?.group;
    const input2Group = (await service.openEditor(input2, { pinned: true }, SIDE_GROUP))?.group;
    assert.strictEqual(part.activeGroup, input2Group);
    await service.openEditor(input1, { pinned: true });
    assert.strictEqual(part.activeGroup, input1Group);
  });
  test("openEditor() - locked groups", async () => {
    disposables.add(registerTestFileEditor());
    const [part, service, accessor] = await createEditorService();
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-locked-group-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => ({ editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) })
      }
    ));
    const input1 = { resource: URI.parse("file://resource-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input2 = { resource: URI.parse("file://resource2-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input3 = { resource: URI.parse("file://resource3-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input4 = { resource: URI.parse("file://resource4-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input5 = { resource: URI.parse("file://resource5-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input6 = { resource: URI.parse("file://resource6-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input7 = { resource: URI.parse("file://resource7-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const editor1 = await service.openEditor(input1, { pinned: true });
    const editor2 = await service.openEditor(input2, { pinned: true }, SIDE_GROUP);
    const group1 = editor1?.group;
    assert.strictEqual(group1?.count, 1);
    const group2 = editor2?.group;
    assert.strictEqual(group2?.count, 1);
    group2.lock(true);
    part.activateGroup(group2.id);
    await service.openEditor(input3, { pinned: true });
    assert.strictEqual(group1.count, 2);
    assert.strictEqual(group1.activeEditor?.resource?.toString(), input3.resource.toString());
    assert.strictEqual(group2.count, 1);
    await service.openEditor(input3, { pinned: true }, group2.id);
    assert.strictEqual(group1.count, 2);
    assert.strictEqual(group2.count, 2);
    assert.strictEqual(group2.activeEditor?.resource?.toString(), input3.resource.toString());
    await service.openEditor(input2, { pinned: true }, group2);
    await service.openEditor(input2, { pinned: true }, ACTIVE_GROUP);
    assert.strictEqual(group1.count, 2);
    assert.strictEqual(group2.count, 2);
    assert.strictEqual(group2.activeEditor?.resource?.toString(), input2.resource.toString());
    part.activateGroup(group1.id);
    const editor3 = await service.openEditor(input4, { pinned: true }, SIDE_GROUP);
    assert.strictEqual(part.count, 3);
    const group3 = editor3?.group;
    assert.strictEqual(group3?.count, 1);
    await service.openEditor(input3, { pinned: true }, group2);
    part.activateGroup(group1.id);
    await service.openEditor(input3, { pinned: true }, SIDE_GROUP);
    assert.strictEqual(part.count, 3);
    group1.lock(true);
    group2.lock(true);
    group3.lock(true);
    part.activateGroup(group1.id);
    const editor5 = await service.openEditor(input5, { pinned: true });
    const group4 = editor5?.group;
    assert.strictEqual(group4?.count, 1);
    assert.strictEqual(group4.activeEditor?.resource?.toString(), input5.resource.toString());
    assert.strictEqual(part.count, 4);
    group1.lock(false);
    group2.lock(false);
    group3.lock(false);
    group4.lock(false);
    part.activateGroup(group3.id);
    part.activateGroup(group2.id);
    part.activateGroup(group4.id);
    group4.lock(true);
    group2.lock(true);
    await service.openEditor(input6, { pinned: true });
    assert.strictEqual(part.count, 4);
    assert.strictEqual(part.activeGroup, group3);
    assert.strictEqual(group3.activeEditor?.resource?.toString(), input6.resource.toString());
    group1.lock(true);
    group2.lock(true);
    group3.lock(true);
    group4.lock(true);
    part.activateGroup(group1.id);
    await service.openEditor(input6, { pinned: true });
    assert.strictEqual(part.count, 4);
    assert.strictEqual(part.activeGroup, group3);
    assert.strictEqual(group3.activeEditor?.resource?.toString(), input6.resource.toString());
    assert.strictEqual(part.activeGroup, group3);
    assert.strictEqual(group3.activeEditor?.resource?.toString(), input6.resource.toString());
    part.activateGroup(group1.id);
    await service.openEditor(input6, { pinned: true });
    assert.strictEqual(part.count, 4);
    assert.strictEqual(part.activeGroup, group3);
    assert.strictEqual(group3.activeEditor?.resource?.toString(), input6.resource.toString());
    await service.openEditor(input7, { pinned: true }, group3);
    await service.openEditor(input6, { pinned: true });
    assert.strictEqual(part.count, 4);
    assert.strictEqual(part.activeGroup, group3);
    assert.strictEqual(group3.activeEditor?.resource?.toString(), input6.resource.toString());
  });
  test("locked groups - workbench.editor.revealIfOpen", async () => {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const configurationService = new TestConfigurationService();
    await configurationService.setUserConfiguration("workbench", { "editor": { "revealIfOpen": true } });
    instantiationService.stub(IConfigurationService, configurationService);
    disposables.add(registerTestFileEditor());
    const [part, service, accessor] = await createEditorService(instantiationService);
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-locked-group-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => ({ editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) })
      }
    ));
    const rootGroup = part.activeGroup;
    const rightGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
    part.activateGroup(rootGroup);
    const input1 = { resource: URI.parse("file://resource-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input2 = { resource: URI.parse("file://resource2-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input3 = { resource: URI.parse("file://resource3-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input4 = { resource: URI.parse("file://resource4-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    await service.openEditor(input1, rootGroup.id);
    await service.openEditor(input2, rootGroup.id);
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    await service.openEditor(input3, rightGroup.id);
    await service.openEditor(input4, rightGroup.id);
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    rootGroup.lock(true);
    rightGroup.lock(true);
    await service.openEditor(input1);
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input1.resource.toString());
    await service.openEditor(input3);
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input3.resource.toString());
    assert.strictEqual(part.groups.length, 2);
  });
  test("locked groups - revealIfVisible", async () => {
    disposables.add(registerTestFileEditor());
    const [part, service, accessor] = await createEditorService();
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-locked-group-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => ({ editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) })
      }
    ));
    const rootGroup = part.activeGroup;
    const rightGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
    part.activateGroup(rootGroup);
    const input1 = { resource: URI.parse("file://resource-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input2 = { resource: URI.parse("file://resource2-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input3 = { resource: URI.parse("file://resource3-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input4 = { resource: URI.parse("file://resource4-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    await service.openEditor(input1, rootGroup.id);
    await service.openEditor(input2, rootGroup.id);
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    await service.openEditor(input3, rightGroup.id);
    await service.openEditor(input4, rightGroup.id);
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    rootGroup.lock(true);
    rightGroup.lock(true);
    await service.openEditor({ ...input2, options: { ...input2.options, revealIfVisible: true } });
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input2.resource.toString());
    await service.openEditor({ ...input4, options: { ...input4.options, revealIfVisible: true } });
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input4.resource.toString());
    assert.strictEqual(part.groups.length, 2);
  });
  test("locked groups - revealIfOpened", async () => {
    disposables.add(registerTestFileEditor());
    const [part, service, accessor] = await createEditorService();
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-locked-group-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => ({ editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) })
      }
    ));
    const rootGroup = part.activeGroup;
    const rightGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
    part.activateGroup(rootGroup);
    const input1 = { resource: URI.parse("file://resource-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input2 = { resource: URI.parse("file://resource2-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input3 = { resource: URI.parse("file://resource3-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    const input4 = { resource: URI.parse("file://resource4-basics.editor-service-locked-group-tests"), options: { pinned: true } };
    await service.openEditor(input1, rootGroup.id);
    await service.openEditor(input2, rootGroup.id);
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    await service.openEditor(input3, rightGroup.id);
    await service.openEditor(input4, rightGroup.id);
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    rootGroup.lock(true);
    rightGroup.lock(true);
    await service.openEditor({ ...input1, options: { ...input1.options, revealIfOpened: true } });
    assert.strictEqual(part.activeGroup.id, rootGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input1.resource.toString());
    await service.openEditor({ ...input3, options: { ...input3.options, revealIfOpened: true } });
    assert.strictEqual(part.activeGroup.id, rightGroup.id);
    assert.strictEqual(part.activeGroup.activeEditor?.resource?.toString(), input3.resource.toString());
    assert.strictEqual(part.groups.length, 2);
  });
  test("openEditor() - untyped, typed", () => {
    return testOpenEditors(false);
  });
  test("openEditors() - untyped, typed", () => {
    return testOpenEditors(true);
  });
  async function testOpenEditors(useOpenEditors) {
    disposables.add(registerTestFileEditor());
    const [part, service, accessor] = await createEditorService();
    let rootGroup = part.activeGroup;
    let editorFactoryCalled = 0;
    let untitledEditorFactoryCalled = 0;
    let diffEditorFactoryCalled = 0;
    let lastEditorFactoryEditor = void 0;
    let lastUntitledEditorFactoryEditor = void 0;
    let lastDiffEditorFactoryEditor = void 0;
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-override-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => {
          editorFactoryCalled++;
          lastEditorFactoryEditor = editor;
          return { editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) };
        },
        createUntitledEditorInput: (untitledEditor) => {
          untitledEditorFactoryCalled++;
          lastUntitledEditorFactoryEditor = untitledEditor;
          return { editor: createTestFileEditorInput(untitledEditor.resource ?? URI.parse(`untitled://my-untitled-editor-${untitledEditorFactoryCalled}`), TEST_EDITOR_INPUT_ID) };
        },
        createDiffEditorInput: (diffEditor) => {
          diffEditorFactoryCalled++;
          lastDiffEditorFactoryEditor = diffEditor;
          return { editor: createTestFileEditorInput(URI.file(`diff-editor-${diffEditorFactoryCalled}`), TEST_EDITOR_INPUT_ID) };
        }
      }
    ));
    async function resetTestState() {
      editorFactoryCalled = 0;
      untitledEditorFactoryCalled = 0;
      diffEditorFactoryCalled = 0;
      lastEditorFactoryEditor = void 0;
      lastUntitledEditorFactoryEditor = void 0;
      lastDiffEditorFactoryEditor = void 0;
      await workbenchTeardown(accessor.instantiationService);
      rootGroup = part.activeGroup;
    }
    async function openEditor(editor, group) {
      if (useOpenEditors) {
        if (!isEditorInputWithOptions(editor) && isEditorInput(editor)) {
          editor = { editor, options: {} };
        }
        const panes = await service.openEditors([editor], group);
        return panes[0];
      }
      if (isEditorInputWithOptions(editor)) {
        return service.openEditor(editor.editor, editor.options, group);
      }
      return service.openEditor(editor, group);
    }
    {
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests") };
        const pane = await openEditor(untypedEditor);
        let typedEditor = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedEditor instanceof TestFileEditorInput);
        assert.strictEqual(typedEditor.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 1);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor, untypedEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await openEditor(untypedEditor);
        assert.strictEqual(pane?.group.activeEditor, typedEditor);
        const untypedEditorReplacement = { resource: URI.file("file-replaced.editor-service-override-tests") };
        await service.replaceEditors([{
          editor: typedEditor,
          replacement: untypedEditorReplacement
        }], rootGroup);
        typedEditor = rootGroup.activeEditor;
        assert.ok(typedEditor instanceof TestFileEditorInput);
        assert.strictEqual(typedEditor?.resource?.toString(), untypedEditorReplacement.resource.toString());
        assert.strictEqual(editorFactoryCalled, 3);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor, untypedEditorReplacement);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { override: DEFAULT_EDITOR_ASSOCIATION.id } };
        const pane = await openEditor(untypedEditor);
        const typedEditor = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedEditor instanceof FileEditorInput);
        assert.strictEqual(typedEditor.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await openEditor(untypedEditor);
        assert.strictEqual(pane?.group.activeEditor, typedEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { sticky: true, preserveFocus: true, override: DEFAULT_EDITOR_ASSOCIATION.id } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof FileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { override: DEFAULT_EDITOR_ASSOCIATION.id } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof FileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { override: TEST_EDITOR_INPUT_ID } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 1);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor, untypedEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { sticky: true, preserveFocus: true } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 1);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(lastEditorFactoryEditor.options?.preserveFocus, true);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { sticky: true, preserveFocus: true, override: TEST_EDITOR_INPUT_ID } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 1);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(lastEditorFactoryEditor.options?.preserveFocus, true);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests") };
        const pane = await openEditor(untypedEditor, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane?.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 1);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.strictEqual(lastEditorFactoryEditor, untypedEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file.editor-service-override-tests"), options: { override: DEFAULT_EDITOR_ASSOCIATION.id } };
        const pane = await openEditor(untypedEditor, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof FileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), untypedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    {
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor });
        let typedInput = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedInput instanceof TestFileEditorInput);
        assert.strictEqual(typedInput.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await openEditor(typedEditor);
        assert.strictEqual(pane?.group.activeEditor, typedInput);
        const typedEditorReplacement = createTestFileEditorInput(URI.file("file-replaced.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        await service.replaceEditors([{
          editor: typedEditor,
          replacement: typedEditorReplacement
        }], rootGroup);
        typedInput = rootGroup.activeEditor;
        assert.ok(typedInput instanceof TestFileEditorInput);
        assert.strictEqual(typedInput.resource.toString(), typedEditorReplacement.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor });
        const typedInput = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedInput instanceof TestFileEditorInput);
        assert.strictEqual(typedInput.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await openEditor(typedEditor);
        assert.strictEqual(pane?.group.activeEditor, typedEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor, options: { sticky: true, preserveFocus: true } });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor, options: { override: DEFAULT_EDITOR_ASSOCIATION.id } });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor, options: { override: TEST_EDITOR_INPUT_ID } });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor, options: { sticky: true, preserveFocus: true } });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor, options: { sticky: true, preserveFocus: true, override: TEST_EDITOR_INPUT_ID } });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
        await part.activeGroup.closeEditor(pane.input);
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor }, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane?.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.editor-service-override-tests"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor }, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.toString(), typedEditor.resource.toString());
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    {
      {
        const untypedEditor = { resource: void 0, options: { override: TEST_EDITOR_INPUT_ID } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.scheme, "untitled");
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 1);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.strictEqual(lastUntitledEditorFactoryEditor, untypedEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: void 0, options: { override: TEST_EDITOR_INPUT_ID } };
        const pane = await openEditor(untypedEditor, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane?.input.resource.scheme, "untitled");
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 1);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.strictEqual(lastUntitledEditorFactoryEditor, untypedEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: URI.file("file-original.editor-service-override-tests").with({ scheme: "untitled" }) };
        const pane = await openEditor(untypedEditor);
        const typedEditor = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedEditor instanceof TestFileEditorInput);
        assert.strictEqual(typedEditor.resource.scheme, "untitled");
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 1);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.strictEqual(lastUntitledEditorFactoryEditor, untypedEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await openEditor(untypedEditor);
        assert.strictEqual(pane?.group.activeEditor, typedEditor);
        await resetTestState();
      }
      {
        const untypedEditor = { resource: void 0, options: { sticky: true, preserveFocus: true, override: TEST_EDITOR_INPUT_ID } };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input.resource.scheme, "untitled");
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 1);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.strictEqual(lastUntitledEditorFactoryEditor, untypedEditor);
        assert.strictEqual(lastUntitledEditorFactoryEditor.options?.preserveFocus, true);
        assert.strictEqual(lastUntitledEditorFactoryEditor.options?.sticky, true);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    {
      {
        const untypedEditor = {
          original: { resource: URI.file("file-original.editor-service-override-tests") },
          modified: { resource: URI.file("file-modified.editor-service-override-tests") },
          options: { override: TEST_EDITOR_INPUT_ID }
        };
        const pane = await openEditor(untypedEditor);
        const typedEditor = pane?.input;
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(typedEditor instanceof TestFileEditorInput);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 1);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.strictEqual(lastDiffEditorFactoryEditor, untypedEditor);
        await resetTestState();
      }
      {
        const untypedEditor = {
          original: { resource: URI.file("file-original.editor-service-override-tests") },
          modified: { resource: URI.file("file-modified.editor-service-override-tests") },
          options: { override: TEST_EDITOR_INPUT_ID }
        };
        const pane = await openEditor(untypedEditor, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 1);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.strictEqual(lastDiffEditorFactoryEditor, untypedEditor);
        await resetTestState();
      }
      {
        const untypedEditor = {
          original: { resource: URI.file("file-original.editor-service-override-tests") },
          modified: { resource: URI.file("file-modified.editor-service-override-tests") },
          options: {
            override: TEST_EDITOR_INPUT_ID,
            sticky: true,
            preserveFocus: true
          }
        };
        const pane = await openEditor(untypedEditor);
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.group.isSticky(pane.input), true);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 1);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.strictEqual(lastDiffEditorFactoryEditor, untypedEditor);
        assert.strictEqual(lastDiffEditorFactoryEditor.options?.preserveFocus, true);
        assert.strictEqual(lastDiffEditorFactoryEditor.options?.sticky, true);
        await resetTestState();
      }
    }
    {
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.something"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input, typedEditor);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.something"), TEST_EDITOR_INPUT_ID);
        const pane = await openEditor({ editor: typedEditor }, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane?.input, typedEditor);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    {
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.something"), TEST_EDITOR_INPUT_ID);
        typedEditor.disableToUntyped = true;
        const pane = await openEditor({ editor: typedEditor });
        assert.strictEqual(pane?.group, rootGroup);
        assert.ok(pane.input instanceof TestFileEditorInput);
        assert.strictEqual(pane.input, typedEditor);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
      {
        const typedEditor = createTestFileEditorInput(URI.file("file.something"), TEST_EDITOR_INPUT_ID);
        typedEditor.disableToUntyped = true;
        const pane = await openEditor({ editor: typedEditor }, SIDE_GROUP);
        assert.strictEqual(accessor.editorGroupService.groups.length, 2);
        assert.notStrictEqual(pane?.group, rootGroup);
        assert.ok(pane?.input instanceof TestFileEditorInput);
        assert.strictEqual(pane?.input, typedEditor);
        assert.strictEqual(editorFactoryCalled, 0);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(!lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    if (useOpenEditors) {
      {
        const untypedEditor1 = { resource: URI.file("file1.editor-service-override-tests") };
        const untypedEditor2 = { resource: URI.file("file2.editor-service-override-tests") };
        const untypedEditor3 = { editor: createTestFileEditorInput(URI.file("file3.editor-service-override-tests"), TEST_EDITOR_INPUT_ID) };
        const untypedEditor4 = { editor: createTestFileEditorInput(URI.file("file4.editor-service-override-tests"), TEST_EDITOR_INPUT_ID) };
        const untypedEditor5 = { resource: URI.file("file5.editor-service-override-tests") };
        const pane = (await service.openEditors([untypedEditor1, untypedEditor2, untypedEditor3, untypedEditor4, untypedEditor5]))[0];
        assert.strictEqual(pane?.group, rootGroup);
        assert.strictEqual(pane?.group.count, 5);
        assert.strictEqual(editorFactoryCalled, 3);
        assert.strictEqual(untitledEditorFactoryCalled, 0);
        assert.strictEqual(diffEditorFactoryCalled, 0);
        assert.ok(lastEditorFactoryEditor);
        assert.ok(!lastUntitledEditorFactoryEditor);
        assert.ok(!lastDiffEditorFactoryEditor);
        await resetTestState();
      }
    }
    {
      {
        const untypedEditor1 = { resource: URI.file("file-1"), options: { revealIfVisible: true, pinned: true } };
        const untypedEditor2 = { resource: URI.file("file-2"), options: { pinned: true } };
        const rootPane = await openEditor(untypedEditor1);
        const sidePane = await openEditor(untypedEditor2, SIDE_GROUP);
        assert.strictEqual(rootPane?.group.count, 1);
        assert.strictEqual(sidePane?.group.count, 1);
        accessor.editorGroupService.activateGroup(sidePane.group);
        await openEditor(untypedEditor1);
        assert.strictEqual(rootPane?.group.count, 1);
        assert.strictEqual(sidePane?.group.count, 1);
        await resetTestState();
      }
      {
        const untypedEditor1 = { resource: URI.file("file-1"), options: { revealIfOpened: true, pinned: true } };
        const untypedEditor2 = { resource: URI.file("file-2"), options: { pinned: true } };
        const rootPane = await openEditor(untypedEditor1);
        await openEditor(untypedEditor2);
        assert.strictEqual(rootPane?.group.activeEditor?.resource?.toString(), untypedEditor2.resource.toString());
        const sidePane = await openEditor(untypedEditor2, SIDE_GROUP);
        assert.strictEqual(rootPane?.group.count, 2);
        assert.strictEqual(sidePane?.group.count, 1);
        accessor.editorGroupService.activateGroup(sidePane.group);
        await openEditor(untypedEditor1);
        assert.strictEqual(rootPane?.group.count, 2);
        assert.strictEqual(sidePane?.group.count, 1);
        await resetTestState();
      }
    }
  }
  test("openEditor() applies options if editor already opened", async () => {
    disposables.add(registerTestFileEditor());
    const [, service, accessor] = await createEditorService();
    disposables.add(accessor.editorResolverService.registerEditor(
      "*.editor-service-override-tests",
      { id: TEST_EDITOR_INPUT_ID, label: "Label", priority: RegisteredEditorPriority.exclusive },
      {},
      {
        createEditorInput: (editor) => ({ editor: createTestFileEditorInput(editor.resource, TEST_EDITOR_INPUT_ID) })
      }
    ));
    let pane = await service.openEditor(createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID));
    pane = await service.openEditor(createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID), { sticky: true, preserveFocus: true });
    assert.strictEqual(pane?.options?.sticky, true);
    assert.strictEqual(pane?.options?.preserveFocus, true);
    await pane.group.closeAllEditors();
    pane = await service.openEditor({ resource: URI.file("resource-openEditors") });
    pane = await service.openEditor({ resource: URI.file("resource-openEditors"), options: { sticky: true, preserveFocus: true } });
    assert.ok(pane instanceof TestTextFileEditor);
    assert.strictEqual(pane?.options?.sticky, true);
    assert.strictEqual(pane?.options?.preserveFocus, true);
    pane = await service.openEditor({ resource: URI.file("file.editor-service-override-tests") });
    pane = await service.openEditor({ resource: URI.file("file.editor-service-override-tests"), options: { sticky: true, preserveFocus: true } });
    assert.strictEqual(pane?.options?.sticky, true);
    assert.strictEqual(pane?.options?.preserveFocus, true);
  });
  test("isOpen() with side by side editor", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    const sideBySideInput = new SideBySideEditorInput("sideBySide", "", input, otherInput, service);
    const editor1 = await service.openEditor(sideBySideInput, { pinned: true });
    assert.strictEqual(part.activeGroup.count, 1);
    assert.strictEqual(service.isOpened(input), false);
    assert.strictEqual(service.isOpened(otherInput), true);
    assert.strictEqual(service.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), false);
    assert.strictEqual(service.isOpened({ resource: otherInput.resource, typeId: otherInput.typeId, editorId: otherInput.editorId }), true);
    const editor2 = await service.openEditor(input, { pinned: true });
    assert.strictEqual(part.activeGroup.count, 2);
    assert.strictEqual(service.isOpened(input), true);
    assert.strictEqual(service.isOpened(otherInput), true);
    assert.strictEqual(service.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), true);
    assert.strictEqual(service.isOpened({ resource: otherInput.resource, typeId: otherInput.typeId, editorId: otherInput.editorId }), true);
    await editor2?.group.closeEditor(input);
    assert.strictEqual(part.activeGroup.count, 1);
    assert.strictEqual(service.isOpened(input), false);
    assert.strictEqual(service.isOpened(otherInput), true);
    assert.strictEqual(service.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), false);
    assert.strictEqual(service.isOpened({ resource: otherInput.resource, typeId: otherInput.typeId, editorId: otherInput.editorId }), true);
    await editor1?.group.closeEditor(sideBySideInput);
    assert.strictEqual(service.isOpened(input), false);
    assert.strictEqual(service.isOpened(otherInput), false);
    assert.strictEqual(service.isOpened({ resource: input.resource, typeId: input.typeId, editorId: input.editorId }), false);
    assert.strictEqual(service.isOpened({ resource: otherInput.resource, typeId: otherInput.typeId, editorId: otherInput.editorId }), false);
  });
  test("openEditors() / replaceEditors()", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    const replaceInput = createTestFileEditorInput(URI.parse("my://resource3-openEditors"), TEST_EDITOR_INPUT_ID);
    await service.openEditors([{ editor: input }, { editor: otherInput }]);
    assert.strictEqual(part.activeGroup.count, 2);
    await service.replaceEditors([{ editor: input, replacement: replaceInput }], part.activeGroup);
    assert.strictEqual(part.activeGroup.count, 2);
    assert.strictEqual(part.activeGroup.getIndexOfEditor(replaceInput), 0);
  });
  test("openEditors() handles workspace trust (typed editors)", async () => {
    const [part, service, accessor] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1-openEditors"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    const input3 = createTestFileEditorInput(URI.parse("my://resource3-openEditors"), TEST_EDITOR_INPUT_ID);
    const input4 = createTestFileEditorInput(URI.parse("my://resource4-openEditors"), TEST_EDITOR_INPUT_ID);
    const sideBySideInput = new SideBySideEditorInput("side by side", void 0, input3, input4, service);
    const oldHandler = accessor.workspaceTrustRequestService.requestOpenUrisHandler;
    try {
      let trustEditorUris = [];
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = async (uris) => {
        trustEditorUris = uris;
        return WorkspaceTrustUriResponse.Cancel;
      };
      await service.openEditors([{ editor: input1 }, { editor: input2 }, { editor: sideBySideInput }], void 0, { validateTrust: true });
      assert.strictEqual(part.activeGroup.count, 0);
      assert.strictEqual(trustEditorUris.length, 4);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === input1.resource.toString()), true);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === input2.resource.toString()), true);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === input3.resource.toString()), true);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === input4.resource.toString()), true);
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = async (uris) => WorkspaceTrustUriResponse.OpenInNewWindow;
      await service.openEditors([{ editor: input1 }, { editor: input2 }, { editor: sideBySideInput }], void 0, { validateTrust: true });
      assert.strictEqual(part.activeGroup.count, 0);
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = async (uris) => WorkspaceTrustUriResponse.Open;
      await service.openEditors([{ editor: input1 }, { editor: input2 }, { editor: sideBySideInput }], void 0, { validateTrust: true });
      assert.strictEqual(part.activeGroup.count, 3);
    } finally {
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = oldHandler;
    }
  });
  test("openEditors() ignores trust when `validateTrust: false", async () => {
    const [part, service, accessor] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1-openEditors"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    const input3 = createTestFileEditorInput(URI.parse("my://resource3-openEditors"), TEST_EDITOR_INPUT_ID);
    const input4 = createTestFileEditorInput(URI.parse("my://resource4-openEditors"), TEST_EDITOR_INPUT_ID);
    const sideBySideInput = new SideBySideEditorInput("side by side", void 0, input3, input4, service);
    const oldHandler = accessor.workspaceTrustRequestService.requestOpenUrisHandler;
    try {
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = async (uris) => WorkspaceTrustUriResponse.Cancel;
      await service.openEditors([{ editor: input1 }, { editor: input2 }, { editor: sideBySideInput }]);
      assert.strictEqual(part.activeGroup.count, 3);
    } finally {
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = oldHandler;
    }
  });
  test("openEditors() extracts proper resources from untyped editors for workspace trust", async () => {
    const [, service, accessor] = await createEditorService();
    const input = { resource: URI.file("resource-openEditors") };
    const otherInput = {
      original: { resource: URI.parse("my://resource2-openEditors") },
      modified: { resource: URI.parse("my://resource3-openEditors") }
    };
    const oldHandler = accessor.workspaceTrustRequestService.requestOpenUrisHandler;
    try {
      let trustEditorUris = [];
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = async (uris) => {
        trustEditorUris = uris;
        return oldHandler(uris);
      };
      await service.openEditors([input, otherInput], void 0, { validateTrust: true });
      assert.strictEqual(trustEditorUris.length, 3);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === input.resource.toString()), true);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === otherInput.original.resource?.toString()), true);
      assert.strictEqual(trustEditorUris.some((uri) => uri.toString() === otherInput.modified.resource?.toString()), true);
    } finally {
      accessor.workspaceTrustRequestService.requestOpenUrisHandler = oldHandler;
    }
  });
  test("close editor does not dispose when editor opened in other group", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-close1"), TEST_EDITOR_INPUT_ID);
    const rootGroup = part.activeGroup;
    const rightGroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
    await service.openEditor(input, { pinned: true });
    await service.openEditor(input, { pinned: true }, rightGroup);
    const editors = service.editors;
    assert.strictEqual(editors.length, 2);
    assert.strictEqual(editors[0], input);
    assert.strictEqual(editors[1], input);
    await rootGroup.closeEditor(input);
    assert.strictEqual(input.isDisposed(), false);
    await rightGroup.closeEditor(input);
    assert.strictEqual(input.isDisposed(), true);
  });
  test("open to the side", async () => {
    const [part, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1-openside"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource2-openside"), TEST_EDITOR_INPUT_ID);
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true }, rootGroup);
    let editor = await service.openEditor(input1, { pinned: true, preserveFocus: true }, SIDE_GROUP);
    assert.strictEqual(part.activeGroup, rootGroup);
    assert.strictEqual(part.count, 2);
    assert.strictEqual(editor?.group, part.groups[1]);
    assert.strictEqual(service.isVisible(input1), true);
    assert.strictEqual(service.isOpened(input1), true);
    editor = await service.openEditor(input2, { pinned: true, preserveFocus: true }, SIDE_GROUP);
    assert.strictEqual(part.activeGroup, rootGroup);
    assert.strictEqual(part.count, 2);
    assert.strictEqual(editor?.group, part.groups[1]);
    assert.strictEqual(service.isVisible(input2), true);
    assert.strictEqual(service.isOpened(input2), true);
  });
  test("editor group activation", async () => {
    const [part, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1-openside"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource2-openside"), TEST_EDITOR_INPUT_ID);
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true }, rootGroup);
    let editor = await service.openEditor(input2, { pinned: true, preserveFocus: true, activation: EditorActivation.ACTIVATE }, SIDE_GROUP);
    const sideGroup = editor?.group;
    assert.strictEqual(part.activeGroup, sideGroup);
    editor = await service.openEditor(input1, { pinned: true, preserveFocus: true, activation: EditorActivation.PRESERVE }, rootGroup);
    assert.strictEqual(part.activeGroup, sideGroup);
    editor = await service.openEditor(input1, { pinned: true, preserveFocus: true, activation: EditorActivation.ACTIVATE }, rootGroup);
    assert.strictEqual(part.activeGroup, rootGroup);
    editor = await service.openEditor(input2, { pinned: true, activation: EditorActivation.PRESERVE }, sideGroup);
    assert.strictEqual(part.activeGroup, rootGroup);
    editor = await service.openEditor(input2, { pinned: true, activation: EditorActivation.ACTIVATE }, sideGroup);
    assert.strictEqual(part.activeGroup, sideGroup);
    part.arrangeGroups(GroupsArrangement.EXPAND);
    editor = await service.openEditor(input1, { pinned: true, preserveFocus: true, activation: EditorActivation.RESTORE }, rootGroup);
    assert.strictEqual(part.activeGroup, sideGroup);
  });
  test("inactive editor group does not activate when closing editor (#117686)", async () => {
    const [part, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1-openside"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource2-openside"), TEST_EDITOR_INPUT_ID);
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true }, rootGroup);
    await service.openEditor(input2, { pinned: true }, rootGroup);
    const sideGroup = (await service.openEditor(input2, { pinned: true }, SIDE_GROUP))?.group;
    assert.strictEqual(part.activeGroup, sideGroup);
    assert.notStrictEqual(rootGroup, sideGroup);
    part.arrangeGroups(GroupsArrangement.EXPAND, part.activeGroup);
    await rootGroup.closeEditor(input2);
    assert.strictEqual(part.activeGroup, sideGroup);
    assert(!part.isGroupExpanded(rootGroup));
    assert(part.isGroupExpanded(part.activeGroup));
  });
  test("active editor change / visible editor change events", async function() {
    const [part, service] = await createEditorService();
    let input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    let otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    let activeEditorChangeEventFired = false;
    const activeEditorChangeListener = service.onDidActiveEditorChange(() => {
      activeEditorChangeEventFired = true;
    });
    let visibleEditorChangeEventFired = false;
    const visibleEditorChangeListener = service.onDidVisibleEditorsChange(() => {
      visibleEditorChangeEventFired = true;
    });
    function assertActiveEditorChangedEvent(expected) {
      assert.strictEqual(activeEditorChangeEventFired, expected, `Unexpected active editor change state (got ${activeEditorChangeEventFired}, expected ${expected})`);
      activeEditorChangeEventFired = false;
    }
    function assertVisibleEditorsChangedEvent(expected) {
      assert.strictEqual(visibleEditorChangeEventFired, expected, `Unexpected visible editors change state (got ${visibleEditorChangeEventFired}, expected ${expected})`);
      visibleEditorChangeEventFired = false;
    }
    async function closeEditorAndWaitForNextToOpen(group2, input2) {
      await group2.closeEditor(input2);
      await timeout(0);
    }
    let editor = await service.openEditor(input, { pinned: true });
    const group = editor?.group;
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    editor = await service.openEditor(input);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    editor = await service.openEditor(otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    await closeEditorAndWaitForNextToOpen(group, otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    await closeEditorAndWaitForNextToOpen(group, input);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    editor = await service.openEditor(input, { forceReload: true });
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await closeEditorAndWaitForNextToOpen(group, input);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    editor = await service.openEditor(otherInput, { inactive: true });
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    editor = await service.openEditor(otherInput, { inactive: true });
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await closeEditorAndWaitForNextToOpen(group, otherInput);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    let rightGroup = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    rightGroup.focus();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(false);
    part.removeGroup(rightGroup);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(false);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    rightGroup = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await rightGroup.openEditor(otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    await closeEditorAndWaitForNextToOpen(rightGroup, otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    rightGroup = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await rightGroup.openEditor(otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    group.focus();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(false);
    await closeEditorAndWaitForNextToOpen(rightGroup, otherInput);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(true);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    editor = await service.openEditor(otherInput, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    group.moveEditor(otherInput, group, { index: 0 });
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await group.closeAllEditors();
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    editor = await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    rightGroup = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(false);
    await rightGroup.openEditor(otherInput);
    assertActiveEditorChangedEvent(true);
    assertVisibleEditorsChangedEvent(true);
    await closeEditorAndWaitForNextToOpen(group, input);
    assertActiveEditorChangedEvent(false);
    assertVisibleEditorsChangedEvent(true);
    activeEditorChangeListener.dispose();
    visibleEditorChangeListener.dispose();
  });
  test("editors change event", async function() {
    const [part, service] = await createEditorService();
    const rootGroup = part.activeGroup;
    let input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    let otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    let editorsChangeEventCounter = 0;
    async function assertEditorsChangeEvent(fn, expected) {
      const p = Event.toPromise(service.onDidEditorsChange);
      await fn();
      await p;
      editorsChangeEventCounter++;
      assert.strictEqual(editorsChangeEventCounter, expected);
    }
    await assertEditorsChangeEvent(() => service.openEditor(input, { pinned: true }), 1);
    await assertEditorsChangeEvent(() => service.openEditor(otherInput, { pinned: true }), 2);
    await assertEditorsChangeEvent(() => rootGroup.closeEditor(input), 3);
    await assertEditorsChangeEvent(() => rootGroup.closeEditor(otherInput), 4);
    input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    otherInput = createTestFileEditorInput(URI.parse("my://resource2-active"), TEST_EDITOR_INPUT_ID);
    await assertEditorsChangeEvent(() => service.openEditors([{ editor: input, options: { pinned: true } }, { editor: otherInput, options: { pinned: true } }]), 5);
    await assertEditorsChangeEvent(() => service.openEditor(otherInput), 6);
    await assertEditorsChangeEvent(() => service.openEditor(input, { pinned: true, index: 1 }), 7);
    const rightGroup = part.addGroup(part.activeGroup, GroupDirection.RIGHT);
    await assertEditorsChangeEvent(async () => rootGroup.moveEditor(input, rightGroup), 8);
    await assertEditorsChangeEvent(async () => part.moveGroup(rightGroup, rootGroup, GroupDirection.LEFT), 9);
  });
  test("two active editor change events when opening editor to the side", async function() {
    const [, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    let activeEditorChangeEvents = 0;
    const activeEditorChangeListener = service.onDidActiveEditorChange(() => {
      activeEditorChangeEvents++;
    });
    function assertActiveEditorChangedEvent(expected) {
      assert.strictEqual(activeEditorChangeEvents, expected, `Unexpected active editor change state (got ${activeEditorChangeEvents}, expected ${expected})`);
      activeEditorChangeEvents = 0;
    }
    await service.openEditor(input, { pinned: true });
    assertActiveEditorChangedEvent(1);
    await service.openEditor(input, { pinned: true }, SIDE_GROUP);
    assertActiveEditorChangedEvent(2);
    activeEditorChangeListener.dispose();
  });
  test("activeTextEditorControl / activeTextEditorMode", async () => {
    const [, service] = await createEditorService();
    const editor = await service.openEditor({ resource: void 0 });
    assert.strictEqual(service.activeEditorPane, editor);
    assert.strictEqual(service.activeTextEditorControl, editor?.getControl());
    assert.strictEqual(service.activeTextEditorLanguageId, PLAINTEXT_LANGUAGE_ID);
  });
  test("openEditor returns undefined when inactive", async function() {
    const [, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-inactive"), TEST_EDITOR_INPUT_ID);
    const editor = await service.openEditor(input, { pinned: true });
    assert.ok(editor);
    const otherEditor = await service.openEditor(otherInput, { inactive: true });
    assert.ok(!otherEditor);
  });
  test("openEditor shows placeholder when opening fails", async function() {
    const [, service] = await createEditorService();
    const failingInput = createTestFileEditorInput(URI.parse("my://resource-failing"), TEST_EDITOR_INPUT_ID);
    failingInput.setFailToOpen();
    const failingEditor = await service.openEditor(failingInput);
    assert.ok(failingEditor instanceof ErrorPlaceholderEditor);
  });
  test("openEditor shows placeholder when restoring fails", async function() {
    const [, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-active"), TEST_EDITOR_INPUT_ID);
    const failingInput = createTestFileEditorInput(URI.parse("my://resource-failing"), TEST_EDITOR_INPUT_ID);
    await service.openEditor(input, { pinned: true });
    await service.openEditor(failingInput, { inactive: true });
    failingInput.setFailToOpen();
    const failingEditor = await service.openEditor(failingInput);
    assert.ok(failingEditor instanceof ErrorPlaceholderEditor);
  });
  test("save, saveAll, revertAll", async function() {
    const [part, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    input1.dirty = true;
    const input2 = createTestFileEditorInput(URI.parse("my://resource2"), TEST_EDITOR_INPUT_ID);
    input2.dirty = true;
    const sameInput1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    sameInput1.dirty = true;
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true });
    await service.openEditor(input2, { pinned: true });
    await service.openEditor(sameInput1, { pinned: true }, SIDE_GROUP);
    const res1 = await service.save({ groupId: rootGroup.id, editor: input1 });
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.editors[0], input1);
    assert.strictEqual(input1.gotSaved, true);
    input1.gotSaved = false;
    input1.gotSavedAs = false;
    input1.gotReverted = false;
    input1.dirty = true;
    input2.dirty = true;
    sameInput1.dirty = true;
    const res2 = await service.save({ groupId: rootGroup.id, editor: input1 }, { saveAs: true });
    assert.strictEqual(res2.success, true);
    assert.strictEqual(res2.editors[0], input1);
    assert.strictEqual(input1.gotSavedAs, true);
    input1.gotSaved = false;
    input1.gotSavedAs = false;
    input1.gotReverted = false;
    input1.dirty = true;
    input2.dirty = true;
    sameInput1.dirty = true;
    const revertRes = await service.revertAll();
    assert.strictEqual(revertRes, true);
    assert.strictEqual(input1.gotReverted, true);
    input1.gotSaved = false;
    input1.gotSavedAs = false;
    input1.gotReverted = false;
    input1.dirty = true;
    input2.dirty = true;
    sameInput1.dirty = true;
    const res3 = await service.saveAll();
    assert.strictEqual(res3.success, true);
    assert.strictEqual(res3.editors.length, 2);
    assert.strictEqual(input1.gotSaved, true);
    assert.strictEqual(input2.gotSaved, true);
    input1.gotSaved = false;
    input1.gotSavedAs = false;
    input1.gotReverted = false;
    input2.gotSaved = false;
    input2.gotSavedAs = false;
    input2.gotReverted = false;
    input1.dirty = true;
    input2.dirty = true;
    sameInput1.dirty = true;
    await service.saveAll({ saveAs: true });
    assert.strictEqual(input1.gotSavedAs, true);
    assert.strictEqual(input2.gotSavedAs, true);
    assert.strictEqual(sameInput1.gotSaved, false);
    assert.strictEqual(sameInput1.gotSavedAs, false);
    assert.strictEqual(sameInput1.gotReverted, false);
  });
  test("saveAll, revertAll (sticky editor)", async function() {
    const [, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    input1.dirty = true;
    const input2 = createTestFileEditorInput(URI.parse("my://resource2"), TEST_EDITOR_INPUT_ID);
    input2.dirty = true;
    const sameInput1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    sameInput1.dirty = true;
    await service.openEditor(input1, { pinned: true, sticky: true });
    await service.openEditor(input2, { pinned: true });
    await service.openEditor(sameInput1, { pinned: true }, SIDE_GROUP);
    const revertRes = await service.revertAll({ excludeSticky: true });
    assert.strictEqual(revertRes, true);
    assert.strictEqual(input1.gotReverted, false);
    assert.strictEqual(sameInput1.gotReverted, true);
    input1.gotSaved = false;
    input1.gotSavedAs = false;
    input1.gotReverted = false;
    sameInput1.gotSaved = false;
    sameInput1.gotSavedAs = false;
    sameInput1.gotReverted = false;
    input1.dirty = true;
    input2.dirty = true;
    sameInput1.dirty = true;
    const saveRes = await service.saveAll({ excludeSticky: true });
    assert.strictEqual(saveRes.success, true);
    assert.strictEqual(saveRes.editors.length, 2);
    assert.strictEqual(input1.gotSaved, false);
    assert.strictEqual(input2.gotSaved, true);
    assert.strictEqual(sameInput1.gotSaved, true);
  });
  test("saveAll, revertAll untitled (exclude untitled)", async function() {
    await testSaveRevertUntitled({}, false, false);
    await testSaveRevertUntitled({ includeUntitled: false }, false, false);
  });
  test("saveAll, revertAll untitled (include untitled)", async function() {
    await testSaveRevertUntitled({ includeUntitled: true }, true, false);
    await testSaveRevertUntitled({ includeUntitled: { includeScratchpad: false } }, true, false);
  });
  test("saveAll, revertAll untitled (include scratchpad)", async function() {
    await testSaveRevertUntitled({ includeUntitled: { includeScratchpad: true } }, true, true);
  });
  async function testSaveRevertUntitled(options, expectUntitled, expectScratchpad) {
    const [, service] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    input1.dirty = true;
    const untitledInput = createTestFileEditorInput(URI.parse("my://resource2"), TEST_EDITOR_INPUT_ID);
    untitledInput.dirty = true;
    untitledInput.capabilities = EditorInputCapabilities.Untitled;
    const scratchpadInput = createTestFileEditorInput(URI.parse("my://resource3"), TEST_EDITOR_INPUT_ID);
    scratchpadInput.modified = true;
    scratchpadInput.capabilities = EditorInputCapabilities.Scratchpad | EditorInputCapabilities.Untitled;
    await service.openEditor(input1, { pinned: true, sticky: true });
    await service.openEditor(untitledInput, { pinned: true });
    await service.openEditor(scratchpadInput, { pinned: true });
    const revertRes = await service.revertAll(options);
    assert.strictEqual(revertRes, true);
    assert.strictEqual(input1.gotReverted, true);
    assert.strictEqual(untitledInput.gotReverted, expectUntitled);
    assert.strictEqual(scratchpadInput.gotReverted, expectScratchpad);
    input1.gotSaved = false;
    untitledInput.gotSavedAs = false;
    scratchpadInput.gotReverted = false;
    input1.gotSaved = false;
    untitledInput.gotSavedAs = false;
    scratchpadInput.gotReverted = false;
    input1.dirty = true;
    untitledInput.dirty = true;
    scratchpadInput.modified = true;
    const saveRes = await service.saveAll(options);
    assert.strictEqual(saveRes.success, true);
    assert.strictEqual(saveRes.editors.length, expectScratchpad ? 3 : expectUntitled ? 2 : 1);
    assert.strictEqual(input1.gotSaved, true);
    assert.strictEqual(untitledInput.gotSaved, expectUntitled);
    assert.strictEqual(scratchpadInput.gotSaved, expectScratchpad);
  }
  test("file delete closes editor", async function() {
    return testFileDeleteEditorClose(false);
  });
  test("file delete leaves dirty editors open", function() {
    return testFileDeleteEditorClose(true);
  });
  async function testFileDeleteEditorClose(dirty) {
    const [part, service, accessor] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    input1.dirty = dirty;
    const input2 = createTestFileEditorInput(URI.parse("my://resource2"), TEST_EDITOR_INPUT_ID);
    input2.dirty = dirty;
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true });
    await service.openEditor(input2, { pinned: true });
    assert.strictEqual(rootGroup.activeEditor, input2);
    const activeEditorChangePromise = awaitActiveEditorChange(service);
    accessor.fileService.fireAfterOperation(new FileOperationEvent(input2.resource, FileOperation.DELETE));
    if (!dirty) {
      await activeEditorChangePromise;
    }
    if (dirty) {
      assert.strictEqual(rootGroup.activeEditor, input2);
    } else {
      assert.strictEqual(rootGroup.activeEditor, input1);
    }
  }
  test("file move asks input to move", async function() {
    const [part, service, accessor] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("my://resource1"), TEST_EDITOR_INPUT_ID);
    const movedInput = createTestFileEditorInput(URI.parse("my://resource2"), TEST_EDITOR_INPUT_ID);
    input1.movedEditor = { editor: movedInput };
    const rootGroup = part.activeGroup;
    await service.openEditor(input1, { pinned: true });
    const activeEditorChangePromise = awaitActiveEditorChange(service);
    accessor.fileService.fireAfterOperation(new FileOperationEvent(input1.resource, FileOperation.MOVE, {
      resource: movedInput.resource,
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
    }));
    await activeEditorChangePromise;
    assert.strictEqual(rootGroup.activeEditor, movedInput);
  });
  function awaitActiveEditorChange(editorService) {
    return Event.toPromise(Event.once(editorService.onDidActiveEditorChange));
  }
  test("file watcher gets installed for out of workspace files", async function() {
    const [, service, accessor] = await createEditorService();
    const input1 = createTestFileEditorInput(URI.parse("file://resource1"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("file://resource2"), TEST_EDITOR_INPUT_ID);
    await service.openEditor(input1, { pinned: true });
    assert.strictEqual(accessor.fileService.watches.length, 1);
    assert.strictEqual(accessor.fileService.watches[0].toString(), input1.resource.toString());
    const editor = await service.openEditor(input2, { pinned: true });
    assert.strictEqual(accessor.fileService.watches.length, 1);
    assert.strictEqual(accessor.fileService.watches[0].toString(), input2.resource.toString());
    await editor?.group.closeAllEditors();
    assert.strictEqual(accessor.fileService.watches.length, 0);
  });
  test("activeEditorPane scopedContextKeyService", async function() {
    const instantiationService = workbenchInstantiationService({ contextKeyService: (instantiationService2) => instantiationService2.createInstance(MockScopableContextKeyService) }, disposables);
    const [part, service] = await createEditorService(instantiationService);
    const input1 = createTestFileEditorInput(URI.parse("file://resource1"), TEST_EDITOR_INPUT_ID);
    createTestFileEditorInput(URI.parse("file://resource2"), TEST_EDITOR_INPUT_ID);
    await service.openEditor(input1, { pinned: true });
    const editorContextKeyService = service.activeEditorPane?.scopedContextKeyService;
    assert.ok(!!editorContextKeyService);
    assert.strictEqual(editorContextKeyService, part.activeGroup.activeEditorPane?.scopedContextKeyService);
  });
  test("editorResolverService - openEditor", async function() {
    const [, service, accessor] = await createEditorService();
    const editorResolverService = accessor.editorResolverService;
    const textEditorService = accessor.textEditorService;
    let editorCount = 0;
    const registrationDisposable = editorResolverService.registerEditor(
      "*.md",
      {
        id: "TestEditor",
        label: "Test Editor",
        detail: "Test Editor Provider",
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createEditorInput: (editorInput) => {
          editorCount++;
          return { editor: textEditorService.createTextEditor(editorInput) };
        },
        createDiffEditorInput: (diffEditor) => ({ editor: textEditorService.createTextEditor(diffEditor) })
      }
    );
    assert.strictEqual(editorCount, 0);
    const input1 = { resource: URI.parse("file://test/path/resource1.txt") };
    const input2 = { resource: URI.parse("file://test/path/resource1.md") };
    await service.openEditor(input1);
    assert.strictEqual(editorCount, 0);
    await service.openEditor(input2);
    assert.strictEqual(editorCount, 1);
    await service.openEditor({ ...input2, options: { override: "default" } });
    assert.strictEqual(editorCount, 1);
    registrationDisposable.dispose();
  });
  test("editorResolverService - openEditors", async function() {
    const [, service, accessor] = await createEditorService();
    const editorResolverService = accessor.editorResolverService;
    const textEditorService = accessor.textEditorService;
    let editorCount = 0;
    const registrationDisposable = editorResolverService.registerEditor(
      "*.md",
      {
        id: "TestEditor",
        label: "Test Editor",
        detail: "Test Editor Provider",
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createEditorInput: (editorInput) => {
          editorCount++;
          return { editor: textEditorService.createTextEditor(editorInput) };
        },
        createDiffEditorInput: (diffEditor) => ({ editor: textEditorService.createTextEditor(diffEditor) })
      }
    );
    assert.strictEqual(editorCount, 0);
    const input1 = createTestFileEditorInput(URI.parse("file://test/path/resource1.txt"), TEST_EDITOR_INPUT_ID).toUntyped();
    const input2 = createTestFileEditorInput(URI.parse("file://test/path/resource2.txt"), TEST_EDITOR_INPUT_ID).toUntyped();
    const input3 = createTestFileEditorInput(URI.parse("file://test/path/resource3.md"), TEST_EDITOR_INPUT_ID).toUntyped();
    const input4 = createTestFileEditorInput(URI.parse("file://test/path/resource4.md"), TEST_EDITOR_INPUT_ID).toUntyped();
    assert.ok(input1);
    assert.ok(input2);
    assert.ok(input3);
    assert.ok(input4);
    await service.openEditors([input1, input2, input3, input4]);
    assert.strictEqual(editorCount, 2);
    registrationDisposable.dispose();
  });
  test("editorResolverService - replaceEditors", async function() {
    const [part, service, accessor] = await createEditorService();
    const editorResolverService = accessor.editorResolverService;
    const textEditorService = accessor.textEditorService;
    let editorCount = 0;
    const registrationDisposable = editorResolverService.registerEditor(
      "*.md",
      {
        id: "TestEditor",
        label: "Test Editor",
        detail: "Test Editor Provider",
        priority: RegisteredEditorPriority.builtin
      },
      {},
      {
        createEditorInput: (editorInput) => {
          editorCount++;
          return { editor: textEditorService.createTextEditor(editorInput) };
        },
        createDiffEditorInput: (diffEditor) => ({ editor: textEditorService.createTextEditor(diffEditor) })
      }
    );
    assert.strictEqual(editorCount, 0);
    const input1 = createTestFileEditorInput(URI.parse("file://test/path/resource2.md"), TEST_EDITOR_INPUT_ID);
    const untypedInput1 = input1.toUntyped();
    assert.ok(untypedInput1);
    await service.openEditor(input1);
    assert.strictEqual(editorCount, 0);
    await service.replaceEditors([{
      editor: input1,
      replacement: untypedInput1
    }], part.activeGroup);
    assert.strictEqual(editorCount, 1);
    registrationDisposable.dispose();
  });
  test("closeEditor", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    await service.openEditors([{ editor: input }, { editor: otherInput }]);
    assert.strictEqual(part.activeGroup.count, 2);
    await service.closeEditor({ editor: input, groupId: part.activeGroup.id });
    assert.strictEqual(part.activeGroup.count, 1);
    await service.closeEditor({ editor: input, groupId: part.activeGroup.id });
    assert.strictEqual(part.activeGroup.count, 1);
    await service.closeEditor({ editor: otherInput, groupId: part.activeGroup.id });
    assert.strictEqual(part.activeGroup.count, 0);
    await service.closeEditor({ editor: otherInput, groupId: 999 });
    assert.strictEqual(part.activeGroup.count, 0);
  });
  test("closeEditors", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    await service.openEditors([{ editor: input }, { editor: otherInput }]);
    assert.strictEqual(part.activeGroup.count, 2);
    await service.closeEditors([{ editor: input, groupId: part.activeGroup.id }, { editor: otherInput, groupId: part.activeGroup.id }]);
    assert.strictEqual(part.activeGroup.count, 0);
  });
  test("findEditors (in group)", async () => {
    const [part, service] = await createEditorService();
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    await service.openEditors([{ editor: input }, { editor: otherInput }]);
    assert.strictEqual(part.activeGroup.count, 2);
    {
      const found1 = service.findEditors(input.resource, void 0, part.activeGroup);
      assert.strictEqual(found1.length, 1);
      assert.strictEqual(found1[0], input);
      const found2 = service.findEditors(input, void 0, part.activeGroup);
      assert.strictEqual(found2, input);
    }
    {
      const found1 = service.findEditors(otherInput.resource, void 0, part.activeGroup);
      assert.strictEqual(found1.length, 1);
      assert.strictEqual(found1[0], otherInput);
      const found2 = service.findEditors(otherInput, void 0, part.activeGroup);
      assert.strictEqual(found2, otherInput);
    }
    {
      const found1 = service.findEditors(URI.parse("my://no-such-resource"), void 0, part.activeGroup);
      assert.strictEqual(found1.length, 0);
      const found2 = service.findEditors({ resource: URI.parse("my://no-such-resource"), typeId: "", editorId: TEST_EDITOR_INPUT_ID }, void 0, part.activeGroup);
      assert.strictEqual(found2, void 0);
    }
    {
      const newEditor = await service.openEditor(createTestFileEditorInput(URI.parse("my://other-group-resource"), TEST_EDITOR_INPUT_ID), { pinned: true, preserveFocus: true }, SIDE_GROUP);
      const found1 = service.findEditors(input.resource, void 0, newEditor.group.id);
      assert.strictEqual(found1.length, 0);
      const found2 = service.findEditors(input, void 0, newEditor.group.id);
      assert.strictEqual(found2, void 0);
    }
    await part.activeGroup.closeAllEditors();
    {
      const found1 = service.findEditors(input.resource, void 0, part.activeGroup);
      assert.strictEqual(found1.length, 0);
      const found2 = service.findEditors(input, void 0, part.activeGroup);
      assert.strictEqual(found2, void 0);
    }
  });
  test("findEditors (across groups)", async () => {
    const [part, service] = await createEditorService();
    const rootGroup = part.activeGroup;
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    await service.openEditors([{ editor: input }, { editor: otherInput }]);
    const sideEditor = await service.openEditor(input, { pinned: true }, SIDE_GROUP);
    {
      const found1 = service.findEditors(input.resource);
      assert.strictEqual(found1.length, 2);
      assert.strictEqual(found1[0].editor, input);
      assert.strictEqual(found1[0].groupId, sideEditor?.group.id);
      assert.strictEqual(found1[1].editor, input);
      assert.strictEqual(found1[1].groupId, rootGroup.id);
      const found2 = service.findEditors(input);
      assert.strictEqual(found2.length, 2);
      assert.strictEqual(found2[0].editor, input);
      assert.strictEqual(found2[0].groupId, sideEditor?.group.id);
      assert.strictEqual(found2[1].editor, input);
      assert.strictEqual(found2[1].groupId, rootGroup.id);
    }
    {
      const found1 = service.findEditors(otherInput.resource);
      assert.strictEqual(found1.length, 1);
      assert.strictEqual(found1[0].editor, otherInput);
      assert.strictEqual(found1[0].groupId, rootGroup.id);
      const found2 = service.findEditors(otherInput);
      assert.strictEqual(found2.length, 1);
      assert.strictEqual(found2[0].editor, otherInput);
      assert.strictEqual(found2[0].groupId, rootGroup.id);
    }
    {
      const found1 = service.findEditors(URI.parse("my://no-such-resource"));
      assert.strictEqual(found1.length, 0);
      const found2 = service.findEditors({ resource: URI.parse("my://no-such-resource"), typeId: "", editorId: TEST_EDITOR_INPUT_ID });
      assert.strictEqual(found2.length, 0);
    }
    await rootGroup.closeAllEditors();
    await sideEditor?.group.closeAllEditors();
    {
      const found1 = service.findEditors(input.resource);
      assert.strictEqual(found1.length, 0);
      const found2 = service.findEditors(input);
      assert.strictEqual(found2.length, 0);
    }
  });
  test("findEditors (support side by side via options)", async () => {
    const [, service] = await createEditorService();
    const secondaryInput = createTestFileEditorInput(URI.parse("my://resource-findEditors-secondary"), TEST_EDITOR_INPUT_ID);
    const primaryInput = createTestFileEditorInput(URI.parse("my://resource-findEditors-primary"), TEST_EDITOR_INPUT_ID);
    const sideBySideInput = new SideBySideEditorInput(void 0, void 0, secondaryInput, primaryInput, service);
    await service.openEditor(sideBySideInput, { pinned: true });
    let foundEditors = service.findEditors(URI.parse("my://resource-findEditors-primary"));
    assert.strictEqual(foundEditors.length, 0);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-primary"), { supportSideBySide: SideBySideEditor.PRIMARY });
    assert.strictEqual(foundEditors.length, 1);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-secondary"), { supportSideBySide: SideBySideEditor.PRIMARY });
    assert.strictEqual(foundEditors.length, 0);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-primary"), { supportSideBySide: SideBySideEditor.SECONDARY });
    assert.strictEqual(foundEditors.length, 0);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-secondary"), { supportSideBySide: SideBySideEditor.SECONDARY });
    assert.strictEqual(foundEditors.length, 1);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-primary"), { supportSideBySide: SideBySideEditor.ANY });
    assert.strictEqual(foundEditors.length, 1);
    foundEditors = service.findEditors(URI.parse("my://resource-findEditors-secondary"), { supportSideBySide: SideBySideEditor.ANY });
    assert.strictEqual(foundEditors.length, 1);
  });
  test("side by side editor is not matching all other editors (https://github.com/microsoft/vscode/issues/132859)", async () => {
    const [part, service] = await createEditorService();
    const rootGroup = part.activeGroup;
    const input = createTestFileEditorInput(URI.parse("my://resource-openEditors"), TEST_EDITOR_INPUT_ID);
    const otherInput = createTestFileEditorInput(URI.parse("my://resource2-openEditors"), TEST_EDITOR_INPUT_ID);
    const sideBySideInput = new SideBySideEditorInput(void 0, void 0, input, input, service);
    const otherSideBySideInput = new SideBySideEditorInput(void 0, void 0, otherInput, otherInput, service);
    await service.openEditor(sideBySideInput, void 0, SIDE_GROUP);
    part.activateGroup(rootGroup);
    await service.openEditor(otherSideBySideInput, { revealIfOpened: true, revealIfVisible: true });
    assert.strictEqual(rootGroup.count, 1);
  });
  test("onDidCloseEditor indicates proper context when moving editor across groups", async () => {
    const [part, service] = await createEditorService();
    const rootGroup = part.activeGroup;
    const input1 = createTestFileEditorInput(URI.parse("my://resource-onDidCloseEditor1"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource-onDidCloseEditor2"), TEST_EDITOR_INPUT_ID);
    await service.openEditor(input1, { pinned: true });
    await service.openEditor(input2, { pinned: true });
    const sidegroup = part.addGroup(rootGroup, GroupDirection.RIGHT);
    const events = [];
    disposables.add(service.onDidCloseEditor((e) => {
      events.push(e);
    }));
    rootGroup.moveEditor(input1, sidegroup);
    assert.strictEqual(events[0].context, EditorCloseContext.MOVE);
    await sidegroup.closeEditor(input1);
    assert.strictEqual(events[1].context, EditorCloseContext.UNKNOWN);
  });
  test("onDidCloseEditor indicates proper context when replacing an editor", async () => {
    const [part, service] = await createEditorService();
    const rootGroup = part.activeGroup;
    const input1 = createTestFileEditorInput(URI.parse("my://resource-onDidCloseEditor1"), TEST_EDITOR_INPUT_ID);
    const input2 = createTestFileEditorInput(URI.parse("my://resource-onDidCloseEditor2"), TEST_EDITOR_INPUT_ID);
    await service.openEditor(input1, { pinned: true });
    const events = [];
    disposables.add(service.onDidCloseEditor((e) => {
      events.push(e);
    }));
    await rootGroup.replaceEditors([{ editor: input1, replacement: input2 }]);
    assert.strictEqual(events[0].context, EditorCloseContext.REPLACE);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9lZGl0b3JTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFZGl0b3JBY3RpdmF0aW9uLCBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLCBFZGl0b3JDbG9zZUNvbnRleHQsIEVkaXRvcnNPcmRlciwgSUVkaXRvckNsb3NlRXZlbnQsIEVkaXRvcklucHV0V2l0aE9wdGlvbnMsIElFZGl0b3JQYW5lLCBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQsIGlzRWRpdG9ySW5wdXRXaXRoT3B0aW9ucywgSVVudGl0bGVkVGV4dFJlc291cmNlRWRpdG9ySW5wdXQsIElVbnR5cGVkRWRpdG9ySW5wdXQsIFNpZGVCeVNpZGVFZGl0b3IsIGlzRWRpdG9ySW5wdXQsIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSwgVGVzdFNlcnZpY2VBY2Nlc3NvciwgcmVnaXN0ZXJUZXN0RWRpdG9yLCBUZXN0RmlsZUVkaXRvcklucHV0LCBJVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlLCByZWdpc3RlclRlc3RSZXNvdXJjZUVkaXRvciwgcmVnaXN0ZXJUZXN0U2lkZUJ5U2lkZUVkaXRvciwgY3JlYXRlRWRpdG9yUGFydCwgcmVnaXN0ZXJUZXN0RmlsZUVkaXRvciwgVGVzdFRleHRGaWxlRWRpdG9yLCBUZXN0U2luZ2xldG9uRmlsZUVkaXRvcklucHV0LCB3b3JrYmVuY2hUZWFyZG93biB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXAsIElFZGl0b3JHcm91cHNTZXJ2aWNlLCBHcm91cERpcmVjdGlvbiwgR3JvdXBzQXJyYW5nZW1lbnQgfSBmcm9tICcuLi8uLi9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydC5qcyc7XG5pbXBvcnQgeyBBQ1RJVkVfR1JPVVAsIElCYXNlU2F2ZVJldmVydEFsbEVkaXRvck9wdGlvbnMsIElFZGl0b3JTZXJ2aWNlLCBQcmVmZXJyZWRHcm91cCwgU0lERV9HUk9VUCB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgRmlsZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29udHJpYi9maWxlcy9icm93c2VyL2VkaXRvcnMvZmlsZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uRXZlbnQsIEZpbGVPcGVyYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE1vY2tTY29wYWJsZUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2VUcnVzdC5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgRXJyb3JQbGFjZWhvbGRlckVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvcGFydHMvZWRpdG9yL2VkaXRvclBsYWNlaG9sZGVyLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgUExBSU5URVhUX0xBTkdVQUdFX0lEIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElFZGl0b3JQYW5lU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3JQYW5lU2VydmljZS5qcyc7XG5cbnN1aXRlKCdFZGl0b3JTZXJ2aWNlJywgKCkgPT4ge1xuXG5cdGNvbnN0IFRFU1RfRURJVE9SX0lEID0gJ015VGVzdEVkaXRvckZvckVkaXRvclNlcnZpY2UnO1xuXHRjb25zdCBURVNUX0VESVRPUl9JTlBVVF9JRCA9ICd0ZXN0RWRpdG9ySW5wdXRGb3JFZGl0b3JTZXJ2aWNlJztcblxuXHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRsZXQgdGVzdExvY2FsSW5zdGFudGlhdGlvblNlcnZpY2U6IElUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlclRlc3RFZGl0b3IoVEVTVF9FRElUT1JfSUQsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdEZpbGVFZGl0b3JJbnB1dCksIG5ldyBTeW5jRGVzY3JpcHRvcihUZXN0U2luZ2xldG9uRmlsZUVkaXRvcklucHV0KV0sIFRFU1RfRURJVE9SX0lOUFVUX0lEKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVGVzdFJlc291cmNlRWRpdG9yKCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlclRlc3RTaWRlQnlTaWRlRWRpdG9yKCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0aWYgKHRlc3RMb2NhbEluc3RhbnRpYXRpb25TZXJ2aWNlKSB7XG5cdFx0XHRhd2FpdCB3b3JrYmVuY2hUZWFyZG93bih0ZXN0TG9jYWxJbnN0YW50aWF0aW9uU2VydmljZSk7XG5cdFx0XHR0ZXN0TG9jYWxJbnN0YW50aWF0aW9uU2VydmljZSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiBjcmVhdGVFZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcykpOiBQcm9taXNlPFtFZGl0b3JQYXJ0LCBFZGl0b3JTZXJ2aWNlLCBUZXN0U2VydmljZUFjY2Vzc29yXT4ge1xuXHRcdGNvbnN0IHBhcnQgPSBhd2FpdCBjcmVhdGVFZGl0b3JQYXJ0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCBkaXNwb3NhYmxlcyk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yR3JvdXBzU2VydmljZSwgcGFydCk7XG5cblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclNlcnZpY2UsIHVuZGVmaW5lZCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIGVkaXRvclNlcnZpY2UpO1xuXG5cdFx0dGVzdExvY2FsSW5zdGFudGlhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRcdHJldHVybiBbcGFydCwgZWRpdG9yU2VydmljZSwgaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFNlcnZpY2VBY2Nlc3NvcildO1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChyZXNvdXJjZTogVVJJLCB0eXBlSWQ6IHN0cmluZyk6IFRlc3RGaWxlRWRpdG9ySW5wdXQge1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQocmVzb3VyY2UsIHR5cGVJZCkpO1xuXHR9XG5cblx0dGVzdCgnb3BlbkVkaXRvcigpIC0gYmFzaWNzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFssIHNlcnZpY2UsIGFjY2Vzc29yXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGF3YWl0IHRlc3RPcGVuQmFzaWNzKHNlcnZpY2UsIGFjY2Vzc29yLmVkaXRvclBhbmVTZXJ2aWNlKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlbkVkaXRvcigpIC0gYmFzaWNzIChzY29wZWQpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cdFx0Y29uc3Qgc2NvcGVkID0gc2VydmljZS5jcmVhdGVTY29wZWQoJ21haW4nLCBkaXNwb3NhYmxlcyk7XG5cdFx0YXdhaXQgcGFydC53aGVuUmVhZHk7XG5cblx0XHRhd2FpdCB0ZXN0T3BlbkJhc2ljcyhzY29wZWQsIGFjY2Vzc29yLmVkaXRvclBhbmVTZXJ2aWNlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdE9wZW5CYXNpY3MoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UsIGVkaXRvclBhbmVTZXJ2aWNlOiBJRWRpdG9yUGFuZVNlcnZpY2UpIHtcblx0XHRsZXQgaW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGxldCBvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLWJhc2ljcycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRsZXQgYWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHRhY3RpdmVFZGl0b3JDaGFuZ2VFdmVudENvdW50ZXIrKztcblx0XHR9KSk7XG5cblx0XHRsZXQgdmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvclNlcnZpY2Uub25EaWRWaXNpYmxlRWRpdG9yc0NoYW5nZSgoKSA9PiB7XG5cdFx0XHR2aXNpYmxlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHdpbGxPcGVuRWRpdG9yTGlzdGVuZXJDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yU2VydmljZS5vbldpbGxPcGVuRWRpdG9yKCgpID0+IHtcblx0XHRcdHdpbGxPcGVuRWRpdG9yTGlzdGVuZXJDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGRpZENsb3NlRWRpdG9yTGlzdGVuZXJDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yU2VydmljZS5vbkRpZENsb3NlRWRpdG9yKCgpID0+IHtcblx0XHRcdGRpZENsb3NlRWRpdG9yTGlzdGVuZXJDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0bGV0IHdpbGxJbnN0YW50aWF0ZUVkaXRvclBhbmVMaXN0ZW5lckNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JQYW5lU2VydmljZS5vbldpbGxJbnN0YW50aWF0ZUVkaXRvclBhbmUoZSA9PiB7XG5cdFx0XHRpZiAoZS50eXBlSWQgPT09IFRFU1RfRURJVE9SX0lEKSB7XG5cdFx0XHRcdHdpbGxJbnN0YW50aWF0ZUVkaXRvclBhbmVMaXN0ZW5lckNvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBPcGVuIGlucHV0XG5cdFx0bGV0IGVkaXRvciA9IGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yPy5nZXRJZCgpLCBURVNUX0VESVRPUl9JRCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvciwgZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3JQYW5lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgZWRpdG9yU2VydmljZS5jb3VudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LCBlZGl0b3JTZXJ2aWNlLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVswXS5lZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dCwgZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXS5lZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dCwgZWRpdG9yU2VydmljZS5hY3RpdmVFZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JQYW5lcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLnZpc2libGVFZGl0b3JQYW5lc1swXSwgZWRpdG9yKTtcblx0XHRhc3NlcnQub2soIWVkaXRvclNlcnZpY2UuYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wpO1xuXHRcdGFzc2VydC5vayghZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yTGFuZ3VhZ2VJZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UudmlzaWJsZVRleHRFZGl0b3JDb250cm9scy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLmdldFZpc2libGVUZXh0RWRpdG9yQ29udHJvbHMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLmlzT3BlbmVkKGlucHV0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogaW5wdXQucmVzb3VyY2UsIHR5cGVJZDogaW5wdXQudHlwZUlkLCBlZGl0b3JJZDogaW5wdXQuZWRpdG9ySWQgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IGlucHV0LnJlc291cmNlLCB0eXBlSWQ6IGlucHV0LnR5cGVJZCwgZWRpdG9ySWQ6ICd1bmtub3duVHlwZUlkJyB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IGlucHV0LnJlc291cmNlLCB0eXBlSWQ6ICd1bmtub3duVHlwZUlkJywgZWRpdG9ySWQ6IGlucHV0LmVkaXRvcklkIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogaW5wdXQucmVzb3VyY2UsIHR5cGVJZDogJ3Vua25vd25UeXBlSWQnLCBlZGl0b3JJZDogJ3Vua25vd25UeXBlSWQnIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UuaXNWaXNpYmxlKGlucHV0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UuaXNWaXNpYmxlKG90aGVySW5wdXQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdpbGxPcGVuRWRpdG9yTGlzdGVuZXJDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlciwgMSk7XG5cdFx0YXNzZXJ0Lm9rKGVkaXRvclBhbmVTZXJ2aWNlLmRpZEluc3RhbnRpYXRlRWRpdG9yUGFuZShURVNUX0VESVRPUl9JRCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3aWxsSW5zdGFudGlhdGVFZGl0b3JQYW5lTGlzdGVuZXJDb3VudGVyLCAxKTtcblxuXHRcdC8vIENsb3NlIGlucHV0XG5cdFx0YXdhaXQgZWRpdG9yPy5ncm91cC5jbG9zZUVkaXRvcihpbnB1dCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgZWRpdG9yU2VydmljZS5jb3VudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDAsIGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDAsIGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlkQ2xvc2VFZGl0b3JMaXN0ZW5lckNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3RpdmVFZGl0b3JDaGFuZ2VFdmVudENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aXNpYmxlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyLCAyKTtcblx0XHRhc3NlcnQub2soaW5wdXQuZ290RGlzcG9zZWQpO1xuXG5cdFx0Ly8gT3BlbiBhZ2FpbiAyIGlucHV0cyAoZGlzcG9zZWQgZWRpdG9ycyBhcmUgaWdub3JlZCEpXG5cdFx0YXdhaXQgZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgZWRpdG9yU2VydmljZS5jb3VudCk7XG5cblx0XHQvLyBPcGVuIGFnYWluIDIgaW5wdXRzIChyZWNyZWF0ZSBiZWNhdXNlIGRpc3Bvc2VkKVxuXHRcdGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtYmFzaWNzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLWJhc2ljcycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRhd2FpdCBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGVkaXRvciA9IGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihvdGhlcklucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgyLCBlZGl0b3JTZXJ2aWNlLmNvdW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3RoZXJJbnB1dCwgZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0uZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQsIGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzFdLmVkaXRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LCBlZGl0b3JTZXJ2aWNlLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLmVkaXRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG90aGVySW5wdXQsIGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0uZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yU2VydmljZS52aXNpYmxlRWRpdG9yUGFuZXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yU2VydmljZS5pc09wZW5lZChpbnB1dCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JTZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IGlucHV0LnJlc291cmNlLCB0eXBlSWQ6IGlucHV0LnR5cGVJZCwgZWRpdG9ySWQ6IGlucHV0LmVkaXRvcklkIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yU2VydmljZS5pc09wZW5lZChvdGhlcklucHV0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogb3RoZXJJbnB1dC5yZXNvdXJjZSwgdHlwZUlkOiBvdGhlcklucHV0LnR5cGVJZCwgZWRpdG9ySWQ6IG90aGVySW5wdXQuZWRpdG9ySWQgfSksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlciwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdpbGxPcGVuRWRpdG9yTGlzdGVuZXJDb3VudGVyLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlciwgNCk7XG5cblx0XHRjb25zdCBzdGlja3lJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMy1iYXNpY3MnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGF3YWl0IGVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcihzdGlja3lJbnB1dCwgeyBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMywgZWRpdG9yU2VydmljZS5jb3VudCk7XG5cblx0XHRjb25zdCBhbGxTZXF1ZW50aWFsRWRpdG9ycyA9IGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFsbFNlcXVlbnRpYWxFZGl0b3JzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUlucHV0LCBhbGxTZXF1ZW50aWFsRWRpdG9yc1swXS5lZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dCwgYWxsU2VxdWVudGlhbEVkaXRvcnNbMV0uZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3RoZXJJbnB1dCwgYWxsU2VxdWVudGlhbEVkaXRvcnNbMl0uZWRpdG9yKTtcblxuXHRcdGNvbnN0IHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5ID0gZWRpdG9yU2VydmljZS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5Lmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LCBzZXF1ZW50aWFsRWRpdG9yc0V4Y2x1ZGluZ1N0aWNreVswXS5lZGl0b3IpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdGhlcklucHV0LCBzZXF1ZW50aWFsRWRpdG9yc0V4Y2x1ZGluZ1N0aWNreVsxXS5lZGl0b3IpO1xuXG5cdFx0Y29uc3QgbXJ1RWRpdG9yc0V4Y2x1ZGluZ1N0aWNreSA9IGVkaXRvclNlcnZpY2UuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUsIHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1RWRpdG9yc0V4Y2x1ZGluZ1N0aWNreS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dCwgc2VxdWVudGlhbEVkaXRvcnNFeGNsdWRpbmdTdGlja3lbMF0uZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3RoZXJJbnB1dCwgc2VxdWVudGlhbEVkaXRvcnNFeGNsdWRpbmdTdGlja3lbMV0uZWRpdG9yKTtcblx0fVxuXG5cdHRlc3QoJ29wZW5FZGl0b3IoKSAtIG11bHRpcGxlIGNhbGxzIGFyZSBjYW5jZWxsZWQgYW5kIGluZGljYXRlZCBhcyBzdWNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFssIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYmFzaWNzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblxuXHRcdGxldCBhY3RpdmVFZGl0b3JDaGFuZ2VFdmVudENvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNoYW5nZUxpc3RlbmVyID0gc2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHRhY3RpdmVFZGl0b3JDaGFuZ2VFdmVudENvdW50ZXIrKztcblx0XHR9KTtcblxuXHRcdGxldCB2aXNpYmxlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyID0gMDtcblx0XHRjb25zdCB2aXNpYmxlRWRpdG9yQ2hhbmdlTGlzdGVuZXIgPSBzZXJ2aWNlLm9uRGlkVmlzaWJsZUVkaXRvcnNDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0dmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlcisrO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZWRpdG9yUDEgPSBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGNvbnN0IGVkaXRvclAyID0gc2VydmljZS5vcGVuRWRpdG9yKG90aGVySW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXG5cdFx0Y29uc3QgZWRpdG9yMSA9IGF3YWl0IGVkaXRvclAxO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IxLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgZWRpdG9yMiA9IGF3YWl0IGVkaXRvclAyO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IyPy5pbnB1dCwgb3RoZXJJbnB1dCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50Q291bnRlciwgMSk7XG5cblx0XHRhY3RpdmVFZGl0b3JDaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0dmlzaWJsZUVkaXRvckNoYW5nZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlbkVkaXRvcigpIC0gc2FtZSBpbnB1dCBkb2VzIG5vdCBjYW5jZWwgcHJldmlvdXMgb25lIC0gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNjY4NCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbLCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGxldCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWJhc2ljcycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRsZXQgZWRpdG9yUDEgPSBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGxldCBlZGl0b3JQMiA9IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRsZXQgZWRpdG9yMSA9IGF3YWl0IGVkaXRvclAxO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IxPy5pbnB1dCwgaW5wdXQpO1xuXG5cdFx0bGV0IGVkaXRvcjIgPSBhd2FpdCBlZGl0b3JQMjtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yMj8uaW5wdXQsIGlucHV0KTtcblxuXHRcdGFzc2VydC5vayhlZGl0b3IyLmdyb3VwKTtcblx0XHRhd2FpdCBlZGl0b3IyLmdyb3VwLmNsb3NlQWxsRWRpdG9ycygpO1xuXG5cdFx0aW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IGlucHV0U2FtZSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWJhc2ljcycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRlZGl0b3JQMSA9IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0ZWRpdG9yUDIgPSBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXRTYW1lLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGVkaXRvcjEgPSBhd2FpdCBlZGl0b3JQMTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yMT8uaW5wdXQsIGlucHV0KTtcblxuXHRcdGVkaXRvcjIgPSBhd2FpdCBlZGl0b3JQMjtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yMj8uaW5wdXQsIGlucHV0KTtcblx0fSk7XG5cblx0dGVzdCgnb3BlbkVkaXRvcigpIC0gc2luZ2xldG9uIHR5cGVkIGVkaXRvcnMgcmV2ZWFsIGluc3RlYWQgb2Ygc3BsaXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U2luZ2xldG9uRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MxJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSk7XG5cdFx0Y29uc3QgaW5wdXQyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U2luZ2xldG9uRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MyJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSk7XG5cblx0XHRjb25zdCBpbnB1dDFHcm91cCA9IChhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9KSk/Lmdyb3VwO1xuXHRcdGNvbnN0IGlucHV0Mkdyb3VwID0gKGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0sIFNJREVfR1JPVVApKT8uZ3JvdXA7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgaW5wdXQyR3JvdXApO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgaW5wdXQxR3JvdXApO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuRWRpdG9yKCkgLSBsb2NrZWQgZ3JvdXBzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlclRlc3RGaWxlRWRpdG9yKCkpO1xuXG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2UsIGFjY2Vzc29yXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5lZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnLFxuXHRcdFx0eyBpZDogVEVTVF9FRElUT1JfSU5QVVRfSUQsIGxhYmVsOiAnTGFiZWwnLCBwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSB9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiBlZGl0b3IgPT4gKHsgZWRpdG9yOiBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KGVkaXRvci5yZXNvdXJjZSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpIH0pXG5cdFx0XHR9XG5cdFx0KSk7XG5cblx0XHRjb25zdCBpbnB1dDE6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UtYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cdFx0Y29uc3QgaW5wdXQyOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlMi1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRjb25zdCBpbnB1dDM6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UzLWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdGNvbnN0IGlucHV0NDogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZTQtYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cdFx0Y29uc3QgaW5wdXQ1OiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlNS1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRjb25zdCBpbnB1dDY6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2U2LWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdGNvbnN0IGlucHV0NzogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZTctYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cblx0XHRjb25zdCBlZGl0b3IxID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Y29uc3QgZWRpdG9yMiA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0sIFNJREVfR1JPVVApO1xuXG5cdFx0Y29uc3QgZ3JvdXAxID0gZWRpdG9yMT8uZ3JvdXA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMT8uY291bnQsIDEpO1xuXG5cdFx0Y29uc3QgZ3JvdXAyID0gZWRpdG9yMj8uZ3JvdXA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMj8uY291bnQsIDEpO1xuXG5cdFx0Z3JvdXAyLmxvY2sodHJ1ZSk7XG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMi5pZCk7XG5cblx0XHQvLyBXaWxsIG9wZW4gaW4gZ3JvdXAgMSBiZWNhdXNlIGdyb3VwIDIgaXMgbG9ja2VkXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCksIGlucHV0My5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmNvdW50LCAxKTtcblxuXHRcdC8vIFdpbGwgb3BlbiBpbiBncm91cCAyIGJlY2F1c2UgZ3JvdXAgd2FzIHByb3ZpZGVkXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUgfSwgZ3JvdXAyLmlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgaW5wdXQzLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0Ly8gV2lsbCByZXZlYWwgZWRpdG9yIGluIGdyb3VwIDIgYmVjYXVzZSBpdCBpcyBjb250YWluZWRcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSB9LCBncm91cDIpO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0sIEFDVElWRV9HUk9VUCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCksIGlucHV0Mi5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdC8vIFdpbGwgb3BlbiBhIG5ldyBncm91cCBiZWNhdXNlIHNpZGUgZ3JvdXAgaXMgbG9ja2VkXG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMS5pZCk7XG5cdFx0Y29uc3QgZWRpdG9yMyA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDQsIHsgcGlubmVkOiB0cnVlIH0sIFNJREVfR1JPVVApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmNvdW50LCAzKTtcblxuXHRcdGNvbnN0IGdyb3VwMyA9IGVkaXRvcjM/Lmdyb3VwO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDM/LmNvdW50LCAxKTtcblxuXHRcdC8vIFdpbGwgcmV2ZWFsIGVkaXRvciBpbiBncm91cCAyIGJlY2F1c2UgaXQgaXMgY29udGFpbmVkXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUgfSwgZ3JvdXAyKTtcblx0XHRwYXJ0LmFjdGl2YXRlR3JvdXAoZ3JvdXAxLmlkKTtcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSB9LCBTSURFX0dST1VQKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5jb3VudCwgMyk7XG5cblx0XHQvLyBXaWxsIG9wZW4gYSBuZXcgZ3JvdXAgaWYgYWxsIGdyb3VwcyBhcmUgbG9ja2VkXG5cdFx0Z3JvdXAxLmxvY2sodHJ1ZSk7XG5cdFx0Z3JvdXAyLmxvY2sodHJ1ZSk7XG5cdFx0Z3JvdXAzLmxvY2sodHJ1ZSk7XG5cblx0XHRwYXJ0LmFjdGl2YXRlR3JvdXAoZ3JvdXAxLmlkKTtcblx0XHRjb25zdCBlZGl0b3I1ID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0NSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Y29uc3QgZ3JvdXA0ID0gZWRpdG9yNT8uZ3JvdXA7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwND8uY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDQuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgaW5wdXQ1LnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmNvdW50LCA0KTtcblxuXHRcdC8vIFdpbGwgb3BlbiBlZGl0b3IgaW4gbW9zdCByZWNlbnRseSBub24tbG9ja2VkIGdyb3VwXG5cdFx0Z3JvdXAxLmxvY2soZmFsc2UpO1xuXHRcdGdyb3VwMi5sb2NrKGZhbHNlKTtcblx0XHRncm91cDMubG9jayhmYWxzZSk7XG5cdFx0Z3JvdXA0LmxvY2soZmFsc2UpO1xuXG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMy5pZCk7XG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMi5pZCk7XG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwNC5pZCk7XG5cdFx0Z3JvdXA0LmxvY2sodHJ1ZSk7XG5cdFx0Z3JvdXAyLmxvY2sodHJ1ZSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQ2LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5jb3VudCwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAsIGdyb3VwMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMy5hY3RpdmVFZGl0b3I/LnJlc291cmNlPy50b1N0cmluZygpLCBpbnB1dDYucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHQvLyBXaWxsIGZpbmQgdGhlIHJpZ2h0IGdyb3VwIHdoZXJlIGVkaXRvciBpcyBhbHJlYWR5IG9wZW5lZCBpbiB3aGVuIGFsbCBncm91cHMgYXJlIGxvY2tlZFxuXHRcdGdyb3VwMS5sb2NrKHRydWUpO1xuXHRcdGdyb3VwMi5sb2NrKHRydWUpO1xuXHRcdGdyb3VwMy5sb2NrKHRydWUpO1xuXHRcdGdyb3VwNC5sb2NrKHRydWUpO1xuXG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMS5pZCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQ2LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmNvdW50LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgZ3JvdXAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAzLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCksIGlucHV0Ni5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLCBncm91cDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDMuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgaW5wdXQ2LnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKGdyb3VwMS5pZCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQ2LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmNvdW50LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgZ3JvdXAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAzLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCksIGlucHV0Ni5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdC8vIFdpbGwgcmV2ZWFsIGFuIG9wZW5lZCBlZGl0b3IgaW4gdGhlIGFjdGl2ZSBsb2NrZWQgZ3JvdXBcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQ3LCB7IHBpbm5lZDogdHJ1ZSB9LCBncm91cDMpO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDYsIHsgcGlubmVkOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuY291bnQsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLCBncm91cDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDMuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgaW5wdXQ2LnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdsb2NrZWQgZ3JvdXBzIC0gd29ya2JlbmNoLmVkaXRvci5yZXZlYWxJZk9wZW4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRhd2FpdCBjb25maWd1cmF0aW9uU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyAnZWRpdG9yJzogeyAncmV2ZWFsSWZPcGVuJzogdHJ1ZSB9IH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUZXN0RmlsZUVkaXRvcigpKTtcblxuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5lZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnLFxuXHRcdFx0eyBpZDogVEVTVF9FRElUT1JfSU5QVVRfSUQsIGxhYmVsOiAnTGFiZWwnLCBwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmV4Y2x1c2l2ZSB9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiBlZGl0b3IgPT4gKHsgZWRpdG9yOiBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KGVkaXRvci5yZXNvdXJjZSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpIH0pXG5cdFx0XHR9XG5cdFx0KSk7XG5cblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IHJpZ2h0R3JvdXAgPSBwYXJ0LmFkZEdyb3VwKHJvb3RHcm91cCwgR3JvdXBEaXJlY3Rpb24uUklHSFQpO1xuXG5cdFx0cGFydC5hY3RpdmF0ZUdyb3VwKHJvb3RHcm91cCk7XG5cblx0XHRjb25zdCBpbnB1dDE6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UtYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cdFx0Y29uc3QgaW5wdXQyOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlMi1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRjb25zdCBpbnB1dDM6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UzLWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdGNvbnN0IGlucHV0NDogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZTQtYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCByb290R3JvdXAuaWQpO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHJvb3RHcm91cC5pZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcm9vdEdyb3VwLmlkKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDMsIHJpZ2h0R3JvdXAuaWQpO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDQsIHJpZ2h0R3JvdXAuaWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuaWQsIHJpZ2h0R3JvdXAuaWQpO1xuXG5cdFx0cm9vdEdyb3VwLmxvY2sodHJ1ZSk7XG5cdFx0cmlnaHRHcm91cC5sb2NrKHRydWUpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcm9vdEdyb3VwLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3I/LnJlc291cmNlPy50b1N0cmluZygpLCBpbnB1dDEucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmlkLCByaWdodEdyb3VwLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3I/LnJlc291cmNlPy50b1N0cmluZygpLCBpbnB1dDMucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5ncm91cHMubGVuZ3RoLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnbG9ja2VkIGdyb3VwcyAtIHJldmVhbElmVmlzaWJsZScsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUZXN0RmlsZUVkaXRvcigpKTtcblxuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IuZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLnJlZ2lzdGVyRWRpdG9yKFxuXHRcdFx0JyouZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyxcblx0XHRcdHsgaWQ6IFRFU1RfRURJVE9SX0lOUFVUX0lELCBsYWJlbDogJ0xhYmVsJywgcHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5leGNsdXNpdmUgfSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogZWRpdG9yID0+ICh7IGVkaXRvcjogY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChlZGl0b3IucmVzb3VyY2UsIFRFU1RfRURJVE9SX0lOUFVUX0lEKSB9KVxuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0Y29uc3Qgcm9vdEdyb3VwID0gcGFydC5hY3RpdmVHcm91cDtcblx0XHRjb25zdCByaWdodEdyb3VwID0gcGFydC5hZGRHcm91cChyb290R3JvdXAsIEdyb3VwRGlyZWN0aW9uLlJJR0hUKTtcblxuXHRcdHBhcnQuYWN0aXZhdGVHcm91cChyb290R3JvdXApO1xuXG5cdFx0Y29uc3QgaW5wdXQxOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlLWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdGNvbnN0IGlucHV0MjogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZTItYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cdFx0Y29uc3QgaW5wdXQzOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlMy1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRjb25zdCBpbnB1dDQ6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2U0LWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgcm9vdEdyb3VwLmlkKTtcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQyLCByb290R3JvdXAuaWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuaWQsIHJvb3RHcm91cC5pZCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQzLCByaWdodEdyb3VwLmlkKTtcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQ0LCByaWdodEdyb3VwLmlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmlkLCByaWdodEdyb3VwLmlkKTtcblxuXHRcdHJvb3RHcm91cC5sb2NrKHRydWUpO1xuXHRcdHJpZ2h0R3JvdXAubG9jayh0cnVlKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcih7IC4uLmlucHV0Miwgb3B0aW9uczogeyAuLi5pbnB1dDIub3B0aW9ucywgcmV2ZWFsSWZWaXNpYmxlOiB0cnVlIH0gfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcm9vdEdyb3VwLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3I/LnJlc291cmNlPy50b1N0cmluZygpLCBpbnB1dDIucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyAuLi5pbnB1dDQsIG9wdGlvbnM6IHsgLi4uaW5wdXQ0Lm9wdGlvbnMsIHJldmVhbElmVmlzaWJsZTogdHJ1ZSB9IH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuaWQsIHJpZ2h0R3JvdXAuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvcj8ucmVzb3VyY2U/LnRvU3RyaW5nKCksIGlucHV0NC5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0Lmdyb3Vwcy5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdsb2NrZWQgZ3JvdXBzIC0gcmV2ZWFsSWZPcGVuZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVGVzdEZpbGVFZGl0b3IoKSk7XG5cblx0XHRjb25zdCBbcGFydCwgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdCcqLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycsXG5cdFx0XHR7IGlkOiBURVNUX0VESVRPUl9JTlBVVF9JRCwgbGFiZWw6ICdMYWJlbCcsIHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlIH0sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6IGVkaXRvciA9PiAoeyBlZGl0b3I6IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoZWRpdG9yLnJlc291cmNlLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfSlcblx0XHRcdH1cblx0XHQpKTtcblxuXHRcdGNvbnN0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cdFx0Y29uc3QgcmlnaHRHcm91cCA9IHBhcnQuYWRkR3JvdXAocm9vdEdyb3VwLCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cblx0XHRwYXJ0LmFjdGl2YXRlR3JvdXAocm9vdEdyb3VwKTtcblxuXHRcdGNvbnN0IGlucHV0MTogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZS1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRjb25zdCBpbnB1dDI6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UyLWJhc2ljcy5lZGl0b3Itc2VydmljZS1sb2NrZWQtZ3JvdXAtdGVzdHMnKSwgb3B0aW9uczogeyBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdGNvbnN0IGlucHV0MzogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkucGFyc2UoJ2ZpbGU6Ly9yZXNvdXJjZTMtYmFzaWNzLmVkaXRvci1zZXJ2aWNlLWxvY2tlZC1ncm91cC10ZXN0cycpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cdFx0Y29uc3QgaW5wdXQ0OiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlNC1iYXNpY3MuZWRpdG9yLXNlcnZpY2UtbG9ja2VkLWdyb3VwLXRlc3RzJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHJvb3RHcm91cC5pZCk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0Miwgcm9vdEdyb3VwLmlkKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmlkLCByb290R3JvdXAuaWQpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MywgcmlnaHRHcm91cC5pZCk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0NCwgcmlnaHRHcm91cC5pZCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcmlnaHRHcm91cC5pZCk7XG5cblx0XHRyb290R3JvdXAubG9jayh0cnVlKTtcblx0XHRyaWdodEdyb3VwLmxvY2sodHJ1ZSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyAuLi5pbnB1dDEsIG9wdGlvbnM6IHsgLi4uaW5wdXQxLm9wdGlvbnMsIHJldmVhbElmT3BlbmVkOiB0cnVlIH0gfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcm9vdEdyb3VwLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5hY3RpdmVFZGl0b3I/LnJlc291cmNlPy50b1N0cmluZygpLCBpbnB1dDEucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyAuLi5pbnB1dDMsIG9wdGlvbnM6IHsgLi4uaW5wdXQzLm9wdGlvbnMsIHJldmVhbElmT3BlbmVkOiB0cnVlIH0gfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5pZCwgcmlnaHRHcm91cC5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgaW5wdXQzLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuZ3JvdXBzLmxlbmd0aCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3IoKSAtIHVudHlwZWQsIHR5cGVkJywgKCkgPT4ge1xuXHRcdHJldHVybiB0ZXN0T3BlbkVkaXRvcnMoZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuRWRpdG9ycygpIC0gdW50eXBlZCwgdHlwZWQnLCAoKSA9PiB7XG5cdFx0cmV0dXJuIHRlc3RPcGVuRWRpdG9ycyh0cnVlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdE9wZW5FZGl0b3JzKHVzZU9wZW5FZGl0b3JzOiBib29sZWFuKSB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVGVzdEZpbGVFZGl0b3IoKSk7XG5cblx0XHRjb25zdCBbcGFydCwgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0bGV0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRsZXQgZWRpdG9yRmFjdG9yeUNhbGxlZCA9IDA7XG5cdFx0bGV0IHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCA9IDA7XG5cdFx0bGV0IGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkID0gMDtcblxuXHRcdGxldCBsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0bGV0IGxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3I6IElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGxldCBsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3I6IElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5lZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycsXG5cdFx0XHR7IGlkOiBURVNUX0VESVRPUl9JTlBVVF9JRCwgbGFiZWw6ICdMYWJlbCcsIHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlIH0sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6IGVkaXRvciA9PiB7XG5cdFx0XHRcdFx0ZWRpdG9yRmFjdG9yeUNhbGxlZCsrO1xuXHRcdFx0XHRcdGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yID0gZWRpdG9yO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KGVkaXRvci5yZXNvdXJjZSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpIH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNyZWF0ZVVudGl0bGVkRWRpdG9ySW5wdXQ6IHVudGl0bGVkRWRpdG9yID0+IHtcblx0XHRcdFx0XHR1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQrKztcblx0XHRcdFx0XHRsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yID0gdW50aXRsZWRFZGl0b3I7XG5cblx0XHRcdFx0XHRyZXR1cm4geyBlZGl0b3I6IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQodW50aXRsZWRFZGl0b3IucmVzb3VyY2UgPz8gVVJJLnBhcnNlKGB1bnRpdGxlZDovL215LXVudGl0bGVkLWVkaXRvci0ke3VudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZH1gKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpIH07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNyZWF0ZURpZmZFZGl0b3JJbnB1dDogZGlmZkVkaXRvciA9PiB7XG5cdFx0XHRcdFx0ZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQrKztcblx0XHRcdFx0XHRsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IgPSBkaWZmRWRpdG9yO1xuXG5cdFx0XHRcdFx0cmV0dXJuIHsgZWRpdG9yOiBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5maWxlKGBkaWZmLWVkaXRvci0ke2RpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkfWApLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCkpO1xuXG5cdFx0YXN5bmMgZnVuY3Rpb24gcmVzZXRUZXN0U3RhdGUoKSB7XG5cdFx0XHRlZGl0b3JGYWN0b3J5Q2FsbGVkID0gMDtcblx0XHRcdHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCA9IDA7XG5cdFx0XHRkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCA9IDA7XG5cblx0XHRcdGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yID0gdW5kZWZpbmVkO1xuXHRcdFx0bGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvciA9IHVuZGVmaW5lZDtcblx0XHRcdGxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvciA9IHVuZGVmaW5lZDtcblxuXHRcdFx0YXdhaXQgd29ya2JlbmNoVGVhcmRvd24oYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0XHRyb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdH1cblxuXHRcdGFzeW5jIGZ1bmN0aW9uIG9wZW5FZGl0b3IoZWRpdG9yOiBFZGl0b3JJbnB1dFdpdGhPcHRpb25zIHwgSVVudHlwZWRFZGl0b3JJbnB1dCwgZ3JvdXA/OiBQcmVmZXJyZWRHcm91cCk6IFByb21pc2U8SUVkaXRvclBhbmUgfCB1bmRlZmluZWQ+IHtcblx0XHRcdGlmICh1c2VPcGVuRWRpdG9ycykge1xuXHRcdFx0XHQvLyBUaGUgdHlwZSBzYWZldHkgaXNuJ3Qgc3VwZXIgZ29vZCBoZXJlLCBzbyB3ZSBhc3Npc3Qgd2l0aCBydW50aW1lIGNoZWNrc1xuXHRcdFx0XHQvLyBPcGVuIGVkaXRvcnMgZXhwZWN0cyB1bnR5cGVkIG9yIGVkaXRvciBpbnB1dCB3aXRoIG9wdGlvbnMsIHlvdSBjYW5ub3QgcGFzcyBhIHR5cGVkIGVkaXRvciBpbnB1dFxuXHRcdFx0XHQvLyB3aXRob3V0IG9wdGlvbnNcblx0XHRcdFx0aWYgKCFpc0VkaXRvcklucHV0V2l0aE9wdGlvbnMoZWRpdG9yKSAmJiBpc0VkaXRvcklucHV0KGVkaXRvcikpIHtcblx0XHRcdFx0XHRlZGl0b3IgPSB7IGVkaXRvcjogZWRpdG9yLCBvcHRpb25zOiB7fSB9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHBhbmVzID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9ycyhbZWRpdG9yXSwgZ3JvdXApO1xuXHRcdFx0XHRyZXR1cm4gcGFuZXNbMF07XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpc0VkaXRvcklucHV0V2l0aE9wdGlvbnMoZWRpdG9yKSkge1xuXHRcdFx0XHRyZXR1cm4gc2VydmljZS5vcGVuRWRpdG9yKGVkaXRvci5lZGl0b3IsIGVkaXRvci5vcHRpb25zLCBncm91cCk7XG5cdFx0XHR9XG5cblx0XHRcdHJldHVybiBzZXJ2aWNlLm9wZW5FZGl0b3IoZWRpdG9yLCBncm91cCk7XG5cdFx0fVxuXG5cdFx0Ly8gdW50eXBlZFxuXHRcdHtcblx0XHRcdC8vIHVudHlwZWQgcmVzb3VyY2UgZWRpdG9yLCBubyBvcHRpb25zLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykgfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cdFx0XHRcdGxldCB0eXBlZEVkaXRvciA9IHBhbmU/LmlucHV0O1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHR5cGVkRWRpdG9yIGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZEVkaXRvci5yZXNvdXJjZS50b1N0cmluZygpLCB1bnR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdC8vIG9wZW5pbmcgdGhlIHNhbWUgZWRpdG9yIHNob3VsZCBub3QgY3JlYXRlXG5cdFx0XHRcdC8vIGEgbmV3IGVkaXRvciBpbnB1dFxuXHRcdFx0XHRhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAuYWN0aXZlRWRpdG9yLCB0eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0Ly8gcmVwbGFjZUVkaXRvcnMgc2hvdWxkIHdvcmsgdG9vXG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3JSZXBsYWNlbWVudDogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS1yZXBsYWNlZC5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpIH07XG5cdFx0XHRcdGF3YWl0IHNlcnZpY2UucmVwbGFjZUVkaXRvcnMoW3tcblx0XHRcdFx0XHRlZGl0b3I6IHR5cGVkRWRpdG9yLFxuXHRcdFx0XHRcdHJlcGxhY2VtZW50OiB1bnR5cGVkRWRpdG9yUmVwbGFjZW1lbnRcblx0XHRcdFx0fV0sIHJvb3RHcm91cCk7XG5cblx0XHRcdFx0dHlwZWRFZGl0b3IgPSByb290R3JvdXAuYWN0aXZlRWRpdG9yITtcblxuXHRcdFx0XHRhc3NlcnQub2sodHlwZWRFZGl0b3IgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgdW50eXBlZEVkaXRvclJlcGxhY2VtZW50LnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAzKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yUmVwbGFjZW1lbnQpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdW50eXBlZCByZXNvdXJjZSBlZGl0b3IsIG9wdGlvbnMgKG92ZXJyaWRlIHRleHQpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJyksIG9wdGlvbnM6IHsgb3ZlcnJpZGU6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gcGFuZT8uaW5wdXQ7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2sodHlwZWRFZGl0b3IgaW5zdGFuY2VvZiBGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSwgdW50eXBlZEVkaXRvci5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0Ly8gb3BlbmluZyB0aGUgc2FtZSBlZGl0b3Igc2hvdWxkIG5vdCBjcmVhdGVcblx0XHRcdFx0Ly8gYSBuZXcgZWRpdG9yIGlucHV0XG5cdFx0XHRcdGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cC5hY3RpdmVFZGl0b3IsIHR5cGVkRWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB1bnR5cGVkIHJlc291cmNlIGVkaXRvciwgb3B0aW9ucyAob3ZlcnJpZGUgdGV4dCwgc3RpY2t5OiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlKSwgbm8gZ3JvdXBcblx0XHRcdHtcblx0XHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvcjogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBvcHRpb25zOiB7IHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSwgb3ZlcnJpZGU6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHVudHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmdyb3VwLmlzU3RpY2t5KHBhbmUuaW5wdXQpLCB0cnVlKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdFx0YXdhaXQgcGFydC5hY3RpdmVHcm91cC5jbG9zZUVkaXRvcihwYW5lLmlucHV0KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdW50eXBlZCByZXNvdXJjZSBlZGl0b3IsIG9wdGlvbnMgKG92ZXJyaWRlIGRlZmF1bHQpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJyksIG9wdGlvbnM6IHsgb3ZlcnJpZGU6IERFRkFVTFRfRURJVE9SX0FTU09DSUFUSU9OLmlkIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHVudHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgcmVzb3VyY2UgZWRpdG9yLCBvcHRpb25zIChvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJyksIG9wdGlvbnM6IHsgb3ZlcnJpZGU6IFRFU1RfRURJVE9SX0lOUFVUX0lEIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dC5yZXNvdXJjZS50b1N0cmluZygpLCB1bnR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgcmVzb3VyY2UgZWRpdG9yLCBvcHRpb25zIChzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJyksIG9wdGlvbnM6IHsgc3RpY2t5OiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dC5yZXNvdXJjZS50b1N0cmluZygpLCB1bnR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5ncm91cC5pc1N0aWNreShwYW5lLmlucHV0KSwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yIGFzIElSZXNvdXJjZUVkaXRvcklucHV0KS5yZXNvdXJjZS50b1N0cmluZygpLCB1bnR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yIGFzIElSZXNvdXJjZUVkaXRvcklucHV0KS5vcHRpb25zPy5wcmVzZXJ2ZUZvY3VzLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHRcdGF3YWl0IHBhcnQuYWN0aXZlR3JvdXAuY2xvc2VFZGl0b3IocGFuZS5pbnB1dCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgcmVzb3VyY2UgZWRpdG9yLCBvcHRpb25zIChvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQsIHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgb3B0aW9uczogeyBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUsIG92ZXJyaWRlOiBURVNUX0VESVRPUl9JTlBVVF9JRCB9IH07XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHBhbmUuaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSwgdW50eXBlZEVkaXRvci5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuZ3JvdXAuaXNTdGlja3kocGFuZS5pbnB1dCksIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsYXN0RWRpdG9yRmFjdG9yeUVkaXRvciBhcyBJUmVzb3VyY2VFZGl0b3JJbnB1dCkucmVzb3VyY2UudG9TdHJpbmcoKSwgdW50eXBlZEVkaXRvci5yZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsYXN0RWRpdG9yRmFjdG9yeUVkaXRvciBhcyBJUmVzb3VyY2VFZGl0b3JJbnB1dCkub3B0aW9ucz8ucHJlc2VydmVGb2N1cywgdHJ1ZSk7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0XHRhd2FpdCBwYXJ0LmFjdGl2ZUdyb3VwLmNsb3NlRWRpdG9yKHBhbmUuaW5wdXQpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB1bnR5cGVkIHJlc291cmNlIGVkaXRvciwgbm8gb3B0aW9ucywgU0lERV9HUk9VUFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykgfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvciwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZT8uaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/LmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHVudHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdEVkaXRvckZhY3RvcnlFZGl0b3IsIHVudHlwZWRFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdW50eXBlZCByZXNvdXJjZSBlZGl0b3IsIG9wdGlvbnMgKG92ZXJyaWRlIHRleHQpLCBTSURFX0dST1VQXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3I6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgb3B0aW9uczogeyBvdmVycmlkZTogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQgfSB9O1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yLCBTSURFX0dST1VQKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lPy5pbnB1dCBpbnN0YW5jZW9mIEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHVudHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVHlwZWRcblx0XHR7XG5cdFx0XHQvLyB0eXBlZCBlZGl0b3IsIG5vIG9wdGlvbnMsIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciB9KTtcblx0XHRcdFx0bGV0IHR5cGVkSW5wdXQgPSBwYW5lPy5pbnB1dDtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayh0eXBlZElucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0eXBlZElucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdC8vIEl0J3MgYSB0eXBlZCBlZGl0b3IgaW5wdXQgc28gdGhlIHJlc29sdmVyIHNob3VsZCBub3QgaGF2ZSBiZWVuIGNhbGxlZFxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0Ly8gb3BlbmluZyB0aGUgc2FtZSBlZGl0b3Igc2hvdWxkIG5vdCBjcmVhdGVcblx0XHRcdFx0Ly8gYSBuZXcgZWRpdG9yIGlucHV0XG5cdFx0XHRcdGF3YWl0IG9wZW5FZGl0b3IodHlwZWRFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAuYWN0aXZlRWRpdG9yLCB0eXBlZElucHV0KTtcblxuXHRcdFx0XHQvLyByZXBsYWNlRWRpdG9ycyBzaG91bGQgd29yayB0b29cblx0XHRcdFx0Y29uc3QgdHlwZWRFZGl0b3JSZXBsYWNlbWVudCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLmZpbGUoJ2ZpbGUtcmVwbGFjZWQuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRhd2FpdCBzZXJ2aWNlLnJlcGxhY2VFZGl0b3JzKFt7XG5cdFx0XHRcdFx0ZWRpdG9yOiB0eXBlZEVkaXRvcixcblx0XHRcdFx0XHRyZXBsYWNlbWVudDogdHlwZWRFZGl0b3JSZXBsYWNlbWVudFxuXHRcdFx0XHR9XSwgcm9vdEdyb3VwKTtcblxuXHRcdFx0XHR0eXBlZElucHV0ID0gcm9vdEdyb3VwLmFjdGl2ZUVkaXRvciE7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKHR5cGVkSW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSwgdHlwZWRFZGl0b3JSZXBsYWNlbWVudC5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0eXBlZCBlZGl0b3IsIG5vIG9wdGlvbnMsIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciB9KTtcblx0XHRcdFx0Y29uc3QgdHlwZWRJbnB1dCA9IHBhbmU/LmlucHV0O1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHR5cGVkSW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkSW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSwgdHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdC8vIG9wZW5pbmcgdGhlIHNhbWUgZWRpdG9yIHNob3VsZCBub3QgY3JlYXRlXG5cdFx0XHRcdC8vIGEgbmV3IGVkaXRvciBpbnB1dFxuXHRcdFx0XHRhd2FpdCBvcGVuRWRpdG9yKHR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLmFjdGl2ZUVkaXRvciwgdHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHR5cGVkIGVkaXRvciwgb3B0aW9ucyAobm8gb3ZlcnJpZGUsIHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciwgb3B0aW9uczogeyBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUgfSB9KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5ncm91cC5pc1N0aWNreShwYW5lLmlucHV0KSwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHRcdGF3YWl0IHBhcnQuYWN0aXZlR3JvdXAuY2xvc2VFZGl0b3IocGFuZS5pbnB1dCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHR5cGVkIGVkaXRvciwgb3B0aW9ucyAob3ZlcnJpZGUgZGVmYXVsdCksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciwgb3B0aW9uczogeyBvdmVycmlkZTogREVGQVVMVF9FRElUT1JfQVNTT0NJQVRJT04uaWQgfSB9KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdC8vIFdlIHNob3VsZG4ndCBoYXZlIHJlc29sdmVkIGJlY2F1c2UgaXQgaXMgYSB0eXBlZCBlZGl0b3IsIGV2ZW4gdGhvdWdoIHdlIGhhdmUgYW4gb3ZlcnJpZGUgc3BlY2lmaWVkXG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0eXBlZCBlZGl0b3IsIG9wdGlvbnMgKG92ZXJyaWRlOiBURVNUX0VESVRPUl9JTlBVVF9JRCksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciwgb3B0aW9uczogeyBvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQgfSB9KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0eXBlZCBlZGl0b3IsIG9wdGlvbnMgKHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHsgZWRpdG9yOiB0eXBlZEVkaXRvciwgb3B0aW9uczogeyBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUgfSB9KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5ncm91cC5pc1N0aWNreShwYW5lLmlucHV0KSwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHRcdGF3YWl0IHBhcnQuYWN0aXZlR3JvdXAuY2xvc2VFZGl0b3IocGFuZS5pbnB1dCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHR5cGVkIGVkaXRvciwgb3B0aW9ucyAob3ZlcnJpZGU6IFRFU1RfRURJVE9SX0lOUFVUX0lELCBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB0eXBlZEVkaXRvciA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLmZpbGUoJ2ZpbGUuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IsIG9wdGlvbnM6IHsgc3RpY2t5OiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCBvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQgfSB9KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5ncm91cC5pc1N0aWNreShwYW5lLmlucHV0KSwgdHJ1ZSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHRcdGF3YWl0IHBhcnQuYWN0aXZlR3JvdXAuY2xvc2VFZGl0b3IocGFuZS5pbnB1dCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHR5cGVkIGVkaXRvciwgbm8gb3B0aW9ucywgU0lERV9HUk9VUFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB0eXBlZEVkaXRvciA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLmZpbGUoJ2ZpbGUuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IgfSwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZT8uaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/LmlucHV0LnJlc291cmNlLnRvU3RyaW5nKCksIHR5cGVkRWRpdG9yLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB0eXBlZCBlZGl0b3IsIG9wdGlvbnMgKG5vIG92ZXJyaWRlKSwgU0lERV9HUk9VUFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB0eXBlZEVkaXRvciA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLmZpbGUoJ2ZpbGUuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IgfSwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZT8uaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSwgdHlwZWRFZGl0b3IucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gVW50eXBlZCB1bnRpdGxlZFxuXHRcdHtcblx0XHRcdC8vIHVudHlwZWQgdW50aXRsZWQgZWRpdG9yLCBubyBvcHRpb25zLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IHVuZGVmaW5lZCwgb3B0aW9uczogeyBvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQgfSB9O1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lLmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lLmlucHV0LnJlc291cmNlLnNjaGVtZSwgJ3VudGl0bGVkJyk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IsIHVudHlwZWRFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdW50eXBlZCB1bnRpdGxlZCBlZGl0b3IsIG5vIG9wdGlvbnMsIFNJREVfR1JPVVBcblx0XHRcdHtcblx0XHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvcjogSVVudGl0bGVkVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiB1bmRlZmluZWQsIG9wdGlvbnM6IHsgb3ZlcnJpZGU6IFRFU1RfRURJVE9SX0lOUFVUX0lEIH0gfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvciwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZT8uaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/LmlucHV0LnJlc291cmNlLnNjaGVtZSwgJ3VudGl0bGVkJyk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IsIHVudHlwZWRFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdW50eXBlZCB1bnRpdGxlZCBlZGl0b3Igd2l0aCBhc3NvY2lhdGVkIHJlc291cmNlLCBubyBvcHRpb25zLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLW9yaWdpbmFsLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykud2l0aCh7IHNjaGVtZTogJ3VudGl0bGVkJyB9KSB9O1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0Y29uc3QgdHlwZWRFZGl0b3IgPSBwYW5lPy5pbnB1dDtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayh0eXBlZEVkaXRvciBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRFZGl0b3IucmVzb3VyY2Uuc2NoZW1lLCAndW50aXRsZWQnKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvciwgdW50eXBlZEVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHQvLyBvcGVuaW5nIHRoZSBzYW1lIGVkaXRvciBzaG91bGQgbm90IGNyZWF0ZVxuXHRcdFx0XHQvLyBhIG5ldyBlZGl0b3IgaW5wdXRcblx0XHRcdFx0YXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLmFjdGl2ZUVkaXRvciwgdHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgdW50aXRsZWQgZWRpdG9yLCBvcHRpb25zIChzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUpLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IHVuZGVmaW5lZCwgb3B0aW9uczogeyBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUsIG92ZXJyaWRlOiBURVNUX0VESVRPUl9JTlBVVF9JRCB9IH07XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHBhbmUuaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuaW5wdXQucmVzb3VyY2Uuc2NoZW1lLCAndW50aXRsZWQnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuZ3JvdXAuaXNTdGlja3kocGFuZS5pbnB1dCksIHRydWUpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yIGFzIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0KS5vcHRpb25zPy5wcmVzZXJ2ZUZvY3VzLCB0cnVlKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yIGFzIElVbnRpdGxlZFRleHRSZXNvdXJjZUVkaXRvcklucHV0KS5vcHRpb25zPy5zdGlja3ksIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBVbnR5cGVkIGRpZmZcblx0XHR7XG5cdFx0XHQvLyB1bnR5cGVkIGRpZmYgZWRpdG9yLCBubyBvcHRpb25zLCBubyBncm91cFxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yOiBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLW9yaWdpbmFsLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykgfSxcblx0XHRcdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUtbW9kaWZpZWQuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSB9LFxuXHRcdFx0XHRcdG9wdGlvbnM6IHsgb3ZlcnJpZGU6IFRFU1RfRURJVE9SX0lOUFVUX0lEIH1cblx0XHRcdFx0fTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcik7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gcGFuZT8uaW5wdXQ7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2sodHlwZWRFZGl0b3IgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDEpO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyB1bnR5cGVkIGRpZmYgZWRpdG9yLCBubyBvcHRpb25zLCBTSURFX0dST1VQXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3I6IElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCA9IHtcblx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUtb3JpZ2luYWwuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSB9LFxuXHRcdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS1tb2RpZmllZC5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpIH0sXG5cdFx0XHRcdFx0b3B0aW9uczogeyBvdmVycmlkZTogVEVTVF9FRElUT1JfSU5QVVRfSUQgfVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yLCBTSURFX0dST1VQKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZWRpdG9yR3JvdXBTZXJ2aWNlLmdyb3Vwcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0XHRcdGFzc2VydC5vayhwYW5lPy5pbnB1dCBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMSk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IsIHVudHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgZGlmZiBlZGl0b3IsIG9wdGlvbnMgKHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSksIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3I6IElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCA9IHtcblx0XHRcdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUtb3JpZ2luYWwuZWRpdG9yLXNlcnZpY2Utb3ZlcnJpZGUtdGVzdHMnKSB9LFxuXHRcdFx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS1tb2RpZmllZC5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpIH0sXG5cdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0b3ZlcnJpZGU6IFRFU1RfRURJVE9SX0lOUFVUX0lELCBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWVcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IHBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHBhbmUuaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmUuZ3JvdXAuaXNTdGlja3kocGFuZS5pbnB1dCksIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZEVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlmZkVkaXRvckZhY3RvcnlDYWxsZWQsIDEpO1xuXG5cdFx0XHRcdGFzc2VydC5vayghbGFzdEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RVbnRpdGxlZEVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yLCB1bnR5cGVkRWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IgYXMgSVVudGl0bGVkVGV4dFJlc291cmNlRWRpdG9ySW5wdXQpLm9wdGlvbnM/LnByZXNlcnZlRm9jdXMsIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGxhc3REaWZmRWRpdG9yRmFjdG9yeUVkaXRvciBhcyBJVW50aXRsZWRUZXh0UmVzb3VyY2VFZGl0b3JJbnB1dCkub3B0aW9ucz8uc3RpY2t5LCB0cnVlKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHR5cGVkIGVkaXRvciwgbm90IHJlZ2lzdGVyZWRcblx0XHR7XG5cblx0XHRcdC8vIG5vIG9wdGlvbnMsIG5vIGdyb3VwXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5zb21ldGhpbmcnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IgfSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dCwgdHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBubyBvcHRpb25zLCBTSURFX0dST1VQXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5zb21ldGhpbmcnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IgfSwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5ncm91cHMubGVuZ3RoLCAyKTtcblx0XHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZT8uaW5wdXQgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/LmlucHV0LCB0eXBlZEVkaXRvcik7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckZhY3RvcnlDYWxsZWQsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50aXRsZWRFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZFZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblxuXHRcdFx0XHRhc3NlcnQub2soIWxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdHlwZWQgZWRpdG9yLCBub3Qgc3VwcG9ydGluZyBgdG9VbnR5cGVkYFxuXHRcdHtcblxuXHRcdFx0Ly8gbm8gb3B0aW9ucywgbm8gZ3JvdXBcblx0XHRcdHtcblx0XHRcdFx0Y29uc3QgdHlwZWRFZGl0b3IgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5maWxlKCdmaWxlLnNvbWV0aGluZycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRcdHR5cGVkRWRpdG9yLmRpc2FibGVUb1VudHlwZWQgPSB0cnVlO1xuXHRcdFx0XHRjb25zdCBwYW5lID0gYXdhaXQgb3BlbkVkaXRvcih7IGVkaXRvcjogdHlwZWRFZGl0b3IgfSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQub2socGFuZS5pbnB1dCBpbnN0YW5jZW9mIFRlc3RGaWxlRWRpdG9ySW5wdXQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZS5pbnB1dCwgdHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyBubyBvcHRpb25zLCBTSURFX0dST1VQXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHR5cGVkRWRpdG9yID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkuZmlsZSgnZmlsZS5zb21ldGhpbmcnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0XHR0eXBlZEVkaXRvci5kaXNhYmxlVG9VbnR5cGVkID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IoeyBlZGl0b3I6IHR5cGVkRWRpdG9yIH0sIFNJREVfR1JPVVApO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5lZGl0b3JHcm91cFNlcnZpY2UuZ3JvdXBzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChwYW5lPy5ncm91cCwgcm9vdEdyb3VwKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHBhbmU/LmlucHV0IGluc3RhbmNlb2YgVGVzdEZpbGVFZGl0b3JJbnB1dCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYW5lPy5pbnB1dCwgdHlwZWRFZGl0b3IpO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdFVudGl0bGVkRWRpdG9yRmFjdG9yeUVkaXRvcik7XG5cdFx0XHRcdGFzc2VydC5vayghbGFzdERpZmZFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblxuXHRcdFx0XHRhd2FpdCByZXNldFRlc3RTdGF0ZSgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIG9wZW5FZGl0b3JzIHdpdGggPjEgZWRpdG9yXG5cdFx0aWYgKHVzZU9wZW5FZGl0b3JzKSB7XG5cblx0XHRcdC8vIG1peCBvZiB1bnR5cGVkIGFuZCB0eXBlZCBlZGl0b3JzXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3IxOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlMS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpIH07XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3IyOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlMi5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpIH07XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3IzOiBFZGl0b3JJbnB1dFdpdGhPcHRpb25zID0geyBlZGl0b3I6IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLmZpbGUoJ2ZpbGUzLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSB9O1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yNDogRWRpdG9ySW5wdXRXaXRoT3B0aW9ucyA9IHsgZWRpdG9yOiBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5maWxlKCdmaWxlNC5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfTtcblx0XHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvcjU6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGU1LmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykgfTtcblx0XHRcdFx0Y29uc3QgcGFuZSA9IChhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt1bnR5cGVkRWRpdG9yMSwgdW50eXBlZEVkaXRvcjIsIHVudHlwZWRFZGl0b3IzLCB1bnR5cGVkRWRpdG9yNCwgdW50eXBlZEVkaXRvcjVdKSlbMF07XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lmdyb3VwLCByb290R3JvdXApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8uZ3JvdXAuY291bnQsIDUpO1xuXG5cdFx0XHRcdC8vIE9ubHkgdGhlIHVudHlwZWQgZWRpdG9ycyBzaG91bGQgaGF2ZSBoYWQgZmFjdG9yaWVzIGNhbGxlZCAoMyB1bnR5cGVkIGVkaXRvcnMpXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JGYWN0b3J5Q2FsbGVkLCAzKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmRWRpdG9yRmFjdG9yeUNhbGxlZCwgMCk7XG5cblx0XHRcdFx0YXNzZXJ0Lm9rKGxhc3RFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0VW50aXRsZWRFZGl0b3JGYWN0b3J5RWRpdG9yKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCFsYXN0RGlmZkVkaXRvckZhY3RvcnlFZGl0b3IpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdW50eXBlZCBkZWZhdWx0IGVkaXRvclxuXHRcdHtcblx0XHRcdC8vIHVudHlwZWQgZGVmYXVsdCBlZGl0b3IsIG9wdGlvbnM6IHJldmVhbElmVmlzaWJsZVxuXHRcdFx0e1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yMTogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS0xJyksIG9wdGlvbnM6IHsgcmV2ZWFsSWZWaXNpYmxlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSB9O1xuXHRcdFx0XHRjb25zdCB1bnR5cGVkRWRpdG9yMjogSVJlc291cmNlRWRpdG9ySW5wdXQgPSB7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS0yJyksIG9wdGlvbnM6IHsgcGlubmVkOiB0cnVlIH0gfTtcblxuXHRcdFx0XHRjb25zdCByb290UGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcjEpO1xuXHRcdFx0XHRjb25zdCBzaWRlUGFuZSA9IGF3YWl0IG9wZW5FZGl0b3IodW50eXBlZEVkaXRvcjIsIFNJREVfR1JPVVApO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290UGFuZT8uZ3JvdXAuY291bnQsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2lkZVBhbmU/Lmdyb3VwLmNvdW50LCAxKTtcblxuXHRcdFx0XHRhY2Nlc3Nvci5lZGl0b3JHcm91cFNlcnZpY2UuYWN0aXZhdGVHcm91cChzaWRlUGFuZS5ncm91cCk7XG5cblx0XHRcdFx0YXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yMSk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvb3RQYW5lPy5ncm91cC5jb3VudCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaWRlUGFuZT8uZ3JvdXAuY291bnQsIDEpO1xuXG5cdFx0XHRcdGF3YWl0IHJlc2V0VGVzdFN0YXRlKCk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIHVudHlwZWQgZGVmYXVsdCBlZGl0b3IsIG9wdGlvbnM6IHJldmVhbElmT3BlbmVkXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnN0IHVudHlwZWRFZGl0b3IxOiBJUmVzb3VyY2VFZGl0b3JJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLTEnKSwgb3B0aW9uczogeyByZXZlYWxJZk9wZW5lZDogdHJ1ZSwgcGlubmVkOiB0cnVlIH0gfTtcblx0XHRcdFx0Y29uc3QgdW50eXBlZEVkaXRvcjI6IElSZXNvdXJjZUVkaXRvcklucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJ2ZpbGUtMicpLCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH07XG5cblx0XHRcdFx0Y29uc3Qgcm9vdFBhbmUgPSBhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IxKTtcblx0XHRcdFx0YXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yMik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290UGFuZT8uZ3JvdXAuYWN0aXZlRWRpdG9yPy5yZXNvdXJjZT8udG9TdHJpbmcoKSwgdW50eXBlZEVkaXRvcjIucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRcdGNvbnN0IHNpZGVQYW5lID0gYXdhaXQgb3BlbkVkaXRvcih1bnR5cGVkRWRpdG9yMiwgU0lERV9HUk9VUCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvb3RQYW5lPy5ncm91cC5jb3VudCwgMik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzaWRlUGFuZT8uZ3JvdXAuY291bnQsIDEpO1xuXG5cdFx0XHRcdGFjY2Vzc29yLmVkaXRvckdyb3VwU2VydmljZS5hY3RpdmF0ZUdyb3VwKHNpZGVQYW5lLmdyb3VwKTtcblxuXHRcdFx0XHRhd2FpdCBvcGVuRWRpdG9yKHVudHlwZWRFZGl0b3IxKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdFBhbmU/Lmdyb3VwLmNvdW50LCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNpZGVQYW5lPy5ncm91cC5jb3VudCwgMSk7XG5cblx0XHRcdFx0YXdhaXQgcmVzZXRUZXN0U3RhdGUoKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHR0ZXN0KCdvcGVuRWRpdG9yKCkgYXBwbGllcyBvcHRpb25zIGlmIGVkaXRvciBhbHJlYWR5IG9wZW5lZCcsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUZXN0RmlsZUVkaXRvcigpKTtcblxuXHRcdGNvbnN0IFssIHNlcnZpY2UsIGFjY2Vzc29yXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChhY2Nlc3Nvci5lZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycsXG5cdFx0XHR7IGlkOiBURVNUX0VESVRPUl9JTlBVVF9JRCwgbGFiZWw6ICdMYWJlbCcsIHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZXhjbHVzaXZlIH0sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6IGVkaXRvciA9PiAoeyBlZGl0b3I6IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoZWRpdG9yLnJlc291cmNlLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfSlcblx0XHRcdH1cblx0XHQpKTtcblxuXHRcdC8vIFR5cGVkIGVkaXRvclxuXHRcdGxldCBwYW5lID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLW9wZW5FZGl0b3JzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSk7XG5cdFx0cGFuZSA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCksIHsgc3RpY2t5OiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lm9wdGlvbnM/LnN0aWNreSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lm9wdGlvbnM/LnByZXNlcnZlRm9jdXMsIHRydWUpO1xuXG5cdFx0YXdhaXQgcGFuZS5ncm91cC5jbG9zZUFsbEVkaXRvcnMoKTtcblxuXHRcdC8vIFVudHlwZWQgZWRpdG9yICh3aXRob3V0IHJlZ2lzdGVyZWQgZWRpdG9yKVxuXHRcdHBhbmUgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogVVJJLmZpbGUoJ3Jlc291cmNlLW9wZW5FZGl0b3JzJykgfSk7XG5cdFx0cGFuZSA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBVUkkuZmlsZSgncmVzb3VyY2Utb3BlbkVkaXRvcnMnKSwgb3B0aW9uczogeyBzdGlja3k6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUgfSB9KTtcblxuXHRcdGFzc2VydC5vayhwYW5lIGluc3RhbmNlb2YgVGVzdFRleHRGaWxlRWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8ub3B0aW9ucz8uc3RpY2t5LCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFuZT8ub3B0aW9ucz8ucHJlc2VydmVGb2N1cywgdHJ1ZSk7XG5cblx0XHQvLyBVbnR5cGVkIGVkaXRvciAod2l0aCByZWdpc3RlcmVkIGVkaXRvcilcblx0XHRwYW5lID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKHsgcmVzb3VyY2U6IFVSSS5maWxlKCdmaWxlLmVkaXRvci1zZXJ2aWNlLW92ZXJyaWRlLXRlc3RzJykgfSk7XG5cdFx0cGFuZSA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcih7IHJlc291cmNlOiBVUkkuZmlsZSgnZmlsZS5lZGl0b3Itc2VydmljZS1vdmVycmlkZS10ZXN0cycpLCBvcHRpb25zOiB7IHN0aWNreTogdHJ1ZSwgcHJlc2VydmVGb2N1czogdHJ1ZSB9IH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lm9wdGlvbnM/LnN0aWNreSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhbmU/Lm9wdGlvbnM/LnByZXNlcnZlRm9jdXMsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc09wZW4oKSB3aXRoIHNpZGUgYnkgc2lkZSBlZGl0b3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgb3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0ID0gbmV3IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCgnc2lkZUJ5U2lkZScsICcnLCBpbnB1dCwgb3RoZXJJbnB1dCwgc2VydmljZSk7XG5cblx0XHRjb25zdCBlZGl0b3IxID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKHNpZGVCeVNpZGVJbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoaW5wdXQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQob3RoZXJJbnB1dCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IGlucHV0LnJlc291cmNlLCB0eXBlSWQ6IGlucHV0LnR5cGVJZCwgZWRpdG9ySWQ6IGlucHV0LmVkaXRvcklkIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogb3RoZXJJbnB1dC5yZXNvdXJjZSwgdHlwZUlkOiBvdGhlcklucHV0LnR5cGVJZCwgZWRpdG9ySWQ6IG90aGVySW5wdXQuZWRpdG9ySWQgfSksIHRydWUpO1xuXG5cdFx0Y29uc3QgZWRpdG9yMiA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoaW5wdXQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc09wZW5lZChvdGhlcklucHV0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogaW5wdXQucmVzb3VyY2UsIHR5cGVJZDogaW5wdXQudHlwZUlkLCBlZGl0b3JJZDogaW5wdXQuZWRpdG9ySWQgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IG90aGVySW5wdXQucmVzb3VyY2UsIHR5cGVJZDogb3RoZXJJbnB1dC50eXBlSWQsIGVkaXRvcklkOiBvdGhlcklucHV0LmVkaXRvcklkIH0pLCB0cnVlKTtcblxuXHRcdGF3YWl0IGVkaXRvcjI/Lmdyb3VwLmNsb3NlRWRpdG9yKGlucHV0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5jb3VudCwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc09wZW5lZChpbnB1dCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc09wZW5lZChvdGhlcklucHV0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoeyByZXNvdXJjZTogaW5wdXQucmVzb3VyY2UsIHR5cGVJZDogaW5wdXQudHlwZUlkLCBlZGl0b3JJZDogaW5wdXQuZWRpdG9ySWQgfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc09wZW5lZCh7IHJlc291cmNlOiBvdGhlcklucHV0LnJlc291cmNlLCB0eXBlSWQ6IG90aGVySW5wdXQudHlwZUlkLCBlZGl0b3JJZDogb3RoZXJJbnB1dC5lZGl0b3JJZCB9KSwgdHJ1ZSk7XG5cblx0XHRhd2FpdCBlZGl0b3IxPy5ncm91cC5jbG9zZUVkaXRvcihzaWRlQnlTaWRlSW5wdXQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoaW5wdXQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQob3RoZXJJbnB1dCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc09wZW5lZCh7IHJlc291cmNlOiBpbnB1dC5yZXNvdXJjZSwgdHlwZUlkOiBpbnB1dC50eXBlSWQsIGVkaXRvcklkOiBpbnB1dC5lZGl0b3JJZCB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmlzT3BlbmVkKHsgcmVzb3VyY2U6IG90aGVySW5wdXQucmVzb3VyY2UsIHR5cGVJZDogb3RoZXJJbnB1dC50eXBlSWQsIGVkaXRvcklkOiBvdGhlcklucHV0LmVkaXRvcklkIH0pLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3JzKCkgLyByZXBsYWNlRWRpdG9ycygpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2Utb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IHJlcGxhY2VJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMy1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHQvLyBPcGVuIGVkaXRvcnNcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQgfSwgeyBlZGl0b3I6IG90aGVySW5wdXQgfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmNvdW50LCAyKTtcblxuXHRcdC8vIFJlcGxhY2UgZWRpdG9yc1xuXHRcdGF3YWl0IHNlcnZpY2UucmVwbGFjZUVkaXRvcnMoW3sgZWRpdG9yOiBpbnB1dCwgcmVwbGFjZW1lbnQ6IHJlcGxhY2VJbnB1dCB9XSwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmdldEluZGV4T2ZFZGl0b3IocmVwbGFjZUlucHV0KSwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3JzKCkgaGFuZGxlcyB3b3Jrc3BhY2UgdHJ1c3QgKHR5cGVkIGVkaXRvcnMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTEtb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRjb25zdCBpbnB1dDMgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTMtb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IGlucHV0NCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlNC1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0ID0gbmV3IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCgnc2lkZSBieSBzaWRlJywgdW5kZWZpbmVkLCBpbnB1dDMsIGlucHV0NCwgc2VydmljZSk7XG5cblx0XHRjb25zdCBvbGRIYW5kbGVyID0gYWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyO1xuXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gVHJ1c3Q6IGNhbmNlbFxuXHRcdFx0bGV0IHRydXN0RWRpdG9yVXJpczogVVJJW10gPSBbXTtcblx0XHRcdGFjY2Vzc29yLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdE9wZW5VcmlzSGFuZGxlciA9IGFzeW5jIHVyaXMgPT4ge1xuXHRcdFx0XHR0cnVzdEVkaXRvclVyaXMgPSB1cmlzO1xuXHRcdFx0XHRyZXR1cm4gV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5DYW5jZWw7XG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQxIH0sIHsgZWRpdG9yOiBpbnB1dDIgfSwgeyBlZGl0b3I6IHNpZGVCeVNpZGVJbnB1dCB9XSwgdW5kZWZpbmVkLCB7IHZhbGlkYXRlVHJ1c3Q6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5jb3VudCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJ1c3RFZGl0b3JVcmlzLmxlbmd0aCwgNCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJ1c3RFZGl0b3JVcmlzLnNvbWUodXJpID0+IHVyaS50b1N0cmluZygpID09PSBpbnB1dDEucmVzb3VyY2UudG9TdHJpbmcoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRydXN0RWRpdG9yVXJpcy5zb21lKHVyaSA9PiB1cmkudG9TdHJpbmcoKSA9PT0gaW5wdXQyLnJlc291cmNlLnRvU3RyaW5nKCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cnVzdEVkaXRvclVyaXMuc29tZSh1cmkgPT4gdXJpLnRvU3RyaW5nKCkgPT09IGlucHV0My5yZXNvdXJjZS50b1N0cmluZygpKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHJ1c3RFZGl0b3JVcmlzLnNvbWUodXJpID0+IHVyaS50b1N0cmluZygpID09PSBpbnB1dDQucmVzb3VyY2UudG9TdHJpbmcoKSksIHRydWUpO1xuXG5cdFx0XHQvLyBUcnVzdDogb3BlbiBpbiBuZXcgd2luZG93XG5cdFx0XHRhY2Nlc3Nvci53b3Jrc3BhY2VUcnVzdFJlcXVlc3RTZXJ2aWNlLnJlcXVlc3RPcGVuVXJpc0hhbmRsZXIgPSBhc3luYyB1cmlzID0+IFdvcmtzcGFjZVRydXN0VXJpUmVzcG9uc2UuT3BlbkluTmV3V2luZG93O1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQxIH0sIHsgZWRpdG9yOiBpbnB1dDIgfSwgeyBlZGl0b3I6IHNpZGVCeVNpZGVJbnB1dCB9XSwgdW5kZWZpbmVkLCB7IHZhbGlkYXRlVHJ1c3Q6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5jb3VudCwgMCk7XG5cblx0XHRcdC8vIFRydXN0OiBhbGxvd1xuXHRcdFx0YWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gYXN5bmMgdXJpcyA9PiBXb3Jrc3BhY2VUcnVzdFVyaVJlc3BvbnNlLk9wZW47XG5cblx0XHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcnMoW3sgZWRpdG9yOiBpbnB1dDEgfSwgeyBlZGl0b3I6IGlucHV0MiB9LCB7IGVkaXRvcjogc2lkZUJ5U2lkZUlucHV0IH1dLCB1bmRlZmluZWQsIHsgdmFsaWRhdGVUcnVzdDogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmNvdW50LCAzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gb2xkSGFuZGxlcjtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3JzKCkgaWdub3JlcyB0cnVzdCB3aGVuIGB2YWxpZGF0ZVRydXN0OiBmYWxzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UxLW9wZW5FZGl0b3JzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0Y29uc3QgaW5wdXQzID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UzLW9wZW5FZGl0b3JzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCBpbnB1dDQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTQtb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IHNpZGVCeVNpZGVJbnB1dCA9IG5ldyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQoJ3NpZGUgYnkgc2lkZScsIHVuZGVmaW5lZCwgaW5wdXQzLCBpbnB1dDQsIHNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgb2xkSGFuZGxlciA9IGFjY2Vzc29yLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdE9wZW5VcmlzSGFuZGxlcjtcblxuXHRcdHRyeSB7XG5cblx0XHRcdC8vIFRydXN0OiBjYW5jZWxcblx0XHRcdGFjY2Vzc29yLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdE9wZW5VcmlzSGFuZGxlciA9IGFzeW5jIHVyaXMgPT4gV29ya3NwYWNlVHJ1c3RVcmlSZXNwb25zZS5DYW5jZWw7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcnMoW3sgZWRpdG9yOiBpbnB1dDEgfSwgeyBlZGl0b3I6IGlucHV0MiB9LCB7IGVkaXRvcjogc2lkZUJ5U2lkZUlucHV0IH1dKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmNvdW50LCAzKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gb2xkSGFuZGxlcjtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3JzKCkgZXh0cmFjdHMgcHJvcGVyIHJlc291cmNlcyBmcm9tIHVudHlwZWQgZWRpdG9ycyBmb3Igd29ya3NwYWNlIHRydXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFssIHNlcnZpY2UsIGFjY2Vzc29yXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IGlucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJ3Jlc291cmNlLW9wZW5FZGl0b3JzJykgfTtcblx0XHRjb25zdCBvdGhlcklucHV0OiBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuRWRpdG9ycycpIH0sXG5cdFx0XHRtb2RpZmllZDogeyByZXNvdXJjZTogVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMy1vcGVuRWRpdG9ycycpIH1cblx0XHR9O1xuXG5cdFx0Y29uc3Qgb2xkSGFuZGxlciA9IGFjY2Vzc29yLndvcmtzcGFjZVRydXN0UmVxdWVzdFNlcnZpY2UucmVxdWVzdE9wZW5VcmlzSGFuZGxlcjtcblxuXHRcdHRyeSB7XG5cdFx0XHRsZXQgdHJ1c3RFZGl0b3JVcmlzOiBVUklbXSA9IFtdO1xuXHRcdFx0YWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gYXN5bmMgdXJpcyA9PiB7XG5cdFx0XHRcdHRydXN0RWRpdG9yVXJpcyA9IHVyaXM7XG5cdFx0XHRcdHJldHVybiBvbGRIYW5kbGVyKHVyaXMpO1xuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9ycyhbaW5wdXQsIG90aGVySW5wdXRdLCB1bmRlZmluZWQsIHsgdmFsaWRhdGVUcnVzdDogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cnVzdEVkaXRvclVyaXMubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cnVzdEVkaXRvclVyaXMuc29tZSh1cmkgPT4gdXJpLnRvU3RyaW5nKCkgPT09IGlucHV0LnJlc291cmNlLnRvU3RyaW5nKCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cnVzdEVkaXRvclVyaXMuc29tZSh1cmkgPT4gdXJpLnRvU3RyaW5nKCkgPT09IG90aGVySW5wdXQub3JpZ2luYWwucmVzb3VyY2U/LnRvU3RyaW5nKCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0cnVzdEVkaXRvclVyaXMuc29tZSh1cmkgPT4gdXJpLnRvU3RyaW5nKCkgPT09IG90aGVySW5wdXQubW9kaWZpZWQucmVzb3VyY2U/LnRvU3RyaW5nKCkpLCB0cnVlKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0YWNjZXNzb3Iud29ya3NwYWNlVHJ1c3RSZXF1ZXN0U2VydmljZS5yZXF1ZXN0T3BlblVyaXNIYW5kbGVyID0gb2xkSGFuZGxlcjtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2Nsb3NlIGVkaXRvciBkb2VzIG5vdCBkaXNwb3NlIHdoZW4gZWRpdG9yIG9wZW5lZCBpbiBvdGhlciBncm91cCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWNsb3NlMScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXHRcdGNvbnN0IHJpZ2h0R3JvdXAgPSBwYXJ0LmFkZEdyb3VwKHJvb3RHcm91cCwgR3JvdXBEaXJlY3Rpb24uUklHSFQpO1xuXG5cdFx0Ly8gT3BlbiBpbnB1dFxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9LCByaWdodEdyb3VwKTtcblxuXHRcdGNvbnN0IGVkaXRvcnMgPSBzZXJ2aWNlLmVkaXRvcnM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yc1swXSwgaW5wdXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JzWzFdLCBpbnB1dCk7XG5cblx0XHQvLyBDbG9zZSBpbnB1dFxuXHRcdGF3YWl0IHJvb3RHcm91cC5jbG9zZUVkaXRvcihpbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LmlzRGlzcG9zZWQoKSwgZmFsc2UpO1xuXG5cdFx0YXdhaXQgcmlnaHRHcm91cC5jbG9zZUVkaXRvcihpbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LmlzRGlzcG9zZWQoKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW4gdG8gdGhlIHNpZGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UxLW9wZW5zaWRlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItb3BlbnNpZGUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0Y29uc3Qgcm9vdEdyb3VwID0gcGFydC5hY3RpdmVHcm91cDtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlIH0sIHJvb3RHcm91cCk7XG5cdFx0bGV0IGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0sIFNJREVfR1JPVVApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAsIHJvb3RHcm91cCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3I/Lmdyb3VwLCBwYXJ0Lmdyb3Vwc1sxXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5pc1Zpc2libGUoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNPcGVuZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cblx0XHQvLyBPcGVuIHRvIHRoZSBzaWRlIHVzZXMgZXhpc3RpbmcgbmVpZ2hib3VyIGdyb3VwIGlmIGFueVxuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlIH0sIFNJREVfR1JPVVApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLCByb290R3JvdXApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yPy5ncm91cCwgcGFydC5ncm91cHNbMV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaXNWaXNpYmxlKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmlzT3BlbmVkKGlucHV0MiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3IgZ3JvdXAgYWN0aXZhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTEtb3BlbnNpZGUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuc2lkZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSwgcm9vdEdyb3VwKTtcblx0XHRsZXQgZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uQUNUSVZBVEUgfSwgU0lERV9HUk9VUCk7XG5cdFx0Y29uc3Qgc2lkZUdyb3VwID0gZWRpdG9yPy5ncm91cDtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLCBzaWRlR3JvdXApO1xuXG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uUFJFU0VSVkUgfSwgcm9vdEdyb3VwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgc2lkZUdyb3VwKTtcblxuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCBhY3RpdmF0aW9uOiBFZGl0b3JBY3RpdmF0aW9uLkFDVElWQVRFIH0sIHJvb3RHcm91cCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAsIHJvb3RHcm91cCk7XG5cblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZhdGlvbjogRWRpdG9yQWN0aXZhdGlvbi5QUkVTRVJWRSB9LCBzaWRlR3JvdXApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLCByb290R3JvdXApO1xuXG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2YXRpb246IEVkaXRvckFjdGl2YXRpb24uQUNUSVZBVEUgfSwgc2lkZUdyb3VwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgc2lkZUdyb3VwKTtcblxuXHRcdHBhcnQuYXJyYW5nZUdyb3VwcyhHcm91cHNBcnJhbmdlbWVudC5FWFBBTkQpO1xuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBwcmVzZXJ2ZUZvY3VzOiB0cnVlLCBhY3RpdmF0aW9uOiBFZGl0b3JBY3RpdmF0aW9uLlJFU1RPUkUgfSwgcm9vdEdyb3VwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgc2lkZUdyb3VwKTtcblx0fSk7XG5cblx0dGVzdCgnaW5hY3RpdmUgZWRpdG9yIGdyb3VwIGRvZXMgbm90IGFjdGl2YXRlIHdoZW4gY2xvc2luZyBlZGl0b3IgKCMxMTc2ODYpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMS1vcGVuc2lkZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLW9wZW5zaWRlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblxuXHRcdGNvbnN0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9LCByb290R3JvdXApO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0sIHJvb3RHcm91cCk7XG5cblx0XHRjb25zdCBzaWRlR3JvdXAgPSAoYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUgfSwgU0lERV9HUk9VUCkpPy5ncm91cDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgc2lkZUdyb3VwKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocm9vdEdyb3VwLCBzaWRlR3JvdXApO1xuXG5cdFx0cGFydC5hcnJhbmdlR3JvdXBzKEdyb3Vwc0FycmFuZ2VtZW50LkVYUEFORCwgcGFydC5hY3RpdmVHcm91cCk7XG5cblx0XHRhd2FpdCByb290R3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cCwgc2lkZUdyb3VwKTtcblxuXHRcdGFzc2VydCghcGFydC5pc0dyb3VwRXhwYW5kZWQocm9vdEdyb3VwKSk7XG5cdFx0YXNzZXJ0KHBhcnQuaXNHcm91cEV4cGFuZGVkKHBhcnQuYWN0aXZlR3JvdXApKTtcblx0fSk7XG5cblx0dGVzdCgnYWN0aXZlIGVkaXRvciBjaGFuZ2UgLyB2aXNpYmxlIGVkaXRvciBjaGFuZ2UgZXZlbnRzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGxldCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0bGV0IG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblxuXHRcdGxldCBhY3RpdmVFZGl0b3JDaGFuZ2VFdmVudEZpcmVkID0gZmFsc2U7XG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yQ2hhbmdlTGlzdGVuZXIgPSBzZXJ2aWNlLm9uRGlkQWN0aXZlRWRpdG9yQ2hhbmdlKCgpID0+IHtcblx0XHRcdGFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50RmlyZWQgPSB0cnVlO1xuXHRcdH0pO1xuXG5cdFx0bGV0IHZpc2libGVFZGl0b3JDaGFuZ2VFdmVudEZpcmVkID0gZmFsc2U7XG5cdFx0Y29uc3QgdmlzaWJsZUVkaXRvckNoYW5nZUxpc3RlbmVyID0gc2VydmljZS5vbkRpZFZpc2libGVFZGl0b3JzQ2hhbmdlKCgpID0+IHtcblx0XHRcdHZpc2libGVFZGl0b3JDaGFuZ2VFdmVudEZpcmVkID0gdHJ1ZTtcblx0XHR9KTtcblxuXHRcdGZ1bmN0aW9uIGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChleHBlY3RlZDogYm9vbGVhbikge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50RmlyZWQsIGV4cGVjdGVkLCBgVW5leHBlY3RlZCBhY3RpdmUgZWRpdG9yIGNoYW5nZSBzdGF0ZSAoZ290ICR7YWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRGaXJlZH0sIGV4cGVjdGVkICR7ZXhwZWN0ZWR9KWApO1xuXHRcdFx0YWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRGaXJlZCA9IGZhbHNlO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KGV4cGVjdGVkOiBib29sZWFuKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50RmlyZWQsIGV4cGVjdGVkLCBgVW5leHBlY3RlZCB2aXNpYmxlIGVkaXRvcnMgY2hhbmdlIHN0YXRlIChnb3QgJHt2aXNpYmxlRWRpdG9yQ2hhbmdlRXZlbnRGaXJlZH0sIGV4cGVjdGVkICR7ZXhwZWN0ZWR9KWApO1xuXHRcdFx0dmlzaWJsZUVkaXRvckNoYW5nZUV2ZW50RmlyZWQgPSBmYWxzZTtcblx0XHR9XG5cblx0XHRhc3luYyBmdW5jdGlvbiBjbG9zZUVkaXRvckFuZFdhaXRGb3JOZXh0VG9PcGVuKGdyb3VwOiBJRWRpdG9yR3JvdXAsIGlucHV0OiBFZGl0b3JJbnB1dCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0YXdhaXQgZ3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQpO1xuXHRcdFx0YXdhaXQgdGltZW91dCgwKTsgLy8gY2xvc2luZyBhbiBlZGl0b3Igd2lsbCBub3QgaW1tZWRpYXRlbHkgb3BlbiB0aGUgbmV4dCBvbmUsIHNvIHdlIG5lZWQgdG8gd2FpdFxuXHRcdH1cblxuXHRcdC8vIDEuKSBvcGVuLCBvcGVuIHNhbWUsIG9wZW4gb3RoZXIsIGNsb3NlXG5cdFx0bGV0IGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Y29uc3QgZ3JvdXAgPSBlZGl0b3I/Lmdyb3VwITtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKG90aGVySW5wdXQpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGF3YWl0IGNsb3NlRWRpdG9yQW5kV2FpdEZvck5leHRUb09wZW4oZ3JvdXAsIG90aGVySW5wdXQpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGF3YWl0IGNsb3NlRWRpdG9yQW5kV2FpdEZvck5leHRUb09wZW4oZ3JvdXAsIGlucHV0KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHQvLyAyLikgb3Blbiwgb3BlbiBzYW1lIChmb3JjZWQgb3BlbikgKHJlY3JlYXRlIGlucHV0cyB0aGF0IGdvdCBkaXNwb3NlZClcblx0XHRpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0b3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IGZvcmNlUmVsb2FkOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgY2xvc2VFZGl0b3JBbmRXYWl0Rm9yTmV4dFRvT3Blbihncm91cCwgaW5wdXQpO1xuXG5cdFx0Ly8gMy4pIG9wZW4sIG9wZW4gaW5hY3RpdmUsIGNsb3NlIChyZWNyZWF0ZSBpbnB1dHMgdGhhdCBnb3QgZGlzcG9zZWQpXG5cdFx0aW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihvdGhlcklucHV0LCB7IGluYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0Ly8gNC4pIG9wZW4sIG9wZW4gaW5hY3RpdmUsIGNsb3NlIGluYWN0aXZlIChyZWNyZWF0ZSBpbnB1dHMgdGhhdCBnb3QgZGlzcG9zZWQpXG5cdFx0aW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihvdGhlcklucHV0LCB7IGluYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgY2xvc2VFZGl0b3JBbmRXYWl0Rm9yTmV4dFRvT3Blbihncm91cCwgb3RoZXJJbnB1dCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KGZhbHNlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudChmYWxzZSk7XG5cblx0XHRhd2FpdCBncm91cC5jbG9zZUFsbEVkaXRvcnMoKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHQvLyA1LikgYWRkIGdyb3VwLCByZW1vdmUgZ3JvdXAgKHJlY3JlYXRlIGlucHV0cyB0aGF0IGdvdCBkaXNwb3NlZClcblx0XHRpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0b3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0bGV0IHJpZ2h0R3JvdXAgPSBwYXJ0LmFkZEdyb3VwKHBhcnQuYWN0aXZlR3JvdXAsIEdyb3VwRGlyZWN0aW9uLlJJR0hUKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KGZhbHNlKTtcblxuXHRcdHJpZ2h0R3JvdXAuZm9jdXMoKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0cGFydC5yZW1vdmVHcm91cChyaWdodEdyb3VwKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0Ly8gNi4pIG9wZW4gZWRpdG9yIGluIGluYWN0aXZlIGdyb3VwIChyZWNyZWF0ZSBpbnB1dHMgdGhhdCBnb3QgZGlzcG9zZWQpXG5cdFx0aW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdHJpZ2h0R3JvdXAgPSBwYXJ0LmFkZEdyb3VwKHBhcnQuYWN0aXZlR3JvdXAsIEdyb3VwRGlyZWN0aW9uLlJJR0hUKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KGZhbHNlKTtcblxuXHRcdGF3YWl0IHJpZ2h0R3JvdXAub3BlbkVkaXRvcihvdGhlcklucHV0KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHRhd2FpdCBjbG9zZUVkaXRvckFuZFdhaXRGb3JOZXh0VG9PcGVuKHJpZ2h0R3JvdXAsIG90aGVySW5wdXQpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGF3YWl0IGdyb3VwLmNsb3NlQWxsRWRpdG9ycygpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdC8vIDcuKSBhY3RpdmF0ZSBncm91cCAocmVjcmVhdGUgaW5wdXRzIHRoYXQgZ290IGRpc3Bvc2VkKVxuXHRcdGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHRyaWdodEdyb3VwID0gcGFydC5hZGRHcm91cChwYXJ0LmFjdGl2ZUdyb3VwLCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KGZhbHNlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudChmYWxzZSk7XG5cblx0XHRhd2FpdCByaWdodEdyb3VwLm9wZW5FZGl0b3Iob3RoZXJJbnB1dCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0Z3JvdXAuZm9jdXMoKTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgY2xvc2VFZGl0b3JBbmRXYWl0Rm9yTmV4dFRvT3BlbihyaWdodEdyb3VwLCBvdGhlcklucHV0KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0Ly8gOC4pIG1vdmUgZWRpdG9yIChyZWNyZWF0ZSBpbnB1dHMgdGhhdCBnb3QgZGlzcG9zZWQpXG5cdFx0aW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudCh0cnVlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudCh0cnVlKTtcblxuXHRcdGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihvdGhlcklucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHRncm91cC5tb3ZlRWRpdG9yKG90aGVySW5wdXQsIGdyb3VwLCB7IGluZGV4OiAwIH0pO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQoZmFsc2UpO1xuXG5cdFx0YXdhaXQgZ3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0Ly8gOS4pIGNsb3NlIGVkaXRvciBpbiBpbmFjdGl2ZSBncm91cCAocmVjcmVhdGUgaW5wdXRzIHRoYXQgZ290IGRpc3Bvc2VkKVxuXHRcdGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0ZWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHRyaWdodEdyb3VwID0gcGFydC5hZGRHcm91cChwYXJ0LmFjdGl2ZUdyb3VwLCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KGZhbHNlKTtcblx0XHRhc3NlcnRWaXNpYmxlRWRpdG9yc0NoYW5nZWRFdmVudChmYWxzZSk7XG5cblx0XHRhd2FpdCByaWdodEdyb3VwLm9wZW5FZGl0b3Iob3RoZXJJbnB1dCk7XG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KHRydWUpO1xuXHRcdGFzc2VydFZpc2libGVFZGl0b3JzQ2hhbmdlZEV2ZW50KHRydWUpO1xuXG5cdFx0YXdhaXQgY2xvc2VFZGl0b3JBbmRXYWl0Rm9yTmV4dFRvT3Blbihncm91cCwgaW5wdXQpO1xuXHRcdGFzc2VydEFjdGl2ZUVkaXRvckNoYW5nZWRFdmVudChmYWxzZSk7XG5cdFx0YXNzZXJ0VmlzaWJsZUVkaXRvcnNDaGFuZ2VkRXZlbnQodHJ1ZSk7XG5cblx0XHQvLyBjbGVhbnVwXG5cdFx0YWN0aXZlRWRpdG9yQ2hhbmdlTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdHZpc2libGVFZGl0b3JDaGFuZ2VMaXN0ZW5lci5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VkaXRvcnMgY2hhbmdlIGV2ZW50JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXG5cdFx0bGV0IGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRsZXQgb3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1hY3RpdmUnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0bGV0IGVkaXRvcnNDaGFuZ2VFdmVudENvdW50ZXIgPSAwO1xuXHRcdGFzeW5jIGZ1bmN0aW9uIGFzc2VydEVkaXRvcnNDaGFuZ2VFdmVudChmbjogKCkgPT4gUHJvbWlzZTx1bmtub3duPiwgZXhwZWN0ZWQ6IG51bWJlcikge1xuXHRcdFx0Y29uc3QgcCA9IEV2ZW50LnRvUHJvbWlzZShzZXJ2aWNlLm9uRGlkRWRpdG9yc0NoYW5nZSk7XG5cdFx0XHRhd2FpdCBmbigpO1xuXHRcdFx0YXdhaXQgcDtcblx0XHRcdGVkaXRvcnNDaGFuZ2VFdmVudENvdW50ZXIrKztcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvcnNDaGFuZ2VFdmVudENvdW50ZXIsIGV4cGVjdGVkKTtcblx0XHR9XG5cblx0XHQvLyBvcGVuXG5cdFx0YXdhaXQgYXNzZXJ0RWRpdG9yc0NoYW5nZUV2ZW50KCgpID0+IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUgfSksIDEpO1xuXG5cdFx0Ly8gb3BlbiAob3RoZXIpXG5cdFx0YXdhaXQgYXNzZXJ0RWRpdG9yc0NoYW5nZUV2ZW50KCgpID0+IHNlcnZpY2Uub3BlbkVkaXRvcihvdGhlcklucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KSwgMik7XG5cblx0XHQvLyBjbG9zZSAoaW5hY3RpdmUpXG5cdFx0YXdhaXQgYXNzZXJ0RWRpdG9yc0NoYW5nZUV2ZW50KCgpID0+IHJvb3RHcm91cC5jbG9zZUVkaXRvcihpbnB1dCksIDMpO1xuXG5cdFx0Ly8gY2xvc2UgKGFjdGl2ZSlcblx0XHRhd2FpdCBhc3NlcnRFZGl0b3JzQ2hhbmdlRXZlbnQoKCkgPT4gcm9vdEdyb3VwLmNsb3NlRWRpdG9yKG90aGVySW5wdXQpLCA0KTtcblxuXHRcdGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtYWN0aXZlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHQvLyBvcGVuIGVkaXRvcnNcblx0XHRhd2FpdCBhc3NlcnRFZGl0b3JzQ2hhbmdlRXZlbnQoKCkgPT4gc2VydmljZS5vcGVuRWRpdG9ycyhbeyBlZGl0b3I6IGlucHV0LCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH0sIHsgZWRpdG9yOiBvdGhlcklucHV0LCBvcHRpb25zOiB7IHBpbm5lZDogdHJ1ZSB9IH1dKSwgNSk7XG5cblx0XHQvLyBhY3RpdmUgZWRpdG9yIGNoYW5nZVxuXHRcdGF3YWl0IGFzc2VydEVkaXRvcnNDaGFuZ2VFdmVudCgoKSA9PiBzZXJ2aWNlLm9wZW5FZGl0b3Iob3RoZXJJbnB1dCksIDYpO1xuXG5cdFx0Ly8gbW92ZSBlZGl0b3IgKGluIGdyb3VwKVxuXHRcdGF3YWl0IGFzc2VydEVkaXRvcnNDaGFuZ2VFdmVudCgoKSA9PiBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlLCBpbmRleDogMSB9KSwgNyk7XG5cblx0XHRjb25zdCByaWdodEdyb3VwID0gcGFydC5hZGRHcm91cChwYXJ0LmFjdGl2ZUdyb3VwLCBHcm91cERpcmVjdGlvbi5SSUdIVCk7XG5cdFx0YXdhaXQgYXNzZXJ0RWRpdG9yc0NoYW5nZUV2ZW50KGFzeW5jICgpID0+IHJvb3RHcm91cC5tb3ZlRWRpdG9yKGlucHV0LCByaWdodEdyb3VwKSwgOCk7XG5cblx0XHQvLyBtb3ZlIGdyb3VwXG5cdFx0YXdhaXQgYXNzZXJ0RWRpdG9yc0NoYW5nZUV2ZW50KGFzeW5jICgpID0+IHBhcnQubW92ZUdyb3VwKHJpZ2h0R3JvdXAsIHJvb3RHcm91cCwgR3JvdXBEaXJlY3Rpb24uTEVGVCksIDkpO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gYWN0aXZlIGVkaXRvciBjaGFuZ2UgZXZlbnRzIHdoZW4gb3BlbmluZyBlZGl0b3IgdG8gdGhlIHNpZGUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgWywgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRsZXQgYWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRzID0gMDtcblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDaGFuZ2VMaXN0ZW5lciA9IHNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0YWN0aXZlRWRpdG9yQ2hhbmdlRXZlbnRzKys7XG5cdFx0fSk7XG5cblx0XHRmdW5jdGlvbiBhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQoZXhwZWN0ZWQ6IG51bWJlcikge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50cywgZXhwZWN0ZWQsIGBVbmV4cGVjdGVkIGFjdGl2ZSBlZGl0b3IgY2hhbmdlIHN0YXRlIChnb3QgJHthY3RpdmVFZGl0b3JDaGFuZ2VFdmVudHN9LCBleHBlY3RlZCAke2V4cGVjdGVkfSlgKTtcblx0XHRcdGFjdGl2ZUVkaXRvckNoYW5nZUV2ZW50cyA9IDA7XG5cdFx0fVxuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnRBY3RpdmVFZGl0b3JDaGFuZ2VkRXZlbnQoMSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0sIFNJREVfR1JPVVApO1xuXG5cdFx0Ly8gd2UgZXhwZWN0IDIgYWN0aXZlIGVkaXRvciBjaGFuZ2UgZXZlbnRzOiBvbmUgZm9yIHRoZSBmYWN0IHRoYXQgdGhlXG5cdFx0Ly8gYWN0aXZlIGVkaXRvciBpcyBub3cgaW4gdGhlIHNpZGUgZ3JvdXAgYnV0IGFsc28gb25lIGZvciB3aGVuIHRoZVxuXHRcdC8vIGVkaXRvciBoYXMgZmluaXNoZWQgbG9hZGluZy4gd2UgdXNlZCB0byBpZ25vcmUgdGhhdCBzZWNvbmQgY2hhbmdlXG5cdFx0Ly8gZXZlbnQsIGhvd2V2ZXIgbWFueSBsaXN0ZW5lcnMgYXJlIGludGVyZXN0ZWQgb24gdGhlIGFjdGl2ZSBlZGl0b3Jcblx0XHQvLyB3aGVuIGl0IGhhcyBmdWxseSBsb2FkZWQgKGUuZy4gYSBtb2RlbCBpcyBzZXQpLiBhcyBzdWNoLCB3ZSBjYW5ub3Rcblx0XHQvLyBzaW1wbHkgaWdub3JlIHRoYXQgc2Vjb25kIGV2ZW50IGZyb20gdGhlIGVkaXRvciBzZXJ2aWNlLCBldmVuIHRob3VnaFxuXHRcdC8vIHRoZSBhY3R1YWwgZWRpdG9yIGlucHV0IGlzIHRoZSBzYW1lXG5cdFx0YXNzZXJ0QWN0aXZlRWRpdG9yQ2hhbmdlZEV2ZW50KDIpO1xuXG5cdFx0Ly8gY2xlYW51cFxuXHRcdGFjdGl2ZUVkaXRvckNoYW5nZUxpc3RlbmVyLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnYWN0aXZlVGV4dEVkaXRvckNvbnRyb2wgLyBhY3RpdmVUZXh0RWRpdG9yTW9kZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbLCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdC8vIE9wZW4gdW50aXRsZWQgaW5wdXRcblx0XHRjb25zdCBlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZTogdW5kZWZpbmVkIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuYWN0aXZlRWRpdG9yUGFuZSwgZWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCwgZWRpdG9yPy5nZXRDb250cm9sKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmFjdGl2ZVRleHRFZGl0b3JMYW5ndWFnZUlkLCBQTEFJTlRFWFRfTEFOR1VBR0VfSUQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvcGVuRWRpdG9yIHJldHVybnMgdW5kZWZpbmVkIHdoZW4gaW5hY3RpdmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgWywgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgb3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1pbmFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5vayhlZGl0b3IpO1xuXG5cdFx0Y29uc3Qgb3RoZXJFZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3Iob3RoZXJJbnB1dCwgeyBpbmFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQub2soIW90aGVyRWRpdG9yKTtcblx0fSk7XG5cblx0dGVzdCgnb3BlbkVkaXRvciBzaG93cyBwbGFjZWhvbGRlciB3aGVuIG9wZW5pbmcgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgWywgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBmYWlsaW5nSW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1mYWlsaW5nJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRmYWlsaW5nSW5wdXQuc2V0RmFpbFRvT3BlbigpO1xuXG5cdFx0Y29uc3QgZmFpbGluZ0VkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihmYWlsaW5nSW5wdXQpO1xuXHRcdGFzc2VydC5vayhmYWlsaW5nRWRpdG9yIGluc3RhbmNlb2YgRXJyb3JQbGFjZWhvbGRlckVkaXRvcik7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3Igc2hvd3MgcGxhY2Vob2xkZXIgd2hlbiByZXN0b3JpbmcgZmFpbHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgWywgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWFjdGl2ZScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3QgZmFpbGluZ0lucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtZmFpbGluZycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihmYWlsaW5nSW5wdXQsIHsgaW5hY3RpdmU6IHRydWUgfSk7XG5cblx0XHRmYWlsaW5nSW5wdXQuc2V0RmFpbFRvT3BlbigpO1xuXHRcdGNvbnN0IGZhaWxpbmdFZGl0b3IgPSBhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoZmFpbGluZ0lucHV0KTtcblx0XHRhc3NlcnQub2soZmFpbGluZ0VkaXRvciBpbnN0YW5jZW9mIEVycm9yUGxhY2Vob2xkZXJFZGl0b3IpO1xuXHR9KTtcblxuXHR0ZXN0KCdzYXZlLCBzYXZlQWxsLCByZXZlcnRBbGwnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UxJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRpbnB1dDEuZGlydHkgPSB0cnVlO1xuXHRcdGNvbnN0IGlucHV0MiA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMicpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0aW5wdXQyLmRpcnR5ID0gdHJ1ZTtcblx0XHRjb25zdCBzYW1lSW5wdXQxID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UxJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRzYW1lSW5wdXQxLmRpcnR5ID0gdHJ1ZTtcblxuXHRcdGNvbnN0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3Ioc2FtZUlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSwgU0lERV9HUk9VUCk7XG5cblx0XHRjb25zdCByZXMxID0gYXdhaXQgc2VydmljZS5zYXZlKHsgZ3JvdXBJZDogcm9vdEdyb3VwLmlkLCBlZGl0b3I6IGlucHV0MSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzMS5zdWNjZXNzLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzMS5lZGl0b3JzWzBdLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDEuZ290U2F2ZWQsIHRydWUpO1xuXG5cdFx0aW5wdXQxLmdvdFNhdmVkID0gZmFsc2U7XG5cdFx0aW5wdXQxLmdvdFNhdmVkQXMgPSBmYWxzZTtcblx0XHRpbnB1dDEuZ290UmV2ZXJ0ZWQgPSBmYWxzZTtcblxuXHRcdGlucHV0MS5kaXJ0eSA9IHRydWU7XG5cdFx0aW5wdXQyLmRpcnR5ID0gdHJ1ZTtcblx0XHRzYW1lSW5wdXQxLmRpcnR5ID0gdHJ1ZTtcblxuXHRcdGNvbnN0IHJlczIgPSBhd2FpdCBzZXJ2aWNlLnNhdmUoeyBncm91cElkOiByb290R3JvdXAuaWQsIGVkaXRvcjogaW5wdXQxIH0sIHsgc2F2ZUFzOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMyLnN1Y2Nlc3MsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMyLmVkaXRvcnNbMF0sIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MS5nb3RTYXZlZEFzLCB0cnVlKTtcblxuXHRcdGlucHV0MS5nb3RTYXZlZCA9IGZhbHNlO1xuXHRcdGlucHV0MS5nb3RTYXZlZEFzID0gZmFsc2U7XG5cdFx0aW5wdXQxLmdvdFJldmVydGVkID0gZmFsc2U7XG5cblx0XHRpbnB1dDEuZGlydHkgPSB0cnVlO1xuXHRcdGlucHV0Mi5kaXJ0eSA9IHRydWU7XG5cdFx0c2FtZUlucHV0MS5kaXJ0eSA9IHRydWU7XG5cblx0XHRjb25zdCByZXZlcnRSZXMgPSBhd2FpdCBzZXJ2aWNlLnJldmVydEFsbCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXZlcnRSZXMsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDEuZ290UmV2ZXJ0ZWQsIHRydWUpO1xuXG5cdFx0aW5wdXQxLmdvdFNhdmVkID0gZmFsc2U7XG5cdFx0aW5wdXQxLmdvdFNhdmVkQXMgPSBmYWxzZTtcblx0XHRpbnB1dDEuZ290UmV2ZXJ0ZWQgPSBmYWxzZTtcblxuXHRcdGlucHV0MS5kaXJ0eSA9IHRydWU7XG5cdFx0aW5wdXQyLmRpcnR5ID0gdHJ1ZTtcblx0XHRzYW1lSW5wdXQxLmRpcnR5ID0gdHJ1ZTtcblxuXHRcdGNvbnN0IHJlczMgPSBhd2FpdCBzZXJ2aWNlLnNhdmVBbGwoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzMy5zdWNjZXNzLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzMy5lZGl0b3JzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MS5nb3RTYXZlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Mi5nb3RTYXZlZCwgdHJ1ZSk7XG5cblx0XHRpbnB1dDEuZ290U2F2ZWQgPSBmYWxzZTtcblx0XHRpbnB1dDEuZ290U2F2ZWRBcyA9IGZhbHNlO1xuXHRcdGlucHV0MS5nb3RSZXZlcnRlZCA9IGZhbHNlO1xuXHRcdGlucHV0Mi5nb3RTYXZlZCA9IGZhbHNlO1xuXHRcdGlucHV0Mi5nb3RTYXZlZEFzID0gZmFsc2U7XG5cdFx0aW5wdXQyLmdvdFJldmVydGVkID0gZmFsc2U7XG5cblx0XHRpbnB1dDEuZGlydHkgPSB0cnVlO1xuXHRcdGlucHV0Mi5kaXJ0eSA9IHRydWU7XG5cdFx0c2FtZUlucHV0MS5kaXJ0eSA9IHRydWU7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLnNhdmVBbGwoeyBzYXZlQXM6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQxLmdvdFNhdmVkQXMsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDIuZ290U2F2ZWRBcywgdHJ1ZSk7XG5cblx0XHQvLyBzZXJ2aWNlcyBkZWR1cGVzIGlucHV0cyBhdXRvbWF0aWNhbGx5XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbWVJbnB1dDEuZ290U2F2ZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2FtZUlucHV0MS5nb3RTYXZlZEFzLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbWVJbnB1dDEuZ290UmV2ZXJ0ZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZUFsbCwgcmV2ZXJ0QWxsIChzdGlja3kgZWRpdG9yKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBbLCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0aW5wdXQxLmRpcnR5ID0gdHJ1ZTtcblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTInKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGlucHV0Mi5kaXJ0eSA9IHRydWU7XG5cdFx0Y29uc3Qgc2FtZUlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0c2FtZUlucHV0MS5kaXJ0eSA9IHRydWU7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihzYW1lSW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9LCBTSURFX0dST1VQKTtcblxuXHRcdGNvbnN0IHJldmVydFJlcyA9IGF3YWl0IHNlcnZpY2UucmV2ZXJ0QWxsKHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmV2ZXJ0UmVzLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQxLmdvdFJldmVydGVkLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNhbWVJbnB1dDEuZ290UmV2ZXJ0ZWQsIHRydWUpO1xuXG5cdFx0aW5wdXQxLmdvdFNhdmVkID0gZmFsc2U7XG5cdFx0aW5wdXQxLmdvdFNhdmVkQXMgPSBmYWxzZTtcblx0XHRpbnB1dDEuZ290UmV2ZXJ0ZWQgPSBmYWxzZTtcblxuXHRcdHNhbWVJbnB1dDEuZ290U2F2ZWQgPSBmYWxzZTtcblx0XHRzYW1lSW5wdXQxLmdvdFNhdmVkQXMgPSBmYWxzZTtcblx0XHRzYW1lSW5wdXQxLmdvdFJldmVydGVkID0gZmFsc2U7XG5cblx0XHRpbnB1dDEuZGlydHkgPSB0cnVlO1xuXHRcdGlucHV0Mi5kaXJ0eSA9IHRydWU7XG5cdFx0c2FtZUlucHV0MS5kaXJ0eSA9IHRydWU7XG5cblx0XHRjb25zdCBzYXZlUmVzID0gYXdhaXQgc2VydmljZS5zYXZlQWxsKHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZVJlcy5zdWNjZXNzLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2F2ZVJlcy5lZGl0b3JzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MS5nb3RTYXZlZCwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDIuZ290U2F2ZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYW1lSW5wdXQxLmdvdFNhdmVkLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnc2F2ZUFsbCwgcmV2ZXJ0QWxsIHVudGl0bGVkIChleGNsdWRlIHVudGl0bGVkKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB0ZXN0U2F2ZVJldmVydFVudGl0bGVkKHt9LCBmYWxzZSwgZmFsc2UpO1xuXHRcdGF3YWl0IHRlc3RTYXZlUmV2ZXJ0VW50aXRsZWQoeyBpbmNsdWRlVW50aXRsZWQ6IGZhbHNlIH0sIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVBbGwsIHJldmVydEFsbCB1bnRpdGxlZCAoaW5jbHVkZSB1bnRpdGxlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgdGVzdFNhdmVSZXZlcnRVbnRpdGxlZCh7IGluY2x1ZGVVbnRpdGxlZDogdHJ1ZSB9LCB0cnVlLCBmYWxzZSk7XG5cdFx0YXdhaXQgdGVzdFNhdmVSZXZlcnRVbnRpdGxlZCh7IGluY2x1ZGVVbnRpdGxlZDogeyBpbmNsdWRlU2NyYXRjaHBhZDogZmFsc2UgfSB9LCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmVBbGwsIHJldmVydEFsbCB1bnRpdGxlZCAoaW5jbHVkZSBzY3JhdGNocGFkKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB0ZXN0U2F2ZVJldmVydFVudGl0bGVkKHsgaW5jbHVkZVVudGl0bGVkOiB7IGluY2x1ZGVTY3JhdGNocGFkOiB0cnVlIH0gfSwgdHJ1ZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RTYXZlUmV2ZXJ0VW50aXRsZWQob3B0aW9uczogSUJhc2VTYXZlUmV2ZXJ0QWxsRWRpdG9yT3B0aW9ucywgZXhwZWN0VW50aXRsZWQ6IGJvb2xlYW4sIGV4cGVjdFNjcmF0Y2hwYWQ6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBbLCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTEnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGlucHV0MS5kaXJ0eSA9IHRydWU7XG5cdFx0Y29uc3QgdW50aXRsZWRJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMicpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0dW50aXRsZWRJbnB1dC5kaXJ0eSA9IHRydWU7XG5cdFx0dW50aXRsZWRJbnB1dC5jYXBhYmlsaXRpZXMgPSBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZDtcblx0XHRjb25zdCBzY3JhdGNocGFkSW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdHNjcmF0Y2hwYWRJbnB1dC5tb2RpZmllZCA9IHRydWU7XG5cdFx0c2NyYXRjaHBhZElucHV0LmNhcGFiaWxpdGllcyA9IEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlNjcmF0Y2hwYWQgfCBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZDtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKHVudGl0bGVkSW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihzY3JhdGNocGFkSW5wdXQsIHsgcGlubmVkOiB0cnVlIH0pO1xuXG5cdFx0Y29uc3QgcmV2ZXJ0UmVzID0gYXdhaXQgc2VydmljZS5yZXZlcnRBbGwob3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJldmVydFJlcywgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MS5nb3RSZXZlcnRlZCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudGl0bGVkSW5wdXQuZ290UmV2ZXJ0ZWQsIGV4cGVjdFVudGl0bGVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2NyYXRjaHBhZElucHV0LmdvdFJldmVydGVkLCBleHBlY3RTY3JhdGNocGFkKTtcblxuXHRcdGlucHV0MS5nb3RTYXZlZCA9IGZhbHNlO1xuXHRcdHVudGl0bGVkSW5wdXQuZ290U2F2ZWRBcyA9IGZhbHNlO1xuXHRcdHNjcmF0Y2hwYWRJbnB1dC5nb3RSZXZlcnRlZCA9IGZhbHNlO1xuXG5cdFx0aW5wdXQxLmdvdFNhdmVkID0gZmFsc2U7XG5cdFx0dW50aXRsZWRJbnB1dC5nb3RTYXZlZEFzID0gZmFsc2U7XG5cdFx0c2NyYXRjaHBhZElucHV0LmdvdFJldmVydGVkID0gZmFsc2U7XG5cblx0XHRpbnB1dDEuZGlydHkgPSB0cnVlO1xuXHRcdHVudGl0bGVkSW5wdXQuZGlydHkgPSB0cnVlO1xuXHRcdHNjcmF0Y2hwYWRJbnB1dC5tb2RpZmllZCA9IHRydWU7XG5cblx0XHRjb25zdCBzYXZlUmVzID0gYXdhaXQgc2VydmljZS5zYXZlQWxsKG9wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlUmVzLnN1Y2Nlc3MsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzYXZlUmVzLmVkaXRvcnMubGVuZ3RoLCBleHBlY3RTY3JhdGNocGFkID8gMyA6IGV4cGVjdFVudGl0bGVkID8gMiA6IDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDEuZ290U2F2ZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZElucHV0LmdvdFNhdmVkLCBleHBlY3RVbnRpdGxlZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNjcmF0Y2hwYWRJbnB1dC5nb3RTYXZlZCwgZXhwZWN0U2NyYXRjaHBhZCk7XG5cdH1cblxuXHR0ZXN0KCdmaWxlIGRlbGV0ZSBjbG9zZXMgZWRpdG9yJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdHJldHVybiB0ZXN0RmlsZURlbGV0ZUVkaXRvckNsb3NlKGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsZSBkZWxldGUgbGVhdmVzIGRpcnR5IGVkaXRvcnMgb3BlbicsIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGVzdEZpbGVEZWxldGVFZGl0b3JDbG9zZSh0cnVlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdEZpbGVEZWxldGVFZGl0b3JDbG9zZShkaXJ0eTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTEnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGlucHV0MS5kaXJ0eSA9IGRpcnR5O1xuXHRcdGNvbnN0IGlucHV0MiA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMicpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0aW5wdXQyLmRpcnR5ID0gZGlydHk7XG5cblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdEdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQyKTtcblxuXHRcdGNvbnN0IGFjdGl2ZUVkaXRvckNoYW5nZVByb21pc2UgPSBhd2FpdEFjdGl2ZUVkaXRvckNoYW5nZShzZXJ2aWNlKTtcblx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5maXJlQWZ0ZXJPcGVyYXRpb24obmV3IEZpbGVPcGVyYXRpb25FdmVudChpbnB1dDIucmVzb3VyY2UsIEZpbGVPcGVyYXRpb24uREVMRVRFKSk7XG5cdFx0aWYgKCFkaXJ0eSkge1xuXHRcdFx0YXdhaXQgYWN0aXZlRWRpdG9yQ2hhbmdlUHJvbWlzZTtcblx0XHR9XG5cblx0XHRpZiAoZGlydHkpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290R3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDIpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdEdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQxKTtcblx0XHR9XG5cdH1cblxuXHR0ZXN0KCdmaWxlIG1vdmUgYXNrcyBpbnB1dCB0byBtb3ZlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTEnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IG1vdmVkSW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTInKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGlucHV0MS5tb3ZlZEVkaXRvciA9IHsgZWRpdG9yOiBtb3ZlZElucHV0IH07XG5cblx0XHRjb25zdCByb290R3JvdXAgPSBwYXJ0LmFjdGl2ZUdyb3VwO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRjb25zdCBhY3RpdmVFZGl0b3JDaGFuZ2VQcm9taXNlID0gYXdhaXRBY3RpdmVFZGl0b3JDaGFuZ2Uoc2VydmljZSk7XG5cdFx0YWNjZXNzb3IuZmlsZVNlcnZpY2UuZmlyZUFmdGVyT3BlcmF0aW9uKG5ldyBGaWxlT3BlcmF0aW9uRXZlbnQoaW5wdXQxLnJlc291cmNlLCBGaWxlT3BlcmF0aW9uLk1PVkUsIHtcblx0XHRcdHJlc291cmNlOiBtb3ZlZElucHV0LnJlc291cmNlLFxuXHRcdFx0Y3RpbWU6IDAsXG5cdFx0XHRldGFnOiAnJyxcblx0XHRcdGlzRGlyZWN0b3J5OiBmYWxzZSxcblx0XHRcdGlzRmlsZTogdHJ1ZSxcblx0XHRcdG10aW1lOiAwLFxuXHRcdFx0bmFtZTogJ3Jlc291cmNlMicsXG5cdFx0XHRzaXplOiAwLFxuXHRcdFx0aXNTeW1ib2xpY0xpbms6IGZhbHNlLFxuXHRcdFx0cmVhZG9ubHk6IGZhbHNlLFxuXHRcdFx0bG9ja2VkOiBmYWxzZSxcblx0XHRcdGNoaWxkcmVuOiB1bmRlZmluZWRcblx0XHR9KSk7XG5cdFx0YXdhaXQgYWN0aXZlRWRpdG9yQ2hhbmdlUHJvbWlzZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290R3JvdXAuYWN0aXZlRWRpdG9yLCBtb3ZlZElucHV0KTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gYXdhaXRBY3RpdmVFZGl0b3JDaGFuZ2UoZWRpdG9yU2VydmljZTogSUVkaXRvclNlcnZpY2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gRXZlbnQudG9Qcm9taXNlKEV2ZW50Lm9uY2UoZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSkpO1xuXHR9XG5cblx0dGVzdCgnZmlsZSB3YXRjaGVyIGdldHMgaW5zdGFsbGVkIGZvciBvdXQgb2Ygd29ya3NwYWNlIGZpbGVzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IFssIHNlcnZpY2UsIGFjY2Vzc29yXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UxJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlMicpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZmlsZVNlcnZpY2Uud2F0Y2hlcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5maWxlU2VydmljZS53YXRjaGVzWzBdLnRvU3RyaW5nKCksIGlucHV0MS5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY2Nlc3Nvci5maWxlU2VydmljZS53YXRjaGVzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjY2Vzc29yLmZpbGVTZXJ2aWNlLndhdGNoZXNbMF0udG9TdHJpbmcoKSwgaW5wdXQyLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0YXdhaXQgZWRpdG9yPy5ncm91cC5jbG9zZUFsbEVkaXRvcnMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWNjZXNzb3IuZmlsZVNlcnZpY2Uud2F0Y2hlcy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdhY3RpdmVFZGl0b3JQYW5lIHNjb3BlZENvbnRleHRLZXlTZXJ2aWNlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UoeyBjb250ZXh0S2V5U2VydmljZTogaW5zdGFudGlhdGlvblNlcnZpY2UgPT4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTW9ja1Njb3BhYmxlQ29udGV4dEtleVNlcnZpY2UpIH0sIGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdmaWxlOi8vcmVzb3VyY2UxJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnZmlsZTovL3Jlc291cmNlMicpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGNvbnN0IGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlID0gc2VydmljZS5hY3RpdmVFZGl0b3JQYW5lPy5zY29wZWRDb250ZXh0S2V5U2VydmljZTtcblx0XHRhc3NlcnQub2soISFlZGl0b3JDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvbnRleHRLZXlTZXJ2aWNlLCBwYXJ0LmFjdGl2ZUdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LnNjb3BlZENvbnRleHRLZXlTZXJ2aWNlKTtcblx0fSk7XG5cblx0dGVzdCgnZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIC0gb3BlbkVkaXRvcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBbLCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlID0gYWNjZXNzb3IuZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlO1xuXHRcdGNvbnN0IHRleHRFZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IudGV4dEVkaXRvclNlcnZpY2U7XG5cblx0XHRsZXQgZWRpdG9yQ291bnQgPSAwO1xuXG5cdFx0Y29uc3QgcmVnaXN0cmF0aW9uRGlzcG9zYWJsZSA9IGVkaXRvclJlc29sdmVyU2VydmljZS5yZWdpc3RlckVkaXRvcihcblx0XHRcdCcqLm1kJyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdUZXN0RWRpdG9yJyxcblx0XHRcdFx0bGFiZWw6ICdUZXN0IEVkaXRvcicsXG5cdFx0XHRcdGRldGFpbDogJ1Rlc3QgRWRpdG9yIFByb3ZpZGVyJyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5idWlsdGluXG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoZWRpdG9ySW5wdXQpID0+IHtcblx0XHRcdFx0XHRlZGl0b3JDb3VudCsrO1xuXHRcdFx0XHRcdHJldHVybiAoeyBlZGl0b3I6IHRleHRFZGl0b3JTZXJ2aWNlLmNyZWF0ZVRleHRFZGl0b3IoZWRpdG9ySW5wdXQpIH0pO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjcmVhdGVEaWZmRWRpdG9ySW5wdXQ6IGRpZmZFZGl0b3IgPT4gKHsgZWRpdG9yOiB0ZXh0RWRpdG9yU2VydmljZS5jcmVhdGVUZXh0RWRpdG9yKGRpZmZFZGl0b3IpIH0pXG5cdFx0XHR9XG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yQ291bnQsIDApO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0geyByZXNvdXJjZTogVVJJLnBhcnNlKCdmaWxlOi8vdGVzdC9wYXRoL3Jlc291cmNlMS50eHQnKSB9O1xuXHRcdGNvbnN0IGlucHV0MiA9IHsgcmVzb3VyY2U6IFVSSS5wYXJzZSgnZmlsZTovL3Rlc3QvcGF0aC9yZXNvdXJjZTEubWQnKSB9O1xuXG5cdFx0Ly8gT3BlbiBlZGl0b3IgaW5wdXQgMSBhbmQgaXQgc2hvdWxuJ3QgdHJpZ2dlciBvdmVycmlkZSBhcyB0aGUgZ2xvYiBkb2Vzbid0IG1hdGNoXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvdW50LCAwKTtcblxuXHRcdC8vIE9wZW4gZWRpdG9yIGlucHV0IDIgYW5kIGl0IHNob3VsZCB0cmlnZ2VyIG92ZXJyaWRlIGFzIHRoZSBnbG9iIGRvZXNuIG1hdGNoXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvdW50LCAxKTtcblxuXHRcdC8vIEJlY2F1c2Ugd2Ugc3BlY2lmeSBhbiBvdmVycmlkZSB3ZSBzaG91bGRuJ3Qgc2VlIGl0IHRyaWdnZXJlZCBldmVuIGlmIGl0IG1hdGNoZXNcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoeyAuLi5pbnB1dDIsIG9wdGlvbnM6IHsgb3ZlcnJpZGU6ICdkZWZhdWx0JyB9IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JDb3VudCwgMSk7XG5cblx0XHRyZWdpc3RyYXRpb25EaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIC0gb3BlbkVkaXRvcnMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgWywgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXHRcdGNvbnN0IGVkaXRvclJlc29sdmVyU2VydmljZSA9IGFjY2Vzc29yLmVkaXRvclJlc29sdmVyU2VydmljZTtcblx0XHRjb25zdCB0ZXh0RWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLnRleHRFZGl0b3JTZXJ2aWNlO1xuXG5cdFx0bGV0IGVkaXRvckNvdW50ID0gMDtcblxuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbkRpc3Bvc2FibGUgPSBlZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5tZCcsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnVGVzdEVkaXRvcicsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3InLFxuXHRcdFx0XHRkZXRhaWw6ICdUZXN0IEVkaXRvciBQcm92aWRlcicsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpblxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKGVkaXRvcklucHV0KSA9PiB7XG5cdFx0XHRcdFx0ZWRpdG9yQ291bnQrKztcblx0XHRcdFx0XHRyZXR1cm4gKHsgZWRpdG9yOiB0ZXh0RWRpdG9yU2VydmljZS5jcmVhdGVUZXh0RWRpdG9yKGVkaXRvcklucHV0KSB9KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Y3JlYXRlRGlmZkVkaXRvcklucHV0OiBkaWZmRWRpdG9yID0+ICh7IGVkaXRvcjogdGV4dEVkaXRvclNlcnZpY2UuY3JlYXRlVGV4dEVkaXRvcihkaWZmRWRpdG9yKSB9KVxuXHRcdFx0fVxuXHRcdCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvdW50LCAwKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdmaWxlOi8vdGVzdC9wYXRoL3Jlc291cmNlMS50eHQnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpLnRvVW50eXBlZCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdmaWxlOi8vdGVzdC9wYXRoL3Jlc291cmNlMi50eHQnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpLnRvVW50eXBlZCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdmaWxlOi8vdGVzdC9wYXRoL3Jlc291cmNlMy5tZCcpLCBURVNUX0VESVRPUl9JTlBVVF9JRCkudG9VbnR5cGVkKCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ2ZpbGU6Ly90ZXN0L3BhdGgvcmVzb3VyY2U0Lm1kJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKS50b1VudHlwZWQoKTtcblxuXHRcdGFzc2VydC5vayhpbnB1dDEpO1xuXHRcdGFzc2VydC5vayhpbnB1dDIpO1xuXHRcdGFzc2VydC5vayhpbnB1dDMpO1xuXHRcdGFzc2VydC5vayhpbnB1dDQpO1xuXG5cdFx0Ly8gT3BlbiBlZGl0b3IgaW5wdXRzXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9ycyhbaW5wdXQxLCBpbnB1dDIsIGlucHV0MywgaW5wdXQ0XSk7XG5cdFx0Ly8gT25seSB0d28gbWF0Y2hlZCB0aGUgZmFjdG9yeSBnbG9iXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvdW50LCAyKTtcblxuXHRcdHJlZ2lzdHJhdGlvbkRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3JSZXNvbHZlclNlcnZpY2UgLSByZXBsYWNlRWRpdG9ycycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXHRcdGNvbnN0IGVkaXRvclJlc29sdmVyU2VydmljZSA9IGFjY2Vzc29yLmVkaXRvclJlc29sdmVyU2VydmljZTtcblx0XHRjb25zdCB0ZXh0RWRpdG9yU2VydmljZSA9IGFjY2Vzc29yLnRleHRFZGl0b3JTZXJ2aWNlO1xuXG5cdFx0bGV0IGVkaXRvckNvdW50ID0gMDtcblxuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbkRpc3Bvc2FibGUgPSBlZGl0b3JSZXNvbHZlclNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoXG5cdFx0XHQnKi5tZCcsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnVGVzdEVkaXRvcicsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3InLFxuXHRcdFx0XHRkZXRhaWw6ICdUZXN0IEVkaXRvciBQcm92aWRlcicsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuYnVpbHRpblxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKGVkaXRvcklucHV0KSA9PiB7XG5cdFx0XHRcdFx0ZWRpdG9yQ291bnQrKztcblx0XHRcdFx0XHRyZXR1cm4gKHsgZWRpdG9yOiB0ZXh0RWRpdG9yU2VydmljZS5jcmVhdGVUZXh0RWRpdG9yKGVkaXRvcklucHV0KSB9KTtcblx0XHRcdFx0fSxcblx0XHRcdFx0Y3JlYXRlRGlmZkVkaXRvcklucHV0OiBkaWZmRWRpdG9yID0+ICh7IGVkaXRvcjogdGV4dEVkaXRvclNlcnZpY2UuY3JlYXRlVGV4dEVkaXRvcihkaWZmRWRpdG9yKSB9KVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yQ291bnQsIDApO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ2ZpbGU6Ly90ZXN0L3BhdGgvcmVzb3VyY2UyLm1kJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCB1bnR5cGVkSW5wdXQxID0gaW5wdXQxLnRvVW50eXBlZCgpO1xuXHRcdGFzc2VydC5vayh1bnR5cGVkSW5wdXQxKTtcblxuXHRcdC8vIE9wZW4gZWRpdG9yIGlucHV0IDEgYW5kIGl0IHNob3VsZG4ndCB0cmlnZ2VyIGJlY2F1c2UgdHlwZWQgaW5wdXRzIGFyZW4ndCBvdmVycmlkZW5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3IoaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yQ291bnQsIDApO1xuXG5cdFx0YXdhaXQgc2VydmljZS5yZXBsYWNlRWRpdG9ycyhbe1xuXHRcdFx0ZWRpdG9yOiBpbnB1dDEsXG5cdFx0XHRyZXBsYWNlbWVudDogdW50eXBlZElucHV0MSxcblx0XHR9XSwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvckNvdW50LCAxKTtcblxuXHRcdHJlZ2lzdHJhdGlvbkRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjbG9zZUVkaXRvcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JTZXJ2aWNlKCk7XG5cblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLW9wZW5FZGl0b3JzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblx0XHRjb25zdCBvdGhlcklucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UyLW9wZW5FZGl0b3JzJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKTtcblxuXHRcdC8vIE9wZW4gZWRpdG9yc1xuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcnMoW3sgZWRpdG9yOiBpbnB1dCB9LCB7IGVkaXRvcjogb3RoZXJJbnB1dCB9XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDIpO1xuXG5cdFx0Ly8gQ2xvc2UgZWRpdG9yXG5cdFx0YXdhaXQgc2VydmljZS5jbG9zZUVkaXRvcih7IGVkaXRvcjogaW5wdXQsIGdyb3VwSWQ6IHBhcnQuYWN0aXZlR3JvdXAuaWQgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDEpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jbG9zZUVkaXRvcih7IGVkaXRvcjogaW5wdXQsIGdyb3VwSWQ6IHBhcnQuYWN0aXZlR3JvdXAuaWQgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDEpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5jbG9zZUVkaXRvcih7IGVkaXRvcjogb3RoZXJJbnB1dCwgZ3JvdXBJZDogcGFydC5hY3RpdmVHcm91cC5pZCB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5jb3VudCwgMCk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmNsb3NlRWRpdG9yKHsgZWRpdG9yOiBvdGhlcklucHV0LCBncm91cElkOiA5OTkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnQuYWN0aXZlR3JvdXAuY291bnQsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdjbG9zZUVkaXRvcnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgb3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHQvLyBPcGVuIGVkaXRvcnNcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQgfSwgeyBlZGl0b3I6IG90aGVySW5wdXQgfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmNvdW50LCAyKTtcblxuXHRcdC8vIENsb3NlIGVkaXRvcnNcblx0XHRhd2FpdCBzZXJ2aWNlLmNsb3NlRWRpdG9ycyhbeyBlZGl0b3I6IGlucHV0LCBncm91cElkOiBwYXJ0LmFjdGl2ZUdyb3VwLmlkIH0sIHsgZWRpdG9yOiBvdGhlcklucHV0LCBncm91cElkOiBwYXJ0LmFjdGl2ZUdyb3VwLmlkIH1dKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFydC5hY3RpdmVHcm91cC5jb3VudCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbmRFZGl0b3JzIChpbiBncm91cCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3Qgb3RoZXJJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlMi1vcGVuRWRpdG9ycycpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cblx0XHQvLyBPcGVuIGVkaXRvcnNcblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQgfSwgeyBlZGl0b3I6IG90aGVySW5wdXQgfV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJ0LmFjdGl2ZUdyb3VwLmNvdW50LCAyKTtcblxuXHRcdC8vIFRyeSB1c2luZyBmaW5kIGVkaXRvcnMgZm9yIG9wZW5lZCBlZGl0b3JzXG5cdFx0e1xuXHRcdFx0Y29uc3QgZm91bmQxID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dC5yZXNvdXJjZSwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDEubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDFbMF0sIGlucHV0KTtcblxuXHRcdFx0Y29uc3QgZm91bmQyID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dCwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIsIGlucHV0KTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgZm91bmQxID0gc2VydmljZS5maW5kRWRpdG9ycyhvdGhlcklucHV0LnJlc291cmNlLCB1bmRlZmluZWQsIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kMS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kMVswXSwgb3RoZXJJbnB1dCk7XG5cblx0XHRcdGNvbnN0IGZvdW5kMiA9IHNlcnZpY2UuZmluZEVkaXRvcnMob3RoZXJJbnB1dCwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIsIG90aGVySW5wdXQpO1xuXHRcdH1cblxuXHRcdC8vIE1ha2Ugc3VyZSB3ZSBkb24ndCBmaW5kIG5vbi1vcGVuZWQgZWRpdG9yc1xuXHRcdHtcblx0XHRcdGNvbnN0IGZvdW5kMSA9IHNlcnZpY2UuZmluZEVkaXRvcnMoVVJJLnBhcnNlKCdteTovL25vLXN1Y2gtcmVzb3VyY2UnKSwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDEubGVuZ3RoLCAwKTtcblxuXHRcdFx0Y29uc3QgZm91bmQyID0gc2VydmljZS5maW5kRWRpdG9ycyh7IHJlc291cmNlOiBVUkkucGFyc2UoJ215Oi8vbm8tc3VjaC1yZXNvdXJjZScpLCB0eXBlSWQ6ICcnLCBlZGl0b3JJZDogVEVTVF9FRElUT1JfSU5QVVRfSUQgfSwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFrZSBzdXJlIHdlIGRvbid0IGZpbmQgZWRpdG9ycyBhY3Jvc3MgZ3JvdXBzXG5cdFx0e1xuXHRcdFx0Y29uc3QgbmV3RWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL290aGVyLWdyb3VwLXJlc291cmNlJyksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSwgeyBwaW5uZWQ6IHRydWUsIHByZXNlcnZlRm9jdXM6IHRydWUgfSwgU0lERV9HUk9VUCk7XG5cblx0XHRcdGNvbnN0IGZvdW5kMSA9IHNlcnZpY2UuZmluZEVkaXRvcnMoaW5wdXQucmVzb3VyY2UsIHVuZGVmaW5lZCwgbmV3RWRpdG9yIS5ncm91cCEuaWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kMS5sZW5ndGgsIDApO1xuXG5cdFx0XHRjb25zdCBmb3VuZDIgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKGlucHV0LCB1bmRlZmluZWQsIG5ld0VkaXRvciEuZ3JvdXAhLmlkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgd2UgZG9uJ3QgZmluZCBlZGl0b3JzIGFmdGVyIGNsb3NpbmcgdGhlbVxuXHRcdGF3YWl0IHBhcnQuYWN0aXZlR3JvdXAuY2xvc2VBbGxFZGl0b3JzKCk7XG5cdFx0e1xuXHRcdFx0Y29uc3QgZm91bmQxID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dC5yZXNvdXJjZSwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDEubGVuZ3RoLCAwKTtcblxuXHRcdFx0Y29uc3QgZm91bmQyID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dCwgdW5kZWZpbmVkLCBwYXJ0LmFjdGl2ZUdyb3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIsIHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdmaW5kRWRpdG9ycyAoYWNyb3NzIGdyb3VwcyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgcm9vdEdyb3VwID0gcGFydC5hY3RpdmVHcm91cDtcblxuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2Utb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0Ly8gT3BlbiBlZGl0b3JzXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9ycyhbeyBlZGl0b3I6IGlucHV0IH0sIHsgZWRpdG9yOiBvdGhlcklucHV0IH1dKTtcblx0XHRjb25zdCBzaWRlRWRpdG9yID0gYXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9LCBTSURFX0dST1VQKTtcblxuXHRcdC8vIFRyeSB1c2luZyBmaW5kIGVkaXRvcnMgZm9yIG9wZW5lZCBlZGl0b3JzXG5cdFx0e1xuXHRcdFx0Y29uc3QgZm91bmQxID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dC5yZXNvdXJjZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxWzBdLmVkaXRvciwgaW5wdXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kMVswXS5ncm91cElkLCBzaWRlRWRpdG9yPy5ncm91cC5pZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxWzFdLmVkaXRvciwgaW5wdXQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kMVsxXS5ncm91cElkLCByb290R3JvdXAuaWQpO1xuXG5cdFx0XHRjb25zdCBmb3VuZDIgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKGlucHV0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDIubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDJbMF0uZWRpdG9yLCBpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyWzBdLmdyb3VwSWQsIHNpZGVFZGl0b3I/Lmdyb3VwLmlkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDJbMV0uZWRpdG9yLCBpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyWzFdLmdyb3VwSWQsIHJvb3RHcm91cC5pZCk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IGZvdW5kMSA9IHNlcnZpY2UuZmluZEVkaXRvcnMob3RoZXJJbnB1dC5yZXNvdXJjZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxWzBdLmVkaXRvciwgb3RoZXJJbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQxWzBdLmdyb3VwSWQsIHJvb3RHcm91cC5pZCk7XG5cblx0XHRcdGNvbnN0IGZvdW5kMiA9IHNlcnZpY2UuZmluZEVkaXRvcnMob3RoZXJJbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyWzBdLmVkaXRvciwgb3RoZXJJbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyWzBdLmdyb3VwSWQsIHJvb3RHcm91cC5pZCk7XG5cdFx0fVxuXG5cdFx0Ly8gTWFrZSBzdXJlIHdlIGRvbid0IGZpbmQgbm9uLW9wZW5lZCBlZGl0b3JzXG5cdFx0e1xuXHRcdFx0Y29uc3QgZm91bmQxID0gc2VydmljZS5maW5kRWRpdG9ycyhVUkkucGFyc2UoJ215Oi8vbm8tc3VjaC1yZXNvdXJjZScpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDEubGVuZ3RoLCAwKTtcblxuXHRcdFx0Y29uc3QgZm91bmQyID0gc2VydmljZS5maW5kRWRpdG9ycyh7IHJlc291cmNlOiBVUkkucGFyc2UoJ215Oi8vbm8tc3VjaC1yZXNvdXJjZScpLCB0eXBlSWQ6ICcnLCBlZGl0b3JJZDogVEVTVF9FRElUT1JfSU5QVVRfSUQgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyLmxlbmd0aCwgMCk7XG5cdFx0fVxuXG5cdFx0Ly8gQ2hlY2sgd2UgZG9uJ3QgZmluZCBlZGl0b3JzIGFmdGVyIGNsb3NpbmcgdGhlbVxuXHRcdGF3YWl0IHJvb3RHcm91cC5jbG9zZUFsbEVkaXRvcnMoKTtcblx0XHRhd2FpdCBzaWRlRWRpdG9yPy5ncm91cC5jbG9zZUFsbEVkaXRvcnMoKTtcblx0XHR7XG5cdFx0XHRjb25zdCBmb3VuZDEgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKGlucHV0LnJlc291cmNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZDEubGVuZ3RoLCAwKTtcblxuXHRcdFx0Y29uc3QgZm91bmQyID0gc2VydmljZS5maW5kRWRpdG9ycyhpbnB1dCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQyLmxlbmd0aCwgMCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdmaW5kRWRpdG9ycyAoc3VwcG9ydCBzaWRlIGJ5IHNpZGUgdmlhIG9wdGlvbnMpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFssIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgc2Vjb25kYXJ5SW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1maW5kRWRpdG9ycy1zZWNvbmRhcnknKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IHByaW1hcnlJbnB1dCA9IGNyZWF0ZVRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWZpbmRFZGl0b3JzLXByaW1hcnknKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0ID0gbmV3IFNpZGVCeVNpZGVFZGl0b3JJbnB1dCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgc2Vjb25kYXJ5SW5wdXQsIHByaW1hcnlJbnB1dCwgc2VydmljZSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLm9wZW5FZGl0b3Ioc2lkZUJ5U2lkZUlucHV0LCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGxldCBmb3VuZEVkaXRvcnMgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1maW5kRWRpdG9ycy1wcmltYXJ5JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZEVkaXRvcnMubGVuZ3RoLCAwKTtcblxuXHRcdGZvdW5kRWRpdG9ycyA9IHNlcnZpY2UuZmluZEVkaXRvcnMoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWZpbmRFZGl0b3JzLXByaW1hcnknKSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5QUklNQVJZIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmb3VuZEVkaXRvcnMubGVuZ3RoLCAxKTtcblxuXHRcdGZvdW5kRWRpdG9ycyA9IHNlcnZpY2UuZmluZEVkaXRvcnMoVVJJLnBhcnNlKCdteTovL3Jlc291cmNlLWZpbmRFZGl0b3JzLXNlY29uZGFyeScpLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlBSSU1BUlkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kRWRpdG9ycy5sZW5ndGgsIDApO1xuXG5cdFx0Zm91bmRFZGl0b3JzID0gc2VydmljZS5maW5kRWRpdG9ycyhVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtZmluZEVkaXRvcnMtcHJpbWFyeScpLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLlNFQ09OREFSWSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmRFZGl0b3JzLmxlbmd0aCwgMCk7XG5cblx0XHRmb3VuZEVkaXRvcnMgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1maW5kRWRpdG9ycy1zZWNvbmRhcnknKSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5TRUNPTkRBUlkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kRWRpdG9ycy5sZW5ndGgsIDEpO1xuXG5cdFx0Zm91bmRFZGl0b3JzID0gc2VydmljZS5maW5kRWRpdG9ycyhVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2UtZmluZEVkaXRvcnMtcHJpbWFyeScpLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmRFZGl0b3JzLmxlbmd0aCwgMSk7XG5cblx0XHRmb3VuZEVkaXRvcnMgPSBzZXJ2aWNlLmZpbmRFZGl0b3JzKFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1maW5kRWRpdG9ycy1zZWNvbmRhcnknKSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZvdW5kRWRpdG9ycy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaWRlIGJ5IHNpZGUgZWRpdG9yIGlzIG5vdCBtYXRjaGluZyBhbGwgb3RoZXIgZWRpdG9ycyAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzMjg1OSknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgW3BhcnQsIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yU2VydmljZSgpO1xuXG5cdFx0Y29uc3Qgcm9vdEdyb3VwID0gcGFydC5hY3RpdmVHcm91cDtcblxuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2Utb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IG90aGVySW5wdXQgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZTItb3BlbkVkaXRvcnMnKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdGNvbnN0IHNpZGVCeVNpZGVJbnB1dCA9IG5ldyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQodW5kZWZpbmVkLCB1bmRlZmluZWQsIGlucHV0LCBpbnB1dCwgc2VydmljZSk7XG5cdFx0Y29uc3Qgb3RoZXJTaWRlQnlTaWRlSW5wdXQgPSBuZXcgU2lkZUJ5U2lkZUVkaXRvcklucHV0KHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBvdGhlcklucHV0LCBvdGhlcklucHV0LCBzZXJ2aWNlKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXQsIHVuZGVmaW5lZCwgU0lERV9HUk9VUCk7XG5cblx0XHRwYXJ0LmFjdGl2YXRlR3JvdXAocm9vdEdyb3VwKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uub3BlbkVkaXRvcihvdGhlclNpZGVCeVNpZGVJbnB1dCwgeyByZXZlYWxJZk9wZW5lZDogdHJ1ZSwgcmV2ZWFsSWZWaXNpYmxlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJvb3RHcm91cC5jb3VudCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uRGlkQ2xvc2VFZGl0b3IgaW5kaWNhdGVzIHByb3BlciBjb250ZXh0IHdoZW4gbW92aW5nIGVkaXRvciBhY3Jvc3MgZ3JvdXBzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vbkRpZENsb3NlRWRpdG9yMScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2Utb25EaWRDbG9zZUVkaXRvcjInKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRjb25zdCBzaWRlZ3JvdXAgPSBwYXJ0LmFkZEdyb3VwKHJvb3RHcm91cCwgR3JvdXBEaXJlY3Rpb24uUklHSFQpO1xuXG5cdFx0Y29uc3QgZXZlbnRzOiBJRWRpdG9yQ2xvc2VFdmVudFtdID0gW107XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRDbG9zZUVkaXRvcihlID0+IHtcblx0XHRcdGV2ZW50cy5wdXNoKGUpO1xuXHRcdH0pKTtcblxuXHRcdHJvb3RHcm91cC5tb3ZlRWRpdG9yKGlucHV0MSwgc2lkZWdyb3VwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHNbMF0uY29udGV4dCwgRWRpdG9yQ2xvc2VDb250ZXh0Lk1PVkUpO1xuXG5cdFx0YXdhaXQgc2lkZWdyb3VwLmNsb3NlRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzWzFdLmNvbnRleHQsIEVkaXRvckNsb3NlQ29udGV4dC5VTktOT1dOKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRDbG9zZUVkaXRvciBpbmRpY2F0ZXMgcHJvcGVyIGNvbnRleHQgd2hlbiByZXBsYWNpbmcgYW4gZWRpdG9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlXSA9IGF3YWl0IGNyZWF0ZUVkaXRvclNlcnZpY2UoKTtcblxuXHRcdGNvbnN0IHJvb3RHcm91cCA9IHBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBjcmVhdGVUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZSgnbXk6Ly9yZXNvdXJjZS1vbkRpZENsb3NlRWRpdG9yMScpLCBURVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gY3JlYXRlVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UoJ215Oi8vcmVzb3VyY2Utb25EaWRDbG9zZUVkaXRvcjInKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRjb25zdCBldmVudHM6IElFZGl0b3JDbG9zZUV2ZW50W10gPSBbXTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5vbkRpZENsb3NlRWRpdG9yKGUgPT4ge1xuXHRcdFx0ZXZlbnRzLnB1c2goZSk7XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcm9vdEdyb3VwLnJlcGxhY2VFZGl0b3JzKFt7IGVkaXRvcjogaW5wdXQxLCByZXBsYWNlbWVudDogaW5wdXQyIH1dKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHNbMF0uY29udGV4dCwgRWRpdG9yQ2xvc2VDb250ZXh0LlJFUExBQ0UpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsd0JBQThDO0FBQ3ZELFNBQVMsV0FBVztBQUNwQixTQUFTLGFBQWE7QUFDdEIsU0FBUyw0QkFBNEIsb0JBQW9CLGNBQWdHLDBCQUFpRixrQkFBa0IsZUFBZSwrQkFBK0I7QUFDMVMsU0FBUywrQkFBK0IscUJBQXFCLG9CQUFvQixxQkFBZ0QsNEJBQTRCLDhCQUE4QixrQkFBa0Isd0JBQXdCLG9CQUFvQiw4QkFBOEIseUJBQXlCO0FBQ2hULFNBQVMscUJBQXFCO0FBQzlCLFNBQXVCLHNCQUFzQixnQkFBZ0IseUJBQXlCO0FBRXRGLFNBQVMsY0FBK0MsZ0JBQWdDLGtCQUFrQjtBQUMxRyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0IscUJBQXFCO0FBQ2xELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsNkJBQTZCO0FBRXRDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsK0NBQStDO0FBR3hELE1BQU0saUJBQWlCLE1BQU07QUFFNUIsUUFBTSxpQkFBaUI7QUFDdkIsUUFBTSx1QkFBdUI7QUFFN0IsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLE1BQUksZ0NBQXVFO0FBRTNFLFFBQU0sTUFBTTtB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QUFDLEVBQUUsU0FBUyxtQkFBbUIsSUFBSTtBQUU3RCxVQUFNLFVBQVUsWUFBWSxNQUFNO0FBRWxDLFdBQU8sWUFBWSxPQUFPLENBQUMsRUFBRSxTQUFTLG1CQUFtQixPQUFPO0FBQUEsRUFDakUsQ0FBQztBQUVELE9BQUssc0VBQXNFLFlBQVk7QUFDdEYsVUFBTSxDQUFDLE1BQU0sT0FBTyxJQUFJLE1BQU0sb0JBQW9CO0FBRWxELFVBQU0sWUFBWSxLQUFLO0FBRXZCLFVBQU0sU0FBUywwQkFBMEIsSUFBSSxNQUFNLGlDQUFpQyxHQUFHLG9CQUFvQjtBQUMzRyxVQUFNLFNBQVMsMEJBQTBCLElBQUksTUFBTSxpQ0FBaUMsR0FBRyxvQkFBb0I7QUFFM0csVUFBTSxRQUFRLFdBQVcsUUFBUSxFQUFFLFFBQVEsS0FBSyxDQUFDO0FBRWpELFVBQU0sU0FBOEIsQ0FBQztBQUNyQyxnQkFBWSxJQUFJLFFBQVEsaUJBQWlCLE9BQUs7QUFDN0MsYUFBTyxLQUFLLENBQUM7QUFBQSxJQUNkLENBQUMsQ0FBQztBQUVGLFVBQU0sVUFBVSxlQUFlLENBQUMsRUFBRSxRQUFRLFFBQVEsYUFBYSxPQUFPLENBQUMsQ0FBQztBQUV4RSxXQUFPLFlBQVksT0FBTyxDQUFDLEVBQUUsU0FBUyxtQkFBbUIsT0FBTztBQUFBLEVBQ2pFLENBQUM7QUFFRCwwQ0FBd0M7QUFDekMsQ0FBQzsiLAogICJuYW1lcyI6IFsiZ3JvdXAiLCAiaW5wdXQiLCAiaW5zdGFudGlhdGlvblNlcnZpY2UiXQp9Cg==
