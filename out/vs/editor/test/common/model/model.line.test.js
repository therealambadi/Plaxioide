import assert from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Range } from "../../../common/core/range.js";
import { MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../common/languages.js";
import { computeIndentLevel } from "../../../common/model/utils.js";
import { ContiguousMultilineTokensBuilder } from "../../../common/tokens/contiguousMultilineTokensBuilder.js";
import { LineTokens } from "../../../common/tokens/lineTokens.js";
import { TestLineTokenFactory } from "../core/testLineToken.js";
import { createTextModel } from "../testTextModel.js";
function assertLineTokens(__actual, _expected) {
  const tmp = TestToken.toTokens(_expected);
  LineTokens.convertToEndOffset(tmp, __actual.getLineContent().length);
  const expected = TestLineTokenFactory.inflateArr(tmp);
  const _actual = __actual.inflate();
  const actual = [];
  for (let i = 0, len = _actual.getCount(); i < len; i++) {
    actual[i] = {
      endIndex: _actual.getEndOffset(i),
      type: _actual.getClassName(i)
    };
  }
  const decode = (token) => {
    return {
      endIndex: token.endIndex,
      type: token.getType()
    };
  };
  assert.deepStrictEqual(actual, expected.map(decode));
}
suite("ModelLine - getIndentLevel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertIndentLevel(text, expected, tabSize = 4) {
    const actual = computeIndentLevel(text, tabSize);
    assert.strictEqual(actual, expected, text);
  }
  test("getIndentLevel", () => {
    assertIndentLevel("", -1);
    assertIndentLevel(" ", -1);
    assertIndentLevel("   	", -1);
    assertIndentLevel("Hello", 0);
    assertIndentLevel(" Hello", 1);
    assertIndentLevel("   Hello", 3);
    assertIndentLevel("	Hello", 4);
    assertIndentLevel(" 	Hello", 4);
    assertIndentLevel("  	Hello", 4);
    assertIndentLevel("   	Hello", 4);
    assertIndentLevel("    	Hello", 8);
    assertIndentLevel("     	Hello", 8);
    assertIndentLevel("	 Hello", 5);
    assertIndentLevel("	 	Hello", 8);
  });
});
class TestToken {
  constructor(startOffset, color) {
    this.startOffset = startOffset;
    this.color = color;
  }
  static toTokens(tokens) {
    if (tokens === null) {
      return null;
    }
    const tokensLen = tokens.length;
    const result = new Uint32Array(tokensLen << 1);
    for (let i = 0; i < tokensLen; i++) {
      const token = tokens[i];
      result[i << 1] = token.startOffset;
      result[(i << 1) + 1] = token.color << MetadataConsts.FOREGROUND_OFFSET >>> 0;
    }
    return result;
  }
}
class ManualTokenizationSupport {
  constructor() {
    this.tokens = /* @__PURE__ */ new Map();
    this.stores = /* @__PURE__ */ new Set();
  }
  setLineTokens(lineNumber, tokens) {
    const b = new ContiguousMultilineTokensBuilder();
    b.add(lineNumber, tokens);
    for (const s of this.stores) {
      s.setTokens(b.finalize());
    }
  }
  getInitialState() {
    return new LineState(1);
  }
  tokenize(line, hasEOL, state) {
    throw new Error();
  }
  tokenizeEncoded(line, hasEOL, state) {
    const s = state;
    return new EncodedTokenizationResult(this.tokens.get(s.lineNumber), new LineState(s.lineNumber + 1));
  }
  /**
   * Can be/return undefined if default background tokenization should be used.
   */
  createBackgroundTokenizer(textModel, store) {
    this.stores.add(store);
    return {
      dispose: () => {
        this.stores.delete(store);
      },
      requestTokens(startLineNumber, endLineNumberExclusive) {
      }
    };
  }
}
class LineState {
  constructor(lineNumber) {
    this.lineNumber = lineNumber;
  }
  clone() {
    return this;
  }
  equals(other) {
    return other.lineNumber === this.lineNumber;
  }
}
suite("ModelLinesTokens", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testApplyEdits(initial, edits, expected) {
    const initialText = initial.map((el) => el.text).join("\n");
    const s = new ManualTokenizationSupport();
    const d = TokenizationRegistry.register("test", s);
    const model = createTextModel(initialText, "test");
    model.onBeforeAttached();
    for (let lineIndex = 0; lineIndex < initial.length; lineIndex++) {
      const lineTokens = initial[lineIndex].tokens;
      const lineTextLength = model.getLineMaxColumn(lineIndex + 1) - 1;
      const tokens = TestToken.toTokens(lineTokens);
      LineTokens.convertToEndOffset(tokens, lineTextLength);
      s.setLineTokens(lineIndex + 1, tokens);
    }
    model.applyEdits(edits.map((ed) => ({
      identifier: null,
      range: ed.range,
      text: ed.text,
      forceMoveMarkers: false
    })));
    for (let lineIndex = 0; lineIndex < expected.length; lineIndex++) {
      const actualLine = model.getLineContent(lineIndex + 1);
      const actualTokens = model.tokenization.getLineTokens(lineIndex + 1);
      assert.strictEqual(actualLine, expected[lineIndex].text);
      assertLineTokens(actualTokens, expected[lineIndex].tokens);
    }
    model.dispose();
    d.dispose();
  }
  test("single delete 1", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 1, 1, 2), text: "" }],
      [{
        text: "ello world",
        tokens: [new TestToken(0, 1), new TestToken(4, 2), new TestToken(5, 3)]
      }]
    );
  });
  test("single delete 2", () => {
    testApplyEdits(
      [{
        text: "helloworld",
        tokens: [new TestToken(0, 1), new TestToken(5, 2)]
      }],
      [{ range: new Range(1, 3, 1, 8), text: "" }],
      [{
        text: "herld",
        tokens: [new TestToken(0, 1), new TestToken(2, 2)]
      }]
    );
  });
  test("single delete 3", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 1, 1, 6), text: "" }],
      [{
        text: " world",
        tokens: [new TestToken(0, 2), new TestToken(1, 3)]
      }]
    );
  });
  test("single delete 4", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 2, 1, 7), text: "" }],
      [{
        text: "hworld",
        tokens: [new TestToken(0, 1), new TestToken(1, 3)]
      }]
    );
  });
  test("single delete 5", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 1, 1, 12), text: "" }],
      [{
        text: "",
        tokens: [new TestToken(0, 1)]
      }]
    );
  });
  test("multi delete 6", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 7), new TestToken(5, 8), new TestToken(6, 9)]
      }],
      [{ range: new Range(1, 6, 3, 6), text: "" }],
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 8), new TestToken(6, 9)]
      }]
    );
  });
  test("multi delete 7", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 7), new TestToken(5, 8), new TestToken(6, 9)]
      }],
      [{ range: new Range(1, 12, 3, 12), text: "" }],
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }]
    );
  });
  test("multi delete 8", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 7), new TestToken(5, 8), new TestToken(6, 9)]
      }],
      [{ range: new Range(1, 1, 3, 1), text: "" }],
      [{
        text: "hello world",
        tokens: [new TestToken(0, 7), new TestToken(5, 8), new TestToken(6, 9)]
      }]
    );
  });
  test("multi delete 9", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 7), new TestToken(5, 8), new TestToken(6, 9)]
      }],
      [{ range: new Range(1, 12, 3, 1), text: "" }],
      [{
        text: "hello worldhello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3), new TestToken(11, 7), new TestToken(16, 8), new TestToken(17, 9)]
      }]
    );
  });
  test("single insert 1", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 1, 1, 1), text: "xx" }],
      [{
        text: "xxhello world",
        tokens: [new TestToken(0, 1), new TestToken(7, 2), new TestToken(8, 3)]
      }]
    );
  });
  test("single insert 2", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 2, 1, 2), text: "xx" }],
      [{
        text: "hxxello world",
        tokens: [new TestToken(0, 1), new TestToken(7, 2), new TestToken(8, 3)]
      }]
    );
  });
  test("single insert 3", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 6, 1, 6), text: "xx" }],
      [{
        text: "helloxx world",
        tokens: [new TestToken(0, 1), new TestToken(7, 2), new TestToken(8, 3)]
      }]
    );
  });
  test("single insert 4", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 7, 1, 7), text: "xx" }],
      [{
        text: "hello xxworld",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(8, 3)]
      }]
    );
  });
  test("single insert 5", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 12, 1, 12), text: "xx" }],
      [{
        text: "hello worldxx",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }]
    );
  });
  test("multi insert 6", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 1, 1, 1), text: "\n" }],
      [{
        text: "",
        tokens: [new TestToken(0, 1)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 1)]
      }]
    );
  });
  test("multi insert 7", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 12, 1, 12), text: "\n" }],
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "",
        tokens: [new TestToken(0, 1)]
      }]
    );
  });
  test("multi insert 8", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }],
      [{ range: new Range(1, 7, 1, 7), text: "\n" }],
      [{
        text: "hello ",
        tokens: [new TestToken(0, 1), new TestToken(5, 2)]
      }, {
        text: "world",
        tokens: [new TestToken(0, 1)]
      }]
    );
  });
  test("multi insert 9", () => {
    testApplyEdits(
      [{
        text: "hello world",
        tokens: [new TestToken(0, 1), new TestToken(5, 2), new TestToken(6, 3)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }],
      [{ range: new Range(1, 7, 1, 7), text: "xx\nyy" }],
      [{
        text: "hello xx",
        tokens: [new TestToken(0, 1), new TestToken(5, 2)]
      }, {
        text: "yyworld",
        tokens: [new TestToken(0, 1)]
      }, {
        text: "hello world",
        tokens: [new TestToken(0, 4), new TestToken(5, 5), new TestToken(6, 6)]
      }]
    );
  });
  function testLineEditTokens(initialText, initialTokens, edits, expectedText, expectedTokens) {
    testApplyEdits(
      [{
        text: initialText,
        tokens: initialTokens
      }],
      edits.map((ed) => ({
        range: new Range(1, ed.startColumn, 1, ed.endColumn),
        text: ed.text
      })),
      [{
        text: expectedText,
        tokens: expectedTokens
      }]
    );
  }
  test("insertion on empty line", () => {
    const s = new ManualTokenizationSupport();
    const d = TokenizationRegistry.register("test", s);
    const model = createTextModel("some text", "test");
    const tokens = TestToken.toTokens([new TestToken(0, 1)]);
    LineTokens.convertToEndOffset(tokens, model.getLineMaxColumn(1) - 1);
    s.setLineTokens(1, tokens);
    model.applyEdits([{
      range: new Range(1, 1, 1, 10),
      text: ""
    }]);
    s.setLineTokens(1, new Uint32Array(0));
    model.applyEdits([{
      range: new Range(1, 1, 1, 1),
      text: "a"
    }]);
    const actualTokens = model.tokenization.getLineTokens(1);
    assertLineTokens(actualTokens, [new TestToken(0, 1)]);
    model.dispose();
    d.dispose();
  });
  test("updates tokens on insertion 1", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 1,
        text: "a"
      }],
      "aabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(5, 2),
        new TestToken(6, 3)
      ]
    );
  });
  test("updates tokens on insertion 2", () => {
    testLineEditTokens(
      "aabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(5, 2),
        new TestToken(6, 3)
      ],
      [{
        startColumn: 2,
        endColumn: 2,
        text: "x"
      }],
      "axabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(6, 2),
        new TestToken(7, 3)
      ]
    );
  });
  test("updates tokens on insertion 3", () => {
    testLineEditTokens(
      "axabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(6, 2),
        new TestToken(7, 3)
      ],
      [{
        startColumn: 3,
        endColumn: 3,
        text: "stu"
      }],
      "axstuabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(9, 2),
        new TestToken(10, 3)
      ]
    );
  });
  test("updates tokens on insertion 4", () => {
    testLineEditTokens(
      "axstuabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(9, 2),
        new TestToken(10, 3)
      ],
      [{
        startColumn: 10,
        endColumn: 10,
        text: "	"
      }],
      "axstuabcd	 efgh",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(11, 3)
      ]
    );
  });
  test("updates tokens on insertion 5", () => {
    testLineEditTokens(
      "axstuabcd	 efgh",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(11, 3)
      ],
      [{
        startColumn: 12,
        endColumn: 12,
        text: "dd"
      }],
      "axstuabcd	 ddefgh",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(13, 3)
      ]
    );
  });
  test("updates tokens on insertion 6", () => {
    testLineEditTokens(
      "axstuabcd	 ddefgh",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(13, 3)
      ],
      [{
        startColumn: 18,
        endColumn: 18,
        text: "xyz"
      }],
      "axstuabcd	 ddefghxyz",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(13, 3)
      ]
    );
  });
  test("updates tokens on insertion 7", () => {
    testLineEditTokens(
      "axstuabcd	 ddefghxyz",
      [
        new TestToken(0, 1),
        new TestToken(10, 2),
        new TestToken(13, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 1,
        text: "x"
      }],
      "xaxstuabcd	 ddefghxyz",
      [
        new TestToken(0, 1),
        new TestToken(11, 2),
        new TestToken(14, 3)
      ]
    );
  });
  test("updates tokens on insertion 8", () => {
    testLineEditTokens(
      "xaxstuabcd	 ddefghxyz",
      [
        new TestToken(0, 1),
        new TestToken(11, 2),
        new TestToken(14, 3)
      ],
      [{
        startColumn: 22,
        endColumn: 22,
        text: "x"
      }],
      "xaxstuabcd	 ddefghxyzx",
      [
        new TestToken(0, 1),
        new TestToken(11, 2),
        new TestToken(14, 3)
      ]
    );
  });
  test("updates tokens on insertion 9", () => {
    testLineEditTokens(
      "xaxstuabcd	 ddefghxyzx",
      [
        new TestToken(0, 1),
        new TestToken(11, 2),
        new TestToken(14, 3)
      ],
      [{
        startColumn: 2,
        endColumn: 2,
        text: ""
      }],
      "xaxstuabcd	 ddefghxyzx",
      [
        new TestToken(0, 1),
        new TestToken(11, 2),
        new TestToken(14, 3)
      ]
    );
  });
  test("updates tokens on insertion 10", () => {
    testLineEditTokens(
      "",
      [],
      [{
        startColumn: 1,
        endColumn: 1,
        text: "a"
      }],
      "a",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("delete second token 2", () => {
    testLineEditTokens(
      "abcdefghij",
      [
        new TestToken(0, 1),
        new TestToken(3, 2),
        new TestToken(6, 3)
      ],
      [{
        startColumn: 4,
        endColumn: 7,
        text: ""
      }],
      "abcghij",
      [
        new TestToken(0, 1),
        new TestToken(3, 3)
      ]
    );
  });
  test("insert right before second token", () => {
    testLineEditTokens(
      "abcdefghij",
      [
        new TestToken(0, 1),
        new TestToken(3, 2),
        new TestToken(6, 3)
      ],
      [{
        startColumn: 4,
        endColumn: 4,
        text: "hello"
      }],
      "abchellodefghij",
      [
        new TestToken(0, 1),
        new TestToken(8, 2),
        new TestToken(11, 3)
      ]
    );
  });
  test("delete first char", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 2,
        text: ""
      }],
      "bcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(3, 2),
        new TestToken(4, 3)
      ]
    );
  });
  test("delete 2nd and 3rd chars", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 2,
        endColumn: 4,
        text: ""
      }],
      "ad efgh",
      [
        new TestToken(0, 1),
        new TestToken(2, 2),
        new TestToken(3, 3)
      ]
    );
  });
  test("delete first token", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 5,
        text: ""
      }],
      " efgh",
      [
        new TestToken(0, 2),
        new TestToken(1, 3)
      ]
    );
  });
  test("delete second token", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 5,
        endColumn: 6,
        text: ""
      }],
      "abcdefgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 3)
      ]
    );
  });
  test("delete second token + a bit of the third one", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 5,
        endColumn: 7,
        text: ""
      }],
      "abcdfgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 3)
      ]
    );
  });
  test("delete second and third token", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 5,
        endColumn: 10,
        text: ""
      }],
      "abcd",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("delete everything", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 10,
        text: ""
      }],
      "",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("noop", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 1,
        text: ""
      }],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
  test("equivalent to deleting first two chars", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 1,
        endColumn: 3,
        text: ""
      }],
      "cd efgh",
      [
        new TestToken(0, 1),
        new TestToken(2, 2),
        new TestToken(3, 3)
      ]
    );
  });
  test("equivalent to deleting from 5 to the end", () => {
    testLineEditTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      [{
        startColumn: 5,
        endColumn: 10,
        text: ""
      }],
      "abcd",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("updates tokens on replace 1", () => {
    testLineEditTokens(
      "Hello world, ciao",
      [
        new TestToken(0, 1),
        new TestToken(5, 0),
        new TestToken(6, 2),
        new TestToken(11, 0),
        new TestToken(13, 0)
      ],
      [{
        startColumn: 1,
        endColumn: 6,
        text: "Hi"
      }],
      "Hi world, ciao",
      [
        new TestToken(0, 0),
        new TestToken(3, 2),
        new TestToken(8, 0),
        new TestToken(10, 0)
      ]
    );
  });
  test("updates tokens on replace 2", () => {
    testLineEditTokens(
      "Hello world, ciao",
      [
        new TestToken(0, 1),
        new TestToken(5, 0),
        new TestToken(6, 2),
        new TestToken(11, 0),
        new TestToken(13, 0)
      ],
      [{
        startColumn: 1,
        endColumn: 6,
        text: "Hi"
      }, {
        startColumn: 8,
        endColumn: 12,
        text: "my friends"
      }],
      "Hi wmy friends, ciao",
      [
        new TestToken(0, 0),
        new TestToken(3, 2),
        new TestToken(14, 0),
        new TestToken(16, 0)
      ]
    );
  });
  function testLineSplitTokens(initialText, initialTokens, splitColumn, expectedText1, expectedText2, expectedTokens) {
    testApplyEdits(
      [{
        text: initialText,
        tokens: initialTokens
      }],
      [{
        range: new Range(1, splitColumn, 1, splitColumn),
        text: "\n"
      }],
      [{
        text: expectedText1,
        tokens: expectedTokens
      }, {
        text: expectedText2,
        tokens: [new TestToken(0, 1)]
      }]
    );
  }
  test("split at the beginning", () => {
    testLineSplitTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      1,
      "",
      "abcd efgh",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("split at the end", () => {
    testLineSplitTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      10,
      "abcd efgh",
      "",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
  test("split inthe middle 1", () => {
    testLineSplitTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      5,
      "abcd",
      " efgh",
      [
        new TestToken(0, 1)
      ]
    );
  });
  test("split inthe middle 2", () => {
    testLineSplitTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      6,
      "abcd ",
      "efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2)
      ]
    );
  });
  function testLineAppendTokens(aText, aTokens, bText, bTokens, expectedText, expectedTokens) {
    testApplyEdits(
      [{
        text: aText,
        tokens: aTokens
      }, {
        text: bText,
        tokens: bTokens
      }],
      [{
        range: new Range(1, aText.length + 1, 2, 1),
        text: ""
      }],
      [{
        text: expectedText,
        tokens: expectedTokens
      }]
    );
  }
  test("append empty 1", () => {
    testLineAppendTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      "",
      [],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
  test("append empty 2", () => {
    testLineAppendTokens(
      "",
      [],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
  test("append 1", () => {
    testLineAppendTokens(
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ],
      "abcd efgh",
      [
        new TestToken(0, 4),
        new TestToken(4, 5),
        new TestToken(5, 6)
      ],
      "abcd efghabcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3),
        new TestToken(9, 4),
        new TestToken(13, 5),
        new TestToken(14, 6)
      ]
    );
  });
  test("append 2", () => {
    testLineAppendTokens(
      "abcd ",
      [
        new TestToken(0, 1),
        new TestToken(4, 2)
      ],
      "efgh",
      [
        new TestToken(0, 3)
      ],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
  test("append 3", () => {
    testLineAppendTokens(
      "abcd",
      [
        new TestToken(0, 1)
      ],
      " efgh",
      [
        new TestToken(0, 2),
        new TestToken(1, 3)
      ],
      "abcd efgh",
      [
        new TestToken(0, 1),
        new TestToken(4, 2),
        new TestToken(5, 3)
      ]
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvbW9kZWwubGluZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IE1ldGFkYXRhQ29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCwgSUJhY2tncm91bmRUb2tlbml6YXRpb25TdG9yZSwgSUJhY2tncm91bmRUb2tlbml6ZXIsIElTdGF0ZSwgSVRva2VuaXphdGlvblN1cHBvcnQsIFRva2VuaXphdGlvblJlZ2lzdHJ5LCBUb2tlbml6YXRpb25SZXN1bHQgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgY29tcHV0ZUluZGVudExldmVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsL3V0aWxzLmpzJztcbmltcG9ydCB7IENvbnRpZ3VvdXNNdWx0aWxpbmVUb2tlbnNCdWlsZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9jb250aWd1b3VzTXVsdGlsaW5lVG9rZW5zQnVpbGRlci5qcyc7XG5pbXBvcnQgeyBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IFRlc3RMaW5lVG9rZW4sIFRlc3RMaW5lVG9rZW5GYWN0b3J5IH0gZnJvbSAnLi4vY29yZS90ZXN0TGluZVRva2VuLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG5pbnRlcmZhY2UgSUxpbmVFZGl0IHtcblx0c3RhcnRDb2x1bW46IG51bWJlcjtcblx0ZW5kQ29sdW1uOiBudW1iZXI7XG5cdHRleHQ6IHN0cmluZztcbn1cblxuZnVuY3Rpb24gYXNzZXJ0TGluZVRva2VucyhfX2FjdHVhbDogTGluZVRva2VucywgX2V4cGVjdGVkOiBUZXN0VG9rZW5bXSk6IHZvaWQge1xuXHRjb25zdCB0bXAgPSBUZXN0VG9rZW4udG9Ub2tlbnMoX2V4cGVjdGVkKTtcblx0TGluZVRva2Vucy5jb252ZXJ0VG9FbmRPZmZzZXQodG1wLCBfX2FjdHVhbC5nZXRMaW5lQ29udGVudCgpLmxlbmd0aCk7XG5cdGNvbnN0IGV4cGVjdGVkID0gVGVzdExpbmVUb2tlbkZhY3RvcnkuaW5mbGF0ZUFycih0bXApO1xuXHRjb25zdCBfYWN0dWFsID0gX19hY3R1YWwuaW5mbGF0ZSgpO1xuXHRpbnRlcmZhY2UgSVRlc3RUb2tlbiB7XG5cdFx0ZW5kSW5kZXg6IG51bWJlcjtcblx0XHR0eXBlOiBzdHJpbmc7XG5cdH1cblx0Y29uc3QgYWN0dWFsOiBJVGVzdFRva2VuW10gPSBbXTtcblx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IF9hY3R1YWwuZ2V0Q291bnQoKTsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0YWN0dWFsW2ldID0ge1xuXHRcdFx0ZW5kSW5kZXg6IF9hY3R1YWwuZ2V0RW5kT2Zmc2V0KGkpLFxuXHRcdFx0dHlwZTogX2FjdHVhbC5nZXRDbGFzc05hbWUoaSlcblx0XHR9O1xuXHR9XG5cdGNvbnN0IGRlY29kZSA9ICh0b2tlbjogVGVzdExpbmVUb2tlbikgPT4ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRlbmRJbmRleDogdG9rZW4uZW5kSW5kZXgsXG5cdFx0XHR0eXBlOiB0b2tlbi5nZXRUeXBlKClcblx0XHR9O1xuXHR9O1xuXHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQubWFwKGRlY29kZSkpO1xufVxuXG5zdWl0ZSgnTW9kZWxMaW5lIC0gZ2V0SW5kZW50TGV2ZWwnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gYXNzZXJ0SW5kZW50TGV2ZWwodGV4dDogc3RyaW5nLCBleHBlY3RlZDogbnVtYmVyLCB0YWJTaXplOiBudW1iZXIgPSA0KTogdm9pZCB7XG5cdFx0Y29uc3QgYWN0dWFsID0gY29tcHV0ZUluZGVudExldmVsKHRleHQsIHRhYlNpemUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCB0ZXh0KTtcblx0fVxuXG5cdHRlc3QoJ2dldEluZGVudExldmVsJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudExldmVsKCcnLCAtMSk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyAnLCAtMSk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyAgIFxcdCcsIC0xKTtcblx0XHRhc3NlcnRJbmRlbnRMZXZlbCgnSGVsbG8nLCAwKTtcblx0XHRhc3NlcnRJbmRlbnRMZXZlbCgnIEhlbGxvJywgMSk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyAgIEhlbGxvJywgMyk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJ1xcdEhlbGxvJywgNCk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyBcXHRIZWxsbycsIDQpO1xuXHRcdGFzc2VydEluZGVudExldmVsKCcgIFxcdEhlbGxvJywgNCk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyAgIFxcdEhlbGxvJywgNCk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJyAgICBcXHRIZWxsbycsIDgpO1xuXHRcdGFzc2VydEluZGVudExldmVsKCcgICAgIFxcdEhlbGxvJywgOCk7XG5cdFx0YXNzZXJ0SW5kZW50TGV2ZWwoJ1xcdCBIZWxsbycsIDUpO1xuXHRcdGFzc2VydEluZGVudExldmVsKCdcXHQgXFx0SGVsbG8nLCA4KTtcblx0fSk7XG59KTtcblxuY2xhc3MgVGVzdFRva2VuIHtcblx0cHVibGljIHJlYWRvbmx5IHN0YXJ0T2Zmc2V0OiBudW1iZXI7XG5cdHB1YmxpYyByZWFkb25seSBjb2xvcjogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKHN0YXJ0T2Zmc2V0OiBudW1iZXIsIGNvbG9yOiBudW1iZXIpIHtcblx0XHR0aGlzLnN0YXJ0T2Zmc2V0ID0gc3RhcnRPZmZzZXQ7XG5cdFx0dGhpcy5jb2xvciA9IGNvbG9yO1xuXHR9XG5cblx0cHVibGljIHN0YXRpYyB0b1Rva2Vucyh0b2tlbnM6IFRlc3RUb2tlbltdKTogVWludDMyQXJyYXk7XG5cdHB1YmxpYyBzdGF0aWMgdG9Ub2tlbnModG9rZW5zOiBUZXN0VG9rZW5bXSB8IG51bGwpOiBVaW50MzJBcnJheSB8IG51bGwge1xuXHRcdGlmICh0b2tlbnMgPT09IG51bGwpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRjb25zdCB0b2tlbnNMZW4gPSB0b2tlbnMubGVuZ3RoO1xuXHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50MzJBcnJheSgodG9rZW5zTGVuIDw8IDEpKTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vuc0xlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCB0b2tlbiA9IHRva2Vuc1tpXTtcblx0XHRcdHJlc3VsdFsoaSA8PCAxKV0gPSB0b2tlbi5zdGFydE9mZnNldDtcblx0XHRcdHJlc3VsdFsoaSA8PCAxKSArIDFdID0gKFxuXHRcdFx0XHR0b2tlbi5jb2xvciA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVFxuXHRcdFx0KSA+Pj4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG5jbGFzcyBNYW51YWxUb2tlbml6YXRpb25TdXBwb3J0IGltcGxlbWVudHMgSVRva2VuaXphdGlvblN1cHBvcnQge1xuXHRwcml2YXRlIHJlYWRvbmx5IHRva2VucyA9IG5ldyBNYXA8bnVtYmVyLCBVaW50MzJBcnJheT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBzdG9yZXMgPSBuZXcgU2V0PElCYWNrZ3JvdW5kVG9rZW5pemF0aW9uU3RvcmU+KCk7XG5cblx0cHVibGljIHNldExpbmVUb2tlbnMobGluZU51bWJlcjogbnVtYmVyLCB0b2tlbnM6IFVpbnQzMkFycmF5KTogdm9pZCB7XG5cdFx0Y29uc3QgYiA9IG5ldyBDb250aWd1b3VzTXVsdGlsaW5lVG9rZW5zQnVpbGRlcigpO1xuXHRcdGIuYWRkKGxpbmVOdW1iZXIsIHRva2Vucyk7XG5cdFx0Zm9yIChjb25zdCBzIG9mIHRoaXMuc3RvcmVzKSB7XG5cdFx0XHRzLnNldFRva2VucyhiLmZpbmFsaXplKCkpO1xuXHRcdH1cblx0fVxuXG5cdGdldEluaXRpYWxTdGF0ZSgpOiBJU3RhdGUge1xuXHRcdHJldHVybiBuZXcgTGluZVN0YXRlKDEpO1xuXHR9XG5cblx0dG9rZW5pemUobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpOiBUb2tlbml6YXRpb25SZXN1bHQge1xuXHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHR9XG5cblx0dG9rZW5pemVFbmNvZGVkKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBzdGF0ZTogSVN0YXRlKTogRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCB7XG5cdFx0Y29uc3QgcyA9IHN0YXRlIGFzIExpbmVTdGF0ZTtcblx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodGhpcy50b2tlbnMuZ2V0KHMubGluZU51bWJlcikhLCBuZXcgTGluZVN0YXRlKHMubGluZU51bWJlciArIDEpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYW4gYmUvcmV0dXJuIHVuZGVmaW5lZCBpZiBkZWZhdWx0IGJhY2tncm91bmQgdG9rZW5pemF0aW9uIHNob3VsZCBiZSB1c2VkLlxuXHQgKi9cblx0Y3JlYXRlQmFja2dyb3VuZFRva2VuaXplcj8odGV4dE1vZGVsOiBJVGV4dE1vZGVsLCBzdG9yZTogSUJhY2tncm91bmRUb2tlbml6YXRpb25TdG9yZSk6IElCYWNrZ3JvdW5kVG9rZW5pemVyIHwgdW5kZWZpbmVkIHtcblx0XHR0aGlzLnN0b3Jlcy5hZGQoc3RvcmUpO1xuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdHRoaXMuc3RvcmVzLmRlbGV0ZShzdG9yZSk7XG5cdFx0XHR9LFxuXHRcdFx0cmVxdWVzdFRva2VucyhzdGFydExpbmVOdW1iZXIsIGVuZExpbmVOdW1iZXJFeGNsdXNpdmUpIHtcblx0XHRcdH0sXG5cdFx0fTtcblx0fVxufVxuXG5jbGFzcyBMaW5lU3RhdGUgaW1wbGVtZW50cyBJU3RhdGUge1xuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgbGluZU51bWJlcjogbnVtYmVyKSB7IH1cblx0Y2xvbmUoKTogSVN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXHRlcXVhbHMob3RoZXI6IElTdGF0ZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAob3RoZXIgYXMgTGluZVN0YXRlKS5saW5lTnVtYmVyID09PSB0aGlzLmxpbmVOdW1iZXI7XG5cdH1cbn1cblxuc3VpdGUoJ01vZGVsTGluZXNUb2tlbnMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0aW50ZXJmYWNlIElCdWZmZXJMaW5lU3RhdGUge1xuXHRcdHRleHQ6IHN0cmluZztcblx0XHR0b2tlbnM6IFRlc3RUb2tlbltdO1xuXHR9XG5cblx0aW50ZXJmYWNlIElFZGl0IHtcblx0XHRyYW5nZTogUmFuZ2U7XG5cdFx0dGV4dDogc3RyaW5nO1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdEFwcGx5RWRpdHMoaW5pdGlhbDogSUJ1ZmZlckxpbmVTdGF0ZVtdLCBlZGl0czogSUVkaXRbXSwgZXhwZWN0ZWQ6IElCdWZmZXJMaW5lU3RhdGVbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGluaXRpYWxUZXh0ID0gaW5pdGlhbC5tYXAoZWwgPT4gZWwudGV4dCkuam9pbignXFxuJyk7XG5cblx0XHRjb25zdCBzID0gbmV3IE1hbnVhbFRva2VuaXphdGlvblN1cHBvcnQoKTtcblx0XHRjb25zdCBkID0gVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIoJ3Rlc3QnLCBzKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGluaXRpYWxUZXh0LCAndGVzdCcpO1xuXHRcdG1vZGVsLm9uQmVmb3JlQXR0YWNoZWQoKTtcblx0XHRmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBpbml0aWFsLmxlbmd0aDsgbGluZUluZGV4KyspIHtcblx0XHRcdGNvbnN0IGxpbmVUb2tlbnMgPSBpbml0aWFsW2xpbmVJbmRleF0udG9rZW5zO1xuXHRcdFx0Y29uc3QgbGluZVRleHRMZW5ndGggPSBtb2RlbC5nZXRMaW5lTWF4Q29sdW1uKGxpbmVJbmRleCArIDEpIC0gMTtcblx0XHRcdGNvbnN0IHRva2VucyA9IFRlc3RUb2tlbi50b1Rva2VucyhsaW5lVG9rZW5zKTtcblx0XHRcdExpbmVUb2tlbnMuY29udmVydFRvRW5kT2Zmc2V0KHRva2VucywgbGluZVRleHRMZW5ndGgpO1xuXHRcdFx0cy5zZXRMaW5lVG9rZW5zKGxpbmVJbmRleCArIDEsIHRva2Vucyk7XG5cdFx0fVxuXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0cy5tYXAoKGVkKSA9PiAoe1xuXHRcdFx0aWRlbnRpZmllcjogbnVsbCxcblx0XHRcdHJhbmdlOiBlZC5yYW5nZSxcblx0XHRcdHRleHQ6IGVkLnRleHQsXG5cdFx0XHRmb3JjZU1vdmVNYXJrZXJzOiBmYWxzZVxuXHRcdH0pKSk7XG5cblx0XHRmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBleHBlY3RlZC5sZW5ndGg7IGxpbmVJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBhY3R1YWxMaW5lID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZUluZGV4ICsgMSk7XG5cdFx0XHRjb25zdCBhY3R1YWxUb2tlbnMgPSBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucyhsaW5lSW5kZXggKyAxKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3R1YWxMaW5lLCBleHBlY3RlZFtsaW5lSW5kZXhdLnRleHQpO1xuXHRcdFx0YXNzZXJ0TGluZVRva2VucyhhY3R1YWxUb2tlbnMsIGV4cGVjdGVkW2xpbmVJbmRleF0udG9rZW5zKTtcblx0XHR9XG5cblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0ZC5kaXNwb3NlKCk7XG5cdH1cblxuXHR0ZXN0KCdzaW5nbGUgZGVsZXRlIDEnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDIpLCB0ZXh0OiAnJyB9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig0LCAyKSwgbmV3IFRlc3RUb2tlbig1LCAzKV1cblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc2luZ2xlIGRlbGV0ZSAyJywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDMsIDEsIDgpLCB0ZXh0OiAnJyB9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZXJsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oMiwgMildXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbmdsZSBkZWxldGUgMycsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oNSwgMiksIG5ldyBUZXN0VG9rZW4oNiwgMyldXG5cdFx0XHR9XSxcblx0XHRcdFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgNiksIHRleHQ6ICcnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMiksIG5ldyBUZXN0VG9rZW4oMSwgMyldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbmdsZSBkZWxldGUgNCcsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oNSwgMiksIG5ldyBUZXN0VG9rZW4oNiwgMyldXG5cdFx0XHR9XSxcblx0XHRcdFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMiwgMSwgNyksIHRleHQ6ICcnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2h3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oMSwgMyldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NpbmdsZSBkZWxldGUgNScsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oNSwgMiksIG5ldyBUZXN0VG9rZW4oNiwgMyldXG5cdFx0XHR9XSxcblx0XHRcdFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMTIpLCB0ZXh0OiAnJyB9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICcnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aSBkZWxldGUgNicsICgpID0+IHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oNSwgMiksIG5ldyBUZXN0VG9rZW4oNiwgMyldXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgNCksIG5ldyBUZXN0VG9rZW4oNSwgNSksIG5ldyBUZXN0VG9rZW4oNiwgNildXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgNyksIG5ldyBUZXN0VG9rZW4oNSwgOCksIG5ldyBUZXN0VG9rZW4oNiwgOSldXG5cdFx0XHR9XSxcblx0XHRcdFt7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNiwgMywgNiksIHRleHQ6ICcnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCA4KSwgbmV3IFRlc3RUb2tlbig2LCA5KV1cblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGkgZGVsZXRlIDcnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDQpLCBuZXcgVGVzdFRva2VuKDUsIDUpLCBuZXcgVGVzdFRva2VuKDYsIDYpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDcpLCBuZXcgVGVzdFRva2VuKDUsIDgpLCBuZXcgVGVzdFRva2VuKDYsIDkpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEyLCAzLCAxMiksIHRleHQ6ICcnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKSwgbmV3IFRlc3RUb2tlbig2LCAzKV1cblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGkgZGVsZXRlIDgnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDQpLCBuZXcgVGVzdFRva2VuKDUsIDUpLCBuZXcgVGVzdFRva2VuKDYsIDYpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDcpLCBuZXcgVGVzdFRva2VuKDUsIDgpLCBuZXcgVGVzdFRva2VuKDYsIDkpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDMsIDEpLCB0ZXh0OiAnJyB9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgNyksIG5ldyBUZXN0VG9rZW4oNSwgOCksIG5ldyBUZXN0VG9rZW4oNiwgOSldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpIGRlbGV0ZSA5JywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKSwgbmV3IFRlc3RUb2tlbig2LCAzKV1cblx0XHRcdH0sIHtcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCA0KSwgbmV3IFRlc3RUb2tlbig1LCA1KSwgbmV3IFRlc3RUb2tlbig2LCA2KV1cblx0XHRcdH0sIHtcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCA3KSwgbmV3IFRlc3RUb2tlbig1LCA4KSwgbmV3IFRlc3RUb2tlbig2LCA5KV1cblx0XHRcdH1dLFxuXHRcdFx0W3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxMiwgMywgMSksIHRleHQ6ICcnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpLCBuZXcgVGVzdFRva2VuKDExLCA3KSwgbmV3IFRlc3RUb2tlbigxNiwgOCksIG5ldyBUZXN0VG9rZW4oMTcsIDkpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgaW5zZXJ0IDEnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEsIDEsIDEpLCB0ZXh0OiAneHgnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ3h4aGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDcsIDIpLCBuZXcgVGVzdFRva2VuKDgsIDMpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgaW5zZXJ0IDInLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDIsIDEsIDIpLCB0ZXh0OiAneHgnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2h4eGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDcsIDIpLCBuZXcgVGVzdFRva2VuKDgsIDMpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgaW5zZXJ0IDMnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDYsIDEsIDYpLCB0ZXh0OiAneHgnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxveHggd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDcsIDIpLCBuZXcgVGVzdFRva2VuKDgsIDMpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgaW5zZXJ0IDQnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDcsIDEsIDcpLCB0ZXh0OiAneHgnIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHh4d29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDgsIDMpXVxuXHRcdFx0fV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW5nbGUgaW5zZXJ0IDUnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEyLCAxLCAxMiksIHRleHQ6ICd4eCcgfV0sXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGR4eCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSksIG5ldyBUZXN0VG9rZW4oNSwgMiksIG5ldyBUZXN0VG9rZW4oNiwgMyldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpIGluc2VydCA2JywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKSwgbmV3IFRlc3RUb2tlbig2LCAzKV1cblx0XHRcdH1dLFxuXHRcdFx0W3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSwgdGV4dDogJ1xcbicgfV0sXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKV1cblx0XHRcdH0sIHtcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKV1cblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGkgaW5zZXJ0IDcnLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDEyLCAxLCAxMiksIHRleHQ6ICdcXG4nIH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKSwgbmV3IFRlc3RUb2tlbig2LCAzKV1cblx0XHRcdH0sIHtcblx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpIGluc2VydCA4JywgKCkgPT4ge1xuXHRcdHRlc3RBcHBseUVkaXRzKFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogJ2hlbGxvIHdvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKSwgbmV3IFRlc3RUb2tlbig2LCAzKV1cblx0XHRcdH1dLFxuXHRcdFx0W3sgcmFuZ2U6IG5ldyBSYW5nZSgxLCA3LCAxLCA3KSwgdGV4dDogJ1xcbicgfV0sXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKSwgbmV3IFRlc3RUb2tlbig1LCAyKV1cblx0XHRcdH0sIHtcblx0XHRcdFx0dGV4dDogJ3dvcmxkJyxcblx0XHRcdFx0dG9rZW5zOiBbbmV3IFRlc3RUb2tlbigwLCAxKV1cblx0XHRcdH1dXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGkgaW5zZXJ0IDknLCAoKSA9PiB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpLCBuZXcgVGVzdFRva2VuKDYsIDMpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8gd29ybGQnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDQpLCBuZXcgVGVzdFRva2VuKDUsIDUpLCBuZXcgVGVzdFRva2VuKDYsIDYpXVxuXHRcdFx0fV0sXG5cdFx0XHRbeyByYW5nZTogbmV3IFJhbmdlKDEsIDcsIDEsIDcpLCB0ZXh0OiAneHhcXG55eScgfV0sXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiAnaGVsbG8geHgnLFxuXHRcdFx0XHR0b2tlbnM6IFtuZXcgVGVzdFRva2VuKDAsIDEpLCBuZXcgVGVzdFRva2VuKDUsIDIpXVxuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiAneXl3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSldXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHRleHQ6ICdoZWxsbyB3b3JsZCcsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgNCksIG5ldyBUZXN0VG9rZW4oNSwgNSksIG5ldyBUZXN0VG9rZW4oNiwgNildXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3RMaW5lRWRpdFRva2Vucyhpbml0aWFsVGV4dDogc3RyaW5nLCBpbml0aWFsVG9rZW5zOiBUZXN0VG9rZW5bXSwgZWRpdHM6IElMaW5lRWRpdFtdLCBleHBlY3RlZFRleHQ6IHN0cmluZywgZXhwZWN0ZWRUb2tlbnM6IFRlc3RUb2tlbltdKTogdm9pZCB7XG5cdFx0dGVzdEFwcGx5RWRpdHMoXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiBpbml0aWFsVGV4dCxcblx0XHRcdFx0dG9rZW5zOiBpbml0aWFsVG9rZW5zXG5cdFx0XHR9XSxcblx0XHRcdGVkaXRzLm1hcCgoZWQpID0+ICh7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgZWQuc3RhcnRDb2x1bW4sIDEsIGVkLmVuZENvbHVtbiksXG5cdFx0XHRcdHRleHQ6IGVkLnRleHRcblx0XHRcdH0pKSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6IGV4cGVjdGVkVGV4dCxcblx0XHRcdFx0dG9rZW5zOiBleHBlY3RlZFRva2Vuc1xuXHRcdFx0fV1cblx0XHQpO1xuXHR9XG5cblx0dGVzdCgnaW5zZXJ0aW9uIG9uIGVtcHR5IGxpbmUnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcyA9IG5ldyBNYW51YWxUb2tlbml6YXRpb25TdXBwb3J0KCk7XG5cdFx0Y29uc3QgZCA9IFRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKCd0ZXN0Jywgcyk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnc29tZSB0ZXh0JywgJ3Rlc3QnKTtcblx0XHRjb25zdCB0b2tlbnMgPSBUZXN0VG9rZW4udG9Ub2tlbnMoW25ldyBUZXN0VG9rZW4oMCwgMSldKTtcblx0XHRMaW5lVG9rZW5zLmNvbnZlcnRUb0VuZE9mZnNldCh0b2tlbnMsIG1vZGVsLmdldExpbmVNYXhDb2x1bW4oMSkgLSAxKTtcblx0XHRzLnNldExpbmVUb2tlbnMoMSwgdG9rZW5zKTtcblxuXHRcdG1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMTApLFxuXHRcdFx0dGV4dDogJydcblx0XHR9XSk7XG5cblx0XHRzLnNldExpbmVUb2tlbnMoMSwgbmV3IFVpbnQzMkFycmF5KDApKTtcblxuXHRcdG1vZGVsLmFwcGx5RWRpdHMoW3tcblx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgMSwgMSwgMSksXG5cdFx0XHR0ZXh0OiAnYSdcblx0XHR9XSk7XG5cblx0XHRjb25zdCBhY3R1YWxUb2tlbnMgPSBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucygxKTtcblx0XHRhc3NlcnRMaW5lVG9rZW5zKGFjdHVhbFRva2VucywgW25ldyBUZXN0VG9rZW4oMCwgMSldKTtcblxuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRkLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB0b2tlbnMgb24gaW5zZXJ0aW9uIDEnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHR0ZXh0OiAnYScsXG5cdFx0XHR9XSxcblx0XHRcdCdhYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig2LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZXMgdG9rZW5zIG9uIGluc2VydGlvbiAyJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdhYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig2LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAyLFxuXHRcdFx0XHRlbmRDb2x1bW46IDIsXG5cdFx0XHRcdHRleHQ6ICd4Jyxcblx0XHRcdH1dLFxuXHRcdFx0J2F4YWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig2LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig3LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZXMgdG9rZW5zIG9uIGluc2VydGlvbiAzJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdheGFiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNiwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNywgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMyxcblx0XHRcdFx0ZW5kQ29sdW1uOiAzLFxuXHRcdFx0XHR0ZXh0OiAnc3R1Jyxcblx0XHRcdH1dLFxuXHRcdFx0J2F4c3R1YWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig5LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMCwgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVzIHRva2VucyBvbiBpbnNlcnRpb24gNCcsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYXhzdHVhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDksIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEwLCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxMCxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxMCxcblx0XHRcdFx0dGV4dDogJ1xcdCcsXG5cdFx0XHR9XSxcblx0XHRcdCdheHN0dWFiY2RcXHQgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTAsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDExLCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZXMgdG9rZW5zIG9uIGluc2VydGlvbiA1JywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdheHN0dWFiY2RcXHQgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTAsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDExLCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxMixcblx0XHRcdFx0ZW5kQ29sdW1uOiAxMixcblx0XHRcdFx0dGV4dDogJ2RkJyxcblx0XHRcdH1dLFxuXHRcdFx0J2F4c3R1YWJjZFxcdCBkZGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEwLCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMywgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCd1cGRhdGVzIHRva2VucyBvbiBpbnNlcnRpb24gNicsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYXhzdHVhYmNkXFx0IGRkZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTAsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEzLCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxOCxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxOCxcblx0XHRcdFx0dGV4dDogJ3h5eicsXG5cdFx0XHR9XSxcblx0XHRcdCdheHN0dWFiY2RcXHQgZGRlZmdoeHl6Jyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTMsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB0b2tlbnMgb24gaW5zZXJ0aW9uIDcnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2F4c3R1YWJjZFxcdCBkZGVmZ2h4eXonLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEwLCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMywgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHR0ZXh0OiAneCcsXG5cdFx0XHR9XSxcblx0XHRcdCd4YXhzdHVhYmNkXFx0IGRkZWZnaHh5eicsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTEsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDE0LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZXMgdG9rZW5zIG9uIGluc2VydGlvbiA4JywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCd4YXhzdHVhYmNkXFx0IGRkZWZnaHh5eicsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTEsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDE0LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAyMixcblx0XHRcdFx0ZW5kQ29sdW1uOiAyMixcblx0XHRcdFx0dGV4dDogJ3gnLFxuXHRcdFx0fV0sXG5cdFx0XHQneGF4c3R1YWJjZFxcdCBkZGVmZ2h4eXp4Jyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMSwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTQsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB0b2tlbnMgb24gaW5zZXJ0aW9uIDknLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J3hheHN0dWFiY2RcXHQgZGRlZmdoeHl6eCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTEsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDE0LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAyLFxuXHRcdFx0XHRlbmRDb2x1bW46IDIsXG5cdFx0XHRcdHRleHQ6ICcnLFxuXHRcdFx0fV0sXG5cdFx0XHQneGF4c3R1YWJjZFxcdCBkZGVmZ2h4eXp4Jyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMSwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTQsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB0b2tlbnMgb24gaW5zZXJ0aW9uIDEwJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCcnLFxuXHRcdFx0W10sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAxLFxuXHRcdFx0XHR0ZXh0OiAnYScsXG5cdFx0XHR9XSxcblx0XHRcdCdhJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBzZWNvbmQgdG9rZW4gMicsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYWJjZGVmZ2hpaicsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMywgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNiwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogNCxcblx0XHRcdFx0ZW5kQ29sdW1uOiA3LFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0J2FiY2doaWonLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDMsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaW5zZXJ0IHJpZ2h0IGJlZm9yZSBzZWNvbmQgdG9rZW4nLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2RlZmdoaWonLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDMsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDYsIDMpXG5cdFx0XHRdLFxuXHRcdFx0W3tcblx0XHRcdFx0c3RhcnRDb2x1bW46IDQsXG5cdFx0XHRcdGVuZENvbHVtbjogNCxcblx0XHRcdFx0dGV4dDogJ2hlbGxvJyxcblx0XHRcdH1dLFxuXHRcdFx0J2FiY2hlbGxvZGVmZ2hpaicsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oOCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTEsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZGVsZXRlIGZpcnN0IGNoYXInLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAyLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0J2JjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigzLCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSAybmQgYW5kIDNyZCBjaGFycycsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAyLFxuXHRcdFx0XHRlbmRDb2x1bW46IDQsXG5cdFx0XHRcdHRleHQ6ICcnLFxuXHRcdFx0fV0sXG5cdFx0XHQnYWQgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMiwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMywgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgZmlyc3QgdG9rZW4nLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiA1LFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0JyBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxLCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBzZWNvbmQgdG9rZW4nLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogNSxcblx0XHRcdFx0ZW5kQ29sdW1uOiA2LFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0J2FiY2RlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBzZWNvbmQgdG9rZW4gKyBhIGJpdCBvZiB0aGUgdGhpcmQgb25lJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0W3tcblx0XHRcdFx0c3RhcnRDb2x1bW46IDUsXG5cdFx0XHRcdGVuZENvbHVtbjogNyxcblx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHR9XSxcblx0XHRcdCdhYmNkZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0ZSBzZWNvbmQgYW5kIHRoaXJkIHRva2VuJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0W3tcblx0XHRcdFx0c3RhcnRDb2x1bW46IDUsXG5cdFx0XHRcdGVuZENvbHVtbjogMTAsXG5cdFx0XHRcdHRleHQ6ICcnLFxuXHRcdFx0fV0sXG5cdFx0XHQnYWJjZCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSlcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGUgZXZlcnl0aGluZycsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRDb2x1bW46IDEwLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0JycsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSlcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdub29wJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0W3tcblx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdGVuZENvbHVtbjogMSxcblx0XHRcdFx0dGV4dDogJycsXG5cdFx0XHR9XSxcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXF1aXZhbGVudCB0byBkZWxldGluZyBmaXJzdCB0d28gY2hhcnMnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVFZGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHRbe1xuXHRcdFx0XHRzdGFydENvbHVtbjogMSxcblx0XHRcdFx0ZW5kQ29sdW1uOiAzLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0J2NkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDIsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDMsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnZXF1aXZhbGVudCB0byBkZWxldGluZyBmcm9tIDUgdG8gdGhlIGVuZCcsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiA1LFxuXHRcdFx0XHRlbmRDb2x1bW46IDEwLFxuXHRcdFx0XHR0ZXh0OiAnJyxcblx0XHRcdH1dLFxuXHRcdFx0J2FiY2QnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgndXBkYXRlcyB0b2tlbnMgb24gcmVwbGFjZSAxJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lRWRpdFRva2Vucyhcblx0XHRcdCdIZWxsbyB3b3JsZCwgY2lhbycsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMCksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNiwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTEsIDApLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEzLCAwKVxuXHRcdFx0XSxcblx0XHRcdFt7XG5cdFx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0XHRlbmRDb2x1bW46IDYsXG5cdFx0XHRcdHRleHQ6ICdIaScsXG5cdFx0XHR9XSxcblx0XHRcdCdIaSB3b3JsZCwgY2lhbycsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMCksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMywgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oOCwgMCksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTAsIDApLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3VwZGF0ZXMgdG9rZW5zIG9uIHJlcGxhY2UgMicsICgpID0+IHtcblx0XHR0ZXN0TGluZUVkaXRUb2tlbnMoXG5cdFx0XHQnSGVsbG8gd29ybGQsIGNpYW8nLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDApLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDYsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDExLCAwKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMywgMCksXG5cdFx0XHRdLFxuXHRcdFx0W3tcblx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdGVuZENvbHVtbjogNixcblx0XHRcdFx0dGV4dDogJ0hpJyxcblx0XHRcdH0sIHtcblx0XHRcdFx0c3RhcnRDb2x1bW46IDgsXG5cdFx0XHRcdGVuZENvbHVtbjogMTIsXG5cdFx0XHRcdHRleHQ6ICdteSBmcmllbmRzJyxcblx0XHRcdH1dLFxuXHRcdFx0J0hpIHdteSBmcmllbmRzLCBjaWFvJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAwKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigzLCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxNCwgMCksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTYsIDApLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3RMaW5lU3BsaXRUb2tlbnMoaW5pdGlhbFRleHQ6IHN0cmluZywgaW5pdGlhbFRva2VuczogVGVzdFRva2VuW10sIHNwbGl0Q29sdW1uOiBudW1iZXIsIGV4cGVjdGVkVGV4dDE6IHN0cmluZywgZXhwZWN0ZWRUZXh0Mjogc3RyaW5nLCBleHBlY3RlZFRva2VuczogVGVzdFRva2VuW10pOiB2b2lkIHtcblx0XHR0ZXN0QXBwbHlFZGl0cyhcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6IGluaXRpYWxUZXh0LFxuXHRcdFx0XHR0b2tlbnM6IGluaXRpYWxUb2tlbnNcblx0XHRcdH1dLFxuXHRcdFx0W3tcblx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZSgxLCBzcGxpdENvbHVtbiwgMSwgc3BsaXRDb2x1bW4pLFxuXHRcdFx0XHR0ZXh0OiAnXFxuJ1xuXHRcdFx0fV0sXG5cdFx0XHRbe1xuXHRcdFx0XHR0ZXh0OiBleHBlY3RlZFRleHQxLFxuXHRcdFx0XHR0b2tlbnM6IGV4cGVjdGVkVG9rZW5zXG5cdFx0XHR9LCB7XG5cdFx0XHRcdHRleHQ6IGV4cGVjdGVkVGV4dDIsXG5cdFx0XHRcdHRva2VuczogW25ldyBUZXN0VG9rZW4oMCwgMSldXG5cdFx0XHR9XVxuXHRcdCk7XG5cdH1cblxuXHR0ZXN0KCdzcGxpdCBhdCB0aGUgYmVnaW5uaW5nJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lU3BsaXRUb2tlbnMoXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XSxcblx0XHRcdDEsXG5cdFx0XHQnJyxcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3NwbGl0IGF0IHRoZSBlbmQnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVTcGxpdFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0MTAsXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdCcnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnc3BsaXQgaW50aGUgbWlkZGxlIDEnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVTcGxpdFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0NSxcblx0XHRcdCdhYmNkJyxcblx0XHRcdCcgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSlcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdzcGxpdCBpbnRoZSBtaWRkbGUgMicsICgpID0+IHtcblx0XHR0ZXN0TGluZVNwbGl0VG9rZW5zKFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF0sXG5cdFx0XHQ2LFxuXHRcdFx0J2FiY2QgJyxcblx0XHRcdCdlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdGZ1bmN0aW9uIHRlc3RMaW5lQXBwZW5kVG9rZW5zKGFUZXh0OiBzdHJpbmcsIGFUb2tlbnM6IFRlc3RUb2tlbltdLCBiVGV4dDogc3RyaW5nLCBiVG9rZW5zOiBUZXN0VG9rZW5bXSwgZXhwZWN0ZWRUZXh0OiBzdHJpbmcsIGV4cGVjdGVkVG9rZW5zOiBUZXN0VG9rZW5bXSk6IHZvaWQge1xuXHRcdHRlc3RBcHBseUVkaXRzKFxuXHRcdFx0W3tcblx0XHRcdFx0dGV4dDogYVRleHQsXG5cdFx0XHRcdHRva2VuczogYVRva2Vuc1xuXHRcdFx0fSwge1xuXHRcdFx0XHR0ZXh0OiBiVGV4dCxcblx0XHRcdFx0dG9rZW5zOiBiVG9rZW5zXG5cdFx0XHR9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHJhbmdlOiBuZXcgUmFuZ2UoMSwgYVRleHQubGVuZ3RoICsgMSwgMiwgMSksXG5cdFx0XHRcdHRleHQ6ICcnXG5cdFx0XHR9XSxcblx0XHRcdFt7XG5cdFx0XHRcdHRleHQ6IGV4cGVjdGVkVGV4dCxcblx0XHRcdFx0dG9rZW5zOiBleHBlY3RlZFRva2Vuc1xuXHRcdFx0fV1cblx0XHQpO1xuXHR9XG5cblx0dGVzdCgnYXBwZW5kIGVtcHR5IDEnLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVBcHBlbmRUb2tlbnMoXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XSxcblx0XHRcdCcnLFxuXHRcdFx0W10sXG5cdFx0XHQnYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKVxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2FwcGVuZCBlbXB0eSAyJywgKCkgPT4ge1xuXHRcdHRlc3RMaW5lQXBwZW5kVG9rZW5zKFxuXHRcdFx0JycsXG5cdFx0XHRbXSxcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdhcHBlbmQgMScsICgpID0+IHtcblx0XHR0ZXN0TGluZUFwcGVuZFRva2Vucyhcblx0XHRcdCdhYmNkIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDUsIDMpXG5cdFx0XHRdLFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgNCksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgNSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgNilcblx0XHRcdF0sXG5cdFx0XHQnYWJjZCBlZmdoYWJjZCBlZmdoJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig0LCAyKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig1LCAzKSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbig5LCA0KSxcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigxMywgNSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMTQsIDYpXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnYXBwZW5kIDInLCAoKSA9PiB7XG5cdFx0dGVzdExpbmVBcHBlbmRUb2tlbnMoXG5cdFx0XHQnYWJjZCAnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDEpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDQsIDIpXG5cdFx0XHRdLFxuXHRcdFx0J2VmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDMpXG5cdFx0XHRdLFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdhcHBlbmQgMycsICgpID0+IHtcblx0XHR0ZXN0TGluZUFwcGVuZFRva2Vucyhcblx0XHRcdCdhYmNkJyxcblx0XHRcdFtcblx0XHRcdFx0bmV3IFRlc3RUb2tlbigwLCAxKSxcblx0XHRcdF0sXG5cdFx0XHQnIGVmZ2gnLFxuXHRcdFx0W1xuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDAsIDIpLFxuXHRcdFx0XHRuZXcgVGVzdFRva2VuKDEsIDMpXG5cdFx0XHRdLFxuXHRcdFx0J2FiY2QgZWZnaCcsXG5cdFx0XHRbXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oMCwgMSksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNCwgMiksXG5cdFx0XHRcdG5ldyBUZXN0VG9rZW4oNSwgMylcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsYUFBYTtBQUN0QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDJCQUE2Ryw0QkFBZ0Q7QUFF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O0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsTUFDM0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsTUFDM0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQyxHQUFHLE1BQU0sR0FBRyxDQUFDO0FBQUEsTUFDNUMsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxJQUFJLENBQUMsR0FBRyxJQUFJLFVBQVUsSUFBSSxDQUFDLEdBQUcsSUFBSSxVQUFVLElBQUksQ0FBQyxDQUFDO0FBQUEsTUFDekksQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLG1CQUFtQixNQUFNO0FBQzdCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDL0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDdkUsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQzdCLEdBQUc7QUFBQSxRQUNGLE1BQU07QUFBQSxRQUNOLFFBQVEsQ0FBQyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUM3QixDQUFDO0FBQUEsSUFDRjtBQUFBLEVBQ0QsQ0FBQztBQUVELE9BQUssa0JBQWtCLE1BQU07QUFDNUI7QUFBQSxNQUNDLENBQUM7QUFBQSxRQUNBLE1BQU07QUFBQSxRQUNOLFFBQVEsQ0FBQyxJQUFJLFVBQVUsR0FBRyxDQUFDLEdBQUcsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsQ0FBQztBQUFBLE1BQ3ZFLENBQUM7QUFBQSxNQUNELENBQUMsRUFBRSxPQUFPLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxFQUFFLEdBQUcsTUFBTSxLQUFLLENBQUM7QUFBQSxNQUMvQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDN0IsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sS0FBSyxDQUFDO0FBQUEsTUFDN0MsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUNsRCxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDN0IsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNELENBQUM7QUFFRCxPQUFLLGtCQUFrQixNQUFNO0FBQzVCO0FBQUEsTUFDQyxDQUFDO0FBQUEsUUFDQSxNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxHQUFHO0FBQUEsUUFDRixNQUFNO0FBQUEsUUFDTixRQUFRLENBQUMsSUFBSSxVQUFVLEdBQUcsQ0FBQyxHQUFHLElBQUksVUFBVSxHQUFHLENBQUMsR0FBRyxJQUFJLFVBQVUsR0FBRyxDQUFDLENBQUM7QUFBQSxNQUN2RSxDQUFDO0FBQUEsTUFDRCxDQUFDLEVBQUUsT0FBTyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLE1BQU0sU0FBUyxDQUFDO0FBQUEsTUFDakQsQ0FBQztBQUFBLFFBQ0EsTUFBTTtBQUFBLFFBQ04sUUFBUSxDQUFDLElBQUks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R0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxRQUNsQixJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxRQUNsQixJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsUUFDbEIsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxJQUFJLENBQUM7QUFBQSxRQUNuQixJQUFJLFVBQVUsSUFBSSxDQUFDO0FBQUEsTUFDcEI7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxZQUFZLE1BQU07QUFDdEI7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxNQUNuQjtBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsUUFDQyxJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxRQUNsQixJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBRUQsT0FBSyxZQUFZLE1BQU07QUFDdEI7QUFBQSxNQUNDO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLE1BQ25CO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxRQUNDLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxRQUNsQixJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLFFBQ0MsSUFBSSxVQUFVLEdBQUcsQ0FBQztBQUFBLFFBQ2xCLElBQUksVUFBVSxHQUFHLENBQUM7QUFBQSxRQUNsQixJQUFJLFVBQVUsR0FBRyxDQUFDO0FBQUEsTUFDbkI7QUFBQSxJQUNEO0FBQUEsRUFDRCxDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
