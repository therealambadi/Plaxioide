import assert from "assert";
import { CharCode } from "../../../../base/common/charCode.js";
import * as strings from "../../../../base/common/strings.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import { LineDecoration } from "../../../common/viewLayout/lineDecorations.js";
import { DomPosition, LineRange, RenderLineInput, renderViewLine2 as renderViewLine } from "../../../common/viewLayout/viewLineRenderer.js";
import { InlineDecorationType } from "../../../common/viewModel.js";
import { TestLineToken, TestLineTokens } from "../core/testLineToken.js";
function createViewLineTokens(viewLineTokens) {
  return new TestLineTokens(viewLineTokens);
}
function createPart(endIndex, foreground) {
  return new TestLineToken(endIndex, foreground << MetadataConsts.FOREGROUND_OFFSET >>> 0);
}
function inflateRenderLineOutput(renderLineOutput) {
  let html = renderLineOutput.html;
  if (html.startsWith("<span>")) {
    html = html.replace(/^<span>/, "");
  }
  html = html.replace(/<\/span>$/, "");
  const spans = [];
  let lastIndex = 0;
  do {
    const newIndex = html.indexOf("<span", lastIndex + 1);
    if (newIndex === -1) {
      break;
    }
    spans.push(html.substring(lastIndex, newIndex));
    lastIndex = newIndex;
  } while (true);
  spans.push(html.substring(lastIndex));
  return {
    html: spans,
    mapping: renderLineOutput.characterMapping.inflate()
  };
}
suite("viewLineRenderer.renderLine", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertCharacterReplacement(lineContent, tabSize, expected, expectedCharOffsetInPart) {
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      strings.isBasicASCII(lineContent),
      false,
      0,
      createViewLineTokens([new TestLineToken(lineContent.length, 0)]),
      [],
      tabSize,
      0,
      0,
      0,
      0,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.strictEqual(_actual.html, '<span><span class="mtk0">' + expected + "</span></span>");
    const info = expectedCharOffsetInPart.map((absoluteOffset) => [absoluteOffset, [0, absoluteOffset]]);
    assertCharacterMapping3(_actual.characterMapping, info);
  }
  test("replaces spaces", () => {
    assertCharacterReplacement(" ", 4, "\xA0", [0, 1]);
    assertCharacterReplacement("  ", 4, "\xA0\xA0", [0, 1, 2]);
    assertCharacterReplacement("a  b", 4, "a\xA0\xA0b", [0, 1, 2, 3, 4]);
  });
  test("escapes HTML markup", () => {
    assertCharacterReplacement("a<b", 4, "a&lt;b", [0, 1, 2, 3]);
    assertCharacterReplacement("a>b", 4, "a&gt;b", [0, 1, 2, 3]);
    assertCharacterReplacement("a&b", 4, "a&amp;b", [0, 1, 2, 3]);
  });
  test("replaces some bad characters", () => {
    assertCharacterReplacement("a\0b", 4, "a&#00;b", [0, 1, 2, 3]);
    assertCharacterReplacement("a" + String.fromCharCode(CharCode.UTF8_BOM) + "b", 4, "a\uFFFDb", [0, 1, 2, 3]);
    assertCharacterReplacement("a\u2028b", 4, "a\uFFFDb", [0, 1, 2, 3]);
  });
  test("handles tabs", () => {
    assertCharacterReplacement("	", 4, "\xA0\xA0\xA0\xA0", [0, 4]);
    assertCharacterReplacement("x	", 4, "x\xA0\xA0\xA0", [0, 1, 4]);
    assertCharacterReplacement("xx	", 4, "xx\xA0\xA0", [0, 1, 2, 4]);
    assertCharacterReplacement("xxx	", 4, "xxx\xA0", [0, 1, 2, 3, 4]);
    assertCharacterReplacement("xxxx	", 4, "xxxx\xA0\xA0\xA0\xA0", [0, 1, 2, 3, 4, 8]);
  });
  function assertParts(lineContent, tabSize, parts, expected, info) {
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens(parts),
      [],
      tabSize,
      0,
      0,
      0,
      0,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.strictEqual(_actual.html, "<span>" + expected + "</span>");
    assertCharacterMapping3(_actual.characterMapping, info);
  }
  test("empty line", () => {
    assertParts("", 4, [], "<span></span>", []);
  });
  test("uses part type", () => {
    assertParts("x", 4, [createPart(1, 10)], '<span class="mtk10">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
    assertParts("x", 4, [createPart(1, 20)], '<span class="mtk20">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
    assertParts("x", 4, [createPart(1, 30)], '<span class="mtk30">x</span>', [[0, [0, 0]], [1, [0, 1]]]);
  });
  test("two parts", () => {
    assertParts("xy", 4, [createPart(1, 1), createPart(2, 2)], '<span class="mtk1">x</span><span class="mtk2">y</span>', [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]]]);
    assertParts("xyz", 4, [createPart(1, 1), createPart(3, 2)], '<span class="mtk1">x</span><span class="mtk2">yz</span>', [[0, [0, 0]], [1, [1, 0]], [2, [1, 1]], [3, [1, 2]]]);
    assertParts("xyz", 4, [createPart(2, 1), createPart(3, 2)], '<span class="mtk1">xy</span><span class="mtk2">z</span>', [[0, [0, 0]], [1, [0, 1]], [2, [1, 0]], [3, [1, 1]]]);
  });
  test("overflow", () => {
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      "Hello world!",
      false,
      true,
      false,
      0,
      createViewLineTokens([
        createPart(1, 0),
        createPart(2, 1),
        createPart(3, 2),
        createPart(4, 3),
        createPart(5, 4),
        createPart(6, 5),
        createPart(7, 6),
        createPart(8, 7),
        createPart(9, 8),
        createPart(10, 9),
        createPart(11, 10),
        createPart(12, 11)
      ]),
      [],
      4,
      0,
      10,
      10,
      10,
      6,
      "boundary",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span class="mtk0">H</span>',
        '<span class="mtk1">e</span>',
        '<span class="mtk2">l</span>',
        '<span class="mtk3">l</span>',
        '<span class="mtk4">o</span>',
        '<span class="mtk5">\xA0</span>',
        '<span class="mtkoverflow">Show more (6 chars)</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 1],
        [2, 0, 2],
        [3, 0, 3],
        [4, 0, 4],
        [5, 0, 5],
        [5, 1, 6]
      ]
    });
  });
  test("typical line", () => {
    const lineText = "	    export class Game { // http://test.com     ";
    const lineParts = createViewLineTokens([
      createPart(5, 1),
      createPart(11, 2),
      createPart(12, 3),
      createPart(17, 4),
      createPart(18, 5),
      createPart(22, 6),
      createPart(23, 7),
      createPart(24, 8),
      createPart(25, 9),
      createPart(28, 10),
      createPart(43, 11),
      createPart(48, 12)
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      true,
      false,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "boundary",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>',
        '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
        '<span class="mtk2">export</span>',
        '<span class="mtk3">\xA0</span>',
        '<span class="mtk4">class</span>',
        '<span class="mtk5">\xA0</span>',
        '<span class="mtk6">Game</span>',
        '<span class="mtk7">\xA0</span>',
        '<span class="mtk8">{</span>',
        '<span class="mtk9">\xA0</span>',
        '<span class="mtk10">//\xA0</span>',
        '<span class="mtk11">http://test.com</span>',
        '<span class="mtkz" style="width:20px">\xB7\u200C\xB7\u200C</span>',
        '<span class="mtkz" style="width:30px">\xB7\u200C\xB7\u200C\xB7\u200C</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 4],
        [1, 2, 5],
        [1, 4, 6],
        [1, 6, 7],
        [2, 0, 8],
        [2, 1, 9],
        [2, 2, 10],
        [2, 3, 11],
        [2, 4, 12],
        [2, 5, 13],
        [3, 0, 14],
        [4, 0, 15],
        [4, 1, 16],
        [4, 2, 17],
        [4, 3, 18],
        [4, 4, 19],
        [5, 0, 20],
        [6, 0, 21],
        [6, 1, 22],
        [6, 2, 23],
        [6, 3, 24],
        [7, 0, 25],
        [8, 0, 26],
        [9, 0, 27],
        [10, 0, 28],
        [10, 1, 29],
        [10, 2, 30],
        [11, 0, 31],
        [11, 1, 32],
        [11, 2, 33],
        [11, 3, 34],
        [11, 4, 35],
        [11, 5, 36],
        [11, 6, 37],
        [11, 7, 38],
        [11, 8, 39],
        [11, 9, 40],
        [11, 10, 41],
        [11, 11, 42],
        [11, 12, 43],
        [11, 13, 44],
        [11, 14, 45],
        [12, 0, 46],
        [12, 2, 47],
        [13, 0, 48],
        [13, 2, 49],
        [13, 4, 50],
        [13, 6, 51]
      ]
    });
  });
  test("issue #2255: Weird line rendering part 1", () => {
    const lineText = "			cursorStyle:						(prevOpts.cursorStyle !== newOpts.cursorStyle),";
    const lineParts = createViewLineTokens([
      createPart(3, 1),
      // 3 chars
      createPart(15, 2),
      // 12 chars
      createPart(21, 3),
      // 6 chars
      createPart(22, 4),
      // 1 char
      createPart(43, 5),
      // 21 chars
      createPart(45, 6),
      // 2 chars
      createPart(46, 7),
      // 1 char
      createPart(66, 8),
      // 20 chars
      createPart(67, 9),
      // 1 char
      createPart(68, 10)
      // 2 chars
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      true,
      false,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span class="mtk1">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
        '<span class="mtk2">cursorStyle:</span>',
        '<span class="mtk3">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
        '<span class="mtk4">(</span>',
        '<span class="mtk5">prevOpts.cursorStyle\xA0</span>',
        '<span class="mtk6">!=</span>',
        '<span class="mtk7">=</span>',
        '<span class="mtk8">\xA0newOpts.cursorStyle</span>',
        '<span class="mtk9">)</span>',
        '<span class="mtk10">,</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 4, 4],
        [0, 8, 8],
        [1, 0, 12],
        [1, 1, 13],
        [1, 2, 14],
        [1, 3, 15],
        [1, 4, 16],
        [1, 5, 17],
        [1, 6, 18],
        [1, 7, 19],
        [1, 8, 20],
        [1, 9, 21],
        [1, 10, 22],
        [1, 11, 23],
        [2, 0, 24],
        [2, 4, 28],
        [2, 8, 32],
        [2, 12, 36],
        [2, 16, 40],
        [2, 20, 44],
        [3, 0, 48],
        [4, 0, 49],
        [4, 1, 50],
        [4, 2, 51],
        [4, 3, 52],
        [4, 4, 53],
        [4, 5, 54],
        [4, 6, 55],
        [4, 7, 56],
        [4, 8, 57],
        [4, 9, 58],
        [4, 10, 59],
        [4, 11, 60],
        [4, 12, 61],
        [4, 13, 62],
        [4, 14, 63],
        [4, 15, 64],
        [4, 16, 65],
        [4, 17, 66],
        [4, 18, 67],
        [4, 19, 68],
        [4, 20, 69],
        [5, 0, 70],
        [5, 1, 71],
        [6, 0, 72],
        [7, 0, 73],
        [7, 1, 74],
        [7, 2, 75],
        [7, 3, 76],
        [7, 4, 77],
        [7, 5, 78],
        [7, 6, 79],
        [7, 7, 80],
        [7, 8, 81],
        [7, 9, 82],
        [7, 10, 83],
        [7, 11, 84],
        [7, 12, 85],
        [7, 13, 86],
        [7, 14, 87],
        [7, 15, 88],
        [7, 16, 89],
        [7, 17, 90],
        [7, 18, 91],
        [7, 19, 92],
        [8, 0, 93],
        [9, 0, 94],
        [9, 1, 95]
      ]
    });
  });
  test("issue #2255: Weird line rendering part 2", () => {
    const lineText = " 			cursorStyle:						(prevOpts.cursorStyle !== newOpts.cursorStyle),";
    const lineParts = createViewLineTokens([
      createPart(4, 1),
      // 4 chars
      createPart(16, 2),
      // 12 chars
      createPart(22, 3),
      // 6 chars
      createPart(23, 4),
      // 1 char
      createPart(44, 5),
      // 21 chars
      createPart(46, 6),
      // 2 chars
      createPart(47, 7),
      // 1 char
      createPart(67, 8),
      // 20 chars
      createPart(68, 9),
      // 1 char
      createPart(69, 10)
      // 2 chars
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      true,
      false,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span class="mtk1">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
        '<span class="mtk2">cursorStyle:</span>',
        '<span class="mtk3">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
        '<span class="mtk4">(</span>',
        '<span class="mtk5">prevOpts.cursorStyle\xA0</span>',
        '<span class="mtk6">!=</span>',
        '<span class="mtk7">=</span>',
        '<span class="mtk8">\xA0newOpts.cursorStyle</span>',
        '<span class="mtk9">)</span>',
        '<span class="mtk10">,</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 4, 4],
        [0, 8, 8],
        [1, 0, 12],
        [1, 1, 13],
        [1, 2, 14],
        [1, 3, 15],
        [1, 4, 16],
        [1, 5, 17],
        [1, 6, 18],
        [1, 7, 19],
        [1, 8, 20],
        [1, 9, 21],
        [1, 10, 22],
        [1, 11, 23],
        [2, 0, 24],
        [2, 4, 28],
        [2, 8, 32],
        [2, 12, 36],
        [2, 16, 40],
        [2, 20, 44],
        [3, 0, 48],
        [4, 0, 49],
        [4, 1, 50],
        [4, 2, 51],
        [4, 3, 52],
        [4, 4, 53],
        [4, 5, 54],
        [4, 6, 55],
        [4, 7, 56],
        [4, 8, 57],
        [4, 9, 58],
        [4, 10, 59],
        [4, 11, 60],
        [4, 12, 61],
        [4, 13, 62],
        [4, 14, 63],
        [4, 15, 64],
        [4, 16, 65],
        [4, 17, 66],
        [4, 18, 67],
        [4, 19, 68],
        [4, 20, 69],
        [5, 0, 70],
        [5, 1, 71],
        [6, 0, 72],
        [7, 0, 73],
        [7, 1, 74],
        [7, 2, 75],
        [7, 3, 76],
        [7, 4, 77],
        [7, 5, 78],
        [7, 6, 79],
        [7, 7, 80],
        [7, 8, 81],
        [7, 9, 82],
        [7, 10, 83],
        [7, 11, 84],
        [7, 12, 85],
        [7, 13, 86],
        [7, 14, 87],
        [7, 15, 88],
        [7, 16, 89],
        [7, 17, 90],
        [7, 18, 91],
        [7, 19, 92],
        [8, 0, 93],
        [9, 0, 94],
        [9, 1, 95]
      ]
    });
  });
  test("issue #91178: after decoration type shown before cursor", () => {
    const lineText = "//just a comment";
    const lineParts = createViewLineTokens([
      createPart(16, 1)
    ]);
    const actual = renderViewLine(new RenderLineInput(
      true,
      false,
      lineText,
      false,
      true,
      false,
      0,
      lineParts,
      [
        new LineDecoration(13, 13, "dec1", InlineDecorationType.After),
        new LineDecoration(13, 13, "dec2", InlineDecorationType.Before)
      ],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk1">//just\xA0a\xA0com</span>',
        '<span class="mtk1 dec2"></span>',
        '<span class="mtk1 dec1"></span>',
        '<span class="mtk1">ment</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [2, 0, 12],
        [3, 1, 13],
        [3, 2, 14],
        [3, 3, 15],
        [3, 4, 16]
      ]
    });
  });
  test("issue microsoft/monaco-editor#280: Improved source code rendering for RTL languages", () => {
    const lineText = `var \u05E7\u05D5\u05D3\u05DE\u05D5\u05EA = "\u05DE\u05D9\u05D5\u05EA\u05E8 \u05E7\u05D5\u05D3\u05DE\u05D5\u05EA \u05E6'\u05D8 \u05E9\u05DC, \u05D0\u05DD \u05DC\u05E9\u05D5\u05DF \u05D4\u05E2\u05D1\u05E8\u05D9\u05EA \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD \u05D5\u05D9\u05E9, \u05D0\u05DD";`;
    const lineParts = createViewLineTokens([
      createPart(3, 6),
      createPart(13, 1),
      createPart(66, 20),
      createPart(67, 1)
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      false,
      true,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span dir="ltr">',
        '<span class="mtk6">var</span>',
        '<span style="unicode-bidi:isolate" class="mtk1">\xA0\u05E7\u05D5\u05D3\u05DE\u05D5\u05EA\xA0=\xA0</span>',
        `<span style="unicode-bidi:isolate" class="mtk20">"\u05DE\u05D9\u05D5\u05EA\u05E8\xA0\u05E7\u05D5\u05D3\u05DE\u05D5\u05EA\xA0\u05E6'\u05D8\xA0\u05E9\u05DC,\xA0\u05D0\u05DD\xA0\u05DC\u05E9\u05D5\u05DF\xA0\u05D4\u05E2\u05D1\u05E8\u05D9\u05EA\xA0\u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD\xA0\u05D5\u05D9\u05E9,\xA0\u05D0\u05DD"</span>`,
        '<span class="mtk1">;</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [1, 0, 3],
        [1, 1, 4],
        [1, 2, 5],
        [1, 3, 6],
        [1, 4, 7],
        [1, 5, 8],
        [1, 6, 9],
        [1, 7, 10],
        [1, 8, 11],
        [1, 9, 12],
        [2, 0, 13],
        [2, 1, 14],
        [2, 2, 15],
        [2, 3, 16],
        [2, 4, 17],
        [2, 5, 18],
        [2, 6, 19],
        [2, 7, 20],
        [2, 8, 21],
        [2, 9, 22],
        [2, 10, 23],
        [2, 11, 24],
        [2, 12, 25],
        [2, 13, 26],
        [2, 14, 27],
        [2, 15, 28],
        [2, 16, 29],
        [2, 17, 30],
        [2, 18, 31],
        [2, 19, 32],
        [2, 20, 33],
        [2, 21, 34],
        [2, 22, 35],
        [2, 23, 36],
        [2, 24, 37],
        [2, 25, 38],
        [2, 26, 39],
        [2, 27, 40],
        [2, 28, 41],
        [2, 29, 42],
        [2, 30, 43],
        [2, 31, 44],
        [2, 32, 45],
        [2, 33, 46],
        [2, 34, 47],
        [2, 35, 48],
        [2, 36, 49],
        [2, 37, 50],
        [2, 38, 51],
        [2, 39, 52],
        [2, 40, 53],
        [2, 41, 54],
        [2, 42, 55],
        [2, 43, 56],
        [2, 44, 57],
        [2, 45, 58],
        [2, 46, 59],
        [2, 47, 60],
        [2, 48, 61],
        [2, 49, 62],
        [2, 50, 63],
        [2, 51, 64],
        [2, 52, 65],
        [3, 0, 66],
        [3, 1, 67]
      ]
    });
    assert.strictEqual(_actual.containsRTL, true);
  });
  test("issue #137036: Issue in RTL languages in recent versions", () => {
    const lineText = '<option value="\u0627\u0644\u0639\u0631\u0628\u064A\u0629">\u0627\u0644\u0639\u0631\u0628\u064A\u0629</option>';
    const lineParts = createViewLineTokens([
      createPart(1, 2),
      createPart(7, 3),
      createPart(8, 4),
      createPart(13, 5),
      createPart(14, 4),
      createPart(23, 6),
      createPart(24, 2),
      createPart(31, 4),
      createPart(33, 2),
      createPart(39, 3),
      createPart(40, 2)
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      false,
      true,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span dir="ltr">',
        '<span class="mtk2">&lt;</span>',
        '<span class="mtk3">option</span>',
        '<span class="mtk4">\xA0</span>',
        '<span class="mtk5">value</span>',
        '<span class="mtk4">=</span>',
        '<span style="unicode-bidi:isolate" class="mtk6">"\u0627\u0644\u0639\u0631\u0628\u064A\u0629"</span>',
        '<span class="mtk2">&gt;</span>',
        '<span style="unicode-bidi:isolate" class="mtk4">\u0627\u0644\u0639\u0631\u0628\u064A\u0629</span>',
        '<span class="mtk2">&lt;/</span>',
        '<span class="mtk3">option</span>',
        '<span class="mtk2">&gt;</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 1],
        [1, 1, 2],
        [1, 2, 3],
        [1, 3, 4],
        [1, 4, 5],
        [1, 5, 6],
        [2, 0, 7],
        [3, 0, 8],
        [3, 1, 9],
        [3, 2, 10],
        [3, 3, 11],
        [3, 4, 12],
        [4, 0, 13],
        [5, 0, 14],
        [5, 1, 15],
        [5, 2, 16],
        [5, 3, 17],
        [5, 4, 18],
        [5, 5, 19],
        [5, 6, 20],
        [5, 7, 21],
        [5, 8, 22],
        [6, 0, 23],
        [7, 0, 24],
        [7, 1, 25],
        [7, 2, 26],
        [7, 3, 27],
        [7, 4, 28],
        [7, 5, 29],
        [7, 6, 30],
        [8, 0, 31],
        [8, 1, 32],
        [9, 0, 33],
        [9, 1, 34],
        [9, 2, 35],
        [9, 3, 36],
        [9, 4, 37],
        [9, 5, 38],
        [10, 0, 39],
        [10, 1, 40]
      ]
    });
    assert.strictEqual(_actual.containsRTL, true);
  });
  test("issue #99589: Rendering whitespace influences bidi layout", () => {
    const lineText = '    ["\u{1F5A8}\uFE0F \u0686\u0627\u067E \u0641\u0627\u06A9\u062A\u0648\u0631","\u{1F3A8} \u062A\u0646\u0638\u06CC\u0645\u0627\u062A"]';
    const lineParts = createViewLineTokens([
      createPart(5, 2),
      createPart(21, 3),
      createPart(22, 2),
      createPart(34, 3),
      createPart(35, 2)
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      true,
      true,
      lineText,
      false,
      false,
      true,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "all",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span dir="ltr">',
        '<span class="mtkw">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
        '<span class="mtk2">[</span>',
        '<span style="unicode-bidi:isolate" class="mtk3">"\u{1F5A8}\uFE0F\xA0\u0686\u0627\u067E\xA0\u0641\u0627\u06A9\u062A\u0648\u0631"</span>',
        '<span class="mtk2">,</span>',
        '<span style="unicode-bidi:isolate" class="mtk3">"\u{1F3A8}\xA0\u062A\u0646\u0638\u06CC\u0645\u0627\u062A"</span>',
        '<span class="mtk2">]</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 2, 1],
        [0, 4, 2],
        [0, 6, 3],
        [1, 0, 4],
        [2, 0, 5],
        [2, 1, 6],
        [2, 2, 7],
        [2, 3, 8],
        [2, 4, 9],
        [2, 5, 10],
        [2, 6, 11],
        [2, 7, 12],
        [2, 8, 13],
        [2, 9, 14],
        [2, 10, 15],
        [2, 11, 16],
        [2, 12, 17],
        [2, 13, 18],
        [2, 14, 19],
        [2, 15, 20],
        [3, 0, 21],
        [4, 0, 22],
        [4, 1, 23],
        [4, 2, 24],
        [4, 3, 25],
        [4, 4, 26],
        [4, 5, 27],
        [4, 6, 28],
        [4, 7, 29],
        [4, 8, 30],
        [4, 9, 31],
        [4, 10, 32],
        [4, 11, 33],
        [5, 0, 34],
        [5, 1, 35]
      ]
    });
    assert.strictEqual(_actual.containsRTL, true);
  });
  test("issue #6885: Splits large tokens", () => {
    const _lineText = "This is just a long line that contains very interesting text. This is just a long line that contains very interesting text.";
    function assertSplitsTokens(message, lineText, expectedOutput) {
      const lineParts = createViewLineTokens([createPart(lineText.length, 1)]);
      const actual = renderViewLine(new RenderLineInput(
        false,
        true,
        lineText,
        false,
        true,
        false,
        0,
        lineParts,
        [],
        4,
        0,
        10,
        10,
        10,
        -1,
        "none",
        false,
        false,
        null
      ));
      assert.strictEqual(actual.html, "<span>" + expectedOutput.join("") + "</span>", message);
    }
    {
      assertSplitsTokens(
        "49 chars",
        _lineText.substr(0, 49),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0inter</span>'
        ]
      );
    }
    {
      assertSplitsTokens(
        "50 chars",
        _lineText.substr(0, 50),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0intere</span>'
        ]
      );
    }
    {
      assertSplitsTokens(
        "51 chars",
        _lineText.substr(0, 51),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0intere</span>',
          '<span class="mtk1">s</span>'
        ]
      );
    }
    {
      assertSplitsTokens(
        "99 chars",
        _lineText.substr(0, 99),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0intere</span>',
          '<span class="mtk1">sting\xA0text.\xA0This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contain</span>'
        ]
      );
    }
    {
      assertSplitsTokens(
        "100 chars",
        _lineText.substr(0, 100),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0intere</span>',
          '<span class="mtk1">sting\xA0text.\xA0This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains</span>'
        ]
      );
    }
    {
      assertSplitsTokens(
        "101 chars",
        _lineText.substr(0, 101),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0intere</span>',
          '<span class="mtk1">sting\xA0text.\xA0This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains</span>',
          '<span class="mtk1">\xA0</span>'
        ]
      );
    }
  });
  test("issue #21476: Does not split large tokens when ligatures are on", () => {
    const _lineText = "This is just a long line that contains very interesting text. This is just a long line that contains very interesting text.";
    function assertSplitsTokens(message, lineText, expectedOutput) {
      const lineParts = createViewLineTokens([createPart(lineText.length, 1)]);
      const actual = renderViewLine(new RenderLineInput(
        false,
        true,
        lineText,
        false,
        true,
        false,
        0,
        lineParts,
        [],
        4,
        0,
        10,
        10,
        10,
        -1,
        "none",
        false,
        true,
        null
      ));
      assert.strictEqual(actual.html, "<span>" + expectedOutput.join("") + "</span>", message);
    }
    {
      assertSplitsTokens(
        "101 chars",
        _lineText.substr(0, 101),
        [
          '<span class="mtk1">This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0contains\xA0very\xA0</span>',
          '<span class="mtk1">interesting\xA0text.\xA0This\xA0is\xA0just\xA0a\xA0long\xA0line\xA0that\xA0</span>',
          '<span class="mtk1">contains\xA0</span>'
        ]
      );
    }
  });
  test("issue #20624: Unaligned surrogate pairs are corrupted at multiples of 50 columns", () => {
    const lineText = "a\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}";
    const lineParts = createViewLineTokens([createPart(lineText.length, 1)]);
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      false,
      false,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual).html, [
      '<span class="mtk1">a\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}\u{20BB7}</span>'
    ]);
  });
  test("issue #6885: Does not split large tokens in RTL text", () => {
    const lineText = "\u05D0\u05EA \u05D2\u05E8\u05DE\u05E0\u05D9\u05EA \u05D1\u05D4\u05EA\u05D9\u05D9\u05D7\u05E1\u05D5\u05EA \u05E9\u05DE\u05D5, \u05E9\u05E0\u05EA\u05D9 \u05D4\u05DE\u05E9\u05E4\u05D8 \u05D0\u05DC \u05D7\u05E4\u05E9, \u05D0\u05DD \u05DB\u05EA\u05D1 \u05D0\u05D7\u05E8\u05D9\u05DD \u05D5\u05DC\u05D7\u05D1\u05E8. \u05E9\u05DC \u05D4\u05EA\u05D5\u05DB\u05DF \u05D0\u05D5\u05D3\u05D5\u05EA \u05D1\u05D5\u05D9\u05E7\u05D9\u05E4\u05D3\u05D9\u05D4 \u05DB\u05DC\u05DC, \u05E9\u05DC \u05E2\u05D6\u05E8\u05D4 \u05DB\u05D9\u05DE\u05D9\u05D4 \u05D4\u05D9\u05D0. \u05E2\u05DC \u05E2\u05DE\u05D5\u05D3 \u05D9\u05D5\u05E6\u05E8\u05D9\u05DD \u05DE\u05D9\u05EA\u05D5\u05DC\u05D5\u05D2\u05D9\u05D4 \u05E1\u05D3\u05E8, \u05D0\u05DD \u05E9\u05DB\u05DC \u05E9\u05EA\u05E4\u05D5 \u05DC\u05E2\u05D1\u05E8\u05D9\u05EA \u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD, \u05D0\u05DD \u05E9\u05D0\u05DC\u05D5\u05EA \u05D0\u05E0\u05D2\u05DC\u05D9\u05EA \u05E2\u05D6\u05D4. \u05E9\u05DE\u05D5\u05EA \u05D1\u05E7\u05DC\u05D5\u05EA \u05DE\u05D4 \u05E1\u05D3\u05E8.";
    const lineParts = createViewLineTokens([createPart(lineText.length, 1)]);
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      false,
      true,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(actual.html, [
      '<span dir="ltr">',
      '<span style="unicode-bidi:isolate" class="mtk1">\u05D0\u05EA\xA0\u05D2\u05E8\u05DE\u05E0\u05D9\u05EA\xA0\u05D1\u05D4\u05EA\u05D9\u05D9\u05D7\u05E1\u05D5\u05EA\xA0\u05E9\u05DE\u05D5,\xA0\u05E9\u05E0\u05EA\u05D9\xA0\u05D4\u05DE\u05E9\u05E4\u05D8\xA0\u05D0\u05DC\xA0\u05D7\u05E4\u05E9,\xA0\u05D0\u05DD\xA0\u05DB\u05EA\u05D1\xA0\u05D0\u05D7\u05E8\u05D9\u05DD\xA0\u05D5\u05DC\u05D7\u05D1\u05E8.\xA0\u05E9\u05DC\xA0\u05D4\u05EA\u05D5\u05DB\u05DF\xA0\u05D0\u05D5\u05D3\u05D5\u05EA\xA0\u05D1\u05D5\u05D9\u05E7\u05D9\u05E4\u05D3\u05D9\u05D4\xA0\u05DB\u05DC\u05DC,\xA0\u05E9\u05DC\xA0\u05E2\u05D6\u05E8\u05D4\xA0\u05DB\u05D9\u05DE\u05D9\u05D4\xA0\u05D4\u05D9\u05D0.\xA0\u05E2\u05DC\xA0\u05E2\u05DE\u05D5\u05D3\xA0\u05D9\u05D5\u05E6\u05E8\u05D9\u05DD\xA0\u05DE\u05D9\u05EA\u05D5\u05DC\u05D5\u05D2\u05D9\u05D4\xA0\u05E1\u05D3\u05E8,\xA0\u05D0\u05DD\xA0\u05E9\u05DB\u05DC\xA0\u05E9\u05EA\u05E4\u05D5\xA0\u05DC\u05E2\u05D1\u05E8\u05D9\u05EA\xA0\u05E9\u05D9\u05E0\u05D5\u05D9\u05D9\u05DD,\xA0\u05D0\u05DD\xA0\u05E9\u05D0\u05DC\u05D5\u05EA\xA0\u05D0\u05E0\u05D2\u05DC\u05D9\u05EA\xA0\u05E2\u05D6\u05D4.\xA0\u05E9\u05DE\u05D5\u05EA\xA0\u05D1\u05E7\u05DC\u05D5\u05EA\xA0\u05DE\u05D4\xA0\u05E1\u05D3\u05E8.</span>',
      "</span>"
    ].join(""));
    assert.strictEqual(actual.containsRTL, true);
  });
  test("issue #95685: Uses unicode replacement character for Paragraph Separator", () => {
    const lineText = 'var ftext = [\u2029"Und", "dann", "eines"];';
    const lineParts = createViewLineTokens([createPart(lineText.length, 1)]);
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineText,
      false,
      false,
      false,
      0,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk1">var\xA0ftext\xA0=\xA0[\uFFFD"Und",\xA0"dann",\xA0"eines"];</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38]
      ]
    });
  });
  test("issue #19673: Monokai Theme bad-highlighting in line wrap", () => {
    const lineText = "    MongoCallback<string>): void {";
    const lineParts = createViewLineTokens([
      createPart(17, 1),
      createPart(18, 2),
      createPart(24, 3),
      createPart(26, 4),
      createPart(27, 5),
      createPart(28, 6),
      createPart(32, 7),
      createPart(34, 8)
    ]);
    const _actual = renderViewLine(new RenderLineInput(
      true,
      true,
      lineText,
      false,
      true,
      false,
      4,
      lineParts,
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(_actual), {
      html: [
        '<span class="">\xA0\xA0\xA0\xA0</span>',
        '<span class="mtk1">MongoCallback</span>',
        '<span class="mtk2">&lt;</span>',
        '<span class="mtk3">string</span>',
        '<span class="mtk4">&gt;)</span>',
        '<span class="mtk5">:</span>',
        '<span class="mtk6">\xA0</span>',
        '<span class="mtk7">void</span>',
        '<span class="mtk8">\xA0{</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [1, 0, 4],
        [1, 1, 5],
        [1, 2, 6],
        [1, 3, 7],
        [1, 4, 8],
        [1, 5, 9],
        [1, 6, 10],
        [1, 7, 11],
        [1, 8, 12],
        [1, 9, 13],
        [1, 10, 14],
        [1, 11, 15],
        [1, 12, 16],
        [2, 0, 17],
        [3, 0, 18],
        [3, 1, 19],
        [3, 2, 20],
        [3, 3, 21],
        [3, 4, 22],
        [3, 5, 23],
        [4, 0, 24],
        [4, 1, 25],
        [5, 0, 26],
        [6, 0, 27],
        [7, 0, 28],
        [7, 1, 29],
        [7, 2, 30],
        [7, 3, 31],
        [8, 0, 32],
        [8, 1, 33],
        [8, 2, 34]
      ]
    });
  });
});
function assertCharacterMapping3(actual, expectedInfo) {
  for (let i = 0; i < expectedInfo.length; i++) {
    const [horizontalOffset, [partIndex, charIndex]] = expectedInfo[i];
    const actualDomPosition = actual.getDomPosition(i + 1);
    assert.deepStrictEqual(actualDomPosition, new DomPosition(partIndex, charIndex), `getDomPosition(${i + 1})`);
    let partLength = charIndex + 1;
    for (let j = i + 1; j < expectedInfo.length; j++) {
      const [, [nextPartIndex, nextCharIndex]] = expectedInfo[j];
      if (nextPartIndex === partIndex) {
        partLength = nextCharIndex + 1;
      } else {
        break;
      }
    }
    const actualColumn = actual.getColumn(new DomPosition(partIndex, charIndex), partLength);
    assert.strictEqual(actualColumn, i + 1, `actual.getColumn(${partIndex}, ${charIndex})`);
    const actualHorizontalOffset = actual.getHorizontalOffset(i + 1);
    assert.strictEqual(actualHorizontalOffset, horizontalOffset, `actual.getHorizontalOffset(${i + 1})`);
  }
  assert.strictEqual(actual.length, expectedInfo.length, `length mismatch`);
}
suite("viewLineRenderer.renderLine 2", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testCreateLineParts(fontIsMonospace, lineContent, tokens, fauxIndentLength, renderWhitespace, selections) {
    const actual = renderViewLine(new RenderLineInput(
      fontIsMonospace,
      true,
      lineContent,
      false,
      true,
      false,
      fauxIndentLength,
      createViewLineTokens(tokens),
      [],
      4,
      0,
      10,
      10,
      10,
      -1,
      renderWhitespace,
      false,
      false,
      selections
    ));
    return inflateRenderLineOutput(actual);
  }
  test("issue #18616: Inline decorations ending at the text length are no longer rendered", () => {
    const lineContent = "https://microsoft.com";
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(21, 3)]),
      [new LineDecoration(1, 22, "link", InlineDecorationType.Regular)],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3 link">https://microsoft.com</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21]
      ]
    });
  });
  test("issue #19207: Link in Monokai is not rendered correctly", () => {
    const lineContent = "'let url = `http://***/_api/web/lists/GetByTitle(\\'Teambuildingaanvragen\\')/items`;'";
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens([
        createPart(49, 6),
        createPart(51, 4),
        createPart(72, 6),
        createPart(74, 4),
        createPart(84, 6)
      ]),
      [
        new LineDecoration(13, 51, "detected-link", InlineDecorationType.Regular)
      ],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk6">\'let\xA0url\xA0=\xA0`</span>',
        '<span class="mtk6 detected-link">http://***/_api/web/lists/GetByTitle(</span>',
        '<span class="mtk4 detected-link">\\</span>',
        `<span class="mtk4">'</span>`,
        '<span class="mtk6">Teambuildingaanvragen</span>',
        `<span class="mtk4">\\'</span>`,
        '<span class="mtk6">)/items`;\'</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [1, 0, 12],
        [1, 1, 13],
        [1, 2, 14],
        [1, 3, 15],
        [1, 4, 16],
        [1, 5, 17],
        [1, 6, 18],
        [1, 7, 19],
        [1, 8, 20],
        [1, 9, 21],
        [1, 10, 22],
        [1, 11, 23],
        [1, 12, 24],
        [1, 13, 25],
        [1, 14, 26],
        [1, 15, 27],
        [1, 16, 28],
        [1, 17, 29],
        [1, 18, 30],
        [1, 19, 31],
        [1, 20, 32],
        [1, 21, 33],
        [1, 22, 34],
        [1, 23, 35],
        [1, 24, 36],
        [1, 25, 37],
        [1, 26, 38],
        [1, 27, 39],
        [1, 28, 40],
        [1, 29, 41],
        [1, 30, 42],
        [1, 31, 43],
        [1, 32, 44],
        [1, 33, 45],
        [1, 34, 46],
        [1, 35, 47],
        [1, 36, 48],
        [2, 0, 49],
        [3, 0, 50],
        [4, 0, 51],
        [4, 1, 52],
        [4, 2, 53],
        [4, 3, 54],
        [4, 4, 55],
        [4, 5, 56],
        [4, 6, 57],
        [4, 7, 58],
        [4, 8, 59],
        [4, 9, 60],
        [4, 10, 61],
        [4, 11, 62],
        [4, 12, 63],
        [4, 13, 64],
        [4, 14, 65],
        [4, 15, 66],
        [4, 16, 67],
        [4, 17, 68],
        [4, 18, 69],
        [4, 19, 70],
        [4, 20, 71],
        [5, 0, 72],
        [5, 1, 73],
        [6, 0, 74],
        [6, 1, 75],
        [6, 2, 76],
        [6, 3, 77],
        [6, 4, 78],
        [6, 5, 79],
        [6, 6, 80],
        [6, 7, 81],
        [6, 8, 82],
        [6, 9, 83],
        [6, 10, 84]
      ]
    });
  });
  test("createLineParts simple", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "Hello world!",
        [
          createPart(12, 1)
        ],
        0,
        "none",
        null
      ),
      {
        html: [
          '<span class="mtk1">Hello\xA0world!</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [0, 4, 4],
          [0, 5, 5],
          [0, 6, 6],
          [0, 7, 7],
          [0, 8, 8],
          [0, 9, 9],
          [0, 10, 10],
          [0, 11, 11],
          [0, 12, 12]
        ]
      }
    );
  });
  test("createLineParts simple two tokens", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "Hello world!",
        [
          createPart(6, 1),
          createPart(12, 2)
        ],
        0,
        "none",
        null
      ),
      {
        html: [
          '<span class="mtk1">Hello\xA0</span>',
          '<span class="mtk2">world!</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [0, 4, 4],
          [0, 5, 5],
          [1, 0, 6],
          [1, 1, 7],
          [1, 2, 8],
          [1, 3, 9],
          [1, 4, 10],
          [1, 5, 11],
          [1, 6, 12]
        ]
      }
    );
  });
  test("createLineParts render whitespace - 4 leading spaces", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "    Hello world!    ",
        [
          createPart(4, 1),
          createPart(6, 2),
          createPart(20, 3)
        ],
        0,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 2, 1],
          [0, 4, 2],
          [0, 6, 3],
          [1, 0, 4],
          [1, 1, 5],
          [2, 0, 6],
          [2, 1, 7],
          [2, 2, 8],
          [2, 3, 9],
          [2, 4, 10],
          [2, 5, 11],
          [2, 6, 12],
          [2, 7, 13],
          [2, 8, 14],
          [2, 9, 15],
          [3, 0, 16],
          [3, 2, 17],
          [3, 4, 18],
          [3, 6, 19],
          [3, 8, 20]
        ]
      }
    );
  });
  test("createLineParts render whitespace - 8 leading spaces", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "        Hello world!        ",
        [
          createPart(8, 1),
          createPart(10, 2),
          createPart(28, 3)
        ],
        0,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 2, 1],
          [0, 4, 2],
          [0, 6, 3],
          [1, 0, 4],
          [1, 2, 5],
          [1, 4, 6],
          [1, 6, 7],
          [2, 0, 8],
          [2, 1, 9],
          [3, 0, 10],
          [3, 1, 11],
          [3, 2, 12],
          [3, 3, 13],
          [3, 4, 14],
          [3, 5, 15],
          [3, 6, 16],
          [3, 7, 17],
          [3, 8, 18],
          [3, 9, 19],
          [4, 0, 20],
          [4, 2, 21],
          [4, 4, 22],
          [4, 6, 23],
          [5, 0, 24],
          [5, 2, 25],
          [5, 4, 26],
          [5, 6, 27],
          [5, 8, 28]
        ]
      }
    );
  });
  test("createLineParts render whitespace - 2 leading tabs", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "		Hello world!	",
        [
          createPart(2, 1),
          createPart(4, 2),
          createPart(15, 3)
        ],
        0,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>',
          '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 4],
          [2, 0, 8],
          [2, 1, 9],
          [3, 0, 10],
          [3, 1, 11],
          [3, 2, 12],
          [3, 3, 13],
          [3, 4, 14],
          [3, 5, 15],
          [3, 6, 16],
          [3, 7, 17],
          [3, 8, 18],
          [3, 9, 19],
          [4, 0, 20],
          [4, 4, 24]
        ]
      }
    );
  });
  test("createLineParts render whitespace - mixed leading spaces and tabs", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "  		  Hello world! 	  	   	    ",
        [
          createPart(6, 1),
          createPart(8, 2),
          createPart(31, 3)
        ],
        0,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\u2192\xA0</span>',
          '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\uFFEB</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\u2192\xA0</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\uFFEB</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 2, 1],
          [0, 4, 2],
          [1, 0, 4],
          [2, 0, 8],
          [2, 2, 9],
          [3, 0, 10],
          [3, 1, 11],
          [4, 0, 12],
          [4, 1, 13],
          [4, 2, 14],
          [4, 3, 15],
          [4, 4, 16],
          [4, 5, 17],
          [4, 6, 18],
          [4, 7, 19],
          [4, 8, 20],
          [4, 9, 21],
          [5, 0, 22],
          [5, 2, 23],
          [6, 0, 24],
          [6, 2, 25],
          [6, 4, 26],
          [7, 0, 28],
          [7, 2, 29],
          [7, 4, 30],
          [7, 6, 31],
          [8, 0, 32],
          [8, 2, 33],
          [8, 4, 34],
          [8, 6, 35],
          [8, 8, 36]
        ]
      }
    );
  });
  test("createLineParts render whitespace skips faux indent", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "		  Hello world! 	  	   	    ",
        [
          createPart(4, 1),
          createPart(6, 2),
          createPart(29, 3)
        ],
        2,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\uFFEB</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\u2192\xA0</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\uFFEB</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 4, 4],
          [1, 0, 8],
          [1, 2, 9],
          [2, 0, 10],
          [2, 1, 11],
          [3, 0, 12],
          [3, 1, 13],
          [3, 2, 14],
          [3, 3, 15],
          [3, 4, 16],
          [3, 5, 17],
          [3, 6, 18],
          [3, 7, 19],
          [3, 8, 20],
          [3, 9, 21],
          [4, 0, 22],
          [4, 2, 23],
          [5, 0, 24],
          [5, 2, 25],
          [5, 4, 26],
          [6, 0, 28],
          [6, 2, 29],
          [6, 4, 30],
          [6, 6, 31],
          [7, 0, 32],
          [7, 2, 33],
          [7, 4, 34],
          [7, 6, 35],
          [7, 8, 36]
        ]
      }
    );
  });
  test("createLineParts does not emit width for monospace fonts", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        true,
        "		  Hello world! 	  	   	    ",
        [
          createPart(4, 1),
          createPart(6, 2),
          createPart(29, 3)
        ],
        2,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
          '<span class="mtkw">\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkw">\xB7\u200C\uFFEB\xB7\u200C\xB7\u200C\u2192\xA0\xB7\u200C\xB7\u200C\xB7\u200C\uFFEB\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 4, 4],
          [1, 0, 8],
          [1, 2, 9],
          [2, 0, 10],
          [2, 1, 11],
          [3, 0, 12],
          [3, 1, 13],
          [3, 2, 14],
          [3, 3, 15],
          [3, 4, 16],
          [3, 5, 17],
          [3, 6, 18],
          [3, 7, 19],
          [3, 8, 20],
          [3, 9, 21],
          [4, 0, 22],
          [4, 2, 23],
          [4, 3, 24],
          [4, 5, 25],
          [4, 7, 26],
          [4, 9, 28],
          [4, 11, 29],
          [4, 13, 30],
          [4, 15, 31],
          [4, 16, 32],
          [4, 18, 33],
          [4, 20, 34],
          [4, 22, 35],
          [4, 24, 36]
        ]
      }
    );
  });
  test("createLineParts render whitespace in middle but not for one space", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "it  it it  it",
        [
          createPart(6, 1),
          createPart(7, 2),
          createPart(13, 3)
        ],
        0,
        "boundary",
        null
      ),
      {
        html: [
          '<span class="mtk1">it</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk1">it</span>',
          '<span class="mtk2">\xA0</span>',
          '<span class="mtk3">it</span>',
          '<span class="mtkz" style="width:20px">\xB7\u200C\xB7\u200C</span>',
          '<span class="mtk3">it</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [1, 0, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [4, 0, 7],
          [4, 1, 8],
          [5, 0, 9],
          [5, 2, 10],
          [6, 0, 11],
          [6, 1, 12],
          [6, 2, 13]
        ]
      }
    );
  });
  test("createLineParts render whitespace for all in middle", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "all",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk2">world!</span>',
          '<span class="mtkz" style="width:30px">\u2192\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [1, 1, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [4, 0, 7],
          [4, 1, 8],
          [4, 2, 9],
          [4, 3, 10],
          [4, 4, 11],
          [4, 5, 12],
          [5, 0, 13],
          [5, 3, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with no selections", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "selection",
        null
      ),
      {
        html: [
          '<span class="mtk0">\xA0Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!\xA0\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [1, 0, 4],
          [1, 1, 5],
          [2, 0, 6],
          [2, 1, 7],
          [2, 2, 8],
          [2, 3, 9],
          [2, 4, 10],
          [2, 5, 11],
          [2, 6, 12],
          [2, 7, 13],
          [2, 10, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with whole line selection", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "selection",
        [new LineRange(0, 14)]
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk2">world!</span>',
          '<span class="mtkz" style="width:30px">\u2192\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [1, 1, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [4, 0, 7],
          [4, 1, 8],
          [4, 2, 9],
          [4, 3, 10],
          [4, 4, 11],
          [4, 5, 12],
          [5, 0, 13],
          [5, 3, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with selection spanning part of whitespace", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "selection",
        [new LineRange(0, 5)]
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!\xA0\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [1, 1, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [3, 1, 7],
          [3, 2, 8],
          [3, 3, 9],
          [3, 4, 10],
          [3, 5, 11],
          [3, 6, 12],
          [3, 7, 13],
          [3, 10, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with multiple selections", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "selection",
        [new LineRange(0, 5), new LineRange(9, 14)]
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!</span>',
          '<span class="mtkz" style="width:30px">\u2192\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [1, 1, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [3, 1, 7],
          [3, 2, 8],
          [3, 3, 9],
          [3, 4, 10],
          [3, 5, 11],
          [3, 6, 12],
          [4, 0, 13],
          [4, 3, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with multiple, initially unsorted selections", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "selection",
        [new LineRange(9, 14), new LineRange(0, 5)]
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!</span>',
          '<span class="mtkz" style="width:30px">\u2192\xA0\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [1, 1, 2],
          [1, 2, 3],
          [2, 0, 4],
          [2, 1, 5],
          [3, 0, 6],
          [3, 1, 7],
          [3, 2, 8],
          [3, 3, 9],
          [3, 4, 10],
          [3, 5, 11],
          [3, 6, 12],
          [4, 0, 13],
          [4, 3, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for selection with selections next to each other", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " * S",
        [
          createPart(4, 0)
        ],
        0,
        "selection",
        [new LineRange(0, 1), new LineRange(1, 2), new LineRange(2, 3)]
      ),
      {
        html: [
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">*</span>',
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
          '<span class="mtk0">S</span>'
        ],
        mapping: [
          [0, 0, 0],
          [1, 0, 1],
          [2, 0, 2],
          [3, 0, 3],
          [3, 1, 4]
        ]
      }
    );
  });
  test("createLineParts render whitespace for trailing with leading, inner, and without trailing whitespace", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world!",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(14, 2)
        ],
        0,
        "trailing",
        null
      ),
      {
        html: [
          '<span class="mtk0">\xA0Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [1, 0, 4],
          [1, 1, 5],
          [2, 0, 6],
          [2, 1, 7],
          [2, 2, 8],
          [2, 3, 9],
          [2, 4, 10],
          [2, 5, 11],
          [2, 6, 12],
          [2, 7, 13]
        ]
      }
    );
  });
  test("createLineParts render whitespace for trailing with leading, inner, and trailing whitespace", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " Hello world! 	",
        [
          createPart(4, 0),
          createPart(6, 1),
          createPart(15, 2)
        ],
        0,
        "trailing",
        null
      ),
      {
        html: [
          '<span class="mtk0">\xA0Hel</span>',
          '<span class="mtk1">lo</span>',
          '<span class="mtk2">\xA0world!</span>',
          '<span class="mtkz" style="width:30px">\xB7\u200C\u2192\xA0</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [1, 0, 4],
          [1, 1, 5],
          [2, 0, 6],
          [2, 1, 7],
          [2, 2, 8],
          [2, 3, 9],
          [2, 4, 10],
          [2, 5, 11],
          [2, 6, 12],
          [3, 0, 13],
          [3, 2, 14],
          [3, 4, 16]
        ]
      }
    );
  });
  test("createLineParts render whitespace for trailing with 8 leading and 8 trailing whitespaces", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        "        Hello world!        ",
        [
          createPart(8, 1),
          createPart(10, 2),
          createPart(28, 3)
        ],
        0,
        "trailing",
        null
      ),
      {
        html: [
          '<span class="mtk1">\xA0\xA0\xA0\xA0\xA0\xA0\xA0\xA0</span>',
          '<span class="mtk2">He</span>',
          '<span class="mtk3">llo\xA0world!</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
          '<span class="mtkz" style="width:40px">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 1, 1],
          [0, 2, 2],
          [0, 3, 3],
          [0, 4, 4],
          [0, 5, 5],
          [0, 6, 6],
          [0, 7, 7],
          [1, 0, 8],
          [1, 1, 9],
          [2, 0, 10],
          [2, 1, 11],
          [2, 2, 12],
          [2, 3, 13],
          [2, 4, 14],
          [2, 5, 15],
          [2, 6, 16],
          [2, 7, 17],
          [2, 8, 18],
          [2, 9, 19],
          [3, 0, 20],
          [3, 2, 21],
          [3, 4, 22],
          [3, 6, 23],
          [4, 0, 24],
          [4, 2, 25],
          [4, 4, 26],
          [4, 6, 27],
          [4, 8, 28]
        ]
      }
    );
  });
  test("createLineParts render whitespace for trailing with line containing only whitespaces", () => {
    assert.deepStrictEqual(
      testCreateLineParts(
        false,
        " 	 ",
        [
          createPart(2, 0),
          createPart(3, 1)
        ],
        0,
        "trailing",
        null
      ),
      {
        html: [
          '<span class="mtkz" style="width:40px">\xB7\u200C\u2192\xA0\xA0</span>',
          '<span class="mtkz" style="width:10px">\xB7\u200C</span>'
        ],
        mapping: [
          [0, 0, 0],
          [0, 2, 1],
          [1, 0, 4],
          [1, 2, 5]
        ]
      }
    );
  });
  test("createLineParts can handle unsorted inline decorations", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      "Hello world",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(11, 0)]),
      [
        new LineDecoration(5, 7, "a", InlineDecorationType.Regular),
        new LineDecoration(1, 3, "b", InlineDecorationType.Regular),
        new LineDecoration(2, 8, "c", InlineDecorationType.Regular)
      ],
      4,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk0 b">H</span>',
        '<span class="mtk0 b c">e</span>',
        '<span class="mtk0 c">ll</span>',
        '<span class="mtk0 a c">o\xA0</span>',
        '<span class="mtk0 c">w</span>',
        '<span class="mtk0">orld</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 1],
        [2, 0, 2],
        [2, 1, 3],
        [3, 0, 4],
        [3, 1, 5],
        [4, 0, 6],
        [5, 0, 7],
        [5, 1, 8],
        [5, 2, 9],
        [5, 3, 10],
        [5, 4, 11]
      ]
    });
  });
  test("issue #11485: Visible whitespace conflicts with before decorator attachment", () => {
    const lineContent = "	bla";
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(4, 3)]),
      [new LineDecoration(1, 2, "before", InlineDecorationType.Before)],
      4,
      0,
      10,
      10,
      10,
      -1,
      "all",
      false,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtkw before">\u2192\xA0\xA0\xA0</span>',
        '<span class="mtk3">bla</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 4],
        [1, 1, 5],
        [1, 2, 6],
        [1, 3, 7]
      ]
    });
  });
  test('issue #32436: Non-monospace font + visible whitespace + After decorator causes line to "jump"', () => {
    const lineContent = "	bla";
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(4, 3)]),
      [new LineDecoration(2, 3, "before", InlineDecorationType.Before)],
      4,
      0,
      10,
      10,
      10,
      -1,
      "all",
      false,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtkz" style="width:40px">\u2192\xA0\xA0\xA0</span>',
        '<span class="mtk3 before">b</span>',
        '<span class="mtk3">la</span>'
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 4],
        [2, 0, 5],
        [2, 1, 6],
        [2, 2, 7]
      ]
    });
  });
  test("issue #30133: Empty lines don't render inline decorations", () => {
    const lineContent = "";
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(0, 3)]),
      [new LineDecoration(1, 2, "before", InlineDecorationType.Before)],
      4,
      0,
      10,
      10,
      10,
      -1,
      "all",
      false,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="before"></span>'
      ],
      mapping: [
        [1, 0, 0]
      ]
    });
  });
  test("issue #37208: Collapsing bullet point containing emoji in Markdown document results in [??] character", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "  1. \u{1F64F}",
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(7, 3)]),
      [new LineDecoration(7, 8, "inline-folded", InlineDecorationType.After)],
      2,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">\xA0\xA01.\xA0</span>',
        '<span class="mtk3 inline-folded">\u{1F64F}</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [1, 0, 5],
        [1, 1, 6],
        [1, 2, 7]
      ]
    });
  });
  test("issue #37401 #40127: Allow both before and after decorations on empty line", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(0, 3)]),
      [
        new LineDecoration(1, 1, "before", InlineDecorationType.Before),
        new LineDecoration(1, 1, "after", InlineDecorationType.After)
      ],
      2,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="before"></span>',
        '<span class="after"></span>'
      ],
      mapping: [
        [1, 0, 0]
      ]
    });
  });
  test("issue #118759: enable multiple text editor decorations in empty lines", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(0, 3)]),
      [
        new LineDecoration(1, 1, "after1", InlineDecorationType.After),
        new LineDecoration(1, 1, "after2", InlineDecorationType.After),
        new LineDecoration(1, 1, "before1", InlineDecorationType.Before),
        new LineDecoration(1, 1, "before2", InlineDecorationType.Before)
      ],
      2,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="before1"></span>',
        '<span class="before2"></span>',
        '<span class="after1"></span>',
        '<span class="after2"></span>'
      ],
      mapping: [
        [2, 0, 0]
      ]
    });
  });
  test("issue #38935: GitLens end-of-line blame no longer rendering", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "	}",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(2, 3)]),
      [
        new LineDecoration(3, 3, "ced-TextEditorDecorationType2-5e9b9b3f-3 ced-TextEditorDecorationType2-3", InlineDecorationType.Before),
        new LineDecoration(3, 3, "ced-TextEditorDecorationType2-5e9b9b3f-4 ced-TextEditorDecorationType2-4", InlineDecorationType.After)
      ],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">\xA0\xA0\xA0\xA0}</span>',
        '<span class="ced-TextEditorDecorationType2-5e9b9b3f-3 ced-TextEditorDecorationType2-3"></span>',
        '<span class="ced-TextEditorDecorationType2-5e9b9b3f-4 ced-TextEditorDecorationType2-4"></span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 4, 4],
        [2, 0, 5]
      ]
    });
  });
  test("issue #136622: Inline decorations are not rendering on non-ASCII lines when renderControlCharacters is on", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "some text \xA3",
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(11, 3)]),
      [
        new LineDecoration(5, 5, "inlineDec1", InlineDecorationType.After),
        new LineDecoration(6, 6, "inlineDec2", InlineDecorationType.Before)
      ],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      true,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">some</span>',
        '<span class="mtk3 inlineDec1"></span>',
        '<span class="mtk3">\xA0</span>',
        '<span class="mtk3 inlineDec2"></span>',
        '<span class="mtk3">text\xA0\xA3</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [1, 0, 4],
        [4, 0, 5],
        [4, 1, 6],
        [4, 2, 7],
        [4, 3, 8],
        [4, 4, 9],
        [4, 5, 10],
        [4, 6, 11]
      ]
    });
  });
  test("issue #22832: Consider fullwidth characters when rendering tabs", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      'asd = "\u64E6"		#asd',
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(15, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">asd\xA0=\xA0"\u64E6"\xA0\xA0\xA0\xA0\xA0\xA0#asd</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 9],
        [0, 9, 10],
        [0, 11, 12],
        [0, 15, 16],
        [0, 16, 17],
        [0, 17, 18],
        [0, 18, 19],
        [0, 19, 20]
      ]
    });
  });
  test("issue #22832: Consider fullwidth characters when rendering tabs (render whitespace)", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      'asd = "\u64E6"		#asd',
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(15, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "all",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">asd</span>',
        '<span class="mtkw">\xB7\u200C</span>',
        '<span class="mtk3">=</span>',
        '<span class="mtkw">\xB7\u200C</span>',
        '<span class="mtk3">"\u64E6"</span>',
        '<span class="mtkw">\u2192\xA0\u2192\xA0\xA0\xA0</span>',
        '<span class="mtk3">#asd</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [1, 0, 3],
        [2, 0, 4],
        [3, 0, 5],
        [4, 0, 6],
        [4, 1, 7],
        [4, 2, 9],
        [5, 0, 10],
        [5, 2, 12],
        [6, 0, 16],
        [6, 1, 17],
        [6, 2, 18],
        [6, 3, 19],
        [6, 4, 20]
      ]
    });
  });
  test("issue #22352: COMBINING ACUTE ACCENT (U+0301)", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "12345689012345678901234568901234567890123456890aba\u0301ba",
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(53, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">12345689012345678901234568901234567890123456890aba\u0301ba</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [0, 45, 45],
        [0, 46, 46],
        [0, 47, 47],
        [0, 48, 48],
        [0, 49, 49],
        [0, 50, 50],
        [0, 51, 51],
        [0, 52, 52],
        [0, 53, 53]
      ]
    });
  });
  test("issue #22352: Partially Broken Complex Script Rendering of Tamil", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      " JoyShare\u0BB2\u0BCD \u0BAA\u0BBF\u0BA9\u0BCD\u0BA4\u0BCA\u0B9F\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BC1, \u0BB5\u0BBF\u0B9F\u0BC0\u0BAF\u0BCB, \u0B9C\u0BCB\u0B95\u0BCD\u0B95\u0BC1\u0B95\u0BB3\u0BCD, \u0B85\u0BA9\u0BBF\u0BAE\u0BC7\u0B9A\u0BA9\u0BCD, \u0BA8\u0B95\u0BC8\u0B9A\u0BCD\u0B9A\u0BC1\u0BB5\u0BC8 \u0BAA\u0B9F\u0B99\u0BCD\u0B95\u0BB3\u0BCD \u0BAE\u0BB1\u0BCD\u0BB1\u0BC1\u0BAE\u0BCD \u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BBF\u0B95\u0BB3\u0BC8 \u0BAA\u0BC6\u0BB1\u0BC1\u0BB5\u0BC0\u0BB0\u0BCD",
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(100, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">\xA0JoyShare\u0BB2\u0BCD\xA0\u0BAA\u0BBF\u0BA9\u0BCD\u0BA4\u0BCA\u0B9F\u0BB0\u0BCD\u0BA8\u0BCD\u0BA4\u0BC1,\xA0\u0BB5\u0BBF\u0B9F\u0BC0\u0BAF\u0BCB,\xA0\u0B9C\u0BCB\u0B95\u0BCD\u0B95\u0BC1\u0B95\u0BB3\u0BCD,\xA0</span>',
        '<span class="mtk3">\u0B85\u0BA9\u0BBF\u0BAE\u0BC7\u0B9A\u0BA9\u0BCD,\xA0\u0BA8\u0B95\u0BC8\u0B9A\u0BCD\u0B9A\u0BC1\u0BB5\u0BC8\xA0\u0BAA\u0B9F\u0B99\u0BCD\u0B95\u0BB3\u0BCD\xA0\u0BAE\u0BB1\u0BCD\u0BB1\u0BC1\u0BAE\u0BCD\xA0\u0B9A\u0BC6\u0BAF\u0BCD\u0BA4\u0BBF\u0B95\u0BB3\u0BC8\xA0</span>',
        '<span class="mtk3">\u0BAA\u0BC6\u0BB1\u0BC1\u0BB5\u0BC0\u0BB0\u0BCD</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [0, 45, 45],
        [1, 0, 46],
        [1, 1, 47],
        [1, 2, 48],
        [1, 3, 49],
        [1, 4, 50],
        [1, 5, 51],
        [1, 6, 52],
        [1, 7, 53],
        [1, 8, 54],
        [1, 9, 55],
        [1, 10, 56],
        [1, 11, 57],
        [1, 12, 58],
        [1, 13, 59],
        [1, 14, 60],
        [1, 15, 61],
        [1, 16, 62],
        [1, 17, 63],
        [1, 18, 64],
        [1, 19, 65],
        [1, 20, 66],
        [1, 21, 67],
        [1, 22, 68],
        [1, 23, 69],
        [1, 24, 70],
        [1, 25, 71],
        [1, 26, 72],
        [1, 27, 73],
        [1, 28, 74],
        [1, 29, 75],
        [1, 30, 76],
        [1, 31, 77],
        [1, 32, 78],
        [1, 33, 79],
        [1, 34, 80],
        [1, 35, 81],
        [1, 36, 82],
        [1, 37, 83],
        [1, 38, 84],
        [1, 39, 85],
        [1, 40, 86],
        [1, 41, 87],
        [1, 42, 88],
        [1, 43, 89],
        [1, 44, 90],
        [1, 45, 91],
        [2, 0, 92],
        [2, 1, 93],
        [2, 2, 94],
        [2, 3, 95],
        [2, 4, 96],
        [2, 5, 97],
        [2, 6, 98],
        [2, 7, 99],
        [2, 8, 100]
      ]
    });
  });
  test("issue #42700: Hindi characters are not being rendered properly", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      " \u0935\u094B \u0910\u0938\u093E \u0915\u094D\u092F\u093E \u0939\u0948 \u091C\u094B \u0939\u092E\u093E\u0930\u0947 \u0905\u0902\u0926\u0930 \u092D\u0940 \u0939\u0948 \u0914\u0930 \u092C\u093E\u0939\u0930 \u092D\u0940 \u0939\u0948\u0964 \u091C\u093F\u0938\u0915\u0940 \u0935\u091C\u0939 \u0938\u0947 \u0939\u092E \u0938\u092C \u0939\u0948\u0902\u0964 \u091C\u093F\u0938\u0928\u0947 \u0907\u0938 \u0938\u0943\u0937\u094D\u091F\u093F \u0915\u0940 \u0930\u091A\u0928\u093E \u0915\u0940 \u0939\u0948\u0964",
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(105, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">\xA0\u0935\u094B\xA0\u0910\u0938\u093E\xA0\u0915\u094D\u092F\u093E\xA0\u0939\u0948\xA0\u091C\u094B\xA0\u0939\u092E\u093E\u0930\u0947\xA0\u0905\u0902\u0926\u0930\xA0\u092D\u0940\xA0\u0939\u0948\xA0\u0914\u0930\xA0\u092C\u093E\u0939\u0930\xA0\u092D\u0940\xA0\u0939\u0948\u0964\xA0</span>',
        '<span class="mtk3">\u091C\u093F\u0938\u0915\u0940\xA0\u0935\u091C\u0939\xA0\u0938\u0947\xA0\u0939\u092E\xA0\u0938\u092C\xA0\u0939\u0948\u0902\u0964\xA0\u091C\u093F\u0938\u0928\u0947\xA0\u0907\u0938\xA0\u0938\u0943\u0937\u094D\u091F\u093F\xA0\u0915\u0940\xA0\u0930\u091A\u0928\u093E\xA0\u0915\u0940\xA0</span>',
        '<span class="mtk3">\u0939\u0948\u0964</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [0, 45, 45],
        [0, 46, 46],
        [0, 47, 47],
        [0, 48, 48],
        [0, 49, 49],
        [0, 50, 50],
        [1, 0, 51],
        [1, 1, 52],
        [1, 2, 53],
        [1, 3, 54],
        [1, 4, 55],
        [1, 5, 56],
        [1, 6, 57],
        [1, 7, 58],
        [1, 8, 59],
        [1, 9, 60],
        [1, 10, 61],
        [1, 11, 62],
        [1, 12, 63],
        [1, 13, 64],
        [1, 14, 65],
        [1, 15, 66],
        [1, 16, 67],
        [1, 17, 68],
        [1, 18, 69],
        [1, 19, 70],
        [1, 20, 71],
        [1, 21, 72],
        [1, 22, 73],
        [1, 23, 74],
        [1, 24, 75],
        [1, 25, 76],
        [1, 26, 77],
        [1, 27, 78],
        [1, 28, 79],
        [1, 29, 80],
        [1, 30, 81],
        [1, 31, 82],
        [1, 32, 83],
        [1, 33, 84],
        [1, 34, 85],
        [1, 35, 86],
        [1, 36, 87],
        [1, 37, 88],
        [1, 38, 89],
        [1, 39, 90],
        [1, 40, 91],
        [1, 41, 92],
        [1, 42, 93],
        [1, 43, 94],
        [1, 44, 95],
        [1, 45, 96],
        [1, 46, 97],
        [1, 47, 98],
        [1, 48, 99],
        [1, 49, 100],
        [1, 50, 101],
        [2, 0, 102],
        [2, 1, 103],
        [2, 2, 104],
        [2, 3, 105]
      ]
    });
  });
  test('issue #38123: editor.renderWhitespace: "boundary" renders whitespace at line wrap point when line is wrapped', () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      true,
      "This is a long line which never uses more than two spaces. ",
      true,
      true,
      false,
      0,
      createViewLineTokens([createPart(59, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "boundary",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">This\xA0is\xA0a\xA0long\xA0line\xA0which\xA0never\xA0uses\xA0more\xA0than\xA0two</span>',
        '<span class="mtk3">\xA0spaces.</span>',
        '<span class="mtk3">\xA0</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [0, 45, 45],
        [0, 46, 46],
        [0, 47, 47],
        [0, 48, 48],
        [0, 49, 49],
        [1, 0, 50],
        [1, 1, 51],
        [1, 2, 52],
        [1, 3, 53],
        [1, 4, 54],
        [1, 5, 55],
        [1, 6, 56],
        [1, 7, 57],
        [2, 0, 58],
        [2, 1, 59]
      ]
    });
  });
  test("issue #33525: Long line with ligatures takes a long time to paint decorations", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      false,
      "append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to append data to",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(194, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0</span>',
        '<span class="mtk3">append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0</span>',
        '<span class="mtk3">append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0</span>',
        '<span class="mtk3">append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0append\xA0data\xA0to\xA0</span>',
        '<span class="mtk3">append\xA0data\xA0to</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [1, 0, 45],
        [1, 1, 46],
        [1, 2, 47],
        [1, 3, 48],
        [1, 4, 49],
        [1, 5, 50],
        [1, 6, 51],
        [1, 7, 52],
        [1, 8, 53],
        [1, 9, 54],
        [1, 10, 55],
        [1, 11, 56],
        [1, 12, 57],
        [1, 13, 58],
        [1, 14, 59],
        [1, 15, 60],
        [1, 16, 61],
        [1, 17, 62],
        [1, 18, 63],
        [1, 19, 64],
        [1, 20, 65],
        [1, 21, 66],
        [1, 22, 67],
        [1, 23, 68],
        [1, 24, 69],
        [1, 25, 70],
        [1, 26, 71],
        [1, 27, 72],
        [1, 28, 73],
        [1, 29, 74],
        [1, 30, 75],
        [1, 31, 76],
        [1, 32, 77],
        [1, 33, 78],
        [1, 34, 79],
        [1, 35, 80],
        [1, 36, 81],
        [1, 37, 82],
        [1, 38, 83],
        [1, 39, 84],
        [1, 40, 85],
        [1, 41, 86],
        [1, 42, 87],
        [1, 43, 88],
        [1, 44, 89],
        [2, 0, 90],
        [2, 1, 91],
        [2, 2, 92],
        [2, 3, 93],
        [2, 4, 94],
        [2, 5, 95],
        [2, 6, 96],
        [2, 7, 97],
        [2, 8, 98],
        [2, 9, 99],
        [2, 10, 100],
        [2, 11, 101],
        [2, 12, 102],
        [2, 13, 103],
        [2, 14, 104],
        [2, 15, 105],
        [2, 16, 106],
        [2, 17, 107],
        [2, 18, 108],
        [2, 19, 109],
        [2, 20, 110],
        [2, 21, 111],
        [2, 22, 112],
        [2, 23, 113],
        [2, 24, 114],
        [2, 25, 115],
        [2, 26, 116],
        [2, 27, 117],
        [2, 28, 118],
        [2, 29, 119],
        [2, 30, 120],
        [2, 31, 121],
        [2, 32, 122],
        [2, 33, 123],
        [2, 34, 124],
        [2, 35, 125],
        [2, 36, 126],
        [2, 37, 127],
        [2, 38, 128],
        [2, 39, 129],
        [2, 40, 130],
        [2, 41, 131],
        [2, 42, 132],
        [2, 43, 133],
        [2, 44, 134],
        [3, 0, 135],
        [3, 1, 136],
        [3, 2, 137],
        [3, 3, 138],
        [3, 4, 139],
        [3, 5, 140],
        [3, 6, 141],
        [3, 7, 142],
        [3, 8, 143],
        [3, 9, 144],
        [3, 10, 145],
        [3, 11, 146],
        [3, 12, 147],
        [3, 13, 148],
        [3, 14, 149],
        [3, 15, 150],
        [3, 16, 151],
        [3, 17, 152],
        [3, 18, 153],
        [3, 19, 154],
        [3, 20, 155],
        [3, 21, 156],
        [3, 22, 157],
        [3, 23, 158],
        [3, 24, 159],
        [3, 25, 160],
        [3, 26, 161],
        [3, 27, 162],
        [3, 28, 163],
        [3, 29, 164],
        [3, 30, 165],
        [3, 31, 166],
        [3, 32, 167],
        [3, 33, 168],
        [3, 34, 169],
        [3, 35, 170],
        [3, 36, 171],
        [3, 37, 172],
        [3, 38, 173],
        [3, 39, 174],
        [3, 40, 175],
        [3, 41, 176],
        [3, 42, 177],
        [3, 43, 178],
        [3, 44, 179],
        [4, 0, 180],
        [4, 1, 181],
        [4, 2, 182],
        [4, 3, 183],
        [4, 4, 184],
        [4, 5, 185],
        [4, 6, 186],
        [4, 7, 187],
        [4, 8, 188],
        [4, 9, 189],
        [4, 10, 190],
        [4, 11, 191],
        [4, 12, 192],
        [4, 13, 193],
        [4, 14, 194]
      ]
    });
  });
  test("issue #33525: Long line with ligatures takes a long time to paint decorations - not possible", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      false,
      "appenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatato",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(194, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      false,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">appenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatatoappenddatato</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [0, 21, 21],
        [0, 22, 22],
        [0, 23, 23],
        [0, 24, 24],
        [0, 25, 25],
        [0, 26, 26],
        [0, 27, 27],
        [0, 28, 28],
        [0, 29, 29],
        [0, 30, 30],
        [0, 31, 31],
        [0, 32, 32],
        [0, 33, 33],
        [0, 34, 34],
        [0, 35, 35],
        [0, 36, 36],
        [0, 37, 37],
        [0, 38, 38],
        [0, 39, 39],
        [0, 40, 40],
        [0, 41, 41],
        [0, 42, 42],
        [0, 43, 43],
        [0, 44, 44],
        [0, 45, 45],
        [0, 46, 46],
        [0, 47, 47],
        [0, 48, 48],
        [0, 49, 49],
        [0, 50, 50],
        [0, 51, 51],
        [0, 52, 52],
        [0, 53, 53],
        [0, 54, 54],
        [0, 55, 55],
        [0, 56, 56],
        [0, 57, 57],
        [0, 58, 58],
        [0, 59, 59],
        [0, 60, 60],
        [0, 61, 61],
        [0, 62, 62],
        [0, 63, 63],
        [0, 64, 64],
        [0, 65, 65],
        [0, 66, 66],
        [0, 67, 67],
        [0, 68, 68],
        [0, 69, 69],
        [0, 70, 70],
        [0, 71, 71],
        [0, 72, 72],
        [0, 73, 73],
        [0, 74, 74],
        [0, 75, 75],
        [0, 76, 76],
        [0, 77, 77],
        [0, 78, 78],
        [0, 79, 79],
        [0, 80, 80],
        [0, 81, 81],
        [0, 82, 82],
        [0, 83, 83],
        [0, 84, 84],
        [0, 85, 85],
        [0, 86, 86],
        [0, 87, 87],
        [0, 88, 88],
        [0, 89, 89],
        [0, 90, 90],
        [0, 91, 91],
        [0, 92, 92],
        [0, 93, 93],
        [0, 94, 94],
        [0, 95, 95],
        [0, 96, 96],
        [0, 97, 97],
        [0, 98, 98],
        [0, 99, 99],
        [0, 100, 100],
        [0, 101, 101],
        [0, 102, 102],
        [0, 103, 103],
        [0, 104, 104],
        [0, 105, 105],
        [0, 106, 106],
        [0, 107, 107],
        [0, 108, 108],
        [0, 109, 109],
        [0, 110, 110],
        [0, 111, 111],
        [0, 112, 112],
        [0, 113, 113],
        [0, 114, 114],
        [0, 115, 115],
        [0, 116, 116],
        [0, 117, 117],
        [0, 118, 118],
        [0, 119, 119],
        [0, 120, 120],
        [0, 121, 121],
        [0, 122, 122],
        [0, 123, 123],
        [0, 124, 124],
        [0, 125, 125],
        [0, 126, 126],
        [0, 127, 127],
        [0, 128, 128],
        [0, 129, 129],
        [0, 130, 130],
        [0, 131, 131],
        [0, 132, 132],
        [0, 133, 133],
        [0, 134, 134],
        [0, 135, 135],
        [0, 136, 136],
        [0, 137, 137],
        [0, 138, 138],
        [0, 139, 139],
        [0, 140, 140],
        [0, 141, 141],
        [0, 142, 142],
        [0, 143, 143],
        [0, 144, 144],
        [0, 145, 145],
        [0, 146, 146],
        [0, 147, 147],
        [0, 148, 148],
        [0, 149, 149],
        [0, 150, 150],
        [0, 151, 151],
        [0, 152, 152],
        [0, 153, 153],
        [0, 154, 154],
        [0, 155, 155],
        [0, 156, 156]
      ]
    });
  });
  test("issue #91936: Semantic token color highlighting fails on line with selected text", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      true,
      "                    else if ($s = 08) then '\\b'",
      false,
      true,
      false,
      0,
      createViewLineTokens([
        createPart(20, 1),
        createPart(24, 15),
        createPart(25, 1),
        createPart(27, 15),
        createPart(28, 1),
        createPart(29, 1),
        createPart(29, 1),
        createPart(31, 16),
        createPart(32, 1),
        createPart(33, 1),
        createPart(34, 1),
        createPart(36, 6),
        createPart(36, 1),
        createPart(37, 1),
        createPart(38, 1),
        createPart(42, 15),
        createPart(43, 1),
        createPart(47, 11)
      ]),
      [],
      4,
      0,
      10,
      11,
      11,
      1e4,
      "selection",
      false,
      false,
      [new LineRange(0, 47)]
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk15">else</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk15">if</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk1">(</span>',
        '<span class="mtk16">$s</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk1">=</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk6">08</span>',
        '<span class="mtk1">)</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        '<span class="mtk15">then</span>',
        '<span class="mtkz" style="width:10px">\xB7\u200C</span>',
        `<span class="mtk11">'\\b'</span>`
      ],
      mapping: [
        [0, 0, 0],
        [1, 0, 1],
        [2, 0, 2],
        [3, 0, 3],
        [4, 0, 4],
        [5, 0, 5],
        [6, 0, 6],
        [7, 0, 7],
        [8, 0, 8],
        [9, 0, 9],
        [10, 0, 10],
        [11, 0, 11],
        [12, 0, 12],
        [13, 0, 13],
        [14, 0, 14],
        [15, 0, 15],
        [16, 0, 16],
        [17, 0, 17],
        [18, 0, 18],
        [19, 0, 19],
        [20, 0, 20],
        [20, 1, 21],
        [20, 2, 22],
        [20, 3, 23],
        [21, 0, 24],
        [22, 0, 25],
        [22, 1, 26],
        [23, 0, 27],
        [24, 0, 28],
        [25, 0, 29],
        [25, 1, 30],
        [26, 0, 31],
        [27, 0, 32],
        [28, 0, 33],
        [29, 0, 34],
        [29, 1, 35],
        [30, 0, 36],
        [31, 0, 37],
        [32, 0, 38],
        [32, 1, 39],
        [32, 2, 40],
        [32, 3, 41],
        [33, 0, 42],
        [34, 0, 43],
        [34, 1, 44],
        [34, 2, 45],
        [34, 3, 46],
        [34, 4, 47]
      ]
    });
  });
  test("issue #119416: Delete Control Character (U+007F / &#127;) displayed as space", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      false,
      "[" + String.fromCharCode(127) + "] [" + String.fromCharCode(0) + "]",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(7, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      true,
      true,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">[\u2421]\xA0[\u2400]</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7]
      ]
    });
  });
  test("issue #116939: Important control characters aren't rendered", () => {
    const actual = renderViewLine(new RenderLineInput(
      false,
      false,
      `transferBalance(5678,${String.fromCharCode(8238)}6776,4321${String.fromCharCode(8236)},"USD");`,
      false,
      false,
      false,
      0,
      createViewLineTokens([createPart(42, 3)]),
      [],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "none",
      true,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtk3">transferBalance(5678,</span>',
        '<span class="mtkcontrol">[U+202E]</span>',
        '<span class="mtk3">6776,4321</span>',
        '<span class="mtkcontrol">[U+202C]</span>',
        '<span class="mtk3">,"USD");</span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 1, 1],
        [0, 2, 2],
        [0, 3, 3],
        [0, 4, 4],
        [0, 5, 5],
        [0, 6, 6],
        [0, 7, 7],
        [0, 8, 8],
        [0, 9, 9],
        [0, 10, 10],
        [0, 11, 11],
        [0, 12, 12],
        [0, 13, 13],
        [0, 14, 14],
        [0, 15, 15],
        [0, 16, 16],
        [0, 17, 17],
        [0, 18, 18],
        [0, 19, 19],
        [0, 20, 20],
        [1, 0, 21],
        [2, 0, 29],
        [2, 1, 30],
        [2, 2, 31],
        [2, 3, 32],
        [2, 4, 33],
        [2, 5, 34],
        [2, 6, 35],
        [2, 7, 36],
        [2, 8, 37],
        [3, 0, 38],
        [4, 0, 46],
        [4, 1, 47],
        [4, 2, 48],
        [4, 3, 49],
        [4, 4, 50],
        [4, 5, 51],
        [4, 6, 52],
        [4, 7, 53],
        [4, 8, 54]
      ]
    });
  });
  test("issue #124038: Multiple end-of-line text decorations get merged", () => {
    const actual = renderViewLine(new RenderLineInput(
      true,
      false,
      "    if",
      false,
      true,
      false,
      0,
      createViewLineTokens([createPart(4, 1), createPart(6, 2)]),
      [
        new LineDecoration(7, 7, "ced-1-TextEditorDecorationType2-17c14d98-3 ced-1-TextEditorDecorationType2-3", InlineDecorationType.Before),
        new LineDecoration(7, 7, "ced-1-TextEditorDecorationType2-17c14d98-4 ced-1-TextEditorDecorationType2-4", InlineDecorationType.After),
        new LineDecoration(7, 7, "ced-ghost-text-1-4", InlineDecorationType.After)
      ],
      4,
      0,
      10,
      10,
      10,
      1e4,
      "all",
      false,
      false,
      null
    ));
    assert.deepStrictEqual(inflateRenderLineOutput(actual), {
      html: [
        '<span class="mtkw">\xB7\u200C\xB7\u200C\xB7\u200C\xB7\u200C</span>',
        '<span class="mtk2">if</span>',
        '<span class="ced-1-TextEditorDecorationType2-17c14d98-3 ced-1-TextEditorDecorationType2-3"></span>',
        '<span class="ced-1-TextEditorDecorationType2-17c14d98-4 ced-1-TextEditorDecorationType2-4"></span>',
        '<span class="ced-ghost-text-1-4"></span>'
      ],
      mapping: [
        [0, 0, 0],
        [0, 2, 1],
        [0, 4, 2],
        [0, 6, 3],
        [1, 0, 4],
        [1, 1, 5],
        [3, 0, 6]
      ]
    });
  });
  function createTestGetColumnOfLinePartOffset(lineContent, tabSize, parts, expectedPartLengths) {
    const renderLineOutput = renderViewLine(new RenderLineInput(
      false,
      true,
      lineContent,
      false,
      true,
      false,
      0,
      createViewLineTokens(parts),
      [],
      tabSize,
      0,
      10,
      10,
      10,
      -1,
      "none",
      false,
      false,
      null
    ));
    return (partIndex, partLength, offset, expected) => {
      const actualColumn = renderLineOutput.characterMapping.getColumn(new DomPosition(partIndex, offset), partLength);
      assert.strictEqual(actualColumn, expected, "getColumn for " + partIndex + ", " + offset);
    };
  }
  test("getColumnOfLinePartOffset 1 - simple text", () => {
    const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset(
      "hello world",
      4,
      [
        createPart(11, 1)
      ],
      [11]
    );
    testGetColumnOfLinePartOffset(0, 11, 0, 1);
    testGetColumnOfLinePartOffset(0, 11, 1, 2);
    testGetColumnOfLinePartOffset(0, 11, 2, 3);
    testGetColumnOfLinePartOffset(0, 11, 3, 4);
    testGetColumnOfLinePartOffset(0, 11, 4, 5);
    testGetColumnOfLinePartOffset(0, 11, 5, 6);
    testGetColumnOfLinePartOffset(0, 11, 6, 7);
    testGetColumnOfLinePartOffset(0, 11, 7, 8);
    testGetColumnOfLinePartOffset(0, 11, 8, 9);
    testGetColumnOfLinePartOffset(0, 11, 9, 10);
    testGetColumnOfLinePartOffset(0, 11, 10, 11);
    testGetColumnOfLinePartOffset(0, 11, 11, 12);
  });
  test("getColumnOfLinePartOffset 2 - regular JS", () => {
    const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset(
      "var x = 3;",
      4,
      [
        createPart(3, 1),
        createPart(4, 2),
        createPart(5, 3),
        createPart(8, 4),
        createPart(9, 5),
        createPart(10, 6)
      ],
      [3, 1, 1, 3, 1, 1]
    );
    testGetColumnOfLinePartOffset(0, 3, 0, 1);
    testGetColumnOfLinePartOffset(0, 3, 1, 2);
    testGetColumnOfLinePartOffset(0, 3, 2, 3);
    testGetColumnOfLinePartOffset(0, 3, 3, 4);
    testGetColumnOfLinePartOffset(1, 1, 0, 4);
    testGetColumnOfLinePartOffset(1, 1, 1, 5);
    testGetColumnOfLinePartOffset(2, 1, 0, 5);
    testGetColumnOfLinePartOffset(2, 1, 1, 6);
    testGetColumnOfLinePartOffset(3, 3, 0, 6);
    testGetColumnOfLinePartOffset(3, 3, 1, 7);
    testGetColumnOfLinePartOffset(3, 3, 2, 8);
    testGetColumnOfLinePartOffset(3, 3, 3, 9);
    testGetColumnOfLinePartOffset(4, 1, 0, 9);
    testGetColumnOfLinePartOffset(4, 1, 1, 10);
    testGetColumnOfLinePartOffset(5, 1, 0, 10);
    testGetColumnOfLinePartOffset(5, 1, 1, 11);
  });
  test("getColumnOfLinePartOffset 3 - tab with tab size 6", () => {
    const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset(
      "	",
      6,
      [
        createPart(1, 1)
      ],
      [6]
    );
    testGetColumnOfLinePartOffset(0, 6, 0, 1);
    testGetColumnOfLinePartOffset(0, 6, 1, 1);
    testGetColumnOfLinePartOffset(0, 6, 2, 1);
    testGetColumnOfLinePartOffset(0, 6, 3, 1);
    testGetColumnOfLinePartOffset(0, 6, 4, 2);
    testGetColumnOfLinePartOffset(0, 6, 5, 2);
    testGetColumnOfLinePartOffset(0, 6, 6, 2);
  });
  test("getColumnOfLinePartOffset 4 - once indented line, tab size 4", () => {
    const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset(
      "	function",
      4,
      [
        createPart(1, 1),
        createPart(9, 2)
      ],
      [4, 8]
    );
    testGetColumnOfLinePartOffset(0, 4, 0, 1);
    testGetColumnOfLinePartOffset(0, 4, 1, 1);
    testGetColumnOfLinePartOffset(0, 4, 2, 1);
    testGetColumnOfLinePartOffset(0, 4, 3, 2);
    testGetColumnOfLinePartOffset(0, 4, 4, 2);
    testGetColumnOfLinePartOffset(1, 8, 0, 2);
    testGetColumnOfLinePartOffset(1, 8, 1, 3);
    testGetColumnOfLinePartOffset(1, 8, 2, 4);
    testGetColumnOfLinePartOffset(1, 8, 3, 5);
    testGetColumnOfLinePartOffset(1, 8, 4, 6);
    testGetColumnOfLinePartOffset(1, 8, 5, 7);
    testGetColumnOfLinePartOffset(1, 8, 6, 8);
    testGetColumnOfLinePartOffset(1, 8, 7, 9);
    testGetColumnOfLinePartOffset(1, 8, 8, 10);
  });
  test("getColumnOfLinePartOffset 5 - twice indented line, tab size 4", () => {
    const testGetColumnOfLinePartOffset = createTestGetColumnOfLinePartOffset(
      "		function",
      4,
      [
        createPart(2, 1),
        createPart(10, 2)
      ],
      [8, 8]
    );
    testGetColumnOfLinePartOffset(0, 8, 0, 1);
    testGetColumnOfLinePartOffset(0, 8, 1, 1);
    testGetColumnOfLinePartOffset(0, 8, 2, 1);
    testGetColumnOfLinePartOffset(0, 8, 3, 2);
    testGetColumnOfLinePartOffset(0, 8, 4, 2);
    testGetColumnOfLinePartOffset(0, 8, 5, 2);
    testGetColumnOfLinePartOffset(0, 8, 6, 2);
    testGetColumnOfLinePartOffset(0, 8, 7, 3);
    testGetColumnOfLinePartOffset(0, 8, 8, 3);
    testGetColumnOfLinePartOffset(1, 8, 0, 3);
    testGetColumnOfLinePartOffset(1, 8, 1, 4);
    testGetColumnOfLinePartOffset(1, 8, 2, 5);
    testGetColumnOfLinePartOffset(1, 8, 3, 6);
    testGetColumnOfLinePartOffset(1, 8, 4, 7);
    testGetColumnOfLinePartOffset(1, 8, 5, 8);
    testGetColumnOfLinePartOffset(1, 8, 6, 9);
    testGetColumnOfLinePartOffset(1, 8, 7, 10);
    testGetColumnOfLinePartOffset(1, 8, 8, 11);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vdmlld0xheW91dC92aWV3TGluZVJlbmRlcmVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NoYXJDb2RlLmpzJztcbmltcG9ydCAqIGFzIHN0cmluZ3MgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE1ldGFkYXRhQ29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSVZpZXdMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IExpbmVEZWNvcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdMYXlvdXQvbGluZURlY29yYXRpb25zLmpzJztcbmltcG9ydCB7IENoYXJhY3Rlck1hcHBpbmcsIERvbVBvc2l0aW9uLCBMaW5lUmFuZ2UsIFJlbmRlckxpbmVJbnB1dCwgUmVuZGVyTGluZU91dHB1dDIsIHJlbmRlclZpZXdMaW5lMiBhcyByZW5kZXJWaWV3TGluZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TGF5b3V0L3ZpZXdMaW5lUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgSW5saW5lRGVjb3JhdGlvblR5cGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsLmpzJztcbmltcG9ydCB7IFRlc3RMaW5lVG9rZW4sIFRlc3RMaW5lVG9rZW5zIH0gZnJvbSAnLi4vY29yZS90ZXN0TGluZVRva2VuLmpzJztcblxuZnVuY3Rpb24gY3JlYXRlVmlld0xpbmVUb2tlbnModmlld0xpbmVUb2tlbnM6IFRlc3RMaW5lVG9rZW5bXSk6IElWaWV3TGluZVRva2VucyB7XG5cdHJldHVybiBuZXcgVGVzdExpbmVUb2tlbnModmlld0xpbmVUb2tlbnMpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVQYXJ0KGVuZEluZGV4OiBudW1iZXIsIGZvcmVncm91bmQ6IG51bWJlcik6IFRlc3RMaW5lVG9rZW4ge1xuXHRyZXR1cm4gbmV3IFRlc3RMaW5lVG9rZW4oZW5kSW5kZXgsIChcblx0XHRmb3JlZ3JvdW5kIDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUXG5cdCkgPj4+IDApO1xufVxuXG5mdW5jdGlvbiBpbmZsYXRlUmVuZGVyTGluZU91dHB1dChyZW5kZXJMaW5lT3V0cHV0OiBSZW5kZXJMaW5lT3V0cHV0Mikge1xuXHQvLyByZW1vdmUgZW5jb21wYXNzaW5nIDxzcGFuPiB0byBzaW1wbGlmeSB0ZXN0IHdyaXRpbmcuXG5cdGxldCBodG1sID0gcmVuZGVyTGluZU91dHB1dC5odG1sO1xuXHRpZiAoaHRtbC5zdGFydHNXaXRoKCc8c3Bhbj4nKSkge1xuXHRcdGh0bWwgPSBodG1sLnJlcGxhY2UoL148c3Bhbj4vLCAnJyk7XG5cdH1cblx0aHRtbCA9IGh0bWwucmVwbGFjZSgvPFxcL3NwYW4+JC8sICcnKTtcblx0Y29uc3Qgc3BhbnM6IHN0cmluZ1tdID0gW107XG5cdGxldCBsYXN0SW5kZXggPSAwO1xuXHRkbyB7XG5cdFx0Y29uc3QgbmV3SW5kZXggPSBodG1sLmluZGV4T2YoJzxzcGFuJywgbGFzdEluZGV4ICsgMSk7XG5cdFx0aWYgKG5ld0luZGV4ID09PSAtMSkge1xuXHRcdFx0YnJlYWs7XG5cdFx0fVxuXHRcdHNwYW5zLnB1c2goaHRtbC5zdWJzdHJpbmcobGFzdEluZGV4LCBuZXdJbmRleCkpO1xuXHRcdGxhc3RJbmRleCA9IG5ld0luZGV4O1xuXHR9IHdoaWxlICh0cnVlKTtcblx0c3BhbnMucHVzaChodG1sLnN1YnN0cmluZyhsYXN0SW5kZXgpKTtcblxuXHRyZXR1cm4ge1xuXHRcdGh0bWw6IHNwYW5zLFxuXHRcdG1hcHBpbmc6IHJlbmRlckxpbmVPdXRwdXQuY2hhcmFjdGVyTWFwcGluZy5pbmZsYXRlKCksXG5cdH07XG59XG5cbnN1aXRlKCd2aWV3TGluZVJlbmRlcmVyLnJlbmRlckxpbmUnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQobGluZUNvbnRlbnQ6IHN0cmluZywgdGFiU2l6ZTogbnVtYmVyLCBleHBlY3RlZDogc3RyaW5nLCBleHBlY3RlZENoYXJPZmZzZXRJblBhcnQ6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0Y29uc3QgX2FjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRsaW5lQ29udGVudCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0c3RyaW5ncy5pc0Jhc2ljQVNDSUkobGluZUNvbnRlbnQpLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW25ldyBUZXN0TGluZVRva2VuKGxpbmVDb250ZW50Lmxlbmd0aCwgMCldKSxcblx0XHRcdFtdLFxuXHRcdFx0dGFiU2l6ZSxcblx0XHRcdDAsXG5cdFx0XHQwLFxuXHRcdFx0MCxcblx0XHRcdDAsXG5cdFx0XHQtMSxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoX2FjdHVhbC5odG1sLCAnPHNwYW4+PHNwYW4gY2xhc3M9XCJtdGswXCI+JyArIGV4cGVjdGVkICsgJzwvc3Bhbj48L3NwYW4+Jyk7XG5cdFx0Y29uc3QgaW5mbyA9IGV4cGVjdGVkQ2hhck9mZnNldEluUGFydC5tYXA8Q2hhcmFjdGVyTWFwcGluZ0luZm8+KChhYnNvbHV0ZU9mZnNldCkgPT4gW2Fic29sdXRlT2Zmc2V0LCBbMCwgYWJzb2x1dGVPZmZzZXRdXSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyTWFwcGluZzMoX2FjdHVhbC5jaGFyYWN0ZXJNYXBwaW5nLCBpbmZvKTtcblx0fVxuXG5cdHRlc3QoJ3JlcGxhY2VzIHNwYWNlcycsICgpID0+IHtcblx0XHRhc3NlcnRDaGFyYWN0ZXJSZXBsYWNlbWVudCgnICcsIDQsICdcXHUwMGEwJywgWzAsIDFdKTtcblx0XHRhc3NlcnRDaGFyYWN0ZXJSZXBsYWNlbWVudCgnICAnLCA0LCAnXFx1MDBhMFxcdTAwYTAnLCBbMCwgMSwgMl0pO1xuXHRcdGFzc2VydENoYXJhY3RlclJlcGxhY2VtZW50KCdhICBiJywgNCwgJ2FcXHUwMGEwXFx1MDBhMGInLCBbMCwgMSwgMiwgMywgNF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdlc2NhcGVzIEhUTUwgbWFya3VwJywgKCkgPT4ge1xuXHRcdGFzc2VydENoYXJhY3RlclJlcGxhY2VtZW50KCdhPGInLCA0LCAnYSZsdDtiJywgWzAsIDEsIDIsIDNdKTtcblx0XHRhc3NlcnRDaGFyYWN0ZXJSZXBsYWNlbWVudCgnYT5iJywgNCwgJ2EmZ3Q7YicsIFswLCAxLCAyLCAzXSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQoJ2EmYicsIDQsICdhJmFtcDtiJywgWzAsIDEsIDIsIDNdKTtcblx0fSk7XG5cblx0dGVzdCgncmVwbGFjZXMgc29tZSBiYWQgY2hhcmFjdGVycycsICgpID0+IHtcblx0XHRhc3NlcnRDaGFyYWN0ZXJSZXBsYWNlbWVudCgnYVxcMGInLCA0LCAnYSYjMDA7YicsIFswLCAxLCAyLCAzXSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQoJ2EnICsgU3RyaW5nLmZyb21DaGFyQ29kZShDaGFyQ29kZS5VVEY4X0JPTSkgKyAnYicsIDQsICdhXFx1ZmZmZGInLCBbMCwgMSwgMiwgM10pO1xuXHRcdGFzc2VydENoYXJhY3RlclJlcGxhY2VtZW50KCdhXFx1MjAyOGInLCA0LCAnYVxcdWZmZmRiJywgWzAsIDEsIDIsIDNdKTtcblx0fSk7XG5cblx0dGVzdCgnaGFuZGxlcyB0YWJzJywgKCkgPT4ge1xuXHRcdGFzc2VydENoYXJhY3RlclJlcGxhY2VtZW50KCdcXHQnLCA0LCAnXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMCcsIFswLCA0XSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQoJ3hcXHQnLCA0LCAneFxcdTAwYTBcXHUwMGEwXFx1MDBhMCcsIFswLCAxLCA0XSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQoJ3h4XFx0JywgNCwgJ3h4XFx1MDBhMFxcdTAwYTAnLCBbMCwgMSwgMiwgNF0pO1xuXHRcdGFzc2VydENoYXJhY3RlclJlcGxhY2VtZW50KCd4eHhcXHQnLCA0LCAneHh4XFx1MDBhMCcsIFswLCAxLCAyLCAzLCA0XSk7XG5cdFx0YXNzZXJ0Q2hhcmFjdGVyUmVwbGFjZW1lbnQoJ3h4eHhcXHQnLCA0LCAneHh4eFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTAnLCBbMCwgMSwgMiwgMywgNCwgOF0pO1xuXHR9KTtcblxuXHRmdW5jdGlvbiBhc3NlcnRQYXJ0cyhsaW5lQ29udGVudDogc3RyaW5nLCB0YWJTaXplOiBudW1iZXIsIHBhcnRzOiBUZXN0TGluZVRva2VuW10sIGV4cGVjdGVkOiBzdHJpbmcsIGluZm86IENoYXJhY3Rlck1hcHBpbmdJbmZvW10pOiB2b2lkIHtcblx0XHRjb25zdCBfYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVDb250ZW50LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMocGFydHMpLFxuXHRcdFx0W10sXG5cdFx0XHR0YWJTaXplLFxuXHRcdFx0MCxcblx0XHRcdDAsXG5cdFx0XHQwLFxuXHRcdFx0MCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChfYWN0dWFsLmh0bWwsICc8c3Bhbj4nICsgZXhwZWN0ZWQgKyAnPC9zcGFuPicpO1xuXHRcdGFzc2VydENoYXJhY3Rlck1hcHBpbmczKF9hY3R1YWwuY2hhcmFjdGVyTWFwcGluZywgaW5mbyk7XG5cdH1cblxuXHR0ZXN0KCdlbXB0eSBsaW5lJywgKCkgPT4ge1xuXHRcdGFzc2VydFBhcnRzKCcnLCA0LCBbXSwgJzxzcGFuPjwvc3Bhbj4nLCBbXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VzZXMgcGFydCB0eXBlJywgKCkgPT4ge1xuXHRcdGFzc2VydFBhcnRzKCd4JywgNCwgW2NyZWF0ZVBhcnQoMSwgMTApXSwgJzxzcGFuIGNsYXNzPVwibXRrMTBcIj54PC9zcGFuPicsIFtbMCwgWzAsIDBdXSwgWzEsIFswLCAxXV1dKTtcblx0XHRhc3NlcnRQYXJ0cygneCcsIDQsIFtjcmVhdGVQYXJ0KDEsIDIwKV0sICc8c3BhbiBjbGFzcz1cIm10azIwXCI+eDwvc3Bhbj4nLCBbWzAsIFswLCAwXV0sIFsxLCBbMCwgMV1dXSk7XG5cdFx0YXNzZXJ0UGFydHMoJ3gnLCA0LCBbY3JlYXRlUGFydCgxLCAzMCldLCAnPHNwYW4gY2xhc3M9XCJtdGszMFwiPng8L3NwYW4+JywgW1swLCBbMCwgMF1dLCBbMSwgWzAsIDFdXV0pO1xuXHR9KTtcblxuXHR0ZXN0KCd0d28gcGFydHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0UGFydHMoJ3h5JywgNCwgW2NyZWF0ZVBhcnQoMSwgMSksIGNyZWF0ZVBhcnQoMiwgMildLCAnPHNwYW4gY2xhc3M9XCJtdGsxXCI+eDwvc3Bhbj48c3BhbiBjbGFzcz1cIm10azJcIj55PC9zcGFuPicsIFtbMCwgWzAsIDBdXSwgWzEsIFsxLCAwXV0sIFsyLCBbMSwgMV1dXSk7XG5cdFx0YXNzZXJ0UGFydHMoJ3h5eicsIDQsIFtjcmVhdGVQYXJ0KDEsIDEpLCBjcmVhdGVQYXJ0KDMsIDIpXSwgJzxzcGFuIGNsYXNzPVwibXRrMVwiPng8L3NwYW4+PHNwYW4gY2xhc3M9XCJtdGsyXCI+eXo8L3NwYW4+JywgW1swLCBbMCwgMF1dLCBbMSwgWzEsIDBdXSwgWzIsIFsxLCAxXV0sIFszLCBbMSwgMl1dXSk7XG5cdFx0YXNzZXJ0UGFydHMoJ3h5eicsIDQsIFtjcmVhdGVQYXJ0KDIsIDEpLCBjcmVhdGVQYXJ0KDMsIDIpXSwgJzxzcGFuIGNsYXNzPVwibXRrMVwiPnh5PC9zcGFuPjxzcGFuIGNsYXNzPVwibXRrMlwiPno8L3NwYW4+JywgW1swLCBbMCwgMF1dLCBbMSwgWzAsIDFdXSwgWzIsIFsxLCAwXV0sIFszLCBbMSwgMV1dXSk7XG5cdH0pO1xuXG5cdHRlc3QoJ292ZXJmbG93JywgKCkgPT4ge1xuXHRcdGNvbnN0IF9hY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0J0hlbGxvIHdvcmxkIScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMSwgMCksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMiwgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMywgMiksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMyksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoNSwgNCksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoNiwgNSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoNywgNiksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoOCwgNyksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoOSwgOCksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMTAsIDkpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDExLCAxMCksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMTIsIDExKSxcblx0XHRcdF0pLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDYsXG5cdFx0XHQnYm91bmRhcnknLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoX2FjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMFwiPkg8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPmU8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPmw8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmw8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrNFwiPm88L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrNVwiPlxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrb3ZlcmZsb3dcIj5TaG93IG1vcmUgKDYgY2hhcnMpPC9zcGFuPidcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0WzEsIDAsIDFdLFxuXHRcdFx0XHRbMiwgMCwgMl0sXG5cdFx0XHRcdFszLCAwLCAzXSxcblx0XHRcdFx0WzQsIDAsIDRdLFxuXHRcdFx0XHRbNSwgMCwgNV0sXG5cdFx0XHRcdFs1LCAxLCA2XSxcblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndHlwaWNhbCBsaW5lJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gJ1xcdCAgICBleHBvcnQgY2xhc3MgR2FtZSB7IC8vIGh0dHA6Ly90ZXN0LmNvbSAgICAgJztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRjcmVhdGVQYXJ0KDUsIDEpLFxuXHRcdFx0Y3JlYXRlUGFydCgxMSwgMiksXG5cdFx0XHRjcmVhdGVQYXJ0KDEyLCAzKSxcblx0XHRcdGNyZWF0ZVBhcnQoMTcsIDQpLFxuXHRcdFx0Y3JlYXRlUGFydCgxOCwgNSksXG5cdFx0XHRjcmVhdGVQYXJ0KDIyLCA2KSxcblx0XHRcdGNyZWF0ZVBhcnQoMjMsIDcpLFxuXHRcdFx0Y3JlYXRlUGFydCgyNCwgOCksXG5cdFx0XHRjcmVhdGVQYXJ0KDI1LCA5KSxcblx0XHRcdGNyZWF0ZVBhcnQoMjgsIDEwKSxcblx0XHRcdGNyZWF0ZVBhcnQoNDMsIDExKSxcblx0XHRcdGNyZWF0ZVBhcnQoNDgsIDEyKSxcblx0XHRdKTtcblx0XHRjb25zdCBfYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J2JvdW5kYXJ5Jyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KF9hY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+ZXhwb3J0PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azRcIj5jbGFzczwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs1XCI+XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs2XCI+R2FtZTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs3XCI+XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs4XCI+ezwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs5XCI+XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxMFwiPi8vXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxMVwiPmh0dHA6Ly90ZXN0LmNvbTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoyMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDozMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjPC9zcGFuPidcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0WzEsIDAsIDRdLCBbMSwgMiwgNV0sIFsxLCA0LCA2XSwgWzEsIDYsIDddLFxuXHRcdFx0XHRbMiwgMCwgOF0sIFsyLCAxLCA5XSwgWzIsIDIsIDEwXSwgWzIsIDMsIDExXSwgWzIsIDQsIDEyXSwgWzIsIDUsIDEzXSxcblx0XHRcdFx0WzMsIDAsIDE0XSxcblx0XHRcdFx0WzQsIDAsIDE1XSwgWzQsIDEsIDE2XSwgWzQsIDIsIDE3XSwgWzQsIDMsIDE4XSwgWzQsIDQsIDE5XSxcblx0XHRcdFx0WzUsIDAsIDIwXSxcblx0XHRcdFx0WzYsIDAsIDIxXSwgWzYsIDEsIDIyXSwgWzYsIDIsIDIzXSwgWzYsIDMsIDI0XSxcblx0XHRcdFx0WzcsIDAsIDI1XSxcblx0XHRcdFx0WzgsIDAsIDI2XSxcblx0XHRcdFx0WzksIDAsIDI3XSxcblx0XHRcdFx0WzEwLCAwLCAyOF0sIFsxMCwgMSwgMjldLCBbMTAsIDIsIDMwXSxcblx0XHRcdFx0WzExLCAwLCAzMV0sIFsxMSwgMSwgMzJdLCBbMTEsIDIsIDMzXSwgWzExLCAzLCAzNF0sIFsxMSwgNCwgMzVdLCBbMTEsIDUsIDM2XSwgWzExLCA2LCAzN10sIFsxMSwgNywgMzhdLCBbMTEsIDgsIDM5XSwgWzExLCA5LCA0MF0sIFsxMSwgMTAsIDQxXSwgWzExLCAxMSwgNDJdLCBbMTEsIDEyLCA0M10sIFsxMSwgMTMsIDQ0XSwgWzExLCAxNCwgNDVdLFxuXHRcdFx0XHRbMTIsIDAsIDQ2XSwgWzEyLCAyLCA0N10sXG5cdFx0XHRcdFsxMywgMCwgNDhdLCBbMTMsIDIsIDQ5XSwgWzEzLCA0LCA1MF0sIFsxMywgNiwgNTFdLFxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjI1NTogV2VpcmQgbGluZSByZW5kZXJpbmcgcGFydCAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gJ1xcdFxcdFxcdGN1cnNvclN0eWxlOlxcdFxcdFxcdFxcdFxcdFxcdChwcmV2T3B0cy5jdXJzb3JTdHlsZSAhPT0gbmV3T3B0cy5jdXJzb3JTdHlsZSksJztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRjcmVhdGVQYXJ0KDMsIDEpLCAvLyAzIGNoYXJzXG5cdFx0XHRjcmVhdGVQYXJ0KDE1LCAyKSwgLy8gMTIgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoMjEsIDMpLCAvLyA2IGNoYXJzXG5cdFx0XHRjcmVhdGVQYXJ0KDIyLCA0KSwgLy8gMSBjaGFyXG5cdFx0XHRjcmVhdGVQYXJ0KDQzLCA1KSwgLy8gMjEgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoNDUsIDYpLCAvLyAyIGNoYXJzXG5cdFx0XHRjcmVhdGVQYXJ0KDQ2LCA3KSwgLy8gMSBjaGFyXG5cdFx0XHRjcmVhdGVQYXJ0KDY2LCA4KSwgLy8gMjAgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoNjcsIDkpLCAvLyAxIGNoYXJcblx0XHRcdGNyZWF0ZVBhcnQoNjgsIDEwKSwgLy8gMiBjaGFyc1xuXHRcdF0pO1xuXHRcdGNvbnN0IF9hY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZVRleHQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRsaW5lUGFydHMsXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChfYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+XFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj5jdXJzb3JTdHlsZTo8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs0XCI+KDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs1XCI+cHJldk9wdHMuY3Vyc29yU3R5bGVcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azZcIj4hPTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs3XCI+PTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs4XCI+XFx1MDBhMG5ld09wdHMuY3Vyc29yU3R5bGU8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrOVwiPik8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMTBcIj4sPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCA0LCA0XSwgWzAsIDgsIDhdLFxuXHRcdFx0XHRbMSwgMCwgMTJdLCBbMSwgMSwgMTNdLCBbMSwgMiwgMTRdLCBbMSwgMywgMTVdLCBbMSwgNCwgMTZdLCBbMSwgNSwgMTddLCBbMSwgNiwgMThdLCBbMSwgNywgMTldLCBbMSwgOCwgMjBdLCBbMSwgOSwgMjFdLCBbMSwgMTAsIDIyXSwgWzEsIDExLCAyM10sXG5cdFx0XHRcdFsyLCAwLCAyNF0sIFsyLCA0LCAyOF0sIFsyLCA4LCAzMl0sIFsyLCAxMiwgMzZdLCBbMiwgMTYsIDQwXSwgWzIsIDIwLCA0NF0sXG5cdFx0XHRcdFszLCAwLCA0OF0sXG5cdFx0XHRcdFs0LCAwLCA0OV0sIFs0LCAxLCA1MF0sIFs0LCAyLCA1MV0sIFs0LCAzLCA1Ml0sIFs0LCA0LCA1M10sIFs0LCA1LCA1NF0sIFs0LCA2LCA1NV0sIFs0LCA3LCA1Nl0sIFs0LCA4LCA1N10sIFs0LCA5LCA1OF0sIFs0LCAxMCwgNTldLCBbNCwgMTEsIDYwXSwgWzQsIDEyLCA2MV0sIFs0LCAxMywgNjJdLCBbNCwgMTQsIDYzXSwgWzQsIDE1LCA2NF0sIFs0LCAxNiwgNjVdLCBbNCwgMTcsIDY2XSwgWzQsIDE4LCA2N10sIFs0LCAxOSwgNjhdLCBbNCwgMjAsIDY5XSxcblx0XHRcdFx0WzUsIDAsIDcwXSwgWzUsIDEsIDcxXSxcblx0XHRcdFx0WzYsIDAsIDcyXSxcblx0XHRcdFx0WzcsIDAsIDczXSwgWzcsIDEsIDc0XSwgWzcsIDIsIDc1XSwgWzcsIDMsIDc2XSwgWzcsIDQsIDc3XSwgWzcsIDUsIDc4XSwgWzcsIDYsIDc5XSwgWzcsIDcsIDgwXSwgWzcsIDgsIDgxXSwgWzcsIDksIDgyXSwgWzcsIDEwLCA4M10sIFs3LCAxMSwgODRdLCBbNywgMTIsIDg1XSwgWzcsIDEzLCA4Nl0sIFs3LCAxNCwgODddLCBbNywgMTUsIDg4XSwgWzcsIDE2LCA4OV0sIFs3LCAxNywgOTBdLCBbNywgMTgsIDkxXSwgWzcsIDE5LCA5Ml0sXG5cdFx0XHRcdFs4LCAwLCA5M10sXG5cdFx0XHRcdFs5LCAwLCA5NF0sIFs5LCAxLCA5NV0sXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMjU1OiBXZWlyZCBsaW5lIHJlbmRlcmluZyBwYXJ0IDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZVRleHQgPSAnIFxcdFxcdFxcdGN1cnNvclN0eWxlOlxcdFxcdFxcdFxcdFxcdFxcdChwcmV2T3B0cy5jdXJzb3JTdHlsZSAhPT0gbmV3T3B0cy5jdXJzb3JTdHlsZSksJztcblxuXHRcdGNvbnN0IGxpbmVQYXJ0cyA9IGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtcblx0XHRcdGNyZWF0ZVBhcnQoNCwgMSksIC8vIDQgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoMTYsIDIpLCAvLyAxMiBjaGFyc1xuXHRcdFx0Y3JlYXRlUGFydCgyMiwgMyksIC8vIDYgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoMjMsIDQpLCAvLyAxIGNoYXJcblx0XHRcdGNyZWF0ZVBhcnQoNDQsIDUpLCAvLyAyMSBjaGFyc1xuXHRcdFx0Y3JlYXRlUGFydCg0NiwgNiksIC8vIDIgY2hhcnNcblx0XHRcdGNyZWF0ZVBhcnQoNDcsIDcpLCAvLyAxIGNoYXJcblx0XHRcdGNyZWF0ZVBhcnQoNjcsIDgpLCAvLyAyMCBjaGFyc1xuXHRcdFx0Y3JlYXRlUGFydCg2OCwgOSksIC8vIDEgY2hhclxuXHRcdFx0Y3JlYXRlUGFydCg2OSwgMTApLCAvLyAyIGNoYXJzXG5cdFx0XSk7XG5cdFx0Y29uc3QgX2FjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRsaW5lVGV4dCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGxpbmVQYXJ0cyxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQtMSxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KF9hY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5cXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPmN1cnNvclN0eWxlOjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+XFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azRcIj4oPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azVcIj5wcmV2T3B0cy5jdXJzb3JTdHlsZVxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrNlwiPiE9PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azdcIj49PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azhcIj5cXHUwMGEwbmV3T3B0cy5jdXJzb3JTdHlsZTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs5XCI+KTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxMFwiPiw8L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLCBbMCwgNCwgNF0sIFswLCA4LCA4XSxcblx0XHRcdFx0WzEsIDAsIDEyXSwgWzEsIDEsIDEzXSwgWzEsIDIsIDE0XSwgWzEsIDMsIDE1XSwgWzEsIDQsIDE2XSwgWzEsIDUsIDE3XSwgWzEsIDYsIDE4XSwgWzEsIDcsIDE5XSwgWzEsIDgsIDIwXSwgWzEsIDksIDIxXSwgWzEsIDEwLCAyMl0sIFsxLCAxMSwgMjNdLFxuXHRcdFx0XHRbMiwgMCwgMjRdLCBbMiwgNCwgMjhdLCBbMiwgOCwgMzJdLCBbMiwgMTIsIDM2XSwgWzIsIDE2LCA0MF0sIFsyLCAyMCwgNDRdLFxuXHRcdFx0XHRbMywgMCwgNDhdLCBbNCwgMCwgNDldLCBbNCwgMSwgNTBdLCBbNCwgMiwgNTFdLCBbNCwgMywgNTJdLCBbNCwgNCwgNTNdLCBbNCwgNSwgNTRdLCBbNCwgNiwgNTVdLCBbNCwgNywgNTZdLCBbNCwgOCwgNTddLCBbNCwgOSwgNThdLCBbNCwgMTAsIDU5XSwgWzQsIDExLCA2MF0sIFs0LCAxMiwgNjFdLCBbNCwgMTMsIDYyXSwgWzQsIDE0LCA2M10sIFs0LCAxNSwgNjRdLCBbNCwgMTYsIDY1XSwgWzQsIDE3LCA2Nl0sIFs0LCAxOCwgNjddLCBbNCwgMTksIDY4XSwgWzQsIDIwLCA2OV0sXG5cdFx0XHRcdFs1LCAwLCA3MF0sIFs1LCAxLCA3MV0sXG5cdFx0XHRcdFs2LCAwLCA3Ml0sXG5cdFx0XHRcdFs3LCAwLCA3M10sIFs3LCAxLCA3NF0sIFs3LCAyLCA3NV0sIFs3LCAzLCA3Nl0sIFs3LCA0LCA3N10sIFs3LCA1LCA3OF0sIFs3LCA2LCA3OV0sIFs3LCA3LCA4MF0sIFs3LCA4LCA4MV0sIFs3LCA5LCA4Ml0sIFs3LCAxMCwgODNdLCBbNywgMTEsIDg0XSwgWzcsIDEyLCA4NV0sIFs3LCAxMywgODZdLCBbNywgMTQsIDg3XSwgWzcsIDE1LCA4OF0sIFs3LCAxNiwgODldLCBbNywgMTcsIDkwXSwgWzcsIDE4LCA5MV0sIFs3LCAxOSwgOTJdLFxuXHRcdFx0XHRbOCwgMCwgOTNdLFxuXHRcdFx0XHRbOSwgMCwgOTRdLCBbOSwgMSwgOTVdLFxuXHRcdFx0XSxcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzkxMTc4OiBhZnRlciBkZWNvcmF0aW9uIHR5cGUgc2hvd24gYmVmb3JlIGN1cnNvcicsICgpID0+IHtcblx0XHRjb25zdCBsaW5lVGV4dCA9ICcvL2p1c3QgYSBjb21tZW50Jztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRjcmVhdGVQYXJ0KDE2LCAxKVxuXHRcdF0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRsaW5lVGV4dCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGxpbmVQYXJ0cyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDEzLCAxMywgJ2RlYzEnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5BZnRlciksXG5cdFx0XHRcdG5ldyBMaW5lRGVjb3JhdGlvbigxMywgMTMsICdkZWMyJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdF0sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwgKHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPi8vanVzdFxcdTAwYTBhXFx1MDBhMGNvbTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxIGRlYzJcIj48L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMSBkZWMxXCI+PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5tZW50PC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSwgWzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSxcblx0XHRcdFx0WzIsIDAsIDEyXSxcblx0XHRcdFx0WzMsIDEsIDEzXSwgWzMsIDIsIDE0XSwgWzMsIDMsIDE1XSwgWzMsIDQsIDE2XVxuXHRcdFx0XVxuXHRcdH0pKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMjgwOiBJbXByb3ZlZCBzb3VyY2UgY29kZSByZW5kZXJpbmcgZm9yIFJUTCBsYW5ndWFnZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZVRleHQgPSAndmFyIFx1MDVFN1x1MDVENVx1MDVEM1x1MDVERVx1MDVENVx1MDVFQSA9IFxcXCJcdTA1REVcdTA1RDlcdTA1RDVcdTA1RUFcdTA1RTggXHUwNUU3XHUwNUQ1XHUwNUQzXHUwNURFXHUwNUQ1XHUwNUVBIFx1MDVFNlxcJ1x1MDVEOCBcdTA1RTlcdTA1REMsIFx1MDVEMFx1MDVERCBcdTA1RENcdTA1RTlcdTA1RDVcdTA1REYgXHUwNUQ0XHUwNUUyXHUwNUQxXHUwNUU4XHUwNUQ5XHUwNUVBIFx1MDVFOVx1MDVEOVx1MDVFMFx1MDVENVx1MDVEOVx1MDVEOVx1MDVERCBcdTA1RDVcdTA1RDlcdTA1RTksIFx1MDVEMFx1MDVERFxcXCI7Jztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRjcmVhdGVQYXJ0KDMsIDYpLFxuXHRcdFx0Y3JlYXRlUGFydCgxMywgMSksXG5cdFx0XHRjcmVhdGVQYXJ0KDY2LCAyMCksXG5cdFx0XHRjcmVhdGVQYXJ0KDY3LCAxKSxcblx0XHRdKTtcblx0XHRjb25zdCBfYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoX2FjdHVhbCksICh7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBkaXI9XCJsdHJcIj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs2XCI+dmFyPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBzdHlsZT1cInVuaWNvZGUtYmlkaTppc29sYXRlXCIgY2xhc3M9XCJtdGsxXCI+XFx1MDBhMFx1MDVFN1x1MDVENVx1MDVEM1x1MDVERVx1MDVENVx1MDVFQVxcdTAwYTA9XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJ1bmljb2RlLWJpZGk6aXNvbGF0ZVwiIGNsYXNzPVwibXRrMjBcIj5cIlx1MDVERVx1MDVEOVx1MDVENVx1MDVFQVx1MDVFOFxcdTAwYTBcdTA1RTdcdTA1RDVcdTA1RDNcdTA1REVcdTA1RDVcdTA1RUFcXHUwMGEwXHUwNUU2XFwnXHUwNUQ4XFx1MDBhMFx1MDVFOVx1MDVEQyxcXHUwMGEwXHUwNUQwXHUwNUREXFx1MDBhMFx1MDVEQ1x1MDVFOVx1MDVENVx1MDVERlxcdTAwYTBcdTA1RDRcdTA1RTJcdTA1RDFcdTA1RThcdTA1RDlcdTA1RUFcXHUwMGEwXHUwNUU5XHUwNUQ5XHUwNUUwXHUwNUQ1XHUwNUQ5XHUwNUQ5XHUwNUREXFx1MDBhMFx1MDVENVx1MDVEOVx1MDVFOSxcXHUwMGEwXHUwNUQwXHUwNUREXCI8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPjs8L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLCBbMCwgMiwgMl0sXG5cdFx0XHRcdFsxLCAwLCAzXSwgWzEsIDEsIDRdLCBbMSwgMiwgNV0sIFsxLCAzLCA2XSwgWzEsIDQsIDddLCBbMSwgNSwgOF0sIFsxLCA2LCA5XSwgWzEsIDcsIDEwXSwgWzEsIDgsIDExXSwgWzEsIDksIDEyXSxcblx0XHRcdFx0WzIsIDAsIDEzXSwgWzIsIDEsIDE0XSwgWzIsIDIsIDE1XSwgWzIsIDMsIDE2XSwgWzIsIDQsIDE3XSwgWzIsIDUsIDE4XSwgWzIsIDYsIDE5XSwgWzIsIDcsIDIwXSwgWzIsIDgsIDIxXSwgWzIsIDksIDIyXSwgWzIsIDEwLCAyM10sIFsyLCAxMSwgMjRdLCBbMiwgMTIsIDI1XSwgWzIsIDEzLCAyNl0sIFsyLCAxNCwgMjddLCBbMiwgMTUsIDI4XSwgWzIsIDE2LCAyOV0sIFsyLCAxNywgMzBdLCBbMiwgMTgsIDMxXSwgWzIsIDE5LCAzMl0sIFsyLCAyMCwgMzNdLCBbMiwgMjEsIDM0XSwgWzIsIDIyLCAzNV0sIFsyLCAyMywgMzZdLCBbMiwgMjQsIDM3XSwgWzIsIDI1LCAzOF0sIFsyLCAyNiwgMzldLCBbMiwgMjcsIDQwXSwgWzIsIDI4LCA0MV0sIFsyLCAyOSwgNDJdLCBbMiwgMzAsIDQzXSwgWzIsIDMxLCA0NF0sIFsyLCAzMiwgNDVdLCBbMiwgMzMsIDQ2XSwgWzIsIDM0LCA0N10sIFsyLCAzNSwgNDhdLCBbMiwgMzYsIDQ5XSwgWzIsIDM3LCA1MF0sIFsyLCAzOCwgNTFdLCBbMiwgMzksIDUyXSwgWzIsIDQwLCA1M10sIFsyLCA0MSwgNTRdLCBbMiwgNDIsIDU1XSwgWzIsIDQzLCA1Nl0sIFsyLCA0NCwgNTddLCBbMiwgNDUsIDU4XSwgWzIsIDQ2LCA1OV0sIFsyLCA0NywgNjBdLCBbMiwgNDgsIDYxXSwgWzIsIDQ5LCA2Ml0sIFsyLCA1MCwgNjNdLCBbMiwgNTEsIDY0XSwgWzIsIDUyLCA2NV0sXG5cdFx0XHRcdFszLCAwLCA2Nl0sIFszLCAxLCA2N11cblx0XHRcdF1cblx0XHR9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKF9hY3R1YWwuY29udGFpbnNSVEwsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTM3MDM2OiBJc3N1ZSBpbiBSVEwgbGFuZ3VhZ2VzIGluIHJlY2VudCB2ZXJzaW9ucycsICgpID0+IHtcblx0XHRjb25zdCBsaW5lVGV4dCA9ICc8b3B0aW9uIHZhbHVlPVxcXCJcdTA2MjdcdTA2NDRcdTA2MzlcdTA2MzFcdTA2MjhcdTA2NEFcdTA2MjlcXFwiPlx1MDYyN1x1MDY0NFx1MDYzOVx1MDYzMVx1MDYyOFx1MDY0QVx1MDYyOTwvb3B0aW9uPic7XG5cdFx0Y29uc3QgbGluZVBhcnRzID0gY3JlYXRlVmlld0xpbmVUb2tlbnMoW1xuXHRcdFx0Y3JlYXRlUGFydCgxLCAyKSxcblx0XHRcdGNyZWF0ZVBhcnQoNywgMyksXG5cdFx0XHRjcmVhdGVQYXJ0KDgsIDQpLFxuXHRcdFx0Y3JlYXRlUGFydCgxMywgNSksXG5cdFx0XHRjcmVhdGVQYXJ0KDE0LCA0KSxcblx0XHRcdGNyZWF0ZVBhcnQoMjMsIDYpLFxuXHRcdFx0Y3JlYXRlUGFydCgyNCwgMiksXG5cdFx0XHRjcmVhdGVQYXJ0KDMxLCA0KSxcblx0XHRcdGNyZWF0ZVBhcnQoMzMsIDIpLFxuXHRcdFx0Y3JlYXRlUGFydCgzOSwgMyksXG5cdFx0XHRjcmVhdGVQYXJ0KDQwLCAyKSxcblx0XHRdKTtcblx0XHRjb25zdCBfYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoX2FjdHVhbCksICh7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBkaXI9XCJsdHJcIj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+Jmx0Ozwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+b3B0aW9uPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azRcIj5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azVcIj52YWx1ZTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs0XCI+PTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJ1bmljb2RlLWJpZGk6aXNvbGF0ZVwiIGNsYXNzPVwibXRrNlwiPlwiXHUwNjI3XHUwNjQ0XHUwNjM5XHUwNjMxXHUwNjI4XHUwNjRBXHUwNjI5XCI8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPiZndDs8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIHN0eWxlPVwidW5pY29kZS1iaWRpOmlzb2xhdGVcIiBjbGFzcz1cIm10azRcIj5cdTA2MjdcdTA2NDRcdTA2MzlcdTA2MzFcdTA2MjhcdTA2NEFcdTA2Mjk8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPiZsdDsvPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5vcHRpb248L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPiZndDs8L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0WzEsIDAsIDFdLCBbMSwgMSwgMl0sIFsxLCAyLCAzXSwgWzEsIDMsIDRdLCBbMSwgNCwgNV0sIFsxLCA1LCA2XSxcblx0XHRcdFx0WzIsIDAsIDddLFxuXHRcdFx0XHRbMywgMCwgOF0sIFszLCAxLCA5XSwgWzMsIDIsIDEwXSwgWzMsIDMsIDExXSwgWzMsIDQsIDEyXSxcblx0XHRcdFx0WzQsIDAsIDEzXSxcblx0XHRcdFx0WzUsIDAsIDE0XSwgWzUsIDEsIDE1XSwgWzUsIDIsIDE2XSwgWzUsIDMsIDE3XSwgWzUsIDQsIDE4XSwgWzUsIDUsIDE5XSwgWzUsIDYsIDIwXSwgWzUsIDcsIDIxXSwgWzUsIDgsIDIyXSxcblx0XHRcdFx0WzYsIDAsIDIzXSxcblx0XHRcdFx0WzcsIDAsIDI0XSwgWzcsIDEsIDI1XSwgWzcsIDIsIDI2XSwgWzcsIDMsIDI3XSwgWzcsIDQsIDI4XSwgWzcsIDUsIDI5XSwgWzcsIDYsIDMwXSxcblx0XHRcdFx0WzgsIDAsIDMxXSwgWzgsIDEsIDMyXSxcblx0XHRcdFx0WzksIDAsIDMzXSwgWzksIDEsIDM0XSwgWzksIDIsIDM1XSwgWzksIDMsIDM2XSwgWzksIDQsIDM3XSwgWzksIDUsIDM4XSxcblx0XHRcdFx0WzEwLCAwLCAzOV0sIFsxMCwgMSwgNDBdXG5cdFx0XHRdXG5cdFx0fSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChfYWN0dWFsLmNvbnRhaW5zUlRMLCB0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzk5NTg5OiBSZW5kZXJpbmcgd2hpdGVzcGFjZSBpbmZsdWVuY2VzIGJpZGkgbGF5b3V0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gJyAgICBbXFxcIlx1RDgzRFx1RERBOFx1RkUwRiBcdTA2ODZcdTA2MjdcdTA2N0UgXHUwNjQxXHUwNjI3XHUwNkE5XHUwNjJBXHUwNjQ4XHUwNjMxXFxcIixcXFwiXHVEODNDXHVERkE4IFx1MDYyQVx1MDY0Nlx1MDYzOFx1MDZDQ1x1MDY0NVx1MDYyN1x1MDYyQVxcXCJdJztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbXG5cdFx0XHRjcmVhdGVQYXJ0KDUsIDIpLFxuXHRcdFx0Y3JlYXRlUGFydCgyMSwgMyksXG5cdFx0XHRjcmVhdGVQYXJ0KDIyLCAyKSxcblx0XHRcdGNyZWF0ZVBhcnQoMzQsIDMpLFxuXHRcdFx0Y3JlYXRlUGFydCgzNSwgMiksXG5cdFx0XSk7XG5cdFx0Y29uc3QgX2FjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHR0cnVlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J2FsbCcsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChfYWN0dWFsKSwgKHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGRpcj1cImx0clwiPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3dcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+Wzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJ1bmljb2RlLWJpZGk6aXNvbGF0ZVwiIGNsYXNzPVwibXRrM1wiPlwiXHVEODNEXHVEREE4XHVGRTBGXFx1MDBhMFx1MDY4Nlx1MDYyN1x1MDY3RVxcdTAwYTBcdTA2NDFcdTA2MjdcdTA2QTlcdTA2MkFcdTA2NDhcdTA2MzFcIjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+LDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gc3R5bGU9XCJ1bmljb2RlLWJpZGk6aXNvbGF0ZVwiIGNsYXNzPVwibXRrM1wiPlwiXHVEODNDXHVERkE4XFx1MDBhMFx1MDYyQVx1MDY0Nlx1MDYzOFx1MDZDQ1x1MDY0NVx1MDYyN1x1MDYyQVwiPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj5dPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAyLCAxXSwgWzAsIDQsIDJdLCBbMCwgNiwgM10sXG5cdFx0XHRcdFsxLCAwLCA0XSxcblx0XHRcdFx0WzIsIDAsIDVdLCBbMiwgMSwgNl0sIFsyLCAyLCA3XSwgWzIsIDMsIDhdLCBbMiwgNCwgOV0sIFsyLCA1LCAxMF0sIFsyLCA2LCAxMV0sIFsyLCA3LCAxMl0sIFsyLCA4LCAxM10sIFsyLCA5LCAxNF0sIFsyLCAxMCwgMTVdLCBbMiwgMTEsIDE2XSwgWzIsIDEyLCAxN10sIFsyLCAxMywgMThdLCBbMiwgMTQsIDE5XSwgWzIsIDE1LCAyMF0sXG5cdFx0XHRcdFszLCAwLCAyMV0sXG5cdFx0XHRcdFs0LCAwLCAyMl0sIFs0LCAxLCAyM10sIFs0LCAyLCAyNF0sIFs0LCAzLCAyNV0sIFs0LCA0LCAyNl0sIFs0LCA1LCAyN10sIFs0LCA2LCAyOF0sIFs0LCA3LCAyOV0sIFs0LCA4LCAzMF0sIFs0LCA5LCAzMV0sIFs0LCAxMCwgMzJdLCBbNCwgMTEsIDMzXSxcblx0XHRcdFx0WzUsIDAsIDM0XSwgWzUsIDEsIDM1XVxuXHRcdFx0XVxuXHRcdH0pKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoX2FjdHVhbC5jb250YWluc1JUTCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM2ODg1OiBTcGxpdHMgbGFyZ2UgdG9rZW5zJywgKCkgPT4ge1xuXHRcdC8vICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgMSAgICAgICAgIDEgICAgICAgICAxXG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAxICAgICAgICAgMiAgICAgICAgIDMgICAgICAgICA0ICAgICAgICAgNSAgICAgICAgIDYgICAgICAgICA3ICAgICAgICAgOCAgICAgICAgIDkgICAgICAgICAwICAgICAgICAgMSAgICAgICAgIDJcblx0XHQvLyAgICAgICAgICAgICAgIDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzRcblx0XHRjb25zdCBfbGluZVRleHQgPSAnVGhpcyBpcyBqdXN0IGEgbG9uZyBsaW5lIHRoYXQgY29udGFpbnMgdmVyeSBpbnRlcmVzdGluZyB0ZXh0LiBUaGlzIGlzIGp1c3QgYSBsb25nIGxpbmUgdGhhdCBjb250YWlucyB2ZXJ5IGludGVyZXN0aW5nIHRleHQuJztcblxuXHRcdGZ1bmN0aW9uIGFzc2VydFNwbGl0c1Rva2VucyhtZXNzYWdlOiBzdHJpbmcsIGxpbmVUZXh0OiBzdHJpbmcsIGV4cGVjdGVkT3V0cHV0OiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdFx0Y29uc3QgbGluZVBhcnRzID0gY3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQobGluZVRleHQubGVuZ3RoLCAxKV0pO1xuXHRcdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdDAsXG5cdFx0XHRcdGxpbmVQYXJ0cyxcblx0XHRcdFx0W10sXG5cdFx0XHRcdDQsXG5cdFx0XHRcdDAsXG5cdFx0XHRcdDEwLFxuXHRcdFx0XHQxMCxcblx0XHRcdFx0MTAsXG5cdFx0XHRcdC0xLFxuXHRcdFx0XHQnbm9uZScsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLmh0bWwsICc8c3Bhbj4nICsgZXhwZWN0ZWRPdXRwdXQuam9pbignJykgKyAnPC9zcGFuPicsIG1lc3NhZ2UpO1xuXHRcdH1cblxuXHRcdC8vIEEgdG9rZW4gd2l0aCA0OSBjaGFyc1xuXHRcdHtcblx0XHRcdGFzc2VydFNwbGl0c1Rva2Vucyhcblx0XHRcdFx0JzQ5IGNoYXJzJyxcblx0XHRcdFx0X2xpbmVUZXh0LnN1YnN0cigwLCA0OSksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+VGhpc1xcdTAwYTBpc1xcdTAwYTBqdXN0XFx1MDBhMGFcXHUwMGEwbG9uZ1xcdTAwYTBsaW5lXFx1MDBhMHRoYXRcXHUwMGEwY29udGFpbnNcXHUwMGEwdmVyeVxcdTAwYTBpbnRlcjwvc3Bhbj4nLFxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdC8vIEEgdG9rZW4gd2l0aCA1MCBjaGFyc1xuXHRcdHtcblx0XHRcdGFzc2VydFNwbGl0c1Rva2Vucyhcblx0XHRcdFx0JzUwIGNoYXJzJyxcblx0XHRcdFx0X2xpbmVUZXh0LnN1YnN0cigwLCA1MCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+VGhpc1xcdTAwYTBpc1xcdTAwYTBqdXN0XFx1MDBhMGFcXHUwMGEwbG9uZ1xcdTAwYTBsaW5lXFx1MDBhMHRoYXRcXHUwMGEwY29udGFpbnNcXHUwMGEwdmVyeVxcdTAwYTBpbnRlcmU8L3NwYW4+Jyxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvLyBBIHRva2VuIHdpdGggNTEgY2hhcnNcblx0XHR7XG5cdFx0XHRhc3NlcnRTcGxpdHNUb2tlbnMoXG5cdFx0XHRcdCc1MSBjaGFycycsXG5cdFx0XHRcdF9saW5lVGV4dC5zdWJzdHIoMCwgNTEpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPlRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW5zXFx1MDBhMHZlcnlcXHUwMGEwaW50ZXJlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPnM8L3NwYW4+Jyxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvLyBBIHRva2VuIHdpdGggOTkgY2hhcnNcblx0XHR7XG5cdFx0XHRhc3NlcnRTcGxpdHNUb2tlbnMoXG5cdFx0XHRcdCc5OSBjaGFycycsXG5cdFx0XHRcdF9saW5lVGV4dC5zdWJzdHIoMCwgOTkpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPlRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW5zXFx1MDBhMHZlcnlcXHUwMGEwaW50ZXJlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPnN0aW5nXFx1MDBhMHRleHQuXFx1MDBhMFRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW48L3NwYW4+Jyxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9XG5cblx0XHQvLyBBIHRva2VuIHdpdGggMTAwIGNoYXJzXG5cdFx0e1xuXHRcdFx0YXNzZXJ0U3BsaXRzVG9rZW5zKFxuXHRcdFx0XHQnMTAwIGNoYXJzJyxcblx0XHRcdFx0X2xpbmVUZXh0LnN1YnN0cigwLCAxMDApLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPlRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW5zXFx1MDBhMHZlcnlcXHUwMGEwaW50ZXJlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPnN0aW5nXFx1MDBhMHRleHQuXFx1MDBhMFRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW5zPC9zcGFuPicsXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fVxuXG5cdFx0Ly8gQSB0b2tlbiB3aXRoIDEwMSBjaGFyc1xuXHRcdHtcblx0XHRcdGFzc2VydFNwbGl0c1Rva2Vucyhcblx0XHRcdFx0JzEwMSBjaGFycycsXG5cdFx0XHRcdF9saW5lVGV4dC5zdWJzdHIoMCwgMTAxKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5UaGlzXFx1MDBhMGlzXFx1MDBhMGp1c3RcXHUwMGEwYVxcdTAwYTBsb25nXFx1MDBhMGxpbmVcXHUwMGEwdGhhdFxcdTAwYTBjb250YWluc1xcdTAwYTB2ZXJ5XFx1MDBhMGludGVyZTwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5zdGluZ1xcdTAwYTB0ZXh0LlxcdTAwYTBUaGlzXFx1MDBhMGlzXFx1MDBhMGp1c3RcXHUwMGEwYVxcdTAwYTBsb25nXFx1MDBhMGxpbmVcXHUwMGEwdGhhdFxcdTAwYTBjb250YWluczwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjE0NzY6IERvZXMgbm90IHNwbGl0IGxhcmdlIHRva2VucyB3aGVuIGxpZ2F0dXJlcyBhcmUgb24nLCAoKSA9PiB7XG5cdFx0Ly8gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAxICAgICAgICAgMSAgICAgICAgIDFcblx0XHQvLyAgICAgICAgICAgICAgICAgICAgICAgIDEgICAgICAgICAyICAgICAgICAgMyAgICAgICAgIDQgICAgICAgICA1ICAgICAgICAgNiAgICAgICAgIDcgICAgICAgICA4ICAgICAgICAgOSAgICAgICAgIDAgICAgICAgICAxICAgICAgICAgMlxuXHRcdC8vICAgICAgICAgICAgICAgMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTIzNFxuXHRcdGNvbnN0IF9saW5lVGV4dCA9ICdUaGlzIGlzIGp1c3QgYSBsb25nIGxpbmUgdGhhdCBjb250YWlucyB2ZXJ5IGludGVyZXN0aW5nIHRleHQuIFRoaXMgaXMganVzdCBhIGxvbmcgbGluZSB0aGF0IGNvbnRhaW5zIHZlcnkgaW50ZXJlc3RpbmcgdGV4dC4nO1xuXG5cdFx0ZnVuY3Rpb24gYXNzZXJ0U3BsaXRzVG9rZW5zKG1lc3NhZ2U6IHN0cmluZywgbGluZVRleHQ6IHN0cmluZywgZXhwZWN0ZWRPdXRwdXQ6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydChsaW5lVGV4dC5sZW5ndGgsIDEpXSk7XG5cdFx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0bGluZVRleHQsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0MCxcblx0XHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0XHRbXSxcblx0XHRcdFx0NCxcblx0XHRcdFx0MCxcblx0XHRcdFx0MTAsXG5cdFx0XHRcdDEwLFxuXHRcdFx0XHQxMCxcblx0XHRcdFx0LTEsXG5cdFx0XHRcdCdub25lJyxcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdHRydWUsXG5cdFx0XHRcdG51bGxcblx0XHRcdCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5odG1sLCAnPHNwYW4+JyArIGV4cGVjdGVkT3V0cHV0LmpvaW4oJycpICsgJzwvc3Bhbj4nLCBtZXNzYWdlKTtcblx0XHR9XG5cblx0XHQvLyBBIHRva2VuIHdpdGggMTAxIGNoYXJzXG5cdFx0e1xuXHRcdFx0YXNzZXJ0U3BsaXRzVG9rZW5zKFxuXHRcdFx0XHQnMTAxIGNoYXJzJyxcblx0XHRcdFx0X2xpbmVUZXh0LnN1YnN0cigwLCAxMDEpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPlRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMGNvbnRhaW5zXFx1MDBhMHZlcnlcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPmludGVyZXN0aW5nXFx1MDBhMHRleHQuXFx1MDBhMFRoaXNcXHUwMGEwaXNcXHUwMGEwanVzdFxcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB0aGF0XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5jb250YWluc1xcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMDYyNDogVW5hbGlnbmVkIHN1cnJvZ2F0ZSBwYWlycyBhcmUgY29ycnVwdGVkIGF0IG11bHRpcGxlcyBvZiA1MCBjb2x1bW5zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gJ2FcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjdcdUQ4NDJcdURGQjcnO1xuXHRcdGNvbnN0IGxpbmVQYXJ0cyA9IGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KGxpbmVUZXh0Lmxlbmd0aCwgMSldKTtcblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZVRleHQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKS5odG1sLCBbXG5cdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+YVx1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCN1x1RDg0Mlx1REZCNzwvc3Bhbj4nLFxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjNjg4NTogRG9lcyBub3Qgc3BsaXQgbGFyZ2UgdG9rZW5zIGluIFJUTCB0ZXh0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGxpbmVUZXh0ID0gJ1x1MDVEMFx1MDVFQSBcdTA1RDJcdTA1RThcdTA1REVcdTA1RTBcdTA1RDlcdTA1RUEgXHUwNUQxXHUwNUQ0XHUwNUVBXHUwNUQ5XHUwNUQ5XHUwNUQ3XHUwNUUxXHUwNUQ1XHUwNUVBIFx1MDVFOVx1MDVERVx1MDVENSwgXHUwNUU5XHUwNUUwXHUwNUVBXHUwNUQ5IFx1MDVENFx1MDVERVx1MDVFOVx1MDVFNFx1MDVEOCBcdTA1RDBcdTA1REMgXHUwNUQ3XHUwNUU0XHUwNUU5LCBcdTA1RDBcdTA1REQgXHUwNURCXHUwNUVBXHUwNUQxIFx1MDVEMFx1MDVEN1x1MDVFOFx1MDVEOVx1MDVERCBcdTA1RDVcdTA1RENcdTA1RDdcdTA1RDFcdTA1RTguIFx1MDVFOVx1MDVEQyBcdTA1RDRcdTA1RUFcdTA1RDVcdTA1REJcdTA1REYgXHUwNUQwXHUwNUQ1XHUwNUQzXHUwNUQ1XHUwNUVBIFx1MDVEMVx1MDVENVx1MDVEOVx1MDVFN1x1MDVEOVx1MDVFNFx1MDVEM1x1MDVEOVx1MDVENCBcdTA1REJcdTA1RENcdTA1REMsIFx1MDVFOVx1MDVEQyBcdTA1RTJcdTA1RDZcdTA1RThcdTA1RDQgXHUwNURCXHUwNUQ5XHUwNURFXHUwNUQ5XHUwNUQ0IFx1MDVENFx1MDVEOVx1MDVEMC4gXHUwNUUyXHUwNURDIFx1MDVFMlx1MDVERVx1MDVENVx1MDVEMyBcdTA1RDlcdTA1RDVcdTA1RTZcdTA1RThcdTA1RDlcdTA1REQgXHUwNURFXHUwNUQ5XHUwNUVBXHUwNUQ1XHUwNURDXHUwNUQ1XHUwNUQyXHUwNUQ5XHUwNUQ0IFx1MDVFMVx1MDVEM1x1MDVFOCwgXHUwNUQwXHUwNUREIFx1MDVFOVx1MDVEQlx1MDVEQyBcdTA1RTlcdTA1RUFcdTA1RTRcdTA1RDUgXHUwNURDXHUwNUUyXHUwNUQxXHUwNUU4XHUwNUQ5XHUwNUVBIFx1MDVFOVx1MDVEOVx1MDVFMFx1MDVENVx1MDVEOVx1MDVEOVx1MDVERCwgXHUwNUQwXHUwNUREIFx1MDVFOVx1MDVEMFx1MDVEQ1x1MDVENVx1MDVFQSBcdTA1RDBcdTA1RTBcdTA1RDJcdTA1RENcdTA1RDlcdTA1RUEgXHUwNUUyXHUwNUQ2XHUwNUQ0LiBcdTA1RTlcdTA1REVcdTA1RDVcdTA1RUEgXHUwNUQxXHUwNUU3XHUwNURDXHUwNUQ1XHUwNUVBIFx1MDVERVx1MDVENCBcdTA1RTFcdTA1RDNcdTA1RTguJztcblx0XHRjb25zdCBsaW5lUGFydHMgPSBjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydChsaW5lVGV4dC5sZW5ndGgsIDEpXSk7XG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVUZXh0LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQwLFxuXHRcdFx0bGluZVBhcnRzLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLmh0bWwsIFtcblx0XHRcdCc8c3BhbiBkaXI9XCJsdHJcIj4nLFxuXHRcdFx0JzxzcGFuIHN0eWxlPVwidW5pY29kZS1iaWRpOmlzb2xhdGVcIiBjbGFzcz1cIm10azFcIj5cdTA1RDBcdTA1RUFcXHUwMGEwXHUwNUQyXHUwNUU4XHUwNURFXHUwNUUwXHUwNUQ5XHUwNUVBXFx1MDBhMFx1MDVEMVx1MDVENFx1MDVFQVx1MDVEOVx1MDVEOVx1MDVEN1x1MDVFMVx1MDVENVx1MDVFQVxcdTAwYTBcdTA1RTlcdTA1REVcdTA1RDUsXFx1MDBhMFx1MDVFOVx1MDVFMFx1MDVFQVx1MDVEOVxcdTAwYTBcdTA1RDRcdTA1REVcdTA1RTlcdTA1RTRcdTA1RDhcXHUwMGEwXHUwNUQwXHUwNURDXFx1MDBhMFx1MDVEN1x1MDVFNFx1MDVFOSxcXHUwMGEwXHUwNUQwXHUwNUREXFx1MDBhMFx1MDVEQlx1MDVFQVx1MDVEMVxcdTAwYTBcdTA1RDBcdTA1RDdcdTA1RThcdTA1RDlcdTA1RERcXHUwMGEwXHUwNUQ1XHUwNURDXHUwNUQ3XHUwNUQxXHUwNUU4LlxcdTAwYTBcdTA1RTlcdTA1RENcXHUwMGEwXHUwNUQ0XHUwNUVBXHUwNUQ1XHUwNURCXHUwNURGXFx1MDBhMFx1MDVEMFx1MDVENVx1MDVEM1x1MDVENVx1MDVFQVxcdTAwYTBcdTA1RDFcdTA1RDVcdTA1RDlcdTA1RTdcdTA1RDlcdTA1RTRcdTA1RDNcdTA1RDlcdTA1RDRcXHUwMGEwXHUwNURCXHUwNURDXHUwNURDLFxcdTAwYTBcdTA1RTlcdTA1RENcXHUwMGEwXHUwNUUyXHUwNUQ2XHUwNUU4XHUwNUQ0XFx1MDBhMFx1MDVEQlx1MDVEOVx1MDVERVx1MDVEOVx1MDVENFxcdTAwYTBcdTA1RDRcdTA1RDlcdTA1RDAuXFx1MDBhMFx1MDVFMlx1MDVEQ1xcdTAwYTBcdTA1RTJcdTA1REVcdTA1RDVcdTA1RDNcXHUwMGEwXHUwNUQ5XHUwNUQ1XHUwNUU2XHUwNUU4XHUwNUQ5XHUwNUREXFx1MDBhMFx1MDVERVx1MDVEOVx1MDVFQVx1MDVENVx1MDVEQ1x1MDVENVx1MDVEMlx1MDVEOVx1MDVENFxcdTAwYTBcdTA1RTFcdTA1RDNcdTA1RTgsXFx1MDBhMFx1MDVEMFx1MDVERFxcdTAwYTBcdTA1RTlcdTA1REJcdTA1RENcXHUwMGEwXHUwNUU5XHUwNUVBXHUwNUU0XHUwNUQ1XFx1MDBhMFx1MDVEQ1x1MDVFMlx1MDVEMVx1MDVFOFx1MDVEOVx1MDVFQVxcdTAwYTBcdTA1RTlcdTA1RDlcdTA1RTBcdTA1RDVcdTA1RDlcdTA1RDlcdTA1REQsXFx1MDBhMFx1MDVEMFx1MDVERFxcdTAwYTBcdTA1RTlcdTA1RDBcdTA1RENcdTA1RDVcdTA1RUFcXHUwMGEwXHUwNUQwXHUwNUUwXHUwNUQyXHUwNURDXHUwNUQ5XHUwNUVBXFx1MDBhMFx1MDVFMlx1MDVENlx1MDVENC5cXHUwMGEwXHUwNUU5XHUwNURFXHUwNUQ1XHUwNUVBXFx1MDBhMFx1MDVEMVx1MDVFN1x1MDVEQ1x1MDVENVx1MDVFQVxcdTAwYTBcdTA1REVcdTA1RDRcXHUwMGEwXHUwNUUxXHUwNUQzXHUwNUU4Ljwvc3Bhbj4nLFxuXHRcdFx0Jzwvc3Bhbj4nXG5cdFx0XS5qb2luKCcnKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb250YWluc1JUTCwgdHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5NTY4NTogVXNlcyB1bmljb2RlIHJlcGxhY2VtZW50IGNoYXJhY3RlciBmb3IgUGFyYWdyYXBoIFNlcGFyYXRvcicsICgpID0+IHtcblx0XHRjb25zdCBsaW5lVGV4dCA9ICd2YXIgZnRleHQgPSBbXFx1MjAyOVwiVW5kXCIsIFwiZGFublwiLCBcImVpbmVzXCJdOyc7XG5cdFx0Y29uc3QgbGluZVBhcnRzID0gY3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQobGluZVRleHQubGVuZ3RoLCAxKV0pO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRsaW5lVGV4dCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRsaW5lUGFydHMsXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwgKHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPnZhclxcdTAwYTBmdGV4dFxcdTAwYTA9XFx1MDBhMFtcXHVGRkZEXCJVbmRcIixcXHUwMGEwXCJkYW5uXCIsXFx1MDBhMFwiZWluZXNcIl07PC9zcGFuPidcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLCBbMCwgMiwgMl0sIFswLCAzLCAzXSwgWzAsIDQsIDRdLCBbMCwgNSwgNV0sIFswLCA2LCA2XSwgWzAsIDcsIDddLFxuXHRcdFx0XHRbMCwgOCwgOF0sIFswLCA5LCA5XSwgWzAsIDEwLCAxMF0sIFswLCAxMSwgMTFdLCBbMCwgMTIsIDEyXSwgWzAsIDEzLCAxM10sIFswLCAxNCwgMTRdLFxuXHRcdFx0XHRbMCwgMTUsIDE1XSwgWzAsIDE2LCAxNl0sIFswLCAxNywgMTddLCBbMCwgMTgsIDE4XSwgWzAsIDE5LCAxOV0sIFswLCAyMCwgMjBdLCBbMCwgMjEsIDIxXSxcblx0XHRcdFx0WzAsIDIyLCAyMl0sIFswLCAyMywgMjNdLCBbMCwgMjQsIDI0XSwgWzAsIDI1LCAyNV0sIFswLCAyNiwgMjZdLCBbMCwgMjcsIDI3XSwgWzAsIDI4LCAyOF0sXG5cdFx0XHRcdFswLCAyOSwgMjldLCBbMCwgMzAsIDMwXSwgWzAsIDMxLCAzMV0sIFswLCAzMiwgMzJdLCBbMCwgMzMsIDMzXSwgWzAsIDM0LCAzNF0sIFswLCAzNSwgMzVdLFxuXHRcdFx0XHRbMCwgMzYsIDM2XSwgWzAsIDM3LCAzN10sIFswLCAzOCwgMzhdXG5cdFx0XHRdXG5cdFx0fSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTk2NzM6IE1vbm9rYWkgVGhlbWUgYmFkLWhpZ2hsaWdodGluZyBpbiBsaW5lIHdyYXAnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZVRleHQgPSAnICAgIE1vbmdvQ2FsbGJhY2s8c3RyaW5nPik6IHZvaWQgeyc7XG5cdFx0Y29uc3QgbGluZVBhcnRzID0gY3JlYXRlVmlld0xpbmVUb2tlbnMoW1xuXHRcdFx0Y3JlYXRlUGFydCgxNywgMSksXG5cdFx0XHRjcmVhdGVQYXJ0KDE4LCAyKSxcblx0XHRcdGNyZWF0ZVBhcnQoMjQsIDMpLFxuXHRcdFx0Y3JlYXRlUGFydCgyNiwgNCksXG5cdFx0XHRjcmVhdGVQYXJ0KDI3LCA1KSxcblx0XHRcdGNyZWF0ZVBhcnQoMjgsIDYpLFxuXHRcdFx0Y3JlYXRlUGFydCgzMiwgNyksXG5cdFx0XHRjcmVhdGVQYXJ0KDM0LCA4KSxcblx0XHRdKTtcblx0XHRjb25zdCBfYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZVRleHQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDQsXG5cdFx0XHRsaW5lUGFydHMsXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChfYWN0dWFsKSwgKHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiXCI+XFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+TW9uZ29DYWxsYmFjazwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+Jmx0Ozwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+c3RyaW5nPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azRcIj4mZ3Q7KTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs1XCI+Ojwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs2XCI+XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs3XCI+dm9pZDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs4XCI+XFx1MDBhMHs8L3NwYW4+J1xuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLFxuXHRcdFx0XHRbMSwgMCwgNF0sIFsxLCAxLCA1XSwgWzEsIDIsIDZdLCBbMSwgMywgN10sIFsxLCA0LCA4XSwgWzEsIDUsIDldLCBbMSwgNiwgMTBdLCBbMSwgNywgMTFdLCBbMSwgOCwgMTJdLCBbMSwgOSwgMTNdLCBbMSwgMTAsIDE0XSwgWzEsIDExLCAxNV0sIFsxLCAxMiwgMTZdLFxuXHRcdFx0XHRbMiwgMCwgMTddLFxuXHRcdFx0XHRbMywgMCwgMThdLCBbMywgMSwgMTldLCBbMywgMiwgMjBdLCBbMywgMywgMjFdLCBbMywgNCwgMjJdLCBbMywgNSwgMjNdLFxuXHRcdFx0XHRbNCwgMCwgMjRdLCBbNCwgMSwgMjVdLFxuXHRcdFx0XHRbNSwgMCwgMjZdLFxuXHRcdFx0XHRbNiwgMCwgMjddLFxuXHRcdFx0XHRbNywgMCwgMjhdLCBbNywgMSwgMjldLCBbNywgMiwgMzBdLCBbNywgMywgMzFdLFxuXHRcdFx0XHRbOCwgMCwgMzJdLCBbOCwgMSwgMzNdLCBbOCwgMiwgMzRdXG5cdFx0XHRdXG5cdFx0fSkpO1xuXHR9KTtcbn0pO1xuXG50eXBlIENoYXJhY3Rlck1hcHBpbmdJbmZvID0gW251bWJlciwgW251bWJlciwgbnVtYmVyXV07XG5cbmZ1bmN0aW9uIGFzc2VydENoYXJhY3Rlck1hcHBpbmczKGFjdHVhbDogQ2hhcmFjdGVyTWFwcGluZywgZXhwZWN0ZWRJbmZvOiBDaGFyYWN0ZXJNYXBwaW5nSW5mb1tdKTogdm9pZCB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWRJbmZvLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgW2hvcml6b250YWxPZmZzZXQsIFtwYXJ0SW5kZXgsIGNoYXJJbmRleF1dID0gZXhwZWN0ZWRJbmZvW2ldO1xuXG5cdFx0Y29uc3QgYWN0dWFsRG9tUG9zaXRpb24gPSBhY3R1YWwuZ2V0RG9tUG9zaXRpb24oaSArIDEpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsRG9tUG9zaXRpb24sIG5ldyBEb21Qb3NpdGlvbihwYXJ0SW5kZXgsIGNoYXJJbmRleCksIGBnZXREb21Qb3NpdGlvbigke2kgKyAxfSlgKTtcblxuXHRcdGxldCBwYXJ0TGVuZ3RoID0gY2hhckluZGV4ICsgMTtcblx0XHRmb3IgKGxldCBqID0gaSArIDE7IGogPCBleHBlY3RlZEluZm8ubGVuZ3RoOyBqKyspIHtcblx0XHRcdGNvbnN0IFssIFtuZXh0UGFydEluZGV4LCBuZXh0Q2hhckluZGV4XV0gPSBleHBlY3RlZEluZm9bal07XG5cdFx0XHRpZiAobmV4dFBhcnRJbmRleCA9PT0gcGFydEluZGV4KSB7XG5cdFx0XHRcdHBhcnRMZW5ndGggPSBuZXh0Q2hhckluZGV4ICsgMTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGFjdHVhbENvbHVtbiA9IGFjdHVhbC5nZXRDb2x1bW4obmV3IERvbVBvc2l0aW9uKHBhcnRJbmRleCwgY2hhckluZGV4KSwgcGFydExlbmd0aCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbENvbHVtbiwgaSArIDEsIGBhY3R1YWwuZ2V0Q29sdW1uKCR7cGFydEluZGV4fSwgJHtjaGFySW5kZXh9KWApO1xuXG5cdFx0Y29uc3QgYWN0dWFsSG9yaXpvbnRhbE9mZnNldCA9IGFjdHVhbC5nZXRIb3Jpem9udGFsT2Zmc2V0KGkgKyAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsSG9yaXpvbnRhbE9mZnNldCwgaG9yaXpvbnRhbE9mZnNldCwgYGFjdHVhbC5nZXRIb3Jpem9udGFsT2Zmc2V0KCR7aSArIDF9KWApO1xuXHR9XG5cblx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5sZW5ndGgsIGV4cGVjdGVkSW5mby5sZW5ndGgsIGBsZW5ndGggbWlzbWF0Y2hgKTtcbn1cblxuc3VpdGUoJ3ZpZXdMaW5lUmVuZGVyZXIucmVuZGVyTGluZSAyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGZ1bmN0aW9uIHRlc3RDcmVhdGVMaW5lUGFydHMoZm9udElzTW9ub3NwYWNlOiBib29sZWFuLCBsaW5lQ29udGVudDogc3RyaW5nLCB0b2tlbnM6IFRlc3RMaW5lVG9rZW5bXSwgZmF1eEluZGVudExlbmd0aDogbnVtYmVyLCByZW5kZXJXaGl0ZXNwYWNlOiAnbm9uZScgfCAnYm91bmRhcnknIHwgJ3NlbGVjdGlvbicgfCAndHJhaWxpbmcnIHwgJ2FsbCcsIHNlbGVjdGlvbnM6IExpbmVSYW5nZVtdIHwgbnVsbCkge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmb250SXNNb25vc3BhY2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZUNvbnRlbnQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhdXhJbmRlbnRMZW5ndGgsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2Vucyh0b2tlbnMpLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdC0xLFxuXHRcdFx0cmVuZGVyV2hpdGVzcGFjZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRzZWxlY3Rpb25zXG5cdFx0KSk7XG5cdFx0cmV0dXJuIGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCk7XG5cdH1cblxuXHR0ZXN0KCdpc3N1ZSAjMTg2MTY6IElubGluZSBkZWNvcmF0aW9ucyBlbmRpbmcgYXQgdGhlIHRleHQgbGVuZ3RoIGFyZSBubyBsb25nZXIgcmVuZGVyZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSAnaHR0cHM6Ly9taWNyb3NvZnQuY29tJztcblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZUNvbnRlbnQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydCgyMSwgMyldKSxcblx0XHRcdFtuZXcgTGluZURlY29yYXRpb24oMSwgMjIsICdsaW5rJywgSW5saW5lRGVjb3JhdGlvblR5cGUuUmVndWxhcildLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQtMSxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksICh7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azMgbGlua1wiPmh0dHBzOi8vbWljcm9zb2Z0LmNvbTwvc3Bhbj4nXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSxcblx0XHRcdFx0WzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl0sIFswLCAxMywgMTNdLCBbMCwgMTQsIDE0XSxcblx0XHRcdFx0WzAsIDE1LCAxNV0sIFswLCAxNiwgMTZdLCBbMCwgMTcsIDE3XSwgWzAsIDE4LCAxOF0sIFswLCAxOSwgMTldLCBbMCwgMjAsIDIwXSwgWzAsIDIxLCAyMV1cblx0XHRcdF1cblx0XHR9KSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxOTIwNzogTGluayBpbiBNb25va2FpIGlzIG5vdCByZW5kZXJlZCBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSAnXFwnbGV0IHVybCA9IGBodHRwOi8vKioqL19hcGkvd2ViL2xpc3RzL0dldEJ5VGl0bGUoXFxcXFxcJ1RlYW1idWlsZGluZ2FhbnZyYWdlblxcXFxcXCcpL2l0ZW1zYDtcXCcnO1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHR0cnVlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVDb250ZW50LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW1xuXHRcdFx0XHRjcmVhdGVQYXJ0KDQ5LCA2KSxcblx0XHRcdFx0Y3JlYXRlUGFydCg1MSwgNCksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoNzIsIDYpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDc0LCA0KSxcblx0XHRcdFx0Y3JlYXRlUGFydCg4NCwgNiksXG5cdFx0XHRdKSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDEzLCA1MSwgJ2RldGVjdGVkLWxpbmsnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKVxuXHRcdFx0XSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCAoe1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs2XCI+XFwnbGV0XFx1MDBhMHVybFxcdTAwYTA9XFx1MDBhMGA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrNiBkZXRlY3RlZC1saW5rXCI+aHR0cDovLyoqKi9fYXBpL3dlYi9saXN0cy9HZXRCeVRpdGxlKDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs0IGRldGVjdGVkLWxpbmtcIj5cXFxcPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azRcIj5cXCc8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrNlwiPlRlYW1idWlsZGluZ2FhbnZyYWdlbjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs0XCI+XFxcXFxcJzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGs2XCI+KS9pdGVtc2A7XFwnPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSwgWzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSxcblx0XHRcdFx0WzEsIDAsIDEyXSwgWzEsIDEsIDEzXSwgWzEsIDIsIDE0XSwgWzEsIDMsIDE1XSwgWzEsIDQsIDE2XSwgWzEsIDUsIDE3XSwgWzEsIDYsIDE4XSwgWzEsIDcsIDE5XSwgWzEsIDgsIDIwXSwgWzEsIDksIDIxXSwgWzEsIDEwLCAyMl0sIFsxLCAxMSwgMjNdLCBbMSwgMTIsIDI0XSwgWzEsIDEzLCAyNV0sIFsxLCAxNCwgMjZdLCBbMSwgMTUsIDI3XSwgWzEsIDE2LCAyOF0sIFsxLCAxNywgMjldLCBbMSwgMTgsIDMwXSwgWzEsIDE5LCAzMV0sIFsxLCAyMCwgMzJdLCBbMSwgMjEsIDMzXSwgWzEsIDIyLCAzNF0sIFsxLCAyMywgMzVdLCBbMSwgMjQsIDM2XSwgWzEsIDI1LCAzN10sIFsxLCAyNiwgMzhdLCBbMSwgMjcsIDM5XSwgWzEsIDI4LCA0MF0sIFsxLCAyOSwgNDFdLCBbMSwgMzAsIDQyXSwgWzEsIDMxLCA0M10sIFsxLCAzMiwgNDRdLCBbMSwgMzMsIDQ1XSwgWzEsIDM0LCA0Nl0sIFsxLCAzNSwgNDddLCBbMSwgMzYsIDQ4XSxcblx0XHRcdFx0WzIsIDAsIDQ5XSxcblx0XHRcdFx0WzMsIDAsIDUwXSxcblx0XHRcdFx0WzQsIDAsIDUxXSwgWzQsIDEsIDUyXSwgWzQsIDIsIDUzXSwgWzQsIDMsIDU0XSwgWzQsIDQsIDU1XSwgWzQsIDUsIDU2XSwgWzQsIDYsIDU3XSwgWzQsIDcsIDU4XSwgWzQsIDgsIDU5XSwgWzQsIDksIDYwXSwgWzQsIDEwLCA2MV0sIFs0LCAxMSwgNjJdLCBbNCwgMTIsIDYzXSwgWzQsIDEzLCA2NF0sIFs0LCAxNCwgNjVdLCBbNCwgMTUsIDY2XSwgWzQsIDE2LCA2N10sIFs0LCAxNywgNjhdLCBbNCwgMTgsIDY5XSwgWzQsIDE5LCA3MF0sIFs0LCAyMCwgNzFdLFxuXHRcdFx0XHRbNSwgMCwgNzJdLCBbNSwgMSwgNzNdLFxuXHRcdFx0XHRbNiwgMCwgNzRdLCBbNiwgMSwgNzVdLCBbNiwgMiwgNzZdLCBbNiwgMywgNzddLCBbNiwgNCwgNzhdLCBbNiwgNSwgNzldLCBbNiwgNiwgODBdLCBbNiwgNywgODFdLCBbNiwgOCwgODJdLCBbNiwgOSwgODNdLCBbNiwgMTAsIDg0XVxuXHRcdFx0XVxuXHRcdH0pKTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHNpbXBsZScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCdIZWxsbyB3b3JsZCEnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgxMiwgMSlcblx0XHRcdFx0XSxcblx0XHRcdFx0MCxcblx0XHRcdFx0J25vbmUnLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPkhlbGxvXFx1MDBhMHdvcmxkITwvc3Bhbj4nXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSwgWzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyBzaW1wbGUgdHdvIHRva2VucycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCdIZWxsbyB3b3JsZCEnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDEyLCAyKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnbm9uZScsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+SGVsbG9cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPndvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLCBbMCwgNCwgNF0sIFswLCA1LCA1XSxcblx0XHRcdFx0XHRbMSwgMCwgNl0sIFsxLCAxLCA3XSwgWzEsIDIsIDhdLCBbMSwgMywgOV0sIFsxLCA0LCAxMF0sIFsxLCA1LCAxMV0sIFsxLCA2LCAxMl1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSAtIDQgbGVhZGluZyBzcGFjZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHRlc3RDcmVhdGVMaW5lUGFydHMoXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHQnICAgIEhlbGxvIHdvcmxkISAgICAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg0LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDYsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMjAsIDMpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDAsXG5cdFx0XHRcdCdib3VuZGFyeScsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+SGU8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+bGxvXFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMiwgMV0sIFswLCA0LCAyXSwgWzAsIDYsIDNdLFxuXHRcdFx0XHRcdFsxLCAwLCA0XSwgWzEsIDEsIDVdLFxuXHRcdFx0XHRcdFsyLCAwLCA2XSwgWzIsIDEsIDddLCBbMiwgMiwgOF0sIFsyLCAzLCA5XSwgWzIsIDQsIDEwXSwgWzIsIDUsIDExXSwgWzIsIDYsIDEyXSwgWzIsIDcsIDEzXSwgWzIsIDgsIDE0XSwgWzIsIDksIDE1XSxcblx0XHRcdFx0XHRbMywgMCwgMTZdLCBbMywgMiwgMTddLCBbMywgNCwgMThdLCBbMywgNiwgMTldLCBbMywgOCwgMjBdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgLSA4IGxlYWRpbmcgc3BhY2VzJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0JyAgICAgICAgSGVsbG8gd29ybGQhICAgICAgICAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg4LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDEwLCAyKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDI4LCAzKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnYm91bmRhcnknLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPkhlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmxsb1xcdTAwYTB3b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSwgWzAsIDIsIDFdLCBbMCwgNCwgMl0sIFswLCA2LCAzXSxcblx0XHRcdFx0XHRbMSwgMCwgNF0sIFsxLCAyLCA1XSwgWzEsIDQsIDZdLCBbMSwgNiwgN10sXG5cdFx0XHRcdFx0WzIsIDAsIDhdLCBbMiwgMSwgOV0sXG5cdFx0XHRcdFx0WzMsIDAsIDEwXSwgWzMsIDEsIDExXSwgWzMsIDIsIDEyXSwgWzMsIDMsIDEzXSwgWzMsIDQsIDE0XSwgWzMsIDUsIDE1XSwgWzMsIDYsIDE2XSwgWzMsIDcsIDE3XSwgWzMsIDgsIDE4XSwgWzMsIDksIDE5XSxcblx0XHRcdFx0XHRbNCwgMCwgMjBdLCBbNCwgMiwgMjFdLCBbNCwgNCwgMjJdLCBbNCwgNiwgMjNdLFxuXHRcdFx0XHRcdFs1LCAwLCAyNF0sIFs1LCAyLCAyNV0sIFs1LCA0LCAyNl0sIFs1LCA2LCAyN10sIFs1LCA4LCAyOF1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSAtIDIgbGVhZGluZyB0YWJzJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0J1xcdFxcdEhlbGxvIHdvcmxkIVxcdCcsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDIsIDEpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgxNSwgMylcblx0XHRcdFx0XSxcblx0XHRcdFx0MCxcblx0XHRcdFx0J2JvdW5kYXJ5Jyxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTIxOTJcXHUwMGEwXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+SGU8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+bGxvXFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sXG5cdFx0XHRcdFx0WzEsIDAsIDRdLFxuXHRcdFx0XHRcdFsyLCAwLCA4XSwgWzIsIDEsIDldLFxuXHRcdFx0XHRcdFszLCAwLCAxMF0sIFszLCAxLCAxMV0sIFszLCAyLCAxMl0sIFszLCAzLCAxM10sIFszLCA0LCAxNF0sIFszLCA1LCAxNV0sIFszLCA2LCAxNl0sIFszLCA3LCAxN10sIFszLCA4LCAxOF0sIFszLCA5LCAxOV0sXG5cdFx0XHRcdFx0WzQsIDAsIDIwXSwgWzQsIDQsIDI0XVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHJlbmRlciB3aGl0ZXNwYWNlIC0gbWl4ZWQgbGVhZGluZyBzcGFjZXMgYW5kIHRhYnMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHRlc3RDcmVhdGVMaW5lUGFydHMoXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHQnICBcXHRcXHQgIEhlbGxvIHdvcmxkISBcXHQgIFxcdCAgIFxcdCAgICAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDgsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMzEsIDMpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDAsXG5cdFx0XHRcdCdib3VuZGFyeScsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTIxOTJcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTIxOTJcXHUwMGEwXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoyMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj5IZTwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5sbG9cXHUwMGEwd29ybGQhPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MjBweFwiPlxcdTAwYjdcXHUyMDBjXFx1ZmZlYjwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MjE5MlxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1ZmZlYjwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMiwgMV0sIFswLCA0LCAyXSxcblx0XHRcdFx0XHRbMSwgMCwgNF0sXG5cdFx0XHRcdFx0WzIsIDAsIDhdLCBbMiwgMiwgOV0sXG5cdFx0XHRcdFx0WzMsIDAsIDEwXSwgWzMsIDEsIDExXSxcblx0XHRcdFx0XHRbNCwgMCwgMTJdLCBbNCwgMSwgMTNdLCBbNCwgMiwgMTRdLCBbNCwgMywgMTVdLCBbNCwgNCwgMTZdLCBbNCwgNSwgMTddLCBbNCwgNiwgMThdLCBbNCwgNywgMTldLCBbNCwgOCwgMjBdLCBbNCwgOSwgMjFdLFxuXHRcdFx0XHRcdFs1LCAwLCAyMl0sIFs1LCAyLCAyM10sXG5cdFx0XHRcdFx0WzYsIDAsIDI0XSwgWzYsIDIsIDI1XSwgWzYsIDQsIDI2XSxcblx0XHRcdFx0XHRbNywgMCwgMjhdLCBbNywgMiwgMjldLCBbNywgNCwgMzBdLCBbNywgNiwgMzFdLFxuXHRcdFx0XHRcdFs4LCAwLCAzMl0sIFs4LCAyLCAzM10sIFs4LCA0LCAzNF0sIFs4LCA2LCAzNV0sIFs4LCA4LCAzNl1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSBza2lwcyBmYXV4IGluZGVudCcsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCdcXHRcXHQgIEhlbGxvIHdvcmxkISBcXHQgIFxcdCAgIFxcdCAgICAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg0LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDYsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMjksIDMpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDIsXG5cdFx0XHRcdCdib3VuZGFyeScsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJcIj5cXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjIwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPkhlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmxsb1xcdTAwYTB3b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoyMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHVmZmViPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUyMTkyXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHVmZmViPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sIFswLCA0LCA0XSxcblx0XHRcdFx0XHRbMSwgMCwgOF0sIFsxLCAyLCA5XSxcblx0XHRcdFx0XHRbMiwgMCwgMTBdLCBbMiwgMSwgMTFdLFxuXHRcdFx0XHRcdFszLCAwLCAxMl0sIFszLCAxLCAxM10sIFszLCAyLCAxNF0sIFszLCAzLCAxNV0sIFszLCA0LCAxNl0sIFszLCA1LCAxN10sIFszLCA2LCAxOF0sIFszLCA3LCAxOV0sIFszLCA4LCAyMF0sIFszLCA5LCAyMV0sXG5cdFx0XHRcdFx0WzQsIDAsIDIyXSwgWzQsIDIsIDIzXSxcblx0XHRcdFx0XHRbNSwgMCwgMjRdLCBbNSwgMiwgMjVdLCBbNSwgNCwgMjZdLFxuXHRcdFx0XHRcdFs2LCAwLCAyOF0sIFs2LCAyLCAyOV0sIFs2LCA0LCAzMF0sIFs2LCA2LCAzMV0sXG5cdFx0XHRcdFx0WzcsIDAsIDMyXSwgWzcsIDIsIDMzXSwgWzcsIDQsIDM0XSwgWzcsIDYsIDM1XSwgWzcsIDgsIDM2XVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIGRvZXMgbm90IGVtaXQgd2lkdGggZm9yIG1vbm9zcGFjZSBmb250cycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0dHJ1ZSxcblx0XHRcdFx0J1xcdFxcdCAgSGVsbG8gd29ybGQhIFxcdCAgXFx0ICAgXFx0ICAgICcsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDQsIDEpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNiwgMiksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgyOSwgMylcblx0XHRcdFx0XSxcblx0XHRcdFx0Mixcblx0XHRcdFx0J2JvdW5kYXJ5Jyxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIlwiPlxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrd1wiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+SGU8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+bGxvXFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3dcIj5cXHUwMGI3XFx1MjAwY1xcdWZmZWJcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MjE5MlxcdTAwYTBcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHVmZmViXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSwgWzAsIDQsIDRdLFxuXHRcdFx0XHRcdFsxLCAwLCA4XSwgWzEsIDIsIDldLFxuXHRcdFx0XHRcdFsyLCAwLCAxMF0sIFsyLCAxLCAxMV0sXG5cdFx0XHRcdFx0WzMsIDAsIDEyXSwgWzMsIDEsIDEzXSwgWzMsIDIsIDE0XSwgWzMsIDMsIDE1XSwgWzMsIDQsIDE2XSwgWzMsIDUsIDE3XSwgWzMsIDYsIDE4XSwgWzMsIDcsIDE5XSwgWzMsIDgsIDIwXSwgWzMsIDksIDIxXSxcblx0XHRcdFx0XHRbNCwgMCwgMjJdLCBbNCwgMiwgMjNdLCBbNCwgMywgMjRdLCBbNCwgNSwgMjVdLCBbNCwgNywgMjZdLCBbNCwgOSwgMjhdLCBbNCwgMTEsIDI5XSwgWzQsIDEzLCAzMF0sIFs0LCAxNSwgMzFdLCBbNCwgMTYsIDMyXSwgWzQsIDE4LCAzM10sIFs0LCAyMCwgMzRdLCBbNCwgMjIsIDM1XSwgWzQsIDI0LCAzNl1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSBpbiBtaWRkbGUgYnV0IG5vdCBmb3Igb25lIHNwYWNlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0J2l0ICBpdCBpdCAgaXQnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDcsIDIpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMTMsIDMpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDAsXG5cdFx0XHRcdCdib3VuZGFyeScsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+aXQ8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoyMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5pdDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPml0PC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MjBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+aXQ8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLFxuXHRcdFx0XHRcdFsxLCAwLCAyXSwgWzEsIDIsIDNdLFxuXHRcdFx0XHRcdFsyLCAwLCA0XSwgWzIsIDEsIDVdLFxuXHRcdFx0XHRcdFszLCAwLCA2XSxcblx0XHRcdFx0XHRbNCwgMCwgN10sIFs0LCAxLCA4XSxcblx0XHRcdFx0XHRbNSwgMCwgOV0sIFs1LCAyLCAxMF0sXG5cdFx0XHRcdFx0WzYsIDAsIDExXSwgWzYsIDEsIDEyXSwgWzYsIDIsIDEzXVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHJlbmRlciB3aGl0ZXNwYWNlIGZvciBhbGwgaW4gbWlkZGxlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0JyBIZWxsbyB3b3JsZCFcXHQnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg0LCAwKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDYsIDEpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMTQsIDIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDAsXG5cdFx0XHRcdCdhbGwnLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMFwiPkhlbDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5sbzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj53b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDozMHB4XCI+XFx1MjE5MlxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sXG5cdFx0XHRcdFx0WzEsIDAsIDFdLCBbMSwgMSwgMl0sIFsxLCAyLCAzXSxcblx0XHRcdFx0XHRbMiwgMCwgNF0sIFsyLCAxLCA1XSxcblx0XHRcdFx0XHRbMywgMCwgNl0sXG5cdFx0XHRcdFx0WzQsIDAsIDddLCBbNCwgMSwgOF0sIFs0LCAyLCA5XSwgWzQsIDMsIDEwXSwgWzQsIDQsIDExXSwgWzQsIDUsIDEyXSxcblx0XHRcdFx0XHRbNSwgMCwgMTNdLCBbNSwgMywgMTZdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgZm9yIHNlbGVjdGlvbiB3aXRoIG5vIHNlbGVjdGlvbnMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHRlc3RDcmVhdGVMaW5lUGFydHMoXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHQnIEhlbGxvIHdvcmxkIVxcdCcsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDQsIDApLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNiwgMSksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgxNCwgMilcblx0XHRcdFx0XSxcblx0XHRcdFx0MCxcblx0XHRcdFx0J3NlbGVjdGlvbicsXG5cdFx0XHRcdG51bGxcblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGswXCI+XFx1MDBhMEhlbDwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azFcIj5sbzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azJcIj5cXHUwMGEwd29ybGQhXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sXG5cdFx0XHRcdFx0WzEsIDAsIDRdLCBbMSwgMSwgNV0sXG5cdFx0XHRcdFx0WzIsIDAsIDZdLCBbMiwgMSwgN10sIFsyLCAyLCA4XSwgWzIsIDMsIDldLCBbMiwgNCwgMTBdLCBbMiwgNSwgMTFdLCBbMiwgNiwgMTJdLCBbMiwgNywgMTNdLCBbMiwgMTAsIDE2XVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHJlbmRlciB3aGl0ZXNwYWNlIGZvciBzZWxlY3Rpb24gd2l0aCB3aG9sZSBsaW5lIHNlbGVjdGlvbicsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCcgSGVsbG8gd29ybGQhXFx0Jyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMCksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDE0LCAyKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnc2VsZWN0aW9uJyxcblx0XHRcdFx0W25ldyBMaW5lUmFuZ2UoMCwgMTQpXVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azBcIj5IZWw8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+bG88L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+d29ybGQhPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MzBweFwiPlxcdTIxOTJcXHUwMGEwXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLFxuXHRcdFx0XHRcdFsxLCAwLCAxXSwgWzEsIDEsIDJdLCBbMSwgMiwgM10sXG5cdFx0XHRcdFx0WzIsIDAsIDRdLCBbMiwgMSwgNV0sXG5cdFx0XHRcdFx0WzMsIDAsIDZdLFxuXHRcdFx0XHRcdFs0LCAwLCA3XSwgWzQsIDEsIDhdLCBbNCwgMiwgOV0sIFs0LCAzLCAxMF0sIFs0LCA0LCAxMV0sIFs0LCA1LCAxMl0sXG5cdFx0XHRcdFx0WzUsIDAsIDEzXSwgWzUsIDMsIDE2XVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHJlbmRlciB3aGl0ZXNwYWNlIGZvciBzZWxlY3Rpb24gd2l0aCBzZWxlY3Rpb24gc3Bhbm5pbmcgcGFydCBvZiB3aGl0ZXNwYWNlJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0JyBIZWxsbyB3b3JsZCFcXHQnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg0LCAwKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDYsIDEpLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoMTQsIDIpXG5cdFx0XHRcdF0sXG5cdFx0XHRcdDAsXG5cdFx0XHRcdCdzZWxlY3Rpb24nLFxuXHRcdFx0XHRbbmV3IExpbmVSYW5nZSgwLCA1KV1cblx0XHRcdCksXG5cdFx0XHR7XG5cdFx0XHRcdGh0bWw6IFtcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGswXCI+SGVsPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPmxvPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPlxcdTAwYTB3b3JsZCFcXHUwMGEwXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0XHRbMSwgMCwgMV0sIFsxLCAxLCAyXSwgWzEsIDIsIDNdLFxuXHRcdFx0XHRcdFsyLCAwLCA0XSwgWzIsIDEsIDVdLFxuXHRcdFx0XHRcdFszLCAwLCA2XSwgWzMsIDEsIDddLCBbMywgMiwgOF0sIFszLCAzLCA5XSwgWzMsIDQsIDEwXSwgWzMsIDUsIDExXSwgWzMsIDYsIDEyXSwgWzMsIDcsIDEzXSwgWzMsIDEwLCAxNl1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSBmb3Igc2VsZWN0aW9uIHdpdGggbXVsdGlwbGUgc2VsZWN0aW9ucycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCcgSGVsbG8gd29ybGQhXFx0Jyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMCksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDE0LCAyKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnc2VsZWN0aW9uJyxcblx0XHRcdFx0W25ldyBMaW5lUmFuZ2UoMCwgNSksIG5ldyBMaW5lUmFuZ2UoOSwgMTQpXVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azBcIj5IZWw8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+bG88L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+XFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjMwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0XHRbMSwgMCwgMV0sIFsxLCAxLCAyXSwgWzEsIDIsIDNdLFxuXHRcdFx0XHRcdFsyLCAwLCA0XSwgWzIsIDEsIDVdLFxuXHRcdFx0XHRcdFszLCAwLCA2XSwgWzMsIDEsIDddLCBbMywgMiwgOF0sIFszLCAzLCA5XSwgWzMsIDQsIDEwXSwgWzMsIDUsIDExXSwgWzMsIDYsIDEyXSxcblx0XHRcdFx0XHRbNCwgMCwgMTNdLCBbNCwgMywgMTZdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgZm9yIHNlbGVjdGlvbiB3aXRoIG11bHRpcGxlLCBpbml0aWFsbHkgdW5zb3J0ZWQgc2VsZWN0aW9ucycsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCcgSGVsbG8gd29ybGQhXFx0Jyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMCksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDE0LCAyKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnc2VsZWN0aW9uJyxcblx0XHRcdFx0W25ldyBMaW5lUmFuZ2UoOSwgMTQpLCBuZXcgTGluZVJhbmdlKDAsIDUpXVxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azBcIj5IZWw8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+bG88L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+XFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjMwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0XHRbMSwgMCwgMV0sIFsxLCAxLCAyXSwgWzEsIDIsIDNdLFxuXHRcdFx0XHRcdFsyLCAwLCA0XSwgWzIsIDEsIDVdLFxuXHRcdFx0XHRcdFszLCAwLCA2XSwgWzMsIDEsIDddLCBbMywgMiwgOF0sIFszLCAzLCA5XSwgWzMsIDQsIDEwXSwgWzMsIDUsIDExXSwgWzMsIDYsIDEyXSxcblx0XHRcdFx0XHRbNCwgMCwgMTNdLCBbNCwgMywgMTZdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgZm9yIHNlbGVjdGlvbiB3aXRoIHNlbGVjdGlvbnMgbmV4dCB0byBlYWNoIG90aGVyJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0JyAqIFMnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg0LCAwKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQnc2VsZWN0aW9uJyxcblx0XHRcdFx0W25ldyBMaW5lUmFuZ2UoMCwgMSksIG5ldyBMaW5lUmFuZ2UoMSwgMiksIG5ldyBMaW5lUmFuZ2UoMiwgMyldXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMFwiPio8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGswXCI+Uzwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLFxuXHRcdFx0XHRcdFsxLCAwLCAxXSxcblx0XHRcdFx0XHRbMiwgMCwgMl0sXG5cdFx0XHRcdFx0WzMsIDAsIDNdLCBbMywgMSwgNF1cblx0XHRcdFx0XVxuXHRcdFx0fVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NyZWF0ZUxpbmVQYXJ0cyByZW5kZXIgd2hpdGVzcGFjZSBmb3IgdHJhaWxpbmcgd2l0aCBsZWFkaW5nLCBpbm5lciwgYW5kIHdpdGhvdXQgdHJhaWxpbmcgd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCcgSGVsbG8gd29ybGQhJyxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNCwgMCksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg2LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDE0LCAyKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQndHJhaWxpbmcnLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMFwiPlxcdTAwYTBIZWw8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+bG88L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+XFx1MDBhMHdvcmxkITwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLFxuXHRcdFx0XHRcdFsxLCAwLCA0XSwgWzEsIDEsIDVdLFxuXHRcdFx0XHRcdFsyLCAwLCA2XSwgWzIsIDEsIDddLCBbMiwgMiwgOF0sIFsyLCAzLCA5XSwgWzIsIDQsIDEwXSwgWzIsIDUsIDExXSwgWzIsIDYsIDEyXSwgWzIsIDcsIDEzXVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIHJlbmRlciB3aGl0ZXNwYWNlIGZvciB0cmFpbGluZyB3aXRoIGxlYWRpbmcsIGlubmVyLCBhbmQgdHJhaWxpbmcgd2hpdGVzcGFjZScsICgpID0+IHtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0dGVzdENyZWF0ZUxpbmVQYXJ0cyhcblx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdCcgSGVsbG8gd29ybGQhIFxcdCcsXG5cdFx0XHRcdFtcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDQsIDApLFxuXHRcdFx0XHRcdGNyZWF0ZVBhcnQoNiwgMSksXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgxNSwgMilcblx0XHRcdFx0XSxcblx0XHRcdFx0MCxcblx0XHRcdFx0J3RyYWlsaW5nJyxcblx0XHRcdFx0bnVsbFxuXHRcdFx0KSxcblx0XHRcdHtcblx0XHRcdFx0aHRtbDogW1xuXHRcdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azBcIj5cXHUwMGEwSGVsPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPmxvPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPlxcdTAwYTB3b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDozMHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUyMTkyXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLFxuXHRcdFx0XHRcdFsxLCAwLCA0XSwgWzEsIDEsIDVdLFxuXHRcdFx0XHRcdFsyLCAwLCA2XSwgWzIsIDEsIDddLCBbMiwgMiwgOF0sIFsyLCAzLCA5XSwgWzIsIDQsIDEwXSwgWzIsIDUsIDExXSwgWzIsIDYsIDEyXSxcblx0XHRcdFx0XHRbMywgMCwgMTNdLCBbMywgMiwgMTRdLCBbMywgNCwgMTZdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgZm9yIHRyYWlsaW5nIHdpdGggOCBsZWFkaW5nIGFuZCA4IHRyYWlsaW5nIHdoaXRlc3BhY2VzJywgKCkgPT4ge1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHR0ZXN0Q3JlYXRlTGluZVBhcnRzKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0JyAgICAgICAgSGVsbG8gd29ybGQhICAgICAgICAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCg4LCAxKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDEwLCAyKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDI4LCAzKVxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQndHJhaWxpbmcnLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPlxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMlwiPkhlPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmxsb1xcdTAwYTB3b3JsZCE8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDo0MHB4XCI+XFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0XSxcblx0XHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLCBbMCwgMiwgMl0sIFswLCAzLCAzXSwgWzAsIDQsIDRdLCBbMCwgNSwgNV0sIFswLCA2LCA2XSwgWzAsIDcsIDddLFxuXHRcdFx0XHRcdFsxLCAwLCA4XSwgWzEsIDEsIDldLFxuXHRcdFx0XHRcdFsyLCAwLCAxMF0sIFsyLCAxLCAxMV0sIFsyLCAyLCAxMl0sIFsyLCAzLCAxM10sIFsyLCA0LCAxNF0sIFsyLCA1LCAxNV0sIFsyLCA2LCAxNl0sIFsyLCA3LCAxN10sIFsyLCA4LCAxOF0sIFsyLCA5LCAxOV0sXG5cdFx0XHRcdFx0WzMsIDAsIDIwXSwgWzMsIDIsIDIxXSwgWzMsIDQsIDIyXSwgWzMsIDYsIDIzXSxcblx0XHRcdFx0XHRbNCwgMCwgMjRdLCBbNCwgMiwgMjVdLCBbNCwgNCwgMjZdLCBbNCwgNiwgMjddLCBbNCwgOCwgMjhdXG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdjcmVhdGVMaW5lUGFydHMgcmVuZGVyIHdoaXRlc3BhY2UgZm9yIHRyYWlsaW5nIHdpdGggbGluZSBjb250YWluaW5nIG9ubHkgd2hpdGVzcGFjZXMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdHRlc3RDcmVhdGVMaW5lUGFydHMoXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHQnIFxcdCAnLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0Y3JlYXRlUGFydCgyLCAwKSxcblx0XHRcdFx0XHRjcmVhdGVQYXJ0KDMsIDEpLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHQwLFxuXHRcdFx0XHQndHJhaWxpbmcnLFxuXHRcdFx0XHRudWxsXG5cdFx0XHQpLFxuXHRcdFx0e1xuXHRcdFx0XHRodG1sOiBbXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6NDBweFwiPlxcdTAwYjdcXHUyMDBjXFx1MjE5MlxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdF0sXG5cdFx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0XHRbMCwgMCwgMF0sIFswLCAyLCAxXSxcblx0XHRcdFx0XHRbMSwgMCwgNF0sIFsxLCAyLCA1XVxuXHRcdFx0XHRdXG5cdFx0XHR9XG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnY3JlYXRlTGluZVBhcnRzIGNhbiBoYW5kbGUgdW5zb3J0ZWQgaW5saW5lIGRlY29yYXRpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnSGVsbG8gd29ybGQnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoMTEsIDApXSksXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBMaW5lRGVjb3JhdGlvbig1LCA3LCAnYScsIElubGluZURlY29yYXRpb25UeXBlLlJlZ3VsYXIpLFxuXHRcdFx0XHRuZXcgTGluZURlY29yYXRpb24oMSwgMywgJ2InLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5SZWd1bGFyKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDIsIDgsICdjJywgSW5saW5lRGVjb3JhdGlvblR5cGUuUmVndWxhciksXG5cdFx0XHRdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQtMSxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHQvLyAwMTIzNDU2Nzg5MFxuXHRcdC8vIEhlbGxvIHdvcmxkXG5cdFx0Ly8gLS0tLWFhLS0tLS1cblx0XHQvLyBiYi0tLS0tLS0tLVxuXHRcdC8vIC1jY2NjY2MtLS0tXG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMCBiXCI+SDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGswIGIgY1wiPmU8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMCBjXCI+bGw8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMCBhIGNcIj5vXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGswIGNcIj53PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azBcIj5vcmxkPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sXG5cdFx0XHRcdFsxLCAwLCAxXSxcblx0XHRcdFx0WzIsIDAsIDJdLCBbMiwgMSwgM10sXG5cdFx0XHRcdFszLCAwLCA0XSwgWzMsIDEsIDVdLFxuXHRcdFx0XHRbNCwgMCwgNl0sXG5cdFx0XHRcdFs1LCAwLCA3XSwgWzUsIDEsIDhdLCBbNSwgMiwgOV0sIFs1LCAzLCAxMF0sIFs1LCA0LCAxMV1cblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExNDg1OiBWaXNpYmxlIHdoaXRlc3BhY2UgY29uZmxpY3RzIHdpdGggYmVmb3JlIGRlY29yYXRvciBhdHRhY2htZW50JywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSAnXFx0YmxhJztcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRsaW5lQ29udGVudCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDQsIDMpXSksXG5cdFx0XHRbbmV3IExpbmVEZWNvcmF0aW9uKDEsIDIsICdiZWZvcmUnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5CZWZvcmUpXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnYWxsJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt3IGJlZm9yZVwiPlxcdTIxOTJcXHUwMGEwXFx1MDBhMFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmJsYTwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLFxuXHRcdFx0XHRbMSwgMCwgNF0sIFsxLCAxLCA1XSwgWzEsIDIsIDZdLCBbMSwgMywgN11cblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzMyNDM2OiBOb24tbW9ub3NwYWNlIGZvbnQgKyB2aXNpYmxlIHdoaXRlc3BhY2UgKyBBZnRlciBkZWNvcmF0b3IgY2F1c2VzIGxpbmUgdG8gXCJqdW1wXCInLCAoKSA9PiB7XG5cblx0XHRjb25zdCBsaW5lQ29udGVudCA9ICdcXHRibGEnO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGxpbmVDb250ZW50LFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNCwgMyldKSxcblx0XHRcdFtuZXcgTGluZURlY29yYXRpb24oMiwgMywgJ2JlZm9yZScsIElubGluZURlY29yYXRpb25UeXBlLkJlZm9yZSldLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQtMSxcblx0XHRcdCdhbGwnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjQwcHhcIj5cXHUyMTkyXFx1MDBhMFxcdTAwYTBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azMgYmVmb3JlXCI+Yjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+bGE8L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSxcblx0XHRcdFx0WzEsIDAsIDRdLFxuXHRcdFx0XHRbMiwgMCwgNV0sIFsyLCAxLCA2XSwgWzIsIDIsIDddXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzMDEzMzogRW1wdHkgbGluZXMgZG9uXFwndCByZW5kZXIgaW5saW5lIGRlY29yYXRpb25zJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgbGluZUNvbnRlbnQgPSAnJztcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRsaW5lQ29udGVudCxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDAsIDMpXSksXG5cdFx0XHRbbmV3IExpbmVEZWNvcmF0aW9uKDEsIDIsICdiZWZvcmUnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5CZWZvcmUpXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnYWxsJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJiZWZvcmVcIj48L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFsxLCAwLCAwXVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMzcyMDg6IENvbGxhcHNpbmcgYnVsbGV0IHBvaW50IGNvbnRhaW5pbmcgZW1vamkgaW4gTWFya2Rvd24gZG9jdW1lbnQgcmVzdWx0cyBpbiBbPz9dIGNoYXJhY3RlcicsICgpID0+IHtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHR0cnVlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdCcgIDEuIFx1RDgzRFx1REU0RicsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNywgMyldKSxcblx0XHRcdFtuZXcgTGluZURlY29yYXRpb24oNywgOCwgJ2lubGluZS1mb2xkZWQnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5BZnRlcildLFxuXHRcdFx0Mixcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlxcdTAwYTBcXHUwMGEwMS5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azMgaW5saW5lLWZvbGRlZFwiPlx1RDgzRFx1REU0Rjwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLCBbMCwgNCwgNF0sXG5cdFx0XHRcdFsxLCAwLCA1XSwgWzEsIDEsIDZdLCBbMSwgMiwgN11cblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM3NDAxICM0MDEyNzogQWxsb3cgYm90aCBiZWZvcmUgYW5kIGFmdGVyIGRlY29yYXRpb25zIG9uIGVtcHR5IGxpbmUnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDAsIDMpXSksXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBMaW5lRGVjb3JhdGlvbigxLCAxLCAnYmVmb3JlJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDEsIDEsICdhZnRlcicsIElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSxcblx0XHRcdF0sXG5cdFx0XHQyLFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJiZWZvcmVcIj48L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiYWZ0ZXJcIj48L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFsxLCAwLCAwXVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE4NzU5OiBlbmFibGUgbXVsdGlwbGUgdGV4dCBlZGl0b3IgZGVjb3JhdGlvbnMgaW4gZW1wdHkgbGluZXMnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDAsIDMpXSksXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBMaW5lRGVjb3JhdGlvbigxLCAxLCAnYWZ0ZXIxJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQWZ0ZXIpLFxuXHRcdFx0XHRuZXcgTGluZURlY29yYXRpb24oMSwgMSwgJ2FmdGVyMicsIElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDEsIDEsICdiZWZvcmUxJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDEsIDEsICdiZWZvcmUyJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdF0sXG5cdFx0XHQyLFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJiZWZvcmUxXCI+PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cImJlZm9yZTJcIj48L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiYWZ0ZXIxXCI+PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cImFmdGVyMlwiPjwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzIsIDAsIDBdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzODkzNTogR2l0TGVucyBlbmQtb2YtbGluZSBibGFtZSBubyBsb25nZXIgcmVuZGVyaW5nJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0J1xcdH0nLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoMiwgMyldKSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDMsIDMsICdjZWQtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi01ZTliOWIzZi0zIGNlZC1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTMnLCBJbmxpbmVEZWNvcmF0aW9uVHlwZS5CZWZvcmUpLFxuXHRcdFx0XHRuZXcgTGluZURlY29yYXRpb24oMywgMywgJ2NlZC1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTVlOWI5YjNmLTQgY2VkLVRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTItNCcsIElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSxcblx0XHRcdF0sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+XFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMH08L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiY2VkLVRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTItNWU5YjliM2YtMyBjZWQtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi0zXCI+PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cImNlZC1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTVlOWI5YjNmLTQgY2VkLVRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTItNFwiPjwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgNCwgNF0sXG5cdFx0XHRcdFsyLCAwLCA1XVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTM2NjIyOiBJbmxpbmUgZGVjb3JhdGlvbnMgYXJlIG5vdCByZW5kZXJpbmcgb24gbm9uLUFTQ0lJIGxpbmVzIHdoZW4gcmVuZGVyQ29udHJvbENoYXJhY3RlcnMgaXMgb24nLCAoKSA9PiB7XG5cblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnc29tZSB0ZXh0IFx1MDBBMycsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoMTEsIDMpXSksXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBMaW5lRGVjb3JhdGlvbig1LCA1LCAnaW5saW5lRGVjMScsIElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDYsIDYsICdpbmxpbmVEZWMyJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdF0sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5zb21lPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azMgaW5saW5lRGVjMVwiPjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszIGlubGluZURlYzJcIj48L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPnRleHRcXHUwMGEwXHUwMEEzPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sXG5cdFx0XHRcdFsxLCAwLCA0XSxcblx0XHRcdFx0WzQsIDAsIDVdLCBbNCwgMSwgNl0sIFs0LCAyLCA3XSwgWzQsIDMsIDhdLCBbNCwgNCwgOV0sIFs0LCA1LCAxMF0sIFs0LCA2LCAxMV1cblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIyODMyOiBDb25zaWRlciBmdWxsd2lkdGggY2hhcmFjdGVycyB3aGVuIHJlbmRlcmluZyB0YWJzJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0J2FzZCA9IFwiXHU2NEU2XCJcXHRcXHQjYXNkJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydCgxNSwgMyldKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmFzZFxcdTAwYTA9XFx1MDBhMFwiXHU2NEU2XCJcXHUwMGEwXFx1MDBhMFxcdTAwYTBcXHUwMGEwXFx1MDBhMFxcdTAwYTAjYXNkPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSwgWzAsIDgsIDldLFxuXHRcdFx0XHRbMCwgOSwgMTBdLCBbMCwgMTEsIDEyXSwgWzAsIDE1LCAxNl0sIFswLCAxNiwgMTddLCBbMCwgMTcsIDE4XSwgWzAsIDE4LCAxOV0sIFswLCAxOSwgMjBdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMjgzMjogQ29uc2lkZXIgZnVsbHdpZHRoIGNoYXJhY3RlcnMgd2hlbiByZW5kZXJpbmcgdGFicyAocmVuZGVyIHdoaXRlc3BhY2UpJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0J2FzZCA9IFwiXHU2NEU2XCJcXHRcXHQjYXNkJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydCgxNSwgMyldKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdhbGwnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+YXNkPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3dcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+PTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt3XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlwiXHU2NEU2XCI8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrd1wiPlxcdTIxOTJcXHUwMGEwXFx1MjE5MlxcdTAwYTBcXHUwMGEwXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+I2FzZDwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSxcblx0XHRcdFx0WzEsIDAsIDNdLFxuXHRcdFx0XHRbMiwgMCwgNF0sXG5cdFx0XHRcdFszLCAwLCA1XSxcblx0XHRcdFx0WzQsIDAsIDZdLCBbNCwgMSwgN10sIFs0LCAyLCA5XSxcblx0XHRcdFx0WzUsIDAsIDEwXSwgWzUsIDIsIDEyXSxcblx0XHRcdFx0WzYsIDAsIDE2XSwgWzYsIDEsIDE3XSwgWzYsIDIsIDE4XSwgWzYsIDMsIDE5XSwgWzYsIDQsIDIwXVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjIzNTI6IENPTUJJTklORyBBQ1VURSBBQ0NFTlQgKFUrMDMwMSknLCAoKSA9PiB7XG5cblx0XHRjb25zdCBhY3R1YWwgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0dHJ1ZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnMTIzNDU2ODkwMTIzNDU2Nzg5MDEyMzQ1Njg5MDEyMzQ1Njc4OTAxMjM0NTY4OTBhYmFcdTAzMDFiYScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNTMsIDMpXSksXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAwMDAsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj4xMjM0NTY4OTAxMjM0NTY3ODkwMTIzNDU2ODkwMTIzNDU2Nzg5MDEyMzQ1Njg5MGFiYVx1MDMwMWJhPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSxcblx0XHRcdFx0WzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl0sIFswLCAxMywgMTNdLCBbMCwgMTQsIDE0XSxcblx0XHRcdFx0WzAsIDE1LCAxNV0sIFswLCAxNiwgMTZdLCBbMCwgMTcsIDE3XSwgWzAsIDE4LCAxOF0sIFswLCAxOSwgMTldLCBbMCwgMjAsIDIwXSwgWzAsIDIxLCAyMV0sXG5cdFx0XHRcdFswLCAyMiwgMjJdLCBbMCwgMjMsIDIzXSwgWzAsIDI0LCAyNF0sIFswLCAyNSwgMjVdLCBbMCwgMjYsIDI2XSwgWzAsIDI3LCAyN10sIFswLCAyOCwgMjhdLFxuXHRcdFx0XHRbMCwgMjksIDI5XSwgWzAsIDMwLCAzMF0sIFswLCAzMSwgMzFdLCBbMCwgMzIsIDMyXSwgWzAsIDMzLCAzM10sIFswLCAzNCwgMzRdLCBbMCwgMzUsIDM1XSxcblx0XHRcdFx0WzAsIDM2LCAzNl0sIFswLCAzNywgMzddLCBbMCwgMzgsIDM4XSwgWzAsIDM5LCAzOV0sIFswLCA0MCwgNDBdLCBbMCwgNDEsIDQxXSwgWzAsIDQyLCA0Ml0sXG5cdFx0XHRcdFswLCA0MywgNDNdLCBbMCwgNDQsIDQ0XSwgWzAsIDQ1LCA0NV0sIFswLCA0NiwgNDZdLCBbMCwgNDcsIDQ3XSwgWzAsIDQ4LCA0OF0sIFswLCA0OSwgNDldLFxuXHRcdFx0XHRbMCwgNTAsIDUwXSwgWzAsIDUxLCA1MV0sIFswLCA1MiwgNTJdLCBbMCwgNTMsIDUzXVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMjIzNTI6IFBhcnRpYWxseSBCcm9rZW4gQ29tcGxleCBTY3JpcHQgUmVuZGVyaW5nIG9mIFRhbWlsJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0JyBKb3lTaGFyZVx1MEJCMlx1MEJDRCBcdTBCQUFcdTBCQkZcdTBCQTlcdTBCQ0RcdTBCQTRcdTBCQ0FcdTBCOUZcdTBCQjBcdTBCQ0RcdTBCQThcdTBCQ0RcdTBCQTRcdTBCQzEsIFx1MEJCNVx1MEJCRlx1MEI5Rlx1MEJDMFx1MEJBRlx1MEJDQiwgXHUwQjlDXHUwQkNCXHUwQjk1XHUwQkNEXHUwQjk1XHUwQkMxXHUwQjk1XHUwQkIzXHUwQkNELCBcdTBCODVcdTBCQTlcdTBCQkZcdTBCQUVcdTBCQzdcdTBCOUFcdTBCQTlcdTBCQ0QsIFx1MEJBOFx1MEI5NVx1MEJDOFx1MEI5QVx1MEJDRFx1MEI5QVx1MEJDMVx1MEJCNVx1MEJDOCBcdTBCQUFcdTBCOUZcdTBCOTlcdTBCQ0RcdTBCOTVcdTBCQjNcdTBCQ0QgXHUwQkFFXHUwQkIxXHUwQkNEXHUwQkIxXHUwQkMxXHUwQkFFXHUwQkNEIFx1MEI5QVx1MEJDNlx1MEJBRlx1MEJDRFx1MEJBNFx1MEJCRlx1MEI5NVx1MEJCM1x1MEJDOCBcdTBCQUFcdTBCQzZcdTBCQjFcdTBCQzFcdTBCQjVcdTBCQzBcdTBCQjBcdTBCQ0QnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDEwMCwgMyldKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlxcdTAwYTBKb3lTaGFyZVx1MEJCMlx1MEJDRFxcdTAwYTBcdTBCQUFcdTBCQkZcdTBCQTlcdTBCQ0RcdTBCQTRcdTBCQ0FcdTBCOUZcdTBCQjBcdTBCQ0RcdTBCQThcdTBCQ0RcdTBCQTRcdTBCQzEsXFx1MDBhMFx1MEJCNVx1MEJCRlx1MEI5Rlx1MEJDMFx1MEJBRlx1MEJDQixcXHUwMGEwXHUwQjlDXHUwQkNCXHUwQjk1XHUwQkNEXHUwQjk1XHUwQkMxXHUwQjk1XHUwQkIzXHUwQkNELFxcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlx1MEI4NVx1MEJBOVx1MEJCRlx1MEJBRVx1MEJDN1x1MEI5QVx1MEJBOVx1MEJDRCxcXHUwMGEwXHUwQkE4XHUwQjk1XHUwQkM4XHUwQjlBXHUwQkNEXHUwQjlBXHUwQkMxXHUwQkI1XHUwQkM4XFx1MDBhMFx1MEJBQVx1MEI5Rlx1MEI5OVx1MEJDRFx1MEI5NVx1MEJCM1x1MEJDRFxcdTAwYTBcdTBCQUVcdTBCQjFcdTBCQ0RcdTBCQjFcdTBCQzFcdTBCQUVcdTBCQ0RcXHUwMGEwXHUwQjlBXHUwQkM2XHUwQkFGXHUwQkNEXHUwQkE0XHUwQkJGXHUwQjk1XHUwQkIzXHUwQkM4XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+XHUwQkFBXHUwQkM2XHUwQkIxXHUwQkMxXHUwQkI1XHUwQkMwXHUwQkIwXHUwQkNEPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSxcblx0XHRcdFx0WzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl0sIFswLCAxMywgMTNdLCBbMCwgMTQsIDE0XSxcblx0XHRcdFx0WzAsIDE1LCAxNV0sIFswLCAxNiwgMTZdLCBbMCwgMTcsIDE3XSwgWzAsIDE4LCAxOF0sIFswLCAxOSwgMTldLCBbMCwgMjAsIDIwXSwgWzAsIDIxLCAyMV0sXG5cdFx0XHRcdFswLCAyMiwgMjJdLCBbMCwgMjMsIDIzXSwgWzAsIDI0LCAyNF0sIFswLCAyNSwgMjVdLCBbMCwgMjYsIDI2XSwgWzAsIDI3LCAyN10sIFswLCAyOCwgMjhdLFxuXHRcdFx0XHRbMCwgMjksIDI5XSwgWzAsIDMwLCAzMF0sIFswLCAzMSwgMzFdLCBbMCwgMzIsIDMyXSwgWzAsIDMzLCAzM10sIFswLCAzNCwgMzRdLCBbMCwgMzUsIDM1XSxcblx0XHRcdFx0WzAsIDM2LCAzNl0sIFswLCAzNywgMzddLCBbMCwgMzgsIDM4XSwgWzAsIDM5LCAzOV0sIFswLCA0MCwgNDBdLCBbMCwgNDEsIDQxXSwgWzAsIDQyLCA0Ml0sXG5cdFx0XHRcdFswLCA0MywgNDNdLCBbMCwgNDQsIDQ0XSwgWzAsIDQ1LCA0NV0sXG5cdFx0XHRcdFsxLCAwLCA0Nl0sIFsxLCAxLCA0N10sIFsxLCAyLCA0OF0sIFsxLCAzLCA0OV0sIFsxLCA0LCA1MF0sIFsxLCA1LCA1MV0sIFsxLCA2LCA1Ml0sIFsxLCA3LCA1M10sXG5cdFx0XHRcdFsxLCA4LCA1NF0sIFsxLCA5LCA1NV0sIFsxLCAxMCwgNTZdLCBbMSwgMTEsIDU3XSwgWzEsIDEyLCA1OF0sIFsxLCAxMywgNTldLCBbMSwgMTQsIDYwXSwgWzEsIDE1LCA2MV0sXG5cdFx0XHRcdFsxLCAxNiwgNjJdLCBbMSwgMTcsIDYzXSwgWzEsIDE4LCA2NF0sIFsxLCAxOSwgNjVdLCBbMSwgMjAsIDY2XSwgWzEsIDIxLCA2N10sIFsxLCAyMiwgNjhdLCBbMSwgMjMsIDY5XSxcblx0XHRcdFx0WzEsIDI0LCA3MF0sIFsxLCAyNSwgNzFdLCBbMSwgMjYsIDcyXSwgWzEsIDI3LCA3M10sIFsxLCAyOCwgNzRdLCBbMSwgMjksIDc1XSwgWzEsIDMwLCA3Nl0sIFsxLCAzMSwgNzddLFxuXHRcdFx0XHRbMSwgMzIsIDc4XSwgWzEsIDMzLCA3OV0sIFsxLCAzNCwgODBdLCBbMSwgMzUsIDgxXSwgWzEsIDM2LCA4Ml0sIFsxLCAzNywgODNdLCBbMSwgMzgsIDg0XSwgWzEsIDM5LCA4NV0sXG5cdFx0XHRcdFsxLCA0MCwgODZdLCBbMSwgNDEsIDg3XSwgWzEsIDQyLCA4OF0sIFsxLCA0MywgODldLCBbMSwgNDQsIDkwXSwgWzEsIDQ1LCA5MV0sXG5cdFx0XHRcdFsyLCAwLCA5Ml0sIFsyLCAxLCA5M10sIFsyLCAyLCA5NF0sIFsyLCAzLCA5NV0sIFsyLCA0LCA5Nl0sIFsyLCA1LCA5N10sIFsyLCA2LCA5OF0sIFsyLCA3LCA5OV0sIFsyLCA4LCAxMDBdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0MjcwMDogSGluZGkgY2hhcmFjdGVycyBhcmUgbm90IGJlaW5nIHJlbmRlcmVkIHByb3Blcmx5JywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0JyBcdTA5MzVcdTA5NEIgXHUwOTEwXHUwOTM4XHUwOTNFIFx1MDkxNVx1MDk0RFx1MDkyRlx1MDkzRSBcdTA5MzlcdTA5NDggXHUwOTFDXHUwOTRCIFx1MDkzOVx1MDkyRVx1MDkzRVx1MDkzMFx1MDk0NyBcdTA5MDVcdTA5MDJcdTA5MjZcdTA5MzAgXHUwOTJEXHUwOTQwIFx1MDkzOVx1MDk0OCBcdTA5MTRcdTA5MzAgXHUwOTJDXHUwOTNFXHUwOTM5XHUwOTMwIFx1MDkyRFx1MDk0MCBcdTA5MzlcdTA5NDhcdTA5NjQgXHUwOTFDXHUwOTNGXHUwOTM4XHUwOTE1XHUwOTQwIFx1MDkzNVx1MDkxQ1x1MDkzOSBcdTA5MzhcdTA5NDcgXHUwOTM5XHUwOTJFIFx1MDkzOFx1MDkyQyBcdTA5MzlcdTA5NDhcdTA5MDJcdTA5NjQgXHUwOTFDXHUwOTNGXHUwOTM4XHUwOTI4XHUwOTQ3IFx1MDkwN1x1MDkzOCBcdTA5MzhcdTA5NDNcdTA5MzdcdTA5NERcdTA5MUZcdTA5M0YgXHUwOTE1XHUwOTQwIFx1MDkzMFx1MDkxQVx1MDkyOFx1MDkzRSBcdTA5MTVcdTA5NDAgXHUwOTM5XHUwOTQ4XHUwOTY0Jyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydCgxMDUsIDMpXSksXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAwMDAsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5cXHUwMGEwXHUwOTM1XHUwOTRCXFx1MDBhMFx1MDkxMFx1MDkzOFx1MDkzRVxcdTAwYTBcdTA5MTVcdTA5NERcdTA5MkZcdTA5M0VcXHUwMGEwXHUwOTM5XHUwOTQ4XFx1MDBhMFx1MDkxQ1x1MDk0QlxcdTAwYTBcdTA5MzlcdTA5MkVcdTA5M0VcdTA5MzBcdTA5NDdcXHUwMGEwXHUwOTA1XHUwOTAyXHUwOTI2XHUwOTMwXFx1MDBhMFx1MDkyRFx1MDk0MFxcdTAwYTBcdTA5MzlcdTA5NDhcXHUwMGEwXHUwOTE0XHUwOTMwXFx1MDBhMFx1MDkyQ1x1MDkzRVx1MDkzOVx1MDkzMFxcdTAwYTBcdTA5MkRcdTA5NDBcXHUwMGEwXHUwOTM5XHUwOTQ4XHUwOTY0XFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+XHUwOTFDXHUwOTNGXHUwOTM4XHUwOTE1XHUwOTQwXFx1MDBhMFx1MDkzNVx1MDkxQ1x1MDkzOVxcdTAwYTBcdTA5MzhcdTA5NDdcXHUwMGEwXHUwOTM5XHUwOTJFXFx1MDBhMFx1MDkzOFx1MDkyQ1xcdTAwYTBcdTA5MzlcdTA5NDhcdTA5MDJcdTA5NjRcXHUwMGEwXHUwOTFDXHUwOTNGXHUwOTM4XHUwOTI4XHUwOTQ3XFx1MDBhMFx1MDkwN1x1MDkzOFxcdTAwYTBcdTA5MzhcdTA5NDNcdTA5MzdcdTA5NERcdTA5MUZcdTA5M0ZcXHUwMGEwXHUwOTE1XHUwOTQwXFx1MDBhMFx1MDkzMFx1MDkxQVx1MDkyOFx1MDkzRVxcdTAwYTBcdTA5MTVcdTA5NDBcXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5cdTA5MzlcdTA5NDhcdTA5NjQ8L3NwYW4+Jyxcblx0XHRcdF0sXG5cdFx0XHRtYXBwaW5nOiBbXG5cdFx0XHRcdFswLCAwLCAwXSwgWzAsIDEsIDFdLCBbMCwgMiwgMl0sIFswLCAzLCAzXSwgWzAsIDQsIDRdLCBbMCwgNSwgNV0sIFswLCA2LCA2XSwgWzAsIDcsIDddLFxuXHRcdFx0XHRbMCwgOCwgOF0sIFswLCA5LCA5XSwgWzAsIDEwLCAxMF0sIFswLCAxMSwgMTFdLCBbMCwgMTIsIDEyXSwgWzAsIDEzLCAxM10sIFswLCAxNCwgMTRdLFxuXHRcdFx0XHRbMCwgMTUsIDE1XSwgWzAsIDE2LCAxNl0sIFswLCAxNywgMTddLCBbMCwgMTgsIDE4XSwgWzAsIDE5LCAxOV0sIFswLCAyMCwgMjBdLCBbMCwgMjEsIDIxXSxcblx0XHRcdFx0WzAsIDIyLCAyMl0sIFswLCAyMywgMjNdLCBbMCwgMjQsIDI0XSwgWzAsIDI1LCAyNV0sIFswLCAyNiwgMjZdLCBbMCwgMjcsIDI3XSwgWzAsIDI4LCAyOF0sXG5cdFx0XHRcdFswLCAyOSwgMjldLCBbMCwgMzAsIDMwXSwgWzAsIDMxLCAzMV0sIFswLCAzMiwgMzJdLCBbMCwgMzMsIDMzXSwgWzAsIDM0LCAzNF0sIFswLCAzNSwgMzVdLFxuXHRcdFx0XHRbMCwgMzYsIDM2XSwgWzAsIDM3LCAzN10sIFswLCAzOCwgMzhdLCBbMCwgMzksIDM5XSwgWzAsIDQwLCA0MF0sIFswLCA0MSwgNDFdLCBbMCwgNDIsIDQyXSxcblx0XHRcdFx0WzAsIDQzLCA0M10sIFswLCA0NCwgNDRdLCBbMCwgNDUsIDQ1XSwgWzAsIDQ2LCA0Nl0sIFswLCA0NywgNDddLCBbMCwgNDgsIDQ4XSwgWzAsIDQ5LCA0OV0sXG5cdFx0XHRcdFswLCA1MCwgNTBdLFxuXHRcdFx0XHRbMSwgMCwgNTFdLCBbMSwgMSwgNTJdLCBbMSwgMiwgNTNdLCBbMSwgMywgNTRdLCBbMSwgNCwgNTVdLCBbMSwgNSwgNTZdLCBbMSwgNiwgNTddLCBbMSwgNywgNThdLFxuXHRcdFx0XHRbMSwgOCwgNTldLCBbMSwgOSwgNjBdLCBbMSwgMTAsIDYxXSwgWzEsIDExLCA2Ml0sIFsxLCAxMiwgNjNdLCBbMSwgMTMsIDY0XSwgWzEsIDE0LCA2NV0sXG5cdFx0XHRcdFsxLCAxNSwgNjZdLCBbMSwgMTYsIDY3XSwgWzEsIDE3LCA2OF0sIFsxLCAxOCwgNjldLCBbMSwgMTksIDcwXSwgWzEsIDIwLCA3MV0sIFsxLCAyMSwgNzJdLFxuXHRcdFx0XHRbMSwgMjIsIDczXSwgWzEsIDIzLCA3NF0sIFsxLCAyNCwgNzVdLCBbMSwgMjUsIDc2XSwgWzEsIDI2LCA3N10sIFsxLCAyNywgNzhdLCBbMSwgMjgsIDc5XSxcblx0XHRcdFx0WzEsIDI5LCA4MF0sIFsxLCAzMCwgODFdLCBbMSwgMzEsIDgyXSwgWzEsIDMyLCA4M10sIFsxLCAzMywgODRdLCBbMSwgMzQsIDg1XSwgWzEsIDM1LCA4Nl0sXG5cdFx0XHRcdFsxLCAzNiwgODddLCBbMSwgMzcsIDg4XSwgWzEsIDM4LCA4OV0sIFsxLCAzOSwgOTBdLCBbMSwgNDAsIDkxXSwgWzEsIDQxLCA5Ml0sIFsxLCA0MiwgOTNdLFxuXHRcdFx0XHRbMSwgNDMsIDk0XSwgWzEsIDQ0LCA5NV0sIFsxLCA0NSwgOTZdLCBbMSwgNDYsIDk3XSwgWzEsIDQ3LCA5OF0sIFsxLCA0OCwgOTldLCBbMSwgNDksIDEwMF0sXG5cdFx0XHRcdFsxLCA1MCwgMTAxXSwgWzIsIDAsIDEwMl0sIFsyLCAxLCAxMDNdLCBbMiwgMiwgMTA0XSwgWzIsIDMsIDEwNV1cblx0XHRcdF1cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM4MTIzOiBlZGl0b3IucmVuZGVyV2hpdGVzcGFjZTogXCJib3VuZGFyeVwiIHJlbmRlcnMgd2hpdGVzcGFjZSBhdCBsaW5lIHdyYXAgcG9pbnQgd2hlbiBsaW5lIGlzIHdyYXBwZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0J1RoaXMgaXMgYSBsb25nIGxpbmUgd2hpY2ggbmV2ZXIgdXNlcyBtb3JlIHRoYW4gdHdvIHNwYWNlcy4gJyxcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNTksIDMpXSksXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAwMDAsXG5cdFx0XHQnYm91bmRhcnknLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+VGhpc1xcdTAwYTBpc1xcdTAwYTBhXFx1MDBhMGxvbmdcXHUwMGEwbGluZVxcdTAwYTB3aGljaFxcdTAwYTBuZXZlclxcdTAwYTB1c2VzXFx1MDBhMG1vcmVcXHUwMGEwdGhhblxcdTAwYTB0d288L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPlxcdTAwYTBzcGFjZXMuPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSxcblx0XHRcdFx0WzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl0sIFswLCAxMywgMTNdLCBbMCwgMTQsIDE0XSxcblx0XHRcdFx0WzAsIDE1LCAxNV0sIFswLCAxNiwgMTZdLCBbMCwgMTcsIDE3XSwgWzAsIDE4LCAxOF0sIFswLCAxOSwgMTldLCBbMCwgMjAsIDIwXSwgWzAsIDIxLCAyMV0sXG5cdFx0XHRcdFswLCAyMiwgMjJdLCBbMCwgMjMsIDIzXSwgWzAsIDI0LCAyNF0sIFswLCAyNSwgMjVdLCBbMCwgMjYsIDI2XSwgWzAsIDI3LCAyN10sIFswLCAyOCwgMjhdLFxuXHRcdFx0XHRbMCwgMjksIDI5XSwgWzAsIDMwLCAzMF0sIFswLCAzMSwgMzFdLCBbMCwgMzIsIDMyXSwgWzAsIDMzLCAzM10sIFswLCAzNCwgMzRdLCBbMCwgMzUsIDM1XSxcblx0XHRcdFx0WzAsIDM2LCAzNl0sIFswLCAzNywgMzddLCBbMCwgMzgsIDM4XSwgWzAsIDM5LCAzOV0sIFswLCA0MCwgNDBdLCBbMCwgNDEsIDQxXSwgWzAsIDQyLCA0Ml0sXG5cdFx0XHRcdFswLCA0MywgNDNdLCBbMCwgNDQsIDQ0XSwgWzAsIDQ1LCA0NV0sIFswLCA0NiwgNDZdLCBbMCwgNDcsIDQ3XSwgWzAsIDQ4LCA0OF0sIFswLCA0OSwgNDldLFxuXHRcdFx0XHRbMSwgMCwgNTBdLCBbMSwgMSwgNTFdLCBbMSwgMiwgNTJdLCBbMSwgMywgNTNdLCBbMSwgNCwgNTRdLCBbMSwgNSwgNTVdLCBbMSwgNiwgNTZdLCBbMSwgNywgNTddLFxuXHRcdFx0XHRbMiwgMCwgNThdLCBbMiwgMSwgNTldXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzMzUyNTogTG9uZyBsaW5lIHdpdGggbGlnYXR1cmVzIHRha2VzIGEgbG9uZyB0aW1lIHRvIHBhaW50IGRlY29yYXRpb25zJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0J2FwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvIGFwcGVuZCBkYXRhIHRvJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDE5NCwgMyldKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdub25lJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdG51bGxcblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+YXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwYXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwYXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5hcHBlbmRcXHUwMGEwZGF0YVxcdTAwYTB0b1xcdTAwYTBhcHBlbmRcXHUwMGEwZGF0YVxcdTAwYTB0b1xcdTAwYTBhcHBlbmRcXHUwMGEwZGF0YVxcdTAwYTB0b1xcdTAwYTA8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmFwcGVuZFxcdTAwYTBkYXRhXFx1MDBhMHRvXFx1MDBhMGFwcGVuZFxcdTAwYTBkYXRhXFx1MDBhMHRvXFx1MDBhMGFwcGVuZFxcdTAwYTBkYXRhXFx1MDBhMHRvXFx1MDBhMDwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGszXCI+YXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwYXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwYXBwZW5kXFx1MDBhMGRhdGFcXHUwMGEwdG9cXHUwMGEwPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5hcHBlbmRcXHUwMGEwZGF0YVxcdTAwYTB0bzwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLCBbMCwgNCwgNF0sIFswLCA1LCA1XSwgWzAsIDYsIDZdLCBbMCwgNywgN10sXG5cdFx0XHRcdFswLCA4LCA4XSwgWzAsIDksIDldLCBbMCwgMTAsIDEwXSwgWzAsIDExLCAxMV0sIFswLCAxMiwgMTJdLCBbMCwgMTMsIDEzXSwgWzAsIDE0LCAxNF0sXG5cdFx0XHRcdFswLCAxNSwgMTVdLCBbMCwgMTYsIDE2XSwgWzAsIDE3LCAxN10sIFswLCAxOCwgMThdLCBbMCwgMTksIDE5XSwgWzAsIDIwLCAyMF0sIFswLCAyMSwgMjFdLFxuXHRcdFx0XHRbMCwgMjIsIDIyXSwgWzAsIDIzLCAyM10sIFswLCAyNCwgMjRdLCBbMCwgMjUsIDI1XSwgWzAsIDI2LCAyNl0sIFswLCAyNywgMjddLCBbMCwgMjgsIDI4XSxcblx0XHRcdFx0WzAsIDI5LCAyOV0sIFswLCAzMCwgMzBdLCBbMCwgMzEsIDMxXSwgWzAsIDMyLCAzMl0sIFswLCAzMywgMzNdLCBbMCwgMzQsIDM0XSwgWzAsIDM1LCAzNV0sXG5cdFx0XHRcdFswLCAzNiwgMzZdLCBbMCwgMzcsIDM3XSwgWzAsIDM4LCAzOF0sIFswLCAzOSwgMzldLCBbMCwgNDAsIDQwXSwgWzAsIDQxLCA0MV0sIFswLCA0MiwgNDJdLFxuXHRcdFx0XHRbMCwgNDMsIDQzXSwgWzAsIDQ0LCA0NF0sXG5cdFx0XHRcdFsxLCAwLCA0NV0sIFsxLCAxLCA0Nl0sIFsxLCAyLCA0N10sIFsxLCAzLCA0OF0sIFsxLCA0LCA0OV0sIFsxLCA1LCA1MF0sIFsxLCA2LCA1MV0sXG5cdFx0XHRcdFsxLCA3LCA1Ml0sIFsxLCA4LCA1M10sIFsxLCA5LCA1NF0sIFsxLCAxMCwgNTVdLCBbMSwgMTEsIDU2XSwgWzEsIDEyLCA1N10sIFsxLCAxMywgNThdLFxuXHRcdFx0XHRbMSwgMTQsIDU5XSwgWzEsIDE1LCA2MF0sIFsxLCAxNiwgNjFdLCBbMSwgMTcsIDYyXSwgWzEsIDE4LCA2M10sIFsxLCAxOSwgNjRdLCBbMSwgMjAsIDY1XSxcblx0XHRcdFx0WzEsIDIxLCA2Nl0sIFsxLCAyMiwgNjddLCBbMSwgMjMsIDY4XSwgWzEsIDI0LCA2OV0sIFsxLCAyNSwgNzBdLCBbMSwgMjYsIDcxXSwgWzEsIDI3LCA3Ml0sXG5cdFx0XHRcdFsxLCAyOCwgNzNdLCBbMSwgMjksIDc0XSwgWzEsIDMwLCA3NV0sIFsxLCAzMSwgNzZdLCBbMSwgMzIsIDc3XSwgWzEsIDMzLCA3OF0sIFsxLCAzNCwgNzldLFxuXHRcdFx0XHRbMSwgMzUsIDgwXSwgWzEsIDM2LCA4MV0sIFsxLCAzNywgODJdLCBbMSwgMzgsIDgzXSwgWzEsIDM5LCA4NF0sIFsxLCA0MCwgODVdLCBbMSwgNDEsIDg2XSxcblx0XHRcdFx0WzEsIDQyLCA4N10sIFsxLCA0MywgODhdLCBbMSwgNDQsIDg5XSxcblx0XHRcdFx0WzIsIDAsIDkwXSwgWzIsIDEsIDkxXSwgWzIsIDIsIDkyXSwgWzIsIDMsIDkzXSwgWzIsIDQsIDk0XSwgWzIsIDUsIDk1XSwgWzIsIDYsIDk2XSxcblx0XHRcdFx0WzIsIDcsIDk3XSwgWzIsIDgsIDk4XSwgWzIsIDksIDk5XSwgWzIsIDEwLCAxMDBdLCBbMiwgMTEsIDEwMV0sIFsyLCAxMiwgMTAyXSxcblx0XHRcdFx0WzIsIDEzLCAxMDNdLCBbMiwgMTQsIDEwNF0sIFsyLCAxNSwgMTA1XSwgWzIsIDE2LCAxMDZdLCBbMiwgMTcsIDEwN10sIFsyLCAxOCwgMTA4XSxcblx0XHRcdFx0WzIsIDE5LCAxMDldLCBbMiwgMjAsIDExMF0sIFsyLCAyMSwgMTExXSwgWzIsIDIyLCAxMTJdLCBbMiwgMjMsIDExM10sIFsyLCAyNCwgMTE0XSxcblx0XHRcdFx0WzIsIDI1LCAxMTVdLCBbMiwgMjYsIDExNl0sIFsyLCAyNywgMTE3XSwgWzIsIDI4LCAxMThdLCBbMiwgMjksIDExOV0sIFsyLCAzMCwgMTIwXSxcblx0XHRcdFx0WzIsIDMxLCAxMjFdLCBbMiwgMzIsIDEyMl0sIFsyLCAzMywgMTIzXSwgWzIsIDM0LCAxMjRdLCBbMiwgMzUsIDEyNV0sIFsyLCAzNiwgMTI2XSxcblx0XHRcdFx0WzIsIDM3LCAxMjddLCBbMiwgMzgsIDEyOF0sIFsyLCAzOSwgMTI5XSwgWzIsIDQwLCAxMzBdLCBbMiwgNDEsIDEzMV0sIFsyLCA0MiwgMTMyXSxcblx0XHRcdFx0WzIsIDQzLCAxMzNdLCBbMiwgNDQsIDEzNF0sXG5cdFx0XHRcdFszLCAwLCAxMzVdLCBbMywgMSwgMTM2XSwgWzMsIDIsIDEzN10sIFszLCAzLCAxMzhdLCBbMywgNCwgMTM5XSwgWzMsIDUsIDE0MF0sIFszLCA2LCAxNDFdLFxuXHRcdFx0XHRbMywgNywgMTQyXSwgWzMsIDgsIDE0M10sIFszLCA5LCAxNDRdLCBbMywgMTAsIDE0NV0sIFszLCAxMSwgMTQ2XSwgWzMsIDEyLCAxNDddLCBbMywgMTMsIDE0OF0sXG5cdFx0XHRcdFszLCAxNCwgMTQ5XSwgWzMsIDE1LCAxNTBdLCBbMywgMTYsIDE1MV0sIFszLCAxNywgMTUyXSwgWzMsIDE4LCAxNTNdLCBbMywgMTksIDE1NF0sIFszLCAyMCwgMTU1XSxcblx0XHRcdFx0WzMsIDIxLCAxNTZdLCBbMywgMjIsIDE1N10sIFszLCAyMywgMTU4XSwgWzMsIDI0LCAxNTldLCBbMywgMjUsIDE2MF0sIFszLCAyNiwgMTYxXSwgWzMsIDI3LCAxNjJdLFxuXHRcdFx0XHRbMywgMjgsIDE2M10sIFszLCAyOSwgMTY0XSwgWzMsIDMwLCAxNjVdLCBbMywgMzEsIDE2Nl0sIFszLCAzMiwgMTY3XSwgWzMsIDMzLCAxNjhdLCBbMywgMzQsIDE2OV0sXG5cdFx0XHRcdFszLCAzNSwgMTcwXSwgWzMsIDM2LCAxNzFdLCBbMywgMzcsIDE3Ml0sIFszLCAzOCwgMTczXSwgWzMsIDM5LCAxNzRdLCBbMywgNDAsIDE3NV0sIFszLCA0MSwgMTc2XSxcblx0XHRcdFx0WzMsIDQyLCAxNzddLCBbMywgNDMsIDE3OF0sIFszLCA0NCwgMTc5XSxcblx0XHRcdFx0WzQsIDAsIDE4MF0sIFs0LCAxLCAxODFdLCBbNCwgMiwgMTgyXSwgWzQsIDMsIDE4M10sIFs0LCA0LCAxODRdLCBbNCwgNSwgMTg1XSwgWzQsIDYsIDE4Nl0sXG5cdFx0XHRcdFs0LCA3LCAxODddLCBbNCwgOCwgMTg4XSwgWzQsIDksIDE4OV0sIFs0LCAxMCwgMTkwXSwgWzQsIDExLCAxOTFdLCBbNCwgMTIsIDE5Ml0sIFs0LCAxMywgMTkzXSxcblx0XHRcdFx0WzQsIDE0LCAxOTRdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzMzUyNTogTG9uZyBsaW5lIHdpdGggbGlnYXR1cmVzIHRha2VzIGEgbG9uZyB0aW1lIHRvIHBhaW50IGRlY29yYXRpb25zIC0gbm90IHBvc3NpYmxlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0J2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0bycsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhbY3JlYXRlUGFydCgxOTQsIDMpXSksXG5cdFx0XHRbXSxcblx0XHRcdDQsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAwMDAsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRudWxsXG5cdFx0KSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGluZmxhdGVSZW5kZXJMaW5lT3V0cHV0KGFjdHVhbCksIHtcblx0XHRcdGh0bWw6IFtcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrM1wiPmFwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0b2FwcGVuZGRhdGF0bzwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMSwgMV0sIFswLCAyLCAyXSwgWzAsIDMsIDNdLCBbMCwgNCwgNF0sIFswLCA1LCA1XSwgWzAsIDYsIDZdLCBbMCwgNywgN10sXG5cdFx0XHRcdFswLCA4LCA4XSwgWzAsIDksIDldLCBbMCwgMTAsIDEwXSwgWzAsIDExLCAxMV0sIFswLCAxMiwgMTJdLCBbMCwgMTMsIDEzXSwgWzAsIDE0LCAxNF0sXG5cdFx0XHRcdFswLCAxNSwgMTVdLCBbMCwgMTYsIDE2XSwgWzAsIDE3LCAxN10sIFswLCAxOCwgMThdLCBbMCwgMTksIDE5XSwgWzAsIDIwLCAyMF0sIFswLCAyMSwgMjFdLFxuXHRcdFx0XHRbMCwgMjIsIDIyXSwgWzAsIDIzLCAyM10sIFswLCAyNCwgMjRdLCBbMCwgMjUsIDI1XSwgWzAsIDI2LCAyNl0sIFswLCAyNywgMjddLCBbMCwgMjgsIDI4XSxcblx0XHRcdFx0WzAsIDI5LCAyOV0sIFswLCAzMCwgMzBdLCBbMCwgMzEsIDMxXSwgWzAsIDMyLCAzMl0sIFswLCAzMywgMzNdLCBbMCwgMzQsIDM0XSwgWzAsIDM1LCAzNV0sXG5cdFx0XHRcdFswLCAzNiwgMzZdLCBbMCwgMzcsIDM3XSwgWzAsIDM4LCAzOF0sIFswLCAzOSwgMzldLCBbMCwgNDAsIDQwXSwgWzAsIDQxLCA0MV0sIFswLCA0MiwgNDJdLFxuXHRcdFx0XHRbMCwgNDMsIDQzXSwgWzAsIDQ0LCA0NF0sIFswLCA0NSwgNDVdLCBbMCwgNDYsIDQ2XSwgWzAsIDQ3LCA0N10sIFswLCA0OCwgNDhdLCBbMCwgNDksIDQ5XSxcblx0XHRcdFx0WzAsIDUwLCA1MF0sIFswLCA1MSwgNTFdLCBbMCwgNTIsIDUyXSwgWzAsIDUzLCA1M10sIFswLCA1NCwgNTRdLCBbMCwgNTUsIDU1XSwgWzAsIDU2LCA1Nl0sXG5cdFx0XHRcdFswLCA1NywgNTddLCBbMCwgNTgsIDU4XSwgWzAsIDU5LCA1OV0sIFswLCA2MCwgNjBdLCBbMCwgNjEsIDYxXSwgWzAsIDYyLCA2Ml0sIFswLCA2MywgNjNdLFxuXHRcdFx0XHRbMCwgNjQsIDY0XSwgWzAsIDY1LCA2NV0sIFswLCA2NiwgNjZdLCBbMCwgNjcsIDY3XSwgWzAsIDY4LCA2OF0sIFswLCA2OSwgNjldLCBbMCwgNzAsIDcwXSxcblx0XHRcdFx0WzAsIDcxLCA3MV0sIFswLCA3MiwgNzJdLCBbMCwgNzMsIDczXSwgWzAsIDc0LCA3NF0sIFswLCA3NSwgNzVdLCBbMCwgNzYsIDc2XSwgWzAsIDc3LCA3N10sXG5cdFx0XHRcdFswLCA3OCwgNzhdLCBbMCwgNzksIDc5XSwgWzAsIDgwLCA4MF0sIFswLCA4MSwgODFdLCBbMCwgODIsIDgyXSwgWzAsIDgzLCA4M10sIFswLCA4NCwgODRdLFxuXHRcdFx0XHRbMCwgODUsIDg1XSwgWzAsIDg2LCA4Nl0sIFswLCA4NywgODddLCBbMCwgODgsIDg4XSwgWzAsIDg5LCA4OV0sIFswLCA5MCwgOTBdLCBbMCwgOTEsIDkxXSxcblx0XHRcdFx0WzAsIDkyLCA5Ml0sIFswLCA5MywgOTNdLCBbMCwgOTQsIDk0XSwgWzAsIDk1LCA5NV0sIFswLCA5NiwgOTZdLCBbMCwgOTcsIDk3XSwgWzAsIDk4LCA5OF0sXG5cdFx0XHRcdFswLCA5OSwgOTldLCBbMCwgMTAwLCAxMDBdLCBbMCwgMTAxLCAxMDFdLCBbMCwgMTAyLCAxMDJdLCBbMCwgMTAzLCAxMDNdLCBbMCwgMTA0LCAxMDRdLFxuXHRcdFx0XHRbMCwgMTA1LCAxMDVdLCBbMCwgMTA2LCAxMDZdLCBbMCwgMTA3LCAxMDddLCBbMCwgMTA4LCAxMDhdLCBbMCwgMTA5LCAxMDldLCBbMCwgMTEwLCAxMTBdLFxuXHRcdFx0XHRbMCwgMTExLCAxMTFdLCBbMCwgMTEyLCAxMTJdLCBbMCwgMTEzLCAxMTNdLCBbMCwgMTE0LCAxMTRdLCBbMCwgMTE1LCAxMTVdLCBbMCwgMTE2LCAxMTZdLFxuXHRcdFx0XHRbMCwgMTE3LCAxMTddLCBbMCwgMTE4LCAxMThdLCBbMCwgMTE5LCAxMTldLCBbMCwgMTIwLCAxMjBdLCBbMCwgMTIxLCAxMjFdLCBbMCwgMTIyLCAxMjJdLFxuXHRcdFx0XHRbMCwgMTIzLCAxMjNdLCBbMCwgMTI0LCAxMjRdLCBbMCwgMTI1LCAxMjVdLCBbMCwgMTI2LCAxMjZdLCBbMCwgMTI3LCAxMjddLCBbMCwgMTI4LCAxMjhdLFxuXHRcdFx0XHRbMCwgMTI5LCAxMjldLCBbMCwgMTMwLCAxMzBdLCBbMCwgMTMxLCAxMzFdLCBbMCwgMTMyLCAxMzJdLCBbMCwgMTMzLCAxMzNdLCBbMCwgMTM0LCAxMzRdLFxuXHRcdFx0XHRbMCwgMTM1LCAxMzVdLCBbMCwgMTM2LCAxMzZdLCBbMCwgMTM3LCAxMzddLCBbMCwgMTM4LCAxMzhdLCBbMCwgMTM5LCAxMzldLCBbMCwgMTQwLCAxNDBdLFxuXHRcdFx0XHRbMCwgMTQxLCAxNDFdLCBbMCwgMTQyLCAxNDJdLCBbMCwgMTQzLCAxNDNdLCBbMCwgMTQ0LCAxNDRdLCBbMCwgMTQ1LCAxNDVdLCBbMCwgMTQ2LCAxNDZdLFxuXHRcdFx0XHRbMCwgMTQ3LCAxNDddLCBbMCwgMTQ4LCAxNDhdLCBbMCwgMTQ5LCAxNDldLCBbMCwgMTUwLCAxNTBdLCBbMCwgMTUxLCAxNTFdLCBbMCwgMTUyLCAxNTJdLFxuXHRcdFx0XHRbMCwgMTUzLCAxNTNdLCBbMCwgMTU0LCAxNTRdLCBbMCwgMTU1LCAxNTVdLCBbMCwgMTU2LCAxNTZdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5MTkzNjogU2VtYW50aWMgdG9rZW4gY29sb3IgaGlnaGxpZ2h0aW5nIGZhaWxzIG9uIGxpbmUgd2l0aCBzZWxlY3RlZCB0ZXh0JywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHQnICAgICAgICAgICAgICAgICAgICBlbHNlIGlmICgkcyA9IDA4KSB0aGVuIFxcJ1xcXFxiXFwnJyxcblx0XHRcdGZhbHNlLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtcblx0XHRcdFx0Y3JlYXRlUGFydCgyMCwgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMjQsIDE1KSxcblx0XHRcdFx0Y3JlYXRlUGFydCgyNSwgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMjcsIDE1KSxcblx0XHRcdFx0Y3JlYXRlUGFydCgyOCwgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMjksIDEpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDI5LCAxKSxcblx0XHRcdFx0Y3JlYXRlUGFydCgzMSwgMTYpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDMyLCAxKSxcblx0XHRcdFx0Y3JlYXRlUGFydCgzMywgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMzQsIDEpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDM2LCA2KSxcblx0XHRcdFx0Y3JlYXRlUGFydCgzNiwgMSksXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMzcsIDEpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDM4LCAxKSxcblx0XHRcdFx0Y3JlYXRlUGFydCg0MiwgMTUpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDQzLCAxKSxcblx0XHRcdFx0Y3JlYXRlUGFydCg0NywgMTEpXG5cdFx0XHRdKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDExLFxuXHRcdFx0MTEsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdzZWxlY3Rpb24nLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdFtuZXcgTGluZVJhbmdlKDAsIDQ3KV1cblx0XHQpKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW5mbGF0ZVJlbmRlckxpbmVPdXRwdXQoYWN0dWFsKSwge1xuXHRcdFx0aHRtbDogW1xuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azE1XCI+ZWxzZTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMTVcIj5pZjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPig8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMTZcIj4kczwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMVwiPj08L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrelwiIHN0eWxlPVwid2lkdGg6MTBweFwiPlxcdTAwYjdcXHUyMDBjPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azZcIj4wODwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxXCI+KTwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGt6XCIgc3R5bGU9XCJ3aWR0aDoxMHB4XCI+XFx1MDBiN1xcdTIwMGM8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrMTVcIj50aGVuPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3pcIiBzdHlsZT1cIndpZHRoOjEwcHhcIj5cXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsxMVwiPlxcJ1xcXFxiXFwnPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sXG5cdFx0XHRcdFsxLCAwLCAxXSxcblx0XHRcdFx0WzIsIDAsIDJdLFxuXHRcdFx0XHRbMywgMCwgM10sXG5cdFx0XHRcdFs0LCAwLCA0XSxcblx0XHRcdFx0WzUsIDAsIDVdLFxuXHRcdFx0XHRbNiwgMCwgNl0sXG5cdFx0XHRcdFs3LCAwLCA3XSxcblx0XHRcdFx0WzgsIDAsIDhdLFxuXHRcdFx0XHRbOSwgMCwgOV0sXG5cdFx0XHRcdFsxMCwgMCwgMTBdLFxuXHRcdFx0XHRbMTEsIDAsIDExXSxcblx0XHRcdFx0WzEyLCAwLCAxMl0sXG5cdFx0XHRcdFsxMywgMCwgMTNdLFxuXHRcdFx0XHRbMTQsIDAsIDE0XSxcblx0XHRcdFx0WzE1LCAwLCAxNV0sXG5cdFx0XHRcdFsxNiwgMCwgMTZdLFxuXHRcdFx0XHRbMTcsIDAsIDE3XSxcblx0XHRcdFx0WzE4LCAwLCAxOF0sXG5cdFx0XHRcdFsxOSwgMCwgMTldLFxuXHRcdFx0XHRbMjAsIDAsIDIwXSwgWzIwLCAxLCAyMV0sIFsyMCwgMiwgMjJdLCBbMjAsIDMsIDIzXSxcblx0XHRcdFx0WzIxLCAwLCAyNF0sXG5cdFx0XHRcdFsyMiwgMCwgMjVdLCBbMjIsIDEsIDI2XSxcblx0XHRcdFx0WzIzLCAwLCAyN10sXG5cdFx0XHRcdFsyNCwgMCwgMjhdLFxuXHRcdFx0XHRbMjUsIDAsIDI5XSwgWzI1LCAxLCAzMF0sXG5cdFx0XHRcdFsyNiwgMCwgMzFdLFxuXHRcdFx0XHRbMjcsIDAsIDMyXSxcblx0XHRcdFx0WzI4LCAwLCAzM10sXG5cdFx0XHRcdFsyOSwgMCwgMzRdLCBbMjksIDEsIDM1XSxcblx0XHRcdFx0WzMwLCAwLCAzNl0sXG5cdFx0XHRcdFszMSwgMCwgMzddLFxuXHRcdFx0XHRbMzIsIDAsIDM4XSwgWzMyLCAxLCAzOV0sIFszMiwgMiwgNDBdLCBbMzIsIDMsIDQxXSxcblx0XHRcdFx0WzMzLCAwLCA0Ml0sXG5cdFx0XHRcdFszNCwgMCwgNDNdLCBbMzQsIDEsIDQ0XSwgWzM0LCAyLCA0NV0sIFszNCwgMywgNDZdLCBbMzQsIDQsIDQ3XVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE5NDE2OiBEZWxldGUgQ29udHJvbCBDaGFyYWN0ZXIgKFUrMDA3RiAvICYjMTI3OykgZGlzcGxheWVkIGFzIHNwYWNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0J1snICsgU3RyaW5nLmZyb21DaGFyQ29kZSgxMjcpICsgJ10gWycgKyBTdHJpbmcuZnJvbUNoYXJDb2RlKDApICsgJ10nLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNywgMyldKSxcblx0XHRcdFtdLFxuXHRcdFx0NCxcblx0XHRcdDAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMDAwMCxcblx0XHRcdCdub25lJyxcblx0XHRcdHRydWUsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj5bXFx1MjQyMV1cXHUwMGEwW1xcdTI0MDBdPC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE2OTM5OiBJbXBvcnRhbnQgY29udHJvbCBjaGFyYWN0ZXJzIGFyZW5cXCd0IHJlbmRlcmVkJywgKCkgPT4ge1xuXHRcdGNvbnN0IGFjdHVhbCA9IHJlbmRlclZpZXdMaW5lKG5ldyBSZW5kZXJMaW5lSW5wdXQoXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0YHRyYW5zZmVyQmFsYW5jZSg1Njc4LCR7U3RyaW5nLmZyb21DaGFyQ29kZSgweDIwMkUpfTY3NzYsNDMyMSR7U3RyaW5nLmZyb21DaGFyQ29kZSgweDIwMkMpfSxcIlVTRFwiKTtgLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0MCxcblx0XHRcdGNyZWF0ZVZpZXdMaW5lVG9rZW5zKFtjcmVhdGVQYXJ0KDQyLCAzKV0pLFxuXHRcdFx0W10sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J25vbmUnLFxuXHRcdFx0dHJ1ZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj50cmFuc2ZlckJhbGFuY2UoNTY3OCw8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrY29udHJvbFwiPltVKzIwMkVdPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj42Nzc2LDQzMjE8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwibXRrY29udHJvbFwiPltVKzIwMkNdPC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10azNcIj4sXCJVU0RcIik7PC9zcGFuPicsXG5cdFx0XHRdLFxuXHRcdFx0bWFwcGluZzogW1xuXHRcdFx0XHRbMCwgMCwgMF0sIFswLCAxLCAxXSwgWzAsIDIsIDJdLCBbMCwgMywgM10sIFswLCA0LCA0XSwgWzAsIDUsIDVdLCBbMCwgNiwgNl0sIFswLCA3LCA3XSxcblx0XHRcdFx0WzAsIDgsIDhdLCBbMCwgOSwgOV0sIFswLCAxMCwgMTBdLCBbMCwgMTEsIDExXSwgWzAsIDEyLCAxMl0sIFswLCAxMywgMTNdLCBbMCwgMTQsIDE0XSxcblx0XHRcdFx0WzAsIDE1LCAxNV0sIFswLCAxNiwgMTZdLCBbMCwgMTcsIDE3XSwgWzAsIDE4LCAxOF0sIFswLCAxOSwgMTldLCBbMCwgMjAsIDIwXSxcblx0XHRcdFx0WzEsIDAsIDIxXSxcblx0XHRcdFx0WzIsIDAsIDI5XSwgWzIsIDEsIDMwXSwgWzIsIDIsIDMxXSwgWzIsIDMsIDMyXSwgWzIsIDQsIDMzXSwgWzIsIDUsIDM0XSwgWzIsIDYsIDM1XSxcblx0XHRcdFx0WzIsIDcsIDM2XSwgWzIsIDgsIDM3XSxcblx0XHRcdFx0WzMsIDAsIDM4XSxcblx0XHRcdFx0WzQsIDAsIDQ2XSwgWzQsIDEsIDQ3XSwgWzQsIDIsIDQ4XSwgWzQsIDMsIDQ5XSwgWzQsIDQsIDUwXSwgWzQsIDUsIDUxXSwgWzQsIDYsIDUyXSwgWzQsIDcsIDUzXSwgWzQsIDgsIDU0XVxuXHRcdFx0XVxuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTI0MDM4OiBNdWx0aXBsZSBlbmQtb2YtbGluZSB0ZXh0IGRlY29yYXRpb25zIGdldCBtZXJnZWQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgYWN0dWFsID0gcmVuZGVyVmlld0xpbmUobmV3IFJlbmRlckxpbmVJbnB1dChcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdCcgICAgaWYnLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHQwLFxuXHRcdFx0Y3JlYXRlVmlld0xpbmVUb2tlbnMoW2NyZWF0ZVBhcnQoNCwgMSksIGNyZWF0ZVBhcnQoNiwgMildKSxcblx0XHRcdFtcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDcsIDcsICdjZWQtMS1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTE3YzE0ZDk4LTMgY2VkLTEtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi0zJywgSW5saW5lRGVjb3JhdGlvblR5cGUuQmVmb3JlKSxcblx0XHRcdFx0bmV3IExpbmVEZWNvcmF0aW9uKDcsIDcsICdjZWQtMS1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTE3YzE0ZDk4LTQgY2VkLTEtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi00JywgSW5saW5lRGVjb3JhdGlvblR5cGUuQWZ0ZXIpLFxuXHRcdFx0XHRuZXcgTGluZURlY29yYXRpb24oNywgNywgJ2NlZC1naG9zdC10ZXh0LTEtNCcsIElubGluZURlY29yYXRpb25UeXBlLkFmdGVyKSxcblx0XHRcdF0sXG5cdFx0XHQ0LFxuXHRcdFx0MCxcblx0XHRcdDEwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwMDAwLFxuXHRcdFx0J2FsbCcsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbmZsYXRlUmVuZGVyTGluZU91dHB1dChhY3R1YWwpLCB7XG5cdFx0XHRodG1sOiBbXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cIm10a3dcIj5cXHUwMGI3XFx1MjAwY1xcdTAwYjdcXHUyMDBjXFx1MDBiN1xcdTIwMGNcXHUwMGI3XFx1MjAwYzwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJtdGsyXCI+aWY8L3NwYW4+Jyxcblx0XHRcdFx0JzxzcGFuIGNsYXNzPVwiY2VkLTEtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi0xN2MxNGQ5OC0zIGNlZC0xLVRleHRFZGl0b3JEZWNvcmF0aW9uVHlwZTItM1wiPjwvc3Bhbj4nLFxuXHRcdFx0XHQnPHNwYW4gY2xhc3M9XCJjZWQtMS1UZXh0RWRpdG9yRGVjb3JhdGlvblR5cGUyLTE3YzE0ZDk4LTQgY2VkLTEtVGV4dEVkaXRvckRlY29yYXRpb25UeXBlMi00XCI+PC9zcGFuPicsXG5cdFx0XHRcdCc8c3BhbiBjbGFzcz1cImNlZC1naG9zdC10ZXh0LTEtNFwiPjwvc3Bhbj4nLFxuXHRcdFx0XSxcblx0XHRcdG1hcHBpbmc6IFtcblx0XHRcdFx0WzAsIDAsIDBdLCBbMCwgMiwgMV0sIFswLCA0LCAyXSwgWzAsIDYsIDNdLFxuXHRcdFx0XHRbMSwgMCwgNF0sIFsxLCAxLCA1XSxcblx0XHRcdFx0WzMsIDAsIDZdXG5cdFx0XHRdXG5cdFx0fSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIGNyZWF0ZVRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KGxpbmVDb250ZW50OiBzdHJpbmcsIHRhYlNpemU6IG51bWJlciwgcGFydHM6IFRlc3RMaW5lVG9rZW5bXSwgZXhwZWN0ZWRQYXJ0TGVuZ3RoczogbnVtYmVyW10pOiAocGFydEluZGV4OiBudW1iZXIsIHBhcnRMZW5ndGg6IG51bWJlciwgb2Zmc2V0OiBudW1iZXIsIGV4cGVjdGVkOiBudW1iZXIpID0+IHZvaWQge1xuXHRcdGNvbnN0IHJlbmRlckxpbmVPdXRwdXQgPSByZW5kZXJWaWV3TGluZShuZXcgUmVuZGVyTGluZUlucHV0KFxuXHRcdFx0ZmFsc2UsXG5cdFx0XHR0cnVlLFxuXHRcdFx0bGluZUNvbnRlbnQsXG5cdFx0XHRmYWxzZSxcblx0XHRcdHRydWUsXG5cdFx0XHRmYWxzZSxcblx0XHRcdDAsXG5cdFx0XHRjcmVhdGVWaWV3TGluZVRva2VucyhwYXJ0cyksXG5cdFx0XHRbXSxcblx0XHRcdHRhYlNpemUsXG5cdFx0XHQwLFxuXHRcdFx0MTAsXG5cdFx0XHQxMCxcblx0XHRcdDEwLFxuXHRcdFx0LTEsXG5cdFx0XHQnbm9uZScsXG5cdFx0XHRmYWxzZSxcblx0XHRcdGZhbHNlLFxuXHRcdFx0bnVsbFxuXHRcdCkpO1xuXG5cdFx0cmV0dXJuIChwYXJ0SW5kZXg6IG51bWJlciwgcGFydExlbmd0aDogbnVtYmVyLCBvZmZzZXQ6IG51bWJlciwgZXhwZWN0ZWQ6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgYWN0dWFsQ29sdW1uID0gcmVuZGVyTGluZU91dHB1dC5jaGFyYWN0ZXJNYXBwaW5nLmdldENvbHVtbihuZXcgRG9tUG9zaXRpb24ocGFydEluZGV4LCBvZmZzZXQpLCBwYXJ0TGVuZ3RoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxDb2x1bW4sIGV4cGVjdGVkLCAnZ2V0Q29sdW1uIGZvciAnICsgcGFydEluZGV4ICsgJywgJyArIG9mZnNldCk7XG5cdFx0fTtcblx0fVxuXG5cdHRlc3QoJ2dldENvbHVtbk9mTGluZVBhcnRPZmZzZXQgMSAtIHNpbXBsZSB0ZXh0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0ID0gY3JlYXRlVGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoXG5cdFx0XHQnaGVsbG8gd29ybGQnLFxuXHRcdFx0NCxcblx0XHRcdFtcblx0XHRcdFx0Y3JlYXRlUGFydCgxMSwgMSlcblx0XHRcdF0sXG5cdFx0XHRbMTFdXG5cdFx0KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCAxMSwgMCwgMSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgMTEsIDEsIDIpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDExLCAyLCAzKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCAxMSwgMywgNCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgMTEsIDQsIDUpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDExLCA1LCA2KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCAxMSwgNiwgNyk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgMTEsIDcsIDgpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDExLCA4LCA5KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCAxMSwgOSwgMTApO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDExLCAxMCwgMTEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDExLCAxMSwgMTIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0IDIgLSByZWd1bGFyIEpTJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0ID0gY3JlYXRlVGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoXG5cdFx0XHQndmFyIHggPSAzOycsXG5cdFx0XHQ0LFxuXHRcdFx0W1xuXHRcdFx0XHRjcmVhdGVQYXJ0KDMsIDEpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDQsIDIpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDUsIDMpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDgsIDQpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDksIDUpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDEwLCA2KSxcblx0XHRcdF0sXG5cdFx0XHRbMywgMSwgMSwgMywgMSwgMV1cblx0XHQpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDMsIDAsIDEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDMsIDEsIDIpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDMsIDIsIDMpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDMsIDMsIDQpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDEsIDEsIDAsIDQpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDEsIDEsIDEsIDUpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDIsIDEsIDAsIDUpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDIsIDEsIDEsIDYpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDMsIDMsIDAsIDYpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDMsIDMsIDEsIDcpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDMsIDMsIDIsIDgpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDMsIDMsIDMsIDkpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDQsIDEsIDAsIDkpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDQsIDEsIDEsIDEwKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCg1LCAxLCAwLCAxMCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoNSwgMSwgMSwgMTEpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0IDMgLSB0YWIgd2l0aCB0YWIgc2l6ZSA2JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0ID0gY3JlYXRlVGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoXG5cdFx0XHQnXFx0Jyxcblx0XHRcdDYsXG5cdFx0XHRbXG5cdFx0XHRcdGNyZWF0ZVBhcnQoMSwgMSlcblx0XHRcdF0sXG5cdFx0XHRbNl1cblx0XHQpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDAsIDEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDEsIDEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDIsIDEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDMsIDEpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDQsIDIpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDUsIDIpO1xuXHRcdHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0KDAsIDYsIDYsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0IDQgLSBvbmNlIGluZGVudGVkIGxpbmUsIHRhYiBzaXplIDQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQgPSBjcmVhdGVUZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldChcblx0XHRcdCdcXHRmdW5jdGlvbicsXG5cdFx0XHQ0LFxuXHRcdFx0W1xuXHRcdFx0XHRjcmVhdGVQYXJ0KDEsIDEpLFxuXHRcdFx0XHRjcmVhdGVQYXJ0KDksIDIpLFxuXHRcdFx0XSxcblx0XHRcdFs0LCA4XVxuXHRcdCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgNCwgMCwgMSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgNCwgMSwgMSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgNCwgMiwgMSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgNCwgMywgMik7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMCwgNCwgNCwgMik7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgMCwgMik7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgMSwgMyk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgMiwgNCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgMywgNSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgNCwgNik7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgNSwgNyk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgNiwgOCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgNywgOSk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgOCwgMTApO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0IDUgLSB0d2ljZSBpbmRlbnRlZCBsaW5lLCB0YWIgc2l6ZSA0JywgKCkgPT4ge1xuXHRcdGNvbnN0IHRlc3RHZXRDb2x1bW5PZkxpbmVQYXJ0T2Zmc2V0ID0gY3JlYXRlVGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoXG5cdFx0XHQnXFx0XFx0ZnVuY3Rpb24nLFxuXHRcdFx0NCxcblx0XHRcdFtcblx0XHRcdFx0Y3JlYXRlUGFydCgyLCAxKSxcblx0XHRcdFx0Y3JlYXRlUGFydCgxMCwgMiksXG5cdFx0XHRdLFxuXHRcdFx0WzgsIDhdXG5cdFx0KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCAwLCAxKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCAxLCAxKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCAyLCAxKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCAzLCAyKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCA0LCAyKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCA1LCAyKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCA2LCAyKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCA3LCAzKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgwLCA4LCA4LCAzKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCAwLCAzKTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCAxLCA0KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCAyLCA1KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCAzLCA2KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCA0LCA3KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCA1LCA4KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCA2LCA5KTtcblx0XHR0ZXN0R2V0Q29sdW1uT2ZMaW5lUGFydE9mZnNldCgxLCA4LCA3LCAxMCk7XG5cdFx0dGVzdEdldENvbHVtbk9mTGluZVBhcnRPZmZzZXQoMSwgOCwgOCwgMTEpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0JBQWdCO0FBQ3pCLFlBQVksYUFBYTtBQUN6QixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLHNCQUFzQjtBQUMvQixTQUEyQixhQUFhLFdBQVcsaUJBQW9DLG1CQUFtQixzQkFBc0I7QUFDaEksU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxlQUFlLHNCQUFzQjtBQUU5QyxTQUFTLHFCQUFxQixnQkFBa0Q7QUFDL0UsU0FBTyxJQUFJLGVBQWUsY0FBYztBQUN6QztBQUVBLFNBQVMsV0FBVyxVQUFrQixZQUFtQztBQUN4RSxTQUFPLElBQUksY0FBYyxVQUN4QixjQUFjLGVBQWUsc0JBQ3hCLENBQUM7QUFDUjtBQUVBLFNBQVMsd0JBQXdCLGtCQUFxQztBQUVyRSxNQUFJLE9BQU8saUJBQWlCO0FBQzVCLE1BQUksS0FBSyxXQUFXLFFBQVEs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QSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN6QyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDbkUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ3pELENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNULENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUM3QyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDcEMsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLElBQUksRUFBRTtBQUFBLFFBQ3JNLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUN2QixDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsTUFDbEQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLDRDQUE0QyxNQUFNO0FBQ3RELFVBQU0sV0FBVztBQUNqQixVQUFNLFlBQVkscUJBQXFCO0FBQUEsTUFDdEMsV0FBVyxHQUFHLENBQUM7QUFBQTtBQUFBLE1BQ2YsV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksRUFBRTtBQUFBO0FBQUEsSUFDbEIsQ0FBQztBQUNELFVBQU0sVUFBVSxlQUFlLElBQUk7QUFBQSxNQUNsQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE9BQU8sR0FBRztBQUFBLE1BQ3hELE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzlCLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUMvSSxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEUsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BRLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNyQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDdlAsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLE1BQ3RCO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyw0Q0FBNEMsTUFBTTtBQUN0RCxVQUFNLFdBQVc7QUFFakIsVUFBTSxZQUFZLHFCQUFxQjtBQUFBLE1BQ3RDLFdBQVcsR0FBRyxDQUFDO0FBQUE7QUFBQSxNQUNmLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQTtBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUE7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBO0FBQUEsTUFDaEIsV0FBVyxJQUFJLEVBQUU7QUFBQTtBQUFBLElBQ2xCLENBQUM7QUFDRCxVQUFNLFVBQVUsZUFBZSxJQUFJO0FBQUEsTUFDbEM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxDQUFDO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU8sZ0JBQWdCLHdCQUF3QixPQUFPLEdBQUc7QUFBQSxNQUN4RCxNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUN6QyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDL0ksQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hFLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNoUixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDckIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3ZQLENBQUMsR0FB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LENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUM5QixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDOUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BxQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsTUFDdEI7QUFBQSxJQUNELENBQUU7QUFDRixXQUFPLFlBQVksUUFBUSxhQUFhLElBQUk7QUFBQSxFQUM3QyxDQUFDO0FBRUQsT0FBSyw0REFBNEQsTUFBTTtBQUN0RSxVQUFNLFdBQVc7QUFDakIsVUFBTSxZQUFZLHFCQUFxQjtBQUFBLE1BQ3RDLFdBQVcsR0FBRyxDQUFDO0FBQUEsTUFDZixXQUFXLEdBQUcsQ0FBQztBQUFBLE1BQ2YsV0FBVyxHQUFHLENBQUM7QUFBQSxNQUNmLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxJQUNqQixDQUFDO0FBQ0QsVUFBTSxVQUFVLGVBQWUsSUFBSTtBQUFBLE1BQ2xDO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLGdCQUFnQix3QkFBd0IsT0FBTyxHQUFJO0FBQUEsTUFDekQsTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUMvRCxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDdkQsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ3pHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNULENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNqRixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDckIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ3JFLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxNQUN4QjtBQUFBLElBQ0QsQ0FBRTtBQUNGLFdBQU8sWUFBWSxRQUFRLGFBQWEsSUFBSTtBQUFBLEVBQzdDLENBQUM7QUFFRCxPQUFLLDZEQUE2RCxNQUFNO0FBQ3ZFLFVBQU0sV0FBVztBQUNqQixVQUFNLFlBQVkscUJBQXFCO0FBQUEsTUFDdEMsV0FBVyxHQUFHLENBQUM7QUFBQSxNQUNmLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsSUFDakIsQ0FBQztBQUNELFVBQU0sVUFBVSxlQUFlLElBQUk7QUFBQSxNQUNsQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE9BQU8sR0FBSTtBQUFBLE1BQ3pELE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3pDLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxR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UUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDckYsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxNQUNyQztBQUFBLElBQ0QsQ0FBRTtBQUFBLEVBQ0gsQ0FBQztBQUVELE9BQUssNkRBQTZELE1BQU07QUFDdkUsVUFBTSxXQUFXO0FBQ2pCLFVBQU0sWUFBWSxxQkFBcUI7QUFBQSxNQUN0QyxXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsTUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNoQixXQUFXLElBQUksQ0FBQztBQUFBLE1BQ2hCLFdBQVcsSUFBSSxDQUFDO0FBQUEsSUFDakIsQ0FBQztBQUNELFVBQU0sVUFBVSxlQUFlLElBQUk7QUFBQSxNQUNsQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE9BQU8sR0FBSTtBQUFBLE1BQ3pELE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDekMsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3RKLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNULENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNyRSxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDckIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFH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QUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwZCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDcFEsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ3JCLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxNQUNuSTtBQUFBLElBQ0QsQ0FBRTtBQUFBLEVBQ0gsQ0FBQztBQUVELE9BQUssMEJBQTBCLE1BQU07QUFDcEMsV0FBTztBQUFBLE1BQ047QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVcsSUFBSSxDQUFDO0FBQUEsUUFDakI7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLFFBQ0MsTUFBTTtBQUFBLFVBQ0w7QUFBQSxRQUNEO0FBQUEsUUFDQSxTQUFTO0FBQUEsVUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDbko7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUNBQXFDLE1BQU07QUFDL0MsV0FBTztBQUFBLE1BQ047QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVcsR0FBRyxDQUFDO0FBQUEsVUFDZixXQUFXLElBQUksQ0FBQztBQUFBLFFBQ2pCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxVQUNMO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUMvRCxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDOUU7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssd0RBQXdELE1BQU07QUFDbEUsV0FBTztBQUFBLE1BQ047QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVcsR0FBRyxDQUFDO0FBQUEsVUFDZixXQUFXLEdBQUcsQ0FBQztBQUFBLFVBQ2YsV0FBVyxJQUFJLENBQUM7QUFBQSxRQUNqQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsVUFDTDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUN6QyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDbkIsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQ2pILENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUMxRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyx3REFBd0QsTUFBTTtBQUNsRSxXQUFPO0FBQUEsTUFDTjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFVBQ0MsV0FBVyxHQUFHLENBQUM7QUFBQSxVQUNmLFdBQVcsSUFBSSxDQUFDO0FBQUEsVUFDaEIsV0FBVyxJQUFJLENBQUM7QUFBQSxRQUNqQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsVUFDTDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsUUFDRDtBQUFBLFFBQ0EsU0FBUztBQUFBLFVBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ3pDLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUN6QyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDbkIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQ3JILENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUM3QyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDMUQ7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssc0RBQXNELE1BQU07QUFDaEUsV0FBTztBQUFBLE1BQ047QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVcsR0FBRyxDQUFDO0FBQUEsVUFDZixXQUFXLEdBQUcsQ0FBQztBQUFBLFVBQ2YsV0FBVyxJQUFJLENBQUM7QUFBQSxRQUNqQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsVUFDTDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsUUFDQSxTQUFTO0FBQUEsVUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDbkIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdB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LFVBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQ25CLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNuQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFDckIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQ3JILENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUNyQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFDakMsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQzdDLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUMxRDtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSywyREFBMkQsTUFBTTtBQUNyRSxXQUFPO0FBQUEsTUFDTjtBQUFBLFFBQ0M7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFVBQ0MsV0FBVyxHQUFHLENBQUM7QUFBQSxVQUNmLFdBQVcsR0FBRyxDQUFDO0FBQUEsVUFDZixXQUFXLElBQUksQ0FBQztBQUFBLFFBQ2pCO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxRQUNDLE1BQU07QUFBQSxVQUNMO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNuQixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDbkIsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFVBQ3JCLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxVQUNySCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsVUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDOUs7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUsscUVBQXFFLE1BQU07QUFDL0UsV0FBTztBQUFBLE1BQ047QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVcsR0FBRyxDQUFDO0FBQUEsVUFDZixXQUFXLEdBQUcsQ0FBQztBQUFBLFVBQ2YsV0FBVyxJQUFJLENBQUM7QUFBQSxRQUNqQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsUUFDQyxNQUFNO0FBQUEsVUFDTDtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUNuQixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsVUFDbkIsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFVBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztB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U0FBUyxlQUFlLElBQUk7QUFBQSxNQUNqQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EscUJBQXFCLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDeEMsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLGdCQUFnQix3QkFBd0IsTUFBTSxHQUFHO0FBQUEsTUFDdkQsTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDOUIsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQzlCLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNyQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsTUFDMUQ7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlEQUFpRCxNQUFNO0FBRTNELFVBQU0sU0FBUyxlQUFlLElBQUk7QUFBQSxNQUNqQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EscUJBQXFCLENBQUMsV0FBVyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDeEMsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLGdCQUFnQix3QkFBd0IsTUFBTSxHQUFHO0FBQUEsTUFDdkQsTUFBTTtBQUFBLFFBQ0w7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDckYsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLE1BQ2xEO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxvRUFBb0UsTUFBTTtBQUU5RSxVQUFNLFNBQVMsZUFBZSxJQUFJO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLHFCQUFxQixDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ3pDLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE1BQU0sR0FBRztBQUFBLE1BQ3ZELE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDckYsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDcEMsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQzdGLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNuRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDckcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3JHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNyRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDM0UsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRztBQUFBLE1BQzNHO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxrRUFBa0UsTUFBTTtBQUU1RSxVQUFNLFNBQVMsZUFBZSxJQUFJO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLHFCQUFxQixDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ3pDLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE1BQU0sR0FBRztBQUFBLE1BQ3ZELE1BQU07QUFBQSxRQUNMO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxDQUFDO0FBQUEsUUFDckYsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3BGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ1YsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQzdGLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN0RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQ3pGLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxNQUNoRTtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssZ0hBQWdILE1BQU07QUFDMUgsVUFBTSxTQUFTLGVBQWUsSUFBSTtBQUFBLE1BQ2pDO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQSxxQkFBcUIsQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLENBQUM7QUFBQSxNQUN4QyxDQUFDO0FBQUEsTUFDRDtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLElBQ0QsQ0FBQztBQUVELFdBQU8sZ0JBQWdCLHdCQUF3QixNQUFNLEdBQUc7QUFBQSxNQUN2RCxNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3JGLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwRixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUM3RixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsTUFDdEI7QUFBQSxJQUNELENBQUM7QUFBQSxFQUNGLENBQUM7QUFFRCxPQUFLLGlGQUFpRixNQUFNO0FBQzNGLFVBQU0sU0FBUyxlQUFlLElBQUk7QUFBQSxNQUNqQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0EscUJBQXFCLENBQUMsV0FBVyxLQUFLLENBQUMsQ0FBQyxDQUFDO0FBQUEsTUFDekMsQ0FBQztBQUFBLE1BQ0Q7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELENBQUM7QUFFRCxXQUFPLGdCQUFnQix3QkFBd0IsTUFBTSxHQUFHO0FBQUEsTUFDdkQsTUFBTTtBQUFBLFFBQ0w7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3JGLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwRixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3ZCLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNqRixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDckYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwQyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDakYsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQzNFLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUNqRixDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFDakYsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQ2pGLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUNqRixDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFDakYsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQ3pCLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEdBQUc7QUFBQSxRQUN4RixDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFDNUYsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQy9GLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUMvRixDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxHQUFHO0FBQUEsUUFDL0YsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQy9GLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxRQUN2QyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxHQUFHO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLEdBQUcsR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksR0FBRztBQUFBLFFBQzVGLENBQUMsR0FBRyxJQUFJLEdBQUc7QUFBQSxNQUNaO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsT0FBSyxnR0FBZ0csTUFBTTtBQUMxRyxVQUFNLFNBQVMsZUFBZSxJQUFJO0FBQUEsTUFDakM7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBLHFCQUFxQixDQUFDLFdBQVcsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUFBLE1BQ3pDLENBQUM7QUFBQSxNQUNEO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsSUFDRCxDQUFDO0FBRUQsV0FBTyxnQkFBZ0Isd0JBQXdCLE1BQU0sR0FBRztBQUFBLE1BQ3ZELE1BQU07QUFBQSxRQUNMO0FBQUEsTUFDRDtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1IsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3JGLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwRixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDeEYsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLElBQUksRUFBRTtBQUFBLFFBQ3hGLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUN4RixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFDckYsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQ3ZGLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUN2RixDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFDdkYsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQ3ZGLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsR0FBRyxLQUFLLEdBQUc7QUFBQSxRQUN2RixDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEdBQUcsS0FBSyxHQUFHO0FBQUEsUUFDdkYsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFBQUcsQ0FBQyxHQUFHLEtBQUssR0FBRztBQUFBLFFB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RyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUNSLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNqRCxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDVixDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLElBQUksR0FBRyxFQUFFO0FBQUEsUUFDdkIsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ1YsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ1YsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxJQUFJLEdBQUcsRUFBRTtBQUFBLFFBQ3ZCLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMsSUFBSSxHQUFHLEVBQUU7QUFBQSxRQUNWLENBQUMs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QyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQztBQUFBLFFBQ3JGLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLENBQUM7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxJQUFJLEVBQUU7QUFBQSxRQUNwRixDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsSUFBSSxFQUFFO0FBQUEsUUFDM0UsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ1QsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQUcsQ0FBQyxHQUFHLEdBQUcsRUFBRTtBQUFBLFFBQ2pGLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUFHLENBQUMsR0FBRyxHQUFHLEVBQUU7QUFBQSxRQUNyQixDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFDVCxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFBRyxDQUFDLEdBQUcsR0FBRyxFQUFFO0FBQUEsUUFB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QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQ3hDLGtDQUE4QixHQUFHLEdBQUcsR0FBRyxFQUFFO0FBQUEsRUFDMUMsQ0FBQztBQUVELE9BQUssaUVBQWlFLE1BQU07QUFDM0UsVUFBTSxnQ0FBZ0M7QUFBQSxNQUNyQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsUUFDQyxXQUFXLEdBQUcsQ0FBQztBQUFBLFFBQ2YsV0FBVyxJQUFJLENBQUM7QUFBQSxNQUNqQjtBQUFBLE1BQ0EsQ0FBQyxHQUFHLENBQUM7QUFBQSxJQUNOO0FBQ0Esa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFDeEMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFDekMsa0NBQThCLEdBQUcsR0FBRyxHQUFHLEVBQUU7QUFBQSxFQUMxQyxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
