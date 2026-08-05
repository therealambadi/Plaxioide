import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { merge } from "../../common/keybindingsMerge.js";
import { TestUserDataSyncUtilService } from "./userDataSyncClient.js";
suite("KeybindingsMerge - No Conflicts", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("merge when local and remote are same with one entry", async () => {
    const localContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const remoteContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote are same with similar when contexts", async () => {
    const localContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const remoteContent = stringify([{ key: "alt+c", command: "a", when: "!editorReadonly && editorTextFocus" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote has entries in different order", async () => {
    const localContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+a", command: "a", when: "editorTextFocus" }
    ]);
    const remoteContent = stringify([
      { key: "alt+a", command: "a", when: "editorTextFocus" },
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote are same with multiple entries", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote are same with different base content", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const baseContent = stringify([
      { key: "ctrl+c", command: "e" },
      { key: "shift+d", command: "d", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote are same with multiple entries in different order", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local and remote are same when remove entry is in different order", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "alt+d", command: "-a" },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(!actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when a new entry is added to remote", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when multiple new entries are added to remote", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "cmd+d", command: "c" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when multiple new entries are added to remote from base and local has not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "cmd+d", command: "c" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when an entry is removed from remote from base and local has not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when an entry (same command) is removed from remote from base and local has not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when an entry is updated in remote from base and local has not changed", async () => {
    const localContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when a command with multiple entries is updated from remote from base and local has not changed", async () => {
    const localContent = stringify([
      { key: "shift+c", command: "c" },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "b" },
      { key: "cmd+c", command: "a" }
    ]);
    const remoteContent = stringify([
      { key: "shift+c", command: "c" },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "b" },
      { key: "cmd+d", command: "a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when remote has moved forwareded with multiple changes and local stays with base", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "alt+d", command: "-a" },
      { key: "cmd+e", command: "d" },
      { key: "cmd+d", command: "c", when: "context1" }
    ]);
    const remoteContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+e", command: "d" },
      { key: "alt+d", command: "-a" },
      { key: "alt+f", command: "f" },
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "cmd+c", command: "-c" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, localContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, remoteContent);
  });
  test("merge when a new entry is added to local", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when multiple new entries are added to local", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "cmd+d", command: "c" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when multiple new entries are added to local from base and remote is not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "cmd+d", command: "c" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when an entry is removed from local from base and remote has not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" },
      { key: "cmd+c", command: "b", args: { text: "`" } }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when an entry (with same command) is removed from local from base and remote has not changed", async () => {
    const localContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "-a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when an entry is updated in local from base and remote has not changed", async () => {
    const localContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when a command with multiple entries is updated from local from base and remote has not changed", async () => {
    const localContent = stringify([
      { key: "shift+c", command: "c" },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "b" },
      { key: "cmd+c", command: "a" }
    ]);
    const remoteContent = stringify([
      { key: "shift+c", command: "c" },
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+d", command: "b" },
      { key: "cmd+d", command: "a" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, localContent);
  });
  test("merge when local has moved forwareded with multiple changes and remote stays with base", async () => {
    const localContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+e", command: "d" },
      { key: "alt+d", command: "-a" },
      { key: "alt+f", command: "f" },
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "cmd+c", command: "-c" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+c", command: "b", args: { text: "`" } },
      { key: "alt+d", command: "-a" },
      { key: "cmd+e", command: "d" },
      { key: "cmd+d", command: "c", when: "context1" }
    ]);
    const expected = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "cmd+e", command: "d" },
      { key: "alt+d", command: "-a" },
      { key: "alt+f", command: "f" },
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "cmd+c", command: "-c" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, remoteContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, expected);
  });
  test("merge when local and remote has moved forwareded with conflicts", async () => {
    const baseContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "ctrl+c", command: "-a" },
      { key: "cmd+e", command: "d" },
      { key: "alt+a", command: "f" },
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "cmd+c", command: "-c" }
    ]);
    const localContent = stringify([
      { key: "alt+d", command: "-f" },
      { key: "cmd+e", command: "d" },
      { key: "cmd+c", command: "-c" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "alt+a", command: "f" },
      { key: "alt+e", command: "e" }
    ]);
    const remoteContent = stringify([
      { key: "alt+a", command: "f" },
      { key: "cmd+c", command: "-c" },
      { key: "cmd+d", command: "d" },
      { key: "alt+d", command: "-f" },
      { key: "alt+c", command: "c", when: "context1" },
      { key: "alt+g", command: "g", when: "context2" }
    ]);
    const expected = stringify([
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "d" },
      { key: "cmd+c", command: "-c" },
      { key: "alt+c", command: "c", when: "context1" },
      { key: "alt+a", command: "f" },
      { key: "alt+e", command: "e" },
      { key: "alt+g", command: "g", when: "context2" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(!actual.hasConflicts);
    assert.strictEqual(actual.mergeContent, expected);
  });
  test("merge when local and remote with one entry but different value", async () => {
    const localContent = stringify([{ key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const remoteContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+d",
		"command": "a",
		"when": "editorTextFocus && !editorReadonly"
	}
]`
    );
  });
  test("merge when local and remote with different keybinding", async () => {
    const localContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+a", command: "-a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const remoteContent = stringify([
      { key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+a", command: "-a", when: "editorTextFocus && !editorReadonly" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, null);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+d",
		"command": "a",
		"when": "editorTextFocus && !editorReadonly"
	},
	{
		"key": "alt+a",
		"command": "-a",
		"when": "editorTextFocus && !editorReadonly"
	}
]`
    );
  });
  test("merge when the entry is removed in local but updated in remote", async () => {
    const baseContent = stringify([{ key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const localContent = stringify([]);
    const remoteContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[]`
    );
  });
  test("merge when the entry is removed in local but updated in remote and a new entry is added in local", async () => {
    const baseContent = stringify([{ key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const localContent = stringify([{ key: "alt+b", command: "b" }]);
    const remoteContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+b",
		"command": "b"
	}
]`
    );
  });
  test("merge when the entry is removed in remote but updated in local", async () => {
    const baseContent = stringify([{ key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const localContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const remoteContent = stringify([]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+c",
		"command": "a",
		"when": "editorTextFocus && !editorReadonly"
	}
]`
    );
  });
  test("merge when the entry is removed in remote but updated in local and a new entry is added in remote", async () => {
    const baseContent = stringify([{ key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const localContent = stringify([{ key: "alt+c", command: "a", when: "editorTextFocus && !editorReadonly" }]);
    const remoteContent = stringify([{ key: "alt+b", command: "b" }]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+c",
		"command": "a",
		"when": "editorTextFocus && !editorReadonly"
	},
	{
		"key": "alt+b",
		"command": "b"
	}
]`
    );
  });
  test("merge when local and remote has moved forwareded with conflicts (2)", async () => {
    const baseContent = stringify([
      { key: "alt+d", command: "a", when: "editorTextFocus && !editorReadonly" },
      { key: "alt+c", command: "-a" },
      { key: "cmd+e", command: "d" },
      { key: "alt+a", command: "f" },
      { key: "alt+d", command: "-f" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "cmd+c", command: "-c" }
    ]);
    const localContent = stringify([
      { key: "alt+d", command: "-f" },
      { key: "cmd+e", command: "d" },
      { key: "cmd+c", command: "-c" },
      { key: "cmd+d", command: "c", when: "context1" },
      { key: "alt+a", command: "f" },
      { key: "alt+e", command: "e" }
    ]);
    const remoteContent = stringify([
      { key: "alt+a", command: "f" },
      { key: "cmd+c", command: "-c" },
      { key: "cmd+d", command: "d" },
      { key: "alt+d", command: "-f" },
      { key: "alt+c", command: "c", when: "context1" },
      { key: "alt+g", command: "g", when: "context2" }
    ]);
    const actual = await mergeKeybindings(localContent, remoteContent, baseContent);
    assert.ok(actual.hasChanges);
    assert.ok(actual.hasConflicts);
    assert.strictEqual(
      actual.mergeContent,
      `[
	{
		"key": "alt+d",
		"command": "-f"
	},
	{
		"key": "cmd+d",
		"command": "d"
	},
	{
		"key": "cmd+c",
		"command": "-c"
	},
	{
		"key": "cmd+d",
		"command": "c",
		"when": "context1"
	},
	{
		"key": "alt+a",
		"command": "f"
	},
	{
		"key": "alt+e",
		"command": "e"
	},
	{
		"key": "alt+g",
		"command": "g",
		"when": "context2"
	}
]`
    );
  });
});
async function mergeKeybindings(localContent, remoteContent, baseContent) {
  const userDataSyncUtilService = new TestUserDataSyncUtilService();
  const formattingOptions = await userDataSyncUtilService.resolveFormattingOptions();
  return merge(localContent, remoteContent, baseContent, formattingOptions, userDataSyncUtilService);
}
function stringify(value) {
  return JSON.stringify(value, null, "	");
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS91c2VyRGF0YVN5bmMvdGVzdC9jb21tb24va2V5YmluZGluZ3NNZXJnZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBtZXJnZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9rZXliaW5kaW5nc01lcmdlLmpzJztcbmltcG9ydCB7IFRlc3RVc2VyRGF0YVN5bmNVdGlsU2VydmljZSB9IGZyb20gJy4vdXNlckRhdGFTeW5jQ2xpZW50LmpzJztcblxuc3VpdGUoJ0tleWJpbmRpbmdzTWVyZ2UgLSBObyBDb25mbGljdHMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGFyZSBzYW1lIHdpdGggb25lIGVudHJ5JywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbeyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1dKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgYXJlIHNhbWUgd2l0aCBzaW1pbGFyIHdoZW4gY29udGV4dHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW3sga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICchZWRpdG9yUmVhZG9ubHkgJiYgZWRpdG9yVGV4dEZvY3VzJyB9XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBoYXMgZW50cmllcyBpbiBkaWZmZXJlbnQgb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrYScsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cycgfVxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYScsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cycgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9XG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBhcmUgc2FtZSB3aXRoIG11bHRpcGxlIGVudHJpZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfVxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9XG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBhcmUgc2FtZSB3aXRoIGRpZmZlcmVudCBiYXNlIGNvbnRlbnQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfVxuXHRcdF0pO1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnY3RybCtjJywgY29tbWFuZDogJ2UnIH0sXG5cdFx0XHR7IGtleTogJ3NoaWZ0K2QnLCBjb21tYW5kOiAnZCcsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfVxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9XG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGJhc2VDb250ZW50KTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgYXJlIHNhbWUgd2l0aCBtdWx0aXBsZSBlbnRyaWVzIGluIGRpZmZlcmVudCBvcmRlcicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9XG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJ2InLCBhcmdzOiB7IHRleHQ6ICdgJyB9IH0sXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSBhcmUgc2FtZSB3aGVuIHJlbW92ZSBlbnRyeSBpcyBpbiBkaWZmZXJlbnQgb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfVxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGEgbmV3IGVudHJ5IGlzIGFkZGVkIHRvIHJlbW90ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIG11bHRpcGxlIG5ldyBlbnRyaWVzIGFyZSBhZGRlZCB0byByZW1vdGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBtdWx0aXBsZSBuZXcgZW50cmllcyBhcmUgYWRkZWQgdG8gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJ2InLCBhcmdzOiB7IHRleHQ6ICdgJyB9IH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2MnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyByZW1vdmVkIGZyb20gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJ2InLCBhcmdzOiB7IHRleHQ6ICdgJyB9IH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSAoc2FtZSBjb21tYW5kKSBpcyByZW1vdmVkIGZyb20gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5IGlzIHVwZGF0ZWQgaW4gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYSBjb21tYW5kIHdpdGggbXVsdGlwbGUgZW50cmllcyBpcyB1cGRhdGVkIGZyb20gcmVtb3RlIGZyb20gYmFzZSBhbmQgbG9jYWwgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ3NoaWZ0K2MnLCBjb21tYW5kOiAnYycgfSxcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdiJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdhJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdzaGlmdCtjJywgY29tbWFuZDogJ2MnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnYicgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYScgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHJlbW90ZSBoYXMgbW92ZWQgZm9yd2FyZWRlZCB3aXRoIG11bHRpcGxlIGNoYW5nZXMgYW5kIGxvY2FsIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJ2InLCBhcmdzOiB7IHRleHQ6ICdgJyB9IH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrZScsIGNvbW1hbmQ6ICdkJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrZCcsIGNvbW1hbmQ6ICdjJywgd2hlbjogJ2NvbnRleHQxJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtlJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZicsIGNvbW1hbmQ6ICdmJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctZicgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycsIHdoZW46ICdjb250ZXh0MScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnLWMnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhIG5ldyBlbnRyeSBpcyBhZGRlZCB0byBsb2NhbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdiJywgYXJnczogeyB0ZXh0OiAnYCcgfSB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbXVsdGlwbGUgbmV3IGVudHJpZXMgYXJlIGFkZGVkIHRvIGxvY2FsJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJ2InLCBhcmdzOiB7IHRleHQ6ICdgJyB9IH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2MnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIG51bGwpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBtdWx0aXBsZSBuZXcgZW50cmllcyBhcmUgYWRkZWQgdG8gbG9jYWwgZnJvbSBiYXNlIGFuZCByZW1vdGUgaXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5IGlzIHJlbW92ZWQgZnJvbSBsb2NhbCBmcm9tIGJhc2UgYW5kIHJlbW90ZSBoYXMgbm90IGNoYW5nZWQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGFuIGVudHJ5ICh3aXRoIHNhbWUgY29tbWFuZCkgaXMgcmVtb3ZlZCBmcm9tIGxvY2FsIGZyb20gYmFzZSBhbmQgcmVtb3RlIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCwgbG9jYWxDb250ZW50KTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBhbiBlbnRyeSBpcyB1cGRhdGVkIGluIGxvY2FsIGZyb20gYmFzZSBhbmQgcmVtb3RlIGhhcyBub3QgY2hhbmdlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cycgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCByZW1vdGVDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayghYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsIGxvY2FsQ29udGVudCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gYSBjb21tYW5kIHdpdGggbXVsdGlwbGUgZW50cmllcyBpcyB1cGRhdGVkIGZyb20gbG9jYWwgZnJvbSBiYXNlIGFuZCByZW1vdGUgaGFzIG5vdCBjaGFuZ2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ3NoaWZ0K2MnLCBjb21tYW5kOiAnYycgfSxcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdiJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICdhJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdzaGlmdCtjJywgY29tbWFuZDogJ2MnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnYicgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYScgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgcmVtb3RlQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBsb2NhbENvbnRlbnQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGhhcyBtb3ZlZCBmb3J3YXJlZGVkIHdpdGggbXVsdGlwbGUgY2hhbmdlcyBhbmQgcmVtb3RlIHN0YXlzIHdpdGggYmFzZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtlJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZicsIGNvbW1hbmQ6ICdmJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctZicgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycsIHdoZW46ICdjb250ZXh0MScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnLWMnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnYicsIGFyZ3M6IHsgdGV4dDogJ2AnIH0gfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtlJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2MnLCB3aGVuOiAnY29udGV4dDEnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtlJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1hJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZicsIGNvbW1hbmQ6ICdmJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctZicgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycsIHdoZW46ICdjb250ZXh0MScgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnLWMnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIHJlbW90ZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKCFhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIGxvY2FsIGFuZCByZW1vdGUgaGFzIG1vdmVkIGZvcndhcmVkZWQgd2l0aCBjb25mbGljdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2N0cmwrYycsIGNvbW1hbmQ6ICctYScgfSxcblx0XHRcdHsga2V5OiAnY21kK2UnLCBjb21tYW5kOiAnZCcgfSxcblx0XHRcdHsga2V5OiAnYWx0K2EnLCBjb21tYW5kOiAnZicgfSxcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWYnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2MnLCB3aGVuOiAnY29udGV4dDEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJy1jJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1mJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrZScsIGNvbW1hbmQ6ICdkJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICctYycgfSxcblx0XHRcdHsga2V5OiAnY21kK2QnLCBjb21tYW5kOiAnYycsIHdoZW46ICdjb250ZXh0MScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2EnLCBjb21tYW5kOiAnZicgfSxcblx0XHRcdHsga2V5OiAnYWx0K2UnLCBjb21tYW5kOiAnZScgfSxcblx0XHRdKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2EnLCBjb21tYW5kOiAnZicgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnLWMnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1mJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdjJywgd2hlbjogJ2NvbnRleHQxJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZycsIGNvbW1hbmQ6ICdnJywgd2hlbjogJ2NvbnRleHQyJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gc3RyaW5naWZ5KFtcblx0XHRcdHsga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnLWYnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJy1jJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdjJywgd2hlbjogJ2NvbnRleHQxJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrYScsIGNvbW1hbmQ6ICdmJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZScsIGNvbW1hbmQ6ICdlJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZycsIGNvbW1hbmQ6ICdnJywgd2hlbjogJ2NvbnRleHQyJyB9LFxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soIWFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSB3aXRoIG9uZSBlbnRyeSBidXQgZGlmZmVyZW50IHZhbHVlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbeyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1dKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBudWxsKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCxcblx0XHRcdGBbXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCtkXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiYVwiLFxuXHRcdFwid2hlblwiOiBcImVkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHlcIlxuXHR9XG5dYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gbG9jYWwgYW5kIHJlbW90ZSB3aXRoIGRpZmZlcmVudCBrZXliaW5kaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2EnLCBjb21tYW5kOiAnLWEnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfVxuXHRcdF0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH0sXG5cdFx0XHR7IGtleTogJ2FsdCthJywgY29tbWFuZDogJy1hJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1cblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgbnVsbCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsXG5cdFx0XHRgW1xuXHR7XG5cdFx0XCJrZXlcIjogXCJhbHQrZFwiLFxuXHRcdFwiY29tbWFuZFwiOiBcImFcIixcblx0XHRcIndoZW5cIjogXCJlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5XCJcblx0fSxcblx0e1xuXHRcdFwia2V5XCI6IFwiYWx0K2FcIixcblx0XHRcImNvbW1hbmRcIjogXCItYVwiLFxuXHRcdFwid2hlblwiOiBcImVkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHlcIlxuXHR9XG5dYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gdGhlIGVudHJ5IGlzIHJlbW92ZWQgaW4gbG9jYWwgYnV0IHVwZGF0ZWQgaW4gcmVtb3RlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbXSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbeyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1dKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LFxuXHRcdFx0YFtdYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ21lcmdlIHdoZW4gdGhlIGVudHJ5IGlzIHJlbW92ZWQgaW4gbG9jYWwgYnV0IHVwZGF0ZWQgaW4gcmVtb3RlIGFuZCBhIG5ldyBlbnRyeSBpcyBhZGRlZCBpbiBsb2NhbCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IHN0cmluZ2lmeShbeyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1dKTtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW3sga2V5OiAnYWx0K2InLCBjb21tYW5kOiAnYicgfV0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW3sga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9XSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gYXdhaXQgbWVyZ2VLZXliaW5kaW5ncyhsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGJhc2VDb250ZW50KTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NoYW5nZXMpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ29uZmxpY3RzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1lcmdlQ29udGVudCxcblx0XHRcdGBbXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCtiXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiYlwiXG5cdH1cbl1gKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiB0aGUgZW50cnkgaXMgcmVtb3ZlZCBpbiByZW1vdGUgYnV0IHVwZGF0ZWQgaW4gbG9jYWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgYmFzZUNvbnRlbnQgPSBzdHJpbmdpZnkoW3sga2V5OiAnYWx0K2QnLCBjb21tYW5kOiAnYScsIHdoZW46ICdlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5JyB9XSk7XG5cdFx0Y29uc3QgbG9jYWxDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtjJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IHJlbW90ZUNvbnRlbnQgPSBzdHJpbmdpZnkoW10pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IGF3YWl0IG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50LCByZW1vdGVDb250ZW50LCBiYXNlQ29udGVudCk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDaGFuZ2VzKTtcblx0XHRhc3NlcnQub2soYWN0dWFsLmhhc0NvbmZsaWN0cyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5tZXJnZUNvbnRlbnQsXG5cdFx0XHRgW1xuXHR7XG5cdFx0XCJrZXlcIjogXCJhbHQrY1wiLFxuXHRcdFwiY29tbWFuZFwiOiBcImFcIixcblx0XHRcIndoZW5cIjogXCJlZGl0b3JUZXh0Rm9jdXMgJiYgIWVkaXRvclJlYWRvbmx5XCJcblx0fVxuXWApO1xuXHR9KTtcblxuXHR0ZXN0KCdtZXJnZSB3aGVuIHRoZSBlbnRyeSBpcyByZW1vdmVkIGluIHJlbW90ZSBidXQgdXBkYXRlZCBpbiBsb2NhbCBhbmQgYSBuZXcgZW50cnkgaXMgYWRkZWQgaW4gcmVtb3RlJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGJhc2VDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfV0pO1xuXHRcdGNvbnN0IGxvY2FsQ29udGVudCA9IHN0cmluZ2lmeShbeyBrZXk6ICdhbHQrYycsIGNvbW1hbmQ6ICdhJywgd2hlbjogJ2VkaXRvclRleHRGb2N1cyAmJiAhZWRpdG9yUmVhZG9ubHknIH1dKTtcblx0XHRjb25zdCByZW1vdGVDb250ZW50ID0gc3RyaW5naWZ5KFt7IGtleTogJ2FsdCtiJywgY29tbWFuZDogJ2InIH1dKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LFxuXHRcdFx0YFtcblx0e1xuXHRcdFwia2V5XCI6IFwiYWx0K2NcIixcblx0XHRcImNvbW1hbmRcIjogXCJhXCIsXG5cdFx0XCJ3aGVuXCI6IFwiZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seVwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCtiXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiYlwiXG5cdH1cbl1gKTtcblx0fSk7XG5cblx0dGVzdCgnbWVyZ2Ugd2hlbiBsb2NhbCBhbmQgcmVtb3RlIGhhcyBtb3ZlZCBmb3J3YXJlZGVkIHdpdGggY29uZmxpY3RzICgyKScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBiYXNlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJ2EnLCB3aGVuOiAnZWRpdG9yVGV4dEZvY3VzICYmICFlZGl0b3JSZWFkb25seScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnLWEnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtlJywgY29tbWFuZDogJ2QnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCthJywgY29tbWFuZDogJ2YnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtkJywgY29tbWFuZDogJy1mJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrZCcsIGNvbW1hbmQ6ICdjJywgd2hlbjogJ2NvbnRleHQxJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrYycsIGNvbW1hbmQ6ICctYycgfSxcblx0XHRdKTtcblx0XHRjb25zdCBsb2NhbENvbnRlbnQgPSBzdHJpbmdpZnkoW1xuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctZicgfSxcblx0XHRcdHsga2V5OiAnY21kK2UnLCBjb21tYW5kOiAnZCcgfSxcblx0XHRcdHsga2V5OiAnY21kK2MnLCBjb21tYW5kOiAnLWMnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtkJywgY29tbWFuZDogJ2MnLCB3aGVuOiAnY29udGV4dDEnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCthJywgY29tbWFuZDogJ2YnIH0sXG5cdFx0XHR7IGtleTogJ2FsdCtlJywgY29tbWFuZDogJ2UnIH0sXG5cdFx0XSk7XG5cdFx0Y29uc3QgcmVtb3RlQ29udGVudCA9IHN0cmluZ2lmeShbXG5cdFx0XHR7IGtleTogJ2FsdCthJywgY29tbWFuZDogJ2YnIH0sXG5cdFx0XHR7IGtleTogJ2NtZCtjJywgY29tbWFuZDogJy1jJyB9LFxuXHRcdFx0eyBrZXk6ICdjbWQrZCcsIGNvbW1hbmQ6ICdkJyB9LFxuXHRcdFx0eyBrZXk6ICdhbHQrZCcsIGNvbW1hbmQ6ICctZicgfSxcblx0XHRcdHsga2V5OiAnYWx0K2MnLCBjb21tYW5kOiAnYycsIHdoZW46ICdjb250ZXh0MScgfSxcblx0XHRcdHsga2V5OiAnYWx0K2cnLCBjb21tYW5kOiAnZycsIHdoZW46ICdjb250ZXh0MicgfSxcblx0XHRdKTtcblx0XHRjb25zdCBhY3R1YWwgPSBhd2FpdCBtZXJnZUtleWJpbmRpbmdzKGxvY2FsQ29udGVudCwgcmVtb3RlQ29udGVudCwgYmFzZUNvbnRlbnQpO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuaGFzQ2hhbmdlcyk7XG5cdFx0YXNzZXJ0Lm9rKGFjdHVhbC5oYXNDb25mbGljdHMpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubWVyZ2VDb250ZW50LFxuXHRcdFx0YFtcblx0e1xuXHRcdFwia2V5XCI6IFwiYWx0K2RcIixcblx0XHRcImNvbW1hbmRcIjogXCItZlwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImNtZCtkXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiZFwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImNtZCtjXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiLWNcIlxuXHR9LFxuXHR7XG5cdFx0XCJrZXlcIjogXCJjbWQrZFwiLFxuXHRcdFwiY29tbWFuZFwiOiBcImNcIixcblx0XHRcIndoZW5cIjogXCJjb250ZXh0MVwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCthXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiZlwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCtlXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiZVwiXG5cdH0sXG5cdHtcblx0XHRcImtleVwiOiBcImFsdCtnXCIsXG5cdFx0XCJjb21tYW5kXCI6IFwiZ1wiLFxuXHRcdFwid2hlblwiOiBcImNvbnRleHQyXCJcblx0fVxuXWApO1xuXHR9KTtcblxufSk7XG5cbmFzeW5jIGZ1bmN0aW9uIG1lcmdlS2V5YmluZGluZ3MobG9jYWxDb250ZW50OiBzdHJpbmcsIHJlbW90ZUNvbnRlbnQ6IHN0cmluZywgYmFzZUNvbnRlbnQ6IHN0cmluZyB8IG51bGwpIHtcblx0Y29uc3QgdXNlckRhdGFTeW5jVXRpbFNlcnZpY2UgPSBuZXcgVGVzdFVzZXJEYXRhU3luY1V0aWxTZXJ2aWNlKCk7XG5cdGNvbnN0IGZvcm1hdHRpbmdPcHRpb25zID0gYXdhaXQgdXNlckRhdGFTeW5jVXRpbFNlcnZpY2UucmVzb2x2ZUZvcm1hdHRpbmdPcHRpb25zKCk7XG5cdHJldHVybiBtZXJnZShsb2NhbENvbnRlbnQsIHJlbW90ZUNvbnRlbnQsIGJhc2VDb250ZW50LCBmb3JtYXR0aW5nT3B0aW9ucywgdXNlckRhdGFTeW5jVXRpbFNlcnZpY2UpO1xufVxuXG5mdW5jdGlvbiBzdHJpbmdpZnkodmFsdWU6IGFueSk6IHN0cmluZyB7XG5cdHJldHVybiBKU09OLnN0cmluZ2lmeSh2YWx1ZSwgbnVsbCwgJ1xcdCcpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUN0QixTQUFTLG1DQUFtQztBQUU1QyxNQUFNLG1DQUFtQyxNQUFNO0FBRTlDLDBDQUF3QztBQUV4QyxPQUFLLHVEQUF1RCxZQUFZO0FBQ3ZFLFVBQU0sZUFBZSxV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
