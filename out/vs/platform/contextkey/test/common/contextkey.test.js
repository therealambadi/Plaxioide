import assert from "assert";
import { isLinux, isMacintosh, isWindows } from "../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { ContextKeyExpr, implies } from "../../common/contextkey.js";
function createContext(ctx) {
  return {
    getValue: (key) => {
      return ctx[key];
    }
  };
}
suite("ContextKeyExpr", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("ContextKeyExpr.equals", () => {
    const a = ContextKeyExpr.and(
      ContextKeyExpr.has("a1"),
      ContextKeyExpr.and(ContextKeyExpr.has("and.a")),
      ContextKeyExpr.has("a2"),
      ContextKeyExpr.regex("d3", /d.*/),
      ContextKeyExpr.regex("d4", /\*\*3*/),
      ContextKeyExpr.equals("b1", "bb1"),
      ContextKeyExpr.equals("b2", "bb2"),
      ContextKeyExpr.notEquals("c1", "cc1"),
      ContextKeyExpr.notEquals("c2", "cc2"),
      ContextKeyExpr.not("d1"),
      ContextKeyExpr.not("d2")
    );
    const b = ContextKeyExpr.and(
      ContextKeyExpr.equals("b2", "bb2"),
      ContextKeyExpr.notEquals("c1", "cc1"),
      ContextKeyExpr.not("d1"),
      ContextKeyExpr.regex("d4", /\*\*3*/),
      ContextKeyExpr.notEquals("c2", "cc2"),
      ContextKeyExpr.has("a2"),
      ContextKeyExpr.equals("b1", "bb1"),
      ContextKeyExpr.regex("d3", /d.*/),
      ContextKeyExpr.has("a1"),
      ContextKeyExpr.and(ContextKeyExpr.equals("and.a", true)),
      ContextKeyExpr.not("d2")
    );
    assert(a.equals(b), "expressions should be equal");
  });
  test("issue #134942: Equals in comparator expressions", () => {
    function testEquals(expr, str) {
      const deserialized = ContextKeyExpr.deserialize(str);
      assert.ok(expr);
      assert.ok(deserialized);
      assert.strictEqual(expr.equals(deserialized), true, str);
    }
    testEquals(ContextKeyExpr.greater("value", 0), "value > 0");
    testEquals(ContextKeyExpr.greaterEquals("value", 0), "value >= 0");
    testEquals(ContextKeyExpr.smaller("value", 0), "value < 0");
    testEquals(ContextKeyExpr.smallerEquals("value", 0), "value <= 0");
  });
  test("normalize", () => {
    const key1IsTrue = ContextKeyExpr.equals("key1", true);
    const key1IsNotFalse = ContextKeyExpr.notEquals("key1", false);
    const key1IsFalse = ContextKeyExpr.equals("key1", false);
    const key1IsNotTrue = ContextKeyExpr.notEquals("key1", true);
    assert.ok(key1IsTrue.equals(ContextKeyExpr.has("key1")));
    assert.ok(key1IsNotFalse.equals(ContextKeyExpr.has("key1")));
    assert.ok(key1IsFalse.equals(ContextKeyExpr.not("key1")));
    assert.ok(key1IsNotTrue.equals(ContextKeyExpr.not("key1")));
  });
  test("evaluate", () => {
    const context = createContext({
      "a": true,
      "b": false,
      "c": "5",
      "d": "d"
    });
    function testExpression(expr, expected) {
      const rules = ContextKeyExpr.deserialize(expr);
      assert.strictEqual(rules.evaluate(context), expected, expr);
    }
    function testBatch(expr, value) {
      testExpression(expr, !!value);
      testExpression(expr + " == true", !!value);
      testExpression(expr + " != true", !value);
      testExpression(expr + " == false", !value);
      testExpression(expr + " != false", !!value);
      testExpression(expr + " == 5", value == "5");
      testExpression(expr + " != 5", value != "5");
      testExpression("!" + expr, !value);
      testExpression(expr + " =~ /d.*/", /d.*/.test(value));
      testExpression(expr + " =~ /D/i", /D/i.test(value));
    }
    testBatch("a", true);
    testBatch("b", false);
    testBatch("c", "5");
    testBatch("d", "d");
    testBatch("z", void 0);
    testExpression("true", true);
    testExpression("false", false);
    testExpression("a && !b", true);
    testExpression("a && b", false);
    testExpression("a && !b && c == 5", true);
    testExpression("d =~ /e.*/", false);
    testExpression("b && a || a", true);
    testExpression("a || b", true);
    testExpression("b || b", false);
    testExpression("b && a || a && b", false);
  });
  test("negate", () => {
    function testNegate(expr, expected) {
      const actual = ContextKeyExpr.deserialize(expr).negate().serialize();
      assert.strictEqual(actual, expected);
    }
    testNegate("true", "false");
    testNegate("false", "true");
    testNegate("a", "!a");
    testNegate("a && b || c", "!a && !c || !b && !c");
    testNegate("a && b || c || d", "!a && !c && !d || !b && !c && !d");
    testNegate("!a && !b || !c && !d", "a && c || a && d || b && c || b && d");
    testNegate("!a && !b || !c && !d || !e && !f", "a && c && e || a && c && f || a && d && e || a && d && f || b && c && e || b && c && f || b && d && e || b && d && f");
  });
  test("false, true", () => {
    function testNormalize(expr, expected) {
      const actual = ContextKeyExpr.deserialize(expr).serialize();
      assert.strictEqual(actual, expected);
    }
    testNormalize("true", "true");
    testNormalize("!true", "false");
    testNormalize("false", "false");
    testNormalize("!false", "true");
    testNormalize("a && true", "a");
    testNormalize("a && false", "false");
    testNormalize("a || true", "true");
    testNormalize("a || false", "a");
    testNormalize("isMac", isMacintosh ? "true" : "false");
    testNormalize("isLinux", isLinux ? "true" : "false");
    testNormalize("isWindows", isWindows ? "true" : "false");
  });
  test("issue #101015: distribute OR", () => {
    function t(expr1, expr2, expected) {
      const e1 = ContextKeyExpr.deserialize(expr1);
      const e2 = ContextKeyExpr.deserialize(expr2);
      const actual = ContextKeyExpr.and(e1, e2)?.serialize();
      assert.strictEqual(actual, expected);
    }
    t("a", "b", "a && b");
    t("a || b", "c", "a && c || b && c");
    t("a || b", "c || d", "a && c || a && d || b && c || b && d");
    t("a || b", "c && d", "a && c && d || b && c && d");
    t("a || b", "c && d || e", "a && e || b && e || a && c && d || b && c && d");
  });
  test("ContextKeyInExpr", () => {
    const ainb = ContextKeyExpr.deserialize("a in b");
    assert.strictEqual(ainb.evaluate(createContext({ "a": 3, "b": [3, 2, 1] })), true);
    assert.strictEqual(ainb.evaluate(createContext({ "a": 3, "b": [1, 2, 3] })), true);
    assert.strictEqual(ainb.evaluate(createContext({ "a": 3, "b": [1, 2] })), false);
    assert.strictEqual(ainb.evaluate(createContext({ "a": 3 })), false);
    assert.strictEqual(ainb.evaluate(createContext({ "a": 3, "b": null })), false);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "x", "b": ["x"] })), true);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "x", "b": ["y"] })), false);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "x", "b": {} })), false);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "x", "b": { "x": false } })), true);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "x", "b": { "x": true } })), true);
    assert.strictEqual(ainb.evaluate(createContext({ "a": "prototype", "b": {} })), false);
  });
  test("ContextKeyNotInExpr", () => {
    const aNotInB = ContextKeyExpr.deserialize("a not in b");
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": 3, "b": [3, 2, 1] })), false);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": 3, "b": [1, 2, 3] })), false);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": 3, "b": [1, 2] })), true);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": 3 })), true);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": 3, "b": null })), true);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "x", "b": ["x"] })), false);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "x", "b": ["y"] })), true);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "x", "b": {} })), true);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "x", "b": { "x": false } })), false);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "x", "b": { "x": true } })), false);
    assert.strictEqual(aNotInB.evaluate(createContext({ "a": "prototype", "b": {} })), true);
  });
  test("issue #106524: distributing AND should normalize", () => {
    const actual = ContextKeyExpr.and(
      ContextKeyExpr.or(
        ContextKeyExpr.has("a"),
        ContextKeyExpr.has("b")
      ),
      ContextKeyExpr.has("c")
    );
    const expected = ContextKeyExpr.or(
      ContextKeyExpr.and(
        ContextKeyExpr.has("a"),
        ContextKeyExpr.has("c")
      ),
      ContextKeyExpr.and(
        ContextKeyExpr.has("b"),
        ContextKeyExpr.has("c")
      )
    );
    assert.strictEqual(actual.equals(expected), true);
  });
  test("issue #129625: Removes duplicated terms in OR expressions", () => {
    const expr = ContextKeyExpr.or(
      ContextKeyExpr.has("A"),
      ContextKeyExpr.has("B"),
      ContextKeyExpr.has("A")
    );
    assert.strictEqual(expr.serialize(), "A || B");
  });
  test("Resolves true constant OR expressions", () => {
    const expr = ContextKeyExpr.or(
      ContextKeyExpr.has("A"),
      ContextKeyExpr.not("A")
    );
    assert.strictEqual(expr.serialize(), "true");
  });
  test("Resolves false constant AND expressions", () => {
    const expr = ContextKeyExpr.and(
      ContextKeyExpr.has("A"),
      ContextKeyExpr.not("A")
    );
    assert.strictEqual(expr.serialize(), "false");
  });
  test("issue #129625: Removes duplicated terms in AND expressions", () => {
    const expr = ContextKeyExpr.and(
      ContextKeyExpr.has("A"),
      ContextKeyExpr.has("B"),
      ContextKeyExpr.has("A")
    );
    assert.strictEqual(expr.serialize(), "A && B");
  });
  test("issue #129625: Remove duplicated terms when negating", () => {
    const expr = ContextKeyExpr.and(
      ContextKeyExpr.has("A"),
      ContextKeyExpr.or(
        ContextKeyExpr.has("B1"),
        ContextKeyExpr.has("B2")
      )
    );
    assert.strictEqual(expr.serialize(), "A && B1 || A && B2");
    assert.strictEqual(expr.negate().serialize(), "!A || !A && !B1 || !A && !B2 || !B1 && !B2");
    assert.strictEqual(expr.negate().negate().serialize(), "A && B1 || A && B2");
    assert.strictEqual(expr.negate().negate().negate().serialize(), "!A || !A && !B1 || !A && !B2 || !B1 && !B2");
  });
  test("issue #129625: remove redundant terms in OR expressions", () => {
    function strImplies(p0, q0) {
      const p = ContextKeyExpr.deserialize(p0);
      const q = ContextKeyExpr.deserialize(q0);
      return implies(p, q);
    }
    assert.strictEqual(strImplies("a && b", "a"), true);
    assert.strictEqual(strImplies("a", "a && b"), false);
  });
  test("implies", () => {
    function strImplies(p0, q0) {
      const p = ContextKeyExpr.deserialize(p0);
      const q = ContextKeyExpr.deserialize(q0);
      return implies(p, q);
    }
    assert.strictEqual(strImplies("a", "a"), true);
    assert.strictEqual(strImplies("a", "a || b"), true);
    assert.strictEqual(strImplies("a", "a && b"), false);
    assert.strictEqual(strImplies("a", "a && b || a && c"), false);
    assert.strictEqual(strImplies("a && b", "a"), true);
    assert.strictEqual(strImplies("a && b", "b"), true);
    assert.strictEqual(strImplies("a && b", "a && b || c"), true);
    assert.strictEqual(strImplies("a || b", "a || c"), false);
    assert.strictEqual(strImplies("a || b", "a || b"), true);
    assert.strictEqual(strImplies("a && b", "a && b"), true);
    assert.strictEqual(strImplies("a || b", "a || b || c"), true);
    assert.strictEqual(strImplies("c && a && b", "c && a"), true);
  });
  test("Greater, GreaterEquals, Smaller, SmallerEquals evaluate", () => {
    function checkEvaluate(expr, ctx, expected) {
      const _expr = ContextKeyExpr.deserialize(expr);
      assert.strictEqual(_expr.evaluate(createContext(ctx)), expected);
    }
    checkEvaluate("a > 1", {}, false);
    checkEvaluate("a > 1", { a: 0 }, false);
    checkEvaluate("a > 1", { a: 1 }, false);
    checkEvaluate("a > 1", { a: 2 }, true);
    checkEvaluate("a > 1", { a: "0" }, false);
    checkEvaluate("a > 1", { a: "1" }, false);
    checkEvaluate("a > 1", { a: "2" }, true);
    checkEvaluate("a > 1", { a: "a" }, false);
    checkEvaluate("a > 10", { a: 2 }, false);
    checkEvaluate("a > 10", { a: 11 }, true);
    checkEvaluate("a > 10", { a: "11" }, true);
    checkEvaluate("a > 10", { a: "2" }, false);
    checkEvaluate("a > 10", { a: "11" }, true);
    checkEvaluate("a > 1.1", { a: 1 }, false);
    checkEvaluate("a > 1.1", { a: 2 }, true);
    checkEvaluate("a > 1.1", { a: 11 }, true);
    checkEvaluate("a > 1.1", { a: "1.1" }, false);
    checkEvaluate("a > 1.1", { a: "2" }, true);
    checkEvaluate("a > 1.1", { a: "11" }, true);
    checkEvaluate("a > b", { a: "b" }, false);
    checkEvaluate("a > b", { a: "c" }, false);
    checkEvaluate("a > b", { a: 1e3 }, false);
    checkEvaluate("a >= 2", { a: "1" }, false);
    checkEvaluate("a >= 2", { a: "2" }, true);
    checkEvaluate("a >= 2", { a: "3" }, true);
    checkEvaluate("a < 2", { a: "1" }, true);
    checkEvaluate("a < 2", { a: "2" }, false);
    checkEvaluate("a < 2", { a: "3" }, false);
    checkEvaluate("a <= 2", { a: "1" }, true);
    checkEvaluate("a <= 2", { a: "2" }, true);
    checkEvaluate("a <= 2", { a: "3" }, false);
  });
  test("Greater, GreaterEquals, Smaller, SmallerEquals negate", () => {
    function checkNegate(expr, expected) {
      const a = ContextKeyExpr.deserialize(expr);
      const b = a.negate();
      assert.strictEqual(b.serialize(), expected);
    }
    checkNegate("a > 1", "a <= 1");
    checkNegate("a > 1.1", "a <= 1.1");
    checkNegate("a > b", "a <= b");
    checkNegate("a >= 1", "a < 1");
    checkNegate("a >= 1.1", "a < 1.1");
    checkNegate("a >= b", "a < b");
    checkNegate("a < 1", "a >= 1");
    checkNegate("a < 1.1", "a >= 1.1");
    checkNegate("a < b", "a >= b");
    checkNegate("a <= 1", "a > 1");
    checkNegate("a <= 1.1", "a > 1.1");
    checkNegate("a <= b", "a > b");
  });
  test("issue #111899: context keys can use `<` or `>` ", () => {
    const actual = ContextKeyExpr.deserialize("editorTextFocus && vim.active && vim.use<C-r>");
    assert.ok(actual.equals(
      ContextKeyExpr.and(
        ContextKeyExpr.has("editorTextFocus"),
        ContextKeyExpr.has("vim.active"),
        ContextKeyExpr.has("vim.use<C-r>")
      )
    ));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9jb250ZXh0a2V5L3Rlc3QvY29tbW9uL2NvbnRleHRrZXkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc01hY2ludG9zaCwgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgQ29udGV4dEtleUV4cHJlc3Npb24sIGltcGxpZXMgfSBmcm9tICcuLi8uLi9jb21tb24vY29udGV4dGtleS5qcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUNvbnRleHQoY3R4OiBhbnkpIHtcblx0cmV0dXJuIHtcblx0XHRnZXRWYWx1ZTogKGtleTogc3RyaW5nKSA9PiB7XG5cdFx0XHRyZXR1cm4gY3R4W2tleV07XG5cdFx0fVxuXHR9O1xufVxuXG5zdWl0ZSgnQ29udGV4dEtleUV4cHInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnQ29udGV4dEtleUV4cHIuZXF1YWxzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGEgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2ExJyksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuaGFzKCdhbmQuYScpKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnYTInKSxcblx0XHRcdENvbnRleHRLZXlFeHByLnJlZ2V4KCdkMycsIC9kLiovKSxcblx0XHRcdENvbnRleHRLZXlFeHByLnJlZ2V4KCdkNCcsIC9cXCpcXCozKi8pLFxuXHRcdFx0Q29udGV4dEtleUV4cHIuZXF1YWxzKCdiMScsICdiYjEnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnYjInLCAnYmIyJyksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2MxJywgJ2NjMScpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjMicsICdjYzInKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm5vdCgnZDEnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm5vdCgnZDInKVxuXHRcdCkhO1xuXHRcdGNvbnN0IGIgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2IyJywgJ2JiMicpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjMScsICdjYzEnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm5vdCgnZDEnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLnJlZ2V4KCdkNCcsIC9cXCpcXCozKi8pLFxuXHRcdFx0Q29udGV4dEtleUV4cHIubm90RXF1YWxzKCdjMicsICdjYzInKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnYTInKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmVxdWFscygnYjEnLCAnYmIxJyksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5yZWdleCgnZDMnLCAvZC4qLyksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2ExJyksXG5cdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoQ29udGV4dEtleUV4cHIuZXF1YWxzKCdhbmQuYScsIHRydWUpKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm5vdCgnZDInKVxuXHRcdCkhO1xuXHRcdGFzc2VydChhLmVxdWFscyhiKSwgJ2V4cHJlc3Npb25zIHNob3VsZCBiZSBlcXVhbCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTM0OTQyOiBFcXVhbHMgaW4gY29tcGFyYXRvciBleHByZXNzaW9ucycsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0RXF1YWxzKGV4cHI6IENvbnRleHRLZXlFeHByZXNzaW9uIHwgdW5kZWZpbmVkLCBzdHI6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0Y29uc3QgZGVzZXJpYWxpemVkID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoc3RyKTtcblx0XHRcdGFzc2VydC5vayhleHByKTtcblx0XHRcdGFzc2VydC5vayhkZXNlcmlhbGl6ZWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cHIuZXF1YWxzKGRlc2VyaWFsaXplZCksIHRydWUsIHN0cik7XG5cdFx0fVxuXHRcdHRlc3RFcXVhbHMoQ29udGV4dEtleUV4cHIuZ3JlYXRlcigndmFsdWUnLCAwKSwgJ3ZhbHVlID4gMCcpO1xuXHRcdHRlc3RFcXVhbHMoQ29udGV4dEtleUV4cHIuZ3JlYXRlckVxdWFscygndmFsdWUnLCAwKSwgJ3ZhbHVlID49IDAnKTtcblx0XHR0ZXN0RXF1YWxzKENvbnRleHRLZXlFeHByLnNtYWxsZXIoJ3ZhbHVlJywgMCksICd2YWx1ZSA8IDAnKTtcblx0XHR0ZXN0RXF1YWxzKENvbnRleHRLZXlFeHByLnNtYWxsZXJFcXVhbHMoJ3ZhbHVlJywgMCksICd2YWx1ZSA8PSAwJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ25vcm1hbGl6ZScsICgpID0+IHtcblx0XHRjb25zdCBrZXkxSXNUcnVlID0gQ29udGV4dEtleUV4cHIuZXF1YWxzKCdrZXkxJywgdHJ1ZSk7XG5cdFx0Y29uc3Qga2V5MUlzTm90RmFsc2UgPSBDb250ZXh0S2V5RXhwci5ub3RFcXVhbHMoJ2tleTEnLCBmYWxzZSk7XG5cdFx0Y29uc3Qga2V5MUlzRmFsc2UgPSBDb250ZXh0S2V5RXhwci5lcXVhbHMoJ2tleTEnLCBmYWxzZSk7XG5cdFx0Y29uc3Qga2V5MUlzTm90VHJ1ZSA9IENvbnRleHRLZXlFeHByLm5vdEVxdWFscygna2V5MScsIHRydWUpO1xuXG5cdFx0YXNzZXJ0Lm9rKGtleTFJc1RydWUuZXF1YWxzKENvbnRleHRLZXlFeHByLmhhcygna2V5MScpKSk7XG5cdFx0YXNzZXJ0Lm9rKGtleTFJc05vdEZhbHNlLmVxdWFscyhDb250ZXh0S2V5RXhwci5oYXMoJ2tleTEnKSkpO1xuXHRcdGFzc2VydC5vayhrZXkxSXNGYWxzZS5lcXVhbHMoQ29udGV4dEtleUV4cHIubm90KCdrZXkxJykpKTtcblx0XHRhc3NlcnQub2soa2V5MUlzTm90VHJ1ZS5lcXVhbHMoQ29udGV4dEtleUV4cHIubm90KCdrZXkxJykpKTtcblx0fSk7XG5cblx0dGVzdCgnZXZhbHVhdGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGV4dCA9IGNyZWF0ZUNvbnRleHQoe1xuXHRcdFx0J2EnOiB0cnVlLFxuXHRcdFx0J2InOiBmYWxzZSxcblx0XHRcdCdjJzogJzUnLFxuXHRcdFx0J2QnOiAnZCdcblx0XHR9KTtcblx0XHRmdW5jdGlvbiB0ZXN0RXhwcmVzc2lvbihleHByOiBzdHJpbmcsIGV4cGVjdGVkOiBib29sZWFuKTogdm9pZCB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZyhleHByICsgJyAnICsgZXhwZWN0ZWQpO1xuXHRcdFx0Y29uc3QgcnVsZXMgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShleHByKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChydWxlcyEuZXZhbHVhdGUoY29udGV4dCksIGV4cGVjdGVkLCBleHByKTtcblx0XHR9XG5cdFx0ZnVuY3Rpb24gdGVzdEJhdGNoKGV4cHI6IHN0cmluZywgdmFsdWU6IGFueSk6IHZvaWQge1xuXHRcdFx0LyogZXNsaW50LWRpc2FibGUgZXFlcWVxICovXG5cdFx0XHR0ZXN0RXhwcmVzc2lvbihleHByLCAhIXZhbHVlKTtcblx0XHRcdHRlc3RFeHByZXNzaW9uKGV4cHIgKyAnID09IHRydWUnLCAhIXZhbHVlKTtcblx0XHRcdHRlc3RFeHByZXNzaW9uKGV4cHIgKyAnICE9IHRydWUnLCAhdmFsdWUpO1xuXHRcdFx0dGVzdEV4cHJlc3Npb24oZXhwciArICcgPT0gZmFsc2UnLCAhdmFsdWUpO1xuXHRcdFx0dGVzdEV4cHJlc3Npb24oZXhwciArICcgIT0gZmFsc2UnLCAhIXZhbHVlKTtcblx0XHRcdHRlc3RFeHByZXNzaW9uKGV4cHIgKyAnID09IDUnLCB2YWx1ZSA9PSA8YW55Pic1Jyk7XG5cdFx0XHR0ZXN0RXhwcmVzc2lvbihleHByICsgJyAhPSA1JywgdmFsdWUgIT0gPGFueT4nNScpO1xuXHRcdFx0dGVzdEV4cHJlc3Npb24oJyEnICsgZXhwciwgIXZhbHVlKTtcblx0XHRcdHRlc3RFeHByZXNzaW9uKGV4cHIgKyAnID1+IC9kLiovJywgL2QuKi8udGVzdCh2YWx1ZSkpO1xuXHRcdFx0dGVzdEV4cHJlc3Npb24oZXhwciArICcgPX4gL0QvaScsIC9EL2kudGVzdCh2YWx1ZSkpO1xuXHRcdFx0LyogZXNsaW50LWVuYWJsZSBlcWVxZXEgKi9cblx0XHR9XG5cblx0XHR0ZXN0QmF0Y2goJ2EnLCB0cnVlKTtcblx0XHR0ZXN0QmF0Y2goJ2InLCBmYWxzZSk7XG5cdFx0dGVzdEJhdGNoKCdjJywgJzUnKTtcblx0XHR0ZXN0QmF0Y2goJ2QnLCAnZCcpO1xuXHRcdHRlc3RCYXRjaCgneicsIHVuZGVmaW5lZCk7XG5cblx0XHR0ZXN0RXhwcmVzc2lvbigndHJ1ZScsIHRydWUpO1xuXHRcdHRlc3RFeHByZXNzaW9uKCdmYWxzZScsIGZhbHNlKTtcblx0XHR0ZXN0RXhwcmVzc2lvbignYSAmJiAhYicsIHRydWUgJiYgIWZhbHNlKTtcblx0XHR0ZXN0RXhwcmVzc2lvbignYSAmJiBiJywgdHJ1ZSAmJiBmYWxzZSk7XG5cdFx0dGVzdEV4cHJlc3Npb24oJ2EgJiYgIWIgJiYgYyA9PSA1JywgdHJ1ZSAmJiAhZmFsc2UgJiYgJzUnID09PSAnNScpO1xuXHRcdHRlc3RFeHByZXNzaW9uKCdkID1+IC9lLiovJywgZmFsc2UpO1xuXG5cdFx0Ly8gcHJlY2VkZW5jZSB0ZXN0OiBmYWxzZSAmJiB0cnVlIHx8IHRydWUgPT09IHRydWUgYmVjYXVzZSAmJiBpcyBldmFsdWF0ZWQgZmlyc3Rcblx0XHR0ZXN0RXhwcmVzc2lvbignYiAmJiBhIHx8IGEnLCB0cnVlKTtcblxuXHRcdHRlc3RFeHByZXNzaW9uKCdhIHx8IGInLCB0cnVlKTtcblx0XHR0ZXN0RXhwcmVzc2lvbignYiB8fCBiJywgZmFsc2UpO1xuXHRcdHRlc3RFeHByZXNzaW9uKCdiICYmIGEgfHwgYSAmJiBiJywgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCduZWdhdGUnLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdGVzdE5lZ2F0ZShleHByOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGV4cHIpIS5uZWdhdGUoKS5zZXJpYWxpemUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHR9XG5cdFx0dGVzdE5lZ2F0ZSgndHJ1ZScsICdmYWxzZScpO1xuXHRcdHRlc3ROZWdhdGUoJ2ZhbHNlJywgJ3RydWUnKTtcblx0XHR0ZXN0TmVnYXRlKCdhJywgJyFhJyk7XG5cdFx0dGVzdE5lZ2F0ZSgnYSAmJiBiIHx8IGMnLCAnIWEgJiYgIWMgfHwgIWIgJiYgIWMnKTtcblx0XHR0ZXN0TmVnYXRlKCdhICYmIGIgfHwgYyB8fCBkJywgJyFhICYmICFjICYmICFkIHx8ICFiICYmICFjICYmICFkJyk7XG5cdFx0dGVzdE5lZ2F0ZSgnIWEgJiYgIWIgfHwgIWMgJiYgIWQnLCAnYSAmJiBjIHx8IGEgJiYgZCB8fCBiICYmIGMgfHwgYiAmJiBkJyk7XG5cdFx0dGVzdE5lZ2F0ZSgnIWEgJiYgIWIgfHwgIWMgJiYgIWQgfHwgIWUgJiYgIWYnLCAnYSAmJiBjICYmIGUgfHwgYSAmJiBjICYmIGYgfHwgYSAmJiBkICYmIGUgfHwgYSAmJiBkICYmIGYgfHwgYiAmJiBjICYmIGUgfHwgYiAmJiBjICYmIGYgfHwgYiAmJiBkICYmIGUgfHwgYiAmJiBkICYmIGYnKTtcblx0fSk7XG5cblx0dGVzdCgnZmFsc2UsIHRydWUnLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdGVzdE5vcm1hbGl6ZShleHByOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGV4cHIpIS5zZXJpYWxpemUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0XHR9XG5cdFx0dGVzdE5vcm1hbGl6ZSgndHJ1ZScsICd0cnVlJyk7XG5cdFx0dGVzdE5vcm1hbGl6ZSgnIXRydWUnLCAnZmFsc2UnKTtcblx0XHR0ZXN0Tm9ybWFsaXplKCdmYWxzZScsICdmYWxzZScpO1xuXHRcdHRlc3ROb3JtYWxpemUoJyFmYWxzZScsICd0cnVlJyk7XG5cdFx0dGVzdE5vcm1hbGl6ZSgnYSAmJiB0cnVlJywgJ2EnKTtcblx0XHR0ZXN0Tm9ybWFsaXplKCdhICYmIGZhbHNlJywgJ2ZhbHNlJyk7XG5cdFx0dGVzdE5vcm1hbGl6ZSgnYSB8fCB0cnVlJywgJ3RydWUnKTtcblx0XHR0ZXN0Tm9ybWFsaXplKCdhIHx8IGZhbHNlJywgJ2EnKTtcblx0XHR0ZXN0Tm9ybWFsaXplKCdpc01hYycsIGlzTWFjaW50b3NoID8gJ3RydWUnIDogJ2ZhbHNlJyk7XG5cdFx0dGVzdE5vcm1hbGl6ZSgnaXNMaW51eCcsIGlzTGludXggPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0XHR0ZXN0Tm9ybWFsaXplKCdpc1dpbmRvd3MnLCBpc1dpbmRvd3MgPyAndHJ1ZScgOiAnZmFsc2UnKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzEwMTAxNTogZGlzdHJpYnV0ZSBPUicsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0KGV4cHIxOiBzdHJpbmcsIGV4cHIyOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGUxID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoZXhwcjEpO1xuXHRcdFx0Y29uc3QgZTIgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShleHByMik7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSBDb250ZXh0S2V5RXhwci5hbmQoZTEsIGUyKT8uc2VyaWFsaXplKCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCk7XG5cdFx0fVxuXHRcdHQoJ2EnLCAnYicsICdhICYmIGInKTtcblx0XHR0KCdhIHx8IGInLCAnYycsICdhICYmIGMgfHwgYiAmJiBjJyk7XG5cdFx0dCgnYSB8fCBiJywgJ2MgfHwgZCcsICdhICYmIGMgfHwgYSAmJiBkIHx8IGIgJiYgYyB8fCBiICYmIGQnKTtcblx0XHR0KCdhIHx8IGInLCAnYyAmJiBkJywgJ2EgJiYgYyAmJiBkIHx8IGIgJiYgYyAmJiBkJyk7XG5cdFx0dCgnYSB8fCBiJywgJ2MgJiYgZCB8fCBlJywgJ2EgJiYgZSB8fCBiICYmIGUgfHwgYSAmJiBjICYmIGQgfHwgYiAmJiBjICYmIGQnKTtcblx0fSk7XG5cblx0dGVzdCgnQ29udGV4dEtleUluRXhwcicsICgpID0+IHtcblx0XHRjb25zdCBhaW5iID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoJ2EgaW4gYicpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWluYi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IFszLCAyLCAxXSB9KSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhaW5iLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6IDMsICdiJzogWzEsIDIsIDNdIH0pKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFpbmIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogMywgJ2InOiBbMSwgMl0gfSkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFpbmIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogMyB9KSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWluYi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IG51bGwgfSkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFpbmIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogJ3gnLCAnYic6IFsneCddIH0pKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFpbmIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogJ3gnLCAnYic6IFsneSddIH0pKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhaW5iLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6ICd4JywgJ2InOiB7fSB9KSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWluYi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAneCcsICdiJzogeyAneCc6IGZhbHNlIH0gfSkpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWluYi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAneCcsICdiJzogeyAneCc6IHRydWUgfSB9KSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhaW5iLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6ICdwcm90b3R5cGUnLCAnYic6IHt9IH0pKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdDb250ZXh0S2V5Tm90SW5FeHByJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFOb3RJbkIgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZSgnYSBub3QgaW4gYicpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYU5vdEluQi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IFszLCAyLCAxXSB9KSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYU5vdEluQi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IFsxLCAyLCAzXSB9KSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYU5vdEluQi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IFsxLCAyXSB9KSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhTm90SW5CLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6IDMgfSkpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYU5vdEluQi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAzLCAnYic6IG51bGwgfSkpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYU5vdEluQi5ldmFsdWF0ZShjcmVhdGVDb250ZXh0KHsgJ2EnOiAneCcsICdiJzogWyd4J10gfSkpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFOb3RJbkIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogJ3gnLCAnYic6IFsneSddIH0pKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFOb3RJbkIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogJ3gnLCAnYic6IHt9IH0pKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFOb3RJbkIuZXZhbHVhdGUoY3JlYXRlQ29udGV4dCh7ICdhJzogJ3gnLCAnYic6IHsgJ3gnOiBmYWxzZSB9IH0pKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhTm90SW5CLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6ICd4JywgJ2InOiB7ICd4JzogdHJ1ZSB9IH0pKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhTm90SW5CLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoeyAnYSc6ICdwcm90b3R5cGUnLCAnYic6IHt9IH0pKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMDY1MjQ6IGRpc3RyaWJ1dGluZyBBTkQgc2hvdWxkIG5vcm1hbGl6ZScsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCdhJyksXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnYicpXG5cdFx0XHQpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCdjJylcblx0XHQpO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnYScpLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2MnKVxuXHRcdFx0KSxcblx0XHRcdENvbnRleHRLZXlFeHByLmFuZChcblx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCdiJyksXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnYycpXG5cdFx0XHQpXG5cdFx0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsIS5lcXVhbHMoZXhwZWN0ZWQhKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjk2MjU6IFJlbW92ZXMgZHVwbGljYXRlZCB0ZXJtcyBpbiBPUiBleHByZXNzaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBleHByID0gQ29udGV4dEtleUV4cHIub3IoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ0EnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnQicpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCdBJylcblx0XHQpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci5zZXJpYWxpemUoKSwgJ0EgfHwgQicpO1xuXHR9KTtcblxuXHR0ZXN0KCdSZXNvbHZlcyB0cnVlIGNvbnN0YW50IE9SIGV4cHJlc3Npb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cHIgPSBDb250ZXh0S2V5RXhwci5vcihcblx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnQScpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIubm90KCdBJylcblx0XHQpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci5zZXJpYWxpemUoKSwgJ3RydWUnKTtcblx0fSk7XG5cblx0dGVzdCgnUmVzb2x2ZXMgZmFsc2UgY29uc3RhbnQgQU5EIGV4cHJlc3Npb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cHIgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ0EnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm5vdCgnQScpXG5cdFx0KSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGV4cHIuc2VyaWFsaXplKCksICdmYWxzZScpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTI5NjI1OiBSZW1vdmVzIGR1cGxpY2F0ZWQgdGVybXMgaW4gQU5EIGV4cHJlc3Npb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cHIgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ0EnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnQicpLFxuXHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCdBJylcblx0XHQpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci5zZXJpYWxpemUoKSwgJ0EgJiYgQicpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTI5NjI1OiBSZW1vdmUgZHVwbGljYXRlZCB0ZXJtcyB3aGVuIG5lZ2F0aW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IGV4cHIgPSBDb250ZXh0S2V5RXhwci5hbmQoXG5cdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ0EnKSxcblx0XHRcdENvbnRleHRLZXlFeHByLm9yKFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ0IxJyksXG5cdFx0XHRcdENvbnRleHRLZXlFeHByLmhhcygnQjInKSxcblx0XHRcdClcblx0XHQpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci5zZXJpYWxpemUoKSwgJ0EgJiYgQjEgfHwgQSAmJiBCMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHByLm5lZ2F0ZSgpIS5zZXJpYWxpemUoKSwgJyFBIHx8ICFBICYmICFCMSB8fCAhQSAmJiAhQjIgfHwgIUIxICYmICFCMicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHByLm5lZ2F0ZSgpIS5uZWdhdGUoKSEuc2VyaWFsaXplKCksICdBICYmIEIxIHx8IEEgJiYgQjInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXhwci5uZWdhdGUoKSEubmVnYXRlKCkhLm5lZ2F0ZSgpIS5zZXJpYWxpemUoKSwgJyFBIHx8ICFBICYmICFCMSB8fCAhQSAmJiAhQjIgfHwgIUIxICYmICFCMicpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTI5NjI1OiByZW1vdmUgcmVkdW5kYW50IHRlcm1zIGluIE9SIGV4cHJlc3Npb25zJywgKCkgPT4ge1xuXHRcdGZ1bmN0aW9uIHN0ckltcGxpZXMocDA6IHN0cmluZywgcTA6IHN0cmluZyk6IGJvb2xlYW4ge1xuXHRcdFx0Y29uc3QgcCA9IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKHAwKSE7XG5cdFx0XHRjb25zdCBxID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUocTApITtcblx0XHRcdHJldHVybiBpbXBsaWVzKHAsIHEpO1xuXHRcdH1cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RySW1wbGllcygnYSAmJiBiJywgJ2EnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2EnLCAnYSAmJiBiJyksIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaW1wbGllcycsICgpID0+IHtcblx0XHRmdW5jdGlvbiBzdHJJbXBsaWVzKHAwOiBzdHJpbmcsIHEwOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdGNvbnN0IHAgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShwMCkhO1xuXHRcdFx0Y29uc3QgcSA9IENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKHEwKSE7XG5cdFx0XHRyZXR1cm4gaW1wbGllcyhwLCBxKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2EnLCAnYScpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RySW1wbGllcygnYScsICdhIHx8IGInKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2EnLCAnYSAmJiBiJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RySW1wbGllcygnYScsICdhICYmIGIgfHwgYSAmJiBjJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3RySW1wbGllcygnYSAmJiBiJywgJ2EnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2EgJiYgYicsICdiJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJJbXBsaWVzKCdhICYmIGInLCAnYSAmJiBiIHx8IGMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2EgfHwgYicsICdhIHx8IGMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJJbXBsaWVzKCdhIHx8IGInLCAnYSB8fCBiJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJJbXBsaWVzKCdhICYmIGInLCAnYSAmJiBiJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzdHJJbXBsaWVzKCdhIHx8IGInLCAnYSB8fCBiIHx8IGMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN0ckltcGxpZXMoJ2MgJiYgYSAmJiBiJywgJ2MgJiYgYScpLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnR3JlYXRlciwgR3JlYXRlckVxdWFscywgU21hbGxlciwgU21hbGxlckVxdWFscyBldmFsdWF0ZScsICgpID0+IHtcblx0XHRmdW5jdGlvbiBjaGVja0V2YWx1YXRlKGV4cHI6IHN0cmluZywgY3R4OiBhbnksIGV4cGVjdGVkOiBhbnkpOiB2b2lkIHtcblx0XHRcdGNvbnN0IF9leHByID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoZXhwcikhO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKF9leHByLmV2YWx1YXRlKGNyZWF0ZUNvbnRleHQoY3R4KSksIGV4cGVjdGVkKTtcblx0XHR9XG5cblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMScsIHt9LCBmYWxzZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEnLCB7IGE6IDAgfSwgZmFsc2UpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPiAxJywgeyBhOiAxIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMScsIHsgYTogMiB9LCB0cnVlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMScsIHsgYTogJzAnIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMScsIHsgYTogJzEnIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMScsIHsgYTogJzInIH0sIHRydWUpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPiAxJywgeyBhOiAnYScgfSwgZmFsc2UpO1xuXG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEwJywgeyBhOiAyIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMTAnLCB7IGE6IDExIH0sIHRydWUpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPiAxMCcsIHsgYTogJzExJyB9LCB0cnVlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMTAnLCB7IGE6ICcyJyB9LCBmYWxzZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEwJywgeyBhOiAnMTEnIH0sIHRydWUpO1xuXG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEuMScsIHsgYTogMSB9LCBmYWxzZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEuMScsIHsgYTogMiB9LCB0cnVlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMS4xJywgeyBhOiAxMSB9LCB0cnVlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gMS4xJywgeyBhOiAnMS4xJyB9LCBmYWxzZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+IDEuMScsIHsgYTogJzInIH0sIHRydWUpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPiAxLjEnLCB7IGE6ICcxMScgfSwgdHJ1ZSk7XG5cblx0XHRjaGVja0V2YWx1YXRlKCdhID4gYicsIHsgYTogJ2InIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gYicsIHsgYTogJ2MnIH0sIGZhbHNlKTtcblx0XHRjaGVja0V2YWx1YXRlKCdhID4gYicsIHsgYTogMTAwMCB9LCBmYWxzZSk7XG5cblx0XHRjaGVja0V2YWx1YXRlKCdhID49IDInLCB7IGE6ICcxJyB9LCBmYWxzZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+PSAyJywgeyBhOiAnMicgfSwgdHJ1ZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA+PSAyJywgeyBhOiAnMycgfSwgdHJ1ZSk7XG5cblx0XHRjaGVja0V2YWx1YXRlKCdhIDwgMicsIHsgYTogJzEnIH0sIHRydWUpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPCAyJywgeyBhOiAnMicgfSwgZmFsc2UpO1xuXHRcdGNoZWNrRXZhbHVhdGUoJ2EgPCAyJywgeyBhOiAnMycgfSwgZmFsc2UpO1xuXG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA8PSAyJywgeyBhOiAnMScgfSwgdHJ1ZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA8PSAyJywgeyBhOiAnMicgfSwgdHJ1ZSk7XG5cdFx0Y2hlY2tFdmFsdWF0ZSgnYSA8PSAyJywgeyBhOiAnMycgfSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdHcmVhdGVyLCBHcmVhdGVyRXF1YWxzLCBTbWFsbGVyLCBTbWFsbGVyRXF1YWxzIG5lZ2F0ZScsICgpID0+IHtcblx0XHRmdW5jdGlvbiBjaGVja05lZ2F0ZShleHByOiBzdHJpbmcsIGV4cGVjdGVkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGEgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShleHByKSE7XG5cdFx0XHRjb25zdCBiID0gYS5uZWdhdGUoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLnNlcmlhbGl6ZSgpLCBleHBlY3RlZCk7XG5cdFx0fVxuXG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPiAxJywgJ2EgPD0gMScpO1xuXHRcdGNoZWNrTmVnYXRlKCdhID4gMS4xJywgJ2EgPD0gMS4xJyk7XG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPiBiJywgJ2EgPD0gYicpO1xuXG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPj0gMScsICdhIDwgMScpO1xuXHRcdGNoZWNrTmVnYXRlKCdhID49IDEuMScsICdhIDwgMS4xJyk7XG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPj0gYicsICdhIDwgYicpO1xuXG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPCAxJywgJ2EgPj0gMScpO1xuXHRcdGNoZWNrTmVnYXRlKCdhIDwgMS4xJywgJ2EgPj0gMS4xJyk7XG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPCBiJywgJ2EgPj0gYicpO1xuXG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPD0gMScsICdhID4gMScpO1xuXHRcdGNoZWNrTmVnYXRlKCdhIDw9IDEuMScsICdhID4gMS4xJyk7XG5cdFx0Y2hlY2tOZWdhdGUoJ2EgPD0gYicsICdhID4gYicpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTExODk5OiBjb250ZXh0IGtleXMgY2FuIHVzZSBgPGAgb3IgYD5gICcsICgpID0+IHtcblx0XHRjb25zdCBhY3R1YWwgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZSgnZWRpdG9yVGV4dEZvY3VzICYmIHZpbS5hY3RpdmUgJiYgdmltLnVzZTxDLXI+JykhO1xuXHRcdGFzc2VydC5vayhhY3R1YWwuZXF1YWxzKFxuXHRcdFx0Q29udGV4dEtleUV4cHIuYW5kKFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ2VkaXRvclRleHRGb2N1cycpLFxuXHRcdFx0XHRDb250ZXh0S2V5RXhwci5oYXMoJ3ZpbS5hY3RpdmUnKSxcblx0XHRcdFx0Q29udGV4dEtleUV4cHIuaGFzKCd2aW0udXNlPEMtcj4nKSxcblx0XHRcdCkhXG5cdFx0KSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxTQUFTLGFBQWEsaUJBQWlCO0FBQ2hELFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsZ0JBQXNDLGVBQWU7QUFFOUQsU0FBUyxjQUFjLEtBQVU7QUFDaEMsU0FBTztBQUFBLElBQ04sVUFBVSxDQUFDLFFBQWdCO0FBQzFCLGFBQU8sSUFBSSxHQUFHO0FBQUEsSUFDZjtBQUFBLEVBQ0Q7QUFDRDtBQUVBLE1BQU0sa0JBQWtCLE1BQU07QUFFN0IsMENBQXdDO0FBRXhDLE9BQUsseUJBQXlCLE1BQU07QUFDbkMsVUFBTSxJQUFJLGVBQWU7QUFBQSxNQUN4QixlQUFlLElBQUksSUFBSTtBQUFBLE1BQ3ZCLGVBQWUsSUFBSSxlQUFlLElBQUksT0FBTyxD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QVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLO0FBQ3RDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJO0FBQ3JDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3ZDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBRXhDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLO0FBQ3ZDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJO0FBQ3ZDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJO0FBQ3pDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3pDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJO0FBRXpDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLEVBQUUsR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLEVBQUUsR0FBRyxJQUFJO0FBQ3ZDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJO0FBQ3hDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLE1BQU0sR0FBRyxLQUFLO0FBQzVDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3pDLGtCQUFjLFdBQVcsRUFBRSxHQUFHLEtBQUssR0FBRyxJQUFJO0FBRTFDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUssR0FBRyxLQUFLO0FBRXpDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3pDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3hDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBRXhDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3ZDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQ3hDLGtCQUFjLFNBQVMsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBRXhDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3hDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxJQUFJO0FBQ3hDLGtCQUFjLFVBQVUsRUFBRSxHQUFHLElBQUksR0FBRyxLQUFLO0FBQUEsRUFDMUMsQ0FBQztBQUVELE9BQUsseURBQXlELE1BQU07QUFDbkUsYUFBUyxZQUFZLE1BQWMsVUFBd0I7QUFDMUQsWUFBTSxJQUFJLGVBQWUsWUFBWSxJQUFJO0FBQ3pDLFlBQU0sSUFBSSxFQUFFLE9BQU87QUFDbkIsYUFBTyxZQUFZLEVBQUUsVUFBVSxHQUFHLFFBQVE7QUFBQSxJQUMzQztBQUVBLGdCQUFZLFNBQVMsUUFBUTtBQUM3QixnQkFBWSxXQUFXLFVBQVU7QUFDakMsZ0JBQVksU0FBUyxRQUFRO0FBRTdCLGdCQUFZLFVBQVUsT0FBTztBQUM3QixnQkFBWSxZQUFZLFNBQVM7QUFDakMsZ0JBQVksVUFBVSxPQUFPO0FBRTdCLGdCQUFZLFNBQVMsUUFBUTtBQUM3QixnQkFBWSxXQUFXLFVBQVU7QUFDakMsZ0JBQVksU0FBUyxRQUFRO0FBRTdCLGdCQUFZLFVBQVUsT0FBTztBQUM3QixnQkFBWSxZQUFZLFNBQVM7QUFDakMsZ0JBQVksVUFBVSxPQUFPO0FBQUEsRUFDOUIsQ0FBQztBQUVELE9BQUssbURBQW1ELE1BQU07QUFDN0QsVUFBTSxTQUFTLGVBQWUsWUFBWSwrQ0FBK0M7QUFDekYsV0FBTyxHQUFHLE9BQU87QUFBQSxNQUNoQixlQUFlO0FBQUEsUUFDZCxlQUFlLElBQUksaUJBQWlCO0FBQUEsUUFDcEMsZUFBZSxJQUFJLFlBQVk7QUFBQSxRQUMvQixlQUFlLElBQUksY0FBYztBQUFBLE1BQ2xDO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
