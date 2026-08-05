import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { Event } from "../../../../base/common/event.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IConfigurationService } from "../../../configuration/common/configuration.js";
import { ConfigurationScope, Extensions } from "../../../configuration/common/configurationRegistry.js";
import { IFileService } from "../../../files/common/files.js";
import { Registry } from "../../../registry/common/platform.js";
import { IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { parseSettingsSyncContent } from "../../common/settingsSync.js";
import { IUserDataSyncStoreService, SyncResource, SyncStatus, UserDataSyncError, UserDataSyncErrorCode } from "../../common/userDataSync.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "./userDataSyncClient.js";
suite("SettingsSync - Auto", () => {
  const server = new UserDataSyncTestServer();
  let client;
  let testObject;
  teardown(async () => {
    await client.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    Registry.as(Extensions.Configuration).registerConfiguration({
      "id": "settingsSync",
      "type": "object",
      "properties": {
        "settingsSync.machine": {
          "type": "string",
          "scope": ConfigurationScope.MACHINE
        },
        "settingsSync.machineOverridable": {
          "type": "string",
          "scope": ConfigurationScope.MACHINE_OVERRIDABLE
        }
      }
    });
    client = disposableStore.add(new UserDataSyncClient(server));
    await client.setUp(true);
    testObject = client.getSynchronizer(SyncResource.Settings);
  });
  test("when settings file does not exist", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const fileService = client.instantiationService.get(IFileService);
    const settingResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
    assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
    let manifest = await client.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, [
      { type: "GET", url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} }
    ]);
    assert.ok(!await fileService.exists(settingResource));
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
  }));
  test("when settings file is empty and remote has no changes", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const fileService = client.instantiationService.get(IFileService);
    const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
    await fileService.writeFile(settingsResource, VSBuffer.fromString(""));
    await testObject.sync(await client.getResourceManifest());
    const lastSyncUserData = await testObject.getLastSyncUserData();
    const remoteUserData = await testObject.getRemoteUserData(null);
    assert.strictEqual(parseSettingsSyncContent(lastSyncUserData.syncData.content)?.settings, "{}");
    assert.strictEqual(parseSettingsSyncContent(remoteUserData.syncData.content)?.settings, "{}");
    assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), "");
  }));
  test("when settings file is empty and remote has changes", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const client2 = disposableStore.add(new UserDataSyncClient(server));
    await client2.setUp(true);
    const content = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	},

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;
    await client2.instantiationService.get(IFileService).writeFile(client2.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource, VSBuffer.fromString(content));
    await client2.sync();
    const fileService = client.instantiationService.get(IFileService);
    const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
    await fileService.writeFile(settingsResource, VSBuffer.fromString(""));
    await testObject.sync(await client.getResourceManifest());
    const lastSyncUserData = await testObject.getLastSyncUserData();
    const remoteUserData = await testObject.getRemoteUserData(null);
    assert.strictEqual(parseSettingsSyncContent(lastSyncUserData.syncData.content)?.settings, content);
    assert.strictEqual(parseSettingsSyncContent(remoteUserData.syncData.content)?.settings, content);
    assert.strictEqual((await fileService.readFile(settingsResource)).value.toString(), content);
  }));
  test("when settings file is created after first sync", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const fileService = client.instantiationService.get(IFileService);
    const settingsResource = client.instantiationService.get(IUserDataProfilesService).defaultProfile.settingsResource;
    await testObject.sync(await client.getResourceManifest());
    await fileService.createFile(settingsResource, VSBuffer.fromString("{}"));
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
    assert.strictEqual(parseSettingsSyncContent(lastSyncUserData.syncData.content)?.settings, "{}");
  }));
  test("sync for first time to the server", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const expected = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	},

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;
    await updateSettings(expected, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, expected);
  }));
  test("do not sync machine settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
  }));
  test("do not sync machine settings when spread across file", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue"
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp"
}`);
  }));
  test("do not sync machine settings when spread across file - 2", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"settingsSync.machine": "someValue",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Machine
	"settingsSync.machineOverridable": "someValue",
	"files.simpleDialog.enable": true,
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"files.simpleDialog.enable": true,
}`);
  }));
  test("sync when all settings are machine settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue"
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
}`);
  }));
  test("sync when all settings are machine settings with trailing comma", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Machine
	"settingsSync.machine": "someValue",
	"settingsSync.machineOverridable": "someValue",
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	,
}`);
  }));
  test("local change event is triggered when settings are changed", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const content = `{
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,
}`;
    await updateSettings(content, client);
    await testObject.sync(await client.getResourceManifest());
    const promise = Event.toPromise(testObject.onDidChangeLocal);
    await updateSettings(`{
	"files.autoSave": "off",
	"files.simpleDialog.enable": true,
}`, client);
    await promise;
  }));
  test("do not sync ignored settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`);
  }));
  test("do not sync ignored and machine settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],

	// Machine
	"settingsSync.machine": "someValue",
}`;
    await updateSettings(settingsContent, client);
    await testObject.sync(await client.getResourceManifest());
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	],
}`);
  }));
  test("sync throws invalid content error", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const expected = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",
	"workbench.tree.indent": 20,
	"workbench.colorCustomizations": {
		"editorLineNumber.activeForeground": "#ff0000",
		"[GitHub Sharp]": {
			"statusBarItem.remoteBackground": "#24292E",
			"editorPane.background": "#f3f1f11a"
		}
	}

	"gitBranch.base": "remote-repo/master",

	// Experimental
	"workbench.view.experimental.allowMovingToNewContainer": true,
}`;
    await updateSettings(expected, client);
    try {
      await testObject.sync(await client.getResourceManifest());
      assert.fail("should fail with invalid content error");
    } catch (e) {
      assert.ok(e instanceof UserDataSyncError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.LocalInvalidContent);
    }
  }));
  test("sync throws invalid content error - content is an array", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    await updateSettings("[]", client);
    try {
      await testObject.sync(await client.getResourceManifest());
      assert.fail("should fail with invalid content error");
    } catch (e) {
      assert.ok(e instanceof UserDataSyncError);
      assert.deepStrictEqual(e.code, UserDataSyncErrorCode.LocalInvalidContent);
    }
  }));
  test("sync when there are conflicts", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const client2 = disposableStore.add(new UserDataSyncClient(server));
    await client2.setUp(true);
    await updateSettings(JSON.stringify({
      "a": 1,
      "b": 2,
      "settingsSync.ignoredSettings": ["a"]
    }), client2);
    await client2.sync();
    await updateSettings(JSON.stringify({
      "a": 2,
      "b": 1,
      "settingsSync.ignoredSettings": ["a"]
    }), client);
    await testObject.sync(await client.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assert.strictEqual(testObject.conflicts.conflicts[0].localResource.toString(), testObject.localResource.toString());
    const fileService = client.instantiationService.get(IFileService);
    const mergeContent = (await fileService.readFile(testObject.conflicts.conflicts[0].previewResource)).value.toString();
    assert.strictEqual(mergeContent, "");
  }));
  test("sync profile settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const client2 = disposableStore.add(new UserDataSyncClient(server));
    await client2.setUp(true);
    const profile = await client2.instantiationService.get(IUserDataProfilesService).createNamedProfile("profile1");
    await updateSettings(JSON.stringify({
      "a": 1,
      "b": 2
    }), client2, profile);
    await client2.sync();
    await client.sync();
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    const syncedProfile = client.instantiationService.get(IUserDataProfilesService).profiles.find((p) => p.id === profile.id);
    const content = (await client.instantiationService.get(IFileService).readFile(syncedProfile.settingsResource)).value.toString();
    assert.deepStrictEqual(JSON.parse(content), {
      "a": 1,
      "b": 2
    });
  }));
});
suite("SettingsSync - Manual", () => {
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
    testObject = client.getSynchronizer(SyncResource.Settings);
  });
  test("do not sync ignored settings", () => runWithFakedTimers({ useFakeTimers: true }, async () => {
    const settingsContent = `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Editor
	"editor.fontFamily": "Fira Code",

	// Terminal
	"terminal.integrated.shell.osx": "some path",

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`;
    await updateSettings(settingsContent, client);
    let preview = await testObject.sync(await client.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource);
    preview = await testObject.apply(false);
    const { content } = await client.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSettings(content);
    assert.deepStrictEqual(actual, `{
	// Always
	"files.autoSave": "afterDelay",
	"files.simpleDialog.enable": true,

	// Workbench
	"workbench.colorTheme": "GitHub Sharp",

	// Ignored
	"settingsSync.ignoredSettings": [
		"editor.fontFamily",
		"terminal.integrated.shell.osx"
	]
}`);
  }));
});
function parseSettings(content) {
  const syncData = JSON.parse(content);
  const settingsSyncContent = JSON.parse(syncData.content);
  return settingsSyncContent.settings;
}
async function updateSettings(content, client, profile) {
  await client.instantiationService.get(IFileService).writeFile((profile ?? client.instantiationService.get(IUserDataProfilesService).defaultProfile).settingsResource, VSBuffer.fromString(content));
  await client.instantiationService.get(IConfigurationService).reloadConfiguration();
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vc2V0dGluZ3NTeW5jLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblNjb3BlLCBFeHRlbnNpb25zLCBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJVXNlckRhdGFQcm9maWxlLCBJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi91c2VyRGF0YVByb2ZpbGUvY29tbW9uL3VzZXJEYXRhUHJvZmlsZS5qcyc7XG5pbXBvcnQgeyBJU2V0dGluZ3NTeW5jQ29udGVudCwgcGFyc2VTZXR0aW5nc1N5bmNDb250ZW50LCBTZXR0aW5nc1N5bmNocm9uaXNlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXR0aW5nc1N5bmMuanMnO1xuaW1wb3J0IHsgSVN5bmNEYXRhLCBJVXNlckRhdGFTeW5jU3RvcmVTZXJ2aWNlLCBTeW5jUmVzb3VyY2UsIFN5bmNTdGF0dXMsIFVzZXJEYXRhU3luY0Vycm9yLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUgfSBmcm9tICcuLi8uLi9jb21tb24vdXNlckRhdGFTeW5jLmpzJztcbmltcG9ydCB7IFVzZXJEYXRhU3luY0NsaWVudCwgVXNlckRhdGFTeW5jVGVzdFNlcnZlciB9IGZyb20gJy4vdXNlckRhdGFTeW5jQ2xpZW50LmpzJztcblxuc3VpdGUoJ1NldHRpbmdzU3luYyAtIEF1dG8nLCAoKSA9PiB7XG5cblx0Y29uc3Qgc2VydmVyID0gbmV3IFVzZXJEYXRhU3luY1Rlc3RTZXJ2ZXIoKTtcblx0bGV0IGNsaWVudDogVXNlckRhdGFTeW5jQ2xpZW50O1xuXHRsZXQgdGVzdE9iamVjdDogU2V0dGluZ3NTeW5jaHJvbmlzZXI7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSkuY2xlYXIoKTtcblx0fSk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdFJlZ2lzdHJ5LmFzPElDb25maWd1cmF0aW9uUmVnaXN0cnk+KEV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbikucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0XHRcdCdpZCc6ICdzZXR0aW5nc1N5bmMnLFxuXHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdCdwcm9wZXJ0aWVzJzoge1xuXHRcdFx0XHQnc2V0dGluZ3NTeW5jLm1hY2hpbmUnOiB7XG5cdFx0XHRcdFx0J3R5cGUnOiAnc3RyaW5nJyxcblx0XHRcdFx0XHQnc2NvcGUnOiBDb25maWd1cmF0aW9uU2NvcGUuTUFDSElORVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQnc2V0dGluZ3NTeW5jLm1hY2hpbmVPdmVycmlkYWJsZSc6IHtcblx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdCdzY29wZSc6IENvbmZpZ3VyYXRpb25TY29wZS5NQUNISU5FX09WRVJSSURBQkxFXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0XHRjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50LnNldFVwKHRydWUpO1xuXHRcdHRlc3RPYmplY3QgPSBjbGllbnQuZ2V0U3luY2hyb25pemVyKFN5bmNSZXNvdXJjZS5TZXR0aW5ncykgYXMgU2V0dGluZ3NTeW5jaHJvbmlzZXI7XG5cdH0pO1xuXG5cdHRlc3QoJ3doZW4gc2V0dGluZ3MgZmlsZSBkb2VzIG5vdCBleGlzdCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHNldHRpbmdSZXNvdXJjZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKSwgbnVsbCk7XG5cdFx0bGV0IG1hbmlmZXN0ID0gYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMobWFuaWZlc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtcblx0XHRcdHsgdHlwZTogJ0dFVCcsIHVybDogYCR7c2VydmVyLnVybH0vdjEvcmVzb3VyY2UvJHt0ZXN0T2JqZWN0LnJlc291cmNlfS9sYXRlc3RgLCBoZWFkZXJzOiB7fSB9LFxuXHRcdF0pO1xuXHRcdGFzc2VydC5vayghYXdhaXQgZmlsZVNlcnZpY2UuZXhpc3RzKHNldHRpbmdSZXNvdXJjZSkpO1xuXG5cdFx0Y29uc3QgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdGNvbnN0IHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnJlZiwgcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCBudWxsKTtcblxuXHRcdG1hbmlmZXN0ID0gYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMobWFuaWZlc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXSk7XG5cblx0XHRtYW5pZmVzdCA9IGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW10pO1xuXHR9KSk7XG5cblx0dGVzdCgnd2hlbiBzZXR0aW5ncyBmaWxlIGlzIGVtcHR5IGFuZCByZW1vdGUgaGFzIG5vIGNoYW5nZXMnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBzZXR0aW5nc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2U7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IGxhc3RTeW5jVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlU2V0dGluZ3NTeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCk/LnNldHRpbmdzLCAne30nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VTZXR0aW5nc1N5bmNDb250ZW50KHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhIS5jb250ZW50KT8uc2V0dGluZ3MsICd7fScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoc2V0dGluZ3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksICcnKTtcblx0fSkpO1xuXG5cdHRlc3QoJ3doZW4gc2V0dGluZ3MgZmlsZSBpcyBlbXB0eSBhbmQgcmVtb3RlIGhhcyBjaGFuZ2VzJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdGNvbnN0IGNvbnRlbnQgPVxuXHRcdFx0YHtcblx0Ly8gQWx3YXlzXG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJhZnRlckRlbGF5XCIsXG5cdFwiZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZVwiOiB0cnVlLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cdFwid29ya2JlbmNoLnRyZWUuaW5kZW50XCI6IDIwLFxuXHRcIndvcmtiZW5jaC5jb2xvckN1c3RvbWl6YXRpb25zXCI6IHtcblx0XHRcImVkaXRvckxpbmVOdW1iZXIuYWN0aXZlRm9yZWdyb3VuZFwiOiBcIiNmZjAwMDBcIixcblx0XHRcIltHaXRIdWIgU2hhcnBdXCI6IHtcblx0XHRcdFwic3RhdHVzQmFySXRlbS5yZW1vdGVCYWNrZ3JvdW5kXCI6IFwiIzI0MjkyRVwiLFxuXHRcdFx0XCJlZGl0b3JQYW5lLmJhY2tncm91bmRcIjogXCIjZjNmMWYxMWFcIlxuXHRcdH1cblx0fSxcblxuXHRcImdpdEJyYW5jaC5iYXNlXCI6IFwicmVtb3RlLXJlcG8vbWFzdGVyXCIsXG5cblx0Ly8gRXhwZXJpbWVudGFsXG5cdFwid29ya2JlbmNoLnZpZXcuZXhwZXJpbWVudGFsLmFsbG93TW92aW5nVG9OZXdDb250YWluZXJcIjogdHJ1ZSxcbn1gO1xuXHRcdGF3YWl0IGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkud3JpdGVGaWxlKGNsaWVudDIuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUuc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBzZXR0aW5nc1Jlc291cmNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmRlZmF1bHRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2U7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IGxhc3RTeW5jVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlU2V0dGluZ3NTeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCk/LnNldHRpbmdzLCBjb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VTZXR0aW5nc1N5bmNDb250ZW50KHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhIS5jb250ZW50KT8uc2V0dGluZ3MsIGNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUoc2V0dGluZ3NSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCksIGNvbnRlbnQpO1xuXHR9KSk7XG5cblx0dGVzdCgnd2hlbiBzZXR0aW5ncyBmaWxlIGlzIGNyZWF0ZWQgYWZ0ZXIgZmlyc3Qgc3luYycsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgc2V0dGluZ3NSZXNvdXJjZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZS5zZXR0aW5nc1Jlc291cmNlO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhd2FpdCBmaWxlU2VydmljZS5jcmVhdGVGaWxlKHNldHRpbmdzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJ3t9JykpO1xuXG5cdFx0bGV0IGxhc3RTeW5jVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKTtcblx0XHRjb25zdCBtYW5pZmVzdCA9IGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXG5cdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHtzZXJ2ZXIudXJsfS92MS9yZXNvdXJjZS8ke3Rlc3RPYmplY3QucmVzb3VyY2V9YCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiBsYXN0U3luY1VzZXJEYXRhPy5yZWYgfSB9LFxuXHRcdF0pO1xuXG5cdFx0bGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdGNvbnN0IHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnJlZiwgcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlU2V0dGluZ3NTeW5jQ29udGVudChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCk/LnNldHRpbmdzLCAne30nKTtcblx0fSkpO1xuXG5cdHRlc3QoJ3N5bmMgZm9yIGZpcnN0IHRpbWUgdG8gdGhlIHNlcnZlcicsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cGVjdGVkID1cblx0XHRcdGB7XG5cdC8vIEFsd2F5c1xuXHRcImZpbGVzLmF1dG9TYXZlXCI6IFwiYWZ0ZXJEZWxheVwiLFxuXHRcImZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGVcIjogdHJ1ZSxcblxuXHQvLyBXb3JrYmVuY2hcblx0XCJ3b3JrYmVuY2guY29sb3JUaGVtZVwiOiBcIkdpdEh1YiBTaGFycFwiLFxuXHRcIndvcmtiZW5jaC50cmVlLmluZGVudFwiOiAyMCxcblx0XCJ3b3JrYmVuY2guY29sb3JDdXN0b21pemF0aW9uc1wiOiB7XG5cdFx0XCJlZGl0b3JMaW5lTnVtYmVyLmFjdGl2ZUZvcmVncm91bmRcIjogXCIjZmYwMDAwXCIsXG5cdFx0XCJbR2l0SHViIFNoYXJwXVwiOiB7XG5cdFx0XHRcInN0YXR1c0Jhckl0ZW0ucmVtb3RlQmFja2dyb3VuZFwiOiBcIiMyNDI5MkVcIixcblx0XHRcdFwiZWRpdG9yUGFuZS5iYWNrZ3JvdW5kXCI6IFwiI2YzZjFmMTFhXCJcblx0XHR9XG5cdH0sXG5cblx0XCJnaXRCcmFuY2guYmFzZVwiOiBcInJlbW90ZS1yZXBvL21hc3RlclwiLFxuXG5cdC8vIEV4cGVyaW1lbnRhbFxuXHRcIndvcmtiZW5jaC52aWV3LmV4cGVyaW1lbnRhbC5hbGxvd01vdmluZ1RvTmV3Q29udGFpbmVyXCI6IHRydWUsXG59YDtcblxuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKGV4cGVjdGVkLCBjbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgY2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnRlbnQgIT09IG51bGwpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlU2V0dGluZ3MoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2RvIG5vdCBzeW5jIG1hY2hpbmUgc2V0dGluZ3MnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXR0aW5nc0NvbnRlbnQgPVxuXHRcdFx0YHtcblx0Ly8gQWx3YXlzXG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJhZnRlckRlbGF5XCIsXG5cdFwiZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZVwiOiB0cnVlLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cblx0Ly8gTWFjaGluZVxuXHRcInNldHRpbmdzU3luYy5tYWNoaW5lXCI6IFwic29tZVZhbHVlXCIsXG5cdFwic2V0dGluZ3NTeW5jLm1hY2hpbmVPdmVycmlkYWJsZVwiOiBcInNvbWVWYWx1ZVwiXG59YDtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nc0NvbnRlbnQsIGNsaWVudCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IGNsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNldHRpbmdzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG5cblx0Ly8gV29ya2JlbmNoXG5cdFwid29ya2JlbmNoLmNvbG9yVGhlbWVcIjogXCJHaXRIdWIgU2hhcnBcIlxufWApO1xuXHR9KSk7XG5cblx0dGVzdCgnZG8gbm90IHN5bmMgbWFjaGluZSBzZXR0aW5ncyB3aGVuIHNwcmVhZCBhY3Jvc3MgZmlsZScsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNldHRpbmdzQ29udGVudCA9XG5cdFx0XHRge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJzZXR0aW5nc1N5bmMubWFjaGluZVwiOiBcInNvbWVWYWx1ZVwiLFxuXHRcImZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGVcIjogdHJ1ZSxcblxuXHQvLyBXb3JrYmVuY2hcblx0XCJ3b3JrYmVuY2guY29sb3JUaGVtZVwiOiBcIkdpdEh1YiBTaGFycFwiLFxuXG5cdC8vIE1hY2hpbmVcblx0XCJzZXR0aW5nc1N5bmMubWFjaGluZU92ZXJyaWRhYmxlXCI6IFwic29tZVZhbHVlXCJcbn1gO1xuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKHNldHRpbmdzQ29udGVudCwgY2xpZW50KTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgY2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnRlbnQgIT09IG51bGwpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlU2V0dGluZ3MoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGB7XG5cdC8vIEFsd2F5c1xuXHRcImZpbGVzLmF1dG9TYXZlXCI6IFwiYWZ0ZXJEZWxheVwiLFxuXHRcImZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGVcIjogdHJ1ZSxcblxuXHQvLyBXb3JrYmVuY2hcblx0XCJ3b3JrYmVuY2guY29sb3JUaGVtZVwiOiBcIkdpdEh1YiBTaGFycFwiXG59YCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdkbyBub3Qgc3luYyBtYWNoaW5lIHNldHRpbmdzIHdoZW4gc3ByZWFkIGFjcm9zcyBmaWxlIC0gMicsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNldHRpbmdzQ29udGVudCA9XG5cdFx0XHRge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJzZXR0aW5nc1N5bmMubWFjaGluZVwiOiBcInNvbWVWYWx1ZVwiLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cblx0Ly8gTWFjaGluZVxuXHRcInNldHRpbmdzU3luYy5tYWNoaW5lT3ZlcnJpZGFibGVcIjogXCJzb21lVmFsdWVcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG59YDtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nc0NvbnRlbnQsIGNsaWVudCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IGNsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNldHRpbmdzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblxuXHQvLyBXb3JrYmVuY2hcblx0XCJ3b3JrYmVuY2guY29sb3JUaGVtZVwiOiBcIkdpdEh1YiBTaGFycFwiLFxuXHRcImZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGVcIjogdHJ1ZSxcbn1gKTtcblx0fSkpO1xuXG5cdHRlc3QoJ3N5bmMgd2hlbiBhbGwgc2V0dGluZ3MgYXJlIG1hY2hpbmUgc2V0dGluZ3MnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXR0aW5nc0NvbnRlbnQgPVxuXHRcdFx0YHtcblx0Ly8gTWFjaGluZVxuXHRcInNldHRpbmdzU3luYy5tYWNoaW5lXCI6IFwic29tZVZhbHVlXCIsXG5cdFwic2V0dGluZ3NTeW5jLm1hY2hpbmVPdmVycmlkYWJsZVwiOiBcInNvbWVWYWx1ZVwiXG59YDtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nc0NvbnRlbnQsIGNsaWVudCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IGNsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNldHRpbmdzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBge1xufWApO1xuXHR9KSk7XG5cblx0dGVzdCgnc3luYyB3aGVuIGFsbCBzZXR0aW5ncyBhcmUgbWFjaGluZSBzZXR0aW5ncyB3aXRoIHRyYWlsaW5nIGNvbW1hJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2V0dGluZ3NDb250ZW50ID1cblx0XHRcdGB7XG5cdC8vIE1hY2hpbmVcblx0XCJzZXR0aW5nc1N5bmMubWFjaGluZVwiOiBcInNvbWVWYWx1ZVwiLFxuXHRcInNldHRpbmdzU3luYy5tYWNoaW5lT3ZlcnJpZGFibGVcIjogXCJzb21lVmFsdWVcIixcbn1gO1xuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKHNldHRpbmdzQ29udGVudCwgY2xpZW50KTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgY2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnRlbnQgIT09IG51bGwpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlU2V0dGluZ3MoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGB7XG5cdCxcbn1gKTtcblx0fSkpO1xuXG5cdHRlc3QoJ2xvY2FsIGNoYW5nZSBldmVudCBpcyB0cmlnZ2VyZWQgd2hlbiBzZXR0aW5ncyBhcmUgY2hhbmdlZCcsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPVxuXHRcdFx0YHtcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG59YDtcblxuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKGNvbnRlbnQsIGNsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IGNsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0Y29uc3QgcHJvbWlzZSA9IEV2ZW50LnRvUHJvbWlzZSh0ZXN0T2JqZWN0Lm9uRGlkQ2hhbmdlTG9jYWwpO1xuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKGB7XG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJvZmZcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG59YCwgY2xpZW50KTtcblx0XHRhd2FpdCBwcm9taXNlO1xuXHR9KSk7XG5cblx0dGVzdCgnZG8gbm90IHN5bmMgaWdub3JlZCBzZXR0aW5ncycsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNldHRpbmdzQ29udGVudCA9XG5cdFx0XHRge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG5cblx0Ly8gRWRpdG9yXG5cdFwiZWRpdG9yLmZvbnRGYW1pbHlcIjogXCJGaXJhIENvZGVcIixcblxuXHQvLyBUZXJtaW5hbFxuXHRcInRlcm1pbmFsLmludGVncmF0ZWQuc2hlbGwub3N4XCI6IFwic29tZSBwYXRoXCIsXG5cblx0Ly8gV29ya2JlbmNoXG5cdFwid29ya2JlbmNoLmNvbG9yVGhlbWVcIjogXCJHaXRIdWIgU2hhcnBcIixcblxuXHQvLyBJZ25vcmVkXG5cdFwic2V0dGluZ3NTeW5jLmlnbm9yZWRTZXR0aW5nc1wiOiBbXG5cdFx0XCJlZGl0b3IuZm9udEZhbWlseVwiLFxuXHRcdFwidGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbC5vc3hcIlxuXHRdXG59YDtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nc0NvbnRlbnQsIGNsaWVudCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IGNsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNldHRpbmdzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG5cblx0Ly8gV29ya2JlbmNoXG5cdFwid29ya2JlbmNoLmNvbG9yVGhlbWVcIjogXCJHaXRIdWIgU2hhcnBcIixcblxuXHQvLyBJZ25vcmVkXG5cdFwic2V0dGluZ3NTeW5jLmlnbm9yZWRTZXR0aW5nc1wiOiBbXG5cdFx0XCJlZGl0b3IuZm9udEZhbWlseVwiLFxuXHRcdFwidGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbC5vc3hcIlxuXHRdXG59YCk7XG5cdH0pKTtcblxuXHR0ZXN0KCdkbyBub3Qgc3luYyBpZ25vcmVkIGFuZCBtYWNoaW5lIHNldHRpbmdzJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2V0dGluZ3NDb250ZW50ID1cblx0XHRcdGB7XG5cdC8vIEFsd2F5c1xuXHRcImZpbGVzLmF1dG9TYXZlXCI6IFwiYWZ0ZXJEZWxheVwiLFxuXHRcImZpbGVzLnNpbXBsZURpYWxvZy5lbmFibGVcIjogdHJ1ZSxcblxuXHQvLyBFZGl0b3Jcblx0XCJlZGl0b3IuZm9udEZhbWlseVwiOiBcIkZpcmEgQ29kZVwiLFxuXG5cdC8vIFRlcm1pbmFsXG5cdFwidGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbC5vc3hcIjogXCJzb21lIHBhdGhcIixcblxuXHQvLyBXb3JrYmVuY2hcblx0XCJ3b3JrYmVuY2guY29sb3JUaGVtZVwiOiBcIkdpdEh1YiBTaGFycFwiLFxuXG5cdC8vIElnbm9yZWRcblx0XCJzZXR0aW5nc1N5bmMuaWdub3JlZFNldHRpbmdzXCI6IFtcblx0XHRcImVkaXRvci5mb250RmFtaWx5XCIsXG5cdFx0XCJ0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsLm9zeFwiXG5cdF0sXG5cblx0Ly8gTWFjaGluZVxuXHRcInNldHRpbmdzU3luYy5tYWNoaW5lXCI6IFwic29tZVZhbHVlXCIsXG59YDtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhzZXR0aW5nc0NvbnRlbnQsIGNsaWVudCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IGNsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNldHRpbmdzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBge1xuXHQvLyBBbHdheXNcblx0XCJmaWxlcy5hdXRvU2F2ZVwiOiBcImFmdGVyRGVsYXlcIixcblx0XCJmaWxlcy5zaW1wbGVEaWFsb2cuZW5hYmxlXCI6IHRydWUsXG5cblx0Ly8gV29ya2JlbmNoXG5cdFwid29ya2JlbmNoLmNvbG9yVGhlbWVcIjogXCJHaXRIdWIgU2hhcnBcIixcblxuXHQvLyBJZ25vcmVkXG5cdFwic2V0dGluZ3NTeW5jLmlnbm9yZWRTZXR0aW5nc1wiOiBbXG5cdFx0XCJlZGl0b3IuZm9udEZhbWlseVwiLFxuXHRcdFwidGVybWluYWwuaW50ZWdyYXRlZC5zaGVsbC5vc3hcIlxuXHRdLFxufWApO1xuXHR9KSk7XG5cblx0dGVzdCgnc3luYyB0aHJvd3MgaW52YWxpZCBjb250ZW50IGVycm9yJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPVxuXHRcdFx0YHtcblx0Ly8gQWx3YXlzXG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJhZnRlckRlbGF5XCIsXG5cdFwiZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZVwiOiB0cnVlLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cdFwid29ya2JlbmNoLnRyZWUuaW5kZW50XCI6IDIwLFxuXHRcIndvcmtiZW5jaC5jb2xvckN1c3RvbWl6YXRpb25zXCI6IHtcblx0XHRcImVkaXRvckxpbmVOdW1iZXIuYWN0aXZlRm9yZWdyb3VuZFwiOiBcIiNmZjAwMDBcIixcblx0XHRcIltHaXRIdWIgU2hhcnBdXCI6IHtcblx0XHRcdFwic3RhdHVzQmFySXRlbS5yZW1vdGVCYWNrZ3JvdW5kXCI6IFwiIzI0MjkyRVwiLFxuXHRcdFx0XCJlZGl0b3JQYW5lLmJhY2tncm91bmRcIjogXCIjZjNmMWYxMWFcIlxuXHRcdH1cblx0fVxuXG5cdFwiZ2l0QnJhbmNoLmJhc2VcIjogXCJyZW1vdGUtcmVwby9tYXN0ZXJcIixcblxuXHQvLyBFeHBlcmltZW50YWxcblx0XCJ3b3JrYmVuY2gudmlldy5leHBlcmltZW50YWwuYWxsb3dNb3ZpbmdUb05ld0NvbnRhaW5lclwiOiB0cnVlLFxufWA7XG5cblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhleHBlY3RlZCwgY2xpZW50KTtcblxuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0XHRhc3NlcnQuZmFpbCgnc2hvdWxkIGZhaWwgd2l0aCBpbnZhbGlkIGNvbnRlbnQgZXJyb3InKTtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRhc3NlcnQub2soZSBpbnN0YW5jZW9mIFVzZXJEYXRhU3luY0Vycm9yKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKDxVc2VyRGF0YVN5bmNFcnJvcj5lKS5jb2RlLCBVc2VyRGF0YVN5bmNFcnJvckNvZGUuTG9jYWxJbnZhbGlkQ29udGVudCk7XG5cdFx0fVxuXHR9KSk7XG5cblx0dGVzdCgnc3luYyB0aHJvd3MgaW52YWxpZCBjb250ZW50IGVycm9yIC0gY29udGVudCBpcyBhbiBhcnJheScsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNldHRpbmdzKCdbXScsIGNsaWVudCk7XG5cdFx0dHJ5IHtcblx0XHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRcdGFzc2VydC5mYWlsKCdzaG91bGQgZmFpbCB3aXRoIGludmFsaWQgY29udGVudCBlcnJvcicpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGFzc2VydC5vayhlIGluc3RhbmNlb2YgVXNlckRhdGFTeW5jRXJyb3IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCgoPFVzZXJEYXRhU3luY0Vycm9yPmUpLmNvZGUsIFVzZXJEYXRhU3luY0Vycm9yQ29kZS5Mb2NhbEludmFsaWRDb250ZW50KTtcblx0XHR9XG5cdH0pKTtcblxuXHR0ZXN0KCdzeW5jIHdoZW4gdGhlcmUgYXJlIGNvbmZsaWN0cycsICgpID0+IHJ1bldpdGhGYWtlZFRpbWVyczx2b2lkPih7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnc2V0dGluZ3NTeW5jLmlnbm9yZWRTZXR0aW5ncyc6IFsnYSddXG5cdFx0fSksIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU2V0dGluZ3MoSlNPTi5zdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2InOiAxLFxuXHRcdFx0J3NldHRpbmdzU3luYy5pZ25vcmVkU2V0dGluZ3MnOiBbJ2EnXVxuXHRcdH0pLCBjbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCBjbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHNbMF0ubG9jYWxSZXNvdXJjZS50b1N0cmluZygpLCB0ZXN0T2JqZWN0LmxvY2FsUmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCBtZXJnZUNvbnRlbnQgPSAoYXdhaXQgZmlsZVNlcnZpY2UucmVhZEZpbGUodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSkpLnZhbHVlLnRvU3RyaW5nKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1lcmdlQ29udGVudCwgJycpO1xuXHR9KSk7XG5cblx0dGVzdCgnc3luYyBwcm9maWxlIHNldHRpbmdzJywgKCkgPT4gcnVuV2l0aEZha2VkVGltZXJzPHZvaWQ+KHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmNyZWF0ZU5hbWVkUHJvZmlsZSgncHJvZmlsZTEnKTtcblx0XHRhd2FpdCB1cGRhdGVTZXR0aW5ncyhKU09OLnN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDIsXG5cdFx0fSksIGNsaWVudDIsIHByb2ZpbGUpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgY2xpZW50LnN5bmMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblxuXHRcdGNvbnN0IHN5bmNlZFByb2ZpbGUgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkucHJvZmlsZXMuZmluZChwID0+IHAuaWQgPT09IHByb2ZpbGUuaWQpITtcblx0XHRjb25zdCBjb250ZW50ID0gKGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKS5yZWFkRmlsZShzeW5jZWRQcm9maWxlLnNldHRpbmdzUmVzb3VyY2UpKS52YWx1ZS50b1N0cmluZygpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoSlNPTi5wYXJzZShjb250ZW50KSwge1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2InOiAyLFxuXHRcdH0pO1xuXHR9KSk7XG5cbn0pO1xuXG5zdWl0ZSgnU2V0dGluZ3NTeW5jIC0gTWFudWFsJywgKCkgPT4ge1xuXG5cdGNvbnN0IHNlcnZlciA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdGxldCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudDtcblx0bGV0IHRlc3RPYmplY3Q6IFNldHRpbmdzU3luY2hyb25pc2VyO1xuXG5cdHRlYXJkb3duKGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRjbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50LnNldFVwKHRydWUpO1xuXHRcdHRlc3RPYmplY3QgPSBjbGllbnQuZ2V0U3luY2hyb25pemVyKFN5bmNSZXNvdXJjZS5TZXR0aW5ncykgYXMgU2V0dGluZ3NTeW5jaHJvbmlzZXI7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvIG5vdCBzeW5jIGlnbm9yZWQgc2V0dGluZ3MnLCAoKSA9PiBydW5XaXRoRmFrZWRUaW1lcnM8dm9pZD4oeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXR0aW5nc0NvbnRlbnQgPVxuXHRcdFx0YHtcblx0Ly8gQWx3YXlzXG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJhZnRlckRlbGF5XCIsXG5cdFwiZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZVwiOiB0cnVlLFxuXG5cdC8vIEVkaXRvclxuXHRcImVkaXRvci5mb250RmFtaWx5XCI6IFwiRmlyYSBDb2RlXCIsXG5cblx0Ly8gVGVybWluYWxcblx0XCJ0ZXJtaW5hbC5pbnRlZ3JhdGVkLnNoZWxsLm9zeFwiOiBcInNvbWUgcGF0aFwiLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cblx0Ly8gSWdub3JlZFxuXHRcInNldHRpbmdzU3luYy5pZ25vcmVkU2V0dGluZ3NcIjogW1xuXHRcdFwiZWRpdG9yLmZvbnRGYW1pbHlcIixcblx0XHRcInRlcm1pbmFsLmludGVncmF0ZWQuc2hlbGwub3N4XCJcblx0XVxufWA7XG5cdFx0YXdhaXQgdXBkYXRlU2V0dGluZ3Moc2V0dGluZ3NDb250ZW50LCBjbGllbnQpO1xuXG5cdFx0bGV0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgY2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSk7XG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCBjbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTZXR0aW5ncyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgYHtcblx0Ly8gQWx3YXlzXG5cdFwiZmlsZXMuYXV0b1NhdmVcIjogXCJhZnRlckRlbGF5XCIsXG5cdFwiZmlsZXMuc2ltcGxlRGlhbG9nLmVuYWJsZVwiOiB0cnVlLFxuXG5cdC8vIFdvcmtiZW5jaFxuXHRcIndvcmtiZW5jaC5jb2xvclRoZW1lXCI6IFwiR2l0SHViIFNoYXJwXCIsXG5cblx0Ly8gSWdub3JlZFxuXHRcInNldHRpbmdzU3luYy5pZ25vcmVkU2V0dGluZ3NcIjogW1xuXHRcdFwiZWRpdG9yLmZvbnRGYW1pbHlcIixcblx0XHRcInRlcm1pbmFsLmludGVncmF0ZWQuc2hlbGwub3N4XCJcblx0XVxufWApO1xuXHR9KSk7XG5cbn0pO1xuXG5mdW5jdGlvbiBwYXJzZVNldHRpbmdzKGNvbnRlbnQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdGNvbnN0IHN5bmNEYXRhOiBJU3luY0RhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRjb25zdCBzZXR0aW5nc1N5bmNDb250ZW50OiBJU2V0dGluZ3NTeW5jQ29udGVudCA9IEpTT04ucGFyc2Uoc3luY0RhdGEuY29udGVudCk7XG5cdHJldHVybiBzZXR0aW5nc1N5bmNDb250ZW50LnNldHRpbmdzO1xufVxuXG5hc3luYyBmdW5jdGlvbiB1cGRhdGVTZXR0aW5ncyhjb250ZW50OiBzdHJpbmcsIGNsaWVudDogVXNlckRhdGFTeW5jQ2xpZW50LCBwcm9maWxlPzogSVVzZXJEYXRhUHJvZmlsZSk6IFByb21pc2U8dm9pZD4ge1xuXHRhd2FpdCBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSkud3JpdGVGaWxlKChwcm9maWxlID8/IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5kZWZhdWx0UHJvZmlsZSkuc2V0dGluZ3NSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdGF3YWl0IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlKS5yZWxvYWRDb25maWd1cmF0aW9uKCk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CLGtCQUEwQztBQUN2RSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGdCQUFnQjtBQUN6QixTQUEyQixnQ0FBZ0M7QUFDM0QsU0FBK0IsZ0NB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TTtBQUFBLEVBQ3hFLENBQUM7QUFFRCxRQUFNLGtCQUFrQix3Q0FBd0M7QUFFaEUsUUFBTSxZQUFZO0FBQ2pCLGFBQVMsZ0JBQWdCLElBQUksSUFBSSxtQkFBbUIsTUFBTSxDQUFDO0FBQzNELFVBQU0sT0FBTyxNQUFNLElBQUk7QUFDdkIsaUJBQWEsT0FBTyxnQkFBZ0IsYUFBYSxRQUFRO0FBQUEsRUFDMUQsQ0FBQztBQUVELE9BQUssZ0NBQWdDLE1BQU0sbUJBQXlCLEVBQUUsZUFBZSxLQUFLLEdBQUcsWUFBWTtBQUN4RyxVQUFNLGtCQUNMO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFvQkQsVUFBTSxlQUFlLGlCQUFpQixNQUFNO0FBRTVDLFFBQUksVUFBVSxNQUFNLFdBQVcsS0FBSyxNQUFNLE9BQU8sb0JBQW9CLEdBQUcsSUFBSTtBQUM1RSxXQUFPLFlBQVksV0FBVyxRQUFRLFdBQVcsT0FBTztBQUN4RCxjQUFVLE1BQU0sV0FBVyxPQUFPLFFBQVMsaUJBQWlCLENBQUMsRUFBRSxlQUFlO0FBQzlFLGNBQVUsTUFBTSxXQUFXLE1BQU0sS0FBSztBQUV0QyxVQUFNLEVBQUUsUUFBUSxJQUFJLE1BQU0sT0FBTyxLQUFLLFdBQVcsUUFBUTtBQUN6RCxXQUFPLEdBQUcsWUFBWSxJQUFJO0FBQzFCLFVBQU0sU0FBUyxjQUFjLE9BQU87QUFDcEMsV0FBTyxnQkFBZ0IsUUFBUTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBYS9CO0FBQUEsRUFDRCxDQUFDLENBQUM7QUFFSCxDQUFDO0FBRUQsU0FBUyxjQUFjLFNBQXlCO0FBQy9DLFFBQU0sV0FBc0IsS0FBSyxNQUFNLE9BQU87QUFDOUMsUUFBTSxzQkFBNEMsS0FBSyxNQUFNLFNBQVMsT0FBTztBQUM3RSxTQUFPLG9CQUFvQjtBQUM1QjtBQUVBLGVBQWUsZUFBZSxTQUFpQixRQUE0QixTQUEyQztBQUNySCxRQUFNLE9BQU8scUJBQXFCLElBQUksWUFBWSxFQUFFLFdBQVcsV0FBVyxPQUFPLHFCQUFxQixJQUFJLHdCQUF3QixFQUFFLGdCQUFnQixrQkFBa0IsU0FBUyxXQUFXLE9BQU8sQ0FBQztBQUNsTSxRQUFNLE9BQU8scUJBQXFCLElBQUkscUJBQXFCLEVBQUUsb0JBQW9CO0FBQ2xGOyIsCiAgIm5hbWVzIjogW10KfQo=
