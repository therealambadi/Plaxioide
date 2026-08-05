import { deepStrictEqual, ok, strictEqual } from "assert";
import { OperatingSystem } from "../../../../../../base/common/platform.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { detectLinks, detectLinkSuffixes, getLinkSuffix, removeLinkQueryString, removeLinkSuffix } from "../../browser/terminalLinkParsing.js";
const operatingSystems = [
  OperatingSystem.Linux,
  OperatingSystem.Macintosh,
  OperatingSystem.Windows
];
const osTestPath = {
  [OperatingSystem.Linux]: "/test/path/linux",
  [OperatingSystem.Macintosh]: "/test/path/macintosh",
  [OperatingSystem.Windows]: "C:\\test\\path\\windows"
};
const osLabel = {
  [OperatingSystem.Linux]: "[Linux]",
  [OperatingSystem.Macintosh]: "[macOS]",
  [OperatingSystem.Windows]: "[Windows]"
};
const testRow = 339;
const testCol = 12;
const testRowEnd = 341;
const testColEnd = 789;
const testLinks = [
  // Simple
  { link: "foo", prefix: void 0, suffix: void 0, hasRow: false, hasCol: false },
  { link: "foo:339", prefix: void 0, suffix: ":339", hasRow: true, hasCol: false },
  { link: "foo:339:12", prefix: void 0, suffix: ":339:12", hasRow: true, hasCol: true },
  { link: "foo:339:12-789", prefix: void 0, suffix: ":339:12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo:339.12", prefix: void 0, suffix: ":339.12", hasRow: true, hasCol: true },
  { link: "foo:339.12-789", prefix: void 0, suffix: ":339.12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo:339.12-341.789", prefix: void 0, suffix: ":339.12-341.789", hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
  { link: "foo#339", prefix: void 0, suffix: "#339", hasRow: true, hasCol: false },
  { link: "foo#339:12", prefix: void 0, suffix: "#339:12", hasRow: true, hasCol: true },
  { link: "foo#339:12-789", prefix: void 0, suffix: "#339:12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo#339.12", prefix: void 0, suffix: "#339.12", hasRow: true, hasCol: true },
  { link: "foo#339.12-789", prefix: void 0, suffix: "#339.12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo#339.12-341.789", prefix: void 0, suffix: "#339.12-341.789", hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
  { link: "foo 339", prefix: void 0, suffix: " 339", hasRow: true, hasCol: false },
  { link: "foo 339:12", prefix: void 0, suffix: " 339:12", hasRow: true, hasCol: true },
  { link: "foo 339:12-789", prefix: void 0, suffix: " 339:12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo 339.12", prefix: void 0, suffix: " 339.12", hasRow: true, hasCol: true },
  { link: "foo 339.12-789", prefix: void 0, suffix: " 339.12-789", hasRow: true, hasCol: true, hasRowEnd: false, hasColEnd: true },
  { link: "foo 339.12-341.789", prefix: void 0, suffix: " 339.12-341.789", hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
  { link: "foo, 339", prefix: void 0, suffix: ", 339", hasRow: true, hasCol: false },
  // Double quotes
  { link: '"foo",339', prefix: '"', suffix: '",339', hasRow: true, hasCol: false },
  { link: '"foo",339:12', prefix: '"', suffix: '",339:12', hasRow: true, hasCol: true },
  { link: '"foo",339.12', prefix: '"', suffix: '",339.12', hasRow: true, hasCol: true },
  { link: '"foo", line 339', prefix: '"', suffix: '", line 339', hasRow: true, hasCol: false },
  { link: '"foo", line 339, col 12', prefix: '"', suffix: '", line 339, col 12', hasRow: true, hasCol: true },
  { link: '"foo", line 339, column 12', prefix: '"', suffix: '", line 339, column 12', hasRow: true, hasCol: true },
  { link: '"foo":line 339', prefix: '"', suffix: '":line 339', hasRow: true, hasCol: false },
  { link: '"foo":line 339, col 12', prefix: '"', suffix: '":line 339, col 12', hasRow: true, hasCol: true },
  { link: '"foo":line 339, column 12', prefix: '"', suffix: '":line 339, column 12', hasRow: true, hasCol: true },
  { link: '"foo": line 339', prefix: '"', suffix: '": line 339', hasRow: true, hasCol: false },
  { link: '"foo": line 339, col 12', prefix: '"', suffix: '": line 339, col 12', hasRow: true, hasCol: true },
  { link: '"foo": line 339, column 12', prefix: '"', suffix: '": line 339, column 12', hasRow: true, hasCol: true },
  { link: '"foo" on line 339', prefix: '"', suffix: '" on line 339', hasRow: true, hasCol: false },
  { link: '"foo" on line 339, col 12', prefix: '"', suffix: '" on line 339, col 12', hasRow: true, hasCol: true },
  { link: '"foo" on line 339, column 12', prefix: '"', suffix: '" on line 339, column 12', hasRow: true, hasCol: true },
  { link: '"foo" line 339', prefix: '"', suffix: '" line 339', hasRow: true, hasCol: false },
  { link: '"foo" line 339 column 12', prefix: '"', suffix: '" line 339 column 12', hasRow: true, hasCol: true },
  // Single quotes
  { link: "'foo',339", prefix: "'", suffix: "',339", hasRow: true, hasCol: false },
  { link: "'foo',339:12", prefix: "'", suffix: "',339:12", hasRow: true, hasCol: true },
  { link: "'foo',339.12", prefix: "'", suffix: "',339.12", hasRow: true, hasCol: true },
  { link: "'foo', line 339", prefix: "'", suffix: "', line 339", hasRow: true, hasCol: false },
  { link: "'foo', line 339, col 12", prefix: "'", suffix: "', line 339, col 12", hasRow: true, hasCol: true },
  { link: "'foo', line 339, column 12", prefix: "'", suffix: "', line 339, column 12", hasRow: true, hasCol: true },
  { link: "'foo':line 339", prefix: "'", suffix: "':line 339", hasRow: true, hasCol: false },
  { link: "'foo':line 339, col 12", prefix: "'", suffix: "':line 339, col 12", hasRow: true, hasCol: true },
  { link: "'foo':line 339, column 12", prefix: "'", suffix: "':line 339, column 12", hasRow: true, hasCol: true },
  { link: "'foo': line 339", prefix: "'", suffix: "': line 339", hasRow: true, hasCol: false },
  { link: "'foo': line 339, col 12", prefix: "'", suffix: "': line 339, col 12", hasRow: true, hasCol: true },
  { link: "'foo': line 339, column 12", prefix: "'", suffix: "': line 339, column 12", hasRow: true, hasCol: true },
  { link: "'foo' on line 339", prefix: "'", suffix: "' on line 339", hasRow: true, hasCol: false },
  { link: "'foo' on line 339, col 12", prefix: "'", suffix: "' on line 339, col 12", hasRow: true, hasCol: true },
  { link: "'foo' on line 339, column 12", prefix: "'", suffix: "' on line 339, column 12", hasRow: true, hasCol: true },
  { link: "'foo' line 339", prefix: "'", suffix: "' line 339", hasRow: true, hasCol: false },
  { link: "'foo' line 339 column 12", prefix: "'", suffix: "' line 339 column 12", hasRow: true, hasCol: true },
  // No quotes
  { link: "foo, line 339", prefix: void 0, suffix: ", line 339", hasRow: true, hasCol: false },
  { link: "foo, line 339, col 12", prefix: void 0, suffix: ", line 339, col 12", hasRow: true, hasCol: true },
  { link: "foo, line 339, column 12", prefix: void 0, suffix: ", line 339, column 12", hasRow: true, hasCol: true },
  { link: "foo:line 339", prefix: void 0, suffix: ":line 339", hasRow: true, hasCol: false },
  { link: "foo:line 339, col 12", prefix: void 0, suffix: ":line 339, col 12", hasRow: true, hasCol: true },
  { link: "foo:line 339, column 12", prefix: void 0, suffix: ":line 339, column 12", hasRow: true, hasCol: true },
  { link: "foo: line 339", prefix: void 0, suffix: ": line 339", hasRow: true, hasCol: false },
  { link: "foo: line 339, col 12", prefix: void 0, suffix: ": line 339, col 12", hasRow: true, hasCol: true },
  { link: "foo: line 339, column 12", prefix: void 0, suffix: ": line 339, column 12", hasRow: true, hasCol: true },
  { link: "foo on line 339", prefix: void 0, suffix: " on line 339", hasRow: true, hasCol: false },
  { link: "foo on line 339, col 12", prefix: void 0, suffix: " on line 339, col 12", hasRow: true, hasCol: true },
  { link: "foo on line 339, column 12", prefix: void 0, suffix: " on line 339, column 12", hasRow: true, hasCol: true },
  { link: "foo line 339", prefix: void 0, suffix: " line 339", hasRow: true, hasCol: false },
  { link: "foo line 339 column 12", prefix: void 0, suffix: " line 339 column 12", hasRow: true, hasCol: true },
  // Parentheses
  { link: "foo(339)", prefix: void 0, suffix: "(339)", hasRow: true, hasCol: false },
  { link: "foo(339,12)", prefix: void 0, suffix: "(339,12)", hasRow: true, hasCol: true },
  { link: "foo(339, 12)", prefix: void 0, suffix: "(339, 12)", hasRow: true, hasCol: true },
  { link: "foo (339)", prefix: void 0, suffix: " (339)", hasRow: true, hasCol: false },
  { link: "foo (339,12)", prefix: void 0, suffix: " (339,12)", hasRow: true, hasCol: true },
  { link: "foo (339, 12)", prefix: void 0, suffix: " (339, 12)", hasRow: true, hasCol: true },
  { link: "foo: (339)", prefix: void 0, suffix: ": (339)", hasRow: true, hasCol: false },
  { link: "foo: (339,12)", prefix: void 0, suffix: ": (339,12)", hasRow: true, hasCol: true },
  { link: "foo: (339, 12)", prefix: void 0, suffix: ": (339, 12)", hasRow: true, hasCol: true },
  { link: "foo(339:12)", prefix: void 0, suffix: "(339:12)", hasRow: true, hasCol: true },
  { link: "foo (339:12)", prefix: void 0, suffix: " (339:12)", hasRow: true, hasCol: true },
  // Square brackets
  { link: "foo[339]", prefix: void 0, suffix: "[339]", hasRow: true, hasCol: false },
  { link: "foo[339,12]", prefix: void 0, suffix: "[339,12]", hasRow: true, hasCol: true },
  { link: "foo[339, 12]", prefix: void 0, suffix: "[339, 12]", hasRow: true, hasCol: true },
  { link: "foo [339]", prefix: void 0, suffix: " [339]", hasRow: true, hasCol: false },
  { link: "foo [339,12]", prefix: void 0, suffix: " [339,12]", hasRow: true, hasCol: true },
  { link: "foo [339, 12]", prefix: void 0, suffix: " [339, 12]", hasRow: true, hasCol: true },
  { link: "foo: [339]", prefix: void 0, suffix: ": [339]", hasRow: true, hasCol: false },
  { link: "foo: [339,12]", prefix: void 0, suffix: ": [339,12]", hasRow: true, hasCol: true },
  { link: "foo: [339, 12]", prefix: void 0, suffix: ": [339, 12]", hasRow: true, hasCol: true },
  { link: "foo[339:12]", prefix: void 0, suffix: "[339:12]", hasRow: true, hasCol: true },
  { link: "foo [339:12]", prefix: void 0, suffix: " [339:12]", hasRow: true, hasCol: true },
  // OCaml-style
  { link: '"foo", line 339, character 12', prefix: '"', suffix: '", line 339, character 12', hasRow: true, hasCol: true },
  { link: '"foo", line 339, characters 12-789', prefix: '"', suffix: '", line 339, characters 12-789', hasRow: true, hasCol: true, hasColEnd: true },
  { link: '"foo", lines 339-341', prefix: '"', suffix: '", lines 339-341', hasRow: true, hasCol: false, hasRowEnd: true },
  { link: '"foo", lines 339-341, characters 12-789', prefix: '"', suffix: '", lines 339-341, characters 12-789', hasRow: true, hasCol: true, hasRowEnd: true, hasColEnd: true },
  // Non-breaking space
  { link: "foo\xA0339:12", prefix: void 0, suffix: "\xA0339:12", hasRow: true, hasCol: true },
  { link: '"foo" on line 339,\xA0column 12', prefix: '"', suffix: '" on line 339,\xA0column 12', hasRow: true, hasCol: true },
  { link: "'foo' on line\xA0339, column 12", prefix: "'", suffix: "' on line\xA0339, column 12", hasRow: true, hasCol: true },
  { link: "foo (339,\xA012)", prefix: void 0, suffix: " (339,\xA012)", hasRow: true, hasCol: true },
  { link: "foo\xA0[339, 12]", prefix: void 0, suffix: "\xA0[339, 12]", hasRow: true, hasCol: true }
];
const testLinksWithSuffix = testLinks.filter((e) => !!e.suffix);
suite("TerminalLinkParsing", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("removeLinkSuffix", () => {
    for (const testLink of testLinks) {
      test("`" + testLink.link + "`", () => {
        deepStrictEqual(
          removeLinkSuffix(testLink.link),
          testLink.suffix === void 0 ? testLink.link : testLink.link.replace(testLink.suffix, "")
        );
      });
    }
  });
  suite("getLinkSuffix", () => {
    for (const testLink of testLinks) {
      test("`" + testLink.link + "`", () => {
        deepStrictEqual(
          getLinkSuffix(testLink.link),
          testLink.suffix === void 0 ? null : {
            row: testLink.hasRow ? testRow : void 0,
            col: testLink.hasCol ? testCol : void 0,
            rowEnd: testLink.hasRowEnd ? testRowEnd : void 0,
            colEnd: testLink.hasColEnd ? testColEnd : void 0,
            suffix: {
              index: testLink.link.length - testLink.suffix.length,
              text: testLink.suffix
            }
          }
        );
      });
    }
  });
  suite("detectLinkSuffixes", () => {
    for (const testLink of testLinks) {
      test("`" + testLink.link + "`", () => {
        deepStrictEqual(
          detectLinkSuffixes(testLink.link),
          testLink.suffix === void 0 ? [] : [{
            row: testLink.hasRow ? testRow : void 0,
            col: testLink.hasCol ? testCol : void 0,
            rowEnd: testLink.hasRowEnd ? testRowEnd : void 0,
            colEnd: testLink.hasColEnd ? testColEnd : void 0,
            suffix: {
              index: testLink.link.length - testLink.suffix.length,
              text: testLink.suffix
            }
          }]
        );
      });
    }
    test("foo(1, 2) bar[3, 4] baz on line 5", () => {
      deepStrictEqual(
        detectLinkSuffixes("foo(1, 2) bar[3, 4] baz on line 5"),
        [
          {
            col: 2,
            row: 1,
            rowEnd: void 0,
            colEnd: void 0,
            suffix: {
              index: 3,
              text: "(1, 2)"
            }
          },
          {
            col: 4,
            row: 3,
            rowEnd: void 0,
            colEnd: void 0,
            suffix: {
              index: 13,
              text: "[3, 4]"
            }
          },
          {
            col: void 0,
            row: 5,
            rowEnd: void 0,
            colEnd: void 0,
            suffix: {
              index: 23,
              text: " on line 5"
            }
          }
        ]
      );
    });
  });
  suite("removeLinkQueryString", () => {
    test("should remove any query string from the link", () => {
      strictEqual(removeLinkQueryString("?a=b"), "");
      strictEqual(removeLinkQueryString("foo?a=b"), "foo");
      strictEqual(removeLinkQueryString("./foo?a=b"), "./foo");
      strictEqual(removeLinkQueryString("/foo/bar?a=b"), "/foo/bar");
      strictEqual(removeLinkQueryString("foo?a=b?"), "foo");
      strictEqual(removeLinkQueryString("foo?a=b&c=d"), "foo");
    });
    test("should respect ? in UNC paths", () => {
      strictEqual(removeLinkQueryString("\\\\?\\foo?a=b"), "\\\\?\\foo");
    });
  });
  suite("detectLinks", () => {
    test('foo(1, 2) bar[3, 4] "baz" on line 5', () => {
      deepStrictEqual(
        detectLinks('foo(1, 2) bar[3, 4] "baz" on line 5', OperatingSystem.Linux),
        [
          {
            path: {
              index: 0,
              text: "foo"
            },
            prefix: void 0,
            suffix: {
              col: 2,
              row: 1,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 3,
                text: "(1, 2)"
              }
            }
          },
          {
            path: {
              index: 10,
              text: "bar"
            },
            prefix: void 0,
            suffix: {
              col: 4,
              row: 3,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 13,
                text: "[3, 4]"
              }
            }
          },
          {
            path: {
              index: 21,
              text: "baz"
            },
            prefix: {
              index: 20,
              text: '"'
            },
            suffix: {
              col: void 0,
              row: 5,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 24,
                text: '" on line 5'
              }
            }
          }
        ]
      );
    });
    test("should extract the link prefix", () => {
      deepStrictEqual(
        detectLinks('"foo", line 5, col 6', OperatingSystem.Linux),
        [
          {
            path: {
              index: 1,
              text: "foo"
            },
            prefix: {
              index: 0,
              text: '"'
            },
            suffix: {
              row: 5,
              col: 6,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 4,
                text: '", line 5, col 6'
              }
            }
          }
        ]
      );
    });
    test("should be smart about determining the link prefix when multiple prefix characters exist", () => {
      deepStrictEqual(
        detectLinks(`echo '"foo", line 5, col 6'`, OperatingSystem.Linux),
        [
          {
            path: {
              index: 7,
              text: "foo"
            },
            prefix: {
              index: 6,
              text: '"'
            },
            suffix: {
              row: 5,
              col: 6,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 10,
                text: '", line 5, col 6'
              }
            }
          }
        ],
        "The outer single quotes should be excluded from the link prefix and suffix"
      );
    });
    test("should detect both suffix and non-suffix links on a single line", () => {
      deepStrictEqual(
        detectLinks(`PS C:\\Github\\microsoft\\vscode> echo '"foo", line 5, col 6'`, OperatingSystem.Windows),
        [
          {
            path: {
              index: 3,
              text: "C:\\Github\\microsoft\\vscode"
            },
            prefix: void 0,
            suffix: void 0
          },
          {
            path: {
              index: 38,
              text: "foo"
            },
            prefix: {
              index: 37,
              text: '"'
            },
            suffix: {
              row: 5,
              col: 6,
              rowEnd: void 0,
              colEnd: void 0,
              suffix: {
                index: 41,
                text: '", line 5, col 6'
              }
            }
          }
        ]
      );
    });
    suite('"|"', () => {
      test("should exclude pipe characters from link paths", () => {
        deepStrictEqual(
          detectLinks("|C:\\Github\\microsoft\\vscode|", OperatingSystem.Windows),
          [
            {
              path: {
                index: 1,
                text: "C:\\Github\\microsoft\\vscode"
              },
              prefix: void 0,
              suffix: void 0
            }
          ]
        );
      });
      test("should exclude pipe characters from link paths with suffixes", () => {
        deepStrictEqual(
          detectLinks("|C:\\Github\\microsoft\\vscode:400|", OperatingSystem.Windows),
          [
            {
              path: {
                index: 1,
                text: "C:\\Github\\microsoft\\vscode"
              },
              prefix: void 0,
              suffix: {
                col: void 0,
                row: 400,
                rowEnd: void 0,
                colEnd: void 0,
                suffix: {
                  index: 27,
                  text: ":400"
                }
              }
            }
          ]
        );
      });
    });
    suite('"<>"', () => {
      for (const os of operatingSystems) {
        test(`should exclude bracket characters from link paths ${osLabel[os]}`, () => {
          deepStrictEqual(
            detectLinks(`<${osTestPath[os]}<`, os),
            [
              {
                path: {
                  index: 1,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: void 0
              }
            ]
          );
          deepStrictEqual(
            detectLinks(`>${osTestPath[os]}>`, os),
            [
              {
                path: {
                  index: 1,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: void 0
              }
            ]
          );
        });
        test(`should exclude bracket characters from link paths with suffixes ${osLabel[os]}`, () => {
          deepStrictEqual(
            detectLinks(`<${osTestPath[os]}:400<`, os),
            [
              {
                path: {
                  index: 1,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: {
                  col: void 0,
                  row: 400,
                  rowEnd: void 0,
                  colEnd: void 0,
                  suffix: {
                    index: 1 + osTestPath[os].length,
                    text: ":400"
                  }
                }
              }
            ]
          );
          deepStrictEqual(
            detectLinks(`>${osTestPath[os]}:400>`, os),
            [
              {
                path: {
                  index: 1,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: {
                  col: void 0,
                  row: 400,
                  rowEnd: void 0,
                  colEnd: void 0,
                  suffix: {
                    index: 1 + osTestPath[os].length,
                    text: ":400"
                  }
                }
              }
            ]
          );
        });
      }
    });
    suite("query strings", () => {
      for (const os of operatingSystems) {
        test(`should exclude query strings from link paths ${osLabel[os]}`, () => {
          deepStrictEqual(
            detectLinks(`${osTestPath[os]}?a=b`, os),
            [
              {
                path: {
                  index: 0,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: void 0
              }
            ]
          );
          deepStrictEqual(
            detectLinks(`${osTestPath[os]}?a=b&c=d`, os),
            [
              {
                path: {
                  index: 0,
                  text: osTestPath[os]
                },
                prefix: void 0,
                suffix: void 0
              }
            ]
          );
        });
        test("should not detect links starting with ? within query strings that contain posix-style paths (#204195)", () => {
          strictEqual(detectLinks(`http://foo.com/?bar=/a/b&baz=c`, os).some((e) => e.path.text.startsWith("?")), false);
        });
        test("should not detect links starting with ? within query strings that contain Windows-style paths (#204195)", () => {
          strictEqual(detectLinks(`http://foo.com/?bar=a:\\b&baz=c`, os).some((e) => e.path.text.startsWith("?")), false);
        });
      }
    });
    suite("should detect file names in git diffs", () => {
      test("--- a/foo/bar", () => {
        deepStrictEqual(
          detectLinks("--- a/foo/bar", OperatingSystem.Linux),
          [
            {
              path: {
                index: 6,
                text: "foo/bar"
              },
              prefix: void 0,
              suffix: void 0
            }
          ]
        );
      });
      test("+++ b/foo/bar", () => {
        deepStrictEqual(
          detectLinks("+++ b/foo/bar", OperatingSystem.Linux),
          [
            {
              path: {
                index: 6,
                text: "foo/bar"
              },
              prefix: void 0,
              suffix: void 0
            }
          ]
        );
      });
      test("diff --git a/foo/bar b/foo/baz", () => {
        deepStrictEqual(
          detectLinks("diff --git a/foo/bar b/foo/baz", OperatingSystem.Linux),
          [
            {
              path: {
                index: 13,
                text: "foo/bar"
              },
              prefix: void 0,
              suffix: void 0
            },
            {
              path: {
                index: 23,
                text: "foo/baz"
              },
              prefix: void 0,
              suffix: void 0
            }
          ]
        );
      });
    });
    suite("should detect 3 suffix links on a single line", () => {
      for (let i = 0; i < testLinksWithSuffix.length - 2; i++) {
        const link1 = testLinksWithSuffix[i];
        const link2 = testLinksWithSuffix[i + 1];
        const link3 = testLinksWithSuffix[i + 2];
        const line = ` ${link1.link} ${link2.link} ${link3.link} `;
        test("`" + line.replaceAll("\xA0", "<nbsp>") + "`", () => {
          strictEqual(detectLinks(line, OperatingSystem.Linux).length, 3);
          ok(link1.suffix);
          ok(link2.suffix);
          ok(link3.suffix);
          const detectedLink1 = {
            prefix: link1.prefix ? {
              index: 1,
              text: link1.prefix
            } : void 0,
            path: {
              index: 1 + (link1.prefix?.length ?? 0),
              text: link1.link.replace(link1.suffix, "").replace(link1.prefix || "", "")
            },
            suffix: {
              row: link1.hasRow ? testRow : void 0,
              col: link1.hasCol ? testCol : void 0,
              rowEnd: link1.hasRowEnd ? testRowEnd : void 0,
              colEnd: link1.hasColEnd ? testColEnd : void 0,
              suffix: {
                index: 1 + (link1.link.length - link1.suffix.length),
                text: link1.suffix
              }
            }
          };
          const detectedLink2 = {
            prefix: link2.prefix ? {
              index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1,
              text: link2.prefix
            } : void 0,
            path: {
              index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1 + (link2.prefix ?? "").length,
              text: link2.link.replace(link2.suffix, "").replace(link2.prefix ?? "", "")
            },
            suffix: {
              row: link2.hasRow ? testRow : void 0,
              col: link2.hasCol ? testCol : void 0,
              rowEnd: link2.hasRowEnd ? testRowEnd : void 0,
              colEnd: link2.hasColEnd ? testColEnd : void 0,
              suffix: {
                index: (detectedLink1.prefix?.index ?? detectedLink1.path.index) + link1.link.length + 1 + (link2.link.length - link2.suffix.length),
                text: link2.suffix
              }
            }
          };
          const detectedLink3 = {
            prefix: link3.prefix ? {
              index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1,
              text: link3.prefix
            } : void 0,
            path: {
              index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1 + (link3.prefix ?? "").length,
              text: link3.link.replace(link3.suffix, "").replace(link3.prefix ?? "", "")
            },
            suffix: {
              row: link3.hasRow ? testRow : void 0,
              col: link3.hasCol ? testCol : void 0,
              rowEnd: link3.hasRowEnd ? testRowEnd : void 0,
              colEnd: link3.hasColEnd ? testColEnd : void 0,
              suffix: {
                index: (detectedLink2.prefix?.index ?? detectedLink2.path.index) + link2.link.length + 1 + (link3.link.length - link3.suffix.length),
                text: link3.suffix
              }
            }
          };
          deepStrictEqual(
            detectLinks(line, OperatingSystem.Linux),
            [detectedLink1, detectedLink2, detectedLink3]
          );
        });
      }
    });
    suite("should ignore links with suffixes when the path itself is the empty string", () => {
      deepStrictEqual(
        detectLinks('""",1', OperatingSystem.Linux),
        []
      );
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvbGlua3MvdGVzdC9icm93c2VyL3Rlcm1pbmFsTGlua1BhcnNpbmcudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGRlZXBTdHJpY3RFcXVhbCwgb2ssIHN0cmljdEVxdWFsIH0gZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgZGV0ZWN0TGlua3MsIGRldGVjdExpbmtTdWZmaXhlcywgZ2V0TGlua1N1ZmZpeCwgSVBhcnNlZExpbmssIHJlbW92ZUxpbmtRdWVyeVN0cmluZywgcmVtb3ZlTGlua1N1ZmZpeCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxMaW5rUGFyc2luZy5qcyc7XG5cbmludGVyZmFjZSBJVGVzdExpbmsge1xuXHRsaW5rOiBzdHJpbmc7XG5cdHByZWZpeDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRzdWZmaXg6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Ly8gVE9ETzogVGhlc2UgaGFzIHZhcnMgd291bGQgYmUgbmljZXIgYXMgYSBmbGFncyBlbnVtXG5cdGhhc1JvdzogYm9vbGVhbjtcblx0aGFzQ29sOiBib29sZWFuO1xuXHRoYXNSb3dFbmQ/OiBib29sZWFuO1xuXHRoYXNDb2xFbmQ/OiBib29sZWFuO1xufVxuXG5jb25zdCBvcGVyYXRpbmdTeXN0ZW1zOiBSZWFkb25seUFycmF5PE9wZXJhdGluZ1N5c3RlbT4gPSBbXG5cdE9wZXJhdGluZ1N5c3RlbS5MaW51eCxcblx0T3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaCxcblx0T3BlcmF0aW5nU3lzdGVtLldpbmRvd3Ncbl07XG5jb25zdCBvc1Rlc3RQYXRoOiB7IFtrZXk6IG51bWJlciB8IE9wZXJhdGluZ1N5c3RlbV06IHN0cmluZyB9ID0ge1xuXHRbT3BlcmF0aW5nU3lzdGVtLkxpbnV4XTogJy90ZXN0L3BhdGgvbGludXgnLFxuXHRbT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaF06ICcvdGVzdC9wYXRoL21hY2ludG9zaCcsXG5cdFtPcGVyYXRpbmdTeXN0ZW0uV2luZG93c106ICdDOlxcXFx0ZXN0XFxcXHBhdGhcXFxcd2luZG93cydcbn07XG5jb25zdCBvc0xhYmVsOiB7IFtrZXk6IG51bWJlciB8IE9wZXJhdGluZ1N5c3RlbV06IHN0cmluZyB9ID0ge1xuXHRbT3BlcmF0aW5nU3lzdGVtLkxpbnV4XTogJ1tMaW51eF0nLFxuXHRbT3BlcmF0aW5nU3lzdGVtLk1hY2ludG9zaF06ICdbbWFjT1NdJyxcblx0W09wZXJhdGluZ1N5c3RlbS5XaW5kb3dzXTogJ1tXaW5kb3dzXSdcbn07XG5cbmNvbnN0IHRlc3RSb3cgPSAzMzk7XG5jb25zdCB0ZXN0Q29sID0gMTI7XG5jb25zdCB0ZXN0Um93RW5kID0gMzQxO1xuY29uc3QgdGVzdENvbEVuZCA9IDc4OTtcbmNvbnN0IHRlc3RMaW5rczogSVRlc3RMaW5rW10gPSBbXG5cdC8vIFNpbXBsZVxuXHR7IGxpbms6ICdmb28nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiB1bmRlZmluZWQsIGhhc1JvdzogZmFsc2UsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vOjMzOScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICc6MzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbzozMzk6MTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnOjMzOToxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbzozMzk6MTItNzg5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzozMzk6MTItNzg5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUsIGhhc1Jvd0VuZDogZmFsc2UsIGhhc0NvbEVuZDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb286MzM5LjEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzozMzkuMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb286MzM5LjEyLTc4OScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICc6MzM5LjEyLTc4OScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlLCBoYXNSb3dFbmQ6IGZhbHNlLCBoYXNDb2xFbmQ6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vOjMzOS4xMi0zNDEuNzg5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzozMzkuMTItMzQxLjc4OScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlLCBoYXNSb3dFbmQ6IHRydWUsIGhhc0NvbEVuZDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28jMzM5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyMzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vIzMzOToxMicsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcjMzM5OjEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIzMzOToxMi03ODknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIzMzOToxMi03ODknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSwgaGFzUm93RW5kOiBmYWxzZSwgaGFzQ29sRW5kOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbyMzMzkuMTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIzMzOS4xMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbyMzMzkuMTItNzg5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyMzMzkuMTItNzg5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUsIGhhc1Jvd0VuZDogZmFsc2UsIGhhc0NvbEVuZDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28jMzM5LjEyLTM0MS43ODknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIzMzOS4xMi0zNDEuNzg5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUsIGhhc1Jvd0VuZDogdHJ1ZSwgaGFzQ29sRW5kOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbyAzMzknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdmb28gMzM5OjEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyAzMzk6MTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gMzM5OjEyLTc4OScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcgMzM5OjEyLTc4OScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlLCBoYXNSb3dFbmQ6IGZhbHNlLCBoYXNDb2xFbmQ6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIDMzOS4xMicsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcgMzM5LjEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIDMzOS4xMi03ODknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIDMzOS4xMi03ODknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSwgaGFzUm93RW5kOiBmYWxzZSwgaGFzQ29sRW5kOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbyAzMzkuMTItMzQxLjc4OScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcgMzM5LjEyLTM0MS43ODknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSwgaGFzUm93RW5kOiB0cnVlLCBoYXNDb2xFbmQ6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vLCAzMzknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnLCAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblxuXHQvLyBEb3VibGUgcXVvdGVzXG5cdHsgbGluazogJ1wiZm9vXCIsMzM5JywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIiwzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnXCJmb29cIiwzMzk6MTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiLDMzOToxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1wiZm9vXCIsMzM5LjEyJywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIiwzMzkuMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiLCBsaW5lIDMzOScsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIsIGxpbmUgMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ1wiZm9vXCIsIGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiLCBsaW5lIDMzOSwgY29sIDEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnXCJmb29cIiwgbGluZSAzMzksIGNvbHVtbiAxMicsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIsIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiOmxpbmUgMzM5JywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIjpsaW5lIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiOmxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiOmxpbmUgMzM5LCBjb2wgMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiOmxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiOmxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiOiBsaW5lIDMzOScsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCI6IGxpbmUgMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ1wiZm9vXCI6IGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiOiBsaW5lIDMzOSwgY29sIDEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnXCJmb29cIjogbGluZSAzMzksIGNvbHVtbiAxMicsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCI6IGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiIG9uIGxpbmUgMzM5JywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIiBvbiBsaW5lIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiIG9uIGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiIG9uIGxpbmUgMzM5LCBjb2wgMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiIG9uIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6ICdcIicsIHN1ZmZpeDogJ1wiIG9uIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiIGxpbmUgMzM5JywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIiBsaW5lIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiIGxpbmUgMzM5IGNvbHVtbiAxMicsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIgbGluZSAzMzkgY29sdW1uIDEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblxuXHQvLyBTaW5nbGUgcXVvdGVzXG5cdHsgbGluazogJ1xcJ2Zvb1xcJywzMzknLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcsMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ1xcJ2Zvb1xcJywzMzk6MTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcsMzM5OjEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnXFwnZm9vXFwnLDMzOS4xMicsIHByZWZpeDogJ1xcJycsIHN1ZmZpeDogJ1xcJywzMzkuMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCcsIGxpbmUgMzM5JywgcHJlZml4OiAnXFwnJywgc3VmZml4OiAnXFwnLCBsaW5lIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCcsIGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcsIGxpbmUgMzM5LCBjb2wgMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCcsIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcsIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCc6bGluZSAzMzknLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCc6bGluZSAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnXFwnZm9vXFwnOmxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCc6bGluZSAzMzksIGNvbCAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1xcJ2Zvb1xcJzpsaW5lIDMzOSwgY29sdW1uIDEyJywgcHJlZml4OiAnXFwnJywgc3VmZml4OiAnXFwnOmxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCc6IGxpbmUgMzM5JywgcHJlZml4OiAnXFwnJywgc3VmZml4OiAnXFwnOiBsaW5lIDMzOScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCc6IGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCc6IGxpbmUgMzM5LCBjb2wgMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCc6IGxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCc6IGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCcgb24gbGluZSAzMzknLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcgb24gbGluZSAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnXFwnZm9vXFwnIG9uIGxpbmUgMzM5LCBjb2wgMTInLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcgb24gbGluZSAzMzksIGNvbCAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1xcJ2Zvb1xcJyBvbiBsaW5lIDMzOSwgY29sdW1uIDEyJywgcHJlZml4OiAnXFwnJywgc3VmZml4OiAnXFwnIG9uIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcXCdmb29cXCcgbGluZSAzMzknLCBwcmVmaXg6ICdcXCcnLCBzdWZmaXg6ICdcXCcgbGluZSAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnXFwnZm9vXFwnIGxpbmUgMzM5IGNvbHVtbiAxMicsIHByZWZpeDogJ1xcJycsIHN1ZmZpeDogJ1xcJyBsaW5lIDMzOSBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXG5cdC8vIE5vIHF1b3Rlc1xuXHR7IGxpbms6ICdmb28sIGxpbmUgMzM5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJywgbGluZSAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vLCBsaW5lIDMzOSwgY29sIDEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJywgbGluZSAzMzksIGNvbCAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbywgbGluZSAzMzksIGNvbHVtbiAxMicsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcsIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb286bGluZSAzMzknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnOmxpbmUgMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbzpsaW5lIDMzOSwgY29sIDEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzpsaW5lIDMzOSwgY29sIDEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vOmxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnOmxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb286IGxpbmUgMzM5JywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzogbGluZSAzMzknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vOiBsaW5lIDMzOSwgY29sIDEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzogbGluZSAzMzksIGNvbCAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbzogbGluZSAzMzksIGNvbHVtbiAxMicsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICc6IGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gb24gbGluZSAzMzknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIG9uIGxpbmUgMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbyBvbiBsaW5lIDMzOSwgY29sIDEyJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyBvbiBsaW5lIDMzOSwgY29sIDEyJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIG9uIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIG9uIGxpbmUgMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gbGluZSAzMzknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIGxpbmUgMzM5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbyBsaW5lIDMzOSBjb2x1bW4gMTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIGxpbmUgMzM5IGNvbHVtbiAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cblx0Ly8gUGFyZW50aGVzZXNcblx0eyBsaW5rOiAnZm9vKDMzOSknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnKDMzOSknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vKDMzOSwxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnKDMzOSwxMiknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28oMzM5LCAxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnKDMzOSwgMTIpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vICgzMzkpJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyAoMzM5KScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdmb28gKDMzOSwxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnICgzMzksMTIpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vICgzMzksIDEyKScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcgKDMzOSwgMTIpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vOiAoMzM5KScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICc6ICgzMzkpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbzogKDMzOSwxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnOiAoMzM5LDEyKScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbzogKDMzOSwgMTIpJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzogKDMzOSwgMTIpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vKDMzOToxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnKDMzOToxMiknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gKDMzOToxMiknLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnICgzMzk6MTIpJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblxuXHQvLyBTcXVhcmUgYnJhY2tldHNcblx0eyBsaW5rOiAnZm9vWzMzOV0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnWzMzOV0nLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UgfSxcblx0eyBsaW5rOiAnZm9vWzMzOSwxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnWzMzOSwxMl0nLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb29bMzM5LCAxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnWzMzOSwgMTJdJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIFszMzldJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyBbMzM5XScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiBmYWxzZSB9LFxuXHR7IGxpbms6ICdmb28gWzMzOSwxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIFszMzksMTJdJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vIFszMzksIDEyXScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICcgWzMzOSwgMTJdJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vOiBbMzM5XScsIHByZWZpeDogdW5kZWZpbmVkLCBzdWZmaXg6ICc6IFszMzldJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IGZhbHNlIH0sXG5cdHsgbGluazogJ2ZvbzogWzMzOSwxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnOiBbMzM5LDEyXScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ2ZvbzogWzMzOSwgMTJdJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJzogWzMzOSwgMTJdJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblx0eyBsaW5rOiAnZm9vWzMzOToxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnWzMzOToxMl0nLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gWzMzOToxMl0nLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnIFszMzk6MTJdJywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUgfSxcblxuXHQvLyBPQ2FtbC1zdHlsZVxuXHR7IGxpbms6ICdcImZvb1wiLCBsaW5lIDMzOSwgY2hhcmFjdGVyIDEyJywgcHJlZml4OiAnXCInLCBzdWZmaXg6ICdcIiwgbGluZSAzMzksIGNoYXJhY3RlciAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1wiZm9vXCIsIGxpbmUgMzM5LCBjaGFyYWN0ZXJzIDEyLTc4OScsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIsIGxpbmUgMzM5LCBjaGFyYWN0ZXJzIDEyLTc4OScsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlLCBoYXNDb2xFbmQ6IHRydWUgfSxcblx0eyBsaW5rOiAnXCJmb29cIiwgbGluZXMgMzM5LTM0MScsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIsIGxpbmVzIDMzOS0zNDEnLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogZmFsc2UsIGhhc1Jvd0VuZDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdcImZvb1wiLCBsaW5lcyAzMzktMzQxLCBjaGFyYWN0ZXJzIDEyLTc4OScsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIsIGxpbmVzIDMzOS0zNDEsIGNoYXJhY3RlcnMgMTItNzg5JywgaGFzUm93OiB0cnVlLCBoYXNDb2w6IHRydWUsIGhhc1Jvd0VuZDogdHJ1ZSwgaGFzQ29sRW5kOiB0cnVlIH0sXG5cblx0Ly8gTm9uLWJyZWFraW5nIHNwYWNlXG5cdHsgbGluazogJ2Zvb1xcdTAwQTAzMzk6MTInLCBwcmVmaXg6IHVuZGVmaW5lZCwgc3VmZml4OiAnXFx1MDBBMDMzOToxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1wiZm9vXCIgb24gbGluZSAzMzksXFx1MDBBMGNvbHVtbiAxMicsIHByZWZpeDogJ1wiJywgc3VmZml4OiAnXCIgb24gbGluZSAzMzksXFx1MDBBMGNvbHVtbiAxMicsIGhhc1JvdzogdHJ1ZSwgaGFzQ29sOiB0cnVlIH0sXG5cdHsgbGluazogJ1xcJ2Zvb1xcJyBvbiBsaW5lXFx1MDBBMDMzOSwgY29sdW1uIDEyJywgcHJlZml4OiAnXFwnJywgc3VmZml4OiAnXFwnIG9uIGxpbmVcXHUwMEEwMzM5LCBjb2x1bW4gMTInLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb28gKDMzOSxcXHUwMEEwMTIpJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJyAoMzM5LFxcdTAwQTAxMiknLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXHR7IGxpbms6ICdmb29cXHUwMEEwWzMzOSwgMTJdJywgcHJlZml4OiB1bmRlZmluZWQsIHN1ZmZpeDogJ1xcdTAwQTBbMzM5LCAxMl0nLCBoYXNSb3c6IHRydWUsIGhhc0NvbDogdHJ1ZSB9LFxuXTtcbmNvbnN0IHRlc3RMaW5rc1dpdGhTdWZmaXggPSB0ZXN0TGlua3MuZmlsdGVyKGUgPT4gISFlLnN1ZmZpeCk7XG5cbnN1aXRlKCdUZXJtaW5hbExpbmtQYXJzaW5nJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzdWl0ZSgncmVtb3ZlTGlua1N1ZmZpeCcsICgpID0+IHtcblx0XHRmb3IgKGNvbnN0IHRlc3RMaW5rIG9mIHRlc3RMaW5rcykge1xuXHRcdFx0dGVzdCgnYCcgKyB0ZXN0TGluay5saW5rICsgJ2AnLCAoKSA9PiB7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRyZW1vdmVMaW5rU3VmZml4KHRlc3RMaW5rLmxpbmspLFxuXHRcdFx0XHRcdHRlc3RMaW5rLnN1ZmZpeCA9PT0gdW5kZWZpbmVkID8gdGVzdExpbmsubGluayA6IHRlc3RMaW5rLmxpbmsucmVwbGFjZSh0ZXN0TGluay5zdWZmaXgsICcnKVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblx0c3VpdGUoJ2dldExpbmtTdWZmaXgnLCAoKSA9PiB7XG5cdFx0Zm9yIChjb25zdCB0ZXN0TGluayBvZiB0ZXN0TGlua3MpIHtcblx0XHRcdHRlc3QoJ2AnICsgdGVzdExpbmsubGluayArICdgJywgKCkgPT4ge1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0Z2V0TGlua1N1ZmZpeCh0ZXN0TGluay5saW5rKSxcblx0XHRcdFx0XHR0ZXN0TGluay5zdWZmaXggPT09IHVuZGVmaW5lZCA/IG51bGwgOiB7XG5cdFx0XHRcdFx0XHRyb3c6IHRlc3RMaW5rLmhhc1JvdyA/IHRlc3RSb3cgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb2w6IHRlc3RMaW5rLmhhc0NvbCA/IHRlc3RDb2wgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRyb3dFbmQ6IHRlc3RMaW5rLmhhc1Jvd0VuZCA/IHRlc3RSb3dFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb2xFbmQ6IHRlc3RMaW5rLmhhc0NvbEVuZCA/IHRlc3RDb2xFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IHRlc3RMaW5rLmxpbmsubGVuZ3RoIC0gdGVzdExpbmsuc3VmZml4Lmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0dGV4dDogdGVzdExpbmsuc3VmZml4XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBhcyBSZXR1cm5UeXBlPHR5cGVvZiBnZXRMaW5rU3VmZml4PlxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9KTtcblx0c3VpdGUoJ2RldGVjdExpbmtTdWZmaXhlcycsICgpID0+IHtcblx0XHRmb3IgKGNvbnN0IHRlc3RMaW5rIG9mIHRlc3RMaW5rcykge1xuXHRcdFx0dGVzdCgnYCcgKyB0ZXN0TGluay5saW5rICsgJ2AnLCAoKSA9PiB7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRkZXRlY3RMaW5rU3VmZml4ZXModGVzdExpbmsubGluayksXG5cdFx0XHRcdFx0dGVzdExpbmsuc3VmZml4ID09PSB1bmRlZmluZWQgPyBbXSA6IFt7XG5cdFx0XHRcdFx0XHRyb3c6IHRlc3RMaW5rLmhhc1JvdyA/IHRlc3RSb3cgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb2w6IHRlc3RMaW5rLmhhc0NvbCA/IHRlc3RDb2wgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRyb3dFbmQ6IHRlc3RMaW5rLmhhc1Jvd0VuZCA/IHRlc3RSb3dFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb2xFbmQ6IHRlc3RMaW5rLmhhc0NvbEVuZCA/IHRlc3RDb2xFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IHRlc3RMaW5rLmxpbmsubGVuZ3RoIC0gdGVzdExpbmsuc3VmZml4Lmxlbmd0aCxcblx0XHRcdFx0XHRcdFx0dGV4dDogdGVzdExpbmsuc3VmZml4XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBhcyBSZXR1cm5UeXBlPHR5cGVvZiBnZXRMaW5rU3VmZml4Pl1cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHRlc3QoJ2ZvbygxLCAyKSBiYXJbMywgNF0gYmF6IG9uIGxpbmUgNScsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0ZGV0ZWN0TGlua1N1ZmZpeGVzKCdmb28oMSwgMikgYmFyWzMsIDRdIGJheiBvbiBsaW5lIDUnKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGNvbDogMixcblx0XHRcdFx0XHRcdHJvdzogMSxcblx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0Y29sRW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDMsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICcoMSwgMiknXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRjb2w6IDQsXG5cdFx0XHRcdFx0XHRyb3c6IDMsXG5cdFx0XHRcdFx0XHRyb3dFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdGluZGV4OiAxMyxcblx0XHRcdFx0XHRcdFx0dGV4dDogJ1szLCA0XSdcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGNvbDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cm93OiA1LFxuXHRcdFx0XHRcdFx0cm93RW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRjb2xFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogMjMsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICcgb24gbGluZSA1J1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cdHN1aXRlKCdyZW1vdmVMaW5rUXVlcnlTdHJpbmcnLCAoKSA9PiB7XG5cdFx0dGVzdCgnc2hvdWxkIHJlbW92ZSBhbnkgcXVlcnkgc3RyaW5nIGZyb20gdGhlIGxpbmsnLCAoKSA9PiB7XG5cdFx0XHRzdHJpY3RFcXVhbChyZW1vdmVMaW5rUXVlcnlTdHJpbmcoJz9hPWInKSwgJycpO1xuXHRcdFx0c3RyaWN0RXF1YWwocmVtb3ZlTGlua1F1ZXJ5U3RyaW5nKCdmb28/YT1iJyksICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKHJlbW92ZUxpbmtRdWVyeVN0cmluZygnLi9mb28/YT1iJyksICcuL2ZvbycpO1xuXHRcdFx0c3RyaWN0RXF1YWwocmVtb3ZlTGlua1F1ZXJ5U3RyaW5nKCcvZm9vL2Jhcj9hPWInKSwgJy9mb28vYmFyJyk7XG5cdFx0XHRzdHJpY3RFcXVhbChyZW1vdmVMaW5rUXVlcnlTdHJpbmcoJ2Zvbz9hPWI/JyksICdmb28nKTtcblx0XHRcdHN0cmljdEVxdWFsKHJlbW92ZUxpbmtRdWVyeVN0cmluZygnZm9vP2E9YiZjPWQnKSwgJ2ZvbycpO1xuXHRcdH0pO1xuXHRcdHRlc3QoJ3Nob3VsZCByZXNwZWN0ID8gaW4gVU5DIHBhdGhzJywgKCkgPT4ge1xuXHRcdFx0c3RyaWN0RXF1YWwocmVtb3ZlTGlua1F1ZXJ5U3RyaW5nKCdcXFxcXFxcXD9cXFxcZm9vP2E9YicpLCAnXFxcXFxcXFw/XFxcXGZvbycpO1xuXHRcdH0pO1xuXHR9KTtcblx0c3VpdGUoJ2RldGVjdExpbmtzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ2ZvbygxLCAyKSBiYXJbMywgNF0gXCJiYXpcIiBvbiBsaW5lIDUnLCAoKSA9PiB7XG5cdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdGRldGVjdExpbmtzKCdmb28oMSwgMikgYmFyWzMsIDRdIFwiYmF6XCIgb24gbGluZSA1JywgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdmb28nXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0Y29sOiAyLFxuXHRcdFx0XHRcdFx0XHRyb3c6IDEsXG5cdFx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRjb2xFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDMsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJygxLCAyKSdcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogMTAsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdiYXInXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0Y29sOiA0LFxuXHRcdFx0XHRcdFx0XHRyb3c6IDMsXG5cdFx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRjb2xFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDEzLFxuXHRcdFx0XHRcdFx0XHRcdHRleHQ6ICdbMywgNF0nXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDIxLFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiAnYmF6J1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHByZWZpeDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogMjAsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdcIidcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0Y29sOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHJvdzogNSxcblx0XHRcdFx0XHRcdFx0cm93RW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogMjQsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ1wiIG9uIGxpbmUgNSdcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGV4dHJhY3QgdGhlIGxpbmsgcHJlZml4JywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRkZXRlY3RMaW5rcygnXCJmb29cIiwgbGluZSA1LCBjb2wgNicsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiAnZm9vJ1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHByZWZpeDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdFx0dGV4dDogJ1wiJyxcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0cm93OiA1LFxuXHRcdFx0XHRcdFx0XHRjb2w6IDYsXG5cdFx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRjb2xFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDQsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ1wiLCBsaW5lIDUsIGNvbCA2J1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGJlIHNtYXJ0IGFib3V0IGRldGVybWluaW5nIHRoZSBsaW5rIHByZWZpeCB3aGVuIG11bHRpcGxlIHByZWZpeCBjaGFyYWN0ZXJzIGV4aXN0JywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRkZXRlY3RMaW5rcygnZWNobyBcXCdcImZvb1wiLCBsaW5lIDUsIGNvbCA2XFwnJywgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDcsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdmb28nXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0cHJlZml4OiB7XG5cdFx0XHRcdFx0XHRcdGluZGV4OiA2LFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiAnXCInLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRyb3c6IDUsXG5cdFx0XHRcdFx0XHRcdGNvbDogNixcblx0XHRcdFx0XHRcdFx0cm93RW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogMTAsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ1wiLCBsaW5lIDUsIGNvbCA2J1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdLFxuXHRcdFx0XHQnVGhlIG91dGVyIHNpbmdsZSBxdW90ZXMgc2hvdWxkIGJlIGV4Y2x1ZGVkIGZyb20gdGhlIGxpbmsgcHJlZml4IGFuZCBzdWZmaXgnXG5cdFx0XHQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGRldGVjdCBib3RoIHN1ZmZpeCBhbmQgbm9uLXN1ZmZpeCBsaW5rcyBvbiBhIHNpbmdsZSBsaW5lJywgKCkgPT4ge1xuXHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRkZXRlY3RMaW5rcygnUFMgQzpcXFxcR2l0aHViXFxcXG1pY3Jvc29mdFxcXFx2c2NvZGU+IGVjaG8gXFwnXCJmb29cIiwgbGluZSA1LCBjb2wgNlxcJycsIE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDMsXG5cdFx0XHRcdFx0XHRcdHRleHQ6ICdDOlxcXFxHaXRodWJcXFxcbWljcm9zb2Z0XFxcXHZzY29kZSdcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRwcmVmaXg6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHN1ZmZpeDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdGluZGV4OiAzOCxcblx0XHRcdFx0XHRcdFx0dGV4dDogJ2Zvbydcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRwcmVmaXg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDM3LFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiAnXCInLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRyb3c6IDUsXG5cdFx0XHRcdFx0XHRcdGNvbDogNixcblx0XHRcdFx0XHRcdFx0cm93RW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogNDEsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ1wiLCBsaW5lIDUsIGNvbCA2J1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdIGFzIElQYXJzZWRMaW5rW11cblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHRzdWl0ZSgnXCJ8XCInLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgZXhjbHVkZSBwaXBlIGNoYXJhY3RlcnMgZnJvbSBsaW5rIHBhdGhzJywgKCkgPT4ge1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0ZGV0ZWN0TGlua3MoJ3xDOlxcXFxHaXRodWJcXFxcbWljcm9zb2Z0XFxcXHZzY29kZXwnLCBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ0M6XFxcXEdpdGh1YlxcXFxtaWNyb3NvZnRcXFxcdnNjb2RlJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRwcmVmaXg6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0c3VmZml4OiB1bmRlZmluZWRcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdIGFzIElQYXJzZWRMaW5rW11cblx0XHRcdFx0KTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIGV4Y2x1ZGUgcGlwZSBjaGFyYWN0ZXJzIGZyb20gbGluayBwYXRocyB3aXRoIHN1ZmZpeGVzJywgKCkgPT4ge1xuXHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0ZGV0ZWN0TGlua3MoJ3xDOlxcXFxHaXRodWJcXFxcbWljcm9zb2Z0XFxcXHZzY29kZTo0MDB8JywgT3BlcmF0aW5nU3lzdGVtLldpbmRvd3MpLFxuXHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdFx0XHRcdHRleHQ6ICdDOlxcXFxHaXRodWJcXFxcbWljcm9zb2Z0XFxcXHZzY29kZSdcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRcdGNvbDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHJvdzogNDAwLFxuXHRcdFx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDI3LFxuXHRcdFx0XHRcdFx0XHRcdFx0dGV4dDogJzo0MDAnXG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdcIjw+XCInLCAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IG9zIG9mIG9wZXJhdGluZ1N5c3RlbXMpIHtcblx0XHRcdFx0dGVzdChgc2hvdWxkIGV4Y2x1ZGUgYnJhY2tldCBjaGFyYWN0ZXJzIGZyb20gbGluayBwYXRocyAke29zTGFiZWxbb3NdfWAsICgpID0+IHtcblx0XHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0XHRkZXRlY3RMaW5rcyhgPCR7b3NUZXN0UGF0aFtvc119PGAsIG9zKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGV4dDogb3NUZXN0UGF0aFtvc11cblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHByZWZpeDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHN1ZmZpeDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF0gYXMgSVBhcnNlZExpbmtbXVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZGV0ZWN0TGlua3MoYD4ke29zVGVzdFBhdGhbb3NdfT5gLCBvcyksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpbmRleDogMSxcblx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6IG9zVGVzdFBhdGhbb3NdXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRwcmVmaXg6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRzdWZmaXg6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdIGFzIElQYXJzZWRMaW5rW11cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdChgc2hvdWxkIGV4Y2x1ZGUgYnJhY2tldCBjaGFyYWN0ZXJzIGZyb20gbGluayBwYXRocyB3aXRoIHN1ZmZpeGVzICR7b3NMYWJlbFtvc119YCwgKCkgPT4ge1xuXHRcdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRcdGRldGVjdExpbmtzKGA8JHtvc1Rlc3RQYXRoW29zXX06NDAwPGAsIG9zKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGluZGV4OiAxLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGV4dDogb3NUZXN0UGF0aFtvc11cblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHByZWZpeDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0Y29sOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRyb3c6IDQwMCxcblx0XHRcdFx0XHRcdFx0XHRcdHJvd0VuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29sRW5kOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDEgKyBvc1Rlc3RQYXRoW29zXS5sZW5ndGgsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6ICc6NDAwJ1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRkZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0XHRkZXRlY3RMaW5rcyhgPiR7b3NUZXN0UGF0aFtvc119OjQwMD5gLCBvcyksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpbmRleDogMSxcblx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6IG9zVGVzdFBhdGhbb3NdXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRwcmVmaXg6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRzdWZmaXg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGNvbDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdFx0cm93OiA0MDAsXG5cdFx0XHRcdFx0XHRcdFx0XHRyb3dFbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRcdGNvbEVuZDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGluZGV4OiAxICsgb3NUZXN0UGF0aFtvc10ubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHR0ZXh0OiAnOjQwMCdcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF0gYXMgSVBhcnNlZExpbmtbXVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0c3VpdGUoJ3F1ZXJ5IHN0cmluZ3MnLCAoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IG9zIG9mIG9wZXJhdGluZ1N5c3RlbXMpIHtcblx0XHRcdFx0dGVzdChgc2hvdWxkIGV4Y2x1ZGUgcXVlcnkgc3RyaW5ncyBmcm9tIGxpbmsgcGF0aHMgJHtvc0xhYmVsW29zXX1gLCAoKSA9PiB7XG5cdFx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZGV0ZWN0TGlua3MoYCR7b3NUZXN0UGF0aFtvc119P2E9YmAsIG9zKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRcdFx0XHRcdFx0dGV4dDogb3NUZXN0UGF0aFtvc11cblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdHByZWZpeDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRcdHN1ZmZpeDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdF0gYXMgSVBhcnNlZExpbmtbXVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZGV0ZWN0TGlua3MoYCR7b3NUZXN0UGF0aFtvc119P2E9YiZjPWRgLCBvcyksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRpbmRleDogMCxcblx0XHRcdFx0XHRcdFx0XHRcdHRleHQ6IG9zVGVzdFBhdGhbb3NdXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRwcmVmaXg6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0XHRzdWZmaXg6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdIGFzIElQYXJzZWRMaW5rW11cblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGVzdCgnc2hvdWxkIG5vdCBkZXRlY3QgbGlua3Mgc3RhcnRpbmcgd2l0aCA/IHdpdGhpbiBxdWVyeSBzdHJpbmdzIHRoYXQgY29udGFpbiBwb3NpeC1zdHlsZSBwYXRocyAoIzIwNDE5NSknLCAoKSA9PiB7XG5cdFx0XHRcdFx0Ly8gPyBhcHBlbmRlZCB0byB0aGUgY3dkIHdpbGwgZXhpc3Qgc2luY2UgaXQncyBqdXN0IHRoZSBjd2Rcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChkZXRlY3RMaW5rcyhgaHR0cDovL2Zvby5jb20vP2Jhcj0vYS9iJmJhej1jYCwgb3MpLnNvbWUoZSA9PiBlLnBhdGgudGV4dC5zdGFydHNXaXRoKCc/JykpLCBmYWxzZSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0ZXN0KCdzaG91bGQgbm90IGRldGVjdCBsaW5rcyBzdGFydGluZyB3aXRoID8gd2l0aGluIHF1ZXJ5IHN0cmluZ3MgdGhhdCBjb250YWluIFdpbmRvd3Mtc3R5bGUgcGF0aHMgKCMyMDQxOTUpJywgKCkgPT4ge1xuXHRcdFx0XHRcdC8vID8gYXBwZW5kZWQgdG8gdGhlIGN3ZCB3aWxsIGV4aXN0IHNpbmNlIGl0J3MganVzdCB0aGUgY3dkXG5cdFx0XHRcdFx0c3RyaWN0RXF1YWwoZGV0ZWN0TGlua3MoYGh0dHA6Ly9mb28uY29tLz9iYXI9YTpcXFxcYiZiYXo9Y2AsIG9zKS5zb21lKGUgPT4gZS5wYXRoLnRleHQuc3RhcnRzV2l0aCgnPycpKSwgZmFsc2UpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHN1aXRlKCdzaG91bGQgZGV0ZWN0IGZpbGUgbmFtZXMgaW4gZ2l0IGRpZmZzJywgKCkgPT4ge1xuXHRcdFx0dGVzdCgnLS0tIGEvZm9vL2JhcicsICgpID0+IHtcblx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdGRldGVjdExpbmtzKCctLS0gYS9mb28vYmFyJywgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogNixcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiAnZm9vL2Jhcidcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHN1ZmZpeDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJysrKyBiL2Zvby9iYXInLCAoKSA9PiB7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRkZXRlY3RMaW5rcygnKysrIGIvZm9vL2JhcicsIE9wZXJhdGluZ1N5c3RlbS5MaW51eCksXG5cdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDYsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ2Zvby9iYXInXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHByZWZpeDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRzdWZmaXg6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF0gYXMgSVBhcnNlZExpbmtbXVxuXHRcdFx0XHQpO1xuXHRcdFx0fSk7XG5cdFx0XHR0ZXN0KCdkaWZmIC0tZ2l0IGEvZm9vL2JhciBiL2Zvby9iYXonLCAoKSA9PiB7XG5cdFx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0XHRkZXRlY3RMaW5rcygnZGlmZiAtLWdpdCBhL2Zvby9iYXIgYi9mb28vYmF6JywgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0XHRpbmRleDogMTMsXG5cdFx0XHRcdFx0XHRcdFx0dGV4dDogJ2Zvby9iYXInXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHByZWZpeDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRzdWZmaXg6IHVuZGVmaW5lZFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdGluZGV4OiAyMyxcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiAnZm9vL2Jheidcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cHJlZml4OiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHN1ZmZpeDogdW5kZWZpbmVkXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XSBhcyBJUGFyc2VkTGlua1tdXG5cdFx0XHRcdCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHN1aXRlKCdzaG91bGQgZGV0ZWN0IDMgc3VmZml4IGxpbmtzIG9uIGEgc2luZ2xlIGxpbmUnLCAoKSA9PiB7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRlc3RMaW5rc1dpdGhTdWZmaXgubGVuZ3RoIC0gMjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmsxID0gdGVzdExpbmtzV2l0aFN1ZmZpeFtpXTtcblx0XHRcdFx0Y29uc3QgbGluazIgPSB0ZXN0TGlua3NXaXRoU3VmZml4W2kgKyAxXTtcblx0XHRcdFx0Y29uc3QgbGluazMgPSB0ZXN0TGlua3NXaXRoU3VmZml4W2kgKyAyXTtcblx0XHRcdFx0Y29uc3QgbGluZSA9IGAgJHtsaW5rMS5saW5rfSAke2xpbmsyLmxpbmt9ICR7bGluazMubGlua30gYDtcblx0XHRcdFx0dGVzdCgnYCcgKyBsaW5lLnJlcGxhY2VBbGwoJ1xcdTAwQTAnLCAnPG5ic3A+JykgKyAnYCcsICgpID0+IHtcblx0XHRcdFx0XHRzdHJpY3RFcXVhbChkZXRlY3RMaW5rcyhsaW5lLCBPcGVyYXRpbmdTeXN0ZW0uTGludXgpLmxlbmd0aCwgMyk7XG5cdFx0XHRcdFx0b2sobGluazEuc3VmZml4KTtcblx0XHRcdFx0XHRvayhsaW5rMi5zdWZmaXgpO1xuXHRcdFx0XHRcdG9rKGxpbmszLnN1ZmZpeCk7XG5cdFx0XHRcdFx0Y29uc3QgZGV0ZWN0ZWRMaW5rMTogSVBhcnNlZExpbmsgPSB7XG5cdFx0XHRcdFx0XHRwcmVmaXg6IGxpbmsxLnByZWZpeCA/IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDEsXG5cdFx0XHRcdFx0XHRcdHRleHQ6IGxpbmsxLnByZWZpeFxuXHRcdFx0XHRcdFx0fSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IDEgKyAobGluazEucHJlZml4Py5sZW5ndGggPz8gMCksXG5cdFx0XHRcdFx0XHRcdHRleHQ6IGxpbmsxLmxpbmsucmVwbGFjZShsaW5rMS5zdWZmaXgsICcnKS5yZXBsYWNlKGxpbmsxLnByZWZpeCB8fCAnJywgJycpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdHJvdzogbGluazEuaGFzUm93ID8gdGVzdFJvdyA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0Y29sOiBsaW5rMS5oYXNDb2wgPyB0ZXN0Q29sIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRyb3dFbmQ6IGxpbmsxLmhhc1Jvd0VuZCA/IHRlc3RSb3dFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbEVuZDogbGluazEuaGFzQ29sRW5kID8gdGVzdENvbEVuZCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0c3VmZml4OiB7XG5cdFx0XHRcdFx0XHRcdFx0aW5kZXg6IDEgKyAobGluazEubGluay5sZW5ndGggLSBsaW5rMS5zdWZmaXgubGVuZ3RoKSxcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5rMS5zdWZmaXhcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y29uc3QgZGV0ZWN0ZWRMaW5rMjogSVBhcnNlZExpbmsgPSB7XG5cdFx0XHRcdFx0XHRwcmVmaXg6IGxpbmsyLnByZWZpeCA/IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IChkZXRlY3RlZExpbmsxLnByZWZpeD8uaW5kZXggPz8gZGV0ZWN0ZWRMaW5rMS5wYXRoLmluZGV4KSArIGxpbmsxLmxpbmsubGVuZ3RoICsgMSxcblx0XHRcdFx0XHRcdFx0dGV4dDogbGluazIucHJlZml4XG5cdFx0XHRcdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogKGRldGVjdGVkTGluazEucHJlZml4Py5pbmRleCA/PyBkZXRlY3RlZExpbmsxLnBhdGguaW5kZXgpICsgbGluazEubGluay5sZW5ndGggKyAxICsgKGxpbmsyLnByZWZpeCA/PyAnJykubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5rMi5saW5rLnJlcGxhY2UobGluazIuc3VmZml4LCAnJykucmVwbGFjZShsaW5rMi5wcmVmaXggPz8gJycsICcnKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRyb3c6IGxpbmsyLmhhc1JvdyA/IHRlc3RSb3cgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbDogbGluazIuaGFzQ29sID8gdGVzdENvbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0cm93RW5kOiBsaW5rMi5oYXNSb3dFbmQgPyB0ZXN0Um93RW5kIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRjb2xFbmQ6IGxpbmsyLmhhc0NvbEVuZCA/IHRlc3RDb2xFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRcdGluZGV4OiAoZGV0ZWN0ZWRMaW5rMS5wcmVmaXg/LmluZGV4ID8/IGRldGVjdGVkTGluazEucGF0aC5pbmRleCkgKyBsaW5rMS5saW5rLmxlbmd0aCArIDEgKyAobGluazIubGluay5sZW5ndGggLSBsaW5rMi5zdWZmaXgubGVuZ3RoKSxcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5rMi5zdWZmaXhcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y29uc3QgZGV0ZWN0ZWRMaW5rMzogSVBhcnNlZExpbmsgPSB7XG5cdFx0XHRcdFx0XHRwcmVmaXg6IGxpbmszLnByZWZpeCA/IHtcblx0XHRcdFx0XHRcdFx0aW5kZXg6IChkZXRlY3RlZExpbmsyLnByZWZpeD8uaW5kZXggPz8gZGV0ZWN0ZWRMaW5rMi5wYXRoLmluZGV4KSArIGxpbmsyLmxpbmsubGVuZ3RoICsgMSxcblx0XHRcdFx0XHRcdFx0dGV4dDogbGluazMucHJlZml4XG5cdFx0XHRcdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRpbmRleDogKGRldGVjdGVkTGluazIucHJlZml4Py5pbmRleCA/PyBkZXRlY3RlZExpbmsyLnBhdGguaW5kZXgpICsgbGluazIubGluay5sZW5ndGggKyAxICsgKGxpbmszLnByZWZpeCA/PyAnJykubGVuZ3RoLFxuXHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5rMy5saW5rLnJlcGxhY2UobGluazMuc3VmZml4LCAnJykucmVwbGFjZShsaW5rMy5wcmVmaXggPz8gJycsICcnKVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRyb3c6IGxpbmszLmhhc1JvdyA/IHRlc3RSb3cgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdGNvbDogbGluazMuaGFzQ29sID8gdGVzdENvbCA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0cm93RW5kOiBsaW5rMy5oYXNSb3dFbmQgPyB0ZXN0Um93RW5kIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0XHRjb2xFbmQ6IGxpbmszLmhhc0NvbEVuZCA/IHRlc3RDb2xFbmQgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdHN1ZmZpeDoge1xuXHRcdFx0XHRcdFx0XHRcdGluZGV4OiAoZGV0ZWN0ZWRMaW5rMi5wcmVmaXg/LmluZGV4ID8/IGRldGVjdGVkTGluazIucGF0aC5pbmRleCkgKyBsaW5rMi5saW5rLmxlbmd0aCArIDEgKyAobGluazMubGluay5sZW5ndGggLSBsaW5rMy5zdWZmaXgubGVuZ3RoKSxcblx0XHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5rMy5zdWZmaXhcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0ZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdFx0ZGV0ZWN0TGlua3MobGluZSwgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0XHRcdFtkZXRlY3RlZExpbmsxLCBkZXRlY3RlZExpbmsyLCBkZXRlY3RlZExpbmszXVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHN1aXRlKCdzaG91bGQgaWdub3JlIGxpbmtzIHdpdGggc3VmZml4ZXMgd2hlbiB0aGUgcGF0aCBpdHNlbGYgaXMgdGhlIGVtcHR5IHN0cmluZycsICgpID0+IHtcblx0XHRcdGRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0ZGV0ZWN0TGlua3MoJ1wiXCJcIiwxJywgT3BlcmF0aW5nU3lzdGVtLkxpbnV4KSxcblx0XHRcdFx0W10gYXMgSVBhcnNlZExpbmtbXVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsaUJBQWlCLElBQUksbUJBQW1CO0FBQ2pELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYSxvQkFBb0IsZUFBNEIsdUJBQXVCLHdCQUF3QjtBQWFySCxNQUFNLG1CQUFtRDtBQUFBLEVBQ3hELGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUFBLEVBQ2hCLGdCQUFnQjtBQUNqQjtBQUNBLE1BQU0sYUFBMEQ7QUFBQSxFQUMvRCxDQUFDLGdCQUFnQixLQUFLLEdBQUc7QUFBQSxFQUN6QixDQUFDLGdCQUFnQixTQUFTLEdBQUc7QUFBQSxFQUM3QixDQUFDLGdCQUFnQixPQUFPLEdBQUc7QUFDNUI7QUFDQSxNQUFNLFVBQXVEO0FBQUEsRUFDNUQsQ0FBQyxnQkFBZ0IsS0FBSyxHQUFHO0FBQUEsRUFDekIsQ0FBQyxnQkFBZ0IsU0FBUyxHQUFHO0FBQUEsRUFDN0IsQ0FBQyxnQkFBZ0IsT0FBTyxHQUFHO0FBQzVCO0FBRUEsTUFBTSxVQUFVO0FBQ2hCLE1BQU0sVUFB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
