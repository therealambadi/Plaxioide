import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IFileService } from "../../../files/common/files.js";
import { ILogService } from "../../../log/common/log.js";
import { IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { getTasksContentFromSyncContent } from "../../common/tasksSync.js";
import { Change, IUserDataSyncStoreService, MergeState, SyncResource, SyncStatus } from "../../common/userDataSync.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "./userDataSyncClient.js";
suite("TasksSync", () => {
  const server = new UserDataSyncTestServer();
  let client;
  let testObject;
  teardown(async () => {
    await client.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    client = disposableStore.add(new UserDataSyncClient(server));
    await client.setUp(true);
    testObject = client.getSynchronizer(SyncResource.Tasks);
  });
  test("when tasks file does not exist", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
      let manifest = await client.getResourceManifest();
      server.reset();
      await testObject.sync(manifest);
      assert.deepStrictEqual(server.requests, [
        { type: "GET", url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} }
      ]);
      assert.ok(!await fileService.exists(tasksResource));
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
      assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
      assert.strictEqual(lastSyncUserData.syncData, null);
      manifest = await client.getResourceManifest();
      server.reset();
      await testObject.sync(manifest);
      assert.deepStrictEqual(server.requests, []);
      manifest = await client.getResourceManifest();
      server.reset();
      await testObject.sync(manifest);
      assert.deepStrictEqual(server.requests, []);
    });
  });
  test("when tasks file does not exist and remote has changes", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.instantiationService.get(IFileService).writeFile(tasksResource2, VSBuffer.fromString(content));
      await client2.sync();
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file exists locally and remote has no tasks", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
    });
  });
  test("first time sync: when tasks file exists locally with same content as remote", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.instantiationService.get(IFileService).writeFile(tasksResource2, VSBuffer.fromString(content));
      await client2.sync();
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file locally has moved forward", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
    });
  });
  test("when tasks file remotely has moved forward", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file has moved forward locally and remotely with same changes", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));
      await client2.sync();
      fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file has moved forward locally and remotely - accept preview", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch"
        }]
      })));
      await client2.sync();
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      const previewContent = (await fileService.readFile(testObject.conflicts.conflicts[0].previewResource)).value.toString();
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      assert.deepStrictEqual(testObject.conflicts.conflicts.length, 1);
      assert.deepStrictEqual(testObject.conflicts.conflicts[0].mergeState, MergeState.Conflict);
      assert.deepStrictEqual(testObject.conflicts.conflicts[0].localChange, Change.Modified);
      assert.deepStrictEqual(testObject.conflicts.conflicts[0].remoteChange, Change.Modified);
      await testObject.accept(testObject.conflicts.conflicts[0].previewResource);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), previewContent);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), previewContent);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), previewContent);
    });
  });
  test("when tasks file has moved forward locally and remotely - accept modified preview", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch"
        }]
      })));
      await client2.sync();
      fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      })));
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch 2"
        }]
      });
      await testObject.accept(testObject.conflicts.conflicts[0].previewResource, content);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file has moved forward locally and remotely - accept remote", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch"
        }]
      });
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(content));
      await client2.sync();
      fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      })));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].remoteResource);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file has moved forward locally and remotely - accept local", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      await fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      fileService2.writeFile(tasksResource2, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch"
        }]
      })));
      await client2.sync();
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      fileService.writeFile(tasksResource, VSBuffer.fromString(content));
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.HasConflicts);
      await testObject.accept(testObject.conflicts.conflicts[0].localResource);
      await testObject.apply(false);
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), content);
      assert.strictEqual((await fileService.readFile(tasksResource)).value.toString(), content);
    });
  });
  test("when tasks file was removed in one client", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await fileService.writeFile(tasksResource, VSBuffer.fromString(JSON.stringify({
        "version": "2.0.0",
        "tasks": []
      })));
      await testObject.sync(await client.getResourceManifest());
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      await client2.sync();
      const tasksResource2 = client2.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      const fileService2 = client2.instantiationService.get(IFileService);
      fileService2.del(tasksResource2);
      await client2.sync();
      await testObject.sync(await client.getResourceManifest());
      assert.deepStrictEqual(testObject.status, SyncStatus.Idle);
      const lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), null);
      assert.strictEqual(getTasksContentFromSyncContent(remoteUserData.syncData.content, client.instantiationService.get(ILogService)), null);
      assert.strictEqual(await fileService.exists(tasksResource), false);
    });
  });
  test("when tasks file is created after first sync", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      await testObject.sync(await client.getResourceManifest());
      const content = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      await fileService.createFile(tasksResource, VSBuffer.fromString(content));
      let lastSyncUserData = await testObject.getLastSyncUserData();
      const manifest = await client.getResourceManifest();
      server.reset();
      await testObject.sync(manifest);
      assert.deepStrictEqual(server.requests, [
        { type: "POST", url: `${server.url}/v1/resource/${testObject.resource}`, headers: { "If-Match": lastSyncUserData?.ref } }
      ]);
      lastSyncUserData = await testObject.getLastSyncUserData();
      const remoteUserData = await testObject.getRemoteUserData(null);
      assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
      assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
      assert.strictEqual(getTasksContentFromSyncContent(lastSyncUserData.syncData.content, client.instantiationService.get(ILogService)), content);
    });
  });
  test("apply remote when tasks file does not exist", async () => {
    await runWithFakedTimers({}, async () => {
      const fileService = client.instantiationService.get(IFileService);
      const tasksResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.tasksResource;
      if (await fileService.exists(tasksResource)) {
        await fileService.del(tasksResource);
      }
      const preview = await testObject.sync(await client.getResourceManifest(), true);
      server.reset();
      const content = await testObject.resolveContent(preview.resourcePreviews[0].remoteResource);
      await testObject.accept(preview.resourcePreviews[0].remoteResource, content);
      await testObject.apply(false);
      assert.deepStrictEqual(server.requests, []);
    });
  });
  test("sync profile tasks", async () => {
    await runWithFakedTimers({}, async () => {
      const client2 = disposableStore.add(new UserDataSyncClient(server));
      await client2.setUp(true);
      const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile("profile1");
      const expected = JSON.stringify({
        "version": "2.0.0",
        "tasks": [{
          "type": "npm",
          "script": "watch",
          "label": "Watch"
        }]
      });
      await client2.instantiationService.get(IFileService).createFile(profile.tasksResource, VSBuffer.fromString(expected));
      await client2.sync();
      await client.sync();
      const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find((p) => p.id === profile.id);
      const actual = (await client.instantiationService.get(IFileService).readFile(syncedProfile.tasksResource)).value.toString();
      assert.strictEqual(actual, expected);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vdGFza3NTeW5jLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQsIFRhc2tzU3luY2hyb25pc2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rhc2tzU3luYy5qcyc7XG5pbXBvcnQgeyBDaGFuZ2UsIElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIE1lcmdlU3RhdGUsIFN5bmNSZXNvdXJjZSwgU3luY1N0YXR1cyB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jQ2xpZW50LCBVc2VyRGF0YVN5bmNUZXN0U2VydmVyIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNDbGllbnQuanMnO1xuXG5zdWl0ZSgnVGFza3NTeW5jJywgKCkgPT4ge1xuXG5cdGNvbnN0IHNlcnZlciA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdGxldCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudDtcblxuXHRsZXQgdGVzdE9iamVjdDogVGFza3NTeW5jaHJvbmlzZXI7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSkuY2xlYXIoKTtcblx0fSk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdGNsaWVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRhd2FpdCBjbGllbnQuc2V0VXAodHJ1ZSk7XG5cdFx0dGVzdE9iamVjdCA9IGNsaWVudC5nZXRTeW5jaHJvbml6ZXIoU3luY1Jlc291cmNlLlRhc2tzKSBhcyBUYXNrc1N5bmNocm9uaXNlcjtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCksIG51bGwpO1xuXHRcdFx0bGV0IG1hbmlmZXN0ID0gYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRcdHNlcnZlci5yZXNldCgpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHtzZXJ2ZXIudXJsfS92MS9yZXNvdXJjZS8ke3Rlc3RPYmplY3QucmVzb3VyY2V9L2xhdGVzdGAsIGhlYWRlcnM6IHt9IH0sXG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5vayghYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRhc2tzUmVzb3VyY2UpKTtcblxuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsYXN0U3luY1VzZXJEYXRhIS5yZWYsIHJlbW90ZVVzZXJEYXRhLnJlZik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YSEuc3luY0RhdGEsIG51bGwpO1xuXG5cdFx0XHRtYW5pZmVzdCA9IGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhtYW5pZmVzdCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW10pO1xuXG5cdFx0XHRtYW5pZmVzdCA9IGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhtYW5pZmVzdCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW10pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd3aGVuIHRhc2tzIGZpbGUgZG9lcyBub3QgZXhpc3QgYW5kIHJlbW90ZSBoYXMgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdFx0J2xhYmVsJzogJ1dhdGNoJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGF3YWl0IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRhc2tzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBjb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGV4aXN0cyBsb2NhbGx5IGFuZCByZW1vdGUgaGFzIG5vIHRhc2tzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2gnXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHRcdGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IHRpbWUgc3luYzogd2hlbiB0YXNrcyBmaWxlIGV4aXN0cyBsb2NhbGx5IHdpdGggc2FtZSBjb250ZW50IGFzIHJlbW90ZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdFx0Y29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdFx0J2xhYmVsJzogJ1dhdGNoJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGF3YWl0IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRhc2tzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBjb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGxvY2FsbHkgaGFzIG1vdmVkIGZvcndhcmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbXVxuXHRcdFx0fSkpKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2gnXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHRcdGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3doZW4gdGFza3MgZmlsZSByZW1vdGVseSBoYXMgbW92ZWQgZm9yd2FyZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdFx0Y29uc3QgdGFza3NSZXNvdXJjZTIgPSBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZTIgPSBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2UyLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlMiwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdCd2ZXJzaW9uJzogJzIuMC4wJyxcblx0XHRcdFx0J3Rhc2tzJzogW11cblx0XHRcdH0pKSk7XG5cblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGFza3NSZXNvdXJjZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdFx0Y29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdFx0J2xhYmVsJzogJ1dhdGNoJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0XHRmaWxlU2VydmljZTIud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGNvbnRlbnQpKTtcblxuXHRcdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIGNvbnRlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChyZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGFza3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd3aGVuIHRhc2tzIGZpbGUgaGFzIG1vdmVkIGZvcndhcmQgbG9jYWxseSBhbmQgcmVtb3RlbHkgd2l0aCBzYW1lIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlMi53cml0ZUZpbGUodGFza3NSZXNvdXJjZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFtdXG5cdFx0XHR9KSkpO1xuXG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblxuXHRcdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdCd2ZXJzaW9uJzogJzIuMC4wJyxcblx0XHRcdFx0J3Rhc2tzJzogW3tcblx0XHRcdFx0XHQndHlwZSc6ICducG0nLFxuXHRcdFx0XHRcdCdzY3JpcHQnOiAnd2F0Y2gnLFxuXHRcdFx0XHRcdCdsYWJlbCc6ICdXYXRjaCdcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdFx0ZmlsZVNlcnZpY2UyLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlMiwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoY29udGVudCkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRhc2tzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBjb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGhhcyBtb3ZlZCBmb3J3YXJkIGxvY2FsbHkgYW5kIHJlbW90ZWx5IC0gYWNjZXB0IHByZXZpZXcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlMi53cml0ZUZpbGUodGFza3NSZXNvdXJjZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFtdXG5cdFx0XHR9KSkpO1xuXG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblxuXHRcdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGZpbGVTZXJ2aWNlMi53cml0ZUZpbGUodGFza3NSZXNvdXJjZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0fV1cblx0XHRcdH0pKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdFx0Y29uc3QgY29udGVudCA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdFx0J2xhYmVsJzogJ1dhdGNoJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0XHRmaWxlU2VydmljZS53cml0ZUZpbGUodGFza3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGNvbnN0IHByZXZpZXdDb250ZW50ID0gKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLm1lcmdlU3RhdGUsIE1lcmdlU3RhdGUuQ29uZmxpY3QpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ubG9jYWxDaGFuZ2UsIENoYW5nZS5Nb2RpZmllZCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5yZW1vdGVDaGFuZ2UsIENoYW5nZS5Nb2RpZmllZCk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBwcmV2aWV3Q29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIHByZXZpZXdDb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGFza3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIHByZXZpZXdDb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGhhcyBtb3ZlZCBmb3J3YXJkIGxvY2FsbHkgYW5kIHJlbW90ZWx5IC0gYWNjZXB0IG1vZGlmaWVkIHByZXZpZXcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UyID0gY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlMi53cml0ZUZpbGUodGFza3NSZXNvdXJjZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFtdXG5cdFx0XHR9KSkpO1xuXG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IHRhc2tzUmVzb3VyY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblxuXHRcdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGZpbGVTZXJ2aWNlMi53cml0ZUZpbGUodGFza3NSZXNvdXJjZTIsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0fV1cblx0XHRcdH0pKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2gnXG5cdFx0XHRcdH1dXG5cdFx0XHR9KSkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2ggMidcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgY29udGVudCk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIGNvbnRlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChyZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGFza3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd3aGVuIHRhc2tzIGZpbGUgaGFzIG1vdmVkIGZvcndhcmQgbG9jYWxseSBhbmQgcmVtb3RlbHkgLSBhY2NlcHQgcmVtb3RlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc2V0VXAodHJ1ZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZTIud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbXVxuXHRcdFx0fSkpKTtcblxuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdFx0ZmlsZVNlcnZpY2UyLndyaXRlRmlsZSh0YXNrc1Jlc291cmNlMiwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2gnXG5cdFx0XHRcdH1dXG5cdFx0XHR9KSkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChnZXRUYXNrc0NvbnRlbnRGcm9tU3luY0NvbnRlbnQocmVtb3RlVXNlckRhdGEuc3luY0RhdGEhLmNvbnRlbnQsIGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxvZ1NlcnZpY2UpKSwgY29udGVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHRhc2tzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpLCBjb250ZW50KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGhhcyBtb3ZlZCBmb3J3YXJkIGxvY2FsbHkgYW5kIHJlbW90ZWx5IC0gYWNjZXB0IGxvY2FsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc2V0VXAodHJ1ZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZTIud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbXVxuXHRcdFx0fSkpKTtcblxuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRmaWxlU2VydmljZTIud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UyLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdH1dXG5cdFx0XHR9KSkpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRcdGNvbnN0IGNvbnRlbnQgPSBKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHRcdCd2ZXJzaW9uJzogJzIuMC4wJyxcblx0XHRcdFx0J3Rhc2tzJzogW3tcblx0XHRcdFx0XHQndHlwZSc6ICducG0nLFxuXHRcdFx0XHRcdCdzY3JpcHQnOiAnd2F0Y2gnLFxuXHRcdFx0XHRcdCdsYWJlbCc6ICdXYXRjaCdcblx0XHRcdFx0fV1cblx0XHRcdH0pO1xuXHRcdFx0ZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoY29udGVudCkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ubG9jYWxSZXNvdXJjZSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIGNvbnRlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChyZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBjb250ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGFza3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd3aGVuIHRhc2tzIGZpbGUgd2FzIHJlbW92ZWQgaW4gb25lIGNsaWVudCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGFza3NSZXNvdXJjZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHRhc2tzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFtdXG5cdFx0XHR9KSkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUudGFza3NSZXNvdXJjZTtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlMiA9IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRmaWxlU2VydmljZTIuZGVsKHRhc2tzUmVzb3VyY2UyKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIG51bGwpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdldFRhc2tzQ29udGVudEZyb21TeW5jQ29udGVudChyZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSEuY29udGVudCwgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTG9nU2VydmljZSkpLCBudWxsKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhd2FpdCBmaWxlU2VydmljZS5leGlzdHModGFza3NSZXNvdXJjZSksIGZhbHNlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiB0YXNrcyBmaWxlIGlzIGNyZWF0ZWQgYWZ0ZXIgZmlyc3Qgc3luYycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdFx0Y29uc3QgdGFza3NSZXNvdXJjZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS50YXNrc1Jlc291cmNlO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0XHRjb25zdCBjb250ZW50ID0gSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0XHQndmVyc2lvbic6ICcyLjAuMCcsXG5cdFx0XHRcdCd0YXNrcyc6IFt7XG5cdFx0XHRcdFx0J3R5cGUnOiAnbnBtJyxcblx0XHRcdFx0XHQnc2NyaXB0JzogJ3dhdGNoJyxcblx0XHRcdFx0XHQnbGFiZWwnOiAnV2F0Y2gnXG5cdFx0XHRcdH1dXG5cdFx0XHR9KTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmNyZWF0ZUZpbGUodGFza3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cblx0XHRcdGxldCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhtYW5pZmVzdCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3NlcnZlci51cmx9L3YxL3Jlc291cmNlLyR7dGVzdE9iamVjdC5yZXNvdXJjZX1gLCBoZWFkZXJzOiB7ICdJZi1NYXRjaCc6IGxhc3RTeW5jVXNlckRhdGE/LnJlZiB9IH0sXG5cdFx0XHRdKTtcblxuXHRcdFx0bGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsYXN0U3luY1VzZXJEYXRhIS5yZWYsIHJlbW90ZVVzZXJEYXRhLnJlZik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZ2V0VGFza3NDb250ZW50RnJvbVN5bmNDb250ZW50KGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhIS5jb250ZW50LCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMb2dTZXJ2aWNlKSksIGNvbnRlbnQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhcHBseSByZW1vdGUgd2hlbiB0YXNrcyBmaWxlIGRvZXMgbm90IGV4aXN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0XHRjb25zdCB0YXNrc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnRhc2tzUmVzb3VyY2U7XG5cdFx0XHRpZiAoYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHRhc2tzUmVzb3VyY2UpKSB7XG5cdFx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLmRlbCh0YXNrc1Jlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcHJldmlldyA9IChhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSkpITtcblxuXHRcdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGVzdE9iamVjdC5yZXNvbHZlQ29udGVudChwcmV2aWV3LnJlc291cmNlUHJldmlld3NbMF0ucmVtb3RlUmVzb3VyY2UpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQocHJldmlldy5yZXNvdXJjZVByZXZpZXdzWzBdLnJlbW90ZVJlc291cmNlLCBjb250ZW50KTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBwcm9maWxlIHRhc2tzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRcdGF3YWl0IGNsaWVudDIuc2V0VXAodHJ1ZSk7XG5cdFx0XHRjb25zdCBwcm9maWxlID0gYXdhaXQgY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5jcmVhdGVOYW1lZFByb2ZpbGUoJ3Byb2ZpbGUxJyk7XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IEpTT04uc3RyaW5naWZ5KHtcblx0XHRcdFx0J3ZlcnNpb24nOiAnMi4wLjAnLFxuXHRcdFx0XHQndGFza3MnOiBbe1xuXHRcdFx0XHRcdCd0eXBlJzogJ25wbScsXG5cdFx0XHRcdFx0J3NjcmlwdCc6ICd3YXRjaCcsXG5cdFx0XHRcdFx0J2xhYmVsJzogJ1dhdGNoJ1xuXHRcdFx0XHR9XVxuXHRcdFx0fSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpLmNyZWF0ZUZpbGUocHJvZmlsZS50YXNrc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKGV4cGVjdGVkKSk7XG5cdFx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdFx0YXdhaXQgY2xpZW50LnN5bmMoKTtcblxuXHRcdFx0Y29uc3Qgc3luY2VkUHJvZmlsZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5wcm9maWxlcy5maW5kKHAgPT4gcC5pZCA9PT0gcHJvZmlsZS5pZCkhO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKS5yZWFkRmlsZShzeW5jZWRQcm9maWxlLnRhc2tzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxufSk7XG4iXSwKICAibWFwcGlu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
