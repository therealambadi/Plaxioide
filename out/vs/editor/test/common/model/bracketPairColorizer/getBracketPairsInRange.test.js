import assert from "assert";
import { disposeOnReturn } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { StandardTokenType } from "../../../../common/encodedTokenAttributes.js";
import { TokenizationRegistry } from "../../../../common/languages.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { TokenInfo, TokenizedDocument } from "./tokenizer.test.js";
import { createModelServices, instantiateTextModel } from "../../testTextModel.js";
suite("Bracket Pair Colorizer - getBracketPairsInRange", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  function createTextModelWithColorizedBracketPairs(store, text) {
    const languageId = "testLanguage";
    const instantiationService = createModelServices(store);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    store.add(languageService.registerLanguage({
      id: languageId
    }));
    const encodedMode1 = languageService.languageIdCodec.encodeLanguageId(languageId);
    const document = new TokenizedDocument([
      new TokenInfo(text, encodedMode1, StandardTokenType.Other, true)
    ]);
    store.add(TokenizationRegistry.register(languageId, document.getTokenizationSupport()));
    store.add(languageConfigurationService.register(languageId, {
      brackets: [
        ["<", ">"]
      ],
      colorizedBracketPairs: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"]
      ]
    }));
    const textModel = store.add(instantiateTextModel(instantiationService, text, languageId));
    return textModel;
  }
  test("Basic 1", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`{ ( [] \xB9 ) [ \xB2 { } ] () } []`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      model.tokenization.getLineTokens(1).getLanguageId(0);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketPairsInRange(doc.range(1, 2)).map(bracketPairToJSON).toArray(),
        [
          {
            level: 0,
            range: "[1,1 -> 1,2]",
            openRange: "[1,1 -> 1,2]",
            closeRange: "[1,23 -> 1,24]"
          },
          {
            level: 1,
            range: "[1,3 -> 1,4]",
            openRange: "[1,3 -> 1,4]",
            closeRange: "[1,9 -> 1,10]"
          },
          {
            level: 1,
            range: "[1,11 -> 1,12]",
            openRange: "[1,11 -> 1,12]",
            closeRange: "[1,18 -> 1,19]"
          }
        ]
      );
    });
  });
  test("Basic 2", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`{ ( [] \xB9 \xB2) [  { } ] () } []`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketPairsInRange(doc.range(1, 2)).map(bracketPairToJSON).toArray(),
        [
          {
            level: 0,
            range: "[1,1 -> 1,2]",
            openRange: "[1,1 -> 1,2]",
            closeRange: "[1,23 -> 1,24]"
          },
          {
            level: 1,
            range: "[1,3 -> 1,4]",
            openRange: "[1,3 -> 1,4]",
            closeRange: "[1,9 -> 1,10]"
          }
        ]
      );
    });
  });
  test("Basic Empty", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`\xB9 \xB2 { ( [] ) [  { } ] () } []`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketPairsInRange(doc.range(1, 2)).map(bracketPairToJSON).toArray(),
        []
      );
    });
  });
  test("Basic All", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`\xB9 { ( [] ) [  { } ] () } [] \xB2`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketPairsInRange(doc.range(1, 2)).map(bracketPairToJSON).toArray(),
        [
          {
            level: 0,
            range: "[1,2 -> 1,3]",
            openRange: "[1,2 -> 1,3]",
            closeRange: "[1,23 -> 1,24]"
          },
          {
            level: 1,
            range: "[1,4 -> 1,5]",
            openRange: "[1,4 -> 1,5]",
            closeRange: "[1,9 -> 1,10]"
          },
          {
            level: 2,
            range: "[1,6 -> 1,7]",
            openRange: "[1,6 -> 1,7]",
            closeRange: "[1,7 -> 1,8]"
          },
          {
            level: 1,
            range: "[1,11 -> 1,12]",
            openRange: "[1,11 -> 1,12]",
            closeRange: "[1,18 -> 1,19]"
          },
          {
            level: 2,
            range: "[1,14 -> 1,15]",
            openRange: "[1,14 -> 1,15]",
            closeRange: "[1,16 -> 1,17]"
          },
          {
            level: 1,
            range: "[1,20 -> 1,21]",
            openRange: "[1,20 -> 1,21]",
            closeRange: "[1,21 -> 1,22]"
          },
          {
            level: 0,
            range: "[1,25 -> 1,26]",
            openRange: "[1,25 -> 1,26]",
            closeRange: "[1,26 -> 1,27]"
          }
        ]
      );
    });
  });
  test("getBracketsInRange", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`\xB9 { [ ( [ [ (  ) ] ] ) ] } { } \xB2`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketsInRange(doc.range(1, 2)).map((b) => ({ level: b.nestingLevel, levelEqualBracketType: b.nestingLevelOfEqualBracketType, range: b.range.toString() })).toArray(),
        [
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,2 -> 1,3]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,4 -> 1,5]"
          },
          {
            level: 2,
            levelEqualBracketType: 0,
            range: "[1,6 -> 1,7]"
          },
          {
            level: 3,
            levelEqualBracketType: 1,
            range: "[1,8 -> 1,9]"
          },
          {
            level: 4,
            levelEqualBracketType: 2,
            range: "[1,10 -> 1,11]"
          },
          {
            level: 5,
            levelEqualBracketType: 1,
            range: "[1,12 -> 1,13]"
          },
          {
            level: 5,
            levelEqualBracketType: 1,
            range: "[1,15 -> 1,16]"
          },
          {
            level: 4,
            levelEqualBracketType: 2,
            range: "[1,17 -> 1,18]"
          },
          {
            level: 3,
            levelEqualBracketType: 1,
            range: "[1,19 -> 1,20]"
          },
          {
            level: 2,
            levelEqualBracketType: 0,
            range: "[1,21 -> 1,22]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,23 -> 1,24]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,25 -> 1,26]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,27 -> 1,28]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,29 -> 1,30]"
          }
        ]
      );
    });
  });
  test("Test Error Brackets", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`\xB9 { () ] \xB2 `);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketsInRange(doc.range(1, 2)).map((b) => ({ level: b.nestingLevel, range: b.range.toString(), isInvalid: b.isInvalid })).toArray(),
        [
          {
            level: 0,
            isInvalid: true,
            range: "[1,2 -> 1,3]"
          },
          {
            level: 1,
            isInvalid: false,
            range: "[1,4 -> 1,5]"
          },
          {
            level: 1,
            isInvalid: false,
            range: "[1,5 -> 1,6]"
          },
          {
            level: 0,
            isInvalid: true,
            range: "[1,7 -> 1,8]"
          }
        ]
      );
    });
  });
  test("colorizedBracketsVSBrackets", () => {
    disposeOnReturn((store) => {
      const doc = new AnnotatedDocument(`\xB9 {} [<()>] <{>} \xB2`);
      const model = createTextModelWithColorizedBracketPairs(store, doc.text);
      assert.deepStrictEqual(
        model.bracketPairs.getBracketsInRange(doc.range(1, 2), true).map((b) => ({ level: b.nestingLevel, levelEqualBracketType: b.nestingLevelOfEqualBracketType, range: b.range.toString() })).toArray(),
        [
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,2 -> 1,3]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,3 -> 1,4]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,5 -> 1,6]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,7 -> 1,8]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,8 -> 1,9]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,10 -> 1,11]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,13 -> 1,14]"
          },
          {
            level: -1,
            levelEqualBracketType: 0,
            range: "[1,15 -> 1,16]"
          }
        ]
      );
      assert.deepStrictEqual(
        model.bracketPairs.getBracketsInRange(doc.range(1, 2), false).map((b) => ({ level: b.nestingLevel, levelEqualBracketType: b.nestingLevelOfEqualBracketType, range: b.range.toString() })).toArray(),
        [
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,2 -> 1,3]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,3 -> 1,4]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,5 -> 1,6]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,6 -> 1,7]"
          },
          {
            level: 2,
            levelEqualBracketType: 0,
            range: "[1,7 -> 1,8]"
          },
          {
            level: 2,
            levelEqualBracketType: 0,
            range: "[1,8 -> 1,9]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,9 -> 1,10]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,10 -> 1,11]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,12 -> 1,13]"
          },
          {
            level: 1,
            levelEqualBracketType: 0,
            range: "[1,13 -> 1,14]"
          },
          {
            level: 0,
            levelEqualBracketType: 0,
            range: "[1,14 -> 1,15]"
          },
          {
            level: -1,
            levelEqualBracketType: 0,
            range: "[1,15 -> 1,16]"
          }
        ]
      );
    });
  });
});
function bracketPairToJSON(pair) {
  return {
    level: pair.nestingLevel,
    range: pair.openingBracketRange.toString(),
    openRange: pair.openingBracketRange.toString(),
    closeRange: pair.closingBracketRange?.toString() || null
  };
}
class PositionOffsetTransformer {
  constructor(text) {
    this.lineStartOffsetByLineIdx = [];
    this.lineStartOffsetByLineIdx.push(0);
    for (let i = 0; i < text.length; i++) {
      if (text.charAt(i) === "\n") {
        this.lineStartOffsetByLineIdx.push(i + 1);
      }
    }
  }
  getOffset(position) {
    return this.lineStartOffsetByLineIdx[position.lineNumber - 1] + position.column - 1;
  }
  getPosition(offset) {
    const lineNumber = this.lineStartOffsetByLineIdx.findIndex((lineStartOffset) => lineStartOffset <= offset);
    return new Position(lineNumber + 1, offset - this.lineStartOffsetByLineIdx[lineNumber] + 1);
  }
}
class AnnotatedDocument {
  constructor(src) {
    const numbers = ["\u2070", "\xB9", "\xB2", "\xB3", "\u2074", "\u2075", "\u2076", "\u2077", "\u2078", "\u2079"];
    let text = "";
    const offsetPositions = /* @__PURE__ */ new Map();
    let offset = 0;
    for (let i = 0; i < src.length; i++) {
      const idx = numbers.indexOf(src[i]);
      if (idx >= 0) {
        offsetPositions.set(idx, offset);
      } else {
        text += src[i];
        offset++;
      }
    }
    this.text = text;
    const mapper = new PositionOffsetTransformer(this.text);
    const positions = /* @__PURE__ */ new Map();
    for (const [idx, offset2] of offsetPositions.entries()) {
      positions.set(idx, mapper.getPosition(offset2));
    }
    this.positions = positions;
  }
  range(start, end) {
    return Range.fromPositions(this.positions.get(start), this.positions.get(end));
  }
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvYnJhY2tldFBhaXJDb2xvcml6ZXIvZ2V0QnJhY2tldFBhaXJzSW5SYW5nZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBkaXNwb3NlT25SZXR1cm4gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC90ZXh0TW9kZWwuanMnO1xuaW1wb3J0IHsgQnJhY2tldFBhaXJJbmZvIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3RleHRNb2RlbEJyYWNrZXRQYWlycy5qcyc7XG5pbXBvcnQgeyBUb2tlbkluZm8sIFRva2VuaXplZERvY3VtZW50IH0gZnJvbSAnLi90b2tlbml6ZXIudGVzdC5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbFNlcnZpY2VzLCBpbnN0YW50aWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uL3Rlc3RUZXh0TW9kZWwuanMnO1xuXG5zdWl0ZSgnQnJhY2tldCBQYWlyIENvbG9yaXplciAtIGdldEJyYWNrZXRQYWlyc0luUmFuZ2UnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0ZnVuY3Rpb24gY3JlYXRlVGV4dE1vZGVsV2l0aENvbG9yaXplZEJyYWNrZXRQYWlycyhzdG9yZTogRGlzcG9zYWJsZVN0b3JlLCB0ZXh0OiBzdHJpbmcpOiBUZXh0TW9kZWwge1xuXHRcdGNvbnN0IGxhbmd1YWdlSWQgPSAndGVzdExhbmd1YWdlJztcblx0XHRjb25zdCBpbnN0YW50aWF0aW9uU2VydmljZSA9IGNyZWF0ZU1vZGVsU2VydmljZXMoc3RvcmUpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRzdG9yZS5hZGQobGFuZ3VhZ2VTZXJ2aWNlLnJlZ2lzdGVyTGFuZ3VhZ2Uoe1xuXHRcdFx0aWQ6IGxhbmd1YWdlSWQsXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgZW5jb2RlZE1vZGUxID0gbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYy5lbmNvZGVMYW5ndWFnZUlkKGxhbmd1YWdlSWQpO1xuXHRcdGNvbnN0IGRvY3VtZW50ID0gbmV3IFRva2VuaXplZERvY3VtZW50KFtcblx0XHRcdG5ldyBUb2tlbkluZm8odGV4dCwgZW5jb2RlZE1vZGUxLCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciwgdHJ1ZSlcblx0XHRdKTtcblx0XHRzdG9yZS5hZGQoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgZG9jdW1lbnQuZ2V0VG9rZW5pemF0aW9uU3VwcG9ydCgpKSk7XG5cblx0XHRzdG9yZS5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCB7XG5cdFx0XHRicmFja2V0czogW1xuXHRcdFx0XHRbJzwnLCAnPiddXG5cdFx0XHRdLFxuXHRcdFx0Y29sb3JpemVkQnJhY2tldFBhaXJzOiBbXG5cdFx0XHRcdFsneycsICd9J10sXG5cdFx0XHRcdFsnWycsICddJ10sXG5cdFx0XHRcdFsnKCcsICcpJ10sXG5cdFx0XHRdXG5cdFx0fSkpO1xuXHRcdGNvbnN0IHRleHRNb2RlbCA9IHN0b3JlLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgdGV4dCwgbGFuZ3VhZ2VJZCkpO1xuXHRcdHJldHVybiB0ZXh0TW9kZWw7XG5cdH1cblxuXHR0ZXN0KCdCYXNpYyAxJywgKCkgPT4ge1xuXHRcdGRpc3Bvc2VPblJldHVybihzdG9yZSA9PiB7XG5cdFx0XHRjb25zdCBkb2MgPSBuZXcgQW5ub3RhdGVkRG9jdW1lbnQoYHsgKCBbXSBcdTAwQjkgKSBbIFx1MDBCMiB7IH0gXSAoKSB9IFtdYCk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhDb2xvcml6ZWRCcmFja2V0UGFpcnMoc3RvcmUsIGRvYy50ZXh0KTtcblx0XHRcdG1vZGVsLnRva2VuaXphdGlvbi5nZXRMaW5lVG9rZW5zKDEpLmdldExhbmd1YWdlSWQoMCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRtb2RlbC5icmFja2V0UGFpcnNcblx0XHRcdFx0XHQuZ2V0QnJhY2tldFBhaXJzSW5SYW5nZShkb2MucmFuZ2UoMSwgMikpXG5cdFx0XHRcdFx0Lm1hcChicmFja2V0UGFpclRvSlNPTilcblx0XHRcdFx0XHQudG9BcnJheSgpLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogJ1sxLDEgLT4gMSwyXScsXG5cdFx0XHRcdFx0XHRvcGVuUmFuZ2U6ICdbMSwxIC0+IDEsMl0nLFxuXHRcdFx0XHRcdFx0Y2xvc2VSYW5nZTogJ1sxLDIzIC0+IDEsMjRdJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0cmFuZ2U6ICdbMSwzIC0+IDEsNF0nLFxuXHRcdFx0XHRcdFx0b3BlblJhbmdlOiAnWzEsMyAtPiAxLDRdJyxcblx0XHRcdFx0XHRcdGNsb3NlUmFuZ2U6ICdbMSw5IC0+IDEsMTBdJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0cmFuZ2U6ICdbMSwxMSAtPiAxLDEyXScsXG5cdFx0XHRcdFx0XHRvcGVuUmFuZ2U6ICdbMSwxMSAtPiAxLDEyXScsXG5cdFx0XHRcdFx0XHRjbG9zZVJhbmdlOiAnWzEsMTggLT4gMSwxOV0nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Jhc2ljIDInLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgeyAoIFtdIFx1MDBCOSBcdTAwQjIpIFsgIHsgfSBdICgpIH0gW11gKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsV2l0aENvbG9yaXplZEJyYWNrZXRQYWlycyhzdG9yZSwgZG9jLnRleHQpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0bW9kZWwuYnJhY2tldFBhaXJzXG5cdFx0XHRcdFx0LmdldEJyYWNrZXRQYWlyc0luUmFuZ2UoZG9jLnJhbmdlKDEsIDIpKVxuXHRcdFx0XHRcdC5tYXAoYnJhY2tldFBhaXJUb0pTT04pXG5cdFx0XHRcdFx0LnRvQXJyYXkoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6ICdbMSwxIC0+IDEsMl0nLFxuXHRcdFx0XHRcdFx0b3BlblJhbmdlOiAnWzEsMSAtPiAxLDJdJyxcblx0XHRcdFx0XHRcdGNsb3NlUmFuZ2U6ICdbMSwyMyAtPiAxLDI0XScsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMSxcblx0XHRcdFx0XHRcdHJhbmdlOiAnWzEsMyAtPiAxLDRdJyxcblx0XHRcdFx0XHRcdG9wZW5SYW5nZTogJ1sxLDMgLT4gMSw0XScsXG5cdFx0XHRcdFx0XHRjbG9zZVJhbmdlOiAnWzEsOSAtPiAxLDEwXScsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQmFzaWMgRW1wdHknLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgXHUwMEI5IFx1MDBCMiB7ICggW10gKSBbICB7IH0gXSAoKSB9IFtdYCk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhDb2xvcml6ZWRCcmFja2V0UGFpcnMoc3RvcmUsIGRvYy50ZXh0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vZGVsLmJyYWNrZXRQYWlyc1xuXHRcdFx0XHRcdC5nZXRCcmFja2V0UGFpcnNJblJhbmdlKGRvYy5yYW5nZSgxLCAyKSlcblx0XHRcdFx0XHQubWFwKGJyYWNrZXRQYWlyVG9KU09OKVxuXHRcdFx0XHRcdC50b0FycmF5KCksXG5cdFx0XHRcdFtdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdCYXNpYyBBbGwnLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgXHUwMEI5IHsgKCBbXSApIFsgIHsgfSBdICgpIH0gW10gXHUwMEIyYCk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhDb2xvcml6ZWRCcmFja2V0UGFpcnMoc3RvcmUsIGRvYy50ZXh0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vZGVsLmJyYWNrZXRQYWlyc1xuXHRcdFx0XHRcdC5nZXRCcmFja2V0UGFpcnNJblJhbmdlKGRvYy5yYW5nZSgxLCAyKSlcblx0XHRcdFx0XHQubWFwKGJyYWNrZXRQYWlyVG9KU09OKVxuXHRcdFx0XHRcdC50b0FycmF5KCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiAnWzEsMiAtPiAxLDNdJyxcblx0XHRcdFx0XHRcdG9wZW5SYW5nZTogJ1sxLDIgLT4gMSwzXScsXG5cdFx0XHRcdFx0XHRjbG9zZVJhbmdlOiAnWzEsMjMgLT4gMSwyNF0nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDEsXG5cdFx0XHRcdFx0XHRyYW5nZTogJ1sxLDQgLT4gMSw1XScsXG5cdFx0XHRcdFx0XHRvcGVuUmFuZ2U6ICdbMSw0IC0+IDEsNV0nLFxuXHRcdFx0XHRcdFx0Y2xvc2VSYW5nZTogJ1sxLDkgLT4gMSwxMF0nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDIsXG5cdFx0XHRcdFx0XHRyYW5nZTogJ1sxLDYgLT4gMSw3XScsXG5cdFx0XHRcdFx0XHRvcGVuUmFuZ2U6ICdbMSw2IC0+IDEsN10nLFxuXHRcdFx0XHRcdFx0Y2xvc2VSYW5nZTogJ1sxLDcgLT4gMSw4XScsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMSxcblx0XHRcdFx0XHRcdHJhbmdlOiAnWzEsMTEgLT4gMSwxMl0nLFxuXHRcdFx0XHRcdFx0b3BlblJhbmdlOiAnWzEsMTEgLT4gMSwxMl0nLFxuXHRcdFx0XHRcdFx0Y2xvc2VSYW5nZTogJ1sxLDE4IC0+IDEsMTldJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAyLFxuXHRcdFx0XHRcdFx0cmFuZ2U6ICdbMSwxNCAtPiAxLDE1XScsXG5cdFx0XHRcdFx0XHRvcGVuUmFuZ2U6ICdbMSwxNCAtPiAxLDE1XScsXG5cdFx0XHRcdFx0XHRjbG9zZVJhbmdlOiAnWzEsMTYgLT4gMSwxN10nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDEsXG5cdFx0XHRcdFx0XHRyYW5nZTogJ1sxLDIwIC0+IDEsMjFdJyxcblx0XHRcdFx0XHRcdG9wZW5SYW5nZTogJ1sxLDIwIC0+IDEsMjFdJyxcblx0XHRcdFx0XHRcdGNsb3NlUmFuZ2U6ICdbMSwyMSAtPiAxLDIyXScsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiAnWzEsMjUgLT4gMSwyNl0nLFxuXHRcdFx0XHRcdFx0b3BlblJhbmdlOiAnWzEsMjUgLT4gMSwyNl0nLFxuXHRcdFx0XHRcdFx0Y2xvc2VSYW5nZTogJ1sxLDI2IC0+IDEsMjddJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRCcmFja2V0c0luUmFuZ2UnLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgXHUwMEI5IHsgWyAoIFsgWyAoICApIF0gXSApIF0gfSB7IH0gXHUwMEIyYCk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhDb2xvcml6ZWRCcmFja2V0UGFpcnMoc3RvcmUsIGRvYy50ZXh0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vZGVsLmJyYWNrZXRQYWlyc1xuXHRcdFx0XHRcdC5nZXRCcmFja2V0c0luUmFuZ2UoZG9jLnJhbmdlKDEsIDIpKVxuXHRcdFx0XHRcdC5tYXAoYiA9PiAoeyBsZXZlbDogYi5uZXN0aW5nTGV2ZWwsIGxldmVsRXF1YWxCcmFja2V0VHlwZTogYi5uZXN0aW5nTGV2ZWxPZkVxdWFsQnJhY2tldFR5cGUsIHJhbmdlOiBiLnJhbmdlLnRvU3RyaW5nKCkgfSkpXG5cdFx0XHRcdFx0LnRvQXJyYXkoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMiAtPiAxLDNdXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsNCAtPiAxLDVdXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAyLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsNiAtPiAxLDddXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAzLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAxLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsOCAtPiAxLDldXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiA0LFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAyLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMTAgLT4gMSwxMV1cIlxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDUsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDEsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxMiAtPiAxLDEzXVwiXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogNSxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMSxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDE1IC0+IDEsMTZdXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiA0LFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAyLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMTcgLT4gMSwxOF1cIlxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDMsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDEsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxOSAtPiAxLDIwXVwiXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMixcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDIxIC0+IDEsMjJdXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMjMgLT4gMSwyNF1cIlxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwyNSAtPiAxLDI2XVwiXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMCxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDI3IC0+IDEsMjhdXCJcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMjkgLT4gMSwzMF1cIlxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdF1cblx0XHRcdCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1Rlc3QgRXJyb3IgQnJhY2tldHMnLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgXHUwMEI5IHsgKCkgXSBcdTAwQjIgYCk7XG5cdFx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbFdpdGhDb2xvcml6ZWRCcmFja2V0UGFpcnMoc3RvcmUsIGRvYy50ZXh0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoXG5cdFx0XHRcdG1vZGVsLmJyYWNrZXRQYWlyc1xuXHRcdFx0XHRcdC5nZXRCcmFja2V0c0luUmFuZ2UoZG9jLnJhbmdlKDEsIDIpKVxuXHRcdFx0XHRcdC5tYXAoYiA9PiAoeyBsZXZlbDogYi5uZXN0aW5nTGV2ZWwsIHJhbmdlOiBiLnJhbmdlLnRvU3RyaW5nKCksIGlzSW52YWxpZDogYi5pc0ludmFsaWQgfSkpXG5cdFx0XHRcdFx0LnRvQXJyYXkoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0aXNJbnZhbGlkOiB0cnVlLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMiAtPiAxLDNdXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMSxcblx0XHRcdFx0XHRcdGlzSW52YWxpZDogZmFsc2UsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSw0IC0+IDEsNV1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0aXNJbnZhbGlkOiBmYWxzZSxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDUgLT4gMSw2XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRpc0ludmFsaWQ6IHRydWUsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSw3IC0+IDEsOF1cIlxuXHRcdFx0XHRcdH1cblx0XHRcdFx0XVxuXHRcdFx0KTtcblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdjb2xvcml6ZWRCcmFja2V0c1ZTQnJhY2tldHMnLCAoKSA9PiB7XG5cdFx0ZGlzcG9zZU9uUmV0dXJuKHN0b3JlID0+IHtcblx0XHRcdGNvbnN0IGRvYyA9IG5ldyBBbm5vdGF0ZWREb2N1bWVudChgXHUwMEI5IHt9IFs8KCk+XSA8ez59IFx1MDBCMmApO1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWxXaXRoQ29sb3JpemVkQnJhY2tldFBhaXJzKHN0b3JlLCBkb2MudGV4dCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuXHRcdFx0XHRtb2RlbC5icmFja2V0UGFpcnNcblx0XHRcdFx0XHQuZ2V0QnJhY2tldHNJblJhbmdlKGRvYy5yYW5nZSgxLCAyKSwgdHJ1ZSlcblx0XHRcdFx0XHQubWFwKGIgPT4gKHsgbGV2ZWw6IGIubmVzdGluZ0xldmVsLCBsZXZlbEVxdWFsQnJhY2tldFR5cGU6IGIubmVzdGluZ0xldmVsT2ZFcXVhbEJyYWNrZXRUeXBlLCByYW5nZTogYi5yYW5nZS50b1N0cmluZygpIH0pKVxuXHRcdFx0XHRcdC50b0FycmF5KCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMCxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDIgLT4gMSwzXVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwzIC0+IDEsNF1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsNSAtPiAxLDZdXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMSxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDcgLT4gMSw4XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDEsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSw4IC0+IDEsOV1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMTAgLT4gMSwxMV1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMTMgLT4gMSwxNF1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAtMSxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDE1IC0+IDEsMTZdXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XVxuXHRcdFx0KTtcblxuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChcblx0XHRcdFx0bW9kZWwuYnJhY2tldFBhaXJzXG5cdFx0XHRcdFx0LmdldEJyYWNrZXRzSW5SYW5nZShkb2MucmFuZ2UoMSwgMiksIGZhbHNlKVxuXHRcdFx0XHRcdC5tYXAoYiA9PiAoeyBsZXZlbDogYi5uZXN0aW5nTGV2ZWwsIGxldmVsRXF1YWxCcmFja2V0VHlwZTogYi5uZXN0aW5nTGV2ZWxPZkVxdWFsQnJhY2tldFR5cGUsIHJhbmdlOiBiLnJhbmdlLnRvU3RyaW5nKCkgfSkpXG5cdFx0XHRcdFx0LnRvQXJyYXkoKSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAwLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMiAtPiAxLDNdXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMCxcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDMgLT4gMSw0XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSw1IC0+IDEsNl1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsNiAtPiAxLDddXCIsXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsZXZlbDogMixcblx0XHRcdFx0XHRcdGxldmVsRXF1YWxCcmFja2V0VHlwZTogMCxcblx0XHRcdFx0XHRcdHJhbmdlOiBcIlsxLDcgLT4gMSw4XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDIsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSw4IC0+IDEsOV1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxldmVsOiAxLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsOSAtPiAxLDEwXVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxMCAtPiAxLDExXVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxMiAtPiAxLDEzXVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDEsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxMyAtPiAxLDE0XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IDAsXG5cdFx0XHRcdFx0XHRsZXZlbEVxdWFsQnJhY2tldFR5cGU6IDAsXG5cdFx0XHRcdFx0XHRyYW5nZTogXCJbMSwxNCAtPiAxLDE1XVwiLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGV2ZWw6IC0xLFxuXHRcdFx0XHRcdFx0bGV2ZWxFcXVhbEJyYWNrZXRUeXBlOiAwLFxuXHRcdFx0XHRcdFx0cmFuZ2U6IFwiWzEsMTUgLT4gMSwxNl1cIixcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRdXG5cdFx0XHQpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiBicmFja2V0UGFpclRvSlNPTihwYWlyOiBCcmFja2V0UGFpckluZm8pOiB1bmtub3duIHtcblx0cmV0dXJuIHtcblx0XHRsZXZlbDogcGFpci5uZXN0aW5nTGV2ZWwsXG5cdFx0cmFuZ2U6IHBhaXIub3BlbmluZ0JyYWNrZXRSYW5nZS50b1N0cmluZygpLFxuXHRcdG9wZW5SYW5nZTogcGFpci5vcGVuaW5nQnJhY2tldFJhbmdlLnRvU3RyaW5nKCksXG5cdFx0Y2xvc2VSYW5nZTogcGFpci5jbG9zaW5nQnJhY2tldFJhbmdlPy50b1N0cmluZygpIHx8IG51bGwsXG5cdH07XG59XG5cbmNsYXNzIFBvc2l0aW9uT2Zmc2V0VHJhbnNmb3JtZXIge1xuXHRwcml2YXRlIHJlYWRvbmx5IGxpbmVTdGFydE9mZnNldEJ5TGluZUlkeDogbnVtYmVyW107XG5cblx0Y29uc3RydWN0b3IodGV4dDogc3RyaW5nKSB7XG5cdFx0dGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHggPSBbXTtcblx0XHR0aGlzLmxpbmVTdGFydE9mZnNldEJ5TGluZUlkeC5wdXNoKDApO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGV4dC5sZW5ndGg7IGkrKykge1xuXHRcdFx0aWYgKHRleHQuY2hhckF0KGkpID09PSAnXFxuJykge1xuXHRcdFx0XHR0aGlzLmxpbmVTdGFydE9mZnNldEJ5TGluZUlkeC5wdXNoKGkgKyAxKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRnZXRPZmZzZXQocG9zaXRpb246IFBvc2l0aW9uKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5saW5lU3RhcnRPZmZzZXRCeUxpbmVJZHhbcG9zaXRpb24ubGluZU51bWJlciAtIDFdICsgcG9zaXRpb24uY29sdW1uIC0gMTtcblx0fVxuXG5cdGdldFBvc2l0aW9uKG9mZnNldDogbnVtYmVyKTogUG9zaXRpb24ge1xuXHRcdGNvbnN0IGxpbmVOdW1iZXIgPSB0aGlzLmxpbmVTdGFydE9mZnNldEJ5TGluZUlkeC5maW5kSW5kZXgobGluZVN0YXJ0T2Zmc2V0ID0+IGxpbmVTdGFydE9mZnNldCA8PSBvZmZzZXQpO1xuXHRcdHJldHVybiBuZXcgUG9zaXRpb24obGluZU51bWJlciArIDEsIG9mZnNldCAtIHRoaXMubGluZVN0YXJ0T2Zmc2V0QnlMaW5lSWR4W2xpbmVOdW1iZXJdICsgMSk7XG5cdH1cbn1cblxuY2xhc3MgQW5ub3RhdGVkRG9jdW1lbnQge1xuXHRwdWJsaWMgcmVhZG9ubHkgdGV4dDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IHBvc2l0aW9uczogUmVhZG9ubHlNYXA8bnVtYmVyLCBQb3NpdGlvbj47XG5cblx0Y29uc3RydWN0b3Ioc3JjOiBzdHJpbmcpIHtcblx0XHRjb25zdCBudW1iZXJzID0gWydcdTIwNzAnLCAnXHUwMEI5JywgJ1x1MDBCMicsICdcdTAwQjMnLCAnXHUyMDc0JywgJ1x1MjA3NScsICdcdTIwNzYnLCAnXHUyMDc3JywgJ1x1MjA3OCcsICdcdTIwNzknXTtcblxuXHRcdGxldCB0ZXh0ID0gJyc7XG5cdFx0Y29uc3Qgb2Zmc2V0UG9zaXRpb25zID0gbmV3IE1hcDxudW1iZXIsIG51bWJlcj4oKTtcblxuXHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc3JjLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBpZHggPSBudW1iZXJzLmluZGV4T2Yoc3JjW2ldKTtcblx0XHRcdGlmIChpZHggPj0gMCkge1xuXHRcdFx0XHRvZmZzZXRQb3NpdGlvbnMuc2V0KGlkeCwgb2Zmc2V0KTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRleHQgKz0gc3JjW2ldO1xuXHRcdFx0XHRvZmZzZXQrKztcblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLnRleHQgPSB0ZXh0O1xuXG5cdFx0Y29uc3QgbWFwcGVyID0gbmV3IFBvc2l0aW9uT2Zmc2V0VHJhbnNmb3JtZXIodGhpcy50ZXh0KTtcblx0XHRjb25zdCBwb3NpdGlvbnMgPSBuZXcgTWFwPG51bWJlciwgUG9zaXRpb24+KCk7XG5cdFx0Zm9yIChjb25zdCBbaWR4LCBvZmZzZXRdIG9mIG9mZnNldFBvc2l0aW9ucy5lbnRyaWVzKCkpIHtcblx0XHRcdHBvc2l0aW9ucy5zZXQoaWR4LCBtYXBwZXIuZ2V0UG9zaXRpb24ob2Zmc2V0KSk7XG5cdFx0fVxuXHRcdHRoaXMucG9zaXRpb25zID0gcG9zaXRpb25zO1xuXHR9XG5cblx0cmFuZ2Uoc3RhcnQ6IG51bWJlciwgZW5kOiBudW1iZXIpOiBSYW5nZSB7XG5cdFx0cmV0dXJuIFJhbmdlLmZyb21Qb3NpdGlvbnModGhpcy5wb3NpdGlvbnMuZ2V0KHN0YXJ0KSEsIHRoaXMucG9zaXRpb25zLmdldChlbmQpISk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUEwQix1QkFBdUI7QUFDakQsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUNBQXFDO0FBRzlDLFNBQVMsV0FBVyx5QkFBeUI7QUFDN0MsU0FBUyxxQkFBcUIsNEJBQTRCO0FBRTFELE1BQU0sbURBQW1ELE1BQU07QUFFOUQsMENBQXdDO0FBRXhDLFdBQVMseUNBQXlDLE9BQXdCLE1BQXlCO0FBQ2xHLFVBQU0sYUFBYTtBQUNuQixVQUFNLHVCQUF1QixvQkFBb0IsS0FBSztBQUN0RCxVQUFNLCtCQUErQixxQkFBcUIsSUFBSSw2QkFBNkI7QUFDM0YsVUFBTSxrQkFBa0IscUJBQXFCLElBQUksZ0JBQWdCO0FBQ2pFLFVBQU0sSUFBSSxnQkFBZ0IsaUJBQWlCO0FBQUEsTUFDMUMsSUFBSTtBQUFBLElBQ0wsQ0FBQyxDQUFDO0FBRUYsVUFBTSxlQUFlLGdCQUFnQixnQkFBZ0IsaUJBQWlCLFVBQVU7QUFDaEYsVUFBTSxXQUFXLElBQUksa0JBQWtCO0FBQUEsTUFDdEMsSUFBSSxVQUFVLE1BQU0sY0FBYyxrQkFBa0IsT0FBTyxJQUFJO0FBQUEsSUFDaEUsQ0FBQztBQUNELFVBQU0sSUFBSSxxQkFBcUIsU0FBUyxZQUFZLFNBQVMsdUJBQXVCLENBQUMsQ0FBQztBQUV0RixVQUFNLElBQUksNkJBQTZCLFNBQVMsWUFBWTtBQUFBLE1BQzNELFVBQVU7QUFBQSxR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QUssQ0FBQztBQUNwQyxhQUFTLElBQUksR0FBRyxJQUFJLEtBQUssUUFBUSxLQUFLO0FBQ3JDLFVBQUksS0FBSyxPQUFPLENBQUMsTUFBTSxNQUFNO0FBQzVCLGFBQUsseUJBQXlCLEtBQUssSUFBSSxDQUFDO0FBQUEsTUFDekM7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsVUFBVSxVQUE0QjtBQUNyQyxXQUFPLEtBQUsseUJBQXlCLFNBQVMsYUFBYSxDQUFDLElBQUksU0FBUyxTQUFTO0FBQUEsRUFDbkY7QUFBQSxFQUVBLFlBQVksUUFBMEI7QUFDckMsVUFBTSxhQUFhLEtBQUsseUJBQXlCLFVBQVUscUJBQW1CLG1CQUFtQixNQUFNO0FBQ3ZHLFdBQU8sSUFBSSxTQUFTLGFBQWEsR0FBRyxTQUFTLEtBQUsseUJBQXlCLFVBQVUsSUFBSSxDQUFDO0FBQUEsRUFDM0Y7QUFDRDtBQUVBLE1BQU0sa0JBQWtCO0FBQUEsRUFJdkIsWUFBWSxLQUFhO0FBQ3hCLFVBQU0sVUFBVSxDQUFDLFVBQUssUUFBSyxRQUFLLFFBQUssVUFBSyxVQUFLLFVBQUssVUFBSyxVQUFLLFFBQUc7QUFFakUsUUFBSSxPQUFPO0FBQ1gsVUFBTSxrQkFBa0Isb0JBQUksSUFBb0I7QUFFaEQsUUFBSSxTQUFTO0FBQ2IsYUFBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSztBQUNwQyxZQUFNLE1BQU0sUUFBUSxRQUFRLElBQUksQ0FBQyxDQUFDO0FBQ2xDLFVBQUksT0FBTyxHQUFHO0FBQ2Isd0JBQWdCLElBQUksS0FBSyxNQUFNO0FBQUEsTUFDaEMsT0FBTztBQUNOLGdCQUFRLElBQUksQ0FBQztBQUNiO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxTQUFLLE9BQU87QUFFWixVQUFNLFNBQVMsSUFBSSwwQkFBMEIsS0FBSyxJQUFJO0FBQ3RELFVBQU0sWUFBWSxvQkFBSSxJQUFzQjtBQUM1QyxlQUFXLENBQUMsS0FBS0EsT0FBTSxLQUFLLGdCQUFnQixRQUFRLEdBQUc7QUFDdEQsZ0JBQVUsSUFBSSxLQUFLLE9BQU8sWUFBWUEsT0FBTSxDQUFDO0FBQUEsSUFDOUM7QUFDQSxTQUFLLFlBQVk7QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBTSxPQUFlLEtBQW9CO0FBQ3hDLFdBQU8sTUFBTSxjQUFjLEtBQUssVUFBVSxJQUFJLEtBQUssR0FBSSxLQUFLLFVBQVUsSUFBSSxHQUFHLENBQUU7QUFBQSxFQUNoRjtBQUNEOyIsCiAgIm5hbWVzIjogWyJvZmZzZXQiXQp9Cg==
