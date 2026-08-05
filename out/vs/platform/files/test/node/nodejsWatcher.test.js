import * as fs from "fs";
import assert from "assert";
import { tmpdir } from "os";
import { basename, dirname, join } from "../../../../base/common/path.js";
import { Promises, RimRafMode } from "../../../../base/node/pfs.js";
import { getRandomTestPath } from "../../../../base/test/node/testUtils.js";
import { FileChangeFilter, FileChangeType } from "../../common/files.js";
import { watchFileContents } from "../../node/watcher/nodejs/nodejsWatcherLib.js";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { getDriveLetter } from "../../../../base/common/extpath.js";
import { ltrim } from "../../../../base/common/strings.js";
import { DeferredPromise, timeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { NodeJSWatcher } from "../../node/watcher/nodejs/nodejsWatcher.js";
import { FileAccess } from "../../../../base/common/network.js";
import { extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { addUNCHostToAllowlist } from "../../../../base/node/unc.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { TestParcelWatcher } from "./parcelWatcher.test.js";
suite.skip("File Watcher (node.js)", function() {
  this.timeout(1e4);
  class TestNodeJSWatcher extends NodeJSWatcher {
    constructor() {
      super(...arguments);
      this.suspendedWatchRequestPollingInterval = 100;
      this._onDidWatch = this._register(new Emitter());
      this.onDidWatch = this._onDidWatch.event;
      this.onWatchFail = this._onDidWatchFail.event;
    }
    getUpdateWatchersDelay() {
      return 0;
    }
    async doWatch(requests) {
      await super.doWatch(requests);
      for (const watcher2 of this.watchers) {
        await watcher2.instance.ready;
      }
      this._onDidWatch.fire();
    }
  }
  let testDir;
  let watcher;
  let loggingEnabled = false;
  function enableLogging(enable) {
    loggingEnabled = enable;
    watcher?.setVerboseLogging(enable);
  }
  enableLogging(loggingEnabled);
  setup(async () => {
    await createWatcher(void 0);
    testDir = URI.file(getRandomTestPath(fs.realpathSync(tmpdir()), "vsctests", "filewatcher")).fsPath;
    const sourceDir = FileAccess.asFileUri("vs/platform/files/test/node/fixtures/service").fsPath;
    await Promises.copy(sourceDir, testDir, { preserveSymlinks: false });
  });
  async function createWatcher(accessor) {
    await watcher?.stop();
    watcher?.dispose();
    watcher = new TestNodeJSWatcher(accessor);
    watcher?.setVerboseLogging(loggingEnabled);
    watcher.onDidLogMessage((e) => {
      if (loggingEnabled) {
        console.log(`[non-recursive watcher test message] ${e.message}`);
      }
    });
    watcher.onDidError((e) => {
      if (loggingEnabled) {
        console.log(`[non-recursive watcher test error] ${e}`);
      }
    });
  }
  teardown(async () => {
    await watcher.stop();
    watcher.dispose();
    return Promises.rm(testDir).catch((error) => console.error(error));
  });
  function toMsg(type) {
    switch (type) {
      case FileChangeType.ADDED:
        return "added";
      case FileChangeType.DELETED:
        return "deleted";
      default:
        return "changed";
    }
  }
  async function awaitEvent(service, path, type, correlationId, expectedCount) {
    if (loggingEnabled) {
      console.log(`Awaiting change type '${toMsg(type)}' on file '${path}'`);
    }
    await new Promise((resolve) => {
      let counter = 0;
      const disposable = service.onDidChangeFile((events) => {
        for (const event of events) {
          if (extUriBiasedIgnorePathCase.isEqual(event.resource, URI.file(path)) && event.type === type && (correlationId === null || event.cId === correlationId)) {
            counter++;
            if (typeof expectedCount === "number" && counter < expectedCount) {
              continue;
            }
            disposable.dispose();
            resolve();
            break;
          }
        }
      });
    });
  }
  test("basics (folder watch)", async function() {
    const request = { path: testDir, excludes: [], recursive: false };
    await watcher.watch([request]);
    assert.strictEqual(watcher.isSuspended(request), false);
    const instance = Array.from(watcher.watchers)[0].instance;
    assert.strictEqual(instance.isReusingRecursiveWatcher, false);
    assert.strictEqual(instance.failed, false);
    const newFilePath = join(testDir, "newFile.txt");
    let changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newFilePath, "Hello World");
    await changeFuture;
    const newFolderPath = join(testDir, "New Folder");
    changeFuture = awaitEvent(watcher, newFolderPath, FileChangeType.ADDED);
    await fs.promises.mkdir(newFolderPath);
    await changeFuture;
    let renamedFilePath = join(testDir, "renamedFile.txt");
    changeFuture = Promise.all([
      awaitEvent(watcher, newFilePath, FileChangeType.DELETED),
      awaitEvent(watcher, renamedFilePath, FileChangeType.ADDED)
    ]);
    await Promises.rename(newFilePath, renamedFilePath);
    await changeFuture;
    let renamedFolderPath = join(testDir, "Renamed Folder");
    changeFuture = Promise.all([
      awaitEvent(watcher, newFolderPath, FileChangeType.DELETED),
      awaitEvent(watcher, renamedFolderPath, FileChangeType.ADDED)
    ]);
    await Promises.rename(newFolderPath, renamedFolderPath);
    await changeFuture;
    const caseRenamedFilePath = join(testDir, "RenamedFile.txt");
    changeFuture = Promise.all([
      awaitEvent(watcher, renamedFilePath, FileChangeType.DELETED),
      awaitEvent(watcher, caseRenamedFilePath, FileChangeType.ADDED)
    ]);
    await Promises.rename(renamedFilePath, caseRenamedFilePath);
    await changeFuture;
    renamedFilePath = caseRenamedFilePath;
    const caseRenamedFolderPath = join(testDir, "REnamed Folder");
    changeFuture = Promise.all([
      awaitEvent(watcher, renamedFolderPath, FileChangeType.DELETED),
      awaitEvent(watcher, caseRenamedFolderPath, FileChangeType.ADDED)
    ]);
    await Promises.rename(renamedFolderPath, caseRenamedFolderPath);
    await changeFuture;
    renamedFolderPath = caseRenamedFolderPath;
    const movedFilepath = join(testDir, "movedFile.txt");
    changeFuture = Promise.all([
      awaitEvent(watcher, renamedFilePath, FileChangeType.DELETED),
      awaitEvent(watcher, movedFilepath, FileChangeType.ADDED)
    ]);
    await Promises.rename(renamedFilePath, movedFilepath);
    await changeFuture;
    const movedFolderpath = join(testDir, "Moved Folder");
    changeFuture = Promise.all([
      awaitEvent(watcher, renamedFolderPath, FileChangeType.DELETED),
      awaitEvent(watcher, movedFolderpath, FileChangeType.ADDED)
    ]);
    await Promises.rename(renamedFolderPath, movedFolderpath);
    await changeFuture;
    const copiedFilepath = join(testDir, "copiedFile.txt");
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.ADDED);
    await fs.promises.copyFile(movedFilepath, copiedFilepath);
    await changeFuture;
    const copiedFolderpath = join(testDir, "Copied Folder");
    changeFuture = awaitEvent(watcher, copiedFolderpath, FileChangeType.ADDED);
    await Promises.copy(movedFolderpath, copiedFolderpath, { preserveSymlinks: false });
    await changeFuture;
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.UPDATED);
    await Promises.writeFile(copiedFilepath, "Hello Change");
    await changeFuture;
    const anotherNewFilePath = join(testDir, "anotherNewFile.txt");
    changeFuture = awaitEvent(watcher, anotherNewFilePath, FileChangeType.ADDED);
    await Promises.writeFile(anotherNewFilePath, "Hello Another World");
    await changeFuture;
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.DELETED);
    await fs.promises.unlink(copiedFilepath);
    await changeFuture;
    changeFuture = awaitEvent(watcher, copiedFolderpath, FileChangeType.DELETED);
    await fs.promises.rmdir(copiedFolderpath);
    await changeFuture;
    watcher.dispose();
  });
  test("basics (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    const request = { path: filePath, excludes: [], recursive: false };
    await watcher.watch([request]);
    assert.strictEqual(watcher.isSuspended(request), false);
    const instance = Array.from(watcher.watchers)[0].instance;
    assert.strictEqual(instance.isReusingRecursiveWatcher, false);
    assert.strictEqual(instance.failed, false);
    let changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED);
    await fs.promises.unlink(filePath);
    await changeFuture;
    await Promises.writeFile(filePath, "Hello Change");
    await watcher.watch([]);
    await watcher.watch([{ path: filePath, excludes: [], recursive: false }]);
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED);
    await Promises.rename(filePath, `${filePath}-moved`);
    await changeFuture;
  });
  test("atomic writes (folder watch)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], recursive: false }]);
    const newFilePath = join(testDir, "lorem.txt");
    const changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.UPDATED);
    await fs.promises.unlink(newFilePath);
    Promises.writeFile(newFilePath, "Hello Atomic World");
    await changeFuture;
  });
  test("atomic writes (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    await watcher.watch([{ path: filePath, excludes: [], recursive: false }]);
    const newFilePath = join(filePath);
    const changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.UPDATED);
    await fs.promises.unlink(newFilePath);
    Promises.writeFile(newFilePath, "Hello Atomic World");
    await changeFuture;
  });
  test("multiple events (folder watch)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], recursive: false }]);
    const newFilePath1 = join(testDir, "newFile-1.txt");
    const newFilePath2 = join(testDir, "newFile-2.txt");
    const newFilePath3 = join(testDir, "newFile-3.txt");
    const addedFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.ADDED);
    const addedFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.ADDED);
    const addedFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.ADDED);
    await Promise.all([
      await Promises.writeFile(newFilePath1, "Hello World 1"),
      await Promises.writeFile(newFilePath2, "Hello World 2"),
      await Promises.writeFile(newFilePath3, "Hello World 3")
    ]);
    await Promise.all([addedFuture1, addedFuture2, addedFuture3]);
    const changeFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.UPDATED);
    const changeFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.UPDATED);
    const changeFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.UPDATED);
    await Promise.all([
      await Promises.writeFile(newFilePath1, "Hello Update 1"),
      await Promises.writeFile(newFilePath2, "Hello Update 2"),
      await Promises.writeFile(newFilePath3, "Hello Update 3")
    ]);
    await Promise.all([changeFuture1, changeFuture2, changeFuture3]);
    const copyFuture1 = awaitEvent(watcher, join(testDir, "newFile-1-copy.txt"), FileChangeType.ADDED);
    const copyFuture2 = awaitEvent(watcher, join(testDir, "newFile-2-copy.txt"), FileChangeType.ADDED);
    const copyFuture3 = awaitEvent(watcher, join(testDir, "newFile-3-copy.txt"), FileChangeType.ADDED);
    await Promise.all([
      Promises.copy(join(testDir, "newFile-1.txt"), join(testDir, "newFile-1-copy.txt"), { preserveSymlinks: false }),
      Promises.copy(join(testDir, "newFile-2.txt"), join(testDir, "newFile-2-copy.txt"), { preserveSymlinks: false }),
      Promises.copy(join(testDir, "newFile-3.txt"), join(testDir, "newFile-3-copy.txt"), { preserveSymlinks: false })
    ]);
    await Promise.all([copyFuture1, copyFuture2, copyFuture3]);
    const deleteFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.DELETED);
    const deleteFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.DELETED);
    const deleteFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.DELETED);
    await Promise.all([
      await fs.promises.unlink(newFilePath1),
      await fs.promises.unlink(newFilePath2),
      await fs.promises.unlink(newFilePath3)
    ]);
    await Promise.all([deleteFuture1, deleteFuture2, deleteFuture3]);
  });
  test("multiple events (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    await watcher.watch([{ path: filePath, excludes: [], recursive: false }]);
    const changeFuture1 = awaitEvent(watcher, filePath, FileChangeType.UPDATED);
    await Promise.all([
      await Promises.writeFile(filePath, "Hello Update 1"),
      await Promises.writeFile(filePath, "Hello Update 2"),
      await Promises.writeFile(filePath, "Hello Update 3")
    ]);
    await Promise.all([changeFuture1]);
  });
  test("excludes can be updated (folder watch)", async function() {
    await watcher.watch([{ path: testDir, excludes: ["**"], recursive: false }]);
    await watcher.watch([{ path: testDir, excludes: [], recursive: false }]);
    return basicCrudTest(join(testDir, "files-excludes.txt"));
  });
  test("excludes are ignored (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    await watcher.watch([{ path: filePath, excludes: ["**"], recursive: false }]);
    return basicCrudTest(filePath, true);
  });
  test("includes can be updated (folder watch)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["nothing"], recursive: false }]);
    await watcher.watch([{ path: testDir, excludes: [], recursive: false }]);
    return basicCrudTest(join(testDir, "files-includes.txt"));
  });
  test("non-includes are ignored (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    await watcher.watch([{ path: filePath, excludes: [], includes: ["nothing"], recursive: false }]);
    return basicCrudTest(filePath, true);
  });
  test("includes are supported (folder watch)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["**/files-includes.txt"], recursive: false }]);
    return basicCrudTest(join(testDir, "files-includes.txt"));
  });
  test("includes are supported (folder watch, relative pattern explicit)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: [{ base: testDir, pattern: "files-includes.txt" }], recursive: false }]);
    return basicCrudTest(join(testDir, "files-includes.txt"));
  });
  test("includes are supported (folder watch, relative pattern implicit)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["files-includes.txt"], recursive: false }]);
    return basicCrudTest(join(testDir, "files-includes.txt"));
  });
  test("correlationId is supported", async function() {
    const correlationId = Math.random();
    await watcher.watch([{ correlationId, path: testDir, excludes: [], recursive: false }]);
    return basicCrudTest(join(testDir, "newFile.txt"), void 0, correlationId);
  });
  (isWindows ? test.skip : test)("symlink support (folder watch)", async function() {
    const link = join(testDir, "deep-linked");
    const linkTarget = join(testDir, "deep");
    await fs.promises.symlink(linkTarget, link);
    await watcher.watch([{ path: link, excludes: [], recursive: false }]);
    return basicCrudTest(join(link, "newFile.txt"));
  });
  async function basicCrudTest(filePath, skipAdd, correlationId, expectedCount, awaitWatchAfterAdd) {
    let changeFuture;
    if (!skipAdd) {
      changeFuture = awaitEvent(watcher, filePath, FileChangeType.ADDED, correlationId, expectedCount);
      await Promises.writeFile(filePath, "Hello World");
      await changeFuture;
      if (awaitWatchAfterAdd) {
        await Event.toPromise(watcher.onDidWatch);
      }
    }
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED, correlationId, expectedCount);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, correlationId, expectedCount);
    await fs.promises.unlink(await Promises.realpath(filePath));
    await changeFuture;
  }
  (isWindows ? test.skip : test)("symlink support (file watch)", async function() {
    const link = join(testDir, "lorem.txt-linked");
    const linkTarget = join(testDir, "lorem.txt");
    await fs.promises.symlink(linkTarget, link);
    await watcher.watch([{ path: link, excludes: [], recursive: false }]);
    return basicCrudTest(link, true);
  });
  (!isWindows ? test.skip : test)("unc support (folder watch)", async function() {
    addUNCHostToAllowlist("localhost");
    const uncPath = `\\\\localhost\\${getDriveLetter(testDir)?.toLowerCase()}$\\${ltrim(testDir.substr(testDir.indexOf(":") + 1), "\\")}`;
    await watcher.watch([{ path: uncPath, excludes: [], recursive: false }]);
    return basicCrudTest(join(uncPath, "newFile.txt"));
  });
  (!isWindows ? test.skip : test)("unc support (file watch)", async function() {
    addUNCHostToAllowlist("localhost");
    const uncPath = `\\\\localhost\\${getDriveLetter(testDir)?.toLowerCase()}$\\${ltrim(testDir.substr(testDir.indexOf(":") + 1), "\\")}\\lorem.txt`;
    await watcher.watch([{ path: uncPath, excludes: [], recursive: false }]);
    return basicCrudTest(uncPath, true);
  });
  (isLinux ? test.skip : test)("wrong casing (folder watch)", async function() {
    const wrongCase = join(dirname(testDir), basename(testDir).toUpperCase());
    await watcher.watch([{ path: wrongCase, excludes: [], recursive: false }]);
    return basicCrudTest(join(wrongCase, "newFile.txt"));
  });
  (isLinux ? test.skip : test)("wrong casing (file watch)", async function() {
    const filePath = join(testDir, "LOREM.txt");
    await watcher.watch([{ path: filePath, excludes: [], recursive: false }]);
    return basicCrudTest(filePath, true);
  });
  test("invalid path does not explode", async function() {
    const invalidPath = join(testDir, "invalid");
    await watcher.watch([{ path: invalidPath, excludes: [], recursive: false }]);
  });
  test("watchFileContents", async function() {
    const watchedPath = join(testDir, "lorem.txt");
    const cts = new CancellationTokenSource();
    const readyPromise = new DeferredPromise();
    const chunkPromise = new DeferredPromise();
    const watchPromise = watchFileContents(watchedPath, () => chunkPromise.complete(), () => readyPromise.complete(), cts.token);
    await readyPromise.p;
    Promises.writeFile(watchedPath, "Hello World");
    await chunkPromise.p;
    cts.cancel();
    return watchPromise;
  });
  test("watching same or overlapping paths supported when correlation is applied", async function() {
    await watcher.watch([
      { path: testDir, excludes: [], recursive: false, correlationId: 1 }
    ]);
    await basicCrudTest(join(testDir, "newFile_1.txt"), void 0, null, 1);
    await watcher.watch([
      { path: testDir, excludes: [], recursive: false, correlationId: 1 },
      { path: testDir, excludes: [], recursive: false, correlationId: 2 },
      { path: testDir, excludes: [], recursive: false, correlationId: void 0 }
    ]);
    await basicCrudTest(join(testDir, "newFile_2.txt"), void 0, null, 3);
    await basicCrudTest(join(testDir, "otherNewFile.txt"), void 0, null, 3);
  });
  test("watching missing path emits watcher fail event", async function() {
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const folderPath = join(testDir, "missing");
    watcher.watch([{ path: folderPath, excludes: [], recursive: true }]);
    await onDidWatchFail;
  });
  test("deleting watched path emits watcher fail and delete event when correlated (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    await watcher.watch([{ path: filePath, excludes: [], recursive: false, correlationId: 1 }]);
    const instance = Array.from(watcher.watchers)[0].instance;
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, 1);
    fs.promises.unlink(filePath);
    await onDidWatchFail;
    await changeFuture;
    assert.strictEqual(instance.failed, true);
  });
  (isMacintosh || isWindows ? test.skip : test)("deleting watched path emits watcher fail and delete event when correlated (folder watch)", async function() {
    const folderPath = join(testDir, "deep");
    await watcher.watch([{ path: folderPath, excludes: [], recursive: false, correlationId: 1 }]);
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const changeFuture = awaitEvent(watcher, folderPath, FileChangeType.DELETED, 1);
    Promises.rm(folderPath, RimRafMode.UNLINK);
    await onDidWatchFail;
    await changeFuture;
  });
  test("watch requests support suspend/resume (file, does not exist in beginning)", async function() {
    const filePath = join(testDir, "not-found.txt");
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const request = { path: filePath, excludes: [], recursive: false };
    await watcher.watch([request]);
    await onDidWatchFail;
    assert.strictEqual(watcher.isSuspended(request), "polling");
    await basicCrudTest(filePath, void 0, null, void 0, true);
    await basicCrudTest(filePath, void 0, null, void 0, true);
  });
  test("watch requests support suspend/resume (file, exists in beginning)", async function() {
    const filePath = join(testDir, "lorem.txt");
    const request = { path: filePath, excludes: [], recursive: false };
    await watcher.watch([request]);
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    await basicCrudTest(filePath, true);
    await onDidWatchFail;
    assert.strictEqual(watcher.isSuspended(request), "polling");
    await basicCrudTest(filePath, void 0, null, void 0, true);
  });
  (isWindows ? test.skip : test)("watch requests support suspend/resume (folder, does not exist in beginning)", async function() {
    let onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const folderPath = join(testDir, "not-found");
    const request = { path: folderPath, excludes: [], recursive: false };
    await watcher.watch([request]);
    await onDidWatchFail;
    assert.strictEqual(watcher.isSuspended(request), "polling");
    let changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
    let onDidWatch = Event.toPromise(watcher.onDidWatch);
    await fs.promises.mkdir(folderPath);
    await changeFuture;
    await onDidWatch;
    assert.strictEqual(watcher.isSuspended(request), false);
    if (isWindows) {
      const filePath = join(folderPath, "newFile.txt");
      await basicCrudTest(filePath);
      onDidWatchFail = Event.toPromise(watcher.onWatchFail);
      await fs.promises.rmdir(folderPath);
      await onDidWatchFail;
      changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
      onDidWatch = Event.toPromise(watcher.onDidWatch);
      await fs.promises.mkdir(folderPath);
      await changeFuture;
      await onDidWatch;
      await timeout(500);
      await basicCrudTest(filePath);
    }
  });
  (isMacintosh ? test.skip : test)("watch requests support suspend/resume (folder, exists in beginning)", async function() {
    const folderPath = join(testDir, "deep");
    await watcher.watch([{ path: folderPath, excludes: [], recursive: false }]);
    const filePath = join(folderPath, "newFile.txt");
    await basicCrudTest(filePath);
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    await Promises.rm(folderPath);
    await onDidWatchFail;
    const changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
    const onDidWatch = Event.toPromise(watcher.onDidWatch);
    await fs.promises.mkdir(folderPath);
    await changeFuture;
    await onDidWatch;
    await timeout(500);
    await basicCrudTest(filePath);
  });
  test("parcel watcher reused when present for non-recursive file watching (uncorrelated)", function() {
    return testParcelWatcherReused(void 0);
  });
  test("parcel watcher reused when present for non-recursive file watching (correlated)", function() {
    return testParcelWatcherReused(2);
  });
  function createParcelWatcher() {
    const recursiveWatcher = new TestParcelWatcher();
    recursiveWatcher.setVerboseLogging(loggingEnabled);
    recursiveWatcher.onDidLogMessage((e) => {
      if (loggingEnabled) {
        console.log(`[recursive watcher test message] ${e.message}`);
      }
    });
    recursiveWatcher.onDidError((e) => {
      if (loggingEnabled) {
        console.log(`[recursive watcher test error] ${e.error}`);
      }
    });
    return recursiveWatcher;
  }
  async function testParcelWatcherReused(correlationId) {
    const recursiveWatcher = createParcelWatcher();
    await recursiveWatcher.watch([{ path: testDir, excludes: [], recursive: true, correlationId: 1 }]);
    const recursiveInstance = Array.from(recursiveWatcher.watchers)[0];
    assert.strictEqual(recursiveInstance.subscriptionsCount, 0);
    await createWatcher(recursiveWatcher);
    const filePath = join(testDir, "deep", "conway.js");
    await watcher.watch([{ path: filePath, excludes: [], recursive: false, correlationId }]);
    const { instance } = Array.from(watcher.watchers)[0];
    assert.strictEqual(instance.isReusingRecursiveWatcher, true);
    assert.strictEqual(recursiveInstance.subscriptionsCount, 1);
    let changeFuture = awaitEvent(watcher, filePath, isMacintosh ? FileChangeType.ADDED : FileChangeType.UPDATED, correlationId);
    await Promises.writeFile(filePath, "Hello World");
    await changeFuture;
    await recursiveWatcher.stop();
    recursiveWatcher.dispose();
    await timeout(500);
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED, correlationId);
    await Promises.writeFile(filePath, "Hello World");
    await changeFuture;
    assert.strictEqual(instance.isReusingRecursiveWatcher, false);
  }
  test("watch requests support suspend/resume (file, does not exist in beginning, parcel watcher reused)", async function() {
    const recursiveWatcher = createParcelWatcher();
    await recursiveWatcher.watch([{ path: testDir, excludes: [], recursive: true }]);
    await createWatcher(recursiveWatcher);
    const filePath = join(testDir, "not-found-2.txt");
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const request = { path: filePath, excludes: [], recursive: false };
    await watcher.watch([request]);
    await onDidWatchFail;
    assert.strictEqual(watcher.isSuspended(request), true);
    const changeFuture = awaitEvent(watcher, filePath, FileChangeType.ADDED);
    await Promises.writeFile(filePath, "Hello World");
    await changeFuture;
    assert.strictEqual(watcher.isSuspended(request), false);
  });
  test("event type filter (file watch)", async function() {
    const filePath = join(testDir, "lorem.txt");
    const request = { path: filePath, excludes: [], recursive: false, filter: FileChangeFilter.UPDATED | FileChangeFilter.DELETED, correlationId: 1 };
    await watcher.watch([request]);
    let changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED, 1);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, 1);
    await fs.promises.unlink(filePath);
    await changeFuture;
  });
  test("event type filter (folder watch)", async function() {
    const request = { path: testDir, excludes: [], recursive: false, filter: FileChangeFilter.UPDATED | FileChangeFilter.DELETED, correlationId: 1 };
    await watcher.watch([request]);
    const filePath = join(testDir, "lorem.txt");
    let changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED, 1);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, 1);
    await fs.promises.unlink(filePath);
    await changeFuture;
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy90ZXN0L25vZGUvbm9kZWpzV2F0Y2hlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZnMgZnJvbSAnZnMnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgdG1wZGlyIH0gZnJvbSAnb3MnO1xuaW1wb3J0IHsgYmFzZW5hbWUsIGRpcm5hbWUsIGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFByb21pc2VzLCBSaW1SYWZNb2RlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBnZXRSYW5kb21UZXN0UGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9ub2RlL3Rlc3RVdGlscy5qcyc7XG5pbXBvcnQgeyBGaWxlQ2hhbmdlRmlsdGVyLCBGaWxlQ2hhbmdlVHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTm9uUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0LCBJUmVjdXJzaXZlV2F0Y2hlcldpdGhTdWJzY3JpYmUgfSBmcm9tICcuLi8uLi9jb21tb24vd2F0Y2hlci5qcyc7XG5pbXBvcnQgeyB3YXRjaEZpbGVDb250ZW50cyB9IGZyb20gJy4uLy4uL25vZGUvd2F0Y2hlci9ub2RlanMvbm9kZWpzV2F0Y2hlckxpYi5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZ2V0RHJpdmVMZXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9leHRwYXRoLmpzJztcbmltcG9ydCB7IGx0cmltIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBOb2RlSlNXYXRjaGVyIH0gZnJvbSAnLi4vLi4vbm9kZS93YXRjaGVyL25vZGVqcy9ub2RlanNXYXRjaGVyLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBhZGRVTkNIb3N0VG9BbGxvd2xpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL25vZGUvdW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgVGVzdFBhcmNlbFdhdGNoZXIgfSBmcm9tICcuL3BhcmNlbFdhdGNoZXIudGVzdC5qcyc7XG5cbi8vIHRoaXMgc3VpdGUgaGFzIHNob3duIGZsYWt5IHJ1bnMgaW4gQXp1cmUgcGlwZWxpbmVzIHdoZXJlXG4vLyB0YXNrcyB3b3VsZCBqdXN0IGhhbmcgYW5kIHRpbWVvdXQgYWZ0ZXIgYSB3aGlsZSAobm90IGluXG4vLyBtb2NoYSBidXQgZ2VuZXJhbGx5KS4gYXMgc3VjaCB0aGV5IHdpbGwgcnVuIG9ubHkgb24gZGVtYW5kXG4vLyB3aGVuZXZlciB3ZSB1cGRhdGUgdGhlIHdhdGNoZXIgbGlicmFyeS5cblxuc3VpdGUuc2tpcCgnRmlsZSBXYXRjaGVyIChub2RlLmpzKScsIGZ1bmN0aW9uICgpIHtcblxuXHR0aGlzLnRpbWVvdXQoMTAwMDApO1xuXG5cdGNsYXNzIFRlc3ROb2RlSlNXYXRjaGVyIGV4dGVuZHMgTm9kZUpTV2F0Y2hlciB7XG5cblx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgcmVhZG9ubHkgc3VzcGVuZGVkV2F0Y2hSZXF1ZXN0UG9sbGluZ0ludGVydmFsID0gMTAwO1xuXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRXYXRjaCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRcdHJlYWRvbmx5IG9uRGlkV2F0Y2ggPSB0aGlzLl9vbkRpZFdhdGNoLmV2ZW50O1xuXG5cdFx0cmVhZG9ubHkgb25XYXRjaEZhaWwgPSB0aGlzLl9vbkRpZFdhdGNoRmFpbC5ldmVudDtcblxuXHRcdHByb3RlY3RlZCBvdmVycmlkZSBnZXRVcGRhdGVXYXRjaGVyc0RlbGF5KCk6IG51bWJlciB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cblx0XHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgZG9XYXRjaChyZXF1ZXN0czogSU5vblJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRhd2FpdCBzdXBlci5kb1dhdGNoKHJlcXVlc3RzKTtcblx0XHRcdGZvciAoY29uc3Qgd2F0Y2hlciBvZiB0aGlzLndhdGNoZXJzKSB7XG5cdFx0XHRcdGF3YWl0IHdhdGNoZXIuaW5zdGFuY2UucmVhZHk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX29uRGlkV2F0Y2guZmlyZSgpO1xuXHRcdH1cblx0fVxuXG5cdGxldCB0ZXN0RGlyOiBzdHJpbmc7XG5cdGxldCB3YXRjaGVyOiBUZXN0Tm9kZUpTV2F0Y2hlcjtcblxuXHRsZXQgbG9nZ2luZ0VuYWJsZWQgPSBmYWxzZTtcblxuXHRmdW5jdGlvbiBlbmFibGVMb2dnaW5nKGVuYWJsZTogYm9vbGVhbikge1xuXHRcdGxvZ2dpbmdFbmFibGVkID0gZW5hYmxlO1xuXHRcdHdhdGNoZXI/LnNldFZlcmJvc2VMb2dnaW5nKGVuYWJsZSk7XG5cdH1cblxuXHRlbmFibGVMb2dnaW5nKGxvZ2dpbmdFbmFibGVkKTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgY3JlYXRlV2F0Y2hlcih1bmRlZmluZWQpO1xuXG5cdFx0Ly8gUnVsZSBvdXQgc3RyYW5nZSB0ZXN0aW5nIGNvbmRpdGlvbnMgYnkgdXNpbmcgdGhlIHJlYWxwYXRoXG5cdFx0Ly8gaGVyZS4gZm9yIGV4YW1wbGUsIG9uIG1hY09TIHRoZSB0bXAgZGlyIGlzIHBvdGVudGlhbGx5IGFcblx0XHQvLyBzeW1saW5rIGluIHNvbWUgb2YgdGhlIHJvb3QgZm9sZGVycywgd2hpY2ggaXMgYSByYXRoZXJcblx0XHQvLyB1bnJlYWxpc2ljIGNhc2UgZm9yIHRoZSBmaWxlIHdhdGNoZXIuXG5cdFx0dGVzdERpciA9IFVSSS5maWxlKGdldFJhbmRvbVRlc3RQYXRoKGZzLnJlYWxwYXRoU3luYyh0bXBkaXIoKSksICd2c2N0ZXN0cycsICdmaWxld2F0Y2hlcicpKS5mc1BhdGg7XG5cblx0XHRjb25zdCBzb3VyY2VEaXIgPSBGaWxlQWNjZXNzLmFzRmlsZVVyaSgndnMvcGxhdGZvcm0vZmlsZXMvdGVzdC9ub2RlL2ZpeHR1cmVzL3NlcnZpY2UnKS5mc1BhdGg7XG5cblx0XHRhd2FpdCBQcm9taXNlcy5jb3B5KHNvdXJjZURpciwgdGVzdERpciwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZSB9KTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlV2F0Y2hlcihhY2Nlc3NvcjogSVJlY3Vyc2l2ZVdhdGNoZXJXaXRoU3Vic2NyaWJlIHwgdW5kZWZpbmVkKSB7XG5cdFx0YXdhaXQgd2F0Y2hlcj8uc3RvcCgpO1xuXHRcdHdhdGNoZXI/LmRpc3Bvc2UoKTtcblxuXHRcdHdhdGNoZXIgPSBuZXcgVGVzdE5vZGVKU1dhdGNoZXIoYWNjZXNzb3IpO1xuXHRcdHdhdGNoZXI/LnNldFZlcmJvc2VMb2dnaW5nKGxvZ2dpbmdFbmFibGVkKTtcblxuXHRcdHdhdGNoZXIub25EaWRMb2dNZXNzYWdlKGUgPT4ge1xuXHRcdFx0aWYgKGxvZ2dpbmdFbmFibGVkKSB7XG5cdFx0XHRcdGNvbnNvbGUubG9nKGBbbm9uLXJlY3Vyc2l2ZSB3YXRjaGVyIHRlc3QgbWVzc2FnZV0gJHtlLm1lc3NhZ2V9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR3YXRjaGVyLm9uRGlkRXJyb3IoZSA9PiB7XG5cdFx0XHRpZiAobG9nZ2luZ0VuYWJsZWQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFtub24tcmVjdXJzaXZlIHdhdGNoZXIgdGVzdCBlcnJvcl0gJHtlfWApO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHdhdGNoZXIuc3RvcCgpO1xuXHRcdHdhdGNoZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gUG9zc2libGUgdGhhdCB0aGUgZmlsZSB3YXRjaGVyIGlzIHN0aWxsIGhvbGRpbmdcblx0XHQvLyBvbnRvIHRoZSBmb2xkZXJzIG9uIFdpbmRvd3Mgc3BlY2lmaWNhbGx5IGFuZCB0aGVcblx0XHQvLyB1bmxpbmsgd291bGQgZmFpbC4gSW4gdGhhdCBjYXNlLCBkbyBub3QgZmFpbCB0aGVcblx0XHQvLyB0ZXN0IHN1aXRlLlxuXHRcdHJldHVybiBQcm9taXNlcy5ybSh0ZXN0RGlyKS5jYXRjaChlcnJvciA9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRvTXNnKHR5cGU6IEZpbGVDaGFuZ2VUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgRmlsZUNoYW5nZVR5cGUuQURERUQ6IHJldHVybiAnYWRkZWQnO1xuXHRcdFx0Y2FzZSBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEOiByZXR1cm4gJ2RlbGV0ZWQnO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICdjaGFuZ2VkJztcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhd2FpdEV2ZW50KHNlcnZpY2U6IFRlc3ROb2RlSlNXYXRjaGVyLCBwYXRoOiBzdHJpbmcsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLCBjb3JyZWxhdGlvbklkPzogbnVtYmVyIHwgbnVsbCwgZXhwZWN0ZWRDb3VudD86IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChsb2dnaW5nRW5hYmxlZCkge1xuXHRcdFx0Y29uc29sZS5sb2coYEF3YWl0aW5nIGNoYW5nZSB0eXBlICcke3RvTXNnKHR5cGUpfScgb24gZmlsZSAnJHtwYXRofSdgKTtcblx0XHR9XG5cblx0XHQvLyBBd2FpdCB0aGUgZXZlbnRcblx0XHRhd2FpdCBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdGxldCBjb3VudGVyID0gMDtcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBzZXJ2aWNlLm9uRGlkQ2hhbmdlRmlsZShldmVudHMgPT4ge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGV2ZW50IG9mIGV2ZW50cykge1xuXHRcdFx0XHRcdGlmIChleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZS5pc0VxdWFsKGV2ZW50LnJlc291cmNlLCBVUkkuZmlsZShwYXRoKSkgJiYgZXZlbnQudHlwZSA9PT0gdHlwZSAmJiAoY29ycmVsYXRpb25JZCA9PT0gbnVsbCB8fCBldmVudC5jSWQgPT09IGNvcnJlbGF0aW9uSWQpKSB7XG5cdFx0XHRcdFx0XHRjb3VudGVyKys7XG5cdFx0XHRcdFx0XHRpZiAodHlwZW9mIGV4cGVjdGVkQ291bnQgPT09ICdudW1iZXInICYmIGNvdW50ZXIgPCBleHBlY3RlZENvdW50KSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlOyAvLyBub3QgeWV0XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fVxuXG5cdHRlc3QoJ2Jhc2ljcyAoZm9sZGVyIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXF1ZXN0ID0geyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtyZXF1ZXN0XSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdhdGNoZXIuaXNTdXNwZW5kZWQocmVxdWVzdCksIGZhbHNlKTtcblxuXHRcdGNvbnN0IGluc3RhbmNlID0gQXJyYXkuZnJvbSh3YXRjaGVyLndhdGNoZXJzKVswXS5pbnN0YW5jZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuaXNSZXVzaW5nUmVjdXJzaXZlV2F0Y2hlciwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5mYWlsZWQsIGZhbHNlKTtcblxuXHRcdC8vIE5ldyBmaWxlXG5cdFx0Y29uc3QgbmV3RmlsZVBhdGggPSBqb2luKHRlc3REaXIsICduZXdGaWxlLnR4dCcpO1xuXHRcdGxldCBjaGFuZ2VGdXR1cmU6IFByb21pc2U8dW5rbm93bj4gPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBOZXcgZm9sZGVyXG5cdFx0Y29uc3QgbmV3Rm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ05ldyBGb2xkZXInKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihuZXdGb2xkZXJQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBSZW5hbWUgZmlsZVxuXHRcdGxldCByZW5hbWVkRmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdyZW5hbWVkRmlsZS50eHQnKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSxcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRClcblx0XHRdKTtcblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUobmV3RmlsZVBhdGgsIHJlbmFtZWRGaWxlUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gUmVuYW1lIGZvbGRlclxuXHRcdGxldCByZW5hbWVkRm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ1JlbmFtZWQgRm9sZGVyJyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGb2xkZXJQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSxcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKVxuXHRcdF0pO1xuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShuZXdGb2xkZXJQYXRoLCByZW5hbWVkRm9sZGVyUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gUmVuYW1lIGZpbGUgKHNhbWUgbmFtZSwgZGlmZmVyZW50IGNhc2UpXG5cdFx0Y29uc3QgY2FzZVJlbmFtZWRGaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ1JlbmFtZWRGaWxlLnR4dCcpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IFByb21pc2UuYWxsKFtcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSxcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgY2FzZVJlbmFtZWRGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpXG5cdFx0XSk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKHJlbmFtZWRGaWxlUGF0aCwgY2FzZVJlbmFtZWRGaWxlUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdHJlbmFtZWRGaWxlUGF0aCA9IGNhc2VSZW5hbWVkRmlsZVBhdGg7XG5cblx0XHQvLyBSZW5hbWUgZm9sZGVyIChzYW1lIG5hbWUsIGRpZmZlcmVudCBjYXNlKVxuXHRcdGNvbnN0IGNhc2VSZW5hbWVkRm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ1JFbmFtZWQgRm9sZGVyJyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCByZW5hbWVkRm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCksXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIGNhc2VSZW5hbWVkRm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpXG5cdFx0XSk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKHJlbmFtZWRGb2xkZXJQYXRoLCBjYXNlUmVuYW1lZEZvbGRlclBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRyZW5hbWVkRm9sZGVyUGF0aCA9IGNhc2VSZW5hbWVkRm9sZGVyUGF0aDtcblxuXHRcdC8vIE1vdmUgZmlsZVxuXHRcdGNvbnN0IG1vdmVkRmlsZXBhdGggPSBqb2luKHRlc3REaXIsICdtb3ZlZEZpbGUudHh0Jyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCByZW5hbWVkRmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpLFxuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBtb3ZlZEZpbGVwYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRClcblx0XHRdKTtcblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUocmVuYW1lZEZpbGVQYXRoLCBtb3ZlZEZpbGVwYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBNb3ZlIGZvbGRlclxuXHRcdGNvbnN0IG1vdmVkRm9sZGVycGF0aCA9IGpvaW4odGVzdERpciwgJ01vdmVkIEZvbGRlcicpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IFByb21pc2UuYWxsKFtcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpLFxuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBtb3ZlZEZvbGRlcnBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKVxuXHRcdF0pO1xuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShyZW5hbWVkRm9sZGVyUGF0aCwgbW92ZWRGb2xkZXJwYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBDb3B5IGZpbGVcblx0XHRjb25zdCBjb3BpZWRGaWxlcGF0aCA9IGpvaW4odGVzdERpciwgJ2NvcGllZEZpbGUudHh0Jyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGaWxlcGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IGZzLnByb21pc2VzLmNvcHlGaWxlKG1vdmVkRmlsZXBhdGgsIGNvcGllZEZpbGVwYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBDb3B5IGZvbGRlclxuXHRcdGNvbnN0IGNvcGllZEZvbGRlcnBhdGggPSBqb2luKHRlc3REaXIsICdDb3BpZWQgRm9sZGVyJyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGb2xkZXJwYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMuY29weShtb3ZlZEZvbGRlcnBhdGgsIGNvcGllZEZvbGRlcnBhdGgsIHsgcHJlc2VydmVTeW1saW5rczogZmFsc2UgfSk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gQ2hhbmdlIGZpbGVcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGNvcGllZEZpbGVwYXRoLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoY29waWVkRmlsZXBhdGgsICdIZWxsbyBDaGFuZ2UnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBDcmVhdGUgbmV3IGZpbGVcblx0XHRjb25zdCBhbm90aGVyTmV3RmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdhbm90aGVyTmV3RmlsZS50eHQnKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGFub3RoZXJOZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShhbm90aGVyTmV3RmlsZVBhdGgsICdIZWxsbyBBbm90aGVyIFdvcmxkJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gRGVsZXRlIGZpbGVcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGNvcGllZEZpbGVwYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoY29waWVkRmlsZXBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIERlbGV0ZSBmb2xkZXJcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGNvcGllZEZvbGRlcnBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdGF3YWl0IGZzLnByb21pc2VzLnJtZGlyKGNvcGllZEZvbGRlcnBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdHdhdGNoZXIuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdiYXNpY3MgKGZpbGUgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHsgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9O1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3JlcXVlc3RdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgaW5zdGFuY2UgPSBBcnJheS5mcm9tKHdhdGNoZXIud2F0Y2hlcnMpWzBdLmluc3RhbmNlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pc1JldXNpbmdSZWN1cnNpdmVXYXRjaGVyLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmZhaWxlZCwgZmFsc2UpO1xuXG5cdFx0Ly8gQ2hhbmdlIGZpbGVcblx0XHRsZXQgY2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCAnSGVsbG8gQ2hhbmdlJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gRGVsZXRlIGZpbGVcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoZmlsZVBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIFJlY3JlYXRlIHdhdGNoZXJcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBDaGFuZ2UnKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtdKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGZpbGVQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0Ly8gTW92ZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKGZpbGVQYXRoLCBgJHtmaWxlUGF0aH0tbW92ZWRgKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xuXG5cdHRlc3QoJ2F0b21pYyB3cml0ZXMgKGZvbGRlciB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0Ly8gRGVsZXRlICsgUmVjcmVhdGUgZmlsZVxuXHRcdGNvbnN0IG5ld0ZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0Y29uc3QgY2hhbmdlRnV0dXJlOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKG5ld0ZpbGVQYXRoKTtcblx0XHRQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgsICdIZWxsbyBBdG9taWMgV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xuXG5cdHRlc3QoJ2F0b21pYyB3cml0ZXMgKGZpbGUgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBmaWxlUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdC8vIERlbGV0ZSArIFJlY3JlYXRlIGZpbGVcblx0XHRjb25zdCBuZXdGaWxlUGF0aCA9IGpvaW4oZmlsZVBhdGgpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZTogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpO1xuXHRcdGF3YWl0IGZzLnByb21pc2VzLnVubGluayhuZXdGaWxlUGF0aCk7XG5cdFx0UHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoLCAnSGVsbG8gQXRvbWljIFdvcmxkJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXBsZSBldmVudHMgKGZvbGRlciB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0Ly8gbXVsdGlwbGUgYWRkXG5cblx0XHRjb25zdCBuZXdGaWxlUGF0aDEgPSBqb2luKHRlc3REaXIsICduZXdGaWxlLTEudHh0Jyk7XG5cdFx0Y29uc3QgbmV3RmlsZVBhdGgyID0gam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0yLnR4dCcpO1xuXHRcdGNvbnN0IG5ld0ZpbGVQYXRoMyA9IGpvaW4odGVzdERpciwgJ25ld0ZpbGUtMy50eHQnKTtcblxuXHRcdGNvbnN0IGFkZGVkRnV0dXJlMTogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgxLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0Y29uc3QgYWRkZWRGdXR1cmUyOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDIsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRjb25zdCBhZGRlZEZ1dHVyZTM6IFByb21pc2U8dW5rbm93bj4gPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMywgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoMSwgJ0hlbGxvIFdvcmxkIDEnKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDIsICdIZWxsbyBXb3JsZCAyJyksXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgzLCAnSGVsbG8gV29ybGQgMycpLFxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2FkZGVkRnV0dXJlMSwgYWRkZWRGdXR1cmUyLCBhZGRlZEZ1dHVyZTNdKTtcblxuXHRcdC8vIG11bHRpcGxlIGNoYW5nZVxuXG5cdFx0Y29uc3QgY2hhbmdlRnV0dXJlMTogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgxLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKTtcblx0XHRjb25zdCBjaGFuZ2VGdXR1cmUyOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDIsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZTM6IFByb21pc2U8dW5rbm93bj4gPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMywgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgxLCAnSGVsbG8gVXBkYXRlIDEnKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDIsICdIZWxsbyBVcGRhdGUgMicpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoMywgJ0hlbGxvIFVwZGF0ZSAzJyksXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbY2hhbmdlRnV0dXJlMSwgY2hhbmdlRnV0dXJlMiwgY2hhbmdlRnV0dXJlM10pO1xuXG5cdFx0Ly8gY29weSB3aXRoIG11bHRpcGxlIGZpbGVzXG5cblx0XHRjb25zdCBjb3B5RnV0dXJlMTogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0xLWNvcHkudHh0JyksIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRjb25zdCBjb3B5RnV0dXJlMjogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0yLWNvcHkudHh0JyksIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRjb25zdCBjb3B5RnV0dXJlMzogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0zLWNvcHkudHh0JyksIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdFByb21pc2VzLmNvcHkoam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0xLnR4dCcpLCBqb2luKHRlc3REaXIsICduZXdGaWxlLTEtY29weS50eHQnKSwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZSB9KSxcblx0XHRcdFByb21pc2VzLmNvcHkoam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0yLnR4dCcpLCBqb2luKHRlc3REaXIsICduZXdGaWxlLTItY29weS50eHQnKSwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZSB9KSxcblx0XHRcdFByb21pc2VzLmNvcHkoam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0zLnR4dCcpLCBqb2luKHRlc3REaXIsICduZXdGaWxlLTMtY29weS50eHQnKSwgeyBwcmVzZXJ2ZVN5bWxpbmtzOiBmYWxzZSB9KVxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2NvcHlGdXR1cmUxLCBjb3B5RnV0dXJlMiwgY29weUZ1dHVyZTNdKTtcblxuXHRcdC8vIG11bHRpcGxlIGRlbGV0ZVxuXG5cdFx0Y29uc3QgZGVsZXRlRnV0dXJlMTogUHJvbWlzZTx1bmtub3duPiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgxLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRjb25zdCBkZWxldGVGdXR1cmUyOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDIsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdGNvbnN0IGRlbGV0ZUZ1dHVyZTM6IFByb21pc2U8dW5rbm93bj4gPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMywgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsobmV3RmlsZVBhdGgxKSxcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnVubGluayhuZXdGaWxlUGF0aDIpLFxuXHRcdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKG5ld0ZpbGVQYXRoMylcblx0XHRdKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtkZWxldGVGdXR1cmUxLCBkZWxldGVGdXR1cmUyLCBkZWxldGVGdXR1cmUzXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIGV2ZW50cyAoZmlsZSB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdsb3JlbS50eHQnKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGZpbGVQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0Ly8gbXVsdGlwbGUgY2hhbmdlXG5cblx0XHRjb25zdCBjaGFuZ2VGdXR1cmUxOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBVcGRhdGUgMScpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCAnSGVsbG8gVXBkYXRlIDInKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwgJ0hlbGxvIFVwZGF0ZSAzJyksXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbY2hhbmdlRnV0dXJlMV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNsdWRlcyBjYW4gYmUgdXBkYXRlZCAoZm9sZGVyIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbJyoqJ10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2ZpbGVzLWV4Y2x1ZGVzLnR4dCcpKTtcblx0fSk7XG5cblx0dGVzdCgnZXhjbHVkZXMgYXJlIGlnbm9yZWQgKGZpbGUgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBmaWxlUGF0aCwgZXhjbHVkZXM6IFsnKionXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChmaWxlUGF0aCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luY2x1ZGVzIGNhbiBiZSB1cGRhdGVkIChmb2xkZXIgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogWydub3RoaW5nJ10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2ZpbGVzLWluY2x1ZGVzLnR4dCcpKTtcblx0fSk7XG5cblx0dGVzdCgnbm9uLWluY2x1ZGVzIGFyZSBpZ25vcmVkIChmaWxlIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2xvcmVtLnR4dCcpO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgaW5jbHVkZXM6IFsnbm90aGluZyddLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGZpbGVQYXRoLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaW5jbHVkZXMgYXJlIHN1cHBvcnRlZCAoZm9sZGVyIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgaW5jbHVkZXM6IFsnKiovZmlsZXMtaW5jbHVkZXMudHh0J10sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0cmV0dXJuIGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnZmlsZXMtaW5jbHVkZXMudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlcyBhcmUgc3VwcG9ydGVkIChmb2xkZXIgd2F0Y2gsIHJlbGF0aXZlIHBhdHRlcm4gZXhwbGljaXQpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogW3sgYmFzZTogdGVzdERpciwgcGF0dGVybjogJ2ZpbGVzLWluY2x1ZGVzLnR4dCcgfV0sIHJlY3Vyc2l2ZTogZmFsc2UgfV0pO1xuXG5cdFx0cmV0dXJuIGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnZmlsZXMtaW5jbHVkZXMudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlcyBhcmUgc3VwcG9ydGVkIChmb2xkZXIgd2F0Y2gsIHJlbGF0aXZlIHBhdHRlcm4gaW1wbGljaXQpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogWydmaWxlcy1pbmNsdWRlcy50eHQnXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdmaWxlcy1pbmNsdWRlcy50eHQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvcnJlbGF0aW9uSWQgaXMgc3VwcG9ydGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGNvcnJlbGF0aW9uSWQgPSBNYXRoLnJhbmRvbSgpO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgY29ycmVsYXRpb25JZCwgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ25ld0ZpbGUudHh0JyksIHVuZGVmaW5lZCwgY29ycmVsYXRpb25JZCk7XG5cdH0pO1xuXG5cdChpc1dpbmRvd3MgLyogd2luZG93czogY2Fubm90IGNyZWF0ZSBmaWxlIHN5bWJvbGljIGxpbmsgd2l0aG91dCBlbGV2YXRlZCBjb250ZXh0ICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3N5bWxpbmsgc3VwcG9ydCAoZm9sZGVyIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBsaW5rID0gam9pbih0ZXN0RGlyLCAnZGVlcC1saW5rZWQnKTtcblx0XHRjb25zdCBsaW5rVGFyZ2V0ID0gam9pbih0ZXN0RGlyLCAnZGVlcCcpO1xuXHRcdGF3YWl0IGZzLnByb21pc2VzLnN5bWxpbmsobGlua1RhcmdldCwgbGluayk7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGxpbmssIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKGxpbmssICduZXdGaWxlLnR4dCcpKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gYmFzaWNDcnVkVGVzdChmaWxlUGF0aDogc3RyaW5nLCBza2lwQWRkPzogYm9vbGVhbiwgY29ycmVsYXRpb25JZD86IG51bWJlciB8IG51bGwsIGV4cGVjdGVkQ291bnQ/OiBudW1iZXIsIGF3YWl0V2F0Y2hBZnRlckFkZD86IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRsZXQgY2hhbmdlRnV0dXJlOiBQcm9taXNlPHVua25vd24+O1xuXG5cdFx0Ly8gTmV3IGZpbGVcblx0XHRpZiAoIXNraXBBZGQpIHtcblx0XHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVELCBjb3JyZWxhdGlvbklkLCBleHBlY3RlZENvdW50KTtcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdFx0XHRpZiAoYXdhaXRXYXRjaEFmdGVyQWRkKSB7XG5cdFx0XHRcdGF3YWl0IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uRGlkV2F0Y2gpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIENoYW5nZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgY29ycmVsYXRpb25JZCwgZXhwZWN0ZWRDb3VudCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCAnSGVsbG8gQ2hhbmdlJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gRGVsZXRlIGZpbGVcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVELCBjb3JyZWxhdGlvbklkLCBleHBlY3RlZENvdW50KTtcblx0XHRhd2FpdCBmcy5wcm9taXNlcy51bmxpbmsoYXdhaXQgUHJvbWlzZXMucmVhbHBhdGgoZmlsZVBhdGgpKTsgLy8gc3VwcG9ydCBzeW1saW5rc1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0fVxuXG5cdChpc1dpbmRvd3MgLyogd2luZG93czogY2Fubm90IGNyZWF0ZSBmaWxlIHN5bWJvbGljIGxpbmsgd2l0aG91dCBlbGV2YXRlZCBjb250ZXh0ICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3N5bWxpbmsgc3VwcG9ydCAoZmlsZSB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbGluayA9IGpvaW4odGVzdERpciwgJ2xvcmVtLnR4dC1saW5rZWQnKTtcblx0XHRjb25zdCBsaW5rVGFyZ2V0ID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0YXdhaXQgZnMucHJvbWlzZXMuc3ltbGluayhsaW5rVGFyZ2V0LCBsaW5rKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogbGluaywgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGxpbmssIHRydWUpO1xuXHR9KTtcblxuXHQoIWlzV2luZG93cyAvKiBVTkMgaXMgd2luZG93cyBvbmx5ICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3VuYyBzdXBwb3J0IChmb2xkZXIgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGFkZFVOQ0hvc3RUb0FsbG93bGlzdCgnbG9jYWxob3N0Jyk7XG5cblx0XHQvLyBMb2NhbCBVTkMgcGF0aHMgYXJlIGluIHRoZSBmb3JtIG9mOiBcXFxcbG9jYWxob3N0XFxjJFxcbXlfZGlyXG5cdFx0Y29uc3QgdW5jUGF0aCA9IGBcXFxcXFxcXGxvY2FsaG9zdFxcXFwke2dldERyaXZlTGV0dGVyKHRlc3REaXIpPy50b0xvd2VyQ2FzZSgpfSRcXFxcJHtsdHJpbSh0ZXN0RGlyLnN1YnN0cih0ZXN0RGlyLmluZGV4T2YoJzonKSArIDEpLCAnXFxcXCcpfWA7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHVuY1BhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHVuY1BhdGgsICduZXdGaWxlLnR4dCcpKTtcblx0fSk7XG5cblx0KCFpc1dpbmRvd3MgLyogVU5DIGlzIHdpbmRvd3Mgb25seSAqLyA/IHRlc3Quc2tpcCA6IHRlc3QpKCd1bmMgc3VwcG9ydCAoZmlsZSB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YWRkVU5DSG9zdFRvQWxsb3dsaXN0KCdsb2NhbGhvc3QnKTtcblxuXHRcdC8vIExvY2FsIFVOQyBwYXRocyBhcmUgaW4gdGhlIGZvcm0gb2Y6IFxcXFxsb2NhbGhvc3RcXGMkXFxteV9kaXJcblx0XHRjb25zdCB1bmNQYXRoID0gYFxcXFxcXFxcbG9jYWxob3N0XFxcXCR7Z2V0RHJpdmVMZXR0ZXIodGVzdERpcik/LnRvTG93ZXJDYXNlKCl9JFxcXFwke2x0cmltKHRlc3REaXIuc3Vic3RyKHRlc3REaXIuaW5kZXhPZignOicpICsgMSksICdcXFxcJyl9XFxcXGxvcmVtLnR4dGA7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHVuY1BhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdCh1bmNQYXRoLCB0cnVlKTtcblx0fSk7XG5cblx0KGlzTGludXggLyogbGludXg6IGlzIGNhc2Ugc2Vuc2l0aXZlICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3dyb25nIGNhc2luZyAoZm9sZGVyIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB3cm9uZ0Nhc2UgPSBqb2luKGRpcm5hbWUodGVzdERpciksIGJhc2VuYW1lKHRlc3REaXIpLnRvVXBwZXJDYXNlKCkpO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB3cm9uZ0Nhc2UsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHdyb25nQ2FzZSwgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHQoaXNMaW51eCAvKiBsaW51eDogaXMgY2FzZSBzZW5zaXRpdmUgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnd3JvbmcgY2FzaW5nIChmaWxlIHdhdGNoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ0xPUkVNLnR4dCcpO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChmaWxlUGF0aCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludmFsaWQgcGF0aCBkb2VzIG5vdCBleHBsb2RlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGludmFsaWRQYXRoID0gam9pbih0ZXN0RGlyLCAnaW52YWxpZCcpO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBpbnZhbGlkUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnd2F0Y2hGaWxlQ29udGVudHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgd2F0Y2hlZFBhdGggPSBqb2luKHRlc3REaXIsICdsb3JlbS50eHQnKTtcblxuXHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXG5cdFx0Y29uc3QgcmVhZHlQcm9taXNlID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdGNvbnN0IGNodW5rUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblx0XHRjb25zdCB3YXRjaFByb21pc2UgPSB3YXRjaEZpbGVDb250ZW50cyh3YXRjaGVkUGF0aCwgKCkgPT4gY2h1bmtQcm9taXNlLmNvbXBsZXRlKCksICgpID0+IHJlYWR5UHJvbWlzZS5jb21wbGV0ZSgpLCBjdHMudG9rZW4pO1xuXG5cdFx0YXdhaXQgcmVhZHlQcm9taXNlLnA7XG5cblx0XHRQcm9taXNlcy53cml0ZUZpbGUod2F0Y2hlZFBhdGgsICdIZWxsbyBXb3JsZCcpO1xuXG5cdFx0YXdhaXQgY2h1bmtQcm9taXNlLnA7XG5cblx0XHRjdHMuY2FuY2VsKCk7IC8vIHRoaXMgd2lsbCByZXNvbHZlIGB3YXRjaFByb21pc2VgXG5cblx0XHRyZXR1cm4gd2F0Y2hQcm9taXNlO1xuXHR9KTtcblxuXHR0ZXN0KCd3YXRjaGluZyBzYW1lIG9yIG92ZXJsYXBwaW5nIHBhdGhzIHN1cHBvcnRlZCB3aGVuIGNvcnJlbGF0aW9uIGlzIGFwcGxpZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbXG5cdFx0XHR7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSwgY29ycmVsYXRpb25JZDogMSB9XG5cdFx0XSk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ25ld0ZpbGVfMS50eHQnKSwgdW5kZWZpbmVkLCBudWxsLCAxKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW1xuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UsIGNvcnJlbGF0aW9uSWQ6IDEgfSxcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlLCBjb3JyZWxhdGlvbklkOiAyLCB9LFxuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UsIGNvcnJlbGF0aW9uSWQ6IHVuZGVmaW5lZCB9XG5cdFx0XSk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ25ld0ZpbGVfMi50eHQnKSwgdW5kZWZpbmVkLCBudWxsLCAzKTtcblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ290aGVyTmV3RmlsZS50eHQnKSwgdW5kZWZpbmVkLCBudWxsLCAzKTtcblx0fSk7XG5cblx0dGVzdCgnd2F0Y2hpbmcgbWlzc2luZyBwYXRoIGVtaXRzIHdhdGNoZXIgZmFpbCBldmVudCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblxuXHRcdGNvbnN0IGZvbGRlclBhdGggPSBqb2luKHRlc3REaXIsICdtaXNzaW5nJyk7XG5cdFx0d2F0Y2hlci53YXRjaChbeyBwYXRoOiBmb2xkZXJQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRhd2FpdCBvbkRpZFdhdGNoRmFpbDtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRpbmcgd2F0Y2hlZCBwYXRoIGVtaXRzIHdhdGNoZXIgZmFpbCBhbmQgZGVsZXRlIGV2ZW50IHdoZW4gY29ycmVsYXRlZCAoZmlsZSB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdsb3JlbS50eHQnKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSwgY29ycmVsYXRpb25JZDogMSB9XSk7XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IEFycmF5LmZyb20od2F0Y2hlci53YXRjaGVycylbMF0uaW5zdGFuY2U7XG5cblx0XHRjb25zdCBvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblx0XHRjb25zdCBjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVELCAxKTtcblx0XHRmcy5wcm9taXNlcy51bmxpbmsoZmlsZVBhdGgpO1xuXHRcdGF3YWl0IG9uRGlkV2F0Y2hGYWlsO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuZmFpbGVkLCB0cnVlKTtcblx0fSk7XG5cblx0KGlzTWFjaW50b3NoIHx8IGlzV2luZG93cyAvKiBtYWNPUzogZG9lcyBub3Qgc2VlbSB0byByZXBvcnQgZGVsZXRlcyBvbiBmb2xkZXJzIHwgV2luZG93czogcmVwb3J0cyBvbignZXJyb3InKSBldmVudCBvbmx5ICovID8gdGVzdC5za2lwIDogdGVzdCkoJ2RlbGV0aW5nIHdhdGNoZWQgcGF0aCBlbWl0cyB3YXRjaGVyIGZhaWwgYW5kIGRlbGV0ZSBldmVudCB3aGVuIGNvcnJlbGF0ZWQgKGZvbGRlciB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZm9sZGVyUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlLCBjb3JyZWxhdGlvbklkOiAxIH1dKTtcblxuXHRcdGNvbnN0IG9uRGlkV2F0Y2hGYWlsID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25XYXRjaEZhaWwpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCwgMSk7XG5cdFx0UHJvbWlzZXMucm0oZm9sZGVyUGF0aCwgUmltUmFmTW9kZS5VTkxJTkspO1xuXHRcdGF3YWl0IG9uRGlkV2F0Y2hGYWlsO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0fSk7XG5cblx0dGVzdCgnd2F0Y2ggcmVxdWVzdHMgc3VwcG9ydCBzdXNwZW5kL3Jlc3VtZSAoZmlsZSwgZG9lcyBub3QgZXhpc3QgaW4gYmVnaW5uaW5nKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ25vdC1mb3VuZC50eHQnKTtcblxuXHRcdGNvbnN0IG9uRGlkV2F0Y2hGYWlsID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25XYXRjaEZhaWwpO1xuXHRcdGNvbnN0IHJlcXVlc3QgPSB7IHBhdGg6IGZpbGVQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtyZXF1ZXN0XSk7XG5cdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdhdGNoZXIuaXNTdXNwZW5kZWQocmVxdWVzdCksICdwb2xsaW5nJyk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGZpbGVQYXRoLCB1bmRlZmluZWQsIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0YXdhaXQgYmFzaWNDcnVkVGVzdChmaWxlUGF0aCwgdW5kZWZpbmVkLCBudWxsLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCd3YXRjaCByZXF1ZXN0cyBzdXBwb3J0IHN1c3BlbmQvcmVzdW1lIChmaWxlLCBleGlzdHMgaW4gYmVnaW5uaW5nKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2xvcmVtLnR4dCcpO1xuXHRcdGNvbnN0IHJlcXVlc3QgPSB7IHBhdGg6IGZpbGVQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtyZXF1ZXN0XSk7XG5cblx0XHRjb25zdCBvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGZpbGVQYXRoLCB0cnVlKTtcblx0XHRhd2FpdCBvbkRpZFdhdGNoRmFpbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgJ3BvbGxpbmcnKTtcblxuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3QoZmlsZVBhdGgsIHVuZGVmaW5lZCwgbnVsbCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0fSk7XG5cblx0KGlzV2luZG93cyAvKiBXaW5kb3dzOiBkb2VzIG5vdCBzZWVtIHRvIHJlcG9ydCB0aGlzICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3dhdGNoIHJlcXVlc3RzIHN1cHBvcnQgc3VzcGVuZC9yZXN1bWUgKGZvbGRlciwgZG9lcyBub3QgZXhpc3QgaW4gYmVnaW5uaW5nKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgb25EaWRXYXRjaEZhaWwgPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbldhdGNoRmFpbCk7XG5cblx0XHRjb25zdCBmb2xkZXJQYXRoID0gam9pbih0ZXN0RGlyLCAnbm90LWZvdW5kJyk7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHsgcGF0aDogZm9sZGVyUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH07XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbcmVxdWVzdF0pO1xuXHRcdGF3YWl0IG9uRGlkV2F0Y2hGYWlsO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3YXRjaGVyLmlzU3VzcGVuZGVkKHJlcXVlc3QpLCAncG9sbGluZycpO1xuXG5cdFx0bGV0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGxldCBvbkRpZFdhdGNoID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25EaWRXYXRjaCk7XG5cdFx0YXdhaXQgZnMucHJvbWlzZXMubWtkaXIoZm9sZGVyUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGF3YWl0IG9uRGlkV2F0Y2g7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgZmFsc2UpO1xuXG5cdFx0aWYgKGlzV2luZG93cykgeyAvLyBzb21laG93IGZhaWxpbmcgb24gbWFjT1MvTGludXhcblx0XHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbihmb2xkZXJQYXRoLCAnbmV3RmlsZS50eHQnKTtcblx0XHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3QoZmlsZVBhdGgpO1xuXG5cdFx0XHRvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblx0XHRcdGF3YWl0IGZzLnByb21pc2VzLnJtZGlyKGZvbGRlclBhdGgpO1xuXHRcdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cblx0XHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdFx0b25EaWRXYXRjaCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uRGlkV2F0Y2gpO1xuXHRcdFx0YXdhaXQgZnMucHJvbWlzZXMubWtkaXIoZm9sZGVyUGF0aCk7XG5cdFx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdFx0XHRhd2FpdCBvbkRpZFdhdGNoO1xuXG5cdFx0XHRhd2FpdCB0aW1lb3V0KDUwMCk7IC8vIHNvbWVob3cgbmVlZGVkIG9uIExpbnV4XG5cblx0XHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3QoZmlsZVBhdGgpO1xuXHRcdH1cblx0fSk7XG5cblx0KGlzTWFjaW50b3NoIC8qIG1hY09TOiBkb2VzIG5vdCBzZWVtIHRvIHJlcG9ydCB0aGlzICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3dhdGNoIHJlcXVlc3RzIHN1cHBvcnQgc3VzcGVuZC9yZXN1bWUgKGZvbGRlciwgZXhpc3RzIGluIGJlZ2lubmluZyknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGZvbGRlclBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9XSk7XG5cblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4oZm9sZGVyUGF0aCwgJ25ld0ZpbGUudHh0Jyk7XG5cdFx0YXdhaXQgYmFzaWNDcnVkVGVzdChmaWxlUGF0aCk7XG5cblx0XHRjb25zdCBvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblx0XHRhd2FpdCBQcm9taXNlcy5ybShmb2xkZXJQYXRoKTtcblx0XHRhd2FpdCBvbkRpZFdhdGNoRmFpbDtcblxuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGNvbnN0IG9uRGlkV2F0Y2ggPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbkRpZFdhdGNoKTtcblx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2Rpcihmb2xkZXJQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdFx0YXdhaXQgb25EaWRXYXRjaDtcblxuXHRcdGF3YWl0IHRpbWVvdXQoNTAwKTsgLy8gc29tZWhvdyBuZWVkZWQgb24gTGludXhcblxuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3QoZmlsZVBhdGgpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJjZWwgd2F0Y2hlciByZXVzZWQgd2hlbiBwcmVzZW50IGZvciBub24tcmVjdXJzaXZlIGZpbGUgd2F0Y2hpbmcgKHVuY29ycmVsYXRlZCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRlc3RQYXJjZWxXYXRjaGVyUmV1c2VkKHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcmNlbCB3YXRjaGVyIHJldXNlZCB3aGVuIHByZXNlbnQgZm9yIG5vbi1yZWN1cnNpdmUgZmlsZSB3YXRjaGluZyAoY29ycmVsYXRlZCknLCBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHRlc3RQYXJjZWxXYXRjaGVyUmV1c2VkKDIpO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBjcmVhdGVQYXJjZWxXYXRjaGVyKCkge1xuXHRcdGNvbnN0IHJlY3Vyc2l2ZVdhdGNoZXIgPSBuZXcgVGVzdFBhcmNlbFdhdGNoZXIoKTtcblx0XHRyZWN1cnNpdmVXYXRjaGVyLnNldFZlcmJvc2VMb2dnaW5nKGxvZ2dpbmdFbmFibGVkKTtcblx0XHRyZWN1cnNpdmVXYXRjaGVyLm9uRGlkTG9nTWVzc2FnZShlID0+IHtcblx0XHRcdGlmIChsb2dnaW5nRW5hYmxlZCkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgW3JlY3Vyc2l2ZSB3YXRjaGVyIHRlc3QgbWVzc2FnZV0gJHtlLm1lc3NhZ2V9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZWN1cnNpdmVXYXRjaGVyLm9uRGlkRXJyb3IoZSA9PiB7XG5cdFx0XHRpZiAobG9nZ2luZ0VuYWJsZWQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFtyZWN1cnNpdmUgd2F0Y2hlciB0ZXN0IGVycm9yXSAke2UuZXJyb3J9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVjdXJzaXZlV2F0Y2hlcjtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RQYXJjZWxXYXRjaGVyUmV1c2VkKGNvcnJlbGF0aW9uSWQ6IG51bWJlciB8IHVuZGVmaW5lZCkge1xuXHRcdGNvbnN0IHJlY3Vyc2l2ZVdhdGNoZXIgPSBjcmVhdGVQYXJjZWxXYXRjaGVyKCk7XG5cdFx0YXdhaXQgcmVjdXJzaXZlV2F0Y2hlci53YXRjaChbeyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSwgY29ycmVsYXRpb25JZDogMSB9XSk7XG5cblx0XHRjb25zdCByZWN1cnNpdmVJbnN0YW5jZSA9IEFycmF5LmZyb20ocmVjdXJzaXZlV2F0Y2hlci53YXRjaGVycylbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlY3Vyc2l2ZUluc3RhbmNlLnN1YnNjcmlwdGlvbnNDb3VudCwgMCk7XG5cblx0XHRhd2FpdCBjcmVhdGVXYXRjaGVyKHJlY3Vyc2l2ZVdhdGNoZXIpO1xuXG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJywgJ2NvbndheS5qcycpO1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSwgY29ycmVsYXRpb25JZCB9XSk7XG5cblx0XHRjb25zdCB7IGluc3RhbmNlIH0gPSBBcnJheS5mcm9tKHdhdGNoZXIud2F0Y2hlcnMpWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pc1JldXNpbmdSZWN1cnNpdmVXYXRjaGVyLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVjdXJzaXZlSW5zdGFuY2Uuc3Vic2NyaXB0aW9uc0NvdW50LCAxKTtcblxuXHRcdGxldCBjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBpc01hY2ludG9zaCAvKiBzb21laG93IGZzZXZlbnRzIHNlZW1zIHRvIHJlcG9ydCBzdGlsbCBvbiB0aGUgaW5pdGlhbCBjcmVhdGUgZnJvbSB0ZXN0IHNldHVwICovID8gRmlsZUNoYW5nZVR5cGUuQURERUQgOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVELCBjb3JyZWxhdGlvbklkKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBXb3JsZCcpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdGF3YWl0IHJlY3Vyc2l2ZVdhdGNoZXIuc3RvcCgpO1xuXHRcdHJlY3Vyc2l2ZVdhdGNoZXIuZGlzcG9zZSgpO1xuXG5cdFx0YXdhaXQgdGltZW91dCg1MDApOyAvLyBnaXZlIHRoZSB3YXRjaGVyIHNvbWUgdGltZSB0byByZXN0YXJ0XG5cblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVELCBjb3JyZWxhdGlvbklkKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBXb3JsZCcpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pc1JldXNpbmdSZWN1cnNpdmVXYXRjaGVyLCBmYWxzZSk7XG5cdH1cblxuXHR0ZXN0KCd3YXRjaCByZXF1ZXN0cyBzdXBwb3J0IHN1c3BlbmQvcmVzdW1lIChmaWxlLCBkb2VzIG5vdCBleGlzdCBpbiBiZWdpbm5pbmcsIHBhcmNlbCB3YXRjaGVyIHJldXNlZCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVjdXJzaXZlV2F0Y2hlciA9IGNyZWF0ZVBhcmNlbFdhdGNoZXIoKTtcblx0XHRhd2FpdCByZWN1cnNpdmVXYXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblxuXHRcdGF3YWl0IGNyZWF0ZVdhdGNoZXIocmVjdXJzaXZlV2F0Y2hlcik7XG5cblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ25vdC1mb3VuZC0yLnR4dCcpO1xuXG5cdFx0Y29uc3Qgb25EaWRXYXRjaEZhaWwgPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbldhdGNoRmFpbCk7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHsgcGF0aDogZmlsZVBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9O1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3JlcXVlc3RdKTtcblx0XHRhd2FpdCBvbkRpZFdhdGNoRmFpbDtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgdHJ1ZSk7XG5cblx0XHRjb25zdCBjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKGZpbGVQYXRoLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCB0eXBlIGZpbHRlciAoZmlsZSB3YXRjaCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdsb3JlbS50eHQnKTtcblx0XHRjb25zdCByZXF1ZXN0ID0geyBwYXRoOiBmaWxlUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlLCBmaWx0ZXI6IEZpbGVDaGFuZ2VGaWx0ZXIuVVBEQVRFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuREVMRVRFRCwgY29ycmVsYXRpb25JZDogMSB9O1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3JlcXVlc3RdKTtcblxuXHRcdC8vIENoYW5nZSBmaWxlXG5cdFx0bGV0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsIDEpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwgJ0hlbGxvIENoYW5nZScpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIERlbGV0ZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCwgMSk7XG5cdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGZpbGVQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IHR5cGUgZmlsdGVyIChmb2xkZXIgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlcXVlc3QgPSB7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSwgZmlsdGVyOiBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQgfCBGaWxlQ2hhbmdlRmlsdGVyLkRFTEVURUQsIGNvcnJlbGF0aW9uSWQ6IDEgfTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtyZXF1ZXN0XSk7XG5cblx0XHQvLyBDaGFuZ2UgZmlsZVxuXHRcdGNvbnN0IGZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnbG9yZW0udHh0Jyk7XG5cdFx0bGV0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsIDEpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShmaWxlUGF0aCwgJ0hlbGxvIENoYW5nZScpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIERlbGV0ZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCwgMSk7XG5cdFx0YXdhaXQgZnMucHJvbWlzZXMudW5saW5rKGZpbGVQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFFBQVE7QUFDcEIsT0FBTyxZQUFZO0FBQ25CLFNBQVMsY0FBYztBQUN2QixTQUFTLFVBQVUsU0FBUyxZQUFZO0FBQ3hDLFNBQVMsVUFBVSxrQkFBa0I7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxrQkFBa0Isc0JBQXNCO0FBRWpELFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsU0FBUyxhQUFhLGlCQUFpQjtBQUNoRCxTQUFTLHNC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b0JBQW9CO0FBQzdDLFVBQU0saUJBQWlCLE1BQU0sQ0FBQyxFQUFFLE1BQU0sU0FBUyxVQUFVLENBQUMsR0FBRyxXQUFXLEtBQUssQ0FBQyxDQUFDO0FBRS9FLFVBQU0sY0FBYyxnQkFBZ0I7QUFFcEMsVUFBTSxXQUFXLEtBQUssU0FBUyxpQkFBaUI7QUFFaEQsVUFBTSxpQkFBaUIsTUFBTSxVQUFVLFFBQVEsV0FBVztBQUMxRCxVQUFNLFVBQVUsRUFBRSxNQUFNLFVBQVUsVUFBVSxDQUFDLEdBQUcsV0FBVyxNQUFNO0FBQ2pFLFVBQU0sUUFBUSxNQUFNLENBQUMsT0FBTyxDQUFDO0FBQzdCLFVBQU07QUFDTixXQUFPLFlBQVksUUFBUSxZQUFZLE9BQU8sR0FBRyxJQUFJO0FBRXJELFVBQU0sZUFBZSxXQUFXLFNBQVMsVUFBVSxlQUFlLEtBQUs7QUFDdkUsVUFBTSxTQUFTLFVBQVUsVUFBVSxhQUFhO0FBQ2hELFVBQU07QUFFTixXQUFPLFlBQVksUUFBUSxZQUFZLE9BQU8sR0FBRyxLQUFLO0FBQUEsRUFDdkQsQ0FBQztBQUVELE9BQUssa0NBQWtDLGlCQUFrQjtBQUN4RCxVQUFNLFdBQVcsS0FBSyxTQUFTLFdBQVc7QUFDMUMsVUFBTSxVQUFVLEVBQUUsTUFBTSxVQUFVLFVBQVUsQ0FBQyxHQUFHLFdBQVcsT0FBTyxRQUFRLGlCQUFpQixVQUFVLGlCQUFpQixTQUFTLGVBQWUsRUFBRTtBQUNoSixVQUFNLFFBQVEsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUc3QixRQUFJLGVBQWUsV0FBVyxTQUFTLFVBQVUsZUFBZSxTQUFTLENBQUM7QUFDMUUsVUFBTSxTQUFTLFVBQVUsVUFBVSxjQUFjO0FBQ2pELFVBQU07QUFHTixtQkFBZSxXQUFXLFNBQVMsVUFBVSxlQUFlLFNBQVMsQ0FBQztBQUN0RSxVQUFNLEdBQUcsU0FBUyxPQUFPLFFBQVE7QUFDakMsVUFBTTtBQUFBLEVBQ1AsQ0FBQztBQUVELE9BQUssb0NBQW9DLGlCQUFrQjtBQUMxRCxVQUFNLFVBQVUsRUFBRSxNQUFNLFNBQVMsVUFBVSxDQUFDLEdBQUcsV0FBVyxPQUFPLFFBQVEsaUJBQWlCLFVBQVUsaUJBQWlCLFNBQVMsZUFBZSxFQUFFO0FBQy9JLFVBQU0sUUFBUSxNQUFNLENBQUMsT0FBTyxDQUFDO0FBRzdCLFVBQU0sV0FBVyxLQUFLLFNBQVMsV0FBVztBQUMxQyxRQUFJLGVBQWUsV0FBVyxTQUFTLFVBQVUsZUFBZSxTQUFTLENBQUM7QUFDMUUsVUFBTSxTQUFTLFVBQVUsVUFBVSxjQUFjO0FBQ2pELFVBQU07QUFHTixtQkFBZSxXQUFXLFNBQVMsVUFBVSxlQUFlLFNBQVMsQ0FBQztBQUN0RSxVQUFNLEdBQUcsU0FBUyxPQUFPLFFBQVE7QUFDakMsVUFBTTtBQUFBLEVBQ1AsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbIndhdGNoZXIiXQp9Cg==
