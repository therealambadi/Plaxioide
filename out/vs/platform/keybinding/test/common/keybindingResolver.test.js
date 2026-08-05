import assert from "assert";
import { decodeKeybinding, createSimpleKeybinding } from "../../../../base/common/keybindings.js";
import { KeyChord, KeyCode, KeyMod } from "../../../../base/common/keyCodes.js";
import { OS } from "../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ContextKeyExpr } from "../../../contextkey/common/contextkey.js";
import { KeybindingResolver, ResultKind } from "../../common/keybindingResolver.js";
import { ResolvedKeybindingItem } from "../../common/resolvedKeybindingItem.js";
import { USLayoutResolvedKeybinding } from "../../common/usLayoutResolvedKeybinding.js";
import { createUSLayoutResolvedKeybinding } from "./keybindingsTestUtils.js";
function createContext(ctx) {
  return {
    getValue: (key) => {
      return ctx[key];
    }
  };
}
suite("KeybindingResolver", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function kbItem(keybinding, command, commandArgs, when, isDefault) {
    const resolvedKeybinding = createUSLayoutResolvedKeybinding(keybinding, OS);
    return new ResolvedKeybindingItem(
      resolvedKeybinding,
      command,
      commandArgs,
      when,
      isDefault,
      null,
      false
    );
  }
  function getDispatchStr(chord) {
    return USLayoutResolvedKeybinding.getDispatchStr(chord);
  }
  test("resolve key", () => {
    const keybinding = KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ;
    const runtimeKeybinding = createSimpleKeybinding(keybinding, OS);
    const contextRules = ContextKeyExpr.equals("bar", "baz");
    const keybindingItem = kbItem(keybinding, "yes", null, contextRules, true);
    assert.strictEqual(contextRules.evaluate(createContext({ bar: "baz" })), true);
    assert.strictEqual(contextRules.evaluate(createContext({ bar: "bz" })), false);
    const resolver = new KeybindingResolver([keybindingItem], [], () => {
    });
    const r1 = resolver.resolve(createContext({ bar: "baz" }), [], getDispatchStr(runtimeKeybinding));
    assert.ok(r1.kind === ResultKind.KbFound);
    assert.strictEqual(r1.commandId, "yes");
    const r2 = resolver.resolve(createContext({ bar: "bz" }), [], getDispatchStr(runtimeKeybinding));
    assert.strictEqual(r2.kind, ResultKind.NoMatchingKb);
  });
  test("resolve key with arguments", () => {
    const commandArgs = { text: "no" };
    const keybinding = KeyMod.CtrlCmd | KeyMod.Shift | KeyCode.KeyZ;
    const runtimeKeybinding = createSimpleKeybinding(keybinding, OS);
    const contextRules = ContextKeyExpr.equals("bar", "baz");
    const keybindingItem = kbItem(keybinding, "yes", commandArgs, contextRules, true);
    const resolver = new KeybindingResolver([keybindingItem], [], () => {
    });
    const r = resolver.resolve(createContext({ bar: "baz" }), [], getDispatchStr(runtimeKeybinding));
    assert.ok(r.kind === ResultKind.KbFound);
    assert.strictEqual(r.commandArgs, commandArgs);
  });
  suite("handle keybinding removals", () => {
    test("simple 1", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), false)
      ]);
    });
    test("simple 2", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyC, "yes3", null, ContextKeyExpr.equals("3", "c"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true),
        kbItem(KeyCode.KeyC, "yes3", null, ContextKeyExpr.equals("3", "c"), false)
      ]);
    });
    test("removal with not matching when", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-yes1", null, ContextKeyExpr.equals("1", "b"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("removal with not matching keybinding", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyB, "-yes1", null, ContextKeyExpr.equals("1", "a"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("removal with matching keybinding and when", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-yes1", null, ContextKeyExpr.equals("1", "a"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("removal with unspecified keybinding", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(0, "-yes1", null, ContextKeyExpr.equals("1", "a"), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("removal with unspecified when", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-yes1", null, void 0, false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("removal with unspecified when and unspecified keybinding", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(0, "-yes1", null, void 0, false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("issue #138997 - removal in default list", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "yes1", null, void 0, true),
        kbItem(KeyCode.KeyB, "yes2", null, void 0, true),
        kbItem(0, "-yes1", null, void 0, false)
      ];
      const overrides = [];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, void 0, true)
      ]);
    });
    test("issue #612#issuecomment-222109084 cannot remove keybindings for commands with ^", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "^yes1", null, ContextKeyExpr.equals("1", "a"), true),
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-yes1", null, void 0, false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyB, "yes2", null, ContextKeyExpr.equals("2", "b"), true)
      ]);
    });
    test("issue #140884 Unable to reassign F1 as keybinding for Show All Commands", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "command1", null, void 0, true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-command1", null, void 0, false),
        kbItem(KeyCode.KeyA, "command1", null, void 0, false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "command1", null, void 0, false)
      ]);
    });
    test("issue #141638: Keyboard Shortcuts: Change When Expression might actually remove keybinding in Insiders", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "command1", null, void 0, true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "command1", null, ContextKeyExpr.equals("a", "1"), false),
        kbItem(KeyCode.KeyA, "-command1", null, void 0, false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, [
        kbItem(KeyCode.KeyA, "command1", null, ContextKeyExpr.equals("a", "1"), false)
      ]);
    });
    test("issue #157751: Auto-quoting of context keys prevents removal of keybindings via UI", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "command1", null, ContextKeyExpr.deserialize(`editorTextFocus && activeEditor != workbench.editor.notebook && editorLangId in julia.supportedLanguageIds`), true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-command1", null, ContextKeyExpr.deserialize(`editorTextFocus && activeEditor != 'workbench.editor.notebook' && editorLangId in 'julia.supportedLanguageIds'`), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, []);
    });
    test("issue #160604: Remove keybindings with when clause does not work", () => {
      const defaults = [
        kbItem(KeyCode.KeyA, "command1", null, void 0, true)
      ];
      const overrides = [
        kbItem(KeyCode.KeyA, "-command1", null, ContextKeyExpr.true(), false)
      ];
      const actual = KeybindingResolver.handleRemovals([...defaults, ...overrides]);
      assert.deepStrictEqual(actual, []);
    });
    test("contextIsEntirelyIncluded", () => {
      const toContextKeyExpression = (expr) => {
        if (typeof expr === "string" || !expr) {
          return ContextKeyExpr.deserialize(expr);
        }
        return expr;
      };
      const assertIsIncluded = (a, b) => {
        assert.strictEqual(KeybindingResolver.whenIsEntirelyIncluded(toContextKeyExpression(a), toContextKeyExpression(b)), true);
      };
      const assertIsNotIncluded = (a, b) => {
        assert.strictEqual(KeybindingResolver.whenIsEntirelyIncluded(toContextKeyExpression(a), toContextKeyExpression(b)), false);
      };
      assertIsIncluded(null, null);
      assertIsIncluded(null, ContextKeyExpr.true());
      assertIsIncluded(ContextKeyExpr.true(), null);
      assertIsIncluded(ContextKeyExpr.true(), ContextKeyExpr.true());
      assertIsIncluded("key1", null);
      assertIsIncluded("key1", "");
      assertIsIncluded("key1", "key1");
      assertIsIncluded("key1", ContextKeyExpr.true());
      assertIsIncluded("!key1", "");
      assertIsIncluded("!key1", "!key1");
      assertIsIncluded("key2", "");
      assertIsIncluded("key2", "key2");
      assertIsIncluded("key1 && key1 && key2 && key2", "key2");
      assertIsIncluded("key1 && key2", "key2");
      assertIsIncluded("key1 && key2", "key1");
      assertIsIncluded("key1 && key2", "");
      assertIsIncluded("key1", "key1 || key2");
      assertIsIncluded("key1 || !key1", "key2 || !key2");
      assertIsIncluded("key1", "key1 || key2 && key3");
      assertIsNotIncluded("key1", "!key1");
      assertIsNotIncluded("!key1", "key1");
      assertIsNotIncluded("key1 && key2", "key3");
      assertIsNotIncluded("key1 && key2", "key4");
      assertIsNotIncluded("key1", "key2");
      assertIsNotIncluded("key1 || key2", "key2");
      assertIsNotIncluded("", "key2");
      assertIsNotIncluded(null, "key2");
    });
  });
  suite("resolve command", () => {
    function _kbItem(keybinding, command, when) {
      return kbItem(keybinding, command, null, when, true);
    }
    const items = [
      // This one will never match because its "when" is always overwritten by another one
      _kbItem(
        KeyCode.KeyX,
        "first",
        ContextKeyExpr.and(
          ContextKeyExpr.equals("key1", true),
          ContextKeyExpr.notEquals("key2", false)
        )
      ),
      // This one always overwrites first
      _kbItem(
        KeyCode.KeyX,
        "second",
        ContextKeyExpr.equals("key2", true)
      ),
      // This one is a secondary mapping for `second`
      _kbItem(
        KeyCode.KeyZ,
        "second",
        void 0
      ),
      // This one sometimes overwrites first
      _kbItem(
        KeyCode.KeyX,
        "third",
        ContextKeyExpr.equals("key3", true)
      ),
      // This one is always overwritten by another one
      _kbItem(
        KeyMod.CtrlCmd | KeyCode.KeyY,
        "fourth",
        ContextKeyExpr.equals("key4", true)
      ),
      // This one overwrites with a chord the previous one
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyY, KeyCode.KeyZ),
        "fifth",
        void 0
      ),
      // This one has no keybinding
      _kbItem(
        0,
        "sixth",
        void 0
      ),
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyU),
        "seventh",
        void 0
      ),
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyK),
        "seventh",
        void 0
      ),
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyU),
        "uncomment lines",
        void 0
      ),
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyC),
        // cmd+k cmd+c
        "comment lines",
        void 0
      ),
      _kbItem(
        KeyChord(KeyMod.CtrlCmd | KeyCode.KeyG, KeyMod.CtrlCmd | KeyCode.KeyC),
        // cmd+g cmd+c
        "unreachablechord",
        void 0
      ),
      _kbItem(
        KeyMod.CtrlCmd | KeyCode.KeyG,
        // cmd+g
        "eleven",
        void 0
      ),
      _kbItem(
        [KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyA, KeyCode.KeyB],
        // cmd+k a b
        "long multi chord",
        void 0
      ),
      _kbItem(
        [KeyMod.CtrlCmd | KeyCode.KeyB, KeyMod.CtrlCmd | KeyCode.KeyC],
        // cmd+b cmd+c
        "shadowed by long-multi-chord-2",
        void 0
      ),
      _kbItem(
        [KeyMod.CtrlCmd | KeyCode.KeyB, KeyMod.CtrlCmd | KeyCode.KeyC, KeyCode.KeyI],
        // cmd+b cmd+c i
        "long-multi-chord-2",
        void 0
      )
    ];
    const resolver = new KeybindingResolver(items, [], () => {
    });
    const testKbLookupByCommand = (commandId, expectedKeys) => {
      const lookupResult = resolver.lookupKeybindings(commandId);
      assert.strictEqual(lookupResult.length, expectedKeys.length, "Length mismatch @ commandId " + commandId);
      for (let i = 0, len = lookupResult.length; i < len; i++) {
        const expected = createUSLayoutResolvedKeybinding(expectedKeys[i], OS);
        assert.strictEqual(lookupResult[i].resolvedKeybinding.getUserSettingsLabel(), expected.getUserSettingsLabel(), "value mismatch @ commandId " + commandId);
      }
    };
    const testResolve = (ctx, _expectedKey, commandId) => {
      const expectedKeybinding = decodeKeybinding(_expectedKey, OS);
      const previousChord = [];
      for (let i = 0, len = expectedKeybinding.chords.length; i < len; i++) {
        const chord = getDispatchStr(expectedKeybinding.chords[i]);
        const result = resolver.resolve(ctx, previousChord, chord);
        if (i === len - 1) {
          assert.ok(result.kind === ResultKind.KbFound, `Enters multi chord for ${commandId} at chord ${i}`);
          assert.strictEqual(result.commandId, commandId, `Enters multi chord for ${commandId} at chord ${i}`);
        } else if (i > 0) {
          assert.ok(result.kind === ResultKind.MoreChordsNeeded, `Continues multi chord for ${commandId} at chord ${i}`);
        } else {
          assert.ok(result.kind === ResultKind.MoreChordsNeeded, `Enters multi chord for ${commandId} at chord ${i}`);
        }
        previousChord.push(chord);
      }
    };
    test("resolve command - 1", () => {
      testKbLookupByCommand("first", []);
    });
    test("resolve command - 2", () => {
      testKbLookupByCommand("second", [KeyCode.KeyZ, KeyCode.KeyX]);
      testResolve(createContext({ key2: true }), KeyCode.KeyX, "second");
      testResolve(createContext({}), KeyCode.KeyZ, "second");
    });
    test("resolve command - 3", () => {
      testKbLookupByCommand("third", [KeyCode.KeyX]);
      testResolve(createContext({ key3: true }), KeyCode.KeyX, "third");
    });
    test("resolve command - 4", () => {
      testKbLookupByCommand("fourth", []);
    });
    test("resolve command - 5", () => {
      testKbLookupByCommand("fifth", [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyY, KeyCode.KeyZ)]);
      testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KeyY, KeyCode.KeyZ), "fifth");
    });
    test("resolve command - 6", () => {
      testKbLookupByCommand("seventh", [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyK)]);
      testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyK), "seventh");
    });
    test("resolve command - 7", () => {
      testKbLookupByCommand("uncomment lines", [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyU)]);
      testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyU), "uncomment lines");
    });
    test("resolve command - 8", () => {
      testKbLookupByCommand("comment lines", [KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyC)]);
      testResolve(createContext({}), KeyChord(KeyMod.CtrlCmd | KeyCode.KeyK, KeyMod.CtrlCmd | KeyCode.KeyC), "comment lines");
    });
    test("resolve command - 9", () => {
      testKbLookupByCommand("unreachablechord", []);
    });
    test("resolve command - 10", () => {
      testKbLookupByCommand("eleven", [KeyMod.CtrlCmd | KeyCode.KeyG]);
      testResolve(createContext({}), KeyMod.CtrlCmd | KeyCode.KeyG, "eleven");
    });
    test("resolve command - 11", () => {
      testKbLookupByCommand("sixth", []);
    });
    test("resolve command - 12", () => {
      testKbLookupByCommand("long multi chord", [[KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyA, KeyCode.KeyB]]);
      testResolve(createContext({}), [KeyMod.CtrlCmd | KeyCode.KeyK, KeyCode.KeyA, KeyCode.KeyB], "long multi chord");
    });
    const emptyContext = createContext({});
    test("KBs having common prefix - the one defined later is returned", () => {
      testResolve(emptyContext, [KeyMod.CtrlCmd | KeyCode.KeyB, KeyMod.CtrlCmd | KeyCode.KeyC, KeyCode.KeyI], "long-multi-chord-2");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL2tleWJpbmRpbmdSZXNvbHZlci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZGVjb2RlS2V5YmluZGluZywgY3JlYXRlU2ltcGxlS2V5YmluZGluZywgS2V5Q29kZUNob3JkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24va2V5YmluZGluZ3MuanMnO1xuaW1wb3J0IHsgS2V5Q2hvcmQsIEtleUNvZGUsIEtleU1vZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2tleUNvZGVzLmpzJztcbmltcG9ydCB7IE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIElDb250ZXh0IH0gZnJvbSAnLi4vLi4vLi4vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBLZXliaW5kaW5nUmVzb2x2ZXIsIFJlc3VsdEtpbmQgfSBmcm9tICcuLi8uLi9jb21tb24va2V5YmluZGluZ1Jlc29sdmVyLmpzJztcbmltcG9ydCB7IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0gfSBmcm9tICcuLi8uLi9jb21tb24vcmVzb2x2ZWRLZXliaW5kaW5nSXRlbS5qcyc7XG5pbXBvcnQgeyBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4uLy4uL2NvbW1vbi91c0xheW91dFJlc29sdmVkS2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVVU0xheW91dFJlc29sdmVkS2V5YmluZGluZyB9IGZyb20gJy4va2V5YmluZGluZ3NUZXN0VXRpbHMuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVDb250ZXh0KGN0eDogYW55KSB7XG5cdHJldHVybiB7XG5cdFx0Z2V0VmFsdWU6IChrZXk6IHN0cmluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGN0eFtrZXldO1xuXHRcdH1cblx0fTtcbn1cblxuc3VpdGUoJ0tleWJpbmRpbmdSZXNvbHZlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBrYkl0ZW0oa2V5YmluZGluZzogbnVtYmVyIHwgbnVtYmVyW10sIGNvbW1hbmQ6IHN0cmluZywgY29tbWFuZEFyZ3M6IGFueSwgd2hlbjogQ29udGV4dEtleUV4cHJlc3Npb24gfCB1bmRlZmluZWQsIGlzRGVmYXVsdDogYm9vbGVhbik6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0ge1xuXHRcdGNvbnN0IHJlc29sdmVkS2V5YmluZGluZyA9IGNyZWF0ZVVTTGF5b3V0UmVzb2x2ZWRLZXliaW5kaW5nKGtleWJpbmRpbmcsIE9TKTtcblx0XHRyZXR1cm4gbmV3IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0oXG5cdFx0XHRyZXNvbHZlZEtleWJpbmRpbmcsXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0Y29tbWFuZEFyZ3MsXG5cdFx0XHR3aGVuLFxuXHRcdFx0aXNEZWZhdWx0LFxuXHRcdFx0bnVsbCxcblx0XHRcdGZhbHNlXG5cdFx0KTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldERpc3BhdGNoU3RyKGNob3JkOiBLZXlDb2RlQ2hvcmQpOiBzdHJpbmcge1xuXHRcdHJldHVybiBVU0xheW91dFJlc29sdmVkS2V5YmluZGluZy5nZXREaXNwYXRjaFN0cihjaG9yZCkhO1xuXHR9XG5cblx0dGVzdCgncmVzb2x2ZSBrZXknLCAoKSA9PiB7XG5cdFx0Y29uc3Qga2V5YmluZGluZyA9IEtleU1vZC5DdHJsQ21kIHwgS2V5TW9kLlNoaWZ0IHwgS2V5Q29kZS5LZXlaO1xuXHRcdGNvbnN0IHJ1bnRpbWVLZXliaW5kaW5nID0gY3JlYXRlU2ltcGxlS2V5YmluZGluZyhrZXliaW5kaW5nLCBPUyk7XG5cdFx0Y29uc3QgY29udGV4dFJ1bGVzID0gQ29udGV4dEtleUV4cHIuZXF1YWxzKCdiYXInLCAnYmF6Jyk7XG5cdFx0Y29uc3Qga2V5YmluZGluZ0l0ZW0gPSBrYkl0ZW0oa2V5YmluZGluZywgJ3llcycsIG51bGwsIGNvbnRleHRSdWxlcywgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29udGV4dFJ1bGVzLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyBiYXI6ICdiYXonIH0pKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbnRleHRSdWxlcy5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgYmFyOiAnYnonIH0pKSwgZmFsc2UpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSBuZXcgS2V5YmluZGluZ1Jlc29sdmVyKFtrZXliaW5kaW5nSXRlbV0sIFtdLCAoKSA9PiB7IH0pO1xuXG5cdFx0Y29uc3QgcjEgPSByZXNvbHZlci5yZXNvbHZlKGNyZWF0ZUNvbnRleHQoeyBiYXI6ICdiYXonIH0pLCBbXSwgZ2V0RGlzcGF0Y2hTdHIocnVudGltZUtleWJpbmRpbmcpKTtcblx0XHRhc3NlcnQub2socjEua2luZCA9PT0gUmVzdWx0S2luZC5LYkZvdW5kKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocjEuY29tbWFuZElkLCAneWVzJyk7XG5cblx0XHRjb25zdCByMiA9IHJlc29sdmVyLnJlc29sdmUoY3JlYXRlQ29udGV4dCh7IGJhcjogJ2J6JyB9KSwgW10sIGdldERpc3BhdGNoU3RyKHJ1bnRpbWVLZXliaW5kaW5nKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHIyLmtpbmQsIFJlc3VsdEtpbmQuTm9NYXRjaGluZ0tiKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZSBrZXkgd2l0aCBhcmd1bWVudHMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29tbWFuZEFyZ3MgPSB7IHRleHQ6ICdubycgfTtcblx0XHRjb25zdCBrZXliaW5kaW5nID0gS2V5TW9kLkN0cmxDbWQgfCBLZXlNb2QuU2hpZnQgfCBLZXlDb2RlLktleVo7XG5cdFx0Y29uc3QgcnVudGltZUtleWJpbmRpbmcgPSBjcmVhdGVTaW1wbGVLZXliaW5kaW5nKGtleWJpbmRpbmcsIE9TKTtcblx0XHRjb25zdCBjb250ZXh0UnVsZXMgPSBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2JhcicsICdiYXonKTtcblx0XHRjb25zdCBrZXliaW5kaW5nSXRlbSA9IGtiSXRlbShrZXliaW5kaW5nLCAneWVzJywgY29tbWFuZEFyZ3MsIGNvbnRleHRSdWxlcywgdHJ1ZSk7XG5cblx0XHRjb25zdCByZXNvbHZlciA9IG5ldyBLZXliaW5kaW5nUmVzb2x2ZXIoW2tleWJpbmRpbmdJdGVtXSwgW10sICgpID0+IHsgfSk7XG5cblx0XHRjb25zdCByID0gcmVzb2x2ZXIucmVzb2x2ZShjcmVhdGVDb250ZXh0KHsgYmFyOiAnYmF6JyB9KSwgW10sIGdldERpc3BhdGNoU3RyKHJ1bnRpbWVLZXliaW5kaW5nKSk7XG5cdFx0YXNzZXJ0Lm9rKHIua2luZCA9PT0gUmVzdWx0S2luZC5LYkZvdW5kKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci5jb21tYW5kQXJncywgY29tbWFuZEFyZ3MpO1xuXHR9KTtcblxuXHRzdWl0ZSgnaGFuZGxlIGtleWJpbmRpbmcgcmVtb3ZhbHMnLCAoKSA9PiB7XG5cblx0XHR0ZXN0KCdzaW1wbGUgMScsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAneWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIHRydWUpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ3llczEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzEnLCAnYScpLCB0cnVlKSxcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCBmYWxzZSksXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NpbXBsZSAyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICd5ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcyJywgJ2InKSwgdHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUMsICd5ZXMzJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCczJywgJ2MnKSwgZmFsc2UpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gS2V5YmluZGluZ1Jlc29sdmVyLmhhbmRsZVJlbW92YWxzKFsuLi5kZWZhdWx0cywgLi4ub3ZlcnJpZGVzXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAneWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlDLCAneWVzMycsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMycsICdjJyksIGZhbHNlKSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVtb3ZhbCB3aXRoIG5vdCBtYXRjaGluZyB3aGVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICd5ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcyJywgJ2InKSwgdHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICcteWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdiJyksIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ3llczEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzEnLCAnYScpLCB0cnVlKSxcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCB0cnVlKVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZW1vdmFsIHdpdGggbm90IG1hdGNoaW5nIGtleWJpbmRpbmcnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ3llczEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzEnLCAnYScpLCB0cnVlKSxcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCB0cnVlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IG92ZXJyaWRlcyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJy15ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgZmFsc2UpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gS2V5YmluZGluZ1Jlc29sdmVyLmhhbmRsZVJlbW92YWxzKFsuLi5kZWZhdWx0cywgLi4ub3ZlcnJpZGVzXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAneWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbW92YWwgd2l0aCBtYXRjaGluZyBrZXliaW5kaW5nIGFuZCB3aGVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICd5ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcyJywgJ2InKSwgdHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICcteWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCB0cnVlKVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZW1vdmFsIHdpdGggdW5zcGVjaWZpZWQga2V5YmluZGluZycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAneWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzID0gW1xuXHRcdFx0XHRrYkl0ZW0oMCwgJy15ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgZmFsc2UpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gS2V5YmluZGluZ1Jlc29sdmVyLmhhbmRsZVJlbW92YWxzKFsuLi5kZWZhdWx0cywgLi4ub3ZlcnJpZGVzXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbW92YWwgd2l0aCB1bnNwZWNpZmllZCB3aGVuJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICd5ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcyJywgJ2InKSwgdHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICcteWVzMScsIG51bGwsIHVuZGVmaW5lZCwgZmFsc2UpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gS2V5YmluZGluZ1Jlc29sdmVyLmhhbmRsZVJlbW92YWxzKFsuLi5kZWZhdWx0cywgLi4ub3ZlcnJpZGVzXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbW92YWwgd2l0aCB1bnNwZWNpZmllZCB3aGVuIGFuZCB1bnNwZWNpZmllZCBrZXliaW5kaW5nJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICd5ZXMxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcxJywgJ2EnKSwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCcyJywgJ2InKSwgdHJ1ZSlcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbSgwLCAnLXllczEnLCBudWxsLCB1bmRlZmluZWQsIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCB0cnVlKVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc3N1ZSAjMTM4OTk3IC0gcmVtb3ZhbCBpbiBkZWZhdWx0IGxpc3QnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ3llczEnLCBudWxsLCB1bmRlZmluZWQsIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIHVuZGVmaW5lZCwgdHJ1ZSksXG5cdFx0XHRcdGtiSXRlbSgwLCAnLXllczEnLCBudWxsLCB1bmRlZmluZWQsIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IG92ZXJyaWRlczogUmVzb2x2ZWRLZXliaW5kaW5nSXRlbVtdID0gW107XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBLZXliaW5kaW5nUmVzb2x2ZXIuaGFuZGxlUmVtb3ZhbHMoWy4uLmRlZmF1bHRzLCAuLi5vdmVycmlkZXNdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUIsICd5ZXMyJywgbnVsbCwgdW5kZWZpbmVkLCB0cnVlKVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc3N1ZSAjNjEyI2lzc3VlY29tbWVudC0yMjIxMDkwODQgY2Fubm90IHJlbW92ZSBrZXliaW5kaW5ncyBmb3IgY29tbWFuZHMgd2l0aCBeJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVmYXVsdHMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICdeeWVzMScsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMScsICdhJyksIHRydWUpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlCLCAneWVzMicsIG51bGwsIENvbnRleHRLZXlFeHByLmVxdWFscygnMicsICdiJyksIHRydWUpXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnLXllczEnLCBudWxsLCB1bmRlZmluZWQsIGZhbHNlKVxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QiwgJ3llczInLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJzInLCAnYicpLCB0cnVlKVxuXHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpc3N1ZSAjMTQwODg0IFVuYWJsZSB0byByZWFzc2lnbiBGMSBhcyBrZXliaW5kaW5nIGZvciBTaG93IEFsbCBDb21tYW5kcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnY29tbWFuZDEnLCBudWxsLCB1bmRlZmluZWQsIHRydWUpLFxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IG92ZXJyaWRlcyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJy1jb21tYW5kMScsIG51bGwsIHVuZGVmaW5lZCwgZmFsc2UpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnY29tbWFuZDEnLCBudWxsLCB1bmRlZmluZWQsIGZhbHNlKSxcblx0XHRcdF07XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBLZXliaW5kaW5nUmVzb2x2ZXIuaGFuZGxlUmVtb3ZhbHMoWy4uLmRlZmF1bHRzLCAuLi5vdmVycmlkZXNdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICdjb21tYW5kMScsIG51bGwsIHVuZGVmaW5lZCwgZmFsc2UpXG5cdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2lzc3VlICMxNDE2Mzg6IEtleWJvYXJkIFNob3J0Y3V0czogQ2hhbmdlIFdoZW4gRXhwcmVzc2lvbiBtaWdodCBhY3R1YWxseSByZW1vdmUga2V5YmluZGluZyBpbiBJbnNpZGVycycsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnY29tbWFuZDEnLCBudWxsLCB1bmRlZmluZWQsIHRydWUpLFxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IG92ZXJyaWRlcyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ2NvbW1hbmQxJywgbnVsbCwgQ29udGV4dEtleUV4cHIuZXF1YWxzKCdhJywgJzEnKSwgZmFsc2UpLFxuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnLWNvbW1hbmQxJywgbnVsbCwgdW5kZWZpbmVkLCBmYWxzZSksXG5cdFx0XHRdO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gS2V5YmluZGluZ1Jlc29sdmVyLmhhbmRsZVJlbW92YWxzKFsuLi5kZWZhdWx0cywgLi4ub3ZlcnJpZGVzXSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnY29tbWFuZDEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2EnLCAnMScpLCBmYWxzZSlcblx0XHRcdF0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnaXNzdWUgIzE1Nzc1MTogQXV0by1xdW90aW5nIG9mIGNvbnRleHQga2V5cyBwcmV2ZW50cyByZW1vdmFsIG9mIGtleWJpbmRpbmdzIHZpYSBVSScsICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmF1bHRzID0gW1xuXHRcdFx0XHRrYkl0ZW0oS2V5Q29kZS5LZXlBLCAnY29tbWFuZDEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShgZWRpdG9yVGV4dEZvY3VzICYmIGFjdGl2ZUVkaXRvciAhPSB3b3JrYmVuY2guZWRpdG9yLm5vdGVib29rICYmIGVkaXRvckxhbmdJZCBpbiBqdWxpYS5zdXBwb3J0ZWRMYW5ndWFnZUlkc2ApLCB0cnVlKSxcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICctY29tbWFuZDEnLCBudWxsLCBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShgZWRpdG9yVGV4dEZvY3VzICYmIGFjdGl2ZUVkaXRvciAhPSAnd29ya2JlbmNoLmVkaXRvci5ub3RlYm9vaycgJiYgZWRpdG9yTGFuZ0lkIGluICdqdWxpYS5zdXBwb3J0ZWRMYW5ndWFnZUlkcydgKSwgZmFsc2UpLFxuXHRcdFx0XTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IEtleWJpbmRpbmdSZXNvbHZlci5oYW5kbGVSZW1vdmFscyhbLi4uZGVmYXVsdHMsIC4uLm92ZXJyaWRlc10pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2lzc3VlICMxNjA2MDQ6IFJlbW92ZSBrZXliaW5kaW5ncyB3aXRoIHdoZW4gY2xhdXNlIGRvZXMgbm90IHdvcmsnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBkZWZhdWx0cyA9IFtcblx0XHRcdFx0a2JJdGVtKEtleUNvZGUuS2V5QSwgJ2NvbW1hbmQxJywgbnVsbCwgdW5kZWZpbmVkLCB0cnVlKSxcblx0XHRcdF07XG5cdFx0XHRjb25zdCBvdmVycmlkZXMgPSBbXG5cdFx0XHRcdGtiSXRlbShLZXlDb2RlLktleUEsICctY29tbWFuZDEnLCBudWxsLCBDb250ZXh0S2V5RXhwci50cnVlKCksIGZhbHNlKSxcblx0XHRcdF07XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBLZXliaW5kaW5nUmVzb2x2ZXIuaGFuZGxlUmVtb3ZhbHMoWy4uLmRlZmF1bHRzLCAuLi5vdmVycmlkZXNdKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjb250ZXh0SXNFbnRpcmVseUluY2x1ZGVkJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdG9Db250ZXh0S2V5RXhwcmVzc2lvbiA9IChleHByOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHN0cmluZyB8IG51bGwpID0+IHtcblx0XHRcdFx0aWYgKHR5cGVvZiBleHByID09PSAnc3RyaW5nJyB8fCAhZXhwcikge1xuXHRcdFx0XHRcdHJldHVybiBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShleHByKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZXhwcjtcblx0XHRcdH07XG5cdFx0XHRjb25zdCBhc3NlcnRJc0luY2x1ZGVkID0gKGE6IENvbnRleHRLZXlFeHByZXNzaW9uIHwgc3RyaW5nIHwgbnVsbCwgYjogQ29udGV4dEtleUV4cHJlc3Npb24gfCBzdHJpbmcgfCBudWxsKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChLZXliaW5kaW5nUmVzb2x2ZXIud2hlbklzRW50aXJlbHlJbmNsdWRlZCh0b0NvbnRleHRLZXlFeHByZXNzaW9uKGEpLCB0b0NvbnRleHRLZXlFeHByZXNzaW9uKGIpKSwgdHJ1ZSk7XG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgYXNzZXJ0SXNOb3RJbmNsdWRlZCA9IChhOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHN0cmluZyB8IG51bGwsIGI6IENvbnRleHRLZXlFeHByZXNzaW9uIHwgc3RyaW5nIHwgbnVsbCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoS2V5YmluZGluZ1Jlc29sdmVyLndoZW5Jc0VudGlyZWx5SW5jbHVkZWQodG9Db250ZXh0S2V5RXhwcmVzc2lvbihhKSwgdG9Db250ZXh0S2V5RXhwcmVzc2lvbihiKSksIGZhbHNlKTtcblx0XHRcdH07XG5cblx0XHRcdGFzc2VydElzSW5jbHVkZWQobnVsbCwgbnVsbCk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKG51bGwsIENvbnRleHRLZXlFeHByLnRydWUoKSk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKENvbnRleHRLZXlFeHByLnRydWUoKSwgbnVsbCk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKENvbnRleHRLZXlFeHByLnRydWUoKSwgQ29udGV4dEtleUV4cHIudHJ1ZSgpKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEnLCBudWxsKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEnLCAnJyk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKCdrZXkxJywgJ2tleTEnKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEnLCBDb250ZXh0S2V5RXhwci50cnVlKCkpO1xuXHRcdFx0YXNzZXJ0SXNJbmNsdWRlZCgnIWtleTEnLCAnJyk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKCcha2V5MScsICcha2V5MScpO1xuXHRcdFx0YXNzZXJ0SXNJbmNsdWRlZCgna2V5MicsICcnKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTInLCAna2V5MicpO1xuXHRcdFx0YXNzZXJ0SXNJbmNsdWRlZCgna2V5MSAmJiBrZXkxICYmIGtleTIgJiYga2V5MicsICdrZXkyJyk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKCdrZXkxICYmIGtleTInLCAna2V5MicpO1xuXHRcdFx0YXNzZXJ0SXNJbmNsdWRlZCgna2V5MSAmJiBrZXkyJywgJ2tleTEnKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEgJiYga2V5MicsICcnKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEnLCAna2V5MSB8fCBrZXkyJyk7XG5cdFx0XHRhc3NlcnRJc0luY2x1ZGVkKCdrZXkxIHx8ICFrZXkxJywgJ2tleTIgfHwgIWtleTInKTtcblx0XHRcdGFzc2VydElzSW5jbHVkZWQoJ2tleTEnLCAna2V5MSB8fCBrZXkyICYmIGtleTMnKTtcblxuXHRcdFx0YXNzZXJ0SXNOb3RJbmNsdWRlZCgna2V5MScsICcha2V5MScpO1xuXHRcdFx0YXNzZXJ0SXNOb3RJbmNsdWRlZCgnIWtleTEnLCAna2V5MScpO1xuXHRcdFx0YXNzZXJ0SXNOb3RJbmNsdWRlZCgna2V5MSAmJiBrZXkyJywgJ2tleTMnKTtcblx0XHRcdGFzc2VydElzTm90SW5jbHVkZWQoJ2tleTEgJiYga2V5MicsICdrZXk0Jyk7XG5cdFx0XHRhc3NlcnRJc05vdEluY2x1ZGVkKCdrZXkxJywgJ2tleTInKTtcblx0XHRcdGFzc2VydElzTm90SW5jbHVkZWQoJ2tleTEgfHwga2V5MicsICdrZXkyJyk7XG5cdFx0XHRhc3NlcnRJc05vdEluY2x1ZGVkKCcnLCAna2V5MicpO1xuXHRcdFx0YXNzZXJ0SXNOb3RJbmNsdWRlZChudWxsLCAna2V5MicpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgncmVzb2x2ZSBjb21tYW5kJywgKCkgPT4ge1xuXG5cdFx0ZnVuY3Rpb24gX2tiSXRlbShrZXliaW5kaW5nOiBudW1iZXIgfCBudW1iZXJbXSwgY29tbWFuZDogc3RyaW5nLCB3aGVuOiBDb250ZXh0S2V5RXhwcmVzc2lvbiB8IHVuZGVmaW5lZCk6IFJlc29sdmVkS2V5YmluZGluZ0l0ZW0ge1xuXHRcdFx0cmV0dXJuIGtiSXRlbShrZXliaW5kaW5nLCBjb21tYW5kLCBudWxsLCB3aGVuLCB0cnVlKTtcblx0XHR9XG5cblx0XHRjb25zdCBpdGVtcyA9IFtcblx0XHRcdC8vIFRoaXMgb25lIHdpbGwgbmV2ZXIgbWF0Y2ggYmVjYXVzZSBpdHMgXCJ3aGVuXCIgaXMgYWx3YXlzIG92ZXJ3cml0dGVuIGJ5IGFub3RoZXIgb25lXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRLZXlDb2RlLktleVgsXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2tleTEnLCB0cnVlKSxcblx0XHRcdFx0XHRDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2tleTInLCBmYWxzZSlcblx0XHRcdFx0KVxuXHRcdFx0KSxcblx0XHRcdC8vIFRoaXMgb25lIGFsd2F5cyBvdmVyd3JpdGVzIGZpcnN0XG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRLZXlDb2RlLktleVgsXG5cdFx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2tleTInLCB0cnVlKVxuXHRcdFx0KSxcblx0XHRcdC8vIFRoaXMgb25lIGlzIGEgc2Vjb25kYXJ5IG1hcHBpbmcgZm9yIGBzZWNvbmRgXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRLZXlDb2RlLktleVosXG5cdFx0XHRcdCdzZWNvbmQnLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHQvLyBUaGlzIG9uZSBzb21ldGltZXMgb3ZlcndyaXRlcyBmaXJzdFxuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0S2V5Q29kZS5LZXlYLFxuXHRcdFx0XHQndGhpcmQnLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2tleTMnLCB0cnVlKVxuXHRcdFx0KSxcblx0XHRcdC8vIFRoaXMgb25lIGlzIGFsd2F5cyBvdmVyd3JpdHRlbiBieSBhbm90aGVyIG9uZVxuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVksXG5cdFx0XHRcdCdmb3VydGgnLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2tleTQnLCB0cnVlKVxuXHRcdFx0KSxcblx0XHRcdC8vIFRoaXMgb25lIG92ZXJ3cml0ZXMgd2l0aCBhIGNob3JkIHRoZSBwcmV2aW91cyBvbmVcblx0XHRcdF9rYkl0ZW0oXG5cdFx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlZLCBLZXlDb2RlLktleVopLFxuXHRcdFx0XHQnZmlmdGgnLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHQvLyBUaGlzIG9uZSBoYXMgbm8ga2V5YmluZGluZ1xuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0MCxcblx0XHRcdFx0J3NpeHRoJyxcblx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0XHQpLFxuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0S2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlVKSxcblx0XHRcdFx0J3NldmVudGgnLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUspLFxuXHRcdFx0XHQnc2V2ZW50aCcsXG5cdFx0XHRcdHVuZGVmaW5lZFxuXHRcdFx0KSxcblx0XHRcdF9rYkl0ZW0oXG5cdFx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5VSksXG5cdFx0XHRcdCd1bmNvbW1lbnQgbGluZXMnLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUMpLCAvLyBjbWQrayBjbWQrY1xuXHRcdFx0XHQnY29tbWVudCBsaW5lcycsXG5cdFx0XHRcdHVuZGVmaW5lZFxuXHRcdFx0KSxcblx0XHRcdF9rYkl0ZW0oXG5cdFx0XHRcdEtleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlHLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QyksIC8vIGNtZCtnIGNtZCtjXG5cdFx0XHRcdCd1bnJlYWNoYWJsZWNob3JkJyxcblx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0XHQpLFxuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0S2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUcsIC8vIGNtZCtnXG5cdFx0XHRcdCdlbGV2ZW4nLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuS2V5QSwgS2V5Q29kZS5LZXlCXSwgLy8gY21kK2sgYSBiXG5cdFx0XHRcdCdsb25nIG11bHRpIGNob3JkJyxcblx0XHRcdFx0dW5kZWZpbmVkXG5cdFx0XHQpLFxuXHRcdFx0X2tiSXRlbShcblx0XHRcdFx0W0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlCLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5Q10sIC8vIGNtZCtiIGNtZCtjXG5cdFx0XHRcdCdzaGFkb3dlZCBieSBsb25nLW11bHRpLWNob3JkLTInLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdCksXG5cdFx0XHRfa2JJdGVtKFxuXHRcdFx0XHRbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUIsIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlDLCBLZXlDb2RlLktleUldLCAvLyBjbWQrYiBjbWQrYyBpXG5cdFx0XHRcdCdsb25nLW11bHRpLWNob3JkLTInLFxuXHRcdFx0XHR1bmRlZmluZWRcblx0XHRcdClcblx0XHRdO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZXIgPSBuZXcgS2V5YmluZGluZ1Jlc29sdmVyKGl0ZW1zLCBbXSwgKCkgPT4geyB9KTtcblxuXHRcdGNvbnN0IHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCA9IChjb21tYW5kSWQ6IHN0cmluZywgZXhwZWN0ZWRLZXlzOiBudW1iZXJbXSB8IG51bWJlcltdW10pID0+IHtcblx0XHRcdC8vIFRlc3QgbG9va3VwXG5cdFx0XHRjb25zdCBsb29rdXBSZXN1bHQgPSByZXNvbHZlci5sb29rdXBLZXliaW5kaW5ncyhjb21tYW5kSWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxvb2t1cFJlc3VsdC5sZW5ndGgsIGV4cGVjdGVkS2V5cy5sZW5ndGgsICdMZW5ndGggbWlzbWF0Y2ggQCBjb21tYW5kSWQgJyArIGNvbW1hbmRJZCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbG9va3VwUmVzdWx0Lmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGV4cGVjdGVkID0gY3JlYXRlVVNMYXlvdXRSZXNvbHZlZEtleWJpbmRpbmcoZXhwZWN0ZWRLZXlzW2ldLCBPUykhO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsb29rdXBSZXN1bHRbaV0ucmVzb2x2ZWRLZXliaW5kaW5nIS5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpLCBleHBlY3RlZC5nZXRVc2VyU2V0dGluZ3NMYWJlbCgpLCAndmFsdWUgbWlzbWF0Y2ggQCBjb21tYW5kSWQgJyArIGNvbW1hbmRJZCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IHRlc3RSZXNvbHZlID0gKGN0eDogSUNvbnRleHQsIF9leHBlY3RlZEtleTogbnVtYmVyIHwgbnVtYmVyW10sIGNvbW1hbmRJZDogc3RyaW5nKSA9PiB7XG5cdFx0XHRjb25zdCBleHBlY3RlZEtleWJpbmRpbmcgPSBkZWNvZGVLZXliaW5kaW5nKF9leHBlY3RlZEtleSwgT1MpITtcblxuXHRcdFx0Y29uc3QgcHJldmlvdXNDaG9yZDogc3RyaW5nW10gPSBbXTtcblxuXHRcdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGV4cGVjdGVkS2V5YmluZGluZy5jaG9yZHMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblxuXHRcdFx0XHRjb25zdCBjaG9yZCA9IGdldERpc3BhdGNoU3RyKDxLZXlDb2RlQ2hvcmQ+ZXhwZWN0ZWRLZXliaW5kaW5nLmNob3Jkc1tpXSk7XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gcmVzb2x2ZXIucmVzb2x2ZShjdHgsIHByZXZpb3VzQ2hvcmQsIGNob3JkKTtcblxuXHRcdFx0XHRpZiAoaSA9PT0gbGVuIC0gMSkge1xuXHRcdFx0XHRcdC8vIGlmIGl0J3MgdGhlIGZpbmFsIGNob3JkLCB0aGVuIHdlIHNob3VsZCBmaW5kIGEgdmFsaWQgY29tbWFuZCxcblx0XHRcdFx0XHQvLyBhbmQgdGhlcmUgc2hvdWxkIG5vdCBiZSBhIGNob3JkLlxuXHRcdFx0XHRcdGFzc2VydC5vayhyZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5LYkZvdW5kLCBgRW50ZXJzIG11bHRpIGNob3JkIGZvciAke2NvbW1hbmRJZH0gYXQgY2hvcmQgJHtpfWApO1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQuY29tbWFuZElkLCBjb21tYW5kSWQsIGBFbnRlcnMgbXVsdGkgY2hvcmQgZm9yICR7Y29tbWFuZElkfSBhdCBjaG9yZCAke2l9YCk7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaSA+IDApIHtcblx0XHRcdFx0XHQvLyBpZiB0aGlzIGlzIGFuIGludGVybWVkaWF0ZSBjaG9yZCwgd2Ugc2hvdWxkIG5vdCBmaW5kIGEgdmFsaWQgY29tbWFuZCxcblx0XHRcdFx0XHQvLyBhbmQgdGhlcmUgc2hvdWxkIGJlIGFuIG9wZW4gY2hvcmQgd2UgY29udGludWUuXG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKHJlc3VsdC5raW5kID09PSBSZXN1bHRLaW5kLk1vcmVDaG9yZHNOZWVkZWQsIGBDb250aW51ZXMgbXVsdGkgY2hvcmQgZm9yICR7Y29tbWFuZElkfSBhdCBjaG9yZCAke2l9YCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gaWYgaXQncyBub3QgdGhlIGZpbmFsIGNob3JkIGFuZCBub3QgYW4gaW50ZXJtZWRpYXRlLCB0aGVuIHdlIHNob3VsZCBub3Rcblx0XHRcdFx0XHQvLyBmaW5kIGEgdmFsaWQgY29tbWFuZCwgYW5kIHdlIHNob3VsZCBlbnRlciBhIGNob3JkLlxuXHRcdFx0XHRcdGFzc2VydC5vayhyZXN1bHQua2luZCA9PT0gUmVzdWx0S2luZC5Nb3JlQ2hvcmRzTmVlZGVkLCBgRW50ZXJzIG11bHRpIGNob3JkIGZvciAke2NvbW1hbmRJZH0gYXQgY2hvcmQgJHtpfWApO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHByZXZpb3VzQ2hvcmQucHVzaChjaG9yZCk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRlc3QoJ3Jlc29sdmUgY29tbWFuZCAtIDEnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0S2JMb29rdXBCeUNvbW1hbmQoJ2ZpcnN0JywgW10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gMicsICgpID0+IHtcblx0XHRcdHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCgnc2Vjb25kJywgW0tleUNvZGUuS2V5WiwgS2V5Q29kZS5LZXlYXSk7XG5cdFx0XHR0ZXN0UmVzb2x2ZShjcmVhdGVDb250ZXh0KHsga2V5MjogdHJ1ZSB9KSwgS2V5Q29kZS5LZXlYLCAnc2Vjb25kJyk7XG5cdFx0XHR0ZXN0UmVzb2x2ZShjcmVhdGVDb250ZXh0KHt9KSwgS2V5Q29kZS5LZXlaLCAnc2Vjb25kJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXNvbHZlIGNvbW1hbmQgLSAzJywgKCkgPT4ge1xuXHRcdFx0dGVzdEtiTG9va3VwQnlDb21tYW5kKCd0aGlyZCcsIFtLZXlDb2RlLktleVhdKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoeyBrZXkzOiB0cnVlIH0pLCBLZXlDb2RlLktleVgsICd0aGlyZCcpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gNCcsICgpID0+IHtcblx0XHRcdHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCgnZm91cnRoJywgW10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gNScsICgpID0+IHtcblx0XHRcdHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCgnZmlmdGgnLCBbS2V5Q2hvcmQoS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVksIEtleUNvZGUuS2V5WildKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5WSwgS2V5Q29kZS5LZXlaKSwgJ2ZpZnRoJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXNvbHZlIGNvbW1hbmQgLSA2JywgKCkgPT4ge1xuXHRcdFx0dGVzdEtiTG9va3VwQnlDb21tYW5kKCdzZXZlbnRoJywgW0tleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SyldKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUspLCAnc2V2ZW50aCcpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gNycsICgpID0+IHtcblx0XHRcdHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCgndW5jb21tZW50IGxpbmVzJywgW0tleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5VSldKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleVUpLCAndW5jb21tZW50IGxpbmVzJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXNvbHZlIGNvbW1hbmQgLSA4JywgKCkgPT4ge1xuXHRcdFx0dGVzdEtiTG9va3VwQnlDb21tYW5kKCdjb21tZW50IGxpbmVzJywgW0tleUNob3JkKEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5QyldKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBLZXlDaG9yZChLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5SywgS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUMpLCAnY29tbWVudCBsaW5lcycpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gOScsICgpID0+IHtcblx0XHRcdHRlc3RLYkxvb2t1cEJ5Q29tbWFuZCgndW5yZWFjaGFibGVjaG9yZCcsIFtdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Jlc29sdmUgY29tbWFuZCAtIDEwJywgKCkgPT4ge1xuXHRcdFx0dGVzdEtiTG9va3VwQnlDb21tYW5kKCdlbGV2ZW4nLCBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUddKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBLZXlNb2QuQ3RybENtZCB8IEtleUNvZGUuS2V5RywgJ2VsZXZlbicpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gMTEnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0S2JMb29rdXBCeUNvbW1hbmQoJ3NpeHRoJywgW10pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZSBjb21tYW5kIC0gMTInLCAoKSA9PiB7XG5cdFx0XHR0ZXN0S2JMb29rdXBCeUNvbW1hbmQoJ2xvbmcgbXVsdGkgY2hvcmQnLCBbW0tleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlLLCBLZXlDb2RlLktleUEsIEtleUNvZGUuS2V5Ql1dKTtcblx0XHRcdHRlc3RSZXNvbHZlKGNyZWF0ZUNvbnRleHQoe30pLCBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUssIEtleUNvZGUuS2V5QSwgS2V5Q29kZS5LZXlCXSwgJ2xvbmcgbXVsdGkgY2hvcmQnKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVtcHR5Q29udGV4dCA9IGNyZWF0ZUNvbnRleHQoe30pO1xuXG5cdFx0dGVzdCgnS0JzIGhhdmluZyBjb21tb24gcHJlZml4IC0gdGhlIG9uZSBkZWZpbmVkIGxhdGVyIGlzIHJldHVybmVkJywgKCkgPT4ge1xuXHRcdFx0dGVzdFJlc29sdmUoZW1wdHlDb250ZXh0LCBbS2V5TW9kLkN0cmxDbWQgfCBLZXlDb2RlLktleUIsIEtleU1vZC5DdHJsQ21kIHwgS2V5Q29kZS5LZXlDLCBLZXlDb2RlLktleUldLCAnbG9uZy1tdWx0aS1jaG9yZC0yJyk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxrQkFBa0IsOEJBQTRDO0FBQ3ZFLFNBQVMsVUFBVSxTQUFTLGNBQWM7QUFDMUMsU0FBUyxVQUFVO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsc0JBQXNEO0FBQy9ELFNBQVMsb0JBQW9CLGtCQUFrQjtBQUMvQyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHdDQUF3QztBQUVqRCxTQUFTLGNBQWMsS0FBVTtBQUNoQyxTQUFPO0FBQUEsSUFDTixVQUFVLENBQUMsUUFBZ0I7QUFDMUIsYUFBTyxJQUFJLEdBQUc7QUFBQSxJQUNmO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSxzQkFBc0IsTUFBTTtBQUVqQywwQ0FBd0M7QUFFeEMsV0FBUyxPQUFPLFlBQStCLFNBQWlCLGFBQWtCLE1BQXdDLFdBQTRDO0FBQ3JLLFVBQU0scUJBQXFCLGlDQUFpQyxZQUFZLEVBQUU7QUFDMUUsV0FBTyxJQUFJO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBRUEsV0FBUyxlQUFlLE9BQTZCO0FBQ3BELFdBQU8sMkJBQTJCLGVBQWUsS0FBSztBQUFBLEVBQ3ZEO0FBRUEsT0FBSyxlQUFlLE1BQU07QUFDekIsVUFBTSxhQUFhLE9BQU8sVUFBVSxPQUFPLFFBQVEsUUFBUTtBQUMzRCxVQUFNLG9CQUFvQix1QkFBdUIsWUFBWSxFQUFFO0FBQy9ELFVBQU0sZUFBZSxlQUFlLE9BQU8sT0FBTyxLQUFLO0FBQ3ZELFVBQU0saUJBQWlCLE9BQU8sWUFBWSxPQUFPLE1BQU0sY0FBYyxJQUFJO0FBRXpFLFdBQU8sWUFBWSxhQUFhLFNBQVMsY0FBYyxFQUFFLEtBQUssTUFBTSxDQUFDLENBQUMsR0FBRyxJQUFJO0FBQzdFLFdBQU8sWUFBWSxhQUFhLFNBQVMsY0FBYyxFQUFFLEtBQUssS0FBSyxDQUFDLENBQUMsR0FBRyxLQUFLO0FBRTdFLFVBQU0sV0FBVyxJQUFJLG1CQUFtQixDQUFDLGNBQWMsR0FBRyxDQUFDLEdBQUcsTUFBTTtBQUFBLElBQUUsQ0FBQztBQUV2RSxVQUFNLEtBQUssU0FBUyxRQUFRLGNBQWMsRUFBRSxLQUFLLE1BQU0sQ0FBQyxHQUFHLENBQUMsR0FBRyxlQUFlLGlCQUFpQixDQUFDO0FBQ2hHLFdBQU8sR0FBRyxHQUFHLFNBQVMsV0FBVyxPQUFPO0FBQ3hDLFdBQU8sWUFBWSxHQUFHLFdBQVcsS0FBSztBQUV0QyxVQUFNLEtBQUssU0FBUyxRQUFRLGNBQWMsRUFBRSxLQUFLLEtBQUssQ0FBQyxHQUFHLENBQUMsR0FBRyxlQUFlLGlCQUFpQixDQUFDO0FBQy9GLFdBQU8sWUFBWSxHQUFHLE1BQU0sV0FBVyxZQUFZO0FBQUEsRUFDcEQsQ0FBQztBQUVELE9BQUssOEJBQThCLE1BQU07QUFDeEMsVUFBTSxjQUFjLEVBQUUsTUFBTSxLQUFLO0FBQ2pDLFVBQU0sYUFBYSxPQUFPLFVBQVUsT0FBTyxRQUFRLFFBQVE7QUFDM0QsVUFBTSxvQkFBb0IsdUJBQXVCLFlBQVksRUFBRTtBQUMvRCxVQUFNLGVBQWUsZUFBZSxPQUFPLE9BQU8sS0FBSztBQUN2RCxVQUFNLGlCQUFpQixPQUFPLFlBQVksT0FBTyxhQUFhLGNBQWMsSUFBSTtBQUVoRixVQUFNLFdBQVcsSUFBSSxtQkFBbUIsQ0FBQyxjQUFjLEdBQUcsQ0FBQyxHQUFHLE1BQU07QUFBQSxJQUFFLENBQUM7QUFFdkUsVUFBTSxJQUFJLFNBQVMsUUFBUSxjQUFjLEVBQUUsS0FBSyxNQUFNLENBQUMsR0FBRyxDQUFDLEdBQUcsZUFBZSxpQkFBaUIsQ0FBQztBQUMvRixXQUFPLEdBQUcsRUFBRSxTQUFTLFdBQVcsT0FBTztBQUN2QyxXQUFPLFlBQVksRUFBRSxhQUFhLFdBQVc7QUFBQSxFQUM5QyxDQUFDO0FBRUQsUUFBTSw4QkFBOEIsTUFBTTtBQUV6QyxTQUFLLFlBQVksTUFBTTtBQUN0QixZQUFNLFdBQVc7QUFBQSxRQUNoQixPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxNQUN6RTtBQUNBLFlBQU0sWUFBWTtBQUFBLFFBQ2pCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsS0FBSztBQUFBLE1BQzFFO0FBQ0EsWUFBTSxTQUFTLG1CQUFtQixlQUFlLENBQUMsR0FBRyxVQUFVLEdBQUcsU0FBUyxDQUFDO0FBQzVFLGFBQU8sZ0JBQWdCLFFBQVE7QUFBQSxRQUM5QixPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxRQUN4RSxPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLEtBQUs7QUFBQSxNQUMxRSxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxZQUFZLE1BQU07QUFDdEIsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekU7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLEtBQUs7QUFBQSxNQUMxRTtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxLQUFLO0FBQUEsTUFDMUUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssa0NBQWtDLE1BQU07QUFDNUMsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekU7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLFFBQVEsTUFBTSxTQUFTLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLEtBQUs7QUFBQSxNQUMzRTtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssd0NBQXdDLE1BQU07QUFDbEQsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekU7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLFFBQVEsTUFBTSxTQUFTLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLEtBQUs7QUFBQSxNQUMzRTtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssNkNBQTZDLE1BQU07QUFDdkQsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekU7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLFFBQVEsTUFBTSxTQUFTLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLEtBQUs7QUFBQSxNQUMzRTtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssdUNBQXVDLE1BQU07QUFDakQsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsUUFDeEUsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekU7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLEdBQUcsU0FBUyxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxLQUFLO0FBQUEsTUFDaEU7QUFDQSxZQUFNLFNBQVMsbUJBQW1CLGVBQWUsQ0FBQyxHQUFHLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDNUUsYUFBTyxnQkFBZ0IsUUFBUTtBQUFBLFFBQzlCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsSUFBSTtBQUFBLE1BQ3pFLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLGlDQUFpQyxNQUFNO0FBQzNDLFlBQU0sV0FBVztBQUFBLFFBQ2hCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsSUFBSTtBQUFBLFFBQ3hFLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsSUFBSTtBQUFBLE1BQ3pFO0FBQ0EsWUFBTSxZQUFZO0FBQUEsUUFDakIsT0FBTyxRQUFRLE1BQU0sU0FBUyxNQUFNLFFBQVcsS0FBSztBQUFBLE1BQ3JEO0FBQ0EsWUFBTSxTQUFTLG1CQUFtQixlQUFlLENBQUMsR0FBRyxVQUFVLEdBQUcsU0FBUyxDQUFDO0FBQzVFLGFBQU8sZ0JBQWdCLFFBQVE7QUFBQSxRQUM5QixPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxNQUN6RSxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyw0REFBNEQsTUFBTTtBQUN0RSxZQUFNLFdBQVc7QUFBQSxRQUNoQixPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxRQUN4RSxPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxNQUN6RTtBQUNBLFlBQU0sWUFBWTtBQUFBLFFBQ2pCLE9BQU8sR0FBRyxTQUFTLE1BQU0sUUFBVyxLQUFLO0FBQUEsTUFDMUM7QUFDQSxZQUFNLFNBQVMsbUJBQW1CLGVBQWUsQ0FBQyxHQUFHLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDNUUsYUFBTyxnQkFBZ0IsUUFBUTtBQUFBLFFBQzlCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsSUFBSTtBQUFBLE1BQ3pFLENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLDJDQUEyQyxNQUFNO0FBQ3JELFlBQU0sV0FBVztBQUFBLFFBQ2hCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxRQUFXLElBQUk7QUFBQSxRQUNsRCxPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sUUFBVyxJQUFJO0FBQUEsUUFDbEQsT0FBTyxHQUFHLFNBQVMsTUFBTSxRQUFXLEtBQUs7QUFBQSxNQUMxQztBQUNBLFlBQU0sWUFBc0MsQ0FBQztBQUM3QyxZQUFNLFNBQVMsbUJBQW1CLGVBQWUsQ0FBQyxHQUFHLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDNUUsYUFBTyxnQkFBZ0IsUUFBUTtBQUFBLFFBQzlCLE9BQU8sUUFBUSxNQUFNLFFBQVEsTUFBTSxRQUFXLElBQUk7QUFBQSxNQUNuRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBRUQsU0FBSyxtRkFBbUYsTUFBTTtBQUM3RixZQUFNLFdBQVc7QUFBQSxRQUNoQixPQUFPLFFBQVEsTUFBTSxTQUFTLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxRQUN6RSxPQUFPLFFBQVEsTUFBTSxRQUFRLE1BQU0sZUFBZSxPQUFPLEtBQUssR0FBRyxHQUFHLElBQUk7QUFBQSxNQUN6RTtBQUNBLFlBQU0sWUFBWTtBQUFBLFFBQ2pCLE9BQU8sUUFBUSxNQUFNLFNBQVMsTUFBTSxRQUFXLEtBQUs7QUFBQSxNQUNyRDtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sUUFBUSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxJQUFJO0FBQUEsTUFDekUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssMkVBQTJFLE1BQU07QUFDckYsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sWUFBWSxNQUFNLFFBQVcsSUFBSTtBQUFBLE1BQ3ZEO0FBQ0EsWUFBTSxZQUFZO0FBQUEsUUFDakIsT0FBTyxRQUFRLE1BQU0sYUFBYSxNQUFNLFFBQVcsS0FBSztBQUFBLFFBQ3hELE9BQU8sUUFBUSxNQUFNLFlBQVksTUFBTSxRQUFXLEtBQUs7QUFBQSxNQUN4RDtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sWUFBWSxNQUFNLFFBQVcsS0FBSztBQUFBLE1BQ3hELENBQUM7QUFBQSxJQUNGLENBQUM7QUFFRCxTQUFLLDBHQUEwRyxNQUFNO0FBQ3BILFlBQU0sV0FBVztBQUFBLFFBQ2hCLE9BQU8sUUFBUSxNQUFNLFlBQVksTUFBTSxRQUFXLElBQUk7QUFBQSxNQUN2RDtBQUNBLFlBQU0sWUFBWTtBQUFBLFFBQ2pCLE9BQU8sUUFBUSxNQUFNLFlBQVksTUFBTSxlQUFlLE9BQU8sS0FBSyxHQUFHLEdBQUcsS0FBSztBQUFBLFFBQzdFLE9BQU8sUUFBUSxNQUFNLGFBQWEsTUFBTSxRQUFXLEtBQUs7QUFBQSxNQUN6RDtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRO0FBQUEsUUFDOUIsT0FBTyxRQUFRLE1BQU0sWUFBWSxNQUFNLGVBQWUsT0FBTyxLQUFLLEdBQUcsR0FBRyxLQUFLO0FBQUEsTUFDOUUsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUVELFNBQUssc0ZBQXNGLE1BQU07QUFDaEcsWUFBTSxXQUFXO0FBQUEsUUFDaEIsT0FBTyxRQUFRLE1BQU0sWUFBWSxNQUFNLGVBQWUsWUFBWSw0R0FBNEcsR0FBRyxJQUFJO0FBQUEsTUFDdEw7QUFDQSxZQUFNLFlBQVk7QUFBQSxRQUNqQixPQUFPLFFBQVEsTUFBTSxhQUFhLE1BQU0sZUFBZSxZQUFZLGdIQUFnSCxHQUFHLEtBQUs7QUFBQSxNQUM1TDtBQUNBLFlBQU0sU0FBUyxtQkFBbUIsZUFBZSxDQUFDLEdBQUcsVUFBVSxHQUFHLFNBQVMsQ0FBQztBQUM1RSxhQUFPLGdCQUFnQixRQUFRLENBQUMsQ0FBQztBQUFBLElBQ2xDLENBQUM7QUFFRCxTQUFLLG9FQUFvRSxNQUFNO0FBQzlFLFlBQU0sV0FBVztBQUFBLFFBQ2hCLE9BQU8sUUFBUSxNQUFNLFlBQVksTUFBTSxRQUFXLElBQUk7QUFBQSxNQUN2RDtBQUNBLFlBQU0sWUFBWTtBQUFBLFFBQ2pCLE9BQU8sUUFBUSxNQUFNLGFBQWEsTUFBTSxlQUFlLEtBQUssR0FBRyxLQUFLO0FBQUEsTUFDckU7QUFDQSxZQUFNLFNBQVMsbUJBQW1CLGVBQWUsQ0FBQyxHQUFHLFVBQVUsR0FBRyxTQUFTLENBQUM7QUFDNUUsYUFBTyxnQkFBZ0IsUUFBUSxDQUFDLENBQUM7QUFBQSxJQUNsQyxDQUFDO0FBRUQsU0FBSyw2QkFBNkIsTUFBTTtBQUN2QyxZQUFNLHlCQUF5QixDQUFDLFNBQStDO0FBQzlFLFlBQUksT0FBTyxTQUFTLFlBQVksQ0FBQyxNQUFNO0FBQ3RDLGlCQUFPLGVBQWUsWUFBWSxJQUFJO0FBQUEsUUFDdkM7QUFDQSxlQUFPO0FBQUEsTUFDUjtBQUNBLFlBQU0sbUJBQW1CLENBQUMsR0FBeUMsTUFBNEM7QUFDOUcsZUFBTyxZQUFZLG1CQUFtQix1QkFBdUIsdUJBQXVCLENBQUMsR0FBRyx1QkFBdUIsQ0FBQyxDQUFDLEdBQUcsSUFBSTtBQUFBLE1BQ3pIO0FBQ0EsWUFBTSxzQkFBc0IsQ0FBQyxHQUF5QyxNQUE0QztBQUNqSCxlQUFPLFlBQVksbUJBQW1CLHVCQUF1Qix1QkFBdUIsQ0FBQyxHQUFHLHVCQUF1QixDQUFDLENBQUMsR0FBRyxLQUFLO0FBQUEsTUFDMUg7QUFFQSx1QkFBaUIsTUFBTSxJQUFJO0FBQzNCLHVCQUFpQixNQUFNLGVBQWUsS0FBSyxDQUFDO0FBQzVDLHVCQUFpQixlQUFlLEtBQUssR0FBRyxJQUFJO0FBQzVDLHVCQUFpQixlQUFlLEtBQUssR0FBRyxlQUFlLEtBQUssQ0FBQztBQUM3RCx1QkFBaUIsUUFBUSxJQUFJO0FBQzdCLHVCQUFpQixRQUFRLEVBQUU7QUFDM0IsdUJBQWlCLFFBQVEsTUFBTTtBQUMvQix1QkFBaUIsUUFBUSxlQUFlLEtBQUssQ0FBQztBQUM5Qyx1QkFBaUIsU0FBUyxFQUFFO0FBQzVCLHVCQUFpQixTQUFTLE9BQU87QUFDakMsdUJBQWlCLFFBQVEsRUFBRTtBQUMzQix1QkFBaUIsUUFBUSxNQUFNO0FBQy9CLHVCQUFpQixnQ0FBZ0MsTUFBTTtBQUN2RCx1QkFBaUIsZ0JBQWdCLE1BQU07QUFDdkMsdUJBQWlCLGdCQUFnQixNQUFNO0FBQ3ZDLHVCQUFpQixnQkFBZ0IsRUFBRTtBQUNuQyx1QkFBaUIsUUFBUSxjQUFjO0FBQ3ZDLHVCQUFpQixpQkFBaUIsZUFBZTtBQUNqRCx1QkFBaUIsUUFBUSxzQkFBc0I7QUFFL0MsMEJBQW9CLFFBQVEsT0FBTztBQUNuQywwQkFBb0IsU0FBUyxNQUFNO0FBQ25DLDBCQUFvQixnQkFBZ0IsTUFBTTtBQUMxQywwQkFBb0IsZ0JBQWdCLE1BQU07QUFDMUMsMEJBQW9CLFFBQVEsTUFBTTtBQUNsQywwQkFBb0IsZ0JBQWdCLE1BQU07QUFDMUMsMEJBQW9CLElBQUksTUFBTTtBQUM5QiwwQkFBb0IsTUFBTSxNQUFNO0FBQUEsSUFDakMsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELFFBQU0sbUJBQW1CLE1BQU07QUFFOUIsYUFBUyxRQUFRLFlBQStCLFNBQWlCLE1BQWdFO0FBQ2hJLGFBQU8sT0FBTyxZQUFZLFNBQVMsTUFBTSxNQUFNLElBQUk7QUFBQSxJQUNwRDtBQUVBLFVBQU0sUUFBUTtBQUFBO0FBQUEsTUFFYjtBQUFBLFFBQ0MsUUFBUTtBQUFBLFFBQ1I7QUFBQSxRQUNBLGVBQWU7QUFBQSxVQUNkLGVBQWUsT0FBTyxRQUFRLElBQUk7QUFBQSxVQUNsQyxlQUFlLFVBQVUsUUFBUSxLQUFLO0FBQUEsUUFDdkM7QUFBQSxNQUNEO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQyxRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0EsZUFBZSxPQUFPLFFBQVEsSUFBSTtBQUFBLE1BQ25DO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQyxRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQyxRQUFRO0FBQUEsUUFDUjtBQUFBLFFBQ0EsZUFBZSxPQUFPLFFBQVEsSUFBSTtBQUFBLE1BQ25DO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQyxPQUFPLFVBQVUsUUFBUTtBQUFBLFFBQ3pCO0FBQUEsUUFDQSxlQUFlLE9BQU8sUUFBUSxJQUFJO0FBQUEsTUFDbkM7QUFBQTtBQUFBLE1BRUE7QUFBQSxRQUNDLFNBQVMsT0FBTyxVQUFVLFFBQVEsTUFBTSxRQUFRLElBQUk7QUFBQSxRQUNwRDtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUE7QUFBQSxNQUVBO0FBQUEsUUFDQztBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLFNBQVMsT0FBTyxVQUFVLFFBQVEsTUFBTSxPQUFPLFVBQVUsUUFBUSxJQUFJO0FBQUEsUUFDckU7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLFNBQVMsT0FBTyxVQUFVLFFBQVEsTUFBTSxPQUFPLFVBQVUsUUFBUSxJQUFJO0FBQUEsUUFDckU7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLFNBQVMsT0FBTyxVQUFVLFFBQVEsTUFBTSxPQUFPLFVBQVUsUUFBUSxJQUFJO0FBQUEsUUFDckU7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLFNBQVMsT0FBTyxVQUFVLFFBQVEsTUFBTSxPQUFPLFVBQVUsUUFBUSxJQUFJO0FBQUE7QUFBQSxRQUNyRTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEs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
