import assert from "assert";
import { mapArrayOrNot } from "../../../../base/common/arrays.js";
import { timeout } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { isCancellationError } from "../../../../base/common/errors.js";
import { revive } from "../../../../base/common/marshalling.js";
import { joinPath } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { mock } from "../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { MainContext } from "../../common/extHost.protocol.js";
import { Range } from "../../common/extHostTypes.js";
import { URITransformerService } from "../../common/extHostUriTransformerService.js";
import { NativeExtHostSearch } from "../../node/extHostSearch.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { QueryType, resultIsMatch } from "../../../services/search/common/search.js";
import { NativeTextSearchManager } from "../../../services/search/node/textSearchManager.js";
let rpcProtocol;
let extHostSearch;
let mockMainThreadSearch;
class MockMainThreadSearch {
  constructor() {
    this.results = [];
  }
  $registerFileSearchProvider(handle, scheme) {
    this.lastHandle = handle;
  }
  $registerTextSearchProvider(handle, scheme) {
    this.lastHandle = handle;
  }
  $registerAITextSearchProvider(handle, scheme) {
    this.lastHandle = handle;
  }
  $unregisterProvider(handle) {
  }
  $handleFileMatch(handle, session, data) {
    this.results.push(...data);
  }
  $handleTextMatch(handle, session, data) {
    this.results.push(...data);
  }
  $handleTelemetry(eventName, data) {
  }
  dispose() {
  }
}
let mockPFS;
function extensionResultIsMatch(data) {
  return !!data.preview;
}
suite("ExtHostSearch", () => {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  async function registerTestTextSearchProvider(provider, scheme = "file") {
    disposables.add(extHostSearch.registerTextSearchProviderOld(scheme, provider));
    await rpcProtocol.sync();
  }
  async function registerTestFileSearchProvider(provider, scheme = "file") {
    disposables.add(extHostSearch.registerFileSearchProviderOld(scheme, provider));
    await rpcProtocol.sync();
  }
  async function runFileSearch(query, cancel = false) {
    let stats;
    try {
      const cancellation = new CancellationTokenSource();
      const p = extHostSearch.$provideFileSearchResults(mockMainThreadSearch.lastHandle, 0, query, cancellation.token);
      if (cancel) {
        await timeout(0);
        cancellation.cancel();
      }
      stats = await p;
    } catch (err) {
      if (!isCancellationError(err)) {
        await rpcProtocol.sync();
        throw err;
      }
    }
    await rpcProtocol.sync();
    return {
      results: mockMainThreadSearch.results.map((r) => URI.revive(r)),
      stats
    };
  }
  async function runTextSearch(query) {
    let stats;
    try {
      const cancellation = new CancellationTokenSource();
      const p = extHostSearch.$provideTextSearchResults(mockMainThreadSearch.lastHandle, 0, query, cancellation.token);
      stats = await p;
    } catch (err) {
      if (!isCancellationError(err)) {
        await rpcProtocol.sync();
        throw err;
      }
    }
    await rpcProtocol.sync();
    const results = revive(mockMainThreadSearch.results);
    return { results, stats };
  }
  setup(() => {
    rpcProtocol = new TestRPCProtocol();
    mockMainThreadSearch = new MockMainThreadSearch();
    const logService = new NullLogService();
    rpcProtocol.set(MainContext.MainThreadSearch, mockMainThreadSearch);
    mockPFS = {};
    extHostSearch = disposables.add(new class extends NativeExtHostSearch {
      constructor() {
        super(
          rpcProtocol,
          new class extends mock() {
            constructor() {
              super(...arguments);
              this.remote = { isRemote: false, authority: void 0, connectionData: null };
            }
          }(),
          new URITransformerService(null),
          new class extends mock() {
            async getConfigProvider() {
              return {
                onDidChangeConfiguration(_listener) {
                },
                getConfiguration() {
                  return {
                    get() {
                    },
                    has() {
                      return false;
                    },
                    inspect() {
                      return void 0;
                    },
                    async update() {
                    }
                  };
                }
              };
            }
          }(),
          logService
        );
        this._pfs = mockPFS;
      }
      createTextSearchManager(query, provider) {
        return new NativeTextSearchManager(query, provider, this._pfs);
      }
    }());
  });
  teardown(() => {
    return rpcProtocol.sync();
  });
  const rootFolderA = URI.file("/foo/bar1");
  const rootFolderB = URI.file("/foo/bar2");
  const fancyScheme = "fancy";
  const fancySchemeFolderA = URI.from({ scheme: fancyScheme, path: "/project/folder1" });
  suite("File:", () => {
    function getSimpleQuery(filePattern = "") {
      return {
        type: QueryType.File,
        filePattern,
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
    }
    function compareURIs(actual, expected) {
      const sortAndStringify = (arr) => arr.sort().map((u) => u.toString());
      assert.deepStrictEqual(
        sortAndStringify(actual),
        sortAndStringify(expected)
      );
    }
    test("no results", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query, options, token) {
          return Promise.resolve(null);
        }
      });
      const { results, stats } = await runFileSearch(getSimpleQuery());
      assert(!stats.limitHit);
      assert(!results.length);
    });
    test("simple results", async () => {
      const reportedResults = [
        joinPath(rootFolderA, "file1.ts"),
        joinPath(rootFolderA, "file2.ts"),
        joinPath(rootFolderA, "subfolder/file3.ts")
      ];
      await registerTestFileSearchProvider({
        provideFileSearchResults(query, options, token) {
          return Promise.resolve(reportedResults);
        }
      });
      const { results, stats } = await runFileSearch(getSimpleQuery());
      assert(!stats.limitHit);
      assert.strictEqual(results.length, 3);
      compareURIs(results, reportedResults);
    });
    test("Search canceled", async () => {
      let cancelRequested = false;
      await registerTestFileSearchProvider({
        provideFileSearchResults(query, options, token) {
          return new Promise((resolve, reject) => {
            function onCancel() {
              cancelRequested = true;
              resolve([joinPath(options.folder, "file1.ts")]);
            }
            if (token.isCancellationRequested) {
              onCancel();
            } else {
              disposables.add(token.onCancellationRequested(() => onCancel()));
            }
          });
        }
      });
      const { results } = await runFileSearch(getSimpleQuery(), true);
      assert(cancelRequested);
      assert(!results.length);
    });
    test("session cancellation should work", async () => {
      let numSessionCancelled = 0;
      const disposables2 = [];
      await registerTestFileSearchProvider({
        provideFileSearchResults(query, options, token) {
          disposables2.push(options.session?.onCancellationRequested(() => {
            numSessionCancelled++;
          }));
          return Promise.resolve([]);
        }
      });
      await runFileSearch({ ...getSimpleQuery(), cacheKey: "1" }, true);
      await runFileSearch({ ...getSimpleQuery(), cacheKey: "2" }, true);
      extHostSearch.$clearCache("1");
      assert.strictEqual(numSessionCancelled, 1);
      disposables2.forEach((d) => d?.dispose());
    });
    test("provider returns null", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query, options, token) {
          return null;
        }
      });
      try {
        await runFileSearch(getSimpleQuery());
        assert(false, "Expected to fail");
      } catch {
      }
    });
    test("all provider calls get global include/excludes", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          assert(options.excludes.length === 2 && options.includes.length === 2, "Missing global include/excludes");
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        includePattern: {
          "foo": true,
          "bar": true
        },
        excludePattern: {
          "something": true,
          "else": true
        },
        folderQueries: [
          { folder: rootFolderA },
          { folder: rootFolderB }
        ]
      };
      await runFileSearch(query);
    });
    test("global/local include/excludes combined", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          if (options.folder.toString() === rootFolderA.toString()) {
            assert.deepStrictEqual(options.includes.sort(), ["*.ts", "foo"]);
            assert.deepStrictEqual(options.excludes.sort(), ["*.js", "bar"]);
          } else {
            assert.deepStrictEqual(options.includes.sort(), ["*.ts"]);
            assert.deepStrictEqual(options.excludes.sort(), ["*.js"]);
          }
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        includePattern: {
          "*.ts": true
        },
        excludePattern: {
          "*.js": true
        },
        folderQueries: [
          {
            folder: rootFolderA,
            includePattern: {
              "foo": true
            },
            excludePattern: [{
              pattern: {
                "bar": true
              }
            }]
          },
          { folder: rootFolderB }
        ]
      };
      await runFileSearch(query);
    });
    test("include/excludes resolved correctly", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          assert.deepStrictEqual(options.includes.sort(), ["*.jsx", "*.ts"]);
          assert.deepStrictEqual(options.excludes.sort(), []);
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        includePattern: {
          "*.ts": true,
          "*.jsx": false
        },
        excludePattern: {
          "*.js": true,
          "*.tsx": false
        },
        folderQueries: [
          {
            folder: rootFolderA,
            includePattern: {
              "*.jsx": true
            },
            excludePattern: [{
              pattern: {
                "*.js": false
              }
            }]
          }
        ]
      };
      await runFileSearch(query);
    });
    test("basic sibling exclude clause", async () => {
      const reportedResults = [
        "file1.ts",
        "file1.js"
      ];
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          return Promise.resolve(reportedResults.map((relativePath) => joinPath(options.folder, relativePath)));
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        excludePattern: {
          "*.js": {
            when: "$(basename).ts"
          }
        },
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results } = await runFileSearch(query);
      compareURIs(
        results,
        [
          joinPath(rootFolderA, "file1.ts")
        ]
      );
    });
    test("include, sibling exclude, and subfolder", async () => {
      const reportedResults = [
        "foo/file1.ts",
        "foo/file1.js"
      ];
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          return Promise.resolve(reportedResults.map((relativePath) => joinPath(options.folder, relativePath)));
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        includePattern: { "**/*.ts": true },
        excludePattern: {
          "*.js": {
            when: "$(basename).ts"
          }
        },
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results } = await runFileSearch(query);
      compareURIs(
        results,
        [
          joinPath(rootFolderA, "foo/file1.ts")
        ]
      );
    });
    test("multiroot sibling exclude clause", async () => {
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          let reportedResults;
          if (options.folder.fsPath === rootFolderA.fsPath) {
            reportedResults = [
              "folder/fileA.scss",
              "folder/fileA.css",
              "folder/file2.css"
            ].map((relativePath) => joinPath(rootFolderA, relativePath));
          } else {
            reportedResults = [
              "fileB.ts",
              "fileB.js",
              "file3.js"
            ].map((relativePath) => joinPath(rootFolderB, relativePath));
          }
          return Promise.resolve(reportedResults);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        excludePattern: {
          "*.js": {
            when: "$(basename).ts"
          },
          "*.css": true
        },
        folderQueries: [
          {
            folder: rootFolderA,
            excludePattern: [{
              pattern: {
                "folder/*.css": {
                  when: "$(basename).scss"
                }
              }
            }]
          },
          {
            folder: rootFolderB,
            excludePattern: [{
              pattern: {
                "*.js": false
              }
            }]
          }
        ]
      };
      const { results } = await runFileSearch(query);
      compareURIs(
        results,
        [
          joinPath(rootFolderA, "folder/fileA.scss"),
          joinPath(rootFolderA, "folder/file2.css"),
          joinPath(rootFolderB, "fileB.ts"),
          joinPath(rootFolderB, "fileB.js"),
          joinPath(rootFolderB, "file3.js")
        ]
      );
    });
    test("max results = 1", async () => {
      const reportedResults = [
        joinPath(rootFolderA, "file1.ts"),
        joinPath(rootFolderA, "file2.ts"),
        joinPath(rootFolderA, "file3.ts")
      ];
      let wasCanceled = false;
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          return Promise.resolve(reportedResults);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        maxResults: 1,
        folderQueries: [
          {
            folder: rootFolderA
          }
        ]
      };
      const { results, stats } = await runFileSearch(query);
      assert(stats.limitHit, "Expected to return limitHit");
      assert.strictEqual(results.length, 1);
      compareURIs(results, reportedResults.slice(0, 1));
      assert(wasCanceled, "Expected to be canceled when hitting limit");
    });
    test("max results = 2", async () => {
      const reportedResults = [
        joinPath(rootFolderA, "file1.ts"),
        joinPath(rootFolderA, "file2.ts"),
        joinPath(rootFolderA, "file3.ts")
      ];
      let wasCanceled = false;
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          return Promise.resolve(reportedResults);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        maxResults: 2,
        folderQueries: [
          {
            folder: rootFolderA
          }
        ]
      };
      const { results, stats } = await runFileSearch(query);
      assert(stats.limitHit, "Expected to return limitHit");
      assert.strictEqual(results.length, 2);
      compareURIs(results, reportedResults.slice(0, 2));
      assert(wasCanceled, "Expected to be canceled when hitting limit");
    });
    test("provider returns maxResults exactly", async () => {
      const reportedResults = [
        joinPath(rootFolderA, "file1.ts"),
        joinPath(rootFolderA, "file2.ts")
      ];
      let wasCanceled = false;
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          return Promise.resolve(reportedResults);
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        maxResults: 2,
        folderQueries: [
          {
            folder: rootFolderA
          }
        ]
      };
      const { results, stats } = await runFileSearch(query);
      assert(!stats.limitHit, "Expected not to return limitHit");
      assert.strictEqual(results.length, 2);
      compareURIs(results, reportedResults);
      assert(!wasCanceled, "Expected not to be canceled when just reaching limit");
    });
    test("multiroot max results", async () => {
      let cancels = 0;
      await registerTestFileSearchProvider({
        async provideFileSearchResults(query2, options, token) {
          disposables.add(token.onCancellationRequested(() => cancels++));
          await new Promise((r) => process.nextTick(r));
          return [
            "file1.ts",
            "file2.ts",
            "file3.ts"
          ].map((relativePath) => joinPath(options.folder, relativePath));
        }
      });
      const query = {
        type: QueryType.File,
        filePattern: "",
        maxResults: 2,
        folderQueries: [
          {
            folder: rootFolderA
          },
          {
            folder: rootFolderB
          }
        ]
      };
      const { results } = await runFileSearch(query);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(cancels, 2, "Expected all invocations to be canceled when hitting limit");
    });
    test("works with non-file schemes", async () => {
      const reportedResults = [
        joinPath(fancySchemeFolderA, "file1.ts"),
        joinPath(fancySchemeFolderA, "file2.ts"),
        joinPath(fancySchemeFolderA, "subfolder/file3.ts")
      ];
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          return Promise.resolve(reportedResults);
        }
      }, fancyScheme);
      const query = {
        type: QueryType.File,
        filePattern: "",
        folderQueries: [
          {
            folder: fancySchemeFolderA
          }
        ]
      };
      const { results } = await runFileSearch(query);
      compareURIs(results, reportedResults);
    });
    test("if onlyFileScheme is set, do not call custom schemes", async () => {
      let fancySchemeCalled = false;
      await registerTestFileSearchProvider({
        provideFileSearchResults(query2, options, token) {
          fancySchemeCalled = true;
          return Promise.resolve([]);
        }
      }, fancyScheme);
      const query = {
        type: QueryType.File,
        filePattern: "",
        folderQueries: []
      };
      await runFileSearch(query);
      assert(!fancySchemeCalled);
    });
  });
  suite("Text:", () => {
    function makePreview(text) {
      return {
        matches: [new Range(0, 0, 0, text.length)],
        text
      };
    }
    function makeTextResult(baseFolder, relativePath) {
      return {
        preview: makePreview("foo"),
        ranges: [new Range(0, 0, 0, 3)],
        uri: joinPath(baseFolder, relativePath)
      };
    }
    function getSimpleQuery(queryText) {
      return {
        type: QueryType.Text,
        contentPattern: getPattern(queryText),
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
    }
    function getPattern(queryText) {
      return {
        pattern: queryText
      };
    }
    function assertResults(actual, expected) {
      const actualTextSearchResults = [];
      for (const fileMatch of actual) {
        for (const lineResult of fileMatch.results) {
          if (resultIsMatch(lineResult)) {
            actualTextSearchResults.push({
              preview: {
                text: lineResult.previewText,
                matches: mapArrayOrNot(
                  lineResult.rangeLocations.map((r) => r.preview),
                  (m) => new Range(m.startLineNumber, m.startColumn, m.endLineNumber, m.endColumn)
                )
              },
              ranges: mapArrayOrNot(
                lineResult.rangeLocations.map((r) => r.source),
                (r) => new Range(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn)
              ),
              uri: fileMatch.resource
            });
          } else {
            actualTextSearchResults.push({
              text: lineResult.text,
              lineNumber: lineResult.lineNumber,
              uri: fileMatch.resource
            });
          }
        }
      }
      const rangeToString = (r) => `(${r.start.line}, ${r.start.character}), (${r.end.line}, ${r.end.character})`;
      const makeComparable = (results) => results.sort((a, b) => {
        const compareKeyA = a.uri.toString() + ": " + (extensionResultIsMatch(a) ? a.preview.text : a.text);
        const compareKeyB = b.uri.toString() + ": " + (extensionResultIsMatch(b) ? b.preview.text : b.text);
        return compareKeyB.localeCompare(compareKeyA);
      }).map((r) => extensionResultIsMatch(r) ? {
        uri: r.uri.toString(),
        range: mapArrayOrNot(r.ranges, rangeToString),
        preview: {
          text: r.preview.text,
          match: null
          // Don't care about this right now
        }
      } : {
        uri: r.uri.toString(),
        text: r.text,
        lineNumber: r.lineNumber
      });
      return assert.deepStrictEqual(
        makeComparable(actualTextSearchResults),
        makeComparable(expected)
      );
    }
    test("no results", async () => {
      await registerTestTextSearchProvider({
        provideTextSearchResults(query, options, progress, token) {
          return Promise.resolve(null);
        }
      });
      const { results, stats } = await runTextSearch(getSimpleQuery("foo"));
      assert(!stats.limitHit);
      assert(!results.length);
    });
    test("basic results", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.ts"),
        makeTextResult(rootFolderA, "file2.ts")
      ];
      await registerTestTextSearchProvider({
        provideTextSearchResults(query, options, progress, token) {
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const { results, stats } = await runTextSearch(getSimpleQuery("foo"));
      assert(!stats.limitHit);
      assertResults(results, providedResults);
    });
    test("all provider calls get global include/excludes", async () => {
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          assert.strictEqual(options.includes.length, 1);
          assert.strictEqual(options.excludes.length, 1);
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        includePattern: {
          "*.ts": true
        },
        excludePattern: {
          "*.js": true
        },
        folderQueries: [
          { folder: rootFolderA },
          { folder: rootFolderB }
        ]
      };
      await runTextSearch(query);
    });
    test("global/local include/excludes combined", async () => {
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          if (options.folder.toString() === rootFolderA.toString()) {
            assert.deepStrictEqual(options.includes.sort(), ["*.ts", "foo"]);
            assert.deepStrictEqual(options.excludes.sort(), ["*.js", "bar"]);
          } else {
            assert.deepStrictEqual(options.includes.sort(), ["*.ts"]);
            assert.deepStrictEqual(options.excludes.sort(), ["*.js"]);
          }
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        includePattern: {
          "*.ts": true
        },
        excludePattern: {
          "*.js": true
        },
        folderQueries: [
          {
            folder: rootFolderA,
            includePattern: {
              "foo": true
            },
            excludePattern: [{
              pattern: {
                "bar": true
              }
            }]
          },
          { folder: rootFolderB }
        ]
      };
      await runTextSearch(query);
    });
    test("include/excludes resolved correctly", async () => {
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          assert.deepStrictEqual(options.includes.sort(), ["*.jsx", "*.ts"]);
          assert.deepStrictEqual(options.excludes.sort(), []);
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        includePattern: {
          "*.ts": true,
          "*.jsx": false
        },
        excludePattern: {
          "*.js": true,
          "*.tsx": false
        },
        folderQueries: [
          {
            folder: rootFolderA,
            includePattern: {
              "*.jsx": true
            },
            excludePattern: [{
              pattern: {
                "*.js": false
              }
            }]
          }
        ]
      };
      await runTextSearch(query);
    });
    test("provider fail", async () => {
      await registerTestTextSearchProvider({
        provideTextSearchResults(query, options, progress, token) {
          throw new Error("Provider fail");
        }
      });
      try {
        await runTextSearch(getSimpleQuery("foo"));
        assert(false, "Expected to fail");
      } catch {
      }
    });
    test("basic sibling clause", async () => {
      mockPFS.Promises = {
        readdir: (_path) => {
          if (_path === rootFolderA.fsPath) {
            return Promise.resolve([
              "file1.js",
              "file1.ts"
            ]);
          } else {
            return Promise.reject(new Error("Wrong path"));
          }
        }
      };
      const providedResults = [
        makeTextResult(rootFolderA, "file1.js"),
        makeTextResult(rootFolderA, "file1.ts")
      ];
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        excludePattern: {
          "*.js": {
            when: "$(basename).ts"
          }
        },
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results } = await runTextSearch(query);
      assertResults(results, providedResults.slice(1));
    });
    test("multiroot sibling clause", async () => {
      mockPFS.Promises = {
        readdir: (_path) => {
          if (_path === joinPath(rootFolderA, "folder").fsPath) {
            return Promise.resolve([
              "fileA.scss",
              "fileA.css",
              "file2.css"
            ]);
          } else if (_path === rootFolderB.fsPath) {
            return Promise.resolve([
              "fileB.ts",
              "fileB.js",
              "file3.js"
            ]);
          } else {
            return Promise.reject(new Error("Wrong path"));
          }
        }
      };
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          let reportedResults;
          if (options.folder.fsPath === rootFolderA.fsPath) {
            reportedResults = [
              makeTextResult(rootFolderA, "folder/fileA.scss"),
              makeTextResult(rootFolderA, "folder/fileA.css"),
              makeTextResult(rootFolderA, "folder/file2.css")
            ];
          } else {
            reportedResults = [
              makeTextResult(rootFolderB, "fileB.ts"),
              makeTextResult(rootFolderB, "fileB.js"),
              makeTextResult(rootFolderB, "file3.js")
            ];
          }
          reportedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        excludePattern: {
          "*.js": {
            when: "$(basename).ts"
          },
          "*.css": true
        },
        folderQueries: [
          {
            folder: rootFolderA,
            excludePattern: [{
              pattern: {
                "folder/*.css": {
                  when: "$(basename).scss"
                }
              }
            }]
          },
          {
            folder: rootFolderB,
            excludePattern: [{
              pattern: {
                "*.js": false
              }
            }]
          }
        ]
      };
      const { results } = await runTextSearch(query);
      assertResults(results, [
        makeTextResult(rootFolderA, "folder/fileA.scss"),
        makeTextResult(rootFolderA, "folder/file2.css"),
        makeTextResult(rootFolderB, "fileB.ts"),
        makeTextResult(rootFolderB, "fileB.js"),
        makeTextResult(rootFolderB, "file3.js")
      ]);
    });
    test("include pattern applied", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.js"),
        makeTextResult(rootFolderA, "file1.ts")
      ];
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        includePattern: {
          "*.ts": true
        },
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results } = await runTextSearch(query);
      assertResults(results, providedResults.slice(1));
    });
    test("max results = 1", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.ts"),
        makeTextResult(rootFolderA, "file2.ts")
      ];
      let wasCanceled = false;
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        maxResults: 1,
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results, stats } = await runTextSearch(query);
      assert(stats.limitHit, "Expected to return limitHit");
      assertResults(results, providedResults.slice(0, 1));
      assert(wasCanceled, "Expected to be canceled");
    });
    test("max results = 2", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.ts"),
        makeTextResult(rootFolderA, "file2.ts"),
        makeTextResult(rootFolderA, "file3.ts")
      ];
      let wasCanceled = false;
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        maxResults: 2,
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results, stats } = await runTextSearch(query);
      assert(stats.limitHit, "Expected to return limitHit");
      assertResults(results, providedResults.slice(0, 2));
      assert(wasCanceled, "Expected to be canceled");
    });
    test("provider returns maxResults exactly", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.ts"),
        makeTextResult(rootFolderA, "file2.ts")
      ];
      let wasCanceled = false;
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          disposables.add(token.onCancellationRequested(() => wasCanceled = true));
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        maxResults: 2,
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results, stats } = await runTextSearch(query);
      assert(!stats.limitHit, "Expected not to return limitHit");
      assertResults(results, providedResults);
      assert(!wasCanceled, "Expected not to be canceled");
    });
    test("provider returns early with limitHit", async () => {
      const providedResults = [
        makeTextResult(rootFolderA, "file1.ts"),
        makeTextResult(rootFolderA, "file2.ts"),
        makeTextResult(rootFolderA, "file3.ts")
      ];
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve({ limitHit: true });
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        maxResults: 1e3,
        folderQueries: [
          { folder: rootFolderA }
        ]
      };
      const { results, stats } = await runTextSearch(query);
      assert(stats.limitHit, "Expected to return limitHit");
      assertResults(results, providedResults);
    });
    test("multiroot max results", async () => {
      let cancels = 0;
      await registerTestTextSearchProvider({
        async provideTextSearchResults(query2, options, progress, token) {
          disposables.add(token.onCancellationRequested(() => cancels++));
          await new Promise((r) => process.nextTick(r));
          [
            "file1.ts",
            "file2.ts",
            "file3.ts"
          ].forEach((f) => progress.report(makeTextResult(options.folder, f)));
          return null;
        }
      });
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        maxResults: 2,
        folderQueries: [
          { folder: rootFolderA },
          { folder: rootFolderB }
        ]
      };
      const { results } = await runTextSearch(query);
      assert.strictEqual(results.length, 2);
      assert.strictEqual(cancels, 2);
    });
    test("works with non-file schemes", async () => {
      const providedResults = [
        makeTextResult(fancySchemeFolderA, "file1.ts"),
        makeTextResult(fancySchemeFolderA, "file2.ts"),
        makeTextResult(fancySchemeFolderA, "file3.ts")
      ];
      await registerTestTextSearchProvider({
        provideTextSearchResults(query2, options, progress, token) {
          providedResults.forEach((r) => progress.report(r));
          return Promise.resolve(null);
        }
      }, fancyScheme);
      const query = {
        type: QueryType.Text,
        contentPattern: getPattern("foo"),
        folderQueries: [
          { folder: fancySchemeFolderA }
        ]
      };
      const { results } = await runTextSearch(query);
      assertResults(results, providedResults);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3Qvbm9kZS9leHRIb3N0U2VhcmNoLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBtYXBBcnJheU9yTm90IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IHJldml2ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBwZnMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9ub2RlL3Bmcy5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBNYWluQ29udGV4dCwgTWFpblRocmVhZFNlYXJjaFNoYXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbmZpZ1Byb3ZpZGVyLCBJRXh0SG9zdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RJbml0RGF0YVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdEluaXREYXRhU2VydmljZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJVHJhbnNmb3JtZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RVcmlUcmFuc2Zvcm1lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTmF0aXZlRXh0SG9zdFNlYXJjaCB9IGZyb20gJy4uLy4uL25vZGUvZXh0SG9zdFNlYXJjaC5qcyc7XG5pbXBvcnQgeyBUZXN0UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IElGaWxlTWF0Y2gsIElGaWxlUXVlcnksIElQYXR0ZXJuSW5mbywgSVJhd0ZpbGVNYXRjaDIsIElTZWFyY2hDb21wbGV0ZVN0YXRzLCBJU2VhcmNoUXVlcnksIElUZXh0UXVlcnksIFF1ZXJ5VHlwZSwgcmVzdWx0SXNNYXRjaCB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IFRleHRTZWFyY2hNYW5hZ2VyIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi90ZXh0U2VhcmNoTWFuYWdlci5qcyc7XG5pbXBvcnQgeyBOYXRpdmVUZXh0U2VhcmNoTWFuYWdlciB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9ub2RlL3RleHRTZWFyY2hNYW5hZ2VyLmpzJztcbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5cbmxldCBycGNQcm90b2NvbDogVGVzdFJQQ1Byb3RvY29sO1xubGV0IGV4dEhvc3RTZWFyY2g6IE5hdGl2ZUV4dEhvc3RTZWFyY2g7XG5cbmxldCBtb2NrTWFpblRocmVhZFNlYXJjaDogTW9ja01haW5UaHJlYWRTZWFyY2g7XG5jbGFzcyBNb2NrTWFpblRocmVhZFNlYXJjaCBpbXBsZW1lbnRzIE1haW5UaHJlYWRTZWFyY2hTaGFwZSB7XG5cdGxhc3RIYW5kbGUhOiBudW1iZXI7XG5cblx0cmVzdWx0czogQXJyYXk8VXJpQ29tcG9uZW50cyB8IElSYXdGaWxlTWF0Y2gyPiA9IFtdO1xuXG5cdCRyZWdpc3RlckZpbGVTZWFyY2hQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2NoZW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxhc3RIYW5kbGUgPSBoYW5kbGU7XG5cdH1cblxuXHQkcmVnaXN0ZXJUZXh0U2VhcmNoUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNjaGVtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sYXN0SGFuZGxlID0gaGFuZGxlO1xuXHR9XG5cblx0JHJlZ2lzdGVyQUlUZXh0U2VhcmNoUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNjaGVtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sYXN0SGFuZGxlID0gaGFuZGxlO1xuXHR9XG5cblx0JHVucmVnaXN0ZXJQcm92aWRlcihoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHR9XG5cblx0JGhhbmRsZUZpbGVNYXRjaChoYW5kbGU6IG51bWJlciwgc2Vzc2lvbjogbnVtYmVyLCBkYXRhOiBVcmlDb21wb25lbnRzW10pOiB2b2lkIHtcblx0XHR0aGlzLnJlc3VsdHMucHVzaCguLi5kYXRhKTtcblx0fVxuXG5cdCRoYW5kbGVUZXh0TWF0Y2goaGFuZGxlOiBudW1iZXIsIHNlc3Npb246IG51bWJlciwgZGF0YTogSVJhd0ZpbGVNYXRjaDJbXSk6IHZvaWQge1xuXHRcdHRoaXMucmVzdWx0cy5wdXNoKC4uLmRhdGEpO1xuXHR9XG5cblx0JGhhbmRsZVRlbGVtZXRyeShldmVudE5hbWU6IHN0cmluZywgZGF0YTogYW55KTogdm9pZCB7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHR9XG59XG5cbmxldCBtb2NrUEZTOiBQYXJ0aWFsPHR5cGVvZiBwZnM+O1xuXG5mdW5jdGlvbiBleHRlbnNpb25SZXN1bHRJc01hdGNoKGRhdGE6IHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0KTogZGF0YSBpcyB2c2NvZGUuVGV4dFNlYXJjaE1hdGNoIHtcblx0cmV0dXJuICEhKDx2c2NvZGUuVGV4dFNlYXJjaE1hdGNoPmRhdGEpLnByZXZpZXc7XG59XG5cbnN1aXRlKCdFeHRIb3N0U2VhcmNoJywgKCkgPT4ge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyVGVzdFRleHRTZWFyY2hQcm92aWRlcihwcm92aWRlcjogdnNjb2RlLlRleHRTZWFyY2hQcm92aWRlciwgc2NoZW1lID0gJ2ZpbGUnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3RTZWFyY2gucmVnaXN0ZXJUZXh0U2VhcmNoUHJvdmlkZXJPbGQoc2NoZW1lLCBwcm92aWRlcikpO1xuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcihwcm92aWRlcjogdnNjb2RlLkZpbGVTZWFyY2hQcm92aWRlciwgc2NoZW1lID0gJ2ZpbGUnKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3RTZWFyY2gucmVnaXN0ZXJGaWxlU2VhcmNoUHJvdmlkZXJPbGQoc2NoZW1lLCBwcm92aWRlcikpO1xuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0fVxuXG5cdGFzeW5jIGZ1bmN0aW9uIHJ1bkZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIGNhbmNlbCA9IGZhbHNlKTogUHJvbWlzZTx7IHJlc3VsdHM6IFVSSVtdOyBzdGF0czogSVNlYXJjaENvbXBsZXRlU3RhdHMgfT4ge1xuXHRcdGxldCBzdGF0czogSVNlYXJjaENvbXBsZXRlU3RhdHM7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGNhbmNlbGxhdGlvbiA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0Y29uc3QgcCA9IGV4dEhvc3RTZWFyY2guJHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhtb2NrTWFpblRocmVhZFNlYXJjaC5sYXN0SGFuZGxlLCAwLCBxdWVyeSwgY2FuY2VsbGF0aW9uLnRva2VuKTtcblx0XHRcdGlmIChjYW5jZWwpIHtcblx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdFx0Y2FuY2VsbGF0aW9uLmNhbmNlbCgpO1xuXHRcdFx0fVxuXG5cdFx0XHRzdGF0cyA9IGF3YWl0IHA7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRpZiAoIWlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSkge1xuXHRcdFx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0XHRcdHRocm93IGVycjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlc3VsdHM6ICg8VXJpQ29tcG9uZW50c1tdPm1vY2tNYWluVGhyZWFkU2VhcmNoLnJlc3VsdHMpLm1hcChyID0+IFVSSS5yZXZpdmUocikpLFxuXHRcdFx0c3RhdHM6IHN0YXRzIVxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBmdW5jdGlvbiBydW5UZXh0U2VhcmNoKHF1ZXJ5OiBJVGV4dFF1ZXJ5KTogUHJvbWlzZTx7IHJlc3VsdHM6IElGaWxlTWF0Y2hbXTsgc3RhdHM6IElTZWFyY2hDb21wbGV0ZVN0YXRzIH0+IHtcblx0XHRsZXQgc3RhdHM6IElTZWFyY2hDb21wbGV0ZVN0YXRzO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBjYW5jZWxsYXRpb24gPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdGNvbnN0IHAgPSBleHRIb3N0U2VhcmNoLiRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMobW9ja01haW5UaHJlYWRTZWFyY2gubGFzdEhhbmRsZSwgMCwgcXVlcnksIGNhbmNlbGxhdGlvbi50b2tlbik7XG5cblx0XHRcdHN0YXRzID0gYXdhaXQgcDtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdFx0dGhyb3cgZXJyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCByZXN1bHRzOiBJRmlsZU1hdGNoW10gPSByZXZpdmUoPElSYXdGaWxlTWF0Y2gyW10+bW9ja01haW5UaHJlYWRTZWFyY2gucmVzdWx0cyk7XG5cblx0XHRyZXR1cm4geyByZXN1bHRzLCBzdGF0czogc3RhdHMhIH07XG5cdH1cblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0cnBjUHJvdG9jb2wgPSBuZXcgVGVzdFJQQ1Byb3RvY29sKCk7XG5cblx0XHRtb2NrTWFpblRocmVhZFNlYXJjaCA9IG5ldyBNb2NrTWFpblRocmVhZFNlYXJjaCgpO1xuXHRcdGNvbnN0IGxvZ1NlcnZpY2UgPSBuZXcgTnVsbExvZ1NlcnZpY2UoKTtcblxuXHRcdHJwY1Byb3RvY29sLnNldChNYWluQ29udGV4dC5NYWluVGhyZWFkU2VhcmNoLCBtb2NrTWFpblRocmVhZFNlYXJjaCk7XG5cblx0XHRtb2NrUEZTID0ge307XG5cdFx0ZXh0SG9zdFNlYXJjaCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgY2xhc3MgZXh0ZW5kcyBOYXRpdmVFeHRIb3N0U2VhcmNoIHtcblx0XHRcdGNvbnN0cnVjdG9yKCkge1xuXHRcdFx0XHRzdXBlcihcblx0XHRcdFx0XHRycGNQcm90b2NvbCxcblx0XHRcdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0SW5pdERhdGFTZXJ2aWNlPigpIHsgb3ZlcnJpZGUgcmVtb3RlID0geyBpc1JlbW90ZTogZmFsc2UsIGF1dGhvcml0eTogdW5kZWZpbmVkLCBjb25uZWN0aW9uRGF0YTogbnVsbCB9OyB9LFxuXHRcdFx0XHRcdG5ldyBVUklUcmFuc2Zvcm1lclNlcnZpY2UobnVsbCksXG5cdFx0XHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRXh0SG9zdENvbmZpZ3VyYXRpb24+KCkge1xuXHRcdFx0XHRcdFx0b3ZlcnJpZGUgYXN5bmMgZ2V0Q29uZmlnUHJvdmlkZXIoKTogUHJvbWlzZTxFeHRIb3N0Q29uZmlnUHJvdmlkZXI+IHtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0XHRvbkRpZENoYW5nZUNvbmZpZ3VyYXRpb24oX2xpc3RlbmVyOiAoZXZlbnQ6IHZzY29kZS5Db25maWd1cmF0aW9uQ2hhbmdlRXZlbnQpID0+IHZvaWQpIHsgfSxcblx0XHRcdFx0XHRcdFx0XHRnZXRDb25maWd1cmF0aW9uKCk6IHZzY29kZS5Xb3Jrc3BhY2VDb25maWd1cmF0aW9uIHtcblx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGdldCgpIHsgfSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0aGFzKCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRcdFx0aW5zcGVjdCgpIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRhc3luYyB1cGRhdGUoKSB7IH1cblx0XHRcdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHRcdFx0fSxcblxuXHRcdFx0XHRcdFx0XHR9IGFzIEV4dEhvc3RDb25maWdQcm92aWRlcjtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGxvZ1NlcnZpY2Vcblx0XHRcdFx0KTtcblx0XHRcdFx0dGhpcy5fcGZzID0gbW9ja1BGUyBhcyBhbnk7XG5cdFx0XHR9XG5cblx0XHRcdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVUZXh0U2VhcmNoTWFuYWdlcihxdWVyeTogSVRleHRRdWVyeSwgcHJvdmlkZXI6IHZzY29kZS5UZXh0U2VhcmNoUHJvdmlkZXIyKTogVGV4dFNlYXJjaE1hbmFnZXIge1xuXHRcdFx0XHRyZXR1cm4gbmV3IE5hdGl2ZVRleHRTZWFyY2hNYW5hZ2VyKHF1ZXJ5LCBwcm92aWRlciwgdGhpcy5fcGZzKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCk7XG5cdH0pO1xuXG5cdGNvbnN0IHJvb3RGb2xkZXJBID0gVVJJLmZpbGUoJy9mb28vYmFyMScpO1xuXHRjb25zdCByb290Rm9sZGVyQiA9IFVSSS5maWxlKCcvZm9vL2JhcjInKTtcblx0Y29uc3QgZmFuY3lTY2hlbWUgPSAnZmFuY3knO1xuXHRjb25zdCBmYW5jeVNjaGVtZUZvbGRlckEgPSBVUkkuZnJvbSh7IHNjaGVtZTogZmFuY3lTY2hlbWUsIHBhdGg6ICcvcHJvamVjdC9mb2xkZXIxJyB9KTtcblxuXHRzdWl0ZSgnRmlsZTonLCAoKSA9PiB7XG5cblx0XHRmdW5jdGlvbiBnZXRTaW1wbGVRdWVyeShmaWxlUGF0dGVybiA9ICcnKTogSUZpbGVRdWVyeSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblxuXHRcdFx0XHRmaWxlUGF0dGVybixcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHsgZm9sZGVyOiByb290Rm9sZGVyQSB9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gY29tcGFyZVVSSXMoYWN0dWFsOiBVUklbXSwgZXhwZWN0ZWQ6IFVSSVtdKSB7XG5cdFx0XHRjb25zdCBzb3J0QW5kU3RyaW5naWZ5ID0gKGFycjogVVJJW10pID0+IGFyci5zb3J0KCkubWFwKHUgPT4gdS50b1N0cmluZygpKTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0c29ydEFuZFN0cmluZ2lmeShhY3R1YWwpLFxuXHRcdFx0XHRzb3J0QW5kU3RyaW5naWZ5KGV4cGVjdGVkKSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnbm8gcmVzdWx0cycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgeyByZXN1bHRzLCBzdGF0cyB9ID0gYXdhaXQgcnVuRmlsZVNlYXJjaChnZXRTaW1wbGVRdWVyeSgpKTtcblx0XHRcdGFzc2VydCghc3RhdHMubGltaXRIaXQpO1xuXHRcdFx0YXNzZXJ0KCFyZXN1bHRzLmxlbmd0aCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaW1wbGUgcmVzdWx0cycsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlcG9ydGVkUmVzdWx0cyA9IFtcblx0XHRcdFx0am9pblBhdGgocm9vdEZvbGRlckEsICdmaWxlMS50cycpLFxuXHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnc3ViZm9sZGVyL2ZpbGUzLnRzJylcblx0XHRcdF07XG5cblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocmVwb3J0ZWRSZXN1bHRzKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHsgcmVzdWx0cywgc3RhdHMgfSA9IGF3YWl0IHJ1bkZpbGVTZWFyY2goZ2V0U2ltcGxlUXVlcnkoKSk7XG5cdFx0XHRhc3NlcnQoIXN0YXRzLmxpbWl0SGl0KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRzLmxlbmd0aCwgMyk7XG5cdFx0XHRjb21wYXJlVVJJcyhyZXN1bHRzLCByZXBvcnRlZFJlc3VsdHMpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnU2VhcmNoIGNhbmNlbGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGNhbmNlbFJlcXVlc3RlZCA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cblx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdFx0ZnVuY3Rpb24gb25DYW5jZWwoKSB7XG5cdFx0XHRcdFx0XHRcdGNhbmNlbFJlcXVlc3RlZCA9IHRydWU7XG5cblx0XHRcdFx0XHRcdFx0cmVzb2x2ZShbam9pblBhdGgob3B0aW9ucy5mb2xkZXIsICdmaWxlMS50cycpXSk7IC8vIG9yIHJlamVjdCBvciBub3RoaW5nP1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdFx0b25DYW5jZWwoKTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiBvbkNhbmNlbCgpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1bkZpbGVTZWFyY2goZ2V0U2ltcGxlUXVlcnkoKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQoY2FuY2VsUmVxdWVzdGVkKTtcblx0XHRcdGFzc2VydCghcmVzdWx0cy5sZW5ndGgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2Vzc2lvbiBjYW5jZWxsYXRpb24gc2hvdWxkIHdvcmsnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgbnVtU2Vzc2lvbkNhbmNlbGxlZCA9IDA7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlczogKHZzY29kZS5EaXNwb3NhYmxlIHwgdW5kZWZpbmVkKVtdID0gW107XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RGaWxlU2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlRmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5GaWxlU2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5GaWxlU2VhcmNoT3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10+IHtcblxuXHRcdFx0XHRcdGRpc3Bvc2FibGVzLnB1c2gob3B0aW9ucy5zZXNzaW9uPy5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0XHRudW1TZXNzaW9uQ2FuY2VsbGVkKys7XG5cdFx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cblx0XHRcdGF3YWl0IHJ1bkZpbGVTZWFyY2goeyAuLi5nZXRTaW1wbGVRdWVyeSgpLCBjYWNoZUtleTogJzEnIH0sIHRydWUpO1xuXHRcdFx0YXdhaXQgcnVuRmlsZVNlYXJjaCh7IC4uLmdldFNpbXBsZVF1ZXJ5KCksIGNhY2hlS2V5OiAnMicgfSwgdHJ1ZSk7XG5cdFx0XHRleHRIb3N0U2VhcmNoLiRjbGVhckNhY2hlKCcxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobnVtU2Vzc2lvbkNhbmNlbGxlZCwgMSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5mb3JFYWNoKGQgPT4gZD8uZGlzcG9zZSgpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Byb3ZpZGVyIHJldHVybnMgbnVsbCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdHJldHVybiBudWxsITtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHJ1bkZpbGVTZWFyY2goZ2V0U2ltcGxlUXVlcnkoKSk7XG5cdFx0XHRcdGFzc2VydChmYWxzZSwgJ0V4cGVjdGVkIHRvIGZhaWwnKTtcblx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHQvLyBFeHBlY3RlZCB0byB0aHJvd1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0dGVzdCgnYWxsIHByb3ZpZGVyIGNhbGxzIGdldCBnbG9iYWwgaW5jbHVkZS9leGNsdWRlcycsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdGFzc2VydChvcHRpb25zLmV4Y2x1ZGVzLmxlbmd0aCA9PT0gMiAmJiBvcHRpb25zLmluY2x1ZGVzLmxlbmd0aCA9PT0gMiwgJ01pc3NpbmcgZ2xvYmFsIGluY2x1ZGUvZXhjbHVkZXMnKTtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXG5cdFx0XHRcdGZpbGVQYXR0ZXJuOiAnJyxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnZm9vJzogdHJ1ZSxcblx0XHRcdFx0XHQnYmFyJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCdzb21ldGhpbmcnOiB0cnVlLFxuXHRcdFx0XHRcdCdlbHNlJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJBIH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJCIH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgcnVuRmlsZVNlYXJjaChxdWVyeSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdnbG9iYWwvbG9jYWwgaW5jbHVkZS9leGNsdWRlcyBjb21iaW5lZCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdGlmIChvcHRpb25zLmZvbGRlci50b1N0cmluZygpID09PSByb290Rm9sZGVyQS50b1N0cmluZygpKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuaW5jbHVkZXMuc29ydCgpLCBbJyoudHMnLCAnZm9vJ10pO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcHRpb25zLmV4Y2x1ZGVzLnNvcnQoKSwgWycqLmpzJywgJ2JhciddKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcHRpb25zLmluY2x1ZGVzLnNvcnQoKSwgWycqLnRzJ10pO1xuXHRcdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcHRpb25zLmV4Y2x1ZGVzLnNvcnQoKSwgWycqLmpzJ10pO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLnRzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLmpzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Zm9sZGVyOiByb290Rm9sZGVyQSxcblx0XHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdCdmb28nOiB0cnVlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0XHQnYmFyJzogdHJ1ZVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJCIH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgcnVuRmlsZVNlYXJjaChxdWVyeSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbmNsdWRlL2V4Y2x1ZGVzIHJlc29sdmVkIGNvcnJlY3RseScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdEZpbGVTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVGaWxlU2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLkZpbGVTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLkZpbGVTZWFyY2hPcHRpb25zLCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxVUklbXT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3B0aW9ucy5pbmNsdWRlcy5zb3J0KCksIFsnKi5qc3gnLCAnKi50cyddKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuZXhjbHVkZXMuc29ydCgpLCBbXSk7XG5cblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXG5cdFx0XHRcdGZpbGVQYXR0ZXJuOiAnJyxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi50cyc6IHRydWUsXG5cdFx0XHRcdFx0JyouanN4JzogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi5qcyc6IHRydWUsXG5cdFx0XHRcdFx0JyoudHN4JzogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcm9vdEZvbGRlckEsXG5cdFx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHQnKi5qc3gnOiB0cnVlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0XHQnKi5qcyc6IGZhbHNlXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCBydW5GaWxlU2VhcmNoKHF1ZXJ5KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Jhc2ljIHNpYmxpbmcgZXhjbHVkZSBjbGF1c2UnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXBvcnRlZFJlc3VsdHMgPSBbXG5cdFx0XHRcdCdmaWxlMS50cycsXG5cdFx0XHRcdCdmaWxlMS5qcycsXG5cdFx0XHRdO1xuXG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RGaWxlU2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlRmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5GaWxlU2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5GaWxlU2VhcmNoT3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10+IHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG9ydGVkUmVzdWx0c1xuXHRcdFx0XHRcdFx0Lm1hcChyZWxhdGl2ZVBhdGggPT4gam9pblBhdGgob3B0aW9ucy5mb2xkZXIsIHJlbGF0aXZlUGF0aCkpKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXG5cdFx0XHRcdGZpbGVQYXR0ZXJuOiAnJyxcblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi5qcyc6IHtcblx0XHRcdFx0XHRcdHdoZW46ICckKGJhc2VuYW1lKS50cydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1bkZpbGVTZWFyY2gocXVlcnkpO1xuXHRcdFx0Y29tcGFyZVVSSXMoXG5cdFx0XHRcdHJlc3VsdHMsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZpbGUxLnRzJylcblx0XHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS1yZW1vdGVodWIvaXNzdWVzLzI1NVxuXHRcdHRlc3QoJ2luY2x1ZGUsIHNpYmxpbmcgZXhjbHVkZSwgYW5kIHN1YmZvbGRlcicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlcG9ydGVkUmVzdWx0cyA9IFtcblx0XHRcdFx0J2Zvby9maWxlMS50cycsXG5cdFx0XHRcdCdmb28vZmlsZTEuanMnLFxuXHRcdFx0XTtcblxuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvcnRlZFJlc3VsdHNcblx0XHRcdFx0XHRcdC5tYXAocmVsYXRpdmVQYXRoID0+IGpvaW5QYXRoKG9wdGlvbnMuZm9sZGVyLCByZWxhdGl2ZVBhdGgpKSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBxdWVyeTogSVNlYXJjaFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblxuXHRcdFx0XHRmaWxlUGF0dGVybjogJycsXG5cdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7ICcqKi8qLnRzJzogdHJ1ZSB9LFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLmpzJzoge1xuXHRcdFx0XHRcdFx0d2hlbjogJyQoYmFzZW5hbWUpLnRzJ1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHsgZm9sZGVyOiByb290Rm9sZGVyQSB9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHsgcmVzdWx0cyB9ID0gYXdhaXQgcnVuRmlsZVNlYXJjaChxdWVyeSk7XG5cdFx0XHRjb21wYXJlVVJJcyhcblx0XHRcdFx0cmVzdWx0cyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnZm9vL2ZpbGUxLnRzJylcblx0XHRcdFx0XSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXJvb3Qgc2libGluZyBleGNsdWRlIGNsYXVzZScsIGFzeW5jICgpID0+IHtcblxuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0XHRcdFx0bGV0IHJlcG9ydGVkUmVzdWx0czogVVJJW107XG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMuZm9sZGVyLmZzUGF0aCA9PT0gcm9vdEZvbGRlckEuZnNQYXRoKSB7XG5cdFx0XHRcdFx0XHRyZXBvcnRlZFJlc3VsdHMgPSBbXG5cdFx0XHRcdFx0XHRcdCdmb2xkZXIvZmlsZUEuc2NzcycsXG5cdFx0XHRcdFx0XHRcdCdmb2xkZXIvZmlsZUEuY3NzJyxcblx0XHRcdFx0XHRcdFx0J2ZvbGRlci9maWxlMi5jc3MnXG5cdFx0XHRcdFx0XHRdLm1hcChyZWxhdGl2ZVBhdGggPT4gam9pblBhdGgocm9vdEZvbGRlckEsIHJlbGF0aXZlUGF0aCkpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXBvcnRlZFJlc3VsdHMgPSBbXG5cdFx0XHRcdFx0XHRcdCdmaWxlQi50cycsXG5cdFx0XHRcdFx0XHRcdCdmaWxlQi5qcycsXG5cdFx0XHRcdFx0XHRcdCdmaWxlMy5qcydcblx0XHRcdFx0XHRcdF0ubWFwKHJlbGF0aXZlUGF0aCA9PiBqb2luUGF0aChyb290Rm9sZGVyQiwgcmVsYXRpdmVQYXRoKSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvcnRlZFJlc3VsdHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLmpzJzoge1xuXHRcdFx0XHRcdFx0d2hlbjogJyQoYmFzZW5hbWUpLnRzJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0JyouY3NzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Zm9sZGVyOiByb290Rm9sZGVyQSxcblx0XHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBbe1xuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdFx0J2ZvbGRlci8qLmNzcyc6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHdoZW46ICckKGJhc2VuYW1lKS5zY3NzJ1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcm9vdEZvbGRlckIsXG5cdFx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3tcblx0XHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRcdCcqLmpzJzogZmFsc2Vcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHsgcmVzdWx0cyB9ID0gYXdhaXQgcnVuRmlsZVNlYXJjaChxdWVyeSk7XG5cdFx0XHRjb21wYXJlVVJJcyhcblx0XHRcdFx0cmVzdWx0cyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnZm9sZGVyL2ZpbGVBLnNjc3MnKSxcblx0XHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZvbGRlci9maWxlMi5jc3MnKSxcblxuXHRcdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJCLCAnZmlsZUIudHMnKSxcblx0XHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQiwgJ2ZpbGVCLmpzJyksXG5cdFx0XHRcdFx0am9pblBhdGgocm9vdEZvbGRlckIsICdmaWxlMy5qcycpLFxuXHRcdFx0XHRdKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21heCByZXN1bHRzID0gMScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlcG9ydGVkUmVzdWx0cyA9IFtcblx0XHRcdFx0am9pblBhdGgocm9vdEZvbGRlckEsICdmaWxlMS50cycpLFxuXHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnZmlsZTMudHMnKSxcblx0XHRcdF07XG5cblx0XHRcdGxldCB3YXNDYW5jZWxlZCA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHdhc0NhbmNlbGVkID0gdHJ1ZSkpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvcnRlZFJlc3VsdHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRtYXhSZXN1bHRzOiAxLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJBXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5GaWxlU2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydChzdGF0cy5saW1pdEhpdCwgJ0V4cGVjdGVkIHRvIHJldHVybiBsaW1pdEhpdCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdHMubGVuZ3RoLCAxKTtcblx0XHRcdGNvbXBhcmVVUklzKHJlc3VsdHMsIHJlcG9ydGVkUmVzdWx0cy5zbGljZSgwLCAxKSk7XG5cdFx0XHRhc3NlcnQod2FzQ2FuY2VsZWQsICdFeHBlY3RlZCB0byBiZSBjYW5jZWxlZCB3aGVuIGhpdHRpbmcgbGltaXQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21heCByZXN1bHRzID0gMicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHJlcG9ydGVkUmVzdWx0cyA9IFtcblx0XHRcdFx0am9pblBhdGgocm9vdEZvbGRlckEsICdmaWxlMS50cycpLFxuXHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnZmlsZTMudHMnKSxcblx0XHRcdF07XG5cblx0XHRcdGxldCB3YXNDYW5jZWxlZCA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHdhc0NhbmNlbGVkID0gdHJ1ZSkpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvcnRlZFJlc3VsdHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRtYXhSZXN1bHRzOiAyLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJBXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5GaWxlU2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydChzdGF0cy5saW1pdEhpdCwgJ0V4cGVjdGVkIHRvIHJldHVybiBsaW1pdEhpdCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdHMubGVuZ3RoLCAyKTtcblx0XHRcdGNvbXBhcmVVUklzKHJlc3VsdHMsIHJlcG9ydGVkUmVzdWx0cy5zbGljZSgwLCAyKSk7XG5cdFx0XHRhc3NlcnQod2FzQ2FuY2VsZWQsICdFeHBlY3RlZCB0byBiZSBjYW5jZWxlZCB3aGVuIGhpdHRpbmcgbGltaXQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Byb3ZpZGVyIHJldHVybnMgbWF4UmVzdWx0cyBleGFjdGx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcmVwb3J0ZWRSZXN1bHRzID0gW1xuXHRcdFx0XHRqb2luUGF0aChyb290Rm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKHJvb3RGb2xkZXJBLCAnZmlsZTIudHMnKSxcblx0XHRcdF07XG5cblx0XHRcdGxldCB3YXNDYW5jZWxlZCA9IGZhbHNlO1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0RmlsZVNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZUZpbGVTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuRmlsZVNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuRmlsZVNlYXJjaE9wdGlvbnMsIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFVSSVtdPiB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHdhc0NhbmNlbGVkID0gdHJ1ZSkpO1xuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXBvcnRlZFJlc3VsdHMpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRtYXhSZXN1bHRzOiAyLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJBXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5GaWxlU2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydCghc3RhdHMubGltaXRIaXQsICdFeHBlY3RlZCBub3QgdG8gcmV0dXJuIGxpbWl0SGl0Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0cy5sZW5ndGgsIDIpO1xuXHRcdFx0Y29tcGFyZVVSSXMocmVzdWx0cywgcmVwb3J0ZWRSZXN1bHRzKTtcblx0XHRcdGFzc2VydCghd2FzQ2FuY2VsZWQsICdFeHBlY3RlZCBub3QgdG8gYmUgY2FuY2VsZWQgd2hlbiBqdXN0IHJlYWNoaW5nIGxpbWl0Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXJvb3QgbWF4IHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY2FuY2VscyA9IDA7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RGaWxlU2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRhc3luYyBwcm92aWRlRmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5GaWxlU2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5GaWxlU2VhcmNoT3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gY2FuY2VscysrKSk7XG5cblx0XHRcdFx0XHQvLyBQcm92aWNlIHJlc3VsdHMgYXN5bmMgc28gaXQgaGFzIGEgY2hhbmNlIHRvIGludm9rZSBldmVyeSBwcm92aWRlclxuXHRcdFx0XHRcdGF3YWl0IG5ldyBQcm9taXNlKHIgPT4gcHJvY2Vzcy5uZXh0VGljayhyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRcdCdmaWxlMS50cycsXG5cdFx0XHRcdFx0XHQnZmlsZTIudHMnLFxuXHRcdFx0XHRcdFx0J2ZpbGUzLnRzJyxcblx0XHRcdFx0XHRdLm1hcChyZWxhdGl2ZVBhdGggPT4gam9pblBhdGgob3B0aW9ucy5mb2xkZXIsIHJlbGF0aXZlUGF0aCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cblx0XHRcdFx0ZmlsZVBhdHRlcm46ICcnLFxuXHRcdFx0XHRtYXhSZXN1bHRzOiAyLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJBXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJCXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1bkZpbGVTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdHMubGVuZ3RoLCAyKTsgLy8gRG9uJ3QgY2FyZSB3aGljaCAyIHdlIGdvdFxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbmNlbHMsIDIsICdFeHBlY3RlZCBhbGwgaW52b2NhdGlvbnMgdG8gYmUgY2FuY2VsZWQgd2hlbiBoaXR0aW5nIGxpbWl0Jyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3b3JrcyB3aXRoIG5vbi1maWxlIHNjaGVtZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCByZXBvcnRlZFJlc3VsdHMgPSBbXG5cdFx0XHRcdGpvaW5QYXRoKGZhbmN5U2NoZW1lRm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKGZhbmN5U2NoZW1lRm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdGpvaW5QYXRoKGZhbmN5U2NoZW1lRm9sZGVyQSwgJ3N1YmZvbGRlci9maWxlMy50cycpLFxuXG5cdFx0XHRdO1xuXG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RGaWxlU2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlRmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5GaWxlU2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5GaWxlU2VhcmNoT3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10+IHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHJlcG9ydGVkUmVzdWx0cyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZhbmN5U2NoZW1lKTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRcdGZpbGVQYXR0ZXJuOiAnJyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZvbGRlcjogZmFuY3lTY2hlbWVGb2xkZXJBXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1bkZpbGVTZWFyY2gocXVlcnkpO1xuXHRcdFx0Y29tcGFyZVVSSXMocmVzdWx0cywgcmVwb3J0ZWRSZXN1bHRzKTtcblx0XHR9KTtcblx0XHR0ZXN0KCdpZiBvbmx5RmlsZVNjaGVtZSBpcyBzZXQsIGRvIG5vdCBjYWxsIGN1c3RvbSBzY2hlbWVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGV0IGZhbmN5U2NoZW1lQ2FsbGVkID0gZmFsc2U7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RGaWxlU2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlRmlsZVNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5GaWxlU2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5GaWxlU2VhcmNoT3B0aW9ucywgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VVJJW10+IHtcblx0XHRcdFx0XHRmYW5jeVNjaGVtZUNhbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIGZhbmN5U2NoZW1lKTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGUsXG5cdFx0XHRcdGZpbGVQYXR0ZXJuOiAnJyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW11cblx0XHRcdH07XG5cblx0XHRcdGF3YWl0IHJ1bkZpbGVTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0KCFmYW5jeVNjaGVtZUNhbGxlZCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdUZXh0OicsICgpID0+IHtcblxuXHRcdGZ1bmN0aW9uIG1ha2VQcmV2aWV3KHRleHQ6IHN0cmluZyk6IHZzY29kZS5UZXh0U2VhcmNoTWF0Y2hbJ3ByZXZpZXcnXSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRtYXRjaGVzOiBbbmV3IFJhbmdlKDAsIDAsIDAsIHRleHQubGVuZ3RoKV0sXG5cdFx0XHRcdHRleHRcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gbWFrZVRleHRSZXN1bHQoYmFzZUZvbGRlcjogVVJJLCByZWxhdGl2ZVBhdGg6IHN0cmluZyk6IHZzY29kZS5UZXh0U2VhcmNoTWF0Y2gge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cHJldmlldzogbWFrZVByZXZpZXcoJ2ZvbycpLFxuXHRcdFx0XHRyYW5nZXM6IFtuZXcgUmFuZ2UoMCwgMCwgMCwgMyldLFxuXHRcdFx0XHR1cmk6IGpvaW5QYXRoKGJhc2VGb2xkZXIsIHJlbGF0aXZlUGF0aClcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gZ2V0U2ltcGxlUXVlcnkocXVlcnlUZXh0OiBzdHJpbmcpOiBJVGV4dFF1ZXJ5IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogZ2V0UGF0dGVybihxdWVyeVRleHQpLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGdldFBhdHRlcm4ocXVlcnlUZXh0OiBzdHJpbmcpOiBJUGF0dGVybkluZm8ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cGF0dGVybjogcXVlcnlUZXh0XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdGZ1bmN0aW9uIGFzc2VydFJlc3VsdHMoYWN0dWFsOiBJRmlsZU1hdGNoW10sIGV4cGVjdGVkOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdKSB7XG5cdFx0XHRjb25zdCBhY3R1YWxUZXh0U2VhcmNoUmVzdWx0czogdnNjb2RlLlRleHRTZWFyY2hSZXN1bHRbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBmaWxlTWF0Y2ggb2YgYWN0dWFsKSB7XG5cdFx0XHRcdC8vIE1ha2UgcmVsYXRpdmVcblx0XHRcdFx0Zm9yIChjb25zdCBsaW5lUmVzdWx0IG9mIGZpbGVNYXRjaC5yZXN1bHRzISkge1xuXHRcdFx0XHRcdGlmIChyZXN1bHRJc01hdGNoKGxpbmVSZXN1bHQpKSB7XG5cdFx0XHRcdFx0XHRhY3R1YWxUZXh0U2VhcmNoUmVzdWx0cy5wdXNoKHtcblx0XHRcdFx0XHRcdFx0cHJldmlldzoge1xuXHRcdFx0XHRcdFx0XHRcdHRleHQ6IGxpbmVSZXN1bHQucHJldmlld1RleHQsXG5cdFx0XHRcdFx0XHRcdFx0bWF0Y2hlczogbWFwQXJyYXlPck5vdChcblx0XHRcdFx0XHRcdFx0XHRcdGxpbmVSZXN1bHQucmFuZ2VMb2NhdGlvbnMubWFwKHIgPT4gci5wcmV2aWV3KSxcblx0XHRcdFx0XHRcdFx0XHRcdG0gPT4gbmV3IFJhbmdlKG0uc3RhcnRMaW5lTnVtYmVyLCBtLnN0YXJ0Q29sdW1uLCBtLmVuZExpbmVOdW1iZXIsIG0uZW5kQ29sdW1uKSlcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0cmFuZ2VzOiBtYXBBcnJheU9yTm90KFxuXHRcdFx0XHRcdFx0XHRcdGxpbmVSZXN1bHQucmFuZ2VMb2NhdGlvbnMubWFwKHIgPT4gci5zb3VyY2UpLFxuXHRcdFx0XHRcdFx0XHRcdHIgPT4gbmV3IFJhbmdlKHIuc3RhcnRMaW5lTnVtYmVyLCByLnN0YXJ0Q29sdW1uLCByLmVuZExpbmVOdW1iZXIsIHIuZW5kQ29sdW1uKSxcblx0XHRcdFx0XHRcdFx0KSxcblx0XHRcdFx0XHRcdFx0dXJpOiBmaWxlTWF0Y2gucmVzb3VyY2Vcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhY3R1YWxUZXh0U2VhcmNoUmVzdWx0cy5wdXNoKDx2c2NvZGUuVGV4dFNlYXJjaENvbnRleHQ+e1xuXHRcdFx0XHRcdFx0XHR0ZXh0OiBsaW5lUmVzdWx0LnRleHQsXG5cdFx0XHRcdFx0XHRcdGxpbmVOdW1iZXI6IGxpbmVSZXN1bHQubGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0dXJpOiBmaWxlTWF0Y2gucmVzb3VyY2Vcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCByYW5nZVRvU3RyaW5nID0gKHI6IHZzY29kZS5SYW5nZSkgPT4gYCgke3Iuc3RhcnQubGluZX0sICR7ci5zdGFydC5jaGFyYWN0ZXJ9KSwgKCR7ci5lbmQubGluZX0sICR7ci5lbmQuY2hhcmFjdGVyfSlgO1xuXG5cdFx0XHRjb25zdCBtYWtlQ29tcGFyYWJsZSA9IChyZXN1bHRzOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdKSA9PiByZXN1bHRzXG5cdFx0XHRcdC5zb3J0KChhLCBiKSA9PiB7XG5cdFx0XHRcdFx0Y29uc3QgY29tcGFyZUtleUEgPSBhLnVyaS50b1N0cmluZygpICsgJzogJyArIChleHRlbnNpb25SZXN1bHRJc01hdGNoKGEpID8gYS5wcmV2aWV3LnRleHQgOiBhLnRleHQpO1xuXHRcdFx0XHRcdGNvbnN0IGNvbXBhcmVLZXlCID0gYi51cmkudG9TdHJpbmcoKSArICc6ICcgKyAoZXh0ZW5zaW9uUmVzdWx0SXNNYXRjaChiKSA/IGIucHJldmlldy50ZXh0IDogYi50ZXh0KTtcblx0XHRcdFx0XHRyZXR1cm4gY29tcGFyZUtleUIubG9jYWxlQ29tcGFyZShjb21wYXJlS2V5QSk7XG5cdFx0XHRcdH0pXG5cdFx0XHRcdC5tYXAociA9PiBleHRlbnNpb25SZXN1bHRJc01hdGNoKHIpID8ge1xuXHRcdFx0XHRcdHVyaTogci51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0XHRyYW5nZTogbWFwQXJyYXlPck5vdChyLnJhbmdlcywgcmFuZ2VUb1N0cmluZyksXG5cdFx0XHRcdFx0cHJldmlldzoge1xuXHRcdFx0XHRcdFx0dGV4dDogci5wcmV2aWV3LnRleHQsXG5cdFx0XHRcdFx0XHRtYXRjaDogbnVsbCAvLyBEb24ndCBjYXJlIGFib3V0IHRoaXMgcmlnaHQgbm93XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IDoge1xuXHRcdFx0XHRcdHVyaTogci51cmkudG9TdHJpbmcoKSxcblx0XHRcdFx0XHR0ZXh0OiByLnRleHQsXG5cdFx0XHRcdFx0bGluZU51bWJlcjogci5saW5lTnVtYmVyXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gYXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0bWFrZUNvbXBhcmFibGUoYWN0dWFsVGV4dFNlYXJjaFJlc3VsdHMpLFxuXHRcdFx0XHRtYWtlQ29tcGFyYWJsZShleHBlY3RlZCkpO1xuXHRcdH1cblxuXHRcdHRlc3QoJ25vIHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHsgcmVzdWx0cywgc3RhdHMgfSA9IGF3YWl0IHJ1blRleHRTZWFyY2goZ2V0U2ltcGxlUXVlcnkoJ2ZvbycpKTtcblx0XHRcdGFzc2VydCghc3RhdHMubGltaXRIaXQpO1xuXHRcdFx0YXNzZXJ0KCFyZXN1bHRzLmxlbmd0aCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdiYXNpYyByZXN1bHRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZWRSZXN1bHRzOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdID0gW1xuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTIudHMnKVxuXHRcdFx0XTtcblxuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0VGV4dFNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuVGV4dFNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuVGV4dFNlYXJjaE9wdGlvbnMsIHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8dnNjb2RlLlRleHRTZWFyY2hSZXN1bHQ+LCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuVGV4dFNlYXJjaENvbXBsZXRlPiB7XG5cdFx0XHRcdFx0cHJvdmlkZWRSZXN1bHRzLmZvckVhY2gociA9PiBwcm9ncmVzcy5yZXBvcnQocikpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgeyByZXN1bHRzLCBzdGF0cyB9ID0gYXdhaXQgcnVuVGV4dFNlYXJjaChnZXRTaW1wbGVRdWVyeSgnZm9vJykpO1xuXHRcdFx0YXNzZXJ0KCFzdGF0cy5saW1pdEhpdCk7XG5cdFx0XHRhc3NlcnRSZXN1bHRzKHJlc3VsdHMsIHByb3ZpZGVkUmVzdWx0cyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdhbGwgcHJvdmlkZXIgY2FsbHMgZ2V0IGdsb2JhbCBpbmNsdWRlL2V4Y2x1ZGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0VGV4dFNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuVGV4dFNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuVGV4dFNlYXJjaE9wdGlvbnMsIHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8dnNjb2RlLlRleHRTZWFyY2hSZXN1bHQ+LCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuVGV4dFNlYXJjaENvbXBsZXRlPiB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG9wdGlvbnMuaW5jbHVkZXMubGVuZ3RoLCAxKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3B0aW9ucy5leGNsdWRlcy5sZW5ndGgsIDEpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElUZXh0UXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogZ2V0UGF0dGVybignZm9vJyksXG5cblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi50cyc6IHRydWVcblx0XHRcdFx0fSxcblxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLmpzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfSxcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckIgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2dsb2JhbC9sb2NhbCBpbmNsdWRlL2V4Y2x1ZGVzIGNvbWJpbmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0VGV4dFNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuVGV4dFNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuVGV4dFNlYXJjaE9wdGlvbnMsIHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8dnNjb2RlLlRleHRTZWFyY2hSZXN1bHQ+LCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuVGV4dFNlYXJjaENvbXBsZXRlPiB7XG5cdFx0XHRcdFx0aWYgKG9wdGlvbnMuZm9sZGVyLnRvU3RyaW5nKCkgPT09IHJvb3RGb2xkZXJBLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3B0aW9ucy5pbmNsdWRlcy5zb3J0KCksIFsnKi50cycsICdmb28nXSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuZXhjbHVkZXMuc29ydCgpLCBbJyouanMnLCAnYmFyJ10pO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuaW5jbHVkZXMuc29ydCgpLCBbJyoudHMnXSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuZXhjbHVkZXMuc29ydCgpLCBbJyouanMnXSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsISk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBxdWVyeTogSVRleHRRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBnZXRQYXR0ZXJuKCdmb28nKSxcblxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLnRzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRleGNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLmpzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0Zm9sZGVyOiByb290Rm9sZGVyQSxcblx0XHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdCdmb28nOiB0cnVlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0XHQnYmFyJzogdHJ1ZVxuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJCIH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0YXdhaXQgcnVuVGV4dFNlYXJjaChxdWVyeSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdpbmNsdWRlL2V4Y2x1ZGVzIHJlc29sdmVkIGNvcnJlY3RseScsIGFzeW5jICgpID0+IHtcblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdFRleHRTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVUZXh0U2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLlRleHRTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLlRleHRTZWFyY2hPcHRpb25zLCBwcm9ncmVzczogdnNjb2RlLlByb2dyZXNzPHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0PiwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLlRleHRTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3B0aW9ucy5pbmNsdWRlcy5zb3J0KCksIFsnKi5qc3gnLCAnKi50cyddKTtcblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wdGlvbnMuZXhjbHVkZXMuc29ydCgpLCBbXSk7XG5cblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogZ2V0UGF0dGVybignZm9vJyksXG5cblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi50cyc6IHRydWUsXG5cdFx0XHRcdFx0JyouanN4JzogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi5qcyc6IHRydWUsXG5cdFx0XHRcdFx0JyoudHN4JzogZmFsc2Vcblx0XHRcdFx0fSxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcm9vdEZvbGRlckEsXG5cdFx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHQnKi5qc3gnOiB0cnVlXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0XHQnKi5qcyc6IGZhbHNlXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Byb3ZpZGVyIGZhaWwnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Byb3ZpZGVyIGZhaWwnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHJ1blRleHRTZWFyY2goZ2V0U2ltcGxlUXVlcnkoJ2ZvbycpKTtcblx0XHRcdFx0YXNzZXJ0KGZhbHNlLCAnRXhwZWN0ZWQgdG8gZmFpbCcpO1xuXHRcdFx0fSBjYXRjaCB7XG5cdFx0XHRcdC8vIGV4cGVjdGVkIHRvIGZhaWxcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRlc3QoJ2Jhc2ljIHNpYmxpbmcgY2xhdXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0KG1vY2tQRlMgYXMgYW55KS5Qcm9taXNlcyA9IHtcblx0XHRcdFx0cmVhZGRpcjogKF9wYXRoOiBzdHJpbmcpOiBhbnkgPT4ge1xuXHRcdFx0XHRcdGlmIChfcGF0aCA9PT0gcm9vdEZvbGRlckEuZnNQYXRoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtcblx0XHRcdFx0XHRcdFx0J2ZpbGUxLmpzJyxcblx0XHRcdFx0XHRcdFx0J2ZpbGUxLnRzJ1xuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1dyb25nIHBhdGgnKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBwcm92aWRlZFJlc3VsdHM6IHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0W10gPSBbXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTEuanMnKSxcblx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckEsICdmaWxlMS50cycpXG5cdFx0XHRdO1xuXG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRwcm92aWRlZFJlc3VsdHMuZm9yRWFjaChyID0+IHByb2dyZXNzLnJlcG9ydChyKSk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShudWxsISk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBxdWVyeTogSVNlYXJjaFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IGdldFBhdHRlcm4oJ2ZvbycpLFxuXG5cdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0JyouanMnOiB7XG5cdFx0XHRcdFx0XHR3aGVuOiAnJChiYXNlbmFtZSkudHMnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1blRleHRTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0UmVzdWx0cyhyZXN1bHRzLCBwcm92aWRlZFJlc3VsdHMuc2xpY2UoMSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbXVsdGlyb290IHNpYmxpbmcgY2xhdXNlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0KG1vY2tQRlMgYXMgYW55KS5Qcm9taXNlcyA9IHtcblx0XHRcdFx0cmVhZGRpcjogKF9wYXRoOiBzdHJpbmcpOiBhbnkgPT4ge1xuXHRcdFx0XHRcdGlmIChfcGF0aCA9PT0gam9pblBhdGgocm9vdEZvbGRlckEsICdmb2xkZXInKS5mc1BhdGgpIHtcblx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW1xuXHRcdFx0XHRcdFx0XHQnZmlsZUEuc2NzcycsXG5cdFx0XHRcdFx0XHRcdCdmaWxlQS5jc3MnLFxuXHRcdFx0XHRcdFx0XHQnZmlsZTIuY3NzJ1xuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmIChfcGF0aCA9PT0gcm9vdEZvbGRlckIuZnNQYXRoKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKFtcblx0XHRcdFx0XHRcdFx0J2ZpbGVCLnRzJyxcblx0XHRcdFx0XHRcdFx0J2ZpbGVCLmpzJyxcblx0XHRcdFx0XHRcdFx0J2ZpbGUzLmpzJ1xuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoJ1dyb25nIHBhdGgnKSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRsZXQgcmVwb3J0ZWRSZXN1bHRzO1xuXHRcdFx0XHRcdGlmIChvcHRpb25zLmZvbGRlci5mc1BhdGggPT09IHJvb3RGb2xkZXJBLmZzUGF0aCkge1xuXHRcdFx0XHRcdFx0cmVwb3J0ZWRSZXN1bHRzID0gW1xuXHRcdFx0XHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZvbGRlci9maWxlQS5zY3NzJyksXG5cdFx0XHRcdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZm9sZGVyL2ZpbGVBLmNzcycpLFxuXHRcdFx0XHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZvbGRlci9maWxlMi5jc3MnKVxuXHRcdFx0XHRcdFx0XTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmVwb3J0ZWRSZXN1bHRzID0gW1xuXHRcdFx0XHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQiwgJ2ZpbGVCLnRzJyksXG5cdFx0XHRcdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJCLCAnZmlsZUIuanMnKSxcblx0XHRcdFx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckIsICdmaWxlMy5qcycpXG5cdFx0XHRcdFx0XHRdO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJlcG9ydGVkUmVzdWx0cy5mb3JFYWNoKHIgPT4gcHJvZ3Jlc3MucmVwb3J0KHIpKTtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogZ2V0UGF0dGVybignZm9vJyksXG5cblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKi5qcyc6IHtcblx0XHRcdFx0XHRcdHdoZW46ICckKGJhc2VuYW1lKS50cydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCcqLmNzcyc6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGZvbGRlcjogcm9vdEZvbGRlckEsXG5cdFx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3tcblx0XHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHRcdCdmb2xkZXIvKi5jc3MnOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR3aGVuOiAnJChiYXNlbmFtZSkuc2Nzcydcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IHJvb3RGb2xkZXJCLFxuXHRcdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0XHQnKi5qcyc6IGZhbHNlXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1blRleHRTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0UmVzdWx0cyhyZXN1bHRzLCBbXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZm9sZGVyL2ZpbGVBLnNjc3MnKSxcblx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckEsICdmb2xkZXIvZmlsZTIuY3NzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJCLCAnZmlsZUIudHMnKSxcblx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckIsICdmaWxlQi5qcycpLFxuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQiwgJ2ZpbGUzLmpzJyldKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2luY2x1ZGUgcGF0dGVybiBhcHBsaWVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZWRSZXN1bHRzOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdID0gW1xuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUxLmpzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTEudHMnKVxuXHRcdFx0XTtcblxuXHRcdFx0YXdhaXQgcmVnaXN0ZXJUZXN0VGV4dFNlYXJjaFByb3ZpZGVyKHtcblx0XHRcdFx0cHJvdmlkZVRleHRTZWFyY2hSZXN1bHRzKHF1ZXJ5OiB2c2NvZGUuVGV4dFNlYXJjaFF1ZXJ5LCBvcHRpb25zOiB2c2NvZGUuVGV4dFNlYXJjaE9wdGlvbnMsIHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8dnNjb2RlLlRleHRTZWFyY2hSZXN1bHQ+LCB0b2tlbjogdnNjb2RlLkNhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuVGV4dFNlYXJjaENvbXBsZXRlPiB7XG5cdFx0XHRcdFx0cHJvdmlkZWRSZXN1bHRzLmZvckVhY2gociA9PiBwcm9ncmVzcy5yZXBvcnQocikpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBnZXRQYXR0ZXJuKCdmb28nKSxcblxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqLnRzJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMgfSA9IGF3YWl0IHJ1blRleHRTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0UmVzdWx0cyhyZXN1bHRzLCBwcm92aWRlZFJlc3VsdHMuc2xpY2UoMSkpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbWF4IHJlc3VsdHMgPSAxJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZWRSZXN1bHRzOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdID0gW1xuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTIudHMnKVxuXHRcdFx0XTtcblxuXHRcdFx0bGV0IHdhc0NhbmNlbGVkID0gZmFsc2U7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gd2FzQ2FuY2VsZWQgPSB0cnVlKSk7XG5cdFx0XHRcdFx0cHJvdmlkZWRSZXN1bHRzLmZvckVhY2gociA9PiBwcm9ncmVzcy5yZXBvcnQocikpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBnZXRQYXR0ZXJuKCdmb28nKSxcblxuXHRcdFx0XHRtYXhSZXN1bHRzOiAxLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydChzdGF0cy5saW1pdEhpdCwgJ0V4cGVjdGVkIHRvIHJldHVybiBsaW1pdEhpdCcpO1xuXHRcdFx0YXNzZXJ0UmVzdWx0cyhyZXN1bHRzLCBwcm92aWRlZFJlc3VsdHMuc2xpY2UoMCwgMSkpO1xuXHRcdFx0YXNzZXJ0KHdhc0NhbmNlbGVkLCAnRXhwZWN0ZWQgdG8gYmUgY2FuY2VsZWQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ21heCByZXN1bHRzID0gMicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHByb3ZpZGVkUmVzdWx0czogdnNjb2RlLlRleHRTZWFyY2hSZXN1bHRbXSA9IFtcblx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckEsICdmaWxlMS50cycpLFxuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTMudHMnKVxuXHRcdFx0XTtcblxuXHRcdFx0bGV0IHdhc0NhbmNlbGVkID0gZmFsc2U7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gd2FzQ2FuY2VsZWQgPSB0cnVlKSk7XG5cdFx0XHRcdFx0cHJvdmlkZWRSZXN1bHRzLmZvckVhY2gociA9PiBwcm9ncmVzcy5yZXBvcnQocikpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBnZXRQYXR0ZXJuKCdmb28nKSxcblxuXHRcdFx0XHRtYXhSZXN1bHRzOiAyLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydChzdGF0cy5saW1pdEhpdCwgJ0V4cGVjdGVkIHRvIHJldHVybiBsaW1pdEhpdCcpO1xuXHRcdFx0YXNzZXJ0UmVzdWx0cyhyZXN1bHRzLCBwcm92aWRlZFJlc3VsdHMuc2xpY2UoMCwgMikpO1xuXHRcdFx0YXNzZXJ0KHdhc0NhbmNlbGVkLCAnRXhwZWN0ZWQgdG8gYmUgY2FuY2VsZWQnKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Byb3ZpZGVyIHJldHVybnMgbWF4UmVzdWx0cyBleGFjdGx5JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZWRSZXN1bHRzOiB2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdFtdID0gW1xuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTIudHMnKVxuXHRcdFx0XTtcblxuXHRcdFx0bGV0IHdhc0NhbmNlbGVkID0gZmFsc2U7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gd2FzQ2FuY2VsZWQgPSB0cnVlKSk7XG5cdFx0XHRcdFx0cHJvdmlkZWRSZXN1bHRzLmZvckVhY2gociA9PiBwcm9ncmVzcy5yZXBvcnQocikpO1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUobnVsbCEpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgcXVlcnk6IElTZWFyY2hRdWVyeSA9IHtcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBnZXRQYXR0ZXJuKCdmb28nKSxcblxuXHRcdFx0XHRtYXhSZXN1bHRzOiAyLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogcm9vdEZvbGRlckEgfVxuXHRcdFx0XHRdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCB7IHJlc3VsdHMsIHN0YXRzIH0gPSBhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydCghc3RhdHMubGltaXRIaXQsICdFeHBlY3RlZCBub3QgdG8gcmV0dXJuIGxpbWl0SGl0Jyk7XG5cdFx0XHRhc3NlcnRSZXN1bHRzKHJlc3VsdHMsIHByb3ZpZGVkUmVzdWx0cyk7XG5cdFx0XHRhc3NlcnQoIXdhc0NhbmNlbGVkLCAnRXhwZWN0ZWQgbm90IHRvIGJlIGNhbmNlbGVkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdwcm92aWRlciByZXR1cm5zIGVhcmx5IHdpdGggbGltaXRIaXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm92aWRlZFJlc3VsdHM6IHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0W10gPSBbXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KHJvb3RGb2xkZXJBLCAnZmlsZTEudHMnKSxcblx0XHRcdFx0bWFrZVRleHRSZXN1bHQocm9vdEZvbGRlckEsICdmaWxlMi50cycpLFxuXHRcdFx0XHRtYWtlVGV4dFJlc3VsdChyb290Rm9sZGVyQSwgJ2ZpbGUzLnRzJylcblx0XHRcdF07XG5cblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdFRleHRTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVUZXh0U2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLlRleHRTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLlRleHRTZWFyY2hPcHRpb25zLCBwcm9ncmVzczogdnNjb2RlLlByb2dyZXNzPHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0PiwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLlRleHRTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRcdHByb3ZpZGVkUmVzdWx0cy5mb3JFYWNoKHIgPT4gcHJvZ3Jlc3MucmVwb3J0KHIpKTtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHsgbGltaXRIaXQ6IHRydWUgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cdFx0XHRjb25zdCBxdWVyeTogSVNlYXJjaFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IGdldFBhdHRlcm4oJ2ZvbycpLFxuXG5cdFx0XHRcdG1heFJlc3VsdHM6IDEwMDAsXG5cblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHsgZm9sZGVyOiByb290Rm9sZGVyQSB9XG5cdFx0XHRcdF1cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHsgcmVzdWx0cywgc3RhdHMgfSA9IGF3YWl0IHJ1blRleHRTZWFyY2gocXVlcnkpO1xuXHRcdFx0YXNzZXJ0KHN0YXRzLmxpbWl0SGl0LCAnRXhwZWN0ZWQgdG8gcmV0dXJuIGxpbWl0SGl0Jyk7XG5cdFx0XHRhc3NlcnRSZXN1bHRzKHJlc3VsdHMsIHByb3ZpZGVkUmVzdWx0cyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtdWx0aXJvb3QgbWF4IHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRsZXQgY2FuY2VscyA9IDA7XG5cdFx0XHRhd2FpdCByZWdpc3RlclRlc3RUZXh0U2VhcmNoUHJvdmlkZXIoe1xuXHRcdFx0XHRhc3luYyBwcm92aWRlVGV4dFNlYXJjaFJlc3VsdHMocXVlcnk6IHZzY29kZS5UZXh0U2VhcmNoUXVlcnksIG9wdGlvbnM6IHZzY29kZS5UZXh0U2VhcmNoT3B0aW9ucywgcHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuVGV4dFNlYXJjaFJlc3VsdD4sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5UZXh0U2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlcy5hZGQodG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4gY2FuY2VscysrKSk7XG5cdFx0XHRcdFx0YXdhaXQgbmV3IFByb21pc2UociA9PiBwcm9jZXNzLm5leHRUaWNrKHIpKTtcblx0XHRcdFx0XHRbXG5cdFx0XHRcdFx0XHQnZmlsZTEudHMnLFxuXHRcdFx0XHRcdFx0J2ZpbGUyLnRzJyxcblx0XHRcdFx0XHRcdCdmaWxlMy50cycsXG5cdFx0XHRcdFx0XS5mb3JFYWNoKGYgPT4gcHJvZ3Jlc3MucmVwb3J0KG1ha2VUZXh0UmVzdWx0KG9wdGlvbnMuZm9sZGVyLCBmKSkpO1xuXHRcdFx0XHRcdHJldHVybiBudWxsITtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IHF1ZXJ5OiBJU2VhcmNoUXVlcnkgPSB7XG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjogZ2V0UGF0dGVybignZm9vJyksXG5cblx0XHRcdFx0bWF4UmVzdWx0czogMixcblxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJBIH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IHJvb3RGb2xkZXJCIH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgeyByZXN1bHRzIH0gPSBhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHRzLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FuY2VscywgMik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCd3b3JrcyB3aXRoIG5vbi1maWxlIHNjaGVtZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm92aWRlZFJlc3VsdHM6IHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0W10gPSBbXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KGZhbmN5U2NoZW1lRm9sZGVyQSwgJ2ZpbGUxLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KGZhbmN5U2NoZW1lRm9sZGVyQSwgJ2ZpbGUyLnRzJyksXG5cdFx0XHRcdG1ha2VUZXh0UmVzdWx0KGZhbmN5U2NoZW1lRm9sZGVyQSwgJ2ZpbGUzLnRzJylcblx0XHRcdF07XG5cblx0XHRcdGF3YWl0IHJlZ2lzdGVyVGVzdFRleHRTZWFyY2hQcm92aWRlcih7XG5cdFx0XHRcdHByb3ZpZGVUZXh0U2VhcmNoUmVzdWx0cyhxdWVyeTogdnNjb2RlLlRleHRTZWFyY2hRdWVyeSwgb3B0aW9uczogdnNjb2RlLlRleHRTZWFyY2hPcHRpb25zLCBwcm9ncmVzczogdnNjb2RlLlByb2dyZXNzPHZzY29kZS5UZXh0U2VhcmNoUmVzdWx0PiwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLlRleHRTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRcdHByb3ZpZGVkUmVzdWx0cy5mb3JFYWNoKHIgPT4gcHJvZ3Jlc3MucmVwb3J0KHIpKTtcblx0XHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKG51bGwhKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgZmFuY3lTY2hlbWUpO1xuXG5cdFx0XHRjb25zdCBxdWVyeTogSVNlYXJjaFF1ZXJ5ID0ge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IGdldFBhdHRlcm4oJ2ZvbycpLFxuXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7IGZvbGRlcjogZmFuY3lTY2hlbWVGb2xkZXJBIH1cblx0XHRcdFx0XVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgeyByZXN1bHRzIH0gPSBhd2FpdCBydW5UZXh0U2VhcmNoKHF1ZXJ5KTtcblx0XHRcdGFzc2VydFJlc3VsdHMocmVzdWx0cywgcHJvdmlkZWRSZXN1bHRzKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLGVBQWU7QUFDeEIsU0FBUywrQkFBK0I7QUFDeEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxjQUFjO0FBQ3ZCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsV0FBMEI7QUFFbkMsU0FBUyxZQUFZO0FBQ3JCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQTBDO0FBR25ELFNBQVMsYUFBYTtBQUN0QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUErRyxXQUFXLHFCQUFxQjtBQUUvSSxTQUFTLCtCQUErQjtBQUd4QyxJQUFJO0FBQ0osSUFBSTtBQUVKLElBQUk7QUFDSixNQUFNLHFCQUFzRDtBQUFBLEVBQTVEO0FBR0MsbUJBQWlELENBQUM7QUFBQTtBQUFBLEVBRWxELDRCQUE0QixRQUFnQixRQUFzQjtBQUNqRSxTQUFLLGFBQWE7QUFBQSxFQUNuQjtBQUFBLEVBRUEsNEJBQTRCLFFBQWdCLFFBQXNCO0FBQ2pF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QUEsUUFDN0MsZUFBZSxvQkFBb0IsVUFBVTtBQUFBLE1BQzlDO0FBRUEsWUFBTSwrQkFBK0I7QUFBQSxRQUNwQyx5QkFBeUJBLFFBQStCLFNBQW1DLFVBQW9ELE9BQXFFO0FBQ25OLDBCQUFnQixRQUFRLE9BQUssU0FBUyxPQUFPLENBQUMsQ0FBQztBQUMvQyxpQkFBTyxRQUFRLFFBQVEsSUFBSztBQUFBLFFBQzdCO0FBQUEsTUFDRCxHQUFHLFdBQVc7QUFFZCxZQUFNLFFBQXNCO0FBQUEsUUFDM0IsTUFBTSxVQUFVO0FBQUEsUUFDaEIsZ0JBQWdCLFdBQVcsS0FBSztBQUFBLFFBRWhDLGVBQWU7QUFBQSxVQUNkLEVBQUUsUUFBUSxtQkFBbUI7QUFBQSxRQUM5QjtBQUFBLE1BQ0Q7QUFFQSxZQUFNLEVBQUUsUUFBUSxJQUFJLE1BQU0sY0FBYyxLQUFLO0FBQzdDLG9CQUFjLFNBQVMsZUFBZTtBQUFBLElBQ3ZDLENBQUM7QUFBQSxFQUNGLENBQUM7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogWyJkaXNwb3NhYmxlcyIsICJxdWVyeSJdCn0K
