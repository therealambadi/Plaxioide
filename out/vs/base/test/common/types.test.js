import assert from "assert";
import * as types from "../../common/types.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
import { assertDefined, assertOneOf, typeCheck } from "../../common/types.js";
suite("Types", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("isFunction", () => {
    assert(!types.isFunction(void 0));
    assert(!types.isFunction(null));
    assert(!types.isFunction("foo"));
    assert(!types.isFunction(5));
    assert(!types.isFunction(true));
    assert(!types.isFunction([]));
    assert(!types.isFunction([1, 2, "3"]));
    assert(!types.isFunction({}));
    assert(!types.isFunction({ foo: "bar" }));
    assert(!types.isFunction(/test/));
    assert(!types.isFunction(new RegExp("")));
    assert(!types.isFunction(/* @__PURE__ */ new Date()));
    assert(types.isFunction(assert));
    assert(types.isFunction(function foo() {
    }));
  });
  test("areFunctions", () => {
    assert(!types.areFunctions());
    assert(!types.areFunctions(null));
    assert(!types.areFunctions("foo"));
    assert(!types.areFunctions(5));
    assert(!types.areFunctions(true));
    assert(!types.areFunctions([]));
    assert(!types.areFunctions([1, 2, "3"]));
    assert(!types.areFunctions({}));
    assert(!types.areFunctions({ foo: "bar" }));
    assert(!types.areFunctions(/test/));
    assert(!types.areFunctions(new RegExp("")));
    assert(!types.areFunctions(/* @__PURE__ */ new Date()));
    assert(!types.areFunctions(assert, ""));
    assert(types.areFunctions(assert));
    assert(types.areFunctions(assert, assert));
    assert(types.areFunctions(function foo() {
    }));
  });
  test("isObject", () => {
    assert(!types.isObject(void 0));
    assert(!types.isObject(null));
    assert(!types.isObject("foo"));
    assert(!types.isObject(5));
    assert(!types.isObject(true));
    assert(!types.isObject([]));
    assert(!types.isObject([1, 2, "3"]));
    assert(!types.isObject(/test/));
    assert(!types.isObject(new RegExp("")));
    assert(!types.isFunction(/* @__PURE__ */ new Date()));
    assert.strictEqual(types.isObject(assert), false);
    assert(!types.isObject(function foo() {
    }));
    assert(types.isObject({}));
    assert(types.isObject({ foo: "bar" }));
  });
  test("isEmptyObject", () => {
    assert(!types.isEmptyObject(void 0));
    assert(!types.isEmptyObject(null));
    assert(!types.isEmptyObject("foo"));
    assert(!types.isEmptyObject(5));
    assert(!types.isEmptyObject(true));
    assert(!types.isEmptyObject([]));
    assert(!types.isEmptyObject([1, 2, "3"]));
    assert(!types.isEmptyObject(/test/));
    assert(!types.isEmptyObject(new RegExp("")));
    assert(!types.isEmptyObject(/* @__PURE__ */ new Date()));
    assert.strictEqual(types.isEmptyObject(assert), false);
    assert(!types.isEmptyObject(function foo() {
    }));
    assert(!types.isEmptyObject({ foo: "bar" }));
    assert(types.isEmptyObject({}));
  });
  test("isString", () => {
    assert(!types.isString(void 0));
    assert(!types.isString(null));
    assert(!types.isString(5));
    assert(!types.isString([]));
    assert(!types.isString([1, 2, "3"]));
    assert(!types.isString(true));
    assert(!types.isString({}));
    assert(!types.isString(/test/));
    assert(!types.isString(new RegExp("")));
    assert(!types.isString(/* @__PURE__ */ new Date()));
    assert(!types.isString(assert));
    assert(!types.isString(function foo() {
    }));
    assert(!types.isString({ foo: "bar" }));
    assert(types.isString("foo"));
  });
  test("isNumber", () => {
    assert(!types.isNumber(void 0));
    assert(!types.isNumber(null));
    assert(!types.isNumber("foo"));
    assert(!types.isNumber([]));
    assert(!types.isNumber([1, 2, "3"]));
    assert(!types.isNumber(true));
    assert(!types.isNumber({}));
    assert(!types.isNumber(/test/));
    assert(!types.isNumber(new RegExp("")));
    assert(!types.isNumber(/* @__PURE__ */ new Date()));
    assert(!types.isNumber(assert));
    assert(!types.isNumber(function foo() {
    }));
    assert(!types.isNumber({ foo: "bar" }));
    assert(!types.isNumber(parseInt("A", 10)));
    assert(types.isNumber(5));
  });
  test("isUndefined", () => {
    assert(!types.isUndefined(null));
    assert(!types.isUndefined("foo"));
    assert(!types.isUndefined([]));
    assert(!types.isUndefined([1, 2, "3"]));
    assert(!types.isUndefined(true));
    assert(!types.isUndefined({}));
    assert(!types.isUndefined(/test/));
    assert(!types.isUndefined(new RegExp("")));
    assert(!types.isUndefined(/* @__PURE__ */ new Date()));
    assert(!types.isUndefined(assert));
    assert(!types.isUndefined(function foo() {
    }));
    assert(!types.isUndefined({ foo: "bar" }));
    assert(types.isUndefined(void 0));
  });
  test("isUndefinedOrNull", () => {
    assert(!types.isUndefinedOrNull("foo"));
    assert(!types.isUndefinedOrNull([]));
    assert(!types.isUndefinedOrNull([1, 2, "3"]));
    assert(!types.isUndefinedOrNull(true));
    assert(!types.isUndefinedOrNull({}));
    assert(!types.isUndefinedOrNull(/test/));
    assert(!types.isUndefinedOrNull(new RegExp("")));
    assert(!types.isUndefinedOrNull(/* @__PURE__ */ new Date()));
    assert(!types.isUndefinedOrNull(assert));
    assert(!types.isUndefinedOrNull(function foo() {
    }));
    assert(!types.isUndefinedOrNull({ foo: "bar" }));
    assert(types.isUndefinedOrNull(void 0));
    assert(types.isUndefinedOrNull(null));
  });
  test("assertIsDefined / assertAreDefined", () => {
    assert.throws(() => types.assertIsDefined(void 0));
    assert.throws(() => types.assertIsDefined(null));
    assert.throws(() => types.assertAllDefined(null, void 0));
    assert.throws(() => types.assertAllDefined(true, void 0));
    assert.throws(() => types.assertAllDefined(void 0, false));
    assert.strictEqual(types.assertIsDefined(true), true);
    assert.strictEqual(types.assertIsDefined(false), false);
    assert.strictEqual(types.assertIsDefined("Hello"), "Hello");
    assert.strictEqual(types.assertIsDefined(""), "");
    const res = types.assertAllDefined(1, true, "Hello");
    assert.strictEqual(res[0], 1);
    assert.strictEqual(res[1], true);
    assert.strictEqual(res[2], "Hello");
  });
  suite("assertDefined", () => {
    test("should not throw if `value` is defined (bool)", async () => {
      assert.doesNotThrow(function() {
        assertDefined(true, "Oops something happened.");
      });
    });
    test("should not throw if `value` is defined (number)", async () => {
      assert.doesNotThrow(function() {
        assertDefined(5, "Oops something happened.");
      });
    });
    test("should not throw if `value` is defined (zero)", async () => {
      assert.doesNotThrow(function() {
        assertDefined(0, "Oops something happened.");
      });
    });
    test("should not throw if `value` is defined (string)", async () => {
      assert.doesNotThrow(function() {
        assertDefined("some string", "Oops something happened.");
      });
    });
    test("should not throw if `value` is defined (empty string)", async () => {
      assert.doesNotThrow(function() {
        assertDefined("", "Oops something happened.");
      });
    });
    const assertThrows = (testFunction, errorMessage) => {
      let thrownError;
      try {
        testFunction();
      } catch (e) {
        thrownError = e;
      }
      assertDefined(thrownError, "Must throw an error.");
      assert(
        thrownError instanceof Error,
        "Error must be an instance of `Error`."
      );
      assert.strictEqual(
        thrownError.message,
        errorMessage,
        "Error must have correct message."
      );
    };
    test("should throw if `value` is `null`", async () => {
      const errorMessage = "Uggh ohh!";
      assertThrows(() => {
        assertDefined(null, errorMessage);
      }, errorMessage);
    });
    test("should throw if `value` is `undefined`", async () => {
      const errorMessage = "Oh no!";
      assertThrows(() => {
        assertDefined(void 0, new Error(errorMessage));
      }, errorMessage);
    });
    test("should throw assertion error by default", async () => {
      const errorMessage = "Uggh ohh!";
      let thrownError;
      try {
        assertDefined(null, errorMessage);
      } catch (e) {
        thrownError = e;
      }
      assertDefined(thrownError, "Must throw an error.");
      assert(
        thrownError instanceof Error,
        "Error must be an instance of `Error`."
      );
      assert.strictEqual(
        thrownError.message,
        errorMessage,
        "Error must have correct message."
      );
    });
    test("should throw provided error instance", async () => {
      class TestError extends Error {
        constructor(...args) {
          super(...args);
          this.name = "TestError";
        }
      }
      const errorMessage = "Oops something hapenned.";
      const error = new TestError(errorMessage);
      let thrownError;
      try {
        assertDefined(null, error);
      } catch (e) {
        thrownError = e;
      }
      assert(
        thrownError instanceof TestError,
        "Error must be an instance of `TestError`."
      );
      assert.strictEqual(
        thrownError.message,
        errorMessage,
        "Error must have correct message."
      );
    });
  });
  suite("assertOneOf", () => {
    suite("success", () => {
      suite("string", () => {
        test("type", () => {
          assert.doesNotThrow(() => {
            assertOneOf(
              "foo",
              ["foo", "bar"],
              "Foo must be one of: foo, bar"
            );
          });
        });
        test("subtype", () => {
          assert.doesNotThrow(() => {
            const item = "hi";
            const list = ["hi", "ciao"];
            assertOneOf(
              item,
              list,
              "Hi must be one of: hi, ciao"
            );
            typeCheck(item);
          });
        });
      });
      suite("number", () => {
        test("type", () => {
          assert.doesNotThrow(() => {
            assertOneOf(
              10,
              [10, 100],
              "10 must be one of: 10, 100"
            );
          });
        });
        test("subtype", () => {
          assert.doesNotThrow(() => {
            const item = 20;
            const list = [20, 2e3];
            assertOneOf(
              item,
              list,
              "20 must be one of: 20, 2000"
            );
            typeCheck(item);
          });
        });
      });
      suite("boolean", () => {
        test("type", () => {
          assert.doesNotThrow(() => {
            assertOneOf(
              true,
              [true, false],
              "true must be one of: true, false"
            );
          });
          assert.doesNotThrow(() => {
            assertOneOf(
              false,
              [true, false],
              "false must be one of: true, false"
            );
          });
        });
        test("subtype (true)", () => {
          assert.doesNotThrow(() => {
            const item = true;
            const list = [true, true];
            assertOneOf(
              item,
              list,
              "true must be one of: true, true"
            );
            typeCheck(item);
          });
        });
        test("subtype (false)", () => {
          assert.doesNotThrow(() => {
            const item = false;
            const list = [false, true];
            assertOneOf(
              item,
              list,
              "false must be one of: false, true"
            );
            typeCheck(item);
          });
        });
      });
      suite("undefined", () => {
        test("type", () => {
          assert.doesNotThrow(() => {
            assertOneOf(
              void 0,
              [void 0],
              "undefined must be one of: undefined"
            );
          });
          assert.doesNotThrow(() => {
            assertOneOf(
              void 0,
              [void 0],
              "undefined must be one of: void 0"
            );
          });
        });
        test("subtype", () => {
          assert.doesNotThrow(() => {
            let item;
            const list = [void 0];
            assertOneOf(
              item,
              list,
              "undefined | null must be one of: undefined"
            );
            typeCheck(item);
          });
        });
      });
      suite("null", () => {
        test("type", () => {
          assert.doesNotThrow(() => {
            assertOneOf(
              null,
              [null],
              "null must be one of: null"
            );
          });
        });
        test("subtype", () => {
          assert.doesNotThrow(() => {
            const item = null;
            const list = [null];
            assertOneOf(
              item,
              list,
              "null must be one of: null"
            );
            typeCheck(item);
          });
        });
      });
      suite("any", () => {
        test("item", () => {
          assert.doesNotThrow(() => {
            const item = "1";
            const list = ["2", "1"];
            assertOneOf(
              item,
              list,
              "1 must be one of: 2, 1"
            );
            typeCheck(item);
          });
        });
        test("list", () => {
          assert.doesNotThrow(() => {
            const item = "5";
            const list = ["3", "5", "2.5"];
            assertOneOf(
              item,
              list,
              "5 must be one of: 3, 5, 2.5"
            );
            typeCheck(item);
          });
        });
        test("both", () => {
          assert.doesNotThrow(() => {
            const item = "12";
            const list = ["14.25", "7", "12"];
            assertOneOf(
              item,
              list,
              "12 must be one of: 14.25, 7, 12"
            );
            typeCheck(item);
          });
        });
      });
      suite("unknown", () => {
        test("item", () => {
          assert.doesNotThrow(() => {
            const item = "1";
            const list = ["2", "1"];
            assertOneOf(
              item,
              list,
              "1 must be one of: 2, 1"
            );
            typeCheck(item);
          });
        });
        test("both", () => {
          assert.doesNotThrow(() => {
            const item = "12";
            const list = ["14.25", "7", "12"];
            assertOneOf(
              item,
              list,
              "12 must be one of: 14.25, 7, 12"
            );
            typeCheck(item);
          });
        });
      });
    });
    suite("failure", () => {
      suite("string", () => {
        test("type", () => {
          assert.throws(() => {
            assertOneOf(
              "baz",
              ["foo", "bar"],
              "Baz must not be one of: foo, bar"
            );
          });
        });
        test("subtype", () => {
          assert.throws(() => {
            const item = "vitannia";
            const list = ["hi", "ciao"];
            assertOneOf(
              item,
              list,
              "vitannia must be one of: hi, ciao"
            );
          });
        });
        test("empty", () => {
          assert.throws(() => {
            const item = "vitannia";
            const list = [];
            assertOneOf(
              item,
              list,
              "vitannia must be one of: empty"
            );
          });
        });
      });
      suite("number", () => {
        test("type", () => {
          assert.throws(() => {
            assertOneOf(
              19,
              [10, 100],
              "19 must not be one of: 10, 100"
            );
          });
        });
        test("subtype", () => {
          assert.throws(() => {
            const item = 24;
            const list = [20, 2e3];
            assertOneOf(
              item,
              list,
              "24 must not be one of: 20, 2000"
            );
          });
        });
        test("empty", () => {
          assert.throws(() => {
            const item = 20;
            const list = [];
            assertOneOf(
              item,
              list,
              "20 must not be one of: empty"
            );
          });
        });
      });
      suite("boolean", () => {
        test("type", () => {
          assert.throws(() => {
            assertOneOf(
              true,
              [false],
              "true must not be one of: false"
            );
          });
          assert.throws(() => {
            assertOneOf(
              false,
              [true],
              "false must not be one of: true"
            );
          });
        });
        test("subtype (true)", () => {
          assert.throws(() => {
            const item = true;
            const list = [false];
            assertOneOf(
              item,
              list,
              "true must not be one of: false"
            );
          });
        });
        test("subtype (false)", () => {
          assert.throws(() => {
            const item = false;
            const list = [true, true, true];
            assertOneOf(
              item,
              list,
              "false must be one of: true, true, true"
            );
          });
        });
        test("empty", () => {
          assert.throws(() => {
            const item = true;
            const list = [];
            assertOneOf(
              item,
              list,
              "true must be one of: empty"
            );
          });
        });
      });
      suite("undefined", () => {
        test("type", () => {
          assert.throws(() => {
            assertOneOf(
              void 0,
              [],
              "undefined must not be one of: empty"
            );
          });
          assert.throws(() => {
            assertOneOf(
              void 0,
              [],
              "void 0 must not be one of: empty"
            );
          });
        });
        test("subtype", () => {
          assert.throws(() => {
            let item;
            const list = [null];
            assertOneOf(
              item,
              list,
              "undefined must be one of: null"
            );
          });
        });
        test("empty", () => {
          assert.throws(() => {
            let item;
            const list = [];
            assertOneOf(
              item,
              list,
              "undefined must be one of: empty"
            );
          });
        });
      });
      suite("null", () => {
        test("type", () => {
          assert.throws(() => {
            assertOneOf(
              null,
              [],
              "null must be one of: empty"
            );
          });
        });
        test("subtype", () => {
          assert.throws(() => {
            const item = null;
            const list = [];
            assertOneOf(
              item,
              list,
              "null must be one of: empty"
            );
          });
        });
      });
      suite("any", () => {
        test("item", () => {
          assert.throws(() => {
            const item = "1";
            const list = ["3", "4"];
            assertOneOf(
              item,
              list,
              "1 must not be one of: 3, 4"
            );
          });
        });
        test("list", () => {
          assert.throws(() => {
            const item = "5";
            const list = ["3", "6", "2.5"];
            assertOneOf(
              item,
              list,
              "5 must not be one of: 3, 6, 2.5"
            );
          });
        });
        test("both", () => {
          assert.throws(() => {
            const item = "12";
            const list = ["14.25", "7", "15"];
            assertOneOf(
              item,
              list,
              "12 must not be one of: 14.25, 7, 15"
            );
          });
        });
        test("empty", () => {
          assert.throws(() => {
            const item = "25";
            const list = [];
            assertOneOf(
              item,
              list,
              "25 must not be one of: empty"
            );
          });
        });
      });
      suite("unknown", () => {
        test("item", () => {
          assert.throws(() => {
            const item = "100";
            const list = ["12", "11"];
            assertOneOf(
              item,
              list,
              "100 must not be one of: 12, 11"
            );
          });
          test("both", () => {
            assert.throws(() => {
              const item = "21";
              const list = ["14.25", "7", "12"];
              assertOneOf(
                item,
                list,
                "21 must not be one of: 14.25, 7, 12"
              );
            });
          });
        });
      });
    });
  });
  test("validateConstraints", () => {
    types.validateConstraints([1, "test", true], [Number, String, Boolean]);
    types.validateConstraints([1, "test", true], ["number", "string", "boolean"]);
    types.validateConstraints([console.log], [Function]);
    types.validateConstraints([void 0], [types.isUndefined]);
    types.validateConstraints([1], [types.isNumber]);
    class Foo {
    }
    types.validateConstraints([new Foo()], [Foo]);
    function isFoo(f) {
    }
    assert.throws(() => types.validateConstraints([new Foo()], [isFoo]));
    function isFoo2(f) {
      return true;
    }
    types.validateConstraints([new Foo()], [isFoo2]);
    assert.throws(() => types.validateConstraints([1, true], [types.isNumber, types.isString]));
    assert.throws(() => types.validateConstraints(["2"], [types.isNumber]));
    assert.throws(() => types.validateConstraints([1, "test", true], [Number, String, Number]));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL3R5cGVzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi91dGlscy5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkLCBhc3NlcnRPbmVPZiwgdHlwZUNoZWNrIH0gZnJvbSAnLi4vLi4vY29tbW9uL3R5cGVzLmpzJztcblxuc3VpdGUoJ1R5cGVzJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2lzRnVuY3Rpb24nLCAoKSA9PiB7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0Z1bmN0aW9uKHVuZGVmaW5lZCkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbihudWxsKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0Z1bmN0aW9uKCdmb28nKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0Z1bmN0aW9uKDUpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRnVuY3Rpb24odHJ1ZSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbihbXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbihbMSwgMiwgJzMnXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbih7fSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbih7IGZvbzogJ2JhcicgfSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNGdW5jdGlvbigvdGVzdC8pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRnVuY3Rpb24obmV3IFJlZ0V4cCgnJykpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRnVuY3Rpb24obmV3IERhdGUoKSkpO1xuXG5cdFx0YXNzZXJ0KHR5cGVzLmlzRnVuY3Rpb24oYXNzZXJ0KSk7XG5cdFx0YXNzZXJ0KHR5cGVzLmlzRnVuY3Rpb24oZnVuY3Rpb24gZm9vKCkgeyAvKiovIH0pKTtcblx0fSk7XG5cblx0dGVzdCgnYXJlRnVuY3Rpb25zJywgKCkgPT4ge1xuXHRcdGFzc2VydCghdHlwZXMuYXJlRnVuY3Rpb25zKCkpO1xuXHRcdGFzc2VydCghdHlwZXMuYXJlRnVuY3Rpb25zKG51bGwpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucygnZm9vJykpO1xuXHRcdGFzc2VydCghdHlwZXMuYXJlRnVuY3Rpb25zKDUpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucyh0cnVlKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5hcmVGdW5jdGlvbnMoW10pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucyhbMSwgMiwgJzMnXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuYXJlRnVuY3Rpb25zKHt9KSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5hcmVGdW5jdGlvbnMoeyBmb286ICdiYXInIH0pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucygvdGVzdC8pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucyhuZXcgUmVnRXhwKCcnKSkpO1xuXHRcdGFzc2VydCghdHlwZXMuYXJlRnVuY3Rpb25zKG5ldyBEYXRlKCkpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmFyZUZ1bmN0aW9ucyhhc3NlcnQsICcnKSk7XG5cblx0XHRhc3NlcnQodHlwZXMuYXJlRnVuY3Rpb25zKGFzc2VydCkpO1xuXHRcdGFzc2VydCh0eXBlcy5hcmVGdW5jdGlvbnMoYXNzZXJ0LCBhc3NlcnQpKTtcblx0XHRhc3NlcnQodHlwZXMuYXJlRnVuY3Rpb25zKGZ1bmN0aW9uIGZvbygpIHsgLyoqLyB9KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzT2JqZWN0JywgKCkgPT4ge1xuXHRcdGFzc2VydCghdHlwZXMuaXNPYmplY3QodW5kZWZpbmVkKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc09iamVjdChudWxsKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc09iamVjdCgnZm9vJykpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNPYmplY3QoNSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNPYmplY3QodHJ1ZSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNPYmplY3QoW10pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzT2JqZWN0KFsxLCAyLCAnMyddKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc09iamVjdCgvdGVzdC8pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzT2JqZWN0KG5ldyBSZWdFeHAoJycpKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0Z1bmN0aW9uKG5ldyBEYXRlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZXMuaXNPYmplY3QoYXNzZXJ0KSwgZmFsc2UpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNPYmplY3QoZnVuY3Rpb24gZm9vKCkgeyB9KSk7XG5cblx0XHRhc3NlcnQodHlwZXMuaXNPYmplY3Qoe30pKTtcblx0XHRhc3NlcnQodHlwZXMuaXNPYmplY3QoeyBmb286ICdiYXInIH0pKTtcblx0fSk7XG5cblx0dGVzdCgnaXNFbXB0eU9iamVjdCcsICgpID0+IHtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRW1wdHlPYmplY3QodW5kZWZpbmVkKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0VtcHR5T2JqZWN0KG51bGwpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRW1wdHlPYmplY3QoJ2ZvbycpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzRW1wdHlPYmplY3QoNSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNFbXB0eU9iamVjdCh0cnVlKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0VtcHR5T2JqZWN0KFtdKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0VtcHR5T2JqZWN0KFsxLCAyLCAnMyddKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc0VtcHR5T2JqZWN0KC90ZXN0LykpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNFbXB0eU9iamVjdChuZXcgUmVnRXhwKCcnKSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNFbXB0eU9iamVjdChuZXcgRGF0ZSgpKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVzLmlzRW1wdHlPYmplY3QoYXNzZXJ0KSwgZmFsc2UpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNFbXB0eU9iamVjdChmdW5jdGlvbiBmb28oKSB7IC8qKi8gfSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNFbXB0eU9iamVjdCh7IGZvbzogJ2JhcicgfSkpO1xuXG5cdFx0YXNzZXJ0KHR5cGVzLmlzRW1wdHlPYmplY3Qoe30pKTtcblx0fSk7XG5cblx0dGVzdCgnaXNTdHJpbmcnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc1N0cmluZyh1bmRlZmluZWQpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKG51bGwpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKDUpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKFtdKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc1N0cmluZyhbMSwgMiwgJzMnXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNTdHJpbmcodHJ1ZSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNTdHJpbmcoe30pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKC90ZXN0LykpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNTdHJpbmcobmV3IFJlZ0V4cCgnJykpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKG5ldyBEYXRlKCkpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKGFzc2VydCkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNTdHJpbmcoZnVuY3Rpb24gZm9vKCkgeyAvKiovIH0pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzU3RyaW5nKHsgZm9vOiAnYmFyJyB9KSk7XG5cblx0XHRhc3NlcnQodHlwZXMuaXNTdHJpbmcoJ2ZvbycpKTtcblx0fSk7XG5cblx0dGVzdCgnaXNOdW1iZXInLCAoKSA9PiB7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcih1bmRlZmluZWQpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKG51bGwpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKCdmb28nKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcihbXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNOdW1iZXIoWzEsIDIsICczJ10pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKHRydWUpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKHt9KSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcigvdGVzdC8pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKG5ldyBSZWdFeHAoJycpKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcihuZXcgRGF0ZSgpKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcihhc3NlcnQpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzTnVtYmVyKGZ1bmN0aW9uIGZvbygpIHsgLyoqLyB9KSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc051bWJlcih7IGZvbzogJ2JhcicgfSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNOdW1iZXIocGFyc2VJbnQoJ0EnLCAxMCkpKTtcblxuXHRcdGFzc2VydCh0eXBlcy5pc051bWJlcig1KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzVW5kZWZpbmVkJywgKCkgPT4ge1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQobnVsbCkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQoJ2ZvbycpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkKFtdKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc1VuZGVmaW5lZChbMSwgMiwgJzMnXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQodHJ1ZSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQoe30pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkKC90ZXN0LykpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQobmV3IFJlZ0V4cCgnJykpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkKG5ldyBEYXRlKCkpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkKGFzc2VydCkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWQoZnVuY3Rpb24gZm9vKCkgeyAvKiovIH0pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkKHsgZm9vOiAnYmFyJyB9KSk7XG5cblx0XHRhc3NlcnQodHlwZXMuaXNVbmRlZmluZWQodW5kZWZpbmVkKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzVW5kZWZpbmVkT3JOdWxsJywgKCkgPT4ge1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWRPck51bGwoJ2ZvbycpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKFtdKSk7XG5cdFx0YXNzZXJ0KCF0eXBlcy5pc1VuZGVmaW5lZE9yTnVsbChbMSwgMiwgJzMnXSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWRPck51bGwodHJ1ZSkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWRPck51bGwoe30pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKC90ZXN0LykpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWRPck51bGwobmV3IFJlZ0V4cCgnJykpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKG5ldyBEYXRlKCkpKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKGFzc2VydCkpO1xuXHRcdGFzc2VydCghdHlwZXMuaXNVbmRlZmluZWRPck51bGwoZnVuY3Rpb24gZm9vKCkgeyAvKiovIH0pKTtcblx0XHRhc3NlcnQoIXR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKHsgZm9vOiAnYmFyJyB9KSk7XG5cblx0XHRhc3NlcnQodHlwZXMuaXNVbmRlZmluZWRPck51bGwodW5kZWZpbmVkKSk7XG5cdFx0YXNzZXJ0KHR5cGVzLmlzVW5kZWZpbmVkT3JOdWxsKG51bGwpKTtcblx0fSk7XG5cblx0dGVzdCgnYXNzZXJ0SXNEZWZpbmVkIC8gYXNzZXJ0QXJlRGVmaW5lZCcsICgpID0+IHtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLmFzc2VydElzRGVmaW5lZCh1bmRlZmluZWQpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLmFzc2VydElzRGVmaW5lZChudWxsKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiB0eXBlcy5hc3NlcnRBbGxEZWZpbmVkKG51bGwsIHVuZGVmaW5lZCkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gdHlwZXMuYXNzZXJ0QWxsRGVmaW5lZCh0cnVlLCB1bmRlZmluZWQpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLmFzc2VydEFsbERlZmluZWQodW5kZWZpbmVkLCBmYWxzZSkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVzLmFzc2VydElzRGVmaW5lZCh0cnVlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHR5cGVzLmFzc2VydElzRGVmaW5lZChmYWxzZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZXMuYXNzZXJ0SXNEZWZpbmVkKCdIZWxsbycpLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZXMuYXNzZXJ0SXNEZWZpbmVkKCcnKSwgJycpO1xuXG5cdFx0Y29uc3QgcmVzID0gdHlwZXMuYXNzZXJ0QWxsRGVmaW5lZCgxLCB0cnVlLCAnSGVsbG8nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzWzBdLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzWzFdLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzWzJdLCAnSGVsbG8nKTtcblx0fSk7XG5cblx0c3VpdGUoJ2Fzc2VydERlZmluZWQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIG5vdCB0aHJvdyBpZiBgdmFsdWVgIGlzIGRlZmluZWQgKGJvb2wpJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdyhmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGFzc2VydERlZmluZWQodHJ1ZSwgJ09vcHMgc29tZXRoaW5nIGhhcHBlbmVkLicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgbm90IHRocm93IGlmIGB2YWx1ZWAgaXMgZGVmaW5lZCAobnVtYmVyKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRhc3NlcnREZWZpbmVkKDUsICdPb3BzIHNvbWV0aGluZyBoYXBwZW5lZC4nKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCB0aHJvdyBpZiBgdmFsdWVgIGlzIGRlZmluZWQgKHplcm8pJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdyhmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGFzc2VydERlZmluZWQoMCwgJ09vcHMgc29tZXRoaW5nIGhhcHBlbmVkLicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgbm90IHRocm93IGlmIGB2YWx1ZWAgaXMgZGVmaW5lZCAoc3RyaW5nKScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRhc3NlcnREZWZpbmVkKCdzb21lIHN0cmluZycsICdPb3BzIHNvbWV0aGluZyBoYXBwZW5lZC4nKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIG5vdCB0aHJvdyBpZiBgdmFsdWVgIGlzIGRlZmluZWQgKGVtcHR5IHN0cmluZyknLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KGZ1bmN0aW9uICgpIHtcblx0XHRcdFx0YXNzZXJ0RGVmaW5lZCgnJywgJ09vcHMgc29tZXRoaW5nIGhhcHBlbmVkLicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHQvKipcblx0XHQgKiBOb3RlISBBUEkgb2YgYGFzc2VydC50aHJvd3MoKWAgaXMgZGlmZmVyZW50IGluIHRoZSBicm93c2VyXG5cdFx0ICogYW5kIGluIE5vZGUuanMsIGFuZCBpdCBpcyBub3QgcG9zc2libGUgdG8gdXNlIHRoZSBzYW1lIGNvZGVcblx0XHQgKiBoZXJlLiBUaGVyZWZvcmUgd2UgaGFkIHRvIHJlc29ydCB0byB0aGUgbWFudWFsIHRyeS9jYXRjaC5cblx0XHQgKi9cblx0XHRjb25zdCBhc3NlcnRUaHJvd3MgPSAoXG5cdFx0XHR0ZXN0RnVuY3Rpb246ICgpID0+IHZvaWQsXG5cdFx0XHRlcnJvck1lc3NhZ2U6IHN0cmluZyxcblx0XHQpID0+IHtcblx0XHRcdGxldCB0aHJvd25FcnJvcjogRXJyb3IgfCB1bmRlZmluZWQ7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdHRlc3RGdW5jdGlvbigpO1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHR0aHJvd25FcnJvciA9IGUgYXMgRXJyb3I7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydERlZmluZWQodGhyb3duRXJyb3IsICdNdXN0IHRocm93IGFuIGVycm9yLicpO1xuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHR0aHJvd25FcnJvciBpbnN0YW5jZW9mIEVycm9yLFxuXHRcdFx0XHQnRXJyb3IgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBgRXJyb3JgLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRocm93bkVycm9yLm1lc3NhZ2UsXG5cdFx0XHRcdGVycm9yTWVzc2FnZSxcblx0XHRcdFx0J0Vycm9yIG11c3QgaGF2ZSBjb3JyZWN0IG1lc3NhZ2UuJyxcblx0XHRcdCk7XG5cdFx0fTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBgdmFsdWVgIGlzIGBudWxsYCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9ICdVZ2doIG9oaCEnO1xuXHRcdFx0YXNzZXJ0VGhyb3dzKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0RGVmaW5lZChudWxsLCBlcnJvck1lc3NhZ2UpO1xuXHRcdFx0fSwgZXJyb3JNZXNzYWdlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBgdmFsdWVgIGlzIGB1bmRlZmluZWRgJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gJ09oIG5vISc7XG5cdFx0XHRhc3NlcnRUaHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnREZWZpbmVkKHVuZGVmaW5lZCwgbmV3IEVycm9yKGVycm9yTWVzc2FnZSkpO1xuXHRcdFx0fSwgZXJyb3JNZXNzYWdlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBhc3NlcnRpb24gZXJyb3IgYnkgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGVycm9yTWVzc2FnZSA9ICdVZ2doIG9oaCEnO1xuXHRcdFx0bGV0IHRocm93bkVycm9yOiBFcnJvciB8IHVuZGVmaW5lZDtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGFzc2VydERlZmluZWQobnVsbCwgZXJyb3JNZXNzYWdlKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhyb3duRXJyb3IgPSBlIGFzIEVycm9yO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnREZWZpbmVkKHRocm93bkVycm9yLCAnTXVzdCB0aHJvdyBhbiBlcnJvci4nKTtcblxuXHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHR0aHJvd25FcnJvciBpbnN0YW5jZW9mIEVycm9yLFxuXHRcdFx0XHQnRXJyb3IgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBgRXJyb3JgLicsXG5cdFx0XHQpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoXG5cdFx0XHRcdHRocm93bkVycm9yLm1lc3NhZ2UsXG5cdFx0XHRcdGVycm9yTWVzc2FnZSxcblx0XHRcdFx0J0Vycm9yIG11c3QgaGF2ZSBjb3JyZWN0IG1lc3NhZ2UuJyxcblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgdGhyb3cgcHJvdmlkZWQgZXJyb3IgaW5zdGFuY2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjbGFzcyBUZXN0RXJyb3IgZXh0ZW5kcyBFcnJvciB7XG5cdFx0XHRcdGNvbnN0cnVjdG9yKC4uLmFyZ3M6IENvbnN0cnVjdG9yUGFyYW1ldGVyczx0eXBlb2YgRXJyb3I+KSB7XG5cdFx0XHRcdFx0c3VwZXIoLi4uYXJncyk7XG5cblx0XHRcdFx0XHR0aGlzLm5hbWUgPSAnVGVzdEVycm9yJztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSAnT29wcyBzb21ldGhpbmcgaGFwZW5uZWQuJztcblx0XHRcdGNvbnN0IGVycm9yID0gbmV3IFRlc3RFcnJvcihlcnJvck1lc3NhZ2UpO1xuXG5cdFx0XHRsZXQgdGhyb3duRXJyb3I7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhc3NlcnREZWZpbmVkKG51bGwsIGVycm9yKTtcblx0XHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdFx0dGhyb3duRXJyb3IgPSBlO1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnQoXG5cdFx0XHRcdHRocm93bkVycm9yIGluc3RhbmNlb2YgVGVzdEVycm9yLFxuXHRcdFx0XHQnRXJyb3IgbXVzdCBiZSBhbiBpbnN0YW5jZSBvZiBgVGVzdEVycm9yYC4nLFxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChcblx0XHRcdFx0dGhyb3duRXJyb3IubWVzc2FnZSxcblx0XHRcdFx0ZXJyb3JNZXNzYWdlLFxuXHRcdFx0XHQnRXJyb3IgbXVzdCBoYXZlIGNvcnJlY3QgbWVzc2FnZS4nLFxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2Fzc2VydE9uZU9mJywgKCkgPT4ge1xuXHRcdHN1aXRlKCdzdWNjZXNzJywgKCkgPT4ge1xuXHRcdFx0c3VpdGUoJ3N0cmluZycsICgpID0+IHtcblx0XHRcdFx0dGVzdCgndHlwZScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHQnZm9vJyxcblx0XHRcdFx0XHRcdFx0Wydmb28nLCAnYmFyJ10sXG5cdFx0XHRcdFx0XHRcdCdGb28gbXVzdCBiZSBvbmUgb2Y6IGZvbywgYmFyJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ3N1YnR5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBzdHJpbmcgPSAnaGknO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKCdoaScgfCAnY2lhbycgfCAnaG9sYScpW10gPSBbJ2hpJywgJ2NpYW8nXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCdIaSBtdXN0IGJlIG9uZSBvZjogaGksIGNpYW8nLFxuXHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0dHlwZUNoZWNrPCdoaScgfCAnY2lhbycgfCAnaG9sYSc+KGl0ZW0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgnbnVtYmVyJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCd0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdDEwLFxuXHRcdFx0XHRcdFx0XHRbMTAsIDEwMF0sXG5cdFx0XHRcdFx0XHRcdCcxMCBtdXN0IGJlIG9uZSBvZjogMTAsIDEwMCcsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdzdWJ0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogbnVtYmVyID0gMjA7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAoMjAgfCAyMDAwKVtdID0gWzIwLCAyMDAwXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcyMCBtdXN0IGJlIG9uZSBvZjogMjAsIDIwMDAnLFxuXHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0dHlwZUNoZWNrPDIwIHwgMjAwMD4oaXRlbSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHR9KTtcblxuXHRcdFx0c3VpdGUoJ2Jvb2xlYW4nLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ3R5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0XHRcdFx0W3RydWUsIGZhbHNlXSxcblx0XHRcdFx0XHRcdFx0J3RydWUgbXVzdCBiZSBvbmUgb2Y6IHRydWUsIGZhbHNlJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0XHRcdFx0W3RydWUsIGZhbHNlXSxcblx0XHRcdFx0XHRcdFx0J2ZhbHNlIG11c3QgYmUgb25lIG9mOiB0cnVlLCBmYWxzZScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdzdWJ0eXBlICh0cnVlKScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKHRydWUpW10gPSBbdHJ1ZSwgdHJ1ZV07XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQndHJ1ZSBtdXN0IGJlIG9uZSBvZjogdHJ1ZSwgdHJ1ZScsXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHR0eXBlQ2hlY2s8dHJ1ZT4oaXRlbSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ3N1YnR5cGUgKGZhbHNlKScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IGJvb2xlYW4gPSBmYWxzZTtcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6IChmYWxzZSB8IHRydWUpW10gPSBbZmFsc2UsIHRydWVdO1xuXG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0aXRlbSxcblx0XHRcdFx0XHRcdFx0bGlzdCxcblx0XHRcdFx0XHRcdFx0J2ZhbHNlIG11c3QgYmUgb25lIG9mOiBmYWxzZSwgdHJ1ZScsXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHR0eXBlQ2hlY2s8ZmFsc2U+KGl0ZW0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgndW5kZWZpbmVkJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCd0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0W3VuZGVmaW5lZF0sXG5cdFx0XHRcdFx0XHRcdCd1bmRlZmluZWQgbXVzdCBiZSBvbmUgb2Y6IHVuZGVmaW5lZCcsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRbdm9pZCAwXSxcblx0XHRcdFx0XHRcdFx0J3VuZGVmaW5lZCBtdXN0IGJlIG9uZSBvZjogdm9pZCAwJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ3N1YnR5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRsZXQgaXRlbTogdW5kZWZpbmVkIHwgbnVsbDtcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6ICh1bmRlZmluZWQpW10gPSBbdW5kZWZpbmVkXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCd1bmRlZmluZWQgfCBudWxsIG11c3QgYmUgb25lIG9mOiB1bmRlZmluZWQnLFxuXHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0dHlwZUNoZWNrPHVuZGVmaW5lZD4oaXRlbSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdudWxsJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCd0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdG51bGwsXG5cdFx0XHRcdFx0XHRcdFtudWxsXSxcblx0XHRcdFx0XHRcdFx0J251bGwgbXVzdCBiZSBvbmUgb2Y6IG51bGwnLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnc3VidHlwZScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IHVuZGVmaW5lZCB8IG51bGwgfCBzdHJpbmcgPSBudWxsO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKG51bGwpW10gPSBbbnVsbF07XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQnbnVsbCBtdXN0IGJlIG9uZSBvZjogbnVsbCcsXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHR0eXBlQ2hlY2s8bnVsbD4oaXRlbSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdhbnknLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ2l0ZW0nLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBhbnkgPSAnMSc7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAoJzEnIHwgJzInKVtdID0gWycyJywgJzEnXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcxIG11c3QgYmUgb25lIG9mOiAyLCAxJyxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdHR5cGVDaGVjazwnMScgfCAnMic+KGl0ZW0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdsaXN0JywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogJzUnID0gJzUnO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogYW55W10gPSBbJzMnLCAnNScsICcyLjUnXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCc1IG11c3QgYmUgb25lIG9mOiAzLCA1LCAyLjUnLFxuXHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0dHlwZUNoZWNrPCc1Jz4oaXRlbSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ2JvdGgnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LmRvZXNOb3RUaHJvdygoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBhbnkgPSAnMTInO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogYW55W10gPSBbJzE0LjI1JywgJzcnLCAnMTInXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcxMiBtdXN0IGJlIG9uZSBvZjogMTQuMjUsIDcsIDEyJyxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdHR5cGVDaGVjazxhbnk+KGl0ZW0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgndW5rbm93bicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgnaXRlbScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuZG9lc05vdFRocm93KCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IHVua25vd24gPSAnMSc7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAoJzEnIHwgJzInKVtdID0gWycyJywgJzEnXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcxIG11c3QgYmUgb25lIG9mOiAyLCAxJyxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdHR5cGVDaGVjazwnMScgfCAnMic+KGl0ZW0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdib3RoJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kb2VzTm90VGhyb3coKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogdW5rbm93biA9ICcxMic7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiB1bmtub3duW10gPSBbJzE0LjI1JywgJzcnLCAnMTInXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcxMiBtdXN0IGJlIG9uZSBvZjogMTQuMjUsIDcsIDEyJyxcblx0XHRcdFx0XHRcdCk7XG5cblx0XHRcdFx0XHRcdHR5cGVDaGVjazx1bmtub3duPihpdGVtKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdmYWlsdXJlJywgKCkgPT4ge1xuXHRcdFx0c3VpdGUoJ3N0cmluZycsICgpID0+IHtcblx0XHRcdFx0dGVzdCgndHlwZScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHQnYmF6Jyxcblx0XHRcdFx0XHRcdFx0Wydmb28nLCAnYmFyJ10sXG5cdFx0XHRcdFx0XHRcdCdCYXogbXVzdCBub3QgYmUgb25lIG9mOiBmb28sIGJhcicsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdzdWJ0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogc3RyaW5nID0gJ3ZpdGFubmlhJztcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6ICgnaGknIHwgJ2NpYW8nIHwgJ2hvbGEnKVtdID0gWydoaScsICdjaWFvJ107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQndml0YW5uaWEgbXVzdCBiZSBvbmUgb2Y6IGhpLCBjaWFvJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogc3RyaW5nID0gJ3ZpdGFubmlhJztcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6ICgnaGknIHwgJ2NpYW8nIHwgJ2hvbGEnKVtdID0gW107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQndml0YW5uaWEgbXVzdCBiZSBvbmUgb2Y6IGVtcHR5Jyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCdudW1iZXInLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ3R5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0MTksXG5cdFx0XHRcdFx0XHRcdFsxMCwgMTAwXSxcblx0XHRcdFx0XHRcdFx0JzE5IG11c3Qgbm90IGJlIG9uZSBvZjogMTAsIDEwMCcsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdzdWJ0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogbnVtYmVyID0gMjQ7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAoMjAgfCAyMDAwKVtdID0gWzIwLCAyMDAwXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcyNCBtdXN0IG5vdCBiZSBvbmUgb2Y6IDIwLCAyMDAwJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogbnVtYmVyID0gMjA7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAoMjAgfCAyMDAwKVtdID0gW107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQnMjAgbXVzdCBub3QgYmUgb25lIG9mOiBlbXB0eScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgnYm9vbGVhbicsICgpID0+IHtcblx0XHRcdFx0dGVzdCgndHlwZScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRcdFx0XHRbZmFsc2VdLFxuXHRcdFx0XHRcdFx0XHQndHJ1ZSBtdXN0IG5vdCBiZSBvbmUgb2Y6IGZhbHNlJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0XHRcdFx0W3RydWVdLFxuXHRcdFx0XHRcdFx0XHQnZmFsc2UgbXVzdCBub3QgYmUgb25lIG9mOiB0cnVlJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ3N1YnR5cGUgKHRydWUpJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogYm9vbGVhbiA9IHRydWU7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAodHJ1ZSB8IGZhbHNlKVtdID0gW2ZhbHNlXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCd0cnVlIG11c3Qgbm90IGJlIG9uZSBvZjogZmFsc2UnLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnc3VidHlwZSAoZmFsc2UpJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKGZhbHNlIHwgdHJ1ZSlbXSA9IFt0cnVlLCB0cnVlLCB0cnVlXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCdmYWxzZSBtdXN0IGJlIG9uZSBvZjogdHJ1ZSwgdHJ1ZSwgdHJ1ZScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdlbXB0eScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKGZhbHNlIHwgdHJ1ZSlbXSA9IFtdO1xuXG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0aXRlbSxcblx0XHRcdFx0XHRcdFx0bGlzdCxcblx0XHRcdFx0XHRcdFx0J3RydWUgbXVzdCBiZSBvbmUgb2Y6IGVtcHR5Jyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCd1bmRlZmluZWQnLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ3R5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRbXSxcblx0XHRcdFx0XHRcdFx0J3VuZGVmaW5lZCBtdXN0IG5vdCBiZSBvbmUgb2Y6IGVtcHR5Jyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHR2b2lkIDAsXG5cdFx0XHRcdFx0XHRcdFtdLFxuXHRcdFx0XHRcdFx0XHQndm9pZCAwIG11c3Qgbm90IGJlIG9uZSBvZjogZW1wdHknLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnc3VidHlwZScsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGxldCBpdGVtOiB1bmRlZmluZWQgfCBudWxsO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKHVuZGVmaW5lZCB8IG51bGwpW10gPSBbbnVsbF07XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQndW5kZWZpbmVkIG11c3QgYmUgb25lIG9mOiBudWxsJyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHRlc3QoJ2VtcHR5JywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0bGV0IGl0ZW06IHVuZGVmaW5lZCB8IG51bGw7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiAodW5kZWZpbmVkIHwgbnVsbClbXSA9IFtdO1xuXG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0aXRlbSxcblx0XHRcdFx0XHRcdFx0bGlzdCxcblx0XHRcdFx0XHRcdFx0J3VuZGVmaW5lZCBtdXN0IGJlIG9uZSBvZjogZW1wdHknLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0c3VpdGUoJ251bGwnLCAoKSA9PiB7XG5cdFx0XHRcdHRlc3QoJ3R5cGUnLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0bnVsbCxcblx0XHRcdFx0XHRcdFx0W10sXG5cdFx0XHRcdFx0XHRcdCdudWxsIG11c3QgYmUgb25lIG9mOiBlbXB0eScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdzdWJ0eXBlJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogdW5kZWZpbmVkIHwgbnVsbCB8IHN0cmluZyA9IG51bGw7XG5cdFx0XHRcdFx0XHRjb25zdCBsaXN0OiBudWxsW10gPSBbXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCdudWxsIG11c3QgYmUgb25lIG9mOiBlbXB0eScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXG5cdFx0XHRzdWl0ZSgnYW55JywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCdpdGVtJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogYW55ID0gJzEnO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKCcxJyB8ICcyJyB8ICczJyB8ICc0JylbXSA9IFsnMycsICc0J107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQnMSBtdXN0IG5vdCBiZSBvbmUgb2Y6IDMsIDQnLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnbGlzdCcsICgpID0+IHtcblx0XHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06ICc1JyA9ICc1Jztcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6IGFueVtdID0gWyczJywgJzYnLCAnMi41J107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQnNSBtdXN0IG5vdCBiZSBvbmUgb2Y6IDMsIDYsIDIuNScsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHR0ZXN0KCdib3RoJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogYW55ID0gJzEyJztcblx0XHRcdFx0XHRcdGNvbnN0IGxpc3Q6IGFueVtdID0gWycxNC4yNScsICc3JywgJzE1J107XG5cblx0XHRcdFx0XHRcdGFzc2VydE9uZU9mKFxuXHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRsaXN0LFxuXHRcdFx0XHRcdFx0XHQnMTIgbXVzdCBub3QgYmUgb25lIG9mOiAxNC4yNSwgNywgMTUnLFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSk7XG5cblx0XHRcdFx0dGVzdCgnZW1wdHknLCAoKSA9PiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpdGVtOiBhbnkgPSAnMjUnO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogYW55W10gPSBbXTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0T25lT2YoXG5cdFx0XHRcdFx0XHRcdGl0ZW0sXG5cdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdCcyNSBtdXN0IG5vdCBiZSBvbmUgb2Y6IGVtcHR5Jyxcblx0XHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cblx0XHRcdHN1aXRlKCd1bmtub3duJywgKCkgPT4ge1xuXHRcdFx0XHR0ZXN0KCdpdGVtJywgKCkgPT4ge1xuXHRcdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3QgaXRlbTogdW5rbm93biA9ICcxMDAnO1xuXHRcdFx0XHRcdFx0Y29uc3QgbGlzdDogKCcxMScgfCAnMTInKVtdID0gWycxMicsICcxMSddO1xuXG5cdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0aXRlbSxcblx0XHRcdFx0XHRcdFx0bGlzdCxcblx0XHRcdFx0XHRcdFx0JzEwMCBtdXN0IG5vdCBiZSBvbmUgb2Y6IDEyLCAxMScsXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHR0ZXN0KCdib3RoJywgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IGl0ZW06IHVua25vd24gPSAnMjEnO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBsaXN0OiB1bmtub3duW10gPSBbJzE0LjI1JywgJzcnLCAnMTInXTtcblxuXHRcdFx0XHRcdFx0XHRhc3NlcnRPbmVPZihcblx0XHRcdFx0XHRcdFx0XHRpdGVtLFxuXHRcdFx0XHRcdFx0XHRcdGxpc3QsXG5cdFx0XHRcdFx0XHRcdFx0JzIxIG11c3Qgbm90IGJlIG9uZSBvZjogMTQuMjUsIDcsIDEyJyxcblx0XHRcdFx0XHRcdFx0KTtcblxuXHRcdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ZhbGlkYXRlQ29uc3RyYWludHMnLCAoKSA9PiB7XG5cdFx0dHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbMSwgJ3Rlc3QnLCB0cnVlXSwgW051bWJlciwgU3RyaW5nLCBCb29sZWFuXSk7XG5cdFx0dHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbMSwgJ3Rlc3QnLCB0cnVlXSwgWydudW1iZXInLCAnc3RyaW5nJywgJ2Jvb2xlYW4nXSk7XG5cdFx0dHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbY29uc29sZS5sb2ddLCBbRnVuY3Rpb25dKTtcblx0XHR0eXBlcy52YWxpZGF0ZUNvbnN0cmFpbnRzKFt1bmRlZmluZWRdLCBbdHlwZXMuaXNVbmRlZmluZWRdKTtcblx0XHR0eXBlcy52YWxpZGF0ZUNvbnN0cmFpbnRzKFsxXSwgW3R5cGVzLmlzTnVtYmVyXSk7XG5cblx0XHRjbGFzcyBGb28geyB9XG5cdFx0dHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbbmV3IEZvbygpXSwgW0Zvb10pO1xuXG5cdFx0ZnVuY3Rpb24gaXNGb28oZjogYW55KSB7IH1cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLnZhbGlkYXRlQ29uc3RyYWludHMoW25ldyBGb28oKV0sIFtpc0Zvb10pKTtcblxuXHRcdGZ1bmN0aW9uIGlzRm9vMihmOiBhbnkpIHsgcmV0dXJuIHRydWU7IH1cblx0XHR0eXBlcy52YWxpZGF0ZUNvbnN0cmFpbnRzKFtuZXcgRm9vKCldLCBbaXNGb28yXSk7XG5cblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHR5cGVzLnZhbGlkYXRlQ29uc3RyYWludHMoWzEsIHRydWVdLCBbdHlwZXMuaXNOdW1iZXIsIHR5cGVzLmlzU3RyaW5nXSkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gdHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbJzInXSwgW3R5cGVzLmlzTnVtYmVyXSkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gdHlwZXMudmFsaWRhdGVDb25zdHJhaW50cyhbMSwgJ3Rlc3QnLCB0cnVlXSwgW051bWJlciwgU3RyaW5nLCBOdW1iZXJdKSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsZUFBZSxhQUFhLGlCQUFpQjtBQUV0RCxNQUFNLFNBQVMsTUFBTTtBQUVwQiwwQ0FBd0M7QUFFeEMsT0FBSyxjQUFjLE1BQU07QUFDeEIsV0FBTyxDQUFDLE1BQU0sV0FBVyxNQUFTLENBQUM7QUFDbkMsV0FBTyxDQUFDLE1BQU0sV0FBVyxJQUFJLENBQUM7QUFDOUIsV0FBTyxDQUFDLE1BQU0sV0FBVyxLQUFLLENBQUM7QUFDL0IsV0FBTyxDQUFDLE1BQU0sV0FBVyxDQUFDLENBQUM7QUFDM0IsV0FBTyxDQUFDLE1BQU0sV0FBVyxJQUFJLENBQUM7QUFDOUIsV0FBTyxDQUFDLE1BQU0sV0FBVyxDQUFDLENBQUMsQ0FBQztBQUM1QixXQUFPLENBQUMsTUFBTSxXQUFXLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQ3JDLFdBQU8sQ0FBQyxNQUFNLFdBQVcsQ0FBQyxDQUFDLENBQUM7QUFDNUIsV0FBTyxDQUFDLE1BQU0sV0FBVyxFQUFFLEtBQUssTUFBTSxDQUFDLENBQUM7QUFDeEMsV0FBTyxDQUFDLE1BQU0sV0FBVyxNQUFNLENBQUM7QUFDaEMsV0FBTyxDQUFDLE1BQU0sV0FBVyxJQUFJLE9BQU8sRUFBRSxDQUFDLENBQUM7QUFDeEMsV0FBTyxDQUFDLE1BQU0sV0FBVyxvQkFBSSxLQUFLLENBQUMsQ0FB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
