import assert from "assert";
import * as sinon from "sinon";
import * as arrays from "../../../../../base/common/arrays.js";
import { DeferredPromise, timeout } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { ModelService } from "../../../../../editor/common/services/modelService.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ISearchService, OneLineRange, QueryType, TextSearchMatch } from "../../../../services/search/common/search.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { SearchModelImpl } from "../../browser/searchTreeModel/searchModel.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { INotebookEditorService } from "../../../notebook/browser/services/notebookEditorService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { TestEditorGroupsService, TestEditorService } from "../../../../test/browser/workbenchTestServices.js";
import { NotebookEditorWidgetService } from "../../../notebook/browser/services/notebookEditorServiceImpl.js";
import { createFileUriFromPathFromRoot, getRootName } from "./searchTestCommon.js";
import { contentMatchesToTextSearchMatches, webviewMatchesToTextSearchMatches } from "../../browser/notebookSearch/searchNotebookHelpers.js";
import { CellKind } from "../../../notebook/common/notebookCommon.js";
import { FindMatch } from "../../../../../editor/common/model.js";
import { ResourceMap, ResourceSet } from "../../../../../base/common/map.js";
import { INotebookService } from "../../../notebook/common/notebookService.js";
import { INotebookSearchService } from "../../common/notebookSearch.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CellMatch, MatchInNotebook } from "../../browser/notebookSearch/notebookSearchModel.js";
const nullEvent = new class {
  constructor() {
    this.id = -1;
  }
  stop() {
    return;
  }
  timeTaken() {
    return -1;
  }
}();
const lineOneRange = new OneLineRange(1, 0, 1);
suite("SearchModel", () => {
  let instantiationService;
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  const testSearchStats = {
    fromCache: false,
    resultCount: 1,
    type: "searchProcess",
    detailStats: {
      fileWalkTime: 0,
      cmdTime: 0,
      cmdResultCount: 0,
      directoriesWalked: 2,
      filesWalked: 3
    }
  };
  const folderQueries = [
    { folder: createFileUriFromPathFromRoot() }
  ];
  setup(() => {
    instantiationService = new TestInstantiationService();
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(ILabelService, { getUriBasenameLabel: (uri) => "" });
    instantiationService.stub(INotebookService, { getNotebookTextModels: () => [] });
    instantiationService.stub(IModelService, stubModelService(instantiationService));
    instantiationService.stub(INotebookEditorService, stubNotebookEditorService(instantiationService));
    instantiationService.stub(ISearchService, {});
    instantiationService.stub(ISearchService, "textSearch", Promise.resolve({ results: [] }));
    const fileService = new FileService(new NullLogService());
    store.add(fileService);
    const uriIdentityService = new UriIdentityService(fileService);
    store.add(uriIdentityService);
    instantiationService.stub(IUriIdentityService, uriIdentityService);
    instantiationService.stub(ILogService, new NullLogService());
  });
  teardown(() => sinon.restore());
  function searchServiceWithResults(results, complete = null) {
    return {
      textSearch(query, token, onProgress, notebookURIs) {
        return new Promise((resolve) => {
          queueMicrotask(() => {
            results.forEach(onProgress);
            resolve(complete);
          });
        });
      },
      fileSearch(query, token) {
        return new Promise((resolve) => {
          queueMicrotask(() => {
            resolve({ results, messages: [] });
          });
        });
      },
      aiTextSearch(query, token, onProgress, notebookURIs) {
        return new Promise((resolve) => {
          queueMicrotask(() => {
            results.forEach(onProgress);
            resolve(complete);
          });
        });
      },
      textSearchSplitSyncAsync(query, token, onProgress) {
        return {
          syncResults: {
            results: [],
            messages: []
          },
          asyncResults: new Promise((resolve) => {
            queueMicrotask(() => {
              results.forEach(onProgress);
              resolve(complete);
            });
          })
        };
      }
    };
  }
  function searchServiceWithError(error) {
    return {
      textSearch(query, token, onProgress) {
        return new Promise((resolve, reject) => {
          reject(error);
        });
      },
      fileSearch(query, token) {
        return new Promise((resolve, reject) => {
          queueMicrotask(() => {
            reject(error);
          });
        });
      },
      aiTextSearch(query, token, onProgress, notebookURIs) {
        return new Promise((resolve, reject) => {
          reject(error);
        });
      },
      textSearchSplitSyncAsync(query, token, onProgress) {
        return {
          syncResults: {
            results: [],
            messages: []
          },
          asyncResults: new Promise((resolve, reject) => {
            reject(error);
          })
        };
      }
    };
  }
  function canceleableSearchService(tokenSource) {
    return {
      textSearch(query, token, onProgress) {
        const disposable = token?.onCancellationRequested(() => tokenSource.cancel());
        if (disposable) {
          store.add(disposable);
        }
        return this.textSearchSplitSyncAsync(query, token, onProgress).asyncResults;
      },
      fileSearch(query, token) {
        const disposable = token?.onCancellationRequested(() => tokenSource.cancel());
        if (disposable) {
          store.add(disposable);
        }
        return new Promise((resolve) => {
          queueMicrotask(() => {
            resolve({});
          });
        });
      },
      aiTextSearch(query, token, onProgress, notebookURIs) {
        const disposable = token?.onCancellationRequested(() => tokenSource.cancel());
        if (disposable) {
          store.add(disposable);
        }
        return Promise.resolve({
          results: [],
          messages: []
        });
      },
      textSearchSplitSyncAsync(query, token, onProgress) {
        const disposable = token?.onCancellationRequested(() => tokenSource.cancel());
        if (disposable) {
          store.add(disposable);
        }
        return {
          syncResults: {
            results: [],
            messages: []
          },
          asyncResults: new Promise((resolve) => {
            queueMicrotask(() => {
              resolve({
                results: [],
                messages: []
              });
            });
          })
        };
      }
    };
  }
  function searchServiceWithDeferredPromise(p) {
    return {
      textSearchSplitSyncAsync(query, token, onProgress) {
        return {
          syncResults: {
            results: [],
            messages: []
          },
          asyncResults: p
        };
      }
    };
  }
  function notebookSearchServiceWithInfo(results, tokenSource) {
    return {
      _serviceBrand: void 0,
      notebookSearch(query, token, searchInstanceID, onProgress) {
        const disposable = token?.onCancellationRequested(() => tokenSource?.cancel());
        if (disposable) {
          store.add(disposable);
        }
        const localResults = new ResourceMap((uri) => uri.path);
        results.forEach((r) => {
          localResults.set(r.resource, r);
        });
        if (onProgress) {
          arrays.coalesce([...localResults.values()]).forEach(onProgress);
        }
        return {
          openFilesToScan: new ResourceSet([...localResults.keys()]),
          completeData: Promise.resolve({
            messages: [],
            results: arrays.coalesce([...localResults.values()]),
            limitHit: false
          }),
          allScannedFiles: Promise.resolve(new ResourceSet())
        };
      }
    };
  }
  test("Search Model: Search adds to results", async () => {
    const results = [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4)),
        new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11))
      ),
      aRawMatch("/2", new TextSearchMatch("preview 2", lineOneRange))
    ];
    instantiationService.stub(ISearchService, searchServiceWithResults(results, { limitHit: false, messages: [], results }));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    await testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    const actual = testObject.searchResult.matches();
    assert.strictEqual(2, actual.length);
    assert.strictEqual(URI.file(`${getRootName()}/1`).toString(), actual[0].resource.toString());
    let actuaMatches = actual[0].matches();
    assert.strictEqual(2, actuaMatches.length);
    assert.strictEqual("preview 1", actuaMatches[0].text());
    assert.ok(new Range(2, 2, 2, 5).equalsRange(actuaMatches[0].range()));
    assert.strictEqual("preview 1", actuaMatches[1].text());
    assert.ok(new Range(2, 5, 2, 12).equalsRange(actuaMatches[1].range()));
    actuaMatches = actual[1].matches();
    assert.strictEqual(1, actuaMatches.length);
    assert.strictEqual("preview 2", actuaMatches[0].text());
    assert.ok(new Range(2, 1, 2, 2).equalsRange(actuaMatches[0].range()));
  });
  test("Search Model: Search can return notebook results", async () => {
    const results = [
      aRawMatch(
        "/2",
        new TextSearchMatch("test", new OneLineRange(1, 1, 5)),
        new TextSearchMatch("this is a test", new OneLineRange(1, 11, 15))
      ),
      aRawMatch("/3", new TextSearchMatch("test", lineOneRange))
    ];
    instantiationService.stub(ISearchService, searchServiceWithResults(results, { limitHit: false, messages: [], results }));
    sinon.stub(CellMatch.prototype, "addContext");
    const mdInputCell = {
      cellKind: CellKind.Markup,
      textBuffer: {
        getLineContent(lineNumber) {
          if (lineNumber === 1) {
            return "# Test";
          } else {
            return "";
          }
        }
      },
      id: "mdInputCell"
    };
    const findMatchMds = [new FindMatch(new Range(1, 3, 1, 7), ["Test"])];
    const codeCell = {
      cellKind: CellKind.Code,
      textBuffer: {
        getLineContent(lineNumber) {
          if (lineNumber === 1) {
            return 'print("test! testing!!")';
          } else {
            return "";
          }
        }
      },
      id: "codeCell"
    };
    const findMatchCodeCells = [
      new FindMatch(new Range(1, 8, 1, 12), ["test"]),
      new FindMatch(new Range(1, 14, 1, 18), ["test"])
    ];
    const webviewMatches = [
      {
        index: 0,
        searchPreviewInfo: {
          line: "test! testing!!",
          range: {
            start: 1,
            end: 5
          }
        }
      },
      {
        index: 1,
        searchPreviewInfo: {
          line: "test! testing!!",
          range: {
            start: 7,
            end: 11
          }
        }
      }
    ];
    const cellMatchMd = {
      cell: mdInputCell,
      index: 0,
      contentResults: contentMatchesToTextSearchMatches(findMatchMds, mdInputCell),
      webviewResults: []
    };
    const cellMatchCode = {
      cell: codeCell,
      index: 1,
      contentResults: contentMatchesToTextSearchMatches(findMatchCodeCells, codeCell),
      webviewResults: webviewMatchesToTextSearchMatches(webviewMatches)
    };
    const notebookSearchService = instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([aRawMatchWithCells("/1", cellMatchMd, cellMatchCode)], void 0));
    const notebookSearch = sinon.spy(notebookSearchService, "notebookSearch");
    const model = instantiationService.createInstance(SearchModelImpl);
    store.add(model);
    await model.search({ contentPattern: { pattern: "test" }, type: QueryType.Text, folderQueries }).asyncResults;
    const actual = model.searchResult.matches();
    assert(notebookSearch.calledOnce);
    assert.strictEqual(3, actual.length);
    assert.strictEqual(URI.file(`${getRootName()}/1`).toString(), actual[0].resource.toString());
    const notebookFileMatches = actual[0].matches();
    assert.ok(notebookFileMatches[0].range().equalsRange(new Range(1, 3, 1, 7)));
    assert.ok(notebookFileMatches[1].range().equalsRange(new Range(1, 8, 1, 12)));
    assert.ok(notebookFileMatches[2].range().equalsRange(new Range(1, 14, 1, 18)));
    assert.ok(notebookFileMatches[3].range().equalsRange(new Range(1, 2, 1, 6)));
    assert.ok(notebookFileMatches[4].range().equalsRange(new Range(1, 8, 1, 12)));
    notebookFileMatches.forEach((match) => match instanceof MatchInNotebook);
    assert(notebookFileMatches[0].cell?.id === "mdInputCell");
    assert(notebookFileMatches[1].cell?.id === "codeCell");
    assert(notebookFileMatches[2].cell?.id === "codeCell");
    assert(notebookFileMatches[3].cell?.id === "codeCell");
    assert(notebookFileMatches[4].cell?.id === "codeCell");
    const mdCellMatchProcessed = notebookFileMatches[0].cellParent;
    const codeCellMatchProcessed = notebookFileMatches[1].cellParent;
    assert(mdCellMatchProcessed.contentMatches.length === 1);
    assert(codeCellMatchProcessed.contentMatches.length === 2);
    assert(codeCellMatchProcessed.webviewMatches.length === 2);
    assert(mdCellMatchProcessed.contentMatches[0] === notebookFileMatches[0]);
    assert(codeCellMatchProcessed.contentMatches[0] === notebookFileMatches[1]);
    assert(codeCellMatchProcessed.contentMatches[1] === notebookFileMatches[2]);
    assert(codeCellMatchProcessed.webviewMatches[0] === notebookFileMatches[3]);
    assert(codeCellMatchProcessed.webviewMatches[1] === notebookFileMatches[4]);
    assert.strictEqual(URI.file(`${getRootName()}/2`).toString(), actual[1].resource.toString());
    assert.strictEqual(URI.file(`${getRootName()}/3`).toString(), actual[2].resource.toString());
  });
  test("Search Model: Search reports telemetry on search completed", async () => {
    const target = instantiationService.spy(ITelemetryService, "publicLog");
    const results = [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4)),
        new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11))
      ),
      aRawMatch(
        "/2",
        new TextSearchMatch("preview 2", lineOneRange)
      )
    ];
    instantiationService.stub(ISearchService, searchServiceWithResults(results, { limitHit: false, messages: [], results }));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    await testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    assert.ok(target.calledThrice);
    assert.ok(target.calledWith("searchResultsFirstRender"));
    assert.ok(target.calledWith("searchResultsFinished"));
  });
  test("Search Model: Search reports timed telemetry on search when progress is not called", () => {
    const target2 = sinon.spy();
    sinon.stub(nullEvent, "stop").callsFake(target2);
    const target1 = sinon.stub().returns(nullEvent);
    instantiationService.stub(ITelemetryService, "publicLog", target1);
    instantiationService.stub(ISearchService, searchServiceWithResults([], { limitHit: false, messages: [], results: [] }));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    const result = testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    return result.then(() => {
      return timeout(1).then(() => {
        assert.ok(target1.calledWith("searchResultsFirstRender"));
        assert.ok(target1.calledWith("searchResultsFinished"));
      });
    });
  });
  test("Search Model: Search reports timed telemetry on search when progress is called", () => {
    const target2 = sinon.spy();
    sinon.stub(nullEvent, "stop").callsFake(target2);
    const target1 = sinon.stub().returns(nullEvent);
    instantiationService.stub(ITelemetryService, "publicLog", target1);
    instantiationService.stub(ISearchService, searchServiceWithResults(
      [aRawMatch("/1", new TextSearchMatch("some preview", lineOneRange))],
      { results: [], stats: testSearchStats, messages: [] }
    ));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    const result = testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    return result.then(() => {
      return timeout(1).then(() => {
        assert.ok(target1.calledWith("searchResultsFirstRender"));
        assert.ok(target1.calledWith("searchResultsFinished"));
      });
    });
  });
  test("Search Model: Search reports timed telemetry on search when error is called", () => {
    const target2 = sinon.spy();
    sinon.stub(nullEvent, "stop").callsFake(target2);
    const target1 = sinon.stub().returns(nullEvent);
    instantiationService.stub(ITelemetryService, "publicLog", target1);
    instantiationService.stub(ISearchService, searchServiceWithError(new Error("This error should be thrown by this test.")));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    const result = testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    return result.then(() => {
    }, () => {
      return timeout(1).then(() => {
        assert.ok(target1.calledWith("searchResultsFirstRender"));
        assert.ok(target1.calledWith("searchResultsFinished"));
      });
    });
  });
  test("Search Model: Search reports timed telemetry on search when error is cancelled error", () => {
    const target2 = sinon.spy();
    sinon.stub(nullEvent, "stop").callsFake(target2);
    const target1 = sinon.stub().returns(nullEvent);
    instantiationService.stub(ITelemetryService, "publicLog", target1);
    const deferredPromise = new DeferredPromise();
    instantiationService.stub(ISearchService, searchServiceWithDeferredPromise(deferredPromise.p));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    const result = testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    deferredPromise.cancel();
    return result.then(() => {
    }, async () => {
      return timeout(1).then(() => {
        assert.ok(target1.calledWith("searchResultsFirstRender"));
        assert.ok(target1.calledWith("searchResultsFinished"));
      });
    });
  });
  test("Search Model: Search results are cleared during search", async () => {
    const results = [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4)),
        new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11))
      ),
      aRawMatch(
        "/2",
        new TextSearchMatch("preview 2", lineOneRange)
      )
    ];
    instantiationService.stub(ISearchService, searchServiceWithResults(results, { limitHit: false, messages: [], results: [] }));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    await testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries }).asyncResults;
    assert.ok(!testObject.searchResult.isEmpty());
    instantiationService.stub(ISearchService, searchServiceWithResults([]));
    testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries });
    assert.ok(testObject.searchResult.isEmpty());
  });
  test("Search Model: Previous search is cancelled when new search is called", async () => {
    const tokenSource = new CancellationTokenSource();
    store.add(tokenSource);
    instantiationService.stub(ISearchService, canceleableSearchService(tokenSource));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], tokenSource));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries });
    instantiationService.stub(ISearchService, searchServiceWithResults([]));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    testObject.search({ contentPattern: { pattern: "somestring" }, type: QueryType.Text, folderQueries });
    assert.ok(tokenSource.token.isCancellationRequested);
  });
  test("getReplaceString returns proper replace string for regExpressions", async () => {
    const results = [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4)),
        new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11))
      )
    ];
    instantiationService.stub(ISearchService, searchServiceWithResults(results, { limitHit: false, messages: [], results }));
    instantiationService.stub(INotebookSearchService, notebookSearchServiceWithInfo([], void 0));
    const testObject = instantiationService.createInstance(SearchModelImpl);
    store.add(testObject);
    await testObject.search({ contentPattern: { pattern: "re" }, type: QueryType.Text, folderQueries }).asyncResults;
    testObject.replaceString = "hello";
    let match = testObject.searchResult.matches()[0].matches()[0];
    assert.strictEqual("hello", match.replaceString);
    await testObject.search({ contentPattern: { pattern: "re", isRegExp: true }, type: QueryType.Text, folderQueries }).asyncResults;
    match = testObject.searchResult.matches()[0].matches()[0];
    assert.strictEqual("hello", match.replaceString);
    await testObject.search({ contentPattern: { pattern: "re(?:vi)", isRegExp: true }, type: QueryType.Text, folderQueries }).asyncResults;
    match = testObject.searchResult.matches()[0].matches()[0];
    assert.strictEqual("hello", match.replaceString);
    await testObject.search({ contentPattern: { pattern: "r(e)(?:vi)", isRegExp: true }, type: QueryType.Text, folderQueries }).asyncResults;
    match = testObject.searchResult.matches()[0].matches()[0];
    assert.strictEqual("hello", match.replaceString);
    await testObject.search({ contentPattern: { pattern: "r(e)(?:vi)", isRegExp: true }, type: QueryType.Text, folderQueries }).asyncResults;
    testObject.replaceString = "hello$1";
    match = testObject.searchResult.matches()[0].matches()[0];
    assert.strictEqual("helloe", match.replaceString);
  });
  function aRawMatch(resource, ...results) {
    return { resource: createFileUriFromPathFromRoot(resource), results };
  }
  function aRawMatchWithCells(resource, ...cells) {
    return { resource: createFileUriFromPathFromRoot(resource), cellResults: cells };
  }
  function stubModelService(instantiationService2) {
    instantiationService2.stub(IThemeService, new TestThemeService());
    const config = new TestConfigurationService();
    config.setUserConfiguration("search", { searchOnType: true });
    instantiationService2.stub(IConfigurationService, config);
    const modelService = instantiationService2.createInstance(ModelService);
    store.add(modelService);
    return modelService;
  }
  function stubNotebookEditorService(instantiationService2) {
    instantiationService2.stub(IEditorGroupsService, new TestEditorGroupsService());
    instantiationService2.stub(IContextKeyService, new MockContextKeyService());
    instantiationService2.stub(IEditorService, store.add(new TestEditorService()));
    const notebookEditorWidgetService = instantiationService2.createInstance(NotebookEditorWidgetService);
    store.add(notebookEditorWidgetService);
    return notebookEditorWidgetService;
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvdGVzdC9icm93c2VyL3NlYXJjaE1vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0ICogYXMgYXJyYXlzIGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUFJVGV4dFF1ZXJ5LCBJRmlsZU1hdGNoLCBJRmlsZVF1ZXJ5LCBJRmlsZVNlYXJjaFN0YXRzLCBJRm9sZGVyUXVlcnksIElTZWFyY2hDb21wbGV0ZSwgSVNlYXJjaFByb2dyZXNzSXRlbSwgSVNlYXJjaFF1ZXJ5LCBJU2VhcmNoU2VydmljZSwgSVRleHRRdWVyeSwgSVRleHRTZWFyY2hNYXRjaCwgT25lTGluZVJhbmdlLCBRdWVyeVR5cGUsIFRleHRTZWFyY2hNYXRjaCB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgTnVsbFRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeVV0aWxzLmpzJztcbmltcG9ydCB7IFNlYXJjaE1vZGVsSW1wbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL3NlYXJjaE1vZGVsLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS90ZXN0L2NvbW1vbi90ZXN0VGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTGFiZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yR3JvdXBzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yR3JvdXBzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0RWRpdG9yR3JvdXBzU2VydmljZSwgVGVzdEVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IE5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVGaWxlVXJpRnJvbVBhdGhGcm9tUm9vdCwgZ2V0Um9vdE5hbWUgfSBmcm9tICcuL3NlYXJjaFRlc3RDb21tb24uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbE1hdGNoV2l0aE1vZGVsLCBJTm90ZWJvb2tGaWxlTWF0Y2hXaXRoTW9kZWwsIGNvbnRlbnRNYXRjaGVzVG9UZXh0U2VhcmNoTWF0Y2hlcywgd2Vidmlld01hdGNoZXNUb1RleHRTZWFyY2hNYXRjaGVzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ub3RlYm9va1NlYXJjaC9zZWFyY2hOb3RlYm9va0hlbHBlcnMuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgSUNlbGxWaWV3TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL25vdGVib29rQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBGaW5kTWF0Y2gsIElSZWFkb25seVRleHRCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwLCBSZXNvdXJjZVNldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZWFyY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rU2VhcmNoLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDZWxsTWF0Y2gsIE1hdGNoSW5Ob3RlYm9vayB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tTZWFyY2gvbm90ZWJvb2tTZWFyY2hNb2RlbC5qcyc7XG5cbmNvbnN0IG51bGxFdmVudCA9IG5ldyBjbGFzcyB7XG5cdGlkOiBudW1iZXIgPSAtMTtcblx0dG9waWMhOiBzdHJpbmc7XG5cdG5hbWUhOiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uITogc3RyaW5nO1xuXHRkYXRhOiBhbnk7XG5cblx0c3RhcnRUaW1lITogRGF0ZTtcblx0c3RvcFRpbWUhOiBEYXRlO1xuXG5cdHN0b3AoKTogdm9pZCB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0dGltZVRha2VuKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIC0xO1xuXHR9XG59O1xuXG5jb25zdCBsaW5lT25lUmFuZ2UgPSBuZXcgT25lTGluZVJhbmdlKDEsIDAsIDEpO1xuXG5zdWl0ZSgnU2VhcmNoTW9kZWwnLCAoKSA9PiB7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Y29uc3QgdGVzdFNlYXJjaFN0YXRzOiBJRmlsZVNlYXJjaFN0YXRzID0ge1xuXHRcdGZyb21DYWNoZTogZmFsc2UsXG5cdFx0cmVzdWx0Q291bnQ6IDEsXG5cdFx0dHlwZTogJ3NlYXJjaFByb2Nlc3MnLFxuXHRcdGRldGFpbFN0YXRzOiB7XG5cdFx0XHRmaWxlV2Fsa1RpbWU6IDAsXG5cdFx0XHRjbWRUaW1lOiAwLFxuXHRcdFx0Y21kUmVzdWx0Q291bnQ6IDAsXG5cdFx0XHRkaXJlY3Rvcmllc1dhbGtlZDogMixcblx0XHRcdGZpbGVzV2Fsa2VkOiAzXG5cdFx0fVxuXHR9O1xuXG5cdGNvbnN0IGZvbGRlclF1ZXJpZXM6IElGb2xkZXJRdWVyeVtdID0gW1xuXHRcdHsgZm9sZGVyOiBjcmVhdGVGaWxlVXJpRnJvbVBhdGhGcm9tUm9vdCgpIH1cblx0XTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxhYmVsU2VydmljZSwgeyBnZXRVcmlCYXNlbmFtZUxhYmVsOiAodXJpOiBVUkkpID0+ICcnIH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rU2VydmljZSwgeyBnZXROb3RlYm9va1RleHRNb2RlbHM6ICgpID0+IFtdIH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU1vZGVsU2VydmljZSwgc3R1Yk1vZGVsU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rRWRpdG9yU2VydmljZSwgc3R1Yk5vdGVib29rRWRpdG9yU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHt9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTZWFyY2hTZXJ2aWNlLCAndGV4dFNlYXJjaCcsIFByb21pc2UucmVzb2x2ZSh7IHJlc3VsdHM6IFtdIH0pKTtcblx0XHRjb25zdCBmaWxlU2VydmljZSA9IG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSk7XG5cdFx0c3RvcmUuYWRkKGZpbGVTZXJ2aWNlKTtcblx0XHRjb25zdCB1cmlJZGVudGl0eVNlcnZpY2UgPSBuZXcgVXJpSWRlbnRpdHlTZXJ2aWNlKGZpbGVTZXJ2aWNlKTtcblx0XHRzdG9yZS5hZGQodXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElVcmlJZGVudGl0eVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiBzaW5vbi5yZXN0b3JlKCkpO1xuXG5cdGZ1bmN0aW9uIHNlYXJjaFNlcnZpY2VXaXRoUmVzdWx0cyhyZXN1bHRzOiBJRmlsZU1hdGNoW10sIGNvbXBsZXRlOiBJU2VhcmNoQ29tcGxldGUgfCBudWxsID0gbnVsbCk6IElTZWFyY2hTZXJ2aWNlIHtcblx0XHRyZXR1cm4gPElTZWFyY2hTZXJ2aWNlPntcblx0XHRcdHRleHRTZWFyY2gocXVlcnk6IElTZWFyY2hRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiwgb25Qcm9ncmVzcz86IChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQsIG5vdGVib29rVVJJcz86IFJlc291cmNlU2V0KTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHJlc3VsdHMuZm9yRWFjaChvblByb2dyZXNzISk7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKGNvbXBsZXRlISk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UocmVzb2x2ZSA9PiB7XG5cdFx0XHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh7IHJlc3VsdHM6IHJlc3VsdHMsIG1lc3NhZ2VzOiBbXSB9KTtcblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHR9KTtcblx0XHRcdH0sXG5cdFx0XHRhaVRleHRTZWFyY2gocXVlcnk6IElTZWFyY2hRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiwgb25Qcm9ncmVzcz86IChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQsIG5vdGVib29rVVJJcz86IFJlc291cmNlU2V0KTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHJlc3VsdHMuZm9yRWFjaChvblByb2dyZXNzISk7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKGNvbXBsZXRlISk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdHRleHRTZWFyY2hTcGxpdFN5bmNBc3luYyhxdWVyeTogSVRleHRRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiB8IHVuZGVmaW5lZCwgb25Qcm9ncmVzcz86ICgocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCk6IHsgc3luY1Jlc3VsdHM6IElTZWFyY2hDb21wbGV0ZTsgYXN5bmNSZXN1bHRzOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4gfSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3luY1Jlc3VsdHM6IHtcblx0XHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhc3luY1Jlc3VsdHM6IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXN1bHRzLmZvckVhY2gob25Qcm9ncmVzcyEpO1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKGNvbXBsZXRlISk7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9KVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRmdW5jdGlvbiBzZWFyY2hTZXJ2aWNlV2l0aEVycm9yKGVycm9yOiBFcnJvcik6IElTZWFyY2hTZXJ2aWNlIHtcblx0XHRyZXR1cm4gPElTZWFyY2hTZXJ2aWNlPntcblx0XHRcdHRleHRTZWFyY2gocXVlcnk6IElTZWFyY2hRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiwgb25Qcm9ncmVzcz86IChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGFpVGV4dFNlYXJjaChxdWVyeTogSVNlYXJjaFF1ZXJ5LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuLCBvblByb2dyZXNzPzogKHJlc3VsdDogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCwgbm90ZWJvb2tVUklzPzogUmVzb3VyY2VTZXQpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdHRleHRTZWFyY2hTcGxpdFN5bmNBc3luYyhxdWVyeTogSVRleHRRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiB8IHVuZGVmaW5lZCwgb25Qcm9ncmVzcz86ICgocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCk6IHsgc3luY1Jlc3VsdHM6IElTZWFyY2hDb21wbGV0ZTsgYXN5bmNSZXN1bHRzOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4gfSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3luY1Jlc3VsdHM6IHtcblx0XHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhc3luY1Jlc3VsdHM6IG5ldyBQcm9taXNlKChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0XHRcdHJlamVjdChlcnJvcik7XG5cdFx0XHRcdFx0fSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gY2FuY2VsZWFibGVTZWFyY2hTZXJ2aWNlKHRva2VuU291cmNlOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSk6IElTZWFyY2hTZXJ2aWNlIHtcblx0XHRyZXR1cm4gPElTZWFyY2hTZXJ2aWNlPntcblx0XHRcdHRleHRTZWFyY2gocXVlcnk6IElUZXh0UXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4sIG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKTogUHJvbWlzZTxJU2VhcmNoQ29tcGxldGU+IHtcblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRva2VuPy5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB0b2tlblNvdXJjZS5jYW5jZWwoKSk7XG5cdFx0XHRcdGlmIChkaXNwb3NhYmxlKSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMudGV4dFNlYXJjaFNwbGl0U3luY0FzeW5jKHF1ZXJ5LCB0b2tlbiwgb25Qcm9ncmVzcykuYXN5bmNSZXN1bHRzO1xuXHRcdFx0fSxcblx0XHRcdGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9rZW4/Lm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHRva2VuU291cmNlLmNhbmNlbCgpKTtcblx0XHRcdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdFx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHJlc29sdmUoPGFueT57fSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSxcblx0XHRcdGFpVGV4dFNlYXJjaChxdWVyeTogSUFJVGV4dFF1ZXJ5LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuLCBvblByb2dyZXNzPzogKHJlc3VsdDogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCwgbm90ZWJvb2tVUklzPzogUmVzb3VyY2VTZXQpOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9rZW4/Lm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHRva2VuU291cmNlLmNhbmNlbCgpKTtcblx0XHRcdFx0aWYgKGRpc3Bvc2FibGUpIHtcblx0XHRcdFx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHtcblx0XHRcdFx0XHRyZXN1bHRzOiBbXSxcblx0XHRcdFx0XHRtZXNzYWdlczogW11cblx0XHRcdFx0fSk7XG5cdFx0XHR9LFxuXHRcdFx0dGV4dFNlYXJjaFNwbGl0U3luY0FzeW5jKHF1ZXJ5OiBJVGV4dFF1ZXJ5LCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuIHwgdW5kZWZpbmVkLCBvblByb2dyZXNzPzogKChyZXN1bHQ6IElTZWFyY2hQcm9ncmVzc0l0ZW0pID0+IHZvaWQpIHwgdW5kZWZpbmVkKTogeyBzeW5jUmVzdWx0czogSVNlYXJjaENvbXBsZXRlOyBhc3luY1Jlc3VsdHM6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPiB9IHtcblx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRva2VuPy5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB0b2tlblNvdXJjZS5jYW5jZWwoKSk7XG5cdFx0XHRcdGlmIChkaXNwb3NhYmxlKSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3luY1Jlc3VsdHM6IHtcblx0XHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhc3luY1Jlc3VsdHM6IG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdFx0cXVldWVNaWNyb3Rhc2soKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXNvbHZlKDxhbnk+e1xuXHRcdFx0XHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdFx0XHRcdG1lc3NhZ2VzOiBbXVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHNlYXJjaFNlcnZpY2VXaXRoRGVmZXJyZWRQcm9taXNlKHA6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPik6IElTZWFyY2hTZXJ2aWNlIHtcblx0XHRyZXR1cm4gPElTZWFyY2hTZXJ2aWNlPntcblx0XHRcdHRleHRTZWFyY2hTcGxpdFN5bmNBc3luYyhxdWVyeTogSVRleHRRdWVyeSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbiB8IHVuZGVmaW5lZCwgb25Qcm9ncmVzcz86ICgocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKSB8IHVuZGVmaW5lZCk6IHsgc3luY1Jlc3VsdHM6IElTZWFyY2hDb21wbGV0ZTsgYXN5bmNSZXN1bHRzOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4gfSB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3luY1Jlc3VsdHM6IHtcblx0XHRcdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRhc3luY1Jlc3VsdHM6IHAsXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cblx0ZnVuY3Rpb24gbm90ZWJvb2tTZWFyY2hTZXJ2aWNlV2l0aEluZm8ocmVzdWx0czogSU5vdGVib29rRmlsZU1hdGNoV2l0aE1vZGVsW10sIHRva2VuU291cmNlOiBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB8IHVuZGVmaW5lZCk6IElOb3RlYm9va1NlYXJjaFNlcnZpY2Uge1xuXHRcdHJldHVybiA8SU5vdGVib29rU2VhcmNoU2VydmljZT57XG5cdFx0XHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQsXG5cdFx0XHRub3RlYm9va1NlYXJjaChxdWVyeTogSVRleHRRdWVyeSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuIHwgdW5kZWZpbmVkLCBzZWFyY2hJbnN0YW5jZUlEOiBzdHJpbmcsIG9uUHJvZ3Jlc3M/OiAocmVzdWx0OiBJU2VhcmNoUHJvZ3Jlc3NJdGVtKSA9PiB2b2lkKToge1xuXHRcdFx0XHRvcGVuRmlsZXNUb1NjYW46IFJlc291cmNlU2V0O1xuXHRcdFx0XHRjb21wbGV0ZURhdGE6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPjtcblx0XHRcdFx0YWxsU2Nhbm5lZEZpbGVzOiBQcm9taXNlPFJlc291cmNlU2V0Pjtcblx0XHRcdH0ge1xuXHRcdFx0XHRjb25zdCBkaXNwb3NhYmxlID0gdG9rZW4/Lm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHRva2VuU291cmNlPy5jYW5jZWwoKSk7XG5cdFx0XHRcdGlmIChkaXNwb3NhYmxlKSB7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGxvY2FsUmVzdWx0cyA9IG5ldyBSZXNvdXJjZU1hcDxJTm90ZWJvb2tGaWxlTWF0Y2hXaXRoTW9kZWwgfCBudWxsPih1cmkgPT4gdXJpLnBhdGgpO1xuXG5cdFx0XHRcdHJlc3VsdHMuZm9yRWFjaChyID0+IHtcblx0XHRcdFx0XHRsb2NhbFJlc3VsdHMuc2V0KHIucmVzb3VyY2UsIHIpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAob25Qcm9ncmVzcykge1xuXHRcdFx0XHRcdGFycmF5cy5jb2FsZXNjZShbLi4ubG9jYWxSZXN1bHRzLnZhbHVlcygpXSkuZm9yRWFjaChvblByb2dyZXNzKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdG9wZW5GaWxlc1RvU2NhbjogbmV3IFJlc291cmNlU2V0KFsuLi5sb2NhbFJlc3VsdHMua2V5cygpXSksXG5cdFx0XHRcdFx0Y29tcGxldGVEYXRhOiBQcm9taXNlLnJlc29sdmUoe1xuXHRcdFx0XHRcdFx0bWVzc2FnZXM6IFtdLFxuXHRcdFx0XHRcdFx0cmVzdWx0czogYXJyYXlzLmNvYWxlc2NlKFsuLi5sb2NhbFJlc3VsdHMudmFsdWVzKCldKSxcblx0XHRcdFx0XHRcdGxpbWl0SGl0OiBmYWxzZVxuXHRcdFx0XHRcdH0pLFxuXHRcdFx0XHRcdGFsbFNjYW5uZWRGaWxlczogUHJvbWlzZS5yZXNvbHZlKG5ldyBSZXNvdXJjZVNldCgpKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG5cblx0dGVzdCgnU2VhcmNoIE1vZGVsOiBTZWFyY2ggYWRkcyB0byByZXN1bHRzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA0KSksXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNCwgMTEpKSksXG5cdFx0XHRhUmF3TWF0Y2goJy8yJywgbmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAyJywgbGluZU9uZVJhbmdlKSldO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHNlYXJjaFNlcnZpY2VXaXRoUmVzdWx0cyhyZXN1bHRzLCB7IGxpbWl0SGl0OiBmYWxzZSwgbWVzc2FnZXM6IFtdLCByZXN1bHRzIH0pKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFtdLCB1bmRlZmluZWQpKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3Q6IFNlYXJjaE1vZGVsSW1wbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHRlc3RPYmplY3Quc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgyLCBhY3R1YWwubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoVVJJLmZpbGUoYCR7Z2V0Um9vdE5hbWUoKX0vMWApLnRvU3RyaW5nKCksIGFjdHVhbFswXS5yZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdGxldCBhY3R1YU1hdGNoZXMgPSBhY3R1YWxbMF0ubWF0Y2hlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgyLCBhY3R1YU1hdGNoZXMubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ3ByZXZpZXcgMScsIGFjdHVhTWF0Y2hlc1swXS50ZXh0KCkpO1xuXHRcdGFzc2VydC5vayhuZXcgUmFuZ2UoMiwgMiwgMiwgNSkuZXF1YWxzUmFuZ2UoYWN0dWFNYXRjaGVzWzBdLnJhbmdlKCkpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ3ByZXZpZXcgMScsIGFjdHVhTWF0Y2hlc1sxXS50ZXh0KCkpO1xuXHRcdGFzc2VydC5vayhuZXcgUmFuZ2UoMiwgNSwgMiwgMTIpLmVxdWFsc1JhbmdlKGFjdHVhTWF0Y2hlc1sxXS5yYW5nZSgpKSk7XG5cblx0XHRhY3R1YU1hdGNoZXMgPSBhY3R1YWxbMV0ubWF0Y2hlcygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgxLCBhY3R1YU1hdGNoZXMubGVuZ3RoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ3ByZXZpZXcgMicsIGFjdHVhTWF0Y2hlc1swXS50ZXh0KCkpO1xuXHRcdGFzc2VydC5vayhuZXcgUmFuZ2UoMiwgMSwgMiwgMikuZXF1YWxzUmFuZ2UoYWN0dWFNYXRjaGVzWzBdLnJhbmdlKCkpKTtcblx0fSk7XG5cblxuXHR0ZXN0KCdTZWFyY2ggTW9kZWw6IFNlYXJjaCBjYW4gcmV0dXJuIG5vdGVib29rIHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgcmVzdWx0cyA9IFtcblx0XHRcdGFSYXdNYXRjaCgnLzInLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCd0ZXN0JywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA1KSksXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3RoaXMgaXMgYSB0ZXN0JywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxMSwgMTUpKSksXG5cdFx0XHRhUmF3TWF0Y2goJy8zJywgbmV3IFRleHRTZWFyY2hNYXRjaCgndGVzdCcsIGxpbmVPbmVSYW5nZSkpXTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTZWFyY2hTZXJ2aWNlLCBzZWFyY2hTZXJ2aWNlV2l0aFJlc3VsdHMocmVzdWx0cywgeyBsaW1pdEhpdDogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgcmVzdWx0cyB9KSk7XG5cdFx0c2lub24uc3R1YihDZWxsTWF0Y2gucHJvdG90eXBlLCAnYWRkQ29udGV4dCcpO1xuXG5cdFx0Y29uc3QgbWRJbnB1dENlbGwgPSB7XG5cdFx0XHRjZWxsS2luZDogQ2VsbEtpbmQuTWFya3VwLCB0ZXh0QnVmZmVyOiA8SVJlYWRvbmx5VGV4dEJ1ZmZlcj57XG5cdFx0XHRcdGdldExpbmVDb250ZW50KGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPT09IDEpIHtcblx0XHRcdFx0XHRcdHJldHVybiAnIyBUZXN0Jztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGlkOiAnbWRJbnB1dENlbGwnXG5cdFx0fSBhcyBJQ2VsbFZpZXdNb2RlbDtcblxuXHRcdGNvbnN0IGZpbmRNYXRjaE1kcyA9IFtuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgxLCAzLCAxLCA3KSwgWydUZXN0J10pXTtcblxuXHRcdGNvbnN0IGNvZGVDZWxsID0ge1xuXHRcdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLkNvZGUsIHRleHRCdWZmZXI6IDxJUmVhZG9ubHlUZXh0QnVmZmVyPntcblx0XHRcdFx0Z2V0TGluZUNvbnRlbnQobGluZU51bWJlcjogbnVtYmVyKTogc3RyaW5nIHtcblx0XHRcdFx0XHRpZiAobGluZU51bWJlciA9PT0gMSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuICdwcmludChcInRlc3QhIHRlc3RpbmchIVwiKSc7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRpZDogJ2NvZGVDZWxsJ1xuXHRcdH0gYXMgSUNlbGxWaWV3TW9kZWw7XG5cblx0XHRjb25zdCBmaW5kTWF0Y2hDb2RlQ2VsbHMgPVxuXHRcdFx0W25ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDgsIDEsIDEyKSwgWyd0ZXN0J10pLFxuXHRcdFx0bmV3IEZpbmRNYXRjaChuZXcgUmFuZ2UoMSwgMTQsIDEsIDE4KSwgWyd0ZXN0J10pLFxuXHRcdFx0XTtcblx0XHRjb25zdCB3ZWJ2aWV3TWF0Y2hlcyA9IFt7XG5cdFx0XHRpbmRleDogMCxcblx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiB7XG5cdFx0XHRcdGxpbmU6ICd0ZXN0ISB0ZXN0aW5nISEnLFxuXHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdHN0YXJ0OiAxLFxuXHRcdFx0XHRcdGVuZDogNVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpbmRleDogMSxcblx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiB7XG5cdFx0XHRcdGxpbmU6ICd0ZXN0ISB0ZXN0aW5nISEnLFxuXHRcdFx0XHRyYW5nZToge1xuXHRcdFx0XHRcdHN0YXJ0OiA3LFxuXHRcdFx0XHRcdGVuZDogMTFcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRdO1xuXHRcdGNvbnN0IGNlbGxNYXRjaE1kOiBJTm90ZWJvb2tDZWxsTWF0Y2hXaXRoTW9kZWwgPSB7XG5cdFx0XHRjZWxsOiBtZElucHV0Q2VsbCxcblx0XHRcdGluZGV4OiAwLFxuXHRcdFx0Y29udGVudFJlc3VsdHM6IGNvbnRlbnRNYXRjaGVzVG9UZXh0U2VhcmNoTWF0Y2hlcyhmaW5kTWF0Y2hNZHMsIG1kSW5wdXRDZWxsKSxcblx0XHRcdHdlYnZpZXdSZXN1bHRzOiBbXVxuXHRcdH07XG5cblx0XHRjb25zdCBjZWxsTWF0Y2hDb2RlOiBJTm90ZWJvb2tDZWxsTWF0Y2hXaXRoTW9kZWwgPSB7XG5cdFx0XHRjZWxsOiBjb2RlQ2VsbCxcblx0XHRcdGluZGV4OiAxLFxuXHRcdFx0Y29udGVudFJlc3VsdHM6IGNvbnRlbnRNYXRjaGVzVG9UZXh0U2VhcmNoTWF0Y2hlcyhmaW5kTWF0Y2hDb2RlQ2VsbHMsIGNvZGVDZWxsKSxcblx0XHRcdHdlYnZpZXdSZXN1bHRzOiB3ZWJ2aWV3TWF0Y2hlc1RvVGV4dFNlYXJjaE1hdGNoZXMod2Vidmlld01hdGNoZXMpLFxuXHRcdH07XG5cblx0XHRjb25zdCBub3RlYm9va1NlYXJjaFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFthUmF3TWF0Y2hXaXRoQ2VsbHMoJy8xJywgY2VsbE1hdGNoTWQsIGNlbGxNYXRjaENvZGUpXSwgdW5kZWZpbmVkKSk7XG5cdFx0Y29uc3Qgbm90ZWJvb2tTZWFyY2ggPSBzaW5vbi5zcHkobm90ZWJvb2tTZWFyY2hTZXJ2aWNlLCBcIm5vdGVib29rU2VhcmNoXCIpO1xuXHRcdGNvbnN0IG1vZGVsOiBTZWFyY2hNb2RlbEltcGwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpO1xuXHRcdHN0b3JlLmFkZChtb2RlbCk7XG5cdFx0YXdhaXQgbW9kZWwuc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3Rlc3QnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblx0XHRjb25zdCBhY3R1YWwgPSBtb2RlbC5zZWFyY2hSZXN1bHQubWF0Y2hlcygpO1xuXG5cdFx0YXNzZXJ0KG5vdGVib29rU2VhcmNoLmNhbGxlZE9uY2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDMsIGFjdHVhbC5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChVUkkuZmlsZShgJHtnZXRSb290TmFtZSgpfS8xYCkudG9TdHJpbmcoKSwgYWN0dWFsWzBdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IG5vdGVib29rRmlsZU1hdGNoZXMgPSBhY3R1YWxbMF0ubWF0Y2hlcygpO1xuXG5cdFx0YXNzZXJ0Lm9rKG5vdGVib29rRmlsZU1hdGNoZXNbMF0ucmFuZ2UoKS5lcXVhbHNSYW5nZShuZXcgUmFuZ2UoMSwgMywgMSwgNykpKTtcblx0XHRhc3NlcnQub2sobm90ZWJvb2tGaWxlTWF0Y2hlc1sxXS5yYW5nZSgpLmVxdWFsc1JhbmdlKG5ldyBSYW5nZSgxLCA4LCAxLCAxMikpKTtcblx0XHRhc3NlcnQub2sobm90ZWJvb2tGaWxlTWF0Y2hlc1syXS5yYW5nZSgpLmVxdWFsc1JhbmdlKG5ldyBSYW5nZSgxLCAxNCwgMSwgMTgpKSk7XG5cdFx0YXNzZXJ0Lm9rKG5vdGVib29rRmlsZU1hdGNoZXNbM10ucmFuZ2UoKS5lcXVhbHNSYW5nZShuZXcgUmFuZ2UoMSwgMiwgMSwgNikpKTtcblx0XHRhc3NlcnQub2sobm90ZWJvb2tGaWxlTWF0Y2hlc1s0XS5yYW5nZSgpLmVxdWFsc1JhbmdlKG5ldyBSYW5nZSgxLCA4LCAxLCAxMikpKTtcblxuXHRcdG5vdGVib29rRmlsZU1hdGNoZXMuZm9yRWFjaChtYXRjaCA9PiBtYXRjaCBpbnN0YW5jZW9mIE1hdGNoSW5Ob3RlYm9vayk7XG5cdFx0YXNzZXJ0KChub3RlYm9va0ZpbGVNYXRjaGVzWzBdIGFzIE1hdGNoSW5Ob3RlYm9vaykuY2VsbD8uaWQgPT09ICdtZElucHV0Q2VsbCcpO1xuXHRcdGFzc2VydCgobm90ZWJvb2tGaWxlTWF0Y2hlc1sxXSBhcyBNYXRjaEluTm90ZWJvb2spLmNlbGw/LmlkID09PSAnY29kZUNlbGwnKTtcblx0XHRhc3NlcnQoKG5vdGVib29rRmlsZU1hdGNoZXNbMl0gYXMgTWF0Y2hJbk5vdGVib29rKS5jZWxsPy5pZCA9PT0gJ2NvZGVDZWxsJyk7XG5cdFx0YXNzZXJ0KChub3RlYm9va0ZpbGVNYXRjaGVzWzNdIGFzIE1hdGNoSW5Ob3RlYm9vaykuY2VsbD8uaWQgPT09ICdjb2RlQ2VsbCcpO1xuXHRcdGFzc2VydCgobm90ZWJvb2tGaWxlTWF0Y2hlc1s0XSBhcyBNYXRjaEluTm90ZWJvb2spLmNlbGw/LmlkID09PSAnY29kZUNlbGwnKTtcblxuXHRcdGNvbnN0IG1kQ2VsbE1hdGNoUHJvY2Vzc2VkID0gKG5vdGVib29rRmlsZU1hdGNoZXNbMF0gYXMgTWF0Y2hJbk5vdGVib29rKS5jZWxsUGFyZW50O1xuXHRcdGNvbnN0IGNvZGVDZWxsTWF0Y2hQcm9jZXNzZWQgPSAobm90ZWJvb2tGaWxlTWF0Y2hlc1sxXSBhcyBNYXRjaEluTm90ZWJvb2spLmNlbGxQYXJlbnQ7XG5cblx0XHRhc3NlcnQobWRDZWxsTWF0Y2hQcm9jZXNzZWQuY29udGVudE1hdGNoZXMubGVuZ3RoID09PSAxKTtcblx0XHRhc3NlcnQoY29kZUNlbGxNYXRjaFByb2Nlc3NlZC5jb250ZW50TWF0Y2hlcy5sZW5ndGggPT09IDIpO1xuXHRcdGFzc2VydChjb2RlQ2VsbE1hdGNoUHJvY2Vzc2VkLndlYnZpZXdNYXRjaGVzLmxlbmd0aCA9PT0gMik7XG5cblx0XHRhc3NlcnQobWRDZWxsTWF0Y2hQcm9jZXNzZWQuY29udGVudE1hdGNoZXNbMF0gPT09IG5vdGVib29rRmlsZU1hdGNoZXNbMF0pO1xuXHRcdGFzc2VydChjb2RlQ2VsbE1hdGNoUHJvY2Vzc2VkLmNvbnRlbnRNYXRjaGVzWzBdID09PSBub3RlYm9va0ZpbGVNYXRjaGVzWzFdKTtcblx0XHRhc3NlcnQoY29kZUNlbGxNYXRjaFByb2Nlc3NlZC5jb250ZW50TWF0Y2hlc1sxXSA9PT0gbm90ZWJvb2tGaWxlTWF0Y2hlc1syXSk7XG5cdFx0YXNzZXJ0KGNvZGVDZWxsTWF0Y2hQcm9jZXNzZWQud2Vidmlld01hdGNoZXNbMF0gPT09IG5vdGVib29rRmlsZU1hdGNoZXNbM10pO1xuXHRcdGFzc2VydChjb2RlQ2VsbE1hdGNoUHJvY2Vzc2VkLndlYnZpZXdNYXRjaGVzWzFdID09PSBub3RlYm9va0ZpbGVNYXRjaGVzWzRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChVUkkuZmlsZShgJHtnZXRSb290TmFtZSgpfS8yYCkudG9TdHJpbmcoKSwgYWN0dWFsWzFdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChVUkkuZmlsZShgJHtnZXRSb290TmFtZSgpfS8zYCkudG9TdHJpbmcoKSwgYWN0dWFsWzJdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZWFyY2ggTW9kZWw6IFNlYXJjaCByZXBvcnRzIHRlbGVtZXRyeSBvbiBzZWFyY2ggY29tcGxldGVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHRhcmdldCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLnNweShJVGVsZW1ldHJ5U2VydmljZSwgJ3B1YmxpY0xvZycpO1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA0KSksXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNCwgMTEpKSksXG5cdFx0XHRhUmF3TWF0Y2goJy8yJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAyJywgbGluZU9uZVJhbmdlKSldO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHNlYXJjaFNlcnZpY2VXaXRoUmVzdWx0cyhyZXN1bHRzLCB7IGxpbWl0SGl0OiBmYWxzZSwgbWVzc2FnZXM6IFtdLCByZXN1bHRzIH0pKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFtdLCB1bmRlZmluZWQpKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3Q6IFNlYXJjaE1vZGVsSW1wbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblxuXHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkVGhyaWNlKTtcblx0XHRhc3NlcnQub2sodGFyZ2V0LmNhbGxlZFdpdGgoJ3NlYXJjaFJlc3VsdHNGaXJzdFJlbmRlcicpKTtcblx0XHRhc3NlcnQub2sodGFyZ2V0LmNhbGxlZFdpdGgoJ3NlYXJjaFJlc3VsdHNGaW5pc2hlZCcpKTtcblx0fSk7XG5cblx0dGVzdCgnU2VhcmNoIE1vZGVsOiBTZWFyY2ggcmVwb3J0cyB0aW1lZCB0ZWxlbWV0cnkgb24gc2VhcmNoIHdoZW4gcHJvZ3Jlc3MgaXMgbm90IGNhbGxlZCcsICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQyID0gc2lub24uc3B5KCk7XG5cdFx0c2lub24uc3R1YihudWxsRXZlbnQsICdzdG9wJykuY2FsbHNGYWtlKHRhcmdldDIpO1xuXHRcdGNvbnN0IHRhcmdldDEgPSBzaW5vbi5zdHViKCkucmV0dXJucyhudWxsRXZlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsICdwdWJsaWNMb2cnLCB0YXJnZXQxKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHNlYXJjaFNlcnZpY2VXaXRoUmVzdWx0cyhbXSwgeyBsaW1pdEhpdDogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgcmVzdWx0czogW10gfSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rU2VhcmNoU2VydmljZSwgbm90ZWJvb2tTZWFyY2hTZXJ2aWNlV2l0aEluZm8oW10sIHVuZGVmaW5lZCkpO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblxuXHRcdHJldHVybiByZXN1bHQudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGltZW91dCgxKS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKHRhcmdldDEuY2FsbGVkV2l0aCgnc2VhcmNoUmVzdWx0c0ZpcnN0UmVuZGVyJykpO1xuXHRcdFx0XHRhc3NlcnQub2sodGFyZ2V0MS5jYWxsZWRXaXRoKCdzZWFyY2hSZXN1bHRzRmluaXNoZWQnKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnU2VhcmNoIE1vZGVsOiBTZWFyY2ggcmVwb3J0cyB0aW1lZCB0ZWxlbWV0cnkgb24gc2VhcmNoIHdoZW4gcHJvZ3Jlc3MgaXMgY2FsbGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRhcmdldDIgPSBzaW5vbi5zcHkoKTtcblx0XHRzaW5vbi5zdHViKG51bGxFdmVudCwgJ3N0b3AnKS5jYWxsc0Zha2UodGFyZ2V0Mik7XG5cdFx0Y29uc3QgdGFyZ2V0MSA9IHNpbm9uLnN0dWIoKS5yZXR1cm5zKG51bGxFdmVudCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgJ3B1YmxpY0xvZycsIHRhcmdldDEpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU2VhcmNoU2VydmljZSwgc2VhcmNoU2VydmljZVdpdGhSZXN1bHRzKFxuXHRcdFx0W2FSYXdNYXRjaCgnLzEnLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdzb21lIHByZXZpZXcnLCBsaW5lT25lUmFuZ2UpKV0sXG5cdFx0XHR7IHJlc3VsdHM6IFtdLCBzdGF0czogdGVzdFNlYXJjaFN0YXRzLCBtZXNzYWdlczogW10gfSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rU2VhcmNoU2VydmljZSwgbm90ZWJvb2tTZWFyY2hTZXJ2aWNlV2l0aEluZm8oW10sIHVuZGVmaW5lZCkpO1xuXG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGNvbnN0IHJlc3VsdCA9IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblxuXHRcdHJldHVybiByZXN1bHQudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGltZW91dCgxKS50aGVuKCgpID0+IHtcblx0XHRcdFx0Ly8gdGltZW91dCBiZWNhdXNlIHByb21pc2UgaGFuZGxlcnMgbWF5IHJ1biBpbiBhIGRpZmZlcmVudCBvcmRlci4gV2Ugb25seSBjYXJlIHRoYXQgdGhlc2Vcblx0XHRcdFx0Ly8gYXJlIGZpcmVkIGF0IHNvbWUgcG9pbnQuXG5cdFx0XHRcdGFzc2VydC5vayh0YXJnZXQxLmNhbGxlZFdpdGgoJ3NlYXJjaFJlc3VsdHNGaXJzdFJlbmRlcicpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHRhcmdldDEuY2FsbGVkV2l0aCgnc2VhcmNoUmVzdWx0c0ZpbmlzaGVkJykpO1xuXHRcdFx0XHQvLyBhc3NlcnQuc3RyaWN0RXF1YWwoMSwgdGFyZ2V0Mi5jYWxsQ291bnQpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlYXJjaCBNb2RlbDogU2VhcmNoIHJlcG9ydHMgdGltZWQgdGVsZW1ldHJ5IG9uIHNlYXJjaCB3aGVuIGVycm9yIGlzIGNhbGxlZCcsICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQyID0gc2lub24uc3B5KCk7XG5cdFx0c2lub24uc3R1YihudWxsRXZlbnQsICdzdG9wJykuY2FsbHNGYWtlKHRhcmdldDIpO1xuXHRcdGNvbnN0IHRhcmdldDEgPSBzaW5vbi5zdHViKCkucmV0dXJucyhudWxsRXZlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsICdwdWJsaWNMb2cnLCB0YXJnZXQxKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHNlYXJjaFNlcnZpY2VXaXRoRXJyb3IobmV3IEVycm9yKCdUaGlzIGVycm9yIHNob3VsZCBiZSB0aHJvd24gYnkgdGhpcyB0ZXN0LicpKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90ZWJvb2tTZWFyY2hTZXJ2aWNlLCBub3RlYm9va1NlYXJjaFNlcnZpY2VXaXRoSW5mbyhbXSwgdW5kZWZpbmVkKSk7XG5cblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoTW9kZWxJbXBsKTtcblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGVzdE9iamVjdC5zZWFyY2goeyBjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnc29tZXN0cmluZycgfSwgdHlwZTogUXVlcnlUeXBlLlRleHQsIGZvbGRlclF1ZXJpZXMgfSkuYXN5bmNSZXN1bHRzO1xuXG5cdFx0cmV0dXJuIHJlc3VsdC50aGVuKCgpID0+IHsgfSwgKCkgPT4ge1xuXHRcdFx0cmV0dXJuIHRpbWVvdXQoMSkudGhlbigoKSA9PiB7XG5cdFx0XHRcdGFzc2VydC5vayh0YXJnZXQxLmNhbGxlZFdpdGgoJ3NlYXJjaFJlc3VsdHNGaXJzdFJlbmRlcicpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKHRhcmdldDEuY2FsbGVkV2l0aCgnc2VhcmNoUmVzdWx0c0ZpbmlzaGVkJykpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlYXJjaCBNb2RlbDogU2VhcmNoIHJlcG9ydHMgdGltZWQgdGVsZW1ldHJ5IG9uIHNlYXJjaCB3aGVuIGVycm9yIGlzIGNhbmNlbGxlZCBlcnJvcicsICgpID0+IHtcblx0XHRjb25zdCB0YXJnZXQyID0gc2lub24uc3B5KCk7XG5cdFx0c2lub24uc3R1YihudWxsRXZlbnQsICdzdG9wJykuY2FsbHNGYWtlKHRhcmdldDIpO1xuXHRcdGNvbnN0IHRhcmdldDEgPSBzaW5vbi5zdHViKCkucmV0dXJucyhudWxsRXZlbnQpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRlbGVtZXRyeVNlcnZpY2UsICdwdWJsaWNMb2cnLCB0YXJnZXQxKTtcblxuXHRcdGNvbnN0IGRlZmVycmVkUHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8SVNlYXJjaENvbXBsZXRlPigpO1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU2VhcmNoU2VydmljZSwgc2VhcmNoU2VydmljZVdpdGhEZWZlcnJlZFByb21pc2UoZGVmZXJyZWRQcm9taXNlLnApKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFtdLCB1bmRlZmluZWQpKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpO1xuXHRcdHN0b3JlLmFkZCh0ZXN0T2JqZWN0KTtcblx0XHRjb25zdCByZXN1bHQgPSB0ZXN0T2JqZWN0LnNlYXJjaCh7IGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdzb21lc3RyaW5nJyB9LCB0eXBlOiBRdWVyeVR5cGUuVGV4dCwgZm9sZGVyUXVlcmllcyB9KS5hc3luY1Jlc3VsdHM7XG5cblx0XHRkZWZlcnJlZFByb21pc2UuY2FuY2VsKCk7XG5cblx0XHRyZXR1cm4gcmVzdWx0LnRoZW4oKCkgPT4geyB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGltZW91dCgxKS50aGVuKCgpID0+IHtcblx0XHRcdFx0YXNzZXJ0Lm9rKHRhcmdldDEuY2FsbGVkV2l0aCgnc2VhcmNoUmVzdWx0c0ZpcnN0UmVuZGVyJykpO1xuXHRcdFx0XHRhc3NlcnQub2sodGFyZ2V0MS5jYWxsZWRXaXRoKCdzZWFyY2hSZXN1bHRzRmluaXNoZWQnKSk7XG5cdFx0XHRcdC8vIGFzc2VydC5vayh0YXJnZXQyLmNhbGxlZE9uY2UpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1NlYXJjaCBNb2RlbDogU2VhcmNoIHJlc3VsdHMgYXJlIGNsZWFyZWQgZHVyaW5nIHNlYXJjaCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXN1bHRzID0gW1xuXHRcdFx0YVJhd01hdGNoKCcvMScsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMSwgNCkpLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBuZXcgT25lTGluZVJhbmdlKDEsIDQsIDExKSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvMicsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMicsIGxpbmVPbmVSYW5nZSkpXTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTZWFyY2hTZXJ2aWNlLCBzZWFyY2hTZXJ2aWNlV2l0aFJlc3VsdHMocmVzdWx0cywgeyBsaW1pdEhpdDogZmFsc2UsIG1lc3NhZ2VzOiBbXSwgcmVzdWx0czogW10gfSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rU2VhcmNoU2VydmljZSwgbm90ZWJvb2tTZWFyY2hTZXJ2aWNlV2l0aEluZm8oW10sIHVuZGVmaW5lZCkpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3Q6IFNlYXJjaE1vZGVsSW1wbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblx0XHRhc3NlcnQub2soIXRlc3RPYmplY3Quc2VhcmNoUmVzdWx0LmlzRW1wdHkoKSk7XG5cblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTZWFyY2hTZXJ2aWNlLCBzZWFyY2hTZXJ2aWNlV2l0aFJlc3VsdHMoW10pKTtcblxuXHRcdHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3NvbWVzdHJpbmcnIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pO1xuXHRcdGFzc2VydC5vayh0ZXN0T2JqZWN0LnNlYXJjaFJlc3VsdC5pc0VtcHR5KCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdTZWFyY2ggTW9kZWw6IFByZXZpb3VzIHNlYXJjaCBpcyBjYW5jZWxsZWQgd2hlbiBuZXcgc2VhcmNoIGlzIGNhbGxlZCcsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCB0b2tlblNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdHN0b3JlLmFkZCh0b2tlblNvdXJjZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJU2VhcmNoU2VydmljZSwgY2FuY2VsZWFibGVTZWFyY2hTZXJ2aWNlKHRva2VuU291cmNlKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90ZWJvb2tTZWFyY2hTZXJ2aWNlLCBub3RlYm9va1NlYXJjaFNlcnZpY2VXaXRoSW5mbyhbXSwgdG9rZW5Tb3VyY2UpKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0OiBTZWFyY2hNb2RlbEltcGwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpO1xuXHRcdHN0b3JlLmFkZCh0ZXN0T2JqZWN0KTtcblx0XHR0ZXN0T2JqZWN0LnNlYXJjaCh7IGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdzb21lc3RyaW5nJyB9LCB0eXBlOiBRdWVyeVR5cGUuVGV4dCwgZm9sZGVyUXVlcmllcyB9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElTZWFyY2hTZXJ2aWNlLCBzZWFyY2hTZXJ2aWNlV2l0aFJlc3VsdHMoW10pKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFtdLCB1bmRlZmluZWQpKTtcblx0XHR0ZXN0T2JqZWN0LnNlYXJjaCh7IGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdzb21lc3RyaW5nJyB9LCB0eXBlOiBRdWVyeVR5cGUuVGV4dCwgZm9sZGVyUXVlcmllcyB9KTtcblxuXHRcdGFzc2VydC5vayh0b2tlblNvdXJjZS50b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFJlcGxhY2VTdHJpbmcgcmV0dXJucyBwcm9wZXIgcmVwbGFjZSBzdHJpbmcgZm9yIHJlZ0V4cHJlc3Npb25zJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc3VsdHMgPSBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA0KSksXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNCwgMTEpKSldO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVNlYXJjaFNlcnZpY2UsIHNlYXJjaFNlcnZpY2VXaXRoUmVzdWx0cyhyZXN1bHRzLCB7IGxpbWl0SGl0OiBmYWxzZSwgbWVzc2FnZXM6IFtdLCByZXN1bHRzIH0pKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElOb3RlYm9va1NlYXJjaFNlcnZpY2UsIG5vdGVib29rU2VhcmNoU2VydmljZVdpdGhJbmZvKFtdLCB1bmRlZmluZWQpKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3Q6IFNlYXJjaE1vZGVsSW1wbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3QpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3JlJyB9LCB0eXBlOiBRdWVyeVR5cGUuVGV4dCwgZm9sZGVyUXVlcmllcyB9KS5hc3luY1Jlc3VsdHM7XG5cdFx0dGVzdE9iamVjdC5yZXBsYWNlU3RyaW5nID0gJ2hlbGxvJztcblx0XHRsZXQgbWF0Y2ggPSB0ZXN0T2JqZWN0LnNlYXJjaFJlc3VsdC5tYXRjaGVzKClbMF0ubWF0Y2hlcygpWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnaGVsbG8nLCBtYXRjaC5yZXBsYWNlU3RyaW5nKTtcblxuXHRcdGF3YWl0IHRlc3RPYmplY3Quc2VhcmNoKHsgY29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ3JlJywgaXNSZWdFeHA6IHRydWUgfSwgdHlwZTogUXVlcnlUeXBlLlRleHQsIGZvbGRlclF1ZXJpZXMgfSkuYXN5bmNSZXN1bHRzO1xuXHRcdG1hdGNoID0gdGVzdE9iamVjdC5zZWFyY2hSZXN1bHQubWF0Y2hlcygpWzBdLm1hdGNoZXMoKVswXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ2hlbGxvJywgbWF0Y2gucmVwbGFjZVN0cmluZyk7XG5cblx0XHRhd2FpdCB0ZXN0T2JqZWN0LnNlYXJjaCh7IGNvbnRlbnRQYXR0ZXJuOiB7IHBhdHRlcm46ICdyZSg/OnZpKScsIGlzUmVnRXhwOiB0cnVlIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblx0XHRtYXRjaCA9IHRlc3RPYmplY3Quc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKVswXS5tYXRjaGVzKClbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdoZWxsbycsIG1hdGNoLnJlcGxhY2VTdHJpbmcpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zZWFyY2goeyBjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAncihlKSg/OnZpKScsIGlzUmVnRXhwOiB0cnVlIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblx0XHRtYXRjaCA9IHRlc3RPYmplY3Quc2VhcmNoUmVzdWx0Lm1hdGNoZXMoKVswXS5tYXRjaGVzKClbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKCdoZWxsbycsIG1hdGNoLnJlcGxhY2VTdHJpbmcpO1xuXG5cdFx0YXdhaXQgdGVzdE9iamVjdC5zZWFyY2goeyBjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAncihlKSg/OnZpKScsIGlzUmVnRXhwOiB0cnVlIH0sIHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LCBmb2xkZXJRdWVyaWVzIH0pLmFzeW5jUmVzdWx0cztcblx0XHR0ZXN0T2JqZWN0LnJlcGxhY2VTdHJpbmcgPSAnaGVsbG8kMSc7XG5cdFx0bWF0Y2ggPSB0ZXN0T2JqZWN0LnNlYXJjaFJlc3VsdC5tYXRjaGVzKClbMF0ubWF0Y2hlcygpWzBdO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgnaGVsbG9lJywgbWF0Y2gucmVwbGFjZVN0cmluZyk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFSYXdNYXRjaChyZXNvdXJjZTogc3RyaW5nLCAuLi5yZXN1bHRzOiBJVGV4dFNlYXJjaE1hdGNoW10pOiBJRmlsZU1hdGNoIHtcblx0XHRyZXR1cm4geyByZXNvdXJjZTogY3JlYXRlRmlsZVVyaUZyb21QYXRoRnJvbVJvb3QocmVzb3VyY2UpLCByZXN1bHRzIH07XG5cdH1cblxuXHRmdW5jdGlvbiBhUmF3TWF0Y2hXaXRoQ2VsbHMocmVzb3VyY2U6IHN0cmluZywgLi4uY2VsbHM6IElOb3RlYm9va0NlbGxNYXRjaFdpdGhNb2RlbFtdKSB7XG5cdFx0cmV0dXJuIHsgcmVzb3VyY2U6IGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290KHJlc291cmNlKSwgY2VsbFJlc3VsdHM6IGNlbGxzIH07XG5cdH1cblxuXHRmdW5jdGlvbiBzdHViTW9kZWxTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UpOiBJTW9kZWxTZXJ2aWNlIHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElUaGVtZVNlcnZpY2UsIG5ldyBUZXN0VGhlbWVTZXJ2aWNlKCkpO1xuXHRcdGNvbnN0IGNvbmZpZyA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRjb25maWcuc2V0VXNlckNvbmZpZ3VyYXRpb24oJ3NlYXJjaCcsIHsgc2VhcmNoT25UeXBlOiB0cnVlIH0pO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBjb25maWcpO1xuXHRcdGNvbnN0IG1vZGVsU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1vZGVsU2VydmljZSk7XG5cdFx0c3RvcmUuYWRkKG1vZGVsU2VydmljZSk7XG5cdFx0cmV0dXJuIG1vZGVsU2VydmljZTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0dWJOb3RlYm9va0VkaXRvclNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSk6IElOb3RlYm9va0VkaXRvclNlcnZpY2Uge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvckdyb3Vwc1NlcnZpY2UsIG5ldyBUZXN0RWRpdG9yR3JvdXBzU2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElDb250ZXh0S2V5U2VydmljZSwgbmV3IE1vY2tDb250ZXh0S2V5U2VydmljZSgpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElFZGl0b3JTZXJ2aWNlLCBzdG9yZS5hZGQobmV3IFRlc3RFZGl0b3JTZXJ2aWNlKCkpKTtcblx0XHRjb25zdCBub3RlYm9va0VkaXRvcldpZGdldFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0VkaXRvcldpZGdldFNlcnZpY2UpO1xuXHRcdHN0b3JlLmFkZChub3RlYm9va0VkaXRvcldpZGdldFNlcnZpY2UpO1xuXHRcdHJldHVybiBub3RlYm9va0VkaXRvcldpZGdldFNlcnZpY2U7XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBSUEsT0FBTyxZQUFZO0FBQ25CLFlBQVksV0FBVztBQUN2QixZQUFZLFlBQVk7QUFDeEIsU0FBUyxpQkFBaUIsZUFBZTtBQUN6QyxTQUE0QiwrQkFBK0I7QUFDM0QsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsYUFBYTtBQUN0QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFtSSxnQkFBOEMsY0FBYyxXQUFXLHVCQUF1QjtBQUNqTyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMsMkJBQTJCO0FBQ3BD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
