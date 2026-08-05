import assert from "assert";
import { joinPath } from "../../../../../base/common/resources.js";
import { URI } from "../../../../../base/common/uri.js";
import { fixRegexNewline, RipgrepParser, unicodeEscapesToPCRE2, fixNewline, getRgArgs, performBraceExpansionForRipgrep } from "../../node/ripgrepTextSearchEngine.js";
import { Range, TextSearchMatch2 } from "../../common/searchExtTypes.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS } from "../../common/search.js";
suite("RipgrepTextSearchEngine", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("unicodeEscapesToPCRE2", async () => {
    assert.strictEqual(unicodeEscapesToPCRE2("\\u1234"), "\\x{1234}");
    assert.strictEqual(unicodeEscapesToPCRE2("\\u1234\\u0001"), "\\x{1234}\\x{0001}");
    assert.strictEqual(unicodeEscapesToPCRE2("foo\\u1234bar"), "foo\\x{1234}bar");
    assert.strictEqual(unicodeEscapesToPCRE2("\\\\\\u1234"), "\\\\\\x{1234}");
    assert.strictEqual(unicodeEscapesToPCRE2("foo\\\\\\u1234"), "foo\\\\\\x{1234}");
    assert.strictEqual(unicodeEscapesToPCRE2("\\u{1234}"), "\\x{1234}");
    assert.strictEqual(unicodeEscapesToPCRE2("\\u{1234}\\u{0001}"), "\\x{1234}\\x{0001}");
    assert.strictEqual(unicodeEscapesToPCRE2("foo\\u{1234}bar"), "foo\\x{1234}bar");
    assert.strictEqual(unicodeEscapesToPCRE2("[\\u00A0-\\u00FF]"), "[\\x{00A0}-\\x{00FF}]");
    assert.strictEqual(unicodeEscapesToPCRE2("foo\\u{123456}7bar"), "foo\\u{123456}7bar");
    assert.strictEqual(unicodeEscapesToPCRE2("\\u123"), "\\u123");
    assert.strictEqual(unicodeEscapesToPCRE2("foo"), "foo");
    assert.strictEqual(unicodeEscapesToPCRE2(""), "");
  });
  test("fixRegexNewline - src", () => {
    const ttable = [
      ["foo", "foo"],
      ["invalid(", "invalid("],
      ["fo\\no", "fo\\r?\\no"],
      ["f\\no\\no", "f\\r?\\no\\r?\\no"],
      ["f[a-z\\n1]", "f(?:[a-z1]|\\r?\\n)"],
      ["f[\\n-a]", "f[\\n-a]"],
      ["(?<=\\n)\\w", "(?<=\\n)\\w"],
      ["fo\\n+o", "fo(?:\\r?\\n)+o"],
      ["fo[^\\n]o", "fo(?!\\r?\\n)o"],
      ["fo[^\\na-z]o", "fo(?!\\r?\\n|[a-z])o"],
      ["foo[^\\n]+o", "foo.+o"],
      ["foo[^\\nzq]+o", "foo[^zq]+o"],
      ["foo[^\\nzq]+o", "foo[^zq]+o"],
      // preserves quantifies, #137899
      ["fo[^\\S\\n]*o", "fo[^\\S]*o"],
      ["fo[^\\S\\n]{3,}o", "fo[^\\S]{3,}o"]
    ];
    for (const [input, expected] of ttable) {
      assert.strictEqual(fixRegexNewline(input), expected, `${input} -> ${expected}`);
    }
  });
  test("fixRegexNewline - re", () => {
    function testFixRegexNewline([inputReg, testStr, shouldMatch]) {
      const fixed = fixRegexNewline(inputReg);
      const reg = new RegExp(fixed);
      assert.strictEqual(reg.test(testStr), shouldMatch, `${inputReg} => ${reg}, ${testStr}, ${shouldMatch}`);
    }
    [
      ["foo", "foo", true],
      ["foo\\n", "foo\r\n", true],
      ["foo\\n\\n", "foo\n\n", true],
      ["foo\\n\\n", "foo\r\n\r\n", true],
      ["foo\\n", "foo\n", true],
      ["foo\\nabc", "foo\r\nabc", true],
      ["foo\\nabc", "foo\nabc", true],
      ["foo\\r\\n", "foo\r\n", true],
      ["foo\\n+abc", "foo\r\nabc", true],
      ["foo\\n+abc", "foo\n\n\nabc", true],
      ["foo\\n+abc", "foo\r\n\r\n\r\nabc", true],
      ["foo[\\n-9]+abc", "foo1abc", true]
    ].forEach(testFixRegexNewline);
  });
  test("fixNewline - matching", () => {
    function testFixNewline([inputReg, testStr, shouldMatch = true]) {
      const fixed = fixNewline(inputReg);
      const reg = new RegExp(fixed);
      assert.strictEqual(reg.test(testStr), shouldMatch, `${inputReg} => ${reg}, ${testStr}, ${shouldMatch}`);
    }
    [
      ["foo", "foo"],
      ["foo\n", "foo\r\n"],
      ["foo\n", "foo\n"],
      ["foo\nabc", "foo\r\nabc"],
      ["foo\nabc", "foo\nabc"],
      ["foo\r\n", "foo\r\n"],
      ["foo\nbarc", "foobar", false],
      ["foobar", "foo\nbar", false]
    ].forEach(testFixNewline);
  });
  suite("RipgrepParser", () => {
    const TEST_FOLDER = URI.file("/foo/bar");
    function testParser(inputData, expectedResults) {
      const testParser2 = new RipgrepParser(1e3, TEST_FOLDER, DEFAULT_TEXT_SEARCH_PREVIEW_OPTIONS);
      const actualResults = [];
      testParser2.on("result", (r) => {
        actualResults.push(r);
      });
      inputData.forEach((d) => testParser2.handleData(d));
      testParser2.flush();
      assert.deepStrictEqual(actualResults, expectedResults);
    }
    function makeRgMatch(relativePath, text, lineNumber, matchRanges) {
      return JSON.stringify({
        type: "match",
        data: {
          path: {
            text: relativePath
          },
          lines: {
            text
          },
          line_number: lineNumber,
          absolute_offset: 0,
          // unused
          submatches: matchRanges.map((mr) => {
            return {
              ...mr,
              match: { text: text.substring(mr.start, mr.end) }
            };
          })
        }
      }) + "\n";
    }
    test("single result", () => {
      testParser(
        [
          makeRgMatch("file1.js", "foobar", 4, [{ start: 3, end: 6 }])
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          )
        ]
      );
    });
    test("multiple results", () => {
      testParser(
        [
          makeRgMatch("file1.js", "foobar", 4, [{ start: 3, end: 6 }]),
          makeRgMatch("app/file2.js", "foobar", 4, [{ start: 3, end: 6 }]),
          makeRgMatch("app2/file3.js", "foobar", 4, [{ start: 3, end: 6 }])
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          ),
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "app/file2.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          ),
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "app2/file3.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          )
        ]
      );
    });
    test("chopped-up input chunks", () => {
      const dataStrs = [
        makeRgMatch("file1.js", "foo bar", 4, [{ start: 3, end: 7 }]),
        makeRgMatch("app/file2.js", "foobar", 4, [{ start: 3, end: 6 }]),
        makeRgMatch("app2/file3.js", "foobar", 4, [{ start: 3, end: 6 }])
      ];
      const dataStr0Space = dataStrs[0].indexOf(" ");
      testParser(
        [
          dataStrs[0].substring(0, dataStr0Space + 1),
          dataStrs[0].substring(dataStr0Space + 1),
          "\n",
          dataStrs[1].trim(),
          "\n" + dataStrs[2].substring(0, 25),
          dataStrs[2].substring(25)
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [{
              previewRange: new Range(0, 3, 0, 7),
              sourceRange: new Range(3, 3, 3, 7)
            }],
            "foo bar"
          ),
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "app/file2.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          ),
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "app2/file3.js"),
            [{
              previewRange: new Range(0, 3, 0, 6),
              sourceRange: new Range(3, 3, 3, 6)
            }],
            "foobar"
          )
        ]
      );
    });
    test("empty result (#100569)", () => {
      testParser(
        [
          makeRgMatch("file1.js", "foobar", 4, []),
          makeRgMatch("file1.js", "", 5, [])
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [
              {
                previewRange: new Range(0, 0, 0, 1),
                sourceRange: new Range(3, 0, 3, 1)
              }
            ],
            "foobar"
          ),
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [
              {
                previewRange: new Range(0, 0, 0, 0),
                sourceRange: new Range(4, 0, 4, 0)
              }
            ],
            ""
          )
        ]
      );
    });
    test("multiple submatches without newline in between (#131507)", () => {
      testParser(
        [
          makeRgMatch("file1.js", "foobarbazquux", 4, [{ start: 0, end: 4 }, { start: 6, end: 10 }])
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [
              {
                previewRange: new Range(0, 0, 0, 4),
                sourceRange: new Range(3, 0, 3, 4)
              },
              {
                previewRange: new Range(0, 6, 0, 10),
                sourceRange: new Range(3, 6, 3, 10)
              }
            ],
            "foobarbazquux"
          )
        ]
      );
    });
    test("multiple submatches with newline in between (#131507)", () => {
      testParser(
        [
          makeRgMatch("file1.js", "foo\nbar\nbaz\nquux", 4, [{ start: 0, end: 5 }, { start: 8, end: 13 }])
        ],
        [
          new TextSearchMatch2(
            joinPath(TEST_FOLDER, "file1.js"),
            [
              {
                previewRange: new Range(0, 0, 1, 1),
                sourceRange: new Range(3, 0, 4, 1)
              },
              {
                previewRange: new Range(2, 0, 3, 1),
                sourceRange: new Range(5, 0, 6, 1)
              }
            ],
            "foo\nbar\nbaz\nquux"
          )
        ]
      );
    });
  });
  suite("getRgArgs", () => {
    test("simple includes", () => {
      function testGetRgArgs(includes, expectedFromIncludes) {
        const query = {
          pattern: "test"
        };
        const options = {
          folderOptions: {
            includes,
            excludes: [],
            useIgnoreFiles: {
              local: false,
              global: false,
              parent: false
            },
            followSymlinks: false,
            folder: URI.file("/some/folder"),
            encoding: "utf8"
          },
          maxResults: 1e3
        };
        const expected = [
          "--hidden",
          "--no-require-git",
          "--ignore-case",
          ...expectedFromIncludes,
          "--no-ignore",
          "--crlf",
          "--fixed-strings",
          "--no-config",
          "--no-ignore-global",
          "--json",
          "--",
          "test",
          "."
        ];
        const result = getRgArgs(query, options);
        assert.deepStrictEqual(result, expected);
      }
      [
        [["a/*", "b/*"], ["-g", "!*", "-g", "/a", "-g", "/a/*", "-g", "/b", "-g", "/b/*"]],
        [["**/a/*", "b/*"], ["-g", "!*", "-g", "/b", "-g", "/b/*", "-g", "**/a/*"]],
        [["**/a/*", "**/b/*"], ["-g", "**/a/*", "-g", "**/b/*"]],
        [["foo/*bar/something/**"], ["-g", "!*", "-g", "/foo", "-g", "/foo/*bar", "-g", "/foo/*bar/something", "-g", "/foo/*bar/something/**"]]
      ].forEach(([includes, expectedFromIncludes]) => testGetRgArgs(includes, expectedFromIncludes));
    });
  });
  test("brace expansion for ripgrep", () => {
    function testBraceExpansion(argGlob, expectedGlob) {
      const result = performBraceExpansionForRipgrep(argGlob);
      assert.deepStrictEqual(result, expectedGlob);
    }
    [
      ["eep/{a,b}/test", ["eep/a/test", "eep/b/test"]],
      ["eep/{a,b}/{c,d,e}", ["eep/a/c", "eep/a/d", "eep/a/e", "eep/b/c", "eep/b/d", "eep/b/e"]],
      ["eep/{a,b}/\\{c,d,e}", ["eep/a/{c,d,e}", "eep/b/{c,d,e}"]],
      ["eep/{a,b\\}/test", ["eep/{a,b}/test"]],
      ["eep/{a,b\\\\}/test", ["eep/a/test", "eep/b\\\\/test"]],
      ["eep/{a,b\\\\\\}/test", ["eep/{a,b\\\\}/test"]],
      ["e\\{ep/{a,b}/test", ["e{ep/a/test", "e{ep/b/test"]],
      ["eep/{a,\\b}/test", ["eep/a/test", "eep/\\b/test"]],
      ["{a/*.*,b/*.*}", ["a/*.*", "b/*.*"]],
      ["{{}", ["{{}"]],
      ["aa{{}", ["aa{{}"]],
      ["{b{}", ["{b{}"]],
      ["{{}c", ["{{}c"]],
      ["{{}}", ["{{}}"]],
      ["\\{{}}", ["{}"]],
      ["{}foo", ["foo"]],
      ["bar{ }foo", ["bar foo"]],
      ["{}", [""]]
    ].forEach(([includePattern, expectedPatterns]) => testBraceExpansion(includePattern, expectedPatterns));
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS9yaXBncmVwVGV4dFNlYXJjaEVuZ2luZVV0aWxzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBqb2luUGF0aCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZml4UmVnZXhOZXdsaW5lLCBJUmdNYXRjaCwgSVJnTWVzc2FnZSwgUmlwZ3JlcFBhcnNlciwgdW5pY29kZUVzY2FwZXNUb1BDUkUyLCBmaXhOZXdsaW5lLCBnZXRSZ0FyZ3MsIHBlcmZvcm1CcmFjZUV4cGFuc2lvbkZvclJpcGdyZXAgfSBmcm9tICcuLi8uLi9ub2RlL3JpcGdyZXBUZXh0U2VhcmNoRW5naW5lLmpzJztcbmltcG9ydCB7IFJhbmdlLCBUZXh0U2VhcmNoTWF0Y2gyLCBUZXh0U2VhcmNoUXVlcnkyLCBUZXh0U2VhcmNoUmVzdWx0MiB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2hFeHRUeXBlcy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFJpcGdyZXBUZXh0U2VhcmNoT3B0aW9ucyB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2hFeHRUeXBlc0ludGVybmFsLmpzJztcbmltcG9ydCB7IERFRkFVTFRfVEVYVF9TRUFSQ0hfUFJFVklFV19PUFRJT05TIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlYXJjaC5qcyc7XG5cbnN1aXRlKCdSaXBncmVwVGV4dFNlYXJjaEVuZ2luZScsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdHRlc3QoJ3VuaWNvZGVFc2NhcGVzVG9QQ1JFMicsIGFzeW5jICgpID0+IHtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pY29kZUVzY2FwZXNUb1BDUkUyKCdcXFxcdTEyMzQnKSwgJ1xcXFx4ezEyMzR9Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuaWNvZGVFc2NhcGVzVG9QQ1JFMignXFxcXHUxMjM0XFxcXHUwMDAxJyksICdcXFxceHsxMjM0fVxcXFx4ezAwMDF9Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuaWNvZGVFc2NhcGVzVG9QQ1JFMignZm9vXFxcXHUxMjM0YmFyJyksICdmb29cXFxceHsxMjM0fWJhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ1xcXFxcXFxcXFxcXHUxMjM0JyksICdcXFxcXFxcXFxcXFx4ezEyMzR9Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuaWNvZGVFc2NhcGVzVG9QQ1JFMignZm9vXFxcXFxcXFxcXFxcdTEyMzQnKSwgJ2Zvb1xcXFxcXFxcXFxcXHh7MTIzNH0nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ1xcXFx1ezEyMzR9JyksICdcXFxceHsxMjM0fScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ1xcXFx1ezEyMzR9XFxcXHV7MDAwMX0nKSwgJ1xcXFx4ezEyMzR9XFxcXHh7MDAwMX0nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pY29kZUVzY2FwZXNUb1BDUkUyKCdmb29cXFxcdXsxMjM0fWJhcicpLCAnZm9vXFxcXHh7MTIzNH1iYXInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodW5pY29kZUVzY2FwZXNUb1BDUkUyKCdbXFxcXHUwMEEwLVxcXFx1MDBGRl0nKSwgJ1tcXFxceHswMEEwfS1cXFxceHswMEZGfV0nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ2Zvb1xcXFx1ezEyMzQ1Nn03YmFyJyksICdmb29cXFxcdXsxMjM0NTZ9N2JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ1xcXFx1MTIzJyksICdcXFxcdTEyMycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh1bmljb2RlRXNjYXBlc1RvUENSRTIoJ2ZvbycpLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHVuaWNvZGVFc2NhcGVzVG9QQ1JFMignJyksICcnKTtcblx0fSk7XG5cblx0dGVzdCgnZml4UmVnZXhOZXdsaW5lIC0gc3JjJywgKCkgPT4ge1xuXHRcdGNvbnN0IHR0YWJsZSA9IFtcblx0XHRcdFsnZm9vJywgJ2ZvbyddLFxuXHRcdFx0WydpbnZhbGlkKCcsICdpbnZhbGlkKCddLFxuXHRcdFx0Wydmb1xcXFxubycsICdmb1xcXFxyP1xcXFxubyddLFxuXHRcdFx0WydmXFxcXG5vXFxcXG5vJywgJ2ZcXFxccj9cXFxcbm9cXFxccj9cXFxcbm8nXSxcblx0XHRcdFsnZlthLXpcXFxcbjFdJywgJ2YoPzpbYS16MV18XFxcXHI/XFxcXG4pJ10sXG5cdFx0XHRbJ2ZbXFxcXG4tYV0nLCAnZltcXFxcbi1hXSddLFxuXHRcdFx0WycoPzw9XFxcXG4pXFxcXHcnLCAnKD88PVxcXFxuKVxcXFx3J10sXG5cdFx0XHRbJ2ZvXFxcXG4rbycsICdmbyg/OlxcXFxyP1xcXFxuKStvJ10sXG5cdFx0XHRbJ2ZvW15cXFxcbl1vJywgJ2ZvKD8hXFxcXHI/XFxcXG4pbyddLFxuXHRcdFx0Wydmb1teXFxcXG5hLXpdbycsICdmbyg/IVxcXFxyP1xcXFxufFthLXpdKW8nXSxcblx0XHRcdFsnZm9vW15cXFxcbl0rbycsICdmb28uK28nXSxcblx0XHRcdFsnZm9vW15cXFxcbnpxXStvJywgJ2Zvb1teenFdK28nXSxcblx0XHRcdFsnZm9vW15cXFxcbnpxXStvJywgJ2Zvb1teenFdK28nXSxcblx0XHRcdC8vIHByZXNlcnZlcyBxdWFudGlmaWVzLCAjMTM3ODk5XG5cdFx0XHRbJ2ZvW15cXFxcU1xcXFxuXSpvJywgJ2ZvW15cXFxcU10qbyddLFxuXHRcdFx0Wydmb1teXFxcXFNcXFxcbl17Myx9bycsICdmb1teXFxcXFNdezMsfW8nXSxcblx0XHRdO1xuXG5cdFx0Zm9yIChjb25zdCBbaW5wdXQsIGV4cGVjdGVkXSBvZiB0dGFibGUpIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXhSZWdleE5ld2xpbmUoaW5wdXQpLCBleHBlY3RlZCwgYCR7aW5wdXR9IC0+ICR7ZXhwZWN0ZWR9YCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdmaXhSZWdleE5ld2xpbmUgLSByZScsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0Rml4UmVnZXhOZXdsaW5lKFtpbnB1dFJlZywgdGVzdFN0ciwgc2hvdWxkTWF0Y2hdOiByZWFkb25seSBbc3RyaW5nLCBzdHJpbmcsIGJvb2xlYW5dKTogdm9pZCB7XG5cdFx0XHRjb25zdCBmaXhlZCA9IGZpeFJlZ2V4TmV3bGluZShpbnB1dFJlZyk7XG5cdFx0XHRjb25zdCByZWcgPSBuZXcgUmVnRXhwKGZpeGVkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWcudGVzdCh0ZXN0U3RyKSwgc2hvdWxkTWF0Y2gsIGAke2lucHV0UmVnfSA9PiAke3JlZ30sICR7dGVzdFN0cn0sICR7c2hvdWxkTWF0Y2h9YCk7XG5cdFx0fVxuXG5cdFx0KFtcblx0XHRcdFsnZm9vJywgJ2ZvbycsIHRydWVdLFxuXG5cdFx0XHRbJ2Zvb1xcXFxuJywgJ2Zvb1xcclxcbicsIHRydWVdLFxuXHRcdFx0Wydmb29cXFxcblxcXFxuJywgJ2Zvb1xcblxcbicsIHRydWVdLFxuXHRcdFx0Wydmb29cXFxcblxcXFxuJywgJ2Zvb1xcclxcblxcclxcbicsIHRydWVdLFxuXHRcdFx0Wydmb29cXFxcbicsICdmb29cXG4nLCB0cnVlXSxcblx0XHRcdFsnZm9vXFxcXG5hYmMnLCAnZm9vXFxyXFxuYWJjJywgdHJ1ZV0sXG5cdFx0XHRbJ2Zvb1xcXFxuYWJjJywgJ2Zvb1xcbmFiYycsIHRydWVdLFxuXHRcdFx0Wydmb29cXFxcclxcXFxuJywgJ2Zvb1xcclxcbicsIHRydWVdLFxuXG5cdFx0XHRbJ2Zvb1xcXFxuK2FiYycsICdmb29cXHJcXG5hYmMnLCB0cnVlXSxcblx0XHRcdFsnZm9vXFxcXG4rYWJjJywgJ2Zvb1xcblxcblxcbmFiYycsIHRydWVdLFxuXHRcdFx0Wydmb29cXFxcbithYmMnLCAnZm9vXFxyXFxuXFxyXFxuXFxyXFxuYWJjJywgdHJ1ZV0sXG5cdFx0XHRbJ2Zvb1tcXFxcbi05XSthYmMnLCAnZm9vMWFiYycsIHRydWVdLFxuXHRcdF0gYXMgY29uc3QpLmZvckVhY2godGVzdEZpeFJlZ2V4TmV3bGluZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ZpeE5ld2xpbmUgLSBtYXRjaGluZycsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0Rml4TmV3bGluZShbaW5wdXRSZWcsIHRlc3RTdHIsIHNob3VsZE1hdGNoID0gdHJ1ZV06IHJlYWRvbmx5IFtzdHJpbmcsIHN0cmluZywgYm9vbGVhbj9dKTogdm9pZCB7XG5cdFx0XHRjb25zdCBmaXhlZCA9IGZpeE5ld2xpbmUoaW5wdXRSZWcpO1xuXHRcdFx0Y29uc3QgcmVnID0gbmV3IFJlZ0V4cChmaXhlZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnLnRlc3QodGVzdFN0ciksIHNob3VsZE1hdGNoLCBgJHtpbnB1dFJlZ30gPT4gJHtyZWd9LCAke3Rlc3RTdHJ9LCAke3Nob3VsZE1hdGNofWApO1xuXHRcdH1cblxuXHRcdChbXG5cdFx0XHRbJ2ZvbycsICdmb28nXSxcblxuXHRcdFx0Wydmb29cXG4nLCAnZm9vXFxyXFxuJ10sXG5cdFx0XHRbJ2Zvb1xcbicsICdmb29cXG4nXSxcblx0XHRcdFsnZm9vXFxuYWJjJywgJ2Zvb1xcclxcbmFiYyddLFxuXHRcdFx0Wydmb29cXG5hYmMnLCAnZm9vXFxuYWJjJ10sXG5cdFx0XHRbJ2Zvb1xcclxcbicsICdmb29cXHJcXG4nXSxcblxuXHRcdFx0Wydmb29cXG5iYXJjJywgJ2Zvb2JhcicsIGZhbHNlXSxcblx0XHRcdFsnZm9vYmFyJywgJ2Zvb1xcbmJhcicsIGZhbHNlXSxcblx0XHRdIGFzIGNvbnN0KS5mb3JFYWNoKHRlc3RGaXhOZXdsaW5lKTtcblx0fSk7XG5cblx0c3VpdGUoJ1JpcGdyZXBQYXJzZXInLCAoKSA9PiB7XG5cdFx0Y29uc3QgVEVTVF9GT0xERVIgPSBVUkkuZmlsZSgnL2Zvby9iYXInKTtcblxuXHRcdGZ1bmN0aW9uIHRlc3RQYXJzZXIoaW5wdXREYXRhOiBzdHJpbmdbXSwgZXhwZWN0ZWRSZXN1bHRzOiBUZXh0U2VhcmNoUmVzdWx0MltdKTogdm9pZCB7XG5cdFx0XHRjb25zdCB0ZXN0UGFyc2VyID0gbmV3IFJpcGdyZXBQYXJzZXIoMTAwMCwgVEVTVF9GT0xERVIsIERFRkFVTFRfVEVYVF9TRUFSQ0hfUFJFVklFV19PUFRJT05TKTtcblxuXHRcdFx0Y29uc3QgYWN0dWFsUmVzdWx0czogVGV4dFNlYXJjaFJlc3VsdDJbXSA9IFtdO1xuXHRcdFx0dGVzdFBhcnNlci5vbigncmVzdWx0JywgciA9PiB7XG5cdFx0XHRcdGFjdHVhbFJlc3VsdHMucHVzaChyKTtcblx0XHRcdH0pO1xuXG5cdFx0XHRpbnB1dERhdGEuZm9yRWFjaChkID0+IHRlc3RQYXJzZXIuaGFuZGxlRGF0YShkKSk7XG5cdFx0XHR0ZXN0UGFyc2VyLmZsdXNoKCk7XG5cblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsUmVzdWx0cywgZXhwZWN0ZWRSZXN1bHRzKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiBtYWtlUmdNYXRjaChyZWxhdGl2ZVBhdGg6IHN0cmluZywgdGV4dDogc3RyaW5nLCBsaW5lTnVtYmVyOiBudW1iZXIsIG1hdGNoUmFuZ2VzOiB7IHN0YXJ0OiBudW1iZXI7IGVuZDogbnVtYmVyIH1bXSk6IHN0cmluZyB7XG5cdFx0XHRyZXR1cm4gSlNPTi5zdHJpbmdpZnkoPElSZ01lc3NhZ2U+e1xuXHRcdFx0XHR0eXBlOiAnbWF0Y2gnLFxuXHRcdFx0XHRkYXRhOiA8SVJnTWF0Y2g+e1xuXHRcdFx0XHRcdHBhdGg6IHtcblx0XHRcdFx0XHRcdHRleHQ6IHJlbGF0aXZlUGF0aFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0bGluZXM6IHtcblx0XHRcdFx0XHRcdHRleHRcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGxpbmVfbnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0XHRcdGFic29sdXRlX29mZnNldDogMCwgLy8gdW51c2VkXG5cdFx0XHRcdFx0c3VibWF0Y2hlczogbWF0Y2hSYW5nZXMubWFwKG1yID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdC4uLm1yLFxuXHRcdFx0XHRcdFx0XHRtYXRjaDogeyB0ZXh0OiB0ZXh0LnN1YnN0cmluZyhtci5zdGFydCwgbXIuZW5kKSB9XG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH1cblx0XHRcdH0pICsgJ1xcbic7XG5cdFx0fVxuXG5cdFx0dGVzdCgnc2luZ2xlIHJlc3VsdCcsICgpID0+IHtcblx0XHRcdHRlc3RQYXJzZXIoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRtYWtlUmdNYXRjaCgnZmlsZTEuanMnLCAnZm9vYmFyJywgNCwgW3sgc3RhcnQ6IDMsIGVuZDogNiB9XSlcblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2gyKFxuXHRcdFx0XHRcdFx0am9pblBhdGgoVEVTVF9GT0xERVIsICdmaWxlMS5qcycpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0cHJldmlld1JhbmdlOiBuZXcgUmFuZ2UoMCwgMywgMCwgNiksXG5cdFx0XHRcdFx0XHRcdHNvdXJjZVJhbmdlOiBuZXcgUmFuZ2UoMywgMywgMywgNiksXG5cdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRcdCdmb29iYXInXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ211bHRpcGxlIHJlc3VsdHMnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0UGFyc2VyKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0bWFrZVJnTWF0Y2goJ2ZpbGUxLmpzJywgJ2Zvb2JhcicsIDQsIFt7IHN0YXJ0OiAzLCBlbmQ6IDYgfV0pLFxuXHRcdFx0XHRcdG1ha2VSZ01hdGNoKCdhcHAvZmlsZTIuanMnLCAnZm9vYmFyJywgNCwgW3sgc3RhcnQ6IDMsIGVuZDogNiB9XSksXG5cdFx0XHRcdFx0bWFrZVJnTWF0Y2goJ2FwcDIvZmlsZTMuanMnLCAnZm9vYmFyJywgNCwgW3sgc3RhcnQ6IDMsIGVuZDogNiB9XSksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoMihcblx0XHRcdFx0XHRcdGpvaW5QYXRoKFRFU1RfRk9MREVSLCAnZmlsZTEuanMnKSxcblx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDMsIDAsIDYpLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDMsIDMsIDYpLFxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHQnZm9vYmFyJ1xuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaDIoXG5cdFx0XHRcdFx0XHRqb2luUGF0aChURVNUX0ZPTERFUiwgJ2FwcC9maWxlMi5qcycpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0cHJldmlld1JhbmdlOiBuZXcgUmFuZ2UoMCwgMywgMCwgNiksXG5cdFx0XHRcdFx0XHRcdHNvdXJjZVJhbmdlOiBuZXcgUmFuZ2UoMywgMywgMywgNiksXG5cdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRcdCdmb29iYXInXG5cdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoMihcblx0XHRcdFx0XHRcdGpvaW5QYXRoKFRFU1RfRk9MREVSLCAnYXBwMi9maWxlMy5qcycpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0cHJldmlld1JhbmdlOiBuZXcgUmFuZ2UoMCwgMywgMCwgNiksXG5cdFx0XHRcdFx0XHRcdHNvdXJjZVJhbmdlOiBuZXcgUmFuZ2UoMywgMywgMywgNiksXG5cdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHRcdCdmb29iYXInXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Nob3BwZWQtdXAgaW5wdXQgY2h1bmtzJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGF0YVN0cnMgPSBbXG5cdFx0XHRcdG1ha2VSZ01hdGNoKCdmaWxlMS5qcycsICdmb28gYmFyJywgNCwgW3sgc3RhcnQ6IDMsIGVuZDogNyB9XSksXG5cdFx0XHRcdG1ha2VSZ01hdGNoKCdhcHAvZmlsZTIuanMnLCAnZm9vYmFyJywgNCwgW3sgc3RhcnQ6IDMsIGVuZDogNiB9XSksXG5cdFx0XHRcdG1ha2VSZ01hdGNoKCdhcHAyL2ZpbGUzLmpzJywgJ2Zvb2JhcicsIDQsIFt7IHN0YXJ0OiAzLCBlbmQ6IDYgfV0pLFxuXHRcdFx0XTtcblxuXHRcdFx0Y29uc3QgZGF0YVN0cjBTcGFjZSA9IGRhdGFTdHJzWzBdLmluZGV4T2YoJyAnKTtcblx0XHRcdHRlc3RQYXJzZXIoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRkYXRhU3Ryc1swXS5zdWJzdHJpbmcoMCwgZGF0YVN0cjBTcGFjZSArIDEpLFxuXHRcdFx0XHRcdGRhdGFTdHJzWzBdLnN1YnN0cmluZyhkYXRhU3RyMFNwYWNlICsgMSksXG5cdFx0XHRcdFx0J1xcbicsXG5cdFx0XHRcdFx0ZGF0YVN0cnNbMV0udHJpbSgpLFxuXHRcdFx0XHRcdCdcXG4nICsgZGF0YVN0cnNbMl0uc3Vic3RyaW5nKDAsIDI1KSxcblx0XHRcdFx0XHRkYXRhU3Ryc1syXS5zdWJzdHJpbmcoMjUpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoMihcblx0XHRcdFx0XHRcdGpvaW5QYXRoKFRFU1RfRk9MREVSLCAnZmlsZTEuanMnKSxcblx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDMsIDAsIDcpLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDMsIDMsIDcpLFxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHQnZm9vIGJhcidcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2gyKFxuXHRcdFx0XHRcdFx0am9pblBhdGgoVEVTVF9GT0xERVIsICdhcHAvZmlsZTIuanMnKSxcblx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDMsIDAsIDYpLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDMsIDMsIDYpLFxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHQnZm9vYmFyJ1xuXHRcdFx0XHRcdCksXG5cdFx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaDIoXG5cdFx0XHRcdFx0XHRqb2luUGF0aChURVNUX0ZPTERFUiwgJ2FwcDIvZmlsZTMuanMnKSxcblx0XHRcdFx0XHRcdFt7XG5cdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDMsIDAsIDYpLFxuXHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDMsIDMsIDYpLFxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHQnZm9vYmFyJ1xuXHRcdFx0XHRcdClcblx0XHRcdFx0XSk7XG5cdFx0fSk7XG5cblxuXHRcdHRlc3QoJ2VtcHR5IHJlc3VsdCAoIzEwMDU2OSknLCAoKSA9PiB7XG5cdFx0XHR0ZXN0UGFyc2VyKFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0bWFrZVJnTWF0Y2goJ2ZpbGUxLmpzJywgJ2Zvb2JhcicsIDQsIFtdKSxcblx0XHRcdFx0XHRtYWtlUmdNYXRjaCgnZmlsZTEuanMnLCAnJywgNSwgW10pLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaDIoXG5cdFx0XHRcdFx0XHRqb2luUGF0aChURVNUX0ZPTERFUiwgJ2ZpbGUxLmpzJyksXG5cdFx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRwcmV2aWV3UmFuZ2U6IG5ldyBSYW5nZSgwLCAwLCAwLCAxKSxcblx0XHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDAsIDMsIDEpLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0J2Zvb2Jhcidcblx0XHRcdFx0XHQpLFxuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2gyKFxuXHRcdFx0XHRcdFx0am9pblBhdGgoVEVTVF9GT0xERVIsICdmaWxlMS5qcycpLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0cHJldmlld1JhbmdlOiBuZXcgUmFuZ2UoMCwgMCwgMCwgMCksXG5cdFx0XHRcdFx0XHRcdFx0c291cmNlUmFuZ2U6IG5ldyBSYW5nZSg0LCAwLCA0LCAwKSxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdCcnXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ211bHRpcGxlIHN1Ym1hdGNoZXMgd2l0aG91dCBuZXdsaW5lIGluIGJldHdlZW4gKCMxMzE1MDcpJywgKCkgPT4ge1xuXHRcdFx0dGVzdFBhcnNlcihcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG1ha2VSZ01hdGNoKCdmaWxlMS5qcycsICdmb29iYXJiYXpxdXV4JywgNCwgW3sgc3RhcnQ6IDAsIGVuZDogNCB9LCB7IHN0YXJ0OiA2LCBlbmQ6IDEwIH1dKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2gyKFxuXHRcdFx0XHRcdFx0am9pblBhdGgoVEVTVF9GT0xERVIsICdmaWxlMS5qcycpLFxuXHRcdFx0XHRcdFx0W1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0cHJldmlld1JhbmdlOiBuZXcgUmFuZ2UoMCwgMCwgMCwgNCksXG5cdFx0XHRcdFx0XHRcdFx0c291cmNlUmFuZ2U6IG5ldyBSYW5nZSgzLCAwLCAzLCA0KSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDYsIDAsIDEwKSxcblx0XHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDMsIDYsIDMsIDEwKSxcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdCdmb29iYXJiYXpxdXV4J1xuXHRcdFx0XHRcdClcblx0XHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXBsZSBzdWJtYXRjaGVzIHdpdGggbmV3bGluZSBpbiBiZXR3ZWVuICgjMTMxNTA3KScsICgpID0+IHtcblx0XHRcdHRlc3RQYXJzZXIoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRtYWtlUmdNYXRjaCgnZmlsZTEuanMnLCAnZm9vXFxuYmFyXFxuYmF6XFxucXV1eCcsIDQsIFt7IHN0YXJ0OiAwLCBlbmQ6IDUgfSwgeyBzdGFydDogOCwgZW5kOiAxMyB9XSksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoMihcblx0XHRcdFx0XHRcdGpvaW5QYXRoKFRFU1RfRk9MREVSLCAnZmlsZTEuanMnKSxcblx0XHRcdFx0XHRcdFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHByZXZpZXdSYW5nZTogbmV3IFJhbmdlKDAsIDAsIDEsIDEpLFxuXHRcdFx0XHRcdFx0XHRcdHNvdXJjZVJhbmdlOiBuZXcgUmFuZ2UoMywgMCwgNCwgMSksXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRwcmV2aWV3UmFuZ2U6IG5ldyBSYW5nZSgyLCAwLCAzLCAxKSxcblx0XHRcdFx0XHRcdFx0XHRzb3VyY2VSYW5nZTogbmV3IFJhbmdlKDUsIDAsIDYsIDEpLFxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0J2Zvb1xcbmJhclxcbmJhelxcbnF1dXgnXG5cdFx0XHRcdFx0KVxuXHRcdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2dldFJnQXJncycsICgpID0+IHtcblx0XHR0ZXN0KCdzaW1wbGUgaW5jbHVkZXMnLCAoKSA9PiB7XG5cdFx0XHQvLyBPbmx5IHRlc3RpbmcgdGhlIGFyZ3MgdGhhdCBjb21lIGZyb20gaW5jbHVkZXMuXG5cdFx0XHRmdW5jdGlvbiB0ZXN0R2V0UmdBcmdzKGluY2x1ZGVzOiBzdHJpbmdbXSwgZXhwZWN0ZWRGcm9tSW5jbHVkZXM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0XHRcdGNvbnN0IHF1ZXJ5OiBUZXh0U2VhcmNoUXVlcnkyID0ge1xuXHRcdFx0XHRcdHBhdHRlcm46ICd0ZXN0J1xuXHRcdFx0XHR9O1xuXG5cdFx0XHRcdGNvbnN0IG9wdGlvbnM6IFJpcGdyZXBUZXh0U2VhcmNoT3B0aW9ucyA9IHtcblx0XHRcdFx0XHRmb2xkZXJPcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRpbmNsdWRlczogaW5jbHVkZXMsXG5cdFx0XHRcdFx0XHRleGNsdWRlczogW10sXG5cdFx0XHRcdFx0XHR1c2VJZ25vcmVGaWxlczoge1xuXHRcdFx0XHRcdFx0XHRsb2NhbDogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdGdsb2JhbDogZmFsc2UsXG5cdFx0XHRcdFx0XHRcdHBhcmVudDogZmFsc2Vcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRmb2xsb3dTeW1saW5rczogZmFsc2UsXG5cdFx0XHRcdFx0XHRmb2xkZXI6IFVSSS5maWxlKCcvc29tZS9mb2xkZXInKSxcblx0XHRcdFx0XHRcdGVuY29kaW5nOiAndXRmOCcsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRtYXhSZXN1bHRzOiAxMDAwLFxuXHRcdFx0XHR9O1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdFx0XHQnLS1oaWRkZW4nLFxuXHRcdFx0XHRcdCctLW5vLXJlcXVpcmUtZ2l0Jyxcblx0XHRcdFx0XHQnLS1pZ25vcmUtY2FzZScsXG5cdFx0XHRcdFx0Li4uZXhwZWN0ZWRGcm9tSW5jbHVkZXMsXG5cdFx0XHRcdFx0Jy0tbm8taWdub3JlJyxcblx0XHRcdFx0XHQnLS1jcmxmJyxcblx0XHRcdFx0XHQnLS1maXhlZC1zdHJpbmdzJyxcblx0XHRcdFx0XHQnLS1uby1jb25maWcnLFxuXHRcdFx0XHRcdCctLW5vLWlnbm9yZS1nbG9iYWwnLFxuXHRcdFx0XHRcdCctLWpzb24nLFxuXHRcdFx0XHRcdCctLScsXG5cdFx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHRcdCcuJ107XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGdldFJnQXJncyhxdWVyeSwgb3B0aW9ucyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0LCBleHBlY3RlZCk7XG5cdFx0XHR9XG5cblx0XHRcdChbXG5cdFx0XHRcdFtbJ2EvKicsICdiLyonXSwgWyctZycsICchKicsICctZycsICcvYScsICctZycsICcvYS8qJywgJy1nJywgJy9iJywgJy1nJywgJy9iLyonXV0sXG5cdFx0XHRcdFtbJyoqL2EvKicsICdiLyonXSwgWyctZycsICchKicsICctZycsICcvYicsICctZycsICcvYi8qJywgJy1nJywgJyoqL2EvKiddXSxcblx0XHRcdFx0W1snKiovYS8qJywgJyoqL2IvKiddLCBbJy1nJywgJyoqL2EvKicsICctZycsICcqKi9iLyonXV0sXG5cdFx0XHRcdFtbJ2Zvby8qYmFyL3NvbWV0aGluZy8qKiddLCBbJy1nJywgJyEqJywgJy1nJywgJy9mb28nLCAnLWcnLCAnL2Zvby8qYmFyJywgJy1nJywgJy9mb28vKmJhci9zb21ldGhpbmcnLCAnLWcnLCAnL2Zvby8qYmFyL3NvbWV0aGluZy8qKiddXSxcblx0XHRcdF0uZm9yRWFjaCgoW2luY2x1ZGVzLCBleHBlY3RlZEZyb21JbmNsdWRlc10pID0+IHRlc3RHZXRSZ0FyZ3MoPHN0cmluZ1tdPmluY2x1ZGVzLCA8c3RyaW5nW10+ZXhwZWN0ZWRGcm9tSW5jbHVkZXMpKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JyYWNlIGV4cGFuc2lvbiBmb3IgcmlwZ3JlcCcsICgpID0+IHtcblx0XHRmdW5jdGlvbiB0ZXN0QnJhY2VFeHBhbnNpb24oYXJnR2xvYjogc3RyaW5nLCBleHBlY3RlZEdsb2I6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBwZXJmb3JtQnJhY2VFeHBhbnNpb25Gb3JSaXBncmVwKGFyZ0dsb2IpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQsIGV4cGVjdGVkR2xvYik7XG5cdFx0fVxuXG5cdFx0W1xuXHRcdFx0WydlZXAve2EsYn0vdGVzdCcsIFsnZWVwL2EvdGVzdCcsICdlZXAvYi90ZXN0J11dLFxuXHRcdFx0WydlZXAve2EsYn0ve2MsZCxlfScsIFsnZWVwL2EvYycsICdlZXAvYS9kJywgJ2VlcC9hL2UnLCAnZWVwL2IvYycsICdlZXAvYi9kJywgJ2VlcC9iL2UnXV0sXG5cdFx0XHRbJ2VlcC97YSxifS9cXFxce2MsZCxlfScsIFsnZWVwL2Eve2MsZCxlfScsICdlZXAvYi97YyxkLGV9J11dLFxuXHRcdFx0WydlZXAve2EsYlxcXFx9L3Rlc3QnLCBbJ2VlcC97YSxifS90ZXN0J11dLFxuXHRcdFx0WydlZXAve2EsYlxcXFxcXFxcfS90ZXN0JywgWydlZXAvYS90ZXN0JywgJ2VlcC9iXFxcXFxcXFwvdGVzdCddXSxcblx0XHRcdFsnZWVwL3thLGJcXFxcXFxcXFxcXFx9L3Rlc3QnLCBbJ2VlcC97YSxiXFxcXFxcXFx9L3Rlc3QnXV0sXG5cdFx0XHRbJ2VcXFxce2VwL3thLGJ9L3Rlc3QnLCBbJ2V7ZXAvYS90ZXN0JywgJ2V7ZXAvYi90ZXN0J11dLFxuXHRcdFx0WydlZXAve2EsXFxcXGJ9L3Rlc3QnLCBbJ2VlcC9hL3Rlc3QnLCAnZWVwL1xcXFxiL3Rlc3QnXV0sXG5cdFx0XHRbJ3thLyouKixiLyouKn0nLCBbJ2EvKi4qJywgJ2IvKi4qJ11dLFxuXHRcdFx0Wyd7e30nLCBbJ3t7fSddXSxcblx0XHRcdFsnYWF7e30nLCBbJ2Fhe3t9J11dLFxuXHRcdFx0Wyd7Ynt9JywgWyd7Ynt9J11dLFxuXHRcdFx0Wyd7e31jJywgWyd7e31jJ11dLFxuXHRcdFx0Wyd7e319JywgWyd7e319J11dLFxuXHRcdFx0WydcXFxce3t9fScsIFsne30nXV0sXG5cdFx0XHRbJ3t9Zm9vJywgWydmb28nXV0sXG5cdFx0XHRbJ2JhcnsgfWZvbycsIFsnYmFyIGZvbyddXSxcblx0XHRcdFsne30nLCBbJyddXSxcblx0XHRdLmZvckVhY2goKFtpbmNsdWRlUGF0dGVybiwgZXhwZWN0ZWRQYXR0ZXJuc10pID0+IHRlc3RCcmFjZUV4cGFuc2lvbig8c3RyaW5nPmluY2x1ZGVQYXR0ZXJuLCA8c3RyaW5nW10+ZXhwZWN0ZWRQYXR0ZXJucykpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBVztBQUNwQixTQUFTLGlCQUF1QyxlQUFlLHVCQUF1QixZQUFZLFdBQVcsdUNBQXVDO0FBQ3BKLFNBQVMsT0FBTyx3QkFBNkQ7QUFDN0UsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUywyQ0FBMkM7QUFFcEQsTUFBTSwyQkFBMkIsTUFBTTtBQUN0QywwQ0FBd0M7QUFDeEMsT0FBSyx5QkFBeUIsWUFBWTtBQUN6QyxXQUFPLFlBQVksc0JBQXNCLFNBQVMsR0FBRyxXQUFXO0FBQ2hFLFdBQU8sWUFBWSxzQkFBc0IsZ0JBQWdCLEdBQUcsb0JBQW9CO0FBQ2hGLFdBQU8sWUFBWSxzQkFBc0IsZUFBZSxHQUFHLGlCQUFpQjtBQUM1RSxXQUFPLFlBQVksc0JBQXNCLGFBQWEsR0FBRyxlQUFlO0FBQ3hFLFdBQU8sWUFBWSxzQkFBc0IsZ0JBQWdCLEdBQUcsa0JBQWtCO0FBRTlFLFdBQU8sWUFBWSxzQkFBc0IsV0FBVyxHQUFHLFdBQVc7QUFDbEUsV0FBTyxZQUFZLHNCQUFzQixvQkFBb0IsR0FBRyxvQkFBb0I7QUFDcEYsV0FBTyxZQUFZLHNCQUFzQixpQkFBaUIsR0FBRyxpQkFBaUI7QUFDOUUsV0FBTyxZQUFZLHNCQUFzQixtQkFBbUIsR0FBRyx1QkFBdUI7QUFFdEYsV0FBTyxZQUFZLHNCQUFzQixvQkFBb0IsR0FBRyxvQkFBb0I7QUFDcEYsV0FBTyxZQUFZLHNCQUFzQixRQUFRLEdBQUcsUUFBUTtBQUM1RCxXQUFPLFlBQVksc0JBQXNCLEtBQUssR0FBRyxLQUFLO0FBQ3RELFdBQU8sWUFBWSxzQkFBc0IsRUFBRSxHQUFHLEVBQUU7QUFBQSxFQUNqRCxDQUFDO0FBRUQsT0FBSyx5QkFBeUIsTUFBTTtBQUNuQyxV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Q0FBQyx1QkFBdUIsR0FBRyxDQUFDLE1BQU0sTUFBTSxNQUFNLFFBQVEsTUFBTSxhQUFhLE1BQU0sdUJBQXVCLE1BQU0sd0JBQXdCLENBQUM7QUFBQSxNQUN2SSxFQUFFLFFBQVEsQ0FBQyxDQUFDLFVBQVUsb0JBQW9CLE1BQU0sY0FBd0IsVUFBb0Isb0JBQW9CLENBQUM7QUFBQSxJQUNsSCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSywrQkFBK0IsTUFBTTtBQUN6QyxhQUFTLG1CQUFtQixTQUFpQixjQUE4QjtBQUMxRSxZQUFNLFNBQVMsZ0NBQWdDLE9BQU87QUFDdEQsYUFBTyxnQkFBZ0IsUUFBUSxZQUFZO0FBQUEsSUFDNUM7QUFFQTtBQUFBLE1BQ0MsQ0FBQyxrQkFBa0IsQ0FBQyxjQUFjLFlBQVksQ0FBQztBQUFBLE1BQy9DLENBQUMscUJBQXFCLENBQUMsV0FBVyxXQUFXLFdBQVcsV0FBVyxXQUFXLFNBQVMsQ0FBQztBQUFBLE1BQ3hGLENBQUMsdUJBQXVCLENBQUMsaUJBQWlCLGVBQWUsQ0FBQztBQUFBLE1BQzFELENBQUMsb0JBQW9CLENBQUMsZ0JBQWdCLENBQUM7QUFBQSxNQUN2QyxDQUFDLHNCQUFzQixDQUFDLGNBQWMsZ0JBQWdCLENBQUM7QUFBQSxNQUN2RCxDQUFDLHdCQUF3QixDQUFDLG9CQUFvQixDQUFDO0FBQUEsTUFDL0MsQ0FBQyxxQkFBcUIsQ0FBQyxlQUFlLGFBQWEsQ0FBQztBQUFBLE1BQ3BELENBQUMsb0JBQW9CLENBQUMsY0FBYyxjQUFjLENBQUM7QUFBQSxNQUNuRCxDQUFDLGlCQUFpQixDQUFDLFNBQVMsT0FBTyxDQUFDO0FBQUEsTUFDcEMsQ0FBQyxPQUFPLENBQUMsS0FBSyxDQUFDO0FBQUEsTUFDZixDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUM7QUFBQSxNQUNuQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFBQSxNQUNqQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFBQSxNQUNqQixDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUM7QUFBQSxNQUNqQixDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUM7QUFBQSxNQUNqQixDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUM7QUFBQSxNQUNqQixDQUFDLGFBQWEsQ0FBQyxTQUFTLENBQUM7QUFBQSxNQUN6QixDQUFDLE1BQU0sQ0FBQyxFQUFFLENBQUM7QUFBQSxJQUNaLEVBQUUsUUFBUSxDQUFDLENBQUMsZ0JBQWdCLGdCQUFnQixNQUFNLG1CQUEyQixnQkFBMEIsZ0JBQWdCLENBQUM7QUFBQSxFQUN6SCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsidGVzdFBhcnNlciJdCn0K
