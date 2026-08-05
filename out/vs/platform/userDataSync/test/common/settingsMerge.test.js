import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { addSetting, merge, updateIgnoredSettings } from "../../common/settingsMerge.js";
const formattingOptions = { eol: "\n", insertSpaces: false, tabSize: 4 };
suite("SettingsMerge - Merge", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("merge when local and remote are same with one entry", async () => {
    const localContent = stringify({ "a": 1 });
    const remoteContent = stringify({ "a": 1 });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local and remote are same with multiple entries", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2
    });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local and remote are same with multiple entries in different order", async () => {
    const localContent = stringify({
      "b": 2,
      "a": 1
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2
    });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, localContent);
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(actual.conflictsSettings.length, 0);
  });
  test("merge when local and remote are same with different base content", async () => {
    const localContent = stringify({
      "b": 2,
      "a": 1
    });
    const baseContent = stringify({
      "a": 2,
      "b": 1
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2
    });
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, localContent);
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(actual.hasConflicts);
  });
  test("merge when a new entry is added to remote", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2
    });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when multiple new entries are added to remote", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3
    });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when multiple new entries are added to remote from base and local has not changed", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "b": 2,
      "a": 1,
      "c": 3
    });
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when an entry is removed from remote from base and local has not changed", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2
    });
    const remoteContent = stringify({
      "a": 1
    });
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when all entries are removed from base and local has not changed", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({});
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when an entry is updated in remote from base and local has not changed", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "a": 2
    });
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when remote has moved forwareded with multiple changes and local stays with base", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "a": 2,
      "b": 1,
      "c": 3,
      "d": 4
    });
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when remote has moved forwareded with order changes and local stays with base", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3
    });
    const remoteContent = stringify({
      "a": 2,
      "d": 4,
      "c": 3,
      "b": 2
    });
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when remote has moved forwareded with comment changes and local stays with base", async () => {
    const localContent = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1,
}`;
    const remoteContent = stringify`
{
	// comment b has changed
	"b": 2,
	// this is comment for c
	"c": 1,
}`;
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when remote has moved forwareded with comment and order changes and local stays with base", async () => {
    const localContent = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1,
}`;
    const remoteContent = stringify`
{
	// this is comment for c
	"c": 1,
	// comment b has changed
	"b": 2,
}`;
    const actual = merge(localContent, remoteContent, localContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when a new entries are added to local", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4
    });
    const remoteContent = stringify({
      "a": 1
    });
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when multiple new entries are added to local from base and remote is not changed", async () => {
    const localContent = stringify({
      "a": 2,
      "b": 1,
      "c": 3,
      "d": 4
    });
    const remoteContent = stringify({
      "a": 1
    });
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when an entry is removed from local from base and remote has not changed", async () => {
    const localContent = stringify({
      "a": 1,
      "c": 2
    });
    const remoteContent = stringify({
      "a": 2,
      "b": 1,
      "c": 3,
      "d": 4
    });
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when an entry is updated in local from base and remote has not changed", async () => {
    const localContent = stringify({
      "a": 1,
      "c": 2
    });
    const remoteContent = stringify({
      "a": 2,
      "c": 2
    });
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local has moved forwarded with multiple changes and remote stays with base", async () => {
    const localContent = stringify({
      "a": 2,
      "b": 1,
      "c": 3,
      "d": 4
    });
    const remoteContent = stringify({
      "a": 1
    });
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local has moved forwarded with order changes and remote stays with base", async () => {
    const localContent = `
{
	"b": 2,
	"c": 1,
}`;
    const remoteContent = stringify`
{
	"c": 1,
	"b": 2,
}`;
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local has moved forwarded with comment changes and remote stays with base", async () => {
    const localContent = `
{
	// comment for b has changed
	"b": 2,
	// comment for c
	"c": 1,
}`;
    const remoteContent = stringify`
{
	// comment for b
	"b": 2,
	// comment for c
	"c": 1,
}`;
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local has moved forwarded with comment and order changes and remote stays with base", async () => {
    const localContent = `
{
	// comment for c
	"c": 1,
	// comment for b has changed
	"b": 2,
}`;
    const remoteContent = stringify`
{
	// comment for b
	"b": 2,
	// comment for c
	"c": 1,
}`;
    const actual = merge(localContent, remoteContent, remoteContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, localContent);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("merge when local and remote with one entry but different value", async () => {
    const localContent = stringify({
      "a": 1
    });
    const remoteContent = stringify({
      "a": 2
    });
    const expectedConflicts = [{ key: "a", localValue: 1, remoteValue: 2 }];
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, localContent);
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
  });
  test("merge when the entry is removed in remote but updated in local and a new entry is added in remote", async () => {
    const baseContent = stringify({
      "a": 1
    });
    const localContent = stringify({
      "a": 2
    });
    const remoteContent = stringify({
      "b": 2
    });
    const expectedConflicts = [{ key: "a", localValue: 2, remoteValue: void 0 }];
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 2,
      "b": 2
    }));
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
  });
  test("merge with single entry and local is empty", async () => {
    const baseContent = stringify({
      "a": 1
    });
    const localContent = stringify({});
    const remoteContent = stringify({
      "a": 2
    });
    const expectedConflicts = [{ key: "a", localValue: void 0, remoteValue: 2 }];
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, localContent);
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
  });
  test("merge when local and remote has moved forwareded with conflicts", async () => {
    const baseContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4
    });
    const localContent = stringify({
      "a": 2,
      "c": 3,
      "d": 5,
      "e": 4,
      "f": 1
    });
    const remoteContent = stringify({
      "b": 3,
      "c": 3,
      "d": 6,
      "e": 5
    });
    const expectedConflicts = [
      { key: "b", localValue: void 0, remoteValue: 3 },
      { key: "a", localValue: 2, remoteValue: void 0 },
      { key: "d", localValue: 5, remoteValue: 6 },
      { key: "e", localValue: 4, remoteValue: 5 }
    ];
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 2,
      "c": 3,
      "d": 5,
      "e": 4,
      "f": 1
    }));
    assert.strictEqual(actual.remoteContent, stringify({
      "b": 3,
      "c": 3,
      "d": 6,
      "e": 5,
      "f": 1
    }));
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
  });
  test("merge when local and remote has moved forwareded with change in order", async () => {
    const baseContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4
    });
    const localContent = stringify({
      "a": 2,
      "c": 3,
      "b": 2,
      "d": 4,
      "e": 5
    });
    const remoteContent = stringify({
      "a": 1,
      "b": 2,
      "c": 4
    });
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 2,
      "c": 4,
      "b": 2,
      "e": 5
    }));
    assert.strictEqual(actual.remoteContent, stringify({
      "a": 2,
      "b": 2,
      "e": 5,
      "c": 4
    }));
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, []);
  });
  test("merge when local and remote has moved forwareded with comment changes", async () => {
    const baseContent = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const localContent = `
{
	// comment b has changed in local
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const remoteContent = `
{
	// comment b has changed in remote
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const actual = merge(localContent, remoteContent, baseContent, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, localContent);
    assert.strictEqual(actual.remoteContent, remoteContent);
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, []);
  });
  test("resolve when local and remote has moved forwareded with resolved conflicts", async () => {
    const baseContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3,
      "d": 4
    });
    const localContent = stringify({
      "a": 2,
      "c": 3,
      "d": 5,
      "e": 4,
      "f": 1
    });
    const remoteContent = stringify({
      "b": 3,
      "c": 3,
      "d": 6,
      "e": 5
    });
    const expectedConflicts = [
      { key: "d", localValue: 5, remoteValue: 6 }
    ];
    const actual = merge(localContent, remoteContent, baseContent, [], [{ key: "a", value: 2 }, { key: "b", value: void 0 }, { key: "e", value: 5 }], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 2,
      "c": 3,
      "d": 5,
      "e": 5,
      "f": 1
    }));
    assert.strictEqual(actual.remoteContent, stringify({
      "c": 3,
      "d": 6,
      "e": 5,
      "f": 1,
      "a": 2
    }));
    assert.ok(actual.hasConflicts);
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
  });
  test("ignored setting is not merged when changed in local and remote", async () => {
    const localContent = stringify({ "a": 1 });
    const remoteContent = stringify({ "a": 2 });
    const actual = merge(localContent, remoteContent, null, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged when changed in local and remote from base", async () => {
    const baseContent = stringify({ "a": 0 });
    const localContent = stringify({ "a": 1 });
    const remoteContent = stringify({ "a": 2 });
    const actual = merge(localContent, remoteContent, baseContent, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged when added in remote", async () => {
    const localContent = stringify({});
    const remoteContent = stringify({ "a": 1 });
    const actual = merge(localContent, remoteContent, null, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged when added in remote from base", async () => {
    const localContent = stringify({ "b": 2 });
    const remoteContent = stringify({ "a": 1, "b": 2 });
    const actual = merge(localContent, remoteContent, localContent, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged when removed in remote", async () => {
    const localContent = stringify({ "a": 1 });
    const remoteContent = stringify({});
    const actual = merge(localContent, remoteContent, null, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged when removed in remote from base", async () => {
    const localContent = stringify({ "a": 2 });
    const remoteContent = stringify({});
    const actual = merge(localContent, remoteContent, localContent, ["a"], [], formattingOptions);
    assert.strictEqual(actual.localContent, null);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged with other changes without conflicts", async () => {
    const baseContent = stringify({
      "a": 2,
      "b": 2,
      "c": 3,
      "d": 4,
      "e": 5
    });
    const localContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3
    });
    const remoteContent = stringify({
      "a": 3,
      "b": 3,
      "d": 4,
      "e": 6
    });
    const actual = merge(localContent, remoteContent, baseContent, ["a", "e"], [], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 1,
      "b": 3
    }));
    assert.strictEqual(actual.remoteContent, stringify({
      "a": 3,
      "b": 3,
      "e": 6
    }));
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
  test("ignored setting is not merged with other changes conflicts", async () => {
    const baseContent = stringify({
      "a": 2,
      "b": 2,
      "c": 3,
      "d": 4,
      "e": 5
    });
    const localContent = stringify({
      "a": 1,
      "b": 4,
      "c": 3,
      "d": 5
    });
    const remoteContent = stringify({
      "a": 3,
      "b": 3,
      "e": 6
    });
    const expectedConflicts = [
      { key: "d", localValue: 5, remoteValue: void 0 },
      { key: "b", localValue: 4, remoteValue: 3 }
    ];
    const actual = merge(localContent, remoteContent, baseContent, ["a", "e"], [], formattingOptions);
    assert.strictEqual(actual.localContent, stringify({
      "a": 1,
      "b": 4,
      "d": 5
    }));
    assert.strictEqual(actual.remoteContent, stringify({
      "a": 3,
      "b": 3,
      "e": 6
    }));
    assert.deepStrictEqual(actual.conflictsSettings, expectedConflicts);
    assert.ok(actual.hasConflicts);
  });
  test("merge when remote has comments and local is empty", async () => {
    const localContent = `
{

}`;
    const remoteContent = stringify`
{
	// this is a comment
	"a": 1,
}`;
    const actual = merge(localContent, remoteContent, null, [], [], formattingOptions);
    assert.strictEqual(actual.localContent, remoteContent);
    assert.strictEqual(actual.remoteContent, null);
    assert.strictEqual(actual.conflictsSettings.length, 0);
    assert.ok(!actual.hasConflicts);
  });
});
suite("SettingsMerge - Compute Remote Content", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("local content is returned when there are no ignored settings", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3
    });
    const remoteContent = stringify({
      "a": 3,
      "b": 3,
      "d": 4,
      "e": 6
    });
    const actual = updateIgnoredSettings(localContent, remoteContent, [], formattingOptions);
    assert.strictEqual(actual, localContent);
  });
  test("when target content is empty", async () => {
    const remoteContent = stringify({
      "a": 3
    });
    const actual = updateIgnoredSettings("", remoteContent, ["a"], formattingOptions);
    assert.strictEqual(actual, "");
  });
  test("when source content is empty", async () => {
    const localContent = stringify({
      "a": 3,
      "b": 3
    });
    const expected = stringify({
      "b": 3
    });
    const actual = updateIgnoredSettings(localContent, "", ["a"], formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("ignored settings are not updated from remote content", async () => {
    const localContent = stringify({
      "a": 1,
      "b": 2,
      "c": 3
    });
    const remoteContent = stringify({
      "a": 3,
      "b": 3,
      "d": 4,
      "e": 6
    });
    const expected = stringify({
      "a": 3,
      "b": 2,
      "c": 3
    });
    const actual = updateIgnoredSettings(localContent, remoteContent, ["a"], formattingOptions);
    assert.strictEqual(actual, expected);
  });
});
suite("SettingsMerge - Add Setting", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Insert after a setting without comments", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 2,
	"d": 3
}`;
    const expected = `
{
	"a": 2,
	"b": 2,
	"d": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting without comments at the end", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 2
}`;
    const expected = `
{
	"a": 2,
	"b": 2
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert between settings without comment", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert between settings and there is a comment in between in source", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting and after a comment at the end", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2
}`;
    const targetContent = `
{
	"a": 1
	// this is comment for b
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting ending with comma and after a comment at the end", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2
}`;
    const targetContent = `
{
	"a": 1,
	// this is comment for b
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a comment and there are no settings", () => {
    const sourceContent = `
{
	// this is comment for b
	"b": 2
}`;
    const targetContent = `
{
	// this is comment for b
}`;
    const expected = `
{
	// this is comment for b
	"b": 2
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting and between a comment and setting", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	// this is comment for b
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting between two comments and there is a setting after", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	// this is comment for b
	// this is comment for c
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting between two comments on the same line and there is a setting after", () => {
    const sourceContent = `
{
	"a": 1,
	/* this is comment for b */
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	/* this is comment for b */ // this is comment for c
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	/* this is comment for b */
	"b": 2, // this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting between two line comments on the same line and there is a setting after", () => {
    const sourceContent = `
{
	"a": 1,
	/* this is comment for b */
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"a": 1,
	// this is comment for b // this is comment for c
	"c": 3
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b // this is comment for c
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting between two comments and there is no setting after", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2
	// this is a comment
}`;
    const targetContent = `
{
	"a": 1
	// this is comment for b
	// this is a comment
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2
	// this is a comment
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting with comma and between two comments and there is no setting after", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2
	// this is a comment
}`;
    const targetContent = `
{
	"a": 1,
	// this is comment for b
	// this is a comment
}`;
    const expected = `
{
	"a": 1,
	// this is comment for b
	"b": 2
	// this is a comment
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting without comments", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"d": 2,
	"c": 3
}`;
    const expected = `
{
	"d": 2,
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting without comments at the end", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"c": 3
}`;
    const expected = `
{
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting with comment", () => {
    const sourceContent = `
{
	"a": 1,
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	// this is comment for c
	"c": 3
}`;
    const expected = `
{
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting and before a comment at the beginning", () => {
    const sourceContent = `
{
	// this is comment for b
	"b": 2,
	"c": 3,
}`;
    const targetContent = `
{
	// this is comment for b
	"c": 3
}`;
    const expected = `
{
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting ending with comma and before a comment at the begninning", () => {
    const sourceContent = `
{
	// this is comment for b
	"b": 2,
	"c": 3,
}`;
    const targetContent = `
{
	// this is comment for b
	"c": 3,
}`;
    const expected = `
{
	// this is comment for b
	"b": 2,
	"c": 3,
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting and between a setting and comment", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"d": 1,
	// this is comment for b
	"c": 3
}`;
    const expected = `
{
	"d": 1,
	// this is comment for b
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting between two comments and there is a setting before", () => {
    const sourceContent = `
{
	"a": 1,
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"d": 1,
	// this is comment for b
	// this is comment for c
	"c": 3
}`;
    const expected = `
{
	"d": 1,
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting between two comments on the same line and there is a setting before", () => {
    const sourceContent = `
{
	"a": 1,
	/* this is comment for b */
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"d": 1,
	/* this is comment for b */ // this is comment for c
	"c": 3
}`;
    const expected = `
{
	"d": 1,
	/* this is comment for b */
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting between two line comments on the same line and there is a setting before", () => {
    const sourceContent = `
{
	"a": 1,
	/* this is comment for b */
	"b": 2,
	// this is comment for c
	"c": 3
}`;
    const targetContent = `
{
	"d": 1,
	// this is comment for b // this is comment for c
	"c": 3
}`;
    const expected = `
{
	"d": 1,
	"b": 2,
	// this is comment for b // this is comment for c
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting between two comments and there is no setting before", () => {
    const sourceContent = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const targetContent = `
{
	// this is comment for b
	// this is comment for c
	"c": 1
}`;
    const expected = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert before a setting with comma and between two comments and there is no setting before", () => {
    const sourceContent = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1
}`;
    const targetContent = `
{
	// this is comment for b
	// this is comment for c
	"c": 1,
}`;
    const expected = `
{
	// this is comment for b
	"b": 2,
	// this is comment for c
	"c": 1,
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a setting that is of object type", () => {
    const sourceContent = `
{
	"b": {
		"d": 1
	},
	"a": 2,
	"c": 1
}`;
    const targetContent = `
{
	"b": {
		"d": 1
	},
	"c": 1
}`;
    const actual = addSetting("a", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, sourceContent);
  });
  test("Insert after a setting that is of array type", () => {
    const sourceContent = `
{
	"b": [
		1
	],
	"a": 2,
	"c": 1
}`;
    const targetContent = `
{
	"b": [
		1
	],
	"c": 1
}`;
    const actual = addSetting("a", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, sourceContent);
  });
  test("Insert after a comment with comma separator of previous setting and no next nodes ", () => {
    const sourceContent = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2
}`;
    const targetContent = `
{
	"a": 1
	// this is comment for a
	,
}`;
    const expected = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a comment with comma separator of previous setting and there is a setting after ", () => {
    const sourceContent = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2,
	"c": 3
}`;
    const targetContent = `
{
	"a": 1
	// this is comment for a
	,
	"c": 3
}`;
    const expected = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2,
	"c": 3
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
  test("Insert after a comment with comma separator of previous setting and there is a comment after ", () => {
    const sourceContent = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2
	// this is a comment
}`;
    const targetContent = `
{
	"a": 1
	// this is comment for a
	,
	// this is a comment
}`;
    const expected = `
{
	"a": 1
	// this is comment for a
	,
	"b": 2
	// this is a comment
}`;
    const actual = addSetting("b", sourceContent, targetContent, formattingOptions);
    assert.strictEqual(actual, expected);
  });
});
function stringify(value) {
  return JSON.stringify(value, null, "	");
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24vc2V0dGluZ3NNZXJnZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBhZGRTZXR0aW5nLCBtZXJnZSwgdXBkYXRlSWdub3JlZFNldHRpbmdzIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NldHRpbmdzTWVyZ2UuanMnO1xuaW1wb3J0IHR5cGUgeyBJQ29uZmxpY3RTZXR0aW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL3VzZXJEYXRhU3luYy5qcyc7XG5cbmNvbnN0IGZvcm1hdHRpbmdPcHRpb25zID0geyBlb2w6ICdcXG4nLCBpbnNlcnRTcGFjZXM6IGZhbHNlLCB0YWJTaXplOiA0IH07XG5cbnN1aXRlKCdTZXR0aW5nc01lcmdlIC0gTWVyZ2UnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggb25lIGVudHJ5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7ICdhJzogMSB9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHsgJ2EnOiAxIH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBhcmUgc2FtZSB3aXRoIG11bHRpcGxlIGVudHJpZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMlxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2InOiAyXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsLCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggbXVsdGlwbGUgZW50cmllcyBpbiBkaWZmZXJlbnQgb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdiJzogMixcblx0XHRcdCdhJzogMSxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMlxuXHRcdH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgYXJlIHNhbWUgd2l0aCBkaWZmZXJlbnQgYmFzZSBjb250ZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnYSc6IDEsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2InOiAxXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDJcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGJhc2VDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYSBuZXcgZW50cnkgaXMgYWRkZWQgdG8gcmVtb3RlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDJcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIG11bHRpcGxlIG5ldyBlbnRyaWVzIGFyZSBhZGRlZCB0byByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIG11bHRpcGxlIG5ldyBlbnRyaWVzIGFyZSBhZGRlZCB0byByZW1vdGUgZnJvbSBiYXNlIGFuZCBsb2NhbCBoYXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdiJzogMixcblx0XHRcdCdhJzogMSxcblx0XHRcdCdjJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYW4gZW50cnkgaXMgcmVtb3ZlZCBmcm9tIHJlbW90ZSBmcm9tIGJhc2UgYW5kIGxvY2FsIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2InOiAyLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbGwgZW50cmllcyBhcmUgcmVtb3ZlZCBmcm9tIGJhc2UgYW5kIGxvY2FsIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe30pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyB1cGRhdGVkIGluIHJlbW90ZSBmcm9tIGJhc2UgYW5kIGxvY2FsIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHJlbW90ZSBoYXMgbW92ZWQgZm9yd2FyZWRlZCB3aXRoIG11bHRpcGxlIGNoYW5nZXMgYW5kIGxvY2FsIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2InOiAxLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA0LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmVkZWQgd2l0aCBvcmRlciBjaGFuZ2VzIGFuZCBsb2NhbCBzdGF5cyB3aXRoIGJhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMixcblx0XHRcdCdkJzogNCxcblx0XHRcdCdjJzogMyxcblx0XHRcdCdiJzogMixcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gcmVtb3RlIGhhcyBtb3ZlZCBmb3J3YXJlZGVkIHdpdGggY29tbWVudCBjaGFuZ2VzIGFuZCBsb2NhbCBzdGF5cyB3aXRoIGJhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gYFxue1xuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogMSxcbn1gO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnlgXG57XG5cdC8vIGNvbW1lbnQgYiBoYXMgY2hhbmdlZFxuXHRcImJcIjogMixcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxufWA7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHJlbW90ZSBoYXMgbW92ZWQgZm9yd2FyZWRlZCB3aXRoIGNvbW1lbnQgYW5kIG9yZGVyIGNoYW5nZXMgYW5kIGxvY2FsIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxufWA7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeWBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxuXHQvLyBjb21tZW50IGIgaGFzIGNoYW5nZWRcblx0XCJiXCI6IDIsXG59YDtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYSBuZXcgZW50cmllcyBhcmUgYWRkZWQgdG8gbG9jYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHRcdCdkJzogNCxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbXVsdGlwbGUgbmV3IGVudHJpZXMgYXJlIGFkZGVkIHRvIGxvY2FsIGZyb20gYmFzZSBhbmQgcmVtb3RlIGlzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYic6IDEsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDQsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5IGlzIHJlbW92ZWQgZnJvbSBsb2NhbCBmcm9tIGJhc2UgYW5kIHJlbW90ZSBoYXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdjJzogMlxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2InOiAxLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA0LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgcmVtb3RlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyB1cGRhdGVkIGluIGxvY2FsIGZyb20gYmFzZSBhbmQgcmVtb3RlIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2MnOiAyXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYyc6IDIsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGhhcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBtdWx0aXBsZSBjaGFuZ2VzIGFuZCByZW1vdGUgc3RheXMgd2l0aCBiYXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYic6IDEsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDQsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGhhcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBvcmRlciBjaGFuZ2VzIGFuZCByZW1vdGUgc3RheXMgd2l0aCBiYXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IGBcbntcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAxLFxufWA7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeWBcbntcblx0XCJjXCI6IDEsXG5cdFwiYlwiOiAyLFxufWA7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGhhcyBtb3ZlZCBmb3J3YXJkZWQgd2l0aCBjb21tZW50IGNoYW5nZXMgYW5kIHJlbW90ZSBzdGF5cyB3aXRoIGJhc2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gYFxue1xuXHQvLyBjb21tZW50IGZvciBiIGhhcyBjaGFuZ2VkXG5cdFwiYlwiOiAyLFxuXHQvLyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxufWA7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeWBcbntcblx0Ly8gY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0Ly8gY29tbWVudCBmb3IgY1xuXHRcImNcIjogMSxcbn1gO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgcmVtb3RlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBoYXMgbW92ZWQgZm9yd2FyZGVkIHdpdGggY29tbWVudCBhbmQgb3JkZXIgY2hhbmdlcyBhbmQgcmVtb3RlIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBgXG57XG5cdC8vIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDEsXG5cdC8vIGNvbW1lbnQgZm9yIGIgaGFzIGNoYW5nZWRcblx0XCJiXCI6IDIsXG59YDtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5YFxue1xuXHQvLyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxufWA7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgd2l0aCBvbmUgZW50cnkgYnV0IGRpZmZlcmVudCB2YWx1ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDJcblx0XHR9KTtcblx0XHRjb25zdCBleHBlY3RlZENvbmZsaWN0czogSUNvbmZsaWN0U2V0dGluZ1tdID0gW3sga2V5OiAnYScsIGxvY2FsVmFsdWU6IDEsIHJlbW90ZVZhbHVlOiAyIH1dO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIGV4cGVjdGVkQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiB0aGUgZW50cnkgaXMgcmVtb3ZlZCBpbiByZW1vdGUgYnV0IHVwZGF0ZWQgaW4gbG9jYWwgYW5kIGEgbmV3IGVudHJ5IGlzIGFkZGVkIGluIHJlbW90ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDFcblx0XHR9KTtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYic6IDJcblx0XHR9KTtcblx0XHRjb25zdCBleHBlY3RlZENvbmZsaWN0czogSUNvbmZsaWN0U2V0dGluZ1tdID0gW3sga2V5OiAnYScsIGxvY2FsVmFsdWU6IDIsIHJlbW90ZVZhbHVlOiB1bmRlZmluZWQgfV07XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYic6IDJcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIGV4cGVjdGVkQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2l0aCBzaW5nbGUgZW50cnkgYW5kIGxvY2FsIGlzIGVtcHR5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMVxuXHRcdH0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDJcblx0XHR9KTtcblx0XHRjb25zdCBleHBlY3RlZENvbmZsaWN0czogSUNvbmZsaWN0U2V0dGluZ1tdID0gW3sga2V5OiAnYScsIGxvY2FsVmFsdWU6IHVuZGVmaW5lZCwgcmVtb3RlVmFsdWU6IDIgfV07XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIGV4cGVjdGVkQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGhhcyBtb3ZlZCBmb3J3YXJlZGVkIHdpdGggY29uZmxpY3RzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHRcdCdkJzogNCxcblx0XHR9KTtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA1LFxuXHRcdFx0J2UnOiA0LFxuXHRcdFx0J2YnOiAxLFxuXHRcdH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2InOiAzLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA2LFxuXHRcdFx0J2UnOiA1LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGV4cGVjdGVkQ29uZmxpY3RzOiBJQ29uZmxpY3RTZXR0aW5nW10gPSBbXG5cdFx0XHR7IGtleTogJ2InLCBsb2NhbFZhbHVlOiB1bmRlZmluZWQsIHJlbW90ZVZhbHVlOiAzIH0sXG5cdFx0XHR7IGtleTogJ2EnLCBsb2NhbFZhbHVlOiAyLCByZW1vdGVWYWx1ZTogdW5kZWZpbmVkIH0sXG5cdFx0XHR7IGtleTogJ2QnLCBsb2NhbFZhbHVlOiA1LCByZW1vdGVWYWx1ZTogNiB9LFxuXHRcdFx0eyBrZXk6ICdlJywgbG9jYWxWYWx1ZTogNCwgcmVtb3RlVmFsdWU6IDUgfSxcblx0XHRdO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQsIFtdLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA1LFxuXHRcdFx0J2UnOiA0LFxuXHRcdFx0J2YnOiAxLFxuXHRcdH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIHN0cmluZ2lmeSh7XG5cdFx0XHQnYic6IDMsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDYsXG5cdFx0XHQnZSc6IDUsXG5cdFx0XHQnZic6IDEsXG5cdFx0fSkpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncywgZXhwZWN0ZWRDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmVkZWQgd2l0aCBjaGFuZ2UgaW4gb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2InOiAyLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA0LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnZCc6IDQsXG5cdFx0XHQnZSc6IDUsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnYyc6IDQsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYyc6IDQsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnZSc6IDUsXG5cdFx0fSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMixcblx0XHRcdCdiJzogMixcblx0XHRcdCdlJzogNSxcblx0XHRcdCdjJzogNCxcblx0XHR9KSk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBoYXMgbW92ZWQgZm9yd2FyZWRlZCB3aXRoIGNvbW1lbnQgY2hhbmdlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDFcbn1gO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IGBcbntcblx0Ly8gY29tbWVudCBiIGhhcyBjaGFuZ2VkIGluIGxvY2FsXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDFcbn1gO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBgXG57XG5cdC8vIGNvbW1lbnQgYiBoYXMgY2hhbmdlZCBpbiByZW1vdGVcblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogMVxufWA7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIFtdKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmVkZWQgd2l0aCByZXNvbHZlZCBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAxLFxuXHRcdFx0J2InOiAyLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA0LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDUsXG5cdFx0XHQnZSc6IDQsXG5cdFx0XHQnZic6IDEsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYic6IDMsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDYsXG5cdFx0XHQnZSc6IDUsXG5cdFx0fSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWRDb25mbGljdHM6IElDb25mbGljdFNldHRpbmdbXSA9IFtcblx0XHRcdHsga2V5OiAnZCcsIGxvY2FsVmFsdWU6IDUsIHJlbW90ZVZhbHVlOiA2IH0sXG5cdFx0XTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGJhc2VDb250ZW50LCBbXSwgW3sga2V5OiAnYScsIHZhbHVlOiAyIH0sIHsga2V5OiAnYicsIHZhbHVlOiB1bmRlZmluZWQgfSwgeyBrZXk6ICdlJywgdmFsdWU6IDUgfV0sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMixcblx0XHRcdCdjJzogMyxcblx0XHRcdCdkJzogNSxcblx0XHRcdCdlJzogNSxcblx0XHRcdCdmJzogMSxcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBzdHJpbmdpZnkoe1xuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA2LFxuXHRcdFx0J2UnOiA1LFxuXHRcdFx0J2YnOiAxLFxuXHRcdFx0J2EnOiAyLFxuXHRcdH0pKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIGV4cGVjdGVkQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlZCBzZXR0aW5nIGlzIG5vdCBtZXJnZWQgd2hlbiBjaGFuZ2VkIGluIGxvY2FsIGFuZCByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHsgJ2EnOiAxIH0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoeyAnYSc6IDIgfSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsLCBbJ2EnXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlZCBzZXR0aW5nIGlzIG5vdCBtZXJnZWQgd2hlbiBjaGFuZ2VkIGluIGxvY2FsIGFuZCByZW1vdGUgZnJvbSBiYXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KHsgJ2EnOiAwIH0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7ICdhJzogMSB9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHsgJ2EnOiAyIH0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQsIFsnYSddLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVkIHNldHRpbmcgaXMgbm90IG1lcmdlZCB3aGVuIGFkZGVkIGluIHJlbW90ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe30pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoeyAnYSc6IDEgfSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsLCBbJ2EnXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlZCBzZXR0aW5nIGlzIG5vdCBtZXJnZWQgd2hlbiBhZGRlZCBpbiByZW1vdGUgZnJvbSBiYXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7ICdiJzogMiB9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHsgJ2EnOiAxLCAnYic6IDIgfSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQsIFsnYSddLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVkIHNldHRpbmcgaXMgbm90IG1lcmdlZCB3aGVuIHJlbW92ZWQgaW4gcmVtb3RlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7ICdhJzogMSB9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHt9KTtcblx0XHRjb25zdCBhY3R1YWwgPSBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwsIFsnYSddLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVkIHNldHRpbmcgaXMgbm90IG1lcmdlZCB3aGVuIHJlbW92ZWQgaW4gcmVtb3RlIGZyb20gYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoeyAnYSc6IDIgfSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQsIFsnYSddLCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubG9jYWxDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdpZ25vcmVkIHNldHRpbmcgaXMgbm90IG1lcmdlZCB3aXRoIG90aGVyIGNoYW5nZXMgd2l0aG91dCBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAyLFxuXHRcdFx0J2InOiAyLFxuXHRcdFx0J2MnOiAzLFxuXHRcdFx0J2QnOiA0LFxuXHRcdFx0J2UnOiA1LFxuXHRcdH0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnYyc6IDMsXG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDMsXG5cdFx0XHQnYic6IDMsXG5cdFx0XHQnZCc6IDQsXG5cdFx0XHQnZSc6IDYsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gbWVyZ2UobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCwgWydhJywgJ2UnXSwgW10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmxvY2FsQ29udGVudCwgc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMyxcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5yZW1vdGVDb250ZW50LCBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAzLFxuXHRcdFx0J2InOiAzLFxuXHRcdFx0J2UnOiA2LFxuXHRcdH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmNvbmZsaWN0c1NldHRpbmdzLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlZCBzZXR0aW5nIGlzIG5vdCBtZXJnZWQgd2l0aCBvdGhlciBjaGFuZ2VzIGNvbmZsaWN0cycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDIsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnYyc6IDMsXG5cdFx0XHQnZCc6IDQsXG5cdFx0XHQnZSc6IDUsXG5cdFx0fSk7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogNCxcblx0XHRcdCdjJzogMyxcblx0XHRcdCdkJzogNSxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMyxcblx0XHRcdCdiJzogMyxcblx0XHRcdCdlJzogNixcblx0XHR9KTtcblx0XHRjb25zdCBleHBlY3RlZENvbmZsaWN0czogSUNvbmZsaWN0U2V0dGluZ1tdID0gW1xuXHRcdFx0eyBrZXk6ICdkJywgbG9jYWxWYWx1ZTogNSwgcmVtb3RlVmFsdWU6IHVuZGVmaW5lZCB9LFxuXHRcdFx0eyBrZXk6ICdiJywgbG9jYWxWYWx1ZTogNCwgcmVtb3RlVmFsdWU6IDMgfSxcblx0XHRdO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQsIFsnYScsICdlJ10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDEsXG5cdFx0XHQnYic6IDQsXG5cdFx0XHQnZCc6IDUsXG5cdFx0fSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMyxcblx0XHRcdCdiJzogMyxcblx0XHRcdCdlJzogNixcblx0XHR9KSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuY29uZmxpY3RzU2V0dGluZ3MsIGV4cGVjdGVkQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gcmVtb3RlIGhhcyBjb21tZW50cyBhbmQgbG9jYWwgaXMgZW1wdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gYFxue1xuXG59YDtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5YFxue1xuXHQvLyB0aGlzIGlzIGEgY29tbWVudFxuXHRcImFcIjogMSxcbn1gO1xuXHRcdGNvbnN0IGFjdHVhbCA9IG1lcmdlKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCwgW10sIFtdLCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwucmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb25mbGljdHNTZXR0aW5ncy5sZW5ndGgsIDApO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdTZXR0aW5nc01lcmdlIC0gQ29tcHV0ZSBSZW1vdGUgQ29udGVudCcsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdsb2NhbCBjb250ZW50IGlzIHJldHVybmVkIHdoZW4gdGhlcmUgYXJlIG5vIGlnbm9yZWQgc2V0dGluZ3MnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMyxcblx0XHRcdCdiJzogMyxcblx0XHRcdCdkJzogNCxcblx0XHRcdCdlJzogNixcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSB1cGRhdGVJZ25vcmVkU2V0dGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBbXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3doZW4gdGFyZ2V0IGNvbnRlbnQgaXMgZW1wdHknLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDMsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gdXBkYXRlSWdub3JlZFNldHRpbmdzKCcnLCByZW1vdGVDb250ZW50LCBbJ2EnXSwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsICcnKTtcblx0fSk7XG5cblx0dGVzdCgnd2hlbiBzb3VyY2UgY29udGVudCBpcyBlbXB0eScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoe1xuXHRcdFx0J2EnOiAzLFxuXHRcdFx0J2InOiAzLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gc3RyaW5naWZ5KHtcblx0XHRcdCdiJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCBhY3R1YWwgPSB1cGRhdGVJZ25vcmVkU2V0dGluZ3MobG9jYWxDb250ZW50LCAnJywgWydhJ10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lnbm9yZWQgc2V0dGluZ3MgYXJlIG5vdCB1cGRhdGVkIGZyb20gcmVtb3RlIGNvbnRlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMSxcblx0XHRcdCdiJzogMixcblx0XHRcdCdjJzogMyxcblx0XHR9KTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KHtcblx0XHRcdCdhJzogMyxcblx0XHRcdCdiJzogMyxcblx0XHRcdCdkJzogNCxcblx0XHRcdCdlJzogNixcblx0XHR9KTtcblx0XHRjb25zdCBleHBlY3RlZCA9IHN0cmluZ2lmeSh7XG5cdFx0XHQnYSc6IDMsXG5cdFx0XHQnYic6IDIsXG5cdFx0XHQnYyc6IDMsXG5cdFx0fSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gdXBkYXRlSWdub3JlZFNldHRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgWydhJ10sIGZvcm1hdHRpbmdPcHRpb25zKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG59KTtcblxuc3VpdGUoJ1NldHRpbmdzTWVyZ2UgLSBBZGQgU2V0dGluZycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIHdpdGhvdXQgY29tbWVudHMnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAzXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImFcIjogMixcblx0XCJkXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdFwiYVwiOiAyLFxuXHRcImJcIjogMixcblx0XCJkXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgc2V0dGluZyB3aXRob3V0IGNvbW1lbnRzIGF0IHRoZSBlbmQnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAzXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImFcIjogMlxufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJhXCI6IDIsXG5cdFwiYlwiOiAyXG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luc2VydCBiZXR3ZWVuIHNldHRpbmdzIHdpdGhvdXQgY29tbWVudCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYmV0d2VlbiBzZXR0aW5ncyBhbmQgdGhlcmUgaXMgYSBjb21tZW50IGluIGJldHdlZW4gaW4gc291cmNlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIGFuZCBhZnRlciBhIGNvbW1lbnQgYXQgdGhlIGVuZCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDJcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMlxufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIGVuZGluZyB3aXRoIGNvbW1hIGFuZCBhZnRlciBhIGNvbW1lbnQgYXQgdGhlIGVuZCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDJcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDJcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgY29tbWVudCBhbmQgdGhlcmUgYXJlIG5vIHNldHRpbmdzJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMlxufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIGFuZCBiZXR3ZWVuIGEgY29tbWVudCBhbmQgc2V0dGluZycsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAzXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIGJldHdlZW4gdHdvIGNvbW1lbnRzIGFuZCB0aGVyZSBpcyBhIHNldHRpbmcgYWZ0ZXInLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgc2V0dGluZyBiZXR3ZWVuIHR3byBjb21tZW50cyBvbiB0aGUgc2FtZSBsaW5lIGFuZCB0aGVyZSBpcyBhIHNldHRpbmcgYWZ0ZXInLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0LyogdGhpcyBpcyBjb21tZW50IGZvciBiICovXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvKiB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgKi8gLy8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMSxcblx0LyogdGhpcyBpcyBjb21tZW50IGZvciBiICovXG5cdFwiYlwiOiAyLCAvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgc2V0dGluZyBiZXR3ZWVuIHR3byBsaW5lIGNvbW1lbnRzIG9uIHRoZSBzYW1lIGxpbmUgYW5kIHRoZXJlIGlzIGEgc2V0dGluZyBhZnRlcicsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvKiB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgKi9cblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogM1xufWA7XG5cdFx0Y29uc3QgdGFyZ2V0Q29udGVudCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYiAvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgLy8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBzZXR0aW5nIGJldHdlZW4gdHdvIGNvbW1lbnRzIGFuZCB0aGVyZSBpcyBubyBzZXR0aW5nIGFmdGVyJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMlxuXHQvLyB0aGlzIGlzIGEgY29tbWVudFxufWA7XG5cdFx0Y29uc3QgdGFyZ2V0Q29udGVudCA9IGBcbntcblx0XCJhXCI6IDFcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luc2VydCBhZnRlciBhIHNldHRpbmcgd2l0aCBjb21tYSBhbmQgYmV0d2VlbiB0d28gY29tbWVudHMgYW5kIHRoZXJlIGlzIG5vIHNldHRpbmcgYWZ0ZXInLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXHR0ZXN0KCdJbnNlcnQgYmVmb3JlIGEgc2V0dGluZyB3aXRob3V0IGNvbW1lbnRzJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cdFx0Y29uc3QgdGFyZ2V0Q29udGVudCA9IGBcbntcblx0XCJkXCI6IDIsXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImRcIjogMixcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luc2VydCBiZWZvcmUgYSBzZXR0aW5nIHdpdGhvdXQgY29tbWVudHMgYXQgdGhlIGVuZCcsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGJlZm9yZSBhIHNldHRpbmcgd2l0aCBjb21tZW50JywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDEsXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYmVmb3JlIGEgc2V0dGluZyBhbmQgYmVmb3JlIGEgY29tbWVudCBhdCB0aGUgYmVnaW5uaW5nJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogMyxcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYmVmb3JlIGEgc2V0dGluZyBlbmRpbmcgd2l0aCBjb21tYSBhbmQgYmVmb3JlIGEgY29tbWVudCBhdCB0aGUgYmVnbmlubmluZycsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0XCJjXCI6IDMsXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJjXCI6IDMsXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0XCJiXCI6IDIsXG5cdFwiY1wiOiAzLFxufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYmVmb3JlIGEgc2V0dGluZyBhbmQgYmV0d2VlbiBhIHNldHRpbmcgYW5kIGNvbW1lbnQnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHRcImNcIjogM1xufWA7XG5cdFx0Y29uc3QgdGFyZ2V0Q29udGVudCA9IGBcbntcblx0XCJkXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0XCJkXCI6IDEsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGJlZm9yZSBhIHNldHRpbmcgYmV0d2VlbiB0d28gY29tbWVudHMgYW5kIHRoZXJlIGlzIGEgc2V0dGluZyBiZWZvcmUnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiZFwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImRcIjogMSxcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGJlZm9yZSBhIHNldHRpbmcgYmV0d2VlbiB0d28gY29tbWVudHMgb24gdGhlIHNhbWUgbGluZSBhbmQgdGhlcmUgaXMgYSBzZXR0aW5nIGJlZm9yZScsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxLFxuXHQvKiB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgKi9cblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogM1xufWA7XG5cdFx0Y29uc3QgdGFyZ2V0Q29udGVudCA9IGBcbntcblx0XCJkXCI6IDEsXG5cdC8qIHRoaXMgaXMgY29tbWVudCBmb3IgYiAqLyAvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdFwiZFwiOiAxLFxuXHQvKiB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgKi9cblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgY1xuXHRcImNcIjogM1xufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYmVmb3JlIGEgc2V0dGluZyBiZXR3ZWVuIHR3byBsaW5lIGNvbW1lbnRzIG9uIHRoZSBzYW1lIGxpbmUgYW5kIHRoZXJlIGlzIGEgc2V0dGluZyBiZWZvcmUnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMSxcblx0LyogdGhpcyBpcyBjb21tZW50IGZvciBiICovXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiZFwiOiAxLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGIgLy8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImRcIjogMSxcblx0XCJiXCI6IDIsXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYiAvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGJlZm9yZSBhIHNldHRpbmcgYmV0d2VlbiB0d28gY29tbWVudHMgYW5kIHRoZXJlIGlzIG5vIHNldHRpbmcgYmVmb3JlJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDFcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDFcbn1gO1xuXG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxXG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luc2VydCBiZWZvcmUgYSBzZXR0aW5nIHdpdGggY29tbWEgYW5kIGJldHdlZW4gdHdvIGNvbW1lbnRzIGFuZCB0aGVyZSBpcyBubyBzZXR0aW5nIGJlZm9yZScsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYlxuXHRcImJcIjogMixcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGJcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBjXG5cdFwiY1wiOiAxLFxufWA7XG5cblx0XHRjb25zdCBleHBlY3RlZCA9IGBcbntcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBiXG5cdFwiYlwiOiAyLFxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGNcblx0XCJjXCI6IDEsXG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2InLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0luc2VydCBhZnRlciBhIHNldHRpbmcgdGhhdCBpcyBvZiBvYmplY3QgdHlwZScsICgpID0+IHtcblxuXHRcdGNvbnN0IHNvdXJjZUNvbnRlbnQgPSBgXG57XG5cdFwiYlwiOiB7XG5cdFx0XCJkXCI6IDFcblx0fSxcblx0XCJhXCI6IDIsXG5cdFwiY1wiOiAxXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImJcIjoge1xuXHRcdFwiZFwiOiAxXG5cdH0sXG5cdFwiY1wiOiAxXG59YDtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IGFkZFNldHRpbmcoJ2EnLCBzb3VyY2VDb250ZW50LCB0YXJnZXRDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBzb3VyY2VDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgc2V0dGluZyB0aGF0IGlzIG9mIGFycmF5IHR5cGUnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImJcIjogW1xuXHRcdDFcblx0XSxcblx0XCJhXCI6IDIsXG5cdFwiY1wiOiAxXG59YDtcblx0XHRjb25zdCB0YXJnZXRDb250ZW50ID0gYFxue1xuXHRcImJcIjogW1xuXHRcdDFcblx0XSxcblx0XCJjXCI6IDFcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYScsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIHNvdXJjZUNvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBjb21tZW50IHdpdGggY29tbWEgc2VwYXJhdG9yIG9mIHByZXZpb3VzIHNldHRpbmcgYW5kIG5vIG5leHQgbm9kZXMgJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDFcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBhXG5cdCxcblx0XCJiXCI6IDJcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYVxuXHQsXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMVxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGFcblx0LFxuXHRcImJcIjogMlxufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdJbnNlcnQgYWZ0ZXIgYSBjb21tZW50IHdpdGggY29tbWEgc2VwYXJhdG9yIG9mIHByZXZpb3VzIHNldHRpbmcgYW5kIHRoZXJlIGlzIGEgc2V0dGluZyBhZnRlciAnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBzb3VyY2VDb250ZW50ID0gYFxue1xuXHRcImFcIjogMVxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGFcblx0LFxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYVxuXHQsXG5cdFwiY1wiOiAzXG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMVxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGFcblx0LFxuXHRcImJcIjogMixcblx0XCJjXCI6IDNcbn1gO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gYWRkU2V0dGluZygnYicsIHNvdXJjZUNvbnRlbnQsIHRhcmdldENvbnRlbnQsIGZvcm1hdHRpbmdPcHRpb25zKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnSW5zZXJ0IGFmdGVyIGEgY29tbWVudCB3aXRoIGNvbW1hIHNlcGFyYXRvciBvZiBwcmV2aW91cyBzZXR0aW5nIGFuZCB0aGVyZSBpcyBhIGNvbW1lbnQgYWZ0ZXIgJywgKCkgPT4ge1xuXG5cdFx0Y29uc3Qgc291cmNlQ29udGVudCA9IGBcbntcblx0XCJhXCI6IDFcblx0Ly8gdGhpcyBpcyBjb21tZW50IGZvciBhXG5cdCxcblx0XCJiXCI6IDJcblx0Ly8gdGhpcyBpcyBhIGNvbW1lbnRcbn1gO1xuXHRcdGNvbnN0IHRhcmdldENvbnRlbnQgPSBgXG57XG5cdFwiYVwiOiAxXG5cdC8vIHRoaXMgaXMgY29tbWVudCBmb3IgYVxuXHQsXG5cdC8vIHRoaXMgaXMgYSBjb21tZW50XG59YDtcblxuXHRcdGNvbnN0IGV4cGVjdGVkID0gYFxue1xuXHRcImFcIjogMVxuXHQvLyB0aGlzIGlzIGNvbW1lbnQgZm9yIGFcblx0LFxuXHRcImJcIjogMlxuXHQvLyB0aGlzIGlzIGEgY29tbWVudFxufWA7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBhZGRTZXR0aW5nKCdiJywgc291cmNlQ29udGVudCwgdGFyZ2V0Q29udGVudCwgZm9ybWF0dGluZ09wdGlvbnMpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xuXHR9KTtcbn0pO1xuXG5cbmZ1bmN0aW9uIHN0cmluZ2lmeSh2YWx1ZTogYW55KTogc3RyaW5nIHtcblx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KHZhbHVlLCBudWxsLCAnXFx0Jyk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxZQUFZLE9BQU8sNkJBQTZCO0FBR3pELE1BQU0sb0JBQW9CLEVBQUUsS0FBSyxNQUFNLGNBQWMsT0FBTyxTQUFTLEVBQUU7QUFFdkUsTUFBTSx5QkFBeUIsTUFBTTtBQUVwQywwQ0FBd0M7QUFFeEMsT0FBSyx1REFBdUQsWUFBWTtBQUN2RSxVQUFNLGVBQWUsVUFBVSxFQUFFLEtBQUssRUFBRSxDQUFDO0FB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
