import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { Mimes } from "../../../../../base/common/mime.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { CellKind, CellUri, diff, MimeTypeDisplayOrder, NotebookWorkingCopyTypeIdentifier } from "../../common/notebookCommon.js";
import { cellIndexesToRanges, cellRangesToIndexes, reduceCellRanges } from "../../common/notebookRange.js";
import { setupInstantiationService, TestCell } from "./testNotebookEditor.js";
suite("NotebookCommon", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  let disposables;
  let instantiationService;
  let languageService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = setupInstantiationService(disposables);
    languageService = instantiationService.get(ILanguageService);
  });
  test("sortMimeTypes default orders", function() {
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder().sort(
        [
          "application/json",
          "application/javascript",
          "text/html",
          "image/svg+xml",
          Mimes.latex,
          Mimes.markdown,
          "image/png",
          "image/jpeg",
          Mimes.text
        ]
      ),
      [
        "application/json",
        "application/javascript",
        "text/html",
        "image/svg+xml",
        Mimes.latex,
        Mimes.markdown,
        "image/png",
        "image/jpeg",
        Mimes.text
      ]
    );
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder().sort(
        [
          "application/json",
          Mimes.latex,
          Mimes.markdown,
          "application/javascript",
          "text/html",
          Mimes.text,
          "image/png",
          "image/jpeg",
          "image/svg+xml"
        ]
      ),
      [
        "application/json",
        "application/javascript",
        "text/html",
        "image/svg+xml",
        Mimes.latex,
        Mimes.markdown,
        "image/png",
        "image/jpeg",
        Mimes.text
      ]
    );
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder().sort(
        [
          Mimes.markdown,
          "application/json",
          Mimes.text,
          "image/jpeg",
          "application/javascript",
          "text/html",
          "image/png",
          "image/svg+xml"
        ]
      ),
      [
        "application/json",
        "application/javascript",
        "text/html",
        "image/svg+xml",
        Mimes.markdown,
        "image/png",
        "image/jpeg",
        Mimes.text
      ]
    );
    disposables.dispose();
  });
  test("sortMimeTypes user orders", function() {
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder([
        "image/png",
        Mimes.text,
        Mimes.markdown,
        "text/html",
        "application/json"
      ]).sort(
        [
          "application/json",
          "application/javascript",
          "text/html",
          "image/svg+xml",
          Mimes.markdown,
          "image/png",
          "image/jpeg",
          Mimes.text
        ]
      ),
      [
        "image/png",
        Mimes.text,
        Mimes.markdown,
        "text/html",
        "application/json",
        "application/javascript",
        "image/svg+xml",
        "image/jpeg"
      ]
    );
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder([
        "application/json",
        "text/html",
        "text/html",
        Mimes.markdown,
        "application/json"
      ]).sort([
        Mimes.markdown,
        "application/json",
        Mimes.text,
        "application/javascript",
        "text/html",
        "image/svg+xml",
        "image/jpeg",
        "image/png"
      ]),
      [
        "application/json",
        "text/html",
        Mimes.markdown,
        "application/javascript",
        "image/svg+xml",
        "image/png",
        "image/jpeg",
        Mimes.text
      ]
    );
    disposables.dispose();
  });
  test("prioritizes mimetypes", () => {
    const m = new MimeTypeDisplayOrder([
      Mimes.markdown,
      "text/html",
      "application/json"
    ]);
    assert.deepStrictEqual(m.toArray(), [Mimes.markdown, "text/html", "application/json"]);
    m.prioritize("text/html", ["application/json"]);
    assert.deepStrictEqual(m.toArray(), [Mimes.markdown, "text/html", "application/json"]);
    m.prioritize("text/html", ["application/json", Mimes.markdown]);
    assert.deepStrictEqual(m.toArray(), ["text/html", Mimes.markdown, "application/json"]);
    m.prioritize("text/plain", ["application/json", Mimes.markdown]);
    assert.deepStrictEqual(m.toArray(), ["text/plain", "text/html", Mimes.markdown, "application/json"]);
    m.prioritize(Mimes.markdown, ["text/plain", "application/json", Mimes.markdown]);
    assert.deepStrictEqual(m.toArray(), ["text/html", Mimes.markdown, "text/plain", "application/json"]);
    m.prioritize("text/plain", ["text/plain", "text/html", Mimes.markdown]);
    assert.deepStrictEqual(m.toArray(), ["text/plain", "text/html", Mimes.markdown, "application/json"]);
    const m2 = new MimeTypeDisplayOrder(["a", "b"]);
    m2.prioritize("b", ["a", "b", "a", "q"]);
    assert.deepStrictEqual(m2.toArray(), ["b", "a"]);
    disposables.dispose();
  });
  test("sortMimeTypes glob", function() {
    assert.deepStrictEqual(
      new MimeTypeDisplayOrder([
        "application/vnd-vega*",
        Mimes.markdown,
        "text/html",
        "application/json"
      ]).sort(
        [
          "application/json",
          "application/javascript",
          "text/html",
          "application/vnd-plot.json",
          "application/vnd-vega.json"
        ]
      ),
      [
        "application/vnd-vega.json",
        "text/html",
        "application/json",
        "application/vnd-plot.json",
        "application/javascript"
      ],
      "glob *"
    );
    disposables.dispose();
  });
  test("diff cells", function() {
    const cells = [];
    for (let i = 0; i < 5; i++) {
      cells.push(
        disposables.add(new TestCell("notebook", i, `var a = ${i};`, "javascript", CellKind.Code, [], languageService))
      );
    }
    assert.deepStrictEqual(
      diff(cells, [], (cell) => {
        return cells.indexOf(cell) > -1;
      }),
      [
        {
          start: 0,
          deleteCount: 5,
          toInsert: []
        }
      ]
    );
    assert.deepStrictEqual(
      diff([], cells, (cell) => {
        return false;
      }),
      [
        {
          start: 0,
          deleteCount: 0,
          toInsert: cells
        }
      ]
    );
    const cellA = disposables.add(new TestCell("notebook", 6, "var a = 6;", "javascript", CellKind.Code, [], languageService));
    const cellB = disposables.add(new TestCell("notebook", 7, "var a = 7;", "javascript", CellKind.Code, [], languageService));
    const modifiedCells = [
      cells[0],
      cells[1],
      cellA,
      cells[3],
      cellB,
      cells[4]
    ];
    const splices = diff(cells, modifiedCells, (cell) => {
      return cells.indexOf(cell) > -1;
    });
    assert.deepStrictEqual(
      splices,
      [
        {
          start: 2,
          deleteCount: 1,
          toInsert: [cellA]
        },
        {
          start: 4,
          deleteCount: 0,
          toInsert: [cellB]
        }
      ]
    );
    disposables.dispose();
  });
});
suite("CellUri", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("parse, generate (file-scheme)", function() {
    const nb = URI.parse("file:///bar/f\xF8lder/file.nb");
    const id = 17;
    const data = CellUri.generate(nb, id);
    const actual = CellUri.parse(data);
    assert.ok(Boolean(actual));
    assert.strictEqual(actual?.handle, id);
    assert.strictEqual(actual?.notebook.toString(), nb.toString());
  });
  test("parse, generate (foo-scheme)", function() {
    const nb = URI.parse("foo:///bar/f\xF8lder/file.nb");
    const id = 17;
    const data = CellUri.generate(nb, id);
    const actual = CellUri.parse(data);
    assert.ok(Boolean(actual));
    assert.strictEqual(actual?.handle, id);
    assert.strictEqual(actual?.notebook.toString(), nb.toString());
  });
  test("stable order", function() {
    const nb = URI.parse("foo:///bar/f\xF8lder/file.nb");
    const handles = [1, 2, 9, 10, 88, 100, 666666, 7777777];
    const uris = handles.map((h) => CellUri.generate(nb, h)).sort();
    const strUris = uris.map(String).sort();
    const parsedUris = strUris.map((s) => URI.parse(s));
    const actual = parsedUris.map((u) => CellUri.parse(u)?.handle);
    assert.deepStrictEqual(actual, handles);
  });
});
suite("CellRange", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Cell range to index", function() {
    assert.deepStrictEqual(cellRangesToIndexes([]), []);
    assert.deepStrictEqual(cellRangesToIndexes([{ start: 0, end: 0 }]), []);
    assert.deepStrictEqual(cellRangesToIndexes([{ start: 0, end: 1 }]), [0]);
    assert.deepStrictEqual(cellRangesToIndexes([{ start: 0, end: 2 }]), [0, 1]);
    assert.deepStrictEqual(cellRangesToIndexes([{ start: 0, end: 2 }, { start: 2, end: 3 }]), [0, 1, 2]);
    assert.deepStrictEqual(cellRangesToIndexes([{ start: 0, end: 2 }, { start: 3, end: 4 }]), [0, 1, 3]);
  });
  test("Cell index to range", function() {
    assert.deepStrictEqual(cellIndexesToRanges([]), []);
    assert.deepStrictEqual(cellIndexesToRanges([0]), [{ start: 0, end: 1 }]);
    assert.deepStrictEqual(cellIndexesToRanges([0, 1]), [{ start: 0, end: 2 }]);
    assert.deepStrictEqual(cellIndexesToRanges([0, 1, 2]), [{ start: 0, end: 3 }]);
    assert.deepStrictEqual(cellIndexesToRanges([0, 1, 3]), [{ start: 0, end: 2 }, { start: 3, end: 4 }]);
    assert.deepStrictEqual(cellIndexesToRanges([1, 0]), [{ start: 0, end: 2 }]);
    assert.deepStrictEqual(cellIndexesToRanges([1, 2, 0]), [{ start: 0, end: 3 }]);
    assert.deepStrictEqual(cellIndexesToRanges([3, 1, 0]), [{ start: 0, end: 2 }, { start: 3, end: 4 }]);
    assert.deepStrictEqual(cellIndexesToRanges([9, 10]), [{ start: 9, end: 11 }]);
    assert.deepStrictEqual(cellIndexesToRanges([10, 9]), [{ start: 9, end: 11 }]);
  });
  test("Reduce ranges", function() {
    assert.deepStrictEqual(reduceCellRanges([{ start: 0, end: 1 }, { start: 1, end: 2 }]), [{ start: 0, end: 2 }]);
    assert.deepStrictEqual(reduceCellRanges([{ start: 0, end: 2 }, { start: 1, end: 3 }]), [{ start: 0, end: 3 }]);
    assert.deepStrictEqual(reduceCellRanges([{ start: 1, end: 3 }, { start: 0, end: 2 }]), [{ start: 0, end: 3 }]);
    assert.deepStrictEqual(reduceCellRanges([{ start: 0, end: 2 }, { start: 4, end: 5 }]), [{ start: 0, end: 2 }, { start: 4, end: 5 }]);
    assert.deepStrictEqual(reduceCellRanges([
      { start: 0, end: 1 },
      { start: 1, end: 2 },
      { start: 4, end: 6 }
    ]), [
      { start: 0, end: 2 },
      { start: 4, end: 6 }
    ]);
    assert.deepStrictEqual(reduceCellRanges([
      { start: 0, end: 1 },
      { start: 1, end: 3 },
      { start: 3, end: 4 }
    ]), [
      { start: 0, end: 4 }
    ]);
  });
  test("Reduce ranges 2, empty ranges", function() {
    assert.deepStrictEqual(reduceCellRanges([{ start: 0, end: 0 }, { start: 0, end: 0 }]), [{ start: 0, end: 0 }]);
    assert.deepStrictEqual(reduceCellRanges([{ start: 0, end: 0 }, { start: 1, end: 2 }]), [{ start: 1, end: 2 }]);
    assert.deepStrictEqual(reduceCellRanges([{ start: 2, end: 2 }]), [{ start: 2, end: 2 }]);
  });
});
suite("NotebookWorkingCopyTypeIdentifier", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("supports notebook type only", function() {
    const viewType = "testViewType";
    const type = NotebookWorkingCopyTypeIdentifier.create(viewType);
    assert.deepEqual(NotebookWorkingCopyTypeIdentifier.parse(type), { notebookType: viewType, viewType });
    assert.strictEqual(NotebookWorkingCopyTypeIdentifier.parse("something"), void 0);
  });
  test("supports different viewtype", function() {
    const notebookType = { notebookType: "testNotebookType", viewType: "testViewType" };
    const type = NotebookWorkingCopyTypeIdentifier.create(notebookType.notebookType, notebookType.viewType);
    assert.deepEqual(NotebookWorkingCopyTypeIdentifier.parse(type), notebookType);
    assert.strictEqual(NotebookWorkingCopyTypeIdentifier.parse("something"), void 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tDb21tb24udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBNaW1lcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21pbWUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IENlbGxLaW5kLCBDZWxsVXJpLCBkaWZmLCBNaW1lVHlwZURpc3BsYXlPcmRlciwgTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IGNlbGxJbmRleGVzVG9SYW5nZXMsIGNlbGxSYW5nZXNUb0luZGV4ZXMsIHJlZHVjZUNlbGxSYW5nZXMgfSBmcm9tICcuLi8uLi9jb21tb24vbm90ZWJvb2tSYW5nZS5qcyc7XG5pbXBvcnQgeyBzZXR1cEluc3RhbnRpYXRpb25TZXJ2aWNlLCBUZXN0Q2VsbCB9IGZyb20gJy4vdGVzdE5vdGVib29rRWRpdG9yLmpzJztcblxuc3VpdGUoJ05vdGVib29rQ29tbW9uJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gc2V0dXBJbnN0YW50aWF0aW9uU2VydmljZShkaXNwb3NhYmxlcyk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0TWltZVR5cGVzIGRlZmF1bHQgb3JkZXJzJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobmV3IE1pbWVUeXBlRGlzcGxheU9yZGVyKCkuc29ydChcblx0XHRcdFtcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQnaW1hZ2Uvc3ZnK3htbCcsXG5cdFx0XHRcdE1pbWVzLmxhdGV4LFxuXHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0TWltZXMudGV4dFxuXHRcdFx0XSksXG5cdFx0XHRbXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XHQndGV4dC9odG1sJyxcblx0XHRcdFx0J2ltYWdlL3N2Zyt4bWwnLFxuXHRcdFx0XHRNaW1lcy5sYXRleCxcblx0XHRcdFx0TWltZXMubWFya2Rvd24sXG5cdFx0XHRcdCdpbWFnZS9wbmcnLFxuXHRcdFx0XHQnaW1hZ2UvanBlZycsXG5cdFx0XHRcdE1pbWVzLnRleHRcblx0XHRcdF1cblx0XHQpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChuZXcgTWltZVR5cGVEaXNwbGF5T3JkZXIoKS5zb3J0KFxuXHRcdFx0W1xuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdE1pbWVzLmxhdGV4LFxuXHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XHQndGV4dC9odG1sJyxcblx0XHRcdFx0TWltZXMudGV4dCxcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0J2ltYWdlL3N2Zyt4bWwnXG5cdFx0XHRdKSxcblx0XHRcdFtcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2pzb24nLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQnaW1hZ2Uvc3ZnK3htbCcsXG5cdFx0XHRcdE1pbWVzLmxhdGV4LFxuXHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0TWltZXMudGV4dFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG5ldyBNaW1lVHlwZURpc3BsYXlPcmRlcigpLnNvcnQoXG5cdFx0XHRbXG5cdFx0XHRcdE1pbWVzLm1hcmtkb3duLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdE1pbWVzLnRleHQsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XHQndGV4dC9odG1sJyxcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9zdmcreG1sJ1xuXHRcdFx0XSksXG5cdFx0XHRbXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XHQndGV4dC9odG1sJyxcblx0XHRcdFx0J2ltYWdlL3N2Zyt4bWwnLFxuXHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0TWltZXMudGV4dFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cblxuXHR0ZXN0KCdzb3J0TWltZVR5cGVzIHVzZXIgb3JkZXJzJywgZnVuY3Rpb24gKCkge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRuZXcgTWltZVR5cGVEaXNwbGF5T3JkZXIoW1xuXHRcdFx0XHQnaW1hZ2UvcG5nJyxcblx0XHRcdFx0TWltZXMudGV4dCxcblx0XHRcdFx0TWltZXMubWFya2Rvd24sXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbidcblx0XHRcdF0pLnNvcnQoXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHRcdCdpbWFnZS9zdmcreG1sJyxcblx0XHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0XHQnaW1hZ2UvcG5nJyxcblx0XHRcdFx0XHQnaW1hZ2UvanBlZycsXG5cdFx0XHRcdFx0TWltZXMudGV4dFxuXHRcdFx0XHRdXG5cdFx0XHQpLFxuXHRcdFx0W1xuXHRcdFx0XHQnaW1hZ2UvcG5nJyxcblx0XHRcdFx0TWltZXMudGV4dCxcblx0XHRcdFx0TWltZXMubWFya2Rvd24sXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Jyxcblx0XHRcdFx0J2ltYWdlL3N2Zyt4bWwnLFxuXHRcdFx0XHQnaW1hZ2UvanBlZycsXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRuZXcgTWltZVR5cGVEaXNwbGF5T3JkZXIoW1xuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQndGV4dC9odG1sJyxcblx0XHRcdFx0TWltZXMubWFya2Rvd24sXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0XSkuc29ydChbXG5cdFx0XHRcdE1pbWVzLm1hcmtkb3duLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdE1pbWVzLnRleHQsXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qYXZhc2NyaXB0Jyxcblx0XHRcdFx0J3RleHQvaHRtbCcsXG5cdFx0XHRcdCdpbWFnZS9zdmcreG1sJyxcblx0XHRcdFx0J2ltYWdlL2pwZWcnLFxuXHRcdFx0XHQnaW1hZ2UvcG5nJ1xuXHRcdFx0XSksXG5cdFx0XHRbXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0J3RleHQvaHRtbCcsXG5cdFx0XHRcdE1pbWVzLm1hcmtkb3duLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG5cdFx0XHRcdCdpbWFnZS9zdmcreG1sJyxcblx0XHRcdFx0J2ltYWdlL3BuZycsXG5cdFx0XHRcdCdpbWFnZS9qcGVnJyxcblx0XHRcdFx0TWltZXMudGV4dFxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByaW9yaXRpemVzIG1pbWV0eXBlcycsICgpID0+IHtcblx0XHRjb25zdCBtID0gbmV3IE1pbWVUeXBlRGlzcGxheU9yZGVyKFtcblx0XHRcdE1pbWVzLm1hcmtkb3duLFxuXHRcdFx0J3RleHQvaHRtbCcsXG5cdFx0XHQnYXBwbGljYXRpb24vanNvbidcblx0XHRdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udG9BcnJheSgpLCBbTWltZXMubWFya2Rvd24sICd0ZXh0L2h0bWwnLCAnYXBwbGljYXRpb24vanNvbiddKTtcblxuXHRcdC8vIG5vLW9wIGlmIGFscmVhZHkgaW4gdGhlIHJpZ2h0IG9yZGVyXG5cdFx0bS5wcmlvcml0aXplKCd0ZXh0L2h0bWwnLCBbJ2FwcGxpY2F0aW9uL2pzb24nXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnRvQXJyYXkoKSwgW01pbWVzLm1hcmtkb3duLCAndGV4dC9odG1sJywgJ2FwcGxpY2F0aW9uL2pzb24nXSk7XG5cblx0XHQvLyBzb3J0cyB0byBoaWdoZXN0IHByaW9yaXR5XG5cdFx0bS5wcmlvcml0aXplKCd0ZXh0L2h0bWwnLCBbJ2FwcGxpY2F0aW9uL2pzb24nLCBNaW1lcy5tYXJrZG93bl0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS50b0FycmF5KCksIFsndGV4dC9odG1sJywgTWltZXMubWFya2Rvd24sICdhcHBsaWNhdGlvbi9qc29uJ10pO1xuXG5cdFx0Ly8gYWRkcyBpbiBuZXcgdHlwZVxuXHRcdG0ucHJpb3JpdGl6ZSgndGV4dC9wbGFpbicsIFsnYXBwbGljYXRpb24vanNvbicsIE1pbWVzLm1hcmtkb3duXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtLnRvQXJyYXkoKSwgWyd0ZXh0L3BsYWluJywgJ3RleHQvaHRtbCcsIE1pbWVzLm1hcmtkb3duLCAnYXBwbGljYXRpb24vanNvbiddKTtcblxuXHRcdC8vIG1vdmVzIG11bHRpcGxlLCBwcmVzZXJ2ZXMgb3JkZXJcblx0XHRtLnByaW9yaXRpemUoTWltZXMubWFya2Rvd24sIFsndGV4dC9wbGFpbicsICdhcHBsaWNhdGlvbi9qc29uJywgTWltZXMubWFya2Rvd25dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG0udG9BcnJheSgpLCBbJ3RleHQvaHRtbCcsIE1pbWVzLm1hcmtkb3duLCAndGV4dC9wbGFpbicsICdhcHBsaWNhdGlvbi9qc29uJ10pO1xuXG5cdFx0Ly8gZGVsZXRlcyBtdWx0aXBsZVxuXHRcdG0ucHJpb3JpdGl6ZSgndGV4dC9wbGFpbicsIFsndGV4dC9wbGFpbicsICd0ZXh0L2h0bWwnLCBNaW1lcy5tYXJrZG93bl0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobS50b0FycmF5KCksIFsndGV4dC9wbGFpbicsICd0ZXh0L2h0bWwnLCBNaW1lcy5tYXJrZG93biwgJ2FwcGxpY2F0aW9uL2pzb24nXSk7XG5cblx0XHQvLyBoYW5kbGVzIG11bHRpcGxlIG1pbWV0eXBlcywgdW5rbm93biBtaW1ldHlwZVxuXHRcdGNvbnN0IG0yID0gbmV3IE1pbWVUeXBlRGlzcGxheU9yZGVyKFsnYScsICdiJ10pO1xuXHRcdG0yLnByaW9yaXRpemUoJ2InLCBbJ2EnLCAnYicsICdhJywgJ3EnXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtMi50b0FycmF5KCksIFsnYicsICdhJ10pO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdzb3J0TWltZVR5cGVzIGdsb2InLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdG5ldyBNaW1lVHlwZURpc3BsYXlPcmRlcihbXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi92bmQtdmVnYSonLFxuXHRcdFx0XHRNaW1lcy5tYXJrZG93bixcblx0XHRcdFx0J3RleHQvaHRtbCcsXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJ1xuXHRcdFx0XSkuc29ydChcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCdhcHBsaWNhdGlvbi9qc29uJyxcblx0XHRcdFx0XHQnYXBwbGljYXRpb24vamF2YXNjcmlwdCcsXG5cdFx0XHRcdFx0J3RleHQvaHRtbCcsXG5cdFx0XHRcdFx0J2FwcGxpY2F0aW9uL3ZuZC1wbG90Lmpzb24nLFxuXHRcdFx0XHRcdCdhcHBsaWNhdGlvbi92bmQtdmVnYS5qc29uJ1xuXHRcdFx0XHRdXG5cdFx0XHQpLFxuXHRcdFx0W1xuXHRcdFx0XHQnYXBwbGljYXRpb24vdm5kLXZlZ2EuanNvbicsXG5cdFx0XHRcdCd0ZXh0L2h0bWwnLFxuXHRcdFx0XHQnYXBwbGljYXRpb24vanNvbicsXG5cdFx0XHRcdCdhcHBsaWNhdGlvbi92bmQtcGxvdC5qc29uJyxcblx0XHRcdFx0J2FwcGxpY2F0aW9uL2phdmFzY3JpcHQnLFxuXHRcdFx0XSxcblx0XHRcdCdnbG9iIConXG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZGlmZiBjZWxscycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjZWxsczogVGVzdENlbGxbXSA9IFtdO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCA1OyBpKyspIHtcblx0XHRcdGNlbGxzLnB1c2goXG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdENlbGwoJ25vdGVib29rJywgaSwgYHZhciBhID0gJHtpfTtgLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGRpZmY8VGVzdENlbGw+KGNlbGxzLCBbXSwgKGNlbGwpID0+IHtcblx0XHRcdHJldHVybiBjZWxscy5pbmRleE9mKGNlbGwpID4gLTE7XG5cdFx0fSksIFtcblx0XHRcdHtcblx0XHRcdFx0c3RhcnQ6IDAsXG5cdFx0XHRcdGRlbGV0ZUNvdW50OiA1LFxuXHRcdFx0XHR0b0luc2VydDogW11cblx0XHRcdH1cblx0XHRdXG5cdFx0KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZGlmZjxUZXN0Q2VsbD4oW10sIGNlbGxzLCAoY2VsbCkgPT4ge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH0pLCBbXG5cdFx0XHR7XG5cdFx0XHRcdHN0YXJ0OiAwLFxuXHRcdFx0XHRkZWxldGVDb3VudDogMCxcblx0XHRcdFx0dG9JbnNlcnQ6IGNlbGxzXG5cdFx0XHR9XG5cdFx0XVxuXHRcdCk7XG5cblx0XHRjb25zdCBjZWxsQSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdENlbGwoJ25vdGVib29rJywgNiwgJ3ZhciBhID0gNjsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKTtcblx0XHRjb25zdCBjZWxsQiA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdENlbGwoJ25vdGVib29rJywgNywgJ3ZhciBhID0gNzsnLCAnamF2YXNjcmlwdCcsIENlbGxLaW5kLkNvZGUsIFtdLCBsYW5ndWFnZVNlcnZpY2UpKTtcblxuXHRcdGNvbnN0IG1vZGlmaWVkQ2VsbHMgPSBbXG5cdFx0XHRjZWxsc1swXSxcblx0XHRcdGNlbGxzWzFdLFxuXHRcdFx0Y2VsbEEsXG5cdFx0XHRjZWxsc1szXSxcblx0XHRcdGNlbGxCLFxuXHRcdFx0Y2VsbHNbNF1cblx0XHRdO1xuXG5cdFx0Y29uc3Qgc3BsaWNlcyA9IGRpZmY8VGVzdENlbGw+KGNlbGxzLCBtb2RpZmllZENlbGxzLCAoY2VsbCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNlbGxzLmluZGV4T2YoY2VsbCkgPiAtMTtcblx0XHR9KTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc3BsaWNlcyxcblx0XHRcdFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHN0YXJ0OiAyLFxuXHRcdFx0XHRcdGRlbGV0ZUNvdW50OiAxLFxuXHRcdFx0XHRcdHRvSW5zZXJ0OiBbY2VsbEFdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRzdGFydDogNCxcblx0XHRcdFx0XHRkZWxldGVDb3VudDogMCxcblx0XHRcdFx0XHR0b0luc2VydDogW2NlbGxCXVxuXHRcdFx0XHR9XG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cbn0pO1xuXG5cbnN1aXRlKCdDZWxsVXJpJywgZnVuY3Rpb24gKCkge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3BhcnNlLCBnZW5lcmF0ZSAoZmlsZS1zY2hlbWUpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbmIgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vYmFyL2ZcdTAwRjhsZGVyL2ZpbGUubmInKTtcblx0XHRjb25zdCBpZCA9IDE3O1xuXG5cdFx0Y29uc3QgZGF0YSA9IENlbGxVcmkuZ2VuZXJhdGUobmIsIGlkKTtcblx0XHRjb25zdCBhY3R1YWwgPSBDZWxsVXJpLnBhcnNlKGRhdGEpO1xuXHRcdGFzc2VydC5vayhCb29sZWFuKGFjdHVhbCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWw/LmhhbmRsZSwgaWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWw/Lm5vdGVib29rLnRvU3RyaW5nKCksIG5iLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdwYXJzZSwgZ2VuZXJhdGUgKGZvby1zY2hlbWUpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbmIgPSBVUkkucGFyc2UoJ2ZvbzovLy9iYXIvZlx1MDBGOGxkZXIvZmlsZS5uYicpO1xuXHRcdGNvbnN0IGlkID0gMTc7XG5cblx0XHRjb25zdCBkYXRhID0gQ2VsbFVyaS5nZW5lcmF0ZShuYiwgaWQpO1xuXHRcdGNvbnN0IGFjdHVhbCA9IENlbGxVcmkucGFyc2UoZGF0YSk7XG5cdFx0YXNzZXJ0Lm9rKEJvb2xlYW4oYWN0dWFsKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbD8uaGFuZGxlLCBpZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbD8ubm90ZWJvb2sudG9TdHJpbmcoKSwgbmIudG9TdHJpbmcoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3N0YWJsZSBvcmRlcicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IG5iID0gVVJJLnBhcnNlKCdmb286Ly8vYmFyL2ZcdTAwRjhsZGVyL2ZpbGUubmInKTtcblx0XHRjb25zdCBoYW5kbGVzID0gWzEsIDIsIDksIDEwLCA4OCwgMTAwLCA2NjY2NjYsIDc3Nzc3NzddO1xuXG5cdFx0Y29uc3QgdXJpcyA9IGhhbmRsZXMubWFwKGggPT4gQ2VsbFVyaS5nZW5lcmF0ZShuYiwgaCkpLnNvcnQoKTtcblxuXHRcdGNvbnN0IHN0clVyaXMgPSB1cmlzLm1hcChTdHJpbmcpLnNvcnQoKTtcblx0XHRjb25zdCBwYXJzZWRVcmlzID0gc3RyVXJpcy5tYXAocyA9PiBVUkkucGFyc2UocykpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcGFyc2VkVXJpcy5tYXAodSA9PiBDZWxsVXJpLnBhcnNlKHUpPy5oYW5kbGUpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGhhbmRsZXMpO1xuXHR9KTtcbn0pO1xuXG5cbnN1aXRlKCdDZWxsUmFuZ2UnLCBmdW5jdGlvbiAoKSB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnQ2VsbCByYW5nZSB0byBpbmRleCcsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxSYW5nZXNUb0luZGV4ZXMoW10pLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsUmFuZ2VzVG9JbmRleGVzKFt7IHN0YXJ0OiAwLCBlbmQ6IDAgfV0pLCBbXSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsUmFuZ2VzVG9JbmRleGVzKFt7IHN0YXJ0OiAwLCBlbmQ6IDEgfV0pLCBbMF0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbFJhbmdlc1RvSW5kZXhlcyhbeyBzdGFydDogMCwgZW5kOiAyIH1dKSwgWzAsIDFdKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxSYW5nZXNUb0luZGV4ZXMoW3sgc3RhcnQ6IDAsIGVuZDogMiB9LCB7IHN0YXJ0OiAyLCBlbmQ6IDMgfV0pLCBbMCwgMSwgMl0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbFJhbmdlc1RvSW5kZXhlcyhbeyBzdGFydDogMCwgZW5kOiAyIH0sIHsgc3RhcnQ6IDMsIGVuZDogNCB9XSksIFswLCAxLCAzXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NlbGwgaW5kZXggdG8gcmFuZ2UnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsSW5kZXhlc1RvUmFuZ2VzKFtdKSwgW10pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbEluZGV4ZXNUb1JhbmdlcyhbMF0pLCBbeyBzdGFydDogMCwgZW5kOiAxIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxJbmRleGVzVG9SYW5nZXMoWzAsIDFdKSwgW3sgc3RhcnQ6IDAsIGVuZDogMiB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsSW5kZXhlc1RvUmFuZ2VzKFswLCAxLCAyXSksIFt7IHN0YXJ0OiAwLCBlbmQ6IDMgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbEluZGV4ZXNUb1JhbmdlcyhbMCwgMSwgM10pLCBbeyBzdGFydDogMCwgZW5kOiAyIH0sIHsgc3RhcnQ6IDMsIGVuZDogNCB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxJbmRleGVzVG9SYW5nZXMoWzEsIDBdKSwgW3sgc3RhcnQ6IDAsIGVuZDogMiB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjZWxsSW5kZXhlc1RvUmFuZ2VzKFsxLCAyLCAwXSksIFt7IHN0YXJ0OiAwLCBlbmQ6IDMgfV0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2VsbEluZGV4ZXNUb1JhbmdlcyhbMywgMSwgMF0pLCBbeyBzdGFydDogMCwgZW5kOiAyIH0sIHsgc3RhcnQ6IDMsIGVuZDogNCB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxJbmRleGVzVG9SYW5nZXMoWzksIDEwXSksIFt7IHN0YXJ0OiA5LCBlbmQ6IDExIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGNlbGxJbmRleGVzVG9SYW5nZXMoWzEwLCA5XSksIFt7IHN0YXJ0OiA5LCBlbmQ6IDExIH1dKTtcblx0fSk7XG5cblx0dGVzdCgnUmVkdWNlIHJhbmdlcycsIGZ1bmN0aW9uICgpIHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZHVjZUNlbGxSYW5nZXMoW3sgc3RhcnQ6IDAsIGVuZDogMSB9LCB7IHN0YXJ0OiAxLCBlbmQ6IDIgfV0pLCBbeyBzdGFydDogMCwgZW5kOiAyIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZHVjZUNlbGxSYW5nZXMoW3sgc3RhcnQ6IDAsIGVuZDogMiB9LCB7IHN0YXJ0OiAxLCBlbmQ6IDMgfV0pLCBbeyBzdGFydDogMCwgZW5kOiAzIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZHVjZUNlbGxSYW5nZXMoW3sgc3RhcnQ6IDEsIGVuZDogMyB9LCB7IHN0YXJ0OiAwLCBlbmQ6IDIgfV0pLCBbeyBzdGFydDogMCwgZW5kOiAzIH1dKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZHVjZUNlbGxSYW5nZXMoW3sgc3RhcnQ6IDAsIGVuZDogMiB9LCB7IHN0YXJ0OiA0LCBlbmQ6IDUgfV0pLCBbeyBzdGFydDogMCwgZW5kOiAyIH0sIHsgc3RhcnQ6IDQsIGVuZDogNSB9XSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHJlZHVjZUNlbGxSYW5nZXMoW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiAxIH0sXG5cdFx0XHR7IHN0YXJ0OiAxLCBlbmQ6IDIgfSxcblx0XHRcdHsgc3RhcnQ6IDQsIGVuZDogNiB9XG5cdFx0XSksIFtcblx0XHRcdHsgc3RhcnQ6IDAsIGVuZDogMiB9LFxuXHRcdFx0eyBzdGFydDogNCwgZW5kOiA2IH1cblx0XHRdKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVkdWNlQ2VsbFJhbmdlcyhbXG5cdFx0XHR7IHN0YXJ0OiAwLCBlbmQ6IDEgfSxcblx0XHRcdHsgc3RhcnQ6IDEsIGVuZDogMyB9LFxuXHRcdFx0eyBzdGFydDogMywgZW5kOiA0IH1cblx0XHRdKSwgW1xuXHRcdFx0eyBzdGFydDogMCwgZW5kOiA0IH1cblx0XHRdKTtcblx0fSk7XG5cblx0dGVzdCgnUmVkdWNlIHJhbmdlcyAyLCBlbXB0eSByYW5nZXMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWR1Y2VDZWxsUmFuZ2VzKFt7IHN0YXJ0OiAwLCBlbmQ6IDAgfSwgeyBzdGFydDogMCwgZW5kOiAwIH1dKSwgW3sgc3RhcnQ6IDAsIGVuZDogMCB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWR1Y2VDZWxsUmFuZ2VzKFt7IHN0YXJ0OiAwLCBlbmQ6IDAgfSwgeyBzdGFydDogMSwgZW5kOiAyIH1dKSwgW3sgc3RhcnQ6IDEsIGVuZDogMiB9XSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZWR1Y2VDZWxsUmFuZ2VzKFt7IHN0YXJ0OiAyLCBlbmQ6IDIgfV0pLCBbeyBzdGFydDogMiwgZW5kOiAyIH1dKTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ05vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllcicsIGZ1bmN0aW9uICgpIHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnc3VwcG9ydHMgbm90ZWJvb2sgdHlwZSBvbmx5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHZpZXdUeXBlID0gJ3Rlc3RWaWV3VHlwZSc7XG5cdFx0Y29uc3QgdHlwZSA9IE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5jcmVhdGUodmlld1R5cGUpO1xuXHRcdGFzc2VydC5kZWVwRXF1YWwoTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyLnBhcnNlKHR5cGUpLCB7IG5vdGVib29rVHlwZTogdmlld1R5cGUsIHZpZXdUeXBlIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChOb3RlYm9va1dvcmtpbmdDb3B5VHlwZUlkZW50aWZpZXIucGFyc2UoJ3NvbWV0aGluZycpLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzdXBwb3J0cyBkaWZmZXJlbnQgdmlld3R5cGUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3Qgbm90ZWJvb2tUeXBlID0geyBub3RlYm9va1R5cGU6ICd0ZXN0Tm90ZWJvb2tUeXBlJywgdmlld1R5cGU6ICd0ZXN0Vmlld1R5cGUnIH07XG5cdFx0Y29uc3QgdHlwZSA9IE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5jcmVhdGUobm90ZWJvb2tUeXBlLm5vdGVib29rVHlwZSwgbm90ZWJvb2tUeXBlLnZpZXdUeXBlKTtcblx0XHRhc3NlcnQuZGVlcEVxdWFsKE5vdGVib29rV29ya2luZ0NvcHlUeXBlSWRlbnRpZmllci5wYXJzZSh0eXBlKSwgbm90ZWJvb2tUeXBlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoTm90ZWJvb2tXb3JraW5nQ29weVR5cGVJZGVudGlmaWVyLnBhcnNlKCdzb21ldGhpbmcnKSwgdW5kZWZpbmVkKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsVUFBVSxTQUFTLE1BQU0sc0JBQXNCLHlDQUF5QztBQUNqRyxTQUFTLHFCQUFxQixxQkFBcUIsd0JBQXdCO0FBQzNFLFNBQVMsMkJBQTJCLGdCQUFnQjtBQUVwRCxNQUFNLGtCQUFrQixNQUFNO0FBQzdCLDBDQUF3QztBQUV4QyxNQUFJO0FBQ0osTUFBSTtBQUNKLE1BQUk7QUFFSixRQUFNLE1BQU07QUFDWCxrQkFBYyxJQUFJLGdCQUFnQjtBQUNsQywyQkFBdUIsMEJBQTBCLFdBQVc7QUFDNUQsc0JBQWtCLHFCQUFxQixJQUFJLGdCQUFnQjtBQUFBLEVBQzVELENBQUM7QUFFRCxPQUFLLGdDQUFnQyxXQUFZO0FBQ2hELFdBQU87QUFBQSxNQUFnQixJQUFJLHFCQUFxQixFQUFFO0FBQUEsUUFDakQ7QUFBQSxVQUNDO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQSxNQUFNO0FBQUEsVUFDTixNQUFNO0FBQUEsVUFDTjtBQUFBLFVBQ0E7QUFBQSxVQUNBLE1BQU07QUFBQSxRQUNQO0FBQUEsTUFBQztBQUFBLE1BQ0Q7QUFBQSxR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
