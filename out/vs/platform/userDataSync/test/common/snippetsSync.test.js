import assert from "assert";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { dirname, joinPath } from "../../../../base/common/resources.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { IEnvironmentService } from "../../../environment/common/environment.js";
import { IFileService } from "../../../files/common/files.js";
import { IUserDataProfilesService } from "../../../userDataProfile/common/userDataProfile.js";
import { IUserDataSyncStoreService, PREVIEW_DIR_NAME, SyncResource, SyncStatus } from "../../common/userDataSync.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "./userDataSyncClient.js";
const tsSnippet1 = `{

	// Place your snippets for TypeScript here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position, Placeholders with the
	// same ids are connected.
	"Print to console": {
	// Example:
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console",
	}

}`;
const tsSnippet2 = `{

	// Place your snippets for TypeScript here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position, Placeholders with the
	// same ids are connected.
	"Print to console": {
	// Example:
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console always",
	}

}`;
const htmlSnippet1 = `{
/*
	// Place your snippets for HTML here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
*/
"Div": {
	"prefix": "div",
		"body": [
			"<div>",
			"",
			"</div>"
		],
			"description": "New div"
	}
}`;
const htmlSnippet2 = `{
/*
	// Place your snippets for HTML here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
*/
"Div": {
	"prefix": "div",
		"body": [
			"<div>",
			"",
			"</div>"
		],
			"description": "New div changed"
	}
}`;
const htmlSnippet3 = `{
/*
	// Place your snippets for HTML here. Each snippet is defined under a snippet name and has a prefix, body and
	// description. The prefix is what is used to trigger the snippet and the body will be expanded and inserted.
	// Example:
	"Print to console": {
	"prefix": "log",
		"body": [
			"console.log('$1');",
			"$2"
		],
			"description": "Log output to console"
	}
*/
"Div": {
	"prefix": "div",
		"body": [
			"<div>",
			"",
			"</div>"
		],
			"description": "New div changed again"
	}
}`;
const globalSnippet = `{
	// Place your global snippets here. Each snippet is defined under a snippet name and has a scope, prefix, body and
	// description. Add comma separated ids of the languages where the snippet is applicable in the scope field. If scope
	// is left empty or omitted, the snippet gets applied to all languages. The prefix is what is
	// used to trigger the snippet and the body will be expanded and inserted. Possible variables are:
	// $1, $2 for tab stops, $0 for the final cursor position, and {1: label}, { 2: another } for placeholders.
	// Placeholders with the same ids are connected.
	// Example:
	// "Print to console": {
	// 	"scope": "javascript,typescript",
	// 	"prefix": "log",
	// 	"body": [
	// 		"console.log('$1');",
	// 		"$2"
	// 	],
	// 	"description": "Log output to console"
	// }
}`;
suite("SnippetsSync", () => {
  const server = new UserDataSyncTestServer();
  let testClient;
  let client2;
  let testObject;
  teardown(async () => {
    await testClient.instantiationService.get(IUserDataSyncStoreService).clear();
  });
  const disposableStore = ensureNoDisposablesAreLeakedInTestSuite();
  setup(async () => {
    testClient = disposableStore.add(new UserDataSyncClient(server));
    await testClient.setUp(true);
    testObject = testClient.getSynchronizer(SyncResource.Snippets);
    client2 = disposableStore.add(new UserDataSyncClient(server));
    await client2.setUp(true);
  });
  test("when snippets does not exist", async () => {
    const fileService = testClient.instantiationService.get(IFileService);
    const snippetsResource = testClient.instantiationService.get(IUserDataProfilesService).defaultProfile.snippetsHome;
    assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
    let manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, [
      { type: "GET", url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} }
    ]);
    assert.ok(!await fileService.exists(snippetsResource));
    const lastSyncUserData = await testObject.getLastSyncUserData();
    const remoteUserData = await testObject.getRemoteUserData(null);
    assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
    assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
    assert.strictEqual(lastSyncUserData.syncData, null);
    manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, []);
    manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, []);
  });
  test("when snippet is created after first sync", async () => {
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet1, testClient);
    let lastSyncUserData = await testObject.getLastSyncUserData();
    const manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, [
      { type: "POST", url: `${server.url}/v1/resource/${testObject.resource}`, headers: { "If-Match": lastSyncUserData?.ref } }
    ]);
    lastSyncUserData = await testObject.getLastSyncUserData();
    const remoteUserData = await testObject.getRemoteUserData(null);
    assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
    assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
    assert.deepStrictEqual(lastSyncUserData.syncData.content, JSON.stringify({ "html.json": htmlSnippet1 }));
  });
  test("first time sync - outgoing to server (no snippets)", async () => {
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await updateSnippet("typescript.json", tsSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 });
  });
  test("first time sync - incoming from server (no snippets)", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const actual2 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual2, tsSnippet1);
  });
  test("first time sync when snippets exists", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await updateSnippet("typescript.json", tsSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const actual2 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual2, tsSnippet1);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 });
  });
  test("first time sync when snippets exists - has conflicts", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("first time sync when snippets exists - has conflicts and accept conflicts", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, htmlSnippet1);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet1 });
  });
  test("first time sync when snippets exists - has multiple conflicts", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local1 = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json");
    const local2 = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json");
    assertPreviews(testObject.conflicts.conflicts, [local1, local2]);
  });
  test("first time sync when snippets exists - has multiple conflicts and accept one conflict", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    let conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, htmlSnippet2);
    conflicts = testObject.conflicts.conflicts;
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("first time sync when snippets exists - has multiple conflicts and accept all conflicts", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, htmlSnippet2);
    await testObject.accept(conflicts[1].previewResource, tsSnippet1);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet2);
    const actual2 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual2, tsSnippet1);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet2, "typescript.json": tsSnippet1 });
  });
  test("sync adding a snippet", async () => {
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("typescript.json", tsSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const actual2 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual2, tsSnippet1);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet1, "typescript.json": tsSnippet1 });
  });
  test("sync adding a snippet - accept", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const actual2 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual2, tsSnippet1);
  });
  test("sync updating a snippet", async () => {
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet2);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet2 });
  });
  test("sync updating a snippet - accept", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet2, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet2);
  });
  test("sync updating a snippet - conflict", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet2, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet3, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("sync updating a snippet - resolve conflict", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet2, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet3, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, htmlSnippet2);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet2);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet2 });
  });
  test("sync removing a snippet", async () => {
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await updateSnippet("typescript.json", tsSnippet1, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await removeSnippet("html.json", testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual2, null);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "typescript.json": tsSnippet1 });
  });
  test("sync removing a snippet - accept", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removeSnippet("html.json", client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual2, null);
  });
  test("sync removing a snippet locally and updating it remotely", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updateSnippet("html.json", htmlSnippet2, client2);
    await client2.sync();
    await removeSnippet("html.json", testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual2, htmlSnippet2);
  });
  test("sync removing a snippet - conflict", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removeSnippet("html.json", client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("sync removing a snippet - resolve conflict", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removeSnippet("html.json", client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, htmlSnippet3);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual2, htmlSnippet3);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "typescript.json": tsSnippet1, "html.json": htmlSnippet3 });
  });
  test("sync removing a snippet - resolve conflict by removing", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removeSnippet("html.json", client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, null);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual2, null);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "typescript.json": tsSnippet1 });
  });
  test("sync global and language snippet", async () => {
    await updateSnippet("global.code-snippets", globalSnippet, client2);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("html.json", testClient);
    assert.strictEqual(actual1, htmlSnippet1);
    const actual2 = await readSnippet("global.code-snippets", testClient);
    assert.strictEqual(actual2, globalSnippet);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "html.json": htmlSnippet1, "global.code-snippets": globalSnippet });
  });
  test("sync should ignore non snippets", async () => {
    await updateSnippet("global.code-snippets", globalSnippet, client2);
    await updateSnippet("html.html", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readSnippet("typescript.json", testClient);
    assert.strictEqual(actual1, tsSnippet1);
    const actual2 = await readSnippet("global.code-snippets", testClient);
    assert.strictEqual(actual2, globalSnippet);
    const actual3 = await readSnippet("html.html", testClient);
    assert.strictEqual(actual3, null);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parseSnippets(content);
    assert.deepStrictEqual(actual, { "typescript.json": tsSnippet1, "global.code-snippets": globalSnippet });
  });
  test("previews are reset after all conflicts resolved", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, htmlSnippet2);
    await testObject.apply(false);
    const fileService = testClient.instantiationService.get(IFileService);
    assert.ok(!await fileService.exists(dirname(conflicts[0].previewResource)));
  });
  test("merge when there are multiple snippets and all snippets are merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("merge when there are multiple snippets and all snippets are merged and applied", async () => {
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(preview, null);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("merge when there are multiple snippets and one snippet has no changes and one snippet is merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("merge when there are multiple snippets and one snippet has no changes and snippets is merged and applied", async () => {
    await updateSnippet("html.json", htmlSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet1, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(preview, null);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("merge when there are multiple snippets with conflicts and all snippets are merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
  });
  test("accept when there are multiple snippets with conflicts and only one snippet is accepted", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, htmlSnippet2);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
  });
  test("accept when there are multiple snippets with conflicts and all snippets are accepted", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, htmlSnippet2);
    preview = await testObject.accept(preview.resourcePreviews[1].previewResource, tsSnippet2);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("accept when there are multiple snippets with conflicts and all snippets are accepted and applied", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updateSnippet("html.json", htmlSnippet1, client2);
    await updateSnippet("typescript.json", tsSnippet1, client2);
    await client2.sync();
    await updateSnippet("html.json", htmlSnippet2, testClient);
    await updateSnippet("typescript.json", tsSnippet2, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "html.json"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "typescript.json")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, htmlSnippet2);
    preview = await testObject.accept(preview.resourcePreviews[1].previewResource, tsSnippet2);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(preview, null);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("sync profile snippets", async () => {
    const client22 = disposableStore.add(new UserDataSyncClient(server));
    await client22.setUp(true);
    const profile = await client22.instantiationService.get(IUserDataProfilesService).createNamedProfile("profile1");
    await updateSnippet("html.json", htmlSnippet1, client22, profile);
    await client22.sync();
    await testClient.sync();
    const syncedProfile = testClient.instantiationService.get(IUserDataProfilesService).profiles.find((p) => p.id === profile.id);
    const content = await readSnippet("html.json", testClient, syncedProfile);
    assert.strictEqual(content, htmlSnippet1);
  });
  function parseSnippets(content) {
    const syncData = JSON.parse(content);
    return JSON.parse(syncData.content);
  }
  async function updateSnippet(name, content, client, profile) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const snippetsResource = joinPath((profile ?? userDataProfilesService.defaultProfile).snippetsHome, name);
    await fileService.writeFile(snippetsResource, VSBuffer.fromString(content));
  }
  async function removeSnippet(name, client) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const snippetsResource = joinPath(userDataProfilesService.defaultProfile.snippetsHome, name);
    await fileService.del(snippetsResource);
  }
  async function readSnippet(name, client, profile) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const snippetsResource = joinPath((profile ?? userDataProfilesService.defaultProfile).snippetsHome, name);
    if (await fileService.exists(snippetsResource)) {
      const content = await fileService.readFile(snippetsResource);
      return content.value.toString();
    }
    return null;
  }
  function assertPreviews(actual, expected) {
    assert.deepStrictEqual(actual.map(({ previewResource }) => previewResource.toString()), expected.map((uri) => uri.toString()));
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vc25pcHBldHNTeW5jLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbGxlY3Rpb25zLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IFNuaXBwZXRzU3luY2hyb25pc2VyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NuaXBwZXRzU3luYy5qcyc7XG5pbXBvcnQgeyBJUmVzb3VyY2VQcmV2aWV3LCBJU3luY0RhdGEsIElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UsIFBSRVZJRVdfRElSX05BTUUsIFN5bmNSZXNvdXJjZSwgU3luY1N0YXR1cyB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuaW1wb3J0IHsgVXNlckRhdGFTeW5jQ2xpZW50LCBVc2VyRGF0YVN5bmNUZXN0U2VydmVyIH0gZnJvbSAnLi91c2VyRGF0YVN5bmNDbGllbnQuanMnO1xuXG5jb25zdCB0c1NuaXBwZXQxID0gYHtcblxuXHQvLyBQbGFjZSB5b3VyIHNuaXBwZXRzIGZvciBUeXBlU2NyaXB0IGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC4gUG9zc2libGUgdmFyaWFibGVzIGFyZTpcblx0Ly8gJDEsICQyIGZvciB0YWIgc3RvcHMsICQwIGZvciB0aGUgZmluYWwgY3Vyc29yIHBvc2l0aW9uLCBQbGFjZWhvbGRlcnMgd2l0aCB0aGVcblx0Ly8gc2FtZSBpZHMgYXJlIGNvbm5lY3RlZC5cblx0XCJQcmludCB0byBjb25zb2xlXCI6IHtcblx0Ly8gRXhhbXBsZTpcblx0XCJwcmVmaXhcIjogXCJsb2dcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCJjb25zb2xlLmxvZygnJDEnKTtcIixcblx0XHRcdFwiJDJcIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTG9nIG91dHB1dCB0byBjb25zb2xlXCIsXG5cdH1cblxufWA7XG5cbmNvbnN0IHRzU25pcHBldDIgPSBge1xuXG5cdC8vIFBsYWNlIHlvdXIgc25pcHBldHMgZm9yIFR5cGVTY3JpcHQgaGVyZS4gRWFjaCBzbmlwcGV0IGlzIGRlZmluZWQgdW5kZXIgYSBzbmlwcGV0IG5hbWUgYW5kIGhhcyBhIHByZWZpeCwgYm9keSBhbmRcblx0Ly8gZGVzY3JpcHRpb24uIFRoZSBwcmVmaXggaXMgd2hhdCBpcyB1c2VkIHRvIHRyaWdnZXIgdGhlIHNuaXBwZXQgYW5kIHRoZSBib2R5IHdpbGwgYmUgZXhwYW5kZWQgYW5kIGluc2VydGVkLiBQb3NzaWJsZSB2YXJpYWJsZXMgYXJlOlxuXHQvLyAkMSwgJDIgZm9yIHRhYiBzdG9wcywgJDAgZm9yIHRoZSBmaW5hbCBjdXJzb3IgcG9zaXRpb24sIFBsYWNlaG9sZGVycyB3aXRoIHRoZVxuXHQvLyBzYW1lIGlkcyBhcmUgY29ubmVjdGVkLlxuXHRcIlByaW50IHRvIGNvbnNvbGVcIjoge1xuXHQvLyBFeGFtcGxlOlxuXHRcInByZWZpeFwiOiBcImxvZ1wiLFxuXHRcdFwiYm9keVwiOiBbXG5cdFx0XHRcImNvbnNvbGUubG9nKCckMScpO1wiLFxuXHRcdFx0XCIkMlwiXG5cdFx0XSxcblx0XHRcdFwiZGVzY3JpcHRpb25cIjogXCJMb2cgb3V0cHV0IHRvIGNvbnNvbGUgYWx3YXlzXCIsXG5cdH1cblxufWA7XG5cbmNvbnN0IGh0bWxTbmlwcGV0MSA9IGB7XG4vKlxuXHQvLyBQbGFjZSB5b3VyIHNuaXBwZXRzIGZvciBIVE1MIGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC5cblx0Ly8gRXhhbXBsZTpcblx0XCJQcmludCB0byBjb25zb2xlXCI6IHtcblx0XCJwcmVmaXhcIjogXCJsb2dcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCJjb25zb2xlLmxvZygnJDEnKTtcIixcblx0XHRcdFwiJDJcIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTG9nIG91dHB1dCB0byBjb25zb2xlXCJcblx0fVxuKi9cblwiRGl2XCI6IHtcblx0XCJwcmVmaXhcIjogXCJkaXZcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCI8ZGl2PlwiLFxuXHRcdFx0XCJcIixcblx0XHRcdFwiPC9kaXY+XCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIk5ldyBkaXZcIlxuXHR9XG59YDtcblxuY29uc3QgaHRtbFNuaXBwZXQyID0gYHtcbi8qXG5cdC8vIFBsYWNlIHlvdXIgc25pcHBldHMgZm9yIEhUTUwgaGVyZS4gRWFjaCBzbmlwcGV0IGlzIGRlZmluZWQgdW5kZXIgYSBzbmlwcGV0IG5hbWUgYW5kIGhhcyBhIHByZWZpeCwgYm9keSBhbmRcblx0Ly8gZGVzY3JpcHRpb24uIFRoZSBwcmVmaXggaXMgd2hhdCBpcyB1c2VkIHRvIHRyaWdnZXIgdGhlIHNuaXBwZXQgYW5kIHRoZSBib2R5IHdpbGwgYmUgZXhwYW5kZWQgYW5kIGluc2VydGVkLlxuXHQvLyBFeGFtcGxlOlxuXHRcIlByaW50IHRvIGNvbnNvbGVcIjoge1xuXHRcInByZWZpeFwiOiBcImxvZ1wiLFxuXHRcdFwiYm9keVwiOiBbXG5cdFx0XHRcImNvbnNvbGUubG9nKCckMScpO1wiLFxuXHRcdFx0XCIkMlwiXG5cdFx0XSxcblx0XHRcdFwiZGVzY3JpcHRpb25cIjogXCJMb2cgb3V0cHV0IHRvIGNvbnNvbGVcIlxuXHR9XG4qL1xuXCJEaXZcIjoge1xuXHRcInByZWZpeFwiOiBcImRpdlwiLFxuXHRcdFwiYm9keVwiOiBbXG5cdFx0XHRcIjxkaXY+XCIsXG5cdFx0XHRcIlwiLFxuXHRcdFx0XCI8L2Rpdj5cIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTmV3IGRpdiBjaGFuZ2VkXCJcblx0fVxufWA7XG5cbmNvbnN0IGh0bWxTbmlwcGV0MyA9IGB7XG4vKlxuXHQvLyBQbGFjZSB5b3VyIHNuaXBwZXRzIGZvciBIVE1MIGhlcmUuIEVhY2ggc25pcHBldCBpcyBkZWZpbmVkIHVuZGVyIGEgc25pcHBldCBuYW1lIGFuZCBoYXMgYSBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBUaGUgcHJlZml4IGlzIHdoYXQgaXMgdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC5cblx0Ly8gRXhhbXBsZTpcblx0XCJQcmludCB0byBjb25zb2xlXCI6IHtcblx0XCJwcmVmaXhcIjogXCJsb2dcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCJjb25zb2xlLmxvZygnJDEnKTtcIixcblx0XHRcdFwiJDJcIlxuXHRcdF0sXG5cdFx0XHRcImRlc2NyaXB0aW9uXCI6IFwiTG9nIG91dHB1dCB0byBjb25zb2xlXCJcblx0fVxuKi9cblwiRGl2XCI6IHtcblx0XCJwcmVmaXhcIjogXCJkaXZcIixcblx0XHRcImJvZHlcIjogW1xuXHRcdFx0XCI8ZGl2PlwiLFxuXHRcdFx0XCJcIixcblx0XHRcdFwiPC9kaXY+XCJcblx0XHRdLFxuXHRcdFx0XCJkZXNjcmlwdGlvblwiOiBcIk5ldyBkaXYgY2hhbmdlZCBhZ2FpblwiXG5cdH1cbn1gO1xuXG5jb25zdCBnbG9iYWxTbmlwcGV0ID0gYHtcblx0Ly8gUGxhY2UgeW91ciBnbG9iYWwgc25pcHBldHMgaGVyZS4gRWFjaCBzbmlwcGV0IGlzIGRlZmluZWQgdW5kZXIgYSBzbmlwcGV0IG5hbWUgYW5kIGhhcyBhIHNjb3BlLCBwcmVmaXgsIGJvZHkgYW5kXG5cdC8vIGRlc2NyaXB0aW9uLiBBZGQgY29tbWEgc2VwYXJhdGVkIGlkcyBvZiB0aGUgbGFuZ3VhZ2VzIHdoZXJlIHRoZSBzbmlwcGV0IGlzIGFwcGxpY2FibGUgaW4gdGhlIHNjb3BlIGZpZWxkLiBJZiBzY29wZVxuXHQvLyBpcyBsZWZ0IGVtcHR5IG9yIG9taXR0ZWQsIHRoZSBzbmlwcGV0IGdldHMgYXBwbGllZCB0byBhbGwgbGFuZ3VhZ2VzLiBUaGUgcHJlZml4IGlzIHdoYXQgaXNcblx0Ly8gdXNlZCB0byB0cmlnZ2VyIHRoZSBzbmlwcGV0IGFuZCB0aGUgYm9keSB3aWxsIGJlIGV4cGFuZGVkIGFuZCBpbnNlcnRlZC4gUG9zc2libGUgdmFyaWFibGVzIGFyZTpcblx0Ly8gJDEsICQyIGZvciB0YWIgc3RvcHMsICQwIGZvciB0aGUgZmluYWwgY3Vyc29yIHBvc2l0aW9uLCBhbmQgezE6IGxhYmVsfSwgeyAyOiBhbm90aGVyIH0gZm9yIHBsYWNlaG9sZGVycy5cblx0Ly8gUGxhY2Vob2xkZXJzIHdpdGggdGhlIHNhbWUgaWRzIGFyZSBjb25uZWN0ZWQuXG5cdC8vIEV4YW1wbGU6XG5cdC8vIFwiUHJpbnQgdG8gY29uc29sZVwiOiB7XG5cdC8vIFx0XCJzY29wZVwiOiBcImphdmFzY3JpcHQsdHlwZXNjcmlwdFwiLFxuXHQvLyBcdFwicHJlZml4XCI6IFwibG9nXCIsXG5cdC8vIFx0XCJib2R5XCI6IFtcblx0Ly8gXHRcdFwiY29uc29sZS5sb2coJyQxJyk7XCIsXG5cdC8vIFx0XHRcIiQyXCJcblx0Ly8gXHRdLFxuXHQvLyBcdFwiZGVzY3JpcHRpb25cIjogXCJMb2cgb3V0cHV0IHRvIGNvbnNvbGVcIlxuXHQvLyB9XG59YDtcblxuc3VpdGUoJ1NuaXBwZXRzU3luYycsICgpID0+IHtcblxuXHRjb25zdCBzZXJ2ZXIgPSBuZXcgVXNlckRhdGFTeW5jVGVzdFNlcnZlcigpO1xuXHRsZXQgdGVzdENsaWVudDogVXNlckRhdGFTeW5jQ2xpZW50O1xuXHRsZXQgY2xpZW50MjogVXNlckRhdGFTeW5jQ2xpZW50O1xuXG5cdGxldCB0ZXN0T2JqZWN0OiBTbmlwcGV0c1N5bmNocm9uaXNlcjtcblxuXHR0ZWFyZG93bihhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSkuY2xlYXIoKTtcblx0fSk7XG5cblx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0c2V0dXAoYXN5bmMgKCkgPT4ge1xuXHRcdHRlc3RDbGllbnQgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgdGVzdENsaWVudC5zZXRVcCh0cnVlKTtcblx0XHR0ZXN0T2JqZWN0ID0gdGVzdENsaWVudC5nZXRTeW5jaHJvbml6ZXIoU3luY1Jlc291cmNlLlNuaXBwZXRzKSBhcyBTbmlwcGV0c1N5bmNocm9uaXNlcjtcblxuXHRcdGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiBzbmlwcGV0cyBkb2VzIG5vdCBleGlzdCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3Qgc25pcHBldHNSZXNvdXJjZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUuc25pcHBldHNIb21lO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhd2FpdCB0ZXN0T2JqZWN0LmdldExhc3RTeW5jVXNlckRhdGEoKSwgbnVsbCk7XG5cdFx0bGV0IG1hbmlmZXN0ID0gYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXG5cdFx0XHR7IHR5cGU6ICdHRVQnLCB1cmw6IGAke3NlcnZlci51cmx9L3YxL3Jlc291cmNlLyR7dGVzdE9iamVjdC5yZXNvdXJjZX0vbGF0ZXN0YCwgaGVhZGVyczoge30gfSxcblx0XHRdKTtcblx0XHRhc3NlcnQub2soIWF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhzbmlwcGV0c1Jlc291cmNlKSk7XG5cblx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YSEucmVmLCByZW1vdGVVc2VyRGF0YS5yZWYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YSEuc3luY0RhdGEsIHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YSEuc3luY0RhdGEsIG51bGwpO1xuXG5cdFx0bWFuaWZlc3QgPSBhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMobWFuaWZlc3QpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXSk7XG5cblx0XHRtYW5pZmVzdCA9IGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpO1xuXHRcdHNlcnZlci5yZXNldCgpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhtYW5pZmVzdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiBzbmlwcGV0IGlzIGNyZWF0ZWQgYWZ0ZXIgZmlyc3Qgc3luYycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cblx0XHRsZXQgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXG5cdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHtzZXJ2ZXIudXJsfS92MS9yZXNvdXJjZS8ke3Rlc3RPYmplY3QucmVzb3VyY2V9YCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiBsYXN0U3luY1VzZXJEYXRhPy5yZWYgfSB9LFxuXHRcdF0pO1xuXG5cdFx0bGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdGNvbnN0IHJlbW90ZVVzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRSZW1vdGVVc2VyRGF0YShudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnJlZiwgcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsYXN0U3luY1VzZXJEYXRhIS5zeW5jRGF0YSEuY29udGVudCwgSlNPTi5zdHJpbmdpZnkoeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxIH0pKTtcblx0fSk7XG5cblx0dGVzdCgnZmlyc3QgdGltZSBzeW5jIC0gb3V0Z29pbmcgdG8gc2VydmVyIChubyBzbmlwcGV0cyknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQxLCB0ZXN0Q2xpZW50KTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTbmlwcGV0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9KTtcblx0fSk7XG5cblx0dGVzdCgnZmlyc3QgdGltZSBzeW5jIC0gaW5jb21pbmcgZnJvbSBzZXJ2ZXIgKG5vIHNuaXBwZXRzKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0MSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgdHNTbmlwcGV0MSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IHRpbWUgc3luYyB3aGVuIHNuaXBwZXRzIGV4aXN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0MSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgdHNTbmlwcGV0MSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTbmlwcGV0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9KTtcblx0fSk7XG5cblx0dGVzdCgnZmlyc3QgdGltZSBzeW5jIHdoZW4gc25pcHBldHMgZXhpc3RzIC0gaGFzIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgbG9jYWwgPSBqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2h0bWwuanNvbicpO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW2xvY2FsXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IHRpbWUgc3luYyB3aGVuIHNuaXBwZXRzIGV4aXN0cyAtIGhhcyBjb25mbGljdHMgYW5kIGFjY2VwdCBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRjb25zdCBjb25mbGljdHMgPSB0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHM7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQoY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgaHRtbFNuaXBwZXQxKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRTbmlwcGV0KCdodG1sLmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgaHRtbFNuaXBwZXQxKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDEgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IHRpbWUgc3luYyB3aGVuIHNuaXBwZXRzIGV4aXN0cyAtIGhhcyBtdWx0aXBsZSBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElFbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxvY2FsMSA9IGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyk7XG5cdFx0Y29uc3QgbG9jYWwyID0gam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0eXBlc2NyaXB0Lmpzb24nKTtcblx0XHRhc3NlcnRQcmV2aWV3cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtsb2NhbDEsIGxvY2FsMl0pO1xuXHR9KTtcblxuXHR0ZXN0KCdmaXJzdCB0aW1lIHN5bmMgd2hlbiBzbmlwcGV0cyBleGlzdHMgLSBoYXMgbXVsdGlwbGUgY29uZmxpY3RzIGFuZCBhY2NlcHQgb25lIGNvbmZsaWN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRsZXQgY29uZmxpY3RzID0gdGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KGNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIGh0bWxTbmlwcGV0Mik7XG5cblx0XHRjb25mbGljdHMgPSB0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHM7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgbG9jYWwgPSBqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3R5cGVzY3JpcHQuanNvbicpO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW2xvY2FsXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpcnN0IHRpbWUgc3luYyB3aGVuIHNuaXBwZXRzIGV4aXN0cyAtIGhhcyBtdWx0aXBsZSBjb25mbGljdHMgYW5kIGFjY2VwdCBhbGwgY29uZmxpY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCBjb25mbGljdHMgPSB0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHM7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQoY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgaHRtbFNuaXBwZXQyKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChjb25mbGljdHNbMV0ucHJldmlld1Jlc291cmNlLCB0c1NuaXBwZXQxKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRTbmlwcGV0KCdodG1sLmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgaHRtbFNuaXBwZXQyKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCB0c1NuaXBwZXQxKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIsICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIGFkZGluZyBhIHNuaXBwZXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0MSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgdHNTbmlwcGV0MSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTbmlwcGV0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQxLCAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSB9KTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBhZGRpbmcgYSBzbmlwcGV0IC0gYWNjZXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0MSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgdHNTbmlwcGV0MSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N5bmMgdXBkYXRpbmcgYSBzbmlwcGV0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0Mik7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTbmlwcGV0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAnaHRtbC5qc29uJzogaHRtbFNuaXBwZXQyIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIHVwZGF0aW5nIGEgc25pcHBldCAtIGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIGh0bWxTbmlwcGV0Mik7XG5cdH0pO1xuXG5cdHRlc3QoJ3N5bmMgdXBkYXRpbmcgYSBzbmlwcGV0IC0gY29uZmxpY3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MywgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2NhbCA9IGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbbG9jYWxdKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyB1cGRhdGluZyBhIHNuaXBwZXQgLSByZXNvbHZlIGNvbmZsaWN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MiwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDMsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgaHRtbFNuaXBwZXQyKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRTbmlwcGV0KCdodG1sLmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgaHRtbFNuaXBwZXQyKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdodG1sLmpzb24nOiBodG1sU25pcHBldDIgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N5bmMgcmVtb3ZpbmcgYSBzbmlwcGV0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHJlbW92ZVNuaXBwZXQoJ2h0bWwuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCB0c1NuaXBwZXQxKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFNuaXBwZXQoJ2h0bWwuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBudWxsKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIHJlbW92aW5nIGEgc25pcHBldCAtIGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCByZW1vdmVTbmlwcGV0KCdodG1sLmpzb24nLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCB0c1NuaXBwZXQxKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFNuaXBwZXQoJ2h0bWwuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyByZW1vdmluZyBhIHNuaXBwZXQgbG9jYWxseSBhbmQgdXBkYXRpbmcgaXQgcmVtb3RlbHknLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHJlbW92ZVNuaXBwZXQoJ2h0bWwuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIHRzU25pcHBldDEpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIGh0bWxTbmlwcGV0Mik7XG5cdH0pO1xuXG5cdHRlc3QoJ3N5bmMgcmVtb3ZpbmcgYSBzbmlwcGV0IC0gY29uZmxpY3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlU25pcHBldCgnaHRtbC5qc29uJywgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2NhbCA9IGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbbG9jYWxdKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyByZW1vdmluZyBhIHNuaXBwZXQgLSByZXNvbHZlIGNvbmZsaWN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHJlbW92ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIGh0bWxTbmlwcGV0Myk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIHRzU25pcHBldDEpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIGh0bWxTbmlwcGV0Myk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VTbmlwcGV0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAndHlwZXNjcmlwdC5qc29uJzogdHNTbmlwcGV0MSwgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MyB9KTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyByZW1vdmluZyBhIHNuaXBwZXQgLSByZXNvbHZlIGNvbmZsaWN0IGJ5IHJlbW92aW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHJlbW92ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIG51bGwpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCB0c1NuaXBwZXQxKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFNuaXBwZXQoJ2h0bWwuanNvbicsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBudWxsKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIGdsb2JhbCBhbmQgbGFuZ3VhZ2Ugc25pcHBldCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdnbG9iYWwuY29kZS1zbmlwcGV0cycsIGdsb2JhbFNuaXBwZXQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRTbmlwcGV0KCdodG1sLmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgaHRtbFNuaXBwZXQxKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFNuaXBwZXQoJ2dsb2JhbC5jb2RlLXNuaXBwZXRzJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIGdsb2JhbFNuaXBwZXQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnRlbnQgIT09IG51bGwpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlU25pcHBldHMoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHsgJ2h0bWwuanNvbic6IGh0bWxTbmlwcGV0MSwgJ2dsb2JhbC5jb2RlLXNuaXBwZXRzJzogZ2xvYmFsU25pcHBldCB9KTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBzaG91bGQgaWdub3JlIG5vbiBzbmlwcGV0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdnbG9iYWwuY29kZS1zbmlwcGV0cycsIGdsb2JhbFNuaXBwZXQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuaHRtbCcsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgdHNTbmlwcGV0MSk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRTbmlwcGV0KCdnbG9iYWwuY29kZS1zbmlwcGV0cycsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBnbG9iYWxTbmlwcGV0KTtcblx0XHRjb25zdCBhY3R1YWwzID0gYXdhaXQgcmVhZFNuaXBwZXQoJ2h0bWwuaHRtbCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwzLCBudWxsKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVNuaXBwZXRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICd0eXBlc2NyaXB0Lmpzb24nOiB0c1NuaXBwZXQxLCAnZ2xvYmFsLmNvZGUtc25pcHBldHMnOiBnbG9iYWxTbmlwcGV0IH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmV2aWV3cyBhcmUgcmVzZXQgYWZ0ZXIgYWxsIGNvbmZsaWN0cyByZXNvbHZlZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0Y29uc3QgY29uZmxpY3RzID0gdGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KGNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIGh0bWxTbmlwcGV0Mik7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRjb25zdCBmaWxlU2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0YXNzZXJ0Lm9rKCFhd2FpdCBmaWxlU2VydmljZS5leGlzdHMoZGlybmFtZShjb25mbGljdHNbMF0ucHJldmlld1Jlc291cmNlKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBzbmlwcGV0cyBhbmQgYWxsIHNuaXBwZXRzIGFyZSBtZXJnZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAndHlwZXNjcmlwdC5qc29uJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBzbmlwcGV0cyBhbmQgYWxsIHNuaXBwZXRzIGFyZSBtZXJnZWQgYW5kIGFwcGxpZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBzbmlwcGV0cyBhbmQgb25lIHNuaXBwZXQgaGFzIG5vIGNoYW5nZXMgYW5kIG9uZSBzbmlwcGV0IGlzIG1lcmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAndHlwZXNjcmlwdC5qc29uJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBzbmlwcGV0cyBhbmQgb25lIHNuaXBwZXQgaGFzIG5vIGNoYW5nZXMgYW5kIHNuaXBwZXRzIGlzIG1lcmdlZCBhbmQgYXBwbGllZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cblx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXcsIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gdGhlcmUgYXJlIG11bHRpcGxlIHNuaXBwZXRzIHdpdGggY29uZmxpY3RzIGFuZCBhbGwgc25pcHBldHMgYXJlIG1lcmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdodG1sLmpzb24nKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0eXBlc2NyaXB0Lmpzb24nKSxcblx0XHRcdF0pO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdodG1sLmpzb24nKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0eXBlc2NyaXB0Lmpzb24nKSxcblx0XHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdhY2NlcHQgd2hlbiB0aGVyZSBhcmUgbXVsdGlwbGUgc25pcHBldHMgd2l0aCBjb25mbGljdHMgYW5kIG9ubHkgb25lIHNuaXBwZXQgaXMgYWNjZXB0ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDEsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQyLCB0ZXN0Q2xpZW50KTtcblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2h0bWwuanNvbicpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3R5cGVzY3JpcHQuanNvbicpLFxuXHRcdFx0XSk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2h0bWwuanNvbicpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3R5cGVzY3JpcHQuanNvbicpLFxuXHRcdFx0XSk7XG5cblx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hY2NlcHQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1swXS5wcmV2aWV3UmVzb3VyY2UsIGh0bWxTbmlwcGV0Mik7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2h0bWwuanNvbicpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3R5cGVzY3JpcHQuanNvbicpLFxuXHRcdFx0XSk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3R5cGVzY3JpcHQuanNvbicpLFxuXHRcdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FjY2VwdCB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBzbmlwcGV0cyB3aXRoIGNvbmZsaWN0cyBhbmQgYWxsIHNuaXBwZXRzIGFyZSBhY2NlcHRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MSwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ3R5cGVzY3JpcHQuanNvbicsIHRzU25pcHBldDIsIHRlc3RDbGllbnQpO1xuXHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAndHlwZXNjcmlwdC5qc29uJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnRQcmV2aWV3cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAndHlwZXNjcmlwdC5qc29uJyksXG5cdFx0XHRdKTtcblxuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSwgaHRtbFNuaXBwZXQyKTtcblx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hY2NlcHQocHJldmlldyEucmVzb3VyY2VQcmV2aWV3c1sxXS5wcmV2aWV3UmVzb3VyY2UsIHRzU25pcHBldDIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnaHRtbC5qc29uJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAndHlwZXNjcmlwdC5qc29uJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdhY2NlcHQgd2hlbiB0aGVyZSBhcmUgbXVsdGlwbGUgc25pcHBldHMgd2l0aCBjb25mbGljdHMgYW5kIGFsbCBzbmlwcGV0cyBhcmUgYWNjZXB0ZWQgYW5kIGFwcGxpZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgnaHRtbC5qc29uJywgaHRtbFNuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCd0eXBlc2NyaXB0Lmpzb24nLCB0c1NuaXBwZXQxLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVNuaXBwZXQoJ2h0bWwuanNvbicsIGh0bWxTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlU25pcHBldCgndHlwZXNjcmlwdC5qc29uJywgdHNTbmlwcGV0MiwgdGVzdENsaWVudCk7XG5cdFx0bGV0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdodG1sLmpzb24nKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0eXBlc2NyaXB0Lmpzb24nKSxcblx0XHRcdF0pO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdodG1sLmpzb24nKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0eXBlc2NyaXB0Lmpzb24nKSxcblx0XHRcdF0pO1xuXG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlLCBodG1sU25pcHBldDIpO1xuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzFdLnByZXZpZXdSZXNvdXJjZSwgdHNTbmlwcGV0Mik7XG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdzeW5jIHByb2ZpbGUgc25pcHBldHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY2xpZW50MiA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFVzZXJEYXRhU3luY0NsaWVudChzZXJ2ZXIpKTtcblx0XHRhd2FpdCBjbGllbnQyLnNldFVwKHRydWUpO1xuXHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCBjbGllbnQyLmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpLmNyZWF0ZU5hbWVkUHJvZmlsZSgncHJvZmlsZTEnKTtcblx0XHRhd2FpdCB1cGRhdGVTbmlwcGV0KCdodG1sLmpzb24nLCBodG1sU25pcHBldDEsIGNsaWVudDIsIHByb2ZpbGUpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdENsaWVudC5zeW5jKCk7XG5cblx0XHRjb25zdCBzeW5jZWRQcm9maWxlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5wcm9maWxlcy5maW5kKHAgPT4gcC5pZCA9PT0gcHJvZmlsZS5pZCkhO1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkU25pcHBldCgnaHRtbC5qc29uJywgdGVzdENsaWVudCwgc3luY2VkUHJvZmlsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRlbnQsIGh0bWxTbmlwcGV0MSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHBhcnNlU25pcHBldHMoY29udGVudDogc3RyaW5nKTogSVN0cmluZ0RpY3Rpb25hcnk8c3RyaW5nPiB7XG5cdFx0Y29uc3Qgc3luY0RhdGE6IElTeW5jRGF0YSA9IEpTT04ucGFyc2UoY29udGVudCk7XG5cdFx0cmV0dXJuIEpTT04ucGFyc2Uoc3luY0RhdGEuY29udGVudCk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiB1cGRhdGVTbmlwcGV0KG5hbWU6IHN0cmluZywgY29udGVudDogc3RyaW5nLCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudCwgcHJvZmlsZT86IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBzbmlwcGV0c1Jlc291cmNlID0gam9pblBhdGgoKHByb2ZpbGUgPz8gdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUpLnNuaXBwZXRzSG9tZSwgbmFtZSk7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHNuaXBwZXRzUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoY29udGVudCkpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gcmVtb3ZlU25pcHBldChuYW1lOiBzdHJpbmcsIGNsaWVudDogVXNlckRhdGFTeW5jQ2xpZW50KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElGaWxlU2VydmljZSk7XG5cdFx0Y29uc3QgdXNlckRhdGFQcm9maWxlc1NlcnZpY2UgPSBjbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSk7XG5cdFx0Y29uc3Qgc25pcHBldHNSZXNvdXJjZSA9IGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnNuaXBwZXRzSG9tZSwgbmFtZSk7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2UuZGVsKHNuaXBwZXRzUmVzb3VyY2UpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gcmVhZFNuaXBwZXQobmFtZTogc3RyaW5nLCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudCwgcHJvZmlsZT86IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBzbmlwcGV0c1Jlc291cmNlID0gam9pblBhdGgoKHByb2ZpbGUgPz8gdXNlckRhdGFQcm9maWxlc1NlcnZpY2UuZGVmYXVsdFByb2ZpbGUpLnNuaXBwZXRzSG9tZSwgbmFtZSk7XG5cdFx0aWYgKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhzbmlwcGV0c1Jlc291cmNlKSkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHNuaXBwZXRzUmVzb3VyY2UpO1xuXHRcdFx0cmV0dXJuIGNvbnRlbnQudmFsdWUudG9TdHJpbmcoKTtcblx0XHR9XG5cdFx0cmV0dXJuIG51bGw7XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRQcmV2aWV3cyhhY3R1YWw6IElSZXNvdXJjZVByZXZpZXdbXSwgZXhwZWN0ZWQ6IFVSSVtdKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubWFwKCh7IHByZXZpZXdSZXNvdXJjZSB9KSA9PiBwcmV2aWV3UmVzb3VyY2UudG9TdHJpbmcoKSksIGV4cGVjdGVkLm1hcCh1cmkgPT4gdXJpLnRvU3RyaW5nKCkpKTtcblx0fVxuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGdCQUFnQjtBQUV6QixTQUFTLFNBQVMsZ0JBQWdCO0FBRWxDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQTJCLGdDQUFnQztBQUUzRCxTQUFzQywyQkFBMkIsa0JBQWtCLGNBQWMsa0JBQWtCO0FBQ25ILFNBQVMsb0JBQW9CLDhCQUE4QjtBQUUzRCxNQUFNLGFBQWE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQWtCbkIsTUFBTSxhQUFhO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFrQm5CLE1BQU0sZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUF5QnJCLE1BQU0sZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUF5QnJCLE1BQU0sZUFBZTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUF5QnJCLE1BQU0sZ0JBQWdCO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFB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
