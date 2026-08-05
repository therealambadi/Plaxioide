import assert from "assert";
import { TestInstantiationService } from "../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../base/test/common/utils.js";
import { TreeSitterTextModelService } from "../../../editor/common/services/treeSitter/treeSitterParserService.js";
import { IModelService } from "../../../editor/common/services/model.js";
import { Event } from "../../../base/common/event.js";
import { URI } from "../../../base/common/uri.js";
import { IFileService } from "../../../platform/files/common/files.js";
import { ILogService, NullLogService } from "../../../platform/log/common/log.js";
import { ITelemetryService, TelemetryLevel } from "../../../platform/telemetry/common/telemetry.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../platform/configuration/test/common/testConfigurationService.js";
import { IEnvironmentService } from "../../../platform/environment/common/environment.js";
import { ModelService } from "../../../editor/common/services/modelService.js";
import { TreeSitterTokenizationFeature } from "../../services/treeSitter/browser/treeSitterTokenizationFeature.js";
import { ITreeSitterImporter, ITreeSitterParserService, TreeSitterImporter } from "../../../editor/common/services/treeSitterParserService.js";
import { TreeSitterTokenizationRegistry } from "../../../editor/common/languages.js";
import { FileService } from "../../../platform/files/common/fileService.js";
import { Schemas } from "../../../base/common/network.js";
import { DiskFileSystemProvider } from "../../../platform/files/node/diskFileSystemProvider.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { LanguageService } from "../../../editor/common/services/languageService.js";
import { TestColorTheme, TestThemeService } from "../../../platform/theme/test/common/testThemeService.js";
import { IThemeService } from "../../../platform/theme/common/themeService.js";
import { ITextResourcePropertiesService } from "../../../editor/common/services/textResourceConfiguration.js";
import { TestTextResourcePropertiesService } from "../common/workbenchTestServices.js";
import { TestLanguageConfigurationService } from "../../../editor/test/common/modes/testLanguageConfigurationService.js";
import { ILanguageConfigurationService } from "../../../editor/common/languages/languageConfigurationRegistry.js";
import { IUndoRedoService } from "../../../platform/undoRedo/common/undoRedo.js";
import { UndoRedoService } from "../../../platform/undoRedo/common/undoRedoService.js";
import { TestDialogService } from "../../../platform/dialogs/test/common/testDialogService.js";
import { TestNotificationService } from "../../../platform/notification/test/common/testNotificationService.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { TokenStyle } from "../../../platform/theme/common/tokenClassificationRegistry.js";
import { Color } from "../../../base/common/color.js";
import { ITreeSitterTokenizationStoreService } from "../../../editor/common/model/treeSitterTokenStoreService.js";
import { Range } from "../../../editor/common/core/range.js";
import { ICodeEditorService } from "../../../editor/browser/services/codeEditorService.js";
import { TestCodeEditorService } from "../../../editor/test/browser/editorTestServices.js";
class MockTelemetryService {
  constructor() {
    this.telemetryLevel = TelemetryLevel.NONE;
    this.sessionId = "";
    this.machineId = "";
    this.sqmId = "";
    this.devDeviceId = "";
    this.firstSessionDate = "";
    this.sendErrorTelemetry = false;
  }
  publicLog(eventName, data) {
  }
  publicLog2(eventName, data) {
  }
  publicLogError(errorEventName, data) {
  }
  publicLogError2(eventName, data) {
  }
  setExperimentProperty(name, value) {
  }
}
class MockTokenStoreService {
  delete(model) {
    throw new Error("Method not implemented.");
  }
  handleContentChanged(model, e) {
  }
  rangeHasTokens(model, range, minimumTokenQuality) {
    return true;
  }
  rangHasAnyTokens(model) {
    return true;
  }
  getNeedsRefresh(model) {
    return [];
  }
  setTokens(model, tokens) {
  }
  getTokens(model, line) {
    return void 0;
  }
  updateTokens(model, version, updates) {
  }
  markForRefresh(model, range) {
  }
  hasTokens(model, accurateForRange) {
    return true;
  }
}
class TestTreeSitterColorTheme extends TestColorTheme {
  resolveScopes(scopes, definitions) {
    return new TokenStyle(Color.red, void 0, void 0, void 0, void 0);
  }
  getTokenColorIndex() {
    return { get: () => 10 };
  }
}
suite("Tree Sitter TokenizationFeature", function() {
  let instantiationService;
  let modelService;
  let fileService;
  let textResourcePropertiesService;
  let languageConfigurationService;
  let telemetryService;
  let logService;
  let configurationService;
  let themeService;
  let languageService;
  let environmentService;
  let tokenStoreService;
  let treeSitterParserService;
  let treeSitterTokenizationSupport;
  let disposables;
  setup(async () => {
    disposables = new DisposableStore();
    instantiationService = disposables.add(new TestInstantiationService());
    telemetryService = new MockTelemetryService();
    logService = new NullLogService();
    configurationService = new TestConfigurationService({ "editor.experimental.preferTreeSitter.typescript": true });
    themeService = new TestThemeService(new TestTreeSitterColorTheme());
    environmentService = {};
    tokenStoreService = new MockTokenStoreService();
    instantiationService.set(IEnvironmentService, environmentService);
    instantiationService.set(IConfigurationService, configurationService);
    instantiationService.set(ILogService, logService);
    instantiationService.set(ITelemetryService, telemetryService);
    instantiationService.set(ITreeSitterTokenizationStoreService, tokenStoreService);
    languageService = disposables.add(instantiationService.createInstance(LanguageService));
    instantiationService.set(ILanguageService, languageService);
    instantiationService.set(IThemeService, themeService);
    textResourcePropertiesService = instantiationService.createInstance(TestTextResourcePropertiesService);
    instantiationService.set(ITextResourcePropertiesService, textResourcePropertiesService);
    languageConfigurationService = disposables.add(instantiationService.createInstance(TestLanguageConfigurationService));
    instantiationService.set(ILanguageConfigurationService, languageConfigurationService);
    instantiationService.set(ITreeSitterImporter, instantiationService.createInstance(TreeSitterImporter));
    instantiationService.set(ICodeEditorService, instantiationService.createInstance(TestCodeEditorService));
    fileService = disposables.add(instantiationService.createInstance(FileService));
    const diskFileSystemProvider = disposables.add(new DiskFileSystemProvider(logService));
    disposables.add(fileService.registerProvider(Schemas.file, diskFileSystemProvider));
    instantiationService.set(IFileService, fileService);
    const dialogService = new TestDialogService();
    const notificationService = new TestNotificationService();
    const undoRedoService = new UndoRedoService(dialogService, notificationService);
    instantiationService.set(IUndoRedoService, undoRedoService);
    modelService = new ModelService(
      configurationService,
      textResourcePropertiesService,
      undoRedoService,
      instantiationService
    );
    instantiationService.set(IModelService, modelService);
    treeSitterParserService = disposables.add(instantiationService.createInstance(TreeSitterTextModelService));
    treeSitterParserService.isTest = true;
    instantiationService.set(ITreeSitterParserService, treeSitterParserService);
    disposables.add(instantiationService.createInstance(TreeSitterTokenizationFeature));
    treeSitterTokenizationSupport = disposables.add(await TreeSitterTokenizationRegistry.getOrCreate("typescript"));
  });
  teardown(() => {
    disposables.dispose();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function tokensContentSize(tokens) {
    return tokens[tokens.length - 1].startOffsetInclusive + tokens[tokens.length - 1].length;
  }
  let nameNumber = 1;
  async function getModelAndPrepTree(content) {
    const model = disposables.add(modelService.createModel(content, { languageId: "typescript", onDidChange: Event.None }, URI.file(`file${nameNumber++}.ts`)));
    const tree = disposables.add(await treeSitterParserService.getTextModelTreeSitter(model));
    const treeParseResult = new Promise((resolve) => {
      const disposable = treeSitterParserService.onDidUpdateTree((e) => {
        if (e.textModel === model) {
          disposable.dispose();
          resolve();
        }
      });
    });
    await tree.parse();
    await treeParseResult;
    assert.ok(tree);
    return model;
  }
  function verifyTokens(tokens) {
    assert.ok(tokens);
    for (let i = 1; i < tokens.length; i++) {
      const previousToken = tokens[i - 1];
      const token = tokens[i];
      assert.deepStrictEqual(previousToken.startOffsetInclusive + previousToken.length, token.startOffsetInclusive);
    }
  }
  test("Three changes come back to back ", async () => {
    const content = `/**
**/
class x {
}




class y {
}`;
    const model = await getModelAndPrepTree(content);
    let updateListener;
    let change;
    const updatePromise = new Promise((resolve) => {
      updateListener = treeSitterParserService.onDidUpdateTree(async (e) => {
        if (e.textModel === model) {
          change = e;
          resolve();
        }
      });
    });
    const edit1 = new Promise((resolve) => {
      model.applyEdits([{ range: new Range(7, 1, 8, 1), text: "" }]);
      resolve();
    });
    const edit2 = new Promise((resolve) => {
      model.applyEdits([{ range: new Range(6, 1, 7, 1), text: "" }]);
      resolve();
    });
    const edit3 = new Promise((resolve) => {
      model.applyEdits([{ range: new Range(5, 1, 6, 1), text: "" }]);
      resolve();
    });
    const edits = Promise.all([edit1, edit2, edit3]);
    await updatePromise;
    await edits;
    assert.ok(change);
    assert.strictEqual(change.versionId, 4);
    assert.strictEqual(change.ranges[0].newRangeStartOffset, 0);
    assert.strictEqual(change.ranges[0].newRangeEndOffset, 32);
    assert.strictEqual(change.ranges[0].newRange.startLineNumber, 1);
    assert.strictEqual(change.ranges[0].newRange.endLineNumber, 7);
    updateListener?.dispose();
    modelService.destroyModel(model.uri);
  });
  test("File single line file", async () => {
    const content = `console.log('x');`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 1, 18), 0, 17);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 9);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with new lines at beginning and end", async () => {
    const content = `
console.log('x');
`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 3, 1), 0, 19);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 11);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with new lines at beginning and end \\r\\n", async () => {
    const content = "\r\nconsole.log('x');\r\n";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 3, 1), 0, 21);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 11);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with empty lines in the middle", async () => {
    const content = `
console.log('x');

console.log('7');
`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 5, 1), 0, 38);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 21);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with empty lines in the middle \\r\\n", async () => {
    const content = "\r\nconsole.log('x');\r\n\r\nconsole.log('7');\r\n";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 5, 1), 0, 42);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 21);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with non-empty lines that match no scopes", async () => {
    const content = `console.log('x');
;
{
}
`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 5, 1), 0, 24);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 16);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with non-empty lines that match no scopes \\r\\n", async () => {
    const content = "console.log('x');\r\n;\r\n{\r\n}\r\n";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 5, 1), 0, 28);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 16);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with tree-sitter token that spans multiple lines", async () => {
    const content = `/**
**/

console.log('x');

`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 6, 1), 0, 28);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 12);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with tree-sitter token that spans multiple lines \\r\\n", async () => {
    const content = "/**\r\n**/\r\n\r\nconsole.log('x');\r\n\r\n";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 6, 1), 0, 33);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 12);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with tabs", async () => {
    const content = `function x() {
	return true;
}

class Y {
	private z = false;
}`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 7, 1), 0, 63);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 30);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("File with tabs \\r\\n", async () => {
    const content = "function x() {\r\n	return true;\r\n}\r\n\r\nclass Y {\r\n	private z = false;\r\n}";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 7, 1), 0, 69);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 30);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("Template string", async () => {
    const content = "`t ${6}`";
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 1, 8), 0, 8);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 6);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
  test("Many nested scopes", async () => {
    const content = `y = new x(ttt({
	message: '{0} i\\n\\n [commandName]({1}).',
	args: ['Test', \`command:\${openSettingsCommand}?\${encodeURIComponent('["SettingName"]')}\`],
	// To make sure the translators don't break the link
	comment: ["{Locked=']({'}"]
}));`;
    const model = await getModelAndPrepTree(content);
    const tokens = treeSitterTokenizationSupport.getTokensInRange(model, new Range(1, 1, 6, 5), 0, 238);
    verifyTokens(tokens);
    assert.deepStrictEqual(tokens?.length, 65);
    assert.deepStrictEqual(tokensContentSize(tokens), content.length);
    modelService.destroyModel(model.uri);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvdGVzdC9lbGVjdHJvbi1tYWluL3RyZWVTaXR0ZXJUb2tlbml6YXRpb25GZWF0dXJlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IFRyZWVTaXR0ZXJUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90cmVlU2l0dGVyL3RyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSwgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5RGF0YSwgSVRlbGVtZXRyeVNlcnZpY2UsIFRlbGVtZXRyeUxldmVsIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgQ2xhc3NpZmllZEV2ZW50LCBPbWl0TWV0YWRhdGEsIElHRFBSUHJvcGVydHksIFN0cmljdFByb3BlcnR5Q2hlY2sgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL2dkcHJUeXBpbmdzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsU2VydmljZS5qcyc7XG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1sYXllcmluZywgbG9jYWwvY29kZS1pbXBvcnQtcGF0dGVybnNcbmltcG9ydCB7IFRyZWVTaXR0ZXJUb2tlbml6YXRpb25GZWF0dXJlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvdHJlZVNpdHRlci9icm93c2VyL3RyZWVTaXR0ZXJUb2tlbml6YXRpb25GZWF0dXJlLmpzJztcbmltcG9ydCB7IElUcmVlU2l0dGVySW1wb3J0ZXIsIElUcmVlU2l0dGVyUGFyc2VyU2VydmljZSwgVHJlZVNpdHRlckltcG9ydGVyLCBUcmVlVXBkYXRlRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL3RyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUcmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydCwgVHJlZVNpdHRlclRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgRGlza0ZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL25vZGUvZGlza0ZpbGVTeXN0ZW1Qcm92aWRlci5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVGVzdENvbG9yVGhlbWUsIFRlc3RUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS90ZXN0L2NvbW1vbi90ZXN0VGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdGhlbWVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvdGV4dFJlc291cmNlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBUZXN0VGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IFRlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL3Rlc3QvY29tbW9uL21vZGVzL3Rlc3RMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVVuZG9SZWRvU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3VuZG9SZWRvL2NvbW1vbi91bmRvUmVkby5qcyc7XG5pbXBvcnQgeyBVbmRvUmVkb1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS91bmRvUmVkby9jb21tb24vdW5kb1JlZG9TZXJ2aWNlLmpzJztcbmltcG9ydCB7IFRlc3REaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy90ZXN0L2NvbW1vbi90ZXN0RGlhbG9nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBUZXN0Tm90aWZpY2F0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Tm90aWZpY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFByb2JlU2NvcGUsIFRva2VuU3R5bGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS90aGVtZS9jb21tb24vdG9rZW5DbGFzc2lmaWNhdGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFRleHRNYXRlVGhlbWluZ1J1bGVEZWZpbml0aW9ucyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL3RoZW1lcy9jb21tb24vY29sb3JUaGVtZURhdGEuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBJVHJlZVNpdHRlclRva2VuaXphdGlvblN0b3JlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwvdHJlZVNpdHRlclRva2VuU3RvcmVTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IFRva2VuUXVhbGl0eSwgVG9rZW5VcGRhdGUgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3Rva2VuU3RvcmUuanMnO1xuLy8gZXNsaW50LWRpc2FibGUtbmV4dC1saW5lIGxvY2FsL2NvZGUtbGF5ZXJpbmcsIGxvY2FsL2NvZGUtaW1wb3J0LXBhdHRlcm5zXG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG4vLyBlc2xpbnQtZGlzYWJsZS1uZXh0LWxpbmUgbG9jYWwvY29kZS1sYXllcmluZywgbG9jYWwvY29kZS1pbXBvcnQtcGF0dGVybnNcbmltcG9ydCB7IFRlc3RDb2RlRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci90ZXN0L2Jyb3dzZXIvZWRpdG9yVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3RleHRNb2RlbEV2ZW50cy5qcyc7XG5cbmNsYXNzIE1vY2tUZWxlbWV0cnlTZXJ2aWNlIGltcGxlbWVudHMgSVRlbGVtZXRyeVNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHRlbGVtZXRyeUxldmVsOiBUZWxlbWV0cnlMZXZlbCA9IFRlbGVtZXRyeUxldmVsLk5PTkU7XG5cdHNlc3Npb25JZDogc3RyaW5nID0gJyc7XG5cdG1hY2hpbmVJZDogc3RyaW5nID0gJyc7XG5cdHNxbUlkOiBzdHJpbmcgPSAnJztcblx0ZGV2RGV2aWNlSWQ6IHN0cmluZyA9ICcnO1xuXHRmaXJzdFNlc3Npb25EYXRlOiBzdHJpbmcgPSAnJztcblx0c2VuZEVycm9yVGVsZW1ldHJ5OiBib29sZWFuID0gZmFsc2U7XG5cdHB1YmxpY0xvZyhldmVudE5hbWU6IHN0cmluZywgZGF0YT86IElUZWxlbWV0cnlEYXRhKTogdm9pZCB7XG5cdH1cblx0cHVibGljTG9nMjxFIGV4dGVuZHMgQ2xhc3NpZmllZEV2ZW50PE9taXRNZXRhZGF0YTxUPj4gPSBuZXZlciwgVCBleHRlbmRzIElHRFBSUHJvcGVydHkgPSBuZXZlcj4oZXZlbnROYW1lOiBzdHJpbmcsIGRhdGE/OiBTdHJpY3RQcm9wZXJ0eUNoZWNrPFQsIEU+KTogdm9pZCB7XG5cdH1cblx0cHVibGljTG9nRXJyb3IoZXJyb3JFdmVudE5hbWU6IHN0cmluZywgZGF0YT86IElUZWxlbWV0cnlEYXRhKTogdm9pZCB7XG5cdH1cblx0cHVibGljTG9nRXJyb3IyPEUgZXh0ZW5kcyBDbGFzc2lmaWVkRXZlbnQ8T21pdE1ldGFkYXRhPFQ+PiA9IG5ldmVyLCBUIGV4dGVuZHMgSUdEUFJQcm9wZXJ0eSA9IG5ldmVyPihldmVudE5hbWU6IHN0cmluZywgZGF0YT86IFN0cmljdFByb3BlcnR5Q2hlY2s8VCwgRT4pOiB2b2lkIHtcblx0fVxuXHRzZXRFeHBlcmltZW50UHJvcGVydHkobmFtZTogc3RyaW5nLCB2YWx1ZTogc3RyaW5nKTogdm9pZCB7XG5cdH1cbn1cblxuY2xhc3MgTW9ja1Rva2VuU3RvcmVTZXJ2aWNlIGltcGxlbWVudHMgSVRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdG9yZVNlcnZpY2Uge1xuXHRkZWxldGUobW9kZWw6IElUZXh0TW9kZWwpOiB2b2lkIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0aGFuZGxlQ29udGVudENoYW5nZWQobW9kZWw6IElUZXh0TW9kZWwsIGU6IElNb2RlbENvbnRlbnRDaGFuZ2VkRXZlbnQpOiB2b2lkIHtcblx0fVxuXHRyYW5nZUhhc1Rva2Vucyhtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IFJhbmdlLCBtaW5pbXVtVG9rZW5RdWFsaXR5OiBUb2tlblF1YWxpdHkpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXHRyYW5nSGFzQW55VG9rZW5zKG1vZGVsOiBJVGV4dE1vZGVsKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblx0Z2V0TmVlZHNSZWZyZXNoKG1vZGVsOiBJVGV4dE1vZGVsKTogeyByYW5nZTogUmFuZ2U7IHN0YXJ0T2Zmc2V0OiBudW1iZXI7IGVuZE9mZnNldDogbnVtYmVyIH1bXSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHRzZXRUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwsIHRva2VuczogVG9rZW5VcGRhdGVbXSk6IHZvaWQge1xuXHR9XG5cdGdldFRva2Vucyhtb2RlbDogSVRleHRNb2RlbCwgbGluZTogbnVtYmVyKTogVWludDMyQXJyYXkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0dXBkYXRlVG9rZW5zKG1vZGVsOiBJVGV4dE1vZGVsLCB2ZXJzaW9uOiBudW1iZXIsIHVwZGF0ZXM6IHsgb2xkUmFuZ2VMZW5ndGg6IG51bWJlcjsgbmV3VG9rZW5zOiBUb2tlblVwZGF0ZVtdIH1bXSk6IHZvaWQge1xuXHR9XG5cdG1hcmtGb3JSZWZyZXNoKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UpOiB2b2lkIHtcblx0fVxuXHRoYXNUb2tlbnMobW9kZWw6IElUZXh0TW9kZWwsIGFjY3VyYXRlRm9yUmFuZ2U/OiBSYW5nZSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cbn1cblxuY2xhc3MgVGVzdFRyZWVTaXR0ZXJDb2xvclRoZW1lIGV4dGVuZHMgVGVzdENvbG9yVGhlbWUge1xuXHRwdWJsaWMgcmVzb2x2ZVNjb3BlcyhzY29wZXM6IFByb2JlU2NvcGVbXSwgZGVmaW5pdGlvbnM/OiBUZXh0TWF0ZVRoZW1pbmdSdWxlRGVmaW5pdGlvbnMpOiBUb2tlblN0eWxlIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gbmV3IFRva2VuU3R5bGUoQ29sb3IucmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cdHB1YmxpYyBnZXRUb2tlbkNvbG9ySW5kZXgoKTogeyBnZXQ6ICgpID0+IG51bWJlciB9IHtcblx0XHRyZXR1cm4geyBnZXQ6ICgpID0+IDEwIH07XG5cdH1cbn1cblxuc3VpdGUoJ1RyZWUgU2l0dGVyIFRva2VuaXphdGlvbkZlYXR1cmUnLCBmdW5jdGlvbiAoKSB7XG5cblx0bGV0IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2U7XG5cdGxldCBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlO1xuXHRsZXQgdGV4dFJlc291cmNlUHJvcGVydGllc1NlcnZpY2U6IElUZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZTtcblx0bGV0IGxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlO1xuXHRsZXQgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2U7XG5cdGxldCBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZTtcblx0bGV0IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2U7XG5cdGxldCB0aGVtZVNlcnZpY2U6IElUaGVtZVNlcnZpY2U7XG5cdGxldCBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2U7XG5cdGxldCBlbnZpcm9ubWVudFNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2U7XG5cdGxldCB0b2tlblN0b3JlU2VydmljZTogSVRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdG9yZVNlcnZpY2U7XG5cdGxldCB0cmVlU2l0dGVyUGFyc2VyU2VydmljZTogVHJlZVNpdHRlclRleHRNb2RlbFNlcnZpY2U7XG5cdGxldCB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydDogSVRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0O1xuXG5cdGxldCBkaXNwb3NhYmxlczogRGlzcG9zYWJsZVN0b3JlO1xuXG5cdHNldHVwKGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKCkpO1xuXG5cdFx0dGVsZW1ldHJ5U2VydmljZSA9IG5ldyBNb2NrVGVsZW1ldHJ5U2VydmljZSgpO1xuXHRcdGxvZ1NlcnZpY2UgPSBuZXcgTnVsbExvZ1NlcnZpY2UoKTtcblx0XHRjb25maWd1cmF0aW9uU2VydmljZSA9IG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoeyAnZWRpdG9yLmV4cGVyaW1lbnRhbC5wcmVmZXJUcmVlU2l0dGVyLnR5cGVzY3JpcHQnOiB0cnVlIH0pO1xuXHRcdHRoZW1lU2VydmljZSA9IG5ldyBUZXN0VGhlbWVTZXJ2aWNlKG5ldyBUZXN0VHJlZVNpdHRlckNvbG9yVGhlbWUoKSk7XG5cdFx0ZW52aXJvbm1lbnRTZXJ2aWNlID0ge30gYXMgSUVudmlyb25tZW50U2VydmljZTtcblx0XHR0b2tlblN0b3JlU2VydmljZSA9IG5ldyBNb2NrVG9rZW5TdG9yZVNlcnZpY2UoKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJRW52aXJvbm1lbnRTZXJ2aWNlLCBlbnZpcm9ubWVudFNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUxvZ1NlcnZpY2UsIGxvZ1NlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJVGVsZW1ldHJ5U2VydmljZSwgdGVsZW1ldHJ5U2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElUcmVlU2l0dGVyVG9rZW5pemF0aW9uU3RvcmVTZXJ2aWNlLCB0b2tlblN0b3JlU2VydmljZSk7XG5cdFx0bGFuZ3VhZ2VTZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExhbmd1YWdlU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJTGFuZ3VhZ2VTZXJ2aWNlLCBsYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJVGhlbWVTZXJ2aWNlLCB0aGVtZVNlcnZpY2UpO1xuXHRcdHRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlID0gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVGVzdFRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVRleHRSZXNvdXJjZVByb3BlcnRpZXNTZXJ2aWNlLCB0ZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSk7XG5cdFx0bGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUZXN0TGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSwgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSk7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElUcmVlU2l0dGVySW1wb3J0ZXIsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRyZWVTaXR0ZXJJbXBvcnRlcikpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJQ29kZUVkaXRvclNlcnZpY2UsIGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRlc3RDb2RlRWRpdG9yU2VydmljZSkpO1xuXG5cdFx0ZmlsZVNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoRmlsZVNlcnZpY2UpKTtcblx0XHRjb25zdCBkaXNrRmlsZVN5c3RlbVByb3ZpZGVyID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBEaXNrRmlsZVN5c3RlbVByb3ZpZGVyKGxvZ1NlcnZpY2UpKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZmlsZVNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcihTY2hlbWFzLmZpbGUsIGRpc2tGaWxlU3lzdGVtUHJvdmlkZXIpKTtcblxuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLnNldChJRmlsZVNlcnZpY2UsIGZpbGVTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGRpYWxvZ1NlcnZpY2UgPSBuZXcgVGVzdERpYWxvZ1NlcnZpY2UoKTtcblx0XHRjb25zdCBub3RpZmljYXRpb25TZXJ2aWNlID0gbmV3IFRlc3ROb3RpZmljYXRpb25TZXJ2aWNlKCk7XG5cdFx0Y29uc3QgdW5kb1JlZG9TZXJ2aWNlID0gbmV3IFVuZG9SZWRvU2VydmljZShkaWFsb2dTZXJ2aWNlLCBub3RpZmljYXRpb25TZXJ2aWNlKTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVVuZG9SZWRvU2VydmljZSwgdW5kb1JlZG9TZXJ2aWNlKTtcblx0XHRtb2RlbFNlcnZpY2UgPSBuZXcgTW9kZWxTZXJ2aWNlKFxuXHRcdFx0Y29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0XHR0ZXh0UmVzb3VyY2VQcm9wZXJ0aWVzU2VydmljZSxcblx0XHRcdHVuZG9SZWRvU2VydmljZSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlXG5cdFx0KTtcblx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSU1vZGVsU2VydmljZSwgbW9kZWxTZXJ2aWNlKTtcblx0XHR0cmVlU2l0dGVyUGFyc2VyU2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUcmVlU2l0dGVyVGV4dE1vZGVsU2VydmljZSkpO1xuXHRcdHRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLmlzVGVzdCA9IHRydWU7XG5cdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc2V0KElUcmVlU2l0dGVyUGFyc2VyU2VydmljZSwgdHJlZVNpdHRlclBhcnNlclNlcnZpY2UpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChpbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShUcmVlU2l0dGVyVG9rZW5pemF0aW9uRmVhdHVyZSkpO1xuXHRcdHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0ID0gZGlzcG9zYWJsZXMuYWRkKGF3YWl0IFRyZWVTaXR0ZXJUb2tlbml6YXRpb25SZWdpc3RyeS5nZXRPckNyZWF0ZSgndHlwZXNjcmlwdCcpIGFzIChJVHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQgJiBJRGlzcG9zYWJsZSkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHRmdW5jdGlvbiB0b2tlbnNDb250ZW50U2l6ZSh0b2tlbnM6IFRva2VuVXBkYXRlW10pIHtcblx0XHRyZXR1cm4gdG9rZW5zW3Rva2Vucy5sZW5ndGggLSAxXS5zdGFydE9mZnNldEluY2x1c2l2ZSArIHRva2Vuc1t0b2tlbnMubGVuZ3RoIC0gMV0ubGVuZ3RoO1xuXHR9XG5cblx0bGV0IG5hbWVOdW1iZXIgPSAxO1xuXHRhc3luYyBmdW5jdGlvbiBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQ6IHN0cmluZykge1xuXHRcdGNvbnN0IG1vZGVsID0gZGlzcG9zYWJsZXMuYWRkKG1vZGVsU2VydmljZS5jcmVhdGVNb2RlbChjb250ZW50LCB7IGxhbmd1YWdlSWQ6ICd0eXBlc2NyaXB0Jywgb25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUgfSwgVVJJLmZpbGUoYGZpbGUke25hbWVOdW1iZXIrK30udHNgKSkpO1xuXHRcdGNvbnN0IHRyZWUgPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgdHJlZVNpdHRlclBhcnNlclNlcnZpY2UuZ2V0VGV4dE1vZGVsVHJlZVNpdHRlcihtb2RlbCkpO1xuXHRcdGNvbnN0IHRyZWVQYXJzZVJlc3VsdCA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLm9uRGlkVXBkYXRlVHJlZShlID0+IHtcblx0XHRcdFx0aWYgKGUudGV4dE1vZGVsID09PSBtb2RlbCkge1xuXHRcdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdFx0YXdhaXQgdHJlZS5wYXJzZSgpO1xuXHRcdGF3YWl0IHRyZWVQYXJzZVJlc3VsdDtcblxuXHRcdGFzc2VydC5vayh0cmVlKTtcblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHRmdW5jdGlvbiB2ZXJpZnlUb2tlbnModG9rZW5zOiBUb2tlblVwZGF0ZVtdIHwgdW5kZWZpbmVkKSB7XG5cdFx0YXNzZXJ0Lm9rKHRva2Vucyk7XG5cdFx0Zm9yIChsZXQgaSA9IDE7IGkgPCB0b2tlbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzVG9rZW46IFRva2VuVXBkYXRlID0gdG9rZW5zW2kgLSAxXTtcblx0XHRcdGNvbnN0IHRva2VuOiBUb2tlblVwZGF0ZSA9IHRva2Vuc1tpXTtcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocHJldmlvdXNUb2tlbi5zdGFydE9mZnNldEluY2x1c2l2ZSArIHByZXZpb3VzVG9rZW4ubGVuZ3RoLCB0b2tlbi5zdGFydE9mZnNldEluY2x1c2l2ZSk7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgnVGhyZWUgY2hhbmdlcyBjb21lIGJhY2sgdG8gYmFjayAnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGAvKipcbioqL1xuY2xhc3MgeCB7XG59XG5cblxuXG5cbmNsYXNzIHkge1xufWA7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXG5cdFx0bGV0IHVwZGF0ZUxpc3RlbmVyOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgY2hhbmdlOiBUcmVlVXBkYXRlRXZlbnQgfCB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCB1cGRhdGVQcm9taXNlID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHR1cGRhdGVMaXN0ZW5lciA9IHRyZWVTaXR0ZXJQYXJzZXJTZXJ2aWNlLm9uRGlkVXBkYXRlVHJlZShhc3luYyBlID0+IHtcblx0XHRcdFx0aWYgKGUudGV4dE1vZGVsID09PSBtb2RlbCkge1xuXHRcdFx0XHRcdGNoYW5nZSA9IGU7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGVkaXQxID0gbmV3IFByb21pc2U8dm9pZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRtb2RlbC5hcHBseUVkaXRzKFt7IHJhbmdlOiBuZXcgUmFuZ2UoNywgMSwgOCwgMSksIHRleHQ6ICcnIH1dKTtcblx0XHRcdHJlc29sdmUoKTtcblx0XHR9KTtcblx0XHRjb25zdCBlZGl0MiA9IG5ldyBQcm9taXNlPHZvaWQ+KHJlc29sdmUgPT4ge1xuXHRcdFx0bW9kZWwuYXBwbHlFZGl0cyhbeyByYW5nZTogbmV3IFJhbmdlKDYsIDEsIDcsIDEpLCB0ZXh0OiAnJyB9XSk7XG5cdFx0XHRyZXNvbHZlKCk7XG5cdFx0fSk7XG5cdFx0Y29uc3QgZWRpdDMgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdG1vZGVsLmFwcGx5RWRpdHMoW3sgcmFuZ2U6IG5ldyBSYW5nZSg1LCAxLCA2LCAxKSwgdGV4dDogJycgfV0pO1xuXHRcdFx0cmVzb2x2ZSgpO1xuXHRcdH0pO1xuXHRcdGNvbnN0IGVkaXRzID0gUHJvbWlzZS5hbGwoW2VkaXQxLCBlZGl0MiwgZWRpdDNdKTtcblx0XHRhd2FpdCB1cGRhdGVQcm9taXNlO1xuXHRcdGF3YWl0IGVkaXRzO1xuXHRcdGFzc2VydC5vayhjaGFuZ2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZS52ZXJzaW9uSWQsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2UucmFuZ2VzWzBdLm5ld1JhbmdlU3RhcnRPZmZzZXQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjaGFuZ2UucmFuZ2VzWzBdLm5ld1JhbmdlRW5kT2Zmc2V0LCAzMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZS5yYW5nZXNbMF0ubmV3UmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlLnJhbmdlc1swXS5uZXdSYW5nZS5lbmRMaW5lTnVtYmVyLCA3KTtcblxuXHRcdHVwZGF0ZUxpc3RlbmVyPy5kaXNwb3NlKCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChtb2RlbC51cmkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIHNpbmdsZSBsaW5lIGZpbGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGBjb25zb2xlLmxvZygneCcpO2A7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCAxLCAxOCksIDAsIDE3KTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCA5KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgd2l0aCBuZXcgbGluZXMgYXQgYmVnaW5uaW5nIGFuZCBlbmQnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9IGBcbmNvbnNvbGUubG9nKCd4Jyk7XG5gO1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgZ2V0TW9kZWxBbmRQcmVwVHJlZShjb250ZW50KTtcblx0XHRjb25zdCB0b2tlbnMgPSB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydC5nZXRUb2tlbnNJblJhbmdlKG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMywgMSksIDAsIDE5KTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCAxMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnNDb250ZW50U2l6ZSh0b2tlbnMpLCBjb250ZW50Lmxlbmd0aCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChtb2RlbC51cmkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIHdpdGggbmV3IGxpbmVzIGF0IGJlZ2lubmluZyBhbmQgZW5kIFxcXFxyXFxcXG4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9ICdcXHJcXG5jb25zb2xlLmxvZyhcXCd4XFwnKTtcXHJcXG4nO1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgZ2V0TW9kZWxBbmRQcmVwVHJlZShjb250ZW50KTtcblx0XHRjb25zdCB0b2tlbnMgPSB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydC5nZXRUb2tlbnNJblJhbmdlKG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgMywgMSksIDAsIDIxKTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCAxMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnNDb250ZW50U2l6ZSh0b2tlbnMpLCBjb250ZW50Lmxlbmd0aCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChtb2RlbC51cmkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIHdpdGggZW1wdHkgbGluZXMgaW4gdGhlIG1pZGRsZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gYFxuY29uc29sZS5sb2coJ3gnKTtcblxuY29uc29sZS5sb2coJzcnKTtcbmA7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCA1LCAxKSwgMCwgMzgpO1xuXHRcdHZlcmlmeVRva2Vucyh0b2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zPy5sZW5ndGgsIDIxKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgd2l0aCBlbXB0eSBsaW5lcyBpbiB0aGUgbWlkZGxlIFxcXFxyXFxcXG4nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgY29udGVudCA9ICdcXHJcXG5jb25zb2xlLmxvZyhcXCd4XFwnKTtcXHJcXG5cXHJcXG5jb25zb2xlLmxvZyhcXCc3XFwnKTtcXHJcXG4nO1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgZ2V0TW9kZWxBbmRQcmVwVHJlZShjb250ZW50KTtcblx0XHRjb25zdCB0b2tlbnMgPSB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydC5nZXRUb2tlbnNJblJhbmdlKG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgNSwgMSksIDAsIDQyKTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCAyMSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnNDb250ZW50U2l6ZSh0b2tlbnMpLCBjb250ZW50Lmxlbmd0aCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChtb2RlbC51cmkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIHdpdGggbm9uLWVtcHR5IGxpbmVzIHRoYXQgbWF0Y2ggbm8gc2NvcGVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBgY29uc29sZS5sb2coJ3gnKTtcbjtcbntcbn1cbmA7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCA1LCAxKSwgMCwgMjQpO1xuXHRcdHZlcmlmeVRva2Vucyh0b2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zPy5sZW5ndGgsIDE2KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgd2l0aCBub24tZW1wdHkgbGluZXMgdGhhdCBtYXRjaCBubyBzY29wZXMgXFxcXHJcXFxcbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gJ2NvbnNvbGUubG9nKFxcJ3hcXCcpO1xcclxcbjtcXHJcXG57XFxyXFxufVxcclxcbic7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCA1LCAxKSwgMCwgMjgpO1xuXHRcdHZlcmlmeVRva2Vucyh0b2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zPy5sZW5ndGgsIDE2KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgd2l0aCB0cmVlLXNpdHRlciB0b2tlbiB0aGF0IHNwYW5zIG11bHRpcGxlIGxpbmVzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBgLyoqXG4qKi9cblxuY29uc29sZS5sb2coJ3gnKTtcblxuYDtcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IGdldE1vZGVsQW5kUHJlcFRyZWUoY29udGVudCk7XG5cdFx0Y29uc3QgdG9rZW5zID0gdHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQuZ2V0VG9rZW5zSW5SYW5nZShtb2RlbCwgbmV3IFJhbmdlKDEsIDEsIDYsIDEpLCAwLCAyOCk7XG5cdFx0dmVyaWZ5VG9rZW5zKHRva2Vucyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnM/Lmxlbmd0aCwgMTIpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zQ29udGVudFNpemUodG9rZW5zKSwgY29udGVudC5sZW5ndGgpO1xuXHRcdG1vZGVsU2VydmljZS5kZXN0cm95TW9kZWwobW9kZWwudXJpKTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZSB3aXRoIHRyZWUtc2l0dGVyIHRva2VuIHRoYXQgc3BhbnMgbXVsdGlwbGUgbGluZXMgXFxcXHJcXFxcbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gJy8qKlxcclxcbioqL1xcclxcblxcclxcbmNvbnNvbGUubG9nKFxcJ3hcXCcpO1xcclxcblxcclxcbic7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCA2LCAxKSwgMCwgMzMpO1xuXHRcdHZlcmlmeVRva2Vucyh0b2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zPy5sZW5ndGgsIDEyKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZpbGUgd2l0aCB0YWJzJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSBgZnVuY3Rpb24geCgpIHtcblx0cmV0dXJuIHRydWU7XG59XG5cbmNsYXNzIFkge1xuXHRwcml2YXRlIHogPSBmYWxzZTtcbn1gO1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgZ2V0TW9kZWxBbmRQcmVwVHJlZShjb250ZW50KTtcblx0XHRjb25zdCB0b2tlbnMgPSB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydC5nZXRUb2tlbnNJblJhbmdlKG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgNywgMSksIDAsIDYzKTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCAzMCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnNDb250ZW50U2l6ZSh0b2tlbnMpLCBjb250ZW50Lmxlbmd0aCk7XG5cdFx0bW9kZWxTZXJ2aWNlLmRlc3Ryb3lNb2RlbChtb2RlbC51cmkpO1xuXHR9KTtcblxuXHR0ZXN0KCdGaWxlIHdpdGggdGFicyBcXFxcclxcXFxuJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGNvbnRlbnQgPSAnZnVuY3Rpb24geCgpIHtcXHJcXG5cXHRyZXR1cm4gdHJ1ZTtcXHJcXG59XFxyXFxuXFxyXFxuY2xhc3MgWSB7XFxyXFxuXFx0cHJpdmF0ZSB6ID0gZmFsc2U7XFxyXFxufSc7XG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCBnZXRNb2RlbEFuZFByZXBUcmVlKGNvbnRlbnQpO1xuXHRcdGNvbnN0IHRva2VucyA9IHRyZWVTaXR0ZXJUb2tlbml6YXRpb25TdXBwb3J0LmdldFRva2Vuc0luUmFuZ2UobW9kZWwsIG5ldyBSYW5nZSgxLCAxLCA3LCAxKSwgMCwgNjkpO1xuXHRcdHZlcmlmeVRva2Vucyh0b2tlbnMpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zPy5sZW5ndGgsIDMwKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1RlbXBsYXRlIHN0cmluZycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gJ2B0ICR7Nn1gJztcblx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IGdldE1vZGVsQW5kUHJlcFRyZWUoY29udGVudCk7XG5cdFx0Y29uc3QgdG9rZW5zID0gdHJlZVNpdHRlclRva2VuaXphdGlvblN1cHBvcnQuZ2V0VG9rZW5zSW5SYW5nZShtb2RlbCwgbmV3IFJhbmdlKDEsIDEsIDEsIDgpLCAwLCA4KTtcblx0XHR2ZXJpZnlUb2tlbnModG9rZW5zKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vucz8ubGVuZ3RoLCA2KTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHRva2Vuc0NvbnRlbnRTaXplKHRva2VucyksIGNvbnRlbnQubGVuZ3RoKTtcblx0XHRtb2RlbFNlcnZpY2UuZGVzdHJveU1vZGVsKG1vZGVsLnVyaSk7XG5cdH0pO1xuXG5cdHRlc3QoJ01hbnkgbmVzdGVkIHNjb3BlcycsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBjb250ZW50ID0gYHkgPSBuZXcgeCh0dHQoe1xuXHRtZXNzYWdlOiAnezB9IGlcXFxcblxcXFxuIFtjb21tYW5kTmFtZV0oezF9KS4nLFxuXHRhcmdzOiBbJ1Rlc3QnLCBcXGBjb21tYW5kOlxcJHtvcGVuU2V0dGluZ3NDb21tYW5kfT9cXCR7ZW5jb2RlVVJJQ29tcG9uZW50KCdbXCJTZXR0aW5nTmFtZVwiXScpfVxcYF0sXG5cdC8vIFRvIG1ha2Ugc3VyZSB0aGUgdHJhbnNsYXRvcnMgZG9uJ3QgYnJlYWsgdGhlIGxpbmtcblx0Y29tbWVudDogW1wie0xvY2tlZD0nXSh7J31cIl1cbn0pKTtgO1xuXHRcdGNvbnN0IG1vZGVsID0gYXdhaXQgZ2V0TW9kZWxBbmRQcmVwVHJlZShjb250ZW50KTtcblx0XHRjb25zdCB0b2tlbnMgPSB0cmVlU2l0dGVyVG9rZW5pemF0aW9uU3VwcG9ydC5nZXRUb2tlbnNJblJhbmdlKG1vZGVsLCBuZXcgUmFuZ2UoMSwgMSwgNiwgNSksIDAsIDIzOCk7XG5cdFx0dmVyaWZ5VG9rZW5zKHRva2Vucyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbCh0b2tlbnM/Lmxlbmd0aCwgNjUpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodG9rZW5zQ29udGVudFNpemUodG9rZW5zKSwgY29udGVudC5sZW5ndGgpO1xuXHRcdG1vZGVsU2VydmljZS5kZXN0cm95TW9kZWwobW9kZWwudXJpKTtcblx0fSk7XG5cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsK0NBQStDO0FBQ3hELFNBQVMsa0NBQWtDO0FBQzNDLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsYUFBYTtBQUN0QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxhQUFhLHNCQUFzQjtBQUM1QyxTQUF5QixtQkFB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
