import assert from "assert";
import * as sinon from "sinon";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { SearchModelImpl } from "../../browser/searchTreeModel/searchModel.js";
import { URI } from "../../../../../base/common/uri.js";
import { TextSearchMatch, OneLineRange, QueryType } from "../../../../services/search/common/search.js";
import { ITelemetryService } from "../../../../../platform/telemetry/common/telemetry.js";
import { NullTelemetryService } from "../../../../../platform/telemetry/common/telemetryUtils.js";
import { Range } from "../../../../../editor/common/core/range.js";
import { IConfigurationService } from "../../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ModelService } from "../../../../../editor/common/services/modelService.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { IReplaceService } from "../../browser/replace.js";
import { IThemeService } from "../../../../../platform/theme/common/themeService.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { IUriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentity.js";
import { UriIdentityService } from "../../../../../platform/uriIdentity/common/uriIdentityService.js";
import { FileService } from "../../../../../platform/files/common/fileService.js";
import { ILogService, NullLogService } from "../../../../../platform/log/common/log.js";
import { ILabelService } from "../../../../../platform/label/common/label.js";
import { MockLabelService } from "../../../../services/label/test/common/mockLabelService.js";
import { INotebookEditorService } from "../../../notebook/browser/services/notebookEditorService.js";
import { IEditorGroupsService } from "../../../../services/editor/common/editorGroupsService.js";
import { TestEditorGroupsService, TestEditorService } from "../../../../test/browser/workbenchTestServices.js";
import { NotebookEditorWidgetService } from "../../../notebook/browser/services/notebookEditorServiceImpl.js";
import { CellKind } from "../../../notebook/common/notebookCommon.js";
import { addToSearchResult, createFileUriFromPathFromRoot, getRootName } from "./searchTestCommon.js";
import { IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CellMatch, NotebookCompatibleFileMatch } from "../../browser/notebookSearch/notebookSearchModel.js";
import { MATCH_PREFIX } from "../../browser/searchTreeModel/searchTreeCommon.js";
import { FolderMatchImpl } from "../../browser/searchTreeModel/folderMatch.js";
import { SearchResultImpl } from "../../browser/searchTreeModel/searchResult.js";
import { MatchImpl } from "../../browser/searchTreeModel/match.js";
const lineOneRange = new OneLineRange(1, 0, 1);
suite("SearchResult", () => {
  let instantiationService;
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  setup(() => {
    instantiationService = new TestInstantiationService();
    instantiationService.stub(ITelemetryService, NullTelemetryService);
    instantiationService.stub(IModelService, stubModelService(instantiationService));
    instantiationService.stub(INotebookEditorService, stubNotebookEditorService(instantiationService));
    const fileService = new FileService(new NullLogService());
    store.add(fileService);
    const uriIdentityService = new UriIdentityService(fileService);
    store.add(uriIdentityService);
    instantiationService.stub(IUriIdentityService, uriIdentityService);
    instantiationService.stubPromise(IReplaceService, {});
    instantiationService.stub(IReplaceService, "replace", () => Promise.resolve(null));
    instantiationService.stub(ILabelService, new MockLabelService());
    instantiationService.stub(ILogService, new NullLogService());
  });
  teardown(() => {
    instantiationService.dispose();
  });
  test("Line Match", function() {
    const fileMatch = aFileMatch("folder/file.txt", null);
    const lineMatch = new MatchImpl(fileMatch, ["0 foo bar"], new OneLineRange(0, 2, 5), new OneLineRange(1, 0, 5), false);
    assert.strictEqual(lineMatch.text(), "0 foo bar");
    assert.strictEqual(lineMatch.range().startLineNumber, 2);
    assert.strictEqual(lineMatch.range().endLineNumber, 2);
    assert.strictEqual(lineMatch.range().startColumn, 1);
    assert.strictEqual(lineMatch.range().endColumn, 6);
    assert.strictEqual(lineMatch.id(), MATCH_PREFIX + "file:///folder/file.txt>[2,1 -> 2,6]foo");
    assert.strictEqual(lineMatch.fullMatchText(), "foo");
    assert.strictEqual(lineMatch.fullMatchText(true), "0 foo bar");
  });
  test("Line Match - Remove", function() {
    const fileMatch = aFileMatch("folder/file.txt", aSearchResult(), new TextSearchMatch("foo bar", new OneLineRange(1, 0, 3)));
    const lineMatch = fileMatch.matches()[0];
    fileMatch.remove(lineMatch);
    assert.strictEqual(fileMatch.matches().length, 0);
  });
  test("File Match", function() {
    let fileMatch = aFileMatch("folder/file.txt", aSearchResult());
    assert.strictEqual(fileMatch.matches().length, 0);
    assert.strictEqual(fileMatch.resource.toString(), "file:///folder/file.txt");
    assert.strictEqual(fileMatch.name(), "file.txt");
    fileMatch = aFileMatch("file.txt", aSearchResult());
    assert.strictEqual(fileMatch.matches().length, 0);
    assert.strictEqual(fileMatch.resource.toString(), "file:///file.txt");
    assert.strictEqual(fileMatch.name(), "file.txt");
  });
  test("File Match: Select an existing match", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    testObject.setSelectedMatch(testObject.matches()[0]);
    assert.strictEqual(testObject.matches()[0], testObject.getSelectedMatch());
  });
  test("File Match: Select non existing match", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    const target = testObject.matches()[0];
    testObject.remove(target);
    testObject.setSelectedMatch(target);
    assert.strictEqual(testObject.getSelectedMatch(), null);
  });
  test("File Match: isSelected return true for selected match", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    const target = testObject.matches()[0];
    testObject.setSelectedMatch(target);
    assert.ok(testObject.isMatchSelected(target));
  });
  test("File Match: isSelected return false for un-selected match", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    testObject.setSelectedMatch(testObject.matches()[0]);
    assert.ok(!testObject.isMatchSelected(testObject.matches()[1]));
  });
  test("File Match: unselect", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    testObject.setSelectedMatch(testObject.matches()[0]);
    testObject.setSelectedMatch(null);
    assert.strictEqual(null, testObject.getSelectedMatch());
  });
  test("File Match: unselect when not selected", function() {
    const testObject = aFileMatch(
      "folder/file.txt",
      aSearchResult(),
      new TextSearchMatch("foo", new OneLineRange(1, 0, 3)),
      new TextSearchMatch("bar", new OneLineRange(1, 5, 3))
    );
    testObject.setSelectedMatch(null);
    assert.strictEqual(null, testObject.getSelectedMatch());
  });
  test("Match -> FileMatch -> SearchResult hierarchy exists", function() {
    const searchModel = instantiationService.createInstance(SearchModelImpl);
    store.add(searchModel);
    const searchResult = instantiationService.createInstance(SearchResultImpl, searchModel);
    store.add(searchResult);
    const fileMatch = aFileMatch("far/boo", searchResult);
    const lineMatch = new MatchImpl(fileMatch, ["foo bar"], new OneLineRange(0, 0, 3), new OneLineRange(1, 0, 3), false);
    assert(lineMatch.parent() === fileMatch);
    assert(fileMatch.parent() === searchResult.folderMatches()[0]);
  });
  test("Adding a raw match will add a file match with line matches", function() {
    const testObject = aSearchResult();
    const target = [aRawMatch(
      "/1",
      new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4)),
      new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11)),
      new TextSearchMatch("preview 2", lineOneRange)
    )];
    addToSearchResult(testObject, target);
    assert.strictEqual(3, testObject.count());
    const actual = testObject.matches();
    assert.strictEqual(1, actual.length);
    assert.strictEqual(URI.file(`${getRootName()}/1`).toString(), actual[0].resource.toString());
    const actuaMatches = actual[0].matches();
    assert.strictEqual(3, actuaMatches.length);
    assert.strictEqual("preview 1", actuaMatches[0].text());
    assert.ok(new Range(2, 2, 2, 5).equalsRange(actuaMatches[0].range()));
    assert.strictEqual("preview 1", actuaMatches[1].text());
    assert.ok(new Range(2, 5, 2, 12).equalsRange(actuaMatches[1].range()));
    assert.strictEqual("preview 2", actuaMatches[2].text());
    assert.ok(new Range(2, 1, 2, 2).equalsRange(actuaMatches[2].range()));
  });
  test("Adding multiple raw matches", function() {
    const testObject = aSearchResult();
    const target = [
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
    addToSearchResult(testObject, target);
    assert.strictEqual(3, testObject.count());
    const actual = testObject.matches();
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
  test("Test that notebook matches get added correctly", function() {
    const testObject = aSearchResult();
    const cell1 = { cellKind: CellKind.Code };
    const cell2 = { cellKind: CellKind.Code };
    sinon.stub(CellMatch.prototype, "addContext");
    const addFileMatch = sinon.spy(FolderMatchImpl.prototype, "addFileMatch");
    const fileMatch1 = aRawFileMatchWithCells(
      "/1",
      {
        cell: cell1,
        index: 0,
        contentResults: [
          new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4))
        ],
        webviewResults: [
          new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11)),
          new TextSearchMatch("preview 2", lineOneRange)
        ]
      }
    );
    const fileMatch2 = aRawFileMatchWithCells(
      "/2",
      {
        cell: cell2,
        index: 0,
        contentResults: [
          new TextSearchMatch("preview 1", new OneLineRange(1, 1, 4))
        ],
        webviewResults: [
          new TextSearchMatch("preview 1", new OneLineRange(1, 4, 11)),
          new TextSearchMatch("preview 2", lineOneRange)
        ]
      }
    );
    const target = [fileMatch1, fileMatch2];
    addToSearchResult(testObject, target);
    assert.strictEqual(6, testObject.count());
    assert.deepStrictEqual(fileMatch1.cellResults[0].contentResults, addFileMatch.getCall(0).args[0][0].cellResults[0].contentResults);
    assert.deepStrictEqual(fileMatch1.cellResults[0].webviewResults, addFileMatch.getCall(0).args[0][0].cellResults[0].webviewResults);
    assert.deepStrictEqual(fileMatch2.cellResults[0].contentResults, addFileMatch.getCall(0).args[0][1].cellResults[0].contentResults);
    assert.deepStrictEqual(fileMatch2.cellResults[0].webviewResults, addFileMatch.getCall(0).args[0][1].cellResults[0].webviewResults);
  });
  test("Dispose disposes matches", function() {
    const target1 = sinon.spy();
    const target2 = sinon.spy();
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      ),
      aRawMatch(
        "/2",
        new TextSearchMatch("preview 2", lineOneRange)
      )
    ]);
    store.add(testObject.matches()[0].onDispose(target1));
    store.add(testObject.matches()[1].onDispose(target2));
    testObject.dispose();
    assert.ok(testObject.isEmpty());
    assert.ok(target1.calledOnce);
    assert.ok(target2.calledOnce);
  });
  test("remove triggers change event", function() {
    const target = sinon.spy();
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      )
    ]);
    const objectToRemove = testObject.matches()[0];
    store.add(testObject.onChange(target));
    testObject.remove(objectToRemove);
    assert.ok(target.calledOnce);
    assert.deepStrictEqual([{ elements: [objectToRemove], removed: true }], target.args[0]);
  });
  test("remove array triggers change event", function() {
    const target = sinon.spy();
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      ),
      aRawMatch(
        "/2",
        new TextSearchMatch("preview 2", lineOneRange)
      )
    ]);
    const arrayToRemove = testObject.matches();
    store.add(testObject.onChange(target));
    testObject.remove(arrayToRemove);
    assert.ok(target.calledOnce);
    assert.deepStrictEqual([{ elements: arrayToRemove, removed: true }], target.args[0]);
  });
  test("Removing all line matches and adding back will add file back to result", function() {
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      )
    ]);
    const target = testObject.matches()[0];
    const matchToRemove = target.matches()[0];
    target.remove(matchToRemove);
    assert.ok(testObject.isEmpty());
    target.add(matchToRemove, true);
    assert.strictEqual(1, testObject.fileCount());
    assert.strictEqual(target, testObject.matches()[0]);
  });
  test("replace should remove the file match", function() {
    const voidPromise = Promise.resolve(null);
    instantiationService.stub(IReplaceService, "replace", voidPromise);
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      )
    ]);
    testObject.replace(testObject.matches()[0]);
    return voidPromise.then(() => assert.ok(testObject.isEmpty()));
  });
  test("replace should trigger the change event", function() {
    const target = sinon.spy();
    const voidPromise = Promise.resolve(null);
    instantiationService.stub(IReplaceService, "replace", voidPromise);
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      )
    ]);
    store.add(testObject.onChange(target));
    const objectToRemove = testObject.matches()[0];
    testObject.replace(objectToRemove);
    return voidPromise.then(() => {
      assert.ok(target.calledOnce);
      assert.deepStrictEqual([{ elements: [objectToRemove], removed: true }], target.args[0]);
    });
  });
  test("replaceAll should remove all file matches", function() {
    const voidPromise = Promise.resolve(null);
    instantiationService.stubPromise(IReplaceService, "replace", voidPromise);
    const testObject = aSearchResult();
    addToSearchResult(testObject, [
      aRawMatch(
        "/1",
        new TextSearchMatch("preview 1", lineOneRange)
      ),
      aRawMatch(
        "/2",
        new TextSearchMatch("preview 2", lineOneRange)
      )
    ]);
    testObject.replaceAll(null);
    return voidPromise.then(() => assert.ok(testObject.isEmpty()));
  });
  test("batchRemove should trigger the onChange event correctly", function() {
    const target = sinon.spy();
    const testObject = getPopulatedSearchResult();
    const folderMatch = testObject.folderMatches()[0];
    const fileMatch = testObject.folderMatches()[1].allDownstreamFileMatches()[0];
    const match = testObject.folderMatches()[1].allDownstreamFileMatches()[1].matches()[0];
    const arrayToRemove = [folderMatch, fileMatch, match];
    const expectedArrayResult = folderMatch.allDownstreamFileMatches().concat([fileMatch, match.parent()]);
    store.add(testObject.onChange(target));
    testObject.batchRemove(arrayToRemove);
    assert.ok(target.calledOnce);
    assert.deepStrictEqual([{ elements: expectedArrayResult, removed: true, added: false }], target.args[0]);
  });
  test("batchReplace should trigger the onChange event correctly", async function() {
    const replaceSpy = sinon.spy();
    instantiationService.stub(IReplaceService, "replace", (arg) => {
      if (Array.isArray(arg)) {
        replaceSpy(arg[0]);
      } else {
        replaceSpy(arg);
      }
      return Promise.resolve();
    });
    const target = sinon.spy();
    const testObject = getPopulatedSearchResult();
    const folderMatch = testObject.folderMatches()[0];
    const fileMatch = testObject.folderMatches()[1].allDownstreamFileMatches()[0];
    const match = testObject.folderMatches()[1].allDownstreamFileMatches()[1].matches()[0];
    const firstExpectedMatch = folderMatch.allDownstreamFileMatches()[0];
    const arrayToRemove = [folderMatch, fileMatch, match];
    store.add(testObject.onChange(target));
    await testObject.batchReplace(arrayToRemove);
    assert.ok(target.calledOnce);
    sinon.assert.calledThrice(replaceSpy);
    sinon.assert.calledWith(replaceSpy.firstCall, firstExpectedMatch);
    sinon.assert.calledWith(replaceSpy.secondCall, fileMatch);
    sinon.assert.calledWith(replaceSpy.thirdCall, match);
  });
  test("Creating a model with nested folders should create the correct structure", function() {
    const testObject = getPopulatedSearchResultForTreeTesting();
    const root0 = testObject.folderMatches()[0];
    const root1 = testObject.folderMatches()[1];
    const root2 = testObject.folderMatches()[2];
    const root3 = testObject.folderMatches()[3];
    const root0DownstreamFiles = root0.allDownstreamFileMatches();
    assert.deepStrictEqual(root0DownstreamFiles, [...root0.fileMatchesIterator(), ...getFolderMatchAtIndex(root0, 0).fileMatchesIterator()]);
    assert.deepStrictEqual(getFolderMatchAtIndex(root0, 0).allDownstreamFileMatches(), Array.from(getFolderMatchAtIndex(root0, 0).fileMatchesIterator()));
    assert.deepStrictEqual(getFileMatchAtIndex(getFolderMatchAtIndex(root0, 0), 0).parent(), getFolderMatchAtIndex(root0, 0));
    assert.deepStrictEqual(getFolderMatchAtIndex(root0, 0).parent(), root0);
    assert.deepStrictEqual(getFolderMatchAtIndex(root0, 0).closestRoot, root0);
    root0DownstreamFiles.forEach((e) => {
      assert.deepStrictEqual(e.closestRoot, root0);
    });
    const root1DownstreamFiles = root1.allDownstreamFileMatches();
    assert.deepStrictEqual(root1.allDownstreamFileMatches(), [...root1.fileMatchesIterator(), ...getFolderMatchAtIndex(root1, 0).fileMatchesIterator()]);
    assert.deepStrictEqual(getFileMatchAtIndex(getFolderMatchAtIndex(root1, 0), 0).parent(), getFolderMatchAtIndex(root1, 0));
    root1DownstreamFiles.forEach((e) => {
      assert.deepStrictEqual(e.closestRoot, root1);
    });
    const root2DownstreamFiles = root2.allDownstreamFileMatches();
    assert.deepStrictEqual(root2DownstreamFiles, Array.from(root2.fileMatchesIterator()));
    assert.deepStrictEqual(getFileMatchAtIndex(root2, 0).parent(), root2);
    assert.deepStrictEqual(getFileMatchAtIndex(root2, 0).closestRoot, root2);
    const root3DownstreamFiles = root3.allDownstreamFileMatches();
    const root3Level3Folder = getFolderMatchAtIndex(getFolderMatchAtIndex(root3, 0), 0);
    assert.deepStrictEqual(root3DownstreamFiles, [...root3.fileMatchesIterator(), ...getFolderMatchAtIndex(root3Level3Folder, 0).fileMatchesIterator(), ...getFolderMatchAtIndex(root3Level3Folder, 1).fileMatchesIterator()].flat());
    assert.deepStrictEqual(root3Level3Folder.allDownstreamFileMatches(), getFolderMatchAtIndex(root3, 0).allDownstreamFileMatches());
    assert.deepStrictEqual(getFileMatchAtIndex(getFolderMatchAtIndex(root3Level3Folder, 1), 0).parent(), getFolderMatchAtIndex(root3Level3Folder, 1));
    assert.deepStrictEqual(getFolderMatchAtIndex(root3Level3Folder, 1).parent(), root3Level3Folder);
    assert.deepStrictEqual(root3Level3Folder.parent(), getFolderMatchAtIndex(root3, 0));
    root3DownstreamFiles.forEach((e) => {
      assert.deepStrictEqual(e.closestRoot, root3);
    });
  });
  test("Removing an intermediate folder should call OnChange() on all downstream file matches", function() {
    const target = sinon.spy();
    const testObject = getPopulatedSearchResultForTreeTesting();
    const folderMatch = getFolderMatchAtIndex(getFolderMatchAtIndex(getFolderMatchAtIndex(testObject.folderMatches()[3], 0), 0), 0);
    const expectedArrayResult = folderMatch.allDownstreamFileMatches();
    store.add(testObject.onChange(target));
    testObject.remove(folderMatch);
    assert.ok(target.calledOnce);
    assert.deepStrictEqual([{ elements: expectedArrayResult, removed: true, added: false, clearingAll: false }], target.args[0]);
  });
  test("Replacing an intermediate folder should remove all downstream folders and file matches", async function() {
    const target = sinon.spy();
    const testObject = getPopulatedSearchResultForTreeTesting();
    const folderMatch = getFolderMatchAtIndex(testObject.folderMatches()[3], 0);
    const expectedArrayResult = folderMatch.allDownstreamFileMatches();
    store.add(testObject.onChange(target));
    await testObject.batchReplace([folderMatch]);
    assert.deepStrictEqual([{ elements: expectedArrayResult, removed: true, added: false }], target.args[0]);
  });
  function aFileMatch(path, searchResult, ...lineMatches) {
    if (!searchResult) {
      searchResult = aSearchResult();
    }
    const rawMatch = {
      resource: URI.file("/" + path),
      results: lineMatches
    };
    const root = searchResult?.folderMatches()[0];
    const fileMatch = instantiationService.createInstance(NotebookCompatibleFileMatch, {
      pattern: ""
    }, void 0, void 0, root, rawMatch, null, "");
    fileMatch.createMatches();
    store.add(fileMatch);
    return fileMatch;
  }
  function aSearchResult() {
    const searchModel = instantiationService.createInstance(SearchModelImpl);
    store.add(searchModel);
    searchModel.searchResult.query = {
      type: QueryType.Text,
      folderQueries: [{ folder: createFileUriFromPathFromRoot() }],
      contentPattern: {
        pattern: ""
      }
    };
    return searchModel.searchResult;
  }
  function aRawMatch(resource, ...results) {
    return { resource: createFileUriFromPathFromRoot(resource), results };
  }
  function aRawFileMatchWithCells(resource, ...cellMatches) {
    return {
      resource: createFileUriFromPathFromRoot(resource),
      cellResults: cellMatches
    };
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
  function getPopulatedSearchResult() {
    const testObject = aSearchResult();
    testObject.query = {
      type: QueryType.Text,
      contentPattern: { pattern: "foo" },
      folderQueries: [
        {
          folder: createFileUriFromPathFromRoot("/voo")
        },
        { folder: createFileUriFromPathFromRoot("/with") }
      ]
    };
    addToSearchResult(testObject, [
      aRawMatch(
        "/voo/foo.a",
        new TextSearchMatch("preview 1", lineOneRange),
        new TextSearchMatch("preview 2", lineOneRange)
      ),
      aRawMatch(
        "/with/path/bar.b",
        new TextSearchMatch("preview 3", lineOneRange)
      ),
      aRawMatch(
        "/with/path.c",
        new TextSearchMatch("preview 4", lineOneRange),
        new TextSearchMatch("preview 5", lineOneRange)
      )
    ]);
    return testObject;
  }
  function getPopulatedSearchResultForTreeTesting() {
    const testObject = aSearchResult();
    testObject.query = {
      type: QueryType.Text,
      contentPattern: { pattern: "foo" },
      folderQueries: [
        {
          folder: createFileUriFromPathFromRoot("/voo")
        },
        {
          folder: createFileUriFromPathFromRoot("/with")
        },
        {
          folder: createFileUriFromPathFromRoot("/with/test")
        },
        {
          folder: createFileUriFromPathFromRoot("/eep")
        }
      ]
    };
    addToSearchResult(testObject, [
      aRawMatch(
        "/voo/foo.a",
        new TextSearchMatch("preview 1", lineOneRange),
        new TextSearchMatch("preview 2", lineOneRange)
      ),
      aRawMatch(
        "/voo/beep/foo.c",
        new TextSearchMatch("preview 1", lineOneRange),
        new TextSearchMatch("preview 2", lineOneRange)
      ),
      aRawMatch(
        "/voo/beep/boop.c",
        new TextSearchMatch("preview 3", lineOneRange)
      ),
      aRawMatch(
        "/with/path.c",
        new TextSearchMatch("preview 4", lineOneRange),
        new TextSearchMatch("preview 5", lineOneRange)
      ),
      aRawMatch(
        "/with/path/bar.b",
        new TextSearchMatch("preview 3", lineOneRange)
      ),
      aRawMatch(
        "/with/test/woo.c",
        new TextSearchMatch("preview 3", lineOneRange)
      ),
      aRawMatch(
        "/eep/bar/goo/foo/here.txt",
        new TextSearchMatch("preview 6", lineOneRange),
        new TextSearchMatch("preview 7", lineOneRange)
      ),
      aRawMatch(
        "/eep/bar/goo/ooo/there.txt",
        new TextSearchMatch("preview 6", lineOneRange),
        new TextSearchMatch("preview 7", lineOneRange)
      ),
      aRawMatch(
        "/eep/eyy.y",
        new TextSearchMatch("preview 6", lineOneRange),
        new TextSearchMatch("preview 7", lineOneRange)
      )
    ]);
    return testObject;
  }
  function getFolderMatchAtIndex(parent, index) {
    return Array.from(parent.folderMatchesIterator())[index];
  }
  function getFileMatchAtIndex(parent, index) {
    return Array.from(parent.fileMatchesIterator())[index];
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvdGVzdC9icm93c2VyL3NlYXJjaFJlc3VsdC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IFNlYXJjaE1vZGVsSW1wbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL3NlYXJjaE1vZGVsLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJRmlsZU1hdGNoLCBUZXh0U2VhcmNoTWF0Y2gsIE9uZUxpbmVSYW5nZSwgSVRleHRTZWFyY2hNYXRjaCwgUXVlcnlUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvc2VhcmNoL2NvbW1vbi9zZWFyY2guanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBOdWxsVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5VXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL3Rlc3QvY29tbW9uL3Rlc3RDb25maWd1cmF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJUmVwbGFjZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL3JlcGxhY2UuanMnO1xuaW1wb3J0IHsgSVRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi90aGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdFRoZW1lU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL3Rlc3QvY29tbW9uL3Rlc3RUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHlTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlLCBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sYWJlbC9jb21tb24vbGFiZWwuanMnO1xuaW1wb3J0IHsgTW9ja0xhYmVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2xhYmVsL3Rlc3QvY29tbW9uL21vY2tMYWJlbFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU5vdGVib29rRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL25vdGVib29rL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tFZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFZGl0b3JHcm91cHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JHcm91cHNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3RFZGl0b3JHcm91cHNTZXJ2aWNlLCBUZXN0RWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci93b3JrYmVuY2hUZXN0U2VydmljZXMuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JXaWRnZXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9zZXJ2aWNlcy9ub3RlYm9va0VkaXRvclNlcnZpY2VJbXBsLmpzJztcbmltcG9ydCB7IElDZWxsVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgYWRkVG9TZWFyY2hSZXN1bHQsIGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290LCBnZXRSb290TmFtZSB9IGZyb20gJy4vc2VhcmNoVGVzdENvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tDZWxsTWF0Y2hXaXRoTW9kZWwsIElOb3RlYm9va0ZpbGVNYXRjaFdpdGhNb2RlbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tTZWFyY2gvc2VhcmNoTm90ZWJvb2tIZWxwZXJzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgTW9ja0NvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy90ZXN0L2NvbW1vbi9tb2NrS2V5YmluZGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBDZWxsTWF0Y2gsIE5vdGVib29rQ29tcGF0aWJsZUZpbGVNYXRjaCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tTZWFyY2gvbm90ZWJvb2tTZWFyY2hNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tGaWxlSW5zdGFuY2VNYXRjaCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbm90ZWJvb2tTZWFyY2gvbm90ZWJvb2tTZWFyY2hNb2RlbEJhc2UuanMnO1xuaW1wb3J0IHsgSVNlYXJjaFJlc3VsdCwgSVNlYXJjaFRyZWVGb2xkZXJNYXRjaCwgTUFUQ0hfUFJFRklYIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoVHJlZUNvbW1vbi5qcyc7XG5pbXBvcnQgeyBGb2xkZXJNYXRjaEltcGwgfSBmcm9tICcuLi8uLi9icm93c2VyL3NlYXJjaFRyZWVNb2RlbC9mb2xkZXJNYXRjaC5qcyc7XG5pbXBvcnQgeyBTZWFyY2hSZXN1bHRJbXBsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoUmVzdWx0LmpzJztcbmltcG9ydCB7IE1hdGNoSW1wbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL21hdGNoLmpzJztcblxuY29uc3QgbGluZU9uZVJhbmdlID0gbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCAxKTtcblxuc3VpdGUoJ1NlYXJjaFJlc3VsdCcsICgpID0+IHtcblxuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblx0Y29uc3Qgc3RvcmUgPSBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJVGVsZW1ldHJ5U2VydmljZSwgTnVsbFRlbGVtZXRyeVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU1vZGVsU2VydmljZSwgc3R1Yk1vZGVsU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSU5vdGVib29rRWRpdG9yU2VydmljZSwgc3R1Yk5vdGVib29rRWRpdG9yU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZSkpO1xuXHRcdGNvbnN0IGZpbGVTZXJ2aWNlID0gbmV3IEZpbGVTZXJ2aWNlKG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRzdG9yZS5hZGQoZmlsZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHVyaUlkZW50aXR5U2VydmljZSA9IG5ldyBVcmlJZGVudGl0eVNlcnZpY2UoZmlsZVNlcnZpY2UpO1xuXHRcdHN0b3JlLmFkZCh1cmlJZGVudGl0eVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVVyaUlkZW50aXR5U2VydmljZSwgdXJpSWRlbnRpdHlTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViUHJvbWlzZShJUmVwbGFjZVNlcnZpY2UsIHt9KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZXBsYWNlU2VydmljZSwgJ3JlcGxhY2UnLCAoKSA9PiBQcm9taXNlLnJlc29sdmUobnVsbCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUxhYmVsU2VydmljZSwgbmV3IE1vY2tMYWJlbFNlcnZpY2UoKSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTG9nU2VydmljZSwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5lIE1hdGNoJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IGFGaWxlTWF0Y2goJ2ZvbGRlci9maWxlLnR4dCcsIG51bGwhKTtcblx0XHRjb25zdCBsaW5lTWF0Y2ggPSBuZXcgTWF0Y2hJbXBsKGZpbGVNYXRjaCwgWycwIGZvbyBiYXInXSwgbmV3IE9uZUxpbmVSYW5nZSgwLCAyLCA1KSwgbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCA1KSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lTWF0Y2gudGV4dCgpLCAnMCBmb28gYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVNYXRjaC5yYW5nZSgpLnN0YXJ0TGluZU51bWJlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVNYXRjaC5yYW5nZSgpLmVuZExpbmVOdW1iZXIsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lTWF0Y2gucmFuZ2UoKS5zdGFydENvbHVtbiwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVNYXRjaC5yYW5nZSgpLmVuZENvbHVtbiwgNik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVNYXRjaC5pZCgpLCBNQVRDSF9QUkVGSVggKyAnZmlsZTovLy9mb2xkZXIvZmlsZS50eHQ+WzIsMSAtPiAyLDZdZm9vJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZU1hdGNoLmZ1bGxNYXRjaFRleHQoKSwgJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lTWF0Y2guZnVsbE1hdGNoVGV4dCh0cnVlKSwgJzAgZm9vIGJhcicpO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5lIE1hdGNoIC0gUmVtb3ZlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IGFGaWxlTWF0Y2goJ2ZvbGRlci9maWxlLnR4dCcsIGFTZWFyY2hSZXN1bHQoKSwgbmV3IFRleHRTZWFyY2hNYXRjaCgnZm9vIGJhcicsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMCwgMykpKTtcblx0XHRjb25zdCBsaW5lTWF0Y2ggPSBmaWxlTWF0Y2gubWF0Y2hlcygpWzBdO1xuXHRcdGZpbGVNYXRjaC5yZW1vdmUobGluZU1hdGNoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZU1hdGNoLm1hdGNoZXMoKS5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoJywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBmaWxlTWF0Y2ggPSBhRmlsZU1hdGNoKCdmb2xkZXIvZmlsZS50eHQnLCBhU2VhcmNoUmVzdWx0KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaWxlTWF0Y2gubWF0Y2hlcygpLmxlbmd0aCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVNYXRjaC5yZXNvdXJjZS50b1N0cmluZygpLCAnZmlsZTovLy9mb2xkZXIvZmlsZS50eHQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZU1hdGNoLm5hbWUoKSwgJ2ZpbGUudHh0Jyk7XG5cblx0XHRmaWxlTWF0Y2ggPSBhRmlsZU1hdGNoKCdmaWxlLnR4dCcsIGFTZWFyY2hSZXN1bHQoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVNYXRjaC5tYXRjaGVzKCkubGVuZ3RoLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlsZU1hdGNoLnJlc291cmNlLnRvU3RyaW5nKCksICdmaWxlOi8vL2ZpbGUudHh0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpbGVNYXRjaC5uYW1lKCksICdmaWxlLnR4dCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoOiBTZWxlY3QgYW4gZXhpc3RpbmcgbWF0Y2gnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFGaWxlTWF0Y2goXG5cdFx0XHQnZm9sZGVyL2ZpbGUudHh0Jyxcblx0XHRcdGFTZWFyY2hSZXN1bHQoKSxcblx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ2ZvbycsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMCwgMykpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgnYmFyJywgbmV3IE9uZUxpbmVSYW5nZSgxLCA1LCAzKSkpO1xuXG5cdFx0dGVzdE9iamVjdC5zZXRTZWxlY3RlZE1hdGNoKHRlc3RPYmplY3QubWF0Y2hlcygpWzBdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXN0T2JqZWN0Lm1hdGNoZXMoKVswXSwgdGVzdE9iamVjdC5nZXRTZWxlY3RlZE1hdGNoKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoOiBTZWxlY3Qgbm9uIGV4aXN0aW5nIG1hdGNoJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhRmlsZU1hdGNoKFxuXHRcdFx0J2ZvbGRlci9maWxlLnR4dCcsXG5cdFx0XHRhU2VhcmNoUmVzdWx0KCksXG5cdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdmb28nLCBuZXcgT25lTGluZVJhbmdlKDEsIDAsIDMpKSxcblx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ2JhcicsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNSwgMykpKTtcblx0XHRjb25zdCB0YXJnZXQgPSB0ZXN0T2JqZWN0Lm1hdGNoZXMoKVswXTtcblx0XHR0ZXN0T2JqZWN0LnJlbW92ZSh0YXJnZXQpO1xuXG5cdFx0dGVzdE9iamVjdC5zZXRTZWxlY3RlZE1hdGNoKHRhcmdldCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdE9iamVjdC5nZXRTZWxlY3RlZE1hdGNoKCksIG51bGwpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoOiBpc1NlbGVjdGVkIHJldHVybiB0cnVlIGZvciBzZWxlY3RlZCBtYXRjaCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYUZpbGVNYXRjaChcblx0XHRcdCdmb2xkZXIvZmlsZS50eHQnLFxuXHRcdFx0YVNlYXJjaFJlc3VsdCgpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgnZm9vJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCAzKSksXG5cdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdiYXInLCBuZXcgT25lTGluZVJhbmdlKDEsIDUsIDMpKSk7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gdGVzdE9iamVjdC5tYXRjaGVzKClbMF07XG5cdFx0dGVzdE9iamVjdC5zZXRTZWxlY3RlZE1hdGNoKHRhcmdldCk7XG5cblx0XHRhc3NlcnQub2sodGVzdE9iamVjdC5pc01hdGNoU2VsZWN0ZWQodGFyZ2V0KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgTWF0Y2g6IGlzU2VsZWN0ZWQgcmV0dXJuIGZhbHNlIGZvciB1bi1zZWxlY3RlZCBtYXRjaCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYUZpbGVNYXRjaCgnZm9sZGVyL2ZpbGUudHh0Jyxcblx0XHRcdGFTZWFyY2hSZXN1bHQoKSxcblx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ2ZvbycsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMCwgMykpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgnYmFyJywgbmV3IE9uZUxpbmVSYW5nZSgxLCA1LCAzKSkpO1xuXHRcdHRlc3RPYmplY3Quc2V0U2VsZWN0ZWRNYXRjaCh0ZXN0T2JqZWN0Lm1hdGNoZXMoKVswXSk7XG5cdFx0YXNzZXJ0Lm9rKCF0ZXN0T2JqZWN0LmlzTWF0Y2hTZWxlY3RlZCh0ZXN0T2JqZWN0Lm1hdGNoZXMoKVsxXSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoOiB1bnNlbGVjdCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYUZpbGVNYXRjaChcblx0XHRcdCdmb2xkZXIvZmlsZS50eHQnLFxuXHRcdFx0YVNlYXJjaFJlc3VsdCgpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgnZm9vJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCAzKSksXG5cdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdiYXInLCBuZXcgT25lTGluZVJhbmdlKDEsIDUsIDMpKSk7XG5cdFx0dGVzdE9iamVjdC5zZXRTZWxlY3RlZE1hdGNoKHRlc3RPYmplY3QubWF0Y2hlcygpWzBdKTtcblx0XHR0ZXN0T2JqZWN0LnNldFNlbGVjdGVkTWF0Y2gobnVsbCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobnVsbCwgdGVzdE9iamVjdC5nZXRTZWxlY3RlZE1hdGNoKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIE1hdGNoOiB1bnNlbGVjdCB3aGVuIG5vdCBzZWxlY3RlZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYUZpbGVNYXRjaChcblx0XHRcdCdmb2xkZXIvZmlsZS50eHQnLFxuXHRcdFx0YVNlYXJjaFJlc3VsdCgpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgnZm9vJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCAzKSksXG5cdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdiYXInLCBuZXcgT25lTGluZVJhbmdlKDEsIDUsIDMpKSk7XG5cdFx0dGVzdE9iamVjdC5zZXRTZWxlY3RlZE1hdGNoKG51bGwpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG51bGwsIHRlc3RPYmplY3QuZ2V0U2VsZWN0ZWRNYXRjaCgpKTtcblx0fSk7XG5cblx0dGVzdCgnTWF0Y2ggLT4gRmlsZU1hdGNoIC0+IFNlYXJjaFJlc3VsdCBoaWVyYXJjaHkgZXhpc3RzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3Qgc2VhcmNoTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpO1xuXHRcdHN0b3JlLmFkZChzZWFyY2hNb2RlbCk7XG5cdFx0Y29uc3Qgc2VhcmNoUmVzdWx0ID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoU2VhcmNoUmVzdWx0SW1wbCwgc2VhcmNoTW9kZWwpO1xuXHRcdHN0b3JlLmFkZChzZWFyY2hSZXN1bHQpO1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IGFGaWxlTWF0Y2goJ2Zhci9ib28nLCBzZWFyY2hSZXN1bHQpO1xuXHRcdGNvbnN0IGxpbmVNYXRjaCA9IG5ldyBNYXRjaEltcGwoZmlsZU1hdGNoLCBbJ2ZvbyBiYXInXSwgbmV3IE9uZUxpbmVSYW5nZSgwLCAwLCAzKSwgbmV3IE9uZUxpbmVSYW5nZSgxLCAwLCAzKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0KGxpbmVNYXRjaC5wYXJlbnQoKSA9PT0gZmlsZU1hdGNoKTtcblx0XHRhc3NlcnQoZmlsZU1hdGNoLnBhcmVudCgpID09PSBzZWFyY2hSZXN1bHQuZm9sZGVyTWF0Y2hlcygpWzBdKTtcblx0fSk7XG5cblx0dGVzdCgnQWRkaW5nIGEgcmF3IG1hdGNoIHdpbGwgYWRkIGEgZmlsZSBtYXRjaCB3aXRoIGxpbmUgbWF0Y2hlcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVNlYXJjaFJlc3VsdCgpO1xuXHRcdGNvbnN0IHRhcmdldCA9IFthUmF3TWF0Y2goJy8xJyxcblx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMSwgNCkpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCA0LCAxMSkpLFxuXHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAyJywgbGluZU9uZVJhbmdlKSldO1xuXG5cdFx0YWRkVG9TZWFyY2hSZXN1bHQodGVzdE9iamVjdCwgdGFyZ2V0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCB0ZXN0T2JqZWN0LmNvdW50KCkpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gdGVzdE9iamVjdC5tYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIGFjdHVhbC5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChVUkkuZmlsZShgJHtnZXRSb290TmFtZSgpfS8xYCkudG9TdHJpbmcoKSwgYWN0dWFsWzBdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0Y29uc3QgYWN0dWFNYXRjaGVzID0gYWN0dWFsWzBdLm1hdGNoZXMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoMywgYWN0dWFNYXRjaGVzLmxlbmd0aCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoJ3ByZXZpZXcgMScsIGFjdHVhTWF0Y2hlc1swXS50ZXh0KCkpO1xuXHRcdGFzc2VydC5vayhuZXcgUmFuZ2UoMiwgMiwgMiwgNSkuZXF1YWxzUmFuZ2UoYWN0dWFNYXRjaGVzWzBdLnJhbmdlKCkpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgncHJldmlldyAxJywgYWN0dWFNYXRjaGVzWzFdLnRleHQoKSk7XG5cdFx0YXNzZXJ0Lm9rKG5ldyBSYW5nZSgyLCA1LCAyLCAxMikuZXF1YWxzUmFuZ2UoYWN0dWFNYXRjaGVzWzFdLnJhbmdlKCkpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgncHJldmlldyAyJywgYWN0dWFNYXRjaGVzWzJdLnRleHQoKSk7XG5cdFx0YXNzZXJ0Lm9rKG5ldyBSYW5nZSgyLCAxLCAyLCAyKS5lcXVhbHNSYW5nZShhY3R1YU1hdGNoZXNbMl0ucmFuZ2UoKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdBZGRpbmcgbXVsdGlwbGUgcmF3IG1hdGNoZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFTZWFyY2hSZXN1bHQoKTtcblx0XHRjb25zdCB0YXJnZXQgPSBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA0KSksXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNCwgMTEpKSksXG5cdFx0XHRhUmF3TWF0Y2goJy8yJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAyJywgbGluZU9uZVJhbmdlKSldO1xuXG5cdFx0YWRkVG9TZWFyY2hSZXN1bHQodGVzdE9iamVjdCwgdGFyZ2V0KTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgzLCB0ZXN0T2JqZWN0LmNvdW50KCkpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gdGVzdE9iamVjdC5tYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDIsIGFjdHVhbC5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChVUkkuZmlsZShgJHtnZXRSb290TmFtZSgpfS8xYCkudG9TdHJpbmcoKSwgYWN0dWFsWzBdLnJlc291cmNlLnRvU3RyaW5nKCkpO1xuXG5cdFx0bGV0IGFjdHVhTWF0Y2hlcyA9IGFjdHVhbFswXS5tYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDIsIGFjdHVhTWF0Y2hlcy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgncHJldmlldyAxJywgYWN0dWFNYXRjaGVzWzBdLnRleHQoKSk7XG5cdFx0YXNzZXJ0Lm9rKG5ldyBSYW5nZSgyLCAyLCAyLCA1KS5lcXVhbHNSYW5nZShhY3R1YU1hdGNoZXNbMF0ucmFuZ2UoKSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgncHJldmlldyAxJywgYWN0dWFNYXRjaGVzWzFdLnRleHQoKSk7XG5cdFx0YXNzZXJ0Lm9rKG5ldyBSYW5nZSgyLCA1LCAyLCAxMikuZXF1YWxzUmFuZ2UoYWN0dWFNYXRjaGVzWzFdLnJhbmdlKCkpKTtcblxuXHRcdGFjdHVhTWF0Y2hlcyA9IGFjdHVhbFsxXS5tYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIGFjdHVhTWF0Y2hlcy5sZW5ndGgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgncHJldmlldyAyJywgYWN0dWFNYXRjaGVzWzBdLnRleHQoKSk7XG5cdFx0YXNzZXJ0Lm9rKG5ldyBSYW5nZSgyLCAxLCAyLCAyKS5lcXVhbHNSYW5nZShhY3R1YU1hdGNoZXNbMF0ucmFuZ2UoKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdUZXN0IHRoYXQgbm90ZWJvb2sgbWF0Y2hlcyBnZXQgYWRkZWQgY29ycmVjdGx5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhU2VhcmNoUmVzdWx0KCk7XG5cdFx0Y29uc3QgY2VsbDEgPSB7IGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlIH0gYXMgSUNlbGxWaWV3TW9kZWw7XG5cdFx0Y29uc3QgY2VsbDIgPSB7IGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlIH0gYXMgSUNlbGxWaWV3TW9kZWw7XG5cblx0XHRzaW5vbi5zdHViKENlbGxNYXRjaC5wcm90b3R5cGUsICdhZGRDb250ZXh0Jyk7XG5cblx0XHRjb25zdCBhZGRGaWxlTWF0Y2ggPSBzaW5vbi5zcHkoRm9sZGVyTWF0Y2hJbXBsLnByb3RvdHlwZSwgXCJhZGRGaWxlTWF0Y2hcIik7XG5cdFx0Y29uc3QgZmlsZU1hdGNoMSA9IGFSYXdGaWxlTWF0Y2hXaXRoQ2VsbHMoJy8xJyxcblx0XHRcdHtcblx0XHRcdFx0Y2VsbDogY2VsbDEsXG5cdFx0XHRcdGluZGV4OiAwLFxuXHRcdFx0XHRjb250ZW50UmVzdWx0czogW1xuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgMSwgNCkpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHR3ZWJ2aWV3UmVzdWx0czogW1xuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIG5ldyBPbmVMaW5lUmFuZ2UoMSwgNCwgMTEpKSxcblx0XHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDInLCBsaW5lT25lUmFuZ2UpXG5cdFx0XHRcdF1cblx0XHRcdH0sKTtcblx0XHRjb25zdCBmaWxlTWF0Y2gyID0gYVJhd0ZpbGVNYXRjaFdpdGhDZWxscygnLzInLFxuXHRcdFx0e1xuXHRcdFx0XHRjZWxsOiBjZWxsMixcblx0XHRcdFx0aW5kZXg6IDAsXG5cdFx0XHRcdGNvbnRlbnRSZXN1bHRzOiBbXG5cdFx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCAxLCA0KSksXG5cdFx0XHRcdF0sXG5cdFx0XHRcdHdlYnZpZXdSZXN1bHRzOiBbXG5cdFx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbmV3IE9uZUxpbmVSYW5nZSgxLCA0LCAxMSkpLFxuXHRcdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMicsIGxpbmVPbmVSYW5nZSlcblx0XHRcdFx0XVxuXHRcdFx0fSk7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gW2ZpbGVNYXRjaDEsIGZpbGVNYXRjaDJdO1xuXG5cdFx0YWRkVG9TZWFyY2hSZXN1bHQodGVzdE9iamVjdCwgdGFyZ2V0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoNiwgdGVzdE9iamVjdC5jb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpbGVNYXRjaDEuY2VsbFJlc3VsdHNbMF0uY29udGVudFJlc3VsdHMsIChhZGRGaWxlTWF0Y2guZ2V0Q2FsbCgwKS5hcmdzWzBdWzBdIGFzIElOb3RlYm9va0ZpbGVNYXRjaFdpdGhNb2RlbCkuY2VsbFJlc3VsdHNbMF0uY29udGVudFJlc3VsdHMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlsZU1hdGNoMS5jZWxsUmVzdWx0c1swXS53ZWJ2aWV3UmVzdWx0cywgKGFkZEZpbGVNYXRjaC5nZXRDYWxsKDApLmFyZ3NbMF1bMF0gYXMgSU5vdGVib29rRmlsZU1hdGNoV2l0aE1vZGVsKS5jZWxsUmVzdWx0c1swXS53ZWJ2aWV3UmVzdWx0cyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaWxlTWF0Y2gyLmNlbGxSZXN1bHRzWzBdLmNvbnRlbnRSZXN1bHRzLCAoYWRkRmlsZU1hdGNoLmdldENhbGwoMCkuYXJnc1swXVsxXSBhcyBJTm90ZWJvb2tGaWxlTWF0Y2hXaXRoTW9kZWwpLmNlbGxSZXN1bHRzWzBdLmNvbnRlbnRSZXN1bHRzKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpbGVNYXRjaDIuY2VsbFJlc3VsdHNbMF0ud2Vidmlld1Jlc3VsdHMsIChhZGRGaWxlTWF0Y2guZ2V0Q2FsbCgwKS5hcmdzWzBdWzFdIGFzIElOb3RlYm9va0ZpbGVNYXRjaFdpdGhNb2RlbCkuY2VsbFJlc3VsdHNbMF0ud2Vidmlld1Jlc3VsdHMpO1xuXHR9KTtcblxuXHR0ZXN0KCdEaXNwb3NlIGRpc3Bvc2VzIG1hdGNoZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGFyZ2V0MSA9IHNpbm9uLnNweSgpO1xuXHRcdGNvbnN0IHRhcmdldDIgPSBzaW5vbi5zcHkoKTtcblxuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhU2VhcmNoUmVzdWx0KCk7XG5cdFx0YWRkVG9TZWFyY2hSZXN1bHQodGVzdE9iamVjdCwgW1xuXHRcdFx0YVJhd01hdGNoKCcvMScsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIGxpbmVPbmVSYW5nZSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvMicsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMicsIGxpbmVPbmVSYW5nZSkpXSk7XG5cblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5tYXRjaGVzKClbMF0ub25EaXNwb3NlKHRhcmdldDEpKTtcblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5tYXRjaGVzKClbMV0ub25EaXNwb3NlKHRhcmdldDIpKTtcblxuXHRcdHRlc3RPYmplY3QuZGlzcG9zZSgpO1xuXG5cdFx0YXNzZXJ0Lm9rKHRlc3RPYmplY3QuaXNFbXB0eSgpKTtcblx0XHRhc3NlcnQub2sodGFyZ2V0MS5jYWxsZWRPbmNlKTtcblx0XHRhc3NlcnQub2sodGFyZ2V0Mi5jYWxsZWRPbmNlKTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlIHRyaWdnZXJzIGNoYW5nZSBldmVudCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0YXJnZXQgPSBzaW5vbi5zcHkoKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVNlYXJjaFJlc3VsdCgpO1xuXHRcdGFkZFRvU2VhcmNoUmVzdWx0KHRlc3RPYmplY3QsIFtcblx0XHRcdGFSYXdNYXRjaCgnLzEnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBsaW5lT25lUmFuZ2UpKV0pO1xuXHRcdGNvbnN0IG9iamVjdFRvUmVtb3ZlID0gdGVzdE9iamVjdC5tYXRjaGVzKClbMF07XG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3Qub25DaGFuZ2UodGFyZ2V0KSk7XG5cblx0XHR0ZXN0T2JqZWN0LnJlbW92ZShvYmplY3RUb1JlbW92ZSk7XG5cblx0XHRhc3NlcnQub2sodGFyZ2V0LmNhbGxlZE9uY2UpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoW3sgZWxlbWVudHM6IFtvYmplY3RUb1JlbW92ZV0sIHJlbW92ZWQ6IHRydWUgfV0sIHRhcmdldC5hcmdzWzBdKTtcblx0fSk7XG5cblx0dGVzdCgncmVtb3ZlIGFycmF5IHRyaWdnZXJzIGNoYW5nZSBldmVudCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0YXJnZXQgPSBzaW5vbi5zcHkoKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVNlYXJjaFJlc3VsdCgpO1xuXHRcdGFkZFRvU2VhcmNoUmVzdWx0KHRlc3RPYmplY3QsIFtcblx0XHRcdGFSYXdNYXRjaCgnLzEnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnLzInLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDInLCBsaW5lT25lUmFuZ2UpKV0pO1xuXHRcdGNvbnN0IGFycmF5VG9SZW1vdmUgPSB0ZXN0T2JqZWN0Lm1hdGNoZXMoKTtcblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5vbkNoYW5nZSh0YXJnZXQpKTtcblxuXHRcdHRlc3RPYmplY3QucmVtb3ZlKGFycmF5VG9SZW1vdmUpO1xuXG5cdFx0YXNzZXJ0Lm9rKHRhcmdldC5jYWxsZWRPbmNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt7IGVsZW1lbnRzOiBhcnJheVRvUmVtb3ZlLCByZW1vdmVkOiB0cnVlIH1dLCB0YXJnZXQuYXJnc1swXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlbW92aW5nIGFsbCBsaW5lIG1hdGNoZXMgYW5kIGFkZGluZyBiYWNrIHdpbGwgYWRkIGZpbGUgYmFjayB0byByZXN1bHQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFTZWFyY2hSZXN1bHQoKTtcblx0XHRhZGRUb1NlYXJjaFJlc3VsdCh0ZXN0T2JqZWN0LCBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbGluZU9uZVJhbmdlKSldKTtcblx0XHRjb25zdCB0YXJnZXQgPSB0ZXN0T2JqZWN0Lm1hdGNoZXMoKVswXTtcblx0XHRjb25zdCBtYXRjaFRvUmVtb3ZlID0gdGFyZ2V0Lm1hdGNoZXMoKVswXTtcblx0XHR0YXJnZXQucmVtb3ZlKG1hdGNoVG9SZW1vdmUpO1xuXG5cdFx0YXNzZXJ0Lm9rKHRlc3RPYmplY3QuaXNFbXB0eSgpKTtcblx0XHR0YXJnZXQuYWRkKG1hdGNoVG9SZW1vdmUsIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKDEsIHRlc3RPYmplY3QuZmlsZUNvdW50KCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0YXJnZXQsIHRlc3RPYmplY3QubWF0Y2hlcygpWzBdKTtcblx0fSk7XG5cblx0dGVzdCgncmVwbGFjZSBzaG91bGQgcmVtb3ZlIHRoZSBmaWxlIG1hdGNoJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZvaWRQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVJlcGxhY2VTZXJ2aWNlLCAncmVwbGFjZScsIHZvaWRQcm9taXNlKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVNlYXJjaFJlc3VsdCgpO1xuXHRcdGFkZFRvU2VhcmNoUmVzdWx0KHRlc3RPYmplY3QsIFtcblx0XHRcdGFSYXdNYXRjaCgnLzEnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBsaW5lT25lUmFuZ2UpKV0pO1xuXG5cdFx0dGVzdE9iamVjdC5yZXBsYWNlKHRlc3RPYmplY3QubWF0Y2hlcygpWzBdKTtcblxuXHRcdHJldHVybiB2b2lkUHJvbWlzZS50aGVuKCgpID0+IGFzc2VydC5vayh0ZXN0T2JqZWN0LmlzRW1wdHkoKSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZXBsYWNlIHNob3VsZCB0cmlnZ2VyIHRoZSBjaGFuZ2UgZXZlbnQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgdGFyZ2V0ID0gc2lub24uc3B5KCk7XG5cdFx0Y29uc3Qgdm9pZFByb21pc2UgPSBQcm9taXNlLnJlc29sdmUobnVsbCk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJUmVwbGFjZVNlcnZpY2UsICdyZXBsYWNlJywgdm9pZFByb21pc2UpO1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhU2VhcmNoUmVzdWx0KCk7XG5cdFx0YWRkVG9TZWFyY2hSZXN1bHQodGVzdE9iamVjdCwgW1xuXHRcdFx0YVJhd01hdGNoKCcvMScsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIGxpbmVPbmVSYW5nZSkpXSk7XG5cblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5vbkNoYW5nZSh0YXJnZXQpKTtcblx0XHRjb25zdCBvYmplY3RUb1JlbW92ZSA9IHRlc3RPYmplY3QubWF0Y2hlcygpWzBdO1xuXG5cdFx0dGVzdE9iamVjdC5yZXBsYWNlKG9iamVjdFRvUmVtb3ZlKTtcblxuXHRcdHJldHVybiB2b2lkUHJvbWlzZS50aGVuKCgpID0+IHtcblx0XHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt7IGVsZW1lbnRzOiBbb2JqZWN0VG9SZW1vdmVdLCByZW1vdmVkOiB0cnVlIH1dLCB0YXJnZXQuYXJnc1swXSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlcGxhY2VBbGwgc2hvdWxkIHJlbW92ZSBhbGwgZmlsZSBtYXRjaGVzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZvaWRQcm9taXNlID0gUHJvbWlzZS5yZXNvbHZlKG51bGwpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWJQcm9taXNlKElSZXBsYWNlU2VydmljZSwgJ3JlcGxhY2UnLCB2b2lkUHJvbWlzZSk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGFTZWFyY2hSZXN1bHQoKTtcblx0XHRhZGRUb1NlYXJjaFJlc3VsdCh0ZXN0T2JqZWN0LCBbXG5cdFx0XHRhUmF3TWF0Y2goJy8xJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAxJywgbGluZU9uZVJhbmdlKSksXG5cdFx0XHRhUmF3TWF0Y2goJy8yJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAyJywgbGluZU9uZVJhbmdlKSldKTtcblxuXHRcdHRlc3RPYmplY3QucmVwbGFjZUFsbChudWxsISk7XG5cblx0XHRyZXR1cm4gdm9pZFByb21pc2UudGhlbigoKSA9PiBhc3NlcnQub2sodGVzdE9iamVjdC5pc0VtcHR5KCkpKTtcblx0fSk7XG5cblx0dGVzdCgnYmF0Y2hSZW1vdmUgc2hvdWxkIHRyaWdnZXIgdGhlIG9uQ2hhbmdlIGV2ZW50IGNvcnJlY3RseScsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0YXJnZXQgPSBzaW5vbi5zcHkoKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZ2V0UG9wdWxhdGVkU2VhcmNoUmVzdWx0KCk7XG5cblx0XHRjb25zdCBmb2xkZXJNYXRjaCA9IHRlc3RPYmplY3QuZm9sZGVyTWF0Y2hlcygpWzBdO1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IHRlc3RPYmplY3QuZm9sZGVyTWF0Y2hlcygpWzFdLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpWzBdO1xuXHRcdGNvbnN0IG1hdGNoID0gdGVzdE9iamVjdC5mb2xkZXJNYXRjaGVzKClbMV0uYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKClbMV0ubWF0Y2hlcygpWzBdO1xuXG5cdFx0Y29uc3QgYXJyYXlUb1JlbW92ZSA9IFtmb2xkZXJNYXRjaCwgZmlsZU1hdGNoLCBtYXRjaF07XG5cdFx0Y29uc3QgZXhwZWN0ZWRBcnJheVJlc3VsdCA9IGZvbGRlck1hdGNoLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpLmNvbmNhdChbZmlsZU1hdGNoLCBtYXRjaC5wYXJlbnQoKV0pO1xuXG5cdFx0c3RvcmUuYWRkKHRlc3RPYmplY3Qub25DaGFuZ2UodGFyZ2V0KSk7XG5cdFx0dGVzdE9iamVjdC5iYXRjaFJlbW92ZShhcnJheVRvUmVtb3ZlKTtcblxuXHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChbeyBlbGVtZW50czogZXhwZWN0ZWRBcnJheVJlc3VsdCwgcmVtb3ZlZDogdHJ1ZSwgYWRkZWQ6IGZhbHNlIH1dLCB0YXJnZXQuYXJnc1swXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JhdGNoUmVwbGFjZSBzaG91bGQgdHJpZ2dlciB0aGUgb25DaGFuZ2UgZXZlbnQgY29ycmVjdGx5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHJlcGxhY2VTcHkgPSBzaW5vbi5zcHkoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElSZXBsYWNlU2VydmljZSwgJ3JlcGxhY2UnLCAoYXJnOiBhbnkpID0+IHtcblx0XHRcdGlmIChBcnJheS5pc0FycmF5KGFyZykpIHtcblx0XHRcdFx0cmVwbGFjZVNweShhcmdbMF0pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVwbGFjZVNweShhcmcpO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdGFyZ2V0ID0gc2lub24uc3B5KCk7XG5cdFx0Y29uc3QgdGVzdE9iamVjdCA9IGdldFBvcHVsYXRlZFNlYXJjaFJlc3VsdCgpO1xuXG5cdFx0Y29uc3QgZm9sZGVyTWF0Y2ggPSB0ZXN0T2JqZWN0LmZvbGRlck1hdGNoZXMoKVswXTtcblx0XHRjb25zdCBmaWxlTWF0Y2ggPSB0ZXN0T2JqZWN0LmZvbGRlck1hdGNoZXMoKVsxXS5hbGxEb3duc3RyZWFtRmlsZU1hdGNoZXMoKVswXTtcblx0XHRjb25zdCBtYXRjaCA9IHRlc3RPYmplY3QuZm9sZGVyTWF0Y2hlcygpWzFdLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpWzFdLm1hdGNoZXMoKVswXTtcblxuXHRcdGNvbnN0IGZpcnN0RXhwZWN0ZWRNYXRjaCA9IGZvbGRlck1hdGNoLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpWzBdO1xuXG5cdFx0Y29uc3QgYXJyYXlUb1JlbW92ZSA9IFtmb2xkZXJNYXRjaCwgZmlsZU1hdGNoLCBtYXRjaF07XG5cblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5vbkNoYW5nZSh0YXJnZXQpKTtcblx0XHRhd2FpdCB0ZXN0T2JqZWN0LmJhdGNoUmVwbGFjZShhcnJheVRvUmVtb3ZlKTtcblxuXHRcdGFzc2VydC5vayh0YXJnZXQuY2FsbGVkT25jZSk7XG5cdFx0c2lub24uYXNzZXJ0LmNhbGxlZFRocmljZShyZXBsYWNlU3B5KTtcblx0XHRzaW5vbi5hc3NlcnQuY2FsbGVkV2l0aChyZXBsYWNlU3B5LmZpcnN0Q2FsbCwgZmlyc3RFeHBlY3RlZE1hdGNoKTtcblx0XHRzaW5vbi5hc3NlcnQuY2FsbGVkV2l0aChyZXBsYWNlU3B5LnNlY29uZENhbGwsIGZpbGVNYXRjaCk7XG5cdFx0c2lub24uYXNzZXJ0LmNhbGxlZFdpdGgocmVwbGFjZVNweS50aGlyZENhbGwsIG1hdGNoKTtcblx0fSk7XG5cblx0dGVzdCgnQ3JlYXRpbmcgYSBtb2RlbCB3aXRoIG5lc3RlZCBmb2xkZXJzIHNob3VsZCBjcmVhdGUgdGhlIGNvcnJlY3Qgc3RydWN0dXJlJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBnZXRQb3B1bGF0ZWRTZWFyY2hSZXN1bHRGb3JUcmVlVGVzdGluZygpO1xuXG5cdFx0Y29uc3Qgcm9vdDAgPSB0ZXN0T2JqZWN0LmZvbGRlck1hdGNoZXMoKVswXTtcblx0XHRjb25zdCByb290MSA9IHRlc3RPYmplY3QuZm9sZGVyTWF0Y2hlcygpWzFdO1xuXHRcdGNvbnN0IHJvb3QyID0gdGVzdE9iamVjdC5mb2xkZXJNYXRjaGVzKClbMl07XG5cdFx0Y29uc3Qgcm9vdDMgPSB0ZXN0T2JqZWN0LmZvbGRlck1hdGNoZXMoKVszXTtcblxuXHRcdGNvbnN0IHJvb3QwRG93bnN0cmVhbUZpbGVzID0gcm9vdDAuYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyb290MERvd25zdHJlYW1GaWxlcywgWy4uLnJvb3QwLmZpbGVNYXRjaGVzSXRlcmF0b3IoKSwgLi4uZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QwLCAwKS5maWxlTWF0Y2hlc0l0ZXJhdG9yKCldKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldEZvbGRlck1hdGNoQXRJbmRleChyb290MCwgMCkuYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCksIEFycmF5LmZyb20oZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QwLCAwKS5maWxlTWF0Y2hlc0l0ZXJhdG9yKCkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldEZpbGVNYXRjaEF0SW5kZXgoZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QwLCAwKSwgMCkucGFyZW50KCksIGdldEZvbGRlck1hdGNoQXRJbmRleChyb290MCwgMCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QwLCAwKS5wYXJlbnQoKSwgcm9vdDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoKGdldEZvbGRlck1hdGNoQXRJbmRleChyb290MCwgMCkgYXMgRm9sZGVyTWF0Y2hJbXBsKS5jbG9zZXN0Um9vdCwgcm9vdDApO1xuXHRcdHJvb3QwRG93bnN0cmVhbUZpbGVzLmZvckVhY2goKGUpID0+IHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZS5jbG9zZXN0Um9vdCwgcm9vdDApO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3Qgcm9vdDFEb3duc3RyZWFtRmlsZXMgPSByb290MS5hbGxEb3duc3RyZWFtRmlsZU1hdGNoZXMoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJvb3QxLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpLCBbLi4ucm9vdDEuZmlsZU1hdGNoZXNJdGVyYXRvcigpLCAuLi5nZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDEsIDApLmZpbGVNYXRjaGVzSXRlcmF0b3IoKV0pOyAvLyBleGNsdWRlcyB0aGUgbWF0Y2hlcyBmcm9tIG5lc3RlZCByb290XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRGaWxlTWF0Y2hBdEluZGV4KGdldEZvbGRlck1hdGNoQXRJbmRleChyb290MSwgMCksIDApLnBhcmVudCgpLCBnZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDEsIDApKTtcblx0XHRyb290MURvd25zdHJlYW1GaWxlcy5mb3JFYWNoKChlKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGUuY2xvc2VzdFJvb3QsIHJvb3QxKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHJvb3QyRG93bnN0cmVhbUZpbGVzID0gcm9vdDIuYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyb290MkRvd25zdHJlYW1GaWxlcywgQXJyYXkuZnJvbShyb290Mi5maWxlTWF0Y2hlc0l0ZXJhdG9yKCkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldEZpbGVNYXRjaEF0SW5kZXgocm9vdDIsIDApLnBhcmVudCgpLCByb290Mik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRGaWxlTWF0Y2hBdEluZGV4KHJvb3QyLCAwKS5jbG9zZXN0Um9vdCwgcm9vdDIpO1xuXG5cblx0XHRjb25zdCByb290M0Rvd25zdHJlYW1GaWxlcyA9IHJvb3QzLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpO1xuXHRcdGNvbnN0IHJvb3QzTGV2ZWwzRm9sZGVyID0gZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KGdldEZvbGRlck1hdGNoQXRJbmRleChyb290MywgMCksIDApO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocm9vdDNEb3duc3RyZWFtRmlsZXMsIFsuLi5yb290My5maWxlTWF0Y2hlc0l0ZXJhdG9yKCksIC4uLmdldEZvbGRlck1hdGNoQXRJbmRleChyb290M0xldmVsM0ZvbGRlciwgMCkuZmlsZU1hdGNoZXNJdGVyYXRvcigpLCAuLi5nZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDNMZXZlbDNGb2xkZXIsIDEpLmZpbGVNYXRjaGVzSXRlcmF0b3IoKV0uZmxhdCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJvb3QzTGV2ZWwzRm9sZGVyLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpLCBnZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDMsIDApLmFsbERvd25zdHJlYW1GaWxlTWF0Y2hlcygpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0RmlsZU1hdGNoQXRJbmRleChnZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDNMZXZlbDNGb2xkZXIsIDEpLCAwKS5wYXJlbnQoKSwgZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QzTGV2ZWwzRm9sZGVyLCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRGb2xkZXJNYXRjaEF0SW5kZXgocm9vdDNMZXZlbDNGb2xkZXIsIDEpLnBhcmVudCgpLCByb290M0xldmVsM0ZvbGRlcik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyb290M0xldmVsM0ZvbGRlci5wYXJlbnQoKSwgZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHJvb3QzLCAwKSk7XG5cblx0XHRyb290M0Rvd25zdHJlYW1GaWxlcy5mb3JFYWNoKChlKSA9PiB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGUuY2xvc2VzdFJvb3QsIHJvb3QzKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUmVtb3ZpbmcgYW4gaW50ZXJtZWRpYXRlIGZvbGRlciBzaG91bGQgY2FsbCBPbkNoYW5nZSgpIG9uIGFsbCBkb3duc3RyZWFtIGZpbGUgbWF0Y2hlcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0YXJnZXQgPSBzaW5vbi5zcHkoKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZ2V0UG9wdWxhdGVkU2VhcmNoUmVzdWx0Rm9yVHJlZVRlc3RpbmcoKTtcblxuXHRcdGNvbnN0IGZvbGRlck1hdGNoID0gZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KGdldEZvbGRlck1hdGNoQXRJbmRleChnZXRGb2xkZXJNYXRjaEF0SW5kZXgodGVzdE9iamVjdC5mb2xkZXJNYXRjaGVzKClbM10sIDApLCAwKSwgMCk7XG5cblx0XHRjb25zdCBleHBlY3RlZEFycmF5UmVzdWx0ID0gZm9sZGVyTWF0Y2guYWxsRG93bnN0cmVhbUZpbGVNYXRjaGVzKCk7XG5cblx0XHRzdG9yZS5hZGQodGVzdE9iamVjdC5vbkNoYW5nZSh0YXJnZXQpKTtcblx0XHR0ZXN0T2JqZWN0LnJlbW92ZShmb2xkZXJNYXRjaCk7XG5cdFx0YXNzZXJ0Lm9rKHRhcmdldC5jYWxsZWRPbmNlKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFt7IGVsZW1lbnRzOiBleHBlY3RlZEFycmF5UmVzdWx0LCByZW1vdmVkOiB0cnVlLCBhZGRlZDogZmFsc2UsIGNsZWFyaW5nQWxsOiBmYWxzZSB9XSwgdGFyZ2V0LmFyZ3NbMF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdSZXBsYWNpbmcgYW4gaW50ZXJtZWRpYXRlIGZvbGRlciBzaG91bGQgcmVtb3ZlIGFsbCBkb3duc3RyZWFtIGZvbGRlcnMgYW5kIGZpbGUgbWF0Y2hlcycsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCB0YXJnZXQgPSBzaW5vbi5zcHkoKTtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gZ2V0UG9wdWxhdGVkU2VhcmNoUmVzdWx0Rm9yVHJlZVRlc3RpbmcoKTtcblxuXHRcdGNvbnN0IGZvbGRlck1hdGNoID0gZ2V0Rm9sZGVyTWF0Y2hBdEluZGV4KHRlc3RPYmplY3QuZm9sZGVyTWF0Y2hlcygpWzNdLCAwKTtcblxuXHRcdGNvbnN0IGV4cGVjdGVkQXJyYXlSZXN1bHQgPSBmb2xkZXJNYXRjaC5hbGxEb3duc3RyZWFtRmlsZU1hdGNoZXMoKTtcblxuXHRcdHN0b3JlLmFkZCh0ZXN0T2JqZWN0Lm9uQ2hhbmdlKHRhcmdldCkpO1xuXHRcdGF3YWl0IHRlc3RPYmplY3QuYmF0Y2hSZXBsYWNlKFtmb2xkZXJNYXRjaF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoW3sgZWxlbWVudHM6IGV4cGVjdGVkQXJyYXlSZXN1bHQsIHJlbW92ZWQ6IHRydWUsIGFkZGVkOiBmYWxzZSB9XSwgdGFyZ2V0LmFyZ3NbMF0pO1xuXG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGFGaWxlTWF0Y2gocGF0aDogc3RyaW5nLCBzZWFyY2hSZXN1bHQ6IElTZWFyY2hSZXN1bHQgfCB1bmRlZmluZWQsIC4uLmxpbmVNYXRjaGVzOiBJVGV4dFNlYXJjaE1hdGNoW10pOiBJTm90ZWJvb2tGaWxlSW5zdGFuY2VNYXRjaCB7XG5cdFx0aWYgKCFzZWFyY2hSZXN1bHQpIHtcblx0XHRcdHNlYXJjaFJlc3VsdCA9IGFTZWFyY2hSZXN1bHQoKTtcblx0XHR9XG5cdFx0Y29uc3QgcmF3TWF0Y2g6IElGaWxlTWF0Y2ggPSB7XG5cdFx0XHRyZXNvdXJjZTogVVJJLmZpbGUoJy8nICsgcGF0aCksXG5cdFx0XHRyZXN1bHRzOiBsaW5lTWF0Y2hlc1xuXHRcdH07XG5cdFx0Y29uc3Qgcm9vdCA9IHNlYXJjaFJlc3VsdD8uZm9sZGVyTWF0Y2hlcygpWzBdO1xuXHRcdGNvbnN0IGZpbGVNYXRjaCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rQ29tcGF0aWJsZUZpbGVNYXRjaCwge1xuXHRcdFx0cGF0dGVybjogJydcblx0XHR9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgcm9vdCwgcmF3TWF0Y2gsIG51bGwsICcnKTtcblx0XHRmaWxlTWF0Y2guY3JlYXRlTWF0Y2hlcygpO1xuXG5cdFx0c3RvcmUuYWRkKGZpbGVNYXRjaCk7XG5cdFx0cmV0dXJuIGZpbGVNYXRjaDtcblx0fVxuXG5cdGZ1bmN0aW9uIGFTZWFyY2hSZXN1bHQoKTogSVNlYXJjaFJlc3VsdCB7XG5cdFx0Y29uc3Qgc2VhcmNoTW9kZWwgPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShTZWFyY2hNb2RlbEltcGwpO1xuXHRcdHN0b3JlLmFkZChzZWFyY2hNb2RlbCk7XG5cdFx0c2VhcmNoTW9kZWwuc2VhcmNoUmVzdWx0LnF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsIGZvbGRlclF1ZXJpZXM6IFt7IGZvbGRlcjogY3JlYXRlRmlsZVVyaUZyb21QYXRoRnJvbVJvb3QoKSB9XSwgY29udGVudFBhdHRlcm46IHtcblx0XHRcdFx0cGF0dGVybjogJydcblx0XHRcdH1cblx0XHR9O1xuXHRcdHJldHVybiBzZWFyY2hNb2RlbC5zZWFyY2hSZXN1bHQ7XG5cdH1cblxuXHRmdW5jdGlvbiBhUmF3TWF0Y2gocmVzb3VyY2U6IHN0cmluZywgLi4ucmVzdWx0czogSVRleHRTZWFyY2hNYXRjaFtdKTogSUZpbGVNYXRjaCB7XG5cdFx0cmV0dXJuIHsgcmVzb3VyY2U6IGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290KHJlc291cmNlKSwgcmVzdWx0cyB9O1xuXHR9XG5cblx0ZnVuY3Rpb24gYVJhd0ZpbGVNYXRjaFdpdGhDZWxscyhyZXNvdXJjZTogc3RyaW5nLCAuLi5jZWxsTWF0Y2hlczogSU5vdGVib29rQ2VsbE1hdGNoV2l0aE1vZGVsW10pOiBJTm90ZWJvb2tGaWxlTWF0Y2hXaXRoTW9kZWwge1xuXHRcdHJldHVybiB7XG5cdFx0XHRyZXNvdXJjZTogY3JlYXRlRmlsZVVyaUZyb21QYXRoRnJvbVJvb3QocmVzb3VyY2UpLFxuXHRcdFx0Y2VsbFJlc3VsdHM6IGNlbGxNYXRjaGVzXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIHN0dWJNb2RlbFNlcnZpY2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSk6IElNb2RlbFNlcnZpY2Uge1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSVRoZW1lU2VydmljZSwgbmV3IFRlc3RUaGVtZVNlcnZpY2UoKSk7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGNvbmZpZy5zZXRVc2VyQ29uZmlndXJhdGlvbignc2VhcmNoJywgeyBzZWFyY2hPblR5cGU6IHRydWUgfSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZyk7XG5cdFx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTW9kZWxTZXJ2aWNlKTtcblx0XHRzdG9yZS5hZGQobW9kZWxTZXJ2aWNlKTtcblx0XHRyZXR1cm4gbW9kZWxTZXJ2aWNlO1xuXHR9XG5cblx0ZnVuY3Rpb24gc3R1Yk5vdGVib29rRWRpdG9yU2VydmljZShpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKTogSU5vdGVib29rRWRpdG9yU2VydmljZSB7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJRWRpdG9yR3JvdXBzU2VydmljZSwgbmV3IFRlc3RFZGl0b3JHcm91cHNTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUNvbnRleHRLZXlTZXJ2aWNlLCBuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKCkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnN0dWIoSUVkaXRvclNlcnZpY2UsIHN0b3JlLmFkZChuZXcgVGVzdEVkaXRvclNlcnZpY2UoKSkpO1xuXHRcdGNvbnN0IG5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZSk7XG5cdFx0c3RvcmUuYWRkKG5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZSk7XG5cdFx0cmV0dXJuIG5vdGVib29rRWRpdG9yV2lkZ2V0U2VydmljZTtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFBvcHVsYXRlZFNlYXJjaFJlc3VsdCgpIHtcblx0XHRjb25zdCB0ZXN0T2JqZWN0ID0gYVNlYXJjaFJlc3VsdCgpO1xuXG5cdFx0dGVzdE9iamVjdC5xdWVyeSA9IHtcblx0XHRcdHR5cGU6IFF1ZXJ5VHlwZS5UZXh0LFxuXHRcdFx0Y29udGVudFBhdHRlcm46IHsgcGF0dGVybjogJ2ZvbycgfSxcblx0XHRcdGZvbGRlclF1ZXJpZXM6IFt7XG5cdFx0XHRcdGZvbGRlcjogY3JlYXRlRmlsZVVyaUZyb21QYXRoRnJvbVJvb3QoJy92b28nKVxuXHRcdFx0fSxcblx0XHRcdHsgZm9sZGVyOiBjcmVhdGVGaWxlVXJpRnJvbVBhdGhGcm9tUm9vdCgnL3dpdGgnKSB9LFxuXHRcdFx0XVxuXHRcdH07XG5cblx0XHRhZGRUb1NlYXJjaFJlc3VsdCh0ZXN0T2JqZWN0LCBbXG5cdFx0XHRhUmF3TWF0Y2goJy92b28vZm9vLmEnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDInLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnL3dpdGgvcGF0aC9iYXIuYicsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMycsIGxpbmVPbmVSYW5nZSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvd2l0aC9wYXRoLmMnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDQnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDUnLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRdKTtcblx0XHRyZXR1cm4gdGVzdE9iamVjdDtcblx0fVxuXG5cdGZ1bmN0aW9uIGdldFBvcHVsYXRlZFNlYXJjaFJlc3VsdEZvclRyZWVUZXN0aW5nKCkge1xuXHRcdGNvbnN0IHRlc3RPYmplY3QgPSBhU2VhcmNoUmVzdWx0KCk7XG5cblx0XHR0ZXN0T2JqZWN0LnF1ZXJ5ID0ge1xuXHRcdFx0dHlwZTogUXVlcnlUeXBlLlRleHQsXG5cdFx0XHRjb250ZW50UGF0dGVybjogeyBwYXR0ZXJuOiAnZm9vJyB9LFxuXHRcdFx0Zm9sZGVyUXVlcmllczogW3tcblx0XHRcdFx0Zm9sZGVyOiBjcmVhdGVGaWxlVXJpRnJvbVBhdGhGcm9tUm9vdCgnL3ZvbycpXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRmb2xkZXI6IGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290KCcvd2l0aCcpXG5cdFx0XHR9LFxuXHRcdFx0e1xuXHRcdFx0XHRmb2xkZXI6IGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290KCcvd2l0aC90ZXN0Jylcblx0XHRcdH0sXG5cdFx0XHR7XG5cdFx0XHRcdGZvbGRlcjogY3JlYXRlRmlsZVVyaUZyb21QYXRoRnJvbVJvb3QoJy9lZXAnKVxuXHRcdFx0fSxcblx0XHRcdF1cblx0XHR9O1xuXHRcdC8qKipcblx0XHQgKiBmaWxlIHN0cnVjdHVyZSBsb29rcyBsaWtlOlxuXHRcdCAqICp2b28vXG5cdFx0ICogfC0gZm9vLmFcblx0XHQgKiB8LSBiZWVwXG5cdFx0ICogICAgfC0gZm9vLmNcblx0XHQgKiBcdCAgfC0gYm9vcC5jXG5cdFx0ICogKndpdGgvXG5cdFx0ICogfC0gcGF0aFxuXHRcdCAqICAgIHwtIGJhci5iXG5cdFx0ICogfC0gcGF0aC5jXG5cdFx0ICogfC0gKnRlc3QvXG5cdFx0ICogICAgfC0gd29vLmNcblx0XHQgKiBlZXAvXG5cdFx0ICogICAgfC0gYmFyXG5cdFx0ICogICAgICAgfC0gZ29vXG5cdFx0ICogICAgICAgICAgIHwtIGZvb1xuXHRcdCAqICAgICAgICAgICAgICB8LSBoZXJlLnR4dFxuXHRcdCAqIFx0XHRcdCB8LSBvb29cblx0XHQgKiAgICAgICAgICAgICAgfC0gdGhlcmUudHh0XG5cdFx0ICogICAgfC0gZXl5Lnlcblx0XHQgKi9cblxuXHRcdGFkZFRvU2VhcmNoUmVzdWx0KHRlc3RPYmplY3QsIFtcblx0XHRcdGFSYXdNYXRjaCgnL3Zvby9mb28uYScsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMScsIGxpbmVPbmVSYW5nZSksIG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMicsIGxpbmVPbmVSYW5nZSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvdm9vL2JlZXAvZm9vLmMnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDEnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDInLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnL3Zvby9iZWVwL2Jvb3AuYycsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMycsIGxpbmVPbmVSYW5nZSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvd2l0aC9wYXRoLmMnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDQnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDUnLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnL3dpdGgvcGF0aC9iYXIuYicsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgMycsIGxpbmVPbmVSYW5nZSkpLFxuXHRcdFx0YVJhd01hdGNoKCcvd2l0aC90ZXN0L3dvby5jJyxcblx0XHRcdFx0bmV3IFRleHRTZWFyY2hNYXRjaCgncHJldmlldyAzJywgbGluZU9uZVJhbmdlKSksXG5cdFx0XHRhUmF3TWF0Y2goJy9lZXAvYmFyL2dvby9mb28vaGVyZS50eHQnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDYnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDcnLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnL2VlcC9iYXIvZ29vL29vby90aGVyZS50eHQnLFxuXHRcdFx0XHRuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDYnLCBsaW5lT25lUmFuZ2UpLCBuZXcgVGV4dFNlYXJjaE1hdGNoKCdwcmV2aWV3IDcnLCBsaW5lT25lUmFuZ2UpKSxcblx0XHRcdGFSYXdNYXRjaCgnL2VlcC9leXkueScsXG5cdFx0XHRcdG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgNicsIGxpbmVPbmVSYW5nZSksIG5ldyBUZXh0U2VhcmNoTWF0Y2goJ3ByZXZpZXcgNycsIGxpbmVPbmVSYW5nZSkpXG5cdFx0XSk7XG5cdFx0cmV0dXJuIHRlc3RPYmplY3Q7XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRGb2xkZXJNYXRjaEF0SW5kZXgocGFyZW50OiBJU2VhcmNoVHJlZUZvbGRlck1hdGNoLCBpbmRleDogbnVtYmVyKSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20ocGFyZW50LmZvbGRlck1hdGNoZXNJdGVyYXRvcigpKVtpbmRleF07XG5cdH1cblxuXHRmdW5jdGlvbiBnZXRGaWxlTWF0Y2hBdEluZGV4KHBhcmVudDogSVNlYXJjaFRyZWVGb2xkZXJNYXRjaCwgaW5kZXg6IG51bWJlcikge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHBhcmVudC5maWxlTWF0Y2hlc0l0ZXJhdG9yKCkpW2luZGV4XTtcblx0fVxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFxQixpQkFBaUIsY0FBZ0MsaUJBQWlCO0FBQ3ZGLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsYUFBYTtBQUN0QixTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGFBQWEsc0JBQXNCO0FBQzVDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMseUJBQXlCLHlCQUF5QjtBQUMzRCxTQUFTLG1DQUFtQztBQUU1QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLG1CQUFtQiwrQkFBK0IsbUJBQW1CO0FBRTlFLFNBQVMsMEJBQTBCO0FBQ25DLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsV0FBVyxtQ0FBbUM7QUFFdkQsU0FBZ0Qsb0JBQW9CO0FBQ3BFLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsaUJBQWlCO0FBRTFCLE1BQU0s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
