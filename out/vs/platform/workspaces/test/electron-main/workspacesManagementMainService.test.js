import assert from "assert";
import * as fs from "fs";
import * as os from "os";
import { isUNC, toSlashes } from "../../../../base/common/extpath.js";
import { normalizeDriveLetter } from "../../../../base/common/labels.js";
import * as path from "../../../../base/common/path.js";
import { isWindows } from "../../../../base/common/platform.js";
import { extUriBiasedIgnorePathCase } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import * as pfs from "../../../../base/node/pfs.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { flakySuite, getRandomTestPath } from "../../../../base/test/node/testUtils.js";
import { EnvironmentMainService } from "../../../environment/electron-main/environmentMainService.js";
import { OPTIONS, parseArgs } from "../../../environment/node/argv.js";
import { FileService } from "../../../files/common/fileService.js";
import { NullLogService } from "../../../log/common/log.js";
import product from "../../../product/common/product.js";
import { SaveStrategy, StateService } from "../../../state/node/stateService.js";
import { UriIdentityService } from "../../../uriIdentity/common/uriIdentityService.js";
import { UserDataProfilesMainService } from "../../../userDataProfile/electron-main/userDataProfile.js";
import { WORKSPACE_EXTENSION } from "../../../workspace/common/workspace.js";
import { rewriteWorkspaceFileForNewLocation } from "../../common/workspaces.js";
import { WorkspacesManagementMainService } from "../../electron-main/workspacesManagementMainService.js";
flakySuite("WorkspacesManagementMainService", () => {
  class TestDialogMainService {
    pickFileFolder(options, window) {
      throw new Error("Method not implemented.");
    }
    pickFolder(options, window) {
      throw new Error("Method not implemented.");
    }
    pickFile(options, window) {
      throw new Error("Method not implemented.");
    }
    pickWorkspace(options, window) {
      throw new Error("Method not implemented.");
    }
    showMessageBox(options, window) {
      throw new Error("Method not implemented.");
    }
    showSaveDialog(options, window) {
      throw new Error("Method not implemented.");
    }
    showOpenDialog(options, window) {
      throw new Error("Method not implemented.");
    }
  }
  class TestBackupMainService {
    isHotExitEnabled() {
      throw new Error("Method not implemented.");
    }
    getEmptyWindowBackups() {
      throw new Error("Method not implemented.");
    }
    registerWorkspaceBackup(workspaceInfo, migrateFrom) {
      throw new Error("Method not implemented.");
    }
    registerFolderBackup(folder) {
      throw new Error("Method not implemented.");
    }
    registerEmptyWindowBackup(empty) {
      throw new Error("Method not implemented.");
    }
    async getDirtyWorkspaces() {
      return [];
    }
  }
  function createUntitledWorkspace(folders, names) {
    return service.createUntitledWorkspace(folders.map((folder, index) => ({ uri: URI.file(folder), name: names ? names[index] : void 0 })));
  }
  function createWorkspace(workspaceConfigPath, folders, names) {
    const ws = {
      folders: []
    };
    for (let i = 0; i < folders.length; i++) {
      const f = folders[i];
      const s = f instanceof URI ? { uri: f.toString() } : { path: f };
      if (names) {
        s.name = names[i];
      }
      ws.folders.push(s);
    }
    fs.writeFileSync(workspaceConfigPath, JSON.stringify(ws));
  }
  let testDir;
  let untitledWorkspacesHomePath;
  let environmentMainService;
  let service;
  const cwd = process.cwd();
  const tmpDir = os.tmpdir();
  setup(async () => {
    testDir = getRandomTestPath(tmpDir, "vsctests", "workspacesmanagementmainservice");
    untitledWorkspacesHomePath = path.join(testDir, "Workspaces");
    const productService = { _serviceBrand: void 0, ...product };
    environmentMainService = new class TestEnvironmentService extends EnvironmentMainService {
      constructor() {
        super(parseArgs(process.argv, OPTIONS), productService);
      }
      get untitledWorkspacesHome() {
        return URI.file(untitledWorkspacesHomePath);
      }
    }();
    const logService = new NullLogService();
    const fileService = new FileService(logService);
    service = new WorkspacesManagementMainService(environmentMainService, logService, new UserDataProfilesMainService(new StateService(SaveStrategy.DELAYED, environmentMainService, logService, fileService), new UriIdentityService(fileService), environmentMainService, fileService, logService), new TestBackupMainService(), new TestDialogMainService());
    return fs.promises.mkdir(untitledWorkspacesHomePath, { recursive: true });
  });
  teardown(() => {
    service.dispose();
    return pfs.Promises.rm(testDir);
  });
  function assertPathEquals(pathInWorkspaceFile, pathOnDisk) {
    if (isWindows) {
      pathInWorkspaceFile = normalizeDriveLetter(pathInWorkspaceFile);
      pathOnDisk = normalizeDriveLetter(pathOnDisk);
      if (!isUNC(pathOnDisk)) {
        pathOnDisk = toSlashes(pathOnDisk);
      }
    }
    assert.strictEqual(pathInWorkspaceFile, pathOnDisk);
  }
  function assertEqualURI(u1, u2) {
    assert.strictEqual(u1.toString(), u2.toString());
  }
  test("createWorkspace (folders)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    assert.ok(workspace);
    assert.ok(fs.existsSync(workspace.configPath.fsPath));
    assert.ok(service.isUntitledWorkspace(workspace));
    const ws = JSON.parse(fs.readFileSync(workspace.configPath.fsPath).toString());
    assert.strictEqual(ws.folders.length, 2);
    assertPathEquals(ws.folders[0].path, cwd);
    assertPathEquals(ws.folders[1].path, tmpDir);
    assert.ok(!ws.folders[0].name);
    assert.ok(!ws.folders[1].name);
  });
  test("createWorkspace (folders with name)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir], ["currentworkingdirectory", "tempdir"]);
    assert.ok(workspace);
    assert.ok(fs.existsSync(workspace.configPath.fsPath));
    assert.ok(service.isUntitledWorkspace(workspace));
    const ws = JSON.parse(fs.readFileSync(workspace.configPath.fsPath).toString());
    assert.strictEqual(ws.folders.length, 2);
    assertPathEquals(ws.folders[0].path, cwd);
    assertPathEquals(ws.folders[1].path, tmpDir);
    assert.strictEqual(ws.folders[0].name, "currentworkingdirectory");
    assert.strictEqual(ws.folders[1].name, "tempdir");
  });
  test("createUntitledWorkspace (folders as other resource URIs)", async () => {
    const folder1URI = URI.parse("myscheme://server/work/p/f1");
    const folder2URI = URI.parse("myscheme://server/work/o/f3");
    const workspace = await service.createUntitledWorkspace([{ uri: folder1URI }, { uri: folder2URI }], "server");
    assert.ok(workspace);
    assert.ok(fs.existsSync(workspace.configPath.fsPath));
    assert.ok(service.isUntitledWorkspace(workspace));
    const ws = JSON.parse(fs.readFileSync(workspace.configPath.fsPath).toString());
    assert.strictEqual(ws.folders.length, 2);
    assert.strictEqual(ws.folders[0].uri, folder1URI.toString(true));
    assert.strictEqual(ws.folders[1].uri, folder2URI.toString(true));
    assert.ok(!ws.folders[0].name);
    assert.ok(!ws.folders[1].name);
    assert.strictEqual(ws.remoteAuthority, "server");
  });
  test("resolveWorkspace", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    assert.ok(await service.resolveLocalWorkspace(workspace.configPath));
    const newPath = path.join(path.dirname(workspace.configPath.fsPath), `workspace.${WORKSPACE_EXTENSION}`);
    fs.renameSync(workspace.configPath.fsPath, newPath);
    workspace.configPath = URI.file(newPath);
    const resolved = await service.resolveLocalWorkspace(workspace.configPath);
    assert.strictEqual(2, resolved.folders.length);
    assertEqualURI(resolved.configPath, workspace.configPath);
    assert.ok(resolved.id);
    fs.writeFileSync(workspace.configPath.fsPath, JSON.stringify({ something: "something" }));
    const resolvedInvalid = await service.resolveLocalWorkspace(workspace.configPath);
    assert.ok(!resolvedInvalid);
    fs.writeFileSync(workspace.configPath.fsPath, JSON.stringify({ transient: true, folders: [] }));
    const resolvedTransient = await service.resolveLocalWorkspace(workspace.configPath);
    assert.ok(resolvedTransient?.transient);
  });
  test("resolveWorkspace (support relative paths)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    fs.writeFileSync(workspace.configPath.fsPath, JSON.stringify({ folders: [{ path: "./ticino-playground/lib" }] }));
    const resolved = await service.resolveLocalWorkspace(workspace.configPath);
    assertEqualURI(resolved.folders[0].uri, URI.file(path.join(path.dirname(workspace.configPath.fsPath), "ticino-playground", "lib")));
  });
  test("resolveWorkspace (support relative paths #2)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    fs.writeFileSync(workspace.configPath.fsPath, JSON.stringify({ folders: [{ path: "./ticino-playground/lib/../other" }] }));
    const resolved = await service.resolveLocalWorkspace(workspace.configPath);
    assertEqualURI(resolved.folders[0].uri, URI.file(path.join(path.dirname(workspace.configPath.fsPath), "ticino-playground", "other")));
  });
  test("resolveWorkspace (support relative paths #3)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    fs.writeFileSync(workspace.configPath.fsPath, JSON.stringify({ folders: [{ path: "ticino-playground/lib" }] }));
    const resolved = await service.resolveLocalWorkspace(workspace.configPath);
    assertEqualURI(resolved.folders[0].uri, URI.file(path.join(path.dirname(workspace.configPath.fsPath), "ticino-playground", "lib")));
  });
  test("resolveWorkspace (support invalid JSON via fault tolerant parsing)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    fs.writeFileSync(workspace.configPath.fsPath, '{ "folders": [ { "path": "./ticino-playground/lib" } , ] }');
    const resolved = await service.resolveLocalWorkspace(workspace.configPath);
    assertEqualURI(resolved.folders[0].uri, URI.file(path.join(path.dirname(workspace.configPath.fsPath), "ticino-playground", "lib")));
  });
  test("rewriteWorkspaceFileForNewLocation", async () => {
    const folder1 = cwd;
    const tmpInsideDir = path.join(tmpDir, "inside");
    const firstConfigPath = path.join(tmpDir, "myworkspace0.code-workspace");
    createWorkspace(firstConfigPath, [folder1, "inside", path.join("inside", "somefolder")]);
    const origContent = fs.readFileSync(firstConfigPath).toString();
    let origConfigPath = URI.file(firstConfigPath);
    let workspaceConfigPath = URI.file(path.join(tmpDir, "inside", "myworkspace1.code-workspace"));
    let newContent = rewriteWorkspaceFileForNewLocation(origContent, origConfigPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    let ws = JSON.parse(newContent);
    assert.strictEqual(ws.folders.length, 3);
    assertPathEquals(ws.folders[0].path, folder1);
    assertPathEquals(ws.folders[1].path, ".");
    assertPathEquals(ws.folders[2].path, "somefolder");
    origConfigPath = workspaceConfigPath;
    workspaceConfigPath = URI.file(path.join(tmpDir, "myworkspace2.code-workspace"));
    newContent = rewriteWorkspaceFileForNewLocation(newContent, origConfigPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    ws = JSON.parse(newContent);
    assert.strictEqual(ws.folders.length, 3);
    assertPathEquals(ws.folders[0].path, folder1);
    assertPathEquals(ws.folders[1].path, "inside");
    assertPathEquals(ws.folders[2].path, "inside/somefolder");
    origConfigPath = workspaceConfigPath;
    workspaceConfigPath = URI.file(path.join(tmpDir, "other", "myworkspace2.code-workspace"));
    newContent = rewriteWorkspaceFileForNewLocation(newContent, origConfigPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    ws = JSON.parse(newContent);
    assert.strictEqual(ws.folders.length, 3);
    assertPathEquals(ws.folders[0].path, folder1);
    assertPathEquals(ws.folders[1].path, "../inside");
    assertPathEquals(ws.folders[2].path, "../inside/somefolder");
    origConfigPath = workspaceConfigPath;
    workspaceConfigPath = URI.parse("foo://foo/bar/myworkspace2.code-workspace");
    newContent = rewriteWorkspaceFileForNewLocation(newContent, origConfigPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    ws = JSON.parse(newContent);
    assert.strictEqual(ws.folders.length, 3);
    assert.strictEqual(ws.folders[0].uri, URI.file(folder1).toString(true));
    assert.strictEqual(ws.folders[1].uri, URI.file(tmpInsideDir).toString(true));
    assert.strictEqual(ws.folders[2].uri, URI.file(path.join(tmpInsideDir, "somefolder")).toString(true));
    fs.unlinkSync(firstConfigPath);
  });
  test("rewriteWorkspaceFileForNewLocation (preserves comments)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir, path.join(tmpDir, "somefolder")]);
    const workspaceConfigPath = URI.file(path.join(tmpDir, `myworkspace.${Date.now()}.${WORKSPACE_EXTENSION}`));
    let origContent = fs.readFileSync(workspace.configPath.fsPath).toString();
    origContent = `// this is a comment
${origContent}`;
    const newContent = rewriteWorkspaceFileForNewLocation(origContent, workspace.configPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    assert.strictEqual(0, newContent.indexOf("// this is a comment"));
    await service.deleteUntitledWorkspace(workspace);
  });
  test("rewriteWorkspaceFileForNewLocation (preserves forward slashes)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir, path.join(tmpDir, "somefolder")]);
    const workspaceConfigPath = URI.file(path.join(tmpDir, `myworkspace.${Date.now()}.${WORKSPACE_EXTENSION}`));
    let origContent = fs.readFileSync(workspace.configPath.fsPath).toString();
    origContent = origContent.replace(/[\\]/g, "/");
    const newContent = rewriteWorkspaceFileForNewLocation(origContent, workspace.configPath, false, workspaceConfigPath, extUriBiasedIgnorePathCase);
    const ws = JSON.parse(newContent);
    assert.ok(ws.folders.every((f) => f.path.indexOf("\\") < 0));
    await service.deleteUntitledWorkspace(workspace);
  });
  (!isWindows ? test.skip : test)("rewriteWorkspaceFileForNewLocation (unc paths)", async () => {
    const workspaceLocation = path.join(tmpDir, "wsloc");
    const folder1Location = "x:\\foo";
    const folder2Location = "\\\\server\\share2\\some\\path";
    const folder3Location = path.join(workspaceLocation, "inner", "more");
    const workspace = await createUntitledWorkspace([folder1Location, folder2Location, folder3Location]);
    const workspaceConfigPath = URI.file(path.join(workspaceLocation, `myworkspace.${Date.now()}.${WORKSPACE_EXTENSION}`));
    const origContent = fs.readFileSync(workspace.configPath.fsPath).toString();
    const newContent = rewriteWorkspaceFileForNewLocation(origContent, workspace.configPath, true, workspaceConfigPath, extUriBiasedIgnorePathCase);
    const ws = JSON.parse(newContent);
    assertPathEquals(ws.folders[0].path, folder1Location);
    assertPathEquals(ws.folders[1].path, folder2Location);
    assertPathEquals(ws.folders[2].path, "inner/more");
    await service.deleteUntitledWorkspace(workspace);
  });
  test("deleteUntitledWorkspace (untitled)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    assert.ok(fs.existsSync(workspace.configPath.fsPath));
    await service.deleteUntitledWorkspace(workspace);
    assert.ok(!fs.existsSync(workspace.configPath.fsPath));
  });
  test("deleteUntitledWorkspace (saved)", async () => {
    const workspace = await createUntitledWorkspace([cwd, tmpDir]);
    await service.deleteUntitledWorkspace(workspace);
  });
  test("getUntitledWorkspace", async function() {
    await service.initialize();
    let untitled = service.getUntitledWorkspaces();
    assert.strictEqual(untitled.length, 0);
    const untitledOne = await createUntitledWorkspace([cwd, tmpDir]);
    assert.ok(fs.existsSync(untitledOne.configPath.fsPath));
    await service.initialize();
    untitled = service.getUntitledWorkspaces();
    assert.strictEqual(1, untitled.length);
    assert.strictEqual(untitledOne.id, untitled[0].workspace.id);
    await service.deleteUntitledWorkspace(untitledOne);
    await service.initialize();
    untitled = service.getUntitledWorkspaces();
    assert.strictEqual(0, untitled.length);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS93b3Jrc3BhY2VzL3Rlc3QvZWxlY3Ryb24tbWFpbi93b3Jrc3BhY2VzTWFuYWdlbWVudE1haW5TZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBvcyBmcm9tICdvcyc7XG5pbXBvcnQgeyBpc1VOQywgdG9TbGFzaGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXh0cGF0aC5qcyc7XG5pbXBvcnQgeyBub3JtYWxpemVEcml2ZUxldHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCAqIGFzIHBmcyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL25vZGUvcGZzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgZmxha3lTdWl0ZSwgZ2V0UmFuZG9tVGVzdFBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3Qvbm9kZS90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUJhY2t1cEluZm8sIElGb2xkZXJCYWNrdXBJbmZvIH0gZnJvbSAnLi4vLi4vLi4vYmFja3VwL2NvbW1vbi9iYWNrdXAuanMnO1xuaW1wb3J0IHsgSUJhY2t1cE1haW5TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vYmFja3VwL2VsZWN0cm9uLW1haW4vYmFja3VwLmpzJztcbmltcG9ydCB7IElFbXB0eVdpbmRvd0JhY2t1cEluZm8gfSBmcm9tICcuLi8uLi8uLi9iYWNrdXAvbm9kZS9iYWNrdXAuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9kaWFsb2dzL2VsZWN0cm9uLW1haW4vZGlhbG9nTWFpblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRW52aXJvbm1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2VsZWN0cm9uLW1haW4vZW52aXJvbm1lbnRNYWluU2VydmljZS5qcyc7XG5pbXBvcnQgeyBPUFRJT05TLCBwYXJzZUFyZ3MgfSBmcm9tICcuLi8uLi8uLi9lbnZpcm9ubWVudC9ub2RlL2FyZ3YuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcbmltcG9ydCB7IElQcm9kdWN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3Byb2R1Y3QvY29tbW9uL3Byb2R1Y3RTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFNhdmVTdHJhdGVneSwgU3RhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc3RhdGUvbm9kZS9zdGF0ZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBVc2VyRGF0YVByb2ZpbGVzTWFpblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvZWxlY3Ryb24tbWFpbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgSVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXIsIElSYXdVcmlXb3Jrc3BhY2VGb2xkZXIsIFdPUktTUEFDRV9FWFRFTlNJT04gfSBmcm9tICcuLi8uLi8uLi93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmVkV29ya3NwYWNlLCBJU3RvcmVkV29ya3NwYWNlRm9sZGVyLCBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhLCByZXdyaXRlV29ya3NwYWNlRmlsZUZvck5ld0xvY2F0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZSB9IGZyb20gJy4uLy4uL2VsZWN0cm9uLW1haW4vd29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZS5qcyc7XG5cbmZsYWt5U3VpdGUoJ1dvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UnLCAoKSA9PiB7XG5cblx0Y2xhc3MgVGVzdERpYWxvZ01haW5TZXJ2aWNlIGltcGxlbWVudHMgSURpYWxvZ01haW5TZXJ2aWNlIHtcblxuXHRcdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdFx0cGlja0ZpbGVGb2xkZXIob3B0aW9uczogSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zLCB3aW5kb3c/OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgdW5kZWZpbmVkKTogUHJvbWlzZTxzdHJpbmdbXSB8IHVuZGVmaW5lZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRwaWNrRm9sZGVyKG9wdGlvbnM6IElOYXRpdmVPcGVuRGlhbG9nT3B0aW9ucywgd2luZG93PzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nW10gfCB1bmRlZmluZWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0cGlja0ZpbGUob3B0aW9uczogSU5hdGl2ZU9wZW5EaWFsb2dPcHRpb25zLCB3aW5kb3c/OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgdW5kZWZpbmVkKTogUHJvbWlzZTxzdHJpbmdbXSB8IHVuZGVmaW5lZD4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRwaWNrV29ya3NwYWNlKG9wdGlvbnM6IElOYXRpdmVPcGVuRGlhbG9nT3B0aW9ucywgd2luZG93PzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZCk6IFByb21pc2U8c3RyaW5nW10gfCB1bmRlZmluZWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0c2hvd01lc3NhZ2VCb3gob3B0aW9uczogRWxlY3Ryb24uTWVzc2FnZUJveE9wdGlvbnMsIHdpbmRvdz86IEVsZWN0cm9uLkJyb3dzZXJXaW5kb3cgfCB1bmRlZmluZWQpOiBQcm9taXNlPEVsZWN0cm9uLk1lc3NhZ2VCb3hSZXR1cm5WYWx1ZT4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRzaG93U2F2ZURpYWxvZyhvcHRpb25zOiBFbGVjdHJvbi5TYXZlRGlhbG9nT3B0aW9ucywgd2luZG93PzogRWxlY3Ryb24uQnJvd3NlcldpbmRvdyB8IHVuZGVmaW5lZCk6IFByb21pc2U8RWxlY3Ryb24uU2F2ZURpYWxvZ1JldHVyblZhbHVlPiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdHNob3dPcGVuRGlhbG9nKG9wdGlvbnM6IEVsZWN0cm9uLk9wZW5EaWFsb2dPcHRpb25zLCB3aW5kb3c/OiBFbGVjdHJvbi5Ccm93c2VyV2luZG93IHwgdW5kZWZpbmVkKTogUHJvbWlzZTxFbGVjdHJvbi5PcGVuRGlhbG9nUmV0dXJuVmFsdWU+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdH1cblxuXHRjbGFzcyBUZXN0QmFja3VwTWFpblNlcnZpY2UgaW1wbGVtZW50cyBJQmFja3VwTWFpblNlcnZpY2Uge1xuXG5cdFx0ZGVjbGFyZSByZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0XHRpc0hvdEV4aXRFbmFibGVkKCk6IGJvb2xlYW4geyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRnZXRFbXB0eVdpbmRvd0JhY2t1cHMoKTogSUVtcHR5V2luZG93QmFja3VwSW5mb1tdIHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0cmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAod29ya3NwYWNlSW5mbzogSVdvcmtzcGFjZUJhY2t1cEluZm8pOiBzdHJpbmc7XG5cdFx0cmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAod29ya3NwYWNlSW5mbzogSVdvcmtzcGFjZUJhY2t1cEluZm8sIG1pZ3JhdGVGcm9tOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz47XG5cdFx0cmVnaXN0ZXJXb3Jrc3BhY2VCYWNrdXAod29ya3NwYWNlSW5mbzogdW5rbm93biwgbWlncmF0ZUZyb20/OiB1bmtub3duKTogc3RyaW5nIHwgUHJvbWlzZTxzdHJpbmc+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG5cdFx0cmVnaXN0ZXJGb2xkZXJCYWNrdXAoZm9sZGVyOiBJRm9sZGVyQmFja3VwSW5mbyk6IHN0cmluZyB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfVxuXHRcdHJlZ2lzdGVyRW1wdHlXaW5kb3dCYWNrdXAoZW1wdHk6IElFbXB0eVdpbmRvd0JhY2t1cEluZm8pOiBzdHJpbmcgeyB0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7IH1cblx0XHRhc3luYyBnZXREaXJ0eVdvcmtzcGFjZXMoKTogUHJvbWlzZTwoSVdvcmtzcGFjZUJhY2t1cEluZm8gfCBJRm9sZGVyQmFja3VwSW5mbylbXT4geyByZXR1cm4gW107IH1cblx0fVxuXG5cdGZ1bmN0aW9uIGNyZWF0ZVVudGl0bGVkV29ya3NwYWNlKGZvbGRlcnM6IHN0cmluZ1tdLCBuYW1lcz86IHN0cmluZ1tdKSB7XG5cdFx0cmV0dXJuIHNlcnZpY2UuY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoZm9sZGVycy5tYXAoKGZvbGRlciwgaW5kZXgpID0+ICh7IHVyaTogVVJJLmZpbGUoZm9sZGVyKSwgbmFtZTogbmFtZXMgPyBuYW1lc1tpbmRleF0gOiB1bmRlZmluZWQgfSBhcyBJV29ya3NwYWNlRm9sZGVyQ3JlYXRpb25EYXRhKSkpO1xuXHR9XG5cblx0ZnVuY3Rpb24gY3JlYXRlV29ya3NwYWNlKHdvcmtzcGFjZUNvbmZpZ1BhdGg6IHN0cmluZywgZm9sZGVyczogKHN0cmluZyB8IFVSSSlbXSwgbmFtZXM/OiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdGNvbnN0IHdzOiBJU3RvcmVkV29ya3NwYWNlID0ge1xuXHRcdFx0Zm9sZGVyczogW11cblx0XHR9O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBmb2xkZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBmID0gZm9sZGVyc1tpXTtcblx0XHRcdGNvbnN0IHM6IElTdG9yZWRXb3Jrc3BhY2VGb2xkZXIgPSBmIGluc3RhbmNlb2YgVVJJID8geyB1cmk6IGYudG9TdHJpbmcoKSB9IDogeyBwYXRoOiBmIH07XG5cdFx0XHRpZiAobmFtZXMpIHtcblx0XHRcdFx0cy5uYW1lID0gbmFtZXNbaV07XG5cdFx0XHR9XG5cdFx0XHR3cy5mb2xkZXJzLnB1c2gocyk7XG5cdFx0fVxuXG5cdFx0ZnMud3JpdGVGaWxlU3luYyh3b3Jrc3BhY2VDb25maWdQYXRoLCBKU09OLnN0cmluZ2lmeSh3cykpO1xuXHR9XG5cblx0bGV0IHRlc3REaXI6IHN0cmluZztcblx0bGV0IHVudGl0bGVkV29ya3NwYWNlc0hvbWVQYXRoOiBzdHJpbmc7XG5cdGxldCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlOiBFbnZpcm9ubWVudE1haW5TZXJ2aWNlO1xuXHRsZXQgc2VydmljZTogV29ya3NwYWNlc01hbmFnZW1lbnRNYWluU2VydmljZTtcblxuXHRjb25zdCBjd2QgPSBwcm9jZXNzLmN3ZCgpO1xuXHRjb25zdCB0bXBEaXIgPSBvcy50bXBkaXIoKTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0dGVzdERpciA9IGdldFJhbmRvbVRlc3RQYXRoKHRtcERpciwgJ3ZzY3Rlc3RzJywgJ3dvcmtzcGFjZXNtYW5hZ2VtZW50bWFpbnNlcnZpY2UnKTtcblx0XHR1bnRpdGxlZFdvcmtzcGFjZXNIb21lUGF0aCA9IHBhdGguam9pbih0ZXN0RGlyLCAnV29ya3NwYWNlcycpO1xuXG5cdFx0Y29uc3QgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSA9IHsgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkLCAuLi5wcm9kdWN0IH07XG5cblx0XHRlbnZpcm9ubWVudE1haW5TZXJ2aWNlID0gbmV3IGNsYXNzIFRlc3RFbnZpcm9ubWVudFNlcnZpY2UgZXh0ZW5kcyBFbnZpcm9ubWVudE1haW5TZXJ2aWNlIHtcblxuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKHBhcnNlQXJncyhwcm9jZXNzLmFyZ3YsIE9QVElPTlMpLCBwcm9kdWN0U2VydmljZSk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIGdldCB1bnRpdGxlZFdvcmtzcGFjZXNIb21lKCk6IFVSSSB7XG5cdFx0XHRcdHJldHVybiBVUkkuZmlsZSh1bnRpdGxlZFdvcmtzcGFjZXNIb21lUGF0aCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBuZXcgTnVsbExvZ1NlcnZpY2UoKTtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IG5ldyBGaWxlU2VydmljZShsb2dTZXJ2aWNlKTtcblx0XHRzZXJ2aWNlID0gbmV3IFdvcmtzcGFjZXNNYW5hZ2VtZW50TWFpblNlcnZpY2UoZW52aXJvbm1lbnRNYWluU2VydmljZSwgbG9nU2VydmljZSwgbmV3IFVzZXJEYXRhUHJvZmlsZXNNYWluU2VydmljZShuZXcgU3RhdGVTZXJ2aWNlKFNhdmVTdHJhdGVneS5ERUxBWUVELCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBsb2dTZXJ2aWNlLCBmaWxlU2VydmljZSksIG5ldyBVcmlJZGVudGl0eVNlcnZpY2UoZmlsZVNlcnZpY2UpLCBlbnZpcm9ubWVudE1haW5TZXJ2aWNlLCBmaWxlU2VydmljZSwgbG9nU2VydmljZSksIG5ldyBUZXN0QmFja3VwTWFpblNlcnZpY2UoKSwgbmV3IFRlc3REaWFsb2dNYWluU2VydmljZSgpKTtcblxuXHRcdHJldHVybiBmcy5wcm9taXNlcy5ta2Rpcih1bnRpdGxlZFdvcmtzcGFjZXNIb21lUGF0aCwgeyByZWN1cnNpdmU6IHRydWUgfSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblxuXHRcdHJldHVybiBwZnMuUHJvbWlzZXMucm0odGVzdERpcik7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFzc2VydFBhdGhFcXVhbHMocGF0aEluV29ya3NwYWNlRmlsZTogc3RyaW5nLCBwYXRoT25EaXNrOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRpZiAoaXNXaW5kb3dzKSB7XG5cdFx0XHRwYXRoSW5Xb3Jrc3BhY2VGaWxlID0gbm9ybWFsaXplRHJpdmVMZXR0ZXIocGF0aEluV29ya3NwYWNlRmlsZSk7XG5cdFx0XHRwYXRoT25EaXNrID0gbm9ybWFsaXplRHJpdmVMZXR0ZXIocGF0aE9uRGlzayk7XG5cdFx0XHRpZiAoIWlzVU5DKHBhdGhPbkRpc2spKSB7XG5cdFx0XHRcdHBhdGhPbkRpc2sgPSB0b1NsYXNoZXMocGF0aE9uRGlzayk7IC8vIHdvcmtzcGFjZSBmaWxlIGlzIHVzaW5nIHNsYXNoZXMgZm9yIGFsbCBwYXRocyBleGNlcHQgd2hlcmUgbWFuZGF0b3J5XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhdGhJbldvcmtzcGFjZUZpbGUsIHBhdGhPbkRpc2spO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0RXF1YWxVUkkodTE6IFVSSSwgdTI6IFVSSSk6IHZvaWQge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1MS50b1N0cmluZygpLCB1Mi50b1N0cmluZygpKTtcblx0fVxuXG5cdHRlc3QoJ2NyZWF0ZVdvcmtzcGFjZSAoZm9sZGVycyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2N3ZCwgdG1wRGlyXSk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaXNVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpKTtcblxuXHRcdGNvbnN0IHdzID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkudG9TdHJpbmcoKSkgYXMgSVN0b3JlZFdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzLmZvbGRlcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1swXSkucGF0aCwgY3dkKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1sxXSkucGF0aCwgdG1wRGlyKTtcblx0XHRhc3NlcnQub2soISg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1swXSkubmFtZSk7XG5cdFx0YXNzZXJ0Lm9rKCEoPElSYXdGaWxlV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMV0pLm5hbWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVXb3Jrc3BhY2UgKGZvbGRlcnMgd2l0aCBuYW1lKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBhd2FpdCBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShbY3dkLCB0bXBEaXJdLCBbJ2N1cnJlbnR3b3JraW5nZGlyZWN0b3J5JywgJ3RlbXBkaXInXSk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaXNVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpKTtcblxuXHRcdGNvbnN0IHdzID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkudG9TdHJpbmcoKSkgYXMgSVN0b3JlZFdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzLmZvbGRlcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1swXSkucGF0aCwgY3dkKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1sxXSkucGF0aCwgdG1wRGlyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzBdKS5uYW1lLCAnY3VycmVudHdvcmtpbmdkaXJlY3RvcnknKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzFdKS5uYW1lLCAndGVtcGRpcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZSAoZm9sZGVycyBhcyBvdGhlciByZXNvdXJjZSBVUklzKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmb2xkZXIxVVJJID0gVVJJLnBhcnNlKCdteXNjaGVtZTovL3NlcnZlci93b3JrL3AvZjEnKTtcblx0XHRjb25zdCBmb2xkZXIyVVJJID0gVVJJLnBhcnNlKCdteXNjaGVtZTovL3NlcnZlci93b3JrL28vZjMnKTtcblxuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IHNlcnZpY2UuY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW3sgdXJpOiBmb2xkZXIxVVJJIH0sIHsgdXJpOiBmb2xkZXIyVVJJIH1dLCAnc2VydmVyJyk7XG5cdFx0YXNzZXJ0Lm9rKHdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0Lm9rKGZzLmV4aXN0c1N5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSk7XG5cdFx0YXNzZXJ0Lm9rKHNlcnZpY2UuaXNVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpKTtcblxuXHRcdGNvbnN0IHdzID0gKEpTT04ucGFyc2UoZnMucmVhZEZpbGVTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkudG9TdHJpbmcoKSkgYXMgSVN0b3JlZFdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzLmZvbGRlcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxJUmF3VXJpV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMF0pLnVyaSwgZm9sZGVyMVVSSS50b1N0cmluZyh0cnVlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SVJhd1VyaVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzFdKS51cmksIGZvbGRlcjJVUkkudG9TdHJpbmcodHJ1ZSkpO1xuXHRcdGFzc2VydC5vayghKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzBdKS5uYW1lKTtcblx0XHRhc3NlcnQub2soISg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1sxXSkubmFtZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzLnJlbW90ZUF1dGhvcml0eSwgJ3NlcnZlcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlV29ya3NwYWNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IGNyZWF0ZVVudGl0bGVkV29ya3NwYWNlKFtjd2QsIHRtcERpcl0pO1xuXHRcdGFzc2VydC5vayhhd2FpdCBzZXJ2aWNlLnJlc29sdmVMb2NhbFdvcmtzcGFjZSh3b3Jrc3BhY2UuY29uZmlnUGF0aCkpO1xuXG5cdFx0Ly8gbWFrZSBpdCBhIHZhbGlkIHdvcmtzcGFjZSBwYXRoXG5cdFx0Y29uc3QgbmV3UGF0aCA9IHBhdGguam9pbihwYXRoLmRpcm5hbWUod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSwgYHdvcmtzcGFjZS4ke1dPUktTUEFDRV9FWFRFTlNJT059YCk7XG5cdFx0ZnMucmVuYW1lU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgsIG5ld1BhdGgpO1xuXHRcdHdvcmtzcGFjZS5jb25maWdQYXRoID0gVVJJLmZpbGUobmV3UGF0aCk7XG5cblx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUxvY2FsV29ya3NwYWNlKHdvcmtzcGFjZS5jb25maWdQYXRoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMiwgcmVzb2x2ZWQhLmZvbGRlcnMubGVuZ3RoKTtcblx0XHRhc3NlcnRFcXVhbFVSSShyZXNvbHZlZCEuY29uZmlnUGF0aCwgd29ya3NwYWNlLmNvbmZpZ1BhdGgpO1xuXHRcdGFzc2VydC5vayhyZXNvbHZlZCEuaWQpO1xuXHRcdGZzLndyaXRlRmlsZVN5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoLCBKU09OLnN0cmluZ2lmeSh7IHNvbWV0aGluZzogJ3NvbWV0aGluZycgfSkpOyAvLyBpbnZhbGlkIHdvcmtzcGFjZVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRJbnZhbGlkID0gYXdhaXQgc2VydmljZS5yZXNvbHZlTG9jYWxXb3Jrc3BhY2Uod29ya3NwYWNlLmNvbmZpZ1BhdGgpO1xuXHRcdGFzc2VydC5vayghcmVzb2x2ZWRJbnZhbGlkKTtcblxuXHRcdGZzLndyaXRlRmlsZVN5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoLCBKU09OLnN0cmluZ2lmeSh7IHRyYW5zaWVudDogdHJ1ZSwgZm9sZGVyczogW10gfSkpOyAvLyB0cmFuc2llbnQgd29ya3NhcGNlXG5cdFx0Y29uc3QgcmVzb2x2ZWRUcmFuc2llbnQgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmVMb2NhbFdvcmtzcGFjZSh3b3Jrc3BhY2UuY29uZmlnUGF0aCk7XG5cdFx0YXNzZXJ0Lm9rKHJlc29sdmVkVHJhbnNpZW50Py50cmFuc2llbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlV29ya3NwYWNlIChzdXBwb3J0IHJlbGF0aXZlIHBhdGhzKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBhd2FpdCBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShbY3dkLCB0bXBEaXJdKTtcblx0XHRmcy53cml0ZUZpbGVTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCwgSlNPTi5zdHJpbmdpZnkoeyBmb2xkZXJzOiBbeyBwYXRoOiAnLi90aWNpbm8tcGxheWdyb3VuZC9saWInIH1dIH0pKTtcblxuXHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgc2VydmljZS5yZXNvbHZlTG9jYWxXb3Jrc3BhY2Uod29ya3NwYWNlLmNvbmZpZ1BhdGgpO1xuXHRcdGFzc2VydEVxdWFsVVJJKHJlc29sdmVkIS5mb2xkZXJzWzBdLnVyaSwgVVJJLmZpbGUocGF0aC5qb2luKHBhdGguZGlybmFtZSh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgpLCAndGljaW5vLXBsYXlncm91bmQnLCAnbGliJykpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVdvcmtzcGFjZSAoc3VwcG9ydCByZWxhdGl2ZSBwYXRocyAjMiknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2N3ZCwgdG1wRGlyXSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgsIEpTT04uc3RyaW5naWZ5KHsgZm9sZGVyczogW3sgcGF0aDogJy4vdGljaW5vLXBsYXlncm91bmQvbGliLy4uL290aGVyJyB9XSB9KSk7XG5cblx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUxvY2FsV29ya3NwYWNlKHdvcmtzcGFjZS5jb25maWdQYXRoKTtcblx0XHRhc3NlcnRFcXVhbFVSSShyZXNvbHZlZCEuZm9sZGVyc1swXS51cmksIFVSSS5maWxlKHBhdGguam9pbihwYXRoLmRpcm5hbWUod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSwgJ3RpY2luby1wbGF5Z3JvdW5kJywgJ290aGVyJykpKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZVdvcmtzcGFjZSAoc3VwcG9ydCByZWxhdGl2ZSBwYXRocyAjMyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2N3ZCwgdG1wRGlyXSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgsIEpTT04uc3RyaW5naWZ5KHsgZm9sZGVyczogW3sgcGF0aDogJ3RpY2luby1wbGF5Z3JvdW5kL2xpYicgfV0gfSkpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCBzZXJ2aWNlLnJlc29sdmVMb2NhbFdvcmtzcGFjZSh3b3Jrc3BhY2UuY29uZmlnUGF0aCk7XG5cdFx0YXNzZXJ0RXF1YWxVUkkocmVzb2x2ZWQhLmZvbGRlcnNbMF0udXJpLCBVUkkuZmlsZShwYXRoLmpvaW4ocGF0aC5kaXJuYW1lKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCksICd0aWNpbm8tcGxheWdyb3VuZCcsICdsaWInKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXNvbHZlV29ya3NwYWNlIChzdXBwb3J0IGludmFsaWQgSlNPTiB2aWEgZmF1bHQgdG9sZXJhbnQgcGFyc2luZyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2N3ZCwgdG1wRGlyXSk7XG5cdFx0ZnMud3JpdGVGaWxlU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgsICd7IFwiZm9sZGVyc1wiOiBbIHsgXCJwYXRoXCI6IFwiLi90aWNpbm8tcGxheWdyb3VuZC9saWJcIiB9ICwgXSB9Jyk7IC8vIHRyYWlsaW5nIGNvbW1hXG5cblx0XHRjb25zdCByZXNvbHZlZCA9IGF3YWl0IHNlcnZpY2UucmVzb2x2ZUxvY2FsV29ya3NwYWNlKHdvcmtzcGFjZS5jb25maWdQYXRoKTtcblx0XHRhc3NlcnRFcXVhbFVSSShyZXNvbHZlZCEuZm9sZGVyc1swXS51cmksIFVSSS5maWxlKHBhdGguam9pbihwYXRoLmRpcm5hbWUod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSwgJ3RpY2luby1wbGF5Z3JvdW5kJywgJ2xpYicpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jld3JpdGVXb3Jrc3BhY2VGaWxlRm9yTmV3TG9jYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZm9sZGVyMSA9IGN3ZDsgIC8vIGFic29sdXRlIHBhdGggYmVjYXVzZSBvdXRzaWRlIG9mIHRtcERpclxuXHRcdGNvbnN0IHRtcEluc2lkZURpciA9IHBhdGguam9pbih0bXBEaXIsICdpbnNpZGUnKTtcblxuXHRcdGNvbnN0IGZpcnN0Q29uZmlnUGF0aCA9IHBhdGguam9pbih0bXBEaXIsICdteXdvcmtzcGFjZTAuY29kZS13b3Jrc3BhY2UnKTtcblx0XHRjcmVhdGVXb3Jrc3BhY2UoZmlyc3RDb25maWdQYXRoLCBbZm9sZGVyMSwgJ2luc2lkZScsIHBhdGguam9pbignaW5zaWRlJywgJ3NvbWVmb2xkZXInKV0pO1xuXHRcdGNvbnN0IG9yaWdDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKGZpcnN0Q29uZmlnUGF0aCkudG9TdHJpbmcoKTtcblxuXHRcdGxldCBvcmlnQ29uZmlnUGF0aCA9IFVSSS5maWxlKGZpcnN0Q29uZmlnUGF0aCk7XG5cdFx0bGV0IHdvcmtzcGFjZUNvbmZpZ1BhdGggPSBVUkkuZmlsZShwYXRoLmpvaW4odG1wRGlyLCAnaW5zaWRlJywgJ215d29ya3NwYWNlMS5jb2RlLXdvcmtzcGFjZScpKTtcblx0XHRsZXQgbmV3Q29udGVudCA9IHJld3JpdGVXb3Jrc3BhY2VGaWxlRm9yTmV3TG9jYXRpb24ob3JpZ0NvbnRlbnQsIG9yaWdDb25maWdQYXRoLCBmYWxzZSwgd29ya3NwYWNlQ29uZmlnUGF0aCwgZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UpO1xuXHRcdGxldCB3cyA9IChKU09OLnBhcnNlKG5ld0NvbnRlbnQpIGFzIElTdG9yZWRXb3Jrc3BhY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cy5mb2xkZXJzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0UGF0aEVxdWFscygoPElSYXdGaWxlV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMF0pLnBhdGgsIGZvbGRlcjEpOyAvLyBhYnNvbHV0ZSBwYXRoIGJlY2F1c2Ugb3V0c2lkZSBvZiB0bXBkaXJcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1sxXSkucGF0aCwgJy4nKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1syXSkucGF0aCwgJ3NvbWVmb2xkZXInKTtcblxuXHRcdG9yaWdDb25maWdQYXRoID0gd29ya3NwYWNlQ29uZmlnUGF0aDtcblx0XHR3b3Jrc3BhY2VDb25maWdQYXRoID0gVVJJLmZpbGUocGF0aC5qb2luKHRtcERpciwgJ215d29ya3NwYWNlMi5jb2RlLXdvcmtzcGFjZScpKTtcblx0XHRuZXdDb250ZW50ID0gcmV3cml0ZVdvcmtzcGFjZUZpbGVGb3JOZXdMb2NhdGlvbihuZXdDb250ZW50LCBvcmlnQ29uZmlnUGF0aCwgZmFsc2UsIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHR3cyA9IChKU09OLnBhcnNlKG5ld0NvbnRlbnQpIGFzIElTdG9yZWRXb3Jrc3BhY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cy5mb2xkZXJzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0UGF0aEVxdWFscygoPElSYXdGaWxlV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMF0pLnBhdGgsIGZvbGRlcjEpO1xuXHRcdGFzc2VydFBhdGhFcXVhbHMoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzFdKS5wYXRoLCAnaW5zaWRlJyk7XG5cdFx0YXNzZXJ0UGF0aEVxdWFscygoPElSYXdGaWxlV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMl0pLnBhdGgsICdpbnNpZGUvc29tZWZvbGRlcicpO1xuXG5cdFx0b3JpZ0NvbmZpZ1BhdGggPSB3b3Jrc3BhY2VDb25maWdQYXRoO1xuXHRcdHdvcmtzcGFjZUNvbmZpZ1BhdGggPSBVUkkuZmlsZShwYXRoLmpvaW4odG1wRGlyLCAnb3RoZXInLCAnbXl3b3Jrc3BhY2UyLmNvZGUtd29ya3NwYWNlJykpO1xuXHRcdG5ld0NvbnRlbnQgPSByZXdyaXRlV29ya3NwYWNlRmlsZUZvck5ld0xvY2F0aW9uKG5ld0NvbnRlbnQsIG9yaWdDb25maWdQYXRoLCBmYWxzZSwgd29ya3NwYWNlQ29uZmlnUGF0aCwgZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UpO1xuXHRcdHdzID0gKEpTT04ucGFyc2UobmV3Q29udGVudCkgYXMgSVN0b3JlZFdvcmtzcGFjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHdzLmZvbGRlcnMubGVuZ3RoLCAzKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1swXSkucGF0aCwgZm9sZGVyMSk7XG5cdFx0YXNzZXJ0UGF0aEVxdWFscygoPElSYXdGaWxlV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMV0pLnBhdGgsICcuLi9pbnNpZGUnKTtcblx0XHRhc3NlcnRQYXRoRXF1YWxzKCg8SVJhd0ZpbGVXb3Jrc3BhY2VGb2xkZXI+d3MuZm9sZGVyc1syXSkucGF0aCwgJy4uL2luc2lkZS9zb21lZm9sZGVyJyk7XG5cblx0XHRvcmlnQ29uZmlnUGF0aCA9IHdvcmtzcGFjZUNvbmZpZ1BhdGg7XG5cdFx0d29ya3NwYWNlQ29uZmlnUGF0aCA9IFVSSS5wYXJzZSgnZm9vOi8vZm9vL2Jhci9teXdvcmtzcGFjZTIuY29kZS13b3Jrc3BhY2UnKTtcblx0XHRuZXdDb250ZW50ID0gcmV3cml0ZVdvcmtzcGFjZUZpbGVGb3JOZXdMb2NhdGlvbihuZXdDb250ZW50LCBvcmlnQ29uZmlnUGF0aCwgZmFsc2UsIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHR3cyA9IChKU09OLnBhcnNlKG5ld0NvbnRlbnQpIGFzIElTdG9yZWRXb3Jrc3BhY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3cy5mb2xkZXJzLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SVJhd1VyaVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzBdKS51cmksIFVSSS5maWxlKGZvbGRlcjEpLnRvU3RyaW5nKHRydWUpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxJUmF3VXJpV29ya3NwYWNlRm9sZGVyPndzLmZvbGRlcnNbMV0pLnVyaSwgVVJJLmZpbGUodG1wSW5zaWRlRGlyKS50b1N0cmluZyh0cnVlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SVJhd1VyaVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzJdKS51cmksIFVSSS5maWxlKHBhdGguam9pbih0bXBJbnNpZGVEaXIsICdzb21lZm9sZGVyJykpLnRvU3RyaW5nKHRydWUpKTtcblxuXHRcdGZzLnVubGlua1N5bmMoZmlyc3RDb25maWdQYXRoKTtcblx0fSk7XG5cblx0dGVzdCgncmV3cml0ZVdvcmtzcGFjZUZpbGVGb3JOZXdMb2NhdGlvbiAocHJlc2VydmVzIGNvbW1lbnRzKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBhd2FpdCBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShbY3dkLCB0bXBEaXIsIHBhdGguam9pbih0bXBEaXIsICdzb21lZm9sZGVyJyldKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VDb25maWdQYXRoID0gVVJJLmZpbGUocGF0aC5qb2luKHRtcERpciwgYG15d29ya3NwYWNlLiR7RGF0ZS5ub3coKX0uJHtXT1JLU1BBQ0VfRVhURU5TSU9OfWApKTtcblxuXHRcdGxldCBvcmlnQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgpLnRvU3RyaW5nKCk7XG5cdFx0b3JpZ0NvbnRlbnQgPSBgLy8gdGhpcyBpcyBhIGNvbW1lbnRcXG4ke29yaWdDb250ZW50fWA7XG5cblx0XHRjb25zdCBuZXdDb250ZW50ID0gcmV3cml0ZVdvcmtzcGFjZUZpbGVGb3JOZXdMb2NhdGlvbihvcmlnQ29udGVudCwgd29ya3NwYWNlLmNvbmZpZ1BhdGgsIGZhbHNlLCB3b3Jrc3BhY2VDb25maWdQYXRoLCBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDAsIG5ld0NvbnRlbnQuaW5kZXhPZignLy8gdGhpcyBpcyBhIGNvbW1lbnQnKSk7XG5cdFx0YXdhaXQgc2VydmljZS5kZWxldGVVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXdyaXRlV29ya3NwYWNlRmlsZUZvck5ld0xvY2F0aW9uIChwcmVzZXJ2ZXMgZm9yd2FyZCBzbGFzaGVzKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB3b3Jrc3BhY2UgPSBhd2FpdCBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShbY3dkLCB0bXBEaXIsIHBhdGguam9pbih0bXBEaXIsICdzb21lZm9sZGVyJyldKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VDb25maWdQYXRoID0gVVJJLmZpbGUocGF0aC5qb2luKHRtcERpciwgYG15d29ya3NwYWNlLiR7RGF0ZS5ub3coKX0uJHtXT1JLU1BBQ0VfRVhURU5TSU9OfWApKTtcblxuXHRcdGxldCBvcmlnQ29udGVudCA9IGZzLnJlYWRGaWxlU3luYyh3b3Jrc3BhY2UuY29uZmlnUGF0aC5mc1BhdGgpLnRvU3RyaW5nKCk7XG5cdFx0b3JpZ0NvbnRlbnQgPSBvcmlnQ29udGVudC5yZXBsYWNlKC9bXFxcXF0vZywgJy8nKTsgLy8gY29udmVydCBiYWNrc2xhc2ggdG8gc2xhc2hcblxuXHRcdGNvbnN0IG5ld0NvbnRlbnQgPSByZXdyaXRlV29ya3NwYWNlRmlsZUZvck5ld0xvY2F0aW9uKG9yaWdDb250ZW50LCB3b3Jrc3BhY2UuY29uZmlnUGF0aCwgZmFsc2UsIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHRjb25zdCB3cyA9IChKU09OLnBhcnNlKG5ld0NvbnRlbnQpIGFzIElTdG9yZWRXb3Jrc3BhY2UpO1xuXHRcdGFzc2VydC5vayh3cy5mb2xkZXJzLmV2ZXJ5KGYgPT4gKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj5mKS5wYXRoLmluZGV4T2YoJ1xcXFwnKSA8IDApKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmRlbGV0ZVVudGl0bGVkV29ya3NwYWNlKHdvcmtzcGFjZSk7XG5cdH0pO1xuXG5cdCghaXNXaW5kb3dzID8gdGVzdC5za2lwIDogdGVzdCkoJ3Jld3JpdGVXb3Jrc3BhY2VGaWxlRm9yTmV3TG9jYXRpb24gKHVuYyBwYXRocyknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlTG9jYXRpb24gPSBwYXRoLmpvaW4odG1wRGlyLCAnd3Nsb2MnKTtcblx0XHRjb25zdCBmb2xkZXIxTG9jYXRpb24gPSAneDpcXFxcZm9vJztcblx0XHRjb25zdCBmb2xkZXIyTG9jYXRpb24gPSAnXFxcXFxcXFxzZXJ2ZXJcXFxcc2hhcmUyXFxcXHNvbWVcXFxccGF0aCc7XG5cdFx0Y29uc3QgZm9sZGVyM0xvY2F0aW9uID0gcGF0aC5qb2luKHdvcmtzcGFjZUxvY2F0aW9uLCAnaW5uZXInLCAnbW9yZScpO1xuXG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2ZvbGRlcjFMb2NhdGlvbiwgZm9sZGVyMkxvY2F0aW9uLCBmb2xkZXIzTG9jYXRpb25dKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VDb25maWdQYXRoID0gVVJJLmZpbGUocGF0aC5qb2luKHdvcmtzcGFjZUxvY2F0aW9uLCBgbXl3b3Jrc3BhY2UuJHtEYXRlLm5vdygpfS4ke1dPUktTUEFDRV9FWFRFTlNJT059YCkpO1xuXHRcdGNvbnN0IG9yaWdDb250ZW50ID0gZnMucmVhZEZpbGVTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkudG9TdHJpbmcoKTtcblx0XHRjb25zdCBuZXdDb250ZW50ID0gcmV3cml0ZVdvcmtzcGFjZUZpbGVGb3JOZXdMb2NhdGlvbihvcmlnQ29udGVudCwgd29ya3NwYWNlLmNvbmZpZ1BhdGgsIHRydWUsIHdvcmtzcGFjZUNvbmZpZ1BhdGgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHRjb25zdCB3cyA9IChKU09OLnBhcnNlKG5ld0NvbnRlbnQpIGFzIElTdG9yZWRXb3Jrc3BhY2UpO1xuXHRcdGFzc2VydFBhdGhFcXVhbHMoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzBdKS5wYXRoLCBmb2xkZXIxTG9jYXRpb24pO1xuXHRcdGFzc2VydFBhdGhFcXVhbHMoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzFdKS5wYXRoLCBmb2xkZXIyTG9jYXRpb24pO1xuXHRcdGFzc2VydFBhdGhFcXVhbHMoKDxJUmF3RmlsZVdvcmtzcGFjZUZvbGRlcj53cy5mb2xkZXJzWzJdKS5wYXRoLCAnaW5uZXIvbW9yZScpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5kZWxldGVVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGVVbnRpdGxlZFdvcmtzcGFjZSAodW50aXRsZWQpJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IGF3YWl0IGNyZWF0ZVVudGl0bGVkV29ya3NwYWNlKFtjd2QsIHRtcERpcl0pO1xuXHRcdGFzc2VydC5vayhmcy5leGlzdHNTeW5jKHdvcmtzcGFjZS5jb25maWdQYXRoLmZzUGF0aCkpO1xuXHRcdGF3YWl0IHNlcnZpY2UuZGVsZXRlVW50aXRsZWRXb3Jrc3BhY2Uod29ya3NwYWNlKTtcblx0XHRhc3NlcnQub2soIWZzLmV4aXN0c1N5bmMod29ya3NwYWNlLmNvbmZpZ1BhdGguZnNQYXRoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZVVudGl0bGVkV29ya3NwYWNlIChzYXZlZCknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gYXdhaXQgY3JlYXRlVW50aXRsZWRXb3Jrc3BhY2UoW2N3ZCwgdG1wRGlyXSk7XG5cdFx0YXdhaXQgc2VydmljZS5kZWxldGVVbnRpdGxlZFdvcmtzcGFjZSh3b3Jrc3BhY2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRVbnRpdGxlZFdvcmtzcGFjZScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRhd2FpdCBzZXJ2aWNlLmluaXRpYWxpemUoKTtcblx0XHRsZXQgdW50aXRsZWQgPSBzZXJ2aWNlLmdldFVudGl0bGVkV29ya3NwYWNlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZC5sZW5ndGgsIDApO1xuXG5cdFx0Y29uc3QgdW50aXRsZWRPbmUgPSBhd2FpdCBjcmVhdGVVbnRpdGxlZFdvcmtzcGFjZShbY3dkLCB0bXBEaXJdKTtcblx0XHRhc3NlcnQub2soZnMuZXhpc3RzU3luYyh1bnRpdGxlZE9uZS5jb25maWdQYXRoLmZzUGF0aCkpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5pbml0aWFsaXplKCk7XG5cdFx0dW50aXRsZWQgPSBzZXJ2aWNlLmdldFVudGl0bGVkV29ya3NwYWNlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxLCB1bnRpdGxlZC5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bnRpdGxlZE9uZS5pZCwgdW50aXRsZWRbMF0ud29ya3NwYWNlLmlkKTtcblxuXHRcdGF3YWl0IHNlcnZpY2UuZGVsZXRlVW50aXRsZWRXb3Jrc3BhY2UodW50aXRsZWRPbmUpO1xuXHRcdGF3YWl0IHNlcnZpY2UuaW5pdGlhbGl6ZSgpO1xuXHRcdHVudGl0bGVkID0gc2VydmljZS5nZXRVbnRpdGxlZFdvcmtzcGFjZXMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMCwgdW50aXRsZWQubGVuZ3RoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFFBQVE7QUFDcEIsWUFBWSxRQUFRO0FBQ3BCLFNBQVMsT0FBTyxpQkFBaUI7QUFDakMsU0FBUyw0QkFBNEI7QUFDckMsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsV0FBVztBQUNwQixZQUFZLFNBQVM7QUFDckIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxZQUFZLHlCQUF5QjtBQU05QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLFNBQVMsaUJBQWlCO0FBQ25DLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsc0JBQXNCO0FBQy9CLE9BQU8sYUFBYTtBQUVwQixTQUFTLGNBQWMsb0JBQW9CO0FBQzNDLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsbUNBQW1DO0FBQzVDLFNBQTBELDJCQUEyQjtBQUNyRixTQUFpRiwwQ0FBMEM7QUFDM0gsU0FBUyx1Q0FBdUM7QUFFaEQsV0FBVyxtQ0FBbUMsTUFBTTtBQUFBLEVBRW5ELE1BQU0sc0JBQW9EO0FBQUEsSUFJekQsZUFBZSxTQUFtQyxRQUE0RTtBQUFFLFlBQU0sSUFBSSxNQUFNLHlCQUF5QjtBQUFBLElBQUc7QUFBQSxJQUM1SyxXQUFXLFNBQW1DLFFBQTRFO0FBQUUsWUFBTSxJQUFJLE1BQU0seUJBQXlCO0FBQUEsSUFBRztBQUFBLElBQ3hLLFNBQVMsU0FBbUMsUUFB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
