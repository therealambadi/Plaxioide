import assert from "assert";
import { EditorGroupModel } from "../../../../common/editor/editorGroupModel.js";
import { EditorExtensions, EditorsOrder, GroupModelChangeKind } from "../../../../common/editor.js";
import { TestLifecycleService } from "../../workbenchTestServices.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { ILifecycleService } from "../../../../services/lifecycle/common/lifecycle.js";
import { IWorkspaceContextService } from "../../../../../platform/workspace/common/workspace.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { IStorageService } from "../../../../../platform/storage/common/storage.js";
import { DisposableStore, toDisposable } from "../../../../../base/common/lifecycle.js";
import { TestContextService, TestStorageService } from "../../../common/workbenchTestServices.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { isEqual } from "../../../../../base/common/resources.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { StickyEditorGroupModel, UnstickyEditorGroupModel } from "../../../../common/editor/filteredEditorGroupModel.js";
suite("FilteredEditorGroupModel", () => {
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
  function closeAllEditors(group) {
    for (const editor of group.getEditors(EditorsOrder.SEQUENTIAL)) {
      group.closeEditor(editor, void 0, false);
    }
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
  test("Sticky/Unsticky count", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.count, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.count, 0);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.count, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.count, 1);
    model.unstick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.count, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.count, 2);
  });
  test("Sticky/Unsticky stickyCount", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.stickyCount, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.stickyCount, 0);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.stickyCount, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.stickyCount, 0);
    model.unstick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.stickyCount, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.stickyCount, 0);
  });
  test("Sticky/Unsticky isEmpty", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: false });
    model.openEditor(input2, { pinned: true, sticky: false });
    assert.strictEqual(stickyFilteredEditorGroup.count === 0, true);
    assert.strictEqual(unstickyFilteredEditorGroup.count === 0, false);
    model.stick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.count === 0, false);
    assert.strictEqual(unstickyFilteredEditorGroup.count === 0, false);
    model.stick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.count === 0, false);
    assert.strictEqual(unstickyFilteredEditorGroup.count === 0, true);
  });
  test("Sticky/Unsticky editors", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL)[0], input2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    model.unstick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 2);
  });
  test("Sticky/Unsticky activeEditor", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true, active: true });
    assert.strictEqual(stickyFilteredEditorGroup.activeEditor, input1);
    assert.strictEqual(unstickyFilteredEditorGroup.activeEditor, null);
    model.openEditor(input2, { pinned: true, sticky: false, active: true });
    assert.strictEqual(stickyFilteredEditorGroup.activeEditor, null);
    assert.strictEqual(unstickyFilteredEditorGroup.activeEditor, input2);
    model.closeEditor(input1);
    assert.strictEqual(stickyFilteredEditorGroup.activeEditor, null);
    assert.strictEqual(unstickyFilteredEditorGroup.activeEditor, input2);
    model.closeEditor(input2);
    assert.strictEqual(stickyFilteredEditorGroup.activeEditor, null);
    assert.strictEqual(unstickyFilteredEditorGroup.activeEditor, null);
  });
  test("Sticky/Unsticky previewEditor", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1);
    assert.strictEqual(stickyFilteredEditorGroup.previewEditor, null);
    assert.strictEqual(unstickyFilteredEditorGroup.previewEditor, input1);
    model.openEditor(input2, { sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.previewEditor, null);
    assert.strictEqual(unstickyFilteredEditorGroup.previewEditor, input1);
  });
  test("Sticky/Unsticky isSticky()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.isSticky(input1), true);
    assert.strictEqual(stickyFilteredEditorGroup.isSticky(input2), true);
    model.unstick(input1);
    model.closeEditor(input1);
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(unstickyFilteredEditorGroup.isSticky(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isSticky(input2), false);
  });
  test("Sticky/Unsticky isPinned()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: false });
    model.openEditor(input3, { pinned: false, sticky: true });
    model.openEditor(input4, { pinned: false, sticky: false });
    assert.strictEqual(stickyFilteredEditorGroup.isPinned(input1), true);
    assert.strictEqual(unstickyFilteredEditorGroup.isPinned(input2), true);
    assert.strictEqual(stickyFilteredEditorGroup.isPinned(input3), true);
    assert.strictEqual(unstickyFilteredEditorGroup.isPinned(input4), false);
  });
  test("Sticky/Unsticky isActive()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true, active: true });
    assert.strictEqual(stickyFilteredEditorGroup.isActive(input1), true);
    model.openEditor(input2, { pinned: true, sticky: false, active: true });
    assert.strictEqual(stickyFilteredEditorGroup.isActive(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isActive(input2), true);
    model.unstick(input1);
    assert.strictEqual(unstickyFilteredEditorGroup.isActive(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isActive(input2), true);
  });
  test("Sticky/Unsticky getEditors()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true, active: true });
    model.openEditor(input2, { pinned: true, sticky: true, active: true });
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 0);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true }).length, 0);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: false }).length, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: true }).length, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL, { excludeSticky: false }).length, 0);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0], input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1], input1);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0], input2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL)[0], input1);
    model.unstick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL).length, 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).length, 2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[0], input2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE)[1], input1);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL)[0], input2);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditors(EditorsOrder.SEQUENTIAL)[1], input1);
  });
  test("Sticky/Unsticky getEditorByIndex()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    const input3 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(0), input1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(1), input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(2), void 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(0), void 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(1), void 0);
    model.openEditor(input3, { pinned: true, sticky: false });
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(0), input1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(1), input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(2), void 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(0), input3);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(1), void 0);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(0), input2);
    assert.strictEqual(stickyFilteredEditorGroup.getEditorByIndex(1), void 0);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(0), input1);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(1), input3);
    assert.strictEqual(unstickyFilteredEditorGroup.getEditorByIndex(2), void 0);
  });
  test("Sticky/Unsticky indexOf()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    const input3 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input1), 0);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input2), 1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input1), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input2), -1);
    model.openEditor(input3, { pinned: true, sticky: false });
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input1), 0);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input2), 1);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input3), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input1), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input2), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input3), 0);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input1), -1);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input2), 0);
    assert.strictEqual(stickyFilteredEditorGroup.indexOf(input3), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input1), 0);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input2), -1);
    assert.strictEqual(unstickyFilteredEditorGroup.indexOf(input3), 1);
  });
  test("Sticky/Unsticky isFirst()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.isFirst(input1), true);
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.isFirst(input1), true);
    assert.strictEqual(stickyFilteredEditorGroup.isFirst(input2), false);
    model.unstick(input1);
    assert.strictEqual(unstickyFilteredEditorGroup.isFirst(input1), true);
    assert.strictEqual(stickyFilteredEditorGroup.isFirst(input2), true);
    model.unstick(input2);
    assert.strictEqual(unstickyFilteredEditorGroup.isFirst(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isFirst(input2), true);
    model.moveEditor(input2, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.isFirst(input1), true);
    assert.strictEqual(unstickyFilteredEditorGroup.isFirst(input2), false);
  });
  test("Sticky/Unsticky isLast()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.isLast(input1), true);
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.isLast(input1), false);
    assert.strictEqual(stickyFilteredEditorGroup.isLast(input2), true);
    model.unstick(input1);
    assert.strictEqual(unstickyFilteredEditorGroup.isLast(input1), true);
    assert.strictEqual(stickyFilteredEditorGroup.isLast(input2), true);
    model.unstick(input2);
    assert.strictEqual(unstickyFilteredEditorGroup.isLast(input1), true);
    assert.strictEqual(unstickyFilteredEditorGroup.isLast(input2), false);
    model.moveEditor(input2, 1);
    assert.strictEqual(unstickyFilteredEditorGroup.isLast(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isLast(input2), true);
  });
  test("Sticky/Unsticky contains()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    model.openEditor(input1, { pinned: true, sticky: true });
    model.openEditor(input2, { pinned: true, sticky: true });
    assert.strictEqual(stickyFilteredEditorGroup.contains(input1), true);
    assert.strictEqual(stickyFilteredEditorGroup.contains(input2), true);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input2), false);
    model.unstick(input1);
    assert.strictEqual(stickyFilteredEditorGroup.contains(input1), false);
    assert.strictEqual(stickyFilteredEditorGroup.contains(input2), true);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input1), true);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input2), false);
    model.unstick(input2);
    assert.strictEqual(stickyFilteredEditorGroup.contains(input1), false);
    assert.strictEqual(stickyFilteredEditorGroup.contains(input2), false);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input1), true);
    assert.strictEqual(unstickyFilteredEditorGroup.contains(input2), true);
  });
  test("Sticky/Unsticky group information", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    assert.strictEqual(stickyFilteredEditorGroup.id, model.id);
    assert.strictEqual(unstickyFilteredEditorGroup.id, model.id);
    assert.strictEqual(stickyFilteredEditorGroup.isLocked, model.isLocked);
    assert.strictEqual(unstickyFilteredEditorGroup.isLocked, model.isLocked);
    model.lock(true);
    assert.strictEqual(stickyFilteredEditorGroup.isLocked, model.isLocked);
    assert.strictEqual(unstickyFilteredEditorGroup.isLocked, model.isLocked);
    model.lock(false);
    assert.strictEqual(stickyFilteredEditorGroup.isLocked, model.isLocked);
    assert.strictEqual(unstickyFilteredEditorGroup.isLocked, model.isLocked);
  });
  test("Multiple Editors - Editor Emits Dirty and Label Changed", function() {
    const model1 = createEditorGroupModel();
    const model2 = createEditorGroupModel();
    const stickyFilteredEditorGroup1 = disposables.add(new StickyEditorGroupModel(model1));
    const unstickyFilteredEditorGroup1 = disposables.add(new UnstickyEditorGroupModel(model1));
    const stickyFilteredEditorGroup2 = disposables.add(new StickyEditorGroupModel(model2));
    const unstickyFilteredEditorGroup2 = disposables.add(new UnstickyEditorGroupModel(model2));
    const input1 = input();
    const input2 = input();
    model1.openEditor(input1, { pinned: true, active: true });
    model2.openEditor(input2, { pinned: true, active: true, sticky: true });
    let dirty1CounterSticky = 0;
    disposables.add(stickyFilteredEditorGroup1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty1CounterSticky++;
      }
    }));
    let dirty1CounterUnsticky = 0;
    disposables.add(unstickyFilteredEditorGroup1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty1CounterUnsticky++;
      }
    }));
    let dirty2CounterSticky = 0;
    disposables.add(stickyFilteredEditorGroup2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty2CounterSticky++;
      }
    }));
    let dirty2CounterUnsticky = 0;
    disposables.add(unstickyFilteredEditorGroup2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_DIRTY) {
        dirty2CounterUnsticky++;
      }
    }));
    let label1ChangeCounterSticky = 0;
    disposables.add(stickyFilteredEditorGroup1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label1ChangeCounterSticky++;
      }
    }));
    let label1ChangeCounterUnsticky = 0;
    disposables.add(unstickyFilteredEditorGroup1.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label1ChangeCounterUnsticky++;
      }
    }));
    let label2ChangeCounterSticky = 0;
    disposables.add(stickyFilteredEditorGroup2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label2ChangeCounterSticky++;
      }
    }));
    let label2ChangeCounterUnsticky = 0;
    disposables.add(unstickyFilteredEditorGroup2.onDidModelChange((e) => {
      if (e.kind === GroupModelChangeKind.EDITOR_LABEL) {
        label2ChangeCounterUnsticky++;
      }
    }));
    input1.setDirty();
    input1.setLabel();
    assert.strictEqual(dirty1CounterSticky, 0);
    assert.strictEqual(dirty1CounterUnsticky, 1);
    assert.strictEqual(label1ChangeCounterSticky, 0);
    assert.strictEqual(label1ChangeCounterUnsticky, 1);
    input2.setDirty();
    input2.setLabel();
    assert.strictEqual(dirty2CounterSticky, 1);
    assert.strictEqual(dirty2CounterUnsticky, 0);
    assert.strictEqual(label2ChangeCounterSticky, 1);
    assert.strictEqual(label2ChangeCounterUnsticky, 0);
    closeAllEditors(model2);
    input2.setDirty();
    input2.setLabel();
    assert.strictEqual(dirty2CounterSticky, 1);
    assert.strictEqual(dirty2CounterUnsticky, 0);
    assert.strictEqual(label2ChangeCounterSticky, 1);
    assert.strictEqual(label2ChangeCounterUnsticky, 0);
    assert.strictEqual(dirty1CounterSticky, 0);
    assert.strictEqual(dirty1CounterUnsticky, 1);
    assert.strictEqual(label1ChangeCounterSticky, 0);
    assert.strictEqual(label1ChangeCounterUnsticky, 1);
  });
  test("Sticky/Unsticky isTransient()", async () => {
    const model = createEditorGroupModel();
    const stickyFilteredEditorGroup = disposables.add(new StickyEditorGroupModel(model));
    const unstickyFilteredEditorGroup = disposables.add(new UnstickyEditorGroupModel(model));
    const input1 = input();
    const input2 = input();
    const input3 = input();
    const input4 = input();
    model.openEditor(input1, { pinned: true, transient: false });
    model.openEditor(input2, { pinned: true });
    model.openEditor(input3, { pinned: true, transient: true });
    model.openEditor(input4, { pinned: false, transient: true });
    assert.strictEqual(stickyFilteredEditorGroup.isTransient(input1), false);
    assert.strictEqual(unstickyFilteredEditorGroup.isTransient(input2), false);
    assert.strictEqual(stickyFilteredEditorGroup.isTransient(input3), true);
    assert.strictEqual(unstickyFilteredEditorGroup.isTransient(input4), true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3BhcnRzL2VkaXRvci9maWx0ZXJlZEVkaXRvckdyb3VwTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IEVkaXRvckdyb3VwTW9kZWwsIElTZXJpYWxpemVkRWRpdG9yR3JvdXBNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9yR3JvdXBNb2RlbC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBJRmlsZUVkaXRvcklucHV0LCBJRWRpdG9yU2VyaWFsaXplciwgRWRpdG9yc09yZGVyLCBHcm91cE1vZGVsQ2hhbmdlS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFRlc3RMaWZlY3ljbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFRlc3RDb250ZXh0U2VydmljZSwgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZWRpdG9ySW5wdXQuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFN0aWNreUVkaXRvckdyb3VwTW9kZWwsIFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IvZmlsdGVyZWRFZGl0b3JHcm91cE1vZGVsLmpzJztcblxuc3VpdGUoJ0ZpbHRlcmVkRWRpdG9yR3JvdXBNb2RlbCcsICgpID0+IHtcblxuXHRsZXQgdGVzdEluc3RTZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfCB1bmRlZmluZWQ7XG5cblx0c3VpdGVUZWFyZG93bigoKSA9PiB7XG5cdFx0dGVzdEluc3RTZXJ2aWNlPy5kaXNwb3NlKCk7XG5cdFx0dGVzdEluc3RTZXJ2aWNlID0gdW5kZWZpbmVkO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBpbnN0KCk6IElJbnN0YW50aWF0aW9uU2VydmljZSB7XG5cdFx0aWYgKCF0ZXN0SW5zdFNlcnZpY2UpIHtcblx0XHRcdHRlc3RJbnN0U2VydmljZSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UoKTtcblx0XHR9XG5cdFx0Y29uc3QgaW5zdCA9IHRlc3RJbnN0U2VydmljZTtcblx0XHRpbnN0LnN0dWIoSVN0b3JhZ2VTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cdFx0aW5zdC5zdHViKElMaWZlY3ljbGVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpKTtcblx0XHRpbnN0LnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBuZXcgVGVzdENvbnRleHRTZXJ2aWNlKCkpO1xuXHRcdGluc3Quc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignd29ya2JlbmNoJywgeyBlZGl0b3I6IHsgb3BlblBvc2l0aW9uaW5nOiAncmlnaHQnLCBmb2N1c1JlY2VudEVkaXRvckFmdGVyQ2xvc2U6IHRydWUgfSB9KTtcblx0XHRpbnN0LnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXG5cdFx0cmV0dXJuIGluc3Q7XG5cdH1cblxuXHRmdW5jdGlvbiBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKHNlcmlhbGl6ZWQ/OiBJU2VyaWFsaXplZEVkaXRvckdyb3VwTW9kZWwpOiBFZGl0b3JHcm91cE1vZGVsIHtcblx0XHRjb25zdCBncm91cCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0KCkuY3JlYXRlSW5zdGFuY2UoRWRpdG9yR3JvdXBNb2RlbCwgc2VyaWFsaXplZCkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGVkaXRvciBvZiBncm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkpIHtcblx0XHRcdFx0Z3JvdXAuY2xvc2VFZGl0b3IoZWRpdG9yKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gZ3JvdXA7XG5cdH1cblxuXHRsZXQgaW5kZXggPSAwO1xuXHRjbGFzcyBUZXN0RWRpdG9ySW5wdXQgZXh0ZW5kcyBFZGl0b3JJbnB1dCB7XG5cblx0XHRyZWFkb25seSByZXNvdXJjZSA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0cnVjdG9yKHB1YmxpYyBpZDogc3RyaW5nKSB7XG5cdFx0XHRzdXBlcigpO1xuXHRcdH1cblx0XHRvdmVycmlkZSBnZXQgdHlwZUlkKCkgeyByZXR1cm4gJ3Rlc3RFZGl0b3JJbnB1dEZvckdyb3Vwcyc7IH1cblx0XHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8SURpc3Bvc2FibGU+IHsgcmV0dXJuIG51bGwhOyB9XG5cblx0XHRvdmVycmlkZSBtYXRjaGVzKG90aGVyOiBUZXN0RWRpdG9ySW5wdXQpOiBib29sZWFuIHtcblx0XHRcdHJldHVybiBvdGhlciAmJiB0aGlzLmlkID09PSBvdGhlci5pZCAmJiBvdGhlciBpbnN0YW5jZW9mIFRlc3RFZGl0b3JJbnB1dDtcblx0XHR9XG5cblx0XHRzZXREaXJ0eSgpOiB2b2lkIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlRGlydHkuZmlyZSgpO1xuXHRcdH1cblxuXHRcdHNldExhYmVsKCk6IHZvaWQge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VMYWJlbC5maXJlKCk7XG5cdFx0fVxuXHR9XG5cblx0Y2xhc3MgTm9uU2VyaWFsaXphYmxlVGVzdEVkaXRvcklucHV0IGV4dGVuZHMgRWRpdG9ySW5wdXQge1xuXG5cdFx0cmVhZG9ubHkgcmVzb3VyY2UgPSB1bmRlZmluZWQ7XG5cblx0XHRjb25zdHJ1Y3RvcihwdWJsaWMgaWQ6IHN0cmluZykge1xuXHRcdFx0c3VwZXIoKTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuICd0ZXN0RWRpdG9ySW5wdXRGb3JHcm91cHMtbm9uU2VyaWFsaXphYmxlJzsgfVxuXHRcdG92ZXJyaWRlIGFzeW5jIHJlc29sdmUoKTogUHJvbWlzZTxJRGlzcG9zYWJsZSB8IG51bGw+IHsgcmV0dXJuIG51bGw7IH1cblxuXHRcdG92ZXJyaWRlIG1hdGNoZXMob3RoZXI6IE5vblNlcmlhbGl6YWJsZVRlc3RFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0cmV0dXJuIG90aGVyICYmIHRoaXMuaWQgPT09IG90aGVyLmlkICYmIG90aGVyIGluc3RhbmNlb2YgTm9uU2VyaWFsaXphYmxlVGVzdEVkaXRvcklucHV0O1xuXHRcdH1cblx0fVxuXG5cdGNsYXNzIFRlc3RGaWxlRWRpdG9ySW5wdXQgZXh0ZW5kcyBFZGl0b3JJbnB1dCBpbXBsZW1lbnRzIElGaWxlRWRpdG9ySW5wdXQge1xuXG5cdFx0cmVhZG9ubHkgcHJlZmVycmVkUmVzb3VyY2U7XG5cblx0XHRjb25zdHJ1Y3RvcihwdWJsaWMgaWQ6IHN0cmluZywgcHVibGljIHJlc291cmNlOiBVUkkpIHtcblx0XHRcdHN1cGVyKCk7XG5cdFx0XHR0aGlzLnByZWZlcnJlZFJlc291cmNlID0gdGhpcy5yZXNvdXJjZTtcblx0XHR9XG5cdFx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuICd0ZXN0RmlsZUVkaXRvcklucHV0Rm9yR3JvdXBzJzsgfVxuXHRcdG92ZXJyaWRlIGdldCBlZGl0b3JJZCgpIHsgcmV0dXJuIHRoaXMuaWQ7IH1cblx0XHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8SURpc3Bvc2FibGUgfCBudWxsPiB7IHJldHVybiBudWxsOyB9XG5cdFx0c2V0UHJlZmVycmVkTmFtZShuYW1lOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRcdHNldFByZWZlcnJlZERlc2NyaXB0aW9uKGRlc2NyaXB0aW9uOiBzdHJpbmcpOiB2b2lkIHsgfVxuXHRcdHNldFByZWZlcnJlZFJlc291cmNlKHJlc291cmNlOiBVUkkpOiB2b2lkIHsgfVxuXHRcdGFzeW5jIHNldEVuY29kaW5nKGVuY29kaW5nOiBzdHJpbmcpIHsgfVxuXHRcdGdldEVuY29kaW5nKCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0c2V0UHJlZmVycmVkRW5jb2RpbmcoZW5jb2Rpbmc6IHN0cmluZykgeyB9XG5cdFx0c2V0Rm9yY2VPcGVuQXNCaW5hcnkoKTogdm9pZCB7IH1cblx0XHRzZXRQcmVmZXJyZWRDb250ZW50cyhjb250ZW50czogc3RyaW5nKTogdm9pZCB7IH1cblx0XHRzZXRMYW5ndWFnZUlkKGxhbmd1YWdlSWQ6IHN0cmluZykgeyB9XG5cdFx0c2V0UHJlZmVycmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkOiBzdHJpbmcpIHsgfVxuXHRcdGlzUmVzb2x2ZWQoKTogYm9vbGVhbiB7IHJldHVybiBmYWxzZTsgfVxuXG5cdFx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcjogVGVzdEZpbGVFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0aWYgKHN1cGVyLm1hdGNoZXMob3RoZXIpKSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAob3RoZXIgaW5zdGFuY2VvZiBUZXN0RmlsZUVkaXRvcklucHV0KSB7XG5cdFx0XHRcdHJldHVybiBpc0VxdWFsKG90aGVyLnJlc291cmNlLCB0aGlzLnJlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fVxuXG5cdGZ1bmN0aW9uIGlucHV0KGlkID0gU3RyaW5nKGluZGV4KyspLCBub25TZXJpYWxpemFibGU/OiBib29sZWFuLCByZXNvdXJjZT86IFVSSSk6IEVkaXRvcklucHV0IHtcblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoaWQsIHJlc291cmNlKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vblNlcmlhbGl6YWJsZSA/IGRpc3Bvc2FibGVzLmFkZChuZXcgTm9uU2VyaWFsaXphYmxlVGVzdEVkaXRvcklucHV0KGlkKSkgOiBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChpZCkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY2xvc2VBbGxFZGl0b3JzKGdyb3VwOiBFZGl0b3JHcm91cE1vZGVsKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBlZGl0b3Igb2YgZ3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkpIHtcblx0XHRcdGdyb3VwLmNsb3NlRWRpdG9yKGVkaXRvciwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cdFx0fVxuXHR9XG5cblx0aW50ZXJmYWNlIElTZXJpYWxpemVkVGVzdElucHV0IHtcblx0XHRpZDogc3RyaW5nO1xuXHR9XG5cblx0Y2xhc3MgVGVzdEVkaXRvcklucHV0U2VyaWFsaXplciBpbXBsZW1lbnRzIElFZGl0b3JTZXJpYWxpemVyIHtcblxuXHRcdHN0YXRpYyBkaXNhYmxlU2VyaWFsaXplID0gZmFsc2U7XG5cdFx0c3RhdGljIGRpc2FibGVEZXNlcmlhbGl6ZSA9IGZhbHNlO1xuXG5cdFx0Y2FuU2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0c2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRpZiAoVGVzdEVkaXRvcklucHV0U2VyaWFsaXplci5kaXNhYmxlU2VyaWFsaXplKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHRlc3RFZGl0b3JJbnB1dCA9IDxUZXN0RWRpdG9ySW5wdXQ+ZWRpdG9ySW5wdXQ7XG5cdFx0XHRjb25zdCB0ZXN0SW5wdXQ6IElTZXJpYWxpemVkVGVzdElucHV0ID0ge1xuXHRcdFx0XHRpZDogdGVzdEVkaXRvcklucHV0LmlkXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkodGVzdElucHV0KTtcblx0XHR9XG5cblx0XHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCBzZXJpYWxpemVkRWRpdG9ySW5wdXQ6IHN0cmluZyk6IEVkaXRvcklucHV0IHwgdW5kZWZpbmVkIHtcblx0XHRcdGlmIChUZXN0RWRpdG9ySW5wdXRTZXJpYWxpemVyLmRpc2FibGVEZXNlcmlhbGl6ZSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCB0ZXN0SW5wdXQ6IElTZXJpYWxpemVkVGVzdElucHV0ID0gSlNPTi5wYXJzZShzZXJpYWxpemVkRWRpdG9ySW5wdXQpO1xuXG5cdFx0XHRyZXR1cm4gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9ySW5wdXQodGVzdElucHV0LmlkKSk7XG5cdFx0fVxuXHR9XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIuZGlzYWJsZVNlcmlhbGl6ZSA9IGZhbHNlO1xuXHRcdFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIuZGlzYWJsZURlc2VyaWFsaXplID0gZmFsc2U7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5yZWdpc3RlckVkaXRvclNlcmlhbGl6ZXIoJ3Rlc3RFZGl0b3JJbnB1dEZvckdyb3VwcycsIFRlc3RFZGl0b3JJbnB1dFNlcmlhbGl6ZXIpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cblx0XHRpbmRleCA9IDE7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBjb3VudCcsIGFzeW5jICgpID0+IHtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogdHJ1ZSB9KTtcblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogdHJ1ZSB9KTtcblxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDApO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDEpO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY291bnQsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgc3RpY2t5Q291bnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMCk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMCk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0Mik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5zdGlja3lDb3VudCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBpc0VtcHR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogZmFsc2UgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IGZhbHNlIH0pO1xuXG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb3VudCA9PT0gMCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb3VudCA9PT0gMCwgZmFsc2UpO1xuXG5cdFx0bW9kZWwuc3RpY2soaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvdW50ID09PSAwLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb3VudCA9PT0gMCwgZmFsc2UpO1xuXG5cdFx0bW9kZWwuc3RpY2soaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvdW50ID09PSAwLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb3VudCA9PT0gMCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBlZGl0b3JzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogdHJ1ZSB9KTtcblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogdHJ1ZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDApO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmxlbmd0aCwgMSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbnB1dDEpO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmxlbmd0aCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBhY3RpdmVFZGl0b3InLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5hY3RpdmVFZGl0b3IsIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5hY3RpdmVFZGl0b3IsIG51bGwpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IGZhbHNlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5hY3RpdmVFZGl0b3IsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuYWN0aXZlRWRpdG9yLCBpbnB1dDIpO1xuXG5cdFx0bW9kZWwuY2xvc2VFZGl0b3IoaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5hY3RpdmVFZGl0b3IsIGlucHV0Mik7XG5cblx0XHRtb2RlbC5jbG9zZUVkaXRvcihpbnB1dDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuYWN0aXZlRWRpdG9yLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmFjdGl2ZUVkaXRvciwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBwcmV2aWV3RWRpdG9yJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5wcmV2aWV3RWRpdG9yLCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLnByZXZpZXdFZGl0b3IsIGlucHV0MSk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MiwgeyBzdGlja3k6IHRydWUgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAucHJldmlld0VkaXRvciwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5wcmV2aWV3RWRpdG9yLCBpbnB1dDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgaXNTdGlja3koKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblx0XHRjb25zdCB1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1N0aWNreShpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1N0aWNreShpbnB1dDIpLCB0cnVlKTtcblxuXHRcdG1vZGVsLnVuc3RpY2soaW5wdXQxKTtcblx0XHRtb2RlbC5jbG9zZUVkaXRvcihpbnB1dDEpO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1N0aWNreShpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1N0aWNreShpbnB1dDIpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBpc1Bpbm5lZCgpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDQgPSBpbnB1dCgpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IGZhbHNlIH0pO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogZmFsc2UsIHN0aWNreTogdHJ1ZSB9KTtcblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0NCwgeyBwaW5uZWQ6IGZhbHNlLCBzdGlja3k6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNQaW5uZWQoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1Bpbm5lZChpbnB1dDIpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc1Bpbm5lZChpbnB1dDMpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzUGlubmVkKGlucHV0NCksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnU3RpY2t5L1Vuc3RpY2t5IGlzQWN0aXZlKCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0FjdGl2ZShpbnB1dDEpLCB0cnVlKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiBmYWxzZSwgYWN0aXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNBY3RpdmUoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNBY3RpdmUoaW5wdXQyKSwgdHJ1ZSk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzQWN0aXZlKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzQWN0aXZlKGlucHV0MiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgZ2V0RWRpdG9ycygpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MSwgeyBwaW5uZWQ6IHRydWUsIHN0aWNreTogdHJ1ZSwgYWN0aXZlOiB0cnVlIH0pO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cblx0XHQvLyBhbGwgc3RpY2t5IGVkaXRvcnNcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDIpO1xuXG5cdFx0Ly8gbm8gdW5zdGlja3kgZWRpdG9yc1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKS5sZW5ndGgsIDApO1xuXG5cdFx0Ly8gb3B0aW9uczogZXhjbHVkZVN0aWNreVxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwsIHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwsIHsgZXhjbHVkZVN0aWNreTogZmFsc2UgfSkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwsIHsgZXhjbHVkZVN0aWNreTogdHJ1ZSB9KS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuU0VRVUVOVElBTCwgeyBleGNsdWRlU3RpY2t5OiBmYWxzZSB9KS5sZW5ndGgsIDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpWzBdLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVsxXSwgaW5wdXQxKTtcblxuXHRcdG1vZGVsLnVuc3RpY2soaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5NT1NUX1JFQ0VOVExZX0FDVElWRSkubGVuZ3RoLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVswXSwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzBdLCBpbnB1dDEpO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDIpO1xuXG5cdFx0Ly8gYWxsIHVuc3RpY2t5IGVkaXRvcnNcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKS5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9ycyhFZGl0b3JzT3JkZXIuTU9TVF9SRUNFTlRMWV9BQ1RJVkUpLmxlbmd0aCwgMik7XG5cblx0XHQvLyBvcmRlcjogTU9TVF9SRUNFTlRMWV9BQ1RJVkVcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVswXSwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVsxXSwgaW5wdXQxKTtcblxuXHRcdC8vIG9yZGVyOiBTRVFVRU5USUFMXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JzKEVkaXRvcnNPcmRlci5TRVFVRU5USUFMKVswXSwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLlNFUVVFTlRJQUwpWzFdLCBpbnB1dDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgZ2V0RWRpdG9yQnlJbmRleCgpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXG5cdFx0Y29uc3Qgc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVW5zdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQzID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9yQnlJbmRleCgwKSwgaW5wdXQxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JCeUluZGV4KDEpLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvckJ5SW5kZXgoMiksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JCeUluZGV4KDApLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9yQnlJbmRleCgxKSwgdW5kZWZpbmVkKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQzLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvckJ5SW5kZXgoMCksIGlucHV0MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9yQnlJbmRleCgxKSwgaW5wdXQyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JCeUluZGV4KDIpLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9yQnlJbmRleCgwKSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvckJ5SW5kZXgoMSksIHVuZGVmaW5lZCk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JCeUluZGV4KDApLCBpbnB1dDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvckJ5SW5kZXgoMSksIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5nZXRFZGl0b3JCeUluZGV4KDApLCBpbnB1dDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuZ2V0RWRpdG9yQnlJbmRleCgxKSwgaW5wdXQzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmdldEVkaXRvckJ5SW5kZXgoMiksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1N0aWNreS9VbnN0aWNreSBpbmRleE9mKCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDMgPSBpbnB1dCgpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MSksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQyKSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MSksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQyKSwgLTEpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaW5kZXhPZihpbnB1dDEpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MiksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQzKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaW5kZXhPZihpbnB1dDEpLCAtMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MiksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQzKSwgMCk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0MSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MSksIC0xKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pbmRleE9mKGlucHV0MiksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQzKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaW5kZXhPZihpbnB1dDEpLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmluZGV4T2YoaW5wdXQyKSwgLTEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaW5kZXhPZihpbnB1dDMpLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnU3RpY2t5L1Vuc3RpY2t5IGlzRmlyc3QoKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblx0XHRjb25zdCB1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0ZpcnN0KGlucHV0MSksIHRydWUpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0ZpcnN0KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzRmlyc3QoaW5wdXQyKSwgZmFsc2UpO1xuXG5cdFx0bW9kZWwudW5zdGljayhpbnB1dDEpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0ZpcnN0KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzRmlyc3QoaW5wdXQyKSwgdHJ1ZSk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0Mik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzRmlyc3QoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNGaXJzdChpbnB1dDIpLCB0cnVlKTtcblxuXHRcdG1vZGVsLm1vdmVFZGl0b3IoaW5wdXQyLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNGaXJzdChpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzRmlyc3QoaW5wdXQyKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgaXNMYXN0KCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMYXN0KGlucHV0MSksIHRydWUpO1xuXG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDIsIHsgcGlubmVkOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0xhc3QoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzTGFzdChpbnB1dDIpLCB0cnVlKTtcblxuXHRcdG1vZGVsLnVuc3RpY2soaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMYXN0KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzTGFzdChpbnB1dDIpLCB0cnVlKTtcblxuXHRcdG1vZGVsLnVuc3RpY2soaW5wdXQyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMYXN0KGlucHV0MSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMYXN0KGlucHV0MiksIGZhbHNlKTtcblxuXHRcdG1vZGVsLm1vdmVFZGl0b3IoaW5wdXQyLCAxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMYXN0KGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzTGFzdChpbnB1dDIpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnU3RpY2t5L1Vuc3RpY2t5IGNvbnRhaW5zKCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdGNvbnN0IGlucHV0MSA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQyID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgc3RpY2t5OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY29udGFpbnMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY29udGFpbnMoaW5wdXQyKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvbnRhaW5zKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvbnRhaW5zKGlucHV0MiksIGZhbHNlKTtcblxuXHRcdG1vZGVsLnVuc3RpY2soaW5wdXQxKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvbnRhaW5zKGlucHV0MSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb250YWlucyhpbnB1dDIpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY29udGFpbnMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb250YWlucyhpbnB1dDIpLCBmYWxzZSk7XG5cblx0XHRtb2RlbC51bnN0aWNrKGlucHV0Mik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb250YWlucyhpbnB1dDEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuY29udGFpbnMoaW5wdXQyKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5jb250YWlucyhpbnB1dDEpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmNvbnRhaW5zKGlucHV0MiksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgZ3JvdXAgaW5mb3JtYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVFZGl0b3JHcm91cE1vZGVsKCk7XG5cblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsKSk7XG5cdFx0Y29uc3QgdW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblxuXHRcdC8vIHNhbWUgaWRcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pZCwgbW9kZWwuaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaWQsIG1vZGVsLmlkKTtcblxuXHRcdC8vIGdyb3VwIGxvY2tpbmcgc2FtZSBiZWhhdmlvdXJcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0xvY2tlZCwgbW9kZWwuaXNMb2NrZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMb2NrZWQsIG1vZGVsLmlzTG9ja2VkKTtcblxuXHRcdG1vZGVsLmxvY2sodHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cC5pc0xvY2tlZCwgbW9kZWwuaXNMb2NrZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMb2NrZWQsIG1vZGVsLmlzTG9ja2VkKTtcblxuXHRcdG1vZGVsLmxvY2soZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNMb2NrZWQsIG1vZGVsLmlzTG9ja2VkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzTG9ja2VkLCBtb2RlbC5pc0xvY2tlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIEVkaXRvcnMgLSBFZGl0b3IgRW1pdHMgRGlydHkgYW5kIExhYmVsIENoYW5nZWQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbW9kZWwxID0gY3JlYXRlRWRpdG9yR3JvdXBNb2RlbCgpO1xuXHRcdGNvbnN0IG1vZGVsMiA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAxID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBTdGlja3lFZGl0b3JHcm91cE1vZGVsKG1vZGVsMSkpO1xuXHRcdGNvbnN0IHVuc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cDEgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbDEpKTtcblx0XHRjb25zdCBzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwMiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgU3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbDIpKTtcblx0XHRjb25zdCB1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVbnN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwyKSk7XG5cblx0XHRjb25zdCBpbnB1dDEgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MiA9IGlucHV0KCk7XG5cblx0XHRtb2RlbDEub3BlbkVkaXRvcihpbnB1dDEsIHsgcGlubmVkOiB0cnVlLCBhY3RpdmU6IHRydWUgfSk7XG5cdFx0bW9kZWwyLm9wZW5FZGl0b3IoaW5wdXQyLCB7IHBpbm5lZDogdHJ1ZSwgYWN0aXZlOiB0cnVlLCBzdGlja3k6IHRydWUgfSk7XG5cblx0XHQvLyBESVJUWVxuXHRcdGxldCBkaXJ0eTFDb3VudGVyU3RpY2t5ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cDEub25EaWRNb2RlbENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0RJUlRZKSB7XG5cdFx0XHRcdGRpcnR5MUNvdW50ZXJTdGlja3krKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgZGlydHkxQ291bnRlclVuc3RpY2t5ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwMS5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFkpIHtcblx0XHRcdFx0ZGlydHkxQ291bnRlclVuc3RpY2t5Kys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGRpcnR5MkNvdW50ZXJTdGlja3kgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwMi5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfRElSVFkpIHtcblx0XHRcdFx0ZGlydHkyQ291bnRlclN0aWNreSsrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGxldCBkaXJ0eTJDb3VudGVyVW5zdGlja3kgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAyLm9uRGlkTW9kZWxDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9ESVJUWSkge1xuXHRcdFx0XHRkaXJ0eTJDb3VudGVyVW5zdGlja3krKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQvLyBMQUJFTFxuXHRcdGxldCBsYWJlbDFDaGFuZ2VDb3VudGVyU3RpY2t5ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc3RpY2t5RmlsdGVyZWRFZGl0b3JHcm91cDEub25EaWRNb2RlbENoYW5nZSgoZSkgPT4ge1xuXHRcdFx0aWYgKGUua2luZCA9PT0gR3JvdXBNb2RlbENoYW5nZUtpbmQuRURJVE9SX0xBQkVMKSB7XG5cdFx0XHRcdGxhYmVsMUNoYW5nZUNvdW50ZXJTdGlja3krKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRsZXQgbGFiZWwxQ2hhbmdlQ291bnRlclVuc3RpY2t5ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQodW5zdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwMS5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTEFCRUwpIHtcblx0XHRcdFx0bGFiZWwxQ2hhbmdlQ291bnRlclVuc3RpY2t5Kys7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0bGV0IGxhYmVsMkNoYW5nZUNvdW50ZXJTdGlja3kgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwMi5vbkRpZE1vZGVsQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5raW5kID09PSBHcm91cE1vZGVsQ2hhbmdlS2luZC5FRElUT1JfTEFCRUwpIHtcblx0XHRcdFx0bGFiZWwyQ2hhbmdlQ291bnRlclN0aWNreSsrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGxldCBsYWJlbDJDaGFuZ2VDb3VudGVyVW5zdGlja3kgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAyLm9uRGlkTW9kZWxDaGFuZ2UoKGUpID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09IEdyb3VwTW9kZWxDaGFuZ2VLaW5kLkVESVRPUl9MQUJFTCkge1xuXHRcdFx0XHRsYWJlbDJDaGFuZ2VDb3VudGVyVW5zdGlja3krKztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHQoPFRlc3RFZGl0b3JJbnB1dD5pbnB1dDEpLnNldERpcnR5KCk7XG5cdFx0KDxUZXN0RWRpdG9ySW5wdXQ+aW5wdXQxKS5zZXRMYWJlbCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5MUNvdW50ZXJTdGlja3ksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eTFDb3VudGVyVW5zdGlja3ksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbDFDaGFuZ2VDb3VudGVyU3RpY2t5LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwxQ2hhbmdlQ291bnRlclVuc3RpY2t5LCAxKTtcblxuXHRcdCg8VGVzdEVkaXRvcklucHV0PmlucHV0Mikuc2V0RGlydHkoKTtcblx0XHQoPFRlc3RFZGl0b3JJbnB1dD5pbnB1dDIpLnNldExhYmVsKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkyQ291bnRlclN0aWNreSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5MkNvdW50ZXJVbnN0aWNreSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsMkNoYW5nZUNvdW50ZXJTdGlja3ksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbDJDaGFuZ2VDb3VudGVyVW5zdGlja3ksIDApO1xuXG5cdFx0Y2xvc2VBbGxFZGl0b3JzKG1vZGVsMik7XG5cblx0XHQoPFRlc3RFZGl0b3JJbnB1dD5pbnB1dDIpLnNldERpcnR5KCk7XG5cdFx0KDxUZXN0RWRpdG9ySW5wdXQ+aW5wdXQyKS5zZXRMYWJlbCgpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5MkNvdW50ZXJTdGlja3ksIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXJ0eTJDb3VudGVyVW5zdGlja3ksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbDJDaGFuZ2VDb3VudGVyU3RpY2t5LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwyQ2hhbmdlQ291bnRlclVuc3RpY2t5LCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlydHkxQ291bnRlclN0aWNreSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5MUNvdW50ZXJVbnN0aWNreSwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsMUNoYW5nZUNvdW50ZXJTdGlja3ksIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbDFDaGFuZ2VDb3VudGVyVW5zdGlja3ksIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdTdGlja3kvVW5zdGlja3kgaXNUcmFuc2llbnQoKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZUVkaXRvckdyb3VwTW9kZWwoKTtcblxuXHRcdGNvbnN0IHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFN0aWNreUVkaXRvckdyb3VwTW9kZWwobW9kZWwpKTtcblx0XHRjb25zdCB1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFVuc3RpY2t5RWRpdG9yR3JvdXBNb2RlbChtb2RlbCkpO1xuXG5cdFx0Y29uc3QgaW5wdXQxID0gaW5wdXQoKTtcblx0XHRjb25zdCBpbnB1dDIgPSBpbnB1dCgpO1xuXHRcdGNvbnN0IGlucHV0MyA9IGlucHV0KCk7XG5cdFx0Y29uc3QgaW5wdXQ0ID0gaW5wdXQoKTtcblxuXHRcdG1vZGVsLm9wZW5FZGl0b3IoaW5wdXQxLCB7IHBpbm5lZDogdHJ1ZSwgdHJhbnNpZW50OiBmYWxzZSB9KTtcblx0XHRtb2RlbC5vcGVuRWRpdG9yKGlucHV0MiwgeyBwaW5uZWQ6IHRydWUgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDMsIHsgcGlubmVkOiB0cnVlLCB0cmFuc2llbnQ6IHRydWUgfSk7XG5cdFx0bW9kZWwub3BlbkVkaXRvcihpbnB1dDQsIHsgcGlubmVkOiBmYWxzZSwgdHJhbnNpZW50OiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNUcmFuc2llbnQoaW5wdXQxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNUcmFuc2llbnQoaW5wdXQyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdGlja3lGaWx0ZXJlZEVkaXRvckdyb3VwLmlzVHJhbnNpZW50KGlucHV0MyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnN0aWNreUZpbHRlcmVkRWRpdG9yR3JvdXAuaXNUcmFuc2llbnQoaW5wdXQ0KSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx3QkFBcUQ7QUFDOUQsU0FBUyxrQkFBK0UsY0FBYyw0QkFBNEI7QUFFbEksU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxpQkFBOEIsb0JBQW9CO0FBQzNELFNBQVMsb0JBQW9CLDBCQUEwQjtBQUN2RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGVBQWU7QUFDeEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx3QkFBd0IsZ0NBQWdDO0FBRWpFLE1BQU0sNEJBQTRCLE1BQU07QUFFdkMsTUFBSTtBQUVKLGdCQUFjLE1BQU07QUFDbkIscUJBQWlCLFFBQVE7QUFDekIsc0JBQWtCO0FBQUEsRUFDbkIsQ0FBQztBQUVELFdBQVMsT0FBOEI7QUFDdEMsUUFBSSxDQUFDLGlCQUFpQjtBQUNyQix3QkFBa0IsSUFBSSx5QkFBeUI7QUFBQSxJQUNoRDtBQUNBLFVBQU1BLFFBQU87QUFDYixJQUFBQSxNQUFLLEtBQUssaUJBQWlCLFlBQVksSUFBSSxJQUFJLG1CQUFtQixDQUFDLENBQUM7QUFDcEUsSUFBQUEsTUFBSyxLQUFLLG1CQUFtQixZQUFZ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QUV2RixVQUFNLFNBQVMsTUFBTTtBQUNyQixVQUFNLFNBQVMsTUFBTTtBQUNyQixVQUFNLFNBQVMsTUFBTTtBQUVyQixVQUFNLFdBQVcsUUFBUSxFQUFFLFFBQVEsTUFBTSxRQUFRLEtBQUssQ0FBQztBQUN2RCxVQUFNLFdBQVcsUUFBUSxFQUFFLFFBQVEsTUFBTSxRQUFRLEtBQUssQ0FBQztBQUV2RCxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUMzRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUM3RSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUU3RSxVQUFNLFdBQVcsUUFBUSxFQUFFLFFBQVEsTUFBTSxRQUFRLE1BQU0sQ0FBQztBQUV4RCxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUMzRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUMxRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUU3RSxVQUFNLFFBQVEsTUFBTTtBQUVwQixXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUN4RSxXQUFPLFlBQVksMEJBQTBCLGlCQUFpQixDQUFDLEdBQUcsTUFBUztBQUMzRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUMxRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFDLEdBQUcsTUFBTTtBQUMxRSxXQUFPLFlBQVksNEJBQTRCLGlCQUFpQixDQUFD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
