import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { areApiProposalsCompatible, isValidExtensionVersion, isValidVersion, isValidVersionStr, normalizeVersion, parseVersion } from "../../common/extensionValidator.js";
suite("Extension Version Validator", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const productVersion = "2021-05-11T21:54:30.577Z";
  test("isValidVersionStr", () => {
    assert.strictEqual(isValidVersionStr("0.10.0-dev"), true);
    assert.strictEqual(isValidVersionStr("0.10.0"), true);
    assert.strictEqual(isValidVersionStr("0.10.1"), true);
    assert.strictEqual(isValidVersionStr("0.10.100"), true);
    assert.strictEqual(isValidVersionStr("0.11.0"), true);
    assert.strictEqual(isValidVersionStr("x.x.x"), true);
    assert.strictEqual(isValidVersionStr("0.x.x"), true);
    assert.strictEqual(isValidVersionStr("0.10.0"), true);
    assert.strictEqual(isValidVersionStr("0.10.x"), true);
    assert.strictEqual(isValidVersionStr("^0.10.0"), true);
    assert.strictEqual(isValidVersionStr("*"), true);
    assert.strictEqual(isValidVersionStr("0.x.x.x"), false);
    assert.strictEqual(isValidVersionStr("0.10"), false);
    assert.strictEqual(isValidVersionStr("0.10."), false);
  });
  test("parseVersion", () => {
    function assertParseVersion(version, hasCaret, hasGreaterEquals, majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual, preRelease) {
      const actual = parseVersion(version);
      const expected = { hasCaret, hasGreaterEquals, majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual, preRelease };
      assert.deepStrictEqual(actual, expected, "parseVersion for " + version);
    }
    assertParseVersion("0.10.0-dev", false, false, 0, true, 10, true, 0, true, "-dev");
    assertParseVersion("0.10.0", false, false, 0, true, 10, true, 0, true, null);
    assertParseVersion("0.10.1", false, false, 0, true, 10, true, 1, true, null);
    assertParseVersion("0.10.100", false, false, 0, true, 10, true, 100, true, null);
    assertParseVersion("0.11.0", false, false, 0, true, 11, true, 0, true, null);
    assertParseVersion("x.x.x", false, false, 0, false, 0, false, 0, false, null);
    assertParseVersion("0.x.x", false, false, 0, true, 0, false, 0, false, null);
    assertParseVersion("0.10.x", false, false, 0, true, 10, true, 0, false, null);
    assertParseVersion("^0.10.0", true, false, 0, true, 10, true, 0, true, null);
    assertParseVersion("^0.10.2", true, false, 0, true, 10, true, 2, true, null);
    assertParseVersion("^1.10.2", true, false, 1, true, 10, true, 2, true, null);
    assertParseVersion("*", false, false, 0, false, 0, false, 0, false, null);
    assertParseVersion(">=0.0.1", false, true, 0, true, 0, true, 1, true, null);
    assertParseVersion(">=2.4.3", false, true, 2, true, 4, true, 3, true, null);
  });
  test("normalizeVersion", () => {
    function assertNormalizeVersion(version, majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual, isMinimum, notBefore = 0) {
      const actual = normalizeVersion(parseVersion(version));
      const expected = { majorBase, majorMustEqual, minorBase, minorMustEqual, patchBase, patchMustEqual, isMinimum, notBefore };
      assert.deepStrictEqual(actual, expected, "parseVersion for " + version);
    }
    assertNormalizeVersion("0.10.0-dev", 0, true, 10, true, 0, true, false, 0);
    assertNormalizeVersion("0.10.0-222222222", 0, true, 10, true, 0, true, false, 0);
    assertNormalizeVersion("0.10.0-20210511", 0, true, 10, true, 0, true, false, (/* @__PURE__ */ new Date("2021-05-11T00:00:00Z")).getTime());
    assertNormalizeVersion("0.10.0", 0, true, 10, true, 0, true, false);
    assertNormalizeVersion("0.10.1", 0, true, 10, true, 1, true, false);
    assertNormalizeVersion("0.10.100", 0, true, 10, true, 100, true, false);
    assertNormalizeVersion("0.11.0", 0, true, 11, true, 0, true, false);
    assertNormalizeVersion("x.x.x", 0, false, 0, false, 0, false, false);
    assertNormalizeVersion("0.x.x", 0, true, 0, false, 0, false, false);
    assertNormalizeVersion("0.10.x", 0, true, 10, true, 0, false, false);
    assertNormalizeVersion("^0.10.0", 0, true, 10, true, 0, false, false);
    assertNormalizeVersion("^0.10.2", 0, true, 10, true, 2, false, false);
    assertNormalizeVersion("^1.10.2", 1, true, 10, false, 2, false, false);
    assertNormalizeVersion("*", 0, false, 0, false, 0, false, false);
    assertNormalizeVersion(">=0.0.1", 0, true, 0, true, 1, true, true);
    assertNormalizeVersion(">=2.4.3", 2, true, 4, true, 3, true, true);
    assertNormalizeVersion(">=2.4.3", 2, true, 4, true, 3, true, true);
  });
  test("isValidVersion", () => {
    function testIsValidVersion(version, desiredVersion, expectedResult) {
      const actual = isValidVersion(version, productVersion, desiredVersion);
      assert.strictEqual(actual, expectedResult, "extension - vscode: " + version + ", desiredVersion: " + desiredVersion + " should be " + expectedResult);
    }
    testIsValidVersion("0.10.0-dev", "x.x.x", true);
    testIsValidVersion("0.10.0-dev", "0.x.x", true);
    testIsValidVersion("0.10.0-dev", "0.10.0", true);
    testIsValidVersion("0.10.0-dev", "0.10.2", false);
    testIsValidVersion("0.10.0-dev", "^0.10.2", false);
    testIsValidVersion("0.10.0-dev", "0.10.x", true);
    testIsValidVersion("0.10.0-dev", "^0.10.0", true);
    testIsValidVersion("0.10.0-dev", "*", true);
    testIsValidVersion("0.10.0-dev", ">=0.0.1", true);
    testIsValidVersion("0.10.0-dev", ">=0.0.10", true);
    testIsValidVersion("0.10.0-dev", ">=0.10.0", true);
    testIsValidVersion("0.10.0-dev", ">=0.10.1", false);
    testIsValidVersion("0.10.0-dev", ">=1.0.0", false);
    testIsValidVersion("0.10.0", "x.x.x", true);
    testIsValidVersion("0.10.0", "0.x.x", true);
    testIsValidVersion("0.10.0", "0.10.0", true);
    testIsValidVersion("0.10.0", "0.10.2", false);
    testIsValidVersion("0.10.0", "^0.10.2", false);
    testIsValidVersion("0.10.0", "0.10.x", true);
    testIsValidVersion("0.10.0", "^0.10.0", true);
    testIsValidVersion("0.10.0", "*", true);
    testIsValidVersion("0.10.1", "x.x.x", true);
    testIsValidVersion("0.10.1", "0.x.x", true);
    testIsValidVersion("0.10.1", "0.10.0", false);
    testIsValidVersion("0.10.1", "0.10.2", false);
    testIsValidVersion("0.10.1", "^0.10.2", false);
    testIsValidVersion("0.10.1", "0.10.x", true);
    testIsValidVersion("0.10.1", "^0.10.0", true);
    testIsValidVersion("0.10.1", "*", true);
    testIsValidVersion("0.10.100", "x.x.x", true);
    testIsValidVersion("0.10.100", "0.x.x", true);
    testIsValidVersion("0.10.100", "0.10.0", false);
    testIsValidVersion("0.10.100", "0.10.2", false);
    testIsValidVersion("0.10.100", "^0.10.2", true);
    testIsValidVersion("0.10.100", "0.10.x", true);
    testIsValidVersion("0.10.100", "^0.10.0", true);
    testIsValidVersion("0.10.100", "*", true);
    testIsValidVersion("0.11.0", "x.x.x", true);
    testIsValidVersion("0.11.0", "0.x.x", true);
    testIsValidVersion("0.11.0", "0.10.0", false);
    testIsValidVersion("0.11.0", "0.10.2", false);
    testIsValidVersion("0.11.0", "^0.10.2", false);
    testIsValidVersion("0.11.0", "0.10.x", false);
    testIsValidVersion("0.11.0", "^0.10.0", false);
    testIsValidVersion("0.11.0", "*", true);
    testIsValidVersion("1.0.0", "x.x.x", true);
    testIsValidVersion("1.0.0", "0.x.x", true);
    testIsValidVersion("1.0.0", "0.10.0", false);
    testIsValidVersion("1.0.0", "0.10.2", false);
    testIsValidVersion("1.0.0", "^0.10.2", true);
    testIsValidVersion("1.0.0", "0.10.x", true);
    testIsValidVersion("1.0.0", "^0.10.0", true);
    testIsValidVersion("1.0.0", "1.0.0", true);
    testIsValidVersion("1.0.0", "^1.0.0", true);
    testIsValidVersion("1.0.0", "^2.0.0", false);
    testIsValidVersion("1.0.0", "*", true);
    testIsValidVersion("1.0.0", ">=0.0.1", true);
    testIsValidVersion("1.0.0", ">=0.0.10", true);
    testIsValidVersion("1.0.0", ">=0.10.0", true);
    testIsValidVersion("1.0.0", ">=0.10.1", true);
    testIsValidVersion("1.0.0", ">=1.0.0", true);
    testIsValidVersion("1.0.0", ">=1.1.0", false);
    testIsValidVersion("1.0.0", ">=1.0.1", false);
    testIsValidVersion("1.0.0", ">=2.0.0", false);
    testIsValidVersion("1.0.100", "x.x.x", true);
    testIsValidVersion("1.0.100", "0.x.x", true);
    testIsValidVersion("1.0.100", "0.10.0", false);
    testIsValidVersion("1.0.100", "0.10.2", false);
    testIsValidVersion("1.0.100", "^0.10.2", true);
    testIsValidVersion("1.0.100", "0.10.x", true);
    testIsValidVersion("1.0.100", "^0.10.0", true);
    testIsValidVersion("1.0.100", "1.0.0", false);
    testIsValidVersion("1.0.100", "^1.0.0", true);
    testIsValidVersion("1.0.100", "^1.0.1", true);
    testIsValidVersion("1.0.100", "^2.0.0", false);
    testIsValidVersion("1.0.100", "*", true);
    testIsValidVersion("1.100.0", "x.x.x", true);
    testIsValidVersion("1.100.0", "0.x.x", true);
    testIsValidVersion("1.100.0", "0.10.0", false);
    testIsValidVersion("1.100.0", "0.10.2", false);
    testIsValidVersion("1.100.0", "^0.10.2", true);
    testIsValidVersion("1.100.0", "0.10.x", true);
    testIsValidVersion("1.100.0", "^0.10.0", true);
    testIsValidVersion("1.100.0", "1.0.0", false);
    testIsValidVersion("1.100.0", "^1.0.0", true);
    testIsValidVersion("1.100.0", "^1.1.0", true);
    testIsValidVersion("1.100.0", "^1.100.0", true);
    testIsValidVersion("1.100.0", "^2.0.0", false);
    testIsValidVersion("1.100.0", "*", true);
    testIsValidVersion("1.100.0", ">=1.99.0", true);
    testIsValidVersion("1.100.0", ">=1.100.0", true);
    testIsValidVersion("1.100.0", ">=1.101.0", false);
    testIsValidVersion("2.0.0", "x.x.x", true);
    testIsValidVersion("2.0.0", "0.x.x", false);
    testIsValidVersion("2.0.0", "0.10.0", false);
    testIsValidVersion("2.0.0", "0.10.2", false);
    testIsValidVersion("2.0.0", "^0.10.2", false);
    testIsValidVersion("2.0.0", "0.10.x", false);
    testIsValidVersion("2.0.0", "^0.10.0", false);
    testIsValidVersion("2.0.0", "1.0.0", false);
    testIsValidVersion("2.0.0", "^1.0.0", false);
    testIsValidVersion("2.0.0", "^1.1.0", false);
    testIsValidVersion("2.0.0", "^1.100.0", false);
    testIsValidVersion("2.0.0", "^2.0.0", true);
    testIsValidVersion("2.0.0", "*", true);
  });
  test("isValidExtensionVersion", () => {
    function testExtensionVersion(version, desiredVersion, isBuiltin, hasMain, expectedResult) {
      const manifest = {
        name: "test",
        publisher: "test",
        version: "0.0.0",
        engines: {
          vscode: desiredVersion
        },
        main: hasMain ? "something" : void 0
      };
      const reasons = [];
      const actual = isValidExtensionVersion(version, productVersion, manifest, isBuiltin, reasons);
      assert.strictEqual(actual, expectedResult, "version: " + version + ", desiredVersion: " + desiredVersion + ", desc: " + JSON.stringify(manifest) + ", reasons: " + JSON.stringify(reasons));
    }
    function testIsInvalidExtensionVersion(version, desiredVersion, isBuiltin, hasMain) {
      testExtensionVersion(version, desiredVersion, isBuiltin, hasMain, false);
    }
    function testIsValidExtensionVersion(version, desiredVersion, isBuiltin, hasMain) {
      testExtensionVersion(version, desiredVersion, isBuiltin, hasMain, true);
    }
    function testIsValidVersion(version, desiredVersion, expectedResult) {
      testExtensionVersion(version, desiredVersion, false, true, expectedResult);
    }
    testIsValidExtensionVersion("0.10.0-dev", "*", true, true);
    testIsValidExtensionVersion("0.10.0-dev", "x.x.x", true, true);
    testIsValidExtensionVersion("0.10.0-dev", "0.x.x", true, true);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", true, true);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", true, true);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", true, true);
    testIsValidExtensionVersion("0.10.0-dev", "*", true, false);
    testIsValidExtensionVersion("0.10.0-dev", "x.x.x", true, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.x.x", true, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", true, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", true, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", true, false);
    testIsInvalidExtensionVersion("0.10.0-dev", "*", false, true);
    testIsInvalidExtensionVersion("0.10.0-dev", "x.x.x", false, true);
    testIsInvalidExtensionVersion("0.10.0-dev", "0.x.x", false, true);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", false, true);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", false, true);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", false, true);
    testIsValidExtensionVersion("0.10.0-dev", "*", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "x.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", ">=0.9.1-pre.1", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "*", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "x.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "*", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "x.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.x.x", false, false);
    testIsValidExtensionVersion("0.10.0-dev", "0.10.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.x.x", false, false);
    testIsValidExtensionVersion("1.10.0-dev", "1.10.x", false, false);
    testIsValidVersion("0.10.0-dev", "x.x.x", false);
    testIsValidVersion("0.10.0-dev", "0.x.x", false);
    testIsValidVersion("0.10.0-dev", "0.10.0", true);
    testIsValidVersion("0.10.0-dev", "0.10.2", false);
    testIsValidVersion("0.10.0-dev", "^0.10.2", false);
    testIsValidVersion("0.10.0-dev", "0.10.x", true);
    testIsValidVersion("0.10.0-dev", "^0.10.0", true);
    testIsValidVersion("0.10.0-dev", "*", false);
    testIsValidVersion("0.10.0", "x.x.x", false);
    testIsValidVersion("0.10.0", "0.x.x", false);
    testIsValidVersion("0.10.0", "0.10.0", true);
    testIsValidVersion("0.10.0", "0.10.2", false);
    testIsValidVersion("0.10.0", "^0.10.2", false);
    testIsValidVersion("0.10.0", "0.10.x", true);
    testIsValidVersion("0.10.0", "^0.10.0", true);
    testIsValidVersion("0.10.0", "*", false);
    testIsValidVersion("0.10.1", "x.x.x", false);
    testIsValidVersion("0.10.1", "0.x.x", false);
    testIsValidVersion("0.10.1", "0.10.0", false);
    testIsValidVersion("0.10.1", "0.10.2", false);
    testIsValidVersion("0.10.1", "^0.10.2", false);
    testIsValidVersion("0.10.1", "0.10.x", true);
    testIsValidVersion("0.10.1", "^0.10.0", true);
    testIsValidVersion("0.10.1", "*", false);
    testIsValidVersion("0.10.100", "x.x.x", false);
    testIsValidVersion("0.10.100", "0.x.x", false);
    testIsValidVersion("0.10.100", "0.10.0", false);
    testIsValidVersion("0.10.100", "0.10.2", false);
    testIsValidVersion("0.10.100", "^0.10.2", true);
    testIsValidVersion("0.10.100", "0.10.x", true);
    testIsValidVersion("0.10.100", "^0.10.0", true);
    testIsValidVersion("0.10.100", "*", false);
    testIsValidVersion("0.11.0", "x.x.x", false);
    testIsValidVersion("0.11.0", "0.x.x", false);
    testIsValidVersion("0.11.0", "0.10.0", false);
    testIsValidVersion("0.11.0", "0.10.2", false);
    testIsValidVersion("0.11.0", "^0.10.2", false);
    testIsValidVersion("0.11.0", "0.10.x", false);
    testIsValidVersion("0.11.0", "^0.10.0", false);
    testIsValidVersion("0.11.0", "*", false);
    testIsValidVersion("1.0.0", "x.x.x", false);
    testIsValidVersion("1.0.0", "0.x.x", false);
    testIsValidVersion("1.0.0", "0.10.0", false);
    testIsValidVersion("1.0.0", "0.10.2", false);
    testIsValidVersion("1.0.0", "^0.10.2", true);
    testIsValidVersion("1.0.0", "0.10.x", true);
    testIsValidVersion("1.0.0", "^0.10.0", true);
    testIsValidVersion("1.0.0", "*", false);
    testIsValidVersion("1.10.0", "x.x.x", false);
    testIsValidVersion("1.10.0", "1.x.x", true);
    testIsValidVersion("1.10.0", "1.10.0", true);
    testIsValidVersion("1.10.0", "1.10.2", false);
    testIsValidVersion("1.10.0", "^1.10.2", false);
    testIsValidVersion("1.10.0", "1.10.x", true);
    testIsValidVersion("1.10.0", "^1.10.0", true);
    testIsValidVersion("1.10.0", "*", false);
    testIsValidVersion("1.0.0", "x.x.x", false);
    testIsValidVersion("1.0.0", "0.x.x", false);
    testIsValidVersion("1.0.0", "0.10.0", false);
    testIsValidVersion("1.0.0", "0.10.2", false);
    testIsValidVersion("1.0.0", "^0.10.2", true);
    testIsValidVersion("1.0.0", "0.10.x", true);
    testIsValidVersion("1.0.0", "^0.10.0", true);
    testIsValidVersion("1.0.0", "1.0.0", true);
    testIsValidVersion("1.0.0", "^1.0.0", true);
    testIsValidVersion("1.0.0", "^2.0.0", false);
    testIsValidVersion("1.0.0", "*", false);
    testIsValidVersion("1.0.100", "x.x.x", false);
    testIsValidVersion("1.0.100", "0.x.x", false);
    testIsValidVersion("1.0.100", "0.10.0", false);
    testIsValidVersion("1.0.100", "0.10.2", false);
    testIsValidVersion("1.0.100", "^0.10.2", true);
    testIsValidVersion("1.0.100", "0.10.x", true);
    testIsValidVersion("1.0.100", "^0.10.0", true);
    testIsValidVersion("1.0.100", "1.0.0", false);
    testIsValidVersion("1.0.100", "^1.0.0", true);
    testIsValidVersion("1.0.100", "^1.0.1", true);
    testIsValidVersion("1.0.100", "^2.0.0", false);
    testIsValidVersion("1.0.100", "*", false);
    testIsValidVersion("1.100.0", "x.x.x", false);
    testIsValidVersion("1.100.0", "0.x.x", false);
    testIsValidVersion("1.100.0", "0.10.0", false);
    testIsValidVersion("1.100.0", "0.10.2", false);
    testIsValidVersion("1.100.0", "^0.10.2", true);
    testIsValidVersion("1.100.0", "0.10.x", true);
    testIsValidVersion("1.100.0", "^0.10.0", true);
    testIsValidVersion("1.100.0", "1.0.0", false);
    testIsValidVersion("1.100.0", "^1.0.0", true);
    testIsValidVersion("1.100.0", "^1.1.0", true);
    testIsValidVersion("1.100.0", "^1.100.0", true);
    testIsValidVersion("1.100.0", "^2.0.0", false);
    testIsValidVersion("1.100.0", "*", false);
    testIsValidVersion("2.0.0", "x.x.x", false);
    testIsValidVersion("2.0.0", "0.x.x", false);
    testIsValidVersion("2.0.0", "0.10.0", false);
    testIsValidVersion("2.0.0", "0.10.2", false);
    testIsValidVersion("2.0.0", "^0.10.2", false);
    testIsValidVersion("2.0.0", "0.10.x", false);
    testIsValidVersion("2.0.0", "^0.10.0", false);
    testIsValidVersion("2.0.0", "1.0.0", false);
    testIsValidVersion("2.0.0", "^1.0.0", false);
    testIsValidVersion("2.0.0", "^1.1.0", false);
    testIsValidVersion("2.0.0", "^1.100.0", false);
    testIsValidVersion("2.0.0", "^2.0.0", true);
    testIsValidVersion("2.0.0", "*", false);
    testIsValidVersion("1.10.0", "^1.10.0-20210511", true);
    testIsValidVersion("1.10.0", "^1.10.0-20210510", true);
    testIsValidVersion("1.10.0", "^1.10.0-20210512", false);
    testIsValidVersion("1.10.1", "^1.10.0-20200101", true);
    testIsValidVersion("1.11.0", "^1.10.0-20200101", true);
  });
  test("isValidExtensionVersion checks browser only extensions", () => {
    const manifest = {
      name: "test",
      publisher: "test",
      version: "0.0.0",
      engines: {
        vscode: "^1.45.0"
      },
      browser: "something"
    };
    assert.strictEqual(isValidExtensionVersion("1.44.0", void 0, manifest, false, []), false);
  });
  test("areApiProposalsCompatible", () => {
    assert.strictEqual(areApiProposalsCompatible([]), true);
    assert.strictEqual(areApiProposalsCompatible([], ["hello"]), true);
    assert.strictEqual(areApiProposalsCompatible([], {}), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1"], {}), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1"], { "proposal1": { proposal: "" } }), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1"], { "proposal1": { proposal: "", version: 1 } }), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1@1"], { "proposal1": { proposal: "", version: 1 } }), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1"], { "proposal2": { proposal: "" } }), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1", "proposal2"], {}), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal1", "proposal2"], { "proposal1": { proposal: "" } }), true);
    assert.strictEqual(areApiProposalsCompatible(["proposal2@1"], { "proposal1": { proposal: "" } }), false);
    assert.strictEqual(areApiProposalsCompatible(["proposal1@1"], { "proposal1": { proposal: "", version: 2 } }), false);
    assert.strictEqual(areApiProposalsCompatible(["proposal1@1"], { "proposal1": { proposal: "" } }), false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9leHRlbnNpb25zL3Rlc3QvY29tbW9uL2V4dGVuc2lvblZhbGlkYXRvci50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZSwgSU5vcm1hbGl6ZWRWZXJzaW9uLCBJUGFyc2VkVmVyc2lvbiwgaXNWYWxpZEV4dGVuc2lvblZlcnNpb24sIGlzVmFsaWRWZXJzaW9uLCBpc1ZhbGlkVmVyc2lvblN0ciwgbm9ybWFsaXplVmVyc2lvbiwgcGFyc2VWZXJzaW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dGVuc2lvblZhbGlkYXRvci5qcyc7XG5cbnN1aXRlKCdFeHRlbnNpb24gVmVyc2lvbiBWYWxpZGF0b3InLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgcHJvZHVjdFZlcnNpb24gPSAnMjAyMS0wNS0xMVQyMTo1NDozMC41NzdaJztcblxuXHR0ZXN0KCdpc1ZhbGlkVmVyc2lvblN0cicsICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJzAuMTAuMC1kZXYnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcwLjEwLjAnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcwLjEwLjEnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcwLjEwLjEwMCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJzAuMTEuMCcpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1ZhbGlkVmVyc2lvblN0cigneC54LngnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcwLngueCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJzAuMTAuMCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJzAuMTAueCcpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJ14wLjEwLjAnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcqJyksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzVmFsaWRWZXJzaW9uU3RyKCcwLngueC54JyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNWYWxpZFZlcnNpb25TdHIoJzAuMTAnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1ZhbGlkVmVyc2lvblN0cignMC4xMC4nKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJzZVZlcnNpb24nLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gYXNzZXJ0UGFyc2VWZXJzaW9uKHZlcnNpb246IHN0cmluZywgaGFzQ2FyZXQ6IGJvb2xlYW4sIGhhc0dyZWF0ZXJFcXVhbHM6IGJvb2xlYW4sIG1ham9yQmFzZTogbnVtYmVyLCBtYWpvck11c3RFcXVhbDogYm9vbGVhbiwgbWlub3JCYXNlOiBudW1iZXIsIG1pbm9yTXVzdEVxdWFsOiBib29sZWFuLCBwYXRjaEJhc2U6IG51bWJlciwgcGF0Y2hNdXN0RXF1YWw6IGJvb2xlYW4sIHByZVJlbGVhc2U6IHN0cmluZyB8IG51bGwpOiB2b2lkIHtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IHBhcnNlVmVyc2lvbih2ZXJzaW9uKTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkOiBJUGFyc2VkVmVyc2lvbiA9IHsgaGFzQ2FyZXQsIGhhc0dyZWF0ZXJFcXVhbHMsIG1ham9yQmFzZSwgbWFqb3JNdXN0RXF1YWwsIG1pbm9yQmFzZSwgbWlub3JNdXN0RXF1YWwsIHBhdGNoQmFzZSwgcGF0Y2hNdXN0RXF1YWwsIHByZVJlbGVhc2UgfTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCAncGFyc2VWZXJzaW9uIGZvciAnICsgdmVyc2lvbik7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCcwLjEwLjAtZGV2JywgZmFsc2UsIGZhbHNlLCAwLCB0cnVlLCAxMCwgdHJ1ZSwgMCwgdHJ1ZSwgJy1kZXYnKTtcblx0XHRhc3NlcnRQYXJzZVZlcnNpb24oJzAuMTAuMCcsIGZhbHNlLCBmYWxzZSwgMCwgdHJ1ZSwgMTAsIHRydWUsIDAsIHRydWUsIG51bGwpO1xuXHRcdGFzc2VydFBhcnNlVmVyc2lvbignMC4xMC4xJywgZmFsc2UsIGZhbHNlLCAwLCB0cnVlLCAxMCwgdHJ1ZSwgMSwgdHJ1ZSwgbnVsbCk7XG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCcwLjEwLjEwMCcsIGZhbHNlLCBmYWxzZSwgMCwgdHJ1ZSwgMTAsIHRydWUsIDEwMCwgdHJ1ZSwgbnVsbCk7XG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCcwLjExLjAnLCBmYWxzZSwgZmFsc2UsIDAsIHRydWUsIDExLCB0cnVlLCAwLCB0cnVlLCBudWxsKTtcblxuXHRcdGFzc2VydFBhcnNlVmVyc2lvbigneC54LngnLCBmYWxzZSwgZmFsc2UsIDAsIGZhbHNlLCAwLCBmYWxzZSwgMCwgZmFsc2UsIG51bGwpO1xuXHRcdGFzc2VydFBhcnNlVmVyc2lvbignMC54LngnLCBmYWxzZSwgZmFsc2UsIDAsIHRydWUsIDAsIGZhbHNlLCAwLCBmYWxzZSwgbnVsbCk7XG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCcwLjEwLngnLCBmYWxzZSwgZmFsc2UsIDAsIHRydWUsIDEwLCB0cnVlLCAwLCBmYWxzZSwgbnVsbCk7XG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCdeMC4xMC4wJywgdHJ1ZSwgZmFsc2UsIDAsIHRydWUsIDEwLCB0cnVlLCAwLCB0cnVlLCBudWxsKTtcblx0XHRhc3NlcnRQYXJzZVZlcnNpb24oJ14wLjEwLjInLCB0cnVlLCBmYWxzZSwgMCwgdHJ1ZSwgMTAsIHRydWUsIDIsIHRydWUsIG51bGwpO1xuXHRcdGFzc2VydFBhcnNlVmVyc2lvbignXjEuMTAuMicsIHRydWUsIGZhbHNlLCAxLCB0cnVlLCAxMCwgdHJ1ZSwgMiwgdHJ1ZSwgbnVsbCk7XG5cdFx0YXNzZXJ0UGFyc2VWZXJzaW9uKCcqJywgZmFsc2UsIGZhbHNlLCAwLCBmYWxzZSwgMCwgZmFsc2UsIDAsIGZhbHNlLCBudWxsKTtcblxuXHRcdGFzc2VydFBhcnNlVmVyc2lvbignPj0wLjAuMScsIGZhbHNlLCB0cnVlLCAwLCB0cnVlLCAwLCB0cnVlLCAxLCB0cnVlLCBudWxsKTtcblx0XHRhc3NlcnRQYXJzZVZlcnNpb24oJz49Mi40LjMnLCBmYWxzZSwgdHJ1ZSwgMiwgdHJ1ZSwgNCwgdHJ1ZSwgMywgdHJ1ZSwgbnVsbCk7XG5cdH0pO1xuXG5cdHRlc3QoJ25vcm1hbGl6ZVZlcnNpb24nLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gYXNzZXJ0Tm9ybWFsaXplVmVyc2lvbih2ZXJzaW9uOiBzdHJpbmcsIG1ham9yQmFzZTogbnVtYmVyLCBtYWpvck11c3RFcXVhbDogYm9vbGVhbiwgbWlub3JCYXNlOiBudW1iZXIsIG1pbm9yTXVzdEVxdWFsOiBib29sZWFuLCBwYXRjaEJhc2U6IG51bWJlciwgcGF0Y2hNdXN0RXF1YWw6IGJvb2xlYW4sIGlzTWluaW11bTogYm9vbGVhbiwgbm90QmVmb3JlID0gMCk6IHZvaWQge1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gbm9ybWFsaXplVmVyc2lvbihwYXJzZVZlcnNpb24odmVyc2lvbikpO1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWQ6IElOb3JtYWxpemVkVmVyc2lvbiA9IHsgbWFqb3JCYXNlLCBtYWpvck11c3RFcXVhbCwgbWlub3JCYXNlLCBtaW5vck11c3RFcXVhbCwgcGF0Y2hCYXNlLCBwYXRjaE11c3RFcXVhbCwgaXNNaW5pbXVtLCBub3RCZWZvcmUgfTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBleHBlY3RlZCwgJ3BhcnNlVmVyc2lvbiBmb3IgJyArIHZlcnNpb24pO1xuXHRcdH1cblxuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJzAuMTAuMC1kZXYnLCAwLCB0cnVlLCAxMCwgdHJ1ZSwgMCwgdHJ1ZSwgZmFsc2UsIDApO1xuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJzAuMTAuMC0yMjIyMjIyMjInLCAwLCB0cnVlLCAxMCwgdHJ1ZSwgMCwgdHJ1ZSwgZmFsc2UsIDApO1xuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJzAuMTAuMC0yMDIxMDUxMScsIDAsIHRydWUsIDEwLCB0cnVlLCAwLCB0cnVlLCBmYWxzZSwgbmV3IERhdGUoJzIwMjEtMDUtMTFUMDA6MDA6MDBaJykuZ2V0VGltZSgpKTtcblxuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJzAuMTAuMCcsIDAsIHRydWUsIDEwLCB0cnVlLCAwLCB0cnVlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbignMC4xMC4xJywgMCwgdHJ1ZSwgMTAsIHRydWUsIDEsIHRydWUsIGZhbHNlKTtcblx0XHRhc3NlcnROb3JtYWxpemVWZXJzaW9uKCcwLjEwLjEwMCcsIDAsIHRydWUsIDEwLCB0cnVlLCAxMDAsIHRydWUsIGZhbHNlKTtcblx0XHRhc3NlcnROb3JtYWxpemVWZXJzaW9uKCcwLjExLjAnLCAwLCB0cnVlLCAxMSwgdHJ1ZSwgMCwgdHJ1ZSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbigneC54LngnLCAwLCBmYWxzZSwgMCwgZmFsc2UsIDAsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbignMC54LngnLCAwLCB0cnVlLCAwLCBmYWxzZSwgMCwgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnROb3JtYWxpemVWZXJzaW9uKCcwLjEwLngnLCAwLCB0cnVlLCAxMCwgdHJ1ZSwgMCwgZmFsc2UsIGZhbHNlKTtcblx0XHRhc3NlcnROb3JtYWxpemVWZXJzaW9uKCdeMC4xMC4wJywgMCwgdHJ1ZSwgMTAsIHRydWUsIDAsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbignXjAuMTAuMicsIDAsIHRydWUsIDEwLCB0cnVlLCAyLCBmYWxzZSwgZmFsc2UpO1xuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJ14xLjEwLjInLCAxLCB0cnVlLCAxMCwgZmFsc2UsIDIsIGZhbHNlLCBmYWxzZSk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbignKicsIDAsIGZhbHNlLCAwLCBmYWxzZSwgMCwgZmFsc2UsIGZhbHNlKTtcblxuXHRcdGFzc2VydE5vcm1hbGl6ZVZlcnNpb24oJz49MC4wLjEnLCAwLCB0cnVlLCAwLCB0cnVlLCAxLCB0cnVlLCB0cnVlKTtcblx0XHRhc3NlcnROb3JtYWxpemVWZXJzaW9uKCc+PTIuNC4zJywgMiwgdHJ1ZSwgNCwgdHJ1ZSwgMywgdHJ1ZSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Tm9ybWFsaXplVmVyc2lvbignPj0yLjQuMycsIDIsIHRydWUsIDQsIHRydWUsIDMsIHRydWUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc1ZhbGlkVmVyc2lvbicsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0SXNWYWxpZFZlcnNpb24odmVyc2lvbjogc3RyaW5nLCBkZXNpcmVkVmVyc2lvbjogc3RyaW5nLCBleHBlY3RlZFJlc3VsdDogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gaXNWYWxpZFZlcnNpb24odmVyc2lvbiwgcHJvZHVjdFZlcnNpb24sIGRlc2lyZWRWZXJzaW9uKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkUmVzdWx0LCAnZXh0ZW5zaW9uIC0gdnNjb2RlOiAnICsgdmVyc2lvbiArICcsIGRlc2lyZWRWZXJzaW9uOiAnICsgZGVzaXJlZFZlcnNpb24gKyAnIHNob3VsZCBiZSAnICsgZXhwZWN0ZWRSZXN1bHQpO1xuXHRcdH1cblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICd4LngueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICcwLngueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICcwLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICdeMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICcqJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJz49MC4wLjEnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnPj0wLjAuMTAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnPj0wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnPj0wLjEwLjEnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJz49MS4wLjAnLCBmYWxzZSk7XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICd4LngueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wJywgJzAueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wJywgJ14wLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wJywgJyonLCB0cnVlKTtcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJ3gueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnMC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMScsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJ14wLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJyonLCB0cnVlKTtcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xMDAnLCAneC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJzAueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEwMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEwMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEwMCcsICdeMC4xMC4yJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEwMCcsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJ14wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJyonLCB0cnVlKTtcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJ3gueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnMC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTEuMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJ14wLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnMC4xMC54JywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJ14wLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnKicsIHRydWUpO1xuXG5cdFx0Ly8gQW55dGhpbmcgPCAxLjAuMCBpcyBjb21wYXRpYmxlXG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJ3gueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcwLngueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnXjAuMTAuMicsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICdeMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcxLjAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnXjEuMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICdeMi4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcqJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICc+PTAuMC4xJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICc+PTAuMC4xMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnPj0wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJz49MC4xMC4xJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICc+PTEuMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICc+PTEuMS4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnPj0xLjAuMScsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJz49Mi4wLjAnLCBmYWxzZSk7XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAneC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnMC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnMC4xMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJ14wLjEwLjInLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJ14wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnMS4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJ14xLjAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICdeMS4wLjEnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnXjIuMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICcqJywgdHJ1ZSk7XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAneC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnMC54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnMC4xMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJ14wLjEwLjInLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJ14wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnMS4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJ14xLjAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICdeMS4xLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnXjEuMTAwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnXjIuMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICcqJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJz49MS45OS4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJz49MS4xMDAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICc+PTEuMTAxLjAnLCBmYWxzZSk7XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJ3gueC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICcwLngueCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJzAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJzAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJ14wLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICcwLjEwLngnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMC4xMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnMS4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMS4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMS4xLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMS4xMDAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJ14yLjAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnKicsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbicsICgpID0+IHtcblxuXHRcdGZ1bmN0aW9uIHRlc3RFeHRlbnNpb25WZXJzaW9uKHZlcnNpb246IHN0cmluZywgZGVzaXJlZFZlcnNpb246IHN0cmluZywgaXNCdWlsdGluOiBib29sZWFuLCBoYXNNYWluOiBib29sZWFuLCBleHBlY3RlZFJlc3VsdDogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0Y29uc3QgbWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCA9IHtcblx0XHRcdFx0bmFtZTogJ3Rlc3QnLFxuXHRcdFx0XHRwdWJsaXNoZXI6ICd0ZXN0Jyxcblx0XHRcdFx0dmVyc2lvbjogJzAuMC4wJyxcblx0XHRcdFx0ZW5naW5lczoge1xuXHRcdFx0XHRcdHZzY29kZTogZGVzaXJlZFZlcnNpb25cblx0XHRcdFx0fSxcblx0XHRcdFx0bWFpbjogaGFzTWFpbiA/ICdzb21ldGhpbmcnIDogdW5kZWZpbmVkXG5cdFx0XHR9O1xuXHRcdFx0Y29uc3QgcmVhc29uczogc3RyaW5nW10gPSBbXTtcblx0XHRcdGNvbnN0IGFjdHVhbCA9IGlzVmFsaWRFeHRlbnNpb25WZXJzaW9uKHZlcnNpb24sIHByb2R1Y3RWZXJzaW9uLCBtYW5pZmVzdCwgaXNCdWlsdGluLCByZWFzb25zKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWRSZXN1bHQsICd2ZXJzaW9uOiAnICsgdmVyc2lvbiArICcsIGRlc2lyZWRWZXJzaW9uOiAnICsgZGVzaXJlZFZlcnNpb24gKyAnLCBkZXNjOiAnICsgSlNPTi5zdHJpbmdpZnkobWFuaWZlc3QpICsgJywgcmVhc29uczogJyArIEpTT04uc3RyaW5naWZ5KHJlYXNvbnMpKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0ZXN0SXNJbnZhbGlkRXh0ZW5zaW9uVmVyc2lvbih2ZXJzaW9uOiBzdHJpbmcsIGRlc2lyZWRWZXJzaW9uOiBzdHJpbmcsIGlzQnVpbHRpbjogYm9vbGVhbiwgaGFzTWFpbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0dGVzdEV4dGVuc2lvblZlcnNpb24odmVyc2lvbiwgZGVzaXJlZFZlcnNpb24sIGlzQnVpbHRpbiwgaGFzTWFpbiwgZmFsc2UpO1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbih2ZXJzaW9uOiBzdHJpbmcsIGRlc2lyZWRWZXJzaW9uOiBzdHJpbmcsIGlzQnVpbHRpbjogYm9vbGVhbiwgaGFzTWFpbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdFx0dGVzdEV4dGVuc2lvblZlcnNpb24odmVyc2lvbiwgZGVzaXJlZFZlcnNpb24sIGlzQnVpbHRpbiwgaGFzTWFpbiwgdHJ1ZSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdGVzdElzVmFsaWRWZXJzaW9uKHZlcnNpb246IHN0cmluZywgZGVzaXJlZFZlcnNpb246IHN0cmluZywgZXhwZWN0ZWRSZXN1bHQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRcdHRlc3RFeHRlbnNpb25WZXJzaW9uKHZlcnNpb24sIGRlc2lyZWRWZXJzaW9uLCBmYWxzZSwgdHJ1ZSwgZXhwZWN0ZWRSZXN1bHQpO1xuXHRcdH1cblxuXHRcdC8vIGJ1aWx0aW4gYXJlIGFsbG93ZWQgdG8gdXNlICogb3IgeC54Lnhcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnKicsIHRydWUsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICd4LngueCcsIHRydWUsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcwLngueCcsIHRydWUsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcwLjEwLngnLCB0cnVlLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS54LngnLCB0cnVlLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS4xMC54JywgdHJ1ZSwgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJyonLCB0cnVlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJ3gueC54JywgdHJ1ZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcwLngueCcsIHRydWUsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC4xMC54JywgdHJ1ZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMS4xMC4wLWRldicsICcxLngueCcsIHRydWUsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS4xMC54JywgdHJ1ZSwgZmFsc2UpO1xuXG5cdFx0Ly8gbm9ybWFsIGV4dGVuc2lvbnMgYXJlIGFsbG93ZWQgdG8gdXNlICogb3IgeC54Lnggb25seSBpZiB0aGV5IGhhdmUgbm8gbWFpblxuXHRcdHRlc3RJc0ludmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJyonLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0dGVzdElzSW52YWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAneC54LngnLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0dGVzdElzSW52YWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC54LngnLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJzAuMTAueCcsIGZhbHNlLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS54LngnLCBmYWxzZSwgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcxLjEwLjAtZGV2JywgJzEuMTAueCcsIGZhbHNlLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnKicsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJ3gueC54JywgZmFsc2UsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC54LngnLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcwLjEwLngnLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMS4xMC4wLWRldicsICcxLngueCcsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcxLjEwLjAtZGV2JywgJzEuMTAueCcsIGZhbHNlLCBmYWxzZSk7XG5cblx0XHQvLyBleHRlbnNpb25zIHdpdGhvdXQgXCJtYWluXCIgZ2V0IG5vIHZlcnNpb24gY2hlY2tcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnPj0wLjkuMS1wcmUuMScsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJyonLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICd4LngueCcsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJzAueC54JywgZmFsc2UsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC4xMC54JywgZmFsc2UsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS54LngnLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMS4xMC4wLWRldicsICcxLjEwLngnLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcqJywgZmFsc2UsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzAuMTAuMC1kZXYnLCAneC54LngnLCBmYWxzZSwgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMC4xMC4wLWRldicsICcwLngueCcsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcwLjEwLjAtZGV2JywgJzAuMTAueCcsIGZhbHNlLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRFeHRlbnNpb25WZXJzaW9uKCcxLjEwLjAtZGV2JywgJzEueC54JywgZmFsc2UsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZEV4dGVuc2lvblZlcnNpb24oJzEuMTAuMC1kZXYnLCAnMS4xMC54JywgZmFsc2UsIGZhbHNlKTtcblxuXHRcdC8vIG5vcm1hbCBleHRlbnNpb25zIHdpdGggY29kZVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICd4LngueCcsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMC1kZXYnLCAnMC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJzAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJ14wLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJzAuMTAueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4wLWRldicsICdeMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAtZGV2JywgJyonLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICd4LngueCcsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICcwLngueCcsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICcwLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnXjAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMCcsICdeMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjAnLCAnKicsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJ3gueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJzAueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xJywgJzAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMScsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnXjAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMScsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMScsICdeMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEnLCAnKicsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xMDAnLCAneC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjEwLjEwMCcsICcwLngueCcsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJzAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJzAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJ14wLjEwLjInLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTAuMTAwJywgJzAuMTAueCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xMDAnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMC4xMDAnLCAnKicsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJ3gueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJzAueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMC4xMS4wJywgJzAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTEuMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnXjAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTEuMCcsICcwLjEwLngnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcwLjExLjAnLCAnXjAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzAuMTEuMCcsICcqJywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICd4LngueCcsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJzAueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnXjAuMTAuMicsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC4xMC54JywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICdeMC4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcqJywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwLjAnLCAneC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwLjAnLCAnMS54LngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICcxLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICcxLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwLjAnLCAnXjEuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICcxLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICdeMS4xMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwLjAnLCAnKicsIGZhbHNlKTsgLy8gZmFpbHMgZHVlIHRvIGxhY2sgb2Ygc3BlY2lmaWNpdHlcblxuXG5cdFx0Ly8gQW55dGhpbmcgPCAxLjAuMCBpcyBjb21wYXRpYmxlXG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJ3gueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjAnLCAnMC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICdeMC4xMC4yJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJ14wLjEwLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJzEuMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMCcsICdeMS4wLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJ14yLjAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4wJywgJyonLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAneC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJzAueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJzAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnXjAuMTAuMicsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICcxLjAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMC4xMDAnLCAnXjEuMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJ14xLjAuMScsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4wLjEwMCcsICdeMi4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjAuMTAwJywgJyonLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAneC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJzAueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJzAuMTAuMicsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnXjAuMTAuMicsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICcwLjEwLngnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnXjAuMTAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICcxLjAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAwLjAnLCAnXjEuMC4wJywgdHJ1ZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJ14xLjEuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICdeMS4xMDAuMCcsIHRydWUpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMDAuMCcsICdeMi4wLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjEwMC4wJywgJyonLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJ3gueC54JywgZmFsc2UpOyAvLyBmYWlscyBkdWUgdG8gbGFjayBvZiBzcGVjaWZpY2l0eVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnMC54LngnLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICcwLjEwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICcwLjEwLjInLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMC4xMC4yJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnMC4xMC54JywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnXjAuMTAuMCcsIGZhbHNlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJzEuMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnXjEuMC4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnXjEuMS4wJywgZmFsc2UpO1xuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMi4wLjAnLCAnXjEuMTAwLjAnLCBmYWxzZSk7XG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcyLjAuMCcsICdeMi4wLjAnLCB0cnVlKTtcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzIuMC4wJywgJyonLCBmYWxzZSk7IC8vIGZhaWxzIGR1ZSB0byBsYWNrIG9mIHNwZWNpZmljaXR5XG5cblx0XHQvLyBkYXRlIHRhZ3Ncblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICdeMS4xMC4wLTIwMjEwNTExJywgdHJ1ZSk7IC8vIGN1cnJlbnQgZGF0ZVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMC4wJywgJ14xLjEwLjAtMjAyMTA1MTAnLCB0cnVlKTsgLy8gYmVmb3JlIGRhdGVcblx0XHR0ZXN0SXNWYWxpZFZlcnNpb24oJzEuMTAuMCcsICdeMS4xMC4wLTIwMjEwNTEyJywgZmFsc2UpOyAvLyBmdXR1cmUgZGF0ZVxuXHRcdHRlc3RJc1ZhbGlkVmVyc2lvbignMS4xMC4xJywgJ14xLjEwLjAtMjAyMDAxMDEnLCB0cnVlKTsgLy8gYmVmb3JlIGRhdGUsIGJ1dCBhaGVhZCB2ZXJzaW9uXG5cdFx0dGVzdElzVmFsaWRWZXJzaW9uKCcxLjExLjAnLCAnXjEuMTAuMC0yMDIwMDEwMScsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbiBjaGVja3MgYnJvd3NlciBvbmx5IGV4dGVuc2lvbnMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbWFuaWZlc3QgPSB7XG5cdFx0XHRuYW1lOiAndGVzdCcsXG5cdFx0XHRwdWJsaXNoZXI6ICd0ZXN0Jyxcblx0XHRcdHZlcnNpb246ICcwLjAuMCcsXG5cdFx0XHRlbmdpbmVzOiB7XG5cdFx0XHRcdHZzY29kZTogJ14xLjQ1LjAnXG5cdFx0XHR9LFxuXHRcdFx0YnJvd3NlcjogJ3NvbWV0aGluZydcblx0XHR9O1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc1ZhbGlkRXh0ZW5zaW9uVmVyc2lvbignMS40NC4wJywgdW5kZWZpbmVkLCBtYW5pZmVzdCwgZmFsc2UsIFtdKSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdhcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlKFtdKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoW10sIFsnaGVsbG8nXSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlKFtdLCB7fSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcmVBcGlQcm9wb3NhbHNDb21wYXRpYmxlKFsncHJvcG9zYWwxJ10sIHt9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoWydwcm9wb3NhbDEnXSwgeyAncHJvcG9zYWwxJzogeyBwcm9wb3NhbDogJycgfSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoWydwcm9wb3NhbDEnXSwgeyAncHJvcG9zYWwxJzogeyBwcm9wb3NhbDogJycsIHZlcnNpb246IDEgfSB9KSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFyZUFwaVByb3Bvc2Fsc0NvbXBhdGlibGUoWydwcm9wb3NhbDFAMSddLCB7ICdwcm9wb3NhbDEnOiB7IHByb3Bvc2FsOiAnJywgdmVyc2lvbjogMSB9IH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMSddLCB7ICdwcm9wb3NhbDInOiB7IHByb3Bvc2FsOiAnJyB9IH0pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMScsICdwcm9wb3NhbDInXSwge30pLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMScsICdwcm9wb3NhbDInXSwgeyAncHJvcG9zYWwxJzogeyBwcm9wb3NhbDogJycgfSB9KSwgdHJ1ZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMkAxJ10sIHsgJ3Byb3Bvc2FsMSc6IHsgcHJvcG9zYWw6ICcnIH0gfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMUAxJ10sIHsgJ3Byb3Bvc2FsMSc6IHsgcHJvcG9zYWw6ICcnLCB2ZXJzaW9uOiAyIH0gfSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJlQXBpUHJvcG9zYWxzQ29tcGF0aWJsZShbJ3Byb3Bvc2FsMUAxJ10sIHsgJ3Byb3Bvc2FsMSc6IHsgcHJvcG9zYWw6ICcnIH0gfSksIGZhbHNlKTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBRXhELFNBQVMsMkJBQStELHlCQUF5QixnQkFBZ0IsbUJBQW1CLGtCQUFrQixvQkFBb0I7QUFFMUssTUFBTSwrQkFBK0IsTUFBTTtBQUUxQywwQ0FBd0M7QUFFeEMsUUFBTSxpQkFBaUI7QUFFdkIsT0FBSyxxQkFBcUIsTUFBTTtBQUMvQixXQUFPLFlBQVksa0JBQWtCLFlBQVksR0FBRyxJQUFJO0FBQ3hELFdBQU8sWUFBWSxrQkFBa0IsUUFBUSxHQUFHLElBQUk7QUFDcEQsV0FBTyxZQUFZLGtCQUFrQixRQUFRLEdBQUcsSUFBSTtBQUNwRCxXQUFPLFlBQVksa0JBQWtCLFVBQVUsR0FBRyxJQUFJO0FBQ3RELFdBQU8sWUFBWSxrQkFBa0IsUUFBUSxHQUFHLElBQUk7QUFFcEQsV0FBTyxZQUFZLGtCQUFrQixPQUFPLEdBQUcsSUFBSTtBQUNuRCxXQUFPLFlBQVksa0JBQWtCLE9BQU8sR0FBRyxJQUFJO0FBQ25ELFdBQU8sWUFBWSxrQkFBa0IsUUFBUSxHQUFHLElBQUk7QUFDcEQsV0FBTyxZQUFZLGtCQUFrQixRQUFRLEdBQUcsSUFBSTtBQUNwRCxXQUFPLFlBQVksa0JBQWtCLFNBQVMsR0FBRyxJQUFJO0FBQ3JELFdBQU8sWUFBWSxrQkFBa0IsR0FBRyxHQUFHLElBQUk7QUFFL0MsV0FBTyxZQUFZLGtCQUFrQixTQUFTLEdBQUcsS0FBSztBQUN0RCxXQUFPLFlBQVksa0JBQWtCLE1BQU0sR0FBRyxLQUFLO0FBQ25ELFdBQU8sWUFBWSxrQkFBa0IsT0FBTyxHQUFHLEtBQUs7QUFBQSxFQUNyRCxDQUFDO0FBRUQsT0FBSyxnQkFBZ0IsTUFBTTtBQUMxQixhQUFTLG1CQUFtQixTQUFpQixVQUFtQixrQkFBMkIsV0FBbUIsZ0JBQXlCLFdBQW1CLGdCQUF5QixXQUFtQixnQkFBeUIsWUFBaUM7QUFDL1AsWUFBTSxTQUFTLGFBQWEsT0FBTztBQUNuQyxZQUFNLFdBQTJCLEVBQUUsVUFBVSxrQkFBa0IsV0FBVyxnQkFBZ0IsV0FBVyxnQkFBZ0IsV0FBVyxnQkFBZ0IsV0FBVztBQUUzSixhQUFPLGdCQUFnQixRQUFRLFVBQVUsc0JBQXNCLE9BQU87QUFBQSxJQUN2RTtBQUVBLHVCQUFtQixjQUFjLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxNQUFNO0FBQ2pGLHVCQUFtQixVQUFVLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzNFLHVCQUFtQixVQUFVLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzNFLHVCQUFtQixZQUFZLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEtBQUssTUFBTSxJQUFJO0FBQy9FLHVCQUFtQixVQUFVLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBRTNFLHVCQUFtQixTQUFTLE9BQU8sT0FBTyxHQUFHLE9BQU8sR0FBRyxPQUFPLEdBQUcsT0FBTyxJQUFJO0FBQzVFLHVCQUFtQixTQUFTLE9BQU8sT0FBTyxHQUFHLE1BQU0sR0FBRyxPQUFPLEdBQUcsT0FBTyxJQUFJO0FBQzNFLHVCQUFtQixVQUFVLE9BQU8sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsT0FBTyxJQUFJO0FBQzVFLHVCQUFtQixXQUFXLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzNFLHVCQUFtQixXQUFXLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzNFLHVCQUFtQixXQUFXLE1BQU0sT0FBTyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzNFLHVCQUFtQixLQUFLLE9BQU8sT0FBTyxHQUFHLE9BQU8sR0FBRyxPQUFPLEdBQUcsT0FBTyxJQUFJO0FBRXhFLHVCQUFtQixXQUFXLE9BQU8sTUFBTSxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQzFFLHVCQUFtQixXQUFXLE9BQU8sTUFBTSxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQUEsRUFDM0UsQ0FBQztBQUVELE9BQUssb0JBQW9CLE1BQU07QUFDOUIsYUFBUyx1QkFBdUIsU0FBaUIsV0FBbUIsZ0JBQXlCLFdBQW1CLGdCQUF5QixXQUFtQixnQkFBeUIsV0FBb0IsWUFBWSxHQUFTO0FBQzdOLFlBQU0sU0FBUyxpQkFBaUIsYUFBYSxPQUFPLENBQUM7QUFDckQsWUFBTSxXQUErQixFQUFFLFdBQVcsZ0JBQWdCLFdBQVcsZ0JBQWdCLFdBQVcsZ0JBQWdCLFdBQVcsVUFBVTtBQUM3SSxhQUFPLGdCQUFnQixRQUFRLFVBQVUsc0JBQXNCLE9BQU87QUFBQSxJQUN2RTtBQUVBLDJCQUF1QixjQUFjLEdBQUcsTUFBTSxJQUFJLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUN6RSwyQkFBdUIsb0JBQW9CLEdBQUcsTUFBTSxJQUFJLE1BQU0sR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUMvRSwyQkFBdUIsbUJBQW1CLEdBQUcsTUFBTSxJQUFJLE1BQU0sR0FBRyxNQUFNLFFBQU8sb0JBQUksS0FBSyxzQkFBc0IsR0FBRSxRQUFRLENBQUM7QUFFdkgsMkJBQXVCLFVBQVUsR0FBRyxNQUFNLElBQUksTUFBTSxHQUFHLE1BQU0sS0FBSztBQUNsRSwyQkFBdUIsVUFBVSxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsTUFBTSxLQUFLO0FBQ2xFLDJCQUF1QixZQUFZLEdBQUcsTUFBTSxJQUFJLE1BQU0sS0FBSyxNQUFNLEtBQUs7QUFDdEUsMkJBQXVCLFVBQVUsR0FBRyxNQUFNLElBQUksTUFBTSxHQUFHLE1BQU0sS0FBSztBQUVsRSwyQkFBdUIsU0FBUyxHQUFHLE9BQU8sR0FBRyxPQUFPLEdBQUcsT0FBTyxLQUFLO0FBQ25FLDJCQUF1QixTQUFTLEdBQUcsTUFBTSxHQUFHLE9BQU8sR0FBRyxPQUFPLEtBQUs7QUFDbEUsMkJBQXVCLFVBQVUsR0FBRyxNQUFNLElBQUksTUFBTSxHQUFHLE9BQU8sS0FBSztBQUNuRSwyQkFBdUIsV0FBVyxHQUFHLE1BQU0sSUFBSSxNQUFNLEdBQUcsT0FBTyxLQUFLO0FBQ3BFLDJCQUF1QixXQUFXLEdBQUcsTUFBTSxJQUFJLE1BQU0sR0FBRyxPQUFPLEtBQUs7QUFDcEUsMkJBQXVCLFdBQVcsR0FBRyxNQUFNLElBQUksT0FBTyxHQUFHLE9BQU8sS0FBSztBQUNyRSwyQkFBdUIsS0FBSyxHQUFHLE9BQU8sR0FBRyxPQUFPLEdBQUcsT0FBTyxLQUFLO0FBRS9ELDJCQUF1QixXQUFXLEdBQUcsTUFBTSxHQUFHLE1BQU0sR0FBRyxNQUFNLElBQUk7QUFDakUsMkJBQXVCLFdBQVcsR0FBRyxNQUFNLEdBQUcsTUFBTSxHQUFHLE1BQU0sSUFBSTtBQUNqRSwyQkFBdUIsV0FBVyxHQUFHLE1BQU0sR0FBRyxNQUFNLEdBQUcsTUFBTSxJQUFJO0FBQUEsRUFDbEUsQ0FBQztBQUVELE9BQUssa0JBQWtCLE1BQU07QUFDNUIsYUFBUyxtQkFBbUIsU0FBaUIsZ0JBQXdCLGdCQUErQjtBQUNuRyxZQUFNLFNBQVMsZUFBZSxTQUFTLGdCQUFnQixjQUFjO0FBQ3JFLGFBQU8sWUFBWSxRQUFRLGdCQUFnQix5QkFBeUIsVUFBVSx1QkFBdUIsaUJBQWlCLGdCQUFnQixjQUFjO0FBQUEsSUFDcko7QUFFQSx1QkFBbUIsY0FBYyxTQUFTLElBQUk7QUFDOUMsdUJBQW1CLGNBQWMsU0FBUyxJQUFJO0FBQzlDLHVCQUFtQixjQUFjLFVBQVUsSUFBSTtBQUMvQyx1QkFBbUIsY0FBYyxVQUFVLEtBQUs7QUFDaEQsdUJBQW1CLGNBQWMsV0FBVyxLQUFLO0FBQ2pELHVCQUFtQixjQUFjLFVBQVUsSUFBSTtBQUMvQyx1QkFBbUIsY0FBYyxXQUFXLElBQUk7QUFDaEQsdUJBQW1CLGNBQWMsS0FBSyxJQUFJO0FBQzFDLHVCQUFtQixjQUFjLFdBQVcsSUFBSTtBQUNoRCx1QkFBbUIsY0FBYyxZQUFZLElBQUk7QUFDakQsdUJBQW1CLGNBQWMsWUFBWSxJQUFJO0FBQ2pELHVCQUFtQixjQUFjLFlBQVksS0FBSztBQUNsRCx1QkFBbUIsY0FBYyxXQUFXLEtBQUs7QUFFakQsdUJBQW1CLFVBQVUsU0FBUyxJQUFJO0FBQzFDLHVCQUFtQixVQUFVLFNBQVMsSUFBSTtBQUMxQyx1QkFBbUIsVUFBVSxVQUFVLElBQUk7QUFDM0MsdUJBQW1CLFVBQVUsVUFBVSxLQUFLO0FBQzVDLHVCQUFtQixVQUFVLFdBQVcsS0FBSztBQUM3Qyx1QkFBbUIsVUFBVSxVQUFVLElBQUk7QUFDM0MsdUJBQW1CLFVBQVUsV0FBVyxJQUFJO0FBQzVDLHVCQUFtQixVQUFVLEtBQUssSUFBSTtBQUV0Qyx1QkFBbUIsVUFBVSxTQUFTLElBQUk7QUFDMUMsdUJBQW1CLFVBQVUsU0FBUyxJQUFJO0FBQzFDLHVCQUFtQixVQUFVLFVBQVUsS0FBSztBQUM1Qyx1QkFBbUIsVUFBVSxVQUFVLEtBQUs7QUFDNUMsdUJBQW1CLFVBQVUsV0FBVyxLQUFLO0FBQzdDLHVCQUFtQixVQUFVLFVBQVUsSUFBSTtBQUMzQyx1QkFBbUIsVUFBVSxXQUFXLElBQUk7QUFDNUMsdUJBQW1CLFVBQVUsS0FBSyxJQUFJO0FBRXRDLHVCQUFtQixZQUFZLFNBQVMsSUFBSTtBQUM1Qyx1QkFBbUIsWUFBWSxTQUFTLElBQUk7QUFDNUMsdUJBQW1CLFlBQVksVUFBVSxLQUFLO0FBQzlDLHVCQUFtQixZQUFZLFVBQVUsS0FBSztBQUM5Qyx1QkFBbUIsWUFBWSxXQUFXLElBQUk7QUFDOUMsdUJBQW1CLFlBQVksVUFBVSxJQUFJO0FBQzdDLHVCQUFtQixZQUFZLFdBQVcsSUFBSTtBQUM5Qyx1QkFBbUIsWUFBWSxLQUFLLElBQUk7QUFFeEMsdUJBQW1CLFVBQVUsU0FBUyxJQUFJO0FBQzFDLHVCQUFtQixVQUFVLFNBQVMsSUFBSTtBQUMxQyx1QkFBbUIsVUFBVSxVQUFVLEtBQUs7QUFDNUMsdUJBQW1CLFVBQVUsVUFBVSxLQUFLO0FBQzVDLHVCQUFtQixVQUFVLFdBQVcsS0FBSztBQUM3Qyx1QkFBbUIsVUFBVSxVQUFVLEtBQUs7QUFDNUMsdUJBQW1CLFVBQVUsV0FBVyxLQUFLO0FBQzdDLHVCQUFtQixVQUFVLEtBQUssSUFBSTtBQUl0Qyx1QkFBbUIsU0FBUyxTQUFTLElBQUk7QUFDekMsdUJBQW1CLFNBQVMsU0FBUyxJQUFJO0FBQ3pDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsV0FBVyxJQUFJO0FBQzNDLHVCQUFtQixTQUFTLFVBQVUsSUFBSTtBQUMxQyx1QkFBbUIsU0FBUyxXQUFXLElBQUk7QUFDM0MsdUJBQW1CLFNBQVMsU0FBUyxJQUFJO0FBQ3pDLHVCQUFtQixTQUFTLFVBQVUsSUFBSTtBQUMxQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsS0FBSyxJQUFJO0FBQ3JDLHVCQUFtQixTQUFTLFdBQVcsSUFBSTtBQUMzQyx1QkFBbUIsU0FBUyxZQUFZLElBQUk7QUFDNUMsdUJBQW1CLFNBQVMsWUFBWSxJQUFJO0FBQzVDLHVCQUFtQixTQUFTLFlBQVksSUFBSTtBQUM1Qyx1QkFBbUIsU0FBUyxXQUFXLElBQUk7QUFDM0MsdUJBQW1CLFNBQVMsV0FBVyxLQUFLO0FBQzVDLHVCQUFtQixTQUFTLFdBQVcsS0FBSztBQUM1Qyx1QkFBbUIsU0FBUyxXQUFXLEtBQUs7QUFFNUMsdUJBQW1CLFdBQVcsU0FBUyxJQUFJO0FBQzNDLHVCQUFtQixXQUFXLFNBQVMsSUFBSTtBQUMzQyx1QkFBbUIsV0FBVyxVQUFVLEtBQUs7QUFDN0MsdUJBQW1CLFdBQVcsVUFBVSxLQUFLO0FBQzdDLHVCQUFtQixXQUFXLFdBQVcsSUFBSTtBQUM3Qyx1QkFBbUIsV0FBVyxVQUFVLElBQUk7QUFDNUMsdUJBQW1CLFdBQVcsV0FBVyxJQUFJO0FBQzdDLHVCQUFtQixXQUFXLFNBQVMsS0FBSztBQUM1Qyx1QkFBbUIsV0FBVyxVQUFVLElBQUk7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFVBQVUsS0FBSztBQUM3Qyx1QkFBbUIsV0FBVyxLQUFLLElBQUk7QUFFdkMsdUJBQW1CLFdBQVcsU0FBUyxJQUFJO0FBQzNDLHVCQUFtQixXQUFXLFNBQVMsSUFBSTtBQUMzQyx1QkFBbUIsV0FBVyxVQUFVLEtBQUs7QUFDN0MsdUJBQW1CLFdBQVcsVUFBVSxLQUFLO0FBQzdDLHVCQUFtQixXQUFXLFdBQVcsSUFBSTtBQUM3Qyx1QkFBbUIsV0FBVyxVQUFVLElBQUk7QUFDNUMsdUJBQW1CLFdBQVcsV0FBVyxJQUFJO0FBQzdDLHVCQUFtQixXQUFXLFNBQVMsS0FBSztBQUM1Qyx1QkFBbUIsV0FBVyxVQUFVLElBQUk7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFlBQVksSUFBSTtBQUM5Qyx1QkFBbUIsV0FBVyxVQUFVLEtBQUs7QUFDN0MsdUJBQW1CLFdBQVcsS0FBSyxJQUFJO0FBQ3ZDLHVCQUFtQixXQUFXLFlBQVksSUFBSTtBQUM5Qyx1QkFBbUIsV0FBVyxhQUFhLElBQUk7QUFDL0MsdUJBQW1CLFdBQVcsYUFBYSxLQUFLO0FBRWhELHVCQUFtQixTQUFTLFNBQVMsSUFBSTtBQUN6Qyx1QkFBbUIsU0FBUyxTQUFTLEtBQUs7QUFDMUMsdUJBQW1CLFNBQVMsVUFBVSxLQUFLO0FBQzNDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxXQUFXLEtBQUs7QUFDNUMsdUJBQW1CLFNBQVMsVUFBVSxLQUFLO0FBQzNDLHVCQUFtQixTQUFTLFdBQVcsS0FBSztBQUM1Qyx1QkFBbUIsU0FBUyxTQUFTLEtBQUs7QUFDMUMsdUJBQW1CLFNBQVMsVUFBVSxLQUFLO0FBQzNDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxZQUFZLEtBQUs7QUFDN0MsdUJBQW1CLFNBQVMsVUFBVSxJQUFJO0FBQzFDLHVCQUFtQixTQUFTLEtBQUssSUFBSTtBQUFBLEVBQ3RDLENBQUM7QUFFRCxPQUFLLDJCQUEyQixNQUFNO0FBRXJDLGFBQVMscUJBQXFCLFNBQWlCLGdCQUF3QixXQUFvQixTQUFrQixnQkFBK0I7QUFDM0ksWUFBTSxXQUErQjtBQUFBLFFBQ3BDLE1BQU07QUFBQSxRQUNOLFdBQVc7QUFBQSxRQUNYLFNBQVM7QUFBQSxRQUNULFNBQVM7QUFBQSxVQUNSLFFBQVE7QUFBQSxRQUNUO0FBQUEsUUFDQSxNQUFNLFVBQVUsY0FBYztBQUFBLE1BQy9CO0FBQ0EsWUFBTSxVQUFvQixDQUFDO0FBQzNCLFlBQU0sU0FBUyx3QkFBd0IsU0FBUyxnQkFBZ0IsVUFBVSxXQUFXLE9BQU87QUFFNUYsYUFBTyxZQUFZLFFBQVEsZ0JBQWdCLGNBQWMsVUFBVSx1QkFBdUIsaUJBQWlCLGFBQWEsS0FBSyxVQUFVLFFBQVEsSUFBSSxnQkFBZ0IsS0FBSyxVQUFVLE9BQU8sQ0FBQztBQUFBLElBQzNMO0FBRUEsYUFBUyw4QkFBOEIsU0FBaUIsZ0JBQXdCLFdBQW9CLFNBQXdCO0FBQzNILDJCQUFxQixTQUFTLGdCQUFnQixXQUFXLFNBQVMsS0FBSztBQUFBLElBQ3hFO0FBRUEsYUFBUyw0QkFBNEIsU0FBaUIsZ0JBQXdCLFdBQW9CLFNBQXdCO0FBQ3pILDJCQUFxQixTQUFTLGdCQUFnQixXQUFXLFNBQVMsSUFBSTtBQUFBLElBQ3ZFO0FBRUEsYUFBUyxtQkFBbUIsU0FBaUIsZ0JBQXdCLGdCQUErQjtBQUNuRywyQkFBcUIsU0FBUyxnQkFBZ0IsT0FBTyxNQUFNLGNBQWM7QUFBQSxJQUMxRTtBQUdBLGdDQUE0QixjQUFjLEtBQUssTUFBTSxJQUFJO0FBQ3pELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxJQUFJO0FBQzdELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxJQUFJO0FBQzdELGdDQUE0QixjQUFjLFVBQVUsTUFBTSxJQUFJO0FBQzlELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxJQUFJO0FBQzdELGdDQUE0QixjQUFjLFVBQVUsTUFBTSxJQUFJO0FBQzlELGdDQUE0QixjQUFjLEtBQUssTUFBTSxLQUFLO0FBQzFELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxLQUFLO0FBQzlELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxLQUFLO0FBQzlELGdDQUE0QixjQUFjLFVBQVUsTUFBTSxLQUFLO0FBQy9ELGdDQUE0QixjQUFjLFNBQVMsTUFBTSxLQUFLO0FBQzlELGdDQUE0QixjQUFjLFVBQVUsTUFBTSxLQUFLO0FBRy9ELGtDQUE4QixjQUFjLEtBQUssT0FBTyxJQUFJO0FBQzVELGtDQUE4QixjQUFjLFNBQVMsT0FBTyxJQUFJO0FBQ2hFLGtDQUE4QixjQUFjLFNBQVMsT0FBTyxJQUFJO0FBQ2hFLGdDQUE0QixjQUFjLFVBQVUsT0FBTyxJQUFJO0FBQy9ELGdDQUE0QixjQUFjLFNBQVMsT0FBTyxJQUFJO0FBQzlELGdDQUE0QixjQUFjLFVBQVUsT0FBTyxJQUFJO0FBQy9ELGdDQUE0QixjQUFjLEtBQUssT0FBTyxLQUFLO0FBQzNELGdDQUE0QixjQUFjLFNBQVMsT0FBTyxLQUFLO0FBQy9ELGdDQUE0QixjQUFjLFNBQVMsT0FBTyxLQUFLO0FBQy9ELGdDQUE0QixjQUFjLFVBQVUsT0FBTyxLQUFLO0FBQ2hFLGdDQUE0QixjQUFjLFNBQVMsT0FBTyxLQUFLO0FBQy9ELGdDQUE0QixjQUFjLFVBQVUsT0FBTyxLQUFLO0FBR2hFLGdDQUE0QixjQUFjLGlCQUFpQixPQUFPLEtBQUs7QUFDdkUsZ0NBQTRCLGNBQWMsS0FBSyxPQUFPLEtBQUs7QUFDM0QsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsVUFBVSxPQUFPLEtBQUs7QUFDaEUsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsVUFBVSxPQUFPLEtBQUs7QUFDaEUsZ0NBQTRCLGNBQWMsS0FBSyxPQUFPLEtBQUs7QUFDM0QsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsVUFBVSxPQUFPLEtBQUs7QUFDaEUsZ0NBQTRCLGNBQWMsU0FBUyxPQUFPLEtBQUs7QUFDL0QsZ0NBQTRCLGNBQWMsVUFBVSxPQUFPLEtBQUs7QUFHaEUsdUJBQW1CLGNBQWMsU0FBUyxLQUFLO0FBQy9DLHVCQUFtQixjQUFjLFNBQVMsS0FBSztBQUMvQyx1QkFBbUIsY0FBYyxVQUFVLElBQUk7QUFDL0MsdUJBQW1CLGNBQWMsVUFBVSxLQUFLO0FBQ2hELHVCQUFtQixjQUFjLFdBQVcsS0FBSztBQUNqRCx1QkFBbUIsY0FBYyxVQUFVLElBQUk7QUFDL0MsdUJBQW1CLGNBQWMsV0FBVyxJQUFJO0FBQ2hELHVCQUFtQixjQUFjLEtBQUssS0FBSztBQUUzQyx1QkFBbUIsVUFBVSxTQUFTLEtBQUs7QUFDM0MsdUJBQW1CLFVBQVUsU0FBUyxLQUFLO0FBQzNDLHVCQUFtQixVQUFVLFVBQVUsSUFBSTtBQUMzQyx1QkFBbUIsVUFBVSxVQUFVLEtBQUs7QUFDNUMsdUJBQW1CLFVBQVUsV0FBVyxLQUFLO0FBQzdDLHVCQUFtQixVQUFVLFVBQVUsSUFBSTtBQUMzQyx1QkFBbUIsVUFBVSxXQUFXLElBQUk7QUFDNUMsdUJBQW1CLFVBQVUsS0FBSyxLQUFLO0FBRXZDLHVCQUFtQixVQUFVLFNBQVMsS0FBSztBQUMzQyx1QkFBbUIsVUFBVSxTQUFTLEtBQUs7QUFDM0MsdUJBQW1CLFVBQVUsVUFBVSxLQUFLO0FBQzVDLHVCQUFtQixVQUFVLFVBQVUsS0FBSztBQUM1Qyx1QkFBbUIsVUFBVSxXQUFXLEtBQUs7QUFDN0MsdUJBQW1CLFVBQVUsVUFBVSxJQUFJO0FBQzNDLHVCQUFtQixVQUFVLFdBQVcsSUFBSTtBQUM1Qyx1QkFBbUIsVUFBVSxLQUFLLEtBQUs7QUFFdkMsdUJBQW1CLFlBQVksU0FBUyxLQUFLO0FBQzdDLHVCQUFtQixZQUFZLFNBQVMsS0FBSztBQUM3Qyx1QkFBbUIsWUFBWSxVQUFVLEtBQUs7QUFDOUMsdUJBQW1CLFlBQVksVUFBVSxLQUFLO0FBQzlDLHVCQUFtQixZQUFZLFdBQVcsSUFBSTtBQUM5Qyx1QkFBbUIsWUFBWSxVQUFVLElBQUk7QUFDN0MsdUJBQW1CLFlBQVksV0FBVyxJQUFJO0FBQzlDLHVCQUFtQixZQUFZLEtBQUssS0FBSztBQUV6Qyx1QkFBbUIsVUFBVSxTQUFTLEtBQUs7QUFDM0MsdUJBQW1CLFVBQVUsU0FBUyxLQUFLO0FBQzNDLHVCQUFtQixVQUFVLFVBQVUsS0FBSztBQUM1Qyx1QkFBbUIsVUFBVSxVQUFVLEtBQUs7QUFDNUMsdUJBQW1CLFVBQVUsV0FBVyxLQUFLO0FBQzdDLHVCQUFtQixVQUFVLFVBQVUsS0FBSztBQUM1Qyx1QkFBbUIsVUFBVSxXQUFXLEtBQUs7QUFDN0MsdUJBQW1CLFVBQVUsS0FBSyxLQUFLO0FBRXZDLHVCQUFtQixTQUFTLFNBQVMsS0FBSztBQUMxQyx1QkFBbUIsU0FBUyxTQUFTLEtBQUs7QUFDMUMsdUJBQW1CLFNBQVMsVUFBVSxLQUFLO0FBQzNDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxXQUFXLElBQUk7QUFDM0MsdUJBQW1CLFNBQVMsVUFBVSxJQUFJO0FBQzFDLHVCQUFtQixTQUFTLFdBQVcsSUFBSTtBQUMzQyx1QkFBbUIsU0FBUyxLQUFLLEtBQUs7QUFFdEMsdUJBQW1CLFVBQVUsU0FBUyxLQUFLO0FBQzNDLHVCQUFtQixVQUFVLFNBQVMsSUFBSTtBQUMxQyx1QkFBbUIsVUFBVSxVQUFVLElBQUk7QUFDM0MsdUJBQW1CLFVBQVUsVUFBVSxLQUFLO0FBQzVDLHVCQUFtQixVQUFVLFdBQVcsS0FBSztBQUM3Qyx1QkFBbUIsVUFBVSxVQUFVLElBQUk7QUFDM0MsdUJBQW1CLFVBQVUsV0FBVyxJQUFJO0FBQzVDLHVCQUFtQixVQUFVLEtBQUssS0FBSztBQUt2Qyx1QkFBbUIsU0FBUyxTQUFTLEtBQUs7QUFDMUMsdUJBQW1CLFNBQVMsU0FBUyxLQUFLO0FBQzFDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsV0FBVyxJQUFJO0FBQzNDLHVCQUFtQixTQUFTLFVBQVUsSUFBSTtBQUMxQyx1QkFBbUIsU0FBUyxXQUFXLElBQUk7QUFDM0MsdUJBQW1CLFNBQVMsU0FBUyxJQUFJO0FBQ3pDLHVCQUFtQixTQUFTLFVBQVUsSUFBSTtBQUMxQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsS0FBSyxLQUFLO0FBRXRDLHVCQUFtQixXQUFXLFNBQVMsS0FBSztBQUM1Qyx1QkFBbUIsV0FBVyxTQUFTLEtBQUs7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxLQUFLO0FBQzdDLHVCQUFtQixXQUFXLFVBQVUsS0FBSztBQUM3Qyx1QkFBbUIsV0FBVyxXQUFXLElBQUk7QUFDN0MsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFdBQVcsSUFBSTtBQUM3Qyx1QkFBbUIsV0FBVyxTQUFTLEtBQUs7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFVBQVUsSUFBSTtBQUM1Qyx1QkFBbUIsV0FBVyxVQUFVLEtBQUs7QUFDN0MsdUJBQW1CLFdBQVcsS0FBSyxLQUFLO0FBRXhDLHVCQUFtQixXQUFXLFNBQVMsS0FBSztBQUM1Qyx1QkFBbUIsV0FBVyxTQUFTLEtBQUs7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxLQUFLO0FBQzdDLHVCQUFtQixXQUFXLFVBQVUsS0FBSztBQUM3Qyx1QkFBbUIsV0FBVyxXQUFXLElBQUk7QUFDN0MsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFdBQVcsSUFBSTtBQUM3Qyx1QkFBbUIsV0FBVyxTQUFTLEtBQUs7QUFDNUMsdUJBQW1CLFdBQVcsVUFBVSxJQUFJO0FBQzVDLHVCQUFtQixXQUFXLFVBQVUsSUFBSTtBQUM1Qyx1QkFBbUIsV0FBVyxZQUFZLElBQUk7QUFDOUMsdUJBQW1CLFdBQVcsVUFBVSxLQUFLO0FBQzdDLHVCQUFtQixXQUFXLEtBQUssS0FBSztBQUV4Qyx1QkFBbUIsU0FBUyxTQUFTLEtBQUs7QUFDMUMsdUJBQW1CLFNBQVMsU0FBUyxLQUFLO0FBQzFDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsV0FBVyxLQUFLO0FBQzVDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxXQUFXLEtBQUs7QUFDNUMsdUJBQW1CLFNBQVMsU0FBUyxLQUFLO0FBQzFDLHVCQUFtQixTQUFTLFVBQVUsS0FBSztBQUMzQyx1QkFBbUIsU0FBUyxVQUFVLEtBQUs7QUFDM0MsdUJBQW1CLFNBQVMsWUFBWSxLQUFLO0FBQzdDLHVCQUFtQixTQUFTLFVBQVUsSUFBSTtBQUMxQyx1QkFBbUIsU0FBUyxLQUFLLEtBQUs7QUFHdEMsdUJBQW1CLFVBQVUsb0JBQW9CLElBQUk7QUFDckQsdUJBQW1CLFVBQVUsb0JBQW9CLElBQUk7QUFDckQsdUJBQW1CLFVBQVUsb0JBQW9CLEtBQUs7QUFDdEQsdUJBQW1CLFVBQVUsb0JBQW9CLElBQUk7QUFDckQsdUJBQW1CLFVBQVUsb0JBQW9CLElBQUk7QUFBQSxFQUN0RCxDQUFDO0FBRUQsT0FBSywwREFBMEQsTUFBTTtBQUNwRSxVQUFNLFdBQVc7QUFBQSxNQUNoQixNQUFNO0FBQUEsTUFDTixXQUFXO0FBQUEsTUFDWCxTQUFTO0FBQUEsTUFDVCxTQUFTO0FBQUEsUUFDUixRQUFRO0FBQUEsTUFDVDtBQUFBLE1BQ0EsU0FBUztBQUFBLElBQ1Y7QUFDQSxXQUFPLFlBQVksd0JBQXdCLFVBQVUsUUFBVyxVQUFVLE9BQU8sQ0FBQyxDQUFDLEdBQUcsS0FBSztBQUFBLEVBQzVGLENBQUM7QUFFRCxPQUFLLDZCQUE2QixNQUFNO0FBQ3ZDLFdBQU8sWUFBWSwwQkFBMEIsQ0FBQyxDQUFDLEdBQUcsSUFBSTtBQUN0RCxXQUFPLFlBQVksMEJBQTBCLENBQUMsR0FBRyxDQUFDLE9BQU8sQ0FBQyxHQUFHLElBQUk7QUFDakUsV0FBTyxZQUFZLDBCQUEwQixDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsSUFBSTtBQUMxRCxXQUFPLFlBQVksMEJBQTBCLENBQUMsV0FBVyxHQUFHLENBQUMsQ0FBQyxHQUFHLElBQUk7QUFDckUsV0FBTyxZQUFZLDBCQUEwQixDQUFDLFdBQVcsR0FBRyxFQUFFLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxDQUFDLEdBQUcsSUFBSTtBQUNwRyxXQUFPLFlBQVksMEJBQTBCLENBQUMsV0FBVyxHQUFHLEVBQUUsYUFBYSxFQUFFLFVBQVUsSUFBSSxTQUFTLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSTtBQUNoSCxXQUFPLFlBQVksMEJBQTBCLENBQUMsYUFBYSxHQUFHLEVBQUUsYUFBYSxFQUFFLFVBQVUsSUFBSSxTQUFTLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSTtBQUNsSCxXQUFPLFlBQVksMEJBQTBCLENBQUMsV0FBVyxHQUFHLEVBQUUsYUFBYSxFQUFFLFVBQVUsR0FBRyxFQUFFLENBQUMsR0FBRyxJQUFJO0FBQ3BHLFdBQU8sWUFBWSwwQkFBMEIsQ0FBQyxhQUFhLFdBQVcsR0FBRyxDQUFDLENBQUMsR0FBRyxJQUFJO0FBQ2xGLFdBQU8sWUFBWSwwQkFBMEIsQ0FBQyxhQUFhLFdBQVcsR0FBRyxFQUFFLGFBQWEsRUFBRSxVQUFVLEdBQUcsRUFBRSxDQUFDLEdBQUcsSUFBSTtBQUVqSCxXQUFPLFlBQVksMEJBQTBCLENBQUMsYUFBYSxHQUFHLEVBQUUsYUFBYSxFQUFFLFVBQVUsR0FBRyxFQUFFLENBQUMsR0FBRyxLQUFLO0FBQ3ZHLFdBQU8sWUFBWSwwQkFBMEIsQ0FBQyxhQUFhLEdBQUcsRUFBRSxhQUFhLEVBQUUsVUFBVSxJQUFJLFNBQVMsRUFBRSxFQUFFLENBQUMsR0FBRyxLQUFLO0FBQ25ILFdBQU8sWUFBWSwwQkFBMEIsQ0FBQyxhQUFhLEdBQUcsRUFBRSxhQUFhLEVBQUUsVUFBVSxHQUFHLEVBQUUsQ0FBQyxHQUFHLEtBQUs7QUFBQSxFQUN4RyxDQUFDO0FBRUYsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
