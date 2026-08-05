import assert from "assert";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite, toResource } from "../../../../../base/test/common/utils.js";
import { FileEditorInput } from "../../browser/editors/fileEditorInput.js";
import { workbenchInstantiationService, TestServiceAccessor, getLastResolvedFileStat } from "../../../../test/browser/workbenchTestServices.js";
import { Verbosity, EditorExtensions, EditorInputCapabilities } from "../../../../common/editor.js";
import { EncodingMode, TextFileOperationError, TextFileOperationResult } from "../../../../services/textfile/common/textfiles.js";
import { FileOperationResult, NotModifiedSinceFileOperationError, TooLargeFileOperationError } from "../../../../../platform/files/common/files.js";
import { TextFileEditorModel } from "../../../../services/textfile/common/textFileEditorModel.js";
import { timeout } from "../../../../../base/common/async.js";
import { PLAINTEXT_LANGUAGE_ID } from "../../../../../editor/common/languages/modesRegistry.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { BinaryEditorModel } from "../../../../common/editor/binaryEditorModel.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { FileEditorInputSerializer } from "../../browser/editors/fileEditorHandler.js";
import { InMemoryFileSystemProvider } from "../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { TextEditorService } from "../../../../services/textfile/common/textEditorService.js";
suite("Files - FileEditorInput", () => {
  const disposables = new DisposableStore();
  let instantiationService;
  let accessor;
  function createFileInput(resource, preferredResource, preferredLanguageId, preferredName, preferredDescription, preferredContents) {
    return disposables.add(instantiationService.createInstance(FileEditorInput, resource, preferredResource, preferredName, preferredDescription, void 0, preferredLanguageId, preferredContents));
  }
  class TestTextEditorService extends TextEditorService {
    createTextEditor(input) {
      return createFileInput(input.resource);
    }
    async resolveTextEditor(input) {
      return createFileInput(input.resource);
    }
  }
  setup(() => {
    instantiationService = workbenchInstantiationService({
      textEditorService: (instantiationService2) => instantiationService2.createInstance(TestTextEditorService)
    }, disposables);
    accessor = instantiationService.createInstance(TestServiceAccessor);
  });
  teardown(() => {
    disposables.clear();
  });
  test("Basics", async function() {
    let input = createFileInput(toResource.call(this, "/foo/bar/file.js"));
    const otherInput = createFileInput(toResource.call(this, "foo/bar/otherfile.js"));
    const otherInputSame = createFileInput(toResource.call(this, "foo/bar/file.js"));
    assert(input.matches(input));
    assert(input.matches(otherInputSame));
    assert(!input.matches(otherInput));
    assert.ok(input.getName());
    assert.ok(input.getDescription());
    assert.ok(input.getTitle(Verbosity.SHORT));
    assert.ok(!input.hasCapability(EditorInputCapabilities.Untitled));
    assert.ok(!input.hasCapability(EditorInputCapabilities.Readonly));
    assert.ok(!input.isReadonly());
    assert.ok(!input.hasCapability(EditorInputCapabilities.Singleton));
    assert.ok(!input.hasCapability(EditorInputCapabilities.RequiresTrust));
    const untypedInput = input.toUntyped({ preserveViewState: 0 });
    assert.strictEqual(untypedInput.resource.toString(), input.resource.toString());
    assert.strictEqual("file.js", input.getName());
    assert.strictEqual(toResource.call(this, "/foo/bar/file.js").fsPath, input.resource.fsPath);
    assert(input.resource instanceof URI);
    input = createFileInput(toResource.call(this, "/foo/bar.html"));
    const inputToResolve = createFileInput(toResource.call(this, "/foo/bar/file.js"));
    const sameOtherInput = createFileInput(toResource.call(this, "/foo/bar/file.js"));
    let resolved = await inputToResolve.resolve();
    assert.ok(inputToResolve.isResolved());
    const resolvedModelA = resolved;
    resolved = await inputToResolve.resolve();
    assert(resolvedModelA === resolved);
    try {
      DisposableStore.DISABLE_DISPOSED_WARNING = true;
      const otherResolved = await sameOtherInput.resolve();
      assert(otherResolved === resolvedModelA);
      inputToResolve.dispose();
      resolved = await inputToResolve.resolve();
      assert(resolvedModelA === resolved);
      inputToResolve.dispose();
      sameOtherInput.dispose();
      resolvedModelA.dispose();
      resolved = await inputToResolve.resolve();
      assert(resolvedModelA !== resolved);
      const stat = getLastResolvedFileStat(resolved);
      resolved = await inputToResolve.resolve();
      await timeout(0);
      assert(stat !== getLastResolvedFileStat(resolved));
    } finally {
      DisposableStore.DISABLE_DISPOSED_WARNING = false;
    }
  });
  test("reports as untitled without supported file scheme", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/file.js").with({ scheme: "someTestingScheme" }));
    assert.ok(input.hasCapability(EditorInputCapabilities.Untitled));
    assert.ok(!input.hasCapability(EditorInputCapabilities.Readonly));
    assert.ok(!input.isReadonly());
  });
  test("reports as readonly with readonly file scheme", async function() {
    const inMemoryFilesystemProvider = disposables.add(new InMemoryFileSystemProvider());
    inMemoryFilesystemProvider.setReadOnly(true);
    disposables.add(accessor.fileService.registerProvider("someTestingReadonlyScheme", inMemoryFilesystemProvider));
    const input = createFileInput(toResource.call(this, "/foo/bar/file.js").with({ scheme: "someTestingReadonlyScheme" }));
    assert.ok(!input.hasCapability(EditorInputCapabilities.Untitled));
    assert.ok(input.hasCapability(EditorInputCapabilities.Readonly));
    assert.ok(input.isReadonly());
  });
  test("preferred resource", function() {
    const resource = toResource.call(this, "/foo/bar/updatefile.js");
    const preferredResource = toResource.call(this, "/foo/bar/UPDATEFILE.js");
    const inputWithoutPreferredResource = createFileInput(resource);
    assert.strictEqual(inputWithoutPreferredResource.resource.toString(), resource.toString());
    assert.strictEqual(inputWithoutPreferredResource.preferredResource.toString(), resource.toString());
    const inputWithPreferredResource = createFileInput(resource, preferredResource);
    assert.strictEqual(inputWithPreferredResource.resource.toString(), resource.toString());
    assert.strictEqual(inputWithPreferredResource.preferredResource.toString(), preferredResource.toString());
    let didChangeLabel = false;
    disposables.add(inputWithPreferredResource.onDidChangeLabel((e) => {
      didChangeLabel = true;
    }));
    assert.strictEqual(inputWithPreferredResource.getName(), "UPDATEFILE.js");
    const otherPreferredResource = toResource.call(this, "/FOO/BAR/updateFILE.js");
    inputWithPreferredResource.setPreferredResource(otherPreferredResource);
    assert.strictEqual(inputWithPreferredResource.resource.toString(), resource.toString());
    assert.strictEqual(inputWithPreferredResource.preferredResource.toString(), otherPreferredResource.toString());
    assert.strictEqual(inputWithPreferredResource.getName(), "updateFILE.js");
    assert.strictEqual(didChangeLabel, true);
  });
  test("preferred language", async function() {
    const languageId = "file-input-test";
    disposables.add(accessor.languageService.registerLanguage({
      id: languageId
    }));
    const input = createFileInput(toResource.call(this, "/foo/bar/file.js"), void 0, languageId);
    assert.strictEqual(input.getPreferredLanguageId(), languageId);
    const model = disposables.add(await input.resolve());
    assert.strictEqual(model.textEditorModel.getLanguageId(), languageId);
    input.setLanguageId("text");
    assert.strictEqual(input.getPreferredLanguageId(), "text");
    assert.strictEqual(model.textEditorModel.getLanguageId(), PLAINTEXT_LANGUAGE_ID);
    const input2 = createFileInput(toResource.call(this, "/foo/bar/file.js"));
    input2.setPreferredLanguageId(languageId);
    const model2 = disposables.add(await input2.resolve());
    assert.strictEqual(model2.textEditorModel.getLanguageId(), languageId);
  });
  test("preferred contents", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/file.js"), void 0, void 0, void 0, void 0, "My contents");
    const model = disposables.add(await input.resolve());
    assert.strictEqual(model.textEditorModel.getValue(), "My contents");
    assert.strictEqual(input.isDirty(), true);
    const untypedInput = input.toUntyped({ preserveViewState: 0 });
    assert.strictEqual(untypedInput.contents, "My contents");
    const untypedInputWithoutContents = input.toUntyped();
    assert.strictEqual(untypedInputWithoutContents.contents, void 0);
    input.setPreferredContents("Other contents");
    await input.resolve();
    assert.strictEqual(model.textEditorModel.getValue(), "Other contents");
    model.textEditorModel?.setValue("Changed contents");
    await input.resolve();
    assert.strictEqual(model.textEditorModel.getValue(), "Changed contents");
    const input2 = createFileInput(toResource.call(this, "/foo/bar/file.js"));
    input2.setPreferredContents("My contents");
    const model2 = await input2.resolve();
    assert.strictEqual(model2.textEditorModel.getValue(), "My contents");
    assert.strictEqual(input2.isDirty(), true);
  });
  test("matches", function() {
    const input1 = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    const input2 = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    const input3 = createFileInput(toResource.call(this, "/foo/bar/other.js"));
    const input2Upper = createFileInput(toResource.call(this, "/foo/bar/UPDATEFILE.js"));
    assert.strictEqual(input1.matches(input1), true);
    assert.strictEqual(input1.matches(input2), true);
    assert.strictEqual(input1.matches(input3), false);
    assert.strictEqual(input1.matches(input2Upper), false);
  });
  test("getEncoding/setEncoding", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    await input.setEncoding("utf16", EncodingMode.Encode);
    assert.strictEqual(input.getEncoding(), "utf16");
    const resolved = disposables.add(await input.resolve());
    assert.strictEqual(input.getEncoding(), resolved.getEncoding());
  });
  test("save", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    const resolved = disposables.add(await input.resolve());
    resolved.textEditorModel.setValue("changed");
    assert.ok(input.isDirty());
    assert.ok(input.isModified());
    await input.save(0);
    assert.ok(!input.isDirty());
    assert.ok(!input.isModified());
  });
  test("revert", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    const resolved = disposables.add(await input.resolve());
    resolved.textEditorModel.setValue("changed");
    assert.ok(input.isDirty());
    assert.ok(input.isModified());
    await input.revert(0);
    assert.ok(!input.isDirty());
    assert.ok(!input.isModified());
    input.dispose();
    assert.ok(input.isDisposed());
  });
  test("resolve handles binary files", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    accessor.textFileService.setReadStreamErrorOnce(new TextFileOperationError("error", TextFileOperationResult.FILE_IS_BINARY));
    const resolved = disposables.add(await input.resolve());
    assert.ok(resolved);
  });
  test("resolve throws for too large files", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    let e = void 0;
    accessor.textFileService.setReadStreamErrorOnce(new TooLargeFileOperationError("error", FileOperationResult.FILE_TOO_LARGE, 1e3));
    try {
      await input.resolve();
    } catch (error) {
      e = error;
    }
    assert.ok(e);
  });
  test("attaches to model when created and reports dirty", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    let listenerCount = 0;
    disposables.add(input.onDidChangeDirty(() => {
      listenerCount++;
    }));
    const model = disposables.add(await accessor.textFileService.files.resolve(input.resource));
    model.textEditorModel?.setValue("hello world");
    assert.strictEqual(listenerCount, 1);
    assert.ok(input.isDirty());
  });
  test("force open text/binary", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    input.setForceOpenAsBinary();
    let resolved = disposables.add(await input.resolve());
    assert.ok(resolved instanceof BinaryEditorModel);
    input.setForceOpenAsText();
    resolved = disposables.add(await input.resolve());
    assert.ok(resolved instanceof TextFileEditorModel);
  });
  test("file editor serializer", async function() {
    instantiationService.invokeFunction((accessor2) => Registry.as(EditorExtensions.EditorFactory).start(accessor2));
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    disposables.add(Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer("workbench.editors.files.fileEditorInput", FileEditorInputSerializer));
    const editorSerializer = Registry.as(EditorExtensions.EditorFactory).getEditorSerializer(input.typeId);
    if (!editorSerializer) {
      assert.fail("File Editor Input Serializer missing");
    }
    assert.strictEqual(editorSerializer.canSerialize(input), true);
    const inputSerialized = editorSerializer.serialize(input);
    if (!inputSerialized) {
      assert.fail("Unexpected serialized file input");
    }
    const inputDeserialized = editorSerializer.deserialize(instantiationService, inputSerialized);
    assert.strictEqual(inputDeserialized ? input.matches(inputDeserialized) : false, true);
    const preferredResource = toResource.call(this, "/foo/bar/UPDATEfile.js");
    const inputWithPreferredResource = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"), preferredResource);
    const inputWithPreferredResourceSerialized = editorSerializer.serialize(inputWithPreferredResource);
    if (!inputWithPreferredResourceSerialized) {
      assert.fail("Unexpected serialized file input");
    }
    const inputWithPreferredResourceDeserialized = editorSerializer.deserialize(instantiationService, inputWithPreferredResourceSerialized);
    assert.strictEqual(inputWithPreferredResource.resource.toString(), inputWithPreferredResourceDeserialized.resource.toString());
    assert.strictEqual(inputWithPreferredResource.preferredResource.toString(), inputWithPreferredResourceDeserialized.preferredResource.toString());
  });
  test("preferred name/description", async function() {
    const customFileInput = createFileInput(toResource.call(this, "/foo/bar/updatefile.js").with({ scheme: "test-custom" }), void 0, void 0, "My Name", "My Description");
    let didChangeLabelCounter = 0;
    disposables.add(customFileInput.onDidChangeLabel(() => {
      didChangeLabelCounter++;
    }));
    assert.strictEqual(customFileInput.getName(), "My Name");
    assert.strictEqual(customFileInput.getDescription(), "My Description");
    customFileInput.setPreferredName("My Name 2");
    customFileInput.setPreferredDescription("My Description 2");
    assert.strictEqual(customFileInput.getName(), "My Name 2");
    assert.strictEqual(customFileInput.getDescription(), "My Description 2");
    assert.strictEqual(didChangeLabelCounter, 2);
    customFileInput.dispose();
    const fileInput = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"), void 0, void 0, "My Name", "My Description");
    didChangeLabelCounter = 0;
    disposables.add(fileInput.onDidChangeLabel(() => {
      didChangeLabelCounter++;
    }));
    assert.notStrictEqual(fileInput.getName(), "My Name");
    assert.notStrictEqual(fileInput.getDescription(), "My Description");
    fileInput.setPreferredName("My Name 2");
    fileInput.setPreferredDescription("My Description 2");
    assert.notStrictEqual(fileInput.getName(), "My Name 2");
    assert.notStrictEqual(fileInput.getDescription(), "My Description 2");
    assert.strictEqual(didChangeLabelCounter, 0);
  });
  test("reports readonly changes", async function() {
    const input = createFileInput(toResource.call(this, "/foo/bar/updatefile.js"));
    let listenerCount = 0;
    disposables.add(input.onDidChangeCapabilities(() => {
      listenerCount++;
    }));
    const model = disposables.add(await accessor.textFileService.files.resolve(input.resource));
    assert.strictEqual(model.isReadonly(), false);
    assert.strictEqual(input.hasCapability(EditorInputCapabilities.Readonly), false);
    assert.strictEqual(input.isReadonly(), false);
    const stat = await accessor.fileService.resolve(input.resource, { resolveMetadata: true });
    try {
      accessor.fileService.readShouldThrowError = new NotModifiedSinceFileOperationError("file not modified since", { ...stat, readonly: true });
      await input.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(!!model.isReadonly(), true);
    assert.strictEqual(input.hasCapability(EditorInputCapabilities.Readonly), true);
    assert.strictEqual(!!input.isReadonly(), true);
    assert.strictEqual(listenerCount, 1);
    try {
      accessor.fileService.readShouldThrowError = new NotModifiedSinceFileOperationError("file not modified since", { ...stat, readonly: false });
      await input.resolve();
    } finally {
      accessor.fileService.readShouldThrowError = void 0;
    }
    assert.strictEqual(model.isReadonly(), false);
    assert.strictEqual(input.hasCapability(EditorInputCapabilities.Readonly), false);
    assert.strictEqual(input.isReadonly(), false);
    assert.strictEqual(listenerCount, 2);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9maWxlcy90ZXN0L2Jyb3dzZXIvZmlsZUVkaXRvcklucHV0LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlLCB0b1Jlc291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBGaWxlRWRpdG9ySW5wdXQgfSBmcm9tICcuLi8uLi9icm93c2VyL2VkaXRvcnMvZmlsZUVkaXRvcklucHV0LmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0U2VydmljZUFjY2Vzc29yLCBnZXRMYXN0UmVzb2x2ZWRGaWxlU3RhdCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5LCBWZXJib3NpdHksIEVkaXRvckV4dGVuc2lvbnMsIEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBFbmNvZGluZ01vZGUsIFRleHRGaWxlT3BlcmF0aW9uRXJyb3IsIFRleHRGaWxlT3BlcmF0aW9uUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRmaWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlT3BlcmF0aW9uUmVzdWx0LCBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yLCBUb29MYXJnZUZpbGVPcGVyYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBUZXh0RmlsZUVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvdGV4dGZpbGUvY29tbW9uL3RleHRGaWxlRWRpdG9yTW9kZWwuanMnO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFBMQUlOVEVYVF9MQU5HVUFHRV9JRCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL21vZGVzUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEJpbmFyeUVkaXRvck1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2VkaXRvci9iaW5hcnlFZGl0b3JNb2RlbC5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VFZGl0b3JJbnB1dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2VkaXRvci9jb21tb24vZWRpdG9yLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEZpbGVFZGl0b3JJbnB1dFNlcmlhbGl6ZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2VkaXRvcnMvZmlsZUVkaXRvckhhbmRsZXIuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vaW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgVGV4dEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy90ZXh0ZmlsZS9jb21tb24vdGV4dEVkaXRvclNlcnZpY2UuanMnO1xuXG5zdWl0ZSgnRmlsZXMgLSBGaWxlRWRpdG9ySW5wdXQnLCAoKSA9PiB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgYWNjZXNzb3I6IFRlc3RTZXJ2aWNlQWNjZXNzb3I7XG5cblx0ZnVuY3Rpb24gY3JlYXRlRmlsZUlucHV0KHJlc291cmNlOiBVUkksIHByZWZlcnJlZFJlc291cmNlPzogVVJJLCBwcmVmZXJyZWRMYW5ndWFnZUlkPzogc3RyaW5nLCBwcmVmZXJyZWROYW1lPzogc3RyaW5nLCBwcmVmZXJyZWREZXNjcmlwdGlvbj86IHN0cmluZywgcHJlZmVycmVkQ29udGVudHM/OiBzdHJpbmcpOiBGaWxlRWRpdG9ySW5wdXQge1xuXHRcdHJldHVybiBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZUVkaXRvcklucHV0LCByZXNvdXJjZSwgcHJlZmVycmVkUmVzb3VyY2UsIHByZWZlcnJlZE5hbWUsIHByZWZlcnJlZERlc2NyaXB0aW9uLCB1bmRlZmluZWQsIHByZWZlcnJlZExhbmd1YWdlSWQsIHByZWZlcnJlZENvbnRlbnRzKSk7XG5cdH1cblxuXHRjbGFzcyBUZXN0VGV4dEVkaXRvclNlcnZpY2UgZXh0ZW5kcyBUZXh0RWRpdG9yU2VydmljZSB7XG5cdFx0b3ZlcnJpZGUgY3JlYXRlVGV4dEVkaXRvcihpbnB1dDogSVJlc291cmNlRWRpdG9ySW5wdXQpIHtcblx0XHRcdHJldHVybiBjcmVhdGVGaWxlSW5wdXQoaW5wdXQucmVzb3VyY2UpO1xuXHRcdH1cblxuXHRcdG92ZXJyaWRlIGFzeW5jIHJlc29sdmVUZXh0RWRpdG9yKGlucHV0OiBJUmVzb3VyY2VFZGl0b3JJbnB1dCkge1xuXHRcdFx0cmV0dXJuIGNyZWF0ZUZpbGVJbnB1dChpbnB1dC5yZXNvdXJjZSk7XG5cdFx0fVxuXHR9XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2Uoe1xuXHRcdFx0dGV4dEVkaXRvclNlcnZpY2U6IGluc3RhbnRpYXRpb25TZXJ2aWNlID0+IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RUZXh0RWRpdG9yU2VydmljZSlcblx0XHR9LCBkaXNwb3NhYmxlcyk7XG5cblx0XHRhY2Nlc3NvciA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTZXJ2aWNlQWNjZXNzb3IpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgnQmFzaWNzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBpbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL2ZpbGUuanMnKSk7XG5cdFx0Y29uc3Qgb3RoZXJJbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJ2Zvby9iYXIvb3RoZXJmaWxlLmpzJykpO1xuXHRcdGNvbnN0IG90aGVySW5wdXRTYW1lID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnZm9vL2Jhci9maWxlLmpzJykpO1xuXG5cdFx0YXNzZXJ0KGlucHV0Lm1hdGNoZXMoaW5wdXQpKTtcblx0XHRhc3NlcnQoaW5wdXQubWF0Y2hlcyhvdGhlcklucHV0U2FtZSkpO1xuXHRcdGFzc2VydCghaW5wdXQubWF0Y2hlcyhvdGhlcklucHV0KSk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmdldE5hbWUoKSk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmdldERlc2NyaXB0aW9uKCkpO1xuXHRcdGFzc2VydC5vayhpbnB1dC5nZXRUaXRsZShWZXJib3NpdHkuU0hPUlQpKTtcblxuXHRcdGFzc2VydC5vayghaW5wdXQuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkpO1xuXHRcdGFzc2VydC5vayghaW5wdXQuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5SZWFkb25seSkpO1xuXHRcdGFzc2VydC5vayghaW5wdXQuaXNSZWFkb25seSgpKTtcblx0XHRhc3NlcnQub2soIWlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuU2luZ2xldG9uKSk7XG5cdFx0YXNzZXJ0Lm9rKCFpbnB1dC5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlJlcXVpcmVzVHJ1c3QpKTtcblxuXHRcdGNvbnN0IHVudHlwZWRJbnB1dCA9IGlucHV0LnRvVW50eXBlZCh7IHByZXNlcnZlVmlld1N0YXRlOiAwIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnR5cGVkSW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSwgaW5wdXQucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ2ZpbGUuanMnLCBpbnB1dC5nZXROYW1lKCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvZmlsZS5qcycpLmZzUGF0aCwgaW5wdXQucmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQoaW5wdXQucmVzb3VyY2UgaW5zdGFuY2VvZiBVUkkpO1xuXG5cdFx0aW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci5odG1sJykpO1xuXG5cdFx0Y29uc3QgaW5wdXRUb1Jlc29sdmU6IEZpbGVFZGl0b3JJbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL2ZpbGUuanMnKSk7XG5cdFx0Y29uc3Qgc2FtZU90aGVySW5wdXQ6IEZpbGVFZGl0b3JJbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL2ZpbGUuanMnKSk7XG5cblx0XHRsZXQgcmVzb2x2ZWQgPSBhd2FpdCBpbnB1dFRvUmVzb2x2ZS5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0VG9SZXNvbHZlLmlzUmVzb2x2ZWQoKSk7XG5cblx0XHRjb25zdCByZXNvbHZlZE1vZGVsQSA9IHJlc29sdmVkO1xuXHRcdHJlc29sdmVkID0gYXdhaXQgaW5wdXRUb1Jlc29sdmUucmVzb2x2ZSgpO1xuXHRcdGFzc2VydChyZXNvbHZlZE1vZGVsQSA9PT0gcmVzb2x2ZWQpOyAvLyBPSzogUmVzb2x2ZWQgTW9kZWwgY2FjaGVkIGdsb2JhbGx5IHBlciBpbnB1dFxuXG5cdFx0dHJ5IHtcblx0XHRcdERpc3Bvc2FibGVTdG9yZS5ESVNBQkxFX0RJU1BPU0VEX1dBUk5JTkcgPSB0cnVlOyAvLyBwcmV2ZW50IHVud2FudGVkIHdhcm5pbmcgb3V0cHV0IGZyb20gb2NjdXJyaW5nXG5cblx0XHRcdGNvbnN0IG90aGVyUmVzb2x2ZWQgPSBhd2FpdCBzYW1lT3RoZXJJbnB1dC5yZXNvbHZlKCk7XG5cdFx0XHRhc3NlcnQob3RoZXJSZXNvbHZlZCA9PT0gcmVzb2x2ZWRNb2RlbEEpOyAvLyBPSzogUmVzb2x2ZWQgTW9kZWwgY2FjaGVkIGdsb2JhbGx5IHBlciBpbnB1dFxuXHRcdFx0aW5wdXRUb1Jlc29sdmUuZGlzcG9zZSgpO1xuXG5cdFx0XHRyZXNvbHZlZCA9IGF3YWl0IGlucHV0VG9SZXNvbHZlLnJlc29sdmUoKTtcblx0XHRcdGFzc2VydChyZXNvbHZlZE1vZGVsQSA9PT0gcmVzb2x2ZWQpOyAvLyBNb2RlbCBpcyBzdGlsbCB0aGUgc2FtZSBiZWNhdXNlIHdlIGhhZCAyIGNsaWVudHNcblx0XHRcdGlucHV0VG9SZXNvbHZlLmRpc3Bvc2UoKTtcblx0XHRcdHNhbWVPdGhlcklucHV0LmRpc3Bvc2UoKTtcblx0XHRcdHJlc29sdmVkTW9kZWxBLmRpc3Bvc2UoKTtcblxuXHRcdFx0cmVzb2x2ZWQgPSBhd2FpdCBpbnB1dFRvUmVzb2x2ZS5yZXNvbHZlKCk7XG5cdFx0XHRhc3NlcnQocmVzb2x2ZWRNb2RlbEEgIT09IHJlc29sdmVkKTsgLy8gRGlmZmVyZW50IGluc3RhbmNlLCBiZWNhdXNlIGlucHV0IGdvdCBkaXNwb3NlZFxuXG5cdFx0XHRjb25zdCBzdGF0ID0gZ2V0TGFzdFJlc29sdmVkRmlsZVN0YXQocmVzb2x2ZWQpO1xuXHRcdFx0cmVzb2x2ZWQgPSBhd2FpdCBpbnB1dFRvUmVzb2x2ZS5yZXNvbHZlKCk7XG5cdFx0XHRhd2FpdCB0aW1lb3V0KDApO1xuXHRcdFx0YXNzZXJ0KHN0YXQgIT09IGdldExhc3RSZXNvbHZlZEZpbGVTdGF0KHJlc29sdmVkKSk7IC8vIERpZmZlcmVudCBzdGF0LCBiZWNhdXNlIHJlc29sdmUgYWx3YXlzIGdvZXMgdG8gdGhlIHNlcnZlciBmb3IgcmVmcmVzaFxuXHRcdH0gZmluYWxseSB7XG5cdFx0XHREaXNwb3NhYmxlU3RvcmUuRElTQUJMRV9ESVNQT1NFRF9XQVJOSU5HID0gZmFsc2U7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdyZXBvcnRzIGFzIHVudGl0bGVkIHdpdGhvdXQgc3VwcG9ydGVkIGZpbGUgc2NoZW1lJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvZmlsZS5qcycpLndpdGgoeyBzY2hlbWU6ICdzb21lVGVzdGluZ1NjaGVtZScgfSkpO1xuXG5cdFx0YXNzZXJ0Lm9rKGlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuVW50aXRsZWQpKTtcblx0XHRhc3NlcnQub2soIWlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHkpKTtcblx0XHRhc3NlcnQub2soIWlucHV0LmlzUmVhZG9ubHkoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlcG9ydHMgYXMgcmVhZG9ubHkgd2l0aCByZWFkb25seSBmaWxlIHNjaGVtZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBpbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgSW5NZW1vcnlGaWxlU3lzdGVtUHJvdmlkZXIoKSk7XG5cdFx0aW5NZW1vcnlGaWxlc3lzdGVtUHJvdmlkZXIuc2V0UmVhZE9ubHkodHJ1ZSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoYWNjZXNzb3IuZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcignc29tZVRlc3RpbmdSZWFkb25seVNjaGVtZScsIGluTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyKSk7XG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9maWxlLmpzJykud2l0aCh7IHNjaGVtZTogJ3NvbWVUZXN0aW5nUmVhZG9ubHlTY2hlbWUnIH0pKTtcblxuXHRcdGFzc2VydC5vayghaW5wdXQuaGFzQ2FwYWJpbGl0eShFZGl0b3JJbnB1dENhcGFiaWxpdGllcy5VbnRpdGxlZCkpO1xuXHRcdGFzc2VydC5vayhpbnB1dC5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlJlYWRvbmx5KSk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmlzUmVhZG9ubHkoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZWZlcnJlZCByZXNvdXJjZScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXNvdXJjZSA9IHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvdXBkYXRlZmlsZS5qcycpO1xuXHRcdGNvbnN0IHByZWZlcnJlZFJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9VUERBVEVGSUxFLmpzJyk7XG5cblx0XHRjb25zdCBpbnB1dFdpdGhvdXRQcmVmZXJyZWRSZXNvdXJjZSA9IGNyZWF0ZUZpbGVJbnB1dChyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0V2l0aG91dFByZWZlcnJlZFJlc291cmNlLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dFdpdGhvdXRQcmVmZXJyZWRSZXNvdXJjZS5wcmVmZXJyZWRSZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGNvbnN0IGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlID0gY3JlYXRlRmlsZUlucHV0KHJlc291cmNlLCBwcmVmZXJyZWRSZXNvdXJjZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2UucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlLnByZWZlcnJlZFJlc291cmNlLnRvU3RyaW5nKCksIHByZWZlcnJlZFJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0bGV0IGRpZENoYW5nZUxhYmVsID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlLm9uRGlkQ2hhbmdlTGFiZWwoZSA9PiB7XG5cdFx0XHRkaWRDaGFuZ2VMYWJlbCA9IHRydWU7XG5cdFx0fSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlLmdldE5hbWUoKSwgJ1VQREFURUZJTEUuanMnKTtcblxuXHRcdGNvbnN0IG90aGVyUHJlZmVycmVkUmVzb3VyY2UgPSB0b1Jlc291cmNlLmNhbGwodGhpcywgJy9GT08vQkFSL3VwZGF0ZUZJTEUuanMnKTtcblx0XHRpbnB1dFdpdGhQcmVmZXJyZWRSZXNvdXJjZS5zZXRQcmVmZXJyZWRSZXNvdXJjZShvdGhlclByZWZlcnJlZFJlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dFdpdGhQcmVmZXJyZWRSZXNvdXJjZS5yZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2UucHJlZmVycmVkUmVzb3VyY2UudG9TdHJpbmcoKSwgb3RoZXJQcmVmZXJyZWRSZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2UuZ2V0TmFtZSgpLCAndXBkYXRlRklMRS5qcycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRDaGFuZ2VMYWJlbCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZWZlcnJlZCBsYW5ndWFnZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ2ZpbGUtaW5wdXQtdGVzdCc7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGFjY2Vzc29yLmxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHtcblx0XHRcdGlkOiBsYW5ndWFnZUlkLFxuXHRcdH0pKTtcblxuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvZmlsZS5qcycpLCB1bmRlZmluZWQsIGxhbmd1YWdlSWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dC5nZXRQcmVmZXJyZWRMYW5ndWFnZUlkKCksIGxhbmd1YWdlSWQpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgaW5wdXQucmVzb2x2ZSgpIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC50ZXh0RWRpdG9yTW9kZWwhLmdldExhbmd1YWdlSWQoKSwgbGFuZ3VhZ2VJZCk7XG5cblx0XHRpbnB1dC5zZXRMYW5ndWFnZUlkKCd0ZXh0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LmdldFByZWZlcnJlZExhbmd1YWdlSWQoKSwgJ3RleHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsIS5nZXRMYW5ndWFnZUlkKCksIFBMQUlOVEVYVF9MQU5HVUFHRV9JRCk7XG5cblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9maWxlLmpzJykpO1xuXHRcdGlucHV0Mi5zZXRQcmVmZXJyZWRMYW5ndWFnZUlkKGxhbmd1YWdlSWQpO1xuXG5cdFx0Y29uc3QgbW9kZWwyID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0Mi5yZXNvbHZlKCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsMi50ZXh0RWRpdG9yTW9kZWwhLmdldExhbmd1YWdlSWQoKSwgbGFuZ3VhZ2VJZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZWZlcnJlZCBjb250ZW50cycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL2ZpbGUuanMnKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCAnTXkgY29udGVudHMnKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0LnJlc29sdmUoKSBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsIS5nZXRWYWx1ZSgpLCAnTXkgY29udGVudHMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQuaXNEaXJ0eSgpLCB0cnVlKTtcblxuXHRcdGNvbnN0IHVudHlwZWRJbnB1dCA9IGlucHV0LnRvVW50eXBlZCh7IHByZXNlcnZlVmlld1N0YXRlOiAwIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnR5cGVkSW5wdXQuY29udGVudHMsICdNeSBjb250ZW50cycpO1xuXG5cdFx0Y29uc3QgdW50eXBlZElucHV0V2l0aG91dENvbnRlbnRzID0gaW5wdXQudG9VbnR5cGVkKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudHlwZWRJbnB1dFdpdGhvdXRDb250ZW50cy5jb250ZW50cywgdW5kZWZpbmVkKTtcblxuXHRcdGlucHV0LnNldFByZWZlcnJlZENvbnRlbnRzKCdPdGhlciBjb250ZW50cycpO1xuXHRcdGF3YWl0IGlucHV0LnJlc29sdmUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwudGV4dEVkaXRvck1vZGVsIS5nZXRWYWx1ZSgpLCAnT3RoZXIgY29udGVudHMnKTtcblxuXHRcdG1vZGVsLnRleHRFZGl0b3JNb2RlbD8uc2V0VmFsdWUoJ0NoYW5nZWQgY29udGVudHMnKTtcblx0XHRhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLnRleHRFZGl0b3JNb2RlbCEuZ2V0VmFsdWUoKSwgJ0NoYW5nZWQgY29udGVudHMnKTsgLy8gcHJlZmVycmVkIGNvbnRlbnRzIG9ubHkgdXNlZCBvbmNlXG5cblx0XHRjb25zdCBpbnB1dDIgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9maWxlLmpzJykpO1xuXHRcdGlucHV0Mi5zZXRQcmVmZXJyZWRDb250ZW50cygnTXkgY29udGVudHMnKTtcblxuXHRcdGNvbnN0IG1vZGVsMiA9IGF3YWl0IGlucHV0Mi5yZXNvbHZlKCkgYXMgVGV4dEZpbGVFZGl0b3JNb2RlbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwyLnRleHRFZGl0b3JNb2RlbCEuZ2V0VmFsdWUoKSwgJ015IGNvbnRlbnRzJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Mi5pc0RpcnR5KCksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdtYXRjaGVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0MSA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL3VwZGF0ZWZpbGUuanMnKSk7XG5cdFx0Y29uc3QgaW5wdXQyID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvdXBkYXRlZmlsZS5qcycpKTtcblx0XHRjb25zdCBpbnB1dDMgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9vdGhlci5qcycpKTtcblx0XHRjb25zdCBpbnB1dDJVcHBlciA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL1VQREFURUZJTEUuanMnKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQxLm1hdGNoZXMoaW5wdXQxKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0MS5tYXRjaGVzKGlucHV0MiksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dDEubWF0Y2hlcyhpbnB1dDMpLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQxLm1hdGNoZXMoaW5wdXQyVXBwZXIpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldEVuY29kaW5nL3NldEVuY29kaW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvdXBkYXRlZmlsZS5qcycpKTtcblxuXHRcdGF3YWl0IGlucHV0LnNldEVuY29kaW5nKCd1dGYxNicsIEVuY29kaW5nTW9kZS5FbmNvZGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dC5nZXRFbmNvZGluZygpLCAndXRmMTYnKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0LnJlc29sdmUoKSBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXQuZ2V0RW5jb2RpbmcoKSwgcmVzb2x2ZWQuZ2V0RW5jb2RpbmcoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NhdmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJykpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgaW5wdXQucmVzb2x2ZSgpIGFzIFRleHRGaWxlRWRpdG9yTW9kZWwpO1xuXHRcdHJlc29sdmVkLnRleHRFZGl0b3JNb2RlbCEuc2V0VmFsdWUoJ2NoYW5nZWQnKTtcblx0XHRhc3NlcnQub2soaW5wdXQuaXNEaXJ0eSgpKTtcblx0XHRhc3NlcnQub2soaW5wdXQuaXNNb2RpZmllZCgpKTtcblxuXHRcdGF3YWl0IGlucHV0LnNhdmUoMCk7XG5cdFx0YXNzZXJ0Lm9rKCFpbnB1dC5pc0RpcnR5KCkpO1xuXHRcdGFzc2VydC5vayghaW5wdXQuaXNNb2RpZmllZCgpKTtcblx0fSk7XG5cblx0dGVzdCgncmV2ZXJ0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvdXBkYXRlZmlsZS5qcycpKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0LnJlc29sdmUoKSBhcyBUZXh0RmlsZUVkaXRvck1vZGVsKTtcblx0XHRyZXNvbHZlZC50ZXh0RWRpdG9yTW9kZWwhLnNldFZhbHVlKCdjaGFuZ2VkJyk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmlzRGlydHkoKSk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmlzTW9kaWZpZWQoKSk7XG5cblx0XHRhd2FpdCBpbnB1dC5yZXZlcnQoMCk7XG5cdFx0YXNzZXJ0Lm9rKCFpbnB1dC5pc0RpcnR5KCkpO1xuXHRcdGFzc2VydC5vayghaW5wdXQuaXNNb2RpZmllZCgpKTtcblxuXHRcdGlucHV0LmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQub2soaW5wdXQuaXNEaXNwb3NlZCgpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBoYW5kbGVzIGJpbmFyeSBmaWxlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL3VwZGF0ZWZpbGUuanMnKSk7XG5cblx0XHRhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2Uuc2V0UmVhZFN0cmVhbUVycm9yT25jZShuZXcgVGV4dEZpbGVPcGVyYXRpb25FcnJvcignZXJyb3InLCBUZXh0RmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX0lTX0JJTkFSWSkpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgaW5wdXQucmVzb2x2ZSgpKTtcblx0XHRhc3NlcnQub2socmVzb2x2ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIHRocm93cyBmb3IgdG9vIGxhcmdlIGZpbGVzJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGlucHV0ID0gY3JlYXRlRmlsZUlucHV0KHRvUmVzb3VyY2UuY2FsbCh0aGlzLCAnL2Zvby9iYXIvdXBkYXRlZmlsZS5qcycpKTtcblxuXHRcdGxldCBlOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2Uuc2V0UmVhZFN0cmVhbUVycm9yT25jZShuZXcgVG9vTGFyZ2VGaWxlT3BlcmF0aW9uRXJyb3IoJ2Vycm9yJywgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX1RPT19MQVJHRSwgMTAwMCkpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGUgPSBlcnJvcjtcblx0XHR9XG5cdFx0YXNzZXJ0Lm9rKGUpO1xuXHR9KTtcblxuXHR0ZXN0KCdhdHRhY2hlcyB0byBtb2RlbCB3aGVuIGNyZWF0ZWQgYW5kIHJlcG9ydHMgZGlydHknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJykpO1xuXG5cdFx0bGV0IGxpc3RlbmVyQ291bnQgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChpbnB1dC5vbkRpZENoYW5nZURpcnR5KCgpID0+IHtcblx0XHRcdGxpc3RlbmVyQ291bnQrKztcblx0XHR9KSk7XG5cblx0XHQvLyBpbnN0ZWFkIG9mIGdvaW5nIHRocm91Z2ggZmlsZSBpbnB1dCByZXNvbHZlIG1ldGhvZFxuXHRcdC8vIHdlIHJlc29sdmUgdGhlIG1vZGVsIGRpcmVjdGx5IHRocm91Z2ggdGhlIHNlcnZpY2Vcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMucmVzb2x2ZShpbnB1dC5yZXNvdXJjZSkpO1xuXHRcdG1vZGVsLnRleHRFZGl0b3JNb2RlbD8uc2V0VmFsdWUoJ2hlbGxvIHdvcmxkJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdGVuZXJDb3VudCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKGlucHV0LmlzRGlydHkoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZvcmNlIG9wZW4gdGV4dC9iaW5hcnknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJykpO1xuXHRcdGlucHV0LnNldEZvcmNlT3BlbkFzQmluYXJ5KCk7XG5cblx0XHRsZXQgcmVzb2x2ZWQgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgaW5wdXQucmVzb2x2ZSgpKTtcblx0XHRhc3NlcnQub2socmVzb2x2ZWQgaW5zdGFuY2VvZiBCaW5hcnlFZGl0b3JNb2RlbCk7XG5cblx0XHRpbnB1dC5zZXRGb3JjZU9wZW5Bc1RleHQoKTtcblxuXHRcdHJlc29sdmVkID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IGlucHV0LnJlc29sdmUoKSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc29sdmVkIGluc3RhbmNlb2YgVGV4dEZpbGVFZGl0b3JNb2RlbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgZWRpdG9yIHNlcmlhbGl6ZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYWNjZXNzb3IgPT4gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5zdGFydChhY2Nlc3NvcikpO1xuXG5cdFx0Y29uc3QgaW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJykpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKFJlZ2lzdHJ5LmFzPElFZGl0b3JGYWN0b3J5UmVnaXN0cnk+KEVkaXRvckV4dGVuc2lvbnMuRWRpdG9yRmFjdG9yeSkucmVnaXN0ZXJFZGl0b3JTZXJpYWxpemVyKCd3b3JrYmVuY2guZWRpdG9ycy5maWxlcy5maWxlRWRpdG9ySW5wdXQnLCBGaWxlRWRpdG9ySW5wdXRTZXJpYWxpemVyKSk7XG5cblx0XHRjb25zdCBlZGl0b3JTZXJpYWxpemVyID0gUmVnaXN0cnkuYXM8SUVkaXRvckZhY3RvcnlSZWdpc3RyeT4oRWRpdG9yRXh0ZW5zaW9ucy5FZGl0b3JGYWN0b3J5KS5nZXRFZGl0b3JTZXJpYWxpemVyKGlucHV0LnR5cGVJZCk7XG5cdFx0aWYgKCFlZGl0b3JTZXJpYWxpemVyKSB7XG5cdFx0XHRhc3NlcnQuZmFpbCgnRmlsZSBFZGl0b3IgSW5wdXQgU2VyaWFsaXplciBtaXNzaW5nJyk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVkaXRvclNlcmlhbGl6ZXIuY2FuU2VyaWFsaXplKGlucHV0KSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBpbnB1dFNlcmlhbGl6ZWQgPSBlZGl0b3JTZXJpYWxpemVyLnNlcmlhbGl6ZShpbnB1dCk7XG5cdFx0aWYgKCFpbnB1dFNlcmlhbGl6ZWQpIHtcblx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIHNlcmlhbGl6ZWQgZmlsZSBpbnB1dCcpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlucHV0RGVzZXJpYWxpemVkID0gZWRpdG9yU2VyaWFsaXplci5kZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZSwgaW5wdXRTZXJpYWxpemVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXREZXNlcmlhbGl6ZWQgPyBpbnB1dC5tYXRjaGVzKGlucHV0RGVzZXJpYWxpemVkKSA6IGZhbHNlLCB0cnVlKTtcblxuXHRcdGNvbnN0IHByZWZlcnJlZFJlc291cmNlID0gdG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci9VUERBVEVmaWxlLmpzJyk7XG5cdFx0Y29uc3QgaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2UgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJyksIHByZWZlcnJlZFJlc291cmNlKTtcblxuXHRcdGNvbnN0IGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlU2VyaWFsaXplZCA9IGVkaXRvclNlcmlhbGl6ZXIuc2VyaWFsaXplKGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlKTtcblx0XHRpZiAoIWlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlU2VyaWFsaXplZCkge1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgc2VyaWFsaXplZCBmaWxlIGlucHV0Jyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2VEZXNlcmlhbGl6ZWQgPSBlZGl0b3JTZXJpYWxpemVyLmRlc2VyaWFsaXplKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBpbnB1dFdpdGhQcmVmZXJyZWRSZXNvdXJjZVNlcmlhbGl6ZWQpIGFzIEZpbGVFZGl0b3JJbnB1dDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2UucmVzb3VyY2UudG9TdHJpbmcoKSwgaW5wdXRXaXRoUHJlZmVycmVkUmVzb3VyY2VEZXNlcmlhbGl6ZWQucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlLnByZWZlcnJlZFJlc291cmNlLnRvU3RyaW5nKCksIGlucHV0V2l0aFByZWZlcnJlZFJlc291cmNlRGVzZXJpYWxpemVkLnByZWZlcnJlZFJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmVmZXJyZWQgbmFtZS9kZXNjcmlwdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdC8vIFdvcmtzIHdpdGggY3VzdG9tIGZpbGUgaW5wdXRcblx0XHRjb25zdCBjdXN0b21GaWxlSW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJykud2l0aCh7IHNjaGVtZTogJ3Rlc3QtY3VzdG9tJyB9KSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsICdNeSBOYW1lJywgJ015IERlc2NyaXB0aW9uJyk7XG5cblx0XHRsZXQgZGlkQ2hhbmdlTGFiZWxDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoY3VzdG9tRmlsZUlucHV0Lm9uRGlkQ2hhbmdlTGFiZWwoKCkgPT4ge1xuXHRcdFx0ZGlkQ2hhbmdlTGFiZWxDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUZpbGVJbnB1dC5nZXROYW1lKCksICdNeSBOYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUZpbGVJbnB1dC5nZXREZXNjcmlwdGlvbigpLCAnTXkgRGVzY3JpcHRpb24nKTtcblxuXHRcdGN1c3RvbUZpbGVJbnB1dC5zZXRQcmVmZXJyZWROYW1lKCdNeSBOYW1lIDInKTtcblx0XHRjdXN0b21GaWxlSW5wdXQuc2V0UHJlZmVycmVkRGVzY3JpcHRpb24oJ015IERlc2NyaXB0aW9uIDInKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjdXN0b21GaWxlSW5wdXQuZ2V0TmFtZSgpLCAnTXkgTmFtZSAyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGN1c3RvbUZpbGVJbnB1dC5nZXREZXNjcmlwdGlvbigpLCAnTXkgRGVzY3JpcHRpb24gMicpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZENoYW5nZUxhYmVsQ291bnRlciwgMik7XG5cblx0XHRjdXN0b21GaWxlSW5wdXQuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gRGlzYWxsb3dlZCB3aXRoIGxvY2FsIGZpbGUgaW5wdXRcblx0XHRjb25zdCBmaWxlSW5wdXQgPSBjcmVhdGVGaWxlSW5wdXQodG9SZXNvdXJjZS5jYWxsKHRoaXMsICcvZm9vL2Jhci91cGRhdGVmaWxlLmpzJyksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCAnTXkgTmFtZScsICdNeSBEZXNjcmlwdGlvbicpO1xuXG5cdFx0ZGlkQ2hhbmdlTGFiZWxDb3VudGVyID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZmlsZUlucHV0Lm9uRGlkQ2hhbmdlTGFiZWwoKCkgPT4ge1xuXHRcdFx0ZGlkQ2hhbmdlTGFiZWxDb3VudGVyKys7XG5cdFx0fSkpO1xuXG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpbGVJbnB1dC5nZXROYW1lKCksICdNeSBOYW1lJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpbGVJbnB1dC5nZXREZXNjcmlwdGlvbigpLCAnTXkgRGVzY3JpcHRpb24nKTtcblxuXHRcdGZpbGVJbnB1dC5zZXRQcmVmZXJyZWROYW1lKCdNeSBOYW1lIDInKTtcblx0XHRmaWxlSW5wdXQuc2V0UHJlZmVycmVkRGVzY3JpcHRpb24oJ015IERlc2NyaXB0aW9uIDInKTtcblxuXHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbChmaWxlSW5wdXQuZ2V0TmFtZSgpLCAnTXkgTmFtZSAyJyk7XG5cdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKGZpbGVJbnB1dC5nZXREZXNjcmlwdGlvbigpLCAnTXkgRGVzY3JpcHRpb24gMicpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZENoYW5nZUxhYmVsQ291bnRlciwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlcG9ydHMgcmVhZG9ubHkgY2hhbmdlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBpbnB1dCA9IGNyZWF0ZUZpbGVJbnB1dCh0b1Jlc291cmNlLmNhbGwodGhpcywgJy9mb28vYmFyL3VwZGF0ZWZpbGUuanMnKSk7XG5cblx0XHRsZXQgbGlzdGVuZXJDb3VudCA9IDA7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGlucHV0Lm9uRGlkQ2hhbmdlQ2FwYWJpbGl0aWVzKCgpID0+IHtcblx0XHRcdGxpc3RlbmVyQ291bnQrKztcblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBhY2Nlc3Nvci50ZXh0RmlsZVNlcnZpY2UuZmlsZXMucmVzb2x2ZShpbnB1dC5yZXNvdXJjZSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmlzUmVhZG9ubHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dC5oYXNDYXBhYmlsaXR5KEVkaXRvcklucHV0Q2FwYWJpbGl0aWVzLlJlYWRvbmx5KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnB1dC5pc1JlYWRvbmx5KCksIGZhbHNlKTtcblxuXHRcdGNvbnN0IHN0YXQgPSBhd2FpdCBhY2Nlc3Nvci5maWxlU2VydmljZS5yZXNvbHZlKGlucHV0LnJlc291cmNlLCB7IHJlc29sdmVNZXRhZGF0YTogdHJ1ZSB9KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yKCdmaWxlIG5vdCBtb2RpZmllZCBzaW5jZScsIHsgLi4uc3RhdCwgcmVhZG9ubHk6IHRydWUgfSk7XG5cdFx0XHRhd2FpdCBpbnB1dC5yZXNvbHZlKCk7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGFjY2Vzc29yLmZpbGVTZXJ2aWNlLnJlYWRTaG91bGRUaHJvd0Vycm9yID0gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCghIW1vZGVsLmlzUmVhZG9ubHkoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHkpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoISFpbnB1dC5pc1JlYWRvbmx5KCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0ZW5lckNvdW50LCAxKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IG5ldyBOb3RNb2RpZmllZFNpbmNlRmlsZU9wZXJhdGlvbkVycm9yKCdmaWxlIG5vdCBtb2RpZmllZCBzaW5jZScsIHsgLi4uc3RhdCwgcmVhZG9ubHk6IGZhbHNlIH0pO1xuXHRcdFx0YXdhaXQgaW5wdXQucmVzb2x2ZSgpO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRhY2Nlc3Nvci5maWxlU2VydmljZS5yZWFkU2hvdWxkVGhyb3dFcnJvciA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXNSZWFkb25seSgpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0Lmhhc0NhcGFiaWxpdHkoRWRpdG9ySW5wdXRDYXBhYmlsaXRpZXMuUmVhZG9ubHkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlucHV0LmlzUmVhZG9ubHkoKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0ZW5lckNvdW50LCAyKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJB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QUN6SSxZQUFNLE1BQU0sUUFBUTtBQUFBLElBQ3JCLFVBQUU7QUFDRCxlQUFTLFlBQVksdUJBQXVCO0FBQUEsSUFDN0M7QUFFQSxXQUFPLFlBQVksQ0FBQyxDQUFDLE1BQU0sV0FBVyxHQUFHLElBQUk7QUFDN0MsV0FBTyxZQUFZLE1BQU0sY0FBYyx3QkFBd0IsUUFBUSxHQUFHLElBQUk7QUFDOUUsV0FBTyxZQUFZLENBQUMsQ0FBQyxNQUFNLFdBQVcsR0FBRyxJQUFJO0FBQzdDLFdBQU8sWUFBWSxlQUFlLENBQUM7QUFFbkMsUUFBSTtBQUNILGVBQVMsWUFBWSx1QkFBdUIsSUFBSSxtQ0FBbUMsMkJBQTJCLEVBQUUsR0FBRyxNQUFNLFVBQVUsTUFBTSxDQUFDO0FBQzFJLFlBQU0sTUFBTSxRQUFRO0FBQUEsSUFDckIsVUFBRTtBQUNELGVBQVMsWUFBWSx1QkFBdUI7QUFBQSxJQUM3QztBQUVBLFdBQU8sWUFBWSxNQUFNLFdBQVcsR0FBRyxLQUFLO0FBQzVDLFdBQU8sWUFBWSxNQUFNLGNBQWMsd0JBQXdCLFFBQVEsR0FBRyxLQUFLO0FBQy9FLFdBQU8sWUFBWSxNQUFNLFdBQVcsR0FBRyxLQUFLO0FBQzVDLFdBQU8sWUFBWSxlQUFlLENBQUM7QUFBQSxFQUNwQyxDQUFDO0FBRUQsMENBQXdDO0FBQ3pDLENBQUM7IiwKICAibmFtZXMiOiBbImluc3RhbnRpYXRpb25TZXJ2aWNlIiwgImFjY2Vzc29yIl0KfQo=
