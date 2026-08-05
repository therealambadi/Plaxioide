import * as resources from "../../../../../base/common/resources.js";
import assert from "assert";
import { TestEnvironmentService, TestLifecycleService, TestPathService, TestRemoteAgentService } from "../../../../test/browser/workbenchTestServices.js";
import { URI } from "../../../../../base/common/uri.js";
import { LabelService } from "../../common/labelService.js";
import { TestContextService, TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { WorkspaceFolder } from "../../../../../platform/workspace/common/workspace.js";
import { TestWorkspace, Workspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { Memento } from "../../../../common/memento.js";
import { sep } from "../../../../../base/common/path.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
suite("URI Label", () => {
  let labelService;
  let storageService;
  setup(() => {
    storageService = new TestStorageService();
    labelService = new LabelService(TestEnvironmentService, new TestContextService(), new TestPathService(URI.file("/foobar")), new TestRemoteAgentService(), storageService, new TestLifecycleService());
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("custom scheme", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL/${path}/${authority}/END",
        separator: "/",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL//1/2/3/4/5/microsoft.com/END");
    assert.strictEqual(labelService.getUriBasenameLabel(uri1), "END");
  });
  test("file scheme", function() {
    labelService.registerFormatter({
      scheme: "file",
      formatting: {
        label: "${path}",
        separator: sep,
        tildify: !isWindows,
        normalizeDriveLetter: isWindows
      }
    });
    const uri1 = TestWorkspace.folders[0].uri.with({ path: TestWorkspace.folders[0].uri.path.concat("/a/b/c/d") });
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: true }), isWindows ? "a\\b\\c\\d" : "a/b/c/d");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), isWindows ? "C:\\testWorkspace\\a\\b\\c\\d" : "/testWorkspace/a/b/c/d");
    assert.strictEqual(labelService.getUriBasenameLabel(uri1), "d");
    const uri2 = URI.file("c:\\1/2/3");
    assert.strictEqual(labelService.getUriLabel(uri2, { relative: false }), isWindows ? "C:\\1\\2\\3" : "/c:\\1/2/3");
    assert.strictEqual(labelService.getUriBasenameLabel(uri2), "3");
  });
  test("separator", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL\\${path}\\${authority}\\END",
        separator: "\\",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL\\\\1\\2\\3\\4\\5\\microsoft.com\\END");
    assert.strictEqual(labelService.getUriBasenameLabel(uri1), "END");
  });
  test("custom authority", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      authority: "micro*",
      formatting: {
        label: "LABEL/${path}/${authority}/END",
        separator: "/"
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL//1/2/3/4/5/microsoft.com/END");
    assert.strictEqual(labelService.getUriBasenameLabel(uri1), "END");
  });
  test("mulitple authority", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      authority: "not_matching_but_long",
      formatting: {
        label: "first",
        separator: "/"
      }
    });
    labelService.registerFormatter({
      scheme: "vscode",
      authority: "microsof*",
      formatting: {
        label: "second",
        separator: "/"
      }
    });
    labelService.registerFormatter({
      scheme: "vscode",
      authority: "mi*",
      formatting: {
        label: "third",
        separator: "/"
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "second");
    assert.strictEqual(labelService.getUriBasenameLabel(uri1), "second");
  });
  test("custom query", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL${query.prefix}: ${query.path}/END",
        separator: "/",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ prefix: "prefix", path: "path" }))}`);
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABELprefix: path/END");
  });
  test("custom query without value", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL${query.prefix}: ${query.path}/END",
        separator: "/",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse(`vscode://microsoft.com/1/2/3/4/5?${encodeURIComponent(JSON.stringify({ path: "path" }))}`);
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL: path/END");
  });
  test("custom query without query json", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL${query.prefix}: ${query.path}/END",
        separator: "/",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5?path=foo");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL: /END");
  });
  test("custom query without query", function() {
    labelService.registerFormatter({
      scheme: "vscode",
      formatting: {
        label: "LABEL${query.prefix}: ${query.path}/END",
        separator: "/",
        tildify: true,
        normalizeDriveLetter: true
      }
    });
    const uri1 = URI.parse("vscode://microsoft.com/1/2/3/4/5");
    assert.strictEqual(labelService.getUriLabel(uri1, { relative: false }), "LABEL: /END");
  });
  test("label caching", () => {
    const m = new Memento("cachedResourceLabelFormatters2", storageService).getMemento(StorageScope.PROFILE, StorageTarget.MACHINE);
    const makeFormatter = (scheme) => ({ formatting: { label: `\${path} (${scheme})`, separator: "/" }, scheme });
    assert.deepStrictEqual(m, {});
    labelService.registerCachedFormatter(makeFormatter("a"));
    assert.deepStrictEqual(m, { formatters: [makeFormatter("a")] });
    labelService.registerCachedFormatter(makeFormatter("b"));
    assert.deepStrictEqual(m, { formatters: [makeFormatter("b"), makeFormatter("a")] });
    labelService.registerCachedFormatter(makeFormatter("a"));
    assert.deepStrictEqual(m, { formatters: [makeFormatter("a"), makeFormatter("b")] });
    labelService.registerCachedFormatter(makeFormatter("a"));
    assert.deepStrictEqual(m, { formatters: [makeFormatter("a"), makeFormatter("b")] });
    for (let i = 0; i < 100; i++) {
      labelService.registerCachedFormatter(makeFormatter(`i${i}`));
    }
    const expected = [];
    for (let i = 50; i < 100; i++) {
      expected.unshift(makeFormatter(`i${i}`));
    }
    assert.deepStrictEqual(m, { formatters: expected });
    delete m.formatters;
  });
});
suite("multi-root workspace", () => {
  let labelService;
  const disposables = new DisposableStore();
  setup(() => {
    const sources = URI.file("folder1/src");
    const tests = URI.file("folder1/test");
    const other = URI.file("folder2");
    labelService = disposables.add(new LabelService(
      TestEnvironmentService,
      new TestContextService(
        new Workspace("test-workspace", [
          new WorkspaceFolder({ uri: sources, index: 0, name: "Sources" }),
          new WorkspaceFolder({ uri: tests, index: 1, name: "Tests" }),
          new WorkspaceFolder({ uri: other, index: 2, name: resources.basename(other) })
        ])
      ),
      new TestPathService(),
      new TestRemoteAgentService(),
      disposables.add(new TestStorageService()),
      disposables.add(new TestLifecycleService())
    ));
  });
  teardown(() => {
    disposables.clear();
  });
  test("labels of files in multiroot workspaces are the foldername followed by offset from the folder", () => {
    labelService.registerFormatter({
      scheme: "file",
      formatting: {
        label: "${authority}${path}",
        separator: "/",
        tildify: false,
        normalizeDriveLetter: false,
        authorityPrefix: "//",
        workspaceSuffix: ""
      }
    });
    const tests = {
      "folder1/src/file": "Sources \u2022 file",
      "folder1/src/folder/file": "Sources \u2022 folder/file",
      "folder1/src": "Sources",
      "folder1/other": "/folder1/other",
      "folder2/other": "folder2 \u2022 other"
    };
    Object.entries(tests).forEach(([path, label]) => {
      const generated = labelService.getUriLabel(URI.file(path), { relative: true });
      assert.strictEqual(generated, label);
    });
  });
  test("labels with context after path", () => {
    labelService.registerFormatter({
      scheme: "file",
      formatting: {
        label: "${path} (${scheme})",
        separator: "/"
      }
    });
    const tests = {
      "folder1/src/file": "Sources \u2022 file (file)",
      "folder1/src/folder/file": "Sources \u2022 folder/file (file)",
      "folder1/src": "Sources",
      "folder1/other": "/folder1/other (file)",
      "folder2/other": "folder2 \u2022 other (file)"
    };
    Object.entries(tests).forEach(([path, label]) => {
      const generated = labelService.getUriLabel(URI.file(path), { relative: true });
      assert.strictEqual(generated, label, path);
    });
  });
  test("stripPathStartingSeparator", () => {
    labelService.registerFormatter({
      scheme: "file",
      formatting: {
        label: "${path}",
        separator: "/",
        stripPathStartingSeparator: true
      }
    });
    const tests = {
      "folder1/src/file": "Sources \u2022 file",
      "other/blah": "other/blah"
    };
    Object.entries(tests).forEach(([path, label]) => {
      const generated = labelService.getUriLabel(URI.file(path), { relative: true });
      assert.strictEqual(generated, label, path);
    });
  });
  test("relative label without formatter", () => {
    const rootFolder = URI.parse("myscheme://myauthority/");
    labelService = disposables.add(new LabelService(
      TestEnvironmentService,
      new TestContextService(
        new Workspace("test-workspace", [
          new WorkspaceFolder({ uri: rootFolder, index: 0, name: "FSProotFolder" })
        ])
      ),
      new TestPathService(void 0, rootFolder.scheme),
      new TestRemoteAgentService(),
      disposables.add(new TestStorageService()),
      disposables.add(new TestLifecycleService())
    ));
    const generated = labelService.getUriLabel(URI.parse("myscheme://myauthority/some/folder/test.txt"), { relative: true });
    if (isWindows) {
      assert.strictEqual(generated, "some\\folder\\test.txt");
    } else {
      assert.strictEqual(generated, "some/folder/test.txt");
    }
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("workspace at FSP root", () => {
  let labelService;
  setup(() => {
    const rootFolder = URI.parse("myscheme://myauthority/");
    labelService = new LabelService(
      TestEnvironmentService,
      new TestContextService(
        new Workspace("test-workspace", [
          new WorkspaceFolder({ uri: rootFolder, index: 0, name: "FSProotFolder" })
        ])
      ),
      new TestPathService(),
      new TestRemoteAgentService(),
      new TestStorageService(),
      new TestLifecycleService()
    );
    labelService.registerFormatter({
      scheme: "myscheme",
      formatting: {
        label: "${scheme}://${authority}${path}",
        separator: "/",
        tildify: false,
        normalizeDriveLetter: false,
        workspaceSuffix: "",
        authorityPrefix: "",
        stripPathStartingSeparator: false
      }
    });
  });
  test("non-relative label", () => {
    const tests = {
      "myscheme://myauthority/myFile1.txt": "myscheme://myauthority/myFile1.txt",
      "myscheme://myauthority/folder/myFile2.txt": "myscheme://myauthority/folder/myFile2.txt"
    };
    Object.entries(tests).forEach(([uriString, label]) => {
      const generated = labelService.getUriLabel(URI.parse(uriString), { relative: false });
      assert.strictEqual(generated, label);
    });
  });
  test("relative label", () => {
    const tests = {
      "myscheme://myauthority/myFile1.txt": "myFile1.txt",
      "myscheme://myauthority/folder/myFile2.txt": "folder/myFile2.txt"
    };
    Object.entries(tests).forEach(([uriString, label]) => {
      const generated = labelService.getUriLabel(URI.parse(uriString), { relative: true });
      assert.strictEqual(generated, label);
    });
  });
  test("relative label with explicit path separator", () => {
    let generated = labelService.getUriLabel(URI.parse("myscheme://myauthority/some/folder/test.txt"), { relative: true, separator: "/" });
    assert.strictEqual(generated, "some/folder/test.txt");
    generated = labelService.getUriLabel(URI.parse("myscheme://myauthority/some/folder/test.txt"), { relative: true, separator: "\\" });
    assert.strictEqual(generated, "some\\folder\\test.txt");
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvbGFiZWwvdGVzdC9icm93c2VyL2xhYmVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFRlc3RFbnZpcm9ubWVudFNlcnZpY2UsIFRlc3RMaWZlY3ljbGVTZXJ2aWNlLCBUZXN0UGF0aFNlcnZpY2UsIFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vbGFiZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RDb250ZXh0U2VydmljZSwgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IFRlc3RXb3Jrc3BhY2UsIFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS90ZXN0L2NvbW1vbi90ZXN0V29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGlzV2luZG93cyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgTWVtZW50byB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tZW1lbnRvLmpzJztcbmltcG9ydCB7IFJlc291cmNlTGFiZWxGb3JtYXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgc2VwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5cbnN1aXRlKCdVUkkgTGFiZWwnLCAoKSA9PiB7XG5cdGxldCBsYWJlbFNlcnZpY2U6IExhYmVsU2VydmljZTtcblx0bGV0IHN0b3JhZ2VTZXJ2aWNlOiBUZXN0U3RvcmFnZVNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHN0b3JhZ2VTZXJ2aWNlID0gbmV3IFRlc3RTdG9yYWdlU2VydmljZSgpO1xuXHRcdGxhYmVsU2VydmljZSA9IG5ldyBMYWJlbFNlcnZpY2UoVGVzdEVudmlyb25tZW50U2VydmljZSwgbmV3IFRlc3RDb250ZXh0U2VydmljZSgpLCBuZXcgVGVzdFBhdGhTZXJ2aWNlKFVSSS5maWxlKCcvZm9vYmFyJykpLCBuZXcgVGVzdFJlbW90ZUFnZW50U2VydmljZSgpLCBzdG9yYWdlU2VydmljZSwgbmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdjdXN0b20gc2NoZW1lJywgZnVuY3Rpb24gKCkge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICd2c2NvZGUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJ0xBQkVMLyR7cGF0aH0vJHthdXRob3JpdHl9L0VORCcsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nLFxuXHRcdFx0XHR0aWxkaWZ5OiB0cnVlLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpMSA9IFVSSS5wYXJzZSgndnNjb2RlOi8vbWljcm9zb2Z0LmNvbS8xLzIvMy80LzUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTEsIHsgcmVsYXRpdmU6IGZhbHNlIH0pLCAnTEFCRUwvLzEvMi8zLzQvNS9taWNyb3NvZnQuY29tL0VORCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkxKSwgJ0VORCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIHNjaGVtZScsIGZ1bmN0aW9uICgpIHtcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiAnZmlsZScsXG5cdFx0XHRmb3JtYXR0aW5nOiB7XG5cdFx0XHRcdGxhYmVsOiAnJHtwYXRofScsXG5cdFx0XHRcdHNlcGFyYXRvcjogc2VwLFxuXHRcdFx0XHR0aWxkaWZ5OiAhaXNXaW5kb3dzLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogaXNXaW5kb3dzXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB1cmkxID0gVGVzdFdvcmtzcGFjZS5mb2xkZXJzWzBdLnVyaS53aXRoKHsgcGF0aDogVGVzdFdvcmtzcGFjZS5mb2xkZXJzWzBdLnVyaS5wYXRoLmNvbmNhdCgnL2EvYi9jL2QnKSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTEsIHsgcmVsYXRpdmU6IHRydWUgfSksIGlzV2luZG93cyA/ICdhXFxcXGJcXFxcY1xcXFxkJyA6ICdhL2IvYy9kJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmkxLCB7IHJlbGF0aXZlOiBmYWxzZSB9KSwgaXNXaW5kb3dzID8gJ0M6XFxcXHRlc3RXb3Jrc3BhY2VcXFxcYVxcXFxiXFxcXGNcXFxcZCcgOiAnL3Rlc3RXb3Jrc3BhY2UvYS9iL2MvZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkxKSwgJ2QnKTtcblxuXHRcdGNvbnN0IHVyaTIgPSBVUkkuZmlsZSgnYzpcXFxcMS8yLzMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTIsIHsgcmVsYXRpdmU6IGZhbHNlIH0pLCBpc1dpbmRvd3MgPyAnQzpcXFxcMVxcXFwyXFxcXDMnIDogJy9jOlxcXFwxLzIvMycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkyKSwgJzMnKTtcblx0fSk7XG5cblx0dGVzdCgnc2VwYXJhdG9yJywgZnVuY3Rpb24gKCkge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICd2c2NvZGUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJ0xBQkVMXFxcXCR7cGF0aH1cXFxcJHthdXRob3JpdHl9XFxcXEVORCcsXG5cdFx0XHRcdHNlcGFyYXRvcjogJ1xcXFwnLFxuXHRcdFx0XHR0aWxkaWZ5OiB0cnVlLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpMSA9IFVSSS5wYXJzZSgndnNjb2RlOi8vbWljcm9zb2Z0LmNvbS8xLzIvMy80LzUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTEsIHsgcmVsYXRpdmU6IGZhbHNlIH0pLCAnTEFCRUxcXFxcXFxcXDFcXFxcMlxcXFwzXFxcXDRcXFxcNVxcXFxtaWNyb3NvZnQuY29tXFxcXEVORCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkxKSwgJ0VORCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXN0b20gYXV0aG9yaXR5JywgZnVuY3Rpb24gKCkge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICd2c2NvZGUnLFxuXHRcdFx0YXV0aG9yaXR5OiAnbWljcm8qJyxcblx0XHRcdGZvcm1hdHRpbmc6IHtcblx0XHRcdFx0bGFiZWw6ICdMQUJFTC8ke3BhdGh9LyR7YXV0aG9yaXR5fS9FTkQnLFxuXHRcdFx0XHRzZXBhcmF0b3I6ICcvJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpMSA9IFVSSS5wYXJzZSgndnNjb2RlOi8vbWljcm9zb2Z0LmNvbS8xLzIvMy80LzUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTEsIHsgcmVsYXRpdmU6IGZhbHNlIH0pLCAnTEFCRUwvLzEvMi8zLzQvNS9taWNyb3NvZnQuY29tL0VORCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpQmFzZW5hbWVMYWJlbCh1cmkxKSwgJ0VORCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWxpdHBsZSBhdXRob3JpdHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogJ3ZzY29kZScsXG5cdFx0XHRhdXRob3JpdHk6ICdub3RfbWF0Y2hpbmdfYnV0X2xvbmcnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJ2ZpcnN0Jyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLydcblx0XHRcdH1cblx0XHR9KTtcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiAndnNjb2RlJyxcblx0XHRcdGF1dGhvcml0eTogJ21pY3Jvc29mKicsXG5cdFx0XHRmb3JtYXR0aW5nOiB7XG5cdFx0XHRcdGxhYmVsOiAnc2Vjb25kJyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLydcblx0XHRcdH1cblx0XHR9KTtcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiAndnNjb2RlJyxcblx0XHRcdGF1dGhvcml0eTogJ21pKicsXG5cdFx0XHRmb3JtYXR0aW5nOiB7XG5cdFx0XHRcdGxhYmVsOiAndGhpcmQnLFxuXHRcdFx0XHRzZXBhcmF0b3I6ICcvJ1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Ly8gTWFrZSBzdXJlIHRoZSBtb3N0IHNwZWNpZmljIGF1dGhvcml0eSBpcyBwaWNrZWRcblx0XHRjb25zdCB1cmkxID0gVVJJLnBhcnNlKCd2c2NvZGU6Ly9taWNyb3NvZnQuY29tLzEvMi8zLzQvNScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodXJpMSwgeyByZWxhdGl2ZTogZmFsc2UgfSksICdzZWNvbmQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUJhc2VuYW1lTGFiZWwodXJpMSksICdzZWNvbmQnKTtcblx0fSk7XG5cblx0dGVzdCgnY3VzdG9tIHF1ZXJ5JywgZnVuY3Rpb24gKCkge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICd2c2NvZGUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJ0xBQkVMJHtxdWVyeS5wcmVmaXh9OiAke3F1ZXJ5LnBhdGh9L0VORCcsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nLFxuXHRcdFx0XHR0aWxkaWZ5OiB0cnVlLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpMSA9IFVSSS5wYXJzZShgdnNjb2RlOi8vbWljcm9zb2Z0LmNvbS8xLzIvMy80LzU/JHtlbmNvZGVVUklDb21wb25lbnQoSlNPTi5zdHJpbmdpZnkoeyBwcmVmaXg6ICdwcmVmaXgnLCBwYXRoOiAncGF0aCcgfSkpfWApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodXJpMSwgeyByZWxhdGl2ZTogZmFsc2UgfSksICdMQUJFTHByZWZpeDogcGF0aC9FTkQnKTtcblx0fSk7XG5cblx0dGVzdCgnY3VzdG9tIHF1ZXJ5IHdpdGhvdXQgdmFsdWUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogJ3ZzY29kZScsXG5cdFx0XHRmb3JtYXR0aW5nOiB7XG5cdFx0XHRcdGxhYmVsOiAnTEFCRUwke3F1ZXJ5LnByZWZpeH06ICR7cXVlcnkucGF0aH0vRU5EJyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLycsXG5cdFx0XHRcdHRpbGRpZnk6IHRydWUsXG5cdFx0XHRcdG5vcm1hbGl6ZURyaXZlTGV0dGVyOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB1cmkxID0gVVJJLnBhcnNlKGB2c2NvZGU6Ly9taWNyb3NvZnQuY29tLzEvMi8zLzQvNT8ke2VuY29kZVVSSUNvbXBvbmVudChKU09OLnN0cmluZ2lmeSh7IHBhdGg6ICdwYXRoJyB9KSl9YCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbCh1cmkxLCB7IHJlbGF0aXZlOiBmYWxzZSB9KSwgJ0xBQkVMOiBwYXRoL0VORCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdjdXN0b20gcXVlcnkgd2l0aG91dCBxdWVyeSBqc29uJywgZnVuY3Rpb24gKCkge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICd2c2NvZGUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJ0xBQkVMJHtxdWVyeS5wcmVmaXh9OiAke3F1ZXJ5LnBhdGh9L0VORCcsXG5cdFx0XHRcdHNlcGFyYXRvcjogJy8nLFxuXHRcdFx0XHR0aWxkaWZ5OiB0cnVlLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogdHJ1ZVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpMSA9IFVSSS5wYXJzZSgndnNjb2RlOi8vbWljcm9zb2Z0LmNvbS8xLzIvMy80LzU/cGF0aD1mb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKHVyaTEsIHsgcmVsYXRpdmU6IGZhbHNlIH0pLCAnTEFCRUw6IC9FTkQnKTtcblx0fSk7XG5cblx0dGVzdCgnY3VzdG9tIHF1ZXJ5IHdpdGhvdXQgcXVlcnknLCBmdW5jdGlvbiAoKSB7XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogJ3ZzY29kZScsXG5cdFx0XHRmb3JtYXR0aW5nOiB7XG5cdFx0XHRcdGxhYmVsOiAnTEFCRUwke3F1ZXJ5LnByZWZpeH06ICR7cXVlcnkucGF0aH0vRU5EJyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLycsXG5cdFx0XHRcdHRpbGRpZnk6IHRydWUsXG5cdFx0XHRcdG5vcm1hbGl6ZURyaXZlTGV0dGVyOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB1cmkxID0gVVJJLnBhcnNlKCd2c2NvZGU6Ly9taWNyb3NvZnQuY29tLzEvMi8zLzQvNScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwodXJpMSwgeyByZWxhdGl2ZTogZmFsc2UgfSksICdMQUJFTDogL0VORCcpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2xhYmVsIGNhY2hpbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbSA9IG5ldyBNZW1lbnRvKCdjYWNoZWRSZXNvdXJjZUxhYmVsRm9ybWF0dGVyczInLCBzdG9yYWdlU2VydmljZSkuZ2V0TWVtZW50byhTdG9yYWdlU2NvcGUuUFJPRklMRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRjb25zdCBtYWtlRm9ybWF0dGVyID0gKHNjaGVtZTogc3RyaW5nKTogUmVzb3VyY2VMYWJlbEZvcm1hdHRlciA9PiAoeyBmb3JtYXR0aW5nOiB7IGxhYmVsOiBgXFwke3BhdGh9ICgke3NjaGVtZX0pYCwgc2VwYXJhdG9yOiAnLycgfSwgc2NoZW1lIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobSwge30pO1xuXG5cdFx0Ly8gcmVnaXN0ZXJzIGEgbmV3IGZvcm1hdHRlcjpcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJDYWNoZWRGb3JtYXR0ZXIobWFrZUZvcm1hdHRlcignYScpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0sIHsgZm9ybWF0dGVyczogW21ha2VGb3JtYXR0ZXIoJ2EnKV0gfSk7XG5cblx0XHQvLyByZWdpc3RlcnMgYSAybmQgZm9ybWF0dGVyOlxuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckNhY2hlZEZvcm1hdHRlcihtYWtlRm9ybWF0dGVyKCdiJykpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobSwgeyBmb3JtYXR0ZXJzOiBbbWFrZUZvcm1hdHRlcignYicpLCBtYWtlRm9ybWF0dGVyKCdhJyldIH0pO1xuXG5cdFx0Ly8gcHJvbW90ZXMgYSBmb3JtYXR0ZXIgb24gcmUtcmVnaXN0ZXI6XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyQ2FjaGVkRm9ybWF0dGVyKG1ha2VGb3JtYXR0ZXIoJ2EnKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLCB7IGZvcm1hdHRlcnM6IFttYWtlRm9ybWF0dGVyKCdhJyksIG1ha2VGb3JtYXR0ZXIoJ2InKV0gfSk7XG5cblx0XHQvLyBuby1vcHMgaWYgYWxyZWFkeSBpbiBmaXJzdCBwbGFjZTpcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJDYWNoZWRGb3JtYXR0ZXIobWFrZUZvcm1hdHRlcignYScpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0sIHsgZm9ybWF0dGVyczogW21ha2VGb3JtYXR0ZXIoJ2EnKSwgbWFrZUZvcm1hdHRlcignYicpXSB9KTtcblxuXHRcdC8vIGxpbWl0cyB0aGUgY2FjaGU6XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCAxMDA7IGkrKykge1xuXHRcdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyQ2FjaGVkRm9ybWF0dGVyKG1ha2VGb3JtYXR0ZXIoYGkke2l9YCkpO1xuXHRcdH1cblx0XHRjb25zdCBleHBlY3RlZDogUmVzb3VyY2VMYWJlbEZvcm1hdHRlcltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDUwOyBpIDwgMTAwOyBpKyspIHtcblx0XHRcdGV4cGVjdGVkLnVuc2hpZnQobWFrZUZvcm1hdHRlcihgaSR7aX1gKSk7XG5cdFx0fVxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobSwgeyBmb3JtYXR0ZXJzOiBleHBlY3RlZCB9KTtcblxuXHRcdGRlbGV0ZSAobSBhcyBhbnkpLmZvcm1hdHRlcnM7XG5cdH0pO1xufSk7XG5cblxuc3VpdGUoJ211bHRpLXJvb3Qgd29ya3NwYWNlJywgKCkgPT4ge1xuXHRsZXQgbGFiZWxTZXJ2aWNlOiBMYWJlbFNlcnZpY2U7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRjb25zdCBzb3VyY2VzID0gVVJJLmZpbGUoJ2ZvbGRlcjEvc3JjJyk7XG5cdFx0Y29uc3QgdGVzdHMgPSBVUkkuZmlsZSgnZm9sZGVyMS90ZXN0Jyk7XG5cdFx0Y29uc3Qgb3RoZXIgPSBVUkkuZmlsZSgnZm9sZGVyMicpO1xuXG5cdFx0bGFiZWxTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBMYWJlbFNlcnZpY2UoXG5cdFx0XHRUZXN0RW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdFx0bmV3IFRlc3RDb250ZXh0U2VydmljZShcblx0XHRcdFx0bmV3IFdvcmtzcGFjZSgndGVzdC13b3Jrc3BhY2UnLCBbXG5cdFx0XHRcdFx0bmV3IFdvcmtzcGFjZUZvbGRlcih7IHVyaTogc291cmNlcywgaW5kZXg6IDAsIG5hbWU6ICdTb3VyY2VzJyB9KSxcblx0XHRcdFx0XHRuZXcgV29ya3NwYWNlRm9sZGVyKHsgdXJpOiB0ZXN0cywgaW5kZXg6IDEsIG5hbWU6ICdUZXN0cycgfSksXG5cdFx0XHRcdFx0bmV3IFdvcmtzcGFjZUZvbGRlcih7IHVyaTogb3RoZXIsIGluZGV4OiAyLCBuYW1lOiByZXNvdXJjZXMuYmFzZW5hbWUob3RoZXIpIH0pLFxuXHRcdFx0XHRdKSksXG5cdFx0XHRuZXcgVGVzdFBhdGhTZXJ2aWNlKCksXG5cdFx0XHRuZXcgVGVzdFJlbW90ZUFnZW50U2VydmljZSgpLFxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSksXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RMaWZlY3ljbGVTZXJ2aWNlKCkpXG5cdFx0KSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdsYWJlbHMgb2YgZmlsZXMgaW4gbXVsdGlyb290IHdvcmtzcGFjZXMgYXJlIHRoZSBmb2xkZXJuYW1lIGZvbGxvd2VkIGJ5IG9mZnNldCBmcm9tIHRoZSBmb2xkZXInLCAoKSA9PiB7XG5cdFx0bGFiZWxTZXJ2aWNlLnJlZ2lzdGVyRm9ybWF0dGVyKHtcblx0XHRcdHNjaGVtZTogJ2ZpbGUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyR7YXV0aG9yaXR5fSR7cGF0aH0nLFxuXHRcdFx0XHRzZXBhcmF0b3I6ICcvJyxcblx0XHRcdFx0dGlsZGlmeTogZmFsc2UsXG5cdFx0XHRcdG5vcm1hbGl6ZURyaXZlTGV0dGVyOiBmYWxzZSxcblx0XHRcdFx0YXV0aG9yaXR5UHJlZml4OiAnLy8nLFxuXHRcdFx0XHR3b3Jrc3BhY2VTdWZmaXg6ICcnXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0cyA9IHtcblx0XHRcdCdmb2xkZXIxL3NyYy9maWxlJzogJ1NvdXJjZXMgXHUyMDIyIGZpbGUnLFxuXHRcdFx0J2ZvbGRlcjEvc3JjL2ZvbGRlci9maWxlJzogJ1NvdXJjZXMgXHUyMDIyIGZvbGRlci9maWxlJyxcblx0XHRcdCdmb2xkZXIxL3NyYyc6ICdTb3VyY2VzJyxcblx0XHRcdCdmb2xkZXIxL290aGVyJzogJy9mb2xkZXIxL290aGVyJyxcblx0XHRcdCdmb2xkZXIyL290aGVyJzogJ2ZvbGRlcjIgXHUyMDIyIG90aGVyJyxcblx0XHR9O1xuXG5cdFx0T2JqZWN0LmVudHJpZXModGVzdHMpLmZvckVhY2goKFtwYXRoLCBsYWJlbF0pID0+IHtcblx0XHRcdGNvbnN0IGdlbmVyYXRlZCA9IGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChVUkkuZmlsZShwYXRoKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZW5lcmF0ZWQsIGxhYmVsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbGFiZWxzIHdpdGggY29udGV4dCBhZnRlciBwYXRoJywgKCkgPT4ge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICdmaWxlJyxcblx0XHRcdGZvcm1hdHRpbmc6IHtcblx0XHRcdFx0bGFiZWw6ICcke3BhdGh9ICgke3NjaGVtZX0pJyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLycsXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0cyA9IHtcblx0XHRcdCdmb2xkZXIxL3NyYy9maWxlJzogJ1NvdXJjZXMgXHUyMDIyIGZpbGUgKGZpbGUpJyxcblx0XHRcdCdmb2xkZXIxL3NyYy9mb2xkZXIvZmlsZSc6ICdTb3VyY2VzIFx1MjAyMiBmb2xkZXIvZmlsZSAoZmlsZSknLFxuXHRcdFx0J2ZvbGRlcjEvc3JjJzogJ1NvdXJjZXMnLFxuXHRcdFx0J2ZvbGRlcjEvb3RoZXInOiAnL2ZvbGRlcjEvb3RoZXIgKGZpbGUpJyxcblx0XHRcdCdmb2xkZXIyL290aGVyJzogJ2ZvbGRlcjIgXHUyMDIyIG90aGVyIChmaWxlKScsXG5cdFx0fTtcblxuXHRcdE9iamVjdC5lbnRyaWVzKHRlc3RzKS5mb3JFYWNoKChbcGF0aCwgbGFiZWxdKSA9PiB7XG5cdFx0XHRjb25zdCBnZW5lcmF0ZWQgPSBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoVVJJLmZpbGUocGF0aCksIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2VuZXJhdGVkLCBsYWJlbCwgcGF0aCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0cmlwUGF0aFN0YXJ0aW5nU2VwYXJhdG9yJywgKCkgPT4ge1xuXHRcdGxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRzY2hlbWU6ICdmaWxlJyxcblx0XHRcdGZvcm1hdHRpbmc6IHtcblx0XHRcdFx0bGFiZWw6ICcke3BhdGh9Jyxcblx0XHRcdFx0c2VwYXJhdG9yOiAnLycsXG5cdFx0XHRcdHN0cmlwUGF0aFN0YXJ0aW5nU2VwYXJhdG9yOiB0cnVlXG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRjb25zdCB0ZXN0cyA9IHtcblx0XHRcdCdmb2xkZXIxL3NyYy9maWxlJzogJ1NvdXJjZXMgXHUyMDIyIGZpbGUnLFxuXHRcdFx0J290aGVyL2JsYWgnOiAnb3RoZXIvYmxhaCcsXG5cdFx0fTtcblxuXHRcdE9iamVjdC5lbnRyaWVzKHRlc3RzKS5mb3JFYWNoKChbcGF0aCwgbGFiZWxdKSA9PiB7XG5cdFx0XHRjb25zdCBnZW5lcmF0ZWQgPSBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoVVJJLmZpbGUocGF0aCksIHsgcmVsYXRpdmU6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2VuZXJhdGVkLCBsYWJlbCwgcGF0aCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbGF0aXZlIGxhYmVsIHdpdGhvdXQgZm9ybWF0dGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJvb3RGb2xkZXIgPSBVUkkucGFyc2UoJ215c2NoZW1lOi8vbXlhdXRob3JpdHkvJyk7XG5cblx0XHRsYWJlbFNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IExhYmVsU2VydmljZShcblx0XHRcdFRlc3RFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0XHRuZXcgVGVzdENvbnRleHRTZXJ2aWNlKFxuXHRcdFx0XHRuZXcgV29ya3NwYWNlKCd0ZXN0LXdvcmtzcGFjZScsIFtcblx0XHRcdFx0XHRuZXcgV29ya3NwYWNlRm9sZGVyKHsgdXJpOiByb290Rm9sZGVyLCBpbmRleDogMCwgbmFtZTogJ0ZTUHJvb3RGb2xkZXInIH0pLFxuXHRcdFx0XHRdKSksXG5cdFx0XHRuZXcgVGVzdFBhdGhTZXJ2aWNlKHVuZGVmaW5lZCwgcm9vdEZvbGRlci5zY2hlbWUpLFxuXHRcdFx0bmV3IFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UoKSxcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdFN0b3JhZ2VTZXJ2aWNlKCkpLFxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0TGlmZWN5Y2xlU2VydmljZSgpKVxuXHRcdCkpO1xuXG5cdFx0Y29uc3QgZ2VuZXJhdGVkID0gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKFVSSS5wYXJzZSgnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS9zb21lL2ZvbGRlci90ZXN0LnR4dCcpLCB7IHJlbGF0aXZlOiB0cnVlIH0pO1xuXHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZW5lcmF0ZWQsICdzb21lXFxcXGZvbGRlclxcXFx0ZXN0LnR4dCcpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2VuZXJhdGVkLCAnc29tZS9mb2xkZXIvdGVzdC50eHQnKTtcblx0XHR9XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG5cbnN1aXRlKCd3b3Jrc3BhY2UgYXQgRlNQIHJvb3QnLCAoKSA9PiB7XG5cdGxldCBsYWJlbFNlcnZpY2U6IExhYmVsU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0Y29uc3Qgcm9vdEZvbGRlciA9IFVSSS5wYXJzZSgnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS8nKTtcblxuXHRcdGxhYmVsU2VydmljZSA9IG5ldyBMYWJlbFNlcnZpY2UoXG5cdFx0XHRUZXN0RW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdFx0bmV3IFRlc3RDb250ZXh0U2VydmljZShcblx0XHRcdFx0bmV3IFdvcmtzcGFjZSgndGVzdC13b3Jrc3BhY2UnLCBbXG5cdFx0XHRcdFx0bmV3IFdvcmtzcGFjZUZvbGRlcih7IHVyaTogcm9vdEZvbGRlciwgaW5kZXg6IDAsIG5hbWU6ICdGU1Byb290Rm9sZGVyJyB9KSxcblx0XHRcdFx0XSkpLFxuXHRcdFx0bmV3IFRlc3RQYXRoU2VydmljZSgpLFxuXHRcdFx0bmV3IFRlc3RSZW1vdGVBZ2VudFNlcnZpY2UoKSxcblx0XHRcdG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSxcblx0XHRcdG5ldyBUZXN0TGlmZWN5Y2xlU2VydmljZSgpXG5cdFx0KTtcblx0XHRsYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0c2NoZW1lOiAnbXlzY2hlbWUnLFxuXHRcdFx0Zm9ybWF0dGluZzoge1xuXHRcdFx0XHRsYWJlbDogJyR7c2NoZW1lfTovLyR7YXV0aG9yaXR5fSR7cGF0aH0nLFxuXHRcdFx0XHRzZXBhcmF0b3I6ICcvJyxcblx0XHRcdFx0dGlsZGlmeTogZmFsc2UsXG5cdFx0XHRcdG5vcm1hbGl6ZURyaXZlTGV0dGVyOiBmYWxzZSxcblx0XHRcdFx0d29ya3NwYWNlU3VmZml4OiAnJyxcblx0XHRcdFx0YXV0aG9yaXR5UHJlZml4OiAnJyxcblx0XHRcdFx0c3RyaXBQYXRoU3RhcnRpbmdTZXBhcmF0b3I6IGZhbHNlXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ25vbi1yZWxhdGl2ZSBsYWJlbCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHRlc3RzID0ge1xuXHRcdFx0J215c2NoZW1lOi8vbXlhdXRob3JpdHkvbXlGaWxlMS50eHQnOiAnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS9teUZpbGUxLnR4dCcsXG5cdFx0XHQnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS9mb2xkZXIvbXlGaWxlMi50eHQnOiAnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS9mb2xkZXIvbXlGaWxlMi50eHQnLFxuXHRcdH07XG5cblx0XHRPYmplY3QuZW50cmllcyh0ZXN0cykuZm9yRWFjaCgoW3VyaVN0cmluZywgbGFiZWxdKSA9PiB7XG5cdFx0XHRjb25zdCBnZW5lcmF0ZWQgPSBsYWJlbFNlcnZpY2UuZ2V0VXJpTGFiZWwoVVJJLnBhcnNlKHVyaVN0cmluZyksIHsgcmVsYXRpdmU6IGZhbHNlIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdlbmVyYXRlZCwgbGFiZWwpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWxhdGl2ZSBsYWJlbCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHRlc3RzID0ge1xuXHRcdFx0J215c2NoZW1lOi8vbXlhdXRob3JpdHkvbXlGaWxlMS50eHQnOiAnbXlGaWxlMS50eHQnLFxuXHRcdFx0J215c2NoZW1lOi8vbXlhdXRob3JpdHkvZm9sZGVyL215RmlsZTIudHh0JzogJ2ZvbGRlci9teUZpbGUyLnR4dCcsXG5cdFx0fTtcblxuXHRcdE9iamVjdC5lbnRyaWVzKHRlc3RzKS5mb3JFYWNoKChbdXJpU3RyaW5nLCBsYWJlbF0pID0+IHtcblx0XHRcdGNvbnN0IGdlbmVyYXRlZCA9IGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChVUkkucGFyc2UodXJpU3RyaW5nKSwgeyByZWxhdGl2ZTogdHJ1ZSB9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZW5lcmF0ZWQsIGxhYmVsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncmVsYXRpdmUgbGFiZWwgd2l0aCBleHBsaWNpdCBwYXRoIHNlcGFyYXRvcicsICgpID0+IHtcblx0XHRsZXQgZ2VuZXJhdGVkID0gbGFiZWxTZXJ2aWNlLmdldFVyaUxhYmVsKFVSSS5wYXJzZSgnbXlzY2hlbWU6Ly9teWF1dGhvcml0eS9zb21lL2ZvbGRlci90ZXN0LnR4dCcpLCB7IHJlbGF0aXZlOiB0cnVlLCBzZXBhcmF0b3I6ICcvJyB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2VuZXJhdGVkLCAnc29tZS9mb2xkZXIvdGVzdC50eHQnKTtcblxuXHRcdGdlbmVyYXRlZCA9IGxhYmVsU2VydmljZS5nZXRVcmlMYWJlbChVUkkucGFyc2UoJ215c2NoZW1lOi8vbXlhdXRob3JpdHkvc29tZS9mb2xkZXIvdGVzdC50eHQnKSwgeyByZWxhdGl2ZTogdHJ1ZSwgc2VwYXJhdG9yOiAnXFxcXCcgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdlbmVyYXRlZCwgJ3NvbWVcXFxcZm9sZGVyXFxcXHRlc3QudHh0Jyk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLGVBQWU7QUFDM0IsT0FBTyxZQUFZO0FBQ25CLFNBQVMsd0JBQXdCLHNCQUFzQixpQkFBaUIsOEJBQThCO0FBQ3RHLFNBQVMsV0FBVztBQUNwQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLG9CQUFvQiwwQkFBMEI7QUFDdkQsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxlQUFlLGlCQUFpQjtBQUN6QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGNBQWMscUJBQXFCO0FBQzVDLFNBQVMsZUFBZTtBQUV4QixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyx1QkFBdUI7QUFFaEMsTUFBTSxhQUFhLE1BQU07QUFDeEIsTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLE1BQU07QUFDWCxxQkFBaUIsSUFBSSxtQkFBbUI7QUFDeEMsbUJBQWUsSUFBSSxhQUFhLHdCQUF3QixJQUFJLG1CQUFtQixHQUFHLElBQUksZ0JBQWdCLElBQUksS0FBSyxTQUFTLENBQUMsR0FBRyxJQUFJLHVCQUF1QixHQUFHLGdCQUFnQixJQUFJLHFCQUFxQixDQUFDO0FBQUEsRUFDck0sQ0FBQztBQUVELDBDQUF3QztBQUV4QyxPQUFLLGlCQUFpQixXQUFZO0FBQ2pDLGlCQUFhLGtCQUFrQjtBQUFBLE1BQzlCLFFBQVE7QUFBQSxNQUNSLFlBQVk7QUFBQSxRQUNYLE9BQU87QUFBQSxRQUNQLFdBQVc7QUFBQSxRQUNYLFNBQVM7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
