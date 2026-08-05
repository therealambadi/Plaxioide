import assert from "assert";
import { createHash } from "crypto";
import * as fs from "fs";
import * as os from "os";
import { Schemas } from "../../../../base/common/network.js";
import * as path from "../../../../base/common/path.js";
import * as platform from "../../../../base/common/platform.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { Promises } from "../../../../base/node/pfs.js";
import { flakySuite, getRandomTestPath } from "../../../../base/test/node/testUtils.js";
import { BackupMainService } from "../../electron-main/backupMainService.js";
import { TestConfigurationService } from "../../../configuration/test/common/testConfigurationService.js";
import { EnvironmentMainService } from "../../../environment/electron-main/environmentMainService.js";
import { OPTIONS, parseArgs } from "../../../environment/node/argv.js";
import { HotExitConfiguration } from "../../../files/common/files.js";
import { ConsoleMainLogger } from "../../../log/common/log.js";
import product from "../../../product/common/product.js";
import { isFolderBackupInfo } from "../../common/backup.js";
import { InMemoryTestStateMainService } from "../../../test/electron-main/workbenchTestServices.js";
import { LogService } from "../../../log/common/logService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
flakySuite("BackupMainService", () => {
  function assertEqualFolderInfos(actual, expected) {
    const withUriAsString = (f) => ({ folderUri: f.folderUri.toString(), remoteAuthority: f.remoteAuthority });
    assert.deepStrictEqual(actual.map(withUriAsString), expected.map(withUriAsString));
  }
  function toWorkspace(path2) {
    return {
      id: createHash("md5").update(sanitizePath(path2)).digest("hex"),
      // CodeQL [SM04514] Using MD5 to convert a file path to a fixed length
      configPath: URI.file(path2)
    };
  }
  function toWorkspaceBackupInfo(path2, remoteAuthority) {
    return {
      workspace: {
        id: createHash("md5").update(sanitizePath(path2)).digest("hex"),
        // CodeQL [SM04514] Using MD5 to convert a file path to a fixed length
        configPath: URI.file(path2)
      },
      remoteAuthority
    };
  }
  function toFolderBackupInfo(uri, remoteAuthority) {
    return { folderUri: uri, remoteAuthority };
  }
  function toSerializedWorkspace(ws) {
    return {
      id: ws.id,
      configURIPath: ws.configPath.toString()
    };
  }
  function ensureFolderExists(uri) {
    if (!fs.existsSync(uri.fsPath)) {
      fs.mkdirSync(uri.fsPath);
    }
    const backupFolder = service.toBackupPath(uri);
    return createBackupFolder(backupFolder);
  }
  async function ensureWorkspaceExists(workspace) {
    if (!fs.existsSync(workspace.configPath.fsPath)) {
      await Promises.writeFile(workspace.configPath.fsPath, "Hello");
    }
    const backupFolder = service.toBackupPath(workspace.id);
    await createBackupFolder(backupFolder);
    return workspace;
  }
  async function createBackupFolder(backupFolder) {
    if (!fs.existsSync(backupFolder)) {
      fs.mkdirSync(backupFolder);
      fs.mkdirSync(path.join(backupFolder, Schemas.file));
      await Promises.writeFile(path.join(backupFolder, Schemas.file, "foo.txt"), "Hello");
    }
  }
  function readWorkspacesMetadata() {
    return stateMainService.getItem("backupWorkspaces");
  }
  function writeWorkspacesMetadata(data) {
    if (!data) {
      stateMainService.removeItem("backupWorkspaces");
    } else {
      stateMainService.setItem("backupWorkspaces", JSON.parse(data));
    }
  }
  function sanitizePath(p) {
    return platform.isLinux ? p : p.toLowerCase();
  }
  const fooFile = URI.file(platform.isWindows ? "C:\\foo" : "/foo");
  const barFile = URI.file(platform.isWindows ? "C:\\bar" : "/bar");
  let service;
  let configService;
  let stateMainService;
  let environmentService;
  let testDir;
  let backupHome;
  let existingTestFolder1;
  setup(async () => {
    testDir = getRandomTestPath(os.tmpdir(), "vsctests", "backupmainservice");
    backupHome = path.join(testDir, "Backups");
    existingTestFolder1 = URI.file(path.join(testDir, "folder1"));
    environmentService = new EnvironmentMainService(parseArgs(process.argv, OPTIONS), { _serviceBrand: void 0, ...product });
    await fs.promises.mkdir(backupHome, { recursive: true });
    configService = new TestConfigurationService();
    stateMainService = new InMemoryTestStateMainService();
    service = new class TestBackupMainService extends BackupMainService {
      constructor() {
        super(environmentService, configService, new LogService(new ConsoleMainLogger()), stateMainService);
        this.backupHome = backupHome;
      }
      toBackupPath(arg) {
        const id = arg instanceof URI ? super.getFolderHash({ folderUri: arg }) : arg;
        return path.join(this.backupHome, id);
      }
      testGetFolderHash(folder) {
        return super.getFolderHash(folder);
      }
      testGetWorkspaceBackups() {
        return super.getWorkspaceBackups();
      }
      testGetFolderBackups() {
        return super.getFolderBackups();
      }
    }();
    return service.initialize();
  });
  teardown(() => {
    return Promises.rm(testDir);
  });
  test("service validates backup workspaces on startup and cleans up (folder workspaces)", async function() {
    service.registerFolderBackup(toFolderBackupInfo(fooFile));
    service.registerFolderBackup(toFolderBackupInfo(barFile));
    await service.initialize();
    assertEqualFolderInfos(service.testGetFolderBackups(), []);
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    service.registerFolderBackup(toFolderBackupInfo(fooFile));
    service.registerFolderBackup(toFolderBackupInfo(barFile));
    await service.initialize();
    assertEqualFolderInfos(service.testGetFolderBackups(), []);
    assert.ok(!fs.existsSync(service.toBackupPath(fooFile)));
    assert.ok(!fs.existsSync(service.toBackupPath(barFile)));
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    fs.mkdirSync(path.join(service.toBackupPath(fooFile), Schemas.file));
    fs.mkdirSync(path.join(service.toBackupPath(barFile), Schemas.untitled));
    service.registerFolderBackup(toFolderBackupInfo(fooFile));
    service.registerFolderBackup(toFolderBackupInfo(barFile));
    await service.initialize();
    assertEqualFolderInfos(service.testGetFolderBackups(), []);
    assert.ok(!fs.existsSync(service.toBackupPath(fooFile)));
    assert.ok(!fs.existsSync(service.toBackupPath(barFile)));
    const fileBackups = path.join(service.toBackupPath(fooFile), Schemas.file);
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    fs.mkdirSync(fileBackups);
    service.registerFolderBackup(toFolderBackupInfo(fooFile));
    assert.strictEqual(service.testGetFolderBackups().length, 1);
    assert.strictEqual(service.getEmptyWindowBackups().length, 0);
    fs.writeFileSync(path.join(fileBackups, "backup.txt"), "");
    await service.initialize();
    assert.strictEqual(service.testGetFolderBackups().length, 0);
    assert.strictEqual(service.getEmptyWindowBackups().length, 1);
  });
  test("service validates backup workspaces on startup and cleans up (root workspaces)", async function() {
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath));
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(barFile.fsPath));
    await service.initialize();
    assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath));
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(barFile.fsPath));
    await service.initialize();
    assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    assert.ok(!fs.existsSync(service.toBackupPath(fooFile)));
    assert.ok(!fs.existsSync(service.toBackupPath(barFile)));
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    fs.mkdirSync(path.join(service.toBackupPath(fooFile), Schemas.file));
    fs.mkdirSync(path.join(service.toBackupPath(barFile), Schemas.untitled));
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath));
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(barFile.fsPath));
    await service.initialize();
    assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    assert.ok(!fs.existsSync(service.toBackupPath(fooFile)));
    assert.ok(!fs.existsSync(service.toBackupPath(barFile)));
    const fileBackups = path.join(service.toBackupPath(fooFile), Schemas.file);
    fs.mkdirSync(service.toBackupPath(fooFile));
    fs.mkdirSync(service.toBackupPath(barFile));
    fs.mkdirSync(fileBackups);
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath));
    assert.strictEqual(service.testGetWorkspaceBackups().length, 1);
    assert.strictEqual(service.getEmptyWindowBackups().length, 0);
    fs.writeFileSync(path.join(fileBackups, "backup.txt"), "");
    await service.initialize();
    assert.strictEqual(service.testGetWorkspaceBackups().length, 0);
    assert.strictEqual(service.getEmptyWindowBackups().length, 1);
  });
  test("service supports to migrate backup data from another location", async () => {
    const backupPathToMigrate = service.toBackupPath(fooFile);
    fs.mkdirSync(backupPathToMigrate);
    fs.writeFileSync(path.join(backupPathToMigrate, "backup.txt"), "Some Data");
    service.registerFolderBackup(toFolderBackupInfo(URI.file(backupPathToMigrate)));
    const workspaceBackupPath = await service.registerWorkspaceBackup(toWorkspaceBackupInfo(barFile.fsPath), backupPathToMigrate);
    assert.ok(fs.existsSync(workspaceBackupPath));
    assert.ok(fs.existsSync(path.join(workspaceBackupPath, "backup.txt")));
    assert.ok(!fs.existsSync(backupPathToMigrate));
    const emptyBackups = service.getEmptyWindowBackups();
    assert.strictEqual(0, emptyBackups.length);
  });
  test("service backup migration makes sure to preserve existing backups", async () => {
    const backupPathToMigrate = service.toBackupPath(fooFile);
    fs.mkdirSync(backupPathToMigrate);
    fs.writeFileSync(path.join(backupPathToMigrate, "backup.txt"), "Some Data");
    service.registerFolderBackup(toFolderBackupInfo(URI.file(backupPathToMigrate)));
    const backupPathToPreserve = service.toBackupPath(barFile);
    fs.mkdirSync(backupPathToPreserve);
    fs.writeFileSync(path.join(backupPathToPreserve, "backup.txt"), "Some Data");
    service.registerFolderBackup(toFolderBackupInfo(URI.file(backupPathToPreserve)));
    const workspaceBackupPath = await service.registerWorkspaceBackup(toWorkspaceBackupInfo(barFile.fsPath), backupPathToMigrate);
    assert.ok(fs.existsSync(workspaceBackupPath));
    assert.ok(fs.existsSync(path.join(workspaceBackupPath, "backup.txt")));
    assert.ok(!fs.existsSync(backupPathToMigrate));
    const emptyBackups = service.getEmptyWindowBackups();
    assert.strictEqual(1, emptyBackups.length);
    assert.strictEqual(1, fs.readdirSync(path.join(backupHome, emptyBackups[0].backupFolder)).length);
  });
  suite("loadSync", () => {
    test("getFolderBackupPaths() should return [] when workspaces.json doesn't exist", () => {
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
    });
    test("getFolderBackupPaths() should return [] when folders in workspaces.json is absent", async () => {
      writeWorkspacesMetadata("{}");
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
    });
    test("getFolderBackupPaths() should return [] when folders in workspaces.json is not a string array", async () => {
      writeWorkspacesMetadata('{"folders":{}}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
      writeWorkspacesMetadata('{"folders":{"foo": ["bar"]}}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
      writeWorkspacesMetadata('{"folders":{"foo": []}}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
      writeWorkspacesMetadata('{"folders":{"foo": "bar"}}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
      writeWorkspacesMetadata('{"folders":"foo"}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
      writeWorkspacesMetadata('{"folders":1}');
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
    });
    test('getFolderBackupPaths() should return [] when files.hotExit = "onExitAndWindowClose"', async () => {
      const fi = toFolderBackupInfo(URI.file(fooFile.fsPath.toUpperCase()));
      service.registerFolderBackup(fi);
      assertEqualFolderInfos(service.testGetFolderBackups(), [fi]);
      configService.setUserConfiguration("files.hotExit", HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE);
      await service.initialize();
      assertEqualFolderInfos(service.testGetFolderBackups(), []);
    });
    test("getWorkspaceBackups() should return [] when workspaces.json doesn't exist", () => {
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    });
    test("getWorkspaceBackups() should return [] when folderWorkspaces in workspaces.json is absent", async () => {
      writeWorkspacesMetadata("{}");
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    });
    test("getWorkspaceBackups() should return [] when rootWorkspaces in workspaces.json is not a object array", async () => {
      writeWorkspacesMetadata('{"rootWorkspaces":{}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"rootWorkspaces":{"foo": ["bar"]}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"rootWorkspaces":{"foo": []}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"rootWorkspaces":{"foo": "bar"}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"rootWorkspaces":"foo"}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"rootWorkspaces":1}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    });
    test("getWorkspaceBackups() should return [] when workspaces in workspaces.json is not a object array", async () => {
      writeWorkspacesMetadata('{"workspaces":{}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"workspaces":{"foo": ["bar"]}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"workspaces":{"foo": []}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"workspaces":{"foo": "bar"}}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"workspaces":"foo"}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
      writeWorkspacesMetadata('{"workspaces":1}');
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    });
    test('getWorkspaceBackups() should return [] when files.hotExit = "onExitAndWindowClose"', async () => {
      const upperFooPath = fooFile.fsPath.toUpperCase();
      service.registerWorkspaceBackup(toWorkspaceBackupInfo(upperFooPath));
      assert.strictEqual(service.testGetWorkspaceBackups().length, 1);
      assert.deepStrictEqual(service.testGetWorkspaceBackups().map((r) => r.workspace.configPath.toString()), [URI.file(upperFooPath).toString()]);
      configService.setUserConfiguration("files.hotExit", HotExitConfiguration.ON_EXIT_AND_WINDOW_CLOSE);
      await service.initialize();
      assert.deepStrictEqual(service.testGetWorkspaceBackups(), []);
    });
    test("getEmptyWorkspaceBackupPaths() should return [] when workspaces.json doesn't exist", () => {
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
    });
    test("getEmptyWorkspaceBackupPaths() should return [] when folderWorkspaces in workspaces.json is absent", async () => {
      writeWorkspacesMetadata("{}");
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
    });
    test("getEmptyWorkspaceBackupPaths() should return [] when folderWorkspaces in workspaces.json is not a string array", async function() {
      writeWorkspacesMetadata('{"emptyWorkspaces":{}}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
      writeWorkspacesMetadata('{"emptyWorkspaces":{"foo": ["bar"]}}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
      writeWorkspacesMetadata('{"emptyWorkspaces":{"foo": []}}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
      writeWorkspacesMetadata('{"emptyWorkspaces":{"foo": "bar"}}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
      writeWorkspacesMetadata('{"emptyWorkspaces":"foo"}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
      writeWorkspacesMetadata('{"emptyWorkspaces":1}');
      await service.initialize();
      assert.deepStrictEqual(service.getEmptyWindowBackups(), []);
    });
  });
  suite("dedupeFolderWorkspaces", () => {
    test("should ignore duplicates (folder workspace)", async () => {
      await ensureFolderExists(existingTestFolder1);
      const workspacesJson = {
        workspaces: [],
        folders: [{ folderUri: existingTestFolder1.toString() }, { folderUri: existingTestFolder1.toString() }],
        emptyWindows: []
      };
      writeWorkspacesMetadata(JSON.stringify(workspacesJson));
      await service.initialize();
      const json = readWorkspacesMetadata();
      assert.deepStrictEqual(json.folders, [{ folderUri: existingTestFolder1.toString() }]);
    });
    test("should ignore duplicates on Windows and Mac (folder workspace)", async () => {
      await ensureFolderExists(existingTestFolder1);
      const workspacesJson = {
        workspaces: [],
        folders: [{ folderUri: existingTestFolder1.toString() }, { folderUri: existingTestFolder1.toString().toLowerCase() }],
        emptyWindows: []
      };
      writeWorkspacesMetadata(JSON.stringify(workspacesJson));
      await service.initialize();
      const json = readWorkspacesMetadata();
      assert.deepStrictEqual(json.folders, [{ folderUri: existingTestFolder1.toString() }]);
    });
    test("should ignore duplicates on Windows and Mac (root workspace)", async () => {
      const workspacePath = path.join(testDir, "Foo.code-workspace");
      const workspacePath1 = path.join(testDir, "FOO.code-workspace");
      const workspacePath2 = path.join(testDir, "foo.code-workspace");
      const workspace1 = await ensureWorkspaceExists(toWorkspace(workspacePath));
      const workspace2 = await ensureWorkspaceExists(toWorkspace(workspacePath1));
      const workspace3 = await ensureWorkspaceExists(toWorkspace(workspacePath2));
      const workspacesJson = {
        workspaces: [workspace1, workspace2, workspace3].map(toSerializedWorkspace),
        folders: [],
        emptyWindows: []
      };
      writeWorkspacesMetadata(JSON.stringify(workspacesJson));
      await service.initialize();
      const json = readWorkspacesMetadata();
      assert.strictEqual(json.workspaces.length, platform.isLinux ? 3 : 1);
      if (platform.isLinux) {
        assert.deepStrictEqual(json.workspaces.map((r) => r.configURIPath), [URI.file(workspacePath).toString(), URI.file(workspacePath1).toString(), URI.file(workspacePath2).toString()]);
      } else {
        assert.deepStrictEqual(json.workspaces.map((r) => r.configURIPath), [URI.file(workspacePath).toString()], "should return the first duplicated entry");
      }
    });
  });
  suite("registerWindowForBackups", () => {
    test("should persist paths to workspaces.json (folder workspace)", async () => {
      service.registerFolderBackup(toFolderBackupInfo(fooFile));
      service.registerFolderBackup(toFolderBackupInfo(barFile));
      assertEqualFolderInfos(service.testGetFolderBackups(), [toFolderBackupInfo(fooFile), toFolderBackupInfo(barFile)]);
      const json = readWorkspacesMetadata();
      assert.deepStrictEqual(json.folders, [{ folderUri: fooFile.toString() }, { folderUri: barFile.toString() }]);
    });
    test("should persist paths to workspaces.json (root workspace)", async () => {
      const ws1 = toWorkspaceBackupInfo(fooFile.fsPath);
      service.registerWorkspaceBackup(ws1);
      const ws2 = toWorkspaceBackupInfo(barFile.fsPath);
      service.registerWorkspaceBackup(ws2);
      assert.deepStrictEqual(service.testGetWorkspaceBackups().map((b) => b.workspace.configPath.toString()), [fooFile.toString(), barFile.toString()]);
      assert.strictEqual(ws1.workspace.id, service.testGetWorkspaceBackups()[0].workspace.id);
      assert.strictEqual(ws2.workspace.id, service.testGetWorkspaceBackups()[1].workspace.id);
      const json = readWorkspacesMetadata();
      assert.deepStrictEqual(json.workspaces.map((b) => b.configURIPath), [fooFile.toString(), barFile.toString()]);
      assert.strictEqual(ws1.workspace.id, json.workspaces[0].id);
      assert.strictEqual(ws2.workspace.id, json.workspaces[1].id);
    });
  });
  test("should always store the workspace path in workspaces.json using the case given, regardless of whether the file system is case-sensitive (folder workspace)", async () => {
    service.registerFolderBackup(toFolderBackupInfo(URI.file(fooFile.fsPath.toUpperCase())));
    assertEqualFolderInfos(service.testGetFolderBackups(), [toFolderBackupInfo(URI.file(fooFile.fsPath.toUpperCase()))]);
    const json = readWorkspacesMetadata();
    assert.deepStrictEqual(json.folders, [{ folderUri: URI.file(fooFile.fsPath.toUpperCase()).toString() }]);
  });
  test("should always store the workspace path in workspaces.json using the case given, regardless of whether the file system is case-sensitive (root workspace)", async () => {
    const upperFooPath = fooFile.fsPath.toUpperCase();
    service.registerWorkspaceBackup(toWorkspaceBackupInfo(upperFooPath));
    assert.deepStrictEqual(service.testGetWorkspaceBackups().map((b) => b.workspace.configPath.toString()), [URI.file(upperFooPath).toString()]);
    const json = readWorkspacesMetadata();
    assert.deepStrictEqual(json.workspaces.map((b) => b.configURIPath), [URI.file(upperFooPath).toString()]);
  });
  suite("getWorkspaceHash", () => {
    (platform.isLinux ? test.skip : test)("should ignore case on Windows and Mac", () => {
      const assertFolderHash = (uri1, uri2) => {
        assert.strictEqual(service.testGetFolderHash(toFolderBackupInfo(uri1)), service.testGetFolderHash(toFolderBackupInfo(uri2)));
      };
      if (platform.isMacintosh) {
        assertFolderHash(URI.file("/foo"), URI.file("/FOO"));
      }
      if (platform.isWindows) {
        assertFolderHash(URI.file("c:\\foo"), URI.file("C:\\FOO"));
      }
    });
  });
  suite("mixed path casing", () => {
    test("should handle case insensitive paths properly (registerWindowForBackupsSync) (folder workspace)", () => {
      service.registerFolderBackup(toFolderBackupInfo(fooFile));
      service.registerFolderBackup(toFolderBackupInfo(URI.file(fooFile.fsPath.toUpperCase())));
      if (platform.isLinux) {
        assert.strictEqual(service.testGetFolderBackups().length, 2);
      } else {
        assert.strictEqual(service.testGetFolderBackups().length, 1);
      }
    });
    test("should handle case insensitive paths properly (registerWindowForBackupsSync) (root workspace)", () => {
      service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath));
      service.registerWorkspaceBackup(toWorkspaceBackupInfo(fooFile.fsPath.toUpperCase()));
      if (platform.isLinux) {
        assert.strictEqual(service.testGetWorkspaceBackups().length, 2);
      } else {
        assert.strictEqual(service.testGetWorkspaceBackups().length, 1);
      }
    });
  });
  suite("getDirtyWorkspaces", () => {
    test("should report if a workspace or folder has backups", async () => {
      const folderBackupPath = service.registerFolderBackup(toFolderBackupInfo(fooFile));
      const backupWorkspaceInfo = toWorkspaceBackupInfo(fooFile.fsPath);
      const workspaceBackupPath = service.registerWorkspaceBackup(backupWorkspaceInfo);
      assert.strictEqual((await service.getDirtyWorkspaces()).length, 0);
      try {
        await fs.promises.mkdir(path.join(folderBackupPath, Schemas.file), { recursive: true });
        await fs.promises.mkdir(path.join(workspaceBackupPath, Schemas.untitled), { recursive: true });
      } catch (error) {
      }
      assert.strictEqual((await service.getDirtyWorkspaces()).length, 0);
      fs.writeFileSync(path.join(folderBackupPath, Schemas.file, "594a4a9d82a277a899d4713a5b08f504"), "");
      fs.writeFileSync(path.join(workspaceBackupPath, Schemas.untitled, "594a4a9d82a277a899d4713a5b08f504"), "");
      const dirtyWorkspaces = await service.getDirtyWorkspaces();
      assert.strictEqual(dirtyWorkspaces.length, 2);
      let found = 0;
      for (const dirtyWorkpspace of dirtyWorkspaces) {
        if (isFolderBackupInfo(dirtyWorkpspace)) {
          if (isEqual(fooFile, dirtyWorkpspace.folderUri)) {
            found++;
          }
        } else {
          if (isEqual(backupWorkspaceInfo.workspace.configPath, dirtyWorkpspace.workspace.configPath)) {
            found++;
          }
        }
      }
      assert.strictEqual(found, 2);
    });
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9iYWNrdXAvdGVzdC9lbGVjdHJvbi1tYWluL2JhY2t1cE1haW5TZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBjcmVhdGVIYXNoIH0gZnJvbSAnY3J5cHRvJztcbmltcG9ydCAqIGFzIGZzIGZyb20gJ2ZzJztcbmltcG9ydCAqIGFzIG9zIGZyb20gJ29zJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgKiBhcyBwbGF0Zm9ybSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBQcm9taXNlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2Uvbm9kZS9wZnMuanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSwgZ2V0UmFuZG9tVGVzdFBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3Qvbm9kZS90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgQmFja3VwTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbGVjdHJvbi1tYWluL2JhY2t1cE1haW5TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTZXJpYWxpemVkQmFja3VwV29ya3NwYWNlcywgSVNlcmlhbGl6ZWRXb3Jrc3BhY2VCYWNrdXBJbmZvIH0gZnJvbSAnLi4vLi4vbm9kZS9iYWNrdXAuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBPUFRJT05TLCBwYXJzZUFyZ3MgfSBmcm9tICcuLi8uLi8uLi9lbnZpcm9ubWVudC9ub2RlL2FyZ3YuanMnO1xuaW1wb3J0IHsgSG90RXhpdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgQ29uc29sZU1haW5Mb2dnZXIgfSBmcm9tICcuLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElGb2xkZXJCYWNrdXBJbmZvLCBpc0ZvbGRlckJhY2t1cEluZm8sIElXb3Jrc3BhY2VCYWNrdXBJbmZvIH0gZnJvbSAnLi4vLi4vY29tbW9uL2JhY2t1cC5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IEluTWVtb3J5VGVzdFN0YXRlTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi90ZXN0L2VsZWN0cm9uLW1haW4vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9sb2cvY29tbW9uL2xvZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmZsYWt5U3VpdGUoJ0JhY2t1cE1haW5TZXJ2aWNlJywgKCkgPT4ge1xuXG5cdGZ1bmN0aW9uIGFzc2VydEVxdWFsRm9sZGVySW5mb3MoYWN0dWFsOiBJRm9sZGVyQmFja3VwSW5mb1tdLCBleHBlY3RlZDogSUZvbGRlckJhY2t1cEluZm9bXSkge1xuXHRcdGNvbnN0IHdpdGhVcmlBc1N0cmluZyA9IChmOiBJRm9sZGVyQmFja3VwSW5mbykgPT4gKHsgZm9sZGVyVXJpOiBmLmZvbGRlclVyaS50b1N0cmluZygpLCByZW1vdGVBdXRob3JpdHk6IGYucmVtb3RlQXV0aG9yaXR5IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLm1hcCh3aXRoVXJpQXNTdHJpbmcpLCBleHBlY3RlZC5tYXAod2l0aFVyaUFzU3RyaW5nKSk7XG5cdH1cblxuXHRmdW5jdGlvbiB0b1dvcmtzcGFjZShwYXRoOiBzdHJpbmcpOiBJV29ya3NwYWNlSWRlbnRpZmllciB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBjcmVhdGVIYXNoKCdtZDUnKS51cGRhdGUoc2FuaXRpemVQYXRoKHBhdGgpKS5kaWdlc3QoJ2hleCcpLCAvLyBDb2RlUUwgW1NNMDQ1MTRdIFVzaW5nIE1ENSB0byBjb252ZXJ0IGEgZmlsZSBwYXRoIHRvIGEgZml4ZWQgbGVuZ3RoXG5cdFx0XHRjb25maWdQYXRoOiBVUkkuZmlsZShwYXRoKVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiB0b1dvcmtzcGFjZUJhY2t1cEluZm8ocGF0aDogc3RyaW5nLCByZW1vdGVBdXRob3JpdHk/OiBzdHJpbmcpOiBJV29ya3NwYWNlQmFja3VwSW5mbyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHdvcmtzcGFjZToge1xuXHRcdFx0XHRpZDogY3JlYXRlSGFzaCgnbWQ1JykudXBkYXRlKHNhbml0aXplUGF0aChwYXRoKSkuZGlnZXN0KCdoZXgnKSwgLy8gQ29kZVFMIFtTTTA0NTE0XSBVc2luZyBNRDUgdG8gY29udmVydCBhIGZpbGUgcGF0aCB0byBhIGZpeGVkIGxlbmd0aFxuXHRcdFx0XHRjb25maWdQYXRoOiBVUkkuZmlsZShwYXRoKVxuXHRcdFx0fSxcblx0XHRcdHJlbW90ZUF1dGhvcml0eVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiB0b0ZvbGRlckJhY2t1cEluZm8odXJpOiBVUkksIHJlbW90ZUF1dGhvcml0eT86IHN0cmluZyk6IElGb2xkZXJCYWNrdXBJbmZvIHtcblx0XHRyZXR1cm4geyBmb2xkZXJVcmk6IHVyaSwgcmVtb3RlQXV0aG9yaXR5IH07XG5cdH1cblxuXHRmdW5jdGlvbiB0b1NlcmlhbGl6ZWRXb3Jrc3BhY2Uod3M6IElXb3Jrc3BhY2VJZGVudGlmaWVyKTogSVNlcmlhbGl6ZWRXb3Jrc3BhY2VCYWNrdXBJbmZvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWQ6IHdzLmlkLFxuXHRcdFx0Y29uZmlnVVJJUGF0aDogd3MuY29uZmlnUGF0aC50b1N0cmluZygpXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGVuc3VyZUZvbGRlckV4aXN0cyh1cmk6IFVSSSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghZnMuZXhpc3RzU3luYyh1cmkuZnNQYXRoKSkge1xuXHRcdFx0ZnMubWtkaXJTeW5jKHVyaS5mc1BhdGgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJhY2t1cEZvbGRlciA9IHNlcnZpY2UudG9CYWNrdXBQYXRoKHVyaSk7XG5cdFx0cmV0dXJuIGNyZWF0ZUJhY2t1cEZvbGRlcihiYWNrdXBGb2xkZXIpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gZW5zdXJlV29ya3NwYWNlRXhpc3RzKHdvcmtzcGFjZTogSVdvcmtzcGFjZUlkZW50aWZpZXIpOiBQcm9taXNlPElXb3Jrc3BhY2VJZGVudGlmaWVyPiB7XG5cdFx0aWYgKCFmcy5leGlzdHNTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkpIHtcblx0XHRcdGF3YWl0IFByb21pc2VzLndyaXRlRmlsZSh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgsICdIZWxsbycpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJhY2t1cEZvbGRlciA9IHNlcnZpY2UudG9CYWNrdXBQYXRoKHdvcmtzcGFjZS5pZCk7XG5cdFx0YXdhaXQgY3JlYXRlQmFja3VwRm9sZGVyKGJhY2t1cEZvbGRlcik7XG5cblx0XHRyZXR1cm4gd29ya3NwYWNlO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gY3JlYXRlQmFja3VwRm9sZGVyKGJhY2t1cEZvbGRlcjogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCFmcy5leGlzdHNTeW5jKGJhY2t1cEZvbGRlcikpIHtcblx0XHRcdGZzLm1rZGlyU3luYyhiYWNrdXBGb2xkZXIpO1xuXHRcdFx0ZnMubWtkaXJTeW5jKHBhdGguam9pbihiYWNrdXBGb2xkZXIsIFNjaGVtYXMuZmlsZSkpO1xuXHRcdFx0YXdhaXQgUHJvbWlzZXMud3JpdGVGaWxlKHBhdGguam9pbihiYWNrdXBGb2xkZXIsIFNjaGVtYXMuZmlsZSwgJ2Zvby50eHQnKSwgJ0hlbGxvJyk7XG5cdFx0fVxuXHR9XG5cblx0ZnVuY3Rpb24gcmVhZFdvcmtzcGFjZXNNZXRhZGF0YSgpOiBJU2VyaWFsaXplZEJhY2t1cFdvcmtzcGFjZXMge1xuXHRcdHJldHVybiBzdGF0ZU1haW5TZXJ2aWNlLmdldEl0ZW0oJ2JhY2t1cFdvcmtzcGFjZXMnKSBhcyBJU2VyaWFsaXplZEJhY2t1cFdvcmtzcGFjZXM7XG5cdH1cblxuXHRmdW5jdGlvbiB3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YShkYXRhOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoIWRhdGEpIHtcblx0XHRcdHN0YXRlTWFpblNlcnZpY2UucmVtb3ZlSXRlbSgnYmFja3VwV29ya3NwYWNlcycpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdGF0ZU1haW5TZXJ2aWNlLnNldEl0ZW0oJ2JhY2t1cFdvcmtzcGFjZXMnLCBKU09OLnBhcnNlKGRhdGEpKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBzYW5pdGl6ZVBhdGgocDogc3RyaW5nKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gcGxhdGZvcm0uaXNMaW51eCA/IHAgOiBwLnRvTG93ZXJDYXNlKCk7XG5cdH1cblxuXHRjb25zdCBmb29GaWxlID0gVVJJLmZpbGUocGxhdGZvcm0uaXNXaW5kb3dzID8gJ0M6XFxcXGZvbycgOiAnL2ZvbycpO1xuXHRjb25zdCBiYXJGaWxlID0gVVJJLmZpbGUocGxhdGZvcm0uaXNXaW5kb3dzID8gJ0M6XFxcXGJhcicgOiAnL2JhcicpO1xuXG5cdGxldCBzZXJ2aWNlOiBCYWNrdXBNYWluU2VydmljZSAmIHtcblx0XHR0b0JhY2t1cFBhdGgoYXJnOiBVUkkgfCBzdHJpbmcpOiBzdHJpbmc7XG5cdFx0dGVzdEdldEZvbGRlckhhc2goZm9sZGVyOiBJRm9sZGVyQmFja3VwSW5mbyk6IHN0cmluZztcblx0XHR0ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpOiBJV29ya3NwYWNlQmFja3VwSW5mb1tdO1xuXHRcdHRlc3RHZXRGb2xkZXJCYWNrdXBzKCk6IElGb2xkZXJCYWNrdXBJbmZvW107XG5cdH07XG5cdGxldCBjb25maWdTZXJ2aWNlOiBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCBzdGF0ZU1haW5TZXJ2aWNlOiBJbk1lbW9yeVRlc3RTdGF0ZU1haW5TZXJ2aWNlO1xuXG5cdGxldCBlbnZpcm9ubWVudFNlcnZpY2U6IEVudmlyb25tZW50TWFpblNlcnZpY2U7XG5cdGxldCB0ZXN0RGlyOiBzdHJpbmc7XG5cdGxldCBiYWNrdXBIb21lOiBzdHJpbmc7XG5cdGxldCBleGlzdGluZ1Rlc3RGb2xkZXIxOiBVUkk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdHRlc3REaXIgPSBnZXRSYW5kb21UZXN0UGF0aChvcy50bXBkaXIoKSwgJ3ZzY3Rlc3RzJywgJ2JhY2t1cG1haW5zZXJ2aWNlJyk7XG5cdFx0YmFja3VwSG9tZSA9IHBhdGguam9pbih0ZXN0RGlyLCAnQmFja3VwcycpO1xuXHRcdGV4aXN0aW5nVGVzdEZvbGRlcjEgPSBVUkkuZmlsZShwYXRoLmpvaW4odGVzdERpciwgJ2ZvbGRlcjEnKSk7XG5cblx0XHRlbnZpcm9ubWVudFNlcnZpY2UgPSBuZXcgRW52aXJvbm1lbnRNYWluU2VydmljZShwYXJzZUFyZ3MocHJvY2Vzcy5hcmd2LCBPUFRJT05TKSwgeyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsIC4uLnByb2R1Y3QgfSk7XG5cblx0XHRhd2FpdCBmcy5wcm9taXNlcy5ta2RpcihiYWNrdXBIb21lLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblxuXHRcdGNvbmZpZ1NlcnZpY2UgPSBuZXcgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0c3RhdGVNYWluU2VydmljZSA9IG5ldyBJbk1lbW9yeVRlc3RTdGF0ZU1haW5TZXJ2aWNlKCk7XG5cblx0XHRzZXJ2aWNlID0gbmV3IGNsYXNzIFRlc3RCYWNrdXBNYWluU2VydmljZSBleHRlbmRzIEJhY2t1cE1haW5TZXJ2aWNlIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcihlbnZpcm9ubWVudFNlcnZpY2UsIGNvbmZpZ1NlcnZpY2UsIG5ldyBMb2dTZXJ2aWNlKG5ldyBDb25zb2xlTWFpbkxvZ2dlcigpKSwgc3RhdGVNYWluU2VydmljZSk7XG5cblx0XHRcdFx0dGhpcy5iYWNrdXBIb21lID0gYmFja3VwSG9tZTtcblx0XHRcdH1cblxuXHRcdFx0dG9CYWNrdXBQYXRoKGFyZzogVVJJIHwgc3RyaW5nKTogc3RyaW5nIHtcblx0XHRcdFx0Y29uc3QgaWQgPSBhcmcgaW5zdGFuY2VvZiBVUkkgPyBzdXBlci5nZXRGb2xkZXJIYXNoKHsgZm9sZGVyVXJpOiBhcmcgfSkgOiBhcmc7XG5cdFx0XHRcdHJldHVybiBwYXRoLmpvaW4odGhpcy5iYWNrdXBIb21lLCBpZCk7XG5cdFx0XHR9XG5cblx0XHRcdHRlc3RHZXRGb2xkZXJIYXNoKGZvbGRlcjogSUZvbGRlckJhY2t1cEluZm8pOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuZ2V0Rm9sZGVySGFzaChmb2xkZXIpO1xuXHRcdFx0fVxuXG5cdFx0XHR0ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpOiBJV29ya3NwYWNlQmFja3VwSW5mb1tdIHtcblx0XHRcdFx0cmV0dXJuIHN1cGVyLmdldFdvcmtzcGFjZUJhY2t1cHMoKTtcblx0XHRcdH1cblxuXHRcdFx0dGVzdEdldEZvbGRlckJhY2t1cHMoKTogSUZvbGRlckJhY2t1cEluZm9bXSB7XG5cdFx0XHRcdHJldHVybiBzdXBlci5nZXRGb2xkZXJCYWNrdXBzKCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHJldHVybiBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdHJldHVybiBQcm9taXNlcy5ybSh0ZXN0RGlyKTtcblx0fSk7XG5cblx0dGVzdCgnc2VydmljZSB2YWxpZGF0ZXMgYmFja3VwIHdvcmtzcGFjZXMgb24gc3RhcnR1cCBhbmQgY2xlYW5zIHVwIChmb2xkZXIgd29ya3NwYWNlcyknLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHQvLyAxKSBiYWNrdXAgd29ya3NwYWNlIHBhdGggZG9lcyBub3QgZXhpc3Rcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyRm9sZGVyQmFja3VwKHRvRm9sZGVyQmFja3VwSW5mbyhmb29GaWxlKSk7XG5cdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oYmFyRmlsZSkpO1xuXHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cblx0XHQvLyAyKSBiYWNrdXAgd29ya3NwYWNlIHBhdGggZXhpc3RzIHdpdGggZW1wdHkgY29udGVudHMgd2l0aGluXG5cdFx0ZnMubWtkaXJTeW5jKHNlcnZpY2UudG9CYWNrdXBQYXRoKGZvb0ZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpO1xuXHRcdHNlcnZpY2UucmVnaXN0ZXJGb2xkZXJCYWNrdXAodG9Gb2xkZXJCYWNrdXBJbmZvKGZvb0ZpbGUpKTtcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyRm9sZGVyQmFja3VwKHRvRm9sZGVyQmFja3VwSW5mbyhiYXJGaWxlKSk7XG5cdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0YXNzZXJ0RXF1YWxGb2xkZXJJbmZvcyhzZXJ2aWNlLnRlc3RHZXRGb2xkZXJCYWNrdXBzKCksIFtdKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSkpKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpKTtcblxuXHRcdC8vIDMpIGJhY2t1cCB3b3Jrc3BhY2UgcGF0aCBleGlzdHMgd2l0aCBlbXB0eSBmb2xkZXJzIHdpdGhpblxuXHRcdGZzLm1rZGlyU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChmb29GaWxlKSk7XG5cdFx0ZnMubWtkaXJTeW5jKHNlcnZpY2UudG9CYWNrdXBQYXRoKGJhckZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMocGF0aC5qb2luKHNlcnZpY2UudG9CYWNrdXBQYXRoKGZvb0ZpbGUpLCBTY2hlbWFzLmZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMocGF0aC5qb2luKHNlcnZpY2UudG9CYWNrdXBQYXRoKGJhckZpbGUpLCBTY2hlbWFzLnVudGl0bGVkKSk7XG5cdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oZm9vRmlsZSkpO1xuXHRcdHNlcnZpY2UucmVnaXN0ZXJGb2xkZXJCYWNrdXAodG9Gb2xkZXJCYWNrdXBJbmZvKGJhckZpbGUpKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRhc3NlcnRFcXVhbEZvbGRlckluZm9zKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKSwgW10pO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChmb29GaWxlKSkpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChiYXJGaWxlKSkpO1xuXG5cdFx0Ly8gNCkgYmFja3VwIHdvcmtzcGFjZSBwYXRoIHBvaW50cyB0byBhIHdvcmtzcGFjZSB0aGF0IG5vIGxvbmdlciBleGlzdHNcblx0XHQvLyBzbyBpdCBzaG91bGQgY29udmVydCB0aGUgYmFja3VwIHdvcnNwYWNlIHRvIGFuIGVtcHR5IHdvcmtzcGFjZSBiYWNrdXBcblx0XHRjb25zdCBmaWxlQmFja3VwcyA9IHBhdGguam9pbihzZXJ2aWNlLnRvQmFja3VwUGF0aChmb29GaWxlKSwgU2NoZW1hcy5maWxlKTtcblx0XHRmcy5ta2RpclN5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSkpO1xuXHRcdGZzLm1rZGlyU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChiYXJGaWxlKSk7XG5cdFx0ZnMubWtkaXJTeW5jKGZpbGVCYWNrdXBzKTtcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyRm9sZGVyQmFja3VwKHRvRm9sZGVyQmFja3VwSW5mbyhmb29GaWxlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpLmxlbmd0aCwgMCk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oZmlsZUJhY2t1cHMsICdiYWNrdXAudHh0JyksICcnKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCkubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnc2VydmljZSB2YWxpZGF0ZXMgYmFja3VwIHdvcmtzcGFjZXMgb24gc3RhcnR1cCBhbmQgY2xlYW5zIHVwIChyb290IHdvcmtzcGFjZXMpJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Ly8gMSkgYmFja3VwIHdvcmtzcGFjZSBwYXRoIGRvZXMgbm90IGV4aXN0XG5cdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oZm9vRmlsZS5mc1BhdGgpKTtcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyV29ya3NwYWNlQmFja3VwKHRvV29ya3NwYWNlQmFja3VwSW5mbyhiYXJGaWxlLmZzUGF0aCkpO1xuXHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cblx0XHQvLyAyKSBiYWNrdXAgd29ya3NwYWNlIHBhdGggZXhpc3RzIHdpdGggZW1wdHkgY29udGVudHMgd2l0aGluXG5cdFx0ZnMubWtkaXJTeW5jKHNlcnZpY2UudG9CYWNrdXBQYXRoKGZvb0ZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpO1xuXHRcdHNlcnZpY2UucmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAodG9Xb3Jrc3BhY2VCYWNrdXBJbmZvKGZvb0ZpbGUuZnNQYXRoKSk7XG5cdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oYmFyRmlsZS5mc1BhdGgpKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKSwgW10pO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChmb29GaWxlKSkpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhzZXJ2aWNlLnRvQmFja3VwUGF0aChiYXJGaWxlKSkpO1xuXG5cdFx0Ly8gMykgYmFja3VwIHdvcmtzcGFjZSBwYXRoIGV4aXN0cyB3aXRoIGVtcHR5IGZvbGRlcnMgd2l0aGluXG5cdFx0ZnMubWtkaXJTeW5jKHNlcnZpY2UudG9CYWNrdXBQYXRoKGZvb0ZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpO1xuXHRcdGZzLm1rZGlyU3luYyhwYXRoLmpvaW4oc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSksIFNjaGVtYXMuZmlsZSkpO1xuXHRcdGZzLm1rZGlyU3luYyhwYXRoLmpvaW4oc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSksIFNjaGVtYXMudW50aXRsZWQpKTtcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyV29ya3NwYWNlQmFja3VwKHRvV29ya3NwYWNlQmFja3VwSW5mbyhmb29GaWxlLmZzUGF0aCkpO1xuXHRcdHNlcnZpY2UucmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAodG9Xb3Jrc3BhY2VCYWNrdXBJbmZvKGJhckZpbGUuZnNQYXRoKSk7XG5cdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSkpKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpKTtcblxuXHRcdC8vIDQpIGJhY2t1cCB3b3Jrc3BhY2UgcGF0aCBwb2ludHMgdG8gYSB3b3Jrc3BhY2UgdGhhdCBubyBsb25nZXIgZXhpc3RzXG5cdFx0Ly8gc28gaXQgc2hvdWxkIGNvbnZlcnQgdGhlIGJhY2t1cCB3b3JzcGFjZSB0byBhbiBlbXB0eSB3b3Jrc3BhY2UgYmFja3VwXG5cdFx0Y29uc3QgZmlsZUJhY2t1cHMgPSBwYXRoLmpvaW4oc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSksIFNjaGVtYXMuZmlsZSk7XG5cdFx0ZnMubWtkaXJTeW5jKHNlcnZpY2UudG9CYWNrdXBQYXRoKGZvb0ZpbGUpKTtcblx0XHRmcy5ta2RpclN5bmMoc2VydmljZS50b0JhY2t1cFBhdGgoYmFyRmlsZSkpO1xuXHRcdGZzLm1rZGlyU3luYyhmaWxlQmFja3Vwcyk7XG5cdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oZm9vRmlsZS5mc1BhdGgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCkubGVuZ3RoLCAwKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihmaWxlQmFja3VwcywgJ2JhY2t1cC50eHQnKSwgJycpO1xuXHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5nZXRFbXB0eVdpbmRvd0JhY2t1cHMoKS5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZXJ2aWNlIHN1cHBvcnRzIHRvIG1pZ3JhdGUgYmFja3VwIGRhdGEgZnJvbSBhbm90aGVyIGxvY2F0aW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhY2t1cFBhdGhUb01pZ3JhdGUgPSBzZXJ2aWNlLnRvQmFja3VwUGF0aChmb29GaWxlKTtcblx0XHRmcy5ta2RpclN5bmMoYmFja3VwUGF0aFRvTWlncmF0ZSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyhwYXRoLmpvaW4oYmFja3VwUGF0aFRvTWlncmF0ZSwgJ2JhY2t1cC50eHQnKSwgJ1NvbWUgRGF0YScpO1xuXHRcdHNlcnZpY2UucmVnaXN0ZXJGb2xkZXJCYWNrdXAodG9Gb2xkZXJCYWNrdXBJbmZvKFVSSS5maWxlKGJhY2t1cFBhdGhUb01pZ3JhdGUpKSk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VCYWNrdXBQYXRoID0gYXdhaXQgc2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oYmFyRmlsZS5mc1BhdGgpLCBiYWNrdXBQYXRoVG9NaWdyYXRlKTtcblxuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHdvcmtzcGFjZUJhY2t1cFBhdGgpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4od29ya3NwYWNlQmFja3VwUGF0aCwgJ2JhY2t1cC50eHQnKSkpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhiYWNrdXBQYXRoVG9NaWdyYXRlKSk7XG5cblx0XHRjb25zdCBlbXB0eUJhY2t1cHMgPSBzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgwLCBlbXB0eUJhY2t1cHMubGVuZ3RoKTtcblx0fSk7XG5cblx0dGVzdCgnc2VydmljZSBiYWNrdXAgbWlncmF0aW9uIG1ha2VzIHN1cmUgdG8gcHJlc2VydmUgZXhpc3RpbmcgYmFja3VwcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYWNrdXBQYXRoVG9NaWdyYXRlID0gc2VydmljZS50b0JhY2t1cFBhdGgoZm9vRmlsZSk7XG5cdFx0ZnMubWtkaXJTeW5jKGJhY2t1cFBhdGhUb01pZ3JhdGUpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJhY2t1cFBhdGhUb01pZ3JhdGUsICdiYWNrdXAudHh0JyksICdTb21lIERhdGEnKTtcblx0XHRzZXJ2aWNlLnJlZ2lzdGVyRm9sZGVyQmFja3VwKHRvRm9sZGVyQmFja3VwSW5mbyhVUkkuZmlsZShiYWNrdXBQYXRoVG9NaWdyYXRlKSkpO1xuXG5cdFx0Y29uc3QgYmFja3VwUGF0aFRvUHJlc2VydmUgPSBzZXJ2aWNlLnRvQmFja3VwUGF0aChiYXJGaWxlKTtcblx0XHRmcy5ta2RpclN5bmMoYmFja3VwUGF0aFRvUHJlc2VydmUpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMocGF0aC5qb2luKGJhY2t1cFBhdGhUb1ByZXNlcnZlLCAnYmFja3VwLnR4dCcpLCAnU29tZSBEYXRhJyk7XG5cdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oVVJJLmZpbGUoYmFja3VwUGF0aFRvUHJlc2VydmUpKSk7XG5cblx0XHRjb25zdCB3b3Jrc3BhY2VCYWNrdXBQYXRoID0gYXdhaXQgc2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oYmFyRmlsZS5mc1BhdGgpLCBiYWNrdXBQYXRoVG9NaWdyYXRlKTtcblxuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHdvcmtzcGFjZUJhY2t1cFBhdGgpKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyhwYXRoLmpvaW4od29ya3NwYWNlQmFja3VwUGF0aCwgJ2JhY2t1cC50eHQnKSkpO1xuXHRcdGFzc2VydC5vayghZnMuZXhpc3RzU3luYyhiYWNrdXBQYXRoVG9NaWdyYXRlKSk7XG5cblx0XHRjb25zdCBlbXB0eUJhY2t1cHMgPSBzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxLCBlbXB0eUJhY2t1cHMubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMSwgZnMucmVhZGRpclN5bmMocGF0aC5qb2luKGJhY2t1cEhvbWUsIGVtcHR5QmFja3Vwc1swXS5iYWNrdXBGb2xkZXIpKS5sZW5ndGgpO1xuXHR9KTtcblxuXHRzdWl0ZSgnbG9hZFN5bmMnLCAoKSA9PiB7XG5cdFx0dGVzdCgnZ2V0Rm9sZGVyQmFja3VwUGF0aHMoKSBzaG91bGQgcmV0dXJuIFtdIHdoZW4gd29ya3NwYWNlcy5qc29uIGRvZXNuXFwndCBleGlzdCcsICgpID0+IHtcblx0XHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXRGb2xkZXJCYWNrdXBQYXRocygpIHNob3VsZCByZXR1cm4gW10gd2hlbiBmb2xkZXJzIGluIHdvcmtzcGFjZXMuanNvbiBpcyBhYnNlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne30nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0RXF1YWxGb2xkZXJJbmZvcyhzZXJ2aWNlLnRlc3RHZXRGb2xkZXJCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dldEZvbGRlckJhY2t1cFBhdGhzKCkgc2hvdWxkIHJldHVybiBbXSB3aGVuIGZvbGRlcnMgaW4gd29ya3NwYWNlcy5qc29uIGlzIG5vdCBhIHN0cmluZyBhcnJheScsIGFzeW5jICgpID0+IHtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJmb2xkZXJzXCI6e319Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wiZm9sZGVyc1wiOntcImZvb1wiOiBbXCJiYXJcIl19fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnRFcXVhbEZvbGRlckluZm9zKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKSwgW10pO1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcImZvbGRlcnNcIjp7XCJmb29cIjogW119fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnRFcXVhbEZvbGRlckluZm9zKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKSwgW10pO1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcImZvbGRlcnNcIjp7XCJmb29cIjogXCJiYXJcIn19Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wiZm9sZGVyc1wiOlwiZm9vXCJ9Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wiZm9sZGVyc1wiOjF9Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydEVxdWFsRm9sZGVySW5mb3Moc2VydmljZS50ZXN0R2V0Rm9sZGVyQmFja3VwcygpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXRGb2xkZXJCYWNrdXBQYXRocygpIHNob3VsZCByZXR1cm4gW10gd2hlbiBmaWxlcy5ob3RFeGl0ID0gXCJvbkV4aXRBbmRXaW5kb3dDbG9zZVwiJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmkgPSB0b0ZvbGRlckJhY2t1cEluZm8oVVJJLmZpbGUoZm9vRmlsZS5mc1BhdGgudG9VcHBlckNhc2UoKSkpO1xuXHRcdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cChmaSk7XG5cdFx0XHRhc3NlcnRFcXVhbEZvbGRlckluZm9zKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKSwgW2ZpXSk7XG5cdFx0XHRjb25maWdTZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCdmaWxlcy5ob3RFeGl0JywgSG90RXhpdENvbmZpZ3VyYXRpb24uT05fRVhJVF9BTkRfV0lORE9XX0NMT1NFKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0RXF1YWxGb2xkZXJJbmZvcyhzZXJ2aWNlLnRlc3RHZXRGb2xkZXJCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dldFdvcmtzcGFjZUJhY2t1cHMoKSBzaG91bGQgcmV0dXJuIFtdIHdoZW4gd29ya3NwYWNlcy5qc29uIGRvZXNuXFwndCBleGlzdCcsICgpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXRXb3Jrc3BhY2VCYWNrdXBzKCkgc2hvdWxkIHJldHVybiBbXSB3aGVuIGZvbGRlcldvcmtzcGFjZXMgaW4gd29ya3NwYWNlcy5qc29uIGlzIGFic2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKSwgW10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2V0V29ya3NwYWNlQmFja3VwcygpIHNob3VsZCByZXR1cm4gW10gd2hlbiByb290V29ya3NwYWNlcyBpbiB3b3Jrc3BhY2VzLmpzb24gaXMgbm90IGEgb2JqZWN0IGFycmF5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcInJvb3RXb3Jrc3BhY2VzXCI6e319Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wicm9vdFdvcmtzcGFjZXNcIjp7XCJmb29cIjogW1wiYmFyXCJdfX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJyb290V29ya3NwYWNlc1wiOntcImZvb1wiOiBbXX19Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wicm9vdFdvcmtzcGFjZXNcIjp7XCJmb29cIjogXCJiYXJcIn19Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wicm9vdFdvcmtzcGFjZXNcIjpcImZvb1wifScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKSwgW10pO1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcInJvb3RXb3Jrc3BhY2VzXCI6MX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dldFdvcmtzcGFjZUJhY2t1cHMoKSBzaG91bGQgcmV0dXJuIFtdIHdoZW4gd29ya3NwYWNlcyBpbiB3b3Jrc3BhY2VzLmpzb24gaXMgbm90IGEgb2JqZWN0IGFycmF5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcIndvcmtzcGFjZXNcIjp7fX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJ3b3Jrc3BhY2VzXCI6e1wiZm9vXCI6IFtcImJhclwiXX19Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wid29ya3NwYWNlc1wiOntcImZvb1wiOiBbXX19Jyk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wid29ya3NwYWNlc1wiOntcImZvb1wiOiBcImJhclwifX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJ3b3Jrc3BhY2VzXCI6XCJmb29cIn0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJ3b3Jrc3BhY2VzXCI6MX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dldFdvcmtzcGFjZUJhY2t1cHMoKSBzaG91bGQgcmV0dXJuIFtdIHdoZW4gZmlsZXMuaG90RXhpdCA9IFwib25FeGl0QW5kV2luZG93Q2xvc2VcIicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHVwcGVyRm9vUGF0aCA9IGZvb0ZpbGUuZnNQYXRoLnRvVXBwZXJDYXNlKCk7XG5cdFx0XHRzZXJ2aWNlLnJlZ2lzdGVyV29ya3NwYWNlQmFja3VwKHRvV29ya3NwYWNlQmFja3VwSW5mbyh1cHBlckZvb1BhdGgpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCkubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpLm1hcChyID0+IHIud29ya3NwYWNlLmNvbmZpZ1BhdGgudG9TdHJpbmcoKSksIFtVUkkuZmlsZSh1cHBlckZvb1BhdGgpLnRvU3RyaW5nKCldKTtcblx0XHRcdGNvbmZpZ1NlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2ZpbGVzLmhvdEV4aXQnLCBIb3RFeGl0Q29uZmlndXJhdGlvbi5PTl9FWElUX0FORF9XSU5ET1dfQ0xPU0UpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKSwgW10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZ2V0RW1wdHlXb3Jrc3BhY2VCYWNrdXBQYXRocygpIHNob3VsZCByZXR1cm4gW10gd2hlbiB3b3Jrc3BhY2VzLmpzb24gZG9lc25cXCd0IGV4aXN0JywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnZXRFbXB0eVdvcmtzcGFjZUJhY2t1cFBhdGhzKCkgc2hvdWxkIHJldHVybiBbXSB3aGVuIGZvbGRlcldvcmtzcGFjZXMgaW4gd29ya3NwYWNlcy5qc29uIGlzIGFic2VudCcsIGFzeW5jICgpID0+IHtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dldEVtcHR5V29ya3NwYWNlQmFja3VwUGF0aHMoKSBzaG91bGQgcmV0dXJuIFtdIHdoZW4gZm9sZGVyV29ya3NwYWNlcyBpbiB3b3Jrc3BhY2VzLmpzb24gaXMgbm90IGEgc3RyaW5nIGFycmF5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoJ3tcImVtcHR5V29ya3NwYWNlc1wiOnt9fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJlbXB0eVdvcmtzcGFjZXNcIjp7XCJmb29cIjogW1wiYmFyXCJdfX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wiZW1wdHlXb3Jrc3BhY2VzXCI6e1wiZm9vXCI6IFtdfX0nKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLmdldEVtcHR5V2luZG93QmFja3VwcygpLCBbXSk7XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YSgne1wiZW1wdHlXb3Jrc3BhY2VzXCI6e1wiZm9vXCI6IFwiYmFyXCJ9fScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJlbXB0eVdvcmtzcGFjZXNcIjpcImZvb1wifScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCksIFtdKTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKCd7XCJlbXB0eVdvcmtzcGFjZXNcIjoxfScpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RW1wdHlXaW5kb3dCYWNrdXBzKCksIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2RlZHVwZUZvbGRlcldvcmtzcGFjZXMnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGlnbm9yZSBkdXBsaWNhdGVzIChmb2xkZXIgd29ya3NwYWNlKScsIGFzeW5jICgpID0+IHtcblxuXHRcdFx0YXdhaXQgZW5zdXJlRm9sZGVyRXhpc3RzKGV4aXN0aW5nVGVzdEZvbGRlcjEpO1xuXG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VzSnNvbjogSVNlcmlhbGl6ZWRCYWNrdXBXb3Jrc3BhY2VzID0ge1xuXHRcdFx0XHR3b3Jrc3BhY2VzOiBbXSxcblx0XHRcdFx0Zm9sZGVyczogW3sgZm9sZGVyVXJpOiBleGlzdGluZ1Rlc3RGb2xkZXIxLnRvU3RyaW5nKCkgfSwgeyBmb2xkZXJVcmk6IGV4aXN0aW5nVGVzdEZvbGRlcjEudG9TdHJpbmcoKSB9XSxcblx0XHRcdFx0ZW1wdHlXaW5kb3dzOiBbXVxuXHRcdFx0fTtcblx0XHRcdHdyaXRlV29ya3NwYWNlc01ldGFkYXRhKEpTT04uc3RyaW5naWZ5KHdvcmtzcGFjZXNKc29uKSk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblxuXHRcdFx0Y29uc3QganNvbiA9IHJlYWRXb3Jrc3BhY2VzTWV0YWRhdGEoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoanNvbi5mb2xkZXJzLCBbeyBmb2xkZXJVcmk6IGV4aXN0aW5nVGVzdEZvbGRlcjEudG9TdHJpbmcoKSB9XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIGR1cGxpY2F0ZXMgb24gV2luZG93cyBhbmQgTWFjIChmb2xkZXIgd29ya3NwYWNlKScsIGFzeW5jICgpID0+IHtcblxuXHRcdFx0YXdhaXQgZW5zdXJlRm9sZGVyRXhpc3RzKGV4aXN0aW5nVGVzdEZvbGRlcjEpO1xuXG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VzSnNvbjogSVNlcmlhbGl6ZWRCYWNrdXBXb3Jrc3BhY2VzID0ge1xuXHRcdFx0XHR3b3Jrc3BhY2VzOiBbXSxcblx0XHRcdFx0Zm9sZGVyczogW3sgZm9sZGVyVXJpOiBleGlzdGluZ1Rlc3RGb2xkZXIxLnRvU3RyaW5nKCkgfSwgeyBmb2xkZXJVcmk6IGV4aXN0aW5nVGVzdEZvbGRlcjEudG9TdHJpbmcoKS50b0xvd2VyQ2FzZSgpIH1dLFxuXHRcdFx0XHRlbXB0eVdpbmRvd3M6IFtdXG5cdFx0XHR9O1xuXHRcdFx0d3JpdGVXb3Jrc3BhY2VzTWV0YWRhdGEoSlNPTi5zdHJpbmdpZnkod29ya3NwYWNlc0pzb24pKTtcblx0XHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdFx0Y29uc3QganNvbiA9IHJlYWRXb3Jrc3BhY2VzTWV0YWRhdGEoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoanNvbi5mb2xkZXJzLCBbeyBmb2xkZXJVcmk6IGV4aXN0aW5nVGVzdEZvbGRlcjEudG9TdHJpbmcoKSB9XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIGR1cGxpY2F0ZXMgb24gV2luZG93cyBhbmQgTWFjIChyb290IHdvcmtzcGFjZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VQYXRoID0gcGF0aC5qb2luKHRlc3REaXIsICdGb28uY29kZS13b3Jrc3BhY2UnKTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZVBhdGgxID0gcGF0aC5qb2luKHRlc3REaXIsICdGT08uY29kZS13b3Jrc3BhY2UnKTtcblx0XHRcdGNvbnN0IHdvcmtzcGFjZVBhdGgyID0gcGF0aC5qb2luKHRlc3REaXIsICdmb28uY29kZS13b3Jrc3BhY2UnKTtcblxuXHRcdFx0Y29uc3Qgd29ya3NwYWNlMSA9IGF3YWl0IGVuc3VyZVdvcmtzcGFjZUV4aXN0cyh0b1dvcmtzcGFjZSh3b3Jrc3BhY2VQYXRoKSk7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2UyID0gYXdhaXQgZW5zdXJlV29ya3NwYWNlRXhpc3RzKHRvV29ya3NwYWNlKHdvcmtzcGFjZVBhdGgxKSk7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2UzID0gYXdhaXQgZW5zdXJlV29ya3NwYWNlRXhpc3RzKHRvV29ya3NwYWNlKHdvcmtzcGFjZVBhdGgyKSk7XG5cblx0XHRcdGNvbnN0IHdvcmtzcGFjZXNKc29uOiBJU2VyaWFsaXplZEJhY2t1cFdvcmtzcGFjZXMgPSB7XG5cdFx0XHRcdHdvcmtzcGFjZXM6IFt3b3Jrc3BhY2UxLCB3b3Jrc3BhY2UyLCB3b3Jrc3BhY2UzXS5tYXAodG9TZXJpYWxpemVkV29ya3NwYWNlKSxcblx0XHRcdFx0Zm9sZGVyczogW10sXG5cdFx0XHRcdGVtcHR5V2luZG93czogW11cblx0XHRcdH07XG5cdFx0XHR3cml0ZVdvcmtzcGFjZXNNZXRhZGF0YShKU09OLnN0cmluZ2lmeSh3b3Jrc3BhY2VzSnNvbikpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cblx0XHRcdGNvbnN0IGpzb24gPSByZWFkV29ya3NwYWNlc01ldGFkYXRhKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoanNvbi53b3Jrc3BhY2VzLmxlbmd0aCwgcGxhdGZvcm0uaXNMaW51eCA/IDMgOiAxKTtcblx0XHRcdGlmIChwbGF0Zm9ybS5pc0xpbnV4KSB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoanNvbi53b3Jrc3BhY2VzLm1hcChyID0+IHIuY29uZmlnVVJJUGF0aCksIFtVUkkuZmlsZSh3b3Jrc3BhY2VQYXRoKS50b1N0cmluZygpLCBVUkkuZmlsZSh3b3Jrc3BhY2VQYXRoMSkudG9TdHJpbmcoKSwgVVJJLmZpbGUod29ya3NwYWNlUGF0aDIpLnRvU3RyaW5nKCldKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoanNvbi53b3Jrc3BhY2VzLm1hcChyID0+IHIuY29uZmlnVVJJUGF0aCksIFtVUkkuZmlsZSh3b3Jrc3BhY2VQYXRoKS50b1N0cmluZygpXSwgJ3Nob3VsZCByZXR1cm4gdGhlIGZpcnN0IGR1cGxpY2F0ZWQgZW50cnknKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3JlZ2lzdGVyV2luZG93Rm9yQmFja3VwcycsICgpID0+IHtcblx0XHR0ZXN0KCdzaG91bGQgcGVyc2lzdCBwYXRocyB0byB3b3Jrc3BhY2VzLmpzb24gKGZvbGRlciB3b3Jrc3BhY2UpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oZm9vRmlsZSkpO1xuXHRcdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oYmFyRmlsZSkpO1xuXHRcdFx0YXNzZXJ0RXF1YWxGb2xkZXJJbmZvcyhzZXJ2aWNlLnRlc3RHZXRGb2xkZXJCYWNrdXBzKCksIFt0b0ZvbGRlckJhY2t1cEluZm8oZm9vRmlsZSksIHRvRm9sZGVyQmFja3VwSW5mbyhiYXJGaWxlKV0pO1xuXG5cdFx0XHRjb25zdCBqc29uID0gcmVhZFdvcmtzcGFjZXNNZXRhZGF0YSgpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChqc29uLmZvbGRlcnMsIFt7IGZvbGRlclVyaTogZm9vRmlsZS50b1N0cmluZygpIH0sIHsgZm9sZGVyVXJpOiBiYXJGaWxlLnRvU3RyaW5nKCkgfV0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHBlcnNpc3QgcGF0aHMgdG8gd29ya3NwYWNlcy5qc29uIChyb290IHdvcmtzcGFjZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB3czEgPSB0b1dvcmtzcGFjZUJhY2t1cEluZm8oZm9vRmlsZS5mc1BhdGgpO1xuXHRcdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh3czEpO1xuXHRcdFx0Y29uc3Qgd3MyID0gdG9Xb3Jrc3BhY2VCYWNrdXBJbmZvKGJhckZpbGUuZnNQYXRoKTtcblx0XHRcdHNlcnZpY2UucmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAod3MyKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCkubWFwKGIgPT4gYi53b3Jrc3BhY2UuY29uZmlnUGF0aC50b1N0cmluZygpKSwgW2Zvb0ZpbGUudG9TdHJpbmcoKSwgYmFyRmlsZS50b1N0cmluZygpXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3MxLndvcmtzcGFjZS5pZCwgc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpWzBdLndvcmtzcGFjZS5pZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwod3MyLndvcmtzcGFjZS5pZCwgc2VydmljZS50ZXN0R2V0V29ya3NwYWNlQmFja3VwcygpWzFdLndvcmtzcGFjZS5pZCk7XG5cblx0XHRcdGNvbnN0IGpzb24gPSByZWFkV29ya3NwYWNlc01ldGFkYXRhKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGpzb24ud29ya3NwYWNlcy5tYXAoYiA9PiBiLmNvbmZpZ1VSSVBhdGgpLCBbZm9vRmlsZS50b1N0cmluZygpLCBiYXJGaWxlLnRvU3RyaW5nKCldKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3czEud29ya3NwYWNlLmlkLCBqc29uLndvcmtzcGFjZXNbMF0uaWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzMi53b3Jrc3BhY2UuaWQsIGpzb24ud29ya3NwYWNlc1sxXS5pZCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBhbHdheXMgc3RvcmUgdGhlIHdvcmtzcGFjZSBwYXRoIGluIHdvcmtzcGFjZXMuanNvbiB1c2luZyB0aGUgY2FzZSBnaXZlbiwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBmaWxlIHN5c3RlbSBpcyBjYXNlLXNlbnNpdGl2ZSAoZm9sZGVyIHdvcmtzcGFjZSknLCBhc3luYyAoKSA9PiB7XG5cdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oVVJJLmZpbGUoZm9vRmlsZS5mc1BhdGgudG9VcHBlckNhc2UoKSkpKTtcblx0XHRhc3NlcnRFcXVhbEZvbGRlckluZm9zKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKSwgW3RvRm9sZGVyQmFja3VwSW5mbyhVUkkuZmlsZShmb29GaWxlLmZzUGF0aC50b1VwcGVyQ2FzZSgpKSldKTtcblxuXHRcdGNvbnN0IGpzb24gPSByZWFkV29ya3NwYWNlc01ldGFkYXRhKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChqc29uLmZvbGRlcnMsIFt7IGZvbGRlclVyaTogVVJJLmZpbGUoZm9vRmlsZS5mc1BhdGgudG9VcHBlckNhc2UoKSkudG9TdHJpbmcoKSB9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBhbHdheXMgc3RvcmUgdGhlIHdvcmtzcGFjZSBwYXRoIGluIHdvcmtzcGFjZXMuanNvbiB1c2luZyB0aGUgY2FzZSBnaXZlbiwgcmVnYXJkbGVzcyBvZiB3aGV0aGVyIHRoZSBmaWxlIHN5c3RlbSBpcyBjYXNlLXNlbnNpdGl2ZSAocm9vdCB3b3Jrc3BhY2UpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHVwcGVyRm9vUGF0aCA9IGZvb0ZpbGUuZnNQYXRoLnRvVXBwZXJDYXNlKCk7XG5cdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8odXBwZXJGb29QYXRoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRXb3Jrc3BhY2VCYWNrdXBzKCkubWFwKGIgPT4gYi53b3Jrc3BhY2UuY29uZmlnUGF0aC50b1N0cmluZygpKSwgW1VSSS5maWxlKHVwcGVyRm9vUGF0aCkudG9TdHJpbmcoKV0pO1xuXG5cdFx0Y29uc3QganNvbiA9IHJlYWRXb3Jrc3BhY2VzTWV0YWRhdGEoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGpzb24ud29ya3NwYWNlcy5tYXAoYiA9PiBiLmNvbmZpZ1VSSVBhdGgpLCBbVVJJLmZpbGUodXBwZXJGb29QYXRoKS50b1N0cmluZygpXSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdnZXRXb3Jrc3BhY2VIYXNoJywgKCkgPT4ge1xuXHRcdChwbGF0Zm9ybS5pc0xpbnV4ID8gdGVzdC5za2lwIDogdGVzdCkoJ3Nob3VsZCBpZ25vcmUgY2FzZSBvbiBXaW5kb3dzIGFuZCBNYWMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBhc3NlcnRGb2xkZXJIYXNoID0gKHVyaTE6IFVSSSwgdXJpMjogVVJJKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnRlc3RHZXRGb2xkZXJIYXNoKHRvRm9sZGVyQmFja3VwSW5mbyh1cmkxKSksIHNlcnZpY2UudGVzdEdldEZvbGRlckhhc2godG9Gb2xkZXJCYWNrdXBJbmZvKHVyaTIpKSk7XG5cdFx0XHR9O1xuXG5cdFx0XHRpZiAocGxhdGZvcm0uaXNNYWNpbnRvc2gpIHtcblx0XHRcdFx0YXNzZXJ0Rm9sZGVySGFzaChVUkkuZmlsZSgnL2ZvbycpLCBVUkkuZmlsZSgnL0ZPTycpKTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKHBsYXRmb3JtLmlzV2luZG93cykge1xuXHRcdFx0XHRhc3NlcnRGb2xkZXJIYXNoKFVSSS5maWxlKCdjOlxcXFxmb28nKSwgVVJJLmZpbGUoJ0M6XFxcXEZPTycpKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ21peGVkIHBhdGggY2FzaW5nJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBoYW5kbGUgY2FzZSBpbnNlbnNpdGl2ZSBwYXRocyBwcm9wZXJseSAocmVnaXN0ZXJXaW5kb3dGb3JCYWNrdXBzU3luYykgKGZvbGRlciB3b3Jrc3BhY2UpJywgKCkgPT4ge1xuXHRcdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oZm9vRmlsZSkpO1xuXHRcdFx0c2VydmljZS5yZWdpc3RlckZvbGRlckJhY2t1cCh0b0ZvbGRlckJhY2t1cEluZm8oVVJJLmZpbGUoZm9vRmlsZS5mc1BhdGgudG9VcHBlckNhc2UoKSkpKTtcblxuXHRcdFx0aWYgKHBsYXRmb3JtLmlzTGludXgpIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKS5sZW5ndGgsIDIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldEZvbGRlckJhY2t1cHMoKS5sZW5ndGgsIDEpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGhhbmRsZSBjYXNlIGluc2Vuc2l0aXZlIHBhdGhzIHByb3Blcmx5IChyZWdpc3RlcldpbmRvd0ZvckJhY2t1cHNTeW5jKSAocm9vdCB3b3Jrc3BhY2UpJywgKCkgPT4ge1xuXHRcdFx0c2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cCh0b1dvcmtzcGFjZUJhY2t1cEluZm8oZm9vRmlsZS5mc1BhdGgpKTtcblx0XHRcdHNlcnZpY2UucmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAodG9Xb3Jrc3BhY2VCYWNrdXBJbmZvKGZvb0ZpbGUuZnNQYXRoLnRvVXBwZXJDYXNlKCkpKTtcblxuXHRcdFx0aWYgKHBsYXRmb3JtLmlzTGludXgpIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKS5sZW5ndGgsIDIpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UudGVzdEdldFdvcmtzcGFjZUJhY2t1cHMoKS5sZW5ndGgsIDEpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnZ2V0RGlydHlXb3Jrc3BhY2VzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCByZXBvcnQgaWYgYSB3b3Jrc3BhY2Ugb3IgZm9sZGVyIGhhcyBiYWNrdXBzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZm9sZGVyQmFja3VwUGF0aCA9IHNlcnZpY2UucmVnaXN0ZXJGb2xkZXJCYWNrdXAodG9Gb2xkZXJCYWNrdXBJbmZvKGZvb0ZpbGUpKTtcblxuXHRcdFx0Y29uc3QgYmFja3VwV29ya3NwYWNlSW5mbyA9IHRvV29ya3NwYWNlQmFja3VwSW5mbyhmb29GaWxlLmZzUGF0aCk7XG5cdFx0XHRjb25zdCB3b3Jrc3BhY2VCYWNrdXBQYXRoID0gc2VydmljZS5yZWdpc3RlcldvcmtzcGFjZUJhY2t1cChiYWNrdXBXb3Jrc3BhY2VJbmZvKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCgoYXdhaXQgc2VydmljZS5nZXREaXJ0eVdvcmtzcGFjZXMoKSkubGVuZ3RoKSwgMCk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IGZzLnByb21pc2VzLm1rZGlyKHBhdGguam9pbihmb2xkZXJCYWNrdXBQYXRoLCBTY2hlbWFzLmZpbGUpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdFx0YXdhaXQgZnMucHJvbWlzZXMubWtkaXIocGF0aC5qb2luKHdvcmtzcGFjZUJhY2t1cFBhdGgsIFNjaGVtYXMudW50aXRsZWQpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSB9KTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdC8vIGlnbm9yZSAtIGZvbGRlciBtaWdodCBleGlzdCBhbHJlYWR5XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoKGF3YWl0IHNlcnZpY2UuZ2V0RGlydHlXb3Jrc3BhY2VzKCkpLmxlbmd0aCksIDApO1xuXG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbihmb2xkZXJCYWNrdXBQYXRoLCBTY2hlbWFzLmZpbGUsICc1OTRhNGE5ZDgyYTI3N2E4OTlkNDcxM2E1YjA4ZjUwNCcpLCAnJyk7XG5cdFx0XHRmcy53cml0ZUZpbGVTeW5jKHBhdGguam9pbih3b3Jrc3BhY2VCYWNrdXBQYXRoLCBTY2hlbWFzLnVudGl0bGVkLCAnNTk0YTRhOWQ4MmEyNzdhODk5ZDQ3MTNhNWIwOGY1MDQnKSwgJycpO1xuXG5cdFx0XHRjb25zdCBkaXJ0eVdvcmtzcGFjZXMgPSBhd2FpdCBzZXJ2aWNlLmdldERpcnR5V29ya3NwYWNlcygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpcnR5V29ya3NwYWNlcy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRsZXQgZm91bmQgPSAwO1xuXHRcdFx0Zm9yIChjb25zdCBkaXJ0eVdvcmtwc3BhY2Ugb2YgZGlydHlXb3Jrc3BhY2VzKSB7XG5cdFx0XHRcdGlmIChpc0ZvbGRlckJhY2t1cEluZm8oZGlydHlXb3JrcHNwYWNlKSkge1xuXHRcdFx0XHRcdGlmIChpc0VxdWFsKGZvb0ZpbGUsIGRpcnR5V29ya3BzcGFjZS5mb2xkZXJVcmkpKSB7XG5cdFx0XHRcdFx0XHRmb3VuZCsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRpZiAoaXNFcXVhbChiYWNrdXBXb3Jrc3BhY2VJbmZvLndvcmtzcGFjZS5jb25maWdQYXRoLCBkaXJ0eVdvcmtwc3BhY2Uud29ya3NwYWNlLmNvbmZpZ1BhdGgpKSB7XG5cdFx0XHRcdFx0XHRmb3VuZCsrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91bmQsIDIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsa0JBQWtCO0FBQzNCLFlBQVksUUFBUTtBQUNwQixZQUFZLFFBQVE7QUFDcEIsU0FBUyxlQUFlO0FBQ3hCLFlBQVksVUFBVTtBQUN0QixZQUFZLGNBQWM7QUFDMUIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVkseUJBQXlCO0FBQzlDLFNBQVMseUJBQXlCO0FBRWxDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsU0FBUyxpQkFBaUI7QUFDbkMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyx5QkFBeUI7QUFDbEMsT0FBTyxhQUFhO0FBQ3BCLFNBQTRCLDBCQUFnRDtBQUU1RSxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLCtDQUErQztBQUV4RCxXQUFXLHFCQUFxQixNQUFNO0FBRXJDLFdBQVMsdUJBQXVCLFFBQTZCLFVBQStCO0FBQzNGLFVBQU0sa0JBQWtCLENBQUMsT0FBMEIsRUFBRSxXQUFXLEVBQUUsVUFBVSxTQUFTLEdBQUcsaUJBQWlCLEVBQUUsZ0JBQWdCO0FBQzNILFdBQU8sZ0JBQWdCLE9BQU8sSUFBSSxlQUFlLEdBQUcsU0FBUyxJQUFJLGVBQWUsQ0FBQztBQUFBLEVBQ2xGO0FBRUEsV0FBUyxZQUFZQSxPQUFvQztBQUN4RCxXQUFPO0FBQUEsTUFDTixJQUFJLFdBQVcsS0FBSyxFQUFFLE9BQU8sYUFBYUEsS0FBSSxDQUFDLEVBQUUsT0FBTyxLQUFLO0FBQUE7QUFBQSxNQUM3RCxZQUFZLElBQUksS0FBS0EsS0FBSTtBQUFBLElB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
