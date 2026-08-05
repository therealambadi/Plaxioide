import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "./utils.js";
import { isPointWithinTriangle, randomInt } from "../../common/numbers.js";
suite("isPointWithinTriangle", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("should return true if the point is within the triangle", () => {
    const result = isPointWithinTriangle(0.25, 0.25, 0, 0, 1, 0, 0, 1);
    assert.ok(result);
  });
  test("should return false if the point is outside the triangle", () => {
    const result = isPointWithinTriangle(2, 2, 0, 0, 1, 0, 0, 1);
    assert.ok(!result);
  });
  test("should return true if the point is on the edge of the triangle", () => {
    const result = isPointWithinTriangle(0.5, 0, 0, 0, 1, 0, 0, 1);
    assert.ok(result);
  });
});
suite("randomInt", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const testRandomIntUtil = (max, min, testName) => {
    suite(testName, () => {
      let i = 0;
      while (++i < 5) {
        test(`should generate random boolean attempt#${i}`, async () => {
          let iterations = 100;
          while (iterations-- > 0) {
            const int = randomInt(max, min);
            assert(
              int <= max,
              `Expected ${int} to be less than or equal to ${max}.`
            );
            assert(
              int >= (min ?? 0),
              `Expected ${int} to be greater than or equal to ${min ?? 0}.`
            );
          }
        });
      }
      test("should include min and max", async () => {
        let iterations = 125;
        const results = [];
        while (iterations-- > 0) {
          results.push(randomInt(max, min));
        }
        assert(
          results.includes(max),
          `Expected ${results} to include ${max}.`
        );
        assert(
          results.includes(min ?? 0),
          `Expected ${results} to include ${min ?? 0}.`
        );
      });
    });
  };
  suite("positive numbers", () => {
    testRandomIntUtil(4, 2, "max: 4, min: 2");
    testRandomIntUtil(4, 0, "max: 4, min: 0");
    testRandomIntUtil(4, void 0, "max: 4, min: undefined");
    testRandomIntUtil(1, 0, "max: 0, min: 0");
  });
  suite("negative numbers", () => {
    testRandomIntUtil(-2, -5, "max: -2, min: -5");
    testRandomIntUtil(0, -5, "max: 0, min: -5");
    testRandomIntUtil(0, -1, "max: 0, min: -1");
  });
  suite("split numbers", () => {
    testRandomIntUtil(3, -1, "max: 3, min: -1");
    testRandomIntUtil(2, -2, "max: 2, min: -2");
    testRandomIntUtil(1, -3, "max: 2, min: -2");
  });
  suite("errors", () => {
    test('should throw if "min" is == "max" #1', () => {
      assert.throws(() => {
        randomInt(200, 200);
      }, `"max"(200) param should be greater than "min"(200)."`);
    });
    test('should throw if "min" is == "max" #2', () => {
      assert.throws(() => {
        randomInt(2, 2);
      }, `"max"(2) param should be greater than "min"(2)."`);
    });
    test('should throw if "min" is == "max" #3', () => {
      assert.throws(() => {
        randomInt(0);
      }, `"max"(0) param should be greater than "min"(0)."`);
    });
    test('should throw if "min" is > "max" #1', () => {
      assert.throws(() => {
        randomInt(2, 3);
      }, `"max"(2) param should be greater than "min"(3)."`);
    });
    test('should throw if "min" is > "max" #2', () => {
      assert.throws(() => {
        randomInt(999, 2e3);
      }, `"max"(999) param should be greater than "min"(2000)."`);
    });
    test('should throw if "min" is > "max" #3', () => {
      assert.throws(() => {
        randomInt(0, 1);
      }, `"max"(0) param should be greater than "min"(1)."`);
    });
    test('should throw if "min" is > "max" #4', () => {
      assert.throws(() => {
        randomInt(-5, 2);
      }, `"max"(-5) param should be greater than "min"(2)."`);
    });
    test('should throw if "min" is > "max" #5', () => {
      assert.throws(() => {
        randomInt(-4, 0);
      }, `"max"(-4) param should be greater than "min"(0)."`);
    });
    test('should throw if "min" is > "max" #6', () => {
      assert.throws(() => {
        randomInt(-4);
      }, `"max"(-4) param should be greater than "min"(0)."`);
    });
    test('should throw if "max" is `NaN`', () => {
      assert.throws(() => {
        randomInt(NaN);
      }, `"max" param is not a number."`);
    });
    test('should throw if "min" is `NaN`', () => {
      assert.throws(() => {
        randomInt(4, NaN);
      }, `"min" param is not a number."`);
    });
    suite("infinite arguments", () => {
      test('should throw if "max" is infinite [Infinity]', () => {
        assert.throws(() => {
          randomInt(Infinity);
        }, `"max" param is not finite."`);
      });
      test('should throw if "max" is infinite [-Infinity]', () => {
        assert.throws(() => {
          randomInt(-Infinity);
        }, `"max" param is not finite."`);
      });
      test('should throw if "max" is infinite [+Infinity]', () => {
        assert.throws(() => {
          randomInt(Infinity);
        }, `"max" param is not finite."`);
      });
      test('should throw if "min" is infinite [Infinity]', () => {
        assert.throws(() => {
          randomInt(Infinity, Infinity);
        }, `"max" param is not finite."`);
      });
      test('should throw if "min" is infinite [-Infinity]', () => {
        assert.throws(() => {
          randomInt(Infinity, -Infinity);
        }, `"max" param is not finite."`);
      });
      test('should throw if "min" is infinite [+Infinity]', () => {
        assert.throws(() => {
          randomInt(Infinity, Infinity);
        }, `"max" param is not finite."`);
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL3Rlc3QvY29tbW9uL251bWJlcnMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4vdXRpbHMuanMnO1xuaW1wb3J0IHsgaXNQb2ludFdpdGhpblRyaWFuZ2xlLCByYW5kb21JbnQgfSBmcm9tICcuLi8uLi9jb21tb24vbnVtYmVycy5qcyc7XG5cbnN1aXRlKCdpc1BvaW50V2l0aGluVHJpYW5nbGUnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3Nob3VsZCByZXR1cm4gdHJ1ZSBpZiB0aGUgcG9pbnQgaXMgd2l0aGluIHRoZSB0cmlhbmdsZScsICgpID0+IHtcblx0XHRjb25zdCByZXN1bHQgPSBpc1BvaW50V2l0aGluVHJpYW5nbGUoMC4yNSwgMC4yNSwgMCwgMCwgMSwgMCwgMCwgMSk7XG5cdFx0YXNzZXJ0Lm9rKHJlc3VsdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCByZXR1cm4gZmFsc2UgaWYgdGhlIHBvaW50IGlzIG91dHNpZGUgdGhlIHRyaWFuZ2xlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGlzUG9pbnRXaXRoaW5UcmlhbmdsZSgyLCAyLCAwLCAwLCAxLCAwLCAwLCAxKTtcblx0XHRhc3NlcnQub2soIXJlc3VsdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCByZXR1cm4gdHJ1ZSBpZiB0aGUgcG9pbnQgaXMgb24gdGhlIGVkZ2Ugb2YgdGhlIHRyaWFuZ2xlJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGlzUG9pbnRXaXRoaW5UcmlhbmdsZSgwLjUsIDAsIDAsIDAsIDEsIDAsIDAsIDEpO1xuXHRcdGFzc2VydC5vayhyZXN1bHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgncmFuZG9tSW50JywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHQvKipcblx0ICogVGVzdCBoZWxwZXIgdGhhdCBhbGxvd3MgdG8gcnVuIGEgdGVzdCBvbiB0aGUgYHJhbmRvbUludCgpYFxuXHQgKiB1dGlsaXR5IHdpdGggc3BlY2lmaWVkIGBtYXhgIGFuZCBgbWluYCB2YWx1ZXMuXG5cdCAqL1xuXHRjb25zdCB0ZXN0UmFuZG9tSW50VXRpbCA9IChtYXg6IG51bWJlciwgbWluOiBudW1iZXIgfCB1bmRlZmluZWQsIHRlc3ROYW1lOiBzdHJpbmcpID0+IHtcblx0XHRzdWl0ZSh0ZXN0TmFtZSwgKCkgPT4ge1xuXHRcdFx0bGV0IGkgPSAwO1xuXHRcdFx0d2hpbGUgKCsraSA8IDUpIHtcblx0XHRcdFx0dGVzdChgc2hvdWxkIGdlbmVyYXRlIHJhbmRvbSBib29sZWFuIGF0dGVtcHQjJHtpfWAsIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHRsZXQgaXRlcmF0aW9ucyA9IDEwMDtcblx0XHRcdFx0XHR3aGlsZSAoaXRlcmF0aW9ucy0tID4gMCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgaW50ID0gcmFuZG9tSW50KG1heCwgbWluKTtcblxuXHRcdFx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdFx0XHRpbnQgPD0gbWF4LFxuXHRcdFx0XHRcdFx0XHRgRXhwZWN0ZWQgJHtpbnR9IHRvIGJlIGxlc3MgdGhhbiBvciBlcXVhbCB0byAke21heH0uYFxuXHRcdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRcdGFzc2VydChcblx0XHRcdFx0XHRcdFx0aW50ID49IChtaW4gPz8gMCksXG5cdFx0XHRcdFx0XHRcdGBFeHBlY3RlZCAke2ludH0gdG8gYmUgZ3JlYXRlciB0aGFuIG9yIGVxdWFsIHRvICR7bWluID8/IDB9LmAsXG5cdFx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCBpbmNsdWRlIG1pbiBhbmQgbWF4JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRsZXQgaXRlcmF0aW9ucyA9IDEyNTtcblx0XHRcdFx0Y29uc3QgcmVzdWx0cyA9IFtdO1xuXHRcdFx0XHR3aGlsZSAoaXRlcmF0aW9ucy0tID4gMCkge1xuXHRcdFx0XHRcdHJlc3VsdHMucHVzaChyYW5kb21JbnQobWF4LCBtaW4pKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFzc2VydChcblx0XHRcdFx0XHRyZXN1bHRzLmluY2x1ZGVzKG1heCksXG5cdFx0XHRcdFx0YEV4cGVjdGVkICR7cmVzdWx0c30gdG8gaW5jbHVkZSAke21heH0uYCxcblx0XHRcdFx0KTtcblx0XHRcdFx0YXNzZXJ0KFxuXHRcdFx0XHRcdHJlc3VsdHMuaW5jbHVkZXMobWluID8/IDApLFxuXHRcdFx0XHRcdGBFeHBlY3RlZCAke3Jlc3VsdHN9IHRvIGluY2x1ZGUgJHttaW4gPz8gMH0uYCxcblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9O1xuXG5cdHN1aXRlKCdwb3NpdGl2ZSBudW1iZXJzJywgKCkgPT4ge1xuXHRcdHRlc3RSYW5kb21JbnRVdGlsKDQsIDIsICdtYXg6IDQsIG1pbjogMicpO1xuXHRcdHRlc3RSYW5kb21JbnRVdGlsKDQsIDAsICdtYXg6IDQsIG1pbjogMCcpO1xuXHRcdHRlc3RSYW5kb21JbnRVdGlsKDQsIHVuZGVmaW5lZCwgJ21heDogNCwgbWluOiB1bmRlZmluZWQnKTtcblx0XHR0ZXN0UmFuZG9tSW50VXRpbCgxLCAwLCAnbWF4OiAwLCBtaW46IDAnKTtcblx0fSk7XG5cblx0c3VpdGUoJ25lZ2F0aXZlIG51bWJlcnMnLCAoKSA9PiB7XG5cdFx0dGVzdFJhbmRvbUludFV0aWwoLTIsIC01LCAnbWF4OiAtMiwgbWluOiAtNScpO1xuXHRcdHRlc3RSYW5kb21JbnRVdGlsKDAsIC01LCAnbWF4OiAwLCBtaW46IC01Jyk7XG5cdFx0dGVzdFJhbmRvbUludFV0aWwoMCwgLTEsICdtYXg6IDAsIG1pbjogLTEnKTtcblx0fSk7XG5cblx0c3VpdGUoJ3NwbGl0IG51bWJlcnMnLCAoKSA9PiB7XG5cdFx0dGVzdFJhbmRvbUludFV0aWwoMywgLTEsICdtYXg6IDMsIG1pbjogLTEnKTtcblx0XHR0ZXN0UmFuZG9tSW50VXRpbCgyLCAtMiwgJ21heDogMiwgbWluOiAtMicpO1xuXHRcdHRlc3RSYW5kb21JbnRVdGlsKDEsIC0zLCAnbWF4OiAyLCBtaW46IC0yJyk7XG5cdH0pO1xuXG5cdHN1aXRlKCdlcnJvcnMnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWluXCIgaXMgPT0gXCJtYXhcIiAjMScsICgpID0+IHtcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRyYW5kb21JbnQoMjAwLCAyMDApO1xuXHRcdFx0fSwgYFwibWF4XCIoMjAwKSBwYXJhbSBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIFwibWluXCIoMjAwKS5cImApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWluXCIgaXMgPT0gXCJtYXhcIiAjMicsICgpID0+IHtcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRyYW5kb21JbnQoMiwgMik7XG5cdFx0XHR9LCBgXCJtYXhcIigyKSBwYXJhbSBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIFwibWluXCIoMikuXCJgKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1pblwiIGlzID09IFwibWF4XCIgIzMnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0cmFuZG9tSW50KDApO1xuXHRcdFx0fSwgYFwibWF4XCIoMCkgcGFyYW0gc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiBcIm1pblwiKDApLlwiYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgdGhyb3cgaWYgXCJtaW5cIiBpcyA+IFwibWF4XCIgIzEnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0cmFuZG9tSW50KDIsIDMpO1xuXHRcdFx0fSwgYFwibWF4XCIoMikgcGFyYW0gc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiBcIm1pblwiKDMpLlwiYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgdGhyb3cgaWYgXCJtaW5cIiBpcyA+IFwibWF4XCIgIzInLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0cmFuZG9tSW50KDk5OSwgMjAwMCk7XG5cdFx0XHR9LCBgXCJtYXhcIig5OTkpIHBhcmFtIHNob3VsZCBiZSBncmVhdGVyIHRoYW4gXCJtaW5cIigyMDAwKS5cImApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWluXCIgaXMgPiBcIm1heFwiICMzJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdHJhbmRvbUludCgwLCAxKTtcblx0XHRcdH0sIGBcIm1heFwiKDApIHBhcmFtIHNob3VsZCBiZSBncmVhdGVyIHRoYW4gXCJtaW5cIigxKS5cImApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWluXCIgaXMgPiBcIm1heFwiICM0JywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdHJhbmRvbUludCgtNSwgMik7XG5cdFx0XHR9LCBgXCJtYXhcIigtNSkgcGFyYW0gc2hvdWxkIGJlIGdyZWF0ZXIgdGhhbiBcIm1pblwiKDIpLlwiYCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgdGhyb3cgaWYgXCJtaW5cIiBpcyA+IFwibWF4XCIgIzUnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0cmFuZG9tSW50KC00LCAwKTtcblx0XHRcdH0sIGBcIm1heFwiKC00KSBwYXJhbSBzaG91bGQgYmUgZ3JlYXRlciB0aGFuIFwibWluXCIoMCkuXCJgKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1pblwiIGlzID4gXCJtYXhcIiAjNicsICgpID0+IHtcblx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRyYW5kb21JbnQoLTQpO1xuXHRcdFx0fSwgYFwibWF4XCIoLTQpIHBhcmFtIHNob3VsZCBiZSBncmVhdGVyIHRoYW4gXCJtaW5cIigwKS5cImApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWF4XCIgaXMgYE5hTmAnLCAoKSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0cmFuZG9tSW50KE5hTik7XG5cdFx0XHR9LCBgXCJtYXhcIiBwYXJhbSBpcyBub3QgYSBudW1iZXIuXCJgKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1pblwiIGlzIGBOYU5gJywgKCkgPT4ge1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdHJhbmRvbUludCg0LCBOYU4pO1xuXHRcdFx0fSwgYFwibWluXCIgcGFyYW0gaXMgbm90IGEgbnVtYmVyLlwiYCk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnaW5maW5pdGUgYXJndW1lbnRzJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWF4XCIgaXMgaW5maW5pdGUgW0luZmluaXR5XScsICgpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiB7XG5cdFx0XHRcdFx0cmFuZG9tSW50KEluZmluaXR5KTtcblx0XHRcdFx0fSwgYFwibWF4XCIgcGFyYW0gaXMgbm90IGZpbml0ZS5cImApO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1heFwiIGlzIGluZmluaXRlIFstSW5maW5pdHldJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRyYW5kb21JbnQoLUluZmluaXR5KTtcblx0XHRcdFx0fSwgYFwibWF4XCIgcGFyYW0gaXMgbm90IGZpbml0ZS5cImApO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1heFwiIGlzIGluZmluaXRlIFsrSW5maW5pdHldJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRyYW5kb21JbnQoK0luZmluaXR5KTtcblx0XHRcdFx0fSwgYFwibWF4XCIgcGFyYW0gaXMgbm90IGZpbml0ZS5cImApO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1pblwiIGlzIGluZmluaXRlIFtJbmZpbml0eV0nLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdHJhbmRvbUludChJbmZpbml0eSwgSW5maW5pdHkpO1xuXHRcdFx0XHR9LCBgXCJtYXhcIiBwYXJhbSBpcyBub3QgZmluaXRlLlwiYCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dGVzdCgnc2hvdWxkIHRocm93IGlmIFwibWluXCIgaXMgaW5maW5pdGUgWy1JbmZpbml0eV0nLCAoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC50aHJvd3MoKCkgPT4ge1xuXHRcdFx0XHRcdHJhbmRvbUludChJbmZpbml0eSwgLUluZmluaXR5KTtcblx0XHRcdFx0fSwgYFwibWF4XCIgcGFyYW0gaXMgbm90IGZpbml0ZS5cImApO1xuXHRcdFx0fSk7XG5cblx0XHRcdHRlc3QoJ3Nob3VsZCB0aHJvdyBpZiBcIm1pblwiIGlzIGluZmluaXRlIFsrSW5maW5pdHldJywgKCkgPT4ge1xuXHRcdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IHtcblx0XHRcdFx0XHRyYW5kb21JbnQoSW5maW5pdHksICtJbmZpbml0eSk7XG5cdFx0XHRcdH0sIGBcIm1heFwiIHBhcmFtIGlzIG5vdCBmaW5pdGUuXCJgKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsdUJBQXVCLGlCQUFpQjtBQUVqRCxNQUFNLHlCQUF5QixNQUFNO0FBQ3BDLDBDQUF3QztBQUV4QyxPQUFLLDBEQUEwRCxNQUFNO0FBQ3BFLFVBQU0sU0FBUyxzQkFBc0IsTUFBTSxNQUFNLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ2pFLFdBQU8sR0FBRyxNQUFNO0FBQUEsRUFDakIsQ0FBQztBQUVELE9BQUssNERBQTRELE1BQU07QUFDdEUsVUFBTSxTQUFTLHNCQUFzQixHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDM0QsV0FBTyxHQUFHLENBQUMsTUFBTTtBQUFBLEVBQ2xCLENBQUM7QUFFRCxPQUFLLGtFQUFrRSxNQUFNO0FBQzVFLFVBQU0sU0FBUyxzQkFBc0IsS0FBSyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQzdELFdBQU8sR0FBRyxNQUFNO0FBQUEsRUFDakIsQ0FBQztBQUNGLENBQUM7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
