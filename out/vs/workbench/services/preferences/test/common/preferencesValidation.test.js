import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { createValidator, getInvalidTypeError } from "../../common/preferencesValidation.js";
suite("Preferences Validation", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  class Tester {
    constructor(settings) {
      this.settings = settings;
      this.validator = createValidator(settings);
    }
    accepts(input) {
      assert.strictEqual(this.validator(input), "", `Expected ${JSON.stringify(this.settings)} to accept \`${JSON.stringify(input)}\`. Got ${this.validator(input)}.`);
    }
    rejects(input) {
      assert.notStrictEqual(this.validator(input), "", `Expected ${JSON.stringify(this.settings)} to reject \`${JSON.stringify(input)}\`.`);
      return {
        withMessage: (message) => {
          const actual = this.validator(input);
          assert.ok(actual);
          assert(
            actual.indexOf(message) > -1,
            `Expected error of ${JSON.stringify(this.settings)} on \`${input}\` to contain ${message}. Got ${this.validator(input)}.`
          );
        }
      };
    }
    validatesNumeric() {
      this.accepts("3");
      this.accepts("3.");
      this.accepts(".0");
      this.accepts("3.0");
      this.accepts(" 3.0");
      this.accepts(" 3.0  ");
      this.rejects("3f");
      this.accepts(3);
      this.rejects("test");
    }
    validatesNullableNumeric() {
      this.validatesNumeric();
      this.accepts(0);
      this.accepts("");
      this.accepts(null);
      this.accepts(void 0);
    }
    validatesNonNullableNumeric() {
      this.validatesNumeric();
      this.accepts(0);
      this.rejects("");
      this.rejects(null);
      this.rejects(void 0);
    }
    validatesString() {
      this.accepts("3");
      this.accepts("3.");
      this.accepts(".0");
      this.accepts("3.0");
      this.accepts(" 3.0");
      this.accepts(" 3.0  ");
      this.accepts("");
      this.accepts("3f");
      this.accepts("hello");
      this.rejects(6);
    }
  }
  test("exclusive max and max work together properly", () => {
    {
      const justMax = new Tester({ maximum: 5, type: "number" });
      justMax.validatesNonNullableNumeric();
      justMax.rejects("5.1");
      justMax.accepts("5.0");
    }
    {
      const justEMax = new Tester({ exclusiveMaximum: 5, type: "number" });
      justEMax.validatesNonNullableNumeric();
      justEMax.rejects("5.1");
      justEMax.rejects("5.0");
      justEMax.accepts("4.999");
    }
    {
      const bothNumeric = new Tester({ exclusiveMaximum: 5, maximum: 4, type: "number" });
      bothNumeric.validatesNonNullableNumeric();
      bothNumeric.rejects("5.1");
      bothNumeric.rejects("5.0");
      bothNumeric.rejects("4.999");
      bothNumeric.accepts("4");
    }
    {
      const bothNumeric = new Tester({ exclusiveMaximum: 5, maximum: 6, type: "number" });
      bothNumeric.validatesNonNullableNumeric();
      bothNumeric.rejects("5.1");
      bothNumeric.rejects("5.0");
      bothNumeric.accepts("4.999");
    }
  });
  test("exclusive min and min work together properly", () => {
    {
      const justMin = new Tester({ minimum: -5, type: "number" });
      justMin.validatesNonNullableNumeric();
      justMin.rejects("-5.1");
      justMin.accepts("-5.0");
    }
    {
      const justEMin = new Tester({ exclusiveMinimum: -5, type: "number" });
      justEMin.validatesNonNullableNumeric();
      justEMin.rejects("-5.1");
      justEMin.rejects("-5.0");
      justEMin.accepts("-4.999");
    }
    {
      const bothNumeric = new Tester({ exclusiveMinimum: -5, minimum: -4, type: "number" });
      bothNumeric.validatesNonNullableNumeric();
      bothNumeric.rejects("-5.1");
      bothNumeric.rejects("-5.0");
      bothNumeric.rejects("-4.999");
      bothNumeric.accepts("-4");
    }
    {
      const bothNumeric = new Tester({ exclusiveMinimum: -5, minimum: -6, type: "number" });
      bothNumeric.validatesNonNullableNumeric();
      bothNumeric.rejects("-5.1");
      bothNumeric.rejects("-5.0");
      bothNumeric.accepts("-4.999");
    }
  });
  test("multiple of works for both integers and fractions", () => {
    {
      const onlyEvens = new Tester({ multipleOf: 2, type: "number" });
      onlyEvens.accepts("2.0");
      onlyEvens.accepts("2");
      onlyEvens.accepts("-4");
      onlyEvens.accepts("0");
      onlyEvens.accepts("100");
      onlyEvens.rejects("100.1");
      onlyEvens.rejects("");
      onlyEvens.rejects("we");
    }
    {
      const hackyIntegers = new Tester({ multipleOf: 1, type: "number" });
      hackyIntegers.accepts("2.0");
      hackyIntegers.rejects(".5");
    }
    {
      const halfIntegers = new Tester({ multipleOf: 0.5, type: "number" });
      halfIntegers.accepts("0.5");
      halfIntegers.accepts("1.5");
      halfIntegers.rejects("1.51");
    }
  });
  test("integer type correctly adds a validation", () => {
    {
      const integers = new Tester({ multipleOf: 1, type: "integer" });
      integers.accepts("02");
      integers.accepts("2");
      integers.accepts("20");
      integers.rejects(".5");
      integers.rejects("2j");
      integers.rejects("");
    }
  });
  test("null is allowed only when expected", () => {
    {
      const nullableIntegers = new Tester({ type: ["integer", "null"] });
      nullableIntegers.accepts("2");
      nullableIntegers.rejects(".5");
      nullableIntegers.accepts("2.0");
      nullableIntegers.rejects("2j");
      nullableIntegers.accepts("");
    }
    {
      const nonnullableIntegers = new Tester({ type: ["integer"] });
      nonnullableIntegers.accepts("2");
      nonnullableIntegers.rejects(".5");
      nonnullableIntegers.accepts("2.0");
      nonnullableIntegers.rejects("2j");
      nonnullableIntegers.rejects("");
    }
    {
      const nullableNumbers = new Tester({ type: ["number", "null"] });
      nullableNumbers.accepts("2");
      nullableNumbers.accepts(".5");
      nullableNumbers.accepts("2.0");
      nullableNumbers.rejects("2j");
      nullableNumbers.accepts("");
    }
    {
      const nonnullableNumbers = new Tester({ type: ["number"] });
      nonnullableNumbers.accepts("2");
      nonnullableNumbers.accepts(".5");
      nonnullableNumbers.accepts("2.0");
      nonnullableNumbers.rejects("2j");
      nonnullableNumbers.rejects("");
    }
  });
  test("string max min length work", () => {
    {
      const min = new Tester({ minLength: 4, type: "string" });
      min.rejects("123");
      min.accepts("1234");
      min.accepts("12345");
    }
    {
      const max = new Tester({ maxLength: 6, type: "string" });
      max.accepts("12345");
      max.accepts("123456");
      max.rejects("1234567");
    }
    {
      const minMax = new Tester({ minLength: 4, maxLength: 6, type: "string" });
      minMax.rejects("123");
      minMax.accepts("1234");
      minMax.accepts("12345");
      minMax.accepts("123456");
      minMax.rejects("1234567");
    }
  });
  test("objects work", () => {
    {
      const obj = new Tester({ type: "object", properties: { "a": { type: "string", maxLength: 2 } }, additionalProperties: false });
      obj.rejects({ "a": "string" });
      obj.accepts({ "a": "st" });
      obj.rejects({ "a": null });
      obj.rejects({ "a": 7 });
      obj.accepts({});
      obj.rejects("test");
      obj.rejects(7);
      obj.rejects([1, 2, 3]);
    }
    {
      const pattern = new Tester({ type: "object", patternProperties: { "^a[a-z]$": { type: "string", minLength: 2 } }, additionalProperties: false });
      pattern.accepts({ "ab": "string" });
      pattern.accepts({ "ab": "string", "ac": "hmm" });
      pattern.rejects({ "ab": "string", "ac": "h" });
      pattern.rejects({ "ab": "string", "ac": 99999 });
      pattern.rejects({ "abc": "string" });
      pattern.rejects({ "a0": "string" });
      pattern.rejects({ "ab": "string", "bc": "hmm" });
      pattern.rejects({ "be": "string" });
      pattern.rejects({ "be": "a" });
      pattern.accepts({});
    }
    {
      const pattern = new Tester({ type: "object", patternProperties: { "^#": { type: "string", minLength: 3 } }, additionalProperties: { type: "string", maxLength: 3 } });
      pattern.accepts({ "#ab": "string" });
      pattern.accepts({ "ab": "str" });
      pattern.rejects({ "#ab": "s" });
      pattern.rejects({ "ab": 99999 });
      pattern.rejects({ "#ab": 99999 });
      pattern.accepts({});
    }
    {
      const pattern = new Tester({ type: "object", properties: { "hello": { type: "string" } }, additionalProperties: { type: "boolean" } });
      pattern.accepts({ "hello": "world" });
      pattern.accepts({ "hello": "world", "bye": false });
      pattern.rejects({ "hello": "world", "bye": "false" });
      pattern.rejects({ "hello": "world", "bye": 1 });
      pattern.rejects({ "hello": "world", "bye": "world" });
      pattern.accepts({ "hello": "test" });
      pattern.accepts({});
    }
  });
  test("numerical objects work", () => {
    {
      const obj = new Tester({ type: "object", properties: { "b": { type: "number" } } });
      obj.accepts({ "b": 2.5 });
      obj.accepts({ "b": -2.5 });
      obj.accepts({ "b": 0 });
      obj.accepts({ "b": "0.12" });
      obj.rejects({ "b": "abc" });
      obj.rejects({ "b": [] });
      obj.rejects({ "b": false });
      obj.rejects({ "b": null });
      obj.rejects({ "b": void 0 });
    }
    {
      const obj = new Tester({ type: "object", properties: { "b": { type: "integer", minimum: 2, maximum: 5.5 } } });
      obj.accepts({ "b": 2 });
      obj.accepts({ "b": 3 });
      obj.accepts({ "b": "3.0" });
      obj.accepts({ "b": 5 });
      obj.rejects({ "b": 1 });
      obj.rejects({ "b": 6 });
      obj.rejects({ "b": 5.5 });
    }
  });
  test("patterns work", () => {
    {
      const urls = new Tester({ pattern: "^(hello)*$", type: "string" });
      urls.accepts("");
      urls.rejects("hel");
      urls.accepts("hello");
      urls.rejects("hellohel");
      urls.accepts("hellohello");
    }
    {
      const urls = new Tester({ pattern: "^(hello)*$", type: "string", patternErrorMessage: "err: must be friendly" });
      urls.accepts("");
      urls.rejects("hel").withMessage("err: must be friendly");
      urls.accepts("hello");
      urls.rejects("hellohel").withMessage("err: must be friendly");
      urls.accepts("hellohello");
    }
    {
      const unicodePattern = new Tester({ type: "string", pattern: "^[\\p{L}\\d_. -]*$", minLength: 3 });
      unicodePattern.accepts("_autoload");
      unicodePattern.rejects("#hash");
      unicodePattern.rejects("");
    }
  });
  test("custom error messages are shown", () => {
    const withMessage = new Tester({ minLength: 1, maxLength: 0, type: "string", errorMessage: "always error!" });
    withMessage.rejects("").withMessage("always error!");
    withMessage.rejects(" ").withMessage("always error!");
    withMessage.rejects("1").withMessage("always error!");
  });
  class ArrayTester {
    constructor(settings) {
      this.settings = settings;
      this.validator = createValidator(settings);
    }
    accepts(input) {
      assert.strictEqual(this.validator(input), "", `Expected ${JSON.stringify(this.settings)} to accept \`${JSON.stringify(input)}\`. Got ${this.validator(input)}.`);
    }
    rejects(input) {
      assert.notStrictEqual(this.validator(input), "", `Expected ${JSON.stringify(this.settings)} to reject \`${JSON.stringify(input)}\`.`);
      return {
        withMessage: (message) => {
          const actual = this.validator(input);
          assert.ok(actual);
          assert(
            actual.indexOf(message) > -1,
            `Expected error of ${JSON.stringify(this.settings)} on \`${input}\` to contain ${message}. Got ${this.validator(input)}.`
          );
        }
      };
    }
  }
  test("simple array", () => {
    {
      const arr = new ArrayTester({ type: "array", items: { type: "string" } });
      arr.accepts([]);
      arr.accepts(["foo"]);
      arr.accepts(["foo", "bar"]);
      arr.rejects(76);
      arr.rejects([6, "3", 7]);
    }
  });
  test("min-max items array", () => {
    {
      const arr = new ArrayTester({ type: "array", items: { type: "string" }, minItems: 1, maxItems: 2 });
      arr.rejects([]).withMessage("Array must have at least 1 items");
      arr.accepts(["a"]);
      arr.accepts(["a", "a"]);
      arr.rejects(["a", "a", "a"]).withMessage("Array must have at most 2 items");
    }
  });
  test("array of enums", () => {
    {
      const arr = new ArrayTester({ type: "array", items: { type: "string", enum: ["a", "b"] } });
      arr.accepts(["a"]);
      arr.accepts(["a", "b"]);
      arr.rejects(["c"]).withMessage(`Value 'c' is not one of`);
      arr.rejects(["a", "c"]).withMessage(`Value 'c' is not one of`);
      arr.rejects(["c", "d"]).withMessage(`Value 'c' is not one of`);
      arr.rejects(["c", "d"]).withMessage(`Value 'd' is not one of`);
    }
  });
  test("array of numbers", () => {
    {
      const arr = new ArrayTester({ type: "array", items: { type: "number" } });
      arr.accepts([]);
      arr.accepts([2]);
      arr.accepts([2, 3]);
      arr.accepts(["2", "3"]);
      arr.accepts([6.6, "3", 7]);
      arr.rejects(76);
      arr.rejects(7.6);
      arr.rejects([6, "a", 7]);
    }
    {
      const arr = new ArrayTester({ type: "array", items: { type: "integer", minimum: -2, maximum: 3 }, maxItems: 4 });
      arr.accepts([]);
      arr.accepts([-2, 3]);
      arr.accepts([2, 3]);
      arr.accepts(["2", "3"]);
      arr.accepts(["-2", "0", "3"]);
      arr.accepts(["-2", 0, "3"]);
      arr.rejects(2);
      arr.rejects(76);
      arr.rejects([6, "3", 7]);
      arr.rejects([2, "a", 3]);
      arr.rejects([-2, 4]);
      arr.rejects([-1.2, 2.1]);
      arr.rejects([-3, 3]);
      arr.rejects([-3, 4]);
      arr.rejects([2, 2, 2, 2, 2]);
    }
  });
  test("min-max and enum", () => {
    const arr = new ArrayTester({ type: "array", items: { type: "string", enum: ["a", "b"] }, minItems: 1, maxItems: 2 });
    arr.rejects(["a", "b", "c"]).withMessage("Array must have at most 2 items");
    arr.rejects(["a", "b", "c"]).withMessage(`Value 'c' is not one of`);
  });
  test("pattern", () => {
    const arr = new ArrayTester({ type: "array", items: { type: "string", pattern: "^(hello)*$" } });
    arr.accepts(["hello"]);
    arr.rejects(["a"]).withMessage(`Value 'a' must match regex`);
  });
  test("Unicode pattern", () => {
    const arr = new ArrayTester({ type: "array", items: { type: "string", pattern: "^[\\p{L}\\d_. -]*$" } });
    arr.accepts(["hello", "world"]);
    arr.rejects(["hello", "#world"]).withMessage(`Value '#world' must match regex`);
  });
  test("pattern with error message", () => {
    const arr = new ArrayTester({ type: "array", items: { type: "string", pattern: "^(hello)*$", patternErrorMessage: "err: must be friendly" } });
    arr.rejects(["a"]).withMessage(`err: must be friendly`);
  });
  test("uniqueItems", () => {
    const arr = new ArrayTester({ type: "array", items: { type: "string" }, uniqueItems: true });
    arr.rejects(["a", "a"]).withMessage(`Array has duplicate items`);
  });
  test("getInvalidTypeError", () => {
    function testInvalidTypeError(value, type, shouldValidate) {
      const message = `value: ${value}, type: ${JSON.stringify(type)}, expected: ${shouldValidate ? "valid" : "invalid"}`;
      if (shouldValidate) {
        assert.ok(!getInvalidTypeError(value, type), message);
      } else {
        assert.ok(getInvalidTypeError(value, type), message);
      }
    }
    testInvalidTypeError(1, "number", true);
    testInvalidTypeError(1.5, "number", true);
    testInvalidTypeError([1], "number", false);
    testInvalidTypeError("1", "number", false);
    testInvalidTypeError({ a: 1 }, "number", false);
    testInvalidTypeError(null, "number", false);
    testInvalidTypeError("a", "string", true);
    testInvalidTypeError("1", "string", true);
    testInvalidTypeError([], "string", false);
    testInvalidTypeError({}, "string", false);
    testInvalidTypeError([1], "array", true);
    testInvalidTypeError([], "array", true);
    testInvalidTypeError([{}, [[]]], "array", true);
    testInvalidTypeError({ a: ["a"] }, "array", false);
    testInvalidTypeError("hello", "array", false);
    testInvalidTypeError(true, "boolean", true);
    testInvalidTypeError("hello", "boolean", false);
    testInvalidTypeError(null, "boolean", false);
    testInvalidTypeError([true], "boolean", false);
    testInvalidTypeError(null, "null", true);
    testInvalidTypeError(false, "null", false);
    testInvalidTypeError([null], "null", false);
    testInvalidTypeError("null", "null", false);
  });
  test("uri checks work", () => {
    const tester = new Tester({ type: "string", format: "uri" });
    tester.rejects("example.com");
    tester.rejects("example.com/example");
    tester.rejects("example/example.html");
    tester.rejects("www.example.com");
    tester.rejects("");
    tester.rejects(" ");
    tester.rejects("example");
    tester.accepts("https:");
    tester.accepts("https://");
    tester.accepts("https://example.com");
    tester.accepts("https://www.example.com");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvcHJlZmVyZW5jZXMvdGVzdC9jb21tb24vcHJlZmVyZW5jZXNWYWxpZGF0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlVmFsaWRhdG9yLCBnZXRJbnZhbGlkVHlwZUVycm9yIH0gZnJvbSAnLi4vLi4vY29tbW9uL3ByZWZlcmVuY2VzVmFsaWRhdGlvbi5qcyc7XG5cblxuc3VpdGUoJ1ByZWZlcmVuY2VzIFZhbGlkYXRpb24nLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGNsYXNzIFRlc3RlciB7XG5cdFx0cHJpdmF0ZSB2YWxpZGF0b3I6ICh2YWx1ZTogYW55KSA9PiBzdHJpbmcgfCBudWxsO1xuXG5cdFx0Y29uc3RydWN0b3IocHJpdmF0ZSBzZXR0aW5nczogSUNvbmZpZ3VyYXRpb25Qcm9wZXJ0eVNjaGVtYSkge1xuXHRcdFx0dGhpcy52YWxpZGF0b3IgPSBjcmVhdGVWYWxpZGF0b3Ioc2V0dGluZ3MpITtcblx0XHR9XG5cblx0XHRwdWJsaWMgYWNjZXB0cyhpbnB1dDogYW55KSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpcy52YWxpZGF0b3IoaW5wdXQpLCAnJywgYEV4cGVjdGVkICR7SlNPTi5zdHJpbmdpZnkodGhpcy5zZXR0aW5ncyl9IHRvIGFjY2VwdCBcXGAke0pTT04uc3RyaW5naWZ5KGlucHV0KX1cXGAuIEdvdCAke3RoaXMudmFsaWRhdG9yKGlucHV0KX0uYCk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHJlamVjdHMoaW5wdXQ6IGFueSkge1xuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHRoaXMudmFsaWRhdG9yKGlucHV0KSwgJycsIGBFeHBlY3RlZCAke0pTT04uc3RyaW5naWZ5KHRoaXMuc2V0dGluZ3MpfSB0byByZWplY3QgXFxgJHtKU09OLnN0cmluZ2lmeShpbnB1dCl9XFxgLmApO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0d2l0aE1lc3NhZ2U6XG5cdFx0XHRcdFx0KG1lc3NhZ2U6IHN0cmluZykgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgYWN0dWFsID0gdGhpcy52YWxpZGF0b3IoaW5wdXQpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGFjdHVhbCk7XG5cdFx0XHRcdFx0XHRhc3NlcnQoYWN0dWFsLmluZGV4T2YobWVzc2FnZSkgPiAtMSxcblx0XHRcdFx0XHRcdFx0YEV4cGVjdGVkIGVycm9yIG9mICR7SlNPTi5zdHJpbmdpZnkodGhpcy5zZXR0aW5ncyl9IG9uIFxcYCR7aW5wdXR9XFxgIHRvIGNvbnRhaW4gJHttZXNzYWdlfS4gR290ICR7dGhpcy52YWxpZGF0b3IoaW5wdXQpfS5gKTtcblx0XHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHB1YmxpYyB2YWxpZGF0ZXNOdW1lcmljKCkge1xuXHRcdFx0dGhpcy5hY2NlcHRzKCczJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJzMuJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJy4wJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJzMuMCcpO1xuXHRcdFx0dGhpcy5hY2NlcHRzKCcgMy4wJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJyAzLjAgICcpO1xuXHRcdFx0dGhpcy5yZWplY3RzKCczZicpO1xuXHRcdFx0dGhpcy5hY2NlcHRzKDMpO1xuXHRcdFx0dGhpcy5yZWplY3RzKCd0ZXN0Jyk7XG5cdFx0fVxuXG5cdFx0cHVibGljIHZhbGlkYXRlc051bGxhYmxlTnVtZXJpYygpIHtcblx0XHRcdHRoaXMudmFsaWRhdGVzTnVtZXJpYygpO1xuXHRcdFx0dGhpcy5hY2NlcHRzKDApO1xuXHRcdFx0dGhpcy5hY2NlcHRzKCcnKTtcblx0XHRcdHRoaXMuYWNjZXB0cyhudWxsKTtcblx0XHRcdHRoaXMuYWNjZXB0cyh1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHB1YmxpYyB2YWxpZGF0ZXNOb25OdWxsYWJsZU51bWVyaWMoKSB7XG5cdFx0XHR0aGlzLnZhbGlkYXRlc051bWVyaWMoKTtcblx0XHRcdHRoaXMuYWNjZXB0cygwKTtcblx0XHRcdHRoaXMucmVqZWN0cygnJyk7XG5cdFx0XHR0aGlzLnJlamVjdHMobnVsbCk7XG5cdFx0XHR0aGlzLnJlamVjdHModW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRwdWJsaWMgdmFsaWRhdGVzU3RyaW5nKCkge1xuXHRcdFx0dGhpcy5hY2NlcHRzKCczJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJzMuJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJy4wJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJzMuMCcpO1xuXHRcdFx0dGhpcy5hY2NlcHRzKCcgMy4wJyk7XG5cdFx0XHR0aGlzLmFjY2VwdHMoJyAzLjAgICcpO1xuXHRcdFx0dGhpcy5hY2NlcHRzKCcnKTtcblx0XHRcdHRoaXMuYWNjZXB0cygnM2YnKTtcblx0XHRcdHRoaXMuYWNjZXB0cygnaGVsbG8nKTtcblx0XHRcdHRoaXMucmVqZWN0cyg2KTtcblx0XHR9XG5cdH1cblxuXG5cdHRlc3QoJ2V4Y2x1c2l2ZSBtYXggYW5kIG1heCB3b3JrIHRvZ2V0aGVyIHByb3Blcmx5JywgKCkgPT4ge1xuXHRcdHtcblx0XHRcdGNvbnN0IGp1c3RNYXggPSBuZXcgVGVzdGVyKHsgbWF4aW11bTogNSwgdHlwZTogJ251bWJlcicgfSk7XG5cdFx0XHRqdXN0TWF4LnZhbGlkYXRlc05vbk51bGxhYmxlTnVtZXJpYygpO1xuXHRcdFx0anVzdE1heC5yZWplY3RzKCc1LjEnKTtcblx0XHRcdGp1c3RNYXguYWNjZXB0cygnNS4wJyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IGp1c3RFTWF4ID0gbmV3IFRlc3Rlcih7IGV4Y2x1c2l2ZU1heGltdW06IDUsIHR5cGU6ICdudW1iZXInIH0pO1xuXHRcdFx0anVzdEVNYXgudmFsaWRhdGVzTm9uTnVsbGFibGVOdW1lcmljKCk7XG5cdFx0XHRqdXN0RU1heC5yZWplY3RzKCc1LjEnKTtcblx0XHRcdGp1c3RFTWF4LnJlamVjdHMoJzUuMCcpO1xuXHRcdFx0anVzdEVNYXguYWNjZXB0cygnNC45OTknKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgYm90aE51bWVyaWMgPSBuZXcgVGVzdGVyKHsgZXhjbHVzaXZlTWF4aW11bTogNSwgbWF4aW11bTogNCwgdHlwZTogJ251bWJlcicgfSk7XG5cdFx0XHRib3RoTnVtZXJpYy52YWxpZGF0ZXNOb25OdWxsYWJsZU51bWVyaWMoKTtcblx0XHRcdGJvdGhOdW1lcmljLnJlamVjdHMoJzUuMScpO1xuXHRcdFx0Ym90aE51bWVyaWMucmVqZWN0cygnNS4wJyk7XG5cdFx0XHRib3RoTnVtZXJpYy5yZWplY3RzKCc0Ljk5OScpO1xuXHRcdFx0Ym90aE51bWVyaWMuYWNjZXB0cygnNCcpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBib3RoTnVtZXJpYyA9IG5ldyBUZXN0ZXIoeyBleGNsdXNpdmVNYXhpbXVtOiA1LCBtYXhpbXVtOiA2LCB0eXBlOiAnbnVtYmVyJyB9KTtcblx0XHRcdGJvdGhOdW1lcmljLnZhbGlkYXRlc05vbk51bGxhYmxlTnVtZXJpYygpO1xuXHRcdFx0Ym90aE51bWVyaWMucmVqZWN0cygnNS4xJyk7XG5cdFx0XHRib3RoTnVtZXJpYy5yZWplY3RzKCc1LjAnKTtcblx0XHRcdGJvdGhOdW1lcmljLmFjY2VwdHMoJzQuOTk5Jyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdleGNsdXNpdmUgbWluIGFuZCBtaW4gd29yayB0b2dldGhlciBwcm9wZXJseScsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBqdXN0TWluID0gbmV3IFRlc3Rlcih7IG1pbmltdW06IC01LCB0eXBlOiAnbnVtYmVyJyB9KTtcblx0XHRcdGp1c3RNaW4udmFsaWRhdGVzTm9uTnVsbGFibGVOdW1lcmljKCk7XG5cdFx0XHRqdXN0TWluLnJlamVjdHMoJy01LjEnKTtcblx0XHRcdGp1c3RNaW4uYWNjZXB0cygnLTUuMCcpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBqdXN0RU1pbiA9IG5ldyBUZXN0ZXIoeyBleGNsdXNpdmVNaW5pbXVtOiAtNSwgdHlwZTogJ251bWJlcicgfSk7XG5cdFx0XHRqdXN0RU1pbi52YWxpZGF0ZXNOb25OdWxsYWJsZU51bWVyaWMoKTtcblx0XHRcdGp1c3RFTWluLnJlamVjdHMoJy01LjEnKTtcblx0XHRcdGp1c3RFTWluLnJlamVjdHMoJy01LjAnKTtcblx0XHRcdGp1c3RFTWluLmFjY2VwdHMoJy00Ljk5OScpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBib3RoTnVtZXJpYyA9IG5ldyBUZXN0ZXIoeyBleGNsdXNpdmVNaW5pbXVtOiAtNSwgbWluaW11bTogLTQsIHR5cGU6ICdudW1iZXInIH0pO1xuXHRcdFx0Ym90aE51bWVyaWMudmFsaWRhdGVzTm9uTnVsbGFibGVOdW1lcmljKCk7XG5cdFx0XHRib3RoTnVtZXJpYy5yZWplY3RzKCctNS4xJyk7XG5cdFx0XHRib3RoTnVtZXJpYy5yZWplY3RzKCctNS4wJyk7XG5cdFx0XHRib3RoTnVtZXJpYy5yZWplY3RzKCctNC45OTknKTtcblx0XHRcdGJvdGhOdW1lcmljLmFjY2VwdHMoJy00Jyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IGJvdGhOdW1lcmljID0gbmV3IFRlc3Rlcih7IGV4Y2x1c2l2ZU1pbmltdW06IC01LCBtaW5pbXVtOiAtNiwgdHlwZTogJ251bWJlcicgfSk7XG5cdFx0XHRib3RoTnVtZXJpYy52YWxpZGF0ZXNOb25OdWxsYWJsZU51bWVyaWMoKTtcblx0XHRcdGJvdGhOdW1lcmljLnJlamVjdHMoJy01LjEnKTtcblx0XHRcdGJvdGhOdW1lcmljLnJlamVjdHMoJy01LjAnKTtcblx0XHRcdGJvdGhOdW1lcmljLmFjY2VwdHMoJy00Ljk5OScpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgb2Ygd29ya3MgZm9yIGJvdGggaW50ZWdlcnMgYW5kIGZyYWN0aW9ucycsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBvbmx5RXZlbnMgPSBuZXcgVGVzdGVyKHsgbXVsdGlwbGVPZjogMiwgdHlwZTogJ251bWJlcicgfSk7XG5cdFx0XHRvbmx5RXZlbnMuYWNjZXB0cygnMi4wJyk7XG5cdFx0XHRvbmx5RXZlbnMuYWNjZXB0cygnMicpO1xuXHRcdFx0b25seUV2ZW5zLmFjY2VwdHMoJy00Jyk7XG5cdFx0XHRvbmx5RXZlbnMuYWNjZXB0cygnMCcpO1xuXHRcdFx0b25seUV2ZW5zLmFjY2VwdHMoJzEwMCcpO1xuXHRcdFx0b25seUV2ZW5zLnJlamVjdHMoJzEwMC4xJyk7XG5cdFx0XHRvbmx5RXZlbnMucmVqZWN0cygnJyk7XG5cdFx0XHRvbmx5RXZlbnMucmVqZWN0cygnd2UnKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgaGFja3lJbnRlZ2VycyA9IG5ldyBUZXN0ZXIoeyBtdWx0aXBsZU9mOiAxLCB0eXBlOiAnbnVtYmVyJyB9KTtcblx0XHRcdGhhY2t5SW50ZWdlcnMuYWNjZXB0cygnMi4wJyk7XG5cdFx0XHRoYWNreUludGVnZXJzLnJlamVjdHMoJy41Jyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IGhhbGZJbnRlZ2VycyA9IG5ldyBUZXN0ZXIoeyBtdWx0aXBsZU9mOiAwLjUsIHR5cGU6ICdudW1iZXInIH0pO1xuXHRcdFx0aGFsZkludGVnZXJzLmFjY2VwdHMoJzAuNScpO1xuXHRcdFx0aGFsZkludGVnZXJzLmFjY2VwdHMoJzEuNScpO1xuXHRcdFx0aGFsZkludGVnZXJzLnJlamVjdHMoJzEuNTEnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2ludGVnZXIgdHlwZSBjb3JyZWN0bHkgYWRkcyBhIHZhbGlkYXRpb24nLCAoKSA9PiB7XG5cdFx0e1xuXHRcdFx0Y29uc3QgaW50ZWdlcnMgPSBuZXcgVGVzdGVyKHsgbXVsdGlwbGVPZjogMSwgdHlwZTogJ2ludGVnZXInIH0pO1xuXHRcdFx0aW50ZWdlcnMuYWNjZXB0cygnMDInKTtcblx0XHRcdGludGVnZXJzLmFjY2VwdHMoJzInKTtcblx0XHRcdGludGVnZXJzLmFjY2VwdHMoJzIwJyk7XG5cdFx0XHRpbnRlZ2Vycy5yZWplY3RzKCcuNScpO1xuXHRcdFx0aW50ZWdlcnMucmVqZWN0cygnMmonKTtcblx0XHRcdGludGVnZXJzLnJlamVjdHMoJycpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbnVsbCBpcyBhbGxvd2VkIG9ubHkgd2hlbiBleHBlY3RlZCcsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBudWxsYWJsZUludGVnZXJzID0gbmV3IFRlc3Rlcih7IHR5cGU6IFsnaW50ZWdlcicsICdudWxsJ10gfSk7XG5cdFx0XHRudWxsYWJsZUludGVnZXJzLmFjY2VwdHMoJzInKTtcblx0XHRcdG51bGxhYmxlSW50ZWdlcnMucmVqZWN0cygnLjUnKTtcblx0XHRcdG51bGxhYmxlSW50ZWdlcnMuYWNjZXB0cygnMi4wJyk7XG5cdFx0XHRudWxsYWJsZUludGVnZXJzLnJlamVjdHMoJzJqJyk7XG5cdFx0XHRudWxsYWJsZUludGVnZXJzLmFjY2VwdHMoJycpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBub25udWxsYWJsZUludGVnZXJzID0gbmV3IFRlc3Rlcih7IHR5cGU6IFsnaW50ZWdlciddIH0pO1xuXHRcdFx0bm9ubnVsbGFibGVJbnRlZ2Vycy5hY2NlcHRzKCcyJyk7XG5cdFx0XHRub25udWxsYWJsZUludGVnZXJzLnJlamVjdHMoJy41Jyk7XG5cdFx0XHRub25udWxsYWJsZUludGVnZXJzLmFjY2VwdHMoJzIuMCcpO1xuXHRcdFx0bm9ubnVsbGFibGVJbnRlZ2Vycy5yZWplY3RzKCcyaicpO1xuXHRcdFx0bm9ubnVsbGFibGVJbnRlZ2Vycy5yZWplY3RzKCcnKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgbnVsbGFibGVOdW1iZXJzID0gbmV3IFRlc3Rlcih7IHR5cGU6IFsnbnVtYmVyJywgJ251bGwnXSB9KTtcblx0XHRcdG51bGxhYmxlTnVtYmVycy5hY2NlcHRzKCcyJyk7XG5cdFx0XHRudWxsYWJsZU51bWJlcnMuYWNjZXB0cygnLjUnKTtcblx0XHRcdG51bGxhYmxlTnVtYmVycy5hY2NlcHRzKCcyLjAnKTtcblx0XHRcdG51bGxhYmxlTnVtYmVycy5yZWplY3RzKCcyaicpO1xuXHRcdFx0bnVsbGFibGVOdW1iZXJzLmFjY2VwdHMoJycpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBub25udWxsYWJsZU51bWJlcnMgPSBuZXcgVGVzdGVyKHsgdHlwZTogWydudW1iZXInXSB9KTtcblx0XHRcdG5vbm51bGxhYmxlTnVtYmVycy5hY2NlcHRzKCcyJyk7XG5cdFx0XHRub25udWxsYWJsZU51bWJlcnMuYWNjZXB0cygnLjUnKTtcblx0XHRcdG5vbm51bGxhYmxlTnVtYmVycy5hY2NlcHRzKCcyLjAnKTtcblx0XHRcdG5vbm51bGxhYmxlTnVtYmVycy5yZWplY3RzKCcyaicpO1xuXHRcdFx0bm9ubnVsbGFibGVOdW1iZXJzLnJlamVjdHMoJycpO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnc3RyaW5nIG1heCBtaW4gbGVuZ3RoIHdvcmsnLCAoKSA9PiB7XG5cdFx0e1xuXHRcdFx0Y29uc3QgbWluID0gbmV3IFRlc3Rlcih7IG1pbkxlbmd0aDogNCwgdHlwZTogJ3N0cmluZycgfSk7XG5cdFx0XHRtaW4ucmVqZWN0cygnMTIzJyk7XG5cdFx0XHRtaW4uYWNjZXB0cygnMTIzNCcpO1xuXHRcdFx0bWluLmFjY2VwdHMoJzEyMzQ1Jyk7XG5cdFx0fVxuXHRcdHtcblx0XHRcdGNvbnN0IG1heCA9IG5ldyBUZXN0ZXIoeyBtYXhMZW5ndGg6IDYsIHR5cGU6ICdzdHJpbmcnIH0pO1xuXHRcdFx0bWF4LmFjY2VwdHMoJzEyMzQ1Jyk7XG5cdFx0XHRtYXguYWNjZXB0cygnMTIzNDU2Jyk7XG5cdFx0XHRtYXgucmVqZWN0cygnMTIzNDU2NycpO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBtaW5NYXggPSBuZXcgVGVzdGVyKHsgbWluTGVuZ3RoOiA0LCBtYXhMZW5ndGg6IDYsIHR5cGU6ICdzdHJpbmcnIH0pO1xuXHRcdFx0bWluTWF4LnJlamVjdHMoJzEyMycpO1xuXHRcdFx0bWluTWF4LmFjY2VwdHMoJzEyMzQnKTtcblx0XHRcdG1pbk1heC5hY2NlcHRzKCcxMjM0NScpO1xuXHRcdFx0bWluTWF4LmFjY2VwdHMoJzEyMzQ1NicpO1xuXHRcdFx0bWluTWF4LnJlamVjdHMoJzEyMzQ1NjcnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ29iamVjdHMgd29yaycsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBvYmogPSBuZXcgVGVzdGVyKHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgJ2EnOiB7IHR5cGU6ICdzdHJpbmcnLCBtYXhMZW5ndGg6IDIgfSB9LCBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UgfSk7XG5cdFx0XHRvYmoucmVqZWN0cyh7ICdhJzogJ3N0cmluZycgfSk7XG5cdFx0XHRvYmouYWNjZXB0cyh7ICdhJzogJ3N0JyB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2EnOiBudWxsIH0pO1xuXHRcdFx0b2JqLnJlamVjdHMoeyAnYSc6IDcgfSk7XG5cdFx0XHRvYmouYWNjZXB0cyh7fSk7XG5cdFx0XHRvYmoucmVqZWN0cygndGVzdCcpO1xuXHRcdFx0b2JqLnJlamVjdHMoNyk7XG5cdFx0XHRvYmoucmVqZWN0cyhbMSwgMiwgM10pO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBwYXR0ZXJuID0gbmV3IFRlc3Rlcih7IHR5cGU6ICdvYmplY3QnLCBwYXR0ZXJuUHJvcGVydGllczogeyAnXmFbYS16XSQnOiB7IHR5cGU6ICdzdHJpbmcnLCBtaW5MZW5ndGg6IDIgfSB9LCBhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UgfSk7XG5cdFx0XHRwYXR0ZXJuLmFjY2VwdHMoeyAnYWInOiAnc3RyaW5nJyB9KTtcblx0XHRcdHBhdHRlcm4uYWNjZXB0cyh7ICdhYic6ICdzdHJpbmcnLCAnYWMnOiAnaG1tJyB9KTtcblx0XHRcdHBhdHRlcm4ucmVqZWN0cyh7ICdhYic6ICdzdHJpbmcnLCAnYWMnOiAnaCcgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnYWInOiAnc3RyaW5nJywgJ2FjJzogOTk5OTkgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnYWJjJzogJ3N0cmluZycgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnYTAnOiAnc3RyaW5nJyB9KTtcblx0XHRcdHBhdHRlcm4ucmVqZWN0cyh7ICdhYic6ICdzdHJpbmcnLCAnYmMnOiAnaG1tJyB9KTtcblx0XHRcdHBhdHRlcm4ucmVqZWN0cyh7ICdiZSc6ICdzdHJpbmcnIH0pO1xuXHRcdFx0cGF0dGVybi5yZWplY3RzKHsgJ2JlJzogJ2EnIH0pO1xuXHRcdFx0cGF0dGVybi5hY2NlcHRzKHt9KTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgcGF0dGVybiA9IG5ldyBUZXN0ZXIoeyB0eXBlOiAnb2JqZWN0JywgcGF0dGVyblByb3BlcnRpZXM6IHsgJ14jJzogeyB0eXBlOiAnc3RyaW5nJywgbWluTGVuZ3RoOiAzIH0gfSwgYWRkaXRpb25hbFByb3BlcnRpZXM6IHsgdHlwZTogJ3N0cmluZycsIG1heExlbmd0aDogMyB9IH0pO1xuXHRcdFx0cGF0dGVybi5hY2NlcHRzKHsgJyNhYic6ICdzdHJpbmcnIH0pO1xuXHRcdFx0cGF0dGVybi5hY2NlcHRzKHsgJ2FiJzogJ3N0cicgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnI2FiJzogJ3MnIH0pO1xuXHRcdFx0cGF0dGVybi5yZWplY3RzKHsgJ2FiJzogOTk5OTkgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnI2FiJzogOTk5OTkgfSk7XG5cdFx0XHRwYXR0ZXJuLmFjY2VwdHMoe30pO1xuXHRcdH1cblx0XHR7XG5cdFx0XHRjb25zdCBwYXR0ZXJuID0gbmV3IFRlc3Rlcih7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7ICdoZWxsbyc6IHsgdHlwZTogJ3N0cmluZycgfSB9LCBhZGRpdGlvbmFsUHJvcGVydGllczogeyB0eXBlOiAnYm9vbGVhbicgfSB9KTtcblx0XHRcdHBhdHRlcm4uYWNjZXB0cyh7ICdoZWxsbyc6ICd3b3JsZCcgfSk7XG5cdFx0XHRwYXR0ZXJuLmFjY2VwdHMoeyAnaGVsbG8nOiAnd29ybGQnLCAnYnllJzogZmFsc2UgfSk7XG5cdFx0XHRwYXR0ZXJuLnJlamVjdHMoeyAnaGVsbG8nOiAnd29ybGQnLCAnYnllJzogJ2ZhbHNlJyB9KTtcblx0XHRcdHBhdHRlcm4ucmVqZWN0cyh7ICdoZWxsbyc6ICd3b3JsZCcsICdieWUnOiAxIH0pO1xuXHRcdFx0cGF0dGVybi5yZWplY3RzKHsgJ2hlbGxvJzogJ3dvcmxkJywgJ2J5ZSc6ICd3b3JsZCcgfSk7XG5cdFx0XHRwYXR0ZXJuLmFjY2VwdHMoeyAnaGVsbG8nOiAndGVzdCcgfSk7XG5cdFx0XHRwYXR0ZXJuLmFjY2VwdHMoe30pO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbnVtZXJpY2FsIG9iamVjdHMgd29yaycsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBvYmogPSBuZXcgVGVzdGVyKHsgdHlwZTogJ29iamVjdCcsIHByb3BlcnRpZXM6IHsgJ2InOiB7IHR5cGU6ICdudW1iZXInIH0gfSB9KTtcblx0XHRcdG9iai5hY2NlcHRzKHsgJ2InOiAyLjUgfSk7XG5cdFx0XHRvYmouYWNjZXB0cyh7ICdiJzogLTIuNSB9KTtcblx0XHRcdG9iai5hY2NlcHRzKHsgJ2InOiAwIH0pO1xuXHRcdFx0b2JqLmFjY2VwdHMoeyAnYic6ICcwLjEyJyB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2InOiAnYWJjJyB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2InOiBbXSB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2InOiBmYWxzZSB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2InOiBudWxsIH0pO1xuXHRcdFx0b2JqLnJlamVjdHMoeyAnYic6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3Qgb2JqID0gbmV3IFRlc3Rlcih7IHR5cGU6ICdvYmplY3QnLCBwcm9wZXJ0aWVzOiB7ICdiJzogeyB0eXBlOiAnaW50ZWdlcicsIG1pbmltdW06IDIsIG1heGltdW06IDUuNSB9IH0gfSk7XG5cdFx0XHRvYmouYWNjZXB0cyh7ICdiJzogMiB9KTtcblx0XHRcdG9iai5hY2NlcHRzKHsgJ2InOiAzIH0pO1xuXHRcdFx0b2JqLmFjY2VwdHMoeyAnYic6ICczLjAnIH0pO1xuXHRcdFx0b2JqLmFjY2VwdHMoeyAnYic6IDUgfSk7XG5cdFx0XHRvYmoucmVqZWN0cyh7ICdiJzogMSB9KTtcblx0XHRcdG9iai5yZWplY3RzKHsgJ2InOiA2IH0pO1xuXHRcdFx0b2JqLnJlamVjdHMoeyAnYic6IDUuNSB9KTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ3BhdHRlcm5zIHdvcmsnLCAoKSA9PiB7XG5cdFx0e1xuXHRcdFx0Y29uc3QgdXJscyA9IG5ldyBUZXN0ZXIoeyBwYXR0ZXJuOiAnXihoZWxsbykqJCcsIHR5cGU6ICdzdHJpbmcnIH0pO1xuXHRcdFx0dXJscy5hY2NlcHRzKCcnKTtcblx0XHRcdHVybHMucmVqZWN0cygnaGVsJyk7XG5cdFx0XHR1cmxzLmFjY2VwdHMoJ2hlbGxvJyk7XG5cdFx0XHR1cmxzLnJlamVjdHMoJ2hlbGxvaGVsJyk7XG5cdFx0XHR1cmxzLmFjY2VwdHMoJ2hlbGxvaGVsbG8nKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgdXJscyA9IG5ldyBUZXN0ZXIoeyBwYXR0ZXJuOiAnXihoZWxsbykqJCcsIHR5cGU6ICdzdHJpbmcnLCBwYXR0ZXJuRXJyb3JNZXNzYWdlOiAnZXJyOiBtdXN0IGJlIGZyaWVuZGx5JyB9KTtcblx0XHRcdHVybHMuYWNjZXB0cygnJyk7XG5cdFx0XHR1cmxzLnJlamVjdHMoJ2hlbCcpLndpdGhNZXNzYWdlKCdlcnI6IG11c3QgYmUgZnJpZW5kbHknKTtcblx0XHRcdHVybHMuYWNjZXB0cygnaGVsbG8nKTtcblx0XHRcdHVybHMucmVqZWN0cygnaGVsbG9oZWwnKS53aXRoTWVzc2FnZSgnZXJyOiBtdXN0IGJlIGZyaWVuZGx5Jyk7XG5cdFx0XHR1cmxzLmFjY2VwdHMoJ2hlbGxvaGVsbG8nKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgdW5pY29kZVBhdHRlcm4gPSBuZXcgVGVzdGVyKHsgdHlwZTogJ3N0cmluZycsIHBhdHRlcm46ICdeW1xcXFxwe0x9XFxcXGRfLiAtXSokJywgbWluTGVuZ3RoOiAzIH0pO1xuXHRcdFx0dW5pY29kZVBhdHRlcm4uYWNjZXB0cygnX2F1dG9sb2FkJyk7XG5cdFx0XHR1bmljb2RlUGF0dGVybi5yZWplY3RzKCcjaGFzaCcpO1xuXHRcdFx0dW5pY29kZVBhdHRlcm4ucmVqZWN0cygnJyk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdjdXN0b20gZXJyb3IgbWVzc2FnZXMgYXJlIHNob3duJywgKCkgPT4ge1xuXHRcdGNvbnN0IHdpdGhNZXNzYWdlID0gbmV3IFRlc3Rlcih7IG1pbkxlbmd0aDogMSwgbWF4TGVuZ3RoOiAwLCB0eXBlOiAnc3RyaW5nJywgZXJyb3JNZXNzYWdlOiAnYWx3YXlzIGVycm9yIScgfSk7XG5cdFx0d2l0aE1lc3NhZ2UucmVqZWN0cygnJykud2l0aE1lc3NhZ2UoJ2Fsd2F5cyBlcnJvciEnKTtcblx0XHR3aXRoTWVzc2FnZS5yZWplY3RzKCcgJykud2l0aE1lc3NhZ2UoJ2Fsd2F5cyBlcnJvciEnKTtcblx0XHR3aXRoTWVzc2FnZS5yZWplY3RzKCcxJykud2l0aE1lc3NhZ2UoJ2Fsd2F5cyBlcnJvciEnKTtcblx0fSk7XG5cblx0Y2xhc3MgQXJyYXlUZXN0ZXIge1xuXHRcdHByaXZhdGUgdmFsaWRhdG9yOiAodmFsdWU6IGFueSkgPT4gc3RyaW5nIHwgbnVsbDtcblxuXHRcdGNvbnN0cnVjdG9yKHByaXZhdGUgc2V0dGluZ3M6IElDb25maWd1cmF0aW9uUHJvcGVydHlTY2hlbWEpIHtcblx0XHRcdHRoaXMudmFsaWRhdG9yID0gY3JlYXRlVmFsaWRhdG9yKHNldHRpbmdzKSE7XG5cdFx0fVxuXG5cdFx0cHVibGljIGFjY2VwdHMoaW5wdXQ6IHVua25vd25bXSkge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXMudmFsaWRhdG9yKGlucHV0KSwgJycsIGBFeHBlY3RlZCAke0pTT04uc3RyaW5naWZ5KHRoaXMuc2V0dGluZ3MpfSB0byBhY2NlcHQgXFxgJHtKU09OLnN0cmluZ2lmeShpbnB1dCl9XFxgLiBHb3QgJHt0aGlzLnZhbGlkYXRvcihpbnB1dCl9LmApO1xuXHRcdH1cblxuXHRcdHB1YmxpYyByZWplY3RzKGlucHV0OiBhbnkpIHtcblx0XHRcdGFzc2VydC5ub3RTdHJpY3RFcXVhbCh0aGlzLnZhbGlkYXRvcihpbnB1dCksICcnLCBgRXhwZWN0ZWQgJHtKU09OLnN0cmluZ2lmeSh0aGlzLnNldHRpbmdzKX0gdG8gcmVqZWN0IFxcYCR7SlNPTi5zdHJpbmdpZnkoaW5wdXQpfVxcYC5gKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHdpdGhNZXNzYWdlOlxuXHRcdFx0XHRcdChtZXNzYWdlOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGFjdHVhbCA9IHRoaXMudmFsaWRhdG9yKGlucHV0KTtcblx0XHRcdFx0XHRcdGFzc2VydC5vayhhY3R1YWwpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0KGFjdHVhbC5pbmRleE9mKG1lc3NhZ2UpID4gLTEsXG5cdFx0XHRcdFx0XHRcdGBFeHBlY3RlZCBlcnJvciBvZiAke0pTT04uc3RyaW5naWZ5KHRoaXMuc2V0dGluZ3MpfSBvbiBcXGAke2lucHV0fVxcYCB0byBjb250YWluICR7bWVzc2FnZX0uIEdvdCAke3RoaXMudmFsaWRhdG9yKGlucHV0KX0uYCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHR0ZXN0KCdzaW1wbGUgYXJyYXknLCAoKSA9PiB7XG5cdFx0e1xuXHRcdFx0Y29uc3QgYXJyID0gbmV3IEFycmF5VGVzdGVyKHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSB9KTtcblx0XHRcdGFyci5hY2NlcHRzKFtdKTtcblx0XHRcdGFyci5hY2NlcHRzKFsnZm9vJ10pO1xuXHRcdFx0YXJyLmFjY2VwdHMoWydmb28nLCAnYmFyJ10pO1xuXHRcdFx0YXJyLnJlamVjdHMoNzYpO1xuXHRcdFx0YXJyLnJlamVjdHMoWzYsICczJywgN10pO1xuXHRcdH1cblx0fSk7XG5cblx0dGVzdCgnbWluLW1heCBpdGVtcyBhcnJheScsICgpID0+IHtcblx0XHR7XG5cdFx0XHRjb25zdCBhcnIgPSBuZXcgQXJyYXlUZXN0ZXIoeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCBtaW5JdGVtczogMSwgbWF4SXRlbXM6IDIgfSk7XG5cdFx0XHRhcnIucmVqZWN0cyhbXSkud2l0aE1lc3NhZ2UoJ0FycmF5IG11c3QgaGF2ZSBhdCBsZWFzdCAxIGl0ZW1zJyk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJ2EnXSk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJ2EnLCAnYSddKTtcblx0XHRcdGFyci5yZWplY3RzKFsnYScsICdhJywgJ2EnXSkud2l0aE1lc3NhZ2UoJ0FycmF5IG11c3QgaGF2ZSBhdCBtb3N0IDIgaXRlbXMnKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2FycmF5IG9mIGVudW1zJywgKCkgPT4ge1xuXHRcdHtcblx0XHRcdGNvbnN0IGFyciA9IG5ldyBBcnJheVRlc3Rlcih7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnLCBlbnVtOiBbJ2EnLCAnYiddIH0gfSk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJ2EnXSk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJ2EnLCAnYiddKTtcblxuXHRcdFx0YXJyLnJlamVjdHMoWydjJ10pLndpdGhNZXNzYWdlKGBWYWx1ZSAnYycgaXMgbm90IG9uZSBvZmApO1xuXHRcdFx0YXJyLnJlamVjdHMoWydhJywgJ2MnXSkud2l0aE1lc3NhZ2UoYFZhbHVlICdjJyBpcyBub3Qgb25lIG9mYCk7XG5cblx0XHRcdGFyci5yZWplY3RzKFsnYycsICdkJ10pLndpdGhNZXNzYWdlKGBWYWx1ZSAnYycgaXMgbm90IG9uZSBvZmApO1xuXHRcdFx0YXJyLnJlamVjdHMoWydjJywgJ2QnXSkud2l0aE1lc3NhZ2UoYFZhbHVlICdkJyBpcyBub3Qgb25lIG9mYCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdhcnJheSBvZiBudW1iZXJzJywgKCkgPT4ge1xuXHRcdC8vIFdlIGFjY2VwdCBwYXJzZWFibGUgc3RyaW5ncyBzaW5jZSB0aGUgdmlldyBoYW5kbGVzIHN0cmluZ3Ncblx0XHR7XG5cdFx0XHRjb25zdCBhcnIgPSBuZXcgQXJyYXlUZXN0ZXIoeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnbnVtYmVyJyB9IH0pO1xuXHRcdFx0YXJyLmFjY2VwdHMoW10pO1xuXHRcdFx0YXJyLmFjY2VwdHMoWzJdKTtcblx0XHRcdGFyci5hY2NlcHRzKFsyLCAzXSk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJzInLCAnMyddKTtcblx0XHRcdGFyci5hY2NlcHRzKFs2LjYsICczJywgN10pO1xuXHRcdFx0YXJyLnJlamVjdHMoNzYpO1xuXHRcdFx0YXJyLnJlamVjdHMoNy42KTtcblx0XHRcdGFyci5yZWplY3RzKFs2LCAnYScsIDddKTtcblx0XHR9XG5cdFx0e1xuXHRcdFx0Y29uc3QgYXJyID0gbmV3IEFycmF5VGVzdGVyKHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ2ludGVnZXInLCBtaW5pbXVtOiAtMiwgbWF4aW11bTogMyB9LCBtYXhJdGVtczogNCB9KTtcblx0XHRcdGFyci5hY2NlcHRzKFtdKTtcblx0XHRcdGFyci5hY2NlcHRzKFstMiwgM10pO1xuXHRcdFx0YXJyLmFjY2VwdHMoWzIsIDNdKTtcblx0XHRcdGFyci5hY2NlcHRzKFsnMicsICczJ10pO1xuXHRcdFx0YXJyLmFjY2VwdHMoWyctMicsICcwJywgJzMnXSk7XG5cdFx0XHRhcnIuYWNjZXB0cyhbJy0yJywgMC4wLCAnMyddKTtcblx0XHRcdGFyci5yZWplY3RzKDIpO1xuXHRcdFx0YXJyLnJlamVjdHMoNzYpO1xuXHRcdFx0YXJyLnJlamVjdHMoWzYsICczJywgN10pO1xuXHRcdFx0YXJyLnJlamVjdHMoWzIsICdhJywgM10pO1xuXHRcdFx0YXJyLnJlamVjdHMoWy0yLCA0XSk7XG5cdFx0XHRhcnIucmVqZWN0cyhbLTEuMiwgMi4xXSk7XG5cdFx0XHRhcnIucmVqZWN0cyhbLTMsIDNdKTtcblx0XHRcdGFyci5yZWplY3RzKFstMywgNF0pO1xuXHRcdFx0YXJyLnJlamVjdHMoWzIsIDIsIDIsIDIsIDJdKTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ21pbi1tYXggYW5kIGVudW0nLCAoKSA9PiB7XG5cdFx0Y29uc3QgYXJyID0gbmV3IEFycmF5VGVzdGVyKHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycsIGVudW06IFsnYScsICdiJ10gfSwgbWluSXRlbXM6IDEsIG1heEl0ZW1zOiAyIH0pO1xuXG5cdFx0YXJyLnJlamVjdHMoWydhJywgJ2InLCAnYyddKS53aXRoTWVzc2FnZSgnQXJyYXkgbXVzdCBoYXZlIGF0IG1vc3QgMiBpdGVtcycpO1xuXHRcdGFyci5yZWplY3RzKFsnYScsICdiJywgJ2MnXSkud2l0aE1lc3NhZ2UoYFZhbHVlICdjJyBpcyBub3Qgb25lIG9mYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhdHRlcm4nLCAoKSA9PiB7XG5cdFx0Y29uc3QgYXJyID0gbmV3IEFycmF5VGVzdGVyKHsgdHlwZTogJ2FycmF5JywgaXRlbXM6IHsgdHlwZTogJ3N0cmluZycsIHBhdHRlcm46ICdeKGhlbGxvKSokJyB9IH0pO1xuXG5cdFx0YXJyLmFjY2VwdHMoWydoZWxsbyddKTtcblx0XHRhcnIucmVqZWN0cyhbJ2EnXSkud2l0aE1lc3NhZ2UoYFZhbHVlICdhJyBtdXN0IG1hdGNoIHJlZ2V4YCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1VuaWNvZGUgcGF0dGVybicsICgpID0+IHtcblx0XHRjb25zdCBhcnIgPSBuZXcgQXJyYXlUZXN0ZXIoeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJywgcGF0dGVybjogJ15bXFxcXHB7TH1cXFxcZF8uIC1dKiQnIH0gfSk7XG5cblx0XHRhcnIuYWNjZXB0cyhbJ2hlbGxvJywgJ3dvcmxkJ10pO1xuXHRcdGFyci5yZWplY3RzKFsnaGVsbG8nLCAnI3dvcmxkJ10pLndpdGhNZXNzYWdlKGBWYWx1ZSAnI3dvcmxkJyBtdXN0IG1hdGNoIHJlZ2V4YCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhdHRlcm4gd2l0aCBlcnJvciBtZXNzYWdlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFyciA9IG5ldyBBcnJheVRlc3Rlcih7IHR5cGU6ICdhcnJheScsIGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnLCBwYXR0ZXJuOiAnXihoZWxsbykqJCcsIHBhdHRlcm5FcnJvck1lc3NhZ2U6ICdlcnI6IG11c3QgYmUgZnJpZW5kbHknIH0gfSk7XG5cblx0XHRhcnIucmVqZWN0cyhbJ2EnXSkud2l0aE1lc3NhZ2UoYGVycjogbXVzdCBiZSBmcmllbmRseWApO1xuXHR9KTtcblxuXHR0ZXN0KCd1bmlxdWVJdGVtcycsICgpID0+IHtcblx0XHRjb25zdCBhcnIgPSBuZXcgQXJyYXlUZXN0ZXIoeyB0eXBlOiAnYXJyYXknLCBpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LCB1bmlxdWVJdGVtczogdHJ1ZSB9KTtcblxuXHRcdGFyci5yZWplY3RzKFsnYScsICdhJ10pLndpdGhNZXNzYWdlKGBBcnJheSBoYXMgZHVwbGljYXRlIGl0ZW1zYCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldEludmFsaWRUeXBlRXJyb3InLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gdGVzdEludmFsaWRUeXBlRXJyb3IodmFsdWU6IGFueSwgdHlwZTogc3RyaW5nIHwgc3RyaW5nW10sIHNob3VsZFZhbGlkYXRlOiBib29sZWFuKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gYHZhbHVlOiAke3ZhbHVlfSwgdHlwZTogJHtKU09OLnN0cmluZ2lmeSh0eXBlKX0sIGV4cGVjdGVkOiAke3Nob3VsZFZhbGlkYXRlID8gJ3ZhbGlkJyA6ICdpbnZhbGlkJ31gO1xuXHRcdFx0aWYgKHNob3VsZFZhbGlkYXRlKSB7XG5cdFx0XHRcdGFzc2VydC5vayghZ2V0SW52YWxpZFR5cGVFcnJvcih2YWx1ZSwgdHlwZSksIG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKGdldEludmFsaWRUeXBlRXJyb3IodmFsdWUsIHR5cGUpLCBtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcigxLCAnbnVtYmVyJywgdHJ1ZSk7XG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3IoMS41LCAnbnVtYmVyJywgdHJ1ZSk7XG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3IoWzFdLCAnbnVtYmVyJywgZmFsc2UpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKCcxJywgJ251bWJlcicsIGZhbHNlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcih7IGE6IDEgfSwgJ251bWJlcicsIGZhbHNlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcihudWxsLCAnbnVtYmVyJywgZmFsc2UpO1xuXG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3IoJ2EnLCAnc3RyaW5nJywgdHJ1ZSk7XG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3IoJzEnLCAnc3RyaW5nJywgdHJ1ZSk7XG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3IoW10sICdzdHJpbmcnLCBmYWxzZSk7XG5cdFx0dGVzdEludmFsaWRUeXBlRXJyb3Ioe30sICdzdHJpbmcnLCBmYWxzZSk7XG5cblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcihbMV0sICdhcnJheScsIHRydWUpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKFtdLCAnYXJyYXknLCB0cnVlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcihbe30sIFtbXV1dLCAnYXJyYXknLCB0cnVlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcih7IGE6IFsnYSddIH0sICdhcnJheScsIGZhbHNlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcignaGVsbG8nLCAnYXJyYXknLCBmYWxzZSk7XG5cblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcih0cnVlLCAnYm9vbGVhbicsIHRydWUpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKCdoZWxsbycsICdib29sZWFuJywgZmFsc2UpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKG51bGwsICdib29sZWFuJywgZmFsc2UpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKFt0cnVlXSwgJ2Jvb2xlYW4nLCBmYWxzZSk7XG5cblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcihudWxsLCAnbnVsbCcsIHRydWUpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKGZhbHNlLCAnbnVsbCcsIGZhbHNlKTtcblx0XHR0ZXN0SW52YWxpZFR5cGVFcnJvcihbbnVsbF0sICdudWxsJywgZmFsc2UpO1xuXHRcdHRlc3RJbnZhbGlkVHlwZUVycm9yKCdudWxsJywgJ251bGwnLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VyaSBjaGVja3Mgd29yaycsICgpID0+IHtcblx0XHRjb25zdCB0ZXN0ZXIgPSBuZXcgVGVzdGVyKHsgdHlwZTogJ3N0cmluZycsIGZvcm1hdDogJ3VyaScgfSk7XG5cdFx0dGVzdGVyLnJlamVjdHMoJ2V4YW1wbGUuY29tJyk7XG5cdFx0dGVzdGVyLnJlamVjdHMoJ2V4YW1wbGUuY29tL2V4YW1wbGUnKTtcblx0XHR0ZXN0ZXIucmVqZWN0cygnZXhhbXBsZS9leGFtcGxlLmh0bWwnKTtcblx0XHR0ZXN0ZXIucmVqZWN0cygnd3d3LmV4YW1wbGUuY29tJyk7XG5cdFx0dGVzdGVyLnJlamVjdHMoJycpO1xuXHRcdHRlc3Rlci5yZWplY3RzKCcgJyk7XG5cdFx0dGVzdGVyLnJlamVjdHMoJ2V4YW1wbGUnKTtcblxuXHRcdHRlc3Rlci5hY2NlcHRzKCdodHRwczonKTtcblx0XHR0ZXN0ZXIuYWNjZXB0cygnaHR0cHM6Ly8nKTtcblx0XHR0ZXN0ZXIuYWNjZXB0cygnaHR0cHM6Ly9leGFtcGxlLmNvbScpO1xuXHRcdHRlc3Rlci5hY2NlcHRzKCdodHRwczovL3d3dy5leGFtcGxlLmNvbScpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsaUJBQWlCLDJCQUEyQjtBQUdyRCxNQUFNLDBCQUEwQixNQUFNO0FBQ3JDLDBDQUF3QztBQUFBLEVBRXhDLE1BQU0s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
