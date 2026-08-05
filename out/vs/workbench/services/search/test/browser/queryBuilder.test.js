import assert from "assert";
import { join } from "../../../../../base/common/path.js";
import { isWindows } from "../../../../../base/common/platform.js";
import { URI, URI as uri } from "../../../../../base/common/uri.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { IWorkspaceContextService, toWorkspaceFolder } from "../../../../../platform/workspace/common/workspace.js";
import { toWorkspaceFolders } from "../../../../../platform/workspaces/common/workspaces.js";
import { QueryBuilder } from "../../common/queryBuilder.js";
import { IPathService } from "../../../path/common/pathService.js";
import { QueryType } from "../../common/search.js";
import { TestPathService, TestEnvironmentService } from "../../../../test/browser/workbenchTestServices.js";
import { TestContextService } from "../../../../test/common/workbenchTestServices.js";
import { IEnvironmentService } from "../../../../../platform/environment/common/environment.js";
import { Workspace } from "../../../../../platform/workspace/test/common/testWorkspace.js";
import { extUriBiasedIgnorePathCase } from "../../../../../base/common/resources.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
const DEFAULT_EDITOR_CONFIG = {};
const DEFAULT_USER_CONFIG = { useRipgrep: true, useIgnoreFiles: true, useGlobalIgnoreFiles: true, useParentIgnoreFiles: true };
const DEFAULT_QUERY_PROPS = {};
const DEFAULT_TEXT_QUERY_PROPS = { usePCRE2: false };
suite("QueryBuilder", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const PATTERN_INFO = { pattern: "a" };
  const ROOT_1 = fixPath("/foo/root1");
  const ROOT_1_URI = getUri(ROOT_1);
  const ROOT_1_NAMED_FOLDER = toWorkspaceFolder(ROOT_1_URI);
  const WS_CONFIG_PATH = getUri("/bar/test.code-workspace");
  let instantiationService;
  let queryBuilder;
  let mockConfigService;
  let mockContextService;
  let mockWorkspace;
  setup(() => {
    instantiationService = new TestInstantiationService();
    mockConfigService = new TestConfigurationService();
    mockConfigService.setUserConfiguration("search", DEFAULT_USER_CONFIG);
    mockConfigService.setUserConfiguration("editor", DEFAULT_EDITOR_CONFIG);
    instantiationService.stub(IConfigurationService, mockConfigService);
    mockContextService = new TestContextService();
    mockWorkspace = new Workspace("workspace", [toWorkspaceFolder(ROOT_1_URI)]);
    mockContextService.setWorkspace(mockWorkspace);
    instantiationService.stub(IWorkspaceContextService, mockContextService);
    instantiationService.stub(IEnvironmentService, TestEnvironmentService);
    instantiationService.stub(IPathService, new TestPathService());
    queryBuilder = instantiationService.createInstance(QueryBuilder);
  });
  teardown(() => {
    instantiationService.dispose();
  });
  test("simple text pattern", () => {
    assertEqualTextQueries(
      queryBuilder.text(PATTERN_INFO),
      {
        folderQueries: [],
        contentPattern: PATTERN_INFO,
        type: QueryType.Text
      }
    );
  });
  test("normalize literal newlines", () => {
    assertEqualTextQueries(
      queryBuilder.text({ pattern: "foo\nbar", isRegExp: true }),
      {
        folderQueries: [],
        contentPattern: {
          pattern: "foo\\nbar",
          isRegExp: true,
          isMultiline: true
        },
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text({ pattern: "foo\nbar", isRegExp: false }),
      {
        folderQueries: [],
        contentPattern: {
          pattern: "foo\nbar",
          isRegExp: false,
          isMultiline: true
        },
        type: QueryType.Text
      }
    );
  });
  test("splits include pattern when expandPatterns enabled", () => {
    assertEqualQueries(
      queryBuilder.file(
        [ROOT_1_NAMED_FOLDER],
        { includePattern: "**/foo, **/bar", expandPatterns: true }
      ),
      {
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        type: QueryType.File,
        includePattern: {
          "**/foo": true,
          "**/foo/**": true,
          "**/bar": true,
          "**/bar/**": true
        }
      }
    );
  });
  test("does not split include pattern when expandPatterns disabled", () => {
    assertEqualQueries(
      queryBuilder.file(
        [ROOT_1_NAMED_FOLDER],
        { includePattern: "**/foo, **/bar" }
      ),
      {
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        type: QueryType.File,
        includePattern: {
          "**/foo, **/bar": true
        }
      }
    );
  });
  test("includePattern array", () => {
    assertEqualQueries(
      queryBuilder.file(
        [ROOT_1_NAMED_FOLDER],
        { includePattern: ["**/foo", "**/bar"] }
      ),
      {
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        type: QueryType.File,
        includePattern: {
          "**/foo": true,
          "**/bar": true
        }
      }
    );
  });
  test("includePattern array with expandPatterns", () => {
    assertEqualQueries(
      queryBuilder.file(
        [ROOT_1_NAMED_FOLDER],
        { includePattern: ["**/foo", "**/bar"], expandPatterns: true }
      ),
      {
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        type: QueryType.File,
        includePattern: {
          "**/foo": true,
          "**/foo/**": true,
          "**/bar": true,
          "**/bar/**": true
        }
      }
    );
  });
  test("folderResources", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI]
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{ folder: ROOT_1_URI }],
        type: QueryType.Text
      }
    );
  });
  test("simple exclude setting", () => {
    mockConfigService.setUserConfiguration("search", {
      ...DEFAULT_USER_CONFIG,
      exclude: {
        "bar/**": true,
        "foo/**": {
          "when": "$(basename).ts"
        }
      }
    });
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          expandPatterns: true
          // verify that this doesn't affect patterns from configuration
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          excludePattern: [{
            pattern: {
              "bar/**": true,
              "foo/**": {
                "when": "$(basename).ts"
              }
            }
          }]
        }],
        type: QueryType.Text
      }
    );
  });
  test("simple include", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          includePattern: "bar",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        includePattern: {
          "**/bar": true,
          "**/bar/**": true
        },
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          includePattern: "bar"
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        includePattern: {
          "bar": true
        },
        type: QueryType.Text
      }
    );
  });
  test("simple include with ./ syntax", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          includePattern: "./bar",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          includePattern: {
            "bar": true,
            "bar/**": true
          }
        }],
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          includePattern: ".\\bar",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          includePattern: {
            "bar": true,
            "bar/**": true
          }
        }],
        type: QueryType.Text
      }
    );
  });
  test("exclude setting and searchPath", () => {
    mockConfigService.setUserConfiguration("search", {
      ...DEFAULT_USER_CONFIG,
      exclude: {
        "foo/**/*.js": true,
        "bar/**": {
          "when": "$(basename).ts"
        }
      }
    });
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          includePattern: "./foo",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          includePattern: {
            "foo": true,
            "foo/**": true
          },
          excludePattern: [{
            pattern: {
              "foo/**/*.js": true,
              "bar/**": {
                "when": "$(basename).ts"
              }
            }
          }]
        }],
        type: QueryType.Text
      }
    );
  });
  test("multiroot exclude settings", () => {
    const ROOT_2 = fixPath("/project/root2");
    const ROOT_2_URI = getUri(ROOT_2);
    const ROOT_3 = fixPath("/project/root3");
    const ROOT_3_URI = getUri(ROOT_3);
    mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: ROOT_2_URI.fsPath }, { path: ROOT_3_URI.fsPath }], WS_CONFIG_PATH, extUriBiasedIgnorePathCase);
    mockWorkspace.configuration = uri.file(fixPath("/config"));
    mockConfigService.setUserConfiguration("search", {
      ...DEFAULT_USER_CONFIG,
      exclude: { "foo/**/*.js": true }
    }, ROOT_1_URI);
    mockConfigService.setUserConfiguration("search", {
      ...DEFAULT_USER_CONFIG,
      exclude: { "bar": true }
    }, ROOT_2_URI);
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI, ROOT_2_URI, ROOT_3_URI]
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [
          { folder: ROOT_1_URI, excludePattern: makeExcludePatternFromPatterns("foo/**/*.js") },
          { folder: ROOT_2_URI, excludePattern: makeExcludePatternFromPatterns("bar") },
          { folder: ROOT_3_URI }
        ],
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI, ROOT_2_URI, ROOT_3_URI],
        {
          includePattern: "./root2/src",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [
          {
            folder: ROOT_2_URI,
            includePattern: {
              "src": true,
              "src/**": true
            },
            excludePattern: [{
              pattern: { "bar": true }
            }]
          }
        ],
        type: QueryType.Text
      }
    );
  });
  test("simple exclude input pattern", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          excludePattern: [{ pattern: "foo" }],
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        type: QueryType.Text,
        excludePattern: patternsToIExpression(...globalGlob("foo"))
      }
    );
  });
  test("file pattern trimming", () => {
    const content = "content";
    assertEqualQueries(
      queryBuilder.file(
        [],
        { filePattern: ` ${content} ` }
      ),
      {
        folderQueries: [],
        filePattern: content,
        type: QueryType.File
      }
    );
  });
  test("exclude ./ syntax", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          excludePattern: [{ pattern: "./bar" }],
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          excludePattern: makeExcludePatternFromPatterns("bar", "bar/**")
        }],
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          excludePattern: [{ pattern: "./bar/**/*.ts" }],
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          excludePattern: makeExcludePatternFromPatterns("bar/**/*.ts", "bar/**/*.ts/**")
        }],
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          excludePattern: [{ pattern: ".\\bar\\**\\*.ts" }],
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI,
          excludePattern: makeExcludePatternFromPatterns("bar/**/*.ts", "bar/**/*.ts/**")
        }],
        type: QueryType.Text
      }
    );
  });
  test("extraFileResources", () => {
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        { extraFileResources: [getUri("/foo/bar.js")] }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        extraFileResources: [getUri("/foo/bar.js")],
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          extraFileResources: [getUri("/foo/bar.js")],
          excludePattern: [{ pattern: "*.js" }],
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        excludePattern: patternsToIExpression(...globalGlob("*.js")),
        type: QueryType.Text
      }
    );
    assertEqualTextQueries(
      queryBuilder.text(
        PATTERN_INFO,
        [ROOT_1_URI],
        {
          extraFileResources: [getUri("/foo/bar.js")],
          includePattern: "*.txt",
          expandPatterns: true
        }
      ),
      {
        contentPattern: PATTERN_INFO,
        folderQueries: [{
          folder: ROOT_1_URI
        }],
        includePattern: patternsToIExpression(...globalGlob("*.txt")),
        type: QueryType.Text
      }
    );
  });
  suite("parseSearchPaths 1", () => {
    test("simple includes", () => {
      function testSimpleIncludes(includePattern, expectedPatterns) {
        const result = queryBuilder.parseSearchPaths(includePattern);
        assert.deepStrictEqual(
          { ...result.pattern },
          patternsToIExpression(...expectedPatterns),
          includePattern
        );
        assert.strictEqual(result.searchPaths, void 0);
      }
      [
        ["a", ["**/a/**", "**/a"]],
        ["a/b", ["**/a/b", "**/a/b/**"]],
        ["a/b,  c", ["**/a/b", "**/c", "**/a/b/**", "**/c/**"]],
        ["a,.txt", ["**/a", "**/a/**", "**/*.txt", "**/*.txt/**"]],
        ["a,,,b", ["**/a", "**/a/**", "**/b", "**/b/**"]],
        ["**/a,b/**", ["**/a", "**/a/**", "**/b/**"]]
      ].forEach(([includePattern, expectedPatterns]) => testSimpleIncludes(includePattern, expectedPatterns));
    });
    function testIncludes(includePattern, expectedResult) {
      let actual;
      try {
        actual = queryBuilder.parseSearchPaths(includePattern);
      } catch (_) {
        actual = { searchPaths: [] };
      }
      assertEqualSearchPathResults(
        actual,
        expectedResult,
        includePattern
      );
    }
    function testIncludesDataItem([includePattern, expectedResult]) {
      testIncludes(includePattern, expectedResult);
    }
    test("absolute includes", () => {
      const cases = [
        [
          fixPath("/foo/bar"),
          {
            searchPaths: [{ searchPath: getUri("/foo/bar") }]
          }
        ],
        [
          fixPath("/foo/bar") + ",a",
          {
            searchPaths: [{ searchPath: getUri("/foo/bar") }],
            pattern: patternsToIExpression(...globalGlob("a"))
          }
        ],
        [
          fixPath("/foo/bar") + "," + fixPath("/1/2"),
          {
            searchPaths: [{ searchPath: getUri("/foo/bar") }, { searchPath: getUri("/1/2") }]
          }
        ],
        [
          fixPath("/foo/bar") + "," + fixPath("/foo/../foo/bar/fooar/.."),
          {
            searchPaths: [{
              searchPath: getUri("/foo/bar")
            }]
          }
        ],
        [
          fixPath("/foo/bar/**/*.ts"),
          {
            searchPaths: [{
              searchPath: getUri("/foo/bar"),
              pattern: patternsToIExpression("**/*.ts", "**/*.ts/**")
            }]
          }
        ],
        [
          fixPath("/foo/bar/*a/b/c"),
          {
            searchPaths: [{
              searchPath: getUri("/foo/bar"),
              pattern: patternsToIExpression("*a/b/c", "*a/b/c/**")
            }]
          }
        ],
        [
          fixPath("/*a/b/c"),
          {
            searchPaths: [{
              searchPath: getUri("/"),
              pattern: patternsToIExpression("*a/b/c", "*a/b/c/**")
            }]
          }
        ],
        [
          fixPath("/foo/{b,c}ar"),
          {
            searchPaths: [{
              searchPath: getUri("/foo"),
              pattern: patternsToIExpression("{b,c}ar", "{b,c}ar/**")
            }]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
    test("relative includes w/single root folder", () => {
      const cases = [
        [
          "./a",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI,
              pattern: patternsToIExpression("a", "a/**")
            }]
          }
        ],
        [
          "./a/",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI,
              pattern: patternsToIExpression("a", "a/**")
            }]
          }
        ],
        [
          "./a/*b/c",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI,
              pattern: patternsToIExpression("a/*b/c", "a/*b/c/**")
            }]
          }
        ],
        [
          "./a/*b/c, " + fixPath("/project/foo"),
          {
            searchPaths: [
              {
                searchPath: ROOT_1_URI,
                pattern: patternsToIExpression("a/*b/c", "a/*b/c/**")
              },
              {
                searchPath: getUri("/project/foo")
              }
            ]
          }
        ],
        [
          "./a/b/,./c/d",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI,
              pattern: patternsToIExpression("a/b", "a/b/**", "c/d", "c/d/**")
            }]
          }
        ],
        [
          "../",
          {
            searchPaths: [{
              searchPath: getUri("/foo")
            }]
          }
        ],
        [
          "..",
          {
            searchPaths: [{
              searchPath: getUri("/foo")
            }]
          }
        ],
        [
          "..\\bar",
          {
            searchPaths: [{
              searchPath: getUri("/foo/bar")
            }]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
    test("relative includes w/two root folders", () => {
      const ROOT_2 = "/project/root2";
      mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: getUri(ROOT_2).fsPath }], WS_CONFIG_PATH, extUriBiasedIgnorePathCase);
      mockWorkspace.configuration = uri.file(fixPath("config"));
      const cases = [
        [
          "./root1",
          {
            searchPaths: [{
              searchPath: getUri(ROOT_1)
            }]
          }
        ],
        [
          "./root2",
          {
            searchPaths: [{
              searchPath: getUri(ROOT_2)
            }]
          }
        ],
        [
          "./root1/a/**/b, ./root2/**/*.txt",
          {
            searchPaths: [
              {
                searchPath: ROOT_1_URI,
                pattern: patternsToIExpression("a/**/b", "a/**/b/**")
              },
              {
                searchPath: getUri(ROOT_2),
                pattern: patternsToIExpression("**/*.txt", "**/*.txt/**")
              }
            ]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
    test("include ./foldername", () => {
      const ROOT_2 = "/project/root2";
      const ROOT_1_FOLDERNAME = "foldername";
      mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath, name: ROOT_1_FOLDERNAME }, { path: getUri(ROOT_2).fsPath }], WS_CONFIG_PATH, extUriBiasedIgnorePathCase);
      mockWorkspace.configuration = uri.file(fixPath("config"));
      const cases = [
        [
          "./foldername",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI
            }]
          }
        ],
        [
          "./foldername/foo",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI,
              pattern: patternsToIExpression("foo", "foo/**")
            }]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
    test("folder with slash in the name", () => {
      const ROOT_2 = "/project/root2";
      const ROOT_2_URI = getUri(ROOT_2);
      const ROOT_1_FOLDERNAME = "folder/one";
      const ROOT_2_FOLDERNAME = "folder/two+";
      mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath, name: ROOT_1_FOLDERNAME }, { path: ROOT_2_URI.fsPath, name: ROOT_2_FOLDERNAME }], WS_CONFIG_PATH, extUriBiasedIgnorePathCase);
      mockWorkspace.configuration = uri.file(fixPath("config"));
      const cases = [
        [
          "./folder/one",
          {
            searchPaths: [{
              searchPath: ROOT_1_URI
            }]
          }
        ],
        [
          "./folder/two+/foo/",
          {
            searchPaths: [{
              searchPath: ROOT_2_URI,
              pattern: patternsToIExpression("foo", "foo/**")
            }]
          }
        ],
        [
          "./folder/onesomethingelse",
          { searchPaths: [] }
        ],
        [
          "./folder/onesomethingelse/foo",
          { searchPaths: [] }
        ],
        [
          "./folder",
          { searchPaths: [] }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
    test("relative includes w/multiple ambiguous root folders", () => {
      const ROOT_2 = "/project/rootB";
      const ROOT_3 = "/otherproject/rootB";
      mockWorkspace.folders = toWorkspaceFolders([{ path: ROOT_1_URI.fsPath }, { path: getUri(ROOT_2).fsPath }, { path: getUri(ROOT_3).fsPath }], WS_CONFIG_PATH, extUriBiasedIgnorePathCase);
      mockWorkspace.configuration = uri.file(fixPath("/config"));
      const cases = [
        [
          "",
          {
            searchPaths: void 0
          }
        ],
        [
          "./",
          {
            searchPaths: void 0
          }
        ],
        [
          "./root1",
          {
            searchPaths: [{
              searchPath: getUri(ROOT_1)
            }]
          }
        ],
        [
          "./root1,./",
          {
            searchPaths: [{
              searchPath: getUri(ROOT_1)
            }]
          }
        ],
        [
          "./rootB",
          {
            searchPaths: [
              {
                searchPath: getUri(ROOT_2)
              },
              {
                searchPath: getUri(ROOT_3)
              }
            ]
          }
        ],
        [
          "./rootB/a/**/b, ./rootB/b/**/*.txt",
          {
            searchPaths: [
              {
                searchPath: getUri(ROOT_2),
                pattern: patternsToIExpression("a/**/b", "a/**/b/**", "b/**/*.txt", "b/**/*.txt/**")
              },
              {
                searchPath: getUri(ROOT_3),
                pattern: patternsToIExpression("a/**/b", "a/**/b/**", "b/**/*.txt", "b/**/*.txt/**")
              }
            ]
          }
        ],
        [
          "./root1/**/foo/, bar/",
          {
            pattern: patternsToIExpression("**/bar", "**/bar/**"),
            searchPaths: [
              {
                searchPath: ROOT_1_URI,
                pattern: patternsToIExpression("**/foo", "**/foo/**")
              }
            ]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
  });
  suite("parseSearchPaths 2", () => {
    function testIncludes(includePattern, expectedResult) {
      assertEqualSearchPathResults(
        queryBuilder.parseSearchPaths(includePattern),
        expectedResult,
        includePattern
      );
    }
    function testIncludesDataItem([includePattern, expectedResult]) {
      testIncludes(includePattern, expectedResult);
    }
    (isWindows ? test.skip : test)("includes with tilde", () => {
      const userHome = URI.file("/");
      const cases = [
        [
          "~/foo/bar",
          {
            searchPaths: [{ searchPath: getUri(userHome.fsPath, "/foo/bar") }]
          }
        ],
        [
          "~/foo/bar, a",
          {
            searchPaths: [{ searchPath: getUri(userHome.fsPath, "/foo/bar") }],
            pattern: patternsToIExpression(...globalGlob("a"))
          }
        ],
        [
          fixPath("/foo/~/bar"),
          {
            searchPaths: [{ searchPath: getUri("/foo/~/bar") }]
          }
        ]
      ];
      cases.forEach(testIncludesDataItem);
    });
  });
  suite("smartCase", () => {
    test("no flags -> no change", () => {
      const query = queryBuilder.text(
        {
          pattern: "a"
        },
        []
      );
      assert(!query.contentPattern.isCaseSensitive);
    });
    test("maintains isCaseSensitive when smartCase not set", () => {
      const query = queryBuilder.text(
        {
          pattern: "a",
          isCaseSensitive: true
        },
        []
      );
      assert(query.contentPattern.isCaseSensitive);
    });
    test("maintains isCaseSensitive when smartCase set", () => {
      const query = queryBuilder.text(
        {
          pattern: "a",
          isCaseSensitive: true
        },
        [],
        {
          isSmartCase: true
        }
      );
      assert(query.contentPattern.isCaseSensitive);
    });
    test("smartCase determines not case sensitive", () => {
      const query = queryBuilder.text(
        {
          pattern: "abcd"
        },
        [],
        {
          isSmartCase: true
        }
      );
      assert(!query.contentPattern.isCaseSensitive);
    });
    test("smartCase determines case sensitive", () => {
      const query = queryBuilder.text(
        {
          pattern: "abCd"
        },
        [],
        {
          isSmartCase: true
        }
      );
      assert(query.contentPattern.isCaseSensitive);
    });
    test("smartCase determines not case sensitive (regex)", () => {
      const query = queryBuilder.text(
        {
          pattern: "ab\\Sd",
          isRegExp: true
        },
        [],
        {
          isSmartCase: true
        }
      );
      assert(!query.contentPattern.isCaseSensitive);
    });
    test("smartCase determines case sensitive (regex)", () => {
      const query = queryBuilder.text(
        {
          pattern: "ab[A-Z]d",
          isRegExp: true
        },
        [],
        {
          isSmartCase: true
        }
      );
      assert(query.contentPattern.isCaseSensitive);
    });
  });
  suite("file", () => {
    test("simple file query", () => {
      const cacheKey = "asdf";
      const query = queryBuilder.file(
        [ROOT_1_NAMED_FOLDER],
        {
          cacheKey,
          sortByScore: true
        }
      );
      assert.strictEqual(query.folderQueries.length, 1);
      assert.strictEqual(query.cacheKey, cacheKey);
      assert(query.sortByScore);
    });
  });
  suite("pattern processing", () => {
    test("text query with comma-separated includes with no workspace", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [],
        {
          includePattern: "*.js,*.ts",
          expandPatterns: true
        }
      );
      assert.deepEqual(query.includePattern, {
        "**/*.js/**": true,
        "**/*.js": true,
        "**/*.ts/**": true,
        "**/*.ts": true
      });
      assert.strictEqual(query.folderQueries.length, 0);
    });
    test("text query with comma-separated includes with workspace", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [ROOT_1_URI],
        {
          includePattern: "*.js,*.ts",
          expandPatterns: true
        }
      );
      assert.deepEqual(query.includePattern, {
        "**/*.js/**": true,
        "**/*.js": true,
        "**/*.ts/**": true,
        "**/*.ts": true
      });
      assert.strictEqual(query.folderQueries.length, 1);
    });
    test("text query with comma-separated excludes globally", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [],
        {
          excludePattern: [{ pattern: "*.js,*.ts" }],
          expandPatterns: true
        }
      );
      assert.deepEqual(query.excludePattern, {
        "**/*.js/**": true,
        "**/*.js": true,
        "**/*.ts/**": true,
        "**/*.ts": true
      });
      assert.strictEqual(query.folderQueries.length, 0);
    });
    test("text query with comma-separated excludes globally in a workspace", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [ROOT_1_NAMED_FOLDER.uri],
        {
          excludePattern: [{ pattern: "*.js,*.ts" }],
          expandPatterns: true
        }
      );
      assert.deepEqual(query.excludePattern, {
        "**/*.js/**": true,
        "**/*.js": true,
        "**/*.ts/**": true,
        "**/*.ts": true
      });
      assert.strictEqual(query.folderQueries.length, 1);
    });
    test.skip("text query with multiple comma-separated excludes", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [ROOT_1_NAMED_FOLDER.uri],
        {
          excludePattern: [{ pattern: "*.js,*.ts" }, { pattern: "foo/*,bar/*" }],
          expandPatterns: true
        }
      );
      assert.deepEqual(query.excludePattern, [
        {
          "**/*.js/**": true,
          "**/*.js": true,
          "**/*.ts/**": true,
          "**/*.ts": true
        },
        {
          "**/foo/*/**": true,
          "**/foo/*": true,
          "**/bar/*/**": true,
          "**/bar/*": true
        }
      ]);
      assert.strictEqual(query.folderQueries.length, 1);
    });
    test.skip("text query with base URI on exclud", () => {
      const query = queryBuilder.text(
        { pattern: `` },
        [ROOT_1_NAMED_FOLDER.uri],
        {
          excludePattern: [{ uri: ROOT_1_URI, pattern: "*.js,*.ts" }],
          expandPatterns: true
        }
      );
      assert.deepEqual(query.excludePattern, {
        uri: ROOT_1_URI,
        pattern: {
          "**/*.js/**": true,
          "**/*.js": true,
          "**/*.ts/**": true,
          "**/*.ts": true
        }
      });
      assert.strictEqual(query.folderQueries.length, 1);
    });
  });
});
function makeExcludePatternFromPatterns(...patterns) {
  const pattern = patternsToIExpression(...patterns);
  return pattern ? [{ pattern }] : void 0;
}
function assertEqualTextQueries(actual, expected) {
  expected = {
    ...DEFAULT_TEXT_QUERY_PROPS,
    ...expected
  };
  return assertEqualQueries(actual, expected);
}
function assertEqualQueries(actual, expected) {
  expected = {
    ...DEFAULT_QUERY_PROPS,
    ...expected
  };
  const folderQueryToCompareObject = (fq) => {
    const excludePattern = fq.excludePattern?.map((e) => normalizeExpression(e.pattern));
    return {
      path: fq.folder.fsPath,
      excludePattern: excludePattern?.length ? excludePattern : void 0,
      includePattern: normalizeExpression(fq.includePattern),
      fileEncoding: fq.fileEncoding
    };
  };
  if (expected.folderQueries) {
    assert.deepStrictEqual(actual.folderQueries.map(folderQueryToCompareObject), expected.folderQueries.map(folderQueryToCompareObject));
    actual.folderQueries = [];
    expected.folderQueries = [];
  }
  if (expected.extraFileResources) {
    assert.deepStrictEqual(actual.extraFileResources.map((extraFile) => extraFile.fsPath), expected.extraFileResources.map((extraFile) => extraFile.fsPath));
    delete expected.extraFileResources;
    delete actual.extraFileResources;
  }
  delete actual.usingSearchPaths;
  actual.includePattern = normalizeExpression(actual.includePattern);
  actual.excludePattern = normalizeExpression(actual.excludePattern);
  cleanUndefinedQueryValues(actual);
  assert.deepStrictEqual(actual, expected);
}
function assertEqualSearchPathResults(actual, expected, message) {
  cleanUndefinedQueryValues(actual);
  assert.deepStrictEqual({ ...actual.pattern }, { ...expected.pattern }, message);
  assert.strictEqual(actual.searchPaths && actual.searchPaths.length, expected.searchPaths && expected.searchPaths.length);
  if (actual.searchPaths) {
    actual.searchPaths.forEach((searchPath, i) => {
      const expectedSearchPath = expected.searchPaths[i];
      assert.deepStrictEqual(searchPath.pattern && { ...searchPath.pattern }, expectedSearchPath.pattern);
      assert.strictEqual(searchPath.searchPath.toString(), expectedSearchPath.searchPath.toString());
    });
  }
}
function cleanUndefinedQueryValues(q) {
  for (const key in q) {
    if (q[key] === void 0) {
      delete q[key];
    } else if (typeof q[key] === "object") {
      cleanUndefinedQueryValues(q[key]);
    }
  }
  return q;
}
function globalGlob(pattern) {
  return [
    `**/${pattern}/**`,
    `**/${pattern}`
  ];
}
function patternsToIExpression(...patterns) {
  return patterns.length ? patterns.reduce((glob, cur) => {
    glob[cur] = true;
    return glob;
  }, {}) : void 0;
}
function getUri(...slashPathParts) {
  return uri.file(fixPath(...slashPathParts));
}
function fixPath(...slashPathParts) {
  if (isWindows && slashPathParts.length && !slashPathParts[0].match(/^c:/i)) {
    slashPathParts.unshift("c:");
  }
  return join(...slashPathParts);
}
function normalizeExpression(expression) {
  if (!expression) {
    return expression;
  }
  const normalized = {};
  Object.keys(expression).forEach((key) => {
    normalized[key.replace(/\\/g, "/")] = expression[key];
  });
  return normalized;
}
export {
  assertEqualQueries,
  assertEqualSearchPathResults,
  cleanUndefinedQueryValues,
  fixPath,
  getUri,
  globalGlob,
  normalizeExpression,
  patternsToIExpression
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3Rlc3QvYnJvd3Nlci9xdWVyeUJ1aWxkZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJRXhwcmVzc2lvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2dsb2IuanMnO1xuaW1wb3J0IHsgam9pbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3BhdGguanMnO1xuaW1wb3J0IHsgaXNXaW5kb3dzIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgVVJJLCBVUkkgYXMgdXJpIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCB0b1dvcmtzcGFjZUZvbGRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IHRvV29ya3NwYWNlRm9sZGVycyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZXMvY29tbW9uL3dvcmtzcGFjZXMuanMnO1xuaW1wb3J0IHsgSVNlYXJjaFBhdGhzSW5mbywgUXVlcnlCdWlsZGVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL3F1ZXJ5QnVpbGRlci5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRmlsZVF1ZXJ5LCBJRm9sZGVyUXVlcnksIElQYXR0ZXJuSW5mbywgSVRleHRRdWVyeSwgUXVlcnlUeXBlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBUZXN0UGF0aFNlcnZpY2UsIFRlc3RFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBJRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50LmpzJztcbmltcG9ydCB7IFdvcmtzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS90ZXN0L2NvbW1vbi90ZXN0V29ya3NwYWNlLmpzJztcbmltcG9ydCB7IGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5jb25zdCBERUZBVUxUX0VESVRPUl9DT05GSUcgPSB7fTtcbmNvbnN0IERFRkFVTFRfVVNFUl9DT05GSUcgPSB7IHVzZVJpcGdyZXA6IHRydWUsIHVzZUlnbm9yZUZpbGVzOiB0cnVlLCB1c2VHbG9iYWxJZ25vcmVGaWxlczogdHJ1ZSwgdXNlUGFyZW50SWdub3JlRmlsZXM6IHRydWUgfTtcbmNvbnN0IERFRkFVTFRfUVVFUllfUFJPUFMgPSB7fTtcbmNvbnN0IERFRkFVTFRfVEVYVF9RVUVSWV9QUk9QUyA9IHsgdXNlUENSRTI6IGZhbHNlIH07XG5cbnN1aXRlKCdRdWVyeUJ1aWxkZXInLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRjb25zdCBQQVRURVJOX0lORk86IElQYXR0ZXJuSW5mbyA9IHsgcGF0dGVybjogJ2EnIH07XG5cdGNvbnN0IFJPT1RfMSA9IGZpeFBhdGgoJy9mb28vcm9vdDEnKTtcblx0Y29uc3QgUk9PVF8xX1VSSSA9IGdldFVyaShST09UXzEpO1xuXHRjb25zdCBST09UXzFfTkFNRURfRk9MREVSID0gdG9Xb3Jrc3BhY2VGb2xkZXIoUk9PVF8xX1VSSSk7XG5cdGNvbnN0IFdTX0NPTkZJR19QQVRIID0gZ2V0VXJpKCcvYmFyL3Rlc3QuY29kZS13b3Jrc3BhY2UnKTsgLy8gbG9jYXRpb24gb2YgdGhlIHdvcmtzcGFjZSBmaWxlIChub3QgaW1wb3J0YW50IGV4Y2VwdCB0aGF0IGl0IGlzIGEgZmlsZSBVUkkpXG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBxdWVyeUJ1aWxkZXI6IFF1ZXJ5QnVpbGRlcjtcblx0bGV0IG1vY2tDb25maWdTZXJ2aWNlOiBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCBtb2NrQ29udGV4dFNlcnZpY2U6IFRlc3RDb250ZXh0U2VydmljZTtcblx0bGV0IG1vY2tXb3Jrc3BhY2U6IFdvcmtzcGFjZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cblx0XHRtb2NrQ29uZmlnU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRtb2NrQ29uZmlnU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbignc2VhcmNoJywgREVGQVVMVF9VU0VSX0NPTkZJRyk7XG5cdFx0bW9ja0NvbmZpZ1NlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ2VkaXRvcicsIERFRkFVTFRfRURJVE9SX0NPTkZJRyk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIG1vY2tDb25maWdTZXJ2aWNlKTtcblxuXHRcdG1vY2tDb250ZXh0U2VydmljZSA9IG5ldyBUZXN0Q29udGV4dFNlcnZpY2UoKTtcblx0XHRtb2NrV29ya3NwYWNlID0gbmV3IFdvcmtzcGFjZSgnd29ya3NwYWNlJywgW3RvV29ya3NwYWNlRm9sZGVyKFJPT1RfMV9VUkkpXSk7XG5cdFx0bW9ja0NvbnRleHRTZXJ2aWNlLnNldFdvcmtzcGFjZShtb2NrV29ya3NwYWNlKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLCBtb2NrQ29udGV4dFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVudmlyb25tZW50U2VydmljZSwgVGVzdEVudmlyb25tZW50U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUGF0aFNlcnZpY2UsIG5ldyBUZXN0UGF0aFNlcnZpY2UoKSk7XG5cblx0XHRxdWVyeUJ1aWxkZXIgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShRdWVyeUJ1aWxkZXIpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgdGV4dCBwYXR0ZXJuJywgKCkgPT4ge1xuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChQQVRURVJOX0lORk8pLFxuXHRcdFx0e1xuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbXSxcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdub3JtYWxpemUgbGl0ZXJhbCBuZXdsaW5lcycsICgpID0+IHtcblx0XHRhc3NlcnRFcXVhbFRleHRRdWVyaWVzKFxuXHRcdFx0cXVlcnlCdWlsZGVyLnRleHQoeyBwYXR0ZXJuOiAnZm9vXFxuYmFyJywgaXNSZWdFeHA6IHRydWUgfSksXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtdLFxuXHRcdFx0XHRjb250ZW50UGF0dGVybjoge1xuXHRcdFx0XHRcdHBhdHRlcm46ICdmb29cXFxcbmJhcicsXG5cdFx0XHRcdFx0aXNSZWdFeHA6IHRydWUsXG5cdFx0XHRcdFx0aXNNdWx0aWxpbmU6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KHsgcGF0dGVybjogJ2Zvb1xcbmJhcicsIGlzUmVnRXhwOiBmYWxzZSB9KSxcblx0XHRcdHtcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW10sXG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0cGF0dGVybjogJ2Zvb1xcbmJhcicsXG5cdFx0XHRcdFx0aXNSZWdFeHA6IGZhbHNlLFxuXHRcdFx0XHRcdGlzTXVsdGlsaW5lOiB0cnVlXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnc3BsaXRzIGluY2x1ZGUgcGF0dGVybiB3aGVuIGV4cGFuZFBhdHRlcm5zIGVuYWJsZWQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0RXF1YWxRdWVyaWVzKFxuXHRcdFx0cXVlcnlCdWlsZGVyLmZpbGUoXG5cdFx0XHRcdFtST09UXzFfTkFNRURfRk9MREVSXSxcblx0XHRcdFx0eyBpbmNsdWRlUGF0dGVybjogJyoqL2ZvbywgKiovYmFyJywgZXhwYW5kUGF0dGVybnM6IHRydWUgfSxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKiovZm9vJzogdHJ1ZSxcblx0XHRcdFx0XHQnKiovZm9vLyoqJzogdHJ1ZSxcblx0XHRcdFx0XHQnKiovYmFyJzogdHJ1ZSxcblx0XHRcdFx0XHQnKiovYmFyLyoqJzogdHJ1ZSxcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IHNwbGl0IGluY2x1ZGUgcGF0dGVybiB3aGVuIGV4cGFuZFBhdHRlcm5zIGRpc2FibGVkJywgKCkgPT4ge1xuXHRcdGFzc2VydEVxdWFsUXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci5maWxlKFxuXHRcdFx0XHRbUk9PVF8xX05BTUVEX0ZPTERFUl0sXG5cdFx0XHRcdHsgaW5jbHVkZVBhdHRlcm46ICcqKi9mb28sICoqL2JhcicgfSxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuRmlsZSxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnKiovZm9vLCAqKi9iYXInOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlUGF0dGVybiBhcnJheScsICgpID0+IHtcblx0XHRhc3NlcnRFcXVhbFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIuZmlsZShcblx0XHRcdFx0W1JPT1RfMV9OQU1FRF9GT0xERVJdLFxuXHRcdFx0XHR7IGluY2x1ZGVQYXR0ZXJuOiBbJyoqL2ZvbycsICcqKi9iYXInXSB9LFxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqKi9mb28nOiB0cnVlLFxuXHRcdFx0XHRcdCcqKi9iYXInOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpbmNsdWRlUGF0dGVybiBhcnJheSB3aXRoIGV4cGFuZFBhdHRlcm5zJywgKCkgPT4ge1xuXHRcdGFzc2VydEVxdWFsUXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci5maWxlKFxuXHRcdFx0XHRbUk9PVF8xX05BTUVEX0ZPTERFUl0sXG5cdFx0XHRcdHsgaW5jbHVkZVBhdHRlcm46IFsnKiovZm9vJywgJyoqL2JhciddLCBleHBhbmRQYXR0ZXJuczogdHJ1ZSB9LFxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5GaWxlLFxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdCcqKi9mb28nOiB0cnVlLFxuXHRcdFx0XHRcdCcqKi9mb28vKionOiB0cnVlLFxuXHRcdFx0XHRcdCcqKi9iYXInOiB0cnVlLFxuXHRcdFx0XHRcdCcqKi9iYXIvKionOiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZm9sZGVyUmVzb3VyY2VzJywgKCkgPT4ge1xuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0UEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRbUk9PVF8xX1VSSV1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7IGZvbGRlcjogUk9PVF8xX1VSSSB9XSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgZXhjbHVkZSBzZXR0aW5nJywgKCkgPT4ge1xuXHRcdG1vY2tDb25maWdTZXJ2aWNlLnNldFVzZXJDb25maWd1cmF0aW9uKCdzZWFyY2gnLCB7XG5cdFx0XHQuLi5ERUZBVUxUX1VTRVJfQ09ORklHLFxuXHRcdFx0ZXhjbHVkZToge1xuXHRcdFx0XHQnYmFyLyoqJzogdHJ1ZSxcblx0XHRcdFx0J2Zvby8qKic6IHtcblx0XHRcdFx0XHQnd2hlbic6ICckKGJhc2VuYW1lKS50cydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlIC8vIHZlcmlmeSB0aGF0IHRoaXMgZG9lc24ndCBhZmZlY3QgcGF0dGVybnMgZnJvbSBjb25maWd1cmF0aW9uXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBbe1xuXHRcdFx0XHRcdFx0cGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHQnYmFyLyoqJzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0J2Zvby8qKic6IHtcblx0XHRcdFx0XHRcdFx0XHQnd2hlbic6ICckKGJhc2VuYW1lKS50cydcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1dXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dFxuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZSBpbmNsdWRlJywgKCkgPT4ge1xuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0UEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRbUk9PVF8xX1VSSV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjogJ2JhcicsXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0JyoqL2Jhcic6IHRydWUsXG5cdFx0XHRcdFx0JyoqL2Jhci8qKic6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiAnYmFyJ1xuXHRcdFx0XHR9XG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRjb250ZW50UGF0dGVybjogUEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbe1xuXHRcdFx0XHRcdGZvbGRlcjogUk9PVF8xX1VSSVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0aW5jbHVkZVBhdHRlcm46IHtcblx0XHRcdFx0XHQnYmFyJzogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dFxuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbXBsZSBpbmNsdWRlIHdpdGggLi8gc3ludGF4JywgKCkgPT4ge1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiAnLi9iYXInLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHQnYmFyJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdiYXIvKionOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiAnLlxcXFxiYXInLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHQnYmFyJzogdHJ1ZSxcblx0XHRcdFx0XHRcdCdiYXIvKionOiB0cnVlXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNsdWRlIHNldHRpbmcgYW5kIHNlYXJjaFBhdGgnLCAoKSA9PiB7XG5cdFx0bW9ja0NvbmZpZ1NlcnZpY2Uuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3NlYXJjaCcsIHtcblx0XHRcdC4uLkRFRkFVTFRfVVNFUl9DT05GSUcsXG5cdFx0XHRleGNsdWRlOiB7XG5cdFx0XHRcdCdmb28vKiovKi5qcyc6IHRydWUsXG5cdFx0XHRcdCdiYXIvKionOiB7XG5cdFx0XHRcdFx0J3doZW4nOiAnJChiYXNlbmFtZSkudHMnXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0UEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRbUk9PVF8xX1VSSV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjogJy4vZm9vJyxcblx0XHRcdFx0XHRleHBhbmRQYXR0ZXJuczogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRjb250ZW50UGF0dGVybjogUEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRmb2xkZXJRdWVyaWVzOiBbe1xuXHRcdFx0XHRcdGZvbGRlcjogUk9PVF8xX1VSSSxcblx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0J2Zvbyc6IHRydWUsXG5cdFx0XHRcdFx0XHQnZm9vLyoqJzogdHJ1ZVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdCdmb28vKiovKi5qcyc6IHRydWUsXG5cdFx0XHRcdFx0XHRcdCdiYXIvKionOiB7XG5cdFx0XHRcdFx0XHRcdFx0J3doZW4nOiAnJChiYXNlbmFtZSkudHMnXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XVxuXHRcdFx0XHR9XSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXJvb3QgZXhjbHVkZSBzZXR0aW5ncycsICgpID0+IHtcblx0XHRjb25zdCBST09UXzIgPSBmaXhQYXRoKCcvcHJvamVjdC9yb290MicpO1xuXHRcdGNvbnN0IFJPT1RfMl9VUkkgPSBnZXRVcmkoUk9PVF8yKTtcblx0XHRjb25zdCBST09UXzMgPSBmaXhQYXRoKCcvcHJvamVjdC9yb290MycpO1xuXHRcdGNvbnN0IFJPT1RfM19VUkkgPSBnZXRVcmkoUk9PVF8zKTtcblx0XHRtb2NrV29ya3NwYWNlLmZvbGRlcnMgPSB0b1dvcmtzcGFjZUZvbGRlcnMoW3sgcGF0aDogUk9PVF8xX1VSSS5mc1BhdGggfSwgeyBwYXRoOiBST09UXzJfVVJJLmZzUGF0aCB9LCB7IHBhdGg6IFJPT1RfM19VUkkuZnNQYXRoIH1dLCBXU19DT05GSUdfUEFUSCwgZXh0VXJpQmlhc2VkSWdub3JlUGF0aENhc2UpO1xuXHRcdG1vY2tXb3Jrc3BhY2UuY29uZmlndXJhdGlvbiA9IHVyaS5maWxlKGZpeFBhdGgoJy9jb25maWcnKSk7XG5cblx0XHRtb2NrQ29uZmlnU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbignc2VhcmNoJywge1xuXHRcdFx0Li4uREVGQVVMVF9VU0VSX0NPTkZJRyxcblx0XHRcdGV4Y2x1ZGU6IHsgJ2Zvby8qKi8qLmpzJzogdHJ1ZSB9XG5cdFx0fSwgUk9PVF8xX1VSSSk7XG5cblx0XHRtb2NrQ29uZmlnU2VydmljZS5zZXRVc2VyQ29uZmlndXJhdGlvbignc2VhcmNoJywge1xuXHRcdFx0Li4uREVGQVVMVF9VU0VSX0NPTkZJRyxcblx0XHRcdGV4Y2x1ZGU6IHsgJ2Jhcic6IHRydWUgfVxuXHRcdH0sIFJPT1RfMl9VUkkpO1xuXG5cdFx0Ly8gVGhlcmUgYXJlIDMgcm9vdHMsIHRoZSBmaXJzdCB0d28gaGF2ZSBzZWFyY2guZXhjbHVkZSBzZXR0aW5ncywgdGVzdCB0aGF0IHRoZSBjb3JyZWN0IGJhc2ljIHF1ZXJ5IGlzIHJldHVybmVkXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJLCBST09UXzJfVVJJLCBST09UXzNfVVJJXVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW1xuXHRcdFx0XHRcdHsgZm9sZGVyOiBST09UXzFfVVJJLCBleGNsdWRlUGF0dGVybjogbWFrZUV4Y2x1ZGVQYXR0ZXJuRnJvbVBhdHRlcm5zKCdmb28vKiovKi5qcycpIH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IFJPT1RfMl9VUkksIGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhjbHVkZVBhdHRlcm5Gcm9tUGF0dGVybnMoJ2JhcicpIH0sXG5cdFx0XHRcdFx0eyBmb2xkZXI6IFJPT1RfM19VUkkgfVxuXHRcdFx0XHRdLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dFxuXHRcdFx0fVxuXHRcdCk7XG5cblx0XHQvLyBOb3cgdGVzdCB0aGF0IGl0IG1lcmdlcyB0aGUgcm9vdCBleGNsdWRlcyB3aGVuIGFuICdpbmNsdWRlJyBpcyB1c2VkXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJLCBST09UXzJfVVJJLCBST09UXzNfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiAnLi9yb290Mi9zcmMnLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMl9VUkksXG5cdFx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjoge1xuXHRcdFx0XHRcdFx0XHQnc3JjJzogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0J3NyYy8qKic6IHRydWVcblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3tcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogeyAnYmFyJzogdHJ1ZSB9XG5cdFx0XHRcdFx0XHR9XSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0XG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc2ltcGxlIGV4Y2x1ZGUgaW5wdXQgcGF0dGVybicsICgpID0+IHtcblx0XHRhc3NlcnRFcXVhbFRleHRRdWVyaWVzKFxuXHRcdFx0cXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0W1JPT1RfMV9VUkldLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7IHBhdHRlcm46ICdmb28nIH1dLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCxcblx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbiguLi5nbG9iYWxHbG9iKCdmb28nKSlcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdmaWxlIHBhdHRlcm4gdHJpbW1pbmcnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9ICdjb250ZW50Jztcblx0XHRhc3NlcnRFcXVhbFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIuZmlsZShcblx0XHRcdFx0W10sXG5cdFx0XHRcdHsgZmlsZVBhdHRlcm46IGAgJHtjb250ZW50fSBgIH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFtdLFxuXHRcdFx0XHRmaWxlUGF0dGVybjogY29udGVudCxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLkZpbGVcblx0XHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdleGNsdWRlIC4vIHN5bnRheCcsICgpID0+IHtcblx0XHRhc3NlcnRFcXVhbFRleHRRdWVyaWVzKFxuXHRcdFx0cXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0W1JPT1RfMV9VUkldLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IFt7IHBhdHRlcm46ICcuL2JhcicgfV0sXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUkksXG5cdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IG1ha2VFeGNsdWRlUGF0dGVybkZyb21QYXR0ZXJucygnYmFyJywgJ2Jhci8qKicpLFxuXHRcdFx0XHR9XSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBbeyBwYXR0ZXJuOiAnLi9iYXIvKiovKi50cycgfV0sXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUkksXG5cdFx0XHRcdFx0ZXhjbHVkZVBhdHRlcm46IG1ha2VFeGNsdWRlUGF0dGVybkZyb21QYXR0ZXJucygnYmFyLyoqLyoudHMnLCAnYmFyLyoqLyoudHMvKionKSxcblx0XHRcdFx0fV0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0XG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0UEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRbUk9PVF8xX1VSSV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3sgcGF0dGVybjogJy5cXFxcYmFyXFxcXCoqXFxcXCoudHMnIH1dLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGNvbnRlbnRQYXR0ZXJuOiBQQVRURVJOX0lORk8sXG5cdFx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdFx0Zm9sZGVyOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBtYWtlRXhjbHVkZVBhdHRlcm5Gcm9tUGF0dGVybnMoJ2Jhci8qKi8qLnRzJywgJ2Jhci8qKi8qLnRzLyoqJyksXG5cdFx0XHRcdH1dLFxuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dFxuXHRcdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4dHJhRmlsZVJlc291cmNlcycsICgpID0+IHtcblx0XHRhc3NlcnRFcXVhbFRleHRRdWVyaWVzKFxuXHRcdFx0cXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0W1JPT1RfMV9VUkldLFxuXHRcdFx0XHR7IGV4dHJhRmlsZVJlc291cmNlczogW2dldFVyaSgnL2Zvby9iYXIuanMnKV0gfVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdGV4dHJhRmlsZVJlc291cmNlczogW2dldFVyaSgnL2Zvby9iYXIuanMnKV0sXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0XG5cdFx0XHR9KTtcblxuXHRcdGFzc2VydEVxdWFsVGV4dFF1ZXJpZXMoXG5cdFx0XHRxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0UEFUVEVSTl9JTkZPLFxuXHRcdFx0XHRbUk9PVF8xX1VSSV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRleHRyYUZpbGVSZXNvdXJjZXM6IFtnZXRVcmkoJy9mb28vYmFyLmpzJyldLFxuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBbeyBwYXR0ZXJuOiAnKi5qcycgfV0sXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oLi4uZ2xvYmFsR2xvYignKi5qcycpKSxcblx0XHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHRcblx0XHRcdH0pO1xuXG5cdFx0YXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhcblx0XHRcdHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHRQQVRURVJOX0lORk8sXG5cdFx0XHRcdFtST09UXzFfVVJJXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV4dHJhRmlsZVJlc291cmNlczogW2dldFVyaSgnL2Zvby9iYXIuanMnKV0sXG5cdFx0XHRcdFx0aW5jbHVkZVBhdHRlcm46ICcqLnR4dCcsXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0Y29udGVudFBhdHRlcm46IFBBVFRFUk5fSU5GTyxcblx0XHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0XHRmb2xkZXI6IFJPT1RfMV9VUklcblx0XHRcdFx0fV0sXG5cdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oLi4uZ2xvYmFsR2xvYignKi50eHQnKSksXG5cdFx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0XG5cdFx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3BhcnNlU2VhcmNoUGF0aHMgMScsICgpID0+IHtcblx0XHR0ZXN0KCdzaW1wbGUgaW5jbHVkZXMnLCAoKSA9PiB7XG5cdFx0XHRmdW5jdGlvbiB0ZXN0U2ltcGxlSW5jbHVkZXMoaW5jbHVkZVBhdHRlcm46IHN0cmluZywgZXhwZWN0ZWRQYXR0ZXJuczogc3RyaW5nW10pOiB2b2lkIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gcXVlcnlCdWlsZGVyLnBhcnNlU2VhcmNoUGF0aHMoaW5jbHVkZVBhdHRlcm4pO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRcdHsgLi4ucmVzdWx0LnBhdHRlcm4gfSxcblx0XHRcdFx0XHRwYXR0ZXJuc1RvSUV4cHJlc3Npb24oLi4uZXhwZWN0ZWRQYXR0ZXJucyksXG5cdFx0XHRcdFx0aW5jbHVkZVBhdHRlcm4pO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LnNlYXJjaFBhdGhzLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXG5cdFx0XHRbXG5cdFx0XHRcdFsnYScsIFsnKiovYS8qKicsICcqKi9hJ11dLFxuXHRcdFx0XHRbJ2EvYicsIFsnKiovYS9iJywgJyoqL2EvYi8qKiddXSxcblx0XHRcdFx0WydhL2IsICBjJywgWycqKi9hL2InLCAnKiovYycsICcqKi9hL2IvKionLCAnKiovYy8qKiddXSxcblx0XHRcdFx0WydhLC50eHQnLCBbJyoqL2EnLCAnKiovYS8qKicsICcqKi8qLnR4dCcsICcqKi8qLnR4dC8qKiddXSxcblx0XHRcdFx0WydhLCwsYicsIFsnKiovYScsICcqKi9hLyoqJywgJyoqL2InLCAnKiovYi8qKiddXSxcblx0XHRcdFx0WycqKi9hLGIvKionLCBbJyoqL2EnLCAnKiovYS8qKicsICcqKi9iLyoqJ11dXG5cdFx0XHRdLmZvckVhY2goKFtpbmNsdWRlUGF0dGVybiwgZXhwZWN0ZWRQYXR0ZXJuc10pID0+IHRlc3RTaW1wbGVJbmNsdWRlcyg8c3RyaW5nPmluY2x1ZGVQYXR0ZXJuLCA8c3RyaW5nW10+ZXhwZWN0ZWRQYXR0ZXJucykpO1xuXHRcdH0pO1xuXG5cdFx0ZnVuY3Rpb24gdGVzdEluY2x1ZGVzKGluY2x1ZGVQYXR0ZXJuOiBzdHJpbmcsIGV4cGVjdGVkUmVzdWx0OiBJU2VhcmNoUGF0aHNJbmZvKTogdm9pZCB7XG5cdFx0XHRsZXQgYWN0dWFsOiBJU2VhcmNoUGF0aHNJbmZvO1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0YWN0dWFsID0gcXVlcnlCdWlsZGVyLnBhcnNlU2VhcmNoUGF0aHMoaW5jbHVkZVBhdHRlcm4pO1xuXHRcdFx0fSBjYXRjaCAoXykge1xuXHRcdFx0XHRhY3R1YWwgPSB7IHNlYXJjaFBhdGhzOiBbXSB9O1xuXHRcdFx0fVxuXG5cdFx0XHRhc3NlcnRFcXVhbFNlYXJjaFBhdGhSZXN1bHRzKFxuXHRcdFx0XHRhY3R1YWwsXG5cdFx0XHRcdGV4cGVjdGVkUmVzdWx0LFxuXHRcdFx0XHRpbmNsdWRlUGF0dGVybik7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdGVzdEluY2x1ZGVzRGF0YUl0ZW0oW2luY2x1ZGVQYXR0ZXJuLCBleHBlY3RlZFJlc3VsdF06IFtzdHJpbmcsIElTZWFyY2hQYXRoc0luZm9dKTogdm9pZCB7XG5cdFx0XHR0ZXN0SW5jbHVkZXMoaW5jbHVkZVBhdHRlcm4sIGV4cGVjdGVkUmVzdWx0KTtcblx0XHR9XG5cblx0XHR0ZXN0KCdhYnNvbHV0ZSBpbmNsdWRlcycsICgpID0+IHtcblx0XHRcdGNvbnN0IGNhc2VzOiBbc3RyaW5nLCBJU2VhcmNoUGF0aHNJbmZvXVtdID0gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Zml4UGF0aCgnL2Zvby9iYXInKSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3sgc2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vL2JhcicpIH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Zml4UGF0aCgnL2Zvby9iYXInKSArICcsJyArICdhJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3sgc2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vL2JhcicpIH1dLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKC4uLmdsb2JhbEdsb2IoJ2EnKSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRmaXhQYXRoKCcvZm9vL2JhcicpICsgJywnICsgZml4UGF0aCgnLzEvMicpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbeyBzZWFyY2hQYXRoOiBnZXRVcmkoJy9mb28vYmFyJykgfSwgeyBzZWFyY2hQYXRoOiBnZXRVcmkoJy8xLzInKSB9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGZpeFBhdGgoJy9mb28vYmFyJykgKyAnLCcgKyBmaXhQYXRoKCcvZm9vLy4uL2Zvby9iYXIvZm9vYXIvLi4nKSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vL2JhcicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGZpeFBhdGgoJy9mb28vYmFyLyoqLyoudHMnKSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vL2JhcicpLFxuXHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oJyoqLyoudHMnLCAnKiovKi50cy8qKicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGZpeFBhdGgoJy9mb28vYmFyLyphL2IvYycpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbe1xuXHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoJy9mb28vYmFyJyksXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignKmEvYi9jJywgJyphL2IvYy8qKicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGZpeFBhdGgoJy8qYS9iL2MnKSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKCcvJyksXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignKmEvYi9jJywgJyphL2IvYy8qKicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGZpeFBhdGgoJy9mb28ve2IsY31hcicpLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbe1xuXHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoJy9mb28nKSxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCd7YixjfWFyJywgJ3tiLGN9YXIvKionKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRjYXNlcy5mb3JFYWNoKHRlc3RJbmNsdWRlc0RhdGFJdGVtKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbGF0aXZlIGluY2x1ZGVzIHcvc2luZ2xlIHJvb3QgZm9sZGVyJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FzZXM6IFtzdHJpbmcsIElTZWFyY2hQYXRoc0luZm9dW10gPSBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9hJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8xX1VSSSxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdhJywgJ2EvKionKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9hLycsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7XG5cdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IFJPT1RfMV9VUkksXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignYScsICdhLyoqJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vYS8qYi9jJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8xX1VSSSxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdhLypiL2MnLCAnYS8qYi9jLyoqJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vYS8qYi9jLCAnICsgZml4UGF0aCgnL3Byb2plY3QvZm9vJyksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFtcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IFJPT1RfMV9VUkksXG5cdFx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdhLypiL2MnLCAnYS8qYi9jLyoqJylcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IGdldFVyaSgnL3Byb2plY3QvZm9vJylcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9hL2IvLC4vYy9kJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8xX1VSSSxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdhL2InLCAnYS9iLyoqJywgJ2MvZCcsICdjL2QvKionKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi4vJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4uJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKCcvZm9vJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4uXFxcXGJhcicsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7XG5cdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IGdldFVyaSgnL2Zvby9iYXInKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRjYXNlcy5mb3JFYWNoKHRlc3RJbmNsdWRlc0RhdGFJdGVtKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbGF0aXZlIGluY2x1ZGVzIHcvdHdvIHJvb3QgZm9sZGVycycsICgpID0+IHtcblx0XHRcdGNvbnN0IFJPT1RfMiA9ICcvcHJvamVjdC9yb290Mic7XG5cdFx0XHRtb2NrV29ya3NwYWNlLmZvbGRlcnMgPSB0b1dvcmtzcGFjZUZvbGRlcnMoW3sgcGF0aDogUk9PVF8xX1VSSS5mc1BhdGggfSwgeyBwYXRoOiBnZXRVcmkoUk9PVF8yKS5mc1BhdGggfV0sIFdTX0NPTkZJR19QQVRILCBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZSk7XG5cdFx0XHRtb2NrV29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPSB1cmkuZmlsZShmaXhQYXRoKCdjb25maWcnKSk7XG5cblx0XHRcdGNvbnN0IGNhc2VzOiBbc3RyaW5nLCBJU2VhcmNoUGF0aHNJbmZvXVtdID0gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vcm9vdDEnLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbe1xuXHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoUk9PVF8xKVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9yb290MicsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7XG5cdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IGdldFVyaShST09UXzIpLFxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9yb290MS9hLyoqL2IsIC4vcm9vdDIvKiovKi50eHQnLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignYS8qKi9iJywgJ2EvKiovYi8qKicpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoUk9PVF8yKSxcblx0XHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oJyoqLyoudHh0JywgJyoqLyoudHh0LyoqJylcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRjYXNlcy5mb3JFYWNoKHRlc3RJbmNsdWRlc0RhdGFJdGVtKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2luY2x1ZGUgLi9mb2xkZXJuYW1lJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgUk9PVF8yID0gJy9wcm9qZWN0L3Jvb3QyJztcblx0XHRcdGNvbnN0IFJPT1RfMV9GT0xERVJOQU1FID0gJ2ZvbGRlcm5hbWUnO1xuXHRcdFx0bW9ja1dvcmtzcGFjZS5mb2xkZXJzID0gdG9Xb3Jrc3BhY2VGb2xkZXJzKFt7IHBhdGg6IFJPT1RfMV9VUkkuZnNQYXRoLCBuYW1lOiBST09UXzFfRk9MREVSTkFNRSB9LCB7IHBhdGg6IGdldFVyaShST09UXzIpLmZzUGF0aCB9XSwgV1NfQ09ORklHX1BBVEgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHRcdG1vY2tXb3Jrc3BhY2UuY29uZmlndXJhdGlvbiA9IHVyaS5maWxlKGZpeFBhdGgoJ2NvbmZpZycpKTtcblxuXHRcdFx0Y29uc3QgY2FzZXM6IFtzdHJpbmcsIElTZWFyY2hQYXRoc0luZm9dW10gPSBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9mb2xkZXJuYW1lJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8xX1VSSVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9mb2xkZXJuYW1lL2ZvbycsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7XG5cdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IFJPT1RfMV9VUkksXG5cdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignZm9vJywgJ2Zvby8qKicpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0XTtcblx0XHRcdGNhc2VzLmZvckVhY2godGVzdEluY2x1ZGVzRGF0YUl0ZW0pO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZm9sZGVyIHdpdGggc2xhc2ggaW4gdGhlIG5hbWUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBST09UXzIgPSAnL3Byb2plY3Qvcm9vdDInO1xuXHRcdFx0Y29uc3QgUk9PVF8yX1VSSSA9IGdldFVyaShST09UXzIpO1xuXHRcdFx0Y29uc3QgUk9PVF8xX0ZPTERFUk5BTUUgPSAnZm9sZGVyL29uZSc7XG5cdFx0XHRjb25zdCBST09UXzJfRk9MREVSTkFNRSA9ICdmb2xkZXIvdHdvKyc7IC8vIEFuZCBhbm90aGVyIHJlZ2V4IGNoYXJhY3RlciwgIzEyNjAwM1xuXHRcdFx0bW9ja1dvcmtzcGFjZS5mb2xkZXJzID0gdG9Xb3Jrc3BhY2VGb2xkZXJzKFt7IHBhdGg6IFJPT1RfMV9VUkkuZnNQYXRoLCBuYW1lOiBST09UXzFfRk9MREVSTkFNRSB9LCB7IHBhdGg6IFJPT1RfMl9VUkkuZnNQYXRoLCBuYW1lOiBST09UXzJfRk9MREVSTkFNRSB9XSwgV1NfQ09ORklHX1BBVEgsIGV4dFVyaUJpYXNlZElnbm9yZVBhdGhDYXNlKTtcblx0XHRcdG1vY2tXb3Jrc3BhY2UuY29uZmlndXJhdGlvbiA9IHVyaS5maWxlKGZpeFBhdGgoJ2NvbmZpZycpKTtcblxuXHRcdFx0Y29uc3QgY2FzZXM6IFtzdHJpbmcsIElTZWFyY2hQYXRoc0luZm9dW10gPSBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9mb2xkZXIvb25lJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8xX1VSSVxuXHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9mb2xkZXIvdHdvKy9mb28vJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogUk9PVF8yX1VSSSxcblx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdmb28nLCAnZm9vLyoqJylcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vZm9sZGVyL29uZXNvbWV0aGluZ2Vsc2UnLFxuXHRcdFx0XHRcdHsgc2VhcmNoUGF0aHM6IFtdIH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcuL2ZvbGRlci9vbmVzb21ldGhpbmdlbHNlL2ZvbycsXG5cdFx0XHRcdFx0eyBzZWFyY2hQYXRoczogW10gfVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vZm9sZGVyJyxcblx0XHRcdFx0XHR7IHNlYXJjaFBhdGhzOiBbXSB9XG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRjYXNlcy5mb3JFYWNoKHRlc3RJbmNsdWRlc0RhdGFJdGVtKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3JlbGF0aXZlIGluY2x1ZGVzIHcvbXVsdGlwbGUgYW1iaWd1b3VzIHJvb3QgZm9sZGVycycsICgpID0+IHtcblx0XHRcdGNvbnN0IFJPT1RfMiA9ICcvcHJvamVjdC9yb290Qic7XG5cdFx0XHRjb25zdCBST09UXzMgPSAnL290aGVycHJvamVjdC9yb290Qic7XG5cdFx0XHRtb2NrV29ya3NwYWNlLmZvbGRlcnMgPSB0b1dvcmtzcGFjZUZvbGRlcnMoW3sgcGF0aDogUk9PVF8xX1VSSS5mc1BhdGggfSwgeyBwYXRoOiBnZXRVcmkoUk9PVF8yKS5mc1BhdGggfSwgeyBwYXRoOiBnZXRVcmkoUk9PVF8zKS5mc1BhdGggfV0sIFdTX0NPTkZJR19QQVRILCBleHRVcmlCaWFzZWRJZ25vcmVQYXRoQ2FzZSk7XG5cdFx0XHRtb2NrV29ya3NwYWNlLmNvbmZpZ3VyYXRpb24gPSB1cmkuZmlsZShmaXhQYXRoKCcvY29uZmlnJykpO1xuXG5cdFx0XHRjb25zdCBjYXNlczogW3N0cmluZywgSVNlYXJjaFBhdGhzSW5mb11bXSA9IFtcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcnLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi8nLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9yb290MScsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7XG5cdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IGdldFVyaShST09UXzEpXG5cdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcuL3Jvb3QxLC4vJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW3tcblx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKFJPT1RfMSlcblx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Jy4vcm9vdEInLFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoUk9PVF8yKSxcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRcdHNlYXJjaFBhdGg6IGdldFVyaShST09UXzMpLFxuXHRcdFx0XHRcdFx0XHR9XVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCcuL3Jvb3RCL2EvKiovYiwgLi9yb290Qi9iLyoqLyoudHh0Jyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRzZWFyY2hQYXRoczogW1xuXHRcdFx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRcdFx0c2VhcmNoUGF0aDogZ2V0VXJpKFJPT1RfMiksXG5cdFx0XHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKCdhLyoqL2InLCAnYS8qKi9iLyoqJywgJ2IvKiovKi50eHQnLCAnYi8qKi8qLnR4dC8qKicpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBnZXRVcmkoUk9PVF8zKSxcblx0XHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oJ2EvKiovYicsICdhLyoqL2IvKionLCAnYi8qKi8qLnR4dCcsICdiLyoqLyoudHh0LyoqJylcblx0XHRcdFx0XHRcdFx0fV1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLi9yb290MS8qKi9mb28vLCBiYXIvJyxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRwYXR0ZXJuOiBwYXR0ZXJuc1RvSUV4cHJlc3Npb24oJyoqL2JhcicsICcqKi9iYXIvKionKSxcblx0XHRcdFx0XHRcdHNlYXJjaFBhdGhzOiBbXG5cdFx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0XHRzZWFyY2hQYXRoOiBST09UXzFfVVJJLFxuXHRcdFx0XHRcdFx0XHRcdHBhdHRlcm46IHBhdHRlcm5zVG9JRXhwcmVzc2lvbignKiovZm9vJywgJyoqL2Zvby8qKicpXG5cdFx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdXG5cdFx0XHRdO1xuXHRcdFx0Y2FzZXMuZm9yRWFjaCh0ZXN0SW5jbHVkZXNEYXRhSXRlbSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdwYXJzZVNlYXJjaFBhdGhzIDInLCAoKSA9PiB7XG5cblx0XHRmdW5jdGlvbiB0ZXN0SW5jbHVkZXMoaW5jbHVkZVBhdHRlcm46IHN0cmluZywgZXhwZWN0ZWRSZXN1bHQ6IElTZWFyY2hQYXRoc0luZm8pOiB2b2lkIHtcblx0XHRcdGFzc2VydEVxdWFsU2VhcmNoUGF0aFJlc3VsdHMoXG5cdFx0XHRcdHF1ZXJ5QnVpbGRlci5wYXJzZVNlYXJjaFBhdGhzKGluY2x1ZGVQYXR0ZXJuKSxcblx0XHRcdFx0ZXhwZWN0ZWRSZXN1bHQsXG5cdFx0XHRcdGluY2x1ZGVQYXR0ZXJuKTtcblx0XHR9XG5cblx0XHRmdW5jdGlvbiB0ZXN0SW5jbHVkZXNEYXRhSXRlbShbaW5jbHVkZVBhdHRlcm4sIGV4cGVjdGVkUmVzdWx0XTogW3N0cmluZywgSVNlYXJjaFBhdGhzSW5mb10pOiB2b2lkIHtcblx0XHRcdHRlc3RJbmNsdWRlcyhpbmNsdWRlUGF0dGVybiwgZXhwZWN0ZWRSZXN1bHQpO1xuXHRcdH1cblxuXHRcdChpc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgnaW5jbHVkZXMgd2l0aCB0aWxkZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHVzZXJIb21lID0gVVJJLmZpbGUoJy8nKTtcblx0XHRcdGNvbnN0IGNhc2VzOiBbc3RyaW5nLCBJU2VhcmNoUGF0aHNJbmZvXVtdID0gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J34vZm9vL2JhcicsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7IHNlYXJjaFBhdGg6IGdldFVyaSh1c2VySG9tZS5mc1BhdGgsICcvZm9vL2JhcicpIH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0J34vZm9vL2JhciwgYScsXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7IHNlYXJjaFBhdGg6IGdldFVyaSh1c2VySG9tZS5mc1BhdGgsICcvZm9vL2JhcicpIH1dLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogcGF0dGVybnNUb0lFeHByZXNzaW9uKC4uLmdsb2JhbEdsb2IoJ2EnKSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRmaXhQYXRoKCcvZm9vL34vYmFyJyksXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0c2VhcmNoUGF0aHM6IFt7IHNlYXJjaFBhdGg6IGdldFVyaSgnL2Zvby9+L2JhcicpIH1dXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0XTtcblx0XHRcdGNhc2VzLmZvckVhY2godGVzdEluY2x1ZGVzRGF0YUl0ZW0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHRzdWl0ZSgnc21hcnRDYXNlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ25vIGZsYWdzIC0+IG5vIGNoYW5nZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gcXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAnYSdcblx0XHRcdFx0fSxcblx0XHRcdFx0W10pO1xuXG5cdFx0XHRhc3NlcnQoIXF1ZXJ5LmNvbnRlbnRQYXR0ZXJuLmlzQ2FzZVNlbnNpdGl2ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdtYWludGFpbnMgaXNDYXNlU2Vuc2l0aXZlIHdoZW4gc21hcnRDYXNlIG5vdCBzZXQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cGF0dGVybjogJ2EnLFxuXHRcdFx0XHRcdGlzQ2FzZVNlbnNpdGl2ZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRbXSk7XG5cblx0XHRcdGFzc2VydChxdWVyeS5jb250ZW50UGF0dGVybi5pc0Nhc2VTZW5zaXRpdmUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnbWFpbnRhaW5zIGlzQ2FzZVNlbnNpdGl2ZSB3aGVuIHNtYXJ0Q2FzZSBzZXQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cGF0dGVybjogJ2EnLFxuXHRcdFx0XHRcdGlzQ2FzZVNlbnNpdGl2ZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlzU21hcnRDYXNlOiB0cnVlXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQocXVlcnkuY29udGVudFBhdHRlcm4uaXNDYXNlU2Vuc2l0aXZlKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NtYXJ0Q2FzZSBkZXRlcm1pbmVzIG5vdCBjYXNlIHNlbnNpdGl2ZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gcXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRwYXR0ZXJuOiAnYWJjZCdcblx0XHRcdFx0fSxcblx0XHRcdFx0W10sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpc1NtYXJ0Q2FzZTogdHJ1ZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0KCFxdWVyeS5jb250ZW50UGF0dGVybi5pc0Nhc2VTZW5zaXRpdmUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc21hcnRDYXNlIGRldGVybWluZXMgY2FzZSBzZW5zaXRpdmUnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cGF0dGVybjogJ2FiQ2QnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFtdLFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0aXNTbWFydENhc2U6IHRydWVcblx0XHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydChxdWVyeS5jb250ZW50UGF0dGVybi5pc0Nhc2VTZW5zaXRpdmUpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc21hcnRDYXNlIGRldGVybWluZXMgbm90IGNhc2Ugc2Vuc2l0aXZlIChyZWdleCknLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0cGF0dGVybjogJ2FiXFxcXFNkJyxcblx0XHRcdFx0XHRpc1JlZ0V4cDogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlzU21hcnRDYXNlOiB0cnVlXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQoIXF1ZXJ5LmNvbnRlbnRQYXR0ZXJuLmlzQ2FzZVNlbnNpdGl2ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzbWFydENhc2UgZGV0ZXJtaW5lcyBjYXNlIHNlbnNpdGl2ZSAocmVnZXgpJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHBhdHRlcm46ICdhYltBLVpdZCcsXG5cdFx0XHRcdFx0aXNSZWdFeHA6IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdFx0W10sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpc1NtYXJ0Q2FzZTogdHJ1ZVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0KHF1ZXJ5LmNvbnRlbnRQYXR0ZXJuLmlzQ2FzZVNlbnNpdGl2ZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdmaWxlJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3NpbXBsZSBmaWxlIHF1ZXJ5JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgY2FjaGVLZXkgPSAnYXNkZic7XG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci5maWxlKFxuXHRcdFx0XHRbUk9PVF8xX05BTUVEX0ZPTERFUl0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjYWNoZUtleSxcblx0XHRcdFx0XHRzb3J0QnlTY29yZTogdHJ1ZVxuXHRcdFx0XHR9LFxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeS5jYWNoZUtleSwgY2FjaGVLZXkpO1xuXHRcdFx0YXNzZXJ0KHF1ZXJ5LnNvcnRCeVNjb3JlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ3BhdHRlcm4gcHJvY2Vzc2luZycsICgpID0+IHtcblx0XHR0ZXN0KCd0ZXh0IHF1ZXJ5IHdpdGggY29tbWEtc2VwYXJhdGVkIGluY2x1ZGVzIHdpdGggbm8gd29ya3NwYWNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0eyBwYXR0ZXJuOiBgYCB9LFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGluY2x1ZGVQYXR0ZXJuOiAnKi5qcywqLnRzJyxcblx0XHRcdFx0XHRleHBhbmRQYXR0ZXJuczogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBFcXVhbChxdWVyeS5pbmNsdWRlUGF0dGVybiwge1xuXHRcdFx0XHRcIioqLyouanMvKipcIjogdHJ1ZSxcblx0XHRcdFx0XCIqKi8qLmpzXCI6IHRydWUsXG5cdFx0XHRcdFwiKiovKi50cy8qKlwiOiB0cnVlLFxuXHRcdFx0XHRcIioqLyoudHNcIjogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoLCAwKTtcblx0XHR9KTtcblx0XHR0ZXN0KCd0ZXh0IHF1ZXJ5IHdpdGggY29tbWEtc2VwYXJhdGVkIGluY2x1ZGVzIHdpdGggd29ya3NwYWNlJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgcXVlcnkgPSBxdWVyeUJ1aWxkZXIudGV4dChcblx0XHRcdFx0eyBwYXR0ZXJuOiBgYCB9LFxuXHRcdFx0XHRbUk9PVF8xX1VSSV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRpbmNsdWRlUGF0dGVybjogJyouanMsKi50cycsXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwocXVlcnkuaW5jbHVkZVBhdHRlcm4sIHtcblx0XHRcdFx0XCIqKi8qLmpzLyoqXCI6IHRydWUsXG5cdFx0XHRcdFwiKiovKi5qc1wiOiB0cnVlLFxuXHRcdFx0XHRcIioqLyoudHMvKipcIjogdHJ1ZSxcblx0XHRcdFx0XCIqKi8qLnRzXCI6IHRydWUsXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeS5mb2xkZXJRdWVyaWVzLmxlbmd0aCwgMSk7XG5cdFx0fSk7XG5cdFx0dGVzdCgndGV4dCBxdWVyeSB3aXRoIGNvbW1hLXNlcGFyYXRlZCBleGNsdWRlcyBnbG9iYWxseScsICgpID0+IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gcXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdHsgcGF0dGVybjogYGAgfSxcblx0XHRcdFx0W10sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3sgcGF0dGVybjogJyouanMsKi50cycgfV0sXG5cdFx0XHRcdFx0ZXhwYW5kUGF0dGVybnM6IHRydWVcblx0XHRcdFx0fVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5kZWVwRXF1YWwocXVlcnkuZXhjbHVkZVBhdHRlcm4sIHtcblx0XHRcdFx0XCIqKi8qLmpzLyoqXCI6IHRydWUsXG5cdFx0XHRcdFwiKiovKi5qc1wiOiB0cnVlLFxuXHRcdFx0XHRcIioqLyoudHMvKipcIjogdHJ1ZSxcblx0XHRcdFx0XCIqKi8qLnRzXCI6IHRydWUsXG5cdFx0XHR9KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeS5mb2xkZXJRdWVyaWVzLmxlbmd0aCwgMCk7XG5cdFx0fSk7XG5cdFx0dGVzdCgndGV4dCBxdWVyeSB3aXRoIGNvbW1hLXNlcGFyYXRlZCBleGNsdWRlcyBnbG9iYWxseSBpbiBhIHdvcmtzcGFjZScsICgpID0+IHtcblx0XHRcdGNvbnN0IHF1ZXJ5ID0gcXVlcnlCdWlsZGVyLnRleHQoXG5cdFx0XHRcdHsgcGF0dGVybjogYGAgfSxcblx0XHRcdFx0W1JPT1RfMV9OQU1FRF9GT0xERVIudXJpXSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBbeyBwYXR0ZXJuOiAnKi5qcywqLnRzJyB9XSxcblx0XHRcdFx0XHRleHBhbmRQYXR0ZXJuczogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBFcXVhbChxdWVyeS5leGNsdWRlUGF0dGVybiwge1xuXHRcdFx0XHRcIioqLyouanMvKipcIjogdHJ1ZSxcblx0XHRcdFx0XCIqKi8qLmpzXCI6IHRydWUsXG5cdFx0XHRcdFwiKiovKi50cy8qKlwiOiB0cnVlLFxuXHRcdFx0XHRcIioqLyoudHNcIjogdHJ1ZSxcblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoLCAxKTtcblx0XHR9KTtcblx0XHR0ZXN0LnNraXAoJ3RleHQgcXVlcnkgd2l0aCBtdWx0aXBsZSBjb21tYS1zZXBhcmF0ZWQgZXhjbHVkZXMnLCAoKSA9PiB7XG5cdFx0XHQvLyBUT0RPOiBGaXguIFdpbGwgcmVxdWlyZSBgSUNvbW1vblF1ZXJ5UHJvcHMuZXhjbHVkZVBhdHRlcm5gIHRvIHN1cHBvcnQgYW4gYXJyYXkuXG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7IHBhdHRlcm46IGBgIH0sXG5cdFx0XHRcdFtST09UXzFfTkFNRURfRk9MREVSLnVyaV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3sgcGF0dGVybjogJyouanMsKi50cycgfSwgeyBwYXR0ZXJuOiAnZm9vLyosYmFyLyonIH1dLFxuXHRcdFx0XHRcdGV4cGFuZFBhdHRlcm5zOiB0cnVlXG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0XHRhc3NlcnQuZGVlcEVxdWFsKHF1ZXJ5LmV4Y2x1ZGVQYXR0ZXJuLCBbXG5cdFx0XHRcdHtcblxuXHRcdFx0XHRcdFwiKiovKi5qcy8qKlwiOiB0cnVlLFxuXHRcdFx0XHRcdFwiKiovKi5qc1wiOiB0cnVlLFxuXHRcdFx0XHRcdFwiKiovKi50cy8qKlwiOiB0cnVlLFxuXHRcdFx0XHRcdFwiKiovKi50c1wiOiB0cnVlLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0XCIqKi9mb28vKi8qKlwiOiB0cnVlLFxuXHRcdFx0XHRcdFwiKiovZm9vLypcIjogdHJ1ZSxcblx0XHRcdFx0XHRcIioqL2Jhci8qLyoqXCI6IHRydWUsXG5cdFx0XHRcdFx0XCIqKi9iYXIvKlwiOiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHRdKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChxdWVyeS5mb2xkZXJRdWVyaWVzLmxlbmd0aCwgMSk7XG5cdFx0fSk7XG5cdFx0dGVzdC5za2lwKCd0ZXh0IHF1ZXJ5IHdpdGggYmFzZSBVUkkgb24gZXhjbHVkJywgKCkgPT4ge1xuXHRcdFx0Ly8gVE9ETzogRml4LiBXaWxsIHJlcXVpcmUgYElDb21tb25RdWVyeVByb3BzLmV4Y2x1ZGVQYXR0ZXJuYCB0byBzdXBwb3J0IGFuIGJhc2VVUkkuXG5cdFx0XHRjb25zdCBxdWVyeSA9IHF1ZXJ5QnVpbGRlci50ZXh0KFxuXHRcdFx0XHR7IHBhdHRlcm46IGBgIH0sXG5cdFx0XHRcdFtST09UXzFfTkFNRURfRk9MREVSLnVyaV0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRleGNsdWRlUGF0dGVybjogW3sgdXJpOiBST09UXzFfVVJJLCBwYXR0ZXJuOiAnKi5qcywqLnRzJyB9XSxcblx0XHRcdFx0XHRleHBhbmRQYXR0ZXJuczogdHJ1ZVxuXHRcdFx0XHR9XG5cdFx0XHQpO1xuXHRcdFx0Ly8gdG9kbzogaW5jb3Jwb3JhdGUgdGhlIGJhc2UgVVJJIGludG8gdGhlIHBhdHRlcm5cblx0XHRcdGFzc2VydC5kZWVwRXF1YWwocXVlcnkuZXhjbHVkZVBhdHRlcm4sIHtcblx0XHRcdFx0dXJpOiBST09UXzFfVVJJLFxuXHRcdFx0XHRwYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XCIqKi8qLmpzLyoqXCI6IHRydWUsXG5cdFx0XHRcdFx0XCIqKi8qLmpzXCI6IHRydWUsXG5cdFx0XHRcdFx0XCIqKi8qLnRzLyoqXCI6IHRydWUsXG5cdFx0XHRcdFx0XCIqKi8qLnRzXCI6IHRydWUsXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHF1ZXJ5LmZvbGRlclF1ZXJpZXMubGVuZ3RoLCAxKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbmZ1bmN0aW9uIG1ha2VFeGNsdWRlUGF0dGVybkZyb21QYXR0ZXJucyguLi5wYXR0ZXJuczogc3RyaW5nW10pOiB7XG5cdHBhdHRlcm46IElFeHByZXNzaW9uO1xufVtdIHwgdW5kZWZpbmVkIHtcblx0Y29uc3QgcGF0dGVybiA9IHBhdHRlcm5zVG9JRXhwcmVzc2lvbiguLi5wYXR0ZXJucyk7XG5cdHJldHVybiBwYXR0ZXJuID8gW3sgcGF0dGVybiB9XSA6IHVuZGVmaW5lZDtcbn1cblxuZnVuY3Rpb24gYXNzZXJ0RXF1YWxUZXh0UXVlcmllcyhhY3R1YWw6IElUZXh0UXVlcnksIGV4cGVjdGVkOiBJVGV4dFF1ZXJ5KTogdm9pZCB7XG5cdGV4cGVjdGVkID0ge1xuXHRcdC4uLkRFRkFVTFRfVEVYVF9RVUVSWV9QUk9QUyxcblx0XHQuLi5leHBlY3RlZFxuXHR9O1xuXG5cdHJldHVybiBhc3NlcnRFcXVhbFF1ZXJpZXMoYWN0dWFsLCBleHBlY3RlZCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhc3NlcnRFcXVhbFF1ZXJpZXMoYWN0dWFsOiBJVGV4dFF1ZXJ5IHwgSUZpbGVRdWVyeSwgZXhwZWN0ZWQ6IElUZXh0UXVlcnkgfCBJRmlsZVF1ZXJ5KTogdm9pZCB7XG5cdGV4cGVjdGVkID0ge1xuXHRcdC4uLkRFRkFVTFRfUVVFUllfUFJPUFMsXG5cdFx0Li4uZXhwZWN0ZWRcblx0fTtcblxuXHRjb25zdCBmb2xkZXJRdWVyeVRvQ29tcGFyZU9iamVjdCA9IChmcTogSUZvbGRlclF1ZXJ5KSA9PiB7XG5cdFx0Y29uc3QgZXhjbHVkZVBhdHRlcm4gPSBmcS5leGNsdWRlUGF0dGVybj8ubWFwKGUgPT4gbm9ybWFsaXplRXhwcmVzc2lvbihlLnBhdHRlcm4pKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cGF0aDogZnEuZm9sZGVyLmZzUGF0aCxcblx0XHRcdGV4Y2x1ZGVQYXR0ZXJuOiBleGNsdWRlUGF0dGVybj8ubGVuZ3RoID8gZXhjbHVkZVBhdHRlcm4gOiB1bmRlZmluZWQsXG5cdFx0XHRpbmNsdWRlUGF0dGVybjogbm9ybWFsaXplRXhwcmVzc2lvbihmcS5pbmNsdWRlUGF0dGVybiksXG5cdFx0XHRmaWxlRW5jb2Rpbmc6IGZxLmZpbGVFbmNvZGluZ1xuXHRcdH07XG5cdH07XG5cblx0Ly8gQXZvaWQgY29tcGFyaW5nIFVSSSBvYmplY3RzLCBub3QgYSBnb29kIGlkZWFcblx0aWYgKGV4cGVjdGVkLmZvbGRlclF1ZXJpZXMpIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbC5mb2xkZXJRdWVyaWVzLm1hcChmb2xkZXJRdWVyeVRvQ29tcGFyZU9iamVjdCksIGV4cGVjdGVkLmZvbGRlclF1ZXJpZXMubWFwKGZvbGRlclF1ZXJ5VG9Db21wYXJlT2JqZWN0KSk7XG5cdFx0YWN0dWFsLmZvbGRlclF1ZXJpZXMgPSBbXTtcblx0XHRleHBlY3RlZC5mb2xkZXJRdWVyaWVzID0gW107XG5cdH1cblxuXHRpZiAoZXhwZWN0ZWQuZXh0cmFGaWxlUmVzb3VyY2VzKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwuZXh0cmFGaWxlUmVzb3VyY2VzIS5tYXAoZXh0cmFGaWxlID0+IGV4dHJhRmlsZS5mc1BhdGgpLCBleHBlY3RlZC5leHRyYUZpbGVSZXNvdXJjZXMubWFwKGV4dHJhRmlsZSA9PiBleHRyYUZpbGUuZnNQYXRoKSk7XG5cdFx0ZGVsZXRlIGV4cGVjdGVkLmV4dHJhRmlsZVJlc291cmNlcztcblx0XHRkZWxldGUgYWN0dWFsLmV4dHJhRmlsZVJlc291cmNlcztcblx0fVxuXG5cdGRlbGV0ZSBhY3R1YWwudXNpbmdTZWFyY2hQYXRocztcblx0YWN0dWFsLmluY2x1ZGVQYXR0ZXJuID0gbm9ybWFsaXplRXhwcmVzc2lvbihhY3R1YWwuaW5jbHVkZVBhdHRlcm4pO1xuXHRhY3R1YWwuZXhjbHVkZVBhdHRlcm4gPSBub3JtYWxpemVFeHByZXNzaW9uKGFjdHVhbC5leGNsdWRlUGF0dGVybik7XG5cdGNsZWFuVW5kZWZpbmVkUXVlcnlWYWx1ZXMoYWN0dWFsKTtcblxuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXNzZXJ0RXF1YWxTZWFyY2hQYXRoUmVzdWx0cyhhY3R1YWw6IElTZWFyY2hQYXRoc0luZm8sIGV4cGVjdGVkOiBJU2VhcmNoUGF0aHNJbmZvLCBtZXNzYWdlPzogc3RyaW5nKTogdm9pZCB7XG5cdGNsZWFuVW5kZWZpbmVkUXVlcnlWYWx1ZXMoYWN0dWFsKTtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh7IC4uLmFjdHVhbC5wYXR0ZXJuIH0sIHsgLi4uZXhwZWN0ZWQucGF0dGVybiB9LCBtZXNzYWdlKTtcblxuXHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLnNlYXJjaFBhdGhzICYmIGFjdHVhbC5zZWFyY2hQYXRocy5sZW5ndGgsIGV4cGVjdGVkLnNlYXJjaFBhdGhzICYmIGV4cGVjdGVkLnNlYXJjaFBhdGhzLmxlbmd0aCk7XG5cdGlmIChhY3R1YWwuc2VhcmNoUGF0aHMpIHtcblx0XHRhY3R1YWwuc2VhcmNoUGF0aHMuZm9yRWFjaCgoc2VhcmNoUGF0aCwgaSkgPT4ge1xuXHRcdFx0Y29uc3QgZXhwZWN0ZWRTZWFyY2hQYXRoID0gZXhwZWN0ZWQuc2VhcmNoUGF0aHMhW2ldO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZWFyY2hQYXRoLnBhdHRlcm4gJiYgeyAuLi5zZWFyY2hQYXRoLnBhdHRlcm4gfSwgZXhwZWN0ZWRTZWFyY2hQYXRoLnBhdHRlcm4pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlYXJjaFBhdGguc2VhcmNoUGF0aC50b1N0cmluZygpLCBleHBlY3RlZFNlYXJjaFBhdGguc2VhcmNoUGF0aC50b1N0cmluZygpKTtcblx0XHR9KTtcblx0fVxufVxuXG4vKipcbiAqIFJlY3Vyc2l2ZWx5IGRlbGV0ZSBhbGwgdW5kZWZpbmVkIHByb3BlcnR5IHZhbHVlcyBmcm9tIHRoZSBzZWFyY2ggcXVlcnksIHRvIG1ha2UgaXQgZWFzaWVyIHRvXG4gKiBhc3NlcnQuZGVlcFN0cmljdEVxdWFsIHdpdGggc29tZSBleHBlY3RlZCBvYmplY3QuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjbGVhblVuZGVmaW5lZFF1ZXJ5VmFsdWVzKHE6IGFueSk6IHZvaWQge1xuXHRmb3IgKGNvbnN0IGtleSBpbiBxKSB7XG5cdFx0aWYgKHFba2V5XSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRkZWxldGUgcVtrZXldO1xuXHRcdH0gZWxzZSBpZiAodHlwZW9mIHFba2V5XSA9PT0gJ29iamVjdCcpIHtcblx0XHRcdGNsZWFuVW5kZWZpbmVkUXVlcnlWYWx1ZXMocVtrZXldKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdsb2JhbEdsb2IocGF0dGVybjogc3RyaW5nKTogc3RyaW5nW10ge1xuXHRyZXR1cm4gW1xuXHRcdGAqKi8ke3BhdHRlcm59LyoqYCxcblx0XHRgKiovJHtwYXR0ZXJufWBcblx0XTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHBhdHRlcm5zVG9JRXhwcmVzc2lvbiguLi5wYXR0ZXJuczogc3RyaW5nW10pOiBJRXhwcmVzc2lvbiB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBwYXR0ZXJucy5sZW5ndGggP1xuXHRcdHBhdHRlcm5zLnJlZHVjZSgoZ2xvYiwgY3VyKSA9PiB7IGdsb2JbY3VyXSA9IHRydWU7IHJldHVybiBnbG9iOyB9LCB7fSBhcyBJRXhwcmVzc2lvbikgOlxuXHRcdHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldFVyaSguLi5zbGFzaFBhdGhQYXJ0czogc3RyaW5nW10pOiB1cmkge1xuXHRyZXR1cm4gdXJpLmZpbGUoZml4UGF0aCguLi5zbGFzaFBhdGhQYXJ0cykpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZml4UGF0aCguLi5zbGFzaFBhdGhQYXJ0czogc3RyaW5nW10pOiBzdHJpbmcge1xuXHRpZiAoaXNXaW5kb3dzICYmIHNsYXNoUGF0aFBhcnRzLmxlbmd0aCAmJiAhc2xhc2hQYXRoUGFydHNbMF0ubWF0Y2goL15jOi9pKSkge1xuXHRcdHNsYXNoUGF0aFBhcnRzLnVuc2hpZnQoJ2M6Jyk7XG5cdH1cblxuXHRyZXR1cm4gam9pbiguLi5zbGFzaFBhdGhQYXJ0cyk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBub3JtYWxpemVFeHByZXNzaW9uKGV4cHJlc3Npb246IElFeHByZXNzaW9uIHwgdW5kZWZpbmVkKTogSUV4cHJlc3Npb24gfCB1bmRlZmluZWQge1xuXHRpZiAoIWV4cHJlc3Npb24pIHtcblx0XHRyZXR1cm4gZXhwcmVzc2lvbjtcblx0fVxuXG5cdGNvbnN0IG5vcm1hbGl6ZWQ6IElFeHByZXNzaW9uID0ge307XG5cdE9iamVjdC5rZXlzKGV4cHJlc3Npb24pLmZvckVhY2goa2V5ID0+IHtcblx0XHRub3JtYWxpemVkW2tleS5yZXBsYWNlKC9cXFxcL2csICcvJyldID0gZXhwcmVzc2lvbltrZXldO1xuXHR9KTtcblxuXHRyZXR1cm4gbm9ybWFsaXplZDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUVuQixTQUFTLFlBQVk7QUFDckIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxLQUFLLE9BQU8sV0FBVztBQUNoQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLDBCQUEwQix5QkFBeUI7QUFDNUQsU0FBUywwQkFBMEI7QUFDbkMsU0FBMkIsb0JBQW9CO0FBQy9DLFNBQVMsb0JBQW9CO0FBQzdCLFNBQTZELGlCQUFpQjtBQUM5RSxTQUFTLGlCQUFpQiw4QkFBOEI7QUFDeEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQ0FBa0M7QUFDM0MsU0FBUywrQ0FBK0M7QUFFeEQsTUFBTSx3QkFBd0IsQ0FBQztBQUMvQixNQUFNLHNCQUFzQixFQUFFLFlBQVksTUFBTSxnQkFBZ0IsTUFBTSxzQkFBc0IsTUFBTSxzQkFBc0IsS0FBSztBQUM3SCxNQUFNLHNCQUFzQixDQUFDO0FBQzdCLE1BQU0sMkJBQTJCLEVBQUUsVUFBVSxNQUFNO0FBRW5ELE1BQU0sZ0JBQWdCLE1BQU07QUFDM0IsMENBQXdDO0FBQ3hDLFFBQU0sZUFBNkIsRUFBRSxTQUFTLElBQUk7QUFDbEQsUUFBTSxTQUFTLFFBQVEsWUFBWTtBQUNuQyxRQUFNLGFBQWEsT0FBTyxNQUFNO0FBQ2hDLFFBQU0sc0JBQXNCLGtCQUFrQixVQUFVO0FBQ3hELFFBQU0saUJBQWlCLE9BQU8sMEJBQTBCO0FBRXhELE1BQUk7QUFDSixNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFDSixNQUFJO0FBRUosUUFBTSxNQUFNO0FBQ1gsMkJBQXVCLElBQUkseUJBQXlCO0FBRXBELHdCQUFvQixJQUFJLHlCQUF5QjtBQUNqRCxzQkFBa0IscUJB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
