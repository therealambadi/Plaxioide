import assert from "assert";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { Event } from "../../../../../base/common/event.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { Position } from "../../../../common/core/position.js";
import { Range } from "../../../../common/core/range.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { IModelService } from "../../../../common/services/model.js";
import { BracketSelectionRangeProvider } from "../../browser/bracketSelections.js";
import { provideSelectionRanges } from "../../browser/smartSelect.js";
import { WordSelectionRangeProvider } from "../../browser/wordSelections.js";
import { createModelServices } from "../../../../test/common/testTextModel.js";
import { javascriptOnEnterRules } from "../../../../test/common/modes/supports/onEnterRules.js";
import { LanguageFeatureRegistry } from "../../../../common/languageFeatureRegistry.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
class StaticLanguageSelector {
  constructor(languageId) {
    this.languageId = languageId;
    this.onDidChange = Event.None;
  }
}
suite("SmartSelect", () => {
  const OriginalBracketSelectionRangeProviderMaxDuration = BracketSelectionRangeProvider._maxDuration;
  suiteSetup(() => {
    BracketSelectionRangeProvider._maxDuration = 5e3;
  });
  suiteTeardown(() => {
    BracketSelectionRangeProvider._maxDuration = OriginalBracketSelectionRangeProviderMaxDuration;
  });
  const languageId = "mockJSMode";
  let disposables;
  let modelService;
  const providers = new LanguageFeatureRegistry();
  setup(() => {
    disposables = new DisposableStore();
    const instantiationService = createModelServices(disposables);
    modelService = instantiationService.get(IModelService);
    const languagConfigurationService = instantiationService.get(ILanguageConfigurationService);
    const languageService = instantiationService.get(ILanguageService);
    disposables.add(languageService.registerLanguage({ id: languageId }));
    disposables.add(languagConfigurationService.register(languageId, {
      brackets: [
        ["(", ")"],
        ["{", "}"],
        ["[", "]"]
      ],
      onEnterRules: javascriptOnEnterRules,
      wordPattern: /(-?\d*\.\d\w*)|([^\`\~\!\@\#\$\%\^\&\*\(\)\=\+\[\{\]\}\\\;\:\'\"\,\.\<\>\/\?\s]+)/g
    }));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  async function assertGetRangesToPosition(text, lineNumber, column, ranges, selectLeadingAndTrailingWhitespace = true) {
    const uri = URI.file("test.js");
    const model = modelService.createModel(text.join("\n"), new StaticLanguageSelector(languageId), uri);
    const [actual] = await provideSelectionRanges(providers, model, [new Position(lineNumber, column)], { selectLeadingAndTrailingWhitespace, selectSubwords: true }, CancellationToken.None);
    const actualStr = actual.map((r) => new Range(r.startLineNumber, r.startColumn, r.endLineNumber, r.endColumn).toString());
    const desiredStr = ranges.reverse().map((r) => String(r));
    assert.deepStrictEqual(actualStr, desiredStr, `
A: ${actualStr} VS 
E: ${desiredStr}`);
    modelService.destroyModel(uri);
  }
  test("getRangesToPosition #1", () => {
    return assertGetRangesToPosition([
      "function a(bar, foo){",
      "	if (bar) {",
      "		return (bar + (2 * foo))",
      "	}",
      "}"
    ], 3, 20, [
      new Range(1, 1, 5, 2),
      // all
      new Range(1, 21, 5, 2),
      // {} outside
      new Range(1, 22, 5, 1),
      // {} inside
      new Range(2, 1, 4, 3),
      // block
      new Range(2, 1, 4, 3),
      new Range(2, 2, 4, 3),
      new Range(2, 11, 4, 3),
      new Range(2, 12, 4, 2),
      new Range(3, 1, 3, 27),
      // line w/ triva
      new Range(3, 3, 3, 27),
      // line w/o triva
      new Range(3, 10, 3, 27),
      // () outside
      new Range(3, 11, 3, 26),
      // () inside
      new Range(3, 17, 3, 26),
      // () outside
      new Range(3, 18, 3, 25)
      // () inside
    ]);
  });
  test("config: selectLeadingAndTrailingWhitespace", async () => {
    await assertGetRangesToPosition([
      "aaa",
      "	bbb",
      ""
    ], 2, 3, [
      new Range(1, 1, 3, 1),
      // all
      new Range(2, 1, 2, 5),
      // line w/ triva
      new Range(2, 2, 2, 5)
      // bbb
    ], true);
    await assertGetRangesToPosition([
      "aaa",
      "	bbb",
      ""
    ], 2, 3, [
      new Range(1, 1, 3, 1),
      // all
      new Range(2, 2, 2, 5)
      // () inside
    ], false);
  });
  test("getRangesToPosition #56886. Skip empty lines correctly.", () => {
    return assertGetRangesToPosition([
      "function a(bar, foo){",
      "	if (bar) {",
      "",
      "	}",
      "}"
    ], 3, 1, [
      new Range(1, 1, 5, 2),
      new Range(1, 21, 5, 2),
      new Range(1, 22, 5, 1),
      new Range(2, 1, 4, 3),
      new Range(2, 1, 4, 3),
      new Range(2, 2, 4, 3),
      new Range(2, 11, 4, 3),
      new Range(2, 12, 4, 2)
    ]);
  });
  test("getRangesToPosition #56886. Do not skip lines with only whitespaces.", () => {
    return assertGetRangesToPosition([
      "function a(bar, foo){",
      "	if (bar) {",
      " ",
      "	}",
      "}"
    ], 3, 1, [
      new Range(1, 1, 5, 2),
      // all
      new Range(1, 21, 5, 2),
      // {} outside
      new Range(1, 22, 5, 1),
      // {} inside
      new Range(2, 1, 4, 3),
      new Range(2, 1, 4, 3),
      new Range(2, 2, 4, 3),
      new Range(2, 11, 4, 3),
      new Range(2, 12, 4, 2),
      new Range(3, 1, 3, 2),
      // block
      new Range(3, 1, 3, 2)
      // empty line
    ]);
  });
  test("getRangesToPosition #40658. Cursor at first position inside brackets should select line inside.", () => {
    return assertGetRangesToPosition([
      " [ ]",
      " { } ",
      "( ) "
    ], 2, 3, [
      new Range(1, 1, 3, 5),
      new Range(2, 1, 2, 6),
      // line w/ triava
      new Range(2, 2, 2, 5),
      // {} inside, line w/o triva
      new Range(2, 3, 2, 4)
      // {} inside
    ]);
  });
  test("getRangesToPosition #40658. Cursor in empty brackets should reveal brackets first.", () => {
    return assertGetRangesToPosition([
      " [] ",
      " { } ",
      "  ( ) "
    ], 1, 3, [
      new Range(1, 1, 3, 7),
      // all
      new Range(1, 1, 1, 5),
      // line w/ trival
      new Range(1, 2, 1, 4),
      // [] outside, line w/o trival
      new Range(1, 3, 1, 3)
      // [] inside
    ]);
  });
  test("getRangesToPosition #40658. Tokens before bracket will be revealed first.", () => {
    return assertGetRangesToPosition([
      "  [] ",
      " { } ",
      "selectthis( ) "
    ], 3, 11, [
      new Range(1, 1, 3, 15),
      // all
      new Range(3, 1, 3, 15),
      // line w/ trivia
      new Range(3, 1, 3, 14),
      // line w/o trivia
      new Range(3, 1, 3, 11)
      // word
    ]);
  });
  async function assertRanges(provider, value, ...expected) {
    const index = value.indexOf("|");
    value = value.replace("|", "");
    const model = modelService.createModel(value, new StaticLanguageSelector(languageId), URI.parse("fake:lang"));
    const pos = model.getPositionAt(index);
    const all = await provider.provideSelectionRanges(model, [pos], CancellationToken.None);
    const ranges = all[0];
    modelService.destroyModel(model.uri);
    assert.strictEqual(expected.length, ranges.length);
    for (const range of ranges) {
      const exp = expected.shift() || null;
      assert.ok(Range.equalsRange(range.range, exp), `A=${range.range} <> E=${exp}`);
    }
  }
  test("bracket selection", async () => {
    await assertRanges(
      new BracketSelectionRangeProvider(),
      "(|)",
      new Range(1, 2, 1, 2),
      new Range(1, 1, 1, 3)
    );
    await assertRanges(
      new BracketSelectionRangeProvider(),
      "[[[](|)]]",
      new Range(1, 6, 1, 6),
      new Range(1, 5, 1, 7),
      // ()
      new Range(1, 3, 1, 7),
      new Range(1, 2, 1, 8),
      // [[]()]
      new Range(1, 2, 1, 8),
      new Range(1, 1, 1, 9)
      // [[[]()]]
    );
    await assertRanges(
      new BracketSelectionRangeProvider(),
      "[a[](|)a]",
      new Range(1, 6, 1, 6),
      new Range(1, 5, 1, 7),
      new Range(1, 2, 1, 8),
      new Range(1, 1, 1, 9)
    );
    await assertRanges(new BracketSelectionRangeProvider(), "fofof|fofo");
    await assertRanges(new BracketSelectionRangeProvider(), "[[[]()]]|");
    await assertRanges(new BracketSelectionRangeProvider(), "|[[[]()]]");
    await assertRanges(new BracketSelectionRangeProvider(), "[|[[]()]]", new Range(1, 2, 1, 8), new Range(1, 1, 1, 9));
    await assertRanges(new BracketSelectionRangeProvider(), "[[[]()]|]", new Range(1, 2, 1, 8), new Range(1, 1, 1, 9));
    await assertRanges(new BracketSelectionRangeProvider(), "aaa(aaa)bbb(b|b)ccc(ccc)", new Range(1, 13, 1, 15), new Range(1, 12, 1, 16));
    await assertRanges(new BracketSelectionRangeProvider(), "(aaa(aaa)bbb(b|b)ccc(ccc))", new Range(1, 14, 1, 16), new Range(1, 13, 1, 17), new Range(1, 2, 1, 25), new Range(1, 1, 1, 26));
  });
  test("bracket with leading/trailing", async () => {
    await assertRanges(
      new BracketSelectionRangeProvider(),
      "for(a of b){\n  foo(|);\n}",
      new Range(2, 7, 2, 7),
      new Range(2, 6, 2, 8),
      new Range(1, 13, 3, 1),
      new Range(1, 12, 3, 2),
      new Range(1, 1, 3, 2),
      new Range(1, 1, 3, 2)
    );
    await assertRanges(
      new BracketSelectionRangeProvider(),
      "for(a of b)\n{\n  foo(|);\n}",
      new Range(3, 7, 3, 7),
      new Range(3, 6, 3, 8),
      new Range(2, 2, 4, 1),
      new Range(2, 1, 4, 2),
      new Range(1, 1, 4, 2),
      new Range(1, 1, 4, 2)
    );
  });
  test("in-word ranges", async () => {
    await assertRanges(
      new WordSelectionRangeProvider(),
      "f|ooBar",
      new Range(1, 1, 1, 4),
      // foo
      new Range(1, 1, 1, 7),
      // fooBar
      new Range(1, 1, 1, 7)
      // doc
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "f|oo_Ba",
      new Range(1, 1, 1, 4),
      new Range(1, 1, 1, 7),
      new Range(1, 1, 1, 7)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "f|oo-Ba",
      new Range(1, 1, 1, 4),
      new Range(1, 1, 1, 7),
      new Range(1, 1, 1, 7)
    );
  });
  test("in-word ranges with selectSubwords=false", async () => {
    await assertRanges(
      new WordSelectionRangeProvider(false),
      "f|ooBar",
      new Range(1, 1, 1, 7),
      new Range(1, 1, 1, 7)
    );
    await assertRanges(
      new WordSelectionRangeProvider(false),
      "f|oo_Ba",
      new Range(1, 1, 1, 7),
      new Range(1, 1, 1, 7)
    );
    await assertRanges(
      new WordSelectionRangeProvider(false),
      "f|oo-Ba",
      new Range(1, 1, 1, 7),
      new Range(1, 1, 1, 7)
    );
  });
  test("Default selection should select current word/hump first in camelCase #67493", async function() {
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Abs|tractSmartSelect",
      new Range(1, 1, 1, 9),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "AbstractSma|rtSelect",
      new Range(1, 9, 1, 14),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Abstrac-Sma|rt-elect",
      new Range(1, 9, 1, 14),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Abstrac_Sma|rt_elect",
      new Range(1, 9, 1, 14),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Abstrac_Sma|rt-elect",
      new Range(1, 9, 1, 14),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Abstrac_Sma|rtSelect",
      new Range(1, 9, 1, 14),
      new Range(1, 1, 1, 20),
      new Range(1, 1, 1, 20)
    );
  });
  test("Smart select: only add line ranges if they're contained by the next range #73850", async function() {
    const reg = providers.register("*", {
      provideSelectionRanges() {
        return [[
          { range: { startLineNumber: 1, startColumn: 10, endLineNumber: 1, endColumn: 11 } },
          { range: { startLineNumber: 1, startColumn: 10, endLineNumber: 3, endColumn: 2 } },
          { range: { startLineNumber: 1, startColumn: 1, endLineNumber: 3, endColumn: 2 } }
        ]];
      }
    });
    await assertGetRangesToPosition(["type T = {", "	x: number", "}"], 1, 10, [
      new Range(1, 1, 3, 2),
      // all
      new Range(1, 10, 3, 2),
      // { ... }
      new Range(1, 10, 1, 11)
      // {
    ]);
    reg.dispose();
  });
  test("Expand selection in words with underscores is inconsistent #90589", async function() {
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hel|lo_World",
      new Range(1, 1, 1, 6),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello_Wo|rld",
      new Range(1, 7, 1, 12),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello|_World",
      new Range(1, 1, 1, 6),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello_|World",
      new Range(1, 7, 1, 12),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello|-World",
      new Range(1, 1, 1, 6),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello-|World",
      new Range(1, 7, 1, 12),
      new Range(1, 1, 1, 12),
      new Range(1, 1, 1, 12)
    );
    await assertRanges(
      new WordSelectionRangeProvider(),
      "Hello|World",
      new Range(1, 6, 1, 11),
      new Range(1, 1, 1, 11),
      new Range(1, 1, 1, 11)
    );
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zbWFydFNlbGVjdC90ZXN0L2Jyb3dzZXIvc21hcnRTZWxlY3QudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UsIFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgU2VsZWN0aW9uUmFuZ2VQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIgfSBmcm9tICcuLi8uLi9icm93c2VyL2JyYWNrZXRTZWxlY3Rpb25zLmpzJztcbmltcG9ydCB7IHByb3ZpZGVTZWxlY3Rpb25SYW5nZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL3NtYXJ0U2VsZWN0LmpzJztcbmltcG9ydCB7IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci93b3JkU2VsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVNb2RlbFNlcnZpY2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBqYXZhc2NyaXB0T25FbnRlclJ1bGVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvc3VwcG9ydHMvb25FbnRlclJ1bGVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlRmVhdHVyZVJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlbGVjdGlvbiwgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbmNsYXNzIFN0YXRpY0xhbmd1YWdlU2VsZWN0b3IgaW1wbGVtZW50cyBJTGFuZ3VhZ2VTZWxlY3Rpb24ge1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8c3RyaW5nPiA9IEV2ZW50Lk5vbmU7XG5cdGNvbnN0cnVjdG9yKHB1YmxpYyByZWFkb25seSBsYW5ndWFnZUlkOiBzdHJpbmcpIHsgfVxufVxuXG5zdWl0ZSgnU21hcnRTZWxlY3QnLCAoKSA9PiB7XG5cblx0Y29uc3QgT3JpZ2luYWxCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlck1heER1cmF0aW9uID0gQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIuX21heER1cmF0aW9uO1xuXG5cdHN1aXRlU2V0dXAoKCkgPT4ge1xuXHRcdEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyLl9tYXhEdXJhdGlvbiA9IDUwMDA7IC8vIDUgc2Vjb25kc1xuXHR9KTtcblxuXHRzdWl0ZVRlYXJkb3duKCgpID0+IHtcblx0XHRCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlci5fbWF4RHVyYXRpb24gPSBPcmlnaW5hbEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyTWF4RHVyYXRpb247XG5cdH0pO1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSAnbW9ja0pTTW9kZSc7XG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRsZXQgbW9kZWxTZXJ2aWNlOiBJTW9kZWxTZXJ2aWNlO1xuXHRjb25zdCBwcm92aWRlcnMgPSBuZXcgTGFuZ3VhZ2VGZWF0dXJlUmVnaXN0cnk8U2VsZWN0aW9uUmFuZ2VQcm92aWRlcj4oKTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRtb2RlbFNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSU1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgbGFuZ3VhZ0NvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBpbnN0YW50aWF0aW9uU2VydmljZS5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlSWQgfSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwge1xuXHRcdFx0YnJhY2tldHM6IFtcblx0XHRcdFx0WycoJywgJyknXSxcblx0XHRcdFx0Wyd7JywgJ30nXSxcblx0XHRcdFx0WydbJywgJ10nXVxuXHRcdFx0XSxcblx0XHRcdG9uRW50ZXJSdWxlczogamF2YXNjcmlwdE9uRW50ZXJSdWxlcyxcblx0XHRcdHdvcmRQYXR0ZXJuOiAvKC0/XFxkKlxcLlxcZFxcdyopfChbXlxcYFxcflxcIVxcQFxcI1xcJFxcJVxcXlxcJlxcKlxcKFxcKVxcPVxcK1xcW1xce1xcXVxcfVxcXFxcXDtcXDpcXCdcXFwiXFwsXFwuXFw8XFw+XFwvXFw/XFxzXSspL2dcblx0XHR9KSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24odGV4dDogc3RyaW5nW10sIGxpbmVOdW1iZXI6IG51bWJlciwgY29sdW1uOiBudW1iZXIsIHJhbmdlczogUmFuZ2VbXSwgc2VsZWN0TGVhZGluZ0FuZFRyYWlsaW5nV2hpdGVzcGFjZSA9IHRydWUpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCB1cmkgPSBVUkkuZmlsZSgndGVzdC5qcycpO1xuXHRcdGNvbnN0IG1vZGVsID0gbW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsKHRleHQuam9pbignXFxuJyksIG5ldyBTdGF0aWNMYW5ndWFnZVNlbGVjdG9yKGxhbmd1YWdlSWQpLCB1cmkpO1xuXHRcdGNvbnN0IFthY3R1YWxdID0gYXdhaXQgcHJvdmlkZVNlbGVjdGlvblJhbmdlcyhwcm92aWRlcnMsIG1vZGVsLCBbbmV3IFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbildLCB7IHNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2UsIHNlbGVjdFN1YndvcmRzOiB0cnVlIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGNvbnN0IGFjdHVhbFN0ciA9IGFjdHVhbC5tYXAociA9PiBuZXcgUmFuZ2Uoci5zdGFydExpbmVOdW1iZXIsIHIuc3RhcnRDb2x1bW4sIHIuZW5kTGluZU51bWJlciwgci5lbmRDb2x1bW4pLnRvU3RyaW5nKCkpO1xuXHRcdGNvbnN0IGRlc2lyZWRTdHIgPSByYW5nZXMucmV2ZXJzZSgpLm1hcChyID0+IFN0cmluZyhyKSk7XG5cblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFjdHVhbFN0ciwgZGVzaXJlZFN0ciwgYFxcbkE6ICR7YWN0dWFsU3RyfSBWUyBcXG5FOiAke2Rlc2lyZWRTdHJ9YCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbCh1cmkpO1xuXHR9XG5cblx0dGVzdCgnZ2V0UmFuZ2VzVG9Qb3NpdGlvbiAjMScsICgpID0+IHtcblxuXHRcdHJldHVybiBhc3NlcnRHZXRSYW5nZXNUb1Bvc2l0aW9uKFtcblx0XHRcdCdmdW5jdGlvbiBhKGJhciwgZm9vKXsnLFxuXHRcdFx0J1xcdGlmIChiYXIpIHsnLFxuXHRcdFx0J1xcdFxcdHJldHVybiAoYmFyICsgKDIgKiBmb28pKScsXG5cdFx0XHQnXFx0fScsXG5cdFx0XHQnfSdcblx0XHRdLCAzLCAyMCwgW1xuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDUsIDIpLCAvLyBhbGxcblx0XHRcdG5ldyBSYW5nZSgxLCAyMSwgNSwgMiksIC8vIHt9IG91dHNpZGVcblx0XHRcdG5ldyBSYW5nZSgxLCAyMiwgNSwgMSksIC8vIHt9IGluc2lkZVxuXHRcdFx0bmV3IFJhbmdlKDIsIDEsIDQsIDMpLCAvLyBibG9ja1xuXHRcdFx0bmV3IFJhbmdlKDIsIDEsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDIsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDExLCA0LCAzKSxcblx0XHRcdG5ldyBSYW5nZSgyLCAxMiwgNCwgMiksXG5cdFx0XHRuZXcgUmFuZ2UoMywgMSwgMywgMjcpLCAvLyBsaW5lIHcvIHRyaXZhXG5cdFx0XHRuZXcgUmFuZ2UoMywgMywgMywgMjcpLCAvLyBsaW5lIHcvbyB0cml2YVxuXHRcdFx0bmV3IFJhbmdlKDMsIDEwLCAzLCAyNyksIC8vICgpIG91dHNpZGVcblx0XHRcdG5ldyBSYW5nZSgzLCAxMSwgMywgMjYpLCAvLyAoKSBpbnNpZGVcblx0XHRcdG5ldyBSYW5nZSgzLCAxNywgMywgMjYpLCAvLyAoKSBvdXRzaWRlXG5cdFx0XHRuZXcgUmFuZ2UoMywgMTgsIDMsIDI1KSwgLy8gKCkgaW5zaWRlXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NvbmZpZzogc2VsZWN0TGVhZGluZ0FuZFRyYWlsaW5nV2hpdGVzcGFjZScsIGFzeW5jICgpID0+IHtcblxuXHRcdGF3YWl0IGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0J2FhYScsXG5cdFx0XHQnXFx0YmJiJyxcblx0XHRcdCcnXG5cdFx0XSwgMiwgMywgW1xuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDMsIDEpLCAvLyBhbGxcblx0XHRcdG5ldyBSYW5nZSgyLCAxLCAyLCA1KSwgLy8gbGluZSB3LyB0cml2YVxuXHRcdFx0bmV3IFJhbmdlKDIsIDIsIDIsIDUpLCAvLyBiYmJcblx0XHRdLCB0cnVlKTtcblxuXHRcdGF3YWl0IGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0J2FhYScsXG5cdFx0XHQnXFx0YmJiJyxcblx0XHRcdCcnXG5cdFx0XSwgMiwgMywgW1xuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDMsIDEpLCAvLyBhbGxcblx0XHRcdG5ldyBSYW5nZSgyLCAyLCAyLCA1KSwgLy8gKCkgaW5zaWRlXG5cdFx0XSwgZmFsc2UpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRSYW5nZXNUb1Bvc2l0aW9uICM1Njg4Ni4gU2tpcCBlbXB0eSBsaW5lcyBjb3JyZWN0bHkuJywgKCkgPT4ge1xuXG5cdFx0cmV0dXJuIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0J2Z1bmN0aW9uIGEoYmFyLCBmb28peycsXG5cdFx0XHQnXFx0aWYgKGJhcikgeycsXG5cdFx0XHQnJyxcblx0XHRcdCdcXHR9Jyxcblx0XHRcdCd9J1xuXHRcdF0sIDMsIDEsIFtcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCA1LCAyKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAyMSwgNSwgMiksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMjIsIDUsIDEpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDEsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDEsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDIsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDExLCA0LCAzKSxcblx0XHRcdG5ldyBSYW5nZSgyLCAxMiwgNCwgMiksXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFJhbmdlc1RvUG9zaXRpb24gIzU2ODg2LiBEbyBub3Qgc2tpcCBsaW5lcyB3aXRoIG9ubHkgd2hpdGVzcGFjZXMuJywgKCkgPT4ge1xuXG5cdFx0cmV0dXJuIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0J2Z1bmN0aW9uIGEoYmFyLCBmb28peycsXG5cdFx0XHQnXFx0aWYgKGJhcikgeycsXG5cdFx0XHQnICcsXG5cdFx0XHQnXFx0fScsXG5cdFx0XHQnfSdcblx0XHRdLCAzLCAxLCBbXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgNSwgMiksIC8vIGFsbFxuXHRcdFx0bmV3IFJhbmdlKDEsIDIxLCA1LCAyKSwgLy8ge30gb3V0c2lkZVxuXHRcdFx0bmV3IFJhbmdlKDEsIDIyLCA1LCAxKSwgLy8ge30gaW5zaWRlXG5cdFx0XHRuZXcgUmFuZ2UoMiwgMSwgNCwgMyksXG5cdFx0XHRuZXcgUmFuZ2UoMiwgMSwgNCwgMyksXG5cdFx0XHRuZXcgUmFuZ2UoMiwgMiwgNCwgMyksXG5cdFx0XHRuZXcgUmFuZ2UoMiwgMTEsIDQsIDMpLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDEyLCA0LCAyKSxcblx0XHRcdG5ldyBSYW5nZSgzLCAxLCAzLCAyKSwgLy8gYmxvY2tcblx0XHRcdG5ldyBSYW5nZSgzLCAxLCAzLCAyKSAvLyBlbXB0eSBsaW5lXG5cdFx0XSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2dldFJhbmdlc1RvUG9zaXRpb24gIzQwNjU4LiBDdXJzb3IgYXQgZmlyc3QgcG9zaXRpb24gaW5zaWRlIGJyYWNrZXRzIHNob3VsZCBzZWxlY3QgbGluZSBpbnNpZGUuJywgKCkgPT4ge1xuXG5cdFx0cmV0dXJuIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0JyBbIF0nLFxuXHRcdFx0JyB7IH0gJyxcblx0XHRcdCcoICkgJ1xuXHRcdF0sIDIsIDMsIFtcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAzLCA1KSxcblx0XHRcdG5ldyBSYW5nZSgyLCAxLCAyLCA2KSwgLy8gbGluZSB3LyB0cmlhdmFcblx0XHRcdG5ldyBSYW5nZSgyLCAyLCAyLCA1KSwgLy8ge30gaW5zaWRlLCBsaW5lIHcvbyB0cml2YVxuXHRcdFx0bmV3IFJhbmdlKDIsIDMsIDIsIDQpIC8vIHt9IGluc2lkZVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRSYW5nZXNUb1Bvc2l0aW9uICM0MDY1OC4gQ3Vyc29yIGluIGVtcHR5IGJyYWNrZXRzIHNob3VsZCByZXZlYWwgYnJhY2tldHMgZmlyc3QuJywgKCkgPT4ge1xuXG5cdFx0cmV0dXJuIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0JyBbXSAnLFxuXHRcdFx0JyB7IH0gJyxcblx0XHRcdCcgICggKSAnXG5cdFx0XSwgMSwgMywgW1xuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDMsIDcpLCAvLyBhbGxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA1KSwgLy8gbGluZSB3LyB0cml2YWxcblx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA0KSwgLy8gW10gb3V0c2lkZSwgbGluZSB3L28gdHJpdmFsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMywgMSwgMyksIC8vIFtdIGluc2lkZVxuXHRcdF0pO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRSYW5nZXNUb1Bvc2l0aW9uICM0MDY1OC4gVG9rZW5zIGJlZm9yZSBicmFja2V0IHdpbGwgYmUgcmV2ZWFsZWQgZmlyc3QuJywgKCkgPT4ge1xuXG5cdFx0cmV0dXJuIGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oW1xuXHRcdFx0JyAgW10gJyxcblx0XHRcdCcgeyB9ICcsXG5cdFx0XHQnc2VsZWN0dGhpcyggKSAnXG5cdFx0XSwgMywgMTEsIFtcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAzLCAxNSksIC8vIGFsbFxuXHRcdFx0bmV3IFJhbmdlKDMsIDEsIDMsIDE1KSwgLy8gbGluZSB3LyB0cml2aWFcblx0XHRcdG5ldyBSYW5nZSgzLCAxLCAzLCAxNCksIC8vIGxpbmUgdy9vIHRyaXZpYVxuXHRcdFx0bmV3IFJhbmdlKDMsIDEsIDMsIDExKSAvLyB3b3JkXG5cdFx0XSk7XG5cdH0pO1xuXG5cdC8vIC0tIGJyYWNrZXQgc2VsZWN0aW9uc1xuXG5cdGFzeW5jIGZ1bmN0aW9uIGFzc2VydFJhbmdlcyhwcm92aWRlcjogU2VsZWN0aW9uUmFuZ2VQcm92aWRlciwgdmFsdWU6IHN0cmluZywgLi4uZXhwZWN0ZWQ6IElSYW5nZVtdKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgaW5kZXggPSB2YWx1ZS5pbmRleE9mKCd8Jyk7XG5cdFx0dmFsdWUgPSB2YWx1ZS5yZXBsYWNlKCd8JywgJycpOyAvLyBDb2RlUUwgW1NNMDIzODNdIGpzL2luY29tcGxldGUtc2FuaXRpemF0aW9uIHRoaXMgaXMgcHVycG9zZSBvbmx5IHRoZSBmaXJzdCB8IGNoYXJhY3RlclxuXG5cdFx0Y29uc3QgbW9kZWwgPSBtb2RlbFNlcnZpY2UuY3JlYXRlTW9kZWwodmFsdWUsIG5ldyBTdGF0aWNMYW5ndWFnZVNlbGVjdG9yKGxhbmd1YWdlSWQpLCBVUkkucGFyc2UoJ2Zha2U6bGFuZycpKTtcblx0XHRjb25zdCBwb3MgPSBtb2RlbC5nZXRQb3NpdGlvbkF0KGluZGV4KTtcblx0XHRjb25zdCBhbGwgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlU2VsZWN0aW9uUmFuZ2VzKG1vZGVsLCBbcG9zXSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0Y29uc3QgcmFuZ2VzID0gYWxsIVswXTtcblxuXHRcdG1vZGVsU2VydmljZS5kZXN0cm95TW9kZWwobW9kZWwudXJpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChleHBlY3RlZC5sZW5ndGgsIHJhbmdlcy5sZW5ndGgpO1xuXHRcdGZvciAoY29uc3QgcmFuZ2Ugb2YgcmFuZ2VzKSB7XG5cdFx0XHRjb25zdCBleHAgPSBleHBlY3RlZC5zaGlmdCgpIHx8IG51bGw7XG5cdFx0XHRhc3NlcnQub2soUmFuZ2UuZXF1YWxzUmFuZ2UocmFuZ2UucmFuZ2UsIGV4cCksIGBBPSR7cmFuZ2UucmFuZ2V9IDw+IEU9JHtleHB9YCk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnYnJhY2tldCBzZWxlY3Rpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnKHwpJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCAyKSwgbmV3IFJhbmdlKDEsIDEsIDEsIDMpXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ1tbW10ofCldXScsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgNiwgMSwgNiksIG5ldyBSYW5nZSgxLCA1LCAxLCA3KSwgLy8gKClcblx0XHRcdG5ldyBSYW5nZSgxLCAzLCAxLCA3KSwgbmV3IFJhbmdlKDEsIDIsIDEsIDgpLCAvLyBbW10oKV1cblx0XHRcdG5ldyBSYW5nZSgxLCAyLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDEsIDEsIDkpLCAvLyBbW1tdKCldXVxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IEJyYWNrZXRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdbYVtdKHwpYV0nLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDYsIDEsIDYpLCBuZXcgUmFuZ2UoMSwgNSwgMSwgNyksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMiwgMSwgOCksIG5ldyBSYW5nZSgxLCAxLCAxLCA5KSxcblx0XHQpO1xuXG5cdFx0Ly8gbm8gYnJhY2tldFxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ2ZvZm9mfGZvZm8nKTtcblxuXHRcdC8vIGVtcHR5XG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnW1tbXSgpXV18Jyk7XG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnfFtbW10oKV1dJyk7XG5cblx0XHQvLyBlZGdlXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnW3xbW10oKV1dJywgbmV3IFJhbmdlKDEsIDIsIDEsIDgpLCBuZXcgUmFuZ2UoMSwgMSwgMSwgOSkpO1xuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ1tbW10oKV18XScsIG5ldyBSYW5nZSgxLCAyLCAxLCA4KSwgbmV3IFJhbmdlKDEsIDEsIDEsIDkpKTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ2FhYShhYWEpYmJiKGJ8YiljY2MoY2NjKScsIG5ldyBSYW5nZSgxLCAxMywgMSwgMTUpLCBuZXcgUmFuZ2UoMSwgMTIsIDEsIDE2KSk7XG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBCcmFja2V0U2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnKGFhYShhYWEpYmJiKGJ8YiljY2MoY2NjKSknLCBuZXcgUmFuZ2UoMSwgMTQsIDEsIDE2KSwgbmV3IFJhbmdlKDEsIDEzLCAxLCAxNyksIG5ldyBSYW5nZSgxLCAyLCAxLCAyNSksIG5ldyBSYW5nZSgxLCAxLCAxLCAyNikpO1xuXHR9KTtcblxuXHR0ZXN0KCdicmFja2V0IHdpdGggbGVhZGluZy90cmFpbGluZycsIGFzeW5jICgpID0+IHtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ2ZvcihhIG9mIGIpe1xcbiAgZm9vKHwpO1xcbn0nLFxuXHRcdFx0bmV3IFJhbmdlKDIsIDcsIDIsIDcpLCBuZXcgUmFuZ2UoMiwgNiwgMiwgOCksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMTMsIDMsIDEpLCBuZXcgUmFuZ2UoMSwgMTIsIDMsIDIpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDMsIDIpLCBuZXcgUmFuZ2UoMSwgMSwgMywgMiksXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgQnJhY2tldFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ2ZvcihhIG9mIGIpXFxue1xcbiAgZm9vKHwpO1xcbn0nLFxuXHRcdFx0bmV3IFJhbmdlKDMsIDcsIDMsIDcpLCBuZXcgUmFuZ2UoMywgNiwgMywgOCksXG5cdFx0XHRuZXcgUmFuZ2UoMiwgMiwgNCwgMSksIG5ldyBSYW5nZSgyLCAxLCA0LCAyKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCA0LCAyKSwgbmV3IFJhbmdlKDEsIDEsIDQsIDIpLFxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ2luLXdvcmQgcmFuZ2VzJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnZnxvb0JhcicsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgNCksIC8vIGZvb1xuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDcpLCAvLyBmb29CYXJcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSwgLy8gZG9jXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgV29yZFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ2Z8b29fQmEnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDQpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDcpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDcpLFxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdmfG9vLUJhJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA0KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdpbi13b3JkIHJhbmdlcyB3aXRoIHNlbGVjdFN1YndvcmRzPWZhbHNlJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcihmYWxzZSksICdmfG9vQmFyJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcihmYWxzZSksICdmfG9vX0JhJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcihmYWxzZSksICdmfG9vLUJhJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA3KSxcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWZhdWx0IHNlbGVjdGlvbiBzaG91bGQgc2VsZWN0IGN1cnJlbnQgd29yZC9odW1wIGZpcnN0IGluIGNhbWVsQ2FzZSAjNjc0OTMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdBYnN8dHJhY3RTbWFydFNlbGVjdCcsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgOSksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMjApLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDIwKSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnQWJzdHJhY3RTbWF8cnRTZWxlY3QnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDksIDEsIDE0KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAyMCksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMjApLFxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdBYnN0cmFjLVNtYXxydC1lbGVjdCcsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgOSwgMSwgMTQpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDIwKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAyMCksXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgV29yZFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ0Fic3RyYWNfU21hfHJ0X2VsZWN0Jyxcblx0XHRcdG5ldyBSYW5nZSgxLCA5LCAxLCAxNCksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMjApLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDIwKSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnQWJzdHJhY19TbWF8cnQtZWxlY3QnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDksIDEsIDE0KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAyMCksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMjApLFxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdBYnN0cmFjX1NtYXxydFNlbGVjdCcsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgOSwgMSwgMTQpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDIwKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAyMCksXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnU21hcnQgc2VsZWN0OiBvbmx5IGFkZCBsaW5lIHJhbmdlcyBpZiB0aGV5XFwncmUgY29udGFpbmVkIGJ5IHRoZSBuZXh0IHJhbmdlICM3Mzg1MCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJlZyA9IHByb3ZpZGVycy5yZWdpc3RlcignKicsIHtcblx0XHRcdHByb3ZpZGVTZWxlY3Rpb25SYW5nZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbW1xuXHRcdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMTAsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMTEgfSB9LFxuXHRcdFx0XHRcdHsgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMTAsIGVuZExpbmVOdW1iZXI6IDMsIGVuZENvbHVtbjogMiB9IH0sXG5cdFx0XHRcdFx0eyByYW5nZTogeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAzLCBlbmRDb2x1bW46IDIgfSB9LFxuXHRcdFx0XHRdXTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGF3YWl0IGFzc2VydEdldFJhbmdlc1RvUG9zaXRpb24oWyd0eXBlIFQgPSB7JywgJ1xcdHg6IG51bWJlcicsICd9J10sIDEsIDEwLCBbXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMywgMiksIC8vIGFsbFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAzLCAyKSwgLy8geyAuLi4gfVxuXHRcdFx0bmV3IFJhbmdlKDEsIDEwLCAxLCAxMSksIC8vIHtcblx0XHRdKTtcblxuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0V4cGFuZCBzZWxlY3Rpb24gaW4gd29yZHMgd2l0aCB1bmRlcnNjb3JlcyBpcyBpbmNvbnNpc3RlbnQgIzkwNTg5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnSGVsfGxvX1dvcmxkJyxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCA2KSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxMiksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMTIpLFxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdIZWxsb19Xb3xybGQnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDcsIDEsIDEyKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxMiksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMTIpLFxuXHRcdCk7XG5cblx0XHRhd2FpdCBhc3NlcnRSYW5nZXMobmV3IFdvcmRTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKCksICdIZWxsb3xfV29ybGQnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDYpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDEyKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxMiksXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgV29yZFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ0hlbGxvX3xXb3JsZCcsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgNywgMSwgMTIpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDEyKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxMiksXG5cdFx0KTtcblxuXHRcdGF3YWl0IGFzc2VydFJhbmdlcyhuZXcgV29yZFNlbGVjdGlvblJhbmdlUHJvdmlkZXIoKSwgJ0hlbGxvfC1Xb3JsZCcsXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgNiksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMTIpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDEyKSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnSGVsbG8tfFdvcmxkJyxcblx0XHRcdG5ldyBSYW5nZSgxLCA3LCAxLCAxMiksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMTIpLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDEsIDEsIDEyKSxcblx0XHQpO1xuXG5cdFx0YXdhaXQgYXNzZXJ0UmFuZ2VzKG5ldyBXb3JkU2VsZWN0aW9uUmFuZ2VQcm92aWRlcigpLCAnSGVsbG98V29ybGQnLFxuXHRcdFx0bmV3IFJhbmdlKDEsIDYsIDEsIDExKSxcblx0XHRcdG5ldyBSYW5nZSgxLCAxLCAxLCAxMSksXG5cdFx0XHRuZXcgUmFuZ2UoMSwgMSwgMSwgMTEpLFxuXHRcdCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsV0FBVztBQUNwQixTQUFTLGdCQUFnQjtBQUN6QixTQUFpQixhQUFhO0FBRTlCLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMscUNBQXFDO0FBQzlDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQTZCLHdCQUF3QjtBQUNyRCxTQUFTLCtDQUErQztBQUV4RCxNQUFNLHVCQUFxRDtBQUFBLEVBRTFELFlBQTRCLFlBQW9CO0FBQXBCO0FBRDVCLFNBQVMsY0FBNkIsTUFBTTtBQUFBLEVBQ007QUFDbkQ7QUFFQSxNQUFNLGVBQWUsTUFBTTtBQUUxQixRQUFNLG1EQUFtRCw4QkFBOEI7QUFFdkYsYUFBVyxNQUFNO0FBQ2hCLGtDQUE4QixlQUFlO0FBQUEsRUFDOUMsQ0FBQztBQUVELGdCQUFjLE1BQU07QUFDbkIsa0NBQThCLGVBQWU7QUFBQSxFQUM5QyxDQUFDO0FBRUQsUUFBTSxhQUFhO0FBQ25CLE1BQUk7QUFDSixNQUFJO0FBQ0osUUFBTSxZQUFZLElBQUksd0JBQWdEO0FBRXRFLFFBQU0sTUFBTTtBQUNYLGtCQUFjLElBQUksZ0JBQWdCO0FBQ2xDLFVBQU0sdUJBQXVCLG9CQUFvQixXQUFXO0FBQzVELG1CQUFlLHFCQUFxQixJQUFJLGFBQWE7QUFDckQsVUFBTSw4QkFBOEIscUJBQXFCLElBQUksNkJBQTZCO0FBQzFGLFVB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SUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQTtBQUFBLE1BQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUE7QUFBQSxJQUNyQixHQUFHLElBQUk7QUFFUCxVQUFNLDBCQUEwQjtBQUFBLE1BQy9CO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsR0FBRyxHQUFHO0FBQUEsTUFDUixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBO0FBQUEsTUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQTtBQUFBLElBQ3JCLEdBQUcsS0FBSztBQUFBLEVBQ1QsQ0FBQztBQUVELE9BQUssMkRBQTJELE1BQU07QUFFckUsV0FBTywwQkFBMEI7QUFBQSxNQUNoQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsR0FBRyxHQUFHO0FBQUEsTUFDUixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3BCLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDO0FBQUEsTUFDckIsSUFBSSxNQUFNLEdBQUcsSUFBSSxHQUFHLENBQUM7QUFBQSxNQUNyQixJQUFJLE1BQU0sR0FBRyxHQUFHLEdBQUcsQ0FBQztBQUFBLE1BQ3BCLElBQUksTUFBTSxHQUFHLEdBQUcsR0FBRyxDQUFDO0FBQUEsTUFDcEIsSUFBSSxNQUFNLEdBQUcsR0FBRyxHQUFHLENBQUM7QUFBQSxNQUNwQixJQUFJLE1BQU0sR0FBRyxJQUFJLEdBQUcsQ0FBQztBQUFBLE1BQ3JCLElBQUksTUFBTSxHQUFHLElBQUksR0FBRyxDQUFDO0FBQUEsSUFDdEIsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUVELE9BQUssd0VBQXdFLE1BQU07QUFFbEYsV0FBTywwQkFBMEI7QUFBQSxNQUNoQztBQUFBLE1BQ0E7QUFBQSxNQUNBO0FBQUEsTUFDQTtBQUFBLE1BQ0E7QUFBQSxJQUNELEdBQUcsR0FBRyxHQUFHO0FBQUEsTUFD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
