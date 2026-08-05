import assert from "assert";
import { isWindows } from "../../../../../base/common/platform.js";
import { insert } from "../../../../../base/common/arrays.js";
import { hash } from "../../../../../base/common/hash.js";
import { isEqual, joinPath, dirname } from "../../../../../base/common/resources.js";
import { join } from "../../../../../base/common/path.js";
import { URI } from "../../../../../base/common/uri.js";
import { WorkingCopyBackupsModel, hashIdentifier } from "../../common/workingCopyBackupService.js";
import { createTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { Schemas } from "../../../../../base/common/network.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { LogLevel, NullLogService } from "../../../../../platform/log/common/log.js";
import { NativeWorkbenchEnvironmentService } from "../../../environment/electron-sandbox/environmentService.js";
import { toBufferOrReadable } from "../../../textfile/common/textfiles.js";
import { NativeWorkingCopyBackupService } from "../../electron-sandbox/workingCopyBackupService.js";
import { FileUserDataProvider } from "../../../../../platform/userData/common/fileUserDataProvider.js";
import { bufferToReadable, bufferToStream, streamToBuffer, VSBuffer } from "../../../../../base/common/buffer.js";
import { TestLifecycleService, toTypedWorkingCopyId, toUntypedWorkingCopyId } from "../../../../test/browser/workbenchTestServices.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { consumeStream } from "../../../../../base/common/stream.js";
import { TestProductService } from "../../../../test/common/workbenchTestServices.js";
import { InMemoryFileSystemProvider } from "../../../../../platform/files/common/inMemoryFilesystemProvider.js";
import { generateUuid } from "../../../../../base/common/uuid.js";
import product from "../../../../../platform/product/common/product.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { UserDataProfilesService } from "../../../../../platform/userDataProfile/common/userDataProfile.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
const homeDir = URI.file("home").with({ scheme: Schemas.inMemory });
const tmpDir = URI.file("tmp").with({ scheme: Schemas.inMemory });
const NULL_PROFILE = {
  name: "",
  id: "",
  shortName: "",
  isDefault: false,
  location: homeDir,
  settingsResource: joinPath(homeDir, "settings.json"),
  globalStorageHome: joinPath(homeDir, "globalStorage"),
  keybindingsResource: joinPath(homeDir, "keybindings.json"),
  tasksResource: joinPath(homeDir, "tasks.json"),
  snippetsHome: joinPath(homeDir, "snippets"),
  promptsHome: joinPath(homeDir, "prompts"),
  extensionsResource: joinPath(homeDir, "extensions.json"),
  cacheHome: joinPath(homeDir, "cache")
};
const TestNativeWindowConfiguration = {
  windowId: 0,
  machineId: "testMachineId",
  sqmId: "testSqmId",
  devDeviceId: "testdevDeviceId",
  logLevel: LogLevel.Error,
  loggers: [],
  mainPid: 0,
  appRoot: "",
  userEnv: {},
  execPath: process.execPath,
  perfMarks: [],
  colorScheme: { dark: true, highContrast: false },
  os: { release: "unknown", hostname: "unknown", arch: "unknown" },
  product,
  homeDir: homeDir.fsPath,
  tmpDir: tmpDir.fsPath,
  userDataDir: joinPath(homeDir, product.nameShort).fsPath,
  profiles: { profile: NULL_PROFILE, all: [NULL_PROFILE], home: homeDir },
  nls: {
    messages: [],
    language: "en"
  },
  _: []
};
class TestNativeWorkbenchEnvironmentService extends NativeWorkbenchEnvironmentService {
  constructor(testDir, backupPath) {
    super({ ...TestNativeWindowConfiguration, backupPath: backupPath.fsPath, "user-data-dir": testDir.fsPath }, TestProductService);
  }
}
class NodeTestWorkingCopyBackupService extends NativeWorkingCopyBackupService {
  constructor(testDir, workspaceBackupPath) {
    const environmentService = new TestNativeWorkbenchEnvironmentService(testDir, workspaceBackupPath);
    const logService = new NullLogService();
    const fileService = new FileService(logService);
    const lifecycleService = new TestLifecycleService();
    super(environmentService, fileService, logService, lifecycleService);
    const fsp = new InMemoryFileSystemProvider();
    fileService.registerProvider(Schemas.inMemory, fsp);
    const uriIdentityService = new UriIdentityService(fileService);
    const userDataProfilesService = new UserDataProfilesService(environmentService, fileService, uriIdentityService, logService);
    fileService.registerProvider(Schemas.vscodeUserData, new FileUserDataProvider(Schemas.file, fsp, Schemas.vscodeUserData, userDataProfilesService, uriIdentityService, logService));
    this._fileService = fileService;
    this.backupResourceJoiners = [];
    this.discardBackupJoiners = [];
    this.discardedBackups = [];
    this.pendingBackupsArr = [];
    this.discardedAllBackups = false;
  }
  testGetFileService() {
    return this.fileService;
  }
  async waitForAllBackups() {
    await Promise.all(this.pendingBackupsArr);
  }
  joinBackupResource() {
    return new Promise((resolve) => this.backupResourceJoiners.push(resolve));
  }
  async backup(identifier, content, versionId, meta, token) {
    const p = super.backup(identifier, content, versionId, meta, token);
    const removeFromPendingBackups = insert(this.pendingBackupsArr, p.then(void 0, void 0));
    try {
      await p;
    } finally {
      removeFromPendingBackups();
    }
    while (this.backupResourceJoiners.length) {
      this.backupResourceJoiners.pop()();
    }
  }
  joinDiscardBackup() {
    return new Promise((resolve) => this.discardBackupJoiners.push(resolve));
  }
  async discardBackup(identifier) {
    await super.discardBackup(identifier);
    this.discardedBackups.push(identifier);
    while (this.discardBackupJoiners.length) {
      this.discardBackupJoiners.pop()();
    }
  }
  async discardBackups(filter) {
    this.discardedAllBackups = true;
    return super.discardBackups(filter);
  }
  async getBackupContents(identifier) {
    const backupResource = this.toBackupResource(identifier);
    const fileContents = await this.fileService.readFile(backupResource);
    return fileContents.value.toString();
  }
}
suite("WorkingCopyBackupService", () => {
  let testDir;
  let backupHome;
  let workspacesJsonPath;
  let workspaceBackupPath;
  let service;
  let fileService;
  const disposables = new DisposableStore();
  const workspaceResource = URI.file(isWindows ? "c:\\workspace" : "/workspace");
  const fooFile = URI.file(isWindows ? "c:\\Foo" : "/Foo");
  const customFile = URI.parse("customScheme://some/path");
  const customFileWithFragment = URI.parse("customScheme2://some/path#fragment");
  const barFile = URI.file(isWindows ? "c:\\Bar" : "/Bar");
  const fooBarFile = URI.file(isWindows ? "c:\\Foo Bar" : "/Foo Bar");
  const untitledFile = URI.from({ scheme: Schemas.untitled, path: "Untitled-1" });
  setup(async () => {
    testDir = URI.file(join(generateUuid(), "vsctests", "workingcopybackupservice")).with({ scheme: Schemas.inMemory });
    backupHome = joinPath(testDir, "Backups");
    workspacesJsonPath = joinPath(backupHome, "workspaces.json");
    workspaceBackupPath = joinPath(backupHome, hash(workspaceResource.fsPath).toString(16));
    service = disposables.add(new NodeTestWorkingCopyBackupService(testDir, workspaceBackupPath));
    fileService = service._fileService;
    await fileService.createFolder(backupHome);
    return fileService.writeFile(workspacesJsonPath, VSBuffer.fromString(""));
  });
  teardown(() => {
    disposables.clear();
  });
  suite("hashIdentifier", () => {
    test("should correctly hash the identifier for untitled scheme URIs", () => {
      const uri = URI.from({ scheme: Schemas.untitled, path: "Untitled-1" });
      const untypedBackupHash = hashIdentifier(toUntypedWorkingCopyId(uri));
      assert.strictEqual(untypedBackupHash, "-7f9c1a2e");
      assert.strictEqual(untypedBackupHash, hash(uri.fsPath).toString(16));
      const typedBackupHash = hashIdentifier({ typeId: "hashTest", resource: uri });
      if (isWindows) {
        assert.strictEqual(typedBackupHash, "-17c47cdc");
      } else {
        assert.strictEqual(typedBackupHash, "-8ad5f4f");
      }
      assert.notStrictEqual(untypedBackupHash, typedBackupHash);
    });
    test("should correctly hash the identifier for file scheme URIs", () => {
      const uri = URI.file("/foo");
      const untypedBackupHash = hashIdentifier(toUntypedWorkingCopyId(uri));
      if (isWindows) {
        assert.strictEqual(untypedBackupHash, "20ffaa13");
      } else {
        assert.strictEqual(untypedBackupHash, "20eb3560");
      }
      assert.strictEqual(untypedBackupHash, hash(uri.fsPath).toString(16));
      const typedBackupHash = hashIdentifier({ typeId: "hashTest", resource: uri });
      if (isWindows) {
        assert.strictEqual(typedBackupHash, "-55fc55db");
      } else {
        assert.strictEqual(typedBackupHash, "51e56bf");
      }
      assert.notStrictEqual(untypedBackupHash, typedBackupHash);
    });
    test("should correctly hash the identifier for custom scheme URIs", () => {
      const uri = URI.from({
        scheme: "vscode-custom",
        path: "somePath"
      });
      const untypedBackupHash = hashIdentifier(toUntypedWorkingCopyId(uri));
      assert.strictEqual(untypedBackupHash, "-44972d98");
      assert.strictEqual(untypedBackupHash, hash(uri.toString()).toString(16));
      const typedBackupHash = hashIdentifier({ typeId: "hashTest", resource: uri });
      assert.strictEqual(typedBackupHash, "502149c7");
      assert.notStrictEqual(untypedBackupHash, typedBackupHash);
    });
    test("should not fail for URIs without path", () => {
      const uri = URI.from({
        scheme: "vscode-fragment",
        fragment: "frag"
      });
      const untypedBackupHash = hashIdentifier(toUntypedWorkingCopyId(uri));
      assert.strictEqual(untypedBackupHash, "-2f6b2f1b");
      assert.strictEqual(untypedBackupHash, hash(uri.toString()).toString(16));
      const typedBackupHash = hashIdentifier({ typeId: "hashTest", resource: uri });
      assert.strictEqual(typedBackupHash, "6e82ca57");
      assert.notStrictEqual(untypedBackupHash, typedBackupHash);
    });
  });
  suite("getBackupResource", () => {
    test("should get the correct backup path for text files", () => {
      const backupResource = fooFile;
      const workspaceHash = hash(workspaceResource.fsPath).toString(16);
      let backupId = toUntypedWorkingCopyId(backupResource);
      let filePathHash = hashIdentifier(backupId);
      let expectedPath = joinPath(backupHome, workspaceHash, Schemas.file, filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
      backupId = toTypedWorkingCopyId(backupResource);
      filePathHash = hashIdentifier(backupId);
      expectedPath = joinPath(backupHome, workspaceHash, Schemas.file, filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
    });
    test("should get the correct backup path for untitled files", () => {
      const backupResource = URI.from({ scheme: Schemas.untitled, path: "Untitled-1" });
      const workspaceHash = hash(workspaceResource.fsPath).toString(16);
      let backupId = toUntypedWorkingCopyId(backupResource);
      let filePathHash = hashIdentifier(backupId);
      let expectedPath = joinPath(backupHome, workspaceHash, Schemas.untitled, filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
      backupId = toTypedWorkingCopyId(backupResource);
      filePathHash = hashIdentifier(backupId);
      expectedPath = joinPath(backupHome, workspaceHash, Schemas.untitled, filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
    });
    test("should get the correct backup path for custom files", () => {
      const backupResource = URI.from({ scheme: "custom", path: "custom/file.txt" });
      const workspaceHash = hash(workspaceResource.fsPath).toString(16);
      let backupId = toUntypedWorkingCopyId(backupResource);
      let filePathHash = hashIdentifier(backupId);
      let expectedPath = joinPath(backupHome, workspaceHash, "custom", filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
      backupId = toTypedWorkingCopyId(backupResource);
      filePathHash = hashIdentifier(backupId);
      expectedPath = joinPath(backupHome, workspaceHash, "custom", filePathHash).with({ scheme: Schemas.vscodeUserData }).toString();
      assert.strictEqual(service.toBackupResource(backupId).toString(), expectedPath);
    });
  });
  suite("backup", () => {
    function toExpectedPreamble(identifier, content = "", meta) {
      return `${identifier.resource.toString()} ${JSON.stringify({ ...meta, typeId: identifier.typeId })}
${content}`;
    }
    test("joining", async () => {
      let backupJoined = false;
      const joinBackupsPromise = service.joinBackups();
      joinBackupsPromise.then(() => backupJoined = true);
      await joinBackupsPromise;
      assert.strictEqual(backupJoined, true);
      backupJoined = false;
      service.joinBackups().then(() => backupJoined = true);
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const backupPromise = service.backup(identifier);
      assert.strictEqual(backupJoined, false);
      await backupPromise;
      assert.strictEqual(backupJoined, true);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("no text", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("text file", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test"));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("text file (with version)", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")), 666);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test"));
      assert.ok(!service.hasBackupSync(identifier, 555));
      assert.ok(service.hasBackupSync(identifier, 666));
    });
    test("text file (with meta)", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const meta = { etag: "678", orphaned: true };
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")), void 0, meta);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test", meta));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("text file with whitespace in name and type (with meta)", async () => {
      const fileWithSpace = URI.file(isWindows ? "c:\\Foo \n Bar" : "/Foo \n Bar");
      const identifier = toTypedWorkingCopyId(fileWithSpace, " test id \n");
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const meta = { etag: "678 \n k", orphaned: true };
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")), void 0, meta);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test", meta));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("text file with unicode character in name and type (with meta)", async () => {
      const fileWithUnicode = URI.file(isWindows ? "c:\\so\u{12005}me\u0804" : "/so\u{12005}me\u0804");
      const identifier = toTypedWorkingCopyId(fileWithUnicode, " test so\u{12005}me\u0804 id \n");
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const meta = { etag: "678so\u{12005}me\u0804", orphaned: true };
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")), void 0, meta);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test", meta));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("untitled file", async () => {
      const identifier = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test"));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("text file (readable)", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const model = createTextModel("test");
      await service.backup(identifier, toBufferOrReadable(model.createSnapshot()));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test"));
      assert.ok(service.hasBackupSync(identifier));
      model.dispose();
    });
    test("untitled file (readable)", async () => {
      const identifier = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const model = createTextModel("test");
      await service.backup(identifier, toBufferOrReadable(model.createSnapshot()));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, "test"));
      model.dispose();
    });
    test("text file (large file, stream)", () => {
      const largeString = new Array(30 * 1024).join("Large String\n");
      return testLargeTextFile(largeString, bufferToStream(VSBuffer.fromString(largeString)));
    });
    test("text file (large file, readable)", async () => {
      const largeString = new Array(30 * 1024).join("Large String\n");
      const model = createTextModel(largeString);
      await testLargeTextFile(largeString, toBufferOrReadable(model.createSnapshot()));
      model.dispose();
    });
    async function testLargeTextFile(largeString, buffer) {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, buffer, void 0, { largeTest: true });
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, largeString, { largeTest: true }));
      assert.ok(service.hasBackupSync(identifier));
    }
    test("untitled file (large file, readable)", async () => {
      const identifier = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const largeString = new Array(30 * 1024).join("Large String\n");
      const model = createTextModel(largeString);
      await service.backup(identifier, toBufferOrReadable(model.createSnapshot()));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier, largeString));
      assert.ok(service.hasBackupSync(identifier));
      model.dispose();
    });
    test("cancellation", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const cts = new CancellationTokenSource();
      const promise = service.backup(identifier, void 0, void 0, void 0, cts.token);
      cts.cancel();
      await promise;
      assert.strictEqual(await fileService.exists(backupPath), false);
      assert.ok(!service.hasBackupSync(identifier));
    });
    test("multiple", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await Promise.all([
        service.backup(identifier),
        service.backup(identifier),
        service.backup(identifier),
        service.backup(identifier)
      ]);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.readFile(backupPath)).value.toString(), toExpectedPreamble(identifier));
      assert.ok(service.hasBackupSync(identifier));
    });
    test("multiple same resource, different type id", async () => {
      const backupId1 = toUntypedWorkingCopyId(fooFile);
      const backupId2 = toTypedWorkingCopyId(fooFile, "type1");
      const backupId3 = toTypedWorkingCopyId(fooFile, "type2");
      await Promise.all([
        service.backup(backupId1),
        service.backup(backupId2),
        service.backup(backupId3)
      ]);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 3);
      for (const backupId of [backupId1, backupId2, backupId3]) {
        const fooBackupPath = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
        assert.strictEqual(await fileService.exists(fooBackupPath), true);
        assert.strictEqual((await fileService.readFile(fooBackupPath)).value.toString(), toExpectedPreamble(backupId));
        assert.ok(service.hasBackupSync(backupId));
      }
    });
  });
  suite("discardBackup", () => {
    test("joining", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.ok(service.hasBackupSync(identifier));
      let backupJoined = false;
      service.joinBackups().then(() => backupJoined = true);
      const discardBackupPromise = service.discardBackup(identifier);
      assert.strictEqual(backupJoined, false);
      await discardBackupPromise;
      assert.strictEqual(backupJoined, true);
      assert.strictEqual(await fileService.exists(backupPath), false);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 0);
      assert.ok(!service.hasBackupSync(identifier));
    });
    test("text file", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      assert.ok(service.hasBackupSync(identifier));
      await service.discardBackup(identifier);
      assert.strictEqual(await fileService.exists(backupPath), false);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 0);
      assert.ok(!service.hasBackupSync(identifier));
    });
    test("untitled file", async () => {
      const identifier = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      await service.discardBackup(identifier);
      assert.strictEqual(await fileService.exists(backupPath), false);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 0);
    });
    test("multiple same resource, different type id", async () => {
      const backupId1 = toUntypedWorkingCopyId(fooFile);
      const backupId2 = toTypedWorkingCopyId(fooFile, "type1");
      const backupId3 = toTypedWorkingCopyId(fooFile, "type2");
      await Promise.all([
        service.backup(backupId1),
        service.backup(backupId2),
        service.backup(backupId3)
      ]);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 3);
      for (const backupId of [backupId1, backupId2, backupId3]) {
        const backupPath = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
        await service.discardBackup(backupId);
        assert.strictEqual(await fileService.exists(backupPath), false);
      }
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 0);
    });
  });
  suite("discardBackups (all)", () => {
    test("text file", async () => {
      const backupId1 = toUntypedWorkingCopyId(fooFile);
      const backupId2 = toUntypedWorkingCopyId(barFile);
      const backupId3 = toTypedWorkingCopyId(barFile);
      await service.backup(backupId1, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      await service.backup(backupId2, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 2);
      await service.backup(backupId3, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 3);
      await service.discardBackups();
      for (const backupId of [backupId1, backupId2, backupId3]) {
        const backupPath = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
        assert.strictEqual(await fileService.exists(backupPath), false);
      }
      assert.strictEqual(await fileService.exists(joinPath(workspaceBackupPath, "file")), false);
    });
    test("untitled file", async () => {
      const backupId = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
      await service.backup(backupId, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      await service.discardBackups();
      assert.strictEqual(await fileService.exists(backupPath), false);
      assert.strictEqual(await fileService.exists(joinPath(workspaceBackupPath, "untitled")), false);
    });
    test("can backup after discarding all", async () => {
      await service.discardBackups();
      await service.backup(toUntypedWorkingCopyId(untitledFile), bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual(await fileService.exists(workspaceBackupPath), true);
    });
  });
  suite("discardBackups (except some)", () => {
    test("text file", async () => {
      const backupId1 = toUntypedWorkingCopyId(fooFile);
      const backupId2 = toUntypedWorkingCopyId(barFile);
      const backupId3 = toTypedWorkingCopyId(barFile);
      await service.backup(backupId1, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 1);
      await service.backup(backupId2, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 2);
      await service.backup(backupId3, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "file"))).children?.length, 3);
      await service.discardBackups({ except: [backupId2, backupId3] });
      let backupPath = joinPath(workspaceBackupPath, backupId1.resource.scheme, hashIdentifier(backupId1));
      assert.strictEqual(await fileService.exists(backupPath), false);
      backupPath = joinPath(workspaceBackupPath, backupId2.resource.scheme, hashIdentifier(backupId2));
      assert.strictEqual(await fileService.exists(backupPath), true);
      backupPath = joinPath(workspaceBackupPath, backupId3.resource.scheme, hashIdentifier(backupId3));
      assert.strictEqual(await fileService.exists(backupPath), true);
      await service.discardBackups({ except: [backupId1] });
      for (const backupId of [backupId1, backupId2, backupId3]) {
        const backupPath2 = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
        assert.strictEqual(await fileService.exists(backupPath2), false);
      }
    });
    test("untitled file", async () => {
      const backupId = toUntypedWorkingCopyId(untitledFile);
      const backupPath = joinPath(workspaceBackupPath, backupId.resource.scheme, hashIdentifier(backupId));
      await service.backup(backupId, bufferToReadable(VSBuffer.fromString("test")));
      assert.strictEqual(await fileService.exists(backupPath), true);
      assert.strictEqual((await fileService.resolve(joinPath(workspaceBackupPath, "untitled"))).children?.length, 1);
      await service.discardBackups({ except: [backupId] });
      assert.strictEqual(await fileService.exists(backupPath), true);
    });
  });
  suite("getBackups", () => {
    test("text file", async () => {
      await Promise.all([
        service.backup(toUntypedWorkingCopyId(fooFile), bufferToReadable(VSBuffer.fromString("test"))),
        service.backup(toTypedWorkingCopyId(fooFile, "type1"), bufferToReadable(VSBuffer.fromString("test"))),
        service.backup(toTypedWorkingCopyId(fooFile, "type2"), bufferToReadable(VSBuffer.fromString("test")))
      ]);
      let backups = await service.getBackups();
      assert.strictEqual(backups.length, 3);
      for (const backup of backups) {
        if (backup.typeId === "") {
          assert.strictEqual(backup.resource.toString(), fooFile.toString());
        } else if (backup.typeId === "type1") {
          assert.strictEqual(backup.resource.toString(), fooFile.toString());
        } else if (backup.typeId === "type2") {
          assert.strictEqual(backup.resource.toString(), fooFile.toString());
        } else {
          assert.fail("Unexpected backup");
        }
      }
      await service.backup(toUntypedWorkingCopyId(barFile), bufferToReadable(VSBuffer.fromString("test")));
      backups = await service.getBackups();
      assert.strictEqual(backups.length, 4);
    });
    test("untitled file", async () => {
      await Promise.all([
        service.backup(toUntypedWorkingCopyId(untitledFile), bufferToReadable(VSBuffer.fromString("test"))),
        service.backup(toTypedWorkingCopyId(untitledFile, "type1"), bufferToReadable(VSBuffer.fromString("test"))),
        service.backup(toTypedWorkingCopyId(untitledFile, "type2"), bufferToReadable(VSBuffer.fromString("test")))
      ]);
      const backups = await service.getBackups();
      assert.strictEqual(backups.length, 3);
      for (const backup of backups) {
        if (backup.typeId === "") {
          assert.strictEqual(backup.resource.toString(), untitledFile.toString());
        } else if (backup.typeId === "type1") {
          assert.strictEqual(backup.resource.toString(), untitledFile.toString());
        } else if (backup.typeId === "type2") {
          assert.strictEqual(backup.resource.toString(), untitledFile.toString());
        } else {
          assert.fail("Unexpected backup");
        }
      }
    });
  });
  suite("resolve", () => {
    test("should restore the original contents (untitled file)", async () => {
      const contents = "test\nand more stuff";
      await testResolveBackup(untitledFile, contents);
    });
    test("should restore the original contents (untitled file with metadata)", async () => {
      const contents = "test\nand more stuff";
      const meta = {
        etag: "the Etag",
        size: 666,
        mtime: Date.now(),
        orphaned: true
      };
      await testResolveBackup(untitledFile, contents, meta);
    });
    test("should restore the original contents (untitled file empty with metadata)", async () => {
      const contents = "";
      const meta = {
        etag: "the Etag",
        size: 666,
        mtime: Date.now(),
        orphaned: true
      };
      await testResolveBackup(untitledFile, contents, meta);
    });
    test("should restore the original contents (untitled large file with metadata)", async () => {
      const contents = new Array(30 * 1024).join("Large String\n");
      const meta = {
        etag: "the Etag",
        size: 666,
        mtime: Date.now(),
        orphaned: true
      };
      await testResolveBackup(untitledFile, contents, meta);
    });
    test("should restore the original contents (text file)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "consectetur ",
        "adipiscing \xDF\xDF elit"
      ].join("");
      await testResolveBackup(fooFile, contents);
    });
    test("should restore the original contents (text file - custom scheme)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "consectetur ",
        "adipiscing \xDF\xDF elit"
      ].join("");
      await testResolveBackup(customFile, contents);
    });
    test("should restore the original contents (text file with metadata)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooFile, contents, meta);
    });
    test("should restore the original contents (empty text file with metadata)", async () => {
      const contents = "";
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooFile, contents, meta);
    });
    test("should restore the original contents (large text file with metadata)", async () => {
      const contents = new Array(30 * 1024).join("Large String\n");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooFile, contents, meta);
    });
    test("should restore the original contents (text file with metadata changed once)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooFile, contents, meta);
      meta.size = 999;
      await testResolveBackup(fooFile, contents, meta);
    });
    test("should restore the original contents (text file with metadata and fragment URI)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(customFileWithFragment, contents, meta);
    });
    test("should restore the original contents (text file with space in name with metadata)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooBarFile, contents, meta);
    });
    test("should restore the original contents (text file with too large metadata to persist)", async () => {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: new Array(100 * 1024).join("Large String"),
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await testResolveBackup(fooFile, contents, meta, true);
    });
    async function testResolveBackup(resource, contents, meta, expectNoMeta) {
      await doTestResolveBackup(toUntypedWorkingCopyId(resource), contents, meta, expectNoMeta);
      await doTestResolveBackup(toTypedWorkingCopyId(resource), contents, meta, expectNoMeta);
    }
    async function doTestResolveBackup(identifier, contents, meta, expectNoMeta) {
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString(contents)), 1, meta);
      const backup = await service.resolve(identifier);
      assert.ok(backup);
      assert.strictEqual(contents, (await streamToBuffer(backup.value)).toString());
      if (expectNoMeta || !meta) {
        assert.strictEqual(backup.meta, void 0);
      } else {
        assert.ok(backup.meta);
        assert.strictEqual(backup.meta.etag, meta.etag);
        assert.strictEqual(backup.meta.size, meta.size);
        assert.strictEqual(backup.meta.mtime, meta.mtime);
        assert.strictEqual(backup.meta.orphaned, meta.orphaned);
        assert.strictEqual(Object.keys(meta).length, Object.keys(backup.meta).length);
      }
    }
    test("should restore the original contents (text file with broken metadata)", async () => {
      await testShouldRestoreOriginalContentsWithBrokenBackup(toUntypedWorkingCopyId(fooFile));
      await testShouldRestoreOriginalContentsWithBrokenBackup(toTypedWorkingCopyId(fooFile));
    });
    async function testShouldRestoreOriginalContentsWithBrokenBackup(identifier) {
      const contents = [
        "Lorem ipsum ",
        "dolor \xF6\xE4\xFC sit amet ",
        "adipiscing \xDF\xDF elit",
        "consectetur "
      ].join("");
      const meta = {
        etag: "theEtag",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString(contents)), 1, meta);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const fileContents = (await fileService.readFile(backupPath)).value.toString();
      assert.strictEqual(fileContents.indexOf(identifier.resource.toString()), 0);
      const metaIndex = fileContents.indexOf("{");
      const newFileContents = fileContents.substring(0, metaIndex) + "{{" + fileContents.substr(metaIndex);
      await fileService.writeFile(backupPath, VSBuffer.fromString(newFileContents));
      const backup = await service.resolve(identifier);
      assert.ok(backup);
      assert.strictEqual(contents, (await streamToBuffer(backup.value)).toString());
      assert.strictEqual(backup.meta, void 0);
    }
    test("should update metadata from file into model when resolving", async () => {
      await testShouldUpdateMetaFromFileWhenResolving(toUntypedWorkingCopyId(fooFile));
      await testShouldUpdateMetaFromFileWhenResolving(toTypedWorkingCopyId(fooFile));
    });
    async function testShouldUpdateMetaFromFileWhenResolving(identifier) {
      const contents = "Foo Bar";
      const meta = {
        etag: "theEtagForThisMetadataTest",
        size: 888,
        mtime: Date.now(),
        orphaned: false
      };
      const updatedMeta = {
        ...meta,
        etag: meta.etag + meta.etag
      };
      await service.backup(identifier, bufferToReadable(VSBuffer.fromString(contents)), 1, meta);
      const backupPath = joinPath(workspaceBackupPath, identifier.resource.scheme, hashIdentifier(identifier));
      const originalFileContents = (await fileService.readFile(backupPath)).value.toString();
      await fileService.writeFile(backupPath, VSBuffer.fromString(originalFileContents.replace(meta.etag, updatedMeta.etag)));
      await service.resolve(identifier);
      assert.strictEqual(service.hasBackupSync(identifier, void 0, meta), false);
      assert.strictEqual(service.hasBackupSync(identifier, void 0, updatedMeta), true);
      await fileService.writeFile(backupPath, VSBuffer.fromString(originalFileContents));
      await service.getBackups();
      assert.strictEqual(service.hasBackupSync(identifier, void 0, meta), true);
      assert.strictEqual(service.hasBackupSync(identifier, void 0, updatedMeta), false);
    }
    test("should ignore invalid backups (empty file)", async () => {
      const contents = "test\nand more stuff";
      await service.backup(toUntypedWorkingCopyId(fooFile), bufferToReadable(VSBuffer.fromString(contents)), 1);
      let backup = await service.resolve(toUntypedWorkingCopyId(fooFile));
      assert.ok(backup);
      await service.testGetFileService().writeFile(service.toBackupResource(toUntypedWorkingCopyId(fooFile)), VSBuffer.fromString(""));
      backup = await service.resolve(toUntypedWorkingCopyId(fooFile));
      assert.ok(!backup);
    });
    test("should ignore invalid backups (no preamble)", async () => {
      const contents = "testand more stuff";
      await service.backup(toUntypedWorkingCopyId(fooFile), bufferToReadable(VSBuffer.fromString(contents)), 1);
      let backup = await service.resolve(toUntypedWorkingCopyId(fooFile));
      assert.ok(backup);
      await service.testGetFileService().writeFile(service.toBackupResource(toUntypedWorkingCopyId(fooFile)), VSBuffer.fromString(contents));
      backup = await service.resolve(toUntypedWorkingCopyId(fooFile));
      assert.ok(!backup);
    });
    test("file with binary data", async () => {
      const identifier = toUntypedWorkingCopyId(fooFile);
      const buffer = Uint8Array.from([
        137,
        80,
        78,
        71,
        13,
        10,
        26,
        10,
        0,
        0,
        0,
        13,
        73,
        72,
        68,
        82,
        0,
        0,
        0,
        73,
        0,
        0,
        0,
        67,
        8,
        2,
        0,
        0,
        0,
        95,
        138,
        191,
        237,
        0,
        0,
        0,
        1,
        115,
        82,
        71,
        66,
        0,
        174,
        206,
        28,
        233,
        0,
        0,
        0,
        4,
        103,
        65,
        77,
        65,
        0,
        0,
        177,
        143,
        11,
        252,
        97,
        5,
        0,
        0,
        0,
        9,
        112,
        72,
        89,
        115,
        0,
        0,
        14,
        195,
        0,
        0,
        14,
        195,
        1,
        199,
        111,
        168,
        100,
        0,
        0,
        0,
        71,
        116,
        69,
        88,
        116,
        83,
        111,
        117,
        114,
        99,
        101,
        0,
        83,
        104,
        111,
        116,
        116,
        121,
        32,
        118,
        50,
        46,
        48,
        46,
        50,
        46,
        50,
        49,
        54,
        32,
        40,
        67,
        41,
        32,
        84,
        104,
        111,
        109,
        97,
        115,
        32,
        66,
        97,
        117,
        109,
        97,
        110,
        110,
        32,
        45,
        32,
        104,
        116,
        116,
        112,
        58,
        47,
        47,
        115,
        104,
        111,
        116,
        116,
        121,
        46,
        100,
        101,
        118,
        115,
        45,
        111,
        110,
        46,
        110,
        101,
        116,
        44,
        132,
        21,
        213,
        0,
        0,
        0,
        84,
        73,
        68,
        65,
        84,
        120,
        218,
        237,
        207,
        65,
        17,
        0,
        0,
        12,
        2,
        32,
        211,
        217,
        63,
        146,
        37,
        246,
        218,
        65,
        3,
        210,
        191,
        226,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        230,
        118,
        100,
        169,
        4,
        173,
        8,
        44,
        248,
        184,
        40,
        0,
        0,
        0,
        0,
        73,
        69,
        78,
        68,
        174,
        66,
        96,
        130
      ]);
      await service.backup(identifier, bufferToReadable(VSBuffer.wrap(buffer)), void 0, { binaryTest: "true" });
      const backup = await service.resolve(toUntypedWorkingCopyId(fooFile));
      assert.ok(backup);
      const backupBuffer = await consumeStream(backup.value, (chunks) => VSBuffer.concat(chunks));
      assert.strictEqual(backupBuffer.buffer.byteLength, buffer.byteLength);
    });
  });
  suite("WorkingCopyBackupsModel", () => {
    test("simple", async () => {
      const model = await WorkingCopyBackupsModel.create(workspaceBackupPath, service.testGetFileService());
      const resource1 = URI.file("test.html");
      assert.strictEqual(model.has(resource1), false);
      model.add(resource1);
      assert.strictEqual(model.has(resource1), true);
      assert.strictEqual(model.has(resource1, 0), true);
      assert.strictEqual(model.has(resource1, 1), false);
      assert.strictEqual(model.has(resource1, 1, { foo: "bar" }), false);
      model.remove(resource1);
      assert.strictEqual(model.has(resource1), false);
      model.add(resource1);
      assert.strictEqual(model.has(resource1), true);
      assert.strictEqual(model.has(resource1, 0), true);
      assert.strictEqual(model.has(resource1, 1), false);
      model.clear();
      assert.strictEqual(model.has(resource1), false);
      model.add(resource1, 1);
      assert.strictEqual(model.has(resource1), true);
      assert.strictEqual(model.has(resource1, 0), false);
      assert.strictEqual(model.has(resource1, 1), true);
      const resource2 = URI.file("test1.html");
      const resource3 = URI.file("test2.html");
      const resource4 = URI.file("test3.html");
      model.add(resource2);
      model.add(resource3);
      model.add(resource4, void 0, { foo: "bar" });
      assert.strictEqual(model.has(resource1), true);
      assert.strictEqual(model.has(resource2), true);
      assert.strictEqual(model.has(resource3), true);
      assert.strictEqual(model.has(resource4), true);
      assert.strictEqual(model.has(resource4, void 0, { foo: "bar" }), true);
      assert.strictEqual(model.has(resource4, void 0, { bar: "foo" }), false);
      model.update(resource4, { foo: "nothing" });
      assert.strictEqual(model.has(resource4, void 0, { foo: "nothing" }), true);
      assert.strictEqual(model.has(resource4, void 0, { foo: "bar" }), false);
      model.update(resource4);
      assert.strictEqual(model.has(resource4), true);
      assert.strictEqual(model.has(resource4, void 0, { foo: "nothing" }), false);
    });
    test("create", async () => {
      const fooBackupPath = joinPath(workspaceBackupPath, fooFile.scheme, hashIdentifier(toUntypedWorkingCopyId(fooFile)));
      await fileService.createFolder(dirname(fooBackupPath));
      await fileService.writeFile(fooBackupPath, VSBuffer.fromString("foo"));
      const model = await WorkingCopyBackupsModel.create(workspaceBackupPath, service.testGetFileService());
      assert.strictEqual(model.has(fooBackupPath), true);
    });
    test("get", async () => {
      const model = await WorkingCopyBackupsModel.create(workspaceBackupPath, service.testGetFileService());
      assert.deepStrictEqual(model.get(), []);
      const file1 = URI.file("/root/file/foo.html");
      const file2 = URI.file("/root/file/bar.html");
      const untitled = URI.file("/root/untitled/bar.html");
      model.add(file1);
      model.add(file2);
      model.add(untitled);
      assert.deepStrictEqual(model.get().map((f) => f.fsPath), [file1.fsPath, file2.fsPath, untitled.fsPath]);
    });
  });
  suite("typeId migration", () => {
    test("works (when meta is missing)", async () => {
      const fooBackupId = toUntypedWorkingCopyId(fooFile);
      const untitledBackupId = toUntypedWorkingCopyId(untitledFile);
      const customBackupId = toUntypedWorkingCopyId(customFile);
      const fooBackupPath = joinPath(workspaceBackupPath, fooFile.scheme, hashIdentifier(fooBackupId));
      const untitledBackupPath = joinPath(workspaceBackupPath, untitledFile.scheme, hashIdentifier(untitledBackupId));
      const customFileBackupPath = joinPath(workspaceBackupPath, customFile.scheme, hashIdentifier(customBackupId));
      await fileService.createFolder(joinPath(workspaceBackupPath, fooFile.scheme));
      await fileService.createFolder(joinPath(workspaceBackupPath, untitledFile.scheme));
      await fileService.createFolder(joinPath(workspaceBackupPath, customFile.scheme));
      await fileService.writeFile(fooBackupPath, VSBuffer.fromString(`${fooFile.toString()}
test file`));
      await fileService.writeFile(untitledBackupPath, VSBuffer.fromString(`${untitledFile.toString()}
test untitled`));
      await fileService.writeFile(customFileBackupPath, VSBuffer.fromString(`${customFile.toString()}
test custom`));
      service.reinitialize(workspaceBackupPath);
      const backups = await service.getBackups();
      assert.strictEqual(backups.length, 3);
      assert.ok(backups.some((backup) => isEqual(backup.resource, fooFile)));
      assert.ok(backups.some((backup) => isEqual(backup.resource, untitledFile)));
      assert.ok(backups.some((backup) => isEqual(backup.resource, customFile)));
      assert.ok(backups.every((backup) => backup.typeId === ""));
    });
    test("works (when typeId in meta is missing)", async () => {
      const fooBackupId = toUntypedWorkingCopyId(fooFile);
      const untitledBackupId = toUntypedWorkingCopyId(untitledFile);
      const customBackupId = toUntypedWorkingCopyId(customFile);
      const fooBackupPath = joinPath(workspaceBackupPath, fooFile.scheme, hashIdentifier(fooBackupId));
      const untitledBackupPath = joinPath(workspaceBackupPath, untitledFile.scheme, hashIdentifier(untitledBackupId));
      const customFileBackupPath = joinPath(workspaceBackupPath, customFile.scheme, hashIdentifier(customBackupId));
      await fileService.createFolder(joinPath(workspaceBackupPath, fooFile.scheme));
      await fileService.createFolder(joinPath(workspaceBackupPath, untitledFile.scheme));
      await fileService.createFolder(joinPath(workspaceBackupPath, customFile.scheme));
      await fileService.writeFile(fooBackupPath, VSBuffer.fromString(`${fooFile.toString()} ${JSON.stringify({ foo: "bar" })}
test file`));
      await fileService.writeFile(untitledBackupPath, VSBuffer.fromString(`${untitledFile.toString()} ${JSON.stringify({ foo: "bar" })}
test untitled`));
      await fileService.writeFile(customFileBackupPath, VSBuffer.fromString(`${customFile.toString()} ${JSON.stringify({ foo: "bar" })}
test custom`));
      service.reinitialize(workspaceBackupPath);
      const backups = await service.getBackups();
      assert.strictEqual(backups.length, 3);
      assert.ok(backups.some((backup) => isEqual(backup.resource, fooFile)));
      assert.ok(backups.some((backup) => isEqual(backup.resource, untitledFile)));
      assert.ok(backups.some((backup) => isEqual(backup.resource, customFile)));
      assert.ok(backups.every((backup) => backup.typeId === ""));
    });
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
export {
  NodeTestWorkingCopyBackupService,
  TestNativeWorkbenchEnvironmentService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvd29ya2luZ0NvcHkvdGVzdC9lbGVjdHJvbi1zYW5kYm94L3dvcmtpbmdDb3B5QmFja3VwU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgaW5zZXJ0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IGhhc2ggfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IGlzRXF1YWwsIGpvaW5QYXRoLCBkaXJuYW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGpvaW4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBXb3JraW5nQ29weUJhY2t1cHNNb2RlbCwgaGFzaElkZW50aWZpZXIgfSBmcm9tICcuLi8uLi9jb21tb24vd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IExvZ0xldmVsLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IE5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2VsZWN0cm9uLXNhbmRib3gvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHRvQnVmZmVyT3JSZWFkYWJsZSB9IGZyb20gJy4uLy4uLy4uL3RleHRmaWxlL2NvbW1vbi90ZXh0ZmlsZXMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IE5hdGl2ZVdvcmtpbmdDb3B5QmFja3VwU2VydmljZSB9IGZyb20gJy4uLy4uL2VsZWN0cm9uLXNhbmRib3gvd29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZpbGVVc2VyRGF0YVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXNlckRhdGEvY29tbW9uL2ZpbGVVc2VyRGF0YVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IGJ1ZmZlclRvUmVhZGFibGUsIGJ1ZmZlclRvU3RyZWFtLCBzdHJlYW1Ub0J1ZmZlciwgVlNCdWZmZXIsIFZTQnVmZmVyUmVhZGFibGUsIFZTQnVmZmVyUmVhZGFibGVTdHJlYW0gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgVGVzdExpZmVjeWNsZVNlcnZpY2UsIHRvVHlwZWRXb3JraW5nQ29weUlkLCB0b1VudHlwZWRXb3JraW5nQ29weUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtpbmdDb3B5QmFja3VwTWV0YSwgSVdvcmtpbmdDb3B5SWRlbnRpZmllciB9IGZyb20gJy4uLy4uL2NvbW1vbi93b3JraW5nQ29weS5qcyc7XG5pbXBvcnQgeyBjb25zdW1lU3RyZWFtIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCB7IFRlc3RQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9pbk1lbW9yeUZpbGVzeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElOYXRpdmVXaW5kb3dDb25maWd1cmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vd2luZG93L2NvbW1vbi93aW5kb3cuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IFVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eVNlcnZpY2UuanMnO1xuXG5jb25zdCBob21lRGlyID0gVVJJLmZpbGUoJ2hvbWUnKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLmluTWVtb3J5IH0pO1xuY29uc3QgdG1wRGlyID0gVVJJLmZpbGUoJ3RtcCcpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuaW5NZW1vcnkgfSk7XG5jb25zdCBOVUxMX1BST0ZJTEUgPSB7XG5cdG5hbWU6ICcnLFxuXHRpZDogJycsXG5cdHNob3J0TmFtZTogJycsXG5cdGlzRGVmYXVsdDogZmFsc2UsXG5cdGxvY2F0aW9uOiBob21lRGlyLFxuXHRzZXR0aW5nc1Jlc291cmNlOiBqb2luUGF0aChob21lRGlyLCAnc2V0dGluZ3MuanNvbicpLFxuXHRnbG9iYWxTdG9yYWdlSG9tZTogam9pblBhdGgoaG9tZURpciwgJ2dsb2JhbFN0b3JhZ2UnKSxcblx0a2V5YmluZGluZ3NSZXNvdXJjZTogam9pblBhdGgoaG9tZURpciwgJ2tleWJpbmRpbmdzLmpzb24nKSxcblx0dGFza3NSZXNvdXJjZTogam9pblBhdGgoaG9tZURpciwgJ3Rhc2tzLmpzb24nKSxcblx0c25pcHBldHNIb21lOiBqb2luUGF0aChob21lRGlyLCAnc25pcHBldHMnKSxcblx0cHJvbXB0c0hvbWU6IGpvaW5QYXRoKGhvbWVEaXIsICdwcm9tcHRzJyksXG5cdGV4dGVuc2lvbnNSZXNvdXJjZTogam9pblBhdGgoaG9tZURpciwgJ2V4dGVuc2lvbnMuanNvbicpLFxuXHRjYWNoZUhvbWU6IGpvaW5QYXRoKGhvbWVEaXIsICdjYWNoZScpXG59O1xuXG5jb25zdCBUZXN0TmF0aXZlV2luZG93Q29uZmlndXJhdGlvbjogSU5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24gPSB7XG5cdHdpbmRvd0lkOiAwLFxuXHRtYWNoaW5lSWQ6ICd0ZXN0TWFjaGluZUlkJyxcblx0c3FtSWQ6ICd0ZXN0U3FtSWQnLFxuXHRkZXZEZXZpY2VJZDogJ3Rlc3RkZXZEZXZpY2VJZCcsXG5cdGxvZ0xldmVsOiBMb2dMZXZlbC5FcnJvcixcblx0bG9nZ2VyczogW10sXG5cdG1haW5QaWQ6IDAsXG5cdGFwcFJvb3Q6ICcnLFxuXHR1c2VyRW52OiB7fSxcblx0ZXhlY1BhdGg6IHByb2Nlc3MuZXhlY1BhdGgsXG5cdHBlcmZNYXJrczogW10sXG5cdGNvbG9yU2NoZW1lOiB7IGRhcms6IHRydWUsIGhpZ2hDb250cmFzdDogZmFsc2UgfSxcblx0b3M6IHsgcmVsZWFzZTogJ3Vua25vd24nLCBob3N0bmFtZTogJ3Vua25vd24nLCBhcmNoOiAndW5rbm93bicgfSxcblx0cHJvZHVjdCxcblx0aG9tZURpcjogaG9tZURpci5mc1BhdGgsXG5cdHRtcERpcjogdG1wRGlyLmZzUGF0aCxcblx0dXNlckRhdGFEaXI6IGpvaW5QYXRoKGhvbWVEaXIsIHByb2R1Y3QubmFtZVNob3J0KS5mc1BhdGgsXG5cdHByb2ZpbGVzOiB7IHByb2ZpbGU6IE5VTExfUFJPRklMRSwgYWxsOiBbTlVMTF9QUk9GSUxFXSwgaG9tZTogaG9tZURpciB9LFxuXHRubHM6IHtcblx0XHRtZXNzYWdlczogW10sXG5cdFx0bGFuZ3VhZ2U6ICdlbidcblx0fSxcblx0XzogW11cbn07XG5cbmV4cG9ydCBjbGFzcyBUZXN0TmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIGV4dGVuZHMgTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHtcblxuXHRjb25zdHJ1Y3Rvcih0ZXN0RGlyOiBVUkksIGJhY2t1cFBhdGg6IFVSSSkge1xuXHRcdHN1cGVyKHsgLi4uVGVzdE5hdGl2ZVdpbmRvd0NvbmZpZ3VyYXRpb24sIGJhY2t1cFBhdGg6IGJhY2t1cFBhdGguZnNQYXRoLCAndXNlci1kYXRhLWRpcic6IHRlc3REaXIuZnNQYXRoIH0sIFRlc3RQcm9kdWN0U2VydmljZSk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE5vZGVUZXN0V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIGV4dGVuZHMgTmF0aXZlV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlIHtcblxuXHRwcml2YXRlIGJhY2t1cFJlc291cmNlSm9pbmVyczogRnVuY3Rpb25bXTtcblx0cHJpdmF0ZSBkaXNjYXJkQmFja3VwSm9pbmVyczogRnVuY3Rpb25bXTtcblx0ZGlzY2FyZGVkQmFja3VwczogSVdvcmtpbmdDb3B5SWRlbnRpZmllcltdO1xuXHRkaXNjYXJkZWRBbGxCYWNrdXBzOiBib29sZWFuO1xuXHRwcml2YXRlIHBlbmRpbmdCYWNrdXBzQXJyOiBQcm9taXNlPHZvaWQ+W107XG5cblx0cmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2U7XG5cblx0Y29uc3RydWN0b3IodGVzdERpcjogVVJJLCB3b3Jrc3BhY2VCYWNrdXBQYXRoOiBVUkkpIHtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBuZXcgVGVzdE5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSh0ZXN0RGlyLCB3b3Jrc3BhY2VCYWNrdXBQYXRoKTtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gbmV3IE51bGxMb2dTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBuZXcgRmlsZVNlcnZpY2UobG9nU2VydmljZSk7XG5cdFx0Y29uc3QgbGlmZWN5Y2xlU2VydmljZSA9IG5ldyBUZXN0TGlmZWN5Y2xlU2VydmljZSgpO1xuXHRcdHN1cGVyKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIGxvZ1NlcnZpY2UsIGxpZmVjeWNsZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgZnNwID0gbmV3IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyKCk7XG5cdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLmluTWVtb3J5LCBmc3ApO1xuXHRcdGNvbnN0IHVyaUlkZW50aXR5U2VydmljZSA9IG5ldyBVcmlJZGVudGl0eVNlcnZpY2UoZmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlID0gbmV3IFVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKGVudmlyb25tZW50U2VydmljZSwgZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSwgbG9nU2VydmljZSk7XG5cdFx0ZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCBuZXcgRmlsZVVzZXJEYXRhUHJvdmlkZXIoU2NoZW1hcy5maWxlLCBmc3AsIFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblxuXHRcdHRoaXMuX2ZpbGVTZXJ2aWNlID0gZmlsZVNlcnZpY2U7XG5cblx0XHR0aGlzLmJhY2t1cFJlc291cmNlSm9pbmVycyA9IFtdO1xuXHRcdHRoaXMuZGlzY2FyZEJhY2t1cEpvaW5lcnMgPSBbXTtcblx0XHR0aGlzLmRpc2NhcmRlZEJhY2t1cHMgPSBbXTtcblx0XHR0aGlzLnBlbmRpbmdCYWNrdXBzQXJyID0gW107XG5cdFx0dGhpcy5kaXNjYXJkZWRBbGxCYWNrdXBzID0gZmFsc2U7XG5cdH1cblxuXHR0ZXN0R2V0RmlsZVNlcnZpY2UoKTogSUZpbGVTZXJ2aWNlIHtcblx0XHRyZXR1cm4gdGhpcy5maWxlU2VydmljZTtcblx0fVxuXG5cdGFzeW5jIHdhaXRGb3JBbGxCYWNrdXBzKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKHRoaXMucGVuZGluZ0JhY2t1cHNBcnIpO1xuXHR9XG5cblx0am9pbkJhY2t1cFJlc291cmNlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHRoaXMuYmFja3VwUmVzb3VyY2VKb2luZXJzLnB1c2gocmVzb2x2ZSkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgYmFja3VwKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIsIGNvbnRlbnQ/OiBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtIHwgVlNCdWZmZXJSZWFkYWJsZSwgdmVyc2lvbklkPzogbnVtYmVyLCBtZXRhPzogYW55LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgcCA9IHN1cGVyLmJhY2t1cChpZGVudGlmaWVyLCBjb250ZW50LCB2ZXJzaW9uSWQsIG1ldGEsIHRva2VuKTtcblx0XHRjb25zdCByZW1vdmVGcm9tUGVuZGluZ0JhY2t1cHMgPSBpbnNlcnQodGhpcy5wZW5kaW5nQmFja3Vwc0FyciwgcC50aGVuKHVuZGVmaW5lZCwgdW5kZWZpbmVkKSk7XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcDtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0cmVtb3ZlRnJvbVBlbmRpbmdCYWNrdXBzKCk7XG5cdFx0fVxuXG5cdFx0d2hpbGUgKHRoaXMuYmFja3VwUmVzb3VyY2VKb2luZXJzLmxlbmd0aCkge1xuXHRcdFx0dGhpcy5iYWNrdXBSZXNvdXJjZUpvaW5lcnMucG9wKCkhKCk7XG5cdFx0fVxuXHR9XG5cblx0am9pbkRpc2NhcmRCYWNrdXAoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4gdGhpcy5kaXNjYXJkQmFja3VwSm9pbmVycy5wdXNoKHJlc29sdmUpKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIGRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHN1cGVyLmRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcik7XG5cdFx0dGhpcy5kaXNjYXJkZWRCYWNrdXBzLnB1c2goaWRlbnRpZmllcik7XG5cblx0XHR3aGlsZSAodGhpcy5kaXNjYXJkQmFja3VwSm9pbmVycy5sZW5ndGgpIHtcblx0XHRcdHRoaXMuZGlzY2FyZEJhY2t1cEpvaW5lcnMucG9wKCkhKCk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgZGlzY2FyZEJhY2t1cHMoZmlsdGVyPzogeyBleGNlcHQ6IElXb3JraW5nQ29weUlkZW50aWZpZXJbXSB9KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5kaXNjYXJkZWRBbGxCYWNrdXBzID0gdHJ1ZTtcblxuXHRcdHJldHVybiBzdXBlci5kaXNjYXJkQmFja3VwcyhmaWx0ZXIpO1xuXHR9XG5cblx0YXN5bmMgZ2V0QmFja3VwQ29udGVudHMoaWRlbnRpZmllcjogSVdvcmtpbmdDb3B5SWRlbnRpZmllcik6IFByb21pc2U8c3RyaW5nPiB7XG5cdFx0Y29uc3QgYmFja3VwUmVzb3VyY2UgPSB0aGlzLnRvQmFja3VwUmVzb3VyY2UoaWRlbnRpZmllcik7XG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFJlc291cmNlKTtcblxuXHRcdHJldHVybiBmaWxlQ29udGVudHMudmFsdWUudG9TdHJpbmcoKTtcblx0fVxufVxuXG5zdWl0ZSgnV29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlJywgKCkgPT4ge1xuXG5cdGxldCB0ZXN0RGlyOiBVUkk7XG5cdGxldCBiYWNrdXBIb21lOiBVUkk7XG5cdGxldCB3b3Jrc3BhY2VzSnNvblBhdGg6IFVSSTtcblx0bGV0IHdvcmtzcGFjZUJhY2t1cFBhdGg6IFVSSTtcblxuXHRsZXQgc2VydmljZTogTm9kZVRlc3RXb3JraW5nQ29weUJhY2t1cFNlcnZpY2U7XG5cdGxldCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0IHdvcmtzcGFjZVJlc291cmNlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXHdvcmtzcGFjZScgOiAnL3dvcmtzcGFjZScpO1xuXHRjb25zdCBmb29GaWxlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXEZvbycgOiAnL0ZvbycpO1xuXHRjb25zdCBjdXN0b21GaWxlID0gVVJJLnBhcnNlKCdjdXN0b21TY2hlbWU6Ly9zb21lL3BhdGgnKTtcblx0Y29uc3QgY3VzdG9tRmlsZVdpdGhGcmFnbWVudCA9IFVSSS5wYXJzZSgnY3VzdG9tU2NoZW1lMjovL3NvbWUvcGF0aCNmcmFnbWVudCcpO1xuXHRjb25zdCBiYXJGaWxlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXEJhcicgOiAnL0JhcicpO1xuXHRjb25zdCBmb29CYXJGaWxlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXEZvbyBCYXInIDogJy9Gb28gQmFyJyk7XG5cdGNvbnN0IHVudGl0bGVkRmlsZSA9IFVSSS5mcm9tKHsgc2NoZW1lOiBTY2hlbWFzLnVudGl0bGVkLCBwYXRoOiAnVW50aXRsZWQtMScgfSk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdHRlc3REaXIgPSBVUkkuZmlsZShqb2luKGdlbmVyYXRlVXVpZCgpLCAndnNjdGVzdHMnLCAnd29ya2luZ2NvcHliYWNrdXBzZXJ2aWNlJykpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMuaW5NZW1vcnkgfSk7XG5cdFx0YmFja3VwSG9tZSA9IGpvaW5QYXRoKHRlc3REaXIsICdCYWNrdXBzJyk7XG5cdFx0d29ya3NwYWNlc0pzb25QYXRoID0gam9pblBhdGgoYmFja3VwSG9tZSwgJ3dvcmtzcGFjZXMuanNvbicpO1xuXHRcdHdvcmtzcGFjZUJhY2t1cFBhdGggPSBqb2luUGF0aChiYWNrdXBIb21lLCBoYXNoKHdvcmtzcGFjZVJlc291cmNlLmZzUGF0aCkudG9TdHJpbmcoMTYpKTtcblxuXHRcdHNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IE5vZGVUZXN0V29ya2luZ0NvcHlCYWNrdXBTZXJ2aWNlKHRlc3REaXIsIHdvcmtzcGFjZUJhY2t1cFBhdGgpKTtcblx0XHRmaWxlU2VydmljZSA9IHNlcnZpY2UuX2ZpbGVTZXJ2aWNlO1xuXG5cdFx0YXdhaXQgZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKGJhY2t1cEhvbWUpO1xuXG5cdFx0cmV0dXJuIGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh3b3Jrc3BhY2VzSnNvblBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdoYXNoSWRlbnRpZmllcicsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgY29ycmVjdGx5IGhhc2ggdGhlIGlkZW50aWZpZXIgZm9yIHVudGl0bGVkIHNjaGVtZSBVUklzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQsIHBhdGg6ICdVbnRpdGxlZC0xJyB9KTtcblxuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXHRcdFx0Ly8gSWYgdGhlc2UgaGFzaGVzIGNoYW5nZSBwZW9wbGUgd2lsbCBsb3NlIHRoZWlyIGJhY2tlZCB1cCBmaWxlc1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXG5cdFx0XHRjb25zdCB1bnR5cGVkQmFja3VwSGFzaCA9IGhhc2hJZGVudGlmaWVyKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodXJpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50eXBlZEJhY2t1cEhhc2gsICctN2Y5YzFhMmUnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnR5cGVkQmFja3VwSGFzaCwgaGFzaCh1cmkuZnNQYXRoKS50b1N0cmluZygxNikpO1xuXG5cdFx0XHRjb25zdCB0eXBlZEJhY2t1cEhhc2ggPSBoYXNoSWRlbnRpZmllcih7IHR5cGVJZDogJ2hhc2hUZXN0JywgcmVzb3VyY2U6IHVyaSB9KTtcblx0XHRcdGlmIChpc1dpbmRvd3MpIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkQmFja3VwSGFzaCwgJy0xN2M0N2NkYycpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkQmFja3VwSGFzaCwgJy04YWQ1ZjRmJyk7XG5cdFx0XHR9XG5cblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0XHQvLyBJZiB0aGVzZSBoYXNoZXMgY29sbGlkZSBwZW9wbGUgd2lsbCBsb3NlIHRoZWlyIGJhY2tlZCB1cCBmaWxlc1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCB0eXBlZEJhY2t1cEhhc2gpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGNvcnJlY3RseSBoYXNoIHRoZSBpZGVudGlmaWVyIGZvciBmaWxlIHNjaGVtZSBVUklzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZpbGUoJy9mb28nKTtcblxuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXHRcdFx0Ly8gSWYgdGhlc2UgaGFzaGVzIGNoYW5nZSBwZW9wbGUgd2lsbCBsb3NlIHRoZWlyIGJhY2tlZCB1cCBmaWxlc1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXG5cdFx0XHRjb25zdCB1bnR5cGVkQmFja3VwSGFzaCA9IGhhc2hJZGVudGlmaWVyKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodXJpKSk7XG5cdFx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnR5cGVkQmFja3VwSGFzaCwgJzIwZmZhYTEzJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50eXBlZEJhY2t1cEhhc2gsICcyMGViMzU2MCcpO1xuXHRcdFx0fVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCBoYXNoKHVyaS5mc1BhdGgpLnRvU3RyaW5nKDE2KSk7XG5cblx0XHRcdGNvbnN0IHR5cGVkQmFja3VwSGFzaCA9IGhhc2hJZGVudGlmaWVyKHsgdHlwZUlkOiAnaGFzaFRlc3QnLCByZXNvdXJjZTogdXJpIH0pO1xuXHRcdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRCYWNrdXBIYXNoLCAnLTU1ZmM1NWRiJyk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZWRCYWNrdXBIYXNoLCAnNTFlNTZiZicpO1xuXHRcdFx0fVxuXG5cdFx0XHQvLyAhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhIVxuXHRcdFx0Ly8gSWYgdGhlc2UgaGFzaGVzIGNvbGxpZGUgcGVvcGxlIHdpbGwgbG9zZSB0aGVpciBiYWNrZWQgdXAgZmlsZXNcblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh1bnR5cGVkQmFja3VwSGFzaCwgdHlwZWRCYWNrdXBIYXNoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBjb3JyZWN0bHkgaGFzaCB0aGUgaWRlbnRpZmllciBmb3IgY3VzdG9tIHNjaGVtZSBVUklzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oe1xuXHRcdFx0XHRzY2hlbWU6ICd2c2NvZGUtY3VzdG9tJyxcblx0XHRcdFx0cGF0aDogJ3NvbWVQYXRoJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblx0XHRcdC8vIElmIHRoZXNlIGhhc2hlcyBjaGFuZ2UgcGVvcGxlIHdpbGwgbG9zZSB0aGVpciBiYWNrZWQgdXAgZmlsZXNcblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXHRcdFx0Y29uc3QgdW50eXBlZEJhY2t1cEhhc2ggPSBoYXNoSWRlbnRpZmllcih0b1VudHlwZWRXb3JraW5nQ29weUlkKHVyaSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCAnLTQ0OTcyZDk4Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50eXBlZEJhY2t1cEhhc2gsIGhhc2godXJpLnRvU3RyaW5nKCkpLnRvU3RyaW5nKDE2KSk7XG5cblx0XHRcdGNvbnN0IHR5cGVkQmFja3VwSGFzaCA9IGhhc2hJZGVudGlmaWVyKHsgdHlwZUlkOiAnaGFzaFRlc3QnLCByZXNvdXJjZTogdXJpIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkQmFja3VwSGFzaCwgJzUwMjE0OWM3Jyk7XG5cblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0XHQvLyBJZiB0aGVzZSBoYXNoZXMgY29sbGlkZSBwZW9wbGUgd2lsbCBsb3NlIHRoZWlyIGJhY2tlZCB1cCBmaWxlc1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCB0eXBlZEJhY2t1cEhhc2gpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCBmYWlsIGZvciBVUklzIHdpdGhvdXQgcGF0aCcsICgpID0+IHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5mcm9tKHtcblx0XHRcdFx0c2NoZW1lOiAndnNjb2RlLWZyYWdtZW50Jyxcblx0XHRcdFx0ZnJhZ21lbnQ6ICdmcmFnJ1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblx0XHRcdC8vIElmIHRoZXNlIGhhc2hlcyBjaGFuZ2UgcGVvcGxlIHdpbGwgbG9zZSB0aGVpciBiYWNrZWQgdXAgZmlsZXNcblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXHRcdFx0Y29uc3QgdW50eXBlZEJhY2t1cEhhc2ggPSBoYXNoSWRlbnRpZmllcih0b1VudHlwZWRXb3JraW5nQ29weUlkKHVyaSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCAnLTJmNmIyZjFiJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW50eXBlZEJhY2t1cEhhc2gsIGhhc2godXJpLnRvU3RyaW5nKCkpLnRvU3RyaW5nKDE2KSk7XG5cblx0XHRcdGNvbnN0IHR5cGVkQmFja3VwSGFzaCA9IGhhc2hJZGVudGlmaWVyKHsgdHlwZUlkOiAnaGFzaFRlc3QnLCByZXNvdXJjZTogdXJpIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVkQmFja3VwSGFzaCwgJzZlODJjYTU3Jyk7XG5cblx0XHRcdC8vICEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhXG5cdFx0XHQvLyBJZiB0aGVzZSBoYXNoZXMgY29sbGlkZSBwZW9wbGUgd2lsbCBsb3NlIHRoZWlyIGJhY2tlZCB1cCBmaWxlc1xuXHRcdFx0Ly8gISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISEhISFcblxuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHVudHlwZWRCYWNrdXBIYXNoLCB0eXBlZEJhY2t1cEhhc2gpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZ2V0QmFja3VwUmVzb3VyY2UnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGdldCB0aGUgY29ycmVjdCBiYWNrdXAgcGF0aCBmb3IgdGV4dCBmaWxlcycsICgpID0+IHtcblxuXHRcdFx0Ly8gRm9ybWF0IHNob3VsZCBiZTogPGJhY2t1cEhvbWU+Lzx3b3Jrc3BhY2VIYXNoPi88c2NoZW1lPi88ZmlsZVBhdGhIYXNoPlxuXHRcdFx0Y29uc3QgYmFja3VwUmVzb3VyY2UgPSBmb29GaWxlO1xuXHRcdFx0Y29uc3Qgd29ya3NwYWNlSGFzaCA9IGhhc2god29ya3NwYWNlUmVzb3VyY2UuZnNQYXRoKS50b1N0cmluZygxNik7XG5cblx0XHRcdC8vIE5vIFR5cGUgSURcblx0XHRcdGxldCBiYWNrdXBJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoYmFja3VwUmVzb3VyY2UpO1xuXHRcdFx0bGV0IGZpbGVQYXRoSGFzaCA9IGhhc2hJZGVudGlmaWVyKGJhY2t1cElkKTtcblx0XHRcdGxldCBleHBlY3RlZFBhdGggPSBqb2luUGF0aChiYWNrdXBIb21lLCB3b3Jrc3BhY2VIYXNoLCBTY2hlbWFzLmZpbGUsIGZpbGVQYXRoSGFzaCkud2l0aCh7IHNjaGVtZTogU2NoZW1hcy52c2NvZGVVc2VyRGF0YSB9KS50b1N0cmluZygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudG9CYWNrdXBSZXNvdXJjZShiYWNrdXBJZCkudG9TdHJpbmcoKSwgZXhwZWN0ZWRQYXRoKTtcblxuXHRcdFx0Ly8gV2l0aCBUeXBlIElEXG5cdFx0XHRiYWNrdXBJZCA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGJhY2t1cFJlc291cmNlKTtcblx0XHRcdGZpbGVQYXRoSGFzaCA9IGhhc2hJZGVudGlmaWVyKGJhY2t1cElkKTtcblx0XHRcdGV4cGVjdGVkUGF0aCA9IGpvaW5QYXRoKGJhY2t1cEhvbWUsIHdvcmtzcGFjZUhhc2gsIFNjaGVtYXMuZmlsZSwgZmlsZVBhdGhIYXNoKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pLnRvU3RyaW5nKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50b0JhY2t1cFJlc291cmNlKGJhY2t1cElkKS50b1N0cmluZygpLCBleHBlY3RlZFBhdGgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGdldCB0aGUgY29ycmVjdCBiYWNrdXAgcGF0aCBmb3IgdW50aXRsZWQgZmlsZXMnLCAoKSA9PiB7XG5cblx0XHRcdC8vIEZvcm1hdCBzaG91bGQgYmU6IDxiYWNrdXBIb21lPi88d29ya3NwYWNlSGFzaD4vPHNjaGVtZT4vPGZpbGVQYXRoSGFzaD5cblx0XHRcdGNvbnN0IGJhY2t1cFJlc291cmNlID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudW50aXRsZWQsIHBhdGg6ICdVbnRpdGxlZC0xJyB9KTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZUhhc2ggPSBoYXNoKHdvcmtzcGFjZVJlc291cmNlLmZzUGF0aCkudG9TdHJpbmcoMTYpO1xuXG5cdFx0XHQvLyBObyBUeXBlIElEXG5cdFx0XHRsZXQgYmFja3VwSWQgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKGJhY2t1cFJlc291cmNlKTtcblx0XHRcdGxldCBmaWxlUGF0aEhhc2ggPSBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCk7XG5cdFx0XHRsZXQgZXhwZWN0ZWRQYXRoID0gam9pblBhdGgoYmFja3VwSG9tZSwgd29ya3NwYWNlSGFzaCwgU2NoZW1hcy51bnRpdGxlZCwgZmlsZVBhdGhIYXNoKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pLnRvU3RyaW5nKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50b0JhY2t1cFJlc291cmNlKGJhY2t1cElkKS50b1N0cmluZygpLCBleHBlY3RlZFBhdGgpO1xuXG5cdFx0XHQvLyBXaXRoIFR5cGUgSURcblx0XHRcdGJhY2t1cElkID0gdG9UeXBlZFdvcmtpbmdDb3B5SWQoYmFja3VwUmVzb3VyY2UpO1xuXHRcdFx0ZmlsZVBhdGhIYXNoID0gaGFzaElkZW50aWZpZXIoYmFja3VwSWQpO1xuXHRcdFx0ZXhwZWN0ZWRQYXRoID0gam9pblBhdGgoYmFja3VwSG9tZSwgd29ya3NwYWNlSGFzaCwgU2NoZW1hcy51bnRpdGxlZCwgZmlsZVBhdGhIYXNoKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pLnRvU3RyaW5nKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50b0JhY2t1cFJlc291cmNlKGJhY2t1cElkKS50b1N0cmluZygpLCBleHBlY3RlZFBhdGgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGdldCB0aGUgY29ycmVjdCBiYWNrdXAgcGF0aCBmb3IgY3VzdG9tIGZpbGVzJywgKCkgPT4ge1xuXG5cdFx0XHQvLyBGb3JtYXQgc2hvdWxkIGJlOiA8YmFja3VwSG9tZT4vPHdvcmtzcGFjZUhhc2g+LzxzY2hlbWU+LzxmaWxlUGF0aEhhc2g+XG5cdFx0XHRjb25zdCBiYWNrdXBSZXNvdXJjZSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnY3VzdG9tJywgcGF0aDogJ2N1c3RvbS9maWxlLnR4dCcgfSk7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VIYXNoID0gaGFzaCh3b3Jrc3BhY2VSZXNvdXJjZS5mc1BhdGgpLnRvU3RyaW5nKDE2KTtcblxuXHRcdFx0Ly8gTm8gVHlwZSBJRFxuXHRcdFx0bGV0IGJhY2t1cElkID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChiYWNrdXBSZXNvdXJjZSk7XG5cdFx0XHRsZXQgZmlsZVBhdGhIYXNoID0gaGFzaElkZW50aWZpZXIoYmFja3VwSWQpO1xuXHRcdFx0bGV0IGV4cGVjdGVkUGF0aCA9IGpvaW5QYXRoKGJhY2t1cEhvbWUsIHdvcmtzcGFjZUhhc2gsICdjdXN0b20nLCBmaWxlUGF0aEhhc2gpLndpdGgoeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlVXNlckRhdGEgfSkudG9TdHJpbmcoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRvQmFja3VwUmVzb3VyY2UoYmFja3VwSWQpLnRvU3RyaW5nKCksIGV4cGVjdGVkUGF0aCk7XG5cblx0XHRcdC8vIFdpdGggVHlwZSBJRFxuXHRcdFx0YmFja3VwSWQgPSB0b1R5cGVkV29ya2luZ0NvcHlJZChiYWNrdXBSZXNvdXJjZSk7XG5cdFx0XHRmaWxlUGF0aEhhc2ggPSBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCk7XG5cdFx0XHRleHBlY3RlZFBhdGggPSBqb2luUGF0aChiYWNrdXBIb21lLCB3b3Jrc3BhY2VIYXNoLCAnY3VzdG9tJywgZmlsZVBhdGhIYXNoKS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pLnRvU3RyaW5nKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50b0JhY2t1cFJlc291cmNlKGJhY2t1cElkKS50b1N0cmluZygpLCBleHBlY3RlZFBhdGgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnYmFja3VwJywgKCkgPT4ge1xuXG5cdFx0ZnVuY3Rpb24gdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIsIGNvbnRlbnQgPSAnJywgbWV0YT86IG9iamVjdCk6IHN0cmluZyB7XG5cdFx0XHRyZXR1cm4gYCR7aWRlbnRpZmllci5yZXNvdXJjZS50b1N0cmluZygpfSAke0pTT04uc3RyaW5naWZ5KHsgLi4ubWV0YSwgdHlwZUlkOiBpZGVudGlmaWVyLnR5cGVJZCB9KX1cXG4ke2NvbnRlbnR9YDtcblx0XHR9XG5cblx0XHR0ZXN0KCdqb2luaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGJhY2t1cEpvaW5lZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3Qgam9pbkJhY2t1cHNQcm9taXNlID0gc2VydmljZS5qb2luQmFja3VwcygpO1xuXHRcdFx0am9pbkJhY2t1cHNQcm9taXNlLnRoZW4oKCkgPT4gYmFja3VwSm9pbmVkID0gdHJ1ZSk7XG5cdFx0XHRhd2FpdCBqb2luQmFja3Vwc1Byb21pc2U7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3VwSm9pbmVkLCB0cnVlKTtcblxuXHRcdFx0YmFja3VwSm9pbmVkID0gZmFsc2U7XG5cdFx0XHRzZXJ2aWNlLmpvaW5CYWNrdXBzKCkudGhlbigoKSA9PiBiYWNrdXBKb2luZWQgPSB0cnVlKTtcblxuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0Y29uc3QgYmFja3VwUHJvbWlzZSA9IHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cEpvaW5lZCwgZmFsc2UpO1xuXHRcdFx0YXdhaXQgYmFja3VwUHJvbWlzZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXBKb2luZWQsIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUGF0aCkpLnZhbHVlLnRvU3RyaW5nKCksIHRvRXhwZWN0ZWRQcmVhbWJsZShpZGVudGlmaWVyKSk7XG5cdFx0XHRhc3NlcnQub2soc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ25vIHRleHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShiYWNrdXBQYXRoKSkudmFsdWUudG9TdHJpbmcoKSwgdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXIpKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndGV4dCBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCd0ZXN0JykpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShiYWNrdXBQYXRoKSkudmFsdWUudG9TdHJpbmcoKSwgdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXIsICd0ZXN0JykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0ZXh0IGZpbGUgKHdpdGggdmVyc2lvbiknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSksIDY2Nik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUGF0aCkpLnZhbHVlLnRvU3RyaW5nKCksIHRvRXhwZWN0ZWRQcmVhbWJsZShpZGVudGlmaWVyLCAndGVzdCcpKTtcblx0XHRcdGFzc2VydC5vayghc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIsIDU1NSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyLCA2NjYpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3RleHQgZmlsZSAod2l0aCBtZXRhKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpO1xuXHRcdFx0Y29uc3QgYmFja3VwUGF0aCA9IGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIGlkZW50aWZpZXIucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG5cdFx0XHRjb25zdCBtZXRhID0geyBldGFnOiAnNjc4Jywgb3JwaGFuZWQ6IHRydWUgfTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCd0ZXN0JykpLCB1bmRlZmluZWQsIG1ldGEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICdmaWxlJykpKS5jaGlsZHJlbj8ubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpLCB0b0V4cGVjdGVkUHJlYW1ibGUoaWRlbnRpZmllciwgJ3Rlc3QnLCBtZXRhKSk7XG5cdFx0XHRhc3NlcnQub2soc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3RleHQgZmlsZSB3aXRoIHdoaXRlc3BhY2UgaW4gbmFtZSBhbmQgdHlwZSAod2l0aCBtZXRhKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGZpbGVXaXRoU3BhY2UgPSBVUkkuZmlsZShpc1dpbmRvd3MgPyAnYzpcXFxcRm9vIFxcbiBCYXInIDogJy9Gb28gXFxuIEJhcicpO1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGZpbGVXaXRoU3BhY2UsICcgdGVzdCBpZCBcXG4nKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXHRcdFx0Y29uc3QgbWV0YSA9IHsgZXRhZzogJzY3OCBcXG4gaycsIG9ycGhhbmVkOiB0cnVlIH07XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSwgdW5kZWZpbmVkLCBtZXRhKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShiYWNrdXBQYXRoKSkudmFsdWUudG9TdHJpbmcoKSwgdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXIsICd0ZXN0JywgbWV0YSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0ZXh0IGZpbGUgd2l0aCB1bmljb2RlIGNoYXJhY3RlciBpbiBuYW1lIGFuZCB0eXBlICh3aXRoIG1ldGEpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVdpdGhVbmljb2RlID0gVVJJLmZpbGUoaXNXaW5kb3dzID8gJ2M6XFxcXHNvXHVEODA4XHVEQzA1bWVcdTA4MDQnIDogJy9zb1x1RDgwOFx1REMwNW1lXHUwODA0Jyk7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9UeXBlZFdvcmtpbmdDb3B5SWQoZmlsZVdpdGhVbmljb2RlLCAnIHRlc3Qgc29cdUQ4MDhcdURDMDVtZVx1MDgwNCBpZCBcXG4nKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXHRcdFx0Y29uc3QgbWV0YSA9IHsgZXRhZzogJzY3OHNvXHVEODA4XHVEQzA1bWVcdTA4MDQnLCBvcnBoYW5lZDogdHJ1ZSB9O1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSksIHVuZGVmaW5lZCwgbWV0YSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUGF0aCkpLnZhbHVlLnRvU3RyaW5nKCksIHRvRXhwZWN0ZWRQcmVhbWJsZShpZGVudGlmaWVyLCAndGVzdCcsIG1ldGEpKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndW50aXRsZWQgZmlsZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCd0ZXN0JykpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAndW50aXRsZWQnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUGF0aCkpLnZhbHVlLnRvU3RyaW5nKCksIHRvRXhwZWN0ZWRQcmVhbWJsZShpZGVudGlmaWVyLCAndGVzdCcpKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndGV4dCBmaWxlIChyZWFkYWJsZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ3Rlc3QnKTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgdG9CdWZmZXJPclJlYWRhYmxlKG1vZGVsLmNyZWF0ZVNuYXBzaG90KCkpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShiYWNrdXBQYXRoKSkudmFsdWUudG9TdHJpbmcoKSwgdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXIsICd0ZXN0JykpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3VudGl0bGVkIGZpbGUgKHJlYWRhYmxlKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGlkZW50aWZpZXIgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCd0ZXN0Jyk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIsIHRvQnVmZmVyT3JSZWFkYWJsZShtb2RlbC5jcmVhdGVTbmFwc2hvdCgpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ3VudGl0bGVkJykpKS5jaGlsZHJlbj8ubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpLCB0b0V4cGVjdGVkUHJlYW1ibGUoaWRlbnRpZmllciwgJ3Rlc3QnKSk7XG5cblx0XHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3RleHQgZmlsZSAobGFyZ2UgZmlsZSwgc3RyZWFtKScsICgpID0+IHtcblx0XHRcdGNvbnN0IGxhcmdlU3RyaW5nID0gKG5ldyBBcnJheSgzMCAqIDEwMjQpKS5qb2luKCdMYXJnZSBTdHJpbmdcXG4nKTtcblxuXHRcdFx0cmV0dXJuIHRlc3RMYXJnZVRleHRGaWxlKGxhcmdlU3RyaW5nLCBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKGxhcmdlU3RyaW5nKSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndGV4dCBmaWxlIChsYXJnZSBmaWxlLCByZWFkYWJsZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBsYXJnZVN0cmluZyA9IChuZXcgQXJyYXkoMzAgKiAxMDI0KSkuam9pbignTGFyZ2UgU3RyaW5nXFxuJyk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChsYXJnZVN0cmluZyk7XG5cblx0XHRcdGF3YWl0IHRlc3RMYXJnZVRleHRGaWxlKGxhcmdlU3RyaW5nLCB0b0J1ZmZlck9yUmVhZGFibGUobW9kZWwuY3JlYXRlU25hcHNob3QoKSkpO1xuXG5cdFx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHRhc3luYyBmdW5jdGlvbiB0ZXN0TGFyZ2VUZXh0RmlsZShsYXJnZVN0cmluZzogc3RyaW5nLCBidWZmZXI6IFZTQnVmZmVyUmVhZGFibGUgfCBWU0J1ZmZlclJlYWRhYmxlU3RyZWFtKSB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXIsIHVuZGVmaW5lZCwgeyBsYXJnZVRlc3Q6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoYmFja3VwUGF0aCkpLnZhbHVlLnRvU3RyaW5nKCksIHRvRXhwZWN0ZWRQcmVhbWJsZShpZGVudGlmaWVyLCBsYXJnZVN0cmluZywgeyBsYXJnZVRlc3Q6IHRydWUgfSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgndW50aXRsZWQgZmlsZSAobGFyZ2UgZmlsZSwgcmVhZGFibGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodW50aXRsZWRGaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXHRcdFx0Y29uc3QgbGFyZ2VTdHJpbmcgPSAobmV3IEFycmF5KDMwICogMTAyNCkpLmpvaW4oJ0xhcmdlIFN0cmluZ1xcbicpO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGFyZ2VTdHJpbmcpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCB0b0J1ZmZlck9yUmVhZGFibGUobW9kZWwuY3JlYXRlU25hcHNob3QoKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICd1bnRpdGxlZCcpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZShiYWNrdXBQYXRoKSkudmFsdWUudG9TdHJpbmcoKSwgdG9FeHBlY3RlZFByZWFtYmxlKGlkZW50aWZpZXIsIGxhcmdlU3RyaW5nKSk7XG5cdFx0XHRhc3NlcnQub2soc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnY2FuY2VsbGF0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRjb25zdCBwcm9taXNlID0gc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgY3RzLnRva2VuKTtcblx0XHRcdGN0cy5jYW5jZWwoKTtcblx0XHRcdGF3YWl0IHByb21pc2U7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0Lm9rKCFzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGlwbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIpLFxuXHRcdFx0XHRzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyKSxcblx0XHRcdFx0c2VydmljZS5iYWNrdXAoaWRlbnRpZmllciksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIpXG5cdFx0XHRdKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICdmaWxlJykpKS5jaGlsZHJlbj8ubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpLCB0b0V4cGVjdGVkUHJlYW1ibGUoaWRlbnRpZmllcikpO1xuXHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXBsZSBzYW1lIHJlc291cmNlLCBkaWZmZXJlbnQgdHlwZSBpZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGJhY2t1cElkMSA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBJZDIgPSB0b1R5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlLCAndHlwZTEnKTtcblx0XHRcdGNvbnN0IGJhY2t1cElkMyA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUsICd0eXBlMicpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMSksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMiksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMylcblx0XHRcdF0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDMpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGJhY2t1cElkIG9mIFtiYWNrdXBJZDEsIGJhY2t1cElkMiwgYmFja3VwSWQzXSkge1xuXHRcdFx0XHRjb25zdCBmb29CYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgYmFja3VwSWQucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhmb29CYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGZvb0JhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpLCB0b0V4cGVjdGVkUHJlYW1ibGUoYmFja3VwSWQpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaGFzQmFja3VwU3luYyhiYWNrdXBJZCkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZGlzY2FyZEJhY2t1cCcsICgpID0+IHtcblxuXHRcdHRlc3QoJ2pvaW5pbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICdmaWxlJykpKS5jaGlsZHJlbj8ubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRsZXQgYmFja3VwSm9pbmVkID0gZmFsc2U7XG5cdFx0XHRzZXJ2aWNlLmpvaW5CYWNrdXBzKCkudGhlbigoKSA9PiBiYWNrdXBKb2luZWQgPSB0cnVlKTtcblxuXHRcdFx0Y29uc3QgZGlzY2FyZEJhY2t1cFByb21pc2UgPSBzZXJ2aWNlLmRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3VwSm9pbmVkLCBmYWxzZSk7XG5cdFx0XHRhd2FpdCBkaXNjYXJkQmFja3VwUHJvbWlzZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXBKb2luZWQsIHRydWUpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQub2soIXNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd0ZXh0IGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICdmaWxlJykpKS5jaGlsZHJlbj8ubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5vayhzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXAoaWRlbnRpZmllcik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMCk7XG5cdFx0XHRhc3NlcnQub2soIXNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd1bnRpdGxlZCBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgaWRlbnRpZmllciA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodW50aXRsZWRGaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBpZGVudGlmaWVyLnJlc291cmNlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoaWRlbnRpZmllcikpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICd1bnRpdGxlZCcpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMSk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuZGlzY2FyZEJhY2t1cChpZGVudGlmaWVyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZXNvbHZlKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICd1bnRpdGxlZCcpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXBsZSBzYW1lIHJlc291cmNlLCBkaWZmZXJlbnQgdHlwZSBpZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGJhY2t1cElkMSA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBJZDIgPSB0b1R5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlLCAndHlwZTEnKTtcblx0XHRcdGNvbnN0IGJhY2t1cElkMyA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUsICd0eXBlMicpO1xuXG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMSksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMiksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKGJhY2t1cElkMylcblx0XHRcdF0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDMpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGJhY2t1cElkIG9mIFtiYWNrdXBJZDEsIGJhY2t1cElkMiwgYmFja3VwSWQzXSkge1xuXHRcdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgYmFja3VwSWQucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCkpO1xuXHRcdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXAoYmFja3VwSWQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdH1cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAnZmlsZScpKSkuY2hpbGRyZW4/Lmxlbmd0aCwgMCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdkaXNjYXJkQmFja3VwcyAoYWxsKScsICgpID0+IHtcblx0XHR0ZXN0KCd0ZXh0IGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYWNrdXBJZDEgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpO1xuXHRcdFx0Y29uc3QgYmFja3VwSWQyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChiYXJGaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cElkMyA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGJhckZpbGUpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDEsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDIsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDMsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDMpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXBzKCk7XG5cdFx0XHRmb3IgKGNvbnN0IGJhY2t1cElkIG9mIFtiYWNrdXBJZDEsIGJhY2t1cElkMiwgYmFja3VwSWQzXSkge1xuXHRcdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgYmFja3VwSWQucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdH1cblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd1bnRpdGxlZCBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgYmFja3VwSWQgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSk7XG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgYmFja3VwSWQucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCkpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZCwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCd0ZXN0JykpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAndW50aXRsZWQnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXBzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsICd1bnRpdGxlZCcpKSksIGZhbHNlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NhbiBiYWNrdXAgYWZ0ZXIgZGlzY2FyZGluZyBhbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXBzKCk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cCh0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyh3b3Jrc3BhY2VCYWNrdXBQYXRoKSksIHRydWUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZGlzY2FyZEJhY2t1cHMgKGV4Y2VwdCBzb21lKScsICgpID0+IHtcblx0XHR0ZXN0KCd0ZXh0IGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYWNrdXBJZDEgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpO1xuXHRcdFx0Y29uc3QgYmFja3VwSWQyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChiYXJGaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cElkMyA9IHRvVHlwZWRXb3JraW5nQ29weUlkKGJhckZpbGUpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDEsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDIsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChiYWNrdXBJZDMsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlc29sdmUoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgJ2ZpbGUnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDMpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXBzKHsgZXhjZXB0OiBbYmFja3VwSWQyLCBiYWNrdXBJZDNdIH0pO1xuXG5cdFx0XHRsZXQgYmFja3VwUGF0aCA9IGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIGJhY2t1cElkMS5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGJhY2t1cElkMSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCBmYWxzZSk7XG5cblx0XHRcdGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBiYWNrdXBJZDIucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZDIpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgdHJ1ZSk7XG5cblx0XHRcdGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBiYWNrdXBJZDMucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZDMpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKGJhY2t1cFBhdGgpKSwgdHJ1ZSk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuZGlzY2FyZEJhY2t1cHMoeyBleGNlcHQ6IFtiYWNrdXBJZDFdIH0pO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGJhY2t1cElkIG9mIFtiYWNrdXBJZDEsIGJhY2t1cElkMiwgYmFja3VwSWQzXSkge1xuXHRcdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgYmFja3VwSWQucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihiYWNrdXBJZCkpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhiYWNrdXBQYXRoKSksIGZhbHNlKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRlc3QoJ3VudGl0bGVkIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBiYWNrdXBJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQodW50aXRsZWRGaWxlKTtcblx0XHRcdGNvbnN0IGJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBiYWNrdXBJZC5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGJhY2t1cElkKSk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuYmFja3VwKGJhY2t1cElkLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVzb2x2ZShqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCAndW50aXRsZWQnKSkpLmNoaWxkcmVuPy5sZW5ndGgsIDEpO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRpc2NhcmRCYWNrdXBzKHsgZXhjZXB0OiBbYmFja3VwSWRdIH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoYmFja3VwUGF0aCkpLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2dldEJhY2t1cHMnLCAoKSA9PiB7XG5cdFx0dGVzdCgndGV4dCBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRzZXJ2aWNlLmJhY2t1cCh0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLmZyb21TdHJpbmcoJ3Rlc3QnKSkpLFxuXHRcdFx0XHRzZXJ2aWNlLmJhY2t1cCh0b1R5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlLCAndHlwZTEnKSwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCd0ZXN0JykpKSxcblx0XHRcdFx0c2VydmljZS5iYWNrdXAodG9UeXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSwgJ3R5cGUyJyksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSlcblx0XHRcdF0pO1xuXG5cdFx0XHRsZXQgYmFja3VwcyA9IGF3YWl0IHNlcnZpY2UuZ2V0QmFja3VwcygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cHMubGVuZ3RoLCAzKTtcblxuXHRcdFx0Zm9yIChjb25zdCBiYWNrdXAgb2YgYmFja3Vwcykge1xuXHRcdFx0XHRpZiAoYmFja3VwLnR5cGVJZCA9PT0gJycpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3VwLnJlc291cmNlLnRvU3RyaW5nKCksIGZvb0ZpbGUudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoYmFja3VwLnR5cGVJZCA9PT0gJ3R5cGUxJykge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXAucmVzb3VyY2UudG9TdHJpbmcoKSwgZm9vRmlsZS50b1N0cmluZygpKTtcblx0XHRcdFx0fSBlbHNlIGlmIChiYWNrdXAudHlwZUlkID09PSAndHlwZTInKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cC5yZXNvdXJjZS50b1N0cmluZygpLCBmb29GaWxlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFzc2VydC5mYWlsKCdVbmV4cGVjdGVkIGJhY2t1cCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuYmFja3VwKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoYmFyRmlsZSksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSk7XG5cblx0XHRcdGJhY2t1cHMgPSBhd2FpdCBzZXJ2aWNlLmdldEJhY2t1cHMoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXBzLmxlbmd0aCwgNCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd1bnRpdGxlZCBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHRzZXJ2aWNlLmJhY2t1cCh0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKHRvVHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSwgJ3R5cGUxJyksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSksXG5cdFx0XHRcdHNlcnZpY2UuYmFja3VwKHRvVHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSwgJ3R5cGUyJyksIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygndGVzdCcpKSlcblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCBiYWNrdXBzID0gYXdhaXQgc2VydmljZS5nZXRCYWNrdXBzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3Vwcy5sZW5ndGgsIDMpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGJhY2t1cCBvZiBiYWNrdXBzKSB7XG5cdFx0XHRcdGlmIChiYWNrdXAudHlwZUlkID09PSAnJykge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXAucmVzb3VyY2UudG9TdHJpbmcoKSwgdW50aXRsZWRGaWxlLnRvU3RyaW5nKCkpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGJhY2t1cC50eXBlSWQgPT09ICd0eXBlMScpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3VwLnJlc291cmNlLnRvU3RyaW5nKCksIHVudGl0bGVkRmlsZS50b1N0cmluZygpKTtcblx0XHRcdFx0fSBlbHNlIGlmIChiYWNrdXAudHlwZUlkID09PSAndHlwZTInKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cC5yZXNvdXJjZS50b1N0cmluZygpLCB1bnRpdGxlZEZpbGUudG9TdHJpbmcoKSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1VuZXhwZWN0ZWQgYmFja3VwJyk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3Jlc29sdmUnLCAoKSA9PiB7XG5cblx0XHRpbnRlcmZhY2UgSUJhY2t1cFRlc3RNZXRhRGF0YSBleHRlbmRzIElXb3JraW5nQ29weUJhY2t1cE1ldGEge1xuXHRcdFx0bXRpbWU/OiBudW1iZXI7XG5cdFx0XHRzaXplPzogbnVtYmVyO1xuXHRcdFx0ZXRhZz86IHN0cmluZztcblx0XHRcdG9ycGhhbmVkPzogYm9vbGVhbjtcblx0XHR9XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHVudGl0bGVkIGZpbGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSAndGVzdFxcbmFuZCBtb3JlIHN0dWZmJztcblxuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAodW50aXRsZWRGaWxlLCBjb250ZW50cyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHVudGl0bGVkIGZpbGUgd2l0aCBtZXRhZGF0YSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9ICd0ZXN0XFxuYW5kIG1vcmUgc3R1ZmYnO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlIEV0YWcnLFxuXHRcdFx0XHRzaXplOiA2NjYsXG5cdFx0XHRcdG10aW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRvcnBoYW5lZDogdHJ1ZVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAodW50aXRsZWRGaWxlLCBjb250ZW50cywgbWV0YSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHVudGl0bGVkIGZpbGUgZW1wdHkgd2l0aCBtZXRhZGF0YSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9ICcnO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlIEV0YWcnLFxuXHRcdFx0XHRzaXplOiA2NjYsXG5cdFx0XHRcdG10aW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRvcnBoYW5lZDogdHJ1ZVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAodW50aXRsZWRGaWxlLCBjb250ZW50cywgbWV0YSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHVudGl0bGVkIGxhcmdlIGZpbGUgd2l0aCBtZXRhZGF0YSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb250ZW50cyA9IChuZXcgQXJyYXkoMzAgKiAxMDI0KSkuam9pbignTGFyZ2UgU3RyaW5nXFxuJyk7XG5cblx0XHRcdGNvbnN0IG1ldGEgPSB7XG5cdFx0XHRcdGV0YWc6ICd0aGUgRXRhZycsXG5cdFx0XHRcdHNpemU6IDY2Nixcblx0XHRcdFx0bXRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdG9ycGhhbmVkOiB0cnVlXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cCh1bnRpdGxlZEZpbGUsIGNvbnRlbnRzLCBtZXRhKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZXN0b3JlIHRoZSBvcmlnaW5hbCBjb250ZW50cyAodGV4dCBmaWxlKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0XHQnTG9yZW0gaXBzdW0gJyxcblx0XHRcdFx0J2RvbG9yIFx1MDBGNlx1MDBFNFx1MDBGQyBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnY29uc2VjdGV0dXIgJyxcblx0XHRcdFx0J2FkaXBpc2NpbmcgXHUwMERGXHUwMERGIGVsaXQnXG5cdFx0XHRdLmpvaW4oJycpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cChmb29GaWxlLCBjb250ZW50cyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHRleHQgZmlsZSAtIGN1c3RvbSBzY2hlbWUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSBbXG5cdFx0XHRcdCdMb3JlbSBpcHN1bSAnLFxuXHRcdFx0XHQnZG9sb3IgXHUwMEY2XHUwMEU0XHUwMEZDIHNpdCBhbWV0ICcsXG5cdFx0XHRcdCdjb25zZWN0ZXR1ciAnLFxuXHRcdFx0XHQnYWRpcGlzY2luZyBcdTAwREZcdTAwREYgZWxpdCdcblx0XHRcdF0uam9pbignJyk7XG5cblx0XHRcdGF3YWl0IHRlc3RSZXNvbHZlQmFja3VwKGN1c3RvbUZpbGUsIGNvbnRlbnRzKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZXN0b3JlIHRoZSBvcmlnaW5hbCBjb250ZW50cyAodGV4dCBmaWxlIHdpdGggbWV0YWRhdGEpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSBbXG5cdFx0XHRcdCdMb3JlbSBpcHN1bSAnLFxuXHRcdFx0XHQnZG9sb3IgXHUwMEY2XHUwMEU0XHUwMEZDIHNpdCBhbWV0ICcsXG5cdFx0XHRcdCdhZGlwaXNjaW5nIFx1MDBERlx1MDBERiBlbGl0Jyxcblx0XHRcdFx0J2NvbnNlY3RldHVyICdcblx0XHRcdF0uam9pbignJyk7XG5cblx0XHRcdGNvbnN0IG1ldGEgPSB7XG5cdFx0XHRcdGV0YWc6ICd0aGVFdGFnJyxcblx0XHRcdFx0c2l6ZTogODg4LFxuXHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0b3JwaGFuZWQ6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cChmb29GaWxlLCBjb250ZW50cywgbWV0YSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKGVtcHR5IHRleHQgZmlsZSB3aXRoIG1ldGFkYXRhKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gJyc7XG5cblx0XHRcdGNvbnN0IG1ldGEgPSB7XG5cdFx0XHRcdGV0YWc6ICd0aGVFdGFnJyxcblx0XHRcdFx0c2l6ZTogODg4LFxuXHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0b3JwaGFuZWQ6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cChmb29GaWxlLCBjb250ZW50cywgbWV0YSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKGxhcmdlIHRleHQgZmlsZSB3aXRoIG1ldGFkYXRhKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gKG5ldyBBcnJheSgzMCAqIDEwMjQpKS5qb2luKCdMYXJnZSBTdHJpbmdcXG4nKTtcblxuXHRcdFx0Y29uc3QgbWV0YSA9IHtcblx0XHRcdFx0ZXRhZzogJ3RoZUV0YWcnLFxuXHRcdFx0XHRzaXplOiA4ODgsXG5cdFx0XHRcdG10aW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRvcnBoYW5lZDogZmFsc2Vcblx0XHRcdH07XG5cblx0XHRcdGF3YWl0IHRlc3RSZXNvbHZlQmFja3VwKGZvb0ZpbGUsIGNvbnRlbnRzLCBtZXRhKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZXN0b3JlIHRoZSBvcmlnaW5hbCBjb250ZW50cyAodGV4dCBmaWxlIHdpdGggbWV0YWRhdGEgY2hhbmdlZCBvbmNlKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0XHQnTG9yZW0gaXBzdW0gJyxcblx0XHRcdFx0J2RvbG9yIFx1MDBGNlx1MDBFNFx1MDBGQyBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnYWRpcGlzY2luZyBcdTAwREZcdTAwREYgZWxpdCcsXG5cdFx0XHRcdCdjb25zZWN0ZXR1ciAnXG5cdFx0XHRdLmpvaW4oJycpO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlRXRhZycsXG5cdFx0XHRcdHNpemU6IDg4OCxcblx0XHRcdFx0bXRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdG9ycGhhbmVkOiBmYWxzZVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAoZm9vRmlsZSwgY29udGVudHMsIG1ldGEpO1xuXG5cdFx0XHQvLyBDaGFuZ2UgbWV0YSBhbmQgdGVzdCBhZ2FpblxuXHRcdFx0bWV0YS5zaXplID0gOTk5O1xuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAoZm9vRmlsZSwgY29udGVudHMsIG1ldGEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGNvbnRlbnRzICh0ZXh0IGZpbGUgd2l0aCBtZXRhZGF0YSBhbmQgZnJhZ21lbnQgVVJJKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0XHQnTG9yZW0gaXBzdW0gJyxcblx0XHRcdFx0J2RvbG9yIFx1MDBGNlx1MDBFNFx1MDBGQyBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnYWRpcGlzY2luZyBcdTAwREZcdTAwREYgZWxpdCcsXG5cdFx0XHRcdCdjb25zZWN0ZXR1ciAnXG5cdFx0XHRdLmpvaW4oJycpO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlRXRhZycsXG5cdFx0XHRcdHNpemU6IDg4OCxcblx0XHRcdFx0bXRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdG9ycGhhbmVkOiBmYWxzZVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgdGVzdFJlc29sdmVCYWNrdXAoY3VzdG9tRmlsZVdpdGhGcmFnbWVudCwgY29udGVudHMsIG1ldGEpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHJlc3RvcmUgdGhlIG9yaWdpbmFsIGNvbnRlbnRzICh0ZXh0IGZpbGUgd2l0aCBzcGFjZSBpbiBuYW1lIHdpdGggbWV0YWRhdGEpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSBbXG5cdFx0XHRcdCdMb3JlbSBpcHN1bSAnLFxuXHRcdFx0XHQnZG9sb3IgXHUwMEY2XHUwMEU0XHUwMEZDIHNpdCBhbWV0ICcsXG5cdFx0XHRcdCdhZGlwaXNjaW5nIFx1MDBERlx1MDBERiBlbGl0Jyxcblx0XHRcdFx0J2NvbnNlY3RldHVyICdcblx0XHRcdF0uam9pbignJyk7XG5cblx0XHRcdGNvbnN0IG1ldGEgPSB7XG5cdFx0XHRcdGV0YWc6ICd0aGVFdGFnJyxcblx0XHRcdFx0c2l6ZTogODg4LFxuXHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0b3JwaGFuZWQ6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cChmb29CYXJGaWxlLCBjb250ZW50cywgbWV0YSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHRleHQgZmlsZSB3aXRoIHRvbyBsYXJnZSBtZXRhZGF0YSB0byBwZXJzaXN0KScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0XHQnTG9yZW0gaXBzdW0gJyxcblx0XHRcdFx0J2RvbG9yIFx1MDBGNlx1MDBFNFx1MDBGQyBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnYWRpcGlzY2luZyBcdTAwREZcdTAwREYgZWxpdCcsXG5cdFx0XHRcdCdjb25zZWN0ZXR1ciAnXG5cdFx0XHRdLmpvaW4oJycpO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAobmV3IEFycmF5KDEwMCAqIDEwMjQpKS5qb2luKCdMYXJnZSBTdHJpbmcnKSxcblx0XHRcdFx0c2l6ZTogODg4LFxuXHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0b3JwaGFuZWQ6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCB0ZXN0UmVzb2x2ZUJhY2t1cChmb29GaWxlLCBjb250ZW50cywgbWV0YSwgdHJ1ZSk7XG5cdFx0fSk7XG5cblx0XHRhc3luYyBmdW5jdGlvbiB0ZXN0UmVzb2x2ZUJhY2t1cChyZXNvdXJjZTogVVJJLCBjb250ZW50czogc3RyaW5nLCBtZXRhPzogSUJhY2t1cFRlc3RNZXRhRGF0YSwgZXhwZWN0Tm9NZXRhPzogYm9vbGVhbikge1xuXHRcdFx0YXdhaXQgZG9UZXN0UmVzb2x2ZUJhY2t1cCh0b1VudHlwZWRXb3JraW5nQ29weUlkKHJlc291cmNlKSwgY29udGVudHMsIG1ldGEsIGV4cGVjdE5vTWV0YSk7XG5cdFx0XHRhd2FpdCBkb1Rlc3RSZXNvbHZlQmFja3VwKHRvVHlwZWRXb3JraW5nQ29weUlkKHJlc291cmNlKSwgY29udGVudHMsIG1ldGEsIGV4cGVjdE5vTWV0YSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgZnVuY3Rpb24gZG9UZXN0UmVzb2x2ZUJhY2t1cChpZGVudGlmaWVyOiBJV29ya2luZ0NvcHlJZGVudGlmaWVyLCBjb250ZW50czogc3RyaW5nLCBtZXRhPzogSUJhY2t1cFRlc3RNZXRhRGF0YSwgZXhwZWN0Tm9NZXRhPzogYm9vbGVhbikge1xuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSksIDEsIG1ldGEpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmU8SUJhY2t1cFRlc3RNZXRhRGF0YT4oaWRlbnRpZmllcik7XG5cdFx0XHRhc3NlcnQub2soYmFja3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50cywgKGF3YWl0IHN0cmVhbVRvQnVmZmVyKGJhY2t1cC52YWx1ZSkpLnRvU3RyaW5nKCkpO1xuXG5cdFx0XHRpZiAoZXhwZWN0Tm9NZXRhIHx8ICFtZXRhKSB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXAubWV0YSwgdW5kZWZpbmVkKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5vayhiYWNrdXAubWV0YSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXAubWV0YS5ldGFnLCBtZXRhLmV0YWcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3VwLm1ldGEuc2l6ZSwgbWV0YS5zaXplKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cC5tZXRhLm10aW1lLCBtZXRhLm10aW1lKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cC5tZXRhLm9ycGhhbmVkLCBtZXRhLm9ycGhhbmVkKTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoT2JqZWN0LmtleXMobWV0YSkubGVuZ3RoLCBPYmplY3Qua2V5cyhiYWNrdXAubWV0YSkubGVuZ3RoKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0ZXN0KCdzaG91bGQgcmVzdG9yZSB0aGUgb3JpZ2luYWwgY29udGVudHMgKHRleHQgZmlsZSB3aXRoIGJyb2tlbiBtZXRhZGF0YSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0ZXN0U2hvdWxkUmVzdG9yZU9yaWdpbmFsQ29udGVudHNXaXRoQnJva2VuQmFja3VwKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSkpO1xuXHRcdFx0YXdhaXQgdGVzdFNob3VsZFJlc3RvcmVPcmlnaW5hbENvbnRlbnRzV2l0aEJyb2tlbkJhY2t1cCh0b1R5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKSk7XG5cdFx0fSk7XG5cblx0XHRhc3luYyBmdW5jdGlvbiB0ZXN0U2hvdWxkUmVzdG9yZU9yaWdpbmFsQ29udGVudHNXaXRoQnJva2VuQmFja3VwKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gW1xuXHRcdFx0XHQnTG9yZW0gaXBzdW0gJyxcblx0XHRcdFx0J2RvbG9yIFx1MDBGNlx1MDBFNFx1MDBGQyBzaXQgYW1ldCAnLFxuXHRcdFx0XHQnYWRpcGlzY2luZyBcdTAwREZcdTAwREYgZWxpdCcsXG5cdFx0XHRcdCdjb25zZWN0ZXR1ciAnXG5cdFx0XHRdLmpvaW4oJycpO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlRXRhZycsXG5cdFx0XHRcdHNpemU6IDg4OCxcblx0XHRcdFx0bXRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdG9ycGhhbmVkOiBmYWxzZVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAoaWRlbnRpZmllciwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSksIDEsIG1ldGEpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgaWRlbnRpZmllci5yZXNvdXJjZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGlkZW50aWZpZXIpKTtcblxuXHRcdFx0Y29uc3QgZmlsZUNvbnRlbnRzID0gKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVDb250ZW50cy5pbmRleE9mKGlkZW50aWZpZXIucmVzb3VyY2UudG9TdHJpbmcoKSksIDApO1xuXG5cdFx0XHRjb25zdCBtZXRhSW5kZXggPSBmaWxlQ29udGVudHMuaW5kZXhPZigneycpO1xuXHRcdFx0Y29uc3QgbmV3RmlsZUNvbnRlbnRzID0gZmlsZUNvbnRlbnRzLnN1YnN0cmluZygwLCBtZXRhSW5kZXgpICsgJ3t7JyArIGZpbGVDb250ZW50cy5zdWJzdHIobWV0YUluZGV4KTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShiYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKG5ld0ZpbGVDb250ZW50cykpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXAgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmUoaWRlbnRpZmllcik7XG5cdFx0XHRhc3NlcnQub2soYmFja3VwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb250ZW50cywgKGF3YWl0IHN0cmVhbVRvQnVmZmVyKGJhY2t1cC52YWx1ZSkpLnRvU3RyaW5nKCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cC5tZXRhLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHRlc3QoJ3Nob3VsZCB1cGRhdGUgbWV0YWRhdGEgZnJvbSBmaWxlIGludG8gbW9kZWwgd2hlbiByZXNvbHZpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCB0ZXN0U2hvdWxkVXBkYXRlTWV0YUZyb21GaWxlV2hlblJlc29sdmluZyh0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpKTtcblx0XHRcdGF3YWl0IHRlc3RTaG91bGRVcGRhdGVNZXRhRnJvbUZpbGVXaGVuUmVzb2x2aW5nKHRvVHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpKTtcblx0XHR9KTtcblxuXHRcdGFzeW5jIGZ1bmN0aW9uIHRlc3RTaG91bGRVcGRhdGVNZXRhRnJvbUZpbGVXaGVuUmVzb2x2aW5nKGlkZW50aWZpZXI6IElXb3JraW5nQ29weUlkZW50aWZpZXIpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRcdGNvbnN0IGNvbnRlbnRzID0gJ0ZvbyBCYXInO1xuXG5cdFx0XHRjb25zdCBtZXRhID0ge1xuXHRcdFx0XHRldGFnOiAndGhlRXRhZ0ZvclRoaXNNZXRhZGF0YVRlc3QnLFxuXHRcdFx0XHRzaXplOiA4ODgsXG5cdFx0XHRcdG10aW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRvcnBoYW5lZDogZmFsc2Vcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHVwZGF0ZWRNZXRhID0ge1xuXHRcdFx0XHQuLi5tZXRhLFxuXHRcdFx0XHRldGFnOiBtZXRhLmV0YWcgKyBtZXRhLmV0YWdcblx0XHRcdH07XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UuYmFja3VwKGlkZW50aWZpZXIsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50cykpLCAxLCBtZXRhKTtcblxuXHRcdFx0Y29uc3QgYmFja3VwUGF0aCA9IGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIGlkZW50aWZpZXIucmVzb3VyY2Uuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihpZGVudGlmaWVyKSk7XG5cblx0XHRcdC8vIFNpbXVsYXRlIHRoZSBjb25kaXRpb24gb2YgdGhlIGJhY2t1cHMgbW9kZWwgbG9hZGluZyBpbml0aWFsbHkgd2l0aG91dFxuXHRcdFx0Ly8gbWV0YSBkYXRhIGluZm9ybWF0aW9uIGFuZCB0aGVuIGdldHRpbmcgdGhlIG1ldGEgZGF0YSB1cGRhdGVkIG9uIHRoZVxuXHRcdFx0Ly8gZmlyc3QgY2FsbCB0byByZXNvbHZlIHRoZSBiYWNrdXAuIFdlIHNpbXVsYXRlIHRoaXMgYnkgZXhwbGljaXRseSBjaGFuZ2luZ1xuXHRcdFx0Ly8gdGhlIG1ldGEgZGF0YSBpbiB0aGUgZmlsZSBhbmQgdGhlbiB2ZXJpZnlpbmcgdGhhdCB0aGUgdXBkYXRlZCBtZXRhIGRhdGFcblx0XHRcdC8vIGlzIHBlcnNpc3RlZCBiYWNrIGludG8gdGhlIG1vZGVsICh2ZXJpZmllZCB2aWEgYGhhc0JhY2t1cFN5bmNgKS5cblx0XHRcdC8vIFRoaXMgaXMgbm90IHJlYWxseSBzb21ldGhpbmcgdGhhdCB3b3VsZCBoYXBwZW4gaW4gcmVhbCBsaWZlIGJlY2F1c2UgYW55XG5cdFx0XHQvLyBiYWNrdXAgdGhhdCBpcyBtYWRlIHZpYSBiYWNrdXAgc2VydmljZSB3aWxsIHVwZGF0ZSB0aGUgbW9kZWwgYWNjb3JkaW5nbHkuXG5cblx0XHRcdGNvbnN0IG9yaWdpbmFsRmlsZUNvbnRlbnRzID0gKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKGJhY2t1cFBhdGgpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGJhY2t1cFBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcob3JpZ2luYWxGaWxlQ29udGVudHMucmVwbGFjZShtZXRhLmV0YWcsIHVwZGF0ZWRNZXRhLmV0YWcpKSk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UucmVzb2x2ZShpZGVudGlmaWVyKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuaGFzQmFja3VwU3luYyhpZGVudGlmaWVyLCB1bmRlZmluZWQsIG1ldGEpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIsIHVuZGVmaW5lZCwgdXBkYXRlZE1ldGEpLCB0cnVlKTtcblxuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGJhY2t1cFBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcob3JpZ2luYWxGaWxlQ29udGVudHMpKTtcblxuXHRcdFx0YXdhaXQgc2VydmljZS5nZXRCYWNrdXBzKCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0JhY2t1cFN5bmMoaWRlbnRpZmllciwgdW5kZWZpbmVkLCBtZXRhKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNCYWNrdXBTeW5jKGlkZW50aWZpZXIsIHVuZGVmaW5lZCwgdXBkYXRlZE1ldGEpLCBmYWxzZSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnc2hvdWxkIGlnbm9yZSBpbnZhbGlkIGJhY2t1cHMgKGVtcHR5IGZpbGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSAndGVzdFxcbmFuZCBtb3JlIHN0dWZmJztcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAodG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKSwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSksIDEpO1xuXG5cdFx0XHRsZXQgYmFja3VwID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cCk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UudGVzdEdldEZpbGVTZXJ2aWNlKCkud3JpdGVGaWxlKHNlcnZpY2UudG9CYWNrdXBSZXNvdXJjZSh0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpKSwgVlNCdWZmZXIuZnJvbVN0cmluZygnJykpO1xuXG5cdFx0XHRiYWNrdXAgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmU8SUJhY2t1cFRlc3RNZXRhRGF0YT4odG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKSk7XG5cdFx0XHRhc3NlcnQub2soIWJhY2t1cCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIGludmFsaWQgYmFja3VwcyAobm8gcHJlYW1ibGUpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29udGVudHMgPSAndGVzdGFuZCBtb3JlIHN0dWZmJztcblxuXHRcdFx0YXdhaXQgc2VydmljZS5iYWNrdXAodG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKSwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnRzKSksIDEpO1xuXG5cdFx0XHRsZXQgYmFja3VwID0gYXdhaXQgc2VydmljZS5yZXNvbHZlKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cCk7XG5cblx0XHRcdGF3YWl0IHNlcnZpY2UudGVzdEdldEZpbGVTZXJ2aWNlKCkud3JpdGVGaWxlKHNlcnZpY2UudG9CYWNrdXBSZXNvdXJjZSh0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpKSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50cykpO1xuXG5cdFx0XHRiYWNrdXAgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmU8SUJhY2t1cFRlc3RNZXRhRGF0YT4odG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKSk7XG5cdFx0XHRhc3NlcnQub2soIWJhY2t1cCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdmaWxlIHdpdGggYmluYXJ5IGRhdGEnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBpZGVudGlmaWVyID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblxuXHRcdFx0Y29uc3QgYnVmZmVyID0gVWludDhBcnJheS5mcm9tKFtcblx0XHRcdFx0MTM3LCA4MCwgNzgsIDcxLCAxMywgMTAsIDI2LCAxMCwgMCwgMCwgMCwgMTMsIDczLCA3MiwgNjgsIDgyLCAwLCAwLCAwLCA3MywgMCwgMCwgMCwgNjcsIDgsIDIsIDAsIDAsIDAsIDk1LCAxMzgsIDE5MSwgMjM3LCAwLCAwLCAwLCAxLCAxMTUsIDgyLCA3MSwgNjYsIDAsIDE3NCwgMjA2LCAyOCwgMjMzLCAwLCAwLCAwLCA0LCAxMDMsIDY1LCA3NywgNjUsIDAsIDAsIDE3NywgMTQzLCAxMSwgMjUyLCA5NywgNSwgMCwgMCwgMCwgOSwgMTEyLCA3MiwgODksIDExNSwgMCwgMCwgMTQsIDE5NSwgMCwgMCwgMTQsIDE5NSwgMSwgMTk5LCAxMTEsIDE2OCwgMTAwLCAwLCAwLCAwLCA3MSwgMTE2LCA2OSwgODgsIDExNiwgODMsIDExMSwgMTE3LCAxMTQsIDk5LCAxMDEsIDAsIDgzLCAxMDQsIDExMSwgMTE2LCAxMTYsIDEyMSwgMzIsIDExOCwgNTAsIDQ2LCA0OCwgNDYsIDUwLCA0NiwgNTAsIDQ5LCA1NCwgMzIsIDQwLCA2NywgNDEsIDMyLCA4NCwgMTA0LCAxMTEsIDEwOSwgOTcsIDExNSwgMzIsIDY2LCA5NywgMTE3LCAxMDksIDk3LCAxMTAsIDExMCwgMzIsIDQ1LCAzMiwgMTA0LCAxMTYsIDExNiwgMTEyLCA1OCwgNDcsIDQ3LCAxMTUsIDEwNCwgMTExLCAxMTYsIDExNiwgMTIxLCA0NiwgMTAwLCAxMDEsIDExOCwgMTE1LCA0NSwgMTExLCAxMTAsIDQ2LCAxMTAsIDEwMSwgMTE2LCA0NCwgMTMyLCAyMSwgMjEzLCAwLCAwLCAwLCA4NCwgNzMsIDY4LCA2NSwgODQsIDEyMCwgMjE4LCAyMzcsIDIwNywgNjUsIDE3LCAwLCAwLCAxMiwgMiwgMzIsIDIxMSwgMjE3LCA2MywgMTQ2LCAzNywgMjQ2LCAyMTgsIDY1LCAzLCAyMTAsIDE5MSwgMjI2LCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDIzMCwgMjMwLCAyMzAsIDExOCwgMTAwLCAxNjksIDQsIDE3MywgOCwgNDQsIDI0OCwgMTg0LCA0MCwgMCwgMCwgMCwgMCwgNzMsIDY5LCA3OCwgNjgsIDE3NCwgNjYsIDk2LCAxMzBcblx0XHRcdF0pO1xuXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmJhY2t1cChpZGVudGlmaWVyLCBidWZmZXJUb1JlYWRhYmxlKFZTQnVmZmVyLndyYXAoYnVmZmVyKSksIHVuZGVmaW5lZCwgeyBiaW5hcnlUZXN0OiAndHJ1ZScgfSk7XG5cblx0XHRcdGNvbnN0IGJhY2t1cCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZSh0b1VudHlwZWRXb3JraW5nQ29weUlkKGZvb0ZpbGUpKTtcblx0XHRcdGFzc2VydC5vayhiYWNrdXApO1xuXG5cdFx0XHRjb25zdCBiYWNrdXBCdWZmZXIgPSBhd2FpdCBjb25zdW1lU3RyZWFtKGJhY2t1cC52YWx1ZSwgY2h1bmtzID0+IFZTQnVmZmVyLmNvbmNhdChjaHVua3MpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiYWNrdXBCdWZmZXIuYnVmZmVyLmJ5dGVMZW5ndGgsIGJ1ZmZlci5ieXRlTGVuZ3RoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ1dvcmtpbmdDb3B5QmFja3Vwc01vZGVsJywgKCkgPT4ge1xuXG5cdFx0dGVzdCgnc2ltcGxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBXb3JraW5nQ29weUJhY2t1cHNNb2RlbC5jcmVhdGUod29ya3NwYWNlQmFja3VwUGF0aCwgc2VydmljZS50ZXN0R2V0RmlsZVNlcnZpY2UoKSk7XG5cblx0XHRcdGNvbnN0IHJlc291cmNlMSA9IFVSSS5maWxlKCd0ZXN0Lmh0bWwnKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTEpLCBmYWxzZSk7XG5cblx0XHRcdG1vZGVsLmFkZChyZXNvdXJjZTEpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlMSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTEsIDApLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2UxLCAxKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTEsIDEsIHsgZm9vOiAnYmFyJyB9KSwgZmFsc2UpO1xuXG5cdFx0XHRtb2RlbC5yZW1vdmUocmVzb3VyY2UxKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTEpLCBmYWxzZSk7XG5cblx0XHRcdG1vZGVsLmFkZChyZXNvdXJjZTEpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlMSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTEsIDApLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2UxLCAxKSwgZmFsc2UpO1xuXG5cdFx0XHRtb2RlbC5jbGVhcigpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlMSksIGZhbHNlKTtcblxuXHRcdFx0bW9kZWwuYWRkKHJlc291cmNlMSwgMSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2UxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlMSwgMCksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2UxLCAxKSwgdHJ1ZSk7XG5cblx0XHRcdGNvbnN0IHJlc291cmNlMiA9IFVSSS5maWxlKCd0ZXN0MS5odG1sJyk7XG5cdFx0XHRjb25zdCByZXNvdXJjZTMgPSBVUkkuZmlsZSgndGVzdDIuaHRtbCcpO1xuXHRcdFx0Y29uc3QgcmVzb3VyY2U0ID0gVVJJLmZpbGUoJ3Rlc3QzLmh0bWwnKTtcblxuXHRcdFx0bW9kZWwuYWRkKHJlc291cmNlMik7XG5cdFx0XHRtb2RlbC5hZGQocmVzb3VyY2UzKTtcblx0XHRcdG1vZGVsLmFkZChyZXNvdXJjZTQsIHVuZGVmaW5lZCwgeyBmb286ICdiYXInIH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlMSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTIpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2UzKSwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2U0KSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlNCwgdW5kZWZpbmVkLCB7IGZvbzogJ2JhcicgfSksIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhyZXNvdXJjZTQsIHVuZGVmaW5lZCwgeyBiYXI6ICdmb28nIH0pLCBmYWxzZSk7XG5cblx0XHRcdG1vZGVsLnVwZGF0ZShyZXNvdXJjZTQsIHsgZm9vOiAnbm90aGluZycgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlNCwgdW5kZWZpbmVkLCB7IGZvbzogJ25vdGhpbmcnIH0pLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2U0LCB1bmRlZmluZWQsIHsgZm9vOiAnYmFyJyB9KSwgZmFsc2UpO1xuXG5cdFx0XHRtb2RlbC51cGRhdGUocmVzb3VyY2U0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5oYXMocmVzb3VyY2U0KSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaGFzKHJlc291cmNlNCwgdW5kZWZpbmVkLCB7IGZvbzogJ25vdGhpbmcnIH0pLCBmYWxzZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjcmVhdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBmb29CYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgZm9vRmlsZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSkpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihkaXJuYW1lKGZvb0JhY2t1cFBhdGgpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShmb29CYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCdmb28nKSk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsLmNyZWF0ZSh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBzZXJ2aWNlLnRlc3RHZXRGaWxlU2VydmljZSgpKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmhhcyhmb29CYWNrdXBQYXRoKSwgdHJ1ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IFdvcmtpbmdDb3B5QmFja3Vwc01vZGVsLmNyZWF0ZSh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBzZXJ2aWNlLnRlc3RHZXRGaWxlU2VydmljZSgpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5nZXQoKSwgW10pO1xuXG5cdFx0XHRjb25zdCBmaWxlMSA9IFVSSS5maWxlKCcvcm9vdC9maWxlL2Zvby5odG1sJyk7XG5cdFx0XHRjb25zdCBmaWxlMiA9IFVSSS5maWxlKCcvcm9vdC9maWxlL2Jhci5odG1sJyk7XG5cdFx0XHRjb25zdCB1bnRpdGxlZCA9IFVSSS5maWxlKCcvcm9vdC91bnRpdGxlZC9iYXIuaHRtbCcpO1xuXG5cdFx0XHRtb2RlbC5hZGQoZmlsZTEpO1xuXHRcdFx0bW9kZWwuYWRkKGZpbGUyKTtcblx0XHRcdG1vZGVsLmFkZCh1bnRpdGxlZCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobW9kZWwuZ2V0KCkubWFwKGYgPT4gZi5mc1BhdGgpLCBbZmlsZTEuZnNQYXRoLCBmaWxlMi5mc1BhdGgsIHVudGl0bGVkLmZzUGF0aF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgndHlwZUlkIG1pZ3JhdGlvbicsICgpID0+IHtcblxuXHRcdHRlc3QoJ3dvcmtzICh3aGVuIG1ldGEgaXMgbWlzc2luZyknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBmb29CYWNrdXBJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoZm9vRmlsZSk7XG5cdFx0XHRjb25zdCB1bnRpdGxlZEJhY2t1cElkID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZCh1bnRpdGxlZEZpbGUpO1xuXHRcdFx0Y29uc3QgY3VzdG9tQmFja3VwSWQgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKGN1c3RvbUZpbGUpO1xuXG5cdFx0XHRjb25zdCBmb29CYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgZm9vRmlsZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGZvb0JhY2t1cElkKSk7XG5cdFx0XHRjb25zdCB1bnRpdGxlZEJhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCB1bnRpdGxlZEZpbGUuc2NoZW1lLCBoYXNoSWRlbnRpZmllcih1bnRpdGxlZEJhY2t1cElkKSk7XG5cdFx0XHRjb25zdCBjdXN0b21GaWxlQmFja3VwUGF0aCA9IGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIGN1c3RvbUZpbGUuc2NoZW1lLCBoYXNoSWRlbnRpZmllcihjdXN0b21CYWNrdXBJZCkpO1xuXG5cdFx0XHQvLyBQcmVwYXJlIGJhY2t1cHMgb2YgdGhlIG9sZCBmb3JtYXQgd2l0aG91dCBtZXRhXG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgZm9vRmlsZS5zY2hlbWUpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCB1bnRpdGxlZEZpbGUuc2NoZW1lKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGb2xkZXIoam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgY3VzdG9tRmlsZS5zY2hlbWUpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZShmb29CYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGAke2Zvb0ZpbGUudG9TdHJpbmcoKX1cXG50ZXN0IGZpbGVgKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodW50aXRsZWRCYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGAke3VudGl0bGVkRmlsZS50b1N0cmluZygpfVxcbnRlc3QgdW50aXRsZWRgKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoY3VzdG9tRmlsZUJhY2t1cFBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcoYCR7Y3VzdG9tRmlsZS50b1N0cmluZygpfVxcbnRlc3QgY3VzdG9tYCkpO1xuXG5cdFx0XHRzZXJ2aWNlLnJlaW5pdGlhbGl6ZSh3b3Jrc3BhY2VCYWNrdXBQYXRoKTtcblxuXHRcdFx0Y29uc3QgYmFja3VwcyA9IGF3YWl0IHNlcnZpY2UuZ2V0QmFja3VwcygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGJhY2t1cHMubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5vayhiYWNrdXBzLnNvbWUoYmFja3VwID0+IGlzRXF1YWwoYmFja3VwLnJlc291cmNlLCBmb29GaWxlKSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cHMuc29tZShiYWNrdXAgPT4gaXNFcXVhbChiYWNrdXAucmVzb3VyY2UsIHVudGl0bGVkRmlsZSkpKTtcblx0XHRcdGFzc2VydC5vayhiYWNrdXBzLnNvbWUoYmFja3VwID0+IGlzRXF1YWwoYmFja3VwLnJlc291cmNlLCBjdXN0b21GaWxlKSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cHMuZXZlcnkoYmFja3VwID0+IGJhY2t1cC50eXBlSWQgPT09ICcnKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3b3JrcyAod2hlbiB0eXBlSWQgaW4gbWV0YSBpcyBtaXNzaW5nKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGZvb0JhY2t1cElkID0gdG9VbnR5cGVkV29ya2luZ0NvcHlJZChmb29GaWxlKTtcblx0XHRcdGNvbnN0IHVudGl0bGVkQmFja3VwSWQgPSB0b1VudHlwZWRXb3JraW5nQ29weUlkKHVudGl0bGVkRmlsZSk7XG5cdFx0XHRjb25zdCBjdXN0b21CYWNrdXBJZCA9IHRvVW50eXBlZFdvcmtpbmdDb3B5SWQoY3VzdG9tRmlsZSk7XG5cblx0XHRcdGNvbnN0IGZvb0JhY2t1cFBhdGggPSBqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBmb29GaWxlLnNjaGVtZSwgaGFzaElkZW50aWZpZXIoZm9vQmFja3VwSWQpKTtcblx0XHRcdGNvbnN0IHVudGl0bGVkQmFja3VwUGF0aCA9IGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIHVudGl0bGVkRmlsZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKHVudGl0bGVkQmFja3VwSWQpKTtcblx0XHRcdGNvbnN0IGN1c3RvbUZpbGVCYWNrdXBQYXRoID0gam9pblBhdGgod29ya3NwYWNlQmFja3VwUGF0aCwgY3VzdG9tRmlsZS5zY2hlbWUsIGhhc2hJZGVudGlmaWVyKGN1c3RvbUJhY2t1cElkKSk7XG5cblx0XHRcdC8vIFByZXBhcmUgYmFja3VwcyBvZiB0aGUgb2xkIGZvcm1hdCB3aXRob3V0IG1ldGFcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBmb29GaWxlLnNjaGVtZSkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHdvcmtzcGFjZUJhY2t1cFBhdGgsIHVudGl0bGVkRmlsZS5zY2hlbWUpKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZvbGRlcihqb2luUGF0aCh3b3Jrc3BhY2VCYWNrdXBQYXRoLCBjdXN0b21GaWxlLnNjaGVtZSkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGZvb0JhY2t1cFBhdGgsIFZTQnVmZmVyLmZyb21TdHJpbmcoYCR7Zm9vRmlsZS50b1N0cmluZygpfSAke0pTT04uc3RyaW5naWZ5KHsgZm9vOiAnYmFyJyB9KX1cXG50ZXN0IGZpbGVgKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodW50aXRsZWRCYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGAke3VudGl0bGVkRmlsZS50b1N0cmluZygpfSAke0pTT04uc3RyaW5naWZ5KHsgZm9vOiAnYmFyJyB9KX1cXG50ZXN0IHVudGl0bGVkYCkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGN1c3RvbUZpbGVCYWNrdXBQYXRoLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGAke2N1c3RvbUZpbGUudG9TdHJpbmcoKX0gJHtKU09OLnN0cmluZ2lmeSh7IGZvbzogJ2JhcicgfSl9XFxudGVzdCBjdXN0b21gKSk7XG5cblx0XHRcdHNlcnZpY2UucmVpbml0aWFsaXplKHdvcmtzcGFjZUJhY2t1cFBhdGgpO1xuXG5cdFx0XHRjb25zdCBiYWNrdXBzID0gYXdhaXQgc2VydmljZS5nZXRCYWNrdXBzKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYmFja3Vwcy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cHMuc29tZShiYWNrdXAgPT4gaXNFcXVhbChiYWNrdXAucmVzb3VyY2UsIGZvb0ZpbGUpKSk7XG5cdFx0XHRhc3NlcnQub2soYmFja3Vwcy5zb21lKGJhY2t1cCA9PiBpc0VxdWFsKGJhY2t1cC5yZXNvdXJjZSwgdW50aXRsZWRGaWxlKSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGJhY2t1cHMuc29tZShiYWNrdXAgPT4gaXNFcXVhbChiYWNrdXAucmVzb3VyY2UsIGN1c3RvbUZpbGUpKSk7XG5cdFx0XHRhc3NlcnQub2soYmFja3Vwcy5ldmVyeShiYWNrdXAgPT4gYmFja3VwLnR5cGVJZCA9PT0gJycpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGNBQWM7QUFDdkIsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsU0FBUyxVQUFVLGVBQWU7QUFDM0MsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsV0FBVztBQUNwQixTQUFTLHlCQUF5QixzQkFBc0I7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LENBQUM7QUFFRCxTQUFLLHlCQUF5QixZQUFZO0FBQ3pDLFlBQU0sYUFBYSx1QkFBdUIsT0FBTztBQUVqRCxZQUFNLFNBQVMsV0FBVyxLQUFLO0FBQUEsUUFDOUI7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBSTtBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUc7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFHO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUk7QUFBQSxRQUFHO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSTtBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFJO0FBQUEsUUFBRztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFLO0FBQUEsUUFBSztBQUFBLFFBQUs7QUFBQSxRQUFHO0FBQUEsUUFBSztBQUFBLFFBQUc7QUFBQSxRQUFJO0FBQUEsUUFBSztBQUFBLFFB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
