import { Color } from "../../../base/common/color.js";
import { Range } from "../../common/core/range.js";
import { MetadataConsts } from "../../common/encodedTokenAttributes.js";
import * as languages from "../../common/languages.js";
import { ILanguageService } from "../../common/languages/language.js";
import { ILanguageConfigurationService } from "../../common/languages/languageConfigurationRegistry.js";
import { ModesRegistry } from "../../common/languages/modesRegistry.js";
import { ILanguageFeaturesService } from "../../common/services/languageFeatures.js";
import * as standaloneEnums from "../../common/standalone/standaloneEnums.js";
import { StandaloneServices } from "./standaloneServices.js";
import { compile } from "../common/monarch/monarchCompile.js";
import { MonarchTokenizer } from "../common/monarch/monarchLexer.js";
import { IStandaloneThemeService } from "../common/standaloneTheme.js";
import { IConfigurationService } from "../../../platform/configuration/common/configuration.js";
import { IMarkerService } from "../../../platform/markers/common/markers.js";
function register(language) {
  ModesRegistry.registerLanguage(language);
}
function getLanguages() {
  let result = [];
  result = result.concat(ModesRegistry.getLanguages());
  return result;
}
function getEncodedLanguageId(languageId) {
  const languageService = StandaloneServices.get(ILanguageService);
  return languageService.languageIdCodec.encodeLanguageId(languageId);
}
function onLanguage(languageId, callback) {
  return StandaloneServices.withServices(() => {
    const languageService = StandaloneServices.get(ILanguageService);
    const disposable = languageService.onDidRequestRichLanguageFeatures((encounteredLanguageId) => {
      if (encounteredLanguageId === languageId) {
        disposable.dispose();
        callback();
      }
    });
    return disposable;
  });
}
function onLanguageEncountered(languageId, callback) {
  return StandaloneServices.withServices(() => {
    const languageService = StandaloneServices.get(ILanguageService);
    const disposable = languageService.onDidRequestBasicLanguageFeatures((encounteredLanguageId) => {
      if (encounteredLanguageId === languageId) {
        disposable.dispose();
        callback();
      }
    });
    return disposable;
  });
}
function setLanguageConfiguration(languageId, configuration) {
  const languageService = StandaloneServices.get(ILanguageService);
  if (!languageService.isRegisteredLanguageId(languageId)) {
    throw new Error(`Cannot set configuration for unknown language ${languageId}`);
  }
  const languageConfigurationService = StandaloneServices.get(ILanguageConfigurationService);
  return languageConfigurationService.register(languageId, configuration, 100);
}
class EncodedTokenizationSupportAdapter {
  constructor(languageId, actual) {
    this._languageId = languageId;
    this._actual = actual;
  }
  dispose() {
  }
  getInitialState() {
    return this._actual.getInitialState();
  }
  tokenize(line, hasEOL, state) {
    if (typeof this._actual.tokenize === "function") {
      return TokenizationSupportAdapter.adaptTokenize(this._languageId, this._actual, line, state);
    }
    throw new Error("Not supported!");
  }
  tokenizeEncoded(line, hasEOL, state) {
    const result = this._actual.tokenizeEncoded(line, state);
    return new languages.EncodedTokenizationResult(result.tokens, result.endState);
  }
}
class TokenizationSupportAdapter {
  constructor(_languageId, _actual, _languageService, _standaloneThemeService) {
    this._languageId = _languageId;
    this._actual = _actual;
    this._languageService = _languageService;
    this._standaloneThemeService = _standaloneThemeService;
  }
  dispose() {
  }
  getInitialState() {
    return this._actual.getInitialState();
  }
  static _toClassicTokens(tokens, language) {
    const result = [];
    let previousStartIndex = 0;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const t = tokens[i];
      let startIndex = t.startIndex;
      if (i === 0) {
        startIndex = 0;
      } else if (startIndex < previousStartIndex) {
        startIndex = previousStartIndex;
      }
      result[i] = new languages.Token(startIndex, t.scopes, language);
      previousStartIndex = startIndex;
    }
    return result;
  }
  static adaptTokenize(language, actual, line, state) {
    const actualResult = actual.tokenize(line, state);
    const tokens = TokenizationSupportAdapter._toClassicTokens(actualResult.tokens, language);
    let endState;
    if (actualResult.endState.equals(state)) {
      endState = state;
    } else {
      endState = actualResult.endState;
    }
    return new languages.TokenizationResult(tokens, endState);
  }
  tokenize(line, hasEOL, state) {
    return TokenizationSupportAdapter.adaptTokenize(this._languageId, this._actual, line, state);
  }
  _toBinaryTokens(languageIdCodec, tokens) {
    const languageId = languageIdCodec.encodeLanguageId(this._languageId);
    const tokenTheme = this._standaloneThemeService.getColorTheme().tokenTheme;
    const result = [];
    let resultLen = 0;
    let previousStartIndex = 0;
    for (let i = 0, len = tokens.length; i < len; i++) {
      const t = tokens[i];
      const metadata = tokenTheme.match(languageId, t.scopes) | MetadataConsts.BALANCED_BRACKETS_MASK;
      if (resultLen > 0 && result[resultLen - 1] === metadata) {
        continue;
      }
      let startIndex = t.startIndex;
      if (i === 0) {
        startIndex = 0;
      } else if (startIndex < previousStartIndex) {
        startIndex = previousStartIndex;
      }
      result[resultLen++] = startIndex;
      result[resultLen++] = metadata;
      previousStartIndex = startIndex;
    }
    const actualResult = new Uint32Array(resultLen);
    for (let i = 0; i < resultLen; i++) {
      actualResult[i] = result[i];
    }
    return actualResult;
  }
  tokenizeEncoded(line, hasEOL, state) {
    const actualResult = this._actual.tokenize(line, state);
    const tokens = this._toBinaryTokens(this._languageService.languageIdCodec, actualResult.tokens);
    let endState;
    if (actualResult.endState.equals(state)) {
      endState = state;
    } else {
      endState = actualResult.endState;
    }
    return new languages.EncodedTokenizationResult(tokens, endState);
  }
}
function isATokensProvider(provider) {
  return typeof provider.getInitialState === "function";
}
function isEncodedTokensProvider(provider) {
  return "tokenizeEncoded" in provider;
}
function isThenable(obj) {
  return obj && typeof obj.then === "function";
}
function setColorMap(colorMap) {
  const standaloneThemeService = StandaloneServices.get(IStandaloneThemeService);
  if (colorMap) {
    const result = [null];
    for (let i = 1, len = colorMap.length; i < len; i++) {
      result[i] = Color.fromHex(colorMap[i]);
    }
    standaloneThemeService.setColorMapOverride(result);
  } else {
    standaloneThemeService.setColorMapOverride(null);
  }
}
function createTokenizationSupportAdapter(languageId, provider) {
  if (isEncodedTokensProvider(provider)) {
    return new EncodedTokenizationSupportAdapter(languageId, provider);
  } else {
    return new TokenizationSupportAdapter(
      languageId,
      provider,
      StandaloneServices.get(ILanguageService),
      StandaloneServices.get(IStandaloneThemeService)
    );
  }
}
function registerTokensProviderFactory(languageId, factory) {
  const adaptedFactory = new languages.LazyTokenizationSupport(async () => {
    const result = await Promise.resolve(factory.create());
    if (!result) {
      return null;
    }
    if (isATokensProvider(result)) {
      return createTokenizationSupportAdapter(languageId, result);
    }
    return new MonarchTokenizer(StandaloneServices.get(ILanguageService), StandaloneServices.get(IStandaloneThemeService), languageId, compile(languageId, result), StandaloneServices.get(IConfigurationService));
  });
  return languages.TokenizationRegistry.registerFactory(languageId, adaptedFactory);
}
function setTokensProvider(languageId, provider) {
  const languageService = StandaloneServices.get(ILanguageService);
  if (!languageService.isRegisteredLanguageId(languageId)) {
    throw new Error(`Cannot set tokens provider for unknown language ${languageId}`);
  }
  if (isThenable(provider)) {
    return registerTokensProviderFactory(languageId, { create: () => provider });
  }
  return languages.TokenizationRegistry.register(languageId, createTokenizationSupportAdapter(languageId, provider));
}
function setMonarchTokensProvider(languageId, languageDef) {
  const create = (languageDef2) => {
    return new MonarchTokenizer(StandaloneServices.get(ILanguageService), StandaloneServices.get(IStandaloneThemeService), languageId, compile(languageId, languageDef2), StandaloneServices.get(IConfigurationService));
  };
  if (isThenable(languageDef)) {
    return registerTokensProviderFactory(languageId, { create: () => languageDef });
  }
  return languages.TokenizationRegistry.register(languageId, create(languageDef));
}
function registerReferenceProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.referenceProvider.register(languageSelector, provider);
}
function registerRenameProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.renameProvider.register(languageSelector, provider);
}
function registerNewSymbolNameProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.newSymbolNamesProvider.register(languageSelector, provider);
}
function registerSignatureHelpProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.signatureHelpProvider.register(languageSelector, provider);
}
function registerHoverProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.hoverProvider.register(languageSelector, {
    provideHover: async (model2, position, token, context) => {
      const word = model2.getWordAtPosition(position);
      return Promise.resolve(provider.provideHover(model2, position, token, context)).then((value) => {
        if (!value) {
          return void 0;
        }
        if (!value.range && word) {
          value.range = new Range(position.lineNumber, word.startColumn, position.lineNumber, word.endColumn);
        }
        if (!value.range) {
          value.range = new Range(position.lineNumber, position.column, position.lineNumber, position.column);
        }
        return value;
      });
    }
  });
}
function registerDocumentSymbolProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentSymbolProvider.register(languageSelector, provider);
}
function registerDocumentHighlightProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentHighlightProvider.register(languageSelector, provider);
}
function registerLinkedEditingRangeProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.linkedEditingRangeProvider.register(languageSelector, provider);
}
function registerDefinitionProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.definitionProvider.register(languageSelector, provider);
}
function registerImplementationProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.implementationProvider.register(languageSelector, provider);
}
function registerTypeDefinitionProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.typeDefinitionProvider.register(languageSelector, provider);
}
function registerCodeLensProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.codeLensProvider.register(languageSelector, provider);
}
function registerCodeActionProvider(languageSelector, provider, metadata) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.codeActionProvider.register(languageSelector, {
    providedCodeActionKinds: metadata?.providedCodeActionKinds,
    documentation: metadata?.documentation,
    provideCodeActions: (model2, range, context, token) => {
      const markerService = StandaloneServices.get(IMarkerService);
      const markers = markerService.read({ resource: model2.uri }).filter((m) => {
        return Range.areIntersectingOrTouching(m, range);
      });
      return provider.provideCodeActions(model2, range, { markers, only: context.only, trigger: context.trigger }, token);
    },
    resolveCodeAction: provider.resolveCodeAction
  });
}
function registerDocumentFormattingEditProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentFormattingEditProvider.register(languageSelector, provider);
}
function registerDocumentRangeFormattingEditProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentRangeFormattingEditProvider.register(languageSelector, provider);
}
function registerOnTypeFormattingEditProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.onTypeFormattingEditProvider.register(languageSelector, provider);
}
function registerLinkProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.linkProvider.register(languageSelector, provider);
}
function registerCompletionItemProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.completionProvider.register(languageSelector, provider);
}
function registerColorProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.colorProvider.register(languageSelector, provider);
}
function registerFoldingRangeProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.foldingRangeProvider.register(languageSelector, provider);
}
function registerDeclarationProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.declarationProvider.register(languageSelector, provider);
}
function registerSelectionRangeProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.selectionRangeProvider.register(languageSelector, provider);
}
function registerDocumentSemanticTokensProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentSemanticTokensProvider.register(languageSelector, provider);
}
function registerDocumentRangeSemanticTokensProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.documentRangeSemanticTokensProvider.register(languageSelector, provider);
}
function registerInlineCompletionsProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.inlineCompletionsProvider.register(languageSelector, provider);
}
function registerInlineEditProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.inlineEditProvider.register(languageSelector, provider);
}
function registerInlayHintsProvider(languageSelector, provider) {
  const languageFeaturesService = StandaloneServices.get(ILanguageFeaturesService);
  return languageFeaturesService.inlayHintsProvider.register(languageSelector, provider);
}
function createMonacoLanguagesAPI() {
  return {
    register,
    getLanguages,
    onLanguage,
    onLanguageEncountered,
    getEncodedLanguageId,
    // provider methods
    setLanguageConfiguration,
    setColorMap,
    registerTokensProviderFactory,
    setTokensProvider,
    setMonarchTokensProvider,
    registerReferenceProvider,
    registerRenameProvider,
    registerNewSymbolNameProvider,
    registerCompletionItemProvider,
    registerSignatureHelpProvider,
    registerHoverProvider,
    registerDocumentSymbolProvider,
    registerDocumentHighlightProvider,
    registerLinkedEditingRangeProvider,
    registerDefinitionProvider,
    registerImplementationProvider,
    registerTypeDefinitionProvider,
    registerCodeLensProvider,
    registerCodeActionProvider,
    registerDocumentFormattingEditProvider,
    registerDocumentRangeFormattingEditProvider,
    registerOnTypeFormattingEditProvider,
    registerLinkProvider,
    registerColorProvider,
    registerFoldingRangeProvider,
    registerDeclarationProvider,
    registerSelectionRangeProvider,
    registerDocumentSemanticTokensProvider,
    registerDocumentRangeSemanticTokensProvider,
    registerInlineCompletionsProvider,
    registerInlineEditProvider,
    registerInlayHintsProvider,
    // enums
    DocumentHighlightKind: standaloneEnums.DocumentHighlightKind,
    CompletionItemKind: standaloneEnums.CompletionItemKind,
    CompletionItemTag: standaloneEnums.CompletionItemTag,
    CompletionItemInsertTextRule: standaloneEnums.CompletionItemInsertTextRule,
    SymbolKind: standaloneEnums.SymbolKind,
    SymbolTag: standaloneEnums.SymbolTag,
    IndentAction: standaloneEnums.IndentAction,
    CompletionTriggerKind: standaloneEnums.CompletionTriggerKind,
    SignatureHelpTriggerKind: standaloneEnums.SignatureHelpTriggerKind,
    InlayHintKind: standaloneEnums.InlayHintKind,
    InlineCompletionTriggerKind: standaloneEnums.InlineCompletionTriggerKind,
    InlineEditTriggerKind: standaloneEnums.InlineEditTriggerKind,
    CodeActionTriggerType: standaloneEnums.CodeActionTriggerType,
    NewSymbolNameTag: standaloneEnums.NewSymbolNameTag,
    NewSymbolNameTriggerKind: standaloneEnums.NewSymbolNameTriggerKind,
    PartialAcceptTriggerKind: standaloneEnums.PartialAcceptTriggerKind,
    HoverVerbosityAction: standaloneEnums.HoverVerbosityAction,
    // classes
    FoldingRangeKind: languages.FoldingRangeKind,
    SelectedSuggestionInfo: languages.SelectedSuggestionInfo
  };
}
export {
  EncodedTokenizationSupportAdapter,
  TokenizationSupportAdapter,
  createMonacoLanguagesAPI,
  getEncodedLanguageId,
  getLanguages,
  onLanguage,
  onLanguageEncountered,
  register,
  registerCodeActionProvider,
  registerCodeLensProvider,
  registerColorProvider,
  registerCompletionItemProvider,
  registerDeclarationProvider,
  registerDefinitionProvider,
  registerDocumentFormattingEditProvider,
  registerDocumentHighlightProvider,
  registerDocumentRangeFormattingEditProvider,
  registerDocumentRangeSemanticTokensProvider,
  registerDocumentSemanticTokensProvider,
  registerDocumentSymbolProvider,
  registerFoldingRangeProvider,
  registerHoverProvider,
  registerImplementationProvider,
  registerInlayHintsProvider,
  registerInlineCompletionsProvider,
  registerInlineEditProvider,
  registerLinkProvider,
  registerLinkedEditingRangeProvider,
  registerNewSymbolNameProvider,
  registerOnTypeFormattingEditProvider,
  registerReferenceProvider,
  registerRenameProvider,
  registerSelectionRangeProvider,
  registerSignatureHelpProvider,
  registerTokensProviderFactory,
  registerTypeDefinitionProvider,
  setColorMap,
  setLanguageConfiguration,
  setMonarchTokensProvider,
  setTokensProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3Ivc3RhbmRhbG9uZS9icm93c2VyL3N0YW5kYWxvbmVMYW5ndWFnZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDb2xvciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NvbG9yLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBNZXRhZGF0YUNvbnN0cyB9IGZyb20gJy4uLy4uL2NvbW1vbi9lbmNvZGVkVG9rZW5BdHRyaWJ1dGVzLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUV4dGVuc2lvblBvaW50LCBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUNvbmZpZ3VyYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTW9kZXNSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMvbW9kZXNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZVNlbGVjdG9yIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xhbmd1YWdlU2VsZWN0b3IuanMnO1xuaW1wb3J0ICogYXMgbW9kZWwgZnJvbSAnLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCAqIGFzIHN0YW5kYWxvbmVFbnVtcyBmcm9tICcuLi8uLi9jb21tb24vc3RhbmRhbG9uZS9zdGFuZGFsb25lRW51bXMuanMnO1xuaW1wb3J0IHsgU3RhbmRhbG9uZVNlcnZpY2VzIH0gZnJvbSAnLi9zdGFuZGFsb25lU2VydmljZXMuanMnO1xuaW1wb3J0IHsgY29tcGlsZSB9IGZyb20gJy4uL2NvbW1vbi9tb25hcmNoL21vbmFyY2hDb21waWxlLmpzJztcbmltcG9ydCB7IE1vbmFyY2hUb2tlbml6ZXIgfSBmcm9tICcuLi9jb21tb24vbW9uYXJjaC9tb25hcmNoTGV4ZXIuanMnO1xuaW1wb3J0IHsgSU1vbmFyY2hMYW5ndWFnZSB9IGZyb20gJy4uL2NvbW1vbi9tb25hcmNoL21vbmFyY2hUeXBlcy5qcyc7XG5pbXBvcnQgeyBJU3RhbmRhbG9uZVRoZW1lU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9zdGFuZGFsb25lVGhlbWUuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWFya2VyRGF0YSwgSU1hcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJzLmpzJztcblxuLyoqXG4gKiBSZWdpc3RlciBpbmZvcm1hdGlvbiBhYm91dCBhIG5ldyBsYW5ndWFnZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyKGxhbmd1YWdlOiBJTGFuZ3VhZ2VFeHRlbnNpb25Qb2ludCk6IHZvaWQge1xuXHQvLyBJbnRlbnRpb25hbGx5IHVzaW5nIHRoZSBgTW9kZXNSZWdpc3RyeWAgaGVyZSB0byBhdm9pZFxuXHQvLyBpbnN0YW50aWF0aW5nIHNlcnZpY2VzIHRvbyBxdWlja2x5IGluIHRoZSBzdGFuZGFsb25lIGVkaXRvci5cblx0TW9kZXNSZWdpc3RyeS5yZWdpc3Rlckxhbmd1YWdlKGxhbmd1YWdlKTtcbn1cblxuLyoqXG4gKiBHZXQgdGhlIGluZm9ybWF0aW9uIG9mIGFsbCB0aGUgcmVnaXN0ZXJlZCBsYW5ndWFnZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBnZXRMYW5ndWFnZXMoKTogSUxhbmd1YWdlRXh0ZW5zaW9uUG9pbnRbXSB7XG5cdGxldCByZXN1bHQ6IElMYW5ndWFnZUV4dGVuc2lvblBvaW50W10gPSBbXTtcblx0cmVzdWx0ID0gcmVzdWx0LmNvbmNhdChNb2Rlc1JlZ2lzdHJ5LmdldExhbmd1YWdlcygpKTtcblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldEVuY29kZWRMYW5ndWFnZUlkKGxhbmd1YWdlSWQ6IHN0cmluZyk6IG51bWJlciB7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdHJldHVybiBsYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQobGFuZ3VhZ2VJZCk7XG59XG5cbi8qKlxuICogQW4gZXZlbnQgZW1pdHRlZCB3aGVuIGEgbGFuZ3VhZ2UgaXMgYXNzb2NpYXRlZCBmb3IgdGhlIGZpcnN0IHRpbWUgd2l0aCBhIHRleHQgbW9kZWwuXG4gKiBAZXZlbnRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9uTGFuZ3VhZ2UobGFuZ3VhZ2VJZDogc3RyaW5nLCBjYWxsYmFjazogKCkgPT4gdm9pZCk6IElEaXNwb3NhYmxlIHtcblx0cmV0dXJuIFN0YW5kYWxvbmVTZXJ2aWNlcy53aXRoU2VydmljZXMoKCkgPT4ge1xuXHRcdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGxhbmd1YWdlU2VydmljZS5vbkRpZFJlcXVlc3RSaWNoTGFuZ3VhZ2VGZWF0dXJlcygoZW5jb3VudGVyZWRMYW5ndWFnZUlkKSA9PiB7XG5cdFx0XHRpZiAoZW5jb3VudGVyZWRMYW5ndWFnZUlkID09PSBsYW5ndWFnZUlkKSB7XG5cdFx0XHRcdC8vIHN0b3AgbGlzdGVuaW5nXG5cdFx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0XHQvLyBpbnZva2UgYWN0dWFsIGxpc3RlbmVyXG5cdFx0XHRcdGNhbGxiYWNrKCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGRpc3Bvc2FibGU7XG5cdH0pO1xufVxuXG4vKipcbiAqIEFuIGV2ZW50IGVtaXR0ZWQgd2hlbiBhIGxhbmd1YWdlIGlzIGFzc29jaWF0ZWQgZm9yIHRoZSBmaXJzdCB0aW1lIHdpdGggYSB0ZXh0IG1vZGVsIG9yXG4gKiB3aGVuIGEgbGFuZ3VhZ2UgaXMgZW5jb3VudGVyZWQgZHVyaW5nIHRoZSB0b2tlbml6YXRpb24gb2YgYW5vdGhlciBsYW5ndWFnZS5cbiAqIEBldmVudFxuICovXG5leHBvcnQgZnVuY3Rpb24gb25MYW5ndWFnZUVuY291bnRlcmVkKGxhbmd1YWdlSWQ6IHN0cmluZywgY2FsbGJhY2s6ICgpID0+IHZvaWQpOiBJRGlzcG9zYWJsZSB7XG5cdHJldHVybiBTdGFuZGFsb25lU2VydmljZXMud2l0aFNlcnZpY2VzKCgpID0+IHtcblx0XHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBsYW5ndWFnZVNlcnZpY2Uub25EaWRSZXF1ZXN0QmFzaWNMYW5ndWFnZUZlYXR1cmVzKChlbmNvdW50ZXJlZExhbmd1YWdlSWQpID0+IHtcblx0XHRcdGlmIChlbmNvdW50ZXJlZExhbmd1YWdlSWQgPT09IGxhbmd1YWdlSWQpIHtcblx0XHRcdFx0Ly8gc3RvcCBsaXN0ZW5pbmdcblx0XHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0XHRcdC8vIGludm9rZSBhY3R1YWwgbGlzdGVuZXJcblx0XHRcdFx0Y2FsbGJhY2soKTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gZGlzcG9zYWJsZTtcblx0fSk7XG59XG5cbi8qKlxuICogU2V0IHRoZSBlZGl0aW5nIGNvbmZpZ3VyYXRpb24gZm9yIGEgbGFuZ3VhZ2UuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24obGFuZ3VhZ2VJZDogc3RyaW5nLCBjb25maWd1cmF0aW9uOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlU2VydmljZSk7XG5cdGlmICghbGFuZ3VhZ2VTZXJ2aWNlLmlzUmVnaXN0ZXJlZExhbmd1YWdlSWQobGFuZ3VhZ2VJZCkpIHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBzZXQgY29uZmlndXJhdGlvbiBmb3IgdW5rbm93biBsYW5ndWFnZSAke2xhbmd1YWdlSWR9YCk7XG5cdH1cblx0Y29uc3QgbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VDb25maWd1cmF0aW9uU2VydmljZS5yZWdpc3RlcihsYW5ndWFnZUlkLCBjb25maWd1cmF0aW9uLCAxMDApO1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgY2xhc3MgRW5jb2RlZFRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyIGltcGxlbWVudHMgbGFuZ3VhZ2VzLklUb2tlbml6YXRpb25TdXBwb3J0LCBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VJZDogc3RyaW5nO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hY3R1YWw6IEVuY29kZWRUb2tlbnNQcm92aWRlcjtcblxuXHRjb25zdHJ1Y3RvcihsYW5ndWFnZUlkOiBzdHJpbmcsIGFjdHVhbDogRW5jb2RlZFRva2Vuc1Byb3ZpZGVyKSB7XG5cdFx0dGhpcy5fbGFuZ3VhZ2VJZCA9IGxhbmd1YWdlSWQ7XG5cdFx0dGhpcy5fYWN0dWFsID0gYWN0dWFsO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHQvLyBOT09QXG5cdH1cblxuXHRwdWJsaWMgZ2V0SW5pdGlhbFN0YXRlKCk6IGxhbmd1YWdlcy5JU3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl9hY3R1YWwuZ2V0SW5pdGlhbFN0YXRlKCk7XG5cdH1cblxuXHRwdWJsaWMgdG9rZW5pemUobGluZTogc3RyaW5nLCBoYXNFT0w6IGJvb2xlYW4sIHN0YXRlOiBsYW5ndWFnZXMuSVN0YXRlKTogbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlc3VsdCB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9hY3R1YWwudG9rZW5pemUgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiBUb2tlbml6YXRpb25TdXBwb3J0QWRhcHRlci5hZGFwdFRva2VuaXplKHRoaXMuX2xhbmd1YWdlSWQsIDx7IHRva2VuaXplKGxpbmU6IHN0cmluZywgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBJTGluZVRva2VucyB9PnRoaXMuX2FjdHVhbCwgbGluZSwgc3RhdGUpO1xuXHRcdH1cblx0XHR0aHJvdyBuZXcgRXJyb3IoJ05vdCBzdXBwb3J0ZWQhJyk7XG5cdH1cblxuXHRwdWJsaWMgdG9rZW5pemVFbmNvZGVkKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBzdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IGxhbmd1YWdlcy5FbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0IHtcblx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9hY3R1YWwudG9rZW5pemVFbmNvZGVkKGxpbmUsIHN0YXRlKTtcblx0XHRyZXR1cm4gbmV3IGxhbmd1YWdlcy5FbmNvZGVkVG9rZW5pemF0aW9uUmVzdWx0KHJlc3VsdC50b2tlbnMsIHJlc3VsdC5lbmRTdGF0ZSk7XG5cdH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZXhwb3J0IGNsYXNzIFRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyIGltcGxlbWVudHMgbGFuZ3VhZ2VzLklUb2tlbml6YXRpb25TdXBwb3J0LCBJRGlzcG9zYWJsZSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VJZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2FjdHVhbDogVG9rZW5zUHJvdmlkZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTZXJ2aWNlOiBJTGFuZ3VhZ2VTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3N0YW5kYWxvbmVUaGVtZVNlcnZpY2U6IElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0Ly8gTk9PUFxuXHR9XG5cblx0cHVibGljIGdldEluaXRpYWxTdGF0ZSgpOiBsYW5ndWFnZXMuSVN0YXRlIHtcblx0XHRyZXR1cm4gdGhpcy5fYWN0dWFsLmdldEluaXRpYWxTdGF0ZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3RvQ2xhc3NpY1Rva2Vucyh0b2tlbnM6IElUb2tlbltdLCBsYW5ndWFnZTogc3RyaW5nKTogbGFuZ3VhZ2VzLlRva2VuW10ge1xuXHRcdGNvbnN0IHJlc3VsdDogbGFuZ3VhZ2VzLlRva2VuW10gPSBbXTtcblx0XHRsZXQgcHJldmlvdXNTdGFydEluZGV4OiBudW1iZXIgPSAwO1xuXHRcdGZvciAobGV0IGkgPSAwLCBsZW4gPSB0b2tlbnMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHQgPSB0b2tlbnNbaV07XG5cdFx0XHRsZXQgc3RhcnRJbmRleCA9IHQuc3RhcnRJbmRleDtcblxuXHRcdFx0Ly8gUHJldmVudCBpc3N1ZXMgc3RlbW1pbmcgZnJvbSBhIGJ1Z2d5IGV4dGVybmFsIHRva2VuaXplci5cblx0XHRcdGlmIChpID09PSAwKSB7XG5cdFx0XHRcdC8vIEZvcmNlIGZpcnN0IHRva2VuIHRvIHN0YXJ0IGF0IGZpcnN0IGluZGV4IVxuXHRcdFx0XHRzdGFydEluZGV4ID0gMDtcblx0XHRcdH0gZWxzZSBpZiAoc3RhcnRJbmRleCA8IHByZXZpb3VzU3RhcnRJbmRleCkge1xuXHRcdFx0XHQvLyBGb3JjZSB0b2tlbnMgdG8gYmUgYWZ0ZXIgb25lIGFub3RoZXIhXG5cdFx0XHRcdHN0YXJ0SW5kZXggPSBwcmV2aW91c1N0YXJ0SW5kZXg7XG5cdFx0XHR9XG5cblx0XHRcdHJlc3VsdFtpXSA9IG5ldyBsYW5ndWFnZXMuVG9rZW4oc3RhcnRJbmRleCwgdC5zY29wZXMsIGxhbmd1YWdlKTtcblxuXHRcdFx0cHJldmlvdXNTdGFydEluZGV4ID0gc3RhcnRJbmRleDtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgYWRhcHRUb2tlbml6ZShsYW5ndWFnZTogc3RyaW5nLCBhY3R1YWw6IHsgdG9rZW5pemUobGluZTogc3RyaW5nLCBzdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IElMaW5lVG9rZW5zIH0sIGxpbmU6IHN0cmluZywgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBsYW5ndWFnZXMuVG9rZW5pemF0aW9uUmVzdWx0IHtcblx0XHRjb25zdCBhY3R1YWxSZXN1bHQgPSBhY3R1YWwudG9rZW5pemUobGluZSwgc3RhdGUpO1xuXHRcdGNvbnN0IHRva2VucyA9IFRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyLl90b0NsYXNzaWNUb2tlbnMoYWN0dWFsUmVzdWx0LnRva2VucywgbGFuZ3VhZ2UpO1xuXG5cdFx0bGV0IGVuZFN0YXRlOiBsYW5ndWFnZXMuSVN0YXRlO1xuXHRcdC8vIHRyeSB0byBzYXZlIGFuIG9iamVjdCBpZiBwb3NzaWJsZVxuXHRcdGlmIChhY3R1YWxSZXN1bHQuZW5kU3RhdGUuZXF1YWxzKHN0YXRlKSkge1xuXHRcdFx0ZW5kU3RhdGUgPSBzdGF0ZTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZW5kU3RhdGUgPSBhY3R1YWxSZXN1bHQuZW5kU3RhdGU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBsYW5ndWFnZXMuVG9rZW5pemF0aW9uUmVzdWx0KHRva2VucywgZW5kU3RhdGUpO1xuXHR9XG5cblx0cHVibGljIHRva2VuaXplKGxpbmU6IHN0cmluZywgaGFzRU9MOiBib29sZWFuLCBzdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZXN1bHQge1xuXHRcdHJldHVybiBUb2tlbml6YXRpb25TdXBwb3J0QWRhcHRlci5hZGFwdFRva2VuaXplKHRoaXMuX2xhbmd1YWdlSWQsIHRoaXMuX2FjdHVhbCwgbGluZSwgc3RhdGUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfdG9CaW5hcnlUb2tlbnMobGFuZ3VhZ2VJZENvZGVjOiBsYW5ndWFnZXMuSUxhbmd1YWdlSWRDb2RlYywgdG9rZW5zOiBJVG9rZW5bXSk6IFVpbnQzMkFycmF5IHtcblx0XHRjb25zdCBsYW5ndWFnZUlkID0gbGFuZ3VhZ2VJZENvZGVjLmVuY29kZUxhbmd1YWdlSWQodGhpcy5fbGFuZ3VhZ2VJZCk7XG5cdFx0Y29uc3QgdG9rZW5UaGVtZSA9IHRoaXMuX3N0YW5kYWxvbmVUaGVtZVNlcnZpY2UuZ2V0Q29sb3JUaGVtZSgpLnRva2VuVGhlbWU7XG5cblx0XHRjb25zdCByZXN1bHQ6IG51bWJlcltdID0gW107XG5cdFx0bGV0IHJlc3VsdExlbiA9IDA7XG5cdFx0bGV0IHByZXZpb3VzU3RhcnRJbmRleDogbnVtYmVyID0gMDtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gdG9rZW5zLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRjb25zdCB0ID0gdG9rZW5zW2ldO1xuXHRcdFx0Y29uc3QgbWV0YWRhdGEgPSB0b2tlblRoZW1lLm1hdGNoKGxhbmd1YWdlSWQsIHQuc2NvcGVzKSB8IE1ldGFkYXRhQ29uc3RzLkJBTEFOQ0VEX0JSQUNLRVRTX01BU0s7XG5cdFx0XHRpZiAocmVzdWx0TGVuID4gMCAmJiByZXN1bHRbcmVzdWx0TGVuIC0gMV0gPT09IG1ldGFkYXRhKSB7XG5cdFx0XHRcdC8vIHNhbWUgbWV0YWRhdGFcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGxldCBzdGFydEluZGV4ID0gdC5zdGFydEluZGV4O1xuXG5cdFx0XHQvLyBQcmV2ZW50IGlzc3VlcyBzdGVtbWluZyBmcm9tIGEgYnVnZ3kgZXh0ZXJuYWwgdG9rZW5pemVyLlxuXHRcdFx0aWYgKGkgPT09IDApIHtcblx0XHRcdFx0Ly8gRm9yY2UgZmlyc3QgdG9rZW4gdG8gc3RhcnQgYXQgZmlyc3QgaW5kZXghXG5cdFx0XHRcdHN0YXJ0SW5kZXggPSAwO1xuXHRcdFx0fSBlbHNlIGlmIChzdGFydEluZGV4IDwgcHJldmlvdXNTdGFydEluZGV4KSB7XG5cdFx0XHRcdC8vIEZvcmNlIHRva2VucyB0byBiZSBhZnRlciBvbmUgYW5vdGhlciFcblx0XHRcdFx0c3RhcnRJbmRleCA9IHByZXZpb3VzU3RhcnRJbmRleDtcblx0XHRcdH1cblxuXHRcdFx0cmVzdWx0W3Jlc3VsdExlbisrXSA9IHN0YXJ0SW5kZXg7XG5cdFx0XHRyZXN1bHRbcmVzdWx0TGVuKytdID0gbWV0YWRhdGE7XG5cblx0XHRcdHByZXZpb3VzU3RhcnRJbmRleCA9IHN0YXJ0SW5kZXg7XG5cdFx0fVxuXG5cdFx0Y29uc3QgYWN0dWFsUmVzdWx0ID0gbmV3IFVpbnQzMkFycmF5KHJlc3VsdExlbik7XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCByZXN1bHRMZW47IGkrKykge1xuXHRcdFx0YWN0dWFsUmVzdWx0W2ldID0gcmVzdWx0W2ldO1xuXHRcdH1cblx0XHRyZXR1cm4gYWN0dWFsUmVzdWx0O1xuXHR9XG5cblx0cHVibGljIHRva2VuaXplRW5jb2RlZChsaW5lOiBzdHJpbmcsIGhhc0VPTDogYm9vbGVhbiwgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBsYW5ndWFnZXMuRW5jb2RlZFRva2VuaXphdGlvblJlc3VsdCB7XG5cdFx0Y29uc3QgYWN0dWFsUmVzdWx0ID0gdGhpcy5fYWN0dWFsLnRva2VuaXplKGxpbmUsIHN0YXRlKTtcblx0XHRjb25zdCB0b2tlbnMgPSB0aGlzLl90b0JpbmFyeVRva2Vucyh0aGlzLl9sYW5ndWFnZVNlcnZpY2UubGFuZ3VhZ2VJZENvZGVjLCBhY3R1YWxSZXN1bHQudG9rZW5zKTtcblxuXHRcdGxldCBlbmRTdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZTtcblx0XHQvLyB0cnkgdG8gc2F2ZSBhbiBvYmplY3QgaWYgcG9zc2libGVcblx0XHRpZiAoYWN0dWFsUmVzdWx0LmVuZFN0YXRlLmVxdWFscyhzdGF0ZSkpIHtcblx0XHRcdGVuZFN0YXRlID0gc3RhdGU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGVuZFN0YXRlID0gYWN0dWFsUmVzdWx0LmVuZFN0YXRlO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgbGFuZ3VhZ2VzLkVuY29kZWRUb2tlbml6YXRpb25SZXN1bHQodG9rZW5zLCBlbmRTdGF0ZSk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIHRva2VuLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElUb2tlbiB7XG5cdHN0YXJ0SW5kZXg6IG51bWJlcjtcblx0c2NvcGVzOiBzdHJpbmc7XG59XG5cbi8qKlxuICogVGhlIHJlc3VsdCBvZiBhIGxpbmUgdG9rZW5pemF0aW9uLlxuICovXG5leHBvcnQgaW50ZXJmYWNlIElMaW5lVG9rZW5zIHtcblx0LyoqXG5cdCAqIFRoZSBsaXN0IG9mIHRva2VucyBvbiB0aGUgbGluZS5cblx0ICovXG5cdHRva2VuczogSVRva2VuW107XG5cdC8qKlxuXHQgKiBUaGUgdG9rZW5pemF0aW9uIGVuZCBzdGF0ZS5cblx0ICogQSBwb2ludGVyIHdpbGwgYmUgaGVsZCB0byB0aGlzIGFuZCB0aGUgb2JqZWN0IHNob3VsZCBub3QgYmUgbW9kaWZpZWQgYnkgdGhlIHRva2VuaXplciBhZnRlciB0aGUgcG9pbnRlciBpcyByZXR1cm5lZC5cblx0ICovXG5cdGVuZFN0YXRlOiBsYW5ndWFnZXMuSVN0YXRlO1xufVxuXG4vKipcbiAqIFRoZSByZXN1bHQgb2YgYSBsaW5lIHRva2VuaXphdGlvbi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJRW5jb2RlZExpbmVUb2tlbnMge1xuXHQvKipcblx0ICogVGhlIHRva2VucyBvbiB0aGUgbGluZSBpbiBhIGJpbmFyeSwgZW5jb2RlZCBmb3JtYXQuIEVhY2ggdG9rZW4gb2NjdXBpZXMgdHdvIGFycmF5IGluZGljZXMuIEZvciB0b2tlbiBpOlxuXHQgKiAgLSBhdCBvZmZzZXQgMippID0+IHN0YXJ0SW5kZXhcblx0ICogIC0gYXQgb2Zmc2V0IDIqaSArIDEgPT4gbWV0YWRhdGFcblx0ICogTWV0YSBkYXRhIGlzIGluIGJpbmFyeSBmb3JtYXQ6XG5cdCAqIC0gLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuXHQgKiAgICAgMzMyMiAyMjIyIDIyMjIgMTExMSAxMTExIDExMDAgMDAwMCAwMDAwXG5cdCAqICAgICAxMDk4IDc2NTQgMzIxMCA5ODc2IDU0MzIgMTA5OCA3NjU0IDMyMTBcblx0ICogLSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdCAqICAgICBiYmJiIGJiYmIgYmZmZiBmZmZmIGZmRkYgRkZUVCBMTExMIExMTExcblx0ICogLSAtLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG5cdCAqICAtIEwgPSBFbmNvZGVkTGFuZ3VhZ2VJZCAoOCBiaXRzKTogVXNlIGBnZXRFbmNvZGVkTGFuZ3VhZ2VJZGAgdG8gZ2V0IHRoZSBlbmNvZGVkIElEIG9mIGEgbGFuZ3VhZ2UuXG5cdCAqICAtIFQgPSBTdGFuZGFyZFRva2VuVHlwZSAoMiBiaXRzKTogT3RoZXIgPSAwLCBDb21tZW50ID0gMSwgU3RyaW5nID0gMiwgUmVnRXggPSAzLlxuXHQgKiAgLSBGID0gRm9udFN0eWxlICg0IGJpdHMpOiBOb25lID0gMCwgSXRhbGljID0gMSwgQm9sZCA9IDIsIFVuZGVybGluZSA9IDQsIFN0cmlrZXRocm91Z2ggPSA4LlxuXHQgKiAgLSBmID0gZm9yZWdyb3VuZCBDb2xvcklkICg5IGJpdHMpXG5cdCAqICAtIGIgPSBiYWNrZ3JvdW5kIENvbG9ySWQgKDkgYml0cylcblx0ICogIC0gVGhlIGNvbG9yIHZhbHVlIGZvciBlYWNoIGNvbG9ySWQgaXMgZGVmaW5lZCBpbiBJU3RhbmRhbG9uZVRoZW1lRGF0YS5jdXN0b21Ub2tlbkNvbG9yczpcblx0ICogZS5nLiBjb2xvcklkID0gMSBpcyBzdG9yZWQgaW4gSVN0YW5kYWxvbmVUaGVtZURhdGEuY3VzdG9tVG9rZW5Db2xvcnNbMV0uIENvbG9yIGlkID0gMCBtZWFucyBubyBjb2xvcixcblx0ICogaWQgPSAxIGlzIGZvciB0aGUgZGVmYXVsdCBmb3JlZ3JvdW5kIGNvbG9yLCBpZCA9IDIgZm9yIHRoZSBkZWZhdWx0IGJhY2tncm91bmQuXG5cdCAqL1xuXHR0b2tlbnM6IFVpbnQzMkFycmF5O1xuXHQvKipcblx0ICogVGhlIHRva2VuaXphdGlvbiBlbmQgc3RhdGUuXG5cdCAqIEEgcG9pbnRlciB3aWxsIGJlIGhlbGQgdG8gdGhpcyBhbmQgdGhlIG9iamVjdCBzaG91bGQgbm90IGJlIG1vZGlmaWVkIGJ5IHRoZSB0b2tlbml6ZXIgYWZ0ZXIgdGhlIHBvaW50ZXIgaXMgcmV0dXJuZWQuXG5cdCAqL1xuXHRlbmRTdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZTtcbn1cblxuLyoqXG4gKiBBIGZhY3RvcnkgZm9yIHRva2VuIHByb3ZpZGVycy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUb2tlbnNQcm92aWRlckZhY3Rvcnkge1xuXHRjcmVhdGUoKTogbGFuZ3VhZ2VzLlByb3ZpZGVyUmVzdWx0PFRva2Vuc1Byb3ZpZGVyIHwgRW5jb2RlZFRva2Vuc1Byb3ZpZGVyIHwgSU1vbmFyY2hMYW5ndWFnZT47XG59XG5cbi8qKlxuICogQSBcIm1hbnVhbFwiIHByb3ZpZGVyIG9mIHRva2Vucy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBUb2tlbnNQcm92aWRlciB7XG5cdC8qKlxuXHQgKiBUaGUgaW5pdGlhbCBzdGF0ZSBvZiBhIGxhbmd1YWdlLiBXaWxsIGJlIHRoZSBzdGF0ZSBwYXNzZWQgaW4gdG8gdG9rZW5pemUgdGhlIGZpcnN0IGxpbmUuXG5cdCAqL1xuXHRnZXRJbml0aWFsU3RhdGUoKTogbGFuZ3VhZ2VzLklTdGF0ZTtcblx0LyoqXG5cdCAqIFRva2VuaXplIGEgbGluZSBnaXZlbiB0aGUgc3RhdGUgYXQgdGhlIGJlZ2lubmluZyBvZiB0aGUgbGluZS5cblx0ICovXG5cdHRva2VuaXplKGxpbmU6IHN0cmluZywgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBJTGluZVRva2Vucztcbn1cblxuLyoqXG4gKiBBIFwibWFudWFsXCIgcHJvdmlkZXIgb2YgdG9rZW5zLCByZXR1cm5pbmcgdG9rZW5zIGluIGEgYmluYXJ5IGZvcm0uXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgRW5jb2RlZFRva2Vuc1Byb3ZpZGVyIHtcblx0LyoqXG5cdCAqIFRoZSBpbml0aWFsIHN0YXRlIG9mIGEgbGFuZ3VhZ2UuIFdpbGwgYmUgdGhlIHN0YXRlIHBhc3NlZCBpbiB0byB0b2tlbml6ZSB0aGUgZmlyc3QgbGluZS5cblx0ICovXG5cdGdldEluaXRpYWxTdGF0ZSgpOiBsYW5ndWFnZXMuSVN0YXRlO1xuXHQvKipcblx0ICogVG9rZW5pemUgYSBsaW5lIGdpdmVuIHRoZSBzdGF0ZSBhdCB0aGUgYmVnaW5uaW5nIG9mIHRoZSBsaW5lLlxuXHQgKi9cblx0dG9rZW5pemVFbmNvZGVkKGxpbmU6IHN0cmluZywgc3RhdGU6IGxhbmd1YWdlcy5JU3RhdGUpOiBJRW5jb2RlZExpbmVUb2tlbnM7XG5cdC8qKlxuXHQgKiBUb2tlbml6ZSBhIGxpbmUgZ2l2ZW4gdGhlIHN0YXRlIGF0IHRoZSBiZWdpbm5pbmcgb2YgdGhlIGxpbmUuXG5cdCAqL1xuXHR0b2tlbml6ZT8obGluZTogc3RyaW5nLCBzdGF0ZTogbGFuZ3VhZ2VzLklTdGF0ZSk6IElMaW5lVG9rZW5zO1xufVxuXG5mdW5jdGlvbiBpc0FUb2tlbnNQcm92aWRlcihwcm92aWRlcjogVG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXIgfCBJTW9uYXJjaExhbmd1YWdlKTogcHJvdmlkZXIgaXMgVG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXIge1xuXHRyZXR1cm4gKHR5cGVvZiBwcm92aWRlci5nZXRJbml0aWFsU3RhdGUgPT09ICdmdW5jdGlvbicpO1xufVxuXG5mdW5jdGlvbiBpc0VuY29kZWRUb2tlbnNQcm92aWRlcihwcm92aWRlcjogVG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXIpOiBwcm92aWRlciBpcyBFbmNvZGVkVG9rZW5zUHJvdmlkZXIge1xuXHRyZXR1cm4gJ3Rva2VuaXplRW5jb2RlZCcgaW4gcHJvdmlkZXI7XG59XG5cbmZ1bmN0aW9uIGlzVGhlbmFibGU8VD4ob2JqOiBhbnkpOiBvYmogaXMgVGhlbmFibGU8VD4ge1xuXHRyZXR1cm4gb2JqICYmIHR5cGVvZiBvYmoudGhlbiA9PT0gJ2Z1bmN0aW9uJztcbn1cblxuLyoqXG4gKiBDaGFuZ2UgdGhlIGNvbG9yIG1hcCB0aGF0IGlzIHVzZWQgZm9yIHRva2VuIGNvbG9ycy5cbiAqIFN1cHBvcnRlZCBmb3JtYXRzIChoZXgpOiAjUlJHR0JCLCAkUlJHR0JCQUEsICNSR0IsICNSR0JBXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzZXRDb2xvck1hcChjb2xvck1hcDogc3RyaW5nW10gfCBudWxsKTogdm9pZCB7XG5cdGNvbnN0IHN0YW5kYWxvbmVUaGVtZVNlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlKTtcblx0aWYgKGNvbG9yTWFwKSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBDb2xvcltdID0gW251bGwhXTtcblx0XHRmb3IgKGxldCBpID0gMSwgbGVuID0gY29sb3JNYXAubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdHJlc3VsdFtpXSA9IENvbG9yLmZyb21IZXgoY29sb3JNYXBbaV0pO1xuXHRcdH1cblx0XHRzdGFuZGFsb25lVGhlbWVTZXJ2aWNlLnNldENvbG9yTWFwT3ZlcnJpZGUocmVzdWx0KTtcblx0fSBlbHNlIHtcblx0XHRzdGFuZGFsb25lVGhlbWVTZXJ2aWNlLnNldENvbG9yTWFwT3ZlcnJpZGUobnVsbCk7XG5cdH1cbn1cblxuLyoqXG4gKiBAaW50ZXJuYWxcbiAqL1xuZnVuY3Rpb24gY3JlYXRlVG9rZW5pemF0aW9uU3VwcG9ydEFkYXB0ZXIobGFuZ3VhZ2VJZDogc3RyaW5nLCBwcm92aWRlcjogVG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXIpIHtcblx0aWYgKGlzRW5jb2RlZFRva2Vuc1Byb3ZpZGVyKHByb3ZpZGVyKSkge1xuXHRcdHJldHVybiBuZXcgRW5jb2RlZFRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyKGxhbmd1YWdlSWQsIHByb3ZpZGVyKTtcblx0fSBlbHNlIHtcblx0XHRyZXR1cm4gbmV3IFRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyKFxuXHRcdFx0bGFuZ3VhZ2VJZCxcblx0XHRcdHByb3ZpZGVyLFxuXHRcdFx0U3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKSxcblx0XHRcdFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2UpLFxuXHRcdCk7XG5cdH1cbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIHRva2VucyBwcm92aWRlciBmYWN0b3J5IGZvciBhIGxhbmd1YWdlLiBUaGlzIHRva2VuaXplciB3aWxsIGJlIGV4Y2x1c2l2ZSB3aXRoIGEgdG9rZW5pemVyXG4gKiBzZXQgdXNpbmcgYHNldFRva2Vuc1Byb3ZpZGVyYCBvciBvbmUgY3JlYXRlZCB1c2luZyBgc2V0TW9uYXJjaFRva2Vuc1Byb3ZpZGVyYCwgYnV0IHdpbGwgd29yayB0b2dldGhlclxuICogd2l0aCBhIHRva2VucyBwcm92aWRlciBzZXQgdXNpbmcgYHJlZ2lzdGVyRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyYCBvciBgcmVnaXN0ZXJEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcmAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclRva2Vuc1Byb3ZpZGVyRmFjdG9yeShsYW5ndWFnZUlkOiBzdHJpbmcsIGZhY3Rvcnk6IFRva2Vuc1Byb3ZpZGVyRmFjdG9yeSk6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgYWRhcHRlZEZhY3RvcnkgPSBuZXcgbGFuZ3VhZ2VzLkxhenlUb2tlbml6YXRpb25TdXBwb3J0KGFzeW5jICgpID0+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBQcm9taXNlLnJlc29sdmUoZmFjdG9yeS5jcmVhdGUoKSk7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybiBudWxsO1xuXHRcdH1cblx0XHRpZiAoaXNBVG9rZW5zUHJvdmlkZXIocmVzdWx0KSkge1xuXHRcdFx0cmV0dXJuIGNyZWF0ZVRva2VuaXphdGlvblN1cHBvcnRBZGFwdGVyKGxhbmd1YWdlSWQsIHJlc3VsdCk7XG5cdFx0fVxuXHRcdHJldHVybiBuZXcgTW9uYXJjaFRva2VuaXplcihTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZVNlcnZpY2UpLCBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElTdGFuZGFsb25lVGhlbWVTZXJ2aWNlKSwgbGFuZ3VhZ2VJZCwgY29tcGlsZShsYW5ndWFnZUlkLCByZXN1bHQpLCBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElDb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHR9KTtcblx0cmV0dXJuIGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlckZhY3RvcnkobGFuZ3VhZ2VJZCwgYWRhcHRlZEZhY3RvcnkpO1xufVxuXG4vKipcbiAqIFNldCB0aGUgdG9rZW5zIHByb3ZpZGVyIGZvciBhIGxhbmd1YWdlIChtYW51YWwgaW1wbGVtZW50YXRpb24pLiBUaGlzIHRva2VuaXplciB3aWxsIGJlIGV4Y2x1c2l2ZVxuICogd2l0aCBhIHRva2VuaXplciBjcmVhdGVkIHVzaW5nIGBzZXRNb25hcmNoVG9rZW5zUHJvdmlkZXJgLCBvciB3aXRoIGByZWdpc3RlclRva2Vuc1Byb3ZpZGVyRmFjdG9yeWAsXG4gKiBidXQgd2lsbCB3b3JrIHRvZ2V0aGVyIHdpdGggYSB0b2tlbnMgcHJvdmlkZXIgc2V0IHVzaW5nIGByZWdpc3RlckRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlcmBcbiAqIG9yIGByZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNldFRva2Vuc1Byb3ZpZGVyKGxhbmd1YWdlSWQ6IHN0cmluZywgcHJvdmlkZXI6IFRva2Vuc1Byb3ZpZGVyIHwgRW5jb2RlZFRva2Vuc1Byb3ZpZGVyIHwgVGhlbmFibGU8VG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXI+KTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZVNlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRpZiAoIWxhbmd1YWdlU2VydmljZS5pc1JlZ2lzdGVyZWRMYW5ndWFnZUlkKGxhbmd1YWdlSWQpKSB7XG5cdFx0dGhyb3cgbmV3IEVycm9yKGBDYW5ub3Qgc2V0IHRva2VucyBwcm92aWRlciBmb3IgdW5rbm93biBsYW5ndWFnZSAke2xhbmd1YWdlSWR9YCk7XG5cdH1cblx0aWYgKGlzVGhlbmFibGU8VG9rZW5zUHJvdmlkZXIgfCBFbmNvZGVkVG9rZW5zUHJvdmlkZXI+KHByb3ZpZGVyKSkge1xuXHRcdHJldHVybiByZWdpc3RlclRva2Vuc1Byb3ZpZGVyRmFjdG9yeShsYW5ndWFnZUlkLCB7IGNyZWF0ZTogKCkgPT4gcHJvdmlkZXIgfSk7XG5cdH1cblx0cmV0dXJuIGxhbmd1YWdlcy5Ub2tlbml6YXRpb25SZWdpc3RyeS5yZWdpc3RlcihsYW5ndWFnZUlkLCBjcmVhdGVUb2tlbml6YXRpb25TdXBwb3J0QWRhcHRlcihsYW5ndWFnZUlkLCBwcm92aWRlcikpO1xufVxuXG4vKipcbiAqIFNldCB0aGUgdG9rZW5zIHByb3ZpZGVyIGZvciBhIGxhbmd1YWdlIChtb25hcmNoIGltcGxlbWVudGF0aW9uKS4gVGhpcyB0b2tlbml6ZXIgd2lsbCBiZSBleGNsdXNpdmVcbiAqIHdpdGggYSB0b2tlbml6ZXIgc2V0IHVzaW5nIGBzZXRUb2tlbnNQcm92aWRlcmAsIG9yIHdpdGggYHJlZ2lzdGVyVG9rZW5zUHJvdmlkZXJGYWN0b3J5YCwgYnV0IHdpbGxcbiAqIHdvcmsgdG9nZXRoZXIgd2l0aCBhIHRva2VucyBwcm92aWRlciBzZXQgdXNpbmcgYHJlZ2lzdGVyRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyYCBvclxuICogYHJlZ2lzdGVyRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zUHJvdmlkZXJgLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc2V0TW9uYXJjaFRva2Vuc1Byb3ZpZGVyKGxhbmd1YWdlSWQ6IHN0cmluZywgbGFuZ3VhZ2VEZWY6IElNb25hcmNoTGFuZ3VhZ2UgfCBUaGVuYWJsZTxJTW9uYXJjaExhbmd1YWdlPik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgY3JlYXRlID0gKGxhbmd1YWdlRGVmOiBJTW9uYXJjaExhbmd1YWdlKSA9PiB7XG5cdFx0cmV0dXJuIG5ldyBNb25hcmNoVG9rZW5pemVyKFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlU2VydmljZSksIFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSVN0YW5kYWxvbmVUaGVtZVNlcnZpY2UpLCBsYW5ndWFnZUlkLCBjb21waWxlKGxhbmd1YWdlSWQsIGxhbmd1YWdlRGVmKSwgU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJQ29uZmlndXJhdGlvblNlcnZpY2UpKTtcblx0fTtcblx0aWYgKGlzVGhlbmFibGU8SU1vbmFyY2hMYW5ndWFnZT4obGFuZ3VhZ2VEZWYpKSB7XG5cdFx0cmV0dXJuIHJlZ2lzdGVyVG9rZW5zUHJvdmlkZXJGYWN0b3J5KGxhbmd1YWdlSWQsIHsgY3JlYXRlOiAoKSA9PiBsYW5ndWFnZURlZiB9KTtcblx0fVxuXHRyZXR1cm4gbGFuZ3VhZ2VzLlRva2VuaXphdGlvblJlZ2lzdHJ5LnJlZ2lzdGVyKGxhbmd1YWdlSWQsIGNyZWF0ZShsYW5ndWFnZURlZikpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgcmVmZXJlbmNlIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gcmVmZXJlbmNlIHNlYXJjaCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclJlZmVyZW5jZVByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuUmVmZXJlbmNlUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVmZXJlbmNlUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgcmVuYW1lIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gcmVuYW1lIHN5bWJvbCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclJlbmFtZVByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuUmVuYW1lUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVuYW1lUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgbmV3IHN5bWJvbC1uYW1lIHByb3ZpZGVyIChlLmcuLCB3aGVuIGEgc3ltYm9sIGlzIGJlaW5nIHJlbmFtZWQsIHNob3cgbmV3IHBvc3NpYmxlIHN5bWJvbC1uYW1lcylcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyTmV3U3ltYm9sTmFtZVByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuTmV3U3ltYm9sTmFtZXNQcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdHJldHVybiBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5uZXdTeW1ib2xOYW1lc1Byb3ZpZGVyLnJlZ2lzdGVyKGxhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIHNpZ25hdHVyZSBoZWxwIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gcGFyYW1ldGVyIGhpbnRzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuU2lnbmF0dXJlSGVscFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnNpZ25hdHVyZUhlbHBQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBob3ZlciBwcm92aWRlciAodXNlZCBieSBlLmcuIGVkaXRvciBob3ZlcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckhvdmVyUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5Ib3ZlclByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmhvdmVyUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3Rvciwge1xuXHRcdHByb3ZpZGVIb3ZlcjogYXN5bmMgKG1vZGVsOiBtb2RlbC5JVGV4dE1vZGVsLCBwb3NpdGlvbjogUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgY29udGV4dD86IGxhbmd1YWdlcy5Ib3ZlckNvbnRleHQ8bGFuZ3VhZ2VzLkhvdmVyPik6IFByb21pc2U8bGFuZ3VhZ2VzLkhvdmVyIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRjb25zdCB3b3JkID0gbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24ocG9zaXRpb24pO1xuXG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlPGxhbmd1YWdlcy5Ib3ZlciB8IG51bGwgfCB1bmRlZmluZWQ+KHByb3ZpZGVyLnByb3ZpZGVIb3Zlcihtb2RlbCwgcG9zaXRpb24sIHRva2VuLCBjb250ZXh0KSkudGhlbigodmFsdWUpOiBsYW5ndWFnZXMuSG92ZXIgfCB1bmRlZmluZWQgPT4ge1xuXHRcdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXZhbHVlLnJhbmdlICYmIHdvcmQpIHtcblx0XHRcdFx0XHR2YWx1ZS5yYW5nZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCB3b3JkLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCB3b3JkLmVuZENvbHVtbik7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCF2YWx1ZS5yYW5nZSkge1xuXHRcdFx0XHRcdHZhbHVlLnJhbmdlID0gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbiwgcG9zaXRpb24ubGluZU51bWJlciwgcG9zaXRpb24uY29sdW1uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdmFsdWU7XG5cdFx0XHR9KTtcblx0XHR9XG5cdH0pO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZG9jdW1lbnQgc3ltYm9sIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gb3V0bGluZSkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZG9jdW1lbnQgaGlnaGxpZ2h0IHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gaGlnaGxpZ2h0IG9jY3VycmVuY2VzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRIaWdobGlnaHRQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYW4gbGlua2VkIGVkaXRpbmcgcmFuZ2UgcHJvdmlkZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZGVmaW5pdGlvbiBwcm92aWRlciAodXNlZCBieSBlLmcuIGdvIHRvIGRlZmluaXRpb24pLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJEZWZpbml0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5EZWZpbml0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVmaW5pdGlvblByb3ZpZGVyLnJlZ2lzdGVyKGxhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIGltcGxlbWVudGF0aW9uIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gZ28gdG8gaW1wbGVtZW50YXRpb24pLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuSW1wbGVtZW50YXRpb25Qcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdHJldHVybiBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbXBsZW1lbnRhdGlvblByb3ZpZGVyLnJlZ2lzdGVyKGxhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhIHR5cGUgZGVmaW5pdGlvbiBwcm92aWRlciAodXNlZCBieSBlLmcuIGdvIHRvIHR5cGUgZGVmaW5pdGlvbikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlclR5cGVEZWZpbml0aW9uUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5UeXBlRGVmaW5pdGlvblByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnR5cGVEZWZpbml0aW9uUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY29kZSBsZW5zIHByb3ZpZGVyICh1c2VkIGJ5IGUuZy4gaW5saW5lIGNvZGUgbGVuc2VzKS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyQ29kZUxlbnNQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkNvZGVMZW5zUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBjb2RlIGFjdGlvbiBwcm92aWRlciAodXNlZCBieSBlLmcuIHF1aWNrIGZpeCkuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvZGVBY3Rpb25Qcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogQ29kZUFjdGlvblByb3ZpZGVyLCBtZXRhZGF0YT86IENvZGVBY3Rpb25Qcm92aWRlck1ldGFkYXRhKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVBY3Rpb25Qcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCB7XG5cdFx0cHJvdmlkZWRDb2RlQWN0aW9uS2luZHM6IG1ldGFkYXRhPy5wcm92aWRlZENvZGVBY3Rpb25LaW5kcyxcblx0XHRkb2N1bWVudGF0aW9uOiBtZXRhZGF0YT8uZG9jdW1lbnRhdGlvbixcblx0XHRwcm92aWRlQ29kZUFjdGlvbnM6IChtb2RlbDogbW9kZWwuSVRleHRNb2RlbCwgcmFuZ2U6IFJhbmdlLCBjb250ZXh0OiBsYW5ndWFnZXMuQ29kZUFjdGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IGxhbmd1YWdlcy5Qcm92aWRlclJlc3VsdDxsYW5ndWFnZXMuQ29kZUFjdGlvbkxpc3Q+ID0+IHtcblx0XHRcdGNvbnN0IG1hcmtlclNlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElNYXJrZXJTZXJ2aWNlKTtcblx0XHRcdGNvbnN0IG1hcmtlcnMgPSBtYXJrZXJTZXJ2aWNlLnJlYWQoeyByZXNvdXJjZTogbW9kZWwudXJpIH0pLmZpbHRlcihtID0+IHtcblx0XHRcdFx0cmV0dXJuIFJhbmdlLmFyZUludGVyc2VjdGluZ09yVG91Y2hpbmcobSwgcmFuZ2UpO1xuXHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gcHJvdmlkZXIucHJvdmlkZUNvZGVBY3Rpb25zKG1vZGVsLCByYW5nZSwgeyBtYXJrZXJzLCBvbmx5OiBjb250ZXh0Lm9ubHksIHRyaWdnZXI6IGNvbnRleHQudHJpZ2dlciB9LCB0b2tlbik7XG5cdFx0fSxcblx0XHRyZXNvbHZlQ29kZUFjdGlvbjogcHJvdmlkZXIucmVzb2x2ZUNvZGVBY3Rpb25cblx0fSk7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBmb3JtYXR0ZXIgdGhhdCBjYW4gaGFuZGxlIG9ubHkgZW50aXJlIG1vZGVscy5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBmb3JtYXR0ZXIgdGhhdCBjYW4gaGFuZGxlIGEgcmFuZ2UgaW5zaWRlIGEgbW9kZWwuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZm9ybWF0dGVyIHRoYW4gY2FuIGRvIGZvcm1hdHRpbmcgYXMgdGhlIHVzZXIgdHlwZXMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3Rlck9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5PblR5cGVGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLm9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgbGluayBwcm92aWRlciB0aGF0IGNhbiBmaW5kIGxpbmtzIGluIHRleHQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckxpbmtQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkxpbmtQcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdHJldHVybiBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5saW5rUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgY29tcGxldGlvbiBpdGVtIHByb3ZpZGVyICh1c2UgYnkgZS5nLiBzdWdnZXN0aW9ucykuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBkb2N1bWVudCBjb2xvciBwcm92aWRlciAodXNlZCBieSBDb2xvciBQaWNrZXIsIENvbG9yIERlY29yYXRvcikuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckNvbG9yUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5Eb2N1bWVudENvbG9yUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29sb3JQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBmb2xkaW5nIHJhbmdlIHByb3ZpZGVyXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckZvbGRpbmdSYW5nZVByb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuRm9sZGluZ1JhbmdlUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZm9sZGluZ1JhbmdlUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZGVjbGFyYXRpb24gcHJvdmlkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkRlY2xhcmF0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVjbGFyYXRpb25Qcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBzZWxlY3Rpb24gcmFuZ2UgcHJvdmlkZXJcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVyU2VsZWN0aW9uUmFuZ2VQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLlNlbGVjdGlvblJhbmdlUHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2Uuc2VsZWN0aW9uUmFuZ2VQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogUmVnaXN0ZXIgYSBkb2N1bWVudCBzZW1hbnRpYyB0b2tlbnMgcHJvdmlkZXIuIEEgc2VtYW50aWMgdG9rZW5zIHByb3ZpZGVyIHdpbGwgY29tcGxlbWVudCBhbmQgZW5oYW5jZSBhXG4gKiBzaW1wbGUgdG9wLWRvd24gdG9rZW5pemVyLiBTaW1wbGUgdG9wLWRvd24gdG9rZW5pemVycyBjYW4gYmUgc2V0IGVpdGhlciB2aWEgYHNldE1vbmFyY2hUb2tlbnNQcm92aWRlcmBcbiAqIG9yIGBzZXRUb2tlbnNQcm92aWRlcmAuXG4gKlxuICogRm9yIHRoZSBiZXN0IHVzZXIgZXhwZXJpZW5jZSwgcmVnaXN0ZXIgYm90aCBhIHNlbWFudGljIHRva2VucyBwcm92aWRlciBhbmQgYSB0b3AtZG93biB0b2tlbml6ZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlckRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0Y29uc3QgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBTdGFuZGFsb25lU2VydmljZXMuZ2V0KElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdHJldHVybiBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG4vKipcbiAqIFJlZ2lzdGVyIGEgZG9jdW1lbnQgcmFuZ2Ugc2VtYW50aWMgdG9rZW5zIHByb3ZpZGVyLiBBIHNlbWFudGljIHRva2VucyBwcm92aWRlciB3aWxsIGNvbXBsZW1lbnQgYW5kIGVuaGFuY2UgYVxuICogc2ltcGxlIHRvcC1kb3duIHRva2VuaXplci4gU2ltcGxlIHRvcC1kb3duIHRva2VuaXplcnMgY2FuIGJlIHNldCBlaXRoZXIgdmlhIGBzZXRNb25hcmNoVG9rZW5zUHJvdmlkZXJgXG4gKiBvciBgc2V0VG9rZW5zUHJvdmlkZXJgLlxuICpcbiAqIEZvciB0aGUgYmVzdCB1c2VyIGV4cGVyaWVuY2UsIHJlZ2lzdGVyIGJvdGggYSBzZW1hbnRpYyB0b2tlbnMgcHJvdmlkZXIgYW5kIGEgdG9wLWRvd24gdG9rZW5pemVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcihsYW5ndWFnZVNlbGVjdG9yOiBMYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcjogbGFuZ3VhZ2VzLkRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLnJlZ2lzdGVyKGxhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhbiBpbmxpbmUgY29tcGxldGlvbnMgcHJvdmlkZXIuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZWdpc3RlcklubGluZUNvbXBsZXRpb25zUHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5JbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIucmVnaXN0ZXIobGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXIpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIobGFuZ3VhZ2VTZWxlY3RvcjogTGFuZ3VhZ2VTZWxlY3RvciwgcHJvdmlkZXI6IGxhbmd1YWdlcy5JbmxpbmVFZGl0UHJvdmlkZXIpOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gU3RhbmRhbG9uZVNlcnZpY2VzLmdldChJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpO1xuXHRyZXR1cm4gbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW5saW5lRWRpdFByb3ZpZGVyLnJlZ2lzdGVyKGxhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyKTtcbn1cblxuLyoqXG4gKiBSZWdpc3RlciBhbiBpbmxheSBoaW50cyBwcm92aWRlci5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlZ2lzdGVySW5sYXlIaW50c1Byb3ZpZGVyKGxhbmd1YWdlU2VsZWN0b3I6IExhbmd1YWdlU2VsZWN0b3IsIHByb3ZpZGVyOiBsYW5ndWFnZXMuSW5sYXlIaW50c1Byb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRjb25zdCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSA9IFN0YW5kYWxvbmVTZXJ2aWNlcy5nZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKTtcblx0cmV0dXJuIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGF5SGludHNQcm92aWRlci5yZWdpc3RlcihsYW5ndWFnZVNlbGVjdG9yLCBwcm92aWRlcik7XG59XG5cbi8qKlxuICogQ29udGFpbnMgYWRkaXRpb25hbCBkaWFnbm9zdGljIGluZm9ybWF0aW9uIGFib3V0IHRoZSBjb250ZXh0IGluIHdoaWNoXG4gKiBhIFtjb2RlIGFjdGlvbl0oI0NvZGVBY3Rpb25Qcm92aWRlci5wcm92aWRlQ29kZUFjdGlvbnMpIGlzIHJ1bi5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2RlQWN0aW9uQ29udGV4dCB7XG5cblx0LyoqXG5cdCAqIEFuIGFycmF5IG9mIGRpYWdub3N0aWNzLlxuXHQgKi9cblx0cmVhZG9ubHkgbWFya2VyczogSU1hcmtlckRhdGFbXTtcblxuXHQvKipcblx0ICogUmVxdWVzdGVkIGtpbmQgb2YgYWN0aW9ucyB0byByZXR1cm4uXG5cdCAqL1xuXHRyZWFkb25seSBvbmx5Pzogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBUaGUgcmVhc29uIHdoeSBjb2RlIGFjdGlvbnMgd2VyZSByZXF1ZXN0ZWQuXG5cdCAqL1xuXHRyZWFkb25seSB0cmlnZ2VyOiBsYW5ndWFnZXMuQ29kZUFjdGlvblRyaWdnZXJUeXBlO1xufVxuXG4vKipcbiAqIFRoZSBjb2RlIGFjdGlvbiBpbnRlcmZhY2UgZGVmaW5lcyB0aGUgY29udHJhY3QgYmV0d2VlbiBleHRlbnNpb25zIGFuZFxuICogdGhlIFtsaWdodCBidWxiXShodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9kb2NzL2VkaXRvci9lZGl0aW5nZXZvbHZlZCNfY29kZS1hY3Rpb24pIGZlYXR1cmUuXG4gKi9cbmV4cG9ydCBpbnRlcmZhY2UgQ29kZUFjdGlvblByb3ZpZGVyIHtcblx0LyoqXG5cdCAqIFByb3ZpZGUgY29tbWFuZHMgZm9yIHRoZSBnaXZlbiBkb2N1bWVudCBhbmQgcmFuZ2UuXG5cdCAqL1xuXHRwcm92aWRlQ29kZUFjdGlvbnMobW9kZWw6IG1vZGVsLklUZXh0TW9kZWwsIHJhbmdlOiBSYW5nZSwgY29udGV4dDogQ29kZUFjdGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IGxhbmd1YWdlcy5Qcm92aWRlclJlc3VsdDxsYW5ndWFnZXMuQ29kZUFjdGlvbkxpc3Q+O1xuXG5cdC8qKlxuXHQgKiBHaXZlbiBhIGNvZGUgYWN0aW9uIGZpbGwgaW4gdGhlIGVkaXQuIFdpbGwgb25seSBpbnZva2VkIHdoZW4gbWlzc2luZy5cblx0ICovXG5cdHJlc29sdmVDb2RlQWN0aW9uPyhjb2RlQWN0aW9uOiBsYW5ndWFnZXMuQ29kZUFjdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogbGFuZ3VhZ2VzLlByb3ZpZGVyUmVzdWx0PGxhbmd1YWdlcy5Db2RlQWN0aW9uPjtcbn1cblxuXG5cbi8qKlxuICogTWV0YWRhdGEgYWJvdXQgdGhlIHR5cGUgb2YgY29kZSBhY3Rpb25zIHRoYXQgYSB7QGxpbmsgQ29kZUFjdGlvblByb3ZpZGVyfSBwcm92aWRlcy5cbiAqL1xuZXhwb3J0IGludGVyZmFjZSBDb2RlQWN0aW9uUHJvdmlkZXJNZXRhZGF0YSB7XG5cdC8qKlxuXHQgKiBMaXN0IG9mIGNvZGUgYWN0aW9uIGtpbmRzIHRoYXQgYSB7QGxpbmsgQ29kZUFjdGlvblByb3ZpZGVyfSBtYXkgcmV0dXJuLlxuXHQgKlxuXHQgKiBUaGlzIGxpc3QgaXMgdXNlZCB0byBkZXRlcm1pbmUgaWYgYSBnaXZlbiBgQ29kZUFjdGlvblByb3ZpZGVyYCBzaG91bGQgYmUgaW52b2tlZCBvciBub3QuXG5cdCAqIFRvIGF2b2lkIHVubmVjZXNzYXJ5IGNvbXB1dGF0aW9uLCBldmVyeSBgQ29kZUFjdGlvblByb3ZpZGVyYCBzaG91bGQgbGlzdCB1c2UgYHByb3ZpZGVkQ29kZUFjdGlvbktpbmRzYC4gVGhlXG5cdCAqIGxpc3Qgb2Yga2luZHMgbWF5IGVpdGhlciBiZSBnZW5lcmljLCBzdWNoIGFzIGBbXCJxdWlja2ZpeFwiLCBcInJlZmFjdG9yXCIsIFwic291cmNlXCJdYCwgb3IgbGlzdCBvdXQgZXZlcnkga2luZCBwcm92aWRlZCxcblx0ICogc3VjaCBhcyBgW1wicXVpY2tmaXgucmVtb3ZlTGluZVwiLCBcInNvdXJjZS5maXhBbGxcIiAuLi5dYC5cblx0ICovXG5cdHJlYWRvbmx5IHByb3ZpZGVkQ29kZUFjdGlvbktpbmRzPzogcmVhZG9ubHkgc3RyaW5nW107XG5cblx0cmVhZG9ubHkgZG9jdW1lbnRhdGlvbj86IFJlYWRvbmx5QXJyYXk8eyByZWFkb25seSBraW5kOiBzdHJpbmc7IHJlYWRvbmx5IGNvbW1hbmQ6IGxhbmd1YWdlcy5Db21tYW5kIH0+O1xufVxuXG4vKipcbiAqIEBpbnRlcm5hbFxuICovXG5leHBvcnQgZnVuY3Rpb24gY3JlYXRlTW9uYWNvTGFuZ3VhZ2VzQVBJKCk6IHR5cGVvZiBtb25hY28ubGFuZ3VhZ2VzIHtcblx0cmV0dXJuIHtcblx0XHRyZWdpc3RlcjogPGFueT5yZWdpc3Rlcixcblx0XHRnZXRMYW5ndWFnZXM6IDxhbnk+Z2V0TGFuZ3VhZ2VzLFxuXHRcdG9uTGFuZ3VhZ2U6IDxhbnk+b25MYW5ndWFnZSxcblx0XHRvbkxhbmd1YWdlRW5jb3VudGVyZWQ6IDxhbnk+b25MYW5ndWFnZUVuY291bnRlcmVkLFxuXHRcdGdldEVuY29kZWRMYW5ndWFnZUlkOiA8YW55PmdldEVuY29kZWRMYW5ndWFnZUlkLFxuXG5cdFx0Ly8gcHJvdmlkZXIgbWV0aG9kc1xuXHRcdHNldExhbmd1YWdlQ29uZmlndXJhdGlvbjogPGFueT5zZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24sXG5cdFx0c2V0Q29sb3JNYXA6IHNldENvbG9yTWFwLFxuXHRcdHJlZ2lzdGVyVG9rZW5zUHJvdmlkZXJGYWN0b3J5OiA8YW55PnJlZ2lzdGVyVG9rZW5zUHJvdmlkZXJGYWN0b3J5LFxuXHRcdHNldFRva2Vuc1Byb3ZpZGVyOiA8YW55PnNldFRva2Vuc1Byb3ZpZGVyLFxuXHRcdHNldE1vbmFyY2hUb2tlbnNQcm92aWRlcjogPGFueT5zZXRNb25hcmNoVG9rZW5zUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJSZWZlcmVuY2VQcm92aWRlcjogPGFueT5yZWdpc3RlclJlZmVyZW5jZVByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyUmVuYW1lUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJSZW5hbWVQcm92aWRlcixcblx0XHRyZWdpc3Rlck5ld1N5bWJvbE5hbWVQcm92aWRlcjogPGFueT5yZWdpc3Rlck5ld1N5bWJvbE5hbWVQcm92aWRlcixcblx0XHRyZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyOiA8YW55PnJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVySG92ZXJQcm92aWRlcjogPGFueT5yZWdpc3RlckhvdmVyUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJEb2N1bWVudFN5bWJvbFByb3ZpZGVyOiA8YW55PnJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcixcblx0XHRyZWdpc3RlckRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJMaW5rZWRFZGl0aW5nUmFuZ2VQcm92aWRlcixcblx0XHRyZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcjogPGFueT5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcixcblx0XHRyZWdpc3RlckltcGxlbWVudGF0aW9uUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyVHlwZURlZmluaXRpb25Qcm92aWRlcjogPGFueT5yZWdpc3RlclR5cGVEZWZpbml0aW9uUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyOiA8YW55PnJlZ2lzdGVyQ29kZUxlbnNQcm92aWRlcixcblx0XHRyZWdpc3RlckNvZGVBY3Rpb25Qcm92aWRlcjogPGFueT5yZWdpc3RlckNvZGVBY3Rpb25Qcm92aWRlcixcblx0XHRyZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcjogPGFueT5yZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcixcblx0XHRyZWdpc3RlckRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyOiA8YW55PnJlZ2lzdGVyRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJPblR5cGVGb3JtYXR0aW5nRWRpdFByb3ZpZGVyOiA8YW55PnJlZ2lzdGVyT25UeXBlRm9ybWF0dGluZ0VkaXRQcm92aWRlcixcblx0XHRyZWdpc3RlckxpbmtQcm92aWRlcjogPGFueT5yZWdpc3RlckxpbmtQcm92aWRlcixcblx0XHRyZWdpc3RlckNvbG9yUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJDb2xvclByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyRm9sZGluZ1JhbmdlUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJGb2xkaW5nUmFuZ2VQcm92aWRlcixcblx0XHRyZWdpc3RlckRlY2xhcmF0aW9uUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJEZWNsYXJhdGlvblByb3ZpZGVyLFxuXHRcdHJlZ2lzdGVyU2VsZWN0aW9uUmFuZ2VQcm92aWRlcjogPGFueT5yZWdpc3RlclNlbGVjdGlvblJhbmdlUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcjogPGFueT5yZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLFxuXHRcdHJlZ2lzdGVySW5saW5lQ29tcGxldGlvbnNQcm92aWRlcjogPGFueT5yZWdpc3RlcklubGluZUNvbXBsZXRpb25zUHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIsXG5cdFx0cmVnaXN0ZXJJbmxheUhpbnRzUHJvdmlkZXI6IDxhbnk+cmVnaXN0ZXJJbmxheUhpbnRzUHJvdmlkZXIsXG5cblx0XHQvLyBlbnVtc1xuXHRcdERvY3VtZW50SGlnaGxpZ2h0S2luZDogc3RhbmRhbG9uZUVudW1zLkRvY3VtZW50SGlnaGxpZ2h0S2luZCxcblx0XHRDb21wbGV0aW9uSXRlbUtpbmQ6IHN0YW5kYWxvbmVFbnVtcy5Db21wbGV0aW9uSXRlbUtpbmQsXG5cdFx0Q29tcGxldGlvbkl0ZW1UYWc6IHN0YW5kYWxvbmVFbnVtcy5Db21wbGV0aW9uSXRlbVRhZyxcblx0XHRDb21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlOiBzdGFuZGFsb25lRW51bXMuQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZSxcblx0XHRTeW1ib2xLaW5kOiBzdGFuZGFsb25lRW51bXMuU3ltYm9sS2luZCxcblx0XHRTeW1ib2xUYWc6IHN0YW5kYWxvbmVFbnVtcy5TeW1ib2xUYWcsXG5cdFx0SW5kZW50QWN0aW9uOiBzdGFuZGFsb25lRW51bXMuSW5kZW50QWN0aW9uLFxuXHRcdENvbXBsZXRpb25UcmlnZ2VyS2luZDogc3RhbmRhbG9uZUVudW1zLkNvbXBsZXRpb25UcmlnZ2VyS2luZCxcblx0XHRTaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQ6IHN0YW5kYWxvbmVFbnVtcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQsXG5cdFx0SW5sYXlIaW50S2luZDogc3RhbmRhbG9uZUVudW1zLklubGF5SGludEtpbmQsXG5cdFx0SW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kOiBzdGFuZGFsb25lRW51bXMuSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLFxuXHRcdElubGluZUVkaXRUcmlnZ2VyS2luZDogc3RhbmRhbG9uZUVudW1zLklubGluZUVkaXRUcmlnZ2VyS2luZCxcblx0XHRDb2RlQWN0aW9uVHJpZ2dlclR5cGU6IHN0YW5kYWxvbmVFbnVtcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUsXG5cdFx0TmV3U3ltYm9sTmFtZVRhZzogc3RhbmRhbG9uZUVudW1zLk5ld1N5bWJvbE5hbWVUYWcsXG5cdFx0TmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kOiBzdGFuZGFsb25lRW51bXMuTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLFxuXHRcdFBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZDogc3RhbmRhbG9uZUVudW1zLlBhcnRpYWxBY2NlcHRUcmlnZ2VyS2luZCxcblx0XHRIb3ZlclZlcmJvc2l0eUFjdGlvbjogc3RhbmRhbG9uZUVudW1zLkhvdmVyVmVyYm9zaXR5QWN0aW9uLFxuXG5cdFx0Ly8gY2xhc3Nlc1xuXHRcdEZvbGRpbmdSYW5nZUtpbmQ6IGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2VLaW5kLFxuXHRcdFNlbGVjdGVkU3VnZ2VzdGlvbkluZm86IDxhbnk+bGFuZ3VhZ2VzLlNlbGVjdGVkU3VnZ2VzdGlvbkluZm8sXG5cdH07XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLGFBQWE7QUFHdEIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsc0JBQXNCO0FBQy9CLFlBQVksZUFBZTtBQUMzQixTQUFrQyx3QkFBd0I7QUFFMUQsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUyxxQkFBcUI7QUFHOUIsU0FBUyxnQ0FBZ0M7QUFDekMsWUFBWSxxQkFBcUI7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQXNCLHNCQUFzQjtBQUtyQyxTQUFTLFNBQVMsVUFBeUM7QUFHakUsZ0JBQWMsaUJBQWlCLFFB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
