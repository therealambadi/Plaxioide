import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../../base/common/network.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DiffEditorInput } from "../../../../common/editor/diffEditorInput.js";
import { EditorResolverService } from "../../browser/editorResolverService.js";
import { IEditorGroupsService } from "../../common/editorGroupsService.js";
import { IEditorResolverService, ResolvedStatus, RegisteredEditorPriority } from "../../common/editorResolverService.js";
import { createEditorPart, TestFileEditorInput, TestServiceAccessor, workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("EditorResolverService", () => {
  const TEST_EDITOR_INPUT_ID = "testEditorInputForEditorResolverService";
  const disposables = new DisposableStore();
  teardown(() => disposables.clear());
  ensureNoDisposablesAreLeakedInTestSuite();
  async function createEditorResolverService(instantiationService = workbenchInstantiationService(void 0, disposables)) {
    const part = await createEditorPart(instantiationService, disposables);
    instantiationService.stub(IEditorGroupsService, part);
    const editorResolverService = instantiationService.createInstance(EditorResolverService);
    instantiationService.stub(IEditorResolverService, editorResolverService);
    disposables.add(editorResolverService);
    return [part, editorResolverService, instantiationService.createInstance(TestServiceAccessor)];
  }
  function constructDisposableFileEditorInput(uri, typeId, store) {
    const editor = new TestFileEditorInput(uri, typeId);
    store.add(editor);
    return editor;
  }
  test("Simple Resolve", async () => {
    const [part, service] = await createEditorResolverService();
    const registeredEditor = service.registerEditor(
      "*.test",
      {
        id: "TEST_EDITOR",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) })
      }
    );
    const resultingResolution = await service.resolveEditor({ resource: URI.file("my://resource-basics.test") }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, TEST_EDITOR_INPUT_ID);
      resultingResolution.editor.dispose();
    }
    registeredEditor.dispose();
  });
  test("Untitled Resolve", async () => {
    const UNTITLED_TEST_EDITOR_INPUT_ID = "UNTITLED_TEST_INPUT";
    const [part, service] = await createEditorResolverService();
    const registeredEditor = service.registerEditor(
      "*.test",
      {
        id: "TEST_EDITOR",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) }),
        createUntitledEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(resource ? resource : URI.from({ scheme: Schemas.untitled }), UNTITLED_TEST_EDITOR_INPUT_ID) })
      }
    );
    let resultingResolution = await service.resolveEditor({ resource: void 0 }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.strictEqual(typeof resultingResolution, "number");
    resultingResolution = await service.resolveEditor({ resource: URI.from({ scheme: Schemas.untitled, path: "foo.test" }) }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, UNTITLED_TEST_EDITOR_INPUT_ID);
      resultingResolution.editor.dispose();
    }
    resultingResolution = await service.resolveEditor({ resource: URI.file("/fake.test"), forceUntitled: true }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, UNTITLED_TEST_EDITOR_INPUT_ID);
      resultingResolution.editor.dispose();
    }
    registeredEditor.dispose();
  });
  test("Side by side Resolve", async () => {
    const [part, service] = await createEditorResolverService();
    const registeredEditorPrimary = service.registerEditor(
      "*.test-primary",
      {
        id: "TEST_EDITOR_PRIMARY",
        label: "Test Editor Label Primary",
        detail: "Test Editor Details Primary",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: constructDisposableFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID, disposables) })
      }
    );
    const registeredEditorSecondary = service.registerEditor(
      "*.test-secondary",
      {
        id: "TEST_EDITOR_SECONDARY",
        label: "Test Editor Label Secondary",
        detail: "Test Editor Details Secondary",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: constructDisposableFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID, disposables) })
      }
    );
    const resultingResolution = await service.resolveEditor({
      primary: { resource: URI.file("my://resource-basics.test-primary") },
      secondary: { resource: URI.file("my://resource-basics.test-secondary") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editorinputs.sidebysideEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    registeredEditorPrimary.dispose();
    registeredEditorSecondary.dispose();
  });
  test("Diff editor Resolve", async () => {
    const [part, service, accessor] = await createEditorResolverService();
    const registeredEditor = service.registerEditor(
      "*.test-diff",
      {
        id: "TEST_EDITOR",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: constructDisposableFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID, disposables) }),
        createDiffEditorInput: ({ modified, original, options }, group) => ({
          editor: accessor.instantiationService.createInstance(
            DiffEditorInput,
            "name",
            "description",
            constructDisposableFileEditorInput(URI.parse(original.toString()), TEST_EDITOR_INPUT_ID, disposables),
            constructDisposableFileEditorInput(URI.parse(modified.toString()), TEST_EDITOR_INPUT_ID, disposables),
            void 0
          )
        })
      }
    );
    const resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-diff") },
      modified: { resource: URI.file("my://resource-basics.test-diff") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    registeredEditor.dispose();
  });
  test("Diff editor Resolve - Different Types", async () => {
    const [part, service, accessor] = await createEditorResolverService();
    let diffOneCounter = 0;
    let diffTwoCounter = 0;
    let defaultDiffCounter = 0;
    const registeredEditor = service.registerEditor(
      "*.test-diff",
      {
        id: "TEST_EDITOR",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: constructDisposableFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID, disposables) }),
        createDiffEditorInput: ({ modified, original, options }, group) => {
          diffOneCounter++;
          return {
            editor: accessor.instantiationService.createInstance(
              DiffEditorInput,
              "name",
              "description",
              constructDisposableFileEditorInput(URI.parse(original.toString()), TEST_EDITOR_INPUT_ID, disposables),
              constructDisposableFileEditorInput(URI.parse(modified.toString()), TEST_EDITOR_INPUT_ID, disposables),
              void 0
            )
          };
        }
      }
    );
    const secondRegisteredEditor = service.registerEditor(
      "*.test-secondDiff",
      {
        id: "TEST_EDITOR_2",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) }),
        createDiffEditorInput: ({ modified, original, options }, group) => {
          diffTwoCounter++;
          return {
            editor: accessor.instantiationService.createInstance(
              DiffEditorInput,
              "name",
              "description",
              constructDisposableFileEditorInput(URI.parse(original.toString()), TEST_EDITOR_INPUT_ID, disposables),
              constructDisposableFileEditorInput(URI.parse(modified.toString()), TEST_EDITOR_INPUT_ID, disposables),
              void 0
            )
          };
        }
      }
    );
    const defaultRegisteredEditor = service.registerEditor(
      "*",
      {
        id: "default",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.option
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) }),
        createDiffEditorInput: ({ modified, original, options }, group) => {
          defaultDiffCounter++;
          return {
            editor: accessor.instantiationService.createInstance(
              DiffEditorInput,
              "name",
              "description",
              constructDisposableFileEditorInput(URI.parse(original.toString()), TEST_EDITOR_INPUT_ID, disposables),
              constructDisposableFileEditorInput(URI.parse(modified.toString()), TEST_EDITOR_INPUT_ID, disposables),
              void 0
            )
          };
        }
      }
    );
    let resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-diff") },
      modified: { resource: URI.file("my://resource-basics.test-diff") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(diffOneCounter, 1);
      assert.strictEqual(diffTwoCounter, 0);
      assert.strictEqual(defaultDiffCounter, 0);
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-secondDiff") },
      modified: { resource: URI.file("my://resource-basics.test-secondDiff") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(diffOneCounter, 1);
      assert.strictEqual(diffTwoCounter, 1);
      assert.strictEqual(defaultDiffCounter, 0);
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-secondDiff") },
      modified: { resource: URI.file("my://resource-basics.test-diff") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(diffOneCounter, 1);
      assert.strictEqual(diffTwoCounter, 1);
      assert.strictEqual(defaultDiffCounter, 1);
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-diff") },
      modified: { resource: URI.file("my://resource-basics.test-secondDiff") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(diffOneCounter, 1);
      assert.strictEqual(diffTwoCounter, 1);
      assert.strictEqual(defaultDiffCounter, 2);
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test-secondDiff") },
      modified: { resource: URI.file("my://resource-basics.test-diff") },
      options: { override: "TEST_EDITOR" }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(diffOneCounter, 2);
      assert.strictEqual(diffTwoCounter, 1);
      assert.strictEqual(defaultDiffCounter, 2);
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    registeredEditor.dispose();
    secondRegisteredEditor.dispose();
    defaultRegisteredEditor.dispose();
  });
  test("Registry & Events", async () => {
    const [, service] = await createEditorResolverService();
    let eventCounter = 0;
    disposables.add(service.onDidChangeEditorRegistrations(() => {
      eventCounter++;
    }));
    const editors = service.getEditors();
    const registeredEditor = service.registerEditor(
      "*.test",
      {
        id: "TEST_EDITOR",
        label: "Test Editor Label",
        detail: "Test Editor Details",
        priority: RegisteredEditorPriority.default
      },
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) })
      }
    );
    assert.strictEqual(eventCounter, 1);
    assert.strictEqual(service.getEditors().length, editors.length + 1);
    assert.strictEqual(service.getEditors().some((editor) => editor.id === "TEST_EDITOR"), true);
    registeredEditor.dispose();
    assert.strictEqual(eventCounter, 2);
    assert.strictEqual(service.getEditors().length, editors.length);
    assert.strictEqual(service.getEditors().some((editor) => editor.id === "TEST_EDITOR"), false);
  });
  test("Multiple registrations to same glob and id #155859", async () => {
    const [part, service, accessor] = await createEditorResolverService();
    const testEditorInfo = {
      id: "TEST_EDITOR",
      label: "Test Editor Label",
      detail: "Test Editor Details",
      priority: RegisteredEditorPriority.default
    };
    const registeredSingleEditor = service.registerEditor(
      "*.test",
      testEditorInfo,
      {},
      {
        createEditorInput: ({ resource, options }, group) => ({ editor: new TestFileEditorInput(URI.parse(resource.toString()), TEST_EDITOR_INPUT_ID) })
      }
    );
    const registeredDiffEditor = service.registerEditor(
      "*.test",
      testEditorInfo,
      {},
      {
        createDiffEditorInput: ({ modified, original, options }, group) => ({
          editor: accessor.instantiationService.createInstance(
            DiffEditorInput,
            "name",
            "description",
            constructDisposableFileEditorInput(URI.parse(original.toString()), TEST_EDITOR_INPUT_ID, disposables),
            constructDisposableFileEditorInput(URI.parse(modified.toString()), TEST_EDITOR_INPUT_ID, disposables),
            void 0
          )
        })
      }
    );
    let resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test") },
      modified: { resource: URI.file("my://resource-basics.test") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.notStrictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.ABORT && resultingResolution !== ResolvedStatus.NONE) {
      assert.strictEqual(resultingResolution.editor.typeId, "workbench.editors.diffEditorInput");
      resultingResolution.editor.dispose();
    } else {
      assert.fail();
    }
    registeredDiffEditor.dispose();
    resultingResolution = await service.resolveEditor({
      original: { resource: URI.file("my://resource-basics.test") },
      modified: { resource: URI.file("my://resource-basics.test") }
    }, part.activeGroup);
    assert.ok(resultingResolution);
    assert.strictEqual(typeof resultingResolution, "number");
    if (resultingResolution !== ResolvedStatus.NONE) {
      assert.fail();
    }
    registeredSingleEditor.dispose();
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZWRpdG9yL3Rlc3QvYnJvd3Nlci9lZGl0b3JSZXNvbHZlclNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JQYXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9wYXJ0cy9lZGl0b3IvZWRpdG9yUGFydC5qcyc7XG5pbXBvcnQgeyBEaWZmRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZWRpdG9yL2RpZmZFZGl0b3JJbnB1dC5qcyc7XG5pbXBvcnQgeyBFZGl0b3JSZXNvbHZlclNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2VkaXRvclJlc29sdmVyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JSZXNvbHZlclNlcnZpY2UsIFJlc29sdmVkU3RhdHVzLCBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkgfSBmcm9tICcuLi8uLi9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNyZWF0ZUVkaXRvclBhcnQsIElUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UsIFRlc3RGaWxlRWRpdG9ySW5wdXQsIFRlc3RTZXJ2aWNlQWNjZXNzb3IsIHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdFZGl0b3JSZXNvbHZlclNlcnZpY2UnLCAoKSA9PiB7XG5cblx0Y29uc3QgVEVTVF9FRElUT1JfSU5QVVRfSUQgPSAndGVzdEVkaXRvcklucHV0Rm9yRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlJztcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0dGVhcmRvd24oKCkgPT4gZGlzcG9zYWJsZXMuY2xlYXIoKSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UodW5kZWZpbmVkLCBkaXNwb3NhYmxlcykpOiBQcm9taXNlPFtFZGl0b3JQYXJ0LCBFZGl0b3JSZXNvbHZlclNlcnZpY2UsIFRlc3RTZXJ2aWNlQWNjZXNzb3JdPiB7XG5cdFx0Y29uc3QgcGFydCA9IGF3YWl0IGNyZWF0ZUVkaXRvclBhcnQoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRpc3Bvc2FibGVzKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JHcm91cHNTZXJ2aWNlLCBwYXJ0KTtcblxuXHRcdGNvbnN0IGVkaXRvclJlc29sdmVyU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclJlc29sdmVyU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLCBlZGl0b3JSZXNvbHZlclNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChlZGl0b3JSZXNvbHZlclNlcnZpY2UpO1xuXG5cdFx0cmV0dXJuIFtwYXJ0LCBlZGl0b3JSZXNvbHZlclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTZXJ2aWNlQWNjZXNzb3IpXTtcblx0fVxuXG5cdGZ1bmN0aW9uIGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQodXJpOiBVUkksIHR5cGVJZDogc3RyaW5nLCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlKTogVGVzdEZpbGVFZGl0b3JJbnB1dCB7XG5cdFx0Y29uc3QgZWRpdG9yID0gbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQodXJpLCB0eXBlSWQpO1xuXHRcdHN0b3JlLmFkZChlZGl0b3IpO1xuXHRcdHJldHVybiBlZGl0b3I7XG5cdH1cblxuXHR0ZXN0KCdTaW1wbGUgUmVzb2x2ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JSZXNvbHZlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZWdpc3RlcmVkRWRpdG9yID0gc2VydmljZS5yZWdpc3RlckVkaXRvcignKi50ZXN0Jyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdURVNUX0VESVRPUicsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3IgTGFiZWwnLFxuXHRcdFx0XHRkZXRhaWw6ICdUZXN0IEVkaXRvciBEZXRhaWxzJyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5kZWZhdWx0XG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoeyByZXNvdXJjZSwgb3B0aW9ucyB9LCBncm91cCkgPT4gKHsgZWRpdG9yOiBuZXcgVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UocmVzb3VyY2UudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSB9KSxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVzdWx0aW5nUmVzb2x1dGlvbiA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUVkaXRvcih7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdCcpIH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLnR5cGVJZCwgVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0cmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdH1cblx0XHRyZWdpc3RlcmVkRWRpdG9yLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnVW50aXRsZWQgUmVzb2x2ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBVTlRJVExFRF9URVNUX0VESVRPUl9JTlBVVF9JRCA9ICdVTlRJVExFRF9URVNUX0lOUFVUJztcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JSZXNvbHZlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZWdpc3RlcmVkRWRpdG9yID0gc2VydmljZS5yZWdpc3RlckVkaXRvcignKi50ZXN0Jyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdURVNUX0VESVRPUicsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3IgTGFiZWwnLFxuXHRcdFx0XHRkZXRhaWw6ICdUZXN0IEVkaXRvciBEZXRhaWxzJyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5kZWZhdWx0XG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoeyByZXNvdXJjZSwgb3B0aW9ucyB9LCBncm91cCkgPT4gKHsgZWRpdG9yOiBuZXcgVGVzdEZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UocmVzb3VyY2UudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lEKSB9KSxcblx0XHRcdFx0Y3JlYXRlVW50aXRsZWRFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UsIG9wdGlvbnMgfSwgZ3JvdXApID0+ICh7IGVkaXRvcjogbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoKHJlc291cmNlID8gcmVzb3VyY2UgOiBVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy51bnRpdGxlZCB9KSksIFVOVElUTEVEX1RFU1RfRURJVE9SX0lOUFVUX0lEKSB9KSxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Ly8gVW50eXBlZCB1bnRpdGxlZCAtIG5vIHJlc291cmNlXG5cdFx0bGV0IHJlc3VsdGluZ1Jlc29sdXRpb24gPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmVFZGl0b3IoeyByZXNvdXJjZTogdW5kZWZpbmVkIH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHQvLyBXZSBkb24ndCBleHBlY3QgdW50aXRsZWQgdG8gbWF0Y2ggdGhlICoudGVzdCBnbG9iXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVvZiByZXN1bHRpbmdSZXNvbHV0aW9uLCAnbnVtYmVyJyk7XG5cblx0XHQvLyBVbnR5cGVkIHVudGl0bGVkIC0gd2l0aCB1bnRpdGxlZCByZXNvdXJjZVxuXHRcdHJlc3VsdGluZ1Jlc29sdXRpb24gPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmVFZGl0b3IoeyByZXNvdXJjZTogVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQsIHBhdGg6ICdmb28udGVzdCcgfSkgfSwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdGluZ1Jlc29sdXRpb24pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0eXBlb2YgcmVzdWx0aW5nUmVzb2x1dGlvbiwgJ251bWJlcicpO1xuXHRcdGlmIChyZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5BQk9SVCAmJiByZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5OT05FKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IudHlwZUlkLCBVTlRJVExFRF9URVNUX0VESVRPUl9JTlBVVF9JRCk7XG5cdFx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0Ly8gVW50eXBlZCB1bnRpdGxlZCAtIGZpbGUgcmVzb3VyY2Ugd2l0aCBmb3JjZVVudGl0bGVkXG5cdFx0cmVzdWx0aW5nUmVzb2x1dGlvbiA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUVkaXRvcih7IHJlc291cmNlOiBVUkkuZmlsZSgnL2Zha2UudGVzdCcpLCBmb3JjZVVudGl0bGVkOiB0cnVlIH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLnR5cGVJZCwgVU5USVRMRURfVEVTVF9FRElUT1JfSU5QVVRfSUQpO1xuXHRcdFx0cmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdHJlZ2lzdGVyZWRFZGl0b3IuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdTaWRlIGJ5IHNpZGUgUmVzb2x2ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZV0gPSBhd2FpdCBjcmVhdGVFZGl0b3JSZXNvbHZlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZWdpc3RlcmVkRWRpdG9yUHJpbWFyeSA9IHNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoJyoudGVzdC1wcmltYXJ5Jyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdURVNUX0VESVRPUl9QUklNQVJZJyxcblx0XHRcdFx0bGFiZWw6ICdUZXN0IEVkaXRvciBMYWJlbCBQcmltYXJ5Jyxcblx0XHRcdFx0ZGV0YWlsOiAnVGVzdCBFZGl0b3IgRGV0YWlscyBQcmltYXJ5Jyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5kZWZhdWx0XG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoeyByZXNvdXJjZSwgb3B0aW9ucyB9LCBncm91cCkgPT4gKHsgZWRpdG9yOiBjb25zdHJ1Y3REaXNwb3NhYmxlRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShyZXNvdXJjZS50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQsIGRpc3Bvc2FibGVzKSB9KSxcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVnaXN0ZXJlZEVkaXRvclNlY29uZGFyeSA9IHNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoJyoudGVzdC1zZWNvbmRhcnknLFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ1RFU1RfRURJVE9SX1NFQ09OREFSWScsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3IgTGFiZWwgU2Vjb25kYXJ5Jyxcblx0XHRcdFx0ZGV0YWlsOiAnVGVzdCBFZGl0b3IgRGV0YWlscyBTZWNvbmRhcnknLFxuXHRcdFx0XHRwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmRlZmF1bHRcblx0XHRcdH0sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0sIGdyb3VwKSA9PiAoeyBlZGl0b3I6IGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHJlc291cmNlLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCwgZGlzcG9zYWJsZXMpIH0pLFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRjb25zdCByZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdHByaW1hcnk6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdteTovL3Jlc291cmNlLWJhc2ljcy50ZXN0LXByaW1hcnknKSB9LFxuXHRcdFx0c2Vjb25kYXJ5OiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmRhcnknKSB9XG5cdFx0fSwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdGluZ1Jlc29sdXRpb24pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0eXBlb2YgcmVzdWx0aW5nUmVzb2x1dGlvbiwgJ251bWJlcicpO1xuXHRcdGlmIChyZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5BQk9SVCAmJiByZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5OT05FKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IudHlwZUlkLCAnd29ya2JlbmNoLmVkaXRvcmlucHV0cy5zaWRlYnlzaWRlRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cdFx0cmVnaXN0ZXJlZEVkaXRvclByaW1hcnkuZGlzcG9zZSgpO1xuXHRcdHJlZ2lzdGVyZWRFZGl0b3JTZWNvbmRhcnkuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIGVkaXRvciBSZXNvbHZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JSZXNvbHZlclNlcnZpY2UoKTtcblx0XHRjb25zdCByZWdpc3RlcmVkRWRpdG9yID0gc2VydmljZS5yZWdpc3RlckVkaXRvcignKi50ZXN0LWRpZmYnLFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ1RFU1RfRURJVE9SJyxcblx0XHRcdFx0bGFiZWw6ICdUZXN0IEVkaXRvciBMYWJlbCcsXG5cdFx0XHRcdGRldGFpbDogJ1Rlc3QgRWRpdG9yIERldGFpbHMnLFxuXHRcdFx0XHRwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmRlZmF1bHRcblx0XHRcdH0sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0sIGdyb3VwKSA9PiAoeyBlZGl0b3I6IGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHJlc291cmNlLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCwgZGlzcG9zYWJsZXMpIH0pLFxuXHRcdFx0XHRjcmVhdGVEaWZmRWRpdG9ySW5wdXQ6ICh7IG1vZGlmaWVkLCBvcmlnaW5hbCwgb3B0aW9ucyB9LCBncm91cCkgPT4gKHtcblx0XHRcdFx0XHRlZGl0b3I6IGFjY2Vzc29yLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdFx0RGlmZkVkaXRvcklucHV0LFxuXHRcdFx0XHRcdFx0J25hbWUnLFxuXHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJyxcblx0XHRcdFx0XHRcdGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKG9yaWdpbmFsLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCwgZGlzcG9zYWJsZXMpLFxuXHRcdFx0XHRcdFx0Y29uc3RydWN0RGlzcG9zYWJsZUZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UobW9kaWZpZWQudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lELCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0XHR1bmRlZmluZWQpXG5cdFx0XHRcdH0pXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGNvbnN0IHJlc3VsdGluZ1Jlc29sdXRpb24gPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmVFZGl0b3Ioe1xuXHRcdFx0b3JpZ2luYWw6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdteTovL3Jlc291cmNlLWJhc2ljcy50ZXN0LWRpZmYnKSB9LFxuXHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdteTovL3Jlc291cmNlLWJhc2ljcy50ZXN0LWRpZmYnKSB9XG5cdFx0fSwgcGFydC5hY3RpdmVHcm91cCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdGluZ1Jlc29sdXRpb24pO1xuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0eXBlb2YgcmVzdWx0aW5nUmVzb2x1dGlvbiwgJ251bWJlcicpO1xuXHRcdGlmIChyZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5BQk9SVCAmJiByZXN1bHRpbmdSZXNvbHV0aW9uICE9PSBSZXNvbHZlZFN0YXR1cy5OT05FKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IudHlwZUlkLCAnd29ya2JlbmNoLmVkaXRvcnMuZGlmZkVkaXRvcklucHV0Jyk7XG5cdFx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci5kaXNwb3NlKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5mYWlsKCk7XG5cdFx0fVxuXHRcdHJlZ2lzdGVyZWRFZGl0b3IuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaWZmIGVkaXRvciBSZXNvbHZlIC0gRGlmZmVyZW50IFR5cGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFtwYXJ0LCBzZXJ2aWNlLCBhY2Nlc3Nvcl0gPSBhd2FpdCBjcmVhdGVFZGl0b3JSZXNvbHZlclNlcnZpY2UoKTtcblx0XHRsZXQgZGlmZk9uZUNvdW50ZXIgPSAwO1xuXHRcdGxldCBkaWZmVHdvQ291bnRlciA9IDA7XG5cdFx0bGV0IGRlZmF1bHREaWZmQ291bnRlciA9IDA7XG5cdFx0Y29uc3QgcmVnaXN0ZXJlZEVkaXRvciA9IHNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoJyoudGVzdC1kaWZmJyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdURVNUX0VESVRPUicsXG5cdFx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3IgTGFiZWwnLFxuXHRcdFx0XHRkZXRhaWw6ICdUZXN0IEVkaXRvciBEZXRhaWxzJyxcblx0XHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5kZWZhdWx0XG5cdFx0XHR9LFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZUVkaXRvcklucHV0OiAoeyByZXNvdXJjZSwgb3B0aW9ucyB9LCBncm91cCkgPT4gKHsgZWRpdG9yOiBjb25zdHJ1Y3REaXNwb3NhYmxlRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShyZXNvdXJjZS50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQsIGRpc3Bvc2FibGVzKSB9KSxcblx0XHRcdFx0Y3JlYXRlRGlmZkVkaXRvcklucHV0OiAoeyBtb2RpZmllZCwgb3JpZ2luYWwsIG9wdGlvbnMgfSwgZ3JvdXApID0+IHtcblx0XHRcdFx0XHRkaWZmT25lQ291bnRlcisrO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRlZGl0b3I6IGFjY2Vzc29yLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFxuXHRcdFx0XHRcdFx0XHREaWZmRWRpdG9ySW5wdXQsXG5cdFx0XHRcdFx0XHRcdCduYW1lJyxcblx0XHRcdFx0XHRcdFx0J2Rlc2NyaXB0aW9uJyxcblx0XHRcdFx0XHRcdFx0Y29uc3RydWN0RGlzcG9zYWJsZUZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2Uob3JpZ2luYWwudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lELCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0XHRcdGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKG1vZGlmaWVkLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCwgZGlzcG9zYWJsZXMpLFxuXHRcdFx0XHRcdFx0XHR1bmRlZmluZWQpXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHRjb25zdCBzZWNvbmRSZWdpc3RlcmVkRWRpdG9yID0gc2VydmljZS5yZWdpc3RlckVkaXRvcignKi50ZXN0LXNlY29uZERpZmYnLFxuXHRcdFx0e1xuXHRcdFx0XHRpZDogJ1RFU1RfRURJVE9SXzInLFxuXHRcdFx0XHRsYWJlbDogJ1Rlc3QgRWRpdG9yIExhYmVsJyxcblx0XHRcdFx0ZGV0YWlsOiAnVGVzdCBFZGl0b3IgRGV0YWlscycsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZGVmYXVsdFxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UsIG9wdGlvbnMgfSwgZ3JvdXApID0+ICh7IGVkaXRvcjogbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHJlc291cmNlLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfSksXG5cdFx0XHRcdGNyZWF0ZURpZmZFZGl0b3JJbnB1dDogKHsgbW9kaWZpZWQsIG9yaWdpbmFsLCBvcHRpb25zIH0sIGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0ZGlmZlR3b0NvdW50ZXIrKztcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0ZWRpdG9yOiBhY2Nlc3Nvci5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdFx0XHRcdFx0RGlmZkVkaXRvcklucHV0LFxuXHRcdFx0XHRcdFx0XHQnbmFtZScsXG5cdFx0XHRcdFx0XHRcdCdkZXNjcmlwdGlvbicsXG5cdFx0XHRcdFx0XHRcdGNvbnN0cnVjdERpc3Bvc2FibGVGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKG9yaWdpbmFsLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCwgZGlzcG9zYWJsZXMpLFxuXHRcdFx0XHRcdFx0XHRjb25zdHJ1Y3REaXNwb3NhYmxlRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShtb2RpZmllZC50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQsIGRpc3Bvc2FibGVzKSxcblx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Y29uc3QgZGVmYXVsdFJlZ2lzdGVyZWRFZGl0b3IgPSBzZXJ2aWNlLnJlZ2lzdGVyRWRpdG9yKCcqJyxcblx0XHRcdHtcblx0XHRcdFx0aWQ6ICdkZWZhdWx0Jyxcblx0XHRcdFx0bGFiZWw6ICdUZXN0IEVkaXRvciBMYWJlbCcsXG5cdFx0XHRcdGRldGFpbDogJ1Rlc3QgRWRpdG9yIERldGFpbHMnLFxuXHRcdFx0XHRwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5Lm9wdGlvblxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UsIG9wdGlvbnMgfSwgZ3JvdXApID0+ICh7IGVkaXRvcjogbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHJlc291cmNlLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfSksXG5cdFx0XHRcdGNyZWF0ZURpZmZFZGl0b3JJbnB1dDogKHsgbW9kaWZpZWQsIG9yaWdpbmFsLCBvcHRpb25zIH0sIGdyb3VwKSA9PiB7XG5cdFx0XHRcdFx0ZGVmYXVsdERpZmZDb3VudGVyKys7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVkaXRvcjogYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFx0XHRcdERpZmZFZGl0b3JJbnB1dCxcblx0XHRcdFx0XHRcdFx0J25hbWUnLFxuXHRcdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRcdFx0XHRjb25zdHJ1Y3REaXNwb3NhYmxlRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShvcmlnaW5hbC50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQsIGRpc3Bvc2FibGVzKSxcblx0XHRcdFx0XHRcdFx0Y29uc3RydWN0RGlzcG9zYWJsZUZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2UobW9kaWZpZWQudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lELCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZClcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGxldCByZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1kaWZmJykgfSxcblx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1kaWZmJykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZPbmVDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmVHdvQ291bnRlciwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmYXVsdERpZmZDb3VudGVyLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci50eXBlSWQsICd3b3JrYmVuY2guZWRpdG9ycy5kaWZmRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmREaWZmJykgfSxcblx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmREaWZmJykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZPbmVDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmVHdvQ291bnRlciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmYXVsdERpZmZDb3VudGVyLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci50eXBlSWQsICd3b3JrYmVuY2guZWRpdG9ycy5kaWZmRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmREaWZmJykgfSxcblx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1kaWZmJykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZPbmVDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmVHdvQ291bnRlciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmYXVsdERpZmZDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci50eXBlSWQsICd3b3JrYmVuY2guZWRpdG9ycy5kaWZmRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1kaWZmJykgfSxcblx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmREaWZmJykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZPbmVDb3VudGVyLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmVHdvQ291bnRlciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmYXVsdERpZmZDb3VudGVyLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci50eXBlSWQsICd3b3JrYmVuY2guZWRpdG9ycy5kaWZmRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZXN1bHRpbmdSZXNvbHV0aW9uID0gYXdhaXQgc2VydmljZS5yZXNvbHZlRWRpdG9yKHtcblx0XHRcdG9yaWdpbmFsOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1zZWNvbmREaWZmJykgfSxcblx0XHRcdG1vZGlmaWVkOiB7IHJlc291cmNlOiBVUkkuZmlsZSgnbXk6Ly9yZXNvdXJjZS1iYXNpY3MudGVzdC1kaWZmJykgfSxcblx0XHRcdG9wdGlvbnM6IHsgb3ZlcnJpZGU6ICdURVNUX0VESVRPUicgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZmZPbmVDb3VudGVyLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWZmVHdvQ291bnRlciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVmYXVsdERpZmZDb3VudGVyLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRpbmdSZXNvbHV0aW9uLmVkaXRvci50eXBlSWQsICd3b3JrYmVuY2guZWRpdG9ycy5kaWZmRWRpdG9ySW5wdXQnKTtcblx0XHRcdHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLmRpc3Bvc2UoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZWdpc3RlcmVkRWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRzZWNvbmRSZWdpc3RlcmVkRWRpdG9yLmRpc3Bvc2UoKTtcblx0XHRkZWZhdWx0UmVnaXN0ZXJlZEVkaXRvci5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlZ2lzdHJ5ICYgRXZlbnRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IFssIHNlcnZpY2VdID0gYXdhaXQgY3JlYXRlRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlKCk7XG5cblx0XHRsZXQgZXZlbnRDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5vbkRpZENoYW5nZUVkaXRvclJlZ2lzdHJhdGlvbnMoKCkgPT4ge1xuXHRcdFx0ZXZlbnRDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZWRpdG9ycyA9IHNlcnZpY2UuZ2V0RWRpdG9ycygpO1xuXG5cdFx0Y29uc3QgcmVnaXN0ZXJlZEVkaXRvciA9IHNlcnZpY2UucmVnaXN0ZXJFZGl0b3IoJyoudGVzdCcsXG5cdFx0XHR7XG5cdFx0XHRcdGlkOiAnVEVTVF9FRElUT1InLFxuXHRcdFx0XHRsYWJlbDogJ1Rlc3QgRWRpdG9yIExhYmVsJyxcblx0XHRcdFx0ZGV0YWlsOiAnVGVzdCBFZGl0b3IgRGV0YWlscycsXG5cdFx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZGVmYXVsdFxuXHRcdFx0fSxcblx0XHRcdHt9LFxuXHRcdFx0e1xuXHRcdFx0XHRjcmVhdGVFZGl0b3JJbnB1dDogKHsgcmVzb3VyY2UsIG9wdGlvbnMgfSwgZ3JvdXApID0+ICh7IGVkaXRvcjogbmV3IFRlc3RGaWxlRWRpdG9ySW5wdXQoVVJJLnBhcnNlKHJlc291cmNlLnRvU3RyaW5nKCkpLCBURVNUX0VESVRPUl9JTlBVVF9JRCkgfSlcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50Q291bnRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RWRpdG9ycygpLmxlbmd0aCwgZWRpdG9ycy5sZW5ndGggKyAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5nZXRFZGl0b3JzKCkuc29tZShlZGl0b3IgPT4gZWRpdG9yLmlkID09PSAnVEVTVF9FRElUT1InKSwgdHJ1ZSk7XG5cblx0XHRyZWdpc3RlcmVkRWRpdG9yLmRpc3Bvc2UoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50ZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmdldEVkaXRvcnMoKS5sZW5ndGgsIGVkaXRvcnMubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5nZXRFZGl0b3JzKCkuc29tZShlZGl0b3IgPT4gZWRpdG9yLmlkID09PSAnVEVTVF9FRElUT1InKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSByZWdpc3RyYXRpb25zIHRvIHNhbWUgZ2xvYiBhbmQgaWQgIzE1NTg1OScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBbcGFydCwgc2VydmljZSwgYWNjZXNzb3JdID0gYXdhaXQgY3JlYXRlRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgdGVzdEVkaXRvckluZm8gPSB7XG5cdFx0XHRpZDogJ1RFU1RfRURJVE9SJyxcblx0XHRcdGxhYmVsOiAnVGVzdCBFZGl0b3IgTGFiZWwnLFxuXHRcdFx0ZGV0YWlsOiAnVGVzdCBFZGl0b3IgRGV0YWlscycsXG5cdFx0XHRwcmlvcml0eTogUmVnaXN0ZXJlZEVkaXRvclByaW9yaXR5LmRlZmF1bHRcblx0XHR9O1xuXHRcdGNvbnN0IHJlZ2lzdGVyZWRTaW5nbGVFZGl0b3IgPSBzZXJ2aWNlLnJlZ2lzdGVyRWRpdG9yKCcqLnRlc3QnLFxuXHRcdFx0dGVzdEVkaXRvckluZm8sXG5cdFx0XHR7fSxcblx0XHRcdHtcblx0XHRcdFx0Y3JlYXRlRWRpdG9ySW5wdXQ6ICh7IHJlc291cmNlLCBvcHRpb25zIH0sIGdyb3VwKSA9PiAoeyBlZGl0b3I6IG5ldyBUZXN0RmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShyZXNvdXJjZS50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQpIH0pXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGNvbnN0IHJlZ2lzdGVyZWREaWZmRWRpdG9yID0gc2VydmljZS5yZWdpc3RlckVkaXRvcignKi50ZXN0Jyxcblx0XHRcdHRlc3RFZGl0b3JJbmZvLFxuXHRcdFx0e30sXG5cdFx0XHR7XG5cdFx0XHRcdGNyZWF0ZURpZmZFZGl0b3JJbnB1dDogKHsgbW9kaWZpZWQsIG9yaWdpbmFsLCBvcHRpb25zIH0sIGdyb3VwKSA9PiAoe1xuXHRcdFx0XHRcdGVkaXRvcjogYWNjZXNzb3IuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFx0XHREaWZmRWRpdG9ySW5wdXQsXG5cdFx0XHRcdFx0XHQnbmFtZScsXG5cdFx0XHRcdFx0XHQnZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRcdFx0Y29uc3RydWN0RGlzcG9zYWJsZUZpbGVFZGl0b3JJbnB1dChVUkkucGFyc2Uob3JpZ2luYWwudG9TdHJpbmcoKSksIFRFU1RfRURJVE9SX0lOUFVUX0lELCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0XHRjb25zdHJ1Y3REaXNwb3NhYmxlRmlsZUVkaXRvcklucHV0KFVSSS5wYXJzZShtb2RpZmllZC50b1N0cmluZygpKSwgVEVTVF9FRElUT1JfSU5QVVRfSUQsIGRpc3Bvc2FibGVzKSxcblx0XHRcdFx0XHRcdHVuZGVmaW5lZClcblx0XHRcdFx0fSlcblx0XHRcdH1cblx0XHQpO1xuXG5cdFx0Ly8gUmVzb2x2ZSBhIGRpZmZcblx0XHRsZXQgcmVzdWx0aW5nUmVzb2x1dGlvbiA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUVkaXRvcih7XG5cdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLmZpbGUoJ215Oi8vcmVzb3VyY2UtYmFzaWNzLnRlc3QnKSB9LFxuXHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdteTovL3Jlc291cmNlLWJhc2ljcy50ZXN0JykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuQUJPUlQgJiYgcmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdGluZ1Jlc29sdXRpb24uZWRpdG9yLnR5cGVJZCwgJ3dvcmtiZW5jaC5lZGl0b3JzLmRpZmZFZGl0b3JJbnB1dCcpO1xuXHRcdFx0cmVzdWx0aW5nUmVzb2x1dGlvbi5lZGl0b3IuZGlzcG9zZSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnQuZmFpbCgpO1xuXHRcdH1cblxuXHRcdC8vIFJlbW92ZSBkaWZmIHJlZ2lzdHJhdGlvblxuXHRcdHJlZ2lzdGVyZWREaWZmRWRpdG9yLmRpc3Bvc2UoKTtcblxuXHRcdC8vIFJlc29sdmUgYSBkaWZmIGFnYWluLCBleHBlY3RlZCBmYWlsdXJlXG5cdFx0cmVzdWx0aW5nUmVzb2x1dGlvbiA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUVkaXRvcih7XG5cdFx0XHRvcmlnaW5hbDogeyByZXNvdXJjZTogVVJJLmZpbGUoJ215Oi8vcmVzb3VyY2UtYmFzaWNzLnRlc3QnKSB9LFxuXHRcdFx0bW9kaWZpZWQ6IHsgcmVzb3VyY2U6IFVSSS5maWxlKCdteTovL3Jlc291cmNlLWJhc2ljcy50ZXN0JykgfVxuXHRcdH0sIHBhcnQuYWN0aXZlR3JvdXApO1xuXHRcdGFzc2VydC5vayhyZXN1bHRpbmdSZXNvbHV0aW9uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIHJlc3VsdGluZ1Jlc29sdXRpb24sICdudW1iZXInKTtcblx0XHRpZiAocmVzdWx0aW5nUmVzb2x1dGlvbiAhPT0gUmVzb2x2ZWRTdGF0dXMuTk9ORSkge1xuXHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHR9XG5cblx0XHRyZWdpc3RlcmVkU2luZ2xlRWRpdG9yLmRpc3Bvc2UoKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNB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
