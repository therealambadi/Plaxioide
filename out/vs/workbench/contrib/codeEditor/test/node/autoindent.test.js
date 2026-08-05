import * as fs from "fs";
import * as path from "path";
import assert from "assert";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ILanguageConfigurationService } from "../../../../../editor/common/languages/languageConfigurationRegistry.js";
import { getReindentEditOperations } from "../../../../../editor/contrib/indentation/common/indentation.js";
import { createModelServices, instantiateTextModel } from "../../../../../editor/test/common/testTextModel.js";
import { LanguageConfigurationFileHandler } from "../../common/languageConfigurationExtensionPoint.js";
import { parse } from "../../../../../base/common/json.js";
import { trimTrailingWhitespace } from "../../../../../editor/common/commands/trimTrailingWhitespaceCommand.js";
import { execSync } from "child_process";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { EncodedTokenizationResult, TokenizationRegistry } from "../../../../../editor/common/languages.js";
import { NullState } from "../../../../../editor/common/languages/nullTokenize.js";
import { MetadataConsts, StandardTokenType } from "../../../../../editor/common/encodedTokenAttributes.js";
import { FileAccess } from "../../../../../base/common/network.js";
function getIRange(range) {
  return {
    startLineNumber: range.startLineNumber,
    startColumn: range.startColumn,
    endLineNumber: range.endLineNumber,
    endColumn: range.endColumn
  };
}
var LanguageId = /* @__PURE__ */ ((LanguageId2) => {
  LanguageId2["TypeScript"] = "ts-test";
  return LanguageId2;
})(LanguageId || {});
function forceTokenizationFromLineToLine(model, startLine, endLine) {
  for (let line = startLine; line <= endLine; line++) {
    model.tokenization.forceTokenization(line);
  }
}
function registerLanguage(instantiationService, languageId) {
  const disposables = new DisposableStore();
  const languageService = instantiationService.get(ILanguageService);
  disposables.add(registerLanguageConfiguration(instantiationService, languageId));
  disposables.add(languageService.registerLanguage({ id: languageId }));
  return disposables;
}
function registerLanguageConfiguration(instantiationService, languageId) {
  const languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
  let configPath;
  switch (languageId) {
    case "ts-test" /* TypeScript */:
      configPath = FileAccess.asFileUri("vs/workbench/contrib/codeEditor/test/node/language-configuration.json").fsPath;
      break;
    default:
      throw new Error("Unknown languageId");
  }
  const configContent = fs.readFileSync(configPath, { encoding: "utf-8" });
  const parsedConfig = parse(configContent, []);
  const languageConfig = LanguageConfigurationFileHandler.extractValidConfig(languageId, parsedConfig);
  return languageConfigurationService.register(languageId, languageConfig);
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
suite("Auto-Reindentation - TypeScript/JavaScript", () => {
  const languageId = "ts-test" /* TypeScript */;
  const options = {};
  let disposables;
  let instantiationService;
  let languageConfigurationService;
  setup(() => {
    disposables = new DisposableStore();
    instantiationService = createModelServices(disposables);
    languageConfigurationService = instantiationService.get(ILanguageConfigurationService);
    disposables.add(instantiationService);
    disposables.add(registerLanguage(instantiationService, languageId));
    disposables.add(registerLanguageConfiguration(instantiationService, languageId));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test.skip("Find Cases of Incorrect Indentation with the Reindent Lines Command", () => {
    function walkDirectoryAndReindent(directory, languageId2) {
      const files = fs.readdirSync(directory, { withFileTypes: true });
      const directoriesToRecurseOn = [];
      for (const file of files) {
        if (file.isDirectory()) {
          directoriesToRecurseOn.push(path.join(directory, file.name));
        } else {
          const filePathName = path.join(directory, file.name);
          const fileExtension = path.extname(filePathName);
          if (fileExtension !== ".ts") {
            continue;
          }
          const fileContents = fs.readFileSync(filePathName, { encoding: "utf-8" });
          const modelOptions = {
            tabSize: 4,
            insertSpaces: false
          };
          const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId2, modelOptions));
          const lineCount = model.getLineCount();
          const editOperations = [];
          for (let line = 1; line <= lineCount - 1; line++) {
            const lineContent = model.getLineContent(line);
            const trimmedLineContent = lineContent.trim();
            if (trimmedLineContent.length === 0) {
              continue;
            }
            const editOperation = getReindentEditOperations(model, languageConfigurationService, line, line + 1);
            editOperations.push(...editOperation);
          }
          model.applyEdits(editOperations);
          model.applyEdits(trimTrailingWhitespace(model, [], true));
          fs.writeFileSync(filePathName, model.getValue());
        }
      }
      for (const directory2 of directoriesToRecurseOn) {
        walkDirectoryAndReindent(directory2, languageId2);
      }
    }
    walkDirectoryAndReindent("/Users/aiday/Desktop/Test/vscode-test", "ts-test");
    const output = execSync("cd /Users/aiday/Desktop/Test/vscode-test && git diff --shortstat", { encoding: "utf-8" });
    console.log("\ngit diff --shortstat:\n", output);
  });
  test("Issue #25437", () => {
    const fileContents = [
      "const foo = `{`;",
      "    "
    ].join("\n");
    const tokens = [
      [
        { startIndex: 0, standardTokenType: StandardTokenType.Other },
        { startIndex: 5, standardTokenType: StandardTokenType.Other },
        { startIndex: 6, standardTokenType: StandardTokenType.Other },
        { startIndex: 9, standardTokenType: StandardTokenType.Other },
        { startIndex: 10, standardTokenType: StandardTokenType.Other },
        { startIndex: 11, standardTokenType: StandardTokenType.Other },
        { startIndex: 12, standardTokenType: StandardTokenType.String },
        { startIndex: 13, standardTokenType: StandardTokenType.String },
        { startIndex: 14, standardTokenType: StandardTokenType.String },
        { startIndex: 15, standardTokenType: StandardTokenType.Other },
        { startIndex: 16, standardTokenType: StandardTokenType.Other }
      ],
      [
        { startIndex: 0, standardTokenType: StandardTokenType.Other },
        { startIndex: 4, standardTokenType: StandardTokenType.Other }
      ]
    ];
    disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    forceTokenizationFromLineToLine(model, 1, 2);
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 1);
    const operation = editOperations[0];
    assert.deepStrictEqual(getIRange(operation.range), {
      "startLineNumber": 2,
      "startColumn": 1,
      "endLineNumber": 2,
      "endColumn": 5
    });
    assert.deepStrictEqual(operation.text, "");
  });
  test("Enriching the hover", () => {
    let fileContents = [
      "function foo(",
      "    bar: string",
      "    ){}"
    ].join("\n");
    let model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    let editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 1);
    let operation = editOperations[0];
    assert.deepStrictEqual(getIRange(operation.range), {
      "startLineNumber": 3,
      "startColumn": 1,
      "endLineNumber": 3,
      "endColumn": 5
    });
    assert.deepStrictEqual(operation.text, "");
    fileContents = [
      "function foo(",
      "bar: string",
      "){}"
    ].join("\n");
    model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 1);
    operation = editOperations[0];
    assert.deepStrictEqual(getIRange(operation.range), {
      "startLineNumber": 2,
      "startColumn": 1,
      "endLineNumber": 2,
      "endColumn": 1
    });
    assert.deepStrictEqual(operation.text, "    ");
  });
  test("Issue #86176", () => {
    const fileContents = [
      `if () { // '`,
      `x = 4`,
      `}`
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 1);
    const operation = editOperations[0];
    assert.deepStrictEqual(getIRange(operation.range), {
      "startLineNumber": 2,
      "startColumn": 1,
      "endLineNumber": 2,
      "endColumn": 1
    });
    assert.deepStrictEqual(operation.text, "    ");
  });
  test("Issue #141816", () => {
    const fileContents = [
      "const r = /{/;",
      "   "
    ].join("\n");
    const tokens = [
      [
        { startIndex: 0, standardTokenType: StandardTokenType.Other },
        { startIndex: 5, standardTokenType: StandardTokenType.Other },
        { startIndex: 6, standardTokenType: StandardTokenType.Other },
        { startIndex: 7, standardTokenType: StandardTokenType.Other },
        { startIndex: 8, standardTokenType: StandardTokenType.Other },
        { startIndex: 9, standardTokenType: StandardTokenType.RegEx },
        { startIndex: 10, standardTokenType: StandardTokenType.RegEx },
        { startIndex: 11, standardTokenType: StandardTokenType.RegEx },
        { startIndex: 12, standardTokenType: StandardTokenType.RegEx },
        { startIndex: 13, standardTokenType: StandardTokenType.Other },
        { startIndex: 14, standardTokenType: StandardTokenType.Other }
      ],
      [
        { startIndex: 0, standardTokenType: StandardTokenType.Other },
        { startIndex: 4, standardTokenType: StandardTokenType.Other }
      ]
    ];
    disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    forceTokenizationFromLineToLine(model, 1, 2);
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 1);
    const operation = editOperations[0];
    assert.deepStrictEqual(getIRange(operation.range), {
      "startLineNumber": 2,
      "startColumn": 1,
      "endLineNumber": 2,
      "endColumn": 4
    });
    assert.deepStrictEqual(operation.text, "");
  });
  test("Issue #29886", () => {
    const fileContents = [
      "function foo() {",
      "    bar(/*  */)",
      "};"
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test("Issue #209859: do not do reindentation for tokens inside of a string", () => {
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
      ],
      [
        { startIndex: 0, standardTokenType: StandardTokenType.String }
      ]
    ];
    disposables.add(registerTokenizationSupport(instantiationService, tokens, languageId));
    const fileContents = [
      "const foo = `some text",
      "         which is strangely",
      "    indented. It should",
      "   not be reindented.`"
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    forceTokenizationFromLineToLine(model, 1, 4);
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test.skip("Incorrect deindentation after `*/}` string", () => {
    const fileContents = [
      `const obj = {`,
      `    obj1: {`,
      `        brace : '*/}'`,
      `    }`,
      `}`
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test.skip("Issue #56275", () => {
    let fileContents = [
      "function foo() {",
      "    var bar = (/b*/);",
      "}"
    ].join("\n");
    let model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    let editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
    fileContents = [
      "function foo() {",
      '    var bar = "/b*/)";',
      "}"
    ].join("\n");
    model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test.skip("Issue #116843", () => {
    const fileContents = [
      "const add1 = (n) =>",
      "	n + 1;"
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test.skip("Issue #185252", () => {
    const fileContents = [
      "/*",
      " * This is a comment.",
      " */"
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
  test.skip("Issue 43244: incorrect indentation when signature of function call spans several lines", () => {
    const fileContents = [
      "function callSomeOtherFunction(one: number, two: number) { }",
      "function someFunction() {",
      "    callSomeOtherFunction(4,",
      "        5)",
      "}"
    ].join("\n");
    const model = disposables.add(instantiateTextModel(instantiationService, fileContents, languageId, options));
    const editOperations = getReindentEditOperations(model, languageConfigurationService, 1, model.getLineCount());
    assert.deepStrictEqual(editOperations.length, 0);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL3Rlc3Qvbm9kZS9hdXRvaW5kZW50LnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBmcyBmcm9tICdmcyc7XG5pbXBvcnQgKiBhcyBwYXRoIGZyb20gJ3BhdGgnO1xuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2luZGVudGF0aW9uL2NvbW1vbi9pbmRlbnRhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmVsYXhlZFRleHRNb2RlbENyZWF0aW9uT3B0aW9ucywgY3JlYXRlTW9kZWxTZXJ2aWNlcywgaW5zdGFudGlhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uLCBMYW5ndWFnZUNvbmZpZ3VyYXRpb25GaWxlSGFuZGxlciB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZUNvbmZpZ3VyYXRpb25FeHRlbnNpb25Qb2ludC5qcyc7XG5pbXBvcnQgeyBwYXJzZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb24uanMnO1xuaW1wb3J0IHsgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElTaW5nbGVFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL2VkaXRPcGVyYXRpb24uanMnO1xuaW1wb3J0IHsgdHJpbVRyYWlsaW5nV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29tbWFuZHMvdHJpbVRyYWlsaW5nV2hpdGVzcGFjZUNvbW1hbmQuanMnO1xuaW1wb3J0IHsgZXhlY1N5bmMgfSBmcm9tICdjaGlsZF9wcm9jZXNzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0LCBJU3RhdGUsIElUb2tlbml6YXRpb25TdXBwb3J0LCBUb2tlbml6YXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IE51bGxTdGF0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL251bGxUb2tlbml6ZS5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cywgU3RhbmRhcmRUb2tlblR5cGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VuY29kZWRUb2tlbkF0dHJpYnV0ZXMuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgRmlsZUFjY2VzcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuXG5mdW5jdGlvbiBnZXRJUmFuZ2UocmFuZ2U6IElSYW5nZSk6IElSYW5nZSB7XG5cdHJldHVybiB7XG5cdFx0c3RhcnRMaW5lTnVtYmVyOiByYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0c3RhcnRDb2x1bW46IHJhbmdlLnN0YXJ0Q29sdW1uLFxuXHRcdGVuZExpbmVOdW1iZXI6IHJhbmdlLmVuZExpbmVOdW1iZXIsXG5cdFx0ZW5kQ29sdW1uOiByYW5nZS5lbmRDb2x1bW5cblx0fTtcbn1cblxuY29uc3QgZW51bSBMYW5ndWFnZUlkIHtcblx0VHlwZVNjcmlwdCA9ICd0cy10ZXN0J1xufVxuXG5mdW5jdGlvbiBmb3JjZVRva2VuaXphdGlvbkZyb21MaW5lVG9MaW5lKG1vZGVsOiBJVGV4dE1vZGVsLCBzdGFydExpbmU6IG51bWJlciwgZW5kTGluZTogbnVtYmVyKTogdm9pZCB7XG5cdGZvciAobGV0IGxpbmUgPSBzdGFydExpbmU7IGxpbmUgPD0gZW5kTGluZTsgbGluZSsrKSB7XG5cdFx0bW9kZWwudG9rZW5pemF0aW9uLmZvcmNlVG9rZW5pemF0aW9uKGxpbmUpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIHJlZ2lzdGVyTGFuZ3VhZ2UoaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSwgbGFuZ3VhZ2VJZDogTGFuZ3VhZ2VJZCk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyTGFuZ3VhZ2VDb25maWd1cmF0aW9uKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkKSk7XG5cdGRpc3Bvc2FibGVzLmFkZChsYW5ndWFnZVNlcnZpY2UucmVnaXN0ZXJMYW5ndWFnZSh7IGlkOiBsYW5ndWFnZUlkIH0pKTtcblx0cmV0dXJuIGRpc3Bvc2FibGVzO1xufVxuXG5mdW5jdGlvbiByZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlLCBsYW5ndWFnZUlkOiBMYW5ndWFnZUlkKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuZ2V0KElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0bGV0IGNvbmZpZ1BhdGg6IHN0cmluZztcblx0c3dpdGNoIChsYW5ndWFnZUlkKSB7XG5cdFx0Y2FzZSBMYW5ndWFnZUlkLlR5cGVTY3JpcHQ6XG5cdFx0XHRjb25maWdQYXRoID0gRmlsZUFjY2Vzcy5hc0ZpbGVVcmkoJ3ZzL3dvcmtiZW5jaC9jb250cmliL2NvZGVFZGl0b3IvdGVzdC9ub2RlL2xhbmd1YWdlLWNvbmZpZ3VyYXRpb24uanNvbicpLmZzUGF0aDtcblx0XHRcdGJyZWFrO1xuXHRcdGRlZmF1bHQ6XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1Vua25vd24gbGFuZ3VhZ2VJZCcpO1xuXHR9XG5cdGNvbnN0IGNvbmZpZ0NvbnRlbnQgPSBmcy5yZWFkRmlsZVN5bmMoY29uZmlnUGF0aCwgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcblx0Y29uc3QgcGFyc2VkQ29uZmlnID0gPElMYW5ndWFnZUNvbmZpZ3VyYXRpb24+cGFyc2UoY29uZmlnQ29udGVudCwgW10pO1xuXHRjb25zdCBsYW5ndWFnZUNvbmZpZyA9IExhbmd1YWdlQ29uZmlndXJhdGlvbkZpbGVIYW5kbGVyLmV4dHJhY3RWYWxpZENvbmZpZyhsYW5ndWFnZUlkLCBwYXJzZWRDb25maWcpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCBsYW5ndWFnZUNvbmZpZyk7XG59XG5cbmludGVyZmFjZSBTdGFuZGFyZFRva2VuVHlwZURhdGEge1xuXHRzdGFydEluZGV4OiBudW1iZXI7XG5cdHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZTtcbn1cblxuZnVuY3Rpb24gcmVnaXN0ZXJUb2tlbml6YXRpb25TdXBwb3J0KGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UsIHRva2VuczogU3RhbmRhcmRUb2tlblR5cGVEYXRhW11bXSwgbGFuZ3VhZ2VJZDogTGFuZ3VhZ2VJZCk6IElEaXNwb3NhYmxlIHtcblx0bGV0IGxpbmVJbmRleCA9IDA7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblx0Y29uc3QgdG9rZW5pemF0aW9uU3VwcG9ydDogSVRva2VuaXphdGlvblN1cHBvcnQgPSB7XG5cdFx0Z2V0SW5pdGlhbFN0YXRlOiAoKSA9PiBOdWxsU3RhdGUsXG5cdFx0dG9rZW5pemU6IHVuZGVmaW5lZCEsXG5cdFx0dG9rZW5pemVFbmNvZGVkOiAobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBJU3RhdGUpOiBFbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0ID0+IHtcblx0XHRcdGNvbnN0IHRva2Vuc09uTGluZSA9IHRva2Vuc1tsaW5lSW5kZXgrK107XG5cdFx0XHRjb25zdCBlbmNvZGVkTGFuZ3VhZ2VJZCA9IGxhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBVaW50MzJBcnJheSgyICogdG9rZW5zT25MaW5lLmxlbmd0aCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IHRva2Vuc09uTGluZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRyZXN1bHRbMiAqIGldID0gdG9rZW5zT25MaW5lW2ldLnN0YXJ0SW5kZXg7XG5cdFx0XHRcdHJlc3VsdFsyICogaSArIDFdID1cblx0XHRcdFx0XHQoKGVuY29kZWRMYW5ndWFnZUlkIDw8IE1ldGFkYXRhQ29uc3RzLkxBTkdVQUdFSURfT0ZGU0VUKVxuXHRcdFx0XHRcdFx0fCAodG9rZW5zT25MaW5lW2ldLnN0YW5kYXJkVG9rZW5UeXBlIDw8IE1ldGFkYXRhQ29uc3RzLlRPS0VOX1RZUEVfT0ZGU0VUKSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IEVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQocmVzdWx0LCBzdGF0ZSk7XG5cdFx0fVxuXHR9O1xuXHRyZXR1cm4gVG9rZW5pemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgdG9rZW5pemF0aW9uU3VwcG9ydCk7XG59XG5cbnN1aXRlKCdBdXRvLVJlaW5kZW50YXRpb24gLSBUeXBlU2NyaXB0L0phdmFTY3JpcHQnLCAoKSA9PiB7XG5cblx0Y29uc3QgbGFuZ3VhZ2VJZCA9IExhbmd1YWdlSWQuVHlwZVNjcmlwdDtcblx0Y29uc3Qgb3B0aW9uczogSVJlbGF4ZWRUZXh0TW9kZWxDcmVhdGlvbk9wdGlvbnMgPSB7fTtcblx0bGV0IGRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmU7XG5cdGxldCBpbnN0YW50aWF0aW9uU2VydmljZTogVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRsZXQgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZTogSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcyk7XG5cdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGluc3RhbnRpYXRpb25TZXJ2aWNlLmdldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQocmVnaXN0ZXJMYW5ndWFnZShpbnN0YW50aWF0aW9uU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3Rlckxhbmd1YWdlQ29uZmlndXJhdGlvbihpbnN0YW50aWF0aW9uU2VydmljZSwgbGFuZ3VhZ2VJZCkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHQvLyBUZXN0IHdoaWNoIGNhbiBiZSByYW4gdG8gZmluZCBjYXNlcyBvZiBpbmNvcnJlY3QgaW5kZW50YXRpb24uLi5cblx0dGVzdC5za2lwKCdGaW5kIENhc2VzIG9mIEluY29ycmVjdCBJbmRlbnRhdGlvbiB3aXRoIHRoZSBSZWluZGVudCBMaW5lcyBDb21tYW5kJywgKCkgPT4ge1xuXG5cdFx0Ly8gLi9zY3JpcHRzL3Rlc3Quc2ggLS1pbnNwZWN0IC0tZ3JlcD0nRmluZCBDYXNlcyBvZiBJbmNvcnJlY3QgSW5kZW50YXRpb24gd2l0aCB0aGUgUmVpbmRlbnQgTGluZXMgQ29tbWFuZCcgLS10aW1lb3V0PTE1MDAwXG5cblx0XHRmdW5jdGlvbiB3YWxrRGlyZWN0b3J5QW5kUmVpbmRlbnQoZGlyZWN0b3J5OiBzdHJpbmcsIGxhbmd1YWdlSWQ6IHN0cmluZykge1xuXHRcdFx0Y29uc3QgZmlsZXMgPSBmcy5yZWFkZGlyU3luYyhkaXJlY3RvcnksIHsgd2l0aEZpbGVUeXBlczogdHJ1ZSB9KTtcblx0XHRcdGNvbnN0IGRpcmVjdG9yaWVzVG9SZWN1cnNlT246IHN0cmluZ1tdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IGZpbGUgb2YgZmlsZXMpIHtcblx0XHRcdFx0aWYgKGZpbGUuaXNEaXJlY3RvcnkoKSkge1xuXHRcdFx0XHRcdGRpcmVjdG9yaWVzVG9SZWN1cnNlT24ucHVzaChwYXRoLmpvaW4oZGlyZWN0b3J5LCBmaWxlLm5hbWUpKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRjb25zdCBmaWxlUGF0aE5hbWUgPSBwYXRoLmpvaW4oZGlyZWN0b3J5LCBmaWxlLm5hbWUpO1xuXHRcdFx0XHRcdGNvbnN0IGZpbGVFeHRlbnNpb24gPSBwYXRoLmV4dG5hbWUoZmlsZVBhdGhOYW1lKTtcblx0XHRcdFx0XHRpZiAoZmlsZUV4dGVuc2lvbiAhPT0gJy50cycpIHtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBmcy5yZWFkRmlsZVN5bmMoZmlsZVBhdGhOYW1lLCB7IGVuY29kaW5nOiAndXRmLTgnIH0pO1xuXHRcdFx0XHRcdGNvbnN0IG1vZGVsT3B0aW9uczogSVJlbGF4ZWRUZXh0TW9kZWxDcmVhdGlvbk9wdGlvbnMgPSB7XG5cdFx0XHRcdFx0XHR0YWJTaXplOiA0LFxuXHRcdFx0XHRcdFx0aW5zZXJ0U3BhY2VzOiBmYWxzZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgbW9kZWxPcHRpb25zKSk7XG5cdFx0XHRcdFx0Y29uc3QgbGluZUNvdW50ID0gbW9kZWwuZ2V0TGluZUNvdW50KCk7XG5cdFx0XHRcdFx0Y29uc3QgZWRpdE9wZXJhdGlvbnM6IElTaW5nbGVFZGl0T3BlcmF0aW9uW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGxldCBsaW5lID0gMTsgbGluZSA8PSBsaW5lQ291bnQgLSAxOyBsaW5lKyspIHtcblx0XHRcdFx0XHRcdC8qXG5cdFx0XHRcdFx0XHROT1RFOiBVbmNvbW1lbnQgaW4gb3JkZXIgdG8gaWdub3JlIGluY29ycmVjdCBKUyBET0MgaW5kZW50YXRpb25cblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZSk7XG5cdFx0XHRcdFx0XHRjb25zdCB0cmltbWVkTGluZUNvbnRlbnQgPSBsaW5lQ29udGVudC50cmltKCk7XG5cdFx0XHRcdFx0XHRpZiAodHJpbW1lZExpbmVDb250ZW50Lmxlbmd0aCA9PT0gMCB8fCB0cmltbWVkTGluZUNvbnRlbnQuc3RhcnRzV2l0aCgnKicpIHx8IHRyaW1tZWRMaW5lQ29udGVudC5zdGFydHNXaXRoKCcvKicpKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0Ki9cblx0XHRcdFx0XHRcdGNvbnN0IGxpbmVDb250ZW50ID0gbW9kZWwuZ2V0TGluZUNvbnRlbnQobGluZSk7XG5cdFx0XHRcdFx0XHRjb25zdCB0cmltbWVkTGluZUNvbnRlbnQgPSBsaW5lQ29udGVudC50cmltKCk7XG5cdFx0XHRcdFx0XHRpZiAodHJpbW1lZExpbmVDb250ZW50Lmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGNvbnN0IGVkaXRPcGVyYXRpb24gPSBnZXRSZWluZGVudEVkaXRPcGVyYXRpb25zKG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCBsaW5lLCBsaW5lICsgMSk7XG5cdFx0XHRcdFx0XHQvKlxuXHRcdFx0XHRcdFx0Tk9URTogVW5jb21tZW50IGluIG9yZGVyIHRvIHNlZSBhY3R1YWwgaW5jb3JyZWN0IGluZGVudGF0aW9uIGRpZmZcblx0XHRcdFx0XHRcdG1vZGVsLmFwcGx5RWRpdHMoZWRpdE9wZXJhdGlvbik7XG5cdFx0XHRcdFx0XHQqL1xuXHRcdFx0XHRcdFx0ZWRpdE9wZXJhdGlvbnMucHVzaCguLi5lZGl0T3BlcmF0aW9uKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhlZGl0T3BlcmF0aW9ucyk7XG5cdFx0XHRcdFx0bW9kZWwuYXBwbHlFZGl0cyh0cmltVHJhaWxpbmdXaGl0ZXNwYWNlKG1vZGVsLCBbXSwgdHJ1ZSkpO1xuXHRcdFx0XHRcdGZzLndyaXRlRmlsZVN5bmMoZmlsZVBhdGhOYW1lLCBtb2RlbC5nZXRWYWx1ZSgpKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBkaXJlY3Rvcnkgb2YgZGlyZWN0b3JpZXNUb1JlY3Vyc2VPbikge1xuXHRcdFx0XHR3YWxrRGlyZWN0b3J5QW5kUmVpbmRlbnQoZGlyZWN0b3J5LCBsYW5ndWFnZUlkKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHR3YWxrRGlyZWN0b3J5QW5kUmVpbmRlbnQoJy9Vc2Vycy9haWRheS9EZXNrdG9wL1Rlc3QvdnNjb2RlLXRlc3QnLCAndHMtdGVzdCcpO1xuXHRcdGNvbnN0IG91dHB1dCA9IGV4ZWNTeW5jKCdjZCAvVXNlcnMvYWlkYXkvRGVza3RvcC9UZXN0L3ZzY29kZS10ZXN0ICYmIGdpdCBkaWZmIC0tc2hvcnRzdGF0JywgeyBlbmNvZGluZzogJ3V0Zi04JyB9KTtcblx0XHRjb25zb2xlLmxvZygnXFxuZ2l0IGRpZmYgLS1zaG9ydHN0YXQ6XFxuJywgb3V0cHV0KTtcblx0fSk7XG5cblx0Ly8gVW5pdCB0ZXN0cyBmb3IgaW5jcmVhc2UgYW5kIGRlY3JlYXNlIGluZGVudCBwYXR0ZXJucy4uLlxuXG5cdC8qKlxuXHQgKiBGaXJzdCBpbmNyZWFzZSBpbmRlbnQgYW5kIGRlY3JlYXNlIGluZGVudCBwYXR0ZXJuczpcblx0ICpcblx0ICogLSBkZWNyZWFzZUluZGVudFBhdHRlcm46IC9eKC4qXFwqXFwvKT9cXHMqXFx9LiokL1xuXHQgKiAgLSBJbiAoaHR0cHM6Ly9tYWNyb21hdGVzLmNvbS9tYW51YWwvZW4vYXBwZW5kaXgpXG5cdCAqIFx0ICBFaXRoZXIgd2UgaGF2ZSB3aGl0ZSBzcGFjZSBiZWZvcmUgdGhlIGNsb3NpbmcgYnJhY2tldCwgb3Igd2UgaGF2ZSBhIG11bHRpIGxpbmUgY29tbWVudCBlbmRpbmcgb24gdGhhdCBsaW5lIGZvbGxvd2VkIGJ5IHdoaXRlc3BhY2VzXG5cdCAqICAgIFRoaXMgaXMgZm9sbG93ZWQgYnkgYW55IGNoYXJhY3Rlci5cblx0ICogICAgVGV4dG1hdGUgZGVjcmVhc2UgaW5kZW50IHBhdHRlcm4gaXMgYXMgZm9sbG93czogL14oLipcXCpcXC8pP1xccypcXH1bO1xcc10qJC9cblx0ICogICAgUHJlc3VtYWJseSBhbGxvd2luZyBtdWx0aSBsaW5lIGNvbW1lbnRzIGVuZGluZyBvbiB0aGF0IGxpbmUgaW1wbGllcyB0aGF0IH0gaXMgaXRzZWxmIG5vdCBwYXJ0IG9mIGEgbXVsdGkgbGluZSBjb21tZW50XG5cdCAqXG5cdCAqIC0gaW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXi4qXFx7W159XCInXSokL1xuXHQgKiAgLSBJbiAoaHR0cHM6Ly9tYWNyb21hdGVzLmNvbS9tYW51YWwvZW4vYXBwZW5kaXgpXG5cdCAqICAgIFRoaXMgcmVnZXggbWVhbnMgdGhhdCB3ZSBpbmNyZWFzZSB0aGUgaW5kZW50IHdoZW4gd2UgaGF2ZSBhbnkgY2hhcmFjdGVycyBmb2xsb3dlZCBieSB0aGUgb3BlbmluZyBicmFjZSwgZm9sbG93ZWQgYnkgY2hhcmFjdGVyc1xuXHQgKiAgICBleGNlcHQgZm9yIGNsb3NpbmcgYnJhY2UgfSwgZG91YmxlIHF1b3RlcyBcIiBvciBzaW5nbGUgcXVvdGUgJy5cblx0ICogICAgVGhlIH0gaXMgY2hlY2tlZCBpbiBvcmRlciB0byBhdm9pZCB0aGUgaW5kZW50YXRpb24gaW4gdGhlIGZvbGxvd2luZyBjYXNlIGBpbnQgYXJyW10gPSB7IDEsIDIsIDMgfTtgXG5cdCAqICAgIFRoZSBkb3VibGUgcXVvdGUgYW5kIHNpbmdsZSBxdW90ZSBhcmUgY2hlY2tlZCBpbiBvcmRlciB0byBhdm9pZCB0aGUgaW5kZW50YXRpb24gaW4gdGhlIGZvbGxvd2luZyBjYXNlOiBzdHIgPSBcImZvbyB7XCI7XG5cdCAqL1xuXG5cdHRlc3QoJ0lzc3VlICMyNTQzNycsICgpID0+IHtcblx0XHQvLyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzI1NDM3XG5cdFx0Ly8gZml4OiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9jb21taXQvOGM4MmE2YzYxNTg1NzRlMDk4NTYxYzI4ZDQ3MDcxMWYxYjQ4NGZjOFxuXHRcdC8vIGV4cGxhbmF0aW9uOiB2YXIgZm9vID0gYHtgOyBzaG91bGQgbm90IGluY3JlYXNlIGluZGVudGF0aW9uXG5cblx0XHQvLyBpbmNyZWFzZUluZGVudFBhdHRlcm46IC9eLipcXHtbXn1cIiddKiQvIC0+IC9eLipcXHtbXn1cIidgXSokL1xuXG5cdFx0Y29uc3QgZmlsZUNvbnRlbnRzID0gW1xuXHRcdFx0J2NvbnN0IGZvbyA9IGB7YDsnLFxuXHRcdFx0JyAgICAnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgdG9rZW5zOiBTdGFuZGFyZFRva2VuVHlwZURhdGFbXVtdID0gW1xuXHRcdFx0W1xuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDUsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDYsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDksIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDEwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiAxMSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMTIsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcgfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiAxMywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZyB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDE0LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMTUsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDE2LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiA0LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfV1cblx0XHRdO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChyZWdpc3RlclRva2VuaXphdGlvblN1cHBvcnQoaW5zdGFudGlhdGlvblNlcnZpY2UsIHRva2VucywgbGFuZ3VhZ2VJZCkpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRmb3JjZVRva2VuaXphdGlvbkZyb21MaW5lVG9MaW5lKG1vZGVsLCAxLCAyKTtcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3Qgb3BlcmF0aW9uID0gZWRpdE9wZXJhdGlvbnNbMF07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRJUmFuZ2Uob3BlcmF0aW9uLnJhbmdlKSwge1xuXHRcdFx0XCJzdGFydExpbmVOdW1iZXJcIjogMixcblx0XHRcdFwic3RhcnRDb2x1bW5cIjogMSxcblx0XHRcdFwiZW5kTGluZU51bWJlclwiOiAyLFxuXHRcdFx0XCJlbmRDb2x1bW5cIjogNSxcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wZXJhdGlvbi50ZXh0LCAnJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0VucmljaGluZyB0aGUgaG92ZXInLCAoKSA9PiB7XG5cdFx0Ly8gaXNzdWU6IC1cblx0XHQvLyBmaXg6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2NvbW1pdC8xOWFlMDkzMmM0NWIxMDk2NDQzYThjMTMzNWNmMWUwMmViOTllMTZkXG5cdFx0Ly8gZXhwbGFuYXRpb246XG5cdFx0Ly8gIC0gZGVjcmVhc2UgaW5kZW50IG9uICkgYW5kIF0gYWxzb1xuXHRcdC8vICAtIGluY3JlYXNlIGluZGVudCBvbiAoIGFuZCBbIGFsc29cblxuXHRcdC8vIGRlY3JlYXNlSW5kZW50UGF0dGVybjogL14oLipcXCpcXC8pP1xccypcXH0uKiQvIC0+IC9eKC4qXFwqXFwvKT9cXHMqW1xcfVxcXVxcKV0uKiQvXG5cdFx0Ly8gaW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXi4qXFx7W159XCInYF0qJC8gLT4gL14uKihcXHtbXn1cIidgXSp8XFwoW14pXCInYF0qfFxcW1teXFxdXCInYF0qKSQvXG5cblx0XHRsZXQgZmlsZUNvbnRlbnRzID0gW1xuXHRcdFx0J2Z1bmN0aW9uIGZvbygnLFxuXHRcdFx0JyAgICBiYXI6IHN0cmluZycsXG5cdFx0XHQnICAgICl7fScsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRsZXQgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgb3B0aW9ucykpO1xuXHRcdGxldCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMSk7XG5cdFx0bGV0IG9wZXJhdGlvbiA9IGVkaXRPcGVyYXRpb25zWzBdO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZ2V0SVJhbmdlKG9wZXJhdGlvbi5yYW5nZSksIHtcblx0XHRcdFwic3RhcnRMaW5lTnVtYmVyXCI6IDMsXG5cdFx0XHRcInN0YXJ0Q29sdW1uXCI6IDEsXG5cdFx0XHRcImVuZExpbmVOdW1iZXJcIjogMyxcblx0XHRcdFwiZW5kQ29sdW1uXCI6IDUsXG5cdFx0fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChvcGVyYXRpb24udGV4dCwgJycpO1xuXG5cdFx0ZmlsZUNvbnRlbnRzID0gW1xuXHRcdFx0J2Z1bmN0aW9uIGZvbygnLFxuXHRcdFx0J2Jhcjogc3RyaW5nJyxcblx0XHRcdCcpe30nLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0bW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgb3B0aW9ucykpO1xuXHRcdGVkaXRPcGVyYXRpb25zID0gZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyhtb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdE9wZXJhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRvcGVyYXRpb24gPSBlZGl0T3BlcmF0aW9uc1swXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldElSYW5nZShvcGVyYXRpb24ucmFuZ2UpLCB7XG5cdFx0XHRcInN0YXJ0TGluZU51bWJlclwiOiAyLFxuXHRcdFx0XCJzdGFydENvbHVtblwiOiAxLFxuXHRcdFx0XCJlbmRMaW5lTnVtYmVyXCI6IDIsXG5cdFx0XHRcImVuZENvbHVtblwiOiAxLFxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3BlcmF0aW9uLnRleHQsICcgICAgJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0lzc3VlICM4NjE3NicsICgpID0+IHtcblx0XHQvLyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzg2MTc2XG5cdFx0Ly8gZml4OiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9jb21taXQvZDg5ZTJlMTdhNWQxYmEzN2M5OWIxZDM5MjllYjYxODBhNWJmYzdhOFxuXHRcdC8vIGV4cGxhbmF0aW9uOiBXaGVuIHF1b3RhdGlvbiBtYXJrcyBhcmUgcHJlc2VudCBvbiB0aGUgZmlyc3QgbGluZSBvZiBhbiBpZiBzdGF0ZW1lbnQgb3IgZm9yIGxvb3AsIGZvbGxvd2luZyBsaW5lIHNob3VsZCBub3QgYmUgaW5kZW50ZWRcblxuXHRcdC8vIGluY3JlYXNlSW5kZW50UGF0dGVybjogL14oKD8hXFwvXFwvKS4pKihcXHtbXn1cIidgXSp8XFwoW14pXCInYF0qfFxcW1teXFxdXCInYF0qKSQvIC0+IC9eKCg/IVxcL1xcLykuKSooXFx7KFtefVwiJ2BdKnwoXFx0fFsgXSkqXFwvXFwvLiopfFxcKFteKVwiJ2BdKnxcXFtbXlxcXVwiJ2BdKikkL1xuXHRcdC8vIGV4cGxhbmF0aW9uOiBhZnRlciBvcGVuIGJyYWNlLCBkbyBub3QgZGVjcmVhc2UgaW5kZW50IGlmIGl0IGlzIGZvbGxvd2VkIG9uIHRoZSBzYW1lIGxpbmUgYnkgXCI8d2hpdGVzcGFjZSBjaGFyYWN0ZXJzPiAvLyA8YW55IGNoYXJhY3RlcnM+XCJcblx0XHQvLyB0b2RvQGFpZGF5LW1hcjogc2hvdWxkIGFsc28gYXBwbHkgZm9yIHdoZW4gaXQgZm9sbG93cyAoIGFuZCBbXG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHRgaWYgKCkgeyAvLyAnYCxcblx0XHRcdGB4ID0gNGAsXG5cdFx0XHRgfWBcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3Qgb3BlcmF0aW9uID0gZWRpdE9wZXJhdGlvbnNbMF07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChnZXRJUmFuZ2Uob3BlcmF0aW9uLnJhbmdlKSwge1xuXHRcdFx0XCJzdGFydExpbmVOdW1iZXJcIjogMixcblx0XHRcdFwic3RhcnRDb2x1bW5cIjogMSxcblx0XHRcdFwiZW5kTGluZU51bWJlclwiOiAyLFxuXHRcdFx0XCJlbmRDb2x1bW5cIjogMSxcblx0XHR9KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKG9wZXJhdGlvbi50ZXh0LCAnICAgICcpO1xuXHR9KTtcblxuXHR0ZXN0KCdJc3N1ZSAjMTQxODE2JywgKCkgPT4ge1xuXG5cdFx0Ly8gaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xNDE4MTZcblx0XHQvLyBmaXg6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL3B1bGwvMTQxOTk3L2ZpbGVzXG5cdFx0Ly8gZXhwbGFuYXRpb246IGlmICgsIFssIHssIGlzIGZvbGxvd2VkIGJ5IGEgZm9yd2FyZCBzbGFzaCB0aGVuIGFzc3VtZSB3ZSBhcmUgaW4gYSByZWdleCBwYXR0ZXJuLCBhbmQgZG8gbm90IGluZGVudFxuXG5cdFx0Ly8gaW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiAvXigoPyFcXC9cXC8pLikqKFxceyhbXn1cIidgXSp8KFxcdHxbIF0pKlxcL1xcLy4qKXxcXChbXilcIidgXSp8XFxbW15cXF1cIidgXSopJC8gLT4gL14oKD8hXFwvXFwvKS4pKihcXHsoW159XCInYC9dKnwoXFx0fFsgXSkqXFwvXFwvLiopfFxcKFteKVwiJ2AvXSp8XFxbW15cXF1cIidgL10qKSQvXG5cdFx0Ly8gLT4gRmluYWwgY3VycmVudCBpbmNyZWFzZSBpbmRlbnQgcGF0dGVybiBhdCBvZiB3cml0aW5nXG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHQnY29uc3QgciA9IC97LzsnLFxuXHRcdFx0JyAgICcsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCB0b2tlbnM6IFN0YW5kYXJkVG9rZW5UeXBlRGF0YVtdW10gPSBbXG5cdFx0XHRbXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogNSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogNiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogNywgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogOCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLk90aGVyIH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogOSwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlJlZ0V4IH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMTAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5SZWdFeCB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDExLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuUmVnRXggfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiAxMiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlJlZ0V4IH0sXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMTMsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5PdGhlciB9LFxuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDE0LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfVxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiA0LCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfVxuXHRcdFx0XVxuXHRcdF07XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVG9rZW5pemF0aW9uU3VwcG9ydChpbnN0YW50aWF0aW9uU2VydmljZSwgdG9rZW5zLCBsYW5ndWFnZUlkKSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgb3B0aW9ucykpO1xuXHRcdGZvcmNlVG9rZW5pemF0aW9uRnJvbUxpbmVUb0xpbmUobW9kZWwsIDEsIDIpO1xuXHRcdGNvbnN0IGVkaXRPcGVyYXRpb25zID0gZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyhtb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdE9wZXJhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBvcGVyYXRpb24gPSBlZGl0T3BlcmF0aW9uc1swXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGdldElSYW5nZShvcGVyYXRpb24ucmFuZ2UpLCB7XG5cdFx0XHRcInN0YXJ0TGluZU51bWJlclwiOiAyLFxuXHRcdFx0XCJzdGFydENvbHVtblwiOiAxLFxuXHRcdFx0XCJlbmRMaW5lTnVtYmVyXCI6IDIsXG5cdFx0XHRcImVuZENvbHVtblwiOiA0LFxuXHRcdH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwob3BlcmF0aW9uLnRleHQsICcnKTtcblx0fSk7XG5cblx0dGVzdCgnSXNzdWUgIzI5ODg2JywgKCkgPT4ge1xuXHRcdC8vIGlzc3VlOiBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMjk4ODZcblx0XHQvLyBmaXg6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2NvbW1pdC83OTEwYjNkN2JhYjhhNzIxYWFlOThkYzA1YWYwYjVlMWVhOWQ5NzgyXG5cblx0XHQvLyBkZWNyZWFzZUluZGVudFBhdHRlcm46IC9eKC4qXFwqXFwvKT9cXHMqW1xcfVxcXVxcKV0uKiQvIC0+IC9eKCg/IS4qP1xcL1xcKikuKlxcKlxcLyk/XFxzKltcXH1cXF1cXCldLiokL1xuXHRcdC8vIC0+IEZpbmFsIGN1cnJlbnQgZGVjcmVhc2UgaW5kZW50IHBhdHRlcm4gYXQgdGhlIHRpbWUgb2Ygd3JpdGluZ1xuXG5cdFx0Ly8gZXhwbGFuYXRpb246IFBvc2l0aXZlIGxvb2thaGVhZDogKD89IFx1MDBBQnBhdHRlcm5cdTAwQkIpIG1hdGNoZXMgaWYgcGF0dGVybiBtYXRjaGVzIHdoYXQgY29tZXMgYWZ0ZXIgdGhlIGN1cnJlbnQgbG9jYXRpb24gaW4gdGhlIGlucHV0IHN0cmluZy5cblx0XHQvLyBOZWdhdGl2ZSBsb29rYWhlYWQ6ICg/ISBcdTAwQUJwYXR0ZXJuXHUwMEJCKSBtYXRjaGVzIGlmIHBhdHRlcm4gZG9lcyBub3QgbWF0Y2ggd2hhdCBjb21lcyBhZnRlciB0aGUgY3VycmVudCBsb2NhdGlvbiBpbiB0aGUgaW5wdXQgc3RyaW5nXG5cdFx0Ly8gVGhlIGNoYW5nZSBwcm9wb3NlZCBpcyB0byBub3QgZGVjcmVhc2UgdGhlIGluZGVudCBpZiB0aGVyZSBpcyBhIG11bHRpLWxpbmUgY29tbWVudCBlbmRpbmcgb24gdGhlIHNhbWUgbGluZSBiZWZvcmUgdGhlIGNsb3NpbmcgcGFyZW50aGVzZXNcblxuXHRcdGNvbnN0IGZpbGVDb250ZW50cyA9IFtcblx0XHRcdCdmdW5jdGlvbiBmb28oKSB7Jyxcblx0XHRcdCcgICAgYmFyKC8qICAqLyknLFxuXHRcdFx0J307Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0lzc3VlICMyMDk4NTk6IGRvIG5vdCBkbyByZWluZGVudGF0aW9uIGZvciB0b2tlbnMgaW5zaWRlIG9mIGEgc3RyaW5nJywgKCkgPT4ge1xuXG5cdFx0Ly8gaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8yMDk4NTlcblxuXHRcdGNvbnN0IHRva2VuczogU3RhbmRhcmRUb2tlblR5cGVEYXRhW11bXSA9IFtcblx0XHRcdFtcblx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuT3RoZXIgfSxcblx0XHRcdFx0eyBzdGFydEluZGV4OiAxMiwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZyB9LFxuXHRcdFx0XSxcblx0XHRcdFtcblx0XHRcdFx0eyBzdGFydEluZGV4OiAwLCBzdGFuZGFyZFRva2VuVHlwZTogU3RhbmRhcmRUb2tlblR5cGUuU3RyaW5nIH0sXG5cdFx0XHRdLFxuXHRcdFx0W1xuXHRcdFx0XHR7IHN0YXJ0SW5kZXg6IDAsIHN0YW5kYXJkVG9rZW5UeXBlOiBTdGFuZGFyZFRva2VuVHlwZS5TdHJpbmcgfSxcblx0XHRcdF0sXG5cdFx0XHRbXG5cdFx0XHRcdHsgc3RhcnRJbmRleDogMCwgc3RhbmRhcmRUb2tlblR5cGU6IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZyB9LFxuXHRcdFx0XVxuXHRcdF07XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHJlZ2lzdGVyVG9rZW5pemF0aW9uU3VwcG9ydChpbnN0YW50aWF0aW9uU2VydmljZSwgdG9rZW5zLCBsYW5ndWFnZUlkKSk7XG5cdFx0Y29uc3QgZmlsZUNvbnRlbnRzID0gW1xuXHRcdFx0J2NvbnN0IGZvbyA9IGBzb21lIHRleHQnLFxuXHRcdFx0JyAgICAgICAgIHdoaWNoIGlzIHN0cmFuZ2VseScsXG5cdFx0XHQnICAgIGluZGVudGVkLiBJdCBzaG91bGQnLFxuXHRcdFx0JyAgIG5vdCBiZSByZWluZGVudGVkLmAnXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRjb25zdCBtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgZmlsZUNvbnRlbnRzLCBsYW5ndWFnZUlkLCBvcHRpb25zKSk7XG5cdFx0Zm9yY2VUb2tlbml6YXRpb25Gcm9tTGluZVRvTGluZShtb2RlbCwgMSwgNCk7XG5cdFx0Y29uc3QgZWRpdE9wZXJhdGlvbnMgPSBnZXRSZWluZGVudEVkaXRPcGVyYXRpb25zKG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCAxLCBtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0T3BlcmF0aW9ucy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHQvLyBGYWlsaW5nIHRlc3RzIGluZmVycmVkIGZyb20gdGhlIGN1cnJlbnQgcmVnZXhlcy4uLlxuXG5cdHRlc3Quc2tpcCgnSW5jb3JyZWN0IGRlaW5kZW50YXRpb24gYWZ0ZXIgYCovfWAgc3RyaW5nJywgKCkgPT4ge1xuXG5cdFx0Ly8gZXhwbGFuYXRpb246IElmICovIHdhcyBub3QgYmVmb3JlIHRoZSB9LCB0aGUgcmVnZXggZG9lcyBub3QgYWxsb3cgY2hhcmFjdGVycyBiZWZvcmUgdGhlIH0sIHNvIHRoZXJlIHdvdWxkIG5vdCBiZSBhbiBpbmRlbnRcblx0XHQvLyBIZXJlIHNpbmNlIHRoZXJlIGlzICovIGJlZm9yZSB0aGUgfSwgdGhlIHJlZ2V4IGFsbG93cyBhbGwgdGhlIGNoYXJhY3RlcnMgYmVmb3JlLCBoZW5jZSB0aGVyZSBpcyBhIGRlaW5kZW50XG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHRgY29uc3Qgb2JqID0ge2AsXG5cdFx0XHRgICAgIG9iajE6IHtgLFxuXHRcdFx0YCAgICAgICAgYnJhY2UgOiAnKi99J2AsXG5cdFx0XHRgICAgIH1gLFxuXHRcdFx0YH1gLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgb3B0aW9ucykpO1xuXHRcdGNvbnN0IGVkaXRPcGVyYXRpb25zID0gZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyhtb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdE9wZXJhdGlvbnMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0Ly8gRmFpbGluZyB0ZXN0cyBmcm9tIGlzc3Vlcy4uLlxuXG5cdHRlc3Quc2tpcCgnSXNzdWUgIzU2Mjc1JywgKCkgPT4ge1xuXG5cdFx0Ly8gaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy81NjI3NVxuXHRcdC8vIGV4cGxhbmF0aW9uOiBJZiAqLyB3YXMgbm90IGJlZm9yZSB0aGUgfSwgdGhlIHJlZ2V4IGRvZXMgbm90IGFsbG93IGNoYXJhY3RlcnMgYmVmb3JlIHRoZSB9LCBzbyB0aGVyZSB3b3VsZCBub3QgYmUgYW4gaW5kZW50XG5cdFx0Ly8gSGVyZSBzaW5jZSB0aGVyZSBpcyAqLyBiZWZvcmUgdGhlIH0sIHRoZSByZWdleCBhbGxvd3MgYWxsIHRoZSBjaGFyYWN0ZXJzIGJlZm9yZSwgaGVuY2UgdGhlcmUgaXMgYSBkZWluZGVudFxuXG5cdFx0bGV0IGZpbGVDb250ZW50cyA9IFtcblx0XHRcdCdmdW5jdGlvbiBmb28oKSB7Jyxcblx0XHRcdCcgICAgdmFyIGJhciA9ICgvYiovKTsnLFxuXHRcdFx0J30nLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0bGV0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRsZXQgZWRpdE9wZXJhdGlvbnMgPSBnZXRSZWluZGVudEVkaXRPcGVyYXRpb25zKG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCAxLCBtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0T3BlcmF0aW9ucy5sZW5ndGgsIDApO1xuXG5cdFx0ZmlsZUNvbnRlbnRzID0gW1xuXHRcdFx0J2Z1bmN0aW9uIGZvbygpIHsnLFxuXHRcdFx0JyAgICB2YXIgYmFyID0gXCIvYiovKVwiOycsXG5cdFx0XHQnfScsXG5cdFx0XS5qb2luKCdcXG4nKTtcblx0XHRtb2RlbCA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0ZVRleHRNb2RlbChpbnN0YW50aWF0aW9uU2VydmljZSwgZmlsZUNvbnRlbnRzLCBsYW5ndWFnZUlkLCBvcHRpb25zKSk7XG5cdFx0ZWRpdE9wZXJhdGlvbnMgPSBnZXRSZWluZGVudEVkaXRPcGVyYXRpb25zKG1vZGVsLCBsYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLCAxLCBtb2RlbC5nZXRMaW5lQ291bnQoKSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlZGl0T3BlcmF0aW9ucy5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0LnNraXAoJ0lzc3VlICMxMTY4NDMnLCAoKSA9PiB7XG5cblx0XHQvLyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExNjg0M1xuXHRcdC8vIHJlbGF0ZWQ6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy80MzI0NFxuXHRcdC8vIGV4cGxhbmF0aW9uOiBXaGVuIHlvdSBoYXZlIGFuIGFycm93IGZ1bmN0aW9uLCB5b3UgZG9uJ3QgaGF2ZSB7IG9yIH0sIGJ1dCB5b3Ugd291bGQgZXhwZWN0IGluZGVudGF0aW9uIHRvIHN0aWxsIGJlIGRvbmUgaW4gdGhhdCB3YXlcblxuXHRcdC8vIFRPRE86IHJlcXVpcmVzIGV4cGxvcmluZyBpbmRlbnQvb3V0ZGVudCBwYWlycyBpbnN0ZWFkXG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHQnY29uc3QgYWRkMSA9IChuKSA9PicsXG5cdFx0XHQnXHRuICsgMTsnLFxuXHRcdF0uam9pbignXFxuJyk7XG5cdFx0Y29uc3QgbW9kZWwgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGVUZXh0TW9kZWwoaW5zdGFudGlhdGlvblNlcnZpY2UsIGZpbGVDb250ZW50cywgbGFuZ3VhZ2VJZCwgb3B0aW9ucykpO1xuXHRcdGNvbnN0IGVkaXRPcGVyYXRpb25zID0gZ2V0UmVpbmRlbnRFZGl0T3BlcmF0aW9ucyhtb2RlbCwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgMSwgbW9kZWwuZ2V0TGluZUNvdW50KCkpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZWRpdE9wZXJhdGlvbnMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdC5za2lwKCdJc3N1ZSAjMTg1MjUyJywgKCkgPT4ge1xuXG5cdFx0Ly8gaXNzdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xODUyNTJcblx0XHQvLyBleHBsYW5hdGlvbjogUmVpbmRlbnRpbmcgdGhlIGNvbW1lbnQgY29ycmVjdGx5XG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHQnLyonLFxuXHRcdFx0JyAqIFRoaXMgaXMgYSBjb21tZW50LicsXG5cdFx0XHQnICovJyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdHRlc3Quc2tpcCgnSXNzdWUgNDMyNDQ6IGluY29ycmVjdCBpbmRlbnRhdGlvbiB3aGVuIHNpZ25hdHVyZSBvZiBmdW5jdGlvbiBjYWxsIHNwYW5zIHNldmVyYWwgbGluZXMnLCAoKSA9PiB7XG5cblx0XHQvLyBpc3N1ZTogaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzQzMjQ0XG5cblx0XHRjb25zdCBmaWxlQ29udGVudHMgPSBbXG5cdFx0XHQnZnVuY3Rpb24gY2FsbFNvbWVPdGhlckZ1bmN0aW9uKG9uZTogbnVtYmVyLCB0d286IG51bWJlcikgeyB9Jyxcblx0XHRcdCdmdW5jdGlvbiBzb21lRnVuY3Rpb24oKSB7Jyxcblx0XHRcdCcgICAgY2FsbFNvbWVPdGhlckZ1bmN0aW9uKDQsJyxcblx0XHRcdCcgICAgICAgIDUpJyxcblx0XHRcdCd9Jyxcblx0XHRdLmpvaW4oJ1xcbicpO1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRlVGV4dE1vZGVsKGluc3RhbnRpYXRpb25TZXJ2aWNlLCBmaWxlQ29udGVudHMsIGxhbmd1YWdlSWQsIG9wdGlvbnMpKTtcblx0XHRjb25zdCBlZGl0T3BlcmF0aW9ucyA9IGdldFJlaW5kZW50RWRpdE9wZXJhdGlvbnMobW9kZWwsIGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UsIDEsIG1vZGVsLmdldExpbmVDb3VudCgpKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVkaXRPcGVyYXRpb25zLmxlbmd0aCwgMCk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLFFBQVE7QUFDcEIsWUFBWSxVQUFVO0FBQ3RCLE9BQU8sWUFBWTtBQUNuQixTQUFTLHVCQUFvQztBQUM3QyxTQUFTLCtDQUErQztBQUN4RCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGlDQUFpQztBQUMxQyxTQUEyQyxxQkFBcUIsNEJBQTRCO0FBRTVGLFNBQWlDLHdDQUF3QztBQUN6RSxTQUFTLGFBQWE7QUFHdEIsU0FBUyw4QkFBOEI7QUFDdkMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywyQkFBeUQsNEJBQTRCO0FBQzlGLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCLHlCQUF5QjtBQUVsRCxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLFVBQVUsT0FBdUI7QUFDekMsU0FBTztBQUFBLElBQ04saUJBQWlCLE1BQU07QUFBQSxJQUN2QixhQUFhLE1BQU07QUFBQSxJQUNuQixlQUFlLE1BQU07QUFBQSxJQUNyQixXQUFXLE1BQU07QUFBQSxFQUNsQjtBQUNEO0FBRUEsSUFBVyxhQUFYLGtCQUFXQSxnQkFBWDtBQUNDLEVBQUFB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
