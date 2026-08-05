import assert from "assert";
import { Constants } from "../../../../base/common/uint.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { DiffComputer } from "../../../common/diff/legacyLinesDiffComputer.js";
import { createTextModel } from "../testTextModel.js";
function assertDiff(originalLines, modifiedLines, expectedChanges, shouldComputeCharChanges = true, shouldPostProcessCharChanges = false, shouldIgnoreTrimWhitespace = false) {
  const diffComputer = new DiffComputer(originalLines, modifiedLines, {
    shouldComputeCharChanges,
    shouldPostProcessCharChanges,
    shouldIgnoreTrimWhitespace,
    shouldMakePrettyDiff: true,
    maxComputationTime: 0
  });
  const changes = diffComputer.computeDiff().changes;
  const mapCharChange = (charChange) => {
    return {
      originalStartLineNumber: charChange.originalStartLineNumber,
      originalStartColumn: charChange.originalStartColumn,
      originalEndLineNumber: charChange.originalEndLineNumber,
      originalEndColumn: charChange.originalEndColumn,
      modifiedStartLineNumber: charChange.modifiedStartLineNumber,
      modifiedStartColumn: charChange.modifiedStartColumn,
      modifiedEndLineNumber: charChange.modifiedEndLineNumber,
      modifiedEndColumn: charChange.modifiedEndColumn
    };
  };
  const actual = changes.map((lineChange) => {
    return {
      originalStartLineNumber: lineChange.originalStartLineNumber,
      originalEndLineNumber: lineChange.originalEndLineNumber,
      modifiedStartLineNumber: lineChange.modifiedStartLineNumber,
      modifiedEndLineNumber: lineChange.modifiedEndLineNumber,
      charChanges: lineChange.charChanges ? lineChange.charChanges.map(mapCharChange) : void 0
    };
  });
  assert.deepStrictEqual(actual, expectedChanges);
  if (!shouldIgnoreTrimWhitespace) {
    const modifiedTextModel = createTextModel(modifiedLines.join("\n"));
    const expectedValue = modifiedTextModel.getValue();
    {
      const originalTextModel = createTextModel(originalLines.join("\n"));
      originalTextModel.applyEdits(changes.map((c) => getLineEdit(c, modifiedTextModel)));
      assert.deepStrictEqual(originalTextModel.getValue(), expectedValue);
      originalTextModel.dispose();
    }
    if (shouldComputeCharChanges) {
      const originalTextModel = createTextModel(originalLines.join("\n"));
      originalTextModel.applyEdits(changes.flatMap((c) => getCharEdits(c, modifiedTextModel)));
      assert.deepStrictEqual(originalTextModel.getValue(), expectedValue);
      originalTextModel.dispose();
    }
    modifiedTextModel.dispose();
  }
}
function getCharEdits(lineChange, modifiedTextModel) {
  if (!lineChange.charChanges) {
    return [getLineEdit(lineChange, modifiedTextModel)];
  }
  return lineChange.charChanges.map((c) => {
    const originalRange = new Range(c.originalStartLineNumber, c.originalStartColumn, c.originalEndLineNumber, c.originalEndColumn);
    const modifiedRange = new Range(c.modifiedStartLineNumber, c.modifiedStartColumn, c.modifiedEndLineNumber, c.modifiedEndColumn);
    return {
      range: originalRange,
      text: modifiedTextModel.getValueInRange(modifiedRange)
    };
  });
}
function getLineEdit(lineChange, modifiedTextModel) {
  let originalRange;
  if (lineChange.originalEndLineNumber === 0) {
    originalRange = new LineRange(lineChange.originalStartLineNumber + 1, 0);
  } else {
    originalRange = new LineRange(lineChange.originalStartLineNumber, lineChange.originalEndLineNumber - lineChange.originalStartLineNumber + 1);
  }
  let modifiedRange;
  if (lineChange.modifiedEndLineNumber === 0) {
    modifiedRange = new LineRange(lineChange.modifiedStartLineNumber + 1, 0);
  } else {
    modifiedRange = new LineRange(lineChange.modifiedStartLineNumber, lineChange.modifiedEndLineNumber - lineChange.modifiedStartLineNumber + 1);
  }
  const [r1, r2] = diffFromLineRanges(originalRange, modifiedRange);
  return {
    range: r1,
    text: modifiedTextModel.getValueInRange(r2)
  };
}
function diffFromLineRanges(originalRange, modifiedRange) {
  if (originalRange.startLineNumber === 1 || modifiedRange.startLineNumber === 1) {
    if (!originalRange.isEmpty && !modifiedRange.isEmpty) {
      return [
        new Range(
          originalRange.startLineNumber,
          1,
          originalRange.endLineNumberExclusive - 1,
          Constants.MAX_SAFE_SMALL_INTEGER
        ),
        new Range(
          modifiedRange.startLineNumber,
          1,
          modifiedRange.endLineNumberExclusive - 1,
          Constants.MAX_SAFE_SMALL_INTEGER
        )
      ];
    }
    return [
      new Range(
        originalRange.startLineNumber,
        1,
        originalRange.endLineNumberExclusive,
        1
      ),
      new Range(
        modifiedRange.startLineNumber,
        1,
        modifiedRange.endLineNumberExclusive,
        1
      )
    ];
  }
  return [
    new Range(
      originalRange.startLineNumber - 1,
      Constants.MAX_SAFE_SMALL_INTEGER,
      originalRange.endLineNumberExclusive - 1,
      Constants.MAX_SAFE_SMALL_INTEGER
    ),
    new Range(
      modifiedRange.startLineNumber - 1,
      Constants.MAX_SAFE_SMALL_INTEGER,
      modifiedRange.endLineNumberExclusive - 1,
      Constants.MAX_SAFE_SMALL_INTEGER
    )
  ];
}
class LineRange {
  constructor(startLineNumber, lineCount) {
    this.startLineNumber = startLineNumber;
    this.lineCount = lineCount;
  }
  get isEmpty() {
    return this.lineCount === 0;
  }
  get endLineNumberExclusive() {
    return this.startLineNumber + this.lineCount;
  }
}
function createLineDeletion(startLineNumber, endLineNumber, modifiedLineNumber) {
  return {
    originalStartLineNumber: startLineNumber,
    originalEndLineNumber: endLineNumber,
    modifiedStartLineNumber: modifiedLineNumber,
    modifiedEndLineNumber: 0,
    charChanges: void 0
  };
}
function createLineInsertion(startLineNumber, endLineNumber, originalLineNumber) {
  return {
    originalStartLineNumber: originalLineNumber,
    originalEndLineNumber: 0,
    modifiedStartLineNumber: startLineNumber,
    modifiedEndLineNumber: endLineNumber,
    charChanges: void 0
  };
}
function createLineChange(originalStartLineNumber, originalEndLineNumber, modifiedStartLineNumber, modifiedEndLineNumber, charChanges) {
  return {
    originalStartLineNumber,
    originalEndLineNumber,
    modifiedStartLineNumber,
    modifiedEndLineNumber,
    charChanges
  };
}
function createCharChange(originalStartLineNumber, originalStartColumn, originalEndLineNumber, originalEndColumn, modifiedStartLineNumber, modifiedStartColumn, modifiedEndLineNumber, modifiedEndColumn) {
  return {
    originalStartLineNumber,
    originalStartColumn,
    originalEndLineNumber,
    originalEndColumn,
    modifiedStartLineNumber,
    modifiedStartColumn,
    modifiedEndLineNumber,
    modifiedEndColumn
  };
}
suite("Editor Diff - DiffComputer", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("one inserted line below", () => {
    const original = ["line"];
    const modified = ["line", "new line"];
    const expected = [createLineInsertion(2, 2, 1)];
    assertDiff(original, modified, expected);
  });
  test("two inserted lines below", () => {
    const original = ["line"];
    const modified = ["line", "new line", "another new line"];
    const expected = [createLineInsertion(2, 3, 1)];
    assertDiff(original, modified, expected);
  });
  test("one inserted line above", () => {
    const original = ["line"];
    const modified = ["new line", "line"];
    const expected = [createLineInsertion(1, 1, 0)];
    assertDiff(original, modified, expected);
  });
  test("two inserted lines above", () => {
    const original = ["line"];
    const modified = ["new line", "another new line", "line"];
    const expected = [createLineInsertion(1, 2, 0)];
    assertDiff(original, modified, expected);
  });
  test("one inserted line in middle", () => {
    const original = ["line1", "line2", "line3", "line4"];
    const modified = ["line1", "line2", "new line", "line3", "line4"];
    const expected = [createLineInsertion(3, 3, 2)];
    assertDiff(original, modified, expected);
  });
  test("two inserted lines in middle", () => {
    const original = ["line1", "line2", "line3", "line4"];
    const modified = ["line1", "line2", "new line", "another new line", "line3", "line4"];
    const expected = [createLineInsertion(3, 4, 2)];
    assertDiff(original, modified, expected);
  });
  test("two inserted lines in middle interrupted", () => {
    const original = ["line1", "line2", "line3", "line4"];
    const modified = ["line1", "line2", "new line", "line3", "another new line", "line4"];
    const expected = [createLineInsertion(3, 3, 2), createLineInsertion(5, 5, 3)];
    assertDiff(original, modified, expected);
  });
  test("one deleted line below", () => {
    const original = ["line", "new line"];
    const modified = ["line"];
    const expected = [createLineDeletion(2, 2, 1)];
    assertDiff(original, modified, expected);
  });
  test("two deleted lines below", () => {
    const original = ["line", "new line", "another new line"];
    const modified = ["line"];
    const expected = [createLineDeletion(2, 3, 1)];
    assertDiff(original, modified, expected);
  });
  test("one deleted lines above", () => {
    const original = ["new line", "line"];
    const modified = ["line"];
    const expected = [createLineDeletion(1, 1, 0)];
    assertDiff(original, modified, expected);
  });
  test("two deleted lines above", () => {
    const original = ["new line", "another new line", "line"];
    const modified = ["line"];
    const expected = [createLineDeletion(1, 2, 0)];
    assertDiff(original, modified, expected);
  });
  test("one deleted line in middle", () => {
    const original = ["line1", "line2", "new line", "line3", "line4"];
    const modified = ["line1", "line2", "line3", "line4"];
    const expected = [createLineDeletion(3, 3, 2)];
    assertDiff(original, modified, expected);
  });
  test("two deleted lines in middle", () => {
    const original = ["line1", "line2", "new line", "another new line", "line3", "line4"];
    const modified = ["line1", "line2", "line3", "line4"];
    const expected = [createLineDeletion(3, 4, 2)];
    assertDiff(original, modified, expected);
  });
  test("two deleted lines in middle interrupted", () => {
    const original = ["line1", "line2", "new line", "line3", "another new line", "line4"];
    const modified = ["line1", "line2", "line3", "line4"];
    const expected = [createLineDeletion(3, 3, 2), createLineDeletion(5, 5, 3)];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars inserted at the end", () => {
    const original = ["line"];
    const modified = ["line changed"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 5, 1, 5, 1, 5, 1, 13)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars inserted at the beginning", () => {
    const original = ["line"];
    const modified = ["my line"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 1, 1, 1, 1, 1, 1, 4)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars inserted in the middle", () => {
    const original = ["abba"];
    const modified = ["abzzba"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 3, 1, 3, 1, 3, 1, 5)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars inserted in the middle (two spots)", () => {
    const original = ["abba"];
    const modified = ["abzzbzza"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 3, 1, 3, 1, 3, 1, 5),
        createCharChange(1, 4, 1, 4, 1, 6, 1, 8)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars deleted 1", () => {
    const original = ["abcdefg"];
    const modified = ["abcfg"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 4, 1, 6, 1, 4, 1, 4)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("one line changed: chars deleted 2", () => {
    const original = ["abcdefg"];
    const modified = ["acfg"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 2, 1, 3, 1, 2, 1, 2),
        createCharChange(1, 4, 1, 6, 1, 3, 1, 3)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("two lines changed 1", () => {
    const original = ["abcd", "efgh"];
    const modified = ["abcz"];
    const expected = [
      createLineChange(1, 2, 1, 1, [
        createCharChange(1, 4, 2, 5, 1, 4, 1, 5)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("two lines changed 2", () => {
    const original = ["foo", "abcd", "efgh", "BAR"];
    const modified = ["foo", "abcz", "BAR"];
    const expected = [
      createLineChange(2, 3, 2, 2, [
        createCharChange(2, 4, 3, 5, 2, 4, 2, 5)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("two lines changed 3", () => {
    const original = ["foo", "abcd", "efgh", "BAR"];
    const modified = ["foo", "abcz", "zzzzefgh", "BAR"];
    const expected = [
      createLineChange(2, 3, 2, 3, [
        createCharChange(2, 4, 2, 5, 2, 4, 2, 5),
        createCharChange(3, 1, 3, 1, 3, 1, 3, 5)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("two lines changed 4", () => {
    const original = ["abc"];
    const modified = ["", "", "axc", ""];
    const expected = [
      createLineChange(1, 1, 1, 4, [
        createCharChange(1, 1, 1, 1, 1, 1, 3, 1),
        createCharChange(1, 2, 1, 3, 3, 2, 3, 3),
        createCharChange(1, 4, 1, 4, 3, 4, 4, 1)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("empty original sequence in char diff", () => {
    const original = ["abc", "", "xyz"];
    const modified = ["abc", "qwe", "rty", "xyz"];
    const expected = [
      createLineChange(2, 2, 2, 3)
    ];
    assertDiff(original, modified, expected);
  });
  test("three lines changed", () => {
    const original = ["foo", "abcd", "efgh", "BAR"];
    const modified = ["foo", "zzzefgh", "xxx", "BAR"];
    const expected = [
      createLineChange(2, 3, 2, 3, [
        createCharChange(2, 1, 3, 1, 2, 1, 2, 4),
        createCharChange(3, 5, 3, 5, 2, 8, 3, 4)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("big change part 1", () => {
    const original = ["foo", "abcd", "efgh", "BAR"];
    const modified = ["hello", "foo", "zzzefgh", "xxx", "BAR"];
    const expected = [
      createLineInsertion(1, 1, 0),
      createLineChange(2, 3, 3, 4, [
        createCharChange(2, 1, 3, 1, 3, 1, 3, 4),
        createCharChange(3, 5, 3, 5, 3, 8, 4, 4)
      ])
    ];
    assertDiff(original, modified, expected);
  });
  test("big change part 2", () => {
    const original = ["foo", "abcd", "efgh", "BAR", "RAB"];
    const modified = ["hello", "foo", "zzzefgh", "xxx", "BAR"];
    const expected = [
      createLineInsertion(1, 1, 0),
      createLineChange(2, 3, 3, 4, [
        createCharChange(2, 1, 3, 1, 3, 1, 3, 4),
        createCharChange(3, 5, 3, 5, 3, 8, 4, 4)
      ]),
      createLineDeletion(5, 5, 5)
    ];
    assertDiff(original, modified, expected);
  });
  test("char change postprocessing merges", () => {
    const original = ["abba"];
    const modified = ["azzzbzzzbzzza"];
    const expected = [
      createLineChange(1, 1, 1, 1, [
        createCharChange(1, 2, 1, 4, 1, 2, 1, 13)
      ])
    ];
    assertDiff(original, modified, expected, true, true);
  });
  test("ignore trim whitespace", () => {
    const original = ["		 foo ", "abcd", "efgh", "		 BAR		"];
    const modified = ["  hello	", "	 foo   	", "zzzefgh", "xxx", "   BAR   	"];
    const expected = [
      createLineInsertion(1, 1, 0),
      createLineChange(2, 3, 3, 4, [
        createCharChange(2, 1, 2, 5, 3, 1, 3, 4),
        createCharChange(3, 5, 3, 5, 4, 1, 4, 4)
      ])
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("issue #12122 r.hasOwnProperty is not a function", () => {
    const original = ["hasOwnProperty"];
    const modified = ["hasOwnProperty", "and another line"];
    const expected = [
      createLineInsertion(2, 2, 1)
    ];
    assertDiff(original, modified, expected);
  });
  test("empty diff 1", () => {
    const original = [""];
    const modified = ["something"];
    const expected = [
      createLineChange(1, 1, 1, 1, void 0)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("empty diff 2", () => {
    const original = [""];
    const modified = ["something", "something else"];
    const expected = [
      createLineChange(1, 1, 1, 2, void 0)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("empty diff 3", () => {
    const original = ["something", "something else"];
    const modified = [""];
    const expected = [
      createLineChange(1, 2, 1, 1, void 0)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("empty diff 4", () => {
    const original = ["something"];
    const modified = [""];
    const expected = [
      createLineChange(1, 1, 1, 1, void 0)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("empty diff 5", () => {
    const original = [""];
    const modified = [""];
    const expected = [];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("pretty diff 1", () => {
    const original = [
      "suite(function () {",
      "	test1() {",
      "		assert.ok(true);",
      "	}",
      "",
      "	test2() {",
      "		assert.ok(true);",
      "	}",
      "});",
      ""
    ];
    const modified = [
      "// An insertion",
      "suite(function () {",
      "	test1() {",
      "		assert.ok(true);",
      "	}",
      "",
      "	test2() {",
      "		assert.ok(true);",
      "	}",
      "",
      "	test3() {",
      "		assert.ok(true);",
      "	}",
      "});",
      ""
    ];
    const expected = [
      createLineInsertion(1, 1, 0),
      createLineInsertion(10, 13, 8)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("pretty diff 2", () => {
    const original = [
      "// Just a comment",
      "",
      "function compute(a, b, c, d) {",
      "	if (a) {",
      "		if (b) {",
      "			if (c) {",
      "				return 5;",
      "			}",
      "		}",
      "		// These next lines will be deleted",
      "		if (d) {",
      "			return -1;",
      "		}",
      "		return 0;",
      "	}",
      "}"
    ];
    const modified = [
      "// Here is an inserted line",
      "// and another inserted line",
      "// and another one",
      "// Just a comment",
      "",
      "function compute(a, b, c, d) {",
      "	if (a) {",
      "		if (b) {",
      "			if (c) {",
      "				return 5;",
      "			}",
      "		}",
      "		return 0;",
      "	}",
      "}"
    ];
    const expected = [
      createLineInsertion(1, 3, 0),
      createLineDeletion(10, 13, 12)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("pretty diff 3", () => {
    const original = [
      "class A {",
      "	/**",
      "	 * m1",
      "	 */",
      "	method1() {}",
      "",
      "	/**",
      "	 * m3",
      "	 */",
      "	method3() {}",
      "}"
    ];
    const modified = [
      "class A {",
      "	/**",
      "	 * m1",
      "	 */",
      "	method1() {}",
      "",
      "	/**",
      "	 * m2",
      "	 */",
      "	method2() {}",
      "",
      "	/**",
      "	 * m3",
      "	 */",
      "	method3() {}",
      "}"
    ];
    const expected = [
      createLineInsertion(7, 11, 6)
    ];
    assertDiff(original, modified, expected, true, false, true);
  });
  test("issue #23636", () => {
    const original = [
      "if(!TextDrawLoad[playerid])",
      "{",
      "",
      "	TextDrawHideForPlayer(playerid,TD_AppleJob[3]);",
      "	TextDrawHideForPlayer(playerid,TD_AppleJob[4]);",
      "	if(!AppleJobTreesType[AppleJobTreesPlayerNum[playerid]])",
      "	{",
      "		for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[5+i]);",
      "	}",
      "	else",
      "	{",
      "		for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[15+i]);",
      "	}",
      "}",
      "else",
      "{",
      "	TextDrawHideForPlayer(playerid,TD_AppleJob[3]);",
      "	TextDrawHideForPlayer(playerid,TD_AppleJob[27]);",
      "	if(!AppleJobTreesType[AppleJobTreesPlayerNum[playerid]])",
      "	{",
      "		for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[28+i]);",
      "	}",
      "	else",
      "	{",
      "		for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[38+i]);",
      "	}",
      "}"
    ];
    const modified = [
      "	if(!TextDrawLoad[playerid])",
      "	{",
      "	",
      "		TextDrawHideForPlayer(playerid,TD_AppleJob[3]);",
      "		TextDrawHideForPlayer(playerid,TD_AppleJob[4]);",
      "		if(!AppleJobTreesType[AppleJobTreesPlayerNum[playerid]])",
      "		{",
      "			for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[5+i]);",
      "		}",
      "		else",
      "		{",
      "			for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[15+i]);",
      "		}",
      "	}",
      "	else",
      "	{",
      "		TextDrawHideForPlayer(playerid,TD_AppleJob[3]);",
      "		TextDrawHideForPlayer(playerid,TD_AppleJob[27]);",
      "		if(!AppleJobTreesType[AppleJobTreesPlayerNum[playerid]])",
      "		{",
      "			for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[28+i]);",
      "		}",
      "		else",
      "		{",
      "			for(new i=0;i<10;i++) if(StatusTD_AppleJobApples[playerid][i]) TextDrawHideForPlayer(playerid,TD_AppleJob[38+i]);",
      "		}",
      "	}"
    ];
    const expected = [
      createLineChange(
        1,
        27,
        1,
        27,
        [
          createCharChange(1, 1, 1, 1, 1, 1, 1, 2),
          createCharChange(2, 1, 2, 1, 2, 1, 2, 2),
          createCharChange(3, 1, 3, 1, 3, 1, 3, 2),
          createCharChange(4, 1, 4, 1, 4, 1, 4, 2),
          createCharChange(5, 1, 5, 1, 5, 1, 5, 2),
          createCharChange(6, 1, 6, 1, 6, 1, 6, 2),
          createCharChange(7, 1, 7, 1, 7, 1, 7, 2),
          createCharChange(8, 1, 8, 1, 8, 1, 8, 2),
          createCharChange(9, 1, 9, 1, 9, 1, 9, 2),
          createCharChange(10, 1, 10, 1, 10, 1, 10, 2),
          createCharChange(11, 1, 11, 1, 11, 1, 11, 2),
          createCharChange(12, 1, 12, 1, 12, 1, 12, 2),
          createCharChange(13, 1, 13, 1, 13, 1, 13, 2),
          createCharChange(14, 1, 14, 1, 14, 1, 14, 2),
          createCharChange(15, 1, 15, 1, 15, 1, 15, 2),
          createCharChange(16, 1, 16, 1, 16, 1, 16, 2),
          createCharChange(17, 1, 17, 1, 17, 1, 17, 2),
          createCharChange(18, 1, 18, 1, 18, 1, 18, 2),
          createCharChange(19, 1, 19, 1, 19, 1, 19, 2),
          createCharChange(20, 1, 20, 1, 20, 1, 20, 2),
          createCharChange(21, 1, 21, 1, 21, 1, 21, 2),
          createCharChange(22, 1, 22, 1, 22, 1, 22, 2),
          createCharChange(23, 1, 23, 1, 23, 1, 23, 2),
          createCharChange(24, 1, 24, 1, 24, 1, 24, 2),
          createCharChange(25, 1, 25, 1, 25, 1, 25, 2),
          createCharChange(26, 1, 26, 1, 26, 1, 26, 2),
          createCharChange(27, 1, 27, 1, 27, 1, 27, 2)
        ]
      )
      // createLineInsertion(7, 11, 6)
    ];
    assertDiff(original, modified, expected, true, true, false);
  });
  test("issue #43922", () => {
    const original = [
      " * `yarn [install]` -- Install project NPM dependencies. This is automatically done when you first create the project. You should only need to run this if you add dependencies in `package.json`."
    ];
    const modified = [
      " * `yarn` -- Install project NPM dependencies. You should only need to run this if you add dependencies in `package.json`."
    ];
    const expected = [
      createLineChange(
        1,
        1,
        1,
        1,
        [
          createCharChange(1, 9, 1, 19, 1, 9, 1, 9),
          createCharChange(1, 58, 1, 120, 1, 48, 1, 48)
        ]
      )
    ];
    assertDiff(original, modified, expected, true, true, false);
  });
  test("issue #42751", () => {
    const original = [
      "    1",
      "  2"
    ];
    const modified = [
      "    1",
      "   3"
    ];
    const expected = [
      createLineChange(
        2,
        2,
        2,
        2,
        [
          createCharChange(2, 3, 2, 4, 2, 3, 2, 5)
        ]
      )
    ];
    assertDiff(original, modified, expected, true, true, false);
  });
  test("does not give character changes", () => {
    const original = [
      "    1",
      "  2",
      "A"
    ];
    const modified = [
      "    1",
      "   3",
      " A"
    ];
    const expected = [
      createLineChange(
        2,
        3,
        2,
        3
      )
    ];
    assertDiff(original, modified, expected, false, false, false);
  });
  test("issue #44422: Less than ideal diff results", () => {
    const original = [
      "export class C {",
      "",
      "	public m1(): void {",
      "		{",
      "		//2",
      "		//3",
      "		//4",
      "		//5",
      "		//6",
      "		//7",
      "		//8",
      "		//9",
      "		//10",
      "		//11",
      "		//12",
      "		//13",
      "		//14",
      "		//15",
      "		//16",
      "		//17",
      "		//18",
      "		}",
      "	}",
      "",
      "	public m2(): void {",
      "		if (a) {",
      "			if (b) {",
      "				//A1",
      "				//A2",
      "				//A3",
      "				//A4",
      "				//A5",
      "				//A6",
      "				//A7",
      "				//A8",
      "			}",
      "		}",
      "",
      "		//A9",
      "		//A10",
      "		//A11",
      "		//A12",
      "		//A13",
      "		//A14",
      "		//A15",
      "	}",
      "",
      "	public m3(): void {",
      "		if (a) {",
      "			//B1",
      "		}",
      "		//B2",
      "		//B3",
      "	}",
      "",
      "	public m4(): boolean {",
      "		//1",
      "		//2",
      "		//3",
      "		//4",
      "	}",
      "",
      "}"
    ];
    const modified = [
      "export class C {",
      "",
      "	constructor() {",
      "",
      "",
      "",
      "",
      "	}",
      "",
      "	public m1(): void {",
      "		{",
      "		//2",
      "		//3",
      "		//4",
      "		//5",
      "		//6",
      "		//7",
      "		//8",
      "		//9",
      "		//10",
      "		//11",
      "		//12",
      "		//13",
      "		//14",
      "		//15",
      "		//16",
      "		//17",
      "		//18",
      "		}",
      "	}",
      "",
      "	public m4(): boolean {",
      "		//1",
      "		//2",
      "		//3",
      "		//4",
      "	}",
      "",
      "}"
    ];
    const expected = [
      createLineChange(
        2,
        0,
        3,
        9
      ),
      createLineChange(
        25,
        55,
        31,
        0
      )
    ];
    assertDiff(original, modified, expected, false, false, false);
  });
  test("gives preference to matching longer lines", () => {
    const original = [
      "A",
      "A",
      "BB",
      "C"
    ];
    const modified = [
      "A",
      "BB",
      "A",
      "D",
      "E",
      "A",
      "C"
    ];
    const expected = [
      createLineChange(
        2,
        2,
        1,
        0
      ),
      createLineChange(
        3,
        0,
        3,
        6
      )
    ];
    assertDiff(original, modified, expected, false, false, false);
  });
  test("issue #119051: gives preference to fewer diff hunks", () => {
    const original = [
      "1",
      "",
      "",
      "2",
      ""
    ];
    const modified = [
      "1",
      "",
      "1.5",
      "",
      "",
      "2",
      "",
      "3",
      ""
    ];
    const expected = [
      createLineChange(
        2,
        0,
        3,
        4
      ),
      createLineChange(
        5,
        0,
        8,
        9
      )
    ];
    assertDiff(original, modified, expected, false, false, false);
  });
  test("issue #121436: Diff chunk contains an unchanged line part 1", () => {
    const original = [
      "if (cond) {",
      "    cmd",
      "}"
    ];
    const modified = [
      "if (cond) {",
      "    if (other_cond) {",
      "        cmd",
      "    }",
      "}"
    ];
    const expected = [
      createLineChange(
        1,
        0,
        2,
        2
      ),
      createLineChange(
        2,
        0,
        4,
        4
      )
    ];
    assertDiff(original, modified, expected, false, false, true);
  });
  test("issue #121436: Diff chunk contains an unchanged line part 2", () => {
    const original = [
      "if (cond) {",
      "    cmd",
      "}"
    ];
    const modified = [
      "if (cond) {",
      "    if (other_cond) {",
      "        cmd",
      "    }",
      "}"
    ];
    const expected = [
      createLineChange(
        1,
        0,
        2,
        2
      ),
      createLineChange(
        2,
        2,
        3,
        3
      ),
      createLineChange(
        2,
        0,
        4,
        4
      )
    ];
    assertDiff(original, modified, expected, false, false, false);
  });
  test("issue #169552: Assertion error when having both leading and trailing whitespace diffs", () => {
    const original = [
      "if True:",
      "    print(2)"
    ];
    const modified = [
      "if True:",
      "	print(2) "
    ];
    const expected = [
      createLineChange(
        2,
        2,
        2,
        2,
        [
          createCharChange(2, 1, 2, 5, 2, 1, 2, 2),
          createCharChange(2, 13, 2, 13, 2, 10, 2, 11)
        ]
      )
    ];
    assertDiff(original, modified, expected, true, false, false);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vZGlmZi9kaWZmQ29tcHV0ZXIudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDb25zdGFudHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEaWZmQ29tcHV0ZXIsIElDaGFyQ2hhbmdlLCBJTGluZUNoYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9kaWZmL2xlZ2FjeUxpbmVzRGlmZkNvbXB1dGVyLmpzJztcbmltcG9ydCB7IElJZGVudGlmaWVkU2luZ2xlRWRpdE9wZXJhdGlvbiwgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcblxuZnVuY3Rpb24gYXNzZXJ0RGlmZihvcmlnaW5hbExpbmVzOiBzdHJpbmdbXSwgbW9kaWZpZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkQ2hhbmdlczogSUxpbmVDaGFuZ2VbXSwgc2hvdWxkQ29tcHV0ZUNoYXJDaGFuZ2VzOiBib29sZWFuID0gdHJ1ZSwgc2hvdWxkUG9zdFByb2Nlc3NDaGFyQ2hhbmdlczogYm9vbGVhbiA9IGZhbHNlLCBzaG91bGRJZ25vcmVUcmltV2hpdGVzcGFjZTogYm9vbGVhbiA9IGZhbHNlKSB7XG5cdGNvbnN0IGRpZmZDb21wdXRlciA9IG5ldyBEaWZmQ29tcHV0ZXIob3JpZ2luYWxMaW5lcywgbW9kaWZpZWRMaW5lcywge1xuXHRcdHNob3VsZENvbXB1dGVDaGFyQ2hhbmdlcyxcblx0XHRzaG91bGRQb3N0UHJvY2Vzc0NoYXJDaGFuZ2VzLFxuXHRcdHNob3VsZElnbm9yZVRyaW1XaGl0ZXNwYWNlLFxuXHRcdHNob3VsZE1ha2VQcmV0dHlEaWZmOiB0cnVlLFxuXHRcdG1heENvbXB1dGF0aW9uVGltZTogMFxuXHR9KTtcblx0Y29uc3QgY2hhbmdlcyA9IGRpZmZDb21wdXRlci5jb21wdXRlRGlmZigpLmNoYW5nZXM7XG5cblx0Y29uc3QgbWFwQ2hhckNoYW5nZSA9IChjaGFyQ2hhbmdlOiBJQ2hhckNoYW5nZSkgPT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogY2hhckNoYW5nZS5vcmlnaW5hbFN0YXJ0TGluZU51bWJlcixcblx0XHRcdG9yaWdpbmFsU3RhcnRDb2x1bW46IGNoYXJDaGFuZ2Uub3JpZ2luYWxTdGFydENvbHVtbixcblx0XHRcdG9yaWdpbmFsRW5kTGluZU51bWJlcjogY2hhckNoYW5nZS5vcmlnaW5hbEVuZExpbmVOdW1iZXIsXG5cdFx0XHRvcmlnaW5hbEVuZENvbHVtbjogY2hhckNoYW5nZS5vcmlnaW5hbEVuZENvbHVtbixcblx0XHRcdG1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyOiBjaGFyQ2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0bW9kaWZpZWRTdGFydENvbHVtbjogY2hhckNoYW5nZS5tb2RpZmllZFN0YXJ0Q29sdW1uLFxuXHRcdFx0bW9kaWZpZWRFbmRMaW5lTnVtYmVyOiBjaGFyQ2hhbmdlLm1vZGlmaWVkRW5kTGluZU51bWJlcixcblx0XHRcdG1vZGlmaWVkRW5kQ29sdW1uOiBjaGFyQ2hhbmdlLm1vZGlmaWVkRW5kQ29sdW1uLFxuXHRcdH07XG5cdH07XG5cblx0Y29uc3QgYWN0dWFsID0gY2hhbmdlcy5tYXAoKGxpbmVDaGFuZ2UpID0+IHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0b3JpZ2luYWxTdGFydExpbmVOdW1iZXI6IGxpbmVDaGFuZ2Uub3JpZ2luYWxTdGFydExpbmVOdW1iZXIsXG5cdFx0XHRvcmlnaW5hbEVuZExpbmVOdW1iZXI6IGxpbmVDaGFuZ2Uub3JpZ2luYWxFbmRMaW5lTnVtYmVyLFxuXHRcdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IGxpbmVDaGFuZ2UubW9kaWZpZWRTdGFydExpbmVOdW1iZXIsXG5cdFx0XHRtb2RpZmllZEVuZExpbmVOdW1iZXI6IGxpbmVDaGFuZ2UubW9kaWZpZWRFbmRMaW5lTnVtYmVyLFxuXHRcdFx0Y2hhckNoYW5nZXM6IChsaW5lQ2hhbmdlLmNoYXJDaGFuZ2VzID8gbGluZUNoYW5nZS5jaGFyQ2hhbmdlcy5tYXAobWFwQ2hhckNoYW5nZSkgOiB1bmRlZmluZWQpXG5cdFx0fTtcblx0fSk7XG5cblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkQ2hhbmdlcyk7XG5cblx0aWYgKCFzaG91bGRJZ25vcmVUcmltV2hpdGVzcGFjZSkge1xuXHRcdC8vIFRoZSBkaWZmcyBzaG91bGQgZGVzY3JpYmUgaG93IHRvIGFwcGx5IGVkaXRzIHRvIHRoZSBvcmlnaW5hbCB0ZXh0IG1vZGVsIHRvIGdldCB0byB0aGUgbW9kaWZpZWQgdGV4dCBtb2RlbC5cblxuXHRcdGNvbnN0IG1vZGlmaWVkVGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKG1vZGlmaWVkTGluZXMuam9pbignXFxuJykpO1xuXHRcdGNvbnN0IGV4cGVjdGVkVmFsdWUgPSBtb2RpZmllZFRleHRNb2RlbC5nZXRWYWx1ZSgpO1xuXG5cdFx0e1xuXHRcdFx0Ly8gTGluZSBjaGFuZ2VzOlxuXHRcdFx0Y29uc3Qgb3JpZ2luYWxUZXh0TW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwob3JpZ2luYWxMaW5lcy5qb2luKCdcXG4nKSk7XG5cdFx0XHRvcmlnaW5hbFRleHRNb2RlbC5hcHBseUVkaXRzKGNoYW5nZXMubWFwKGMgPT4gZ2V0TGluZUVkaXQoYywgbW9kaWZpZWRUZXh0TW9kZWwpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9yaWdpbmFsVGV4dE1vZGVsLmdldFZhbHVlKCksIGV4cGVjdGVkVmFsdWUpO1xuXHRcdFx0b3JpZ2luYWxUZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdGlmIChzaG91bGRDb21wdXRlQ2hhckNoYW5nZXMpIHtcblx0XHRcdC8vIENoYXIgY2hhbmdlczpcblx0XHRcdGNvbnN0IG9yaWdpbmFsVGV4dE1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKG9yaWdpbmFsTGluZXMuam9pbignXFxuJykpO1xuXHRcdFx0b3JpZ2luYWxUZXh0TW9kZWwuYXBwbHlFZGl0cyhjaGFuZ2VzLmZsYXRNYXAoYyA9PiBnZXRDaGFyRWRpdHMoYywgbW9kaWZpZWRUZXh0TW9kZWwpKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9yaWdpbmFsVGV4dE1vZGVsLmdldFZhbHVlKCksIGV4cGVjdGVkVmFsdWUpO1xuXHRcdFx0b3JpZ2luYWxUZXh0TW9kZWwuZGlzcG9zZSgpO1xuXHRcdH1cblxuXHRcdG1vZGlmaWVkVGV4dE1vZGVsLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBnZXRDaGFyRWRpdHMobGluZUNoYW5nZTogSUxpbmVDaGFuZ2UsIG1vZGlmaWVkVGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uW10ge1xuXHRpZiAoIWxpbmVDaGFuZ2UuY2hhckNoYW5nZXMpIHtcblx0XHRyZXR1cm4gW2dldExpbmVFZGl0KGxpbmVDaGFuZ2UsIG1vZGlmaWVkVGV4dE1vZGVsKV07XG5cdH1cblx0cmV0dXJuIGxpbmVDaGFuZ2UuY2hhckNoYW5nZXMubWFwKGMgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsUmFuZ2UgPSBuZXcgUmFuZ2UoYy5vcmlnaW5hbFN0YXJ0TGluZU51bWJlciwgYy5vcmlnaW5hbFN0YXJ0Q29sdW1uLCBjLm9yaWdpbmFsRW5kTGluZU51bWJlciwgYy5vcmlnaW5hbEVuZENvbHVtbik7XG5cdFx0Y29uc3QgbW9kaWZpZWRSYW5nZSA9IG5ldyBSYW5nZShjLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLCBjLm1vZGlmaWVkU3RhcnRDb2x1bW4sIGMubW9kaWZpZWRFbmRMaW5lTnVtYmVyLCBjLm1vZGlmaWVkRW5kQ29sdW1uKTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmFuZ2U6IG9yaWdpbmFsUmFuZ2UsXG5cdFx0XHR0ZXh0OiBtb2RpZmllZFRleHRNb2RlbC5nZXRWYWx1ZUluUmFuZ2UobW9kaWZpZWRSYW5nZSlcblx0XHR9O1xuXHR9KTtcbn1cblxuZnVuY3Rpb24gZ2V0TGluZUVkaXQobGluZUNoYW5nZTogSUxpbmVDaGFuZ2UsIG1vZGlmaWVkVGV4dE1vZGVsOiBJVGV4dE1vZGVsKTogSUlkZW50aWZpZWRTaW5nbGVFZGl0T3BlcmF0aW9uIHtcblx0bGV0IG9yaWdpbmFsUmFuZ2U6IExpbmVSYW5nZTtcblx0aWYgKGxpbmVDaGFuZ2Uub3JpZ2luYWxFbmRMaW5lTnVtYmVyID09PSAwKSB7XG5cdFx0Ly8gSW5zZXJ0aW9uXG5cdFx0b3JpZ2luYWxSYW5nZSA9IG5ldyBMaW5lUmFuZ2UobGluZUNoYW5nZS5vcmlnaW5hbFN0YXJ0TGluZU51bWJlciArIDEsIDApO1xuXHR9IGVsc2Uge1xuXHRcdG9yaWdpbmFsUmFuZ2UgPSBuZXcgTGluZVJhbmdlKGxpbmVDaGFuZ2Uub3JpZ2luYWxTdGFydExpbmVOdW1iZXIsIGxpbmVDaGFuZ2Uub3JpZ2luYWxFbmRMaW5lTnVtYmVyIC0gbGluZUNoYW5nZS5vcmlnaW5hbFN0YXJ0TGluZU51bWJlciArIDEpO1xuXHR9XG5cblx0bGV0IG1vZGlmaWVkUmFuZ2U6IExpbmVSYW5nZTtcblx0aWYgKGxpbmVDaGFuZ2UubW9kaWZpZWRFbmRMaW5lTnVtYmVyID09PSAwKSB7XG5cdFx0Ly8gRGVsZXRpb25cblx0XHRtb2RpZmllZFJhbmdlID0gbmV3IExpbmVSYW5nZShsaW5lQ2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyICsgMSwgMCk7XG5cdH0gZWxzZSB7XG5cdFx0bW9kaWZpZWRSYW5nZSA9IG5ldyBMaW5lUmFuZ2UobGluZUNoYW5nZS5tb2RpZmllZFN0YXJ0TGluZU51bWJlciwgbGluZUNoYW5nZS5tb2RpZmllZEVuZExpbmVOdW1iZXIgLSBsaW5lQ2hhbmdlLm1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyICsgMSk7XG5cdH1cblxuXHRjb25zdCBbcjEsIHIyXSA9IGRpZmZGcm9tTGluZVJhbmdlcyhvcmlnaW5hbFJhbmdlLCBtb2RpZmllZFJhbmdlKTtcblx0cmV0dXJuIHtcblx0XHRyYW5nZTogcjEsXG5cdFx0dGV4dDogbW9kaWZpZWRUZXh0TW9kZWwuZ2V0VmFsdWVJblJhbmdlKHIyKSxcblx0fTtcbn1cblxuZnVuY3Rpb24gZGlmZkZyb21MaW5lUmFuZ2VzKG9yaWdpbmFsUmFuZ2U6IExpbmVSYW5nZSwgbW9kaWZpZWRSYW5nZTogTGluZVJhbmdlKTogW1JhbmdlLCBSYW5nZV0ge1xuXHRpZiAob3JpZ2luYWxSYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IDEgfHwgbW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIgPT09IDEpIHtcblx0XHRpZiAoIW9yaWdpbmFsUmFuZ2UuaXNFbXB0eSAmJiAhbW9kaWZpZWRSYW5nZS5pc0VtcHR5KSB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRuZXcgUmFuZ2UoXG5cdFx0XHRcdFx0b3JpZ2luYWxSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0MSxcblx0XHRcdFx0XHRvcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0XHRcdENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdFx0XHQpLFxuXHRcdFx0XHRuZXcgUmFuZ2UoXG5cdFx0XHRcdFx0bW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0MSxcblx0XHRcdFx0XHRtb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0XHRcdENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdFx0XHQpXG5cdFx0XHRdO1xuXHRcdH1cblxuXHRcdC8vIFdoZW4gb25lIG9mIHRoZW0gaXMgb25lIGFuZCBvbmUgb2YgdGhlbSBpcyBlbXB0eSwgdGhlIG90aGVyIGNhbm5vdCBiZSB0aGUgbGFzdCBsaW5lIG9mIHRoZSBkb2N1bWVudFxuXHRcdHJldHVybiBbXG5cdFx0XHRuZXcgUmFuZ2UoXG5cdFx0XHRcdG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHQxLFxuXHRcdFx0XHRvcmlnaW5hbFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUsXG5cdFx0XHRcdDEsXG5cdFx0XHQpLFxuXHRcdFx0bmV3IFJhbmdlKFxuXHRcdFx0XHRtb2RpZmllZFJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0MSxcblx0XHRcdFx0bW9kaWZpZWRSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlLFxuXHRcdFx0XHQxLFxuXHRcdFx0KVxuXHRcdF07XG5cdH1cblxuXHRyZXR1cm4gW1xuXHRcdG5ldyBSYW5nZShcblx0XHRcdG9yaWdpbmFsUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSxcblx0XHRcdENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdFx0b3JpZ2luYWxSYW5nZS5lbmRMaW5lTnVtYmVyRXhjbHVzaXZlIC0gMSxcblx0XHRcdENvbnN0YW50cy5NQVhfU0FGRV9TTUFMTF9JTlRFR0VSLFxuXHRcdCksXG5cdFx0bmV3IFJhbmdlKFxuXHRcdFx0bW9kaWZpZWRSYW5nZS5zdGFydExpbmVOdW1iZXIgLSAxLFxuXHRcdFx0Q29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsXG5cdFx0XHRtb2RpZmllZFJhbmdlLmVuZExpbmVOdW1iZXJFeGNsdXNpdmUgLSAxLFxuXHRcdFx0Q29uc3RhbnRzLk1BWF9TQUZFX1NNQUxMX0lOVEVHRVIsXG5cdFx0KVxuXHRdO1xufVxuXG5jbGFzcyBMaW5lUmFuZ2Uge1xuXHRwdWJsaWMgY29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLFxuXHRcdHB1YmxpYyByZWFkb25seSBsaW5lQ291bnQ6IG51bWJlclxuXHQpIHsgfVxuXG5cdHB1YmxpYyBnZXQgaXNFbXB0eSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5saW5lQ291bnQgPT09IDA7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGVuZExpbmVOdW1iZXJFeGNsdXNpdmUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5zdGFydExpbmVOdW1iZXIgKyB0aGlzLmxpbmVDb3VudDtcblx0fVxufVxuXG5mdW5jdGlvbiBjcmVhdGVMaW5lRGVsZXRpb24oc3RhcnRMaW5lTnVtYmVyOiBudW1iZXIsIGVuZExpbmVOdW1iZXI6IG51bWJlciwgbW9kaWZpZWRMaW5lTnVtYmVyOiBudW1iZXIpOiBJTGluZUNoYW5nZSB7XG5cdHJldHVybiB7XG5cdFx0b3JpZ2luYWxTdGFydExpbmVOdW1iZXI6IHN0YXJ0TGluZU51bWJlcixcblx0XHRvcmlnaW5hbEVuZExpbmVOdW1iZXI6IGVuZExpbmVOdW1iZXIsXG5cdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IG1vZGlmaWVkTGluZU51bWJlcixcblx0XHRtb2RpZmllZEVuZExpbmVOdW1iZXI6IDAsXG5cdFx0Y2hhckNoYW5nZXM6IHVuZGVmaW5lZFxuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVMaW5lSW5zZXJ0aW9uKHN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBudW1iZXIsIG9yaWdpbmFsTGluZU51bWJlcjogbnVtYmVyKTogSUxpbmVDaGFuZ2Uge1xuXHRyZXR1cm4ge1xuXHRcdG9yaWdpbmFsU3RhcnRMaW5lTnVtYmVyOiBvcmlnaW5hbExpbmVOdW1iZXIsXG5cdFx0b3JpZ2luYWxFbmRMaW5lTnVtYmVyOiAwLFxuXHRcdG1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyOiBzdGFydExpbmVOdW1iZXIsXG5cdFx0bW9kaWZpZWRFbmRMaW5lTnVtYmVyOiBlbmRMaW5lTnVtYmVyLFxuXHRcdGNoYXJDaGFuZ2VzOiB1bmRlZmluZWRcblx0fTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlTGluZUNoYW5nZShvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBvcmlnaW5hbEVuZExpbmVOdW1iZXI6IG51bWJlciwgbW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IG51bWJlciwgbW9kaWZpZWRFbmRMaW5lTnVtYmVyOiBudW1iZXIsIGNoYXJDaGFuZ2VzPzogSUNoYXJDaGFuZ2VbXSk6IElMaW5lQ2hhbmdlIHtcblx0cmV0dXJuIHtcblx0XHRvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogb3JpZ2luYWxTdGFydExpbmVOdW1iZXIsXG5cdFx0b3JpZ2luYWxFbmRMaW5lTnVtYmVyOiBvcmlnaW5hbEVuZExpbmVOdW1iZXIsXG5cdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IG1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLFxuXHRcdG1vZGlmaWVkRW5kTGluZU51bWJlcjogbW9kaWZpZWRFbmRMaW5lTnVtYmVyLFxuXHRcdGNoYXJDaGFuZ2VzOiBjaGFyQ2hhbmdlc1xuXHR9O1xufVxuXG5mdW5jdGlvbiBjcmVhdGVDaGFyQ2hhbmdlKFxuXHRvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBvcmlnaW5hbFN0YXJ0Q29sdW1uOiBudW1iZXIsIG9yaWdpbmFsRW5kTGluZU51bWJlcjogbnVtYmVyLCBvcmlnaW5hbEVuZENvbHVtbjogbnVtYmVyLFxuXHRtb2RpZmllZFN0YXJ0TGluZU51bWJlcjogbnVtYmVyLCBtb2RpZmllZFN0YXJ0Q29sdW1uOiBudW1iZXIsIG1vZGlmaWVkRW5kTGluZU51bWJlcjogbnVtYmVyLCBtb2RpZmllZEVuZENvbHVtbjogbnVtYmVyXG4pIHtcblx0cmV0dXJuIHtcblx0XHRvcmlnaW5hbFN0YXJ0TGluZU51bWJlcjogb3JpZ2luYWxTdGFydExpbmVOdW1iZXIsXG5cdFx0b3JpZ2luYWxTdGFydENvbHVtbjogb3JpZ2luYWxTdGFydENvbHVtbixcblx0XHRvcmlnaW5hbEVuZExpbmVOdW1iZXI6IG9yaWdpbmFsRW5kTGluZU51bWJlcixcblx0XHRvcmlnaW5hbEVuZENvbHVtbjogb3JpZ2luYWxFbmRDb2x1bW4sXG5cdFx0bW9kaWZpZWRTdGFydExpbmVOdW1iZXI6IG1vZGlmaWVkU3RhcnRMaW5lTnVtYmVyLFxuXHRcdG1vZGlmaWVkU3RhcnRDb2x1bW46IG1vZGlmaWVkU3RhcnRDb2x1bW4sXG5cdFx0bW9kaWZpZWRFbmRMaW5lTnVtYmVyOiBtb2RpZmllZEVuZExpbmVOdW1iZXIsXG5cdFx0bW9kaWZpZWRFbmRDb2x1bW46IG1vZGlmaWVkRW5kQ29sdW1uXG5cdH07XG59XG5cbnN1aXRlKCdFZGl0b3IgRGlmZiAtIERpZmZDb21wdXRlcicsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHQvLyAtLS0tIGluc2VydGlvbnNcblxuXHR0ZXN0KCdvbmUgaW5zZXJ0ZWQgbGluZSBiZWxvdycsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnbGluZSddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydsaW5lJywgJ25ldyBsaW5lJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbY3JlYXRlTGluZUluc2VydGlvbigyLCAyLCAxKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGluc2VydGVkIGxpbmVzIGJlbG93JywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2xpbmUnLCAnbmV3IGxpbmUnLCAnYW5vdGhlciBuZXcgbGluZSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW2NyZWF0ZUxpbmVJbnNlcnRpb24oMiwgMywgMSldO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ29uZSBpbnNlcnRlZCBsaW5lIGFib3ZlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ25ldyBsaW5lJywgJ2xpbmUnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtjcmVhdGVMaW5lSW5zZXJ0aW9uKDEsIDEsIDApXTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gaW5zZXJ0ZWQgbGluZXMgYWJvdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2xpbmUnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnbmV3IGxpbmUnLCAnYW5vdGhlciBuZXcgbGluZScsICdsaW5lJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbY3JlYXRlTGluZUluc2VydGlvbigxLCAyLCAwKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGluc2VydGVkIGxpbmUgaW4gbWlkZGxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lMScsICdsaW5lMicsICdsaW5lMycsICdsaW5lNCddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydsaW5lMScsICdsaW5lMicsICduZXcgbGluZScsICdsaW5lMycsICdsaW5lNCddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW2NyZWF0ZUxpbmVJbnNlcnRpb24oMywgMywgMildO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBpbnNlcnRlZCBsaW5lcyBpbiBtaWRkbGUnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2xpbmUxJywgJ2xpbmUyJywgJ2xpbmUzJywgJ2xpbmU0J107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2xpbmUxJywgJ2xpbmUyJywgJ25ldyBsaW5lJywgJ2Fub3RoZXIgbmV3IGxpbmUnLCAnbGluZTMnLCAnbGluZTQnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtjcmVhdGVMaW5lSW5zZXJ0aW9uKDMsIDQsIDIpXTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gaW5zZXJ0ZWQgbGluZXMgaW4gbWlkZGxlIGludGVycnVwdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lMScsICdsaW5lMicsICdsaW5lMycsICdsaW5lNCddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydsaW5lMScsICdsaW5lMicsICduZXcgbGluZScsICdsaW5lMycsICdhbm90aGVyIG5ldyBsaW5lJywgJ2xpbmU0J107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbY3JlYXRlTGluZUluc2VydGlvbigzLCAzLCAyKSwgY3JlYXRlTGluZUluc2VydGlvbig1LCA1LCAzKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0Ly8gLS0tLSBkZWxldGlvbnNcblxuXHR0ZXN0KCdvbmUgZGVsZXRlZCBsaW5lIGJlbG93JywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lJywgJ25ldyBsaW5lJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2xpbmUnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtjcmVhdGVMaW5lRGVsZXRpb24oMiwgMiwgMSldO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBkZWxldGVkIGxpbmVzIGJlbG93JywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lJywgJ25ldyBsaW5lJywgJ2Fub3RoZXIgbmV3IGxpbmUnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnbGluZSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW2NyZWF0ZUxpbmVEZWxldGlvbigyLCAzLCAxKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGRlbGV0ZWQgbGluZXMgYWJvdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ25ldyBsaW5lJywgJ2xpbmUnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnbGluZSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW2NyZWF0ZUxpbmVEZWxldGlvbigxLCAxLCAwKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGRlbGV0ZWQgbGluZXMgYWJvdmUnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ25ldyBsaW5lJywgJ2Fub3RoZXIgbmV3IGxpbmUnLCAnbGluZSddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydsaW5lJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbY3JlYXRlTGluZURlbGV0aW9uKDEsIDIsIDApXTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbmUgZGVsZXRlZCBsaW5lIGluIG1pZGRsZScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnbGluZTEnLCAnbGluZTInLCAnbmV3IGxpbmUnLCAnbGluZTMnLCAnbGluZTQnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnbGluZTEnLCAnbGluZTInLCAnbGluZTMnLCAnbGluZTQnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtjcmVhdGVMaW5lRGVsZXRpb24oMywgMywgMildO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBkZWxldGVkIGxpbmVzIGluIG1pZGRsZScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnbGluZTEnLCAnbGluZTInLCAnbmV3IGxpbmUnLCAnYW5vdGhlciBuZXcgbGluZScsICdsaW5lMycsICdsaW5lNCddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydsaW5lMScsICdsaW5lMicsICdsaW5lMycsICdsaW5lNCddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW2NyZWF0ZUxpbmVEZWxldGlvbigzLCA0LCAyKV07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGRlbGV0ZWQgbGluZXMgaW4gbWlkZGxlIGludGVycnVwdGVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lMScsICdsaW5lMicsICduZXcgbGluZScsICdsaW5lMycsICdhbm90aGVyIG5ldyBsaW5lJywgJ2xpbmU0J107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2xpbmUxJywgJ2xpbmUyJywgJ2xpbmUzJywgJ2xpbmU0J107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbY3JlYXRlTGluZURlbGV0aW9uKDMsIDMsIDIpLCBjcmVhdGVMaW5lRGVsZXRpb24oNSwgNSwgMyldO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdC8vIC0tLS0gY2hhbmdlc1xuXG5cdHRlc3QoJ29uZSBsaW5lIGNoYW5nZWQ6IGNoYXJzIGluc2VydGVkIGF0IHRoZSBlbmQnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2xpbmUnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnbGluZSBjaGFuZ2VkJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDEsIDEsIDEsIDEsIFtcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxLCA1LCAxLCA1LCAxLCA1LCAxLCAxMylcblx0XHRcdF0pXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbmUgbGluZSBjaGFuZ2VkOiBjaGFycyBpbnNlcnRlZCBhdCB0aGUgYmVnaW5uaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydsaW5lJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ215IGxpbmUnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDEsIDEsIDEsIDEsIDEsIDEsIDQpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGxpbmUgY2hhbmdlZDogY2hhcnMgaW5zZXJ0ZWQgaW4gdGhlIG1pZGRsZScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnYWJiYSddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydhYnp6YmEnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDMsIDEsIDMsIDEsIDMsIDEsIDUpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGxpbmUgY2hhbmdlZDogY2hhcnMgaW5zZXJ0ZWQgaW4gdGhlIG1pZGRsZSAodHdvIHNwb3RzKScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnYWJiYSddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydhYnp6Ynp6YSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZSgxLCAxLCAxLCAxLCBbXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMSwgMywgMSwgMywgMSwgMywgMSwgNSksXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMSwgNCwgMSwgNCwgMSwgNiwgMSwgOClcblx0XHRcdF0pXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdvbmUgbGluZSBjaGFuZ2VkOiBjaGFycyBkZWxldGVkIDEnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2FiY2RlZmcnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnYWJjZmcnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDQsIDEsIDYsIDEsIDQsIDEsIDQpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnb25lIGxpbmUgY2hhbmdlZDogY2hhcnMgZGVsZXRlZCAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydhYmNkZWZnJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2FjZmcnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDIsIDEsIDMsIDEsIDIsIDEsIDIpLFxuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDQsIDEsIDYsIDEsIDMsIDEsIDMpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGxpbmVzIGNoYW5nZWQgMScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnYWJjZCcsICdlZmdoJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2FiY3onXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMiwgMSwgMSwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDEsIDQsIDIsIDUsIDEsIDQsIDEsIDUpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgndHdvIGxpbmVzIGNoYW5nZWQgMicsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnZm9vJywgJ2FiY2QnLCAnZWZnaCcsICdCQVInXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnZm9vJywgJ2FiY3onLCAnQkFSJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDIsIDMsIDIsIDIsIFtcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyLCA0LCAzLCA1LCAyLCA0LCAyLCA1KVxuXHRcdFx0XSlcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3byBsaW5lcyBjaGFuZ2VkIDMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2ZvbycsICdhYmNkJywgJ2VmZ2gnLCAnQkFSJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ2ZvbycsICdhYmN6JywgJ3p6enplZmdoJywgJ0JBUiddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZSgyLCAzLCAyLCAzLCBbXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMiwgNCwgMiwgNSwgMiwgNCwgMiwgNSksXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMywgMSwgMywgMSwgMywgMSwgMywgNSlcblx0XHRcdF0pXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gbGluZXMgY2hhbmdlZCA0JywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydhYmMnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnJywgJycsICdheGMnLCAnJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDEsIDEsIDEsIDQsIFtcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxLCAxLCAxLCAxLCAxLCAxLCAzLCAxKSxcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxLCAyLCAxLCAzLCAzLCAyLCAzLCAzKSxcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxLCA0LCAxLCA0LCAzLCA0LCA0LCAxKVxuXHRcdFx0XSlcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IG9yaWdpbmFsIHNlcXVlbmNlIGluIGNoYXIgZGlmZicsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnYWJjJywgJycsICd4eXonXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnYWJjJywgJ3F3ZScsICdydHknLCAneHl6J107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDIsIDIsIDIsIDMpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCd0aHJlZSBsaW5lcyBjaGFuZ2VkJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydmb28nLCAnYWJjZCcsICdlZmdoJywgJ0JBUiddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydmb28nLCAnenp6ZWZnaCcsICd4eHgnLCAnQkFSJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDIsIDMsIDIsIDMsIFtcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyLCAxLCAzLCAxLCAyLCAxLCAyLCA0KSxcblx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgzLCA1LCAzLCA1LCAyLCA4LCAzLCA0KSxcblx0XHRcdF0pXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdiaWcgY2hhbmdlIHBhcnQgMScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnZm9vJywgJ2FiY2QnLCAnZWZnaCcsICdCQVInXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnaGVsbG8nLCAnZm9vJywgJ3p6emVmZ2gnLCAneHh4JywgJ0JBUiddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUluc2VydGlvbigxLCAxLCAwKSxcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMiwgMywgMywgNCwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDIsIDEsIDMsIDEsIDMsIDEsIDMsIDQpLFxuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDMsIDUsIDMsIDUsIDMsIDgsIDQsIDQpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0dGVzdCgnYmlnIGNoYW5nZSBwYXJ0IDInLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2ZvbycsICdhYmNkJywgJ2VmZ2gnLCAnQkFSJywgJ1JBQiddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydoZWxsbycsICdmb28nLCAnenp6ZWZnaCcsICd4eHgnLCAnQkFSJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lSW5zZXJ0aW9uKDEsIDEsIDApLFxuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZSgyLCAzLCAzLCA0LCBbXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMiwgMSwgMywgMSwgMywgMSwgMywgNCksXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMywgNSwgMywgNSwgMywgOCwgNCwgNClcblx0XHRcdF0pLFxuXHRcdFx0Y3JlYXRlTGluZURlbGV0aW9uKDUsIDUsIDUpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjaGFyIGNoYW5nZSBwb3N0cHJvY2Vzc2luZyBtZXJnZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ2FiYmEnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnYXp6emJ6enpienp6YSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZSgxLCAxLCAxLCAxLCBbXG5cdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMSwgMiwgMSwgNCwgMSwgMiwgMSwgMTMpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaWdub3JlIHRyaW0gd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnXFx0XFx0IGZvbyAnLCAnYWJjZCcsICdlZmdoJywgJ1xcdFxcdCBCQVJcXHRcXHQnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnICBoZWxsb1xcdCcsICdcXHQgZm9vICAgXFx0JywgJ3p6emVmZ2gnLCAneHh4JywgJyAgIEJBUiAgIFxcdCddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUluc2VydGlvbigxLCAxLCAwKSxcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMiwgMywgMywgNCwgW1xuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDIsIDEsIDIsIDUsIDMsIDEsIDMsIDQpLFxuXHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDMsIDUsIDMsIDUsIDQsIDEsIDQsIDQpXG5cdFx0XHRdKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjEyMiByLmhhc093blByb3BlcnR5IGlzIG5vdCBhIGZ1bmN0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydoYXNPd25Qcm9wZXJ0eSddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydoYXNPd25Qcm9wZXJ0eScsICdhbmQgYW5vdGhlciBsaW5lJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lSW5zZXJ0aW9uKDIsIDIsIDEpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBkaWZmIDEnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJyddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWydzb21ldGhpbmcnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgdW5kZWZpbmVkKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGRpZmYgMicsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJ3NvbWV0aGluZycsICdzb21ldGhpbmcgZWxzZSddO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZSgxLCAxLCAxLCAyLCB1bmRlZmluZWQpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIHRydWUsIGZhbHNlLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZW1wdHkgZGlmZiAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gWydzb21ldGhpbmcnLCAnc29tZXRoaW5nIGVsc2UnXTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFsnJ107XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKDEsIDIsIDEsIDEsIHVuZGVmaW5lZClcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCwgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBkaWZmIDQnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbJ3NvbWV0aGluZyddO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gWycnXTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoMSwgMSwgMSwgMSwgdW5kZWZpbmVkKVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2VtcHR5IGRpZmYgNScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFsnJ107XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbJyddO1xuXHRcdGNvbnN0IGV4cGVjdGVkOiBJTGluZUNoYW5nZVtdID0gW107XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZXR0eSBkaWZmIDEnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbXG5cdFx0XHQnc3VpdGUoZnVuY3Rpb24gKCkgeycsXG5cdFx0XHQnXHR0ZXN0MSgpIHsnLFxuXHRcdFx0J1x0XHRhc3NlcnQub2sodHJ1ZSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnXHR0ZXN0MigpIHsnLFxuXHRcdFx0J1x0XHRhc3NlcnQub2sodHJ1ZSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J30pOycsXG5cdFx0XHQnJyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0Jy8vIEFuIGluc2VydGlvbicsXG5cdFx0XHQnc3VpdGUoZnVuY3Rpb24gKCkgeycsXG5cdFx0XHQnXHR0ZXN0MSgpIHsnLFxuXHRcdFx0J1x0XHRhc3NlcnQub2sodHJ1ZSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnXHR0ZXN0MigpIHsnLFxuXHRcdFx0J1x0XHRhc3NlcnQub2sodHJ1ZSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnXHR0ZXN0MygpIHsnLFxuXHRcdFx0J1x0XHRhc3NlcnQub2sodHJ1ZSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J30pOycsXG5cdFx0XHQnJyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUluc2VydGlvbigxLCAxLCAwKSxcblx0XHRcdGNyZWF0ZUxpbmVJbnNlcnRpb24oMTAsIDEzLCA4KVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3ByZXR0eSBkaWZmIDInLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbXG5cdFx0XHQnLy8gSnVzdCBhIGNvbW1lbnQnLFxuXHRcdFx0JycsXG5cdFx0XHQnZnVuY3Rpb24gY29tcHV0ZShhLCBiLCBjLCBkKSB7Jyxcblx0XHRcdCdcdGlmIChhKSB7Jyxcblx0XHRcdCdcdFx0aWYgKGIpIHsnLFxuXHRcdFx0J1x0XHRcdGlmIChjKSB7Jyxcblx0XHRcdCdcdFx0XHRcdHJldHVybiA1OycsXG5cdFx0XHQnXHRcdFx0fScsXG5cdFx0XHQnXHRcdH0nLFxuXHRcdFx0J1x0XHQvLyBUaGVzZSBuZXh0IGxpbmVzIHdpbGwgYmUgZGVsZXRlZCcsXG5cdFx0XHQnXHRcdGlmIChkKSB7Jyxcblx0XHRcdCdcdFx0XHRyZXR1cm4gLTE7Jyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHRcdHJldHVybiAwOycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0Jy8vIEhlcmUgaXMgYW4gaW5zZXJ0ZWQgbGluZScsXG5cdFx0XHQnLy8gYW5kIGFub3RoZXIgaW5zZXJ0ZWQgbGluZScsXG5cdFx0XHQnLy8gYW5kIGFub3RoZXIgb25lJyxcblx0XHRcdCcvLyBKdXN0IGEgY29tbWVudCcsXG5cdFx0XHQnJyxcblx0XHRcdCdmdW5jdGlvbiBjb21wdXRlKGEsIGIsIGMsIGQpIHsnLFxuXHRcdFx0J1x0aWYgKGEpIHsnLFxuXHRcdFx0J1x0XHRpZiAoYikgeycsXG5cdFx0XHQnXHRcdFx0aWYgKGMpIHsnLFxuXHRcdFx0J1x0XHRcdFx0cmV0dXJuIDU7Jyxcblx0XHRcdCdcdFx0XHR9Jyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHRcdHJldHVybiAwOycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUluc2VydGlvbigxLCAzLCAwKSxcblx0XHRcdGNyZWF0ZUxpbmVEZWxldGlvbigxMCwgMTMsIDEyKSxcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCwgdHJ1ZSwgZmFsc2UsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdwcmV0dHkgZGlmZiAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gW1xuXHRcdFx0J2NsYXNzIEEgeycsXG5cdFx0XHQnXHQvKionLFxuXHRcdFx0J1x0ICogbTEnLFxuXHRcdFx0J1x0ICovJyxcblx0XHRcdCdcdG1ldGhvZDEoKSB7fScsXG5cdFx0XHQnJyxcblx0XHRcdCdcdC8qKicsXG5cdFx0XHQnXHQgKiBtMycsXG5cdFx0XHQnXHQgKi8nLFxuXHRcdFx0J1x0bWV0aG9kMygpIHt9Jyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0J2NsYXNzIEEgeycsXG5cdFx0XHQnXHQvKionLFxuXHRcdFx0J1x0ICogbTEnLFxuXHRcdFx0J1x0ICovJyxcblx0XHRcdCdcdG1ldGhvZDEoKSB7fScsXG5cdFx0XHQnJyxcblx0XHRcdCdcdC8qKicsXG5cdFx0XHQnXHQgKiBtMicsXG5cdFx0XHQnXHQgKi8nLFxuXHRcdFx0J1x0bWV0aG9kMigpIHt9Jyxcblx0XHRcdCcnLFxuXHRcdFx0J1x0LyoqJyxcblx0XHRcdCdcdCAqIG0zJyxcblx0XHRcdCdcdCAqLycsXG5cdFx0XHQnXHRtZXRob2QzKCkge30nLFxuXHRcdFx0J30nLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lSW5zZXJ0aW9uKDcsIDExLCA2KVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMzYzNicsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFtcblx0XHRcdCdpZighVGV4dERyYXdMb2FkW3BsYXllcmlkXSknLFxuXHRcdFx0J3snLFxuXHRcdFx0JycsXG5cdFx0XHQnXHRUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbM10pOycsXG5cdFx0XHQnXHRUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbNF0pOycsXG5cdFx0XHQnXHRpZighQXBwbGVKb2JUcmVlc1R5cGVbQXBwbGVKb2JUcmVlc1BsYXllck51bVtwbGF5ZXJpZF1dKScsXG5cdFx0XHQnXHR7Jyxcblx0XHRcdCdcdFx0Zm9yKG5ldyBpPTA7aTwxMDtpKyspIGlmKFN0YXR1c1REX0FwcGxlSm9iQXBwbGVzW3BsYXllcmlkXVtpXSkgVGV4dERyYXdIaWRlRm9yUGxheWVyKHBsYXllcmlkLFREX0FwcGxlSm9iWzUraV0pOycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCdcdGVsc2UnLFxuXHRcdFx0J1x0eycsXG5cdFx0XHQnXHRcdGZvcihuZXcgaT0wO2k8MTA7aSsrKSBpZihTdGF0dXNURF9BcHBsZUpvYkFwcGxlc1twbGF5ZXJpZF1baV0pIFRleHREcmF3SGlkZUZvclBsYXllcihwbGF5ZXJpZCxURF9BcHBsZUpvYlsxNStpXSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J30nLFxuXHRcdFx0J2Vsc2UnLFxuXHRcdFx0J3snLFxuXHRcdFx0J1x0VGV4dERyYXdIaWRlRm9yUGxheWVyKHBsYXllcmlkLFREX0FwcGxlSm9iWzNdKTsnLFxuXHRcdFx0J1x0VGV4dERyYXdIaWRlRm9yUGxheWVyKHBsYXllcmlkLFREX0FwcGxlSm9iWzI3XSk7Jyxcblx0XHRcdCdcdGlmKCFBcHBsZUpvYlRyZWVzVHlwZVtBcHBsZUpvYlRyZWVzUGxheWVyTnVtW3BsYXllcmlkXV0pJyxcblx0XHRcdCdcdHsnLFxuXHRcdFx0J1x0XHRmb3IobmV3IGk9MDtpPDEwO2krKykgaWYoU3RhdHVzVERfQXBwbGVKb2JBcHBsZXNbcGxheWVyaWRdW2ldKSBUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbMjgraV0pOycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCdcdGVsc2UnLFxuXHRcdFx0J1x0eycsXG5cdFx0XHQnXHRcdGZvcihuZXcgaT0wO2k8MTA7aSsrKSBpZihTdGF0dXNURF9BcHBsZUpvYkFwcGxlc1twbGF5ZXJpZF1baV0pIFRleHREcmF3SGlkZUZvclBsYXllcihwbGF5ZXJpZCxURF9BcHBsZUpvYlszOCtpXSk7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J30nLFxuXHRcdF07XG5cdFx0Y29uc3QgbW9kaWZpZWQgPSBbXG5cdFx0XHQnXHRpZighVGV4dERyYXdMb2FkW3BsYXllcmlkXSknLFxuXHRcdFx0J1x0eycsXG5cdFx0XHQnXHQnLFxuXHRcdFx0J1x0XHRUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbM10pOycsXG5cdFx0XHQnXHRcdFRleHREcmF3SGlkZUZvclBsYXllcihwbGF5ZXJpZCxURF9BcHBsZUpvYls0XSk7Jyxcblx0XHRcdCdcdFx0aWYoIUFwcGxlSm9iVHJlZXNUeXBlW0FwcGxlSm9iVHJlZXNQbGF5ZXJOdW1bcGxheWVyaWRdXSknLFxuXHRcdFx0J1x0XHR7Jyxcblx0XHRcdCdcdFx0XHRmb3IobmV3IGk9MDtpPDEwO2krKykgaWYoU3RhdHVzVERfQXBwbGVKb2JBcHBsZXNbcGxheWVyaWRdW2ldKSBUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbNStpXSk7Jyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHRcdGVsc2UnLFxuXHRcdFx0J1x0XHR7Jyxcblx0XHRcdCdcdFx0XHRmb3IobmV3IGk9MDtpPDEwO2krKykgaWYoU3RhdHVzVERfQXBwbGVKb2JBcHBsZXNbcGxheWVyaWRdW2ldKSBUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbMTUraV0pOycsXG5cdFx0XHQnXHRcdH0nLFxuXHRcdFx0J1x0fScsXG5cdFx0XHQnXHRlbHNlJyxcblx0XHRcdCdcdHsnLFxuXHRcdFx0J1x0XHRUZXh0RHJhd0hpZGVGb3JQbGF5ZXIocGxheWVyaWQsVERfQXBwbGVKb2JbM10pOycsXG5cdFx0XHQnXHRcdFRleHREcmF3SGlkZUZvclBsYXllcihwbGF5ZXJpZCxURF9BcHBsZUpvYlsyN10pOycsXG5cdFx0XHQnXHRcdGlmKCFBcHBsZUpvYlRyZWVzVHlwZVtBcHBsZUpvYlRyZWVzUGxheWVyTnVtW3BsYXllcmlkXV0pJyxcblx0XHRcdCdcdFx0eycsXG5cdFx0XHQnXHRcdFx0Zm9yKG5ldyBpPTA7aTwxMDtpKyspIGlmKFN0YXR1c1REX0FwcGxlSm9iQXBwbGVzW3BsYXllcmlkXVtpXSkgVGV4dERyYXdIaWRlRm9yUGxheWVyKHBsYXllcmlkLFREX0FwcGxlSm9iWzI4K2ldKTsnLFxuXHRcdFx0J1x0XHR9Jyxcblx0XHRcdCdcdFx0ZWxzZScsXG5cdFx0XHQnXHRcdHsnLFxuXHRcdFx0J1x0XHRcdGZvcihuZXcgaT0wO2k8MTA7aSsrKSBpZihTdGF0dXNURF9BcHBsZUpvYkFwcGxlc1twbGF5ZXJpZF1baV0pIFRleHREcmF3SGlkZUZvclBsYXllcihwbGF5ZXJpZCxURF9BcHBsZUpvYlszOCtpXSk7Jyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHR9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZShcblx0XHRcdFx0MSwgMjcsIDEsIDI3LFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxLCAxLCAxLCAxLCAxLCAxLCAxLCAyKSxcblx0XHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDIsIDEsIDIsIDEsIDIsIDEsIDIsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMywgMSwgMywgMSwgMywgMSwgMywgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSg0LCAxLCA0LCAxLCA0LCAxLCA0LCAyKSxcblx0XHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDUsIDEsIDUsIDEsIDUsIDEsIDUsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoNiwgMSwgNiwgMSwgNiwgMSwgNiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSg3LCAxLCA3LCAxLCA3LCAxLCA3LCAyKSxcblx0XHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDgsIDEsIDgsIDEsIDgsIDEsIDgsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoOSwgMSwgOSwgMSwgOSwgMSwgOSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxMCwgMSwgMTAsIDEsIDEwLCAxLCAxMCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxMSwgMSwgMTEsIDEsIDExLCAxLCAxMSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxMiwgMSwgMTIsIDEsIDEyLCAxLCAxMiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxMywgMSwgMTMsIDEsIDEzLCAxLCAxMywgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxNCwgMSwgMTQsIDEsIDE0LCAxLCAxNCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxNSwgMSwgMTUsIDEsIDE1LCAxLCAxNSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxNiwgMSwgMTYsIDEsIDE2LCAxLCAxNiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxNywgMSwgMTcsIDEsIDE3LCAxLCAxNywgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxOCwgMSwgMTgsIDEsIDE4LCAxLCAxOCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgxOSwgMSwgMTksIDEsIDE5LCAxLCAxOSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyMCwgMSwgMjAsIDEsIDIwLCAxLCAyMCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyMSwgMSwgMjEsIDEsIDIxLCAxLCAyMSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyMiwgMSwgMjIsIDEsIDIyLCAxLCAyMiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyMywgMSwgMjMsIDEsIDIzLCAxLCAyMywgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyNCwgMSwgMjQsIDEsIDI0LCAxLCAyNCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyNSwgMSwgMjUsIDEsIDI1LCAxLCAyNSwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyNiwgMSwgMjYsIDEsIDI2LCAxLCAyNiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyNywgMSwgMjcsIDEsIDI3LCAxLCAyNywgMiksXG5cdFx0XHRcdF1cblx0XHRcdClcblx0XHRcdC8vIGNyZWF0ZUxpbmVJbnNlcnRpb24oNywgMTEsIDYpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIHRydWUsIHRydWUsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQzOTIyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gW1xuXHRcdFx0JyAqIGB5YXJuIFtpbnN0YWxsXWAgLS0gSW5zdGFsbCBwcm9qZWN0IE5QTSBkZXBlbmRlbmNpZXMuIFRoaXMgaXMgYXV0b21hdGljYWxseSBkb25lIHdoZW4geW91IGZpcnN0IGNyZWF0ZSB0aGUgcHJvamVjdC4gWW91IHNob3VsZCBvbmx5IG5lZWQgdG8gcnVuIHRoaXMgaWYgeW91IGFkZCBkZXBlbmRlbmNpZXMgaW4gYHBhY2thZ2UuanNvbmAuJyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0JyAqIGB5YXJuYCAtLSBJbnN0YWxsIHByb2plY3QgTlBNIGRlcGVuZGVuY2llcy4gWW91IHNob3VsZCBvbmx5IG5lZWQgdG8gcnVuIHRoaXMgaWYgeW91IGFkZCBkZXBlbmRlbmNpZXMgaW4gYHBhY2thZ2UuanNvbmAuJyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZShcblx0XHRcdFx0MSwgMSwgMSwgMSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMSwgOSwgMSwgMTksIDEsIDksIDEsIDkpLFxuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMSwgNTgsIDEsIDEyMCwgMSwgNDgsIDEsIDQ4KSxcblx0XHRcdFx0XVxuXHRcdFx0KVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0Mjc1MScsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFtcblx0XHRcdCcgICAgMScsXG5cdFx0XHQnICAyJyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0JyAgICAxJyxcblx0XHRcdCcgICAzJyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZShcblx0XHRcdFx0MiwgMiwgMiwgMixcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZUNoYXJDaGFuZ2UoMiwgMywgMiwgNCwgMiwgMywgMiwgNSlcblx0XHRcdFx0XVxuXHRcdFx0KVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCB0cnVlLCB0cnVlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RvZXMgbm90IGdpdmUgY2hhcmFjdGVyIGNoYW5nZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbXG5cdFx0XHQnICAgIDEnLFxuXHRcdFx0JyAgMicsXG5cdFx0XHQnQScsXG5cdFx0XTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFtcblx0XHRcdCcgICAgMScsXG5cdFx0XHQnICAgMycsXG5cdFx0XHQnIEEnLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQyLCAzLCAyLCAzXG5cdFx0XHQpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNDQ0MjI6IExlc3MgdGhhbiBpZGVhbCBkaWZmIHJlc3VsdHMnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbXG5cdFx0XHQnZXhwb3J0IGNsYXNzIEMgeycsXG5cdFx0XHQnJyxcblx0XHRcdCdcdHB1YmxpYyBtMSgpOiB2b2lkIHsnLFxuXHRcdFx0J1x0XHR7Jyxcblx0XHRcdCdcdFx0Ly8yJyxcblx0XHRcdCdcdFx0Ly8zJyxcblx0XHRcdCdcdFx0Ly80Jyxcblx0XHRcdCdcdFx0Ly81Jyxcblx0XHRcdCdcdFx0Ly82Jyxcblx0XHRcdCdcdFx0Ly83Jyxcblx0XHRcdCdcdFx0Ly84Jyxcblx0XHRcdCdcdFx0Ly85Jyxcblx0XHRcdCdcdFx0Ly8xMCcsXG5cdFx0XHQnXHRcdC8vMTEnLFxuXHRcdFx0J1x0XHQvLzEyJyxcblx0XHRcdCdcdFx0Ly8xMycsXG5cdFx0XHQnXHRcdC8vMTQnLFxuXHRcdFx0J1x0XHQvLzE1Jyxcblx0XHRcdCdcdFx0Ly8xNicsXG5cdFx0XHQnXHRcdC8vMTcnLFxuXHRcdFx0J1x0XHQvLzE4Jyxcblx0XHRcdCdcdFx0fScsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCcnLFxuXHRcdFx0J1x0cHVibGljIG0yKCk6IHZvaWQgeycsXG5cdFx0XHQnXHRcdGlmIChhKSB7Jyxcblx0XHRcdCdcdFx0XHRpZiAoYikgeycsXG5cdFx0XHQnXHRcdFx0XHQvL0ExJyxcblx0XHRcdCdcdFx0XHRcdC8vQTInLFxuXHRcdFx0J1x0XHRcdFx0Ly9BMycsXG5cdFx0XHQnXHRcdFx0XHQvL0E0Jyxcblx0XHRcdCdcdFx0XHRcdC8vQTUnLFxuXHRcdFx0J1x0XHRcdFx0Ly9BNicsXG5cdFx0XHQnXHRcdFx0XHQvL0E3Jyxcblx0XHRcdCdcdFx0XHRcdC8vQTgnLFxuXHRcdFx0J1x0XHRcdH0nLFxuXHRcdFx0J1x0XHR9Jyxcblx0XHRcdCcnLFxuXHRcdFx0J1x0XHQvL0E5Jyxcblx0XHRcdCdcdFx0Ly9BMTAnLFxuXHRcdFx0J1x0XHQvL0ExMScsXG5cdFx0XHQnXHRcdC8vQTEyJyxcblx0XHRcdCdcdFx0Ly9BMTMnLFxuXHRcdFx0J1x0XHQvL0ExNCcsXG5cdFx0XHQnXHRcdC8vQTE1Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnXHRwdWJsaWMgbTMoKTogdm9pZCB7Jyxcblx0XHRcdCdcdFx0aWYgKGEpIHsnLFxuXHRcdFx0J1x0XHRcdC8vQjEnLFxuXHRcdFx0J1x0XHR9Jyxcblx0XHRcdCdcdFx0Ly9CMicsXG5cdFx0XHQnXHRcdC8vQjMnLFxuXHRcdFx0J1x0fScsXG5cdFx0XHQnJyxcblx0XHRcdCdcdHB1YmxpYyBtNCgpOiBib29sZWFuIHsnLFxuXHRcdFx0J1x0XHQvLzEnLFxuXHRcdFx0J1x0XHQvLzInLFxuXHRcdFx0J1x0XHQvLzMnLFxuXHRcdFx0J1x0XHQvLzQnLFxuXHRcdFx0J1x0fScsXG5cdFx0XHQnJyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0J2V4cG9ydCBjbGFzcyBDIHsnLFxuXHRcdFx0JycsXG5cdFx0XHQnXHRjb25zdHJ1Y3RvcigpIHsnLFxuXHRcdFx0JycsXG5cdFx0XHQnJyxcblx0XHRcdCcnLFxuXHRcdFx0JycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCcnLFxuXHRcdFx0J1x0cHVibGljIG0xKCk6IHZvaWQgeycsXG5cdFx0XHQnXHRcdHsnLFxuXHRcdFx0J1x0XHQvLzInLFxuXHRcdFx0J1x0XHQvLzMnLFxuXHRcdFx0J1x0XHQvLzQnLFxuXHRcdFx0J1x0XHQvLzUnLFxuXHRcdFx0J1x0XHQvLzYnLFxuXHRcdFx0J1x0XHQvLzcnLFxuXHRcdFx0J1x0XHQvLzgnLFxuXHRcdFx0J1x0XHQvLzknLFxuXHRcdFx0J1x0XHQvLzEwJyxcblx0XHRcdCdcdFx0Ly8xMScsXG5cdFx0XHQnXHRcdC8vMTInLFxuXHRcdFx0J1x0XHQvLzEzJyxcblx0XHRcdCdcdFx0Ly8xNCcsXG5cdFx0XHQnXHRcdC8vMTUnLFxuXHRcdFx0J1x0XHQvLzE2Jyxcblx0XHRcdCdcdFx0Ly8xNycsXG5cdFx0XHQnXHRcdC8vMTgnLFxuXHRcdFx0J1x0XHR9Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnXHRwdWJsaWMgbTQoKTogYm9vbGVhbiB7Jyxcblx0XHRcdCdcdFx0Ly8xJyxcblx0XHRcdCdcdFx0Ly8yJyxcblx0XHRcdCdcdFx0Ly8zJyxcblx0XHRcdCdcdFx0Ly80Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0JycsXG5cdFx0XHQnfScsXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoXG5cdFx0XHRcdDIsIDAsIDMsIDlcblx0XHRcdCksXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQyNSwgNTUsIDMxLCAwXG5cdFx0XHQpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdnaXZlcyBwcmVmZXJlbmNlIHRvIG1hdGNoaW5nIGxvbmdlciBsaW5lcycsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFtcblx0XHRcdCdBJyxcblx0XHRcdCdBJyxcblx0XHRcdCdCQicsXG5cdFx0XHQnQycsXG5cdFx0XTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFtcblx0XHRcdCdBJyxcblx0XHRcdCdCQicsXG5cdFx0XHQnQScsXG5cdFx0XHQnRCcsXG5cdFx0XHQnRScsXG5cdFx0XHQnQScsXG5cdFx0XHQnQycsXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoXG5cdFx0XHRcdDIsIDIsIDEsIDBcblx0XHRcdCksXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQzLCAwLCAzLCA2XG5cdFx0XHQpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIGZhbHNlLCBmYWxzZSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE5MDUxOiBnaXZlcyBwcmVmZXJlbmNlIHRvIGZld2VyIGRpZmYgaHVua3MnLCAoKSA9PiB7XG5cdFx0Y29uc3Qgb3JpZ2luYWwgPSBbXG5cdFx0XHQnMScsXG5cdFx0XHQnJyxcblx0XHRcdCcnLFxuXHRcdFx0JzInLFxuXHRcdFx0JycsXG5cdFx0XTtcblx0XHRjb25zdCBtb2RpZmllZCA9IFtcblx0XHRcdCcxJyxcblx0XHRcdCcnLFxuXHRcdFx0JzEuNScsXG5cdFx0XHQnJyxcblx0XHRcdCcnLFxuXHRcdFx0JzInLFxuXHRcdFx0JycsXG5cdFx0XHQnMycsXG5cdFx0XHQnJyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZShcblx0XHRcdFx0MiwgMCwgMywgNFxuXHRcdFx0KSxcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoXG5cdFx0XHRcdDUsIDAsIDgsIDlcblx0XHRcdClcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCwgZmFsc2UsIGZhbHNlLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjE0MzY6IERpZmYgY2h1bmsgY29udGFpbnMgYW4gdW5jaGFuZ2VkIGxpbmUgcGFydCAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gW1xuXHRcdFx0J2lmIChjb25kKSB7Jyxcblx0XHRcdCcgICAgY21kJyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0J2lmIChjb25kKSB7Jyxcblx0XHRcdCcgICAgaWYgKG90aGVyX2NvbmQpIHsnLFxuXHRcdFx0JyAgICAgICAgY21kJyxcblx0XHRcdCcgICAgfScsXG5cdFx0XHQnfScsXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoXG5cdFx0XHRcdDEsIDAsIDIsIDJcblx0XHRcdCksXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQyLCAwLCA0LCA0XG5cdFx0XHQpXG5cdFx0XTtcblx0XHRhc3NlcnREaWZmKG9yaWdpbmFsLCBtb2RpZmllZCwgZXhwZWN0ZWQsIGZhbHNlLCBmYWxzZSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMjE0MzY6IERpZmYgY2h1bmsgY29udGFpbnMgYW4gdW5jaGFuZ2VkIGxpbmUgcGFydCAyJywgKCkgPT4ge1xuXHRcdGNvbnN0IG9yaWdpbmFsID0gW1xuXHRcdFx0J2lmIChjb25kKSB7Jyxcblx0XHRcdCcgICAgY21kJyxcblx0XHRcdCd9Jyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0J2lmIChjb25kKSB7Jyxcblx0XHRcdCcgICAgaWYgKG90aGVyX2NvbmQpIHsnLFxuXHRcdFx0JyAgICAgICAgY21kJyxcblx0XHRcdCcgICAgfScsXG5cdFx0XHQnfScsXG5cdFx0XTtcblx0XHRjb25zdCBleHBlY3RlZCA9IFtcblx0XHRcdGNyZWF0ZUxpbmVDaGFuZ2UoXG5cdFx0XHRcdDEsIDAsIDIsIDJcblx0XHRcdCksXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQyLCAyLCAzLCAzXG5cdFx0XHQpLFxuXHRcdFx0Y3JlYXRlTGluZUNoYW5nZShcblx0XHRcdFx0MiwgMCwgNCwgNFxuXHRcdFx0KVxuXHRcdF07XG5cdFx0YXNzZXJ0RGlmZihvcmlnaW5hbCwgbW9kaWZpZWQsIGV4cGVjdGVkLCBmYWxzZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE2OTU1MjogQXNzZXJ0aW9uIGVycm9yIHdoZW4gaGF2aW5nIGJvdGggbGVhZGluZyBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZSBkaWZmcycsICgpID0+IHtcblx0XHRjb25zdCBvcmlnaW5hbCA9IFtcblx0XHRcdCdpZiBUcnVlOicsXG5cdFx0XHQnICAgIHByaW50KDIpJyxcblx0XHRdO1xuXHRcdGNvbnN0IG1vZGlmaWVkID0gW1xuXHRcdFx0J2lmIFRydWU6Jyxcblx0XHRcdCdcXHRwcmludCgyKSAnLFxuXHRcdF07XG5cdFx0Y29uc3QgZXhwZWN0ZWQgPSBbXG5cdFx0XHRjcmVhdGVMaW5lQ2hhbmdlKFxuXHRcdFx0XHQyLCAyLCAyLCAyLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlQ2hhckNoYW5nZSgyLCAxLCAyLCA1LCAyLCAxLCAyLCAyKSxcblx0XHRcdFx0XHRjcmVhdGVDaGFyQ2hhbmdlKDIsIDEzLCAyLCAxMywgMiwgMTAsIDIsIDExKSxcblx0XHRcdFx0XVxuXHRcdFx0KSxcblx0XHRdO1xuXHRcdGFzc2VydERpZmYob3JpZ2luYWwsIG1vZGlmaWVkLCBleHBlY3RlZCwgdHJ1ZSwgZmFsc2UsIGZhbHNlKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUlBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGlCQUFpQjtBQUMx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Q0FBQztBQUFBLFVBQzNDLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxVQUMzQyxpQkFBaUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsVUFDM0MsaUJBQWlCLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFVBQzNDLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxVQUMzQyxpQkFBaUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsVUFDM0MsaUJBQWlCLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFVBQzNDLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxVQUMzQyxpQkFBaUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsVUFDM0MsaUJBQWlCLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFVBQzNDLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxVQUMzQyxpQkFBaUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsVUFDM0MsaUJBQWlCLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksQ0FBQztBQUFBLFVBQzNDLGlCQUFpQixJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUM7QUFBQSxVQUMzQyxpQkFBaUIsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxDQUFDO0FBQUEsUUFDNUM7QUFBQSxNQUNEO0FBQUE7QUFBQSxJQUVEO0FBQ0EsZUFBVyxVQUFVLFVBQVUsVUFBVSxNQUFNLE1BQU0sS0FBSztBQUFBLEVBQzNELENBQUM7QUFFRCxPQUFLLGdCQUFnQixNQUFNO0FBQzFCLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsUUFDQztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQ1Q7QUFBQSxVQUNDLGlCQUFpQixHQUFHLEdBQUcsR0FBRyxJQUFJLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUN4QyxpQkFBaUIsR0FBRyxJQUFJLEdBQUcsS0FBSyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDN0M7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLGVBQVcsVUFBVSxVQUFVLFVBQVUsTUFBTSxNQUFNLEtBQUs7QUFBQSxFQUMzRCxDQUFDO0FBRUQsT0FBSyxnQkFBZ0IsTUFBTTtBQUMxQixVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsUUFDQztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQ1Q7QUFBQSxVQUNDLGlCQUFpQixHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN4QztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsZUFBVyxVQUFVLFVBQVUsVUFBVSxNQUFNLE1BQU0sS0FBSztBQUFBLEVBQzNELENBQUM7QUFFRCxPQUFLLG1DQUFtQyxNQUFNO0FBQzdDLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLFFBQ0M7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxNQUNWO0FBQUEsSUFDRDtBQUNBLGVBQVcsVUFBVSxVQUFVLFVBQVUsT0FBTyxPQUFPLEtBQUs7QUFBQSxFQUM3RCxDQUFDO0FBRUQsT0FBSyw4Q0FBOEMsTUFBTTtBQUN4RCxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBSTtBQUFBLFFBQUk7QUFBQSxRQUFJO0FBQUEsTUFDYjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE9BQU8sT0FBTyxLQUFLO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssNkNBQTZDLE1BQU07QUFDdkQsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE9BQU8sT0FBTyxLQUFLO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssdURBQXVELE1BQU07QUFDakUsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE9BQU8sT0FBTyxLQUFLO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUssK0RBQStELE1BQU07QUFDekUsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE9BQU8sT0FBTyxJQUFJO0FBQUEsRUFDNUQsQ0FBQztBQUVELE9BQUssK0RBQStELE1BQU07QUFDekUsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNEO0FBQ0EsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLE1BQ0E7QUFBQSxRQUNDO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUFHO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE9BQU8sT0FBTyxLQUFLO0FBQUEsRUFDN0QsQ0FBQztBQUVELE9BQUsseUZBQXlGLE1BQU07QUFDbkcsVUFBTSxXQUFXO0FBQUEsTUFDaEI7QUFBQSxNQUNBO0FBQUEsSUFDRDtBQUNBLFVBQU0sV0FBVztBQUFBLE1BQ2hCO0FBQUEsTUFDQTtBQUFBLElBQ0Q7QUFDQSxVQUFNLFdBQVc7QUFBQSxNQUNoQjtBQUFBLFFBQ0M7QUFBQSxRQUFHO0FBQUEsUUFBRztBQUFBLFFBQUc7QUFBQSxRQUNUO0FBQUEsVUFDQyxpQkFBaUIsR0FBRyxHQUFHLEdBQUcsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDdkMsaUJBQWlCLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQzVDO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxlQUFXLFVBQVUsVUFBVSxVQUFVLE1BQU0sT0FBTyxLQUFLO0FBQUEsRUFDNUQsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
