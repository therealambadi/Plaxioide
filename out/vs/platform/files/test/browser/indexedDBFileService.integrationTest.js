import assert from "assert";
import { IndexedDB } from "../../../../base/browser/indexedDB.js";
import { bufferToReadable, bufferToStream, VSBuffer } from "../../../../base/common/buffer.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { basename, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { flakySuite } from "../../../../base/test/common/testUtils.js";
import { IndexedDBFileSystemProvider } from "../../browser/indexedDBFileSystemProvider.js";
import { FileOperation, FileOperationResult, FileSystemProviderErrorCode, FileType } from "../../common/files.js";
import { FileService } from "../../common/fileService.js";
import { NullLogService } from "../../../log/common/log.js";
flakySuite("IndexedDBFileSystemProvider", function() {
  let service;
  let userdataFileProvider;
  const testDir = "/";
  const userdataURIFromPaths = (paths) => joinPath(URI.from({ scheme: Schemas.vscodeUserData, path: testDir }), ...paths);
  const disposables = new DisposableStore();
  const initFixtures = async () => {
    await Promise.all(
      [
        ["fixtures", "resolver", "examples"],
        ["fixtures", "resolver", "other", "deep"],
        ["fixtures", "service", "deep"],
        ["batched"]
      ].map((path) => userdataURIFromPaths(path)).map((uri) => service.createFolder(uri))
    );
    await Promise.all(
      [
        [["fixtures", "resolver", "examples", "company.js"], "class company {}"],
        [["fixtures", "resolver", "examples", "conway.js"], "export function conway() {}"],
        [["fixtures", "resolver", "examples", "employee.js"], 'export const employee = "jax"'],
        [["fixtures", "resolver", "examples", "small.js"], ""],
        [["fixtures", "resolver", "other", "deep", "company.js"], "class company {}"],
        [["fixtures", "resolver", "other", "deep", "conway.js"], "export function conway() {}"],
        [["fixtures", "resolver", "other", "deep", "employee.js"], 'export const employee = "jax"'],
        [["fixtures", "resolver", "other", "deep", "small.js"], ""],
        [["fixtures", "resolver", "index.html"], "<p>p</p>"],
        [["fixtures", "resolver", "site.css"], ".p {color: red;}"],
        [["fixtures", "service", "deep", "company.js"], "class company {}"],
        [["fixtures", "service", "deep", "conway.js"], "export function conway() {}"],
        [["fixtures", "service", "deep", "employee.js"], 'export const employee = "jax"'],
        [["fixtures", "service", "deep", "small.js"], ""],
        [["fixtures", "service", "binary.txt"], "<p>p</p>"]
      ].map(([path, contents]) => [userdataURIFromPaths(path), contents]).map(([uri, contents]) => service.createFile(uri, VSBuffer.fromString(contents)))
    );
  };
  const reload = async () => {
    const logService = new NullLogService();
    service = new FileService(logService);
    disposables.add(service);
    const indexedDB = await IndexedDB.create("vscode-web-db-test", 1, ["vscode-userdata-store", "vscode-logs-store"]);
    userdataFileProvider = new IndexedDBFileSystemProvider(Schemas.vscodeUserData, indexedDB, "vscode-userdata-store", true);
    disposables.add(service.registerProvider(Schemas.vscodeUserData, userdataFileProvider));
    disposables.add(userdataFileProvider);
  };
  setup(async function() {
    this.timeout(15e3);
    await reload();
  });
  teardown(async () => {
    await userdataFileProvider.reset();
    disposables.clear();
  });
  test("root is always present", async () => {
    assert.strictEqual((await userdataFileProvider.stat(userdataURIFromPaths([]))).type, FileType.Directory);
    await userdataFileProvider.delete(userdataURIFromPaths([]), { recursive: true, useTrash: false, atomic: false });
    assert.strictEqual((await userdataFileProvider.stat(userdataURIFromPaths([]))).type, FileType.Directory);
  });
  test("createFolder", async () => {
    let event;
    disposables.add(service.onDidRunOperation((e) => event = e));
    const parent = await service.resolve(userdataURIFromPaths([]));
    const newFolderResource = joinPath(parent.resource, "newFolder");
    assert.strictEqual((await userdataFileProvider.readdir(parent.resource)).length, 0);
    const newFolder = await service.createFolder(newFolderResource);
    assert.strictEqual(newFolder.name, "newFolder");
    assert.strictEqual((await userdataFileProvider.readdir(parent.resource)).length, 1);
    assert.strictEqual((await userdataFileProvider.stat(newFolderResource)).type, FileType.Directory);
    assert.ok(event);
    assert.strictEqual(event.resource.path, newFolderResource.path);
    assert.strictEqual(event.operation, FileOperation.CREATE);
    assert.strictEqual(event.target.resource.path, newFolderResource.path);
    assert.strictEqual(event.target.isDirectory, true);
  });
  test("createFolder: creating multiple folders at once", async () => {
    let event;
    disposables.add(service.onDidRunOperation((e) => event = e));
    const multiFolderPaths = ["a", "couple", "of", "folders"];
    const parent = await service.resolve(userdataURIFromPaths([]));
    const newFolderResource = joinPath(parent.resource, ...multiFolderPaths);
    const newFolder = await service.createFolder(newFolderResource);
    const lastFolderName = multiFolderPaths[multiFolderPaths.length - 1];
    assert.strictEqual(newFolder.name, lastFolderName);
    assert.strictEqual((await userdataFileProvider.stat(newFolderResource)).type, FileType.Directory);
    assert.ok(event);
    assert.strictEqual(event.resource.path, newFolderResource.path);
    assert.strictEqual(event.operation, FileOperation.CREATE);
    assert.strictEqual(event.target.resource.path, newFolderResource.path);
    assert.strictEqual(event.target.isDirectory, true);
  });
  test("exists", async () => {
    let exists = await service.exists(userdataURIFromPaths([]));
    assert.strictEqual(exists, true);
    exists = await service.exists(userdataURIFromPaths(["hello"]));
    assert.strictEqual(exists, false);
  });
  test("resolve - file", async () => {
    await initFixtures();
    const resource = userdataURIFromPaths(["fixtures", "resolver", "index.html"]);
    const resolved = await service.resolve(resource);
    assert.strictEqual(resolved.name, "index.html");
    assert.strictEqual(resolved.isFile, true);
    assert.strictEqual(resolved.isDirectory, false);
    assert.strictEqual(resolved.isSymbolicLink, false);
    assert.strictEqual(resolved.resource.toString(), resource.toString());
    assert.strictEqual(resolved.children, void 0);
    assert.ok(resolved.size > 0);
  });
  test("resolve - directory", async () => {
    await initFixtures();
    const testsElements = ["examples", "other", "index.html", "site.css"];
    const resource = userdataURIFromPaths(["fixtures", "resolver"]);
    const result = await service.resolve(resource);
    assert.ok(result);
    assert.strictEqual(result.resource.toString(), resource.toString());
    assert.strictEqual(result.name, "resolver");
    assert.ok(result.children);
    assert.ok(result.children.length > 0);
    assert.ok(result.isDirectory);
    assert.strictEqual(result.children.length, testsElements.length);
    assert.ok(result.children.every((entry) => {
      return testsElements.some((name) => {
        return basename(entry.resource) === name;
      });
    }));
    result.children.forEach((value) => {
      assert.ok(basename(value.resource));
      if (["examples", "other"].indexOf(basename(value.resource)) >= 0) {
        assert.ok(value.isDirectory);
        assert.strictEqual(value.mtime, void 0);
        assert.strictEqual(value.ctime, void 0);
      } else if (basename(value.resource) === "index.html") {
        assert.ok(!value.isDirectory);
        assert.ok(!value.children);
        assert.strictEqual(value.mtime, void 0);
        assert.strictEqual(value.ctime, void 0);
      } else if (basename(value.resource) === "site.css") {
        assert.ok(!value.isDirectory);
        assert.ok(!value.children);
        assert.strictEqual(value.mtime, void 0);
        assert.strictEqual(value.ctime, void 0);
      } else {
        assert.fail("Unexpected value " + basename(value.resource));
      }
    });
  });
  test("createFile", async () => {
    return assertCreateFile((contents) => VSBuffer.fromString(contents));
  });
  test("createFile (readable)", async () => {
    return assertCreateFile((contents) => bufferToReadable(VSBuffer.fromString(contents)));
  });
  test("createFile (stream)", async () => {
    return assertCreateFile((contents) => bufferToStream(VSBuffer.fromString(contents)));
  });
  async function assertCreateFile(converter) {
    let event;
    disposables.add(service.onDidRunOperation((e) => event = e));
    const contents = "Hello World";
    const resource = userdataURIFromPaths(["test.txt"]);
    assert.strictEqual(await service.canCreateFile(resource), true);
    const fileStat = await service.createFile(resource, converter(contents));
    assert.strictEqual(fileStat.name, "test.txt");
    assert.strictEqual((await userdataFileProvider.stat(fileStat.resource)).type, FileType.File);
    assert.strictEqual(new TextDecoder().decode(await userdataFileProvider.readFile(fileStat.resource)), contents);
    assert.ok(event);
    assert.strictEqual(event.resource.path, resource.path);
    assert.strictEqual(event.operation, FileOperation.CREATE);
    assert.strictEqual(event.target.resource.path, resource.path);
  }
  const fileCreateBatchTester = (size, name) => {
    const batch = Array.from({ length: size }).map((_, i) => ({ contents: `Hello${i}`, resource: userdataURIFromPaths(["batched", name, `Hello${i}.txt`]) }));
    let creationPromises = void 0;
    return {
      async create() {
        return creationPromises = Promise.all(batch.map((entry) => userdataFileProvider.writeFile(entry.resource, VSBuffer.fromString(entry.contents).buffer, { create: true, overwrite: true, unlock: false, atomic: false })));
      },
      async assertContentsCorrect() {
        if (!creationPromises) {
          throw Error("read called before create");
        }
        await creationPromises;
        await Promise.all(batch.map(async (entry, i) => {
          assert.strictEqual((await userdataFileProvider.stat(entry.resource)).type, FileType.File);
          assert.strictEqual(new TextDecoder().decode(await userdataFileProvider.readFile(entry.resource)), entry.contents);
        }));
      }
    };
  };
  test("createFile - batch", async () => {
    const tester = fileCreateBatchTester(20, "batch");
    await tester.create();
    await tester.assertContentsCorrect();
  });
  test("createFile - batch (mixed parallel/sequential)", async () => {
    const batch1 = fileCreateBatchTester(1, "batch1");
    const batch2 = fileCreateBatchTester(20, "batch2");
    const batch3 = fileCreateBatchTester(1, "batch3");
    const batch4 = fileCreateBatchTester(20, "batch4");
    batch1.create();
    batch2.create();
    await Promise.all([batch1.assertContentsCorrect(), batch2.assertContentsCorrect()]);
    batch3.create();
    batch4.create();
    await Promise.all([batch3.assertContentsCorrect(), batch4.assertContentsCorrect()]);
    await Promise.all([batch1.assertContentsCorrect(), batch2.assertContentsCorrect()]);
  });
  test("rename not existing resource", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFile = joinPath(parent.resource, "sourceFile");
    const targetFile = joinPath(parent.resource, "targetFile");
    try {
      await service.move(sourceFile, targetFile, false);
    } catch (error) {
      assert.deepStrictEqual(error.code, FileSystemProviderErrorCode.FileNotFound);
      return;
    }
    assert.fail("This should fail with error");
  });
  test("rename to an existing file without overwrite", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFile = joinPath(parent.resource, "sourceFile");
    await service.writeFile(sourceFile, VSBuffer.fromString("This is source file"));
    const targetFile = joinPath(parent.resource, "targetFile");
    await service.writeFile(targetFile, VSBuffer.fromString("This is target file"));
    try {
      await service.move(sourceFile, targetFile, false);
    } catch (error) {
      assert.deepStrictEqual(error.fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
      return;
    }
    assert.fail("This should fail with error");
  });
  test("rename folder to an existing folder without overwrite", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFolder");
    await service.createFolder(sourceFolder);
    const targetFolder = joinPath(parent.resource, "targetFolder");
    await service.createFolder(targetFolder);
    try {
      await service.move(sourceFolder, targetFolder, false);
    } catch (error) {
      assert.deepStrictEqual(error.fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
      return;
    }
    assert.fail("This should fail with cannot overwrite error");
  });
  test("rename file to a folder", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFile = joinPath(parent.resource, "sourceFile");
    await service.writeFile(sourceFile, VSBuffer.fromString("This is source file"));
    const targetFolder = joinPath(parent.resource, "targetFolder");
    await service.createFolder(targetFolder);
    try {
      await service.move(sourceFile, targetFolder, false);
    } catch (error) {
      assert.deepStrictEqual(error.fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
      return;
    }
    assert.fail("This should fail with error");
  });
  test("rename folder to a file", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFile");
    await service.createFolder(sourceFolder);
    const targetFile = joinPath(parent.resource, "targetFile");
    await service.writeFile(targetFile, VSBuffer.fromString("This is target file"));
    try {
      await service.move(sourceFolder, targetFile, false);
    } catch (error) {
      assert.deepStrictEqual(error.fileOperationResult, FileOperationResult.FILE_MOVE_CONFLICT);
      return;
    }
    assert.fail("This should fail with error");
  });
  test("rename file", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFile = joinPath(parent.resource, "sourceFile");
    await service.writeFile(sourceFile, VSBuffer.fromString("This is source file"));
    const targetFile = joinPath(parent.resource, "targetFile");
    await service.move(sourceFile, targetFile, false);
    const content = await service.readFile(targetFile);
    assert.strictEqual(await service.exists(sourceFile), false);
    assert.strictEqual(content.value.toString(), "This is source file");
  });
  test("rename to an existing file with overwrite", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFile = joinPath(parent.resource, "sourceFile");
    const targetFile = joinPath(parent.resource, "targetFile");
    await Promise.all([
      service.writeFile(sourceFile, VSBuffer.fromString("This is source file")),
      service.writeFile(targetFile, VSBuffer.fromString("This is target file"))
    ]);
    await service.move(sourceFile, targetFile, true);
    const content = await service.readFile(targetFile);
    assert.strictEqual(await service.exists(sourceFile), false);
    assert.strictEqual(content.value.toString(), "This is source file");
  });
  test("rename folder to a new folder", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFolder");
    await service.createFolder(sourceFolder);
    const targetFolder = joinPath(parent.resource, "targetFolder");
    await service.move(sourceFolder, targetFolder, false);
    assert.deepStrictEqual(await service.exists(sourceFolder), false);
    assert.deepStrictEqual(await service.exists(targetFolder), true);
  });
  test("rename folder to an existing folder", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFolder");
    await service.createFolder(sourceFolder);
    const targetFolder = joinPath(parent.resource, "targetFolder");
    await service.createFolder(targetFolder);
    await service.move(sourceFolder, targetFolder, true);
    assert.deepStrictEqual(await service.exists(sourceFolder), false);
    assert.deepStrictEqual(await service.exists(targetFolder), true);
  });
  test("rename a folder that has multiple files and folders", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFolder");
    const sourceFile1 = joinPath(sourceFolder, "folder1", "file1");
    const sourceFile2 = joinPath(sourceFolder, "folder2", "file1");
    const sourceEmptyFolder = joinPath(sourceFolder, "folder3");
    await Promise.all([
      service.writeFile(sourceFile1, VSBuffer.fromString("Source File 1")),
      service.writeFile(sourceFile2, VSBuffer.fromString("Source File 2")),
      service.createFolder(sourceEmptyFolder)
    ]);
    const targetFolder = joinPath(parent.resource, "targetFolder");
    const targetFile1 = joinPath(targetFolder, "folder1", "file1");
    const targetFile2 = joinPath(targetFolder, "folder2", "file1");
    const targetEmptyFolder = joinPath(targetFolder, "folder3");
    await service.move(sourceFolder, targetFolder, false);
    assert.deepStrictEqual(await service.exists(sourceFolder), false);
    assert.deepStrictEqual(await service.exists(targetFolder), true);
    assert.strictEqual((await service.readFile(targetFile1)).value.toString(), "Source File 1");
    assert.strictEqual((await service.readFile(targetFile2)).value.toString(), "Source File 2");
    assert.deepStrictEqual(await service.exists(targetEmptyFolder), true);
  });
  test("rename a folder to another folder that has some files", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const sourceFolder = joinPath(parent.resource, "sourceFolder");
    const sourceFile1 = joinPath(sourceFolder, "folder1", "file1");
    const targetFolder = joinPath(parent.resource, "targetFolder");
    const targetFile1 = joinPath(targetFolder, "folder1", "file1");
    const targetFile2 = joinPath(targetFolder, "folder1", "file2");
    const targetFile3 = joinPath(targetFolder, "folder2", "file1");
    await Promise.all([
      service.writeFile(sourceFile1, VSBuffer.fromString("Source File 1")),
      service.writeFile(targetFile2, VSBuffer.fromString("Target File 2")),
      service.writeFile(targetFile3, VSBuffer.fromString("Target File 3"))
    ]);
    await service.move(sourceFolder, targetFolder, true);
    assert.deepStrictEqual(await service.exists(sourceFolder), false);
    assert.deepStrictEqual(await service.exists(targetFolder), true);
    assert.strictEqual((await service.readFile(targetFile1)).value.toString(), "Source File 1");
    assert.strictEqual(await service.exists(targetFile2), false);
    assert.strictEqual(await service.exists(targetFile3), false);
  });
  test("deleteFile", async () => {
    await initFixtures();
    let event;
    disposables.add(service.onDidRunOperation((e) => event = e));
    const anotherResource = userdataURIFromPaths(["fixtures", "service", "deep", "company.js"]);
    const resource = userdataURIFromPaths(["fixtures", "service", "deep", "conway.js"]);
    const source = await service.resolve(resource);
    assert.strictEqual(await service.canDelete(source.resource, { useTrash: false }), true);
    await service.del(source.resource, { useTrash: false });
    assert.strictEqual(await service.exists(source.resource), false);
    assert.strictEqual(await service.exists(anotherResource), true);
    assert.ok(event);
    assert.strictEqual(event.resource.path, resource.path);
    assert.strictEqual(event.operation, FileOperation.DELETE);
    {
      let error = void 0;
      try {
        await service.del(source.resource, { useTrash: false });
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.strictEqual(error.fileOperationResult, FileOperationResult.FILE_NOT_FOUND);
    }
    await reload();
    {
      let error = void 0;
      try {
        await service.del(source.resource, { useTrash: false });
      } catch (e) {
        error = e;
      }
      assert.ok(error);
      assert.strictEqual(error.fileOperationResult, FileOperationResult.FILE_NOT_FOUND);
    }
  });
  test("deleteFolder (recursive)", async () => {
    await initFixtures();
    let event;
    disposables.add(service.onDidRunOperation((e) => event = e));
    const resource = userdataURIFromPaths(["fixtures", "service", "deep"]);
    const subResource1 = userdataURIFromPaths(["fixtures", "service", "deep", "company.js"]);
    const subResource2 = userdataURIFromPaths(["fixtures", "service", "deep", "conway.js"]);
    assert.strictEqual(await service.exists(subResource1), true);
    assert.strictEqual(await service.exists(subResource2), true);
    const source = await service.resolve(resource);
    assert.strictEqual(await service.canDelete(source.resource, { recursive: true, useTrash: false }), true);
    await service.del(source.resource, { recursive: true, useTrash: false });
    assert.strictEqual(await service.exists(source.resource), false);
    assert.strictEqual(await service.exists(subResource1), false);
    assert.strictEqual(await service.exists(subResource2), false);
    assert.ok(event);
    assert.strictEqual(event.resource.fsPath, resource.fsPath);
    assert.strictEqual(event.operation, FileOperation.DELETE);
  });
  test("deleteFolder (non recursive)", async () => {
    await initFixtures();
    const resource = userdataURIFromPaths(["fixtures", "service", "deep"]);
    const source = await service.resolve(resource);
    assert.ok(await service.canDelete(source.resource) instanceof Error);
    let error;
    try {
      await service.del(source.resource);
    } catch (e) {
      error = e;
    }
    assert.ok(error);
  });
  test("delete empty folder", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const folder = joinPath(parent.resource, "folder");
    await service.createFolder(folder);
    await service.del(folder);
    assert.deepStrictEqual(await service.exists(folder), false);
  });
  test("delete empty folder with reccursive", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const folder = joinPath(parent.resource, "folder");
    await service.createFolder(folder);
    await service.del(folder, { recursive: true });
    assert.deepStrictEqual(await service.exists(folder), false);
  });
  test("deleteFolder with folders and files (recursive)", async () => {
    const parent = await service.resolve(userdataURIFromPaths([]));
    const targetFolder = joinPath(parent.resource, "targetFolder");
    const file1 = joinPath(targetFolder, "folder1", "file1");
    await service.createFile(file1);
    const file2 = joinPath(targetFolder, "folder2", "file1");
    await service.createFile(file2);
    const emptyFolder = joinPath(targetFolder, "folder3");
    await service.createFolder(emptyFolder);
    await service.del(targetFolder, { recursive: true });
    assert.deepStrictEqual(await service.exists(targetFolder), false);
    assert.deepStrictEqual(await service.exists(joinPath(targetFolder, "folder1")), false);
    assert.deepStrictEqual(await service.exists(joinPath(targetFolder, "folder2")), false);
    assert.deepStrictEqual(await service.exists(file1), false);
    assert.deepStrictEqual(await service.exists(file2), false);
    assert.deepStrictEqual(await service.exists(emptyFolder), false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy90ZXN0L2Jyb3dzZXIvaW5kZXhlZERCRmlsZVNlcnZpY2UuaW50ZWdyYXRpb25UZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgSW5kZXhlZERCIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2luZGV4ZWREQi5qcyc7XG5pbXBvcnQgeyBidWZmZXJUb1JlYWRhYmxlLCBidWZmZXJUb1N0cmVhbSwgVlNCdWZmZXIsIFZTQnVmZmVyUmVhZGFibGUsIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IEluZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvaW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IEZpbGVPcGVyYXRpb24sIEZpbGVPcGVyYXRpb25FcnJvciwgRmlsZU9wZXJhdGlvbkV2ZW50LCBGaWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvciwgRmlsZVN5c3RlbVByb3ZpZGVyRXJyb3JDb2RlLCBGaWxlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2xvZy9jb21tb24vbG9nLmpzJztcblxuZmxha3lTdWl0ZSgnSW5kZXhlZERCRmlsZVN5c3RlbVByb3ZpZGVyJywgZnVuY3Rpb24gKCkge1xuXG5cdGxldCBzZXJ2aWNlOiBGaWxlU2VydmljZTtcblx0bGV0IHVzZXJkYXRhRmlsZVByb3ZpZGVyOiBJbmRleGVkREJGaWxlU3lzdGVtUHJvdmlkZXI7XG5cdGNvbnN0IHRlc3REaXIgPSAnLyc7XG5cblx0Y29uc3QgdXNlcmRhdGFVUklGcm9tUGF0aHMgPSAocGF0aHM6IHJlYWRvbmx5IHN0cmluZ1tdKSA9PiBqb2luUGF0aChVUkkuZnJvbSh7IHNjaGVtZTogU2NoZW1hcy52c2NvZGVVc2VyRGF0YSwgcGF0aDogdGVzdERpciB9KSwgLi4ucGF0aHMpO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0IGluaXRGaXh0dXJlcyA9IGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChcblx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ2V4YW1wbGVzJ10sXG5cdFx0XHRbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ290aGVyJywgJ2RlZXAnXSxcblx0XHRcdFsnZml4dHVyZXMnLCAnc2VydmljZScsICdkZWVwJ10sXG5cdFx0XHRbJ2JhdGNoZWQnXV1cblx0XHRcdFx0Lm1hcChwYXRoID0+IHVzZXJkYXRhVVJJRnJvbVBhdGhzKHBhdGgpKVxuXHRcdFx0XHQubWFwKHVyaSA9PiBzZXJ2aWNlLmNyZWF0ZUZvbGRlcih1cmkpKSk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoXG5cdFx0XHQoW1xuXHRcdFx0XHRbWydmaXh0dXJlcycsICdyZXNvbHZlcicsICdleGFtcGxlcycsICdjb21wYW55LmpzJ10sICdjbGFzcyBjb21wYW55IHt9J10sXG5cdFx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ2V4YW1wbGVzJywgJ2NvbndheS5qcyddLCAnZXhwb3J0IGZ1bmN0aW9uIGNvbndheSgpIHt9J10sXG5cdFx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ2V4YW1wbGVzJywgJ2VtcGxveWVlLmpzJ10sICdleHBvcnQgY29uc3QgZW1wbG95ZWUgPSBcImpheFwiJ10sXG5cdFx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ2V4YW1wbGVzJywgJ3NtYWxsLmpzJ10sICcnXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAncmVzb2x2ZXInLCAnb3RoZXInLCAnZGVlcCcsICdjb21wYW55LmpzJ10sICdjbGFzcyBjb21wYW55IHt9J10sXG5cdFx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3Jlc29sdmVyJywgJ290aGVyJywgJ2RlZXAnLCAnY29ud2F5LmpzJ10sICdleHBvcnQgZnVuY3Rpb24gY29ud2F5KCkge30nXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAncmVzb2x2ZXInLCAnb3RoZXInLCAnZGVlcCcsICdlbXBsb3llZS5qcyddLCAnZXhwb3J0IGNvbnN0IGVtcGxveWVlID0gXCJqYXhcIiddLFxuXHRcdFx0XHRbWydmaXh0dXJlcycsICdyZXNvbHZlcicsICdvdGhlcicsICdkZWVwJywgJ3NtYWxsLmpzJ10sICcnXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAncmVzb2x2ZXInLCAnaW5kZXguaHRtbCddLCAnPHA+cDwvcD4nXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAncmVzb2x2ZXInLCAnc2l0ZS5jc3MnXSwgJy5wIHtjb2xvcjogcmVkO30nXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAnc2VydmljZScsICdkZWVwJywgJ2NvbXBhbnkuanMnXSwgJ2NsYXNzIGNvbXBhbnkge30nXSxcblx0XHRcdFx0W1snZml4dHVyZXMnLCAnc2VydmljZScsICdkZWVwJywgJ2NvbndheS5qcyddLCAnZXhwb3J0IGZ1bmN0aW9uIGNvbndheSgpIHt9J10sXG5cdFx0XHRcdFtbJ2ZpeHR1cmVzJywgJ3NlcnZpY2UnLCAnZGVlcCcsICdlbXBsb3llZS5qcyddLCAnZXhwb3J0IGNvbnN0IGVtcGxveWVlID0gXCJqYXhcIiddLFxuXHRcdFx0XHRbWydmaXh0dXJlcycsICdzZXJ2aWNlJywgJ2RlZXAnLCAnc21hbGwuanMnXSwgJyddLFxuXHRcdFx0XHRbWydmaXh0dXJlcycsICdzZXJ2aWNlJywgJ2JpbmFyeS50eHQnXSwgJzxwPnA8L3A+J10sXG5cdFx0XHRdIGFzIGNvbnN0KVxuXHRcdFx0XHQubWFwKChbcGF0aCwgY29udGVudHNdKSA9PiBbdXNlcmRhdGFVUklGcm9tUGF0aHMocGF0aCksIGNvbnRlbnRzXSBhcyBjb25zdClcblx0XHRcdFx0Lm1hcCgoW3VyaSwgY29udGVudHNdKSA9PiBzZXJ2aWNlLmNyZWF0ZUZpbGUodXJpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSkpXG5cdFx0KTtcblx0fTtcblxuXHRjb25zdCByZWxvYWQgPSBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9nU2VydmljZSA9IG5ldyBOdWxsTG9nU2VydmljZSgpO1xuXG5cdFx0c2VydmljZSA9IG5ldyBGaWxlU2VydmljZShsb2dTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZSk7XG5cblx0XHRjb25zdCBpbmRleGVkREIgPSBhd2FpdCBJbmRleGVkREIuY3JlYXRlKCd2c2NvZGUtd2ViLWRiLXRlc3QnLCAxLCBbJ3ZzY29kZS11c2VyZGF0YS1zdG9yZScsICd2c2NvZGUtbG9ncy1zdG9yZSddKTtcblxuXHRcdHVzZXJkYXRhRmlsZVByb3ZpZGVyID0gbmV3IEluZGV4ZWREQkZpbGVTeXN0ZW1Qcm92aWRlcihTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCBpbmRleGVkREIsICd2c2NvZGUtdXNlcmRhdGEtc3RvcmUnLCB0cnVlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIHVzZXJkYXRhRmlsZVByb3ZpZGVyKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHVzZXJkYXRhRmlsZVByb3ZpZGVyKTtcblx0fTtcblxuXHRzZXR1cChhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0dGhpcy50aW1lb3V0KDE1MDAwKTtcblx0XHRhd2FpdCByZWxvYWQoKTtcblx0fSk7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVzZXJkYXRhRmlsZVByb3ZpZGVyLnJlc2V0KCk7XG5cdFx0ZGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fSk7XG5cblx0dGVzdCgncm9vdCBpcyBhbHdheXMgcHJlc2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IHVzZXJkYXRhRmlsZVByb3ZpZGVyLnN0YXQodXNlcmRhdGFVUklGcm9tUGF0aHMoW10pKSkudHlwZSwgRmlsZVR5cGUuRGlyZWN0b3J5KTtcblx0XHRhd2FpdCB1c2VyZGF0YUZpbGVQcm92aWRlci5kZWxldGUodXNlcmRhdGFVUklGcm9tUGF0aHMoW10pLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgdXNlVHJhc2g6IGZhbHNlLCBhdG9taWM6IGZhbHNlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgdXNlcmRhdGFGaWxlUHJvdmlkZXIuc3RhdCh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpKS50eXBlLCBGaWxlVHlwZS5EaXJlY3RvcnkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVGb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0bGV0IGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQgfCB1bmRlZmluZWQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZSA9PiBldmVudCA9IGUpKTtcblxuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IG5ld0ZvbGRlclJlc291cmNlID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAnbmV3Rm9sZGVyJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IHVzZXJkYXRhRmlsZVByb3ZpZGVyLnJlYWRkaXIocGFyZW50LnJlc291cmNlKSkubGVuZ3RoLCAwKTtcblx0XHRjb25zdCBuZXdGb2xkZXIgPSBhd2FpdCBzZXJ2aWNlLmNyZWF0ZUZvbGRlcihuZXdGb2xkZXJSZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0ZvbGRlci5uYW1lLCAnbmV3Rm9sZGVyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB1c2VyZGF0YUZpbGVQcm92aWRlci5yZWFkZGlyKHBhcmVudC5yZXNvdXJjZSkpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB1c2VyZGF0YUZpbGVQcm92aWRlci5zdGF0KG5ld0ZvbGRlclJlc291cmNlKSkudHlwZSwgRmlsZVR5cGUuRGlyZWN0b3J5KTtcblxuXHRcdGFzc2VydC5vayhldmVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50LnJlc291cmNlLnBhdGgsIG5ld0ZvbGRlclJlc291cmNlLnBhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudC5vcGVyYXRpb24sIEZpbGVPcGVyYXRpb24uQ1JFQVRFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudGFyZ2V0IS5yZXNvdXJjZS5wYXRoLCBuZXdGb2xkZXJSZXNvdXJjZS5wYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQudGFyZ2V0IS5pc0RpcmVjdG9yeSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUZvbGRlcjogY3JlYXRpbmcgbXVsdGlwbGUgZm9sZGVycyBhdCBvbmNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBldmVudDogRmlsZU9wZXJhdGlvbkV2ZW50O1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXJ2aWNlLm9uRGlkUnVuT3BlcmF0aW9uKGUgPT4gZXZlbnQgPSBlKSk7XG5cblx0XHRjb25zdCBtdWx0aUZvbGRlclBhdGhzID0gWydhJywgJ2NvdXBsZScsICdvZicsICdmb2xkZXJzJ107XG5cdFx0Y29uc3QgcGFyZW50ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHVzZXJkYXRhVVJJRnJvbVBhdGhzKFtdKSk7XG5cdFx0Y29uc3QgbmV3Rm9sZGVyUmVzb3VyY2UgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsIC4uLm11bHRpRm9sZGVyUGF0aHMpO1xuXG5cdFx0Y29uc3QgbmV3Rm9sZGVyID0gYXdhaXQgc2VydmljZS5jcmVhdGVGb2xkZXIobmV3Rm9sZGVyUmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgbGFzdEZvbGRlck5hbWUgPSBtdWx0aUZvbGRlclBhdGhzW211bHRpRm9sZGVyUGF0aHMubGVuZ3RoIC0gMV07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG5ld0ZvbGRlci5uYW1lLCBsYXN0Rm9sZGVyTmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB1c2VyZGF0YUZpbGVQcm92aWRlci5zdGF0KG5ld0ZvbGRlclJlc291cmNlKSkudHlwZSwgRmlsZVR5cGUuRGlyZWN0b3J5KTtcblxuXHRcdGFzc2VydC5vayhldmVudCEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudCEucmVzb3VyY2UucGF0aCwgbmV3Rm9sZGVyUmVzb3VyY2UucGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50IS5vcGVyYXRpb24sIEZpbGVPcGVyYXRpb24uQ1JFQVRFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLnRhcmdldCEucmVzb3VyY2UucGF0aCwgbmV3Rm9sZGVyUmVzb3VyY2UucGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50IS50YXJnZXQhLmlzRGlyZWN0b3J5LCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGxldCBleGlzdHMgPSBhd2FpdCBzZXJ2aWNlLmV4aXN0cyh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGlzdHMsIHRydWUpO1xuXG5cdFx0ZXhpc3RzID0gYXdhaXQgc2VydmljZS5leGlzdHModXNlcmRhdGFVUklGcm9tUGF0aHMoWydoZWxsbyddKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXN0cywgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlIC0gZmlsZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBpbml0Rml4dHVyZXMoKTtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gdXNlcmRhdGFVUklGcm9tUGF0aHMoWydmaXh0dXJlcycsICdyZXNvbHZlcicsICdpbmRleC5odG1sJ10pO1xuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC5uYW1lLCAnaW5kZXguaHRtbCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC5pc0ZpbGUsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC5pc0RpcmVjdG9yeSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC5pc1N5bWJvbGljTGluaywgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlZC5yZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzb2x2ZWQuY2hpbGRyZW4sIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc29sdmVkLnNpemUhID4gMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgLSBkaXJlY3RvcnknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgaW5pdEZpeHR1cmVzKCk7XG5cblx0XHRjb25zdCB0ZXN0c0VsZW1lbnRzID0gWydleGFtcGxlcycsICdvdGhlcicsICdpbmRleC5odG1sJywgJ3NpdGUuY3NzJ107XG5cblx0XHRjb25zdCByZXNvdXJjZSA9IHVzZXJkYXRhVVJJRnJvbVBhdGhzKFsnZml4dHVyZXMnLCAncmVzb2x2ZXInXSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5vayhyZXN1bHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5uYW1lLCAncmVzb2x2ZXInKTtcblx0XHRhc3NlcnQub2socmVzdWx0LmNoaWxkcmVuKTtcblx0XHRhc3NlcnQub2socmVzdWx0LmNoaWxkcmVuLmxlbmd0aCA+IDApO1xuXHRcdGFzc2VydC5vayhyZXN1bHQuaXNEaXJlY3RvcnkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuY2hpbGRyZW4ubGVuZ3RoLCB0ZXN0c0VsZW1lbnRzLmxlbmd0aCk7XG5cblx0XHRhc3NlcnQub2socmVzdWx0LmNoaWxkcmVuLmV2ZXJ5KGVudHJ5ID0+IHtcblx0XHRcdHJldHVybiB0ZXN0c0VsZW1lbnRzLnNvbWUobmFtZSA9PiB7XG5cdFx0XHRcdHJldHVybiBiYXNlbmFtZShlbnRyeS5yZXNvdXJjZSkgPT09IG5hbWU7XG5cdFx0XHR9KTtcblx0XHR9KSk7XG5cblx0XHRyZXN1bHQuY2hpbGRyZW4uZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRhc3NlcnQub2soYmFzZW5hbWUodmFsdWUucmVzb3VyY2UpKTtcblx0XHRcdGlmIChbJ2V4YW1wbGVzJywgJ290aGVyJ10uaW5kZXhPZihiYXNlbmFtZSh2YWx1ZS5yZXNvdXJjZSkpID49IDApIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKHZhbHVlLmlzRGlyZWN0b3J5KTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLm10aW1lLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUuY3RpbWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR9IGVsc2UgaWYgKGJhc2VuYW1lKHZhbHVlLnJlc291cmNlKSA9PT0gJ2luZGV4Lmh0bWwnKSB7XG5cdFx0XHRcdGFzc2VydC5vayghdmFsdWUuaXNEaXJlY3RvcnkpO1xuXHRcdFx0XHRhc3NlcnQub2soIXZhbHVlLmNoaWxkcmVuKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLm10aW1lLCB1bmRlZmluZWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUuY3RpbWUsIHVuZGVmaW5lZCk7XG5cdFx0XHR9IGVsc2UgaWYgKGJhc2VuYW1lKHZhbHVlLnJlc291cmNlKSA9PT0gJ3NpdGUuY3NzJykge1xuXHRcdFx0XHRhc3NlcnQub2soIXZhbHVlLmlzRGlyZWN0b3J5KTtcblx0XHRcdFx0YXNzZXJ0Lm9rKCF2YWx1ZS5jaGlsZHJlbik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5tdGltZSwgdW5kZWZpbmVkKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmN0aW1lLCB1bmRlZmluZWQpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgdmFsdWUgJyArIGJhc2VuYW1lKHZhbHVlLnJlc291cmNlKSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIGFzc2VydENyZWF0ZUZpbGUoY29udGVudHMgPT4gVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50cykpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVGaWxlIChyZWFkYWJsZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIGFzc2VydENyZWF0ZUZpbGUoY29udGVudHMgPT4gYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVGaWxlIChzdHJlYW0pJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBhc3NlcnRDcmVhdGVGaWxlKGNvbnRlbnRzID0+IGJ1ZmZlclRvU3RyZWFtKFZTQnVmZmVyLmZyb21TdHJpbmcoY29udGVudHMpKSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydENyZWF0ZUZpbGUoY29udmVydGVyOiAoY29udGVudDogc3RyaW5nKSA9PiBWU0J1ZmZlciB8IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0bGV0IGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZSA9PiBldmVudCA9IGUpKTtcblxuXHRcdGNvbnN0IGNvbnRlbnRzID0gJ0hlbGxvIFdvcmxkJztcblx0XHRjb25zdCByZXNvdXJjZSA9IHVzZXJkYXRhVVJJRnJvbVBhdGhzKFsndGVzdC50eHQnXSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5jYW5DcmVhdGVGaWxlKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0Y29uc3QgZmlsZVN0YXQgPSBhd2FpdCBzZXJ2aWNlLmNyZWF0ZUZpbGUocmVzb3VyY2UsIGNvbnZlcnRlcihjb250ZW50cykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlU3RhdC5uYW1lLCAndGVzdC50eHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IHVzZXJkYXRhRmlsZVByb3ZpZGVyLnN0YXQoZmlsZVN0YXQucmVzb3VyY2UpKS50eXBlLCBGaWxlVHlwZS5GaWxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobmV3IFRleHREZWNvZGVyKCkuZGVjb2RlKGF3YWl0IHVzZXJkYXRhRmlsZVByb3ZpZGVyLnJlYWRGaWxlKGZpbGVTdGF0LnJlc291cmNlKSksIGNvbnRlbnRzKTtcblxuXHRcdGFzc2VydC5vayhldmVudCEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudCEucmVzb3VyY2UucGF0aCwgcmVzb3VyY2UucGF0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV2ZW50IS5vcGVyYXRpb24sIEZpbGVPcGVyYXRpb24uQ1JFQVRFKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLnRhcmdldCEucmVzb3VyY2UucGF0aCwgcmVzb3VyY2UucGF0aCk7XG5cdH1cblxuXHRjb25zdCBmaWxlQ3JlYXRlQmF0Y2hUZXN0ZXIgPSAoc2l6ZTogbnVtYmVyLCBuYW1lOiBzdHJpbmcpID0+IHtcblx0XHRjb25zdCBiYXRjaCA9IEFycmF5LmZyb20oeyBsZW5ndGg6IHNpemUgfSkubWFwKChfLCBpKSA9PiAoeyBjb250ZW50czogYEhlbGxvJHtpfWAsIHJlc291cmNlOiB1c2VyZGF0YVVSSUZyb21QYXRocyhbJ2JhdGNoZWQnLCBuYW1lLCBgSGVsbG8ke2l9LnR4dGBdKSB9KSk7XG5cdFx0bGV0IGNyZWF0aW9uUHJvbWlzZXM6IFByb21pc2U8YW55PiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YXN5bmMgY3JlYXRlKCkge1xuXHRcdFx0XHRyZXR1cm4gY3JlYXRpb25Qcm9taXNlcyA9IFByb21pc2UuYWxsKGJhdGNoLm1hcChlbnRyeSA9PiB1c2VyZGF0YUZpbGVQcm92aWRlci53cml0ZUZpbGUoZW50cnkucmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoZW50cnkuY29udGVudHMpLmJ1ZmZlciwgeyBjcmVhdGU6IHRydWUsIG92ZXJ3cml0ZTogdHJ1ZSwgdW5sb2NrOiBmYWxzZSwgYXRvbWljOiBmYWxzZSB9KSkpO1xuXHRcdFx0fSxcblx0XHRcdGFzeW5jIGFzc2VydENvbnRlbnRzQ29ycmVjdCgpIHtcblx0XHRcdFx0aWYgKCFjcmVhdGlvblByb21pc2VzKSB7IHRocm93IEVycm9yKCdyZWFkIGNhbGxlZCBiZWZvcmUgY3JlYXRlJyk7IH1cblx0XHRcdFx0YXdhaXQgY3JlYXRpb25Qcm9taXNlcztcblx0XHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoYmF0Y2gubWFwKGFzeW5jIChlbnRyeSwgaSkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgdXNlcmRhdGFGaWxlUHJvdmlkZXIuc3RhdChlbnRyeS5yZXNvdXJjZSkpLnR5cGUsIEZpbGVUeXBlLkZpbGUpO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChuZXcgVGV4dERlY29kZXIoKS5kZWNvZGUoYXdhaXQgdXNlcmRhdGFGaWxlUHJvdmlkZXIucmVhZEZpbGUoZW50cnkucmVzb3VyY2UpKSwgZW50cnkuY29udGVudHMpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fTtcblxuXHR0ZXN0KCdjcmVhdGVGaWxlIC0gYmF0Y2gnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdGVyID0gZmlsZUNyZWF0ZUJhdGNoVGVzdGVyKDIwLCAnYmF0Y2gnKTtcblx0XHRhd2FpdCB0ZXN0ZXIuY3JlYXRlKCk7XG5cdFx0YXdhaXQgdGVzdGVyLmFzc2VydENvbnRlbnRzQ29ycmVjdCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVGaWxlIC0gYmF0Y2ggKG1peGVkIHBhcmFsbGVsL3NlcXVlbnRpYWwpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhdGNoMSA9IGZpbGVDcmVhdGVCYXRjaFRlc3RlcigxLCAnYmF0Y2gxJyk7XG5cdFx0Y29uc3QgYmF0Y2gyID0gZmlsZUNyZWF0ZUJhdGNoVGVzdGVyKDIwLCAnYmF0Y2gyJyk7XG5cdFx0Y29uc3QgYmF0Y2gzID0gZmlsZUNyZWF0ZUJhdGNoVGVzdGVyKDEsICdiYXRjaDMnKTtcblx0XHRjb25zdCBiYXRjaDQgPSBmaWxlQ3JlYXRlQmF0Y2hUZXN0ZXIoMjAsICdiYXRjaDQnKTtcblxuXHRcdGJhdGNoMS5jcmVhdGUoKTtcblx0XHRiYXRjaDIuY3JlYXRlKCk7XG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2JhdGNoMS5hc3NlcnRDb250ZW50c0NvcnJlY3QoKSwgYmF0Y2gyLmFzc2VydENvbnRlbnRzQ29ycmVjdCgpXSk7XG5cdFx0YmF0Y2gzLmNyZWF0ZSgpO1xuXHRcdGJhdGNoNC5jcmVhdGUoKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChbYmF0Y2gzLmFzc2VydENvbnRlbnRzQ29ycmVjdCgpLCBiYXRjaDQuYXNzZXJ0Q29udGVudHNDb3JyZWN0KCldKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbChbYmF0Y2gxLmFzc2VydENvbnRlbnRzQ29ycmVjdCgpLCBiYXRjaDIuYXNzZXJ0Q29udGVudHNDb3JyZWN0KCldKTtcblx0fSk7XG5cblx0dGVzdCgncmVuYW1lIG5vdCBleGlzdGluZyByZXNvdXJjZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYXJlbnQgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmUodXNlcmRhdGFVUklGcm9tUGF0aHMoW10pKTtcblx0XHRjb25zdCBzb3VyY2VGaWxlID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAnc291cmNlRmlsZScpO1xuXHRcdGNvbnN0IHRhcmdldEZpbGUgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICd0YXJnZXRGaWxlJyk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgc2VydmljZS5tb3ZlKHNvdXJjZUZpbGUsIHRhcmdldEZpbGUsIGZhbHNlKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCgoPEZpbGVTeXN0ZW1Qcm92aWRlckVycm9yPmVycm9yKS5jb2RlLCBGaWxlU3lzdGVtUHJvdmlkZXJFcnJvckNvZGUuRmlsZU5vdEZvdW5kKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhc3NlcnQuZmFpbCgnVGhpcyBzaG91bGQgZmFpbCB3aXRoIGVycm9yJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmFtZSB0byBhbiBleGlzdGluZyBmaWxlIHdpdGhvdXQgb3ZlcndyaXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IHNvdXJjZUZpbGUgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICdzb3VyY2VGaWxlJyk7XG5cdFx0YXdhaXQgc2VydmljZS53cml0ZUZpbGUoc291cmNlRmlsZSwgVlNCdWZmZXIuZnJvbVN0cmluZygnVGhpcyBpcyBzb3VyY2UgZmlsZScpKTtcblxuXHRcdGNvbnN0IHRhcmdldEZpbGUgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICd0YXJnZXRGaWxlJyk7XG5cdFx0YXdhaXQgc2VydmljZS53cml0ZUZpbGUodGFyZ2V0RmlsZSwgVlNCdWZmZXIuZnJvbVN0cmluZygnVGhpcyBpcyB0YXJnZXQgZmlsZScpKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLm1vdmUoc291cmNlRmlsZSwgdGFyZ2V0RmlsZSwgZmFsc2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKCg8RmlsZU9wZXJhdGlvbkVycm9yPmVycm9yKS5maWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTU9WRV9DT05GTElDVCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LmZhaWwoJ1RoaXMgc2hvdWxkIGZhaWwgd2l0aCBlcnJvcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW5hbWUgZm9sZGVyIHRvIGFuIGV4aXN0aW5nIGZvbGRlciB3aXRob3V0IG92ZXJ3cml0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBwYXJlbnQgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmUodXNlcmRhdGFVUklGcm9tUGF0aHMoW10pKTtcblx0XHRjb25zdCBzb3VyY2VGb2xkZXIgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICdzb3VyY2VGb2xkZXInKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmNyZWF0ZUZvbGRlcihzb3VyY2VGb2xkZXIpO1xuXHRcdGNvbnN0IHRhcmdldEZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3RhcmdldEZvbGRlcicpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKHRhcmdldEZvbGRlcik7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgc2VydmljZS5tb3ZlKHNvdXJjZUZvbGRlciwgdGFyZ2V0Rm9sZGVyLCBmYWxzZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT1ZFX0NPTkZMSUNUKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhc3NlcnQuZmFpbCgnVGhpcyBzaG91bGQgZmFpbCB3aXRoIGNhbm5vdCBvdmVyd3JpdGUgZXJyb3InKTtcblx0fSk7XG5cblx0dGVzdCgncmVuYW1lIGZpbGUgdG8gYSBmb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFyZW50ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHVzZXJkYXRhVVJJRnJvbVBhdGhzKFtdKSk7XG5cdFx0Y29uc3Qgc291cmNlRmlsZSA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZpbGUnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlRmlsZShzb3VyY2VGaWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdUaGlzIGlzIHNvdXJjZSBmaWxlJykpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0Rm9sZGVyID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAndGFyZ2V0Rm9sZGVyJyk7XG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGVGb2xkZXIodGFyZ2V0Rm9sZGVyKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLm1vdmUoc291cmNlRmlsZSwgdGFyZ2V0Rm9sZGVyLCBmYWxzZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKDxGaWxlT3BlcmF0aW9uRXJyb3I+ZXJyb3IpLmZpbGVPcGVyYXRpb25SZXN1bHQsIEZpbGVPcGVyYXRpb25SZXN1bHQuRklMRV9NT1ZFX0NPTkZMSUNUKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhc3NlcnQuZmFpbCgnVGhpcyBzaG91bGQgZmFpbCB3aXRoIGVycm9yJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmFtZSBmb2xkZXIgdG8gYSBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IHNvdXJjZUZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZpbGUnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmNyZWF0ZUZvbGRlcihzb3VyY2VGb2xkZXIpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0RmlsZSA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3RhcmdldEZpbGUnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlRmlsZSh0YXJnZXRGaWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdUaGlzIGlzIHRhcmdldCBmaWxlJykpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHNlcnZpY2UubW92ZShzb3VyY2VGb2xkZXIsIHRhcmdldEZpbGUsIGZhbHNlKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCgoPEZpbGVPcGVyYXRpb25FcnJvcj5lcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX01PVkVfQ09ORkxJQ1QpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGFzc2VydC5mYWlsKCdUaGlzIHNob3VsZCBmYWlsIHdpdGggZXJyb3InKTtcblx0fSk7XG5cblx0dGVzdCgncmVuYW1lIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFyZW50ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHVzZXJkYXRhVVJJRnJvbVBhdGhzKFtdKSk7XG5cdFx0Y29uc3Qgc291cmNlRmlsZSA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZpbGUnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlRmlsZShzb3VyY2VGaWxlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdUaGlzIGlzIHNvdXJjZSBmaWxlJykpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0RmlsZSA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3RhcmdldEZpbGUnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLm1vdmUoc291cmNlRmlsZSwgdGFyZ2V0RmlsZSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHNlcnZpY2UucmVhZEZpbGUodGFyZ2V0RmlsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHNvdXJjZUZpbGUpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSwgJ1RoaXMgaXMgc291cmNlIGZpbGUnKTtcblx0fSk7XG5cblx0dGVzdCgncmVuYW1lIHRvIGFuIGV4aXN0aW5nIGZpbGUgd2l0aCBvdmVyd3JpdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFyZW50ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHVzZXJkYXRhVVJJRnJvbVBhdGhzKFtdKSk7XG5cdFx0Y29uc3Qgc291cmNlRmlsZSA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZpbGUnKTtcblx0XHRjb25zdCB0YXJnZXRGaWxlID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAndGFyZ2V0RmlsZScpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0c2VydmljZS53cml0ZUZpbGUoc291cmNlRmlsZSwgVlNCdWZmZXIuZnJvbVN0cmluZygnVGhpcyBpcyBzb3VyY2UgZmlsZScpKSxcblx0XHRcdHNlcnZpY2Uud3JpdGVGaWxlKHRhcmdldEZpbGUsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1RoaXMgaXMgdGFyZ2V0IGZpbGUnKSlcblx0XHRdKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UubW92ZShzb3VyY2VGaWxlLCB0YXJnZXRGaWxlLCB0cnVlKTtcblxuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlKHRhcmdldEZpbGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhzb3VyY2VGaWxlKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50LnZhbHVlLnRvU3RyaW5nKCksICdUaGlzIGlzIHNvdXJjZSBmaWxlJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmFtZSBmb2xkZXIgdG8gYSBuZXcgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IHNvdXJjZUZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZvbGRlcicpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKHNvdXJjZUZvbGRlcik7XG5cblx0XHRjb25zdCB0YXJnZXRGb2xkZXIgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICd0YXJnZXRGb2xkZXInKTtcblx0XHRhd2FpdCBzZXJ2aWNlLm1vdmUoc291cmNlRm9sZGVyLCB0YXJnZXRGb2xkZXIsIGZhbHNlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHMoc291cmNlRm9sZGVyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHModGFyZ2V0Rm9sZGVyKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmFtZSBmb2xkZXIgdG8gYW4gZXhpc3RpbmcgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IHNvdXJjZUZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3NvdXJjZUZvbGRlcicpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKHNvdXJjZUZvbGRlcik7XG5cdFx0Y29uc3QgdGFyZ2V0Rm9sZGVyID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAndGFyZ2V0Rm9sZGVyJyk7XG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGVGb2xkZXIodGFyZ2V0Rm9sZGVyKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UubW92ZShzb3VyY2VGb2xkZXIsIHRhcmdldEZvbGRlciwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHNvdXJjZUZvbGRlciksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHRhcmdldEZvbGRlciksIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW5hbWUgYSBmb2xkZXIgdGhhdCBoYXMgbXVsdGlwbGUgZmlsZXMgYW5kIGZvbGRlcnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcGFyZW50ID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHVzZXJkYXRhVVJJRnJvbVBhdGhzKFtdKSk7XG5cblx0XHRjb25zdCBzb3VyY2VGb2xkZXIgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICdzb3VyY2VGb2xkZXInKTtcblx0XHRjb25zdCBzb3VyY2VGaWxlMSA9IGpvaW5QYXRoKHNvdXJjZUZvbGRlciwgJ2ZvbGRlcjEnLCAnZmlsZTEnKTtcblx0XHRjb25zdCBzb3VyY2VGaWxlMiA9IGpvaW5QYXRoKHNvdXJjZUZvbGRlciwgJ2ZvbGRlcjInLCAnZmlsZTEnKTtcblx0XHRjb25zdCBzb3VyY2VFbXB0eUZvbGRlciA9IGpvaW5QYXRoKHNvdXJjZUZvbGRlciwgJ2ZvbGRlcjMnKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHNlcnZpY2Uud3JpdGVGaWxlKHNvdXJjZUZpbGUxLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdTb3VyY2UgRmlsZSAxJykpLFxuXHRcdFx0c2VydmljZS53cml0ZUZpbGUoc291cmNlRmlsZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1NvdXJjZSBGaWxlIDInKSksXG5cdFx0XHRzZXJ2aWNlLmNyZWF0ZUZvbGRlcihzb3VyY2VFbXB0eUZvbGRlcilcblx0XHRdKTtcblxuXHRcdGNvbnN0IHRhcmdldEZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ3RhcmdldEZvbGRlcicpO1xuXHRcdGNvbnN0IHRhcmdldEZpbGUxID0gam9pblBhdGgodGFyZ2V0Rm9sZGVyLCAnZm9sZGVyMScsICdmaWxlMScpO1xuXHRcdGNvbnN0IHRhcmdldEZpbGUyID0gam9pblBhdGgodGFyZ2V0Rm9sZGVyLCAnZm9sZGVyMicsICdmaWxlMScpO1xuXHRcdGNvbnN0IHRhcmdldEVtcHR5Rm9sZGVyID0gam9pblBhdGgodGFyZ2V0Rm9sZGVyLCAnZm9sZGVyMycpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5tb3ZlKHNvdXJjZUZvbGRlciwgdGFyZ2V0Rm9sZGVyLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHNvdXJjZUZvbGRlciksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHRhcmdldEZvbGRlciksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgc2VydmljZS5yZWFkRmlsZSh0YXJnZXRGaWxlMSkpLnZhbHVlLnRvU3RyaW5nKCksICdTb3VyY2UgRmlsZSAxJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlKHRhcmdldEZpbGUyKSkudmFsdWUudG9TdHJpbmcoKSwgJ1NvdXJjZSBGaWxlIDInKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHRhcmdldEVtcHR5Rm9sZGVyKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlbmFtZSBhIGZvbGRlciB0byBhbm90aGVyIGZvbGRlciB0aGF0IGhhcyBzb21lIGZpbGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXG5cdFx0Y29uc3Qgc291cmNlRm9sZGVyID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAnc291cmNlRm9sZGVyJyk7XG5cdFx0Y29uc3Qgc291cmNlRmlsZTEgPSBqb2luUGF0aChzb3VyY2VGb2xkZXIsICdmb2xkZXIxJywgJ2ZpbGUxJyk7XG5cblx0XHRjb25zdCB0YXJnZXRGb2xkZXIgPSBqb2luUGF0aChwYXJlbnQucmVzb3VyY2UsICd0YXJnZXRGb2xkZXInKTtcblx0XHRjb25zdCB0YXJnZXRGaWxlMSA9IGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjEnLCAnZmlsZTEnKTtcblx0XHRjb25zdCB0YXJnZXRGaWxlMiA9IGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjEnLCAnZmlsZTInKTtcblx0XHRjb25zdCB0YXJnZXRGaWxlMyA9IGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjInLCAnZmlsZTEnKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdHNlcnZpY2Uud3JpdGVGaWxlKHNvdXJjZUZpbGUxLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdTb3VyY2UgRmlsZSAxJykpLFxuXHRcdFx0c2VydmljZS53cml0ZUZpbGUodGFyZ2V0RmlsZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ1RhcmdldCBGaWxlIDInKSksXG5cdFx0XHRzZXJ2aWNlLndyaXRlRmlsZSh0YXJnZXRGaWxlMywgVlNCdWZmZXIuZnJvbVN0cmluZygnVGFyZ2V0IEZpbGUgMycpKVxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgc2VydmljZS5tb3ZlKHNvdXJjZUZvbGRlciwgdGFyZ2V0Rm9sZGVyLCB0cnVlKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHMoc291cmNlRm9sZGVyKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHModGFyZ2V0Rm9sZGVyKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlKHRhcmdldEZpbGUxKSkudmFsdWUudG9TdHJpbmcoKSwgJ1NvdXJjZSBGaWxlIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHModGFyZ2V0RmlsZTIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHRhcmdldEZpbGUzKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVGaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IGluaXRGaXh0dXJlcygpO1xuXG5cdFx0bGV0IGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZSA9PiBldmVudCA9IGUpKTtcblxuXHRcdGNvbnN0IGFub3RoZXJSZXNvdXJjZSA9IHVzZXJkYXRhVVJJRnJvbVBhdGhzKFsnZml4dHVyZXMnLCAnc2VydmljZScsICdkZWVwJywgJ2NvbXBhbnkuanMnXSk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB1c2VyZGF0YVVSSUZyb21QYXRocyhbJ2ZpeHR1cmVzJywgJ3NlcnZpY2UnLCAnZGVlcCcsICdjb253YXkuanMnXSk7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmNhbkRlbGV0ZShzb3VyY2UucmVzb3VyY2UsIHsgdXNlVHJhc2g6IGZhbHNlIH0pLCB0cnVlKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmRlbChzb3VyY2UucmVzb3VyY2UsIHsgdXNlVHJhc2g6IGZhbHNlIH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHNvdXJjZS5yZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHMoYW5vdGhlclJlc291cmNlKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQub2soZXZlbnQhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLnJlc291cmNlLnBhdGgsIHJlc291cmNlLnBhdGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudCEub3BlcmF0aW9uLCBGaWxlT3BlcmF0aW9uLkRFTEVURSk7XG5cblx0XHR7XG5cdFx0XHRsZXQgZXJyb3I6IEVycm9yIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YXdhaXQgc2VydmljZS5kZWwoc291cmNlLnJlc291cmNlLCB7IHVzZVRyYXNoOiBmYWxzZSB9KTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0ZXJyb3IgPSBlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8RmlsZU9wZXJhdGlvbkVycm9yPmVycm9yKS5maWxlT3BlcmF0aW9uUmVzdWx0LCBGaWxlT3BlcmF0aW9uUmVzdWx0LkZJTEVfTk9UX0ZPVU5EKTtcblx0XHR9XG5cdFx0YXdhaXQgcmVsb2FkKCk7XG5cdFx0e1xuXHRcdFx0bGV0IGVycm9yOiBFcnJvciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHNlcnZpY2UuZGVsKHNvdXJjZS5yZXNvdXJjZSwgeyB1c2VUcmFzaDogZmFsc2UgfSk7XG5cdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdGVycm9yID0gZTtcblx0XHRcdH1cblxuXHRcdFx0YXNzZXJ0Lm9rKGVycm9yKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPEZpbGVPcGVyYXRpb25FcnJvcj5lcnJvcikuZmlsZU9wZXJhdGlvblJlc3VsdCwgRmlsZU9wZXJhdGlvblJlc3VsdC5GSUxFX05PVF9GT1VORCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVGb2xkZXIgKHJlY3Vyc2l2ZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgaW5pdEZpeHR1cmVzKCk7XG5cdFx0bGV0IGV2ZW50OiBGaWxlT3BlcmF0aW9uRXZlbnQ7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRSdW5PcGVyYXRpb24oZSA9PiBldmVudCA9IGUpKTtcblxuXHRcdGNvbnN0IHJlc291cmNlID0gdXNlcmRhdGFVUklGcm9tUGF0aHMoWydmaXh0dXJlcycsICdzZXJ2aWNlJywgJ2RlZXAnXSk7XG5cdFx0Y29uc3Qgc3ViUmVzb3VyY2UxID0gdXNlcmRhdGFVUklGcm9tUGF0aHMoWydmaXh0dXJlcycsICdzZXJ2aWNlJywgJ2RlZXAnLCAnY29tcGFueS5qcyddKTtcblx0XHRjb25zdCBzdWJSZXNvdXJjZTIgPSB1c2VyZGF0YVVSSUZyb21QYXRocyhbJ2ZpeHR1cmVzJywgJ3NlcnZpY2UnLCAnZGVlcCcsICdjb253YXkuanMnXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHN1YlJlc291cmNlMSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhzdWJSZXNvdXJjZTIpLCB0cnVlKTtcblxuXHRcdGNvbnN0IHNvdXJjZSA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZShyZXNvdXJjZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5jYW5EZWxldGUoc291cmNlLnJlc291cmNlLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgdXNlVHJhc2g6IGZhbHNlIH0pLCB0cnVlKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmRlbChzb3VyY2UucmVzb3VyY2UsIHsgcmVjdXJzaXZlOiB0cnVlLCB1c2VUcmFzaDogZmFsc2UgfSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHMoc291cmNlLnJlc291cmNlKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhzdWJSZXNvdXJjZTEpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHN1YlJlc291cmNlMiksIGZhbHNlKTtcblx0XHRhc3NlcnQub2soZXZlbnQhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLnJlc291cmNlLmZzUGF0aCwgcmVzb3VyY2UuZnNQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnQhLm9wZXJhdGlvbiwgRmlsZU9wZXJhdGlvbi5ERUxFVEUpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVGb2xkZXIgKG5vbiByZWN1cnNpdmUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IGluaXRGaXh0dXJlcygpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gdXNlcmRhdGFVUklGcm9tUGF0aHMoWydmaXh0dXJlcycsICdzZXJ2aWNlJywgJ2RlZXAnXSk7XG5cdFx0Y29uc3Qgc291cmNlID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHJlc291cmNlKTtcblxuXHRcdGFzc2VydC5vaygoYXdhaXQgc2VydmljZS5jYW5EZWxldGUoc291cmNlLnJlc291cmNlKSkgaW5zdGFuY2VvZiBFcnJvcik7XG5cblx0XHRsZXQgZXJyb3I7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHNlcnZpY2UuZGVsKHNvdXJjZS5yZXNvdXJjZSk7XG5cdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0ZXJyb3IgPSBlO1xuXHRcdH1cblx0XHRhc3NlcnQub2soZXJyb3IpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgZW1wdHkgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IGZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ2ZvbGRlcicpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKGZvbGRlcik7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmRlbChmb2xkZXIpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhmb2xkZXIpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBlbXB0eSBmb2xkZXIgd2l0aCByZWNjdXJzaXZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXHRcdGNvbnN0IGZvbGRlciA9IGpvaW5QYXRoKHBhcmVudC5yZXNvdXJjZSwgJ2ZvbGRlcicpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKGZvbGRlcik7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmRlbChmb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhmb2xkZXIpLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZUZvbGRlciB3aXRoIGZvbGRlcnMgYW5kIGZpbGVzIChyZWN1cnNpdmUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHBhcmVudCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh1c2VyZGF0YVVSSUZyb21QYXRocyhbXSkpO1xuXG5cdFx0Y29uc3QgdGFyZ2V0Rm9sZGVyID0gam9pblBhdGgocGFyZW50LnJlc291cmNlLCAndGFyZ2V0Rm9sZGVyJyk7XG5cdFx0Y29uc3QgZmlsZTEgPSBqb2luUGF0aCh0YXJnZXRGb2xkZXIsICdmb2xkZXIxJywgJ2ZpbGUxJyk7XG5cdFx0YXdhaXQgc2VydmljZS5jcmVhdGVGaWxlKGZpbGUxKTtcblx0XHRjb25zdCBmaWxlMiA9IGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjInLCAnZmlsZTEnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmNyZWF0ZUZpbGUoZmlsZTIpO1xuXHRcdGNvbnN0IGVtcHR5Rm9sZGVyID0gam9pblBhdGgodGFyZ2V0Rm9sZGVyLCAnZm9sZGVyMycpO1xuXHRcdGF3YWl0IHNlcnZpY2UuY3JlYXRlRm9sZGVyKGVtcHR5Rm9sZGVyKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuZGVsKHRhcmdldEZvbGRlciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKHRhcmdldEZvbGRlciksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjEnKSksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKGpvaW5QYXRoKHRhcmdldEZvbGRlciwgJ2ZvbGRlcjInKSksIGZhbHNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHNlcnZpY2UuZXhpc3RzKGZpbGUxKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5leGlzdHMoZmlsZTIpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCBzZXJ2aWNlLmV4aXN0cyhlbXB0eUZvbGRlciksIGZhbHNlKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGtCQUFrQixnQkFBZ0IsZ0JBQTBEO0FBQ3JHLFNB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
