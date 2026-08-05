import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { MetadataConsts, StandardTokenType } from "../../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../../common/languages.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { LanguageAgnosticBracketTokens } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/brackets.js";
import { lengthAdd, lengthsToRange, lengthZero } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/length.js";
import { DenseKeyProvider } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/smallImmutableSet.js";
import { TextBufferTokenizer, TokenKind } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/tokenizer.js";
import { createModelServices, instantiateTextModel } from "../../testTextModel.js";
suite("Bracket Pair Colorizer - Tokenizer", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Basic", () => {
    const mode1 = "testMode1";
    const disposableStore = new DisposableStore();
    const instantiationService = createModelServices(disposableStore);
    const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    disposableStore.add(languageService.registerLanguage({ id: mode1 }));
    const encodedMode1 = languageService.languageIdCodec.encodeLanguageId(mode1);
    const denseKeyProvider = new DenseKeyProvider();
    const tStandard = (text) => new TokenInfo(text, encodedMode1, StandardTokenType.Other, true);
    const tComment = (text) => new TokenInfo(text, encodedMode1, StandardTokenType.Comment, true);
    const document = new TokenizedDocument([
      tStandard(" { } "),
      tStandard("be"),
      tStandard("gin end"),
      tStandard("\n"),
      tStandard("hello"),
      tComment("{"),
      tStandard("}")
    ]);
    disposableStore.add(TokenizationRegistry.register(mode1, document.getTokenizationSupport()));
    disposableStore.add(languageConfigurationService.register(mode1, {
      brackets: [["{", "}"], ["[", "]"], ["(", ")"], ["begin", "end"]]
    }));
    const model = disposableStore.add(instantiateTextModel(instantiationService, document.getText(), mode1));
    model.tokenization.forceTokenization(model.getLineCount());
    const brackets = new LanguageAgnosticBracketTokens(denseKeyProvider, (l) => languageConfigurationService.getLanguageConfiguration(l));
    const tokens = readAllTokens(new TextBufferTokenizer(model, brackets));
    assert.deepStrictEqual(toArr(tokens, model, denseKeyProvider), [
      { text: " ", bracketId: null, bracketIds: [], kind: "Text" },
      {
        text: "{",
        bracketId: "testMode1:::{",
        bracketIds: ["testMode1:::{"],
        kind: "OpeningBracket"
      },
      { text: " ", bracketId: null, bracketIds: [], kind: "Text" },
      {
        text: "}",
        bracketId: "testMode1:::{",
        bracketIds: ["testMode1:::{"],
        kind: "ClosingBracket"
      },
      { text: " ", bracketId: null, bracketIds: [], kind: "Text" },
      {
        text: "begin",
        bracketId: "testMode1:::begin",
        bracketIds: ["testMode1:::begin"],
        kind: "OpeningBracket"
      },
      { text: " ", bracketId: null, bracketIds: [], kind: "Text" },
      {
        text: "end",
        bracketId: "testMode1:::begin",
        bracketIds: ["testMode1:::begin"],
        kind: "ClosingBracket"
      },
      { text: "\nhello{", bracketId: null, bracketIds: [], kind: "Text" },
      {
        text: "}",
        bracketId: "testMode1:::{",
        bracketIds: ["testMode1:::{"],
        kind: "ClosingBracket"
      }
    ]);
    disposableStore.dispose();
  });
});
function readAllTokens(tokenizer) {
  const tokens = new Array();
  while (true) {
    const token = tokenizer.read();
    if (!token) {
      break;
    }
    tokens.push(token);
  }
  return tokens;
}
function toArr(tokens, model, keyProvider) {
  const result = new Array();
  let offset = lengthZero;
  for (const token of tokens) {
    result.push(tokenToObj(token, offset, model, keyProvider));
    offset = lengthAdd(offset, token.length);
  }
  return result;
}
function tokenToObj(token, offset, model, keyProvider) {
  return {
    text: model.getValueInRange(lengthsToRange(offset, lengthAdd(offset, token.length))),
    bracketId: keyProvider.reverseLookup(token.bracketId) || null,
    bracketIds: keyProvider.reverseLookupSet(token.bracketIds),
    kind: {
      [TokenKind.ClosingBracket]: "ClosingBracket",
      [TokenKind.OpeningBracket]: "OpeningBracket",
      [TokenKind.Text]: "Text"
    }[token.kind]
  };
}
class TokenizedDocument {
  constructor(tokens) {
    const tokensByLine = new Array();
    let curLine = new Array();
    for (const token of tokens) {
      const lines = token.text.split("\n");
      let first = true;
      while (lines.length > 0) {
        if (!first) {
          tokensByLine.push(curLine);
          curLine = new Array();
        } else {
          first = false;
        }
        if (lines[0].length > 0) {
          curLine.push(token.withText(lines[0]));
        }
        lines.pop();
      }
    }
    tokensByLine.push(curLine);
    this.tokensByLine = tokensByLine;
  }
  getText() {
    return this.tokensByLine.map((t) => t.map((t2) => t2.text).join("")).join("\n");
  }
  getTokenizationSupport() {
    class State {
      constructor(lineNumber) {
        this.lineNumber = lineNumber;
      }
      clone() {
        return new State(this.lineNumber);
      }
      equals(other) {
        return this.lineNumber === other.lineNumber;
      }
    }
    return {
      getInitialState: () => new State(0),
      tokenize: () => {
        throw new Error("Method not implemented.");
      },
      tokenizeEncoded: (line, hasEOL, state) => {
        const state2 = state;
        const tokens = this.tokensByLine[state2.lineNumber];
        const arr = new Array();
        let offset = 0;
        for (const t of tokens) {
          arr.push(offset, t.getMetadata());
          offset += t.text.length;
        }
        return new EncodedTokenizationResult(new Uint32Array(arr), new State(state2.lineNumber + 1));
      }
    };
  }
}
class TokenInfo {
  constructor(text, languageId, tokenType, hasBalancedBrackets) {
    this.text = text;
    this.languageId = languageId;
    this.tokenType = tokenType;
    this.hasBalancedBrackets = hasBalancedBrackets;
  }
  getMetadata() {
    return (this.languageId << MetadataConsts.LANGUAGEID_OFFSET | this.tokenType << MetadataConsts.TOKEN_TYPE_OFFSET) >>> 0 | (this.hasBalancedBrackets ? MetadataConsts.BALANCED_BRACKETS_MASK : 0);
  }
  withText(text) {
    return new TokenInfo(text, this.languageId, this.tokenType, this.hasBalancedBrackets);
  }
}
export {
  TokenInfo,
  TokenizedDocument
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvYnJhY2tldFBhaXJDb2xvcml6ZXIvdG9rZW5pemVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUlkLCBNZXRhZGF0YUNvbnN0cywgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0LCBJU3RhdGUsIElUb2tlbml6YXRpb25TdXBwb3J0LCBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IExhbmd1YWdlQWdub3N0aWNCcmFja2V0VG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9icmFja2V0cy5qcyc7XG5pbXBvcnQgeyBMZW5ndGgsIGxlbmd0aEFkZCwgbGVuZ3Roc1RvUmFuZ2UsIGxlbmd0aFplcm8gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvYnJhY2tldFBhaXJzVGV4dE1vZGVsUGFydC9icmFja2V0UGFpcnNUcmVlL2xlbmd0aC5qcyc7XG5pbXBvcnQgeyBEZW5zZUtleVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9zbWFsbEltbXV0YWJsZVNldC5qcyc7XG5pbXBvcnQgeyBUZXh0QnVmZmVyVG9rZW5pemVyLCBUb2tlbiwgVG9rZW5pemVyLCBUb2tlbktpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvYnJhY2tldFBhaXJzVGV4dE1vZGVsUGFydC9icmFja2V0UGFpcnNUcmVlL3Rva2VuaXplci5qcyc7XG5pbXBvcnQgeyBUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IGNyZWF0ZU1vZGVsU2VydmljZXMsIGluc3RhbnRpYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vdGVzdFRleHRNb2RlbC5qcyc7XG5cbnN1aXRlKCdCcmFja2V0IFBhaXIgQ29sb3JpemVyIC0gVG9rZW5pemVyJywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ0Jhc2ljJywgKCkgPT4ge1xuXHRcdGNvbnN0IG1vZGUxID0gJ3Rlc3RNb2RlMSc7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlU3RvcmUpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlU3RvcmUuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IG1vZGUxIH0pKTtcblx0XHRjb25zdCBlbmNvZGVkTW9kZTEgPSBsYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobW9kZTEpO1xuXG5cdFx0Y29uc3QgZGVuc2VLZXlQcm92aWRlciA9IG5ldyBEZW5zZUtleVByb3ZpZGVyPHN0cmluZz4oKTtcblxuXHRcdGNvbnN0IHRTdGFuZGFyZCA9ICh0ZXh0OiBzdHJpbmcpID0+IG5ldyBUb2tlbkluZm8odGV4dCwgZW5jb2RlZE1vZGUxLCBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciwgdHJ1ZSk7XG5cdFx0Y29uc3QgdENvbW1lbnQgPSAodGV4dDogc3RyaW5nKSA9PiBuZXcgVG9rZW5JbmZvKHRleHQsIGVuY29kZWRNb2RlMSwgU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCwgdHJ1ZSk7XG5cdFx0Y29uc3QgZG9jdW1lbnQgPSBuZXcgVG9rZW5pemVkRG9jdW1lbnQoW1xuXHRcdFx0dFN0YW5kYXJkKCcgeyB9ICcpLCB0U3RhbmRhcmQoJ2JlJyksIHRTdGFuZGFyZCgnZ2luIGVuZCcpLCB0U3RhbmRhcmQoJ1xcbicpLFxuXHRcdFx0dFN0YW5kYXJkKCdoZWxsbycpLCB0Q29tbWVudCgneycpLCB0U3RhbmRhcmQoJ30nKSxcblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQoVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIobW9kZTEsIGRvY3VtZW50LmdldFRva2VuaXphdGlvblN1cHBvcnQoKSkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3Rlcihtb2RlMSwge1xuXHRcdFx0YnJhY2tldHM6IFtbJ3snLCAnfSddLCBbJ1snLCAnXSddLCBbJygnLCAnKSddLCBbJ2JlZ2luJywgJ2VuZCddXSxcblx0XHR9KSk7XG5cblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVTdG9yZS5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGRvY3VtZW50LmdldFRleHQoKSwgbW9kZTEpKTtcblx0XHRtb2RlbC50b2tlbml6YXRpb24uZm9yY2VUb2tlbml6YXRpb24obW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXG5cdFx0Y29uc3QgYnJhY2tldHMgPSBuZXcgTGFuZ3VhZ2VBZ25vc3RpY0JyYWNrZXRUb2tlbnMoZGVuc2VLZXlQcm92aWRlciwgbCA9PiBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihsKSk7XG5cblx0XHRjb25zdCB0b2tlbnMgPSByZWFkQWxsVG9rZW5zKG5ldyBUZXh0QnVmZmVyVG9rZW5pemVyKG1vZGVsLCBicmFja2V0cykpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b0Fycih0b2tlbnMsIG1vZGVsLCBkZW5zZUtleVByb3ZpZGVyKSwgW1xuXHRcdFx0eyB0ZXh0OiAnICcsIGJyYWNrZXRJZDogbnVsbCwgYnJhY2tldElkczogW10sIGtpbmQ6ICdUZXh0JyB9LFxuXHRcdFx0e1xuXHRcdFx0XHR0ZXh0OiAneycsXG5cdFx0XHRcdGJyYWNrZXRJZDogJ3Rlc3RNb2RlMTo6OnsnLFxuXHRcdFx0XHRicmFja2V0SWRzOiBbJ3Rlc3RNb2RlMTo6OnsnXSxcblx0XHRcdFx0a2luZDogJ09wZW5pbmdCcmFja2V0Jyxcblx0XHRcdH0sXG5cdFx0XHR7IHRleHQ6ICcgJywgYnJhY2tldElkOiBudWxsLCBicmFja2V0SWRzOiBbXSwga2luZDogJ1RleHQnIH0sXG5cdFx0XHR7XG5cdFx0XHRcdHRleHQ6ICd9Jyxcblx0XHRcdFx0YnJhY2tldElkOiAndGVzdE1vZGUxOjo6eycsXG5cdFx0XHRcdGJyYWNrZXRJZHM6IFsndGVzdE1vZGUxOjo6eyddLFxuXHRcdFx0XHRraW5kOiAnQ2xvc2luZ0JyYWNrZXQnLFxuXHRcdFx0fSxcblx0XHRcdHsgdGV4dDogJyAnLCBicmFja2V0SWQ6IG51bGwsIGJyYWNrZXRJZHM6IFtdLCBraW5kOiAnVGV4dCcgfSxcblx0XHRcdHtcblx0XHRcdFx0dGV4dDogJ2JlZ2luJyxcblx0XHRcdFx0YnJhY2tldElkOiAndGVzdE1vZGUxOjo6YmVnaW4nLFxuXHRcdFx0XHRicmFja2V0SWRzOiBbJ3Rlc3RNb2RlMTo6OmJlZ2luJ10sXG5cdFx0XHRcdGtpbmQ6ICdPcGVuaW5nQnJhY2tldCcsXG5cdFx0XHR9LFxuXHRcdFx0eyB0ZXh0OiAnICcsIGJyYWNrZXRJZDogbnVsbCwgYnJhY2tldElkczogW10sIGtpbmQ6ICdUZXh0JyB9LFxuXHRcdFx0e1xuXHRcdFx0XHR0ZXh0OiAnZW5kJyxcblx0XHRcdFx0YnJhY2tldElkOiAndGVzdE1vZGUxOjo6YmVnaW4nLFxuXHRcdFx0XHRicmFja2V0SWRzOiBbJ3Rlc3RNb2RlMTo6OmJlZ2luJ10sXG5cdFx0XHRcdGtpbmQ6ICdDbG9zaW5nQnJhY2tldCcsXG5cdFx0XHR9LFxuXHRcdFx0eyB0ZXh0OiAnXFxuaGVsbG97JywgYnJhY2tldElkOiBudWxsLCBicmFja2V0SWRzOiBbXSwga2luZDogJ1RleHQnIH0sXG5cdFx0XHR7XG5cdFx0XHRcdHRleHQ6ICd9Jyxcblx0XHRcdFx0YnJhY2tldElkOiAndGVzdE1vZGUxOjo6eycsXG5cdFx0XHRcdGJyYWNrZXRJZHM6IFsndGVzdE1vZGUxOjo6eyddLFxuXHRcdFx0XHRraW5kOiAnQ2xvc2luZ0JyYWNrZXQnLFxuXHRcdFx0fSxcblx0XHRdKTtcblxuXHRcdGRpc3Bvc2FibGVTdG9yZS5kaXNwb3NlKCk7XG5cdH0pO1xufSk7XG5cbmZ1bmN0aW9uIHJlYWRBbGxUb2tlbnModG9rZW5pemVyOiBUb2tlbml6ZXIpOiBUb2tlbltdIHtcblx0Y29uc3QgdG9rZW5zID0gbmV3IEFycmF5PFRva2VuPigpO1xuXHR3aGlsZSAodHJ1ZSkge1xuXHRcdGNvbnN0IHRva2VuID0gdG9rZW5pemVyLnJlYWQoKTtcblx0XHRpZiAoIXRva2VuKSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cdFx0dG9rZW5zLnB1c2godG9rZW4pO1xuXHR9XG5cdHJldHVybiB0b2tlbnM7XG59XG5cbmZ1bmN0aW9uIHRvQXJyKHRva2VuczogVG9rZW5bXSwgbW9kZWw6IFRleHRNb2RlbCwga2V5UHJvdmlkZXI6IERlbnNlS2V5UHJvdmlkZXI8c3RyaW5nPik6IGFueVtdIHtcblx0Y29uc3QgcmVzdWx0ID0gbmV3IEFycmF5PGFueT4oKTtcblx0bGV0IG9mZnNldCA9IGxlbmd0aFplcm87XG5cdGZvciAoY29uc3QgdG9rZW4gb2YgdG9rZW5zKSB7XG5cdFx0cmVzdWx0LnB1c2godG9rZW5Ub09iaih0b2tlbiwgb2Zmc2V0LCBtb2RlbCwga2V5UHJvdmlkZXIpKTtcblx0XHRvZmZzZXQgPSBsZW5ndGhBZGQob2Zmc2V0LCB0b2tlbi5sZW5ndGgpO1xuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmZ1bmN0aW9uIHRva2VuVG9PYmoodG9rZW46IFRva2VuLCBvZmZzZXQ6IExlbmd0aCwgbW9kZWw6IFRleHRNb2RlbCwga2V5UHJvdmlkZXI6IERlbnNlS2V5UHJvdmlkZXI8YW55Pik6IGFueSB7XG5cdHJldHVybiB7XG5cdFx0dGV4dDogbW9kZWwuZ2V0VmFsdWVJblJhbmdlKGxlbmd0aHNUb1JhbmdlKG9mZnNldCwgbGVuZ3RoQWRkKG9mZnNldCwgdG9rZW4ubGVuZ3RoKSkpLFxuXHRcdGJyYWNrZXRJZDoga2V5UHJvdmlkZXIucmV2ZXJzZUxvb2t1cCh0b2tlbi5icmFja2V0SWQpIHx8IG51bGwsXG5cdFx0YnJhY2tldElkczoga2V5UHJvdmlkZXIucmV2ZXJzZUxvb2t1cFNldCh0b2tlbi5icmFja2V0SWRzKSxcblx0XHRraW5kOiB7XG5cdFx0XHRbVG9rZW5LaW5kLkNsb3NpbmdCcmFja2V0XTogJ0Nsb3NpbmdCcmFja2V0Jyxcblx0XHRcdFtUb2tlbktpbmQuT3BlbmluZ0JyYWNrZXRdOiAnT3BlbmluZ0JyYWNrZXQnLFxuXHRcdFx0W1Rva2VuS2luZC5UZXh0XTogJ1RleHQnLFxuXHRcdH1bdG9rZW4ua2luZF1cblx0fTtcbn1cblxuZXhwb3J0IGNsYXNzIFRva2VuaXplZERvY3VtZW50IHtcblx0cHJpdmF0ZSByZWFkb25seSB0b2tlbnNCeUxpbmU6IHJlYWRvbmx5IFRva2VuSW5mb1tdW107XG5cdGNvbnN0cnVjdG9yKHRva2VuczogVG9rZW5JbmZvW10pIHtcblx0XHRjb25zdCB0b2tlbnNCeUxpbmUgPSBuZXcgQXJyYXk8VG9rZW5JbmZvW10+KCk7XG5cdFx0bGV0IGN1ckxpbmUgPSBuZXcgQXJyYXk8VG9rZW5JbmZvPigpO1xuXG5cdFx0Zm9yIChjb25zdCB0b2tlbiBvZiB0b2tlbnMpIHtcblx0XHRcdGNvbnN0IGxpbmVzID0gdG9rZW4udGV4dC5zcGxpdCgnXFxuJyk7XG5cdFx0XHRsZXQgZmlyc3QgPSB0cnVlO1xuXHRcdFx0d2hpbGUgKGxpbmVzLmxlbmd0aCA+IDApIHtcblx0XHRcdFx0aWYgKCFmaXJzdCkge1xuXHRcdFx0XHRcdHRva2Vuc0J5TGluZS5wdXNoKGN1ckxpbmUpO1xuXHRcdFx0XHRcdGN1ckxpbmUgPSBuZXcgQXJyYXk8VG9rZW5JbmZvPigpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGZpcnN0ID0gZmFsc2U7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAobGluZXNbMF0ubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGN1ckxpbmUucHVzaCh0b2tlbi53aXRoVGV4dChsaW5lc1swXSkpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGxpbmVzLnBvcCgpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRva2Vuc0J5TGluZS5wdXNoKGN1ckxpbmUpO1xuXG5cdFx0dGhpcy50b2tlbnNCeUxpbmUgPSB0b2tlbnNCeUxpbmU7XG5cdH1cblxuXHRnZXRUZXh0KCkge1xuXHRcdHJldHVybiB0aGlzLnRva2Vuc0J5TGluZS5tYXAodCA9PiB0Lm1hcCh0ID0+IHQudGV4dCkuam9pbignJykpLmpvaW4oJ1xcbicpO1xuXHR9XG5cblx0Z2V0VG9rZW5pemF0aW9uU3VwcG9ydCgpOiBJVG9rZW5pemF0aW9uU3VwcG9ydCB7XG5cdFx0Y2xhc3MgU3RhdGUgaW1wbGVtZW50cyBJU3RhdGUge1xuXHRcdFx0Y29uc3RydWN0b3IocHVibGljIHJlYWRvbmx5IGxpbmVOdW1iZXI6IG51bWJlcikgeyB9XG5cblx0XHRcdGNsb25lKCk6IElTdGF0ZSB7XG5cdFx0XHRcdHJldHVybiBuZXcgU3RhdGUodGhpcy5saW5lTnVtYmVyKTtcblx0XHRcdH1cblxuXHRcdFx0ZXF1YWxzKG90aGVyOiBJU3RhdGUpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMubGluZU51bWJlciA9PT0gKG90aGVyIGFzIFN0YXRlKS5saW5lTnVtYmVyO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRnZXRJbml0aWFsU3RhdGU6ICgpID0+IG5ldyBTdGF0ZSgwKSxcblx0XHRcdHRva2VuaXplOiAoKSA9PiB7IHRocm93IG5ldyBFcnJvcignTWV0aG9kIG5vdCBpbXBsZW1lbnRlZC4nKTsgfSxcblx0XHRcdHRva2VuaXplRW5jb2RlZDogKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBzdGF0ZTogSVN0YXRlKTogRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCA9PiB7XG5cdFx0XHRcdGNvbnN0IHN0YXRlMiA9IHN0YXRlIGFzIFN0YXRlO1xuXHRcdFx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLnRva2Vuc0J5TGluZVtzdGF0ZTIubGluZU51bWJlcl07XG5cdFx0XHRcdGNvbnN0IGFyciA9IG5ldyBBcnJheTxudW1iZXI+KCk7XG5cdFx0XHRcdGxldCBvZmZzZXQgPSAwO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHQgb2YgdG9rZW5zKSB7XG5cdFx0XHRcdFx0YXJyLnB1c2gob2Zmc2V0LCB0LmdldE1ldGFkYXRhKCkpO1xuXHRcdFx0XHRcdG9mZnNldCArPSB0LnRleHQubGVuZ3RoO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KG5ldyBVaW50MzJBcnJheShhcnIpLCBuZXcgU3RhdGUoc3RhdGUyLmxpbmVOdW1iZXIgKyAxKSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgVG9rZW5JbmZvIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IHRleHQ6IHN0cmluZyxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ3VhZ2VJZDogTGFuZ3VhZ2VJZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgaGFzQmFsYW5jZWRCcmFja2V0czogYm9vbGVhbixcblx0KSB7IH1cblxuXHRnZXRNZXRhZGF0YSgpOiBudW1iZXIge1xuXHRcdHJldHVybiAoXG5cdFx0XHQoKCh0aGlzLmxhbmd1YWdlSWQgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpIHxcblx0XHRcdFx0KHRoaXMudG9rZW5UeXBlIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKSkgPj4+XG5cdFx0XHRcdDApIHxcblx0XHRcdCh0aGlzLmhhc0JhbGFuY2VkQnJhY2tldHMgPyBNZXRhZGF0YUNvbnN0cy5CQUxBTkNFRF9CUkFDS0VUU19NQVNLIDogMClcblx0XHQpO1xuXHR9XG5cblx0d2l0aFRleHQodGV4dDogc3RyaW5nKTogVG9rZW5JbmZvIHtcblx0XHRyZXR1cm4gbmV3IFRva2VuSW5mbyh0ZXh0LCB0aGlzLmxhbmd1YWdlSWQsIHRoaXMudG9rZW5UeXBlLCB0aGlzLmhhc0JhbGFuY2VkQnJhY2tldHMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywrQ0FBK0M7QUFDeEQsU0FBcUIsZ0JBQWdCLHlCQUF5QjtBQUM5RCxTQUFTLDJCQUF5RCw0QkFBNEI7QUFDOUYsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBaUIsV0FBVyxnQkFBZ0Isa0JBQWtCO0FBQzlELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMscUJBQXVDLGlCQUFpQjtBQUVqRSxTQUFTLHFCQUFxQiw0QkFBNEI7QUFFMUQsTUFBTSxzQ0FBc0MsTUFBTTtBQUVqRCwwQ0FBd0M7QUFFeEMsT0FBSyxTQUFTLE1BQU07QUFDbkIsVUFBTSxRQUFRO0FBQ2QsVUFBTSxrQkFBa0IsSUFBSSxnQkFBZ0I7QUFDNUMsVUFBTSx1QkFBdUIsb0JBQW9CLGVBQWU7QUFDaEUsVUFBTSwrQkFBK0IscUJBQXFCLElBQUksNkJBQTZCO0FBQzNGLFVBQU0sa0JBQWtCLHFCQUFxQixJQUFJLGdCQUFnQjtBQUNqRSxvQkFBZ0IsSUFBSSxnQkFBZ0IsaUJBQWlCLEVB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
