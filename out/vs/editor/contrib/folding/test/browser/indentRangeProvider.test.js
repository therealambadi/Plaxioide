import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { computeRanges } from "../../browser/indentRangeProvider.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
function assertRanges(lines, expected, offside, markers2) {
  const model = createTextModel(lines.join("\n"));
  const actual = computeRanges(model, offside, markers2);
  const actualRanges = [];
  for (let i = 0; i < actual.length; i++) {
    actualRanges[i] = r(actual.getStartLineNumber(i), actual.getEndLineNumber(i), actual.getParentIndex(i));
  }
  assert.deepStrictEqual(actualRanges, expected);
  model.dispose();
}
function r(startLineNumber, endLineNumber, parentIndex, marker = false) {
  return { startLineNumber, endLineNumber, parentIndex };
}
suite("Indentation Folding", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Fold one level", () => {
    const range = [
      "A",
      "  A",
      "  A",
      "  A"
    ];
    assertRanges(range, [r(1, 4, -1)], true);
    assertRanges(range, [r(1, 4, -1)], false);
  });
  test("Fold two levels", () => {
    const range = [
      "A",
      "  A",
      "  A",
      "    A",
      "    A"
    ];
    assertRanges(range, [r(1, 5, -1), r(3, 5, 0)], true);
    assertRanges(range, [r(1, 5, -1), r(3, 5, 0)], false);
  });
  test("Fold three levels", () => {
    const range = [
      "A",
      "  A",
      "    A",
      "      A",
      "A"
    ];
    assertRanges(range, [r(1, 4, -1), r(2, 4, 0), r(3, 4, 1)], true);
    assertRanges(range, [r(1, 4, -1), r(2, 4, 0), r(3, 4, 1)], false);
  });
  test("Fold decreasing indent", () => {
    const range = [
      "    A",
      "  A",
      "A"
    ];
    assertRanges(range, [], true);
    assertRanges(range, [], false);
  });
  test("Fold Java", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "  void foo() {",
      /* 3*/
      "    console.log();",
      /* 4*/
      "    console.log();",
      /* 5*/
      "  }",
      /* 6*/
      "",
      /* 7*/
      "  void bar() {",
      /* 8*/
      "    console.log();",
      /* 9*/
      "  }",
      /*10*/
      "}",
      /*11*/
      "interface B {",
      /*12*/
      "  void bar();",
      /*13*/
      "}"
    ], [r(1, 9, -1), r(2, 4, 0), r(7, 8, 0), r(11, 12, -1)], false);
  });
  test("Fold Javadoc", () => {
    assertRanges([
      /* 1*/
      "/**",
      /* 2*/
      " * Comment",
      /* 3*/
      " */",
      /* 4*/
      "class A {",
      /* 5*/
      "  void foo() {",
      /* 6*/
      "  }",
      /* 7*/
      "}"
    ], [r(1, 3, -1), r(4, 6, -1)], false);
  });
  test("Fold Whitespace Java", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "",
      /* 3*/
      "  void foo() {",
      /* 4*/
      "     ",
      /* 5*/
      "     return 0;",
      /* 6*/
      "  }",
      /* 7*/
      "      ",
      /* 8*/
      "}"
    ], [r(1, 7, -1), r(3, 5, 0)], false);
  });
  test("Fold Whitespace Python", () => {
    assertRanges([
      /* 1*/
      "def a:",
      /* 2*/
      "  pass",
      /* 3*/
      "   ",
      /* 4*/
      "  def b:",
      /* 5*/
      "    pass",
      /* 6*/
      "  ",
      /* 7*/
      "      ",
      /* 8*/
      "def c: # since there was a deintent here"
    ], [r(1, 5, -1), r(4, 5, 0)], true);
  });
  test("Fold Tabs", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "		",
      /* 3*/
      "	void foo() {",
      /* 4*/
      "	 	//hello",
      /* 5*/
      "	    return 0;",
      /* 6*/
      "  	}",
      /* 7*/
      "      ",
      /* 8*/
      "}"
    ], [r(1, 7, -1), r(3, 5, 0)], false);
  });
});
const markers = {
  start: /^\s*#region\b/,
  end: /^\s*#endregion\b/
};
suite("Folding with regions", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Inside region, indented", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "  #region",
      /* 3*/
      "  void foo() {",
      /* 4*/
      "     ",
      /* 5*/
      "     return 0;",
      /* 6*/
      "  }",
      /* 7*/
      "  #endregion",
      /* 8*/
      "}"
    ], [r(1, 7, -1), r(2, 7, 0, true), r(3, 5, 1)], false, markers);
  });
  test("Inside region, not indented", () => {
    assertRanges([
      /* 1*/
      "var x;",
      /* 2*/
      "#region",
      /* 3*/
      "void foo() {",
      /* 4*/
      "     ",
      /* 5*/
      "     return 0;",
      /* 6*/
      "  }",
      /* 7*/
      "#endregion",
      /* 8*/
      ""
    ], [r(2, 7, -1, true), r(3, 6, 0)], false, markers);
  });
  test("Empty Regions", () => {
    assertRanges([
      /* 1*/
      "var x;",
      /* 2*/
      "#region",
      /* 3*/
      "#endregion",
      /* 4*/
      "#region",
      /* 5*/
      "",
      /* 6*/
      "#endregion",
      /* 7*/
      "var y;"
    ], [r(2, 3, -1, true), r(4, 6, -1, true)], false, markers);
  });
  test("Nested Regions", () => {
    assertRanges([
      /* 1*/
      "var x;",
      /* 2*/
      "#region",
      /* 3*/
      "#region",
      /* 4*/
      "",
      /* 5*/
      "#endregion",
      /* 6*/
      "#endregion",
      /* 7*/
      "var y;"
    ], [r(2, 6, -1, true), r(3, 5, 0, true)], false, markers);
  });
  test("Nested Regions 2", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "  #region",
      /* 3*/
      "",
      /* 4*/
      "  #region",
      /* 5*/
      "",
      /* 6*/
      "  #endregion",
      /* 7*/
      "  // comment",
      /* 8*/
      "  #endregion",
      /* 9*/
      "}"
    ], [r(1, 8, -1), r(2, 8, 0, true), r(4, 6, 1, true)], false, markers);
  });
  test("Incomplete Regions", () => {
    assertRanges([
      /* 1*/
      "class A {",
      /* 2*/
      "#region",
      /* 3*/
      "  // comment",
      /* 4*/
      "}"
    ], [r(2, 3, -1)], false, markers);
  });
  test("Incomplete Regions 2", () => {
    assertRanges([
      /* 1*/
      "",
      /* 2*/
      "#region",
      /* 3*/
      "#region",
      /* 4*/
      "#region",
      /* 5*/
      "  // comment",
      /* 6*/
      "#endregion",
      /* 7*/
      "#endregion",
      /* 8*/
      " // hello"
    ], [r(3, 7, -1, true), r(4, 6, 0, true)], false, markers);
  });
  test("Indented region before", () => {
    assertRanges([
      /* 1*/
      "if (x)",
      /* 2*/
      "  return;",
      /* 3*/
      "",
      /* 4*/
      "#region",
      /* 5*/
      "  // comment",
      /* 6*/
      "#endregion"
    ], [r(1, 3, -1), r(4, 6, -1, true)], false, markers);
  });
  test("Indented region before 2", () => {
    assertRanges([
      /* 1*/
      "if (x)",
      /* 2*/
      "  log();",
      /* 3*/
      "",
      /* 4*/
      "    #region",
      /* 5*/
      "      // comment",
      /* 6*/
      "    #endregion"
    ], [r(1, 6, -1), r(2, 6, 0), r(4, 6, 1, true)], false, markers);
  });
  test("Indented region in-between", () => {
    assertRanges([
      /* 1*/
      "#region",
      /* 2*/
      "  // comment",
      /* 3*/
      "  if (x)",
      /* 4*/
      "    return;",
      /* 5*/
      "",
      /* 6*/
      "#endregion"
    ], [r(1, 6, -1, true), r(3, 5, 0)], false, markers);
  });
  test("Indented region after", () => {
    assertRanges([
      /* 1*/
      "#region",
      /* 2*/
      "  // comment",
      /* 3*/
      "",
      /* 4*/
      "#endregion",
      /* 5*/
      "  if (x)",
      /* 6*/
      "    return;"
    ], [r(1, 4, -1, true), r(5, 6, -1)], false, markers);
  });
  test("With off-side", () => {
    assertRanges([
      /* 1*/
      "#region",
      /* 2*/
      "  ",
      /* 3*/
      "",
      /* 4*/
      "#endregion",
      /* 5*/
      ""
    ], [r(1, 4, -1, true)], true, markers);
  });
  test("Nested with off-side", () => {
    assertRanges([
      /* 1*/
      "#region",
      /* 2*/
      "  ",
      /* 3*/
      "#region",
      /* 4*/
      "",
      /* 5*/
      "#endregion",
      /* 6*/
      "",
      /* 7*/
      "#endregion",
      /* 8*/
      ""
    ], [r(1, 7, -1, true), r(3, 5, 0, true)], true, markers);
  });
  test("Issue 35981", () => {
    assertRanges([
      /* 1*/
      "function thisFoldsToEndOfPage() {",
      /* 2*/
      "  const variable = []",
      /* 3*/
      "    // #region",
      /* 4*/
      "    .reduce((a, b) => a,[]);",
      /* 5*/
      "}",
      /* 6*/
      "",
      /* 7*/
      "function thisFoldsProperly() {",
      /* 8*/
      '  const foo = "bar"',
      /* 9*/
      "}"
    ], [r(1, 4, -1), r(2, 4, 0), r(7, 8, -1)], false, markers);
  });
  test("Misspelled Markers", () => {
    assertRanges([
      /* 1*/
      "#Region",
      /* 2*/
      "#endregion",
      /* 3*/
      "#regionsandmore",
      /* 4*/
      "#endregion",
      /* 5*/
      "#region",
      /* 6*/
      "#end region",
      /* 7*/
      "#region",
      /* 8*/
      "#endregionff"
    ], [], true, markers);
  });
  test("Issue 79359", () => {
    assertRanges([
      /* 1*/
      "#region",
      /* 2*/
      "",
      /* 3*/
      "class A",
      /* 4*/
      "  foo",
      /* 5*/
      "",
      /* 6*/
      "class A",
      /* 7*/
      "  foo",
      /* 8*/
      "",
      /* 9*/
      "#endregion"
    ], [r(1, 9, -1, true), r(3, 4, 0), r(6, 7, 0)], true, markers);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9mb2xkaW5nL3Rlc3QvYnJvd3Nlci9pbmRlbnRSYW5nZVByb3ZpZGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEZvbGRpbmdNYXJrZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgY29tcHV0ZVJhbmdlcyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvaW5kZW50UmFuZ2VQcm92aWRlci5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcblxuaW50ZXJmYWNlIEV4cGVjdGVkSW5kZW50UmFuZ2Uge1xuXHRzdGFydExpbmVOdW1iZXI6IG51bWJlcjtcblx0ZW5kTGluZU51bWJlcjogbnVtYmVyO1xuXHRwYXJlbnRJbmRleDogbnVtYmVyO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRSYW5nZXMobGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZDogRXhwZWN0ZWRJbmRlbnRSYW5nZVtdLCBvZmZzaWRlOiBib29sZWFuLCBtYXJrZXJzPzogRm9sZGluZ01hcmtlcnMpOiB2b2lkIHtcblx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwobGluZXMuam9pbignXFxuJykpO1xuXHRjb25zdCBhY3R1YWwgPSBjb21wdXRlUmFuZ2VzKG1vZGVsLCBvZmZzaWRlLCBtYXJrZXJzKTtcblxuXHRjb25zdCBhY3R1YWxSYW5nZXM6IEV4cGVjdGVkSW5kZW50UmFuZ2VbXSA9IFtdO1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGFjdHVhbC5sZW5ndGg7IGkrKykge1xuXHRcdGFjdHVhbFJhbmdlc1tpXSA9IHIoYWN0dWFsLmdldFN0YXJ0TGluZU51bWJlcihpKSwgYWN0dWFsLmdldEVuZExpbmVOdW1iZXIoaSksIGFjdHVhbC5nZXRQYXJlbnRJbmRleChpKSk7XG5cdH1cblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxSYW5nZXMsIGV4cGVjdGVkKTtcblx0bW9kZWwuZGlzcG9zZSgpO1xufVxuXG5mdW5jdGlvbiByKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIHBhcmVudEluZGV4OiBudW1iZXIsIG1hcmtlciA9IGZhbHNlKTogRXhwZWN0ZWRJbmRlbnRSYW5nZSB7XG5cdHJldHVybiB7IHN0YXJ0TGluZU51bWJlciwgZW5kTGluZU51bWJlciwgcGFyZW50SW5kZXggfTtcbn1cblxuc3VpdGUoJ0luZGVudGF0aW9uIEZvbGRpbmcnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXHR0ZXN0KCdGb2xkIG9uZSBsZXZlbCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZSA9IFtcblx0XHRcdCdBJyxcblx0XHRcdCcgIEEnLFxuXHRcdFx0JyAgQScsXG5cdFx0XHQnICBBJ1xuXHRcdF07XG5cdFx0YXNzZXJ0UmFuZ2VzKHJhbmdlLCBbcigxLCA0LCAtMSldLCB0cnVlKTtcblx0XHRhc3NlcnRSYW5nZXMocmFuZ2UsIFtyKDEsIDQsIC0xKV0sIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZCB0d28gbGV2ZWxzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJhbmdlID0gW1xuXHRcdFx0J0EnLFxuXHRcdFx0JyAgQScsXG5cdFx0XHQnICBBJyxcblx0XHRcdCcgICAgQScsXG5cdFx0XHQnICAgIEEnXG5cdFx0XTtcblx0XHRhc3NlcnRSYW5nZXMocmFuZ2UsIFtyKDEsIDUsIC0xKSwgcigzLCA1LCAwKV0sIHRydWUpO1xuXHRcdGFzc2VydFJhbmdlcyhyYW5nZSwgW3IoMSwgNSwgLTEpLCByKDMsIDUsIDApXSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdGb2xkIHRocmVlIGxldmVscycsICgpID0+IHtcblx0XHRjb25zdCByYW5nZSA9IFtcblx0XHRcdCdBJyxcblx0XHRcdCcgIEEnLFxuXHRcdFx0JyAgICBBJyxcblx0XHRcdCcgICAgICBBJyxcblx0XHRcdCdBJ1xuXHRcdF07XG5cdFx0YXNzZXJ0UmFuZ2VzKHJhbmdlLCBbcigxLCA0LCAtMSksIHIoMiwgNCwgMCksIHIoMywgNCwgMSldLCB0cnVlKTtcblx0XHRhc3NlcnRSYW5nZXMocmFuZ2UsIFtyKDEsIDQsIC0xKSwgcigyLCA0LCAwKSwgcigzLCA0LCAxKV0sIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZCBkZWNyZWFzaW5nIGluZGVudCcsICgpID0+IHtcblx0XHRjb25zdCByYW5nZSA9IFtcblx0XHRcdCcgICAgQScsXG5cdFx0XHQnICBBJyxcblx0XHRcdCdBJ1xuXHRcdF07XG5cdFx0YXNzZXJ0UmFuZ2VzKHJhbmdlLCBbXSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0UmFuZ2VzKHJhbmdlLCBbXSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdGb2xkIEphdmEnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDIqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiAzKi9cdCcgICAgY29uc29sZS5sb2coKTsnLFxuXHRcdC8qIDQqL1x0JyAgICBjb25zb2xlLmxvZygpOycsXG5cdFx0LyogNSovXHQnICB9Jyxcblx0XHQvKiA2Ki9cdCcnLFxuXHRcdC8qIDcqL1x0JyAgdm9pZCBiYXIoKSB7Jyxcblx0XHQvKiA4Ki9cdCcgICAgY29uc29sZS5sb2coKTsnLFxuXHRcdC8qIDkqL1x0JyAgfScsXG5cdFx0LyoxMCovXHQnfScsXG5cdFx0LyoxMSovXHQnaW50ZXJmYWNlIEIgeycsXG5cdFx0LyoxMiovXHQnICB2b2lkIGJhcigpOycsXG5cdFx0LyoxMyovXHQnfScsXG5cdFx0XSwgW3IoMSwgOSwgLTEpLCByKDIsIDQsIDApLCByKDcsIDgsIDApLCByKDExLCAxMiwgLTEpXSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdGb2xkIEphdmFkb2MnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCcvKionLFxuXHRcdC8qIDIqL1x0JyAqIENvbW1lbnQnLFxuXHRcdC8qIDMqL1x0JyAqLycsXG5cdFx0LyogNCovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiA1Ki9cdCcgIHZvaWQgZm9vKCkgeycsXG5cdFx0LyogNiovXHQnICB9Jyxcblx0XHQvKiA3Ki9cdCd9Jyxcblx0XHRdLCBbcigxLCAzLCAtMSksIHIoNCwgNiwgLTEpXSwgZmFsc2UpO1xuXHR9KTtcblx0dGVzdCgnRm9sZCBXaGl0ZXNwYWNlIEphdmEnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDIqL1x0JycsXG5cdFx0LyogMyovXHQnICB2b2lkIGZvbygpIHsnLFxuXHRcdC8qIDQqL1x0JyAgICAgJyxcblx0XHQvKiA1Ki9cdCcgICAgIHJldHVybiAwOycsXG5cdFx0LyogNiovXHQnICB9Jyxcblx0XHQvKiA3Ki9cdCcgICAgICAnLFxuXHRcdC8qIDgqL1x0J30nLFxuXHRcdF0sIFtyKDEsIDcsIC0xKSwgcigzLCA1LCAwKV0sIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZCBXaGl0ZXNwYWNlIFB5dGhvbicsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0J2RlZiBhOicsXG5cdFx0LyogMiovXHQnICBwYXNzJyxcblx0XHQvKiAzKi9cdCcgICAnLFxuXHRcdC8qIDQqL1x0JyAgZGVmIGI6Jyxcblx0XHQvKiA1Ki9cdCcgICAgcGFzcycsXG5cdFx0LyogNiovXHQnICAnLFxuXHRcdC8qIDcqL1x0JyAgICAgICcsXG5cdFx0LyogOCovXHQnZGVmIGM6ICMgc2luY2UgdGhlcmUgd2FzIGEgZGVpbnRlbnQgaGVyZSdcblx0XHRdLCBbcigxLCA1LCAtMSksIHIoNCwgNSwgMCldLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZCBUYWJzJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiAyKi9cdCdcXHRcXHQnLFxuXHRcdC8qIDMqL1x0J1xcdHZvaWQgZm9vKCkgeycsXG5cdFx0LyogNCovXHQnXFx0IFxcdC8vaGVsbG8nLFxuXHRcdC8qIDUqL1x0J1xcdCAgICByZXR1cm4gMDsnLFxuXHRcdC8qIDYqL1x0JyAgXFx0fScsXG5cdFx0LyogNyovXHQnICAgICAgJyxcblx0XHQvKiA4Ki9cdCd9Jyxcblx0XHRdLCBbcigxLCA3LCAtMSksIHIoMywgNSwgMCldLCBmYWxzZSk7XG5cdH0pO1xufSk7XG5cbmNvbnN0IG1hcmtlcnM6IEZvbGRpbmdNYXJrZXJzID0ge1xuXHRzdGFydDogL15cXHMqI3JlZ2lvblxcYi8sXG5cdGVuZDogL15cXHMqI2VuZHJlZ2lvblxcYi9cbn07XG5cbnN1aXRlKCdGb2xkaW5nIHdpdGggcmVnaW9ucycsICgpID0+IHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cdHRlc3QoJ0luc2lkZSByZWdpb24sIGluZGVudGVkJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiAyKi9cdCcgICNyZWdpb24nLFxuXHRcdC8qIDMqL1x0JyAgdm9pZCBmb28oKSB7Jyxcblx0XHQvKiA0Ki9cdCcgICAgICcsXG5cdFx0LyogNSovXHQnICAgICByZXR1cm4gMDsnLFxuXHRcdC8qIDYqL1x0JyAgfScsXG5cdFx0LyogNyovXHQnICAjZW5kcmVnaW9uJyxcblx0XHQvKiA4Ki9cdCd9Jyxcblx0XHRdLCBbcigxLCA3LCAtMSksIHIoMiwgNywgMCwgdHJ1ZSksIHIoMywgNSwgMSldLCBmYWxzZSwgbWFya2Vycyk7XG5cdH0pO1xuXHR0ZXN0KCdJbnNpZGUgcmVnaW9uLCBub3QgaW5kZW50ZWQnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCd2YXIgeDsnLFxuXHRcdC8qIDIqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDMqL1x0J3ZvaWQgZm9vKCkgeycsXG5cdFx0LyogNCovXHQnICAgICAnLFxuXHRcdC8qIDUqL1x0JyAgICAgcmV0dXJuIDA7Jyxcblx0XHQvKiA2Ki9cdCcgIH0nLFxuXHRcdC8qIDcqL1x0JyNlbmRyZWdpb24nLFxuXHRcdC8qIDgqL1x0JycsXG5cdFx0XSwgW3IoMiwgNywgLTEsIHRydWUpLCByKDMsIDYsIDApXSwgZmFsc2UsIG1hcmtlcnMpO1xuXHR9KTtcblx0dGVzdCgnRW1wdHkgUmVnaW9ucycsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0J3ZhciB4OycsXG5cdFx0LyogMiovXHQnI3JlZ2lvbicsXG5cdFx0LyogMyovXHQnI2VuZHJlZ2lvbicsXG5cdFx0LyogNCovXHQnI3JlZ2lvbicsXG5cdFx0LyogNSovXHQnJyxcblx0XHQvKiA2Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiA3Ki9cdCd2YXIgeTsnLFxuXHRcdF0sIFtyKDIsIDMsIC0xLCB0cnVlKSwgcig0LCA2LCAtMSwgdHJ1ZSldLCBmYWxzZSwgbWFya2Vycyk7XG5cdH0pO1xuXHR0ZXN0KCdOZXN0ZWQgUmVnaW9ucycsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0J3ZhciB4OycsXG5cdFx0LyogMiovXHQnI3JlZ2lvbicsXG5cdFx0LyogMyovXHQnI3JlZ2lvbicsXG5cdFx0LyogNCovXHQnJyxcblx0XHQvKiA1Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiA2Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiA3Ki9cdCd2YXIgeTsnLFxuXHRcdF0sIFtyKDIsIDYsIC0xLCB0cnVlKSwgcigzLCA1LCAwLCB0cnVlKV0sIGZhbHNlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ05lc3RlZCBSZWdpb25zIDInLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCdjbGFzcyBBIHsnLFxuXHRcdC8qIDIqL1x0JyAgI3JlZ2lvbicsXG5cdFx0LyogMyovXHQnJyxcblx0XHQvKiA0Ki9cdCcgICNyZWdpb24nLFxuXHRcdC8qIDUqL1x0JycsXG5cdFx0LyogNiovXHQnICAjZW5kcmVnaW9uJyxcblx0XHQvKiA3Ki9cdCcgIC8vIGNvbW1lbnQnLFxuXHRcdC8qIDgqL1x0JyAgI2VuZHJlZ2lvbicsXG5cdFx0LyogOSovXHQnfScsXG5cdFx0XSwgW3IoMSwgOCwgLTEpLCByKDIsIDgsIDAsIHRydWUpLCByKDQsIDYsIDEsIHRydWUpXSwgZmFsc2UsIG1hcmtlcnMpO1xuXHR9KTtcblx0dGVzdCgnSW5jb21wbGV0ZSBSZWdpb25zJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnY2xhc3MgQSB7Jyxcblx0XHQvKiAyKi9cdCcjcmVnaW9uJyxcblx0XHQvKiAzKi9cdCcgIC8vIGNvbW1lbnQnLFxuXHRcdC8qIDQqL1x0J30nLFxuXHRcdF0sIFtyKDIsIDMsIC0xKV0sIGZhbHNlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ0luY29tcGxldGUgUmVnaW9ucyAyJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnJyxcblx0XHQvKiAyKi9cdCcjcmVnaW9uJyxcblx0XHQvKiAzKi9cdCcjcmVnaW9uJyxcblx0XHQvKiA0Ki9cdCcjcmVnaW9uJyxcblx0XHQvKiA1Ki9cdCcgIC8vIGNvbW1lbnQnLFxuXHRcdC8qIDYqL1x0JyNlbmRyZWdpb24nLFxuXHRcdC8qIDcqL1x0JyNlbmRyZWdpb24nLFxuXHRcdC8qIDgqL1x0JyAvLyBoZWxsbycsXG5cdFx0XSwgW3IoMywgNywgLTEsIHRydWUpLCByKDQsIDYsIDAsIHRydWUpXSwgZmFsc2UsIG1hcmtlcnMpO1xuXHR9KTtcblx0dGVzdCgnSW5kZW50ZWQgcmVnaW9uIGJlZm9yZScsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0J2lmICh4KScsXG5cdFx0LyogMiovXHQnICByZXR1cm47Jyxcblx0XHQvKiAzKi9cdCcnLFxuXHRcdC8qIDQqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDUqL1x0JyAgLy8gY29tbWVudCcsXG5cdFx0LyogNiovXHQnI2VuZHJlZ2lvbicsXG5cdFx0XSwgW3IoMSwgMywgLTEpLCByKDQsIDYsIC0xLCB0cnVlKV0sIGZhbHNlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ0luZGVudGVkIHJlZ2lvbiBiZWZvcmUgMicsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0J2lmICh4KScsXG5cdFx0LyogMiovXHQnICBsb2coKTsnLFxuXHRcdC8qIDMqL1x0JycsXG5cdFx0LyogNCovXHQnICAgICNyZWdpb24nLFxuXHRcdC8qIDUqL1x0JyAgICAgIC8vIGNvbW1lbnQnLFxuXHRcdC8qIDYqL1x0JyAgICAjZW5kcmVnaW9uJyxcblx0XHRdLCBbcigxLCA2LCAtMSksIHIoMiwgNiwgMCksIHIoNCwgNiwgMSwgdHJ1ZSldLCBmYWxzZSwgbWFya2Vycyk7XG5cdH0pO1xuXHR0ZXN0KCdJbmRlbnRlZCByZWdpb24gaW4tYmV0d2VlbicsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDIqL1x0JyAgLy8gY29tbWVudCcsXG5cdFx0LyogMyovXHQnICBpZiAoeCknLFxuXHRcdC8qIDQqL1x0JyAgICByZXR1cm47Jyxcblx0XHQvKiA1Ki9cdCcnLFxuXHRcdC8qIDYqL1x0JyNlbmRyZWdpb24nLFxuXHRcdF0sIFtyKDEsIDYsIC0xLCB0cnVlKSwgcigzLCA1LCAwKV0sIGZhbHNlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ0luZGVudGVkIHJlZ2lvbiBhZnRlcicsICgpID0+IHtcblx0XHRhc3NlcnRSYW5nZXMoW1xuXHRcdC8qIDEqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDIqL1x0JyAgLy8gY29tbWVudCcsXG5cdFx0LyogMyovXHQnJyxcblx0XHQvKiA0Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiA1Ki9cdCcgIGlmICh4KScsXG5cdFx0LyogNiovXHQnICAgIHJldHVybjsnLFxuXHRcdF0sIFtyKDEsIDQsIC0xLCB0cnVlKSwgcig1LCA2LCAtMSldLCBmYWxzZSwgbWFya2Vycyk7XG5cdH0pO1xuXHR0ZXN0KCdXaXRoIG9mZi1zaWRlJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnI3JlZ2lvbicsXG5cdFx0LyogMiovXHQnICAnLFxuXHRcdC8qIDMqL1x0JycsXG5cdFx0LyogNCovXHQnI2VuZHJlZ2lvbicsXG5cdFx0LyogNSovXHQnJyxcblx0XHRdLCBbcigxLCA0LCAtMSwgdHJ1ZSldLCB0cnVlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ05lc3RlZCB3aXRoIG9mZi1zaWRlJywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnI3JlZ2lvbicsXG5cdFx0LyogMiovXHQnICAnLFxuXHRcdC8qIDMqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDQqL1x0JycsXG5cdFx0LyogNSovXHQnI2VuZHJlZ2lvbicsXG5cdFx0LyogNiovXHQnJyxcblx0XHQvKiA3Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiA4Ki9cdCcnLFxuXHRcdF0sIFtyKDEsIDcsIC0xLCB0cnVlKSwgcigzLCA1LCAwLCB0cnVlKV0sIHRydWUsIG1hcmtlcnMpO1xuXHR9KTtcblx0dGVzdCgnSXNzdWUgMzU5ODEnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCdmdW5jdGlvbiB0aGlzRm9sZHNUb0VuZE9mUGFnZSgpIHsnLFxuXHRcdC8qIDIqL1x0JyAgY29uc3QgdmFyaWFibGUgPSBbXScsXG5cdFx0LyogMyovXHQnICAgIC8vICNyZWdpb24nLFxuXHRcdC8qIDQqL1x0JyAgICAucmVkdWNlKChhLCBiKSA9PiBhLFtdKTsnLFxuXHRcdC8qIDUqL1x0J30nLFxuXHRcdC8qIDYqL1x0JycsXG5cdFx0LyogNyovXHQnZnVuY3Rpb24gdGhpc0ZvbGRzUHJvcGVybHkoKSB7Jyxcblx0XHQvKiA4Ki9cdCcgIGNvbnN0IGZvbyA9IFwiYmFyXCInLFxuXHRcdC8qIDkqL1x0J30nLFxuXHRcdF0sIFtyKDEsIDQsIC0xKSwgcigyLCA0LCAwKSwgcig3LCA4LCAtMSldLCBmYWxzZSwgbWFya2Vycyk7XG5cdH0pO1xuXHR0ZXN0KCdNaXNzcGVsbGVkIE1hcmtlcnMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UmFuZ2VzKFtcblx0XHQvKiAxKi9cdCcjUmVnaW9uJyxcblx0XHQvKiAyKi9cdCcjZW5kcmVnaW9uJyxcblx0XHQvKiAzKi9cdCcjcmVnaW9uc2FuZG1vcmUnLFxuXHRcdC8qIDQqL1x0JyNlbmRyZWdpb24nLFxuXHRcdC8qIDUqL1x0JyNyZWdpb24nLFxuXHRcdC8qIDYqL1x0JyNlbmQgcmVnaW9uJyxcblx0XHQvKiA3Ki9cdCcjcmVnaW9uJyxcblx0XHQvKiA4Ki9cdCcjZW5kcmVnaW9uZmYnLFxuXHRcdF0sIFtdLCB0cnVlLCBtYXJrZXJzKTtcblx0fSk7XG5cdHRlc3QoJ0lzc3VlIDc5MzU5JywgKCkgPT4ge1xuXHRcdGFzc2VydFJhbmdlcyhbXG5cdFx0LyogMSovXHQnI3JlZ2lvbicsXG5cdFx0LyogMiovXHQnJyxcblx0XHQvKiAzKi9cdCdjbGFzcyBBJyxcblx0XHQvKiA0Ki9cdCcgIGZvbycsXG5cdFx0LyogNSovXHQnJyxcblx0XHQvKiA2Ki9cdCdjbGFzcyBBJyxcblx0XHQvKiA3Ki9cdCcgIGZvbycsXG5cdFx0LyogOCovXHQnJyxcblx0XHQvKiA5Ki9cdCcjZW5kcmVnaW9uJyxcblx0XHRdLCBbcigxLCA5LCAtMSwgdHJ1ZSksIHIoMywgNCwgMCksIHIoNiwgNywgMCldLCB0cnVlLCBtYXJrZXJzKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLCtDQUErQztBQUV4RCxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUF1QjtBQVFoQyxTQUFTLGFBQWEsT0FBaUIsVUFBaUMsU0FBa0JBLFVBQWdDO0FBQ3pILFFBQU0sUUFBUSxnQkFBZ0IsTUFBTSxLQUFLLElBQUksQ0FBQztBQUM5QyxRQUFNLFNBQVMsY0FBYyxPQUFPLFNBQVNBLFFBQU87QUFFcEQsUUFBTSxlQUFzQyxDQUFDO0FBQzdDLFdBQVMsSUFBSSxHQUFHLElBQUksT0FBTyxRQUFRLEtBQUs7QUFDdkMsaUJBQWEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxtQkFBbUIsQ0FBQyxHQUFHLE9BQU8saUJBQWlCLENBQUMsR0FBRyxPQUFPLGVBQWUsQ0FBQyxDQUFDO0FBQUEsRUFDdkc7QUFDQSxTQUFPLGdCQUFnQixjQUFjLFFBQVE7QUFDN0MsUUFBTSxRQUFRO0FBQ2Y7QUFFQSxTQUFTLEVBQUUs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LEdBQUcsR0FBRyxJQUFJLElBQUksQ0FBQyxHQUFHLE1BQU0sT0FBTztBQUFBLEVBQ3RDLENBQUM7QUFDRCxPQUFLLHdCQUF3QixNQUFNO0FBQ2xDLGlCQUFhO0FBQUE7QUFBQSxNQUNOO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUEsSUFDUCxHQUFHLENBQUMsRUFBRSxHQUFHLEdBQUcsSUFBSSxJQUFJLEdBQUcsRUFBRSxHQUFHLEdBQUcsR0FBRyxJQUFJLENBQUMsR0FBRyxNQUFNLE9BQU87QUFBQSxFQUN4RCxDQUFDO0FBQ0QsT0FBSyxlQUFlLE1BQU07QUFDekIsaUJBQWE7QUFBQTtBQUFBLE1BQ047QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQSxJQUNQLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxFQUFFLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsR0FBRyxHQUFHLEVBQUUsQ0FBQyxHQUFHLE9BQU8sT0FBTztBQUFBLEVBQzFELENBQUM7QUFDRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDLGlCQUFhO0FBQUE7QUFBQSxNQUNOO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUE7QUFBQSxNQUNBO0FBQUEsSUFDUCxHQUFHLENBQUMsR0FBRyxNQUFNLE9BQU87QUFBQSxFQUNyQixDQUFDO0FBQ0QsT0FBSyxlQUFlLE1BQU07QUFDekIsaUJBQWE7QUFBQTtBQUFBLE1BQ047QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQTtBQUFBLE1BQ0E7QUFBQSxJQUNQLEdBQUcsQ0FBQyxFQUFFLEdBQUcsR0FBRyxJQUFJLElBQUksR0FBRyxFQUFFLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxPQUFPO0FBQUEsRUFDOUQsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbIm1hcmtlcnMiXQp9Cg==
