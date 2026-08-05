import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { TokenizationRegistry, EncodedTokenizationResult } from "../../../common/languages.js";
import { StandardTokenType, MetadataConsts } from "../../../common/encodedTokenAttributes.js";
import { ILanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { NullState } from "../../../common/languages/nullTokenize.js";
import { ILanguageService } from "../../../common/languages/language.js";
import { TestLineToken } from "../core/testLineToken.js";
import { createModelServices, createTextModel, instantiateTextModel } from "../testTextModel.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
function createTextModelWithBrackets(disposables, text, brackets) {
  const languageId = "bracketMode2";
  const instantiationService = createModelServices(disposables);
  const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
  const languageService = instantiationService.get(ILanguageService);
  disposables.add(languageService.registerLanguage({ id: languageId }));
  disposables.add(languageConfigurationService.register(languageId, { brackets }));
  return disposables.add(instantiateTextModel(instantiationService, text, languageId));
}
suite("TextModelWithTokens", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function testBrackets(contents, brackets) {
    const languageId = "testMode";
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      brackets
    }));
    function toRelaxedFoundBracket(a) {
      if (!a) {
        return null;
      }
      return {
        range: a.range.toString(),
        info: a.bracketInfo
      };
    }
    const charIsBracket = {};
    const charIsOpenBracket = {};
    const openForChar = {};
    const closeForChar = {};
    brackets.forEach((b) => {
      charIsBracket[b[0]] = true;
      charIsBracket[b[1]] = true;
      charIsOpenBracket[b[0]] = true;
      charIsOpenBracket[b[1]] = false;
      openForChar[b[0]] = b[0];
      closeForChar[b[0]] = b[1];
      openForChar[b[1]] = b[0];
      closeForChar[b[1]] = b[1];
    });
    const expectedBrackets = [];
    for (let lineIndex = 0; lineIndex < contents.length; lineIndex++) {
      const lineText = contents[lineIndex];
      for (let charIndex = 0; charIndex < lineText.length; charIndex++) {
        const ch = lineText.charAt(charIndex);
        if (charIsBracket[ch]) {
          expectedBrackets.push({
            bracketInfo: languageConfigurationService.getLanguageConfiguration(languageId).bracketsNew.getBracketInfo(ch),
            range: new Range(lineIndex + 1, charIndex + 1, lineIndex + 1, charIndex + 2)
          });
        }
      }
    }
    const model = disposables.add(instantiateTextModel(instantiationService, contents.join("\n"), languageId));
    {
      let expectedBracketIndex = expectedBrackets.length - 1;
      let currentExpectedBracket = expectedBracketIndex >= 0 ? expectedBrackets[expectedBracketIndex] : null;
      for (let lineNumber = contents.length; lineNumber >= 1; lineNumber--) {
        const lineText = contents[lineNumber - 1];
        for (let column = lineText.length + 1; column >= 1; column--) {
          if (currentExpectedBracket) {
            if (lineNumber === currentExpectedBracket.range.startLineNumber && column < currentExpectedBracket.range.endColumn) {
              expectedBracketIndex--;
              currentExpectedBracket = expectedBracketIndex >= 0 ? expectedBrackets[expectedBracketIndex] : null;
            }
          }
          const actual = model.bracketPairs.findPrevBracket({
            lineNumber,
            column
          });
          assert.deepStrictEqual(toRelaxedFoundBracket(actual), toRelaxedFoundBracket(currentExpectedBracket), "findPrevBracket of " + lineNumber + ", " + column);
        }
      }
    }
    {
      let expectedBracketIndex = 0;
      let currentExpectedBracket = expectedBracketIndex < expectedBrackets.length ? expectedBrackets[expectedBracketIndex] : null;
      for (let lineNumber = 1; lineNumber <= contents.length; lineNumber++) {
        const lineText = contents[lineNumber - 1];
        for (let column = 1; column <= lineText.length + 1; column++) {
          if (currentExpectedBracket) {
            if (lineNumber === currentExpectedBracket.range.startLineNumber && column > currentExpectedBracket.range.startColumn) {
              expectedBracketIndex++;
              currentExpectedBracket = expectedBracketIndex < expectedBrackets.length ? expectedBrackets[expectedBracketIndex] : null;
            }
          }
          const actual = model.bracketPairs.findNextBracket({
            lineNumber,
            column
          });
          assert.deepStrictEqual(toRelaxedFoundBracket(actual), toRelaxedFoundBracket(currentExpectedBracket), "findNextBracket of " + lineNumber + ", " + column);
        }
      }
    }
    disposables.dispose();
  }
  test("brackets1", () => {
    testBrackets([
      "if (a == 3) { return (7 * (a + 5)); }"
    ], [
      ["{", "}"],
      ["[", "]"],
      ["(", ")"]
    ]);
  });
});
function assertIsNotBracket(model, lineNumber, column) {
  const match = model.bracketPairs.matchBracket(new Position(lineNumber, column));
  assert.strictEqual(match, null, "is not matching brackets at " + lineNumber + ", " + column);
}
function assertIsBracket(model, testPosition, expected) {
  expected.sort(Range.compareRangesUsingStarts);
  const actual = model.bracketPairs.matchBracket(testPosition);
  actual?.sort(Range.compareRangesUsingStarts);
  assert.deepStrictEqual(actual, expected, "matches brackets at " + testPosition);
}
suite("TextModelWithTokens - bracket matching", () => {
  const languageId = "bracketMode1";
  let disposables;
  let instantiationService;
  let languageConfigurationService;
  let languageService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createModelServices(disposables);
    languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languageConfigurationService.register(languageId, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("bracket matching 1", () => {
    const text = ")]}{[(\n)]}{[(";
    const model = disposables.add(instantiateTextModel(instantiationService, text, languageId));
    assertIsNotBracket(model, 1, 1);
    assertIsNotBracket(model, 1, 2);
    assertIsNotBracket(model, 1, 3);
    assertIsBracket(model, new Position(1, 4), [new Range(1, 4, 1, 5), new Range(2, 3, 2, 4)]);
    assertIsBracket(model, new Position(1, 5), [new Range(1, 5, 1, 6), new Range(2, 2, 2, 3)]);
    assertIsBracket(model, new Position(1, 6), [new Range(1, 6, 1, 7), new Range(2, 1, 2, 2)]);
    assertIsBracket(model, new Position(1, 7), [new Range(1, 6, 1, 7), new Range(2, 1, 2, 2)]);
    assertIsBracket(model, new Position(2, 1), [new Range(2, 1, 2, 2), new Range(1, 6, 1, 7)]);
    assertIsBracket(model, new Position(2, 2), [new Range(2, 2, 2, 3), new Range(1, 5, 1, 6)]);
    assertIsBracket(model, new Position(2, 3), [new Range(2, 3, 2, 4), new Range(1, 4, 1, 5)]);
    assertIsBracket(model, new Position(2, 4), [new Range(2, 3, 2, 4), new Range(1, 4, 1, 5)]);
    assertIsNotBracket(model, 2, 5);
    assertIsNotBracket(model, 2, 6);
    assertIsNotBracket(model, 2, 7);
  });
  test("bracket matching 2", () => {
    const text = "var bar = {\nfoo: {\n}, bar: {hallo: [{\n}, {\n}]}}";
    const model = disposables.add(instantiateTextModel(instantiationService, text, languageId));
    const brackets = [
      [new Position(1, 11), new Range(1, 11, 1, 12), new Range(5, 4, 5, 5)],
      [new Position(1, 12), new Range(1, 11, 1, 12), new Range(5, 4, 5, 5)],
      [new Position(2, 6), new Range(2, 6, 2, 7), new Range(3, 1, 3, 2)],
      [new Position(2, 7), new Range(2, 6, 2, 7), new Range(3, 1, 3, 2)],
      [new Position(3, 1), new Range(3, 1, 3, 2), new Range(2, 6, 2, 7)],
      [new Position(3, 2), new Range(3, 1, 3, 2), new Range(2, 6, 2, 7)],
      [new Position(3, 9), new Range(3, 9, 3, 10), new Range(5, 3, 5, 4)],
      [new Position(3, 10), new Range(3, 9, 3, 10), new Range(5, 3, 5, 4)],
      [new Position(3, 17), new Range(3, 17, 3, 18), new Range(5, 2, 5, 3)],
      [new Position(3, 18), new Range(3, 18, 3, 19), new Range(4, 1, 4, 2)],
      [new Position(3, 19), new Range(3, 18, 3, 19), new Range(4, 1, 4, 2)],
      [new Position(4, 1), new Range(4, 1, 4, 2), new Range(3, 18, 3, 19)],
      [new Position(4, 2), new Range(4, 1, 4, 2), new Range(3, 18, 3, 19)],
      [new Position(4, 4), new Range(4, 4, 4, 5), new Range(5, 1, 5, 2)],
      [new Position(4, 5), new Range(4, 4, 4, 5), new Range(5, 1, 5, 2)],
      [new Position(5, 1), new Range(5, 1, 5, 2), new Range(4, 4, 4, 5)],
      [new Position(5, 2), new Range(5, 2, 5, 3), new Range(3, 17, 3, 18)],
      [new Position(5, 3), new Range(5, 3, 5, 4), new Range(3, 9, 3, 10)],
      [new Position(5, 4), new Range(5, 4, 5, 5), new Range(1, 11, 1, 12)],
      [new Position(5, 5), new Range(5, 4, 5, 5), new Range(1, 11, 1, 12)]
    ];
    const isABracket = { 1: {}, 2: {}, 3: {}, 4: {}, 5: {} };
    for (let i = 0, len = brackets.length; i < len; i++) {
      const [testPos, b1, b2] = brackets[i];
      assertIsBracket(model, testPos, [b1, b2]);
      isABracket[testPos.lineNumber][testPos.column] = true;
    }
    for (let i = 1, len = model.getLineCount(); i <= len; i++) {
      const line = model.getLineContent(i);
      for (let j = 1, lenJ = line.length + 1; j <= lenJ; j++) {
        if (!isABracket[i].hasOwnProperty(j)) {
          assertIsNotBracket(model, i, j);
        }
      }
    }
  });
});
suite("TextModelWithTokens 2", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("bracket matching 3", () => {
    const text = [
      "begin",
      "    loop",
      "        if then",
      "        end if;",
      "    end loop;",
      "end;",
      "",
      "begin",
      "    loop",
      "        if then",
      "        end ifa;",
      "    end loop;",
      "end;"
    ].join("\n");
    const disposables = new DisposableStore();
    const model = createTextModelWithBrackets(disposables, text, [
      ["if", "end if"],
      ["loop", "end loop"],
      ["begin", "end"]
    ]);
    assertIsNotBracket(model, 10, 9);
    assertIsBracket(model, new Position(3, 9), [new Range(3, 9, 3, 11), new Range(4, 9, 4, 15)]);
    assertIsBracket(model, new Position(4, 9), [new Range(4, 9, 4, 15), new Range(3, 9, 3, 11)]);
    assertIsBracket(model, new Position(2, 5), [new Range(2, 5, 2, 9), new Range(5, 5, 5, 13)]);
    assertIsBracket(model, new Position(5, 5), [new Range(5, 5, 5, 13), new Range(2, 5, 2, 9)]);
    assertIsBracket(model, new Position(1, 1), [new Range(1, 1, 1, 6), new Range(6, 1, 6, 4)]);
    assertIsBracket(model, new Position(6, 1), [new Range(6, 1, 6, 4), new Range(1, 1, 1, 6)]);
    disposables.dispose();
  });
  test("bracket matching 4", () => {
    const text = [
      "recordbegin",
      "  simplerecordbegin",
      "  endrecord",
      "endrecord"
    ].join("\n");
    const disposables = new DisposableStore();
    const model = createTextModelWithBrackets(disposables, text, [
      ["recordbegin", "endrecord"],
      ["simplerecordbegin", "endrecord"]
    ]);
    assertIsBracket(model, new Position(1, 1), [new Range(1, 1, 1, 12), new Range(4, 1, 4, 10)]);
    assertIsBracket(model, new Position(4, 1), [new Range(4, 1, 4, 10), new Range(1, 1, 1, 12)]);
    assertIsBracket(model, new Position(2, 3), [new Range(2, 3, 2, 20), new Range(3, 3, 3, 12)]);
    assertIsBracket(model, new Position(3, 3), [new Range(3, 3, 3, 12), new Range(2, 3, 2, 20)]);
    disposables.dispose();
  });
  test("issue #95843: Highlighting of closing braces is indicating wrong brace when cursor is behind opening brace", () => {
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    const mode1 = "testMode1";
    const mode2 = "testMode2";
    const languageIdCodec = languageService.languageIdCodec;
    disposables.add(languageService.registerLanguage({ id: mode1 }));
    disposables.add(languageService.registerLanguage({ id: mode2 }));
    const encodedMode1 = languageIdCodec.encodeLanguageId(mode1);
    const encodedMode2 = languageIdCodec.encodeLanguageId(mode2);
    const otherMetadata1 = (encodedMode1 << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.Other << MetadataConsts.TOKEN_TYPE_OFFSET | MetadataConsts.BALANCED_BRACKETS_MASK) >>> 0;
    const otherMetadata2 = (encodedMode2 << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.Other << MetadataConsts.TOKEN_TYPE_OFFSET | MetadataConsts.BALANCED_BRACKETS_MASK) >>> 0;
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        switch (line) {
          case "function f() {": {
            const tokens = new Uint32Array([
              0,
              otherMetadata1,
              8,
              otherMetadata1,
              9,
              otherMetadata1,
              10,
              otherMetadata1,
              11,
              otherMetadata1,
              12,
              otherMetadata1,
              13,
              otherMetadata1
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "  return <p>{true}</p>;": {
            const tokens = new Uint32Array([
              0,
              otherMetadata1,
              2,
              otherMetadata1,
              8,
              otherMetadata1,
              9,
              otherMetadata2,
              10,
              otherMetadata2,
              11,
              otherMetadata2,
              12,
              otherMetadata2,
              13,
              otherMetadata1,
              17,
              otherMetadata2,
              18,
              otherMetadata2,
              20,
              otherMetadata2,
              21,
              otherMetadata2,
              22,
              otherMetadata2
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "}": {
            const tokens = new Uint32Array([
              0,
              otherMetadata1
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
        }
        throw new Error(`Unexpected`);
      }
    };
    disposables.add(TokenizationRegistry.register(mode1, tokenizationSupport));
    disposables.add(languageConfigurationService.register(mode1, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    disposables.add(languageConfigurationService.register(mode2, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    const model = disposables.add(instantiateTextModel(
      instantiationService,
      [
        "function f() {",
        "  return <p>{true}</p>;",
        "}"
      ].join("\n"),
      mode1
    ));
    model.tokenization.forceTokenization(1);
    model.tokenization.forceTokenization(2);
    model.tokenization.forceTokenization(3);
    assert.deepStrictEqual(
      model.bracketPairs.matchBracket(new Position(2, 14)),
      [new Range(2, 13, 2, 14), new Range(2, 18, 2, 19)]
    );
    disposables.dispose();
  });
  test("issue #88075: TypeScript brace matching is incorrect in `${}` strings", () => {
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const mode = "testMode";
    const languageIdCodec = instantiationService.get(ILanguageService).languageIdCodec;
    const encodedMode = languageIdCodec.encodeLanguageId(mode);
    const otherMetadata = (encodedMode << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.Other << MetadataConsts.TOKEN_TYPE_OFFSET) >>> 0;
    const stringMetadata = (encodedMode << MetadataConsts.LANGUAGEID_OFFSET | StandardTokenType.String << MetadataConsts.TOKEN_TYPE_OFFSET) >>> 0;
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        switch (line) {
          case "function hello() {": {
            const tokens = new Uint32Array([
              0,
              otherMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "    console.log(`${100}`);": {
            const tokens = new Uint32Array([
              0,
              otherMetadata,
              16,
              stringMetadata,
              19,
              otherMetadata,
              22,
              stringMetadata,
              24,
              otherMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
          case "}": {
            const tokens = new Uint32Array([
              0,
              otherMetadata
            ]);
            return new EncodedTokenizationResult(tokens, state);
          }
        }
        throw new Error(`Unexpected`);
      }
    };
    disposables.add(TokenizationRegistry.register(mode, tokenizationSupport));
    disposables.add(languageConfigurationService.register(mode, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    const model = disposables.add(instantiateTextModel(
      instantiationService,
      [
        "function hello() {",
        "    console.log(`${100}`);",
        "}"
      ].join("\n"),
      mode
    ));
    model.tokenization.forceTokenization(1);
    model.tokenization.forceTokenization(2);
    model.tokenization.forceTokenization(3);
    assert.deepStrictEqual(model.bracketPairs.matchBracket(new Position(2, 23)), null);
    assert.deepStrictEqual(model.bracketPairs.matchBracket(new Position(2, 20)), null);
    disposables.dispose();
  });
});
suite("TextModelWithTokens regression tests", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("microsoft/monaco-editor#122: Unhandled Exception: TypeError: Unable to get property 'replace' of undefined or null reference", () => {
    function assertViewLineTokens(model2, lineNumber, forceTokenization, expected) {
      if (forceTokenization) {
        model2.tokenization.forceTokenization(lineNumber);
      }
      const _actual = model2.tokenization.getLineTokens(lineNumber).inflate();
      const actual = [];
      for (let i = 0, len = _actual.getCount(); i < len; i++) {
        actual[i] = {
          endIndex: _actual.getEndOffset(i),
          foreground: _actual.getForeground(i)
        };
      }
      const decode = (token) => {
        return {
          endIndex: token.endIndex,
          foreground: token.getForeground()
        };
      };
      assert.deepStrictEqual(actual, expected.map(decode));
    }
    let _tokenId = 10;
    const LANG_ID1 = "indicisiveMode1";
    const LANG_ID2 = "indicisiveMode2";
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        const myId = ++_tokenId;
        const tokens = new Uint32Array(2);
        tokens[0] = 0;
        tokens[1] = myId << MetadataConsts.FOREGROUND_OFFSET >>> 0;
        return new EncodedTokenizationResult(tokens, state);
      }
    };
    const registration1 = TokenizationRegistry.register(LANG_ID1, tokenizationSupport);
    const registration2 = TokenizationRegistry.register(LANG_ID2, tokenizationSupport);
    const model = createTextModel("A model with\ntwo lines");
    assertViewLineTokens(model, 1, true, [createViewLineToken(12, 1)]);
    assertViewLineTokens(model, 2, true, [createViewLineToken(9, 1)]);
    model.setLanguage(LANG_ID1);
    assertViewLineTokens(model, 1, true, [createViewLineToken(12, 11)]);
    assertViewLineTokens(model, 2, true, [createViewLineToken(9, 12)]);
    model.setLanguage(LANG_ID2);
    assertViewLineTokens(model, 1, false, [createViewLineToken(12, 1)]);
    assertViewLineTokens(model, 2, false, [createViewLineToken(9, 1)]);
    model.dispose();
    registration1.dispose();
    registration2.dispose();
    function createViewLineToken(endIndex, foreground) {
      const metadata = foreground << MetadataConsts.FOREGROUND_OFFSET >>> 0;
      return new TestLineToken(endIndex, metadata);
    }
  });
  test("microsoft/monaco-editor#133: Error: Cannot read property 'modeId' of undefined", () => {
    const disposables = new DisposableStore();
    const model = createTextModelWithBrackets(
      disposables,
      [
        "Imports System",
        "Imports System.Collections.Generic",
        "",
        "Module m1",
        "",
        "	Sub Main()",
        "	End Sub",
        "",
        "End Module"
      ].join("\n"),
      [
        ["module", "end module"],
        ["sub", "end sub"]
      ]
    );
    const actual = model.bracketPairs.matchBracket(new Position(4, 1));
    assert.deepStrictEqual(actual, [new Range(4, 1, 4, 7), new Range(9, 1, 9, 11)]);
    disposables.dispose();
  });
  test("issue #11856: Bracket matching does not work as expected if the opening brace symbol is contained in the closing brace symbol", () => {
    const disposables = new DisposableStore();
    const model = createTextModelWithBrackets(
      disposables,
      [
        'sequence "outer"',
        '     sequence "inner"',
        "     endsequence",
        "endsequence"
      ].join("\n"),
      [
        ["sequence", "endsequence"],
        ["feature", "endfeature"]
      ]
    );
    const actual = model.bracketPairs.matchBracket(new Position(3, 9));
    assert.deepStrictEqual(actual, [new Range(2, 6, 2, 14), new Range(3, 6, 3, 17)]);
    disposables.dispose();
  });
  test("issue #63822: Wrong embedded language detected for empty lines", () => {
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const languageService = instantiationService.get(ILanguageService);
    const outerMode = "outerMode";
    const innerMode = "innerMode";
    disposables.add(languageService.registerLanguage({ id: outerMode }));
    disposables.add(languageService.registerLanguage({ id: innerMode }));
    const languageIdCodec = instantiationService.get(ILanguageService).languageIdCodec;
    const encodedInnerMode = languageIdCodec.encodeLanguageId(innerMode);
    const tokenizationSupport = {
      getInitialState: () => NullState,
      tokenize: void 0,
      tokenizeEncoded: (line, hasEOL, state) => {
        const tokens = new Uint32Array(2);
        tokens[0] = 0;
        tokens[1] = encodedInnerMode << MetadataConsts.LANGUAGEID_OFFSET >>> 0;
        return new EncodedTokenizationResult(tokens, state);
      }
    };
    disposables.add(TokenizationRegistry.register(outerMode, tokenizationSupport));
    const model = disposables.add(instantiateTextModel(instantiationService, "A model with one line", outerMode));
    model.tokenization.forceTokenization(1);
    assert.strictEqual(model.getLanguageIdAtPosition(1, 1), innerMode);
    disposables.dispose();
  });
});
suite("TextModel.getLineIndentGuide", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function assertIndentGuides(lines, indentSize) {
    const languageId = "testLang";
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    const languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: languageId }));
    const text = lines.map((l) => l[4]).join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, text, languageId));
    model.updateOptions({ indentSize });
    const actualIndents = model.guides.getLinesIndentGuides(1, model.getLineCount());
    const actual = [];
    for (let line = 1; line <= model.getLineCount(); line++) {
      const activeIndentGuide = model.guides.getActiveIndentGuide(line, 1, model.getLineCount());
      actual[line - 1] = [actualIndents[line - 1], activeIndentGuide.startLineNumber, activeIndentGuide.endLineNumber, activeIndentGuide.indent, model.getLineContent(line)];
    }
    assert.deepStrictEqual(actual, lines);
    disposables.dispose();
  }
  test("getLineIndentGuide one level 2", () => {
    assertIndentGuides([
      [0, 2, 4, 1, "A"],
      [1, 2, 4, 1, "  A"],
      [1, 2, 4, 1, "  A"],
      [1, 2, 4, 1, "  A"]
    ], 2);
  });
  test("getLineIndentGuide two levels", () => {
    assertIndentGuides([
      [0, 2, 5, 1, "A"],
      [1, 2, 5, 1, "  A"],
      [1, 4, 5, 2, "  A"],
      [2, 4, 5, 2, "    A"],
      [2, 4, 5, 2, "    A"]
    ], 2);
  });
  test("getLineIndentGuide three levels", () => {
    assertIndentGuides([
      [0, 2, 4, 1, "A"],
      [1, 3, 4, 2, "  A"],
      [2, 4, 4, 3, "    A"],
      [3, 4, 4, 3, "      A"],
      [0, 5, 5, 0, "A"]
    ], 2);
  });
  test("getLineIndentGuide decreasing indent", () => {
    assertIndentGuides([
      [2, 1, 1, 2, "    A"],
      [1, 1, 1, 2, "  A"],
      [0, 1, 2, 1, "A"]
    ], 2);
  });
  test("getLineIndentGuide Java", () => {
    assertIndentGuides([
      /* 1*/
      [0, 2, 9, 1, "class A {"],
      /* 2*/
      [1, 3, 4, 2, "  void foo() {"],
      /* 3*/
      [2, 3, 4, 2, "    console.log(1);"],
      /* 4*/
      [2, 3, 4, 2, "    console.log(2);"],
      /* 5*/
      [1, 3, 4, 2, "  }"],
      /* 6*/
      [1, 2, 9, 1, ""],
      /* 7*/
      [1, 8, 8, 2, "  void bar() {"],
      /* 8*/
      [2, 8, 8, 2, "    console.log(3);"],
      /* 9*/
      [1, 8, 8, 2, "  }"],
      /*10*/
      [0, 2, 9, 1, "}"],
      /*11*/
      [0, 12, 12, 1, "interface B {"],
      /*12*/
      [1, 12, 12, 1, "  void bar();"],
      /*13*/
      [0, 12, 12, 1, "}"]
    ], 2);
  });
  test("getLineIndentGuide Javadoc", () => {
    assertIndentGuides([
      [0, 2, 3, 1, "/**"],
      [1, 2, 3, 1, " * Comment"],
      [1, 2, 3, 1, " */"],
      [0, 5, 6, 1, "class A {"],
      [1, 5, 6, 1, "  void foo() {"],
      [1, 5, 6, 1, "  }"],
      [0, 5, 6, 1, "}"]
    ], 2);
  });
  test("getLineIndentGuide Whitespace", () => {
    assertIndentGuides([
      [0, 2, 7, 1, "class A {"],
      [1, 2, 7, 1, ""],
      [1, 4, 5, 2, "  void foo() {"],
      [2, 4, 5, 2, "    "],
      [2, 4, 5, 2, "    return 1;"],
      [1, 4, 5, 2, "  }"],
      [1, 2, 7, 1, "      "],
      [0, 2, 7, 1, "}"]
    ], 2);
  });
  test("getLineIndentGuide Tabs", () => {
    assertIndentGuides([
      [0, 2, 7, 1, "class A {"],
      [1, 2, 7, 1, "		"],
      [1, 4, 5, 2, "	void foo() {"],
      [2, 4, 5, 2, "	 	//hello"],
      [2, 4, 5, 2, "	    return 2;"],
      [1, 4, 5, 2, "  	}"],
      [1, 2, 7, 1, "      "],
      [0, 2, 7, 1, "}"]
    ], 4);
  });
  test("getLineIndentGuide checker.ts", () => {
    assertIndentGuides([
      /* 1*/
      [0, 1, 1, 0, '/// <reference path="binder.ts"/>'],
      /* 2*/
      [0, 2, 2, 0, ""],
      /* 3*/
      [0, 3, 3, 0, "/* @internal */"],
      /* 4*/
      [0, 5, 16, 1, "namespace ts {"],
      /* 5*/
      [1, 5, 16, 1, "    let nextSymbolId = 1;"],
      /* 6*/
      [1, 5, 16, 1, "    let nextNodeId = 1;"],
      /* 7*/
      [1, 5, 16, 1, "    let nextMergeId = 1;"],
      /* 8*/
      [1, 5, 16, 1, "    let nextFlowId = 1;"],
      /* 9*/
      [1, 5, 16, 1, ""],
      /*10*/
      [1, 11, 15, 2, "    export function getNodeId(node: Node): number {"],
      /*11*/
      [2, 12, 13, 3, "        if (!node.id) {"],
      /*12*/
      [3, 12, 13, 3, "            node.id = nextNodeId;"],
      /*13*/
      [3, 12, 13, 3, "            nextNodeId++;"],
      /*14*/
      [2, 12, 13, 3, "        }"],
      /*15*/
      [2, 11, 15, 2, "        return node.id;"],
      /*16*/
      [1, 11, 15, 2, "    }"],
      /*17*/
      [0, 5, 16, 1, "}"]
    ], 4);
  });
  test("issue #8425 - Missing indentation lines for first level indentation", () => {
    assertIndentGuides([
      [1, 2, 3, 2, "	indent1"],
      [2, 2, 3, 2, "		indent2"],
      [2, 2, 3, 2, "		indent2"],
      [1, 2, 3, 2, "	indent1"]
    ], 4);
  });
  test("issue #8952 - Indentation guide lines going through text on .yml file", () => {
    assertIndentGuides([
      [0, 2, 5, 1, "properties:"],
      [1, 3, 5, 2, "    emailAddress:"],
      [2, 3, 5, 2, "        - bla"],
      [2, 5, 5, 3, "        - length:"],
      [3, 5, 5, 3, "            max: 255"],
      [0, 6, 6, 0, "getters:"]
    ], 4);
  });
  test("issue #11892 - Indent guides look funny", () => {
    assertIndentGuides([
      [0, 2, 7, 1, "function test(base) {"],
      [1, 3, 6, 2, "	switch (base) {"],
      [2, 4, 4, 3, "		case 1:"],
      [3, 4, 4, 3, "			return 1;"],
      [2, 6, 6, 3, "		case 2:"],
      [3, 6, 6, 3, "			return 2;"],
      [1, 2, 7, 1, "	}"],
      [0, 2, 7, 1, "}"]
    ], 4);
  });
  test("issue #12398 - Problem in indent guidelines", () => {
    assertIndentGuides([
      [2, 2, 2, 3, "		.bla"],
      [3, 2, 2, 3, "			label(for)"],
      [0, 3, 3, 0, "include script"]
    ], 4);
  });
  test("issue #49173", () => {
    const model = createTextModel([
      "class A {",
      "	public m1(): void {",
      "	}",
      "	public m2(): void {",
      "	}",
      "	public m3(): void {",
      "	}",
      "	public m4(): void {",
      "	}",
      "	public m5(): void {",
      "	}",
      "}"
    ].join("\n"));
    const actual = model.guides.getActiveIndentGuide(2, 4, 9);
    assert.deepStrictEqual(actual, { startLineNumber: 2, endLineNumber: 9, indent: 1 });
    model.dispose();
  });
  test("tweaks - no active", () => {
    assertIndentGuides([
      [0, 1, 1, 0, "A"],
      [0, 2, 2, 0, "A"]
    ], 2);
  });
  test("tweaks - inside scope", () => {
    assertIndentGuides([
      [0, 2, 2, 1, "A"],
      [1, 2, 2, 1, "  A"]
    ], 2);
  });
  test("tweaks - scope start", () => {
    assertIndentGuides([
      [0, 2, 2, 1, "A"],
      [1, 2, 2, 1, "  A"],
      [0, 2, 2, 1, "A"]
    ], 2);
  });
  test("tweaks - empty line", () => {
    assertIndentGuides([
      [0, 2, 4, 1, "A"],
      [1, 2, 4, 1, "  A"],
      [1, 2, 4, 1, ""],
      [1, 2, 4, 1, "  A"],
      [0, 2, 4, 1, "A"]
    ], 2);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvdGV4dE1vZGVsV2l0aFRva2Vucy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBJRm91bmRCcmFja2V0IH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEJyYWNrZXRQYWlycy5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IElUb2tlbml6YXRpb25TdXBwb3J0LCBUb2tlbml6YXRpb25SZWdpc3RyeSwgRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUsIE1ldGFkYXRhQ29uc3RzIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgQ2hhcmFjdGVyUGFpciB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBOdWxsU3RhdGUgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBUZXN0TGluZVRva2VuIH0gZnJvbSAnLi4vY29yZS90ZXN0TGluZVRva2VuLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMsIGNyZWF0ZVRleHRNb2RlbCwgaW5zdGFudGlhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vdGVzdC9jb21tb24vaW5zdGFudGlhdGlvblNlcnZpY2VNb2NrLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuXG5mdW5jdGlvbiBjcmVhdGVUZXh0TW9kZWxXaXRoQnJhY2tldHMoZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZSwgdGV4dDogc3RyaW5nLCBicmFja2V0czogQ2hhcmFjdGVyUGFpcltdKTogVGV4dE1vZGVsIHtcblx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICdicmFja2V0TW9kZTInO1xuXHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoZGlzcG9zYWJsZXMpO1xuXHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXG5cdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgeyBicmFja2V0cyB9KSk7XG5cblx0cmV0dXJuIGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgdGV4dCwgbGFuZ3VhZ2VJZCkpO1xufVxuXG5zdWl0ZSgnVGV4dE1vZGVsV2l0aFRva2VucycsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiB0ZXN0QnJhY2tldHMoY29udGVudHM6IHN0cmluZ1tdLCBicmFja2V0czogQ2hhcmFjdGVyUGFpcltdKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICd0ZXN0TW9kZSc7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGJyYWNrZXRzOiBicmFja2V0c1xuXHRcdH0pKTtcblxuXG5cdFx0ZnVuY3Rpb24gdG9SZWxheGVkRm91bmRCcmFja2V0KGE6IElGb3VuZEJyYWNrZXQgfCBudWxsKSB7XG5cdFx0XHRpZiAoIWEpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyYW5nZTogYS5yYW5nZS50b1N0cmluZygpLFxuXHRcdFx0XHRpbmZvOiBhLmJyYWNrZXRJbmZvLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRjb25zdCBjaGFySXNCcmFja2V0OiB7IFtjaGFyOiBzdHJpbmddOiBib29sZWFuIH0gPSB7fTtcblx0XHRjb25zdCBjaGFySXNPcGVuQnJhY2tldDogeyBbY2hhcjogc3RyaW5nXTogYm9vbGVhbiB9ID0ge307XG5cdFx0Y29uc3Qgb3BlbkZvckNoYXI6IHsgW2NoYXI6IHN0cmluZ106IHN0cmluZyB9ID0ge307XG5cdFx0Y29uc3QgY2xvc2VGb3JDaGFyOiB7IFtjaGFyOiBzdHJpbmddOiBzdHJpbmcgfSA9IHt9O1xuXHRcdGJyYWNrZXRzLmZvckVhY2goKGIpID0+IHtcblx0XHRcdGNoYXJJc0JyYWNrZXRbYlswXV0gPSB0cnVlO1xuXHRcdFx0Y2hhcklzQnJhY2tldFtiWzFdXSA9IHRydWU7XG5cblx0XHRcdGNoYXJJc09wZW5CcmFja2V0W2JbMF1dID0gdHJ1ZTtcblx0XHRcdGNoYXJJc09wZW5CcmFja2V0W2JbMV1dID0gZmFsc2U7XG5cblx0XHRcdG9wZW5Gb3JDaGFyW2JbMF1dID0gYlswXTtcblx0XHRcdGNsb3NlRm9yQ2hhcltiWzBdXSA9IGJbMV07XG5cblx0XHRcdG9wZW5Gb3JDaGFyW2JbMV1dID0gYlswXTtcblx0XHRcdGNsb3NlRm9yQ2hhcltiWzFdXSA9IGJbMV07XG5cdFx0fSk7XG5cblx0XHRjb25zdCBleHBlY3RlZEJyYWNrZXRzOiBJRm91bmRCcmFja2V0W10gPSBbXTtcblx0XHRmb3IgKGxldCBsaW5lSW5kZXggPSAwOyBsaW5lSW5kZXggPCBjb250ZW50cy5sZW5ndGg7IGxpbmVJbmRleCsrKSB7XG5cdFx0XHRjb25zdCBsaW5lVGV4dCA9IGNvbnRlbnRzW2xpbmVJbmRleF07XG5cblx0XHRcdGZvciAobGV0IGNoYXJJbmRleCA9IDA7IGNoYXJJbmRleCA8IGxpbmVUZXh0Lmxlbmd0aDsgY2hhckluZGV4KyspIHtcblx0XHRcdFx0Y29uc3QgY2ggPSBsaW5lVGV4dC5jaGFyQXQoY2hhckluZGV4KTtcblx0XHRcdFx0aWYgKGNoYXJJc0JyYWNrZXRbY2hdKSB7XG5cdFx0XHRcdFx0ZXhwZWN0ZWRCcmFja2V0cy5wdXNoKHtcblx0XHRcdFx0XHRcdGJyYWNrZXRJbmZvOiBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUlkKS5icmFja2V0c05ldy5nZXRCcmFja2V0SW5mbyhjaCkhLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IG5ldyBSYW5nZShsaW5lSW5kZXggKyAxLCBjaGFySW5kZXggKyAxLCBsaW5lSW5kZXggKyAxLCBjaGFySW5kZXggKyAyKVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGNvbnRlbnRzLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkKSk7XG5cblx0XHQvLyBmaW5kUHJldkJyYWNrZXRcblx0XHR7XG5cdFx0XHRsZXQgZXhwZWN0ZWRCcmFja2V0SW5kZXggPSBleHBlY3RlZEJyYWNrZXRzLmxlbmd0aCAtIDE7XG5cdFx0XHRsZXQgY3VycmVudEV4cGVjdGVkQnJhY2tldCA9IGV4cGVjdGVkQnJhY2tldEluZGV4ID49IDAgPyBleHBlY3RlZEJyYWNrZXRzW2V4cGVjdGVkQnJhY2tldEluZGV4XSA6IG51bGw7XG5cdFx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gY29udGVudHMubGVuZ3RoOyBsaW5lTnVtYmVyID49IDE7IGxpbmVOdW1iZXItLSkge1xuXHRcdFx0XHRjb25zdCBsaW5lVGV4dCA9IGNvbnRlbnRzW2xpbmVOdW1iZXIgLSAxXTtcblxuXHRcdFx0XHRmb3IgKGxldCBjb2x1bW4gPSBsaW5lVGV4dC5sZW5ndGggKyAxOyBjb2x1bW4gPj0gMTsgY29sdW1uLS0pIHtcblxuXHRcdFx0XHRcdGlmIChjdXJyZW50RXhwZWN0ZWRCcmFja2V0KSB7XG5cdFx0XHRcdFx0XHRpZiAobGluZU51bWJlciA9PT0gY3VycmVudEV4cGVjdGVkQnJhY2tldC5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiYgY29sdW1uIDwgY3VycmVudEV4cGVjdGVkQnJhY2tldC5yYW5nZS5lbmRDb2x1bW4pIHtcblx0XHRcdFx0XHRcdFx0ZXhwZWN0ZWRCcmFja2V0SW5kZXgtLTtcblx0XHRcdFx0XHRcdFx0Y3VycmVudEV4cGVjdGVkQnJhY2tldCA9IGV4cGVjdGVkQnJhY2tldEluZGV4ID49IDAgPyBleHBlY3RlZEJyYWNrZXRzW2V4cGVjdGVkQnJhY2tldEluZGV4XSA6IG51bGw7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgYWN0dWFsID0gbW9kZWwuYnJhY2tldFBhaXJzLmZpbmRQcmV2QnJhY2tldCh7XG5cdFx0XHRcdFx0XHRsaW5lTnVtYmVyOiBsaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0Y29sdW1uOiBjb2x1bW5cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9SZWxheGVkRm91bmRCcmFja2V0KGFjdHVhbCksIHRvUmVsYXhlZEZvdW5kQnJhY2tldChjdXJyZW50RXhwZWN0ZWRCcmFja2V0KSwgJ2ZpbmRQcmV2QnJhY2tldCBvZiAnICsgbGluZU51bWJlciArICcsICcgKyBjb2x1bW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gZmluZE5leHRCcmFja2V0XG5cdFx0e1xuXHRcdFx0bGV0IGV4cGVjdGVkQnJhY2tldEluZGV4ID0gMDtcblx0XHRcdGxldCBjdXJyZW50RXhwZWN0ZWRCcmFja2V0ID0gZXhwZWN0ZWRCcmFja2V0SW5kZXggPCBleHBlY3RlZEJyYWNrZXRzLmxlbmd0aCA/IGV4cGVjdGVkQnJhY2tldHNbZXhwZWN0ZWRCcmFja2V0SW5kZXhdIDogbnVsbDtcblx0XHRcdGZvciAobGV0IGxpbmVOdW1iZXIgPSAxOyBsaW5lTnVtYmVyIDw9IGNvbnRlbnRzLmxlbmd0aDsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRcdGNvbnN0IGxpbmVUZXh0ID0gY29udGVudHNbbGluZU51bWJlciAtIDFdO1xuXG5cdFx0XHRcdGZvciAobGV0IGNvbHVtbiA9IDE7IGNvbHVtbiA8PSBsaW5lVGV4dC5sZW5ndGggKyAxOyBjb2x1bW4rKykge1xuXG5cdFx0XHRcdFx0aWYgKGN1cnJlbnRFeHBlY3RlZEJyYWNrZXQpIHtcblx0XHRcdFx0XHRcdGlmIChsaW5lTnVtYmVyID09PSBjdXJyZW50RXhwZWN0ZWRCcmFja2V0LnJhbmdlLnN0YXJ0TGluZU51bWJlciAmJiBjb2x1bW4gPiBjdXJyZW50RXhwZWN0ZWRCcmFja2V0LnJhbmdlLnN0YXJ0Q29sdW1uKSB7XG5cdFx0XHRcdFx0XHRcdGV4cGVjdGVkQnJhY2tldEluZGV4Kys7XG5cdFx0XHRcdFx0XHRcdGN1cnJlbnRFeHBlY3RlZEJyYWNrZXQgPSBleHBlY3RlZEJyYWNrZXRJbmRleCA8IGV4cGVjdGVkQnJhY2tldHMubGVuZ3RoID8gZXhwZWN0ZWRCcmFja2V0c1tleHBlY3RlZEJyYWNrZXRJbmRleF0gOiBudWxsO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IGFjdHVhbCA9IG1vZGVsLmJyYWNrZXRQYWlycy5maW5kTmV4dEJyYWNrZXQoe1xuXHRcdFx0XHRcdFx0bGluZU51bWJlcjogbGluZU51bWJlcixcblx0XHRcdFx0XHRcdGNvbHVtbjogY29sdW1uXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRvUmVsYXhlZEZvdW5kQnJhY2tldChhY3R1YWwpLCB0b1JlbGF4ZWRGb3VuZEJyYWNrZXQoY3VycmVudEV4cGVjdGVkQnJhY2tldCksICdmaW5kTmV4dEJyYWNrZXQgb2YgJyArIGxpbmVOdW1iZXIgKyAnLCAnICsgY29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHRlc3QoJ2JyYWNrZXRzMScsICgpID0+IHtcblx0XHR0ZXN0QnJhY2tldHMoW1xuXHRcdFx0J2lmIChhID09IDMpIHsgcmV0dXJuICg3ICogKGEgKyA1KSk7IH0nXG5cdFx0XSwgW1xuXHRcdFx0Wyd7JywgJ30nXSxcblx0XHRcdFsnWycsICddJ10sXG5cdFx0XHRbJygnLCAnKSddXG5cdFx0XSk7XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIGFzc2VydElzTm90QnJhY2tldChtb2RlbDogVGV4dE1vZGVsLCBsaW5lTnVtYmVyOiBudW1iZXIsIGNvbHVtbjogbnVtYmVyKSB7XG5cdGNvbnN0IG1hdGNoID0gbW9kZWwuYnJhY2tldFBhaXJzLm1hdGNoQnJhY2tldChuZXcgUG9zaXRpb24obGluZU51bWJlciwgY29sdW1uKSk7XG5cdGFzc2VydC5zdHJpY3RFcXVhbChtYXRjaCwgbnVsbCwgJ2lzIG5vdCBtYXRjaGluZyBicmFja2V0cyBhdCAnICsgbGluZU51bWJlciArICcsICcgKyBjb2x1bW4pO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRJc0JyYWNrZXQobW9kZWw6IFRleHRNb2RlbCwgdGVzdFBvc2l0aW9uOiBQb3NpdGlvbiwgZXhwZWN0ZWQ6IFtSYW5nZSwgUmFuZ2VdKTogdm9pZCB7XG5cdGV4cGVjdGVkLnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0Y29uc3QgYWN0dWFsID0gbW9kZWwuYnJhY2tldFBhaXJzLm1hdGNoQnJhY2tldCh0ZXN0UG9zaXRpb24pO1xuXHRhY3R1YWw/LnNvcnQoUmFuZ2UuY29tcGFyZVJhbmdlc1VzaW5nU3RhcnRzKTtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIGV4cGVjdGVkLCAnbWF0Y2hlcyBicmFja2V0cyBhdCAnICsgdGVzdFBvc2l0aW9uKTtcbn1cblxuc3VpdGUoJ1RleHRNb2RlbFdpdGhUb2tlbnMgLSBicmFja2V0IG1hdGNoaW5nJywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSAnYnJhY2tldE1vZGUxJztcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcyk7XG5cdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJ3snLCAnfSddLFxuXHRcdFx0XHRbJ1snLCAnXSddLFxuXHRcdFx0XHRbJygnLCAnKSddLFxuXHRcdFx0XVxuXHRcdH0pKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnYnJhY2tldCBtYXRjaGluZyAxJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPVxuXHRcdFx0JyldfXtbKCcgKyAnXFxuJyArXG5cdFx0XHQnKV19e1soJztcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgdGV4dCwgbGFuZ3VhZ2VJZCkpO1xuXG5cdFx0YXNzZXJ0SXNOb3RCcmFja2V0KG1vZGVsLCAxLCAxKTtcblx0XHRhc3NlcnRJc05vdEJyYWNrZXQobW9kZWwsIDEsIDIpO1xuXHRcdGFzc2VydElzTm90QnJhY2tldChtb2RlbCwgMSwgMyk7XG5cdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNCksIFtuZXcgUmFuZ2UoMSwgNCwgMSwgNSksIG5ldyBSYW5nZSgyLCAzLCAyLCA0KV0pO1xuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDUpLCBbbmV3IFJhbmdlKDEsIDUsIDEsIDYpLCBuZXcgUmFuZ2UoMiwgMiwgMiwgMyldKTtcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbigxLCA2KSwgW25ldyBSYW5nZSgxLCA2LCAxLCA3KSwgbmV3IFJhbmdlKDIsIDEsIDIsIDIpXSk7XG5cdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCBuZXcgUG9zaXRpb24oMSwgNyksIFtuZXcgUmFuZ2UoMSwgNiwgMSwgNyksIG5ldyBSYW5nZSgyLCAxLCAyLCAyKV0pO1xuXG5cdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCBuZXcgUG9zaXRpb24oMiwgMSksIFtuZXcgUmFuZ2UoMiwgMSwgMiwgMiksIG5ldyBSYW5nZSgxLCA2LCAxLCA3KV0pO1xuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDIpLCBbbmV3IFJhbmdlKDIsIDIsIDIsIDMpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgNildKTtcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbigyLCAzKSwgW25ldyBSYW5nZSgyLCAzLCAyLCA0KSwgbmV3IFJhbmdlKDEsIDQsIDEsIDUpXSk7XG5cdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCBuZXcgUG9zaXRpb24oMiwgNCksIFtuZXcgUmFuZ2UoMiwgMywgMiwgNCksIG5ldyBSYW5nZSgxLCA0LCAxLCA1KV0pO1xuXHRcdGFzc2VydElzTm90QnJhY2tldChtb2RlbCwgMiwgNSk7XG5cdFx0YXNzZXJ0SXNOb3RCcmFja2V0KG1vZGVsLCAyLCA2KTtcblx0XHRhc3NlcnRJc05vdEJyYWNrZXQobW9kZWwsIDIsIDcpO1xuXHR9KTtcblxuXHR0ZXN0KCdicmFja2V0IG1hdGNoaW5nIDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgdGV4dCA9XG5cdFx0XHQndmFyIGJhciA9IHsnICsgJ1xcbicgK1xuXHRcdFx0J2ZvbzogeycgKyAnXFxuJyArXG5cdFx0XHQnfSwgYmFyOiB7aGFsbG86IFt7JyArICdcXG4nICtcblx0XHRcdCd9LCB7JyArICdcXG4nICtcblx0XHRcdCd9XX19Jztcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgdGV4dCwgbGFuZ3VhZ2VJZCkpO1xuXG5cdFx0Y29uc3QgYnJhY2tldHM6IFtQb3NpdGlvbiwgUmFuZ2UsIFJhbmdlXVtdID0gW1xuXHRcdFx0W25ldyBQb3NpdGlvbigxLCAxMSksIG5ldyBSYW5nZSgxLCAxMSwgMSwgMTIpLCBuZXcgUmFuZ2UoNSwgNCwgNSwgNSldLFxuXHRcdFx0W25ldyBQb3NpdGlvbigxLCAxMiksIG5ldyBSYW5nZSgxLCAxMSwgMSwgMTIpLCBuZXcgUmFuZ2UoNSwgNCwgNSwgNSldLFxuXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDIsIDYpLCBuZXcgUmFuZ2UoMiwgNiwgMiwgNyksIG5ldyBSYW5nZSgzLCAxLCAzLCAyKV0sXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDIsIDcpLCBuZXcgUmFuZ2UoMiwgNiwgMiwgNyksIG5ldyBSYW5nZSgzLCAxLCAzLCAyKV0sXG5cblx0XHRcdFtuZXcgUG9zaXRpb24oMywgMSksIG5ldyBSYW5nZSgzLCAxLCAzLCAyKSwgbmV3IFJhbmdlKDIsIDYsIDIsIDcpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oMywgMiksIG5ldyBSYW5nZSgzLCAxLCAzLCAyKSwgbmV3IFJhbmdlKDIsIDYsIDIsIDcpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oMywgOSksIG5ldyBSYW5nZSgzLCA5LCAzLCAxMCksIG5ldyBSYW5nZSg1LCAzLCA1LCA0KV0sXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDMsIDEwKSwgbmV3IFJhbmdlKDMsIDksIDMsIDEwKSwgbmV3IFJhbmdlKDUsIDMsIDUsIDQpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oMywgMTcpLCBuZXcgUmFuZ2UoMywgMTcsIDMsIDE4KSwgbmV3IFJhbmdlKDUsIDIsIDUsIDMpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oMywgMTgpLCBuZXcgUmFuZ2UoMywgMTgsIDMsIDE5KSwgbmV3IFJhbmdlKDQsIDEsIDQsIDIpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oMywgMTkpLCBuZXcgUmFuZ2UoMywgMTgsIDMsIDE5KSwgbmV3IFJhbmdlKDQsIDEsIDQsIDIpXSxcblxuXHRcdFx0W25ldyBQb3NpdGlvbig0LCAxKSwgbmV3IFJhbmdlKDQsIDEsIDQsIDIpLCBuZXcgUmFuZ2UoMywgMTgsIDMsIDE5KV0sXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDQsIDIpLCBuZXcgUmFuZ2UoNCwgMSwgNCwgMiksIG5ldyBSYW5nZSgzLCAxOCwgMywgMTkpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oNCwgNCksIG5ldyBSYW5nZSg0LCA0LCA0LCA1KSwgbmV3IFJhbmdlKDUsIDEsIDUsIDIpXSxcblx0XHRcdFtuZXcgUG9zaXRpb24oNCwgNSksIG5ldyBSYW5nZSg0LCA0LCA0LCA1KSwgbmV3IFJhbmdlKDUsIDEsIDUsIDIpXSxcblxuXHRcdFx0W25ldyBQb3NpdGlvbig1LCAxKSwgbmV3IFJhbmdlKDUsIDEsIDUsIDIpLCBuZXcgUmFuZ2UoNCwgNCwgNCwgNSldLFxuXHRcdFx0W25ldyBQb3NpdGlvbig1LCAyKSwgbmV3IFJhbmdlKDUsIDIsIDUsIDMpLCBuZXcgUmFuZ2UoMywgMTcsIDMsIDE4KV0sXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDUsIDMpLCBuZXcgUmFuZ2UoNSwgMywgNSwgNCksIG5ldyBSYW5nZSgzLCA5LCAzLCAxMCldLFxuXHRcdFx0W25ldyBQb3NpdGlvbig1LCA0KSwgbmV3IFJhbmdlKDUsIDQsIDUsIDUpLCBuZXcgUmFuZ2UoMSwgMTEsIDEsIDEyKV0sXG5cdFx0XHRbbmV3IFBvc2l0aW9uKDUsIDUpLCBuZXcgUmFuZ2UoNSwgNCwgNSwgNSksIG5ldyBSYW5nZSgxLCAxMSwgMSwgMTIpXSxcblx0XHRdO1xuXG5cdFx0Y29uc3QgaXNBQnJhY2tldDogeyBbbGluZU51bWJlcjogbnVtYmVyXTogeyBbY29sOiBudW1iZXJdOiBib29sZWFuIH0gfSA9IHsgMToge30sIDI6IHt9LCAzOiB7fSwgNDoge30sIDU6IHt9IH07XG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGJyYWNrZXRzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCBbdGVzdFBvcywgYjEsIGIyXSA9IGJyYWNrZXRzW2ldO1xuXHRcdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCB0ZXN0UG9zLCBbYjEsIGIyXSk7XG5cdFx0XHRpc0FCcmFja2V0W3Rlc3RQb3MubGluZU51bWJlcl1bdGVzdFBvcy5jb2x1bW5dID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRmb3IgKGxldCBpID0gMSwgbGVuID0gbW9kZWwuZ2V0TGluZUNvdW50KCk7IGkgPD0gbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBtb2RlbC5nZXRMaW5lQ29udGVudChpKTtcblx0XHRcdGZvciAobGV0IGogPSAxLCBsZW5KID0gbGluZS5sZW5ndGggKyAxOyBqIDw9IGxlbko7IGorKykge1xuXHRcdFx0XHRpZiAoIWlzQUJyYWNrZXRbaV0uaGFzT3duUHJvcGVydHkoPGFueT5qKSkge1xuXHRcdFx0XHRcdGFzc2VydElzTm90QnJhY2tldChtb2RlbCwgaSwgaik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdUZXh0TW9kZWxXaXRoVG9rZW5zIDInLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnYnJhY2tldCBtYXRjaGluZyAzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHQnYmVnaW4nLFxuXHRcdFx0JyAgICBsb29wJyxcblx0XHRcdCcgICAgICAgIGlmIHRoZW4nLFxuXHRcdFx0JyAgICAgICAgZW5kIGlmOycsXG5cdFx0XHQnICAgIGVuZCBsb29wOycsXG5cdFx0XHQnZW5kOycsXG5cdFx0XHQnJyxcblx0XHRcdCdiZWdpbicsXG5cdFx0XHQnICAgIGxvb3AnLFxuXHRcdFx0JyAgICAgICAgaWYgdGhlbicsXG5cdFx0XHQnICAgICAgICBlbmQgaWZhOycsXG5cdFx0XHQnICAgIGVuZCBsb29wOycsXG5cdFx0XHQnZW5kOycsXG5cdFx0XS5qb2luKCdcXG4nKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsV2l0aEJyYWNrZXRzKGRpc3Bvc2FibGVzLCB0ZXh0LCBbXG5cdFx0XHRbJ2lmJywgJ2VuZCBpZiddLFxuXHRcdFx0Wydsb29wJywgJ2VuZCBsb29wJ10sXG5cdFx0XHRbJ2JlZ2luJywgJ2VuZCddXG5cdFx0XSk7XG5cblx0XHQvLyA8aWY+IC4uLiA8ZW5kIGlmYT4gaXMgbm90IG1hdGNoZWRcblx0XHRhc3NlcnRJc05vdEJyYWNrZXQobW9kZWwsIDEwLCA5KTtcblxuXHRcdC8vIDxpZj4gLi4uIDxlbmQgaWY+IGlzIG1hdGNoZWRcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbigzLCA5KSwgW25ldyBSYW5nZSgzLCA5LCAzLCAxMSksIG5ldyBSYW5nZSg0LCA5LCA0LCAxNSldKTtcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbig0LCA5KSwgW25ldyBSYW5nZSg0LCA5LCA0LCAxNSksIG5ldyBSYW5nZSgzLCA5LCAzLCAxMSldKTtcblxuXHRcdC8vIDxsb29wPiAuLi4gPGVuZCBsb29wPiBpcyBtYXRjaGVkXG5cdFx0YXNzZXJ0SXNCcmFja2V0KG1vZGVsLCBuZXcgUG9zaXRpb24oMiwgNSksIFtuZXcgUmFuZ2UoMiwgNSwgMiwgOSksIG5ldyBSYW5nZSg1LCA1LCA1LCAxMyldKTtcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbig1LCA1KSwgW25ldyBSYW5nZSg1LCA1LCA1LCAxMyksIG5ldyBSYW5nZSgyLCA1LCAyLCA5KV0pO1xuXG5cdFx0Ly8gPGJlZ2luPiAuLi4gPGVuZD4gaXMgbWF0Y2hlZFxuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpLCBbbmV3IFJhbmdlKDEsIDEsIDEsIDYpLCBuZXcgUmFuZ2UoNiwgMSwgNiwgNCldKTtcblx0XHRhc3NlcnRJc0JyYWNrZXQobW9kZWwsIG5ldyBQb3NpdGlvbig2LCAxKSwgW25ldyBSYW5nZSg2LCAxLCA2LCA0KSwgbmV3IFJhbmdlKDEsIDEsIDEsIDYpXSk7XG5cblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2JyYWNrZXQgbWF0Y2hpbmcgNCcsICgpID0+IHtcblx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0J3JlY29yZGJlZ2luJyxcblx0XHRcdCcgIHNpbXBsZXJlY29yZGJlZ2luJyxcblx0XHRcdCcgIGVuZHJlY29yZCcsXG5cdFx0XHQnZW5kcmVjb3JkJyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWxXaXRoQnJhY2tldHMoZGlzcG9zYWJsZXMsIHRleHQsIFtcblx0XHRcdFsncmVjb3JkYmVnaW4nLCAnZW5kcmVjb3JkJ10sXG5cdFx0XHRbJ3NpbXBsZXJlY29yZGJlZ2luJywgJ2VuZHJlY29yZCddLFxuXHRcdF0pO1xuXG5cdFx0Ly8gPHJlY29yZGJlZ2luPiAuLi4gPGVuZHJlY29yZD4gaXMgbWF0Y2hlZFxuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDEsIDEpLCBbbmV3IFJhbmdlKDEsIDEsIDEsIDEyKSwgbmV3IFJhbmdlKDQsIDEsIDQsIDEwKV0pO1xuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDQsIDEpLCBbbmV3IFJhbmdlKDQsIDEsIDQsIDEwKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDEyKV0pO1xuXG5cdFx0Ly8gPHNpbXBsZXJlY29yZGJlZ2luPiAuLi4gPGVuZHJlY29yZD4gaXMgbWF0Y2hlZFxuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDIsIDMpLCBbbmV3IFJhbmdlKDIsIDMsIDIsIDIwKSwgbmV3IFJhbmdlKDMsIDMsIDMsIDEyKV0pO1xuXHRcdGFzc2VydElzQnJhY2tldChtb2RlbCwgbmV3IFBvc2l0aW9uKDMsIDMpLCBbbmV3IFJhbmdlKDMsIDMsIDMsIDEyKSwgbmV3IFJhbmdlKDIsIDMsIDIsIDIwKV0pO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjOTU4NDM6IEhpZ2hsaWdodGluZyBvZiBjbG9zaW5nIGJyYWNlcyBpcyBpbmRpY2F0aW5nIHdyb25nIGJyYWNlIHdoZW4gY3Vyc29yIGlzIGJlaGluZCBvcGVuaW5nIGJyYWNlJywgKCkgPT4ge1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IG1vZGUxID0gJ3Rlc3RNb2RlMSc7XG5cdFx0Y29uc3QgbW9kZTIgPSAndGVzdE1vZGUyJztcblxuXHRcdGNvbnN0IGxhbmd1YWdlSWRDb2RlYyA9IGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWM7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2UoeyBpZDogbW9kZTEgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBtb2RlMiB9KSk7XG5cdFx0Y29uc3QgZW5jb2RlZE1vZGUxID0gbGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobW9kZTEpO1xuXHRcdGNvbnN0IGVuY29kZWRNb2RlMiA9IGxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKG1vZGUyKTtcblxuXHRcdGNvbnN0IG90aGVyTWV0YWRhdGExID0gKFxuXHRcdFx0KGVuY29kZWRNb2RlMSA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVClcblx0XHRcdHwgKFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKVxuXHRcdFx0fCAoTWV0YWRhdGFDb25zdHMuQkFMQU5DRURfQlJBQ0tFVFNfTUFTSylcblx0XHQpID4+PiAwO1xuXHRcdGNvbnN0IG90aGVyTWV0YWRhdGEyID0gKFxuXHRcdFx0KGVuY29kZWRNb2RlMiA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVClcblx0XHRcdHwgKFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKVxuXHRcdFx0fCAoTWV0YWRhdGFDb25zdHMuQkFMQU5DRURfQlJBQ0tFVFNfTUFTSylcblx0XHQpID4+PiAwO1xuXG5cdFx0Y29uc3QgdG9rZW5pemF0aW9uU3VwcG9ydDogSVRva2VuaXphdGlvblN1cHBvcnQgPSB7XG5cdFx0XHRnZXRJbml0aWFsU3RhdGU6ICgpID0+IE51bGxTdGF0ZSxcblx0XHRcdHRva2VuaXplOiB1bmRlZmluZWQhLFxuXHRcdFx0dG9rZW5pemVFbmNvZGVkOiAobGluZSwgaGFzRU9MLCBzdGF0ZSkgPT4ge1xuXHRcdFx0XHRzd2l0Y2ggKGxpbmUpIHtcblx0XHRcdFx0XHRjYXNlICdmdW5jdGlvbiBmKCkgeyc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdFx0XHRcdDAsIG90aGVyTWV0YWRhdGExLFxuXHRcdFx0XHRcdFx0XHQ4LCBvdGhlck1ldGFkYXRhMSxcblx0XHRcdFx0XHRcdFx0OSwgb3RoZXJNZXRhZGF0YTEsXG5cdFx0XHRcdFx0XHRcdDEwLCBvdGhlck1ldGFkYXRhMSxcblx0XHRcdFx0XHRcdFx0MTEsIG90aGVyTWV0YWRhdGExLFxuXHRcdFx0XHRcdFx0XHQxMiwgb3RoZXJNZXRhZGF0YTEsXG5cdFx0XHRcdFx0XHRcdDEzLCBvdGhlck1ldGFkYXRhMSxcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICcgIHJldHVybiA8cD57dHJ1ZX08L3A+Oyc6IHtcblx0XHRcdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdFx0XHRcdDAsIG90aGVyTWV0YWRhdGExLFxuXHRcdFx0XHRcdFx0XHQyLCBvdGhlck1ldGFkYXRhMSxcblx0XHRcdFx0XHRcdFx0OCwgb3RoZXJNZXRhZGF0YTEsXG5cdFx0XHRcdFx0XHRcdDksIG90aGVyTWV0YWRhdGEyLFxuXHRcdFx0XHRcdFx0XHQxMCwgb3RoZXJNZXRhZGF0YTIsXG5cdFx0XHRcdFx0XHRcdDExLCBvdGhlck1ldGFkYXRhMixcblx0XHRcdFx0XHRcdFx0MTIsIG90aGVyTWV0YWRhdGEyLFxuXHRcdFx0XHRcdFx0XHQxMywgb3RoZXJNZXRhZGF0YTEsXG5cdFx0XHRcdFx0XHRcdDE3LCBvdGhlck1ldGFkYXRhMixcblx0XHRcdFx0XHRcdFx0MTgsIG90aGVyTWV0YWRhdGEyLFxuXHRcdFx0XHRcdFx0XHQyMCwgb3RoZXJNZXRhZGF0YTIsXG5cdFx0XHRcdFx0XHRcdDIxLCBvdGhlck1ldGFkYXRhMixcblx0XHRcdFx0XHRcdFx0MjIsIG90aGVyTWV0YWRhdGEyLFxuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJ30nOiB7XG5cdFx0XHRcdFx0XHRjb25zdCB0b2tlbnMgPSBuZXcgVWludDMyQXJyYXkoW1xuXHRcdFx0XHRcdFx0XHQwLCBvdGhlck1ldGFkYXRhMVxuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZGApO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIobW9kZTEsIHRva2VuaXphdGlvblN1cHBvcnQpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3Rlcihtb2RlMSwge1xuXHRcdFx0YnJhY2tldHM6IFtcblx0XHRcdFx0Wyd7JywgJ30nXSxcblx0XHRcdFx0WydbJywgJ10nXSxcblx0XHRcdFx0WycoJywgJyknXVxuXHRcdFx0XSxcblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobW9kZTIsIHtcblx0XHRcdGJyYWNrZXRzOiBbXG5cdFx0XHRcdFsneycsICd9J10sXG5cdFx0XHRcdFsnWycsICddJ10sXG5cdFx0XHRcdFsnKCcsICcpJ11cblx0XHRcdF0sXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdFtcblx0XHRcdFx0J2Z1bmN0aW9uIGYoKSB7Jyxcblx0XHRcdFx0JyAgcmV0dXJuIDxwPnt0cnVlfTwvcD47Jyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdG1vZGUxXG5cdFx0KSk7XG5cblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24oMSk7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKDIpO1xuXHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbigzKTtcblxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRtb2RlbC5icmFja2V0UGFpcnMubWF0Y2hCcmFja2V0KG5ldyBQb3NpdGlvbigyLCAxNCkpLFxuXHRcdFx0W25ldyBSYW5nZSgyLCAxMywgMiwgMTQpLCBuZXcgUmFuZ2UoMiwgMTgsIDIsIDE5KV1cblx0XHQpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjODgwNzU6IFR5cGVTY3JpcHQgYnJhY2UgbWF0Y2hpbmcgaXMgaW5jb3JyZWN0IGluIGAke31gIHN0cmluZ3MnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBtb2RlID0gJ3Rlc3RNb2RlJztcblxuXHRcdGNvbnN0IGxhbmd1YWdlSWRDb2RlYyA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKS5sYW5ndWFnZUlkQ29kZWM7XG5cblx0XHRjb25zdCBlbmNvZGVkTW9kZSA9IGxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKG1vZGUpO1xuXG5cdFx0Y29uc3Qgb3RoZXJNZXRhZGF0YSA9IChcblx0XHRcdChlbmNvZGVkTW9kZSA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVClcblx0XHRcdHwgKFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKVxuXHRcdCkgPj4+IDA7XG5cdFx0Y29uc3Qgc3RyaW5nTWV0YWRhdGEgPSAoXG5cdFx0XHQoZW5jb2RlZE1vZGUgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpXG5cdFx0XHR8IChTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcgPDwgTWV0YWRhdGFDb25zdHMuVE9LRU5fVFlQRV9PRkZTRVQpXG5cdFx0KSA+Pj4gMDtcblxuXHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQ6IElUb2tlbml6YXRpb25TdXBwb3J0ID0ge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0XHR0b2tlbml6ZTogdW5kZWZpbmVkISxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmUsIGhhc0VPTCwgc3RhdGUpID0+IHtcblx0XHRcdFx0c3dpdGNoIChsaW5lKSB7XG5cdFx0XHRcdFx0Y2FzZSAnZnVuY3Rpb24gaGVsbG8oKSB7Jzoge1xuXHRcdFx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0XHRcdFx0MCwgb3RoZXJNZXRhZGF0YVxuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNhc2UgJyAgICBjb25zb2xlLmxvZyhgJHsxMDB9YCk7Jzoge1xuXHRcdFx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0XHRcdFx0MCwgb3RoZXJNZXRhZGF0YSxcblx0XHRcdFx0XHRcdFx0MTYsIHN0cmluZ01ldGFkYXRhLFxuXHRcdFx0XHRcdFx0XHQxOSwgb3RoZXJNZXRhZGF0YSxcblx0XHRcdFx0XHRcdFx0MjIsIHN0cmluZ01ldGFkYXRhLFxuXHRcdFx0XHRcdFx0XHQyNCwgb3RoZXJNZXRhZGF0YSxcblx0XHRcdFx0XHRcdF0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjYXNlICd9Jzoge1xuXHRcdFx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0XHRcdFx0MCwgb3RoZXJNZXRhZGF0YVxuXHRcdFx0XHRcdFx0XSk7XG5cdFx0XHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZGApO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIobW9kZSwgdG9rZW5pemF0aW9uU3VwcG9ydCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKG1vZGUsIHtcblx0XHRcdGJyYWNrZXRzOiBbXG5cdFx0XHRcdFsneycsICd9J10sXG5cdFx0XHRcdFsnWycsICddJ10sXG5cdFx0XHRcdFsnKCcsICcpJ11cblx0XHRcdF0sXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoXG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRcdFtcblx0XHRcdFx0J2Z1bmN0aW9uIGhlbGxvKCkgeycsXG5cdFx0XHRcdCcgICAgY29uc29sZS5sb2coYCR7MTAwfWApOycsXG5cdFx0XHRcdCd9J1xuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdG1vZGVcblx0XHQpKTtcblxuXHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbigxKTtcblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24oMik7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKDMpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5icmFja2V0UGFpcnMubWF0Y2hCcmFja2V0KG5ldyBQb3NpdGlvbigyLCAyMykpLCBudWxsKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG1vZGVsLmJyYWNrZXRQYWlycy5tYXRjaEJyYWNrZXQobmV3IFBvc2l0aW9uKDIsIDIwKSksIG51bGwpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5cbnN1aXRlKCdUZXh0TW9kZWxXaXRoVG9rZW5zIHJlZ3Jlc3Npb24gdGVzdHMnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMTIyOiBVbmhhbmRsZWQgRXhjZXB0aW9uOiBUeXBlRXJyb3I6IFVuYWJsZSB0byBnZXQgcHJvcGVydHkgXFwncmVwbGFjZVxcJyBvZiB1bmRlZmluZWQgb3IgbnVsbCByZWZlcmVuY2UnLCAoKSA9PiB7XG5cdFx0ZnVuY3Rpb24gYXNzZXJ0Vmlld0xpbmVUb2tlbnMobW9kZWw6IFRleHRNb2RlbCwgbGluZU51bWJlcjogbnVtYmVyLCBmb3JjZVRva2VuaXphdGlvbjogYm9vbGVhbiwgZXhwZWN0ZWQ6IFRlc3RMaW5lVG9rZW5bXSk6IHZvaWQge1xuXHRcdFx0aWYgKGZvcmNlVG9rZW5pemF0aW9uKSB7XG5cdFx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5mb3JjZVRva2VuaXphdGlvbihsaW5lTnVtYmVyKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IF9hY3R1YWwgPSBtb2RlbC50b2tlbml6YXRpb24uZ2V0TGluZVRva2VucyhsaW5lTnVtYmVyKS5pbmZsYXRlKCk7XG5cdFx0XHRpbnRlcmZhY2UgSVNpbXBsZVZpZXdUb2tlbiB7XG5cdFx0XHRcdGVuZEluZGV4OiBudW1iZXI7XG5cdFx0XHRcdGZvcmVncm91bmQ6IG51bWJlcjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGFjdHVhbDogSVNpbXBsZVZpZXdUb2tlbltdID0gW107XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gX2FjdHVhbC5nZXRDb3VudCgpOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdFx0YWN0dWFsW2ldID0ge1xuXHRcdFx0XHRcdGVuZEluZGV4OiBfYWN0dWFsLmdldEVuZE9mZnNldChpKSxcblx0XHRcdFx0XHRmb3JlZ3JvdW5kOiBfYWN0dWFsLmdldEZvcmVncm91bmQoaSlcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGRlY29kZSA9ICh0b2tlbjogVGVzdExpbmVUb2tlbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGVuZEluZGV4OiB0b2tlbi5lbmRJbmRleCxcblx0XHRcdFx0XHRmb3JlZ3JvdW5kOiB0b2tlbi5nZXRGb3JlZ3JvdW5kKClcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgZXhwZWN0ZWQubWFwKGRlY29kZSkpO1xuXHRcdH1cblxuXHRcdGxldCBfdG9rZW5JZCA9IDEwO1xuXHRcdGNvbnN0IExBTkdfSUQxID0gJ2luZGljaXNpdmVNb2RlMSc7XG5cdFx0Y29uc3QgTEFOR19JRDIgPSAnaW5kaWNpc2l2ZU1vZGUyJztcblxuXHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQ6IElUb2tlbml6YXRpb25TdXBwb3J0ID0ge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0XHR0b2tlbml6ZTogdW5kZWZpbmVkISxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmUsIGhhc0VPTCwgc3RhdGUpID0+IHtcblx0XHRcdFx0Y29uc3QgbXlJZCA9ICsrX3Rva2VuSWQ7XG5cdFx0XHRcdGNvbnN0IHRva2VucyA9IG5ldyBVaW50MzJBcnJheSgyKTtcblx0XHRcdFx0dG9rZW5zWzBdID0gMDtcblx0XHRcdFx0dG9rZW5zWzFdID0gKFxuXHRcdFx0XHRcdG15SWQgPDwgTWV0YWRhdGFDb25zdHMuRk9SRUdST1VORF9PRkZTRVRcblx0XHRcdFx0KSA+Pj4gMDtcblx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHRva2Vucywgc3RhdGUpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCByZWdpc3RyYXRpb24xID0gVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIoTEFOR19JRDEsIHRva2VuaXphdGlvblN1cHBvcnQpO1xuXHRcdGNvbnN0IHJlZ2lzdHJhdGlvbjIgPSBUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihMQU5HX0lEMiwgdG9rZW5pemF0aW9uU3VwcG9ydCk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnQSBtb2RlbCB3aXRoXFxudHdvIGxpbmVzJyk7XG5cblx0XHRhc3NlcnRWaWV3TGluZVRva2Vucyhtb2RlbCwgMSwgdHJ1ZSwgW2NyZWF0ZVZpZXdMaW5lVG9rZW4oMTIsIDEpXSk7XG5cdFx0YXNzZXJ0Vmlld0xpbmVUb2tlbnMobW9kZWwsIDIsIHRydWUsIFtjcmVhdGVWaWV3TGluZVRva2VuKDksIDEpXSk7XG5cblx0XHRtb2RlbC5zZXRMYW5ndWFnZShMQU5HX0lEMSk7XG5cblx0XHRhc3NlcnRWaWV3TGluZVRva2Vucyhtb2RlbCwgMSwgdHJ1ZSwgW2NyZWF0ZVZpZXdMaW5lVG9rZW4oMTIsIDExKV0pO1xuXHRcdGFzc2VydFZpZXdMaW5lVG9rZW5zKG1vZGVsLCAyLCB0cnVlLCBbY3JlYXRlVmlld0xpbmVUb2tlbig5LCAxMildKTtcblxuXHRcdG1vZGVsLnNldExhbmd1YWdlKExBTkdfSUQyKTtcblxuXHRcdGFzc2VydFZpZXdMaW5lVG9rZW5zKG1vZGVsLCAxLCBmYWxzZSwgW2NyZWF0ZVZpZXdMaW5lVG9rZW4oMTIsIDEpXSk7XG5cdFx0YXNzZXJ0Vmlld0xpbmVUb2tlbnMobW9kZWwsIDIsIGZhbHNlLCBbY3JlYXRlVmlld0xpbmVUb2tlbig5LCAxKV0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdHJlZ2lzdHJhdGlvbjEuZGlzcG9zZSgpO1xuXHRcdHJlZ2lzdHJhdGlvbjIuZGlzcG9zZSgpO1xuXG5cdFx0ZnVuY3Rpb24gY3JlYXRlVmlld0xpbmVUb2tlbihlbmRJbmRleDogbnVtYmVyLCBmb3JlZ3JvdW5kOiBudW1iZXIpOiBUZXN0TGluZVRva2VuIHtcblx0XHRcdGNvbnN0IG1ldGFkYXRhID0gKFxuXHRcdFx0XHQoZm9yZWdyb3VuZCA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdCkgPj4+IDA7XG5cdFx0XHRyZXR1cm4gbmV3IFRlc3RMaW5lVG9rZW4oZW5kSW5kZXgsIG1ldGFkYXRhKTtcblx0XHR9XG5cdH0pO1xuXG5cblx0dGVzdCgnbWljcm9zb2Z0L21vbmFjby1lZGl0b3IjMTMzOiBFcnJvcjogQ2Fubm90IHJlYWQgcHJvcGVydHkgXFwnbW9kZUlkXFwnIG9mIHVuZGVmaW5lZCcsICgpID0+IHtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsV2l0aEJyYWNrZXRzKFxuXHRcdFx0ZGlzcG9zYWJsZXMsXG5cdFx0XHRbXG5cdFx0XHRcdCdJbXBvcnRzIFN5c3RlbScsXG5cdFx0XHRcdCdJbXBvcnRzIFN5c3RlbS5Db2xsZWN0aW9ucy5HZW5lcmljJyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdNb2R1bGUgbTEnLFxuXHRcdFx0XHQnJyxcblx0XHRcdFx0J1xcdFN1YiBNYWluKCknLFxuXHRcdFx0XHQnXFx0RW5kIFN1YicsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnRW5kIE1vZHVsZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0W1xuXHRcdFx0XHRbJ21vZHVsZScsICdlbmQgbW9kdWxlJ10sXG5cdFx0XHRcdFsnc3ViJywgJ2VuZCBzdWInXVxuXHRcdFx0XVxuXHRcdCk7XG5cblx0XHRjb25zdCBhY3R1YWwgPSBtb2RlbC5icmFja2V0UGFpcnMubWF0Y2hCcmFja2V0KG5ldyBQb3NpdGlvbig0LCAxKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWwsIFtuZXcgUmFuZ2UoNCwgMSwgNCwgNyksIG5ldyBSYW5nZSg5LCAxLCA5LCAxMSldKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExODU2OiBCcmFja2V0IG1hdGNoaW5nIGRvZXMgbm90IHdvcmsgYXMgZXhwZWN0ZWQgaWYgdGhlIG9wZW5pbmcgYnJhY2Ugc3ltYm9sIGlzIGNvbnRhaW5lZCBpbiB0aGUgY2xvc2luZyBicmFjZSBzeW1ib2wnLCAoKSA9PiB7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhCcmFja2V0cyhcblx0XHRcdGRpc3Bvc2FibGVzLFxuXHRcdFx0W1xuXHRcdFx0XHQnc2VxdWVuY2UgXCJvdXRlclwiJyxcblx0XHRcdFx0JyAgICAgc2VxdWVuY2UgXCJpbm5lclwiJyxcblx0XHRcdFx0JyAgICAgZW5kc2VxdWVuY2UnLFxuXHRcdFx0XHQnZW5kc2VxdWVuY2UnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSxcblx0XHRcdFtcblx0XHRcdFx0WydzZXF1ZW5jZScsICdlbmRzZXF1ZW5jZSddLFxuXHRcdFx0XHRbJ2ZlYXR1cmUnLCAnZW5kZmVhdHVyZSddXG5cdFx0XHRdXG5cdFx0KTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IG1vZGVsLmJyYWNrZXRQYWlycy5tYXRjaEJyYWNrZXQobmV3IFBvc2l0aW9uKDMsIDkpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgW25ldyBSYW5nZSgyLCA2LCAyLCAxNCksIG5ldyBSYW5nZSgzLCA2LCAzLCAxNyldKTtcblxuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzYzODIyOiBXcm9uZyBlbWJlZGRlZCBsYW5ndWFnZSBkZXRlY3RlZCBmb3IgZW1wdHkgbGluZXMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cblx0XHRjb25zdCBvdXRlck1vZGUgPSAnb3V0ZXJNb2RlJztcblx0XHRjb25zdCBpbm5lck1vZGUgPSAnaW5uZXJNb2RlJztcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBvdXRlck1vZGUgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBpbm5lck1vZGUgfSkpO1xuXG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZENvZGVjID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZVNlcnZpY2UpLmxhbmd1YWdlSWRDb2RlYztcblx0XHRjb25zdCBlbmNvZGVkSW5uZXJNb2RlID0gbGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQoaW5uZXJNb2RlKTtcblxuXHRcdGNvbnN0IHRva2VuaXphdGlvblN1cHBvcnQ6IElUb2tlbml6YXRpb25TdXBwb3J0ID0ge1xuXHRcdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0XHR0b2tlbml6ZTogdW5kZWZpbmVkISxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmUsIGhhc0VPTCwgc3RhdGUpID0+IHtcblx0XHRcdFx0Y29uc3QgdG9rZW5zID0gbmV3IFVpbnQzMkFycmF5KDIpO1xuXHRcdFx0XHR0b2tlbnNbMF0gPSAwO1xuXHRcdFx0XHR0b2tlbnNbMV0gPSAoXG5cdFx0XHRcdFx0ZW5jb2RlZElubmVyTW9kZSA8PCBNZXRhZGF0YUNvbnN0cy5MQU5HVUFHRUlEX09GRlNFVFxuXHRcdFx0XHQpID4+PiAwO1xuXHRcdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBzdGF0ZSk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihvdXRlck1vZGUsIHRva2VuaXphdGlvblN1cHBvcnQpKTtcblxuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCAnQSBtb2RlbCB3aXRoIG9uZSBsaW5lJywgb3V0ZXJNb2RlKSk7XG5cblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24oMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKDEsIDEpLCBpbm5lck1vZGUpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnVGV4dE1vZGVsLmdldExpbmVJbmRlbnRHdWlkZScsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiBhc3NlcnRJbmRlbnRHdWlkZXMobGluZXM6IFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXIsIHN0cmluZ11bXSwgaW5kZW50U2l6ZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9ICd0ZXN0TGFuZyc7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXG5cdFx0Y29uc3QgdGV4dCA9IGxpbmVzLm1hcChsID0+IGxbNF0pLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0ZXh0LCBsYW5ndWFnZUlkKSk7XG5cdFx0bW9kZWwudXBkYXRlT3B0aW9ucyh7IGluZGVudFNpemU6IGluZGVudFNpemUgfSk7XG5cblx0XHRjb25zdCBhY3R1YWxJbmRlbnRzID0gbW9kZWwuZ3VpZGVzLmdldExpbmVzSW5kZW50R3VpZGVzKDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblxuXHRcdGNvbnN0IGFjdHVhbDogW251bWJlciwgbnVtYmVyLCBudW1iZXIsIG51bWJlciwgc3RyaW5nXVtdID0gW107XG5cdFx0Zm9yIChsZXQgbGluZSA9IDE7IGxpbmUgPD0gbW9kZWwuZ2V0TGluZUNvdW50KCk7IGxpbmUrKykge1xuXHRcdFx0Y29uc3QgYWN0aXZlSW5kZW50R3VpZGUgPSBtb2RlbC5ndWlkZXMuZ2V0QWN0aXZlSW5kZW50R3VpZGUobGluZSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdFx0YWN0dWFsW2xpbmUgLSAxXSA9IFthY3R1YWxJbmRlbnRzW2xpbmUgLSAxXSwgYWN0aXZlSW5kZW50R3VpZGUuc3RhcnRMaW5lTnVtYmVyLCBhY3RpdmVJbmRlbnRHdWlkZS5lbmRMaW5lTnVtYmVyLCBhY3RpdmVJbmRlbnRHdWlkZS5pbmRlbnQsIG1vZGVsLmdldExpbmVDb250ZW50KGxpbmUpXTtcblx0XHR9XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbCwgbGluZXMpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0dGVzdCgnZ2V0TGluZUluZGVudEd1aWRlIG9uZSBsZXZlbCAyJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgNCwgMSwgJ0EnXSxcblx0XHRcdFsxLCAyLCA0LCAxLCAnICBBJ10sXG5cdFx0XHRbMSwgMiwgNCwgMSwgJyAgQSddLFxuXHRcdFx0WzEsIDIsIDQsIDEsICcgIEEnXSxcblx0XHRdLCAyKTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TGluZUluZGVudEd1aWRlIHR3byBsZXZlbHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0SW5kZW50R3VpZGVzKFtcblx0XHRcdFswLCAyLCA1LCAxLCAnQSddLFxuXHRcdFx0WzEsIDIsIDUsIDEsICcgIEEnXSxcblx0XHRcdFsxLCA0LCA1LCAyLCAnICBBJ10sXG5cdFx0XHRbMiwgNCwgNSwgMiwgJyAgICBBJ10sXG5cdFx0XHRbMiwgNCwgNSwgMiwgJyAgICBBJ10sXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVJbmRlbnRHdWlkZSB0aHJlZSBsZXZlbHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0SW5kZW50R3VpZGVzKFtcblx0XHRcdFswLCAyLCA0LCAxLCAnQSddLFxuXHRcdFx0WzEsIDMsIDQsIDIsICcgIEEnXSxcblx0XHRcdFsyLCA0LCA0LCAzLCAnICAgIEEnXSxcblx0XHRcdFszLCA0LCA0LCAzLCAnICAgICAgQSddLFxuXHRcdFx0WzAsIDUsIDUsIDAsICdBJ10sXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVJbmRlbnRHdWlkZSBkZWNyZWFzaW5nIGluZGVudCcsICgpID0+IHtcblx0XHRhc3NlcnRJbmRlbnRHdWlkZXMoW1xuXHRcdFx0WzIsIDEsIDEsIDIsICcgICAgQSddLFxuXHRcdFx0WzEsIDEsIDEsIDIsICcgIEEnXSxcblx0XHRcdFswLCAxLCAyLCAxLCAnQSddLFxuXHRcdF0sIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRMaW5lSW5kZW50R3VpZGUgSmF2YScsICgpID0+IHtcblx0XHRhc3NlcnRJbmRlbnRHdWlkZXMoW1xuXHRcdFx0LyogMSovWzAsIDIsIDksIDEsICdjbGFzcyBBIHsnXSxcblx0XHRcdC8qIDIqL1sxLCAzLCA0LCAyLCAnICB2b2lkIGZvbygpIHsnXSxcblx0XHRcdC8qIDMqL1syLCAzLCA0LCAyLCAnICAgIGNvbnNvbGUubG9nKDEpOyddLFxuXHRcdFx0LyogNCovWzIsIDMsIDQsIDIsICcgICAgY29uc29sZS5sb2coMik7J10sXG5cdFx0XHQvKiA1Ki9bMSwgMywgNCwgMiwgJyAgfSddLFxuXHRcdFx0LyogNiovWzEsIDIsIDksIDEsICcnXSxcblx0XHRcdC8qIDcqL1sxLCA4LCA4LCAyLCAnICB2b2lkIGJhcigpIHsnXSxcblx0XHRcdC8qIDgqL1syLCA4LCA4LCAyLCAnICAgIGNvbnNvbGUubG9nKDMpOyddLFxuXHRcdFx0LyogOSovWzEsIDgsIDgsIDIsICcgIH0nXSxcblx0XHRcdC8qMTAqL1swLCAyLCA5LCAxLCAnfSddLFxuXHRcdFx0LyoxMSovWzAsIDEyLCAxMiwgMSwgJ2ludGVyZmFjZSBCIHsnXSxcblx0XHRcdC8qMTIqL1sxLCAxMiwgMTIsIDEsICcgIHZvaWQgYmFyKCk7J10sXG5cdFx0XHQvKjEzKi9bMCwgMTIsIDEyLCAxLCAnfSddLFxuXHRcdF0sIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRMaW5lSW5kZW50R3VpZGUgSmF2YWRvYycsICgpID0+IHtcblx0XHRhc3NlcnRJbmRlbnRHdWlkZXMoW1xuXHRcdFx0WzAsIDIsIDMsIDEsICcvKionXSxcblx0XHRcdFsxLCAyLCAzLCAxLCAnICogQ29tbWVudCddLFxuXHRcdFx0WzEsIDIsIDMsIDEsICcgKi8nXSxcblx0XHRcdFswLCA1LCA2LCAxLCAnY2xhc3MgQSB7J10sXG5cdFx0XHRbMSwgNSwgNiwgMSwgJyAgdm9pZCBmb28oKSB7J10sXG5cdFx0XHRbMSwgNSwgNiwgMSwgJyAgfSddLFxuXHRcdFx0WzAsIDUsIDYsIDEsICd9J10sXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVJbmRlbnRHdWlkZSBXaGl0ZXNwYWNlJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgNywgMSwgJ2NsYXNzIEEgeyddLFxuXHRcdFx0WzEsIDIsIDcsIDEsICcnXSxcblx0XHRcdFsxLCA0LCA1LCAyLCAnICB2b2lkIGZvbygpIHsnXSxcblx0XHRcdFsyLCA0LCA1LCAyLCAnICAgICddLFxuXHRcdFx0WzIsIDQsIDUsIDIsICcgICAgcmV0dXJuIDE7J10sXG5cdFx0XHRbMSwgNCwgNSwgMiwgJyAgfSddLFxuXHRcdFx0WzEsIDIsIDcsIDEsICcgICAgICAnXSxcblx0XHRcdFswLCAyLCA3LCAxLCAnfSddXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldExpbmVJbmRlbnRHdWlkZSBUYWJzJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgNywgMSwgJ2NsYXNzIEEgeyddLFxuXHRcdFx0WzEsIDIsIDcsIDEsICdcXHRcXHQnXSxcblx0XHRcdFsxLCA0LCA1LCAyLCAnXFx0dm9pZCBmb28oKSB7J10sXG5cdFx0XHRbMiwgNCwgNSwgMiwgJ1xcdCBcXHQvL2hlbGxvJ10sXG5cdFx0XHRbMiwgNCwgNSwgMiwgJ1xcdCAgICByZXR1cm4gMjsnXSxcblx0XHRcdFsxLCA0LCA1LCAyLCAnICBcXHR9J10sXG5cdFx0XHRbMSwgMiwgNywgMSwgJyAgICAgICddLFxuXHRcdFx0WzAsIDIsIDcsIDEsICd9J11cblx0XHRdLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnZ2V0TGluZUluZGVudEd1aWRlIGNoZWNrZXIudHMnLCAoKSA9PiB7XG5cdFx0YXNzZXJ0SW5kZW50R3VpZGVzKFtcblx0XHRcdC8qIDEqL1swLCAxLCAxLCAwLCAnLy8vIDxyZWZlcmVuY2UgcGF0aD1cImJpbmRlci50c1wiLz4nXSxcblx0XHRcdC8qIDIqL1swLCAyLCAyLCAwLCAnJ10sXG5cdFx0XHQvKiAzKi9bMCwgMywgMywgMCwgJy8qIEBpbnRlcm5hbCAqLyddLFxuXHRcdFx0LyogNCovWzAsIDUsIDE2LCAxLCAnbmFtZXNwYWNlIHRzIHsnXSxcblx0XHRcdC8qIDUqL1sxLCA1LCAxNiwgMSwgJyAgICBsZXQgbmV4dFN5bWJvbElkID0gMTsnXSxcblx0XHRcdC8qIDYqL1sxLCA1LCAxNiwgMSwgJyAgICBsZXQgbmV4dE5vZGVJZCA9IDE7J10sXG5cdFx0XHQvKiA3Ki9bMSwgNSwgMTYsIDEsICcgICAgbGV0IG5leHRNZXJnZUlkID0gMTsnXSxcblx0XHRcdC8qIDgqL1sxLCA1LCAxNiwgMSwgJyAgICBsZXQgbmV4dEZsb3dJZCA9IDE7J10sXG5cdFx0XHQvKiA5Ki9bMSwgNSwgMTYsIDEsICcnXSxcblx0XHRcdC8qMTAqL1sxLCAxMSwgMTUsIDIsICcgICAgZXhwb3J0IGZ1bmN0aW9uIGdldE5vZGVJZChub2RlOiBOb2RlKTogbnVtYmVyIHsnXSxcblx0XHRcdC8qMTEqL1syLCAxMiwgMTMsIDMsICcgICAgICAgIGlmICghbm9kZS5pZCkgeyddLFxuXHRcdFx0LyoxMiovWzMsIDEyLCAxMywgMywgJyAgICAgICAgICAgIG5vZGUuaWQgPSBuZXh0Tm9kZUlkOyddLFxuXHRcdFx0LyoxMyovWzMsIDEyLCAxMywgMywgJyAgICAgICAgICAgIG5leHROb2RlSWQrKzsnXSxcblx0XHRcdC8qMTQqL1syLCAxMiwgMTMsIDMsICcgICAgICAgIH0nXSxcblx0XHRcdC8qMTUqL1syLCAxMSwgMTUsIDIsICcgICAgICAgIHJldHVybiBub2RlLmlkOyddLFxuXHRcdFx0LyoxNiovWzEsIDExLCAxNSwgMiwgJyAgICB9J10sXG5cdFx0XHQvKjE3Ki9bMCwgNSwgMTYsIDEsICd9J11cblx0XHRdLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzg0MjUgLSBNaXNzaW5nIGluZGVudGF0aW9uIGxpbmVzIGZvciBmaXJzdCBsZXZlbCBpbmRlbnRhdGlvbicsICgpID0+IHtcblx0XHRhc3NlcnRJbmRlbnRHdWlkZXMoW1xuXHRcdFx0WzEsIDIsIDMsIDIsICdcXHRpbmRlbnQxJ10sXG5cdFx0XHRbMiwgMiwgMywgMiwgJ1xcdFxcdGluZGVudDInXSxcblx0XHRcdFsyLCAyLCAzLCAyLCAnXFx0XFx0aW5kZW50MiddLFxuXHRcdFx0WzEsIDIsIDMsIDIsICdcXHRpbmRlbnQxJ11cblx0XHRdLCA0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzg5NTIgLSBJbmRlbnRhdGlvbiBndWlkZSBsaW5lcyBnb2luZyB0aHJvdWdoIHRleHQgb24gLnltbCBmaWxlJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgNSwgMSwgJ3Byb3BlcnRpZXM6J10sXG5cdFx0XHRbMSwgMywgNSwgMiwgJyAgICBlbWFpbEFkZHJlc3M6J10sXG5cdFx0XHRbMiwgMywgNSwgMiwgJyAgICAgICAgLSBibGEnXSxcblx0XHRcdFsyLCA1LCA1LCAzLCAnICAgICAgICAtIGxlbmd0aDonXSxcblx0XHRcdFszLCA1LCA1LCAzLCAnICAgICAgICAgICAgbWF4OiAyNTUnXSxcblx0XHRcdFswLCA2LCA2LCAwLCAnZ2V0dGVyczonXVxuXHRcdF0sIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTE4OTIgLSBJbmRlbnQgZ3VpZGVzIGxvb2sgZnVubnknLCAoKSA9PiB7XG5cdFx0YXNzZXJ0SW5kZW50R3VpZGVzKFtcblx0XHRcdFswLCAyLCA3LCAxLCAnZnVuY3Rpb24gdGVzdChiYXNlKSB7J10sXG5cdFx0XHRbMSwgMywgNiwgMiwgJ1xcdHN3aXRjaCAoYmFzZSkgeyddLFxuXHRcdFx0WzIsIDQsIDQsIDMsICdcXHRcXHRjYXNlIDE6J10sXG5cdFx0XHRbMywgNCwgNCwgMywgJ1xcdFxcdFxcdHJldHVybiAxOyddLFxuXHRcdFx0WzIsIDYsIDYsIDMsICdcXHRcXHRjYXNlIDI6J10sXG5cdFx0XHRbMywgNiwgNiwgMywgJ1xcdFxcdFxcdHJldHVybiAyOyddLFxuXHRcdFx0WzEsIDIsIDcsIDEsICdcXHR9J10sXG5cdFx0XHRbMCwgMiwgNywgMSwgJ30nXVxuXHRcdF0sIDQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTIzOTggLSBQcm9ibGVtIGluIGluZGVudCBndWlkZWxpbmVzJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMiwgMiwgMiwgMywgJ1xcdFxcdC5ibGEnXSxcblx0XHRcdFszLCAyLCAyLCAzLCAnXFx0XFx0XFx0bGFiZWwoZm9yKSddLFxuXHRcdFx0WzAsIDMsIDMsIDAsICdpbmNsdWRlIHNjcmlwdCddXG5cdFx0XSwgNCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM0OTE3MycsICgpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnY2xhc3MgQSB7Jyxcblx0XHRcdCdcdHB1YmxpYyBtMSgpOiB2b2lkIHsnLFxuXHRcdFx0J1x0fScsXG5cdFx0XHQnXHRwdWJsaWMgbTIoKTogdm9pZCB7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J1x0cHVibGljIG0zKCk6IHZvaWQgeycsXG5cdFx0XHQnXHR9Jyxcblx0XHRcdCdcdHB1YmxpYyBtNCgpOiB2b2lkIHsnLFxuXHRcdFx0J1x0fScsXG5cdFx0XHQnXHRwdWJsaWMgbTUoKTogdm9pZCB7Jyxcblx0XHRcdCdcdH0nLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0Y29uc3QgYWN0dWFsID0gbW9kZWwuZ3VpZGVzLmdldEFjdGl2ZUluZGVudEd1aWRlKDIsIDQsIDkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCB7IHN0YXJ0TGluZU51bWJlcjogMiwgZW5kTGluZU51bWJlcjogOSwgaW5kZW50OiAxIH0pO1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgndHdlYWtzIC0gbm8gYWN0aXZlJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMSwgMSwgMCwgJ0EnXSxcblx0XHRcdFswLCAyLCAyLCAwLCAnQSddXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3ZWFrcyAtIGluc2lkZSBzY29wZScsICgpID0+IHtcblx0XHRhc3NlcnRJbmRlbnRHdWlkZXMoW1xuXHRcdFx0WzAsIDIsIDIsIDEsICdBJ10sXG5cdFx0XHRbMSwgMiwgMiwgMSwgJyAgQSddXG5cdFx0XSwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ3R3ZWFrcyAtIHNjb3BlIHN0YXJ0JywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgMiwgMSwgJ0EnXSxcblx0XHRcdFsxLCAyLCAyLCAxLCAnICBBJ10sXG5cdFx0XHRbMCwgMiwgMiwgMSwgJ0EnXVxuXHRcdF0sIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCd0d2Vha3MgLSBlbXB0eSBsaW5lJywgKCkgPT4ge1xuXHRcdGFzc2VydEluZGVudEd1aWRlcyhbXG5cdFx0XHRbMCwgMiwgNCwgMSwgJ0EnXSxcblx0XHRcdFsxLCAyLCA0LCAxLCAnICBBJ10sXG5cdFx0XHRbMSwgMiwgNCwgMSwgJyddLFxuXHRcdFx0WzEsIDIsIDQsIDEsICcgIEEnXSxcblx0XHRcdFswLCAyLCA0LCAxLCAnQSddXG5cdFx0XSwgMik7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBR3RCLFNBQStCLHNCQUFzQixpQ0FBaUM7QUFDdEYsU0FBUyxtQkFBbUIsc0JBQXNCO0FBRWxELFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMscUJBQXFCLGlCQUFpQiw0QkFBNEI7QUFFM0UsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyw0QkFBNEIsYUFBOEIsTUFBYyxVQUFzQztBQUN0SCxRQUFNLGFBQWE7QUFDbkIsUUFBTSx1QkFBdUIsb0JBQW9CLFdBQVc7QUFDNUQsUUFBTSwrQkFBK0IscUJBQXFCLElBQUksNkJBQTZCO0FBQzNGLFFBQU0sa0JBQWtCLHFCQUFxQixJQUFJLGdCQUFnQjtBQUVqRSxjQUFZLElBQUksZ0JBQWdCLGlCQUFpQixFQUFFLElBQUksV0FBVyxDQUFDLENBQUM7QUFDcEUsY0FBWSxJQUFJLDZCQUE2QixTQUFTLFlBQVksRUFBRSxTQUFTLENBQUMsQ0FBQztBQUUvRSxTQUFPLFlBQVksSUFBSSxxQkFBcUIsc0JBQXNCLE1BQU0sVUFBVSxDQUFDO0FBQ3BGO0FBRUEsTUFBTSx1QkFBdUIsTUFBTTtBQUVsQywwQ0FBd0M7QUFFeEMsV0FBUyxhQUFhLFVBQW9CLFVBQWlDO0FBQzFFLFVBQU0sYUFBYTtBQUNuQixVQUFNLGNBQWMsSUFBSSxnQkFBZ0I7QUFDeEMsVUFBTSx1QkFBdUIsb0JBQW9CLFdBQVc7QUFDNUQsVUFBTSwrQkFBK0IscUJBQXFC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QU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUV6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6RixvQkFBZ0IsT0FBTyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUMsQ0FBQztBQUN6Rix1QkFBbUIsT0FBTyxHQUFHLENBQUM7QUFDOUIsdUJBQW1CLE9BQU8sR0FBRyxDQUFDO0FBQzlCLHVCQUFtQixPQUFPLEdBQUcsQ0FBQztBQUFBLEVBQy9CLENBQUM7QUFFRCxPQUFLLHNCQUFzQixNQUFNO0FBQ2hDLFVBQU0sT0FDTDtBQUtELFVBQU0sUUFBUSxZQUFZLElBQUkscUJBQXFCLHNCQUFzQixNQUFNLFVBQVUsQ0FBQztBQUUxRixVQUFNLFdBQXVDO0FBQUEsTUFDNUMsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDcEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFFcEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDakUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFFakUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDakUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDakUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDbEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDbkUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDcEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDcEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxFQUFFLEdBQUcsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLEVBQUUsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFFcEUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDbkUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsRUFBRSxDQUFDO0FBQUEsTUFDbkUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFDakUsQ0FBQyxJQUFJLFNBQVMsR0FBRyxDQUFDLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUMsR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQyxDQUFDO0FBQUEsTUFFakUsQ0FBQyxJQUFJ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
