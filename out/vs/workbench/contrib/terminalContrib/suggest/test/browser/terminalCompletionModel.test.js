import assert, { notStrictEqual, strictEqual } from "assert";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../../base/test/common/utils.js";
import { TerminalCompletionModel } from "../../browser/terminalCompletionModel.js";
import { LineContext } from "../../../../../services/suggest/browser/simpleCompletionModel.js";
import { TerminalCompletionItem, TerminalCompletionItemKind } from "../../browser/terminalCompletionItem.js";
function createItem(options) {
  return new TerminalCompletionItem({
    ...options,
    kind: options.kind ?? TerminalCompletionItemKind.Method,
    label: options.label || "defaultLabel",
    provider: options.provider || "defaultProvider",
    replacementIndex: options.replacementIndex || 0,
    replacementLength: options.replacementLength || 1
  });
}
function createFileItems(...labels) {
  return labels.map((label) => createItem({ label, kind: TerminalCompletionItemKind.File }));
}
function createFileItemsModel(...labels) {
  return new TerminalCompletionModel(
    createFileItems(...labels),
    new LineContext("", 0)
  );
}
function createFolderItems(...labels) {
  return labels.map((label) => createItem({ label, kind: TerminalCompletionItemKind.Folder }));
}
function createFolderItemsModel(...labels) {
  return new TerminalCompletionModel(
    createFolderItems(...labels),
    new LineContext("", 0)
  );
}
function assertItems(model, labels) {
  assert.deepStrictEqual(model.items.map((i) => i.completion.label), labels);
  assert.strictEqual(model.items.length, labels.length);
}
suite("TerminalCompletionModel", function() {
  ensureNoDisposablesAreLeakedInTestSuite();
  let model;
  test("should handle an empty list", function() {
    model = new TerminalCompletionModel([], new LineContext("", 0));
    assert.strictEqual(model.items.length, 0);
  });
  test("should handle a list with one item", function() {
    model = new TerminalCompletionModel([
      createItem({ label: "a" })
    ], new LineContext("", 0));
    assert.strictEqual(model.items.length, 1);
    assert.strictEqual(model.items[0].completion.label, "a");
  });
  test("should sort alphabetically", function() {
    model = new TerminalCompletionModel([
      createItem({ label: "b" }),
      createItem({ label: "z" }),
      createItem({ label: "a" })
    ], new LineContext("", 0));
    assert.strictEqual(model.items.length, 3);
    assert.strictEqual(model.items[0].completion.label, "a");
    assert.strictEqual(model.items[1].completion.label, "b");
    assert.strictEqual(model.items[2].completion.label, "z");
  });
  test("fuzzy matching", () => {
    const initial = [
      ".\\.eslintrc",
      ".\\resources\\",
      ".\\scripts\\",
      ".\\src\\"
    ];
    const expected = [
      ".\\scripts\\",
      ".\\src\\",
      ".\\.eslintrc",
      ".\\resources\\"
    ];
    model = new TerminalCompletionModel(initial.map((e) => createItem({ label: e })), new LineContext("s", 0));
    assertItems(model, expected);
  });
  suite("files and folders", () => {
    test("should deprioritize files that start with underscore", function() {
      const initial = ["_a", "a", "z"];
      const expected = ["a", "z", "_a"];
      assertItems(createFileItemsModel(...initial), expected);
      assertItems(createFolderItemsModel(...initial), expected);
    });
    test("should ignore the dot in dotfiles when sorting", function() {
      const initial = ["b", ".a", "a", ".b"];
      const expected = [".a", "a", "b", ".b"];
      assertItems(createFileItemsModel(...initial), expected);
      assertItems(createFolderItemsModel(...initial), expected);
    });
    test("should handle many files and folders correctly", function() {
      const items = [
        ...createFolderItems(
          "__pycache",
          ".build",
          ".configurations",
          ".devcontainer",
          ".eslint-plugin-local",
          ".github",
          ".profile-oss",
          ".vscode",
          ".vscode-test",
          "build",
          "cli",
          "extensions",
          "node_modules",
          "out",
          "remote",
          "resources",
          "scripts",
          "src",
          "test"
        ),
        ...createFileItems(
          "__init__.py",
          ".editorconfig",
          ".eslint-ignore",
          ".git-blame-ignore-revs",
          ".gitattributes",
          ".gitignore",
          ".lsifrc.json",
          ".mailmap",
          ".mention-bot",
          ".npmrc",
          ".nvmrc",
          ".vscode-test.js",
          "cglicenses.json",
          "cgmanifest.json",
          "CodeQL.yml",
          "CONTRIBUTING.md",
          "eslint.config.js",
          "gulpfile.js",
          "LICENSE.txt",
          "package-lock.json",
          "package.json",
          "product.json",
          "README.md",
          "SECURITY.md",
          "ThirdPartyNotices.txt",
          "tsfmt.json"
        )
      ];
      const model2 = new TerminalCompletionModel(items, new LineContext("", 0));
      assertItems(model2, [
        ".build",
        "build",
        "cglicenses.json",
        "cgmanifest.json",
        "cli",
        "CodeQL.yml",
        ".configurations",
        "CONTRIBUTING.md",
        ".devcontainer",
        ".editorconfig",
        "eslint.config.js",
        ".eslint-ignore",
        ".eslint-plugin-local",
        "extensions",
        ".gitattributes",
        ".git-blame-ignore-revs",
        ".github",
        ".gitignore",
        "gulpfile.js",
        "LICENSE.txt",
        ".lsifrc.json",
        ".mailmap",
        ".mention-bot",
        "node_modules",
        ".npmrc",
        ".nvmrc",
        "out",
        "package.json",
        "package-lock.json",
        "product.json",
        ".profile-oss",
        "README.md",
        "remote",
        "resources",
        "scripts",
        "SECURITY.md",
        "src",
        "test",
        "ThirdPartyNotices.txt",
        "tsfmt.json",
        ".vscode",
        ".vscode-test",
        ".vscode-test.js",
        "__init__.py",
        "__pycache"
      ]);
    });
  });
  suite("inline completions", () => {
    function createItems(kind) {
      return [
        ...createFolderItems("a", "c"),
        ...createFileItems("b", "d"),
        new TerminalCompletionItem({
          label: "ab",
          provider: "core",
          replacementIndex: 0,
          replacementLength: 0,
          kind
        })
      ];
    }
    suite("InlineSuggestion", () => {
      test("should put on top generally", function() {
        const model2 = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestion), new LineContext("", 0));
        strictEqual(model2.items[0].completion.label, "ab");
      });
      test("should NOT put on top when there's an exact match of another item", function() {
        const model2 = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestion), new LineContext("a", 0));
        notStrictEqual(model2.items[0].completion.label, "ab");
        strictEqual(model2.items[1].completion.label, "ab");
      });
    });
    suite("InlineSuggestionAlwaysOnTop", () => {
      test("should put on top generally", function() {
        const model2 = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop), new LineContext("", 0));
        strictEqual(model2.items[0].completion.label, "ab");
      });
      test("should put on top even if there's an exact match of another item", function() {
        const model2 = new TerminalCompletionModel(createItems(TerminalCompletionItemKind.InlineSuggestionAlwaysOnTop), new LineContext("a", 0));
        strictEqual(model2.items[0].completion.label, "ab");
      });
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbENvbnRyaWIvc3VnZ2VzdC90ZXN0L2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uTW9kZWwudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5pbXBvcnQgYXNzZXJ0LCB7IG5vdFN0cmljdEVxdWFsLCBzdHJpY3RFcXVhbCB9IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci90ZXJtaW5hbENvbXBsZXRpb25Nb2RlbC5qcyc7XG5pbXBvcnQgeyBMaW5lQ29udGV4dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3NlcnZpY2VzL3N1Z2dlc3QvYnJvd3Nlci9zaW1wbGVDb21wbGV0aW9uTW9kZWwuanMnO1xuaW1wb3J0IHsgVGVybWluYWxDb21wbGV0aW9uSXRlbSwgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQsIHR5cGUgSVRlcm1pbmFsQ29tcGxldGlvbiB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvdGVybWluYWxDb21wbGV0aW9uSXRlbS5qcyc7XG5cbmZ1bmN0aW9uIGNyZWF0ZUl0ZW0ob3B0aW9uczogUGFydGlhbDxJVGVybWluYWxDb21wbGV0aW9uPik6IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW0ge1xuXHRyZXR1cm4gbmV3IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW0oe1xuXHRcdC4uLm9wdGlvbnMsXG5cdFx0a2luZDogb3B0aW9ucy5raW5kID8/IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLk1ldGhvZCxcblx0XHRsYWJlbDogb3B0aW9ucy5sYWJlbCB8fCAnZGVmYXVsdExhYmVsJyxcblx0XHRwcm92aWRlcjogb3B0aW9ucy5wcm92aWRlciB8fCAnZGVmYXVsdFByb3ZpZGVyJyxcblx0XHRyZXBsYWNlbWVudEluZGV4OiBvcHRpb25zLnJlcGxhY2VtZW50SW5kZXggfHwgMCxcblx0XHRyZXBsYWNlbWVudExlbmd0aDogb3B0aW9ucy5yZXBsYWNlbWVudExlbmd0aCB8fCAxLFxuXHR9KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRmlsZUl0ZW1zKC4uLmxhYmVsczogc3RyaW5nW10pOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtW10ge1xuXHRyZXR1cm4gbGFiZWxzLm1hcChsYWJlbCA9PiBjcmVhdGVJdGVtKHsgbGFiZWwsIGtpbmQ6IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLkZpbGUgfSkpO1xufVxuXG5mdW5jdGlvbiBjcmVhdGVGaWxlSXRlbXNNb2RlbCguLi5sYWJlbHM6IHN0cmluZ1tdKTogVGVybWluYWxDb21wbGV0aW9uTW9kZWwge1xuXHRyZXR1cm4gbmV3IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsKFxuXHRcdGNyZWF0ZUZpbGVJdGVtcyguLi5sYWJlbHMpLFxuXHRcdG5ldyBMaW5lQ29udGV4dCgnJywgMClcblx0KTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRm9sZGVySXRlbXMoLi4ubGFiZWxzOiBzdHJpbmdbXSk6IFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1bXSB7XG5cdHJldHVybiBsYWJlbHMubWFwKGxhYmVsID0+IGNyZWF0ZUl0ZW0oeyBsYWJlbCwga2luZDogVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuRm9sZGVyIH0pKTtcbn1cblxuZnVuY3Rpb24gY3JlYXRlRm9sZGVySXRlbXNNb2RlbCguLi5sYWJlbHM6IHN0cmluZ1tdKTogVGVybWluYWxDb21wbGV0aW9uTW9kZWwge1xuXHRyZXR1cm4gbmV3IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsKFxuXHRcdGNyZWF0ZUZvbGRlckl0ZW1zKC4uLmxhYmVscyksXG5cdFx0bmV3IExpbmVDb250ZXh0KCcnLCAwKVxuXHQpO1xufVxuXG5mdW5jdGlvbiBhc3NlcnRJdGVtcyhtb2RlbDogVGVybWluYWxDb21wbGV0aW9uTW9kZWwsIGxhYmVsczogc3RyaW5nW10pOiB2b2lkIHtcblx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChtb2RlbC5pdGVtcy5tYXAoaSA9PiBpLmNvbXBsZXRpb24ubGFiZWwpLCBsYWJlbHMpO1xuXHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXRlbXMubGVuZ3RoLCBsYWJlbHMubGVuZ3RoKTsgLy8gc2FuaXR5IGNoZWNrXG59XG5cbnN1aXRlKCdUZXJtaW5hbENvbXBsZXRpb25Nb2RlbCcsIGZ1bmN0aW9uICgpIHtcblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IG1vZGVsOiBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbDtcblxuXHR0ZXN0KCdzaG91bGQgaGFuZGxlIGFuIGVtcHR5IGxpc3QnLCBmdW5jdGlvbiAoKSB7XG5cdFx0bW9kZWwgPSBuZXcgVGVybWluYWxDb21wbGV0aW9uTW9kZWwoW10sIG5ldyBMaW5lQ29udGV4dCgnJywgMCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLml0ZW1zLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3Nob3VsZCBoYW5kbGUgYSBsaXN0IHdpdGggb25lIGl0ZW0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0bW9kZWwgPSBuZXcgVGVybWluYWxDb21wbGV0aW9uTW9kZWwoW1xuXHRcdFx0Y3JlYXRlSXRlbSh7IGxhYmVsOiAnYScgfSksXG5cdFx0XSwgbmV3IExpbmVDb250ZXh0KCcnLCAwKSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXRlbXMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwgJ2EnKTtcblx0fSk7XG5cblx0dGVzdCgnc2hvdWxkIHNvcnQgYWxwaGFiZXRpY2FsbHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0bW9kZWwgPSBuZXcgVGVybWluYWxDb21wbGV0aW9uTW9kZWwoW1xuXHRcdFx0Y3JlYXRlSXRlbSh7IGxhYmVsOiAnYicgfSksXG5cdFx0XHRjcmVhdGVJdGVtKHsgbGFiZWw6ICd6JyB9KSxcblx0XHRcdGNyZWF0ZUl0ZW0oeyBsYWJlbDogJ2EnIH0pLFxuXHRcdF0sIG5ldyBMaW5lQ29udGV4dCgnJywgMCkpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLml0ZW1zLmxlbmd0aCwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLml0ZW1zWzBdLmNvbXBsZXRpb24ubGFiZWwsICdhJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLml0ZW1zWzFdLmNvbXBsZXRpb24ubGFiZWwsICdiJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLml0ZW1zWzJdLmNvbXBsZXRpb24ubGFiZWwsICd6Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2Z1enp5IG1hdGNoaW5nJywgKCkgPT4ge1xuXHRcdGNvbnN0IGluaXRpYWwgPSBbXG5cdFx0XHQnLlxcXFwuZXNsaW50cmMnLFxuXHRcdFx0Jy5cXFxccmVzb3VyY2VzXFxcXCcsXG5cdFx0XHQnLlxcXFxzY3JpcHRzXFxcXCcsXG5cdFx0XHQnLlxcXFxzcmNcXFxcJyxcblx0XHRdO1xuXHRcdGNvbnN0IGV4cGVjdGVkID0gW1xuXHRcdFx0Jy5cXFxcc2NyaXB0c1xcXFwnLFxuXHRcdFx0Jy5cXFxcc3JjXFxcXCcsXG5cdFx0XHQnLlxcXFwuZXNsaW50cmMnLFxuXHRcdFx0Jy5cXFxccmVzb3VyY2VzXFxcXCcsXG5cdFx0XTtcblx0XHRtb2RlbCA9IG5ldyBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbChpbml0aWFsLm1hcChlID0+IChjcmVhdGVJdGVtKHsgbGFiZWw6IGUgfSkpKSwgbmV3IExpbmVDb250ZXh0KCdzJywgMCkpO1xuXG5cdFx0YXNzZXJ0SXRlbXMobW9kZWwsIGV4cGVjdGVkKTtcblx0fSk7XG5cblx0c3VpdGUoJ2ZpbGVzIGFuZCBmb2xkZXJzJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3Nob3VsZCBkZXByaW9yaXRpemUgZmlsZXMgdGhhdCBzdGFydCB3aXRoIHVuZGVyc2NvcmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRjb25zdCBpbml0aWFsID0gWydfYScsICdhJywgJ3onXTtcblx0XHRcdGNvbnN0IGV4cGVjdGVkID0gWydhJywgJ3onLCAnX2EnXTtcblx0XHRcdGFzc2VydEl0ZW1zKGNyZWF0ZUZpbGVJdGVtc01vZGVsKC4uLmluaXRpYWwpLCBleHBlY3RlZCk7XG5cdFx0XHRhc3NlcnRJdGVtcyhjcmVhdGVGb2xkZXJJdGVtc01vZGVsKC4uLmluaXRpYWwpLCBleHBlY3RlZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzaG91bGQgaWdub3JlIHRoZSBkb3QgaW4gZG90ZmlsZXMgd2hlbiBzb3J0aW5nJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0Y29uc3QgaW5pdGlhbCA9IFsnYicsICcuYScsICdhJywgJy5iJ107XG5cdFx0XHRjb25zdCBleHBlY3RlZCA9IFsnLmEnLCAnYScsICdiJywgJy5iJ107XG5cdFx0XHRhc3NlcnRJdGVtcyhjcmVhdGVGaWxlSXRlbXNNb2RlbCguLi5pbml0aWFsKSwgZXhwZWN0ZWQpO1xuXHRcdFx0YXNzZXJ0SXRlbXMoY3JlYXRlRm9sZGVySXRlbXNNb2RlbCguLi5pbml0aWFsKSwgZXhwZWN0ZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnc2hvdWxkIGhhbmRsZSBtYW55IGZpbGVzIGFuZCBmb2xkZXJzIGNvcnJlY3RseScsIGZ1bmN0aW9uICgpIHtcblx0XHRcdC8vIFRoaXMgaXMgVlMgQ29kZSdzIHJvb3QgZGlyZWN0b3J5IHdpdGggc29tZSBweXRob24gaXRlbXMgYWRkZWQgdGhhdCBoYXZlIHNwZWNpYWxcblx0XHRcdC8vIHNvcnRpbmdcblx0XHRcdGNvbnN0IGl0ZW1zID0gW1xuXHRcdFx0XHQuLi5jcmVhdGVGb2xkZXJJdGVtcyhcblx0XHRcdFx0XHQnX19weWNhY2hlJyxcblx0XHRcdFx0XHQnLmJ1aWxkJyxcblx0XHRcdFx0XHQnLmNvbmZpZ3VyYXRpb25zJyxcblx0XHRcdFx0XHQnLmRldmNvbnRhaW5lcicsXG5cdFx0XHRcdFx0Jy5lc2xpbnQtcGx1Z2luLWxvY2FsJyxcblx0XHRcdFx0XHQnLmdpdGh1YicsXG5cdFx0XHRcdFx0Jy5wcm9maWxlLW9zcycsXG5cdFx0XHRcdFx0Jy52c2NvZGUnLFxuXHRcdFx0XHRcdCcudnNjb2RlLXRlc3QnLFxuXHRcdFx0XHRcdCdidWlsZCcsXG5cdFx0XHRcdFx0J2NsaScsXG5cdFx0XHRcdFx0J2V4dGVuc2lvbnMnLFxuXHRcdFx0XHRcdCdub2RlX21vZHVsZXMnLFxuXHRcdFx0XHRcdCdvdXQnLFxuXHRcdFx0XHRcdCdyZW1vdGUnLFxuXHRcdFx0XHRcdCdyZXNvdXJjZXMnLFxuXHRcdFx0XHRcdCdzY3JpcHRzJyxcblx0XHRcdFx0XHQnc3JjJyxcblx0XHRcdFx0XHQndGVzdCcsXG5cdFx0XHRcdCksXG5cdFx0XHRcdC4uLmNyZWF0ZUZpbGVJdGVtcyhcblx0XHRcdFx0XHQnX19pbml0X18ucHknLFxuXHRcdFx0XHRcdCcuZWRpdG9yY29uZmlnJyxcblx0XHRcdFx0XHQnLmVzbGludC1pZ25vcmUnLFxuXHRcdFx0XHRcdCcuZ2l0LWJsYW1lLWlnbm9yZS1yZXZzJyxcblx0XHRcdFx0XHQnLmdpdGF0dHJpYnV0ZXMnLFxuXHRcdFx0XHRcdCcuZ2l0aWdub3JlJyxcblx0XHRcdFx0XHQnLmxzaWZyYy5qc29uJyxcblx0XHRcdFx0XHQnLm1haWxtYXAnLFxuXHRcdFx0XHRcdCcubWVudGlvbi1ib3QnLFxuXHRcdFx0XHRcdCcubnBtcmMnLFxuXHRcdFx0XHRcdCcubnZtcmMnLFxuXHRcdFx0XHRcdCcudnNjb2RlLXRlc3QuanMnLFxuXHRcdFx0XHRcdCdjZ2xpY2Vuc2VzLmpzb24nLFxuXHRcdFx0XHRcdCdjZ21hbmlmZXN0Lmpzb24nLFxuXHRcdFx0XHRcdCdDb2RlUUwueW1sJyxcblx0XHRcdFx0XHQnQ09OVFJJQlVUSU5HLm1kJyxcblx0XHRcdFx0XHQnZXNsaW50LmNvbmZpZy5qcycsXG5cdFx0XHRcdFx0J2d1bHBmaWxlLmpzJyxcblx0XHRcdFx0XHQnTElDRU5TRS50eHQnLFxuXHRcdFx0XHRcdCdwYWNrYWdlLWxvY2suanNvbicsXG5cdFx0XHRcdFx0J3BhY2thZ2UuanNvbicsXG5cdFx0XHRcdFx0J3Byb2R1Y3QuanNvbicsXG5cdFx0XHRcdFx0J1JFQURNRS5tZCcsXG5cdFx0XHRcdFx0J1NFQ1VSSVRZLm1kJyxcblx0XHRcdFx0XHQnVGhpcmRQYXJ0eU5vdGljZXMudHh0Jyxcblx0XHRcdFx0XHQndHNmbXQuanNvbicsXG5cdFx0XHRcdClcblx0XHRcdF07XG5cdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbChpdGVtcywgbmV3IExpbmVDb250ZXh0KCcnLCAwKSk7XG5cdFx0XHRhc3NlcnRJdGVtcyhtb2RlbCwgW1xuXHRcdFx0XHQnLmJ1aWxkJyxcblx0XHRcdFx0J2J1aWxkJyxcblx0XHRcdFx0J2NnbGljZW5zZXMuanNvbicsXG5cdFx0XHRcdCdjZ21hbmlmZXN0Lmpzb24nLFxuXHRcdFx0XHQnY2xpJyxcblx0XHRcdFx0J0NvZGVRTC55bWwnLFxuXHRcdFx0XHQnLmNvbmZpZ3VyYXRpb25zJyxcblx0XHRcdFx0J0NPTlRSSUJVVElORy5tZCcsXG5cdFx0XHRcdCcuZGV2Y29udGFpbmVyJyxcblx0XHRcdFx0Jy5lZGl0b3Jjb25maWcnLFxuXHRcdFx0XHQnZXNsaW50LmNvbmZpZy5qcycsXG5cdFx0XHRcdCcuZXNsaW50LWlnbm9yZScsXG5cdFx0XHRcdCcuZXNsaW50LXBsdWdpbi1sb2NhbCcsXG5cdFx0XHRcdCdleHRlbnNpb25zJyxcblx0XHRcdFx0Jy5naXRhdHRyaWJ1dGVzJyxcblx0XHRcdFx0Jy5naXQtYmxhbWUtaWdub3JlLXJldnMnLFxuXHRcdFx0XHQnLmdpdGh1YicsXG5cdFx0XHRcdCcuZ2l0aWdub3JlJyxcblx0XHRcdFx0J2d1bHBmaWxlLmpzJyxcblx0XHRcdFx0J0xJQ0VOU0UudHh0Jyxcblx0XHRcdFx0Jy5sc2lmcmMuanNvbicsXG5cdFx0XHRcdCcubWFpbG1hcCcsXG5cdFx0XHRcdCcubWVudGlvbi1ib3QnLFxuXHRcdFx0XHQnbm9kZV9tb2R1bGVzJyxcblx0XHRcdFx0Jy5ucG1yYycsXG5cdFx0XHRcdCcubnZtcmMnLFxuXHRcdFx0XHQnb3V0Jyxcblx0XHRcdFx0J3BhY2thZ2UuanNvbicsXG5cdFx0XHRcdCdwYWNrYWdlLWxvY2suanNvbicsXG5cdFx0XHRcdCdwcm9kdWN0Lmpzb24nLFxuXHRcdFx0XHQnLnByb2ZpbGUtb3NzJyxcblx0XHRcdFx0J1JFQURNRS5tZCcsXG5cdFx0XHRcdCdyZW1vdGUnLFxuXHRcdFx0XHQncmVzb3VyY2VzJyxcblx0XHRcdFx0J3NjcmlwdHMnLFxuXHRcdFx0XHQnU0VDVVJJVFkubWQnLFxuXHRcdFx0XHQnc3JjJyxcblx0XHRcdFx0J3Rlc3QnLFxuXHRcdFx0XHQnVGhpcmRQYXJ0eU5vdGljZXMudHh0Jyxcblx0XHRcdFx0J3RzZm10Lmpzb24nLFxuXHRcdFx0XHQnLnZzY29kZScsXG5cdFx0XHRcdCcudnNjb2RlLXRlc3QnLFxuXHRcdFx0XHQnLnZzY29kZS10ZXN0LmpzJyxcblx0XHRcdFx0J19faW5pdF9fLnB5Jyxcblx0XHRcdFx0J19fcHljYWNoZScsXG5cdFx0XHRdKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ2lubGluZSBjb21wbGV0aW9ucycsICgpID0+IHtcblx0XHRmdW5jdGlvbiBjcmVhdGVJdGVtcyhraW5kOiBUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uIHwgVGVybWluYWxDb21wbGV0aW9uSXRlbUtpbmQuSW5saW5lU3VnZ2VzdGlvbkFsd2F5c09uVG9wKSB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHQuLi5jcmVhdGVGb2xkZXJJdGVtcygnYScsICdjJyksXG5cdFx0XHRcdC4uLmNyZWF0ZUZpbGVJdGVtcygnYicsICdkJyksXG5cdFx0XHRcdG5ldyBUZXJtaW5hbENvbXBsZXRpb25JdGVtKHtcblx0XHRcdFx0XHRsYWJlbDogJ2FiJyxcblx0XHRcdFx0XHRwcm92aWRlcjogJ2NvcmUnLFxuXHRcdFx0XHRcdHJlcGxhY2VtZW50SW5kZXg6IDAsXG5cdFx0XHRcdFx0cmVwbGFjZW1lbnRMZW5ndGg6IDAsXG5cdFx0XHRcdFx0a2luZFxuXHRcdFx0XHR9KVxuXHRcdFx0XTtcblx0XHR9XG5cdFx0c3VpdGUoJ0lubGluZVN1Z2dlc3Rpb24nLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgcHV0IG9uIHRvcCBnZW5lcmFsbHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsKGNyZWF0ZUl0ZW1zKFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLklubGluZVN1Z2dlc3Rpb24pLCBuZXcgTGluZUNvbnRleHQoJycsIDApKTtcblx0XHRcdFx0c3RyaWN0RXF1YWwobW9kZWwuaXRlbXNbMF0uY29tcGxldGlvbi5sYWJlbCwgJ2FiJyk7XG5cdFx0XHR9KTtcblx0XHRcdHRlc3QoJ3Nob3VsZCBOT1QgcHV0IG9uIHRvcCB3aGVuIHRoZXJlXFwncyBhbiBleGFjdCBtYXRjaCBvZiBhbm90aGVyIGl0ZW0nLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsKGNyZWF0ZUl0ZW1zKFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLklubGluZVN1Z2dlc3Rpb24pLCBuZXcgTGluZUNvbnRleHQoJ2EnLCAwKSk7XG5cdFx0XHRcdG5vdFN0cmljdEVxdWFsKG1vZGVsLml0ZW1zWzBdLmNvbXBsZXRpb24ubGFiZWwsICdhYicpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChtb2RlbC5pdGVtc1sxXS5jb21wbGV0aW9uLmxhYmVsLCAnYWInKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHRcdHN1aXRlKCdJbmxpbmVTdWdnZXN0aW9uQWx3YXlzT25Ub3AnLCAoKSA9PiB7XG5cdFx0XHR0ZXN0KCdzaG91bGQgcHV0IG9uIHRvcCBnZW5lcmFsbHknLCBmdW5jdGlvbiAoKSB7XG5cdFx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IFRlcm1pbmFsQ29tcGxldGlvbk1vZGVsKGNyZWF0ZUl0ZW1zKFRlcm1pbmFsQ29tcGxldGlvbkl0ZW1LaW5kLklubGluZVN1Z2dlc3Rpb25BbHdheXNPblRvcCksIG5ldyBMaW5lQ29udGV4dCgnJywgMCkpO1xuXHRcdFx0XHRzdHJpY3RFcXVhbChtb2RlbC5pdGVtc1swXS5jb21wbGV0aW9uLmxhYmVsLCAnYWInKTtcblx0XHRcdH0pO1xuXHRcdFx0dGVzdCgnc2hvdWxkIHB1dCBvbiB0b3AgZXZlbiBpZiB0aGVyZVxcJ3MgYW4gZXhhY3QgbWF0Y2ggb2YgYW5vdGhlciBpdGVtJywgZnVuY3Rpb24gKCkge1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IG5ldyBUZXJtaW5hbENvbXBsZXRpb25Nb2RlbChjcmVhdGVJdGVtcyhUZXJtaW5hbENvbXBsZXRpb25JdGVtS2luZC5JbmxpbmVTdWdnZXN0aW9uQWx3YXlzT25Ub3ApLCBuZXcgTGluZUNvbnRleHQoJ2EnLCAwKSk7XG5cdFx0XHRcdHN0cmljdEVxdWFsKG1vZGVsLml0ZW1zWzBdLmNvbXBsZXRpb24ubGFiZWwsICdhYicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFJQSxPQUFPLFVBQVUsZ0JBQWdCLG1CQUFtQjtBQUNwRCxTQUFTLCtDQUErQztBQUN4RCxTQUFTLCtCQUErQjtBQUN4QyxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHdCQUF3QixrQ0FBNEQ7QUFFN0YsU0FBUyxXQUFXLFNBQStEO0FBQ2xGLFNBQU8sSUFBSSx1QkFBdUI7QUFBQSxJQUNqQyxHQUFHO0FBQUEsSUFDSCxNQUFNLFFBQVEsUUFBUSwyQkFBMkI7QUFBQSxJQUNqRCxPQUFPLFFBQVEsU0FBUztBQUFBLElBQ3hCLFVBQVUsUUFBUSxZQUFZO0FBQUEsSUFDOUIsa0JBQWtCLFFBQVEsb0JBQW9CO0FBQUEsSUFDOUMsbUJBQW1CLFFBQVEscUJBQXFCO0FBQUEsRUFDakQsQ0FBQztBQUNGO0FBRUEsU0FBUyxtQkFBbUIsUUFBNEM7QUFDdkUsU0FBTyxPQUFPLElBQUksV0FBUyxXQUFXLEVBQUUsT0FBTyxNQUFNLDJCQUEyQixLQUFLLENBQUMsQ0FBQztBQUN4RjtBQUVBLFNBQVMsd0JBQXdCLFFBQTJDO0FBQzNFLFNBQU8sSUFBSTtBQUFBLElBQ1YsZ0JBQWdCLEdBQUcsTUFBTTtBQUFBLElBQ3pCLElBQUksWUFBWSxJQUFJLENBQUM7QUFBQSxFQUN0QjtBQUNEO0FBRUEsU0FBUyxxQkFBcUIsUUFBNEM7QUFDekUsU0FBTyxPQUFPLElBQUksV0FBUyxXQUFXLEVBQUUsT0FBTyxNQUFNLDJCQUEyQixPQUFPLENBQUMsQ0FBQztBQUMxRjtBQUVBLFNBQVMsMEJBQTBCLFFBQTJDO0FBQzdFLFNBQU8sSUFBSTtBQUFBLElBQ1Ysa0JBQWtCLEdBQUcsTUFBTTtBQUFBLElBQzNCLElBQUksWUFBWSxJQUFJLENBQUM7QUFBQSxFQUN0QjtBQUNEO0FBRUEsU0FB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QTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsUUFDQSxHQUFHO0FBQUEsVUFDRjtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxVQUNBO0FBQUEsVUFDQTtBQUFBLFVBQ0E7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUNBLFlBQU1BLFNBQVEsSUFBSSx3QkFBd0IsT0FBTyxJQUFJLFlBQVksSUFBSSxDQUFDLENBQUM7QUFDdkUsa0JBQVlBLFFBQU87QUFBQSxRQUNsQjtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsUUFDQTtBQUFBLFFBQ0E7QUFBQSxRQUNBO0FBQUEsTUFDRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBRUQsUUFBTSxzQkFBc0IsTUFBTTtBQUNqQyxhQUFTLFlBQVksTUFBNEc7QUFDaEksYUFBTztBQUFBLFFBQ04sR0FBRyxrQkFBa0IsS0FBSyxHQUFHO0FBQUEsUUFDN0IsR0FBRyxnQkFBZ0IsS0FBSyxHQUFHO0FBQUEsUUFDM0IsSUFBSSx1QkFBdUI7QUFBQSxVQUMxQixPQUFPO0FBQUEsVUFDUCxVQUFVO0FBQUEsVUFDVixrQkFBa0I7QUFBQSxVQUNsQixtQkFBbUI7QUFBQSxVQUNuQjtBQUFBLFFBQ0QsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQ0EsVUFBTSxvQkFBb0IsTUFBTTtBQUMvQixXQUFLLCtCQUErQixXQUFZO0FBQy9DLGNBQU1BLFNBQVEsSUFBSSx3QkFBd0IsWUFBWSwyQkFBMkIsZ0JBQWdCLEdBQUcsSUFBSSxZQUFZLElBQUksQ0FBQyxDQUFDO0FBQzFILG9CQUFZQSxPQUFNLE1BQU0sQ0FBQyxFQUFFLFdBQVcsT0FBTyxJQUFJO0FBQUEsTUFDbEQsQ0FBQztBQUNELFdBQUsscUVBQXNFLFdBQVk7QUFDdEYsY0FBTUEsU0FBUSxJQUFJLHdCQUF3QixZQUFZLDJCQUEyQixnQkFBZ0IsR0FBRyxJQUFJLFlBQVksS0FBSyxDQUFDLENBQUM7QUFDM0gsdUJBQWVBLE9BQU0sTUFBTSxDQUFDLEVBQUUsV0FBVyxPQUFPLElBQUk7QUFDcEQsb0JBQVlBLE9BQU0sTUFBTSxDQUFDLEVBQUUsV0FBVyxPQUFPLElBQUk7QUFBQSxNQUNsRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQ0QsVUFBTSwrQkFBK0IsTUFBTTtBQUMxQyxXQUFLLCtCQUErQixXQUFZO0FBQy9DLGNBQU1BLFNBQVEsSUFBSSx3QkFBd0IsWUFBWSwyQkFBMkIsMkJBQTJCLEdBQUcsSUFBSSxZQUFZLElBQUksQ0FBQyxDQUFDO0FBQ3JJLG9CQUFZQSxPQUFNLE1BQU0sQ0FBQyxFQUFFLFdBQVcsT0FBTyxJQUFJO0FBQUEsTUFDbEQsQ0FBQztBQUNELFdBQUssb0VBQXFFLFdBQVk7QUFDckYsY0FBTUEsU0FBUSxJQUFJLHdCQUF3QixZQUFZLDJCQUEyQiwyQkFBMkIsR0FBRyxJQUFJLFlBQVksS0FBSyxDQUFDLENBQUM7QUFDdEksb0JBQVlBLE9BQU0sTUFBTSxDQUFDLEVBQUUsV0FBVyxPQUFPLElBQUk7QUFBQSxNQUNsRCxDQUFDO0FBQUEsSUFDRixDQUFDO0FBQUEsRUFDRixDQUFDO0FBQ0YsQ0FBQzsiLAogICJuYW1lcyI6IFsibW9kZWwiXQp9Cg==
