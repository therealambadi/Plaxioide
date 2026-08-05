import { deepStrictEqual, strictEqual } from "assert";
import { EnvironmentVariableMutatorType } from "../../../../../platform/terminal/common/environmentVariable.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { MergedEnvironmentVariableCollection } from "../../../../../platform/terminal/common/environmentVariableCollection.js";
import { deserializeEnvironmentDescriptionMap, deserializeEnvironmentVariableCollection } from "../../../../../platform/terminal/common/environmentVariableShared.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("EnvironmentVariable - MergedEnvironmentVariableCollection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("ctor", () => {
    test("Should keep entries that come after a Prepend or Append type mutators", () => {
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }],
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }],
        ["ext3", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a3", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }],
        ["ext4", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a4", type: EnvironmentVariableMutatorType.Append, variable: "A", options: { applyAtProcessCreation: true, applyAtShellIntegration: true } }]
          ])
        }]
      ]));
      deepStrictEqual([...merged.getVariableMap(void 0).entries()], [
        ["A", [
          { extensionIdentifier: "ext4", type: EnvironmentVariableMutatorType.Append, value: "a4", variable: "A", options: { applyAtProcessCreation: true, applyAtShellIntegration: true } },
          { extensionIdentifier: "ext3", type: EnvironmentVariableMutatorType.Prepend, value: "a3", variable: "A", options: void 0 },
          { extensionIdentifier: "ext2", type: EnvironmentVariableMutatorType.Append, value: "a2", variable: "A", options: void 0 },
          { extensionIdentifier: "ext1", type: EnvironmentVariableMutatorType.Prepend, value: "a1", variable: "A", options: void 0 }
        ]]
      ]);
    });
    test("Should remove entries that come after a Replace type mutator", () => {
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }],
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }],
        ["ext3", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a3", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }],
        ["ext4", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a4", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      deepStrictEqual([...merged.getVariableMap(void 0).entries()], [
        ["A", [
          { extensionIdentifier: "ext3", type: EnvironmentVariableMutatorType.Replace, value: "a3", variable: "A", options: void 0 },
          { extensionIdentifier: "ext2", type: EnvironmentVariableMutatorType.Append, value: "a2", variable: "A", options: void 0 },
          { extensionIdentifier: "ext1", type: EnvironmentVariableMutatorType.Prepend, value: "a1", variable: "A", options: void 0 }
        ]]
      ], "The ext4 entry should be removed as it comes after a Replace");
    });
    test("Appropriate workspace scoped entries are returned when querying for a particular workspace folder", () => {
      const scope1 = { workspaceFolder: { uri: URI.file("workspace1"), name: "workspace1", index: 0 } };
      const scope2 = { workspaceFolder: { uri: URI.file("workspace2"), name: "workspace2", index: 3 } };
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, scope: scope1, variable: "A" }]
          ])
        }],
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }],
        ["ext3", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a3", type: EnvironmentVariableMutatorType.Prepend, scope: scope2, variable: "A" }]
          ])
        }],
        ["ext4", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a4", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      deepStrictEqual([...merged.getVariableMap(scope2).entries()], [
        ["A", [
          { extensionIdentifier: "ext4", type: EnvironmentVariableMutatorType.Append, value: "a4", variable: "A", options: void 0 },
          { extensionIdentifier: "ext3", type: EnvironmentVariableMutatorType.Prepend, value: "a3", scope: scope2, variable: "A", options: void 0 },
          { extensionIdentifier: "ext2", type: EnvironmentVariableMutatorType.Append, value: "a2", variable: "A", options: void 0 }
        ]]
      ]);
    });
    test("Workspace scoped entries are not included when looking for global entries", () => {
      const scope1 = { workspaceFolder: { uri: URI.file("workspace1"), name: "workspace1", index: 0 } };
      const scope2 = { workspaceFolder: { uri: URI.file("workspace2"), name: "workspace2", index: 3 } };
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, scope: scope1, variable: "A" }]
          ])
        }],
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }],
        ["ext3", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a3", type: EnvironmentVariableMutatorType.Prepend, scope: scope2, variable: "A" }]
          ])
        }],
        ["ext4", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a4", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      deepStrictEqual([...merged.getVariableMap(void 0).entries()], [
        ["A", [
          { extensionIdentifier: "ext4", type: EnvironmentVariableMutatorType.Append, value: "a4", variable: "A", options: void 0 },
          { extensionIdentifier: "ext2", type: EnvironmentVariableMutatorType.Append, value: "a2", variable: "A", options: void 0 }
        ]]
      ]);
    });
    test("Workspace scoped description entries are properly filtered for each extension", () => {
      const scope1 = { workspaceFolder: { uri: URI.file("workspace1"), name: "workspace1", index: 0 } };
      const scope2 = { workspaceFolder: { uri: URI.file("workspace2"), name: "workspace2", index: 3 } };
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, scope: scope1, variable: "A" }]
          ]),
          descriptionMap: deserializeEnvironmentDescriptionMap([
            ["A-key-scope1", { description: "ext1 scope1 description", scope: scope1 }],
            ["A-key-scope2", { description: "ext1 scope2 description", scope: scope2 }]
          ])
        }],
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ]),
          descriptionMap: deserializeEnvironmentDescriptionMap([
            ["A-key", { description: "ext2 global description" }]
          ])
        }],
        ["ext3", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a3", type: EnvironmentVariableMutatorType.Prepend, scope: scope2, variable: "A" }]
          ]),
          descriptionMap: deserializeEnvironmentDescriptionMap([
            ["A-key", { description: "ext3 scope2 description", scope: scope2 }]
          ])
        }],
        ["ext4", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a4", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      deepStrictEqual([...merged.getDescriptionMap(scope1).entries()], [
        ["ext1", "ext1 scope1 description"]
      ]);
      deepStrictEqual([...merged.getDescriptionMap(void 0).entries()], [
        ["ext2", "ext2 global description"]
      ]);
    });
  });
  suite("applyToProcessEnvironment", () => {
    test("should apply the collection to an environment", async () => {
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B" }],
            ["C", { value: "c", type: EnvironmentVariableMutatorType.Prepend, variable: "C" }]
          ])
        }]
      ]));
      const env = {
        A: "foo",
        B: "bar",
        C: "baz"
      };
      await merged.applyToProcessEnvironment(env, void 0);
      deepStrictEqual(env, {
        A: "a",
        B: "barb",
        C: "cbaz"
      });
    });
    test("should apply the appropriate workspace scoped entries to an environment", async () => {
      const scope1 = { workspaceFolder: { uri: URI.file("workspace1"), name: "workspace1", index: 0 } };
      const scope2 = { workspaceFolder: { uri: URI.file("workspace2"), name: "workspace2", index: 3 } };
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, scope: scope1, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Append, scope: scope2, variable: "B" }],
            ["C", { value: "c", type: EnvironmentVariableMutatorType.Prepend, variable: "C" }]
          ])
        }]
      ]));
      const env = {
        A: "foo",
        B: "bar",
        C: "baz"
      };
      await merged.applyToProcessEnvironment(env, scope1);
      deepStrictEqual(env, {
        A: "a",
        B: "bar",
        // This is not changed because the scope does not match
        C: "cbaz"
      });
    });
    test("should apply the collection to environment entries with no values", async () => {
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B" }],
            ["C", { value: "c", type: EnvironmentVariableMutatorType.Prepend, variable: "C" }]
          ])
        }]
      ]));
      const env = {};
      await merged.applyToProcessEnvironment(env, void 0);
      deepStrictEqual(env, {
        A: "a",
        B: "b",
        C: "c"
      });
    });
    test("should apply to variable case insensitively on Windows only", async () => {
      const merged = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "a" }],
            ["b", { value: "b", type: EnvironmentVariableMutatorType.Append, variable: "b" }],
            ["c", { value: "c", type: EnvironmentVariableMutatorType.Prepend, variable: "c" }]
          ])
        }]
      ]));
      const env = {
        A: "A",
        B: "B",
        C: "C"
      };
      await merged.applyToProcessEnvironment(env, void 0);
      if (isWindows) {
        deepStrictEqual(env, {
          A: "a",
          B: "Bb",
          C: "cC"
        });
      } else {
        deepStrictEqual(env, {
          a: "a",
          A: "A",
          b: "b",
          B: "B",
          c: "c",
          C: "C"
        });
      }
    });
  });
  suite("diff", () => {
    test("should return undefined when collectinos are the same", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff, void 0);
    });
    test("should generate added diffs from when the first entry is added", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff.changed.size, 0);
      strictEqual(diff.removed.size, 0);
      const entries = [...diff.added.entries()];
      deepStrictEqual(entries, [
        ["A", [{ extensionIdentifier: "ext1", value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A", options: void 0 }]]
      ]);
    });
    test("should generate added diffs from the same extension", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff.changed.size, 0);
      strictEqual(diff.removed.size, 0);
      const entries = [...diff.added.entries()];
      deepStrictEqual(entries, [
        ["B", [{ extensionIdentifier: "ext1", value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B", options: void 0 }]]
      ]);
    });
    test("should generate added diffs from a different extension", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }],
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff.changed.size, 0);
      strictEqual(diff.removed.size, 0);
      deepStrictEqual([...diff.added.entries()], [
        ["A", [{ extensionIdentifier: "ext2", value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A", options: void 0 }]]
      ]);
      const merged3 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Prepend, variable: "A" }]
          ])
        }],
        // This entry should get removed
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      const diff2 = merged1.diff(merged3, void 0);
      strictEqual(diff2.changed.size, 0);
      strictEqual(diff2.removed.size, 0);
      deepStrictEqual([...diff.added.entries()], [...diff2.added.entries()], "Swapping the order of the entries in the other collection should yield the same result");
    });
    test("should remove entries in the diff that come after a Replace", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const merged4 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }],
        // This entry should get removed as it comes after a replace
        ["ext2", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Append, variable: "A" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged4, void 0);
      strictEqual(diff, void 0, "Replace should ignore any entries after it");
    });
    test("should generate removed diffs", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Replace, variable: "B" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a", type: EnvironmentVariableMutatorType.Replace, variable: "A" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff.changed.size, 0);
      strictEqual(diff.added.size, 0);
      deepStrictEqual([...diff.removed.entries()], [
        ["B", [{ extensionIdentifier: "ext1", value: "b", type: EnvironmentVariableMutatorType.Replace, variable: "B", options: void 0 }]]
      ]);
    });
    test("should generate changed diffs", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Replace, variable: "B" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      strictEqual(diff.added.size, 0);
      strictEqual(diff.removed.size, 0);
      deepStrictEqual([...diff.changed.entries()], [
        ["A", [{ extensionIdentifier: "ext1", value: "a2", type: EnvironmentVariableMutatorType.Replace, variable: "A", options: void 0 }]],
        ["B", [{ extensionIdentifier: "ext1", value: "b", type: EnvironmentVariableMutatorType.Append, variable: "B", options: void 0 }]]
      ]);
    });
    test("should generate diffs with added, changed and removed", () => {
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Prepend, variable: "B" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Replace, variable: "A" }],
            ["C", { value: "c", type: EnvironmentVariableMutatorType.Append, variable: "C" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, void 0);
      deepStrictEqual([...diff.added.entries()], [
        ["C", [{ extensionIdentifier: "ext1", value: "c", type: EnvironmentVariableMutatorType.Append, variable: "C", options: void 0 }]]
      ]);
      deepStrictEqual([...diff.removed.entries()], [
        ["B", [{ extensionIdentifier: "ext1", value: "b", type: EnvironmentVariableMutatorType.Prepend, variable: "B", options: void 0 }]]
      ]);
      deepStrictEqual([...diff.changed.entries()], [
        ["A", [{ extensionIdentifier: "ext1", value: "a2", type: EnvironmentVariableMutatorType.Replace, variable: "A", options: void 0 }]]
      ]);
    });
    test("should only generate workspace specific diffs", () => {
      const scope1 = { workspaceFolder: { uri: URI.file("workspace1"), name: "workspace1", index: 0 } };
      const scope2 = { workspaceFolder: { uri: URI.file("workspace2"), name: "workspace2", index: 3 } };
      const merged1 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a1", type: EnvironmentVariableMutatorType.Replace, scope: scope1, variable: "A" }],
            ["B", { value: "b", type: EnvironmentVariableMutatorType.Prepend, variable: "B" }]
          ])
        }]
      ]));
      const merged2 = new MergedEnvironmentVariableCollection(/* @__PURE__ */ new Map([
        ["ext1", {
          map: deserializeEnvironmentVariableCollection([
            ["A-key", { value: "a2", type: EnvironmentVariableMutatorType.Replace, scope: scope1, variable: "A" }],
            ["C", { value: "c", type: EnvironmentVariableMutatorType.Append, scope: scope2, variable: "C" }]
          ])
        }]
      ]));
      const diff = merged1.diff(merged2, scope1);
      strictEqual(diff.added.size, 0);
      deepStrictEqual([...diff.removed.entries()], [
        ["B", [{ extensionIdentifier: "ext1", value: "b", type: EnvironmentVariableMutatorType.Prepend, variable: "B", options: void 0 }]]
      ]);
      deepStrictEqual([...diff.changed.entries()], [
        ["A", [{ extensionIdentifier: "ext1", value: "a2", type: EnvironmentVariableMutatorType.Replace, scope: scope1, variable: "A", options: void 0 }]]
      ]);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC90ZXN0L2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbi50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZGVlcFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZS5qcyc7XG5pbXBvcnQgeyBJUHJvY2Vzc0Vudmlyb25tZW50LCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Rlcm1pbmFsL2NvbW1vbi9lbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBkZXNlcmlhbGl6ZUVudmlyb25tZW50RGVzY3JpcHRpb25NYXAsIGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZXJtaW5hbC9jb21tb24vZW52aXJvbm1lbnRWYXJpYWJsZVNoYXJlZC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdFbnZpcm9ubWVudFZhcmlhYmxlIC0gTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24nLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdjdG9yJywgKCkgPT4ge1xuXHRcdHRlc3QoJ1Nob3VsZCBrZWVwIGVudHJpZXMgdGhhdCBjb21lIGFmdGVyIGEgUHJlcGVuZCBvciBBcHBlbmQgdHlwZSBtdXRhdG9ycycsICgpID0+IHtcblx0XHRcdGNvbnN0IG1lcmdlZCA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2ExJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0WydleHQyJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbJ2V4dDMnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTMnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbJ2V4dDQnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTQnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB7IGFwcGx5QXRQcm9jZXNzQ3JlYXRpb246IHRydWUsIGFwcGx5QXRTaGVsbEludGVncmF0aW9uOiB0cnVlIH0gfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5tZXJnZWQuZ2V0VmFyaWFibGVNYXAodW5kZWZpbmVkKS5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQScsIFtcblx0XHRcdFx0XHR7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQ0JywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFsdWU6ICdhNCcsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHsgYXBwbHlBdFByb2Nlc3NDcmVhdGlvbjogdHJ1ZSwgYXBwbHlBdFNoZWxsSW50ZWdyYXRpb246IHRydWUgfSB9LFxuXHRcdFx0XHRcdHsgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDMnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgdmFsdWU6ICdhMycsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRcdHsgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YWx1ZTogJ2EyJywgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YWx1ZTogJ2ExJywgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH1cblx0XHRcdFx0XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnU2hvdWxkIHJlbW92ZSBlbnRyaWVzIHRoYXQgY29tZSBhZnRlciBhIFJlcGxhY2UgdHlwZSBtdXRhdG9yJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWVyZ2VkID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbJ2V4dDInLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0MycsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0NCcsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhNCcsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5tZXJnZWQuZ2V0VmFyaWFibGVNYXAodW5kZWZpbmVkKS5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQScsIFtcblx0XHRcdFx0XHR7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQzJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhbHVlOiAnYTMnLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0XHR7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFsdWU6ICdhMicsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRcdHsgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgdmFsdWU6ICdhMScsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XG5cdFx0XHRcdF1dXG5cdFx0XHRdLCAnVGhlIGV4dDQgZW50cnkgc2hvdWxkIGJlIHJlbW92ZWQgYXMgaXQgY29tZXMgYWZ0ZXIgYSBSZXBsYWNlJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdBcHByb3ByaWF0ZSB3b3Jrc3BhY2Ugc2NvcGVkIGVudHJpZXMgYXJlIHJldHVybmVkIHdoZW4gcXVlcnlpbmcgZm9yIGEgcGFydGljdWxhciB3b3Jrc3BhY2UgZm9sZGVyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2NvcGUxID0geyB3b3Jrc3BhY2VGb2xkZXI6IHsgdXJpOiBVUkkuZmlsZSgnd29ya3NwYWNlMScpLCBuYW1lOiAnd29ya3NwYWNlMScsIGluZGV4OiAwIH0gfTtcblx0XHRcdGNvbnN0IHNjb3BlMiA9IHsgd29ya3NwYWNlRm9sZGVyOiB7IHVyaTogVVJJLmZpbGUoJ3dvcmtzcGFjZTInKSwgbmFtZTogJ3dvcmtzcGFjZTInLCBpbmRleDogMyB9IH07XG5cdFx0XHRjb25zdCBtZXJnZWQgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCBzY29wZTogc2NvcGUxLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0MicsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0WydleHQzJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EzJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHNjb3BlOiBzY29wZTIsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0WydleHQ0Jywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2E0JywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dXG5cdFx0XHRdKSk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLm1lcmdlZC5nZXRWYXJpYWJsZU1hcChzY29wZTIpLmVudHJpZXMoKV0sIFtcblx0XHRcdFx0WydBJywgW1xuXHRcdFx0XHRcdHsgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDQnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YWx1ZTogJ2E0JywgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YWx1ZTogJ2EzJywgc2NvcGU6IHNjb3BlMiwgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhbHVlOiAnYTInLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB1bmRlZmluZWQgfSxcblx0XHRcdFx0XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnV29ya3NwYWNlIHNjb3BlZCBlbnRyaWVzIGFyZSBub3QgaW5jbHVkZWQgd2hlbiBsb29raW5nIGZvciBnbG9iYWwgZW50cmllcycsICgpID0+IHtcblx0XHRcdGNvbnN0IHNjb3BlMSA9IHsgd29ya3NwYWNlRm9sZGVyOiB7IHVyaTogVVJJLmZpbGUoJ3dvcmtzcGFjZTEnKSwgbmFtZTogJ3dvcmtzcGFjZTEnLCBpbmRleDogMCB9IH07XG5cdFx0XHRjb25zdCBzY29wZTIgPSB7IHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5maWxlKCd3b3Jrc3BhY2UyJyksIG5hbWU6ICd3b3Jrc3BhY2UyJywgaW5kZXg6IDMgfSB9O1xuXHRcdFx0Y29uc3QgbWVyZ2VkID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgc2NvcGU6IHNjb3BlMSwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbJ2V4dDInLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0MycsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCBzY29wZTogc2NvcGUyLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0NCcsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhNCcsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5tZXJnZWQuZ2V0VmFyaWFibGVNYXAodW5kZWZpbmVkKS5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQScsIFtcblx0XHRcdFx0XHR7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQ0JywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFsdWU6ICdhNCcsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHVuZGVmaW5lZCB9LFxuXHRcdFx0XHRcdHsgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YWx1ZTogJ2EyJywgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdF1dXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ1dvcmtzcGFjZSBzY29wZWQgZGVzY3JpcHRpb24gZW50cmllcyBhcmUgcHJvcGVybHkgZmlsdGVyZWQgZm9yIGVhY2ggZXh0ZW5zaW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2NvcGUxID0geyB3b3Jrc3BhY2VGb2xkZXI6IHsgdXJpOiBVUkkuZmlsZSgnd29ya3NwYWNlMScpLCBuYW1lOiAnd29ya3NwYWNlMScsIGluZGV4OiAwIH0gfTtcblx0XHRcdGNvbnN0IHNjb3BlMiA9IHsgd29ya3NwYWNlRm9sZGVyOiB7IHVyaTogVVJJLmZpbGUoJ3dvcmtzcGFjZTInKSwgbmFtZTogJ3dvcmtzcGFjZTInLCBpbmRleDogMyB9IH07XG5cdFx0XHRjb25zdCBtZXJnZWQgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCBzY29wZTogc2NvcGUxLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSksXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb25NYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnREZXNjcmlwdGlvbk1hcChbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5LXNjb3BlMScsIHsgZGVzY3JpcHRpb246ICdleHQxIHNjb3BlMSBkZXNjcmlwdGlvbicsIHNjb3BlOiBzY29wZTEgfV0sXG5cdFx0XHRcdFx0XHRbJ0Eta2V5LXNjb3BlMicsIHsgZGVzY3JpcHRpb246ICdleHQxIHNjb3BlMiBkZXNjcmlwdGlvbicsIHNjb3BlOiBzY29wZTIgfV0sXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0MicsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbk1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudERlc2NyaXB0aW9uTWFwKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IGRlc2NyaXB0aW9uOiAnZXh0MiBnbG9iYWwgZGVzY3JpcHRpb24nIH1dLFxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHRbJ2V4dDMnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTMnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUHJlcGVuZCwgc2NvcGU6IHNjb3BlMiwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uTWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50RGVzY3JpcHRpb25NYXAoW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgZGVzY3JpcHRpb246ICdleHQzIHNjb3BlMiBkZXNjcmlwdGlvbicsIHNjb3BlOiBzY29wZTIgfV0sXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0NCcsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhNCcsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5tZXJnZWQuZ2V0RGVzY3JpcHRpb25NYXAoc2NvcGUxKS5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnZXh0MScsICdleHQxIHNjb3BlMSBkZXNjcmlwdGlvbiddLFxuXHRcdFx0XSk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLm1lcmdlZC5nZXREZXNjcmlwdGlvbk1hcCh1bmRlZmluZWQpLmVudHJpZXMoKV0sIFtcblx0XHRcdFx0WydleHQyJywgJ2V4dDIgZ2xvYmFsIGRlc2NyaXB0aW9uJ10sXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2FwcGx5VG9Qcm9jZXNzRW52aXJvbm1lbnQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIGFwcGx5IHRoZSBjb2xsZWN0aW9uIHRvIGFuIGVudmlyb25tZW50JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWVyZ2VkID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dCcsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0InLCB7IHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQicgfV0sXG5cdFx0XHRcdFx0XHRbJ0MnLCB7IHZhbHVlOiAnYycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YXJpYWJsZTogJ0MnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV1cblx0XHRcdF0pKTtcblx0XHRcdGNvbnN0IGVudjogSVByb2Nlc3NFbnZpcm9ubWVudCA9IHtcblx0XHRcdFx0QTogJ2ZvbycsXG5cdFx0XHRcdEI6ICdiYXInLFxuXHRcdFx0XHRDOiAnYmF6J1xuXHRcdFx0fTtcblx0XHRcdGF3YWl0IG1lcmdlZC5hcHBseVRvUHJvY2Vzc0Vudmlyb25tZW50KGVudiwgdW5kZWZpbmVkKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChlbnYsIHtcblx0XHRcdFx0QTogJ2EnLFxuXHRcdFx0XHRCOiAnYmFyYicsXG5cdFx0XHRcdEM6ICdjYmF6J1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgYXBwbHkgdGhlIGFwcHJvcHJpYXRlIHdvcmtzcGFjZSBzY29wZWQgZW50cmllcyB0byBhbiBlbnZpcm9ubWVudCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHNjb3BlMSA9IHsgd29ya3NwYWNlRm9sZGVyOiB7IHVyaTogVVJJLmZpbGUoJ3dvcmtzcGFjZTEnKSwgbmFtZTogJ3dvcmtzcGFjZTEnLCBpbmRleDogMCB9IH07XG5cdFx0XHRjb25zdCBzY29wZTIgPSB7IHdvcmtzcGFjZUZvbGRlcjogeyB1cmk6IFVSSS5maWxlKCd3b3Jrc3BhY2UyJyksIG5hbWU6ICd3b3Jrc3BhY2UyJywgaW5kZXg6IDMgfSB9O1xuXHRcdFx0Y29uc3QgbWVyZ2VkID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dCcsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHNjb3BlOiBzY29wZTEsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0InLCB7IHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHNjb3BlOiBzY29wZTIsIHZhcmlhYmxlOiAnQicgfV0sXG5cdFx0XHRcdFx0XHRbJ0MnLCB7IHZhbHVlOiAnYycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YXJpYWJsZTogJ0MnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV1cblx0XHRcdF0pKTtcblx0XHRcdGNvbnN0IGVudjogSVByb2Nlc3NFbnZpcm9ubWVudCA9IHtcblx0XHRcdFx0QTogJ2ZvbycsXG5cdFx0XHRcdEI6ICdiYXInLFxuXHRcdFx0XHRDOiAnYmF6J1xuXHRcdFx0fTtcblx0XHRcdGF3YWl0IG1lcmdlZC5hcHBseVRvUHJvY2Vzc0Vudmlyb25tZW50KGVudiwgc2NvcGUxKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChlbnYsIHtcblx0XHRcdFx0QTogJ2EnLFxuXHRcdFx0XHRCOiAnYmFyJywgLy8gVGhpcyBpcyBub3QgY2hhbmdlZCBiZWNhdXNlIHRoZSBzY29wZSBkb2VzIG5vdCBtYXRjaFxuXHRcdFx0XHRDOiAnY2Jheidcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGFwcGx5IHRoZSBjb2xsZWN0aW9uIHRvIGVudmlyb25tZW50IGVudHJpZXMgd2l0aCBubyB2YWx1ZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZWQgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0Jywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdBJyB9XSxcblx0XHRcdFx0XHRcdFsnQicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdCJyB9XSxcblx0XHRcdFx0XHRcdFsnQycsIHsgdmFsdWU6ICdjJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQycgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50ID0ge307XG5cdFx0XHRhd2FpdCBtZXJnZWQuYXBwbHlUb1Byb2Nlc3NFbnZpcm9ubWVudChlbnYsIHVuZGVmaW5lZCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZW52LCB7XG5cdFx0XHRcdEE6ICdhJyxcblx0XHRcdFx0QjogJ2InLFxuXHRcdFx0XHRDOiAnYydcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGFwcGx5IHRvIHZhcmlhYmxlIGNhc2UgaW5zZW5zaXRpdmVseSBvbiBXaW5kb3dzIG9ubHknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZWQgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0Jywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdhJyB9XSxcblx0XHRcdFx0XHRcdFsnYicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdiJyB9XSxcblx0XHRcdFx0XHRcdFsnYycsIHsgdmFsdWU6ICdjJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnYycgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZW52OiBJUHJvY2Vzc0Vudmlyb25tZW50ID0ge1xuXHRcdFx0XHRBOiAnQScsXG5cdFx0XHRcdEI6ICdCJyxcblx0XHRcdFx0QzogJ0MnXG5cdFx0XHR9O1xuXHRcdFx0YXdhaXQgbWVyZ2VkLmFwcGx5VG9Qcm9jZXNzRW52aXJvbm1lbnQoZW52LCB1bmRlZmluZWQpO1xuXHRcdFx0aWYgKGlzV2luZG93cykge1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoZW52LCB7XG5cdFx0XHRcdFx0QTogJ2EnLFxuXHRcdFx0XHRcdEI6ICdCYicsXG5cdFx0XHRcdFx0QzogJ2NDJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChlbnYsIHtcblx0XHRcdFx0XHRhOiAnYScsXG5cdFx0XHRcdFx0QTogJ0EnLFxuXHRcdFx0XHRcdGI6ICdiJyxcblx0XHRcdFx0XHRCOiAnQicsXG5cdFx0XHRcdFx0YzogJ2MnLFxuXHRcdFx0XHRcdEM6ICdDJ1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2RpZmYnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJldHVybiB1bmRlZmluZWQgd2hlbiBjb2xsZWN0aW5vcyBhcmUgdGhlIHNhbWUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZWQxID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV1cblx0XHRcdF0pKTtcblx0XHRcdGNvbnN0IG1lcmdlZDIgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQyLCB1bmRlZmluZWQpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZiwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdzaG91bGQgZ2VuZXJhdGUgYWRkZWQgZGlmZnMgZnJvbSB3aGVuIHRoZSBmaXJzdCBlbnRyeSBpcyBhZGRlZCcsICgpID0+IHtcblx0XHRcdGNvbnN0IG1lcmdlZDEgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkMiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dXG5cdFx0XHRdKSk7XG5cdFx0XHRjb25zdCBkaWZmID0gbWVyZ2VkMS5kaWZmKG1lcmdlZDIsIHVuZGVmaW5lZCkhO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZi5jaGFuZ2VkLnNpemUsIDApO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZi5yZW1vdmVkLnNpemUsIDApO1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IFsuLi5kaWZmLmFkZGVkLmVudHJpZXMoKV07XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZW50cmllcywgW1xuXHRcdFx0XHRbJ0EnLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHZhbHVlOiAnYScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB1bmRlZmluZWQgfV1dXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCBnZW5lcmF0ZSBhZGRlZCBkaWZmcyBmcm9tIHRoZSBzYW1lIGV4dGVuc2lvbicsICgpID0+IHtcblx0XHRcdGNvbnN0IG1lcmdlZDEgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkMiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdBJyB9XSxcblx0XHRcdFx0XHRcdFsnQicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdCJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dXG5cdFx0XHRdKSk7XG5cdFx0XHRjb25zdCBkaWZmID0gbWVyZ2VkMS5kaWZmKG1lcmdlZDIsIHVuZGVmaW5lZCkhO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZi5jaGFuZ2VkLnNpemUsIDApO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZi5yZW1vdmVkLnNpemUsIDApO1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IFsuLi5kaWZmLmFkZGVkLmVudHJpZXMoKV07XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoZW50cmllcywgW1xuXHRcdFx0XHRbJ0InLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQicsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGdlbmVyYXRlIGFkZGVkIGRpZmZzIGZyb20gYSBkaWZmZXJlbnQgZXh0ZW5zaW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWVyZ2VkMSA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2ExJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXG5cdFx0XHRjb25zdCBtZXJnZWQyID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDInLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV0sXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMScsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YXJpYWJsZTogJ0EnIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV1cblx0XHRcdF0pKTtcblx0XHRcdGNvbnN0IGRpZmYgPSBtZXJnZWQxLmRpZmYobWVyZ2VkMiwgdW5kZWZpbmVkKSE7XG5cdFx0XHRzdHJpY3RFcXVhbChkaWZmLmNoYW5nZWQuc2l6ZSwgMCk7XG5cdFx0XHRzdHJpY3RFcXVhbChkaWZmLnJlbW92ZWQuc2l6ZSwgMCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLmRpZmYuYWRkZWQuZW50cmllcygpXSwgW1xuXHRcdFx0XHRbJ0EnLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MicsIHZhbHVlOiAnYTInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuQXBwZW5kLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB1bmRlZmluZWQgfV1dXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgbWVyZ2VkMyA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2ExJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0Ly8gVGhpcyBlbnRyeSBzaG91bGQgZ2V0IHJlbW92ZWRcblx0XHRcdFx0WydleHQyJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdBJyB9XVxuXHRcdFx0XHRcdF0pXG5cdFx0XHRcdH1dXG5cdFx0XHRdKSk7XG5cdFx0XHRjb25zdCBkaWZmMiA9IG1lcmdlZDEuZGlmZihtZXJnZWQzLCB1bmRlZmluZWQpITtcblx0XHRcdHN0cmljdEVxdWFsKGRpZmYyLmNoYW5nZWQuc2l6ZSwgMCk7XG5cdFx0XHRzdHJpY3RFcXVhbChkaWZmMi5yZW1vdmVkLnNpemUsIDApO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5kaWZmLmFkZGVkLmVudHJpZXMoKV0sIFsuLi5kaWZmMi5hZGRlZC5lbnRyaWVzKCldLCAnU3dhcHBpbmcgdGhlIG9yZGVyIG9mIHRoZSBlbnRyaWVzIGluIHRoZSBvdGhlciBjb2xsZWN0aW9uIHNob3VsZCB5aWVsZCB0aGUgc2FtZSByZXN1bHQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCByZW1vdmUgZW50cmllcyBpbiB0aGUgZGlmZiB0aGF0IGNvbWUgYWZ0ZXIgYSBSZXBsYWNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgbWVyZ2VkMSA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2ExJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkNCA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2ExJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0Ly8gVGhpcyBlbnRyeSBzaG91bGQgZ2V0IHJlbW92ZWQgYXMgaXQgY29tZXMgYWZ0ZXIgYSByZXBsYWNlXG5cdFx0XHRcdFsnZXh0MicsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhMicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQ0LCB1bmRlZmluZWQpO1xuXHRcdFx0c3RyaWN0RXF1YWwoZGlmZiwgdW5kZWZpbmVkLCAnUmVwbGFjZSBzaG91bGQgaWdub3JlIGFueSBlbnRyaWVzIGFmdGVyIGl0Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgZ2VuZXJhdGUgcmVtb3ZlZCBkaWZmcycsICgpID0+IHtcblx0XHRcdGNvbnN0IG1lcmdlZDEgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0InLCB7IHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCB2YXJpYWJsZTogJ0InIH1dXG5cdFx0XHRcdFx0XSlcblx0XHRcdFx0fV1cblx0XHRcdF0pKTtcblx0XHRcdGNvbnN0IG1lcmdlZDIgPSBuZXcgTWVyZ2VkRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24obmV3IE1hcChbXG5cdFx0XHRcdFsnZXh0MScsIHtcblx0XHRcdFx0XHRtYXA6IGRlc2VyaWFsaXplRW52aXJvbm1lbnRWYXJpYWJsZUNvbGxlY3Rpb24oW1xuXHRcdFx0XHRcdFx0WydBLWtleScsIHsgdmFsdWU6ICdhJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQyLCB1bmRlZmluZWQpITtcblx0XHRcdHN0cmljdEVxdWFsKGRpZmYuY2hhbmdlZC5zaXplLCAwKTtcblx0XHRcdHN0cmljdEVxdWFsKGRpZmYuYWRkZWQuc2l6ZSwgMCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLmRpZmYucmVtb3ZlZC5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQicsIFt7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQxJywgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQicsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGdlbmVyYXRlIGNoYW5nZWQgZGlmZnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZWQxID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdBJyB9XSxcblx0XHRcdFx0XHRcdFsnQicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQicgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkMiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0InLCB7IHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQicgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQyLCB1bmRlZmluZWQpITtcblx0XHRcdHN0cmljdEVxdWFsKGRpZmYuYWRkZWQuc2l6ZSwgMCk7XG5cdFx0XHRzdHJpY3RFcXVhbChkaWZmLnJlbW92ZWQuc2l6ZSwgMCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLmRpZmYuY2hhbmdlZC5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQScsIFt7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQxJywgdmFsdWU6ICdhMicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5SZXBsYWNlLCB2YXJpYWJsZTogJ0EnLCBvcHRpb25zOiB1bmRlZmluZWQgfV1dLFxuXHRcdFx0XHRbJ0InLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQicsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGdlbmVyYXRlIGRpZmZzIHdpdGggYWRkZWQsIGNoYW5nZWQgYW5kIHJlbW92ZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZXJnZWQxID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgdmFyaWFibGU6ICdBJyB9XSxcblx0XHRcdFx0XHRcdFsnQicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQicgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkMiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0MnLCB7IHZhbHVlOiAnYycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHZhcmlhYmxlOiAnQycgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQyLCB1bmRlZmluZWQpITtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChbLi4uZGlmZi5hZGRlZC5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQycsIFt7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQxJywgdmFsdWU6ICdjJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLkFwcGVuZCwgdmFyaWFibGU6ICdDJywgb3B0aW9uczogdW5kZWZpbmVkIH1dXSxcblx0XHRcdF0pO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5kaWZmLnJlbW92ZWQuZW50cmllcygpXSwgW1xuXHRcdFx0XHRbJ0InLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHZhbHVlOiAnYicsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5QcmVwZW5kLCB2YXJpYWJsZTogJ0InLCBvcHRpb25zOiB1bmRlZmluZWQgfV1dXG5cdFx0XHRdKTtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChbLi4uZGlmZi5jaGFuZ2VkLmVudHJpZXMoKV0sIFtcblx0XHRcdFx0WydBJywgW3sgZXh0ZW5zaW9uSWRlbnRpZmllcjogJ2V4dDEnLCB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHZhcmlhYmxlOiAnQScsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XV1cblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG9ubHkgZ2VuZXJhdGUgd29ya3NwYWNlIHNwZWNpZmljIGRpZmZzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3Qgc2NvcGUxID0geyB3b3Jrc3BhY2VGb2xkZXI6IHsgdXJpOiBVUkkuZmlsZSgnd29ya3NwYWNlMScpLCBuYW1lOiAnd29ya3NwYWNlMScsIGluZGV4OiAwIH0gfTtcblx0XHRcdGNvbnN0IHNjb3BlMiA9IHsgd29ya3NwYWNlRm9sZGVyOiB7IHVyaTogVVJJLmZpbGUoJ3dvcmtzcGFjZTInKSwgbmFtZTogJ3dvcmtzcGFjZTInLCBpbmRleDogMyB9IH07XG5cdFx0XHRjb25zdCBtZXJnZWQxID0gbmV3IE1lcmdlZEVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKG5ldyBNYXAoW1xuXHRcdFx0XHRbJ2V4dDEnLCB7XG5cdFx0XHRcdFx0bWFwOiBkZXNlcmlhbGl6ZUVudmlyb25tZW50VmFyaWFibGVDb2xsZWN0aW9uKFtcblx0XHRcdFx0XHRcdFsnQS1rZXknLCB7IHZhbHVlOiAnYTEnLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgc2NvcGU6IHNjb3BlMSwgdmFyaWFibGU6ICdBJyB9XSxcblx0XHRcdFx0XHRcdFsnQicsIHsgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQicgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgbWVyZ2VkMiA9IG5ldyBNZXJnZWRFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihuZXcgTWFwKFtcblx0XHRcdFx0WydleHQxJywge1xuXHRcdFx0XHRcdG1hcDogZGVzZXJpYWxpemVFbnZpcm9ubWVudFZhcmlhYmxlQ29sbGVjdGlvbihbXG5cdFx0XHRcdFx0XHRbJ0Eta2V5JywgeyB2YWx1ZTogJ2EyJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlJlcGxhY2UsIHNjb3BlOiBzY29wZTEsIHZhcmlhYmxlOiAnQScgfV0sXG5cdFx0XHRcdFx0XHRbJ0MnLCB7IHZhbHVlOiAnYycsIHR5cGU6IEVudmlyb25tZW50VmFyaWFibGVNdXRhdG9yVHlwZS5BcHBlbmQsIHNjb3BlOiBzY29wZTIsIHZhcmlhYmxlOiAnQycgfV1cblx0XHRcdFx0XHRdKVxuXHRcdFx0XHR9XVxuXHRcdFx0XSkpO1xuXHRcdFx0Y29uc3QgZGlmZiA9IG1lcmdlZDEuZGlmZihtZXJnZWQyLCBzY29wZTEpITtcblx0XHRcdHN0cmljdEVxdWFsKGRpZmYuYWRkZWQuc2l6ZSwgMCk7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoWy4uLmRpZmYucmVtb3ZlZC5lbnRyaWVzKCldLCBbXG5cdFx0XHRcdFsnQicsIFt7IGV4dGVuc2lvbklkZW50aWZpZXI6ICdleHQxJywgdmFsdWU6ICdiJywgdHlwZTogRW52aXJvbm1lbnRWYXJpYWJsZU11dGF0b3JUeXBlLlByZXBlbmQsIHZhcmlhYmxlOiAnQicsIG9wdGlvbnM6IHVuZGVmaW5lZCB9XV1cblx0XHRcdF0pO1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFsuLi5kaWZmLmNoYW5nZWQuZW50cmllcygpXSwgW1xuXHRcdFx0XHRbJ0EnLCBbeyBleHRlbnNpb25JZGVudGlmaWVyOiAnZXh0MScsIHZhbHVlOiAnYTInLCB0eXBlOiBFbnZpcm9ubWVudFZhcmlhYmxlTXV0YXRvclR5cGUuUmVwbGFjZSwgc2NvcGU6IHNjb3BlMSwgdmFyaWFibGU6ICdBJywgb3B0aW9uczogdW5kZWZpbmVkIH1dXVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGlCQUFpQixtQkFBbUI7QUFDN0MsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBOEIsaUJBQWlCO0FBQy9DLFNBQVMsMkNBQTJDO0FBQ3BELFNBQVMsc0NBQXNDLGdEQUFnRDtBQUMvRixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSw2REFBNkQsTUFBTTtBQUN4RSwwQ0FBd0M7QUFFeEMsUUFBTSxRQUFRLE1BQU07QUFDbkIsU0FBSyx5RUFBeUUsTUFBTTtBQUNuRixZQUFNLFNBQVMsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQzlELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3ZGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3ZGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsUUFBUSxVQUFVLEtBQUssU0FBUyxFQUFFLHdCQUF3QixNQUFNLHlCQUF5QixLQUFLLEVBQUUsQ0FBQztBQUFBLFVBQ2hLLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLHNCQUFnQixDQUFDLEdBQUcsT0FBTyxlQUFlLE1BQVMsRUFBRSxRQUFRLENBQUMsR0FBRztBQUFBLFFBQ2hFLENBQUMsS0FBSztBQUFBLFVBQ0wsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixRQUFRLE9BQU8sTUFBTSxVQUFVLEtBQUssU0FBUyxFQUFFLHdCQUF3QixNQUFNLHlCQUF5QixLQUFLLEVBQUU7QUFBQSxVQUNqTCxFQUFFLHFCQUFxQixRQUFRLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxNQUFNLFVBQVUsS0FBSyxTQUFTLE9BQVU7QUFBQSxVQUM1SCxFQUFFLHFCQUFxQixRQUFRLE1BQU0sK0JBQStCLFFBQVEsT0FBTyxNQUFNLFVBQVUsS0FBSyxTQUFTLE9BQVU7QUFBQSxVQUMzSCxFQUFFLHFCQUFxQixRQUFRLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxNQUFNLFVBQVUsS0FBSyxTQUFTLE9BQVU7QUFBQSxRQUM3SCxDQUFDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxnRUFBZ0UsTUFBTTtBQUMxRSxZQUFNLFNBQVMsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQzlELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3ZGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3ZGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLHNCQUFnQixDQUFDLEdBQUcsT0FBTyxlQUFlLE1BQVMsRUFBRSxRQUFRLENBQUMsR0FBRztBQUFBLFFBQ2hFLENBQUMsS0FBSztBQUFBLFVBQ0wsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixTQUFTLE9BQU8sTUFBTSxVQUFVLEtBQUssU0FBUyxPQUFVO0FBQUEsVUFDNUgsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixRQUFRLE9BQU8sTUFBTSxVQUFVLEtBQUssU0FBUyxPQUFVO0FBQUEsVUFDM0gsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixTQUFTLE9BQU8sTUFBTSxVQUFVLEtBQUssU0FBUyxPQUFVO0FBQUEsUUFDN0gsQ0FBQztBQUFBLE1BQ0YsR0FBRyw4REFBOEQ7QUFBQSxJQUNsRSxDQUFDO0FBRUQsU0FBSyxxR0FBcUcsTUFBTTtBQUMvRyxZQUFNLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLElBQUksS0FBSyxZQUFZLEdBQUcsTUFBTSxjQUFjLE9BQU8sRUFBRSxFQUFFO0FBQ2hHLFlBQU0sU0FBUyxFQUFFLGlCQUFpQixFQUFFLEtBQUssSUFBSSxLQUFLLFlBQVksR0FBRyxNQUFNLGNBQWMsT0FBTyxFQUFFLEVBQUU7QUFDaEcsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEcsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLE9BQU8sUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RHLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxRQUNELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLHNCQUFnQixDQUFDLEdBQUcsT0FBTyxlQUFlLE1BQU0sRUFBRSxRQUFRLENBQUMsR0FBRztBQUFBLFFBQzdELENBQUMsS0FBSztBQUFBLFVBQ0wsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixRQUFRLE9BQU8sTUFBTSxVQUFVLEtBQUssU0FBUyxPQUFVO0FBQUEsVUFDM0gsRUFBRSxxQkFBcUIsUUFBUSxNQUFNLCtCQUErQixTQUFTLE9BQU8sTUFBTSxPQUFPLFFBQVEsVUFBVSxLQUFLLFNBQVMsT0FBVTtBQUFBLFVBQzNJLEVBQUUscUJBQXFCLFFBQVEsTUFBTSwrQkFBK0IsUUFBUSxPQUFPLE1BQU0sVUFBVSxLQUFLLFNBQVMsT0FBVTtBQUFBLFFBQzVILENBQUM7QUFBQSxNQUNGLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLDZFQUE2RSxNQUFNO0FBQ3ZGLFlBQU0sU0FBUyxFQUFFLGlCQUFpQixFQUFFLEtBQUssSUFBSSxLQUFLLFlBQVksR0FBRyxNQUFNLGNBQWMsT0FBTyxFQUFFLEVBQUU7QUFDaEcsWUFBTSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxJQUFJLEtBQUssWUFBWSxHQUFHLE1BQU0sY0FBYyxPQUFPLEVBQUUsRUFBRTtBQUNoRyxZQUFNLFNBQVMsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQzlELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxPQUFPLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RyxDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsUUFDRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsUUFDRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEcsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0Ysc0JBQWdCLENBQUMsR0FBRyxPQUFPLGVBQWUsTUFBUyxFQUFFLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDaEUsQ0FBQyxLQUFLO0FBQUEsVUFDTCxFQUFFLHFCQUFxQixRQUFRLE1BQU0sK0JBQStCLFFBQVEsT0FBTyxNQUFNLFVBQVUsS0FBSyxTQUFTLE9BQVU7QUFBQSxVQUMzSCxFQUFFLHFCQUFxQixRQUFRLE1BQU0sK0JBQStCLFFBQVEsT0FBTyxNQUFNLFVBQVUsS0FBSyxTQUFTLE9BQVU7QUFBQSxRQUM1SCxDQUFDO0FBQUEsTUFDRixDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxpRkFBaUYsTUFBTTtBQUMzRixZQUFNLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLElBQUksS0FBSyxZQUFZLEdBQUcsTUFBTSxjQUFjLE9BQU8sRUFBRSxFQUFFO0FBQ2hHLFlBQU0sU0FBUyxFQUFFLGlCQUFpQixFQUFFLEtBQUssSUFBSSxLQUFLLFlBQVksR0FBRyxNQUFNLGNBQWMsT0FBTyxFQUFFLEVBQUU7QUFDaEcsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEcsQ0FBQztBQUFBLFVBQ0QsZ0JBQWdCLHFDQUFxQztBQUFBLFlBQ3BELENBQUMsZ0JBQWdCLEVBQUUsYUFBYSwyQkFBMkIsT0FBTyxPQUFPLENBQUM7QUFBQSxZQUMxRSxDQUFDLGdCQUFnQixFQUFFLGFBQWEsMkJBQTJCLE9BQU8sT0FBTyxDQUFDO0FBQUEsVUFDM0UsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFVBQ0QsZ0JBQWdCLHFDQUFxQztBQUFBLFlBQ3BELENBQUMsU0FBUyxFQUFFLGFBQWEsMEJBQTBCLENBQUM7QUFBQSxVQUNyRCxDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsUUFDRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEcsQ0FBQztBQUFBLFVBQ0QsZ0JBQWdCLHFDQUFxQztBQUFBLFlBQ3BELENBQUMsU0FBUyxFQUFFLGFBQWEsMkJBQTJCLE9BQU8sT0FBTyxDQUFDO0FBQUEsVUFDcEUsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLFFBQ0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0Ysc0JBQWdCLENBQUMsR0FBRyxPQUFPLGtCQUFrQixNQUFNLEVBQUUsUUFBUSxDQUFDLEdBQUc7QUFBQSxRQUNoRSxDQUFDLFFBQVEseUJBQXlCO0FBQUEsTUFDbkMsQ0FBQztBQUNELHNCQUFnQixDQUFDLEdBQUcsT0FBTyxrQkFBa0IsTUFBUyxFQUFFLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDbkUsQ0FBQyxRQUFRLHlCQUF5QjtBQUFBLE1BQ25DLENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxRQUFNLDZCQUE2QixNQUFNO0FBQ3hDLFNBQUssaURBQWlELFlBQVk7QUFDakUsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLE9BQU87QUFBQSxVQUNQLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxZQUNyRixDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ2hGLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDbEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxNQUEyQjtBQUFBLFFBQ2hDLEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQSxNQUNKO0FBQ0EsWUFBTSxPQUFPLDBCQUEwQixLQUFLLE1BQVM7QUFDckQsc0JBQWdCLEtBQUs7QUFBQSxRQUNwQixHQUFHO0FBQUEsUUFDSCxHQUFHO0FBQUEsUUFDSCxHQUFHO0FBQUEsTUFDSixDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSywyRUFBMkUsWUFBWTtBQUMzRixZQUFNLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLElBQUksS0FBSyxZQUFZLEdBQUcsTUFBTSxjQUFjLE9BQU8sRUFBRSxFQUFFO0FBQ2hHLFlBQU0sU0FBUyxFQUFFLGlCQUFpQixFQUFFLEtBQUssSUFBSSxLQUFLLFlBQVksR0FBRyxNQUFNLGNBQWMsT0FBTyxFQUFFLEVBQUU7QUFDaEcsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLE9BQU87QUFBQSxVQUNQLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsWUFDcEcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFFBQVEsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsWUFDL0YsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUNsRixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLE1BQTJCO0FBQUEsUUFDaEMsR0FBRztBQUFBLFFBQ0gsR0FBRztBQUFBLFFBQ0gsR0FBRztBQUFBLE1BQ0o7QUFDQSxZQUFNLE9BQU8sMEJBQTBCLEtBQUssTUFBTTtBQUNsRCxzQkFBZ0IsS0FBSztBQUFBLFFBQ3BCLEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQTtBQUFBLFFBQ0gsR0FBRztBQUFBLE1BQ0osQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUsscUVBQXFFLFlBQVk7QUFDckYsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLE9BQU87QUFBQSxVQUNQLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxZQUNyRixDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ2hGLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDbEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxNQUEyQixDQUFDO0FBQ2xDLFlBQU0sT0FBTywwQkFBMEIsS0FBSyxNQUFTO0FBQ3JELHNCQUFnQixLQUFLO0FBQUEsUUFDcEIsR0FBRztBQUFBLFFBQ0gsR0FBRztBQUFBLFFBQ0gsR0FBRztBQUFBLE1BQ0osQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssK0RBQStELFlBQVk7QUFDL0UsWUFBTSxTQUFTLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUM5RCxDQUFDLE9BQU87QUFBQSxVQUNQLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxZQUNyRixDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ2hGLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDbEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxNQUEyQjtBQUFBLFFBQ2hDLEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQSxRQUNILEdBQUc7QUFBQSxNQUNKO0FBQ0EsWUFBTSxPQUFPLDBCQUEwQixLQUFLLE1BQVM7QUFDckQsVUFBSSxXQUFXO0FBQ2Qsd0JBQWdCLEtBQUs7QUFBQSxVQUNwQixHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsUUFDSixDQUFDO0FBQUEsTUFDRixPQUFPO0FBQ04sd0JBQWdCLEtBQUs7QUFBQSxVQUNwQixHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsVUFDSCxHQUFHO0FBQUEsUUFDSixDQUFDO0FBQUEsTUFDRjtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0sUUFBUSxNQUFNO0FBQ25CLFNBQUsseURBQXlELE1BQU07QUFDbkUsWUFBTSxVQUFVLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUMvRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLFVBQVUsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQy9ELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLFlBQU0sT0FBTyxRQUFRLEtBQUssU0FBUyxNQUFTO0FBQzVDLGtCQUFZLE1BQU0sTUFBUztBQUFBLElBQzVCLENBQUM7QUFDRCxTQUFLLGtFQUFrRSxNQUFNO0FBQzVFLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ25FLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxPQUFPLFFBQVEsS0FBSyxTQUFTLE1BQVM7QUFDNUMsa0JBQVksS0FBSyxRQUFRLE1BQU0sQ0FBQztBQUNoQyxrQkFBWSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ2hDLFlBQU0sVUFBVSxDQUFDLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQztBQUN4QyxzQkFBZ0IsU0FBUztBQUFBLFFBQ3hCLENBQUMsS0FBSyxDQUFDLEVBQUUscUJBQXFCLFFBQVEsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxLQUFLLFNBQVMsT0FBVSxDQUFDLENBQUM7QUFBQSxNQUNySSxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyx1REFBdUQsTUFBTTtBQUNqRSxZQUFNLFVBQVUsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQy9ELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3RGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsWUFDckYsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUNqRixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLE9BQU8sUUFBUSxLQUFLLFNBQVMsTUFBUztBQUM1QyxrQkFBWSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ2hDLGtCQUFZLEtBQUssUUFBUSxNQUFNLENBQUM7QUFDaEMsWUFBTSxVQUFVLENBQUMsR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDO0FBQ3hDLHNCQUFnQixTQUFTO0FBQUEsUUFDeEIsQ0FBQyxLQUFLLENBQUMsRUFBRSxxQkFBcUIsUUFBUSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLEtBQUssU0FBUyxPQUFVLENBQUMsQ0FBQztBQUFBLE1BQ3BJLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLDBEQUEwRCxNQUFNO0FBQ3BFLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdkYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBRUYsWUFBTSxVQUFVLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUMvRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsUUFDRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN2RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLE9BQU8sUUFBUSxLQUFLLFNBQVMsTUFBUztBQUM1QyxrQkFBWSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ2hDLGtCQUFZLEtBQUssUUFBUSxNQUFNLENBQUM7QUFDaEMsc0JBQWdCLENBQUMsR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDLEdBQUc7QUFBQSxRQUMxQyxDQUFDLEtBQUssQ0FBQyxFQUFFLHFCQUFxQixRQUFRLE9BQU8sTUFBTSxNQUFNLCtCQUErQixRQUFRLFVBQVUsS0FBSyxTQUFTLE9BQVUsQ0FBQyxDQUFDO0FBQUEsTUFDckksQ0FBQztBQUVELFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdkYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBO0FBQUEsUUFFRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLFFBQVEsUUFBUSxLQUFLLFNBQVMsTUFBUztBQUM3QyxrQkFBWSxNQUFNLFFBQVEsTUFBTSxDQUFDO0FBQ2pDLGtCQUFZLE1BQU0sUUFBUSxNQUFNLENBQUM7QUFDakMsc0JBQWdCLENBQUMsR0FBRyxLQUFLLE1BQU0sUUFBUSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sTUFBTSxRQUFRLENBQUMsR0FBRyx3RkFBd0Y7QUFBQSxJQUNoSyxDQUFDO0FBRUQsU0FBSywrREFBK0QsTUFBTTtBQUN6RSxZQUFNLFVBQVUsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQy9ELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ3ZGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdkYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBO0FBQUEsUUFFRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUN0RixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLE9BQU8sUUFBUSxLQUFLLFNBQVMsTUFBUztBQUM1QyxrQkFBWSxNQUFNLFFBQVcsNENBQTRDO0FBQUEsSUFDMUUsQ0FBQztBQUVELFNBQUssaUNBQWlDLE1BQU07QUFDM0MsWUFBTSxVQUFVLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUMvRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxZQUNyRixDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ2xGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDdEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxPQUFPLFFBQVEsS0FBSyxTQUFTLE1BQVM7QUFDNUMsa0JBQVksS0FBSyxRQUFRLE1BQU0sQ0FBQztBQUNoQyxrQkFBWSxLQUFLLE1BQU0sTUFBTSxDQUFDO0FBQzlCLHNCQUFnQixDQUFDLEdBQUcsS0FBSyxRQUFRLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDNUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxxQkFBcUIsUUFBUSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsU0FBUyxVQUFVLEtBQUssU0FBUyxPQUFVLENBQUMsQ0FBQztBQUFBLE1BQ3JJLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLGlDQUFpQyxNQUFNO0FBQzNDLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsWUFDdEYsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxVQUNsRixDQUFDO0FBQUEsUUFDRixDQUFDO0FBQUEsTUFDRixDQUFDLENBQUM7QUFDRixZQUFNLFVBQVUsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQy9ELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ3RGLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDakYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxPQUFPLFFBQVEsS0FBSyxTQUFTLE1BQVM7QUFDNUMsa0JBQVksS0FBSyxNQUFNLE1BQU0sQ0FBQztBQUM5QixrQkFBWSxLQUFLLFFBQVEsTUFBTSxDQUFDO0FBQ2hDLHNCQUFnQixDQUFDLEdBQUcsS0FBSyxRQUFRLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDNUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxxQkFBcUIsUUFBUSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLEtBQUssU0FBUyxPQUFVLENBQUMsQ0FBQztBQUFBLFFBQ3JJLENBQUMsS0FBSyxDQUFDLEVBQUUscUJBQXFCLFFBQVEsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFFBQVEsVUFBVSxLQUFLLFNBQVMsT0FBVSxDQUFDLENBQUM7QUFBQSxNQUNwSSxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyx5REFBeUQsTUFBTTtBQUNuRSxZQUFNLFVBQVUsSUFBSSxvQ0FBb0Msb0JBQUksSUFBSTtBQUFBLFFBQy9ELENBQUMsUUFBUTtBQUFBLFVBQ1IsS0FBSyx5Q0FBeUM7QUFBQSxZQUM3QyxDQUFDLFNBQVMsRUFBRSxPQUFPLE1BQU0sTUFBTSwrQkFBK0IsU0FBUyxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ3RGLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDbEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxVQUFVLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUMvRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxJQUFJLENBQUM7QUFBQSxZQUN0RixDQUFDLEtBQUssRUFBRSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFVBQ2pGLENBQUM7QUFBQSxRQUNGLENBQUM7QUFBQSxNQUNGLENBQUMsQ0FBQztBQUNGLFlBQU0sT0FBTyxRQUFRLEtBQUssU0FBUyxNQUFTO0FBQzVDLHNCQUFnQixDQUFDLEdBQUcsS0FBSyxNQUFNLFFBQVEsQ0FBQyxHQUFHO0FBQUEsUUFDMUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxxQkFBcUIsUUFBUSxPQUFPLEtBQUssTUFBTSwrQkFBK0IsUUFBUSxVQUFVLEtBQUssU0FBUyxPQUFVLENBQUMsQ0FBQztBQUFBLE1BQ3BJLENBQUM7QUFDRCxzQkFBZ0IsQ0FBQyxHQUFHLEtBQUssUUFBUSxRQUFRLENBQUMsR0FBRztBQUFBLFFBQzVDLENBQUMsS0FBSyxDQUFDLEVBQUUscUJBQXFCLFFBQVEsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxLQUFLLFNBQVMsT0FBVSxDQUFDLENBQUM7QUFBQSxNQUNySSxDQUFDO0FBQ0Qsc0JBQWdCLENBQUMsR0FBRyxLQUFLLFFBQVEsUUFBUSxDQUFDLEdBQUc7QUFBQSxRQUM1QyxDQUFDLEtBQUssQ0FBQyxFQUFFLHFCQUFxQixRQUFRLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLFVBQVUsS0FBSyxTQUFTLE9BQVUsQ0FBQyxDQUFDO0FBQUEsTUFDdEksQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssaURBQWlELE1BQU07QUFDM0QsWUFBTSxTQUFTLEVBQUUsaUJBQWlCLEVBQUUsS0FBSyxJQUFJLEtBQUssWUFBWSxHQUFHLE1BQU0sY0FBYyxPQUFPLEVBQUUsRUFBRTtBQUNoRyxZQUFNLFNBQVMsRUFBRSxpQkFBaUIsRUFBRSxLQUFLLElBQUksS0FBSyxZQUFZLEdBQUcsTUFBTSxjQUFjLE9BQU8sRUFBRSxFQUFFO0FBQ2hHLFlBQU0sVUFBVSxJQUFJLG9DQUFvQyxvQkFBSSxJQUFJO0FBQUEsUUFDL0QsQ0FBQyxRQUFRO0FBQUEsVUFDUixLQUFLLHlDQUF5QztBQUFBLFlBQzdDLENBQUMsU0FBUyxFQUFFLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLE9BQU8sUUFBUSxVQUFVLElBQUksQ0FBQztBQUFBLFlBQ3JHLENBQUMsS0FBSyxFQUFFLE9BQU8sS0FBSyxNQUFNLCtCQUErQixTQUFTLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDbEYsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxVQUFVLElBQUksb0NBQW9DLG9CQUFJLElBQUk7QUFBQSxRQUMvRCxDQUFDLFFBQVE7QUFBQSxVQUNSLEtBQUsseUNBQXlDO0FBQUEsWUFDN0MsQ0FBQyxTQUFTLEVBQUUsT0FBTyxNQUFNLE1BQU0sK0JBQStCLFNBQVMsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsWUFDckcsQ0FBQyxLQUFLLEVBQUUsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFFBQVEsT0FBTyxRQUFRLFVBQVUsSUFBSSxDQUFDO0FBQUEsVUFDaEcsQ0FBQztBQUFBLFFBQ0YsQ0FBQztBQUFBLE1BQ0YsQ0FBQyxDQUFDO0FBQ0YsWUFBTSxPQUFPLFFBQVEsS0FBSyxTQUFTLE1BQU07QUFDekMsa0JBQVksS0FBSyxNQUFNLE1BQU0sQ0FBQztBQUM5QixzQkFBZ0IsQ0FBQyxHQUFHLEtBQUssUUFBUSxRQUFRLENBQUMsR0FBRztBQUFBLFFBQzVDLENBQUMsS0FBSyxDQUFDLEVBQUUscUJBQXFCLFFBQVEsT0FBTyxLQUFLLE1BQU0sK0JBQStCLFNBQVMsVUFBVSxLQUFLLFNBQVMsT0FBVSxDQUFDLENBQUM7QUFBQSxNQUNySSxDQUFDO0FBQ0Qsc0JBQWdCLENBQUMsR0FBRyxLQUFLLFFBQVEsUUFBUSxDQUFDLEdBQUc7QUFBQSxRQUM1QyxDQUFDLEtBQUssQ0FBQyxFQUFFLHFCQUFxQixRQUFRLE9BQU8sTUFBTSxNQUFNLCtCQUErQixTQUFTLE9BQU8sUUFBUSxVQUFVLEtBQUssU0FBUyxPQUFVLENBQUMsQ0FBQztBQUFBLE1BQ3JKLENBQUM7QUFBQSxJQUNGLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
