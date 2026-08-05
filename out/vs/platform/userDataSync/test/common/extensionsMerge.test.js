import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { merge } from "../../common/extensionsMerge.js";
suite("ExtensionsMerge", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("merge returns local extension if remote does not exist", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, null, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, localExtensions);
  });
  test("merge returns local extension if remote does not exist with ignored extensions", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const expected = [
      localExtensions[1],
      localExtensions[2]
    ];
    const actual = merge(localExtensions, null, null, [], ["a"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge returns local extension if remote does not exist with ignored extensions (ignore case)", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const expected = [
      localExtensions[1],
      localExtensions[2]
    ];
    const actual = merge(localExtensions, null, null, [], ["A"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge returns local extension if remote does not exist with skipped extensions", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const skippedExtension = [
      aSyncExtension({ identifier: { id: "b", uuid: "b" } })
    ];
    const expected = [...localExtensions];
    const actual = merge(localExtensions, null, null, skippedExtension, [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge returns local extension if remote does not exist with skipped and ignored extensions", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const skippedExtension = [
      aSyncExtension({ identifier: { id: "b", uuid: "b" } })
    ];
    const expected = [localExtensions[1], localExtensions[2]];
    const actual = merge(localExtensions, null, null, skippedExtension, ["a"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when there is no base", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const remoteExtensions = [
      aSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } }),
      anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when there is no base and with ignored extensions", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const remoteExtensions = [
      aSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } }),
      anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], ["a"], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when remote is moved forwarded", () => {
    const baseExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const remoteExtensions = [
      aSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "a", uuid: "a" }, { id: "d", uuid: "d" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.strictEqual(actual.remote, null);
  });
  test("merge local and remote extensions when remote is moved forwarded with disabled extension", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "c", uuid: "c" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" }, disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" }, disabled: true })]);
    assert.strictEqual(actual.remote, null);
  });
  test("merge local and remote extensions when remote moved forwarded with ignored extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], ["a"], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "d", uuid: "d" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.strictEqual(actual.remote, null);
  });
  test("merge local and remote extensions when remote is moved forwarded with skipped extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, [], []);
    assert.deepStrictEqual(actual.local.added, [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "d", uuid: "d" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.strictEqual(actual.remote, null);
  });
  test("merge local and remote extensions when remote is moved forwarded with skipped and ignored extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, ["b"], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "d", uuid: "d" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.strictEqual(actual.remote, null);
  });
  test("merge local and remote extensions when local is moved forwarded", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when local is moved forwarded with disabled extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true }),
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when local is moved forwarded with ignored settings", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], ["b"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ]);
  });
  test("merge local and remote extensions when local is moved forwarded with skipped extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when local is moved forwarded with skipped and ignored extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, ["c"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when both moved forwarded", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "e", uuid: "e" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } })]);
    assert.deepStrictEqual(actual.local.removed, [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when both moved forwarded with ignored extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "e", uuid: "e" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], ["a", "e"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when both moved forwarded with skipped extensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "e", uuid: "e" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge local and remote extensions when both moved forwarded with skipped and ignoredextensions", () => {
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const skippedExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aRemoteSyncExtension({ identifier: { id: "e", uuid: "e" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "e", uuid: "e" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, skippedExtensions, ["e"], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge when remote extension has no uuid and different extension id case", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aLocalSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      aLocalSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "A" } }),
      aRemoteSyncExtension({ identifier: { id: "d", uuid: "d" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "A", uuid: "a" } }),
      anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } }),
      anExpectedSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedSyncExtension({ identifier: { id: "c", uuid: "c" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "d", uuid: "d" } })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge when remote extension is not an installed extension", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" }, installed: false })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge when remote extension is not an installed extension but is an installed extension locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge when an extension is not an installed extension remotely and does not exist locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false }),
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" }, installed: false })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge when an extension is an installed extension remotely but not locally and updated locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const expected = [
      anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge when an extension is an installed extension remotely but not locally and updated remotely", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [
      anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, disabled: true })
    ]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge not installed extensions", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" }, installed: false })
    ];
    const expected = [
      anExpectedBuiltinSyncExtension({ identifier: { id: "b", uuid: "b" } }),
      anExpectedBuiltinSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, expected);
  });
  test("merge: remote extension with prerelease is added", () => {
    const localExtensions = [];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension with prerelease is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const remoteExtensions = [];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })]);
  });
  test("merge: remote extension with prerelease is added when local extension without prerelease is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension without prerelease is added when local extension with prerelease is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension is changed to prerelease", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension is changed to release", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension is changed to prerelease", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })]);
  });
  test("merge: local extension is changed to release", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
  });
  test("merge: local extension not an installed extension - remote preRelease property is taken precedence when there are no updates", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension not an installed extension - remote preRelease property is taken precedence when there are updates locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false, disabled: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true, disabled: true })]);
  });
  test("merge: local extension not an installed extension - remote preRelease property is taken precedence when there are updates remotely", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true, disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, preRelease: true, disabled: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension not an installed extension - remote version is taken precedence when there are no updates", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension not an installed extension - remote version is taken precedence when there are updates locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false, disabled: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", disabled: true })]);
  });
  test("merge: local extension not an installed extension - remote version property is taken precedence when there are updates remotely", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", disabled: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: base has builtin extension, local does not have extension, remote has extension installed", () => {
    const localExtensions = [];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: base has installed extension, local has installed extension, remote has extension builtin", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: base has installed extension, local has builtin extension, remote does not has extension", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedBuiltinSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
  });
  test("merge: base has builtin extension, local has installed extension, remote has builtin extension with updated state", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false, state: { "a": 1 } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, state: { "a": 1 } })]);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, state: { "a": 1 } })]);
  });
  test("merge: base has installed extension, last time synced as builtin extension, local has installed extension, remote has builtin extension with updated state", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false, state: { "a": 1 } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, state: { "a": 1 } })]);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, state: { "a": 1 } })]);
  });
  test("merge: base has builtin extension, local does not have extension, remote has builtin extension", () => {
    const localExtensions = [];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", installed: false })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: base has installed extension, last synced as builtin, local does not have extension, remote has installed extension", () => {
    const localExtensions = [];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: base has builtin extension, last synced as builtin, local does not have extension, remote has installed extension", () => {
    const localExtensions = [];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0", installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], [{ id: "a", uuid: "a" }]);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "1.1.0" })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension with pinned is added", () => {
    const localExtensions = [];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })]);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension with pinned is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const remoteExtensions = [];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })]);
  });
  test("merge: remote extension with pinned is added when local extension without pinned is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension without pinned is added when local extension with pinned is added", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension is changed to pinned", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension is changed to unpinned", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension is changed to pinned", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })]);
  });
  test("merge: local extension is changed to unpinned", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
  });
  test("merge: local extension not an installed extension - remote pinned property is taken precedence when there are no updates", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension not an installed extension - remote pinned property is taken precedence when there are updates locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false, disabled: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true, disabled: true })]);
  });
  test("merge: local extension not an installed extension - remote pinned property is taken precedence when there are updates remotely", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, installed: false })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true, disabled: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true, disabled: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension is changed to pinned and version changed", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })]);
  });
  test("merge: local extension is changed to unpinned and version changed", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
  });
  test("merge: remote extension is changed to pinned and version changed", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension is changed to pinned and version changed and remote extension is channged to pinned with different version", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.2", pinned: true })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.2", pinned: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: remote extension is changed to unpinned and version changed", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1", pinned: true })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, localExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge: local extension is changed to unpinned and version changed and remote extension is channged to unpinned with different version", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.1" })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, version: "0.0.2" })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, pinned: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("sync adding local application scoped extension", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: true })
    ];
    const actual = merge(localExtensions, null, null, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, localExtensions);
  });
  test("sync merging local extension with isApplicationScoped property and remote does not has isApplicationScoped property", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: false })
    ];
    const baseExtensions = [
      aSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const actual = merge(localExtensions, baseExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" } })]);
  });
  test("sync merging when applicaiton scope is changed locally", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: true })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: false })
    ];
    const actual = merge(localExtensions, baseExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote?.all, localExtensions);
  });
  test("sync merging when applicaiton scope is changed remotely", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: false })
    ];
    const baseExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: false })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: true })
    ];
    const actual = merge(localExtensions, remoteExtensions, baseExtensions, [], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, [anExpectedSyncExtension({ identifier: { id: "a", uuid: "a" }, isApplicationScoped: true })]);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge does not remove remote extension when skipped extension has uuid but remote does not has", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "b" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [aRemoteSyncExtension({ identifier: { id: "b", uuid: "b" } })], [], []);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  test("merge does not remove remote extension when last sync builtin extension has uuid but remote does not has", () => {
    const localExtensions = [
      aLocalSyncExtension({ identifier: { id: "a", uuid: "a" } })
    ];
    const remoteExtensions = [
      aRemoteSyncExtension({ identifier: { id: "a", uuid: "a" } }),
      aRemoteSyncExtension({ identifier: { id: "b" } })
    ];
    const actual = merge(localExtensions, remoteExtensions, remoteExtensions, [], [], [{ id: "b", uuid: "b" }]);
    assert.deepStrictEqual(actual.local.added, []);
    assert.deepStrictEqual(actual.local.removed, []);
    assert.deepStrictEqual(actual.local.updated, []);
    assert.deepStrictEqual(actual.remote, null);
  });
  function anExpectedSyncExtension(extension) {
    return {
      identifier: { id: "a", uuid: "a" },
      version: "1.0.0",
      pinned: false,
      preRelease: false,
      installed: true,
      ...extension
    };
  }
  function anExpectedBuiltinSyncExtension(extension) {
    return {
      identifier: { id: "a", uuid: "a" },
      version: "1.0.0",
      pinned: false,
      preRelease: false,
      ...extension
    };
  }
  function aLocalSyncExtension(extension) {
    return {
      identifier: { id: "a", uuid: "a" },
      version: "1.0.0",
      pinned: false,
      preRelease: false,
      installed: true,
      ...extension
    };
  }
  function aRemoteSyncExtension(extension) {
    return {
      identifier: { id: "a", uuid: "a" },
      version: "1.0.0",
      pinned: false,
      preRelease: false,
      installed: true,
      ...extension
    };
  }
  function aSyncExtension(extension) {
    return {
      identifier: { id: "a", uuid: "a" },
      version: "1.0.0",
      installed: true,
      ...extension
    };
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vZXh0ZW5zaW9uc01lcmdlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IG1lcmdlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dGVuc2lvbnNNZXJnZS5qcyc7XG5pbXBvcnQgeyBJTG9jYWxTeW5jRXh0ZW5zaW9uLCBJU3luY0V4dGVuc2lvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi91c2VyRGF0YVN5bmMuanMnO1xuXG5zdWl0ZSgnRXh0ZW5zaW9uc01lcmdlJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ21lcmdlIHJldHVybnMgbG9jYWwgZXh0ZW5zaW9uIGlmIHJlbW90ZSBkb2VzIG5vdCBleGlzdCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgbnVsbCwgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGxvY2FsRXh0ZW5zaW9ucyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHJldHVybnMgbG9jYWwgZXh0ZW5zaW9uIGlmIHJlbW90ZSBkb2VzIG5vdCBleGlzdCB3aXRoIGlnbm9yZWQgZXh0ZW5zaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGxvY2FsRXh0ZW5zaW9uc1sxXSxcblx0XHRcdGxvY2FsRXh0ZW5zaW9uc1syXSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCBudWxsLCBudWxsLCBbXSwgWydhJ10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSByZXR1cm5zIGxvY2FsIGV4dGVuc2lvbiBpZiByZW1vdGUgZG9lcyBub3QgZXhpc3Qgd2l0aCBpZ25vcmVkIGV4dGVuc2lvbnMgKGlnbm9yZSBjYXNlKScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGxvY2FsRXh0ZW5zaW9uc1sxXSxcblx0XHRcdGxvY2FsRXh0ZW5zaW9uc1syXSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCBudWxsLCBudWxsLCBbXSwgWydBJ10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSByZXR1cm5zIGxvY2FsIGV4dGVuc2lvbiBpZiByZW1vdGUgZG9lcyBub3QgZXhpc3Qgd2l0aCBza2lwcGVkIGV4dGVuc2lvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3Qgc2tpcHBlZEV4dGVuc2lvbiA9IFtcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gWy4uLmxvY2FsRXh0ZW5zaW9uc107XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIG51bGwsIG51bGwsIHNraXBwZWRFeHRlbnNpb24sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgcmV0dXJucyBsb2NhbCBleHRlbnNpb24gaWYgcmVtb3RlIGRvZXMgbm90IGV4aXN0IHdpdGggc2tpcHBlZCBhbmQgaWdub3JlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHNraXBwZWRFeHRlbnNpb24gPSBbXG5cdFx0XHRhU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtsb2NhbEV4dGVuc2lvbnNbMV0sIGxvY2FsRXh0ZW5zaW9uc1syXV07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIG51bGwsIG51bGwsIHNraXBwZWRFeHRlbnNpb24sIFsnYSddLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gdGhlcmUgaXMgbm8gYmFzZScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIG51bGwsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGxvY2FsIGFuZCByZW1vdGUgZXh0ZW5zaW9ucyB3aGVuIHRoZXJlIGlzIG5vIGJhc2UgYW5kIHdpdGggaWdub3JlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFsnYSddLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gcmVtb3RlIGlzIG1vdmVkIGZvcndhcmRlZCcsICgpID0+IHtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW3sgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHsgaWQ6ICdkJywgdXVpZDogJ2QnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSBsb2NhbCBhbmQgcmVtb3RlIGV4dGVuc2lvbnMgd2hlbiByZW1vdGUgaXMgbW92ZWQgZm9yd2FyZGVkIHdpdGggZGlzYWJsZWQgZXh0ZW5zaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0sIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW3sgaWQ6ICdhJywgdXVpZDogJ2EnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9LCBkaXNhYmxlZDogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gcmVtb3RlIG1vdmVkIGZvcndhcmRlZCB3aXRoIGlnbm9yZWQgZXh0ZW5zaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgWydhJ10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW3sgaWQ6ICdkJywgdXVpZDogJ2QnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSBsb2NhbCBhbmQgcmVtb3RlIGV4dGVuc2lvbnMgd2hlbiByZW1vdGUgaXMgbW92ZWQgZm9yd2FyZGVkIHdpdGggc2tpcHBlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBza2lwcGVkRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgYmFzZUV4dGVuc2lvbnMsIHNraXBwZWRFeHRlbnNpb25zLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbeyBpZDogJ2QnLCB1dWlkOiAnZCcgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGxvY2FsIGFuZCByZW1vdGUgZXh0ZW5zaW9ucyB3aGVuIHJlbW90ZSBpcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBza2lwcGVkIGFuZCBpZ25vcmVkIGV4dGVuc2lvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHNraXBwZWRFeHRlbnNpb25zID0gW1xuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgc2tpcHBlZEV4dGVuc2lvbnMsIFsnYiddLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFt7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gbG9jYWwgaXMgbW92ZWQgZm9yd2FyZGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gbG9jYWwgaXMgbW92ZWQgZm9yd2FyZGVkIHdpdGggZGlzYWJsZWQgZXh0ZW5zaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBkaXNhYmxlZDogdHJ1ZSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSBsb2NhbCBhbmQgcmVtb3RlIGV4dGVuc2lvbnMgd2hlbiBsb2NhbCBpcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBpZ25vcmVkIHNldHRpbmdzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgYmFzZUV4dGVuc2lvbnMsIFtdLCBbJ2InXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGxvY2FsIGFuZCByZW1vdGUgZXh0ZW5zaW9ucyB3aGVuIGxvY2FsIGlzIG1vdmVkIGZvcndhcmRlZCB3aXRoIHNraXBwZWQgZXh0ZW5zaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHNraXBwZWRFeHRlbnNpb25zID0gW1xuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgc2tpcHBlZEV4dGVuc2lvbnMsIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgbG9jYWwgYW5kIHJlbW90ZSBleHRlbnNpb25zIHdoZW4gbG9jYWwgaXMgbW92ZWQgZm9yd2FyZGVkIHdpdGggc2tpcHBlZCBhbmQgaWdub3JlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3Qgc2tpcHBlZEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBza2lwcGVkRXh0ZW5zaW9ucywgWydjJ10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSBsb2NhbCBhbmQgcmVtb3RlIGV4dGVuc2lvbnMgd2hlbiBib3RoIG1vdmVkIGZvcndhcmRlZCcsICgpID0+IHtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdlJywgdXVpZDogJ2UnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2UnLCB1dWlkOiAnZScgfSB9KSxcblx0XHRcdGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2MnLCB1dWlkOiAnYycgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2UnLCB1dWlkOiAnZScgfSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFt7IGlkOiAnYScsIHV1aWQ6ICdhJyB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGxvY2FsIGFuZCByZW1vdGUgZXh0ZW5zaW9ucyB3aGVuIGJvdGggbW92ZWQgZm9yd2FyZGVkIHdpdGggaWdub3JlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2UnLCB1dWlkOiAnZScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZScsIHV1aWQ6ICdlJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgWydhJywgJ2UnXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGxvY2FsIGFuZCByZW1vdGUgZXh0ZW5zaW9ucyB3aGVuIGJvdGggbW92ZWQgZm9yd2FyZGVkIHdpdGggc2tpcHBlZCBleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3Qgc2tpcHBlZEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2UnLCB1dWlkOiAnZScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZScsIHV1aWQ6ICdlJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBza2lwcGVkRXh0ZW5zaW9ucywgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZScsIHV1aWQ6ICdlJyB9IH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSBsb2NhbCBhbmQgcmVtb3RlIGV4dGVuc2lvbnMgd2hlbiBib3RoIG1vdmVkIGZvcndhcmRlZCB3aXRoIHNraXBwZWQgYW5kIGlnbm9yZWRleHRlbnNpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3Qgc2tpcHBlZEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InLCB1dWlkOiAnYicgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2UnLCB1dWlkOiAnZScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZScsIHV1aWQ6ICdlJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBza2lwcGVkRXh0ZW5zaW9ucywgWydlJ10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHJlbW90ZSBleHRlbnNpb24gaGFzIG5vIHV1aWQgYW5kIGRpZmZlcmVudCBleHRlbnNpb24gaWQgY2FzZScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdjJywgdXVpZDogJ2MnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnQScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2QnLCB1dWlkOiAnZCcgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnQScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnZCcsIHV1aWQ6ICdkJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9IH0pLFxuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYycsIHV1aWQ6ICdjJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIG51bGwsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdkJywgdXVpZDogJ2QnIH0gfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gcmVtb3RlIGV4dGVuc2lvbiBpcyBub3QgYW4gaW5zdGFsbGVkIGV4dGVuc2lvbicsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiByZW1vdGUgZXh0ZW5zaW9uIGlzIG5vdCBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIGJ1dCBpcyBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIGxvY2FsbHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBleHRlbnNpb24gaXMgbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gcmVtb3RlbHkgYW5kIGRvZXMgbm90IGV4aXN0IGxvY2FsbHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYicsIHV1aWQ6ICdiJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYW4gZXh0ZW5zaW9uIGlzIGFuIGluc3RhbGxlZCBleHRlbnNpb24gcmVtb3RlbHkgYnV0IG5vdCBsb2NhbGx5IGFuZCB1cGRhdGVkIGxvY2FsbHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0YW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBkaXNhYmxlZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGV4dGVuc2lvbiBpcyBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIHJlbW90ZWx5IGJ1dCBub3QgbG9jYWxseSBhbmQgdXBkYXRlZCByZW1vdGVseScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGxvY2FsRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXG5cdFx0XHRhbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIG5vdCBpbnN0YWxsZWQgZXh0ZW5zaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaW5zdGFsbGVkOiBmYWxzZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZDogSVN5bmNFeHRlbnNpb25bXSA9IFtcblx0XHRcdGFuRXhwZWN0ZWRCdWlsdGluU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSksXG5cdFx0XHRhbkV4cGVjdGVkQnVpbHRpblN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIG51bGwsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiByZW1vdGUgZXh0ZW5zaW9uIHdpdGggcHJlcmVsZWFzZSBpcyBhZGRlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnM6IElMb2NhbFN5bmNFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGxvY2FsIGV4dGVuc2lvbiB3aXRoIHByZXJlbGVhc2UgaXMgYWRkZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zOiBJTG9jYWxTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSldKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IHJlbW90ZSBleHRlbnNpb24gd2l0aCBwcmVyZWxlYXNlIGlzIGFkZGVkIHdoZW4gbG9jYWwgZXh0ZW5zaW9uIHdpdGhvdXQgcHJlcmVsZWFzZSBpcyBhZGRlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlIH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IHJlbW90ZSBleHRlbnNpb24gd2l0aG91dCBwcmVyZWxlYXNlIGlzIGFkZGVkIHdoZW4gbG9jYWwgZXh0ZW5zaW9uIHdpdGggcHJlcmVsZWFzZSBpcyBhZGRlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IHJlbW90ZSBleHRlbnNpb24gaXMgY2hhbmdlZCB0byBwcmVyZWxlYXNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBsb2NhbEV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiByZW1vdGUgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gcmVsZWFzZScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbG9jYWxFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gcHJlcmVsZWFzZScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcHJlUmVsZWFzZTogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSldKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGxvY2FsIGV4dGVuc2lvbiBpcyBjaGFuZ2VkIHRvIHJlbGVhc2UnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBbYVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gLSByZW1vdGUgcHJlUmVsZWFzZSBwcm9wZXJ0eSBpcyB0YWtlbiBwcmVjZWRlbmNlIHdoZW4gdGhlcmUgYXJlIG5vIHVwZGF0ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gLSByZW1vdGUgcHJlUmVsZWFzZSBwcm9wZXJ0eSBpcyB0YWtlbiBwcmVjZWRlbmNlIHdoZW4gdGhlcmUgYXJlIHVwZGF0ZXMgbG9jYWxseScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaW5zdGFsbGVkOiBmYWxzZSwgZGlzYWJsZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlLCBkaXNhYmxlZDogdHJ1ZSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIG5vdCBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIC0gcmVtb3RlIHByZVJlbGVhc2UgcHJvcGVydHkgaXMgdGFrZW4gcHJlY2VkZW5jZSB3aGVuIHRoZXJlIGFyZSB1cGRhdGVzIHJlbW90ZWx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHByZVJlbGVhc2U6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlLCBkaXNhYmxlZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwcmVSZWxlYXNlOiB0cnVlLCBkaXNhYmxlZDogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gLSByZW1vdGUgdmVyc2lvbiBpcyB0YWtlbiBwcmVjZWRlbmNlIHdoZW4gdGhlcmUgYXJlIG5vIHVwZGF0ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gLSByZW1vdGUgdmVyc2lvbiBpcyB0YWtlbiBwcmVjZWRlbmNlIHdoZW4gdGhlcmUgYXJlIHVwZGF0ZXMgbG9jYWxseScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaW5zdGFsbGVkOiBmYWxzZSwgZGlzYWJsZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnLCBkaXNhYmxlZDogdHJ1ZSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIG5vdCBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIC0gcmVtb3RlIHZlcnNpb24gcHJvcGVydHkgaXMgdGFrZW4gcHJlY2VkZW5jZSB3aGVuIHRoZXJlIGFyZSB1cGRhdGVzIHJlbW90ZWx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcxLjEuMCcgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnLCBkaXNhYmxlZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnLCBkaXNhYmxlZDogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBiYXNlIGhhcyBidWlsdGluIGV4dGVuc2lvbiwgbG9jYWwgZG9lcyBub3QgaGF2ZSBleHRlbnNpb24sIHJlbW90ZSBoYXMgZXh0ZW5zaW9uIGluc3RhbGxlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnM6IElMb2NhbFN5bmNFeHRlbnNpb25bXSA9IFtdO1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnLCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzEuMS4wJyB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzEuMS4wJyB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGJhc2UgaGFzIGluc3RhbGxlZCBleHRlbnNpb24sIGxvY2FsIGhhcyBpbnN0YWxsZWQgZXh0ZW5zaW9uLCByZW1vdGUgaGFzIGV4dGVuc2lvbiBidWlsdGluJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW3sgaWQ6ICdhJywgdXVpZDogJ2EnIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGJhc2UgaGFzIGluc3RhbGxlZCBleHRlbnNpb24sIGxvY2FsIGhhcyBidWlsdGluIGV4dGVuc2lvbiwgcmVtb3RlIGRvZXMgbm90IGhhcyBleHRlbnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnM6IElMb2NhbFN5bmNFeHRlbnNpb25bXSA9IFtdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkQnVpbHRpblN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBiYXNlIGhhcyBidWlsdGluIGV4dGVuc2lvbiwgbG9jYWwgaGFzIGluc3RhbGxlZCBleHRlbnNpb24sIHJlbW90ZSBoYXMgYnVpbHRpbiBleHRlbnNpb24gd2l0aCB1cGRhdGVkIHN0YXRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpbnN0YWxsZWQ6IGZhbHNlLCBzdGF0ZTogeyAnYSc6IDEgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbeyBpZDogJ2EnLCB1dWlkOiAnYScgfV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgc3RhdGU6IHsgJ2EnOiAxIH0gfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgc3RhdGU6IHsgJ2EnOiAxIH0gfSldKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGJhc2UgaGFzIGluc3RhbGxlZCBleHRlbnNpb24sIGxhc3QgdGltZSBzeW5jZWQgYXMgYnVpbHRpbiBleHRlbnNpb24sIGxvY2FsIGhhcyBpbnN0YWxsZWQgZXh0ZW5zaW9uLCByZW1vdGUgaGFzIGJ1aWx0aW4gZXh0ZW5zaW9uIHdpdGggdXBkYXRlZCBzdGF0ZScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaW5zdGFsbGVkOiBmYWxzZSwgc3RhdGU6IHsgJ2EnOiAxIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgYmFzZUV4dGVuc2lvbnMsIFtdLCBbXSwgW3sgaWQ6ICdhJywgdXVpZDogJ2EnIH1dKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHN0YXRlOiB7ICdhJzogMSB9IH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHN0YXRlOiB7ICdhJzogMSB9IH0pXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBiYXNlIGhhcyBidWlsdGluIGV4dGVuc2lvbiwgbG9jYWwgZG9lcyBub3QgaGF2ZSBleHRlbnNpb24sIHJlbW90ZSBoYXMgYnVpbHRpbiBleHRlbnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zOiBJTG9jYWxTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzEuMS4wJywgaW5zdGFsbGVkOiBmYWxzZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcxLjEuMCcsIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgYmFzZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBiYXNlIGhhcyBpbnN0YWxsZWQgZXh0ZW5zaW9uLCBsYXN0IHN5bmNlZCBhcyBidWlsdGluLCBsb2NhbCBkb2VzIG5vdCBoYXZlIGV4dGVuc2lvbiwgcmVtb3RlIGhhcyBpbnN0YWxsZWQgZXh0ZW5zaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9uczogSUxvY2FsU3luY0V4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcxLjEuMCcgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFt7IGlkOiAnYScsIHV1aWQ6ICdhJyB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGJhc2UgaGFzIGJ1aWx0aW4gZXh0ZW5zaW9uLCBsYXN0IHN5bmNlZCBhcyBidWlsdGluLCBsb2NhbCBkb2VzIG5vdCBoYXZlIGV4dGVuc2lvbiwgcmVtb3RlIGhhcyBpbnN0YWxsZWQgZXh0ZW5zaW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9uczogSUxvY2FsU3luY0V4dGVuc2lvbltdID0gW107XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcxLjEuMCcsIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMS4xLjAnIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFt7IGlkOiAnYScsIHV1aWQ6ICdhJyB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzEuMS4wJyB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IHJlbW90ZSBleHRlbnNpb24gd2l0aCBwaW5uZWQgaXMgYWRkZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zOiBJTG9jYWxTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcGlubmVkOiB0cnVlIH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIHdpdGggcGlubmVkIGlzIGFkZGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zOiBJTG9jYWxTeW5jRXh0ZW5zaW9uW10gPSBbXTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgbnVsbCwgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogcmVtb3RlIGV4dGVuc2lvbiB3aXRoIHBpbm5lZCBpcyBhZGRlZCB3aGVuIGxvY2FsIGV4dGVuc2lvbiB3aXRob3V0IHBpbm5lZCBpcyBhZGRlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBudWxsLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiByZW1vdGUgZXh0ZW5zaW9uIHdpdGhvdXQgcGlubmVkIGlzIGFkZGVkIHdoZW4gbG9jYWwgZXh0ZW5zaW9uIHdpdGggcGlubmVkIGlzIGFkZGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIG51bGwsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiByZW1vdGUgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gcGlubmVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcGlubmVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGxvY2FsRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogcmVtb3RlIGV4dGVuc2lvbiBpcyBjaGFuZ2VkIHRvIHVucGlubmVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGxvY2FsRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGxvY2FsIGV4dGVuc2lvbiBpcyBjaGFuZ2VkIHRvIHBpbm5lZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcGlubmVkOiB0cnVlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcGlubmVkOiB0cnVlIH0pXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gaXMgY2hhbmdlZCB0byB1bnBpbm5lZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgW2FSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIG5vdCBhbiBpbnN0YWxsZWQgZXh0ZW5zaW9uIC0gcmVtb3RlIHBpbm5lZCBwcm9wZXJ0eSBpcyB0YWtlbiBwcmVjZWRlbmNlIHdoZW4gdGhlcmUgYXJlIG5vIHVwZGF0ZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2U6IGxvY2FsIGV4dGVuc2lvbiBub3QgYW4gaW5zdGFsbGVkIGV4dGVuc2lvbiAtIHJlbW90ZSBwaW5uZWQgcHJvcGVydHkgaXMgdGFrZW4gcHJlY2VkZW5jZSB3aGVuIHRoZXJlIGFyZSB1cGRhdGVzIGxvY2FsbHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIGluc3RhbGxlZDogZmFsc2UsIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgcGlubmVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZT8uYWxsLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUsIGRpc2FibGVkOiB0cnVlIH0pXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gbm90IGFuIGluc3RhbGxlZCBleHRlbnNpb24gLSByZW1vdGUgcGlubmVkIHByb3BlcnR5IGlzIHRha2VuIHByZWNlZGVuY2Ugd2hlbiB0aGVyZSBhcmUgdXBkYXRlcyByZW1vdGVseScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaW5zdGFsbGVkOiBmYWxzZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBwaW5uZWQ6IHRydWUsIGRpc2FibGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSwgZGlzYWJsZWQ6IHRydWUgfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gcGlubmVkIGFuZCB2ZXJzaW9uIGNoYW5nZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMScsIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMScsIHBpbm5lZDogdHJ1ZSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gdW5waW5uZWQgYW5kIHZlcnNpb24gY2hhbmdlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMScsIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogcmVtb3RlIGV4dGVuc2lvbiBpcyBjaGFuZ2VkIHRvIHBpbm5lZCBhbmQgdmVyc2lvbiBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzAuMC4xJywgcGlubmVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGxvY2FsRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMC4wLjEnLCBwaW5uZWQ6IHRydWUgfSldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGUsIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZTogbG9jYWwgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gcGlubmVkIGFuZCB2ZXJzaW9uIGNoYW5nZWQgYW5kIHJlbW90ZSBleHRlbnNpb24gaXMgY2hhbm5nZWQgdG8gcGlubmVkIHdpdGggZGlmZmVyZW50IHZlcnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMScsIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMicsIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMicsIHBpbm5lZDogdHJ1ZSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiByZW1vdGUgZXh0ZW5zaW9uIGlzIGNoYW5nZWQgdG8gdW5waW5uZWQgYW5kIHZlcnNpb24gY2hhbmdlZCcsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgdmVyc2lvbjogJzAuMC4xJywgcGlubmVkOiB0cnVlIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBsb2NhbEV4dGVuc2lvbnMsIFtdLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW2FuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlOiBsb2NhbCBleHRlbnNpb24gaXMgY2hhbmdlZCB0byB1bnBpbm5lZCBhbmQgdmVyc2lvbiBjaGFuZ2VkIGFuZCByZW1vdGUgZXh0ZW5zaW9uIGlzIGNoYW5uZ2VkIHRvIHVucGlubmVkIHdpdGggZGlmZmVyZW50IHZlcnNpb24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxFeHRlbnNpb25zID0gW1xuXHRcdFx0YUxvY2FsU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHZlcnNpb246ICcwLjAuMScgfSksXG5cdFx0XTtcblx0XHRjb25zdCByZW1vdGVFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCB2ZXJzaW9uOiAnMC4wLjInIH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgYmFzZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sIHBpbm5lZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBhZGRpbmcgbG9jYWwgYXBwbGljYXRpb24gc2NvcGVkIGV4dGVuc2lvbicsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaXNBcHBsaWNhdGlvblNjb3BlZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCBudWxsLCBudWxsLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgbG9jYWxFeHRlbnNpb25zKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBtZXJnaW5nIGxvY2FsIGV4dGVuc2lvbiB3aXRoIGlzQXBwbGljYXRpb25TY29wZWQgcHJvcGVydHkgYW5kIHJlbW90ZSBkb2VzIG5vdCBoYXMgaXNBcHBsaWNhdGlvblNjb3BlZCBwcm9wZXJ0eScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaXNBcHBsaWNhdGlvblNjb3BlZDogZmFsc2UgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlPy5hbGwsIFthbkV4cGVjdGVkU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSldKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBtZXJnaW5nIHdoZW4gYXBwbGljYWl0b24gc2NvcGUgaXMgY2hhbmdlZCBsb2NhbGx5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpc0FwcGxpY2F0aW9uU2NvcGVkOiB0cnVlIH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBiYXNlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaXNBcHBsaWNhdGlvblNjb3BlZDogZmFsc2UgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgYmFzZUV4dGVuc2lvbnMsIGJhc2VFeHRlbnNpb25zLCBbXSwgW10sIFtdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLmFkZGVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwucmVtb3ZlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnVwZGF0ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGU/LmFsbCwgbG9jYWxFeHRlbnNpb25zKTtcblx0fSk7XG5cblx0dGVzdCgnc3luYyBtZXJnaW5nIHdoZW4gYXBwbGljYWl0b24gc2NvcGUgaXMgY2hhbmdlZCByZW1vdGVseScsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaXNBcHBsaWNhdGlvblNjb3BlZDogZmFsc2UgfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGJhc2VFeHRlbnNpb25zID0gW1xuXHRcdFx0YVJlbW90ZVN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpc0FwcGxpY2F0aW9uU2NvcGVkOiBmYWxzZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSwgaXNBcHBsaWNhdGlvblNjb3BlZDogdHJ1ZSB9KSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxFeHRlbnNpb25zLCByZW1vdGVFeHRlbnNpb25zLCBiYXNlRXh0ZW5zaW9ucywgW10sIFtdLCBbXSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5hZGRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsLnJlbW92ZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC51cGRhdGVkLCBbYW5FeHBlY3RlZFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LCBpc0FwcGxpY2F0aW9uU2NvcGVkOiB0cnVlIH0pXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlLCBudWxsKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2UgZG9lcyBub3QgcmVtb3ZlIHJlbW90ZSBleHRlbnNpb24gd2hlbiBza2lwcGVkIGV4dGVuc2lvbiBoYXMgdXVpZCBidXQgcmVtb3RlIGRvZXMgbm90IGhhcycsICgpID0+IHtcblx0XHRjb25zdCBsb2NhbEV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhTG9jYWxTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRdO1xuXHRcdGNvbnN0IHJlbW90ZUV4dGVuc2lvbnMgPSBbXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0gfSksXG5cdFx0XHRhUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJyB9IH0pLFxuXHRcdF07XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbEV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIHJlbW90ZUV4dGVuc2lvbnMsIFthUmVtb3RlU3luY0V4dGVuc2lvbih7IGlkZW50aWZpZXI6IHsgaWQ6ICdiJywgdXVpZDogJ2InIH0gfSldLCBbXSwgW10pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIGRvZXMgbm90IHJlbW92ZSByZW1vdGUgZXh0ZW5zaW9uIHdoZW4gbGFzdCBzeW5jIGJ1aWx0aW4gZXh0ZW5zaW9uIGhhcyB1dWlkIGJ1dCByZW1vdGUgZG9lcyBub3QgaGFzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFMb2NhbFN5bmNFeHRlbnNpb24oeyBpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9IH0pLFxuXHRcdF07XG5cdFx0Y29uc3QgcmVtb3RlRXh0ZW5zaW9ucyA9IFtcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSB9KSxcblx0XHRcdGFSZW1vdGVTeW5jRXh0ZW5zaW9uKHsgaWRlbnRpZmllcjogeyBpZDogJ2InIH0gfSksXG5cdFx0XTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgcmVtb3RlRXh0ZW5zaW9ucywgW10sIFtdLCBbeyBpZDogJ2InLCB1dWlkOiAnYicgfV0pO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwuYWRkZWQsIFtdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbC5yZW1vdmVkLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwubG9jYWwudXBkYXRlZCwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFuRXhwZWN0ZWRTeW5jRXh0ZW5zaW9uKGV4dGVuc2lvbjogUGFydGlhbDxJU3luY0V4dGVuc2lvbj4pOiBJU3luY0V4dGVuc2lvbiB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkZW50aWZpZXI6IHsgaWQ6ICdhJywgdXVpZDogJ2EnIH0sXG5cdFx0XHR2ZXJzaW9uOiAnMS4wLjAnLFxuXHRcdFx0cGlubmVkOiBmYWxzZSxcblx0XHRcdHByZVJlbGVhc2U6IGZhbHNlLFxuXHRcdFx0aW5zdGFsbGVkOiB0cnVlLFxuXHRcdFx0Li4uZXh0ZW5zaW9uXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGFuRXhwZWN0ZWRCdWlsdGluU3luY0V4dGVuc2lvbihleHRlbnNpb246IFBhcnRpYWw8SVN5bmNFeHRlbnNpb24+KTogSVN5bmNFeHRlbnNpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LFxuXHRcdFx0dmVyc2lvbjogJzEuMC4wJyxcblx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHRwcmVSZWxlYXNlOiBmYWxzZSxcblx0XHRcdC4uLmV4dGVuc2lvblxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBhTG9jYWxTeW5jRXh0ZW5zaW9uKGV4dGVuc2lvbjogUGFydGlhbDxJTG9jYWxTeW5jRXh0ZW5zaW9uPik6IElMb2NhbFN5bmNFeHRlbnNpb24ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRpZGVudGlmaWVyOiB7IGlkOiAnYScsIHV1aWQ6ICdhJyB9LFxuXHRcdFx0dmVyc2lvbjogJzEuMC4wJyxcblx0XHRcdHBpbm5lZDogZmFsc2UsXG5cdFx0XHRwcmVSZWxlYXNlOiBmYWxzZSxcblx0XHRcdGluc3RhbGxlZDogdHJ1ZSxcblx0XHRcdC4uLmV4dGVuc2lvblxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBhUmVtb3RlU3luY0V4dGVuc2lvbihleHRlbnNpb246IFBhcnRpYWw8SUxvY2FsU3luY0V4dGVuc2lvbj4pOiBJTG9jYWxTeW5jRXh0ZW5zaW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSxcblx0XHRcdHZlcnNpb246ICcxLjAuMCcsXG5cdFx0XHRwaW5uZWQ6IGZhbHNlLFxuXHRcdFx0cHJlUmVsZWFzZTogZmFsc2UsXG5cdFx0XHRpbnN0YWxsZWQ6IHRydWUsXG5cdFx0XHQuLi5leHRlbnNpb25cblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYVN5bmNFeHRlbnNpb24oZXh0ZW5zaW9uOiBQYXJ0aWFsPElTeW5jRXh0ZW5zaW9uPik6IElTeW5jRXh0ZW5zaW9uIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0aWRlbnRpZmllcjogeyBpZDogJ2EnLCB1dWlkOiAnYScgfSxcblx0XHRcdHZlcnNpb246ICcxLjAuMCcsXG5cdFx0XHRpbnN0YWxsZWQ6IHRydWUsXG5cdFx0XHQuLi5leHRlbnNpb25cblx0XHR9O1xuXHR9XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUd0QixNQUFNLG1CQUFtQixNQUFNO0FBRTlCLDBDQUF3QztBQUV4QyxPQUFLLDBEQUEwRCxNQUFNO0FBQ3BFLFVBQU0sa0JBQWtCO0FBQUEsTUFDdkIsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLElBQUksS0FBSyxNQUFNLElBQUksRUFBRSxDQUFDO0FBQUEsTUFDMUQsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLElBQUksS0FBSyxNQUFNLElBQUksRUFBRSxDQUFDO0FBQUEsTUFDMUQsb0JBQW9CLEVBQUUsWUFBWSxFQUFFLElBQUksS0FBSyxNQUFNLElBQUksRUFBRSxDQUFDO0FBQUEsSUFDM0Q7QUFFQSxVQUFNLFNBQVMsTUFBTSxpQkFBaUIsTUFBTSxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDO0FBRTVELFdBQU8sZ0JBQWdCLE9BQU8sTUFBTSxPQUFPLENBQUMsQ0FBQztBQUM3QyxXQUFPLGdCQUFnQixPQUFPLE1BQU0sU0FBUyxDQUFDLENBQUM7QUFDL0MsV0FBTyxnQkFBZ0IsT0FBTyxNQUFNLFNBQVMsQ0FBQyxDQUFDO0FBQy9DLFdBQU8sZ0JBQWdCLE9BQU8sUUFBUSxLQUFLLGVBQWU7QUFBQSxFQUMzRCxDQUFDO0FBRUQsT0FBSyxrRkFBa0YsTUFBTTtBQUM1RixVQUFNLGtCQUFrQjtBQUFBLE1BQ3ZCLG9CQUFvQixFQUFFLFlBQVksRUFBRSxJQUFJLEtBQUssTUFBTSxJQUFJLEVBQUUsQ0FBQztBQUFB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
