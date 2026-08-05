import assert from "assert";
import { VSBuffer } from "../../../../../base/common/buffer.js";
import { IFileService } from "../../../../files/common/files.js";
import { assertDefined } from "../../../../../base/common/types.js";
import { dirname, joinPath } from "../../../../../base/common/resources.js";
import { IEnvironmentService } from "../../../../environment/common/environment.js";
import { UserDataSyncClient, UserDataSyncTestServer } from "../userDataSyncClient.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { IUserDataProfilesService } from "../../../../userDataProfile/common/userDataProfile.js";
import { IUserDataSyncStoreService, PREVIEW_DIR_NAME, SyncResource, SyncStatus } from "../../../common/userDataSync.js";
const PROMPT1_TEXT = "Write a poem about a programmer who falls in love with their code.";
const PROMPT2_TEXT = "Explain quantum physics using only emojis and cat memes.";
const PROMPT3_TEXT = "Create a dialogue between a toaster and a refrigerator about their daily routines.";
const PROMPT4_TEXT = "Describe a day in the life of a rubber duck debugging session.";
const PROMPT5_TEXT = "Write a short story where a bug in the code becomes a superhero.";
const PROMPT6_TEXT = "Imagine a world where all software bugs are sentient.\nWhat do they talk about?";
suite("PromptsSync", () => {
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
    const maybeSynchronizer = testClient.getSynchronizer(SyncResource.Prompts);
    assertDefined(
      maybeSynchronizer,
      "Prompts synchronizer object must be defined."
    );
    testObject = maybeSynchronizer;
    client2 = disposableStore.add(new UserDataSyncClient(server));
    await client2.setUp(true);
  });
  test("\u2022 when prompts does not exist", async () => {
    const fileService = testClient.instantiationService.get(IFileService);
    const promptsResource = testClient.instantiationService.get(IUserDataProfilesService).defaultProfile.promptsHome;
    assert.deepStrictEqual(await testObject.getLastSyncUserData(), null);
    let manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, [
      { type: "GET", url: `${server.url}/v1/resource/${testObject.resource}/latest`, headers: {} }
    ]);
    assert.ok(!await fileService.exists(promptsResource));
    const lastSyncUserData = await testObject.getLastSyncUserData();
    assertDefined(
      lastSyncUserData,
      "Last sync user data must be defined."
    );
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
  test("\u2022 when prompt is created after first sync", async () => {
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, testClient);
    let lastSyncUserData = await testObject.getLastSyncUserData();
    const manifest = await testClient.getResourceManifest();
    server.reset();
    await testObject.sync(manifest);
    assert.deepStrictEqual(server.requests, [
      { type: "POST", url: `${server.url}/v1/resource/${testObject.resource}`, headers: { "If-Match": lastSyncUserData?.ref } }
    ]);
    lastSyncUserData = await testObject.getLastSyncUserData();
    assertDefined(
      lastSyncUserData,
      "Last sync user data must be defined."
    );
    const remoteUserData = await testObject.getRemoteUserData(null);
    assert.deepStrictEqual(lastSyncUserData.ref, remoteUserData.ref);
    assert.deepStrictEqual(lastSyncUserData.syncData, remoteUserData.syncData);
    assertDefined(
      lastSyncUserData.syncData,
      "Last sync user sync data must be defined."
    );
    assert.deepStrictEqual(
      lastSyncUserData.syncData.content,
      JSON.stringify({ "prompt3.prompt.md": PROMPT3_TEXT })
    );
  });
  test("\u2022 first time sync - outgoing to server (no prompts)", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, testClient);
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(
      actual,
      {
        "prompt3.prompt.md": PROMPT3_TEXT,
        "prompt1.prompt.md": PROMPT1_TEXT
      }
    );
  });
  test("\u2022 first time sync - incoming from server (no prompts)", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const actual2 = await readPrompt("prompt1.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT1_TEXT);
  });
  test("\u2022 first time sync when prompts exists", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const actual2 = await readPrompt("prompt1.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT1_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(
      actual,
      {
        "prompt3.prompt.md": PROMPT3_TEXT,
        "prompt1.prompt.md": PROMPT1_TEXT
      }
    );
  });
  test("\u2022 first time sync when prompts exists - has conflicts", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(
      environmentService.userDataSyncHome,
      testObject.resource,
      PREVIEW_DIR_NAME,
      "prompt3.prompt.md"
    );
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("\u2022 first time sync when prompts exists - has conflicts and accept conflicts", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, PROMPT3_TEXT);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "prompt3.prompt.md": PROMPT3_TEXT });
  });
  test("\u2022 first time sync when prompts exists - has multiple conflicts", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("prompt1.prompt.md", PROMPT2_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local1 = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "prompt3.prompt.md");
    const local2 = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "prompt1.prompt.md");
    assertPreviews(testObject.conflicts.conflicts, [local1, local2]);
  });
  test("\u2022 first time sync when prompts exists - has multiple conflicts and accept one conflict", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("prompt1.prompt.md", PROMPT2_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    let conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, PROMPT4_TEXT);
    conflicts = testObject.conflicts.conflicts;
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "prompt1.prompt.md");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("\u2022 first time sync when prompts exists - has multiple conflicts and accept all conflicts", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("prompt1.prompt.md", PROMPT2_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, PROMPT4_TEXT);
    await testObject.accept(conflicts[1].previewResource, PROMPT1_TEXT);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT4_TEXT);
    const actual2 = await readPrompt("prompt1.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT1_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "prompt3.prompt.md": PROMPT4_TEXT, "prompt1.prompt.md": PROMPT1_TEXT });
  });
  test("\u2022 sync adding a prompt", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const actual2 = await readPrompt("prompt1.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT1_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "prompt3.prompt.md": PROMPT3_TEXT, "prompt1.prompt.md": PROMPT1_TEXT });
  });
  test("\u2022 sync adding a prompt - accept", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("prompt1.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const actual2 = await readPrompt("prompt1.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT1_TEXT);
  });
  test("\u2022 sync updating a prompt", async () => {
    await updatePrompt("default.prompt.md", PROMPT3_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("default.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("default.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT4_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "default.prompt.md": PROMPT4_TEXT });
  });
  test("\u2022 sync updating a prompt - accept", async () => {
    await updatePrompt("my.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("my.prompt.md", PROMPT4_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("my.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT4_TEXT);
  });
  test("\u2022 sync updating a prompt - conflict", async () => {
    await updatePrompt("some.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("some.prompt.md", PROMPT4_TEXT, client2);
    await client2.sync();
    await updatePrompt("some.prompt.md", PROMPT5_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "some.prompt.md");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("\u2022 sync updating a prompt - resolve conflict", async () => {
    await updatePrompt("advanced.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("advanced.prompt.md", PROMPT4_TEXT, client2);
    await client2.sync();
    await updatePrompt("advanced.prompt.md", PROMPT5_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, PROMPT4_TEXT);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("advanced.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT4_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "advanced.prompt.md": PROMPT4_TEXT });
  });
  test("\u2022 sync removing a prompt", async () => {
    await updatePrompt("another.prompt.md", PROMPT3_TEXT, testClient);
    await updatePrompt("chat.prompt.md", PROMPT1_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await removePrompt("another.prompt.md", testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("chat.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("another.prompt.md", testClient);
    assert.strictEqual(actual2, null);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "chat.prompt.md": PROMPT1_TEXT });
  });
  test("\u2022 sync removing a prompt - accept", async () => {
    await updatePrompt("my-query.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("summarize.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removePrompt("my-query.prompt.md", client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("summarize.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("my-query.prompt.md", testClient);
    assert.strictEqual(actual2, null);
  });
  test("\u2022 sync removing a prompt locally and updating it remotely", async () => {
    await updatePrompt("some.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("important.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await updatePrompt("some.prompt.md", PROMPT4_TEXT, client2);
    await client2.sync();
    await removePrompt("some.prompt.md", testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("important.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("some.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT4_TEXT);
  });
  test("\u2022 sync removing a prompt - conflict", async () => {
    await updatePrompt("common.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("rare.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removePrompt("common.prompt.md", client2);
    await client2.sync();
    await updatePrompt("common.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    const local = joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "common.prompt.md");
    assertPreviews(testObject.conflicts.conflicts, [local]);
  });
  test("\u2022 sync removing a prompt - resolve conflict", async () => {
    await updatePrompt("uncommon.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("hot.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removePrompt("uncommon.prompt.md", client2);
    await client2.sync();
    await updatePrompt("uncommon.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, PROMPT5_TEXT);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("hot.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("uncommon.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT5_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "hot.prompt.md": PROMPT1_TEXT, "uncommon.prompt.md": PROMPT5_TEXT });
  });
  test("\u2022 sync removing a prompt - resolve conflict by removing", async () => {
    await updatePrompt("prompt3.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("refactor.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    await removePrompt("prompt3.prompt.md", client2);
    await client2.sync();
    await updatePrompt("prompt3.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    await testObject.accept(testObject.conflicts.conflicts[0].previewResource, null);
    await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("refactor.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("prompt3.prompt.md", testClient);
    assert.strictEqual(actual2, null);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "refactor.prompt.md": PROMPT1_TEXT });
  });
  test("\u2022 sync prompts", async () => {
    await updatePrompt("first.prompt.md", PROMPT6_TEXT, client2);
    await updatePrompt("roaming.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("roaming.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT3_TEXT);
    const actual2 = await readPrompt("first.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT6_TEXT);
    const { content } = await testClient.read(testObject.resource);
    assertDefined(
      content,
      "Test object content must be defined."
    );
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "roaming.prompt.md": PROMPT3_TEXT, "first.prompt.md": PROMPT6_TEXT });
  });
  test("\u2022 sync should ignore non prompts", async () => {
    await updatePrompt("my.prompt.md", PROMPT6_TEXT, client2);
    await updatePrompt("html.html", PROMPT3_TEXT, client2);
    await updatePrompt("shared.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await testObject.sync(await testClient.getResourceManifest());
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
    const actual1 = await readPrompt("shared.prompt.md", testClient);
    assert.strictEqual(actual1, PROMPT1_TEXT);
    const actual2 = await readPrompt("my.prompt.md", testClient);
    assert.strictEqual(actual2, PROMPT6_TEXT);
    const actual3 = await readPrompt("html.html", testClient);
    assert.strictEqual(actual3, null);
    const { content } = await testClient.read(testObject.resource);
    assert.ok(content !== null);
    const actual = parsePrompts(content);
    assert.deepStrictEqual(actual, { "shared.prompt.md": PROMPT1_TEXT, "my.prompt.md": PROMPT6_TEXT });
  });
  test("\u2022 previews are reset after all conflicts resolved", async () => {
    await updatePrompt("html.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("css.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("html.prompt.md", PROMPT4_TEXT, testClient);
    await testObject.sync(await testClient.getResourceManifest());
    const conflicts = testObject.conflicts.conflicts;
    await testObject.accept(conflicts[0].previewResource, PROMPT4_TEXT);
    await testObject.apply(false);
    const fileService = testClient.instantiationService.get(IFileService);
    assert.ok(!await fileService.exists(dirname(conflicts[0].previewResource)));
  });
  test("\u2022 merge when there are multiple prompts and all prompts are merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("sublime.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("tests.prompt.md", PROMPT2_TEXT, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "sublime.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "tests.prompt.md")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 merge when there are multiple prompts and all prompts are merged and applied", async () => {
    await updatePrompt("short.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("long.prompt.md", PROMPT2_TEXT, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(preview, null);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 merge when there are multiple prompts and one prompt has no changes and one prompt is merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("coding.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await updatePrompt("coding.prompt.md", PROMPT3_TEXT, testClient);
    await updatePrompt("exploring.prompt.md", PROMPT2_TEXT, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "exploring.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "coding.prompt.md")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 merge when there are multiple prompts and one prompt has no changes and prompts is merged and applied", async () => {
    await updatePrompt("quick.prompt.md", PROMPT3_TEXT, client2);
    await client2.sync();
    await updatePrompt("quick.prompt.md", PROMPT3_TEXT, testClient);
    await updatePrompt("databases.prompt.md", PROMPT2_TEXT, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(preview, null);
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 merge when there are multiple prompts with conflicts and all prompts are merged", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("reverse.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("recycle.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("reverse.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("recycle.prompt.md", PROMPT2_TEXT, testClient);
    const preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "reverse.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "recycle.prompt.md")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "reverse.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "recycle.prompt.md")
      ]
    );
  });
  test("\u2022 accept when there are multiple prompts with conflicts and only one prompt is accepted", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("current.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("future.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("current.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("future.prompt.md", PROMPT2_TEXT, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "current.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "future.prompt.md")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "current.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "future.prompt.md")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, PROMPT4_TEXT);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "current.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "future.prompt.md")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "future.prompt.md")
      ]
    );
  });
  test("\u2022 accept when there are multiple prompts with conflicts and all prompts are accepted", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("dynamic.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("static.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("dynamic.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("static.prompt.md", PROMPT2_TEXT, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "dynamic.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "static.prompt.md")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "dynamic.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "static.prompt.md")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, PROMPT4_TEXT);
    preview = await testObject.accept(preview.resourcePreviews[1].previewResource, PROMPT2_TEXT);
    assert.strictEqual(testObject.status, SyncStatus.Syncing);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "dynamic.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "static.prompt.md")
      ]
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 accept when there are multiple prompts with conflicts and all prompts are accepted and applied", async () => {
    const environmentService = testClient.instantiationService.get(IEnvironmentService);
    await updatePrompt("edicational.prompt.md", PROMPT3_TEXT, client2);
    await updatePrompt("unknown.prompt.md", PROMPT1_TEXT, client2);
    await client2.sync();
    await updatePrompt("edicational.prompt.md", PROMPT4_TEXT, testClient);
    await updatePrompt("unknown.prompt.md", PROMPT2_TEXT, testClient);
    let preview = await testObject.sync(await testClient.getResourceManifest(), true);
    assertDefined(
      preview,
      "Preview must be defined."
    );
    assert.strictEqual(testObject.status, SyncStatus.HasConflicts);
    assertPreviews(
      preview.resourcePreviews,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "edicational.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "unknown.prompt.md")
      ]
    );
    assertPreviews(
      testObject.conflicts.conflicts,
      [
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "edicational.prompt.md"),
        joinPath(environmentService.userDataSyncHome, testObject.resource, PREVIEW_DIR_NAME, "unknown.prompt.md")
      ]
    );
    preview = await testObject.accept(preview.resourcePreviews[0].previewResource, PROMPT4_TEXT);
    assertDefined(
      preview,
      "Preview must be defined after accept."
    );
    preview = await testObject.accept(preview.resourcePreviews[1].previewResource, PROMPT2_TEXT);
    preview = await testObject.apply(false);
    assert.strictEqual(testObject.status, SyncStatus.Idle);
    assert.strictEqual(
      preview,
      null,
      "Preview after the last apply must be `null`."
    );
    assert.deepStrictEqual(testObject.conflicts.conflicts, []);
  });
  test("\u2022 sync profile prompts", async () => {
    const client22 = disposableStore.add(new UserDataSyncClient(server));
    await client22.setUp(true);
    const profile = await client22.instantiationService.get(IUserDataProfilesService).createNamedProfile("profile1");
    await updatePrompt("my.prompt.md", PROMPT3_TEXT, client22, profile);
    await client22.sync();
    await testClient.sync();
    const syncedProfile = testClient.instantiationService.get(IUserDataProfilesService).profiles.find((p) => p.id === profile.id);
    const content = await readPrompt("my.prompt.md", testClient, syncedProfile);
    assert.strictEqual(content, PROMPT3_TEXT);
  });
  function parsePrompts(content) {
    const syncData = JSON.parse(content);
    return JSON.parse(syncData.content);
  }
  async function updatePrompt(name, content, client, profile) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const promptsResource = joinPath((profile ?? userDataProfilesService.defaultProfile).promptsHome, name);
    await fileService.writeFile(promptsResource, VSBuffer.fromString(content));
  }
  async function removePrompt(name, client) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const promptsResource = joinPath(userDataProfilesService.defaultProfile.promptsHome, name);
    await fileService.del(promptsResource);
  }
  async function readPrompt(name, client, profile) {
    const fileService = client.instantiationService.get(IFileService);
    const userDataProfilesService = client.instantiationService.get(IUserDataProfilesService);
    const promptsResource = joinPath((profile ?? userDataProfilesService.defaultProfile).promptsHome, name);
    if (await fileService.exists(promptsResource)) {
      const content = await fileService.readFile(promptsResource);
      return content.value.toString();
    }
    return null;
  }
  function assertPreviews(actual, expected) {
    assert.deepStrictEqual(
      actual.map(({ previewResource }) => previewResource.toString()),
      expected.map((uri) => uri.toString())
    );
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vcHJvbXB0c1N5bmMvcHJvbXB0c1N5bmMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgYXNzZXJ0RGVmaW5lZCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IGRpcm5hbWUsIGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgUHJvbXB0c1N5bmNocm9uaXplciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9wcm9tcHRzU3luYy9wcm9tcHRzU3luYy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IFVzZXJEYXRhU3luY0NsaWVudCwgVXNlckRhdGFTeW5jVGVzdFNlcnZlciB9IGZyb20gJy4uL3VzZXJEYXRhU3luY0NsaWVudC5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElVc2VyRGF0YVByb2ZpbGUsIElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3VzZXJEYXRhUHJvZmlsZS9jb21tb24vdXNlckRhdGFQcm9maWxlLmpzJztcbmltcG9ydCB7IElSZXNvdXJjZVByZXZpZXcsIElTeW5jRGF0YSwgSVVzZXJEYXRhU3luY1N0b3JlU2VydmljZSwgUFJFVklFV19ESVJfTkFNRSwgU3luY1Jlc291cmNlLCBTeW5jU3RhdHVzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5cbmNvbnN0IFBST01QVDFfVEVYVCA9ICdXcml0ZSBhIHBvZW0gYWJvdXQgYSBwcm9ncmFtbWVyIHdobyBmYWxscyBpbiBsb3ZlIHdpdGggdGhlaXIgY29kZS4nO1xuY29uc3QgUFJPTVBUMl9URVhUID0gJ0V4cGxhaW4gcXVhbnR1bSBwaHlzaWNzIHVzaW5nIG9ubHkgZW1vamlzIGFuZCBjYXQgbWVtZXMuJztcbmNvbnN0IFBST01QVDNfVEVYVCA9ICdDcmVhdGUgYSBkaWFsb2d1ZSBiZXR3ZWVuIGEgdG9hc3RlciBhbmQgYSByZWZyaWdlcmF0b3IgYWJvdXQgdGhlaXIgZGFpbHkgcm91dGluZXMuJztcbmNvbnN0IFBST01QVDRfVEVYVCA9ICdEZXNjcmliZSBhIGRheSBpbiB0aGUgbGlmZSBvZiBhIHJ1YmJlciBkdWNrIGRlYnVnZ2luZyBzZXNzaW9uLic7XG5jb25zdCBQUk9NUFQ1X1RFWFQgPSAnV3JpdGUgYSBzaG9ydCBzdG9yeSB3aGVyZSBhIGJ1ZyBpbiB0aGUgY29kZSBiZWNvbWVzIGEgc3VwZXJoZXJvLic7XG5jb25zdCBQUk9NUFQ2X1RFWFQgPSAnSW1hZ2luZSBhIHdvcmxkIHdoZXJlIGFsbCBzb2Z0d2FyZSBidWdzIGFyZSBzZW50aWVudC5cXG5XaGF0IGRvIHRoZXkgdGFsayBhYm91dD8nO1xuXG5zdWl0ZSgnUHJvbXB0c1N5bmMnLCAoKSA9PiB7XG5cdGNvbnN0IHNlcnZlciA9IG5ldyBVc2VyRGF0YVN5bmNUZXN0U2VydmVyKCk7XG5cdGxldCB0ZXN0Q2xpZW50OiBVc2VyRGF0YVN5bmNDbGllbnQ7XG5cdGxldCBjbGllbnQyOiBVc2VyRGF0YVN5bmNDbGllbnQ7XG5cblx0bGV0IHRlc3RPYmplY3Q6IFByb21wdHNTeW5jaHJvbml6ZXI7XG5cblx0dGVhcmRvd24oYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVN5bmNTdG9yZVNlcnZpY2UpLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVTdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHR0ZXN0Q2xpZW50ID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdGF3YWl0IHRlc3RDbGllbnQuc2V0VXAodHJ1ZSk7XG5cblx0XHRjb25zdCBtYXliZVN5bmNocm9uaXplciA9IHRlc3RDbGllbnQuZ2V0U3luY2hyb25pemVyKFN5bmNSZXNvdXJjZS5Qcm9tcHRzKSBhcyAoUHJvbXB0c1N5bmNocm9uaXplciB8IHVuZGVmaW5lZCk7XG5cblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0bWF5YmVTeW5jaHJvbml6ZXIsXG5cdFx0XHQnUHJvbXB0cyBzeW5jaHJvbml6ZXIgb2JqZWN0IG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHR0ZXN0T2JqZWN0ID0gbWF5YmVTeW5jaHJvbml6ZXI7XG5cblx0XHRjbGllbnQyID0gZGlzcG9zYWJsZVN0b3JlLmFkZChuZXcgVXNlckRhdGFTeW5jQ2xpZW50KHNlcnZlcikpO1xuXHRcdGF3YWl0IGNsaWVudDIuc2V0VXAodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiB3aGVuIHByb21wdHMgZG9lcyBub3QgZXhpc3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZmlsZVNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHByb21wdHNSZXNvdXJjZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElVc2VyRGF0YVByb2ZpbGVzU2VydmljZSkuZGVmYXVsdFByb2ZpbGUucHJvbXB0c0hvbWU7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpLCBudWxsKTtcblx0XHRsZXQgbWFuaWZlc3QgPSBhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKTtcblx0XHRzZXJ2ZXIucmVzZXQoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMobWFuaWZlc3QpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtcblx0XHRcdHsgdHlwZTogJ0dFVCcsIHVybDogYCR7c2VydmVyLnVybH0vdjEvcmVzb3VyY2UvJHt0ZXN0T2JqZWN0LnJlc291cmNlfS9sYXRlc3RgLCBoZWFkZXJzOiB7fSB9LFxuXHRcdF0pO1xuXHRcdGFzc2VydC5vayghKGF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhwcm9tcHRzUmVzb3VyY2UpKSk7XG5cblx0XHRjb25zdCBsYXN0U3luY1VzZXJEYXRhID0gYXdhaXQgdGVzdE9iamVjdC5nZXRMYXN0U3luY1VzZXJEYXRhKCk7XG5cblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0bGFzdFN5bmNVc2VyRGF0YSxcblx0XHRcdCdMYXN0IHN5bmMgdXNlciBkYXRhIG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHRjb25zdCByZW1vdGVVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0UmVtb3RlVXNlckRhdGEobnVsbCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsYXN0U3luY1VzZXJEYXRhLnJlZiwgcmVtb3RlVXNlckRhdGEucmVmKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxhc3RTeW5jVXNlckRhdGEuc3luY0RhdGEsIHJlbW90ZVVzZXJEYXRhLnN5bmNEYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSwgbnVsbCk7XG5cblx0XHRtYW5pZmVzdCA9IGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpO1xuXHRcdHNlcnZlci5yZXNldCgpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhtYW5pZmVzdCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2ZXIucmVxdWVzdHMsIFtdKTtcblxuXHRcdG1hbmlmZXN0ID0gYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZlci5yZXF1ZXN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgd2hlbiBwcm9tcHQgaXMgY3JlYXRlZCBhZnRlciBmaXJzdCBzeW5jJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgdGVzdENsaWVudCk7XG5cblx0XHRsZXQgbGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXHRcdGNvbnN0IG1hbmlmZXN0ID0gYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCk7XG5cdFx0c2VydmVyLnJlc2V0KCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKG1hbmlmZXN0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmVyLnJlcXVlc3RzLCBbXG5cdFx0XHR7IHR5cGU6ICdQT1NUJywgdXJsOiBgJHtzZXJ2ZXIudXJsfS92MS9yZXNvdXJjZS8ke3Rlc3RPYmplY3QucmVzb3VyY2V9YCwgaGVhZGVyczogeyAnSWYtTWF0Y2gnOiBsYXN0U3luY1VzZXJEYXRhPy5yZWYgfSB9LFxuXHRcdF0pO1xuXG5cdFx0bGFzdFN5bmNVc2VyRGF0YSA9IGF3YWl0IHRlc3RPYmplY3QuZ2V0TGFzdFN5bmNVc2VyRGF0YSgpO1xuXG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGxhc3RTeW5jVXNlckRhdGEsXG5cdFx0XHQnTGFzdCBzeW5jIHVzZXIgZGF0YSBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgcmVtb3RlVXNlckRhdGEgPSBhd2FpdCB0ZXN0T2JqZWN0LmdldFJlbW90ZVVzZXJEYXRhKG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGFzdFN5bmNVc2VyRGF0YS5yZWYsIHJlbW90ZVVzZXJEYXRhLnJlZik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsYXN0U3luY1VzZXJEYXRhLnN5bmNEYXRhLCByZW1vdGVVc2VyRGF0YS5zeW5jRGF0YSk7XG5cblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0bGFzdFN5bmNVc2VyRGF0YS5zeW5jRGF0YSxcblx0XHRcdCdMYXN0IHN5bmMgdXNlciBzeW5jIGRhdGEgbXVzdCBiZSBkZWZpbmVkLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRsYXN0U3luY1VzZXJEYXRhLnN5bmNEYXRhLmNvbnRlbnQsXG5cdFx0XHRKU09OLnN0cmluZ2lmeSh7ICdwcm9tcHQzLnByb21wdC5tZCc6IFBST01QVDNfVEVYVCB9KSxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgZmlyc3QgdGltZSBzeW5jIC0gb3V0Z29pbmcgdG8gc2VydmVyIChubyBwcm9tcHRzKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDEucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCB0ZXN0Q2xpZW50KTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0Y29udGVudCxcblx0XHRcdCdUZXN0IG9iamVjdCBjb250ZW50IG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVByb21wdHMoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdGFjdHVhbCxcblx0XHRcdHtcblx0XHRcdFx0J3Byb21wdDMucHJvbXB0Lm1kJzogUFJPTVBUM19URVhULFxuXHRcdFx0XHQncHJvbXB0MS5wcm9tcHQubWQnOiBQUk9NUFQxX1RFWFQsXG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIGZpcnN0IHRpbWUgc3luYyAtIGluY29taW5nIGZyb20gc2VydmVyIChubyBwcm9tcHRzKScsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDEucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgUFJPTVBUM19URVhUKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFByb21wdCgncHJvbXB0MS5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgUFJPTVBUMV9URVhUKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIGZpcnN0IHRpbWUgc3luYyB3aGVuIHByb21wdHMgZXhpc3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQzX1RFWFQpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBQUk9NUFQxX1RFWFQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHQnVGVzdCBvYmplY3QgY29udGVudCBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRhY3R1YWwsXG5cdFx0XHR7XG5cdFx0XHRcdCdwcm9tcHQzLnByb21wdC5tZCc6IFBST01QVDNfVEVYVCxcblx0XHRcdFx0J3Byb21wdDEucHJvbXB0Lm1kJzogUFJPTVBUMV9URVhULFxuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBmaXJzdCB0aW1lIHN5bmMgd2hlbiBwcm9tcHRzIGV4aXN0cyAtIGhhcyBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2NhbCA9IGpvaW5QYXRoKFxuXHRcdFx0ZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsXG5cdFx0XHR0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLFxuXHRcdFx0J3Byb21wdDMucHJvbXB0Lm1kJyxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbbG9jYWxdKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIGZpcnN0IHRpbWUgc3luYyB3aGVuIHByb21wdHMgZXhpc3RzIC0gaGFzIGNvbmZsaWN0cyBhbmQgYWNjZXB0IGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0Y29uc3QgY29uZmxpY3RzID0gdGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KGNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIFBST01QVDNfVEVYVCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQzX1RFWFQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHQnVGVzdCBvYmplY3QgY29udGVudCBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdwcm9tcHQzLnByb21wdC5tZCc6IFBST01QVDNfVEVYVCB9KTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIGZpcnN0IHRpbWUgc3luYyB3aGVuIHByb21wdHMgZXhpc3RzIC0gaGFzIG11bHRpcGxlIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDEucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0MS5wcm9tcHQubWQnLCBQUk9NUFQyX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2NhbDEgPSBqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3Byb21wdDMucHJvbXB0Lm1kJyk7XG5cdFx0Y29uc3QgbG9jYWwyID0gam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdwcm9tcHQxLnByb21wdC5tZCcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW2xvY2FsMSwgbG9jYWwyXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBmaXJzdCB0aW1lIHN5bmMgd2hlbiBwcm9tcHRzIGV4aXN0cyAtIGhhcyBtdWx0aXBsZSBjb25mbGljdHMgYW5kIGFjY2VwdCBvbmUgY29uZmxpY3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDEucHJvbXB0Lm1kJywgUFJPTVBUMl9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0bGV0IGNvbmZsaWN0cyA9IHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cztcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChjb25mbGljdHNbMF0ucHJldmlld1Jlc291cmNlLCBQUk9NUFQ0X1RFWFQpO1xuXG5cdFx0Y29uZmxpY3RzID0gdGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElFbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGNvbnN0IGxvY2FsID0gam9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdwcm9tcHQxLnByb21wdC5tZCcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW2xvY2FsXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBmaXJzdCB0aW1lIHN5bmMgd2hlbiBwcm9tcHRzIGV4aXN0cyAtIGhhcyBtdWx0aXBsZSBjb25mbGljdHMgYW5kIGFjY2VwdCBhbGwgY29uZmxpY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0MS5wcm9tcHQubWQnLCBQUk9NUFQxX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDRfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIFBST01QVDJfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGNvbnN0IGNvbmZsaWN0cyA9IHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cztcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChjb25mbGljdHNbMF0ucHJldmlld1Jlc291cmNlLCBQUk9NUFQ0X1RFWFQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KGNvbmZsaWN0c1sxXS5wcmV2aWV3UmVzb3VyY2UsIFBST01QVDFfVEVYVCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQ0X1RFWFQpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBQUk9NUFQxX1RFWFQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHQnVGVzdCBvYmplY3QgY29udGVudCBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdwcm9tcHQzLnByb21wdC5tZCc6IFBST01QVDRfVEVYVCwgJ3Byb21wdDEucHJvbXB0Lm1kJzogUFJPTVBUMV9URVhUIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgc3luYyBhZGRpbmcgYSBwcm9tcHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncHJvbXB0MS5wcm9tcHQubWQnLCBQUk9NUFQxX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFByb21wdCgncHJvbXB0My5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgUFJPTVBUM19URVhUKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFByb21wdCgncHJvbXB0MS5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgUFJPTVBUMV9URVhUKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydC5vayhjb250ZW50ICE9PSBudWxsKTtcblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVByb21wdHMoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHsgJ3Byb21wdDMucHJvbXB0Lm1kJzogUFJPTVBUM19URVhULCAncHJvbXB0MS5wcm9tcHQubWQnOiBQUk9NUFQxX1RFWFQgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIGFkZGluZyBhIHByb21wdCAtIGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQxLnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDNfVEVYVCk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRQcm9tcHQoJ3Byb21wdDEucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIFBST01QVDFfVEVYVCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHVwZGF0aW5nIGEgcHJvbXB0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnZGVmYXVsdC5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2RlZmF1bHQucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRQcm9tcHQoJ2RlZmF1bHQucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDRfVEVYVCk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdkZWZhdWx0LnByb21wdC5tZCc6IFBST01QVDRfVEVYVCB9KTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIHN5bmMgdXBkYXRpbmcgYSBwcm9tcHQgLSBhY2NlcHQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdteS5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ215LnByb21wdC5tZCcsIFBST01QVDRfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRQcm9tcHQoJ215LnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQ0X1RFWFQpO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgc3luYyB1cGRhdGluZyBhIHByb21wdCAtIGNvbmZsaWN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc29tZS5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3NvbWUucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc29tZS5wcm9tcHQubWQnLCBQUk9NUFQ1X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0Y29uc3QgbG9jYWwgPSBqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3NvbWUucHJvbXB0Lm1kJyk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbbG9jYWxdKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIHN5bmMgdXBkYXRpbmcgYSBwcm9tcHQgLSByZXNvbHZlIGNvbmZsaWN0JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnYWR2YW5jZWQucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdhZHZhbmNlZC5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdhZHZhbmNlZC5wcm9tcHQubWQnLCBQUk9NUFQ1X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgUFJPTVBUNF9URVhUKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXG5cdFx0Y29uc3QgYWN0dWFsMSA9IGF3YWl0IHJlYWRQcm9tcHQoJ2FkdmFuY2VkLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQ0X1RFWFQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0Lm9rKGNvbnRlbnQgIT09IG51bGwpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlUHJvbXB0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAnYWR2YW5jZWQucHJvbXB0Lm1kJzogUFJPTVBUNF9URVhUIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgc3luYyByZW1vdmluZyBhIHByb21wdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2Fub3RoZXIucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2NoYXQucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlUHJvbXB0KCdhbm90aGVyLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFByb21wdCgnY2hhdC5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMSwgUFJPTVBUMV9URVhUKTtcblx0XHRjb25zdCBhY3R1YWwyID0gYXdhaXQgcmVhZFByb21wdCgnYW5vdGhlci5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgbnVsbCk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnREZWZpbmVkKFxuXHRcdFx0Y29udGVudCxcblx0XHRcdCdUZXN0IG9iamVjdCBjb250ZW50IG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdCk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBwYXJzZVByb21wdHMoY29udGVudCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIHsgJ2NoYXQucHJvbXB0Lm1kJzogUFJPTVBUMV9URVhUIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgc3luYyByZW1vdmluZyBhIHByb21wdCAtIGFjY2VwdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ215LXF1ZXJ5LnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdzdW1tYXJpemUucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlUHJvbXB0KCdteS1xdWVyeS5wcm9tcHQubWQnLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFByb21wdCgnc3VtbWFyaXplLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQxX1RFWFQpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkUHJvbXB0KCdteS1xdWVyeS5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHJlbW92aW5nIGEgcHJvbXB0IGxvY2FsbHkgYW5kIHVwZGF0aW5nIGl0IHJlbW90ZWx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc29tZS5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnaW1wb3J0YW50LnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc29tZS5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlUHJvbXB0KCdzb21lLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdpbXBvcnRhbnQucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDFfVEVYVCk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRQcm9tcHQoJ3NvbWUucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIFBST01QVDRfVEVYVCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHJlbW92aW5nIGEgcHJvbXB0IC0gY29uZmxpY3QnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdjb21tb24ucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3JhcmUucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlUHJvbXB0KCdjb21tb24ucHJvbXB0Lm1kJywgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2NvbW1vbi5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSGFzQ29uZmxpY3RzKTtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblx0XHRjb25zdCBsb2NhbCA9IGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnY29tbW9uLnByb21wdC5tZCcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW2xvY2FsXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHJlbW92aW5nIGEgcHJvbXB0IC0gcmVzb2x2ZSBjb25mbGljdCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3VuY29tbW9uLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdob3QucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXG5cdFx0YXdhaXQgcmVtb3ZlUHJvbXB0KCd1bmNvbW1vbi5wcm9tcHQubWQnLCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgndW5jb21tb24ucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIFBST01QVDVfVEVYVCk7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdob3QucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDFfVEVYVCk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRQcm9tcHQoJ3VuY29tbW9uLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBQUk9NUFQ1X1RFWFQpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHQnVGVzdCBvYmplY3QgY29udGVudCBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdob3QucHJvbXB0Lm1kJzogUFJPTVBUMV9URVhULCAndW5jb21tb24ucHJvbXB0Lm1kJzogUFJPTVBUNV9URVhUIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgc3luYyByZW1vdmluZyBhIHByb21wdCAtIHJlc29sdmUgY29uZmxpY3QgYnkgcmVtb3ZpbmcnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdwcm9tcHQzLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdyZWZhY3Rvci5wcm9tcHQubWQnLCBQUk9NUFQxX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRhd2FpdCByZW1vdmVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UsIG51bGwpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cblx0XHRjb25zdCBhY3R1YWwxID0gYXdhaXQgcmVhZFByb21wdCgncmVmYWN0b3IucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDFfVEVYVCk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRQcm9tcHQoJ3Byb21wdDMucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDIsIG51bGwpO1xuXG5cdFx0Y29uc3QgeyBjb250ZW50IH0gPSBhd2FpdCB0ZXN0Q2xpZW50LnJlYWQodGVzdE9iamVjdC5yZXNvdXJjZSk7XG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdGNvbnRlbnQsXG5cdFx0XHQnVGVzdCBvYmplY3QgY29udGVudCBtdXN0IGJlIGRlZmluZWQuJyxcblx0XHQpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdyZWZhY3Rvci5wcm9tcHQubWQnOiBQUk9NUFQxX1RFWFQgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHByb21wdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdmaXJzdC5wcm9tcHQubWQnLCBQUk9NUFQ2X1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgncm9hbWluZy5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdyb2FtaW5nLnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwxLCBQUk9NUFQzX1RFWFQpO1xuXHRcdGNvbnN0IGFjdHVhbDIgPSBhd2FpdCByZWFkUHJvbXB0KCdmaXJzdC5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMiwgUFJPTVBUNl9URVhUKTtcblxuXHRcdGNvbnN0IHsgY29udGVudCB9ID0gYXdhaXQgdGVzdENsaWVudC5yZWFkKHRlc3RPYmplY3QucmVzb3VyY2UpO1xuXHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRjb250ZW50LFxuXHRcdFx0J1Rlc3Qgb2JqZWN0IGNvbnRlbnQgbXVzdCBiZSBkZWZpbmVkLicsXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlUHJvbXB0cyhjb250ZW50KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgeyAncm9hbWluZy5wcm9tcHQubWQnOiBQUk9NUFQzX1RFWFQsICdmaXJzdC5wcm9tcHQubWQnOiBQUk9NUFQ2X1RFWFQgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBzeW5jIHNob3VsZCBpZ25vcmUgbm9uIHByb21wdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdteS5wcm9tcHQubWQnLCBQUk9NUFQ2X1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnaHRtbC5odG1sJywgUFJPTVBUM19URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3NoYXJlZC5wcm9tcHQubWQnLCBQUk9NUFQxX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblxuXHRcdGNvbnN0IGFjdHVhbDEgPSBhd2FpdCByZWFkUHJvbXB0KCdzaGFyZWQucHJvbXB0Lm1kJywgdGVzdENsaWVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbDEsIFBST01QVDFfVEVYVCk7XG5cdFx0Y29uc3QgYWN0dWFsMiA9IGF3YWl0IHJlYWRQcm9tcHQoJ215LnByb21wdC5tZCcsIHRlc3RDbGllbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwyLCBQUk9NUFQ2X1RFWFQpO1xuXHRcdGNvbnN0IGFjdHVhbDMgPSBhd2FpdCByZWFkUHJvbXB0KCdodG1sLmh0bWwnLCB0ZXN0Q2xpZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsMywgbnVsbCk7XG5cblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IGF3YWl0IHRlc3RDbGllbnQucmVhZCh0ZXN0T2JqZWN0LnJlc291cmNlKTtcblx0XHRhc3NlcnQub2soY29udGVudCAhPT0gbnVsbCk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VQcm9tcHRzKGNvbnRlbnQpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7ICdzaGFyZWQucHJvbXB0Lm1kJzogUFJPTVBUMV9URVhULCAnbXkucHJvbXB0Lm1kJzogUFJPTVBUNl9URVhUIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgcHJldmlld3MgYXJlIHJlc2V0IGFmdGVyIGFsbCBjb25mbGljdHMgcmVzb2x2ZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdodG1sLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdjc3MucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnaHRtbC5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSk7XG5cblx0XHRjb25zdCBjb25mbGljdHMgPSB0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHM7XG5cdFx0YXdhaXQgdGVzdE9iamVjdC5hY2NlcHQoY29uZmxpY3RzWzBdLnByZXZpZXdSZXNvdXJjZSwgUFJPTVBUNF9URVhUKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRhc3NlcnQub2soIWF3YWl0IGZpbGVTZXJ2aWNlLmV4aXN0cyhkaXJuYW1lKGNvbmZsaWN0c1swXS5wcmV2aWV3UmVzb3VyY2UpKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9tcHRzIGFuZCBhbGwgcHJvbXB0cyBhcmUgbWVyZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElFbnZpcm9ubWVudFNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdzdWJsaW1lLnByb21wdC5tZCcsIFBST01QVDRfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCd0ZXN0cy5wcm9tcHQubWQnLCBQUk9NUFQyX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnc3VibGltZS5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd0ZXN0cy5wcm9tcHQubWQnKSxcblx0XHRcdF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9tcHRzIGFuZCBhbGwgcHJvbXB0cyBhcmUgbWVyZ2VkIGFuZCBhcHBsaWVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc2hvcnQucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2xvbmcucHJvbXB0Lm1kJywgUFJPTVBUMl9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYXBwbHkoZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLklkbGUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmV2aWV3LCBudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cywgW10pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgbWVyZ2Ugd2hlbiB0aGVyZSBhcmUgbXVsdGlwbGUgcHJvbXB0cyBhbmQgb25lIHByb21wdCBoYXMgbm8gY2hhbmdlcyBhbmQgb25lIHByb21wdCBpcyBtZXJnZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2NvZGluZy5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdjb2RpbmcucHJvbXB0Lm1kJywgUFJPTVBUM19URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2V4cGxvcmluZy5wcm9tcHQubWQnLCBQUk9NUFQyX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGNvbnN0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLlN5bmNpbmcpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnZXhwbG9yaW5nLnByb21wdC5tZCcpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2NvZGluZy5wcm9tcHQubWQnKSxcblx0XHRcdF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9tcHRzIGFuZCBvbmUgcHJvbXB0IGhhcyBubyBjaGFuZ2VzIGFuZCBwcm9tcHRzIGlzIG1lcmdlZCBhbmQgYXBwbGllZCcsIGFzeW5jICgpID0+IHtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3F1aWNrLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3F1aWNrLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdkYXRhYmFzZXMucHJvbXB0Lm1kJywgUFJPTVBUMl9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRsZXQgcHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3Quc3luYyhhd2FpdCB0ZXN0Q2xpZW50LmdldFJlc291cmNlTWFuaWZlc3QoKSwgdHJ1ZSk7XG5cblx0XHRwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5hcHBseShmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5zdGF0dXMsIFN5bmNTdGF0dXMuSWRsZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByZXZpZXcsIG51bGwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBtZXJnZSB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9tcHRzIHdpdGggY29uZmxpY3RzIGFuZCBhbGwgcHJvbXB0cyBhcmUgbWVyZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElFbnZpcm9ubWVudFNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdyZXZlcnNlLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdyZWN5Y2xlLnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3JldmVyc2UucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ3JlY3ljbGUucHJvbXB0Lm1kJywgUFJPTVBUMl9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRjb25zdCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAncmV2ZXJzZS5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdyZWN5Y2xlLnByb21wdC5tZCcpLFxuXHRcdFx0XSk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3JldmVyc2UucHJvbXB0Lm1kJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAncmVjeWNsZS5wcm9tcHQubWQnKSxcblx0XHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdcdTIwMjIgYWNjZXB0IHdoZW4gdGhlcmUgYXJlIG11bHRpcGxlIHByb21wdHMgd2l0aCBjb25mbGljdHMgYW5kIG9ubHkgb25lIHByb21wdCBpcyBhY2NlcHRlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBlbnZpcm9ubWVudFNlcnZpY2UgPSB0ZXN0Q2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRW52aXJvbm1lbnRTZXJ2aWNlKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnY3VycmVudC5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnZnV0dXJlLnByb21wdC5tZCcsIFBST01QVDFfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgY2xpZW50Mi5zeW5jKCk7XG5cblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2N1cnJlbnQucHJvbXB0Lm1kJywgUFJPTVBUNF9URVhULCB0ZXN0Q2xpZW50KTtcblx0XHRhd2FpdCB1cGRhdGVQcm9tcHQoJ2Z1dHVyZS5wcm9tcHQubWQnLCBQUk9NUFQyX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnY3VycmVudC5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdmdXR1cmUucHJvbXB0Lm1kJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnRQcmV2aWV3cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnY3VycmVudC5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdmdXR1cmUucHJvbXB0Lm1kJyksXG5cdFx0XHRdKTtcblxuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzBdLnByZXZpZXdSZXNvdXJjZSwgUFJPTVBUNF9URVhUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXchLnJlc291cmNlUHJldmlld3MsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnY3VycmVudC5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdmdXR1cmUucHJvbXB0Lm1kJyksXG5cdFx0XHRdKTtcblx0XHRhc3NlcnRQcmV2aWV3cyh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsXG5cdFx0XHRbXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnZnV0dXJlLnByb21wdC5tZCcpLFxuXHRcdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1x1MjAyMiBhY2NlcHQgd2hlbiB0aGVyZSBhcmUgbXVsdGlwbGUgcHJvbXB0cyB3aXRoIGNvbmZsaWN0cyBhbmQgYWxsIHByb21wdHMgYXJlIGFjY2VwdGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGVudmlyb25tZW50U2VydmljZSA9IHRlc3RDbGllbnQuaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElFbnZpcm9ubWVudFNlcnZpY2UpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdkeW5hbWljLnByb21wdC5tZCcsIFBST01QVDNfVEVYVCwgY2xpZW50Mik7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdzdGF0aWMucHJvbXB0Lm1kJywgUFJPTVBUMV9URVhULCBjbGllbnQyKTtcblx0XHRhd2FpdCBjbGllbnQyLnN5bmMoKTtcblxuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnZHluYW1pYy5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgnc3RhdGljLnByb21wdC5tZCcsIFBST01QVDJfVEVYVCwgdGVzdENsaWVudCk7XG5cdFx0bGV0IHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LnN5bmMoYXdhaXQgdGVzdENsaWVudC5nZXRSZXNvdXJjZU1hbmlmZXN0KCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3RPYmplY3Quc3RhdHVzLCBTeW5jU3RhdHVzLkhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0UHJldmlld3MocHJldmlldyEucmVzb3VyY2VQcmV2aWV3cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdkeW5hbWljLnByb21wdC5tZCcpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3N0YXRpYy5wcm9tcHQubWQnKSxcblx0XHRcdF0pO1xuXHRcdGFzc2VydFByZXZpZXdzKHRlc3RPYmplY3QuY29uZmxpY3RzLmNvbmZsaWN0cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdkeW5hbWljLnByb21wdC5tZCcpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3N0YXRpYy5wcm9tcHQubWQnKSxcblx0XHRcdF0pO1xuXG5cdFx0cHJldmlldyA9IGF3YWl0IHRlc3RPYmplY3QuYWNjZXB0KHByZXZpZXchLnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlLCBQUk9NUFQ0X1RFWFQpO1xuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzWzFdLnByZXZpZXdSZXNvdXJjZSwgUFJPTVBUMl9URVhUKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5TeW5jaW5nKTtcblx0XHRhc3NlcnRQcmV2aWV3cyhwcmV2aWV3IS5yZXNvdXJjZVByZXZpZXdzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2R5bmFtaWMucHJvbXB0Lm1kJyksXG5cdFx0XHRcdGpvaW5QYXRoKGVudmlyb25tZW50U2VydmljZS51c2VyRGF0YVN5bmNIb21lLCB0ZXN0T2JqZWN0LnJlc291cmNlLCBQUkVWSUVXX0RJUl9OQU1FLCAnc3RhdGljLnByb21wdC5tZCcpLFxuXHRcdFx0XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIGFjY2VwdCB3aGVuIHRoZXJlIGFyZSBtdWx0aXBsZSBwcm9tcHRzIHdpdGggY29uZmxpY3RzIGFuZCBhbGwgcHJvbXB0cyBhcmUgYWNjZXB0ZWQgYW5kIGFwcGxpZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgZW52aXJvbm1lbnRTZXJ2aWNlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUVudmlyb25tZW50U2VydmljZSk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdlZGljYXRpb25hbC5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgndW5rbm93bi5wcm9tcHQubWQnLCBQUk9NUFQxX1RFWFQsIGNsaWVudDIpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdlZGljYXRpb25hbC5wcm9tcHQubWQnLCBQUk9NUFQ0X1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGF3YWl0IHVwZGF0ZVByb21wdCgndW5rbm93bi5wcm9tcHQubWQnLCBQUk9NUFQyX1RFWFQsIHRlc3RDbGllbnQpO1xuXHRcdGxldCBwcmV2aWV3ID0gYXdhaXQgdGVzdE9iamVjdC5zeW5jKGF3YWl0IHRlc3RDbGllbnQuZ2V0UmVzb3VyY2VNYW5pZmVzdCgpLCB0cnVlKTtcblxuXHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRwcmV2aWV3LFxuXHRcdFx0J1ByZXZpZXcgbXVzdCBiZSBkZWZpbmVkLicsXG5cdFx0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5IYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydFByZXZpZXdzKHByZXZpZXcucmVzb3VyY2VQcmV2aWV3cyxcblx0XHRcdFtcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICdlZGljYXRpb25hbC5wcm9tcHQubWQnKSxcblx0XHRcdFx0am9pblBhdGgoZW52aXJvbm1lbnRTZXJ2aWNlLnVzZXJEYXRhU3luY0hvbWUsIHRlc3RPYmplY3QucmVzb3VyY2UsIFBSRVZJRVdfRElSX05BTUUsICd1bmtub3duLnByb21wdC5tZCcpLFxuXHRcdFx0XSk7XG5cdFx0YXNzZXJ0UHJldmlld3ModGVzdE9iamVjdC5jb25mbGljdHMuY29uZmxpY3RzLFxuXHRcdFx0W1xuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ2VkaWNhdGlvbmFsLnByb21wdC5tZCcpLFxuXHRcdFx0XHRqb2luUGF0aChlbnZpcm9ubWVudFNlcnZpY2UudXNlckRhdGFTeW5jSG9tZSwgdGVzdE9iamVjdC5yZXNvdXJjZSwgUFJFVklFV19ESVJfTkFNRSwgJ3Vua25vd24ucHJvbXB0Lm1kJyksXG5cdFx0XHRdKTtcblxuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3LnJlc291cmNlUHJldmlld3NbMF0ucHJldmlld1Jlc291cmNlLCBQUk9NUFQ0X1RFWFQpO1xuXG5cdFx0YXNzZXJ0RGVmaW5lZChcblx0XHRcdHByZXZpZXcsXG5cdFx0XHQnUHJldmlldyBtdXN0IGJlIGRlZmluZWQgYWZ0ZXIgYWNjZXB0LicsXG5cdFx0KTtcblxuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFjY2VwdChwcmV2aWV3LnJlc291cmNlUHJldmlld3NbMV0ucHJldmlld1Jlc291cmNlLCBQUk9NUFQyX1RFWFQpO1xuXHRcdHByZXZpZXcgPSBhd2FpdCB0ZXN0T2JqZWN0LmFwcGx5KGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LnN0YXR1cywgU3luY1N0YXR1cy5JZGxlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdHByZXZpZXcsXG5cdFx0XHRudWxsLFxuXHRcdFx0J1ByZXZpZXcgYWZ0ZXIgdGhlIGxhc3QgYXBwbHkgbXVzdCBiZSBgbnVsbGAuJyxcblx0XHQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0ZXN0T2JqZWN0LmNvbmZsaWN0cy5jb25mbGljdHMsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgnXHUyMDIyIHN5bmMgcHJvZmlsZSBwcm9tcHRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNsaWVudDIgPSBkaXNwb3NhYmxlU3RvcmUuYWRkKG5ldyBVc2VyRGF0YVN5bmNDbGllbnQoc2VydmVyKSk7XG5cdFx0YXdhaXQgY2xpZW50Mi5zZXRVcCh0cnVlKTtcblx0XHRjb25zdCBwcm9maWxlID0gYXdhaXQgY2xpZW50Mi5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5jcmVhdGVOYW1lZFByb2ZpbGUoJ3Byb2ZpbGUxJyk7XG5cdFx0YXdhaXQgdXBkYXRlUHJvbXB0KCdteS5wcm9tcHQubWQnLCBQUk9NUFQzX1RFWFQsIGNsaWVudDIsIHByb2ZpbGUpO1xuXHRcdGF3YWl0IGNsaWVudDIuc3luYygpO1xuXG5cdFx0YXdhaXQgdGVzdENsaWVudC5zeW5jKCk7XG5cblx0XHRjb25zdCBzeW5jZWRQcm9maWxlID0gdGVzdENsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKS5wcm9maWxlcy5maW5kKHAgPT4gcC5pZCA9PT0gcHJvZmlsZS5pZCkhO1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBhd2FpdCByZWFkUHJvbXB0KCdteS5wcm9tcHQubWQnLCB0ZXN0Q2xpZW50LCBzeW5jZWRQcm9maWxlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGVudCwgUFJPTVBUM19URVhUKTtcblx0fSk7XG5cblx0ZnVuY3Rpb24gcGFyc2VQcm9tcHRzKGNvbnRlbnQ6IHN0cmluZyk6IElTdHJpbmdEaWN0aW9uYXJ5PHN0cmluZz4ge1xuXHRcdGNvbnN0IHN5bmNEYXRhOiBJU3luY0RhdGEgPSBKU09OLnBhcnNlKGNvbnRlbnQpO1xuXHRcdHJldHVybiBKU09OLnBhcnNlKHN5bmNEYXRhLmNvbnRlbnQpO1xuXHR9XG5cblx0YXN5bmMgZnVuY3Rpb24gdXBkYXRlUHJvbXB0KFxuXHRcdG5hbWU6IHN0cmluZyxcblx0XHRjb250ZW50OiBzdHJpbmcsXG5cdFx0Y2xpZW50OiBVc2VyRGF0YVN5bmNDbGllbnQsXG5cdFx0cHJvZmlsZT86IElVc2VyRGF0YVByb2ZpbGUsXG5cdCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHByb21wdHNSZXNvdXJjZSA9IGpvaW5QYXRoKChwcm9maWxlID8/IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlKS5wcm9tcHRzSG9tZSwgbmFtZSk7XG5cdFx0YXdhaXQgZmlsZVNlcnZpY2Uud3JpdGVGaWxlKHByb21wdHNSZXNvdXJjZSwgVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiByZW1vdmVQcm9tcHQobmFtZTogc3RyaW5nLCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJRmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlID0gY2xpZW50Lmluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJVXNlckRhdGFQcm9maWxlc1NlcnZpY2UpO1xuXHRcdGNvbnN0IHByb21wdHNSZXNvdXJjZSA9IGpvaW5QYXRoKHVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlLmRlZmF1bHRQcm9maWxlLnByb21wdHNIb21lLCBuYW1lKTtcblx0XHRhd2FpdCBmaWxlU2VydmljZS5kZWwocHJvbXB0c1Jlc291cmNlKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHJlYWRQcm9tcHQobmFtZTogc3RyaW5nLCBjbGllbnQ6IFVzZXJEYXRhU3luY0NsaWVudCwgcHJvZmlsZT86IElVc2VyRGF0YVByb2ZpbGUpOiBQcm9taXNlPHN0cmluZyB8IG51bGw+IHtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCB1c2VyRGF0YVByb2ZpbGVzU2VydmljZSA9IGNsaWVudC5pbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSVVzZXJEYXRhUHJvZmlsZXNTZXJ2aWNlKTtcblx0XHRjb25zdCBwcm9tcHRzUmVzb3VyY2UgPSBqb2luUGF0aCgocHJvZmlsZSA/PyB1c2VyRGF0YVByb2ZpbGVzU2VydmljZS5kZWZhdWx0UHJvZmlsZSkucHJvbXB0c0hvbWUsIG5hbWUpO1xuXHRcdGlmIChhd2FpdCBmaWxlU2VydmljZS5leGlzdHMocHJvbXB0c1Jlc291cmNlKSkge1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGF3YWl0IGZpbGVTZXJ2aWNlLnJlYWRGaWxlKHByb21wdHNSZXNvdXJjZSk7XG5cdFx0XHRyZXR1cm4gY29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdH1cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxuXG5cdGZ1bmN0aW9uIGFzc2VydFByZXZpZXdzKGFjdHVhbDogSVJlc291cmNlUHJldmlld1tdLCBleHBlY3RlZDogVVJJW10pIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0YWN0dWFsLm1hcCgoeyBwcmV2aWV3UmVzb3VyY2UgfSkgPT4gcHJldmlld1Jlc291cmNlLnRvU3RyaW5nKCkpLFxuXHRcdFx0ZXhwZWN0ZWQubWFwKHVyaSA9PiB1cmkudG9TdHJpbmcoKSksXG5cdFx0KTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFFbkIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxTQUFTLGdCQUFnQjtBQUdsQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG9CQUFvQiw4QkFBOEI7QUFDM0QsU0FBUywrQ0FBK0M7QUFDeEQsU0FBMkIsZ0NBQWdDO0FBQzNELFNBQXNDLDJCQUEyQixrQkFBa0IsY0FBYyxrQkFBa0I7QUFFbkgsTUFBTSxlQUFlO0FBQ3JCLE1BQU0sZUFBZTtBQUNyQixNQUFNLGVBQWU7QUFDckIsTUFBTSxlQUFlO0FBQ3JCLE1BQU0sZUFBZTtBQUNyQixNQUFNLGVBQWU7QUFFckIsTUFBTSxlQUFlLE1BQU07QUFDMUIsUUFBTSxTQUFTLElBQUksdUJBQXVCO0FBQzFDLE1BQUk7QUFDSixNQUFJO0FBRUosTUFBSTtBQUVKLFdBQVMsWUFBWTtBQUNwQixVQUFNLFdBQVcscUJBQXFCLElBQUkseUJBQXlCLEVBQUUsTUFBTTtBQUFBLEVBQzVFLENBQUM7QUFFRCxRQUFNLGtCQUFrQix3Q0FBd0M7QUFFaEUsUUFBTSxZQUFZO0FBQ2pCLGlCQUFhLGdCQUFnQixJQUFJLElBQUksbUJBQW1CLE1BQU0sQ0FBQztBQUMvRCxVQUFNLFdBQVcsTUFBTSxJQUFJO0FBRTNCLFVBQU0sb0JBQW9CLFdBQVcsZ0JBQWdCLGFBQWEsT0FBTztBQUV6RTtBQUFBLE1BQ0M7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUVBLGlCQUFhO0FBRWIsY0FBVSxnQkFBZ0IsSUFBSSxJQUFJLG1CQUFtQixNQUFNLENBQUM7QUFDNUQsVUFBTSxRQUFRLE1BQU0sSUFBSTtBQUFBLEVBQ3pCLENBQUM7QUFFRCxPQUFLLHNDQUFpQyxZQUFZO0FBQ2pELFVBQU0sY0FBYyxXQUFXLHFCQUFxQixJQUFJLFlBQVk7QUFD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
