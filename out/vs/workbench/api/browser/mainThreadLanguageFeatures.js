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
import { createStringDataTransferItem, VSDataTransfer } from "../../../base/common/dataTransfer.js";
import { CancellationError } from "../../../base/common/errors.js";
import { Emitter } from "../../../base/common/event.js";
import { HierarchicalKind } from "../../../base/common/hierarchicalKind.js";
import { combinedDisposable, Disposable, DisposableMap, toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap } from "../../../base/common/map.js";
import { revive } from "../../../base/common/marshalling.js";
import { mixin } from "../../../base/common/objects.js";
import { URI } from "../../../base/common/uri.js";
import * as languages from "../../../editor/common/languages.js";
import { ILanguageService } from "../../../editor/common/languages/language.js";
import { ILanguageConfigurationService } from "../../../editor/common/languages/languageConfigurationRegistry.js";
import { ILanguageFeaturesService } from "../../../editor/common/services/languageFeatures.js";
import { decodeSemanticTokensDto } from "../../../editor/common/services/semanticTokensDto.js";
import { IUriIdentityService } from "../../../platform/uriIdentity/common/uriIdentity.js";
import { reviveWorkspaceEditDto } from "./mainThreadBulkEdits.js";
import * as typeConvert from "../common/extHostTypeConverters.js";
import { DataTransferFileCache } from "../common/shared/dataTransferCache.js";
import * as callh from "../../contrib/callHierarchy/common/callHierarchy.js";
import * as search from "../../contrib/search/common/search.js";
import * as typeh from "../../contrib/typeHierarchy/common/typeHierarchy.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { ExtHostContext, ISuggestDataDtoField, ISuggestResultDtoField, MainContext } from "../common/extHost.protocol.js";
let MainThreadLanguageFeatures = class extends Disposable {
  constructor(extHostContext, _languageService, _languageConfigurationService, _languageFeaturesService, _uriIdentService) {
    super();
    this._languageService = _languageService;
    this._languageConfigurationService = _languageConfigurationService;
    this._languageFeaturesService = _languageFeaturesService;
    this._uriIdentService = _uriIdentService;
    this._registrations = this._register(new DisposableMap());
    // --- copy paste action provider
    this._pasteEditProviders = /* @__PURE__ */ new Map();
    // --- document drop Edits
    this._documentOnDropEditProviders = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostLanguageFeatures);
    if (this._languageService) {
      const updateAllWordDefinitions = () => {
        const wordDefinitionDtos = [];
        for (const languageId of _languageService.getRegisteredLanguageIds()) {
          const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(languageId).getWordDefinition();
          wordDefinitionDtos.push({
            languageId,
            regexSource: wordDefinition.source,
            regexFlags: wordDefinition.flags
          });
        }
        this._proxy.$setWordDefinitions(wordDefinitionDtos);
      };
      this._register(this._languageConfigurationService.onDidChange((e) => {
        if (!e.languageId) {
          updateAllWordDefinitions();
        } else {
          const wordDefinition = this._languageConfigurationService.getLanguageConfiguration(e.languageId).getWordDefinition();
          this._proxy.$setWordDefinitions([{
            languageId: e.languageId,
            regexSource: wordDefinition.source,
            regexFlags: wordDefinition.flags
          }]);
        }
      }));
      updateAllWordDefinitions();
    }
  }
  $unregister(handle) {
    this._registrations.deleteAndDispose(handle);
  }
  static _reviveLocationDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach((l) => MainThreadLanguageFeatures._reviveLocationDto(l));
      return data;
    } else {
      data.uri = URI.revive(data.uri);
      return data;
    }
  }
  static _reviveLocationLinkDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach((l) => MainThreadLanguageFeatures._reviveLocationLinkDto(l));
      return data;
    } else {
      data.uri = URI.revive(data.uri);
      return data;
    }
  }
  static _reviveWorkspaceSymbolDto(data) {
    if (!data) {
      return data;
    } else if (Array.isArray(data)) {
      data.forEach(MainThreadLanguageFeatures._reviveWorkspaceSymbolDto);
      return data;
    } else {
      data.location = MainThreadLanguageFeatures._reviveLocationDto(data.location);
      return data;
    }
  }
  static _reviveCodeActionDto(data, uriIdentService) {
    data?.forEach((code) => reviveWorkspaceEditDto(code.edit, uriIdentService));
    return data;
  }
  static _reviveLinkDTO(data) {
    if (data.url && typeof data.url !== "string") {
      data.url = URI.revive(data.url);
    }
    return data;
  }
  static _reviveCallHierarchyItemDto(data) {
    if (data) {
      data.uri = URI.revive(data.uri);
    }
    return data;
  }
  static _reviveTypeHierarchyItemDto(data) {
    if (data) {
      data.uri = URI.revive(data.uri);
    }
    return data;
  }
  //#endregion
  // --- outline
  $registerDocumentSymbolProvider(handle, selector, displayName) {
    this._registrations.set(handle, this._languageFeaturesService.documentSymbolProvider.register(selector, {
      displayName,
      provideDocumentSymbols: (model, token) => {
        return this._proxy.$provideDocumentSymbols(handle, model.uri, token);
      }
    }));
  }
  // --- code lens
  $registerCodeLensSupport(handle, selector, eventHandle) {
    const provider = {
      provideCodeLenses: async (model, token) => {
        const listDto = await this._proxy.$provideCodeLenses(handle, model.uri, token);
        if (!listDto) {
          return void 0;
        }
        return {
          lenses: listDto.lenses,
          dispose: () => listDto.cacheId && this._proxy.$releaseCodeLenses(handle, listDto.cacheId)
        };
      },
      resolveCodeLens: async (model, codeLens, token) => {
        const result = await this._proxy.$resolveCodeLens(handle, codeLens, token);
        if (!result) {
          return void 0;
        }
        return {
          ...result,
          range: model.validateRange(result.range)
        };
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChange = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.codeLensProvider.register(selector, provider));
  }
  $emitCodeLensEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // --- declaration
  $registerDefinitionSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.definitionProvider.register(selector, {
      provideDefinition: (model, position, token) => {
        return this._proxy.$provideDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerDeclarationSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.declarationProvider.register(selector, {
      provideDeclaration: (model, position, token) => {
        return this._proxy.$provideDeclaration(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerImplementationSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.implementationProvider.register(selector, {
      provideImplementation: (model, position, token) => {
        return this._proxy.$provideImplementation(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  $registerTypeDefinitionSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.typeDefinitionProvider.register(selector, {
      provideTypeDefinition: (model, position, token) => {
        return this._proxy.$provideTypeDefinition(handle, model.uri, position, token).then(MainThreadLanguageFeatures._reviveLocationLinkDto);
      }
    }));
  }
  // --- extra info
  $registerHoverProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.hoverProvider.register(selector, {
      provideHover: async (model, position, token, context) => {
        const serializedContext = {
          verbosityRequest: context?.verbosityRequest ? {
            verbosityDelta: context.verbosityRequest.verbosityDelta,
            previousHover: { id: context.verbosityRequest.previousHover.id }
          } : void 0
        };
        const hover = await this._proxy.$provideHover(handle, model.uri, position, serializedContext, token);
        return hover;
      }
    }));
  }
  // --- debug hover
  $registerEvaluatableExpressionProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.evaluatableExpressionProvider.register(selector, {
      provideEvaluatableExpression: (model, position, token) => {
        return this._proxy.$provideEvaluatableExpression(handle, model.uri, position, token);
      }
    }));
  }
  // --- inline values
  $registerInlineValuesProvider(handle, selector, eventHandle) {
    const provider = {
      provideInlineValues: (model, viewPort, context, token) => {
        return this._proxy.$provideInlineValues(handle, model.uri, viewPort, context, token);
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChangeInlineValues = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.inlineValuesProvider.register(selector, provider));
  }
  $emitInlineValuesEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // --- occurrences
  $registerDocumentHighlightProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.documentHighlightProvider.register(selector, {
      provideDocumentHighlights: (model, position, token) => {
        return this._proxy.$provideDocumentHighlights(handle, model.uri, position, token);
      }
    }));
  }
  $registerMultiDocumentHighlightProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.multiDocumentHighlightProvider.register(selector, {
      selector,
      provideMultiDocumentHighlights: (model, position, otherModels, token) => {
        return this._proxy.$provideMultiDocumentHighlights(handle, model.uri, position, otherModels.map((model2) => model2.uri), token).then((dto) => {
          if (dto === void 0 || dto === null) {
            return void 0;
          }
          const result = new ResourceMap();
          dto?.forEach((value) => {
            const uri = URI.revive(value.uri);
            if (result.has(uri)) {
              result.get(uri).push(...value.highlights);
            } else {
              result.set(uri, value.highlights);
            }
          });
          return result;
        });
      }
    }));
  }
  // --- linked editing
  $registerLinkedEditingRangeProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.linkedEditingRangeProvider.register(selector, {
      provideLinkedEditingRanges: async (model, position, token) => {
        const res = await this._proxy.$provideLinkedEditingRanges(handle, model.uri, position, token);
        if (res) {
          return {
            ranges: res.ranges,
            wordPattern: res.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(res.wordPattern) : void 0
          };
        }
        return void 0;
      }
    }));
  }
  // --- references
  $registerReferenceSupport(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.referenceProvider.register(selector, {
      provideReferences: (model, position, context, token) => {
        return this._proxy.$provideReferences(handle, model.uri, position, context, token).then(MainThreadLanguageFeatures._reviveLocationDto);
      }
    }));
  }
  // --- code actions
  $registerCodeActionSupport(handle, selector, metadata, displayName, extensionId, supportsResolve) {
    const provider = {
      provideCodeActions: async (model, rangeOrSelection, context, token) => {
        const listDto = await this._proxy.$provideCodeActions(handle, model.uri, rangeOrSelection, context, token);
        if (!listDto) {
          return void 0;
        }
        return {
          actions: MainThreadLanguageFeatures._reviveCodeActionDto(listDto.actions, this._uriIdentService),
          dispose: () => {
            if (typeof listDto.cacheId === "number") {
              this._proxy.$releaseCodeActions(handle, listDto.cacheId);
            }
          }
        };
      },
      providedCodeActionKinds: metadata.providedKinds,
      documentation: metadata.documentation,
      displayName,
      extensionId
    };
    if (supportsResolve) {
      provider.resolveCodeAction = async (codeAction, token) => {
        const resolved = await this._proxy.$resolveCodeAction(handle, codeAction.cacheId, token);
        if (resolved.edit) {
          codeAction.edit = reviveWorkspaceEditDto(resolved.edit, this._uriIdentService);
        }
        if (resolved.command) {
          codeAction.command = resolved.command;
        }
        return codeAction;
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.codeActionProvider.register(selector, provider));
  }
  $registerPasteEditProvider(handle, selector, metadata) {
    const provider = new MainThreadPasteEditProvider(handle, this._proxy, metadata, this._uriIdentService);
    this._pasteEditProviders.set(handle, provider);
    this._registrations.set(handle, combinedDisposable(
      this._languageFeaturesService.documentPasteEditProvider.register(selector, provider),
      toDisposable(() => this._pasteEditProviders.delete(handle))
    ));
  }
  $resolvePasteFileData(handle, requestId, dataId) {
    const provider = this._pasteEditProviders.get(handle);
    if (!provider) {
      throw new Error("Could not find provider");
    }
    return provider.resolveFileData(requestId, dataId);
  }
  // --- formatting
  $registerDocumentFormattingSupport(handle, selector, extensionId, displayName) {
    this._registrations.set(handle, this._languageFeaturesService.documentFormattingEditProvider.register(selector, {
      extensionId,
      displayName,
      provideDocumentFormattingEdits: (model, options, token) => {
        return this._proxy.$provideDocumentFormattingEdits(handle, model.uri, options, token);
      }
    }));
  }
  $registerRangeFormattingSupport(handle, selector, extensionId, displayName, supportsRanges) {
    this._registrations.set(handle, this._languageFeaturesService.documentRangeFormattingEditProvider.register(selector, {
      extensionId,
      displayName,
      provideDocumentRangeFormattingEdits: (model, range, options, token) => {
        return this._proxy.$provideDocumentRangeFormattingEdits(handle, model.uri, range, options, token);
      },
      provideDocumentRangesFormattingEdits: !supportsRanges ? void 0 : (model, ranges, options, token) => {
        return this._proxy.$provideDocumentRangesFormattingEdits(handle, model.uri, ranges, options, token);
      }
    }));
  }
  $registerOnTypeFormattingSupport(handle, selector, autoFormatTriggerCharacters, extensionId) {
    this._registrations.set(handle, this._languageFeaturesService.onTypeFormattingEditProvider.register(selector, {
      extensionId,
      autoFormatTriggerCharacters,
      provideOnTypeFormattingEdits: (model, position, ch, options, token) => {
        return this._proxy.$provideOnTypeFormattingEdits(handle, model.uri, position, ch, options, token);
      }
    }));
  }
  // --- navigate type
  $registerNavigateTypeSupport(handle, supportsResolve) {
    let lastResultId;
    const provider = {
      provideWorkspaceSymbols: async (search2, token) => {
        const result = await this._proxy.$provideWorkspaceSymbols(handle, search2, token);
        if (lastResultId !== void 0) {
          this._proxy.$releaseWorkspaceSymbols(handle, lastResultId);
        }
        lastResultId = result.cacheId;
        return MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(result.symbols);
      }
    };
    if (supportsResolve) {
      provider.resolveWorkspaceSymbol = async (item, token) => {
        const resolvedItem = await this._proxy.$resolveWorkspaceSymbol(handle, item, token);
        return resolvedItem && MainThreadLanguageFeatures._reviveWorkspaceSymbolDto(resolvedItem);
      };
    }
    this._registrations.set(handle, search.WorkspaceSymbolProviderRegistry.register(provider));
  }
  // --- rename
  $registerRenameSupport(handle, selector, supportResolveLocation) {
    this._registrations.set(handle, this._languageFeaturesService.renameProvider.register(selector, {
      provideRenameEdits: (model, position, newName, token) => {
        return this._proxy.$provideRenameEdits(handle, model.uri, position, newName, token).then((data) => reviveWorkspaceEditDto(data, this._uriIdentService));
      },
      resolveRenameLocation: supportResolveLocation ? (model, position, token) => this._proxy.$resolveRenameLocation(handle, model.uri, position, token) : void 0
    }));
  }
  $registerNewSymbolNamesProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.newSymbolNamesProvider.register(selector, {
      supportsAutomaticNewSymbolNamesTriggerKind: this._proxy.$supportsAutomaticNewSymbolNamesTriggerKind(handle),
      provideNewSymbolNames: (model, range, triggerKind, token) => {
        return this._proxy.$provideNewSymbolNames(handle, model.uri, range, triggerKind, token);
      }
    }));
  }
  // --- semantic tokens
  $registerDocumentSemanticTokensProvider(handle, selector, legend, eventHandle) {
    let event = void 0;
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      event = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.documentSemanticTokensProvider.register(selector, new MainThreadDocumentSemanticTokensProvider(this._proxy, handle, legend, event)));
  }
  $emitDocumentSemanticTokensEvent(eventHandle) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(void 0);
    }
  }
  $registerDocumentRangeSemanticTokensProvider(handle, selector, legend) {
    this._registrations.set(handle, this._languageFeaturesService.documentRangeSemanticTokensProvider.register(selector, new MainThreadDocumentRangeSemanticTokensProvider(this._proxy, handle, legend)));
  }
  // --- suggest
  static _inflateSuggestDto(defaultRange, data, extensionId) {
    const label = data[ISuggestDataDtoField.label];
    const commandId = data[ISuggestDataDtoField.commandId];
    const commandIdent = data[ISuggestDataDtoField.commandIdent];
    const commitChars = data[ISuggestDataDtoField.commitCharacters];
    let command;
    if (commandId) {
      command = {
        $ident: commandIdent,
        id: commandId,
        title: "",
        arguments: commandIdent ? [commandIdent] : data[ISuggestDataDtoField.commandArguments]
        // Automatically fill in ident as first argument
      };
    }
    return {
      label,
      extensionId,
      kind: data[ISuggestDataDtoField.kind] ?? languages.CompletionItemKind.Property,
      tags: data[ISuggestDataDtoField.kindModifier],
      detail: data[ISuggestDataDtoField.detail],
      documentation: data[ISuggestDataDtoField.documentation],
      sortText: data[ISuggestDataDtoField.sortText],
      filterText: data[ISuggestDataDtoField.filterText],
      preselect: data[ISuggestDataDtoField.preselect],
      insertText: data[ISuggestDataDtoField.insertText] ?? (typeof label === "string" ? label : label.label),
      range: data[ISuggestDataDtoField.range] ?? defaultRange,
      insertTextRules: data[ISuggestDataDtoField.insertTextRules],
      commitCharacters: commitChars ? Array.from(commitChars) : void 0,
      additionalTextEdits: data[ISuggestDataDtoField.additionalTextEdits],
      command,
      // not-standard
      _id: data.x
    };
  }
  $registerCompletionsProvider(handle, selector, triggerCharacters, supportsResolveDetails, extensionId) {
    const provider = {
      triggerCharacters,
      _debugDisplayName: `${extensionId.value}(${triggerCharacters.join("")})`,
      provideCompletionItems: async (model, position, context, token) => {
        const result = await this._proxy.$provideCompletionItems(handle, model.uri, position, context, token);
        if (!result) {
          return result;
        }
        return {
          suggestions: result[ISuggestResultDtoField.completions].map((d) => MainThreadLanguageFeatures._inflateSuggestDto(result[ISuggestResultDtoField.defaultRanges], d, extensionId)),
          incomplete: result[ISuggestResultDtoField.isIncomplete] || false,
          duration: result[ISuggestResultDtoField.duration],
          dispose: () => {
            if (typeof result.x === "number") {
              this._proxy.$releaseCompletionItems(handle, result.x);
            }
          }
        };
      }
    };
    if (supportsResolveDetails) {
      provider.resolveCompletionItem = (suggestion, token) => {
        return this._proxy.$resolveCompletionItem(handle, suggestion._id, token).then((result) => {
          if (!result) {
            return suggestion;
          }
          const newSuggestion = MainThreadLanguageFeatures._inflateSuggestDto(suggestion.range, result, extensionId);
          return mixin(suggestion, newSuggestion, true);
        });
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.completionProvider.register(selector, provider));
  }
  $registerInlineCompletionsSupport(handle, selector, supportsHandleEvents, extensionId, yieldsToExtensionIds, displayName, debounceDelayMs) {
    const provider = {
      provideInlineCompletions: async (model, position, context, token) => {
        return this._proxy.$provideInlineCompletions(handle, model.uri, position, context, token);
      },
      provideInlineEditsForRange: async (model, range, context, token) => {
        return this._proxy.$provideInlineEditsForRange(handle, model.uri, range, context, token);
      },
      handleItemDidShow: async (completions, item, updatedInsertText) => {
        if (supportsHandleEvents) {
          await this._proxy.$handleInlineCompletionDidShow(handle, completions.pid, item.idx, updatedInsertText);
        }
      },
      handlePartialAccept: async (completions, item, acceptedCharacters, info) => {
        if (supportsHandleEvents) {
          await this._proxy.$handleInlineCompletionPartialAccept(handle, completions.pid, item.idx, acceptedCharacters, info);
        }
      },
      freeInlineCompletions: (completions) => {
        this._proxy.$freeInlineCompletionsList(handle, completions.pid);
      },
      handleRejection: async (completions, item) => {
        if (supportsHandleEvents) {
          await this._proxy.$handleInlineCompletionRejection(handle, completions.pid, item.idx);
        }
      },
      groupId: extensionId,
      yieldsToGroupIds: yieldsToExtensionIds,
      debounceDelayMs,
      displayName,
      toString() {
        return `InlineCompletionsProvider(${extensionId})`;
      }
    };
    this._registrations.set(handle, this._languageFeaturesService.inlineCompletionsProvider.register(selector, provider));
  }
  $registerInlineEditProvider(handle, selector, extensionId, displayName) {
    const provider = {
      displayName,
      provideInlineEdit: async (model, context, token) => {
        return this._proxy.$provideInlineEdit(handle, model.uri, context, token);
      },
      freeInlineEdit: (edit) => {
        this._proxy.$freeInlineEdit(handle, edit.pid);
      }
    };
    this._registrations.set(handle, this._languageFeaturesService.inlineEditProvider.register(selector, provider));
  }
  // --- parameter hints
  $registerSignatureHelpProvider(handle, selector, metadata) {
    this._registrations.set(handle, this._languageFeaturesService.signatureHelpProvider.register(selector, {
      signatureHelpTriggerCharacters: metadata.triggerCharacters,
      signatureHelpRetriggerCharacters: metadata.retriggerCharacters,
      provideSignatureHelp: async (model, position, token, context) => {
        const result = await this._proxy.$provideSignatureHelp(handle, model.uri, position, context, token);
        if (!result) {
          return void 0;
        }
        return {
          value: result,
          dispose: () => {
            this._proxy.$releaseSignatureHelp(handle, result.id);
          }
        };
      }
    }));
  }
  // --- inline hints
  $registerInlayHintsProvider(handle, selector, supportsResolve, eventHandle, displayName) {
    const provider = {
      displayName,
      provideInlayHints: async (model, range, token) => {
        const result = await this._proxy.$provideInlayHints(handle, model.uri, range, token);
        if (!result) {
          return;
        }
        return {
          hints: revive(result.hints),
          dispose: () => {
            if (result.cacheId) {
              this._proxy.$releaseInlayHints(handle, result.cacheId);
            }
          }
        };
      }
    };
    if (supportsResolve) {
      provider.resolveInlayHint = async (hint, token) => {
        const dto = hint;
        if (!dto.cacheId) {
          return hint;
        }
        const result = await this._proxy.$resolveInlayHint(handle, dto.cacheId, token);
        if (token.isCancellationRequested) {
          throw new CancellationError();
        }
        if (!result) {
          return hint;
        }
        return {
          ...hint,
          tooltip: result.tooltip,
          label: revive(result.label),
          textEdits: result.textEdits
        };
      };
    }
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChangeInlayHints = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.inlayHintsProvider.register(selector, provider));
  }
  $emitInlayHintsEvent(eventHandle) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(void 0);
    }
  }
  // --- links
  $registerDocumentLinkProvider(handle, selector, supportsResolve) {
    const provider = {
      provideLinks: (model, token) => {
        return this._proxy.$provideDocumentLinks(handle, model.uri, token).then((dto) => {
          if (!dto) {
            return void 0;
          }
          return {
            links: dto.links.map(MainThreadLanguageFeatures._reviveLinkDTO),
            dispose: () => {
              if (typeof dto.cacheId === "number") {
                this._proxy.$releaseDocumentLinks(handle, dto.cacheId);
              }
            }
          };
        });
      }
    };
    if (supportsResolve) {
      provider.resolveLink = (link, token) => {
        const dto = link;
        if (!dto.cacheId) {
          return link;
        }
        return this._proxy.$resolveDocumentLink(handle, dto.cacheId, token).then((obj) => {
          return obj && MainThreadLanguageFeatures._reviveLinkDTO(obj);
        });
      };
    }
    this._registrations.set(handle, this._languageFeaturesService.linkProvider.register(selector, provider));
  }
  // --- colors
  $registerDocumentColorProvider(handle, selector) {
    const proxy = this._proxy;
    this._registrations.set(handle, this._languageFeaturesService.colorProvider.register(selector, {
      provideDocumentColors: (model, token) => {
        return proxy.$provideDocumentColors(handle, model.uri, token).then((documentColors) => {
          return documentColors.map((documentColor) => {
            const [red, green, blue, alpha] = documentColor.color;
            const color = {
              red,
              green,
              blue,
              alpha
            };
            return {
              color,
              range: documentColor.range
            };
          });
        });
      },
      provideColorPresentations: (model, colorInfo, token) => {
        return proxy.$provideColorPresentations(handle, model.uri, {
          color: [colorInfo.color.red, colorInfo.color.green, colorInfo.color.blue, colorInfo.color.alpha],
          range: colorInfo.range
        }, token);
      }
    }));
  }
  // --- folding
  $registerFoldingRangeProvider(handle, selector, extensionId, eventHandle) {
    const provider = {
      id: extensionId.value,
      provideFoldingRanges: (model, context, token) => {
        return this._proxy.$provideFoldingRanges(handle, model.uri, context, token);
      }
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._registrations.set(eventHandle, emitter);
      provider.onDidChange = emitter.event;
    }
    this._registrations.set(handle, this._languageFeaturesService.foldingRangeProvider.register(selector, provider));
  }
  $emitFoldingRangeEvent(eventHandle, event) {
    const obj = this._registrations.get(eventHandle);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  // -- smart select
  $registerSelectionRangeProvider(handle, selector) {
    this._registrations.set(handle, this._languageFeaturesService.selectionRangeProvider.register(selector, {
      provideSelectionRanges: (model, positions, token) => {
        return this._proxy.$provideSelectionRanges(handle, model.uri, positions, token);
      }
    }));
  }
  // --- call hierarchy
  $registerCallHierarchyProvider(handle, selector) {
    this._registrations.set(handle, callh.CallHierarchyProviderRegistry.register(selector, {
      prepareCallHierarchy: async (document, position, token) => {
        const items = await this._proxy.$prepareCallHierarchy(handle, document.uri, position, token);
        if (!items || items.length === 0) {
          return void 0;
        }
        return {
          dispose: () => {
            for (const item of items) {
              this._proxy.$releaseCallHierarchy(handle, item._sessionId);
            }
          },
          roots: items.map(MainThreadLanguageFeatures._reviveCallHierarchyItemDto)
        };
      },
      provideOutgoingCalls: async (item, token) => {
        const outgoing = await this._proxy.$provideCallHierarchyOutgoingCalls(handle, item._sessionId, item._itemId, token);
        if (!outgoing) {
          return outgoing;
        }
        outgoing.forEach((value) => {
          value.to = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.to);
        });
        return outgoing;
      },
      provideIncomingCalls: async (item, token) => {
        const incoming = await this._proxy.$provideCallHierarchyIncomingCalls(handle, item._sessionId, item._itemId, token);
        if (!incoming) {
          return incoming;
        }
        incoming.forEach((value) => {
          value.from = MainThreadLanguageFeatures._reviveCallHierarchyItemDto(value.from);
        });
        return incoming;
      }
    }));
  }
  // --- configuration
  static _reviveRegExp(regExp) {
    return new RegExp(regExp.pattern, regExp.flags);
  }
  static _reviveIndentationRule(indentationRule) {
    return {
      decreaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.decreaseIndentPattern),
      increaseIndentPattern: MainThreadLanguageFeatures._reviveRegExp(indentationRule.increaseIndentPattern),
      indentNextLinePattern: indentationRule.indentNextLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.indentNextLinePattern) : void 0,
      unIndentedLinePattern: indentationRule.unIndentedLinePattern ? MainThreadLanguageFeatures._reviveRegExp(indentationRule.unIndentedLinePattern) : void 0
    };
  }
  static _reviveOnEnterRule(onEnterRule) {
    return {
      beforeText: MainThreadLanguageFeatures._reviveRegExp(onEnterRule.beforeText),
      afterText: onEnterRule.afterText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.afterText) : void 0,
      previousLineText: onEnterRule.previousLineText ? MainThreadLanguageFeatures._reviveRegExp(onEnterRule.previousLineText) : void 0,
      action: onEnterRule.action
    };
  }
  static _reviveOnEnterRules(onEnterRules) {
    return onEnterRules.map(MainThreadLanguageFeatures._reviveOnEnterRule);
  }
  $setLanguageConfiguration(handle, languageId, _configuration) {
    const configuration = {
      comments: _configuration.comments,
      brackets: _configuration.brackets,
      wordPattern: _configuration.wordPattern ? MainThreadLanguageFeatures._reviveRegExp(_configuration.wordPattern) : void 0,
      indentationRules: _configuration.indentationRules ? MainThreadLanguageFeatures._reviveIndentationRule(_configuration.indentationRules) : void 0,
      onEnterRules: _configuration.onEnterRules ? MainThreadLanguageFeatures._reviveOnEnterRules(_configuration.onEnterRules) : void 0,
      autoClosingPairs: void 0,
      surroundingPairs: void 0,
      __electricCharacterSupport: void 0
    };
    if (_configuration.autoClosingPairs) {
      configuration.autoClosingPairs = _configuration.autoClosingPairs;
    } else if (_configuration.__characterPairSupport) {
      configuration.autoClosingPairs = _configuration.__characterPairSupport.autoClosingPairs;
    }
    if (_configuration.__electricCharacterSupport && _configuration.__electricCharacterSupport.docComment) {
      configuration.__electricCharacterSupport = {
        docComment: {
          open: _configuration.__electricCharacterSupport.docComment.open,
          close: _configuration.__electricCharacterSupport.docComment.close
        }
      };
    }
    if (this._languageService.isRegisteredLanguageId(languageId)) {
      this._registrations.set(handle, this._languageConfigurationService.register(languageId, configuration, 100));
    }
  }
  // --- type hierarchy
  $registerTypeHierarchyProvider(handle, selector) {
    this._registrations.set(handle, typeh.TypeHierarchyProviderRegistry.register(selector, {
      prepareTypeHierarchy: async (document, position, token) => {
        const items = await this._proxy.$prepareTypeHierarchy(handle, document.uri, position, token);
        if (!items) {
          return void 0;
        }
        return {
          dispose: () => {
            for (const item of items) {
              this._proxy.$releaseTypeHierarchy(handle, item._sessionId);
            }
          },
          roots: items.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto)
        };
      },
      provideSupertypes: async (item, token) => {
        const supertypes = await this._proxy.$provideTypeHierarchySupertypes(handle, item._sessionId, item._itemId, token);
        if (!supertypes) {
          return supertypes;
        }
        return supertypes.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto);
      },
      provideSubtypes: async (item, token) => {
        const subtypes = await this._proxy.$provideTypeHierarchySubtypes(handle, item._sessionId, item._itemId, token);
        if (!subtypes) {
          return subtypes;
        }
        return subtypes.map(MainThreadLanguageFeatures._reviveTypeHierarchyItemDto);
      }
    }));
  }
  $registerDocumentOnDropEditProvider(handle, selector, metadata) {
    const provider = new MainThreadDocumentOnDropEditProvider(handle, this._proxy, metadata, this._uriIdentService);
    this._documentOnDropEditProviders.set(handle, provider);
    this._registrations.set(handle, combinedDisposable(
      this._languageFeaturesService.documentDropEditProvider.register(selector, provider),
      toDisposable(() => this._documentOnDropEditProviders.delete(handle))
    ));
  }
  async $resolveDocumentOnDropFileData(handle, requestId, dataId) {
    const provider = this._documentOnDropEditProviders.get(handle);
    if (!provider) {
      throw new Error("Could not find provider");
    }
    return provider.resolveDocumentOnDropFileData(requestId, dataId);
  }
};
MainThreadLanguageFeatures = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadLanguageFeatures),
  __decorateParam(1, ILanguageService),
  __decorateParam(2, ILanguageConfigurationService),
  __decorateParam(3, ILanguageFeaturesService),
  __decorateParam(4, IUriIdentityService)
], MainThreadLanguageFeatures);
let MainThreadPasteEditProvider = class {
  constructor(_handle, _proxy, metadata, _uriIdentService) {
    this._handle = _handle;
    this._proxy = _proxy;
    this._uriIdentService = _uriIdentService;
    this.dataTransfers = new DataTransferFileCache();
    this.copyMimeTypes = metadata.copyMimeTypes ?? [];
    this.pasteMimeTypes = metadata.pasteMimeTypes ?? [];
    this.providedPasteEditKinds = metadata.providedPasteEditKinds?.map((kind) => new HierarchicalKind(kind)) ?? [];
    if (metadata.supportsCopy) {
      this.prepareDocumentPaste = async (model, selections, dataTransfer, token) => {
        const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
        if (token.isCancellationRequested) {
          return void 0;
        }
        const newDataTransfer = await this._proxy.$prepareDocumentPaste(_handle, model.uri, selections, dataTransferDto, token);
        if (!newDataTransfer) {
          return void 0;
        }
        const dataTransferOut = new VSDataTransfer();
        for (const [type, item] of newDataTransfer.items) {
          dataTransferOut.replace(type, createStringDataTransferItem(item.asString, item.id));
        }
        return dataTransferOut;
      };
    }
    if (metadata.supportsPaste) {
      this.provideDocumentPasteEdits = async (model, selections, dataTransfer, context, token) => {
        const request = this.dataTransfers.add(dataTransfer);
        try {
          const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
          if (token.isCancellationRequested) {
            return;
          }
          const edits = await this._proxy.$providePasteEdits(this._handle, request.id, model.uri, selections, dataTransferDto, {
            only: context.only?.value,
            triggerKind: context.triggerKind
          }, token);
          if (!edits) {
            return;
          }
          return {
            edits: edits.map((edit) => {
              return {
                ...edit,
                kind: edit.kind ? new HierarchicalKind(edit.kind.value) : new HierarchicalKind(""),
                yieldTo: edit.yieldTo?.map((x) => ({ kind: new HierarchicalKind(x) })),
                additionalEdit: edit.additionalEdit ? reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, (dataId) => this.resolveFileData(request.id, dataId)) : void 0
              };
            }),
            dispose: () => {
              this._proxy.$releasePasteEdits(this._handle, request.id);
            }
          };
        } finally {
          request.dispose();
        }
      };
    }
    if (metadata.supportsResolve) {
      this.resolveDocumentPasteEdit = async (edit, token) => {
        const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
        if (typeof resolved.insertText !== "undefined") {
          edit.insertText = resolved.insertText;
        }
        if (resolved.additionalEdit) {
          edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
        }
        return edit;
      };
    }
  }
  resolveFileData(requestId, dataId) {
    return this.dataTransfers.resolveFileData(requestId, dataId);
  }
};
MainThreadPasteEditProvider = __decorateClass([
  __decorateParam(3, IUriIdentityService)
], MainThreadPasteEditProvider);
let MainThreadDocumentOnDropEditProvider = class {
  constructor(_handle, _proxy, metadata, _uriIdentService) {
    this._handle = _handle;
    this._proxy = _proxy;
    this._uriIdentService = _uriIdentService;
    this.dataTransfers = new DataTransferFileCache();
    this.dropMimeTypes = metadata?.dropMimeTypes ?? ["*/*"];
    this.providedDropEditKinds = metadata?.providedDropKinds?.map((kind) => new HierarchicalKind(kind));
    if (metadata?.supportsResolve) {
      this.resolveDocumentDropEdit = async (edit, token) => {
        const resolved = await this._proxy.$resolvePasteEdit(this._handle, edit._cacheId, token);
        if (resolved.additionalEdit) {
          edit.additionalEdit = reviveWorkspaceEditDto(resolved.additionalEdit, this._uriIdentService);
        }
        return edit;
      };
    }
  }
  async provideDocumentDropEdits(model, position, dataTransfer, token) {
    const request = this.dataTransfers.add(dataTransfer);
    try {
      const dataTransferDto = await typeConvert.DataTransfer.fromList(dataTransfer);
      if (token.isCancellationRequested) {
        return;
      }
      const edits = await this._proxy.$provideDocumentOnDropEdits(this._handle, request.id, model.uri, position, dataTransferDto, token);
      if (!edits) {
        return;
      }
      return {
        edits: edits.map((edit) => {
          return {
            ...edit,
            yieldTo: edit.yieldTo?.map((x) => ({ kind: new HierarchicalKind(x) })),
            kind: edit.kind ? new HierarchicalKind(edit.kind) : void 0,
            additionalEdit: reviveWorkspaceEditDto(edit.additionalEdit, this._uriIdentService, (dataId) => this.resolveDocumentOnDropFileData(request.id, dataId))
          };
        }),
        dispose: () => {
          this._proxy.$releaseDocumentOnDropEdits(this._handle, request.id);
        }
      };
    } finally {
      request.dispose();
    }
  }
  resolveDocumentOnDropFileData(requestId, dataId) {
    return this.dataTransfers.resolveFileData(requestId, dataId);
  }
};
MainThreadDocumentOnDropEditProvider = __decorateClass([
  __decorateParam(3, IUriIdentityService)
], MainThreadDocumentOnDropEditProvider);
class MainThreadDocumentSemanticTokensProvider {
  constructor(_proxy, _handle, _legend, onDidChange) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._legend = _legend;
    this.onDidChange = onDidChange;
  }
  releaseDocumentSemanticTokens(resultId) {
    if (resultId) {
      this._proxy.$releaseDocumentSemanticTokens(this._handle, parseInt(resultId, 10));
    }
  }
  getLegend() {
    return this._legend;
  }
  async provideDocumentSemanticTokens(model, lastResultId, token) {
    const nLastResultId = lastResultId ? parseInt(lastResultId, 10) : 0;
    const encodedDto = await this._proxy.$provideDocumentSemanticTokens(this._handle, model.uri, nLastResultId, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    const dto = decodeSemanticTokensDto(encodedDto);
    if (dto.type === "full") {
      return {
        resultId: String(dto.id),
        data: dto.data
      };
    }
    return {
      resultId: String(dto.id),
      edits: dto.deltas
    };
  }
}
class MainThreadDocumentRangeSemanticTokensProvider {
  constructor(_proxy, _handle, _legend) {
    this._proxy = _proxy;
    this._handle = _handle;
    this._legend = _legend;
  }
  getLegend() {
    return this._legend;
  }
  async provideDocumentRangeSemanticTokens(model, range, token) {
    const encodedDto = await this._proxy.$provideDocumentRangeSemanticTokens(this._handle, model.uri, range, token);
    if (!encodedDto) {
      return null;
    }
    if (token.isCancellationRequested) {
      return null;
    }
    const dto = decodeSemanticTokensDto(encodedDto);
    if (dto.type === "full") {
      return {
        resultId: String(dto.id),
        data: dto.data
      };
    }
    throw new Error(`Unexpected`);
  }
}
export {
  MainThreadDocumentRangeSemanticTokensProvider,
  MainThreadDocumentSemanticTokensProvider,
  MainThreadLanguageFeatures
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTdHJpbmdEYXRhVHJhbnNmZXJJdGVtLCBJUmVhZG9ubHlWU0RhdGFUcmFuc2ZlciwgVlNEYXRhVHJhbnNmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9kYXRhVHJhbnNmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBIaWVyYXJjaGljYWxLaW5kIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaGllcmFyY2hpY2FsS2luZC5qcyc7XG5pbXBvcnQgeyBjb21iaW5lZERpc3Bvc2FibGUsIERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBtaXhpbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIGFzIEVkaXRvclBvc2l0aW9uLCBJUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcG9zaXRpb24uanMnO1xuaW1wb3J0IHsgUmFuZ2UgYXMgRWRpdG9yUmFuZ2UsIElSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBTZWxlY3Rpb24gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvc2VsZWN0aW9uLmpzJztcbmltcG9ydCAqIGFzIGxhbmd1YWdlcyBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0IHsgSW5kZW50YXRpb25SdWxlLCBMYW5ndWFnZUNvbmZpZ3VyYXRpb24sIE9uRW50ZXJSdWxlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2VDb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IGRlY29kZVNlbWFudGljVG9rZW5zRHRvIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9zZW1hbnRpY1Rva2Vuc0R0by5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IHJldml2ZVdvcmtzcGFjZUVkaXREdG8gfSBmcm9tICcuL21haW5UaHJlYWRCdWxrRWRpdHMuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnQgZnJvbSAnLi4vY29tbW9uL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgeyBEYXRhVHJhbnNmZXJGaWxlQ2FjaGUgfSBmcm9tICcuLi9jb21tb24vc2hhcmVkL2RhdGFUcmFuc2ZlckNhY2hlLmpzJztcbmltcG9ydCAqIGFzIGNhbGxoIGZyb20gJy4uLy4uL2NvbnRyaWIvY2FsbEhpZXJhcmNoeS9jb21tb24vY2FsbEhpZXJhcmNoeS5qcyc7XG5pbXBvcnQgKiBhcyBzZWFyY2ggZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlaCBmcm9tICcuLi8uLi9jb250cmliL3R5cGVIaWVyYXJjaHkvY29tbW9uL3R5cGVIaWVyYXJjaHkuanMnO1xuaW1wb3J0IHsgZXh0SG9zdE5hbWVkQ3VzdG9tZXIsIElFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dEhvc3RDdXN0b21lcnMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbnRleHQsIEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzU2hhcGUsIEhvdmVyV2l0aElkLCBJQ2FsbEhpZXJhcmNoeUl0ZW1EdG8sIElDb2RlQWN0aW9uRHRvLCBJQ29kZUFjdGlvblByb3ZpZGVyTWV0YWRhdGFEdG8sIElkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb24sIElkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb25zLCBJZGVudGlmaWFibGVJbmxpbmVFZGl0LCBJRG9jdW1lbnREcm9wRWRpdER0bywgSURvY3VtZW50RHJvcEVkaXRQcm92aWRlck1ldGFkYXRhLCBJRG9jdW1lbnRGaWx0ZXJEdG8sIElJbmRlbnRhdGlvblJ1bGVEdG8sIElJbmxheUhpbnREdG8sIElMYW5ndWFnZUNvbmZpZ3VyYXRpb25EdG8sIElMYW5ndWFnZVdvcmREZWZpbml0aW9uRHRvLCBJTGlua0R0bywgSUxvY2F0aW9uRHRvLCBJTG9jYXRpb25MaW5rRHRvLCBJT25FbnRlclJ1bGVEdG8sIElQYXN0ZUVkaXREdG8sIElQYXN0ZUVkaXRQcm92aWRlck1ldGFkYXRhRHRvLCBJUmVnRXhwRHRvLCBJU2lnbmF0dXJlSGVscFByb3ZpZGVyTWV0YWRhdGFEdG8sIElTdWdnZXN0RGF0YUR0bywgSVN1Z2dlc3REYXRhRHRvRmllbGQsIElTdWdnZXN0UmVzdWx0RHRvRmllbGQsIElUeXBlSGllcmFyY2h5SXRlbUR0bywgSVdvcmtzcGFjZVN5bWJvbER0bywgTWFpbkNvbnRleHQsIE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzU2hhcGUgfSBmcm9tICcuLi9jb21tb24vZXh0SG9zdC5wcm90b2NvbC5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcylcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcyBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlc1NoYXBlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdExhbmd1YWdlRmVhdHVyZXNTaGFwZTtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cmF0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPG51bWJlcj4oKSk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZXh0SG9zdENvbnRleHQ6IElFeHRIb3N0Q29udGV4dCxcblx0XHRASUxhbmd1YWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2U6IElMYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF91cmlJZGVudFNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMpO1xuXG5cdFx0aWYgKHRoaXMuX2xhbmd1YWdlU2VydmljZSkge1xuXHRcdFx0Y29uc3QgdXBkYXRlQWxsV29yZERlZmluaXRpb25zID0gKCkgPT4ge1xuXHRcdFx0XHRjb25zdCB3b3JkRGVmaW5pdGlvbkR0b3M6IElMYW5ndWFnZVdvcmREZWZpbml0aW9uRHRvW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBsYW5ndWFnZUlkIG9mIF9sYW5ndWFnZVNlcnZpY2UuZ2V0UmVnaXN0ZXJlZExhbmd1YWdlSWRzKCkpIHtcblx0XHRcdFx0XHRjb25zdCB3b3JkRGVmaW5pdGlvbiA9IHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UuZ2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGxhbmd1YWdlSWQpLmdldFdvcmREZWZpbml0aW9uKCk7XG5cdFx0XHRcdFx0d29yZERlZmluaXRpb25EdG9zLnB1c2goe1xuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZDogbGFuZ3VhZ2VJZCxcblx0XHRcdFx0XHRcdHJlZ2V4U291cmNlOiB3b3JkRGVmaW5pdGlvbi5zb3VyY2UsXG5cdFx0XHRcdFx0XHRyZWdleEZsYWdzOiB3b3JkRGVmaW5pdGlvbi5mbGFnc1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRzZXRXb3JkRGVmaW5pdGlvbnMod29yZERlZmluaXRpb25EdG9zKTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRcdGlmICghZS5sYW5ndWFnZUlkKSB7XG5cdFx0XHRcdFx0dXBkYXRlQWxsV29yZERlZmluaXRpb25zKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3Qgd29yZERlZmluaXRpb24gPSB0aGlzLl9sYW5ndWFnZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldExhbmd1YWdlQ29uZmlndXJhdGlvbihlLmxhbmd1YWdlSWQpLmdldFdvcmREZWZpbml0aW9uKCk7XG5cdFx0XHRcdFx0dGhpcy5fcHJveHkuJHNldFdvcmREZWZpbml0aW9ucyhbe1xuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZDogZS5sYW5ndWFnZUlkLFxuXHRcdFx0XHRcdFx0cmVnZXhTb3VyY2U6IHdvcmREZWZpbml0aW9uLnNvdXJjZSxcblx0XHRcdFx0XHRcdHJlZ2V4RmxhZ3M6IHdvcmREZWZpbml0aW9uLmZsYWdzXG5cdFx0XHRcdFx0fV0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHR1cGRhdGVBbGxXb3JkRGVmaW5pdGlvbnMoKTtcblx0XHR9XG5cdH1cblxuXHQkdW5yZWdpc3RlcihoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuZGVsZXRlQW5kRGlzcG9zZShoYW5kbGUpO1xuXHR9XG5cblx0Ly8jcmVnaW9uIC0tLSByZXZpdmUgZnVuY3Rpb25zXG5cblx0cHJpdmF0ZSBzdGF0aWMgX3Jldml2ZUxvY2F0aW9uRHRvKGRhdGE/OiBJTG9jYXRpb25EdG8pOiBsYW5ndWFnZXMuTG9jYXRpb247XG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVMb2NhdGlvbkR0byhkYXRhPzogSUxvY2F0aW9uRHRvW10pOiBsYW5ndWFnZXMuTG9jYXRpb25bXTtcblx0cHJpdmF0ZSBzdGF0aWMgX3Jldml2ZUxvY2F0aW9uRHRvKGRhdGE6IElMb2NhdGlvbkR0byB8IElMb2NhdGlvbkR0b1tdIHwgdW5kZWZpbmVkKTogbGFuZ3VhZ2VzLkxvY2F0aW9uIHwgbGFuZ3VhZ2VzLkxvY2F0aW9uW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIGRhdGE7XG5cdFx0fSBlbHNlIGlmIChBcnJheS5pc0FycmF5KGRhdGEpKSB7XG5cdFx0XHRkYXRhLmZvckVhY2gobCA9PiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlTG9jYXRpb25EdG8obCkpO1xuXHRcdFx0cmV0dXJuIDxsYW5ndWFnZXMuTG9jYXRpb25bXT5kYXRhO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLnVyaSA9IFVSSS5yZXZpdmUoZGF0YS51cmkpO1xuXHRcdFx0cmV0dXJuIDxsYW5ndWFnZXMuTG9jYXRpb24+ZGF0YTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmV2aXZlTG9jYXRpb25MaW5rRHRvKGRhdGE6IElMb2NhdGlvbkxpbmtEdG8pOiBsYW5ndWFnZXMuTG9jYXRpb25MaW5rO1xuXHRwcml2YXRlIHN0YXRpYyBfcmV2aXZlTG9jYXRpb25MaW5rRHRvKGRhdGE6IElMb2NhdGlvbkxpbmtEdG9bXSk6IGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXTtcblx0cHJpdmF0ZSBzdGF0aWMgX3Jldml2ZUxvY2F0aW9uTGlua0R0byhkYXRhOiBJTG9jYXRpb25MaW5rRHRvIHwgSUxvY2F0aW9uTGlua0R0b1tdKTogbGFuZ3VhZ2VzLkxvY2F0aW9uTGluayB8IGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXSB7XG5cdFx0aWYgKCFkYXRhKSB7XG5cdFx0XHRyZXR1cm4gPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbms+ZGF0YTtcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcblx0XHRcdGRhdGEuZm9yRWFjaChsID0+IE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLl9yZXZpdmVMb2NhdGlvbkxpbmtEdG8obCkpO1xuXHRcdFx0cmV0dXJuIDxsYW5ndWFnZXMuTG9jYXRpb25MaW5rW10+ZGF0YTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZGF0YS51cmkgPSBVUkkucmV2aXZlKGRhdGEudXJpKTtcblx0XHRcdHJldHVybiA8bGFuZ3VhZ2VzLkxvY2F0aW9uTGluaz5kYXRhO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVXb3Jrc3BhY2VTeW1ib2xEdG8oZGF0YTogSVdvcmtzcGFjZVN5bWJvbER0byk6IHNlYXJjaC5JV29ya3NwYWNlU3ltYm9sO1xuXHRwcml2YXRlIHN0YXRpYyBfcmV2aXZlV29ya3NwYWNlU3ltYm9sRHRvKGRhdGE6IElXb3Jrc3BhY2VTeW1ib2xEdG9bXSk6IHNlYXJjaC5JV29ya3NwYWNlU3ltYm9sW107XG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVXb3Jrc3BhY2VTeW1ib2xEdG8oZGF0YTogdW5kZWZpbmVkKTogdW5kZWZpbmVkO1xuXHRwcml2YXRlIHN0YXRpYyBfcmV2aXZlV29ya3NwYWNlU3ltYm9sRHRvKGRhdGE6IElXb3Jrc3BhY2VTeW1ib2xEdG8gfCBJV29ya3NwYWNlU3ltYm9sRHRvW10gfCB1bmRlZmluZWQpOiBzZWFyY2guSVdvcmtzcGFjZVN5bWJvbCB8IHNlYXJjaC5JV29ya3NwYWNlU3ltYm9sW10gfCB1bmRlZmluZWQge1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0cmV0dXJuIDx1bmRlZmluZWQ+ZGF0YTtcblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZGF0YSkpIHtcblx0XHRcdGRhdGEuZm9yRWFjaChNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlV29ya3NwYWNlU3ltYm9sRHRvKTtcblx0XHRcdHJldHVybiA8c2VhcmNoLklXb3Jrc3BhY2VTeW1ib2xbXT5kYXRhO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkYXRhLmxvY2F0aW9uID0gTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZUxvY2F0aW9uRHRvKGRhdGEubG9jYXRpb24pO1xuXHRcdFx0cmV0dXJuIDxzZWFyY2guSVdvcmtzcGFjZVN5bWJvbD5kYXRhO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVDb2RlQWN0aW9uRHRvKGRhdGE6IFJlYWRvbmx5QXJyYXk8SUNvZGVBY3Rpb25EdG8+LCB1cmlJZGVudFNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UpOiBsYW5ndWFnZXMuQ29kZUFjdGlvbltdIHtcblx0XHRkYXRhPy5mb3JFYWNoKGNvZGUgPT4gcmV2aXZlV29ya3NwYWNlRWRpdER0byhjb2RlLmVkaXQsIHVyaUlkZW50U2VydmljZSkpO1xuXHRcdHJldHVybiA8bGFuZ3VhZ2VzLkNvZGVBY3Rpb25bXT5kYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3Jldml2ZUxpbmtEVE8oZGF0YTogSUxpbmtEdG8pOiBsYW5ndWFnZXMuSUxpbmsge1xuXHRcdGlmIChkYXRhLnVybCAmJiB0eXBlb2YgZGF0YS51cmwgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRkYXRhLnVybCA9IFVSSS5yZXZpdmUoZGF0YS51cmwpO1xuXHRcdH1cblx0XHRyZXR1cm4gPGxhbmd1YWdlcy5JTGluaz5kYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3Jldml2ZUNhbGxIaWVyYXJjaHlJdGVtRHRvKGRhdGE6IElDYWxsSGllcmFyY2h5SXRlbUR0byB8IHVuZGVmaW5lZCk6IGNhbGxoLkNhbGxIaWVyYXJjaHlJdGVtIHtcblx0XHRpZiAoZGF0YSkge1xuXHRcdFx0ZGF0YS51cmkgPSBVUkkucmV2aXZlKGRhdGEudXJpKTtcblx0XHR9XG5cdFx0cmV0dXJuIGRhdGEgYXMgY2FsbGguQ2FsbEhpZXJhcmNoeUl0ZW07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfcmV2aXZlVHlwZUhpZXJhcmNoeUl0ZW1EdG8oZGF0YTogSVR5cGVIaWVyYXJjaHlJdGVtRHRvIHwgdW5kZWZpbmVkKTogdHlwZWguVHlwZUhpZXJhcmNoeUl0ZW0ge1xuXHRcdGlmIChkYXRhKSB7XG5cdFx0XHRkYXRhLnVyaSA9IFVSSS5yZXZpdmUoZGF0YS51cmkpO1xuXHRcdH1cblx0XHRyZXR1cm4gZGF0YSBhcyB0eXBlaC5UeXBlSGllcmFyY2h5SXRlbTtcblx0fVxuXG5cdC8vI2VuZHJlZ2lvblxuXG5cdC8vIC0tLSBvdXRsaW5lXG5cblx0JHJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCBkaXNwbGF5TmFtZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRkaXNwbGF5TmFtZSxcblx0XHRcdHByb3ZpZGVEb2N1bWVudFN5bWJvbHM6IChtb2RlbDogSVRleHRNb2RlbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRG9jdW1lbnRTeW1ib2xbXSB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVEb2N1bWVudFN5bWJvbHMoaGFuZGxlLCBtb2RlbC51cmksIHRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gY29kZSBsZW5zXG5cblx0JHJlZ2lzdGVyQ29kZUxlbnNTdXBwb3J0KGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIGV2ZW50SGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblxuXHRcdGNvbnN0IHByb3ZpZGVyOiBsYW5ndWFnZXMuQ29kZUxlbnNQcm92aWRlciA9IHtcblx0XHRcdHByb3ZpZGVDb2RlTGVuc2VzOiBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkNvZGVMZW5zTGlzdCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCBsaXN0RHRvID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVDb2RlTGVuc2VzKGhhbmRsZSwgbW9kZWwudXJpLCB0b2tlbik7XG5cdFx0XHRcdGlmICghbGlzdER0bykge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRsZW5zZXM6IGxpc3REdG8ubGVuc2VzLFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IGxpc3REdG8uY2FjaGVJZCAmJiB0aGlzLl9wcm94eS4kcmVsZWFzZUNvZGVMZW5zZXMoaGFuZGxlLCBsaXN0RHRvLmNhY2hlSWQpXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0cmVzb2x2ZUNvZGVMZW5zOiBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwsIGNvZGVMZW5zOiBsYW5ndWFnZXMuQ29kZUxlbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkNvZGVMZW5zIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3Byb3h5LiRyZXNvbHZlQ29kZUxlbnMoaGFuZGxlLCBjb2RlTGVucywgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHQuLi5yZXN1bHQsXG5cdFx0XHRcdFx0cmFuZ2U6IG1vZGVsLnZhbGlkYXRlUmFuZ2UocmVzdWx0LnJhbmdlKSxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBldmVudEhhbmRsZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxsYW5ndWFnZXMuQ29kZUxlbnNQcm92aWRlcj4oKTtcblx0XHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGV2ZW50SGFuZGxlLCBlbWl0dGVyKTtcblx0XHRcdHByb3ZpZGVyLm9uRGlkQ2hhbmdlID0gZW1pdHRlci5ldmVudDtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVMZW5zUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHByb3ZpZGVyKSk7XG5cdH1cblxuXHQkZW1pdENvZGVMZW5zRXZlbnQoZXZlbnRIYW5kbGU6IG51bWJlciwgZXZlbnQ/OiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBvYmogPSB0aGlzLl9yZWdpc3RyYXRpb25zLmdldChldmVudEhhbmRsZSk7XG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIEVtaXR0ZXIpIHtcblx0XHRcdG9iai5maXJlKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gZGVjbGFyYXRpb25cblxuXHQkcmVnaXN0ZXJEZWZpbml0aW9uU3VwcG9ydChoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kZWZpbml0aW9uUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHtcblx0XHRcdHByb3ZpZGVEZWZpbml0aW9uOiAobW9kZWwsIHBvc2l0aW9uLCB0b2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkxvY2F0aW9uTGlua1tdPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZURlZmluaXRpb24oaGFuZGxlLCBtb2RlbC51cmksIHBvc2l0aW9uLCB0b2tlbikudGhlbihNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlTG9jYXRpb25MaW5rRHRvKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQkcmVnaXN0ZXJEZWNsYXJhdGlvblN1cHBvcnQoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVjbGFyYXRpb25Qcm92aWRlci5yZWdpc3RlcihzZWxlY3Rvciwge1xuXHRcdFx0cHJvdmlkZURlY2xhcmF0aW9uOiAobW9kZWwsIHBvc2l0aW9uLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVEZWNsYXJhdGlvbihoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIHRva2VuKS50aGVuKE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLl9yZXZpdmVMb2NhdGlvbkxpbmtEdG8pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdCRyZWdpc3RlckltcGxlbWVudGF0aW9uU3VwcG9ydChoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbXBsZW1lbnRhdGlvblByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlSW1wbGVtZW50YXRpb246IChtb2RlbCwgcG9zaXRpb24sIHRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTG9jYXRpb25MaW5rW10+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRwcm92aWRlSW1wbGVtZW50YXRpb24oaGFuZGxlLCBtb2RlbC51cmksIHBvc2l0aW9uLCB0b2tlbikudGhlbihNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlTG9jYXRpb25MaW5rRHRvKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQkcmVnaXN0ZXJUeXBlRGVmaW5pdGlvblN1cHBvcnQoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UudHlwZURlZmluaXRpb25Qcm92aWRlci5yZWdpc3RlcihzZWxlY3Rvciwge1xuXHRcdFx0cHJvdmlkZVR5cGVEZWZpbml0aW9uOiAobW9kZWwsIHBvc2l0aW9uLCB0b2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkxvY2F0aW9uTGlua1tdPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZVR5cGVEZWZpbml0aW9uKGhhbmRsZSwgbW9kZWwudXJpLCBwb3NpdGlvbiwgdG9rZW4pLnRoZW4oTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZUxvY2F0aW9uTGlua0R0byk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tIGV4dHJhIGluZm9cblxuXHQkcmVnaXN0ZXJIb3ZlclByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHQvKlxuXHRcdGNvbnN0IGhvdmVyRmluYWxpemF0aW9uUmVnaXN0cnkgPSBuZXcgRmluYWxpemF0aW9uUmVnaXN0cnkoKGhvdmVySWQ6IG51bWJlcikgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VIb3ZlcihoYW5kbGUsIGhvdmVySWQpO1xuXHRcdH0pO1xuXHRcdCovXG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5ob3ZlclByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlSG92ZXI6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ/OiBsYW5ndWFnZXMuSG92ZXJDb250ZXh0PEhvdmVyV2l0aElkPik6IFByb21pc2U8SG92ZXJXaXRoSWQgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0Y29uc3Qgc2VyaWFsaXplZENvbnRleHQ6IGxhbmd1YWdlcy5Ib3ZlckNvbnRleHQ8eyBpZDogbnVtYmVyIH0+ID0ge1xuXHRcdFx0XHRcdHZlcmJvc2l0eVJlcXVlc3Q6IGNvbnRleHQ/LnZlcmJvc2l0eVJlcXVlc3QgPyB7XG5cdFx0XHRcdFx0XHR2ZXJib3NpdHlEZWx0YTogY29udGV4dC52ZXJib3NpdHlSZXF1ZXN0LnZlcmJvc2l0eURlbHRhLFxuXHRcdFx0XHRcdFx0cHJldmlvdXNIb3ZlcjogeyBpZDogY29udGV4dC52ZXJib3NpdHlSZXF1ZXN0LnByZXZpb3VzSG92ZXIuaWQgfVxuXHRcdFx0XHRcdH0gOiB1bmRlZmluZWQsXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGhvdmVyID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVIb3ZlcihoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIHNlcmlhbGl6ZWRDb250ZXh0LCB0b2tlbik7XG5cdFx0XHRcdC8vIGhvdmVyRmluYWxpemF0aW9uUmVnaXN0cnkucmVnaXN0ZXIoaG92ZXIsIGhvdmVyLmlkKTtcblx0XHRcdFx0cmV0dXJuIGhvdmVyO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBkZWJ1ZyBob3ZlclxuXG5cdCRyZWdpc3RlckV2YWx1YXRhYmxlRXhwcmVzc2lvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmV2YWx1YXRhYmxlRXhwcmVzc2lvblByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlRXZhbHVhdGFibGVFeHByZXNzaW9uOiAobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRXZhbHVhdGFibGVFeHByZXNzaW9uIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZUV2YWx1YXRhYmxlRXhwcmVzc2lvbihoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gaW5saW5lIHZhbHVlc1xuXG5cdCRyZWdpc3RlcklubGluZVZhbHVlc1Byb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIGV2ZW50SGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlcjogbGFuZ3VhZ2VzLklubGluZVZhbHVlc1Byb3ZpZGVyID0ge1xuXHRcdFx0cHJvdmlkZUlubGluZVZhbHVlczogKG1vZGVsOiBJVGV4dE1vZGVsLCB2aWV3UG9ydDogRWRpdG9yUmFuZ2UsIGNvbnRleHQ6IGxhbmd1YWdlcy5JbmxpbmVWYWx1ZUNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLklubGluZVZhbHVlW10gfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRwcm92aWRlSW5saW5lVmFsdWVzKGhhbmRsZSwgbW9kZWwudXJpLCB2aWV3UG9ydCwgY29udGV4dCwgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRpZiAodHlwZW9mIGV2ZW50SGFuZGxlID09PSAnbnVtYmVyJykge1xuXHRcdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdFx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChldmVudEhhbmRsZSwgZW1pdHRlcik7XG5cdFx0XHRwcm92aWRlci5vbkRpZENoYW5nZUlubGluZVZhbHVlcyA9IGVtaXR0ZXIuZXZlbnQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxpbmVWYWx1ZXNQcm92aWRlci5yZWdpc3RlcihzZWxlY3RvciwgcHJvdmlkZXIpKTtcblx0fVxuXG5cdCRlbWl0SW5saW5lVmFsdWVzRXZlbnQoZXZlbnRIYW5kbGU6IG51bWJlciwgZXZlbnQ/OiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBvYmogPSB0aGlzLl9yZWdpc3RyYXRpb25zLmdldChldmVudEhhbmRsZSk7XG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIEVtaXR0ZXIpIHtcblx0XHRcdG9iai5maXJlKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLS0gb2NjdXJyZW5jZXNcblxuXHQkcmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEhpZ2hsaWdodHM6IChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Eb2N1bWVudEhpZ2hsaWdodFtdIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cyhoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQkcmVnaXN0ZXJNdWx0aURvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubXVsdGlEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRzZWxlY3Rvcjogc2VsZWN0b3IsXG5cdFx0XHRwcm92aWRlTXVsdGlEb2N1bWVudEhpZ2hsaWdodHM6IChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCBvdGhlck1vZGVsczogSVRleHRNb2RlbFtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPE1hcDxVUkksIGxhbmd1YWdlcy5Eb2N1bWVudEhpZ2hsaWdodFtdPiB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVNdWx0aURvY3VtZW50SGlnaGxpZ2h0cyhoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIG90aGVyTW9kZWxzLm1hcChtb2RlbCA9PiBtb2RlbC51cmkpLCB0b2tlbikudGhlbihkdG8gPT4ge1xuXHRcdFx0XHRcdC8vIGR0byBzaG91bGQgYmUgbm9uLW51bGwgKyBub24tdW5kZWZpbmVkXG5cdFx0XHRcdFx0Ly8gZHRvIGxlbmd0aCBvZiAwIGlzIHZhbGlkLCBqdXN0IG5vIGhpZ2hsaWdodHMsIHBhc3MgdGhpcyB0aHJvdWdoLlxuXHRcdFx0XHRcdGlmIChkdG8gPT09IHVuZGVmaW5lZCB8fCBkdG8gPT09IG51bGwpIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IG5ldyBSZXNvdXJjZU1hcDxsYW5ndWFnZXMuRG9jdW1lbnRIaWdobGlnaHRbXT4oKTtcblx0XHRcdFx0XHRkdG8/LmZvckVhY2godmFsdWUgPT4ge1xuXHRcdFx0XHRcdFx0Ly8gY2hlY2sgaWYgdGhlIFVSSSBleGlzdHMgYWxyZWFkeSwgaWYgc28sIGNvbWJpbmUgdGhlIGhpZ2hsaWdodHMsIG90aGVyd2lzZSBjcmVhdGUgYSBuZXcgZW50cnlcblx0XHRcdFx0XHRcdGNvbnN0IHVyaSA9IFVSSS5yZXZpdmUodmFsdWUudXJpKTtcblx0XHRcdFx0XHRcdGlmIChyZXN1bHQuaGFzKHVyaSkpIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0LmdldCh1cmkpIS5wdXNoKC4uLnZhbHVlLmhpZ2hsaWdodHMpO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0cmVzdWx0LnNldCh1cmksIHZhbHVlLmhpZ2hsaWdodHMpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBsaW5rZWQgZWRpdGluZ1xuXG5cdCRyZWdpc3RlckxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlTGlua2VkRWRpdGluZ1JhbmdlczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkxpbmtlZEVkaXRpbmdSYW5nZXMgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVMaW5rZWRFZGl0aW5nUmFuZ2VzKGhhbmRsZSwgbW9kZWwudXJpLCBwb3NpdGlvbiwgdG9rZW4pO1xuXHRcdFx0XHRpZiAocmVzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHJhbmdlczogcmVzLnJhbmdlcyxcblx0XHRcdFx0XHRcdHdvcmRQYXR0ZXJuOiByZXMud29yZFBhdHRlcm4gPyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKHJlcy53b3JkUGF0dGVybikgOiB1bmRlZmluZWRcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0Ly8gLS0tIHJlZmVyZW5jZXNcblxuXHQkcmVnaXN0ZXJSZWZlcmVuY2VTdXBwb3J0KGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlZmVyZW5jZVByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlUmVmZXJlbmNlczogKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sIGNvbnRleHQ6IGxhbmd1YWdlcy5SZWZlcmVuY2VDb250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbltdPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZVJlZmVyZW5jZXMoaGFuZGxlLCBtb2RlbC51cmksIHBvc2l0aW9uLCBjb250ZXh0LCB0b2tlbikudGhlbihNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlTG9jYXRpb25EdG8pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBjb2RlIGFjdGlvbnNcblxuXHQkcmVnaXN0ZXJDb2RlQWN0aW9uU3VwcG9ydChoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCBtZXRhZGF0YTogSUNvZGVBY3Rpb25Qcm92aWRlck1ldGFkYXRhRHRvLCBkaXNwbGF5TmFtZTogc3RyaW5nLCBleHRlbnNpb25JZDogc3RyaW5nLCBzdXBwb3J0c1Jlc29sdmU6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlcjogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25Qcm92aWRlciA9IHtcblx0XHRcdHByb3ZpZGVDb2RlQWN0aW9uczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZU9yU2VsZWN0aW9uOiBFZGl0b3JSYW5nZSB8IFNlbGVjdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Db2RlQWN0aW9uTGlzdCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCBsaXN0RHRvID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVDb2RlQWN0aW9ucyhoYW5kbGUsIG1vZGVsLnVyaSwgcmFuZ2VPclNlbGVjdGlvbiwgY29udGV4dCwgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIWxpc3REdG8pIHtcblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0YWN0aW9uczogTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZUNvZGVBY3Rpb25EdG8obGlzdER0by5hY3Rpb25zLCB0aGlzLl91cmlJZGVudFNlcnZpY2UpLFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgbGlzdER0by5jYWNoZUlkID09PSAnbnVtYmVyJykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kcmVsZWFzZUNvZGVBY3Rpb25zKGhhbmRsZSwgbGlzdER0by5jYWNoZUlkKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZWRDb2RlQWN0aW9uS2luZHM6IG1ldGFkYXRhLnByb3ZpZGVkS2luZHMsXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBtZXRhZGF0YS5kb2N1bWVudGF0aW9uLFxuXHRcdFx0ZGlzcGxheU5hbWUsXG5cdFx0XHRleHRlbnNpb25JZCxcblx0XHR9O1xuXG5cdFx0aWYgKHN1cHBvcnRzUmVzb2x2ZSkge1xuXHRcdFx0cHJvdmlkZXIucmVzb2x2ZUNvZGVBY3Rpb24gPSBhc3luYyAoY29kZUFjdGlvbjogbGFuZ3VhZ2VzLkNvZGVBY3Rpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkNvZGVBY3Rpb24+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWQgPSBhd2FpdCB0aGlzLl9wcm94eS4kcmVzb2x2ZUNvZGVBY3Rpb24oaGFuZGxlLCAoPElDb2RlQWN0aW9uRHRvPmNvZGVBY3Rpb24pLmNhY2hlSWQhLCB0b2tlbik7XG5cdFx0XHRcdGlmIChyZXNvbHZlZC5lZGl0KSB7XG5cdFx0XHRcdFx0Y29kZUFjdGlvbi5lZGl0ID0gcmV2aXZlV29ya3NwYWNlRWRpdER0byhyZXNvbHZlZC5lZGl0LCB0aGlzLl91cmlJZGVudFNlcnZpY2UpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHJlc29sdmVkLmNvbW1hbmQpIHtcblx0XHRcdFx0XHRjb2RlQWN0aW9uLmNvbW1hbmQgPSByZXNvbHZlZC5jb21tYW5kO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGNvZGVBY3Rpb247XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUFjdGlvblByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCBwcm92aWRlcikpO1xuXHR9XG5cblx0Ly8gLS0tIGNvcHkgcGFzdGUgYWN0aW9uIHByb3ZpZGVyXG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGFzdGVFZGl0UHJvdmlkZXJzID0gbmV3IE1hcDxudW1iZXIsIE1haW5UaHJlYWRQYXN0ZUVkaXRQcm92aWRlcj4oKTtcblxuXHQkcmVnaXN0ZXJQYXN0ZUVkaXRQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCBtZXRhZGF0YTogSVBhc3RlRWRpdFByb3ZpZGVyTWV0YWRhdGFEdG8pOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBNYWluVGhyZWFkUGFzdGVFZGl0UHJvdmlkZXIoaGFuZGxlLCB0aGlzLl9wcm94eSwgbWV0YWRhdGEsIHRoaXMuX3VyaUlkZW50U2VydmljZSk7XG5cdFx0dGhpcy5fcGFzdGVFZGl0UHJvdmlkZXJzLnNldChoYW5kbGUsIHByb3ZpZGVyKTtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIGNvbWJpbmVkRGlzcG9zYWJsZShcblx0XHRcdHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHByb3ZpZGVyKSxcblx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9wYXN0ZUVkaXRQcm92aWRlcnMuZGVsZXRlKGhhbmRsZSkpLFxuXHRcdCkpO1xuXHR9XG5cblx0JHJlc29sdmVQYXN0ZUZpbGVEYXRhKGhhbmRsZTogbnVtYmVyLCByZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUlkOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9wYXN0ZUVkaXRQcm92aWRlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBwcm92aWRlcicpO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJvdmlkZXIucmVzb2x2ZUZpbGVEYXRhKHJlcXVlc3RJZCwgZGF0YUlkKTtcblx0fVxuXG5cdC8vIC0tLSBmb3JtYXR0aW5nXG5cblx0JHJlZ2lzdGVyRG9jdW1lbnRGb3JtYXR0aW5nU3VwcG9ydChoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCBleHRlbnNpb25JZDogRXh0ZW5zaW9uSWRlbnRpZmllciwgZGlzcGxheU5hbWU6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRleHRlbnNpb25JZCxcblx0XHRcdGRpc3BsYXlOYW1lLFxuXHRcdFx0cHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzOiAobW9kZWw6IElUZXh0TW9kZWwsIG9wdGlvbnM6IGxhbmd1YWdlcy5Gb3JtYXR0aW5nT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVEb2N1bWVudEZvcm1hdHRpbmdFZGl0cyhoYW5kbGUsIG1vZGVsLnVyaSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdCRyZWdpc3RlclJhbmdlRm9ybWF0dGluZ1N1cHBvcnQoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGRpc3BsYXlOYW1lOiBzdHJpbmcsIHN1cHBvcnRzUmFuZ2VzOiBib29sZWFuKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlci5yZWdpc3RlcihzZWxlY3Rvciwge1xuXHRcdFx0ZXh0ZW5zaW9uSWQsXG5cdFx0XHRkaXNwbGF5TmFtZSxcblx0XHRcdHByb3ZpZGVEb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRzOiAobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBFZGl0b3JSYW5nZSwgb3B0aW9uczogbGFuZ3VhZ2VzLkZvcm1hdHRpbmdPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZURvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdHMoaGFuZGxlLCBtb2RlbC51cmksIHJhbmdlLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZURvY3VtZW50UmFuZ2VzRm9ybWF0dGluZ0VkaXRzOiAhc3VwcG9ydHNSYW5nZXNcblx0XHRcdFx0PyB1bmRlZmluZWRcblx0XHRcdFx0OiAobW9kZWwsIHJhbmdlcywgb3B0aW9ucywgdG9rZW4pID0+IHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVEb2N1bWVudFJhbmdlc0Zvcm1hdHRpbmdFZGl0cyhoYW5kbGUsIG1vZGVsLnVyaSwgcmFuZ2VzLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRcdH0sXG5cdFx0fSkpO1xuXHR9XG5cblx0JHJlZ2lzdGVyT25UeXBlRm9ybWF0dGluZ1N1cHBvcnQoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgYXV0b0Zvcm1hdFRyaWdnZXJDaGFyYWN0ZXJzOiBzdHJpbmdbXSwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLm9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHtcblx0XHRcdGV4dGVuc2lvbklkLFxuXHRcdFx0YXV0b0Zvcm1hdFRyaWdnZXJDaGFyYWN0ZXJzLFxuXHRcdFx0cHJvdmlkZU9uVHlwZUZvcm1hdHRpbmdFZGl0czogKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sIGNoOiBzdHJpbmcsIG9wdGlvbnM6IGxhbmd1YWdlcy5Gb3JtYXR0aW5nT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVPblR5cGVGb3JtYXR0aW5nRWRpdHMoaGFuZGxlLCBtb2RlbC51cmksIHBvc2l0aW9uLCBjaCwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBuYXZpZ2F0ZSB0eXBlXG5cblx0JHJlZ2lzdGVyTmF2aWdhdGVUeXBlU3VwcG9ydChoYW5kbGU6IG51bWJlciwgc3VwcG9ydHNSZXNvbHZlOiBib29sZWFuKTogdm9pZCB7XG5cdFx0bGV0IGxhc3RSZXN1bHRJZDogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXI6IHNlYXJjaC5JV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIgPSB7XG5cdFx0XHRwcm92aWRlV29ya3NwYWNlU3ltYm9sczogYXN5bmMgKHNlYXJjaDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHNlYXJjaC5JV29ya3NwYWNlU3ltYm9sW10+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVXb3Jrc3BhY2VTeW1ib2xzKGhhbmRsZSwgc2VhcmNoLCB0b2tlbik7XG5cdFx0XHRcdGlmIChsYXN0UmVzdWx0SWQgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRyZWxlYXNlV29ya3NwYWNlU3ltYm9scyhoYW5kbGUsIGxhc3RSZXN1bHRJZCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0bGFzdFJlc3VsdElkID0gcmVzdWx0LmNhY2hlSWQ7XG5cdFx0XHRcdHJldHVybiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlV29ya3NwYWNlU3ltYm9sRHRvKHJlc3VsdC5zeW1ib2xzKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGlmIChzdXBwb3J0c1Jlc29sdmUpIHtcblx0XHRcdHByb3ZpZGVyLnJlc29sdmVXb3Jrc3BhY2VTeW1ib2wgPSBhc3luYyAoaXRlbTogc2VhcmNoLklXb3Jrc3BhY2VTeW1ib2wsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c2VhcmNoLklXb3Jrc3BhY2VTeW1ib2wgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzb2x2ZWRJdGVtID0gYXdhaXQgdGhpcy5fcHJveHkuJHJlc29sdmVXb3Jrc3BhY2VTeW1ib2woaGFuZGxlLCBpdGVtLCB0b2tlbik7XG5cdFx0XHRcdHJldHVybiByZXNvbHZlZEl0ZW0gJiYgTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZVdvcmtzcGFjZVN5bWJvbER0byhyZXNvbHZlZEl0ZW0pO1xuXHRcdFx0fTtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCBzZWFyY2guV29ya3NwYWNlU3ltYm9sUHJvdmlkZXJSZWdpc3RyeS5yZWdpc3Rlcihwcm92aWRlcikpO1xuXHR9XG5cblx0Ly8gLS0tIHJlbmFtZVxuXG5cdCRyZWdpc3RlclJlbmFtZVN1cHBvcnQoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgc3VwcG9ydFJlc29sdmVMb2NhdGlvbjogYm9vbGVhbik6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVuYW1lUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHtcblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0czogKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sIG5ld05hbWU6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZVJlbmFtZUVkaXRzKGhhbmRsZSwgbW9kZWwudXJpLCBwb3NpdGlvbiwgbmV3TmFtZSwgdG9rZW4pLnRoZW4oZGF0YSA9PiByZXZpdmVXb3Jrc3BhY2VFZGl0RHRvKGRhdGEsIHRoaXMuX3VyaUlkZW50U2VydmljZSkpO1xuXHRcdFx0fSxcblx0XHRcdHJlc29sdmVSZW5hbWVMb2NhdGlvbjogc3VwcG9ydFJlc29sdmVMb2NhdGlvblxuXHRcdFx0XHQ/IChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5SZW5hbWVMb2NhdGlvbiB8IHVuZGVmaW5lZD4gPT4gdGhpcy5fcHJveHkuJHJlc29sdmVSZW5hbWVMb2NhdGlvbihoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIHRva2VuKVxuXHRcdFx0XHQ6IHVuZGVmaW5lZFxuXHRcdH0pKTtcblx0fVxuXG5cdCRyZWdpc3Rlck5ld1N5bWJvbE5hbWVzUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubmV3U3ltYm9sTmFtZXNQcm92aWRlci5yZWdpc3RlcihzZWxlY3Rvciwge1xuXHRcdFx0c3VwcG9ydHNBdXRvbWF0aWNOZXdTeW1ib2xOYW1lc1RyaWdnZXJLaW5kOiB0aGlzLl9wcm94eS4kc3VwcG9ydHNBdXRvbWF0aWNOZXdTeW1ib2xOYW1lc1RyaWdnZXJLaW5kKGhhbmRsZSksXG5cdFx0XHRwcm92aWRlTmV3U3ltYm9sTmFtZXM6IChtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IElSYW5nZSwgdHJpZ2dlcktpbmQ6IGxhbmd1YWdlcy5OZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLk5ld1N5bWJvbE5hbWVbXSB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVOZXdTeW1ib2xOYW1lcyhoYW5kbGUsIG1vZGVsLnVyaSwgcmFuZ2UsIHRyaWdnZXJLaW5kLCB0b2tlbik7XG5cdFx0XHR9XG5cdFx0fSBzYXRpc2ZpZXMgbGFuZ3VhZ2VzLk5ld1N5bWJvbE5hbWVzUHJvdmlkZXIpKTtcblx0fVxuXG5cdC8vIC0tLSBzZW1hbnRpYyB0b2tlbnNcblxuXHQkcmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgbGVnZW5kOiBsYW5ndWFnZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQsIGV2ZW50SGFuZGxlOiBudW1iZXIgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRsZXQgZXZlbnQ6IEV2ZW50PHZvaWQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmICh0eXBlb2YgZXZlbnRIYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGV2ZW50SGFuZGxlLCBlbWl0dGVyKTtcblx0XHRcdGV2ZW50ID0gZW1pdHRlci5ldmVudDtcblx0XHR9XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIG5ldyBNYWluVGhyZWFkRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKHRoaXMuX3Byb3h5LCBoYW5kbGUsIGxlZ2VuZCwgZXZlbnQpKSk7XG5cdH1cblxuXHQkZW1pdERvY3VtZW50U2VtYW50aWNUb2tlbnNFdmVudChldmVudEhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgb2JqID0gdGhpcy5fcmVnaXN0cmF0aW9ucy5nZXQoZXZlbnRIYW5kbGUpO1xuXHRcdGlmIChvYmogaW5zdGFuY2VvZiBFbWl0dGVyKSB7XG5cdFx0XHRvYmouZmlyZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdCRyZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIGxlZ2VuZDogbGFuZ3VhZ2VzLlNlbWFudGljVG9rZW5zTGVnZW5kKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlci5yZWdpc3RlcihzZWxlY3RvciwgbmV3IE1haW5UaHJlYWREb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcih0aGlzLl9wcm94eSwgaGFuZGxlLCBsZWdlbmQpKSk7XG5cdH1cblxuXHQvLyAtLS0gc3VnZ2VzdFxuXG5cdHByaXZhdGUgc3RhdGljIF9pbmZsYXRlU3VnZ2VzdER0byhkZWZhdWx0UmFuZ2U6IElSYW5nZSB8IHsgaW5zZXJ0OiBJUmFuZ2U7IHJlcGxhY2U6IElSYW5nZSB9LCBkYXRhOiBJU3VnZ2VzdERhdGFEdG8sIGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtIHtcblxuXHRcdGNvbnN0IGxhYmVsID0gZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5sYWJlbF07XG5cdFx0Y29uc3QgY29tbWFuZElkID0gZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21tYW5kSWRdO1xuXHRcdGNvbnN0IGNvbW1hbmRJZGVudCA9IGRhdGFbSVN1Z2dlc3REYXRhRHRvRmllbGQuY29tbWFuZElkZW50XTtcblx0XHRjb25zdCBjb21taXRDaGFycyA9IGRhdGFbSVN1Z2dlc3REYXRhRHRvRmllbGQuY29tbWl0Q2hhcmFjdGVyc107XG5cblx0XHR0eXBlIElkZW50Q29tbWFuZCA9IGxhbmd1YWdlcy5Db21tYW5kICYgeyAkaWRlbnQ6IHN0cmluZyB8IHVuZGVmaW5lZCB9O1xuXG5cdFx0bGV0IGNvbW1hbmQ6IElkZW50Q29tbWFuZCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY29tbWFuZElkKSB7XG5cdFx0XHRjb21tYW5kID0ge1xuXHRcdFx0XHQkaWRlbnQ6IGNvbW1hbmRJZGVudCxcblx0XHRcdFx0aWQ6IGNvbW1hbmRJZCxcblx0XHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0XHRhcmd1bWVudHM6IGNvbW1hbmRJZGVudCA/IFtjb21tYW5kSWRlbnRdIDogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21tYW5kQXJndW1lbnRzXSwgLy8gQXV0b21hdGljYWxseSBmaWxsIGluIGlkZW50IGFzIGZpcnN0IGFyZ3VtZW50XG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRsYWJlbCxcblx0XHRcdGV4dGVuc2lvbklkLFxuXHRcdFx0a2luZDogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5raW5kXSA/PyBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlByb3BlcnR5LFxuXHRcdFx0dGFnczogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5raW5kTW9kaWZpZXJdLFxuXHRcdFx0ZGV0YWlsOiBkYXRhW0lTdWdnZXN0RGF0YUR0b0ZpZWxkLmRldGFpbF0sXG5cdFx0XHRkb2N1bWVudGF0aW9uOiBkYXRhW0lTdWdnZXN0RGF0YUR0b0ZpZWxkLmRvY3VtZW50YXRpb25dLFxuXHRcdFx0c29ydFRleHQ6IGRhdGFbSVN1Z2dlc3REYXRhRHRvRmllbGQuc29ydFRleHRdLFxuXHRcdFx0ZmlsdGVyVGV4dDogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5maWx0ZXJUZXh0XSxcblx0XHRcdHByZXNlbGVjdDogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5wcmVzZWxlY3RdLFxuXHRcdFx0aW5zZXJ0VGV4dDogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0XSA/PyAodHlwZW9mIGxhYmVsID09PSAnc3RyaW5nJyA/IGxhYmVsIDogbGFiZWwubGFiZWwpLFxuXHRcdFx0cmFuZ2U6IGRhdGFbSVN1Z2dlc3REYXRhRHRvRmllbGQucmFuZ2VdID8/IGRlZmF1bHRSYW5nZSxcblx0XHRcdGluc2VydFRleHRSdWxlczogZGF0YVtJU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0UnVsZXNdLFxuXHRcdFx0Y29tbWl0Q2hhcmFjdGVyczogY29tbWl0Q2hhcnMgPyBBcnJheS5mcm9tKGNvbW1pdENoYXJzKSA6IHVuZGVmaW5lZCxcblx0XHRcdGFkZGl0aW9uYWxUZXh0RWRpdHM6IGRhdGFbSVN1Z2dlc3REYXRhRHRvRmllbGQuYWRkaXRpb25hbFRleHRFZGl0c10sXG5cdFx0XHRjb21tYW5kLFxuXHRcdFx0Ly8gbm90LXN0YW5kYXJkXG5cdFx0XHRfaWQ6IGRhdGEueCxcblx0XHR9O1xuXHR9XG5cblx0JHJlZ2lzdGVyQ29tcGxldGlvbnNQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCB0cmlnZ2VyQ2hhcmFjdGVyczogc3RyaW5nW10sIHN1cHBvcnRzUmVzb2x2ZURldGFpbHM6IGJvb2xlYW4sIGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXI6IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbVByb3ZpZGVyID0ge1xuXHRcdFx0dHJpZ2dlckNoYXJhY3RlcnMsXG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogYCR7ZXh0ZW5zaW9uSWQudmFsdWV9KCR7dHJpZ2dlckNoYXJhY3RlcnMuam9pbignJyl9KWAsXG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zOiBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBFZGl0b3JQb3NpdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLkNvbXBsZXRpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Db21wbGV0aW9uTGlzdCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9wcm94eS4kcHJvdmlkZUNvbXBsZXRpb25JdGVtcyhoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IHJlc3VsdFtJU3VnZ2VzdFJlc3VsdER0b0ZpZWxkLmNvbXBsZXRpb25zXS5tYXAoZCA9PiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5faW5mbGF0ZVN1Z2dlc3REdG8ocmVzdWx0W0lTdWdnZXN0UmVzdWx0RHRvRmllbGQuZGVmYXVsdFJhbmdlc10sIGQsIGV4dGVuc2lvbklkKSksXG5cdFx0XHRcdFx0aW5jb21wbGV0ZTogcmVzdWx0W0lTdWdnZXN0UmVzdWx0RHRvRmllbGQuaXNJbmNvbXBsZXRlXSB8fCBmYWxzZSxcblx0XHRcdFx0XHRkdXJhdGlvbjogcmVzdWx0W0lTdWdnZXN0UmVzdWx0RHRvRmllbGQuZHVyYXRpb25dLFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdGlmICh0eXBlb2YgcmVzdWx0LnggPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRyZWxlYXNlQ29tcGxldGlvbkl0ZW1zKGhhbmRsZSwgcmVzdWx0LngpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdGlmIChzdXBwb3J0c1Jlc29sdmVEZXRhaWxzKSB7XG5cdFx0XHRwcm92aWRlci5yZXNvbHZlQ29tcGxldGlvbkl0ZW0gPSAoc3VnZ2VzdGlvbiwgdG9rZW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRyZXNvbHZlQ29tcGxldGlvbkl0ZW0oaGFuZGxlLCBzdWdnZXN0aW9uLl9pZCEsIHRva2VuKS50aGVuKHJlc3VsdCA9PiB7XG5cdFx0XHRcdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdFx0XHRcdHJldHVybiBzdWdnZXN0aW9uO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IG5ld1N1Z2dlc3Rpb24gPSBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5faW5mbGF0ZVN1Z2dlc3REdG8oc3VnZ2VzdGlvbi5yYW5nZSwgcmVzdWx0LCBleHRlbnNpb25JZCk7XG5cdFx0XHRcdFx0cmV0dXJuIG1peGluKHN1Z2dlc3Rpb24sIG5ld1N1Z2dlc3Rpb24sIHRydWUpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCBwcm92aWRlcikpO1xuXHR9XG5cblx0JHJlZ2lzdGVySW5saW5lQ29tcGxldGlvbnNTdXBwb3J0KGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIHN1cHBvcnRzSGFuZGxlRXZlbnRzOiBib29sZWFuLCBleHRlbnNpb25JZDogc3RyaW5nLCB5aWVsZHNUb0V4dGVuc2lvbklkczogc3RyaW5nW10sIGRpc3BsYXlOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQsIGRlYm91bmNlRGVsYXlNczogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXI6IGxhbmd1YWdlcy5JbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyPElkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb25zPiA9IHtcblx0XHRcdHByb3ZpZGVJbmxpbmVDb21wbGV0aW9uczogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogRWRpdG9yUG9zaXRpb24sIGNvbnRleHQ6IGxhbmd1YWdlcy5JbmxpbmVDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJZGVudGlmaWFibGVJbmxpbmVDb21wbGV0aW9ucyB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVJbmxpbmVDb21wbGV0aW9ucyhoYW5kbGUsIG1vZGVsLnVyaSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRwcm92aWRlSW5saW5lRWRpdHNGb3JSYW5nZTogYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCByYW5nZTogRWRpdG9yUmFuZ2UsIGNvbnRleHQ6IGxhbmd1YWdlcy5JbmxpbmVDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJZGVudGlmaWFibGVJbmxpbmVDb21wbGV0aW9ucyB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVJbmxpbmVFZGl0c0ZvclJhbmdlKGhhbmRsZSwgbW9kZWwudXJpLCByYW5nZSwgY29udGV4dCwgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdGhhbmRsZUl0ZW1EaWRTaG93OiBhc3luYyAoY29tcGxldGlvbnM6IElkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb25zLCBpdGVtOiBJZGVudGlmaWFibGVJbmxpbmVDb21wbGV0aW9uLCB1cGRhdGVkSW5zZXJ0VGV4dDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiA9PiB7XG5cdFx0XHRcdGlmIChzdXBwb3J0c0hhbmRsZUV2ZW50cykge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX3Byb3h5LiRoYW5kbGVJbmxpbmVDb21wbGV0aW9uRGlkU2hvdyhoYW5kbGUsIGNvbXBsZXRpb25zLnBpZCwgaXRlbS5pZHgsIHVwZGF0ZWRJbnNlcnRUZXh0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGhhbmRsZVBhcnRpYWxBY2NlcHQ6IGFzeW5jIChjb21wbGV0aW9ucywgaXRlbSwgYWNjZXB0ZWRDaGFyYWN0ZXJzLCBpbmZvOiBsYW5ndWFnZXMuUGFydGlhbEFjY2VwdEluZm8pOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdFx0aWYgKHN1cHBvcnRzSGFuZGxlRXZlbnRzKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fcHJveHkuJGhhbmRsZUlubGluZUNvbXBsZXRpb25QYXJ0aWFsQWNjZXB0KGhhbmRsZSwgY29tcGxldGlvbnMucGlkLCBpdGVtLmlkeCwgYWNjZXB0ZWRDaGFyYWN0ZXJzLCBpbmZvKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGZyZWVJbmxpbmVDb21wbGV0aW9uczogKGNvbXBsZXRpb25zOiBJZGVudGlmaWFibGVJbmxpbmVDb21wbGV0aW9ucyk6IHZvaWQgPT4ge1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kZnJlZUlubGluZUNvbXBsZXRpb25zTGlzdChoYW5kbGUsIGNvbXBsZXRpb25zLnBpZCk7XG5cdFx0XHR9LFxuXHRcdFx0aGFuZGxlUmVqZWN0aW9uOiBhc3luYyAoY29tcGxldGlvbnMsIGl0ZW0pOiBQcm9taXNlPHZvaWQ+ID0+IHtcblx0XHRcdFx0aWYgKHN1cHBvcnRzSGFuZGxlRXZlbnRzKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5fcHJveHkuJGhhbmRsZUlubGluZUNvbXBsZXRpb25SZWplY3Rpb24oaGFuZGxlLCBjb21wbGV0aW9ucy5waWQsIGl0ZW0uaWR4KTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGdyb3VwSWQ6IGV4dGVuc2lvbklkLFxuXHRcdFx0eWllbGRzVG9Hcm91cElkczogeWllbGRzVG9FeHRlbnNpb25JZHMsXG5cdFx0XHRkZWJvdW5jZURlbGF5TXMsXG5cdFx0XHRkaXNwbGF5TmFtZSxcblx0XHRcdHRvU3RyaW5nKCkge1xuXHRcdFx0XHRyZXR1cm4gYElubGluZUNvbXBsZXRpb25zUHJvdmlkZXIoJHtleHRlbnNpb25JZH0pYDtcblx0XHRcdH0sXG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUNvbXBsZXRpb25zUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHByb3ZpZGVyKSk7XG5cdH1cblxuXHQkcmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXIsIGRpc3BsYXlOYW1lOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBwcm92aWRlcjogbGFuZ3VhZ2VzLklubGluZUVkaXRQcm92aWRlcjxJZGVudGlmaWFibGVJbmxpbmVFZGl0PiA9IHtcblx0XHRcdGRpc3BsYXlOYW1lLFxuXHRcdFx0cHJvdmlkZUlubGluZUVkaXQ6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgY29udGV4dDogbGFuZ3VhZ2VzLklJbmxpbmVFZGl0Q29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJZGVudGlmaWFibGVJbmxpbmVFZGl0IHwgdW5kZWZpbmVkPiA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZUlubGluZUVkaXQoaGFuZGxlLCBtb2RlbC51cmksIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdH0sXG5cdFx0XHRmcmVlSW5saW5lRWRpdDogKGVkaXQ6IElkZW50aWZpYWJsZUlubGluZUVkaXQpOiB2b2lkID0+IHtcblx0XHRcdFx0dGhpcy5fcHJveHkuJGZyZWVJbmxpbmVFZGl0KGhhbmRsZSwgZWRpdC5waWQpO1xuXHRcdFx0fVxuXG5cdFx0fTtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmlubGluZUVkaXRQcm92aWRlci5yZWdpc3RlcihzZWxlY3RvciwgcHJvdmlkZXIpKTtcblx0fVxuXG5cdC8vIC0tLSBwYXJhbWV0ZXIgaGludHNcblxuXHQkcmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgbWV0YWRhdGE6IElTaWduYXR1cmVIZWxwUHJvdmlkZXJNZXRhZGF0YUR0byk6IHZvaWQge1xuXHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgdGhpcy5fbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2Uuc2lnbmF0dXJlSGVscFByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cblx0XHRcdHNpZ25hdHVyZUhlbHBUcmlnZ2VyQ2hhcmFjdGVyczogbWV0YWRhdGEudHJpZ2dlckNoYXJhY3RlcnMsXG5cdFx0XHRzaWduYXR1cmVIZWxwUmV0cmlnZ2VyQ2hhcmFjdGVyczogbWV0YWRhdGEucmV0cmlnZ2VyQ2hhcmFjdGVycyxcblxuXHRcdFx0cHJvdmlkZVNpZ25hdHVyZUhlbHA6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IEVkaXRvclBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwQ29udGV4dCk6IFByb21pc2U8bGFuZ3VhZ2VzLlNpZ25hdHVyZUhlbHBSZXN1bHQgfCB1bmRlZmluZWQ+ID0+IHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVTaWduYXR1cmVIZWxwKGhhbmRsZSwgbW9kZWwudXJpLCBwb3NpdGlvbiwgY29udGV4dCwgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHR2YWx1ZTogcmVzdWx0LFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX3Byb3h5LiRyZWxlYXNlU2lnbmF0dXJlSGVscChoYW5kbGUsIHJlc3VsdC5pZCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBpbmxpbmUgaGludHNcblxuXHQkcmVnaXN0ZXJJbmxheUhpbnRzUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSwgc3VwcG9ydHNSZXNvbHZlOiBib29sZWFuLCBldmVudEhhbmRsZTogbnVtYmVyIHwgdW5kZWZpbmVkLCBkaXNwbGF5TmFtZTogc3RyaW5nIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXI6IGxhbmd1YWdlcy5JbmxheUhpbnRzUHJvdmlkZXIgPSB7XG5cdFx0XHRkaXNwbGF5TmFtZSxcblx0XHRcdHByb3ZpZGVJbmxheUhpbnRzOiBhc3luYyAobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBFZGl0b3JSYW5nZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuSW5sYXlIaW50TGlzdCB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9wcm94eS4kcHJvdmlkZUlubGF5SGludHMoaGFuZGxlLCBtb2RlbC51cmksIHJhbmdlLCB0b2tlbik7XG5cdFx0XHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aGludHM6IHJldml2ZShyZXN1bHQuaGludHMpLFxuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdGlmIChyZXN1bHQuY2FjaGVJZCkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kcmVsZWFzZUlubGF5SGludHMoaGFuZGxlLCByZXN1bHQuY2FjaGVJZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0aWYgKHN1cHBvcnRzUmVzb2x2ZSkge1xuXHRcdFx0cHJvdmlkZXIucmVzb2x2ZUlubGF5SGludCA9IGFzeW5jIChoaW50LCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBkdG86IElJbmxheUhpbnREdG8gPSBoaW50O1xuXHRcdFx0XHRpZiAoIWR0by5jYWNoZUlkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGhpbnQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHJlc29sdmVJbmxheUhpbnQoaGFuZGxlLCBkdG8uY2FjaGVJZCwgdG9rZW4pO1xuXHRcdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0XHRcdHJldHVybiBoaW50O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Li4uaGludCxcblx0XHRcdFx0XHR0b29sdGlwOiByZXN1bHQudG9vbHRpcCxcblx0XHRcdFx0XHRsYWJlbDogcmV2aXZlPHN0cmluZyB8IGxhbmd1YWdlcy5JbmxheUhpbnRMYWJlbFBhcnRbXT4ocmVzdWx0LmxhYmVsKSxcblx0XHRcdFx0XHR0ZXh0RWRpdHM6IHJlc3VsdC50ZXh0RWRpdHNcblx0XHRcdFx0fTtcblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmICh0eXBlb2YgZXZlbnRIYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHRcdHRoaXMuX3JlZ2lzdHJhdGlvbnMuc2V0KGV2ZW50SGFuZGxlLCBlbWl0dGVyKTtcblx0XHRcdHByb3ZpZGVyLm9uRGlkQ2hhbmdlSW5sYXlIaW50cyA9IGVtaXR0ZXIuZXZlbnQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5pbmxheUhpbnRzUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHByb3ZpZGVyKSk7XG5cdH1cblxuXHQkZW1pdElubGF5SGludHNFdmVudChldmVudEhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3Qgb2JqID0gdGhpcy5fcmVnaXN0cmF0aW9ucy5nZXQoZXZlbnRIYW5kbGUpO1xuXHRcdGlmIChvYmogaW5zdGFuY2VvZiBFbWl0dGVyKSB7XG5cdFx0XHRvYmouZmlyZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdC8vIC0tLSBsaW5rc1xuXG5cdCRyZWdpc3RlckRvY3VtZW50TGlua1Byb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIHN1cHBvcnRzUmVzb2x2ZTogYm9vbGVhbik6IHZvaWQge1xuXHRcdGNvbnN0IHByb3ZpZGVyOiBsYW5ndWFnZXMuTGlua1Byb3ZpZGVyID0ge1xuXHRcdFx0cHJvdmlkZUxpbmtzOiAobW9kZWwsIHRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZURvY3VtZW50TGlua3MoaGFuZGxlLCBtb2RlbC51cmksIHRva2VuKS50aGVuKGR0byA9PiB7XG5cdFx0XHRcdFx0aWYgKCFkdG8pIHtcblx0XHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRsaW5rczogZHRvLmxpbmtzLm1hcChNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlTGlua0RUTyksXG5cdFx0XHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdGlmICh0eXBlb2YgZHRvLmNhY2hlSWQgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VEb2N1bWVudExpbmtzKGhhbmRsZSwgZHRvLmNhY2hlSWQpO1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRpZiAoc3VwcG9ydHNSZXNvbHZlKSB7XG5cdFx0XHRwcm92aWRlci5yZXNvbHZlTGluayA9IChsaW5rLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBkdG86IElMaW5rRHRvID0gbGluaztcblx0XHRcdFx0aWYgKCFkdG8uY2FjaGVJZCkge1xuXHRcdFx0XHRcdHJldHVybiBsaW5rO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcmVzb2x2ZURvY3VtZW50TGluayhoYW5kbGUsIGR0by5jYWNoZUlkLCB0b2tlbikudGhlbihvYmogPT4ge1xuXHRcdFx0XHRcdHJldHVybiBvYmogJiYgTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZUxpbmtEVE8ob2JqKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9O1xuXHRcdH1cblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmxpbmtQcm92aWRlci5yZWdpc3RlcihzZWxlY3RvciwgcHJvdmlkZXIpKTtcblx0fVxuXG5cdC8vIC0tLSBjb2xvcnNcblxuXHQkcmVnaXN0ZXJEb2N1bWVudENvbG9yUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHNlbGVjdG9yOiBJRG9jdW1lbnRGaWx0ZXJEdG9bXSk6IHZvaWQge1xuXHRcdGNvbnN0IHByb3h5ID0gdGhpcy5fcHJveHk7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2xvclByb3ZpZGVyLnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRDb2xvcnM6IChtb2RlbCwgdG9rZW4pID0+IHtcblx0XHRcdFx0cmV0dXJuIHByb3h5LiRwcm92aWRlRG9jdW1lbnRDb2xvcnMoaGFuZGxlLCBtb2RlbC51cmksIHRva2VuKVxuXHRcdFx0XHRcdC50aGVuKGRvY3VtZW50Q29sb3JzID0+IHtcblx0XHRcdFx0XHRcdHJldHVybiBkb2N1bWVudENvbG9ycy5tYXAoZG9jdW1lbnRDb2xvciA9PiB7XG5cdFx0XHRcdFx0XHRcdGNvbnN0IFtyZWQsIGdyZWVuLCBibHVlLCBhbHBoYV0gPSBkb2N1bWVudENvbG9yLmNvbG9yO1xuXHRcdFx0XHRcdFx0XHRjb25zdCBjb2xvciA9IHtcblx0XHRcdFx0XHRcdFx0XHRyZWQ6IHJlZCxcblx0XHRcdFx0XHRcdFx0XHRncmVlbjogZ3JlZW4sXG5cdFx0XHRcdFx0XHRcdFx0Ymx1ZTogYmx1ZSxcblx0XHRcdFx0XHRcdFx0XHRhbHBoYVxuXHRcdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0Y29sb3IsXG5cdFx0XHRcdFx0XHRcdFx0cmFuZ2U6IGRvY3VtZW50Q29sb3IucmFuZ2Vcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH0pO1xuXHRcdFx0fSxcblxuXHRcdFx0cHJvdmlkZUNvbG9yUHJlc2VudGF0aW9uczogKG1vZGVsLCBjb2xvckluZm8sIHRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiBwcm94eS4kcHJvdmlkZUNvbG9yUHJlc2VudGF0aW9ucyhoYW5kbGUsIG1vZGVsLnVyaSwge1xuXHRcdFx0XHRcdGNvbG9yOiBbY29sb3JJbmZvLmNvbG9yLnJlZCwgY29sb3JJbmZvLmNvbG9yLmdyZWVuLCBjb2xvckluZm8uY29sb3IuYmx1ZSwgY29sb3JJbmZvLmNvbG9yLmFscGhhXSxcblx0XHRcdFx0XHRyYW5nZTogY29sb3JJbmZvLnJhbmdlXG5cdFx0XHRcdH0sIHRva2VuKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gZm9sZGluZ1xuXG5cdCRyZWdpc3RlckZvbGRpbmdSYW5nZVByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10sIGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBldmVudEhhbmRsZTogbnVtYmVyIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXI6IGxhbmd1YWdlcy5Gb2xkaW5nUmFuZ2VQcm92aWRlciA9IHtcblx0XHRcdGlkOiBleHRlbnNpb25JZC52YWx1ZSxcblx0XHRcdHByb3ZpZGVGb2xkaW5nUmFuZ2VzOiAobW9kZWwsIGNvbnRleHQsIHRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZUZvbGRpbmdSYW5nZXMoaGFuZGxlLCBtb2RlbC51cmksIGNvbnRleHQsIHRva2VuKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBldmVudEhhbmRsZSA9PT0gJ251bWJlcicpIHtcblx0XHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxsYW5ndWFnZXMuRm9sZGluZ1JhbmdlUHJvdmlkZXI+KCk7XG5cdFx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChldmVudEhhbmRsZSwgZW1pdHRlcik7XG5cdFx0XHRwcm92aWRlci5vbkRpZENoYW5nZSA9IGVtaXR0ZXIuZXZlbnQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5mb2xkaW5nUmFuZ2VQcm92aWRlci5yZWdpc3RlcihzZWxlY3RvciwgcHJvdmlkZXIpKTtcblx0fVxuXG5cdCRlbWl0Rm9sZGluZ1JhbmdlRXZlbnQoZXZlbnRIYW5kbGU6IG51bWJlciwgZXZlbnQ/OiBhbnkpOiB2b2lkIHtcblx0XHRjb25zdCBvYmogPSB0aGlzLl9yZWdpc3RyYXRpb25zLmdldChldmVudEhhbmRsZSk7XG5cdFx0aWYgKG9iaiBpbnN0YW5jZW9mIEVtaXR0ZXIpIHtcblx0XHRcdG9iai5maXJlKGV2ZW50KTtcblx0XHR9XG5cdH1cblxuXHQvLyAtLSBzbWFydCBzZWxlY3RcblxuXHQkcmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnNlbGVjdGlvblJhbmdlUHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHtcblx0XHRcdHByb3ZpZGVTZWxlY3Rpb25SYW5nZXM6IChtb2RlbCwgcG9zaXRpb25zLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVTZWxlY3Rpb25SYW5nZXMoaGFuZGxlLCBtb2RlbC51cmksIHBvc2l0aW9ucywgdG9rZW4pO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdC8vIC0tLSBjYWxsIGhpZXJhcmNoeVxuXG5cdCRyZWdpc3RlckNhbGxIaWVyYXJjaHlQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCBjYWxsaC5DYWxsSGllcmFyY2h5UHJvdmlkZXJSZWdpc3RyeS5yZWdpc3RlcihzZWxlY3Rvciwge1xuXG5cdFx0XHRwcmVwYXJlQ2FsbEhpZXJhcmNoeTogYXN5bmMgKGRvY3VtZW50LCBwb3NpdGlvbiwgdG9rZW4pID0+IHtcblx0XHRcdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLl9wcm94eS4kcHJlcGFyZUNhbGxIaWVyYXJjaHkoaGFuZGxlLCBkb2N1bWVudC51cmksIHBvc2l0aW9uLCB0b2tlbik7XG5cdFx0XHRcdGlmICghaXRlbXMgfHwgaXRlbXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdGZvciAoY29uc3QgaXRlbSBvZiBpdGVtcykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kcmVsZWFzZUNhbGxIaWVyYXJjaHkoaGFuZGxlLCBpdGVtLl9zZXNzaW9uSWQpO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cm9vdHM6IGl0ZW1zLm1hcChNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlQ2FsbEhpZXJhcmNoeUl0ZW1EdG8pXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXG5cdFx0XHRwcm92aWRlT3V0Z29pbmdDYWxsczogYXN5bmMgKGl0ZW0sIHRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IG91dGdvaW5nID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxscyhoYW5kbGUsIGl0ZW0uX3Nlc3Npb25JZCwgaXRlbS5faXRlbUlkLCB0b2tlbik7XG5cdFx0XHRcdGlmICghb3V0Z29pbmcpIHtcblx0XHRcdFx0XHRyZXR1cm4gb3V0Z29pbmc7XG5cdFx0XHRcdH1cblx0XHRcdFx0b3V0Z29pbmcuZm9yRWFjaCh2YWx1ZSA9PiB7XG5cdFx0XHRcdFx0dmFsdWUudG8gPSBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlQ2FsbEhpZXJhcmNoeUl0ZW1EdG8odmFsdWUudG8pO1xuXHRcdFx0XHR9KTtcblx0XHRcdFx0cmV0dXJuIDxhbnk+b3V0Z29pbmc7XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZUluY29taW5nQ2FsbHM6IGFzeW5jIChpdGVtLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBpbmNvbWluZyA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcm92aWRlQ2FsbEhpZXJhcmNoeUluY29taW5nQ2FsbHMoaGFuZGxlLCBpdGVtLl9zZXNzaW9uSWQsIGl0ZW0uX2l0ZW1JZCwgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIWluY29taW5nKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGluY29taW5nO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGluY29taW5nLmZvckVhY2godmFsdWUgPT4ge1xuXHRcdFx0XHRcdHZhbHVlLmZyb20gPSBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlQ2FsbEhpZXJhcmNoeUl0ZW1EdG8odmFsdWUuZnJvbSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4gPGFueT5pbmNvbWluZztcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvLyAtLS0gY29uZmlndXJhdGlvblxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVSZWdFeHAocmVnRXhwOiBJUmVnRXhwRHRvKTogUmVnRXhwIHtcblx0XHRyZXR1cm4gbmV3IFJlZ0V4cChyZWdFeHAucGF0dGVybiwgcmVnRXhwLmZsYWdzKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVJbmRlbnRhdGlvblJ1bGUoaW5kZW50YXRpb25SdWxlOiBJSW5kZW50YXRpb25SdWxlRHRvKTogSW5kZW50YXRpb25SdWxlIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGVjcmVhc2VJbmRlbnRQYXR0ZXJuOiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKGluZGVudGF0aW9uUnVsZS5kZWNyZWFzZUluZGVudFBhdHRlcm4pLFxuXHRcdFx0aW5jcmVhc2VJbmRlbnRQYXR0ZXJuOiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKGluZGVudGF0aW9uUnVsZS5pbmNyZWFzZUluZGVudFBhdHRlcm4pLFxuXHRcdFx0aW5kZW50TmV4dExpbmVQYXR0ZXJuOiBpbmRlbnRhdGlvblJ1bGUuaW5kZW50TmV4dExpbmVQYXR0ZXJuID8gTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZVJlZ0V4cChpbmRlbnRhdGlvblJ1bGUuaW5kZW50TmV4dExpbmVQYXR0ZXJuKSA6IHVuZGVmaW5lZCxcblx0XHRcdHVuSW5kZW50ZWRMaW5lUGF0dGVybjogaW5kZW50YXRpb25SdWxlLnVuSW5kZW50ZWRMaW5lUGF0dGVybiA/IE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLl9yZXZpdmVSZWdFeHAoaW5kZW50YXRpb25SdWxlLnVuSW5kZW50ZWRMaW5lUGF0dGVybikgOiB1bmRlZmluZWQsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVPbkVudGVyUnVsZShvbkVudGVyUnVsZTogSU9uRW50ZXJSdWxlRHRvKTogT25FbnRlclJ1bGUge1xuXHRcdHJldHVybiB7XG5cdFx0XHRiZWZvcmVUZXh0OiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKG9uRW50ZXJSdWxlLmJlZm9yZVRleHQpLFxuXHRcdFx0YWZ0ZXJUZXh0OiBvbkVudGVyUnVsZS5hZnRlclRleHQgPyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKG9uRW50ZXJSdWxlLmFmdGVyVGV4dCkgOiB1bmRlZmluZWQsXG5cdFx0XHRwcmV2aW91c0xpbmVUZXh0OiBvbkVudGVyUnVsZS5wcmV2aW91c0xpbmVUZXh0ID8gTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZVJlZ0V4cChvbkVudGVyUnVsZS5wcmV2aW91c0xpbmVUZXh0KSA6IHVuZGVmaW5lZCxcblx0XHRcdGFjdGlvbjogb25FbnRlclJ1bGUuYWN0aW9uXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9yZXZpdmVPbkVudGVyUnVsZXMob25FbnRlclJ1bGVzOiBJT25FbnRlclJ1bGVEdG9bXSk6IE9uRW50ZXJSdWxlW10ge1xuXHRcdHJldHVybiBvbkVudGVyUnVsZXMubWFwKE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLl9yZXZpdmVPbkVudGVyUnVsZSk7XG5cdH1cblxuXHQkc2V0TGFuZ3VhZ2VDb25maWd1cmF0aW9uKGhhbmRsZTogbnVtYmVyLCBsYW5ndWFnZUlkOiBzdHJpbmcsIF9jb25maWd1cmF0aW9uOiBJTGFuZ3VhZ2VDb25maWd1cmF0aW9uRHRvKTogdm9pZCB7XG5cblx0XHRjb25zdCBjb25maWd1cmF0aW9uOiBMYW5ndWFnZUNvbmZpZ3VyYXRpb24gPSB7XG5cdFx0XHRjb21tZW50czogX2NvbmZpZ3VyYXRpb24uY29tbWVudHMsXG5cdFx0XHRicmFja2V0czogX2NvbmZpZ3VyYXRpb24uYnJhY2tldHMsXG5cdFx0XHR3b3JkUGF0dGVybjogX2NvbmZpZ3VyYXRpb24ud29yZFBhdHRlcm4gPyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlUmVnRXhwKF9jb25maWd1cmF0aW9uLndvcmRQYXR0ZXJuKSA6IHVuZGVmaW5lZCxcblx0XHRcdGluZGVudGF0aW9uUnVsZXM6IF9jb25maWd1cmF0aW9uLmluZGVudGF0aW9uUnVsZXMgPyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlSW5kZW50YXRpb25SdWxlKF9jb25maWd1cmF0aW9uLmluZGVudGF0aW9uUnVsZXMpIDogdW5kZWZpbmVkLFxuXHRcdFx0b25FbnRlclJ1bGVzOiBfY29uZmlndXJhdGlvbi5vbkVudGVyUnVsZXMgPyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlT25FbnRlclJ1bGVzKF9jb25maWd1cmF0aW9uLm9uRW50ZXJSdWxlcykgOiB1bmRlZmluZWQsXG5cblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IHVuZGVmaW5lZCxcblx0XHRcdHN1cnJvdW5kaW5nUGFpcnM6IHVuZGVmaW5lZCxcblx0XHRcdF9fZWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0OiB1bmRlZmluZWRcblx0XHR9O1xuXG5cdFx0aWYgKF9jb25maWd1cmF0aW9uLmF1dG9DbG9zaW5nUGFpcnMpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb24uYXV0b0Nsb3NpbmdQYWlycyA9IF9jb25maWd1cmF0aW9uLmF1dG9DbG9zaW5nUGFpcnM7XG5cdFx0fSBlbHNlIGlmIChfY29uZmlndXJhdGlvbi5fX2NoYXJhY3RlclBhaXJTdXBwb3J0KSB7XG5cdFx0XHQvLyBiYWNrd2FyZHMgY29tcGF0aWJpbGl0eVxuXHRcdFx0Y29uZmlndXJhdGlvbi5hdXRvQ2xvc2luZ1BhaXJzID0gX2NvbmZpZ3VyYXRpb24uX19jaGFyYWN0ZXJQYWlyU3VwcG9ydC5hdXRvQ2xvc2luZ1BhaXJzO1xuXHRcdH1cblxuXHRcdGlmIChfY29uZmlndXJhdGlvbi5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydCAmJiBfY29uZmlndXJhdGlvbi5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydC5kb2NDb21tZW50KSB7XG5cdFx0XHRjb25maWd1cmF0aW9uLl9fZWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0ID0ge1xuXHRcdFx0XHRkb2NDb21tZW50OiB7XG5cdFx0XHRcdFx0b3BlbjogX2NvbmZpZ3VyYXRpb24uX19lbGVjdHJpY0NoYXJhY3RlclN1cHBvcnQuZG9jQ29tbWVudC5vcGVuLFxuXHRcdFx0XHRcdGNsb3NlOiBfY29uZmlndXJhdGlvbi5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydC5kb2NDb21tZW50LmNsb3NlXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX2xhbmd1YWdlU2VydmljZS5pc1JlZ2lzdGVyZWRMYW5ndWFnZUlkKGxhbmd1YWdlSWQpKSB7XG5cdFx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHRoaXMuX2xhbmd1YWdlQ29uZmlndXJhdGlvblNlcnZpY2UucmVnaXN0ZXIobGFuZ3VhZ2VJZCwgY29uZmlndXJhdGlvbiwgMTAwKSk7XG5cdFx0fVxuXHR9XG5cblx0Ly8gLS0tIHR5cGUgaGllcmFyY2h5XG5cblx0JHJlZ2lzdGVyVHlwZUhpZXJhcmNoeVByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBzZWxlY3RvcjogSURvY3VtZW50RmlsdGVyRHRvW10pOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChoYW5kbGUsIHR5cGVoLlR5cGVIaWVyYXJjaHlQcm92aWRlclJlZ2lzdHJ5LnJlZ2lzdGVyKHNlbGVjdG9yLCB7XG5cblx0XHRcdHByZXBhcmVUeXBlSGllcmFyY2h5OiBhc3luYyAoZG9jdW1lbnQsIHBvc2l0aW9uLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcmVwYXJlVHlwZUhpZXJhcmNoeShoYW5kbGUsIGRvY3VtZW50LnVyaSwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRcdFx0aWYgKCFpdGVtcykge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VUeXBlSGllcmFyY2h5KGhhbmRsZSwgaXRlbS5fc2Vzc2lvbklkKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHJvb3RzOiBpdGVtcy5tYXAoTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZVR5cGVIaWVyYXJjaHlJdGVtRHRvKVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblxuXHRcdFx0cHJvdmlkZVN1cGVydHlwZXM6IGFzeW5jIChpdGVtLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBzdXBlcnR5cGVzID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVUeXBlSGllcmFyY2h5U3VwZXJ0eXBlcyhoYW5kbGUsIGl0ZW0uX3Nlc3Npb25JZCwgaXRlbS5faXRlbUlkLCB0b2tlbik7XG5cdFx0XHRcdGlmICghc3VwZXJ0eXBlcykge1xuXHRcdFx0XHRcdHJldHVybiBzdXBlcnR5cGVzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdXBlcnR5cGVzLm1hcChNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcy5fcmV2aXZlVHlwZUhpZXJhcmNoeUl0ZW1EdG8pO1xuXHRcdFx0fSxcblx0XHRcdHByb3ZpZGVTdWJ0eXBlczogYXN5bmMgKGl0ZW0sIHRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHN1YnR5cGVzID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVUeXBlSGllcmFyY2h5U3VidHlwZXMoaGFuZGxlLCBpdGVtLl9zZXNzaW9uSWQsIGl0ZW0uX2l0ZW1JZCwgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIXN1YnR5cGVzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHN1YnR5cGVzO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzdWJ0eXBlcy5tYXAoTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuX3Jldml2ZVR5cGVIaWVyYXJjaHlJdGVtRHRvKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXG5cdC8vIC0tLSBkb2N1bWVudCBkcm9wIEVkaXRzXG5cblx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRPbkRyb3BFZGl0UHJvdmlkZXJzID0gbmV3IE1hcDxudW1iZXIsIE1haW5UaHJlYWREb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlcj4oKTtcblxuXHQkcmVnaXN0ZXJEb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlcihoYW5kbGU6IG51bWJlciwgc2VsZWN0b3I6IElEb2N1bWVudEZpbHRlckR0b1tdLCBtZXRhZGF0YTogSURvY3VtZW50RHJvcEVkaXRQcm92aWRlck1ldGFkYXRhKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTWFpblRocmVhZERvY3VtZW50T25Ecm9wRWRpdFByb3ZpZGVyKGhhbmRsZSwgdGhpcy5fcHJveHksIG1ldGFkYXRhLCB0aGlzLl91cmlJZGVudFNlcnZpY2UpO1xuXHRcdHRoaXMuX2RvY3VtZW50T25Ecm9wRWRpdFByb3ZpZGVycy5zZXQoaGFuZGxlLCBwcm92aWRlcik7XG5cdFx0dGhpcy5fcmVnaXN0cmF0aW9ucy5zZXQoaGFuZGxlLCBjb21iaW5lZERpc3Bvc2FibGUoXG5cdFx0XHR0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudERyb3BFZGl0UHJvdmlkZXIucmVnaXN0ZXIoc2VsZWN0b3IsIHByb3ZpZGVyKSxcblx0XHRcdHRvRGlzcG9zYWJsZSgoKSA9PiB0aGlzLl9kb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlcnMuZGVsZXRlKGhhbmRsZSkpLFxuXHRcdCkpO1xuXHR9XG5cblx0YXN5bmMgJHJlc29sdmVEb2N1bWVudE9uRHJvcEZpbGVEYXRhKGhhbmRsZTogbnVtYmVyLCByZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUlkOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSB0aGlzLl9kb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlcnMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDb3VsZCBub3QgZmluZCBwcm92aWRlcicpO1xuXHRcdH1cblx0XHRyZXR1cm4gcHJvdmlkZXIucmVzb2x2ZURvY3VtZW50T25Ecm9wRmlsZURhdGEocmVxdWVzdElkLCBkYXRhSWQpO1xuXHR9XG59XG5cbmNsYXNzIE1haW5UaHJlYWRQYXN0ZUVkaXRQcm92aWRlciBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Eb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IGRhdGFUcmFuc2ZlcnMgPSBuZXcgRGF0YVRyYW5zZmVyRmlsZUNhY2hlKCk7XG5cblx0cHVibGljIHJlYWRvbmx5IGNvcHlNaW1lVHlwZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuXHRwdWJsaWMgcmVhZG9ubHkgcGFzdGVNaW1lVHlwZXM6IHJlYWRvbmx5IHN0cmluZ1tdO1xuXHRwdWJsaWMgcmVhZG9ubHkgcHJvdmlkZWRQYXN0ZUVkaXRLaW5kczogcmVhZG9ubHkgSGllcmFyY2hpY2FsS2luZFtdO1xuXG5cdHJlYWRvbmx5IHByZXBhcmVEb2N1bWVudFBhc3RlPzogbGFuZ3VhZ2VzLkRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXJbJ3ByZXBhcmVEb2N1bWVudFBhc3RlJ107XG5cdHJlYWRvbmx5IHByb3ZpZGVEb2N1bWVudFBhc3RlRWRpdHM/OiBsYW5ndWFnZXMuRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlclsncHJvdmlkZURvY3VtZW50UGFzdGVFZGl0cyddO1xuXHRyZWFkb25seSByZXNvbHZlRG9jdW1lbnRQYXN0ZUVkaXQ/OiBsYW5ndWFnZXMuRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlclsncmVzb2x2ZURvY3VtZW50UGFzdGVFZGl0J107XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzU2hhcGUsXG5cdFx0bWV0YWRhdGE6IElQYXN0ZUVkaXRQcm92aWRlck1ldGFkYXRhRHRvLFxuXHRcdEBJVXJpSWRlbnRpdHlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3VyaUlkZW50U2VydmljZTogSVVyaUlkZW50aXR5U2VydmljZVxuXHQpIHtcblx0XHR0aGlzLmNvcHlNaW1lVHlwZXMgPSBtZXRhZGF0YS5jb3B5TWltZVR5cGVzID8/IFtdO1xuXHRcdHRoaXMucGFzdGVNaW1lVHlwZXMgPSBtZXRhZGF0YS5wYXN0ZU1pbWVUeXBlcyA/PyBbXTtcblx0XHR0aGlzLnByb3ZpZGVkUGFzdGVFZGl0S2luZHMgPSBtZXRhZGF0YS5wcm92aWRlZFBhc3RlRWRpdEtpbmRzPy5tYXAoa2luZCA9PiBuZXcgSGllcmFyY2hpY2FsS2luZChraW5kKSkgPz8gW107XG5cblx0XHRpZiAobWV0YWRhdGEuc3VwcG9ydHNDb3B5KSB7XG5cdFx0XHR0aGlzLnByZXBhcmVEb2N1bWVudFBhc3RlID0gYXN5bmMgKG1vZGVsOiBJVGV4dE1vZGVsLCBzZWxlY3Rpb25zOiByZWFkb25seSBJUmFuZ2VbXSwgZGF0YVRyYW5zZmVyOiBJUmVhZG9ubHlWU0RhdGFUcmFuc2ZlciwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUmVhZG9ubHlWU0RhdGFUcmFuc2ZlciB8IHVuZGVmaW5lZD4gPT4ge1xuXHRcdFx0XHRjb25zdCBkYXRhVHJhbnNmZXJEdG8gPSBhd2FpdCB0eXBlQ29udmVydC5EYXRhVHJhbnNmZXIuZnJvbUxpc3QoZGF0YVRyYW5zZmVyKTtcblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IG5ld0RhdGFUcmFuc2ZlciA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcmVwYXJlRG9jdW1lbnRQYXN0ZShfaGFuZGxlLCBtb2RlbC51cmksIHNlbGVjdGlvbnMsIGRhdGFUcmFuc2ZlckR0bywgdG9rZW4pO1xuXHRcdFx0XHRpZiAoIW5ld0RhdGFUcmFuc2Zlcikge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkYXRhVHJhbnNmZXJPdXQgPSBuZXcgVlNEYXRhVHJhbnNmZXIoKTtcblx0XHRcdFx0Zm9yIChjb25zdCBbdHlwZSwgaXRlbV0gb2YgbmV3RGF0YVRyYW5zZmVyLml0ZW1zKSB7XG5cdFx0XHRcdFx0ZGF0YVRyYW5zZmVyT3V0LnJlcGxhY2UodHlwZSwgY3JlYXRlU3RyaW5nRGF0YVRyYW5zZmVySXRlbShpdGVtLmFzU3RyaW5nLCBpdGVtLmlkKSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGRhdGFUcmFuc2Zlck91dDtcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKG1ldGFkYXRhLnN1cHBvcnRzUGFzdGUpIHtcblx0XHRcdHRoaXMucHJvdmlkZURvY3VtZW50UGFzdGVFZGl0cyA9IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgc2VsZWN0aW9uczogU2VsZWN0aW9uW10sIGRhdGFUcmFuc2ZlcjogSVJlYWRvbmx5VlNEYXRhVHJhbnNmZXIsIGNvbnRleHQ6IGxhbmd1YWdlcy5Eb2N1bWVudFBhc3RlQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSB0aGlzLmRhdGFUcmFuc2ZlcnMuYWRkKGRhdGFUcmFuc2Zlcik7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YVRyYW5zZmVyRHRvID0gYXdhaXQgdHlwZUNvbnZlcnQuRGF0YVRyYW5zZmVyLmZyb21MaXN0KGRhdGFUcmFuc2Zlcik7XG5cdFx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgZWRpdHMgPSBhd2FpdCB0aGlzLl9wcm94eS4kcHJvdmlkZVBhc3RlRWRpdHModGhpcy5faGFuZGxlLCByZXF1ZXN0LmlkLCBtb2RlbC51cmksIHNlbGVjdGlvbnMsIGRhdGFUcmFuc2ZlckR0bywge1xuXHRcdFx0XHRcdFx0b25seTogY29udGV4dC5vbmx5Py52YWx1ZSxcblx0XHRcdFx0XHRcdHRyaWdnZXJLaW5kOiBjb250ZXh0LnRyaWdnZXJLaW5kLFxuXHRcdFx0XHRcdH0sIHRva2VuKTtcblx0XHRcdFx0XHRpZiAoIWVkaXRzKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGVkaXRzOiBlZGl0cy5tYXAoKGVkaXQpOiBsYW5ndWFnZXMuRG9jdW1lbnRQYXN0ZUVkaXQgPT4ge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRcdC4uLmVkaXQsXG5cdFx0XHRcdFx0XHRcdFx0a2luZDogZWRpdC5raW5kID8gbmV3IEhpZXJhcmNoaWNhbEtpbmQoZWRpdC5raW5kLnZhbHVlKSA6IG5ldyBIaWVyYXJjaGljYWxLaW5kKCcnKSxcblx0XHRcdFx0XHRcdFx0XHR5aWVsZFRvOiBlZGl0LnlpZWxkVG8/Lm1hcCh4ID0+ICh7IGtpbmQ6IG5ldyBIaWVyYXJjaGljYWxLaW5kKHgpIH0pKSxcblx0XHRcdFx0XHRcdFx0XHRhZGRpdGlvbmFsRWRpdDogZWRpdC5hZGRpdGlvbmFsRWRpdCA/IHJldml2ZVdvcmtzcGFjZUVkaXREdG8oZWRpdC5hZGRpdGlvbmFsRWRpdCwgdGhpcy5fdXJpSWRlbnRTZXJ2aWNlLCBkYXRhSWQgPT4gdGhpcy5yZXNvbHZlRmlsZURhdGEocmVxdWVzdC5pZCwgZGF0YUlkKSkgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VQYXN0ZUVkaXRzKHRoaXMuX2hhbmRsZSwgcmVxdWVzdC5pZCk7XG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0gZmluYWxseSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0fVxuXHRcdGlmIChtZXRhZGF0YS5zdXBwb3J0c1Jlc29sdmUpIHtcblx0XHRcdHRoaXMucmVzb2x2ZURvY3VtZW50UGFzdGVFZGl0ID0gYXN5bmMgKGVkaXQ6IGxhbmd1YWdlcy5Eb2N1bWVudFBhc3RlRWRpdCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgdGhpcy5fcHJveHkuJHJlc29sdmVQYXN0ZUVkaXQodGhpcy5faGFuZGxlLCAoPElQYXN0ZUVkaXREdG8+ZWRpdCkuX2NhY2hlSWQhLCB0b2tlbik7XG5cdFx0XHRcdGlmICh0eXBlb2YgcmVzb2x2ZWQuaW5zZXJ0VGV4dCAhPT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRlZGl0Lmluc2VydFRleHQgPSByZXNvbHZlZC5pbnNlcnRUZXh0O1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHJlc29sdmVkLmFkZGl0aW9uYWxFZGl0KSB7XG5cdFx0XHRcdFx0ZWRpdC5hZGRpdGlvbmFsRWRpdCA9IHJldml2ZVdvcmtzcGFjZUVkaXREdG8ocmVzb2x2ZWQuYWRkaXRpb25hbEVkaXQsIHRoaXMuX3VyaUlkZW50U2VydmljZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGVkaXQ7XG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdHJlc29sdmVGaWxlRGF0YShyZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUlkOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVRyYW5zZmVycy5yZXNvbHZlRmlsZURhdGEocmVxdWVzdElkLCBkYXRhSWQpO1xuXHR9XG59XG5cbmNsYXNzIE1haW5UaHJlYWREb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlciBpbXBsZW1lbnRzIGxhbmd1YWdlcy5Eb2N1bWVudERyb3BFZGl0UHJvdmlkZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZGF0YVRyYW5zZmVycyA9IG5ldyBEYXRhVHJhbnNmZXJGaWxlQ2FjaGUoKTtcblxuXHRyZWFkb25seSBkcm9wTWltZVR5cGVzPzogcmVhZG9ubHkgc3RyaW5nW107XG5cblx0cmVhZG9ubHkgcHJvdmlkZWREcm9wRWRpdEtpbmRzOiByZWFkb25seSBIaWVyYXJjaGljYWxLaW5kW10gfCB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgcmVzb2x2ZURvY3VtZW50RHJvcEVkaXQ/OiBsYW5ndWFnZXMuRG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyWydyZXNvbHZlRG9jdW1lbnREcm9wRWRpdCddO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlc1NoYXBlLFxuXHRcdG1ldGFkYXRhOiBJRG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyTWV0YWRhdGEgfCB1bmRlZmluZWQsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdXJpSWRlbnRTZXJ2aWNlOiBJVXJpSWRlbnRpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHRoaXMuZHJvcE1pbWVUeXBlcyA9IG1ldGFkYXRhPy5kcm9wTWltZVR5cGVzID8/IFsnKi8qJ107XG5cdFx0dGhpcy5wcm92aWRlZERyb3BFZGl0S2luZHMgPSBtZXRhZGF0YT8ucHJvdmlkZWREcm9wS2luZHM/Lm1hcChraW5kID0+IG5ldyBIaWVyYXJjaGljYWxLaW5kKGtpbmQpKTtcblxuXHRcdGlmIChtZXRhZGF0YT8uc3VwcG9ydHNSZXNvbHZlKSB7XG5cdFx0XHR0aGlzLnJlc29sdmVEb2N1bWVudERyb3BFZGl0ID0gYXN5bmMgKGVkaXQsIHRva2VuKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHJlc29sdmVkID0gYXdhaXQgdGhpcy5fcHJveHkuJHJlc29sdmVQYXN0ZUVkaXQodGhpcy5faGFuZGxlLCAoPElEb2N1bWVudERyb3BFZGl0RHRvPmVkaXQpLl9jYWNoZUlkISwgdG9rZW4pO1xuXHRcdFx0XHRpZiAocmVzb2x2ZWQuYWRkaXRpb25hbEVkaXQpIHtcblx0XHRcdFx0XHRlZGl0LmFkZGl0aW9uYWxFZGl0ID0gcmV2aXZlV29ya3NwYWNlRWRpdER0byhyZXNvbHZlZC5hZGRpdGlvbmFsRWRpdCwgdGhpcy5fdXJpSWRlbnRTZXJ2aWNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gZWRpdDtcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcHJvdmlkZURvY3VtZW50RHJvcEVkaXRzKG1vZGVsOiBJVGV4dE1vZGVsLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBkYXRhVHJhbnNmZXI6IElSZWFkb25seVZTRGF0YVRyYW5zZmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Eb2N1bWVudERyb3BFZGl0c1Nlc3Npb24gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCByZXF1ZXN0ID0gdGhpcy5kYXRhVHJhbnNmZXJzLmFkZChkYXRhVHJhbnNmZXIpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBkYXRhVHJhbnNmZXJEdG8gPSBhd2FpdCB0eXBlQ29udmVydC5EYXRhVHJhbnNmZXIuZnJvbUxpc3QoZGF0YVRyYW5zZmVyKTtcblx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGVkaXRzID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVEb2N1bWVudE9uRHJvcEVkaXRzKHRoaXMuX2hhbmRsZSwgcmVxdWVzdC5pZCwgbW9kZWwudXJpLCBwb3NpdGlvbiwgZGF0YVRyYW5zZmVyRHRvLCB0b2tlbik7XG5cdFx0XHRpZiAoIWVkaXRzKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0ZWRpdHM6IGVkaXRzLm1hcChlZGl0ID0+IHtcblx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0Li4uZWRpdCxcblx0XHRcdFx0XHRcdHlpZWxkVG86IGVkaXQueWllbGRUbz8ubWFwKHggPT4gKHsga2luZDogbmV3IEhpZXJhcmNoaWNhbEtpbmQoeCkgfSkpLFxuXHRcdFx0XHRcdFx0a2luZDogZWRpdC5raW5kID8gbmV3IEhpZXJhcmNoaWNhbEtpbmQoZWRpdC5raW5kKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdGFkZGl0aW9uYWxFZGl0OiByZXZpdmVXb3Jrc3BhY2VFZGl0RHRvKGVkaXQuYWRkaXRpb25hbEVkaXQsIHRoaXMuX3VyaUlkZW50U2VydmljZSwgZGF0YUlkID0+IHRoaXMucmVzb2x2ZURvY3VtZW50T25Ecm9wRmlsZURhdGEocmVxdWVzdC5pZCwgZGF0YUlkKSksXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fSksXG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kcmVsZWFzZURvY3VtZW50T25Ecm9wRWRpdHModGhpcy5faGFuZGxlLCByZXF1ZXN0LmlkKTtcblx0XHRcdFx0fSxcblx0XHRcdH07XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdHJlcXVlc3QuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyByZXNvbHZlRG9jdW1lbnRPbkRyb3BGaWxlRGF0YShyZXF1ZXN0SWQ6IG51bWJlciwgZGF0YUlkOiBzdHJpbmcpOiBQcm9taXNlPFZTQnVmZmVyPiB7XG5cdFx0cmV0dXJuIHRoaXMuZGF0YVRyYW5zZmVycy5yZXNvbHZlRmlsZURhdGEocmVxdWVzdElkLCBkYXRhSWQpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyIGltcGxlbWVudHMgbGFuZ3VhZ2VzLkRvY3VtZW50U2VtYW50aWNUb2tlbnNQcm92aWRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbGVnZW5kOiBsYW5ndWFnZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQsXG5cdFx0cHVibGljIHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiB8IHVuZGVmaW5lZCxcblx0KSB7XG5cdH1cblxuXHRwdWJsaWMgcmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnMocmVzdWx0SWQ6IHN0cmluZyB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdGlmIChyZXN1bHRJZCkge1xuXHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VEb2N1bWVudFNlbWFudGljVG9rZW5zKHRoaXMuX2hhbmRsZSwgcGFyc2VJbnQocmVzdWx0SWQsIDEwKSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIGdldExlZ2VuZCgpOiBsYW5ndWFnZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQge1xuXHRcdHJldHVybiB0aGlzLl9sZWdlbmQ7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2Vucyhtb2RlbDogSVRleHRNb2RlbCwgbGFzdFJlc3VsdElkOiBzdHJpbmcgfCBudWxsLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5TZW1hbnRpY1Rva2VucyB8IGxhbmd1YWdlcy5TZW1hbnRpY1Rva2Vuc0VkaXRzIHwgbnVsbD4ge1xuXHRcdGNvbnN0IG5MYXN0UmVzdWx0SWQgPSBsYXN0UmVzdWx0SWQgPyBwYXJzZUludChsYXN0UmVzdWx0SWQsIDEwKSA6IDA7XG5cdFx0Y29uc3QgZW5jb2RlZER0byA9IGF3YWl0IHRoaXMuX3Byb3h5LiRwcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2Vucyh0aGlzLl9oYW5kbGUsIG1vZGVsLnVyaSwgbkxhc3RSZXN1bHRJZCwgdG9rZW4pO1xuXHRcdGlmICghZW5jb2RlZER0bykge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdGNvbnN0IGR0byA9IGRlY29kZVNlbWFudGljVG9rZW5zRHRvKGVuY29kZWREdG8pO1xuXHRcdGlmIChkdG8udHlwZSA9PT0gJ2Z1bGwnKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyZXN1bHRJZDogU3RyaW5nKGR0by5pZCksXG5cdFx0XHRcdGRhdGE6IGR0by5kYXRhXG5cdFx0XHR9O1xuXHRcdH1cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzdWx0SWQ6IFN0cmluZyhkdG8uaWQpLFxuXHRcdFx0ZWRpdHM6IGR0by5kZWx0YXNcblx0XHR9O1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zUHJvdmlkZXIgaW1wbGVtZW50cyBsYW5ndWFnZXMuRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zUHJvdmlkZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlc1NoYXBlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xlZ2VuZDogbGFuZ3VhZ2VzLlNlbWFudGljVG9rZW5zTGVnZW5kLFxuXHQpIHtcblx0fVxuXG5cdHB1YmxpYyBnZXRMZWdlbmQoKTogbGFuZ3VhZ2VzLlNlbWFudGljVG9rZW5zTGVnZW5kIHtcblx0XHRyZXR1cm4gdGhpcy5fbGVnZW5kO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZURvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vucyhtb2RlbDogSVRleHRNb2RlbCwgcmFuZ2U6IEVkaXRvclJhbmdlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5TZW1hbnRpY1Rva2VucyB8IG51bGw+IHtcblx0XHRjb25zdCBlbmNvZGVkRHRvID0gYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnModGhpcy5faGFuZGxlLCBtb2RlbC51cmksIHJhbmdlLCB0b2tlbik7XG5cdFx0aWYgKCFlbmNvZGVkRHRvKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0Y29uc3QgZHRvID0gZGVjb2RlU2VtYW50aWNUb2tlbnNEdG8oZW5jb2RlZER0byk7XG5cdFx0aWYgKGR0by50eXBlID09PSAnZnVsbCcpIHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc3VsdElkOiBTdHJpbmcoZHRvLmlkKSxcblx0XHRcdFx0ZGF0YTogZHRvLmRhdGFcblx0XHRcdH07XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcihgVW5leHBlY3RlZGApO1xuXHR9XG59XG5cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBT0EsU0FBUyw4QkFBdUQsc0JBQXNCO0FBQ3RGLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxvQkFBb0IsWUFBWSxlQUFlLG9CQUFvQjtBQUM1RSxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLGNBQWM7QUFDdkIsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsV0FBVztBQUlwQixZQUFZLGVBQWU7QUFDM0IsU0FBUyx3QkFBd0I7QUFFakMsU0FBUyxxQ0FBcUM7QUFFOUMsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywrQkFBK0I7QUFFeEMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw4QkFBOEI7QUFDdkMsWUFBWSxpQkFBaUI7QUFDN0IsU0FBUyw2QkFBNkI7QUFDdEMsWUFBWSxXQUFXO0FBQ3ZCLFlBQVksWUFBWTtBQUN4QixZQUFZLFdBQVc7QUFDdkIsU0FBUyw0QkFBNkM7QUFDdEQsU0FBUyxnQkFBd2lCLHNCQUFzQix3QkFBb0UsbUJBQW9EO0FBR3hyQixJQUFNLDZCQUFOLGNBQXlDLFdBQXNEO0FBQUEsRUFLckcsWUFDQyxnQkFDbUMsa0JBQ2EsK0JBQ0wsMEJBQ0wsa0JBQ3JDO0FBQ0QsVUFBTTtBQUw2QjtBQUNhO0FBQ0w7QUFDTDtBQVB2QyxTQUFpQixpQkFBaUIsS0FBSyxVQUFVLElBQUksY0FBc0IsQ0FBQztBQW9Y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
