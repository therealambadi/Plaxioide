var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { canASAR, importAMDNodeModule, resolveAmdNodeModulePath } from "../../../../amdX.js";
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import { equals as equalArray } from "../../../../base/common/arrays.js";
import { Color } from "../../../../base/common/color.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { FileAccess, nodeModulesAsarUnpackedPath, nodeModulesPath } from "../../../../base/common/network.js";
import { observableFromEvent } from "../../../../base/common/observable.js";
import { isWeb } from "../../../../base/common/platform.js";
import * as resources from "../../../../base/common/resources.js";
import * as types from "../../../../base/common/types.js";
import { StandardTokenType } from "../../../../editor/common/encodedTokenAttributes.js";
import { LazyTokenizationSupport, TokenizationRegistry } from "../../../../editor/common/languages.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import { generateTokensCSSForColorMap } from "../../../../editor/common/languages/supports/tokenization.js";
import * as nls from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IExtensionResourceLoaderService } from "../../../../platform/extensionResourceLoader/common/extensionResourceLoader.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IProgressService, ProgressLocation } from "../../../../platform/progress/common/progress.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkbenchEnvironmentService } from "../../environment/common/environmentService.js";
import { TextMateTokenizationSupport } from "./tokenizationSupport/textMateTokenizationSupport.js";
import { TokenizationSupportWithLineLimit } from "./tokenizationSupport/tokenizationSupportWithLineLimit.js";
import { ThreadedBackgroundTokenizerFactory } from "./backgroundTokenization/threadedBackgroundTokenizerFactory.js";
import { TMGrammarFactory, missingTMGrammarErrorMessage } from "../common/TMGrammarFactory.js";
import { grammarsExtPoint } from "../common/TMGrammars.js";
import { IWorkbenchThemeService } from "../../themes/common/workbenchThemeService.js";
let TextMateTokenizationFeature = class extends Disposable {
  constructor(_languageService, _themeService, _extensionResourceLoaderService, _notificationService, _logService, _configurationService, _progressService, _environmentService, _instantiationService, _telemetryService) {
    super();
    this._languageService = _languageService;
    this._themeService = _themeService;
    this._extensionResourceLoaderService = _extensionResourceLoaderService;
    this._notificationService = _notificationService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._progressService = _progressService;
    this._environmentService = _environmentService;
    this._instantiationService = _instantiationService;
    this._telemetryService = _telemetryService;
    this._createdModes = [];
    this._encounteredLanguages = [];
    this._debugMode = false;
    this._debugModePrintFunc = () => {
    };
    this._grammarDefinitions = null;
    this._grammarFactory = null;
    this._tokenizersRegistrations = this._register(new DisposableStore());
    this._currentTheme = null;
    this._currentTokenColorMap = null;
    this._threadedBackgroundTokenizerFactory = this._instantiationService.createInstance(
      ThreadedBackgroundTokenizerFactory,
      (timeMs, languageId, sourceExtensionId, lineLength, isRandomSample) => this._reportTokenizationTime(timeMs, languageId, sourceExtensionId, lineLength, true, isRandomSample),
      () => this.getAsyncTokenizationEnabled()
    );
    this._vscodeOniguruma = null;
    this._styleElement = domStylesheets.createStyleSheet();
    this._styleElement.className = "vscode-tokens-styles";
    grammarsExtPoint.setHandler((extensions) => this._handleGrammarsExtPoint(extensions));
    this._updateTheme(this._themeService.getColorTheme(), true);
    this._register(this._themeService.onDidColorThemeChange(() => {
      this._updateTheme(this._themeService.getColorTheme(), false);
    }));
    this._register(this._languageService.onDidRequestRichLanguageFeatures((languageId) => {
      this._createdModes.push(languageId);
    }));
  }
  getAsyncTokenizationEnabled() {
    return !!this._configurationService.getValue("editor.experimental.asyncTokenization");
  }
  getAsyncTokenizationVerification() {
    return !!this._configurationService.getValue("editor.experimental.asyncTokenizationVerification");
  }
  _handleGrammarsExtPoint(extensions) {
    this._grammarDefinitions = null;
    if (this._grammarFactory) {
      this._grammarFactory.dispose();
      this._grammarFactory = null;
    }
    this._tokenizersRegistrations.clear();
    this._grammarDefinitions = [];
    for (const extension of extensions) {
      const grammars = extension.value;
      for (const grammar of grammars) {
        const validatedGrammar = this._validateGrammarDefinition(extension, grammar);
        if (validatedGrammar) {
          this._grammarDefinitions.push(validatedGrammar);
          if (validatedGrammar.language) {
            const lazyTokenizationSupport = new LazyTokenizationSupport(() => this._createTokenizationSupport(validatedGrammar.language));
            this._tokenizersRegistrations.add(lazyTokenizationSupport);
            this._tokenizersRegistrations.add(TokenizationRegistry.registerFactory(validatedGrammar.language, lazyTokenizationSupport));
          }
        }
      }
    }
    this._threadedBackgroundTokenizerFactory.setGrammarDefinitions(this._grammarDefinitions);
    for (const createdMode of this._createdModes) {
      TokenizationRegistry.getOrCreate(createdMode);
    }
  }
  _validateGrammarDefinition(extension, grammar) {
    if (!validateGrammarExtensionPoint(extension.description.extensionLocation, grammar, extension.collector, this._languageService)) {
      return null;
    }
    const grammarLocation = resources.joinPath(extension.description.extensionLocation, grammar.path);
    const embeddedLanguages = /* @__PURE__ */ Object.create(null);
    if (grammar.embeddedLanguages) {
      const scopes = Object.keys(grammar.embeddedLanguages);
      for (let i = 0, len = scopes.length; i < len; i++) {
        const scope = scopes[i];
        const language = grammar.embeddedLanguages[scope];
        if (typeof language !== "string") {
          continue;
        }
        if (this._languageService.isRegisteredLanguageId(language)) {
          embeddedLanguages[scope] = this._languageService.languageIdCodec.encodeLanguageId(language);
        }
      }
    }
    const tokenTypes = /* @__PURE__ */ Object.create(null);
    if (grammar.tokenTypes) {
      const scopes = Object.keys(grammar.tokenTypes);
      for (const scope of scopes) {
        const tokenType = grammar.tokenTypes[scope];
        switch (tokenType) {
          case "string":
            tokenTypes[scope] = StandardTokenType.String;
            break;
          case "other":
            tokenTypes[scope] = StandardTokenType.Other;
            break;
          case "comment":
            tokenTypes[scope] = StandardTokenType.Comment;
            break;
        }
      }
    }
    const validLanguageId = grammar.language && this._languageService.isRegisteredLanguageId(grammar.language) ? grammar.language : void 0;
    function asStringArray(array, defaultValue) {
      if (!Array.isArray(array)) {
        return defaultValue;
      }
      if (!array.every((e) => typeof e === "string")) {
        return defaultValue;
      }
      return array;
    }
    return {
      location: grammarLocation,
      language: validLanguageId,
      scopeName: grammar.scopeName,
      embeddedLanguages,
      tokenTypes,
      injectTo: grammar.injectTo,
      balancedBracketSelectors: asStringArray(grammar.balancedBracketScopes, ["*"]),
      unbalancedBracketSelectors: asStringArray(grammar.unbalancedBracketScopes, []),
      sourceExtensionId: extension.description.id
    };
  }
  startDebugMode(printFn, onStop) {
    if (this._debugMode) {
      this._notificationService.error(nls.localize("alreadyDebugging", "Already Logging."));
      return;
    }
    this._debugModePrintFunc = printFn;
    this._debugMode = true;
    if (this._debugMode) {
      this._progressService.withProgress(
        {
          location: ProgressLocation.Notification,
          buttons: [nls.localize("stop", "Stop")]
        },
        (progress) => {
          progress.report({
            message: nls.localize("progress1", "Preparing to log TM Grammar parsing. Press Stop when finished.")
          });
          return this._getVSCodeOniguruma().then((vscodeOniguruma) => {
            vscodeOniguruma.setDefaultDebugCall(true);
            progress.report({
              message: nls.localize("progress2", "Now logging TM Grammar parsing. Press Stop when finished.")
            });
            return new Promise((resolve, reject) => {
            });
          });
        },
        (choice) => {
          this._getVSCodeOniguruma().then((vscodeOniguruma) => {
            this._debugModePrintFunc = () => {
            };
            this._debugMode = false;
            vscodeOniguruma.setDefaultDebugCall(false);
            onStop();
          });
        }
      );
    }
  }
  _canCreateGrammarFactory() {
    return !!this._grammarDefinitions;
  }
  async _getOrCreateGrammarFactory() {
    if (this._grammarFactory) {
      return this._grammarFactory;
    }
    const [vscodeTextmate, vscodeOniguruma] = await Promise.all([importAMDNodeModule("vscode-textmate", "release/main.js"), this._getVSCodeOniguruma()]);
    const onigLib = Promise.resolve({
      createOnigScanner: (sources) => vscodeOniguruma.createOnigScanner(sources),
      createOnigString: (str) => vscodeOniguruma.createOnigString(str)
    });
    if (this._grammarFactory) {
      return this._grammarFactory;
    }
    this._grammarFactory = new TMGrammarFactory({
      logTrace: (msg) => this._logService.trace(msg),
      logError: (msg, err) => this._logService.error(msg, err),
      readFile: (resource) => this._extensionResourceLoaderService.readExtensionResource(resource)
    }, this._grammarDefinitions || [], vscodeTextmate, onigLib);
    this._updateTheme(this._themeService.getColorTheme(), true);
    return this._grammarFactory;
  }
  async _createTokenizationSupport(languageId) {
    if (!this._languageService.isRegisteredLanguageId(languageId)) {
      return null;
    }
    if (!this._canCreateGrammarFactory()) {
      return null;
    }
    try {
      const grammarFactory = await this._getOrCreateGrammarFactory();
      if (!grammarFactory.has(languageId)) {
        return null;
      }
      const encodedLanguageId = this._languageService.languageIdCodec.encodeLanguageId(languageId);
      const r = await grammarFactory.createGrammar(languageId, encodedLanguageId);
      if (!r.grammar) {
        return null;
      }
      const maxTokenizationLineLength = observableConfigValue(
        "editor.maxTokenizationLineLength",
        languageId,
        -1,
        this._configurationService
      );
      const store = new DisposableStore();
      const tokenization = store.add(new TextMateTokenizationSupport(
        r.grammar,
        r.initialState,
        r.containsEmbeddedLanguages,
        (textModel, tokenStore) => this._threadedBackgroundTokenizerFactory.createBackgroundTokenizer(textModel, tokenStore, maxTokenizationLineLength),
        () => this.getAsyncTokenizationVerification(),
        (timeMs, lineLength, isRandomSample) => {
          this._reportTokenizationTime(timeMs, languageId, r.sourceExtensionId, lineLength, false, isRandomSample);
        },
        true
      ));
      store.add(tokenization.onDidEncounterLanguage((encodedLanguageId2) => {
        if (!this._encounteredLanguages[encodedLanguageId2]) {
          const languageId2 = this._languageService.languageIdCodec.decodeLanguageId(encodedLanguageId2);
          this._encounteredLanguages[encodedLanguageId2] = true;
          this._languageService.requestBasicLanguageFeatures(languageId2);
        }
      }));
      return new TokenizationSupportWithLineLimit(encodedLanguageId, tokenization, store, maxTokenizationLineLength);
    } catch (err) {
      if (err.message && err.message === missingTMGrammarErrorMessage) {
        return null;
      }
      onUnexpectedError(err);
      return null;
    }
  }
  _updateTheme(colorTheme, forceUpdate) {
    if (!forceUpdate && this._currentTheme && this._currentTokenColorMap && equalsTokenRules(this._currentTheme.settings, colorTheme.tokenColors) && equalArray(this._currentTokenColorMap, colorTheme.tokenColorMap)) {
      return;
    }
    this._currentTheme = { name: colorTheme.label, settings: colorTheme.tokenColors };
    this._currentTokenColorMap = colorTheme.tokenColorMap;
    this._grammarFactory?.setTheme(this._currentTheme, this._currentTokenColorMap);
    const colorMap = toColorMap(this._currentTokenColorMap);
    const cssRules = generateTokensCSSForColorMap(colorMap);
    this._styleElement.textContent = cssRules;
    TokenizationRegistry.setColorMap(colorMap);
    if (this._currentTheme && this._currentTokenColorMap) {
      this._threadedBackgroundTokenizerFactory.acceptTheme(this._currentTheme, this._currentTokenColorMap);
    }
  }
  async createTokenizer(languageId) {
    if (!this._languageService.isRegisteredLanguageId(languageId)) {
      return null;
    }
    const grammarFactory = await this._getOrCreateGrammarFactory();
    if (!grammarFactory.has(languageId)) {
      return null;
    }
    const encodedLanguageId = this._languageService.languageIdCodec.encodeLanguageId(languageId);
    const { grammar } = await grammarFactory.createGrammar(languageId, encodedLanguageId);
    return grammar;
  }
  _getVSCodeOniguruma() {
    if (!this._vscodeOniguruma) {
      this._vscodeOniguruma = (async () => {
        const [vscodeOniguruma, wasm] = await Promise.all([importAMDNodeModule("vscode-oniguruma", "release/main.js"), this._loadVSCodeOnigurumaWASM()]);
        await vscodeOniguruma.loadWASM({
          data: wasm,
          print: (str) => {
            this._debugModePrintFunc(str);
          }
        });
        return vscodeOniguruma;
      })();
    }
    return this._vscodeOniguruma;
  }
  async _loadVSCodeOnigurumaWASM() {
    if (isWeb) {
      const response = await fetch(resolveAmdNodeModulePath("vscode-oniguruma", "release/onig.wasm"));
      return await response.arrayBuffer();
    } else {
      const response = await fetch(canASAR && this._environmentService.isBuilt ? FileAccess.asBrowserUri(`${nodeModulesAsarUnpackedPath}/vscode-oniguruma/release/onig.wasm`).toString(true) : FileAccess.asBrowserUri(`${nodeModulesPath}/vscode-oniguruma/release/onig.wasm`).toString(true));
      return response;
    }
  }
  _reportTokenizationTime(timeMs, languageId, sourceExtensionId, lineLength, fromWorker, isRandomSample) {
    const key = fromWorker ? "async" : "sync";
    if (TextMateTokenizationFeature.reportTokenizationTimeCounter[key] > 50) {
      return;
    }
    if (TextMateTokenizationFeature.reportTokenizationTimeCounter[key] === 0) {
      setTimeout(() => {
        TextMateTokenizationFeature.reportTokenizationTimeCounter[key] = 0;
      }, 1e3 * 60 * 60);
    }
    TextMateTokenizationFeature.reportTokenizationTimeCounter[key]++;
    this._telemetryService.publicLog2("editor.tokenizedLine", {
      timeMs,
      languageId,
      lineLength,
      fromWorker,
      sourceExtensionId,
      isRandomSample,
      tokenizationSetting: this.getAsyncTokenizationEnabled() ? this.getAsyncTokenizationVerification() ? 2 : 1 : 0
    });
  }
};
TextMateTokenizationFeature.reportTokenizationTimeCounter = { sync: 0, async: 0 };
TextMateTokenizationFeature = __decorateClass([
  __decorateParam(0, ILanguageService),
  __decorateParam(1, IWorkbenchThemeService),
  __decorateParam(2, IExtensionResourceLoaderService),
  __decorateParam(3, INotificationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IConfigurationService),
  __decorateParam(6, IProgressService),
  __decorateParam(7, IWorkbenchEnvironmentService),
  __decorateParam(8, IInstantiationService),
  __decorateParam(9, ITelemetryService)
], TextMateTokenizationFeature);
function toColorMap(colorMap) {
  const result = [null];
  for (let i = 1, len = colorMap.length; i < len; i++) {
    result[i] = Color.fromHex(colorMap[i]);
  }
  return result;
}
function equalsTokenRules(a, b) {
  if (!b || !a || b.length !== a.length) {
    return false;
  }
  for (let i = b.length - 1; i >= 0; i--) {
    const r1 = b[i];
    const r2 = a[i];
    if (r1.scope !== r2.scope) {
      return false;
    }
    const s1 = r1.settings;
    const s2 = r2.settings;
    if (s1 && s2) {
      if (s1.fontStyle !== s2.fontStyle || s1.foreground !== s2.foreground || s1.background !== s2.background) {
        return false;
      }
    } else if (!s1 || !s2) {
      return false;
    }
  }
  return true;
}
function validateGrammarExtensionPoint(extensionLocation, syntax, collector, _languageService) {
  if (syntax.language && (typeof syntax.language !== "string" || !_languageService.isRegisteredLanguageId(syntax.language))) {
    collector.error(nls.localize("invalid.language", "Unknown language in `contributes.{0}.language`. Provided value: {1}", grammarsExtPoint.name, String(syntax.language)));
    return false;
  }
  if (!syntax.scopeName || typeof syntax.scopeName !== "string") {
    collector.error(nls.localize("invalid.scopeName", "Expected string in `contributes.{0}.scopeName`. Provided value: {1}", grammarsExtPoint.name, String(syntax.scopeName)));
    return false;
  }
  if (!syntax.path || typeof syntax.path !== "string") {
    collector.error(nls.localize("invalid.path.0", "Expected string in `contributes.{0}.path`. Provided value: {1}", grammarsExtPoint.name, String(syntax.path)));
    return false;
  }
  if (syntax.injectTo && (!Array.isArray(syntax.injectTo) || syntax.injectTo.some((scope) => typeof scope !== "string"))) {
    collector.error(nls.localize("invalid.injectTo", "Invalid value in `contributes.{0}.injectTo`. Must be an array of language scope names. Provided value: {1}", grammarsExtPoint.name, JSON.stringify(syntax.injectTo)));
    return false;
  }
  if (syntax.embeddedLanguages && !types.isObject(syntax.embeddedLanguages)) {
    collector.error(nls.localize("invalid.embeddedLanguages", "Invalid value in `contributes.{0}.embeddedLanguages`. Must be an object map from scope name to language. Provided value: {1}", grammarsExtPoint.name, JSON.stringify(syntax.embeddedLanguages)));
    return false;
  }
  if (syntax.tokenTypes && !types.isObject(syntax.tokenTypes)) {
    collector.error(nls.localize("invalid.tokenTypes", "Invalid value in `contributes.{0}.tokenTypes`. Must be an object map from scope name to token type. Provided value: {1}", grammarsExtPoint.name, JSON.stringify(syntax.tokenTypes)));
    return false;
  }
  const grammarLocation = resources.joinPath(extensionLocation, syntax.path);
  if (!resources.isEqualOrParent(grammarLocation, extensionLocation)) {
    collector.warn(nls.localize("invalid.path.1", "Expected `contributes.{0}.path` ({1}) to be included inside extension's folder ({2}). This might make the extension non-portable.", grammarsExtPoint.name, grammarLocation.path, extensionLocation.path));
  }
  return true;
}
function observableConfigValue(key, languageId, defaultValue, configurationService) {
  return observableFromEvent(
    (handleChange) => configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(key, { overrideIdentifier: languageId })) {
        handleChange(e);
      }
    }),
    () => configurationService.getValue(key, { overrideIdentifier: languageId }) ?? defaultValue
  );
}
export {
  TextMateTokenizationFeature
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvYnJvd3Nlci90ZXh0TWF0ZVRva2VuaXphdGlvbkZlYXR1cmVJbXBsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY2FuQVNBUiwgaW1wb3J0QU1ETm9kZU1vZHVsZSwgcmVzb2x2ZUFtZE5vZGVNb2R1bGVQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYW1kWC5qcyc7XG5pbXBvcnQgKiBhcyBkb21TdHlsZXNoZWV0cyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvZG9tU3R5bGVzaGVldHMuanMnO1xuaW1wb3J0IHsgZXF1YWxzIGFzIGVxdWFsQXJyYXkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgQ29sb3IgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xvci5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MsIG5vZGVNb2R1bGVzQXNhclVucGFja2VkUGF0aCwgbm9kZU1vZHVsZXNQYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCAqIGFzIHR5cGVzIGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3R5cGVzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBTdGFuZGFyZFRva2VuVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vZW5jb2RlZFRva2VuQXR0cmlidXRlcy5qcyc7XG5pbXBvcnQgeyBJVG9rZW5pemF0aW9uU3VwcG9ydCwgTGF6eVRva2VuaXphdGlvblN1cHBvcnQsIFRva2VuaXphdGlvblJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVG9rZW5zQ1NTRm9yQ29sb3JNYXAgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9zdXBwb3J0cy90b2tlbml6YXRpb24uanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25SZXNvdXJjZUxvYWRlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25SZXNvdXJjZUxvYWRlci9jb21tb24vZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXIuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVByb2dyZXNzU2VydmljZSwgUHJvZ3Jlc3NMb2NhdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbk1lc3NhZ2VDb2xsZWN0b3IsIElFeHRlbnNpb25Qb2ludFVzZXIgfSBmcm9tICcuLi8uLi9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRleHRNYXRlVG9rZW5pemF0aW9uU2VydmljZSB9IGZyb20gJy4vdGV4dE1hdGVUb2tlbml6YXRpb25GZWF0dXJlLmpzJztcbmltcG9ydCB7IFRleHRNYXRlVG9rZW5pemF0aW9uU3VwcG9ydCB9IGZyb20gJy4vdG9rZW5pemF0aW9uU3VwcG9ydC90ZXh0TWF0ZVRva2VuaXphdGlvblN1cHBvcnQuanMnO1xuaW1wb3J0IHsgVG9rZW5pemF0aW9uU3VwcG9ydFdpdGhMaW5lTGltaXQgfSBmcm9tICcuL3Rva2VuaXphdGlvblN1cHBvcnQvdG9rZW5pemF0aW9uU3VwcG9ydFdpdGhMaW5lTGltaXQuanMnO1xuaW1wb3J0IHsgVGhyZWFkZWRCYWNrZ3JvdW5kVG9rZW5pemVyRmFjdG9yeSB9IGZyb20gJy4vYmFja2dyb3VuZFRva2VuaXphdGlvbi90aHJlYWRlZEJhY2tncm91bmRUb2tlbml6ZXJGYWN0b3J5LmpzJztcbmltcG9ydCB7IFRNR3JhbW1hckZhY3RvcnksIG1pc3NpbmdUTUdyYW1tYXJFcnJvck1lc3NhZ2UgfSBmcm9tICcuLi9jb21tb24vVE1HcmFtbWFyRmFjdG9yeS5qcyc7XG5pbXBvcnQgeyBJVE1TeW50YXhFeHRlbnNpb25Qb2ludCwgZ3JhbW1hcnNFeHRQb2ludCB9IGZyb20gJy4uL2NvbW1vbi9UTUdyYW1tYXJzLmpzJztcbmltcG9ydCB7IElWYWxpZEVtYmVkZGVkTGFuZ3VhZ2VzTWFwLCBJVmFsaWRHcmFtbWFyRGVmaW5pdGlvbiwgSVZhbGlkVG9rZW5UeXBlTWFwIH0gZnJvbSAnLi4vY29tbW9uL1RNU2NvcGVSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1hdGVUaGVtaW5nUnVsZSwgSVdvcmtiZW5jaENvbG9yVGhlbWUsIElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgfSBmcm9tICcuLi8uLi90aGVtZXMvY29tbW9uL3dvcmtiZW5jaFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgdHlwZSB7IElHcmFtbWFyLCBJT25pZ0xpYiwgSVJhd1RoZW1lIH0gZnJvbSAndnNjb2RlLXRleHRtYXRlJztcblxuZXhwb3J0IGNsYXNzIFRleHRNYXRlVG9rZW5pemF0aW9uRmVhdHVyZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVGV4dE1hdGVUb2tlbml6YXRpb25TZXJ2aWNlIHtcblx0cHJpdmF0ZSBzdGF0aWMgcmVwb3J0VG9rZW5pemF0aW9uVGltZUNvdW50ZXIgPSB7IHN5bmM6IDAsIGFzeW5jOiAwIH07XG5cdHB1YmxpYyBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc3R5bGVFbGVtZW50OiBIVE1MU3R5bGVFbGVtZW50O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jcmVhdGVkTW9kZXM6IHN0cmluZ1tdID0gW107XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VuY291bnRlcmVkTGFuZ3VhZ2VzOiBib29sZWFuW10gPSBbXTtcblxuXHRwcml2YXRlIF9kZWJ1Z01vZGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHJpdmF0ZSBfZGVidWdNb2RlUHJpbnRGdW5jOiAoc3RyOiBzdHJpbmcpID0+IHZvaWQgPSAoKSA9PiB7IH07XG5cblx0cHJpdmF0ZSBfZ3JhbW1hckRlZmluaXRpb25zOiBJVmFsaWRHcmFtbWFyRGVmaW5pdGlvbltdIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2dyYW1tYXJGYWN0b3J5OiBUTUdyYW1tYXJGYWN0b3J5IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3Rva2VuaXplcnNSZWdpc3RyYXRpb25zID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0cHJpdmF0ZSBfY3VycmVudFRoZW1lOiBJUmF3VGhlbWUgfCBudWxsID0gbnVsbDtcblx0cHJpdmF0ZSBfY3VycmVudFRva2VuQ29sb3JNYXA6IHN0cmluZ1tdIHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3RocmVhZGVkQmFja2dyb3VuZFRva2VuaXplckZhY3RvcnkgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRUaHJlYWRlZEJhY2tncm91bmRUb2tlbml6ZXJGYWN0b3J5LFxuXHRcdCh0aW1lTXMsIGxhbmd1YWdlSWQsIHNvdXJjZUV4dGVuc2lvbklkLCBsaW5lTGVuZ3RoLCBpc1JhbmRvbVNhbXBsZSkgPT4gdGhpcy5fcmVwb3J0VG9rZW5pemF0aW9uVGltZSh0aW1lTXMsIGxhbmd1YWdlSWQsIHNvdXJjZUV4dGVuc2lvbklkLCBsaW5lTGVuZ3RoLCB0cnVlLCBpc1JhbmRvbVNhbXBsZSksXG5cdFx0KCkgPT4gdGhpcy5nZXRBc3luY1Rva2VuaXphdGlvbkVuYWJsZWQoKSxcblx0KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hUaGVtZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGhlbWVTZXJ2aWNlOiBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZTogSUV4dGVuc2lvblJlc291cmNlTG9hZGVyU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASVByb2dyZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9ncmVzc1NlcnZpY2U6IElQcm9ncmVzc1NlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9zdHlsZUVsZW1lbnQgPSBkb21TdHlsZXNoZWV0cy5jcmVhdGVTdHlsZVNoZWV0KCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50LmNsYXNzTmFtZSA9ICd2c2NvZGUtdG9rZW5zLXN0eWxlcyc7XG5cblx0XHRncmFtbWFyc0V4dFBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMpID0+IHRoaXMuX2hhbmRsZUdyYW1tYXJzRXh0UG9pbnQoZXh0ZW5zaW9ucykpO1xuXG5cdFx0dGhpcy5fdXBkYXRlVGhlbWUodGhpcy5fdGhlbWVTZXJ2aWNlLmdldENvbG9yVGhlbWUoKSwgdHJ1ZSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fdGhlbWVTZXJ2aWNlLm9uRGlkQ29sb3JUaGVtZUNoYW5nZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl91cGRhdGVUaGVtZSh0aGlzLl90aGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLCBmYWxzZSk7XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLm9uRGlkUmVxdWVzdFJpY2hMYW5ndWFnZUZlYXR1cmVzKChsYW5ndWFnZUlkKSA9PiB7XG5cdFx0XHR0aGlzLl9jcmVhdGVkTW9kZXMucHVzaChsYW5ndWFnZUlkKTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGdldEFzeW5jVG9rZW5pemF0aW9uRW5hYmxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRBc3luY1Rva2VuaXphdGlvblZlcmlmaWNhdGlvbigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISF0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxib29sZWFuPignZWRpdG9yLmV4cGVyaW1lbnRhbC5hc3luY1Rva2VuaXphdGlvblZlcmlmaWNhdGlvbicpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlR3JhbW1hcnNFeHRQb2ludChleHRlbnNpb25zOiByZWFkb25seSBJRXh0ZW5zaW9uUG9pbnRVc2VyPElUTVN5bnRheEV4dGVuc2lvblBvaW50W10+W10pOiB2b2lkIHtcblx0XHR0aGlzLl9ncmFtbWFyRGVmaW5pdGlvbnMgPSBudWxsO1xuXHRcdGlmICh0aGlzLl9ncmFtbWFyRmFjdG9yeSkge1xuXHRcdFx0dGhpcy5fZ3JhbW1hckZhY3RvcnkuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fZ3JhbW1hckZhY3RvcnkgPSBudWxsO1xuXHRcdH1cblx0XHR0aGlzLl90b2tlbml6ZXJzUmVnaXN0cmF0aW9ucy5jbGVhcigpO1xuXG5cdFx0dGhpcy5fZ3JhbW1hckRlZmluaXRpb25zID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZXh0ZW5zaW9ucykge1xuXHRcdFx0Y29uc3QgZ3JhbW1hcnMgPSBleHRlbnNpb24udmFsdWU7XG5cdFx0XHRmb3IgKGNvbnN0IGdyYW1tYXIgb2YgZ3JhbW1hcnMpIHtcblx0XHRcdFx0Y29uc3QgdmFsaWRhdGVkR3JhbW1hciA9IHRoaXMuX3ZhbGlkYXRlR3JhbW1hckRlZmluaXRpb24oZXh0ZW5zaW9uLCBncmFtbWFyKTtcblx0XHRcdFx0aWYgKHZhbGlkYXRlZEdyYW1tYXIpIHtcblx0XHRcdFx0XHR0aGlzLl9ncmFtbWFyRGVmaW5pdGlvbnMucHVzaCh2YWxpZGF0ZWRHcmFtbWFyKTtcblx0XHRcdFx0XHRpZiAodmFsaWRhdGVkR3JhbW1hci5sYW5ndWFnZSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbGF6eVRva2VuaXphdGlvblN1cHBvcnQgPSBuZXcgTGF6eVRva2VuaXphdGlvblN1cHBvcnQoKCkgPT4gdGhpcy5fY3JlYXRlVG9rZW5pemF0aW9uU3VwcG9ydCh2YWxpZGF0ZWRHcmFtbWFyLmxhbmd1YWdlISkpO1xuXHRcdFx0XHRcdFx0dGhpcy5fdG9rZW5pemVyc1JlZ2lzdHJhdGlvbnMuYWRkKGxhenlUb2tlbml6YXRpb25TdXBwb3J0KTtcblx0XHRcdFx0XHRcdHRoaXMuX3Rva2VuaXplcnNSZWdpc3RyYXRpb25zLmFkZChUb2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlckZhY3RvcnkodmFsaWRhdGVkR3JhbW1hci5sYW5ndWFnZSwgbGF6eVRva2VuaXphdGlvblN1cHBvcnQpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHR0aGlzLl90aHJlYWRlZEJhY2tncm91bmRUb2tlbml6ZXJGYWN0b3J5LnNldEdyYW1tYXJEZWZpbml0aW9ucyh0aGlzLl9ncmFtbWFyRGVmaW5pdGlvbnMpO1xuXG5cdFx0Zm9yIChjb25zdCBjcmVhdGVkTW9kZSBvZiB0aGlzLl9jcmVhdGVkTW9kZXMpIHtcblx0XHRcdFRva2VuaXphdGlvblJlZ2lzdHJ5LmdldE9yQ3JlYXRlKGNyZWF0ZWRNb2RlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF92YWxpZGF0ZUdyYW1tYXJEZWZpbml0aW9uKGV4dGVuc2lvbjogSUV4dGVuc2lvblBvaW50VXNlcjxJVE1TeW50YXhFeHRlbnNpb25Qb2ludFtdPiwgZ3JhbW1hcjogSVRNU3ludGF4RXh0ZW5zaW9uUG9pbnQpOiBJVmFsaWRHcmFtbWFyRGVmaW5pdGlvbiB8IG51bGwge1xuXHRcdGlmICghdmFsaWRhdGVHcmFtbWFyRXh0ZW5zaW9uUG9pbnQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLCBncmFtbWFyLCBleHRlbnNpb24uY29sbGVjdG9yLCB0aGlzLl9sYW5ndWFnZVNlcnZpY2UpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cblx0XHRjb25zdCBncmFtbWFyTG9jYXRpb24gPSByZXNvdXJjZXMuam9pblBhdGgoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLCBncmFtbWFyLnBhdGgpO1xuXG5cdFx0Y29uc3QgZW1iZWRkZWRMYW5ndWFnZXM6IElWYWxpZEVtYmVkZGVkTGFuZ3VhZ2VzTWFwID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRpZiAoZ3JhbW1hci5lbWJlZGRlZExhbmd1YWdlcykge1xuXHRcdFx0Y29uc3Qgc2NvcGVzID0gT2JqZWN0LmtleXMoZ3JhbW1hci5lbWJlZGRlZExhbmd1YWdlcyk7XG5cdFx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gc2NvcGVzLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IHNjb3BlID0gc2NvcGVzW2ldO1xuXHRcdFx0XHRjb25zdCBsYW5ndWFnZSA9IGdyYW1tYXIuZW1iZWRkZWRMYW5ndWFnZXNbc2NvcGVdO1xuXHRcdFx0XHRpZiAodHlwZW9mIGxhbmd1YWdlICE9PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdC8vIG5ldmVyIGh1cnRzIHRvIGJlIHRvbyBjYXJlZnVsXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKHRoaXMuX2xhbmd1YWdlU2VydmljZS5pc1JlZ2lzdGVyZWRMYW5ndWFnZUlkKGxhbmd1YWdlKSkge1xuXHRcdFx0XHRcdGVtYmVkZGVkTGFuZ3VhZ2VzW3Njb3BlXSA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCB0b2tlblR5cGVzOiBJVmFsaWRUb2tlblR5cGVNYXAgPSBPYmplY3QuY3JlYXRlKG51bGwpO1xuXHRcdGlmIChncmFtbWFyLnRva2VuVHlwZXMpIHtcblx0XHRcdGNvbnN0IHNjb3BlcyA9IE9iamVjdC5rZXlzKGdyYW1tYXIudG9rZW5UeXBlcyk7XG5cdFx0XHRmb3IgKGNvbnN0IHNjb3BlIG9mIHNjb3Blcykge1xuXHRcdFx0XHRjb25zdCB0b2tlblR5cGUgPSBncmFtbWFyLnRva2VuVHlwZXNbc2NvcGVdO1xuXHRcdFx0XHRzd2l0Y2ggKHRva2VuVHlwZSkge1xuXHRcdFx0XHRcdGNhc2UgJ3N0cmluZyc6XG5cdFx0XHRcdFx0XHR0b2tlblR5cGVzW3Njb3BlXSA9IFN0YW5kYXJkVG9rZW5UeXBlLlN0cmluZztcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJ290aGVyJzpcblx0XHRcdFx0XHRcdHRva2VuVHlwZXNbc2NvcGVdID0gU3RhbmRhcmRUb2tlblR5cGUuT3RoZXI7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICdjb21tZW50Jzpcblx0XHRcdFx0XHRcdHRva2VuVHlwZXNbc2NvcGVdID0gU3RhbmRhcmRUb2tlblR5cGUuQ29tbWVudDtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgdmFsaWRMYW5ndWFnZUlkID0gZ3JhbW1hci5sYW5ndWFnZSAmJiB0aGlzLl9sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChncmFtbWFyLmxhbmd1YWdlKSA/IGdyYW1tYXIubGFuZ3VhZ2UgOiB1bmRlZmluZWQ7XG5cblx0XHRmdW5jdGlvbiBhc1N0cmluZ0FycmF5KGFycmF5OiB1bmtub3duLCBkZWZhdWx0VmFsdWU6IHN0cmluZ1tdKTogc3RyaW5nW10ge1xuXHRcdFx0aWYgKCFBcnJheS5pc0FycmF5KGFycmF5KSkge1xuXHRcdFx0XHRyZXR1cm4gZGVmYXVsdFZhbHVlO1xuXHRcdFx0fVxuXHRcdFx0aWYgKCFhcnJheS5ldmVyeShlID0+IHR5cGVvZiBlID09PSAnc3RyaW5nJykpIHtcblx0XHRcdFx0cmV0dXJuIGRlZmF1bHRWYWx1ZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBhcnJheTtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bG9jYXRpb246IGdyYW1tYXJMb2NhdGlvbixcblx0XHRcdGxhbmd1YWdlOiB2YWxpZExhbmd1YWdlSWQsXG5cdFx0XHRzY29wZU5hbWU6IGdyYW1tYXIuc2NvcGVOYW1lLFxuXHRcdFx0ZW1iZWRkZWRMYW5ndWFnZXM6IGVtYmVkZGVkTGFuZ3VhZ2VzLFxuXHRcdFx0dG9rZW5UeXBlczogdG9rZW5UeXBlcyxcblx0XHRcdGluamVjdFRvOiBncmFtbWFyLmluamVjdFRvLFxuXHRcdFx0YmFsYW5jZWRCcmFja2V0U2VsZWN0b3JzOiBhc1N0cmluZ0FycmF5KGdyYW1tYXIuYmFsYW5jZWRCcmFja2V0U2NvcGVzLCBbJyonXSksXG5cdFx0XHR1bmJhbGFuY2VkQnJhY2tldFNlbGVjdG9yczogYXNTdHJpbmdBcnJheShncmFtbWFyLnVuYmFsYW5jZWRCcmFja2V0U2NvcGVzLCBbXSksXG5cdFx0XHRzb3VyY2VFeHRlbnNpb25JZDogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkLFxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgc3RhcnREZWJ1Z01vZGUocHJpbnRGbjogKHN0cjogc3RyaW5nKSA9PiB2b2lkLCBvblN0b3A6ICgpID0+IHZvaWQpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fZGVidWdNb2RlKSB7XG5cdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKG5scy5sb2NhbGl6ZSgnYWxyZWFkeURlYnVnZ2luZycsIFwiQWxyZWFkeSBMb2dnaW5nLlwiKSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fZGVidWdNb2RlUHJpbnRGdW5jID0gcHJpbnRGbjtcblx0XHR0aGlzLl9kZWJ1Z01vZGUgPSB0cnVlO1xuXG5cdFx0aWYgKHRoaXMuX2RlYnVnTW9kZSkge1xuXHRcdFx0dGhpcy5fcHJvZ3Jlc3NTZXJ2aWNlLndpdGhQcm9ncmVzcyhcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxvY2F0aW9uOiBQcm9ncmVzc0xvY2F0aW9uLk5vdGlmaWNhdGlvbixcblx0XHRcdFx0XHRidXR0b25zOiBbbmxzLmxvY2FsaXplKCdzdG9wJywgXCJTdG9wXCIpXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHQocHJvZ3Jlc3MpID0+IHtcblx0XHRcdFx0XHRwcm9ncmVzcy5yZXBvcnQoe1xuXHRcdFx0XHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdwcm9ncmVzczEnLCBcIlByZXBhcmluZyB0byBsb2cgVE0gR3JhbW1hciBwYXJzaW5nLiBQcmVzcyBTdG9wIHdoZW4gZmluaXNoZWQuXCIpXG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fZ2V0VlNDb2RlT25pZ3VydW1hKCkudGhlbigodnNjb2RlT25pZ3VydW1hKSA9PiB7XG5cdFx0XHRcdFx0XHR2c2NvZGVPbmlndXJ1bWEuc2V0RGVmYXVsdERlYnVnQ2FsbCh0cnVlKTtcblx0XHRcdFx0XHRcdHByb2dyZXNzLnJlcG9ydCh7XG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgncHJvZ3Jlc3MyJywgXCJOb3cgbG9nZ2luZyBUTSBHcmFtbWFyIHBhcnNpbmcuIFByZXNzIFN0b3Agd2hlbiBmaW5pc2hlZC5cIilcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHsgfSk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdChjaG9pY2UpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9nZXRWU0NvZGVPbmlndXJ1bWEoKS50aGVuKCh2c2NvZGVPbmlndXJ1bWEpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX2RlYnVnTW9kZVByaW50RnVuYyA9ICgpID0+IHsgfTtcblx0XHRcdFx0XHRcdHRoaXMuX2RlYnVnTW9kZSA9IGZhbHNlO1xuXHRcdFx0XHRcdFx0dnNjb2RlT25pZ3VydW1hLnNldERlZmF1bHREZWJ1Z0NhbGwoZmFsc2UpO1xuXHRcdFx0XHRcdFx0b25TdG9wKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2FuQ3JlYXRlR3JhbW1hckZhY3RvcnkoKTogYm9vbGVhbiB7XG5cdFx0Ly8gQ2hlY2sgaWYgZXh0ZW5zaW9uIHBvaW50IGlzIHJlYWR5XG5cdFx0cmV0dXJuICEhdGhpcy5fZ3JhbW1hckRlZmluaXRpb25zO1xuXHR9XG5cdHByaXZhdGUgYXN5bmMgX2dldE9yQ3JlYXRlR3JhbW1hckZhY3RvcnkoKTogUHJvbWlzZTxUTUdyYW1tYXJGYWN0b3J5PiB7XG5cdFx0aWYgKHRoaXMuX2dyYW1tYXJGYWN0b3J5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZ3JhbW1hckZhY3Rvcnk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgW3ZzY29kZVRleHRtYXRlLCB2c2NvZGVPbmlndXJ1bWFdID0gYXdhaXQgUHJvbWlzZS5hbGwoW2ltcG9ydEFNRE5vZGVNb2R1bGU8dHlwZW9mIGltcG9ydCgndnNjb2RlLXRleHRtYXRlJyk+KCd2c2NvZGUtdGV4dG1hdGUnLCAncmVsZWFzZS9tYWluLmpzJyksIHRoaXMuX2dldFZTQ29kZU9uaWd1cnVtYSgpXSk7XG5cdFx0Y29uc3Qgb25pZ0xpYjogUHJvbWlzZTxJT25pZ0xpYj4gPSBQcm9taXNlLnJlc29sdmUoe1xuXHRcdFx0Y3JlYXRlT25pZ1NjYW5uZXI6IChzb3VyY2VzOiBzdHJpbmdbXSkgPT4gdnNjb2RlT25pZ3VydW1hLmNyZWF0ZU9uaWdTY2FubmVyKHNvdXJjZXMpLFxuXHRcdFx0Y3JlYXRlT25pZ1N0cmluZzogKHN0cjogc3RyaW5nKSA9PiB2c2NvZGVPbmlndXJ1bWEuY3JlYXRlT25pZ1N0cmluZyhzdHIpXG5cdFx0fSk7XG5cblx0XHQvLyBBdm9pZCBkdXBsaWNhdGUgaW5zdGFudGlhdGlvbnNcblx0XHRpZiAodGhpcy5fZ3JhbW1hckZhY3RvcnkpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ncmFtbWFyRmFjdG9yeTtcblx0XHR9XG5cblx0XHR0aGlzLl9ncmFtbWFyRmFjdG9yeSA9IG5ldyBUTUdyYW1tYXJGYWN0b3J5KHtcblx0XHRcdGxvZ1RyYWNlOiAobXNnOiBzdHJpbmcpID0+IHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UobXNnKSxcblx0XHRcdGxvZ0Vycm9yOiAobXNnOiBzdHJpbmcsIGVycjogYW55KSA9PiB0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKG1zZywgZXJyKSxcblx0XHRcdHJlYWRGaWxlOiAocmVzb3VyY2U6IFVSSSkgPT4gdGhpcy5fZXh0ZW5zaW9uUmVzb3VyY2VMb2FkZXJTZXJ2aWNlLnJlYWRFeHRlbnNpb25SZXNvdXJjZShyZXNvdXJjZSlcblx0XHR9LCB0aGlzLl9ncmFtbWFyRGVmaW5pdGlvbnMgfHwgW10sIHZzY29kZVRleHRtYXRlLCBvbmlnTGliKTtcblxuXHRcdHRoaXMuX3VwZGF0ZVRoZW1lKHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCksIHRydWUpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2dyYW1tYXJGYWN0b3J5O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY3JlYXRlVG9rZW5pemF0aW9uU3VwcG9ydChsYW5ndWFnZUlkOiBzdHJpbmcpOiBQcm9taXNlPElUb2tlbml6YXRpb25TdXBwb3J0ICYgSURpc3Bvc2FibGUgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLl9sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fY2FuQ3JlYXRlR3JhbW1hckZhY3RvcnkoKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGdyYW1tYXJGYWN0b3J5ID0gYXdhaXQgdGhpcy5fZ2V0T3JDcmVhdGVHcmFtbWFyRmFjdG9yeSgpO1xuXHRcdFx0aWYgKCFncmFtbWFyRmFjdG9yeS5oYXMobGFuZ3VhZ2VJZCkpIHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBlbmNvZGVkTGFuZ3VhZ2VJZCA9IHRoaXMuX2xhbmd1YWdlU2VydmljZS5sYW5ndWFnZUlkQ29kZWMuZW5jb2RlTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKTtcblx0XHRcdGNvbnN0IHIgPSBhd2FpdCBncmFtbWFyRmFjdG9yeS5jcmVhdGVHcmFtbWFyKGxhbmd1YWdlSWQsIGVuY29kZWRMYW5ndWFnZUlkKTtcblx0XHRcdGlmICghci5ncmFtbWFyKSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0Y29uc3QgbWF4VG9rZW5pemF0aW9uTGluZUxlbmd0aCA9IG9ic2VydmFibGVDb25maWdWYWx1ZTxudW1iZXI+KFxuXHRcdFx0XHQnZWRpdG9yLm1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgnLFxuXHRcdFx0XHRsYW5ndWFnZUlkLFxuXHRcdFx0XHQtMSxcblx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Vcblx0XHRcdCk7XG5cdFx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdGNvbnN0IHRva2VuaXphdGlvbiA9IHN0b3JlLmFkZChuZXcgVGV4dE1hdGVUb2tlbml6YXRpb25TdXBwb3J0KFxuXHRcdFx0XHRyLmdyYW1tYXIsXG5cdFx0XHRcdHIuaW5pdGlhbFN0YXRlLFxuXHRcdFx0XHRyLmNvbnRhaW5zRW1iZWRkZWRMYW5ndWFnZXMsXG5cdFx0XHRcdCh0ZXh0TW9kZWwsIHRva2VuU3RvcmUpID0+IHRoaXMuX3RocmVhZGVkQmFja2dyb3VuZFRva2VuaXplckZhY3RvcnkuY3JlYXRlQmFja2dyb3VuZFRva2VuaXplcih0ZXh0TW9kZWwsIHRva2VuU3RvcmUsIG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgpLFxuXHRcdFx0XHQoKSA9PiB0aGlzLmdldEFzeW5jVG9rZW5pemF0aW9uVmVyaWZpY2F0aW9uKCksXG5cdFx0XHRcdCh0aW1lTXMsIGxpbmVMZW5ndGgsIGlzUmFuZG9tU2FtcGxlKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fcmVwb3J0VG9rZW5pemF0aW9uVGltZSh0aW1lTXMsIGxhbmd1YWdlSWQsIHIuc291cmNlRXh0ZW5zaW9uSWQsIGxpbmVMZW5ndGgsIGZhbHNlLCBpc1JhbmRvbVNhbXBsZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRydWUsXG5cdFx0XHQpKTtcblx0XHRcdHN0b3JlLmFkZCh0b2tlbml6YXRpb24ub25EaWRFbmNvdW50ZXJMYW5ndWFnZSgoZW5jb2RlZExhbmd1YWdlSWQpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLl9lbmNvdW50ZXJlZExhbmd1YWdlc1tlbmNvZGVkTGFuZ3VhZ2VJZF0pIHtcblx0XHRcdFx0XHRjb25zdCBsYW5ndWFnZUlkID0gdGhpcy5fbGFuZ3VhZ2VTZXJ2aWNlLmxhbmd1YWdlSWRDb2RlYy5kZWNvZGVMYW5ndWFnZUlkKGVuY29kZWRMYW5ndWFnZUlkKTtcblx0XHRcdFx0XHR0aGlzLl9lbmNvdW50ZXJlZExhbmd1YWdlc1tlbmNvZGVkTGFuZ3VhZ2VJZF0gPSB0cnVlO1xuXHRcdFx0XHRcdHRoaXMuX2xhbmd1YWdlU2VydmljZS5yZXF1ZXN0QmFzaWNMYW5ndWFnZUZlYXR1cmVzKGxhbmd1YWdlSWQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHJldHVybiBuZXcgVG9rZW5pemF0aW9uU3VwcG9ydFdpdGhMaW5lTGltaXQoZW5jb2RlZExhbmd1YWdlSWQsIHRva2VuaXphdGlvbiwgc3RvcmUsIG1heFRva2VuaXphdGlvbkxpbmVMZW5ndGgpO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0aWYgKGVyci5tZXNzYWdlICYmIGVyci5tZXNzYWdlID09PSBtaXNzaW5nVE1HcmFtbWFyRXJyb3JNZXNzYWdlKSB7XG5cdFx0XHRcdC8vIERvbid0IGxvZyB0aGlzIGVycm9yIG1lc3NhZ2Vcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRvblVuZXhwZWN0ZWRFcnJvcihlcnIpO1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfdXBkYXRlVGhlbWUoY29sb3JUaGVtZTogSVdvcmtiZW5jaENvbG9yVGhlbWUsIGZvcmNlVXBkYXRlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKCFmb3JjZVVwZGF0ZSAmJiB0aGlzLl9jdXJyZW50VGhlbWUgJiYgdGhpcy5fY3VycmVudFRva2VuQ29sb3JNYXAgJiYgZXF1YWxzVG9rZW5SdWxlcyh0aGlzLl9jdXJyZW50VGhlbWUuc2V0dGluZ3MsIGNvbG9yVGhlbWUudG9rZW5Db2xvcnMpXG5cdFx0XHQmJiBlcXVhbEFycmF5KHRoaXMuX2N1cnJlbnRUb2tlbkNvbG9yTWFwLCBjb2xvclRoZW1lLnRva2VuQ29sb3JNYXApKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2N1cnJlbnRUaGVtZSA9IHsgbmFtZTogY29sb3JUaGVtZS5sYWJlbCwgc2V0dGluZ3M6IGNvbG9yVGhlbWUudG9rZW5Db2xvcnMgfTtcblx0XHR0aGlzLl9jdXJyZW50VG9rZW5Db2xvck1hcCA9IGNvbG9yVGhlbWUudG9rZW5Db2xvck1hcDtcblxuXHRcdHRoaXMuX2dyYW1tYXJGYWN0b3J5Py5zZXRUaGVtZSh0aGlzLl9jdXJyZW50VGhlbWUsIHRoaXMuX2N1cnJlbnRUb2tlbkNvbG9yTWFwKTtcblx0XHRjb25zdCBjb2xvck1hcCA9IHRvQ29sb3JNYXAodGhpcy5fY3VycmVudFRva2VuQ29sb3JNYXApO1xuXHRcdGNvbnN0IGNzc1J1bGVzID0gZ2VuZXJhdGVUb2tlbnNDU1NGb3JDb2xvck1hcChjb2xvck1hcCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50LnRleHRDb250ZW50ID0gY3NzUnVsZXM7XG5cdFx0VG9rZW5pemF0aW9uUmVnaXN0cnkuc2V0Q29sb3JNYXAoY29sb3JNYXApO1xuXG5cdFx0aWYgKHRoaXMuX2N1cnJlbnRUaGVtZSAmJiB0aGlzLl9jdXJyZW50VG9rZW5Db2xvck1hcCkge1xuXHRcdFx0dGhpcy5fdGhyZWFkZWRCYWNrZ3JvdW5kVG9rZW5pemVyRmFjdG9yeS5hY2NlcHRUaGVtZSh0aGlzLl9jdXJyZW50VGhlbWUsIHRoaXMuX2N1cnJlbnRUb2tlbkNvbG9yTWFwKTtcblx0XHR9XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgY3JlYXRlVG9rZW5pemVyKGxhbmd1YWdlSWQ6IHN0cmluZyk6IFByb21pc2U8SUdyYW1tYXIgfCBudWxsPiB7XG5cdFx0aWYgKCF0aGlzLl9sYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5ndWFnZUlkKSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGdyYW1tYXJGYWN0b3J5ID0gYXdhaXQgdGhpcy5fZ2V0T3JDcmVhdGVHcmFtbWFyRmFjdG9yeSgpO1xuXHRcdGlmICghZ3JhbW1hckZhY3RvcnkuaGFzKGxhbmd1YWdlSWQpKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgZW5jb2RlZExhbmd1YWdlSWQgPSB0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobGFuZ3VhZ2VJZCk7XG5cdFx0Y29uc3QgeyBncmFtbWFyIH0gPSBhd2FpdCBncmFtbWFyRmFjdG9yeS5jcmVhdGVHcmFtbWFyKGxhbmd1YWdlSWQsIGVuY29kZWRMYW5ndWFnZUlkKTtcblx0XHRyZXR1cm4gZ3JhbW1hcjtcblx0fVxuXG5cdHByaXZhdGUgX3ZzY29kZU9uaWd1cnVtYTogUHJvbWlzZTx0eXBlb2YgaW1wb3J0KCd2c2NvZGUtb25pZ3VydW1hJyk+IHwgbnVsbCA9IG51bGw7XG5cdHByaXZhdGUgX2dldFZTQ29kZU9uaWd1cnVtYSgpOiBQcm9taXNlPHR5cGVvZiBpbXBvcnQoJ3ZzY29kZS1vbmlndXJ1bWEnKT4ge1xuXHRcdGlmICghdGhpcy5fdnNjb2RlT25pZ3VydW1hKSB7XG5cdFx0XHR0aGlzLl92c2NvZGVPbmlndXJ1bWEgPSAoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBbdnNjb2RlT25pZ3VydW1hLCB3YXNtXSA9IGF3YWl0IFByb21pc2UuYWxsKFtpbXBvcnRBTUROb2RlTW9kdWxlPHR5cGVvZiBpbXBvcnQoJ3ZzY29kZS1vbmlndXJ1bWEnKT4oJ3ZzY29kZS1vbmlndXJ1bWEnLCAncmVsZWFzZS9tYWluLmpzJyksIHRoaXMuX2xvYWRWU0NvZGVPbmlndXJ1bWFXQVNNKCldKTtcblx0XHRcdFx0YXdhaXQgdnNjb2RlT25pZ3VydW1hLmxvYWRXQVNNKHtcblx0XHRcdFx0XHRkYXRhOiB3YXNtLFxuXHRcdFx0XHRcdHByaW50OiAoc3RyOiBzdHJpbmcpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX2RlYnVnTW9kZVByaW50RnVuYyhzdHIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiB2c2NvZGVPbmlndXJ1bWE7XG5cdFx0XHR9KSgpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fdnNjb2RlT25pZ3VydW1hO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfbG9hZFZTQ29kZU9uaWd1cnVtYVdBU00oKTogUHJvbWlzZTxSZXNwb25zZSB8IEFycmF5QnVmZmVyPiB7XG5cdFx0aWYgKGlzV2ViKSB7XG5cdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IGZldGNoKHJlc29sdmVBbWROb2RlTW9kdWxlUGF0aCgndnNjb2RlLW9uaWd1cnVtYScsICdyZWxlYXNlL29uaWcud2FzbScpKTtcblx0XHRcdC8vIFVzaW5nIHRoZSByZXNwb25zZSBkaXJlY3RseSBvbmx5IHdvcmtzIGlmIHRoZSBzZXJ2ZXIgc2V0cyB0aGUgTUlNRSB0eXBlICdhcHBsaWNhdGlvbi93YXNtJy5cblx0XHRcdC8vIE90aGVyd2lzZSwgYSBUeXBlRXJyb3IgaXMgdGhyb3duIHdoZW4gdXNpbmcgdGhlIHN0cmVhbWluZyBjb21waWxlci5cblx0XHRcdC8vIFdlIHRoZXJlZm9yZSB1c2UgdGhlIG5vbi1zdHJlYW1pbmcgY29tcGlsZXIgOiguXG5cdFx0XHRyZXR1cm4gYXdhaXQgcmVzcG9uc2UuYXJyYXlCdWZmZXIoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCBmZXRjaChjYW5BU0FSICYmIHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5pc0J1aWx0XG5cdFx0XHRcdD8gRmlsZUFjY2Vzcy5hc0Jyb3dzZXJVcmkoYCR7bm9kZU1vZHVsZXNBc2FyVW5wYWNrZWRQYXRofS92c2NvZGUtb25pZ3VydW1hL3JlbGVhc2Uvb25pZy53YXNtYCkudG9TdHJpbmcodHJ1ZSlcblx0XHRcdFx0OiBGaWxlQWNjZXNzLmFzQnJvd3NlclVyaShgJHtub2RlTW9kdWxlc1BhdGh9L3ZzY29kZS1vbmlndXJ1bWEvcmVsZWFzZS9vbmlnLndhc21gKS50b1N0cmluZyh0cnVlKSk7XG5cdFx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVwb3J0VG9rZW5pemF0aW9uVGltZSh0aW1lTXM6IG51bWJlciwgbGFuZ3VhZ2VJZDogc3RyaW5nLCBzb3VyY2VFeHRlbnNpb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkLCBsaW5lTGVuZ3RoOiBudW1iZXIsIGZyb21Xb3JrZXI6IGJvb2xlYW4sIGlzUmFuZG9tU2FtcGxlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3Qga2V5ID0gZnJvbVdvcmtlciA/ICdhc3luYycgOiAnc3luYyc7XG5cblx0XHQvLyA1MCBldmVudHMgcGVyIGhvdXIgKG9uZSBldmVudCBoYXMgYSBsb3cgcHJvYmFiaWxpdHkpXG5cdFx0aWYgKFRleHRNYXRlVG9rZW5pemF0aW9uRmVhdHVyZS5yZXBvcnRUb2tlbml6YXRpb25UaW1lQ291bnRlcltrZXldID4gNTApIHtcblx0XHRcdC8vIERvbid0IGZsb29kIHRlbGVtZXRyeSB3aXRoIHRvbyBtYW55IGV2ZW50c1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoVGV4dE1hdGVUb2tlbml6YXRpb25GZWF0dXJlLnJlcG9ydFRva2VuaXphdGlvblRpbWVDb3VudGVyW2tleV0gPT09IDApIHtcblx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRUZXh0TWF0ZVRva2VuaXphdGlvbkZlYXR1cmUucmVwb3J0VG9rZW5pemF0aW9uVGltZUNvdW50ZXJba2V5XSA9IDA7XG5cdFx0XHR9LCAxMDAwICogNjAgKiA2MCk7XG5cdFx0fVxuXHRcdFRleHRNYXRlVG9rZW5pemF0aW9uRmVhdHVyZS5yZXBvcnRUb2tlbml6YXRpb25UaW1lQ291bnRlcltrZXldKys7XG5cblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8e1xuXHRcdFx0dGltZU1zOiBudW1iZXI7XG5cdFx0XHRsYW5ndWFnZUlkOiBzdHJpbmc7XG5cdFx0XHRsaW5lTGVuZ3RoOiBudW1iZXI7XG5cdFx0XHRmcm9tV29ya2VyOiBib29sZWFuO1xuXHRcdFx0c291cmNlRXh0ZW5zaW9uSWQ6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRcdGlzUmFuZG9tU2FtcGxlOiBib29sZWFuO1xuXHRcdFx0dG9rZW5pemF0aW9uU2V0dGluZzogbnVtYmVyO1xuXHRcdH0sIHtcblx0XHRcdG93bmVyOiAnaGVkaWV0JztcblxuXHRcdFx0dGltZU1zOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG8gdW5kZXJzdGFuZCBob3cgbG9uZyBpdCB0b29rIHRvIHRva2VuaXplIGEgcmFuZG9tIGxpbmUnIH07XG5cdFx0XHRsYW5ndWFnZUlkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG8gcmVsYXRlIHRoZSBwZXJmb3JtYW5jZSB0byB0aGUgbGFuZ3VhZ2UnIH07XG5cdFx0XHRsaW5lTGVuZ3RoOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG8gcmVsYXRlIHRoZSBwZXJmb3JtYW5jZSB0byB0aGUgbGluZSBsZW5ndGgnIH07XG5cdFx0XHRmcm9tV29ya2VyOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG8gZmlndXJlIG91dCBpZiB0aGlzIGxpbmUgd2FzIHRva2VuaXplZCBzeW5jIG9yIGFzeW5jJyB9O1xuXHRcdFx0c291cmNlRXh0ZW5zaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUbyBmaWd1cmUgb3V0IHdoaWNoIGV4dGVuc2lvbiBjb250cmlidXRlZCB0aGUgZ3JhbW1hcicgfTtcblx0XHRcdGlzUmFuZG9tU2FtcGxlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVG8gZmlndXJlIG91dCBpZiB0aGlzIGlzIGEgcmFuZG9tIHNhbXBsZSBvciBtZWFzdXJlZCBiZWNhdXNlIG9mIHNvbWUgb3RoZXIgY29uZGl0aW9uLicgfTtcblx0XHRcdHRva2VuaXphdGlvblNldHRpbmc6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUbyB1bmRlcnN0YW5kIGlmIHRoZSB1c2VyIGhhcyBhc3luYyB0b2tlbml6YXRpb24gZW5hYmxlZC4gMD1zeW5jLCAxPWFzeW5jLCAyPXZlcmlmaWNhdGlvbicgfTtcblxuXHRcdFx0Y29tbWVudDogJ1RoaXMgZXZlbnQgZ2l2ZXMgaW5zaWdodCBhYm91dCB0aGUgcGVyZm9ybWFuY2UgY2VydGFpbiBncmFtbWFycy4nO1xuXHRcdH0+KCdlZGl0b3IudG9rZW5pemVkTGluZScsIHtcblx0XHRcdHRpbWVNcyxcblx0XHRcdGxhbmd1YWdlSWQsXG5cdFx0XHRsaW5lTGVuZ3RoLFxuXHRcdFx0ZnJvbVdvcmtlcixcblx0XHRcdHNvdXJjZUV4dGVuc2lvbklkLFxuXHRcdFx0aXNSYW5kb21TYW1wbGUsXG5cdFx0XHR0b2tlbml6YXRpb25TZXR0aW5nOiB0aGlzLmdldEFzeW5jVG9rZW5pemF0aW9uRW5hYmxlZCgpID8gKHRoaXMuZ2V0QXN5bmNUb2tlbml6YXRpb25WZXJpZmljYXRpb24oKSA/IDIgOiAxKSA6IDAsXG5cdFx0fSk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdG9Db2xvck1hcChjb2xvck1hcDogc3RyaW5nW10pOiBDb2xvcltdIHtcblx0Y29uc3QgcmVzdWx0OiBDb2xvcltdID0gW251bGwhXTtcblx0Zm9yIChsZXQgaSA9IDEsIGxlbiA9IGNvbG9yTWFwLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0cmVzdWx0W2ldID0gQ29sb3IuZnJvbUhleChjb2xvck1hcFtpXSk7XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZnVuY3Rpb24gZXF1YWxzVG9rZW5SdWxlcyhhOiBJVGV4dE1hdGVUaGVtaW5nUnVsZVtdIHwgbnVsbCwgYjogSVRleHRNYXRlVGhlbWluZ1J1bGVbXSB8IG51bGwpOiBib29sZWFuIHtcblx0aWYgKCFiIHx8ICFhIHx8IGIubGVuZ3RoICE9PSBhLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRmb3IgKGxldCBpID0gYi5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdGNvbnN0IHIxID0gYltpXTtcblx0XHRjb25zdCByMiA9IGFbaV07XG5cdFx0aWYgKHIxLnNjb3BlICE9PSByMi5zY29wZSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBzMSA9IHIxLnNldHRpbmdzO1xuXHRcdGNvbnN0IHMyID0gcjIuc2V0dGluZ3M7XG5cdFx0aWYgKHMxICYmIHMyKSB7XG5cdFx0XHRpZiAoczEuZm9udFN0eWxlICE9PSBzMi5mb250U3R5bGUgfHwgczEuZm9yZWdyb3VuZCAhPT0gczIuZm9yZWdyb3VuZCB8fCBzMS5iYWNrZ3JvdW5kICE9PSBzMi5iYWNrZ3JvdW5kKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKCFzMSB8fCAhczIpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIHZhbGlkYXRlR3JhbW1hckV4dGVuc2lvblBvaW50KGV4dGVuc2lvbkxvY2F0aW9uOiBVUkksIHN5bnRheDogSVRNU3ludGF4RXh0ZW5zaW9uUG9pbnQsIGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciwgX2xhbmd1YWdlU2VydmljZTogSUxhbmd1YWdlU2VydmljZSk6IGJvb2xlYW4ge1xuXHRpZiAoc3ludGF4Lmxhbmd1YWdlICYmICgodHlwZW9mIHN5bnRheC5sYW5ndWFnZSAhPT0gJ3N0cmluZycpIHx8ICFfbGFuZ3VhZ2VTZXJ2aWNlLmlzUmVnaXN0ZXJlZExhbmd1YWdlSWQoc3ludGF4Lmxhbmd1YWdlKSkpIHtcblx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLmxhbmd1YWdlJywgXCJVbmtub3duIGxhbmd1YWdlIGluIGBjb250cmlidXRlcy57MH0ubGFuZ3VhZ2VgLiBQcm92aWRlZCB2YWx1ZTogezF9XCIsIGdyYW1tYXJzRXh0UG9pbnQubmFtZSwgU3RyaW5nKHN5bnRheC5sYW5ndWFnZSkpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKCFzeW50YXguc2NvcGVOYW1lIHx8ICh0eXBlb2Ygc3ludGF4LnNjb3BlTmFtZSAhPT0gJ3N0cmluZycpKSB7XG5cdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5zY29wZU5hbWUnLCBcIkV4cGVjdGVkIHN0cmluZyBpbiBgY29udHJpYnV0ZXMuezB9LnNjb3BlTmFtZWAuIFByb3ZpZGVkIHZhbHVlOiB7MX1cIiwgZ3JhbW1hcnNFeHRQb2ludC5uYW1lLCBTdHJpbmcoc3ludGF4LnNjb3BlTmFtZSkpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKCFzeW50YXgucGF0aCB8fCAodHlwZW9mIHN5bnRheC5wYXRoICE9PSAnc3RyaW5nJykpIHtcblx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnBhdGguMCcsIFwiRXhwZWN0ZWQgc3RyaW5nIGluIGBjb250cmlidXRlcy57MH0ucGF0aGAuIFByb3ZpZGVkIHZhbHVlOiB7MX1cIiwgZ3JhbW1hcnNFeHRQb2ludC5uYW1lLCBTdHJpbmcoc3ludGF4LnBhdGgpKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdGlmIChzeW50YXguaW5qZWN0VG8gJiYgKCFBcnJheS5pc0FycmF5KHN5bnRheC5pbmplY3RUbykgfHwgc3ludGF4LmluamVjdFRvLnNvbWUoc2NvcGUgPT4gdHlwZW9mIHNjb3BlICE9PSAnc3RyaW5nJykpKSB7XG5cdFx0Y29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5pbmplY3RUbycsIFwiSW52YWxpZCB2YWx1ZSBpbiBgY29udHJpYnV0ZXMuezB9LmluamVjdFRvYC4gTXVzdCBiZSBhbiBhcnJheSBvZiBsYW5ndWFnZSBzY29wZSBuYW1lcy4gUHJvdmlkZWQgdmFsdWU6IHsxfVwiLCBncmFtbWFyc0V4dFBvaW50Lm5hbWUsIEpTT04uc3RyaW5naWZ5KHN5bnRheC5pbmplY3RUbykpKTtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0aWYgKHN5bnRheC5lbWJlZGRlZExhbmd1YWdlcyAmJiAhdHlwZXMuaXNPYmplY3Qoc3ludGF4LmVtYmVkZGVkTGFuZ3VhZ2VzKSkge1xuXHRcdGNvbGxlY3Rvci5lcnJvcihubHMubG9jYWxpemUoJ2ludmFsaWQuZW1iZWRkZWRMYW5ndWFnZXMnLCBcIkludmFsaWQgdmFsdWUgaW4gYGNvbnRyaWJ1dGVzLnswfS5lbWJlZGRlZExhbmd1YWdlc2AuIE11c3QgYmUgYW4gb2JqZWN0IG1hcCBmcm9tIHNjb3BlIG5hbWUgdG8gbGFuZ3VhZ2UuIFByb3ZpZGVkIHZhbHVlOiB7MX1cIiwgZ3JhbW1hcnNFeHRQb2ludC5uYW1lLCBKU09OLnN0cmluZ2lmeShzeW50YXguZW1iZWRkZWRMYW5ndWFnZXMpKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKHN5bnRheC50b2tlblR5cGVzICYmICF0eXBlcy5pc09iamVjdChzeW50YXgudG9rZW5UeXBlcykpIHtcblx0XHRjb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnRva2VuVHlwZXMnLCBcIkludmFsaWQgdmFsdWUgaW4gYGNvbnRyaWJ1dGVzLnswfS50b2tlblR5cGVzYC4gTXVzdCBiZSBhbiBvYmplY3QgbWFwIGZyb20gc2NvcGUgbmFtZSB0byB0b2tlbiB0eXBlLiBQcm92aWRlZCB2YWx1ZTogezF9XCIsIGdyYW1tYXJzRXh0UG9pbnQubmFtZSwgSlNPTi5zdHJpbmdpZnkoc3ludGF4LnRva2VuVHlwZXMpKSk7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0Y29uc3QgZ3JhbW1hckxvY2F0aW9uID0gcmVzb3VyY2VzLmpvaW5QYXRoKGV4dGVuc2lvbkxvY2F0aW9uLCBzeW50YXgucGF0aCk7XG5cdGlmICghcmVzb3VyY2VzLmlzRXF1YWxPclBhcmVudChncmFtbWFyTG9jYXRpb24sIGV4dGVuc2lvbkxvY2F0aW9uKSkge1xuXHRcdGNvbGxlY3Rvci53YXJuKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5wYXRoLjEnLCBcIkV4cGVjdGVkIGBjb250cmlidXRlcy57MH0ucGF0aGAgKHsxfSkgdG8gYmUgaW5jbHVkZWQgaW5zaWRlIGV4dGVuc2lvbidzIGZvbGRlciAoezJ9KS4gVGhpcyBtaWdodCBtYWtlIHRoZSBleHRlbnNpb24gbm9uLXBvcnRhYmxlLlwiLCBncmFtbWFyc0V4dFBvaW50Lm5hbWUsIGdyYW1tYXJMb2NhdGlvbi5wYXRoLCBleHRlbnNpb25Mb2NhdGlvbi5wYXRoKSk7XG5cdH1cblx0cmV0dXJuIHRydWU7XG59XG5cbmZ1bmN0aW9uIG9ic2VydmFibGVDb25maWdWYWx1ZTxUPihrZXk6IHN0cmluZywgbGFuZ3VhZ2VJZDogc3RyaW5nLCBkZWZhdWx0VmFsdWU6IFQsIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBJT2JzZXJ2YWJsZTxUPiB7XG5cdHJldHVybiBvYnNlcnZhYmxlRnJvbUV2ZW50KFxuXHRcdChoYW5kbGVDaGFuZ2UpID0+IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNDb25maWd1cmF0aW9uKGtleSwgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlSWQgfSkpIHtcblx0XHRcdFx0aGFuZGxlQ2hhbmdlKGUpO1xuXHRcdFx0fVxuXHRcdH0pLFxuXHRcdCgpID0+IGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlPFQ+KGtleSwgeyBvdmVycmlkZUlkZW50aWZpZXI6IGxhbmd1YWdlSWQgfSkgPz8gZGVmYXVsdFZhbHVlLFxuXHQpO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFNBQVMscUJBQXFCLGdDQUFnQztBQUN2RSxZQUFZLG9CQUFvQjtBQUNoQyxTQUFTLFVBQVUsa0JB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
