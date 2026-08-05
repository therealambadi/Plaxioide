import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { EditorOption } from "../../../common/config/editorOptions.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import * as languages from "../../../common/languages.js";
import { NullState } from "../../../common/languages/nullTokenize.js";
import { ModelLineProjectionData } from "../../../common/modelLineProjectionData.js";
import { createModelLineProjection } from "../../../common/viewModel/modelLineProjection.js";
import { MonospaceLineBreaksComputerFactory } from "../../../common/viewModel/monospaceLineBreaksComputer.js";
import { ViewModelLinesFromProjectedModel } from "../../../common/viewModel/viewModelLines.js";
import { TestConfiguration } from "../config/testConfiguration.js";
import { createTextModel } from "../../common/testTextModel.js";
suite("Editor ViewModel - SplitLinesCollection", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("SplitLine", () => {
    let model1 = createModel("My First LineMy Second LineAnd another one");
    let line1 = createSplitLine([13, 14, 15], [13, 13 + 14, 13 + 14 + 15], 0);
    assert.strictEqual(line1.getViewLineCount(), 3);
    assert.strictEqual(line1.getViewLineContent(model1, 1, 0), "My First Line");
    assert.strictEqual(line1.getViewLineContent(model1, 1, 1), "My Second Line");
    assert.strictEqual(line1.getViewLineContent(model1, 1, 2), "And another one");
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 0), 14);
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 1), 15);
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 2), 16);
    for (let col = 1; col <= 14; col++) {
      assert.strictEqual(line1.getModelColumnOfViewPosition(0, col), col, "getInputColumnOfOutputPosition(0, " + col + ")");
    }
    for (let col = 1; col <= 15; col++) {
      assert.strictEqual(line1.getModelColumnOfViewPosition(1, col), 13 + col, "getInputColumnOfOutputPosition(1, " + col + ")");
    }
    for (let col = 1; col <= 16; col++) {
      assert.strictEqual(line1.getModelColumnOfViewPosition(2, col), 13 + 14 + col, "getInputColumnOfOutputPosition(2, " + col + ")");
    }
    for (let col = 1; col <= 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(0, col), "getOutputPositionOfInputPosition(" + col + ")");
    }
    for (let col = 1 + 13; col <= 14 + 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(1, col - 13), "getOutputPositionOfInputPosition(" + col + ")");
    }
    for (let col = 1 + 13 + 14; col <= 15 + 14 + 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(2, col - 13 - 14), "getOutputPositionOfInputPosition(" + col + ")");
    }
    model1 = createModel("My First LineMy Second LineAnd another one");
    line1 = createSplitLine([13, 14, 15], [13, 13 + 14, 13 + 14 + 15], 4);
    assert.strictEqual(line1.getViewLineCount(), 3);
    assert.strictEqual(line1.getViewLineContent(model1, 1, 0), "My First Line");
    assert.strictEqual(line1.getViewLineContent(model1, 1, 1), "    My Second Line");
    assert.strictEqual(line1.getViewLineContent(model1, 1, 2), "    And another one");
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 0), 14);
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 1), 19);
    assert.strictEqual(line1.getViewLineMaxColumn(model1, 1, 2), 20);
    const actualViewColumnMapping = [];
    for (let lineIndex = 0; lineIndex < line1.getViewLineCount(); lineIndex++) {
      const actualLineViewColumnMapping = [];
      for (let col = 1; col <= line1.getViewLineMaxColumn(model1, 1, lineIndex); col++) {
        actualLineViewColumnMapping.push(line1.getModelColumnOfViewPosition(lineIndex, col));
      }
      actualViewColumnMapping.push(actualLineViewColumnMapping);
    }
    assert.deepStrictEqual(actualViewColumnMapping, [
      [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14],
      [14, 14, 14, 14, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28],
      [28, 28, 28, 28, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43]
    ]);
    for (let col = 1; col <= 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(0, col), "6.getOutputPositionOfInputPosition(" + col + ")");
    }
    for (let col = 1 + 13; col <= 14 + 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(1, 4 + col - 13), "7.getOutputPositionOfInputPosition(" + col + ")");
    }
    for (let col = 1 + 13 + 14; col <= 15 + 14 + 13; col++) {
      assert.deepStrictEqual(line1.getViewPositionOfModelPosition(0, col), pos(2, 4 + col - 13 - 14), "8.getOutputPositionOfInputPosition(" + col + ")");
    }
  });
  function withSplitLinesCollection(text, callback) {
    const config = new TestConfiguration({});
    const wrappingInfo = config.options.get(EditorOption.wrappingInfo);
    const fontInfo = config.options.get(EditorOption.fontInfo);
    const wordWrapBreakAfterCharacters = config.options.get(EditorOption.wordWrapBreakAfterCharacters);
    const wordWrapBreakBeforeCharacters = config.options.get(EditorOption.wordWrapBreakBeforeCharacters);
    const wrappingIndent = config.options.get(EditorOption.wrappingIndent);
    const wordBreak = config.options.get(EditorOption.wordBreak);
    const lineBreaksComputerFactory = new MonospaceLineBreaksComputerFactory(wordWrapBreakBeforeCharacters, wordWrapBreakAfterCharacters);
    const model = createTextModel([
      "int main() {",
      '	printf("Hello world!");',
      "}",
      "int main() {",
      '	printf("Hello world!");',
      "}"
    ].join("\n"));
    const linesCollection = new ViewModelLinesFromProjectedModel(
      1,
      model,
      lineBreaksComputerFactory,
      lineBreaksComputerFactory,
      fontInfo,
      model.getOptions().tabSize,
      "simple",
      wrappingInfo.wrappingColumn,
      wrappingIndent,
      wordBreak
    );
    callback(model, linesCollection);
    linesCollection.dispose();
    model.dispose();
    config.dispose();
  }
  test("Invalid line numbers", () => {
    const text = [
      "int main() {",
      '	printf("Hello world!");',
      "}",
      "int main() {",
      '	printf("Hello world!");',
      "}"
    ].join("\n");
    withSplitLinesCollection(text, (model, linesCollection) => {
      assert.strictEqual(linesCollection.getViewLineCount(), 6);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(-1, -1), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(0, 0), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(1, 1), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(2, 2), [1]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(3, 3), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(4, 4), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(5, 5), [1]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(6, 6), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(7, 7), [0]);
      assert.deepStrictEqual(linesCollection.getViewLinesIndentGuides(0, 7), [0, 1, 0, 0, 1, 0]);
      assert.strictEqual(linesCollection.getViewLineContent(-1), "int main() {");
      assert.strictEqual(linesCollection.getViewLineContent(0), "int main() {");
      assert.strictEqual(linesCollection.getViewLineContent(1), "int main() {");
      assert.strictEqual(linesCollection.getViewLineContent(2), '	printf("Hello world!");');
      assert.strictEqual(linesCollection.getViewLineContent(3), "}");
      assert.strictEqual(linesCollection.getViewLineContent(4), "int main() {");
      assert.strictEqual(linesCollection.getViewLineContent(5), '	printf("Hello world!");');
      assert.strictEqual(linesCollection.getViewLineContent(6), "}");
      assert.strictEqual(linesCollection.getViewLineContent(7), "}");
      assert.strictEqual(linesCollection.getViewLineMinColumn(-1), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(0), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(1), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(2), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(3), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(4), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(5), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(6), 1);
      assert.strictEqual(linesCollection.getViewLineMinColumn(7), 1);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(-1), 13);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(0), 13);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(1), 13);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(2), 25);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(3), 2);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(4), 13);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(5), 25);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(6), 2);
      assert.strictEqual(linesCollection.getViewLineMaxColumn(7), 2);
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(-1, 1), new Position(1, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(0, 1), new Position(1, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(1, 1), new Position(1, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(2, 1), new Position(2, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(3, 1), new Position(3, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(4, 1), new Position(4, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(5, 1), new Position(5, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(6, 1), new Position(6, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(7, 1), new Position(6, 1));
      assert.deepStrictEqual(linesCollection.convertViewPositionToModelPosition(8, 1), new Position(6, 1));
    });
  });
  test("issue #3662", () => {
    const text = [
      "int main() {",
      '	printf("Hello world!");',
      "}",
      "int main() {",
      '	printf("Hello world!");',
      "}"
    ].join("\n");
    withSplitLinesCollection(text, (model, linesCollection) => {
      linesCollection.setHiddenAreas([
        new Range(1, 1, 3, 1),
        new Range(5, 1, 6, 1)
      ]);
      const viewLineCount = linesCollection.getViewLineCount();
      assert.strictEqual(viewLineCount, 1, "getOutputLineCount()");
      const modelLineCount = model.getLineCount();
      for (let lineNumber = 0; lineNumber <= modelLineCount + 1; lineNumber++) {
        const lineMinColumn = lineNumber >= 1 && lineNumber <= modelLineCount ? model.getLineMinColumn(lineNumber) : 1;
        const lineMaxColumn = lineNumber >= 1 && lineNumber <= modelLineCount ? model.getLineMaxColumn(lineNumber) : 1;
        for (let column = lineMinColumn - 1; column <= lineMaxColumn + 1; column++) {
          const viewPosition = linesCollection.convertModelPositionToViewPosition(lineNumber, column);
          let viewLineNumber = viewPosition.lineNumber;
          let viewColumn = viewPosition.column;
          if (viewLineNumber < 1) {
            viewLineNumber = 1;
          }
          const lineCount = linesCollection.getViewLineCount();
          if (viewLineNumber > lineCount) {
            viewLineNumber = lineCount;
          }
          const viewMinColumn = linesCollection.getViewLineMinColumn(viewLineNumber);
          const viewMaxColumn = linesCollection.getViewLineMaxColumn(viewLineNumber);
          if (viewColumn < viewMinColumn) {
            viewColumn = viewMinColumn;
          }
          if (viewColumn > viewMaxColumn) {
            viewColumn = viewMaxColumn;
          }
          const validViewPosition = new Position(viewLineNumber, viewColumn);
          assert.strictEqual(viewPosition.toString(), validViewPosition.toString(), "model->view for " + lineNumber + ", " + column);
        }
      }
      for (let lineNumber = 0; lineNumber <= viewLineCount + 1; lineNumber++) {
        const lineMinColumn = linesCollection.getViewLineMinColumn(lineNumber);
        const lineMaxColumn = linesCollection.getViewLineMaxColumn(lineNumber);
        for (let column = lineMinColumn - 1; column <= lineMaxColumn + 1; column++) {
          const modelPosition = linesCollection.convertViewPositionToModelPosition(lineNumber, column);
          const validModelPosition = model.validatePosition(modelPosition);
          assert.strictEqual(modelPosition.toString(), validModelPosition.toString(), "view->model for " + lineNumber + ", " + column);
        }
      }
    });
  });
});
suite("SplitLinesCollection", () => {
  const _text = [
    "class Nice {",
    "	function hi() {",
    '		console.log("Hello world");',
    "	}",
    "	function hello() {",
    '		console.log("Hello world, this is a somewhat longer line");',
    "	}",
    "}"
  ];
  const _tokens = [
    [
      { startIndex: 0, value: 1 },
      { startIndex: 5, value: 2 },
      { startIndex: 6, value: 3 },
      { startIndex: 10, value: 4 }
    ],
    [
      { startIndex: 0, value: 5 },
      { startIndex: 1, value: 6 },
      { startIndex: 9, value: 7 },
      { startIndex: 10, value: 8 },
      { startIndex: 12, value: 9 }
    ],
    [
      { startIndex: 0, value: 10 },
      { startIndex: 2, value: 11 },
      { startIndex: 9, value: 12 },
      { startIndex: 10, value: 13 },
      { startIndex: 13, value: 14 },
      { startIndex: 14, value: 15 },
      { startIndex: 27, value: 16 }
    ],
    [
      { startIndex: 0, value: 17 }
    ],
    [
      { startIndex: 0, value: 18 },
      { startIndex: 1, value: 19 },
      { startIndex: 9, value: 20 },
      { startIndex: 10, value: 21 },
      { startIndex: 15, value: 22 }
    ],
    [
      { startIndex: 0, value: 23 },
      { startIndex: 2, value: 24 },
      { startIndex: 9, value: 25 },
      { startIndex: 10, value: 26 },
      { startIndex: 13, value: 27 },
      { startIndex: 14, value: 28 },
      { startIndex: 59, value: 29 }
    ],
    [
      { startIndex: 0, value: 30 }
    ],
    [
      { startIndex: 0, value: 31 }
    ]
  ];
  let model;
  let languageRegistration;
  setup(() => {
    let _lineIndex = 0;
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        const tokens = _tokens[_lineIndex++];
        const result = new Uint32Array(2 * tokens.length);
        for (let i = 0; i < tokens.length; i++) {
          result[2 * i] = tokens[i].startIndex;
          result[2 * i + 1] = tokens[i].value << MetadataConsts.FOREGROUND_OFFSET;
        }
        return new languages.EncodedTokenizationResult(result, state);
      }
    };
    const LANGUAGE_ID = "modelModeTest1";
    languageRegistration = languages.TokenizationRegistry.register(LANGUAGE_ID, tokenizationSupport);
    model = createTextModel(_text.join("\n"), LANGUAGE_ID);
    model.tokenization.forceTokenization(model.getLineCount());
  });
  teardown(() => {
    model.dispose();
    languageRegistration.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertViewLineTokens(_actual, expected) {
    const actual = [];
    for (let i = 0, len = _actual.getCount(); i < len; i++) {
      actual[i] = {
        endIndex: _actual.getEndOffset(i),
        value: _actual.getForeground(i)
      };
    }
    assert.deepStrictEqual(actual, expected);
  }
  function assertMinimapLineRenderingData(actual, expected) {
    if (actual === null && expected === null) {
      assert.ok(true);
      return;
    }
    if (expected === null) {
      assert.ok(false);
    }
    assert.strictEqual(actual.content, expected.content);
    assert.strictEqual(actual.minColumn, expected.minColumn);
    assert.strictEqual(actual.maxColumn, expected.maxColumn);
    assertViewLineTokens(actual.tokens, expected.tokens);
  }
  function assertMinimapLinesRenderingData(actual, expected) {
    assert.strictEqual(actual.length, expected.length);
    for (let i = 0; i < expected.length; i++) {
      assertMinimapLineRenderingData(actual[i], expected[i]);
    }
  }
  function assertAllMinimapLinesRenderingData(splitLinesCollection, all) {
    const lineCount = all.length;
    for (let line = 1; line <= lineCount; line++) {
      assert.strictEqual(splitLinesCollection.getViewLineData(line).content, splitLinesCollection.getViewLineContent(line));
    }
    for (let start = 1; start <= lineCount; start++) {
      for (let end = start; end <= lineCount; end++) {
        const count = end - start + 1;
        for (let desired = Math.pow(2, count) - 1; desired >= 0; desired--) {
          const needed = [];
          const expected = [];
          for (let i = 0; i < count; i++) {
            needed[i] = desired & 1 << i ? true : false;
            expected[i] = needed[i] ? all[start - 1 + i] : null;
          }
          const actual = splitLinesCollection.getViewLinesData(start, end, needed);
          assertMinimapLinesRenderingData(actual, expected);
          break;
        }
      }
    }
  }
  test("getViewLinesData - no wrapping", () => {
    withSplitLinesCollection(model, "off", 0, (splitLinesCollection) => {
      assert.strictEqual(splitLinesCollection.getViewLineCount(), 8);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(1, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(2, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(3, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(4, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(5, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(6, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(7, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(8, 1), true);
      const _expected = [
        {
          content: "class Nice {",
          minColumn: 1,
          maxColumn: 13,
          tokens: [
            { endIndex: 5, value: 1 },
            { endIndex: 6, value: 2 },
            { endIndex: 10, value: 3 },
            { endIndex: 12, value: 4 }
          ]
        },
        {
          content: "	function hi() {",
          minColumn: 1,
          maxColumn: 17,
          tokens: [
            { endIndex: 1, value: 5 },
            { endIndex: 9, value: 6 },
            { endIndex: 10, value: 7 },
            { endIndex: 12, value: 8 },
            { endIndex: 16, value: 9 }
          ]
        },
        {
          content: '		console.log("Hello world");',
          minColumn: 1,
          maxColumn: 30,
          tokens: [
            { endIndex: 2, value: 10 },
            { endIndex: 9, value: 11 },
            { endIndex: 10, value: 12 },
            { endIndex: 13, value: 13 },
            { endIndex: 14, value: 14 },
            { endIndex: 27, value: 15 },
            { endIndex: 29, value: 16 }
          ]
        },
        {
          content: "	}",
          minColumn: 1,
          maxColumn: 3,
          tokens: [
            { endIndex: 2, value: 17 }
          ]
        },
        {
          content: "	function hello() {",
          minColumn: 1,
          maxColumn: 20,
          tokens: [
            { endIndex: 1, value: 18 },
            { endIndex: 9, value: 19 },
            { endIndex: 10, value: 20 },
            { endIndex: 15, value: 21 },
            { endIndex: 19, value: 22 }
          ]
        },
        {
          content: '		console.log("Hello world, this is a somewhat longer line");',
          minColumn: 1,
          maxColumn: 62,
          tokens: [
            { endIndex: 2, value: 23 },
            { endIndex: 9, value: 24 },
            { endIndex: 10, value: 25 },
            { endIndex: 13, value: 26 },
            { endIndex: 14, value: 27 },
            { endIndex: 59, value: 28 },
            { endIndex: 61, value: 29 }
          ]
        },
        {
          minColumn: 1,
          maxColumn: 3,
          content: "	}",
          tokens: [
            { endIndex: 2, value: 30 }
          ]
        },
        {
          minColumn: 1,
          maxColumn: 2,
          content: "}",
          tokens: [
            { endIndex: 1, value: 31 }
          ]
        }
      ];
      assertAllMinimapLinesRenderingData(splitLinesCollection, [
        _expected[0],
        _expected[1],
        _expected[2],
        _expected[3],
        _expected[4],
        _expected[5],
        _expected[6],
        _expected[7]
      ]);
      splitLinesCollection.setHiddenAreas([new Range(2, 1, 4, 1)]);
      assert.strictEqual(splitLinesCollection.getViewLineCount(), 5);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(1, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(2, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(3, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(4, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(5, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(6, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(7, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(8, 1), true);
      assertAllMinimapLinesRenderingData(splitLinesCollection, [
        _expected[0],
        _expected[4],
        _expected[5],
        _expected[6],
        _expected[7]
      ]);
    });
  });
  test("getViewLinesData - with wrapping", () => {
    withSplitLinesCollection(model, "wordWrapColumn", 30, (splitLinesCollection) => {
      assert.strictEqual(splitLinesCollection.getViewLineCount(), 12);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(1, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(2, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(3, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(4, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(5, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(6, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(7, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(8, 1), true);
      const _expected = [
        {
          content: "class Nice {",
          minColumn: 1,
          maxColumn: 13,
          tokens: [
            { endIndex: 5, value: 1 },
            { endIndex: 6, value: 2 },
            { endIndex: 10, value: 3 },
            { endIndex: 12, value: 4 }
          ]
        },
        {
          content: "	function hi() {",
          minColumn: 1,
          maxColumn: 17,
          tokens: [
            { endIndex: 1, value: 5 },
            { endIndex: 9, value: 6 },
            { endIndex: 10, value: 7 },
            { endIndex: 12, value: 8 },
            { endIndex: 16, value: 9 }
          ]
        },
        {
          content: '		console.log("Hello ',
          minColumn: 1,
          maxColumn: 22,
          tokens: [
            { endIndex: 2, value: 10 },
            { endIndex: 9, value: 11 },
            { endIndex: 10, value: 12 },
            { endIndex: 13, value: 13 },
            { endIndex: 14, value: 14 },
            { endIndex: 21, value: 15 }
          ]
        },
        {
          content: '            world");',
          minColumn: 13,
          maxColumn: 21,
          tokens: [
            { endIndex: 18, value: 15 },
            { endIndex: 20, value: 16 }
          ]
        },
        {
          content: "	}",
          minColumn: 1,
          maxColumn: 3,
          tokens: [
            { endIndex: 2, value: 17 }
          ]
        },
        {
          content: "	function hello() {",
          minColumn: 1,
          maxColumn: 20,
          tokens: [
            { endIndex: 1, value: 18 },
            { endIndex: 9, value: 19 },
            { endIndex: 10, value: 20 },
            { endIndex: 15, value: 21 },
            { endIndex: 19, value: 22 }
          ]
        },
        {
          content: '		console.log("Hello ',
          minColumn: 1,
          maxColumn: 22,
          tokens: [
            { endIndex: 2, value: 23 },
            { endIndex: 9, value: 24 },
            { endIndex: 10, value: 25 },
            { endIndex: 13, value: 26 },
            { endIndex: 14, value: 27 },
            { endIndex: 21, value: 28 }
          ]
        },
        {
          content: "            world, this is a ",
          minColumn: 13,
          maxColumn: 30,
          tokens: [
            { endIndex: 29, value: 28 }
          ]
        },
        {
          content: "            somewhat longer ",
          minColumn: 13,
          maxColumn: 29,
          tokens: [
            { endIndex: 28, value: 28 }
          ]
        },
        {
          content: '            line");',
          minColumn: 13,
          maxColumn: 20,
          tokens: [
            { endIndex: 17, value: 28 },
            { endIndex: 19, value: 29 }
          ]
        },
        {
          content: "	}",
          minColumn: 1,
          maxColumn: 3,
          tokens: [
            { endIndex: 2, value: 30 }
          ]
        },
        {
          content: "}",
          minColumn: 1,
          maxColumn: 2,
          tokens: [
            { endIndex: 1, value: 31 }
          ]
        }
      ];
      assertAllMinimapLinesRenderingData(splitLinesCollection, [
        _expected[0],
        _expected[1],
        _expected[2],
        _expected[3],
        _expected[4],
        _expected[5],
        _expected[6],
        _expected[7],
        _expected[8],
        _expected[9],
        _expected[10],
        _expected[11]
      ]);
      splitLinesCollection.setHiddenAreas([new Range(2, 1, 4, 1)]);
      assert.strictEqual(splitLinesCollection.getViewLineCount(), 8);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(1, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(2, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(3, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(4, 1), false);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(5, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(6, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(7, 1), true);
      assert.strictEqual(splitLinesCollection.modelPositionIsVisible(8, 1), true);
      assertAllMinimapLinesRenderingData(splitLinesCollection, [
        _expected[0],
        _expected[5],
        _expected[6],
        _expected[7],
        _expected[8],
        _expected[9],
        _expected[10],
        _expected[11]
      ]);
    });
  });
  test("getViewLinesData - with wrapping and injected text", () => {
    model.deltaDecorations([], [{
      range: new Range(1, 9, 1, 9),
      options: {
        description: "example",
        after: {
          content: "very very long injected text that causes a line break",
          inlineClassName: "myClassName"
        },
        showIfCollapsed: true
      }
    }]);
    withSplitLinesCollection(model, "wordWrapColumn", 30, (splitLinesCollection) => {
      assert.strictEqual(splitLinesCollection.getViewLineCount(), 14);
      assert.strictEqual(splitLinesCollection.getViewLineMaxColumn(1), 24);
      const _expected = [
        {
          content: "class Nivery very long ",
          minColumn: 1,
          maxColumn: 24,
          tokens: [
            { endIndex: 5, value: 1 },
            { endIndex: 6, value: 2 },
            { endIndex: 8, value: 3 },
            { endIndex: 23, value: 1 }
          ]
        },
        {
          content: "    injected text that causes ",
          minColumn: 5,
          maxColumn: 31,
          tokens: [{ endIndex: 30, value: 1 }]
        },
        {
          content: "    a line breakce {",
          minColumn: 5,
          maxColumn: 21,
          tokens: [
            { endIndex: 16, value: 1 },
            { endIndex: 18, value: 3 },
            { endIndex: 20, value: 4 }
          ]
        },
        {
          content: "	function hi() {",
          minColumn: 1,
          maxColumn: 17,
          tokens: [
            { endIndex: 1, value: 5 },
            { endIndex: 9, value: 6 },
            { endIndex: 10, value: 7 },
            { endIndex: 12, value: 8 },
            { endIndex: 16, value: 9 }
          ]
        },
        {
          content: '		console.log("Hello ',
          minColumn: 1,
          maxColumn: 22,
          tokens: [
            { endIndex: 2, value: 10 },
            { endIndex: 9, value: 11 },
            { endIndex: 10, value: 12 },
            { endIndex: 13, value: 13 },
            { endIndex: 14, value: 14 },
            { endIndex: 21, value: 15 }
          ]
        },
        {
          content: '            world");',
          minColumn: 13,
          maxColumn: 21,
          tokens: [
            { endIndex: 18, value: 15 },
            { endIndex: 20, value: 16 }
          ]
        },
        {
          content: "	}",
          minColumn: 1,
          maxColumn: 3,
          tokens: [
            { endIndex: 2, value: 17 }
          ]
        },
        {
          content: "	function hello() {",
          minColumn: 1,
          maxColumn: 20,
          tokens: [
            { endIndex: 1, value: 18 },
            { endIndex: 9, value: 19 },
            { endIndex: 10, value: 20 },
            { endIndex: 15, value: 21 },
            { endIndex: 19, value: 22 }
          ]
        },
        {
          content: '		console.log("Hello ',
          minColumn: 1,
          maxColumn: 22,
          tokens: [
            { endIndex: 2, value: 23 },
            { endIndex: 9, value: 24 },
            { endIndex: 10, value: 25 },
            { endIndex: 13, value: 26 },
            { endIndex: 14, value: 27 },
            { endIndex: 21, value: 28 }
          ]
        },
        {
          content: "            world, this is a ",
          minColumn: 13,
          maxColumn: 30,
          tokens: [
            { endIndex: 29, value: 28 }
          ]
        },
        {
          content: "            somewhat longer ",
          minColumn: 13,
          maxColumn: 29,
          tokens: [
            { endIndex: 28, value: 28 }
          ]
        },
        {
          content: '            line");',
          minColumn: 13,
          maxColumn: 20,
          tokens: [
            { endIndex: 17, value: 28 },
            { endIndex: 19, value: 29 }
          ]
        },
        {
          content: "	}",
          minColumn: 1,
          maxColumn: 3,
          tokens: [
            { endIndex: 2, value: 30 }
          ]
        },
        {
          content: "}",
          minColumn: 1,
          maxColumn: 2,
          tokens: [
            { endIndex: 1, value: 31 }
          ]
        }
      ];
      assertAllMinimapLinesRenderingData(splitLinesCollection, [
        _expected[0],
        _expected[1],
        _expected[2],
        _expected[3],
        _expected[4],
        _expected[5],
        _expected[6],
        _expected[7],
        _expected[8],
        _expected[9],
        _expected[10],
        _expected[11]
      ]);
      const data = splitLinesCollection.getViewLinesData(1, 14, new Array(14).fill(true));
      assert.deepStrictEqual(
        data.map((d) => ({
          inlineDecorations: d.inlineDecorations?.map((d2) => ({
            startOffset: d2.startOffset,
            endOffset: d2.endOffset
          }))
        })),
        [
          { inlineDecorations: [{ startOffset: 8, endOffset: 23 }] },
          { inlineDecorations: [{ startOffset: 4, endOffset: 30 }] },
          { inlineDecorations: [{ startOffset: 4, endOffset: 16 }] },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 },
          { inlineDecorations: void 0 }
        ]
      );
    });
  });
  function withSplitLinesCollection(model2, wordWrap, wordWrapColumn, callback) {
    const configuration = new TestConfiguration({
      wordWrap,
      wordWrapColumn,
      wrappingIndent: "indent"
    });
    const wrappingInfo = configuration.options.get(EditorOption.wrappingInfo);
    const fontInfo = configuration.options.get(EditorOption.fontInfo);
    const wordWrapBreakAfterCharacters = configuration.options.get(EditorOption.wordWrapBreakAfterCharacters);
    const wordWrapBreakBeforeCharacters = configuration.options.get(EditorOption.wordWrapBreakBeforeCharacters);
    const wrappingIndent = configuration.options.get(EditorOption.wrappingIndent);
    const wordBreak = configuration.options.get(EditorOption.wordBreak);
    const lineBreaksComputerFactory = new MonospaceLineBreaksComputerFactory(wordWrapBreakBeforeCharacters, wordWrapBreakAfterCharacters);
    const linesCollection = new ViewModelLinesFromProjectedModel(
      1,
      model2,
      lineBreaksComputerFactory,
      lineBreaksComputerFactory,
      fontInfo,
      model2.getOptions().tabSize,
      "simple",
      wrappingInfo.wrappingColumn,
      wrappingIndent,
      wordBreak
    );
    callback(linesCollection);
    configuration.dispose();
  }
});
function pos(lineNumber, column) {
  return new Position(lineNumber, column);
}
function createSplitLine(splitLengths, breakingOffsetsVisibleColumn, wrappedTextIndentWidth, isVisible = true) {
  return createModelLineProjection(createLineBreakData(splitLengths, breakingOffsetsVisibleColumn, wrappedTextIndentWidth), isVisible);
}
function createLineBreakData(breakingLengths, breakingOffsetsVisibleColumn, wrappedTextIndentWidth) {
  const sums = [];
  for (let i = 0; i < breakingLengths.length; i++) {
    sums[i] = (i > 0 ? sums[i - 1] : 0) + breakingLengths[i];
  }
  return new ModelLineProjectionData(null, null, sums, breakingOffsetsVisibleColumn, wrappedTextIndentWidth);
}
function createModel(text) {
  return {
    tokenization: {
      getLineTokens: (lineNumber) => {
        return null;
      }
    },
    getLineContent: (lineNumber) => {
      return text;
    },
    getLineLength: (lineNumber) => {
      return text.length;
    },
    getLineMinColumn: (lineNumber) => {
      return 1;
    },
    getLineMaxColumn: (lineNumber) => {
      return text.length + 1;
    },
    getValueInRange: (range, eol) => {
      return text.substring(range.startColumn - 1, range.endColumn - 1);
    }
  };
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9icm93c2VyL3ZpZXdNb2RlbC9tb2RlbExpbmVQcm9qZWN0aW9uLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEVkaXRvck9wdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWcvZWRpdG9yT3B0aW9ucy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IE51bGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbnVsbFRva2VuaXplLmpzJztcbmltcG9ydCB7IEVuZE9mTGluZVByZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2RlbExpbmVQcm9qZWN0aW9uRGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbExpbmVQcm9qZWN0aW9uRGF0YS5qcyc7XG5pbXBvcnQgeyBJVmlld0xpbmVUb2tlbnMgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdG9rZW5zL2xpbmVUb2tlbnMuanMnO1xuaW1wb3J0IHsgVmlld0xpbmVEYXRhIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxMaW5lUHJvamVjdGlvbiwgSVNpbXBsZU1vZGVsLCBjcmVhdGVNb2RlbExpbmVQcm9qZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3ZpZXdNb2RlbC9tb2RlbExpbmVQcm9qZWN0aW9uLmpzJztcbmltcG9ydCB7IE1vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3RvcnkgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vdmlld01vZGVsL21vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlci5qcyc7XG5pbXBvcnQgeyBWaWV3TW9kZWxMaW5lc0Zyb21Qcm9qZWN0ZWRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi92aWV3TW9kZWwvdmlld01vZGVsTGluZXMuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi9jb25maWcvdGVzdENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vY29tbW9uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG5zdWl0ZSgnRWRpdG9yIFZpZXdNb2RlbCAtIFNwbGl0TGluZXNDb2xsZWN0aW9uJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ1NwbGl0TGluZScsICgpID0+IHtcblx0XHRsZXQgbW9kZWwxID0gY3JlYXRlTW9kZWwoJ015IEZpcnN0IExpbmVNeSBTZWNvbmQgTGluZUFuZCBhbm90aGVyIG9uZScpO1xuXHRcdGxldCBsaW5lMSA9IGNyZWF0ZVNwbGl0TGluZShbMTMsIDE0LCAxNV0sIFsxMywgMTMgKyAxNCwgMTMgKyAxNCArIDE1XSwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVDb3VudCgpLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVDb250ZW50KG1vZGVsMSwgMSwgMCksICdNeSBGaXJzdCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdMaW5lQ29udGVudChtb2RlbDEsIDEsIDEpLCAnTXkgU2Vjb25kIExpbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVDb250ZW50KG1vZGVsMSwgMSwgMiksICdBbmQgYW5vdGhlciBvbmUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVNYXhDb2x1bW4obW9kZWwxLCAxLCAwKSwgMTQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lMS5nZXRWaWV3TGluZU1heENvbHVtbihtb2RlbDEsIDEsIDEpLCAxNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdMaW5lTWF4Q29sdW1uKG1vZGVsMSwgMSwgMiksIDE2KTtcblx0XHRmb3IgKGxldCBjb2wgPSAxOyBjb2wgPD0gMTQ7IGNvbCsrKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0TW9kZWxDb2x1bW5PZlZpZXdQb3NpdGlvbigwLCBjb2wpLCBjb2wsICdnZXRJbnB1dENvbHVtbk9mT3V0cHV0UG9zaXRpb24oMCwgJyArIGNvbCArICcpJyk7XG5cdFx0fVxuXHRcdGZvciAobGV0IGNvbCA9IDE7IGNvbCA8PSAxNTsgY29sKyspIHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lMS5nZXRNb2RlbENvbHVtbk9mVmlld1Bvc2l0aW9uKDEsIGNvbCksIDEzICsgY29sLCAnZ2V0SW5wdXRDb2x1bW5PZk91dHB1dFBvc2l0aW9uKDEsICcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxOyBjb2wgPD0gMTY7IGNvbCsrKSB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0TW9kZWxDb2x1bW5PZlZpZXdQb3NpdGlvbigyLCBjb2wpLCAxMyArIDE0ICsgY29sLCAnZ2V0SW5wdXRDb2x1bW5PZk91dHB1dFBvc2l0aW9uKDIsICcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxOyBjb2wgPD0gMTM7IGNvbCsrKSB7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdQb3NpdGlvbk9mTW9kZWxQb3NpdGlvbigwLCBjb2wpLCBwb3MoMCwgY29sKSwgJ2dldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxICsgMTM7IGNvbCA8PSAxNCArIDEzOyBjb2wrKykge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lMS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oMCwgY29sKSwgcG9zKDEsIGNvbCAtIDEzKSwgJ2dldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxICsgMTMgKyAxNDsgY29sIDw9IDE1ICsgMTQgKyAxMzsgY29sKyspIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld1Bvc2l0aW9uT2ZNb2RlbFBvc2l0aW9uKDAsIGNvbCksIHBvcygyLCBjb2wgLSAxMyAtIDE0KSwgJ2dldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblxuXHRcdG1vZGVsMSA9IGNyZWF0ZU1vZGVsKCdNeSBGaXJzdCBMaW5lTXkgU2Vjb25kIExpbmVBbmQgYW5vdGhlciBvbmUnKTtcblx0XHRsaW5lMSA9IGNyZWF0ZVNwbGl0TGluZShbMTMsIDE0LCAxNV0sIFsxMywgMTMgKyAxNCwgMTMgKyAxNCArIDE1XSwgNCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVDb3VudCgpLCAzKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVDb250ZW50KG1vZGVsMSwgMSwgMCksICdNeSBGaXJzdCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdMaW5lQ29udGVudChtb2RlbDEsIDEsIDEpLCAnICAgIE15IFNlY29uZCBMaW5lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdMaW5lQ29udGVudChtb2RlbDEsIDEsIDIpLCAnICAgIEFuZCBhbm90aGVyIG9uZScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lMS5nZXRWaWV3TGluZU1heENvbHVtbihtb2RlbDEsIDEsIDApLCAxNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmUxLmdldFZpZXdMaW5lTWF4Q29sdW1uKG1vZGVsMSwgMSwgMSksIDE5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld0xpbmVNYXhDb2x1bW4obW9kZWwxLCAxLCAyKSwgMjApO1xuXG5cdFx0Y29uc3QgYWN0dWFsVmlld0NvbHVtbk1hcHBpbmc6IG51bWJlcltdW10gPSBbXTtcblx0XHRmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBsaW5lMS5nZXRWaWV3TGluZUNvdW50KCk7IGxpbmVJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBhY3R1YWxMaW5lVmlld0NvbHVtbk1hcHBpbmc6IG51bWJlcltdID0gW107XG5cdFx0XHRmb3IgKGxldCBjb2wgPSAxOyBjb2wgPD0gbGluZTEuZ2V0Vmlld0xpbmVNYXhDb2x1bW4obW9kZWwxLCAxLCBsaW5lSW5kZXgpOyBjb2wrKykge1xuXHRcdFx0XHRhY3R1YWxMaW5lVmlld0NvbHVtbk1hcHBpbmcucHVzaChsaW5lMS5nZXRNb2RlbENvbHVtbk9mVmlld1Bvc2l0aW9uKGxpbmVJbmRleCwgY29sKSk7XG5cdFx0XHR9XG5cdFx0XHRhY3R1YWxWaWV3Q29sdW1uTWFwcGluZy5wdXNoKGFjdHVhbExpbmVWaWV3Q29sdW1uTWFwcGluZyk7XG5cdFx0fVxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsVmlld0NvbHVtbk1hcHBpbmcsIFtcblx0XHRcdFsxLCAyLCAzLCA0LCA1LCA2LCA3LCA4LCA5LCAxMCwgMTEsIDEyLCAxMywgMTRdLFxuXHRcdFx0WzE0LCAxNCwgMTQsIDE0LCAxNCwgMTUsIDE2LCAxNywgMTgsIDE5LCAyMCwgMjEsIDIyLCAyMywgMjQsIDI1LCAyNiwgMjcsIDI4XSxcblx0XHRcdFsyOCwgMjgsIDI4LCAyOCwgMjgsIDI5LCAzMCwgMzEsIDMyLCAzMywgMzQsIDM1LCAzNiwgMzcsIDM4LCAzOSwgNDAsIDQxLCA0MiwgNDNdLFxuXHRcdF0pO1xuXG5cdFx0Zm9yIChsZXQgY29sID0gMTsgY29sIDw9IDEzOyBjb2wrKykge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lMS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oMCwgY29sKSwgcG9zKDAsIGNvbCksICc2LmdldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxICsgMTM7IGNvbCA8PSAxNCArIDEzOyBjb2wrKykge1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lMS5nZXRWaWV3UG9zaXRpb25PZk1vZGVsUG9zaXRpb24oMCwgY29sKSwgcG9zKDEsIDQgKyBjb2wgLSAxMyksICc3LmdldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0XHRmb3IgKGxldCBjb2wgPSAxICsgMTMgKyAxNDsgY29sIDw9IDE1ICsgMTQgKyAxMzsgY29sKyspIHtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZTEuZ2V0Vmlld1Bvc2l0aW9uT2ZNb2RlbFBvc2l0aW9uKDAsIGNvbCksIHBvcygyLCA0ICsgY29sIC0gMTMgLSAxNCksICc4LmdldE91dHB1dFBvc2l0aW9uT2ZJbnB1dFBvc2l0aW9uKCcgKyBjb2wgKyAnKScpO1xuXHRcdH1cblx0fSk7XG5cblx0ZnVuY3Rpb24gd2l0aFNwbGl0TGluZXNDb2xsZWN0aW9uKHRleHQ6IHN0cmluZywgY2FsbGJhY2s6IChtb2RlbDogVGV4dE1vZGVsLCBsaW5lc0NvbGxlY3Rpb246IFZpZXdNb2RlbExpbmVzRnJvbVByb2plY3RlZE1vZGVsKSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0Y29uc3QgY29uZmlnID0gbmV3IFRlc3RDb25maWd1cmF0aW9uKHt9KTtcblx0XHRjb25zdCB3cmFwcGluZ0luZm8gPSBjb25maWcub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbyk7XG5cdFx0Y29uc3QgZm9udEluZm8gPSBjb25maWcub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLmZvbnRJbmZvKTtcblx0XHRjb25zdCB3b3JkV3JhcEJyZWFrQWZ0ZXJDaGFyYWN0ZXJzID0gY29uZmlnLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkV3JhcEJyZWFrQWZ0ZXJDaGFyYWN0ZXJzKTtcblx0XHRjb25zdCB3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVycyA9IGNvbmZpZy5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ud29yZFdyYXBCcmVha0JlZm9yZUNoYXJhY3RlcnMpO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5kZW50ID0gY29uZmlnLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53cmFwcGluZ0luZGVudCk7XG5cdFx0Y29uc3Qgd29yZEJyZWFrID0gY29uZmlnLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi53b3JkQnJlYWspO1xuXHRcdGNvbnN0IGxpbmVCcmVha3NDb21wdXRlckZhY3RvcnkgPSBuZXcgTW9ub3NwYWNlTGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSh3b3JkV3JhcEJyZWFrQmVmb3JlQ2hhcmFjdGVycywgd29yZFdyYXBCcmVha0FmdGVyQ2hhcmFjdGVycyk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnaW50IG1haW4oKSB7Jyxcblx0XHRcdCdcXHRwcmludGYoXCJIZWxsbyB3b3JsZCFcIik7Jyxcblx0XHRcdCd9Jyxcblx0XHRcdCdpbnQgbWFpbigpIHsnLFxuXHRcdFx0J1xcdHByaW50ZihcIkhlbGxvIHdvcmxkIVwiKTsnLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0Y29uc3QgbGluZXNDb2xsZWN0aW9uID0gbmV3IFZpZXdNb2RlbExpbmVzRnJvbVByb2plY3RlZE1vZGVsKFxuXHRcdFx0MSxcblx0XHRcdG1vZGVsLFxuXHRcdFx0bGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSxcblx0XHRcdGxpbmVCcmVha3NDb21wdXRlckZhY3RvcnksXG5cdFx0XHRmb250SW5mbyxcblx0XHRcdG1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplLFxuXHRcdFx0J3NpbXBsZScsXG5cdFx0XHR3cmFwcGluZ0luZm8ud3JhcHBpbmdDb2x1bW4sXG5cdFx0XHR3cmFwcGluZ0luZGVudCxcblx0XHRcdHdvcmRCcmVha1xuXHRcdCk7XG5cblx0XHRjYWxsYmFjayhtb2RlbCwgbGluZXNDb2xsZWN0aW9uKTtcblxuXHRcdGxpbmVzQ29sbGVjdGlvbi5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdGNvbmZpZy5kaXNwb3NlKCk7XG5cdH1cblxuXHR0ZXN0KCdJbnZhbGlkIGxpbmUgbnVtYmVycycsICgpID0+IHtcblxuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnaW50IG1haW4oKSB7Jyxcblx0XHRcdCdcXHRwcmludGYoXCJIZWxsbyB3b3JsZCFcIik7Jyxcblx0XHRcdCd9Jyxcblx0XHRcdCdpbnQgbWFpbigpIHsnLFxuXHRcdFx0J1xcdHByaW50ZihcIkhlbGxvIHdvcmxkIVwiKTsnLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJyk7XG5cblx0XHR3aXRoU3BsaXRMaW5lc0NvbGxlY3Rpb24odGV4dCwgKG1vZGVsLCBsaW5lc0NvbGxlY3Rpb24pID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb3VudCgpLCA2KTtcblxuXHRcdFx0Ly8gZ2V0T3V0cHV0SW5kZW50R3VpZGVcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lc0luZGVudEd1aWRlcygtMSwgLTEpLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDAsIDApLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDEsIDEpLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDIsIDIpLCBbMV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDMsIDMpLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDQsIDQpLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDUsIDUpLCBbMV0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDYsIDYpLCBbMF0pO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVzSW5kZW50R3VpZGVzKDcsIDcpLCBbMF0pO1xuXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZXNJbmRlbnRHdWlkZXMoMCwgNyksIFswLCAxLCAwLCAwLCAxLCAwXSk7XG5cblx0XHRcdC8vIGdldE91dHB1dExpbmVDb250ZW50XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ29udGVudCgtMSksICdpbnQgbWFpbigpIHsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb250ZW50KDApLCAnaW50IG1haW4oKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ29udGVudCgxKSwgJ2ludCBtYWluKCkgeycpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZUNvbnRlbnQoMiksICdcXHRwcmludGYoXCJIZWxsbyB3b3JsZCFcIik7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ29udGVudCgzKSwgJ30nKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb250ZW50KDQpLCAnaW50IG1haW4oKSB7Jyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ29udGVudCg1KSwgJ1xcdHByaW50ZihcIkhlbGxvIHdvcmxkIVwiKTsnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb250ZW50KDYpLCAnfScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZUNvbnRlbnQoNyksICd9Jyk7XG5cblx0XHRcdC8vIGdldE91dHB1dExpbmVNaW5Db2x1bW5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4oLTEpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4oMCksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZU1pbkNvbHVtbigxKSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWluQ29sdW1uKDIpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4oMyksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZU1pbkNvbHVtbig0KSwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWluQ29sdW1uKDUpLCAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4oNiksIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZU1pbkNvbHVtbig3KSwgMSk7XG5cblx0XHRcdC8vIGdldE91dHB1dExpbmVNYXhDb2x1bW5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4oLTEpLCAxMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWF4Q29sdW1uKDApLCAxMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWF4Q29sdW1uKDEpLCAxMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWF4Q29sdW1uKDIpLCAyNSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lTWF4Q29sdW1uKDMpLCAyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4oNCksIDEzKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4oNSksIDI1KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4oNiksIDIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZU1heENvbHVtbig3KSwgMik7XG5cblx0XHRcdC8vIGNvbnZlcnRPdXRwdXRQb3NpdGlvblRvSW5wdXRQb3NpdGlvblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbigtMSwgMSksIG5ldyBQb3NpdGlvbigxLCAxKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKDAsIDEpLCBuZXcgUG9zaXRpb24oMSwgMSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbigxLCAxKSwgbmV3IFBvc2l0aW9uKDEsIDEpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24oMiwgMSksIG5ldyBQb3NpdGlvbigyLCAxKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKDMsIDEpLCBuZXcgUG9zaXRpb24oMywgMSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbig0LCAxKSwgbmV3IFBvc2l0aW9uKDQsIDEpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24oNSwgMSksIG5ldyBQb3NpdGlvbig1LCAxKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGxpbmVzQ29sbGVjdGlvbi5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKDYsIDEpLCBuZXcgUG9zaXRpb24oNiwgMSkpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChsaW5lc0NvbGxlY3Rpb24uY29udmVydFZpZXdQb3NpdGlvblRvTW9kZWxQb3NpdGlvbig3LCAxKSwgbmV3IFBvc2l0aW9uKDYsIDEpKTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwobGluZXNDb2xsZWN0aW9uLmNvbnZlcnRWaWV3UG9zaXRpb25Ub01vZGVsUG9zaXRpb24oOCwgMSksIG5ldyBQb3NpdGlvbig2LCAxKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMzNjYyJywgKCkgPT4ge1xuXG5cdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdCdpbnQgbWFpbigpIHsnLFxuXHRcdFx0J1xcdHByaW50ZihcIkhlbGxvIHdvcmxkIVwiKTsnLFxuXHRcdFx0J30nLFxuXHRcdFx0J2ludCBtYWluKCkgeycsXG5cdFx0XHQnXFx0cHJpbnRmKFwiSGVsbG8gd29ybGQhXCIpOycsXG5cdFx0XHQnfScsXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdHdpdGhTcGxpdExpbmVzQ29sbGVjdGlvbih0ZXh0LCAobW9kZWwsIGxpbmVzQ29sbGVjdGlvbikgPT4ge1xuXHRcdFx0bGluZXNDb2xsZWN0aW9uLnNldEhpZGRlbkFyZWFzKFtcblx0XHRcdFx0bmV3IFJhbmdlKDEsIDEsIDMsIDEpLFxuXHRcdFx0XHRuZXcgUmFuZ2UoNSwgMSwgNiwgMSlcblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCB2aWV3TGluZUNvdW50ID0gbGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ291bnQoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2aWV3TGluZUNvdW50LCAxLCAnZ2V0T3V0cHV0TGluZUNvdW50KCknKTtcblxuXHRcdFx0Y29uc3QgbW9kZWxMaW5lQ291bnQgPSBtb2RlbC5nZXRMaW5lQ291bnQoKTtcblx0XHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSAwOyBsaW5lTnVtYmVyIDw9IG1vZGVsTGluZUNvdW50ICsgMTsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVNaW5Db2x1bW4gPSAobGluZU51bWJlciA+PSAxICYmIGxpbmVOdW1iZXIgPD0gbW9kZWxMaW5lQ291bnQpID8gbW9kZWwuZ2V0TGluZU1pbkNvbHVtbihsaW5lTnVtYmVyKSA6IDE7XG5cdFx0XHRcdGNvbnN0IGxpbmVNYXhDb2x1bW4gPSAobGluZU51bWJlciA+PSAxICYmIGxpbmVOdW1iZXIgPD0gbW9kZWxMaW5lQ291bnQpID8gbW9kZWwuZ2V0TGluZU1heENvbHVtbihsaW5lTnVtYmVyKSA6IDE7XG5cdFx0XHRcdGZvciAobGV0IGNvbHVtbiA9IGxpbmVNaW5Db2x1bW4gLSAxOyBjb2x1bW4gPD0gbGluZU1heENvbHVtbiArIDE7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0Y29uc3Qgdmlld1Bvc2l0aW9uID0gbGluZXNDb2xsZWN0aW9uLmNvbnZlcnRNb2RlbFBvc2l0aW9uVG9WaWV3UG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKTtcblxuXHRcdFx0XHRcdC8vIHZhbGlkYXRlIHZpZXcgcG9zaXRpb25cblx0XHRcdFx0XHRsZXQgdmlld0xpbmVOdW1iZXIgPSB2aWV3UG9zaXRpb24ubGluZU51bWJlcjtcblx0XHRcdFx0XHRsZXQgdmlld0NvbHVtbiA9IHZpZXdQb3NpdGlvbi5jb2x1bW47XG5cdFx0XHRcdFx0aWYgKHZpZXdMaW5lTnVtYmVyIDwgMSkge1xuXHRcdFx0XHRcdFx0dmlld0xpbmVOdW1iZXIgPSAxO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBsaW5lQ291bnQgPSBsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb3VudCgpO1xuXHRcdFx0XHRcdGlmICh2aWV3TGluZU51bWJlciA+IGxpbmVDb3VudCkge1xuXHRcdFx0XHRcdFx0dmlld0xpbmVOdW1iZXIgPSBsaW5lQ291bnQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHZpZXdNaW5Db2x1bW4gPSBsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4odmlld0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGNvbnN0IHZpZXdNYXhDb2x1bW4gPSBsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4odmlld0xpbmVOdW1iZXIpO1xuXHRcdFx0XHRcdGlmICh2aWV3Q29sdW1uIDwgdmlld01pbkNvbHVtbikge1xuXHRcdFx0XHRcdFx0dmlld0NvbHVtbiA9IHZpZXdNaW5Db2x1bW47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmICh2aWV3Q29sdW1uID4gdmlld01heENvbHVtbikge1xuXHRcdFx0XHRcdFx0dmlld0NvbHVtbiA9IHZpZXdNYXhDb2x1bW47XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHZhbGlkVmlld1Bvc2l0aW9uID0gbmV3IFBvc2l0aW9uKHZpZXdMaW5lTnVtYmVyLCB2aWV3Q29sdW1uKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmlld1Bvc2l0aW9uLnRvU3RyaW5nKCksIHZhbGlkVmlld1Bvc2l0aW9uLnRvU3RyaW5nKCksICdtb2RlbC0+dmlldyBmb3IgJyArIGxpbmVOdW1iZXIgKyAnLCAnICsgY29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMDsgbGluZU51bWJlciA8PSB2aWV3TGluZUNvdW50ICsgMTsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVNaW5Db2x1bW4gPSBsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNaW5Db2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRcdGNvbnN0IGxpbmVNYXhDb2x1bW4gPSBsaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVNYXhDb2x1bW4obGluZU51bWJlcik7XG5cdFx0XHRcdGZvciAobGV0IGNvbHVtbiA9IGxpbmVNaW5Db2x1bW4gLSAxOyBjb2x1bW4gPD0gbGluZU1heENvbHVtbiArIDE7IGNvbHVtbisrKSB7XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWxQb3NpdGlvbiA9IGxpbmVzQ29sbGVjdGlvbi5jb252ZXJ0Vmlld1Bvc2l0aW9uVG9Nb2RlbFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cdFx0XHRcdFx0Y29uc3QgdmFsaWRNb2RlbFBvc2l0aW9uID0gbW9kZWwudmFsaWRhdGVQb3NpdGlvbihtb2RlbFBvc2l0aW9uKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWxQb3NpdGlvbi50b1N0cmluZygpLCB2YWxpZE1vZGVsUG9zaXRpb24udG9TdHJpbmcoKSwgJ3ZpZXctPm1vZGVsIGZvciAnICsgbGluZU51bWJlciArICcsICcgKyBjb2x1bW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH0pO1xuXG59KTtcblxuc3VpdGUoJ1NwbGl0TGluZXNDb2xsZWN0aW9uJywgKCkgPT4ge1xuXG5cdGNvbnN0IF90ZXh0ID0gW1xuXHRcdCdjbGFzcyBOaWNlIHsnLFxuXHRcdCdcdGZ1bmN0aW9uIGhpKCkgeycsXG5cdFx0J1x0XHRjb25zb2xlLmxvZyhcIkhlbGxvIHdvcmxkXCIpOycsXG5cdFx0J1x0fScsXG5cdFx0J1x0ZnVuY3Rpb24gaGVsbG8oKSB7Jyxcblx0XHQnXHRcdGNvbnNvbGUubG9nKFwiSGVsbG8gd29ybGQsIHRoaXMgaXMgYSBzb21ld2hhdCBsb25nZXIgbGluZVwiKTsnLFxuXHRcdCdcdH0nLFxuXHRcdCd9Jyxcblx0XTtcblxuXHRjb25zdCBfdG9rZW5zID0gW1xuXHRcdFtcblx0XHRcdHsgc3RhcnRJbmRleDogMCwgdmFsdWU6IDEgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogNSwgdmFsdWU6IDIgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogNiwgdmFsdWU6IDMgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogMTAsIHZhbHVlOiA0IH0sXG5cdFx0XSxcblx0XHRbXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHZhbHVlOiA1IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDEsIHZhbHVlOiA2IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDksIHZhbHVlOiA3IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDEwLCB2YWx1ZTogOCB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiAxMiwgdmFsdWU6IDkgfSxcblx0XHRdLFxuXHRcdFtcblx0XHRcdHsgc3RhcnRJbmRleDogMCwgdmFsdWU6IDEwIH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDIsIHZhbHVlOiAxMSB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiA5LCB2YWx1ZTogMTIgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogMTAsIHZhbHVlOiAxMyB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiAxMywgdmFsdWU6IDE0IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDE0LCB2YWx1ZTogMTUgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogMjcsIHZhbHVlOiAxNiB9LFxuXHRcdF0sXG5cdFx0W1xuXHRcdFx0eyBzdGFydEluZGV4OiAwLCB2YWx1ZTogMTcgfSxcblx0XHRdLFxuXHRcdFtcblx0XHRcdHsgc3RhcnRJbmRleDogMCwgdmFsdWU6IDE4IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDEsIHZhbHVlOiAxOSB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiA5LCB2YWx1ZTogMjAgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogMTAsIHZhbHVlOiAyMSB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiAxNSwgdmFsdWU6IDIyIH0sXG5cdFx0XSxcblx0XHRbXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHZhbHVlOiAyMyB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiAyLCB2YWx1ZTogMjQgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogOSwgdmFsdWU6IDI1IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDEwLCB2YWx1ZTogMjYgfSxcblx0XHRcdHsgc3RhcnRJbmRleDogMTMsIHZhbHVlOiAyNyB9LFxuXHRcdFx0eyBzdGFydEluZGV4OiAxNCwgdmFsdWU6IDI4IH0sXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDU5LCB2YWx1ZTogMjkgfSxcblx0XHRdLFxuXHRcdFtcblx0XHRcdHsgc3RhcnRJbmRleDogMCwgdmFsdWU6IDMwIH0sXG5cdFx0XSxcblx0XHRbXG5cdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHZhbHVlOiAzMSB9LFxuXHRcdF1cblx0XTtcblxuXHRsZXQgbW9kZWw6IFRleHRNb2RlbDtcblx0bGV0IGxhbmd1YWdlUmVnaXN0cmF0aW9uOiBJRGlzcG9zYWJsZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0bGV0IF9saW5lSW5kZXggPSAwO1xuXHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQ6IGxhbmd1YWdlcy5JVG9rZW5pemF0aW9uU3VwcG9ydCA9IHtcblx0XHRcdGdldEluaXRpYWxTdGF0ZTogKCkgPT4gTnVsbFN0YXRlLFxuXHRcdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0XHR0b2tlbml6ZUVuY29kZWQ6IChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBsYW5ndWFnZXMuRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCA9PiB7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IF90b2tlbnNbX2xpbmVJbmRleCsrXTtcblxuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBuZXcgVWludDMyQXJyYXkoMiAqIHRva2Vucy5sZW5ndGgpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vucy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdHJlc3VsdFsyICogaV0gPSB0b2tlbnNbaV0uc3RhcnRJbmRleDtcblx0XHRcdFx0XHRyZXN1bHRbMiAqIGkgKyAxXSA9IChcblx0XHRcdFx0XHRcdHRva2Vuc1tpXS52YWx1ZSA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIG5ldyBsYW5ndWFnZXMuRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdChyZXN1bHQsIHN0YXRlKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGNvbnN0IExBTkdVQUdFX0lEID0gJ21vZGVsTW9kZVRlc3QxJztcblx0XHRsYW5ndWFnZVJlZ2lzdHJhdGlvbiA9IGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihMQU5HVUFHRV9JRCwgdG9rZW5pemF0aW9uU3VwcG9ydCk7XG5cdFx0bW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoX3RleHQuam9pbignXFxuJyksIExBTkdVQUdFX0lEKTtcblx0XHQvLyBmb3JjZSB0b2tlbml6YXRpb25cblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdGxhbmd1YWdlUmVnaXN0cmF0aW9uLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0aW50ZXJmYWNlIElUZXN0Vmlld0xpbmVUb2tlbiB7XG5cdFx0ZW5kSW5kZXg6IG51bWJlcjtcblx0XHR2YWx1ZTogbnVtYmVyO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0Vmlld0xpbmVUb2tlbnMoX2FjdHVhbDogSVZpZXdMaW5lVG9rZW5zLCBleHBlY3RlZDogSVRlc3RWaWV3TGluZVRva2VuW10pOiB2b2lkIHtcblx0XHRjb25zdCBhY3R1YWw6IElUZXN0Vmlld0xpbmVUb2tlbltdID0gW107XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IF9hY3R1YWwuZ2V0Q291bnQoKTsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRhY3R1YWxbaV0gPSB7XG5cdFx0XHRcdGVuZEluZGV4OiBfYWN0dWFsLmdldEVuZE9mZnNldChpKSxcblx0XHRcdFx0dmFsdWU6IF9hY3R1YWwuZ2V0Rm9yZWdyb3VuZChpKVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkKTtcblx0fVxuXG5cdGludGVyZmFjZSBJVGVzdE1pbmltYXBMaW5lUmVuZGVyaW5nRGF0YSB7XG5cdFx0Y29udGVudDogc3RyaW5nO1xuXHRcdG1pbkNvbHVtbjogbnVtYmVyO1xuXHRcdG1heENvbHVtbjogbnVtYmVyO1xuXHRcdHRva2VuczogSVRlc3RWaWV3TGluZVRva2VuW107XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRNaW5pbWFwTGluZVJlbmRlcmluZ0RhdGEoYWN0dWFsOiBWaWV3TGluZURhdGEsIGV4cGVjdGVkOiBJVGVzdE1pbmltYXBMaW5lUmVuZGVyaW5nRGF0YSB8IG51bGwpOiB2b2lkIHtcblx0XHRpZiAoYWN0dWFsID09PSBudWxsICYmIGV4cGVjdGVkID09PSBudWxsKSB7XG5cdFx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChleHBlY3RlZCA9PT0gbnVsbCkge1xuXHRcdFx0YXNzZXJ0Lm9rKGZhbHNlKTtcblx0XHR9XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFjdHVhbC5jb250ZW50LCBleHBlY3RlZC5jb250ZW50KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1pbkNvbHVtbiwgZXhwZWN0ZWQubWluQ29sdW1uKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0dWFsLm1heENvbHVtbiwgZXhwZWN0ZWQubWF4Q29sdW1uKTtcblx0XHRhc3NlcnRWaWV3TGluZVRva2VucyhhY3R1YWwudG9rZW5zLCBleHBlY3RlZC50b2tlbnMpO1xuXHR9XG5cblx0ZnVuY3Rpb24gYXNzZXJ0TWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShhY3R1YWw6IFZpZXdMaW5lRGF0YVtdLCBleHBlY3RlZDogQXJyYXk8SVRlc3RNaW5pbWFwTGluZVJlbmRlcmluZ0RhdGEgfCBudWxsPik6IHZvaWQge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwubGVuZ3RoLCBleHBlY3RlZC5sZW5ndGgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgZXhwZWN0ZWQubGVuZ3RoOyBpKyspIHtcblx0XHRcdGFzc2VydE1pbmltYXBMaW5lUmVuZGVyaW5nRGF0YShhY3R1YWxbaV0sIGV4cGVjdGVkW2ldKTtcblx0XHR9XG5cdH1cblxuXHRmdW5jdGlvbiBhc3NlcnRBbGxNaW5pbWFwTGluZXNSZW5kZXJpbmdEYXRhKHNwbGl0TGluZXNDb2xsZWN0aW9uOiBWaWV3TW9kZWxMaW5lc0Zyb21Qcm9qZWN0ZWRNb2RlbCwgYWxsOiBJVGVzdE1pbmltYXBMaW5lUmVuZGVyaW5nRGF0YVtdKTogdm9pZCB7XG5cdFx0Y29uc3QgbGluZUNvdW50ID0gYWxsLmxlbmd0aDtcblx0XHRmb3IgKGxldCBsaW5lID0gMTsgbGluZSA8PSBsaW5lQ291bnQ7IGxpbmUrKykge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwbGl0TGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lRGF0YShsaW5lKS5jb250ZW50LCBzcGxpdExpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZUNvbnRlbnQobGluZSkpO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IHN0YXJ0ID0gMTsgc3RhcnQgPD0gbGluZUNvdW50OyBzdGFydCsrKSB7XG5cdFx0XHRmb3IgKGxldCBlbmQgPSBzdGFydDsgZW5kIDw9IGxpbmVDb3VudDsgZW5kKyspIHtcblx0XHRcdFx0Y29uc3QgY291bnQgPSBlbmQgLSBzdGFydCArIDE7XG5cdFx0XHRcdGZvciAobGV0IGRlc2lyZWQgPSBNYXRoLnBvdygyLCBjb3VudCkgLSAxOyBkZXNpcmVkID49IDA7IGRlc2lyZWQtLSkge1xuXHRcdFx0XHRcdGNvbnN0IG5lZWRlZDogYm9vbGVhbltdID0gW107XG5cdFx0XHRcdFx0Y29uc3QgZXhwZWN0ZWQ6IEFycmF5PElUZXN0TWluaW1hcExpbmVSZW5kZXJpbmdEYXRhIHwgbnVsbD4gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGNvdW50OyBpKyspIHtcblx0XHRcdFx0XHRcdG5lZWRlZFtpXSA9IChkZXNpcmVkICYgKDEgPDwgaSkpID8gdHJ1ZSA6IGZhbHNlO1xuXHRcdFx0XHRcdFx0ZXhwZWN0ZWRbaV0gPSAobmVlZGVkW2ldID8gYWxsW3N0YXJ0IC0gMSArIGldIDogbnVsbCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IGFjdHVhbCA9IHNwbGl0TGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lc0RhdGEoc3RhcnQsIGVuZCwgbmVlZGVkKTtcblxuXHRcdFx0XHRcdGFzc2VydE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoYWN0dWFsLCBleHBlY3RlZCk7XG5cdFx0XHRcdFx0Ly8gQ29tbWVudCBvdXQgbmV4dCBsaW5lIHRvIHRlc3QgYWxsIHBvc3NpYmxlIGNvbWJpbmF0aW9uc1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnZ2V0Vmlld0xpbmVzRGF0YSAtIG5vIHdyYXBwaW5nJywgKCkgPT4ge1xuXHRcdHdpdGhTcGxpdExpbmVzQ29sbGVjdGlvbihtb2RlbCwgJ29mZicsIDAsIChzcGxpdExpbmVzQ29sbGVjdGlvbikgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwbGl0TGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ291bnQoKSwgOCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgxLCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgyLCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgzLCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg0LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg1LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg2LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg3LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg4LCAxKSwgdHJ1ZSk7XG5cblx0XHRcdGNvbnN0IF9leHBlY3RlZDogSVRlc3RNaW5pbWFwTGluZVJlbmRlcmluZ0RhdGFbXSA9IFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdjbGFzcyBOaWNlIHsnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDEzLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogNSwgdmFsdWU6IDEgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDYsIHZhbHVlOiAyIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxMCwgdmFsdWU6IDMgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEyLCB2YWx1ZTogNCB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdGZ1bmN0aW9uIGhpKCkgeycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMTcsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxLCB2YWx1ZTogNSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogOSwgdmFsdWU6IDYgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogNyB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTIsIHZhbHVlOiA4IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxNiwgdmFsdWU6IDkgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnXHRcdGNvbnNvbGUubG9nKFwiSGVsbG8gd29ybGRcIik7Jyxcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAzMCxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIsIHZhbHVlOiAxMCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogOSwgdmFsdWU6IDExIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxMCwgdmFsdWU6IDEyIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxMywgdmFsdWU6IDEzIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxNCwgdmFsdWU6IDE0IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyNywgdmFsdWU6IDE1IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyOSwgdmFsdWU6IDE2IH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ1x0fScsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIsIHZhbHVlOiAxNyB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdGZ1bmN0aW9uIGhlbGxvKCkgeycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMjAsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxLCB2YWx1ZTogMTggfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDksIHZhbHVlOiAxOSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiAyMCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTUsIHZhbHVlOiAyMSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTksIHZhbHVlOiAyMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdFx0Y29uc29sZS5sb2coXCJIZWxsbyB3b3JsZCwgdGhpcyBpcyBhIHNvbWV3aGF0IGxvbmdlciBsaW5lXCIpOycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogNjIsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyLCB2YWx1ZTogMjMgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDksIHZhbHVlOiAyNCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiAyNSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTMsIHZhbHVlOiAyNiB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTQsIHZhbHVlOiAyNyB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogNTksIHZhbHVlOiAyOCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogNjEsIHZhbHVlOiAyOSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDMsXG5cdFx0XHRcdFx0Y29udGVudDogJ1x0fScsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyLCB2YWx1ZTogMzAgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAyLFxuXHRcdFx0XHRcdGNvbnRlbnQ6ICd9Jyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEsIHZhbHVlOiAzMSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdFx0YXNzZXJ0QWxsTWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShzcGxpdExpbmVzQ29sbGVjdGlvbiwgW1xuXHRcdFx0XHRfZXhwZWN0ZWRbMF0sXG5cdFx0XHRcdF9leHBlY3RlZFsxXSxcblx0XHRcdFx0X2V4cGVjdGVkWzJdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbM10sXG5cdFx0XHRcdF9leHBlY3RlZFs0XSxcblx0XHRcdFx0X2V4cGVjdGVkWzVdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbNl0sXG5cdFx0XHRcdF9leHBlY3RlZFs3XSxcblx0XHRcdF0pO1xuXG5cdFx0XHRzcGxpdExpbmVzQ29sbGVjdGlvbi5zZXRIaWRkZW5BcmVhcyhbbmV3IFJhbmdlKDIsIDEsIDQsIDEpXSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb3VudCgpLCA1KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDEsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDIsIDEpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgzLCAxKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwbGl0TGluZXNDb2xsZWN0aW9uLm1vZGVsUG9zaXRpb25Jc1Zpc2libGUoNCwgMSksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDUsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDYsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDcsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDgsIDEpLCB0cnVlKTtcblxuXHRcdFx0YXNzZXJ0QWxsTWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShzcGxpdExpbmVzQ29sbGVjdGlvbiwgW1xuXHRcdFx0XHRfZXhwZWN0ZWRbMF0sXG5cdFx0XHRcdF9leHBlY3RlZFs0XSxcblx0XHRcdFx0X2V4cGVjdGVkWzVdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbNl0sXG5cdFx0XHRcdF9leHBlY3RlZFs3XSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRWaWV3TGluZXNEYXRhIC0gd2l0aCB3cmFwcGluZycsICgpID0+IHtcblx0XHR3aXRoU3BsaXRMaW5lc0NvbGxlY3Rpb24obW9kZWwsICd3b3JkV3JhcENvbHVtbicsIDMwLCAoc3BsaXRMaW5lc0NvbGxlY3Rpb24pID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZUNvdW50KCksIDEyKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDEsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDIsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDMsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDQsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDUsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDYsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDcsIDEpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDgsIDEpLCB0cnVlKTtcblxuXHRcdFx0Y29uc3QgX2V4cGVjdGVkOiBJVGVzdE1pbmltYXBMaW5lUmVuZGVyaW5nRGF0YVtdID0gW1xuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ2NsYXNzIE5pY2UgeycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMTMsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA1LCB2YWx1ZTogMSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogNiwgdmFsdWU6IDIgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogMyB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTIsIHZhbHVlOiA0IH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ1x0ZnVuY3Rpb24gaGkoKSB7Jyxcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAxNyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEsIHZhbHVlOiA1IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogNiB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiA3IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxMiwgdmFsdWU6IDggfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE2LCB2YWx1ZTogOSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdFx0Y29uc29sZS5sb2coXCJIZWxsbyAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIyLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMiwgdmFsdWU6IDEwIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogMTEgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogMTIgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEzLCB2YWx1ZTogMTMgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE0LCB2YWx1ZTogMTQgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIxLCB2YWx1ZTogMTUgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgd29ybGRcIik7Jyxcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEzLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMjEsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxOCwgdmFsdWU6IDE1IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyMCwgdmFsdWU6IDE2IH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ1x0fScsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIsIHZhbHVlOiAxNyB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdGZ1bmN0aW9uIGhlbGxvKCkgeycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMjAsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxLCB2YWx1ZTogMTggfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDksIHZhbHVlOiAxOSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiAyMCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTUsIHZhbHVlOiAyMSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTksIHZhbHVlOiAyMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdFx0Y29uc29sZS5sb2coXCJIZWxsbyAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIyLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMiwgdmFsdWU6IDIzIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogMjQgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogMjUgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEzLCB2YWx1ZTogMjYgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE0LCB2YWx1ZTogMjcgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIxLCB2YWx1ZTogMjggfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgd29ybGQsIHRoaXMgaXMgYSAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMTMsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAzMCxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDI5LCB2YWx1ZTogMjggfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgc29tZXdoYXQgbG9uZ2VyICcsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxMyxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDI5LFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMjgsIHZhbHVlOiAyOCB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICcgICAgICAgICAgICBsaW5lXCIpOycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxMyxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIwLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTcsIHZhbHVlOiAyOCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTksIHZhbHVlOiAyOSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdH0nLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDMsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyLCB2YWx1ZTogMzAgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnfScsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMixcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEsIHZhbHVlOiAzMSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdFx0YXNzZXJ0QWxsTWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShzcGxpdExpbmVzQ29sbGVjdGlvbiwgW1xuXHRcdFx0XHRfZXhwZWN0ZWRbMF0sXG5cdFx0XHRcdF9leHBlY3RlZFsxXSxcblx0XHRcdFx0X2V4cGVjdGVkWzJdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbM10sXG5cdFx0XHRcdF9leHBlY3RlZFs0XSxcblx0XHRcdFx0X2V4cGVjdGVkWzVdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbNl0sXG5cdFx0XHRcdF9leHBlY3RlZFs3XSxcblx0XHRcdFx0X2V4cGVjdGVkWzhdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbOV0sXG5cdFx0XHRcdF9leHBlY3RlZFsxMF0sXG5cdFx0XHRcdF9leHBlY3RlZFsxMV0sXG5cdFx0XHRdKTtcblxuXHRcdFx0c3BsaXRMaW5lc0NvbGxlY3Rpb24uc2V0SGlkZGVuQXJlYXMoW25ldyBSYW5nZSgyLCAxLCA0LCAxKV0pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwbGl0TGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lQ291bnQoKSwgOCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgxLCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSgyLCAxKSwgZmFsc2UpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNwbGl0TGluZXNDb2xsZWN0aW9uLm1vZGVsUG9zaXRpb25Jc1Zpc2libGUoMywgMSksIGZhbHNlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5tb2RlbFBvc2l0aW9uSXNWaXNpYmxlKDQsIDEpLCBmYWxzZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg1LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg2LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg3LCAxKSwgdHJ1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24ubW9kZWxQb3NpdGlvbklzVmlzaWJsZSg4LCAxKSwgdHJ1ZSk7XG5cblx0XHRcdGFzc2VydEFsbE1pbmltYXBMaW5lc1JlbmRlcmluZ0RhdGEoc3BsaXRMaW5lc0NvbGxlY3Rpb24sIFtcblx0XHRcdFx0X2V4cGVjdGVkWzBdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbNV0sXG5cdFx0XHRcdF9leHBlY3RlZFs2XSxcblx0XHRcdFx0X2V4cGVjdGVkWzddLFxuXHRcdFx0XHRfZXhwZWN0ZWRbOF0sXG5cdFx0XHRcdF9leHBlY3RlZFs5XSxcblx0XHRcdFx0X2V4cGVjdGVkWzEwXSxcblx0XHRcdFx0X2V4cGVjdGVkWzExXSxcblx0XHRcdF0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRWaWV3TGluZXNEYXRhIC0gd2l0aCB3cmFwcGluZyBhbmQgaW5qZWN0ZWQgdGV4dCcsICgpID0+IHtcblx0XHRtb2RlbC5kZWx0YURlY29yYXRpb25zKFtdLCBbe1xuXHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCA5LCAxLCA5KSxcblx0XHRcdG9wdGlvbnM6IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246ICdleGFtcGxlJyxcblx0XHRcdFx0YWZ0ZXI6IHtcblx0XHRcdFx0XHRjb250ZW50OiAndmVyeSB2ZXJ5IGxvbmcgaW5qZWN0ZWQgdGV4dCB0aGF0IGNhdXNlcyBhIGxpbmUgYnJlYWsnLFxuXHRcdFx0XHRcdGlubGluZUNsYXNzTmFtZTogJ215Q2xhc3NOYW1lJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzaG93SWZDb2xsYXBzZWQ6IHRydWUsXG5cdFx0XHR9XG5cdFx0fV0pO1xuXG5cdFx0d2l0aFNwbGl0TGluZXNDb2xsZWN0aW9uKG1vZGVsLCAnd29yZFdyYXBDb2x1bW4nLCAzMCwgKHNwbGl0TGluZXNDb2xsZWN0aW9uKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3BsaXRMaW5lc0NvbGxlY3Rpb24uZ2V0Vmlld0xpbmVDb3VudCgpLCAxNCk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcGxpdExpbmVzQ29sbGVjdGlvbi5nZXRWaWV3TGluZU1heENvbHVtbigxKSwgMjQpO1xuXG5cdFx0XHRjb25zdCBfZXhwZWN0ZWQ6IElUZXN0TWluaW1hcExpbmVSZW5kZXJpbmdEYXRhW10gPSBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnY2xhc3MgTml2ZXJ5IHZlcnkgbG9uZyAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDI0LFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogNSwgdmFsdWU6IDEgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDYsIHZhbHVlOiAyIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA4LCB2YWx1ZTogMyB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMjMsIHZhbHVlOiAxIH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJyAgICBpbmplY3RlZCB0ZXh0IHRoYXQgY2F1c2VzICcsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiA1LFxuXHRcdFx0XHRcdG1heENvbHVtbjogMzEsXG5cdFx0XHRcdFx0dG9rZW5zOiBbeyBlbmRJbmRleDogMzAsIHZhbHVlOiAxIH1dXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgIGEgbGluZSBicmVha2NlIHsnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogNSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIxLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTYsIHZhbHVlOiAxIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxOCwgdmFsdWU6IDMgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIwLCB2YWx1ZTogNCB9XG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ1x0ZnVuY3Rpb24gaGkoKSB7Jyxcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAxNyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEsIHZhbHVlOiA1IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogNiB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiA3IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxMiwgdmFsdWU6IDggfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE2LCB2YWx1ZTogOSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdFx0Y29uc29sZS5sb2coXCJIZWxsbyAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIyLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMiwgdmFsdWU6IDEwIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogMTEgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogMTIgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEzLCB2YWx1ZTogMTMgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE0LCB2YWx1ZTogMTQgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIxLCB2YWx1ZTogMTUgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgd29ybGRcIik7Jyxcblx0XHRcdFx0XHRtaW5Db2x1bW46IDEzLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMjEsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxOCwgdmFsdWU6IDE1IH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyMCwgdmFsdWU6IDE2IH0sXG5cdFx0XHRcdFx0XVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Y29udGVudDogJ1x0fScsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMyxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIsIHZhbHVlOiAxNyB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdGZ1bmN0aW9uIGhlbGxvKCkgeycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMjAsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAxLCB2YWx1ZTogMTggfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDksIHZhbHVlOiAxOSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTAsIHZhbHVlOiAyMCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTUsIHZhbHVlOiAyMSB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTksIHZhbHVlOiAyMiB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdFx0Y29uc29sZS5sb2coXCJIZWxsbyAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIyLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMiwgdmFsdWU6IDIzIH0sXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiA5LCB2YWx1ZTogMjQgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEwLCB2YWx1ZTogMjUgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEzLCB2YWx1ZTogMjYgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDE0LCB2YWx1ZTogMjcgfSxcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDIxLCB2YWx1ZTogMjggfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgd29ybGQsIHRoaXMgaXMgYSAnLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMTMsXG5cdFx0XHRcdFx0bWF4Q29sdW1uOiAzMCxcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDI5LCB2YWx1ZTogMjggfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnICAgICAgICAgICAgc29tZXdoYXQgbG9uZ2VyICcsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxMyxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDI5LFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMjgsIHZhbHVlOiAyOCB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICcgICAgICAgICAgICBsaW5lXCIpOycsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxMyxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDIwLFxuXHRcdFx0XHRcdHRva2VuczogW1xuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTcsIHZhbHVlOiAyOCB9LFxuXHRcdFx0XHRcdFx0eyBlbmRJbmRleDogMTksIHZhbHVlOiAyOSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGNvbnRlbnQ6ICdcdH0nLFxuXHRcdFx0XHRcdG1pbkNvbHVtbjogMSxcblx0XHRcdFx0XHRtYXhDb2x1bW46IDMsXG5cdFx0XHRcdFx0dG9rZW5zOiBbXG5cdFx0XHRcdFx0XHR7IGVuZEluZGV4OiAyLCB2YWx1ZTogMzAgfSxcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRjb250ZW50OiAnfScsXG5cdFx0XHRcdFx0bWluQ29sdW1uOiAxLFxuXHRcdFx0XHRcdG1heENvbHVtbjogMixcblx0XHRcdFx0XHR0b2tlbnM6IFtcblx0XHRcdFx0XHRcdHsgZW5kSW5kZXg6IDEsIHZhbHVlOiAzMSB9LFxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fVxuXHRcdFx0XTtcblxuXHRcdFx0YXNzZXJ0QWxsTWluaW1hcExpbmVzUmVuZGVyaW5nRGF0YShzcGxpdExpbmVzQ29sbGVjdGlvbiwgW1xuXHRcdFx0XHRfZXhwZWN0ZWRbMF0sXG5cdFx0XHRcdF9leHBlY3RlZFsxXSxcblx0XHRcdFx0X2V4cGVjdGVkWzJdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbM10sXG5cdFx0XHRcdF9leHBlY3RlZFs0XSxcblx0XHRcdFx0X2V4cGVjdGVkWzVdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbNl0sXG5cdFx0XHRcdF9leHBlY3RlZFs3XSxcblx0XHRcdFx0X2V4cGVjdGVkWzhdLFxuXHRcdFx0XHRfZXhwZWN0ZWRbOV0sXG5cdFx0XHRcdF9leHBlY3RlZFsxMF0sXG5cdFx0XHRcdF9leHBlY3RlZFsxMV0sXG5cdFx0XHRdKTtcblxuXHRcdFx0Y29uc3QgZGF0YSA9IHNwbGl0TGluZXNDb2xsZWN0aW9uLmdldFZpZXdMaW5lc0RhdGEoMSwgMTQsIG5ldyBBcnJheSgxNCkuZmlsbCh0cnVlKSk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRkYXRhLm1hcCgoZCkgPT4gKHtcblx0XHRcdFx0XHRpbmxpbmVEZWNvcmF0aW9uczogZC5pbmxpbmVEZWNvcmF0aW9ucz8ubWFwKChkKSA9PiAoe1xuXHRcdFx0XHRcdFx0c3RhcnRPZmZzZXQ6IGQuc3RhcnRPZmZzZXQsXG5cdFx0XHRcdFx0XHRlbmRPZmZzZXQ6IGQuZW5kT2Zmc2V0LFxuXHRcdFx0XHRcdH0pKSxcblx0XHRcdFx0fSkpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogW3sgc3RhcnRPZmZzZXQ6IDgsIGVuZE9mZnNldDogMjMgfV0gfSxcblx0XHRcdFx0XHR7IGlubGluZURlY29yYXRpb25zOiBbeyBzdGFydE9mZnNldDogNCwgZW5kT2Zmc2V0OiAzMCB9XSB9LFxuXHRcdFx0XHRcdHsgaW5saW5lRGVjb3JhdGlvbnM6IFt7IHN0YXJ0T2Zmc2V0OiA0LCBlbmRPZmZzZXQ6IDE2IH1dIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdFx0eyBpbmxpbmVEZWNvcmF0aW9uczogdW5kZWZpbmVkIH0sXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHdpdGhTcGxpdExpbmVzQ29sbGVjdGlvbihtb2RlbDogVGV4dE1vZGVsLCB3b3JkV3JhcDogJ29uJyB8ICdvZmYnIHwgJ3dvcmRXcmFwQ29sdW1uJyB8ICdib3VuZGVkJywgd29yZFdyYXBDb2x1bW46IG51bWJlciwgY2FsbGJhY2s6IChzcGxpdExpbmVzQ29sbGVjdGlvbjogVmlld01vZGVsTGluZXNGcm9tUHJvamVjdGVkTW9kZWwpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRjb25zdCBjb25maWd1cmF0aW9uID0gbmV3IFRlc3RDb25maWd1cmF0aW9uKHtcblx0XHRcdHdvcmRXcmFwOiB3b3JkV3JhcCxcblx0XHRcdHdvcmRXcmFwQ29sdW1uOiB3b3JkV3JhcENvbHVtbixcblx0XHRcdHdyYXBwaW5nSW5kZW50OiAnaW5kZW50J1xuXHRcdH0pO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5mbyA9IGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndyYXBwaW5nSW5mbyk7XG5cdFx0Y29uc3QgZm9udEluZm8gPSBjb25maWd1cmF0aW9uLm9wdGlvbnMuZ2V0KEVkaXRvck9wdGlvbi5mb250SW5mbyk7XG5cdFx0Y29uc3Qgd29yZFdyYXBCcmVha0FmdGVyQ2hhcmFjdGVycyA9IGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndvcmRXcmFwQnJlYWtBZnRlckNoYXJhY3RlcnMpO1xuXHRcdGNvbnN0IHdvcmRXcmFwQnJlYWtCZWZvcmVDaGFyYWN0ZXJzID0gY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ud29yZFdyYXBCcmVha0JlZm9yZUNoYXJhY3RlcnMpO1xuXHRcdGNvbnN0IHdyYXBwaW5nSW5kZW50ID0gY29uZmlndXJhdGlvbi5vcHRpb25zLmdldChFZGl0b3JPcHRpb24ud3JhcHBpbmdJbmRlbnQpO1xuXHRcdGNvbnN0IHdvcmRCcmVhayA9IGNvbmZpZ3VyYXRpb24ub3B0aW9ucy5nZXQoRWRpdG9yT3B0aW9uLndvcmRCcmVhayk7XG5cblx0XHRjb25zdCBsaW5lQnJlYWtzQ29tcHV0ZXJGYWN0b3J5ID0gbmV3IE1vbm9zcGFjZUxpbmVCcmVha3NDb21wdXRlckZhY3Rvcnkod29yZFdyYXBCcmVha0JlZm9yZUNoYXJhY3RlcnMsIHdvcmRXcmFwQnJlYWtBZnRlckNoYXJhY3RlcnMpO1xuXG5cdFx0Y29uc3QgbGluZXNDb2xsZWN0aW9uID0gbmV3IFZpZXdNb2RlbExpbmVzRnJvbVByb2plY3RlZE1vZGVsKFxuXHRcdFx0MSxcblx0XHRcdG1vZGVsLFxuXHRcdFx0bGluZUJyZWFrc0NvbXB1dGVyRmFjdG9yeSxcblx0XHRcdGxpbmVCcmVha3NDb21wdXRlckZhY3RvcnksXG5cdFx0XHRmb250SW5mbyxcblx0XHRcdG1vZGVsLmdldE9wdGlvbnMoKS50YWJTaXplLFxuXHRcdFx0J3NpbXBsZScsXG5cdFx0XHR3cmFwcGluZ0luZm8ud3JhcHBpbmdDb2x1bW4sXG5cdFx0XHR3cmFwcGluZ0luZGVudCxcblx0XHRcdHdvcmRCcmVha1xuXHRcdCk7XG5cblx0XHRjYWxsYmFjayhsaW5lc0NvbGxlY3Rpb24pO1xuXG5cdFx0Y29uZmlndXJhdGlvbi5kaXNwb3NlKCk7XG5cdH1cbn0pO1xuXG5cbmZ1bmN0aW9uIHBvcyhsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKTogUG9zaXRpb24ge1xuXHRyZXR1cm4gbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZVNwbGl0TGluZShzcGxpdExlbmd0aHM6IG51bWJlcltdLCBicmVha2luZ09mZnNldHNWaXNpYmxlQ29sdW1uOiBudW1iZXJbXSwgd3JhcHBlZFRleHRJbmRlbnRXaWR0aDogbnVtYmVyLCBpc1Zpc2libGU6IGJvb2xlYW4gPSB0cnVlKTogSU1vZGVsTGluZVByb2plY3Rpb24ge1xuXHRyZXR1cm4gY3JlYXRlTW9kZWxMaW5lUHJvamVjdGlvbihjcmVhdGVMaW5lQnJlYWtEYXRhKHNwbGl0TGVuZ3RocywgYnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtbiwgd3JhcHBlZFRleHRJbmRlbnRXaWR0aCksIGlzVmlzaWJsZSk7XG59XG5cbmZ1bmN0aW9uIGNyZWF0ZUxpbmVCcmVha0RhdGEoYnJlYWtpbmdMZW5ndGhzOiBudW1iZXJbXSwgYnJlYWtpbmdPZmZzZXRzVmlzaWJsZUNvbHVtbjogbnVtYmVyW10sIHdyYXBwZWRUZXh0SW5kZW50V2lkdGg6IG51bWJlcik6IE1vZGVsTGluZVByb2plY3Rpb25EYXRhIHtcblx0Y29uc3Qgc3VtczogbnVtYmVyW10gPSBbXTtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBicmVha2luZ0xlbmd0aHMubGVuZ3RoOyBpKyspIHtcblx0XHRzdW1zW2ldID0gKGkgPiAwID8gc3Vtc1tpIC0gMV0gOiAwKSArIGJyZWFraW5nTGVuZ3Roc1tpXTtcblx0fVxuXHRyZXR1cm4gbmV3IE1vZGVsTGluZVByb2plY3Rpb25EYXRhKG51bGwsIG51bGwsIHN1bXMsIGJyZWFraW5nT2Zmc2V0c1Zpc2libGVDb2x1bW4sIHdyYXBwZWRUZXh0SW5kZW50V2lkdGgpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVNb2RlbCh0ZXh0OiBzdHJpbmcpOiBJU2ltcGxlTW9kZWwge1xuXHRyZXR1cm4ge1xuXHRcdHRva2VuaXphdGlvbjoge1xuXHRcdFx0Z2V0TGluZVRva2VuczogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gbnVsbCE7XG5cdFx0XHR9LFxuXHRcdH0sXG5cdFx0Z2V0TGluZUNvbnRlbnQ6IChsaW5lTnVtYmVyOiBudW1iZXIpID0+IHtcblx0XHRcdHJldHVybiB0ZXh0O1xuXHRcdH0sXG5cdFx0Z2V0TGluZUxlbmd0aDogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0cmV0dXJuIHRleHQubGVuZ3RoO1xuXHRcdH0sXG5cdFx0Z2V0TGluZU1pbkNvbHVtbjogKGxpbmVOdW1iZXI6IG51bWJlcikgPT4ge1xuXHRcdFx0cmV0dXJuIDE7XG5cdFx0fSxcblx0XHRnZXRMaW5lTWF4Q29sdW1uOiAobGluZU51bWJlcjogbnVtYmVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gdGV4dC5sZW5ndGggKyAxO1xuXHRcdH0sXG5cdFx0Z2V0VmFsdWVJblJhbmdlOiAocmFuZ2U6IElSYW5nZSwgZW9sPzogRW5kT2ZMaW5lUHJlZmVyZW5jZSkgPT4ge1xuXHRcdFx0cmV0dXJuIHRleHQuc3Vic3RyaW5nKHJhbmdlLnN0YXJ0Q29sdW1uIC0gMSwgcmFuZ2UuZW5kQ29sdW1uIC0gMSk7XG5cdFx0fVxuXHR9O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBRW5CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQWlCLGFBQWE7QUFDOUIsU0FBUyxzQkFBc0I7QUFDL0IsWUFBWSxlQUFlO0FBQzNCLFNBQVMsaUJBQWlCO0FB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QUcsRUFBRTtBQUM5RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtBQUM5RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtBQUM5RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUM3RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtBQUM5RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsRUFBRTtBQUM5RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUM3RCxhQUFPLFlBQVksZ0JBQWdCLHFCQUFxQixDQUFDLEdBQUcsQ0FBQztBQUc3RCxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLElBQUksQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNwRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztBQUNuRyxhQUFPLGdCQUFnQixnQkFBZ0IsbUNBQW1DLEdBQUcsQ0FBQyxHQUFHLElBQUksU0FBUyxHQUFHLENBQUMsQ0FBQztB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RSxZQUFZLEdBQUcsT0FBTyxFQUFFO0FBQUEsTUFDMUIsRUFBRSxZQUFZLEdBQUcsT0FBTyxFQUFFO0FBQUEsTUFDMUIsRUFBRSxZQUFZLEdBQUcsT0FBTyxFQUFFO0FBQUEsTUFDMUIsRUFBRSxZQUFZLElBQUksT0FBTyxFQUFFO0FBQUEsSUFDNUI7QUFBQSxJQUNBO0FBQUEsTUFDQyxFQUFFLFlBQVksR0FBRyxPQUFPLEVBQUU7QUFBQSxNQUMxQixFQUFFLFlBQVksR0FBRyxPQUFPLEVBQUU7QUFBQSxNQUMxQixFQUFFLFlBQVksR0FBRyxPQUFPLEVBQUU7QUFBQSxNQUMxQixFQUFFLFlBQVksSUFBSSxPQUFPLEVBQUU7QUFBQSxNQUMzQixFQUFFLFlBQVksSUFBSSxPQUFPLEVBQUU7QUFBQSxJQUM1QjtBQUFBLElBQ0E7QUFBQSxNQUNDLEVBQUUsWUFBWSxHQUFHLE9BQU8sR0FBRztBQUFBLE1BQzNCLEVBQUUsWUFBWSxHQUFHLE9BQU8sR0FBRztBQUFBLE1BQzNCLEVBQUUsWUFBWSxHQUFHLE9BQU8sR0FBRztBQUFBLE1BQzNCLEVBQUUsWUFBWSxJQUFJLE9BQU8sR0FBRztBQUFBLE1BQzVCLEVBQUUsWUFBWSxJQUFJLE9BQU8sR0FBRztBQUFBLE1BQzVCLEVBQUUsWUFBWSxJQUFJLE9BQU8sR0FBRztBQUFBLE1BQzVCLEVBQUUsWUFBWSxJQUFJLE9BQU8sR0FBRztBQUFBLElBQzdCO0FBQUEsSUFDQTtBQUFBLE1BQ0MsRUFBRSxZQUFZLEdBQUcsT0FBTyxHQUFHO0FBQUEsSUFDNUI7QUFBQSxJQUNBO0FBQUEsTUFDQyxFQUFFLFlBQVksR0FBRyxPQUFPLEdBQUc7QUFBQSxNQUMzQixFQUFFLFlBQVksR0FBRyxPQUFPLEdBQUc7QUFBQSxNQUMzQixFQUFFLFlBQVksR0FBRyxPQUFPLEdBQUc7QUFBQSxNQUMzQixFQUFFLFlBQVksSUFBSSxPQUFPLEdBQUc7QUFBQSxNQUM1QixFQUFFLFlBQVksSUFBSSxPQUFPLEdBQUc7QUFBQSxJQUM3QjtBQUFBLElBQ0E7QUFBQSxNQUNDLEVBQUUsWUFBWSxH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QU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFdBQVc7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QUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sRUFBRTtBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sRUFBRTtBQUFBLFlBQ3hCLEVBQUUsVUFBVSxHQUFHLE9BQU8sRUFBRTtBQUFBLFlBQ3hCLEVBQUUsVUFBVSxJQUFJLE9BQU8sRUFBRTtBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sRUFBRTtBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sRUFBRTtBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFVBQzFCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxHQUFHLE9BQU8sR0FBRztBQUFBLFlBQ3pCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFlBQzFCLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdBQVc7QUFBQSxVQUNYLFFBQVE7QUFBQSxZQUNQLEVBQUUsVUFBVSxJQUFJLE9BQU8sR0FBRztBQUFBLFVBQzNCO0FBQUEsUUFDRDtBQUFBLFFBQ0E7QUFBQSxVQUNDLFNBQVM7QUFBQSxVQUNULFdBQVc7QUFBQSxVQUNYLFdB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LEdBQUcsT0FBTyxHQUFHO0FBQUEsWUFDekIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsVUFDMUI7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsWUFDekIsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsWUFDekIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsWUFDekIsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsWUFDekIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsWUFDMUIsRUFBRSxVQUFVLElBQUksT0FBTyxHQUFHO0FBQUEsVUFDM0I7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsVUFDMUI7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFVBQ0MsU0FBUztBQUFBLFVBQ1QsV0FBVztBQUFBLFVBQ1gsV0FBVztBQUFBLFVBQ1gsUUFBUTtBQUFBLFlBQ1AsRUFBRSxVQUFVLEdBQUcsT0FBTyxHQUFHO0FBQUEsVUFDMUI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUVBLHlDQUFtQyxzQkFBc0I7QUFBQSxRQUN4RCxVQUFVLENBQUM7QUFBQSxRQUNYLFVBQVUsQ0FBQztBQUFBLFFBQ1gsVUFBVSxDQUFD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
