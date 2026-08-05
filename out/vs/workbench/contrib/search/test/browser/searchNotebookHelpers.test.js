import assert from "assert";
import { Range } from "../../../../../editor/common/core/range.js";
import { FindMatch } from "../../../../../editor/common/model.js";
import { QueryType } from "../../../../services/search/common/search.js";
import { CellKind } from "../../../notebook/common/notebookCommon.js";
import { contentMatchesToTextSearchMatches, webviewMatchesToTextSearchMatches } from "../../browser/notebookSearch/searchNotebookHelpers.js";
import { CellFindMatchModel } from "../../../notebook/browser/contrib/find/findModel.js";
import { SearchModelImpl } from "../../browser/searchTreeModel/searchModel.js";
import { URI } from "../../../../../base/common/uri.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { createFileUriFromPathFromRoot, stubModelService, stubNotebookEditorService } from "./searchTestCommon.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
import { INotebookEditorService } from "../../../notebook/browser/services/notebookEditorService.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { CellMatch, NotebookCompatibleFileMatch, textSearchMatchesToNotebookMatches } from "../../browser/notebookSearch/notebookSearchModel.js";
import { FolderMatchImpl } from "../../browser/searchTreeModel/folderMatch.js";
suite("searchNotebookHelpers", () => {
  let instantiationService;
  let mdCellFindMatch;
  let codeCellFindMatch;
  let mdInputCell;
  let codeCell;
  let markdownContentResults;
  let codeContentResults;
  let codeWebviewResults;
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let counter = 0;
  setup(() => {
    instantiationService = new TestInstantiationService();
    store.add(instantiationService);
    const modelService = stubModelService(instantiationService, (e) => store.add(e));
    const notebookEditorService = stubNotebookEditorService(instantiationService, (e) => store.add(e));
    instantiationService.stub(IModelService, modelService);
    instantiationService.stub(INotebookEditorService, notebookEditorService);
    mdInputCell = {
      id: "mdCell",
      cellKind: CellKind.Markup,
      textBuffer: {
        getLineContent(lineNumber) {
          if (lineNumber === 1) {
            return "# Hello World Test";
          } else {
            return "";
          }
        }
      }
    };
    const findMatchMds = [new FindMatch(new Range(1, 15, 1, 19), ["Test"])];
    codeCell = {
      id: "codeCell",
      cellKind: CellKind.Code,
      textBuffer: {
        getLineContent(lineNumber) {
          if (lineNumber === 1) {
            return 'print("test! testing!!")';
          } else if (lineNumber === 2) {
            return 'print("this is a Test")';
          } else {
            return "";
          }
        }
      }
    };
    const findMatchCodeCells = [
      new FindMatch(new Range(1, 8, 1, 12), ["test"]),
      new FindMatch(new Range(1, 14, 1, 18), ["test"]),
      new FindMatch(new Range(2, 18, 2, 22), ["Test"])
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
      },
      {
        index: 3,
        searchPreviewInfo: {
          line: "this is a Test",
          range: {
            start: 11,
            end: 15
          }
        }
      }
    ];
    mdCellFindMatch = new CellFindMatchModel(
      mdInputCell,
      0,
      findMatchMds,
      []
    );
    codeCellFindMatch = new CellFindMatchModel(
      codeCell,
      5,
      findMatchCodeCells,
      webviewMatches
    );
  });
  teardown(() => {
    instantiationService.dispose();
  });
  suite("notebookEditorMatchesToTextSearchResults", () => {
    function assertRangesEqual(actual, expected) {
      if (!Array.isArray(actual)) {
        actual = [actual];
      }
      assert.strictEqual(actual.length, expected.length);
      actual.forEach((r, i) => {
        const expectedRange = expected[i];
        assert.deepStrictEqual(
          { startLineNumber: r.startLineNumber, startColumn: r.startColumn, endLineNumber: r.endLineNumber, endColumn: r.endColumn },
          { startLineNumber: expectedRange.startLineNumber, startColumn: expectedRange.startColumn, endLineNumber: expectedRange.endLineNumber, endColumn: expectedRange.endColumn }
        );
      });
    }
    test("convert CellFindMatchModel to ITextSearchMatch and check results", () => {
      markdownContentResults = contentMatchesToTextSearchMatches(mdCellFindMatch.contentMatches, mdInputCell);
      codeContentResults = contentMatchesToTextSearchMatches(codeCellFindMatch.contentMatches, codeCell);
      codeWebviewResults = webviewMatchesToTextSearchMatches(codeCellFindMatch.webviewMatches);
      assert.strictEqual(markdownContentResults.length, 1);
      assert.strictEqual(markdownContentResults[0].previewText, "# Hello World Test\n");
      assertRangesEqual(markdownContentResults[0].rangeLocations.map((e) => e.preview), [new Range(0, 14, 0, 18)]);
      assertRangesEqual(markdownContentResults[0].rangeLocations.map((e) => e.source), [new Range(0, 14, 0, 18)]);
      assert.strictEqual(codeContentResults.length, 2);
      assert.strictEqual(codeContentResults[0].previewText, 'print("test! testing!!")\n');
      assert.strictEqual(codeContentResults[1].previewText, 'print("this is a Test")\n');
      assertRangesEqual(codeContentResults[0].rangeLocations.map((e) => e.preview), [new Range(0, 7, 0, 11), new Range(0, 13, 0, 17)]);
      assertRangesEqual(codeContentResults[0].rangeLocations.map((e) => e.source), [new Range(0, 7, 0, 11), new Range(0, 13, 0, 17)]);
      assert.strictEqual(codeWebviewResults.length, 3);
      assert.strictEqual(codeWebviewResults[0].previewText, "test! testing!!");
      assert.strictEqual(codeWebviewResults[1].previewText, "test! testing!!");
      assert.strictEqual(codeWebviewResults[2].previewText, "this is a Test");
      assertRangesEqual(codeWebviewResults[0].rangeLocations.map((e) => e.preview), [new Range(0, 1, 0, 5)]);
      assertRangesEqual(codeWebviewResults[1].rangeLocations.map((e) => e.preview), [new Range(0, 7, 0, 11)]);
      assertRangesEqual(codeWebviewResults[2].rangeLocations.map((e) => e.preview), [new Range(0, 11, 0, 15)]);
      assertRangesEqual(codeWebviewResults[0].rangeLocations.map((e) => e.source), [new Range(0, 1, 0, 5)]);
      assertRangesEqual(codeWebviewResults[1].rangeLocations.map((e) => e.source), [new Range(0, 7, 0, 11)]);
      assertRangesEqual(codeWebviewResults[2].rangeLocations.map((e) => e.source), [new Range(0, 11, 0, 15)]);
    });
    test("convert ITextSearchMatch to MatchInNotebook", () => {
      const mdCellMatch = new CellMatch(aFileMatch(), mdInputCell, 0);
      const markdownCellContentMatchObjs = textSearchMatchesToNotebookMatches(markdownContentResults, mdCellMatch);
      const codeCellMatch = new CellMatch(aFileMatch(), codeCell, 0);
      const codeCellContentMatchObjs = textSearchMatchesToNotebookMatches(codeContentResults, codeCellMatch);
      const codeWebviewContentMatchObjs = textSearchMatchesToNotebookMatches(codeWebviewResults, codeCellMatch);
      assert.strictEqual(markdownCellContentMatchObjs[0].cell?.id, mdCellMatch.id);
      assertRangesEqual(markdownCellContentMatchObjs[0].range(), [new Range(1, 15, 1, 19)]);
      assert.strictEqual(codeCellContentMatchObjs[0].cell?.id, codeCellMatch.id);
      assert.strictEqual(codeCellContentMatchObjs[1].cell?.id, codeCellMatch.id);
      assertRangesEqual(codeCellContentMatchObjs[0].range(), [new Range(1, 8, 1, 12)]);
      assertRangesEqual(codeCellContentMatchObjs[1].range(), [new Range(1, 14, 1, 18)]);
      assertRangesEqual(codeCellContentMatchObjs[2].range(), [new Range(2, 18, 2, 22)]);
      assert.strictEqual(codeWebviewContentMatchObjs[0].cell?.id, codeCellMatch.id);
      assert.strictEqual(codeWebviewContentMatchObjs[1].cell?.id, codeCellMatch.id);
      assert.strictEqual(codeWebviewContentMatchObjs[2].cell?.id, codeCellMatch.id);
      assertRangesEqual(codeWebviewContentMatchObjs[0].range(), [new Range(1, 2, 1, 6)]);
      assertRangesEqual(codeWebviewContentMatchObjs[1].range(), [new Range(1, 8, 1, 12)]);
      assertRangesEqual(codeWebviewContentMatchObjs[2].range(), [new Range(1, 12, 1, 16)]);
    });
    function aFileMatch() {
      const rawMatch = {
        resource: URI.file("somepath" + ++counter),
        results: []
      };
      const searchModel = instantiationService.createInstance(SearchModelImpl);
      store.add(searchModel);
      const folderMatch = instantiationService.createInstance(FolderMatchImpl, URI.file("somepath"), "", 0, {
        type: QueryType.Text,
        folderQueries: [{ folder: createFileUriFromPathFromRoot() }],
        contentPattern: {
          pattern: ""
        }
      }, searchModel.searchResult.plainTextSearchResult, searchModel.searchResult, null);
      const fileMatch = instantiationService.createInstance(NotebookCompatibleFileMatch, {
        pattern: ""
      }, void 0, void 0, folderMatch, rawMatch, null, "");
      fileMatch.createMatches();
      store.add(folderMatch);
      store.add(fileMatch);
      return fileMatch;
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvdGVzdC9icm93c2VyL3NlYXJjaE5vdGVib29rSGVscGVycy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgRmluZE1hdGNoLCBJUmVhZG9ubHlUZXh0QnVmZmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJRmlsZU1hdGNoLCBJU2VhcmNoUmFuZ2UsIElUZXh0U2VhcmNoTWF0Y2gsIFF1ZXJ5VHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IElDZWxsVmlld01vZGVsIH0gZnJvbSAnLi4vLi4vLi4vbm90ZWJvb2svYnJvd3Nlci9ub3RlYm9va0Jyb3dzZXIuanMnO1xuaW1wb3J0IHsgQ2VsbEtpbmQgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9jb21tb24vbm90ZWJvb2tDb21tb24uanMnO1xuaW1wb3J0IHsgY29udGVudE1hdGNoZXNUb1RleHRTZWFyY2hNYXRjaGVzLCB3ZWJ2aWV3TWF0Y2hlc1RvVGV4dFNlYXJjaE1hdGNoZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL25vdGVib29rU2VhcmNoL3NlYXJjaE5vdGVib29rSGVscGVycy5qcyc7XG5pbXBvcnQgeyBDZWxsRmluZE1hdGNoTW9kZWwgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL2NvbnRyaWIvZmluZC9maW5kTW9kZWwuanMnO1xuaW1wb3J0IHsgU2VhcmNoTW9kZWxJbXBsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvc2VhcmNoTW9kZWwuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IGNyZWF0ZUZpbGVVcmlGcm9tUGF0aEZyb21Sb290LCBzdHViTW9kZWxTZXJ2aWNlLCBzdHViTm90ZWJvb2tFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi9zZWFyY2hUZXN0Q29tbW9uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0VkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IENlbGxNYXRjaCwgTm90ZWJvb2tDb21wYXRpYmxlRmlsZU1hdGNoLCB0ZXh0U2VhcmNoTWF0Y2hlc1RvTm90ZWJvb2tNYXRjaGVzIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ub3RlYm9va1NlYXJjaC9ub3RlYm9va1NlYXJjaE1vZGVsLmpzJztcbmltcG9ydCB7IEZvbGRlck1hdGNoSW1wbCB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VhcmNoVHJlZU1vZGVsL2ZvbGRlck1hdGNoLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0ZpbGVJbnN0YW5jZU1hdGNoIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9ub3RlYm9va1NlYXJjaC9ub3RlYm9va1NlYXJjaE1vZGVsQmFzZS5qcyc7XG5cbnN1aXRlKCdzZWFyY2hOb3RlYm9va0hlbHBlcnMnLCAoKSA9PiB7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgbWRDZWxsRmluZE1hdGNoOiBDZWxsRmluZE1hdGNoTW9kZWw7XG5cdGxldCBjb2RlQ2VsbEZpbmRNYXRjaDogQ2VsbEZpbmRNYXRjaE1vZGVsO1xuXHRsZXQgbWRJbnB1dENlbGw6IElDZWxsVmlld01vZGVsO1xuXHRsZXQgY29kZUNlbGw6IElDZWxsVmlld01vZGVsO1xuXG5cdGxldCBtYXJrZG93bkNvbnRlbnRSZXN1bHRzOiBJVGV4dFNlYXJjaE1hdGNoW107XG5cdGxldCBjb2RlQ29udGVudFJlc3VsdHM6IElUZXh0U2VhcmNoTWF0Y2hbXTtcblx0bGV0IGNvZGVXZWJ2aWV3UmVzdWx0czogSVRleHRTZWFyY2hNYXRjaFtdO1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHRsZXQgY291bnRlcjogbnVtYmVyID0gMDtcblx0c2V0dXAoKCkgPT4ge1xuXG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2UgPSBuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCk7XG5cdFx0c3RvcmUuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlbFNlcnZpY2UgPSBzdHViTW9kZWxTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAoZSkgPT4gc3RvcmUuYWRkKGUpKTtcblx0XHRjb25zdCBub3RlYm9va0VkaXRvclNlcnZpY2UgPSBzdHViTm90ZWJvb2tFZGl0b3JTZXJ2aWNlKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAoZSkgPT4gc3RvcmUuYWRkKGUpKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zdHViKElNb2RlbFNlcnZpY2UsIG1vZGVsU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTm90ZWJvb2tFZGl0b3JTZXJ2aWNlLCBub3RlYm9va0VkaXRvclNlcnZpY2UpO1xuXHRcdG1kSW5wdXRDZWxsID0ge1xuXHRcdFx0aWQ6ICdtZENlbGwnLFxuXHRcdFx0Y2VsbEtpbmQ6IENlbGxLaW5kLk1hcmt1cCwgdGV4dEJ1ZmZlcjogPElSZWFkb25seVRleHRCdWZmZXI+e1xuXHRcdFx0XHRnZXRMaW5lQ29udGVudChsaW5lTnVtYmVyOiBudW1iZXIpOiBzdHJpbmcge1xuXHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSAxKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gJyMgSGVsbG8gV29ybGQgVGVzdCc7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdHJldHVybiAnJztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGFzIElDZWxsVmlld01vZGVsO1xuXG5cdFx0Y29uc3QgZmluZE1hdGNoTWRzID0gW25ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDE1LCAxLCAxOSksIFsnVGVzdCddKV07XG5cdFx0Y29kZUNlbGwgPSB7XG5cdFx0XHRpZDogJ2NvZGVDZWxsJyxcblx0XHRcdGNlbGxLaW5kOiBDZWxsS2luZC5Db2RlLCB0ZXh0QnVmZmVyOiA8SVJlYWRvbmx5VGV4dEJ1ZmZlcj57XG5cdFx0XHRcdGdldExpbmVDb250ZW50KGxpbmVOdW1iZXI6IG51bWJlcik6IHN0cmluZyB7XG5cdFx0XHRcdFx0aWYgKGxpbmVOdW1iZXIgPT09IDEpIHtcblx0XHRcdFx0XHRcdHJldHVybiAncHJpbnQoXCJ0ZXN0ISB0ZXN0aW5nISFcIiknO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAobGluZU51bWJlciA9PT0gMikge1xuXHRcdFx0XHRcdFx0cmV0dXJuICdwcmludChcInRoaXMgaXMgYSBUZXN0XCIpJztcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0cmV0dXJuICcnO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0gYXMgSUNlbGxWaWV3TW9kZWw7XG5cdFx0Y29uc3QgZmluZE1hdGNoQ29kZUNlbGxzID1cblx0XHRcdFtuZXcgRmluZE1hdGNoKG5ldyBSYW5nZSgxLCA4LCAxLCAxMiksIFsndGVzdCddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDEsIDE0LCAxLCAxOCksIFsndGVzdCddKSxcblx0XHRcdG5ldyBGaW5kTWF0Y2gobmV3IFJhbmdlKDIsIDE4LCAyLCAyMiksIFsnVGVzdCddKVxuXHRcdFx0XTtcblxuXHRcdGNvbnN0IHdlYnZpZXdNYXRjaGVzID0gW3tcblx0XHRcdGluZGV4OiAwLFxuXHRcdFx0c2VhcmNoUHJldmlld0luZm86IHtcblx0XHRcdFx0bGluZTogJ3Rlc3QhIHRlc3RpbmchIScsXG5cdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0c3RhcnQ6IDEsXG5cdFx0XHRcdFx0ZW5kOiA1XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHtcblx0XHRcdGluZGV4OiAxLFxuXHRcdFx0c2VhcmNoUHJldmlld0luZm86IHtcblx0XHRcdFx0bGluZTogJ3Rlc3QhIHRlc3RpbmchIScsXG5cdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0c3RhcnQ6IDcsXG5cdFx0XHRcdFx0ZW5kOiAxMVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHR7XG5cdFx0XHRpbmRleDogMyxcblx0XHRcdHNlYXJjaFByZXZpZXdJbmZvOiB7XG5cdFx0XHRcdGxpbmU6ICd0aGlzIGlzIGEgVGVzdCcsXG5cdFx0XHRcdHJhbmdlOiB7XG5cdFx0XHRcdFx0c3RhcnQ6IDExLFxuXHRcdFx0XHRcdGVuZDogMTVcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdF07XG5cblxuXHRcdG1kQ2VsbEZpbmRNYXRjaCA9IG5ldyBDZWxsRmluZE1hdGNoTW9kZWwoXG5cdFx0XHRtZElucHV0Q2VsbCxcblx0XHRcdDAsXG5cdFx0XHRmaW5kTWF0Y2hNZHMsXG5cdFx0XHRbXSxcblx0XHQpO1xuXG5cdFx0Y29kZUNlbGxGaW5kTWF0Y2ggPSBuZXcgQ2VsbEZpbmRNYXRjaE1vZGVsKFxuXHRcdFx0Y29kZUNlbGwsXG5cdFx0XHQ1LFxuXHRcdFx0ZmluZE1hdGNoQ29kZUNlbGxzLFxuXHRcdFx0d2Vidmlld01hdGNoZXNcblx0XHQpO1xuXG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHN1aXRlKCdub3RlYm9va0VkaXRvck1hdGNoZXNUb1RleHRTZWFyY2hSZXN1bHRzJywgKCkgPT4ge1xuXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0UmFuZ2VzRXF1YWwoYWN0dWFsOiBJU2VhcmNoUmFuZ2UgfCBJU2VhcmNoUmFuZ2VbXSwgZXhwZWN0ZWQ6IElTZWFyY2hSYW5nZVtdKSB7XG5cdFx0XHRpZiAoIUFycmF5LmlzQXJyYXkoYWN0dWFsKSkge1xuXHRcdFx0XHRhY3R1YWwgPSBbYWN0dWFsXTtcblx0XHRcdH1cblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkLmxlbmd0aCk7XG5cdFx0XHRhY3R1YWwuZm9yRWFjaCgociwgaSkgPT4ge1xuXHRcdFx0XHRjb25zdCBleHBlY3RlZFJhbmdlID0gZXhwZWN0ZWRbaV07XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdFx0eyBzdGFydExpbmVOdW1iZXI6IHIuc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogci5zdGFydENvbHVtbiwgZW5kTGluZU51bWJlcjogci5lbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IHIuZW5kQ29sdW1uIH0sXG5cdFx0XHRcdFx0eyBzdGFydExpbmVOdW1iZXI6IGV4cGVjdGVkUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBzdGFydENvbHVtbjogZXhwZWN0ZWRSYW5nZS5zdGFydENvbHVtbiwgZW5kTGluZU51bWJlcjogZXhwZWN0ZWRSYW5nZS5lbmRMaW5lTnVtYmVyLCBlbmRDb2x1bW46IGV4cGVjdGVkUmFuZ2UuZW5kQ29sdW1uIH0pO1xuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0dGVzdCgnY29udmVydCBDZWxsRmluZE1hdGNoTW9kZWwgdG8gSVRleHRTZWFyY2hNYXRjaCBhbmQgY2hlY2sgcmVzdWx0cycsICgpID0+IHtcblx0XHRcdG1hcmtkb3duQ29udGVudFJlc3VsdHMgPSBjb250ZW50TWF0Y2hlc1RvVGV4dFNlYXJjaE1hdGNoZXMobWRDZWxsRmluZE1hdGNoLmNvbnRlbnRNYXRjaGVzLCBtZElucHV0Q2VsbCk7XG5cdFx0XHRjb2RlQ29udGVudFJlc3VsdHMgPSBjb250ZW50TWF0Y2hlc1RvVGV4dFNlYXJjaE1hdGNoZXMoY29kZUNlbGxGaW5kTWF0Y2guY29udGVudE1hdGNoZXMsIGNvZGVDZWxsKTtcblx0XHRcdGNvZGVXZWJ2aWV3UmVzdWx0cyA9IHdlYnZpZXdNYXRjaGVzVG9UZXh0U2VhcmNoTWF0Y2hlcyhjb2RlQ2VsbEZpbmRNYXRjaC53ZWJ2aWV3TWF0Y2hlcyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZG93bkNvbnRlbnRSZXN1bHRzLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobWFya2Rvd25Db250ZW50UmVzdWx0c1swXS5wcmV2aWV3VGV4dCwgJyMgSGVsbG8gV29ybGQgVGVzdFxcbicpO1xuXHRcdFx0YXNzZXJ0UmFuZ2VzRXF1YWwobWFya2Rvd25Db250ZW50UmVzdWx0c1swXS5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnByZXZpZXcpLCBbbmV3IFJhbmdlKDAsIDE0LCAwLCAxOCldKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKG1hcmtkb3duQ29udGVudFJlc3VsdHNbMF0ucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5zb3VyY2UpLCBbbmV3IFJhbmdlKDAsIDE0LCAwLCAxOCldKTtcblxuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29kZUNvbnRlbnRSZXN1bHRzLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29kZUNvbnRlbnRSZXN1bHRzWzBdLnByZXZpZXdUZXh0LCAncHJpbnQoXCJ0ZXN0ISB0ZXN0aW5nISFcIilcXG4nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2RlQ29udGVudFJlc3VsdHNbMV0ucHJldmlld1RleHQsICdwcmludChcInRoaXMgaXMgYSBUZXN0XCIpXFxuJyk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlQ29udGVudFJlc3VsdHNbMF0ucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5wcmV2aWV3KSwgW25ldyBSYW5nZSgwLCA3LCAwLCAxMSksIG5ldyBSYW5nZSgwLCAxMywgMCwgMTcpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlQ29udGVudFJlc3VsdHNbMF0ucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5zb3VyY2UpLCBbbmV3IFJhbmdlKDAsIDcsIDAsIDExKSwgbmV3IFJhbmdlKDAsIDEzLCAwLCAxNyldKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0cy5sZW5ndGgsIDMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1swXS5wcmV2aWV3VGV4dCwgJ3Rlc3QhIHRlc3RpbmchIScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1sxXS5wcmV2aWV3VGV4dCwgJ3Rlc3QhIHRlc3RpbmchIScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1syXS5wcmV2aWV3VGV4dCwgJ3RoaXMgaXMgYSBUZXN0Jyk7XG5cblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1swXS5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnByZXZpZXcpLCBbbmV3IFJhbmdlKDAsIDEsIDAsIDUpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlV2Vidmlld1Jlc3VsdHNbMV0ucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5wcmV2aWV3KSwgW25ldyBSYW5nZSgwLCA3LCAwLCAxMSldKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1syXS5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnByZXZpZXcpLCBbbmV3IFJhbmdlKDAsIDExLCAwLCAxNSldKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1swXS5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnNvdXJjZSksIFtuZXcgUmFuZ2UoMCwgMSwgMCwgNSldKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3UmVzdWx0c1sxXS5yYW5nZUxvY2F0aW9ucy5tYXAoZSA9PiBlLnNvdXJjZSksIFtuZXcgUmFuZ2UoMCwgNywgMCwgMTEpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlV2Vidmlld1Jlc3VsdHNbMl0ucmFuZ2VMb2NhdGlvbnMubWFwKGUgPT4gZS5zb3VyY2UpLCBbbmV3IFJhbmdlKDAsIDExLCAwLCAxNSldKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2NvbnZlcnQgSVRleHRTZWFyY2hNYXRjaCB0byBNYXRjaEluTm90ZWJvb2snLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBtZENlbGxNYXRjaCA9IG5ldyBDZWxsTWF0Y2goYUZpbGVNYXRjaCgpLCBtZElucHV0Q2VsbCwgMCk7XG5cdFx0XHRjb25zdCBtYXJrZG93bkNlbGxDb250ZW50TWF0Y2hPYmpzID0gdGV4dFNlYXJjaE1hdGNoZXNUb05vdGVib29rTWF0Y2hlcyhtYXJrZG93bkNvbnRlbnRSZXN1bHRzLCBtZENlbGxNYXRjaCk7XG5cblx0XHRcdGNvbnN0IGNvZGVDZWxsTWF0Y2ggPSBuZXcgQ2VsbE1hdGNoKGFGaWxlTWF0Y2goKSwgY29kZUNlbGwsIDApO1xuXHRcdFx0Y29uc3QgY29kZUNlbGxDb250ZW50TWF0Y2hPYmpzID0gdGV4dFNlYXJjaE1hdGNoZXNUb05vdGVib29rTWF0Y2hlcyhjb2RlQ29udGVudFJlc3VsdHMsIGNvZGVDZWxsTWF0Y2gpO1xuXHRcdFx0Y29uc3QgY29kZVdlYnZpZXdDb250ZW50TWF0Y2hPYmpzID0gdGV4dFNlYXJjaE1hdGNoZXNUb05vdGVib29rTWF0Y2hlcyhjb2RlV2Vidmlld1Jlc3VsdHMsIGNvZGVDZWxsTWF0Y2gpO1xuXG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtYXJrZG93bkNlbGxDb250ZW50TWF0Y2hPYmpzWzBdLmNlbGw/LmlkLCBtZENlbGxNYXRjaC5pZCk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChtYXJrZG93bkNlbGxDb250ZW50TWF0Y2hPYmpzWzBdLnJhbmdlKCksIFtuZXcgUmFuZ2UoMSwgMTUsIDEsIDE5KV0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29kZUNlbGxDb250ZW50TWF0Y2hPYmpzWzBdLmNlbGw/LmlkLCBjb2RlQ2VsbE1hdGNoLmlkKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2RlQ2VsbENvbnRlbnRNYXRjaE9ianNbMV0uY2VsbD8uaWQsIGNvZGVDZWxsTWF0Y2guaWQpO1xuXHRcdFx0YXNzZXJ0UmFuZ2VzRXF1YWwoY29kZUNlbGxDb250ZW50TWF0Y2hPYmpzWzBdLnJhbmdlKCksIFtuZXcgUmFuZ2UoMSwgOCwgMSwgMTIpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlQ2VsbENvbnRlbnRNYXRjaE9ianNbMV0ucmFuZ2UoKSwgW25ldyBSYW5nZSgxLCAxNCwgMSwgMTgpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlQ2VsbENvbnRlbnRNYXRjaE9ianNbMl0ucmFuZ2UoKSwgW25ldyBSYW5nZSgyLCAxOCwgMiwgMjIpXSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2RlV2Vidmlld0NvbnRlbnRNYXRjaE9ianNbMF0uY2VsbD8uaWQsIGNvZGVDZWxsTWF0Y2guaWQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvZGVXZWJ2aWV3Q29udGVudE1hdGNoT2Jqc1sxXS5jZWxsPy5pZCwgY29kZUNlbGxNYXRjaC5pZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29kZVdlYnZpZXdDb250ZW50TWF0Y2hPYmpzWzJdLmNlbGw/LmlkLCBjb2RlQ2VsbE1hdGNoLmlkKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3Q29udGVudE1hdGNoT2Jqc1swXS5yYW5nZSgpLCBbbmV3IFJhbmdlKDEsIDIsIDEsIDYpXSk7XG5cdFx0XHRhc3NlcnRSYW5nZXNFcXVhbChjb2RlV2Vidmlld0NvbnRlbnRNYXRjaE9ianNbMV0ucmFuZ2UoKSwgW25ldyBSYW5nZSgxLCA4LCAxLCAxMildKTtcblx0XHRcdGFzc2VydFJhbmdlc0VxdWFsKGNvZGVXZWJ2aWV3Q29udGVudE1hdGNoT2Jqc1syXS5yYW5nZSgpLCBbbmV3IFJhbmdlKDEsIDEyLCAxLCAxNildKTtcblxuXHRcdH0pO1xuXG5cblx0XHRmdW5jdGlvbiBhRmlsZU1hdGNoKCk6IElOb3RlYm9va0ZpbGVJbnN0YW5jZU1hdGNoIHtcblx0XHRcdGNvbnN0IHJhd01hdGNoOiBJRmlsZU1hdGNoID0ge1xuXHRcdFx0XHRyZXNvdXJjZTogVVJJLmZpbGUoJ3NvbWVwYXRoJyArICsrY291bnRlciksXG5cdFx0XHRcdHJlc3VsdHM6IFtdXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBzZWFyY2hNb2RlbCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFNlYXJjaE1vZGVsSW1wbCk7XG5cdFx0XHRzdG9yZS5hZGQoc2VhcmNoTW9kZWwpO1xuXHRcdFx0Y29uc3QgZm9sZGVyTWF0Y2ggPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShGb2xkZXJNYXRjaEltcGwsIFVSSS5maWxlKCdzb21lcGF0aCcpLCAnJywgMCwge1xuXHRcdFx0XHR0eXBlOiBRdWVyeVR5cGUuVGV4dCwgZm9sZGVyUXVlcmllczogW3sgZm9sZGVyOiBjcmVhdGVGaWxlVXJpRnJvbVBhdGhGcm9tUm9vdCgpIH1dLCBjb250ZW50UGF0dGVybjoge1xuXHRcdFx0XHRcdHBhdHRlcm46ICcnXG5cdFx0XHRcdH1cblx0XHRcdH0sIHNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdC5wbGFpblRleHRTZWFyY2hSZXN1bHQsIHNlYXJjaE1vZGVsLnNlYXJjaFJlc3VsdCwgbnVsbCk7XG5cdFx0XHRjb25zdCBmaWxlTWF0Y2ggPSBpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShOb3RlYm9va0NvbXBhdGlibGVGaWxlTWF0Y2gsIHtcblx0XHRcdFx0cGF0dGVybjogJydcblx0XHRcdH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBmb2xkZXJNYXRjaCwgcmF3TWF0Y2gsIG51bGwsICcnKTtcblx0XHRcdGZpbGVNYXRjaC5jcmVhdGVNYXRjaGVzKCk7XG5cdFx0XHRzdG9yZS5hZGQoZm9sZGVyTWF0Y2gpO1xuXHRcdFx0c3RvcmUuYWRkKGZpbGVNYXRjaCk7XG5cblx0XHRcdHJldHVybiBmaWxlTWF0Y2g7XG5cdFx0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
