import assert from "assert";
import { realpathSync, promises } from "fs";
import { tmpdir } from "os";
import { timeout } from "../../../../base/common/async.js";
import { dirname, join } from "../../../../base/common/path.js";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { Promises, RimRafMode } from "../../../../base/node/pfs.js";
import { getRandomTestPath } from "../../../../base/test/node/testUtils.js";
import { FileChangeFilter, FileChangeType } from "../../common/files.js";
import { ParcelWatcher } from "../../node/watcher/parcel/parcelWatcher.js";
import { getDriveLetter } from "../../../../base/common/extpath.js";
import { ltrim } from "../../../../base/common/strings.js";
import { FileAccess } from "../../../../base/common/network.js";
import { extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { addUNCHostToAllowlist } from "../../../../base/node/unc.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
class TestParcelWatcher extends ParcelWatcher {
  constructor() {
    super(...arguments);
    this.suspendedWatchRequestPollingInterval = 100;
    this._onDidWatch = this._register(new Emitter());
    this.onDidWatch = this._onDidWatch.event;
    this.onWatchFail = this._onDidWatchFail.event;
  }
  async testRemoveDuplicateRequests(paths, excludes = []) {
    const requests = paths.map((path) => {
      return { path, excludes, recursive: true };
    });
    return (await this.removeDuplicateRequests(
      requests,
      false
      /* validate paths skipped for tests */
    )).map((request) => request.path);
  }
  getUpdateWatchersDelay() {
    return 0;
  }
  async doWatch(requests) {
    await super.doWatch(requests);
    await this.whenReady();
    this._onDidWatch.fire();
  }
  async whenReady() {
    for (const watcher of this.watchers) {
      await watcher.ready;
    }
  }
}
suite.skip("File Watcher (parcel)", function() {
  this.timeout(1e4);
  let testDir;
  let watcher;
  let loggingEnabled = false;
  function enableLogging(enable) {
    loggingEnabled = enable;
    watcher?.setVerboseLogging(enable);
  }
  enableLogging(loggingEnabled);
  setup(async () => {
    watcher = new TestParcelWatcher();
    watcher.setVerboseLogging(loggingEnabled);
    watcher.onDidLogMessage((e) => {
      if (loggingEnabled) {
        console.log(`[recursive watcher test message] ${e.message}`);
      }
    });
    watcher.onDidError((e) => {
      if (loggingEnabled) {
        console.log(`[recursive watcher test error] ${e.error}`);
      }
    });
    testDir = URI.file(getRandomTestPath(realpathSync(tmpdir()), "vsctests", "filewatcher")).fsPath;
    const sourceDir = FileAccess.asFileUri("vs/platform/files/test/node/fixtures/service").fsPath;
    await Promises.copy(sourceDir, testDir, { preserveSymlinks: false });
  });
  teardown(async () => {
    const watchers = Array.from(watcher.watchers).length;
    let stoppedInstances = 0;
    for (const instance of watcher.watchers) {
      Event.once(instance.onDidStop)(() => {
        if (instance.stopped) {
          stoppedInstances++;
        }
      });
    }
    await watcher.stop();
    assert.strictEqual(stoppedInstances, watchers, "All watchers must be stopped before the test ends");
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
  async function awaitEvent(watcher2, path, type, failOnEventReason, correlationId, expectedCount) {
    if (loggingEnabled) {
      console.log(`Awaiting change type '${toMsg(type)}' on file '${path}'`);
    }
    const res = await new Promise((resolve, reject) => {
      let counter = 0;
      const disposable = watcher2.onDidChangeFile((events) => {
        for (const event of events) {
          if (extUriBiasedIgnorePathCase.isEqual(event.resource, URI.file(path)) && event.type === type && (correlationId === null || event.cId === correlationId)) {
            counter++;
            if (typeof expectedCount === "number" && counter < expectedCount) {
              continue;
            }
            disposable.dispose();
            if (failOnEventReason) {
              reject(new Error(`Unexpected file event: ${failOnEventReason}`));
            } else {
              setImmediate(() => resolve(events));
            }
            break;
          }
        }
      });
    });
    await timeout(1);
    return res;
  }
  function awaitMessage(watcher2, type) {
    if (loggingEnabled) {
      console.log(`Awaiting message of type ${type}`);
    }
    return new Promise((resolve) => {
      const disposable = watcher2.onDidLogMessage((msg) => {
        if (msg.type === type) {
          disposable.dispose();
          resolve();
        }
      });
    });
  }
  test("basics", async function() {
    const request = { path: testDir, excludes: [], recursive: true };
    await watcher.watch([request]);
    const instance = Array.from(watcher.watchers)[0];
    assert.strictEqual(request, instance.request);
    assert.strictEqual(instance.failed, false);
    assert.strictEqual(instance.stopped, false);
    const disposables = new DisposableStore();
    const subscriptions1 = /* @__PURE__ */ new Map();
    const subscriptions2 = /* @__PURE__ */ new Map();
    const newFilePath = join(testDir, "deep", "newFile.txt");
    disposables.add(instance.subscribe(newFilePath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    disposables.add(instance.subscribe(newFilePath, (change) => subscriptions2.set(change.resource.fsPath, change.type)));
    assert.strictEqual(instance.include(newFilePath), true);
    assert.strictEqual(instance.exclude(newFilePath), false);
    let changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newFilePath, "Hello World");
    await changeFuture;
    assert.strictEqual(subscriptions1.get(newFilePath), FileChangeType.ADDED);
    assert.strictEqual(subscriptions2.get(newFilePath), FileChangeType.ADDED);
    const newFolderPath = join(testDir, "deep", "New Folder");
    disposables.add(instance.subscribe(newFolderPath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    const disposable = instance.subscribe(newFolderPath, (change) => subscriptions2.set(change.resource.fsPath, change.type));
    disposable.dispose();
    assert.strictEqual(instance.include(newFolderPath), true);
    assert.strictEqual(instance.exclude(newFolderPath), false);
    changeFuture = awaitEvent(watcher, newFolderPath, FileChangeType.ADDED);
    await promises.mkdir(newFolderPath);
    await changeFuture;
    assert.strictEqual(subscriptions1.get(newFolderPath), FileChangeType.ADDED);
    assert.strictEqual(
      subscriptions2.has(newFolderPath),
      false
      /* subscription was disposed before the event */
    );
    let renamedFilePath = join(testDir, "deep", "renamedFile.txt");
    disposables.add(instance.subscribe(renamedFilePath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    changeFuture = Promise.all([
      awaitEvent(watcher, newFilePath, FileChangeType.DELETED),
      awaitEvent(watcher, renamedFilePath, FileChangeType.ADDED)
    ]);
    await Promises.rename(newFilePath, renamedFilePath);
    await changeFuture;
    assert.strictEqual(subscriptions1.get(newFilePath), FileChangeType.DELETED);
    assert.strictEqual(subscriptions1.get(renamedFilePath), FileChangeType.ADDED);
    let renamedFolderPath = join(testDir, "deep", "Renamed Folder");
    disposables.add(instance.subscribe(renamedFolderPath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    changeFuture = Promise.all([
      awaitEvent(watcher, newFolderPath, FileChangeType.DELETED),
      awaitEvent(watcher, renamedFolderPath, FileChangeType.ADDED)
    ]);
    await Promises.rename(newFolderPath, renamedFolderPath);
    await changeFuture;
    assert.strictEqual(subscriptions1.get(newFolderPath), FileChangeType.DELETED);
    assert.strictEqual(subscriptions1.get(renamedFolderPath), FileChangeType.ADDED);
    const caseRenamedFilePath = join(testDir, "deep", "RenamedFile.txt");
    changeFuture = Promise.all([
      awaitEvent(watcher, renamedFilePath, FileChangeType.DELETED),
      awaitEvent(watcher, caseRenamedFilePath, FileChangeType.ADDED)
    ]);
    await Promises.rename(renamedFilePath, caseRenamedFilePath);
    await changeFuture;
    renamedFilePath = caseRenamedFilePath;
    const caseRenamedFolderPath = join(testDir, "deep", "REnamed Folder");
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
    const copiedFilepath = join(testDir, "deep", "copiedFile.txt");
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.ADDED);
    await promises.copyFile(movedFilepath, copiedFilepath);
    await changeFuture;
    const copiedFolderpath = join(testDir, "deep", "Copied Folder");
    changeFuture = awaitEvent(watcher, copiedFolderpath, FileChangeType.ADDED);
    await Promises.copy(movedFolderpath, copiedFolderpath, { preserveSymlinks: false });
    await changeFuture;
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.UPDATED);
    await Promises.writeFile(copiedFilepath, "Hello Change");
    await changeFuture;
    const anotherNewFilePath = join(testDir, "deep", "anotherNewFile.txt");
    changeFuture = awaitEvent(watcher, anotherNewFilePath, FileChangeType.ADDED);
    await Promises.writeFile(anotherNewFilePath, "Hello Another World");
    await changeFuture;
    changeFuture = awaitEvent(watcher, anotherNewFilePath, FileChangeType.UPDATED, "unexpected-event-from-read-file");
    await promises.readFile(anotherNewFilePath);
    await Promise.race([timeout(100), changeFuture]);
    changeFuture = awaitEvent(watcher, anotherNewFilePath, FileChangeType.UPDATED, "unexpected-event-from-stat");
    await promises.stat(anotherNewFilePath);
    await Promise.race([timeout(100), changeFuture]);
    changeFuture = awaitEvent(watcher, copiedFolderpath, FileChangeType.UPDATED, "unexpected-event-from-stat");
    await promises.stat(copiedFolderpath);
    await Promise.race([timeout(100), changeFuture]);
    changeFuture = awaitEvent(watcher, copiedFilepath, FileChangeType.DELETED);
    disposables.add(instance.subscribe(copiedFilepath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    await promises.unlink(copiedFilepath);
    await changeFuture;
    assert.strictEqual(subscriptions1.get(copiedFilepath), FileChangeType.DELETED);
    changeFuture = awaitEvent(watcher, copiedFolderpath, FileChangeType.DELETED);
    disposables.add(instance.subscribe(copiedFolderpath, (change) => subscriptions1.set(change.resource.fsPath, change.type)));
    await promises.rmdir(copiedFolderpath);
    await changeFuture;
    assert.strictEqual(subscriptions1.get(copiedFolderpath), FileChangeType.DELETED);
    disposables.dispose();
  });
  (isMacintosh ? test.skip : test)("basics (atomic writes)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], recursive: true }]);
    const newFilePath = join(testDir, "deep", "conway.js");
    const changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.UPDATED);
    await promises.unlink(newFilePath);
    Promises.writeFile(newFilePath, "Hello Atomic World");
    await changeFuture;
  });
  (!isLinux ? test.skip : test)("basics (polling)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], pollingInterval: 100, recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  async function basicCrudTest(filePath, correlationId, expectedCount) {
    let changeFuture = awaitEvent(watcher, filePath, FileChangeType.ADDED, void 0, correlationId, expectedCount);
    await Promises.writeFile(filePath, "Hello World");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.UPDATED, void 0, correlationId, expectedCount);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, void 0, correlationId, expectedCount);
    await promises.unlink(filePath);
    await changeFuture;
  }
  test("multiple events", async function() {
    await watcher.watch([{ path: testDir, excludes: [], recursive: true }]);
    await promises.mkdir(join(testDir, "deep-multiple"));
    const newFilePath1 = join(testDir, "newFile-1.txt");
    const newFilePath2 = join(testDir, "newFile-2.txt");
    const newFilePath3 = join(testDir, "newFile-3.txt");
    const newFilePath4 = join(testDir, "deep-multiple", "newFile-1.txt");
    const newFilePath5 = join(testDir, "deep-multiple", "newFile-2.txt");
    const newFilePath6 = join(testDir, "deep-multiple", "newFile-3.txt");
    const addedFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.ADDED);
    const addedFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.ADDED);
    const addedFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.ADDED);
    const addedFuture4 = awaitEvent(watcher, newFilePath4, FileChangeType.ADDED);
    const addedFuture5 = awaitEvent(watcher, newFilePath5, FileChangeType.ADDED);
    const addedFuture6 = awaitEvent(watcher, newFilePath6, FileChangeType.ADDED);
    await Promise.all([
      await Promises.writeFile(newFilePath1, "Hello World 1"),
      await Promises.writeFile(newFilePath2, "Hello World 2"),
      await Promises.writeFile(newFilePath3, "Hello World 3"),
      await Promises.writeFile(newFilePath4, "Hello World 4"),
      await Promises.writeFile(newFilePath5, "Hello World 5"),
      await Promises.writeFile(newFilePath6, "Hello World 6")
    ]);
    await Promise.all([addedFuture1, addedFuture2, addedFuture3, addedFuture4, addedFuture5, addedFuture6]);
    const changeFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.UPDATED);
    const changeFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.UPDATED);
    const changeFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.UPDATED);
    const changeFuture4 = awaitEvent(watcher, newFilePath4, FileChangeType.UPDATED);
    const changeFuture5 = awaitEvent(watcher, newFilePath5, FileChangeType.UPDATED);
    const changeFuture6 = awaitEvent(watcher, newFilePath6, FileChangeType.UPDATED);
    await Promise.all([
      await Promises.writeFile(newFilePath1, "Hello Update 1"),
      await Promises.writeFile(newFilePath2, "Hello Update 2"),
      await Promises.writeFile(newFilePath3, "Hello Update 3"),
      await Promises.writeFile(newFilePath4, "Hello Update 4"),
      await Promises.writeFile(newFilePath5, "Hello Update 5"),
      await Promises.writeFile(newFilePath6, "Hello Update 6")
    ]);
    await Promise.all([changeFuture1, changeFuture2, changeFuture3, changeFuture4, changeFuture5, changeFuture6]);
    const copyFuture1 = awaitEvent(watcher, join(testDir, "deep-multiple-copy", "newFile-1.txt"), FileChangeType.ADDED);
    const copyFuture2 = awaitEvent(watcher, join(testDir, "deep-multiple-copy", "newFile-2.txt"), FileChangeType.ADDED);
    const copyFuture3 = awaitEvent(watcher, join(testDir, "deep-multiple-copy", "newFile-3.txt"), FileChangeType.ADDED);
    const copyFuture4 = awaitEvent(watcher, join(testDir, "deep-multiple-copy"), FileChangeType.ADDED);
    await Promises.copy(join(testDir, "deep-multiple"), join(testDir, "deep-multiple-copy"), { preserveSymlinks: false });
    await Promise.all([copyFuture1, copyFuture2, copyFuture3, copyFuture4]);
    const deleteFuture1 = awaitEvent(watcher, newFilePath1, FileChangeType.DELETED);
    const deleteFuture2 = awaitEvent(watcher, newFilePath2, FileChangeType.DELETED);
    const deleteFuture3 = awaitEvent(watcher, newFilePath3, FileChangeType.DELETED);
    const deleteFuture4 = awaitEvent(watcher, newFilePath4, FileChangeType.DELETED);
    const deleteFuture5 = awaitEvent(watcher, newFilePath5, FileChangeType.DELETED);
    const deleteFuture6 = awaitEvent(watcher, newFilePath6, FileChangeType.DELETED);
    await Promise.all([
      await promises.unlink(newFilePath1),
      await promises.unlink(newFilePath2),
      await promises.unlink(newFilePath3),
      await promises.unlink(newFilePath4),
      await promises.unlink(newFilePath5),
      await promises.unlink(newFilePath6)
    ]);
    await Promise.all([deleteFuture1, deleteFuture2, deleteFuture3, deleteFuture4, deleteFuture5, deleteFuture6]);
    const deleteFolderFuture1 = awaitEvent(watcher, join(testDir, "deep-multiple"), FileChangeType.DELETED);
    const deleteFolderFuture2 = awaitEvent(watcher, join(testDir, "deep-multiple-copy"), FileChangeType.DELETED);
    await Promise.all([Promises.rm(join(testDir, "deep-multiple"), RimRafMode.UNLINK), Promises.rm(join(testDir, "deep-multiple-copy"), RimRafMode.UNLINK)]);
    await Promise.all([deleteFolderFuture1, deleteFolderFuture2]);
  });
  test("subsequent watch updates watchers (path)", async function() {
    await watcher.watch([{ path: testDir, excludes: [join(realpathSync(testDir), "unrelated")], recursive: true }]);
    let newTextFilePath = join(testDir, "deep", "newFile.txt");
    let changeFuture = awaitEvent(watcher, newTextFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newTextFilePath, "Hello World");
    await changeFuture;
    await watcher.watch([{ path: join(testDir, "deep"), excludes: [join(realpathSync(testDir), "unrelated")], recursive: true }]);
    newTextFilePath = join(testDir, "deep", "newFile2.txt");
    changeFuture = awaitEvent(watcher, newTextFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newTextFilePath, "Hello World");
    await changeFuture;
    await watcher.watch([{ path: join(testDir, "deep"), excludes: [realpathSync(testDir)], recursive: true }]);
    await watcher.watch([{ path: join(testDir, "deep"), excludes: [], recursive: true }]);
    newTextFilePath = join(testDir, "deep", "newFile3.txt");
    changeFuture = awaitEvent(watcher, newTextFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newTextFilePath, "Hello World");
    await changeFuture;
  });
  test("invalid path does not crash watcher", async function() {
    await watcher.watch([
      { path: testDir, excludes: [], recursive: true },
      { path: join(testDir, "invalid-folder"), excludes: [], recursive: true },
      { path: FileAccess.asFileUri("").fsPath, excludes: [], recursive: true }
    ]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("subsequent watch updates watchers (excludes)", async function() {
    await watcher.watch([{ path: testDir, excludes: [realpathSync(testDir)], recursive: true }]);
    await watcher.watch([{ path: testDir, excludes: [], recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("subsequent watch updates watchers (includes)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["nothing"], recursive: true }]);
    await watcher.watch([{ path: testDir, excludes: [], recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("includes are supported", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["**/deep/**"], recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("includes are supported (relative pattern explicit)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: [{ base: testDir, pattern: "deep/newFile.txt" }], recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("includes are supported (relative pattern implicit)", async function() {
    await watcher.watch([{ path: testDir, excludes: [], includes: ["deep/newFile.txt"], recursive: true }]);
    return basicCrudTest(join(testDir, "deep", "newFile.txt"));
  });
  test("excludes are supported (path)", async function() {
    return testExcludes([join(realpathSync(testDir), "deep")]);
  });
  test("excludes are supported (glob)", function() {
    return testExcludes(["deep/**"]);
  });
  async function testExcludes(excludes) {
    await watcher.watch([{ path: testDir, excludes, recursive: true }]);
    const newTextFilePath = join(testDir, "deep", "newFile.txt");
    const changeFuture = awaitEvent(watcher, newTextFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newTextFilePath, "Hello World");
    const res = await Promise.any([
      timeout(500).then(() => true),
      changeFuture.then(() => false)
    ]);
    if (!res) {
      assert.fail("Unexpected change event");
    }
  }
  (isWindows ? test.skip : test)("symlink support (root)", async function() {
    const link = join(testDir, "deep-linked");
    const linkTarget = join(testDir, "deep");
    await promises.symlink(linkTarget, link);
    await watcher.watch([{ path: link, excludes: [], recursive: true }]);
    return basicCrudTest(join(link, "newFile.txt"));
  });
  (isWindows ? test.skip : test)("symlink support (via extra watch)", async function() {
    const link = join(testDir, "deep-linked");
    const linkTarget = join(testDir, "deep");
    await promises.symlink(linkTarget, link);
    await watcher.watch([{ path: testDir, excludes: [], recursive: true }, { path: link, excludes: [], recursive: true }]);
    return basicCrudTest(join(link, "newFile.txt"));
  });
  (!isWindows ? test.skip : test)("unc support", async function() {
    addUNCHostToAllowlist("localhost");
    const uncPath = `\\\\localhost\\${getDriveLetter(testDir)?.toLowerCase()}$\\${ltrim(testDir.substr(testDir.indexOf(":") + 1), "\\")}`;
    await watcher.watch([{ path: uncPath, excludes: [], recursive: true }]);
    return basicCrudTest(join(uncPath, "deep", "newFile.txt"));
  });
  (isLinux ? test.skip : test)("wrong casing", async function() {
    const deepWrongCasedPath = join(testDir, "DEEP");
    await watcher.watch([{ path: deepWrongCasedPath, excludes: [], recursive: true }]);
    return basicCrudTest(join(deepWrongCasedPath, "newFile.txt"));
  });
  test("invalid folder does not explode", async function() {
    const invalidPath = join(testDir, "invalid");
    await watcher.watch([{ path: invalidPath, excludes: [], recursive: true }]);
  });
  (isWindows ? test.skip : test)("deleting watched path without correlation restarts watching", async function() {
    const watchedPath = join(testDir, "deep");
    await watcher.watch([{ path: watchedPath, excludes: [], recursive: true }]);
    const warnFuture = awaitMessage(watcher, "warn");
    await Promises.rm(watchedPath, RimRafMode.UNLINK);
    await warnFuture;
    await timeout(1500);
    await promises.mkdir(watchedPath);
    await timeout(1500);
    await watcher.whenReady();
    const newFilePath = join(watchedPath, "newFile.txt");
    const changeFuture = awaitEvent(watcher, newFilePath, FileChangeType.ADDED);
    await Promises.writeFile(newFilePath, "Hello World");
    await changeFuture;
  });
  test("correlationId is supported", async function() {
    const correlationId = Math.random();
    await watcher.watch([{ correlationId, path: testDir, excludes: [], recursive: true }]);
    return basicCrudTest(join(testDir, "newFile.txt"), correlationId);
  });
  test("should not exclude roots that do not overlap", async () => {
    if (isWindows) {
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a"]), ["C:\\a"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a", "C:\\b"]), ["C:\\a", "C:\\b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a", "C:\\b", "C:\\c\\d\\e"]), ["C:\\a", "C:\\b", "C:\\c\\d\\e"]);
    } else {
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a"]), ["/a"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a", "/b"]), ["/a", "/b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a", "/b", "/c/d/e"]), ["/a", "/b", "/c/d/e"]);
    }
  });
  test("should remove sub-folders of other paths", async () => {
    if (isWindows) {
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a", "C:\\a\\b"]), ["C:\\a"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a", "C:\\b", "C:\\a\\b"]), ["C:\\a", "C:\\b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\b\\a", "C:\\a", "C:\\b", "C:\\a\\b"]), ["C:\\a", "C:\\b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["C:\\a", "C:\\a\\b", "C:\\a\\c\\d"]), ["C:\\a"]);
    } else {
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a", "/a/b"]), ["/a"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a", "/b", "/a/b"]), ["/a", "/b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/b/a", "/a", "/b", "/a/b"]), ["/a", "/b"]);
      assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/a", "/a/b", "/a/c/d"]), ["/a"]);
    }
  });
  test("should ignore when everything excluded", async () => {
    assert.deepStrictEqual(await watcher.testRemoveDuplicateRequests(["/foo/bar", "/bar"], ["**", "something"]), []);
  });
  test("watching same or overlapping paths supported when correlation is applied", async () => {
    await watcher.watch([
      { path: testDir, excludes: [], recursive: true, correlationId: 1 }
    ]);
    await basicCrudTest(join(testDir, "newFile.txt"), null, 1);
    await watcher.watch([
      { path: testDir, excludes: [], recursive: true, correlationId: 1 },
      { path: testDir, excludes: [], recursive: true, correlationId: 2 },
      { path: testDir, excludes: [], recursive: true, correlationId: void 0 }
    ]);
    await basicCrudTest(join(testDir, "newFile.txt"), null, 3);
    await basicCrudTest(join(testDir, "otherNewFile.txt"), null, 3);
    await watcher.watch([
      { path: testDir, excludes: [], recursive: true, correlationId: 1 },
      { path: testDir, excludes: [], recursive: true, correlationId: 2 },
      { path: testDir, excludes: [], recursive: true, correlationId: void 0 },
      { path: testDir, excludes: [join(realpathSync(testDir), "deep")], recursive: true, correlationId: 3 },
      { path: testDir, excludes: [join(realpathSync(testDir), "other")], recursive: true, correlationId: 4 }
    ]);
    await basicCrudTest(join(testDir, "newFile.txt"), null, 5);
    await basicCrudTest(join(testDir, "otherNewFile.txt"), null, 5);
    await watcher.watch([
      { path: dirname(testDir), excludes: [], recursive: true, correlationId: 1 },
      { path: testDir, excludes: [], recursive: true, correlationId: 2 },
      { path: join(testDir, "deep"), excludes: [], recursive: true, correlationId: 3 }
    ]);
    await basicCrudTest(join(testDir, "deep", "newFile.txt"), null, 3);
    await basicCrudTest(join(testDir, "deep", "otherNewFile.txt"), null, 3);
    await watcher.watch([
      { path: dirname(testDir), excludes: [], recursive: true, correlationId: 1 },
      { path: testDir, excludes: [join(realpathSync(testDir), "some")], recursive: true, correlationId: 2 },
      { path: join(testDir, "deep"), excludes: [join(realpathSync(testDir), "other")], recursive: true, correlationId: 3 }
    ]);
    await basicCrudTest(join(testDir, "deep", "newFile.txt"), null, 3);
    await basicCrudTest(join(testDir, "deep", "otherNewFile.txt"), null, 3);
  });
  test("watching missing path emits watcher fail event", async function() {
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const folderPath = join(testDir, "missing");
    watcher.watch([{ path: folderPath, excludes: [], recursive: true }]);
    await onDidWatchFail;
  });
  test("deleting watched path emits watcher fail and delete event if correlated", async function() {
    const folderPath = join(testDir, "deep");
    await watcher.watch([{ path: folderPath, excludes: [], recursive: true, correlationId: 1 }]);
    let failed = false;
    const instance = Array.from(watcher.watchers)[0];
    assert.strictEqual(instance.include(folderPath), true);
    instance.onDidFail(() => failed = true);
    const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const changeFuture = awaitEvent(watcher, folderPath, FileChangeType.DELETED, void 0, 1);
    Promises.rm(folderPath, RimRafMode.UNLINK);
    await onDidWatchFail;
    await changeFuture;
    assert.strictEqual(failed, true);
    assert.strictEqual(instance.failed, true);
  });
  (!isMacintosh ? test.skip : test)("watch requests support suspend/resume (folder, does not exist in beginning, not reusing watcher)", async () => {
    await testWatchFolderDoesNotExist(false);
  });
  test("watch requests support suspend/resume (folder, does not exist in beginning, reusing watcher)", async () => {
    await testWatchFolderDoesNotExist(true);
  });
  async function testWatchFolderDoesNotExist(reuseExistingWatcher) {
    let onDidWatchFail = Event.toPromise(watcher.onWatchFail);
    const folderPath = join(testDir, "not-found");
    const requests = [];
    if (reuseExistingWatcher) {
      requests.push({ path: testDir, excludes: [], recursive: true });
      await watcher.watch(requests);
    }
    const request = { path: folderPath, excludes: [], recursive: true };
    requests.push(request);
    await watcher.watch(requests);
    await onDidWatchFail;
    if (reuseExistingWatcher) {
      assert.strictEqual(watcher.isSuspended(request), true);
    } else {
      assert.strictEqual(watcher.isSuspended(request), "polling");
    }
    let changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
    let onDidWatch = Event.toPromise(watcher.onDidWatch);
    await promises.mkdir(folderPath);
    await changeFuture;
    await onDidWatch;
    assert.strictEqual(watcher.isSuspended(request), false);
    const filePath = join(folderPath, "newFile.txt");
    await basicCrudTest(filePath);
    if (!reuseExistingWatcher) {
      onDidWatchFail = Event.toPromise(watcher.onWatchFail);
      await Promises.rm(folderPath);
      await onDidWatchFail;
      changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
      onDidWatch = Event.toPromise(watcher.onDidWatch);
      await promises.mkdir(folderPath);
      await changeFuture;
      await onDidWatch;
      await basicCrudTest(filePath);
    }
  }
  (!isMacintosh ? test.skip : test)("watch requests support suspend/resume (folder, exist in beginning, not reusing watcher)", async () => {
    await testWatchFolderExists(false);
  });
  test("watch requests support suspend/resume (folder, exist in beginning, reusing watcher)", async () => {
    await testWatchFolderExists(true);
  });
  async function testWatchFolderExists(reuseExistingWatcher) {
    const folderPath = join(testDir, "deep");
    const requests = [{ path: folderPath, excludes: [], recursive: true }];
    if (reuseExistingWatcher) {
      requests.push({ path: testDir, excludes: [], recursive: true });
    }
    await watcher.watch(requests);
    const filePath = join(folderPath, "newFile.txt");
    await basicCrudTest(filePath);
    if (!reuseExistingWatcher) {
      const onDidWatchFail = Event.toPromise(watcher.onWatchFail);
      await Promises.rm(folderPath);
      await onDidWatchFail;
      const changeFuture = awaitEvent(watcher, folderPath, FileChangeType.ADDED);
      const onDidWatch = Event.toPromise(watcher.onDidWatch);
      await promises.mkdir(folderPath);
      await changeFuture;
      await onDidWatch;
      await basicCrudTest(filePath);
    }
  }
  test("watch request reuses another recursive watcher even when requests are coming in at the same time", async function() {
    const folderPath1 = join(testDir, "deep", "not-existing1");
    const folderPath2 = join(testDir, "deep", "not-existing2");
    const folderPath3 = join(testDir, "not-existing3");
    const requests = [
      { path: folderPath1, excludes: [], recursive: true, correlationId: 1 },
      { path: folderPath2, excludes: [], recursive: true, correlationId: 2 },
      { path: folderPath3, excludes: [], recursive: true, correlationId: 3 },
      { path: join(testDir, "deep"), excludes: [], recursive: true }
    ];
    await watcher.watch(requests);
    assert.strictEqual(watcher.isSuspended(requests[0]), true);
    assert.strictEqual(watcher.isSuspended(requests[1]), true);
    assert.strictEqual(watcher.isSuspended(requests[2]), "polling");
    assert.strictEqual(watcher.isSuspended(requests[3]), false);
  });
  test("event type filter", async function() {
    const request = { path: testDir, excludes: [], recursive: true, filter: FileChangeFilter.ADDED | FileChangeFilter.DELETED, correlationId: 1 };
    await watcher.watch([request]);
    const filePath = join(testDir, "lorem-newfile.txt");
    let changeFuture = awaitEvent(watcher, filePath, FileChangeType.ADDED, void 0, 1);
    await Promises.writeFile(filePath, "Hello Change");
    await changeFuture;
    changeFuture = awaitEvent(watcher, filePath, FileChangeType.DELETED, void 0, 1);
    await promises.unlink(filePath);
    await changeFuture;
  });
});
export {
  TestParcelWatcher
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy90ZXN0L25vZGUvcGFyY2VsV2F0Y2hlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgcmVhbHBhdGhTeW5jLCBwcm9taXNlcyB9IGZyb20gJ2ZzJztcbmltcG9ydCB7IHRtcGRpciB9IGZyb20gJ29zJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBkaXJuYW1lLCBqb2luIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgUHJvbWlzZXMsIFJpbVJhZk1vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IGdldFJhbmRvbVRlc3RQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L25vZGUvdGVzdFV0aWxzLmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VGaWx0ZXIsIEZpbGVDaGFuZ2VUeXBlLCBJRmlsZUNoYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBQYXJjZWxXYXRjaGVyIH0gZnJvbSAnLi4vLi4vbm9kZS93YXRjaGVyL3BhcmNlbC9wYXJjZWxXYXRjaGVyLmpzJztcbmltcG9ydCB7IElSZWN1cnNpdmVXYXRjaFJlcXVlc3QgfSBmcm9tICcuLi8uLi9jb21tb24vd2F0Y2hlci5qcyc7XG5pbXBvcnQgeyBnZXREcml2ZUxldHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V4dHBhdGguanMnO1xuaW1wb3J0IHsgbHRyaW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBhZGRVTkNIb3N0VG9BbGxvd2xpc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL25vZGUvdW5jLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuZXhwb3J0IGNsYXNzIFRlc3RQYXJjZWxXYXRjaGVyIGV4dGVuZHMgUGFyY2VsV2F0Y2hlciB7XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIHJlYWRvbmx5IHN1c3BlbmRlZFdhdGNoUmVxdWVzdFBvbGxpbmdJbnRlcnZhbCA9IDEwMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFdhdGNoID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkV2F0Y2ggPSB0aGlzLl9vbkRpZFdhdGNoLmV2ZW50O1xuXG5cdHJlYWRvbmx5IG9uV2F0Y2hGYWlsID0gdGhpcy5fb25EaWRXYXRjaEZhaWwuZXZlbnQ7XG5cblx0YXN5bmMgdGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKHBhdGhzOiBzdHJpbmdbXSwgZXhjbHVkZXM6IHN0cmluZ1tdID0gW10pOiBQcm9taXNlPHN0cmluZ1tdPiB7XG5cblx0XHQvLyBXb3JrIHdpdGggc3RyaW5ncyBhcyBwYXRocyB0byBzaW1wbGlmeSB0ZXN0aW5nXG5cdFx0Y29uc3QgcmVxdWVzdHM6IElSZWN1cnNpdmVXYXRjaFJlcXVlc3RbXSA9IHBhdGhzLm1hcChwYXRoID0+IHtcblx0XHRcdHJldHVybiB7IHBhdGgsIGV4Y2x1ZGVzLCByZWN1cnNpdmU6IHRydWUgfTtcblx0XHR9KTtcblxuXHRcdHJldHVybiAoYXdhaXQgdGhpcy5yZW1vdmVEdXBsaWNhdGVSZXF1ZXN0cyhyZXF1ZXN0cywgZmFsc2UgLyogdmFsaWRhdGUgcGF0aHMgc2tpcHBlZCBmb3IgdGVzdHMgKi8pKS5tYXAocmVxdWVzdCA9PiByZXF1ZXN0LnBhdGgpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFVwZGF0ZVdhdGNoZXJzRGVsYXkoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gMDtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBkb1dhdGNoKHJlcXVlc3RzOiBJUmVjdXJzaXZlV2F0Y2hSZXF1ZXN0W10pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBzdXBlci5kb1dhdGNoKHJlcXVlc3RzKTtcblx0XHRhd2FpdCB0aGlzLndoZW5SZWFkeSgpO1xuXG5cdFx0dGhpcy5fb25EaWRXYXRjaC5maXJlKCk7XG5cdH1cblxuXHRhc3luYyB3aGVuUmVhZHkoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Zm9yIChjb25zdCB3YXRjaGVyIG9mIHRoaXMud2F0Y2hlcnMpIHtcblx0XHRcdGF3YWl0IHdhdGNoZXIucmVhZHk7XG5cdFx0fVxuXHR9XG59XG5cbi8vIHRoaXMgc3VpdGUgaGFzIHNob3duIGZsYWt5IHJ1bnMgaW4gQXp1cmUgcGlwZWxpbmVzIHdoZXJlXG4vLyB0YXNrcyB3b3VsZCBqdXN0IGhhbmcgYW5kIHRpbWVvdXQgYWZ0ZXIgYSB3aGlsZSAobm90IGluXG4vLyBtb2NoYSBidXQgZ2VuZXJhbGx5KS4gYXMgc3VjaCB0aGV5IHdpbGwgcnVuIG9ubHkgb24gZGVtYW5kXG4vLyB3aGVuZXZlciB3ZSB1cGRhdGUgdGhlIHdhdGNoZXIgbGlicmFyeS5cblxuc3VpdGUuc2tpcCgnRmlsZSBXYXRjaGVyIChwYXJjZWwpJywgZnVuY3Rpb24gKCkge1xuXG5cdHRoaXMudGltZW91dCgxMDAwMCk7XG5cblx0bGV0IHRlc3REaXI6IHN0cmluZztcblx0bGV0IHdhdGNoZXI6IFRlc3RQYXJjZWxXYXRjaGVyO1xuXG5cdGxldCBsb2dnaW5nRW5hYmxlZCA9IGZhbHNlO1xuXG5cdGZ1bmN0aW9uIGVuYWJsZUxvZ2dpbmcoZW5hYmxlOiBib29sZWFuKSB7XG5cdFx0bG9nZ2luZ0VuYWJsZWQgPSBlbmFibGU7XG5cdFx0d2F0Y2hlcj8uc2V0VmVyYm9zZUxvZ2dpbmcoZW5hYmxlKTtcblx0fVxuXG5cdGVuYWJsZUxvZ2dpbmcobG9nZ2luZ0VuYWJsZWQpO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHR3YXRjaGVyID0gbmV3IFRlc3RQYXJjZWxXYXRjaGVyKCk7XG5cdFx0d2F0Y2hlci5zZXRWZXJib3NlTG9nZ2luZyhsb2dnaW5nRW5hYmxlZCk7XG5cblx0XHR3YXRjaGVyLm9uRGlkTG9nTWVzc2FnZShlID0+IHtcblx0XHRcdGlmIChsb2dnaW5nRW5hYmxlZCkge1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgW3JlY3Vyc2l2ZSB3YXRjaGVyIHRlc3QgbWVzc2FnZV0gJHtlLm1lc3NhZ2V9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR3YXRjaGVyLm9uRGlkRXJyb3IoZSA9PiB7XG5cdFx0XHRpZiAobG9nZ2luZ0VuYWJsZWQpIHtcblx0XHRcdFx0Y29uc29sZS5sb2coYFtyZWN1cnNpdmUgd2F0Y2hlciB0ZXN0IGVycm9yXSAke2UuZXJyb3J9YCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHQvLyBSdWxlIG91dCBzdHJhbmdlIHRlc3RpbmcgY29uZGl0aW9ucyBieSB1c2luZyB0aGUgcmVhbHBhdGhcblx0XHQvLyBoZXJlLiBmb3IgZXhhbXBsZSwgb24gbWFjT1MgdGhlIHRtcCBkaXIgaXMgcG90ZW50aWFsbHkgYVxuXHRcdC8vIHN5bWxpbmsgaW4gc29tZSBvZiB0aGUgcm9vdCBmb2xkZXJzLCB3aGljaCBpcyBhIHJhdGhlclxuXHRcdC8vIHVucmVhbGlzaWMgY2FzZSBmb3IgdGhlIGZpbGUgd2F0Y2hlci5cblx0XHR0ZXN0RGlyID0gVVJJLmZpbGUoZ2V0UmFuZG9tVGVzdFBhdGgocmVhbHBhdGhTeW5jKHRtcGRpcigpKSwgJ3ZzY3Rlc3RzJywgJ2ZpbGV3YXRjaGVyJykpLmZzUGF0aDtcblxuXHRcdGNvbnN0IHNvdXJjZURpciA9IEZpbGVBY2Nlc3MuYXNGaWxlVXJpKCd2cy9wbGF0Zm9ybS9maWxlcy90ZXN0L25vZGUvZml4dHVyZXMvc2VydmljZScpLmZzUGF0aDtcblxuXHRcdGF3YWl0IFByb21pc2VzLmNvcHkoc291cmNlRGlyLCB0ZXN0RGlyLCB7IHByZXNlcnZlU3ltbGlua3M6IGZhbHNlIH0pO1xuXHR9KTtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd2F0Y2hlcnMgPSBBcnJheS5mcm9tKHdhdGNoZXIud2F0Y2hlcnMpLmxlbmd0aDtcblx0XHRsZXQgc3RvcHBlZEluc3RhbmNlcyA9IDA7XG5cdFx0Zm9yIChjb25zdCBpbnN0YW5jZSBvZiB3YXRjaGVyLndhdGNoZXJzKSB7XG5cdFx0XHRFdmVudC5vbmNlKGluc3RhbmNlLm9uRGlkU3RvcCkoKCkgPT4ge1xuXHRcdFx0XHRpZiAoaW5zdGFuY2Uuc3RvcHBlZCkge1xuXHRcdFx0XHRcdHN0b3BwZWRJbnN0YW5jZXMrKztcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgd2F0Y2hlci5zdG9wKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0b3BwZWRJbnN0YW5jZXMsIHdhdGNoZXJzLCAnQWxsIHdhdGNoZXJzIG11c3QgYmUgc3RvcHBlZCBiZWZvcmUgdGhlIHRlc3QgZW5kcycpO1xuXHRcdHdhdGNoZXIuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gUG9zc2libGUgdGhhdCB0aGUgZmlsZSB3YXRjaGVyIGlzIHN0aWxsIGhvbGRpbmdcblx0XHQvLyBvbnRvIHRoZSBmb2xkZXJzIG9uIFdpbmRvd3Mgc3BlY2lmaWNhbGx5IGFuZCB0aGVcblx0XHQvLyB1bmxpbmsgd291bGQgZmFpbC4gSW4gdGhhdCBjYXNlLCBkbyBub3QgZmFpbCB0aGVcblx0XHQvLyB0ZXN0IHN1aXRlLlxuXHRcdHJldHVybiBQcm9taXNlcy5ybSh0ZXN0RGlyKS5jYXRjaChlcnJvciA9PiBjb25zb2xlLmVycm9yKGVycm9yKSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRvTXNnKHR5cGU6IEZpbGVDaGFuZ2VUeXBlKTogc3RyaW5nIHtcblx0XHRzd2l0Y2ggKHR5cGUpIHtcblx0XHRcdGNhc2UgRmlsZUNoYW5nZVR5cGUuQURERUQ6IHJldHVybiAnYWRkZWQnO1xuXHRcdFx0Y2FzZSBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEOiByZXR1cm4gJ2RlbGV0ZWQnO1xuXHRcdFx0ZGVmYXVsdDogcmV0dXJuICdjaGFuZ2VkJztcblx0XHR9XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBhd2FpdEV2ZW50KHdhdGNoZXI6IFRlc3RQYXJjZWxXYXRjaGVyLCBwYXRoOiBzdHJpbmcsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLCBmYWlsT25FdmVudFJlYXNvbj86IHN0cmluZywgY29ycmVsYXRpb25JZD86IG51bWJlciB8IG51bGwsIGV4cGVjdGVkQ291bnQ/OiBudW1iZXIpOiBQcm9taXNlPElGaWxlQ2hhbmdlW10+IHtcblx0XHRpZiAobG9nZ2luZ0VuYWJsZWQpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBBd2FpdGluZyBjaGFuZ2UgdHlwZSAnJHt0b01zZyh0eXBlKX0nIG9uIGZpbGUgJyR7cGF0aH0nYCk7XG5cdFx0fVxuXG5cdFx0Ly8gQXdhaXQgdGhlIGV2ZW50XG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgbmV3IFByb21pc2U8SUZpbGVDaGFuZ2VbXT4oKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0bGV0IGNvdW50ZXIgPSAwO1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHdhdGNoZXIub25EaWRDaGFuZ2VGaWxlKGV2ZW50cyA9PiB7XG5cdFx0XHRcdGZvciAoY29uc3QgZXZlbnQgb2YgZXZlbnRzKSB7XG5cdFx0XHRcdFx0aWYgKGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlLmlzRXF1YWwoZXZlbnQucmVzb3VyY2UsIFVSSS5maWxlKHBhdGgpKSAmJiBldmVudC50eXBlID09PSB0eXBlICYmIChjb3JyZWxhdGlvbklkID09PSBudWxsIHx8IGV2ZW50LmNJZCA9PT0gY29ycmVsYXRpb25JZCkpIHtcblx0XHRcdFx0XHRcdGNvdW50ZXIrKztcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgZXhwZWN0ZWRDb3VudCA9PT0gJ251bWJlcicgJiYgY291bnRlciA8IGV4cGVjdGVkQ291bnQpIHtcblx0XHRcdFx0XHRcdFx0Y29udGludWU7IC8vIG5vdCB5ZXRcblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0XHRpZiAoZmFpbE9uRXZlbnRSZWFzb24pIHtcblx0XHRcdFx0XHRcdFx0cmVqZWN0KG5ldyBFcnJvcihgVW5leHBlY3RlZCBmaWxlIGV2ZW50OiAke2ZhaWxPbkV2ZW50UmVhc29ufWApKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdHNldEltbWVkaWF0ZSgoKSA9PiByZXNvbHZlKGV2ZW50cykpOyAvLyBjb3BpZWQgZnJvbSBwYXJjZWwgd2F0Y2hlciB0ZXN0cywgc2VlbXMgdG8gZHJvcCB1bnJlbGF0ZWQgZXZlbnRzIG9uIG1hY09TXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0Ly8gVW53aW5kIGZyb20gdGhlIGV2ZW50IGNhbGwgc3RhY2s6IHdlIGhhdmUgc2VlbiBjcmFzaGVzIGluIFBhcmNlbFxuXHRcdC8vIHdoZW4gZS5nLiBjYWxsaW5nIGB1bnN1YnNjcmliZWAgZGlyZWN0bHkgZnJvbSB0aGUgc3RhY2sgb2YgYSBmaWxlXG5cdFx0Ly8gY2hhbmdlIGV2ZW50XG5cdFx0Ly8gUmVmczogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNzQzMFxuXHRcdGF3YWl0IHRpbWVvdXQoMSk7XG5cblx0XHRyZXR1cm4gcmVzO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXdhaXRNZXNzYWdlKHdhdGNoZXI6IFRlc3RQYXJjZWxXYXRjaGVyLCB0eXBlOiAndHJhY2UnIHwgJ3dhcm4nIHwgJ2Vycm9yJyB8ICdpbmZvJyB8ICdkZWJ1ZycpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAobG9nZ2luZ0VuYWJsZWQpIHtcblx0XHRcdGNvbnNvbGUubG9nKGBBd2FpdGluZyBtZXNzYWdlIG9mIHR5cGUgJHt0eXBlfWApO1xuXHRcdH1cblxuXHRcdC8vIEF3YWl0IHRoZSBtZXNzYWdlXG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHdhdGNoZXIub25EaWRMb2dNZXNzYWdlKG1zZyA9PiB7XG5cdFx0XHRcdGlmIChtc2cudHlwZSA9PT0gdHlwZSkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH1cblxuXHR0ZXN0KCdiYXNpY3MnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtyZXF1ZXN0XSk7XG5cblx0XHRjb25zdCBpbnN0YW5jZSA9IEFycmF5LmZyb20od2F0Y2hlci53YXRjaGVycylbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlcXVlc3QsIGluc3RhbmNlLnJlcXVlc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5mYWlsZWQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2Uuc3RvcHBlZCwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBzdWJzY3JpcHRpb25zMSA9IG5ldyBNYXA8c3RyaW5nLCBGaWxlQ2hhbmdlVHlwZT4oKTtcblx0XHRjb25zdCBzdWJzY3JpcHRpb25zMiA9IG5ldyBNYXA8c3RyaW5nLCBGaWxlQ2hhbmdlVHlwZT4oKTtcblxuXHRcdC8vIE5ldyBmaWxlXG5cdFx0Y29uc3QgbmV3RmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0Jyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbmNlLnN1YnNjcmliZShuZXdGaWxlUGF0aCwgY2hhbmdlID0+IHN1YnNjcmlwdGlvbnMxLnNldChjaGFuZ2UucmVzb3VyY2UuZnNQYXRoLCBjaGFuZ2UudHlwZSkpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoaW5zdGFuY2Uuc3Vic2NyaWJlKG5ld0ZpbGVQYXRoLCBjaGFuZ2UgPT4gc3Vic2NyaXB0aW9uczIuc2V0KGNoYW5nZS5yZXNvdXJjZS5mc1BhdGgsIGNoYW5nZS50eXBlKSkpOyAvLyBjYW4gc3Vic2NyaWJlIG11bHRpcGxlIHRpbWVzXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmluY2x1ZGUobmV3RmlsZVBhdGgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuZXhjbHVkZShuZXdGaWxlUGF0aCksIGZhbHNlKTtcblx0XHRsZXQgY2hhbmdlRnV0dXJlOiBQcm9taXNlPHVua25vd24+ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aCwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdWJzY3JpcHRpb25zMS5nZXQobmV3RmlsZVBhdGgpLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN1YnNjcmlwdGlvbnMyLmdldChuZXdGaWxlUGF0aCksIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblxuXHRcdC8vIE5ldyBmb2xkZXJcblx0XHRjb25zdCBuZXdGb2xkZXJQYXRoID0gam9pbih0ZXN0RGlyLCAnZGVlcCcsICdOZXcgRm9sZGVyJyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbmNlLnN1YnNjcmliZShuZXdGb2xkZXJQYXRoLCBjaGFuZ2UgPT4gc3Vic2NyaXB0aW9uczEuc2V0KGNoYW5nZS5yZXNvdXJjZS5mc1BhdGgsIGNoYW5nZS50eXBlKSkpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBpbnN0YW5jZS5zdWJzY3JpYmUobmV3Rm9sZGVyUGF0aCwgY2hhbmdlID0+IHN1YnNjcmlwdGlvbnMyLnNldChjaGFuZ2UucmVzb3VyY2UuZnNQYXRoLCBjaGFuZ2UudHlwZSkpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5pbmNsdWRlKG5ld0ZvbGRlclBhdGgpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5zdGFuY2UuZXhjbHVkZShuZXdGb2xkZXJQYXRoKSwgZmFsc2UpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3Rm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IHByb21pc2VzLm1rZGlyKG5ld0ZvbGRlclBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3Vic2NyaXB0aW9uczEuZ2V0KG5ld0ZvbGRlclBhdGgpLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN1YnNjcmlwdGlvbnMyLmhhcyhuZXdGb2xkZXJQYXRoKSwgZmFsc2UgLyogc3Vic2NyaXB0aW9uIHdhcyBkaXNwb3NlZCBiZWZvcmUgdGhlIGV2ZW50ICovKTtcblxuXHRcdC8vIFJlbmFtZSBmaWxlXG5cdFx0bGV0IHJlbmFtZWRGaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAncmVuYW1lZEZpbGUudHh0Jyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbmNlLnN1YnNjcmliZShyZW5hbWVkRmlsZVBhdGgsIGNoYW5nZSA9PiBzdWJzY3JpcHRpb25zMS5zZXQoY2hhbmdlLnJlc291cmNlLmZzUGF0aCwgY2hhbmdlLnR5cGUpKSk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCksXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIHJlbmFtZWRGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpXG5cdFx0XSk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKG5ld0ZpbGVQYXRoLCByZW5hbWVkRmlsZVBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3Vic2NyaXB0aW9uczEuZ2V0KG5ld0ZpbGVQYXRoKSwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN1YnNjcmlwdGlvbnMxLmdldChyZW5hbWVkRmlsZVBhdGgpLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cblx0XHQvLyBSZW5hbWUgZm9sZGVyXG5cdFx0bGV0IHJlbmFtZWRGb2xkZXJQYXRoID0gam9pbih0ZXN0RGlyLCAnZGVlcCcsICdSZW5hbWVkIEZvbGRlcicpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChpbnN0YW5jZS5zdWJzY3JpYmUocmVuYW1lZEZvbGRlclBhdGgsIGNoYW5nZSA9PiBzdWJzY3JpcHRpb25zMS5zZXQoY2hhbmdlLnJlc291cmNlLmZzUGF0aCwgY2hhbmdlLnR5cGUpKSk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGb2xkZXJQYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSxcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKVxuXHRcdF0pO1xuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShuZXdGb2xkZXJQYXRoLCByZW5hbWVkRm9sZGVyUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdWJzY3JpcHRpb25zMS5nZXQobmV3Rm9sZGVyUGF0aCksIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdWJzY3JpcHRpb25zMS5nZXQocmVuYW1lZEZvbGRlclBhdGgpLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cblx0XHQvLyBSZW5hbWUgZmlsZSAoc2FtZSBuYW1lLCBkaWZmZXJlbnQgY2FzZSlcblx0XHRjb25zdCBjYXNlUmVuYW1lZEZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnZGVlcCcsICdSZW5hbWVkRmlsZS50eHQnKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIHJlbmFtZWRGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCksXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIGNhc2VSZW5hbWVkRmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKVxuXHRcdF0pO1xuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShyZW5hbWVkRmlsZVBhdGgsIGNhc2VSZW5hbWVkRmlsZVBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRyZW5hbWVkRmlsZVBhdGggPSBjYXNlUmVuYW1lZEZpbGVQYXRoO1xuXG5cdFx0Ly8gUmVuYW1lIGZvbGRlciAoc2FtZSBuYW1lLCBkaWZmZXJlbnQgY2FzZSlcblx0XHRjb25zdCBjYXNlUmVuYW1lZEZvbGRlclBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJywgJ1JFbmFtZWQgRm9sZGVyJyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCByZW5hbWVkRm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCksXG5cdFx0XHRhd2FpdEV2ZW50KHdhdGNoZXIsIGNhc2VSZW5hbWVkRm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpXG5cdFx0XSk7XG5cdFx0YXdhaXQgUHJvbWlzZXMucmVuYW1lKHJlbmFtZWRGb2xkZXJQYXRoLCBjYXNlUmVuYW1lZEZvbGRlclBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRyZW5hbWVkRm9sZGVyUGF0aCA9IGNhc2VSZW5hbWVkRm9sZGVyUGF0aDtcblxuXHRcdC8vIE1vdmUgZmlsZVxuXHRcdGNvbnN0IG1vdmVkRmlsZXBhdGggPSBqb2luKHRlc3REaXIsICdtb3ZlZEZpbGUudHh0Jyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCByZW5hbWVkRmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpLFxuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBtb3ZlZEZpbGVwYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRClcblx0XHRdKTtcblx0XHRhd2FpdCBQcm9taXNlcy5yZW5hbWUocmVuYW1lZEZpbGVQYXRoLCBtb3ZlZEZpbGVwYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBNb3ZlIGZvbGRlclxuXHRcdGNvbnN0IG1vdmVkRm9sZGVycGF0aCA9IGpvaW4odGVzdERpciwgJ01vdmVkIEZvbGRlcicpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IFByb21pc2UuYWxsKFtcblx0XHRcdGF3YWl0RXZlbnQod2F0Y2hlciwgcmVuYW1lZEZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpLFxuXHRcdFx0YXdhaXRFdmVudCh3YXRjaGVyLCBtb3ZlZEZvbGRlcnBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKVxuXHRcdF0pO1xuXHRcdGF3YWl0IFByb21pc2VzLnJlbmFtZShyZW5hbWVkRm9sZGVyUGF0aCwgbW92ZWRGb2xkZXJwYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBDb3B5IGZpbGVcblx0XHRjb25zdCBjb3BpZWRGaWxlcGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnY29waWVkRmlsZS50eHQnKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGNvcGllZEZpbGVwYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgcHJvbWlzZXMuY29weUZpbGUobW92ZWRGaWxlcGF0aCwgY29waWVkRmlsZXBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIENvcHkgZm9sZGVyXG5cdFx0Y29uc3QgY29waWVkRm9sZGVycGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnQ29waWVkIEZvbGRlcicpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgY29waWVkRm9sZGVycGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IFByb21pc2VzLmNvcHkobW92ZWRGb2xkZXJwYXRoLCBjb3BpZWRGb2xkZXJwYXRoLCB7IHByZXNlcnZlU3ltbGlua3M6IGZhbHNlIH0pO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIENoYW5nZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGaWxlcGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKGNvcGllZEZpbGVwYXRoLCAnSGVsbG8gQ2hhbmdlJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gQ3JlYXRlIG5ldyBmaWxlXG5cdFx0Y29uc3QgYW5vdGhlck5ld0ZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnZGVlcCcsICdhbm90aGVyTmV3RmlsZS50eHQnKTtcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGFub3RoZXJOZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShhbm90aGVyTmV3RmlsZVBhdGgsICdIZWxsbyBBbm90aGVyIFdvcmxkJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0Ly8gUmVhZCBmaWxlIGRvZXMgbm90IGVtaXQgZXZlbnRcblx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGFub3RoZXJOZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgJ3VuZXhwZWN0ZWQtZXZlbnQtZnJvbS1yZWFkLWZpbGUnKTtcblx0XHRhd2FpdCBwcm9taXNlcy5yZWFkRmlsZShhbm90aGVyTmV3RmlsZVBhdGgpO1xuXHRcdGF3YWl0IFByb21pc2UucmFjZShbdGltZW91dCgxMDApLCBjaGFuZ2VGdXR1cmVdKTtcblxuXHRcdC8vIFN0YXQgZmlsZSBkb2VzIG5vdCBlbWl0IGV2ZW50XG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBhbm90aGVyTmV3RmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsICd1bmV4cGVjdGVkLWV2ZW50LWZyb20tc3RhdCcpO1xuXHRcdGF3YWl0IHByb21pc2VzLnN0YXQoYW5vdGhlck5ld0ZpbGVQYXRoKTtcblx0XHRhd2FpdCBQcm9taXNlLnJhY2UoW3RpbWVvdXQoMTAwKSwgY2hhbmdlRnV0dXJlXSk7XG5cblx0XHQvLyBTdGF0IGZvbGRlciBkb2VzIG5vdCBlbWl0IGV2ZW50XG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGb2xkZXJwYXRoLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVELCAndW5leHBlY3RlZC1ldmVudC1mcm9tLXN0YXQnKTtcblx0XHRhd2FpdCBwcm9taXNlcy5zdGF0KGNvcGllZEZvbGRlcnBhdGgpO1xuXHRcdGF3YWl0IFByb21pc2UucmFjZShbdGltZW91dCgxMDApLCBjaGFuZ2VGdXR1cmVdKTtcblxuXHRcdC8vIERlbGV0ZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGaWxlcGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbmNlLnN1YnNjcmliZShjb3BpZWRGaWxlcGF0aCwgY2hhbmdlID0+IHN1YnNjcmlwdGlvbnMxLnNldChjaGFuZ2UucmVzb3VyY2UuZnNQYXRoLCBjaGFuZ2UudHlwZSkpKTtcblx0XHRhd2FpdCBwcm9taXNlcy51bmxpbmsoY29waWVkRmlsZXBhdGgpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3Vic2NyaXB0aW9uczEuZ2V0KGNvcGllZEZpbGVwYXRoKSwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cblx0XHQvLyBEZWxldGUgZm9sZGVyXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBjb3BpZWRGb2xkZXJwYXRoLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoaW5zdGFuY2Uuc3Vic2NyaWJlKGNvcGllZEZvbGRlcnBhdGgsIGNoYW5nZSA9PiBzdWJzY3JpcHRpb25zMS5zZXQoY2hhbmdlLnJlc291cmNlLmZzUGF0aCwgY2hhbmdlLnR5cGUpKSk7XG5cdFx0YXdhaXQgcHJvbWlzZXMucm1kaXIoY29waWVkRm9sZGVycGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdWJzY3JpcHRpb25zMS5nZXQoY29waWVkRm9sZGVycGF0aCksIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHQoaXNNYWNpbnRvc2ggLyogdGhpcyB0ZXN0IHNlZW1zIG5vdCBwb3NzaWJsZSB3aXRoIGZzZXZlbnRzIGJhY2tlbmQgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnYmFzaWNzIChhdG9taWMgd3JpdGVzKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblxuXHRcdC8vIERlbGV0ZSArIFJlY3JlYXRlIGZpbGVcblx0XHRjb25zdCBuZXdGaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnY29ud2F5LmpzJyk7XG5cdFx0Y29uc3QgY2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cdFx0YXdhaXQgcHJvbWlzZXMudW5saW5rKG5ld0ZpbGVQYXRoKTtcblx0XHRQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgsICdIZWxsbyBBdG9taWMgV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xuXG5cdCghaXNMaW51eCAvKiBwb2xsaW5nIGlzIG9ubHkgdXNlZCBpbiBsaW51eCBlbnZpcm9ubWVudHMgKFdTTCkgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnYmFzaWNzIChwb2xsaW5nKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcG9sbGluZ0ludGVydmFsOiAxMDAsIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHRhc3luYyBmdW5jdGlvbiBiYXNpY0NydWRUZXN0KGZpbGVQYXRoOiBzdHJpbmcsIGNvcnJlbGF0aW9uSWQ/OiBudW1iZXIgfCBudWxsLCBleHBlY3RlZENvdW50PzogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHQvLyBOZXcgZmlsZVxuXHRcdGxldCBjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCwgdW5kZWZpbmVkLCBjb3JyZWxhdGlvbklkLCBleHBlY3RlZENvdW50KTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBXb3JsZCcpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblxuXHRcdC8vIENoYW5nZSBmaWxlXG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBmaWxlUGF0aCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgdW5kZWZpbmVkLCBjb3JyZWxhdGlvbklkLCBleHBlY3RlZENvdW50KTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBDaGFuZ2UnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBEZWxldGUgZmlsZVxuXHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQsIHVuZGVmaW5lZCwgY29ycmVsYXRpb25JZCwgZXhwZWN0ZWRDb3VudCk7XG5cdFx0YXdhaXQgcHJvbWlzZXMudW5saW5rKGZpbGVQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH1cblxuXHR0ZXN0KCdtdWx0aXBsZSBldmVudHMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cdFx0YXdhaXQgcHJvbWlzZXMubWtkaXIoam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZScpKTtcblxuXHRcdC8vIG11bHRpcGxlIGFkZFxuXG5cdFx0Y29uc3QgbmV3RmlsZVBhdGgxID0gam9pbih0ZXN0RGlyLCAnbmV3RmlsZS0xLnR4dCcpO1xuXHRcdGNvbnN0IG5ld0ZpbGVQYXRoMiA9IGpvaW4odGVzdERpciwgJ25ld0ZpbGUtMi50eHQnKTtcblx0XHRjb25zdCBuZXdGaWxlUGF0aDMgPSBqb2luKHRlc3REaXIsICduZXdGaWxlLTMudHh0Jyk7XG5cdFx0Y29uc3QgbmV3RmlsZVBhdGg0ID0gam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZScsICduZXdGaWxlLTEudHh0Jyk7XG5cdFx0Y29uc3QgbmV3RmlsZVBhdGg1ID0gam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZScsICduZXdGaWxlLTIudHh0Jyk7XG5cdFx0Y29uc3QgbmV3RmlsZVBhdGg2ID0gam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZScsICduZXdGaWxlLTMudHh0Jyk7XG5cblx0XHRjb25zdCBhZGRlZEZ1dHVyZTEgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMSwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGNvbnN0IGFkZGVkRnV0dXJlMiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgyLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0Y29uc3QgYWRkZWRGdXR1cmUzID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDMsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRjb25zdCBhZGRlZEZ1dHVyZTQgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoNCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGNvbnN0IGFkZGVkRnV0dXJlNSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGg1LCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0Y29uc3QgYWRkZWRGdXR1cmU2ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDYsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDEsICdIZWxsbyBXb3JsZCAxJyksXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgyLCAnSGVsbG8gV29ybGQgMicpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoMywgJ0hlbGxvIFdvcmxkIDMnKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDQsICdIZWxsbyBXb3JsZCA0JyksXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGg1LCAnSGVsbG8gV29ybGQgNScpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoNiwgJ0hlbGxvIFdvcmxkIDYnKVxuXHRcdF0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2FkZGVkRnV0dXJlMSwgYWRkZWRGdXR1cmUyLCBhZGRlZEZ1dHVyZTMsIGFkZGVkRnV0dXJlNCwgYWRkZWRGdXR1cmU1LCBhZGRlZEZ1dHVyZTZdKTtcblxuXHRcdC8vIG11bHRpcGxlIGNoYW5nZVxuXG5cdFx0Y29uc3QgY2hhbmdlRnV0dXJlMSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgxLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKTtcblx0XHRjb25zdCBjaGFuZ2VGdXR1cmUyID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDIsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZTMgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMywgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cdFx0Y29uc3QgY2hhbmdlRnV0dXJlNCA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGg0LCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKTtcblx0XHRjb25zdCBjaGFuZ2VGdXR1cmU1ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDUsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZTYgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoNiwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgxLCAnSGVsbG8gVXBkYXRlIDEnKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDIsICdIZWxsbyBVcGRhdGUgMicpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoMywgJ0hlbGxvIFVwZGF0ZSAzJyksXG5cdFx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGg0LCAnSGVsbG8gVXBkYXRlIDQnKSxcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZShuZXdGaWxlUGF0aDUsICdIZWxsbyBVcGRhdGUgNScpLFxuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld0ZpbGVQYXRoNiwgJ0hlbGxvIFVwZGF0ZSA2Jylcblx0XHRdKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtjaGFuZ2VGdXR1cmUxLCBjaGFuZ2VGdXR1cmUyLCBjaGFuZ2VGdXR1cmUzLCBjaGFuZ2VGdXR1cmU0LCBjaGFuZ2VGdXR1cmU1LCBjaGFuZ2VGdXR1cmU2XSk7XG5cblx0XHQvLyBjb3B5IHdpdGggbXVsdGlwbGUgZmlsZXNcblxuXHRcdGNvbnN0IGNvcHlGdXR1cmUxID0gYXdhaXRFdmVudCh3YXRjaGVyLCBqb2luKHRlc3REaXIsICdkZWVwLW11bHRpcGxlLWNvcHknLCAnbmV3RmlsZS0xLnR4dCcpLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0Y29uc3QgY29weUZ1dHVyZTIgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGpvaW4odGVzdERpciwgJ2RlZXAtbXVsdGlwbGUtY29weScsICduZXdGaWxlLTIudHh0JyksIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRjb25zdCBjb3B5RnV0dXJlMyA9IGF3YWl0RXZlbnQod2F0Y2hlciwgam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZS1jb3B5JywgJ25ld0ZpbGUtMy50eHQnKSwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGNvbnN0IGNvcHlGdXR1cmU0ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBqb2luKHRlc3REaXIsICdkZWVwLW11bHRpcGxlLWNvcHknKSwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZXMuY29weShqb2luKHRlc3REaXIsICdkZWVwLW11bHRpcGxlJyksIGpvaW4odGVzdERpciwgJ2RlZXAtbXVsdGlwbGUtY29weScpLCB7IHByZXNlcnZlU3ltbGlua3M6IGZhbHNlIH0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2NvcHlGdXR1cmUxLCBjb3B5RnV0dXJlMiwgY29weUZ1dHVyZTMsIGNvcHlGdXR1cmU0XSk7XG5cblx0XHQvLyBtdWx0aXBsZSBkZWxldGUgKHNpbmdsZSBmaWxlcylcblxuXHRcdGNvbnN0IGRlbGV0ZUZ1dHVyZTEgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoMSwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0Y29uc3QgZGVsZXRlRnV0dXJlMiA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgyLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRjb25zdCBkZWxldGVGdXR1cmUzID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDMsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdGNvbnN0IGRlbGV0ZUZ1dHVyZTQgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIG5ld0ZpbGVQYXRoNCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCk7XG5cdFx0Y29uc3QgZGVsZXRlRnV0dXJlNSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGg1LCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblx0XHRjb25zdCBkZWxldGVGdXR1cmU2ID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdGaWxlUGF0aDYsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0YXdhaXQgcHJvbWlzZXMudW5saW5rKG5ld0ZpbGVQYXRoMSksXG5cdFx0XHRhd2FpdCBwcm9taXNlcy51bmxpbmsobmV3RmlsZVBhdGgyKSxcblx0XHRcdGF3YWl0IHByb21pc2VzLnVubGluayhuZXdGaWxlUGF0aDMpLFxuXHRcdFx0YXdhaXQgcHJvbWlzZXMudW5saW5rKG5ld0ZpbGVQYXRoNCksXG5cdFx0XHRhd2FpdCBwcm9taXNlcy51bmxpbmsobmV3RmlsZVBhdGg1KSxcblx0XHRcdGF3YWl0IHByb21pc2VzLnVubGluayhuZXdGaWxlUGF0aDYpXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChbZGVsZXRlRnV0dXJlMSwgZGVsZXRlRnV0dXJlMiwgZGVsZXRlRnV0dXJlMywgZGVsZXRlRnV0dXJlNCwgZGVsZXRlRnV0dXJlNSwgZGVsZXRlRnV0dXJlNl0pO1xuXG5cdFx0Ly8gbXVsdGlwbGUgZGVsZXRlIChmb2xkZXIpXG5cblx0XHRjb25zdCBkZWxldGVGb2xkZXJGdXR1cmUxID0gYXdhaXRFdmVudCh3YXRjaGVyLCBqb2luKHRlc3REaXIsICdkZWVwLW11bHRpcGxlJyksIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdGNvbnN0IGRlbGV0ZUZvbGRlckZ1dHVyZTIgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGpvaW4odGVzdERpciwgJ2RlZXAtbXVsdGlwbGUtY29weScpLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKTtcblxuXHRcdGF3YWl0IFByb21pc2UuYWxsKFtQcm9taXNlcy5ybShqb2luKHRlc3REaXIsICdkZWVwLW11bHRpcGxlJyksIFJpbVJhZk1vZGUuVU5MSU5LKSwgUHJvbWlzZXMucm0oam9pbih0ZXN0RGlyLCAnZGVlcC1tdWx0aXBsZS1jb3B5JyksIFJpbVJhZk1vZGUuVU5MSU5LKV0pO1xuXG5cdFx0YXdhaXQgUHJvbWlzZS5hbGwoW2RlbGV0ZUZvbGRlckZ1dHVyZTEsIGRlbGV0ZUZvbGRlckZ1dHVyZTJdKTtcblx0fSk7XG5cblx0dGVzdCgnc3Vic2VxdWVudCB3YXRjaCB1cGRhdGVzIHdhdGNoZXJzIChwYXRoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbam9pbihyZWFscGF0aFN5bmModGVzdERpciksICd1bnJlbGF0ZWQnKV0sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHQvLyBOZXcgZmlsZSAoKi50eHQpXG5cdFx0bGV0IG5ld1RleHRGaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbmV3RmlsZS50eHQnKTtcblx0XHRsZXQgY2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdUZXh0RmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3VGV4dEZpbGVQYXRoLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGpvaW4odGVzdERpciwgJ2RlZXAnKSwgZXhjbHVkZXM6IFtqb2luKHJlYWxwYXRoU3luYyh0ZXN0RGlyKSwgJ3VucmVsYXRlZCcpXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblx0XHRuZXdUZXh0RmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUyLnR4dCcpO1xuXHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3VGV4dEZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld1RleHRGaWxlUGF0aCwgJ0hlbGxvIFdvcmxkJyk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBqb2luKHRlc3REaXIsICdkZWVwJyksIGV4Y2x1ZGVzOiBbcmVhbHBhdGhTeW5jKHRlc3REaXIpXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGpvaW4odGVzdERpciwgJ2RlZXAnKSwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfV0pO1xuXHRcdG5ld1RleHRGaWxlUGF0aCA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbmV3RmlsZTMudHh0Jyk7XG5cdFx0Y2hhbmdlRnV0dXJlID0gYXdhaXRFdmVudCh3YXRjaGVyLCBuZXdUZXh0RmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3VGV4dEZpbGVQYXRoLCAnSGVsbG8gV29ybGQnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludmFsaWQgcGF0aCBkb2VzIG5vdCBjcmFzaCB3YXRjaGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW1xuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9LFxuXHRcdFx0eyBwYXRoOiBqb2luKHRlc3REaXIsICdpbnZhbGlkLWZvbGRlcicpLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9LFxuXHRcdFx0eyBwYXRoOiBGaWxlQWNjZXNzLmFzRmlsZVVyaSgnJykuZnNQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XG5cdFx0XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdWJzZXF1ZW50IHdhdGNoIHVwZGF0ZXMgd2F0Y2hlcnMgKGV4Y2x1ZGVzKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbcmVhbHBhdGhTeW5jKHRlc3REaXIpXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbmV3RmlsZS50eHQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N1YnNlcXVlbnQgd2F0Y2ggdXBkYXRlcyB3YXRjaGVycyAoaW5jbHVkZXMpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogWydub3RoaW5nJ10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlcyBhcmUgc3VwcG9ydGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogWycqKi9kZWVwLyoqJ10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlcyBhcmUgc3VwcG9ydGVkIChyZWxhdGl2ZSBwYXR0ZXJuIGV4cGxpY2l0KScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgaW5jbHVkZXM6IFt7IGJhc2U6IHRlc3REaXIsIHBhdHRlcm46ICdkZWVwL25ld0ZpbGUudHh0JyB9XSwgcmVjdXJzaXZlOiB0cnVlIH1dKTtcblxuXHRcdHJldHVybiBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbmV3RmlsZS50eHQnKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luY2x1ZGVzIGFyZSBzdXBwb3J0ZWQgKHJlbGF0aXZlIHBhdHRlcm4gaW1wbGljaXQpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogWydkZWVwL25ld0ZpbGUudHh0J10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNsdWRlcyBhcmUgc3VwcG9ydGVkIChwYXRoKScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGVzdEV4Y2x1ZGVzKFtqb2luKHJlYWxwYXRoU3luYyh0ZXN0RGlyKSwgJ2RlZXAnKV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNsdWRlcyBhcmUgc3VwcG9ydGVkIChnbG9iKScsIGZ1bmN0aW9uICgpIHtcblx0XHRyZXR1cm4gdGVzdEV4Y2x1ZGVzKFsnZGVlcC8qKiddKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdEV4Y2x1ZGVzKGV4Y2x1ZGVzOiBzdHJpbmdbXSkge1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXMsIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHQvLyBOZXcgZmlsZSAoKi50eHQpXG5cdFx0Y29uc3QgbmV3VGV4dEZpbGVQYXRoID0gam9pbih0ZXN0RGlyLCAnZGVlcCcsICduZXdGaWxlLnR4dCcpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3VGV4dEZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKG5ld1RleHRGaWxlUGF0aCwgJ0hlbGxvIFdvcmxkJyk7XG5cblx0XHRjb25zdCByZXMgPSBhd2FpdCBQcm9taXNlLmFueShbXG5cdFx0XHR0aW1lb3V0KDUwMCkudGhlbigoKSA9PiB0cnVlKSxcblx0XHRcdGNoYW5nZUZ1dHVyZS50aGVuKCgpID0+IGZhbHNlKVxuXHRcdF0pO1xuXG5cdFx0aWYgKCFyZXMpIHtcblx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGNoYW5nZSBldmVudCcpO1xuXHRcdH1cblx0fVxuXG5cdChpc1dpbmRvd3MgLyogd2luZG93czogY2Fubm90IGNyZWF0ZSBmaWxlIHN5bWJvbGljIGxpbmsgd2l0aG91dCBlbGV2YXRlZCBjb250ZXh0ICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3N5bWxpbmsgc3VwcG9ydCAocm9vdCknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgbGluayA9IGpvaW4odGVzdERpciwgJ2RlZXAtbGlua2VkJyk7XG5cdFx0Y29uc3QgbGlua1RhcmdldCA9IGpvaW4odGVzdERpciwgJ2RlZXAnKTtcblx0XHRhd2FpdCBwcm9taXNlcy5zeW1saW5rKGxpbmtUYXJnZXQsIGxpbmspO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBsaW5rLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKGxpbmssICduZXdGaWxlLnR4dCcpKTtcblx0fSk7XG5cblx0KGlzV2luZG93cyAvKiB3aW5kb3dzOiBjYW5ub3QgY3JlYXRlIGZpbGUgc3ltYm9saWMgbGluayB3aXRob3V0IGVsZXZhdGVkIGNvbnRleHQgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnc3ltbGluayBzdXBwb3J0ICh2aWEgZXh0cmEgd2F0Y2gpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGxpbmsgPSBqb2luKHRlc3REaXIsICdkZWVwLWxpbmtlZCcpO1xuXHRcdGNvbnN0IGxpbmtUYXJnZXQgPSBqb2luKHRlc3REaXIsICdkZWVwJyk7XG5cdFx0YXdhaXQgcHJvbWlzZXMuc3ltbGluayhsaW5rVGFyZ2V0LCBsaW5rKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfSwgeyBwYXRoOiBsaW5rLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKGxpbmssICduZXdGaWxlLnR4dCcpKTtcblx0fSk7XG5cblx0KCFpc1dpbmRvd3MgLyogVU5DIGlzIHdpbmRvd3Mgb25seSAqLyA/IHRlc3Quc2tpcCA6IHRlc3QpKCd1bmMgc3VwcG9ydCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhZGRVTkNIb3N0VG9BbGxvd2xpc3QoJ2xvY2FsaG9zdCcpO1xuXG5cdFx0Ly8gTG9jYWwgVU5DIHBhdGhzIGFyZSBpbiB0aGUgZm9ybSBvZjogXFxcXGxvY2FsaG9zdFxcYyRcXG15X2RpclxuXHRcdGNvbnN0IHVuY1BhdGggPSBgXFxcXFxcXFxsb2NhbGhvc3RcXFxcJHtnZXREcml2ZUxldHRlcih0ZXN0RGlyKT8udG9Mb3dlckNhc2UoKX0kXFxcXCR7bHRyaW0odGVzdERpci5zdWJzdHIodGVzdERpci5pbmRleE9mKCc6JykgKyAxKSwgJ1xcXFwnKX1gO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiB1bmNQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHVuY1BhdGgsICdkZWVwJywgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHQoaXNMaW51eCAvKiBsaW51eDogaXMgY2FzZSBzZW5zaXRpdmUgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnd3JvbmcgY2FzaW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGRlZXBXcm9uZ0Nhc2VkUGF0aCA9IGpvaW4odGVzdERpciwgJ0RFRVAnKTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZGVlcFdyb25nQ2FzZWRQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKGRlZXBXcm9uZ0Nhc2VkUGF0aCwgJ25ld0ZpbGUudHh0JykpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnZhbGlkIGZvbGRlciBkb2VzIG5vdCBleHBsb2RlJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGludmFsaWRQYXRoID0gam9pbih0ZXN0RGlyLCAnaW52YWxpZCcpO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBwYXRoOiBpbnZhbGlkUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfV0pO1xuXHR9KTtcblxuXHQoaXNXaW5kb3dzIC8qIGZsYWt5IG9uIHdpbmRvd3MgKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnZGVsZXRpbmcgd2F0Y2hlZCBwYXRoIHdpdGhvdXQgY29ycmVsYXRpb24gcmVzdGFydHMgd2F0Y2hpbmcnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgd2F0Y2hlZFBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJyk7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IHdhdGNoZWRQYXRoLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHQvLyBEZWxldGUgd2F0Y2hlZCBwYXRoIGFuZCBhd2FpdFxuXHRcdGNvbnN0IHdhcm5GdXR1cmUgPSBhd2FpdE1lc3NhZ2Uod2F0Y2hlciwgJ3dhcm4nKTtcblx0XHRhd2FpdCBQcm9taXNlcy5ybSh3YXRjaGVkUGF0aCwgUmltUmFmTW9kZS5VTkxJTkspO1xuXHRcdGF3YWl0IHdhcm5GdXR1cmU7XG5cblx0XHQvLyBSZXN0b3JlIHdhdGNoZWQgcGF0aFxuXHRcdGF3YWl0IHRpbWVvdXQoMTUwMCk7IC8vIG5vZGUuanMgd2F0Y2hlciB1c2VkIGZvciBtb25pdG9yaW5nIGZvbGRlciByZXN0b3JlIGlzIGFzeW5jXG5cdFx0YXdhaXQgcHJvbWlzZXMubWtkaXIod2F0Y2hlZFBhdGgpO1xuXHRcdGF3YWl0IHRpbWVvdXQoMTUwMCk7IC8vIHJlc3RhcnQgaXMgZGVsYXllZFxuXHRcdGF3YWl0IHdhdGNoZXIud2hlblJlYWR5KCk7XG5cblx0XHQvLyBWZXJpZnkgZXZlbnRzIGNvbWUgaW4gYWdhaW5cblx0XHRjb25zdCBuZXdGaWxlUGF0aCA9IGpvaW4od2F0Y2hlZFBhdGgsICduZXdGaWxlLnR4dCcpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgbmV3RmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUobmV3RmlsZVBhdGgsICdIZWxsbyBXb3JsZCcpO1xuXHRcdGF3YWl0IGNoYW5nZUZ1dHVyZTtcblx0fSk7XG5cblx0dGVzdCgnY29ycmVsYXRpb25JZCBpcyBzdXBwb3J0ZWQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgY29ycmVsYXRpb25JZCA9IE1hdGgucmFuZG9tKCk7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbeyBjb3JyZWxhdGlvbklkLCBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XSk7XG5cblx0XHRyZXR1cm4gYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICduZXdGaWxlLnR4dCcpLCBjb3JyZWxhdGlvbklkKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIG5vdCBleGNsdWRlIHJvb3RzIHRoYXQgZG8gbm90IG92ZXJsYXAnLCBhc3luYyAoKSA9PiB7XG5cdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCB3YXRjaGVyLnRlc3RSZW1vdmVEdXBsaWNhdGVSZXF1ZXN0cyhbJ0M6XFxcXGEnXSksIFsnQzpcXFxcYSddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWydDOlxcXFxhJywgJ0M6XFxcXGInXSksIFsnQzpcXFxcYScsICdDOlxcXFxiJ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCB3YXRjaGVyLnRlc3RSZW1vdmVEdXBsaWNhdGVSZXF1ZXN0cyhbJ0M6XFxcXGEnLCAnQzpcXFxcYicsICdDOlxcXFxjXFxcXGRcXFxcZSddKSwgWydDOlxcXFxhJywgJ0M6XFxcXGInLCAnQzpcXFxcY1xcXFxkXFxcXGUnXSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWycvYSddKSwgWycvYSddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWycvYScsICcvYiddKSwgWycvYScsICcvYiddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWycvYScsICcvYicsICcvYy9kL2UnXSksIFsnL2EnLCAnL2InLCAnL2MvZC9lJ10pO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIHJlbW92ZSBzdWItZm9sZGVycyBvZiBvdGhlciBwYXRocycsIGFzeW5jICgpID0+IHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHdhdGNoZXIudGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKFsnQzpcXFxcYScsICdDOlxcXFxhXFxcXGInXSksIFsnQzpcXFxcYSddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWydDOlxcXFxhJywgJ0M6XFxcXGInLCAnQzpcXFxcYVxcXFxiJ10pLCBbJ0M6XFxcXGEnLCAnQzpcXFxcYiddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWydDOlxcXFxiXFxcXGEnLCAnQzpcXFxcYScsICdDOlxcXFxiJywgJ0M6XFxcXGFcXFxcYiddKSwgWydDOlxcXFxhJywgJ0M6XFxcXGInXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHdhdGNoZXIudGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKFsnQzpcXFxcYScsICdDOlxcXFxhXFxcXGInLCAnQzpcXFxcYVxcXFxjXFxcXGQnXSksIFsnQzpcXFxcYSddKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCB3YXRjaGVyLnRlc3RSZW1vdmVEdXBsaWNhdGVSZXF1ZXN0cyhbJy9hJywgJy9hL2InXSksIFsnL2EnXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHdhdGNoZXIudGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKFsnL2EnLCAnL2InLCAnL2EvYiddKSwgWycvYScsICcvYiddKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgd2F0Y2hlci50ZXN0UmVtb3ZlRHVwbGljYXRlUmVxdWVzdHMoWycvYi9hJywgJy9hJywgJy9iJywgJy9hL2InXSksIFsnL2EnLCAnL2InXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHdhdGNoZXIudGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKFsnL2EnLCAnL2EvYicsICcvYS9jL2QnXSksIFsnL2EnXSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdzaG91bGQgaWdub3JlIHdoZW4gZXZlcnl0aGluZyBleGNsdWRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHdhdGNoZXIudGVzdFJlbW92ZUR1cGxpY2F0ZVJlcXVlc3RzKFsnL2Zvby9iYXInLCAnL2JhciddLCBbJyoqJywgJ3NvbWV0aGluZyddKSwgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCd3YXRjaGluZyBzYW1lIG9yIG92ZXJsYXBwaW5nIHBhdGhzIHN1cHBvcnRlZCB3aGVuIGNvcnJlbGF0aW9uIGlzIGFwcGxpZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbXG5cdFx0XHR7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAxIH1cblx0XHRdKTtcblxuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnbmV3RmlsZS50eHQnKSwgbnVsbCwgMSk7XG5cblx0XHQvLyBzYW1lIHBhdGgsIHNhbWUgb3B0aW9uc1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW1xuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSwgY29ycmVsYXRpb25JZDogMSB9LFxuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSwgY29ycmVsYXRpb25JZDogMiwgfSxcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IHVuZGVmaW5lZCB9XG5cdFx0XSk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ25ld0ZpbGUudHh0JyksIG51bGwsIDMpO1xuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnb3RoZXJOZXdGaWxlLnR4dCcpLCBudWxsLCAzKTtcblxuXHRcdC8vIHNhbWUgcGF0aCwgZGlmZmVyZW50IG9wdGlvbnNcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IDEgfSxcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IDIgfSxcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IHVuZGVmaW5lZCB9LFxuXHRcdFx0eyBwYXRoOiB0ZXN0RGlyLCBleGNsdWRlczogW2pvaW4ocmVhbHBhdGhTeW5jKHRlc3REaXIpLCAnZGVlcCcpXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAzIH0sXG5cdFx0XHR7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbam9pbihyZWFscGF0aFN5bmModGVzdERpciksICdvdGhlcicpXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiA0IH0sXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ25ld0ZpbGUudHh0JyksIG51bGwsIDUpO1xuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnb3RoZXJOZXdGaWxlLnR4dCcpLCBudWxsLCA1KTtcblxuXHRcdC8vIG92ZXJsYXBwaW5nIHBhdGhzIChzYW1lIG9wdGlvbnMpXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChbXG5cdFx0XHR7IHBhdGg6IGRpcm5hbWUodGVzdERpciksIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAxIH0sXG5cdFx0XHR7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAyIH0sXG5cdFx0XHR7IHBhdGg6IGpvaW4odGVzdERpciwgJ2RlZXAnKSwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IDMgfSxcblx0XHRdKTtcblxuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3Qoam9pbih0ZXN0RGlyLCAnZGVlcCcsICduZXdGaWxlLnR4dCcpLCBudWxsLCAzKTtcblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2RlZXAnLCAnb3RoZXJOZXdGaWxlLnR4dCcpLCBudWxsLCAzKTtcblxuXHRcdC8vIG92ZXJsYXBwaW5nIHBhdGhzIChkaWZmZXJlbnQgb3B0aW9ucylcblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFtcblx0XHRcdHsgcGF0aDogZGlybmFtZSh0ZXN0RGlyKSwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IDEgfSxcblx0XHRcdHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtqb2luKHJlYWxwYXRoU3luYyh0ZXN0RGlyKSwgJ3NvbWUnKV0sIHJlY3Vyc2l2ZTogdHJ1ZSwgY29ycmVsYXRpb25JZDogMiB9LFxuXHRcdFx0eyBwYXRoOiBqb2luKHRlc3REaXIsICdkZWVwJyksIGV4Y2x1ZGVzOiBbam9pbihyZWFscGF0aFN5bmModGVzdERpciksICdvdGhlcicpXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAzIH0sXG5cdFx0XSk7XG5cblx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbmV3RmlsZS50eHQnKSwgbnVsbCwgMyk7XG5cdFx0YXdhaXQgYmFzaWNDcnVkVGVzdChqb2luKHRlc3REaXIsICdkZWVwJywgJ290aGVyTmV3RmlsZS50eHQnKSwgbnVsbCwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dhdGNoaW5nIG1pc3NpbmcgcGF0aCBlbWl0cyB3YXRjaGVyIGZhaWwgZXZlbnQnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgb25EaWRXYXRjaEZhaWwgPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbldhdGNoRmFpbCk7XG5cblx0XHRjb25zdCBmb2xkZXJQYXRoID0gam9pbih0ZXN0RGlyLCAnbWlzc2luZycpO1xuXHRcdHdhdGNoZXIud2F0Y2goW3sgcGF0aDogZm9sZGVyUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfV0pO1xuXG5cdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0aW5nIHdhdGNoZWQgcGF0aCBlbWl0cyB3YXRjaGVyIGZhaWwgYW5kIGRlbGV0ZSBldmVudCBpZiBjb3JyZWxhdGVkJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZvbGRlclBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJyk7XG5cblx0XHRhd2FpdCB3YXRjaGVyLndhdGNoKFt7IHBhdGg6IGZvbGRlclBhdGgsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAxIH1dKTtcblxuXHRcdGxldCBmYWlsZWQgPSBmYWxzZTtcblx0XHRjb25zdCBpbnN0YW5jZSA9IEFycmF5LmZyb20od2F0Y2hlci53YXRjaGVycylbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluc3RhbmNlLmluY2x1ZGUoZm9sZGVyUGF0aCksIHRydWUpO1xuXHRcdGluc3RhbmNlLm9uRGlkRmFpbCgoKSA9PiBmYWlsZWQgPSB0cnVlKTtcblxuXHRcdGNvbnN0IG9uRGlkV2F0Y2hGYWlsID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25XYXRjaEZhaWwpO1xuXHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuREVMRVRFRCwgdW5kZWZpbmVkLCAxKTtcblx0XHRQcm9taXNlcy5ybShmb2xkZXJQYXRoLCBSaW1SYWZNb2RlLlVOTElOSyk7XG5cdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmYWlsZWQsIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnN0YW5jZS5mYWlsZWQsIHRydWUpO1xuXHR9KTtcblxuXHQoIWlzTWFjaW50b3NoIC8qIExpbnV4L1dpbmRvd3M6IHRpbWVzIG91dCBmb3Igc29tZSByZWFzb24gKi8gPyB0ZXN0LnNraXAgOiB0ZXN0KSgnd2F0Y2ggcmVxdWVzdHMgc3VwcG9ydCBzdXNwZW5kL3Jlc3VtZSAoZm9sZGVyLCBkb2VzIG5vdCBleGlzdCBpbiBiZWdpbm5pbmcsIG5vdCByZXVzaW5nIHdhdGNoZXIpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RXYXRjaEZvbGRlckRvZXNOb3RFeGlzdChmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dhdGNoIHJlcXVlc3RzIHN1cHBvcnQgc3VzcGVuZC9yZXN1bWUgKGZvbGRlciwgZG9lcyBub3QgZXhpc3QgaW4gYmVnaW5uaW5nLCByZXVzaW5nIHdhdGNoZXIpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RXYXRjaEZvbGRlckRvZXNOb3RFeGlzdCh0cnVlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdFdhdGNoRm9sZGVyRG9lc05vdEV4aXN0KHJldXNlRXhpc3RpbmdXYXRjaGVyOiBib29sZWFuKSB7XG5cdFx0bGV0IG9uRGlkV2F0Y2hGYWlsID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25XYXRjaEZhaWwpO1xuXG5cdFx0Y29uc3QgZm9sZGVyUGF0aCA9IGpvaW4odGVzdERpciwgJ25vdC1mb3VuZCcpO1xuXG5cdFx0Y29uc3QgcmVxdWVzdHM6IElSZWN1cnNpdmVXYXRjaFJlcXVlc3RbXSA9IFtdO1xuXHRcdGlmIChyZXVzZUV4aXN0aW5nV2F0Y2hlcikge1xuXHRcdFx0cmVxdWVzdHMucHVzaCh7IHBhdGg6IHRlc3REaXIsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlIH0pO1xuXHRcdFx0YXdhaXQgd2F0Y2hlci53YXRjaChyZXF1ZXN0cyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVxdWVzdDogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdCA9IHsgcGF0aDogZm9sZGVyUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfTtcblx0XHRyZXF1ZXN0cy5wdXNoKHJlcXVlc3QpO1xuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChyZXF1ZXN0cyk7XG5cdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cblx0XHRpZiAocmV1c2VFeGlzdGluZ1dhdGNoZXIpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3YXRjaGVyLmlzU3VzcGVuZGVkKHJlcXVlc3QpLCB0cnVlKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdhdGNoZXIuaXNTdXNwZW5kZWQocmVxdWVzdCksICdwb2xsaW5nJyk7XG5cdFx0fVxuXG5cdFx0bGV0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdGxldCBvbkRpZFdhdGNoID0gRXZlbnQudG9Qcm9taXNlKHdhdGNoZXIub25EaWRXYXRjaCk7XG5cdFx0YXdhaXQgcHJvbWlzZXMubWtkaXIoZm9sZGVyUGF0aCk7XG5cdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdGF3YWl0IG9uRGlkV2F0Y2g7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0KSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKGZvbGRlclBhdGgsICduZXdGaWxlLnR4dCcpO1xuXHRcdGF3YWl0IGJhc2ljQ3J1ZFRlc3QoZmlsZVBhdGgpO1xuXG5cdFx0aWYgKCFyZXVzZUV4aXN0aW5nV2F0Y2hlcikge1xuXHRcdFx0b25EaWRXYXRjaEZhaWwgPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbldhdGNoRmFpbCk7XG5cdFx0XHRhd2FpdCBQcm9taXNlcy5ybShmb2xkZXJQYXRoKTtcblx0XHRcdGF3YWl0IG9uRGlkV2F0Y2hGYWlsO1xuXG5cdFx0XHRjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZvbGRlclBhdGgsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKTtcblx0XHRcdG9uRGlkV2F0Y2ggPSBFdmVudC50b1Byb21pc2Uod2F0Y2hlci5vbkRpZFdhdGNoKTtcblx0XHRcdGF3YWl0IHByb21pc2VzLm1rZGlyKGZvbGRlclBhdGgpO1xuXHRcdFx0YXdhaXQgY2hhbmdlRnV0dXJlO1xuXHRcdFx0YXdhaXQgb25EaWRXYXRjaDtcblxuXHRcdFx0YXdhaXQgYmFzaWNDcnVkVGVzdChmaWxlUGF0aCk7XG5cdFx0fVxuXHR9XG5cblx0KCFpc01hY2ludG9zaCAvKiBMaW51eC9XaW5kb3dzOiB0aW1lcyBvdXQgZm9yIHNvbWUgcmVhc29uICovID8gdGVzdC5za2lwIDogdGVzdCkoJ3dhdGNoIHJlcXVlc3RzIHN1cHBvcnQgc3VzcGVuZC9yZXN1bWUgKGZvbGRlciwgZXhpc3QgaW4gYmVnaW5uaW5nLCBub3QgcmV1c2luZyB3YXRjaGVyKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0V2F0Y2hGb2xkZXJFeGlzdHMoZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCd3YXRjaCByZXF1ZXN0cyBzdXBwb3J0IHN1c3BlbmQvcmVzdW1lIChmb2xkZXIsIGV4aXN0IGluIGJlZ2lubmluZywgcmV1c2luZyB3YXRjaGVyKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0V2F0Y2hGb2xkZXJFeGlzdHModHJ1ZSk7XG5cdH0pO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHRlc3RXYXRjaEZvbGRlckV4aXN0cyhyZXVzZUV4aXN0aW5nV2F0Y2hlcjogYm9vbGVhbikge1xuXHRcdGNvbnN0IGZvbGRlclBhdGggPSBqb2luKHRlc3REaXIsICdkZWVwJyk7XG5cblx0XHRjb25zdCByZXF1ZXN0czogSVJlY3Vyc2l2ZVdhdGNoUmVxdWVzdFtdID0gW3sgcGF0aDogZm9sZGVyUGF0aCwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfV07XG5cdFx0aWYgKHJldXNlRXhpc3RpbmdXYXRjaGVyKSB7XG5cdFx0XHRyZXF1ZXN0cy5wdXNoKHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUgfSk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgd2F0Y2hlci53YXRjaChyZXF1ZXN0cyk7XG5cblx0XHRjb25zdCBmaWxlUGF0aCA9IGpvaW4oZm9sZGVyUGF0aCwgJ25ld0ZpbGUudHh0Jyk7XG5cdFx0YXdhaXQgYmFzaWNDcnVkVGVzdChmaWxlUGF0aCk7XG5cblx0XHRpZiAoIXJldXNlRXhpc3RpbmdXYXRjaGVyKSB7XG5cdFx0XHRjb25zdCBvbkRpZFdhdGNoRmFpbCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uV2F0Y2hGYWlsKTtcblx0XHRcdGF3YWl0IFByb21pc2VzLnJtKGZvbGRlclBhdGgpO1xuXHRcdFx0YXdhaXQgb25EaWRXYXRjaEZhaWw7XG5cblx0XHRcdGNvbnN0IGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZm9sZGVyUGF0aCwgRmlsZUNoYW5nZVR5cGUuQURERUQpO1xuXHRcdFx0Y29uc3Qgb25EaWRXYXRjaCA9IEV2ZW50LnRvUHJvbWlzZSh3YXRjaGVyLm9uRGlkV2F0Y2gpO1xuXHRcdFx0YXdhaXQgcHJvbWlzZXMubWtkaXIoZm9sZGVyUGF0aCk7XG5cdFx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdFx0XHRhd2FpdCBvbkRpZFdhdGNoO1xuXG5cdFx0XHRhd2FpdCBiYXNpY0NydWRUZXN0KGZpbGVQYXRoKTtcblx0XHR9XG5cdH1cblxuXHR0ZXN0KCd3YXRjaCByZXF1ZXN0IHJldXNlcyBhbm90aGVyIHJlY3Vyc2l2ZSB3YXRjaGVyIGV2ZW4gd2hlbiByZXF1ZXN0cyBhcmUgY29taW5nIGluIGF0IHRoZSBzYW1lIHRpbWUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgZm9sZGVyUGF0aDEgPSBqb2luKHRlc3REaXIsICdkZWVwJywgJ25vdC1leGlzdGluZzEnKTtcblx0XHRjb25zdCBmb2xkZXJQYXRoMiA9IGpvaW4odGVzdERpciwgJ2RlZXAnLCAnbm90LWV4aXN0aW5nMicpO1xuXHRcdGNvbnN0IGZvbGRlclBhdGgzID0gam9pbih0ZXN0RGlyLCAnbm90LWV4aXN0aW5nMycpO1xuXG5cdFx0Y29uc3QgcmVxdWVzdHM6IElSZWN1cnNpdmVXYXRjaFJlcXVlc3RbXSA9IFtcblx0XHRcdHsgcGF0aDogZm9sZGVyUGF0aDEsIGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiB0cnVlLCBjb3JyZWxhdGlvbklkOiAxIH0sXG5cdFx0XHR7IHBhdGg6IGZvbGRlclBhdGgyLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSwgY29ycmVsYXRpb25JZDogMiB9LFxuXHRcdFx0eyBwYXRoOiBmb2xkZXJQYXRoMywgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGNvcnJlbGF0aW9uSWQ6IDMgfSxcblx0XHRcdHsgcGF0aDogam9pbih0ZXN0RGlyLCAnZGVlcCcpLCBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogdHJ1ZSB9XG5cdFx0XTtcblxuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2gocmVxdWVzdHMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdhdGNoZXIuaXNTdXNwZW5kZWQocmVxdWVzdHNbMF0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0c1sxXSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3YXRjaGVyLmlzU3VzcGVuZGVkKHJlcXVlc3RzWzJdKSwgJ3BvbGxpbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod2F0Y2hlci5pc1N1c3BlbmRlZChyZXF1ZXN0c1szXSksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgdHlwZSBmaWx0ZXInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcmVxdWVzdCA9IHsgcGF0aDogdGVzdERpciwgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IHRydWUsIGZpbHRlcjogRmlsZUNoYW5nZUZpbHRlci5BRERFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuREVMRVRFRCwgY29ycmVsYXRpb25JZDogMSB9O1xuXHRcdGF3YWl0IHdhdGNoZXIud2F0Y2goW3JlcXVlc3RdKTtcblxuXHRcdC8vIENoYW5nZSBmaWxlXG5cdFx0Y29uc3QgZmlsZVBhdGggPSBqb2luKHRlc3REaXIsICdsb3JlbS1uZXdmaWxlLnR4dCcpO1xuXHRcdGxldCBjaGFuZ2VGdXR1cmUgPSBhd2FpdEV2ZW50KHdhdGNoZXIsIGZpbGVQYXRoLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCwgdW5kZWZpbmVkLCAxKTtcblx0XHRhd2FpdCBQcm9taXNlcy53cml0ZUZpbGUoZmlsZVBhdGgsICdIZWxsbyBDaGFuZ2UnKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cblx0XHQvLyBEZWxldGUgZmlsZVxuXHRcdGNoYW5nZUZ1dHVyZSA9IGF3YWl0RXZlbnQod2F0Y2hlciwgZmlsZVBhdGgsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQsIHVuZGVmaW5lZCwgMSk7XG5cdFx0YXdhaXQgcHJvbWlzZXMudW5saW5rKGZpbGVQYXRoKTtcblx0XHRhd2FpdCBjaGFuZ2VGdXR1cmU7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxjQUFjLGdCQUFnQjtBQUN2QyxTQUFTLGNBQWM7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsU0FBUyxZQUFZO0FBQzlCLFNBQVMsU0FBUyxhQUFhLGlCQUFpQjtBQUNoRCxTQUFTLFVBQVUsa0JBQWtCO0FBQ3JDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsa0JBQWtCLHNCQUFt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
