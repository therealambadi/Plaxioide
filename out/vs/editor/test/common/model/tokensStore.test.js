import assert from "assert";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { Position } from "../../../common/core/position.js";
import { Range } from "../../../common/core/range.js";
import { FontStyle, MetadataConsts, TokenMetadata } from "../../../common/encodedTokenAttributes.js";
import { ILanguageConfigurationService, LanguageConfigurationService } from "../../../common/languages/languageConfigurationRegistry.js";
import { LanguageIdCodec } from "../../../common/services/languagesRegistry.js";
import { LineTokens } from "../../../common/tokens/lineTokens.js";
import { SparseMultilineTokens } from "../../../common/tokens/sparseMultilineTokens.js";
import { SparseTokensStore } from "../../../common/tokens/sparseTokensStore.js";
import { createModelServices, createTextModel, instantiateTextModel } from "../testTextModel.js";
suite("TokensStore", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  const SEMANTIC_COLOR = 5;
  function parseTokensState(state) {
    const text = [];
    const tokens = [];
    let baseLine = 1;
    for (let i = 0; i < state.length; i++) {
      const line = state[i];
      let startOffset = 0;
      let lineText = "";
      while (true) {
        const firstPipeOffset = line.indexOf("|", startOffset);
        if (firstPipeOffset === -1) {
          break;
        }
        const secondPipeOffset = line.indexOf("|", firstPipeOffset + 1);
        if (secondPipeOffset === -1) {
          break;
        }
        if (firstPipeOffset + 1 === secondPipeOffset) {
          lineText += line.substring(startOffset, secondPipeOffset + 1);
          startOffset = secondPipeOffset + 1;
          continue;
        }
        lineText += line.substring(startOffset, firstPipeOffset);
        const tokenStartCharacter = lineText.length;
        const tokenLength = secondPipeOffset - firstPipeOffset - 1;
        const metadata = SEMANTIC_COLOR << MetadataConsts.FOREGROUND_OFFSET | MetadataConsts.SEMANTIC_USE_FOREGROUND;
        if (tokens.length === 0) {
          baseLine = i + 1;
        }
        tokens.push(i + 1 - baseLine, tokenStartCharacter, tokenStartCharacter + tokenLength, metadata);
        lineText += line.substr(firstPipeOffset + 1, tokenLength);
        startOffset = secondPipeOffset + 1;
      }
      lineText += line.substring(startOffset);
      text.push(lineText);
    }
    return {
      text: text.join("\n"),
      tokens: SparseMultilineTokens.create(baseLine, new Uint32Array(tokens))
    };
  }
  function extractState(model) {
    const result = [];
    for (let lineNumber = 1; lineNumber <= model.getLineCount(); lineNumber++) {
      const lineTokens = model.tokenization.getLineTokens(lineNumber);
      const lineContent = model.getLineContent(lineNumber);
      let lineText = "";
      for (let i = 0; i < lineTokens.getCount(); i++) {
        const tokenStartCharacter = lineTokens.getStartOffset(i);
        const tokenEndCharacter = lineTokens.getEndOffset(i);
        const metadata = lineTokens.getMetadata(i);
        const color = TokenMetadata.getForeground(metadata);
        const tokenText = lineContent.substring(tokenStartCharacter, tokenEndCharacter);
        if (color === SEMANTIC_COLOR) {
          lineText += `|${tokenText}|`;
        } else {
          lineText += tokenText;
        }
      }
      result.push(lineText);
    }
    return result;
  }
  function testTokensAdjustment(rawInitialState, edits, rawFinalState) {
    const initialState = parseTokensState(rawInitialState);
    const model = createTextModel(initialState.text);
    model.tokenization.setSemanticTokens([initialState.tokens], true);
    model.applyEdits(edits);
    const actualState = extractState(model);
    assert.deepStrictEqual(actualState, rawFinalState);
    model.dispose();
  }
  test("issue #86303 - color shifting between different tokens", () => {
    testTokensAdjustment(
      [
        `import { |URI| } from 'vs/base/common/uri';`,
        `const foo = |URI|.parse('hey');`
      ],
      [
        { range: new Range(2, 9, 2, 10), text: "" }
      ],
      [
        `import { |URI| } from 'vs/base/common/uri';`,
        `const fo = |URI|.parse('hey');`
      ]
    );
  });
  test("deleting a newline", () => {
    testTokensAdjustment(
      [
        `import { |URI| } from 'vs/base/common/uri';`,
        `const foo = |URI|.parse('hey');`
      ],
      [
        { range: new Range(1, 42, 2, 1), text: "" }
      ],
      [
        `import { |URI| } from 'vs/base/common/uri';const foo = |URI|.parse('hey');`
      ]
    );
  });
  test("inserting a newline", () => {
    testTokensAdjustment(
      [
        `import { |URI| } from 'vs/base/common/uri';const foo = |URI|.parse('hey');`
      ],
      [
        { range: new Range(1, 42, 1, 42), text: "\n" }
      ],
      [
        `import { |URI| } from 'vs/base/common/uri';`,
        `const foo = |URI|.parse('hey');`
      ]
    );
  });
  test("deleting a newline 2", () => {
    testTokensAdjustment(
      [
        `import { `,
        `    |URI| } from 'vs/base/common/uri';const foo = |URI|.parse('hey');`
      ],
      [
        { range: new Range(1, 10, 2, 5), text: "" }
      ],
      [
        `import { |URI| } from 'vs/base/common/uri';const foo = |URI|.parse('hey');`
      ]
    );
  });
  test("issue #179268: a complex edit", () => {
    testTokensAdjustment(
      [
        `|export| |'interior_material_selector.dart'|;`,
        `|export| |'mileage_selector.dart'|;`,
        `|export| |'owners_selector.dart'|;`,
        `|export| |'price_selector.dart'|;`,
        `|export| |'seat_count_selector.dart'|;`,
        `|export| |'year_selector.dart'|;`,
        `|export| |'winter_options_selector.dart'|;|export| |'camera_selector.dart'|;`
      ],
      [
        { range: new Range(1, 9, 1, 9), text: `camera_selector.dart';
export '` },
        { range: new Range(6, 9, 7, 9), text: `` },
        { range: new Range(7, 39, 7, 39), text: `
` },
        { range: new Range(7, 47, 7, 48), text: `ye` },
        { range: new Range(7, 49, 7, 51), text: `` },
        { range: new Range(7, 52, 7, 53), text: `` }
      ],
      [
        `|export| |'|camera_selector.dart';`,
        `export 'interior_material_selector.dart';`,
        `|export| |'mileage_selector.dart'|;`,
        `|export| |'owners_selector.dart'|;`,
        `|export| |'price_selector.dart'|;`,
        `|export| |'seat_count_selector.dart'|;`,
        `|export| |'||winter_options_selector.dart'|;`,
        `|export| |'year_selector.dart'|;`
      ]
    );
  });
  test("issue #91936: Semantic token color highlighting fails on line with selected text", () => {
    const model = createTextModel("                    else if ($s = 08) then '\\b'");
    model.tokenization.setSemanticTokens([
      SparseMultilineTokens.create(1, new Uint32Array([
        0,
        20,
        24,
        491536,
        0,
        25,
        27,
        491536,
        0,
        28,
        29,
        32784,
        0,
        29,
        31,
        524304,
        0,
        32,
        33,
        32784,
        0,
        34,
        36,
        196624,
        0,
        36,
        37,
        32784,
        0,
        38,
        42,
        491536,
        0,
        43,
        47,
        360464
      ]))
    ], true);
    const lineTokens = model.tokenization.getLineTokens(1);
    const decodedTokens = [];
    for (let i = 0, len = lineTokens.getCount(); i < len; i++) {
      decodedTokens.push(lineTokens.getEndOffset(i), lineTokens.getMetadata(i));
    }
    assert.deepStrictEqual(decodedTokens, [
      20,
      33588225,
      24,
      34046977,
      25,
      33588225,
      27,
      34046977,
      28,
      33588225,
      29,
      33588225,
      31,
      34079745,
      32,
      33588225,
      33,
      33588225,
      34,
      33588225,
      36,
      33752065,
      37,
      33588225,
      38,
      33588225,
      42,
      34046977,
      43,
      33588225,
      47,
      33915905
    ]);
    model.dispose();
  });
  test('issue #147944: Language id "vs.editor.nullLanguage" is not configured nor known', () => {
    const disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables, [
      [ILanguageConfigurationService, LanguageConfigurationService]
    ]);
    const model = disposables.add(instantiateTextModel(instantiationService, "--[[\n\n]]"));
    model.tokenization.setSemanticTokens([
      SparseMultilineTokens.create(1, new Uint32Array([
        0,
        2,
        4,
        131088,
        1,
        0,
        0,
        131088,
        2,
        0,
        2,
        131088
      ]))
    ], true);
    assert.strictEqual(model.getWordAtPosition(new Position(2, 1)), null);
    disposables.dispose();
  });
  test("partial tokens 1", () => {
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.setPartial(new Range(1, 1, 31, 2), [
      SparseMultilineTokens.create(5, new Uint32Array([
        0,
        5,
        10,
        1,
        5,
        5,
        10,
        2,
        10,
        5,
        10,
        3,
        15,
        5,
        10,
        4,
        20,
        5,
        10,
        5,
        25,
        5,
        10,
        6
      ]))
    ]);
    store.setPartial(new Range(18, 1, 42, 1), [
      SparseMultilineTokens.create(20, new Uint32Array([
        0,
        5,
        10,
        4,
        5,
        5,
        10,
        5,
        10,
        5,
        10,
        6,
        15,
        5,
        10,
        7,
        20,
        5,
        10,
        8
      ]))
    ]);
    store.setPartial(new Range(1, 1, 31, 2), [
      SparseMultilineTokens.create(5, new Uint32Array([
        0,
        5,
        10,
        1,
        5,
        5,
        10,
        2,
        10,
        5,
        10,
        3,
        15,
        5,
        10,
        4,
        20,
        5,
        10,
        5,
        25,
        5,
        10,
        6
      ]))
    ]);
    const lineTokens = store.addSparseTokens(10, new LineTokens(new Uint32Array([12, 1]), `enum Enum1 {`, codec));
    assert.strictEqual(lineTokens.getCount(), 3);
  });
  test("partial tokens 2", () => {
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.setPartial(new Range(1, 1, 31, 2), [
      SparseMultilineTokens.create(5, new Uint32Array([
        0,
        5,
        10,
        1,
        5,
        5,
        10,
        2,
        10,
        5,
        10,
        3,
        15,
        5,
        10,
        4,
        20,
        5,
        10,
        5,
        25,
        5,
        10,
        6
      ]))
    ]);
    store.setPartial(new Range(6, 1, 36, 2), [
      SparseMultilineTokens.create(10, new Uint32Array([
        0,
        5,
        10,
        2,
        5,
        5,
        10,
        3,
        10,
        5,
        10,
        4,
        15,
        5,
        10,
        5,
        20,
        5,
        10,
        6
      ]))
    ]);
    store.setPartial(new Range(17, 1, 42, 1), [
      SparseMultilineTokens.create(20, new Uint32Array([
        0,
        5,
        10,
        4,
        5,
        5,
        10,
        5,
        10,
        5,
        10,
        6,
        15,
        5,
        10,
        7,
        20,
        5,
        10,
        8
      ]))
    ]);
    const lineTokens = store.addSparseTokens(20, new LineTokens(new Uint32Array([12, 1]), `enum Enum1 {`, codec));
    assert.strictEqual(lineTokens.getCount(), 3);
  });
  test("partial tokens 3", () => {
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.setPartial(new Range(1, 1, 31, 2), [
      SparseMultilineTokens.create(5, new Uint32Array([
        0,
        5,
        10,
        1,
        5,
        5,
        10,
        2,
        10,
        5,
        10,
        3,
        15,
        5,
        10,
        4,
        20,
        5,
        10,
        5,
        25,
        5,
        10,
        6
      ]))
    ]);
    store.setPartial(new Range(11, 1, 16, 2), [
      SparseMultilineTokens.create(10, new Uint32Array([
        0,
        5,
        10,
        3,
        5,
        5,
        10,
        4
      ]))
    ]);
    const lineTokens = store.addSparseTokens(5, new LineTokens(new Uint32Array([12, 1]), `enum Enum1 {`, codec));
    assert.strictEqual(lineTokens.getCount(), 3);
  });
  test("issue #94133: Semantic colors stick around when using (only) range provider", () => {
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.setPartial(new Range(1, 1, 1, 20), [
      SparseMultilineTokens.create(1, new Uint32Array([
        0,
        9,
        11,
        1
      ]))
    ]);
    store.setPartial(new Range(1, 1, 1, 20), []);
    const lineTokens = store.addSparseTokens(1, new LineTokens(new Uint32Array([12, 1]), `enum Enum1 {`, codec));
    assert.strictEqual(lineTokens.getCount(), 1);
  });
  test("bug", () => {
    function createTokens(str) {
      str = str.replace(/^\[\(/, "");
      str = str.replace(/\)\]$/, "");
      const strTokens = str.split("),(");
      const result = [];
      let firstLineNumber = 0;
      for (const strToken of strTokens) {
        const pieces = strToken.split(",");
        const chars = pieces[1].split("-");
        const lineNumber = parseInt(pieces[0], 10);
        const startChar = parseInt(chars[0], 10);
        const endChar = parseInt(chars[1], 10);
        if (firstLineNumber === 0) {
          firstLineNumber = lineNumber;
        }
        result.push(lineNumber - firstLineNumber, startChar, endChar, (lineNumber + startChar) % 13);
      }
      return SparseMultilineTokens.create(firstLineNumber, new Uint32Array(result));
    }
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.setPartial(
      new Range(36446, 1, 36475, 115),
      [createTokens("[(36448,24-29),(36448,33-46),(36448,47-54),(36450,25-35),(36450,36-50),(36451,28-33),(36451,36-49),(36451,50-57),(36452,35-53),(36452,54-62),(36454,33-38),(36454,41-54),(36454,55-60),(36455,35-53),(36455,54-62),(36457,33-44),(36457,45-49),(36457,50-56),(36457,62-83),(36457,84-88),(36458,35-53),(36458,54-62),(36460,33-37),(36460,38-42),(36460,47-57),(36460,58-67),(36461,35-53),(36461,54-62),(36463,34-38),(36463,39-45),(36463,46-51),(36463,54-63),(36463,64-71),(36463,76-80),(36463,81-87),(36463,88-92),(36463,97-107),(36463,108-119),(36464,35-53),(36464,54-62),(36466,33-71),(36466,72-76),(36467,35-53),(36467,54-62),(36469,24-29),(36469,33-46),(36469,47-54),(36470,24-35),(36470,38-46),(36473,25-35),(36473,36-51),(36474,28-33),(36474,36-49),(36474,50-58),(36475,35-53),(36475,54-62)]")]
    );
    store.setPartial(
      new Range(36436, 1, 36464, 142),
      [createTokens("[(36437,33-37),(36437,38-42),(36437,47-57),(36437,58-67),(36438,35-53),(36438,54-62),(36440,24-29),(36440,33-46),(36440,47-53),(36442,25-35),(36442,36-50),(36443,30-39),(36443,42-46),(36443,47-53),(36443,54-58),(36443,63-73),(36443,74-84),(36443,87-91),(36443,92-98),(36443,101-105),(36443,106-112),(36443,113-119),(36444,28-37),(36444,38-42),(36444,47-57),(36444,58-75),(36444,80-95),(36444,96-105),(36445,35-53),(36445,54-62),(36448,24-29),(36448,33-46),(36448,47-54),(36450,25-35),(36450,36-50),(36451,28-33),(36451,36-49),(36451,50-57),(36452,35-53),(36452,54-62),(36454,33-38),(36454,41-54),(36454,55-60),(36455,35-53),(36455,54-62),(36457,33-44),(36457,45-49),(36457,50-56),(36457,62-83),(36457,84-88),(36458,35-53),(36458,54-62),(36460,33-37),(36460,38-42),(36460,47-57),(36460,58-67),(36461,35-53),(36461,54-62),(36463,34-38),(36463,39-45),(36463,46-51),(36463,54-63),(36463,64-71),(36463,76-80),(36463,81-87),(36463,88-92),(36463,97-107),(36463,108-119),(36464,35-53),(36464,54-62)]")]
    );
    store.setPartial(
      new Range(36457, 1, 36485, 140),
      [createTokens("[(36457,33-44),(36457,45-49),(36457,50-56),(36457,62-83),(36457,84-88),(36458,35-53),(36458,54-62),(36460,33-37),(36460,38-42),(36460,47-57),(36460,58-67),(36461,35-53),(36461,54-62),(36463,34-38),(36463,39-45),(36463,46-51),(36463,54-63),(36463,64-71),(36463,76-80),(36463,81-87),(36463,88-92),(36463,97-107),(36463,108-119),(36464,35-53),(36464,54-62),(36466,33-71),(36466,72-76),(36467,35-53),(36467,54-62),(36469,24-29),(36469,33-46),(36469,47-54),(36470,24-35),(36470,38-46),(36473,25-35),(36473,36-51),(36474,28-33),(36474,36-49),(36474,50-58),(36475,35-53),(36475,54-62),(36477,28-32),(36477,33-37),(36477,42-52),(36477,53-69),(36478,32-36),(36478,37-41),(36478,46-56),(36478,57-74),(36479,32-36),(36479,37-41),(36479,46-56),(36479,57-76),(36480,32-36),(36480,37-41),(36480,46-56),(36480,57-68),(36481,32-36),(36481,37-41),(36481,46-56),(36481,57-68),(36482,39-57),(36482,58-66),(36484,34-38),(36484,39-45),(36484,46-50),(36484,55-65),(36484,66-82),(36484,86-97),(36484,98-102),(36484,103-109),(36484,111-124),(36484,125-133),(36485,39-57),(36485,58-66)]")]
    );
    store.setPartial(
      new Range(36441, 1, 36469, 56),
      [createTokens("[(36442,25-35),(36442,36-50),(36443,30-39),(36443,42-46),(36443,47-53),(36443,54-58),(36443,63-73),(36443,74-84),(36443,87-91),(36443,92-98),(36443,101-105),(36443,106-112),(36443,113-119),(36444,28-37),(36444,38-42),(36444,47-57),(36444,58-75),(36444,80-95),(36444,96-105),(36445,35-53),(36445,54-62),(36448,24-29),(36448,33-46),(36448,47-54),(36450,25-35),(36450,36-50),(36451,28-33),(36451,36-49),(36451,50-57),(36452,35-53),(36452,54-62),(36454,33-38),(36454,41-54),(36454,55-60),(36455,35-53),(36455,54-62),(36457,33-44),(36457,45-49),(36457,50-56),(36457,62-83),(36457,84-88),(36458,35-53),(36458,54-62),(36460,33-37),(36460,38-42),(36460,47-57),(36460,58-67),(36461,35-53),(36461,54-62),(36463,34-38),(36463,39-45),(36463,46-51),(36463,54-63),(36463,64-71),(36463,76-80),(36463,81-87),(36463,88-92),(36463,97-107),(36463,108-119),(36464,35-53),(36464,54-62),(36466,33-71),(36466,72-76),(36467,35-53),(36467,54-62),(36469,24-29),(36469,33-46),(36469,47-54),(36470,24-35)]")]
    );
    const lineTokens = store.addSparseTokens(36451, new LineTokens(new Uint32Array([60, 1]), `                        if (flags & ModifierFlags.Ambient) {`, codec));
    assert.strictEqual(lineTokens.getCount(), 7);
  });
  test("issue #95949: Identifiers are colored in bold when targetting keywords", () => {
    function createTMMetadata(foreground, fontStyle, languageId) {
      return (languageId << MetadataConsts.LANGUAGEID_OFFSET | fontStyle << MetadataConsts.FONT_STYLE_OFFSET | foreground << MetadataConsts.FOREGROUND_OFFSET) >>> 0;
    }
    function toArr(lineTokens2) {
      const r = [];
      for (let i = 0; i < lineTokens2.getCount(); i++) {
        r.push(lineTokens2.getEndOffset(i));
        r.push(lineTokens2.getMetadata(i));
      }
      return r;
    }
    const codec = new LanguageIdCodec();
    const store = new SparseTokensStore(codec);
    store.set([
      SparseMultilineTokens.create(1, new Uint32Array([
        0,
        6,
        11,
        1 << MetadataConsts.FOREGROUND_OFFSET | MetadataConsts.SEMANTIC_USE_FOREGROUND
      ]))
    ], true);
    const lineTokens = store.addSparseTokens(1, new LineTokens(new Uint32Array([
      5,
      createTMMetadata(5, FontStyle.Bold, 53),
      14,
      createTMMetadata(1, FontStyle.None, 53),
      17,
      createTMMetadata(6, FontStyle.None, 53),
      18,
      createTMMetadata(1, FontStyle.None, 53)
    ]), `const hello = 123;`, codec));
    const actual = toArr(lineTokens);
    assert.deepStrictEqual(actual, [
      5,
      createTMMetadata(5, FontStyle.Bold, 53),
      6,
      createTMMetadata(1, FontStyle.None, 53),
      11,
      createTMMetadata(1, FontStyle.None, 53),
      14,
      createTMMetadata(1, FontStyle.None, 53),
      17,
      createTMMetadata(6, FontStyle.None, 53),
      18,
      createTMMetadata(1, FontStyle.None, 53)
    ]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvdG9rZW5zU3RvcmUudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvZWRpdE9wZXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgQ29sb3JJZCwgRm9udFN0eWxlLCBNZXRhZGF0YUNvbnN0cywgVG9rZW5NZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZUNvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IExhbmd1YWdlSWRDb2RlYyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMaW5lVG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9saW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IFNwYXJzZU11bHRpbGluZVRva2VucyB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi90b2tlbnMvc3BhcnNlTXVsdGlsaW5lVG9rZW5zLmpzJztcbmltcG9ydCB7IFNwYXJzZVRva2Vuc1N0b3JlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL3Rva2Vucy9zcGFyc2VUb2tlbnNTdG9yZS5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbFNlcnZpY2VzLCBjcmVhdGVUZXh0TW9kZWwsIGluc3RhbnRpYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vdGVzdFRleHRNb2RlbC5qcyc7XG5cbnN1aXRlKCdUb2tlbnNTdG9yZScsICgpID0+IHtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRjb25zdCBTRU1BTlRJQ19DT0xPUiA9IDUgYXMgQ29sb3JJZDtcblxuXHRmdW5jdGlvbiBwYXJzZVRva2Vuc1N0YXRlKHN0YXRlOiBzdHJpbmdbXSk6IHsgdGV4dDogc3RyaW5nOyB0b2tlbnM6IFNwYXJzZU11bHRpbGluZVRva2VucyB9IHtcblx0XHRjb25zdCB0ZXh0OiBzdHJpbmdbXSA9IFtdO1xuXHRcdGNvbnN0IHRva2VuczogbnVtYmVyW10gPSBbXTtcblx0XHRsZXQgYmFzZUxpbmUgPSAxO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3RhdGUubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGxpbmUgPSBzdGF0ZVtpXTtcblxuXHRcdFx0bGV0IHN0YXJ0T2Zmc2V0ID0gMDtcblx0XHRcdGxldCBsaW5lVGV4dCA9ICcnO1xuXHRcdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdFx0Y29uc3QgZmlyc3RQaXBlT2Zmc2V0ID0gbGluZS5pbmRleE9mKCd8Jywgc3RhcnRPZmZzZXQpO1xuXHRcdFx0XHRpZiAoZmlyc3RQaXBlT2Zmc2V0ID09PSAtMSkge1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHNlY29uZFBpcGVPZmZzZXQgPSBsaW5lLmluZGV4T2YoJ3wnLCBmaXJzdFBpcGVPZmZzZXQgKyAxKTtcblx0XHRcdFx0aWYgKHNlY29uZFBpcGVPZmZzZXQgPT09IC0xKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGZpcnN0UGlwZU9mZnNldCArIDEgPT09IHNlY29uZFBpcGVPZmZzZXQpIHtcblx0XHRcdFx0XHQvLyBza2lwIHx8XG5cdFx0XHRcdFx0bGluZVRleHQgKz0gbGluZS5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIHNlY29uZFBpcGVPZmZzZXQgKyAxKTtcblx0XHRcdFx0XHRzdGFydE9mZnNldCA9IHNlY29uZFBpcGVPZmZzZXQgKyAxO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bGluZVRleHQgKz0gbGluZS5zdWJzdHJpbmcoc3RhcnRPZmZzZXQsIGZpcnN0UGlwZU9mZnNldCk7XG5cdFx0XHRcdGNvbnN0IHRva2VuU3RhcnRDaGFyYWN0ZXIgPSBsaW5lVGV4dC5sZW5ndGg7XG5cdFx0XHRcdGNvbnN0IHRva2VuTGVuZ3RoID0gc2Vjb25kUGlwZU9mZnNldCAtIGZpcnN0UGlwZU9mZnNldCAtIDE7XG5cdFx0XHRcdGNvbnN0IG1ldGFkYXRhID0gKFxuXHRcdFx0XHRcdFNFTUFOVElDX0NPTE9SIDw8IE1ldGFkYXRhQ29uc3RzLkZPUkVHUk9VTkRfT0ZGU0VUXG5cdFx0XHRcdFx0fCBNZXRhZGF0YUNvbnN0cy5TRU1BTlRJQ19VU0VfRk9SRUdST1VORFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGlmICh0b2tlbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0YmFzZUxpbmUgPSBpICsgMTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0b2tlbnMucHVzaChpICsgMSAtIGJhc2VMaW5lLCB0b2tlblN0YXJ0Q2hhcmFjdGVyLCB0b2tlblN0YXJ0Q2hhcmFjdGVyICsgdG9rZW5MZW5ndGgsIG1ldGFkYXRhKTtcblxuXHRcdFx0XHRsaW5lVGV4dCArPSBsaW5lLnN1YnN0cihmaXJzdFBpcGVPZmZzZXQgKyAxLCB0b2tlbkxlbmd0aCk7XG5cdFx0XHRcdHN0YXJ0T2Zmc2V0ID0gc2Vjb25kUGlwZU9mZnNldCArIDE7XG5cdFx0XHR9XG5cblx0XHRcdGxpbmVUZXh0ICs9IGxpbmUuc3Vic3RyaW5nKHN0YXJ0T2Zmc2V0KTtcblxuXHRcdFx0dGV4dC5wdXNoKGxpbmVUZXh0KTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dGV4dDogdGV4dC5qb2luKCdcXG4nKSxcblx0XHRcdHRva2VuczogU3BhcnNlTXVsdGlsaW5lVG9rZW5zLmNyZWF0ZShiYXNlTGluZSwgbmV3IFVpbnQzMkFycmF5KHRva2VucykpXG5cdFx0fTtcblx0fVxuXG5cdGZ1bmN0aW9uIGV4dHJhY3RTdGF0ZShtb2RlbDogVGV4dE1vZGVsKTogc3RyaW5nW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogc3RyaW5nW10gPSBbXTtcblx0XHRmb3IgKGxldCBsaW5lTnVtYmVyID0gMTsgbGluZU51bWJlciA8PSBtb2RlbC5nZXRMaW5lQ291bnQoKTsgbGluZU51bWJlcisrKSB7XG5cdFx0XHRjb25zdCBsaW5lVG9rZW5zID0gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMobGluZU51bWJlcik7XG5cdFx0XHRjb25zdCBsaW5lQ29udGVudCA9IG1vZGVsLmdldExpbmVDb250ZW50KGxpbmVOdW1iZXIpO1xuXG5cdFx0XHRsZXQgbGluZVRleHQgPSAnJztcblx0XHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGluZVRva2Vucy5nZXRDb3VudCgpOyBpKyspIHtcblx0XHRcdFx0Y29uc3QgdG9rZW5TdGFydENoYXJhY3RlciA9IGxpbmVUb2tlbnMuZ2V0U3RhcnRPZmZzZXQoaSk7XG5cdFx0XHRcdGNvbnN0IHRva2VuRW5kQ2hhcmFjdGVyID0gbGluZVRva2Vucy5nZXRFbmRPZmZzZXQoaSk7XG5cdFx0XHRcdGNvbnN0IG1ldGFkYXRhID0gbGluZVRva2Vucy5nZXRNZXRhZGF0YShpKTtcblx0XHRcdFx0Y29uc3QgY29sb3IgPSBUb2tlbk1ldGFkYXRhLmdldEZvcmVncm91bmQobWV0YWRhdGEpO1xuXHRcdFx0XHRjb25zdCB0b2tlblRleHQgPSBsaW5lQ29udGVudC5zdWJzdHJpbmcodG9rZW5TdGFydENoYXJhY3RlciwgdG9rZW5FbmRDaGFyYWN0ZXIpO1xuXHRcdFx0XHRpZiAoY29sb3IgPT09IFNFTUFOVElDX0NPTE9SKSB7XG5cdFx0XHRcdFx0bGluZVRleHQgKz0gYHwke3Rva2VuVGV4dH18YDtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRsaW5lVGV4dCArPSB0b2tlblRleHQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0LnB1c2gobGluZVRleHQpO1xuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZnVuY3Rpb24gdGVzdFRva2Vuc0FkanVzdG1lbnQocmF3SW5pdGlhbFN0YXRlOiBzdHJpbmdbXSwgZWRpdHM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10sIHJhd0ZpbmFsU3RhdGU6IHN0cmluZ1tdKSB7XG5cdFx0Y29uc3QgaW5pdGlhbFN0YXRlID0gcGFyc2VUb2tlbnNTdGF0ZShyYXdJbml0aWFsU3RhdGUpO1xuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKGluaXRpYWxTdGF0ZS50ZXh0KTtcblx0XHRtb2RlbC50b2tlbml6YXRpb24uc2V0U2VtYW50aWNUb2tlbnMoW2luaXRpYWxTdGF0ZS50b2tlbnNdLCB0cnVlKTtcblxuXHRcdG1vZGVsLmFwcGx5RWRpdHMoZWRpdHMpO1xuXG5cdFx0Y29uc3QgYWN0dWFsU3RhdGUgPSBleHRyYWN0U3RhdGUobW9kZWwpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsU3RhdGUsIHJhd0ZpbmFsU3RhdGUpO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9XG5cblx0dGVzdCgnaXNzdWUgIzg2MzAzIC0gY29sb3Igc2hpZnRpbmcgYmV0d2VlbiBkaWZmZXJlbnQgdG9rZW5zJywgKCkgPT4ge1xuXHRcdHRlc3RUb2tlbnNBZGp1c3RtZW50KFxuXHRcdFx0W1xuXHRcdFx0XHRgaW1wb3J0IHsgfFVSSXwgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi91cmknO2AsXG5cdFx0XHRcdGBjb25zdCBmb28gPSB8VVJJfC5wYXJzZSgnaGV5Jyk7YFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDIsIDksIDIsIDEwKSwgdGV4dDogJycgfVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0YGltcG9ydCB7IHxVUkl8IH0gZnJvbSAndnMvYmFzZS9jb21tb24vdXJpJztgLFxuXHRcdFx0XHRgY29uc3QgZm8gPSB8VVJJfC5wYXJzZSgnaGV5Jyk7YFxuXHRcdFx0XVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RlbGV0aW5nIGEgbmV3bGluZScsICgpID0+IHtcblx0XHR0ZXN0VG9rZW5zQWRqdXN0bWVudChcblx0XHRcdFtcblx0XHRcdFx0YGltcG9ydCB7IHxVUkl8IH0gZnJvbSAndnMvYmFzZS9jb21tb24vdXJpJztgLFxuXHRcdFx0XHRgY29uc3QgZm9vID0gfFVSSXwucGFyc2UoJ2hleScpO2Bcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCA0MiwgMiwgMSksIHRleHQ6ICcnIH1cblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdGBpbXBvcnQgeyB8VVJJfCB9IGZyb20gJ3ZzL2Jhc2UvY29tbW9uL3VyaSc7Y29uc3QgZm9vID0gfFVSSXwucGFyc2UoJ2hleScpO2Bcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbnNlcnRpbmcgYSBuZXdsaW5lJywgKCkgPT4ge1xuXHRcdHRlc3RUb2tlbnNBZGp1c3RtZW50KFxuXHRcdFx0W1xuXHRcdFx0XHRgaW1wb3J0IHsgfFVSSXwgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi91cmknO2NvbnN0IGZvbyA9IHxVUkl8LnBhcnNlKCdoZXknKTtgXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgNDIsIDEsIDQyKSwgdGV4dDogJ1xcbicgfVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0YGltcG9ydCB7IHxVUkl8IH0gZnJvbSAndnMvYmFzZS9jb21tb24vdXJpJztgLFxuXHRcdFx0XHRgY29uc3QgZm9vID0gfFVSSXwucGFyc2UoJ2hleScpO2Bcblx0XHRcdF1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdkZWxldGluZyBhIG5ld2xpbmUgMicsICgpID0+IHtcblx0XHR0ZXN0VG9rZW5zQWRqdXN0bWVudChcblx0XHRcdFtcblx0XHRcdFx0YGltcG9ydCB7IGAsXG5cdFx0XHRcdGAgICAgfFVSSXwgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi91cmknO2NvbnN0IGZvbyA9IHxVUkl8LnBhcnNlKCdoZXknKTtgXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoMSwgMTAsIDIsIDUpLCB0ZXh0OiAnJyB9XG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHRgaW1wb3J0IHsgfFVSSXwgfSBmcm9tICd2cy9iYXNlL2NvbW1vbi91cmknO2NvbnN0IGZvbyA9IHxVUkl8LnBhcnNlKCdoZXknKTtgXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE3OTI2ODogYSBjb21wbGV4IGVkaXQnLCAoKSA9PiB7XG5cdFx0dGVzdFRva2Vuc0FkanVzdG1lbnQoXG5cdFx0XHRbXG5cdFx0XHRcdGB8ZXhwb3J0fCB8J2ludGVyaW9yX21hdGVyaWFsX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdtaWxlYWdlX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdvd25lcnNfc2VsZWN0b3IuZGFydCd8O2AsXG5cdFx0XHRcdGB8ZXhwb3J0fCB8J3ByaWNlX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdzZWF0X2NvdW50X3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCd5ZWFyX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCd3aW50ZXJfb3B0aW9uc19zZWxlY3Rvci5kYXJ0J3w7fGV4cG9ydHwgfCdjYW1lcmFfc2VsZWN0b3IuZGFydCd8O2Bcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSgxLCA5LCAxLCA5KSwgdGV4dDogYGNhbWVyYV9zZWxlY3Rvci5kYXJ0JztcXG5leHBvcnQgJ2AgfSxcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDYsIDksIDcsIDkpLCB0ZXh0OiBgYCB9LFxuXHRcdFx0XHR7IHJhbmdlOiBuZXcgUmFuZ2UoNywgMzksIDcsIDM5KSwgdGV4dDogYFxcbmAgfSxcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDcsIDQ3LCA3LCA0OCksIHRleHQ6IGB5ZWAgfSxcblx0XHRcdFx0eyByYW5nZTogbmV3IFJhbmdlKDcsIDQ5LCA3LCA1MSksIHRleHQ6IGBgIH0sXG5cdFx0XHRcdHsgcmFuZ2U6IG5ldyBSYW5nZSg3LCA1MiwgNywgNTMpLCB0ZXh0OiBgYCB9LFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0YHxleHBvcnR8IHwnfGNhbWVyYV9zZWxlY3Rvci5kYXJ0JztgLFxuXHRcdFx0XHRgZXhwb3J0ICdpbnRlcmlvcl9tYXRlcmlhbF9zZWxlY3Rvci5kYXJ0JztgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdtaWxlYWdlX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdvd25lcnNfc2VsZWN0b3IuZGFydCd8O2AsXG5cdFx0XHRcdGB8ZXhwb3J0fCB8J3ByaWNlX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCdzZWF0X2NvdW50X3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCd8fHdpbnRlcl9vcHRpb25zX3NlbGVjdG9yLmRhcnQnfDtgLFxuXHRcdFx0XHRgfGV4cG9ydHwgfCd5ZWFyX3NlbGVjdG9yLmRhcnQnfDtgXG5cdFx0XHRdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzkxOTM2OiBTZW1hbnRpYyB0b2tlbiBjb2xvciBoaWdobGlnaHRpbmcgZmFpbHMgb24gbGluZSB3aXRoIHNlbGVjdGVkIHRleHQnLCAoKSA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJyAgICAgICAgICAgICAgICAgICAgZWxzZSBpZiAoJHMgPSAwOCkgdGhlbiBcXCdcXFxcYlxcJycpO1xuXHRcdG1vZGVsLnRva2VuaXphdGlvbi5zZXRTZW1hbnRpY1Rva2VucyhbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDEsIG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdDAsIDIwLCAyNCwgMGIwMTExMTAwMDAwMDAwMDAxMDAwMCxcblx0XHRcdFx0MCwgMjUsIDI3LCAwYjAxMTExMDAwMDAwMDAwMDEwMDAwLFxuXHRcdFx0XHQwLCAyOCwgMjksIDBiMDAwMDEwMDAwMDAwMDAwMTAwMDAsXG5cdFx0XHRcdDAsIDI5LCAzMSwgMGIxMDAwMDAwMDAwMDAwMDAxMDAwMCxcblx0XHRcdFx0MCwgMzIsIDMzLCAwYjAwMDAxMDAwMDAwMDAwMDEwMDAwLFxuXHRcdFx0XHQwLCAzNCwgMzYsIDBiMDAxMTAwMDAwMDAwMDAwMTAwMDAsXG5cdFx0XHRcdDAsIDM2LCAzNywgMGIwMDAwMTAwMDAwMDAwMDAxMDAwMCxcblx0XHRcdFx0MCwgMzgsIDQyLCAwYjAxMTExMDAwMDAwMDAwMDEwMDAwLFxuXHRcdFx0XHQwLCA0MywgNDcsIDBiMDEwMTEwMDAwMDAwMDAwMTAwMDAsXG5cdFx0XHRdKSlcblx0XHRdLCB0cnVlKTtcblx0XHRjb25zdCBsaW5lVG9rZW5zID0gbW9kZWwudG9rZW5pemF0aW9uLmdldExpbmVUb2tlbnMoMSk7XG5cdFx0Y29uc3QgZGVjb2RlZFRva2VuczogbnVtYmVyW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gbGluZVRva2Vucy5nZXRDb3VudCgpOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGRlY29kZWRUb2tlbnMucHVzaChsaW5lVG9rZW5zLmdldEVuZE9mZnNldChpKSwgbGluZVRva2Vucy5nZXRNZXRhZGF0YShpKSk7XG5cdFx0fVxuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChkZWNvZGVkVG9rZW5zLCBbXG5cdFx0XHQyMCwgMGIxMDAwMDAwMDAwMTAwMDAxMDAwMDAwMDAwMSxcblx0XHRcdDI0LCAwYjEwMDAwMDAxMTExMDAwMDEwMDAwMDAwMDAxLFxuXHRcdFx0MjUsIDBiMTAwMDAwMDAwMDEwMDAwMTAwMDAwMDAwMDEsXG5cdFx0XHQyNywgMGIxMDAwMDAwMTExMTAwMDAxMDAwMDAwMDAwMSxcblx0XHRcdDI4LCAwYjEwMDAwMDAwMDAxMDAwMDEwMDAwMDAwMDAxLFxuXHRcdFx0MjksIDBiMTAwMDAwMDAwMDEwMDAwMTAwMDAwMDAwMDEsXG5cdFx0XHQzMSwgMGIxMDAwMDAxMDAwMDAwMDAxMDAwMDAwMDAwMSxcblx0XHRcdDMyLCAwYjEwMDAwMDAwMDAxMDAwMDEwMDAwMDAwMDAxLFxuXHRcdFx0MzMsIDBiMTAwMDAwMDAwMDEwMDAwMTAwMDAwMDAwMDEsXG5cdFx0XHQzNCwgMGIxMDAwMDAwMDAwMTAwMDAxMDAwMDAwMDAwMSxcblx0XHRcdDM2LCAwYjEwMDAwMDAwMTEwMDAwMDEwMDAwMDAwMDAxLFxuXHRcdFx0MzcsIDBiMTAwMDAwMDAwMDEwMDAwMTAwMDAwMDAwMDEsXG5cdFx0XHQzOCwgMGIxMDAwMDAwMDAwMTAwMDAxMDAwMDAwMDAwMSxcblx0XHRcdDQyLCAwYjEwMDAwMDAxMTExMDAwMDEwMDAwMDAwMDAxLFxuXHRcdFx0NDMsIDBiMTAwMDAwMDAwMDEwMDAwMTAwMDAwMDAwMDEsXG5cdFx0XHQ0NywgMGIxMDAwMDAwMTAxMTAwMDAxMDAwMDAwMDAwMVxuXHRcdF0pO1xuXG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdpc3N1ZSAjMTQ3OTQ0OiBMYW5ndWFnZSBpZCBcInZzLmVkaXRvci5udWxsTGFuZ3VhZ2VcIiBpcyBub3QgY29uZmlndXJlZCBub3Iga25vd24nLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzLCBbXG5cdFx0XHRbSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VdXG5cdFx0XSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsICctLVtbXFxuXFxuXV0nKSk7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLnNldFNlbWFudGljVG9rZW5zKFtcblx0XHRcdFNwYXJzZU11bHRpbGluZVRva2Vucy5jcmVhdGUoMSwgbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0MCwgMiwgNCwgMGIxMDAwMDAwMDAwMDAwMTAwMDAsXG5cdFx0XHRcdDEsIDAsIDAsIDBiMTAwMDAwMDAwMDAwMDEwMDAwLFxuXHRcdFx0XHQyLCAwLCAyLCAwYjEwMDAwMDAwMDAwMDAxMDAwMCxcblx0XHRcdF0pKVxuXHRcdF0sIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihuZXcgUG9zaXRpb24oMiwgMSkpLCBudWxsKTtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnRpYWwgdG9rZW5zIDEnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29kZWMgPSBuZXcgTGFuZ3VhZ2VJZENvZGVjKCk7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgU3BhcnNlVG9rZW5zU3RvcmUoY29kZWMpO1xuXG5cdFx0Ly8gc2V0UGFydGlhbDogWzEsMSAtPiAzMSwyXSwgWyg1LDUtMTApLCgxMCw1LTEwKSwoMTUsNS0xMCksKDIwLDUtMTApLCgyNSw1LTEwKSwoMzAsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMSwgMSwgMzEsIDIpLCBbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDUsIG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdDAsIDUsIDEwLCAxLFxuXHRcdFx0XHQ1LCA1LCAxMCwgMixcblx0XHRcdFx0MTAsIDUsIDEwLCAzLFxuXHRcdFx0XHQxNSwgNSwgMTAsIDQsXG5cdFx0XHRcdDIwLCA1LCAxMCwgNSxcblx0XHRcdFx0MjUsIDUsIDEwLCA2LFxuXHRcdFx0XSkpXG5cdFx0XSk7XG5cblx0XHQvLyBzZXRQYXJ0aWFsOiBbMTgsMSAtPiA0MiwxXSwgWygyMCw1LTEwKSwoMjUsNS0xMCksKDMwLDUtMTApLCgzNSw1LTEwKSwoNDAsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMTgsIDEsIDQyLCAxKSwgW1xuXHRcdFx0U3BhcnNlTXVsdGlsaW5lVG9rZW5zLmNyZWF0ZSgyMCwgbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0MCwgNSwgMTAsIDQsXG5cdFx0XHRcdDUsIDUsIDEwLCA1LFxuXHRcdFx0XHQxMCwgNSwgMTAsIDYsXG5cdFx0XHRcdDE1LCA1LCAxMCwgNyxcblx0XHRcdFx0MjAsIDUsIDEwLCA4LFxuXHRcdFx0XSkpXG5cdFx0XSk7XG5cblx0XHQvLyBzZXRQYXJ0aWFsOiBbMSwxIC0+IDMxLDJdLCBbKDUsNS0xMCksKDEwLDUtMTApLCgxNSw1LTEwKSwoMjAsNS0xMCksKDI1LDUtMTApLCgzMCw1LTEwKV1cblx0XHRzdG9yZS5zZXRQYXJ0aWFsKG5ldyBSYW5nZSgxLCAxLCAzMSwgMiksIFtcblx0XHRcdFNwYXJzZU11bHRpbGluZVRva2Vucy5jcmVhdGUoNSwgbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0MCwgNSwgMTAsIDEsXG5cdFx0XHRcdDUsIDUsIDEwLCAyLFxuXHRcdFx0XHQxMCwgNSwgMTAsIDMsXG5cdFx0XHRcdDE1LCA1LCAxMCwgNCxcblx0XHRcdFx0MjAsIDUsIDEwLCA1LFxuXHRcdFx0XHQyNSwgNSwgMTAsIDYsXG5cdFx0XHRdKSlcblx0XHRdKTtcblxuXHRcdGNvbnN0IGxpbmVUb2tlbnMgPSBzdG9yZS5hZGRTcGFyc2VUb2tlbnMoMTAsIG5ldyBMaW5lVG9rZW5zKG5ldyBVaW50MzJBcnJheShbMTIsIDFdKSwgYGVudW0gRW51bTEge2AsIGNvZGVjKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVUb2tlbnMuZ2V0Q291bnQoKSwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnRpYWwgdG9rZW5zIDInLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29kZWMgPSBuZXcgTGFuZ3VhZ2VJZENvZGVjKCk7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgU3BhcnNlVG9rZW5zU3RvcmUoY29kZWMpO1xuXG5cdFx0Ly8gc2V0UGFydGlhbDogWzEsMSAtPiAzMSwyXSwgWyg1LDUtMTApLCgxMCw1LTEwKSwoMTUsNS0xMCksKDIwLDUtMTApLCgyNSw1LTEwKSwoMzAsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMSwgMSwgMzEsIDIpLCBbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDUsIG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdDAsIDUsIDEwLCAxLFxuXHRcdFx0XHQ1LCA1LCAxMCwgMixcblx0XHRcdFx0MTAsIDUsIDEwLCAzLFxuXHRcdFx0XHQxNSwgNSwgMTAsIDQsXG5cdFx0XHRcdDIwLCA1LCAxMCwgNSxcblx0XHRcdFx0MjUsIDUsIDEwLCA2LFxuXHRcdFx0XSkpXG5cdFx0XSk7XG5cblx0XHQvLyBzZXRQYXJ0aWFsOiBbNiwxIC0+IDM2LDJdLCBbKDEwLDUtMTApLCgxNSw1LTEwKSwoMjAsNS0xMCksKDI1LDUtMTApLCgzMCw1LTEwKSwoMzUsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoNiwgMSwgMzYsIDIpLCBbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDEwLCBuZXcgVWludDMyQXJyYXkoW1xuXHRcdFx0XHQwLCA1LCAxMCwgMixcblx0XHRcdFx0NSwgNSwgMTAsIDMsXG5cdFx0XHRcdDEwLCA1LCAxMCwgNCxcblx0XHRcdFx0MTUsIDUsIDEwLCA1LFxuXHRcdFx0XHQyMCwgNSwgMTAsIDYsXG5cdFx0XHRdKSlcblx0XHRdKTtcblxuXHRcdC8vIHNldFBhcnRpYWw6IFsxNywxIC0+IDQyLDFdLCBbKDIwLDUtMTApLCgyNSw1LTEwKSwoMzAsNS0xMCksKDM1LDUtMTApLCg0MCw1LTEwKV1cblx0XHRzdG9yZS5zZXRQYXJ0aWFsKG5ldyBSYW5nZSgxNywgMSwgNDIsIDEpLCBbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDIwLCBuZXcgVWludDMyQXJyYXkoW1xuXHRcdFx0XHQwLCA1LCAxMCwgNCxcblx0XHRcdFx0NSwgNSwgMTAsIDUsXG5cdFx0XHRcdDEwLCA1LCAxMCwgNixcblx0XHRcdFx0MTUsIDUsIDEwLCA3LFxuXHRcdFx0XHQyMCwgNSwgMTAsIDgsXG5cdFx0XHRdKSlcblx0XHRdKTtcblxuXHRcdGNvbnN0IGxpbmVUb2tlbnMgPSBzdG9yZS5hZGRTcGFyc2VUb2tlbnMoMjAsIG5ldyBMaW5lVG9rZW5zKG5ldyBVaW50MzJBcnJheShbMTIsIDFdKSwgYGVudW0gRW51bTEge2AsIGNvZGVjKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVUb2tlbnMuZ2V0Q291bnQoKSwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ3BhcnRpYWwgdG9rZW5zIDMnLCAoKSA9PiB7XG5cdFx0Y29uc3QgY29kZWMgPSBuZXcgTGFuZ3VhZ2VJZENvZGVjKCk7XG5cdFx0Y29uc3Qgc3RvcmUgPSBuZXcgU3BhcnNlVG9rZW5zU3RvcmUoY29kZWMpO1xuXG5cdFx0Ly8gc2V0UGFydGlhbDogWzEsMSAtPiAzMSwyXSwgWyg1LDUtMTApLCgxMCw1LTEwKSwoMTUsNS0xMCksKDIwLDUtMTApLCgyNSw1LTEwKSwoMzAsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMSwgMSwgMzEsIDIpLCBbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDUsIG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdDAsIDUsIDEwLCAxLFxuXHRcdFx0XHQ1LCA1LCAxMCwgMixcblx0XHRcdFx0MTAsIDUsIDEwLCAzLFxuXHRcdFx0XHQxNSwgNSwgMTAsIDQsXG5cdFx0XHRcdDIwLCA1LCAxMCwgNSxcblx0XHRcdFx0MjUsIDUsIDEwLCA2LFxuXHRcdFx0XSkpXG5cdFx0XSk7XG5cblx0XHQvLyBzZXRQYXJ0aWFsOiBbMTEsMSAtPiAxNiwyXSwgWygxNSw1LTEwKSwoMjAsNS0xMCldXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMTEsIDEsIDE2LCAyKSwgW1xuXHRcdFx0U3BhcnNlTXVsdGlsaW5lVG9rZW5zLmNyZWF0ZSgxMCwgbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0MCwgNSwgMTAsIDMsXG5cdFx0XHRcdDUsIDUsIDEwLCA0LFxuXHRcdFx0XSkpXG5cdFx0XSk7XG5cblx0XHRjb25zdCBsaW5lVG9rZW5zID0gc3RvcmUuYWRkU3BhcnNlVG9rZW5zKDUsIG5ldyBMaW5lVG9rZW5zKG5ldyBVaW50MzJBcnJheShbMTIsIDFdKSwgYGVudW0gRW51bTEge2AsIGNvZGVjKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVUb2tlbnMuZ2V0Q291bnQoKSwgMyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICM5NDEzMzogU2VtYW50aWMgY29sb3JzIHN0aWNrIGFyb3VuZCB3aGVuIHVzaW5nIChvbmx5KSByYW5nZSBwcm92aWRlcicsICgpID0+IHtcblx0XHRjb25zdCBjb2RlYyA9IG5ldyBMYW5ndWFnZUlkQ29kZWMoKTtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBTcGFyc2VUb2tlbnNTdG9yZShjb2RlYyk7XG5cblx0XHQvLyBzZXRQYXJ0aWFsOiBbMSwxIC0+IDEsMjBdIFsoMSw5LTExKV1cblx0XHRzdG9yZS5zZXRQYXJ0aWFsKG5ldyBSYW5nZSgxLCAxLCAxLCAyMCksIFtcblx0XHRcdFNwYXJzZU11bHRpbGluZVRva2Vucy5jcmVhdGUoMSwgbmV3IFVpbnQzMkFycmF5KFtcblx0XHRcdFx0MCwgOSwgMTEsIDEsXG5cdFx0XHRdKSlcblx0XHRdKTtcblxuXHRcdC8vIHNldFBhcnRpYWw6IFsxLDEgLT4gMSwyMF0sIFtdXG5cdFx0c3RvcmUuc2V0UGFydGlhbChuZXcgUmFuZ2UoMSwgMSwgMSwgMjApLCBbXSk7XG5cblx0XHRjb25zdCBsaW5lVG9rZW5zID0gc3RvcmUuYWRkU3BhcnNlVG9rZW5zKDEsIG5ldyBMaW5lVG9rZW5zKG5ldyBVaW50MzJBcnJheShbMTIsIDFdKSwgYGVudW0gRW51bTEge2AsIGNvZGVjKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmVUb2tlbnMuZ2V0Q291bnQoKSwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2J1ZycsICgpID0+IHtcblx0XHRmdW5jdGlvbiBjcmVhdGVUb2tlbnMoc3RyOiBzdHJpbmcpOiBTcGFyc2VNdWx0aWxpbmVUb2tlbnMge1xuXHRcdFx0c3RyID0gc3RyLnJlcGxhY2UoL15cXFtcXCgvLCAnJyk7XG5cdFx0XHRzdHIgPSBzdHIucmVwbGFjZSgvXFwpXFxdJC8sICcnKTtcblx0XHRcdGNvbnN0IHN0clRva2VucyA9IHN0ci5zcGxpdCgnKSwoJyk7XG5cdFx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0XHRsZXQgZmlyc3RMaW5lTnVtYmVyID0gMDtcblx0XHRcdGZvciAoY29uc3Qgc3RyVG9rZW4gb2Ygc3RyVG9rZW5zKSB7XG5cdFx0XHRcdGNvbnN0IHBpZWNlcyA9IHN0clRva2VuLnNwbGl0KCcsJyk7XG5cdFx0XHRcdGNvbnN0IGNoYXJzID0gcGllY2VzWzFdLnNwbGl0KCctJyk7XG5cdFx0XHRcdGNvbnN0IGxpbmVOdW1iZXIgPSBwYXJzZUludChwaWVjZXNbMF0sIDEwKTtcblx0XHRcdFx0Y29uc3Qgc3RhcnRDaGFyID0gcGFyc2VJbnQoY2hhcnNbMF0sIDEwKTtcblx0XHRcdFx0Y29uc3QgZW5kQ2hhciA9IHBhcnNlSW50KGNoYXJzWzFdLCAxMCk7XG5cdFx0XHRcdGlmIChmaXJzdExpbmVOdW1iZXIgPT09IDApIHtcblx0XHRcdFx0XHQvLyB0aGlzIGlzIHRoZSBmaXJzdCBsaW5lXG5cdFx0XHRcdFx0Zmlyc3RMaW5lTnVtYmVyID0gbGluZU51bWJlcjtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXN1bHQucHVzaChsaW5lTnVtYmVyIC0gZmlyc3RMaW5lTnVtYmVyLCBzdGFydENoYXIsIGVuZENoYXIsIChsaW5lTnVtYmVyICsgc3RhcnRDaGFyKSAlIDEzKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKGZpcnN0TGluZU51bWJlciwgbmV3IFVpbnQzMkFycmF5KHJlc3VsdCkpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvZGVjID0gbmV3IExhbmd1YWdlSWRDb2RlYygpO1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IFNwYXJzZVRva2Vuc1N0b3JlKGNvZGVjKTtcblx0XHQvLyBzZXRQYXJ0aWFsIFszNjQ0NiwxIC0+IDM2NDc1LDExNV0gWygzNjQ0OCwyNC0yOSksKDM2NDQ4LDMzLTQ2KSwoMzY0NDgsNDctNTQpLCgzNjQ1MCwyNS0zNSksKDM2NDUwLDM2LTUwKSwoMzY0NTEsMjgtMzMpLCgzNjQ1MSwzNi00OSksKDM2NDUxLDUwLTU3KSwoMzY0NTIsMzUtNTMpLCgzNjQ1Miw1NC02MiksKDM2NDU0LDMzLTM4KSwoMzY0NTQsNDEtNTQpLCgzNjQ1NCw1NS02MCksKDM2NDU1LDM1LTUzKSwoMzY0NTUsNTQtNjIpLCgzNjQ1NywzMy00NCksKDM2NDU3LDQ1LTQ5KSwoMzY0NTcsNTAtNTYpLCgzNjQ1Nyw2Mi04MyksKDM2NDU3LDg0LTg4KSwoMzY0NTgsMzUtNTMpLCgzNjQ1OCw1NC02MiksKDM2NDYwLDMzLTM3KSwoMzY0NjAsMzgtNDIpLCgzNjQ2MCw0Ny01NyksKDM2NDYwLDU4LTY3KSwoMzY0NjEsMzUtNTMpLCgzNjQ2MSw1NC02MiksKDM2NDYzLDM0LTM4KSwoMzY0NjMsMzktNDUpLCgzNjQ2Myw0Ni01MSksKDM2NDYzLDU0LTYzKSwoMzY0NjMsNjQtNzEpLCgzNjQ2Myw3Ni04MCksKDM2NDYzLDgxLTg3KSwoMzY0NjMsODgtOTIpLCgzNjQ2Myw5Ny0xMDcpLCgzNjQ2MywxMDgtMTE5KSwoMzY0NjQsMzUtNTMpLCgzNjQ2NCw1NC02MiksKDM2NDY2LDMzLTcxKSwoMzY0NjYsNzItNzYpLCgzNjQ2NywzNS01MyksKDM2NDY3LDU0LTYyKSwoMzY0NjksMjQtMjkpLCgzNjQ2OSwzMy00NiksKDM2NDY5LDQ3LTU0KSwoMzY0NzAsMjQtMzUpLCgzNjQ3MCwzOC00NiksKDM2NDczLDI1LTM1KSwoMzY0NzMsMzYtNTEpLCgzNjQ3NCwyOC0zMyksKDM2NDc0LDM2LTQ5KSwoMzY0NzQsNTAtNTgpLCgzNjQ3NSwzNS01MyksKDM2NDc1LDU0LTYyKV1cblx0XHRzdG9yZS5zZXRQYXJ0aWFsKFxuXHRcdFx0bmV3IFJhbmdlKDM2NDQ2LCAxLCAzNjQ3NSwgMTE1KSxcblx0XHRcdFtjcmVhdGVUb2tlbnMoJ1soMzY0NDgsMjQtMjkpLCgzNjQ0OCwzMy00NiksKDM2NDQ4LDQ3LTU0KSwoMzY0NTAsMjUtMzUpLCgzNjQ1MCwzNi01MCksKDM2NDUxLDI4LTMzKSwoMzY0NTEsMzYtNDkpLCgzNjQ1MSw1MC01NyksKDM2NDUyLDM1LTUzKSwoMzY0NTIsNTQtNjIpLCgzNjQ1NCwzMy0zOCksKDM2NDU0LDQxLTU0KSwoMzY0NTQsNTUtNjApLCgzNjQ1NSwzNS01MyksKDM2NDU1LDU0LTYyKSwoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpLCgzNjQ2NiwzMy03MSksKDM2NDY2LDcyLTc2KSwoMzY0NjcsMzUtNTMpLCgzNjQ2Nyw1NC02MiksKDM2NDY5LDI0LTI5KSwoMzY0NjksMzMtNDYpLCgzNjQ2OSw0Ny01NCksKDM2NDcwLDI0LTM1KSwoMzY0NzAsMzgtNDYpLCgzNjQ3MywyNS0zNSksKDM2NDczLDM2LTUxKSwoMzY0NzQsMjgtMzMpLCgzNjQ3NCwzNi00OSksKDM2NDc0LDUwLTU4KSwoMzY0NzUsMzUtNTMpLCgzNjQ3NSw1NC02MildJyldXG5cdFx0KTtcblx0XHQvLyBzZXRQYXJ0aWFsIFszNjQzNiwxIC0+IDM2NDY0LDE0Ml0gWygzNjQzNywzMy0zNyksKDM2NDM3LDM4LTQyKSwoMzY0MzcsNDctNTcpLCgzNjQzNyw1OC02NyksKDM2NDM4LDM1LTUzKSwoMzY0MzgsNTQtNjIpLCgzNjQ0MCwyNC0yOSksKDM2NDQwLDMzLTQ2KSwoMzY0NDAsNDctNTMpLCgzNjQ0MiwyNS0zNSksKDM2NDQyLDM2LTUwKSwoMzY0NDMsMzAtMzkpLCgzNjQ0Myw0Mi00NiksKDM2NDQzLDQ3LTUzKSwoMzY0NDMsNTQtNTgpLCgzNjQ0Myw2My03MyksKDM2NDQzLDc0LTg0KSwoMzY0NDMsODctOTEpLCgzNjQ0Myw5Mi05OCksKDM2NDQzLDEwMS0xMDUpLCgzNjQ0MywxMDYtMTEyKSwoMzY0NDMsMTEzLTExOSksKDM2NDQ0LDI4LTM3KSwoMzY0NDQsMzgtNDIpLCgzNjQ0NCw0Ny01NyksKDM2NDQ0LDU4LTc1KSwoMzY0NDQsODAtOTUpLCgzNjQ0NCw5Ni0xMDUpLCgzNjQ0NSwzNS01MyksKDM2NDQ1LDU0LTYyKSwoMzY0NDgsMjQtMjkpLCgzNjQ0OCwzMy00NiksKDM2NDQ4LDQ3LTU0KSwoMzY0NTAsMjUtMzUpLCgzNjQ1MCwzNi01MCksKDM2NDUxLDI4LTMzKSwoMzY0NTEsMzYtNDkpLCgzNjQ1MSw1MC01NyksKDM2NDUyLDM1LTUzKSwoMzY0NTIsNTQtNjIpLCgzNjQ1NCwzMy0zOCksKDM2NDU0LDQxLTU0KSwoMzY0NTQsNTUtNjApLCgzNjQ1NSwzNS01MyksKDM2NDU1LDU0LTYyKSwoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpXVxuXHRcdHN0b3JlLnNldFBhcnRpYWwoXG5cdFx0XHRuZXcgUmFuZ2UoMzY0MzYsIDEsIDM2NDY0LCAxNDIpLFxuXHRcdFx0W2NyZWF0ZVRva2VucygnWygzNjQzNywzMy0zNyksKDM2NDM3LDM4LTQyKSwoMzY0MzcsNDctNTcpLCgzNjQzNyw1OC02NyksKDM2NDM4LDM1LTUzKSwoMzY0MzgsNTQtNjIpLCgzNjQ0MCwyNC0yOSksKDM2NDQwLDMzLTQ2KSwoMzY0NDAsNDctNTMpLCgzNjQ0MiwyNS0zNSksKDM2NDQyLDM2LTUwKSwoMzY0NDMsMzAtMzkpLCgzNjQ0Myw0Mi00NiksKDM2NDQzLDQ3LTUzKSwoMzY0NDMsNTQtNTgpLCgzNjQ0Myw2My03MyksKDM2NDQzLDc0LTg0KSwoMzY0NDMsODctOTEpLCgzNjQ0Myw5Mi05OCksKDM2NDQzLDEwMS0xMDUpLCgzNjQ0MywxMDYtMTEyKSwoMzY0NDMsMTEzLTExOSksKDM2NDQ0LDI4LTM3KSwoMzY0NDQsMzgtNDIpLCgzNjQ0NCw0Ny01NyksKDM2NDQ0LDU4LTc1KSwoMzY0NDQsODAtOTUpLCgzNjQ0NCw5Ni0xMDUpLCgzNjQ0NSwzNS01MyksKDM2NDQ1LDU0LTYyKSwoMzY0NDgsMjQtMjkpLCgzNjQ0OCwzMy00NiksKDM2NDQ4LDQ3LTU0KSwoMzY0NTAsMjUtMzUpLCgzNjQ1MCwzNi01MCksKDM2NDUxLDI4LTMzKSwoMzY0NTEsMzYtNDkpLCgzNjQ1MSw1MC01NyksKDM2NDUyLDM1LTUzKSwoMzY0NTIsNTQtNjIpLCgzNjQ1NCwzMy0zOCksKDM2NDU0LDQxLTU0KSwoMzY0NTQsNTUtNjApLCgzNjQ1NSwzNS01MyksKDM2NDU1LDU0LTYyKSwoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpXScpXVxuXHRcdCk7XG5cdFx0Ly8gc2V0UGFydGlhbCBbMzY0NTcsMSAtPiAzNjQ4NSwxNDBdIFsoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpLCgzNjQ2NiwzMy03MSksKDM2NDY2LDcyLTc2KSwoMzY0NjcsMzUtNTMpLCgzNjQ2Nyw1NC02MiksKDM2NDY5LDI0LTI5KSwoMzY0NjksMzMtNDYpLCgzNjQ2OSw0Ny01NCksKDM2NDcwLDI0LTM1KSwoMzY0NzAsMzgtNDYpLCgzNjQ3MywyNS0zNSksKDM2NDczLDM2LTUxKSwoMzY0NzQsMjgtMzMpLCgzNjQ3NCwzNi00OSksKDM2NDc0LDUwLTU4KSwoMzY0NzUsMzUtNTMpLCgzNjQ3NSw1NC02MiksKDM2NDc3LDI4LTMyKSwoMzY0NzcsMzMtMzcpLCgzNjQ3Nyw0Mi01MiksKDM2NDc3LDUzLTY5KSwoMzY0NzgsMzItMzYpLCgzNjQ3OCwzNy00MSksKDM2NDc4LDQ2LTU2KSwoMzY0NzgsNTctNzQpLCgzNjQ3OSwzMi0zNiksKDM2NDc5LDM3LTQxKSwoMzY0NzksNDYtNTYpLCgzNjQ3OSw1Ny03NiksKDM2NDgwLDMyLTM2KSwoMzY0ODAsMzctNDEpLCgzNjQ4MCw0Ni01NiksKDM2NDgwLDU3LTY4KSwoMzY0ODEsMzItMzYpLCgzNjQ4MSwzNy00MSksKDM2NDgxLDQ2LTU2KSwoMzY0ODEsNTctNjgpLCgzNjQ4MiwzOS01NyksKDM2NDgyLDU4LTY2KSwoMzY0ODQsMzQtMzgpLCgzNjQ4NCwzOS00NSksKDM2NDg0LDQ2LTUwKSwoMzY0ODQsNTUtNjUpLCgzNjQ4NCw2Ni04MiksKDM2NDg0LDg2LTk3KSwoMzY0ODQsOTgtMTAyKSwoMzY0ODQsMTAzLTEwOSksKDM2NDg0LDExMS0xMjQpLCgzNjQ4NCwxMjUtMTMzKSwoMzY0ODUsMzktNTcpLCgzNjQ4NSw1OC02NildXG5cdFx0c3RvcmUuc2V0UGFydGlhbChcblx0XHRcdG5ldyBSYW5nZSgzNjQ1NywgMSwgMzY0ODUsIDE0MCksXG5cdFx0XHRbY3JlYXRlVG9rZW5zKCdbKDM2NDU3LDMzLTQ0KSwoMzY0NTcsNDUtNDkpLCgzNjQ1Nyw1MC01NiksKDM2NDU3LDYyLTgzKSwoMzY0NTcsODQtODgpLCgzNjQ1OCwzNS01MyksKDM2NDU4LDU0LTYyKSwoMzY0NjAsMzMtMzcpLCgzNjQ2MCwzOC00MiksKDM2NDYwLDQ3LTU3KSwoMzY0NjAsNTgtNjcpLCgzNjQ2MSwzNS01MyksKDM2NDYxLDU0LTYyKSwoMzY0NjMsMzQtMzgpLCgzNjQ2MywzOS00NSksKDM2NDYzLDQ2LTUxKSwoMzY0NjMsNTQtNjMpLCgzNjQ2Myw2NC03MSksKDM2NDYzLDc2LTgwKSwoMzY0NjMsODEtODcpLCgzNjQ2Myw4OC05MiksKDM2NDYzLDk3LTEwNyksKDM2NDYzLDEwOC0xMTkpLCgzNjQ2NCwzNS01MyksKDM2NDY0LDU0LTYyKSwoMzY0NjYsMzMtNzEpLCgzNjQ2Niw3Mi03NiksKDM2NDY3LDM1LTUzKSwoMzY0NjcsNTQtNjIpLCgzNjQ2OSwyNC0yOSksKDM2NDY5LDMzLTQ2KSwoMzY0NjksNDctNTQpLCgzNjQ3MCwyNC0zNSksKDM2NDcwLDM4LTQ2KSwoMzY0NzMsMjUtMzUpLCgzNjQ3MywzNi01MSksKDM2NDc0LDI4LTMzKSwoMzY0NzQsMzYtNDkpLCgzNjQ3NCw1MC01OCksKDM2NDc1LDM1LTUzKSwoMzY0NzUsNTQtNjIpLCgzNjQ3NywyOC0zMiksKDM2NDc3LDMzLTM3KSwoMzY0NzcsNDItNTIpLCgzNjQ3Nyw1My02OSksKDM2NDc4LDMyLTM2KSwoMzY0NzgsMzctNDEpLCgzNjQ3OCw0Ni01NiksKDM2NDc4LDU3LTc0KSwoMzY0NzksMzItMzYpLCgzNjQ3OSwzNy00MSksKDM2NDc5LDQ2LTU2KSwoMzY0NzksNTctNzYpLCgzNjQ4MCwzMi0zNiksKDM2NDgwLDM3LTQxKSwoMzY0ODAsNDYtNTYpLCgzNjQ4MCw1Ny02OCksKDM2NDgxLDMyLTM2KSwoMzY0ODEsMzctNDEpLCgzNjQ4MSw0Ni01NiksKDM2NDgxLDU3LTY4KSwoMzY0ODIsMzktNTcpLCgzNjQ4Miw1OC02NiksKDM2NDg0LDM0LTM4KSwoMzY0ODQsMzktNDUpLCgzNjQ4NCw0Ni01MCksKDM2NDg0LDU1LTY1KSwoMzY0ODQsNjYtODIpLCgzNjQ4NCw4Ni05NyksKDM2NDg0LDk4LTEwMiksKDM2NDg0LDEwMy0xMDkpLCgzNjQ4NCwxMTEtMTI0KSwoMzY0ODQsMTI1LTEzMyksKDM2NDg1LDM5LTU3KSwoMzY0ODUsNTgtNjYpXScpXVxuXHRcdCk7XG5cdFx0Ly8gc2V0UGFydGlhbCBbMzY0NDEsMSAtPiAzNjQ2OSw1Nl0gWygzNjQ0MiwyNS0zNSksKDM2NDQyLDM2LTUwKSwoMzY0NDMsMzAtMzkpLCgzNjQ0Myw0Mi00NiksKDM2NDQzLDQ3LTUzKSwoMzY0NDMsNTQtNTgpLCgzNjQ0Myw2My03MyksKDM2NDQzLDc0LTg0KSwoMzY0NDMsODctOTEpLCgzNjQ0Myw5Mi05OCksKDM2NDQzLDEwMS0xMDUpLCgzNjQ0MywxMDYtMTEyKSwoMzY0NDMsMTEzLTExOSksKDM2NDQ0LDI4LTM3KSwoMzY0NDQsMzgtNDIpLCgzNjQ0NCw0Ny01NyksKDM2NDQ0LDU4LTc1KSwoMzY0NDQsODAtOTUpLCgzNjQ0NCw5Ni0xMDUpLCgzNjQ0NSwzNS01MyksKDM2NDQ1LDU0LTYyKSwoMzY0NDgsMjQtMjkpLCgzNjQ0OCwzMy00NiksKDM2NDQ4LDQ3LTU0KSwoMzY0NTAsMjUtMzUpLCgzNjQ1MCwzNi01MCksKDM2NDUxLDI4LTMzKSwoMzY0NTEsMzYtNDkpLCgzNjQ1MSw1MC01NyksKDM2NDUyLDM1LTUzKSwoMzY0NTIsNTQtNjIpLCgzNjQ1NCwzMy0zOCksKDM2NDU0LDQxLTU0KSwoMzY0NTQsNTUtNjApLCgzNjQ1NSwzNS01MyksKDM2NDU1LDU0LTYyKSwoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpLCgzNjQ2NiwzMy03MSksKDM2NDY2LDcyLTc2KSwoMzY0NjcsMzUtNTMpLCgzNjQ2Nyw1NC02MiksKDM2NDY5LDI0LTI5KSwoMzY0NjksMzMtNDYpLCgzNjQ2OSw0Ny01NCksKDM2NDcwLDI0LTM1KV1cblx0XHRzdG9yZS5zZXRQYXJ0aWFsKFxuXHRcdFx0bmV3IFJhbmdlKDM2NDQxLCAxLCAzNjQ2OSwgNTYpLFxuXHRcdFx0W2NyZWF0ZVRva2VucygnWygzNjQ0MiwyNS0zNSksKDM2NDQyLDM2LTUwKSwoMzY0NDMsMzAtMzkpLCgzNjQ0Myw0Mi00NiksKDM2NDQzLDQ3LTUzKSwoMzY0NDMsNTQtNTgpLCgzNjQ0Myw2My03MyksKDM2NDQzLDc0LTg0KSwoMzY0NDMsODctOTEpLCgzNjQ0Myw5Mi05OCksKDM2NDQzLDEwMS0xMDUpLCgzNjQ0MywxMDYtMTEyKSwoMzY0NDMsMTEzLTExOSksKDM2NDQ0LDI4LTM3KSwoMzY0NDQsMzgtNDIpLCgzNjQ0NCw0Ny01NyksKDM2NDQ0LDU4LTc1KSwoMzY0NDQsODAtOTUpLCgzNjQ0NCw5Ni0xMDUpLCgzNjQ0NSwzNS01MyksKDM2NDQ1LDU0LTYyKSwoMzY0NDgsMjQtMjkpLCgzNjQ0OCwzMy00NiksKDM2NDQ4LDQ3LTU0KSwoMzY0NTAsMjUtMzUpLCgzNjQ1MCwzNi01MCksKDM2NDUxLDI4LTMzKSwoMzY0NTEsMzYtNDkpLCgzNjQ1MSw1MC01NyksKDM2NDUyLDM1LTUzKSwoMzY0NTIsNTQtNjIpLCgzNjQ1NCwzMy0zOCksKDM2NDU0LDQxLTU0KSwoMzY0NTQsNTUtNjApLCgzNjQ1NSwzNS01MyksKDM2NDU1LDU0LTYyKSwoMzY0NTcsMzMtNDQpLCgzNjQ1Nyw0NS00OSksKDM2NDU3LDUwLTU2KSwoMzY0NTcsNjItODMpLCgzNjQ1Nyw4NC04OCksKDM2NDU4LDM1LTUzKSwoMzY0NTgsNTQtNjIpLCgzNjQ2MCwzMy0zNyksKDM2NDYwLDM4LTQyKSwoMzY0NjAsNDctNTcpLCgzNjQ2MCw1OC02NyksKDM2NDYxLDM1LTUzKSwoMzY0NjEsNTQtNjIpLCgzNjQ2MywzNC0zOCksKDM2NDYzLDM5LTQ1KSwoMzY0NjMsNDYtNTEpLCgzNjQ2Myw1NC02MyksKDM2NDYzLDY0LTcxKSwoMzY0NjMsNzYtODApLCgzNjQ2Myw4MS04NyksKDM2NDYzLDg4LTkyKSwoMzY0NjMsOTctMTA3KSwoMzY0NjMsMTA4LTExOSksKDM2NDY0LDM1LTUzKSwoMzY0NjQsNTQtNjIpLCgzNjQ2NiwzMy03MSksKDM2NDY2LDcyLTc2KSwoMzY0NjcsMzUtNTMpLCgzNjQ2Nyw1NC02MiksKDM2NDY5LDI0LTI5KSwoMzY0NjksMzMtNDYpLCgzNjQ2OSw0Ny01NCksKDM2NDcwLDI0LTM1KV0nKV1cblx0XHQpO1xuXG5cdFx0Y29uc3QgbGluZVRva2VucyA9IHN0b3JlLmFkZFNwYXJzZVRva2VucygzNjQ1MSwgbmV3IExpbmVUb2tlbnMobmV3IFVpbnQzMkFycmF5KFs2MCwgMV0pLCBgICAgICAgICAgICAgICAgICAgICAgICAgaWYgKGZsYWdzICYgTW9kaWZpZXJGbGFncy5BbWJpZW50KSB7YCwgY29kZWMpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGluZVRva2Vucy5nZXRDb3VudCgpLCA3KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdpc3N1ZSAjOTU5NDk6IElkZW50aWZpZXJzIGFyZSBjb2xvcmVkIGluIGJvbGQgd2hlbiB0YXJnZXR0aW5nIGtleXdvcmRzJywgKCkgPT4ge1xuXG5cdFx0ZnVuY3Rpb24gY3JlYXRlVE1NZXRhZGF0YShmb3JlZ3JvdW5kOiBudW1iZXIsIGZvbnRTdHlsZTogbnVtYmVyLCBsYW5ndWFnZUlkOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdFx0cmV0dXJuIChcblx0XHRcdFx0KGxhbmd1YWdlSWQgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpXG5cdFx0XHRcdHwgKGZvbnRTdHlsZSA8PCBNZXRhZGF0YUNvbnN0cy5GT05UX1NUWUxFX09GRlNFVClcblx0XHRcdFx0fCAoZm9yZWdyb3VuZCA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVClcblx0XHRcdCkgPj4+IDA7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdG9BcnIobGluZVRva2VuczogTGluZVRva2Vucyk6IG51bWJlcltdIHtcblx0XHRcdGNvbnN0IHI6IG51bWJlcltdID0gW107XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVUb2tlbnMuZ2V0Q291bnQoKTsgaSsrKSB7XG5cdFx0XHRcdHIucHVzaChsaW5lVG9rZW5zLmdldEVuZE9mZnNldChpKSk7XG5cdFx0XHRcdHIucHVzaChsaW5lVG9rZW5zLmdldE1ldGFkYXRhKGkpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvZGVjID0gbmV3IExhbmd1YWdlSWRDb2RlYygpO1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IFNwYXJzZVRva2Vuc1N0b3JlKGNvZGVjKTtcblxuXHRcdHN0b3JlLnNldChbXG5cdFx0XHRTcGFyc2VNdWx0aWxpbmVUb2tlbnMuY3JlYXRlKDEsIG5ldyBVaW50MzJBcnJheShbXG5cdFx0XHRcdDAsIDYsIDExLCAoMSA8PCBNZXRhZGF0YUNvbnN0cy5GT1JFR1JPVU5EX09GRlNFVCkgfCBNZXRhZGF0YUNvbnN0cy5TRU1BTlRJQ19VU0VfRk9SRUdST1VORCxcblx0XHRcdF0pKVxuXHRcdF0sIHRydWUpO1xuXG5cdFx0Y29uc3QgbGluZVRva2VucyA9IHN0b3JlLmFkZFNwYXJzZVRva2VucygxLCBuZXcgTGluZVRva2VucyhuZXcgVWludDMyQXJyYXkoW1xuXHRcdFx0NSwgY3JlYXRlVE1NZXRhZGF0YSg1LCBGb250U3R5bGUuQm9sZCwgNTMpLFxuXHRcdFx0MTQsIGNyZWF0ZVRNTWV0YWRhdGEoMSwgRm9udFN0eWxlLk5vbmUsIDUzKSxcblx0XHRcdDE3LCBjcmVhdGVUTU1ldGFkYXRhKDYsIEZvbnRTdHlsZS5Ob25lLCA1MyksXG5cdFx0XHQxOCwgY3JlYXRlVE1NZXRhZGF0YSgxLCBGb250U3R5bGUuTm9uZSwgNTMpLFxuXHRcdF0pLCBgY29uc3QgaGVsbG8gPSAxMjM7YCwgY29kZWMpKTtcblxuXHRcdGNvbnN0IGFjdHVhbCA9IHRvQXJyKGxpbmVUb2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYWN0dWFsLCBbXG5cdFx0XHQ1LCBjcmVhdGVUTU1ldGFkYXRhKDUsIEZvbnRTdHlsZS5Cb2xkLCA1MyksXG5cdFx0XHQ2LCBjcmVhdGVUTU1ldGFkYXRhKDEsIEZvbnRTdHlsZS5Ob25lLCA1MyksXG5cdFx0XHQxMSwgY3JlYXRlVE1NZXRhZGF0YSgxLCBGb250U3R5bGUuTm9uZSwgNTMpLFxuXHRcdFx0MTQsIGNyZWF0ZVRNTWV0YWRhdGEoMSwgRm9udFN0eWxlLk5vbmUsIDUzKSxcblx0XHRcdDE3LCBjcmVhdGVUTU1ldGFkYXRhKDYsIEZvbnRTdHlsZS5Ob25lLCA1MyksXG5cdFx0XHQxOCwgY3JlYXRlVE1NZXRhZGF0YSgxLCBGb250U3R5bGUuTm9uZSwgNTMpXG5cdFx0XSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQ0FBK0M7QUFFeEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQWtCLFdBQVcsZ0JBQWdCLHFCQUFxQjtBQUNsRSxTQUFTLCtCQUErQixvQ0FBb0M7QUFFNUUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxxQkFBcUIsaUJBQWlCLDRCQUE0QjtBQUUzRSxNQUFNLGVBQWUsTUFBTTtBQUUxQiwwQ0FBd0M7QUFFeEMsUUFBTSxpQkFBaUI7QUFFdkIsV0FBUyxpQkFBaUIsT0FBa0U7QUFDM0YsVUFBTSxPQUFpQixDQUFDO0FBQ3hCLFVBQU0sU0FBbUIsQ0FBQztBQUMxQixRQUFJLFdBQVc7QUFDZixhQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLFlBQU0sT0FBTyxNQUFNLENBQUM7QUFFcEIsVUFBSSxjQUFjO0FBQ2xCLFVBQUksV0FBVztBQUNmLGFBQU8sTUFBTTtBQUNa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
