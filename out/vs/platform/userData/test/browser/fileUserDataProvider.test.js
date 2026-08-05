import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Schemas } from "../../../../base/common/network.js";
import { dirname, isEqual, joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { AbstractNativeEnvironmentService } from "../../../environment/common/environmentService.js";
import { FileService } from "../../../files/common/fileService.js";
import { FileChangeType, FileSystemProviderCapabilities } from "../../../files/common/files.js";
import { InMemoryFileSystemProvider } from "../../../files/common/inMemoryFilesystemProvider.js";
import { NullLogService } from "../../../log/common/log.js";
import product from "../../../product/common/product.js";
import { UriIdentityService } from "../../../uriIdentity/common/uriIdentityService.js";
import { FileUserDataProvider } from "../../common/fileUserDataProvider.js";
import { UserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
const ROOT = URI.file("tests").with({ scheme: "vscode-tests" });
class TestEnvironmentService extends AbstractNativeEnvironmentService {
  constructor(_appSettingsHome) {
    super(/* @__PURE__ */ Object.create(null), /* @__PURE__ */ Object.create(null), { _serviceBrand: void 0, ...product });
    this._appSettingsHome = _appSettingsHome;
  }
  get userRoamingDataHome() {
    return this._appSettingsHome.with({ scheme: Schemas.vscodeUserData });
  }
  get cacheHome() {
    return this.userRoamingDataHome;
  }
}
suite("FileUserDataProvider", () => {
  let testObject;
  let userDataHomeOnDisk;
  let backupWorkspaceHomeOnDisk;
  let environmentService;
  let userDataProfilesService;
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  let fileUserDataProvider;
  setup(async () => {
    const logService = new NullLogService();
    testObject = disposables.add(new FileService(logService));
    const fileSystemProvider = disposables.add(new InMemoryFileSystemProvider());
    disposables.add(testObject.registerProvider(ROOT.scheme, fileSystemProvider));
    userDataHomeOnDisk = joinPath(ROOT, "User");
    const backupHome = joinPath(ROOT, "Backups");
    backupWorkspaceHomeOnDisk = joinPath(backupHome, "workspaceId");
    await testObject.createFolder(userDataHomeOnDisk);
    await testObject.createFolder(backupWorkspaceHomeOnDisk);
    environmentService = new TestEnvironmentService(userDataHomeOnDisk);
    const uriIdentityService = disposables.add(new UriIdentityService(testObject));
    userDataProfilesService = disposables.add(new UserDataProfilesService(environmentService, testObject, uriIdentityService, logService));
    fileUserDataProvider = disposables.add(new FileUserDataProvider(ROOT.scheme, fileSystemProvider, Schemas.vscodeUserData, userDataProfilesService, uriIdentityService, logService));
    disposables.add(fileUserDataProvider);
    disposables.add(testObject.registerProvider(Schemas.vscodeUserData, fileUserDataProvider));
  });
  test("exists return false when file does not exist", async () => {
    const exists = await testObject.exists(userDataProfilesService.defaultProfile.settingsResource);
    assert.strictEqual(exists, false);
  });
  test("read file throws error if not exist", async () => {
    try {
      await testObject.readFile(userDataProfilesService.defaultProfile.settingsResource);
      assert.fail("Should fail since file does not exist");
    } catch (e) {
    }
  });
  test("read existing file", async () => {
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "settings.json"), VSBuffer.fromString("{}"));
    const result = await testObject.readFile(userDataProfilesService.defaultProfile.settingsResource);
    assert.strictEqual(result.value.toString(), "{}");
  });
  test("create file", async () => {
    const resource = userDataProfilesService.defaultProfile.settingsResource;
    const actual1 = await testObject.createFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual2 = await testObject.readFile(joinPath(userDataHomeOnDisk, "settings.json"));
    assert.strictEqual(actual2.value.toString(), "{}");
  });
  test("write file creates the file if not exist", async () => {
    const resource = userDataProfilesService.defaultProfile.settingsResource;
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual2 = await testObject.readFile(joinPath(userDataHomeOnDisk, "settings.json"));
    assert.strictEqual(actual2.value.toString(), "{}");
  });
  test("write to existing file", async () => {
    const resource = userDataProfilesService.defaultProfile.settingsResource;
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "settings.json"), VSBuffer.fromString("{}"));
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{a:1}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual2 = await testObject.readFile(joinPath(userDataHomeOnDisk, "settings.json"));
    assert.strictEqual(actual2.value.toString(), "{a:1}");
  });
  test("delete file", async () => {
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "settings.json"), VSBuffer.fromString(""));
    await testObject.del(userDataProfilesService.defaultProfile.settingsResource);
    const result = await testObject.exists(joinPath(userDataHomeOnDisk, "settings.json"));
    assert.strictEqual(false, result);
  });
  test("resolve file", async () => {
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "settings.json"), VSBuffer.fromString(""));
    const result = await testObject.resolve(userDataProfilesService.defaultProfile.settingsResource);
    assert.ok(!result.isDirectory);
    assert.ok(result.children === void 0);
  });
  test("exists return false for folder that does not exist", async () => {
    const exists = await testObject.exists(userDataProfilesService.defaultProfile.snippetsHome);
    assert.strictEqual(exists, false);
  });
  test("exists return true for folder that exists", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    const exists = await testObject.exists(userDataProfilesService.defaultProfile.snippetsHome);
    assert.strictEqual(exists, true);
  });
  test("read file throws error for folder", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    try {
      await testObject.readFile(userDataProfilesService.defaultProfile.snippetsHome);
      assert.fail("Should fail since read file is not supported for folders");
    } catch (e) {
    }
  });
  test("read file under folder", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"), VSBuffer.fromString("{}"));
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual = await testObject.readFile(resource);
    assert.strictEqual(actual.resource.toString(), resource.toString());
    assert.strictEqual(actual.value.toString(), "{}");
  });
  test("read file under sub folder", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets", "java"));
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "snippets", "java", "settings.json"), VSBuffer.fromString("{}"));
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "java/settings.json");
    const actual = await testObject.readFile(resource);
    assert.strictEqual(actual.resource.toString(), resource.toString());
    assert.strictEqual(actual.value.toString(), "{}");
  });
  test("create file under folder that exists", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual1 = await testObject.createFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual2 = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(actual2.value.toString(), "{}");
  });
  test("create file under folder that does not exist", async () => {
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual1 = await testObject.createFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual2 = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(actual2.value.toString(), "{}");
  });
  test("write to not existing file under container that exists", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(actual.value.toString(), "{}");
  });
  test("write to not existing file under container that does not exists", async () => {
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(actual.value.toString(), "{}");
  });
  test("write to existing file under container", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"), VSBuffer.fromString("{}"));
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json");
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{a:1}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(actual.value.toString(), "{a:1}");
  });
  test("write file under sub container", async () => {
    const resource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, "java/settings.json");
    const actual1 = await testObject.writeFile(resource, VSBuffer.fromString("{}"));
    assert.strictEqual(actual1.resource.toString(), resource.toString());
    const actual = await testObject.readFile(joinPath(userDataHomeOnDisk, "snippets", "java", "settings.json"));
    assert.strictEqual(actual.value.toString(), "{}");
  });
  test("delete throws error for folder that does not exist", async () => {
    try {
      await testObject.del(userDataProfilesService.defaultProfile.snippetsHome);
      assert.fail("Should fail the folder does not exist");
    } catch (e) {
    }
  });
  test("delete not existing file under container that exists", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    try {
      await testObject.del(joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json"));
      assert.fail("Should fail since file does not exist");
    } catch (e) {
    }
  });
  test("delete not existing file under container that does not exists", async () => {
    try {
      await testObject.del(joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json"));
      assert.fail("Should fail since file does not exist");
    } catch (e) {
    }
  });
  test("delete existing file under folder", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"), VSBuffer.fromString("{}"));
    await testObject.del(joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json"));
    const exists = await testObject.exists(joinPath(userDataHomeOnDisk, "snippets", "settings.json"));
    assert.strictEqual(exists, false);
  });
  test("resolve folder", async () => {
    await testObject.createFolder(joinPath(userDataHomeOnDisk, "snippets"));
    await testObject.writeFile(joinPath(userDataHomeOnDisk, "snippets", "settings.json"), VSBuffer.fromString("{}"));
    const result = await testObject.resolve(userDataProfilesService.defaultProfile.snippetsHome);
    assert.ok(result.isDirectory);
    assert.ok(result.children !== void 0);
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.children[0].resource.toString(), joinPath(userDataProfilesService.defaultProfile.snippetsHome, "settings.json").toString());
  });
  test("read backup file", async () => {
    await testObject.writeFile(joinPath(backupWorkspaceHomeOnDisk, "backup.json"), VSBuffer.fromString("{}"));
    const result = await testObject.readFile(joinPath(backupWorkspaceHomeOnDisk.with({ scheme: environmentService.userRoamingDataHome.scheme }), `backup.json`));
    assert.strictEqual(result.value.toString(), "{}");
  });
  test("create backup file", async () => {
    await testObject.createFile(joinPath(backupWorkspaceHomeOnDisk.with({ scheme: environmentService.userRoamingDataHome.scheme }), `backup.json`), VSBuffer.fromString("{}"));
    const result = await testObject.readFile(joinPath(backupWorkspaceHomeOnDisk, "backup.json"));
    assert.strictEqual(result.value.toString(), "{}");
  });
  test("write backup file", async () => {
    await testObject.writeFile(joinPath(backupWorkspaceHomeOnDisk, "backup.json"), VSBuffer.fromString("{}"));
    await testObject.writeFile(joinPath(backupWorkspaceHomeOnDisk.with({ scheme: environmentService.userRoamingDataHome.scheme }), `backup.json`), VSBuffer.fromString("{a:1}"));
    const result = await testObject.readFile(joinPath(backupWorkspaceHomeOnDisk, "backup.json"));
    assert.strictEqual(result.value.toString(), "{a:1}");
  });
  test("resolve backups folder", async () => {
    await testObject.writeFile(joinPath(backupWorkspaceHomeOnDisk, "backup.json"), VSBuffer.fromString("{}"));
    const result = await testObject.resolve(backupWorkspaceHomeOnDisk.with({ scheme: environmentService.userRoamingDataHome.scheme }));
    assert.ok(result.isDirectory);
    assert.ok(result.children !== void 0);
    assert.strictEqual(result.children.length, 1);
    assert.strictEqual(result.children[0].resource.toString(), joinPath(backupWorkspaceHomeOnDisk.with({ scheme: environmentService.userRoamingDataHome.scheme }), `backup.json`).toString());
  });
});
class TestFileSystemProvider {
  constructor(onDidChangeFile) {
    this.onDidChangeFile = onDidChangeFile;
    this.capabilities = FileSystemProviderCapabilities.FileReadWrite;
    this.onDidChangeCapabilities = Event.None;
  }
  watch() {
    return Disposable.None;
  }
  stat() {
    throw new Error("Not Supported");
  }
  mkdir(resource) {
    throw new Error("Not Supported");
  }
  rename() {
    throw new Error("Not Supported");
  }
  readFile(resource) {
    throw new Error("Not Supported");
  }
  readdir(resource) {
    throw new Error("Not Supported");
  }
  writeFile() {
    throw new Error("Not Supported");
  }
  delete() {
    throw new Error("Not Supported");
  }
  open(resource, opts) {
    throw new Error("Not Supported");
  }
  close(fd) {
    throw new Error("Not Supported");
  }
  read(fd, pos, data, offset, length) {
    throw new Error("Not Supported");
  }
  write(fd, pos, data, offset, length) {
    throw new Error("Not Supported");
  }
  readFileStream(resource, opts, token) {
    throw new Error("Method not implemented.");
  }
}
suite("FileUserDataProvider - Watching", () => {
  let testObject;
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  const rootFileResource = joinPath(ROOT, "User");
  const rootUserDataResource = rootFileResource.with({ scheme: Schemas.vscodeUserData });
  let fileEventEmitter;
  setup(() => {
    const logService = new NullLogService();
    const fileService = disposables.add(new FileService(logService));
    const environmentService = new TestEnvironmentService(rootFileResource);
    const uriIdentityService = disposables.add(new UriIdentityService(fileService));
    const userDataProfilesService = disposables.add(new UserDataProfilesService(environmentService, fileService, uriIdentityService, logService));
    fileEventEmitter = disposables.add(new Emitter());
    testObject = disposables.add(new FileUserDataProvider(rootFileResource.scheme, new TestFileSystemProvider(fileEventEmitter.event), Schemas.vscodeUserData, userDataProfilesService, uriIdentityService, new NullLogService()));
  });
  test("file added change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "settings.json");
    const target = joinPath(rootFileResource, "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.ADDED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.ADDED
    }]);
  });
  test("file updated change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "settings.json");
    const target = joinPath(rootFileResource, "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.UPDATED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.UPDATED
    }]);
  });
  test("file deleted change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "settings.json");
    const target = joinPath(rootFileResource, "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.DELETED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.DELETED
    }]);
  });
  test("file under folder created change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "snippets", "settings.json");
    const target = joinPath(rootFileResource, "snippets", "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.ADDED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.ADDED
    }]);
  });
  test("file under folder updated change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "snippets", "settings.json");
    const target = joinPath(rootFileResource, "snippets", "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.UPDATED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.UPDATED
    }]);
  });
  test("file under folder deleted change event", (done) => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const expected = joinPath(rootUserDataResource, "snippets", "settings.json");
    const target = joinPath(rootFileResource, "snippets", "settings.json");
    disposables.add(testObject.onDidChangeFile((e) => {
      if (isEqual(e[0].resource, expected) && e[0].type === FileChangeType.DELETED) {
        done();
      }
    }));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.DELETED
    }]);
  });
  test("event is not triggered if not watched", async () => {
    const target = joinPath(rootFileResource, "settings.json");
    let triggered = false;
    disposables.add(testObject.onDidChangeFile(() => triggered = true));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.DELETED
    }]);
    if (triggered) {
      assert.fail("event should not be triggered");
    }
  });
  test("event is not triggered if not watched 2", async () => {
    disposables.add(testObject.watch(rootUserDataResource, { excludes: [], recursive: false }));
    const target = joinPath(dirname(rootFileResource), "settings.json");
    let triggered = false;
    disposables.add(testObject.onDidChangeFile(() => triggered = true));
    fileEventEmitter.fire([{
      resource: target,
      type: FileChangeType.DELETED
    }]);
    if (triggered) {
      assert.fail("event should not be triggered");
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YS90ZXN0L2Jyb3dzZXIvZmlsZVVzZXJEYXRhUHJvdmlkZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgZGlybmFtZSwgaXNFcXVhbCwgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgUmVhZGFibGVTdHJlYW1FdmVudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJlYW0uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdE5hdGl2ZUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgRmlsZUNoYW5nZVR5cGUsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcywgRmlsZVR5cGUsIElGaWxlQ2hhbmdlLCBJRmlsZU9wZW5PcHRpb25zLCBJRmlsZVJlYWRTdHJlYW1PcHRpb25zLCBJRmlsZVNlcnZpY2UsIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRTdHJlYW1DYXBhYmlsaXR5LCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVSZWFkV3JpdGVDYXBhYmlsaXR5LCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aE9wZW5SZWFkV3JpdGVDbG9zZUNhcGFiaWxpdHksIElTdGF0IH0gZnJvbSAnLi4vLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IEluTWVtb3J5RmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vZmlsZXMvY29tbW9uL2luTWVtb3J5RmlsZXN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZpbGVVc2VyRGF0YVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL2ZpbGVVc2VyRGF0YVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSwgVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5cbmNvbnN0IFJPT1QgPSBVUkkuZmlsZSgndGVzdHMnKS53aXRoKHsgc2NoZW1lOiAndnNjb2RlLXRlc3RzJyB9KTtcblxuY2xhc3MgVGVzdEVudmlyb25tZW50U2VydmljZSBleHRlbmRzIEFic3RyYWN0TmF0aXZlRW52aXJvbm1lbnRTZXJ2aWNlIHtcblx0Y29uc3RydWN0b3IocHJpdmF0ZSByZWFkb25seSBfYXBwU2V0dGluZ3NIb21lOiBVUkkpIHtcblx0XHRzdXBlcihPYmplY3QuY3JlYXRlKG51bGwpLCBPYmplY3QuY3JlYXRlKG51bGwpLCB7IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZCwgLi4ucHJvZHVjdCB9KTtcblx0fVxuXHRvdmVycmlkZSBnZXQgdXNlclJvYW1pbmdEYXRhSG9tZSgpIHsgcmV0dXJuIHRoaXMuX2FwcFNldHRpbmdzSG9tZS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pOyB9XG5cdG92ZXJyaWRlIGdldCBjYWNoZUhvbWUoKSB7IHJldHVybiB0aGlzLnVzZXJSb2FtaW5nRGF0YUhvbWU7IH1cbn1cblxuc3VpdGUoJ0ZpbGVVc2VyRGF0YVByb3ZpZGVyJywgKCkgPT4ge1xuXG5cdGxldCB0ZXN0T2JqZWN0OiBJRmlsZVNlcnZpY2U7XG5cdGxldCB1c2VyRGF0YUhvbWVPbkRpc2s6IFVSSTtcblx0bGV0IGJhY2t1cFdvcmtzcGFjZUhvbWVPbkRpc2s6IFVSSTtcblx0bGV0IGVudmlyb25tZW50U2VydmljZTogSUVudmlyb25tZW50U2VydmljZTtcblx0bGV0IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlOiBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2U7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdGxldCBmaWxlVXNlckRhdGFQcm92aWRlcjogRmlsZVVzZXJEYXRhUHJvdmlkZXI7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBuZXcgTnVsbExvZ1NlcnZpY2UoKTtcblx0XHR0ZXN0T2JqZWN0ID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShsb2dTZXJ2aWNlKSk7XG5cdFx0Y29uc3QgZmlsZVN5c3RlbVByb3ZpZGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBJbk1lbW9yeUZpbGVTeXN0ZW1Qcm92aWRlcigpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC5yZWdpc3RlclByb3ZpZGVyKFJPT1Quc2NoZW1lLCBmaWxlU3lzdGVtUHJvdmlkZXIpKTtcblxuXHRcdHVzZXJEYXRhSG9tZU9uRGlzayA9IGpvaW5QYXRoKFJPT1QsICdVc2VyJyk7XG5cdFx0Y29uc3QgYmFja3VwSG9tZSA9IGpvaW5QYXRoKFJPT1QsICdCYWNrdXBzJyk7XG5cdFx0YmFja3VwV29ya3NwYWNlSG9tZU9uRGlzayA9IGpvaW5QYXRoKGJhY2t1cEhvbWUsICd3b3Jrc3BhY2VJZCcpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKHVzZXJEYXRhSG9tZU9uRGlzayk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5jcmVhdGVGb2xkZXIoYmFja3VwV29ya3NwYWNlSG9tZU9uRGlzayk7XG5cblx0XHRlbnZpcm9ubWVudFNlcnZpY2UgPSBuZXcgVGVzdEVudmlyb25tZW50U2VydmljZSh1c2VyRGF0YUhvbWVPbkRpc2spO1xuXHRcdGNvbnN0IHVyaUlkZW50aXR5U2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVXJpSWRlbnRpdHlTZXJ2aWNlKHRlc3RPYmplY3QpKTtcblx0XHR1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVXNlckRhdGFQcm9maWxlc1NlcnZpY2UoZW52aXJvbm1lbnRTZXJ2aWNlLCB0ZXN0T2JqZWN0LCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblxuXHRcdGZpbGVVc2VyRGF0YVByb3ZpZGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlVXNlckRhdGFQcm92aWRlcihST09ULnNjaGVtZSwgZmlsZVN5c3RlbVByb3ZpZGVyLCBTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBsb2dTZXJ2aWNlKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGZpbGVVc2VyRGF0YVByb3ZpZGVyKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC5yZWdpc3RlclByb3ZpZGVyKFNjaGVtYXMudnNjb2RlVXNlckRhdGEsIGZpbGVVc2VyRGF0YVByb3ZpZGVyKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4aXN0cyByZXR1cm4gZmFsc2Ugd2hlbiBmaWxlIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRlc3RPYmplY3QuZXhpc3RzKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleGlzdHMsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgncmVhZCBmaWxlIHRocm93cyBlcnJvciBpZiBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QucmVhZEZpbGUodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZSk7XG5cdFx0XHRhc3NlcnQuZmFpbCgnU2hvdWxkIGZhaWwgc2luY2UgZmlsZSBkb2VzIG5vdCBleGlzdCcpO1xuXHRcdH0gY2F0Y2ggKGUpIHsgfVxuXHR9KTtcblxuXHR0ZXN0KCdyZWFkIGV4aXN0aW5nIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc2V0dGluZ3MuanNvbicpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7fScpKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXN0T2JqZWN0LnJlYWRGaWxlKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQudmFsdWUudG9TdHJpbmcoKSwgJ3t9Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZSBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZTtcblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgdGVzdE9iamVjdC5jcmVhdGVGaWxlKHJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7fScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5yZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLnZhbHVlLnRvU3RyaW5nKCksICd7fScpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSBmaWxlIGNyZWF0ZXMgdGhlIGZpbGUgaWYgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZTtcblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUocmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCB0ZXN0T2JqZWN0LnJlYWRGaWxlKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NldHRpbmdzLmpzb24nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIudmFsdWUudG9TdHJpbmcoKSwgJ3t9Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIHRvIGV4aXN0aW5nIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Qud3JpdGVGaWxlKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NldHRpbmdzLmpzb24nKSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHRlc3RPYmplY3Qud3JpdGVGaWxlKHJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7YToxfScpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMS5yZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLnZhbHVlLnRvU3RyaW5nKCksICd7YToxfScpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgZmlsZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzZXR0aW5ncy5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmRlbCh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlKTtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0ZXN0T2JqZWN0LmV4aXN0cyhqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmYWxzZSwgcmVzdWx0KTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBmaWxlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3Qud3JpdGVGaWxlKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NldHRpbmdzLmpzb24nKSwgVlNCdWZmZXIuZnJvbVN0cmluZygnJykpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlc3RPYmplY3QucmVzb2x2ZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlKTtcblx0XHRhc3NlcnQub2soIXJlc3VsdC5pc0RpcmVjdG9yeSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5jaGlsZHJlbiA9PT0gdW5kZWZpbmVkKTtcblx0fSk7XG5cblx0dGVzdCgnZXhpc3RzIHJldHVybiBmYWxzZSBmb3IgZm9sZGVyIHRoYXQgZG9lcyBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgdGVzdE9iamVjdC5leGlzdHModXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpc3RzLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4aXN0cyByZXR1cm4gdHJ1ZSBmb3IgZm9sZGVyIHRoYXQgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJykpO1xuXHRcdGNvbnN0IGV4aXN0cyA9IGF3YWl0IHRlc3RPYmplY3QuZXhpc3RzKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4aXN0cywgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgZmlsZSB0aHJvd3MgZXJyb3IgZm9yIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmNyZWF0ZUZvbGRlcihqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycpKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zbmlwcGV0c0hvbWUpO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1Nob3VsZCBmYWlsIHNpbmNlIHJlYWQgZmlsZSBpcyBub3Qgc3VwcG9ydGVkIGZvciBmb2xkZXJzJyk7XG5cdFx0fSBjYXRjaCAoZSkgeyB9XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgZmlsZSB1bmRlciBmb2xkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5jcmVhdGVGb2xkZXIoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCd7fScpKTtcblx0XHRjb25zdCByZXNvdXJjZSA9IGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0T2JqZWN0LnJlYWRGaWxlKHJlc291cmNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwudmFsdWUudG9TdHJpbmcoKSwgJ3t9Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgZmlsZSB1bmRlciBzdWIgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJywgJ2phdmEnKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnamF2YScsICdzZXR0aW5ncy5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnamF2YS9zZXR0aW5ncy5qc29uJyk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShyZXNvdXJjZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZS50b1N0cmluZygpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnZhbHVlLnRvU3RyaW5nKCksICd7fScpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgZmlsZSB1bmRlciBmb2xkZXIgdGhhdCBleGlzdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5jcmVhdGVGb2xkZXIoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnKSk7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBqb2luUGF0aCh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zbmlwcGV0c0hvbWUsICdzZXR0aW5ncy5qc29uJyk7XG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHRlc3RPYmplY3QucmVhZEZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi52YWx1ZS50b1N0cmluZygpLCAne30nKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlIGZpbGUgdW5kZXIgZm9sZGVyIHRoYXQgZG9lcyBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzb3VyY2UgPSBqb2luUGF0aCh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zbmlwcGV0c0hvbWUsICdzZXR0aW5ncy5qc29uJyk7XG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHRlc3RPYmplY3QucmVhZEZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMi52YWx1ZS50b1N0cmluZygpLCAne30nKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGUgdG8gbm90IGV4aXN0aW5nIGZpbGUgdW5kZXIgY29udGFpbmVyIHRoYXQgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJykpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwudmFsdWUudG9TdHJpbmcoKSwgJ3t9Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIHRvIG5vdCBleGlzdGluZyBmaWxlIHVuZGVyIGNvbnRhaW5lciB0aGF0IGRvZXMgbm90IGV4aXN0cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUocmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLnJlc291cmNlLnRvU3RyaW5nKCksIHJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QucmVhZEZpbGUoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnZhbHVlLnRvU3RyaW5nKCksICd7fScpO1xuXHR9KTtcblxuXHR0ZXN0KCd3cml0ZSB0byBleGlzdGluZyBmaWxlIHVuZGVyIGNvbnRhaW5lcicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmNyZWF0ZUZvbGRlcihqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGNvbnN0IHJlc291cmNlID0gam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygne2E6MX0nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwudmFsdWUudG9TdHJpbmcoKSwgJ3thOjF9Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dyaXRlIGZpbGUgdW5kZXIgc3ViIGNvbnRhaW5lcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXNvdXJjZSA9IGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSwgJ2phdmEvc2V0dGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShyZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEucmVzb3VyY2UudG9TdHJpbmcoKSwgcmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycsICdqYXZhJywgJ3NldHRpbmdzLmpzb24nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC52YWx1ZS50b1N0cmluZygpLCAne30nKTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIHRocm93cyBlcnJvciBmb3IgZm9sZGVyIHRoYXQgZG9lcyBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuZGVsKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSk7XG5cdFx0XHRhc3NlcnQuZmFpbCgnU2hvdWxkIGZhaWwgdGhlIGZvbGRlciBkb2VzIG5vdCBleGlzdCcpO1xuXHRcdH0gY2F0Y2ggKGUpIHsgfVxuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgbm90IGV4aXN0aW5nIGZpbGUgdW5kZXIgY29udGFpbmVyIHRoYXQgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJykpO1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmRlbChqb2luUGF0aCh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zbmlwcGV0c0hvbWUsICdzZXR0aW5ncy5qc29uJykpO1xuXHRcdFx0YXNzZXJ0LmZhaWwoJ1Nob3VsZCBmYWlsIHNpbmNlIGZpbGUgZG9lcyBub3QgZXhpc3QnKTtcblx0XHR9IGNhdGNoIChlKSB7IH1cblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIG5vdCBleGlzdGluZyBmaWxlIHVuZGVyIGNvbnRhaW5lciB0aGF0IGRvZXMgbm90IGV4aXN0cycsIGFzeW5jICgpID0+IHtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5kZWwoam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnc2V0dGluZ3MuanNvbicpKTtcblx0XHRcdGFzc2VydC5mYWlsKCdTaG91bGQgZmFpbCBzaW5jZSBmaWxlIGRvZXMgbm90IGV4aXN0Jyk7XG5cdFx0fSBjYXRjaCAoZSkgeyB9XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBleGlzdGluZyBmaWxlIHVuZGVyIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmNyZWF0ZUZvbGRlcihqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShqb2luUGF0aCh1c2VyRGF0YUhvbWVPbkRpc2ssICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuZGVsKGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSwgJ3NldHRpbmdzLmpzb24nKSk7XG5cdFx0Y29uc3QgZXhpc3RzID0gYXdhaXQgdGVzdE9iamVjdC5leGlzdHMoam9pblBhdGgodXNlckRhdGFIb21lT25EaXNrLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhpc3RzLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Jlc29sdmUgZm9sZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuY3JlYXRlRm9sZGVyKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJykpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Qud3JpdGVGaWxlKGpvaW5QYXRoKHVzZXJEYXRhSG9tZU9uRGlzaywgJ3NuaXBwZXRzJywgJ3NldHRpbmdzLmpzb24nKSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdE9iamVjdC5yZXNvbHZlKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5pc0RpcmVjdG9yeSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdC5jaGlsZHJlbiAhPT0gdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmNoaWxkcmVuLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5jaGlsZHJlblswXS5yZXNvdXJjZS50b1N0cmluZygpLCBqb2luUGF0aCh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zbmlwcGV0c0hvbWUsICdzZXR0aW5ncy5qc29uJykudG9TdHJpbmcoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWQgYmFja3VwIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUoam9pblBhdGgoYmFja3VwV29ya3NwYWNlSG9tZU9uRGlzaywgJ2JhY2t1cC5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRlc3RPYmplY3QucmVhZEZpbGUoam9pblBhdGgoYmFja3VwV29ya3NwYWNlSG9tZU9uRGlzay53aXRoKHsgc2NoZW1lOiBlbnZpcm9ubWVudFNlcnZpY2UudXNlclJvYW1pbmdEYXRhSG9tZS5zY2hlbWUgfSksIGBiYWNrdXAuanNvbmApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnZhbHVlLnRvU3RyaW5nKCksICd7fScpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGUgYmFja3VwIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5jcmVhdGVGaWxlKGpvaW5QYXRoKGJhY2t1cFdvcmtzcGFjZUhvbWVPbkRpc2sud2l0aCh7IHNjaGVtZTogZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJSb2FtaW5nRGF0YUhvbWUuc2NoZW1lIH0pLCBgYmFja3VwLmpzb25gKSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aChiYWNrdXBXb3Jrc3BhY2VIb21lT25EaXNrLCAnYmFja3VwLmpzb24nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC52YWx1ZS50b1N0cmluZygpLCAne30nKTtcblx0fSk7XG5cblx0dGVzdCgnd3JpdGUgYmFja3VwIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC53cml0ZUZpbGUoam9pblBhdGgoYmFja3VwV29ya3NwYWNlSG9tZU9uRGlzaywgJ2JhY2t1cC5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Qud3JpdGVGaWxlKGpvaW5QYXRoKGJhY2t1cFdvcmtzcGFjZUhvbWVPbkRpc2sud2l0aCh7IHNjaGVtZTogZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJSb2FtaW5nRGF0YUhvbWUuc2NoZW1lIH0pLCBgYmFja3VwLmpzb25gKSwgVlNCdWZmZXIuZnJvbVN0cmluZygne2E6MX0nKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdE9iamVjdC5yZWFkRmlsZShqb2luUGF0aChiYWNrdXBXb3Jrc3BhY2VIb21lT25EaXNrLCAnYmFja3VwLmpzb24nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC52YWx1ZS50b1N0cmluZygpLCAne2E6MX0nKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBiYWNrdXBzIGZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LndyaXRlRmlsZShqb2luUGF0aChiYWNrdXBXb3Jrc3BhY2VIb21lT25EaXNrLCAnYmFja3VwLmpzb24nKSwgVlNCdWZmZXIuZnJvbVN0cmluZygne30nKSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGVzdE9iamVjdC5yZXNvbHZlKGJhY2t1cFdvcmtzcGFjZUhvbWVPbkRpc2sud2l0aCh7IHNjaGVtZTogZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJSb2FtaW5nRGF0YUhvbWUuc2NoZW1lIH0pKTtcblx0XHRhc3NlcnQub2socmVzdWx0LmlzRGlyZWN0b3J5KTtcblx0XHRhc3NlcnQub2socmVzdWx0LmNoaWxkcmVuICE9PSB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuY2hpbGRyZW4ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LmNoaWxkcmVuWzBdLnJlc291cmNlLnRvU3RyaW5nKCksIGpvaW5QYXRoKGJhY2t1cFdvcmtzcGFjZUhvbWVPbkRpc2sud2l0aCh7IHNjaGVtZTogZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJSb2FtaW5nRGF0YUhvbWUuc2NoZW1lIH0pLCBgYmFja3VwLmpzb25gKS50b1N0cmluZygpKTtcblx0fSk7XG59KTtcblxuY2xhc3MgVGVzdEZpbGVTeXN0ZW1Qcm92aWRlciBpbXBsZW1lbnRzIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZVJlYWRXcml0ZUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoT3BlblJlYWRXcml0ZUNsb3NlQ2FwYWJpbGl0eSwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlUmVhZFN0cmVhbUNhcGFiaWxpdHkge1xuXG5cdGNvbnN0cnVjdG9yKHJlYWRvbmx5IG9uRGlkQ2hhbmdlRmlsZTogRXZlbnQ8cmVhZG9ubHkgSUZpbGVDaGFuZ2VbXT4pIHsgfVxuXG5cblx0cmVhZG9ubHkgY2FwYWJpbGl0aWVzOiBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMgPSBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZVJlYWRXcml0ZTtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZUNhcGFiaWxpdGllczogRXZlbnQ8dm9pZD4gPSBFdmVudC5Ob25lO1xuXG5cdHdhdGNoKCk6IElEaXNwb3NhYmxlIHsgcmV0dXJuIERpc3Bvc2FibGUuTm9uZTsgfVxuXG5cdHN0YXQoKTogUHJvbWlzZTxJU3RhdD4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXG5cdG1rZGlyKHJlc291cmNlOiBVUkkpOiBQcm9taXNlPHZvaWQ+IHsgdGhyb3cgbmV3IEVycm9yKCdOb3QgU3VwcG9ydGVkJyk7IH1cblxuXHRyZW5hbWUoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cblx0cmVhZEZpbGUocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8VWludDhBcnJheT4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXG5cdHJlYWRkaXIocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8W3N0cmluZywgRmlsZVR5cGVdW10+IHsgdGhyb3cgbmV3IEVycm9yKCdOb3QgU3VwcG9ydGVkJyk7IH1cblxuXHR3cml0ZUZpbGUoKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cblx0ZGVsZXRlKCk6IFByb21pc2U8dm9pZD4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXHRvcGVuKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlT3Blbk9wdGlvbnMpOiBQcm9taXNlPG51bWJlcj4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXHRjbG9zZShmZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cdHJlYWQoZmQ6IG51bWJlciwgcG9zOiBudW1iZXIsIGRhdGE6IFVpbnQ4QXJyYXksIG9mZnNldDogbnVtYmVyLCBsZW5ndGg6IG51bWJlcik6IFByb21pc2U8bnVtYmVyPiB7IHRocm93IG5ldyBFcnJvcignTm90IFN1cHBvcnRlZCcpOyB9XG5cdHdyaXRlKGZkOiBudW1iZXIsIHBvczogbnVtYmVyLCBkYXRhOiBVaW50OEFycmF5LCBvZmZzZXQ6IG51bWJlciwgbGVuZ3RoOiBudW1iZXIpOiBQcm9taXNlPG51bWJlcj4geyB0aHJvdyBuZXcgRXJyb3IoJ05vdCBTdXBwb3J0ZWQnKTsgfVxuXG5cdHJlYWRGaWxlU3RyZWFtKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlUmVhZFN0cmVhbU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFJlYWRhYmxlU3RyZWFtRXZlbnRzPFVpbnQ4QXJyYXk+IHsgdGhyb3cgbmV3IEVycm9yKCdNZXRob2Qgbm90IGltcGxlbWVudGVkLicpOyB9XG59XG5cbnN1aXRlKCdGaWxlVXNlckRhdGFQcm92aWRlciAtIFdhdGNoaW5nJywgKCkgPT4ge1xuXG5cdGxldCB0ZXN0T2JqZWN0OiBGaWxlVXNlckRhdGFQcm92aWRlcjtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblx0Y29uc3Qgcm9vdEZpbGVSZXNvdXJjZSA9IGpvaW5QYXRoKFJPT1QsICdVc2VyJyk7XG5cdGNvbnN0IHJvb3RVc2VyRGF0YVJlc291cmNlID0gcm9vdEZpbGVSZXNvdXJjZS53aXRoKHsgc2NoZW1lOiBTY2hlbWFzLnZzY29kZVVzZXJEYXRhIH0pO1xuXG5cdGxldCBmaWxlRXZlbnRFbWl0dGVyOiBFbWl0dGVyPHJlYWRvbmx5IElGaWxlQ2hhbmdlW10+O1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRjb25zdCBsb2dTZXJ2aWNlID0gbmV3IE51bGxMb2dTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbGVTZXJ2aWNlKGxvZ1NlcnZpY2UpKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSBuZXcgVGVzdEVudmlyb25tZW50U2VydmljZShyb290RmlsZVJlc291cmNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IFVyaUlkZW50aXR5U2VydmljZShmaWxlU2VydmljZSkpO1xuXHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBVc2VyRGF0YVByb2ZpbGVzU2VydmljZShlbnZpcm9ubWVudFNlcnZpY2UsIGZpbGVTZXJ2aWNlLCB1cmlJZGVudGl0eVNlcnZpY2UsIGxvZ1NlcnZpY2UpKTtcblxuXHRcdGZpbGVFdmVudEVtaXR0ZXIgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEVtaXR0ZXI8cmVhZG9ubHkgSUZpbGVDaGFuZ2VbXT4oKSk7XG5cdFx0dGVzdE9iamVjdCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmlsZVVzZXJEYXRhUHJvdmlkZXIocm9vdEZpbGVSZXNvdXJjZS5zY2hlbWUsIG5ldyBUZXN0RmlsZVN5c3RlbVByb3ZpZGVyKGZpbGVFdmVudEVtaXR0ZXIuZXZlbnQpLCBTY2hlbWFzLnZzY29kZVVzZXJEYXRhLCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIGFkZGVkIGNoYW5nZSBldmVudCcsIGRvbmUgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0LndhdGNoKHJvb3RVc2VyRGF0YVJlc291cmNlLCB7IGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9KSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBqb2luUGF0aChyb290VXNlckRhdGFSZXNvdXJjZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCB0YXJnZXQgPSBqb2luUGF0aChyb290RmlsZVJlc291cmNlLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlRmlsZShlID0+IHtcblx0XHRcdGlmIChpc0VxdWFsKGVbMF0ucmVzb3VyY2UsIGV4cGVjdGVkKSAmJiBlWzBdLnR5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLkFEREVEKSB7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZmlsZUV2ZW50RW1pdHRlci5maXJlKFt7XG5cdFx0XHRyZXNvdXJjZTogdGFyZ2V0LFxuXHRcdFx0dHlwZTogRmlsZUNoYW5nZVR5cGUuQURERURcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgdXBkYXRlZCBjaGFuZ2UgZXZlbnQnLCBkb25lID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC53YXRjaChyb290VXNlckRhdGFSZXNvdXJjZSwgeyBleGNsdWRlczogW10sIHJlY3Vyc2l2ZTogZmFsc2UgfSkpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gam9pblBhdGgocm9vdFVzZXJEYXRhUmVzb3VyY2UsICdzZXR0aW5ncy5qc29uJyk7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gam9pblBhdGgocm9vdEZpbGVSZXNvdXJjZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZUZpbGUoZSA9PiB7XG5cdFx0XHRpZiAoaXNFcXVhbChlWzBdLnJlc291cmNlLCBleHBlY3RlZCkgJiYgZVswXS50eXBlID09PSBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKSB7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZmlsZUV2ZW50RW1pdHRlci5maXJlKFt7XG5cdFx0XHRyZXNvdXJjZTogdGFyZ2V0LFxuXHRcdFx0dHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRFxuXHRcdH1dKTtcblx0fSk7XG5cblx0dGVzdCgnZmlsZSBkZWxldGVkIGNoYW5nZSBldmVudCcsIGRvbmUgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0LndhdGNoKHJvb3RVc2VyRGF0YVJlc291cmNlLCB7IGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9KSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBqb2luUGF0aChyb290VXNlckRhdGFSZXNvdXJjZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCB0YXJnZXQgPSBqb2luUGF0aChyb290RmlsZVJlc291cmNlLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlRmlsZShlID0+IHtcblx0XHRcdGlmIChpc0VxdWFsKGVbMF0ucmVzb3VyY2UsIGV4cGVjdGVkKSAmJiBlWzBdLnR5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpIHtcblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRmaWxlRXZlbnRFbWl0dGVyLmZpcmUoW3tcblx0XHRcdHJlc291cmNlOiB0YXJnZXQsXG5cdFx0XHR0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEXG5cdFx0fV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIHVuZGVyIGZvbGRlciBjcmVhdGVkIGNoYW5nZSBldmVudCcsIGRvbmUgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0LndhdGNoKHJvb3RVc2VyRGF0YVJlc291cmNlLCB7IGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9KSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBqb2luUGF0aChyb290VXNlckRhdGFSZXNvdXJjZSwgJ3NuaXBwZXRzJywgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRjb25zdCB0YXJnZXQgPSBqb2luUGF0aChyb290RmlsZVJlc291cmNlLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlRmlsZShlID0+IHtcblx0XHRcdGlmIChpc0VxdWFsKGVbMF0ucmVzb3VyY2UsIGV4cGVjdGVkKSAmJiBlWzBdLnR5cGUgPT09IEZpbGVDaGFuZ2VUeXBlLkFEREVEKSB7XG5cdFx0XHRcdGRvbmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZmlsZUV2ZW50RW1pdHRlci5maXJlKFt7XG5cdFx0XHRyZXNvdXJjZTogdGFyZ2V0LFxuXHRcdFx0dHlwZTogRmlsZUNoYW5nZVR5cGUuQURERURcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgdW5kZXIgZm9sZGVyIHVwZGF0ZWQgY2hhbmdlIGV2ZW50JywgZG9uZSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qud2F0Y2gocm9vdFVzZXJEYXRhUmVzb3VyY2UsIHsgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH0pKTtcblx0XHRjb25zdCBleHBlY3RlZCA9IGpvaW5QYXRoKHJvb3RVc2VyRGF0YVJlc291cmNlLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGpvaW5QYXRoKHJvb3RGaWxlUmVzb3VyY2UsICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VGaWxlKGUgPT4ge1xuXHRcdFx0aWYgKGlzRXF1YWwoZVswXS5yZXNvdXJjZSwgZXhwZWN0ZWQpICYmIGVbMF0udHlwZSA9PT0gRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkge1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGZpbGVFdmVudEVtaXR0ZXIuZmlyZShbe1xuXHRcdFx0cmVzb3VyY2U6IHRhcmdldCxcblx0XHRcdHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURURcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpbGUgdW5kZXIgZm9sZGVyIGRlbGV0ZWQgY2hhbmdlIGV2ZW50JywgZG9uZSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qud2F0Y2gocm9vdFVzZXJEYXRhUmVzb3VyY2UsIHsgZXhjbHVkZXM6IFtdLCByZWN1cnNpdmU6IGZhbHNlIH0pKTtcblx0XHRjb25zdCBleHBlY3RlZCA9IGpvaW5QYXRoKHJvb3RVc2VyRGF0YVJlc291cmNlLCAnc25pcHBldHMnLCAnc2V0dGluZ3MuanNvbicpO1xuXHRcdGNvbnN0IHRhcmdldCA9IGpvaW5QYXRoKHJvb3RGaWxlUmVzb3VyY2UsICdzbmlwcGV0cycsICdzZXR0aW5ncy5qc29uJyk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VGaWxlKGUgPT4ge1xuXHRcdFx0aWYgKGlzRXF1YWwoZVswXS5yZXNvdXJjZSwgZXhwZWN0ZWQpICYmIGVbMF0udHlwZSA9PT0gRmlsZUNoYW5nZVR5cGUuREVMRVRFRCkge1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGZpbGVFdmVudEVtaXR0ZXIuZmlyZShbe1xuXHRcdFx0cmVzb3VyY2U6IHRhcmdldCxcblx0XHRcdHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURURcblx0XHR9XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGlzIG5vdCB0cmlnZ2VyZWQgaWYgbm90IHdhdGNoZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gam9pblBhdGgocm9vdEZpbGVSZXNvdXJjZSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRsZXQgdHJpZ2dlcmVkID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VGaWxlKCgpID0+IHRyaWdnZXJlZCA9IHRydWUpKTtcblx0XHRmaWxlRXZlbnRFbWl0dGVyLmZpcmUoW3tcblx0XHRcdHJlc291cmNlOiB0YXJnZXQsXG5cdFx0XHR0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEXG5cdFx0fV0pO1xuXHRcdGlmICh0cmlnZ2VyZWQpIHtcblx0XHRcdGFzc2VydC5mYWlsKCdldmVudCBzaG91bGQgbm90IGJlIHRyaWdnZXJlZCcpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgaXMgbm90IHRyaWdnZXJlZCBpZiBub3Qgd2F0Y2hlZCAyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0ZXN0T2JqZWN0LndhdGNoKHJvb3RVc2VyRGF0YVJlc291cmNlLCB7IGV4Y2x1ZGVzOiBbXSwgcmVjdXJzaXZlOiBmYWxzZSB9KSk7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gam9pblBhdGgoZGlybmFtZShyb290RmlsZVJlc291cmNlKSwgJ3NldHRpbmdzLmpzb24nKTtcblx0XHRsZXQgdHJpZ2dlcmVkID0gZmFsc2U7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VGaWxlKCgpID0+IHRyaWdnZXJlZCA9IHRydWUpKTtcblx0XHRmaWxlRXZlbnRFbWl0dGVyLmZpcmUoW3tcblx0XHRcdHJlc291cmNlOiB0YXJnZXQsXG5cdFx0XHR0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEXG5cdFx0fV0pO1xuXHRcdGlmICh0cmlnZ2VyZWQpIHtcblx0XHRcdGFzc2VydC5mYWlsKCdldmVudCBzaG91bGQgbm90IGJlIHRyaWdnZXJlZCcpO1xuXHRcdH1cblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsU0FBUyxhQUFhO0FBQy9CLFNBQVMsa0JBQStCO0FBQ3hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLFNBQVMsU0FBUyxnQkFBZ0I7QUFFM0MsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCLHNDQUFrUjtBQUMzUyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHNCQUFzQjtBQUMvQixPQUFPLGFBQWE7QUFDcEIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw0QkFBNEI7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TUFBTSxlQUFlO0FBQUEsSUFDdEIsQ0FBQyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsT0FBSywwQ0FBMEMsVUFBUTtBQUN0RCxnQkFBWSxJQUFJLFdBQVcsTUFBTSxzQkFBc0IsRUFBRSxVQUFVLENBQUMsR0FBRyxXQUFXLE1BQU0sQ0FBQyxDQUFDO0FBQzFGLFVBQU0sV0FBVyxTQUFTLHNCQUFzQixZQUFZLGVBQWU7QUFDM0UsVUFBTSxTQUFTLFNBQVMsa0JBQWtCLFlBQVksZUFBZTtBQUNyRSxnQkFBWSxJQUFJLFdBQVcsZ0JBQWdCLE9BQUs7QUFDL0MsVUFBSSxRQUFRLEVBQUUsQ0FBQyxFQUFFLFVBQVUsUUFBUSxLQUFLLEVBQUUsQ0FBQyxFQUFFLFNBQVMsZUFBZSxTQUFTO0FBQzdFLGFBQUs7QUFBQSxNQUNOO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFDRixxQkFBaUIsS0FBSyxDQUFDO0FBQUEsTUFDdEIsVUFBVTtBQUFBLE1BQ1YsTUFBTSxlQUFlO0FBQUEsSUFDdEIsQ0FBQyxDQUFDO0FBQUEsRUFDSCxDQUFDO0FBRUQsT0FBSyx5Q0FBeUMsWUFBWTtBQUN6RCxVQUFNLFNBQVMsU0FBUyxrQkFBa0IsZUFBZTtBQUN6RCxRQUFJLFlBQVk7QUFDaEIsZ0JBQVksSUFBSSxXQUFXLGdCQUFnQixNQUFNLFlBQVksSUFBSSxDQUFDO0FBQ2xFLHFCQUFpQixLQUFLLENBQUM7QUFBQSxNQUN0QixVQUFVO0FBQUEsTUFDVixNQUFNLGVBQWU7QUFBQSxJQUN0QixDQUFDLENBQUM7QUFDRixRQUFJLFdBQVc7QUFDZCxhQUFPLEtBQUssK0JBQStCO0FBQUEsSUFDNUM7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLDJDQUEyQyxZQUFZO0FBQzNELGdCQUFZLElBQUksV0FBVyxNQUFNLHNCQUFzQixFQUFFLFVBQVUsQ0FBQyxHQUFHLFdBQVcsTUFBTSxDQUFDLENBQUM7QUFDMUYsVUFBTSxTQUFTLFNBQVMsUUFBUSxnQkFBZ0IsR0FBRyxlQUFlO0FBQ2xFLFFBQUksWUFBWTtBQUNoQixnQkFBWSxJQUFJLFdBQVcsZ0JBQWdCLE1BQU0sWUFBWSxJQUFJLENBQUM7QUFDbEUscUJBQWlCLEtBQUssQ0FBQztBQUFBLE1BQ3RCLFVBQVU7QUFBQSxNQUNWLE1BQU0sZUFBZTtBQUFBLElBQ3RCLENBQUMsQ0FBQztBQUNGLFFBQUksV0FBVztBQUNkLGFBQU8sS0FBSywrQkFBK0I7QUFBQSxJQUM1QztBQUFBLEVBQ0QsQ0FBQztBQUVGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
