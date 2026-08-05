import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { LanguageAgnosticBracketTokens } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/brackets.js";
import { SmallImmutableSet, DenseKeyProvider } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/smallImmutableSet.js";
import { TokenKind } from "../../../../common/model/bracketPairsTextModelPart/bracketPairsTree/tokenizer.js";
import { TestLanguageConfigurationService } from "../../modes/testLanguageConfigurationService.js";
suite("Bracket Pair Colorizer - Brackets", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("Basic", () => {
    const languageId = "testMode1";
    const denseKeyProvider = new DenseKeyProvider();
    const getImmutableSet = (elements) => {
      let newSet = SmallImmutableSet.getEmpty();
      elements.forEach((x) => newSet = newSet.add(`${languageId}:::${x}`, denseKeyProvider));
      return newSet;
    };
    const getKey = (value) => {
      return denseKeyProvider.getKey(`${languageId}:::${value}`);
    };
    const disposableStore = new DisposableStore();
    const languageConfigService = disposableStore.add(new TestLanguageConfigurationService());
    disposableStore.add(languageConfigService.register(languageId, {
      brackets: [
        ["{", "}"],
        ["[", "]"],
        ["(", ")"],
        ["begin", "end"],
        ["case", "endcase"],
        ["casez", "endcase"],
        // Verilog
        ["\\left(", "\\right)"],
        ["\\left(", "\\right."],
        ["\\left.", "\\right)"],
        // LaTeX Parentheses
        ["\\left[", "\\right]"],
        ["\\left[", "\\right."],
        ["\\left.", "\\right]"]
        // LaTeX Brackets
      ]
    }));
    const brackets = new LanguageAgnosticBracketTokens(denseKeyProvider, (l) => languageConfigService.getLanguageConfiguration(l));
    const bracketsExpected = [
      { text: "{", length: 1, kind: "OpeningBracket", bracketId: getKey("{"), bracketIds: getImmutableSet(["{"]) },
      { text: "[", length: 1, kind: "OpeningBracket", bracketId: getKey("["), bracketIds: getImmutableSet(["["]) },
      { text: "(", length: 1, kind: "OpeningBracket", bracketId: getKey("("), bracketIds: getImmutableSet(["("]) },
      { text: "begin", length: 5, kind: "OpeningBracket", bracketId: getKey("begin"), bracketIds: getImmutableSet(["begin"]) },
      { text: "case", length: 4, kind: "OpeningBracket", bracketId: getKey("case"), bracketIds: getImmutableSet(["case"]) },
      { text: "casez", length: 5, kind: "OpeningBracket", bracketId: getKey("casez"), bracketIds: getImmutableSet(["casez"]) },
      { text: "\\left(", length: 6, kind: "OpeningBracket", bracketId: getKey("\\left("), bracketIds: getImmutableSet(["\\left("]) },
      { text: "\\left.", length: 6, kind: "OpeningBracket", bracketId: getKey("\\left."), bracketIds: getImmutableSet(["\\left."]) },
      { text: "\\left[", length: 6, kind: "OpeningBracket", bracketId: getKey("\\left["), bracketIds: getImmutableSet(["\\left["]) },
      { text: "}", length: 1, kind: "ClosingBracket", bracketId: getKey("{"), bracketIds: getImmutableSet(["{"]) },
      { text: "]", length: 1, kind: "ClosingBracket", bracketId: getKey("["), bracketIds: getImmutableSet(["["]) },
      { text: ")", length: 1, kind: "ClosingBracket", bracketId: getKey("("), bracketIds: getImmutableSet(["("]) },
      { text: "end", length: 3, kind: "ClosingBracket", bracketId: getKey("begin"), bracketIds: getImmutableSet(["begin"]) },
      { text: "endcase", length: 7, kind: "ClosingBracket", bracketId: getKey("case"), bracketIds: getImmutableSet(["case", "casez"]) },
      { text: "\\right)", length: 7, kind: "ClosingBracket", bracketId: getKey("\\left("), bracketIds: getImmutableSet(["\\left(", "\\left."]) },
      { text: "\\right.", length: 7, kind: "ClosingBracket", bracketId: getKey("\\left("), bracketIds: getImmutableSet(["\\left(", "\\left["]) },
      { text: "\\right]", length: 7, kind: "ClosingBracket", bracketId: getKey("\\left["), bracketIds: getImmutableSet(["\\left[", "\\left."]) }
    ];
    const bracketsActual = bracketsExpected.map((x) => tokenToObject(brackets.getToken(x.text, languageId), x.text));
    assert.deepStrictEqual(bracketsActual, bracketsExpected);
    disposableStore.dispose();
  });
});
function tokenToObject(token, text) {
  if (token === void 0) {
    return void 0;
  }
  return {
    text,
    length: token.length,
    bracketId: token.bracketId,
    bracketIds: token.bracketIds,
    kind: {
      [TokenKind.ClosingBracket]: "ClosingBracket",
      [TokenKind.OpeningBracket]: "OpeningBracket",
      [TokenKind.Text]: "Text"
    }[token.kind]
  };
}
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvdGVzdC9jb21tb24vbW9kZWwvYnJhY2tldFBhaXJDb2xvcml6ZXIvYnJhY2tldHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlQWdub3N0aWNCcmFja2V0VG9rZW5zIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL21vZGVsL2JyYWNrZXRQYWlyc1RleHRNb2RlbFBhcnQvYnJhY2tldFBhaXJzVHJlZS9icmFja2V0cy5qcyc7XG5pbXBvcnQgeyBTbWFsbEltbXV0YWJsZVNldCwgRGVuc2VLZXlQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0L2JyYWNrZXRQYWlyc1RyZWUvc21hbGxJbW11dGFibGVTZXQuanMnO1xuaW1wb3J0IHsgVG9rZW4sIFRva2VuS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9tb2RlbC9icmFja2V0UGFpcnNUZXh0TW9kZWxQYXJ0L2JyYWNrZXRQYWlyc1RyZWUvdG9rZW5pemVyLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuXG5zdWl0ZSgnQnJhY2tldCBQYWlyIENvbG9yaXplciAtIEJyYWNrZXRzJywgKCkgPT4ge1xuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdCYXNpYycsICgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gJ3Rlc3RNb2RlMSc7XG5cdFx0Y29uc3QgZGVuc2VLZXlQcm92aWRlciA9IG5ldyBEZW5zZUtleVByb3ZpZGVyPHN0cmluZz4oKTtcblx0XHRjb25zdCBnZXRJbW11dGFibGVTZXQgPSAoZWxlbWVudHM6IHN0cmluZ1tdKSA9PiB7XG5cdFx0XHRsZXQgbmV3U2V0ID0gU21hbGxJbW11dGFibGVTZXQuZ2V0RW1wdHkoKTtcblx0XHRcdGVsZW1lbnRzLmZvckVhY2goeCA9PiBuZXdTZXQgPSBuZXdTZXQuYWRkKGAke2xhbmd1YWdlSWR9Ojo6JHt4fWAsIGRlbnNlS2V5UHJvdmlkZXIpKTtcblx0XHRcdHJldHVybiBuZXdTZXQ7XG5cdFx0fTtcblx0XHRjb25zdCBnZXRLZXkgPSAodmFsdWU6IHN0cmluZykgPT4ge1xuXHRcdFx0cmV0dXJuIGRlbnNlS2V5UHJvdmlkZXIuZ2V0S2V5KGAke2xhbmd1YWdlSWR9Ojo6JHt2YWx1ZX1gKTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlnU2VydmljZSA9IGRpc3Bvc2FibGVTdG9yZS5hZGQobmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCkpO1xuXHRcdGRpc3Bvc2FibGVTdG9yZS5hZGQobGFuZ3VhZ2VDb25maWdTZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlSWQsIHtcblx0XHRcdGJyYWNrZXRzOiBbXG5cdFx0XHRcdFsneycsICd9J10sIFsnWycsICddJ10sIFsnKCcsICcpJ10sXG5cdFx0XHRcdFsnYmVnaW4nLCAnZW5kJ10sIFsnY2FzZScsICdlbmRjYXNlJ10sIFsnY2FzZXonLCAnZW5kY2FzZSddLFx0XHRcdFx0XHQvLyBWZXJpbG9nXG5cdFx0XHRcdFsnXFxcXGxlZnQoJywgJ1xcXFxyaWdodCknXSwgWydcXFxcbGVmdCgnLCAnXFxcXHJpZ2h0LiddLCBbJ1xcXFxsZWZ0LicsICdcXFxccmlnaHQpJ10sXHRcdC8vIExhVGVYIFBhcmVudGhlc2VzXG5cdFx0XHRcdFsnXFxcXGxlZnRbJywgJ1xcXFxyaWdodF0nXSwgWydcXFxcbGVmdFsnLCAnXFxcXHJpZ2h0LiddLCBbJ1xcXFxsZWZ0LicsICdcXFxccmlnaHRdJ11cdFx0Ly8gTGFUZVggQnJhY2tldHNcblx0XHRcdF1cblx0XHR9KSk7XG5cblx0XHRjb25zdCBicmFja2V0cyA9IG5ldyBMYW5ndWFnZUFnbm9zdGljQnJhY2tldFRva2VucyhkZW5zZUtleVByb3ZpZGVyLCBsID0+IGxhbmd1YWdlQ29uZmlnU2VydmljZS5nZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obCkpO1xuXHRcdGNvbnN0IGJyYWNrZXRzRXhwZWN0ZWQgPSBbXG5cdFx0XHR7IHRleHQ6ICd7JywgbGVuZ3RoOiAxLCBraW5kOiAnT3BlbmluZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgneycpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWyd7J10pIH0sXG5cdFx0XHR7IHRleHQ6ICdbJywgbGVuZ3RoOiAxLCBraW5kOiAnT3BlbmluZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgnWycpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWydbJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICcoJywgbGVuZ3RoOiAxLCBraW5kOiAnT3BlbmluZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgnKCcpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWycoJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdiZWdpbicsIGxlbmd0aDogNSwga2luZDogJ09wZW5pbmdCcmFja2V0JywgYnJhY2tldElkOiBnZXRLZXkoJ2JlZ2luJyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ2JlZ2luJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdjYXNlJywgbGVuZ3RoOiA0LCBraW5kOiAnT3BlbmluZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgnY2FzZScpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWydjYXNlJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdjYXNleicsIGxlbmd0aDogNSwga2luZDogJ09wZW5pbmdCcmFja2V0JywgYnJhY2tldElkOiBnZXRLZXkoJ2Nhc2V6JyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ2Nhc2V6J10pIH0sXG5cdFx0XHR7IHRleHQ6ICdcXFxcbGVmdCgnLCBsZW5ndGg6IDYsIGtpbmQ6ICdPcGVuaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCdcXFxcbGVmdCgnKSwgYnJhY2tldElkczogZ2V0SW1tdXRhYmxlU2V0KFsnXFxcXGxlZnQoJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdcXFxcbGVmdC4nLCBsZW5ndGg6IDYsIGtpbmQ6ICdPcGVuaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCdcXFxcbGVmdC4nKSwgYnJhY2tldElkczogZ2V0SW1tdXRhYmxlU2V0KFsnXFxcXGxlZnQuJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdcXFxcbGVmdFsnLCBsZW5ndGg6IDYsIGtpbmQ6ICdPcGVuaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCdcXFxcbGVmdFsnKSwgYnJhY2tldElkczogZ2V0SW1tdXRhYmxlU2V0KFsnXFxcXGxlZnRbJ10pIH0sXG5cblx0XHRcdHsgdGV4dDogJ30nLCBsZW5ndGg6IDEsIGtpbmQ6ICdDbG9zaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCd7JyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ3snXSkgfSxcblx0XHRcdHsgdGV4dDogJ10nLCBsZW5ndGg6IDEsIGtpbmQ6ICdDbG9zaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCdbJyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ1snXSkgfSxcblx0XHRcdHsgdGV4dDogJyknLCBsZW5ndGg6IDEsIGtpbmQ6ICdDbG9zaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCcoJyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJygnXSkgfSxcblx0XHRcdHsgdGV4dDogJ2VuZCcsIGxlbmd0aDogMywga2luZDogJ0Nsb3NpbmdCcmFja2V0JywgYnJhY2tldElkOiBnZXRLZXkoJ2JlZ2luJyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ2JlZ2luJ10pIH0sXG5cdFx0XHR7IHRleHQ6ICdlbmRjYXNlJywgbGVuZ3RoOiA3LCBraW5kOiAnQ2xvc2luZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgnY2FzZScpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWydjYXNlJywgJ2Nhc2V6J10pIH0sXG5cdFx0XHR7IHRleHQ6ICdcXFxccmlnaHQpJywgbGVuZ3RoOiA3LCBraW5kOiAnQ2xvc2luZ0JyYWNrZXQnLCBicmFja2V0SWQ6IGdldEtleSgnXFxcXGxlZnQoJyksIGJyYWNrZXRJZHM6IGdldEltbXV0YWJsZVNldChbJ1xcXFxsZWZ0KCcsICdcXFxcbGVmdC4nXSkgfSxcblx0XHRcdHsgdGV4dDogJ1xcXFxyaWdodC4nLCBsZW5ndGg6IDcsIGtpbmQ6ICdDbG9zaW5nQnJhY2tldCcsIGJyYWNrZXRJZDogZ2V0S2V5KCdcXFxcbGVmdCgnKSwgYnJhY2tldElkczogZ2V0SW1tdXRhYmxlU2V0KFsnXFxcXGxlZnQoJywgJ1xcXFxsZWZ0WyddKSB9LFxuXHRcdFx0eyB0ZXh0OiAnXFxcXHJpZ2h0XScsIGxlbmd0aDogNywga2luZDogJ0Nsb3NpbmdCcmFja2V0JywgYnJhY2tldElkOiBnZXRLZXkoJ1xcXFxsZWZ0WycpLCBicmFja2V0SWRzOiBnZXRJbW11dGFibGVTZXQoWydcXFxcbGVmdFsnLCAnXFxcXGxlZnQuJ10pIH1cblx0XHRdO1xuXHRcdGNvbnN0IGJyYWNrZXRzQWN0dWFsID0gYnJhY2tldHNFeHBlY3RlZC5tYXAoeCA9PiB0b2tlblRvT2JqZWN0KGJyYWNrZXRzLmdldFRva2VuKHgudGV4dCwgbGFuZ3VhZ2VJZCksIHgudGV4dCkpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChicmFja2V0c0FjdHVhbCwgYnJhY2tldHNFeHBlY3RlZCk7XG5cblx0XHRkaXNwb3NhYmxlU3RvcmUuZGlzcG9zZSgpO1xuXHR9KTtcbn0pO1xuXG5mdW5jdGlvbiB0b2tlblRvT2JqZWN0KHRva2VuOiBUb2tlbiB8IHVuZGVmaW5lZCwgdGV4dDogc3RyaW5nKTogYW55IHtcblx0aWYgKHRva2VuID09PSB1bmRlZmluZWQpIHtcblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cdHJldHVybiB7XG5cdFx0dGV4dDogdGV4dCxcblx0XHRsZW5ndGg6IHRva2VuLmxlbmd0aCxcblx0XHRicmFja2V0SWQ6IHRva2VuLmJyYWNrZXRJZCxcblx0XHRicmFja2V0SWRzOiB0b2tlbi5icmFja2V0SWRzLFxuXHRcdGtpbmQ6IHtcblx0XHRcdFtUb2tlbktpbmQuQ2xvc2luZ0JyYWNrZXRdOiAnQ2xvc2luZ0JyYWNrZXQnLFxuXHRcdFx0W1Rva2VuS2luZC5PcGVuaW5nQnJhY2tldF06ICdPcGVuaW5nQnJhY2tldCcsXG5cdFx0XHRbVG9rZW5LaW5kLlRleHRdOiAnVGV4dCcsXG5cdFx0fVt0b2tlbi5raW5kXSxcblx0fTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLG1CQUFtQix3QkFBd0I7QUFDcEQsU0FBZ0IsaUJBQWlCO0FBQ2pDLFNBQVMsd0NBQXdDO0FBRWpELE1BQU0scUNBQXFDLE1BQU07QUFDaEQsMENBQXdDO0FBRXhDLE9BQUssU0FBUyxNQUFNO0FBQ25CLFVBQU0sYUFBYTtBQUNuQixVQUFNLG1CQUFtQixJQUFJLGlCQUF5QjtBQUN0RCxVQUFNLGtCQUFrQixDQUFDLGFBQXVCO0FBQy9DLFVBQUksU0FBUyxrQkFBa0IsU0FBUztBQUN4QyxlQUFTLFFBQVEsT0FBSyxTQUFTLE9BQU8sSUFBSSxHQUFHLFVBQVUsTUFBTSxDQUFDLElBQUksZ0JBQWdCLENBQUM7QUFDbkYsYUFBTztBQUFBLElBQ1I7QUFDQSxVQUFNLFNBQVMsQ0FBQyxVQUFrQjtBQUNqQyxhQUFPLGlCQUFpQixPQUFPLEdBQUcsVUFBVSxNQUFNLEtBQUssRUFBRTtBQUFBLElBQzFEO0FBRUEsVUFBTSxrQkFBa0IsSUFBSSxnQkFBZ0I7QUFDNUMsVUFBTSx3QkFBd0IsZ0JBQWdCLElBQUksSUFBSSxpQ0FBaUMsQ0FBQztBQUN4RixvQkFBZ0IsSUFBSSxzQkFBc0IsU0FBUyxZQUFZO0FBQUEsTUFDOUQsVUFBVTtBQUFBLFFBQ1QsQ0FBQyxLQUFLLEdBQUc7QUFBQSxRQUFHLENBQUMsS0FBSyxHQUFHO0FBQUEsUUFBRyxDQUFDLEtBQUssR0FBRztBQUFBLFFBQ2pDLENBQUMsU0FBUyxLQUFLO0FBQUEsUUFBRyxDQUFDLFFBQVEsU0FBUztBQUFBLFFBQUcsQ0FBQyxTQUFTLFNBQVM7QUFBQTtBQUFBLFFBQzFELENBQUMsV0FBVyxVQUFVO0FBQUEsUUFB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
