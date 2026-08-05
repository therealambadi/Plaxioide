import assert from "assert";
import { Barrier } from "../../../../base/common/async.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { isEqual, joinPath } from "../../../../base/common/resources.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IFileService } from "../../../files/common/files.js";
import { IStorageService, StorageScope } from "../../../storage/common/storage.js";
import { IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { AbstractSynchroniser } from "../../common/abstractSynchronizer.js";
import { Change, IUserDataSyncStoreService, MergeState, SyncResource, SyncStatus, USER_DATA_SYNC_SCHEME } from "../../common/userDataSync.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "./userDataSyncClient.js";
class TestSynchroniser extends AbstractSynchroniser {
  constructor() {
    super(...arguments);
    this.syncBarrier = new Barrier();
    this.syncResult = { hasConflicts: false, hasError: false };
    this.onDoSyncCall = this._register(new Emitter());
    this.failWhenGettingLatestRemoteUserData = false;
    this.version = 1;
    this.cancelled = false;
    this.localResource = joinPath(this.environmentService.userRoamingDataHome, "testResource.json");
    this.onDidTriggerLocalChangeCall = this._register(new Emitter());
  }
  getMachineId() {
    return this.currentMachineIdPromise;
  }
  getLastSyncResource() {
    return this.lastSyncResource;
  }
  getLatestRemoteUserData(manifest, lastSyncUserData) {
    if (this.failWhenGettingLatestRemoteUserData) {
      throw new Error();
    }
    return super.getLatestRemoteUserData(manifest, lastSyncUserData);
  }
  async doSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration) {
    this.cancelled = false;
    this.onDoSyncCall.fire();
    await this.syncBarrier.wait();
    if (this.cancelled) {
      return SyncStatus.Idle;
    }
    return super.doSync(remoteUserData, lastSyncUserData, strategy, userDataSyncConfiguration);
  }
  async generateSyncPreview(remoteUserData) {
    if (this.syncResult.hasError) {
      throw new Error("failed");
    }
    let fileContent = null;
    try {
      fileContent = await this.fileService.readFile(this.localResource);
    } catch (error) {
    }
    return [{
      baseResource: this.localResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "base" }),
      baseContent: null,
      localResource: this.localResource,
      localContent: fileContent ? fileContent.value.toString() : null,
      remoteResource: this.localResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "remote" }),
      remoteContent: remoteUserData.syncData ? remoteUserData.syncData.content : null,
      previewResource: this.localResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "preview" }),
      ref: remoteUserData.ref,
      localChange: Change.Modified,
      remoteChange: Change.Modified,
      acceptedResource: this.localResource.with({ scheme: USER_DATA_SYNC_SCHEME, authority: "accepted" })
    }];
  }
  async hasRemoteChanged(lastSyncUserData) {
    return true;
  }
  async getMergeResult(resourcePreview, token) {
    return {
      content: resourcePreview.ref,
      localChange: Change.Modified,
      remoteChange: Change.Modified,
      hasConflicts: this.syncResult.hasConflicts
    };
  }
  async getAcceptResult(resourcePreview, resource, content, token) {
    if (isEqual(resource, resourcePreview.localResource)) {
      return {
        content: resourcePreview.localContent,
        localChange: Change.None,
        remoteChange: resourcePreview.localContent === null ? Change.Deleted : Change.Modified
      };
    }
    if (isEqual(resource, resourcePreview.remoteResource)) {
      return {
        content: resourcePreview.remoteContent,
        localChange: resourcePreview.remoteContent === null ? Change.Deleted : Change.Modified,
        remoteChange: Change.None
      };
    }
    if (isEqual(resource, resourcePreview.previewResource)) {
      if (content === void 0) {
        return {
          content: resourcePreview.ref,
          localChange: Change.Modified,
          remoteChange: Change.Modified
        };
      } else {
        return {
          content,
          localChange: content === null ? resourcePreview.localContent !== null ? Change.Deleted : Change.None : Change.Modified,
          remoteChange: content === null ? resourcePreview.remoteContent !== null ? Change.Deleted : Change.None : Change.Modified
        };
      }
    }
    throw new Error(`Invalid Resource: ${resource.toString()}`);
  }
  async applyResult(remoteUserData, lastSyncUserData, resourcePreviews, force) {
    if (resourcePreviews[0][1].localChange === Change.Deleted) {
      await this.fileService.del(this.localResource);
    }
    if (resourcePreviews[0][1].localChange === Change.Added || resourcePreviews[0][1].localChange === Change.Modified) {
      await this.fileService.writeFile(this.localResource, VSBuffer.fromString(resourcePreviews[0][1].content));
    }
    if (resourcePreviews[0][1].remoteChange === Change.Deleted) {
      await this.applyRef(null, remoteUserData.ref);
    }
    if (resourcePreviews[0][1].remoteChange === Change.Added || resourcePreviews[0][1].remoteChange === Change.Modified) {
      await this.applyRef(resourcePreviews[0][1].content, remoteUserData.ref);
    }
  }
  async applyRef(content, ref) {
    const remoteUserData = await this.updateRemoteUserData(content === null ? "" : content, ref);
    await this.updateLastSyncUserData(remoteUserData);
  }
  async stop() {
    this.cancelled = true;
    this.syncBarrier.open();
    super.stop();
  }
  testTriggerLocalChange() {
    this.triggerLocalChange();
  }
  async doTriggerLocalChange() {
    await super.doTriggerLocalChange();
    this.onDidTriggerLocalChangeCall.fire();
  }
  hasLocalData() {
    throw new Error("not implemented");
  }
  async resolveContent(uri) {
    return null;
  }
}
suite("TestSynchronizer - Auto Sync", () => {
  const server = new UserDataSyncTestServer();
  let client;
  teardown(async () => {
    await client.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    client = disposableStore.add(new UserDataSyncClient(server));
    await client.setUp();
  });
  test("status is syncing", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      const actual = [];
      disposableStore.add(testObject.onDidChangeStatus((status) => actual.push(status)));
      const promise = Event.toPromise(testObject.onDoSyncCall.event);
      testObject.sync(await client.getResourceManifest());
      await promise;
      assert.deepStrictEqual(actual, [SyncStatus.Syncing]);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      testObject.stop();
    });
  });
  test("status is set correctly when sync is finished", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      const actual = [];
      disposableStore.add(testObject.onDidChangeStatus((status) => actual.push(status)));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(actual, [SyncStatus.Syncing, SyncStatus.Idle]);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
    });
  });
  test("status is set correctly when sync has errors", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasError: true, hasConflicts: false };
      testObject.syncBarrier.open();
      const actual = [];
      disposableStore.add(testObject.onDidChangeStatus((status) => actual.push(status)));
      try {
        await testObject.sync(await client.getResourceManifest());
        assert.fail("Should fail");
      } catch (e) {
        assert.deepStrictEqual(actual, [SyncStatus.Syncing, SyncStatus.Idle]);
        assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      }
    });
  });
  test("status is set to hasConflicts when asked to sync if there are conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      assertConflicts(testObject.conflicts.conflicts, [testObject.localResource]);
    });
  });
  test("sync should not run if syncing already", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      const promise = Event.toPromise(testObject.onDoSyncCall.event);
      testObject.sync(await client.getResourceManifest());
      await promise;
      const actual = [];
      disposableStore.add(testObject.onDidChangeStatus((status) => actual.push(status)));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(actual, []);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      await testObject.stop();
    });
  });
  test("sync should not run if there are conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const actual = [];
      disposableStore.add(testObject.onDidChangeStatus((status) => actual.push(status)));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(actual, []);
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
    });
  });
  test("accept preview during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const fileService = client.instantiationService.get(IFileService);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, (await fileService.readFile(testObject.localResource)).value.toString());
    });
  });
  test("accept remote during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const fileService = client.instantiationService.get(IFileService);
      const currentRemoteContent = (await testObject.getRemoteUserData(null)).syncData?.content;
      const newLocalContent = "conflict";
      await fileService.writeFile(testObject.localResource, VSBuffer.fromString(newLocalContent));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, currentRemoteContent);
      assert.strictEqual((await fileService.readFile(testObject.localResource)).value.toString(), currentRemoteContent);
    });
  });
  test("accept local during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const fileService = client.instantiationService.get(IFileService);
      const newLocalContent = "conflict";
      await fileService.writeFile(testObject.localResource, VSBuffer.fromString(newLocalContent));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].localResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, newLocalContent);
      assert.strictEqual((await fileService.readFile(testObject.localResource)).value.toString(), newLocalContent);
    });
  });
  test("accept new content during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const fileService = client.instantiationService.get(IFileService);
      const newLocalContent = "conflict";
      await fileService.writeFile(testObject.localResource, VSBuffer.fromString(newLocalContent));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      const mergeContent = "newContent";
      await testObject.accept(testObject.conflicts.conflicts[0].previewResource, mergeContent);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, mergeContent);
      assert.strictEqual((await fileService.readFile(testObject.localResource)).value.toString(), mergeContent);
    });
  });
  test("accept delete during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const fileService = client.instantiationService.get(IFileService);
      const newLocalContent = "conflict";
      await fileService.writeFile(testObject.localResource, VSBuffer.fromString(newLocalContent));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].previewResource, null);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, "");
      assert.ok(!await fileService.exists(testObject.localResource));
    });
  });
  test("accept deleted local during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const fileService = client.instantiationService.get(IFileService);
      await fileService.del(testObject.localResource);
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].localResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, "");
      assert.ok(!await fileService.exists(testObject.localResource));
    });
  });
  test("accept deleted remote during conflicts", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      const fileService = client.instantiationService.get(IFileService);
      await fileService.writeFile(testObject.localResource, VSBuffer.fromString("some content"));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertConflicts(testObject.conflicts.conflicts, []);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData, null);
      assert.ok(!await fileService.exists(testObject.localResource));
    });
  });
  test("request latest data on precondition failure", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      testObject.syncBarrier = new Barrier();
      const disposable = testObject.onDoSyncCall.event(async () => {
        disposable.dispose();
        await testObject.applyRef(ref, ref);
        server.reset();
        testObject.syncBarrier.open();
      });
      const manifest = await client.getResourceManifest();
      const ref = manifest[testObject.resource];
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(server.requests, [
        { type: "POST", url: `${server.url}/v1/resource/${testObject.resource}`, headers: { "If-Match": ref } },
        { type: "GET", url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} },
        { type: "POST", url: `${server.url}/v1/resource/${testObject.resource}`, headers: { "If-Match": `${parseInt(ref) + 1}` } }
      ]);
    });
  });
  test("no requests are made to server when local change is triggered", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      server.reset();
      const promise = Event.toPromise(testObject.onDidTriggerLocalChangeCall.event);
      testObject.testTriggerLocalChange();
      await promise;
      assert.deepStrictEqual(server.requests, []);
    });
  });
  test("status is reset when getting latest remote data fails", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.failWhenGettingLatestRemoteUserData = true;
      try {
        await testObject.sync(await client.getResourceManifest());
        assert.fail("Should throw an error");
      } catch (error) {
      }
      assert.strictEqual(testObject.status, SyncStatus.Idle);
    });
  });
});
suite("TestSynchronizer - Manual Sync", () => {
  const server = new UserDataSyncTestServer();
  let client;
  teardown(async () => {
    await client.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    client = disposableStore.add(new UserDataSyncClient(server));
    await client.setUp();
  });
  test("preview", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      const preview = await testObject.sync(await client.getResourceManifest(), true);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preview -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].localResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preview -> merge -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const manifest = await client.getResourceManifest();
      let preview = await testObject.sync(manifest, true);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      const expectedContent = manifest[testObject.resource];
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("preview -> accept -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const manifest = await client.getResourceManifest();
      const expectedContent = manifest[testObject.resource];
      let preview = await testObject.sync(manifest, true);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("preivew -> discard", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Preview);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preivew -> discard -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preivew -> accept -> discard -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preivew -> accept -> discard", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Preview);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("preivew -> discard -> accept -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const expectedContent = (await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].localResource);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("conflicts: preview", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      const preview = await testObject.sync(await client.getResourceManifest(), true);
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Conflict);
      assertConflicts(testObject.conflicts.conflicts, [preview.resourcePreviews[0].localResource]);
    });
  });
  test("conflicts: preview -> discard", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      const preview = await testObject.sync(await client.getResourceManifest(), true);
      await testObject.discard(preview.resourcePreviews[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Preview);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preview -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      const content = await testObject.resolveContent(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource, content);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preview -> accept 2", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      const content = await testObject.resolveContent(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource, content);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preview -> accept -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      testObject.syncResult = { hasConflicts: true, hasError: false };
      const manifest = await client.getResourceManifest();
      const expectedContent = manifest[testObject.resource];
      let preview = await testObject.sync(manifest, true);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("conflicts: preivew -> discard", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Preview);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preivew -> discard -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preivew -> accept -> discard -> accept", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: true, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].previewResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Accepted);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preivew -> accept -> discard", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      assert.deepStrictEqual(testObject.status, SyncStatus.Syncing);
      assertPreviews(preview.resourcePreviews, [testObject.localResource]);
      assert.strictEqual(preview.resourcePreviews[0].mergeState, MergeState.Preview);
      assertConflicts(testObject.conflicts.conflicts, []);
    });
  });
  test("conflicts: preivew -> discard -> accept -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const expectedContent = (await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].localResource);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("conflicts: preivew -> accept -> discard -> accept -> apply", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncResult = { hasConflicts: false, hasError: false };
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const expectedContent = (await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString();
      let preview = await testObject.sync(await client.getResourceManifest(), true);
      preview = await testObject.accept(preview.resourcePreviews[0].remoteResource);
      preview = await testObject.discard(preview.resourcePreviews[0].previewResource);
      preview = await testObject.accept(preview.resourcePreviews[0].localResource);
      preview = await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual(preview, null);
      assertConflicts(testObject.conflicts.conflicts, []);
      assert.strictEqual((await testObject.getRemoteUserData(null)).syncData?.content, expectedContent);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
  test("remote is accepted if last sync state does not exists in server", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp();
      const synchronizer2 = disposableStore.add(client2.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client2.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      synchronizer2.syncBarrier.open();
      const manifest = await client2.getResourceManifest();
      const expectedContent = manifest[testObject.resource];
      await synchronizer2.sync(manifest);
      await fileService.del(testObject.getLastSyncResource());
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      assert.strictEqual((await client.instantiationService.get(IFileService).readFile(testObject.localResource)).value.toString(), expectedContent);
    });
  });
});
suite("TestSynchronizer - Last Sync Data", () => {
  const server = new UserDataSyncTestServer();
  let client;
  teardown(async () => {
    await client.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    client = disposableStore.add(new UserDataSyncClient(server));
    await client.setUp();
  });
  test("last sync data is null when not synced before", async () => {
    await runWithFakedTimers({}, async () => {
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      const actual = await testObject.getLastSyncUserData();
      assert.strictEqual(actual, null);
    });
  });
  test("last sync data is set after sync", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const machineId = await testObject.getMachineId();
      const actual = await testObject.getLastSyncUserData();
      assert.deepStrictEqual(storageService.get("settings.lastSyncUserData", StorageScope.APPLICATION), JSON.stringify({ ref: "1" }));
      assert.deepStrictEqual(JSON.parse((await fileService.readFile(testObject.getLastSyncResource())).value.toString()), { ref: "1", syncData: { version: 1, machineId, content: "0" } });
      assert.deepStrictEqual(actual, {
        ref: "1",
        syncData: {
          content: "0",
          machineId,
          version: 1
        }
      });
    });
  });
  test("last sync data is read from server after sync if last sync resource is deleted", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const machineId = await testObject.getMachineId();
      await fileService.del(testObject.getLastSyncResource());
      const actual = await testObject.getLastSyncUserData();
      assert.deepStrictEqual(storageService.get("settings.lastSyncUserData", StorageScope.APPLICATION), JSON.stringify({ ref: "1" }));
      assert.deepStrictEqual(actual, {
        ref: "1",
        syncData: {
          content: "0",
          machineId,
          version: 1
        }
      });
    });
  });
  test("last sync data is read from server after sync and sync data is invalid", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const machineId = await testObject.getMachineId();
      await fileService.writeFile(testObject.getLastSyncResource(), VSBuffer.fromString(JSON.stringify({
        ref: "1",
        version: 1,
        content: JSON.stringify({
          content: "0",
          machineId,
          version: 1
        }),
        additionalData: {
          foo: "bar"
        }
      })));
      server.reset();
      const actual = await testObject.getLastSyncUserData();
      assert.deepStrictEqual(storageService.get("settings.lastSyncUserData", StorageScope.APPLICATION), JSON.stringify({ ref: "1" }));
      assert.deepStrictEqual(actual, {
        ref: "1",
        syncData: {
          content: "0",
          machineId,
          version: 1
        }
      });
      assert.deepStrictEqual(server.requests, [{ headers: {}, type: "GET", url: "http://host:3000/v1/resource/settings/1" }]);
    });
  });
  test("last sync data is read from server after sync and stored sync data is tampered", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const machineId = await testObject.getMachineId();
      await fileService.writeFile(testObject.getLastSyncResource(), VSBuffer.fromString(JSON.stringify({
        ref: "2",
        syncData: {
          content: "0",
          machineId,
          version: 1
        }
      })));
      server.reset();
      const actual = await testObject.getLastSyncUserData();
      assert.deepStrictEqual(storageService.get("settings.lastSyncUserData", StorageScope.APPLICATION), JSON.stringify({ ref: "1" }));
      assert.deepStrictEqual(actual, {
        ref: "1",
        syncData: {
          content: "0",
          machineId,
          version: 1
        }
      });
      assert.deepStrictEqual(server.requests, [{ headers: {}, type: "GET", url: "http://host:3000/v1/resource/settings/1" }]);
    });
  });
  test("reading last sync data: no requests are made to server when sync data is invalid", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      const machineId = await testObject.getMachineId();
      await fileService.writeFile(testObject.getLastSyncResource(), VSBuffer.fromString(JSON.stringify({
        ref: "1",
        version: 1,
        content: JSON.stringify({
          content: "0",
          machineId,
          version: 1
        }),
        additionalData: {
          foo: "bar"
        }
      })));
      await testObject.getLastSyncUserData();
      server.reset();
      await testObject.getLastSyncUserData();
      assert.deepStrictEqual(server.requests, []);
    });
  });
  test("reading last sync data: no requests are made to server when sync data is null", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      server.reset();
      await fileService.writeFile(testObject.getLastSyncResource(), VSBuffer.fromString(JSON.stringify({
        ref: "1",
        syncData: null
      })));
      await testObject.getLastSyncUserData();
      assert.deepStrictEqual(server.requests, []);
    });
  });
  test("last sync data is null after sync if last sync state is deleted", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      storageService.remove("settings.lastSyncUserData", StorageScope.APPLICATION);
      const actual = await testObject.getLastSyncUserData();
      assert.strictEqual(actual, null);
    });
  });
  test("last sync data is null after sync if last sync content is deleted everywhere", async () => {
    await runWithFakedTimers({}, async () => {
      const storageService = client.instantiationService.get(IStorageService);
      const fileService = client.instantiationService.get(IFileService);
      const userDataSyncStoreService = client.instantiationService.get(IUserDataSyncStoreService);
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestSynchroniser, { syncResource: SyncResource.Settings, profile: client.instantiationService.get(IUserDataProfilesService).defaultProfile }, void 0));
      testObject.syncBarrier.open();
      await testObject.sync(await client.getResourceManifest());
      await fileService.del(testObject.getLastSyncResource());
      await userDataSyncStoreService.deleteResource(testObject.syncResource.syncResource, null);
      const actual = await testObject.getLastSyncUserData();
      assert.deepStrictEqual(storageService.get("settings.lastSyncUserData", StorageScope.APPLICATION), JSON.stringify({ ref: "1" }));
      assert.strictEqual(actual, null);
    });
  });
});
function assertConflicts(actual, expected) {
  assert.deepStrictEqual(actual.map(({ localResource }) => localResource.toString()), expected.map((uri) => uri.toString()));
}
function assertPreviews(actual, expected) {
  assert.deepStrictEqual(actual.map(({ localResource }) => localResource.toString()), expected.map((uri) => uri.toString()));
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vc3luY2hyb25pemVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBCYXJyaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsLCBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBBYnN0cmFjdFN5bmNocm9uaXNlciwgSUFjY2VwdFJlc3VsdCwgSU1lcmdlUmVzdWx0LCBJUmVzb3VyY2VQcmV2aWV3LCBTeW5jU3RyYXRlZ3kgfSBmcm9tICcuLi8uLi9jb21tb24vYWJzdHJhY3RTeW5jaHJvbml6ZXIuanMnO1xuaW1wb3J0IHsgQ2hhbmdlLCBJUmVtb3RlVXNlckRhdGEsIElSZXNvdXJjZVByZXZpZXcgYXMgSUJhc2VSZXNvdXJjZVByZXZpZXcsIElVc2VyRGF0YVJlc291cmNlTWFuaWZlc3QsIElVc2VyRGF0YVN5bmNDb25maWd1cmF0aW9uLCBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLCBNZXJnZVN0YXRlLCBTeW5jUmVzb3VyY2UsIFN5bmNTdGF0dXMsIFVTRVJfREFUQV9TWU5DX1NDSEVNRSB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jQ2xpZW50LCBVc2VyRGF0YVN5bmNUZXN0U2VydmVyIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNDbGllbnQuanMnO1xuXG5pbnRlcmZhY2UgSVRlc3RSZXNvdXJjZVByZXZpZXcgZXh0ZW5kcyBJUmVzb3VyY2VQcmV2aWV3IHtcblx0cmVmOiBzdHJpbmc7XG59XG5cbmNsYXNzIFRlc3RTeW5jaHJvbmlzZXIgZXh0ZW5kcyBBYnN0cmFjdFN5bmNocm9uaXNlciB7XG5cblx0c3luY0JhcnJpZXI6IEJhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXHRzeW5jUmVzdWx0OiB7IGhhc0NvbmZsaWN0czogYm9vbGVhbjsgaGFzRXJyb3I6IGJvb2xlYW4gfSA9IHsgaGFzQ29uZmxpY3RzOiBmYWxzZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdG9uRG9TeW5jQ2FsbDogRW1pdHRlcjx2b2lkPiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRmYWlsV2hlbkdldHRpbmdMYXRlc3RSZW1vdGVVc2VyRGF0YTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByb3RlY3RlZCByZWFkb25seSB2ZXJzaW9uOiBudW1iZXIgPSAxO1xuXG5cdHByaXZhdGUgY2FuY2VsbGVkOiBib29sZWFuID0gZmFsc2U7XG5cdHJlYWRvbmx5IGxvY2FsUmVzb3VyY2UgPSBqb2luUGF0aCh0aGlzLmVudmlyb25tZW50U2VydmljZS51c2VyUm9hbWluZ0RhdGFIb21lLCAndGVzdFJlc291cmNlLmpzb24nKTtcblxuXHRnZXRNYWNoaW5lSWQoKTogUHJvbWlzZTxzdHJpbmc+IHsgcmV0dXJuIHRoaXMuY3VycmVudE1hY2hpbmVJZFByb21pc2U7IH1cblx0Z2V0TGFzdFN5bmNSZXNvdXJjZSgpOiBVUkkgeyByZXR1cm4gdGhpcy5sYXN0U3luY1Jlc291cmNlOyB9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldExhdGVzdFJlbW90ZVVzZXJEYXRhKG1hbmlmZXN0OiBJVXNlckRhdGFSZXNvdXJjZU1hbmlmZXN0IHwgbnVsbCwgbGFzdFN5bmNVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhIHwgbnVsbCk6IFByb21pc2U8SVJlbW90ZVVzZXJEYXRhPiB7XG5cdFx0aWYgKHRoaXMuZmFpbFdoZW5HZXR0aW5nTGF0ZXN0UmVtb3RlVXNlckRhdGEpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdH1cblx0XHRyZXR1cm4gc3VwZXIuZ2V0TGF0ZXN0UmVtb3RlVXNlckRhdGEobWFuaWZlc3QsIGxhc3RTeW5jVXNlckRhdGEpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGFzeW5jIGRvU3luYyhyZW1vdGVVc2VyRGF0YTogSVJlbW90ZVVzZXJEYXRhLCBsYXN0U3luY1VzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEgfCBudWxsLCBzdHJhdGVneTogU3luY1N0cmF0ZWd5LCB1c2VyRGF0YVN5bmNDb25maWd1cmF0aW9uOiBJVXNlckRhdGFTeW5jQ29uZmlndXJhdGlvbik6IFByb21pc2U8U3luY1N0YXR1cz4ge1xuXHRcdHRoaXMuY2FuY2VsbGVkID0gZmFsc2U7XG5cdFx0dGhpcy5vbkRvU3luY0NhbGwuZmlyZSgpO1xuXHRcdGF3YWl0IHRoaXMuc3luY0JhcnJpZXIud2FpdCgpO1xuXG5cdFx0aWYgKHRoaXMuY2FuY2VsbGVkKSB7XG5cdFx0XHRyZXR1cm4gU3luY1N0YXR1cy5JZGxlO1xuXHRcdH1cblxuXHRcdHJldHVybiBzdXBlci5kb1N5bmMocmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGEsIHN0cmF0ZWd5LCB1c2VyRGF0YVN5bmNDb25maWd1cmF0aW9uKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBnZW5lcmF0ZVN5bmNQcmV2aWV3KHJlbW90ZVVzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEpOiBQcm9taXNlPElUZXN0UmVzb3VyY2VQcmV2aWV3W10+IHtcblx0XHRpZiAodGhpcy5zeW5jUmVzdWx0Lmhhc0Vycm9yKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2ZhaWxlZCcpO1xuXHRcdH1cblxuXHRcdGxldCBmaWxlQ29udGVudCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdGZpbGVDb250ZW50ID0gYXdhaXQgdGhpcy5maWxlU2VydmljZS5yZWFkRmlsZSh0aGlzLmxvY2FsUmVzb3VyY2UpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7IH1cblxuXHRcdHJldHVybiBbe1xuXHRcdFx0YmFzZVJlc291cmNlOiB0aGlzLmxvY2FsUmVzb3VyY2Uud2l0aCgoeyBzY2hlbWU6IFVTRVJfREFUQV9TWU5DX1NDSEVNRSwgYXV0aG9yaXR5OiAnYmFzZScgfSkpLFxuXHRcdFx0YmFzZUNvbnRlbnQ6IG51bGwsXG5cdFx0XHRsb2NhbFJlc291cmNlOiB0aGlzLmxvY2FsUmVzb3VyY2UsXG5cdFx0XHRsb2NhbENvbnRlbnQ6IGZpbGVDb250ZW50ID8gZmlsZUNvbnRlbnQudmFsdWUudG9TdHJpbmcoKSA6IG51bGwsXG5cdFx0XHRyZW1vdGVSZXNvdXJjZTogdGhpcy5sb2NhbFJlc291cmNlLndpdGgoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ3JlbW90ZScgfSkpLFxuXHRcdFx0cmVtb3RlQ29udGVudDogcmVtb3RlVXNlckRhdGEuc3luY0RhdGEgPyByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YS5jb250ZW50IDogbnVsbCxcblx0XHRcdHByZXZpZXdSZXNvdXJjZTogdGhpcy5sb2NhbFJlc291cmNlLndpdGgoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ3ByZXZpZXcnIH0pKSxcblx0XHRcdHJlZjogcmVtb3RlVXNlckRhdGEucmVmLFxuXHRcdFx0bG9jYWxDaGFuZ2U6IENoYW5nZS5Nb2RpZmllZCxcblx0XHRcdHJlbW90ZUNoYW5nZTogQ2hhbmdlLk1vZGlmaWVkLFxuXHRcdFx0YWNjZXB0ZWRSZXNvdXJjZTogdGhpcy5sb2NhbFJlc291cmNlLndpdGgoKHsgc2NoZW1lOiBVU0VSX0RBVEFfU1lOQ19TQ0hFTUUsIGF1dGhvcml0eTogJ2FjY2VwdGVkJyB9KSksXG5cdFx0fV07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgaGFzUmVtb3RlQ2hhbmdlZChsYXN0U3luY1VzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBnZXRNZXJnZVJlc3VsdChyZXNvdXJjZVByZXZpZXc6IElUZXN0UmVzb3VyY2VQcmV2aWV3LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElNZXJnZVJlc3VsdD4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRjb250ZW50OiByZXNvdXJjZVByZXZpZXcucmVmLFxuXHRcdFx0bG9jYWxDaGFuZ2U6IENoYW5nZS5Nb2RpZmllZCxcblx0XHRcdHJlbW90ZUNoYW5nZTogQ2hhbmdlLk1vZGlmaWVkLFxuXHRcdFx0aGFzQ29uZmxpY3RzOiB0aGlzLnN5bmNSZXN1bHQuaGFzQ29uZmxpY3RzLFxuXHRcdH07XG5cdH1cblxuXHRwcm90ZWN0ZWQgYXN5bmMgZ2V0QWNjZXB0UmVzdWx0KHJlc291cmNlUHJldmlldzogSVRlc3RSZXNvdXJjZVByZXZpZXcsIHJlc291cmNlOiBVUkksIGNvbnRlbnQ6IHN0cmluZyB8IG51bGwgfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUFjY2VwdFJlc3VsdD4ge1xuXG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHJlc291cmNlUHJldmlldy5sb2NhbFJlc291cmNlKSkge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29udGVudDogcmVzb3VyY2VQcmV2aWV3LmxvY2FsQ29udGVudCxcblx0XHRcdFx0bG9jYWxDaGFuZ2U6IENoYW5nZS5Ob25lLFxuXHRcdFx0XHRyZW1vdGVDaGFuZ2U6IHJlc291cmNlUHJldmlldy5sb2NhbENvbnRlbnQgPT09IG51bGwgPyBDaGFuZ2UuRGVsZXRlZCA6IENoYW5nZS5Nb2RpZmllZCxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHJlc291cmNlUHJldmlldy5yZW1vdGVSZXNvdXJjZSkpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGNvbnRlbnQ6IHJlc291cmNlUHJldmlldy5yZW1vdGVDb250ZW50LFxuXHRcdFx0XHRsb2NhbENoYW5nZTogcmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQgPT09IG51bGwgPyBDaGFuZ2UuRGVsZXRlZCA6IENoYW5nZS5Nb2RpZmllZCxcblx0XHRcdFx0cmVtb3RlQ2hhbmdlOiBDaGFuZ2UuTm9uZSxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKGlzRXF1YWwocmVzb3VyY2UsIHJlc291cmNlUHJldmlldy5wcmV2aWV3UmVzb3VyY2UpKSB7XG5cdFx0XHRpZiAoY29udGVudCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Y29udGVudDogcmVzb3VyY2VQcmV2aWV3LnJlZixcblx0XHRcdFx0XHRsb2NhbENoYW5nZTogQ2hhbmdlLk1vZGlmaWVkLFxuXHRcdFx0XHRcdHJlbW90ZUNoYW5nZTogQ2hhbmdlLk1vZGlmaWVkLFxuXHRcdFx0XHR9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRjb250ZW50LFxuXHRcdFx0XHRcdGxvY2FsQ2hhbmdlOiBjb250ZW50ID09PSBudWxsID8gcmVzb3VyY2VQcmV2aWV3LmxvY2FsQ29udGVudCAhPT0gbnVsbCA/IENoYW5nZS5EZWxldGVkIDogQ2hhbmdlLk5vbmUgOiBDaGFuZ2UuTW9kaWZpZWQsXG5cdFx0XHRcdFx0cmVtb3RlQ2hhbmdlOiBjb250ZW50ID09PSBudWxsID8gcmVzb3VyY2VQcmV2aWV3LnJlbW90ZUNvbnRlbnQgIT09IG51bGwgPyBDaGFuZ2UuRGVsZXRlZCA6IENoYW5nZS5Ob25lIDogQ2hhbmdlLk1vZGlmaWVkLFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBSZXNvdXJjZTogJHtyZXNvdXJjZS50b1N0cmluZygpfWApO1xuXHR9XG5cblx0cHJvdGVjdGVkIGFzeW5jIGFwcGx5UmVzdWx0KHJlbW90ZVVzZXJEYXRhOiBJUmVtb3RlVXNlckRhdGEsIGxhc3RTeW5jVXNlckRhdGE6IElSZW1vdGVVc2VyRGF0YSB8IG51bGwsIHJlc291cmNlUHJldmlld3M6IFtJUmVzb3VyY2VQcmV2aWV3LCBJQWNjZXB0UmVzdWx0XVtdLCBmb3JjZTogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChyZXNvdXJjZVByZXZpZXdzWzBdWzFdLmxvY2FsQ2hhbmdlID09PSBDaGFuZ2UuRGVsZXRlZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5kZWwodGhpcy5sb2NhbFJlc291cmNlKTtcblx0XHR9XG5cblx0XHRpZiAocmVzb3VyY2VQcmV2aWV3c1swXVsxXS5sb2NhbENoYW5nZSA9PT0gQ2hhbmdlLkFkZGVkIHx8IHJlc291cmNlUHJldmlld3NbMF1bMV0ubG9jYWxDaGFuZ2UgPT09IENoYW5nZS5Nb2RpZmllZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS53cml0ZUZpbGUodGhpcy5sb2NhbFJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKHJlc291cmNlUHJldmlld3NbMF1bMV0uY29udGVudCEpKTtcblx0XHR9XG5cblx0XHRpZiAocmVzb3VyY2VQcmV2aWV3c1swXVsxXS5yZW1vdGVDaGFuZ2UgPT09IENoYW5nZS5EZWxldGVkKSB7XG5cdFx0XHRhd2FpdCB0aGlzLmFwcGx5UmVmKG51bGwsIHJlbW90ZVVzZXJEYXRhLnJlZik7XG5cdFx0fVxuXG5cdFx0aWYgKHJlc291cmNlUHJldmlld3NbMF1bMV0ucmVtb3RlQ2hhbmdlID09PSBDaGFuZ2UuQWRkZWQgfHwgcmVzb3VyY2VQcmV2aWV3c1swXVsxXS5yZW1vdGVDaGFuZ2UgPT09IENoYW5nZS5Nb2RpZmllZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5hcHBseVJlZihyZXNvdXJjZVByZXZpZXdzWzBdWzFdLmNvbnRlbnQsIHJlbW90ZVVzZXJEYXRhLnJlZik7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYXBwbHlSZWYoY29udGVudDogc3RyaW5nIHwgbnVsbCwgcmVmOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRoaXMudXBkYXRlUmVtb3RlVXNlckRhdGEoY29udGVudCA9PT0gbnVsbCA/ICcnIDogY29udGVudCwgcmVmKTtcblx0XHRhd2FpdCB0aGlzLnVwZGF0ZUxhc3RTeW5jVXNlckRhdGEocmVtb3RlVXNlckRhdGEpO1xuXHR9XG5cblx0b3ZlcnJpZGUgYXN5bmMgc3RvcCgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmNhbmNlbGxlZCA9IHRydWU7XG5cdFx0dGhpcy5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0c3VwZXIuc3RvcCgpO1xuXHR9XG5cblx0dGVzdFRyaWdnZXJMb2NhbENoYW5nZSgpOiB2b2lkIHtcblx0XHR0aGlzLnRyaWdnZXJMb2NhbENoYW5nZSgpO1xuXHR9XG5cblx0b25EaWRUcmlnZ2VyTG9jYWxDaGFuZ2VDYWxsOiBFbWl0dGVyPHZvaWQ+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHByb3RlY3RlZCBvdmVycmlkZSBhc3luYyBkb1RyaWdnZXJMb2NhbENoYW5nZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCBzdXBlci5kb1RyaWdnZXJMb2NhbENoYW5nZSgpO1xuXHRcdHRoaXMub25EaWRUcmlnZ2VyTG9jYWxDaGFuZ2VDYWxsLmZpcmUoKTtcblx0fVxuXG5cdGhhc0xvY2FsRGF0YSgpOiBQcm9taXNlPGJvb2xlYW4+IHsgdGhyb3cgbmV3IEVycm9yKCdub3QgaW1wbGVtZW50ZWQnKTsgfVxuXHRhc3luYyByZXNvbHZlQ29udGVudCh1cmk6IFVSSSk6IFByb21pc2U8c3RyaW5nIHwgbnVsbD4geyByZXR1cm4gbnVsbDsgfVxufVxuXG5zdWl0ZSgnVGVzdFN5bmNocm9uaXplciAtIEF1dG8gU3luYycsICgpID0+IHtcblxuXHRjb25zdCBzZXJ2ZXIgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXHRsZXQgY2xpZW50OiBVc2VyRGF0YVN5bmNDbGllbnQ7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSkuY2xlYXIoKTtcblx0fSk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNsaWVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRhd2FpdCBjbGllbnQuc2V0VXAoKTtcblx0fSk7XG5cblx0dGVzdCgnc3RhdHVzIGlzIHN5bmNpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXG5cdFx0XHRjb25zdCBhY3R1YWw6IFN5bmNTdGF0dXNbXSA9IFtdO1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlU3RhdHVzKHN0YXR1cyA9PiBhY3R1YWwucHVzaChzdGF0dXMpKSk7XG5cblx0XHRcdGNvbnN0IHByb21pc2UgPSBFdmVudC50b1Byb21pc2UodGVzdE9iamVjdC5vbkRvU3luY0NhbGwuZXZlbnQpO1xuXG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRhd2FpdCBwcm9taXNlO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1N5bmNTdGF0dXMuU3luY2luZ10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblxuXHRcdFx0dGVzdE9iamVjdC5zdG9wKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXR1cyBpcyBzZXQgY29ycmVjdGx5IHdoZW4gc3luYyBpcyBmaW5pc2hlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0Y29uc3QgYWN0dWFsOiBTeW5jU3RhdHVzW10gPSBbXTtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZVN0YXR1cyhzdGF0dXMgPT4gYWN0dWFsLnB1c2goc3RhdHVzKSkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1N5bmNTdGF0dXMuU3luY2luZywgU3luY1N0YXR1cy5JZGxlXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzdGF0dXMgaXMgc2V0IGNvcnJlY3RseSB3aGVuIHN5bmMgaGFzIGVycm9ycycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0Vycm9yOiB0cnVlLCBoYXNDb25mbGljdHM6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0Y29uc3QgYWN0dWFsOiBTeW5jU3RhdHVzW10gPSBbXTtcblx0XHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdE9iamVjdC5vbkRpZENoYW5nZVN0YXR1cyhzdGF0dXMgPT4gYWN0dWFsLnB1c2goc3RhdHVzKSkpO1xuXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRcdGFzc2VydC5mYWlsKCdTaG91bGQgZmFpbCcpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1N5bmNTdGF0dXMuU3luY2luZywgU3luY1N0YXR1cy5JZGxlXSk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YXR1cyBpcyBzZXQgdG8gaGFzQ29uZmxpY3RzIHdoZW4gYXNrZWQgdG8gc3luYyBpZiB0aGVyZSBhcmUgY29uZmxpY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFt0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2VdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBzaG91bGQgbm90IHJ1biBpZiBzeW5jaW5nIGFscmVhZHknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRG9TeW5jQ2FsbC5ldmVudCk7XG5cblx0XHRcdHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGF3YWl0IHByb21pc2U7XG5cblx0XHRcdGNvbnN0IGFjdHVhbDogU3luY1N0YXR1c1tdID0gW107XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VTdGF0dXMoc3RhdHVzID0+IGFjdHVhbC5wdXNoKHN0YXR1cykpKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3RvcCgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIHNob3VsZCBub3QgcnVuIGlmIHRoZXJlIGFyZSBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IHRydWUsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IGFjdHVhbDogU3luY1N0YXR1c1tdID0gW107XG5cdFx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RPYmplY3Qub25EaWRDaGFuZ2VTdGF0dXMoc3RhdHVzID0+IGFjdHVhbC5wdXNoKHN0YXR1cykpKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYWNjZXB0IHByZXZpZXcgZHVyaW5nIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogdHJ1ZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhY2NlcHQgcmVtb3RlIGR1cmluZyBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGN1cnJlbnRSZW1vdGVDb250ZW50ID0gKGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCkpLnN5bmNEYXRhPy5jb250ZW50O1xuXHRcdFx0Y29uc3QgbmV3TG9jYWxDb250ZW50ID0gJ2NvbmZsaWN0Jztcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcobmV3TG9jYWxDb250ZW50KSk7XG5cblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLnJlbW90ZVJlc291cmNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKSkuc3luY0RhdGE/LmNvbnRlbnQsIGN1cnJlbnRSZW1vdGVDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKSwgY3VycmVudFJlbW90ZUNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhY2NlcHQgbG9jYWwgZHVyaW5nIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgbmV3TG9jYWxDb250ZW50ID0gJ2NvbmZsaWN0Jztcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcobmV3TG9jYWxDb250ZW50KSk7XG5cblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLmxvY2FsUmVzb3VyY2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgbmV3TG9jYWxDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKSwgbmV3TG9jYWxDb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYWNjZXB0IG5ldyBjb250ZW50IGR1cmluZyBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5ld0xvY2FsQ29udGVudCA9ICdjb25mbGljdCc7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKG5ld0xvY2FsQ29udGVudCkpO1xuXG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogdHJ1ZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cblx0XHRcdGNvbnN0IG1lcmdlQ29udGVudCA9ICduZXdDb250ZW50Jztcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIG1lcmdlQ29udGVudCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCkpLnN5bmNEYXRhPy5jb250ZW50LCBtZXJnZUNvbnRlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBmaWxlU2VydmljZS5yZWFkRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBtZXJnZUNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhY2NlcHQgZGVsZXRlIGR1cmluZyBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG5ld0xvY2FsQ29udGVudCA9ICdjb25mbGljdCc7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKG5ld0xvY2FsQ29udGVudCkpO1xuXG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogdHJ1ZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIG51bGwpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgJycpO1xuXHRcdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYWNjZXB0IGRlbGV0ZWQgbG9jYWwgZHVyaW5nIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuZGVsKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSk7XG5cblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLmxvY2FsUmVzb3VyY2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgJycpO1xuXHRcdFx0YXNzZXJ0Lm9rKCEoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnYWNjZXB0IGRlbGV0ZWQgcmVtb3RlIGR1cmluZyBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3NvbWUgY29udGVudCcpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YSwgbnVsbCk7XG5cdFx0XHRhc3NlcnQub2soIShhd2FpdCBmaWxlU2VydmljZS5leGlzdHModGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXF1ZXN0IGxhdGVzdCBkYXRhIG9uIHByZWNvbmRpdGlvbiBmYWlsdXJlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdC8vIFN5bmMgb25jZVxuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyID0gbmV3IEJhcnJpZXIoKTtcblxuXHRcdFx0Ly8gdXBkYXRlIHJlbW90ZSBkYXRhIGJlZm9yZSBzeW5jaW5nIHNvIHRoYXQgNDEyIGlzIHRocm93biBieSBzZXJ2ZXJcblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0ZXN0T2JqZWN0Lm9uRG9TeW5jQ2FsbC5ldmVudChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5UmVmKHJlZiwgcmVmKTtcblx0XHRcdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXHRcdFx0fSk7XG5cblx0XHRcdC8vIFN0YXJ0IHN5Y2luZ1xuXHRcdFx0Y29uc3QgbWFuaWZlc3QgPSBhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpO1xuXHRcdFx0Y29uc3QgcmVmID0gbWFuaWZlc3QhW3Rlc3RPYmplY3QucmVzb3VyY2VdO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW1xuXHRcdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHtzZXJ2ZXIudXJsfS92MS9yZXNvdXJjZS8ke3Rlc3RPYmplY3QucmVzb3VyY2V9YCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiByZWYgfSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3NlcnZlci51cmx9L3YxL3Jlc291cmNlLyR7dGVzdE9iamVjdC5yZXNvdXJjZX0vbGF0ZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7c2VydmVyLnVybH0vdjEvcmVzb3VyY2UvJHt0ZXN0T2JqZWN0LnJlc291cmNlfWAsIGhlYWRlcnM6IHsgJ0lmLU1hdGNoJzogYCR7cGFyc2VJbnQocmVmKSArIDF9YCB9IH0sXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbm8gcmVxdWVzdHMgYXJlIG1hZGUgdG8gc2VydmVyIHdoZW4gbG9jYWwgY2hhbmdlIGlzIHRyaWdnZXJlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0XHRjb25zdCBwcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKHRlc3RPYmplY3Qub25EaWRUcmlnZ2VyTG9jYWxDaGFuZ2VDYWxsLmV2ZW50KTtcblx0XHRcdHRlc3RPYmplY3QudGVzdFRyaWdnZXJMb2NhbENoYW5nZSgpO1xuXG5cdFx0XHRhd2FpdCBwcm9taXNlO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc3RhdHVzIGlzIHJlc2V0IHdoZW4gZ2V0dGluZyBsYXRlc3QgcmVtb3RlIGRhdGEgZmFpbHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5mYWlsV2hlbkdldHRpbmdMYXRlc3RSZW1vdGVVc2VyRGF0YSA9IHRydWU7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdFx0YXNzZXJ0LmZhaWwoJ1Nob3VsZCB0aHJvdyBhbiBlcnJvcicpO1xuXHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdH1cblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnVGVzdFN5bmNocm9uaXplciAtIE1hbnVhbCBTeW5jJywgKCkgPT4ge1xuXG5cdGNvbnN0IHNlcnZlciA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdGxldCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudDtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlKS5jbGVhcigpO1xuXHR9KTtcblxuXHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzZXR1cChhc3luYyAoKSA9PiB7XG5cdFx0Y2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdGF3YWl0IGNsaWVudC5zZXRVcCgpO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmV2aWV3JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiBmYWxzZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0Y29uc3QgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsIFt0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2VdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLm1lcmdlU3RhdGUsIE1lcmdlU3RhdGUuQWNjZXB0ZWQpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmV2aWV3IC0+IGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubG9jYWxSZXNvdXJjZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLCBbdGVzdE9iamVjdC5sb2NhbFJlc291cmNlXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5tZXJnZVN0YXRlLCBNZXJnZVN0YXRlLkFjY2VwdGVkKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncHJldmlldyAtPiBtZXJnZSAtPiBhcHBseScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0LCB0cnVlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0Y29uc3QgZXhwZWN0ZWRDb250ZW50ID0gbWFuaWZlc3QhW3Rlc3RPYmplY3QucmVzb3VyY2VdO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgZXhwZWN0ZWRDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZXZpZXcgLT4gYWNjZXB0IC0+IGFwcGx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiBmYWxzZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0Y29uc3QgbWFuaWZlc3QgPSBhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRDb250ZW50ID0gbWFuaWZlc3QhW3Rlc3RPYmplY3QucmVzb3VyY2VdO1xuXHRcdFx0bGV0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMobWFuaWZlc3QsIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgZXhwZWN0ZWRDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZWl2ZXcgLT4gZGlzY2FyZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuZGlzY2FyZChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLCBbdGVzdE9iamVjdC5sb2NhbFJlc291cmNlXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5tZXJnZVN0YXRlLCBNZXJnZVN0YXRlLlByZXZpZXcpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmVpdmV3IC0+IGRpc2NhcmQgLT4gYWNjZXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiBmYWxzZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0bGV0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cdFx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5kaXNjYXJkKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnJlbW90ZVJlc291cmNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsIFt0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2VdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLm1lcmdlU3RhdGUsIE1lcmdlU3RhdGUuQWNjZXB0ZWQpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmVpdmV3IC0+IGFjY2VwdCAtPiBkaXNjYXJkIC0+IGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cywgW3Rlc3RPYmplY3QubG9jYWxSZXNvdXJjZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubWVyZ2VTdGF0ZSwgTWVyZ2VTdGF0ZS5BY2NlcHRlZCk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZWl2ZXcgLT4gYWNjZXB0IC0+IGRpc2NhcmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IGZhbHNlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnJlbW90ZVJlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cywgW3Rlc3RPYmplY3QubG9jYWxSZXNvdXJjZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubWVyZ2VTdGF0ZSwgTWVyZ2VTdGF0ZS5QcmV2aWV3KTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgncHJlaXZldyAtPiBkaXNjYXJkIC0+IGFjY2VwdCAtPiBhcHBseScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IGV4cGVjdGVkQ29udGVudCA9IChhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkucmVhZEZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuZGlzY2FyZChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cdFx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hY2NlcHQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5sb2NhbFJlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKSkuc3luY0RhdGE/LmNvbnRlbnQsIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKS5yZWFkRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBleHBlY3RlZENvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25mbGljdHM6IHByZXZpZXcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IHRydWUsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsIFt0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2VdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLm1lcmdlU3RhdGUsIE1lcmdlU3RhdGUuQ29uZmxpY3QpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW3ByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubG9jYWxSZXNvdXJjZV0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25mbGljdHM6IHByZXZpZXcgLT4gZGlzY2FyZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogdHJ1ZSwgaGFzRXJyb3I6IGZhbHNlIH07XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0Y29uc3QgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuZGlzY2FyZChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLCBbdGVzdE9iamVjdC5sb2NhbFJlc291cmNlXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5tZXJnZVN0YXRlLCBNZXJnZVN0YXRlLlByZXZpZXcpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25mbGljdHM6IHByZXZpZXcgLT4gYWNjZXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCB0ZXN0T2JqZWN0LnJlc29sdmVDb250ZW50KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSwgY29udGVudCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLCBbdGVzdE9iamVjdC5sb2NhbFJlc291cmNlXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25mbGljdHM6IHByZXZpZXcgLT4gYWNjZXB0IDInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IHRydWUsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IHRlc3RPYmplY3QucmVzb2x2ZUNvbnRlbnQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlLCBjb250ZW50KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsIFt0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2VdKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmxpY3RzOiBwcmV2aWV3IC0+IGFjY2VwdCAtPiBhcHBseScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkQ29udGVudCA9IG1hbmlmZXN0IVt0ZXN0T2JqZWN0LnJlc291cmNlXTtcblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0LCB0cnVlKTtcblxuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpKS5zeW5jRGF0YT8uY29udGVudCwgZXhwZWN0ZWRDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZsaWN0czogcHJlaXZldyAtPiBkaXNjYXJkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cywgW3Rlc3RPYmplY3QubG9jYWxSZXNvdXJjZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubWVyZ2VTdGF0ZSwgTWVyZ2VTdGF0ZS5QcmV2aWV3KTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmxpY3RzOiBwcmVpdmV3IC0+IGRpc2NhcmQgLT4gYWNjZXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY1Jlc3VsdCA9IHsgaGFzQ29uZmxpY3RzOiB0cnVlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cywgW3Rlc3RPYmplY3QubG9jYWxSZXNvdXJjZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubWVyZ2VTdGF0ZSwgTWVyZ2VTdGF0ZS5BY2NlcHRlZCk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZsaWN0czogcHJlaXZldyAtPiBhY2NlcHQgLT4gZGlzY2FyZCAtPiBhY2NlcHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IHRydWUsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cywgW3Rlc3RPYmplY3QubG9jYWxSZXNvdXJjZV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubWVyZ2VTdGF0ZSwgTWVyZ2VTdGF0ZS5BY2NlcHRlZCk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZsaWN0czogcHJlaXZldyAtPiBhY2NlcHQgLT4gZGlzY2FyZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuZGlzY2FyZChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuU3luY2luZyk7XG5cdFx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLCBbdGVzdE9iamVjdC5sb2NhbFJlc291cmNlXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5tZXJnZVN0YXRlLCBNZXJnZVN0YXRlLlByZXZpZXcpO1xuXHRcdFx0YXNzZXJ0Q29uZmxpY3RzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdjb25mbGljdHM6IHByZWl2ZXcgLT4gZGlzY2FyZCAtPiBhY2NlcHQgLT4gYXBwbHknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jUmVzdWx0ID0geyBoYXNDb25mbGljdHM6IGZhbHNlLCBoYXNFcnJvcjogZmFsc2UgfTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBleHBlY3RlZENvbnRlbnQgPSAoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmRpc2NhcmQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ubG9jYWxSZXNvdXJjZSk7XG5cdFx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJldmlldywgbnVsbCk7XG5cdFx0XHRhc3NlcnRDb25mbGljdHModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCkpLnN5bmNEYXRhPy5jb250ZW50LCBleHBlY3RlZENvbnRlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkucmVhZEZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKSwgZXhwZWN0ZWRDb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnY29uZmxpY3RzOiBwcmVpdmV3IC0+IGFjY2VwdCAtPiBkaXNjYXJkIC0+IGFjY2VwdCAtPiBhcHBseScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNSZXN1bHQgPSB7IGhhc0NvbmZsaWN0czogZmFsc2UsIGhhc0Vycm9yOiBmYWxzZSB9O1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IGV4cGVjdGVkQ29udGVudCA9IChhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkucmVhZEZpbGUodGVzdE9iamVjdC5sb2NhbFJlc291cmNlKSkudmFsdWUudG9TdHJpbmcoKTtcblx0XHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuZGlzY2FyZChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cdFx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hY2NlcHQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5sb2NhbFJlc291cmNlKTtcblx0XHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRcdGFzc2VydENvbmZsaWN0cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKSkuc3luY0RhdGE/LmNvbnRlbnQsIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKS5yZWFkRmlsZSh0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBleHBlY3RlZENvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdyZW1vdGUgaXMgYWNjZXB0ZWQgaWYgbGFzdCBzeW5jIHN0YXRlIGRvZXMgbm90IGV4aXN0cyBpbiBzZXJ2ZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCgpO1xuXHRcdFx0Y29uc3Qgc3luY2hyb25pemVyMjogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0c3luY2hyb25pemVyMi5zeW5jQmFycmllci5vcGVuKCk7XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGNsaWVudDIuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRDb250ZW50ID0gbWFuaWZlc3QhW3Rlc3RPYmplY3QucmVzb3VyY2VdO1xuXHRcdFx0YXdhaXQgc3luY2hyb25pemVyMi5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuZGVsKHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNSZXNvdXJjZSgpKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLnJlYWRGaWxlKHRlc3RPYmplY3QubG9jYWxSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGV4cGVjdGVkQ29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG59KTtcblxuc3VpdGUoJ1Rlc3RTeW5jaHJvbml6ZXIgLSBMYXN0IFN5bmMgRGF0YScsICgpID0+IHtcblx0Y29uc3Qgc2VydmVyID0gbmV3IFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIoKTtcblx0bGV0IGNsaWVudDogVXNlckRhdGFTeW5jQ2xpZW50O1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50LnNldFVwKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2xhc3Qgc3luYyBkYXRhIGlzIG51bGwgd2hlbiBub3Qgc3luY2VkIGJlZm9yZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBudWxsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbGFzdCBzeW5jIGRhdGEgaXMgc2V0IGFmdGVyIHN5bmMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBtYWNoaW5lSWQgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldE1hY2hpbmVJZCgpO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3RvcmFnZVNlcnZpY2UuZ2V0KCdzZXR0aW5ncy5sYXN0U3luY1VzZXJEYXRhJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKSwgSlNPTi5zdHJpbmdpZnkoeyByZWY6ICcxJyB9KSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKEpTT04ucGFyc2UoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNSZXNvdXJjZSgpKSkudmFsdWUudG9TdHJpbmcoKSksIHsgcmVmOiAnMScsIHN5bmNEYXRhOiB7IHZlcnNpb246IDEsIG1hY2hpbmVJZCwgY29udGVudDogJzAnIH0gfSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwge1xuXHRcdFx0XHRyZWY6ICcxJyxcblx0XHRcdFx0c3luY0RhdGE6IHtcblx0XHRcdFx0XHRjb250ZW50OiAnMCcsXG5cdFx0XHRcdFx0bWFjaGluZUlkLFxuXHRcdFx0XHRcdHZlcnNpb246IDFcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdsYXN0IHN5bmMgZGF0YSBpcyByZWFkIGZyb20gc2VydmVyIGFmdGVyIHN5bmMgaWYgbGFzdCBzeW5jIHJlc291cmNlIGlzIGRlbGV0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBtYWNoaW5lSWQgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldE1hY2hpbmVJZCgpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UuZGVsKHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNSZXNvdXJjZSgpKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0b3JhZ2VTZXJ2aWNlLmdldCgnc2V0dGluZ3MubGFzdFN5bmNVc2VyRGF0YScsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiksIEpTT04uc3RyaW5naWZ5KHsgcmVmOiAnMScgfSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdFx0cmVmOiAnMScsXG5cdFx0XHRcdHN5bmNEYXRhOiB7XG5cdFx0XHRcdFx0Y29udGVudDogJzAnLFxuXHRcdFx0XHRcdG1hY2hpbmVJZCxcblx0XHRcdFx0XHR2ZXJzaW9uOiAxXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbGFzdCBzeW5jIGRhdGEgaXMgcmVhZCBmcm9tIHNlcnZlciBhZnRlciBzeW5jIGFuZCBzeW5jIGRhdGEgaXMgaW52YWxpZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGNvbnN0IG1hY2hpbmVJZCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TWFjaGluZUlkKCk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodGVzdE9iamVjdC5nZXRMYXN0U3luY1Jlc291cmNlKCksIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRyZWY6ICcxJyxcblx0XHRcdFx0dmVyc2lvbjogMSxcblx0XHRcdFx0Y29udGVudDogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICcwJyxcblx0XHRcdFx0XHRtYWNoaW5lSWQsXG5cdFx0XHRcdFx0dmVyc2lvbjogMVxuXHRcdFx0XHR9KSxcblx0XHRcdFx0YWRkaXRpb25hbERhdGE6IHtcblx0XHRcdFx0XHRmb286ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH0pKSk7XG5cdFx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0b3JhZ2VTZXJ2aWNlLmdldCgnc2V0dGluZ3MubGFzdFN5bmNVc2VyRGF0YScsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiksIEpTT04uc3RyaW5naWZ5KHsgcmVmOiAnMScgfSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdFx0cmVmOiAnMScsXG5cdFx0XHRcdHN5bmNEYXRhOiB7XG5cdFx0XHRcdFx0Y29udGVudDogJzAnLFxuXHRcdFx0XHRcdG1hY2hpbmVJZCxcblx0XHRcdFx0XHR2ZXJzaW9uOiAxXG5cdFx0XHRcdH0sXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbeyBoZWFkZXJzOiB7fSwgdHlwZTogJ0dFVCcsIHVybDogJ2h0dHA6Ly9ob3N0OjMwMDAvdjEvcmVzb3VyY2Uvc2V0dGluZ3MvMScgfV0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdsYXN0IHN5bmMgZGF0YSBpcyByZWFkIGZyb20gc2VydmVyIGFmdGVyIHN5bmMgYW5kIHN0b3JlZCBzeW5jIGRhdGEgaXMgdGFtcGVyZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRjb25zdCBtYWNoaW5lSWQgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldE1hY2hpbmVJZCgpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNSZXNvdXJjZSgpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0cmVmOiAnMicsXG5cdFx0XHRcdHN5bmNEYXRhOiB7XG5cdFx0XHRcdFx0Y29udGVudDogJzAnLFxuXHRcdFx0XHRcdG1hY2hpbmVJZCxcblx0XHRcdFx0XHR2ZXJzaW9uOiAxXG5cdFx0XHRcdH1cblx0XHRcdH0pKSk7XG5cdFx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHN0b3JhZ2VTZXJ2aWNlLmdldCgnc2V0dGluZ3MubGFzdFN5bmNVc2VyRGF0YScsIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTiksIEpTT04uc3RyaW5naWZ5KHsgcmVmOiAnMScgfSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHtcblx0XHRcdFx0cmVmOiAnMScsXG5cdFx0XHRcdHN5bmNEYXRhOiB7XG5cdFx0XHRcdFx0Y29udGVudDogJzAnLFxuXHRcdFx0XHRcdG1hY2hpbmVJZCxcblx0XHRcdFx0XHR2ZXJzaW9uOiAxXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFt7IGhlYWRlcnM6IHt9LCB0eXBlOiAnR0VUJywgdXJsOiAnaHR0cDovL2hvc3Q6MzAwMC92MS9yZXNvdXJjZS9zZXR0aW5ncy8xJyB9XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRpbmcgbGFzdCBzeW5jIGRhdGE6IG5vIHJlcXVlc3RzIGFyZSBtYWRlIHRvIHNlcnZlciB3aGVuIHN5bmMgZGF0YSBpcyBpbnZhbGlkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGNvbnN0IG1hY2hpbmVJZCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TWFjaGluZUlkKCk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodGVzdE9iamVjdC5nZXRMYXN0U3luY1Jlc291cmNlKCksIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRyZWY6ICcxJyxcblx0XHRcdFx0dmVyc2lvbjogMSxcblx0XHRcdFx0Y29udGVudDogSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICcwJyxcblx0XHRcdFx0XHRtYWNoaW5lSWQsXG5cdFx0XHRcdFx0dmVyc2lvbjogMVxuXHRcdFx0XHR9KSxcblx0XHRcdFx0YWRkaXRpb25hbERhdGE6IHtcblx0XHRcdFx0XHRmb286ICdiYXInXG5cdFx0XHRcdH1cblx0XHRcdH0pKSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRcdHNlcnZlci5yZXNldCgpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlYWRpbmcgbGFzdCBzeW5jIGRhdGE6IG5vIHJlcXVlc3RzIGFyZSBtYWRlIHRvIHNlcnZlciB3aGVuIHN5bmMgZGF0YSBpcyBudWxsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0U3luY2hyb25pc2VyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFN5bmNocm9uaXNlciwgeyBzeW5jUmVzb3VyY2U6IFN5bmNSZXNvdXJjZS5TZXR0aW5ncywgcHJvZmlsZTogY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlIH0sIHVuZGVmaW5lZCkpO1xuXHRcdFx0dGVzdE9iamVjdC5zeW5jQmFycmllci5vcGVuKCk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdHNlcnZlci5yZXNldCgpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNSZXNvdXJjZSgpLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0cmVmOiAnMScsXG5cdFx0XHRcdHN5bmNEYXRhOiBudWxsLFxuXHRcdFx0fSkpKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdsYXN0IHN5bmMgZGF0YSBpcyBudWxsIGFmdGVyIHN5bmMgaWYgbGFzdCBzeW5jIHN0YXRlIGlzIGRlbGV0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBzdG9yYWdlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVN0b3JhZ2VTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RTeW5jaHJvbmlzZXIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0U3luY2hyb25pc2VyLCB7IHN5bmNSZXNvdXJjZTogU3luY1Jlc291cmNlLlNldHRpbmdzLCBwcm9maWxlOiBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUgfSwgdW5kZWZpbmVkKSk7XG5cdFx0XHR0ZXN0T2JqZWN0LnN5bmNCYXJyaWVyLm9wZW4oKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdFx0c3RvcmFnZVNlcnZpY2UucmVtb3ZlKCdzZXR0aW5ncy5sYXN0U3luY1VzZXJEYXRhJywgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBudWxsKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbGFzdCBzeW5jIGRhdGEgaXMgbnVsbCBhZnRlciBzeW5jIGlmIGxhc3Qgc3luYyBjb250ZW50IGlzIGRlbGV0ZWQgZXZlcnl3aGVyZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHN0b3JhZ2VTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJU3RvcmFnZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB1c2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFN5bmNocm9uaXNlciA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RTeW5jaHJvbmlzZXIsIHsgc3luY1Jlc291cmNlOiBTeW5jUmVzb3VyY2UuU2V0dGluZ3MsIHByb2ZpbGU6IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSB9LCB1bmRlZmluZWQpKTtcblx0XHRcdHRlc3RPYmplY3Quc3luY0JhcnJpZXIub3BlbigpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS5kZWwodGVzdE9iamVjdC5nZXRMYXN0U3luY1Jlc291cmNlKCkpO1xuXHRcdFx0YXdhaXQgdXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLmRlbGV0ZVJlc291cmNlKHRlc3RPYmplY3Quc3luY1Jlc291cmNlLnN5bmNSZXNvdXJjZSwgbnVsbCk7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzdG9yYWdlU2VydmljZS5nZXQoJ3NldHRpbmdzLmxhc3RTeW5jVXNlckRhdGEnLCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pLCBKU09OLnN0cmluZ2lmeSh7IHJlZjogJzEnIH0pKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIG51bGwpO1xuXHRcdH0pO1xuXHR9KTtcblxufSk7XG5cbmZ1bmN0aW9uIGFzc2VydENvbmZsaWN0cyhhY3R1YWw6IElCYXNlUmVzb3VyY2VQcmV2aWV3W10sIGV4cGVjdGVkOiBVUklbXSkge1xuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5tYXAoKHsgbG9jYWxSZXNvdXJjZSB9KSA9PiBsb2NhbFJlc291cmNlLnRvU3RyaW5nKCkpLCBleHBlY3RlZC5tYXAodXJpID0+IHVyaS50b1N0cmluZygpKSk7XG59XG5cbmZ1bmN0aW9uIGFzc2VydFByZXZpZXdzKGFjdHVhbDogSUJhc2VSZXNvdXJjZVByZXZpZXdbXSwgZXhwZWN0ZWQ6IFVSSVtdKSB7XG5cdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLm1hcCgoeyBsb2NhbFJlc291cmNlIH0pID0+IGxvY2FsUmVzb3VyY2UudG9TdHJpbmcoKSksIGV4cGVjdGVkLm1hcCh1cmkgPT4gdXJpLnRvU3RyaW5nKCkpKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUyxTQUFTLGFBQWE7QUFDL0IsU0FBUyxTQUFTLGdCQUFnQjtBQUVsQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGlCQUFpQixvQkFBb0I7QUFDOUMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyw0QkFBeUY7QUFDbEcsU0FBUyxRQUEwSCwyQkFBMkIsWUFBWSxjQUFjLFlBQVksNkJBQTZCO0FBQ2pPLFNBQVMsb0JBQW9CLDhCQUE4QjtBQU0zRCxNQUFNLHlCQUF5QixxQkFBcUI7QUFBQSxFQUFwRDtBQUFBO0FBRUMsdUJBQXVCLElBQUksUUFBUTtBQUNuQyxzQkFBMkQsRUFBRSxjQUFjLE9BQU8sVUFBVSxNQUFNO0FBQ2xHLHdCQUE4QixLQUFLLFVBQVUsSUFBSSxRQUFjLENBQUM7QUFDaEUsK0NBQStDO0FBRS9DLFNBQW1CLFVBQWtCO0FBRXJDLFNBQVEsWUFBcUI7QUFDN0IsU0FBUyxnQkFBZ0IsU0FBUyxLQUFLLG1CQUFtQixxQkFBcUIsbUJBQW1CO0FBb0lsRyx1Q0FBNkMsS0FBSyxVQUFVLElBQUksUUFBYyxDQUFDO0FBQUE7QUFBQSxFQWxJL0UsZUFBZ0M7QUFBRSxXQUFPLEtBQUs7QUFBQSxFQUF5QjtBQUFBLEVBQ3ZFLHNCQUEyQjtBQUFFLFdBQU8sS0FBSztBQUFBLEVBQWtCO0FBQUEsRUFFeEMsd0JBQXdCLFVBQTRDLGtCQUFvRTtBQUMxSixRQUFJLEtBQUsscUNBQXFDO0FB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
