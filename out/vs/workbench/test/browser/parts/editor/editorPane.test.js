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
import { EditorPane, EditorMemento } from "../../../../browser/parts/editor/editorPane.js";
import { WorkspaceTrustRequiredPlaceholderEditor } from "../../../../browser/parts/editor/editorPlaceholder.js";
import { EditorExtensions, EditorInputCapabilities } from "../../../../common/editor.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { workbenchInstantiationService, TestEditorGroupView, TestEditorGroupsService, registerTestResourceEditor, TestEditorInput, createEditorPart, TestTextResourceConfigurationService } from "../../workbenchTestServices.js";
import { TextResourceEditorInput } from "../../../../common/editor/textResourceEditorInput.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { URI } from "../../../../../base/common/uri.js";
import { EditorPaneDescriptor } from "../../../../browser/editor.js";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { TestStorageService, TestWorkspaceTrustManagementService } from "../../../common/workbenchTestServices.js";
import { extUri } from "../../../../../base/common/resources.js";
import { EditorService } from "../../../../services/editor/browser/editorService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { IWorkspaceTrustManagementService } from "../../../../../platform/workspace/common/workspaceTrust.js";
import { EditorInput } from "../../../../common/editor/editorInput.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const NullThemeService = new TestThemeService();
const editorRegistry = Registry.as(EditorExtensions.EditorPane);
const editorInputRegistry = Registry.as(EditorExtensions.EditorFactory);
class TestEditor extends EditorPane {
  constructor(group) {
    const disposables = new DisposableStore();
    super("TestEditor", group, NullTelemetryService, NullThemeService, disposables.add(new TestStorageService()));
    this._register(disposables);
  }
  getId() {
    return "testEditor";
  }
  layout() {
  }
  createEditor() {
  }
}
class OtherTestEditor extends EditorPane {
  constructor(group) {
    const disposables = new DisposableStore();
    super("testOtherEditor", group, NullTelemetryService, NullThemeService, disposables.add(new TestStorageService()));
    this._register(disposables);
  }
  getId() {
    return "testOtherEditor";
  }
  layout() {
  }
  createEditor() {
  }
}
class TestInputSerializer {
  canSerialize(editorInput) {
    return true;
  }
  serialize(input) {
    return input.toString();
  }
  deserialize(instantiationService, raw) {
    return {};
  }
}
class TestInput extends EditorInput {
  constructor() {
    super(...arguments);
    this.resource = void 0;
  }
  prefersEditorPane(editors) {
    return editors[1];
  }
  get typeId() {
    return "testInput";
  }
  resolve() {
    return null;
  }
}
class OtherTestInput extends EditorInput {
  constructor() {
    super(...arguments);
    this.resource = void 0;
  }
  get typeId() {
    return "otherTestInput";
  }
  resolve() {
    return null;
  }
}
class TestResourceEditorInput extends TextResourceEditorInput {
}
suite("EditorPane", () => {
  const disposables = new DisposableStore();
  teardown(() => {
    disposables.clear();
  });
  test("EditorPane API", async () => {
    const group = new TestEditorGroupView(1);
    const editor = new TestEditor(group);
    assert.ok(editor.group);
    const input = disposables.add(new OtherTestInput());
    const options = {};
    assert(!editor.isVisible());
    assert(!editor.input);
    await editor.setInput(input, options, /* @__PURE__ */ Object.create(null), CancellationToken.None);
    assert.strictEqual(input, editor.input);
    editor.setVisible(true);
    assert(editor.isVisible());
    editor.dispose();
    editor.clearInput();
    editor.setVisible(false);
    assert(!editor.isVisible());
    assert(!editor.input);
    assert(!editor.getControl());
  });
  test("EditorPaneDescriptor", () => {
    const editorDescriptor = EditorPaneDescriptor.create(TestEditor, "id", "name");
    assert.strictEqual(editorDescriptor.typeId, "id");
    assert.strictEqual(editorDescriptor.name, "name");
  });
  test("Editor Pane Registration", function() {
    const editorDescriptor1 = EditorPaneDescriptor.create(TestEditor, "id1", "name");
    const editorDescriptor2 = EditorPaneDescriptor.create(OtherTestEditor, "id2", "name");
    const oldEditorsCnt = editorRegistry.getEditorPanes().length;
    const oldInputCnt = editorRegistry.getEditors().length;
    disposables.add(editorRegistry.registerEditorPane(editorDescriptor1, [new SyncDescriptor(TestInput)]));
    disposables.add(editorRegistry.registerEditorPane(editorDescriptor2, [new SyncDescriptor(TestInput), new SyncDescriptor(OtherTestInput)]));
    assert.strictEqual(editorRegistry.getEditorPanes().length, oldEditorsCnt + 2);
    assert.strictEqual(editorRegistry.getEditors().length, oldInputCnt + 3);
    assert.strictEqual(editorRegistry.getEditorPane(disposables.add(new TestInput())), editorDescriptor2);
    assert.strictEqual(editorRegistry.getEditorPane(disposables.add(new OtherTestInput())), editorDescriptor2);
    assert.strictEqual(editorRegistry.getEditorPaneByType("id1"), editorDescriptor1);
    assert.strictEqual(editorRegistry.getEditorPaneByType("id2"), editorDescriptor2);
    assert(!editorRegistry.getEditorPaneByType("id3"));
  });
  test("Editor Pane Lookup favors specific class over superclass (match on specific class)", function() {
    const d1 = EditorPaneDescriptor.create(TestEditor, "id1", "name");
    disposables.add(registerTestResourceEditor());
    disposables.add(editorRegistry.registerEditorPane(d1, [new SyncDescriptor(TestResourceEditorInput)]));
    const inst = workbenchInstantiationService(void 0, disposables);
    const group = new TestEditorGroupView(1);
    const editor = disposables.add(editorRegistry.getEditorPane(disposables.add(inst.createInstance(TestResourceEditorInput, URI.file("/fake"), "fake", "", void 0, void 0))).instantiate(inst, group));
    assert.strictEqual(editor.getId(), "testEditor");
    const otherEditor = disposables.add(editorRegistry.getEditorPane(disposables.add(inst.createInstance(TextResourceEditorInput, URI.file("/fake"), "fake", "", void 0, void 0))).instantiate(inst, group));
    assert.strictEqual(otherEditor.getId(), "workbench.editors.textResourceEditor");
  });
  test("Editor Pane Lookup favors specific class over superclass (match on super class)", function() {
    const inst = workbenchInstantiationService(void 0, disposables);
    const group = new TestEditorGroupView(1);
    disposables.add(registerTestResourceEditor());
    const editor = disposables.add(editorRegistry.getEditorPane(disposables.add(inst.createInstance(TestResourceEditorInput, URI.file("/fake"), "fake", "", void 0, void 0))).instantiate(inst, group));
    assert.strictEqual("workbench.editors.textResourceEditor", editor.getId());
  });
  test("Editor Input Serializer", function() {
    const testInput = disposables.add(new TestEditorInput(URI.file("/fake"), "testTypeId"));
    workbenchInstantiationService(void 0, disposables).invokeFunction((accessor) => editorInputRegistry.start(accessor));
    disposables.add(editorInputRegistry.registerEditorSerializer(testInput.typeId, TestInputSerializer));
    let factory = editorInputRegistry.getEditorSerializer("testTypeId");
    assert(factory);
    factory = editorInputRegistry.getEditorSerializer(testInput);
    assert(factory);
    assert.throws(() => editorInputRegistry.registerEditorSerializer(testInput.typeId, TestInputSerializer));
  });
  test("EditorMemento - basics", function() {
    const testGroup0 = new TestEditorGroupView(0);
    const testGroup1 = new TestEditorGroupView(1);
    const testGroup4 = new TestEditorGroupView(4);
    const configurationService = new TestTextResourceConfigurationService();
    const editorGroupService = new TestEditorGroupsService([
      testGroup0,
      testGroup1,
      new TestEditorGroupView(2)
    ]);
    const rawMemento = /* @__PURE__ */ Object.create(null);
    let memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, editorGroupService, configurationService));
    let res = memento.loadEditorState(testGroup0, URI.file("/A"));
    assert.ok(!res);
    memento.saveEditorState(testGroup0, URI.file("/A"), { line: 3 });
    res = memento.loadEditorState(testGroup0, URI.file("/A"));
    assert.ok(res);
    assert.strictEqual(res.line, 3);
    memento.saveEditorState(testGroup1, URI.file("/A"), { line: 5 });
    res = memento.loadEditorState(testGroup1, URI.file("/A"));
    assert.ok(res);
    assert.strictEqual(res.line, 5);
    memento.saveEditorState(testGroup0, URI.file("/B"), { line: 1 });
    memento.saveEditorState(testGroup0, URI.file("/C"), { line: 1 });
    memento.saveEditorState(testGroup0, URI.file("/D"), { line: 1 });
    memento.saveEditorState(testGroup0, URI.file("/E"), { line: 1 });
    assert.ok(!memento.loadEditorState(testGroup0, URI.file("/A")));
    assert.ok(!memento.loadEditorState(testGroup0, URI.file("/B")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/C")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/D")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/E")));
    memento.saveEditorState(testGroup4, URI.file("/E"), { line: 1 });
    assert.ok(memento.loadEditorState(testGroup4, URI.file("/E")));
    memento.saveEditorState(testGroup4, URI.file("/C"), { line: 1 });
    assert.ok(memento.loadEditorState(testGroup4, URI.file("/C")));
    memento.saveState();
    memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, editorGroupService, configurationService));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/C")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/D")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/E")));
    assert.ok(!memento.loadEditorState(testGroup4, URI.file("/E")));
    assert.ok(!memento.loadEditorState(testGroup4, URI.file("/C")));
    memento.clearEditorState(URI.file("/C"), testGroup4);
    memento.clearEditorState(URI.file("/E"));
    assert.ok(!memento.loadEditorState(testGroup4, URI.file("/C")));
    assert.ok(memento.loadEditorState(testGroup0, URI.file("/D")));
    assert.ok(!memento.loadEditorState(testGroup0, URI.file("/E")));
  });
  test("EditorMemento - move", function() {
    const testGroup0 = new TestEditorGroupView(0);
    const configurationService = new TestTextResourceConfigurationService();
    const editorGroupService = new TestEditorGroupsService([testGroup0]);
    const rawMemento = /* @__PURE__ */ Object.create(null);
    const memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, editorGroupService, configurationService));
    memento.saveEditorState(testGroup0, URI.file("/some/folder/file-1.txt"), { line: 1 });
    memento.saveEditorState(testGroup0, URI.file("/some/folder/file-2.txt"), { line: 2 });
    memento.saveEditorState(testGroup0, URI.file("/some/other/file.txt"), { line: 3 });
    memento.moveEditorState(URI.file("/some/folder/file-1.txt"), URI.file("/some/folder/file-moved.txt"), extUri);
    let res = memento.loadEditorState(testGroup0, URI.file("/some/folder/file-1.txt"));
    assert.ok(!res);
    res = memento.loadEditorState(testGroup0, URI.file("/some/folder/file-moved.txt"));
    assert.strictEqual(res?.line, 1);
    memento.moveEditorState(URI.file("/some/folder"), URI.file("/some/folder-moved"), extUri);
    res = memento.loadEditorState(testGroup0, URI.file("/some/folder-moved/file-moved.txt"));
    assert.strictEqual(res?.line, 1);
    res = memento.loadEditorState(testGroup0, URI.file("/some/folder-moved/file-2.txt"));
    assert.strictEqual(res?.line, 2);
  });
  test("EditoMemento - use with editor input", function() {
    const testGroup0 = new TestEditorGroupView(0);
    class TestEditorInput2 extends EditorInput {
      constructor(resource, id = "testEditorInputForMementoTest") {
        super();
        this.resource = resource;
        this.id = id;
      }
      get typeId() {
        return "testEditorInputForMementoTest";
      }
      async resolve() {
        return null;
      }
      matches(other) {
        return other && this.id === other.id && other instanceof TestEditorInput2;
      }
    }
    const rawMemento = /* @__PURE__ */ Object.create(null);
    const memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, new TestEditorGroupsService(), new TestTextResourceConfigurationService()));
    const testInputA = disposables.add(new TestEditorInput2(URI.file("/A")));
    let res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(!res);
    memento.saveEditorState(testGroup0, testInputA, { line: 3 });
    res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(res);
    assert.strictEqual(res.line, 3);
    testInputA.dispose();
    res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(!res);
  });
  test("EditoMemento - clear on editor dispose", function() {
    const testGroup0 = new TestEditorGroupView(0);
    class TestEditorInput2 extends EditorInput {
      constructor(resource, id = "testEditorInputForMementoTest") {
        super();
        this.resource = resource;
        this.id = id;
      }
      get typeId() {
        return "testEditorInputForMementoTest";
      }
      async resolve() {
        return null;
      }
      matches(other) {
        return other && this.id === other.id && other instanceof TestEditorInput2;
      }
    }
    const rawMemento = /* @__PURE__ */ Object.create(null);
    const memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, new TestEditorGroupsService(), new TestTextResourceConfigurationService()));
    const testInputA = disposables.add(new TestEditorInput2(URI.file("/A")));
    let res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(!res);
    memento.saveEditorState(testGroup0, testInputA.resource, { line: 3 });
    res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(res);
    assert.strictEqual(res.line, 3);
    testInputA.dispose();
    res = memento.loadEditorState(testGroup0, testInputA);
    assert.ok(res);
    const testInputB = disposables.add(new TestEditorInput2(URI.file("/B")));
    res = memento.loadEditorState(testGroup0, testInputB);
    assert.ok(!res);
    memento.saveEditorState(testGroup0, testInputB.resource, { line: 3 });
    res = memento.loadEditorState(testGroup0, testInputB);
    assert.ok(res);
    assert.strictEqual(res.line, 3);
    memento.clearEditorStateOnDispose(testInputB.resource, testInputB);
    testInputB.dispose();
    res = memento.loadEditorState(testGroup0, testInputB);
    assert.ok(!res);
  });
  test("EditorMemento - workbench.editor.sharedViewState", function() {
    const testGroup0 = new TestEditorGroupView(0);
    const testGroup1 = new TestEditorGroupView(1);
    const configurationService = new TestTextResourceConfigurationService(new TestConfigurationService({
      workbench: {
        editor: {
          sharedViewState: true
        }
      }
    }));
    const editorGroupService = new TestEditorGroupsService([testGroup0]);
    const rawMemento = /* @__PURE__ */ Object.create(null);
    const memento = disposables.add(new EditorMemento("id", "key", rawMemento, 3, editorGroupService, configurationService));
    const resource = URI.file("/some/folder/file-1.txt");
    memento.saveEditorState(testGroup0, resource, { line: 1 });
    let res = memento.loadEditorState(testGroup0, resource);
    assert.strictEqual(res.line, 1);
    res = memento.loadEditorState(testGroup1, resource);
    assert.strictEqual(res.line, 1);
    memento.saveEditorState(testGroup0, resource, { line: 3 });
    res = memento.loadEditorState(testGroup1, resource);
    assert.strictEqual(res.line, 3);
    memento.saveEditorState(testGroup1, resource, { line: 1 });
    res = memento.loadEditorState(testGroup1, resource);
    assert.strictEqual(res.line, 1);
    memento.clearEditorState(resource, testGroup0);
    memento.clearEditorState(resource, testGroup1);
    res = memento.loadEditorState(testGroup1, resource);
    assert.strictEqual(res.line, 1);
    memento.clearEditorState(resource);
    res = memento.loadEditorState(testGroup1, resource);
    assert.ok(!res);
  });
  test("WorkspaceTrustRequiredEditor", async function() {
    let TrustRequiredTestEditor = class extends EditorPane {
      constructor(group2, telemetryService) {
        super("TestEditor", group2, NullTelemetryService, NullThemeService, disposables.add(new TestStorageService()));
      }
      getId() {
        return "trustRequiredTestEditor";
      }
      layout() {
      }
      createEditor() {
      }
    };
    TrustRequiredTestEditor = __decorateClass([
      __decorateParam(1, ITelemetryService)
    ], TrustRequiredTestEditor);
    class TrustRequiredTestInput extends EditorInput {
      constructor() {
        super(...arguments);
        this.resource = void 0;
      }
      get typeId() {
        return "trustRequiredTestInput";
      }
      get capabilities() {
        return EditorInputCapabilities.RequiresTrust;
      }
      resolve() {
        return null;
      }
    }
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const workspaceTrustService = disposables.add(instantiationService.createInstance(TestWorkspaceTrustManagementService));
    instantiationService.stub(IWorkspaceTrustManagementService, workspaceTrustService);
    workspaceTrustService.setWorkspaceTrust(false);
    const editorPart = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, editorPart);
    const editorService = disposables.add(instantiationService.createInstance(EditorService, void 0));
    instantiationService.stub(IEditorService, editorService);
    const group = editorPart.activeGroup;
    const editorDescriptor = EditorPaneDescriptor.create(TrustRequiredTestEditor, "id1", "name");
    disposables.add(editorRegistry.registerEditorPane(editorDescriptor, [new SyncDescriptor(TrustRequiredTestInput)]));
    const testInput = disposables.add(new TrustRequiredTestInput());
    await group.openEditor(testInput);
    assert.strictEqual(group.activeEditorPane?.getId(), WorkspaceTrustRequiredPlaceholderEditor.ID);
    const getEditorPaneIdAsync = () => new Promise((resolve) => {
      disposables.add(editorService.onDidActiveEditorChange(() => {
        resolve(group.activeEditorPane?.getId());
      }));
    });
    workspaceTrustService.setWorkspaceTrust(true);
    assert.strictEqual(await getEditorPaneIdAsync(), "trustRequiredTestEditor");
    workspaceTrustService.setWorkspaceTrust(false);
    assert.strictEqual(await getEditorPaneIdAsync(), WorkspaceTrustRequiredPlaceholderEditor.ID);
    await group.closeAllEditors();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQYW5lLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFZGl0b3JQYW5lLCBFZGl0b3JNZW1lbnRvIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFuZS5qcyc7XG5pbXBvcnQgeyBXb3Jrc3BhY2VUcnVzdFJlcXVpcmVkUGxhY2Vob2xkZXJFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9icm93c2VyL3BhcnRzL2VkaXRvci9lZGl0b3JQbGFjZWhvbGRlci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VyaWFsaXplciwgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSwgRWRpdG9yRXh0ZW5zaW9ucywgRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMsIElFZGl0b3JEZXNjcmlwdG9yLCBJRWRpdG9yUGFuZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0RWRpdG9yR3JvdXBWaWV3LCBUZXN0RWRpdG9yR3JvdXBzU2VydmljZSwgcmVnaXN0ZXJUZXN0UmVzb3VyY2VFZGl0b3IsIFRlc3RFZGl0b3JJbnB1dCwgY3JlYXRlRWRpdG9yUGFydCwgVGVzdFRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRleHRSZXNvdXJjZUVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci90ZXh0UmVzb3VyY2VFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXN0VGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvdGVzdC9jb21tb24vdGVzdFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRWRpdG9yUGFuZURlc2NyaXB0b3IsIEVkaXRvclBhbmVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JhZ2VTZXJ2aWNlLCBUZXN0V29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgZXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvYnJvd3Nlci9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cCwgSUVkaXRvckdyb3Vwc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvckdyb3Vwc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZVRydXN0LmpzJztcbmltcG9ydCB7IEVkaXRvcklucHV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9lZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuY29uc3QgTnVsbFRoZW1lU2VydmljZSA9IG5ldyBUZXN0VGhlbWVTZXJ2aWNlKCk7XG5cbmNvbnN0IGVkaXRvclJlZ2lzdHJ5OiBFZGl0b3JQYW5lUmVnaXN0cnkgPSBSZWdpc3RyeS5hcyhFZGl0b3JFeHRlbnNpb25zLkVkaXRvclBhbmUpO1xuY29uc3QgZWRpdG9ySW5wdXRSZWdpc3RyeTogSUVkaXRvckZhY3RvcnlSZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzKEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSk7XG5cbmNsYXNzIFRlc3RFZGl0b3IgZXh0ZW5kcyBFZGl0b3JQYW5lIHtcblxuXHRjb25zdHJ1Y3Rvcihncm91cDogSUVkaXRvckdyb3VwLCkge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN1cGVyKCdUZXN0RWRpdG9yJywgZ3JvdXAsIE51bGxUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGhlbWVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRJZCgpOiBzdHJpbmcgeyByZXR1cm4gJ3Rlc3RFZGl0b3InOyB9XG5cdGxheW91dCgpOiB2b2lkIHsgfVxuXHRwcm90ZWN0ZWQgY3JlYXRlRWRpdG9yKCk6IGFueSB7IH1cbn1cblxuY2xhc3MgT3RoZXJUZXN0RWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSB7XG5cblx0Y29uc3RydWN0b3IoZ3JvdXA6IElFZGl0b3JHcm91cCwpIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRzdXBlcigndGVzdE90aGVyRWRpdG9yJywgZ3JvdXAsIE51bGxUZWxlbWV0cnlTZXJ2aWNlLCBOdWxsVGhlbWVTZXJ2aWNlLCBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihkaXNwb3NhYmxlcyk7XG5cdH1cblxuXHRvdmVycmlkZSBnZXRJZCgpOiBzdHJpbmcgeyByZXR1cm4gJ3Rlc3RPdGhlckVkaXRvcic7IH1cblxuXHRsYXlvdXQoKTogdm9pZCB7IH1cblx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcigpOiBhbnkgeyB9XG59XG5cbmNsYXNzIFRlc3RJbnB1dFNlcmlhbGl6ZXIgaW1wbGVtZW50cyBJRWRpdG9yU2VyaWFsaXplciB7XG5cblx0Y2FuU2VyaWFsaXplKGVkaXRvcklucHV0OiBFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c2VyaWFsaXplKGlucHV0OiBFZGl0b3JJbnB1dCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIGlucHV0LnRvU3RyaW5nKCk7XG5cdH1cblxuXHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLCByYXc6IHN0cmluZyk6IEVkaXRvcklucHV0IHtcblx0XHRyZXR1cm4ge30gYXMgRWRpdG9ySW5wdXQ7XG5cdH1cbn1cblxuY2xhc3MgVGVzdElucHV0IGV4dGVuZHMgRWRpdG9ySW5wdXQge1xuXG5cdHJlYWRvbmx5IHJlc291cmNlID0gdW5kZWZpbmVkO1xuXG5cdG92ZXJyaWRlIHByZWZlcnNFZGl0b3JQYW5lPFQgZXh0ZW5kcyBJRWRpdG9yRGVzY3JpcHRvcjxJRWRpdG9yUGFuZT4+KGVkaXRvcnM6IFRbXSk6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiBlZGl0b3JzWzFdO1xuXHR9XG5cblx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiAndGVzdElucHV0Jztcblx0fVxuXG5cdG92ZXJyaWRlIHJlc29sdmUoKTogYW55IHtcblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5jbGFzcyBPdGhlclRlc3RJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblxuXHRyZWFkb25seSByZXNvdXJjZSA9IHVuZGVmaW5lZDtcblxuXHRvdmVycmlkZSBnZXQgdHlwZUlkKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuICdvdGhlclRlc3RJbnB1dCc7XG5cdH1cblxuXHRvdmVycmlkZSByZXNvbHZlKCk6IGFueSB7XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cbn1cbmNsYXNzIFRlc3RSZXNvdXJjZUVkaXRvcklucHV0IGV4dGVuZHMgVGV4dFJlc291cmNlRWRpdG9ySW5wdXQgeyB9XG5cbnN1aXRlKCdFZGl0b3JQYW5lJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdFZGl0b3JQYW5lIEFQSScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBncm91cCA9IG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDEpO1xuXHRcdGNvbnN0IGVkaXRvciA9IG5ldyBUZXN0RWRpdG9yKGdyb3VwKTtcblx0XHRhc3NlcnQub2soZWRpdG9yLmdyb3VwKTtcblx0XHRjb25zdCBpbnB1dCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgT3RoZXJUZXN0SW5wdXQoKSk7XG5cdFx0Y29uc3Qgb3B0aW9ucyA9IHt9O1xuXG5cdFx0YXNzZXJ0KCFlZGl0b3IuaXNWaXNpYmxlKCkpO1xuXHRcdGFzc2VydCghZWRpdG9yLmlucHV0KTtcblxuXHRcdGF3YWl0IGVkaXRvci5zZXRJbnB1dChpbnB1dCwgb3B0aW9ucywgT2JqZWN0LmNyZWF0ZShudWxsKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDxhbnk+aW5wdXQsIGVkaXRvci5pbnB1dCk7XG5cdFx0ZWRpdG9yLnNldFZpc2libGUodHJ1ZSk7XG5cdFx0YXNzZXJ0KGVkaXRvci5pc1Zpc2libGUoKSk7XG5cdFx0ZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRlZGl0b3IuY2xlYXJJbnB1dCgpO1xuXHRcdGVkaXRvci5zZXRWaXNpYmxlKGZhbHNlKTtcblx0XHRhc3NlcnQoIWVkaXRvci5pc1Zpc2libGUoKSk7XG5cdFx0YXNzZXJ0KCFlZGl0b3IuaW5wdXQpO1xuXHRcdGFzc2VydCghZWRpdG9yLmdldENvbnRyb2woKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VkaXRvclBhbmVEZXNjcmlwdG9yJywgKCkgPT4ge1xuXHRcdGNvbnN0IGVkaXRvckRlc2NyaXB0b3IgPSBFZGl0b3JQYW5lRGVzY3JpcHRvci5jcmVhdGUoVGVzdEVkaXRvciwgJ2lkJywgJ25hbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yRGVzY3JpcHRvci50eXBlSWQsICdpZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JEZXNjcmlwdG9yLm5hbWUsICduYW1lJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VkaXRvciBQYW5lIFJlZ2lzdHJhdGlvbicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlZGl0b3JEZXNjcmlwdG9yMSA9IEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShUZXN0RWRpdG9yLCAnaWQxJywgJ25hbWUnKTtcblx0XHRjb25zdCBlZGl0b3JEZXNjcmlwdG9yMiA9IEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShPdGhlclRlc3RFZGl0b3IsICdpZDInLCAnbmFtZScpO1xuXG5cdFx0Y29uc3Qgb2xkRWRpdG9yc0NudCA9IGVkaXRvclJlZ2lzdHJ5LmdldEVkaXRvclBhbmVzKCkubGVuZ3RoO1xuXHRcdGNvbnN0IG9sZElucHV0Q250ID0gZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9ycygpLmxlbmd0aDtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JSZWdpc3RyeS5yZWdpc3RlckVkaXRvclBhbmUoZWRpdG9yRGVzY3JpcHRvcjEsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVGVzdElucHV0KV0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yUmVnaXN0cnkucmVnaXN0ZXJFZGl0b3JQYW5lKGVkaXRvckRlc2NyaXB0b3IyLCBbbmV3IFN5bmNEZXNjcmlwdG9yKFRlc3RJbnB1dCksIG5ldyBTeW5jRGVzY3JpcHRvcihPdGhlclRlc3RJbnB1dCldKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9yUGFuZXMoKS5sZW5ndGgsIG9sZEVkaXRvcnNDbnQgKyAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9ycygpLmxlbmd0aCwgb2xkSW5wdXRDbnQgKyAzKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JSZWdpc3RyeS5nZXRFZGl0b3JQYW5lKGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdElucHV0KCkpKSwgZWRpdG9yRGVzY3JpcHRvcjIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3JSZWdpc3RyeS5nZXRFZGl0b3JQYW5lKGRpc3Bvc2FibGVzLmFkZChuZXcgT3RoZXJUZXN0SW5wdXQoKSkpLCBlZGl0b3JEZXNjcmlwdG9yMik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9yUGFuZUJ5VHlwZSgnaWQxJyksIGVkaXRvckRlc2NyaXB0b3IxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9yUGFuZUJ5VHlwZSgnaWQyJyksIGVkaXRvckRlc2NyaXB0b3IyKTtcblx0XHRhc3NlcnQoIWVkaXRvclJlZ2lzdHJ5LmdldEVkaXRvclBhbmVCeVR5cGUoJ2lkMycpKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdG9yIFBhbmUgTG9va3VwIGZhdm9ycyBzcGVjaWZpYyBjbGFzcyBvdmVyIHN1cGVyY2xhc3MgKG1hdGNoIG9uIHNwZWNpZmljIGNsYXNzKScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBkMSA9IEVkaXRvclBhbmVEZXNjcmlwdG9yLmNyZWF0ZShUZXN0RWRpdG9yLCAnaWQxJywgJ25hbWUnKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlclRlc3RSZXNvdXJjZUVkaXRvcigpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yUmVnaXN0cnkucmVnaXN0ZXJFZGl0b3JQYW5lKGQxLCBbbmV3IFN5bmNEZXNjcmlwdG9yKFRlc3RSZXNvdXJjZUVkaXRvcklucHV0KV0pKTtcblxuXHRcdGNvbnN0IGluc3QgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMSk7XG5cblx0XHRjb25zdCBlZGl0b3IgPSBkaXNwb3NhYmxlcy5hZGQoZWRpdG9yUmVnaXN0cnkuZ2V0RWRpdG9yUGFuZShkaXNwb3NhYmxlcy5hZGQoaW5zdC5jcmVhdGVJbnN0YW5jZShUZXN0UmVzb3VyY2VFZGl0b3JJbnB1dCwgVVJJLmZpbGUoJy9mYWtlJyksICdmYWtlJywgJycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKSkpIS5pbnN0YW50aWF0ZShpbnN0LCBncm91cCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0b3IuZ2V0SWQoKSwgJ3Rlc3RFZGl0b3InKTtcblxuXHRcdGNvbnN0IG90aGVyRWRpdG9yID0gZGlzcG9zYWJsZXMuYWRkKGVkaXRvclJlZ2lzdHJ5LmdldEVkaXRvclBhbmUoZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoVGV4dFJlc291cmNlRWRpdG9ySW5wdXQsIFVSSS5maWxlKCcvZmFrZScpLCAnZmFrZScsICcnLCB1bmRlZmluZWQsIHVuZGVmaW5lZCkpKSEuaW5zdGFudGlhdGUoaW5zdCwgZ3JvdXApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3RoZXJFZGl0b3IuZ2V0SWQoKSwgJ3dvcmtiZW5jaC5lZGl0b3JzLnRleHRSZXNvdXJjZUVkaXRvcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdFZGl0b3IgUGFuZSBMb29rdXAgZmF2b3JzIHNwZWNpZmljIGNsYXNzIG92ZXIgc3VwZXJjbGFzcyAobWF0Y2ggb24gc3VwZXIgY2xhc3MpJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGluc3QgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUZXN0UmVzb3VyY2VFZGl0b3IoKSk7XG5cdFx0Y29uc3QgZWRpdG9yID0gZGlzcG9zYWJsZXMuYWRkKGVkaXRvclJlZ2lzdHJ5LmdldEVkaXRvclBhbmUoZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoVGVzdFJlc291cmNlRWRpdG9ySW5wdXQsIFVSSS5maWxlKCcvZmFrZScpLCAnZmFrZScsICcnLCB1bmRlZmluZWQsIHVuZGVmaW5lZCkpKSEuaW5zdGFudGlhdGUoaW5zdCwgZ3JvdXApKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnd29ya2JlbmNoLmVkaXRvcnMudGV4dFJlc291cmNlRWRpdG9yJywgZWRpdG9yLmdldElkKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdFZGl0b3IgSW5wdXQgU2VyaWFsaXplcicsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0SW5wdXQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChVUkkuZmlsZSgnL2Zha2UnKSwgJ3Rlc3RUeXBlSWQnKSk7XG5cdFx0d29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcykuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gZWRpdG9ySW5wdXRSZWdpc3RyeS5zdGFydChhY2Nlc3NvcikpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JJbnB1dFJlZ2lzdHJ5LnJlZ2lzdGVyRWRpdG9yU2VyaWFsaXplcih0ZXN0SW5wdXQudHlwZUlkLCBUZXN0SW5wdXRTZXJpYWxpemVyKSk7XG5cblx0XHRsZXQgZmFjdG9yeSA9IGVkaXRvcklucHV0UmVnaXN0cnkuZ2V0RWRpdG9yU2VyaWFsaXplcigndGVzdFR5cGVJZCcpO1xuXHRcdGFzc2VydChmYWN0b3J5KTtcblxuXHRcdGZhY3RvcnkgPSBlZGl0b3JJbnB1dFJlZ2lzdHJ5LmdldEVkaXRvclNlcmlhbGl6ZXIodGVzdElucHV0KTtcblx0XHRhc3NlcnQoZmFjdG9yeSk7XG5cblx0XHQvLyB0aHJvd3Mgd2hlbiByZWdpc3RlcmluZyBzZXJpYWxpemVyIGZvciBzYW1lIHR5cGVcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGVkaXRvcklucHV0UmVnaXN0cnkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKHRlc3RJbnB1dC50eXBlSWQsIFRlc3RJbnB1dFNlcmlhbGl6ZXIpKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdG9yTWVtZW50byAtIGJhc2ljcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0R3JvdXAwID0gbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCk7XG5cdFx0Y29uc3QgdGVzdEdyb3VwMSA9IG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDEpO1xuXHRcdGNvbnN0IHRlc3RHcm91cDQgPSBuZXcgVGVzdEVkaXRvckdyb3VwVmlldyg0KTtcblxuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gbmV3IFRlc3RFZGl0b3JHcm91cHNTZXJ2aWNlKFtcblx0XHRcdHRlc3RHcm91cDAsXG5cdFx0XHR0ZXN0R3JvdXAxLFxuXHRcdFx0bmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMilcblx0XHRdKTtcblxuXHRcdGludGVyZmFjZSBUZXN0Vmlld1N0YXRlIHtcblx0XHRcdGxpbmU6IG51bWJlcjtcblx0XHR9XG5cblx0XHRjb25zdCByYXdNZW1lbnRvID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRsZXQgbWVtZW50byA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRWRpdG9yTWVtZW50bzxUZXN0Vmlld1N0YXRlPignaWQnLCAna2V5JywgcmF3TWVtZW50bywgMywgZWRpdG9yR3JvdXBTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSkpO1xuXG5cdFx0bGV0IHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvQScpKTtcblx0XHRhc3NlcnQub2soIXJlcyk7XG5cblx0XHRtZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0EnKSwgeyBsaW5lOiAzIH0pO1xuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvQScpKTtcblx0XHRhc3NlcnQub2socmVzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzLmxpbmUsIDMpO1xuXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMSwgVVJJLmZpbGUoJy9BJyksIHsgbGluZTogNSB9KTtcblx0XHRyZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAxLCBVUkkuZmlsZSgnL0EnKSk7XG5cdFx0YXNzZXJ0Lm9rKHJlcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5saW5lLCA1KTtcblxuXHRcdC8vIEVuc3VyZSBjYXBwZWQgYXQgMyBlbGVtZW50c1xuXHRcdG1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvQicpLCB7IGxpbmU6IDEgfSk7XG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgVVJJLmZpbGUoJy9DJyksIHsgbGluZTogMSB9KTtcblx0XHRtZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0QnKSwgeyBsaW5lOiAxIH0pO1xuXHRcdG1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvRScpLCB7IGxpbmU6IDEgfSk7XG5cblx0XHRhc3NlcnQub2soIW1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvQScpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0InKSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0MnKSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0QnKSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0UnKSkpO1xuXG5cdFx0Ly8gU2F2ZSBhdCBhbiB1bmtub3duIGdyb3VwXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwNCwgVVJJLmZpbGUoJy9FJyksIHsgbGluZTogMSB9KTtcblx0XHRhc3NlcnQub2sobWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwNCwgVVJJLmZpbGUoJy9FJykpKTsgLy8gb25seSBnZXRzIHJlbW92ZWQgd2hlbiBtZW1lbnRvIGlzIHNhdmVkXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwNCwgVVJJLmZpbGUoJy9DJyksIHsgbGluZTogMSB9KTtcblx0XHRhc3NlcnQub2sobWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwNCwgVVJJLmZpbGUoJy9DJykpKTsgLy8gb25seSBnZXRzIHJlbW92ZWQgd2hlbiBtZW1lbnRvIGlzIHNhdmVkXG5cblx0XHRtZW1lbnRvLnNhdmVTdGF0ZSgpO1xuXG5cdFx0bWVtZW50byA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRWRpdG9yTWVtZW50bygnaWQnLCAna2V5JywgcmF3TWVtZW50bywgMywgZWRpdG9yR3JvdXBTZXJ2aWNlLCBjb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0MnKSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0QnKSkpO1xuXHRcdGFzc2VydC5vayhtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0UnKSkpO1xuXG5cdFx0Ly8gQ2hlY2sgb24gZW50cmllcyBubyBsb25nZXIgdGhlcmUgZnJvbSBpbnZhbGlkIGdyb3Vwc1xuXHRcdGFzc2VydC5vayghbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwNCwgVVJJLmZpbGUoJy9FJykpKTtcblx0XHRhc3NlcnQub2soIW1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDQsIFVSSS5maWxlKCcvQycpKSk7XG5cblx0XHRtZW1lbnRvLmNsZWFyRWRpdG9yU3RhdGUoVVJJLmZpbGUoJy9DJyksIHRlc3RHcm91cDQpO1xuXHRcdG1lbWVudG8uY2xlYXJFZGl0b3JTdGF0ZShVUkkuZmlsZSgnL0UnKSk7XG5cblx0XHRhc3NlcnQub2soIW1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDQsIFVSSS5maWxlKCcvQycpKSk7XG5cdFx0YXNzZXJ0Lm9rKG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvRCcpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL0UnKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdFZGl0b3JNZW1lbnRvIC0gbW92ZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0R3JvdXAwID0gbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMCk7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0VGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25zdCBlZGl0b3JHcm91cFNlcnZpY2UgPSBuZXcgVGVzdEVkaXRvckdyb3Vwc1NlcnZpY2UoW3Rlc3RHcm91cDBdKTtcblxuXHRcdGludGVyZmFjZSBUZXN0Vmlld1N0YXRlIHsgbGluZTogbnVtYmVyIH1cblxuXHRcdGNvbnN0IHJhd01lbWVudG8gPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGNvbnN0IG1lbWVudG8gPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVkaXRvck1lbWVudG88VGVzdFZpZXdTdGF0ZT4oJ2lkJywgJ2tleScsIHJhd01lbWVudG8sIDMsIGVkaXRvckdyb3VwU2VydmljZSwgY29uZmlndXJhdGlvblNlcnZpY2UpKTtcblxuXHRcdG1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvc29tZS9mb2xkZXIvZmlsZS0xLnR4dCcpLCB7IGxpbmU6IDEgfSk7XG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgVVJJLmZpbGUoJy9zb21lL2ZvbGRlci9maWxlLTIudHh0JyksIHsgbGluZTogMiB9KTtcblx0XHRtZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL3NvbWUvb3RoZXIvZmlsZS50eHQnKSwgeyBsaW5lOiAzIH0pO1xuXG5cdFx0bWVtZW50by5tb3ZlRWRpdG9yU3RhdGUoVVJJLmZpbGUoJy9zb21lL2ZvbGRlci9maWxlLTEudHh0JyksIFVSSS5maWxlKCcvc29tZS9mb2xkZXIvZmlsZS1tb3ZlZC50eHQnKSwgZXh0VXJpKTtcblxuXHRcdGxldCByZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCBVUkkuZmlsZSgnL3NvbWUvZm9sZGVyL2ZpbGUtMS50eHQnKSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZXMpO1xuXG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgVVJJLmZpbGUoJy9zb21lL2ZvbGRlci9maWxlLW1vdmVkLnR4dCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzPy5saW5lLCAxKTtcblxuXHRcdG1lbWVudG8ubW92ZUVkaXRvclN0YXRlKFVSSS5maWxlKCcvc29tZS9mb2xkZXInKSwgVVJJLmZpbGUoJy9zb21lL2ZvbGRlci1tb3ZlZCcpLCBleHRVcmkpO1xuXG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgVVJJLmZpbGUoJy9zb21lL2ZvbGRlci1tb3ZlZC9maWxlLW1vdmVkLnR4dCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzPy5saW5lLCAxKTtcblxuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIFVSSS5maWxlKCcvc29tZS9mb2xkZXItbW92ZWQvZmlsZS0yLnR4dCcpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzPy5saW5lLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdG9NZW1lbnRvIC0gdXNlIHdpdGggZWRpdG9yIGlucHV0JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RHcm91cDAgPSBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKTtcblxuXHRcdGludGVyZmFjZSBUZXN0Vmlld1N0YXRlIHtcblx0XHRcdGxpbmU6IG51bWJlcjtcblx0XHR9XG5cblx0XHRjbGFzcyBUZXN0RWRpdG9ySW5wdXQgZXh0ZW5kcyBFZGl0b3JJbnB1dCB7XG5cdFx0XHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVzb3VyY2U6IFVSSSwgcHJpdmF0ZSBpZCA9ICd0ZXN0RWRpdG9ySW5wdXRGb3JNZW1lbnRvVGVzdCcpIHtcblx0XHRcdFx0c3VwZXIoKTtcblx0XHRcdH1cblx0XHRcdG92ZXJyaWRlIGdldCB0eXBlSWQoKSB7IHJldHVybiAndGVzdEVkaXRvcklucHV0Rm9yTWVtZW50b1Rlc3QnOyB9XG5cdFx0XHRvdmVycmlkZSBhc3luYyByZXNvbHZlKCk6IFByb21pc2U8SURpc3Bvc2FibGUgfCBudWxsPiB7IHJldHVybiBudWxsOyB9XG5cblx0XHRcdG92ZXJyaWRlIG1hdGNoZXMob3RoZXI6IFRlc3RFZGl0b3JJbnB1dCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gb3RoZXIgJiYgdGhpcy5pZCA9PT0gb3RoZXIuaWQgJiYgb3RoZXIgaW5zdGFuY2VvZiBUZXN0RWRpdG9ySW5wdXQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmF3TWVtZW50byA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Y29uc3QgbWVtZW50byA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRWRpdG9yTWVtZW50bzxUZXN0Vmlld1N0YXRlPignaWQnLCAna2V5JywgcmF3TWVtZW50bywgMywgbmV3IFRlc3RFZGl0b3JHcm91cHNTZXJ2aWNlKCksIG5ldyBUZXN0VGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UoKSkpO1xuXG5cdFx0Y29uc3QgdGVzdElucHV0QSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEVkaXRvcklucHV0KFVSSS5maWxlKCcvQScpKSk7XG5cblx0XHRsZXQgcmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgdGVzdElucHV0QSk7XG5cdFx0YXNzZXJ0Lm9rKCFyZXMpO1xuXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgdGVzdElucHV0QSwgeyBsaW5lOiAzIH0pO1xuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIHRlc3RJbnB1dEEpO1xuXHRcdGFzc2VydC5vayhyZXMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMubGluZSwgMyk7XG5cblx0XHQvLyBTdGF0ZSByZW1vdmVkIHdoZW4gaW5wdXQgZ2V0cyBkaXNwb3NlZFxuXHRcdHRlc3RJbnB1dEEuZGlzcG9zZSgpO1xuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIHRlc3RJbnB1dEEpO1xuXHRcdGFzc2VydC5vayghcmVzKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdG9NZW1lbnRvIC0gY2xlYXIgb24gZWRpdG9yIGRpc3Bvc2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdEdyb3VwMCA9IG5ldyBUZXN0RWRpdG9yR3JvdXBWaWV3KDApO1xuXG5cdFx0aW50ZXJmYWNlIFRlc3RWaWV3U3RhdGUge1xuXHRcdFx0bGluZTogbnVtYmVyO1xuXHRcdH1cblxuXHRcdGNsYXNzIFRlc3RFZGl0b3JJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblx0XHRcdGNvbnN0cnVjdG9yKHB1YmxpYyByZXNvdXJjZTogVVJJLCBwcml2YXRlIGlkID0gJ3Rlc3RFZGl0b3JJbnB1dEZvck1lbWVudG9UZXN0Jykge1xuXHRcdFx0XHRzdXBlcigpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZ2V0IHR5cGVJZCgpIHsgcmV0dXJuICd0ZXN0RWRpdG9ySW5wdXRGb3JNZW1lbnRvVGVzdCc7IH1cblx0XHRcdG92ZXJyaWRlIGFzeW5jIHJlc29sdmUoKTogUHJvbWlzZTxJRGlzcG9zYWJsZSB8IG51bGw+IHsgcmV0dXJuIG51bGw7IH1cblxuXHRcdFx0b3ZlcnJpZGUgbWF0Y2hlcyhvdGhlcjogVGVzdEVkaXRvcklucHV0KTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiBvdGhlciAmJiB0aGlzLmlkID09PSBvdGhlci5pZCAmJiBvdGhlciBpbnN0YW5jZW9mIFRlc3RFZGl0b3JJbnB1dDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCByYXdNZW1lbnRvID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCBtZW1lbnRvID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFZGl0b3JNZW1lbnRvPFRlc3RWaWV3U3RhdGU+KCdpZCcsICdrZXknLCByYXdNZW1lbnRvLCAzLCBuZXcgVGVzdEVkaXRvckdyb3Vwc1NlcnZpY2UoKSwgbmV3IFRlc3RUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSgpKSk7XG5cblx0XHRjb25zdCB0ZXN0SW5wdXRBID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RWRpdG9ySW5wdXQoVVJJLmZpbGUoJy9BJykpKTtcblxuXHRcdGxldCByZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCB0ZXN0SW5wdXRBKTtcblx0XHRhc3NlcnQub2soIXJlcyk7XG5cblx0XHRtZW1lbnRvLnNhdmVFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCB0ZXN0SW5wdXRBLnJlc291cmNlLCB7IGxpbmU6IDMgfSk7XG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgdGVzdElucHV0QSk7XG5cdFx0YXNzZXJ0Lm9rKHJlcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcy5saW5lLCAzKTtcblxuXHRcdC8vIFN0YXRlIG5vdCB5ZXQgcmVtb3ZlZCB3aGVuIGlucHV0IGdldHMgZGlzcG9zZWRcblx0XHQvLyBiZWNhdXNlIHdlIHVzZWQgcmVzb3VyY2Vcblx0XHR0ZXN0SW5wdXRBLmRpc3Bvc2UoKTtcblx0XHRyZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAwLCB0ZXN0SW5wdXRBKTtcblx0XHRhc3NlcnQub2socmVzKTtcblxuXHRcdGNvbnN0IHRlc3RJbnB1dEIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RFZGl0b3JJbnB1dChVUkkuZmlsZSgnL0InKSkpO1xuXG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgdGVzdElucHV0Qik7XG5cdFx0YXNzZXJ0Lm9rKCFyZXMpO1xuXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgdGVzdElucHV0Qi5yZXNvdXJjZSwgeyBsaW5lOiAzIH0pO1xuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIHRlc3RJbnB1dEIpO1xuXHRcdGFzc2VydC5vayhyZXMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMubGluZSwgMyk7XG5cblx0XHRtZW1lbnRvLmNsZWFyRWRpdG9yU3RhdGVPbkRpc3Bvc2UodGVzdElucHV0Qi5yZXNvdXJjZSwgdGVzdElucHV0Qik7XG5cblx0XHQvLyBTdGF0ZSByZW1vdmVkIHdoZW4gaW5wdXQgZ2V0cyBkaXNwb3NlZFxuXHRcdHRlc3RJbnB1dEIuZGlzcG9zZSgpO1xuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDAsIHRlc3RJbnB1dEIpO1xuXHRcdGFzc2VydC5vayghcmVzKTtcblx0fSk7XG5cblx0dGVzdCgnRWRpdG9yTWVtZW50byAtIHdvcmtiZW5jaC5lZGl0b3Iuc2hhcmVkVmlld1N0YXRlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RHcm91cDAgPSBuZXcgVGVzdEVkaXRvckdyb3VwVmlldygwKTtcblx0XHRjb25zdCB0ZXN0R3JvdXAxID0gbmV3IFRlc3RFZGl0b3JHcm91cFZpZXcoMSk7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0VGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UobmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSh7XG5cdFx0XHR3b3JrYmVuY2g6IHtcblx0XHRcdFx0ZWRpdG9yOiB7XG5cdFx0XHRcdFx0c2hhcmVkVmlld1N0YXRlOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0Y29uc3QgZWRpdG9yR3JvdXBTZXJ2aWNlID0gbmV3IFRlc3RFZGl0b3JHcm91cHNTZXJ2aWNlKFt0ZXN0R3JvdXAwXSk7XG5cblx0XHRpbnRlcmZhY2UgVGVzdFZpZXdTdGF0ZSB7IGxpbmU6IG51bWJlciB9XG5cblx0XHRjb25zdCByYXdNZW1lbnRvID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRjb25zdCBtZW1lbnRvID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBFZGl0b3JNZW1lbnRvPFRlc3RWaWV3U3RhdGU+KCdpZCcsICdrZXknLCByYXdNZW1lbnRvLCAzLCBlZGl0b3JHcm91cFNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKSk7XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5maWxlKCcvc29tZS9mb2xkZXIvZmlsZS0xLnR4dCcpO1xuXHRcdG1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRlc3RHcm91cDAsIHJlc291cmNlLCB7IGxpbmU6IDEgfSk7XG5cblx0XHRsZXQgcmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgcmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMhLmxpbmUsIDEpO1xuXG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMSwgcmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXMhLmxpbmUsIDEpO1xuXG5cdFx0bWVtZW50by5zYXZlRWRpdG9yU3RhdGUodGVzdEdyb3VwMCwgcmVzb3VyY2UsIHsgbGluZTogMyB9KTtcblxuXHRcdHJlcyA9IG1lbWVudG8ubG9hZEVkaXRvclN0YXRlKHRlc3RHcm91cDEsIHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzIS5saW5lLCAzKTtcblxuXHRcdG1lbWVudG8uc2F2ZUVkaXRvclN0YXRlKHRlc3RHcm91cDEsIHJlc291cmNlLCB7IGxpbmU6IDEgfSk7XG5cblx0XHRyZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAxLCByZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcyEubGluZSwgMSk7XG5cblx0XHRtZW1lbnRvLmNsZWFyRWRpdG9yU3RhdGUocmVzb3VyY2UsIHRlc3RHcm91cDApO1xuXHRcdG1lbWVudG8uY2xlYXJFZGl0b3JTdGF0ZShyZXNvdXJjZSwgdGVzdEdyb3VwMSk7XG5cblx0XHRyZXMgPSBtZW1lbnRvLmxvYWRFZGl0b3JTdGF0ZSh0ZXN0R3JvdXAxLCByZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcyEubGluZSwgMSk7XG5cblx0XHRtZW1lbnRvLmNsZWFyRWRpdG9yU3RhdGUocmVzb3VyY2UpO1xuXG5cdFx0cmVzID0gbWVtZW50by5sb2FkRWRpdG9yU3RhdGUodGVzdEdyb3VwMSwgcmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayghcmVzKTtcblx0fSk7XG5cblx0dGVzdCgnV29ya3NwYWNlVHJ1c3RSZXF1aXJlZEVkaXRvcicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNsYXNzIFRydXN0UmVxdWlyZWRUZXN0RWRpdG9yIGV4dGVuZHMgRWRpdG9yUGFuZSB7XG5cdFx0XHRjb25zdHJ1Y3Rvcihncm91cDogSUVkaXRvckdyb3VwLCBASVRlbGVtZXRyeVNlcnZpY2UgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UpIHtcblx0XHRcdFx0c3VwZXIoJ1Rlc3RFZGl0b3InLCBncm91cCwgTnVsbFRlbGVtZXRyeVNlcnZpY2UsIE51bGxUaGVtZVNlcnZpY2UsIGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZ2V0SWQoKTogc3RyaW5nIHsgcmV0dXJuICd0cnVzdFJlcXVpcmVkVGVzdEVkaXRvcic7IH1cblx0XHRcdGxheW91dCgpOiB2b2lkIHsgfVxuXHRcdFx0cHJvdGVjdGVkIGNyZWF0ZUVkaXRvcigpOiBhbnkgeyB9XG5cdFx0fVxuXG5cdFx0Y2xhc3MgVHJ1c3RSZXF1aXJlZFRlc3RJbnB1dCBleHRlbmRzIEVkaXRvcklucHV0IHtcblxuXHRcdFx0cmVhZG9ubHkgcmVzb3VyY2UgPSB1bmRlZmluZWQ7XG5cblx0XHRcdG92ZXJyaWRlIGdldCB0eXBlSWQoKTogc3RyaW5nIHtcblx0XHRcdFx0cmV0dXJuICd0cnVzdFJlcXVpcmVkVGVzdElucHV0Jztcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgZ2V0IGNhcGFiaWxpdGllcygpOiBFZGl0b3JJbnB1dENhcGFiaWxpdGllcyB7XG5cdFx0XHRcdHJldHVybiBFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5SZXF1aXJlc1RydXN0O1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSByZXNvbHZlKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3Qgd29ya3NwYWNlVHJ1c3RTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSwgd29ya3NwYWNlVHJ1c3RTZXJ2aWNlKTtcblx0XHR3b3Jrc3BhY2VUcnVzdFNlcnZpY2Uuc2V0V29ya3NwYWNlVHJ1c3QoZmFsc2UpO1xuXG5cdFx0Y29uc3QgZWRpdG9yUGFydCA9IGF3YWl0IGNyZWF0ZUVkaXRvclBhcnQoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JHcm91cHNTZXJ2aWNlLCBlZGl0b3JQYXJ0KTtcblxuXHRcdGNvbnN0IGVkaXRvclNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRWRpdG9yU2VydmljZSwgdW5kZWZpbmVkKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yU2VydmljZSwgZWRpdG9yU2VydmljZSk7XG5cblx0XHRjb25zdCBncm91cCA9IGVkaXRvclBhcnQuYWN0aXZlR3JvdXA7XG5cblx0XHRjb25zdCBlZGl0b3JEZXNjcmlwdG9yID0gRWRpdG9yUGFuZURlc2NyaXB0b3IuY3JlYXRlKFRydXN0UmVxdWlyZWRUZXN0RWRpdG9yLCAnaWQxJywgJ25hbWUnKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZWRpdG9yUmVnaXN0cnkucmVnaXN0ZXJFZGl0b3JQYW5lKGVkaXRvckRlc2NyaXB0b3IsIFtuZXcgU3luY0Rlc2NyaXB0b3IoVHJ1c3RSZXF1aXJlZFRlc3RJbnB1dCldKSk7XG5cblx0XHRjb25zdCB0ZXN0SW5wdXQgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRydXN0UmVxdWlyZWRUZXN0SW5wdXQoKSk7XG5cblx0XHRhd2FpdCBncm91cC5vcGVuRWRpdG9yKHRlc3RJbnB1dCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmdldElkKCksIFdvcmtzcGFjZVRydXN0UmVxdWlyZWRQbGFjZWhvbGRlckVkaXRvci5JRCk7XG5cblx0XHRjb25zdCBnZXRFZGl0b3JQYW5lSWRBc3luYyA9ICgpID0+IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGVkaXRvclNlcnZpY2Uub25EaWRBY3RpdmVFZGl0b3JDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0XHRyZXNvbHZlKGdyb3VwLmFjdGl2ZUVkaXRvclBhbmU/LmdldElkKCkpO1xuXHRcdFx0fSkpO1xuXHRcdH0pO1xuXG5cdFx0d29ya3NwYWNlVHJ1c3RTZXJ2aWNlLnNldFdvcmtzcGFjZVRydXN0KHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IGdldEVkaXRvclBhbmVJZEFzeW5jKCksICd0cnVzdFJlcXVpcmVkVGVzdEVkaXRvcicpO1xuXG5cdFx0d29ya3NwYWNlVHJ1c3RTZXJ2aWNlLnNldFdvcmtzcGFjZVRydXN0KGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgZ2V0RWRpdG9yUGFuZUlkQXN5bmMoKSwgV29ya3NwYWNlVHJ1c3RSZXF1aXJlZFBsYWNlaG9sZGVyRWRpdG9yLklEKTtcblxuXHRcdGF3YWl0IGdyb3VwLmNsb3NlQWxsRWRpdG9ycygpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxZQUFZLHFCQUFxQjtBQUMxQyxTQUFTLCtDQUErQztBQUN4RCxTQUFvRCxrQkFBa0IsK0JBQStEO0FBRXJJLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsK0JBQStCLHFCQUFxQix5QkFBeUIsNEJBQTRCLGlCQUFpQixrQkFBa0IsNENBQTRDO0FBQ2pNLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsV0FBVztBQUNwQixTQUFTLDRCQUFnRDtBQUN6RCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUFvQztBQUM3QyxTQUFTLG9CQUFvQiwy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
