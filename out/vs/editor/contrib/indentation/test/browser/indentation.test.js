import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ILanguageConfigurationService } from "../../../../common/languages/languageConfigurationRegistry.js";
import { createTextModel } from "../../../../test/common/testTextModel.js";
import { Range } from "../../../../common/core/range.js";
import { Selection } from "../../../../common/core/selection.js";
import { MetadataConsts, StandardTokenType } from "../../../../common/encodedTokenAttributes.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../../common/languages.js";
import { ILanguageService } from "../../../../common/languages/language.js";
import { NullState } from "../../../../common/languages/nullTokenize.js";
import { AutoIndentOnPaste, IndentationToSpacesCommand, IndentationToTabsCommand } from "../../browser/indentation.js";
import { withTestCodeEditor } from "../../../../test/browser/testCodeEditor.js";
import { testCommand } from "../../../../test/browser/testCommand.js";
import { goIndentationRules, htmlIndentationRules, javascriptIndentationRules, latexIndentationRules, luaIndentationRules, phpIndentationRules, rubyIndentationRules } from "../../../../test/common/modes/supports/indentationRules.js";
import { cppOnEnterRules, htmlOnEnterRules, javascriptOnEnterRules, phpOnEnterRules } from "../../../../test/common/modes/supports/onEnterRules.js";
import { TypeOperations } from "../../../../common/cursor/cursorTypeOperations.js";
import { cppBracketRules, goBracketRules, htmlBracketRules, latexBracketRules, luaBracketRules, phpBracketRules, rubyBracketRules, typescriptBracketRules, vbBracketRules } from "../../../../test/common/modes/supports/bracketRules.js";
import { javascriptAutoClosingPairsRules, latexAutoClosingPairsRules } from "../../../../test/common/modes/supports/autoClosingPairsRules.js";
import { LanguageService } from "../../../../common/services/languageService.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { TestLanguageConfigurationService } from "../../../../test/common/modes/testLanguageConfigurationService.js";
var Language = /* @__PURE__ */ ((Language2) => {
  Language2["TypeScript"] = "ts-test";
  Language2["Ruby"] = "ruby-test";
  Language2["PHP"] = "php-test";
  Language2["Go"] = "go-test";
  Language2["CPP"] = "cpp-test";
  Language2["HTML"] = "html-test";
  Language2["VB"] = "vb-test";
  Language2["Latex"] = "latex-test";
  Language2["Lua"] = "lua-test";
  return Language2;
})(Language || {});
function testIndentationToSpacesCommand(lines, selection, tabSize, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new IndentationToSpacesCommand(sel, tabSize), expectedLines, expectedSelection);
}
function testIndentationToTabsCommand(lines, selection, tabSize, expectedLines, expectedSelection) {
  testCommand(lines, null, selection, (accessor, sel) => new IndentationToTabsCommand(sel, tabSize), expectedLines, expectedSelection);
}
function registerLanguage(languageService, language) {
  return languageService.registerLanguage({ id: language });
}
function registerLanguageConfiguration(languageConfigurationService, language) {
  switch (language) {
    case "ts-test" /* TypeScript */:
      return languageConfigurationService.register(language, {
        brackets: typescriptBracketRules,
        comments: {
          lineComment: "//",
          blockComment: ["/*", "*/"]
        },
        autoClosingPairs: javascriptAutoClosingPairsRules,
        indentationRules: javascriptIndentationRules,
        onEnterRules: javascriptOnEnterRules
      });
    case "ruby-test" /* Ruby */:
      return languageConfigurationService.register(language, {
        brackets: rubyBracketRules,
        indentationRules: rubyIndentationRules
      });
    case "php-test" /* PHP */:
      return languageConfigurationService.register(language, {
        brackets: phpBracketRules,
        indentationRules: phpIndentationRules,
        onEnterRules: phpOnEnterRules
      });
    case "go-test" /* Go */:
      return languageConfigurationService.register(language, {
        brackets: goBracketRules,
        indentationRules: goIndentationRules
      });
    case "cpp-test" /* CPP */:
      return languageConfigurationService.register(language, {
        brackets: cppBracketRules,
        onEnterRules: cppOnEnterRules
      });
    case "html-test" /* HTML */:
      return languageConfigurationService.register(language, {
        brackets: htmlBracketRules,
        indentationRules: htmlIndentationRules,
        onEnterRules: htmlOnEnterRules
      });
    case "vb-test" /* VB */:
      return languageConfigurationService.register(language, {
        brackets: vbBracketRules
      });
    case "latex-test" /* Latex */:
      return languageConfigurationService.register(language, {
        brackets: latexBracketRules,
        autoClosingPairs: latexAutoClosingPairsRules,
        indentationRules: latexIndentationRules
      });
    case "lua-test" /* Lua */:
      return languageConfigurationService.register(language, {
        brackets: luaBracketRules,
        indentationRules: luaIndentationRules
      });
  }
}
function registerTokenizationSupport(instantiationService, tokens, languageId) {
  let lineIndex = 0;
  const languageService = instantiationService.get(ILanguageService);
  const tokenizationSupport = {
    getInitialState: () => NullState,
    tokenize: void 0,
    tokenizeEncoded: (line, hasEOL, state) => {
      const tokensOnLine = tokens[lineIndex++];
      const encodedLanguageId = languageService.languageIdCodec.encodeLanguageId(languageId);
      const result = new Uint32Array(2 * tokensOnLine.length);
      for (let i = 0; i < tokensOnLine.length; i++) {
        result[2 * i] = tokensOnLine[i].startIndex;
        result[2 * i + 1] = encodedLanguageId << MetadataConsts.LANGUAGEID_OFFSET | tokensOnLine[i].standardTokenType << MetadataConsts.TOKEN_TYPE_OFFSET;
      }
      return new EncodedTokenizationResult(result, state);
    }
  };
  return TokenizationRegistry.register(languageId, tokenizationSupport);
}
suite("Change Indentation to Spaces - TypeScript/Javascript", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("single tabs only at start of line", function() {
    testIndentationToSpacesCommand(
      [
        "first",
        "second line",
        "third line",
        "	fourth line",
        "	fifth"
      ],
      new Selection(2, 3, 2, 3),
      4,
      [
        "first",
        "second line",
        "third line",
        "    fourth line",
        "    fifth"
      ],
      new Selection(2, 3, 2, 3)
    );
  });
  test("multiple tabs at start of line", function() {
    testIndentationToSpacesCommand(
      [
        "		first",
        "	second line",
        "			 third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5),
      3,
      [
        "      first",
        "   second line",
        "          third line",
        "fourth line",
        "fifth"
      ],
      new Selection(1, 9, 1, 9)
    );
  });
  test("multiple tabs", function() {
    testIndentationToSpacesCommand(
      [
        "		first	",
        "	second  	 line 	",
        "			 third line",
        " 	fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5),
      2,
      [
        "    first	",
        "  second  	 line 	",
        "       third line",
        "   fourth line",
        "fifth"
      ],
      new Selection(1, 7, 1, 7)
    );
  });
  test("empty lines", function() {
    testIndentationToSpacesCommand(
      [
        "			",
        "	",
        "		"
      ],
      new Selection(1, 4, 1, 4),
      2,
      [
        "      ",
        "  ",
        "    "
      ],
      new Selection(1, 4, 1, 4)
    );
  });
});
suite("Change Indentation to Tabs -  TypeScript/Javascript", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  test("spaces only at start of line", function() {
    testIndentationToTabsCommand(
      [
        "    first",
        "second line",
        "    third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 2, 3),
      4,
      [
        "	first",
        "second line",
        "	third line",
        "fourth line",
        "fifth"
      ],
      new Selection(2, 3, 2, 3)
    );
  });
  test("multiple spaces at start of line", function() {
    testIndentationToTabsCommand(
      [
        "first",
        "   second line",
        "          third line",
        "fourth line",
        "     fifth"
      ],
      new Selection(1, 5, 1, 5),
      3,
      [
        "first",
        "	second line",
        "			 third line",
        "fourth line",
        "	  fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("multiple spaces", function() {
    testIndentationToTabsCommand(
      [
        "      first   ",
        "  second     line 	",
        "       third line",
        "   fourth line",
        "fifth"
      ],
      new Selection(1, 8, 1, 8),
      2,
      [
        "			first   ",
        "	second     line 	",
        "			 third line",
        "	 fourth line",
        "fifth"
      ],
      new Selection(1, 5, 1, 5)
    );
  });
  test("issue #45996", function() {
    testIndentationToSpacesCommand(
      [
        "	abc"
      ],
      new Selection(1, 3, 1, 3),
      4,
      [
        "    abc"
      ],
      new Selection(1, 6, 1, 6)
    );
  });
});
suite("Indent With Tab - TypeScript/JavaScript", () => {
  const languageId = "ts-test" /* TypeScript */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #63388: perserve correct indentation on tab 1", () => {
    const model = createTextModel([
      "/*",
      " * Comment",
      " * /"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(1, 1, 3, 5));
      editor.executeCommands("editor.action.indentLines", TypeOperations.indent(viewModel.cursorConfig, editor.getModel(), editor.getSelections()));
      assert.strictEqual(model.getValue(), [
        "    /*",
        "     * Comment",
        "     * /"
      ].join("\n"));
    });
  });
  test.skip("issue #63388: perserve correct indentation on tab 2", () => {
    const model = createTextModel([
      "switch (something) {",
      "  case 1:",
      "    whatever();",
      "    break;",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(1, 1, 5, 2));
      editor.executeCommands("editor.action.indentLines", TypeOperations.indent(viewModel.cursorConfig, editor.getModel(), editor.getSelections()));
      assert.strictEqual(model.getValue(), [
        "    switch (something) {",
        "        case 1:",
        "            whatever();",
        "            break;",
        "    }"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Paste - TypeScript/JavaScript", () => {
  const languageId = "ts-test" /* TypeScript */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #119225: Do not add extra leading space when pasting JSDoc", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const pasteText = [
        "/**",
        " * JSDoc",
        " */",
        "function a() {}"
      ].join("\n");
      const tokens = [
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Comment }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 2, standardTokenType: StandardTokenType.Comment },
          { startIndex: 8, standardTokenType: StandardTokenType.Comment }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 1, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Other }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 8, standardTokenType: StandardTokenType.Other },
          { startIndex: 9, standardTokenType: StandardTokenType.Other },
          { startIndex: 10, standardTokenType: StandardTokenType.Other },
          { startIndex: 11, standardTokenType: StandardTokenType.Other },
          { startIndex: 12, standardTokenType: StandardTokenType.Other },
          { startIndex: 13, standardTokenType: StandardTokenType.Other },
          { startIndex: 14, standardTokenType: StandardTokenType.Other },
          { startIndex: 15, standardTokenType: StandardTokenType.Other }
        ]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(pasteText, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(1, 1, 4, 16));
      assert.strictEqual(model.getValue(), pasteText);
    });
  });
  test("issue #167299: Blank line removes indent", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const pasteText = [
        "",
        "export type IncludeReference =",
        "	| BaseReference",
        "	| SelfReference",
        "	| RelativeReference;",
        "",
        "export const enum IncludeReferenceKind {",
        "	Base,",
        "	Self,",
        "	RelativeReference,",
        "}"
      ].join("\n");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(pasteText, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(1, 1, 11, 2));
      assert.strictEqual(model.getValue(), pasteText);
    });
  });
  test("issue #29803: do not indent when pasting text with only one line", () => {
    const model = createTextModel([
      "const linkHandler = new Class(a, b, c,",
      "    d)"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(2, 6, 2, 6));
      const text = ", null";
      viewModel.paste(text, true, void 0, "keyboard");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      autoIndentOnPasteController.trigger(new Range(2, 6, 2, 11));
      assert.strictEqual(model.getValue(), [
        "const linkHandler = new Class(a, b, c,",
        "    d, null)"
      ].join("\n"));
    });
  });
  test("issue #29753: incorrect indentation after comment", () => {
    const model = createTextModel([
      "class A {",
      "    /**",
      "     * used only for debug purposes.",
      "     */",
      "    private _codeInfo: KeyMapping[];",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(5, 24, 5, 34));
      const text = "IMacLinuxKeyMapping";
      viewModel.paste(text, true, void 0, "keyboard");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      autoIndentOnPasteController.trigger(new Range(5, 24, 5, 43));
      assert.strictEqual(model.getValue(), [
        "class A {",
        "    /**",
        "     * used only for debug purposes.",
        "     */",
        "    private _codeInfo: IMacLinuxKeyMapping[];",
        "}"
      ].join("\n"));
    });
  });
  test("issue #29753: incorrect indentation of header comment", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const text = [
        "/*----------------",
        " *  Copyright (c) ",
        " *  Licensed under ...",
        " *-----------------*/"
      ].join("\n");
      viewModel.paste(text, true, void 0, "keyboard");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      autoIndentOnPasteController.trigger(new Range(1, 1, 4, 22));
      assert.strictEqual(model.getValue(), text);
    });
  });
  test("issue #209859: do not do change indentation when pasted inside of a string", () => {
    const initialText = [
      'const foo = "some text',
      "         which is strangely",
      '    indented"'
    ].join("\n");
    const model = createTextModel(initialText, languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const tokens = [
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 12, standardTokenType: StandardTokenType.String }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.String }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.String }
        ]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      editor.setSelection(new Selection(2, 10, 2, 15));
      viewModel.paste("which", true, void 0, "keyboard");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      autoIndentOnPasteController.trigger(new Range(2, 1, 2, 28));
      assert.strictEqual(model.getValue(), initialText);
    });
  });
  test.skip("issue #181065: Incorrect paste of object within comment", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const text = [
        "/**",
        " * @typedef {",
        " * }",
        " */"
      ].join("\n");
      const tokens = [
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Comment }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 2, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Comment },
          { startIndex: 11, standardTokenType: StandardTokenType.Comment },
          { startIndex: 12, standardTokenType: StandardTokenType.Other },
          { startIndex: 13, standardTokenType: StandardTokenType.Other }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 2, standardTokenType: StandardTokenType.Other },
          { startIndex: 3, standardTokenType: StandardTokenType.Other },
          { startIndex: 4, standardTokenType: StandardTokenType.Other }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 1, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Other }
        ]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(1, 1, 4, 4));
      assert.strictEqual(model.getValue(), text);
    });
  });
  test.skip("issue #86301: preserve cursor at inserted indentation level", () => {
    const model = createTextModel([
      "() => {",
      "",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(2, 1, 2, 1));
      const text = [
        "() => {",
        "",
        "}",
        ""
      ].join("\n");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(2, 1, 5, 1));
      assert.strictEqual(model.getValue(), [
        "() => {",
        "    () => {",
        "    ",
        // <- should also be indented
        "    }",
        "    ",
        // <- cursor should be at the end of the indentation
        "}"
      ].join("\n"));
      const selection = viewModel.getSelection();
      assert.deepStrictEqual(selection, new Selection(5, 5, 5, 5));
    });
  });
  test.skip("issue #85781: indent line with extra white space", () => {
    const model = createTextModel([
      "() => {",
      '    console.log("a");',
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(2, 5, 2, 5));
      const text = [
        "() => {",
        '    console.log("b")',
        "}",
        " "
      ].join("\n");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(2, 5, 5, 6));
      assert.strictEqual(model.getValue(), [
        "() => {",
        "    () => {",
        '        console.log("b")',
        "    }",
        '    console.log("a");',
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #29589: incorrect indentation of closing brace on paste", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(2, 5, 2, 5));
      const text = [
        "function makeSub(a,b) {",
        "subsent = sent.substring(a,b);",
        "return subsent;",
        "}"
      ].join("\n");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(1, 1, 4, 2));
      assert.strictEqual(model.getValue(), [
        "function makeSub(a,b) {",
        "subsent = sent.substring(a,b);",
        "return subsent;",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #201420: incorrect indentation when first line is comment", () => {
    const model = createTextModel([
      "function bar() {",
      "",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const tokens = [
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 8, standardTokenType: StandardTokenType.Other },
          { startIndex: 9, standardTokenType: StandardTokenType.Other },
          { startIndex: 12, standardTokenType: StandardTokenType.Other },
          { startIndex: 13, standardTokenType: StandardTokenType.Other },
          { startIndex: 14, standardTokenType: StandardTokenType.Other },
          { startIndex: 15, standardTokenType: StandardTokenType.Other },
          { startIndex: 16, standardTokenType: StandardTokenType.Other }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Comment },
          { startIndex: 2, standardTokenType: StandardTokenType.Comment },
          { startIndex: 3, standardTokenType: StandardTokenType.Comment },
          { startIndex: 10, standardTokenType: StandardTokenType.Comment }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 5, standardTokenType: StandardTokenType.Other },
          { startIndex: 6, standardTokenType: StandardTokenType.Other },
          { startIndex: 9, standardTokenType: StandardTokenType.Other },
          { startIndex: 10, standardTokenType: StandardTokenType.Other },
          { startIndex: 11, standardTokenType: StandardTokenType.Other },
          { startIndex: 12, standardTokenType: StandardTokenType.Other },
          { startIndex: 14, standardTokenType: StandardTokenType.Other }
        ],
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 1, standardTokenType: StandardTokenType.Other }
        ]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      editor.setSelection(new Selection(2, 1, 2, 1));
      const text = [
        "// comment",
        "const foo = 42"
      ].join("\n");
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(2, 1, 3, 15));
      assert.strictEqual(model.getValue(), [
        "function bar() {",
        "    // comment",
        "    const foo = 42",
        "}"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - TypeScript/JavaScript", () => {
  const languageId = "ts-test" /* TypeScript */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #208215: indent after arrow function", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      viewModel.type("const add1 = (n) =>");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const add1 = (n) =>",
        "    "
      ].join("\n"));
    });
  });
  test("issue #208215: indent after arrow function 2", () => {
    const model = createTextModel([
      "const array = [1, 2, 3, 4, 5];",
      "array.map(",
      "    v =>"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(3, 9, 3, 9));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3, 4, 5];",
        "array.map(",
        "    v =>",
        "        "
      ].join("\n"));
    });
  });
  test("issue #116843: indent after arrow function", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      viewModel.type([
        "const add1 = (n) =>",
        "    n + 1;"
      ].join("\n"));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const add1 = (n) =>",
        "    n + 1;",
        ""
      ].join("\n"));
    });
  });
  test("issue #29755: do not add indentation on enter if indentation is already valid", () => {
    const model = createTextModel([
      "function f() {",
      "    const one = 1;",
      "    const two = 2;",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(3, 1, 3, 1));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "function f() {",
        "    const one = 1;",
        "",
        "    const two = 2;",
        "}"
      ].join("\n"));
    });
  });
  test("issue #36090", () => {
    const model = createTextModel([
      "class ItemCtrl {",
      "    getPropertiesByItemId(id) {",
      "        return this.fetchItem(id)",
      "            .then(item => {",
      "                return this.getPropertiesOfItem(item);",
      "            });",
      "    }",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "advanced", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(7, 6, 7, 6));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(
        model.getValue(),
        [
          "class ItemCtrl {",
          "    getPropertiesByItemId(id) {",
          "        return this.fetchItem(id)",
          "            .then(item => {",
          "                return this.getPropertiesOfItem(item);",
          "            });",
          "    }",
          "    ",
          "}"
        ].join("\n")
      );
      assert.deepStrictEqual(editor.getSelection(), new Selection(8, 5, 8, 5));
    });
  });
  test("issue #115304: indent block comment onEnter", () => {
    const model = createTextModel([
      "/** */",
      "function f() {}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "advanced", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 4, 1, 4));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(
        model.getValue(),
        [
          "/**",
          " * ",
          " */",
          "function f() {}"
        ].join("\n")
      );
      assert.deepStrictEqual(editor.getSelection(), new Selection(2, 4, 2, 4));
    });
  });
  test("issue #43244: indent when lambda arrow function is detected, outdent when end is reached", () => {
    const model = createTextModel([
      "const array = [1, 2, 3, 4, 5];",
      "array.map(_)"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 12, 2, 12));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3, 4, 5];",
        "array.map(_",
        "    ",
        ")"
      ].join("\n"));
    });
  });
  test("issue #43244: incorrect indentation after if/for/while without braces", () => {
    const model = createTextModel([
      "function f() {",
      "    if (condition)",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 19, 2, 19));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "function f() {",
        "    if (condition)",
        "        ",
        "}"
      ].join("\n"));
      viewModel.type("return;");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "function f() {",
        "    if (condition)",
        "        return;",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test("issue #208232: incorrect indentation inside of comments", () => {
    const model = createTextModel([
      "/**",
      "indentation done for {",
      "*/"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const tokens = [
        [{ startIndex: 0, standardTokenType: StandardTokenType.Comment }],
        [{ startIndex: 0, standardTokenType: StandardTokenType.Comment }],
        [{ startIndex: 0, standardTokenType: StandardTokenType.Comment }]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      editor.setSelection(new Selection(2, 23, 2, 23));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "/**",
        "indentation done for {",
        "",
        "*/"
      ].join("\n"));
    });
  });
  test("issue #209802: allman style braces in JavaScript", () => {
    const model = createTextModel([
      "if (/*condition*/)"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 19, 1, 19));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (/*condition*/)",
        "    "
      ].join("\n"));
      viewModel.type("{", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (/*condition*/)",
        "{}"
      ].join("\n"));
      editor.setSelection(new Selection(2, 2, 2, 2));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (/*condition*/)",
        "{",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #43244: indent after equal sign is detected", () => {
    const model = createTextModel([
      "const array ="
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 14, 1, 14));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array =",
        "    "
      ].join("\n"));
    });
  });
  test.skip("issue #43244: indent after dot detected after object/array signifying a method call", () => {
    const model = createTextModel([
      "const array = [1, 2, 3];",
      "array."
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 7, 2, 7));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3];",
        "array.",
        "    "
      ].join("\n"));
    });
  });
  test.skip("issue #43244: indent after dot detected on a subsequent line after object/array signifying a method call", () => {
    const model = createTextModel([
      "const array = [1, 2, 3]"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 7, 2, 7));
      viewModel.type("\n", "keyboard");
      viewModel.type(".");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3]",
        "    ."
      ].join("\n"));
    });
  });
  test.skip("issue #43244: keep indentation when methods called on object/array", () => {
    const model = createTextModel([
      "const array = [1, 2, 3]",
      "    .filter(() => true)"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 24, 2, 24));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3]",
        "    .filter(() => true)",
        "    "
      ].join("\n"));
    });
  });
  test.skip("issue #43244: keep indentation when chained methods called on object/array", () => {
    const model = createTextModel([
      "const array = [1, 2, 3]",
      "    .filter(() => true)",
      "    "
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(3, 5, 3, 5));
      viewModel.type(".");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3]",
        "    .filter(() => true)",
        "    ."
        // here we don't want to increase the indentation because we have chained methods
      ].join("\n"));
    });
  });
  test.skip("issue #43244: outdent when a semi-color is detected indicating the end of the assignment", () => {
    const model = createTextModel([
      "const array = [1, 2, 3]",
      "    .filter(() => true);"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 25, 2, 25));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "const array = [1, 2, 3]",
        "    .filter(() => true);",
        ""
      ].join("\n"));
    });
  });
  test.skip("issue #40115: keep indentation when added", () => {
    const model = createTextModel("function foo() {}", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 17, 1, 17));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "function foo() {",
        "    ",
        "}"
      ].join("\n"));
      editor.setSelection(new Selection(2, 5, 2, 5));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "function foo() {",
        "    ",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #193875: incorrect indentation on enter", () => {
    const model = createTextModel([
      "{",
      "    for(;;)",
      "    for(;;) {}",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(3, 14, 3, 14));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "{",
        "    for(;;)",
        "    for(;;) {",
        "        ",
        "    }",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #67678: indent on typing curly brace", () => {
    const model = createTextModel([
      "if (true) {",
      'console.log("a")',
      'console.log("b")',
      ""
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(4, 1, 4, 1));
      viewModel.type("}", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (true) {",
        '    console.log("a")',
        '    console.log("b")',
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #46401: outdent when encountering bracket on line - allman style indentation", () => {
    const model = createTextModel([
      "if (true)",
      "    "
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 5, 2, 5));
      viewModel.type("{}", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (true)",
        "{}"
      ].join("\n"));
      editor.setSelection(new Selection(2, 2, 2, 2));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (true)",
        "{",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #125261: typing closing brace does not keep the current indentation", () => {
    const model = createTextModel([
      "foo {",
      "    "
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "keep", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 5, 2, 5));
      viewModel.type("}", "keyboard");
      assert.strictEqual(model.getValue(), [
        "foo {",
        "}"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - Ruby", () => {
  const languageId = "ruby-test" /* Ruby */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #198350: in or when incorrectly match non keywords for Ruby", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      viewModel.type("def foo\n        i");
      viewModel.type("n", "keyboard");
      assert.strictEqual(model.getValue(), "def foo\n        in");
      viewModel.type(" ", "keyboard");
      assert.strictEqual(model.getValue(), "def foo\nin ");
      viewModel.model.setValue("");
      viewModel.type("  # in");
      assert.strictEqual(model.getValue(), "  # in");
      viewModel.type(" ", "keyboard");
      assert.strictEqual(model.getValue(), "  # in ");
    });
  });
  test.skip("issue #199846: in or when incorrectly match non keywords for Ruby", () => {
    const model = createTextModel("", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      viewModel.type("method('#foo') do");
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "method('#foo') do",
        "    "
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - PHP", () => {
  const languageId = "php-test" /* PHP */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("issue #199050: should not indent after { detected in a string", () => {
    const model = createTextModel("preg_replace('{');", languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      const tokens = [
        [
          { startIndex: 0, standardTokenType: StandardTokenType.Other },
          { startIndex: 13, standardTokenType: StandardTokenType.String },
          { startIndex: 16, standardTokenType: StandardTokenType.Other }
        ]
      ];
      disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
      editor.setSelection(new Selection(1, 54, 1, 54));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "preg_replace('{');",
        ""
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Paste - Go", () => {
  const languageId = "go-test" /* Go */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #199050: should not indent after { detected in a string", () => {
    const model = createTextModel([
      "var s = `",
      "quick  brown",
      "fox",
      "`"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(3, 1, 3, 1));
      const text = "  ";
      const autoIndentOnPasteController = editor.registerAndInstantiateContribution(AutoIndentOnPaste.ID, AutoIndentOnPaste);
      viewModel.paste(text, true, void 0, "keyboard");
      autoIndentOnPasteController.trigger(new Range(3, 1, 3, 3));
      assert.strictEqual(model.getValue(), [
        "var s = `",
        "quick  brown",
        "  fox",
        "`"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - CPP", () => {
  const languageId = "cpp-test" /* CPP */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #178334: incorrect outdent of } when signature spans multiple lines", () => {
    const model = createTextModel([
      "int WINAPI WinMain(bool instance,",
      "    int nshowcmd) {}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 20, 2, 20));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "int WINAPI WinMain(bool instance,",
        "    int nshowcmd) {",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test.skip("issue #118929: incorrect indent when // follows curly brace", () => {
    const model = createTextModel([
      "if (true) { // jaja",
      "}"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 20, 1, 20));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if (true) { // jaja",
        "    ",
        "}"
      ].join("\n"));
    });
  });
  test.skip('issue #111265: auto indentation set to "none" still changes the indentation', () => {
    const model = createTextModel([
      "int func() {",
      "		"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "none", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 3, 2, 3));
      viewModel.type("}", "keyboard");
      assert.strictEqual(model.getValue(), [
        "int func() {",
        "		}"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - HTML", () => {
  const languageId = "html-test" /* HTML */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #61510: incorrect indentation after // in html file", () => {
    const model = createTextModel([
      "<pre>",
      "  foo //I press <Enter> at the end of this line",
      "</pre>"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 48, 2, 48));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        "<pre>",
        "  foo //I press <Enter> at the end of this line",
        "  ",
        "</pre>"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - Visual Basic", () => {
  const languageId = "vb-test" /* VB */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #118932: no indentation in visual basic files", () => {
    const model = createTextModel([
      "if True then",
      "    Some code",
      "    end i"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel, instantiationService) => {
      editor.setSelection(new Selection(3, 10, 3, 10));
      viewModel.type("f", "keyboard");
      assert.strictEqual(model.getValue(), [
        "if True then",
        "    Some code",
        "end if"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - Latex", () => {
  const languageId = "latex-test" /* Latex */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #178075: no auto closing pair when indentation done", () => {
    const model = createTextModel([
      "\\begin{theorem}",
      "    \\end"
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(2, 9, 2, 9));
      viewModel.type("{", "keyboard");
      assert.strictEqual(model.getValue(), [
        "\\begin{theorem}",
        "\\end{}"
      ].join("\n"));
    });
  });
});
suite("Auto Indent On Type - Lua", () => {
  const languageId = "lua-test" /* Lua */;
  let disposables;
  let serviceCollection;
  setup(() => {
    disposables = new DisposableStore();
    const languageService = new LanguageService();
    const languageConfigurationService = new TestLanguageConfigurationService();
    disposables.add(languageService);
    disposables.add(languageConfigurationService);
    disposables.add(registerLanguage(languageService, languageId));
    disposables.add(registerLanguageConfiguration(languageConfigurationService, languageId));
    serviceCollection = new ServiceCollection(
      [ILanguageService, languageService],
      [ILanguageConfigurationService, languageConfigurationService]
    );
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("temp issue because there should be at least one passing test in a suite", () => {
    assert.ok(true);
  });
  test.skip("issue #178075: no auto closing pair when indentation done", () => {
    const model = createTextModel([
      'print("asdf function asdf")'
    ].join("\n"), languageId, {});
    disposables.add(model);
    withTestCodeEditor(model, { autoIndent: "full", serviceCollection }, (editor, viewModel) => {
      editor.setSelection(new Selection(1, 28, 1, 28));
      viewModel.type("\n", "keyboard");
      assert.strictEqual(model.getValue(), [
        'print("asdf function asdf")',
        ""
      ].join("\n"));
    });
  });
});
export {
  Language,
  registerLanguage,
  registerLanguageConfiguration,
  registerTokenizationSupport
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmRlbnRhdGlvbi90ZXN0L2Jyb3dzZXIvaW5kZW50YXRpb24udGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3NlbGVjdGlvbi5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cywgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0LCBJU3RhdGUsIElUb2tlbml6YXRpb25TdXBwb3J0LCBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgTnVsbFN0YXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9udWxsVG9rZW5pemUuanMnO1xuaW1wb3J0IHsgQXV0b0luZGVudE9uUGFzdGUsIEluZGVudGF0aW9uVG9TcGFjZXNDb21tYW5kLCBJbmRlbnRhdGlvblRvVGFic0NvbW1hbmQgfSBmcm9tICcuLi8uLi9icm93c2VyL2luZGVudGF0aW9uLmpzJztcbmltcG9ydCB7IHdpdGhUZXN0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci90ZXN0Q29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyB0ZXN0Q29tbWFuZCB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvYnJvd3Nlci90ZXN0Q29tbWFuZC5qcyc7XG5pbXBvcnQgeyBnb0luZGVudGF0aW9uUnVsZXMsIGh0bWxJbmRlbnRhdGlvblJ1bGVzLCBqYXZhc2NyaXB0SW5kZW50YXRpb25SdWxlcywgbGF0ZXhJbmRlbnRhdGlvblJ1bGVzLCBsdWFJbmRlbnRhdGlvblJ1bGVzLCBwaHBJbmRlbnRhdGlvblJ1bGVzLCBydWJ5SW5kZW50YXRpb25SdWxlcyB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL21vZGVzL3N1cHBvcnRzL2luZGVudGF0aW9uUnVsZXMuanMnO1xuaW1wb3J0IHsgY3BwT25FbnRlclJ1bGVzLCBodG1sT25FbnRlclJ1bGVzLCBqYXZhc2NyaXB0T25FbnRlclJ1bGVzLCBwaHBPbkVudGVyUnVsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy9zdXBwb3J0cy9vbkVudGVyUnVsZXMuanMnO1xuaW1wb3J0IHsgVHlwZU9wZXJhdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY3Vyc29yL2N1cnNvclR5cGVPcGVyYXRpb25zLmpzJztcbmltcG9ydCB7IGNwcEJyYWNrZXRSdWxlcywgZ29CcmFja2V0UnVsZXMsIGh0bWxCcmFja2V0UnVsZXMsIGxhdGV4QnJhY2tldFJ1bGVzLCBsdWFCcmFja2V0UnVsZXMsIHBocEJyYWNrZXRSdWxlcywgcnVieUJyYWNrZXRSdWxlcywgdHlwZXNjcmlwdEJyYWNrZXRSdWxlcywgdmJCcmFja2V0UnVsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy9zdXBwb3J0cy9icmFja2V0UnVsZXMuanMnO1xuaW1wb3J0IHsgamF2YXNjcmlwdEF1dG9DbG9zaW5nUGFpcnNSdWxlcywgbGF0ZXhBdXRvQ2xvc2luZ1BhaXJzUnVsZXMgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2NvbW1vbi9tb2Rlcy9zdXBwb3J0cy9hdXRvQ2xvc2luZ1BhaXJzUnVsZXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vbW9kZXMvdGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuXG5leHBvcnQgZW51bSBMYW5ndWFnZSB7XG5cdFR5cGVTY3JpcHQgPSAndHMtdGVzdCcsXG5cdFJ1YnkgPSAncnVieS10ZXN0Jyxcblx0UEhQID0gJ3BocC10ZXN0Jyxcblx0R28gPSAnZ28tdGVzdCcsXG5cdENQUCA9ICdjcHAtdGVzdCcsXG5cdEhUTUwgPSAnaHRtbC10ZXN0Jyxcblx0VkIgPSAndmItdGVzdCcsXG5cdExhdGV4ID0gJ2xhdGV4LXRlc3QnLFxuXHRMdWEgPSAnbHVhLXRlc3QnXG59XG5cbmZ1bmN0aW9uIHRlc3RJbmRlbnRhdGlvblRvU3BhY2VzQ29tbWFuZChsaW5lczogc3RyaW5nW10sIHNlbGVjdGlvbjogU2VsZWN0aW9uLCB0YWJTaXplOiBudW1iZXIsIGV4cGVjdGVkTGluZXM6IHN0cmluZ1tdLCBleHBlY3RlZFNlbGVjdGlvbjogU2VsZWN0aW9uKTogdm9pZCB7XG5cdHRlc3RDb21tYW5kKGxpbmVzLCBudWxsLCBzZWxlY3Rpb24sIChhY2Nlc3Nvciwgc2VsKSA9PiBuZXcgSW5kZW50YXRpb25Ub1NwYWNlc0NvbW1hbmQoc2VsLCB0YWJTaXplKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xufVxuXG5mdW5jdGlvbiB0ZXN0SW5kZW50YXRpb25Ub1RhYnNDb21tYW5kKGxpbmVzOiBzdHJpbmdbXSwgc2VsZWN0aW9uOiBTZWxlY3Rpb24sIHRhYlNpemU6IG51bWJlciwgZXhwZWN0ZWRMaW5lczogc3RyaW5nW10sIGV4cGVjdGVkU2VsZWN0aW9uOiBTZWxlY3Rpb24pOiB2b2lkIHtcblx0dGVzdENvbW1hbmQobGluZXMsIG51bGwsIHNlbGVjdGlvbiwgKGFjY2Vzc29yLCBzZWwpID0+IG5ldyBJbmRlbnRhdGlvblRvVGFic0NvbW1hbmQoc2VsLCB0YWJTaXplKSwgZXhwZWN0ZWRMaW5lcywgZXhwZWN0ZWRTZWxlY3Rpb24pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJMYW5ndWFnZShsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlOiBMYW5ndWFnZSk6IElEaXNwb3NhYmxlIHtcblx0cmV0dXJuIGxhbmd1YWdlU2VydmljZS5yZWdpc3Rlckxhbmd1YWdlKHsgaWQ6IGxhbmd1YWdlIH0pO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlOiBMYW5ndWFnZSk6IElEaXNwb3NhYmxlIHtcblx0c3dpdGNoIChsYW5ndWFnZSkge1xuXHRcdGNhc2UgTGFuZ3VhZ2UuVHlwZVNjcmlwdDpcblx0XHRcdHJldHVybiBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlLCB7XG5cdFx0XHRcdGJyYWNrZXRzOiB0eXBlc2NyaXB0QnJhY2tldFJ1bGVzLFxuXHRcdFx0XHRjb21tZW50czoge1xuXHRcdFx0XHRcdGxpbmVDb21tZW50OiAnLy8nLFxuXHRcdFx0XHRcdGJsb2NrQ29tbWVudDogWycvKicsICcqLyddXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IGphdmFzY3JpcHRBdXRvQ2xvc2luZ1BhaXJzUnVsZXMsXG5cdFx0XHRcdGluZGVudGF0aW9uUnVsZXM6IGphdmFzY3JpcHRJbmRlbnRhdGlvblJ1bGVzLFxuXHRcdFx0XHRvbkVudGVyUnVsZXM6IGphdmFzY3JpcHRPbkVudGVyUnVsZXNcblx0XHRcdH0pO1xuXHRcdGNhc2UgTGFuZ3VhZ2UuUnVieTpcblx0XHRcdHJldHVybiBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlLCB7XG5cdFx0XHRcdGJyYWNrZXRzOiBydWJ5QnJhY2tldFJ1bGVzLFxuXHRcdFx0XHRpbmRlbnRhdGlvblJ1bGVzOiBydWJ5SW5kZW50YXRpb25SdWxlcyxcblx0XHRcdH0pO1xuXHRcdGNhc2UgTGFuZ3VhZ2UuUEhQOlxuXHRcdFx0cmV0dXJuIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2UsIHtcblx0XHRcdFx0YnJhY2tldHM6IHBocEJyYWNrZXRSdWxlcyxcblx0XHRcdFx0aW5kZW50YXRpb25SdWxlczogcGhwSW5kZW50YXRpb25SdWxlcyxcblx0XHRcdFx0b25FbnRlclJ1bGVzOiBwaHBPbkVudGVyUnVsZXNcblx0XHRcdH0pO1xuXHRcdGNhc2UgTGFuZ3VhZ2UuR286XG5cdFx0XHRyZXR1cm4gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZSwge1xuXHRcdFx0XHRicmFja2V0czogZ29CcmFja2V0UnVsZXMsXG5cdFx0XHRcdGluZGVudGF0aW9uUnVsZXM6IGdvSW5kZW50YXRpb25SdWxlc1xuXHRcdFx0fSk7XG5cdFx0Y2FzZSBMYW5ndWFnZS5DUFA6XG5cdFx0XHRyZXR1cm4gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZSwge1xuXHRcdFx0XHRicmFja2V0czogY3BwQnJhY2tldFJ1bGVzLFxuXHRcdFx0XHRvbkVudGVyUnVsZXM6IGNwcE9uRW50ZXJSdWxlc1xuXHRcdFx0fSk7XG5cdFx0Y2FzZSBMYW5ndWFnZS5IVE1MOlxuXHRcdFx0cmV0dXJuIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2UsIHtcblx0XHRcdFx0YnJhY2tldHM6IGh0bWxCcmFja2V0UnVsZXMsXG5cdFx0XHRcdGluZGVudGF0aW9uUnVsZXM6IGh0bWxJbmRlbnRhdGlvblJ1bGVzLFxuXHRcdFx0XHRvbkVudGVyUnVsZXM6IGh0bWxPbkVudGVyUnVsZXNcblx0XHRcdH0pO1xuXHRcdGNhc2UgTGFuZ3VhZ2UuVkI6XG5cdFx0XHRyZXR1cm4gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZSwge1xuXHRcdFx0XHRicmFja2V0czogdmJCcmFja2V0UnVsZXMsXG5cdFx0XHR9KTtcblx0XHRjYXNlIExhbmd1YWdlLkxhdGV4OlxuXHRcdFx0cmV0dXJuIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2UsIHtcblx0XHRcdFx0YnJhY2tldHM6IGxhdGV4QnJhY2tldFJ1bGVzLFxuXHRcdFx0XHRhdXRvQ2xvc2luZ1BhaXJzOiBsYXRleEF1dG9DbG9zaW5nUGFpcnNSdWxlcyxcblx0XHRcdFx0aW5kZW50YXRpb25SdWxlczogbGF0ZXhJbmRlbnRhdGlvblJ1bGVzXG5cdFx0XHR9KTtcblx0XHRjYXNlIExhbmd1YWdlLkx1YTpcblx0XHRcdHJldHVybiBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnJlZ2lzdGVyKGxhbmd1YWdlLCB7XG5cdFx0XHRcdGJyYWNrZXRzOiBsdWFCcmFja2V0UnVsZXMsXG5cdFx0XHRcdGluZGVudGF0aW9uUnVsZXM6IGx1YUluZGVudGF0aW9uUnVsZXNcblx0XHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgU3RhbmRhcmRUb2tlblR5cGVEYXRhIHtcblx0c3RhcnRJbmRleDogbnVtYmVyO1xuXHRzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRva2VuaXphdGlvblN1cHBvcnQoaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSwgdG9rZW5zOiBTdGFuZGFyZFRva2VuVHlwZURhdGFbXVtdLCBsYW5ndWFnZUlkOiBMYW5ndWFnZSk6IElEaXNwb3NhYmxlIHtcblx0bGV0IGxpbmVJbmRleCA9IDA7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0Y29uc3QgdG9rZW5pemF0aW9uU3VwcG9ydDogSVRva2VuaXphdGlvblN1cHBvcnQgPSB7XG5cdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0dG9rZW5pemVFbmNvZGVkOiAobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpOiBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0ID0+IHtcblx0XHRcdGNvbnN0IHRva2Vuc09uTGluZSA9IHRva2Vuc1tsaW5lSW5kZXgrK107XG5cdFx0XHRjb25zdCBlbmNvZGVkTGFuZ3VhZ2VJZCA9IGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50MzJBcnJheSgyICogdG9rZW5zT25MaW5lLmxlbmd0aCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vuc09uTGluZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRyZXN1bHRbMiAqIGldID0gdG9rZW5zT25MaW5lW2ldLnN0YXJ0SW5kZXg7XG5cdFx0XHRcdHJlc3VsdFsyICogaSArIDFdID1cblx0XHRcdFx0XHQoXG5cdFx0XHRcdFx0XHQoZW5jb2RlZExhbmd1YWdlSWQgPDwgTWV0YWRhdGFDb25zdHMuTEFOR1VBR0VJRF9PRkZTRVQpXG5cdFx0XHRcdFx0XHR8ICh0b2tlbnNPbkxpbmVbaV0uc3RhbmRhcmRUb2tlblR5cGUgPDwgTWV0YWRhdGFDb25zdHMuVE9LRU5fVFlQRV9PRkZTRVQpXG5cdFx0XHRcdFx0KTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdChyZXN1bHQsIHN0YXRlKTtcblx0XHR9XG5cdH07XG5cdHJldHVybiBUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihsYW5ndWFnZUlkLCB0b2tlbml6YXRpb25TdXBwb3J0KTtcbn1cblxuc3VpdGUoJ0NoYW5nZSBJbmRlbnRhdGlvbiB0byBTcGFjZXMgLSBUeXBlU2NyaXB0L0phdmFzY3JpcHQnLCAoKSA9PiB7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnc2luZ2xlIHRhYnMgb25seSBhdCBzdGFydCBvZiBsaW5lJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RJbmRlbnRhdGlvblRvU3BhY2VzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J2ZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J3RoaXJkIGxpbmUnLFxuXHRcdFx0XHQnXFx0Zm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnXFx0ZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAzLCAyLCAzKSxcblx0XHRcdDQsXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCd0aGlyZCBsaW5lJyxcblx0XHRcdFx0JyAgICBmb3VydGggbGluZScsXG5cdFx0XHRcdCcgICAgZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAzLCAyLCAzKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIHRhYnMgYXQgc3RhcnQgb2YgbGluZScsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0SW5kZW50YXRpb25Ub1NwYWNlc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRmaXJzdCcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdcXHRcXHRcXHQgdGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLFxuXHRcdFx0Myxcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgIGZpcnN0Jyxcblx0XHRcdFx0JyAgIHNlY29uZCBsaW5lJyxcblx0XHRcdFx0JyAgICAgICAgICB0aGlyZCBsaW5lJyxcblx0XHRcdFx0J2ZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgOSwgMSwgOSlcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdtdWx0aXBsZSB0YWJzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RJbmRlbnRhdGlvblRvU3BhY2VzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdFxcdGZpcnN0XFx0Jyxcblx0XHRcdFx0J1xcdHNlY29uZCAgXFx0IGxpbmUgXFx0Jyxcblx0XHRcdFx0J1xcdFxcdFxcdCB0aGlyZCBsaW5lJyxcblx0XHRcdFx0JyBcXHRmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpLFxuXHRcdFx0Mixcblx0XHRcdFtcblx0XHRcdFx0JyAgICBmaXJzdFxcdCcsXG5cdFx0XHRcdCcgIHNlY29uZCAgXFx0IGxpbmUgXFx0Jyxcblx0XHRcdFx0JyAgICAgICB0aGlyZCBsaW5lJyxcblx0XHRcdFx0JyAgIGZvdXJ0aCBsaW5lJyxcblx0XHRcdFx0J2ZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNywgMSwgNylcblx0XHQpO1xuXHR9KTtcblxuXHR0ZXN0KCdlbXB0eSBsaW5lcycsIGZ1bmN0aW9uICgpIHtcblx0XHR0ZXN0SW5kZW50YXRpb25Ub1NwYWNlc0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRcXHQnLFxuXHRcdFx0XHQnXFx0Jyxcblx0XHRcdFx0J1xcdFxcdCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDQsIDEsIDQpLFxuXHRcdFx0Mixcblx0XHRcdFtcblx0XHRcdFx0JyAgICAgICcsXG5cdFx0XHRcdCcgICcsXG5cdFx0XHRcdCcgICAgJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNClcblx0XHQpO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnQ2hhbmdlIEluZGVudGF0aW9uIHRvIFRhYnMgLSAgVHlwZVNjcmlwdC9KYXZhc2NyaXB0JywgKCkgPT4ge1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ3NwYWNlcyBvbmx5IGF0IHN0YXJ0IG9mIGxpbmUnLCBmdW5jdGlvbiAoKSB7XG5cdFx0dGVzdEluZGVudGF0aW9uVG9UYWJzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0JyAgICBmaXJzdCcsXG5cdFx0XHRcdCdzZWNvbmQgbGluZScsXG5cdFx0XHRcdCcgICAgdGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDIsIDMsIDIsIDMpLFxuXHRcdFx0NCxcblx0XHRcdFtcblx0XHRcdFx0J1xcdGZpcnN0Jyxcblx0XHRcdFx0J3NlY29uZCBsaW5lJyxcblx0XHRcdFx0J1xcdHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigyLCAzLCAyLCAzKVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlc3QoJ211bHRpcGxlIHNwYWNlcyBhdCBzdGFydCBvZiBsaW5lJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RJbmRlbnRhdGlvblRvVGFic0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCdmaXJzdCcsXG5cdFx0XHRcdCcgICBzZWNvbmQgbGluZScsXG5cdFx0XHRcdCcgICAgICAgICAgdGhpcmQgbGluZScsXG5cdFx0XHRcdCdmb3VydGggbGluZScsXG5cdFx0XHRcdCcgICAgIGZpZnRoJ1xuXHRcdFx0XSxcblx0XHRcdG5ldyBTZWxlY3Rpb24oMSwgNSwgMSwgNSksXG5cdFx0XHQzLFxuXHRcdFx0W1xuXHRcdFx0XHQnZmlyc3QnLFxuXHRcdFx0XHQnXFx0c2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnXFx0XFx0XFx0IHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnXFx0ICBmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnbXVsdGlwbGUgc3BhY2VzJywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RJbmRlbnRhdGlvblRvVGFic0NvbW1hbmQoXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgICBmaXJzdCAgICcsXG5cdFx0XHRcdCcgIHNlY29uZCAgICAgbGluZSBcXHQnLFxuXHRcdFx0XHQnICAgICAgIHRoaXJkIGxpbmUnLFxuXHRcdFx0XHQnICAgZm91cnRoIGxpbmUnLFxuXHRcdFx0XHQnZmlmdGgnXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCA4LCAxLCA4KSxcblx0XHRcdDIsXG5cdFx0XHRbXG5cdFx0XHRcdCdcXHRcXHRcXHRmaXJzdCAgICcsXG5cdFx0XHRcdCdcXHRzZWNvbmQgICAgIGxpbmUgXFx0Jyxcblx0XHRcdFx0J1xcdFxcdFxcdCB0aGlyZCBsaW5lJyxcblx0XHRcdFx0J1xcdCBmb3VydGggbGluZScsXG5cdFx0XHRcdCdmaWZ0aCdcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDUsIDEsIDUpXG5cdFx0KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQ1OTk2JywgZnVuY3Rpb24gKCkge1xuXHRcdHRlc3RJbmRlbnRhdGlvblRvU3BhY2VzQ29tbWFuZChcblx0XHRcdFtcblx0XHRcdFx0J1xcdGFiYycsXG5cdFx0XHRdLFxuXHRcdFx0bmV3IFNlbGVjdGlvbigxLCAzLCAxLCAzKSxcblx0XHRcdDQsXG5cdFx0XHRbXG5cdFx0XHRcdCcgICAgYWJjJyxcblx0XHRcdF0sXG5cdFx0XHRuZXcgU2VsZWN0aW9uKDEsIDYsIDEsIDYpXG5cdFx0KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0luZGVudCBXaXRoIFRhYiAtIFR5cGVTY3JpcHQvSmF2YVNjcmlwdCcsICgpID0+IHtcblxuXHRjb25zdCBsYW5ndWFnZUlkID0gTGFuZ3VhZ2UuVHlwZVNjcmlwdDtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzYzMzg4OiBwZXJzZXJ2ZSBjb3JyZWN0IGluZGVudGF0aW9uIG9uIHRhYiAxJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzYzMzg4XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnLyonLFxuXHRcdFx0JyAqIENvbW1lbnQnLFxuXHRcdFx0JyAqIC8nLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgMywgNSkpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVDb21tYW5kcygnZWRpdG9yLmFjdGlvbi5pbmRlbnRMaW5lcycsIFR5cGVPcGVyYXRpb25zLmluZGVudCh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCBlZGl0b3IuZ2V0TW9kZWwoKSwgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JyAgICAvKicsXG5cdFx0XHRcdCcgICAgICogQ29tbWVudCcsXG5cdFx0XHRcdCcgICAgICogLycsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjNjMzODg6IHBlcnNlcnZlIGNvcnJlY3QgaW5kZW50YXRpb24gb24gdGFiIDInLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNjMzODhcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdzd2l0Y2ggKHNvbWV0aGluZykgeycsXG5cdFx0XHQnICBjYXNlIDE6Jyxcblx0XHRcdCcgICAgd2hhdGV2ZXIoKTsnLFxuXHRcdFx0JyAgICBicmVhazsnLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMSwgNSwgMikpO1xuXHRcdFx0ZWRpdG9yLmV4ZWN1dGVDb21tYW5kcygnZWRpdG9yLmFjdGlvbi5pbmRlbnRMaW5lcycsIFR5cGVPcGVyYXRpb25zLmluZGVudCh2aWV3TW9kZWwuY3Vyc29yQ29uZmlnLCBlZGl0b3IuZ2V0TW9kZWwoKSwgZWRpdG9yLmdldFNlbGVjdGlvbnMoKSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JyAgICBzd2l0Y2ggKHNvbWV0aGluZykgeycsXG5cdFx0XHRcdCcgICAgICAgIGNhc2UgMTonLFxuXHRcdFx0XHQnICAgICAgICAgICAgd2hhdGV2ZXIoKTsnLFxuXHRcdFx0XHQnICAgICAgICAgICAgYnJlYWs7Jyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnQXV0byBJbmRlbnQgT24gUGFzdGUgLSBUeXBlU2NyaXB0L0phdmFTY3JpcHQnLCAoKSA9PiB7XG5cblx0Y29uc3QgbGFuZ3VhZ2VJZCA9IExhbmd1YWdlLlR5cGVTY3JpcHQ7XG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXHRsZXQgc2VydmljZUNvbGxlY3Rpb246IFNlcnZpY2VDb2xsZWN0aW9uO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VTZXJ2aWNlKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJMYW5ndWFnZShsYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlSWQpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdHNlcnZpY2VDb2xsZWN0aW9uID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lMYW5ndWFnZVNlcnZpY2UsIGxhbmd1YWdlU2VydmljZV0sXG5cdFx0XHRbSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2VdXG5cdFx0KTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0dGVzdCgnaXNzdWUgIzExOTIyNTogRG8gbm90IGFkZCBleHRyYSBsZWFkaW5nIHNwYWNlIHdoZW4gcGFzdGluZyBKU0RvYycsICgpID0+IHtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFwiXCIsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6ICdmdWxsJywgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y29uc3QgcGFzdGVUZXh0ID0gW1xuXHRcdFx0XHQnLyoqJyxcblx0XHRcdFx0JyAqIEpTRG9jJyxcblx0XHRcdFx0JyAqLycsXG5cdFx0XHRcdCdmdW5jdGlvbiBhKCkge30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0Y29uc3QgdG9rZW5zOiBTdGFuZGFyZFRva2VuVHlwZURhdGFbXVtdID0gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50IH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiA4LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDgsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogOSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxMSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxMiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxMywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxNCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxNSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUb2tlbml6YXRpb25TdXBwb3J0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0b2tlbnMsIGxhbmd1YWdlSWQpKTtcblx0XHRcdGNvbnN0IGF1dG9JbmRlbnRPblBhc3RlQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKEF1dG9JbmRlbnRPblBhc3RlLklELCBBdXRvSW5kZW50T25QYXN0ZSk7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUocGFzdGVUZXh0LCB0cnVlLCB1bmRlZmluZWQsICdrZXlib2FyZCcpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDEsIDEsIDQsIDE2KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgcGFzdGVUZXh0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzE2NzI5OTogQmxhbmsgbGluZSByZW1vdmVzIGluZGVudCcsICgpID0+IHtcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFwiXCIsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6ICdmdWxsJywgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXG5cdFx0XHQvLyBubyBuZWVkIGZvciB0b2tlbml6YXRpb24gYmVjYXVzZSB0aGVyZSBhcmUgbm8gY29tbWVudHNcblx0XHRcdGNvbnN0IHBhc3RlVGV4dCA9IFtcblx0XHRcdFx0JycsXG5cdFx0XHRcdCdleHBvcnQgdHlwZSBJbmNsdWRlUmVmZXJlbmNlID0nLFxuXHRcdFx0XHQnXHR8IEJhc2VSZWZlcmVuY2UnLFxuXHRcdFx0XHQnXHR8IFNlbGZSZWZlcmVuY2UnLFxuXHRcdFx0XHQnXHR8IFJlbGF0aXZlUmVmZXJlbmNlOycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnZXhwb3J0IGNvbnN0IGVudW0gSW5jbHVkZVJlZmVyZW5jZUtpbmQgeycsXG5cdFx0XHRcdCdcdEJhc2UsJyxcblx0XHRcdFx0J1x0U2VsZiwnLFxuXHRcdFx0XHQnXHRSZWxhdGl2ZVJlZmVyZW5jZSwnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0uam9pbignXFxuJyk7XG5cblx0XHRcdGNvbnN0IGF1dG9JbmRlbnRPblBhc3RlQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKEF1dG9JbmRlbnRPblBhc3RlLklELCBBdXRvSW5kZW50T25QYXN0ZSk7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUocGFzdGVUZXh0LCB0cnVlLCB1bmRlZmluZWQsICdrZXlib2FyZCcpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDEsIDEsIDExLCAyKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgcGFzdGVUZXh0KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzI5ODAzOiBkbyBub3QgaW5kZW50IHdoZW4gcGFzdGluZyB0ZXh0IHdpdGggb25seSBvbmUgbGluZScsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yOTgwM1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2NvbnN0IGxpbmtIYW5kbGVyID0gbmV3IENsYXNzKGEsIGIsIGMsJyxcblx0XHRcdCcgICAgZCknXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgNiwgMiwgNikpO1xuXHRcdFx0Y29uc3QgdGV4dCA9ICcsIG51bGwnO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKHRleHQsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDIsIDYsIDIsIDExKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY29uc3QgbGlua0hhbmRsZXIgPSBuZXcgQ2xhc3MoYSwgYiwgYywnLFxuXHRcdFx0XHQnICAgIGQsIG51bGwpJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyOTc1MzogaW5jb3JyZWN0IGluZGVudGF0aW9uIGFmdGVyIGNvbW1lbnQnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjk3NTNcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdjbGFzcyBBIHsnLFxuXHRcdFx0JyAgICAvKionLFxuXHRcdFx0JyAgICAgKiB1c2VkIG9ubHkgZm9yIGRlYnVnIHB1cnBvc2VzLicsXG5cdFx0XHQnICAgICAqLycsXG5cdFx0XHQnICAgIHByaXZhdGUgX2NvZGVJbmZvOiBLZXlNYXBwaW5nW107Jyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiAnZnVsbCcsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig1LCAyNCwgNSwgMzQpKTtcblx0XHRcdGNvbnN0IHRleHQgPSAnSU1hY0xpbnV4S2V5TWFwcGluZyc7XG5cdFx0XHR2aWV3TW9kZWwucGFzdGUodGV4dCwgdHJ1ZSwgdW5kZWZpbmVkLCAna2V5Ym9hcmQnKTtcblx0XHRcdGNvbnN0IGF1dG9JbmRlbnRPblBhc3RlQ29udHJvbGxlciA9IGVkaXRvci5yZWdpc3RlckFuZEluc3RhbnRpYXRlQ29udHJpYnV0aW9uKEF1dG9JbmRlbnRPblBhc3RlLklELCBBdXRvSW5kZW50T25QYXN0ZSk7XG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoNSwgMjQsIDUsIDQzKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY2xhc3MgQSB7Jyxcblx0XHRcdFx0JyAgICAvKionLFxuXHRcdFx0XHQnICAgICAqIHVzZWQgb25seSBmb3IgZGVidWcgcHVycG9zZXMuJyxcblx0XHRcdFx0JyAgICAgKi8nLFxuXHRcdFx0XHQnICAgIHByaXZhdGUgX2NvZGVJbmZvOiBJTWFjTGludXhLZXlNYXBwaW5nW107Jyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyOTc1MzogaW5jb3JyZWN0IGluZGVudGF0aW9uIG9mIGhlYWRlciBjb21tZW50JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI5NzUzXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJywgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0XHQnLyotLS0tLS0tLS0tLS0tLS0tJyxcblx0XHRcdFx0JyAqICBDb3B5cmlnaHQgKGMpICcsXG5cdFx0XHRcdCcgKiAgTGljZW5zZWQgdW5kZXIgLi4uJyxcblx0XHRcdFx0JyAqLS0tLS0tLS0tLS0tLS0tLS0qLycsXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKHRleHQsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDEsIDEsIDQsIDIyKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgdGV4dCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMDk4NTk6IGRvIG5vdCBkbyBjaGFuZ2UgaW5kZW50YXRpb24gd2hlbiBwYXN0ZWQgaW5zaWRlIG9mIGEgc3RyaW5nJywgKCkgPT4ge1xuXG5cdFx0Ly8gaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMDk4NTlcblx0XHQvLyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwOTQxOFxuXG5cdFx0Y29uc3QgaW5pdGlhbFRleHQgPSBbXG5cdFx0XHQnY29uc3QgZm9vID0gXCJzb21lIHRleHQnLFxuXHRcdFx0JyAgICAgICAgIHdoaWNoIGlzIHN0cmFuZ2VseScsXG5cdFx0XHQnICAgIGluZGVudGVkXCInXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChpbml0aWFsVGV4dCwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRjb25zdCB0b2tlbnM6IFN0YW5kYXJkVG9rZW5UeXBlRGF0YVtdW10gPSBbXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcgfSxcblx0XHRcdFx0XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZyB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nIH0sXG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUb2tlbml6YXRpb25TdXBwb3J0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0b2tlbnMsIGxhbmd1YWdlSWQpKTtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEwLCAyLCAxNSkpO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKCd3aGljaCcsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDIsIDEsIDIsIDI4KSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgaW5pdGlhbFRleHQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyBGYWlsaW5nIHRlc3RzIGZvdW5kIGluIGlzc3Vlcy4uLlxuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE4MTA2NTogSW5jb3JyZWN0IHBhc3RlIG9mIG9iamVjdCB3aXRoaW4gY29tbWVudCcsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xODEwNjVcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFwiXCIsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6ICdmdWxsJywgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdFx0Jy8qKicsXG5cdFx0XHRcdCcgKiBAdHlwZWRlZiB7Jyxcblx0XHRcdFx0JyAqIH0nLFxuXHRcdFx0XHQnICovJ1xuXHRcdFx0XS5qb2luKCdcXG4nKTtcblx0XHRcdGNvbnN0IHRva2VuczogU3RhbmRhcmRUb2tlblR5cGVEYXRhW11bXSA9IFtcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50IH0sXG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50IH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAyLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDExLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAzLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDQsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRdXG5cdFx0XHRdO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVG9rZW5pemF0aW9uU3VwcG9ydChpbnN0YW50aWF0aW9uU2VydmljZSwgdG9rZW5zLCBsYW5ndWFnZUlkKSk7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKHRleHQsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoMSwgMSwgNCwgNCkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIHRleHQpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ2lzc3VlICM4NjMwMTogcHJlc2VydmUgY3Vyc29yIGF0IGluc2VydGVkIGluZGVudGF0aW9uIGxldmVsJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg2MzAxXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnKCkgPT4geycsXG5cdFx0XHQnJyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiAnZnVsbCcsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxLCAyLCAxKSk7XG5cdFx0XHRjb25zdCB0ZXh0ID0gW1xuXHRcdFx0XHQnKCkgPT4geycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0Y29uc3QgYXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQXV0b0luZGVudE9uUGFzdGUuSUQsIEF1dG9JbmRlbnRPblBhc3RlKTtcblx0XHRcdHZpZXdNb2RlbC5wYXN0ZSh0ZXh0LCB0cnVlLCB1bmRlZmluZWQsICdrZXlib2FyZCcpO1xuXHRcdFx0YXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyLnRyaWdnZXIobmV3IFJhbmdlKDIsIDEsIDUsIDEpKTtcblxuXHRcdFx0Ly8gbm90ZXM6XG5cdFx0XHQvLyB3aHkgaXMgbGluZSAzIG5vdCBpbmRlbnRlZCB0byB0aGUgc2FtZSBsZXZlbCBhcyBsaW5lIDI/XG5cdFx0XHQvLyBsb29rcyBsaWtlIHRoZSBpbmRlbnRhdGlvbiBpcyBpbnNlcnRlZCBjb3JyZWN0bHkgYXQgbGluZSA1LCBidXQgdGhlIGN1cnNvciBkb2VzIG5vdCBhcHBlYXIgYXQgdGhlIG1heGltdW0gaW5kZW50YXRpb24gbGV2ZWw/XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnKCkgPT4geycsXG5cdFx0XHRcdCcgICAgKCkgPT4geycsXG5cdFx0XHRcdCcgICAgJywgLy8gPC0gc2hvdWxkIGFsc28gYmUgaW5kZW50ZWRcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0JyAgICAnLCAvLyA8LSBjdXJzb3Igc2hvdWxkIGJlIGF0IHRoZSBlbmQgb2YgdGhlIGluZGVudGF0aW9uXG5cdFx0XHRcdCd9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXG5cdFx0XHRjb25zdCBzZWxlY3Rpb24gPSB2aWV3TW9kZWwuZ2V0U2VsZWN0aW9uKCk7XG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlbGVjdGlvbiwgbmV3IFNlbGVjdGlvbig1LCA1LCA1LCA1KSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzg1NzgxOiBpbmRlbnQgbGluZSB3aXRoIGV4dHJhIHdoaXRlIHNwYWNlJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg1NzgxXG5cdFx0Ly8gbm90ZTogc3RpbGwgdG8gZGV0ZXJtaW5lIHdoZXRoZXIgdGhpcyBpcyBhIGJ1ZyBvciBub3RcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCcoKSA9PiB7Jyxcblx0XHRcdCcgICAgY29uc29sZS5sb2coXCJhXCIpOycsXG5cdFx0XHQnfScsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXHRcdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdFx0JygpID0+IHsnLFxuXHRcdFx0XHQnICAgIGNvbnNvbGUubG9nKFwiYlwiKScsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdFx0JyAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0Y29uc3QgYXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQXV0b0luZGVudE9uUGFzdGUuSUQsIEF1dG9JbmRlbnRPblBhc3RlKTtcblx0XHRcdHZpZXdNb2RlbC5wYXN0ZSh0ZXh0LCB0cnVlLCB1bmRlZmluZWQsICdrZXlib2FyZCcpO1xuXHRcdFx0Ly8gdG9kb0BhaWRheS1tYXIsIG1ha2Ugc3VyZSByYW5nZSBpcyBjb3JyZWN0LCBhbmQgbWFrZSB0ZXN0IHdvcmsgYXMgaW4gcmVhbCBsaWZlXG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoMiwgNSwgNSwgNikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0JygpID0+IHsnLFxuXHRcdFx0XHQnICAgICgpID0+IHsnLFxuXHRcdFx0XHQnICAgICAgICBjb25zb2xlLmxvZyhcImJcIiknLFxuXHRcdFx0XHQnICAgIH0nLFxuXHRcdFx0XHQnICAgIGNvbnNvbGUubG9nKFwiYVwiKTsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjMjk1ODk6IGluY29ycmVjdCBpbmRlbnRhdGlvbiBvZiBjbG9zaW5nIGJyYWNlIG9uIHBhc3RlJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI5NTg5XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbCgnJywgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2Z1bGwnLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwsIGluc3RhbnRpYXRpb25TZXJ2aWNlKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgNSwgMiwgNSkpO1xuXHRcdFx0Y29uc3QgdGV4dCA9IFtcblx0XHRcdFx0J2Z1bmN0aW9uIG1ha2VTdWIoYSxiKSB7Jyxcblx0XHRcdFx0J3N1YnNlbnQgPSBzZW50LnN1YnN0cmluZyhhLGIpOycsXG5cdFx0XHRcdCdyZXR1cm4gc3Vic2VudDsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdFx0Y29uc3QgYXV0b0luZGVudE9uUGFzdGVDb250cm9sbGVyID0gZWRpdG9yLnJlZ2lzdGVyQW5kSW5zdGFudGlhdGVDb250cmlidXRpb24oQXV0b0luZGVudE9uUGFzdGUuSUQsIEF1dG9JbmRlbnRPblBhc3RlKTtcblx0XHRcdHZpZXdNb2RlbC5wYXN0ZSh0ZXh0LCB0cnVlLCB1bmRlZmluZWQsICdrZXlib2FyZCcpO1xuXHRcdFx0Ly8gdG9kb0BhaWRheS1tYXIsIG1ha2Ugc3VyZSByYW5nZSBpcyBjb3JyZWN0LCBhbmQgbWFrZSB0ZXN0IHdvcmsgYXMgaW4gcmVhbCBsaWZlXG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoMSwgMSwgNCwgMikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2Z1bmN0aW9uIG1ha2VTdWIoYSxiKSB7Jyxcblx0XHRcdFx0J3N1YnNlbnQgPSBzZW50LnN1YnN0cmluZyhhLGIpOycsXG5cdFx0XHRcdCdyZXR1cm4gc3Vic2VudDsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjMjAxNDIwOiBpbmNvcnJlY3QgaW5kZW50YXRpb24gd2hlbiBmaXJzdCBsaW5lIGlzIGNvbW1lbnQnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjAxNDIwXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnZnVuY3Rpb24gYmFyKCkgeycsXG5cdFx0XHQnJyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiAnZnVsbCcsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCwgaW5zdGFudGlhdGlvblNlcnZpY2UpID0+IHtcblx0XHRcdGNvbnN0IHRva2VuczogU3RhbmRhcmRUb2tlblR5cGVEYXRhW11bXSA9IFtcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiA4LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDksIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTQsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTUsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTYsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50IH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAyLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDEwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9XG5cdFx0XHRcdF0sXG5cdFx0XHRcdFtcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogNSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiA2LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDksIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTEsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMTQsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9XSxcblx0XHRcdFx0W1xuXHRcdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfV1cblx0XHRcdF07XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUb2tlbml6YXRpb25TdXBwb3J0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0b2tlbnMsIGxhbmd1YWdlSWQpKTtcblxuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDEsIDIsIDEpKTtcblx0XHRcdGNvbnN0IHRleHQgPSBbXG5cdFx0XHRcdCcvLyBjb21tZW50Jyxcblx0XHRcdFx0J2NvbnN0IGZvbyA9IDQyJyxcblx0XHRcdF0uam9pbignXFxuJyk7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKHRleHQsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoMiwgMSwgMywgMTUpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdmdW5jdGlvbiBiYXIoKSB7Jyxcblx0XHRcdFx0JyAgICAvLyBjb21tZW50Jyxcblx0XHRcdFx0JyAgICBjb25zdCBmb28gPSA0MicsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnQXV0byBJbmRlbnQgT24gVHlwZSAtIFR5cGVTY3JpcHQvSmF2YVNjcmlwdCcsICgpID0+IHtcblxuXHRjb25zdCBsYW5ndWFnZUlkID0gTGFuZ3VhZ2UuVHlwZVNjcmlwdDtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHQvLyBGYWlsaW5nIHRlc3RzIGZyb20gaXNzdWVzLi4uXG5cblx0dGVzdCgnaXNzdWUgIzIwODIxNTogaW5kZW50IGFmdGVyIGFycm93IGZ1bmN0aW9uJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwODIxNVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXCJcIiwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ2NvbnN0IGFkZDEgPSAobikgPT4nKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2NvbnN0IGFkZDEgPSAobikgPT4nLFxuXHRcdFx0XHQnICAgICcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIwODIxNTogaW5kZW50IGFmdGVyIGFycm93IGZ1bmN0aW9uIDInLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA4MjE1XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnY29uc3QgYXJyYXkgPSBbMSwgMiwgMywgNCwgNV07Jyxcblx0XHRcdCdhcnJheS5tYXAoJyxcblx0XHRcdCcgICAgdiA9PicsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDMsIDksIDMsIDkpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDMsIDQsIDVdOycsXG5cdFx0XHRcdCdhcnJheS5tYXAoJyxcblx0XHRcdFx0JyAgICB2ID0+Jyxcblx0XHRcdFx0JyAgICAgICAgJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMxMTY4NDM6IGluZGVudCBhZnRlciBhcnJvdyBmdW5jdGlvbicsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTY4NDNcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFwiXCIsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFtcblx0XHRcdFx0J2NvbnN0IGFkZDEgPSAobikgPT4nLFxuXHRcdFx0XHQnICAgIG4gKyAxOycsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2NvbnN0IGFkZDEgPSAobikgPT4nLFxuXHRcdFx0XHQnICAgIG4gKyAxOycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyOTc1NTogZG8gbm90IGFkZCBpbmRlbnRhdGlvbiBvbiBlbnRlciBpZiBpbmRlbnRhdGlvbiBpcyBhbHJlYWR5IHZhbGlkJywgKCkgPT4ge1xuXG5cdFx0Ly9odHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjk3NTVcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdmdW5jdGlvbiBmKCkgeycsXG5cdFx0XHQnICAgIGNvbnN0IG9uZSA9IDE7Jyxcblx0XHRcdCcgICAgY29uc3QgdHdvID0gMjsnLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigzLCAxLCAzLCAxKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZSgnXFxuJywgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnZnVuY3Rpb24gZigpIHsnLFxuXHRcdFx0XHQnICAgIGNvbnN0IG9uZSA9IDE7Jyxcblx0XHRcdFx0JycsXG5cdFx0XHRcdCcgICAgY29uc3QgdHdvID0gMjsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzM2MDkwJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzM2MDkwXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnY2xhc3MgSXRlbUN0cmwgeycsXG5cdFx0XHQnICAgIGdldFByb3BlcnRpZXNCeUl0ZW1JZChpZCkgeycsXG5cdFx0XHQnICAgICAgICByZXR1cm4gdGhpcy5mZXRjaEl0ZW0oaWQpJyxcblx0XHRcdCcgICAgICAgICAgICAudGhlbihpdGVtID0+IHsnLFxuXHRcdFx0JyAgICAgICAgICAgICAgICByZXR1cm4gdGhpcy5nZXRQcm9wZXJ0aWVzT2ZJdGVtKGl0ZW0pOycsXG5cdFx0XHQnICAgICAgICAgICAgfSk7Jyxcblx0XHRcdCcgICAgfScsXG5cdFx0XHQnfScsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2FkdmFuY2VkJywgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oNywgNiwgNywgNikpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnY2xhc3MgSXRlbUN0cmwgeycsXG5cdFx0XHRcdFx0JyAgICBnZXRQcm9wZXJ0aWVzQnlJdGVtSWQoaWQpIHsnLFxuXHRcdFx0XHRcdCcgICAgICAgIHJldHVybiB0aGlzLmZldGNoSXRlbShpZCknLFxuXHRcdFx0XHRcdCcgICAgICAgICAgICAudGhlbihpdGVtID0+IHsnLFxuXHRcdFx0XHRcdCcgICAgICAgICAgICAgICAgcmV0dXJuIHRoaXMuZ2V0UHJvcGVydGllc09mSXRlbShpdGVtKTsnLFxuXHRcdFx0XHRcdCcgICAgICAgICAgICB9KTsnLFxuXHRcdFx0XHRcdCcgICAgfScsXG5cdFx0XHRcdFx0JyAgICAnLFxuXHRcdFx0XHRcdCd9Jyxcblx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDgsIDUsIDgsIDUpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzExNTMwNDogaW5kZW50IGJsb2NrIGNvbW1lbnQgb25FbnRlcicsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTUzMDRcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCcvKiogKi8nLFxuXHRcdFx0J2Z1bmN0aW9uIGYoKSB7fScsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogJ2FkdmFuY2VkJywgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgNCwgMSwgNCkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoJ1xcbicsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksXG5cdFx0XHRcdFtcblx0XHRcdFx0XHQnLyoqJyxcblx0XHRcdFx0XHQnICogJyxcblx0XHRcdFx0XHQnICovJyxcblx0XHRcdFx0XHQnZnVuY3Rpb24gZigpIHt9Jyxcblx0XHRcdFx0XS5qb2luKCdcXG4nKVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdG9yLmdldFNlbGVjdGlvbigpLCBuZXcgU2VsZWN0aW9uKDIsIDQsIDIsIDQpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQzMjQ0OiBpbmRlbnQgd2hlbiBsYW1iZGEgYXJyb3cgZnVuY3Rpb24gaXMgZGV0ZWN0ZWQsIG91dGRlbnQgd2hlbiBlbmQgaXMgcmVhY2hlZCcsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80MzI0NFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDMsIDQsIDVdOycsXG5cdFx0XHQnYXJyYXkubWFwKF8pJ1xuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAxMiwgMiwgMTIpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDMsIDQsIDVdOycsXG5cdFx0XHRcdCdhcnJheS5tYXAoXycsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0JyknXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzQzMjQ0OiBpbmNvcnJlY3QgaW5kZW50YXRpb24gYWZ0ZXIgaWYvZm9yL3doaWxlIHdpdGhvdXQgYnJhY2VzJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQzMjQ0XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnZnVuY3Rpb24gZigpIHsnLFxuXHRcdFx0JyAgICBpZiAoY29uZGl0aW9uKScsXG5cdFx0XHQnfSdcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMTksIDIsIDE5KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdmdW5jdGlvbiBmKCkgeycsXG5cdFx0XHRcdCcgICAgaWYgKGNvbmRpdGlvbiknLFxuXHRcdFx0XHQnICAgICAgICAnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblxuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJyZXR1cm47XCIpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnZnVuY3Rpb24gZigpIHsnLFxuXHRcdFx0XHQnICAgIGlmIChjb25kaXRpb24pJyxcblx0XHRcdFx0JyAgICAgICAgcmV0dXJuOycsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2lzc3VlICMyMDgyMzI6IGluY29ycmVjdCBpbmRlbnRhdGlvbiBpbnNpZGUgb2YgY29tbWVudHMnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjA4MjMyXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnLyoqJyxcblx0XHRcdCdpbmRlbnRhdGlvbiBkb25lIGZvciB7Jyxcblx0XHRcdCcqLydcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y29uc3QgdG9rZW5zOiBTdGFuZGFyZFRva2VuVHlwZURhdGFbXVtdID0gW1xuXHRcdFx0XHRbeyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudCB9XSxcblx0XHRcdFx0W3sgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLkNvbW1lbnQgfV0sXG5cdFx0XHRcdFt7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5Db21tZW50IH1dXG5cdFx0XHRdO1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVG9rZW5pemF0aW9uU3VwcG9ydChpbnN0YW50aWF0aW9uU2VydmljZSwgdG9rZW5zLCBsYW5ndWFnZUlkKSk7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMjMsIDIsIDIzKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCcvKionLFxuXHRcdFx0XHQnaW5kZW50YXRpb24gZG9uZSBmb3IgeycsXG5cdFx0XHRcdCcnLFxuXHRcdFx0XHQnKi8nXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnaXNzdWUgIzIwOTgwMjogYWxsbWFuIHN0eWxlIGJyYWNlcyBpbiBKYXZhU2NyaXB0JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzIwOTgwMlxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2lmICgvKmNvbmRpdGlvbiovKScsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDE5LCAxLCAxOSkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnaWYgKC8qY29uZGl0aW9uKi8pJyxcblx0XHRcdFx0JyAgICAnXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwie1wiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdpZiAoLypjb25kaXRpb24qLyknLFxuXHRcdFx0XHQne30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAyLCAyLCAyKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdpZiAoLypjb25kaXRpb24qLyknLFxuXHRcdFx0XHQneycsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gRmFpbGluZyB0ZXN0cy4uLlxuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzQzMjQ0OiBpbmRlbnQgYWZ0ZXIgZXF1YWwgc2lnbiBpcyBkZXRlY3RlZCcsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80MzI0NFxuXHRcdC8vIGlzc3VlOiBTaG91bGQgaW5kZW50IGFmdGVyIGFuIGVxdWFsIHNpZ24gaXMgZGV0ZWN0ZWQgZm9sbG93ZWQgYnkgd2hpdGVzcGFjZSBjaGFyYWN0ZXJzLlxuXHRcdC8vIFRoaXMgc2hvdWxkIGJlIG91dGRlbnRlZCB3aGVuIGEgc2VtaS1jb2xvbiBpcyBkZXRlY3RlZCBpbmRpY2F0aW5nIHRoZSBlbmQgb2YgdGhlIGFzc2lnbm1lbnQuXG5cblx0XHQvLyBUT0RPOiByZXF1aXJlcyBleHBsb3JpbmcgaW5kZW50L291dGRlbnQgcGFpcnMgaW5zdGVhZFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2NvbnN0IGFycmF5ID0nXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDEsIDE0LCAxLCAxNCkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY29uc3QgYXJyYXkgPScsXG5cdFx0XHRcdCcgICAgJ1xuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzQzMjQ0OiBpbmRlbnQgYWZ0ZXIgZG90IGRldGVjdGVkIGFmdGVyIG9iamVjdC9hcnJheSBzaWduaWZ5aW5nIGEgbWV0aG9kIGNhbGwnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDMyNDRcblx0XHQvLyBpc3N1ZTogV2hlbiBhIGRvdCBpcyB3cml0dGVuLCB3ZSBzaG91bGQgZGV0ZWN0IHRoYXQgdGhpcyBpcyBhIG1ldGhvZCBjYWxsIGFuZCBpbmRlbnQgYWNjb3JkaW5nbHlcblxuXHRcdC8vIFRPRE86IHJlcXVpcmVzIGV4cGxvcmluZyBpbmRlbnQvb3V0ZGVudCBwYWlycyBpbnN0ZWFkXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnY29uc3QgYXJyYXkgPSBbMSwgMiwgM107Jyxcblx0XHRcdCdhcnJheS4nXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDcsIDIsIDcpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDNdOycsXG5cdFx0XHRcdCdhcnJheS4nLFxuXHRcdFx0XHQnICAgICdcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ2lzc3VlICM0MzI0NDogaW5kZW50IGFmdGVyIGRvdCBkZXRlY3RlZCBvbiBhIHN1YnNlcXVlbnQgbGluZSBhZnRlciBvYmplY3QvYXJyYXkgc2lnbmlmeWluZyBhIG1ldGhvZCBjYWxsJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQzMjQ0XG5cdFx0Ly8gaXNzdWU6IFdoZW4gYSBkb3QgaXMgd3JpdHRlbiwgd2Ugc2hvdWxkIGRldGVjdCB0aGF0IHRoaXMgaXMgYSBtZXRob2QgY2FsbCBhbmQgaW5kZW50IGFjY29yZGluZ2x5XG5cblx0XHQvLyBUT0RPOiByZXF1aXJlcyBleHBsb3JpbmcgaW5kZW50L291dGRlbnQgcGFpcnMgaW5zdGVhZFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDNdJyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgNywgMiwgNykpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIi5cIik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY29uc3QgYXJyYXkgPSBbMSwgMiwgM10nLFxuXHRcdFx0XHQnICAgIC4nXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjNDMyNDQ6IGtlZXAgaW5kZW50YXRpb24gd2hlbiBtZXRob2RzIGNhbGxlZCBvbiBvYmplY3QvYXJyYXknLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDMyNDRcblx0XHQvLyBDdXJyZW50bHkgcGFzc2VzLCBidXQgc2hvdWxkIHBhc3Mgd2l0aCBhbGwgdGhlIHRlc3RzIGFib3ZlIHRvb1xuXG5cdFx0Ly8gVE9ETzogcmVxdWlyZXMgZXhwbG9yaW5nIGluZGVudC9vdXRkZW50IHBhaXJzIGluc3RlYWRcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdjb25zdCBhcnJheSA9IFsxLCAyLCAzXScsXG5cdFx0XHQnICAgIC5maWx0ZXIoKCkgPT4gdHJ1ZSknXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDI0LCAyLCAyNCkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY29uc3QgYXJyYXkgPSBbMSwgMiwgM10nLFxuXHRcdFx0XHQnICAgIC5maWx0ZXIoKCkgPT4gdHJ1ZSknLFxuXHRcdFx0XHQnICAgICdcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ2lzc3VlICM0MzI0NDoga2VlcCBpbmRlbnRhdGlvbiB3aGVuIGNoYWluZWQgbWV0aG9kcyBjYWxsZWQgb24gb2JqZWN0L2FycmF5JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQzMjQ0XG5cdFx0Ly8gV2hlbiB0aGUgY2FsbCBjaGFpbiBpcyBub3QgZmluaXNoZWQgeWV0LCBhbmQgd2UgdHlwZSBhIGRvdCwgd2UgZG8gbm90IHdhbnQgdG8gY2hhbmdlIHRoZSBpbmRlbnRhdGlvblxuXG5cdFx0Ly8gVE9ETzogcmVxdWlyZXMgZXhwbG9yaW5nIGluZGVudC9vdXRkZW50IHBhaXJzIGluc3RlYWRcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdjb25zdCBhcnJheSA9IFsxLCAyLCAzXScsXG5cdFx0XHQnICAgIC5maWx0ZXIoKCkgPT4gdHJ1ZSknLFxuXHRcdFx0JyAgICAnXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDMsIDUsIDMsIDUpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiLlwiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdjb25zdCBhcnJheSA9IFsxLCAyLCAzXScsXG5cdFx0XHRcdCcgICAgLmZpbHRlcigoKSA9PiB0cnVlKScsXG5cdFx0XHRcdCcgICAgLicgLy8gaGVyZSB3ZSBkb24ndCB3YW50IHRvIGluY3JlYXNlIHRoZSBpbmRlbnRhdGlvbiBiZWNhdXNlIHdlIGhhdmUgY2hhaW5lZCBtZXRob2RzXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjNDMyNDQ6IG91dGRlbnQgd2hlbiBhIHNlbWktY29sb3IgaXMgZGV0ZWN0ZWQgaW5kaWNhdGluZyB0aGUgZW5kIG9mIHRoZSBhc3NpZ25tZW50JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQzMjQ0XG5cblx0XHQvLyBUT0RPOiByZXF1aXJlcyBleHBsb3JpbmcgaW5kZW50L291dGRlbnQgcGFpcnMgaW5zdGVhZFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2NvbnN0IGFycmF5ID0gWzEsIDIsIDNdJyxcblx0XHRcdCcgICAgLmZpbHRlcigoKSA9PiB0cnVlKTsnXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDI1LCAyLCAyNSkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnY29uc3QgYXJyYXkgPSBbMSwgMiwgM10nLFxuXHRcdFx0XHQnICAgIC5maWx0ZXIoKCkgPT4gdHJ1ZSk7Jyxcblx0XHRcdFx0Jydcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzQwMTE1OiBrZWVwIGluZGVudGF0aW9uIHdoZW4gYWRkZWQnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDAxMTVcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKCdmdW5jdGlvbiBmb28oKSB7fScsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCAxNywgMSwgMTcpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2Z1bmN0aW9uIGZvbygpIHsnLFxuXHRcdFx0XHQnICAgICcsXG5cdFx0XHRcdCd9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2Z1bmN0aW9uIGZvbygpIHsnLFxuXHRcdFx0XHQnICAgICcsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE5Mzg3NTogaW5jb3JyZWN0IGluZGVudGF0aW9uIG9uIGVudGVyJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5Mzg3NVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J3snLFxuXHRcdFx0JyAgICBmb3IoOzspJyxcblx0XHRcdCcgICAgZm9yKDs7KSB7fScsXG5cdFx0XHQnfScsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDMsIDE0LCAzLCAxNCkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJcXG5cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQneycsXG5cdFx0XHRcdCcgICAgZm9yKDs7KScsXG5cdFx0XHRcdCcgICAgZm9yKDs7KSB7Jyxcblx0XHRcdFx0JyAgICAgICAgJyxcblx0XHRcdFx0JyAgICB9Jyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzY3Njc4OiBpbmRlbnQgb24gdHlwaW5nIGN1cmx5IGJyYWNlJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzY3Njc4XG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnaWYgKHRydWUpIHsnLFxuXHRcdFx0J2NvbnNvbGUubG9nKFwiYVwiKScsXG5cdFx0XHQnY29uc29sZS5sb2coXCJiXCIpJyxcblx0XHRcdCcnLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbig0LCAxLCA0LCAxKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIn1cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnaWYgKHRydWUpIHsnLFxuXHRcdFx0XHQnICAgIGNvbnNvbGUubG9nKFwiYVwiKScsXG5cdFx0XHRcdCcgICAgY29uc29sZS5sb2coXCJiXCIpJyxcblx0XHRcdFx0J30nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzQ2NDAxOiBvdXRkZW50IHdoZW4gZW5jb3VudGVyaW5nIGJyYWNrZXQgb24gbGluZSAtIGFsbG1hbiBzdHlsZSBpbmRlbnRhdGlvbicsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80NjQwMVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2lmICh0cnVlKScsXG5cdFx0XHQnICAgICcsXG5cdFx0XS5qb2luKCdcXG4nKSwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDUsIDIsIDUpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwie31cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnaWYgKHRydWUpJyxcblx0XHRcdFx0J3t9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDIsIDIsIDIsIDIpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2lmICh0cnVlKScsXG5cdFx0XHRcdCd7Jyxcblx0XHRcdFx0JyAgICAnLFxuXHRcdFx0XHQnfSdcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ2lzc3VlICMxMjUyNjE6IHR5cGluZyBjbG9zaW5nIGJyYWNlIGRvZXMgbm90IGtlZXAgdGhlIGN1cnJlbnQgaW5kZW50YXRpb24nLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTI1MjYxXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChbXG5cdFx0XHQnZm9vIHsnLFxuXHRcdFx0JyAgICAnLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwia2VlcFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCA1LCAyLCA1KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIn1cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnZm9vIHsnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0F1dG8gSW5kZW50IE9uIFR5cGUgLSBSdWJ5JywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSBMYW5ndWFnZS5SdWJ5O1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IHNlcnZpY2VDb2xsZWN0aW9uOiBTZXJ2aWNlQ29sbGVjdGlvbjtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gbmV3IExhbmd1YWdlU2VydmljZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyTGFuZ3VhZ2UobGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyTGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlSWQpKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtJTGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2VdLFxuXHRcdFx0W0lMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2lzc3VlICMxOTgzNTA6IGluIG9yIHdoZW4gaW5jb3JyZWN0bHkgbWF0Y2ggbm9uIGtleXdvcmRzIGZvciBSdWJ5JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5ODM1MFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoXCJcIiwgbGFuZ3VhZ2VJZCwge30pO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChtb2RlbCk7XG5cblx0XHR3aXRoVGVzdENvZGVFZGl0b3IobW9kZWwsIHsgYXV0b0luZGVudDogXCJmdWxsXCIsIHNlcnZpY2VDb2xsZWN0aW9uIH0sIChlZGl0b3IsIHZpZXdNb2RlbCkgPT4ge1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJkZWYgZm9vXFxuICAgICAgICBpXCIpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFwiZGVmIGZvb1xcbiAgICAgICAgaW5cIik7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIiBcIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgXCJkZWYgZm9vXFxuaW4gXCIpO1xuXG5cdFx0XHR2aWV3TW9kZWwubW9kZWwuc2V0VmFsdWUoXCJcIik7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIiAgIyBpblwiKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBcIiAgIyBpblwiKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiIFwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBcIiAgIyBpbiBcIik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIEZhaWxpbmcgdGVzdHMuLi5cblxuXHR0ZXN0LnNraXAoJ2lzc3VlICMxOTk4NDY6IGluIG9yIHdoZW4gaW5jb3JyZWN0bHkgbWF0Y2ggbm9uIGtleXdvcmRzIGZvciBSdWJ5JywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE5OTg0NlxuXHRcdC8vIGV4cGxhbmF0aW9uOiBoYXBwZW5pbmcgYmVjYXVzZSB0aGUgIyBpcyBkZXRlY3RlZCBwcm9iYWJseSBhcyBhIGNvbW1lbnRcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFwiXCIsIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwibWV0aG9kKCcjZm9vJykgZG9cIik7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdFwibWV0aG9kKCcjZm9vJykgZG9cIixcblx0XHRcdFx0XCIgICAgXCJcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcbn0pO1xuXG5zdWl0ZSgnQXV0byBJbmRlbnQgT24gVHlwZSAtIFBIUCcsICgpID0+IHtcblxuXHRjb25zdCBsYW5ndWFnZUlkID0gTGFuZ3VhZ2UuUEhQO1xuXHRsZXQgZGlzcG9zYWJsZXM6IERpc3Bvc2FibGVTdG9yZTtcblx0bGV0IHNlcnZpY2VDb2xsZWN0aW9uOiBTZXJ2aWNlQ29sbGVjdGlvbjtcblxuXHRzZXR1cCgoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gbmV3IExhbmd1YWdlU2VydmljZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UgPSBuZXcgVGVzdExhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UoKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VTZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyTGFuZ3VhZ2UobGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyTGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIGxhbmd1YWdlSWQpKTtcblx0XHRzZXJ2aWNlQ29sbGVjdGlvbiA9IG5ldyBTZXJ2aWNlQ29sbGVjdGlvbihcblx0XHRcdFtJTGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2VdLFxuXHRcdFx0W0lMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlXVxuXHRcdCk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2lzc3VlICMxOTkwNTA6IHNob3VsZCBub3QgaW5kZW50IGFmdGVyIHsgZGV0ZWN0ZWQgaW4gYSBzdHJpbmcnLCAoKSA9PiB7XG5cblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTk5MDUwXG5cblx0XHRjb25zdCBtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcInByZWdfcmVwbGFjZSgneycpO1wiLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0Y29uc3QgdG9rZW5zOiBTdGFuZGFyZFRva2VuVHlwZURhdGFbXVtdID0gW1xuXHRcdFx0XHRbXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDEzLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nIH0sXG5cdFx0XHRcdFx0eyBzdGFydEluZGV4OiAxNiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdF1cblx0XHRcdF07XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJUb2tlbml6YXRpb25TdXBwb3J0KGluc3RhbnRpYXRpb25TZXJ2aWNlLCB0b2tlbnMsIGxhbmd1YWdlSWQpKTtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigxLCA1NCwgMSwgNTQpKTtcblx0XHRcdHZpZXdNb2RlbC50eXBlKFwiXFxuXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0XCJwcmVnX3JlcGxhY2UoJ3snKTtcIixcblx0XHRcdFx0XCJcIlxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdBdXRvIEluZGVudCBPbiBQYXN0ZSAtIEdvJywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSBMYW5ndWFnZS5Hbztcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE5OTA1MDogc2hvdWxkIG5vdCBpbmRlbnQgYWZ0ZXIgeyBkZXRlY3RlZCBpbiBhIHN0cmluZycsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xOTkwNTBcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCd2YXIgcyA9IGAnLFxuXHRcdFx0J3F1aWNrICBicm93bicsXG5cdFx0XHQnZm94Jyxcblx0XHRcdCdgJyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMywgMSwgMywgMSkpO1xuXHRcdFx0Y29uc3QgdGV4dCA9ICcgICc7XG5cdFx0XHRjb25zdCBhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIgPSBlZGl0b3IucmVnaXN0ZXJBbmRJbnN0YW50aWF0ZUNvbnRyaWJ1dGlvbihBdXRvSW5kZW50T25QYXN0ZS5JRCwgQXV0b0luZGVudE9uUGFzdGUpO1xuXHRcdFx0dmlld01vZGVsLnBhc3RlKHRleHQsIHRydWUsIHVuZGVmaW5lZCwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhdXRvSW5kZW50T25QYXN0ZUNvbnRyb2xsZXIudHJpZ2dlcihuZXcgUmFuZ2UoMywgMSwgMywgMykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J3ZhciBzID0gYCcsXG5cdFx0XHRcdCdxdWljayAgYnJvd24nLFxuXHRcdFx0XHQnICBmb3gnLFxuXHRcdFx0XHQnYCcsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0F1dG8gSW5kZW50IE9uIFR5cGUgLSBDUFAnLCAoKSA9PiB7XG5cblx0Y29uc3QgbGFuZ3VhZ2VJZCA9IExhbmd1YWdlLkNQUDtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE3ODMzNDogaW5jb3JyZWN0IG91dGRlbnQgb2YgfSB3aGVuIHNpZ25hdHVyZSBzcGFucyBtdWx0aXBsZSBsaW5lcycsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNzgzMzRcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdpbnQgV0lOQVBJIFdpbk1haW4oYm9vbCBpbnN0YW5jZSwnLFxuXHRcdFx0JyAgICBpbnQgbnNob3djbWQpIHt9Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgMjAsIDIsIDIwKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdpbnQgV0lOQVBJIFdpbk1haW4oYm9vbCBpbnN0YW5jZSwnLFxuXHRcdFx0XHQnICAgIGludCBuc2hvd2NtZCkgeycsXG5cdFx0XHRcdCcgICAgJyxcblx0XHRcdFx0J30nXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjMTE4OTI5OiBpbmNvcnJlY3QgaW5kZW50IHdoZW4gLy8gZm9sbG93cyBjdXJseSBicmFjZScsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTg5MjlcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdpZiAodHJ1ZSkgeyAvLyBqYWphJyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMjAsIDEsIDIwKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdpZiAodHJ1ZSkgeyAvLyBqYWphJyxcblx0XHRcdFx0JyAgICAnLFxuXHRcdFx0XHQnfScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdpc3N1ZSAjMTExMjY1OiBhdXRvIGluZGVudGF0aW9uIHNldCB0byBcIm5vbmVcIiBzdGlsbCBjaGFuZ2VzIHRoZSBpbmRlbnRhdGlvbicsICgpID0+IHtcblxuXHRcdC8vIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTEyNjVcblxuXHRcdGNvbnN0IG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFtcblx0XHRcdCdpbnQgZnVuYygpIHsnLFxuXHRcdFx0J1x0XHQnLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwibm9uZVwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCAzLCAyLCAzKSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIn1cIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnaW50IGZ1bmMoKSB7Jyxcblx0XHRcdFx0J1x0XHR9Jyxcblx0XHRcdF0uam9pbignXFxuJykpO1xuXHRcdH0pO1xuXHR9KTtcblxufSk7XG5cbnN1aXRlKCdBdXRvIEluZGVudCBPbiBUeXBlIC0gSFRNTCcsICgpID0+IHtcblxuXHRjb25zdCBsYW5ndWFnZUlkID0gTGFuZ3VhZ2UuSFRNTDtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzYxNTEwOiBpbmNvcnJlY3QgaW5kZW50YXRpb24gYWZ0ZXIgLy8gaW4gaHRtbCBmaWxlJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE3ODMzNFxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0JzxwcmU+Jyxcblx0XHRcdCcgIGZvbyAvL0kgcHJlc3MgPEVudGVyPiBhdCB0aGUgZW5kIG9mIHRoaXMgbGluZScsXG5cdFx0XHQnPC9wcmU+Jyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMiwgNDgsIDIsIDQ4KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCc8cHJlPicsXG5cdFx0XHRcdCcgIGZvbyAvL0kgcHJlc3MgPEVudGVyPiBhdCB0aGUgZW5kIG9mIHRoaXMgbGluZScsXG5cdFx0XHRcdCcgICcsXG5cdFx0XHRcdCc8L3ByZT4nLFxuXHRcdFx0XS5qb2luKCdcXG4nKSk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG5cbnN1aXRlKCdBdXRvIEluZGVudCBPbiBUeXBlIC0gVmlzdWFsIEJhc2ljJywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSBMYW5ndWFnZS5WQjtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzExODkzMjogbm8gaW5kZW50YXRpb24gaW4gdmlzdWFsIGJhc2ljIGZpbGVzJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODkzMlxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J2lmIFRydWUgdGhlbicsXG5cdFx0XHQnICAgIFNvbWUgY29kZScsXG5cdFx0XHQnICAgIGVuZCBpJyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsLCBpbnN0YW50aWF0aW9uU2VydmljZSkgPT4ge1xuXHRcdFx0ZWRpdG9yLnNldFNlbGVjdGlvbihuZXcgU2VsZWN0aW9uKDMsIDEwLCAzLCAxMCkpO1xuXHRcdFx0dmlld01vZGVsLnR5cGUoXCJmXCIsICdrZXlib2FyZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmdldFZhbHVlKCksIFtcblx0XHRcdFx0J2lmIFRydWUgdGhlbicsXG5cdFx0XHRcdCcgICAgU29tZSBjb2RlJyxcblx0XHRcdFx0J2VuZCBpZicsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuXG5zdWl0ZSgnQXV0byBJbmRlbnQgT24gVHlwZSAtIExhdGV4JywgKCkgPT4ge1xuXG5cdGNvbnN0IGxhbmd1YWdlSWQgPSBMYW5ndWFnZS5MYXRleDtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE3ODA3NTogbm8gYXV0byBjbG9zaW5nIHBhaXIgd2hlbiBpbmRlbnRhdGlvbiBkb25lJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE3ODA3NVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J1xcXFxiZWdpbnt0aGVvcmVtfScsXG5cdFx0XHQnICAgIFxcXFxlbmQnLFxuXHRcdF0uam9pbignXFxuJyksIGxhbmd1YWdlSWQsIHt9KTtcblx0XHRkaXNwb3NhYmxlcy5hZGQobW9kZWwpO1xuXG5cdFx0d2l0aFRlc3RDb2RlRWRpdG9yKG1vZGVsLCB7IGF1dG9JbmRlbnQ6IFwiZnVsbFwiLCBzZXJ2aWNlQ29sbGVjdGlvbiB9LCAoZWRpdG9yLCB2aWV3TW9kZWwpID0+IHtcblx0XHRcdGVkaXRvci5zZXRTZWxlY3Rpb24obmV3IFNlbGVjdGlvbigyLCA5LCAyLCA5KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIntcIiwgJ2tleWJvYXJkJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobW9kZWwuZ2V0VmFsdWUoKSwgW1xuXHRcdFx0XHQnXFxcXGJlZ2lue3RoZW9yZW19Jyxcblx0XHRcdFx0J1xcXFxlbmR7fScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcblxuc3VpdGUoJ0F1dG8gSW5kZW50IE9uIFR5cGUgLSBMdWEnLCAoKSA9PiB7XG5cblx0Y29uc3QgbGFuZ3VhZ2VJZCA9IExhbmd1YWdlLkx1YTtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBzZXJ2aWNlQ29sbGVjdGlvbjogU2VydmljZUNvbGxlY3Rpb247XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IG5ldyBMYW5ndWFnZVNlcnZpY2UoKTtcblx0XHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdFx0c2VydmljZUNvbGxlY3Rpb24gPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oXG5cdFx0XHRbSUxhbmd1YWdlU2VydmljZSwgbGFuZ3VhZ2VTZXJ2aWNlXSxcblx0XHRcdFtJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZV1cblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCd0ZW1wIGlzc3VlIGJlY2F1c2UgdGhlcmUgc2hvdWxkIGJlIGF0IGxlYXN0IG9uZSBwYXNzaW5nIHRlc3QgaW4gYSBzdWl0ZScsICgpID0+IHtcblx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnaXNzdWUgIzE3ODA3NTogbm8gYXV0byBjbG9zaW5nIHBhaXIgd2hlbiBpbmRlbnRhdGlvbiBkb25lJywgKCkgPT4ge1xuXG5cdFx0Ly8gaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzE3ODA3NVxuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoW1xuXHRcdFx0J3ByaW50KFwiYXNkZiBmdW5jdGlvbiBhc2RmXCIpJyxcblx0XHRdLmpvaW4oJ1xcbicpLCBsYW5ndWFnZUlkLCB7fSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKG1vZGVsKTtcblxuXHRcdHdpdGhUZXN0Q29kZUVkaXRvcihtb2RlbCwgeyBhdXRvSW5kZW50OiBcImZ1bGxcIiwgc2VydmljZUNvbGxlY3Rpb24gfSwgKGVkaXRvciwgdmlld01vZGVsKSA9PiB7XG5cdFx0XHRlZGl0b3Iuc2V0U2VsZWN0aW9uKG5ldyBTZWxlY3Rpb24oMSwgMjgsIDEsIDI4KSk7XG5cdFx0XHR2aWV3TW9kZWwudHlwZShcIlxcblwiLCAna2V5Ym9hcmQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5nZXRWYWx1ZSgpLCBbXG5cdFx0XHRcdCdwcmludChcImFzZGYgZnVuY3Rpb24gYXNkZlwiKScsXG5cdFx0XHRcdCcnXG5cdFx0XHRdLmpvaW4oJ1xcbicpKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9B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
