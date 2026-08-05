import assert from "assert";
import { EditorGroupModel, isGroupEditorChangeEvent, isGroupEditorCloseEvent, isGroupEditorMoveEvent, isGroupEditorOpenEvent } from "../../../../common/editor/editorGroupModel.js";
import { EditorExtensions, CloseDirection, EditorsOrder, SideBySideEditor, EditorCloseContext, GroupModelChangeKind } from "../../../../common/editor.js";
import { URI } from "../../../../../base/common/uri.js";
import { TestLifecycleService, workbenchInstantiationService } from "../../workbenchTestServices.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { TestContextService, TestStorageService } from "../../../common/workbenchTestServices.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { SideBySideEditorInput } from "../../../../common/editor/sideBySideEditorInput.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("EditorGroupModel", () => {
  let testInstService;
  suiteTeardown(() => {
    testInstService?.dispose();
    testInstService = void 0;
  });
  function inst() {
    if (!testInstService) {
      testInstService = new TestInstantiationService();
    }
    const inst2 = testInstService;
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(ILifecycleService, disposables.add(new TestLifecycleService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right", focusRecentEditorAfterClose: true } });
    inst2.stub(IConfigurationService, config);
    return inst2;
  }
  function createEditorGroupModel(serialized) {
    const group = disposables.add(inst().createInstance(EditorGroupModel, serialized));
    disposables.add(toDisposable(() => {
      for (const editor of group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)) {
        group.closeEditor(editor);
      }
    }));
    return group;
  }
  function closeAllEditors(group) {
    for (const editor of group.getEditors(EditorsOrder.SEQUENTIAL)) {
      group.closeEditor(editor, void 0, false);
    }
  }
  function closeEditors(group, except, direction) {
    const index2 = group.indexOf(except);
    if (index2 === -1) {
      return;
    }
    if (direction === CloseDirection.LEFT) {
      for (let i = index2 - 1; i >= 0; i--) {
        group.closeEditor(group.getEditorByIndex(i));
      }
    } else if (direction === CloseDirection.RIGHT) {
      for (let i = group.getEditors(EditorsOrder.SEQUENTIAL).length - 1; i > index2; i--) {
        group.closeEditor(group.getEditorByIndex(i));
      }
    } else {
      group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).filter((editor) => !editor.matches(except)).forEach((editor) => group.closeEditor(editor));
    }
  }
  function groupListener(group) {
    const groupEvents = {
      active: [],
      index: [],
      label: [],
      locked: [],
      opened: [],
      closed: [],
      activated: [],
      pinned: [],
      unpinned: [],
      sticky: [],
      unsticky: [],
      transient: [],
      moved: [],
      disposed: []
    };
    disposables.add(group.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.GROUP_LOCKED) {
        groupEvents.locked.push(group.id);
        return;
      } else if (e.kind === GroupModelChangeKind.GROUP_ACTIVE) {
        groupEvents.active.push(group.id);
        return;
      } else if (e.kind === GroupModelChangeKind.GROUP_INDEX) {
        groupEvents.index.push(group.id);
        return;
      } else if (e.kind === GroupModelChangeKind.GROUP_LABEL) {
        groupEvents.label.push(group.id);
        return;
      }
      if (!e.editor) {
        return;
      }
      switch (e.kind) {
        case GroupModelChangeKind.EDITOR_OPEN:
          if (isGroupEditorOpenEvent(e)) {
            groupEvents.opened.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_CLOSE:
          if (isGroupEditorCloseEvent(e)) {
            groupEvents.closed.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_ACTIVE:
          if (isGroupEditorChangeEvent(e)) {
            groupEvents.activated.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_PIN:
          if (isGroupEditorChangeEvent(e)) {
            group.isPinned(e.editor) ? groupEvents.pinned.push(e) : groupEvents.unpinned.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_STICKY:
          if (isGroupEditorChangeEvent(e)) {
            group.isSticky(e.editor) ? groupEvents.sticky.push(e) : groupEvents.unsticky.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_TRANSIENT:
          if (isGroupEditorChangeEvent(e)) {
            groupEvents.transient.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_MOVE:
          if (isGroupEditorMoveEvent(e)) {
            groupEvents.moved.push(e);
          }
          break;
        case GroupModelChangeKind.EDITOR_WILL_DISPOSE:
          if (isGroupEditorChangeEvent(e)) {
            groupEvents.disposed.push(e);
          }
          break;
      }
    }));
    return groupEvents;
  }
  let index = 0;
  class TestEditorInput extends EditorInput {
    constructor(id) {
      super();
      this.id = id;
      this.resource = void 0;
    }
    get typeId() {
      return "testEditorInputForGroups";
    }
    async resolve() {
      return null;
    }
    matches(other) {
      return other && this.id === other.id && other instanceof TestEditorInput;
    }
    setDirty() {
      this._onDidChangeDirty.fire();
    }
    setLabel() {
      this._onDidChangeLabel.fire();
    }
  }
  class NonSerializableTestEditorInput extends EditorInput {
    constructor(id) {
      super();
      this.id = id;
      this.resource = void 0;
    }
    get typeId() {
      return "testEditorInputForGroups-nonSerializable";
    }
    async resolve() {
      return null;
    }
    matches(other) {
      return other && this.id === other.id && other instanceof NonSerializableTestEditorInput;
    }
  }
  class TestFileEditorInput extends EditorInput {
    constructor(id, resource) {
      super();
      this.id = id;
      this.resource = resource;
      this.preferredResource = this.resource;
    }
    get typeId() {
      return "testFileEditorInputForGroups";
    }
    get editorId() {
      return this.id;
    }
    async resolve() {
      return null;
    }
    setPreferredName(name) {
    }
    setPreferredDescription(description) {
    }
    setPreferredResource(resource) {
    }
    async setEncoding(encoding) {
    }
    getEncoding() {
      return void 0;
    }
    setPreferredEncoding(encoding) {
    }
    setForceOpenAsBinary() {
    }
    setPreferredContents(contents) {
    }
    setLanguageId(languageId) {
    }
    setPreferredLanguageId(languageId) {
    }
    isResolved() {
      return false;
    }
    matches(other) {
      if (super.matches(other)) {
        return true;
      }
      if (other instanceof TestFileEditorInput) {
        return isEqual(other.resource, this.resource);
      }
      return false;
    }
  }
  function input(id = String(index++), nonSerializable, resource) {
    if (resource) {
      return disposables.add(new TestFileEditorInput(id, resource));
    }
    return nonSerializable ? disposables.add(new NonSerializableTestEditorInput(id)) : disposables.add(new TestEditorInput(id));
  }
  const _TestEditorInputSerializer = class _TestEditorInputSerializer {
    canSerialize(editorInput) {
      return true;
    }
    serialize(editorInput) {
      if (_TestEditorInputSerializer.disableSerialize) {
        return void 0;
      }
      const testEditorInput = editorInput;
      const testInput = {
        id: testEditorInput.id
      };
      return JSON.stringify(testInput);
    }
    deserialize(instantiationService, serializedEditorInput) {
      if (_TestEditorInputSerializer.disableDeserialize) {
        return void 0;
      }
      const testInput = JSON.parse(serializedEditorInput);
      return disposables.add(new TestEditorInput(testInput.id));
    }
  };
  _TestEditorInputSerializer.disableSerialize = false;
  _TestEditorInputSerializer.disableDeserialize = false;
  let TestEditorInputSerializer = _TestEditorInputSerializer;
  const disposables = new DisposableStore();
  setup(() => {
    TestEditorInputSerializer.disableSerialize = false;
    TestEditorInputSerializer.disableDeserialize = false;
    disposables.add(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer("testEditorInputForGroups", TestEditorInputSerializer));
  });
  teardown(() => {
    disposables.clear();
    index = 1;
  });
  test("Clone Group", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    group.stick(input2);
    assert.ok(group.isSticky(input2));
    assert.strictEqual(group.isLocked, false);
    group.lock(true);
    assert.strictEqual(group.isLocked, true);
    const clone = disposables.add(group.clone());
    assert.notStrictEqual(group.id, clone.id);
    assert.strictEqual(clone.count, 3);
    assert.strictEqual(clone.isLocked, false);
    let didEditorLabelChange = false;
    const toDispose = clone.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        didEditorLabelChange = true;
      }
    });
    input1.setLabel();
    assert.ok(didEditorLabelChange);
    assert.strictEqual(clone.isPinned(input1), true);
    assert.strictEqual(clone.isActive(input1), false);
    assert.strictEqual(clone.isSticky(input1), false);
    assert.strictEqual(clone.isPinned(input2), true);
    assert.strictEqual(clone.isActive(input2), false);
    assert.strictEqual(clone.isSticky(input2), true);
    assert.strictEqual(clone.isPinned(input3), false);
    assert.strictEqual(clone.isActive(input3), true);
    assert.strictEqual(clone.isSticky(input3), false);
    toDispose.dispose();
  });
  test("isActive - untyped", () => {
    const group = createEditorGroupModel();
    const input2 = disposables.add(new TestFileEditorInput("testInput", URI.file("fake")));
    const input22 = disposables.add(new TestFileEditorInput("testInput2", URI.file("fake2")));
    const untypedInput = { resource: URI.file("/fake"), options: { override: "testInput" } };
    const untypedNonActiveInput = { resource: URI.file("/fake2"), options: { override: "testInput2" } };
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input22, { active: false });
    assert.ok(group.isActive(input2));
    assert.ok(group.isActive(untypedInput));
    assert.ok(!group.isActive(untypedNonActiveInput));
  });
  test("openEditor - prefers existing side by side editor if same", () => {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const group = createEditorGroupModel();
    const input1 = disposables.add(new TestFileEditorInput("testInput", URI.file("fake1")));
    const input2 = disposables.add(new TestFileEditorInput("testInput", URI.file("fake2")));
    const sideBySideInputSame = instantiationService.createInstance(SideBySideEditorInput, void 0, void 0, input1, input1);
    const sideBySideInputDifferent = instantiationService.createInstance(SideBySideEditorInput, void 0, void 0, input1, input2);
    let res = group.openEditor(sideBySideInputSame, { pinned: true, active: true });
    assert.strictEqual(res.editor, sideBySideInputSame);
    assert.strictEqual(res.isNew, true);
    res = group.openEditor(input1, { pinned: true, active: true, supportSideBySide: SideBySideEditor.BOTH });
    assert.strictEqual(res.editor, sideBySideInputSame);
    assert.strictEqual(res.isNew, false);
    group.closeEditor(sideBySideInputSame);
    res = group.openEditor(sideBySideInputDifferent, { pinned: true, active: true });
    assert.strictEqual(res.editor, sideBySideInputDifferent);
    assert.strictEqual(res.isNew, true);
    res = group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(res.editor, input1);
    assert.strictEqual(res.isNew, true);
  });
  test("indexOf() - prefers direct matching editor over side by side matching one", () => {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const group = createEditorGroupModel();
    const input1 = disposables.add(new TestFileEditorInput("testInput", URI.file("fake1")));
    const sideBySideInput = instantiationService.createInstance(SideBySideEditorInput, void 0, void 0, input1, input1);
    group.openEditor(sideBySideInput, { pinned: true, active: true });
    assert.strictEqual(group.indexOf(sideBySideInput), 0);
    assert.strictEqual(group.indexOf(input1), -1);
    assert.strictEqual(group.indexOf(input1, void 0, { supportSideBySide: SideBySideEditor.BOTH }), 0);
    assert.strictEqual(group.indexOf(input1, void 0, { supportSideBySide: SideBySideEditor.ANY }), 0);
    group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input1, void 0, { supportSideBySide: SideBySideEditor.BOTH }), 1);
    assert.strictEqual(group.indexOf(input1, void 0, { supportSideBySide: SideBySideEditor.ANY }), 1);
  });
  test("contains() - untyped", function() {
    const group = createEditorGroupModel();
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const input1 = input("input1", false, URI.file("/input1"));
    const input2 = input("input2", false, URI.file("/input2"));
    const untypedInput1 = { resource: URI.file("/input1"), options: { override: "input1" } };
    const untypedInput2 = { resource: URI.file("/input2"), options: { override: "input2" } };
    const diffInput1 = instantiationService.createInstance(DiffEditorInput, "name", "description", input1, input2, void 0);
    const diffInput2 = instantiationService.createInstance(DiffEditorInput, "name", "description", input2, input1, void 0);
    const untypedDiffInput1 = {
      original: untypedInput1,
      modified: untypedInput2
    };
    const untypedDiffInput2 = {
      original: untypedInput2,
      modified: untypedInput1
    };
    const sideBySideInputSame = instantiationService.createInstance(SideBySideEditorInput, "name", void 0, input1, input1);
    const sideBySideInputDifferent = instantiationService.createInstance(SideBySideEditorInput, "name", void 0, input1, input2);
    const untypedSideBySideInputSame = {
      primary: untypedInput1,
      secondary: untypedInput1
    };
    const untypedSideBySideInputDifferent = {
      primary: untypedInput2,
      secondary: untypedInput1
    };
    group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedInput1), true);
    assert.strictEqual(group.contains(untypedInput1, { strictEquals: true }), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.BOTH }), true);
    assert.strictEqual(group.contains(untypedInput2), false);
    assert.strictEqual(group.contains(untypedInput2, { strictEquals: true }), false);
    assert.strictEqual(group.contains(untypedInput2, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(untypedInput2, { supportSideBySide: SideBySideEditor.BOTH }), false);
    assert.strictEqual(group.contains(untypedDiffInput1), false);
    assert.strictEqual(group.contains(untypedDiffInput2), false);
    group.openEditor(input2, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedInput1), true);
    assert.strictEqual(group.contains(untypedInput2), true);
    assert.strictEqual(group.contains(untypedDiffInput1), false);
    assert.strictEqual(group.contains(untypedDiffInput2), false);
    group.openEditor(diffInput1, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedInput1), true);
    assert.strictEqual(group.contains(untypedInput2), true);
    assert.strictEqual(group.contains(untypedDiffInput1), true);
    assert.strictEqual(group.contains(untypedDiffInput2), false);
    group.openEditor(diffInput2, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedInput1), true);
    assert.strictEqual(group.contains(untypedInput2), true);
    assert.strictEqual(group.contains(untypedDiffInput1), true);
    assert.strictEqual(group.contains(untypedDiffInput2), true);
    group.closeEditor(input1);
    assert.strictEqual(group.contains(untypedInput1), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.BOTH }), false);
    assert.strictEqual(group.contains(untypedInput2), true);
    assert.strictEqual(group.contains(untypedDiffInput1), true);
    assert.strictEqual(group.contains(untypedDiffInput2), true);
    group.closeEditor(input2);
    assert.strictEqual(group.contains(untypedInput1), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput2), false);
    assert.strictEqual(group.contains(untypedInput2, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedDiffInput1), true);
    assert.strictEqual(group.contains(untypedDiffInput2), true);
    group.closeEditor(diffInput1);
    assert.strictEqual(group.contains(untypedInput1), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput2), false);
    assert.strictEqual(group.contains(untypedInput2, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedDiffInput1), false);
    assert.strictEqual(group.contains(untypedDiffInput2), true);
    group.closeEditor(diffInput2);
    assert.strictEqual(group.contains(untypedInput1), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(untypedInput2), false);
    assert.strictEqual(group.contains(untypedInput2, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(untypedDiffInput1), false);
    assert.strictEqual(group.contains(untypedDiffInput2), false);
    assert.strictEqual(group.count, 0);
    group.openEditor(sideBySideInputSame, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedSideBySideInputSame), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.BOTH }), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY, strictEquals: true }), false);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.BOTH, strictEquals: true }), false);
    group.closeEditor(sideBySideInputSame);
    assert.strictEqual(group.count, 0);
    group.openEditor(sideBySideInputDifferent, { pinned: true, active: true });
    assert.strictEqual(group.contains(untypedSideBySideInputDifferent), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(untypedInput1, { supportSideBySide: SideBySideEditor.BOTH }), false);
  });
  test("contains()", () => {
    const group = createEditorGroupModel();
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const input1 = input();
    const input2 = input();
    const diffInput1 = instantiationService.createInstance(DiffEditorInput, "name", "description", input1, input2, void 0);
    const diffInput2 = instantiationService.createInstance(DiffEditorInput, "name", "description", input2, input1, void 0);
    const sideBySideInputSame = instantiationService.createInstance(SideBySideEditorInput, "name", void 0, input1, input1);
    const sideBySideInputDifferent = instantiationService.createInstance(SideBySideEditorInput, "name", void 0, input1, input2);
    group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(group.contains(input1), true);
    assert.strictEqual(group.contains(input1, { strictEquals: true }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input2), false);
    assert.strictEqual(group.contains(input2, { strictEquals: true }), false);
    assert.strictEqual(group.contains(input2, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(diffInput1), false);
    assert.strictEqual(group.contains(diffInput2), false);
    group.openEditor(input2, { pinned: true, active: true });
    assert.strictEqual(group.contains(input1), true);
    assert.strictEqual(group.contains(input2), true);
    assert.strictEqual(group.contains(diffInput1), false);
    assert.strictEqual(group.contains(diffInput2), false);
    group.openEditor(diffInput1, { pinned: true, active: true });
    assert.strictEqual(group.contains(input1), true);
    assert.strictEqual(group.contains(input2), true);
    assert.strictEqual(group.contains(diffInput1), true);
    assert.strictEqual(group.contains(diffInput2), false);
    group.openEditor(diffInput2, { pinned: true, active: true });
    assert.strictEqual(group.contains(input1), true);
    assert.strictEqual(group.contains(input2), true);
    assert.strictEqual(group.contains(diffInput1), true);
    assert.strictEqual(group.contains(diffInput2), true);
    group.closeEditor(input1);
    assert.strictEqual(group.contains(input1), false);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input2), true);
    assert.strictEqual(group.contains(diffInput1), true);
    assert.strictEqual(group.contains(diffInput2), true);
    group.closeEditor(input2);
    assert.strictEqual(group.contains(input1), false);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input2), false);
    assert.strictEqual(group.contains(input2, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(diffInput1), true);
    assert.strictEqual(group.contains(diffInput2), true);
    group.closeEditor(diffInput1);
    assert.strictEqual(group.contains(input1), false);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input2), false);
    assert.strictEqual(group.contains(input2, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(diffInput1), false);
    assert.strictEqual(group.contains(diffInput2), true);
    group.closeEditor(diffInput2);
    assert.strictEqual(group.contains(input1), false);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(input2), false);
    assert.strictEqual(group.contains(input2, { supportSideBySide: SideBySideEditor.ANY }), false);
    assert.strictEqual(group.contains(diffInput1), false);
    assert.strictEqual(group.contains(diffInput2), false);
    const input3 = input(void 0, true, URI.parse("foo://bar"));
    const input4 = input(void 0, true, URI.parse("foo://barsomething"));
    group.openEditor(input3, { pinned: true, active: true });
    assert.strictEqual(group.contains(input4), false);
    assert.strictEqual(group.contains(input3), true);
    group.closeEditor(input3);
    assert.strictEqual(group.contains(input3), false);
    assert.strictEqual(group.count, 0);
    group.openEditor(sideBySideInputSame, { pinned: true, active: true });
    assert.strictEqual(group.contains(sideBySideInputSame), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.BOTH }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY, strictEquals: true }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.BOTH, strictEquals: true }), true);
    group.closeEditor(sideBySideInputSame);
    assert.strictEqual(group.count, 0);
    group.openEditor(sideBySideInputDifferent, { pinned: true, active: true });
    assert.strictEqual(group.contains(sideBySideInputDifferent), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.ANY, strictEquals: true }), true);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.BOTH }), false);
    assert.strictEqual(group.contains(input1, { supportSideBySide: SideBySideEditor.BOTH, strictEquals: true }), false);
  });
  test("group serialization", function() {
    inst().invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    let deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 3);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.SEQUENTIAL).length, 3);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 3);
    assert.strictEqual(deserialized.isPinned(input1), true);
    assert.strictEqual(deserialized.isPinned(input2), true);
    assert.strictEqual(deserialized.isPinned(input3), false);
    assert.strictEqual(deserialized.isActive(input3), true);
    TestEditorInputSerializer.disableSerialize = true;
    deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    TestEditorInputSerializer.disableSerialize = false;
    TestEditorInputSerializer.disableDeserialize = true;
    deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
  });
  test("group serialization (sticky editor)", function() {
    inst().invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    group.stick(input2);
    assert.ok(group.isSticky(input2));
    let deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 3);
    assert.strictEqual(deserialized.isPinned(input1), true);
    assert.strictEqual(deserialized.isActive(input1), false);
    assert.strictEqual(deserialized.isSticky(input1), false);
    assert.strictEqual(deserialized.isPinned(input2), true);
    assert.strictEqual(deserialized.isActive(input2), false);
    assert.strictEqual(deserialized.isSticky(input2), true);
    assert.strictEqual(deserialized.isPinned(input3), false);
    assert.strictEqual(deserialized.isActive(input3), true);
    assert.strictEqual(deserialized.isSticky(input3), false);
    TestEditorInputSerializer.disableSerialize = true;
    deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.stickyCount, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    TestEditorInputSerializer.disableSerialize = false;
    TestEditorInputSerializer.disableDeserialize = true;
    deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.stickyCount, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(deserialized.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
  });
  test("group serialization (locked group)", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    assert.strictEqual(events.locked.length, 0);
    group.lock(true);
    group.lock(true);
    assert.strictEqual(events.locked.length, 1);
    group.lock(false);
    group.lock(false);
    assert.strictEqual(events.locked.length, 2);
  });
  test("locked group", function() {
    const group = createEditorGroupModel();
    group.lock(true);
    let deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.isLocked, true);
    group.lock(false);
    deserialized = createEditorGroupModel(group.serialize());
    assert.strictEqual(group.id, deserialized.id);
    assert.strictEqual(deserialized.count, 0);
    assert.strictEqual(deserialized.isLocked, false);
  });
  test("index", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    assert.strictEqual(events.index.length, 0);
    group.setIndex(4);
    assert.strictEqual(events.index.length, 1);
  });
  test("label", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    assert.strictEqual(events.label.length, 0);
    group.setLabel("Window 1");
    assert.strictEqual(events.label.length, 1);
  });
  test("active", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    assert.strictEqual(events.active.length, 0);
    group.setActive(void 0);
    assert.strictEqual(events.active.length, 1);
  });
  test("One Editor", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    const input1 = input();
    const { editor: openedEditor, isNew } = group.openEditor(input1, { active: true, pinned: true });
    assert.strictEqual(openedEditor, input1);
    assert.strictEqual(isNew, true);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(group.findEditor(input1)[0], input1);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.isActive(input1), true);
    assert.strictEqual(group.isPinned(input1), true);
    assert.strictEqual(group.isPinned(0), true);
    assert.strictEqual(group.isFirst(input1), true);
    assert.strictEqual(group.isLast(input1), true);
    assert.strictEqual(events.opened[0].editor, input1);
    assert.strictEqual(events.opened[0].editorIndex, 0);
    assert.strictEqual(events.activated[0].editor, input1);
    assert.strictEqual(events.activated[0].editorIndex, 0);
    const index2 = group.indexOf(input1);
    assert.strictEqual(group.findEditor(input1)[1], index2);
    let event = group.closeEditor(input1, EditorCloseContext.UNPIN);
    assert.strictEqual(event?.editor, input1);
    assert.strictEqual(event?.editorIndex, index2);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(group.isFirst(input1), false);
    assert.strictEqual(group.isLast(input1), false);
    assert.strictEqual(events.closed[0].editor, input1);
    assert.strictEqual(events.closed[0].editorIndex, 0);
    assert.strictEqual(events.closed[0].context === EditorCloseContext.UNPIN, true);
    const input2 = input();
    group.openEditor(input2, { active: true, pinned: false });
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(group.activeEditor, input2);
    assert.strictEqual(group.isActive(input2), true);
    assert.strictEqual(group.isPinned(input2), false);
    assert.strictEqual(group.isPinned(0), false);
    assert.strictEqual(events.opened[1].editor, input2);
    assert.strictEqual(events.opened[1].editorIndex, 0);
    assert.strictEqual(events.activated[1].editor, input2);
    assert.strictEqual(events.activated[1].editorIndex, 0);
    group.closeEditor(input2);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(events.closed[1].editor, input2);
    assert.strictEqual(events.closed[1].editorIndex, 0);
    assert.strictEqual(events.closed[1].context === EditorCloseContext.REPLACE, false);
    event = group.closeEditor(input2);
    assert.ok(!event);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(events.closed[1].editor, input2);
    const input3 = input();
    group.openEditor(input3, { active: false, pinned: true });
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.isActive(input3), true);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.isPinned(0), true);
    assert.strictEqual(events.opened[2].editor, input3);
    assert.strictEqual(events.activated[2].editor, input3);
    group.closeEditor(input3);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(events.closed[2].editor, input3);
    assert.strictEqual(events.opened[2].editor, input3);
    assert.strictEqual(events.activated[2].editor, input3);
    group.closeEditor(input3);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(events.closed[2].editor, input3);
    const input4 = input();
    group.openEditor(input4);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(group.activeEditor, input4);
    assert.strictEqual(group.isActive(input4), true);
    assert.strictEqual(group.isPinned(input4), false);
    assert.strictEqual(group.isPinned(0), false);
    assert.strictEqual(events.opened[3].editor, input4);
    assert.strictEqual(events.activated[3].editor, input4);
    group.closeEditor(input4);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(events.closed[3].editor, input4);
  });
  test("Multiple Editors - Pinned and Active", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input("1");
    const input1Copy = input("1");
    const input2 = input("2");
    const input3 = input("3");
    let openedEditorResult = group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(openedEditorResult.editor, input1);
    assert.strictEqual(openedEditorResult.isNew, true);
    openedEditorResult = group.openEditor(input1Copy, { pinned: true, active: true });
    assert.strictEqual(openedEditorResult.editor, input1);
    assert.strictEqual(openedEditorResult.isNew, false);
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: true, active: true });
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 3);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.isActive(input1), false);
    assert.strictEqual(group.isPinned(input1), true);
    assert.strictEqual(group.isActive(input2), false);
    assert.strictEqual(group.isPinned(input2), true);
    assert.strictEqual(group.isActive(input3), true);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.isFirst(input1), true);
    assert.strictEqual(group.isFirst(input2), false);
    assert.strictEqual(group.isFirst(input3), false);
    assert.strictEqual(group.isLast(input1), false);
    assert.strictEqual(group.isLast(input2), false);
    assert.strictEqual(group.isLast(input3), true);
    assert.strictEqual(events.opened[0].editor, input1);
    assert.strictEqual(events.opened[1].editor, input2);
    assert.strictEqual(events.opened[2].editor, input3);
    assert.strictEqual(events.activated[0].editor, input1);
    assert.strictEqual(events.activated[0].editorIndex, 0);
    assert.strictEqual(events.activated[1].editor, input2);
    assert.strictEqual(events.activated[1].editorIndex, 1);
    assert.strictEqual(events.activated[2].editor, input3);
    assert.strictEqual(events.activated[2].editorIndex, 2);
    const mru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mru[0], input3);
    assert.strictEqual(mru[1], input2);
    assert.strictEqual(mru[2], input1);
    const sameInput1 = input("1");
    group.openEditor(sameInput1, { pinned: true, active: true });
    assert.strictEqual(events.activated[3].editor, input1);
    assert.strictEqual(events.activated[3].editorIndex, 0);
    group.unpin(sameInput1);
    assert.strictEqual(events.unpinned[0].editor, input1);
    assert.strictEqual(events.unpinned[0].editorIndex, 0);
    group.pin(sameInput1);
    assert.strictEqual(events.pinned[0].editor, input1);
    assert.strictEqual(events.pinned[0].editorIndex, 0);
    group.stick(sameInput1);
    assert.strictEqual(events.sticky[0].editor, input1);
    assert.strictEqual(events.sticky[0].editorIndex, 0);
    group.unstick(sameInput1);
    assert.strictEqual(events.unsticky[0].editor, input1);
    assert.strictEqual(events.unsticky[0].editorIndex, 0);
    group.moveEditor(sameInput1, 1);
    assert.strictEqual(events.moved[0].editor, input1);
    assert.strictEqual(events.moved[0].oldEditorIndex, 0);
    assert.strictEqual(events.moved[0].editorIndex, 1);
    group.closeEditor(sameInput1);
    assert.strictEqual(events.closed[0].editor, input1);
    assert.strictEqual(events.closed[0].editorIndex, 1);
    closeAllEditors(group);
    assert.strictEqual(events.closed.length, 3);
    assert.strictEqual(group.count, 0);
  });
  test("Multiple Editors - Preview editor moves to the side of the active one", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: false, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: true, active: true });
    assert.strictEqual(input3, group.getEditors(EditorsOrder.SEQUENTIAL)[2]);
    const input4 = input();
    group.openEditor(input4, { pinned: false, active: true });
    assert.strictEqual(input4, group.getEditors(EditorsOrder.SEQUENTIAL)[2]);
  });
  test("Multiple Editors - Pinned and Active (DEFAULT_OPEN_EDITOR_DIRECTION = Direction.LEFT)", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(ILifecycleService, disposables.add(new TestLifecycleService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    inst2.stub(IConfigurationService, config);
    config.setUserConfiguration("workbench", { editor: { openPositioning: "left" } });
    const group = disposables.add(inst2.createInstance(EditorGroupModel, void 0));
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: true, active: true });
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input1);
    closeAllEditors(group);
    assert.strictEqual(events.closed.length, 3);
    assert.strictEqual(group.count, 0);
    inst2.dispose();
  });
  test("Multiple Editors - Pinned and Not Active", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true });
    group.openEditor(input2, { pinned: true });
    group.openEditor(input3, { pinned: true });
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 3);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.isActive(input1), true);
    assert.strictEqual(group.isPinned(input1), true);
    assert.strictEqual(group.isPinned(0), true);
    assert.strictEqual(group.isActive(input2), false);
    assert.strictEqual(group.isPinned(input2), true);
    assert.strictEqual(group.isPinned(1), true);
    assert.strictEqual(group.isActive(input3), false);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.isPinned(2), true);
    assert.strictEqual(group.isPinned(input3), true);
    const mru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mru[0], input1);
    assert.strictEqual(mru[1], input3);
    assert.strictEqual(mru[2], input2);
  });
  test("Multiple Editors - Preview gets overwritten", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1);
    group.openEditor(input2);
    group.openEditor(input3);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.isActive(input3), true);
    assert.strictEqual(group.isPinned(input3), false);
    assert.strictEqual(!group.isPinned(input3), true);
    assert.strictEqual(events.opened[0].editor, input1);
    assert.strictEqual(events.opened[1].editor, input2);
    assert.strictEqual(events.opened[2].editor, input3);
    assert.strictEqual(events.closed[0].editor, input1);
    assert.strictEqual(events.closed[1].editor, input2);
    assert.strictEqual(events.closed[0].context === EditorCloseContext.REPLACE, true);
    assert.strictEqual(events.closed[1].context === EditorCloseContext.REPLACE, true);
    const mru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mru[0], input3);
    assert.strictEqual(mru.length, 1);
  });
  test("Multiple Editors - set active", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    assert.strictEqual(group.activeEditor, input3);
    let mru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mru[0], input3);
    assert.strictEqual(mru[1], input2);
    assert.strictEqual(mru[2], input1);
    group.setActive(input3);
    assert.strictEqual(events.activated.length, 3);
    group.setActive(input1);
    assert.strictEqual(events.activated[3].editor, input1);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.isActive(input1), true);
    assert.strictEqual(group.isActive(input2), false);
    assert.strictEqual(group.isActive(input3), false);
    mru = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mru[0], input1);
    assert.strictEqual(mru[1], input3);
    assert.strictEqual(mru[2], input2);
  });
  test("Multiple Editors - pin and unpin", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 3);
    group.pin(input3);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.isActive(input3), true);
    assert.strictEqual(events.pinned[0].editor, input3);
    assert.strictEqual(group.count, 3);
    group.unpin(input1);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.isPinned(input1), false);
    assert.strictEqual(group.isActive(input1), false);
    assert.strictEqual(events.unpinned[0].editor, input1);
    assert.strictEqual(group.count, 3);
    group.unpin(input2);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input3);
    assert.strictEqual(events.closed[0].editor, input1);
    assert.strictEqual(group.count, 2);
    group.unpin(input3);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input3);
    assert.strictEqual(events.closed[1].editor, input2);
    assert.strictEqual(group.count, 1);
  });
  test("Multiple Editors - closing picks next from MRU list", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    const input5 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: true, active: true });
    group.openEditor(input4, { pinned: true, active: true });
    group.openEditor(input5, { pinned: true, active: true });
    assert.strictEqual(group.activeEditor, input5);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0], input5);
    assert.strictEqual(group.count, 5);
    group.closeEditor(input5);
    assert.strictEqual(group.activeEditor, input4);
    assert.strictEqual(events.activated[5].editor, input4);
    assert.strictEqual(group.count, 4);
    group.setActive(input1);
    group.setActive(input4);
    group.closeEditor(input4);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.count, 3);
    group.closeEditor(input1);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 2);
    group.setActive(input2);
    group.closeEditor(input2);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 1);
    group.closeEditor(input3);
    assert.ok(!group.activeEditor);
    assert.strictEqual(group.count, 0);
  });
  test("Multiple Editors - closing picks next to the right", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(ILifecycleService, disposables.add(new TestLifecycleService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { focusRecentEditorAfterClose: false } });
    inst2.stub(IConfigurationService, config);
    const group = disposables.add(inst2.createInstance(EditorGroupModel, void 0));
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    const input5 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: true, active: true });
    group.openEditor(input4, { pinned: true, active: true });
    group.openEditor(input5, { pinned: true, active: true });
    assert.strictEqual(group.activeEditor, input5);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0], input5);
    assert.strictEqual(group.count, 5);
    group.closeEditor(input5);
    assert.strictEqual(group.activeEditor, input4);
    assert.strictEqual(events.activated[5].editor, input4);
    assert.strictEqual(group.count, 4);
    group.setActive(input1);
    group.closeEditor(input1);
    assert.strictEqual(group.activeEditor, input2);
    assert.strictEqual(group.count, 3);
    group.setActive(input3);
    group.closeEditor(input3);
    assert.strictEqual(group.activeEditor, input4);
    assert.strictEqual(group.count, 2);
    group.closeEditor(input4);
    assert.strictEqual(group.activeEditor, input2);
    assert.strictEqual(group.count, 1);
    group.closeEditor(input2);
    assert.ok(!group.activeEditor);
    assert.strictEqual(group.count, 0);
    inst2.dispose();
  });
  test("Multiple Editors - move editor", function() {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    const input5 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.moveEditor(input1, 1);
    assert.strictEqual(events.moved[0].editor, input1);
    assert.strictEqual(events.moved[0].oldEditorIndex, 0);
    assert.strictEqual(events.moved[0].editorIndex, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input1);
    group.setActive(input1);
    group.openEditor(input3, { pinned: true, active: true });
    group.openEditor(input4, { pinned: true, active: true });
    group.openEditor(input5, { pinned: true, active: true });
    group.moveEditor(input4, 0);
    assert.strictEqual(events.moved[1].editor, input4);
    assert.strictEqual(events.moved[1].oldEditorIndex, 3);
    assert.strictEqual(events.moved[1].editorIndex, 0);
    assert.strictEqual(events.moved[1].editor, input4);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input4);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[3], input3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[4], input5);
    group.moveEditor(input4, 3);
    group.moveEditor(input2, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[3], input4);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[4], input5);
    assert.strictEqual(events.moved.length, 4);
    group.moveEditor(input1, 0);
    assert.strictEqual(events.moved.length, 4);
    group.moveEditor(input1, -1);
    assert.strictEqual(events.moved.length, 4);
    group.moveEditor(input5, 4);
    assert.strictEqual(events.moved.length, 4);
    group.moveEditor(input5, 100);
    assert.strictEqual(events.moved.length, 4);
    group.moveEditor(input5, -1);
    assert.strictEqual(events.moved.length, 5);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input5);
    group.moveEditor(input1, 100);
    assert.strictEqual(events.moved.length, 6);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[4], input1);
  });
  test("Multiple Editors - move editor across groups", function() {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const g1_input1 = input();
    const g1_input2 = input();
    const g2_input1 = input();
    group1.openEditor(g1_input1, { active: true, pinned: true });
    group1.openEditor(g1_input2, { active: true, pinned: true });
    group2.openEditor(g2_input1, { active: true, pinned: true });
    group2.closeEditor(g2_input1);
    group1.openEditor(g2_input1, { active: true, pinned: true, index: 1 });
    assert.strictEqual(group1.count, 3);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[0], g1_input1);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[1], g2_input1);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[2], g1_input2);
  });
  test("Multiple Editors - move editor across groups (input already exists in group 1)", function() {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const g1_input1 = input();
    const g1_input2 = input();
    const g1_input3 = input();
    const g2_input1 = g1_input2;
    group1.openEditor(g1_input1, { active: true, pinned: true });
    group1.openEditor(g1_input2, { active: true, pinned: true });
    group1.openEditor(g1_input3, { active: true, pinned: true });
    group2.openEditor(g2_input1, { active: true, pinned: true });
    group2.closeEditor(g2_input1);
    group1.openEditor(g2_input1, { active: true, pinned: true, index: 0 });
    assert.strictEqual(group1.count, 3);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[0], g1_input2);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[1], g1_input1);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[2], g1_input3);
  });
  test("Multiple Editors - Pinned & Non Active", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    group.openEditor(input1);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.previewEditor, input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    assert.strictEqual(group.count, 1);
    const input2 = input();
    group.openEditor(input2, { pinned: true, active: false });
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.previewEditor, input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input2);
    assert.strictEqual(group.count, 2);
    const input3 = input();
    group.openEditor(input3, { pinned: true, active: false });
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.previewEditor, input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input2);
    assert.strictEqual(group.isPinned(input1), false);
    assert.strictEqual(group.isPinned(input2), true);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.count, 3);
  });
  test("Multiple Editors - Close Others, Close Left, Close Right", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    const input5 = input();
    group.openEditor(input1, { active: true, pinned: true });
    group.openEditor(input2, { active: true, pinned: true });
    group.openEditor(input3, { active: true, pinned: true });
    group.openEditor(input4, { active: true, pinned: true });
    group.openEditor(input5, { active: true, pinned: true });
    closeEditors(group, group.activeEditor);
    assert.strictEqual(group.activeEditor, input5);
    assert.strictEqual(group.count, 1);
    closeAllEditors(group);
    group.openEditor(input1, { active: true, pinned: true });
    group.openEditor(input2, { active: true, pinned: true });
    group.openEditor(input3, { active: true, pinned: true });
    group.openEditor(input4, { active: true, pinned: true });
    group.openEditor(input5, { active: true, pinned: true });
    group.setActive(input3);
    assert.strictEqual(group.activeEditor, input3);
    closeEditors(group, group.activeEditor, CloseDirection.LEFT);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input4);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input5);
    closeAllEditors(group);
    group.openEditor(input1, { active: true, pinned: true });
    group.openEditor(input2, { active: true, pinned: true });
    group.openEditor(input3, { active: true, pinned: true });
    group.openEditor(input4, { active: true, pinned: true });
    group.openEditor(input5, { active: true, pinned: true });
    group.setActive(input3);
    assert.strictEqual(group.activeEditor, input3);
    closeEditors(group, group.activeEditor, CloseDirection.RIGHT);
    assert.strictEqual(group.activeEditor, input3);
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], input2);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[2], input3);
  });
  test("Multiple Editors - real user example", function() {
    const group = createEditorGroupModel();
    const indexHtml = input("index.html");
    let openedEditor = group.openEditor(indexHtml).editor;
    assert.strictEqual(openedEditor, indexHtml);
    assert.strictEqual(group.activeEditor, indexHtml);
    assert.strictEqual(group.previewEditor, indexHtml);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], indexHtml);
    assert.strictEqual(group.count, 1);
    const sameIndexHtml = input("index.html");
    openedEditor = group.openEditor(sameIndexHtml).editor;
    assert.strictEqual(openedEditor, indexHtml);
    assert.strictEqual(group.activeEditor, indexHtml);
    assert.strictEqual(group.previewEditor, indexHtml);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], indexHtml);
    assert.strictEqual(group.count, 1);
    const styleCss = input("style.css");
    openedEditor = group.openEditor(styleCss).editor;
    assert.strictEqual(openedEditor, styleCss);
    assert.strictEqual(group.activeEditor, styleCss);
    assert.strictEqual(group.previewEditor, styleCss);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], styleCss);
    assert.strictEqual(group.count, 1);
    const testJs = input("test.js");
    openedEditor = group.openEditor(testJs, { active: true, pinned: true }).editor;
    assert.strictEqual(openedEditor, testJs);
    assert.strictEqual(group.previewEditor, styleCss);
    assert.strictEqual(group.activeEditor, testJs);
    assert.strictEqual(group.isPinned(styleCss), false);
    assert.strictEqual(group.isPinned(testJs), true);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], styleCss);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], testJs);
    assert.strictEqual(group.count, 2);
    const indexHtml2 = input("index.html");
    group.openEditor(indexHtml2, { active: true });
    assert.strictEqual(group.activeEditor, indexHtml2);
    assert.strictEqual(group.previewEditor, indexHtml2);
    assert.strictEqual(group.isPinned(indexHtml2), false);
    assert.strictEqual(group.isPinned(testJs), true);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[0], testJs);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], indexHtml2);
    assert.strictEqual(group.count, 2);
    const testJs2 = input("test.js");
    group.setActive(testJs2);
    assert.strictEqual(group.activeEditor, testJs);
    assert.strictEqual(group.isActive(testJs2), true);
    assert.strictEqual(group.count, 2);
    const indexHtml3 = input("index.html");
    group.pin(indexHtml3);
    assert.strictEqual(group.isPinned(indexHtml3), true);
    assert.strictEqual(group.activeEditor, testJs);
    const fileTs = input("file.ts");
    group.openEditor(fileTs, { active: true, pinned: true });
    assert.strictEqual(group.isPinned(fileTs), true);
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.activeEditor, fileTs);
    group.unpin(fileTs);
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.isPinned(fileTs), false);
    assert.strictEqual(group.activeEditor, fileTs);
    const otherTs = input("other.ts");
    group.openEditor(otherTs, { active: true });
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.activeEditor, otherTs);
    assert.ok(group.getEditors(EditorsOrder.SEQUENTIAL)[0].matches(testJs));
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], otherTs);
    assert.ok(group.getEditors(EditorsOrder.SEQUENTIAL)[2].matches(indexHtml));
    const indexHtml4 = input("index.html");
    group.setActive(indexHtml4);
    assert.strictEqual(group.activeEditor, indexHtml2);
    group.closeEditor(indexHtml);
    assert.strictEqual(group.count, 2);
    assert.strictEqual(group.activeEditor, otherTs);
    assert.ok(group.getEditors(EditorsOrder.SEQUENTIAL)[0].matches(testJs));
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL)[1], otherTs);
    group.closeEditor(otherTs);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.activeEditor, testJs);
    assert.ok(group.getEditors(EditorsOrder.SEQUENTIAL)[0].matches(testJs));
    group.unpin(testJs);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.activeEditor, testJs);
    assert.ok(group.getEditors(EditorsOrder.SEQUENTIAL)[0].matches(testJs));
    assert.strictEqual(group.isPinned(testJs), false);
    group.closeEditor(testJs);
    assert.strictEqual(group.count, 0);
    assert.strictEqual(group.activeEditor, null);
    assert.strictEqual(group.previewEditor, null);
  });
  test("Single Group, Single Editor - persist", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    const lifecycle = disposables.add(new TestLifecycleService());
    inst2.stub(ILifecycleService, lifecycle);
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right" } });
    inst2.stub(IConfigurationService, config);
    inst2.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    let group = createEditorGroupModel();
    const input1 = input();
    group.openEditor(input1);
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.activeEditor.matches(input1), true);
    assert.strictEqual(group.previewEditor.matches(input1), true);
    assert.strictEqual(group.isActive(input1), true);
    group = disposables.add(inst2.createInstance(EditorGroupModel, group.serialize()));
    assert.strictEqual(group.count, 1);
    assert.strictEqual(group.activeEditor.matches(input1), true);
    assert.strictEqual(group.previewEditor.matches(input1), true);
    assert.strictEqual(group.isActive(input1), true);
    inst2.dispose();
  });
  test("Multiple Groups, Multiple editors - persist", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    const lifecycle = disposables.add(new TestLifecycleService());
    inst2.stub(ILifecycleService, lifecycle);
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right" } });
    inst2.stub(IConfigurationService, config);
    inst2.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    let group1 = createEditorGroupModel();
    const g1_input1 = input();
    const g1_input2 = input();
    const g1_input3 = input();
    group1.openEditor(g1_input1, { active: true, pinned: true });
    group1.openEditor(g1_input2, { active: true, pinned: false });
    group1.openEditor(g1_input3, { active: false, pinned: true });
    let group2 = createEditorGroupModel();
    const g2_input1 = input();
    const g2_input2 = input();
    const g2_input3 = input();
    group2.openEditor(g2_input1, { active: true, pinned: true });
    group2.openEditor(g2_input2, { active: false, pinned: false });
    group2.openEditor(g2_input3, { active: false, pinned: true });
    assert.strictEqual(group1.count, 3);
    assert.strictEqual(group2.count, 3);
    assert.strictEqual(group1.activeEditor.matches(g1_input2), true);
    assert.strictEqual(group2.activeEditor.matches(g2_input1), true);
    assert.strictEqual(group1.previewEditor.matches(g1_input2), true);
    assert.strictEqual(group2.previewEditor.matches(g2_input2), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(g1_input2), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(g1_input3), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[2].matches(g1_input1), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(g2_input1), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(g2_input3), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[2].matches(g2_input2), true);
    group1 = disposables.add(inst2.createInstance(EditorGroupModel, group1.serialize()));
    group2 = disposables.add(inst2.createInstance(EditorGroupModel, group2.serialize()));
    assert.strictEqual(group1.count, 3);
    assert.strictEqual(group2.count, 3);
    assert.strictEqual(group1.activeEditor.matches(g1_input2), true);
    assert.strictEqual(group2.activeEditor.matches(g2_input1), true);
    assert.strictEqual(group1.previewEditor.matches(g1_input2), true);
    assert.strictEqual(group2.previewEditor.matches(g2_input2), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(g1_input2), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(g1_input3), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[2].matches(g1_input1), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(g2_input1), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(g2_input3), true);
    assert.strictEqual(group2.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[2].matches(g2_input2), true);
    inst2.dispose();
  });
  test("Single group, multiple editors - persist (some not persistable)", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    const lifecycle = disposables.add(new TestLifecycleService());
    inst2.stub(ILifecycleService, lifecycle);
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right" } });
    inst2.stub(IConfigurationService, config);
    inst2.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    let group = createEditorGroupModel();
    const serializableInput1 = input();
    const nonSerializableInput2 = input("3", true);
    const serializableInput2 = input();
    group.openEditor(serializableInput1, { active: true, pinned: true });
    group.openEditor(nonSerializableInput2, { active: true, pinned: false });
    group.openEditor(serializableInput2, { active: false, pinned: true });
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.activeEditor.matches(nonSerializableInput2), true);
    assert.strictEqual(group.previewEditor.matches(nonSerializableInput2), true);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(nonSerializableInput2), true);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(serializableInput2), true);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[2].matches(serializableInput1), true);
    group = disposables.add(inst2.createInstance(EditorGroupModel, group.serialize()));
    assert.strictEqual(group.count, 2);
    assert.strictEqual(group.activeEditor.matches(serializableInput2), true);
    assert.strictEqual(group.previewEditor, null);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0].matches(serializableInput2), true);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1].matches(serializableInput1), true);
    inst2.dispose();
  });
  test("Single group, multiple editors - persist (some not persistable, sticky editors)", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    const lifecycle = disposables.add(new TestLifecycleService());
    inst2.stub(ILifecycleService, lifecycle);
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right" } });
    inst2.stub(IConfigurationService, config);
    inst2.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    let group = createEditorGroupModel();
    const serializableInput1 = input();
    const nonSerializableInput2 = input("3", true);
    const serializableInput2 = input();
    group.openEditor(serializableInput1, { active: true, pinned: true });
    group.openEditor(nonSerializableInput2, { active: true, pinned: true, sticky: true });
    group.openEditor(serializableInput2, { active: false, pinned: true });
    assert.strictEqual(group.count, 3);
    assert.strictEqual(group.stickyCount, 1);
    group = disposables.add(inst2.createInstance(EditorGroupModel, group.serialize()));
    assert.strictEqual(group.count, 2);
    assert.strictEqual(group.stickyCount, 0);
    inst2.dispose();
  });
  test("Multiple groups, multiple editors - persist (some not persistable, causes empty group)", function() {
    const inst2 = new TestInstantiationService();
    inst2.stub(IStorageService, disposables.add(new TestStorageService()));
    inst2.stub(IWorkspaceContextService, new TestContextService());
    const lifecycle = disposables.add(new TestLifecycleService());
    inst2.stub(ILifecycleService, lifecycle);
    inst2.stub(ITelemetryService, NullTelemetryService);
    const config = new TestConfigurationService();
    config.setUserConfiguration("workbench", { editor: { openPositioning: "right" } });
    inst2.stub(IConfigurationService, config);
    inst2.invokeFunction((accessor) => Registry.as(EditorExtensions.EditorFactory).start(accessor));
    let group1 = createEditorGroupModel();
    let group2 = createEditorGroupModel();
    const serializableInput1 = input();
    const serializableInput2 = input();
    const nonSerializableInput = input("2", true);
    group1.openEditor(serializableInput1, { pinned: true });
    group1.openEditor(serializableInput2);
    group2.openEditor(nonSerializableInput);
    group1 = disposables.add(inst2.createInstance(EditorGroupModel, group1.serialize()));
    group2 = disposables.add(inst2.createInstance(EditorGroupModel, group2.serialize()));
    assert.strictEqual(group1.count, 2);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[0].matches(serializableInput1), true);
    assert.strictEqual(group1.getEditors(EditorsOrder.SEQUENTIAL)[1].matches(serializableInput2), true);
    inst2.dispose();
  });
  test("Multiple Editors - Editor Dispose", function() {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const group1Listener = groupListener(group1);
    const group2Listener = groupListener(group2);
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group1.openEditor(input1, { pinned: true, active: true });
    group1.openEditor(input2, { pinned: true, active: true });
    group1.openEditor(input3, { pinned: true, active: true });
    group2.openEditor(input1, { pinned: true, active: true });
    group2.openEditor(input2, { pinned: true, active: true });
    input1.dispose();
    assert.strictEqual(group1Listener.disposed.length, 1);
    assert.strictEqual(group1Listener.disposed[0].editorIndex, 0);
    assert.strictEqual(group2Listener.disposed.length, 1);
    assert.strictEqual(group2Listener.disposed[0].editorIndex, 0);
    assert.ok(group1Listener.disposed[0].editor.matches(input1));
    assert.ok(group2Listener.disposed[0].editor.matches(input1));
    input3.dispose();
    assert.strictEqual(group1Listener.disposed.length, 2);
    assert.strictEqual(group1Listener.disposed[1].editorIndex, 2);
    assert.strictEqual(group2Listener.disposed.length, 1);
    assert.ok(group1Listener.disposed[1].editor.matches(input3));
  });
  test("Preview tab does not have a stable position (https://github.com/microsoft/vscode/issues/8245)", function() {
    const group1 = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group1.openEditor(input1, { pinned: true, active: true });
    group1.openEditor(input2, { active: true });
    group1.setActive(input1);
    group1.openEditor(input3, { active: true });
    assert.strictEqual(group1.indexOf(input3), 1);
  });
  test("Multiple Editors - Editor Emits Dirty and Label Changed", function() {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    group1.openEditor(input1, { pinned: true, active: true });
    group2.openEditor(input2, { pinned: true, active: true });
    let dirty1Counter = 0;
    disposables.add(group1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty1Counter++;
      }
    }));
    let dirty2Counter = 0;
    disposables.add(group2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty2Counter++;
      }
    }));
    let label1ChangeCounter = 0;
    disposables.add(group1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label1ChangeCounter++;
      }
    }));
    let label2ChangeCounter = 0;
    disposables.add(group2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label2ChangeCounter++;
      }
    }));
    input1.setDirty();
    input1.setLabel();
    assert.strictEqual(dirty1Counter, 1);
    assert.strictEqual(label1ChangeCounter, 1);
    input2.setDirty();
    input2.setLabel();
    assert.strictEqual(dirty2Counter, 1);
    assert.strictEqual(label2ChangeCounter, 1);
    closeAllEditors(group2);
    input2.setDirty();
    input2.setLabel();
    assert.strictEqual(dirty2Counter, 1);
    assert.strictEqual(label2ChangeCounter, 1);
    assert.strictEqual(dirty1Counter, 1);
    assert.strictEqual(label1ChangeCounter, 1);
  });
  test("Sticky Editors", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    assert.strictEqual(group.stickyCount, 0);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL).length, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true }).length, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 3);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true }).length, 3);
    group.stick(input3);
    assert.strictEqual(group.stickyCount, 1);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true }).length, 2);
    assert.strictEqual(group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: false }).length, 3);
    assert.strictEqual(group.isSticky(input1), false);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.isPinned(input3), true);
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input2), 2);
    assert.strictEqual(group.indexOf(input3), 0);
    let sequentialAllEditors = group.getEditors(EditorsOrder.SEQUENTIAL);
    assert.strictEqual(sequentialAllEditors.length, 3);
    let sequentialEditorsExcludingSticky = group.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true });
    assert.strictEqual(sequentialEditorsExcludingSticky.length, 2);
    assert.ok(sequentialEditorsExcludingSticky.indexOf(input1) >= 0);
    assert.ok(sequentialEditorsExcludingSticky.indexOf(input2) >= 0);
    let mruAllEditors = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mruAllEditors.length, 3);
    let mruEditorsExcludingSticky = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true });
    assert.strictEqual(mruEditorsExcludingSticky.length, 2);
    assert.ok(mruEditorsExcludingSticky.indexOf(input1) >= 0);
    assert.ok(mruEditorsExcludingSticky.indexOf(input2) >= 0);
    group.stick(input3);
    assert.strictEqual(group.isSticky(input3), true);
    group.stick(input2);
    assert.strictEqual(group.stickyCount, 2);
    assert.strictEqual(group.isSticky(input1), false);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.indexOf(input1), 2);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 0);
    sequentialAllEditors = group.getEditors(EditorsOrder.SEQUENTIAL);
    assert.strictEqual(sequentialAllEditors.length, 3);
    sequentialEditorsExcludingSticky = group.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true });
    assert.strictEqual(sequentialEditorsExcludingSticky.length, 1);
    assert.ok(sequentialEditorsExcludingSticky.indexOf(input1) >= 0);
    mruAllEditors = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mruAllEditors.length, 3);
    mruEditorsExcludingSticky = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true });
    assert.strictEqual(mruEditorsExcludingSticky.length, 1);
    assert.ok(mruEditorsExcludingSticky.indexOf(input1) >= 0);
    group.stick(input1);
    assert.strictEqual(group.stickyCount, 3);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.indexOf(input1), 2);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 0);
    sequentialAllEditors = group.getEditors(EditorsOrder.SEQUENTIAL);
    assert.strictEqual(sequentialAllEditors.length, 3);
    sequentialEditorsExcludingSticky = group.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true });
    assert.strictEqual(sequentialEditorsExcludingSticky.length, 0);
    mruAllEditors = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE);
    assert.strictEqual(mruAllEditors.length, 3);
    mruEditorsExcludingSticky = group.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE, { excludeSticky: true });
    assert.strictEqual(mruEditorsExcludingSticky.length, 0);
    group.unstick(input3);
    assert.strictEqual(group.stickyCount, 2);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input2), 0);
    assert.strictEqual(group.indexOf(input3), 2);
    group.unstick(input1);
    group.unstick(input2);
    assert.strictEqual(group.stickyCount, 0);
    assert.strictEqual(group.isSticky(input1), false);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), false);
    group.moveEditor(input1, 0);
    group.moveEditor(input2, 1);
    group.moveEditor(input3, 2);
    group.stick(input1);
    group.stick(input2);
    group.setActive(input1);
    const events = groupListener(group);
    group.openEditor(input4, { pinned: true, active: true });
    assert.strictEqual(group.indexOf(input4), 2);
    group.closeEditor(input4);
    assert.strictEqual(events.closed[0].sticky, false);
    group.setActive(input2);
    group.openEditor(input4, { pinned: true, active: true });
    assert.strictEqual(group.indexOf(input4), 2);
    group.closeEditor(input4);
    assert.strictEqual(events.closed[1].sticky, false);
    assert.strictEqual(group.stickyCount, 2);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 2);
    group.moveEditor(input1, 1);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input2), 0);
    assert.strictEqual(group.indexOf(input3), 2);
    group.moveEditor(input1, 0);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 2);
    group.moveEditor(input1, 2);
    assert.strictEqual(group.isSticky(input1), false);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 2);
    assert.strictEqual(group.indexOf(input2), 0);
    assert.strictEqual(group.indexOf(input3), 1);
    group.moveEditor(input2, 2);
    assert.strictEqual(group.isSticky(input1), false);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input2), 2);
    assert.strictEqual(group.indexOf(input3), 0);
    group.moveEditor(input1, 0);
    group.moveEditor(input2, 1);
    group.moveEditor(input3, 2);
    group.stick(input1);
    group.unstick(input2);
    assert.strictEqual(group.stickyCount, 1);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 2);
    group.moveEditor(input3, 1);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 2);
    assert.strictEqual(group.indexOf(input3), 1);
    group.moveEditor(input3, 2);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 2);
    group.moveEditor(input3, 0);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), false);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.indexOf(input1), 1);
    assert.strictEqual(group.indexOf(input2), 2);
    assert.strictEqual(group.indexOf(input3), 0);
    group.moveEditor(input2, 0);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.indexOf(input1), 2);
    assert.strictEqual(group.indexOf(input2), 0);
    assert.strictEqual(group.indexOf(input3), 1);
    group.stick(input1);
    group.stick(input2);
    group.unstick(input3);
    assert.strictEqual(group.stickyCount, 2);
    group.closeEditor(input1);
    assert.strictEqual(events.closed[2].sticky, true);
    assert.strictEqual(group.stickyCount, 1);
    group.closeEditor(input2);
    assert.strictEqual(events.closed[3].sticky, true);
    assert.strictEqual(group.stickyCount, 0);
    closeAllEditors(group);
    assert.strictEqual(group.stickyCount, 0);
    group.openEditor(input1, { sticky: true });
    assert.strictEqual(group.stickyCount, 1);
    assert.strictEqual(group.isSticky(input1), true);
    group.openEditor(input2, { pinned: true, active: true });
    assert.strictEqual(group.stickyCount, 1);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), false);
    group.openEditor(input2, { sticky: true });
    assert.strictEqual(group.stickyCount, 2);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    group.openEditor(input3, { pinned: true, active: true });
    group.openEditor(input4, { pinned: false, active: true, sticky: true });
    assert.strictEqual(group.stickyCount, 3);
    assert.strictEqual(group.isSticky(input1), true);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.isSticky(input4), true);
    assert.strictEqual(group.isPinned(input4), true);
    assert.strictEqual(group.indexOf(input1), 0);
    assert.strictEqual(group.indexOf(input2), 1);
    assert.strictEqual(group.indexOf(input3), 3);
    assert.strictEqual(group.indexOf(input4), 2);
  });
  test("Sticky/Unsticky Editors sends correct editor index", function() {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true });
    group.openEditor(input2, { pinned: true, active: true });
    group.openEditor(input3, { pinned: false, active: true });
    assert.strictEqual(group.stickyCount, 0);
    const events = groupListener(group);
    group.stick(input3);
    assert.strictEqual(events.sticky[0].editorIndex, 0);
    assert.strictEqual(group.isSticky(input3), true);
    assert.strictEqual(group.stickyCount, 1);
    group.stick(input2);
    assert.strictEqual(events.sticky[1].editorIndex, 1);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.stickyCount, 2);
    group.unstick(input3);
    assert.strictEqual(events.unsticky[0].editorIndex, 1);
    assert.strictEqual(group.isSticky(input3), false);
    assert.strictEqual(group.isSticky(input2), true);
    assert.strictEqual(group.stickyCount, 1);
  });
  test("onDidMoveEditor Event", () => {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const input1group1 = input();
    const input2group1 = input();
    const input1group2 = input();
    const input2group2 = input();
    group1.openEditor(input1group1, { pinned: true, active: true, index: 0 });
    group1.openEditor(input2group1, { pinned: true, active: false, index: 1 });
    group2.openEditor(input1group2, { pinned: true, active: true, index: 0 });
    group2.openEditor(input2group2, { pinned: true, active: false, index: 1 });
    const group1Events = groupListener(group1);
    const group2Events = groupListener(group2);
    group1.moveEditor(input1group1, 1);
    assert.strictEqual(group1Events.moved[0].editor, input1group1);
    assert.strictEqual(group1Events.moved[0].oldEditorIndex, 0);
    assert.strictEqual(group1Events.moved[0].editorIndex, 1);
    group2.moveEditor(input1group2, 1);
    assert.strictEqual(group2Events.moved[0].editor, input1group2);
    assert.strictEqual(group2Events.moved[0].oldEditorIndex, 0);
    assert.strictEqual(group2Events.moved[0].editorIndex, 1);
  });
  test("onDidOpeneditor Event", () => {
    const group1 = createEditorGroupModel();
    const group2 = createEditorGroupModel();
    const group1Events = groupListener(group1);
    const group2Events = groupListener(group2);
    const input1group1 = input();
    const input2group1 = input();
    const input1group2 = input();
    const input2group2 = input();
    group1.openEditor(input1group1, { pinned: true, active: true, index: 0 });
    group1.openEditor(input2group1, { pinned: true, active: false, index: 1 });
    group2.openEditor(input1group2, { pinned: true, active: true, index: 0 });
    group2.openEditor(input2group2, { pinned: true, active: false, index: 1 });
    assert.strictEqual(group1Events.opened.length, 2);
    assert.strictEqual(group1Events.opened[0].editor, input1group1);
    assert.strictEqual(group1Events.opened[0].editorIndex, 0);
    assert.strictEqual(group1Events.opened[1].editor, input2group1);
    assert.strictEqual(group1Events.opened[1].editorIndex, 1);
    assert.strictEqual(group2Events.opened.length, 2);
    assert.strictEqual(group2Events.opened[0].editor, input1group2);
    assert.strictEqual(group2Events.opened[0].editorIndex, 0);
    assert.strictEqual(group2Events.opened[1].editor, input2group2);
    assert.strictEqual(group2Events.opened[1].editorIndex, 1);
  });
  test("moving editor sends sticky event when sticky changes", () => {
    const group1 = createEditorGroupModel();
    const input1group1 = input();
    const input2group1 = input();
    const input3group1 = input();
    group1.openEditor(input1group1, { pinned: true, active: true, index: 0, sticky: true });
    group1.openEditor(input2group1, { pinned: true, active: false, index: 1 });
    group1.openEditor(input3group1, { pinned: true, active: false, index: 2 });
    const group1Events = groupListener(group1);
    group1.moveEditor(input2group1, 0);
    assert.strictEqual(group1Events.sticky[0].editor, input2group1);
    assert.strictEqual(group1Events.sticky[0].editorIndex, 0);
    const group2 = createEditorGroupModel();
    const input1group2 = input();
    const input2group2 = input();
    const input3group2 = input();
    group2.openEditor(input1group2, { pinned: true, active: true, index: 0, sticky: true });
    group2.openEditor(input2group2, { pinned: true, active: false, index: 1 });
    group2.openEditor(input3group2, { pinned: true, active: false, index: 2 });
    const group2Events = groupListener(group2);
    group2.moveEditor(input1group2, 1);
    assert.strictEqual(group2Events.unsticky[0].editor, input1group2);
    assert.strictEqual(group2Events.unsticky[0].editorIndex, 1);
  });
  function assertSelection(group, activeEditor, selectedEditors) {
    assert.strictEqual(group.activeEditor, activeEditor);
    assert.strictEqual(group.selectedEditors.length, selectedEditors.length);
    for (let i = 0; i < selectedEditors.length; i++) {
      assert.strictEqual(group.selectedEditors[i], selectedEditors[i]);
    }
  }
  test("editor selection: selectedEditors", () => {
    const group = createEditorGroupModel();
    const activeEditor = group.activeEditor;
    const selectedEditors = group.selectedEditors;
    assert.strictEqual(activeEditor, null);
    assert.strictEqual(selectedEditors.length, 0);
    const input1 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    assertSelection(group, input1, [input1]);
    const input2 = input();
    const input3 = input();
    group.openEditor(input2, { pinned: true, active: true, index: 1 });
    group.openEditor(input3, { pinned: true, active: true, index: 2 });
    assertSelection(group, input3, [input3]);
    group.setSelection(input2, [input1]);
    assertSelection(group, input2, [input1, input2]);
  });
  test("editor selection: openEditor with inactive selection", () => {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    group.openEditor(input2, { pinned: true, active: true, index: 1 });
    group.openEditor(input3, { pinned: true, active: true, index: 2 });
    group.openEditor(input2, { active: true, inactiveSelection: [input3, input1] });
    assertSelection(group, input2, [input1, input2, input3]);
    group.openEditor(input1, { active: true, inactiveSelection: [input3, input1, input3] });
    assertSelection(group, input1, [input1, input3]);
    const input4 = input();
    group.openEditor(input4, { pinned: true, active: false, inactiveSelection: [input2], index: 3 });
    assertSelection(group, input1, [input1, input2]);
    const input5 = input();
    group.openEditor(input5, { pinned: true, active: true, inactiveSelection: [input4], index: 4 });
    assertSelection(group, input5, [input4, input5]);
  });
  test("editor selection: closeEditor keeps selection", () => {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    group.openEditor(input2, { pinned: true, active: true, index: 1 });
    group.openEditor(input3, { pinned: true, active: true, index: 2 });
    group.setSelection(input2, [input3, input1]);
    group.closeEditor(input3);
    assertSelection(group, input2, [input1, input2]);
  });
  test("editor selection: setSeletion", () => {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    group.openEditor(input2, { pinned: true, active: true, index: 1 });
    group.openEditor(input3, { pinned: true, active: true, index: 2 });
    group.setSelection(input2, [input3, input1]);
    assertSelection(group, input2, [input1, input2, input3]);
    group.setSelection(input3, []);
    assertSelection(group, input3, [input3]);
    group.setSelection(input2, [input1, input2, input1]);
    assertSelection(group, input2, [input1, input2]);
  });
  test("editor selection: isSelected", () => {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    const input3 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    group.openEditor(input2, { pinned: true, active: true, index: 1 });
    group.openEditor(input3, { pinned: true, active: true, index: 2 });
    group.setSelection(input2, [input3, input1]);
    assert.strictEqual(group.isSelected(input1), true);
    assert.strictEqual(group.isSelected(input2), true);
    assert.strictEqual(group.isSelected(input3), true);
    group.setSelection(input3, []);
    assert.strictEqual(group.isSelected(input1), false);
    assert.strictEqual(group.isSelected(input2), false);
    assert.strictEqual(group.isSelected(input3), true);
    assert.strictEqual(group.isSelected(0), false);
    assert.strictEqual(group.isSelected(1), false);
    assert.strictEqual(group.isSelected(2), true);
  });
  test("editor selection: select invalid editor", () => {
    const group = createEditorGroupModel();
    const input1 = input();
    const input2 = input();
    group.openEditor(input1, { pinned: true, active: true, index: 0 });
    group.setSelection(input2, [input1]);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.selectedEditors.length, 1);
    assert.strictEqual(group.isSelected(input1), true);
    assert.strictEqual(group.isSelected(input1), true);
    assert.strictEqual(group.isSelected(input2), false);
    group.setSelection(input1, [input2]);
    assert.strictEqual(group.activeEditor, input1);
    assert.strictEqual(group.selectedEditors.length, 1);
    assert.strictEqual(group.isSelected(input1), true);
    assert.strictEqual(group.isSelected(input1), true);
    assert.strictEqual(group.isSelected(input2), false);
  });
  test("editor transient: basics", () => {
    const group = createEditorGroupModel();
    const events = groupListener(group);
    const input1 = input();
    const input2 = input();
    group.openEditor(input1, { pinned: true, active: true });
    assert.strictEqual(group.isTransient(input1), false);
    assert.strictEqual(events.transient.length, 0);
    group.openEditor(input2, { pinned: true, active: true, transient: true });
    assert.strictEqual(events.transient[0].editor, input2);
    assert.strictEqual(group.isTransient(input2), true);
    group.setTransient(input1, true);
    assert.strictEqual(group.isTransient(input1), true);
    assert.strictEqual(events.transient[1].editor, input1);
    group.setTransient(input2, false);
    assert.strictEqual(group.isTransient(input2), false);
    assert.strictEqual(events.transient[2].editor, input2);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JHcm91cE1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFZGl0b3JHcm91cE1vZGVsLCBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudCwgSUdyb3VwRWRpdG9yQ2xvc2VFdmVudCwgSUdyb3VwRWRpdG9yTW92ZUV2ZW50LCBJR3JvdXBFZGl0b3JPcGVuRXZlbnQsIElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCwgaXNHcm91cEVkaXRvckNoYW5nZUV2ZW50LCBpc0dyb3VwRWRpdG9yQ2xvc2VFdmVudCwgaXNHcm91cEVkaXRvck1vdmVFdmVudCwgaXNHcm91cEVkaXRvck9wZW5FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yR3JvdXBNb2RlbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBJRmlsZUVkaXRvcklucHV0LCBJRWRpdG9yU2VyaWFsaXplciwgQ2xvc2VEaXJlY3Rpb24sIEVkaXRvcnNPcmRlciwgSVJlc291cmNlRGlmZkVkaXRvcklucHV0LCBJUmVzb3VyY2VTaWRlQnlTaWRlRWRpdG9ySW5wdXQsIFNpZGVCeVNpZGVFZGl0b3IsIEVkaXRvckNsb3NlQ29udGV4dCwgR3JvdXBNb2RlbENoYW5nZUtpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBUZXN0TGlmZWN5Y2xlU2VydmljZSwgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBOdWxsVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgRGlmZkVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9kaWZmRWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGVzdENvbnRleHRTZXJ2aWNlLCBUZXN0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBTaWRlQnlTaWRlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL3NpZGVCeVNpZGVFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5zdWl0ZSgnRWRpdG9yR3JvdXBNb2RlbCcsICgpID0+IHtcblxuXHRsZXQgdGVzdEluc3RTZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfCB1bmRlZmluZWQ7XG5cblx0c3VpdGVUZWFyZG93bigoKSA9PiB7XG5cdFx0dGVzdEluc3RTZXJ2aWNlPy5kaXNwb3NlKCk7XG5cdFx0dGVzdEluc3RTZXJ2aWNlID0gdW5kZWZpbmVkO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBpbnN0KCk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0aWYgKCF0ZXN0SW5zdFNlcnZpY2UpIHtcblx0XHRcdHRlc3RJbnN0U2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHR9XG5cdFx0Y29uc3QgaW5zdCA9IHRlc3RJbnN0U2VydmljZTtcblx0XHRpbnN0LnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElMaWZlY3ljbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpKTtcblx0XHRpbnN0LnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGluc3Quc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgb3BlblBvc2l0aW9uaW5nOiAncmlnaHQnLCBmb2N1c1JlY2VudEVkaXRvckFmdGVyQ2xvc2U6IHRydWUgfSB9KTtcblx0XHRpbnN0LnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXG5cdFx0cmV0dXJuIGluc3Q7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKHNlcmlhbGl6ZWQ/OiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwpOiBFZGl0b3JHcm91cE1vZGVsIHtcblx0XHRjb25zdCBncm91cCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0KCkuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgc2VyaWFsaXplZCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdFx0Z3JvdXAuY2xvc2VFZGl0b3IoZWRpdG9yKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gZ3JvdXA7XG5cdH1cblxuXHRmdW5jdGlvbiBjbG9zZUFsbEVkaXRvcnMoZ3JvdXA6IEVkaXRvckdyb3VwTW9kZWwpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKSkge1xuXHRcdFx0Z3JvdXAuY2xvc2VFZGl0b3IoZWRpdG9yLCB1bmRlZmluZWQsIGZhbHNlKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBjbG9zZUVkaXRvcnMoZ3JvdXA6IEVkaXRvckdyb3VwTW9kZWwsIGV4Y2VwdDogRWRpdG9ySW5wdXQsIGRpcmVjdGlvbj86IENsb3NlRGlyZWN0aW9uKTogdm9pZCB7XG5cdFx0Y29uc3QgaW5kZXggPSBncm91cC5pbmRleE9mKGV4Y2VwdCk7XG5cdFx0aWYgKGluZGV4ID09PSAtMSkge1xuXHRcdFx0cmV0dXJuOyAvLyBub3QgZm91bmRcblx0XHR9XG5cblx0XHQvLyBDbG9zZSB0byB0aGUgbGVmdFxuXHRcdGlmIChkaXJlY3Rpb24gPT09IENsb3NlRGlyZWN0aW9uLkxFRlQpIHtcblx0XHRcdGZvciAobGV0IGkgPSBpbmRleCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRcdGdyb3VwLmNsb3NlRWRpdG9yKGdyb3VwLmdldEVkaXRvckJ5SW5kZXgoaSkhKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBDbG9zZSB0byB0aGUgcmlnaHRcblx0XHRlbHNlIGlmIChkaXJlY3Rpb24gPT09IENsb3NlRGlyZWN0aW9uLlJJR0hUKSB7XG5cdFx0XHRmb3IgKGxldCBpID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoIC0gMTsgaSA+IGluZGV4OyBpLS0pIHtcblx0XHRcdFx0Z3JvdXAuY2xvc2VFZGl0b3IoZ3JvdXAuZ2V0RWRpdG9yQnlJbmRleChpKSEpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIEJvdGggZGlyZWN0aW9uc1xuXHRcdGVsc2Uge1xuXHRcdFx0Z3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmZpbHRlcihlZGl0b3IgPT4gIWVkaXRvci5tYXRjaGVzKGV4Y2VwdCkpLmZvckVhY2goZWRpdG9yID0+IGdyb3VwLmNsb3NlRWRpdG9yKGVkaXRvcikpO1xuXHRcdH1cblx0fVxuXG5cdGludGVyZmFjZSBHcm91cEV2ZW50cyB7XG5cdFx0bG9ja2VkOiBudW1iZXJbXTtcblx0XHRhY3RpdmU6IG51bWJlcltdO1xuXHRcdGluZGV4OiBudW1iZXJbXTtcblx0XHRsYWJlbDogbnVtYmVyW107XG5cdFx0b3BlbmVkOiBJR3JvdXBFZGl0b3JPcGVuRXZlbnRbXTtcblx0XHRhY3RpdmF0ZWQ6IElHcm91cEVkaXRvckNoYW5nZUV2ZW50W107XG5cdFx0Y2xvc2VkOiBJR3JvdXBFZGl0b3JDbG9zZUV2ZW50W107XG5cdFx0cGlubmVkOiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudFtdO1xuXHRcdHVucGlubmVkOiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudFtdO1xuXHRcdHN0aWNreTogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnRbXTtcblx0XHR1bnN0aWNreTogSUdyb3VwRWRpdG9yQ2hhbmdlRXZlbnRbXTtcblx0XHR0cmFuc2llbnQ6IElHcm91cEVkaXRvckNoYW5nZUV2ZW50W107XG5cdFx0bW92ZWQ6IElHcm91cEVkaXRvck1vdmVFdmVudFtdO1xuXHRcdGRpc3Bvc2VkOiBJR3JvdXBFZGl0b3JDaGFuZ2VFdmVudFtdO1xuXHR9XG5cblx0ZnVuY3Rpb24gZ3JvdXBMaXN0ZW5lcihncm91cDogRWRpdG9yR3JvdXBNb2RlbCk6IEdyb3VwRXZlbnRzIHtcblx0XHRjb25zdCBncm91cEV2ZW50czogR3JvdXBFdmVudHMgPSB7XG5cdFx0XHRhY3RpdmU6IFtdLFxuXHRcdFx0aW5kZXg6IFtdLFxuXHRcdFx0bGFiZWw6IFtdLFxuXHRcdFx0bG9ja2VkOiBbXSxcblx0XHRcdG9wZW5lZDogW10sXG5cdFx0XHRjbG9zZWQ6IFtdLFxuXHRcdFx0YWN0aXZhdGVkOiBbXSxcblx0XHRcdHBpbm5lZDogW10sXG5cdFx0XHR1bnBpbm5lZDogW10sXG5cdFx0XHRzdGlja3k6IFtdLFxuXHRcdFx0dW5zdGlja3k6IFtdLFxuXHRcdFx0dHJhbnNpZW50OiBbXSxcblx0XHRcdG1vdmVkOiBbXSxcblx0XHRcdGRpc3Bvc2VkOiBbXVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZ3JvdXAub25EaWRNb2RlbENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkdST1VQX0xPQ0tFRCkge1xuXHRcdFx0XHRncm91cEV2ZW50cy5sb2NrZWQucHVzaChncm91cC5pZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9BQ1RJVkUpIHtcblx0XHRcdFx0Z3JvdXBFdmVudHMuYWN0aXZlLnB1c2goZ3JvdXAuaWQpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9IGVsc2UgaWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuR1JPVVBfSU5ERVgpIHtcblx0XHRcdFx0Z3JvdXBFdmVudHMuaW5kZXgucHVzaChncm91cC5pZCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH0gZWxzZSBpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5HUk9VUF9MQUJFTCkge1xuXHRcdFx0XHRncm91cEV2ZW50cy5sYWJlbC5wdXNoKGdyb3VwLmlkKTtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFlLmVkaXRvcikge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRzd2l0Y2ggKGUua2luZCkge1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9PUEVOOlxuXHRcdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yT3BlbkV2ZW50KGUpKSB7XG5cdFx0XHRcdFx0XHRncm91cEV2ZW50cy5vcGVuZWQucHVzaChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0NMT1NFOlxuXHRcdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yQ2xvc2VFdmVudChlKSkge1xuXHRcdFx0XHRcdFx0Z3JvdXBFdmVudHMuY2xvc2VkLnB1c2goZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9BQ1RJVkU6XG5cdFx0XHRcdFx0aWYgKGlzR3JvdXBFZGl0b3JDaGFuZ2VFdmVudChlKSkge1xuXHRcdFx0XHRcdFx0Z3JvdXBFdmVudHMuYWN0aXZhdGVkLnB1c2goZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9QSU46XG5cdFx0XHRcdFx0aWYgKGlzR3JvdXBFZGl0b3JDaGFuZ2VFdmVudChlKSkge1xuXHRcdFx0XHRcdFx0Z3JvdXAuaXNQaW5uZWQoZS5lZGl0b3IpID8gZ3JvdXBFdmVudHMucGlubmVkLnB1c2goZSkgOiBncm91cEV2ZW50cy51bnBpbm5lZC5wdXNoKGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfU1RJQ0tZOlxuXHRcdFx0XHRcdGlmIChpc0dyb3VwRWRpdG9yQ2hhbmdlRXZlbnQoZSkpIHtcblx0XHRcdFx0XHRcdGdyb3VwLmlzU3RpY2t5KGUuZWRpdG9yKSA/IGdyb3VwRXZlbnRzLnN0aWNreS5wdXNoKGUpIDogZ3JvdXBFdmVudHMudW5zdGlja3kucHVzaChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX1RSQU5TSUVOVDpcblx0XHRcdFx0XHRpZiAoaXNHcm91cEVkaXRvckNoYW5nZUV2ZW50KGUpKSB7XG5cdFx0XHRcdFx0XHRncm91cEV2ZW50cy50cmFuc2llbnQucHVzaChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX01PVkU6XG5cdFx0XHRcdFx0aWYgKGlzR3JvdXBFZGl0b3JNb3ZlRXZlbnQoZSkpIHtcblx0XHRcdFx0XHRcdGdyb3VwRXZlbnRzLm1vdmVkLnB1c2goZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9XSUxMX0RJU1BPU0U6XG5cdFx0XHRcdFx0aWYgKGlzR3JvdXBFZGl0b3JDaGFuZ2VFdmVudChlKSkge1xuXHRcdFx0XHRcdFx0Z3JvdXBFdmVudHMuZGlzcG9zZWQucHVzaChlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGdyb3VwRXZlbnRzO1xuXHR9XG5cblx0bGV0IGluZGV4ID0gMDtcblx0Y2xhc3MgVGVzdEVkaXRvcklucHV0IGV4dGVuZHMgRWRpdG9ySW5wdXQge1xuXG5cdFx0cmVhZG9ubHkgcmVzb3VyY2UgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdHJ1Y3RvcihwdWJsaWMgaWQ6IHN0cmluZykge1xuXHRcdFx0c3VwZXIoKTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuICd0ZXN0RWRpdG9ySW5wdXRGb3JHcm91cHMnOyB9XG5cdFx0b3ZlcnJpZGUgYXN5bmMgcmVzb2x2ZSgpOiBQcm9taXNlPElEaXNwb3NhYmxlPiB7IHJldHVybiBudWxsITsgfVxuXG5cdFx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcjogVGVzdEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0XHRyZXR1cm4gb3RoZXIgJiYgdGhpcy5pZCA9PT0gb3RoZXIuaWQgJiYgb3RoZXIgaW5zdGFuY2VvZiBUZXN0RWRpdG9ySW5wdXQ7XG5cdFx0fVxuXG5cdFx0c2V0RGlydHkoKTogdm9pZCB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZURpcnR5LmZpcmUoKTtcblx0XHR9XG5cblx0XHRzZXRMYWJlbCgpOiB2b2lkIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlTGFiZWwuZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIE5vblNlcmlhbGl6YWJsZVRlc3RFZGl0b3JJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblxuXHRcdHJlYWRvbmx5IHJlc291cmNlID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3RydWN0b3IocHVibGljIGlkOiBzdHJpbmcpIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0fVxuXHRcdG92ZXJyaWRlIGdldCB0eXBlSWQoKSB7IHJldHVybiAndGVzdEVkaXRvcklucHV0Rm9yR3JvdXBzLW5vblNlcmlhbGl6YWJsZSc7IH1cblx0XHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8SURpc3Bvc2FibGUgfCBudWxsPiB7IHJldHVybiBudWxsOyB9XG5cblx0XHRvdmVycmlkZSBtYXRjaGVzKG90aGVyOiBOb25TZXJpYWxpemFibGVUZXN0RWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBvdGhlciAmJiB0aGlzLmlkID09PSBvdGhlci5pZCAmJiBvdGhlciBpbnN0YW5jZW9mIE5vblNlcmlhbGl6YWJsZVRlc3RFZGl0b3JJbnB1dDtcblx0XHR9XG5cdH1cblxuXHRjbGFzcyBUZXN0RmlsZUVkaXRvcklucHV0IGV4dGVuZHMgRWRpdG9ySW5wdXQgaW1wbGVtZW50cyBJRmlsZUVkaXRvcklucHV0IHtcblxuXHRcdHJlYWRvbmx5IHByZWZlcnJlZFJlc291cmNlO1xuXG5cdFx0Y29uc3RydWN0b3IocHVibGljIGlkOiBzdHJpbmcsIHB1YmxpYyByZXNvdXJjZTogVVJJKSB7XG5cdFx0XHRzdXBlcigpO1xuXG5cdFx0XHR0aGlzLnByZWZlcnJlZFJlc291cmNlID0gdGhpcy5yZXNvdXJjZTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuICd0ZXN0RmlsZUVkaXRvcklucHV0Rm9yR3JvdXBzJzsgfVxuXHRcdG92ZXJyaWRlIGdldCBlZGl0b3JJZCgpIHsgcmV0dXJuIHRoaXMuaWQ7IH1cblx0XHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8SURpc3Bvc2FibGUgfCBudWxsPiB7IHJldHVybiBudWxsOyB9XG5cdFx0c2V0UHJlZmVycmVkTmFtZShuYW1lOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRcdHNldFByZWZlcnJlZERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRcdHNldFByZWZlcnJlZFJlc291cmNlKHJlc291cmNlOiBVUkkpOiB2b2lkIHsgfVxuXHRcdGFzeW5jIHNldEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcpIHsgfVxuXHRcdGdldEVuY29kaW5nKCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0c2V0UHJlZmVycmVkRW5jb2RpbmcoZW5jb2Rpbmc6IHN0cmluZykgeyB9XG5cdFx0c2V0Rm9yY2VPcGVuQXNCaW5hcnkoKTogdm9pZCB7IH1cblx0XHRzZXRQcmVmZXJyZWRDb250ZW50cyhjb250ZW50czogc3RyaW5nKTogdm9pZCB7IH1cblx0XHRzZXRMYW5ndWFnZUlkKGxhbmd1YWdlSWQ6IHN0cmluZykgeyB9XG5cdFx0c2V0UHJlZmVycmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcpIHsgfVxuXHRcdGlzUmVzb2x2ZWQoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXG5cdFx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcjogVGVzdEZpbGVFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0aWYgKHN1cGVyLm1hdGNoZXMob3RoZXIpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3RoZXIgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybiBpc0VxdWFsKG90aGVyLnJlc291cmNlLCB0aGlzLnJlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGlucHV0KGlkID0gU3RyaW5nKGluZGV4KyspLCBub25TZXJpYWxpemFibGU/OiBib29sZWFuLCByZXNvdXJjZT86IFVSSSk6IEVkaXRvcklucHV0IHtcblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoaWQsIHJlc291cmNlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vblNlcmlhbGl6YWJsZSA/IGRpc3Bvc2FibGVzLmFkZChuZXcgTm9uU2VyaWFsaXphYmxlVGVzdEVkaXRvcklucHV0KGlkKSkgOiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChpZCkpO1xuXHR9XG5cblx0aW50ZXJmYWNlIElTZXJpYWxpemVkVGVzdElucHV0IHtcblx0XHRpZDogc3RyaW5nO1xuXHR9XG5cblx0Y2xhc3MgVGVzdEVkaXRvcklucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblxuXHRcdHN0YXRpYyBkaXNhYmxlU2VyaWFsaXplID0gZmFsc2U7XG5cdFx0c3RhdGljIGRpc2FibGVEZXNlcmlhbGl6ZSA9IGZhbHNlO1xuXG5cdFx0Y2FuU2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0c2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRpZiAoVGVzdEVkaXRvcklucHV0U2VyaWFsaXplci5kaXNhYmxlU2VyaWFsaXplKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRlc3RFZGl0b3JJbnB1dCA9IDxUZXN0RWRpdG9ySW5wdXQ+ZWRpdG9ySW5wdXQ7XG5cdFx0XHRjb25zdCB0ZXN0SW5wdXQ6IElTZXJpYWxpemVkVGVzdElucHV0ID0ge1xuXHRcdFx0XHRpZDogdGVzdEVkaXRvcklucHV0LmlkXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodGVzdElucHV0KTtcblx0XHR9XG5cblx0XHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBzZXJpYWxpemVkRWRpdG9ySW5wdXQ6IHN0cmluZyk6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRcdGlmIChUZXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyLmRpc2FibGVEZXNlcmlhbGl6ZSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0ZXN0SW5wdXQ6IElTZXJpYWxpemVkVGVzdElucHV0ID0gSlNPTi5wYXJzZShzZXJpYWxpemVkRWRpdG9ySW5wdXQpO1xuXG5cdFx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9ySW5wdXQodGVzdElucHV0LmlkKSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIuZGlzYWJsZVNlcmlhbGl6ZSA9IGZhbHNlO1xuXHRcdFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIuZGlzYWJsZURlc2VyaWFsaXplID0gZmFsc2U7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoJ3Rlc3RFZGl0b3JJbnB1dEZvckdyb3VwcycsIFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpbmRleCA9IDE7XG5cdH0pO1xuXG5cdHRlc3QoJ0Nsb25lIEdyb3VwJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKSBhcyBUZXN0RWRpdG9ySW5wdXQ7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Ly8gUGlubmVkIGFuZCBBY3RpdmVcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IGZhbHNlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHQvLyBTdGlja3lcblx0XHRncm91cC5zdGljayhpbnB1dDIpO1xuXHRcdGFzc2VydC5vayhncm91cC5pc1N0aWNreShpbnB1dDIpKTtcblxuXHRcdC8vIExvY2tlZFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0xvY2tlZCwgZmFsc2UpO1xuXHRcdGdyb3VwLmxvY2sodHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzTG9ja2VkLCB0cnVlKTtcblxuXHRcdGNvbnN0IGNsb25lID0gZGlzcG9zYWJsZXMuYWRkKGdyb3VwLmNsb25lKCkpO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChncm91cC5pZCwgY2xvbmUuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsb25lLmlzTG9ja2VkLCBmYWxzZSk7IC8vIGxvY2tpbmcgZG9lcyBub3QgY2xvbmUgb3ZlclxuXG5cdFx0bGV0IGRpZEVkaXRvckxhYmVsQ2hhbmdlID0gZmFsc2U7XG5cdFx0Y29uc3QgdG9EaXNwb3NlID0gY2xvbmUub25EaWRNb2RlbENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0xBQkVMKSB7XG5cdFx0XHRcdGRpZEVkaXRvckxhYmVsQ2hhbmdlID0gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRpbnB1dDEuc2V0TGFiZWwoKTtcblx0XHRhc3NlcnQub2soZGlkRWRpdG9yTGFiZWxDaGFuZ2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsb25lLmlzUGlubmVkKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5pc0FjdGl2ZShpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsb25lLmlzU3RpY2t5KGlucHV0MSksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5pc1Bpbm5lZChpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2xvbmUuaXNBY3RpdmUoaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5pc1Bpbm5lZChpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNsb25lLmlzQWN0aXZlKGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjbG9uZS5pc1N0aWNreShpbnB1dDMpLCBmYWxzZSk7XG5cblx0XHR0b0Rpc3Bvc2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc0FjdGl2ZSAtIHVudHlwZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgaW5wdXQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoJ3Rlc3RJbnB1dCcsIFVSSS5maWxlKCdmYWtlJykpKTtcblx0XHRjb25zdCBpbnB1dDIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoJ3Rlc3RJbnB1dDInLCBVUkkuZmlsZSgnZmFrZTInKSkpO1xuXHRcdGNvbnN0IHVudHlwZWRJbnB1dCA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCcvZmFrZScpLCBvcHRpb25zOiB7IG92ZXJyaWRlOiAndGVzdElucHV0JyB9IH07XG5cdFx0Y29uc3QgdW50eXBlZE5vbkFjdGl2ZUlucHV0ID0geyByZXNvdXJjZTogVVJJLmZpbGUoJy9mYWtlMicpLCBvcHRpb25zOiB7IG92ZXJyaWRlOiAndGVzdElucHV0MicgfSB9O1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBhY3RpdmU6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKGdyb3VwLmlzQWN0aXZlKGlucHV0KSk7XG5cdFx0YXNzZXJ0Lm9rKGdyb3VwLmlzQWN0aXZlKHVudHlwZWRJbnB1dCkpO1xuXHRcdGFzc2VydC5vayghZ3JvdXAuaXNBY3RpdmUodW50eXBlZE5vbkFjdGl2ZUlucHV0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ29wZW5FZGl0b3IgLSBwcmVmZXJzIGV4aXN0aW5nIHNpZGUgYnkgc2lkZSBlZGl0b3IgaWYgc2FtZScsICgpID0+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgaW5wdXQxID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZUVkaXRvcklucHV0KCd0ZXN0SW5wdXQnLCBVUkkuZmlsZSgnZmFrZTEnKSkpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEZpbGVFZGl0b3JJbnB1dCgndGVzdElucHV0JywgVVJJLmZpbGUoJ2Zha2UyJykpKTtcblxuXHRcdGNvbnN0IHNpZGVCeVNpZGVJbnB1dFNhbWUgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaWRlQnlTaWRlRWRpdG9ySW5wdXQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBpbnB1dDEsIGlucHV0MSk7XG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0RGlmZmVyZW50ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2lkZUJ5U2lkZUVkaXRvcklucHV0LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgaW5wdXQxLCBpbnB1dDIpO1xuXG5cdFx0bGV0IHJlcyA9IGdyb3VwLm9wZW5FZGl0b3Ioc2lkZUJ5U2lkZUlucHV0U2FtZSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVkaXRvciwgc2lkZUJ5U2lkZUlucHV0U2FtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5pc05ldywgdHJ1ZSk7XG5cblx0XHRyZXMgPSBncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVkaXRvciwgc2lkZUJ5U2lkZUlucHV0U2FtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5pc05ldywgZmFsc2UpO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3Ioc2lkZUJ5U2lkZUlucHV0U2FtZSk7XG5cdFx0cmVzID0gZ3JvdXAub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXREaWZmZXJlbnQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5lZGl0b3IsIHNpZGVCeVNpZGVJbnB1dERpZmZlcmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5pc05ldywgdHJ1ZSk7XG5cblx0XHRyZXMgPSBncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmlzTmV3LCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5kZXhPZigpIC0gcHJlZmVycyBkaXJlY3QgbWF0Y2hpbmcgZWRpdG9yIG92ZXIgc2lkZSBieSBzaWRlIG1hdGNoaW5nIG9uZScsICgpID0+IHtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgaW5wdXQxID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZUVkaXRvcklucHV0KCd0ZXN0SW5wdXQnLCBVUkkuZmlsZSgnZmFrZTEnKSkpO1xuXG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2lkZUJ5U2lkZUVkaXRvcklucHV0LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgaW5wdXQxLCBpbnB1dDEpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2Yoc2lkZUJ5U2lkZUlucHV0KSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSwgdW5kZWZpbmVkLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSwgdW5kZWZpbmVkLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgMCk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDEpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDEsIHVuZGVmaW5lZCwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5CT1RIIH0pLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDEsIHVuZGVmaW5lZCwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb250YWlucygpIC0gdW50eXBlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHVuZGVmaW5lZCwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoJ2lucHV0MScsIGZhbHNlLCBVUkkuZmlsZSgnL2lucHV0MScpKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgnaW5wdXQyJywgZmFsc2UsIFVSSS5maWxlKCcvaW5wdXQyJykpO1xuXG5cdFx0Y29uc3QgdW50eXBlZElucHV0MSA9IHsgcmVzb3VyY2U6IFVSSS5maWxlKCcvaW5wdXQxJyksIG9wdGlvbnM6IHsgb3ZlcnJpZGU6ICdpbnB1dDEnIH0gfTtcblx0XHRjb25zdCB1bnR5cGVkSW5wdXQyID0geyByZXNvdXJjZTogVVJJLmZpbGUoJy9pbnB1dDInKSwgb3B0aW9uczogeyBvdmVycmlkZTogJ2lucHV0MicgfSB9O1xuXG5cdFx0Y29uc3QgZGlmZklucHV0MSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKERpZmZFZGl0b3JJbnB1dCwgJ25hbWUnLCAnZGVzY3JpcHRpb24nLCBpbnB1dDEsIGlucHV0MiwgdW5kZWZpbmVkKTtcblx0XHRjb25zdCBkaWZmSW5wdXQyID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGlmZkVkaXRvcklucHV0LCAnbmFtZScsICdkZXNjcmlwdGlvbicsIGlucHV0MiwgaW5wdXQxLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgdW50eXBlZERpZmZJbnB1dDE6IElSZXNvdXJjZURpZmZFZGl0b3JJbnB1dCA9IHtcblx0XHRcdG9yaWdpbmFsOiB1bnR5cGVkSW5wdXQxLFxuXHRcdFx0bW9kaWZpZWQ6IHVudHlwZWRJbnB1dDJcblx0XHR9O1xuXHRcdGNvbnN0IHVudHlwZWREaWZmSW5wdXQyOiBJUmVzb3VyY2VEaWZmRWRpdG9ySW5wdXQgPSB7XG5cdFx0XHRvcmlnaW5hbDogdW50eXBlZElucHV0Mixcblx0XHRcdG1vZGlmaWVkOiB1bnR5cGVkSW5wdXQxXG5cdFx0fTtcblxuXHRcdGNvbnN0IHNpZGVCeVNpZGVJbnB1dFNhbWUgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTaWRlQnlTaWRlRWRpdG9ySW5wdXQsICduYW1lJywgdW5kZWZpbmVkLCBpbnB1dDEsIGlucHV0MSk7XG5cdFx0Y29uc3Qgc2lkZUJ5U2lkZUlucHV0RGlmZmVyZW50ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2lkZUJ5U2lkZUVkaXRvcklucHV0LCAnbmFtZScsIHVuZGVmaW5lZCwgaW5wdXQxLCBpbnB1dDIpO1xuXG5cdFx0Y29uc3QgdW50eXBlZFNpZGVCeVNpZGVJbnB1dFNhbWU6IElSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dCA9IHtcblx0XHRcdHByaW1hcnk6IHVudHlwZWRJbnB1dDEsXG5cdFx0XHRzZWNvbmRhcnk6IHVudHlwZWRJbnB1dDFcblx0XHR9O1xuXHRcdGNvbnN0IHVudHlwZWRTaWRlQnlTaWRlSW5wdXREaWZmZXJlbnQ6IElSZXNvdXJjZVNpZGVCeVNpZGVFZGl0b3JJbnB1dCA9IHtcblx0XHRcdHByaW1hcnk6IHVudHlwZWRJbnB1dDIsXG5cdFx0XHRzZWNvbmRhcnk6IHVudHlwZWRJbnB1dDFcblx0XHR9O1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN0cmljdEVxdWFsczogdHJ1ZSB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIsIHsgc3RyaWN0RXF1YWxzOiB0cnVlIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDIpLCBmYWxzZSk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWREaWZmSW5wdXQyKSwgZmFsc2UpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihkaWZmSW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MiksIGZhbHNlKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoZGlmZklucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MiksIHRydWUpO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGRpZmZJbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MiwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZERpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGRpZmZJbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDIsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWREaWZmSW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkRGlmZklucHV0MiksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXRTYW1lLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkU2lkZUJ5U2lkZUlucHV0U2FtZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZLCBzdHJpY3RFcXVhbHM6IHRydWUgfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZElucHV0MSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5CT1RILCBzdHJpY3RFcXVhbHM6IHRydWUgfSksIGZhbHNlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKHNpZGVCeVNpZGVJbnB1dFNhbWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKHNpZGVCeVNpZGVJbnB1dERpZmZlcmVudCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnModW50eXBlZFNpZGVCeVNpZGVJbnB1dERpZmZlcmVudCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyh1bnR5cGVkSW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHVudHlwZWRJbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQk9USCB9KSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdjb250YWlucygpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRjb25zdCBkaWZmSW5wdXQxID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRGlmZkVkaXRvcklucHV0LCAnbmFtZScsICdkZXNjcmlwdGlvbicsIGlucHV0MSwgaW5wdXQyLCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IGRpZmZJbnB1dDIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShEaWZmRWRpdG9ySW5wdXQsICduYW1lJywgJ2Rlc2NyaXB0aW9uJywgaW5wdXQyLCBpbnB1dDEsIHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBzaWRlQnlTaWRlSW5wdXRTYW1lID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2lkZUJ5U2lkZUVkaXRvcklucHV0LCAnbmFtZScsIHVuZGVmaW5lZCwgaW5wdXQxLCBpbnB1dDEpO1xuXHRcdGNvbnN0IHNpZGVCeVNpZGVJbnB1dERpZmZlcmVudCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNpZGVCeVNpZGVFZGl0b3JJbnB1dCwgJ25hbWUnLCB1bmRlZmluZWQsIGlucHV0MSwgaW5wdXQyKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDEsIHsgc3RyaWN0RXF1YWxzOiB0cnVlIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQyLCB7IHN0cmljdEVxdWFsczogdHJ1ZSB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDIsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCBmYWxzZSk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCBmYWxzZSk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGRpZmZJbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhkaWZmSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCBmYWxzZSk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGRpZmZJbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhkaWZmSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoZGlmZklucHV0MiksIHRydWUpO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhkaWZmSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGRpZmZJbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQyLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGRpZmZJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGRpZmZJbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MiwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5BTlkgfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoZGlmZklucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoZGlmZklucHV0MiksIGZhbHNlKTtcblxuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KHVuZGVmaW5lZCwgdHJ1ZSwgVVJJLnBhcnNlKCdmb286Ly9iYXInKSk7XG5cblx0XHRjb25zdCBpbnB1dDQgPSBpbnB1dCh1bmRlZmluZWQsIHRydWUsIFVSSS5wYXJzZSgnZm9vOi8vYmFyc29tZXRoaW5nJykpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0NCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQzKSwgdHJ1ZSk7XG5cblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MyksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXRTYW1lLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHNpZGVCeVNpZGVJbnB1dFNhbWUpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKGlucHV0MSwgeyBzdXBwb3J0U2lkZUJ5U2lkZTogU2lkZUJ5U2lkZUVkaXRvci5CT1RIIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSwgc3RyaWN0RXF1YWxzOiB0cnVlIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEgsIHN0cmljdEVxdWFsczogdHJ1ZSB9KSwgdHJ1ZSk7XG5cblx0XHRncm91cC5jbG9zZUVkaXRvcihzaWRlQnlTaWRlSW5wdXRTYW1lKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzaWRlQnlTaWRlSW5wdXREaWZmZXJlbnQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvbnRhaW5zKHNpZGVCeVNpZGVJbnB1dERpZmZlcmVudCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb250YWlucyhpbnB1dDEsIHsgc3VwcG9ydFNpZGVCeVNpZGU6IFNpZGVCeVNpZGVFZGl0b3IuQU5ZIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkFOWSwgc3RyaWN0RXF1YWxzOiB0cnVlIH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEggfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY29udGFpbnMoaW5wdXQxLCB7IHN1cHBvcnRTaWRlQnlTaWRlOiBTaWRlQnlTaWRlRWRpdG9yLkJPVEgsIHN0cmljdEVxdWFsczogdHJ1ZSB9KSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdncm91cCBzZXJpYWxpemF0aW9uJywgZnVuY3Rpb24gKCkge1xuXHRcdGluc3QoKS5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBSZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnN0YXJ0KGFjY2Vzc29yKSk7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblxuXHRcdC8vIENhc2UgMTogaW5wdXRzIGNhbiBiZSBzZXJpYWxpemVkIGFuZCBkZXNlcmlhbGl6ZWRcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogZmFsc2UsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGxldCBkZXNlcmlhbGl6ZWQgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKGdyb3VwLnNlcmlhbGl6ZSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaWQsIGRlc2VyaWFsaXplZC5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5pc1Bpbm5lZChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmlzUGlubmVkKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNQaW5uZWQoaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNBY3RpdmUoaW5wdXQzKSwgdHJ1ZSk7XG5cblx0XHQvLyBDYXNlIDI6IGlucHV0cyBjYW5ub3QgYmUgc2VyaWFsaXplZFxuXHRcdFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIuZGlzYWJsZVNlcmlhbGl6ZSA9IHRydWU7XG5cblx0XHRkZXNlcmlhbGl6ZWQgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKGdyb3VwLnNlcmlhbGl6ZSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaWQsIGRlc2VyaWFsaXplZC5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cblx0XHQvLyBDYXNlIDM6IGlucHV0cyBjYW5ub3QgYmUgZGVzZXJpYWxpemVkXG5cdFx0VGVzdEVkaXRvcklucHV0U2VyaWFsaXplci5kaXNhYmxlU2VyaWFsaXplID0gZmFsc2U7XG5cdFx0VGVzdEVkaXRvcklucHV0U2VyaWFsaXplci5kaXNhYmxlRGVzZXJpYWxpemUgPSB0cnVlO1xuXG5cdFx0ZGVzZXJpYWxpemVkID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbChncm91cC5zZXJpYWxpemUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlkLCBkZXNlcmlhbGl6ZWQuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdncm91cCBzZXJpYWxpemF0aW9uIChzdGlja3kgZWRpdG9yKScsIGZ1bmN0aW9uICgpIHtcblx0XHRpbnN0KCkuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5zdGFydChhY2Nlc3NvcikpO1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cblx0XHQvLyBDYXNlIDE6IGlucHV0cyBjYW4gYmUgc2VyaWFsaXplZCBhbmQgZGVzZXJpYWxpemVkXG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IGZhbHNlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRncm91cC5zdGljayhpbnB1dDIpO1xuXHRcdGFzc2VydC5vayhncm91cC5pc1N0aWNreShpbnB1dDIpKTtcblxuXHRcdGxldCBkZXNlcmlhbGl6ZWQgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKGdyb3VwLnNlcmlhbGl6ZSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaWQsIGRlc2VyaWFsaXplZC5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5jb3VudCwgMyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmlzUGlubmVkKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNBY3RpdmUoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNTdGlja3koaW5wdXQxKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5pc1Bpbm5lZChpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmlzQWN0aXZlKGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmlzU3RpY2t5KGlucHV0MiksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5pc1Bpbm5lZChpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5pc0FjdGl2ZShpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmlzU3RpY2t5KGlucHV0MyksIGZhbHNlKTtcblxuXHRcdC8vIENhc2UgMjogaW5wdXRzIGNhbm5vdCBiZSBzZXJpYWxpemVkXG5cdFx0VGVzdEVkaXRvcklucHV0U2VyaWFsaXplci5kaXNhYmxlU2VyaWFsaXplID0gdHJ1ZTtcblxuXHRcdGRlc2VyaWFsaXplZCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoZ3JvdXAuc2VyaWFsaXplKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pZCwgZGVzZXJpYWxpemVkLmlkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLnN0aWNreUNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVzZXJpYWxpemVkLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAwKTtcblxuXHRcdC8vIENhc2UgMzogaW5wdXRzIGNhbm5vdCBiZSBkZXNlcmlhbGl6ZWRcblx0XHRUZXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyLmRpc2FibGVTZXJpYWxpemUgPSBmYWxzZTtcblx0XHRUZXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyLmRpc2FibGVEZXNlcmlhbGl6ZSA9IHRydWU7XG5cblx0XHRkZXNlcmlhbGl6ZWQgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKGdyb3VwLnNlcmlhbGl6ZSgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaWQsIGRlc2VyaWFsaXplZC5pZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5zdGlja3lDb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlc2VyaWFsaXplZC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dyb3VwIHNlcmlhbGl6YXRpb24gKGxvY2tlZCBncm91cCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmxvY2tlZC5sZW5ndGgsIDApO1xuXG5cdFx0Z3JvdXAubG9jayh0cnVlKTtcblx0XHRncm91cC5sb2NrKHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5sb2NrZWQubGVuZ3RoLCAxKTtcblxuXHRcdGdyb3VwLmxvY2soZmFsc2UpO1xuXHRcdGdyb3VwLmxvY2soZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5sb2NrZWQubGVuZ3RoLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnbG9ja2VkIGdyb3VwJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGdyb3VwLmxvY2sodHJ1ZSk7XG5cblx0XHRsZXQgZGVzZXJpYWxpemVkID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbChncm91cC5zZXJpYWxpemUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlkLCBkZXNlcmlhbGl6ZWQuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNMb2NrZWQsIHRydWUpO1xuXG5cdFx0Z3JvdXAubG9jayhmYWxzZSk7XG5cdFx0ZGVzZXJpYWxpemVkID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbChncm91cC5zZXJpYWxpemUoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlkLCBkZXNlcmlhbGl6ZWQuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZXNlcmlhbGl6ZWQuaXNMb2NrZWQsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5kZXgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmluZGV4Lmxlbmd0aCwgMCk7XG5cblx0XHRncm91cC5zZXRJbmRleCg0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuaW5kZXgubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnbGFiZWwnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmxhYmVsLmxlbmd0aCwgMCk7XG5cblx0XHRncm91cC5zZXRMYWJlbCgnV2luZG93IDEnKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubGFiZWwubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnYWN0aXZlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmUubGVuZ3RoLCAwKTtcblxuXHRcdGdyb3VwLnNldEFjdGl2ZSh1bmRlZmluZWQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmUubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnT25lIEVkaXRvcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRjb25zdCBldmVudHMgPSBncm91cExpc3RlbmVyKGdyb3VwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDApO1xuXG5cdFx0Ly8gQWN0aXZlICYmIFBpbm5lZFxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgeyBlZGl0b3I6IG9wZW5lZEVkaXRvciwgaXNOZXcgfSA9IGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IGFjdGl2ZTogdHJ1ZSwgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcGVuZWRFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzTmV3LCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5maW5kRWRpdG9yKGlucHV0MSkhWzBdLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoMCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0ZpcnN0KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0xhc3QoaW5wdXQxKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm9wZW5lZFswXS5lZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMF0uZWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzBdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFswXS5lZGl0b3JJbmRleCwgMCk7XG5cblx0XHRjb25zdCBpbmRleCA9IGdyb3VwLmluZGV4T2YoaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZmluZEVkaXRvcihpbnB1dDEpIVsxXSwgaW5kZXgpO1xuXHRcdGxldCBldmVudCA9IGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0MSwgRWRpdG9yQ2xvc2VDb250ZXh0LlVOUElOKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQ/LmVkaXRvckluZGV4LCBpbmRleCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzRmlyc3QoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0xhc3QoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzBdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZFswXS5lZGl0b3JJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMF0uY29udGV4dCA9PT0gRWRpdG9yQ2xvc2VDb250ZXh0LlVOUElOLCB0cnVlKTtcblxuXHRcdC8vIEFjdGl2ZSAmJiBQcmV2aWV3XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogZmFsc2UgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZCgwKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMV0uZWRpdG9yLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMub3BlbmVkWzFdLmVkaXRvckluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFsxXS5lZGl0b3IsIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmF0ZWRbMV0uZWRpdG9ySW5kZXgsIDApO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZFsxXS5lZGl0b3IsIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMV0uZWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzFdLmNvbnRleHQgPT09IEVkaXRvckNsb3NlQ29udGV4dC5SRVBMQUNFLCBmYWxzZSk7XG5cblx0XHRldmVudCA9IGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Mik7XG5cdFx0YXNzZXJ0Lm9rKCFldmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMV0uZWRpdG9yLCBpbnB1dDIpO1xuXG5cdFx0Ly8gTm9uYWN0aXZlICYmIFBpbm5lZCA9PiBnZXRzIGFjdGl2ZSBiZWNhdXNlIGl0cyBmaXJzdCBlZGl0b3Jcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IGFjdGl2ZTogZmFsc2UsIHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZChpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoMCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMl0uZWRpdG9yLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzJdLmVkaXRvciwgaW5wdXQzKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMl0uZWRpdG9yLCBpbnB1dDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMl0uZWRpdG9yLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzJdLmVkaXRvciwgaW5wdXQzKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMl0uZWRpdG9yLCBpbnB1dDMpO1xuXG5cdFx0Ly8gTm9uYWN0aXZlICYmIFByZXZpZXcgPT4gZ2V0cyBhY3RpdmUgYmVjYXVzZSBpdHMgZmlyc3QgZWRpdG9yXG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQ0KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZCgwKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbM10uZWRpdG9yLCBpbnB1dDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzNdLmVkaXRvciwgaW5wdXQ0KTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0NCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbM10uZWRpdG9yLCBpbnB1dDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBFZGl0b3JzIC0gUGlubmVkIGFuZCBBY3RpdmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgnMScpO1xuXHRcdGNvbnN0IGlucHV0MUNvcHkgPSBpbnB1dCgnMScpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCcyJyk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoJzMnKTtcblxuXHRcdC8vIFBpbm5lZCBhbmQgQWN0aXZlXG5cdFx0bGV0IG9wZW5lZEVkaXRvclJlc3VsdCA9IGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcGVuZWRFZGl0b3JSZXN1bHQuZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcGVuZWRFZGl0b3JSZXN1bHQuaXNOZXcsIHRydWUpO1xuXG5cdFx0b3BlbmVkRWRpdG9yUmVzdWx0ID0gZ3JvdXAub3BlbkVkaXRvcihpbnB1dDFDb3B5LCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pOyAvLyBvcGVuaW5nIGNvcHkgb2YgZWRpdG9yIHNob3VsZCBzdGlsbCByZXR1cm4gZXhpc3Rpbmcgb25lXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZEVkaXRvclJlc3VsdC5lZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZEVkaXRvclJlc3VsdC5pc05ldywgZmFsc2UpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzRmlyc3QoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzRmlyc3QoaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0ZpcnN0KGlucHV0MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNMYXN0KGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNMYXN0KGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNMYXN0KGlucHV0MyksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMub3BlbmVkWzFdLmVkaXRvciwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm9wZW5lZFsyXS5lZGl0b3IsIGlucHV0Myk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFswXS5lZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmF0ZWRbMF0uZWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzFdLmVkaXRvciwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFsxXS5lZGl0b3JJbmRleCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmF0ZWRbMl0uZWRpdG9yLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzJdLmVkaXRvckluZGV4LCAyKTtcblxuXHRcdGNvbnN0IG1ydSA9IGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1WzBdLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVbMV0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydVsyXSwgaW5wdXQxKTtcblxuXHRcdC8vIEFkZCBzb21lIHRlc3RzIHdoZXJlIGEgbWF0Y2hpbmcgaW5wdXQgaXMgdXNlZFxuXHRcdC8vIGFuZCB2ZXJpZnkgdGhhdCBldmVudHMgY2FycnkgdGhlIG9yaWdpbmFsIGlucHV0XG5cdFx0Y29uc3Qgc2FtZUlucHV0MSA9IGlucHV0KCcxJyk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzYW1lSW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuYWN0aXZhdGVkWzNdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFszXS5lZGl0b3JJbmRleCwgMCk7XG5cblx0XHRncm91cC51bnBpbihzYW1lSW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnVucGlubmVkWzBdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnVucGlubmVkWzBdLmVkaXRvckluZGV4LCAwKTtcblxuXHRcdGdyb3VwLnBpbihzYW1lSW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnBpbm5lZFswXS5lZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5waW5uZWRbMF0uZWRpdG9ySW5kZXgsIDApO1xuXG5cdFx0Z3JvdXAuc3RpY2soc2FtZUlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5zdGlja3lbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuc3RpY2t5WzBdLmVkaXRvckluZGV4LCAwKTtcblxuXHRcdGdyb3VwLnVuc3RpY2soc2FtZUlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy51bnN0aWNreVswXS5lZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy51bnN0aWNreVswXS5lZGl0b3JJbmRleCwgMCk7XG5cblx0XHRncm91cC5tb3ZlRWRpdG9yKHNhbWVJbnB1dDEsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubW92ZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubW92ZWRbMF0ub2xkRWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubW92ZWRbMF0uZWRpdG9ySW5kZXgsIDEpO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3Ioc2FtZUlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzBdLmVkaXRvckluZGV4LCAxKTtcblxuXHRcdGNsb3NlQWxsRWRpdG9ycyhncm91cCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZC5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBQcmV2aWV3IGVkaXRvciBtb3ZlcyB0byB0aGUgc2lkZSBvZiB0aGUgYWN0aXZlIG9uZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiBmYWxzZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MywgZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMl0pO1xuXG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCwgeyBwaW5uZWQ6IGZhbHNlLCBhY3RpdmU6IHRydWUgfSk7IC8vIHRoaXMgc2hvdWxkIGNhdXNlIHRoZSBwcmV2aWV3IGVkaXRvciB0byBtb3ZlIGFmdGVyIGlucHV0M1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0NCwgZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMl0pO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBFZGl0b3JzIC0gUGlubmVkIGFuZCBBY3RpdmUgKERFRkFVTFRfT1BFTl9FRElUT1JfRElSRUNUSU9OID0gRGlyZWN0aW9uLkxFRlQpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGluc3QgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0aW5zdC5zdHViKElTdG9yYWdlU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGluc3Quc3R1YihJTGlmZWN5Y2xlU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGlmZWN5Y2xlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpKTtcblx0XHRpbnN0LnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsIE51bGxUZWxlbWV0cnlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0LnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgb3BlblBvc2l0aW9uaW5nOiAnbGVmdCcgfSB9KTtcblxuXHRcdGNvbnN0IGdyb3VwOiBFZGl0b3JHcm91cE1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgdW5kZWZpbmVkKSk7XG5cblx0XHRjb25zdCBldmVudHMgPSBncm91cExpc3RlbmVyKGdyb3VwKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Ly8gUGlubmVkIGFuZCBBY3RpdmVcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzJdLCBpbnB1dDEpO1xuXG5cdFx0Y2xvc2VBbGxFZGl0b3JzKGdyb3VwKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRpbnN0LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIFBpbm5lZCBhbmQgTm90IEFjdGl2ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Ly8gUGlubmVkIGFuZCBBY3RpdmVcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoMCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZCgxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBtcnUgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydVswXSwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1WzFdLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVbMl0sIGlucHV0Mik7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBQcmV2aWV3IGdldHMgb3ZlcndyaXR0ZW4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblxuXHRcdC8vIE5vbiBhY3RpdmUsIHByZXZpZXdcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSk7IC8vIGJlY29tZXMgYWN0aXZlLCBwcmV2aWV3XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIpOyAvLyBvdmVyd3JpdGVzIHByZXZpZXdcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0Myk7IC8vIG92ZXJ3cml0ZXMgcHJldmlld1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNBY3RpdmUoaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoIWdyb3VwLmlzUGlubmVkKGlucHV0MyksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5vcGVuZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMub3BlbmVkWzFdLmVkaXRvciwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm9wZW5lZFsyXS5lZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzFdLmVkaXRvciwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZFswXS5jb250ZXh0ID09PSBFZGl0b3JDbG9zZUNvbnRleHQuUkVQTEFDRSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMV0uY29udGV4dCA9PT0gRWRpdG9yQ2xvc2VDb250ZXh0LlJFUExBQ0UsIHRydWUpO1xuXG5cdFx0Y29uc3QgbXJ1ID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVbMF0sIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydS5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBFZGl0b3JzIC0gc2V0IGFjdGl2ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRjb25zdCBldmVudHMgPSBncm91cExpc3RlbmVyKGdyb3VwKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiBmYWxzZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblxuXHRcdGxldCBtcnUgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydVswXSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1WzFdLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVbMl0sIGlucHV0MSk7XG5cblx0XHRncm91cC5zZXRBY3RpdmUoaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZC5sZW5ndGgsIDMpO1xuXG5cdFx0Z3JvdXAuc2V0QWN0aXZlKGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5hY3RpdmF0ZWRbM10uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc0FjdGl2ZShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MyksIGZhbHNlKTtcblxuXHRcdG1ydSA9IGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1WzBdLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVbMV0sIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydVsyXSwgaW5wdXQyKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIHBpbiBhbmQgdW5waW4nLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogZmFsc2UsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAzKTtcblxuXHRcdGdyb3VwLnBpbihpbnB1dDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMucGlubmVkWzBdLmVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDMpO1xuXG5cdFx0Z3JvdXAudW5waW4oaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNBY3RpdmUoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMudW5waW5uZWRbMF0uZWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cblx0XHRncm91cC51bnBpbihpbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDIpOyAvLyAyIHByZXZpZXdzIGdvdCBtZXJnZWQgaW50byBvbmVcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzBdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDIpO1xuXG5cdFx0Z3JvdXAudW5waW4oaW5wdXQzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTsgLy8gcGlubmluZyByZXBsYWNlZCB0aGUgcHJldmlld1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZFsxXS5lZGl0b3IsIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIGNsb3NpbmcgcGlja3MgbmV4dCBmcm9tIE1SVSBsaXN0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXApO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDUgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0sIGlucHV0NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCA1KTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFs1XS5lZGl0b3IsIGlucHV0NCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCA0KTtcblxuXHRcdGdyb3VwLnNldEFjdGl2ZShpbnB1dDEpO1xuXHRcdGdyb3VwLnNldEFjdGl2ZShpbnB1dDQpO1xuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0NCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDIpO1xuXG5cdFx0Z3JvdXAuc2V0QWN0aXZlKGlucHV0Mik7XG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Myk7XG5cblx0XHRhc3NlcnQub2soIWdyb3VwLmFjdGl2ZUVkaXRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIGNsb3NpbmcgcGlja3MgbmV4dCB0byB0aGUgcmlnaHQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zdCA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHRpbnN0LnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElMaWZlY3ljbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpKTtcblx0XHRpbnN0LnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGluc3Quc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgZm9jdXNSZWNlbnRFZGl0b3JBZnRlckNsb3NlOiBmYWxzZSB9IH0pO1xuXHRcdGluc3Quc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZyk7XG5cblx0XHRjb25zdCBncm91cCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0LmNyZWF0ZUluc3RhbmNlKEVkaXRvckdyb3VwTW9kZWwsIHVuZGVmaW5lZCkpO1xuXHRcdGNvbnN0IGV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXApO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDUgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0sIGlucHV0NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCA1KTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmFjdGl2YXRlZFs1XS5lZGl0b3IsIGlucHV0NCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCA0KTtcblxuXHRcdGdyb3VwLnNldEFjdGl2ZShpbnB1dDEpO1xuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cblx0XHRncm91cC5zZXRBY3RpdmUoaW5wdXQzKTtcblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDIpO1xuXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IoaW5wdXQ0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTtcblxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Mik7XG5cblx0XHRhc3NlcnQub2soIWdyb3VwLmFjdGl2ZUVkaXRvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAwKTtcblx0XHRpbnN0LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIG1vdmUgZWRpdG9yJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXApO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDUgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0MSwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzBdLmVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzBdLm9sZEVkaXRvckluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzBdLmVkaXRvckluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBpbnB1dDEpO1xuXG5cdFx0Z3JvdXAuc2V0QWN0aXZlKGlucHV0MSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDQsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0NCwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzFdLmVkaXRvciwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzFdLm9sZEVkaXRvckluZGV4LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzFdLmVkaXRvckluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkWzFdLmVkaXRvciwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIGlucHV0NCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVsyXSwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbM10sIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzRdLCBpbnB1dDUpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDQsIDMpO1xuXHRcdGdyb3VwLm1vdmVFZGl0b3IoaW5wdXQyLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzJdLCBpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVszXSwgaW5wdXQ0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbNF0sIGlucHV0NSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkLmxlbmd0aCwgNCk7XG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDEsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubW92ZWQubGVuZ3RoLCA0KTtcblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0MSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMubW92ZWQubGVuZ3RoLCA0KTtcblxuXHRcdGdyb3VwLm1vdmVFZGl0b3IoaW5wdXQ1LCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkLmxlbmd0aCwgNCk7XG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDUsIDEwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5tb3ZlZC5sZW5ndGgsIDQpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDUsIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLm1vdmVkLmxlbmd0aCwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbnB1dDUpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDEsIDEwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5tb3ZlZC5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVs0XSwgaW5wdXQxKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIG1vdmUgZWRpdG9yIGFjcm9zcyBncm91cHMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAxID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGdyb3VwMiA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGcxX2lucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgZzFfaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBnMl9pbnB1dDEgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoZzFfaW5wdXQxLCB7IGFjdGl2ZTogdHJ1ZSwgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGcxX2lucHV0MiwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihnMl9pbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHQvLyBBIG1vdmUgYWNyb3NzIGdyb3VwcyBpcyBhIGNsb3NlIGluIHRoZSBvbmUgZ3JvdXAgYW5kIGFuIG9wZW4gaW4gdGhlIG90aGVyIGdyb3VwIGF0IGEgc3BlY2lmaWMgaW5kZXhcblx0XHRncm91cDIuY2xvc2VFZGl0b3IoZzJfaW5wdXQxKTtcblx0XHRncm91cDEub3BlbkVkaXRvcihnMl9pbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUsIGluZGV4OiAxIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgZzFfaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBnMl9pbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMl0sIGcxX2lucHV0Mik7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBtb3ZlIGVkaXRvciBhY3Jvc3MgZ3JvdXBzIChpbnB1dCBhbHJlYWR5IGV4aXN0cyBpbiBncm91cCAxKScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cDEgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZ3JvdXAyID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgZzFfaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBnMV9pbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGcxX2lucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgZzJfaW5wdXQxID0gZzFfaW5wdXQyO1xuXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoZzFfaW5wdXQxLCB7IGFjdGl2ZTogdHJ1ZSwgcGlubmVkOiB0cnVlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGcxX2lucHV0MiwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cDEub3BlbkVkaXRvcihnMV9pbnB1dDMsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAyLm9wZW5FZGl0b3IoZzJfaW5wdXQxLCB7IGFjdGl2ZTogdHJ1ZSwgcGlubmVkOiB0cnVlIH0pO1xuXG5cdFx0Ly8gQSBtb3ZlIGFjcm9zcyBncm91cHMgaXMgYSBjbG9zZSBpbiB0aGUgb25lIGdyb3VwIGFuZCBhbiBvcGVuIGluIHRoZSBvdGhlciBncm91cCBhdCBhIHNwZWNpZmljIGluZGV4XG5cdFx0Z3JvdXAyLmNsb3NlRWRpdG9yKGcyX2lucHV0MSk7XG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoZzJfaW5wdXQxLCB7IGFjdGl2ZTogdHJ1ZSwgcGlubmVkOiB0cnVlLCBpbmRleDogMCB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIGcxX2lucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVsxXSwgZzFfaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzJdLCBnMV9pbnB1dDMpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBFZGl0b3JzIC0gUGlubmVkICYgTm9uIEFjdGl2ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiBmYWxzZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5wcmV2aWV3RWRpdG9yLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAyKTtcblxuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IGZhbHNlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVsxXSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMl0sIGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBDbG9zZSBPdGhlcnMsIENsb3NlIExlZnQsIENsb3NlIFJpZ2h0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDUgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDQsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHQvLyBDbG9zZSBPdGhlcnNcblx0XHRjbG9zZUVkaXRvcnMoZ3JvdXAsIGdyb3VwLmFjdGl2ZUVkaXRvciEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0NSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAxKTtcblxuXHRcdGNsb3NlQWxsRWRpdG9ycyhncm91cCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDQsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAuc2V0QWN0aXZlKGlucHV0Myk7XG5cblx0XHQvLyBDbG9zZSBMZWZ0XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRjbG9zZUVkaXRvcnMoZ3JvdXAsIGdyb3VwLmFjdGl2ZUVkaXRvciwgQ2xvc2VEaXJlY3Rpb24uTEVGVCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIGlucHV0NCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzJdLCBpbnB1dDUpO1xuXG5cdFx0Y2xvc2VBbGxFZGl0b3JzKGdyb3VwKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NSwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5zZXRBY3RpdmUoaW5wdXQzKTtcblxuXHRcdC8vIENsb3NlIFJpZ2h0XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQzKTtcblx0XHRjbG9zZUVkaXRvcnMoZ3JvdXAsIGdyb3VwLmFjdGl2ZUVkaXRvciwgQ2xvc2VEaXJlY3Rpb24uUklHSFQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVsyXSwgaW5wdXQzKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIHJlYWwgdXNlciBleGFtcGxlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Ly8gW10gLT4gL2luZGV4Lmh0bWwvXG5cdFx0Y29uc3QgaW5kZXhIdG1sID0gaW5wdXQoJ2luZGV4Lmh0bWwnKTtcblx0XHRsZXQgb3BlbmVkRWRpdG9yID0gZ3JvdXAub3BlbkVkaXRvcihpbmRleEh0bWwpLmVkaXRvcjtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3BlbmVkRWRpdG9yLCBpbmRleEh0bWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGluZGV4SHRtbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IsIGluZGV4SHRtbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbmRleEh0bWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cblx0XHQvLyAvaW5kZXguaHRtbC8gLT4gL2luZGV4Lmh0bWwvXG5cdFx0Y29uc3Qgc2FtZUluZGV4SHRtbCA9IGlucHV0KCdpbmRleC5odG1sJyk7XG5cdFx0b3BlbmVkRWRpdG9yID0gZ3JvdXAub3BlbkVkaXRvcihzYW1lSW5kZXhIdG1sKS5lZGl0b3I7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wZW5lZEVkaXRvciwgaW5kZXhIdG1sKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbmRleEh0bWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5wcmV2aWV3RWRpdG9yLCBpbmRleEh0bWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5kZXhIdG1sKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDEpO1xuXG5cdFx0Ly8gL2luZGV4Lmh0bWwvIC0+IC9zdHlsZS5jc3MvXG5cdFx0Y29uc3Qgc3R5bGVDc3MgPSBpbnB1dCgnc3R5bGUuY3NzJyk7XG5cdFx0b3BlbmVkRWRpdG9yID0gZ3JvdXAub3BlbkVkaXRvcihzdHlsZUNzcykuZWRpdG9yO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcGVuZWRFZGl0b3IsIHN0eWxlQ3NzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBzdHlsZUNzcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IsIHN0eWxlQ3NzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0sIHN0eWxlQ3NzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDEpO1xuXG5cdFx0Ly8gL3N0eWxlLmNzcy8gLT4gWy9zdHlsZS5jc3MvLCB0ZXN0LmpzXVxuXHRcdGNvbnN0IHRlc3RKcyA9IGlucHV0KCd0ZXN0LmpzJyk7XG5cdFx0b3BlbmVkRWRpdG9yID0gZ3JvdXAub3BlbkVkaXRvcih0ZXN0SnMsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSkuZWRpdG9yO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvcGVuZWRFZGl0b3IsIHRlc3RKcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IsIHN0eWxlQ3NzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCB0ZXN0SnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1Bpbm5lZChzdHlsZUNzcyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQodGVzdEpzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBzdHlsZUNzcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCB0ZXN0SnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMik7XG5cblx0XHQvLyBbL3N0eWxlLmNzcy8sIHRlc3QuanNdIC0+IFt0ZXN0LmpzLCAvaW5kZXguaHRtbC9dXG5cdFx0Y29uc3QgaW5kZXhIdG1sMiA9IGlucHV0KCdpbmRleC5odG1sJyk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbmRleEh0bWwyLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBpbmRleEh0bWwyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAucHJldmlld0VkaXRvciwgaW5kZXhIdG1sMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGluZGV4SHRtbDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKHRlc3RKcyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgdGVzdEpzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIGluZGV4SHRtbDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMik7XG5cblx0XHQvLyBtYWtlIHRlc3QuanMgYWN0aXZlXG5cdFx0Y29uc3QgdGVzdEpzMiA9IGlucHV0KCd0ZXN0LmpzJyk7XG5cdFx0Z3JvdXAuc2V0QWN0aXZlKHRlc3RKczIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIHRlc3RKcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKHRlc3RKczIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDIpO1xuXG5cdFx0Ly8gW3Rlc3QuanMsIC9pbmRleEh0bWwvXSAtPiBbdGVzdC5qcywgaW5kZXguaHRtbF1cblx0XHRjb25zdCBpbmRleEh0bWwzID0gaW5wdXQoJ2luZGV4Lmh0bWwnKTtcblx0XHRncm91cC5waW4oaW5kZXhIdG1sMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGluZGV4SHRtbDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCB0ZXN0SnMpO1xuXG5cdFx0Ly8gW3Rlc3QuanMsIGluZGV4Lmh0bWxdIC0+IFt0ZXN0LmpzLCBmaWxlLnRzLCBpbmRleC5odG1sXVxuXHRcdGNvbnN0IGZpbGVUcyA9IGlucHV0KCdmaWxlLnRzJyk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihmaWxlVHMsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGZpbGVUcyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgZmlsZVRzKTtcblxuXHRcdC8vIFt0ZXN0LmpzLCBpbmRleC5odG1sLCBmaWxlLnRzXSAtPiBbdGVzdC5qcywgL2ZpbGUudHMvLCBpbmRleC5odG1sXVxuXHRcdGdyb3VwLnVucGluKGZpbGVUcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoZmlsZVRzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGZpbGVUcyk7XG5cblx0XHQvLyBbdGVzdC5qcywgL2ZpbGUudHMvLCBpbmRleC5odG1sXSAtPiBbdGVzdC5qcywgL290aGVyLnRzLywgaW5kZXguaHRtbF1cblx0XHRjb25zdCBvdGhlclRzID0gaW5wdXQoJ290aGVyLnRzJyk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihvdGhlclRzLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIG90aGVyVHMpO1xuXHRcdGFzc2VydC5vayhncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXS5tYXRjaGVzKHRlc3RKcykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVsxXSwgb3RoZXJUcyk7XG5cdFx0YXNzZXJ0Lm9rKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzJdLm1hdGNoZXMoaW5kZXhIdG1sKSk7XG5cblx0XHQvLyBtYWtlIGluZGV4Lmh0bWwgYWN0aXZlXG5cdFx0Y29uc3QgaW5kZXhIdG1sNCA9IGlucHV0KCdpbmRleC5odG1sJyk7XG5cdFx0Z3JvdXAuc2V0QWN0aXZlKGluZGV4SHRtbDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIGluZGV4SHRtbDIpO1xuXG5cdFx0Ly8gW3Rlc3QuanMsIC9vdGhlci50cy8sIGluZGV4Lmh0bWxdIC0+IFt0ZXN0LmpzLCAvb3RoZXIudHMvXVxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGluZGV4SHRtbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yLCBvdGhlclRzKTtcblx0XHRhc3NlcnQub2soZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0ubWF0Y2hlcyh0ZXN0SnMpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0sIG90aGVyVHMpO1xuXG5cdFx0Ly8gW3Rlc3QuanMsIC9vdGhlci50cy9dIC0+IFt0ZXN0LmpzXVxuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKG90aGVyVHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgdGVzdEpzKTtcblx0XHRhc3NlcnQub2soZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0ubWF0Y2hlcyh0ZXN0SnMpKTtcblxuXHRcdC8vIFt0ZXN0LmpzXSAtPiAvdGVzdC5qcy9cblx0XHRncm91cC51bnBpbih0ZXN0SnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgdGVzdEpzKTtcblx0XHRhc3NlcnQub2soZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMF0ubWF0Y2hlcyh0ZXN0SnMpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQodGVzdEpzKSwgZmFsc2UpO1xuXG5cdFx0Ly8gL3Rlc3QuanMvIC0+IFtdXG5cdFx0Z3JvdXAuY2xvc2VFZGl0b3IodGVzdEpzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5wcmV2aWV3RWRpdG9yLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnU2luZ2xlIEdyb3VwLCBTaW5nbGUgRWRpdG9yIC0gcGVyc2lzdCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBpbnN0ID0gbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpO1xuXG5cdFx0aW5zdC5zdHViKElTdG9yYWdlU2VydmljZSwgZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSkpO1xuXHRcdGluc3Quc3R1YihJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsIG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgbGlmZWN5Y2xlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGlmZWN5Y2xlU2VydmljZSgpKTtcblx0XHRpbnN0LnN0dWIoSUxpZmVjeWNsZVNlcnZpY2UsIGxpZmVjeWNsZSk7XG5cdFx0aW5zdC5zdHViKElUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGVsZW1ldHJ5U2VydmljZSk7XG5cblx0XHRjb25zdCBjb25maWcgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0Y29uZmlnLnNldFVzZXJDb25maWd1cmF0aW9uKCd3b3JrYmVuY2gnLCB7IGVkaXRvcjogeyBvcGVuUG9zaXRpb25pbmc6ICdyaWdodCcgfSB9KTtcblx0XHRpbnN0LnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXG5cdFx0aW5zdC5pbnZva2VGdW5jdGlvbihhY2Nlc3NvciA9PiBSZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnN0YXJ0KGFjY2Vzc29yKSk7XG5cblx0XHRsZXQgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciEubWF0Y2hlcyhpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAucHJldmlld0VkaXRvciEubWF0Y2hlcyhpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNBY3RpdmUoaW5wdXQxKSwgdHJ1ZSk7XG5cblx0XHQvLyBDcmVhdGUgbW9kZWwgYWdhaW4gLSBzaG91bGQgbG9hZCBmcm9tIHN0b3JhZ2Vcblx0XHRncm91cCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0LmNyZWF0ZUluc3RhbmNlKEVkaXRvckdyb3VwTW9kZWwsIGdyb3VwLnNlcmlhbGl6ZSgpKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5hY3RpdmVFZGl0b3IhLm1hdGNoZXMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnByZXZpZXdFZGl0b3IhLm1hdGNoZXMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzQWN0aXZlKGlucHV0MSksIHRydWUpO1xuXHRcdGluc3QuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBHcm91cHMsIE11bHRpcGxlIGVkaXRvcnMgLSBwZXJzaXN0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGluc3QgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cblx0XHRpbnN0LnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpKTtcblx0XHRjb25zdCBsaWZlY3ljbGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpO1xuXHRcdGluc3Quc3R1YihJTGlmZWN5Y2xlU2VydmljZSwgbGlmZWN5Y2xlKTtcblx0XHRpbnN0LnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsIE51bGxUZWxlbWV0cnlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25maWcuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaCcsIHsgZWRpdG9yOiB7IG9wZW5Qb3NpdGlvbmluZzogJ3JpZ2h0JyB9IH0pO1xuXHRcdGluc3Quc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZyk7XG5cblx0XHRpbnN0Lmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpKTtcblxuXHRcdGxldCBncm91cDEgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBnMV9pbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGcxX2lucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgZzFfaW5wdXQzID0gaW5wdXQoKTtcblxuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGcxX2lucHV0MSwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cDEub3BlbkVkaXRvcihnMV9pbnB1dDIsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IGZhbHNlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGcxX2lucHV0MywgeyBhY3RpdmU6IGZhbHNlLCBwaW5uZWQ6IHRydWUgfSk7XG5cblx0XHRsZXQgZ3JvdXAyID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgZzJfaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBnMl9pbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGcyX2lucHV0MyA9IGlucHV0KCk7XG5cblx0XHRncm91cDIub3BlbkVkaXRvcihnMl9pbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAyLm9wZW5FZGl0b3IoZzJfaW5wdXQyLCB7IGFjdGl2ZTogZmFsc2UsIHBpbm5lZDogZmFsc2UgfSk7XG5cdFx0Z3JvdXAyLm9wZW5FZGl0b3IoZzJfaW5wdXQzLCB7IGFjdGl2ZTogZmFsc2UsIHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuY291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuYWN0aXZlRWRpdG9yIS5tYXRjaGVzKGcxX2lucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuYWN0aXZlRWRpdG9yIS5tYXRjaGVzKGcyX2lucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEucHJldmlld0VkaXRvciEubWF0Y2hlcyhnMV9pbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLnByZXZpZXdFZGl0b3IhLm1hdGNoZXMoZzJfaW5wdXQyKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVswXS5tYXRjaGVzKGcxX2lucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzFdLm1hdGNoZXMoZzFfaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMl0ubWF0Y2hlcyhnMV9pbnB1dDEpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzBdLm1hdGNoZXMoZzJfaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMi5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMV0ubWF0Y2hlcyhnMl9pbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVsyXS5tYXRjaGVzKGcyX2lucHV0MiksIHRydWUpO1xuXG5cdFx0Ly8gQ3JlYXRlIG1vZGVsIGFnYWluIC0gc2hvdWxkIGxvYWQgZnJvbSBzdG9yYWdlXG5cdFx0Z3JvdXAxID0gZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgZ3JvdXAxLnNlcmlhbGl6ZSgpKSk7XG5cdFx0Z3JvdXAyID0gZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgZ3JvdXAyLnNlcmlhbGl6ZSgpKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmNvdW50LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmNvdW50LCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmFjdGl2ZUVkaXRvciEubWF0Y2hlcyhnMV9pbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmFjdGl2ZUVkaXRvciEubWF0Y2hlcyhnMl9pbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLnByZXZpZXdFZGl0b3IhLm1hdGNoZXMoZzFfaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMi5wcmV2aWV3RWRpdG9yIS5tYXRjaGVzKGcyX2lucHV0MiksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0ubWF0Y2hlcyhnMV9pbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVsxXS5tYXRjaGVzKGcxX2lucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzJdLm1hdGNoZXMoZzFfaW5wdXQxKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVswXS5tYXRjaGVzKGcyX2lucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDIuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzFdLm1hdGNoZXMoZzJfaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMi5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMl0ubWF0Y2hlcyhnMl9pbnB1dDIpLCB0cnVlKTtcblx0XHRpbnN0LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnU2luZ2xlIGdyb3VwLCBtdWx0aXBsZSBlZGl0b3JzIC0gcGVyc2lzdCAoc29tZSBub3QgcGVyc2lzdGFibGUpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGluc3QgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cblx0XHRpbnN0LnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpKTtcblx0XHRjb25zdCBsaWZlY3ljbGUgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpO1xuXHRcdGluc3Quc3R1YihJTGlmZWN5Y2xlU2VydmljZSwgbGlmZWN5Y2xlKTtcblx0XHRpbnN0LnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsIE51bGxUZWxlbWV0cnlTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25maWcuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaCcsIHsgZWRpdG9yOiB7IG9wZW5Qb3NpdGlvbmluZzogJ3JpZ2h0JyB9IH0pO1xuXHRcdGluc3Quc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZyk7XG5cblx0XHRpbnN0Lmludm9rZUZ1bmN0aW9uKGFjY2Vzc29yID0+IFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkuc3RhcnQoYWNjZXNzb3IpKTtcblxuXHRcdGxldCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IHNlcmlhbGl6YWJsZUlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3Qgbm9uU2VyaWFsaXphYmxlSW5wdXQyID0gaW5wdXQoJzMnLCB0cnVlKTtcblx0XHRjb25zdCBzZXJpYWxpemFibGVJbnB1dDIgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihzZXJpYWxpemFibGVJbnB1dDEsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihub25TZXJpYWxpemFibGVJbnB1dDIsIHsgYWN0aXZlOiB0cnVlLCBwaW5uZWQ6IGZhbHNlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3Ioc2VyaWFsaXphYmxlSW5wdXQyLCB7IGFjdGl2ZTogZmFsc2UsIHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciEubWF0Y2hlcyhub25TZXJpYWxpemFibGVJbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAucHJldmlld0VkaXRvciEubWF0Y2hlcyhub25TZXJpYWxpemFibGVJbnB1dDIpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0ubWF0Y2hlcyhub25TZXJpYWxpemFibGVJbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzFdLm1hdGNoZXMoc2VyaWFsaXphYmxlSW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVsyXS5tYXRjaGVzKHNlcmlhbGl6YWJsZUlucHV0MSksIHRydWUpO1xuXG5cdFx0Ly8gQ3JlYXRlIG1vZGVsIGFnYWluIC0gc2hvdWxkIGxvYWQgZnJvbSBzdG9yYWdlXG5cdFx0Z3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdC5jcmVhdGVJbnN0YW5jZShFZGl0b3JHcm91cE1vZGVsLCBncm91cC5zZXJpYWxpemUoKSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuYWN0aXZlRWRpdG9yIS5tYXRjaGVzKHNlcmlhbGl6YWJsZUlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5wcmV2aWV3RWRpdG9yLCBudWxsKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSlbMF0ubWF0Y2hlcyhzZXJpYWxpemFibGVJbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzFdLm1hdGNoZXMoc2VyaWFsaXphYmxlSW5wdXQxKSwgdHJ1ZSk7XG5cdFx0aW5zdC5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NpbmdsZSBncm91cCwgbXVsdGlwbGUgZWRpdG9ycyAtIHBlcnNpc3QgKHNvbWUgbm90IHBlcnNpc3RhYmxlLCBzdGlja3kgZWRpdG9ycyknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zdCA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblxuXHRcdGluc3Quc3R1YihJU3RvcmFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRpbnN0LnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxpZmVjeWNsZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExpZmVjeWNsZVNlcnZpY2UoKSk7XG5cdFx0aW5zdC5zdHViKElMaWZlY3ljbGVTZXJ2aWNlLCBsaWZlY3ljbGUpO1xuXHRcdGluc3Quc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgb3BlblBvc2l0aW9uaW5nOiAncmlnaHQnIH0gfSk7XG5cdFx0aW5zdC5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlnKTtcblxuXHRcdGluc3QuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5zdGFydChhY2Nlc3NvcikpO1xuXG5cdFx0bGV0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc2VyaWFsaXphYmxlSW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBub25TZXJpYWxpemFibGVJbnB1dDIgPSBpbnB1dCgnMycsIHRydWUpO1xuXHRcdGNvbnN0IHNlcmlhbGl6YWJsZUlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKHNlcmlhbGl6YWJsZUlucHV0MSwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKG5vblNlcmlhbGl6YWJsZUlucHV0MiwgeyBhY3RpdmU6IHRydWUsIHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3Ioc2VyaWFsaXphYmxlSW5wdXQyLCB7IGFjdGl2ZTogZmFsc2UsIHBpbm5lZDogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAxKTtcblxuXHRcdC8vIENyZWF0ZSBtb2RlbCBhZ2FpbiAtIHNob3VsZCBsb2FkIGZyb20gc3RvcmFnZVxuXHRcdGdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgZ3JvdXAuc2VyaWFsaXplKCkpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5jb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAwKTtcblx0XHRpbnN0LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgZ3JvdXBzLCBtdWx0aXBsZSBlZGl0b3JzIC0gcGVyc2lzdCAoc29tZSBub3QgcGVyc2lzdGFibGUsIGNhdXNlcyBlbXB0eSBncm91cCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zdCA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblxuXHRcdGluc3Quc3R1YihJU3RvcmFnZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRpbnN0LnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGxpZmVjeWNsZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdExpZmVjeWNsZVNlcnZpY2UoKSk7XG5cdFx0aW5zdC5zdHViKElMaWZlY3ljbGVTZXJ2aWNlLCBsaWZlY3ljbGUpO1xuXHRcdGluc3Quc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgb3BlblBvc2l0aW9uaW5nOiAncmlnaHQnIH0gfSk7XG5cdFx0aW5zdC5zdHViKElDb25maWd1cmF0aW9uU2VydmljZSwgY29uZmlnKTtcblxuXHRcdGluc3QuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5zdGFydChhY2Nlc3NvcikpO1xuXG5cdFx0bGV0IGdyb3VwMSA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRsZXQgZ3JvdXAyID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc2VyaWFsaXphYmxlSW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBzZXJpYWxpemFibGVJbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IG5vblNlcmlhbGl6YWJsZUlucHV0ID0gaW5wdXQoJzInLCB0cnVlKTtcblxuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKHNlcmlhbGl6YWJsZUlucHV0MSwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3Ioc2VyaWFsaXphYmxlSW5wdXQyKTtcblxuXHRcdGdyb3VwMi5vcGVuRWRpdG9yKG5vblNlcmlhbGl6YWJsZUlucHV0KTtcblxuXHRcdC8vIENyZWF0ZSBtb2RlbCBhZ2FpbiAtIHNob3VsZCBsb2FkIGZyb20gc3RvcmFnZVxuXHRcdGdyb3VwMSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0LmNyZWF0ZUluc3RhbmNlKEVkaXRvckdyb3VwTW9kZWwsIGdyb3VwMS5zZXJpYWxpemUoKSkpO1xuXHRcdGdyb3VwMiA9IGRpc3Bvc2FibGVzLmFkZChpbnN0LmNyZWF0ZUluc3RhbmNlKEVkaXRvckdyb3VwTW9kZWwsIGdyb3VwMi5zZXJpYWxpemUoKSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5jb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMS5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXS5tYXRjaGVzKHNlcmlhbGl6YWJsZUlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDEuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTClbMV0ubWF0Y2hlcyhzZXJpYWxpemFibGVJbnB1dDIpLCB0cnVlKTtcblx0XHRpbnN0LmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgRWRpdG9ycyAtIEVkaXRvciBEaXNwb3NlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwMSA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRjb25zdCBncm91cDIgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBncm91cDFMaXN0ZW5lciA9IGdyb3VwTGlzdGVuZXIoZ3JvdXAxKTtcblx0XHRjb25zdCBncm91cDJMaXN0ZW5lciA9IGdyb3VwTGlzdGVuZXIoZ3JvdXAyKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cDEub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAyLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0aW5wdXQxLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFMaXN0ZW5lci5kaXNwb3NlZC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFMaXN0ZW5lci5kaXNwb3NlZFswXS5lZGl0b3JJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMkxpc3RlbmVyLmRpc3Bvc2VkLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMkxpc3RlbmVyLmRpc3Bvc2VkWzBdLmVkaXRvckluZGV4LCAwKTtcblx0XHRhc3NlcnQub2soZ3JvdXAxTGlzdGVuZXIuZGlzcG9zZWRbMF0uZWRpdG9yLm1hdGNoZXMoaW5wdXQxKSk7XG5cdFx0YXNzZXJ0Lm9rKGdyb3VwMkxpc3RlbmVyLmRpc3Bvc2VkWzBdLmVkaXRvci5tYXRjaGVzKGlucHV0MSkpO1xuXG5cdFx0aW5wdXQzLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxTGlzdGVuZXIuZGlzcG9zZWQubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxTGlzdGVuZXIuZGlzcG9zZWRbMV0uZWRpdG9ySW5kZXgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDJMaXN0ZW5lci5kaXNwb3NlZC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5vayhncm91cDFMaXN0ZW5lci5kaXNwb3NlZFsxXS5lZGl0b3IubWF0Y2hlcyhpbnB1dDMpKTtcblx0fSk7XG5cblx0dGVzdCgnUHJldmlldyB0YWIgZG9lcyBub3QgaGF2ZSBhIHN0YWJsZSBwb3NpdGlvbiAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzgyNDUpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwMSA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0MiwgeyBhY3RpdmU6IHRydWUgfSk7XG5cdFx0Z3JvdXAxLnNldEFjdGl2ZShpbnB1dDEpO1xuXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQzLCB7IGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxLmluZGV4T2YoaW5wdXQzKSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBFZGl0b3IgRW1pdHMgRGlydHkgYW5kIExhYmVsIENoYW5nZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZ3JvdXAxID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGdyb3VwMiA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRsZXQgZGlydHkxQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGdyb3VwMS5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFkpIHtcblx0XHRcdFx0ZGlydHkxQ291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGxldCBkaXJ0eTJDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZ3JvdXAyLm9uRGlkTW9kZWxDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9ESVJUWSkge1xuXHRcdFx0XHRkaXJ0eTJDb3VudGVyKys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGxhYmVsMUNoYW5nZUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChncm91cDEub25EaWRNb2RlbENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0xBQkVMKSB7XG5cdFx0XHRcdGxhYmVsMUNoYW5nZUNvdW50ZXIrKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgbGFiZWwyQ2hhbmdlQ291bnRlciA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGdyb3VwMi5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTEFCRUwpIHtcblx0XHRcdFx0bGFiZWwyQ2hhbmdlQ291bnRlcisrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdCg8VGVzdEVkaXRvcklucHV0PmlucHV0MSkuc2V0RGlydHkoKTtcblx0XHQoPFRlc3RFZGl0b3JJbnB1dD5pbnB1dDEpLnNldExhYmVsKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkxQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsMUNoYW5nZUNvdW50ZXIsIDEpO1xuXG5cdFx0KDxUZXN0RWRpdG9ySW5wdXQ+aW5wdXQyKS5zZXREaXJ0eSgpO1xuXHRcdCg8VGVzdEVkaXRvcklucHV0PmlucHV0Mikuc2V0TGFiZWwoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eTJDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwyQ2hhbmdlQ291bnRlciwgMSk7XG5cblx0XHRjbG9zZUFsbEVkaXRvcnMoZ3JvdXAyKTtcblxuXHRcdCg8VGVzdEVkaXRvcklucHV0PmlucHV0Mikuc2V0RGlydHkoKTtcblx0XHQoPFRlc3RFZGl0b3JJbnB1dD5pbnB1dDIpLnNldExhYmVsKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkyQ291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsMkNoYW5nZUNvdW50ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eTFDb3VudGVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwxQ2hhbmdlQ291bnRlciwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreSBFZGl0b3JzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogZmFsc2UsIGFjdGl2ZTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5zdGlja3lDb3VudCwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCwgeyBleGNsdWRlU3RpY2t5OiB0cnVlIH0pLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSwgeyBleGNsdWRlU3RpY2t5OiB0cnVlIH0pLmxlbmd0aCwgMyk7XG5cblx0XHQvLyBTdGljayBsYXN0IGVkaXRvciBzaG91bGQgbW92ZSBpdCBmaXJzdCBhbmQgcGluXG5cdFx0Z3JvdXAuc3RpY2soaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSwgeyBleGNsdWRlU3RpY2t5OiB0cnVlIH0pLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFLCB7IGV4Y2x1ZGVTdGlja3k6IGZhbHNlIH0pLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNQaW5uZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMCk7XG5cblx0XHRsZXQgc2VxdWVudGlhbEFsbEVkaXRvcnMgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VxdWVudGlhbEFsbEVkaXRvcnMubGVuZ3RoLCAzKTtcblx0XHRsZXQgc2VxdWVudGlhbEVkaXRvcnNFeGNsdWRpbmdTdGlja3kgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5Lmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0Lm9rKHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5LmluZGV4T2YoaW5wdXQxKSA+PSAwKTtcblx0XHRhc3NlcnQub2soc2VxdWVudGlhbEVkaXRvcnNFeGNsdWRpbmdTdGlja3kuaW5kZXhPZihpbnB1dDIpID49IDApO1xuXHRcdGxldCBtcnVBbGxFZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVBbGxFZGl0b3JzLmxlbmd0aCwgMyk7XG5cdFx0bGV0IG1ydUVkaXRvcnNFeGNsdWRpbmdTdGlja3kgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSwgeyBleGNsdWRlU3RpY2t5OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVFZGl0b3JzRXhjbHVkaW5nU3RpY2t5Lmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0Lm9rKG1ydUVkaXRvcnNFeGNsdWRpbmdTdGlja3kuaW5kZXhPZihpbnB1dDEpID49IDApO1xuXHRcdGFzc2VydC5vayhtcnVFZGl0b3JzRXhjbHVkaW5nU3RpY2t5LmluZGV4T2YoaW5wdXQyKSA+PSAwKTtcblxuXHRcdC8vIFN0aWNraW5nIHNhbWUgZWRpdG9yIGFnYWluIGlzIGEgbm8tb3Bcblx0XHRncm91cC5zdGljayhpbnB1dDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCB0cnVlKTtcblxuXHRcdC8vIFN0aWNraW5nIGxhc3QgZWRpdG9yIG5vdyBzaG91bGQgbW92ZSBpdCBhZnRlciBzdGlja3kgb25lXG5cdFx0Z3JvdXAuc3RpY2soaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDEpLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDIpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDMpLCAwKTtcblxuXHRcdHNlcXVlbnRpYWxBbGxFZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxBbGxFZGl0b3JzLmxlbmd0aCwgMyk7XG5cdFx0c2VxdWVudGlhbEVkaXRvcnNFeGNsdWRpbmdTdGlja3kgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5LmluZGV4T2YoaW5wdXQxKSA+PSAwKTtcblx0XHRtcnVBbGxFZGl0b3JzID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtcnVBbGxFZGl0b3JzLmxlbmd0aCwgMyk7XG5cdFx0bXJ1RWRpdG9yc0V4Y2x1ZGluZ1N0aWNreSA9IGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFLCB7IGV4Y2x1ZGVTdGlja3k6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydUVkaXRvcnNFeGNsdWRpbmdTdGlja3kubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQub2sobXJ1RWRpdG9yc0V4Y2x1ZGluZ1N0aWNreS5pbmRleE9mKGlucHV0MSkgPj0gMCk7XG5cblx0XHQvLyBTdGlja2luZyByZW1haW5pbmcgZWRpdG9yIGFsc28gd29ya3Ncblx0XHRncm91cC5zdGljayhpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5zdGlja3lDb3VudCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMCk7XG5cblx0XHRzZXF1ZW50aWFsQWxsRWRpdG9ycyA9IGdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXF1ZW50aWFsQWxsRWRpdG9ycy5sZW5ndGgsIDMpO1xuXHRcdHNlcXVlbnRpYWxFZGl0b3JzRXhjbHVkaW5nU3RpY2t5ID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCwgeyBleGNsdWRlU3RpY2t5OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXF1ZW50aWFsRWRpdG9yc0V4Y2x1ZGluZ1N0aWNreS5sZW5ndGgsIDApO1xuXHRcdG1ydUFsbEVkaXRvcnMgPSBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1ydUFsbEVkaXRvcnMubGVuZ3RoLCAzKTtcblx0XHRtcnVFZGl0b3JzRXhjbHVkaW5nU3RpY2t5ID0gZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUsIHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobXJ1RWRpdG9yc0V4Y2x1ZGluZ1N0aWNreS5sZW5ndGgsIDApO1xuXG5cdFx0Ly8gVW5zdGlja2luZyBtb3ZlcyBlZGl0b3IgYWZ0ZXIgc3RpY2t5IG9uZXNcblx0XHRncm91cC51bnN0aWNrKGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMik7XG5cblx0XHQvLyBVbnN0aWNraW5nIGFsbCB3b3Jrc1xuXHRcdGdyb3VwLnVuc3RpY2soaW5wdXQxKTtcblx0XHRncm91cC51bnN0aWNrKGlucHV0Mik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MyksIGZhbHNlKTtcblxuXHRcdGdyb3VwLm1vdmVFZGl0b3IoaW5wdXQxLCAwKTtcblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0MiwgMSk7XG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDMsIDIpO1xuXG5cdFx0Ly8gT3BlbmluZyBhIG5ldyBlZGl0b3IgYWx3YXlzIG9wZW5zIGFmdGVyIHN0aWNreSBlZGl0b3JzXG5cdFx0Z3JvdXAuc3RpY2soaW5wdXQxKTtcblx0XHRncm91cC5zdGljayhpbnB1dDIpO1xuXHRcdGdyb3VwLnNldEFjdGl2ZShpbnB1dDEpO1xuXG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDQpLCAyKTtcblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5jbG9zZWRbMF0uc3RpY2t5LCBmYWxzZSk7XG5cblx0XHRncm91cC5zZXRBY3RpdmUoaW5wdXQyKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQ0LCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0NCksIDIpO1xuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0NCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLmNsb3NlZFsxXS5zdGlja3ksIGZhbHNlKTtcblxuXHRcdC8vIFJlc2V0XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMik7XG5cblx0XHQvLyBNb3ZpbmcgYSBzdGlja3kgZWRpdG9yIHdvcmtzXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDEsIDEpOyAvLyBzdGlsbCBtb3ZlZCB3aXRoaW4gc3RpY2t5IHJhbmdlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDIpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDEsIDApOyAvLyBzdGlsbCBtb3ZlZCB3aXRoaW4gc3RpY2t5IHJhbmdlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDIpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDEsIDIpOyAvLyBtb3ZlZCBvdXQgb2Ygc3RpY2t5IHJhbmdlLy9cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDEpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDIsIDIpOyAvLyBtb3ZlZCBvdXQgb2Ygc3RpY2t5IHJhbmdlXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMCk7XG5cblx0XHQvLyBSZXNldFxuXHRcdGdyb3VwLm1vdmVFZGl0b3IoaW5wdXQxLCAwKTtcblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0MiwgMSk7XG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDMsIDIpO1xuXHRcdGdyb3VwLnN0aWNrKGlucHV0MSk7XG5cdFx0Z3JvdXAudW5zdGljayhpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5zdGlja3lDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDEpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDIpLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaW5kZXhPZihpbnB1dDMpLCAyKTtcblxuXHRcdC8vIE1vdmluZyBhIHVuc3RpY2t5IGVkaXRvciBpbiB3b3Jrc1xuXHRcdGdyb3VwLm1vdmVFZGl0b3IoaW5wdXQzLCAxKTsgLy8gc3RpbGwgbW92ZWQgd2l0aGluIHVuc3RpY2tlZCByYW5nZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMSk7XG5cblx0XHRncm91cC5tb3ZlRWRpdG9yKGlucHV0MywgMik7IC8vIHN0aWxsIG1vdmVkIHdpdGhpbiB1bnN0aWNrZWQgcmFuZ2Vcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDIpO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDMsIDApOyAvLyBtb3ZlZCBpbnRvIHN0aWNreSByYW5nZS8vXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDApO1xuXG5cdFx0Z3JvdXAubW92ZUVkaXRvcihpbnB1dDIsIDApOyAvLyBtb3ZlZCBpbnRvIHN0aWNreSByYW5nZVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MSksIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MiksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pbmRleE9mKGlucHV0MyksIDEpO1xuXG5cdFx0Ly8gQ2xvc2luZyBhIHN0aWNreSBlZGl0b3IgdXBkYXRlcyBzdGF0ZSBwcm9wZXJseVxuXHRcdGdyb3VwLnN0aWNrKGlucHV0MSk7XG5cdFx0Z3JvdXAuc3RpY2soaW5wdXQyKTtcblx0XHRncm91cC51bnN0aWNrKGlucHV0Myk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAyKTtcblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzJdLnN0aWNreSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAxKTtcblx0XHRncm91cC5jbG9zZUVkaXRvcihpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuY2xvc2VkWzNdLnN0aWNreSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAwKTtcblxuXHRcdGNsb3NlQWxsRWRpdG9ycyhncm91cCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAwKTtcblxuXHRcdC8vIE9wZW4gc3RpY2t5XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5zdGlja3lDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MSksIHRydWUpO1xuXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MiksIGZhbHNlKTtcblxuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgdHJ1ZSk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCwgeyBwaW5uZWQ6IGZhbHNlLCBhY3RpdmU6IHRydWUsIHN0aWNreTogdHJ1ZSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU3RpY2t5KGlucHV0MyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQ0KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzUGlubmVkKGlucHV0NCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQxKSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmluZGV4T2YoaW5wdXQ0KSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBFZGl0b3JzIHNlbmRzIGNvcnJlY3QgZWRpdG9yIGluZGV4JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IGZhbHNlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDApO1xuXG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRncm91cC5zdGljayhpbnB1dDMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50cy5zdGlja3lbMF0uZWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDEpO1xuXG5cdFx0Z3JvdXAuc3RpY2soaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMuc3RpY2t5WzFdLmVkaXRvckluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLnN0aWNreUNvdW50LCAyKTtcblxuXHRcdGdyb3VwLnVuc3RpY2soaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnVuc3RpY2t5WzBdLmVkaXRvckluZGV4LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTdGlja3koaW5wdXQzKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc3RpY2t5Q291bnQsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbkRpZE1vdmVFZGl0b3IgRXZlbnQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAxID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IGdyb3VwMiA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IGlucHV0MWdyb3VwMSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyZ3JvdXAxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDFncm91cDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0Mmdyb3VwMiA9IGlucHV0KCk7XG5cblx0XHQvLyBPcGVuIGFsbCB0aGUgZWRpdG9yc1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0MWdyb3VwMSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDAgfSk7XG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQyZ3JvdXAxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiBmYWxzZSwgaW5kZXg6IDEgfSk7XG5cdFx0Z3JvdXAyLm9wZW5FZGl0b3IoaW5wdXQxZ3JvdXAyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMCB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDJncm91cDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IGZhbHNlLCBpbmRleDogMSB9KTtcblxuXHRcdGNvbnN0IGdyb3VwMUV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXAxKTtcblx0XHRjb25zdCBncm91cDJFdmVudHMgPSBncm91cExpc3RlbmVyKGdyb3VwMik7XG5cblx0XHRncm91cDEubW92ZUVkaXRvcihpbnB1dDFncm91cDEsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFFdmVudHMubW92ZWRbMF0uZWRpdG9yLCBpbnB1dDFncm91cDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFFdmVudHMubW92ZWRbMF0ub2xkRWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFFdmVudHMubW92ZWRbMF0uZWRpdG9ySW5kZXgsIDEpO1xuXG5cdFx0Z3JvdXAyLm1vdmVFZGl0b3IoaW5wdXQxZ3JvdXAyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyRXZlbnRzLm1vdmVkWzBdLmVkaXRvciwgaW5wdXQxZ3JvdXAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyRXZlbnRzLm1vdmVkWzBdLm9sZEVkaXRvckluZGV4LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyRXZlbnRzLm1vdmVkWzBdLmVkaXRvckluZGV4LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnb25EaWRPcGVuZWRpdG9yIEV2ZW50JywgKCkgPT4ge1xuXHRcdGNvbnN0IGdyb3VwMSA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblx0XHRjb25zdCBncm91cDIgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBncm91cDFFdmVudHMgPSBncm91cExpc3RlbmVyKGdyb3VwMSk7XG5cdFx0Y29uc3QgZ3JvdXAyRXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cDIpO1xuXG5cdFx0Y29uc3QgaW5wdXQxZ3JvdXAxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDJncm91cDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MWdyb3VwMiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyZ3JvdXAyID0gaW5wdXQoKTtcblxuXHRcdC8vIE9wZW4gYWxsIHRoZSBlZGl0b3JzXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQxZ3JvdXAxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMCB9KTtcblx0XHRncm91cDEub3BlbkVkaXRvcihpbnB1dDJncm91cDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IGZhbHNlLCBpbmRleDogMSB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDFncm91cDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAwIH0pO1xuXHRcdGdyb3VwMi5vcGVuRWRpdG9yKGlucHV0Mmdyb3VwMiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogZmFsc2UsIGluZGV4OiAxIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMUV2ZW50cy5vcGVuZWQubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxRXZlbnRzLm9wZW5lZFswXS5lZGl0b3IsIGlucHV0MWdyb3VwMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMUV2ZW50cy5vcGVuZWRbMF0uZWRpdG9ySW5kZXgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDFFdmVudHMub3BlbmVkWzFdLmVkaXRvciwgaW5wdXQyZ3JvdXAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxRXZlbnRzLm9wZW5lZFsxXS5lZGl0b3JJbmRleCwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyRXZlbnRzLm9wZW5lZC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDJFdmVudHMub3BlbmVkWzBdLmVkaXRvciwgaW5wdXQxZ3JvdXAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAyRXZlbnRzLm9wZW5lZFswXS5lZGl0b3JJbmRleCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMkV2ZW50cy5vcGVuZWRbMV0uZWRpdG9yLCBpbnB1dDJncm91cDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cDJFdmVudHMub3BlbmVkWzFdLmVkaXRvckluZGV4LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnbW92aW5nIGVkaXRvciBzZW5kcyBzdGlja3kgZXZlbnQgd2hlbiBzdGlja3kgY2hhbmdlcycsICgpID0+IHtcblx0XHRjb25zdCBncm91cDEgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBpbnB1dDFncm91cDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0Mmdyb3VwMSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzZ3JvdXAxID0gaW5wdXQoKTtcblxuXHRcdC8vIE9wZW4gYWxsIHRoZSBlZGl0b3JzXG5cdFx0Z3JvdXAxLm9wZW5FZGl0b3IoaW5wdXQxZ3JvdXAxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMCwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0Mmdyb3VwMSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogZmFsc2UsIGluZGV4OiAxIH0pO1xuXHRcdGdyb3VwMS5vcGVuRWRpdG9yKGlucHV0M2dyb3VwMSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogZmFsc2UsIGluZGV4OiAyIH0pO1xuXG5cdFx0Y29uc3QgZ3JvdXAxRXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cDEpO1xuXG5cdFx0Z3JvdXAxLm1vdmVFZGl0b3IoaW5wdXQyZ3JvdXAxLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAxRXZlbnRzLnN0aWNreVswXS5lZGl0b3IsIGlucHV0Mmdyb3VwMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMUV2ZW50cy5zdGlja3lbMF0uZWRpdG9ySW5kZXgsIDApO1xuXG5cdFx0Y29uc3QgZ3JvdXAyID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgaW5wdXQxZ3JvdXAyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDJncm91cDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0M2dyb3VwMiA9IGlucHV0KCk7XG5cblx0XHQvLyBPcGVuIGFsbCB0aGUgZWRpdG9yc1xuXHRcdGdyb3VwMi5vcGVuRWRpdG9yKGlucHV0MWdyb3VwMiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDAsIHN0aWNreTogdHJ1ZSB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDJncm91cDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IGZhbHNlLCBpbmRleDogMSB9KTtcblx0XHRncm91cDIub3BlbkVkaXRvcihpbnB1dDNncm91cDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IGZhbHNlLCBpbmRleDogMiB9KTtcblxuXHRcdGNvbnN0IGdyb3VwMkV2ZW50cyA9IGdyb3VwTGlzdGVuZXIoZ3JvdXAyKTtcblxuXHRcdGdyb3VwMi5tb3ZlRWRpdG9yKGlucHV0MWdyb3VwMiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMkV2ZW50cy51bnN0aWNreVswXS5lZGl0b3IsIGlucHV0MWdyb3VwMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwMkV2ZW50cy51bnN0aWNreVswXS5lZGl0b3JJbmRleCwgMSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydFNlbGVjdGlvbihncm91cDogRWRpdG9yR3JvdXBNb2RlbCwgYWN0aXZlRWRpdG9yOiBFZGl0b3JJbnB1dCwgc2VsZWN0ZWRFZGl0b3JzOiBFZGl0b3JJbnB1dFtdKTogdm9pZCB7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgYWN0aXZlRWRpdG9yKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCwgc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCk7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBzZWxlY3RlZEVkaXRvcnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5zZWxlY3RlZEVkaXRvcnNbaV0sIHNlbGVjdGVkRWRpdG9yc1tpXSk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnZWRpdG9yIHNlbGVjdGlvbjogc2VsZWN0ZWRFZGl0b3JzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGdyb3VwID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3QgYWN0aXZlRWRpdG9yID0gZ3JvdXAuYWN0aXZlRWRpdG9yO1xuXHRcdGNvbnN0IHNlbGVjdGVkRWRpdG9ycyA9IGdyb3VwLnNlbGVjdGVkRWRpdG9ycztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aXZlRWRpdG9yLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCwgMCk7XG5cblx0XHQvLyBhY3RpdmUgZWRpdG9yOiBpbnB1dDEsIHNlbGVjdGlvbjogW2lucHV0MV1cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMCB9KTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MSwgW2lucHV0MV0pO1xuXG5cdFx0Ly8gYWN0aXZlIGVkaXRvcjogaW5wdXQzLCBzZWxlY3Rpb246IFtpbnB1dDNdXG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMSB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MywgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDIgfSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9uKGdyb3VwLCBpbnB1dDMsIFtpbnB1dDNdKTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Miwgc2VsZWN0aW9uOiBbaW5wdXQxLCBpbnB1dDJdIChpbiBzZXF1ZW50aWFsIG9yZGVyKVxuXHRcdGdyb3VwLnNldFNlbGVjdGlvbihpbnB1dDIsIFtpbnB1dDFdKTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MiwgW2lucHV0MSwgaW5wdXQyXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VkaXRvciBzZWxlY3Rpb246IG9wZW5FZGl0b3Igd2l0aCBpbmFjdGl2ZSBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHQvLyBhY3RpdmUgZWRpdG9yOiBpbnB1dDMsIHNlbGVjdGlvbjogW2lucHV0M11cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDAgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAxIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMiB9KTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Miwgc2VsZWN0aW9uOiBbaW5wdXQxLCBpbnB1dDIsIGlucHV0M10gKGluIHNlcXVlbnRpYWwgb3JkZXIpXG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgYWN0aXZlOiB0cnVlLCBpbmFjdGl2ZVNlbGVjdGlvbjogW2lucHV0MywgaW5wdXQxXSB9KTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MiwgW2lucHV0MSwgaW5wdXQyLCBpbnB1dDNdKTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0MSwgc2VsZWN0aW9uOiBbaW5wdXQxLCBpbnB1dDNdIChpbiBzZXF1ZW50aWFsIG9yZGVyKVxuXHRcdC8vIHRlc3QgZHVwbGljYXRlIGVudHJpZXNcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBhY3RpdmU6IHRydWUsIGluYWN0aXZlU2VsZWN0aW9uOiBbaW5wdXQzLCBpbnB1dDEsIGlucHV0M10gfSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9uKGdyb3VwLCBpbnB1dDEsIFtpbnB1dDEsIGlucHV0M10pO1xuXG5cdFx0Ly8gYWN0aXZlIGVkaXRvcjogaW5wdXQxLCBzZWxlY3Rpb246IFtpbnB1dDEsIGlucHV0Ml0gKGluIHNlcXVlbnRpYWwgb3JkZXIpXG5cdFx0Ly8gb3BlbiBuZXcgRWRpdG9yIGFzIGluYWN0aXZlIHdpdGggc2VsZWN0aW9uXG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0NCwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogZmFsc2UsIGluYWN0aXZlU2VsZWN0aW9uOiBbaW5wdXQyXSwgaW5kZXg6IDMgfSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9uKGdyb3VwLCBpbnB1dDEsIFtpbnB1dDEsIGlucHV0Ml0pO1xuXG5cdFx0Ly8gYWN0aXZlIGVkaXRvcjogaW5wdXQ1LCBzZWxlY3Rpb246IFtpbnB1dDQsIGlucHV0NV0gKGluIHNlcXVlbnRpYWwgb3JkZXIpXG5cdFx0Ly8gb3BlbiBuZXcgRWRpdG9yIGFzIGFjdGl2ZSB3aXRoIHNlbGVjdGlvblxuXHRcdGNvbnN0IGlucHV0NSA9IGlucHV0KCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDUsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluYWN0aXZlU2VsZWN0aW9uOiBbaW5wdXQ0XSwgaW5kZXg6IDQgfSk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9uKGdyb3VwLCBpbnB1dDUsIFtpbnB1dDQsIGlucHV0NV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3Igc2VsZWN0aW9uOiBjbG9zZUVkaXRvciBrZWVwcyBzZWxlY3Rpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHQvLyBhY3RpdmUgZWRpdG9yOiBpbnB1dDMsIHNlbGVjdGlvbjogW2lucHV0M11cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDAgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAxIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMiB9KTtcblxuXHRcdGdyb3VwLnNldFNlbGVjdGlvbihpbnB1dDIsIFtpbnB1dDMsIGlucHV0MV0pO1xuXHRcdGdyb3VwLmNsb3NlRWRpdG9yKGlucHV0Myk7XG5cdFx0YXNzZXJ0U2VsZWN0aW9uKGdyb3VwLCBpbnB1dDIsIFtpbnB1dDEsIGlucHV0Ml0pO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3Igc2VsZWN0aW9uOiBzZXRTZWxldGlvbicsICgpID0+IHtcblx0XHRjb25zdCBncm91cCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Mywgc2VsZWN0aW9uOiBbaW5wdXQzXVxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMCB9KTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDEgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAyIH0pO1xuXG5cdFx0Ly8gYWN0aXZlIGVkaXRvcjogaW5wdXQyLCBzZWxlY3Rpb246IFtpbnB1dDEsIGlucHV0MiwgaW5wdXQzXSAoaW4gc2VxdWVudGlhbCBvcmRlcilcblx0XHRncm91cC5zZXRTZWxlY3Rpb24oaW5wdXQyLCBbaW5wdXQzLCBpbnB1dDFdKTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MiwgW2lucHV0MSwgaW5wdXQyLCBpbnB1dDNdKTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Mywgc2VsZWN0aW9uOiBbaW5wdXQzXVxuXHRcdGdyb3VwLnNldFNlbGVjdGlvbihpbnB1dDMsIFtdKTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MywgW2lucHV0M10pO1xuXG5cdFx0Ly8gYWN0aXZlIGVkaXRvcjogaW5wdXQyLCBzZWxlY3Rpb246IFtpbnB1dDEsIGlucHV0Ml1cblx0XHQvLyB0ZXN0IGR1cGxpY2F0ZSBlbnRyaWVzXG5cdFx0Z3JvdXAuc2V0U2VsZWN0aW9uKGlucHV0MiwgW2lucHV0MSwgaW5wdXQyLCBpbnB1dDFdKTtcblx0XHRhc3NlcnRTZWxlY3Rpb24oZ3JvdXAsIGlucHV0MiwgW2lucHV0MSwgaW5wdXQyXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VkaXRvciBzZWxlY3Rpb246IGlzU2VsZWN0ZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHQvLyBhY3RpdmUgZWRpdG9yOiBpbnB1dDMsIHNlbGVjdGlvbjogW2lucHV0M11cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgaW5kZXg6IDAgfSk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAxIH0pO1xuXHRcdGdyb3VwLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBpbmRleDogMiB9KTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Miwgc2VsZWN0aW9uOiBbaW5wdXQxLCBpbnB1dDIsIGlucHV0M10gKGluIHNlcXVlbnRpYWwgb3JkZXIpXG5cdFx0Z3JvdXAuc2V0U2VsZWN0aW9uKGlucHV0MiwgW2lucHV0MywgaW5wdXQxXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTZWxlY3RlZChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTZWxlY3RlZChpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTZWxlY3RlZChpbnB1dDMpLCB0cnVlKTtcblxuXHRcdC8vIGFjdGl2ZSBlZGl0b3I6IGlucHV0Mywgc2VsZWN0aW9uOiBbaW5wdXQzXVxuXHRcdGdyb3VwLnNldFNlbGVjdGlvbihpbnB1dDMsIFtdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1NlbGVjdGVkKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTZWxlY3RlZChpbnB1dDIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQzKSwgdHJ1ZSk7XG5cblx0XHQvLyB1c2UgaW5kZXhcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNTZWxlY3RlZCgwKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1NlbGVjdGVkKDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoMiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3Igc2VsZWN0aW9uOiBzZWxlY3QgaW52YWxpZCBlZGl0b3InLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUsIGluZGV4OiAwIH0pO1xuXG5cdFx0Z3JvdXAuc2V0U2VsZWN0aW9uKGlucHV0MiwgW2lucHV0MV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQyKSwgZmFsc2UpO1xuXG5cdFx0Z3JvdXAuc2V0U2VsZWN0aW9uKGlucHV0MSwgW2lucHV0Ml0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvciwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuc2VsZWN0ZWRFZGl0b3JzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzU2VsZWN0ZWQoaW5wdXQyKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdlZGl0b3IgdHJhbnNpZW50OiBiYXNpY3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZ3JvdXAgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cdFx0Y29uc3QgZXZlbnRzID0gZ3JvdXBMaXN0ZW5lcihncm91cCk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Z3JvdXAub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ3JvdXAuaXNUcmFuc2llbnQoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMudHJhbnNpZW50Lmxlbmd0aCwgMCk7XG5cblx0XHRncm91cC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIGFjdGl2ZTogdHJ1ZSwgdHJhbnNpZW50OiB0cnVlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudHMudHJhbnNpZW50WzBdLmVkaXRvciwgaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1RyYW5zaWVudChpbnB1dDIpLCB0cnVlKTtcblxuXHRcdGdyb3VwLnNldFRyYW5zaWVudChpbnB1dDEsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChncm91cC5pc1RyYW5zaWVudChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnRyYW5zaWVudFsxXS5lZGl0b3IsIGlucHV0MSk7XG5cblx0XHRncm91cC5zZXRUcmFuc2llbnQoaW5wdXQyLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmlzVHJhbnNpZW50KGlucHV0MiksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRzLnRyYW5zaWVudFsyXS5lZGl0b3IsIGlucHV0Mik7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxrQkFBOEksMEJBQTBCLHlCQUF5Qix3QkFBd0IsOEJBQThCO0FBQ2hRLFNBQVMsa0JBQStFLGdCQUFnQixjQUF3RSxrQkFBa0Isb0JBQW9CLDRCQUE0QjtBQUNsUCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxzQkFBc0IscUNBQXFDO0FBQ3BFLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQThCLG9CQUFvQjtBQUMzRCxTQUFTLG9CQUFvQiwwQkFBMEI7QUFDdkQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsK0NBQStDO0FBRXhELE1BQU0sb0JBQW9CLE1BQU07QUFFL0IsTUFBSTtBQUVKLGdCQUFjLE1BQU07QUFDbkIscUJBQWlCLFFBQVE7QUFDekIsc0JBQWtCO0FBQUEsRUFDbkIsQ0FBQztBQUVELFdBQVMsT0FBOEI7QUFDdEMsUUFBSSxDQUFDLGlCQUFpQjtBQUNyQix3QkFBa0IsSUFBSSx5QkFBeUI7QUFBQSxJQUNoRDtBQUNBLFVBQU1BLFFBQU87QUFDYixJQUFBQSxNQUFL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
