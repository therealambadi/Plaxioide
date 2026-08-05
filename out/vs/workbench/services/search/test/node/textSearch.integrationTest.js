import assert from "assert";
import * as path from "../../../../../base/common/path.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { URI } from "../../../../../base/common/uri.js";
import { deserializeSearchError, QueryType, SearchErrorCode } from "../../common/search.js";
import { TextSearchEngineAdapter } from "../../node/textSearchAdapter.js";
import { flakySuite } from "../../../../../base/test/node/testUtils.js";
import { FileAccess } from "../../../../../base/common/network.js";
const TEST_FIXTURES = path.normalize(FileAccess.asFileUri("vs/workbench/services/search/test/node/fixtures").fsPath);
const EXAMPLES_FIXTURES = path.join(TEST_FIXTURES, "examples");
const MORE_FIXTURES = path.join(TEST_FIXTURES, "more");
const TEST_ROOT_FOLDER = { folder: URI.file(TEST_FIXTURES) };
const ROOT_FOLDER_QUERY = [
  TEST_ROOT_FOLDER
];
const MULTIROOT_QUERIES = [
  { folder: URI.file(EXAMPLES_FIXTURES) },
  { folder: URI.file(MORE_FIXTURES) }
];
function doSearchTest(query, expectedResultCount) {
  const engine = new TextSearchEngineAdapter(query);
  let c = 0;
  const results = [];
  return engine.search(new CancellationTokenSource().token, (_results) => {
    if (_results) {
      c += _results.reduce((acc, cur) => acc + cur.numMatches, 0);
      results.push(..._results);
    }
  }, () => {
  }).then(() => {
    if (typeof expectedResultCount === "function") {
      assert(expectedResultCount(c));
    } else {
      assert.strictEqual(c, expectedResultCount, `rg ${c} !== ${expectedResultCount}`);
    }
    return results;
  });
}
flakySuite("TextSearch-integration", function() {
  test("Text: GameOfLife", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "GameOfLife" }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (RegExp)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "Game.?fL\\w?fe", isRegExp: true }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (unicode escape sequences)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "G\\u{0061}m\\u0065OfLife", isRegExp: true }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (unicode escape sequences, force PCRE2)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "(?<!a)G\\u{0061}m\\u0065OfLife", isRegExp: true }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (PCRE2 RegExp)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      usePCRE2: true,
      contentPattern: { pattern: "Life(?!P)", isRegExp: true }
    };
    return doSearchTest(config, 8);
  });
  test("Text: GameOfLife (RegExp to EOL)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "GameOfLife.*", isRegExp: true }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (Word Match, Case Sensitive)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "GameOfLife", isWordMatch: true, isCaseSensitive: true }
    };
    return doSearchTest(config, 4);
  });
  test("Text: GameOfLife (Word Match, Spaces)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: " GameOfLife ", isWordMatch: true }
    };
    return doSearchTest(config, 1);
  });
  test("Text: GameOfLife (Word Match, Punctuation and Spaces)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: ", as =", isWordMatch: true }
    };
    return doSearchTest(config, 1);
  });
  test("Text: Helvetica (UTF 16)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "Helvetica" }
    };
    return doSearchTest(config, 3);
  });
  test("Text: e", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "e" }
    };
    return doSearchTest(config, 785);
  });
  test("Text: e (with excludes)", () => {
    const config = {
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "e" },
      excludePattern: { "**/examples": true }
    };
    return doSearchTest(config, 391);
  });
  test("Text: e (with includes)", () => {
    const config = {
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "e" },
      includePattern: { "**/examples/**": true }
    };
    return doSearchTest(config, 394);
  });
  test("Text: sibling exclude", () => {
    const config = {
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "m" },
      includePattern: makeExpression("**/site*"),
      excludePattern: { "*.css": { when: "$(basename).less" } }
    };
    return doSearchTest(config, 1);
  });
  test("Text: e (with includes and exclude)", () => {
    const config = {
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "e" },
      includePattern: { "**/examples/**": true },
      excludePattern: { "**/examples/small.js": true }
    };
    return doSearchTest(config, 371);
  });
  test("Text: a (capped)", () => {
    const maxResults = 520;
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "a" },
      maxResults
    };
    return doSearchTest(config, maxResults);
  });
  test("Text: a (no results)", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "ahsogehtdas" }
    };
    return doSearchTest(config, 0);
  });
  test("Text: -size", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "-size" }
    };
    return doSearchTest(config, 9);
  });
  test("Multiroot: Conway", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: MULTIROOT_QUERIES,
      contentPattern: { pattern: "conway" }
    };
    return doSearchTest(config, 8);
  });
  test("Multiroot: e with partial global exclude", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: MULTIROOT_QUERIES,
      contentPattern: { pattern: "e" },
      excludePattern: makeExpression("**/*.txt")
    };
    return doSearchTest(config, 394);
  });
  test("Multiroot: e with global excludes", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: MULTIROOT_QUERIES,
      contentPattern: { pattern: "e" },
      excludePattern: makeExpression("**/*.txt", "**/*.js")
    };
    return doSearchTest(config, 0);
  });
  test("Multiroot: e with folder exclude", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: [
        {
          folder: URI.file(EXAMPLES_FIXTURES),
          excludePattern: [{
            pattern: makeExpression("**/e*.js")
          }]
        },
        { folder: URI.file(MORE_FIXTURES) }
      ],
      contentPattern: { pattern: "e" }
    };
    return doSearchTest(config, 298);
  });
  test("Text: \u8BED", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "\u8BED" }
    };
    return doSearchTest(config, 1).then((results) => {
      const matchRange = results[0].results[0].rangeLocations.map((e) => e.source);
      assert.deepStrictEqual(matchRange, [{
        startLineNumber: 0,
        startColumn: 1,
        endLineNumber: 0,
        endColumn: 2
      }]);
    });
  });
  test("Multiple matches on line: h\\d,", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "h\\d,", isRegExp: true }
    };
    return doSearchTest(config, 15).then((results) => {
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].results.length, 1);
      const match = results[0].results[0];
      assert.strictEqual(match.rangeLocations.map((e) => e.source).length, 5);
    });
  });
  test("Search with context matches", () => {
    const config = {
      type: QueryType.Text,
      folderQueries: ROOT_FOLDER_QUERY,
      contentPattern: { pattern: "compiler.typeCheck();" },
      surroundingContext: 1
    };
    return doSearchTest(config, 3).then((results) => {
      assert.strictEqual(results.length, 3);
      assert.strictEqual(results[0].results[0].lineNumber, 24);
      assert.strictEqual(results[0].results[0].text, '        compiler.addUnit(prog,"input.ts");');
      assert.strictEqual(results[2].results[0].lineNumber, 26);
      assert.strictEqual(results[2].results[0].text, "        compiler.emit();");
    });
  });
  suite("error messages", () => {
    test("invalid encoding", () => {
      const config = {
        type: QueryType.Text,
        folderQueries: [
          {
            ...TEST_ROOT_FOLDER,
            fileEncoding: "invalidEncoding"
          }
        ],
        contentPattern: { pattern: "test" }
      };
      return doSearchTest(config, 0).then(() => {
        throw new Error("expected fail");
      }, (err) => {
        const searchError = deserializeSearchError(err);
        assert.strictEqual(searchError.message, "Unknown encoding: invalidEncoding");
        assert.strictEqual(searchError.code, SearchErrorCode.unknownEncoding);
      });
    });
    test("invalid regex case 1", () => {
      const config = {
        type: QueryType.Text,
        folderQueries: ROOT_FOLDER_QUERY,
        contentPattern: { pattern: ")", isRegExp: true }
      };
      return doSearchTest(config, 0).then(() => {
        throw new Error("expected fail");
      }, (err) => {
        const searchError = deserializeSearchError(err);
        const regexParseErrorForUnclosedParenthesis = "Regex parse error: unmatched closing parenthesis";
        assert.strictEqual(searchError.message, regexParseErrorForUnclosedParenthesis);
        assert.strictEqual(searchError.code, SearchErrorCode.regexParseError);
      });
    });
    test("invalid regex case 2", () => {
      const config = {
        type: QueryType.Text,
        folderQueries: ROOT_FOLDER_QUERY,
        contentPattern: { pattern: "(?<!a.*)", isRegExp: true }
      };
      return doSearchTest(config, 0).then(() => {
        throw new Error("expected fail");
      }, (err) => {
        const searchError = deserializeSearchError(err);
        const regexParseErrorForLookAround = "Regex parse error: lookbehind assertion is not fixed length";
        assert.strictEqual(searchError.message, regexParseErrorForLookAround);
        assert.strictEqual(searchError.code, SearchErrorCode.regexParseError);
      });
    });
    test("invalid glob", () => {
      const config = {
        type: QueryType.Text,
        folderQueries: ROOT_FOLDER_QUERY,
        contentPattern: { pattern: "foo" },
        includePattern: {
          "{{}": true
        }
      };
      return doSearchTest(config, 0).then(() => {
        throw new Error("expected fail");
      }, (err) => {
        const searchError = deserializeSearchError(err);
        assert.strictEqual(searchError.message, "Error parsing glob '/{{}': nested alternate groups are not allowed");
        assert.strictEqual(searchError.code, SearchErrorCode.globParseError);
      });
    });
  });
});
function makeExpression(...patterns) {
  return patterns.reduce((glob2, pattern) => {
    pattern = pattern.replace(/\\/g, "/");
    glob2[pattern] = true;
    return glob2;
  }, /* @__PURE__ */ Object.create(null));
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3Qvbm9kZS90ZXh0U2VhcmNoLmludGVncmF0aW9uVGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHBhdGggZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGF0aC5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBnbG9iIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGRlc2VyaWFsaXplU2VhcmNoRXJyb3IsIElGb2xkZXJRdWVyeSwgSVNlYXJjaFJhbmdlLCBJVGV4dFF1ZXJ5LCBJVGV4dFNlYXJjaENvbnRleHQsIElUZXh0U2VhcmNoTWF0Y2gsIFF1ZXJ5VHlwZSwgU2VhcmNoRXJyb3JDb2RlLCBJU2VyaWFsaXplZEZpbGVNYXRjaCB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgVGV4dFNlYXJjaEVuZ2luZUFkYXB0ZXIgfSBmcm9tICcuLi8uLi9ub2RlL3RleHRTZWFyY2hBZGFwdGVyLmpzJztcbmltcG9ydCB7IGZsYWt5U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3Qvbm9kZS90ZXN0VXRpbHMuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuXG5jb25zdCBURVNUX0ZJWFRVUkVTID0gcGF0aC5ub3JtYWxpemUoRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9zZXJ2aWNlcy9zZWFyY2gvdGVzdC9ub2RlL2ZpeHR1cmVzJykuZnNQYXRoKTtcbmNvbnN0IEVYQU1QTEVTX0ZJWFRVUkVTID0gcGF0aC5qb2luKFRFU1RfRklYVFVSRVMsICdleGFtcGxlcycpO1xuY29uc3QgTU9SRV9GSVhUVVJFUyA9IHBhdGguam9pbihURVNUX0ZJWFRVUkVTLCAnbW9yZScpO1xuY29uc3QgVEVTVF9ST09UX0ZPTERFUjogSUZvbGRlclF1ZXJ5ID0geyBmb2xkZXI6IFVSSS5maWxlKFRFU1RfRklYVFVSRVMpIH07XG5jb25zdCBST09UX0ZPTERFUl9RVUVSWTogSUZvbGRlclF1ZXJ5W10gPSBbXG5cdFRFU1RfUk9PVF9GT0xERVJcbl07XG5cbmNvbnN0IE1VTFRJUk9PVF9RVUVSSUVTOiBJRm9sZGVyUXVlcnlbXSA9IFtcblx0eyBmb2xkZXI6IFVSSS5maWxlKEVYQU1QTEVTX0ZJWFRVUkVTKSB9LFxuXHR7IGZvbGRlcjogVVJJLmZpbGUoTU9SRV9GSVhUVVJFUykgfVxuXTtcblxuZnVuY3Rpb24gZG9TZWFyY2hUZXN0KHF1ZXJ5OiBJVGV4dFF1ZXJ5LCBleHBlY3RlZFJlc3VsdENvdW50OiBudW1iZXIgfCBGdW5jdGlvbik6IFByb21pc2U8SVNlcmlhbGl6ZWRGaWxlTWF0Y2hbXT4ge1xuXHRjb25zdCBlbmdpbmUgPSBuZXcgVGV4dFNlYXJjaEVuZ2luZUFkYXB0ZXIocXVlcnkpO1xuXG5cdGxldCBjID0gMDtcblx0Y29uc3QgcmVzdWx0czogSVNlcmlhbGl6ZWRGaWxlTWF0Y2hbXSA9IFtdO1xuXHRyZXR1cm4gZW5naW5lLnNlYXJjaChuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKS50b2tlbiwgX3Jlc3VsdHMgPT4ge1xuXHRcdGlmIChfcmVzdWx0cykge1xuXHRcdFx0YyArPSBfcmVzdWx0cy5yZWR1Y2UoKGFjYywgY3VyKSA9PiBhY2MgKyBjdXIubnVtTWF0Y2hlcyEsIDApO1xuXHRcdFx0cmVzdWx0cy5wdXNoKC4uLl9yZXN1bHRzKTtcblx0XHR9XG5cdH0sICgpID0+IHsgfSkudGhlbigoKSA9PiB7XG5cdFx0aWYgKHR5cGVvZiBleHBlY3RlZFJlc3VsdENvdW50ID09PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRhc3NlcnQoZXhwZWN0ZWRSZXN1bHRDb3VudChjKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjLCBleHBlY3RlZFJlc3VsdENvdW50LCBgcmcgJHtjfSAhPT0gJHtleHBlY3RlZFJlc3VsdENvdW50fWApO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHRzO1xuXHR9KTtcbn1cblxuZmxha3lTdWl0ZSgnVGV4dFNlYXJjaC1pbnRlZ3JhdGlvbicsIGZ1bmN0aW9uICgpIHtcblxuXHR0ZXN0KCdUZXh0OiBHYW1lT2ZMaWZlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnR2FtZU9mTGlmZScgfSxcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBHYW1lT2ZMaWZlIChSZWdFeHApJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnR2FtZS4/ZkxcXFxcdz9mZScsIGlzUmVnRXhwOiB0cnVlIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBHYW1lT2ZMaWZlICh1bmljb2RlIGVzY2FwZSBzZXF1ZW5jZXMpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnR1xcXFx1ezAwNjF9bVxcXFx1MDA2NU9mTGlmZScsIGlzUmVnRXhwOiB0cnVlIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBHYW1lT2ZMaWZlICh1bmljb2RlIGVzY2FwZSBzZXF1ZW5jZXMsIGZvcmNlIFBDUkUyKScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJyg/PCFhKUdcXFxcdXswMDYxfW1cXFxcdTAwNjVPZkxpZmUnLCBpc1JlZ0V4cDogdHJ1ZSB9XG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnVGV4dDogR2FtZU9mTGlmZSAoUENSRTIgUmVnRXhwKScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0dXNlUENSRTI6IHRydWUsXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnTGlmZSg/IVApJywgaXNSZWdFeHA6IHRydWUgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgOCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IEdhbWVPZkxpZmUgKFJlZ0V4cCB0byBFT0wpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnR2FtZU9mTGlmZS4qJywgaXNSZWdFeHA6IHRydWUgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgNCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IEdhbWVPZkxpZmUgKFdvcmQgTWF0Y2gsIENhc2UgU2Vuc2l0aXZlKScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ0dhbWVPZkxpZmUnLCBpc1dvcmRNYXRjaDogdHJ1ZSwgaXNDYXNlU2Vuc2l0aXZlOiB0cnVlIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBHYW1lT2ZMaWZlIChXb3JkIE1hdGNoLCBTcGFjZXMpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnIEdhbWVPZkxpZmUgJywgaXNXb3JkTWF0Y2g6IHRydWUgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IEdhbWVPZkxpZmUgKFdvcmQgTWF0Y2gsIFB1bmN0dWF0aW9uIGFuZCBTcGFjZXMpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnLCBhcyA9JywgaXNXb3JkTWF0Y2g6IHRydWUgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IEhlbHZldGljYSAoVVRGIDE2KScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ0hlbHZldGljYScgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdlJyB9XG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCA3ODUpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBlICh3aXRoIGV4Y2x1ZGVzKScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IGFueSA9IHtcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ2UnIH0sXG5cdFx0XHRleGNsdWRlUGF0dGVybjogeyAnKiovZXhhbXBsZXMnOiB0cnVlIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDM5MSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IGUgKHdpdGggaW5jbHVkZXMpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogYW55ID0ge1xuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZScgfSxcblx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7ICcqKi9leGFtcGxlcy8qKic6IHRydWUgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMzk0KTtcblx0fSk7XG5cblx0Ly8gVE9ET1xuXHQvLyB0ZXN0KCdUZXh0OiBlICh3aXRoIGFic29sdXRlIHBhdGggZXhjbHVkZXMpJywgKCkgPT4ge1xuXHQvLyBcdGNvbnN0IGNvbmZpZzogYW55ID0ge1xuXHQvLyBcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdC8vIFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZScgfSxcblx0Ly8gXHRcdGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhwcmVzc2lvbihwYXRoLmpvaW4oVEVTVF9GSVhUVVJFUywgJyoqL2V4YW1wbGVzJykpXG5cdC8vIFx0fTtcblxuXHQvLyBcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAzOTQpO1xuXHQvLyB9KTtcblxuXHQvLyB0ZXN0KCdUZXh0OiBlICh3aXRoIG1peGVkIGFic29sdXRlL3JlbGF0aXZlIHBhdGggZXhjbHVkZXMpJywgKCkgPT4ge1xuXHQvLyBcdGNvbnN0IGNvbmZpZzogYW55ID0ge1xuXHQvLyBcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdC8vIFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZScgfSxcblx0Ly8gXHRcdGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhwcmVzc2lvbihwYXRoLmpvaW4oVEVTVF9GSVhUVVJFUywgJyoqL2V4YW1wbGVzJyksICcqLmNzcycpXG5cdC8vIFx0fTtcblxuXHQvLyBcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAzMTApO1xuXHQvLyB9KTtcblxuXHR0ZXN0KCdUZXh0OiBzaWJsaW5nIGV4Y2x1ZGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnOiBhbnkgPSB7XG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdtJyB9LFxuXHRcdFx0aW5jbHVkZVBhdHRlcm46IG1ha2VFeHByZXNzaW9uKCcqKi9zaXRlKicpLFxuXHRcdFx0ZXhjbHVkZVBhdHRlcm46IHsgJyouY3NzJzogeyB3aGVuOiAnJChiYXNlbmFtZSkubGVzcycgfSB9XG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAxKTtcblx0fSk7XG5cblx0dGVzdCgnVGV4dDogZSAod2l0aCBpbmNsdWRlcyBhbmQgZXhjbHVkZSknLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnOiBhbnkgPSB7XG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdlJyB9LFxuXHRcdFx0aW5jbHVkZVBhdHRlcm46IHsgJyoqL2V4YW1wbGVzLyoqJzogdHJ1ZSB9LFxuXHRcdFx0ZXhjbHVkZVBhdHRlcm46IHsgJyoqL2V4YW1wbGVzL3NtYWxsLmpzJzogdHJ1ZSB9XG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAzNzEpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiBhIChjYXBwZWQpJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1heFJlc3VsdHMgPSA1MjA7XG5cdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdhJyB9LFxuXHRcdFx0bWF4UmVzdWx0c1xuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgbWF4UmVzdWx0cyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IGEgKG5vIHJlc3VsdHMpJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnYWhzb2dlaHRkYXMnIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXh0OiAtc2l6ZScsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJy1zaXplJyB9XG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCA5KTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlyb290OiBDb253YXknLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBNVUxUSVJPT1RfUVVFUklFUyxcblx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdjb253YXknIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDgpO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXJvb3Q6IGUgd2l0aCBwYXJ0aWFsIGdsb2JhbCBleGNsdWRlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogTVVMVElST09UX1FVRVJJRVMsXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZScgfSxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhwcmVzc2lvbignKiovKi50eHQnKVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMzk0KTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlyb290OiBlIHdpdGggZ2xvYmFsIGV4Y2x1ZGVzJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogTVVMVElST09UX1FVRVJJRVMsXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZScgfSxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhwcmVzc2lvbignKiovKi50eHQnLCAnKiovKi5qcycpXG5cdFx0fTtcblxuXHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAwKTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlyb290OiBlIHdpdGggZm9sZGVyIGV4Y2x1ZGUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRmb2xkZXI6IFVSSS5maWxlKEVYQU1QTEVTX0ZJWFRVUkVTKSwgZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiBtYWtlRXhwcmVzc2lvbignKiovZSouanMnKVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHsgZm9sZGVyOiBVUkkuZmlsZShNT1JFX0ZJWFRVUkVTKSB9XG5cdFx0XHRdLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ2UnIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDI5OCk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RleHQ6IFx1OEJFRCcsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ1x1OEJFRCcgfVxuXHRcdH07XG5cblx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMSkudGhlbihyZXN1bHRzID0+IHtcblx0XHRcdGNvbnN0IG1hdGNoUmFuZ2UgPSAoPElUZXh0U2VhcmNoTWF0Y2g+cmVzdWx0c1swXS5yZXN1bHRzIVswXSkucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5zb3VyY2UpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtYXRjaFJhbmdlLCBbe1xuXHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IDAsXG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRMaW5lTnVtYmVyOiAwLFxuXHRcdFx0XHRlbmRDb2x1bW46IDJcblx0XHRcdH1dKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTXVsdGlwbGUgbWF0Y2hlcyBvbiBsaW5lOiBoXFxcXGQsJywgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnaFxcXFxkLCcsIGlzUmVnRXhwOiB0cnVlIH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDE1KS50aGVuKHJlc3VsdHMgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdHMubGVuZ3RoLCAzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRzWzBdLnJlc3VsdHMhLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBtYXRjaCA9IDxJVGV4dFNlYXJjaE1hdGNoPnJlc3VsdHNbMF0ucmVzdWx0cyFbMF07XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKDxJU2VhcmNoUmFuZ2VbXT5tYXRjaC5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnNvdXJjZSkpLmxlbmd0aCwgNSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlYXJjaCB3aXRoIGNvbnRleHQgbWF0Y2hlcycsICgpID0+IHtcblx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ2NvbXBpbGVyLnR5cGVDaGVjaygpOycgfSxcblx0XHRcdHN1cnJvdW5kaW5nQ29udGV4dDogMSxcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGRvU2VhcmNoVGVzdChjb25maWcsIDMpLnRoZW4ocmVzdWx0cyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0cy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SVRleHRTZWFyY2hDb250ZXh0PnJlc3VsdHNbMF0ucmVzdWx0cyFbMF0pLmxpbmVOdW1iZXIsIDI0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPElUZXh0U2VhcmNoQ29udGV4dD5yZXN1bHRzWzBdLnJlc3VsdHMhWzBdKS50ZXh0LCAnICAgICAgICBjb21waWxlci5hZGRVbml0KHByb2csXCJpbnB1dC50c1wiKTsnKTtcblx0XHRcdC8vIGFzc2VydC5zdHJpY3RFcXVhbCgoPElUZXh0U2VhcmNoTWF0Y2g+cmVzdWx0c1sxXS5yZXN1bHRzWzBdKS5wcmV2aWV3LnRleHQsICcgICAgICAgIGNvbXBpbGVyLnR5cGVDaGVjaygpO1xcbicpOyAvLyBTZWUgaHR0cHM6Ly9naXRodWIuY29tL0J1cm50U3VzaGkvcmlwZ3JlcC9pc3N1ZXMvMTA5NVxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCg8SVRleHRTZWFyY2hDb250ZXh0PnJlc3VsdHNbMl0ucmVzdWx0cyFbMF0pLmxpbmVOdW1iZXIsIDI2KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPElUZXh0U2VhcmNoQ29udGV4dD5yZXN1bHRzWzJdLnJlc3VsdHMhWzBdKS50ZXh0LCAnICAgICAgICBjb21waWxlci5lbWl0KCk7Jyk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdlcnJvciBtZXNzYWdlcycsICgpID0+IHtcblx0XHR0ZXN0KCdpbnZhbGlkIGVuY29kaW5nJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdC4uLlRFU1RfUk9PVF9GT0xERVIsXG5cdFx0XHRcdFx0XHRmaWxlRW5jb2Rpbmc6ICdpbnZhbGlkRW5jb2RpbmcnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAndGVzdCcgfSxcblx0XHRcdH07XG5cblx0XHRcdHJldHVybiBkb1NlYXJjaFRlc3QoY29uZmlnLCAwKS50aGVuKCgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdleHBlY3RlZCBmYWlsJyk7XG5cdFx0XHR9LCBlcnIgPT4ge1xuXHRcdFx0XHRjb25zdCBzZWFyY2hFcnJvciA9IGRlc2VyaWFsaXplU2VhcmNoRXJyb3IoZXJyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaEVycm9yLm1lc3NhZ2UsICdVbmtub3duIGVuY29kaW5nOiBpbnZhbGlkRW5jb2RpbmcnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaEVycm9yLmNvZGUsIFNlYXJjaEVycm9yQ29kZS51bmtub3duRW5jb2RpbmcpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbnZhbGlkIHJlZ2V4IGNhc2UgMScsICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbmZpZzogSVRleHRRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFJPT1RfRk9MREVSX1FVRVJZLFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnKScsIGlzUmVnRXhwOiB0cnVlIH0sXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgZmFpbCcpO1xuXHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoRXJyb3IgPSBkZXNlcmlhbGl6ZVNlYXJjaEVycm9yKGVycik7XG5cdFx0XHRcdGNvbnN0IHJlZ2V4UGFyc2VFcnJvckZvclVuY2xvc2VkUGFyZW50aGVzaXMgPSAnUmVnZXggcGFyc2UgZXJyb3I6IHVubWF0Y2hlZCBjbG9zaW5nIHBhcmVudGhlc2lzJztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaEVycm9yLm1lc3NhZ2UsIHJlZ2V4UGFyc2VFcnJvckZvclVuY2xvc2VkUGFyZW50aGVzaXMpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VhcmNoRXJyb3IuY29kZSwgU2VhcmNoRXJyb3JDb2RlLnJlZ2V4UGFyc2VFcnJvcik7XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2ludmFsaWQgcmVnZXggY2FzZSAyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY29uZmlnOiBJVGV4dFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogUk9PVF9GT0xERVJfUVVFUlksXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICcoPzwhYS4qKScsIGlzUmVnRXhwOiB0cnVlIH0sXG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgZmFpbCcpO1xuXHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoRXJyb3IgPSBkZXNlcmlhbGl6ZVNlYXJjaEVycm9yKGVycik7XG5cdFx0XHRcdGNvbnN0IHJlZ2V4UGFyc2VFcnJvckZvckxvb2tBcm91bmQgPSAnUmVnZXggcGFyc2UgZXJyb3I6IGxvb2tiZWhpbmQgYXNzZXJ0aW9uIGlzIG5vdCBmaXhlZCBsZW5ndGgnO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VhcmNoRXJyb3IubWVzc2FnZSwgcmVnZXhQYXJzZUVycm9yRm9yTG9va0Fyb3VuZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWFyY2hFcnJvci5jb2RlLCBTZWFyY2hFcnJvckNvZGUucmVnZXhQYXJzZUVycm9yKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXG5cblx0XHR0ZXN0KCdpbnZhbGlkIGdsb2InLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb25maWc6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBST09UX0ZPTERFUl9RVUVSWSxcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ2ZvbycgfSxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQne3t9JzogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRyZXR1cm4gZG9TZWFyY2hUZXN0KGNvbmZpZywgMCkudGhlbigoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXhwZWN0ZWQgZmFpbCcpO1xuXHRcdFx0fSwgZXJyID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VhcmNoRXJyb3IgPSBkZXNlcmlhbGl6ZVNlYXJjaEVycm9yKGVycik7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWFyY2hFcnJvci5tZXNzYWdlLCAnRXJyb3IgcGFyc2luZyBnbG9iIFxcJy97e31cXCc6IG5lc3RlZCBhbHRlcm5hdGUgZ3JvdXBzIGFyZSBub3QgYWxsb3dlZCcpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VhcmNoRXJyb3IuY29kZSwgU2VhcmNoRXJyb3JDb2RlLmdsb2JQYXJzZUVycm9yKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBtYWtlRXhwcmVzc2lvbiguLi5wYXR0ZXJuczogc3RyaW5nW10pOiBnbG9iLklFeHByZXNzaW9uIHtcblx0cmV0dXJuIHBhdHRlcm5zLnJlZHVjZSgoZ2xvYiwgcGF0dGVybikgPT4ge1xuXHRcdC8vIGdsb2IudHMgbmVlZHMgZm9yd2FyZCBzbGFzaGVzXG5cdFx0cGF0dGVybiA9IHBhdHRlcm4ucmVwbGFjZSgvXFxcXC9nLCAnLycpO1xuXHRcdGdsb2JbcGF0dGVybl0gPSB0cnVlO1xuXHRcdHJldHVybiBnbG9iO1xuXHR9LCBPYmplY3QuY3JlYXRlKG51bGwpKTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFVBQVU7QUFDdEIsU0FBUywrQkFBK0I7QUFFeEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsd0JBQXNHLFdBQVcsdUJBQTZDO0FBQ3ZLLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQWtCO0FBRTNCLE1BQU0sZ0JBQWdCLEtBQUssVUFBVSxXQUFXLFVBQVUsaURBQWlELEVBQUUsTUFBTTtBQUNuSCxNQUFNLG9CQUFvQixLQUFLLEtBQUssZUFBZSxVQUFVO0FBQzdELE1BQU0sZ0JBQWdCLEtBQUssS0FBSyxlQUFlLE1BQU07QUFDckQsTUFBTSxtQkFBaUMsRUFBRSxRQUFRLElBQUksS0FBSyxhQUFhLEVBQUU7QUFDekUsTUFBTSxvQkFBb0M7QUFBQSxFQUN6QztBQUNEO0FBRUEsTUFBTSxvQkFBb0M7QUFBQSxFQUN6QyxFQUFFLFFBQVEsSUFBSSxLQUFLLGlCQUFpQixFQUFFO0FBQUEsRUFDdEMsRUFBRSxRQUFRLElBQUksS0FBSyxhQUFhLEVBQUU7QUFDbkM7QUFFQSxTQUFTLGFBQWEsT0FBbUIscUJBQXlFO0FBQ2pILFFBQU0sU0FBUyxJQUFJLHdCQUF3QixLQUFLO0FBRWhELE1BQUksSUFBSTtBQUNSLFFBQU0sVUFBa0MsQ0FBQztBQUN6QyxTQUFPLE9BQU8sT0FBTyxJQUFJLHdCQUF3QixFQUFFLE9BQU8sY0FBWTtBQUNyRSxR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
