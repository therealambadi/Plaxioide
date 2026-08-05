import assert from "assert";
import * as fs from "fs";
import { tmpdir } from "os";
import { timeout } from "../../../common/async.js";
import { VSBuffer } from "../../../common/buffer.js";
import { randomPath } from "../../../common/extpath.js";
import { FileAccess } from "../../../common/network.js";
import { basename, dirname, join, sep } from "../../../common/path.js";
import { isWindows } from "../../../common/platform.js";
import { configureFlushOnWrite, Promises, RimRafMode, rimrafSync, SymlinkSupport, writeFileSync } from "../../../node/pfs.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../common/utils.js";
import { flakySuite, getRandomTestPath } from "../testUtils.js";
configureFlushOnWrite(false);
flakySuite("PFS", function() {
  let testDir;
  setup(() => {
    testDir = getRandomTestPath(tmpdir(), "vsctests", "pfs");
    return fs.promises.mkdir(testDir, { recursive: true });
  });
  teardown(() => {
    return Promises.rm(testDir);
  });
  test("writeFile", async () => {
    const testFile = join(testDir, "writefile.txt");
    assert.ok(!await Promises.exists(testFile));
    await Promises.writeFile(testFile, "Hello World", null);
    assert.strictEqual((await fs.promises.readFile(testFile)).toString(), "Hello World");
  });
  test("writeFile - parallel write on different files works", async () => {
    const testFile1 = join(testDir, "writefile1.txt");
    const testFile2 = join(testDir, "writefile2.txt");
    const testFile3 = join(testDir, "writefile3.txt");
    const testFile4 = join(testDir, "writefile4.txt");
    const testFile5 = join(testDir, "writefile5.txt");
    await Promise.all([
      Promises.writeFile(testFile1, "Hello World 1", null),
      Promises.writeFile(testFile2, "Hello World 2", null),
      Promises.writeFile(testFile3, "Hello World 3", null),
      Promises.writeFile(testFile4, "Hello World 4", null),
      Promises.writeFile(testFile5, "Hello World 5", null)
    ]);
    assert.strictEqual(fs.readFileSync(testFile1).toString(), "Hello World 1");
    assert.strictEqual(fs.readFileSync(testFile2).toString(), "Hello World 2");
    assert.strictEqual(fs.readFileSync(testFile3).toString(), "Hello World 3");
    assert.strictEqual(fs.readFileSync(testFile4).toString(), "Hello World 4");
    assert.strictEqual(fs.readFileSync(testFile5).toString(), "Hello World 5");
  });
  test("writeFile - parallel write on same files works and is sequentalized", async () => {
    const testFile = join(testDir, "writefile.txt");
    await Promise.all([
      Promises.writeFile(testFile, "Hello World 1", void 0),
      Promises.writeFile(testFile, "Hello World 2", void 0),
      timeout(10).then(() => Promises.writeFile(testFile, "Hello World 3", void 0)),
      Promises.writeFile(testFile, "Hello World 4", void 0),
      timeout(10).then(() => Promises.writeFile(testFile, "Hello World 5", void 0))
    ]);
    assert.strictEqual(fs.readFileSync(testFile).toString(), "Hello World 5");
  });
  test("rimraf - simple - unlink", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    await Promises.rm(testDir);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - simple - move", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    await Promises.rm(testDir, RimRafMode.MOVE);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - simple - move (with moveToPath)", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    await Promises.rm(testDir, RimRafMode.MOVE, join(dirname(testDir), `${basename(testDir)}.vsctmp`));
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - path does not exist - move", async () => {
    const nonExistingDir = join(testDir, "unknown-move");
    await Promises.rm(nonExistingDir, RimRafMode.MOVE);
  });
  test("rimraf - path does not exist - unlink", async () => {
    const nonExistingDir = join(testDir, "unknown-unlink");
    await Promises.rm(nonExistingDir, RimRafMode.UNLINK);
  });
  test("rimraf - recursive folder structure - unlink", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    fs.mkdirSync(join(testDir, "somefolder"));
    fs.writeFileSync(join(testDir, "somefolder", "somefile.txt"), "Contents");
    await Promises.rm(testDir);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - recursive folder structure - move", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    fs.mkdirSync(join(testDir, "somefolder"));
    fs.writeFileSync(join(testDir, "somefolder", "somefile.txt"), "Contents");
    await Promises.rm(testDir, RimRafMode.MOVE);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - simple ends with dot - move", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    await Promises.rm(testDir, RimRafMode.MOVE);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimraf - simple ends with dot slash/backslash - move", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    await Promises.rm(`${testDir}${sep}`, RimRafMode.MOVE);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimrafSync - swallows file not found error", function() {
    const nonExistingDir = join(testDir, "not-existing");
    rimrafSync(nonExistingDir);
    assert.ok(!fs.existsSync(nonExistingDir));
  });
  test("rimrafSync - simple", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    rimrafSync(testDir);
    assert.ok(!fs.existsSync(testDir));
  });
  test("rimrafSync - recursive folder structure", async () => {
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    fs.mkdirSync(join(testDir, "somefolder"));
    fs.writeFileSync(join(testDir, "somefolder", "somefile.txt"), "Contents");
    rimrafSync(testDir);
    assert.ok(!fs.existsSync(testDir));
  });
  test("copy, rename and delete", async () => {
    const sourceDir = FileAccess.asFileUri("vs/base/test/node/pfs/fixtures").fsPath;
    const parentDir = join(tmpdir(), "vsctests", "pfs");
    const targetDir = randomPath(parentDir);
    const targetDir2 = randomPath(parentDir);
    await Promises.copy(sourceDir, targetDir, { preserveSymlinks: true });
    assert.ok(fs.existsSync(targetDir));
    assert.ok(fs.existsSync(join(targetDir, "index.html")));
    assert.ok(fs.existsSync(join(targetDir, "site.css")));
    assert.ok(fs.existsSync(join(targetDir, "examples")));
    assert.ok(fs.statSync(join(targetDir, "examples")).isDirectory());
    assert.ok(fs.existsSync(join(targetDir, "examples", "small.jxs")));
    await Promises.rename(targetDir, targetDir2);
    assert.ok(!fs.existsSync(targetDir));
    assert.ok(fs.existsSync(targetDir2));
    assert.ok(fs.existsSync(join(targetDir2, "index.html")));
    assert.ok(fs.existsSync(join(targetDir2, "site.css")));
    assert.ok(fs.existsSync(join(targetDir2, "examples")));
    assert.ok(fs.statSync(join(targetDir2, "examples")).isDirectory());
    assert.ok(fs.existsSync(join(targetDir2, "examples", "small.jxs")));
    await Promises.rename(join(targetDir2, "index.html"), join(targetDir2, "index_moved.html"));
    assert.ok(!fs.existsSync(join(targetDir2, "index.html")));
    assert.ok(fs.existsSync(join(targetDir2, "index_moved.html")));
    await Promises.rm(parentDir);
    assert.ok(!fs.existsSync(parentDir));
  });
  test("rename without retry", async () => {
    const sourceDir = FileAccess.asFileUri("vs/base/test/node/pfs/fixtures").fsPath;
    const parentDir = join(tmpdir(), "vsctests", "pfs");
    const targetDir = randomPath(parentDir);
    const targetDir2 = randomPath(parentDir);
    await Promises.copy(sourceDir, targetDir, { preserveSymlinks: true });
    await Promises.rename(targetDir, targetDir2, false);
    assert.ok(!fs.existsSync(targetDir));
    assert.ok(fs.existsSync(targetDir2));
    assert.ok(fs.existsSync(join(targetDir2, "index.html")));
    assert.ok(fs.existsSync(join(targetDir2, "site.css")));
    assert.ok(fs.existsSync(join(targetDir2, "examples")));
    assert.ok(fs.statSync(join(targetDir2, "examples")).isDirectory());
    assert.ok(fs.existsSync(join(targetDir2, "examples", "small.jxs")));
    await Promises.rename(join(targetDir2, "index.html"), join(targetDir2, "index_moved.html"), false);
    assert.ok(!fs.existsSync(join(targetDir2, "index.html")));
    assert.ok(fs.existsSync(join(targetDir2, "index_moved.html")));
    await Promises.rm(parentDir);
    assert.ok(!fs.existsSync(parentDir));
  });
  test("copy handles symbolic links", async () => {
    const symbolicLinkTarget = randomPath(testDir);
    const symLink = randomPath(testDir);
    const copyTarget = randomPath(testDir);
    await fs.promises.mkdir(symbolicLinkTarget, { recursive: true });
    fs.symlinkSync(symbolicLinkTarget, symLink, "junction");
    if (!isWindows) {
      await Promises.copy(symLink, copyTarget, { preserveSymlinks: true });
      assert.ok(fs.existsSync(copyTarget));
      const { symbolicLink } = await SymlinkSupport.stat(copyTarget);
      assert.ok(symbolicLink);
      assert.ok(!symbolicLink.dangling);
      const target = await fs.promises.readlink(copyTarget);
      assert.strictEqual(target, symbolicLinkTarget);
      await Promises.rm(copyTarget);
      await Promises.copy(symLink, copyTarget, { preserveSymlinks: false });
      assert.ok(fs.existsSync(copyTarget));
      const { symbolicLink: symbolicLink2 } = await SymlinkSupport.stat(copyTarget);
      assert.ok(!symbolicLink2);
    }
    await Promises.rm(copyTarget);
    await Promises.rm(symbolicLinkTarget);
    await Promises.copy(symLink, copyTarget, { preserveSymlinks: true });
    if (!isWindows) {
      const { symbolicLink } = await SymlinkSupport.stat(copyTarget);
      assert.ok(symbolicLink?.dangling);
    } else {
      assert.ok(!fs.existsSync(copyTarget));
    }
  });
  test("copy handles symbolic links when the reference is inside source", async () => {
    const sourceFolder = join(randomPath(testDir), "copy-test");
    const sourceLinkTestFolder = join(sourceFolder, "link-test");
    const sourceLinkMD5JSFolder = join(sourceLinkTestFolder, "md5");
    const sourceLinkMD5JSFile = join(sourceLinkMD5JSFolder, "md5.js");
    await fs.promises.mkdir(sourceLinkMD5JSFolder, { recursive: true });
    await Promises.writeFile(sourceLinkMD5JSFile, "Hello from MD5");
    const sourceLinkMD5JSFolderLinked = join(sourceLinkTestFolder, "md5-linked");
    fs.symlinkSync(sourceLinkMD5JSFolder, sourceLinkMD5JSFolderLinked, "junction");
    const targetLinkTestFolder = join(sourceFolder, "link-test copy");
    const targetLinkMD5JSFolder = join(targetLinkTestFolder, "md5");
    const targetLinkMD5JSFile = join(targetLinkMD5JSFolder, "md5.js");
    const targetLinkMD5JSFolderLinked = join(targetLinkTestFolder, "md5-linked");
    if (!isWindows) {
      await Promises.copy(sourceLinkTestFolder, targetLinkTestFolder, { preserveSymlinks: true });
      assert.ok(fs.existsSync(targetLinkTestFolder));
      assert.ok(fs.existsSync(targetLinkMD5JSFolder));
      assert.ok(fs.existsSync(targetLinkMD5JSFile));
      assert.ok(fs.existsSync(targetLinkMD5JSFolderLinked));
      assert.ok(fs.lstatSync(targetLinkMD5JSFolderLinked).isSymbolicLink());
      const linkTarget = await fs.promises.readlink(targetLinkMD5JSFolderLinked);
      assert.strictEqual(linkTarget, targetLinkMD5JSFolder);
      await Promises.rm(targetLinkTestFolder);
    }
    await Promises.copy(sourceLinkTestFolder, targetLinkTestFolder, { preserveSymlinks: false });
    assert.ok(fs.existsSync(targetLinkTestFolder));
    assert.ok(fs.existsSync(targetLinkMD5JSFolder));
    assert.ok(fs.existsSync(targetLinkMD5JSFile));
    assert.ok(fs.existsSync(targetLinkMD5JSFolderLinked));
    assert.ok(fs.lstatSync(targetLinkMD5JSFolderLinked).isDirectory());
  });
  test("readDirsInDir", async () => {
    fs.mkdirSync(join(testDir, "somefolder1"));
    fs.mkdirSync(join(testDir, "somefolder2"));
    fs.mkdirSync(join(testDir, "somefolder3"));
    fs.writeFileSync(join(testDir, "somefile.txt"), "Contents");
    fs.writeFileSync(join(testDir, "someOtherFile.txt"), "Contents");
    const result = await Promises.readDirsInDir(testDir);
    assert.strictEqual(result.length, 3);
    assert.ok(result.indexOf("somefolder1") !== -1);
    assert.ok(result.indexOf("somefolder2") !== -1);
    assert.ok(result.indexOf("somefolder3") !== -1);
  });
  test("stat link", async () => {
    const directory = randomPath(testDir);
    const symbolicLink = randomPath(testDir);
    await fs.promises.mkdir(directory, { recursive: true });
    fs.symlinkSync(directory, symbolicLink, "junction");
    let statAndIsLink = await SymlinkSupport.stat(directory);
    assert.ok(!statAndIsLink?.symbolicLink);
    statAndIsLink = await SymlinkSupport.stat(symbolicLink);
    assert.ok(statAndIsLink?.symbolicLink);
    assert.ok(!statAndIsLink?.symbolicLink?.dangling);
  });
  test("stat link (non existing target)", async () => {
    const directory = randomPath(testDir);
    const symbolicLink = randomPath(testDir);
    await fs.promises.mkdir(directory, { recursive: true });
    fs.symlinkSync(directory, symbolicLink, "junction");
    await Promises.rm(directory);
    const statAndIsLink = await SymlinkSupport.stat(symbolicLink);
    assert.ok(statAndIsLink?.symbolicLink);
    assert.ok(statAndIsLink?.symbolicLink?.dangling);
  });
  test("readdir", async () => {
    if (typeof process.versions["electron"] !== "undefined") {
      const parent = randomPath(join(testDir, "pfs"));
      const newDir = join(parent, "\xF6\xE4\xFC");
      await fs.promises.mkdir(newDir, { recursive: true });
      assert.ok(fs.existsSync(newDir));
      const children = await Promises.readdir(parent);
      assert.strictEqual(children.some((n) => n === "\xF6\xE4\xFC"), true);
    }
  });
  test("readdir (with file types)", async () => {
    if (typeof process.versions["electron"] !== "undefined") {
      const newDir = join(testDir, "\xF6\xE4\xFC");
      await fs.promises.mkdir(newDir, { recursive: true });
      await Promises.writeFile(join(testDir, "somefile.txt"), "contents");
      assert.ok(fs.existsSync(newDir));
      const children = await Promises.readdir(testDir, { withFileTypes: true });
      assert.strictEqual(children.some((n) => n.name === "\xF6\xE4\xFC"), true);
      assert.strictEqual(children.some((n) => n.isDirectory()), true);
      assert.strictEqual(children.some((n) => n.name === "somefile.txt"), true);
      assert.strictEqual(children.some((n) => n.isFile()), true);
    }
  });
  test("writeFile (string)", async () => {
    const smallData = "Hello World";
    const bigData = new Array(100 * 1024).join("Large String\n");
    return testWriteFile(smallData, smallData, bigData, bigData);
  });
  test("writeFile (string) - flush on write", async () => {
    configureFlushOnWrite(true);
    try {
      const smallData = "Hello World";
      const bigData = new Array(100 * 1024).join("Large String\n");
      return await testWriteFile(smallData, smallData, bigData, bigData);
    } finally {
      configureFlushOnWrite(false);
    }
  });
  test("writeFile (Buffer)", async () => {
    const smallData = "Hello World";
    const bigData = new Array(100 * 1024).join("Large String\n");
    return testWriteFile(Buffer.from(smallData), smallData, Buffer.from(bigData), bigData);
  });
  test("writeFile (UInt8Array)", async () => {
    const smallData = "Hello World";
    const bigData = new Array(100 * 1024).join("Large String\n");
    return testWriteFile(VSBuffer.fromString(smallData).buffer, smallData, VSBuffer.fromString(bigData).buffer, bigData);
  });
  async function testWriteFile(smallData, smallDataValue, bigData, bigDataValue) {
    const testFile = join(testDir, "flushed.txt");
    assert.ok(fs.existsSync(testDir));
    await Promises.writeFile(testFile, smallData);
    assert.strictEqual(fs.readFileSync(testFile).toString(), smallDataValue);
    await Promises.writeFile(testFile, bigData);
    assert.strictEqual(fs.readFileSync(testFile).toString(), bigDataValue);
  }
  test("writeFile (string, error handling)", async () => {
    const testFile = join(testDir, "flushed.txt");
    fs.mkdirSync(testFile);
    let expectedError;
    try {
      await Promises.writeFile(testFile, "Hello World");
    } catch (error) {
      expectedError = error;
    }
    assert.ok(expectedError);
  });
  test("writeFileSync", async () => {
    const testFile = join(testDir, "flushed.txt");
    writeFileSync(testFile, "Hello World");
    assert.strictEqual(fs.readFileSync(testFile).toString(), "Hello World");
    const largeString = new Array(100 * 1024).join("Large String\n");
    writeFileSync(testFile, largeString);
    assert.strictEqual(fs.readFileSync(testFile).toString(), largeString);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3Qvbm9kZS9wZnMvcGZzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgeyB0bXBkaXIgfSBmcm9tICdvcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyByYW5kb21QYXRoIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBkaXJuYW1lLCBqb2luLCBzZXAgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgY29uZmlndXJlRmx1c2hPbldyaXRlLCBQcm9taXNlcywgUmltUmFmTW9kZSwgcmltcmFmU3luYywgU3ltbGlua1N1cHBvcnQsIHdyaXRlRmlsZVN5bmMgfSBmcm9tICcuLi8uLi8uLi9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSwgZ2V0UmFuZG9tVGVzdFBhdGggfSBmcm9tICcuLi90ZXN0VXRpbHMuanMnO1xuXG5jb25maWd1cmVGbHVzaE9uV3JpdGUoZmFsc2UpOyAvLyBzcGVlZCB1cCBhbGwgdW5pdCB0ZXN0cyBieSBkaXNhYmxpbmcgZmx1c2ggb24gd3JpdGVcblxuZmxha3lTdWl0ZSgnUEZTJywgZnVuY3Rpb24gKCkge1xuXG5cdGxldCB0ZXN0RGlyOiBzdHJpbmc7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdHRlc3REaXIgPSBnZXRSYW5kb21UZXN0UGF0aCh0bXBkaXIoKSwgJ3ZzY3Rlc3RzJywgJ3BmcycpO1xuXG5cdFx0cmV0dXJuIGZzLnByb21pc2VzLm1rZGlyKHRlc3REaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0cmV0dXJuIFByb21pc2VzLnJtKHRlc3REaXIpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZUZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdEZpbGUgPSBqb2luKHRlc3REaXIsICd3cml0ZWZpbGUudHh0Jyk7XG5cblx0XHRhc3NlcnQub2soIShhd2FpdCBQcm9taXNlcy5leGlzdHModGVzdEZpbGUpKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUodGVzdEZpbGUsICdIZWxsbyBXb3JsZCcsIChudWxsISkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmcy5wcm9taXNlcy5yZWFkRmlsZSh0ZXN0RmlsZSkpLnRvU3RyaW5nKCksICdIZWxsbyBXb3JsZCcpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZUZpbGUgLSBwYXJhbGxlbCB3cml0ZSBvbiBkaWZmZXJlbnQgZmlsZXMgd29ya3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdEZpbGUxID0gam9pbih0ZXN0RGlyLCAnd3JpdGVmaWxlMS50eHQnKTtcblx0XHRjb25zdCB0ZXN0RmlsZTIgPSBqb2luKHRlc3REaXIsICd3cml0ZWZpbGUyLnR4dCcpO1xuXHRcdGNvbnN0IHRlc3RGaWxlMyA9IGpvaW4odGVzdERpciwgJ3dyaXRlZmlsZTMudHh0Jyk7XG5cdFx0Y29uc3QgdGVzdEZpbGU0ID0gam9pbih0ZXN0RGlyLCAnd3JpdGVmaWxlNC50eHQnKTtcblx0XHRjb25zdCB0ZXN0RmlsZTUgPSBqb2luKHRlc3REaXIsICd3cml0ZWZpbGU1LnR4dCcpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0UHJvbWlzZXMud3JpdGVGaWxlKHRlc3RGaWxlMSwgJ0hlbGxvIFdvcmxkIDEnLCAobnVsbCEpKSxcblx0XHRcdFByb21pc2VzLndyaXRlRmlsZSh0ZXN0RmlsZTIsICdIZWxsbyBXb3JsZCAyJywgKG51bGwhKSksXG5cdFx0XHRQcm9taXNlcy53cml0ZUZpbGUodGVzdEZpbGUzLCAnSGVsbG8gV29ybGQgMycsIChudWxsISkpLFxuXHRcdFx0UHJvbWlzZXMud3JpdGVGaWxlKHRlc3RGaWxlNCwgJ0hlbGxvIFdvcmxkIDQnLCAobnVsbCEpKSxcblx0XHRcdFByb21pc2VzLndyaXRlRmlsZSh0ZXN0RmlsZTUsICdIZWxsbyBXb3JsZCA1JywgKG51bGwhKSlcblx0XHRdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlMSkudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkIDEnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlMikudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkIDInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlMykudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkIDMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlNCkudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkIDQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlNSkudG9TdHJpbmcoKSwgJ0hlbGxvIFdvcmxkIDUnKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGVGaWxlIC0gcGFyYWxsZWwgd3JpdGUgb24gc2FtZSBmaWxlcyB3b3JrcyBhbmQgaXMgc2VxdWVudGFsaXplZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0RmlsZSA9IGpvaW4odGVzdERpciwgJ3dyaXRlZmlsZS50eHQnKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFByb21pc2VzLndyaXRlRmlsZSh0ZXN0RmlsZSwgJ0hlbGxvIFdvcmxkIDEnLCB1bmRlZmluZWQpLFxuXHRcdFx0UHJvbWlzZXMud3JpdGVGaWxlKHRlc3RGaWxlLCAnSGVsbG8gV29ybGQgMicsIHVuZGVmaW5lZCksXG5cdFx0XHR0aW1lb3V0KDEwKS50aGVuKCgpID0+IFByb21pc2VzLndyaXRlRmlsZSh0ZXN0RmlsZSwgJ0hlbGxvIFdvcmxkIDMnLCB1bmRlZmluZWQpKSxcblx0XHRcdFByb21pc2VzLndyaXRlRmlsZSh0ZXN0RmlsZSwgJ0hlbGxvIFdvcmxkIDQnLCB1bmRlZmluZWQpLFxuXHRcdFx0dGltZW91dCgxMCkudGhlbigoKSA9PiBQcm9taXNlcy53cml0ZUZpbGUodGVzdEZpbGUsICdIZWxsbyBXb3JsZCA1JywgdW5kZWZpbmVkKSlcblx0XHRdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlKS50b1N0cmluZygpLCAnSGVsbG8gV29ybGQgNScpO1xuXHR9KTtcblxuXHR0ZXN0KCdyaW1yYWYgLSBzaW1wbGUgLSB1bmxpbmsnLCBhc3luYyAoKSA9PiB7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lZmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lT3RoZXJGaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJtKHRlc3REaXIpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyh0ZXN0RGlyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JpbXJhZiAtIHNpbXBsZSAtIG1vdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lZmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lT3RoZXJGaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJtKHRlc3REaXIsIFJpbVJhZk1vZGUuTU9WRSk7XG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHRlc3REaXIpKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gc2ltcGxlIC0gbW92ZSAod2l0aCBtb3ZlVG9QYXRoKScsIGFzeW5jICgpID0+IHtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVPdGhlckZpbGUudHh0JyksICdDb250ZW50cycpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMucm0odGVzdERpciwgUmltUmFmTW9kZS5NT1ZFLCBqb2luKGRpcm5hbWUodGVzdERpciksIGAke2Jhc2VuYW1lKHRlc3REaXIpfS52c2N0bXBgKSk7XG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHRlc3REaXIpKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gcGF0aCBkb2VzIG5vdCBleGlzdCAtIG1vdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgbm9uRXhpc3RpbmdEaXIgPSBqb2luKHRlc3REaXIsICd1bmtub3duLW1vdmUnKTtcblx0XHRhd2FpdCBQcm9taXNlcy5ybShub25FeGlzdGluZ0RpciwgUmltUmFmTW9kZS5NT1ZFKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gcGF0aCBkb2VzIG5vdCBleGlzdCAtIHVubGluaycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBub25FeGlzdGluZ0RpciA9IGpvaW4odGVzdERpciwgJ3Vua25vd24tdW5saW5rJyk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucm0obm9uRXhpc3RpbmdEaXIsIFJpbVJhZk1vZGUuVU5MSU5LKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gcmVjdXJzaXZlIGZvbGRlciBzdHJ1Y3R1cmUgLSB1bmxpbmsnLCBhc3luYyAoKSA9PiB7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lZmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lT3RoZXJGaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblx0XHRmcy5ta2RpclN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZvbGRlcicpKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmb2xkZXInLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMucm0odGVzdERpcik7XG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHRlc3REaXIpKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gcmVjdXJzaXZlIGZvbGRlciBzdHJ1Y3R1cmUgLSBtb3ZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZU90aGVyRmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cdFx0ZnMubWtkaXJTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmb2xkZXInKSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lZm9sZGVyJywgJ3NvbWVmaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJtKHRlc3REaXIsIFJpbVJhZk1vZGUuTU9WRSk7XG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHRlc3REaXIpKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmIC0gc2ltcGxlIGVuZHMgd2l0aCBkb3QgLSBtb3ZlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZU90aGVyRmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5ybSh0ZXN0RGlyLCBSaW1SYWZNb2RlLk1PVkUpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyh0ZXN0RGlyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JpbXJhZiAtIHNpbXBsZSBlbmRzIHdpdGggZG90IHNsYXNoL2JhY2tzbGFzaCAtIG1vdmUnLCBhc3luYyAoKSA9PiB7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lZmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhqb2luKHRlc3REaXIsICdzb21lT3RoZXJGaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJtKGAke3Rlc3REaXJ9JHtzZXB9YCwgUmltUmFmTW9kZS5NT1ZFKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmModGVzdERpcikpO1xuXHR9KTtcblxuXHR0ZXN0KCdyaW1yYWZTeW5jIC0gc3dhbGxvd3MgZmlsZSBub3QgZm91bmQgZXJyb3InLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgbm9uRXhpc3RpbmdEaXIgPSBqb2luKHRlc3REaXIsICdub3QtZXhpc3RpbmcnKTtcblx0XHRyaW1yYWZTeW5jKG5vbkV4aXN0aW5nRGlyKTtcblxuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhub25FeGlzdGluZ0RpcikpO1xuXHR9KTtcblxuXHR0ZXN0KCdyaW1yYWZTeW5jIC0gc2ltcGxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZU90aGVyRmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cblx0XHRyaW1yYWZTeW5jKHRlc3REaXIpO1xuXG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHRlc3REaXIpKTtcblx0fSk7XG5cblx0dGVzdCgncmltcmFmU3luYyAtIHJlY3Vyc2l2ZSBmb2xkZXIgc3RydWN0dXJlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMoam9pbih0ZXN0RGlyLCAnc29tZU90aGVyRmlsZS50eHQnKSwgJ0NvbnRlbnRzJyk7XG5cblx0XHRmcy5ta2RpclN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZvbGRlcicpKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmb2xkZXInLCAnc29tZWZpbGUudHh0JyksICdDb250ZW50cycpO1xuXG5cdFx0cmltcmFmU3luYyh0ZXN0RGlyKTtcblxuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyh0ZXN0RGlyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHksIHJlbmFtZSBhbmQgZGVsZXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNvdXJjZURpciA9IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy9iYXNlL3Rlc3Qvbm9kZS9wZnMvZml4dHVyZXMnKS5mc1BhdGg7XG5cdFx0Y29uc3QgcGFyZW50RGlyID0gam9pbih0bXBkaXIoKSwgJ3ZzY3Rlc3RzJywgJ3BmcycpO1xuXHRcdGNvbnN0IHRhcmdldERpciA9IHJhbmRvbVBhdGgocGFyZW50RGlyKTtcblx0XHRjb25zdCB0YXJnZXREaXIyID0gcmFuZG9tUGF0aChwYXJlbnREaXIpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMuY29weShzb3VyY2VEaXIsIHRhcmdldERpciwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiB0cnVlIH0pO1xuXG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmModGFyZ2V0RGlyKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIsICdpbmRleC5odG1sJykpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpciwgJ3NpdGUuY3NzJykpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpciwgJ2V4YW1wbGVzJykpKTtcblx0XHRhc3NlcnQub2soZnMuc3RhdFN5bmMoam9pbih0YXJnZXREaXIsICdleGFtcGxlcycpKS5pc0RpcmVjdG9yeSgpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpciwgJ2V4YW1wbGVzJywgJ3NtYWxsLmp4cycpKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUodGFyZ2V0RGlyLCB0YXJnZXREaXIyKTtcblxuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyh0YXJnZXREaXIpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyh0YXJnZXREaXIyKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIyLCAnaW5kZXguaHRtbCcpKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIyLCAnc2l0ZS5jc3MnKSkpO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKGpvaW4odGFyZ2V0RGlyMiwgJ2V4YW1wbGVzJykpKTtcblx0XHRhc3NlcnQub2soZnMuc3RhdFN5bmMoam9pbih0YXJnZXREaXIyLCAnZXhhbXBsZXMnKSkuaXNEaXJlY3RvcnkoKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIyLCAnZXhhbXBsZXMnLCAnc21hbGwuanhzJykpKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShqb2luKHRhcmdldERpcjIsICdpbmRleC5odG1sJyksIGpvaW4odGFyZ2V0RGlyMiwgJ2luZGV4X21vdmVkLmh0bWwnKSk7XG5cblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIyLCAnaW5kZXguaHRtbCcpKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoam9pbih0YXJnZXREaXIyLCAnaW5kZXhfbW92ZWQuaHRtbCcpKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5ybShwYXJlbnREaXIpO1xuXG5cdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKHBhcmVudERpcikpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW5hbWUgd2l0aG91dCByZXRyeScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzb3VyY2VEaXIgPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvYmFzZS90ZXN0L25vZGUvcGZzL2ZpeHR1cmVzJykuZnNQYXRoO1xuXHRcdGNvbnN0IHBhcmVudERpciA9IGpvaW4odG1wZGlyKCksICd2c2N0ZXN0cycsICdwZnMnKTtcblx0XHRjb25zdCB0YXJnZXREaXIgPSByYW5kb21QYXRoKHBhcmVudERpcik7XG5cdFx0Y29uc3QgdGFyZ2V0RGlyMiA9IHJhbmRvbVBhdGgocGFyZW50RGlyKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLmNvcHkoc291cmNlRGlyLCB0YXJnZXREaXIsIHsgcHJlc2VydmVTeW1saW5rczogdHJ1ZSB9KTtcblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUodGFyZ2V0RGlyLCB0YXJnZXREaXIyLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmModGFyZ2V0RGlyKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmModGFyZ2V0RGlyMikpO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKGpvaW4odGFyZ2V0RGlyMiwgJ2luZGV4Lmh0bWwnKSkpO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKGpvaW4odGFyZ2V0RGlyMiwgJ3NpdGUuY3NzJykpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpcjIsICdleGFtcGxlcycpKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLnN0YXRTeW5jKGpvaW4odGFyZ2V0RGlyMiwgJ2V4YW1wbGVzJykpLmlzRGlyZWN0b3J5KCkpO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKGpvaW4odGFyZ2V0RGlyMiwgJ2V4YW1wbGVzJywgJ3NtYWxsLmp4cycpKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUoam9pbih0YXJnZXREaXIyLCAnaW5kZXguaHRtbCcpLCBqb2luKHRhcmdldERpcjIsICdpbmRleF9tb3ZlZC5odG1sJyksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpcjIsICdpbmRleC5odG1sJykpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhqb2luKHRhcmdldERpcjIsICdpbmRleF9tb3ZlZC5odG1sJykpKTtcblxuXHRcdGF3YWl0IFByb21pc2VzLnJtKHBhcmVudERpcik7XG5cblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMocGFyZW50RGlyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHkgaGFuZGxlcyBzeW1ib2xpYyBsaW5rcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzeW1ib2xpY0xpbmtUYXJnZXQgPSByYW5kb21QYXRoKHRlc3REaXIpO1xuXHRcdGNvbnN0IHN5bUxpbmsgPSByYW5kb21QYXRoKHRlc3REaXIpO1xuXHRcdGNvbnN0IGNvcHlUYXJnZXQgPSByYW5kb21QYXRoKHRlc3REaXIpO1xuXG5cdFx0YXdhaXQgZnMucHJvbWlzZXMubWtkaXIoc3ltYm9saWNMaW5rVGFyZ2V0LCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuXHRcdGZzLnN5bWxpbmtTeW5jKHN5bWJvbGljTGlua1RhcmdldCwgc3ltTGluaywgJ2p1bmN0aW9uJyk7XG5cblx0XHQvLyBDb3B5IHByZXNlcnZlcyBzeW1saW5rcyBpZiBjb25maWd1cmVkIGFzIHN1Y2hcblx0XHQvL1xuXHRcdC8vIFdpbmRvd3M6IHRoaXMgdGVzdCBkb2VzIG5vdCB3b3JrIGJlY2F1c2UgY3JlYXRpbmcgc3ltbGlua3Ncblx0XHQvLyByZXF1aXJlcyBwcml2aWxlZGdlZCBwZXJtaXNzaW9ucyAoYWRtaW4pLlxuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRhd2FpdCBQcm9taXNlcy5jb3B5KHN5bUxpbmssIGNvcHlUYXJnZXQsIHsgcHJlc2VydmVTeW1saW5rczogdHJ1ZSB9KTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMoY29weVRhcmdldCkpO1xuXG5cdFx0XHRjb25zdCB7IHN5bWJvbGljTGluayB9ID0gYXdhaXQgU3ltbGlua1N1cHBvcnQuc3RhdChjb3B5VGFyZ2V0KTtcblx0XHRcdGFzc2VydC5vayhzeW1ib2xpY0xpbmspO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzeW1ib2xpY0xpbmsuZGFuZ2xpbmcpO1xuXG5cdFx0XHRjb25zdCB0YXJnZXQgPSBhd2FpdCBmcy5wcm9taXNlcy5yZWFkbGluayhjb3B5VGFyZ2V0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQsIHN5bWJvbGljTGlua1RhcmdldCk7XG5cblx0XHRcdC8vIENvcHkgZG9lcyBub3QgcHJlc2VydmUgc3ltbGlua3MgaWYgY29uZmlndXJlZCBhcyBzdWNoXG5cblx0XHRcdGF3YWl0IFByb21pc2VzLnJtKGNvcHlUYXJnZXQpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMuY29weShzeW1MaW5rLCBjb3B5VGFyZ2V0LCB7IHByZXNlcnZlU3ltbGlua3M6IGZhbHNlIH0pO1xuXG5cdFx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhjb3B5VGFyZ2V0KSk7XG5cblx0XHRcdGNvbnN0IHsgc3ltYm9saWNMaW5rOiBzeW1ib2xpY0xpbmsyIH0gPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KGNvcHlUYXJnZXQpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzeW1ib2xpY0xpbmsyKTtcblx0XHR9XG5cblx0XHQvLyBDb3B5IGRvZXMgbm90IGZhaWwgb3ZlciBkYW5nbGluZyBzeW1saW5rc1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMucm0oY29weVRhcmdldCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucm0oc3ltYm9saWNMaW5rVGFyZ2V0KTtcblxuXHRcdGF3YWl0IFByb21pc2VzLmNvcHkoc3ltTGluaywgY29weVRhcmdldCwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiB0cnVlIH0pOyAvLyB0aGlzIHNob3VsZCBub3QgdGhyb3dcblxuXHRcdGlmICghaXNXaW5kb3dzKSB7XG5cdFx0XHRjb25zdCB7IHN5bWJvbGljTGluayB9ID0gYXdhaXQgU3ltbGlua1N1cHBvcnQuc3RhdChjb3B5VGFyZ2V0KTtcblx0XHRcdGFzc2VydC5vayhzeW1ib2xpY0xpbms/LmRhbmdsaW5nKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0Lm9rKCFmcy5leGlzdHNTeW5jKGNvcHlUYXJnZXQpKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcHkgaGFuZGxlcyBzeW1ib2xpYyBsaW5rcyB3aGVuIHRoZSByZWZlcmVuY2UgaXMgaW5zaWRlIHNvdXJjZScsIGFzeW5jICgpID0+IHtcblxuXHRcdC8vIFNvdXJjZSBGb2xkZXJcblx0XHRjb25zdCBzb3VyY2VGb2xkZXIgPSBqb2luKHJhbmRvbVBhdGgodGVzdERpciksICdjb3B5LXRlc3QnKTsgXHRcdC8vIGNvcHktdGVzdFxuXHRcdGNvbnN0IHNvdXJjZUxpbmtUZXN0Rm9sZGVyID0gam9pbihzb3VyY2VGb2xkZXIsICdsaW5rLXRlc3QnKTtcdFx0Ly8gY29weS10ZXN0L2xpbmstdGVzdFxuXHRcdGNvbnN0IHNvdXJjZUxpbmtNRDVKU0ZvbGRlciA9IGpvaW4oc291cmNlTGlua1Rlc3RGb2xkZXIsICdtZDUnKTtcdC8vIGNvcHktdGVzdC9saW5rLXRlc3QvbWQ1XG5cdFx0Y29uc3Qgc291cmNlTGlua01ENUpTRmlsZSA9IGpvaW4oc291cmNlTGlua01ENUpTRm9sZGVyLCAnbWQ1LmpzJyk7XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0L21kNS9tZDUuanNcblx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcihzb3VyY2VMaW5rTUQ1SlNGb2xkZXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShzb3VyY2VMaW5rTUQ1SlNGaWxlLCAnSGVsbG8gZnJvbSBNRDUnKTtcblxuXHRcdGNvbnN0IHNvdXJjZUxpbmtNRDVKU0ZvbGRlckxpbmtlZCA9IGpvaW4oc291cmNlTGlua1Rlc3RGb2xkZXIsICdtZDUtbGlua2VkJyk7XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0L21kNS1saW5rZWRcblx0XHRmcy5zeW1saW5rU3luYyhzb3VyY2VMaW5rTUQ1SlNGb2xkZXIsIHNvdXJjZUxpbmtNRDVKU0ZvbGRlckxpbmtlZCwgJ2p1bmN0aW9uJyk7XG5cblx0XHQvLyBUYXJnZXQgRm9sZGVyXG5cdFx0Y29uc3QgdGFyZ2V0TGlua1Rlc3RGb2xkZXIgPSBqb2luKHNvdXJjZUZvbGRlciwgJ2xpbmstdGVzdCBjb3B5Jyk7XHRcdFx0XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0IGNvcHlcblx0XHRjb25zdCB0YXJnZXRMaW5rTUQ1SlNGb2xkZXIgPSBqb2luKHRhcmdldExpbmtUZXN0Rm9sZGVyLCAnbWQ1Jyk7XHRcdFx0XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0IGNvcHkvbWQ1XG5cdFx0Y29uc3QgdGFyZ2V0TGlua01ENUpTRmlsZSA9IGpvaW4odGFyZ2V0TGlua01ENUpTRm9sZGVyLCAnbWQ1LmpzJyk7XHRcdFx0XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0IGNvcHkvbWQ1L21kNS5qc1xuXHRcdGNvbnN0IHRhcmdldExpbmtNRDVKU0ZvbGRlckxpbmtlZCA9IGpvaW4odGFyZ2V0TGlua1Rlc3RGb2xkZXIsICdtZDUtbGlua2VkJyk7XHQvLyBjb3B5LXRlc3QvbGluay10ZXN0IGNvcHkvbWQ1LWxpbmtlZFxuXG5cdFx0Ly8gQ29weSB3aXRoIGBwcmVzZXJ2ZVN5bWxpbmtzOiB0cnVlYCBhbmQgdmVyaWZ5IHJlc3VsdFxuXHRcdC8vXG5cdFx0Ly8gV2luZG93czogdGhpcyB0ZXN0IGRvZXMgbm90IHdvcmsgYmVjYXVzZSBjcmVhdGluZyBzeW1saW5rc1xuXHRcdC8vIHJlcXVpcmVzIHByaXZpbGVkZ2VkIHBlcm1pc3Npb25zIChhZG1pbikuXG5cdFx0aWYgKCFpc1dpbmRvd3MpIHtcblx0XHRcdGF3YWl0IFByb21pc2VzLmNvcHkoc291cmNlTGlua1Rlc3RGb2xkZXIsIHRhcmdldExpbmtUZXN0Rm9sZGVyLCB7IHByZXNlcnZlU3ltbGlua3M6IHRydWUgfSk7XG5cblx0XHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHRhcmdldExpbmtUZXN0Rm9sZGVyKSk7XG5cdFx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyh0YXJnZXRMaW5rTUQ1SlNGb2xkZXIpKTtcblx0XHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHRhcmdldExpbmtNRDVKU0ZpbGUpKTtcblx0XHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHRhcmdldExpbmtNRDVKU0ZvbGRlckxpbmtlZCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGZzLmxzdGF0U3luYyh0YXJnZXRMaW5rTUQ1SlNGb2xkZXJMaW5rZWQpLmlzU3ltYm9saWNMaW5rKCkpO1xuXG5cdFx0XHRjb25zdCBsaW5rVGFyZ2V0ID0gYXdhaXQgZnMucHJvbWlzZXMucmVhZGxpbmsodGFyZ2V0TGlua01ENUpTRm9sZGVyTGlua2VkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5rVGFyZ2V0LCB0YXJnZXRMaW5rTUQ1SlNGb2xkZXIpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlcy5ybSh0YXJnZXRMaW5rVGVzdEZvbGRlcik7XG5cdFx0fVxuXG5cdFx0Ly8gQ29weSB3aXRoIGBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZWAgYW5kIHZlcmlmeSByZXN1bHRcblx0XHRhd2FpdCBQcm9taXNlcy5jb3B5KHNvdXJjZUxpbmtUZXN0Rm9sZGVyLCB0YXJnZXRMaW5rVGVzdEZvbGRlciwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZSB9KTtcblxuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHRhcmdldExpbmtUZXN0Rm9sZGVyKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmModGFyZ2V0TGlua01ENUpTRm9sZGVyKSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmModGFyZ2V0TGlua01ENUpTRmlsZSkpO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHRhcmdldExpbmtNRDVKU0ZvbGRlckxpbmtlZCkpO1xuXHRcdGFzc2VydC5vayhmcy5sc3RhdFN5bmModGFyZ2V0TGlua01ENUpTRm9sZGVyTGlua2VkKS5pc0RpcmVjdG9yeSgpKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZERpcnNJbkRpcicsIGFzeW5jICgpID0+IHtcblx0XHRmcy5ta2RpclN5bmMoam9pbih0ZXN0RGlyLCAnc29tZWZvbGRlcjEnKSk7XG5cdFx0ZnMubWtkaXJTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmb2xkZXIyJykpO1xuXHRcdGZzLm1rZGlyU3luYyhqb2luKHRlc3REaXIsICdzb21lZm9sZGVyMycpKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVmaWxlLnR4dCcpLCAnQ29udGVudHMnKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKGpvaW4odGVzdERpciwgJ3NvbWVPdGhlckZpbGUudHh0JyksICdDb250ZW50cycpO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgUHJvbWlzZXMucmVhZERpcnNJbkRpcih0ZXN0RGlyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0Lmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5pbmRleE9mKCdzb21lZm9sZGVyMScpICE9PSAtMSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5pbmRleE9mKCdzb21lZm9sZGVyMicpICE9PSAtMSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5pbmRleE9mKCdzb21lZm9sZGVyMycpICE9PSAtMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXQgbGluaycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBkaXJlY3RvcnkgPSByYW5kb21QYXRoKHRlc3REaXIpO1xuXHRcdGNvbnN0IHN5bWJvbGljTGluayA9IHJhbmRvbVBhdGgodGVzdERpcik7XG5cblx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihkaXJlY3RvcnksIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG5cdFx0ZnMuc3ltbGlua1N5bmMoZGlyZWN0b3J5LCBzeW1ib2xpY0xpbmssICdqdW5jdGlvbicpO1xuXG5cdFx0bGV0IHN0YXRBbmRJc0xpbmsgPSBhd2FpdCBTeW1saW5rU3VwcG9ydC5zdGF0KGRpcmVjdG9yeSk7XG5cdFx0YXNzZXJ0Lm9rKCFzdGF0QW5kSXNMaW5rPy5zeW1ib2xpY0xpbmspO1xuXG5cdFx0c3RhdEFuZElzTGluayA9IGF3YWl0IFN5bWxpbmtTdXBwb3J0LnN0YXQoc3ltYm9saWNMaW5rKTtcblx0XHRhc3NlcnQub2soc3RhdEFuZElzTGluaz8uc3ltYm9saWNMaW5rKTtcblx0XHRhc3NlcnQub2soIXN0YXRBbmRJc0xpbms/LnN5bWJvbGljTGluaz8uZGFuZ2xpbmcpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGF0IGxpbmsgKG5vbiBleGlzdGluZyB0YXJnZXQpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGRpcmVjdG9yeSA9IHJhbmRvbVBhdGgodGVzdERpcik7XG5cdFx0Y29uc3Qgc3ltYm9saWNMaW5rID0gcmFuZG9tUGF0aCh0ZXN0RGlyKTtcblxuXHRcdGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKGRpcmVjdG9yeSwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cblx0XHRmcy5zeW1saW5rU3luYyhkaXJlY3RvcnksIHN5bWJvbGljTGluaywgJ2p1bmN0aW9uJyk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5ybShkaXJlY3RvcnkpO1xuXG5cdFx0Y29uc3Qgc3RhdEFuZElzTGluayA9IGF3YWl0IFN5bWxpbmtTdXBwb3J0LnN0YXQoc3ltYm9saWNMaW5rKTtcblx0XHRhc3NlcnQub2soc3RhdEFuZElzTGluaz8uc3ltYm9saWNMaW5rKTtcblx0XHRhc3NlcnQub2soc3RhdEFuZElzTGluaz8uc3ltYm9saWNMaW5rPy5kYW5nbGluZyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRkaXInLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYgKHR5cGVvZiBwcm9jZXNzLnZlcnNpb25zWydlbGVjdHJvbiddICE9PSAndW5kZWZpbmVkJyAvKiBuZWVkcyBlbGVjdHJvbiAqLykge1xuXHRcdFx0Y29uc3QgcGFyZW50ID0gcmFuZG9tUGF0aChqb2luKHRlc3REaXIsICdwZnMnKSk7XG5cdFx0XHRjb25zdCBuZXdEaXIgPSBqb2luKHBhcmVudCwgJ1x1MDBGNlx1MDBFNFx1MDBGQycpO1xuXG5cdFx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihuZXdEaXIsIHsgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXG5cdFx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhuZXdEaXIpKTtcblxuXHRcdFx0Y29uc3QgY2hpbGRyZW4gPSBhd2FpdCBQcm9taXNlcy5yZWFkZGlyKHBhcmVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uc29tZShuID0+IG4gPT09ICdcdTAwRjZcdTAwRTRcdTAwRkMnKSwgdHJ1ZSk7IC8vIE1hYyBhbHdheXMgY29udmVydHMgdG8gTkZELCBzb1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgncmVhZGRpciAod2l0aCBmaWxlIHR5cGVzKScsIGFzeW5jICgpID0+IHtcblx0XHRpZiAodHlwZW9mIHByb2Nlc3MudmVyc2lvbnNbJ2VsZWN0cm9uJ10gIT09ICd1bmRlZmluZWQnIC8qIG5lZWRzIGVsZWN0cm9uICovKSB7XG5cdFx0XHRjb25zdCBuZXdEaXIgPSBqb2luKHRlc3REaXIsICdcdTAwRjZcdTAwRTRcdTAwRkMnKTtcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKG5ld0RpciwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShqb2luKHRlc3REaXIsICdzb21lZmlsZS50eHQnKSwgJ2NvbnRlbnRzJyk7XG5cblx0XHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKG5ld0RpcikpO1xuXG5cdFx0XHRjb25zdCBjaGlsZHJlbiA9IGF3YWl0IFByb21pc2VzLnJlYWRkaXIodGVzdERpciwgeyB3aXRoRmlsZVR5cGVzOiB0cnVlIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uc29tZShuID0+IG4ubmFtZSA9PT0gJ1x1MDBGNlx1MDBFNFx1MDBGQycpLCB0cnVlKTsgLy8gTWFjIGFsd2F5cyBjb252ZXJ0cyB0byBORkQsIHNvXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uc29tZShuID0+IG4uaXNEaXJlY3RvcnkoKSksIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hpbGRyZW4uc29tZShuID0+IG4ubmFtZSA9PT0gJ3NvbWVmaWxlLnR4dCcpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGlsZHJlbi5zb21lKG4gPT4gbi5pc0ZpbGUoKSksIHRydWUpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnd3JpdGVGaWxlIChzdHJpbmcpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNtYWxsRGF0YSA9ICdIZWxsbyBXb3JsZCc7XG5cdFx0Y29uc3QgYmlnRGF0YSA9IChuZXcgQXJyYXkoMTAwICogMTAyNCkpLmpvaW4oJ0xhcmdlIFN0cmluZ1xcbicpO1xuXG5cdFx0cmV0dXJuIHRlc3RXcml0ZUZpbGUoc21hbGxEYXRhLCBzbWFsbERhdGEsIGJpZ0RhdGEsIGJpZ0RhdGEpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZUZpbGUgKHN0cmluZykgLSBmbHVzaCBvbiB3cml0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25maWd1cmVGbHVzaE9uV3JpdGUodHJ1ZSk7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHNtYWxsRGF0YSA9ICdIZWxsbyBXb3JsZCc7XG5cdFx0XHRjb25zdCBiaWdEYXRhID0gKG5ldyBBcnJheSgxMDAgKiAxMDI0KSkuam9pbignTGFyZ2UgU3RyaW5nXFxuJyk7XG5cblx0XHRcdHJldHVybiBhd2FpdCB0ZXN0V3JpdGVGaWxlKHNtYWxsRGF0YSwgc21hbGxEYXRhLCBiaWdEYXRhLCBiaWdEYXRhKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0Y29uZmlndXJlRmx1c2hPbldyaXRlKGZhbHNlKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlRmlsZSAoQnVmZmVyKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzbWFsbERhdGEgPSAnSGVsbG8gV29ybGQnO1xuXHRcdGNvbnN0IGJpZ0RhdGEgPSAobmV3IEFycmF5KDEwMCAqIDEwMjQpKS5qb2luKCdMYXJnZSBTdHJpbmdcXG4nKTtcblxuXHRcdHJldHVybiB0ZXN0V3JpdGVGaWxlKEJ1ZmZlci5mcm9tKHNtYWxsRGF0YSksIHNtYWxsRGF0YSwgQnVmZmVyLmZyb20oYmlnRGF0YSksIGJpZ0RhdGEpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZUZpbGUgKFVJbnQ4QXJyYXkpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNtYWxsRGF0YSA9ICdIZWxsbyBXb3JsZCc7XG5cdFx0Y29uc3QgYmlnRGF0YSA9IChuZXcgQXJyYXkoMTAwICogMTAyNCkpLmpvaW4oJ0xhcmdlIFN0cmluZ1xcbicpO1xuXG5cdFx0cmV0dXJuIHRlc3RXcml0ZUZpbGUoVlNCdWZmZXIuZnJvbVN0cmluZyhzbWFsbERhdGEpLmJ1ZmZlciwgc21hbGxEYXRhLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGJpZ0RhdGEpLmJ1ZmZlciwgYmlnRGF0YSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RXcml0ZUZpbGUoXG5cdFx0c21hbGxEYXRhOiBzdHJpbmcgfCBCdWZmZXIgfCBVaW50OEFycmF5LFxuXHRcdHNtYWxsRGF0YVZhbHVlOiBzdHJpbmcsXG5cdFx0YmlnRGF0YTogc3RyaW5nIHwgQnVmZmVyIHwgVWludDhBcnJheSxcblx0XHRiaWdEYXRhVmFsdWU6IHN0cmluZ1xuXHQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB0ZXN0RmlsZSA9IGpvaW4odGVzdERpciwgJ2ZsdXNoZWQudHh0Jyk7XG5cblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyh0ZXN0RGlyKSk7XG5cblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUodGVzdEZpbGUsIHNtYWxsRGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZzLnJlYWRGaWxlU3luYyh0ZXN0RmlsZSkudG9TdHJpbmcoKSwgc21hbGxEYXRhVmFsdWUpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKHRlc3RGaWxlLCBiaWdEYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlKS50b1N0cmluZygpLCBiaWdEYXRhVmFsdWUpO1xuXHR9XG5cblx0dGVzdCgnd3JpdGVGaWxlIChzdHJpbmcsIGVycm9yIGhhbmRsaW5nKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0RmlsZSA9IGpvaW4odGVzdERpciwgJ2ZsdXNoZWQudHh0Jyk7XG5cblx0XHRmcy5ta2RpclN5bmModGVzdEZpbGUpOyAvLyB0aGlzIHdpbGwgdHJpZ2dlciBhbiBlcnJvciBsYXRlciBiZWNhdXNlIHRlc3RGaWxlIGlzIG5vdyBhIGRpcmVjdG9yeSFcblxuXHRcdGxldCBleHBlY3RlZEVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKHRlc3RGaWxlLCAnSGVsbG8gV29ybGQnKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0ZXhwZWN0ZWRFcnJvciA9IGVycm9yO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhleHBlY3RlZEVycm9yKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGVGaWxlU3luYycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0ZXN0RmlsZSA9IGpvaW4odGVzdERpciwgJ2ZsdXNoZWQudHh0Jyk7XG5cblx0XHR3cml0ZUZpbGVTeW5jKHRlc3RGaWxlLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZnMucmVhZEZpbGVTeW5jKHRlc3RGaWxlKS50b1N0cmluZygpLCAnSGVsbG8gV29ybGQnKTtcblxuXHRcdGNvbnN0IGxhcmdlU3RyaW5nID0gKG5ldyBBcnJheSgxMDAgKiAxMDI0KSkuam9pbignTGFyZ2UgU3RyaW5nXFxuJyk7XG5cblx0XHR3cml0ZUZpbGVTeW5jKHRlc3RGaWxlLCBsYXJnZVN0cmluZyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZzLnJlYWRGaWxlU3luYyh0ZXN0RmlsZSkudG9TdHJpbmcoKSwgbGFyZ2VTdHJpbmcpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFlBQVksUUFBUTtBQUNwQixTQUFTLGNBQWM7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxTQUFTLE1BQU0sV0FBVztBQUM3QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLHVCQUF1QixVQUFVLFlBQVksWUFBWSxnQkFBZ0IscUJBQXFCO0FBQ3ZHLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsWUFBWSx5QkFBeUI7QUFFOUMsc0JBQXNCLEtBQUs7QUFFM0IsV0FBVyxPQUFPLFdBQVk7QUFFN0IsTUFBSTtBQUVKLFFBQU0sTUFBTTtBQUNYLGNBQVUsa0JBQWtCLE9BQU8sR0FBRyxZQUFZLEtBQUs7QUFFdkQsV0FBTyxHQUFHLFNBQVMsTUFBTSxTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQSxFQUN0RCxDQUFDO0FBRUQsV0FBUyxNQUFNO0FBQ2QsV0FBTyxTQUFTLEdBQUcsT0FBTztBQUFBLEVBQzNCLENBQUM7QUFFRCxPQUFLLGFBQWEsWUFBWTtBQUM3QixVQUFNLFdBQVcsS0FBSyxTQUFTLGVBQWU7QUFFOUMsV0FBTyxHQUFHLENBQUUsTUFBTSxTQUFTLE9BQU8sUUFBUSxDQUFFO0FBRTVDLFVBQU0sU0FBUyxVQUFVLFVBQVUsZUFBZ0IsSUFBTTtBQUV6RCxXQUFPLGFBQWEsTUFBTSxHQUFHLFNBQVMsU0FBUyxRQUFRLEdBQUcsU0FBUyxHQUFHLGFBQWE7QUFBQSxFQUNwRixDQUFDO0FBRUQsT0FBSyx1REFBdUQsWUFBWTtBQUN2RSxVQUFNLFlBQVksS0FB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
