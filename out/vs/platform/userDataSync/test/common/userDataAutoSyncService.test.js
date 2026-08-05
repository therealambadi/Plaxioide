import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Event } from "../../../../base/common/event.js";
import { joinPath } from "../../../../base/common/resources.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IEnvironmentService } from "../../../environment/common/environment.js";
import { IFileService } from "../../../files/common/files.js";
import { IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { UserDataAutoSyncService } from "../../common/userDataAutoSyncService.js";
import { IUserDataSyncService, SyncResource, UserDataAutoSyncError, UserDataSyncErrorCode, UserDataSyncStoreError } from "../../common/userDataSync.js";
import { IUserDataSyncMachinesService } from "../../common/userDataSyncMachines.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "./userDataSyncClient.js";
class TestUserDataAutoSyncService extends UserDataAutoSyncService {
  startAutoSync() {
    return false;
  }
  getSyncTriggerDelayTime() {
    return 50;
  }
  sync() {
    return this.triggerSync(["sync"]);
  }
}
suite("UserDataAutoSyncService", () => {
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  test("test auto sync with sync resource change triggers sync", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      target.reset();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.triggerSync([SyncResource.Settings]);
      const actual = target.requests.filter((request) => !request.url.startsWith(`${target.url}/v1/resource/machines`));
      assert.deepStrictEqual(actual, [{ type: "GET", url: `${target.url}/v1/manifest`, headers: {} }]);
    });
  });
  test("test auto sync with sync resource change triggers sync for every change", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      target.reset();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      for (let counter = 0; counter < 2; counter++) {
        await testObject.triggerSync([SyncResource.Settings]);
      }
      const actual = target.requests.filter((request) => !request.url.startsWith(`${target.url}/v1/resource/machines`));
      assert.deepStrictEqual(actual, [
        { type: "GET", url: `${target.url}/v1/manifest`, headers: {} },
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } }
      ]);
    });
  });
  test("test auto sync with non sync resource change triggers sync", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      target.reset();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.triggerSync(["windowFocus"]);
      const actual = target.requests.filter((request) => !request.url.startsWith(`${target.url}/v1/resource/machines`));
      assert.deepStrictEqual(actual, [{ type: "GET", url: `${target.url}/v1/manifest`, headers: {} }]);
    });
  });
  test("test auto sync with non sync resource change does not trigger continuous syncs", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      target.reset();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      for (let counter = 0; counter < 2; counter++) {
        await testObject.triggerSync(["windowFocus"], { skipIfSyncedRecently: true });
      }
      const actual = target.requests.filter((request) => !request.url.startsWith(`${target.url}/v1/resource/machines`));
      assert.deepStrictEqual(actual, [{ type: "GET", url: `${target.url}/v1/manifest`, headers: {} }]);
    });
  });
  test("test first auto sync requests", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: {} },
        // Machines
        { type: "GET", url: `${target.url}/v1/resource/machines/latest`, headers: {} },
        // Settings
        { type: "GET", url: `${target.url}/v1/resource/settings/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/settings`, headers: { "If-Match": "0" } },
        // Keybindings
        { type: "GET", url: `${target.url}/v1/resource/keybindings/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/keybindings`, headers: { "If-Match": "0" } },
        // Snippets
        { type: "GET", url: `${target.url}/v1/resource/snippets/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/snippets`, headers: { "If-Match": "0" } },
        // Tasks
        { type: "GET", url: `${target.url}/v1/resource/tasks/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/tasks`, headers: { "If-Match": "0" } },
        // Global state
        { type: "GET", url: `${target.url}/v1/resource/globalState/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/globalState`, headers: { "If-Match": "0" } },
        // Extensions
        { type: "GET", url: `${target.url}/v1/resource/extensions/latest`, headers: {} },
        // Prompts
        { type: "GET", url: `${target.url}/v1/resource/prompts/latest`, headers: {} },
        { type: "POST", url: `${target.url}/v1/resource/prompts`, headers: { "If-Match": "0" } },
        // Profiles
        { type: "GET", url: `${target.url}/v1/resource/profiles/latest`, headers: {} },
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: {} },
        // Machines
        { type: "POST", url: `${target.url}/v1/resource/machines`, headers: { "If-Match": "0" } }
      ]);
    });
  });
  test("test further auto sync requests without changes", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      target.reset();
      await testObject.sync();
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } }
      ]);
    });
  });
  test("test further auto sync requests with changes", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      target.reset();
      const fileService = client.instantiationService.get(IFileService);
      const environmentService = client.instantiationService.get(IEnvironmentService);
      const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
      await fileService.writeFile(userDataProfilesService.defaultProfile.settingsResource, VSBuffer.fromString(JSON.stringify({ "editor.fontSize": 14 })));
      await fileService.writeFile(userDataProfilesService.defaultProfile.keybindingsResource, VSBuffer.fromString(JSON.stringify([{ "command": "abcd", "key": "cmd+c" }])));
      await fileService.writeFile(joinPath(userDataProfilesService.defaultProfile.snippetsHome, "html.json"), VSBuffer.fromString(`{}`));
      await fileService.writeFile(joinPath(userDataProfilesService.defaultProfile.promptsHome, "h1.prompt.md"), VSBuffer.fromString(" "));
      await fileService.writeFile(environmentService.argvResource, VSBuffer.fromString(JSON.stringify({ "locale": "de" })));
      await testObject.sync();
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } },
        // Settings
        { type: "POST", url: `${target.url}/v1/resource/settings`, headers: { "If-Match": "1" } },
        // Keybindings
        { type: "POST", url: `${target.url}/v1/resource/keybindings`, headers: { "If-Match": "1" } },
        // Snippets
        { type: "POST", url: `${target.url}/v1/resource/snippets`, headers: { "If-Match": "1" } },
        // Global state
        { type: "POST", url: `${target.url}/v1/resource/globalState`, headers: { "If-Match": "1" } },
        // Prompts
        { type: "POST", url: `${target.url}/v1/resource/prompts`, headers: { "If-Match": "1" } }
      ]);
    });
  });
  test("test auto sync send execution id header", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      const testObject = disposableStore.add(client.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      target.reset();
      await testObject.sync();
      for (const request of target.requestsWithAllHeaders) {
        const hasExecutionIdHeader = request.headers && request.headers["X-Execution-Id"] && request.headers["X-Execution-Id"].length > 0;
        if (request.url.startsWith(`${target.url}/v1/resource/machines`)) {
          assert.ok(!hasExecutionIdHeader, `Should not have execution header: ${request.url}`);
        } else {
          assert.ok(hasExecutionIdHeader, `Should have execution header: ${request.url}`);
        }
      }
    });
  });
  test("test delete on one client throws turned off error on other client while syncing", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      await client.instantiationService.get(IUserDataSyncService).reset();
      target.reset();
      const errorPromise = Event.toPromise(testObject.onError);
      await testObject.sync();
      const e = await errorPromise;
      assert.ok(e instanceof UserDataAutoSyncError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.TurnedOff);
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } },
        // Machine
        { type: "GET", url: `${target.url}/v1/resource/machines/latest`, headers: { "If-None-Match": "1" } }
      ]);
    });
  });
  test("test disabling the machine turns off sync", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      const userDataSyncMachinesService = testClient.instantiationService.get(IUserDataSyncMachinesService);
      const machines = await userDataSyncMachinesService.getMachines();
      const currentMachine = machines.find((m) => m.isCurrent);
      await userDataSyncMachinesService.setEnablements([[currentMachine.id, false]]);
      target.reset();
      const errorPromise = Event.toPromise(testObject.onError);
      await testObject.sync();
      const e = await errorPromise;
      assert.ok(e instanceof UserDataAutoSyncError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.TurnedOff);
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } },
        // Machine
        { type: "GET", url: `${target.url}/v1/resource/machines/latest`, headers: { "If-None-Match": "2" } },
        { type: "POST", url: `${target.url}/v1/resource/machines`, headers: { "If-Match": "2" } }
      ]);
    });
  });
  test("test removing the machine adds machine back", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      await testClient.instantiationService.get(IUserDataSyncMachinesService).removeCurrentMachine();
      target.reset();
      await testObject.sync();
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } },
        // Machine
        { type: "POST", url: `${target.url}/v1/resource/machines`, headers: { "If-Match": "2" } }
      ]);
    });
  });
  test("test creating new session from one client throws session expired error on another client while syncing", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer();
      const client = disposableStore.add(new UserDataSyncClient(target));
      await client.setUp();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.sync();
      await client.instantiationService.get(IUserDataSyncService).reset();
      await (await client.instantiationService.get(IUserDataSyncService).createSyncTask(null)).run();
      target.reset();
      const errorPromise = Event.toPromise(testObject.onError);
      await testObject.sync();
      const e = await errorPromise;
      assert.ok(e instanceof UserDataAutoSyncError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.SessionExpired);
      assert.deepStrictEqual(target.requests, [
        // Manifest
        { type: "GET", url: `${target.url}/v1/manifest`, headers: { "If-None-Match": "1" } },
        // Machine
        { type: "GET", url: `${target.url}/v1/resource/machines/latest`, headers: { "If-None-Match": "1" } }
      ]);
    });
  });
  test("test rate limit on server", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer(5);
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      const errorPromise = Event.toPromise(testObject.onError);
      while (target.requests.length < 5) {
        await testObject.sync();
      }
      const e = await errorPromise;
      assert.ok(e instanceof UserDataSyncStoreError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.TooManyRequests);
    });
  });
  test("test auto sync is suspended when server donot accepts requests", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer(5, 1);
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      while (target.requests.length < 5) {
        await testObject.sync();
      }
      target.reset();
      await testObject.sync();
      assert.deepStrictEqual(target.requests, []);
    });
  });
  test("test cache control header with no cache is sent when triggered with disable cache option", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer(5, 1);
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.triggerSync(["some reason"], { disableCache: true });
      assert.strictEqual(target.requestsWithAllHeaders[0].headers["Cache-Control"], "no-cache");
    });
  });
  test("test cache control header is not sent when triggered without disable cache option", async () => {
    await runWithFakedTimers({}, async () => {
      const target = new UserDataSyncTestServer(5, 1);
      const testClient = disposableStore.add(new UserDataSyncClient(target));
      await testClient.setUp();
      const testObject = disposableStore.add(testClient.instantiationService.createInstance(TestUserDataAutoSyncService));
      await testObject.triggerSync(["some reason"]);
      assert.strictEqual(target.requestsWithAllHeaders[0].headers["Cache-Control"], void 0);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vdXNlckRhdGFBdXRvU3luY1NlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFZTQnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYnVmZmVyLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgam9pblBhdGggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vdXNlckRhdGFQcm9maWxlL2NvbW1vbi91c2VyRGF0YVByb2ZpbGUuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFBdXRvU3luY1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdXNlckRhdGFBdXRvU3luY1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVzZXJEYXRhU3luY1NlcnZpY2UsIFN5bmNSZXNvdXJjZSwgVXNlckRhdGFBdXRvU3luY0Vycm9yLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUsIFVzZXJEYXRhU3luY1N0b3JlRXJyb3IgfSBmcm9tICcuLi8uLi9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVN5bmNNYWNoaW5lc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vdXNlckRhdGFTeW5jTWFjaGluZXMuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jQ2xpZW50LCBVc2VyRGF0YVN5bmNUZXN0U2VydmVyIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNDbGllbnQuanMnO1xuXG5jbGFzcyBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgZXh0ZW5kcyBVc2VyRGF0YUF1dG9TeW5jU2VydmljZSB7XG5cdHByb3RlY3RlZCBvdmVycmlkZSBzdGFydEF1dG9TeW5jKCk6IGJvb2xlYW4geyByZXR1cm4gZmFsc2U7IH1cblx0cHJvdGVjdGVkIG92ZXJyaWRlIGdldFN5bmNUcmlnZ2VyRGVsYXlUaW1lKCk6IG51bWJlciB7IHJldHVybiA1MDsgfVxuXG5cdHN5bmMoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0cmV0dXJuIHRoaXMudHJpZ2dlclN5bmMoWydzeW5jJ10pO1xuXHR9XG59XG5cbnN1aXRlKCdVc2VyRGF0YUF1dG9TeW5jU2VydmljZScsICgpID0+IHtcblxuXHRjb25zdCBkaXNwb3NhYmxlU3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZXN0IGF1dG8gc3luYyB3aXRoIHN5bmMgcmVzb3VyY2UgY2hhbmdlIHRyaWdnZXJzIHN5bmMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBTZXR1cCB0aGUgY2xpZW50XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXHRcdFx0Y29uc3QgY2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgY2xpZW50LnNldFVwKCk7XG5cblx0XHRcdC8vIFN5bmMgb25jZSBhbmQgcmVzZXQgcmVxdWVzdHNcblx0XHRcdGF3YWl0IChhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTZXJ2aWNlKS5jcmVhdGVTeW5jVGFzayhudWxsKSkucnVuKCk7XG5cdFx0XHR0YXJnZXQucmVzZXQoKTtcblxuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UpKTtcblxuXHRcdFx0Ly8gVHJpZ2dlciBhdXRvIHN5bmMgd2l0aCBzZXR0aW5ncyBjaGFuZ2Vcblx0XHRcdGF3YWl0IHRlc3RPYmplY3QudHJpZ2dlclN5bmMoW1N5bmNSZXNvdXJjZS5TZXR0aW5nc10pO1xuXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IG1hY2hpbmUgcmVxdWVzdHNcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHRhcmdldC5yZXF1ZXN0cy5maWx0ZXIocmVxdWVzdCA9PiAhcmVxdWVzdC51cmwuc3RhcnRzV2l0aChgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9tYWNoaW5lc2ApKTtcblxuXHRcdFx0Ly8gTWFrZSBzdXJlIG9ubHkgb25lIG1hbmlmZXN0IHJlcXVlc3QgaXMgbWFkZVxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFt7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL21hbmlmZXN0YCwgaGVhZGVyczoge30gfV0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0IGF1dG8gc3luYyB3aXRoIHN5bmMgcmVzb3VyY2UgY2hhbmdlIHRyaWdnZXJzIHN5bmMgZm9yIGV2ZXJ5IGNoYW5nZScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIFNldHVwIHRoZSBjbGllbnRcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdFx0XHRjb25zdCBjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQuc2V0VXAoKTtcblxuXHRcdFx0Ly8gU3luYyBvbmNlIGFuZCByZXNldCByZXF1ZXN0c1xuXHRcdFx0YXdhaXQgKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpLmNyZWF0ZVN5bmNUYXNrKG51bGwpKS5ydW4oKTtcblx0XHRcdHRhcmdldC5yZXNldCgpO1xuXG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBVc2VyRGF0YUF1dG9TeW5jU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHQvLyBUcmlnZ2VyIGF1dG8gc3luYyB3aXRoIHNldHRpbmdzIGNoYW5nZSBtdWx0aXBsZSB0aW1lc1xuXHRcdFx0Zm9yIChsZXQgY291bnRlciA9IDA7IGNvdW50ZXIgPCAyOyBjb3VudGVyKyspIHtcblx0XHRcdFx0YXdhaXQgdGVzdE9iamVjdC50cmlnZ2VyU3luYyhbU3luY1Jlc291cmNlLlNldHRpbmdzXSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbHRlciBvdXQgbWFjaGluZSByZXF1ZXN0c1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gdGFyZ2V0LnJlcXVlc3RzLmZpbHRlcihyZXF1ZXN0ID0+ICFyZXF1ZXN0LnVybC5zdGFydHNXaXRoKGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCkpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL21hbmlmZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9tYW5pZmVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdCBhdXRvIHN5bmMgd2l0aCBub24gc3luYyByZXNvdXJjZSBjaGFuZ2UgdHJpZ2dlcnMgc3luYycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIFNldHVwIHRoZSBjbGllbnRcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdFx0XHRjb25zdCBjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQuc2V0VXAoKTtcblxuXHRcdFx0Ly8gU3luYyBvbmNlIGFuZCByZXNldCByZXF1ZXN0c1xuXHRcdFx0YXdhaXQgKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpLmNyZWF0ZVN5bmNUYXNrKG51bGwpKS5ydW4oKTtcblx0XHRcdHRhcmdldC5yZXNldCgpO1xuXG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBVc2VyRGF0YUF1dG9TeW5jU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHQvLyBUcmlnZ2VyIGF1dG8gc3luYyB3aXRoIHdpbmRvdyBmb2N1cyBvbmNlXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnRyaWdnZXJTeW5jKFsnd2luZG93Rm9jdXMnXSk7XG5cblx0XHRcdC8vIEZpbHRlciBvdXQgbWFjaGluZSByZXF1ZXN0c1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gdGFyZ2V0LnJlcXVlc3RzLmZpbHRlcihyZXF1ZXN0ID0+ICFyZXF1ZXN0LnVybC5zdGFydHNXaXRoKGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCkpO1xuXG5cdFx0XHQvLyBNYWtlIHN1cmUgb25seSBvbmUgbWFuaWZlc3QgcmVxdWVzdCBpcyBtYWRlXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW3sgdHlwZTogJ0dFVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvbWFuaWZlc3RgLCBoZWFkZXJzOiB7fSB9XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgYXV0byBzeW5jIHdpdGggbm9uIHN5bmMgcmVzb3VyY2UgY2hhbmdlIGRvZXMgbm90IHRyaWdnZXIgY29udGludW91cyBzeW5jcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIFNldHVwIHRoZSBjbGllbnRcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdFx0XHRjb25zdCBjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQuc2V0VXAoKTtcblxuXHRcdFx0Ly8gU3luYyBvbmNlIGFuZCByZXNldCByZXF1ZXN0c1xuXHRcdFx0YXdhaXQgKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpLmNyZWF0ZVN5bmNUYXNrKG51bGwpKS5ydW4oKTtcblx0XHRcdHRhcmdldC5yZXNldCgpO1xuXG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBVc2VyRGF0YUF1dG9TeW5jU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHQvLyBUcmlnZ2VyIGF1dG8gc3luYyB3aXRoIHdpbmRvdyBmb2N1cyBtdWx0aXBsZSB0aW1lc1xuXHRcdFx0Zm9yIChsZXQgY291bnRlciA9IDA7IGNvdW50ZXIgPCAyOyBjb3VudGVyKyspIHtcblx0XHRcdFx0YXdhaXQgdGVzdE9iamVjdC50cmlnZ2VyU3luYyhbJ3dpbmRvd0ZvY3VzJ10sIHsgc2tpcElmU3luY2VkUmVjZW50bHk6IHRydWUgfSk7XG5cdFx0XHR9XG5cblx0XHRcdC8vIEZpbHRlciBvdXQgbWFjaGluZSByZXF1ZXN0c1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gdGFyZ2V0LnJlcXVlc3RzLmZpbHRlcihyZXF1ZXN0ID0+ICFyZXF1ZXN0LnVybC5zdGFydHNXaXRoKGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCkpO1xuXG5cdFx0XHQvLyBNYWtlIHN1cmUgb25seSBvbmUgbWFuaWZlc3QgcmVxdWVzdCBpcyBtYWRlXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW3sgdHlwZTogJ0dFVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvbWFuaWZlc3RgLCBoZWFkZXJzOiB7fSB9XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgZmlyc3QgYXV0byBzeW5jIHJlcXVlc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Ly8gU2V0dXAgdGhlIGNsaWVudFxuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gbmV3IFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIoKTtcblx0XHRcdGNvbnN0IGNsaWVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudCh0YXJnZXQpKTtcblx0XHRcdGF3YWl0IGNsaWVudC5zZXRVcCgpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlID0gZGlzcG9zYWJsZVN0b3JlLmFkZChjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlKSk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYygpO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5yZXF1ZXN0cywgW1xuXHRcdFx0XHQvLyBNYW5pZmVzdFxuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL21hbmlmZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0Ly8gTWFjaGluZXNcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9tYWNoaW5lcy9sYXRlc3RgLCBoZWFkZXJzOiB7fSB9LFxuXHRcdFx0XHQvLyBTZXR0aW5nc1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3NldHRpbmdzL2xhdGVzdGAsIGhlYWRlcnM6IHt9IH0sXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3NldHRpbmdzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMCcgfSB9LFxuXHRcdFx0XHQvLyBLZXliaW5kaW5nc1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL2tleWJpbmRpbmdzL2xhdGVzdGAsIGhlYWRlcnM6IHt9IH0sXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL2tleWJpbmRpbmdzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMCcgfSB9LFxuXHRcdFx0XHQvLyBTbmlwcGV0c1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3NuaXBwZXRzL2xhdGVzdGAsIGhlYWRlcnM6IHt9IH0sXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3NuaXBwZXRzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMCcgfSB9LFxuXHRcdFx0XHQvLyBUYXNrc1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3Rhc2tzL2xhdGVzdGAsIGhlYWRlcnM6IHt9IH0sXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3Rhc2tzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMCcgfSB9LFxuXHRcdFx0XHQvLyBHbG9iYWwgc3RhdGVcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9nbG9iYWxTdGF0ZS9sYXRlc3RgLCBoZWFkZXJzOiB7fSB9LFxuXHRcdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9nbG9iYWxTdGF0ZWAsIGhlYWRlcnM6IHsgJ0lmLU1hdGNoJzogJzAnIH0gfSxcblx0XHRcdFx0Ly8gRXh0ZW5zaW9uc1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL2V4dGVuc2lvbnMvbGF0ZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0Ly8gUHJvbXB0c1xuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3Byb21wdHMvbGF0ZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2UvcHJvbXB0c2AsIGhlYWRlcnM6IHsgJ0lmLU1hdGNoJzogJzAnIH0gfSxcblx0XHRcdFx0Ly8gUHJvZmlsZXNcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9wcm9maWxlcy9sYXRlc3RgLCBoZWFkZXJzOiB7fSB9LFxuXHRcdFx0XHQvLyBNYW5pZmVzdFxuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL21hbmlmZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRcdFx0Ly8gTWFjaGluZXNcblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2UvbWFjaGluZXNgLCBoZWFkZXJzOiB7ICdJZi1NYXRjaCc6ICcwJyB9IH1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0IGZ1cnRoZXIgYXV0byBzeW5jIHJlcXVlc3RzIHdpdGhvdXQgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdC8vIFNldHVwIHRoZSBjbGllbnRcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdFx0XHRjb25zdCBjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCBjbGllbnQuc2V0VXAoKTtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHQvLyBTeW5jIG9uY2UgYW5kIHJlc2V0IHJlcXVlc3RzXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblx0XHRcdHRhcmdldC5yZXNldCgpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQucmVxdWVzdHMsIFtcblx0XHRcdFx0Ly8gTWFuaWZlc3Rcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9tYW5pZmVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9XG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdCBmdXJ0aGVyIGF1dG8gc3luYyByZXF1ZXN0cyB3aXRoIGNoYW5nZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBTZXR1cCB0aGUgY2xpZW50XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXHRcdFx0Y29uc3QgY2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgY2xpZW50LnNldFVwKCk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UpKTtcblxuXHRcdFx0Ly8gU3luYyBvbmNlIGFuZCByZXNldCByZXF1ZXN0c1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cdFx0XHR0YXJnZXQucmVzZXQoKTtcblxuXHRcdFx0Ly8gRG8gY2hhbmdlcyBpbiB0aGUgY2xpZW50XG5cdFx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRcdGF3YWl0IGZpbGVTZXJ2aWNlLndyaXRlRmlsZSh1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKEpTT04uc3RyaW5naWZ5KHsgJ2VkaXRvci5mb250U2l6ZSc6IDE0IH0pKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUua2V5YmluZGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeShbeyAnY29tbWFuZCc6ICdhYmNkJywgJ2tleSc6ICdjbWQrYycgfV0pKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoam9pblBhdGgodXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lLCAnaHRtbC5qc29uJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoYHt9YCkpO1xuXHRcdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnByb21wdHNIb21lLCAnaDEucHJvbXB0Lm1kJyksIFZTQnVmZmVyLmZyb21TdHJpbmcoJyAnKSk7XG5cdFx0XHRhd2FpdCBmaWxlU2VydmljZS53cml0ZUZpbGUoZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3ZSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhKU09OLnN0cmluZ2lmeSh7ICdsb2NhbGUnOiAnZGUnIH0pKSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQucmVxdWVzdHMsIFtcblx0XHRcdFx0Ly8gTWFuaWZlc3Rcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9tYW5pZmVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9LFxuXHRcdFx0XHQvLyBTZXR0aW5nc1xuXHRcdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9zZXR0aW5nc2AsIGhlYWRlcnM6IHsgJ0lmLU1hdGNoJzogJzEnIH0gfSxcblx0XHRcdFx0Ly8gS2V5YmluZGluZ3Ncblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2Uva2V5YmluZGluZ3NgLCBoZWFkZXJzOiB7ICdJZi1NYXRjaCc6ICcxJyB9IH0sXG5cdFx0XHRcdC8vIFNuaXBwZXRzXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL3NuaXBwZXRzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMScgfSB9LFxuXHRcdFx0XHQvLyBHbG9iYWwgc3RhdGVcblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2UvZ2xvYmFsU3RhdGVgLCBoZWFkZXJzOiB7ICdJZi1NYXRjaCc6ICcxJyB9IH0sXG5cdFx0XHRcdC8vIFByb21wdHNcblx0XHRcdFx0eyB0eXBlOiAnUE9TVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2UvcHJvbXB0c2AsIGhlYWRlcnM6IHsgJ0lmLU1hdGNoJzogJzEnIH0gfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0IGF1dG8gc3luYyBzZW5kIGV4ZWN1dGlvbiBpZCBoZWFkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHQvLyBTZXR1cCB0aGUgY2xpZW50XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXHRcdFx0Y29uc3QgY2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgY2xpZW50LnNldFVwKCk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UpKTtcblxuXHRcdFx0Ly8gU3luYyBvbmNlIGFuZCByZXNldCByZXF1ZXN0c1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cdFx0XHR0YXJnZXQucmVzZXQoKTtcblxuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cblx0XHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiB0YXJnZXQucmVxdWVzdHNXaXRoQWxsSGVhZGVycykge1xuXHRcdFx0XHRjb25zdCBoYXNFeGVjdXRpb25JZEhlYWRlciA9IHJlcXVlc3QuaGVhZGVycyAmJiByZXF1ZXN0LmhlYWRlcnNbJ1gtRXhlY3V0aW9uLUlkJ10gJiYgcmVxdWVzdC5oZWFkZXJzWydYLUV4ZWN1dGlvbi1JZCddLmxlbmd0aCA+IDA7XG5cdFx0XHRcdGlmIChyZXF1ZXN0LnVybC5zdGFydHNXaXRoKGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCkpIHtcblx0XHRcdFx0XHRhc3NlcnQub2soIWhhc0V4ZWN1dGlvbklkSGVhZGVyLCBgU2hvdWxkIG5vdCBoYXZlIGV4ZWN1dGlvbiBoZWFkZXI6ICR7cmVxdWVzdC51cmx9YCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGhhc0V4ZWN1dGlvbklkSGVhZGVyLCBgU2hvdWxkIGhhdmUgZXhlY3V0aW9uIGhlYWRlcjogJHtyZXF1ZXN0LnVybH1gKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0IGRlbGV0ZSBvbiBvbmUgY2xpZW50IHRocm93cyB0dXJuZWQgb2ZmIGVycm9yIG9uIG90aGVyIGNsaWVudCB3aGlsZSBzeW5jaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdGFyZ2V0ID0gbmV3IFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIoKTtcblxuXHRcdFx0Ly8gU2V0IHVwIGFuZCBzeW5jIGZyb20gdGhlIGNsaWVudFxuXHRcdFx0Y29uc3QgY2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgY2xpZW50LnNldFVwKCk7XG5cdFx0XHRhd2FpdCAoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFTeW5jU2VydmljZSkuY3JlYXRlU3luY1Rhc2sobnVsbCkpLnJ1bigpO1xuXG5cdFx0XHQvLyBTZXQgdXAgYW5kIHN5bmMgZnJvbSB0aGUgdGVzdCBjbGllbnRcblx0XHRcdGNvbnN0IHRlc3RDbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCB0ZXN0Q2xpZW50LnNldFVwKCk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlKSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0Ly8gUmVzZXQgZnJvbSB0aGUgZmlyc3QgY2xpZW50XG5cdFx0XHRhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTZXJ2aWNlKS5yZXNldCgpO1xuXG5cdFx0XHQvLyBTeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHR0YXJnZXQucmVzZXQoKTtcblxuXHRcdFx0Y29uc3QgZXJyb3JQcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKHRlc3RPYmplY3Qub25FcnJvcik7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0Y29uc3QgZSA9IGF3YWl0IGVycm9yUHJvbWlzZTtcblx0XHRcdGFzc2VydC5vayhlIGluc3RhbmNlb2YgVXNlckRhdGFBdXRvU3luY0Vycm9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKDxVc2VyRGF0YUF1dG9TeW5jRXJyb3I+ZSkuY29kZSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlR1cm5lZE9mZik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRhcmdldC5yZXF1ZXN0cywgW1xuXHRcdFx0XHQvLyBNYW5pZmVzdFxuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL21hbmlmZXN0YCwgaGVhZGVyczogeyAnSWYtTm9uZS1NYXRjaCc6ICcxJyB9IH0sXG5cdFx0XHRcdC8vIE1hY2hpbmVcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9yZXNvdXJjZS9tYWNoaW5lcy9sYXRlc3RgLCBoZWFkZXJzOiB7ICdJZi1Ob25lLU1hdGNoJzogJzEnIH0gfSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0ZXN0IGRpc2FibGluZyB0aGUgbWFjaGluZSB0dXJucyBvZmYgc3luYycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cblx0XHRcdC8vIFNldCB1cCBhbmQgc3luYyBmcm9tIHRoZSB0ZXN0IGNsaWVudFxuXHRcdFx0Y29uc3QgdGVzdENsaWVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudCh0YXJnZXQpKTtcblx0XHRcdGF3YWl0IHRlc3RDbGllbnQuc2V0VXAoKTtcblx0XHRcdGNvbnN0IHRlc3RPYmplY3Q6IFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQodGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UpKTtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYygpO1xuXG5cdFx0XHQvLyBEaXNhYmxlIGN1cnJlbnQgbWFjaGluZVxuXHRcdFx0Y29uc3QgdXNlckRhdGFTeW5jTWFjaGluZXNTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSk7XG5cdFx0XHRjb25zdCBtYWNoaW5lcyA9IGF3YWl0IHVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZS5nZXRNYWNoaW5lcygpO1xuXHRcdFx0Y29uc3QgY3VycmVudE1hY2hpbmUgPSBtYWNoaW5lcy5maW5kKG0gPT4gbS5pc0N1cnJlbnQpITtcblx0XHRcdGF3YWl0IHVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZS5zZXRFbmFibGVtZW50cyhbW2N1cnJlbnRNYWNoaW5lLmlkLCBmYWxzZV1dKTtcblxuXHRcdFx0dGFyZ2V0LnJlc2V0KCk7XG5cblx0XHRcdGNvbnN0IGVycm9yUHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRXJyb3IpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cblx0XHRcdGNvbnN0IGUgPSBhd2FpdCBlcnJvclByb21pc2U7XG5cdFx0XHRhc3NlcnQub2soZSBpbnN0YW5jZW9mIFVzZXJEYXRhQXV0b1N5bmNFcnJvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKCg8VXNlckRhdGFBdXRvU3luY0Vycm9yPmUpLmNvZGUsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5UdXJuZWRPZmYpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQucmVxdWVzdHMsIFtcblx0XHRcdFx0Ly8gTWFuaWZlc3Rcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9tYW5pZmVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9LFxuXHRcdFx0XHQvLyBNYWNoaW5lXG5cdFx0XHRcdHsgdHlwZTogJ0dFVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvcmVzb3VyY2UvbWFjaGluZXMvbGF0ZXN0YCwgaGVhZGVyczogeyAnSWYtTm9uZS1NYXRjaCc6ICcyJyB9IH0sXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMicgfSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgcmVtb3ZpbmcgdGhlIG1hY2hpbmUgYWRkcyBtYWNoaW5lIGJhY2snLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXG5cdFx0XHQvLyBTZXQgdXAgYW5kIHN5bmMgZnJvbSB0aGUgdGVzdCBjbGllbnRcblx0XHRcdGNvbnN0IHRlc3RDbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCB0ZXN0Q2xpZW50LnNldFVwKCk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlKSk7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0Ly8gUmVtb3ZlIGN1cnJlbnQgbWFjaGluZVxuXHRcdFx0YXdhaXQgdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY01hY2hpbmVzU2VydmljZSkucmVtb3ZlQ3VycmVudE1hY2hpbmUoKTtcblxuXHRcdFx0dGFyZ2V0LnJlc2V0KCk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYygpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0YXJnZXQucmVxdWVzdHMsIFtcblx0XHRcdFx0Ly8gTWFuaWZlc3Rcblx0XHRcdFx0eyB0eXBlOiAnR0VUJywgdXJsOiBgJHt0YXJnZXQudXJsfS92MS9tYW5pZmVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9LFxuXHRcdFx0XHQvLyBNYWNoaW5lXG5cdFx0XHRcdHsgdHlwZTogJ1BPU1QnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzYCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiAnMicgfSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgY3JlYXRpbmcgbmV3IHNlc3Npb24gZnJvbSBvbmUgY2xpZW50IHRocm93cyBzZXNzaW9uIGV4cGlyZWQgZXJyb3Igb24gYW5vdGhlciBjbGllbnQgd2hpbGUgc3luY2luZycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cblx0XHRcdC8vIFNldCB1cCBhbmQgc3luYyBmcm9tIHRoZSBjbGllbnRcblx0XHRcdGNvbnN0IGNsaWVudCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudCh0YXJnZXQpKTtcblx0XHRcdGF3YWl0IGNsaWVudC5zZXRVcCgpO1xuXHRcdFx0YXdhaXQgKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1NlcnZpY2UpLmNyZWF0ZVN5bmNUYXNrKG51bGwpKS5ydW4oKTtcblxuXHRcdFx0Ly8gU2V0IHVwIGFuZCBzeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHRjb25zdCB0ZXN0Q2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgdGVzdENsaWVudC5zZXRVcCgpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cblx0XHRcdC8vIFJlc2V0IGZyb20gdGhlIGZpcnN0IGNsaWVudFxuXHRcdFx0YXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFTeW5jU2VydmljZSkucmVzZXQoKTtcblxuXHRcdFx0Ly8gU3luYyBhZ2FpbiBmcm9tIHRoZSBmaXJzdCBjbGllbnQgdG8gY3JlYXRlIG5ldyBzZXNzaW9uXG5cdFx0XHRhd2FpdCAoYXdhaXQgY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFTeW5jU2VydmljZSkuY3JlYXRlU3luY1Rhc2sobnVsbCkpLnJ1bigpO1xuXG5cdFx0XHQvLyBTeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHR0YXJnZXQucmVzZXQoKTtcblxuXHRcdFx0Y29uc3QgZXJyb3JQcm9taXNlID0gRXZlbnQudG9Qcm9taXNlKHRlc3RPYmplY3Qub25FcnJvcik7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblxuXHRcdFx0Y29uc3QgZSA9IGF3YWl0IGVycm9yUHJvbWlzZTtcblx0XHRcdGFzc2VydC5vayhlIGluc3RhbmNlb2YgVXNlckRhdGFBdXRvU3luY0Vycm9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKDxVc2VyRGF0YUF1dG9TeW5jRXJyb3I+ZSkuY29kZSwgVXNlckRhdGFTeW5jRXJyb3JDb2RlLlNlc3Npb25FeHBpcmVkKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LnJlcXVlc3RzLCBbXG5cdFx0XHRcdC8vIE1hbmlmZXN0XG5cdFx0XHRcdHsgdHlwZTogJ0dFVCcsIHVybDogYCR7dGFyZ2V0LnVybH0vdjEvbWFuaWZlc3RgLCBoZWFkZXJzOiB7ICdJZi1Ob25lLU1hdGNoJzogJzEnIH0gfSxcblx0XHRcdFx0Ly8gTWFjaGluZVxuXHRcdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3RhcmdldC51cmx9L3YxL3Jlc291cmNlL21hY2hpbmVzL2xhdGVzdGAsIGhlYWRlcnM6IHsgJ0lmLU5vbmUtTWF0Y2gnOiAnMScgfSB9LFxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgcmF0ZSBsaW1pdCBvbiBzZXJ2ZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcig1KTtcblxuXHRcdFx0Ly8gU2V0IHVwIGFuZCBzeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHRjb25zdCB0ZXN0Q2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgdGVzdENsaWVudC5zZXRVcCgpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHRjb25zdCBlcnJvclByb21pc2UgPSBFdmVudC50b1Byb21pc2UodGVzdE9iamVjdC5vbkVycm9yKTtcblx0XHRcdHdoaWxlICh0YXJnZXQucmVxdWVzdHMubGVuZ3RoIDwgNSkge1xuXHRcdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZSA9IGF3YWl0IGVycm9yUHJvbWlzZTtcblx0XHRcdGFzc2VydC5vayhlIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jU3RvcmVFcnJvcik7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKCg8VXNlckRhdGFTeW5jU3RvcmVFcnJvcj5lKS5jb2RlLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuVG9vTWFueVJlcXVlc3RzKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndGVzdCBhdXRvIHN5bmMgaXMgc3VzcGVuZGVkIHdoZW4gc2VydmVyIGRvbm90IGFjY2VwdHMgcmVxdWVzdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcig1LCAxKTtcblxuXHRcdFx0Ly8gU2V0IHVwIGFuZCBzeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHRjb25zdCB0ZXN0Q2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgdGVzdENsaWVudC5zZXRVcCgpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHR3aGlsZSAodGFyZ2V0LnJlcXVlc3RzLmxlbmd0aCA8IDUpIHtcblx0XHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRhcmdldC5yZXNldCgpO1xuXHRcdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGFyZ2V0LnJlcXVlc3RzLCBbXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgY2FjaGUgY29udHJvbCBoZWFkZXIgd2l0aCBubyBjYWNoZSBpcyBzZW50IHdoZW4gdHJpZ2dlcmVkIHdpdGggZGlzYWJsZSBjYWNoZSBvcHRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0YXJnZXQgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcig1LCAxKTtcblxuXHRcdFx0Ly8gU2V0IHVwIGFuZCBzeW5jIGZyb20gdGhlIHRlc3QgY2xpZW50XG5cdFx0XHRjb25zdCB0ZXN0Q2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHRhcmdldCkpO1xuXHRcdFx0YXdhaXQgdGVzdENsaWVudC5zZXRVcCgpO1xuXHRcdFx0Y29uc3QgdGVzdE9iamVjdDogVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlID0gZGlzcG9zYWJsZVN0b3JlLmFkZCh0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RVc2VyRGF0YUF1dG9TeW5jU2VydmljZSkpO1xuXG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnRyaWdnZXJTeW5jKFsnc29tZSByZWFzb24nXSwgeyBkaXNhYmxlQ2FjaGU6IHRydWUgfSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGFyZ2V0LnJlcXVlc3RzV2l0aEFsbEhlYWRlcnNbMF0uaGVhZGVycyFbJ0NhY2hlLUNvbnRyb2wnXSwgJ25vLWNhY2hlJyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Rlc3QgY2FjaGUgY29udHJvbCBoZWFkZXIgaXMgbm90IHNlbnQgd2hlbiB0cmlnZ2VyZWQgd2l0aG91dCBkaXNhYmxlIGNhY2hlIG9wdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHRhcmdldCA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKDUsIDEpO1xuXG5cdFx0XHQvLyBTZXQgdXAgYW5kIHN5bmMgZnJvbSB0aGUgdGVzdCBjbGllbnRcblx0XHRcdGNvbnN0IHRlc3RDbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQodGFyZ2V0KSk7XG5cdFx0XHRhd2FpdCB0ZXN0Q2xpZW50LnNldFVwKCk7XG5cdFx0XHRjb25zdCB0ZXN0T2JqZWN0OiBUZXN0VXNlckRhdGFBdXRvU3luY1NlcnZpY2UgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFVzZXJEYXRhQXV0b1N5bmNTZXJ2aWNlKSk7XG5cblx0XHRcdGF3YWl0IHRlc3RPYmplY3QudHJpZ2dlclN5bmMoWydzb21lIHJlYXNvbiddKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQucmVxdWVzdHNXaXRoQWxsSGVhZGVyc1swXS5oZWFkZXJzIVsnQ2FjaGUtQ29udHJvbCddLCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXHR9KTtcblxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsc0JBQXNCLGNBQWMsdUJBQXVCLHVCQUF1Qiw4QkFBOEI7QUFDekgsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxvQkFBb0IsOEJBQThCO0FBRTNELE1BQU0sb0NBQW9DLHdCQUF3QjtBQUFBLEVBQzlDLGdCQUF5QjtBQUFFLFdBQU87QUFBQSxFQUFPO0FBQUEsRUFDekMsMEJBQWtDO0FBQUUsV0FBTztBQUFBLEVBQUk7QUFBQSxFQUVsRSxPQUFzQjtBQUNyQixXQUFPLEtBQUssWUFBWSxDQUFDLE1BQU0sQ0FBQztBQUFBLEVBQ2pDO0FBQ0Q7QUFFQSxNQUFNLDJCQUEyQixNQUFNO0FBRXRDLFFBQU0sa0JBQWtCLHdDQUF3QztBQUVoRSxPQUFLLDBEQUEwRCxZQUFZO0FBQzFFLFVBQU0sbUJBQW1CLENBQUMsR0FBRyxZQUFZO0FBRXhDLFlBQU0sU0FBUyxJQUFJLHVCQUF1QjtBQUMxQyxZQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ2pFLFlBQU0sT0FBTyxNQUFNO0FBR25CLGFBQU8sTUFBTSxPQUFPLHFCQUFxQixJQUFJLG9CQUFvQixFQUFFLGVBQWUsSUFBSSxHQUFHLElBQUk7QUFDN0YsYUFBTyxNQUFNO0FBRWIsWUFBTSxhQUFzQyxnQkFBZ0IsSUFBSSxPQUFPLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBR3ZJLFlBQU0sV0FBVyxZQUFZLENBQUMsYUFBYSxRQUFRLENBQUM7QUFHcEQsWUFBTSxTQUFTLE9BQU8sU0FBUyxPQUFPLGFBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxHQUFHLE9BQU8sR0FBRyx1QkFBdUIsQ0FBQztBQUc5RyxhQUFPLGdCQUFnQixRQUFRLENBQUMsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQUEsSUFDaEcsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssMkVBQTJFLFlBQVk7QUFDM0YsVUFBTSxtQkFBbUIsQ0FBQyxHQUFHLFlBQVk7QUFFeEMsWUFBTSxTQUFTLElBQUksdUJBQXVCO0FBQzFDLFlBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDakUsWUFBTSxPQUFPLE1BQU07QUFHbkIsYUFBTyxNQUFNLE9BQU8scUJBQXFCLElBQUksb0JBQW9CLEVBQUUsZUFBZSxJQUFJLEdBQUcsSUFBSTtBQUM3RixhQUFPLE1BQU07QUFFYixZQUFNLGFBQXNDLGdCQUFnQixJQUFJLE9BQU8scUJBQXFCLGVBQWUsMkJBQTJCLENBQUM7QUFHdkksZUFBUyxVQUFVLEdBQUcsVUFBVSxHQUFHLFdBQVc7QUFDN0MsY0FBTSxXQUFXLFlBQVksQ0FBQyxhQUFhLFFBQVEsQ0FBQztBQUFBLE1BQ3JEO0FBR0EsWUFBTSxTQUFTLE9BQU8sU0FBUyxPQUFPLGFBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxHQUFHLE9BQU8sR0FBRyx1QkFBdUIsQ0FBQztBQUU5RyxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUM3RCxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBLE1BQ3BGLENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDhEQUE4RCxZQUFZO0FBQzlFLFVBQU0sbUJBQW1CLENBQUMsR0FBRyxZQUFZO0FBRXhDLFlBQU0sU0FBUyxJQUFJLHVCQUF1QjtBQUMxQyxZQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ2pFLFlBQU0sT0FBTyxNQUFNO0FBR25CLGFBQU8sTUFBTSxPQUFPLHFCQUFxQixJQUFJLG9CQUFvQixFQUFFLGVBQWUsSUFBSSxHQUFHLElBQUk7QUFDN0YsYUFBTyxNQUFNO0FBRWIsWUFBTSxhQUFzQyxnQkFBZ0IsSUFBSSxPQUFPLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBR3ZJLFlBQU0sV0FBVyxZQUFZLENBQUMsYUFBYSxDQUFDO0FBRzVDLFlBQU0sU0FBUyxPQUFPLFNBQVMsT0FBTyxhQUFXLENBQUMsUUFBUSxJQUFJLFdBQVcsR0FBRyxPQUFPLEdBQUcsdUJBQXVCLENBQUM7QUFHOUcsYUFBTyxnQkFBZ0IsUUFBUSxDQUFDLEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsZ0JBQWdCLFNBQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUFBLElBQ2hHLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGtGQUFrRixZQUFZO0FBQ2xHLFVBQU0sbUJBQW1CLENBQUMsR0FBRyxZQUFZO0FBRXhDLFlBQU0sU0FBUyxJQUFJLHVCQUF1QjtBQUMxQyxZQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ2pFLFlBQU0sT0FBTyxNQUFNO0FBR25CLGFBQU8sTUFBTSxPQUFPLHFCQUFxQixJQUFJLG9CQUFvQixFQUFFLGVBQWUsSUFBSSxHQUFHLElBQUk7QUFDN0YsYUFBTyxNQUFNO0FBRWIsWUFBTSxhQUFzQyxnQkFBZ0IsSUFBSSxPQUFPLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBR3ZJLGVBQVMsVUFBVSxHQUFHLFVBQVUsR0FBRyxXQUFXO0FBQzdDLGNBQU0sV0FBVyxZQUFZLENBQUMsYUFBYSxHQUFHLEVBQUUsc0JBQXNCLEtBQUssQ0FBQztBQUFBLE1BQzdFO0FBR0EsWUFBTSxTQUFTLE9BQU8sU0FBUyxPQUFPLGFBQVcsQ0FBQyxRQUFRLElBQUksV0FBVyxHQUFHLE9BQU8sR0FBRyx1QkFBdUIsQ0FBQztBQUc5RyxhQUFPLGdCQUFnQixRQUFRLENBQUMsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsU0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDO0FBQUEsSUFDaEcsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssaUNBQWlDLFlBQVk7QUFDakQsVUFBTSxtQkFBbUIsQ0FBQyxHQUFHLFlBQVk7QUFFeEMsWUFBTSxTQUFTLElBQUksdUJBQXVCO0FBQzFDLFlBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDakUsWUFBTSxPQUFPLE1BQU07QUFDbkIsWUFBTSxhQUEwQyxnQkFBZ0IsSUFBSSxPQUFPLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBRTNJLFlBQU0sV0FBVyxLQUFLO0FBRXRCLGFBQU8sZ0JBQWdCLE9BQU8sVUFBVTtBQUFBO0FBQUEsUUFFdkMsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsU0FBUyxDQUFDLEVBQUU7QUFBQTtBQUFBLFFBRTdELEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsZ0NBQWdDLFNBQVMsQ0FBQyxFQUFFO0FBQUE7QUFBQSxRQUU3RSxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdDQUFnQyxTQUFTLENBQUMsRUFBRTtBQUFBLFFBQzdFLEVBQUUsTUFBTSxRQUFRLEtBQUssR0FBRyxPQUFPLEdBQUcseUJBQXlCLFNBQVMsRUFBRSxZQUFZLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFeEYsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxtQ0FBbUMsU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUNoRixFQUFFLE1BQU0sUUFBUSxLQUFLLEdBQUcsT0FBTyxHQUFHLDRCQUE0QixTQUFTLEVBQUUsWUFBWSxJQUFJLEVBQUU7QUFBQTtBQUFBLFFBRTNGLEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsZ0NBQWdDLFNBQVMsQ0FBQyxFQUFFO0FBQUEsUUFDN0UsRUFBRSxNQUFNLFFBQVEsS0FBSyxHQUFHLE9BQU8sR0FBRyx5QkFBeUIsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFO0FBQUE7QUFBQSxRQUV4RixFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLDZCQUE2QixTQUFTLENBQUMsRUFBRTtBQUFBLFFBQzFFLEVBQUUsTUFBTSxRQUFRLEtBQUssR0FBRyxPQUFPLEdBQUcsc0JBQXNCLFNBQVMsRUFBRSxZQUFZLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFckYsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxtQ0FBbUMsU0FBUyxDQUFDLEVBQUU7QUFBQSxRQUNoRixFQUFFLE1BQU0sUUFBUSxLQUFLLEdBQUcsT0FBTyxHQUFHLDRCQUE0QixTQUFTLEVBQUUsWUFBWSxJQUFJLEVBQUU7QUFBQTtBQUFBLFFBRTNGLEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsa0NBQWtDLFNBQVMsQ0FBQyxFQUFFO0FBQUE7QUFBQSxRQUUvRSxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLCtCQUErQixTQUFTLENBQUMsRUFBRTtBQUFBLFFBQzVFLEVBQUUsTUFBTSxRQUFRLEtBQUssR0FBRyxPQUFPLEdBQUcsd0JBQXdCLFNBQVMsRUFBRSxZQUFZLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFdkYsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQ0FBZ0MsU0FBUyxDQUFDLEVBQUU7QUFBQTtBQUFBLFFBRTdFLEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsZ0JBQWdCLFNBQVMsQ0FBQyxFQUFFO0FBQUE7QUFBQSxRQUU3RCxFQUFFLE1BQU0sUUFBUSxLQUFLLEdBQUcsT0FBTyxHQUFHLHlCQUF5QixTQUFTLEVBQUUsWUFBWSxJQUFJLEVBQUU7QUFBQSxNQUN6RixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxtREFBbUQsWUFBWTtBQUNuRSxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUV4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUI7QUFDMUMsWUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUNqRSxZQUFNLE9BQU8sTUFBTTtBQUNuQixZQUFNLGFBQTBDLGdCQUFnQixJQUFJLE9BQU8scUJBQXFCLGVBQWUsMkJBQTJCLENBQUM7QUFHM0ksWUFBTSxXQUFXLEtBQUs7QUFDdEIsYUFBTyxNQUFNO0FBRWIsWUFBTSxXQUFXLEtBQUs7QUFFdEIsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUV2QyxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBLE1BQ3BGLENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGdEQUFnRCxZQUFZO0FBQ2hFLFVBQU0sbUJBQW1CLENBQUMsR0FBRyxZQUFZO0FBRXhDLFlBQU0sU0FBUyxJQUFJLHVCQUF1QjtBQUMxQyxZQUFNLFNBQVMsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ2pFLFlBQU0sT0FBTyxNQUFNO0FBQ25CLFlBQU0sYUFBMEMsZ0JBQWdCLElBQUksT0FBTyxxQkFBcUIsZUFBZSwyQkFBMkIsQ0FBQztBQUczSSxZQUFNLFdBQVcsS0FBSztBQUN0QixhQUFPLE1BQU07QUFHYixZQUFNLGNBQWMsT0FBTyxxQkFBcUIsSUFBSSxZQUFZO0FBQ2hFLFlBQU0scUJBQXFCLE9BQU8scUJBQXFCLElBQUksbUJBQW1CO0FBQzlFLFlBQU0sMEJBQTBCLE9BQU8scUJBQXFCLElBQUksd0JBQXdCO0FBQ3hGLFlBQU0sWUFBWSxVQUFVLHdCQUF3QixlQUFlLGtCQUFrQixTQUFTLFdBQVcsS0FBSyxVQUFVLEVBQUUsbUJBQW1CLEdBQUcsQ0FBQyxDQUFDLENBQUM7QUFDbkosWUFBTSxZQUFZLFVBQVUsd0JBQXdCLGVBQWUscUJBQXFCLFNBQVMsV0FBVyxLQUFLLFVBQVUsQ0FBQyxFQUFFLFdBQVcsUUFBUSxPQUFPLFFBQVEsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUNwSyxZQUFNLFlBQVksVUFBVSxTQUFTLHdCQUF3QixlQUFlLGNBQWMsV0FBVyxHQUFHLFNBQVMsV0FBVyxJQUFJLENBQUM7QUFDakksWUFBTSxZQUFZLFVBQVUsU0FBUyx3QkFBd0IsZUFBZSxhQUFhLGNBQWMsR0FBRyxTQUFTLFdBQVcsR0FBRyxDQUFDO0FBQ2xJLFlBQU0sWUFBWSxVQUFVLG1CQUFtQixjQUFjLFNBQVMsV0FBVyxLQUFLLFVBQVUsRUFBRSxVQUFVLEtBQUssQ0FBQyxDQUFDLENBQUM7QUFDcEgsWUFBTSxXQUFXLEtBQUs7QUFFdEIsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUV2QyxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFbkYsRUFBRSxNQUFNLFFBQVEsS0FBSyxHQUFHLE9BQU8sR0FBRyx5QkFBeUIsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFO0FBQUE7QUFBQSxRQUV4RixFQUFFLE1BQU0sUUFBUSxLQUFLLEdBQUcsT0FBTyxHQUFHLDRCQUE0QixTQUFTLEVBQUUsWUFBWSxJQUFJLEVBQUU7QUFBQTtBQUFBLFFBRTNGLEVBQUUsTUFBTSxRQUFRLEtBQUssR0FBRyxPQUFPLEdBQUcseUJBQXlCLFNBQVMsRUFBRSxZQUFZLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFeEYsRUFBRSxNQUFNLFFBQVEsS0FBSyxHQUFHLE9BQU8sR0FBRyw0QkFBNEIsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFO0FBQUE7QUFBQSxRQUUzRixFQUFFLE1BQU0sUUFBUSxLQUFLLEdBQUcsT0FBTyxHQUFHLHdCQUF3QixTQUFTLEVBQUUsWUFBWSxJQUFJLEVBQUU7QUFBQSxNQUN4RixDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSywyQ0FBMkMsWUFBWTtBQUMzRCxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUV4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUI7QUFDMUMsWUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUNqRSxZQUFNLE9BQU8sTUFBTTtBQUNuQixZQUFNLGFBQTBDLGdCQUFnQixJQUFJLE9BQU8scUJBQXFCLGVBQWUsMkJBQTJCLENBQUM7QUFHM0ksWUFBTSxXQUFXLEtBQUs7QUFDdEIsYUFBTyxNQUFNO0FBRWIsWUFBTSxXQUFXLEtBQUs7QUFFdEIsaUJBQVcsV0FBVyxPQUFPLHdCQUF3QjtBQUNwRCxjQUFNLHVCQUF1QixRQUFRLFdBQVcsUUFBUSxRQUFRLGdCQUFnQixLQUFLLFFBQVEsUUFBUSxnQkFBZ0IsRUFBRSxTQUFTO0FBQ2hJLFlBQUksUUFBUSxJQUFJLFdBQVcsR0FBRyxPQUFPLEdBQUcsdUJBQXVCLEdBQUc7QUFDakUsaUJBQU8sR0FBRyxDQUFDLHNCQUFzQixxQ0FBcUMsUUFBUSxHQUFHLEVBQUU7QUFBQSxRQUNwRixPQUFPO0FBQ04saUJBQU8sR0FBRyxzQkFBc0IsaUNBQWlDLFFBQVEsR0FBRyxFQUFFO0FBQUEsUUFDL0U7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxtRkFBbUYsWUFBWTtBQUNuRyxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUN4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUI7QUFHMUMsWUFBTSxTQUFTLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUNqRSxZQUFNLE9BQU8sTUFBTTtBQUNuQixhQUFPLE1BQU0sT0FBTyxxQkFBcUIsSUFBSSxvQkFBb0IsRUFBRSxlQUFlLElBQUksR0FBRyxJQUFJO0FBRzdGLFlBQU0sYUFBYSxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDckUsWUFBTSxXQUFXLE1BQU07QUFDdkIsWUFBTSxhQUEwQyxnQkFBZ0IsSUFBSSxXQUFXLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBQy9JLFlBQU0sV0FBVyxLQUFLO0FBR3RCLFlBQU0sT0FBTyxxQkFBcUIsSUFBSSxvQkFBb0IsRUFBRSxNQUFNO0FBR2xFLGFBQU8sTUFBTTtBQUViLFlBQU0sZUFBZSxNQUFNLFVBQVUsV0FBVyxPQUFPO0FBQ3ZELFlBQU0sV0FBVyxLQUFLO0FBRXRCLFlBQU0sSUFBSSxNQUFNO0FBQ2hCLGFBQU8sR0FBRyxhQUFhLHFCQUFxQjtBQUM1QyxhQUFPLGdCQUF3QyxFQUFHLE1BQU0sc0JBQXNCLFNBQVM7QUFDdkYsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUV2QyxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFbkYsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQ0FBZ0MsU0FBUyxFQUFFLGlCQUFpQixJQUFJLEVBQUU7QUFBQSxNQUNwRyxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw2Q0FBNkMsWUFBWTtBQUM3RCxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUN4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUI7QUFHMUMsWUFBTSxhQUFhLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUNyRSxZQUFNLFdBQVcsTUFBTTtBQUN2QixZQUFNLGFBQTBDLGdCQUFnQixJQUFJLFdBQVcscUJBQXFCLGVBQWUsMkJBQTJCLENBQUM7QUFDL0ksWUFBTSxXQUFXLEtBQUs7QUFHdEIsWUFBTSw4QkFBOEIsV0FBVyxxQkFBcUIsSUFBSSw0QkFBNEI7QUFDcEcsWUFBTSxXQUFXLE1BQU0sNEJBQTRCLFlBQVk7QUFDL0QsWUFBTSxpQkFBaUIsU0FBUyxLQUFLLE9BQUssRUFBRSxTQUFTO0FBQ3JELFlBQU0sNEJBQTRCLGVBQWUsQ0FBQyxDQUFDLGVBQWUsSUFBSSxLQUFLLENBQUMsQ0FBQztBQUU3RSxhQUFPLE1BQU07QUFFYixZQUFNLGVBQWUsTUFBTSxVQUFVLFdBQVcsT0FBTztBQUN2RCxZQUFNLFdBQVcsS0FBSztBQUV0QixZQUFNLElBQUksTUFBTTtBQUNoQixhQUFPLEdBQUcsYUFBYSxxQkFBcUI7QUFDNUMsYUFBTyxnQkFBd0MsRUFBRyxNQUFNLHNCQUFzQixTQUFTO0FBQ3ZGLGFBQU8sZ0JBQWdCLE9BQU8sVUFBVTtBQUFBO0FBQUEsUUFFdkMsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQkFBZ0IsU0FBUyxFQUFFLGlCQUFpQixJQUFJLEVBQUU7QUFBQTtBQUFBLFFBRW5GLEVBQUUsTUFBTSxPQUFPLEtBQUssR0FBRyxPQUFPLEdBQUcsZ0NBQWdDLFNBQVMsRUFBRSxpQkFBaUIsSUFBSSxFQUFFO0FBQUEsUUFDbkcsRUFBRSxNQUFNLFFBQVEsS0FBSyxHQUFHLE9BQU8sR0FBRyx5QkFBeUIsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFO0FBQUEsTUFDekYsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssK0NBQStDLFlBQVk7QUFDL0QsVUFBTSxtQkFBbUIsQ0FBQyxHQUFHLFlBQVk7QUFDeEMsWUFBTSxTQUFTLElBQUksdUJBQXVCO0FBRzFDLFlBQU0sYUFBYSxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDckUsWUFBTSxXQUFXLE1BQU07QUFDdkIsWUFBTSxhQUEwQyxnQkFBZ0IsSUFBSSxXQUFXLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBQy9JLFlBQU0sV0FBVyxLQUFLO0FBR3RCLFlBQU0sV0FBVyxxQkFBcUIsSUFBSSw0QkFBNEIsRUFBRSxxQkFBcUI7QUFFN0YsYUFBTyxNQUFNO0FBRWIsWUFBTSxXQUFXLEtBQUs7QUFDdEIsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUV2QyxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFbkYsRUFBRSxNQUFNLFFBQVEsS0FBSyxHQUFHLE9BQU8sR0FBRyx5QkFBeUIsU0FBUyxFQUFFLFlBQVksSUFBSSxFQUFFO0FBQUEsTUFDekYsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssMEdBQTBHLFlBQVk7QUFDMUgsVUFBTSxtQkFBbUIsQ0FBQyxHQUFHLFlBQVk7QUFDeEMsWUFBTSxTQUFTLElBQUksdUJBQXVCO0FBRzFDLFlBQU0sU0FBUyxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDakUsWUFBTSxPQUFPLE1BQU07QUFDbkIsYUFBTyxNQUFNLE9BQU8scUJBQXFCLElBQUksb0JBQW9CLEVBQUUsZUFBZSxJQUFJLEdBQUcsSUFBSTtBQUc3RixZQUFNLGFBQWEsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ3JFLFlBQU0sV0FBVyxNQUFNO0FBQ3ZCLFlBQU0sYUFBMEMsZ0JBQWdCLElBQUksV0FBVyxxQkFBcUIsZUFBZSwyQkFBMkIsQ0FBQztBQUMvSSxZQUFNLFdBQVcsS0FBSztBQUd0QixZQUFNLE9BQU8scUJBQXFCLElBQUksb0JBQW9CLEVBQUUsTUFBTTtBQUdsRSxhQUFPLE1BQU0sT0FBTyxxQkFBcUIsSUFBSSxvQkFBb0IsRUFBRSxlQUFlLElBQUksR0FBRyxJQUFJO0FBRzdGLGFBQU8sTUFBTTtBQUViLFlBQU0sZUFBZSxNQUFNLFVBQVUsV0FBVyxPQUFPO0FBQ3ZELFlBQU0sV0FBVyxLQUFLO0FBRXRCLFlBQU0sSUFBSSxNQUFNO0FBQ2hCLGFBQU8sR0FBRyxhQUFhLHFCQUFxQjtBQUM1QyxhQUFPLGdCQUF3QyxFQUFHLE1BQU0sc0JBQXNCLGNBQWM7QUFDNUYsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVO0FBQUE7QUFBQSxRQUV2QyxFQUFFLE1BQU0sT0FBTyxLQUFLLEdBQUcsT0FBTyxHQUFHLGdCQUFnQixTQUFTLEVBQUUsaUJBQWlCLElBQUksRUFBRTtBQUFBO0FBQUEsUUFFbkYsRUFBRSxNQUFNLE9BQU8sS0FBSyxHQUFHLE9BQU8sR0FBRyxnQ0FBZ0MsU0FBUyxFQUFFLGlCQUFpQixJQUFJLEVBQUU7QUFBQSxNQUNwRyxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw2QkFBNkIsWUFBWTtBQUM3QyxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUN4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUIsQ0FBQztBQUczQyxZQUFNLGFBQWEsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQ3JFLFlBQU0sV0FBVyxNQUFNO0FBQ3ZCLFlBQU0sYUFBMEMsZ0JBQWdCLElBQUksV0FBVyxxQkFBcUIsZUFBZSwyQkFBMkIsQ0FBQztBQUUvSSxZQUFNLGVBQWUsTUFBTSxVQUFVLFdBQVcsT0FBTztBQUN2RCxhQUFPLE9BQU8sU0FBUyxTQUFTLEdBQUc7QUFDbEMsY0FBTSxXQUFXLEtBQUs7QUFBQSxNQUN2QjtBQUVBLFlBQU0sSUFBSSxNQUFNO0FBQ2hCLGFBQU8sR0FBRyxhQUFhLHNCQUFzQjtBQUM3QyxhQUFPLGdCQUF5QyxFQUFHLE1BQU0sc0JBQXNCLGVBQWU7QUFBQSxJQUMvRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxrRUFBa0UsWUFBWTtBQUNsRixVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUN4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUIsR0FBRyxDQUFDO0FBRzlDLFlBQU0sYUFBYSxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDckUsWUFBTSxXQUFXLE1BQU07QUFDdkIsWUFBTSxhQUEwQyxnQkFBZ0IsSUFBSSxXQUFXLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBRS9JLGFBQU8sT0FBTyxTQUFTLFNBQVMsR0FBRztBQUNsQyxjQUFNLFdBQVcsS0FBSztBQUFBLE1BQ3ZCO0FBRUEsYUFBTyxNQUFNO0FBQ2IsWUFBTSxXQUFXLEtBQUs7QUFFdEIsYUFBTyxnQkFBZ0IsT0FBTyxVQUFVLENBQUMsQ0FBQztBQUFBLElBQzNDLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDRGQUE0RixZQUFZO0FBQzVHLFVBQU0sbUJBQW1CLENBQUMsR0FBRyxZQUFZO0FBQ3hDLFlBQU0sU0FBUyxJQUFJLHVCQUF1QixHQUFHLENBQUM7QUFHOUMsWUFBTSxhQUFhLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUNyRSxZQUFNLFdBQVcsTUFBTTtBQUN2QixZQUFNLGFBQTBDLGdCQUFnQixJQUFJLFdBQVcscUJBQXFCLGVBQWUsMkJBQTJCLENBQUM7QUFFL0ksWUFBTSxXQUFXLFlBQVksQ0FBQyxhQUFhLEdBQUcsRUFBRSxjQUFjLEtBQUssQ0FBQztBQUNwRSxhQUFPLFlBQVksT0FBTyx1QkFBdUIsQ0FBQyxFQUFFLFFBQVMsZUFBZSxHQUFHLFVBQVU7QUFBQSxJQUMxRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxxRkFBcUYsWUFBWTtBQUNyRyxVQUFNLG1CQUFtQixDQUFDLEdBQUcsWUFBWTtBQUN4QyxZQUFNLFNBQVMsSUFBSSx1QkFBdUIsR0FBRyxDQUFDO0FBRzlDLFlBQU0sYUFBYSxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDckUsWUFBTSxXQUFXLE1BQU07QUFDdkIsWUFBTSxhQUEwQyxnQkFBZ0IsSUFBSSxXQUFXLHFCQUFxQixlQUFlLDJCQUEyQixDQUFDO0FBRS9JLFlBQU0sV0FBVyxZQUFZLENBQUMsYUFBYSxDQUFDO0FBQzVDLGFBQU8sWUFBWSxPQUFPLHVCQUF1QixDQUFDLEVBQUUsUUFBUyxlQUFlLEdBQUcsTUFBUztBQUFBLElBQ3pGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
