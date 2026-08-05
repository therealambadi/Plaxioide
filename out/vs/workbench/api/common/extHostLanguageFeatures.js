import { asArray, coalesce, isFalsyOrEmpty, isNonEmptyArray } from "../../../base/common/arrays.js";
import { raceCancellationError } from "../../../base/common/async.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { NotImplementedError, isCancellationError } from "../../../base/common/errors.js";
import { IdGenerator } from "../../../base/common/idGenerator.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { equals, mixin } from "../../../base/common/objects.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { regExpLeadsToEndlessLoop } from "../../../base/common/strings.js";
import { assertType, isObject } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { Range as EditorRange } from "../../../editor/common/core/range.js";
import { Selection } from "../../../editor/common/core/selection.js";
import * as languages from "../../../editor/common/languages.js";
import { encodeSemanticTokensDto } from "../../../editor/common/services/semanticTokensDto.js";
import { localize } from "../../../nls.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { Cache } from "./cache.js";
import * as extHostProtocol from "./extHost.protocol.js";
import * as typeConvert from "./extHostTypeConverters.js";
import { CodeAction, CodeActionKind, CompletionList, DataTransfer, Disposable, DocumentDropOrPasteEditKind, DocumentSymbol, InlineCompletionTriggerKind, InlineEditTriggerKind, InternalDataTransferItem, Location, NewSymbolNameTriggerKind, Range, SemanticTokens, SemanticTokensEdit, SemanticTokensEdits, SnippetString, SyntaxTokenType } from "./extHostTypes.js";
class DocumentSymbolAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentSymbols(resource, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentSymbols(doc, token);
    if (isFalsyOrEmpty(value)) {
      return void 0;
    } else if (value[0] instanceof DocumentSymbol) {
      return value.map(typeConvert.DocumentSymbol.from);
    } else {
      return DocumentSymbolAdapter._asDocumentSymbolTree(value);
    }
  }
  static _asDocumentSymbolTree(infos) {
    infos = infos.slice(0).sort((a, b) => {
      let res2 = a.location.range.start.compareTo(b.location.range.start);
      if (res2 === 0) {
        res2 = b.location.range.end.compareTo(a.location.range.end);
      }
      return res2;
    });
    const res = [];
    const parentStack = [];
    for (const info of infos) {
      const element = {
        name: info.name || "!!MISSING: name!!",
        kind: typeConvert.SymbolKind.from(info.kind),
        tags: info.tags?.map(typeConvert.SymbolTag.from) || [],
        detail: "",
        containerName: info.containerName,
        range: typeConvert.Range.from(info.location.range),
        selectionRange: typeConvert.Range.from(info.location.range),
        children: []
      };
      while (true) {
        if (parentStack.length === 0) {
          parentStack.push(element);
          res.push(element);
          break;
        }
        const parent = parentStack[parentStack.length - 1];
        if (EditorRange.containsRange(parent.range, element.range) && !EditorRange.equalsRange(parent.range, element.range)) {
          parent.children?.push(element);
          parentStack.push(element);
          break;
        }
        parentStack.pop();
      }
    }
    return res;
  }
}
class CodeLensAdapter {
  constructor(_documents, _commands, _provider, _extension, _extTelemetry, _logService) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._extension = _extension;
    this._extTelemetry = _extTelemetry;
    this._logService = _logService;
    this._cache = new Cache("CodeLens");
    this._disposables = /* @__PURE__ */ new Map();
  }
  async provideCodeLenses(resource, token) {
    const doc = this._documents.getDocument(resource);
    const lenses = await this._provider.provideCodeLenses(doc, token);
    if (!lenses || token.isCancellationRequested) {
      return void 0;
    }
    const cacheId = this._cache.add(lenses);
    const disposables = new DisposableStore();
    this._disposables.set(cacheId, disposables);
    const result = {
      cacheId,
      lenses: []
    };
    for (let i = 0; i < lenses.length; i++) {
      if (!Range.isRange(lenses[i].range)) {
        console.warn("INVALID code lens, range is not defined", this._extension.identifier.value);
        continue;
      }
      result.lenses.push({
        cacheId: [cacheId, i],
        range: typeConvert.Range.from(lenses[i].range),
        command: this._commands.toInternal(lenses[i].command, disposables)
      });
    }
    return result;
  }
  async resolveCodeLens(symbol, token) {
    const lens = symbol.cacheId && this._cache.get(...symbol.cacheId);
    if (!lens) {
      return void 0;
    }
    let resolvedLens;
    if (typeof this._provider.resolveCodeLens !== "function" || lens.isResolved) {
      resolvedLens = lens;
    } else {
      resolvedLens = await this._provider.resolveCodeLens(lens, token);
    }
    if (!resolvedLens) {
      resolvedLens = lens;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const disposables = symbol.cacheId && this._disposables.get(symbol.cacheId[0]);
    if (!disposables) {
      return void 0;
    }
    if (!resolvedLens.command) {
      const error = new Error("INVALID code lens resolved, lacks command: " + this._extension.identifier.value);
      this._extTelemetry.onExtensionError(this._extension.identifier, error);
      this._logService.error(error);
      return void 0;
    }
    symbol.command = this._commands.toInternal(resolvedLens.command, disposables);
    return symbol;
  }
  releaseCodeLenses(cachedId) {
    this._disposables.get(cachedId)?.dispose();
    this._disposables.delete(cachedId);
    this._cache.delete(cachedId);
  }
}
function convertToLocationLinks(value) {
  if (Array.isArray(value)) {
    return value.map(typeConvert.DefinitionLink.from);
  } else if (value) {
    return [typeConvert.DefinitionLink.from(value)];
  }
  return [];
}
class DefinitionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDefinition(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDefinition(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class DeclarationAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDeclaration(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDeclaration(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class ImplementationAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideImplementation(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideImplementation(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
class TypeDefinitionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideTypeDefinition(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideTypeDefinition(doc, pos, token);
    return convertToLocationLinks(value);
  }
}
const _HoverAdapter = class _HoverAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._hoverCounter = 0;
    this._hoverMap = /* @__PURE__ */ new Map();
  }
  async provideHover(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    let value;
    if (context && context.verbosityRequest) {
      const previousHoverId = context.verbosityRequest.previousHover.id;
      const previousHover = this._hoverMap.get(previousHoverId);
      if (!previousHover) {
        throw new Error(`Hover with id ${previousHoverId} not found`);
      }
      const hoverContext = { verbosityDelta: context.verbosityRequest.verbosityDelta, previousHover };
      value = await this._provider.provideHover(doc, pos, token, hoverContext);
    } else {
      value = await this._provider.provideHover(doc, pos, token);
    }
    if (!value || isFalsyOrEmpty(value.contents)) {
      return void 0;
    }
    if (!value.range) {
      value.range = doc.getWordRangeAtPosition(pos);
    }
    if (!value.range) {
      value.range = new Range(pos, pos);
    }
    const convertedHover = typeConvert.Hover.from(value);
    const id = this._hoverCounter;
    if (this._hoverMap.size === _HoverAdapter.HOVER_MAP_MAX_SIZE) {
      const minimumId = Math.min(...this._hoverMap.keys());
      this._hoverMap.delete(minimumId);
    }
    this._hoverMap.set(id, value);
    this._hoverCounter += 1;
    const hover = {
      ...convertedHover,
      id
    };
    return hover;
  }
  releaseHover(id) {
    this._hoverMap.delete(id);
  }
};
_HoverAdapter.HOVER_MAP_MAX_SIZE = 10;
let HoverAdapter = _HoverAdapter;
class EvaluatableExpressionAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideEvaluatableExpression(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideEvaluatableExpression(doc, pos, token);
    if (value) {
      return typeConvert.EvaluatableExpression.from(value);
    }
    return void 0;
  }
}
class InlineValuesAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideInlineValues(resource, viewPort, context, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideInlineValues(doc, typeConvert.Range.to(viewPort), typeConvert.InlineValueContext.to(context), token);
    if (Array.isArray(value)) {
      return value.map((iv) => typeConvert.InlineValue.from(iv));
    }
    return void 0;
  }
}
class DocumentHighlightAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentHighlights(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideDocumentHighlights(doc, pos, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.DocumentHighlight.from);
    }
    return void 0;
  }
}
class MultiDocumentHighlightAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  async provideMultiDocumentHighlights(resource, position, otherResources, token) {
    const doc = this._documents.getDocument(resource);
    const otherDocuments = otherResources.map((r) => {
      try {
        return this._documents.getDocument(r);
      } catch (err) {
        this._logService.error("Error: Unable to retrieve document from URI: " + r + ". Error message: " + err);
        return void 0;
      }
    }).filter((doc2) => doc2 !== void 0);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideMultiDocumentHighlights(doc, pos, otherDocuments, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.MultiDocumentHighlight.from);
    }
    return void 0;
  }
}
class LinkedEditingRangeAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideLinkedEditingRanges(resource, position, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideLinkedEditingRanges(doc, pos, token);
    if (value && Array.isArray(value.ranges)) {
      return {
        ranges: coalesce(value.ranges.map(typeConvert.Range.from)),
        wordPattern: value.wordPattern
      };
    }
    return void 0;
  }
}
class ReferenceAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideReferences(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideReferences(doc, pos, context, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.location.from);
    }
    return void 0;
  }
}
const _CodeActionAdapter = class _CodeActionAdapter {
  constructor(_documents, _commands, _diagnostics, _provider, _logService, _extension, _apiDeprecation) {
    this._documents = _documents;
    this._commands = _commands;
    this._diagnostics = _diagnostics;
    this._provider = _provider;
    this._logService = _logService;
    this._extension = _extension;
    this._apiDeprecation = _apiDeprecation;
    this._cache = new Cache("CodeAction");
    this._disposables = /* @__PURE__ */ new Map();
  }
  async provideCodeActions(resource, rangeOrSelection, context, token) {
    const doc = this._documents.getDocument(resource);
    const ran = Selection.isISelection(rangeOrSelection) ? typeConvert.Selection.to(rangeOrSelection) : typeConvert.Range.to(rangeOrSelection);
    const allDiagnostics = [];
    for (const diagnostic of this._diagnostics.getDiagnostics(resource)) {
      if (ran.intersection(diagnostic.range)) {
        const newLen = allDiagnostics.push(diagnostic);
        if (newLen > _CodeActionAdapter._maxCodeActionsPerFile) {
          break;
        }
      }
    }
    const codeActionContext = {
      diagnostics: allDiagnostics,
      only: context.only ? new CodeActionKind(context.only) : void 0,
      triggerKind: typeConvert.CodeActionTriggerKind.to(context.trigger)
    };
    const commandsOrActions = await this._provider.provideCodeActions(doc, ran, codeActionContext, token);
    if (!isNonEmptyArray(commandsOrActions) || token.isCancellationRequested) {
      return void 0;
    }
    const cacheId = this._cache.add(commandsOrActions);
    const disposables = new DisposableStore();
    this._disposables.set(cacheId, disposables);
    const actions = [];
    for (let i = 0; i < commandsOrActions.length; i++) {
      const candidate = commandsOrActions[i];
      if (!candidate) {
        continue;
      }
      if (_CodeActionAdapter._isCommand(candidate) && !(candidate instanceof CodeAction)) {
        this._apiDeprecation.report(
          "CodeActionProvider.provideCodeActions - return commands",
          this._extension,
          `Return 'CodeAction' instances instead.`
        );
        actions.push({
          _isSynthetic: true,
          title: candidate.title,
          command: this._commands.toInternal(candidate, disposables)
        });
      } else {
        const toConvert = candidate;
        if (codeActionContext.only) {
          if (!toConvert.kind) {
            this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action does not have a 'kind'. Code action will be dropped. Please set 'CodeAction.kind'.`);
          } else if (!codeActionContext.only.contains(toConvert.kind)) {
            this._logService.warn(`${this._extension.identifier.value} - Code actions of kind '${codeActionContext.only.value}' requested but returned code action is of kind '${toConvert.kind.value}'. Code action will be dropped. Please check 'CodeActionContext.only' to only return requested code actions.`);
          }
        }
        const range = toConvert.ranges ?? [];
        actions.push({
          cacheId: [cacheId, i],
          title: toConvert.title,
          command: toConvert.command && this._commands.toInternal(toConvert.command, disposables),
          diagnostics: toConvert.diagnostics && toConvert.diagnostics.map(typeConvert.Diagnostic.from),
          edit: toConvert.edit && typeConvert.WorkspaceEdit.from(toConvert.edit, void 0),
          kind: toConvert.kind && toConvert.kind.value,
          isPreferred: toConvert.isPreferred,
          isAI: isProposedApiEnabled(this._extension, "codeActionAI") ? toConvert.isAI : false,
          ranges: isProposedApiEnabled(this._extension, "codeActionRanges") ? coalesce(range.map(typeConvert.Range.from)) : void 0,
          disabled: toConvert.disabled?.reason
        });
      }
    }
    return { cacheId, actions };
  }
  async resolveCodeAction(id, token) {
    const [sessionId, itemId] = id;
    const item = this._cache.get(sessionId, itemId);
    if (!item || _CodeActionAdapter._isCommand(item)) {
      return {};
    }
    if (!this._provider.resolveCodeAction) {
      return {};
    }
    const resolvedItem = await this._provider.resolveCodeAction(item, token) ?? item;
    let resolvedEdit;
    if (resolvedItem.edit) {
      resolvedEdit = typeConvert.WorkspaceEdit.from(resolvedItem.edit, void 0);
    }
    let resolvedCommand;
    if (resolvedItem.command) {
      const disposables = this._disposables.get(sessionId);
      if (disposables) {
        resolvedCommand = this._commands.toInternal(resolvedItem.command, disposables);
      }
    }
    return { edit: resolvedEdit, command: resolvedCommand };
  }
  releaseCodeActions(cachedId) {
    this._disposables.get(cachedId)?.dispose();
    this._disposables.delete(cachedId);
    this._cache.delete(cachedId);
  }
  static _isCommand(thing) {
    return typeof thing.command === "string" && typeof thing.title === "string";
  }
};
_CodeActionAdapter._maxCodeActionsPerFile = 1e3;
let CodeActionAdapter = _CodeActionAdapter;
class DocumentPasteEditProvider {
  constructor(_proxy, _documents, _provider, _handle, _extension) {
    this._proxy = _proxy;
    this._documents = _documents;
    this._provider = _provider;
    this._handle = _handle;
    this._extension = _extension;
    this._editsCache = new Cache("DocumentPasteEdit.edits");
  }
  async prepareDocumentPaste(resource, ranges, dataTransferDto, token) {
    if (!this._provider.prepareDocumentPaste) {
      return;
    }
    this._cachedPrepare = void 0;
    const doc = this._documents.getDocument(resource);
    const vscodeRanges = ranges.map((range) => typeConvert.Range.to(range));
    const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, () => {
      throw new NotImplementedError();
    });
    await this._provider.prepareDocumentPaste(doc, vscodeRanges, dataTransfer, token);
    if (token.isCancellationRequested) {
      return;
    }
    const newEntries = Array.from(dataTransfer).filter(([, value]) => !(value instanceof InternalDataTransferItem));
    const newCache = /* @__PURE__ */ new Map();
    const items = await Promise.all(Array.from(newEntries, async ([mime, value]) => {
      const id = generateUuid();
      newCache.set(id, value);
      return [mime, await typeConvert.DataTransferItem.from(mime, value, id)];
    }));
    this._cachedPrepare = newCache;
    return { items };
  }
  async providePasteEdits(requestId, resource, ranges, dataTransferDto, context, token) {
    if (!this._provider.provideDocumentPasteEdits) {
      return [];
    }
    const doc = this._documents.getDocument(resource);
    const vscodeRanges = ranges.map((range) => typeConvert.Range.to(range));
    const items = dataTransferDto.items.map(([mime, value]) => {
      const cached = this._cachedPrepare?.get(value.id);
      if (cached) {
        return [mime, cached];
      }
      return [
        mime,
        typeConvert.DataTransferItem.to(mime, value, async (id) => {
          return (await this._proxy.$resolvePasteFileData(this._handle, requestId, id)).buffer;
        })
      ];
    });
    const dataTransfer = new DataTransfer(items);
    const edits = await this._provider.provideDocumentPasteEdits(doc, vscodeRanges, dataTransfer, {
      only: context.only ? new DocumentDropOrPasteEditKind(context.only) : void 0,
      triggerKind: context.triggerKind
    }, token);
    if (!edits || token.isCancellationRequested) {
      return [];
    }
    const cacheId = this._editsCache.add(edits);
    return edits.map((edit, i) => ({
      _cacheId: [cacheId, i],
      title: edit.title ?? localize("defaultPasteLabel", "Paste using '{0}' extension", this._extension.displayName || this._extension.name),
      kind: edit.kind,
      yieldTo: edit.yieldTo?.map((x) => x.value),
      insertText: typeof edit.insertText === "string" ? edit.insertText : { snippet: edit.insertText.value },
      additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, void 0) : void 0
    }));
  }
  async resolvePasteEdit(id, token) {
    const [sessionId, itemId] = id;
    const item = this._editsCache.get(sessionId, itemId);
    if (!item || !this._provider.resolveDocumentPasteEdit) {
      return {};
    }
    const resolvedItem = await this._provider.resolveDocumentPasteEdit(item, token) ?? item;
    return {
      insertText: resolvedItem.insertText,
      additionalEdit: resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, void 0) : void 0
    };
  }
  releasePasteEdits(id) {
    this._editsCache.delete(id);
  }
}
class DocumentFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentFormattingEdits(resource, options, token) {
    const document = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentFormattingEdits(document, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class RangeFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentRangeFormattingEdits(resource, range, options, token) {
    const document = this._documents.getDocument(resource);
    const ran = typeConvert.Range.to(range);
    const value = await this._provider.provideDocumentRangeFormattingEdits(document, ran, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
  async provideDocumentRangesFormattingEdits(resource, ranges, options, token) {
    assertType(typeof this._provider.provideDocumentRangesFormattingEdits === "function", "INVALID invocation of `provideDocumentRangesFormattingEdits`");
    const document = this._documents.getDocument(resource);
    const _ranges = ranges.map(typeConvert.Range.to);
    const value = await this._provider.provideDocumentRangesFormattingEdits(document, _ranges, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class OnTypeFormattingAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this.autoFormatTriggerCharacters = [];
  }
  // not here
  async provideOnTypeFormattingEdits(resource, position, ch, options, token) {
    const document = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const value = await this._provider.provideOnTypeFormattingEdits(document, pos, ch, options, token);
    if (Array.isArray(value)) {
      return value.map(typeConvert.TextEdit.from);
    }
    return void 0;
  }
}
class NavigateTypeAdapter {
  constructor(_provider, _logService) {
    this._provider = _provider;
    this._logService = _logService;
    this._cache = new Cache("WorkspaceSymbols");
  }
  async provideWorkspaceSymbols(search, token) {
    const value = await this._provider.provideWorkspaceSymbols(search, token);
    if (!isNonEmptyArray(value)) {
      return { symbols: [] };
    }
    const sid = this._cache.add(value);
    const result = {
      cacheId: sid,
      symbols: []
    };
    for (let i = 0; i < value.length; i++) {
      const item = value[i];
      if (!item || !item.name) {
        this._logService.warn("INVALID SymbolInformation", item);
        continue;
      }
      result.symbols.push({
        ...typeConvert.WorkspaceSymbol.from(item),
        cacheId: [sid, i]
      });
    }
    return result;
  }
  async resolveWorkspaceSymbol(symbol, token) {
    if (typeof this._provider.resolveWorkspaceSymbol !== "function") {
      return symbol;
    }
    if (!symbol.cacheId) {
      return symbol;
    }
    const item = this._cache.get(...symbol.cacheId);
    if (item) {
      const value = await this._provider.resolveWorkspaceSymbol(item, token);
      return value && mixin(symbol, typeConvert.WorkspaceSymbol.from(value), true);
    }
    return void 0;
  }
  releaseWorkspaceSymbols(id) {
    this._cache.delete(id);
  }
}
class RenameAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  static supportsResolving(provider) {
    return typeof provider.prepareRename === "function";
  }
  async provideRenameEdits(resource, position, newName, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    try {
      const value = await this._provider.provideRenameEdits(doc, pos, newName, token);
      if (!value) {
        return void 0;
      }
      return typeConvert.WorkspaceEdit.from(value);
    } catch (err) {
      const rejectReason = RenameAdapter._asMessage(err);
      if (rejectReason) {
        return { rejectReason, edits: void 0 };
      } else {
        return Promise.reject(err);
      }
    }
  }
  async resolveRenameLocation(resource, position, token) {
    if (typeof this._provider.prepareRename !== "function") {
      return Promise.resolve(void 0);
    }
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    try {
      const rangeOrLocation = await this._provider.prepareRename(doc, pos, token);
      let range;
      let text;
      if (Range.isRange(rangeOrLocation)) {
        range = rangeOrLocation;
        text = doc.getText(rangeOrLocation);
      } else if (isObject(rangeOrLocation)) {
        range = rangeOrLocation.range;
        text = rangeOrLocation.placeholder;
      }
      if (!range || !text) {
        return void 0;
      }
      if (range.start.line > pos.line || range.end.line < pos.line) {
        this._logService.warn("INVALID rename location: position line must be within range start/end lines");
        return void 0;
      }
      return { range: typeConvert.Range.from(range), text };
    } catch (err) {
      const rejectReason = RenameAdapter._asMessage(err);
      if (rejectReason) {
        return { rejectReason, range: void 0, text: void 0 };
      } else {
        return Promise.reject(err);
      }
    }
  }
  static _asMessage(err) {
    if (typeof err === "string") {
      return err;
    } else if (err instanceof Error && typeof err.message === "string") {
      return err.message;
    } else {
      return void 0;
    }
  }
}
const _NewSymbolNamesAdapter = class _NewSymbolNamesAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  async supportsAutomaticNewSymbolNamesTriggerKind() {
    return this._provider.supportsAutomaticTriggerKind;
  }
  async provideNewSymbolNames(resource, range, triggerKind, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Range.to(range);
    try {
      const kind = _NewSymbolNamesAdapter.languageTriggerKindToVSCodeTriggerKind[triggerKind];
      const value = await this._provider.provideNewSymbolNames(doc, pos, kind, token);
      if (!value) {
        return void 0;
      }
      return value.map(
        (v) => typeof v === "string" ? { newSymbolName: v } : { newSymbolName: v.newSymbolName, tags: v.tags }
      );
    } catch (err) {
      this._logService.error(
        _NewSymbolNamesAdapter._asMessage(err) ?? JSON.stringify(err, null, "	")
        /* @ulugbekna: assuming `err` doesn't have circular references that could result in an exception when converting to JSON */
      );
      return void 0;
    }
  }
  // @ulugbekna: this method is also defined in RenameAdapter but seems OK to be duplicated
  static _asMessage(err) {
    if (typeof err === "string") {
      return err;
    } else if (err instanceof Error && typeof err.message === "string") {
      return err.message;
    } else {
      return void 0;
    }
  }
};
_NewSymbolNamesAdapter.languageTriggerKindToVSCodeTriggerKind = {
  [languages.NewSymbolNameTriggerKind.Invoke]: NewSymbolNameTriggerKind.Invoke,
  [languages.NewSymbolNameTriggerKind.Automatic]: NewSymbolNameTriggerKind.Automatic
};
let NewSymbolNamesAdapter = _NewSymbolNamesAdapter;
class SemanticTokensPreviousResult {
  constructor(resultId, tokens) {
    this.resultId = resultId;
    this.tokens = tokens;
  }
}
class DocumentSemanticTokensAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._nextResultId = 1;
    this._previousResults = /* @__PURE__ */ new Map();
  }
  async provideDocumentSemanticTokens(resource, previousResultId, token) {
    const doc = this._documents.getDocument(resource);
    const previousResult = previousResultId !== 0 ? this._previousResults.get(previousResultId) : null;
    let value = typeof previousResult?.resultId === "string" && typeof this._provider.provideDocumentSemanticTokensEdits === "function" ? await this._provider.provideDocumentSemanticTokensEdits(doc, previousResult.resultId, token) : await this._provider.provideDocumentSemanticTokens(doc, token);
    if (previousResult) {
      this._previousResults.delete(previousResultId);
    }
    if (!value) {
      return null;
    }
    value = DocumentSemanticTokensAdapter._fixProvidedSemanticTokens(value);
    return this._send(DocumentSemanticTokensAdapter._convertToEdits(previousResult, value), value);
  }
  async releaseDocumentSemanticColoring(semanticColoringResultId) {
    this._previousResults.delete(semanticColoringResultId);
  }
  static _fixProvidedSemanticTokens(v) {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokens(v)) {
        return v;
      }
      return new SemanticTokens(new Uint32Array(v.data), v.resultId);
    } else if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(v)) {
      if (DocumentSemanticTokensAdapter._isCorrectSemanticTokensEdits(v)) {
        return v;
      }
      return new SemanticTokensEdits(v.edits.map((edit) => new SemanticTokensEdit(edit.start, edit.deleteCount, edit.data ? new Uint32Array(edit.data) : edit.data)), v.resultId);
    }
    return v;
  }
  static _isSemanticTokens(v) {
    return v && !!v.data;
  }
  static _isCorrectSemanticTokens(v) {
    return v.data instanceof Uint32Array;
  }
  static _isSemanticTokensEdits(v) {
    return v && Array.isArray(v.edits);
  }
  static _isCorrectSemanticTokensEdits(v) {
    for (const edit of v.edits) {
      if (!(edit.data instanceof Uint32Array)) {
        return false;
      }
    }
    return true;
  }
  static _convertToEdits(previousResult, newResult) {
    if (!DocumentSemanticTokensAdapter._isSemanticTokens(newResult)) {
      return newResult;
    }
    if (!previousResult || !previousResult.tokens) {
      return newResult;
    }
    const oldData = previousResult.tokens;
    const oldLength = oldData.length;
    const newData = newResult.data;
    const newLength = newData.length;
    let commonPrefixLength = 0;
    const maxCommonPrefixLength = Math.min(oldLength, newLength);
    while (commonPrefixLength < maxCommonPrefixLength && oldData[commonPrefixLength] === newData[commonPrefixLength]) {
      commonPrefixLength++;
    }
    if (commonPrefixLength === oldLength && commonPrefixLength === newLength) {
      return new SemanticTokensEdits([], newResult.resultId);
    }
    let commonSuffixLength = 0;
    const maxCommonSuffixLength = maxCommonPrefixLength - commonPrefixLength;
    while (commonSuffixLength < maxCommonSuffixLength && oldData[oldLength - commonSuffixLength - 1] === newData[newLength - commonSuffixLength - 1]) {
      commonSuffixLength++;
    }
    return new SemanticTokensEdits([{
      start: commonPrefixLength,
      deleteCount: oldLength - commonPrefixLength - commonSuffixLength,
      data: newData.subarray(commonPrefixLength, newLength - commonSuffixLength)
    }], newResult.resultId);
  }
  _send(value, original) {
    if (DocumentSemanticTokensAdapter._isSemanticTokens(value)) {
      const myId = this._nextResultId++;
      this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId, value.data));
      return encodeSemanticTokensDto({
        id: myId,
        type: "full",
        data: value.data
      });
    }
    if (DocumentSemanticTokensAdapter._isSemanticTokensEdits(value)) {
      const myId = this._nextResultId++;
      if (DocumentSemanticTokensAdapter._isSemanticTokens(original)) {
        this._previousResults.set(myId, new SemanticTokensPreviousResult(original.resultId, original.data));
      } else {
        this._previousResults.set(myId, new SemanticTokensPreviousResult(value.resultId));
      }
      return encodeSemanticTokensDto({
        id: myId,
        type: "delta",
        deltas: (value.edits || []).map((edit) => ({ start: edit.start, deleteCount: edit.deleteCount, data: edit.data }))
      });
    }
    return null;
  }
}
class DocumentRangeSemanticTokensAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideDocumentRangeSemanticTokens(resource, range, token) {
    const doc = this._documents.getDocument(resource);
    const value = await this._provider.provideDocumentRangeSemanticTokens(doc, typeConvert.Range.to(range), token);
    if (!value) {
      return null;
    }
    return this._send(value);
  }
  _send(value) {
    return encodeSemanticTokensDto({
      id: 0,
      type: "full",
      data: value.data
    });
  }
}
class CompletionsAdapter {
  constructor(_documents, _commands, _provider, _apiDeprecation, _extension) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._apiDeprecation = _apiDeprecation;
    this._extension = _extension;
    this._cache = new Cache("CompletionItem");
    this._disposables = /* @__PURE__ */ new Map();
  }
  static supportsResolving(provider) {
    return typeof provider.resolveCompletionItem === "function";
  }
  async provideCompletionItems(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const replaceRange = doc.getWordRangeAtPosition(pos) || new Range(pos, pos);
    const insertRange = replaceRange.with({ end: pos });
    const sw = new StopWatch();
    const itemsOrList = await this._provider.provideCompletionItems(doc, pos, token, typeConvert.CompletionContext.to(context));
    if (!itemsOrList) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const list = Array.isArray(itemsOrList) ? new CompletionList(itemsOrList) : itemsOrList;
    const pid = CompletionsAdapter.supportsResolving(this._provider) ? this._cache.add(list.items) : this._cache.add([]);
    const disposables = new DisposableStore();
    this._disposables.set(pid, disposables);
    const completions = [];
    const result = {
      x: pid,
      [extHostProtocol.ISuggestResultDtoField.completions]: completions,
      [extHostProtocol.ISuggestResultDtoField.defaultRanges]: { replace: typeConvert.Range.from(replaceRange), insert: typeConvert.Range.from(insertRange) },
      [extHostProtocol.ISuggestResultDtoField.isIncomplete]: list.isIncomplete || void 0,
      [extHostProtocol.ISuggestResultDtoField.duration]: sw.elapsed()
    };
    for (let i = 0; i < list.items.length; i++) {
      const item = list.items[i];
      const dto = this._convertCompletionItem(item, [pid, i], insertRange, replaceRange);
      completions.push(dto);
    }
    return result;
  }
  async resolveCompletionItem(id, token) {
    if (typeof this._provider.resolveCompletionItem !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const dto1 = this._convertCompletionItem(item, id);
    const resolvedItem = await this._provider.resolveCompletionItem(item, token);
    if (!resolvedItem) {
      return void 0;
    }
    const dto2 = this._convertCompletionItem(resolvedItem, id);
    if (dto1[extHostProtocol.ISuggestDataDtoField.insertText] !== dto2[extHostProtocol.ISuggestDataDtoField.insertText] || dto1[extHostProtocol.ISuggestDataDtoField.insertTextRules] !== dto2[extHostProtocol.ISuggestDataDtoField.insertTextRules]) {
      this._apiDeprecation.report("CompletionItem.insertText", this._extension, "extension MAY NOT change 'insertText' of a CompletionItem during resolve");
    }
    if (dto1[extHostProtocol.ISuggestDataDtoField.commandIdent] !== dto2[extHostProtocol.ISuggestDataDtoField.commandIdent] || dto1[extHostProtocol.ISuggestDataDtoField.commandId] !== dto2[extHostProtocol.ISuggestDataDtoField.commandId] || !equals(dto1[extHostProtocol.ISuggestDataDtoField.commandArguments], dto2[extHostProtocol.ISuggestDataDtoField.commandArguments])) {
      this._apiDeprecation.report("CompletionItem.command", this._extension, "extension MAY NOT change 'command' of a CompletionItem during resolve");
    }
    return {
      ...dto1,
      [extHostProtocol.ISuggestDataDtoField.documentation]: dto2[extHostProtocol.ISuggestDataDtoField.documentation],
      [extHostProtocol.ISuggestDataDtoField.detail]: dto2[extHostProtocol.ISuggestDataDtoField.detail],
      [extHostProtocol.ISuggestDataDtoField.additionalTextEdits]: dto2[extHostProtocol.ISuggestDataDtoField.additionalTextEdits],
      // (fishy) async insertText
      [extHostProtocol.ISuggestDataDtoField.insertText]: dto2[extHostProtocol.ISuggestDataDtoField.insertText],
      [extHostProtocol.ISuggestDataDtoField.insertTextRules]: dto2[extHostProtocol.ISuggestDataDtoField.insertTextRules],
      // (fishy) async command
      [extHostProtocol.ISuggestDataDtoField.commandIdent]: dto2[extHostProtocol.ISuggestDataDtoField.commandIdent],
      [extHostProtocol.ISuggestDataDtoField.commandId]: dto2[extHostProtocol.ISuggestDataDtoField.commandId],
      [extHostProtocol.ISuggestDataDtoField.commandArguments]: dto2[extHostProtocol.ISuggestDataDtoField.commandArguments]
    };
  }
  releaseCompletionItems(id) {
    this._disposables.get(id)?.dispose();
    this._disposables.delete(id);
    this._cache.delete(id);
  }
  _convertCompletionItem(item, id, defaultInsertRange, defaultReplaceRange) {
    const disposables = this._disposables.get(id[0]);
    if (!disposables) {
      throw Error("DisposableStore is missing...");
    }
    const command = this._commands.toInternal(item.command, disposables);
    const result = {
      //
      x: id,
      //
      [extHostProtocol.ISuggestDataDtoField.label]: item.label,
      [extHostProtocol.ISuggestDataDtoField.kind]: item.kind !== void 0 ? typeConvert.CompletionItemKind.from(item.kind) : void 0,
      [extHostProtocol.ISuggestDataDtoField.kindModifier]: item.tags && item.tags.map(typeConvert.CompletionItemTag.from),
      [extHostProtocol.ISuggestDataDtoField.detail]: item.detail,
      [extHostProtocol.ISuggestDataDtoField.documentation]: typeof item.documentation === "undefined" ? void 0 : typeConvert.MarkdownString.fromStrict(item.documentation),
      [extHostProtocol.ISuggestDataDtoField.sortText]: item.sortText !== item.label ? item.sortText : void 0,
      [extHostProtocol.ISuggestDataDtoField.filterText]: item.filterText !== item.label ? item.filterText : void 0,
      [extHostProtocol.ISuggestDataDtoField.preselect]: item.preselect || void 0,
      [extHostProtocol.ISuggestDataDtoField.insertTextRules]: item.keepWhitespace ? languages.CompletionItemInsertTextRule.KeepWhitespace : languages.CompletionItemInsertTextRule.None,
      [extHostProtocol.ISuggestDataDtoField.commitCharacters]: item.commitCharacters?.join(""),
      [extHostProtocol.ISuggestDataDtoField.additionalTextEdits]: item.additionalTextEdits && item.additionalTextEdits.map(typeConvert.TextEdit.from),
      [extHostProtocol.ISuggestDataDtoField.commandIdent]: command?.$ident,
      [extHostProtocol.ISuggestDataDtoField.commandId]: command?.id,
      [extHostProtocol.ISuggestDataDtoField.commandArguments]: command?.$ident ? void 0 : command?.arguments
      // filled in on main side from $ident
    };
    if (item.textEdit) {
      this._apiDeprecation.report("CompletionItem.textEdit", this._extension, `Use 'CompletionItem.insertText' and 'CompletionItem.range' instead.`);
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.textEdit.newText;
    } else if (typeof item.insertText === "string") {
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.insertText;
    } else if (item.insertText instanceof SnippetString) {
      result[extHostProtocol.ISuggestDataDtoField.insertText] = item.insertText.value;
      result[extHostProtocol.ISuggestDataDtoField.insertTextRules] |= languages.CompletionItemInsertTextRule.InsertAsSnippet;
    }
    let range;
    if (item.textEdit) {
      range = item.textEdit.range;
    } else if (item.range) {
      range = item.range;
    }
    if (Range.isRange(range)) {
      result[extHostProtocol.ISuggestDataDtoField.range] = typeConvert.Range.from(range);
    } else if (range && (!defaultInsertRange?.isEqual(range.inserting) || !defaultReplaceRange?.isEqual(range.replacing))) {
      result[extHostProtocol.ISuggestDataDtoField.range] = {
        insert: typeConvert.Range.from(range.inserting),
        replace: typeConvert.Range.from(range.replacing)
      };
    }
    return result;
  }
}
class InlineCompletionAdapter {
  constructor(_extension, _documents, _provider, _commands) {
    this._extension = _extension;
    this._documents = _documents;
    this._provider = _provider;
    this._commands = _commands;
    this._references = new ReferenceMap();
    this._isAdditionsProposedApiEnabled = isProposedApiEnabled(this._extension, "inlineCompletionsAdditions");
    this.languageTriggerKindToVSCodeTriggerKind = {
      [languages.InlineCompletionTriggerKind.Automatic]: InlineCompletionTriggerKind.Automatic,
      [languages.InlineCompletionTriggerKind.Explicit]: InlineCompletionTriggerKind.Invoke
    };
  }
  get supportsHandleEvents() {
    return isProposedApiEnabled(this._extension, "inlineCompletionsAdditions") && (typeof this._provider.handleDidShowCompletionItem === "function" || typeof this._provider.handleDidPartiallyAcceptCompletionItem === "function" || typeof this._provider.handleDidRejectCompletionItem === "function");
  }
  async provideInlineCompletions(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const result = await this._provider.provideInlineCompletionItems(doc, pos, {
      selectedCompletionInfo: context.selectedSuggestionInfo ? {
        range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
        text: context.selectedSuggestionInfo.text
      } : void 0,
      triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
      requestUuid: context.requestUuid
    }, token);
    if (!result) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const normalizedResult = Array.isArray(result) ? result : result.items;
    const commands = this._isAdditionsProposedApiEnabled ? Array.isArray(result) ? [] : result.commands || [] : [];
    const enableForwardStability = this._isAdditionsProposedApiEnabled && !Array.isArray(result) ? result.enableForwardStability : void 0;
    let disposableStore = void 0;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      items: normalizedResult
    });
    return {
      pid,
      items: normalizedResult.map((item, idx) => {
        let command = void 0;
        if (item.command) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          command = this._commands.toInternal(item.command, disposableStore);
        }
        let action = void 0;
        if (item.action) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          action = this._commands.toInternal(item.action, disposableStore);
        }
        const insertText = item.insertText;
        return {
          insertText: typeof insertText === "string" ? insertText : { snippet: insertText.value },
          filterText: item.filterText,
          range: item.range ? typeConvert.Range.from(item.range) : void 0,
          showRange: this._isAdditionsProposedApiEnabled && item.showRange ? typeConvert.Range.from(item.showRange) : void 0,
          command,
          action,
          idx,
          completeBracketPairs: this._isAdditionsProposedApiEnabled ? item.completeBracketPairs : false,
          isInlineEdit: this._isAdditionsProposedApiEnabled ? item.isInlineEdit : false,
          showInlineEditMenu: this._isAdditionsProposedApiEnabled ? item.showInlineEditMenu : false,
          warning: item.warning && this._isAdditionsProposedApiEnabled ? {
            message: typeConvert.MarkdownString.from(item.warning.message),
            icon: item.warning.icon ? typeConvert.IconPath.fromThemeIcon(item.warning.icon) : void 0
          } : void 0
        };
      }),
      commands: commands.map((c) => {
        if (!disposableStore) {
          disposableStore = new DisposableStore();
        }
        return this._commands.toInternal(c, disposableStore);
      }),
      suppressSuggestions: false,
      enableForwardStability
    };
  }
  async provideInlineEditsForRange(resource, range, context, token) {
    if (!this._provider.provideInlineEditsForRange) {
      return void 0;
    }
    checkProposedApiEnabled(this._extension, "inlineCompletionsAdditions");
    const doc = this._documents.getDocument(resource);
    const r = typeConvert.Range.to(range);
    const result = await this._provider.provideInlineEditsForRange(doc, r, {
      selectedCompletionInfo: context.selectedSuggestionInfo ? {
        range: typeConvert.Range.to(context.selectedSuggestionInfo.range),
        text: context.selectedSuggestionInfo.text
      } : void 0,
      triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
      userPrompt: context.userPrompt,
      requestUuid: context.requestUuid
    }, token);
    if (!result) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const normalizedResult = Array.isArray(result) ? result : result.items;
    const commands = this._isAdditionsProposedApiEnabled ? Array.isArray(result) ? [] : result.commands || [] : [];
    const enableForwardStability = this._isAdditionsProposedApiEnabled && !Array.isArray(result) ? result.enableForwardStability : void 0;
    let disposableStore = void 0;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      items: normalizedResult
    });
    return {
      pid,
      items: normalizedResult.map((item, idx) => {
        let command = void 0;
        if (item.command) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          command = this._commands.toInternal(item.command, disposableStore);
        }
        let action = void 0;
        if (item.action) {
          if (!disposableStore) {
            disposableStore = new DisposableStore();
          }
          action = this._commands.toInternal(item.action, disposableStore);
        }
        const insertText = item.insertText;
        return {
          insertText: typeof insertText === "string" ? insertText : { snippet: insertText.value },
          filterText: item.filterText,
          range: item.range ? typeConvert.Range.from(item.range) : void 0,
          command,
          action,
          idx,
          completeBracketPairs: this._isAdditionsProposedApiEnabled ? item.completeBracketPairs : false
        };
      }),
      commands: commands.map((c) => {
        if (!disposableStore) {
          disposableStore = new DisposableStore();
        }
        return this._commands.toInternal(c, disposableStore);
      }),
      suppressSuggestions: false,
      enableForwardStability
    };
  }
  disposeCompletions(pid) {
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }
  handleDidShowCompletionItem(pid, idx, updatedInsertText) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidShowCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidShowCompletionItem(completionItem, updatedInsertText);
      }
    }
  }
  handlePartialAccept(pid, idx, acceptedCharacters, info) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidPartiallyAcceptCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, acceptedCharacters);
        this._provider.handleDidPartiallyAcceptCompletionItem(completionItem, typeConvert.PartialAcceptInfo.to(info));
      }
    }
  }
  handleRejection(pid, idx) {
    const completionItem = this._references.get(pid)?.items[idx];
    if (completionItem) {
      if (this._provider.handleDidRejectCompletionItem && this._isAdditionsProposedApiEnabled) {
        this._provider.handleDidRejectCompletionItem(completionItem);
      }
    }
  }
}
class InlineEditAdapter {
  constructor(_extension, _documents, _provider, _commands) {
    this._documents = _documents;
    this._provider = _provider;
    this._commands = _commands;
    this._references = new ReferenceMap();
    this.languageTriggerKindToVSCodeTriggerKind = {
      [languages.InlineEditTriggerKind.Automatic]: InlineEditTriggerKind.Automatic,
      [languages.InlineEditTriggerKind.Invoke]: InlineEditTriggerKind.Invoke
    };
  }
  async provideInlineEdits(uri, context, token) {
    const doc = this._documents.getDocument(uri);
    const result = await this._provider.provideInlineEdit(doc, {
      triggerKind: this.languageTriggerKindToVSCodeTriggerKind[context.triggerKind],
      requestUuid: context.requestUuid
    }, token);
    if (!result) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    let disposableStore = void 0;
    const pid = this._references.createReferenceId({
      dispose() {
        disposableStore?.dispose();
      },
      item: result
    });
    let acceptCommand = void 0;
    if (result.accepted) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      acceptCommand = this._commands.toInternal(result.accepted, disposableStore);
    }
    let rejectCommand = void 0;
    if (result.rejected) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      rejectCommand = this._commands.toInternal(result.rejected, disposableStore);
    }
    let shownCommand = void 0;
    if (result.shown) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      shownCommand = this._commands.toInternal(result.shown, disposableStore);
    }
    let action = void 0;
    if (result.action) {
      if (!disposableStore) {
        disposableStore = new DisposableStore();
      }
      action = this._commands.toInternal(result.action, disposableStore);
    }
    if (!disposableStore) {
      disposableStore = new DisposableStore();
    }
    const langResult = {
      pid,
      text: result.text,
      range: typeConvert.Range.from(result.range),
      showRange: typeConvert.Range.from(result.showRange),
      accepted: acceptCommand,
      rejected: rejectCommand,
      shown: shownCommand,
      action,
      commands: result.commands?.map((c) => this._commands.toInternal(c, disposableStore))
    };
    return langResult;
  }
  disposeEdit(pid) {
    const data = this._references.disposeReferenceId(pid);
    data?.dispose();
  }
}
class ReferenceMap {
  constructor() {
    this._references = /* @__PURE__ */ new Map();
    this._idPool = 1;
  }
  createReferenceId(value) {
    const id = this._idPool++;
    this._references.set(id, value);
    return id;
  }
  disposeReferenceId(referenceId) {
    const value = this._references.get(referenceId);
    this._references.delete(referenceId);
    return value;
  }
  get(referenceId) {
    return this._references.get(referenceId);
  }
}
class SignatureHelpAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._cache = new Cache("SignatureHelp");
  }
  async provideSignatureHelp(resource, position, context, token) {
    const doc = this._documents.getDocument(resource);
    const pos = typeConvert.Position.to(position);
    const vscodeContext = this.reviveContext(context);
    const value = await this._provider.provideSignatureHelp(doc, pos, token, vscodeContext);
    if (value) {
      const id = this._cache.add([value]);
      return { ...typeConvert.SignatureHelp.from(value), id };
    }
    return void 0;
  }
  reviveContext(context) {
    let activeSignatureHelp = void 0;
    if (context.activeSignatureHelp) {
      const revivedSignatureHelp = typeConvert.SignatureHelp.to(context.activeSignatureHelp);
      const saved = this._cache.get(context.activeSignatureHelp.id, 0);
      if (saved) {
        activeSignatureHelp = saved;
        activeSignatureHelp.activeSignature = revivedSignatureHelp.activeSignature;
        activeSignatureHelp.activeParameter = revivedSignatureHelp.activeParameter;
      } else {
        activeSignatureHelp = revivedSignatureHelp;
      }
    }
    return { ...context, activeSignatureHelp };
  }
  releaseSignatureHelp(id) {
    this._cache.delete(id);
  }
}
class InlayHintsAdapter {
  constructor(_documents, _commands, _provider, _logService, _extension) {
    this._documents = _documents;
    this._commands = _commands;
    this._provider = _provider;
    this._logService = _logService;
    this._extension = _extension;
    this._cache = new Cache("InlayHints");
    this._disposables = /* @__PURE__ */ new Map();
  }
  async provideInlayHints(resource, ran, token) {
    const doc = this._documents.getDocument(resource);
    const range = typeConvert.Range.to(ran);
    const hints = await this._provider.provideInlayHints(doc, range, token);
    if (!Array.isArray(hints) || hints.length === 0) {
      this._logService.trace(`[InlayHints] NO inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const pid = this._cache.add(hints);
    this._disposables.set(pid, new DisposableStore());
    const result = { hints: [], cacheId: pid };
    for (let i = 0; i < hints.length; i++) {
      if (this._isValidInlayHint(hints[i], range)) {
        result.hints.push(this._convertInlayHint(hints[i], [pid, i]));
      }
    }
    this._logService.trace(`[InlayHints] ${result.hints.length} inlay hints from '${this._extension.identifier.value}' for range ${JSON.stringify(ran)}`);
    return result;
  }
  async resolveInlayHint(id, token) {
    if (typeof this._provider.resolveInlayHint !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const hint = await this._provider.resolveInlayHint(item, token);
    if (!hint) {
      return void 0;
    }
    if (!this._isValidInlayHint(hint)) {
      return void 0;
    }
    return this._convertInlayHint(hint, id);
  }
  releaseHints(id) {
    this._disposables.get(id)?.dispose();
    this._disposables.delete(id);
    this._cache.delete(id);
  }
  _isValidInlayHint(hint, range) {
    if (hint.label.length === 0 || Array.isArray(hint.label) && hint.label.every((part) => part.value.length === 0)) {
      console.log("INVALID inlay hint, empty label", hint);
      return false;
    }
    if (range && !range.contains(hint.position)) {
      return false;
    }
    return true;
  }
  _convertInlayHint(hint, id) {
    const disposables = this._disposables.get(id[0]);
    if (!disposables) {
      throw Error("DisposableStore is missing...");
    }
    const result = {
      label: "",
      // fill-in below
      cacheId: id,
      tooltip: typeConvert.MarkdownString.fromStrict(hint.tooltip),
      position: typeConvert.Position.from(hint.position),
      textEdits: hint.textEdits && hint.textEdits.map(typeConvert.TextEdit.from),
      kind: hint.kind && typeConvert.InlayHintKind.from(hint.kind),
      paddingLeft: hint.paddingLeft,
      paddingRight: hint.paddingRight
    };
    if (typeof hint.label === "string") {
      result.label = hint.label;
    } else {
      const parts = [];
      result.label = parts;
      for (const part of hint.label) {
        if (!part.value) {
          console.warn("INVALID inlay hint, empty label part", this._extension.identifier.value);
          continue;
        }
        const part2 = {
          label: part.value,
          tooltip: typeConvert.MarkdownString.fromStrict(part.tooltip)
        };
        if (Location.isLocation(part.location)) {
          part2.location = typeConvert.location.from(part.location);
        }
        if (part.command) {
          part2.command = this._commands.toInternal(part.command, disposables);
        }
        parts.push(part2);
      }
    }
    return result;
  }
}
class LinkProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._cache = new Cache("DocumentLink");
  }
  async provideLinks(resource, token) {
    const doc = this._documents.getDocument(resource);
    const links = await this._provider.provideDocumentLinks(doc, token);
    if (!Array.isArray(links) || links.length === 0) {
      return void 0;
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (typeof this._provider.resolveDocumentLink !== "function") {
      return { links: links.filter(LinkProviderAdapter._validateLink).map(typeConvert.DocumentLink.from) };
    } else {
      const pid = this._cache.add(links);
      const result = { links: [], cacheId: pid };
      for (let i = 0; i < links.length; i++) {
        if (!LinkProviderAdapter._validateLink(links[i])) {
          continue;
        }
        const dto = typeConvert.DocumentLink.from(links[i]);
        dto.cacheId = [pid, i];
        result.links.push(dto);
      }
      return result;
    }
  }
  static _validateLink(link) {
    if (link.target && link.target.path.length > 5e4) {
      console.warn("DROPPING link because it is too long");
      return false;
    }
    return true;
  }
  async resolveLink(id, token) {
    if (typeof this._provider.resolveDocumentLink !== "function") {
      return void 0;
    }
    const item = this._cache.get(...id);
    if (!item) {
      return void 0;
    }
    const link = await this._provider.resolveDocumentLink(item, token);
    if (!link || !LinkProviderAdapter._validateLink(link)) {
      return void 0;
    }
    return typeConvert.DocumentLink.from(link);
  }
  releaseLinks(id) {
    this._cache.delete(id);
  }
}
class ColorProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideColors(resource, token) {
    const doc = this._documents.getDocument(resource);
    const colors = await this._provider.provideDocumentColors(doc, token);
    if (!Array.isArray(colors)) {
      return [];
    }
    const colorInfos = colors.map((ci) => {
      return {
        color: typeConvert.Color.from(ci.color),
        range: typeConvert.Range.from(ci.range)
      };
    });
    return colorInfos;
  }
  async provideColorPresentations(resource, raw, token) {
    const document = this._documents.getDocument(resource);
    const range = typeConvert.Range.to(raw.range);
    const color = typeConvert.Color.to(raw.color);
    const value = await this._provider.provideColorPresentations(color, { document, range }, token);
    if (!Array.isArray(value)) {
      return void 0;
    }
    return value.map(typeConvert.ColorPresentation.from);
  }
}
class FoldingProviderAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
  }
  async provideFoldingRanges(resource, context, token) {
    const doc = this._documents.getDocument(resource);
    const ranges = await this._provider.provideFoldingRanges(doc, context, token);
    if (!Array.isArray(ranges)) {
      return void 0;
    }
    return ranges.map(typeConvert.FoldingRange.from);
  }
}
class SelectionRangeAdapter {
  constructor(_documents, _provider, _logService) {
    this._documents = _documents;
    this._provider = _provider;
    this._logService = _logService;
  }
  async provideSelectionRanges(resource, pos, token) {
    const document = this._documents.getDocument(resource);
    const positions = pos.map(typeConvert.Position.to);
    const allProviderRanges = await this._provider.provideSelectionRanges(document, positions, token);
    if (!isNonEmptyArray(allProviderRanges)) {
      return [];
    }
    if (allProviderRanges.length !== positions.length) {
      this._logService.warn("BAD selection ranges, provider must return ranges for each position");
      return [];
    }
    const allResults = [];
    for (let i = 0; i < positions.length; i++) {
      const oneResult = [];
      allResults.push(oneResult);
      let last = positions[i];
      let selectionRange = allProviderRanges[i];
      while (true) {
        if (!selectionRange.range.contains(last)) {
          throw new Error("INVALID selection range, must contain the previous range");
        }
        oneResult.push(typeConvert.SelectionRange.from(selectionRange));
        if (!selectionRange.parent) {
          break;
        }
        last = selectionRange.range;
        selectionRange = selectionRange.parent;
      }
    }
    return allResults;
  }
}
class CallHierarchyAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._idPool = new IdGenerator("");
    this._cache = /* @__PURE__ */ new Map();
  }
  async prepareSession(uri, position, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const items = await this._provider.prepareCallHierarchy(doc, pos, token);
    if (!items) {
      return void 0;
    }
    const sessionId = this._idPool.nextId();
    this._cache.set(sessionId, /* @__PURE__ */ new Map());
    if (Array.isArray(items)) {
      return items.map((item) => this._cacheAndConvertItem(sessionId, item));
    } else {
      return [this._cacheAndConvertItem(sessionId, items)];
    }
  }
  async provideCallsTo(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing call hierarchy item");
    }
    const calls = await this._provider.provideCallHierarchyIncomingCalls(item, token);
    if (!calls) {
      return void 0;
    }
    return calls.map((call) => {
      return {
        from: this._cacheAndConvertItem(sessionId, call.from),
        fromRanges: call.fromRanges.map((r) => typeConvert.Range.from(r))
      };
    });
  }
  async provideCallsFrom(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing call hierarchy item");
    }
    const calls = await this._provider.provideCallHierarchyOutgoingCalls(item, token);
    if (!calls) {
      return void 0;
    }
    return calls.map((call) => {
      return {
        to: this._cacheAndConvertItem(sessionId, call.to),
        fromRanges: call.fromRanges.map((r) => typeConvert.Range.from(r))
      };
    });
  }
  releaseSession(sessionId) {
    this._cache.delete(sessionId);
  }
  _cacheAndConvertItem(sessionId, item) {
    const map = this._cache.get(sessionId);
    const dto = typeConvert.CallHierarchyItem.from(item, sessionId, map.size.toString(36));
    map.set(dto._itemId, item);
    return dto;
  }
  _itemFromCache(sessionId, itemId) {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
class TypeHierarchyAdapter {
  constructor(_documents, _provider) {
    this._documents = _documents;
    this._provider = _provider;
    this._idPool = new IdGenerator("");
    this._cache = /* @__PURE__ */ new Map();
  }
  async prepareSession(uri, position, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const items = await this._provider.prepareTypeHierarchy(doc, pos, token);
    if (!items) {
      return void 0;
    }
    const sessionId = this._idPool.nextId();
    this._cache.set(sessionId, /* @__PURE__ */ new Map());
    if (Array.isArray(items)) {
      return items.map((item) => this._cacheAndConvertItem(sessionId, item));
    } else {
      return [this._cacheAndConvertItem(sessionId, items)];
    }
  }
  async provideSupertypes(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing type hierarchy item");
    }
    const supertypes = await this._provider.provideTypeHierarchySupertypes(item, token);
    if (!supertypes) {
      return void 0;
    }
    return supertypes.map((supertype) => {
      return this._cacheAndConvertItem(sessionId, supertype);
    });
  }
  async provideSubtypes(sessionId, itemId, token) {
    const item = this._itemFromCache(sessionId, itemId);
    if (!item) {
      throw new Error("missing type hierarchy item");
    }
    const subtypes = await this._provider.provideTypeHierarchySubtypes(item, token);
    if (!subtypes) {
      return void 0;
    }
    return subtypes.map((subtype) => {
      return this._cacheAndConvertItem(sessionId, subtype);
    });
  }
  releaseSession(sessionId) {
    this._cache.delete(sessionId);
  }
  _cacheAndConvertItem(sessionId, item) {
    const map = this._cache.get(sessionId);
    const dto = typeConvert.TypeHierarchyItem.from(item, sessionId, map.size.toString(36));
    map.set(dto._itemId, item);
    return dto;
  }
  _itemFromCache(sessionId, itemId) {
    const map = this._cache.get(sessionId);
    return map?.get(itemId);
  }
}
class DocumentDropEditAdapter {
  constructor(_proxy, _documents, _provider, _handle, _extension) {
    this._proxy = _proxy;
    this._documents = _documents;
    this._provider = _provider;
    this._handle = _handle;
    this._extension = _extension;
    this._cache = new Cache("DocumentDropEdit");
  }
  async provideDocumentOnDropEdits(requestId, uri, position, dataTransferDto, token) {
    const doc = this._documents.getDocument(uri);
    const pos = typeConvert.Position.to(position);
    const dataTransfer = typeConvert.DataTransfer.toDataTransfer(dataTransferDto, async (id) => {
      return (await this._proxy.$resolveDocumentOnDropFileData(this._handle, requestId, id)).buffer;
    });
    const edits = await this._provider.provideDocumentDropEdits(doc, pos, dataTransfer, token);
    if (!edits) {
      return void 0;
    }
    const editsArray = asArray(edits);
    const cacheId = this._cache.add(editsArray);
    return editsArray.map((edit, i) => ({
      _cacheId: [cacheId, i],
      title: edit.title ?? localize("defaultDropLabel", "Drop using '{0}' extension", this._extension.displayName || this._extension.name),
      kind: edit.kind?.value,
      yieldTo: edit.yieldTo?.map((x) => x.value),
      insertText: typeof edit.insertText === "string" ? edit.insertText : { snippet: edit.insertText.value },
      additionalEdit: edit.additionalEdit ? typeConvert.WorkspaceEdit.from(edit.additionalEdit, void 0) : void 0
    }));
  }
  async resolveDropEdit(id, token) {
    const [sessionId, itemId] = id;
    const item = this._cache.get(sessionId, itemId);
    if (!item || !this._provider.resolveDocumentDropEdit) {
      return {};
    }
    const resolvedItem = await this._provider.resolveDocumentDropEdit(item, token) ?? item;
    const additionalEdit = resolvedItem.additionalEdit ? typeConvert.WorkspaceEdit.from(resolvedItem.additionalEdit, void 0) : void 0;
    return { additionalEdit };
  }
  releaseDropEdits(id) {
    this._cache.delete(id);
  }
}
class AdapterData {
  constructor(adapter, extension) {
    this.adapter = adapter;
    this.extension = extension;
  }
}
const _ExtHostLanguageFeatures = class _ExtHostLanguageFeatures {
  constructor(mainContext, _uriTransformer, _documents, _commands, _diagnostics, _logService, _apiDeprecation, _extensionTelemetry) {
    this._uriTransformer = _uriTransformer;
    this._documents = _documents;
    this._commands = _commands;
    this._diagnostics = _diagnostics;
    this._logService = _logService;
    this._apiDeprecation = _apiDeprecation;
    this._extensionTelemetry = _extensionTelemetry;
    this._adapter = /* @__PURE__ */ new Map();
    this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadLanguageFeatures);
  }
  _transformDocumentSelector(selector, extension) {
    return typeConvert.DocumentSelector.from(selector, this._uriTransformer, extension);
  }
  _createDisposable(handle) {
    return new Disposable(() => {
      this._adapter.delete(handle);
      this._proxy.$unregister(handle);
    });
  }
  _nextHandle() {
    return _ExtHostLanguageFeatures._handlePool++;
  }
  async _withAdapter(handle, ctor, callback, fallbackValue, tokenToRaceAgainst, doNotLog = false) {
    const data = this._adapter.get(handle);
    if (!data || !(data.adapter instanceof ctor)) {
      return fallbackValue;
    }
    const t1 = Date.now();
    if (!doNotLog) {
      this._logService.trace(`[${data.extension.identifier.value}] INVOKE provider '${callback.toString().replace(/[\r\n]/g, "")}'`);
    }
    const result = callback(data.adapter, data.extension);
    Promise.resolve(result).catch((err) => {
      if (!isCancellationError(err)) {
        this._logService.error(`[${data.extension.identifier.value}] provider FAILED`);
        this._logService.error(err);
        this._extensionTelemetry.onExtensionError(data.extension.identifier, err);
      }
    }).finally(() => {
      if (!doNotLog) {
        this._logService.trace(`[${data.extension.identifier.value}] provider DONE after ${Date.now() - t1}ms`);
      }
    });
    if (CancellationToken.isCancellationToken(tokenToRaceAgainst)) {
      return raceCancellationError(result, tokenToRaceAgainst);
    }
    return result;
  }
  _addNewAdapter(adapter, extension) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(adapter, extension));
    return handle;
  }
  static _extLabel(ext) {
    return ext.displayName || ext.name;
  }
  static _extId(ext) {
    return ext.identifier.value;
  }
  // --- outline
  registerDocumentSymbolProvider(extension, selector, provider, metadata) {
    const handle = this._addNewAdapter(new DocumentSymbolAdapter(this._documents, provider), extension);
    const displayName = metadata && metadata.label || _ExtHostLanguageFeatures._extLabel(extension);
    this._proxy.$registerDocumentSymbolProvider(handle, this._transformDocumentSelector(selector, extension), displayName);
    return this._createDisposable(handle);
  }
  $provideDocumentSymbols(handle, resource, token) {
    return this._withAdapter(handle, DocumentSymbolAdapter, (adapter) => adapter.provideDocumentSymbols(URI.revive(resource), token), void 0, token);
  }
  // --- code lens
  registerCodeLensProvider(extension, selector, provider) {
    const handle = this._nextHandle();
    const eventHandle = typeof provider.onDidChangeCodeLenses === "function" ? this._nextHandle() : void 0;
    this._adapter.set(handle, new AdapterData(new CodeLensAdapter(this._documents, this._commands.converter, provider, extension, this._extensionTelemetry, this._logService), extension));
    this._proxy.$registerCodeLensSupport(handle, this._transformDocumentSelector(selector, extension), eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeCodeLenses((_) => this._proxy.$emitCodeLensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideCodeLenses(handle, resource, token) {
    return this._withAdapter(handle, CodeLensAdapter, (adapter) => adapter.provideCodeLenses(URI.revive(resource), token), void 0, token, resource.scheme === "output");
  }
  $resolveCodeLens(handle, symbol, token) {
    return this._withAdapter(handle, CodeLensAdapter, (adapter) => adapter.resolveCodeLens(symbol, token), void 0, void 0, true);
  }
  $releaseCodeLenses(handle, cacheId) {
    this._withAdapter(handle, CodeLensAdapter, (adapter) => Promise.resolve(adapter.releaseCodeLenses(cacheId)), void 0, void 0, true);
  }
  // --- declaration
  registerDefinitionProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DefinitionAdapter(this._documents, provider), extension);
    this._proxy.$registerDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDefinition(handle, resource, position, token) {
    return this._withAdapter(handle, DefinitionAdapter, (adapter) => adapter.provideDefinition(URI.revive(resource), position, token), [], token);
  }
  registerDeclarationProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DeclarationAdapter(this._documents, provider), extension);
    this._proxy.$registerDeclarationSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDeclaration(handle, resource, position, token) {
    return this._withAdapter(handle, DeclarationAdapter, (adapter) => adapter.provideDeclaration(URI.revive(resource), position, token), [], token);
  }
  registerImplementationProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ImplementationAdapter(this._documents, provider), extension);
    this._proxy.$registerImplementationSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideImplementation(handle, resource, position, token) {
    return this._withAdapter(handle, ImplementationAdapter, (adapter) => adapter.provideImplementation(URI.revive(resource), position, token), [], token);
  }
  registerTypeDefinitionProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new TypeDefinitionAdapter(this._documents, provider), extension);
    this._proxy.$registerTypeDefinitionSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideTypeDefinition(handle, resource, position, token) {
    return this._withAdapter(handle, TypeDefinitionAdapter, (adapter) => adapter.provideTypeDefinition(URI.revive(resource), position, token), [], token);
  }
  // --- extra info
  registerHoverProvider(extension, selector, provider, extensionId) {
    const handle = this._addNewAdapter(new HoverAdapter(this._documents, provider), extension);
    this._proxy.$registerHoverProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideHover(handle, resource, position, context, token) {
    return this._withAdapter(handle, HoverAdapter, (adapter) => adapter.provideHover(URI.revive(resource), position, context, token), void 0, token);
  }
  $releaseHover(handle, id) {
    this._withAdapter(handle, HoverAdapter, (adapter) => Promise.resolve(adapter.releaseHover(id)), void 0, void 0);
  }
  // --- debug hover
  registerEvaluatableExpressionProvider(extension, selector, provider, extensionId) {
    const handle = this._addNewAdapter(new EvaluatableExpressionAdapter(this._documents, provider), extension);
    this._proxy.$registerEvaluatableExpressionProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideEvaluatableExpression(handle, resource, position, token) {
    return this._withAdapter(handle, EvaluatableExpressionAdapter, (adapter) => adapter.provideEvaluatableExpression(URI.revive(resource), position, token), void 0, token);
  }
  // --- debug inline values
  registerInlineValuesProvider(extension, selector, provider, extensionId) {
    const eventHandle = typeof provider.onDidChangeInlineValues === "function" ? this._nextHandle() : void 0;
    const handle = this._addNewAdapter(new InlineValuesAdapter(this._documents, provider), extension);
    this._proxy.$registerInlineValuesProvider(handle, this._transformDocumentSelector(selector, extension), eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeInlineValues((_) => this._proxy.$emitInlineValuesEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideInlineValues(handle, resource, range, context, token) {
    return this._withAdapter(handle, InlineValuesAdapter, (adapter) => adapter.provideInlineValues(URI.revive(resource), range, context, token), void 0, token);
  }
  // --- occurrences
  registerDocumentHighlightProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DocumentHighlightAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  registerMultiDocumentHighlightProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new MultiDocumentHighlightAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerMultiDocumentHighlightProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDocumentHighlights(handle, resource, position, token) {
    return this._withAdapter(handle, DocumentHighlightAdapter, (adapter) => adapter.provideDocumentHighlights(URI.revive(resource), position, token), void 0, token);
  }
  $provideMultiDocumentHighlights(handle, resource, position, otherModels, token) {
    return this._withAdapter(handle, MultiDocumentHighlightAdapter, (adapter) => adapter.provideMultiDocumentHighlights(URI.revive(resource), position, otherModels.map((model) => URI.revive(model)), token), void 0, token);
  }
  // --- linked editing
  registerLinkedEditingRangeProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new LinkedEditingRangeAdapter(this._documents, provider), extension);
    this._proxy.$registerLinkedEditingRangeProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideLinkedEditingRanges(handle, resource, position, token) {
    return this._withAdapter(handle, LinkedEditingRangeAdapter, async (adapter) => {
      const res = await adapter.provideLinkedEditingRanges(URI.revive(resource), position, token);
      if (res) {
        return {
          ranges: res.ranges,
          wordPattern: res.wordPattern ? _ExtHostLanguageFeatures._serializeRegExp(res.wordPattern) : void 0
        };
      }
      return void 0;
    }, void 0, token);
  }
  // --- references
  registerReferenceProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ReferenceAdapter(this._documents, provider), extension);
    this._proxy.$registerReferenceSupport(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideReferences(handle, resource, position, context, token) {
    return this._withAdapter(handle, ReferenceAdapter, (adapter) => adapter.provideReferences(URI.revive(resource), position, context, token), void 0, token);
  }
  // --- code actions
  registerCodeActionProvider(extension, selector, provider, metadata) {
    const store = new DisposableStore();
    const handle = this._addNewAdapter(new CodeActionAdapter(this._documents, this._commands.converter, this._diagnostics, provider, this._logService, extension, this._apiDeprecation), extension);
    this._proxy.$registerCodeActionSupport(handle, this._transformDocumentSelector(selector, extension), {
      providedKinds: metadata?.providedCodeActionKinds?.map((kind) => kind.value),
      documentation: metadata?.documentation?.map((x) => ({
        kind: x.kind.value,
        command: this._commands.converter.toInternal(x.command, store)
      }))
    }, _ExtHostLanguageFeatures._extLabel(extension), _ExtHostLanguageFeatures._extId(extension), Boolean(provider.resolveCodeAction));
    store.add(this._createDisposable(handle));
    return store;
  }
  $provideCodeActions(handle, resource, rangeOrSelection, context, token) {
    return this._withAdapter(handle, CodeActionAdapter, (adapter) => adapter.provideCodeActions(URI.revive(resource), rangeOrSelection, context, token), void 0, token);
  }
  $resolveCodeAction(handle, id, token) {
    return this._withAdapter(handle, CodeActionAdapter, (adapter) => adapter.resolveCodeAction(id, token), {}, void 0);
  }
  $releaseCodeActions(handle, cacheId) {
    this._withAdapter(handle, CodeActionAdapter, (adapter) => Promise.resolve(adapter.releaseCodeActions(cacheId)), void 0, void 0);
  }
  // --- formatting
  registerDocumentFormattingEditProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new DocumentFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name);
    return this._createDisposable(handle);
  }
  $provideDocumentFormattingEdits(handle, resource, options, token) {
    return this._withAdapter(handle, DocumentFormattingAdapter, (adapter) => adapter.provideDocumentFormattingEdits(URI.revive(resource), options, token), void 0, token);
  }
  registerDocumentRangeFormattingEditProvider(extension, selector, provider) {
    const canFormatMultipleRanges = typeof provider.provideDocumentRangesFormattingEdits === "function";
    const handle = this._addNewAdapter(new RangeFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerRangeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), extension.identifier, extension.displayName || extension.name, canFormatMultipleRanges);
    return this._createDisposable(handle);
  }
  $provideDocumentRangeFormattingEdits(handle, resource, range, options, token) {
    return this._withAdapter(handle, RangeFormattingAdapter, (adapter) => adapter.provideDocumentRangeFormattingEdits(URI.revive(resource), range, options, token), void 0, token);
  }
  $provideDocumentRangesFormattingEdits(handle, resource, ranges, options, token) {
    return this._withAdapter(handle, RangeFormattingAdapter, (adapter) => adapter.provideDocumentRangesFormattingEdits(URI.revive(resource), ranges, options, token), void 0, token);
  }
  registerOnTypeFormattingEditProvider(extension, selector, provider, triggerCharacters) {
    const handle = this._addNewAdapter(new OnTypeFormattingAdapter(this._documents, provider), extension);
    this._proxy.$registerOnTypeFormattingSupport(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, extension.identifier);
    return this._createDisposable(handle);
  }
  $provideOnTypeFormattingEdits(handle, resource, position, ch, options, token) {
    return this._withAdapter(handle, OnTypeFormattingAdapter, (adapter) => adapter.provideOnTypeFormattingEdits(URI.revive(resource), position, ch, options, token), void 0, token);
  }
  // --- navigate types
  registerWorkspaceSymbolProvider(extension, provider) {
    const handle = this._addNewAdapter(new NavigateTypeAdapter(provider, this._logService), extension);
    this._proxy.$registerNavigateTypeSupport(handle, typeof provider.resolveWorkspaceSymbol === "function");
    return this._createDisposable(handle);
  }
  $provideWorkspaceSymbols(handle, search, token) {
    return this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.provideWorkspaceSymbols(search, token), { symbols: [] }, token);
  }
  $resolveWorkspaceSymbol(handle, symbol, token) {
    return this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.resolveWorkspaceSymbol(symbol, token), void 0, void 0);
  }
  $releaseWorkspaceSymbols(handle, id) {
    this._withAdapter(handle, NavigateTypeAdapter, (adapter) => adapter.releaseWorkspaceSymbols(id), void 0, void 0);
  }
  // --- rename
  registerRenameProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new RenameAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerRenameSupport(handle, this._transformDocumentSelector(selector, extension), RenameAdapter.supportsResolving(provider));
    return this._createDisposable(handle);
  }
  $provideRenameEdits(handle, resource, position, newName, token) {
    return this._withAdapter(handle, RenameAdapter, (adapter) => adapter.provideRenameEdits(URI.revive(resource), position, newName, token), void 0, token);
  }
  $resolveRenameLocation(handle, resource, position, token) {
    return this._withAdapter(handle, RenameAdapter, (adapter) => adapter.resolveRenameLocation(URI.revive(resource), position, token), void 0, token);
  }
  registerNewSymbolNamesProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new NewSymbolNamesAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerNewSymbolNamesProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $supportsAutomaticNewSymbolNamesTriggerKind(handle) {
    return this._withAdapter(
      handle,
      NewSymbolNamesAdapter,
      (adapter) => adapter.supportsAutomaticNewSymbolNamesTriggerKind(),
      false,
      void 0
    );
  }
  $provideNewSymbolNames(handle, resource, range, triggerKind, token) {
    return this._withAdapter(handle, NewSymbolNamesAdapter, (adapter) => adapter.provideNewSymbolNames(URI.revive(resource), range, triggerKind, token), void 0, token);
  }
  //#region semantic coloring
  registerDocumentSemanticTokensProvider(extension, selector, provider, legend) {
    const handle = this._addNewAdapter(new DocumentSemanticTokensAdapter(this._documents, provider), extension);
    const eventHandle = typeof provider.onDidChangeSemanticTokens === "function" ? this._nextHandle() : void 0;
    this._proxy.$registerDocumentSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend, eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle) {
      const subscription = provider.onDidChangeSemanticTokens((_) => this._proxy.$emitDocumentSemanticTokensEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideDocumentSemanticTokens(handle, resource, previousResultId, token) {
    return this._withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.provideDocumentSemanticTokens(URI.revive(resource), previousResultId, token), null, token);
  }
  $releaseDocumentSemanticTokens(handle, semanticColoringResultId) {
    this._withAdapter(handle, DocumentSemanticTokensAdapter, (adapter) => adapter.releaseDocumentSemanticColoring(semanticColoringResultId), void 0, void 0);
  }
  registerDocumentRangeSemanticTokensProvider(extension, selector, provider, legend) {
    const handle = this._addNewAdapter(new DocumentRangeSemanticTokensAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentRangeSemanticTokensProvider(handle, this._transformDocumentSelector(selector, extension), legend);
    return this._createDisposable(handle);
  }
  $provideDocumentRangeSemanticTokens(handle, resource, range, token) {
    return this._withAdapter(handle, DocumentRangeSemanticTokensAdapter, (adapter) => adapter.provideDocumentRangeSemanticTokens(URI.revive(resource), range, token), null, token);
  }
  //#endregion
  // --- suggestion
  registerCompletionItemProvider(extension, selector, provider, triggerCharacters) {
    const handle = this._addNewAdapter(new CompletionsAdapter(this._documents, this._commands.converter, provider, this._apiDeprecation, extension), extension);
    this._proxy.$registerCompletionsProvider(handle, this._transformDocumentSelector(selector, extension), triggerCharacters, CompletionsAdapter.supportsResolving(provider), extension.identifier);
    return this._createDisposable(handle);
  }
  $provideCompletionItems(handle, resource, position, context, token) {
    return this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.provideCompletionItems(URI.revive(resource), position, context, token), void 0, token);
  }
  $resolveCompletionItem(handle, id, token) {
    return this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.resolveCompletionItem(id, token), void 0, token);
  }
  $releaseCompletionItems(handle, id) {
    this._withAdapter(handle, CompletionsAdapter, (adapter) => adapter.releaseCompletionItems(id), void 0, void 0);
  }
  // --- ghost text
  registerInlineCompletionsProvider(extension, selector, provider, metadata) {
    const adapter = new InlineCompletionAdapter(extension, this._documents, provider, this._commands.converter);
    const handle = this._addNewAdapter(adapter, extension);
    this._proxy.$registerInlineCompletionsSupport(
      handle,
      this._transformDocumentSelector(selector, extension),
      adapter.supportsHandleEvents,
      ExtensionIdentifier.toKey(extension.identifier.value),
      metadata?.yieldTo?.map((extId) => ExtensionIdentifier.toKey(extId)) || [],
      metadata?.displayName,
      metadata?.debounceDelayMs
    );
    return this._createDisposable(handle);
  }
  $provideInlineCompletions(handle, resource, position, context, token) {
    return this._withAdapter(handle, InlineCompletionAdapter, (adapter) => adapter.provideInlineCompletions(URI.revive(resource), position, context, token), void 0, token);
  }
  $provideInlineEditsForRange(handle, resource, range, context, token) {
    return this._withAdapter(handle, InlineCompletionAdapter, (adapter) => adapter.provideInlineEditsForRange(URI.revive(resource), range, context, token), void 0, token);
  }
  $handleInlineCompletionDidShow(handle, pid, idx, updatedInsertText) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handleDidShowCompletionItem(pid, idx, updatedInsertText);
    }, void 0, void 0);
  }
  $handleInlineCompletionPartialAccept(handle, pid, idx, acceptedCharacters, info) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handlePartialAccept(pid, idx, acceptedCharacters, info);
    }, void 0, void 0);
  }
  $handleInlineCompletionRejection(handle, pid, idx) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.handleRejection(pid, idx);
    }, void 0, void 0);
  }
  $freeInlineCompletionsList(handle, pid) {
    this._withAdapter(handle, InlineCompletionAdapter, async (adapter) => {
      adapter.disposeCompletions(pid);
    }, void 0, void 0);
  }
  // --- inline edit
  registerInlineEditProvider(extension, selector, provider) {
    const adapter = new InlineEditAdapter(extension, this._documents, provider, this._commands.converter);
    const handle = this._addNewAdapter(adapter, extension);
    this._proxy.$registerInlineEditProvider(handle, this._transformDocumentSelector(selector, extension), extension.identifier, provider.displayName || extension.name);
    return this._createDisposable(handle);
  }
  $provideInlineEdit(handle, resource, context, token) {
    return this._withAdapter(handle, InlineEditAdapter, (adapter) => adapter.provideInlineEdits(URI.revive(resource), context, token), void 0, token);
  }
  $freeInlineEdit(handle, pid) {
    this._withAdapter(handle, InlineEditAdapter, async (adapter) => {
      adapter.disposeEdit(pid);
    }, void 0, void 0);
  }
  // --- parameter hints
  registerSignatureHelpProvider(extension, selector, provider, metadataOrTriggerChars) {
    const metadata = Array.isArray(metadataOrTriggerChars) ? { triggerCharacters: metadataOrTriggerChars, retriggerCharacters: [] } : metadataOrTriggerChars;
    const handle = this._addNewAdapter(new SignatureHelpAdapter(this._documents, provider), extension);
    this._proxy.$registerSignatureHelpProvider(handle, this._transformDocumentSelector(selector, extension), metadata);
    return this._createDisposable(handle);
  }
  $provideSignatureHelp(handle, resource, position, context, token) {
    return this._withAdapter(handle, SignatureHelpAdapter, (adapter) => adapter.provideSignatureHelp(URI.revive(resource), position, context, token), void 0, token);
  }
  $releaseSignatureHelp(handle, id) {
    this._withAdapter(handle, SignatureHelpAdapter, (adapter) => adapter.releaseSignatureHelp(id), void 0, void 0);
  }
  // --- inline hints
  registerInlayHintsProvider(extension, selector, provider) {
    const eventHandle = typeof provider.onDidChangeInlayHints === "function" ? this._nextHandle() : void 0;
    const handle = this._addNewAdapter(new InlayHintsAdapter(this._documents, this._commands.converter, provider, this._logService, extension), extension);
    this._proxy.$registerInlayHintsProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveInlayHint === "function", eventHandle, _ExtHostLanguageFeatures._extLabel(extension));
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeInlayHints((uri) => this._proxy.$emitInlayHintsEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideInlayHints(handle, resource, range, token) {
    return this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.provideInlayHints(URI.revive(resource), range, token), void 0, token);
  }
  $resolveInlayHint(handle, id, token) {
    return this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.resolveInlayHint(id, token), void 0, token);
  }
  $releaseInlayHints(handle, id) {
    this._withAdapter(handle, InlayHintsAdapter, (adapter) => adapter.releaseHints(id), void 0, void 0);
  }
  // --- links
  registerDocumentLinkProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new LinkProviderAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentLinkProvider(handle, this._transformDocumentSelector(selector, extension), typeof provider.resolveDocumentLink === "function");
    return this._createDisposable(handle);
  }
  $provideDocumentLinks(handle, resource, token) {
    return this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.provideLinks(URI.revive(resource), token), void 0, token, resource.scheme === "output");
  }
  $resolveDocumentLink(handle, id, token) {
    return this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.resolveLink(id, token), void 0, void 0, true);
  }
  $releaseDocumentLinks(handle, id) {
    this._withAdapter(handle, LinkProviderAdapter, (adapter) => adapter.releaseLinks(id), void 0, void 0, true);
  }
  registerColorProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new ColorProviderAdapter(this._documents, provider), extension);
    this._proxy.$registerDocumentColorProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideDocumentColors(handle, resource, token) {
    return this._withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColors(URI.revive(resource), token), [], token);
  }
  $provideColorPresentations(handle, resource, colorInfo, token) {
    return this._withAdapter(handle, ColorProviderAdapter, (adapter) => adapter.provideColorPresentations(URI.revive(resource), colorInfo, token), void 0, token);
  }
  registerFoldingRangeProvider(extension, selector, provider) {
    const handle = this._nextHandle();
    const eventHandle = typeof provider.onDidChangeFoldingRanges === "function" ? this._nextHandle() : void 0;
    this._adapter.set(handle, new AdapterData(new FoldingProviderAdapter(this._documents, provider), extension));
    this._proxy.$registerFoldingRangeProvider(handle, this._transformDocumentSelector(selector, extension), extension.identifier, eventHandle);
    let result = this._createDisposable(handle);
    if (eventHandle !== void 0) {
      const subscription = provider.onDidChangeFoldingRanges(() => this._proxy.$emitFoldingRangeEvent(eventHandle));
      result = Disposable.from(result, subscription);
    }
    return result;
  }
  $provideFoldingRanges(handle, resource, context, token) {
    return this._withAdapter(
      handle,
      FoldingProviderAdapter,
      (adapter) => adapter.provideFoldingRanges(URI.revive(resource), context, token),
      void 0,
      token
    );
  }
  // --- smart select
  registerSelectionRangeProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new SelectionRangeAdapter(this._documents, provider, this._logService), extension);
    this._proxy.$registerSelectionRangeProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $provideSelectionRanges(handle, resource, positions, token) {
    return this._withAdapter(handle, SelectionRangeAdapter, (adapter) => adapter.provideSelectionRanges(URI.revive(resource), positions, token), [], token);
  }
  // --- call hierarchy
  registerCallHierarchyProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new CallHierarchyAdapter(this._documents, provider), extension);
    this._proxy.$registerCallHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $prepareCallHierarchy(handle, resource, position, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), void 0, token);
  }
  $provideCallHierarchyIncomingCalls(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsTo(sessionId, itemId, token), void 0, token);
  }
  $provideCallHierarchyOutgoingCalls(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, CallHierarchyAdapter, (adapter) => adapter.provideCallsFrom(sessionId, itemId, token), void 0, token);
  }
  $releaseCallHierarchy(handle, sessionId) {
    this._withAdapter(handle, CallHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)), void 0, void 0);
  }
  // --- type hierarchy
  registerTypeHierarchyProvider(extension, selector, provider) {
    const handle = this._addNewAdapter(new TypeHierarchyAdapter(this._documents, provider), extension);
    this._proxy.$registerTypeHierarchyProvider(handle, this._transformDocumentSelector(selector, extension));
    return this._createDisposable(handle);
  }
  $prepareTypeHierarchy(handle, resource, position, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => Promise.resolve(adapter.prepareSession(URI.revive(resource), position, token)), void 0, token);
  }
  $provideTypeHierarchySupertypes(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => adapter.provideSupertypes(sessionId, itemId, token), void 0, token);
  }
  $provideTypeHierarchySubtypes(handle, sessionId, itemId, token) {
    return this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => adapter.provideSubtypes(sessionId, itemId, token), void 0, token);
  }
  $releaseTypeHierarchy(handle, sessionId) {
    this._withAdapter(handle, TypeHierarchyAdapter, (adapter) => Promise.resolve(adapter.releaseSession(sessionId)), void 0, void 0);
  }
  // --- Document on drop
  registerDocumentOnDropEditProvider(extension, selector, provider, metadata) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(new DocumentDropEditAdapter(this._proxy, this._documents, provider, handle, extension), extension));
    this._proxy.$registerDocumentOnDropEditProvider(handle, this._transformDocumentSelector(selector, extension), metadata ? {
      supportsResolve: !!provider.resolveDocumentDropEdit,
      dropMimeTypes: metadata.dropMimeTypes,
      providedDropKinds: metadata.providedDropEditKinds?.map((x) => x.value)
    } : void 0);
    return this._createDisposable(handle);
  }
  $provideDocumentOnDropEdits(handle, requestId, resource, position, dataTransferDto, token) {
    return this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => Promise.resolve(adapter.provideDocumentOnDropEdits(requestId, URI.revive(resource), position, dataTransferDto, token)), void 0, void 0);
  }
  $resolveDropEdit(handle, id, token) {
    return this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => adapter.resolveDropEdit(id, token), {}, void 0);
  }
  $releaseDocumentOnDropEdits(handle, cacheId) {
    this._withAdapter(handle, DocumentDropEditAdapter, (adapter) => Promise.resolve(adapter.releaseDropEdits(cacheId)), void 0, void 0);
  }
  // --- copy/paste actions
  registerDocumentPasteEditProvider(extension, selector, provider, metadata) {
    const handle = this._nextHandle();
    this._adapter.set(handle, new AdapterData(new DocumentPasteEditProvider(this._proxy, this._documents, provider, handle, extension), extension));
    this._proxy.$registerPasteEditProvider(handle, this._transformDocumentSelector(selector, extension), {
      supportsCopy: !!provider.prepareDocumentPaste,
      supportsPaste: !!provider.provideDocumentPasteEdits,
      supportsResolve: !!provider.resolveDocumentPasteEdit,
      providedPasteEditKinds: metadata.providedPasteEditKinds?.map((x) => x.value),
      copyMimeTypes: metadata.copyMimeTypes,
      pasteMimeTypes: metadata.pasteMimeTypes
    });
    return this._createDisposable(handle);
  }
  $prepareDocumentPaste(handle, resource, ranges, dataTransfer, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.prepareDocumentPaste(URI.revive(resource), ranges, dataTransfer, token), void 0, token);
  }
  $providePasteEdits(handle, requestId, resource, ranges, dataTransferDto, context, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.providePasteEdits(requestId, URI.revive(resource), ranges, dataTransferDto, context, token), void 0, token);
  }
  $resolvePasteEdit(handle, id, token) {
    return this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => adapter.resolvePasteEdit(id, token), {}, void 0);
  }
  $releasePasteEdits(handle, cacheId) {
    this._withAdapter(handle, DocumentPasteEditProvider, (adapter) => Promise.resolve(adapter.releasePasteEdits(cacheId)), void 0, void 0);
  }
  // --- configuration
  static _serializeRegExp(regExp) {
    return {
      pattern: regExp.source,
      flags: regExp.flags
    };
  }
  static _serializeIndentationRule(indentationRule) {
    return {
      decreaseIndentPattern: _ExtHostLanguageFeatures._serializeRegExp(indentationRule.decreaseIndentPattern),
      increaseIndentPattern: _ExtHostLanguageFeatures._serializeRegExp(indentationRule.increaseIndentPattern),
      indentNextLinePattern: indentationRule.indentNextLinePattern ? _ExtHostLanguageFeatures._serializeRegExp(indentationRule.indentNextLinePattern) : void 0,
      unIndentedLinePattern: indentationRule.unIndentedLinePattern ? _ExtHostLanguageFeatures._serializeRegExp(indentationRule.unIndentedLinePattern) : void 0
    };
  }
  static _serializeOnEnterRule(onEnterRule) {
    return {
      beforeText: _ExtHostLanguageFeatures._serializeRegExp(onEnterRule.beforeText),
      afterText: onEnterRule.afterText ? _ExtHostLanguageFeatures._serializeRegExp(onEnterRule.afterText) : void 0,
      previousLineText: onEnterRule.previousLineText ? _ExtHostLanguageFeatures._serializeRegExp(onEnterRule.previousLineText) : void 0,
      action: onEnterRule.action
    };
  }
  static _serializeOnEnterRules(onEnterRules) {
    return onEnterRules.map(_ExtHostLanguageFeatures._serializeOnEnterRule);
  }
  static _serializeAutoClosingPair(autoClosingPair) {
    return {
      open: autoClosingPair.open,
      close: autoClosingPair.close,
      notIn: autoClosingPair.notIn ? autoClosingPair.notIn.map((v) => SyntaxTokenType.toString(v)) : void 0
    };
  }
  static _serializeAutoClosingPairs(autoClosingPairs) {
    return autoClosingPairs.map(_ExtHostLanguageFeatures._serializeAutoClosingPair);
  }
  setLanguageConfiguration(extension, languageId, configuration) {
    const { wordPattern } = configuration;
    if (wordPattern && regExpLeadsToEndlessLoop(wordPattern)) {
      throw new Error(`Invalid language configuration: wordPattern '${wordPattern}' is not allowed to match the empty string.`);
    }
    if (wordPattern) {
      this._documents.setWordDefinitionFor(languageId, wordPattern);
    } else {
      this._documents.setWordDefinitionFor(languageId, void 0);
    }
    if (configuration.__electricCharacterSupport) {
      this._apiDeprecation.report(
        "LanguageConfiguration.__electricCharacterSupport",
        extension,
        `Do not use.`
      );
    }
    if (configuration.__characterPairSupport) {
      this._apiDeprecation.report(
        "LanguageConfiguration.__characterPairSupport",
        extension,
        `Do not use.`
      );
    }
    const handle = this._nextHandle();
    const serializedConfiguration = {
      comments: configuration.comments,
      brackets: configuration.brackets,
      wordPattern: configuration.wordPattern ? _ExtHostLanguageFeatures._serializeRegExp(configuration.wordPattern) : void 0,
      indentationRules: configuration.indentationRules ? _ExtHostLanguageFeatures._serializeIndentationRule(configuration.indentationRules) : void 0,
      onEnterRules: configuration.onEnterRules ? _ExtHostLanguageFeatures._serializeOnEnterRules(configuration.onEnterRules) : void 0,
      __electricCharacterSupport: configuration.__electricCharacterSupport,
      __characterPairSupport: configuration.__characterPairSupport,
      autoClosingPairs: configuration.autoClosingPairs ? _ExtHostLanguageFeatures._serializeAutoClosingPairs(configuration.autoClosingPairs) : void 0
    };
    this._proxy.$setLanguageConfiguration(handle, languageId, serializedConfiguration);
    return this._createDisposable(handle);
  }
  $setWordDefinitions(wordDefinitions) {
    for (const wordDefinition of wordDefinitions) {
      this._documents.setWordDefinitionFor(wordDefinition.languageId, new RegExp(wordDefinition.regexSource, wordDefinition.regexFlags));
    }
  }
};
_ExtHostLanguageFeatures._handlePool = 0;
let ExtHostLanguageFeatures = _ExtHostLanguageFeatures;
export {
  ExtHostLanguageFeatures
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBhc0FycmF5LCBjb2FsZXNjZSwgaXNGYWxzeU9yRW1wdHksIGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyByYWNlQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBOb3RJbXBsZW1lbnRlZEVycm9yLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IElkR2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaWRHZW5lcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGVxdWFscywgbWl4aW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyByZWdFeHBMZWFkc1RvRW5kbGVzc0xvb3AgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUsIGlzT2JqZWN0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElVUklUcmFuc2Zvcm1lciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaUlwYy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSBhcyBFZGl0b3JSYW5nZSwgSVJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElTZWxlY3Rpb24sIFNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElBdXRvQ2xvc2luZ1BhaXJDb25kaXRpb25hbCB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBlbmNvZGVTZW1hbnRpY1Rva2Vuc0R0byB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvc2VtYW50aWNUb2tlbnNEdG8uanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgQ2FjaGUgfSBmcm9tICcuL2NhY2hlLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RQcm90b2NvbCBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UgfSBmcm9tICcuL2V4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNDb252ZXJ0ZXIsIEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REaWFnbm9zdGljcyB9IGZyb20gJy4vZXh0SG9zdERpYWdub3N0aWNzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdFRlbGVtZXRyeSwgSUV4dEhvc3RUZWxlbWV0cnkgfSBmcm9tICcuL2V4dEhvc3RUZWxlbWV0cnkuanMnO1xuaW1wb3J0ICogYXMgdHlwZUNvbnZlcnQgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbiwgQ29kZUFjdGlvbktpbmQsIENvbXBsZXRpb25MaXN0LCBEYXRhVHJhbnNmZXIsIERpc3Bvc2FibGUsIERvY3VtZW50RHJvcE9yUGFzdGVFZGl0S2luZCwgRG9jdW1lbnRTeW1ib2wsIElubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCwgSW5saW5lRWRpdFRyaWdnZXJLaW5kLCBJbnRlcm5hbERhdGFUcmFuc2Zlckl0ZW0sIExvY2F0aW9uLCBOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQsIFJhbmdlLCBTZW1hbnRpY1Rva2VucywgU2VtYW50aWNUb2tlbnNFZGl0LCBTZW1hbnRpY1Rva2Vuc0VkaXRzLCBTbmlwcGV0U3RyaW5nLCBTeW1ib2xJbmZvcm1hdGlvbiwgU3ludGF4VG9rZW5UeXBlIH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuXG4vLyAtLS0gYWRhcHRlclxuXG5jbGFzcyBEb2N1bWVudFN5bWJvbEFkYXB0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLkRvY3VtZW50U3ltYm9sUHJvdmlkZXJcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlRG9jdW1lbnRTeW1ib2xzKHJlc291cmNlOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkRvY3VtZW50U3ltYm9sW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZURvY3VtZW50U3ltYm9scyhkb2MsIHRva2VuKTtcblx0XHRpZiAoaXNGYWxzeU9yRW1wdHkodmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH0gZWxzZSBpZiAodmFsdWUhWzBdIGluc3RhbmNlb2YgRG9jdW1lbnRTeW1ib2wpIHtcblx0XHRcdHJldHVybiAoPERvY3VtZW50U3ltYm9sW10+dmFsdWUpLm1hcCh0eXBlQ29udmVydC5Eb2N1bWVudFN5bWJvbC5mcm9tKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIERvY3VtZW50U3ltYm9sQWRhcHRlci5fYXNEb2N1bWVudFN5bWJvbFRyZWUoPFN5bWJvbEluZm9ybWF0aW9uW10+dmFsdWUpO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9hc0RvY3VtZW50U3ltYm9sVHJlZShpbmZvczogU3ltYm9sSW5mb3JtYXRpb25bXSk6IGxhbmd1YWdlcy5Eb2N1bWVudFN5bWJvbFtdIHtcblx0XHQvLyBmaXJzdCBzb3J0IGJ5IHN0YXJ0IChhbmQgZW5kKSBhbmQgdGhlbiBsb29wIG92ZXIgYWxsIGVsZW1lbnRzXG5cdFx0Ly8gYW5kIGJ1aWxkIGEgdHJlZSBiYXNlZCBvbiBjb250YWlubWVudC5cblx0XHRpbmZvcyA9IGluZm9zLnNsaWNlKDApLnNvcnQoKGEsIGIpID0+IHtcblx0XHRcdGxldCByZXMgPSBhLmxvY2F0aW9uLnJhbmdlLnN0YXJ0LmNvbXBhcmVUbyhiLmxvY2F0aW9uLnJhbmdlLnN0YXJ0KTtcblx0XHRcdGlmIChyZXMgPT09IDApIHtcblx0XHRcdFx0cmVzID0gYi5sb2NhdGlvbi5yYW5nZS5lbmQuY29tcGFyZVRvKGEubG9jYXRpb24ucmFuZ2UuZW5kKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXM7XG5cdFx0fSk7XG5cdFx0Y29uc3QgcmVzOiBsYW5ndWFnZXMuRG9jdW1lbnRTeW1ib2xbXSA9IFtdO1xuXHRcdGNvbnN0IHBhcmVudFN0YWNrOiBsYW5ndWFnZXMuRG9jdW1lbnRTeW1ib2xbXSA9IFtdO1xuXHRcdGZvciAoY29uc3QgaW5mbyBvZiBpbmZvcykge1xuXHRcdFx0Y29uc3QgZWxlbWVudDogbGFuZ3VhZ2VzLkRvY3VtZW50U3ltYm9sID0ge1xuXHRcdFx0XHRuYW1lOiBpbmZvLm5hbWUgfHwgJyEhTUlTU0lORzogbmFtZSEhJyxcblx0XHRcdFx0a2luZDogdHlwZUNvbnZlcnQuU3ltYm9sS2luZC5mcm9tKGluZm8ua2luZCksXG5cdFx0XHRcdHRhZ3M6IGluZm8udGFncz8ubWFwKHR5cGVDb252ZXJ0LlN5bWJvbFRhZy5mcm9tKSB8fCBbXSxcblx0XHRcdFx0ZGV0YWlsOiAnJyxcblx0XHRcdFx0Y29udGFpbmVyTmFtZTogaW5mby5jb250YWluZXJOYW1lLFxuXHRcdFx0XHRyYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShpbmZvLmxvY2F0aW9uLnJhbmdlKSxcblx0XHRcdFx0c2VsZWN0aW9uUmFuZ2U6IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20oaW5mby5sb2NhdGlvbi5yYW5nZSksXG5cdFx0XHRcdGNoaWxkcmVuOiBbXVxuXHRcdFx0fTtcblxuXHRcdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdFx0aWYgKHBhcmVudFN0YWNrLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdHBhcmVudFN0YWNrLnB1c2goZWxlbWVudCk7XG5cdFx0XHRcdFx0cmVzLnB1c2goZWxlbWVudCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcGFyZW50ID0gcGFyZW50U3RhY2tbcGFyZW50U3RhY2subGVuZ3RoIC0gMV07XG5cdFx0XHRcdGlmIChFZGl0b3JSYW5nZS5jb250YWluc1JhbmdlKHBhcmVudC5yYW5nZSwgZWxlbWVudC5yYW5nZSkgJiYgIUVkaXRvclJhbmdlLmVxdWFsc1JhbmdlKHBhcmVudC5yYW5nZSwgZWxlbWVudC5yYW5nZSkpIHtcblx0XHRcdFx0XHRwYXJlbnQuY2hpbGRyZW4/LnB1c2goZWxlbWVudCk7XG5cdFx0XHRcdFx0cGFyZW50U3RhY2sucHVzaChlbGVtZW50KTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRwYXJlbnRTdGFjay5wb3AoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlcztcblx0fVxufVxuXG5jbGFzcyBDb2RlTGVuc0FkYXB0ZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IENhY2hlPHZzY29kZS5Db2RlTGVucz4oJ0NvZGVMZW5zJyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IE1hcDxudW1iZXIsIERpc3Bvc2FibGVTdG9yZT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHM6IENvbW1hbmRzQ29udmVydGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuQ29kZUxlbnNQcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRUZWxlbWV0cnk6IEV4dEhvc3RUZWxlbWV0cnksXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZUNvZGVMZW5zZXMocmVzb3VyY2U6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUNvZGVMZW5zTGlzdER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cblx0XHRjb25zdCBsZW5zZXMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlQ29kZUxlbnNlcyhkb2MsIHRva2VuKTtcblx0XHRpZiAoIWxlbnNlcyB8fCB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgY2FjaGVJZCA9IHRoaXMuX2NhY2hlLmFkZChsZW5zZXMpO1xuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLnNldChjYWNoZUlkLCBkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3QgcmVzdWx0OiBleHRIb3N0UHJvdG9jb2wuSUNvZGVMZW5zTGlzdER0byA9IHtcblx0XHRcdGNhY2hlSWQsXG5cdFx0XHRsZW5zZXM6IFtdLFxuXHRcdH07XG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCBsZW5zZXMubGVuZ3RoOyBpKyspIHtcblxuXHRcdFx0aWYgKCFSYW5nZS5pc1JhbmdlKGxlbnNlc1tpXS5yYW5nZSkpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKCdJTlZBTElEIGNvZGUgbGVucywgcmFuZ2UgaXMgbm90IGRlZmluZWQnLCB0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXN1bHQubGVuc2VzLnB1c2goe1xuXHRcdFx0XHRjYWNoZUlkOiBbY2FjaGVJZCwgaV0sXG5cdFx0XHRcdHJhbmdlOiB0eXBlQ29udmVydC5SYW5nZS5mcm9tKGxlbnNlc1tpXS5yYW5nZSksXG5cdFx0XHRcdGNvbW1hbmQ6IHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwobGVuc2VzW2ldLmNvbW1hbmQsIGRpc3Bvc2FibGVzKVxuXHRcdFx0fSk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlQ29kZUxlbnMoc3ltYm9sOiBleHRIb3N0UHJvdG9jb2wuSUNvZGVMZW5zRHRvLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JQ29kZUxlbnNEdG8gfCB1bmRlZmluZWQ+IHtcblxuXHRcdGNvbnN0IGxlbnMgPSBzeW1ib2wuY2FjaGVJZCAmJiB0aGlzLl9jYWNoZS5nZXQoLi4uc3ltYm9sLmNhY2hlSWQpO1xuXHRcdGlmICghbGVucykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRsZXQgcmVzb2x2ZWRMZW5zOiB2c2NvZGUuQ29kZUxlbnMgfCB1bmRlZmluZWQgfCBudWxsO1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUNvZGVMZW5zICE9PSAnZnVuY3Rpb24nIHx8IGxlbnMuaXNSZXNvbHZlZCkge1xuXHRcdFx0cmVzb2x2ZWRMZW5zID0gbGVucztcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmVzb2x2ZWRMZW5zID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUNvZGVMZW5zKGxlbnMsIHRva2VuKTtcblx0XHR9XG5cdFx0aWYgKCFyZXNvbHZlZExlbnMpIHtcblx0XHRcdHJlc29sdmVkTGVucyA9IGxlbnM7XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IHN5bWJvbC5jYWNoZUlkICYmIHRoaXMuX2Rpc3Bvc2FibGVzLmdldChzeW1ib2wuY2FjaGVJZFswXSk7XG5cdFx0aWYgKCFkaXNwb3NhYmxlcykge1xuXHRcdFx0Ly8gZGlzcG9zZWQgaW4gdGhlIG1lYW50aW1lXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghcmVzb2x2ZWRMZW5zLmNvbW1hbmQpIHtcblx0XHRcdGNvbnN0IGVycm9yID0gbmV3IEVycm9yKCdJTlZBTElEIGNvZGUgbGVucyByZXNvbHZlZCwgbGFja3MgY29tbWFuZDogJyArIHRoaXMuX2V4dGVuc2lvbi5pZGVudGlmaWVyLnZhbHVlKTtcblx0XHRcdHRoaXMuX2V4dFRlbGVtZXRyeS5vbkV4dGVuc2lvbkVycm9yKHRoaXMuX2V4dGVuc2lvbi5pZGVudGlmaWVyLCBlcnJvcik7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGVycm9yKTtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0c3ltYm9sLmNvbW1hbmQgPSB0aGlzLl9jb21tYW5kcy50b0ludGVybmFsKHJlc29sdmVkTGVucy5jb21tYW5kLCBkaXNwb3NhYmxlcyk7XG5cdFx0cmV0dXJuIHN5bWJvbDtcblx0fVxuXG5cdHJlbGVhc2VDb2RlTGVuc2VzKGNhY2hlZElkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5nZXQoY2FjaGVkSWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGVsZXRlKGNhY2hlZElkKTtcblx0XHR0aGlzLl9jYWNoZS5kZWxldGUoY2FjaGVkSWQpO1xuXHR9XG59XG5cbmZ1bmN0aW9uIGNvbnZlcnRUb0xvY2F0aW9uTGlua3ModmFsdWU6IHZzY29kZS5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbltdIHwgdnNjb2RlLkxvY2F0aW9uTGlua1tdIHwgdW5kZWZpbmVkIHwgbnVsbCk6IGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXSB7XG5cdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdHJldHVybiAoPGFueT52YWx1ZSkubWFwKHR5cGVDb252ZXJ0LkRlZmluaXRpb25MaW5rLmZyb20pO1xuXHR9IGVsc2UgaWYgKHZhbHVlKSB7XG5cdFx0cmV0dXJuIFt0eXBlQ29udmVydC5EZWZpbml0aW9uTGluay5mcm9tKHZhbHVlKV07XG5cdH1cblx0cmV0dXJuIFtdO1xufVxuXG5jbGFzcyBEZWZpbml0aW9uQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuRGVmaW5pdGlvblByb3ZpZGVyXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZURlZmluaXRpb24ocmVzb3VyY2U6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTG9jYXRpb25MaW5rW10+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVEZWZpbml0aW9uKGRvYywgcG9zLCB0b2tlbik7XG5cdFx0cmV0dXJuIGNvbnZlcnRUb0xvY2F0aW9uTGlua3ModmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIERlY2xhcmF0aW9uQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuRGVjbGFyYXRpb25Qcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVEZWNsYXJhdGlvbihyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXT4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZURlY2xhcmF0aW9uKGRvYywgcG9zLCB0b2tlbik7XG5cdFx0cmV0dXJuIGNvbnZlcnRUb0xvY2F0aW9uTGlua3ModmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIEltcGxlbWVudGF0aW9uQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuSW1wbGVtZW50YXRpb25Qcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVJbXBsZW1lbnRhdGlvbihyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXT4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUltcGxlbWVudGF0aW9uKGRvYywgcG9zLCB0b2tlbik7XG5cdFx0cmV0dXJuIGNvbnZlcnRUb0xvY2F0aW9uTGlua3ModmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIFR5cGVEZWZpbml0aW9uQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuVHlwZURlZmluaXRpb25Qcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVUeXBlRGVmaW5pdGlvbihyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXT4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZVR5cGVEZWZpbml0aW9uKGRvYywgcG9zLCB0b2tlbik7XG5cdFx0cmV0dXJuIGNvbnZlcnRUb0xvY2F0aW9uTGlua3ModmFsdWUpO1xuXHR9XG59XG5cbmNsYXNzIEhvdmVyQWRhcHRlciB7XG5cblx0cHJpdmF0ZSBfaG92ZXJDb3VudGVyOiBudW1iZXIgPSAwO1xuXHRwcml2YXRlIF9ob3Zlck1hcDogTWFwPG51bWJlciwgdnNjb2RlLkhvdmVyPiA9IG5ldyBNYXA8bnVtYmVyLCB2c2NvZGUuSG92ZXI+KCk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgSE9WRVJfTUFQX01BWF9TSVpFID0gMTA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuSG92ZXJQcm92aWRlcixcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlSG92ZXIocmVzb3VyY2U6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLkhvdmVyQ29udGV4dDx7IGlkOiBudW1iZXIgfT4gfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLkhvdmVyV2l0aElkIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdGxldCB2YWx1ZTogdnNjb2RlLkhvdmVyIHwgbnVsbCB8IHVuZGVmaW5lZDtcblx0XHRpZiAoY29udGV4dCAmJiBjb250ZXh0LnZlcmJvc2l0eVJlcXVlc3QpIHtcblx0XHRcdGNvbnN0IHByZXZpb3VzSG92ZXJJZCA9IGNvbnRleHQudmVyYm9zaXR5UmVxdWVzdC5wcmV2aW91c0hvdmVyLmlkO1xuXHRcdFx0Y29uc3QgcHJldmlvdXNIb3ZlciA9IHRoaXMuX2hvdmVyTWFwLmdldChwcmV2aW91c0hvdmVySWQpO1xuXHRcdFx0aWYgKCFwcmV2aW91c0hvdmVyKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgSG92ZXIgd2l0aCBpZCAke3ByZXZpb3VzSG92ZXJJZH0gbm90IGZvdW5kYCk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBob3ZlckNvbnRleHQ6IHZzY29kZS5Ib3ZlckNvbnRleHQgPSB7IHZlcmJvc2l0eURlbHRhOiBjb250ZXh0LnZlcmJvc2l0eVJlcXVlc3QudmVyYm9zaXR5RGVsdGEsIHByZXZpb3VzSG92ZXIgfTtcblx0XHRcdHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUhvdmVyKGRvYywgcG9zLCB0b2tlbiwgaG92ZXJDb250ZXh0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dmFsdWUgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlSG92ZXIoZG9jLCBwb3MsIHRva2VuKTtcblx0XHR9XG5cdFx0aWYgKCF2YWx1ZSB8fCBpc0ZhbHN5T3JFbXB0eSh2YWx1ZS5jb250ZW50cykpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGlmICghdmFsdWUucmFuZ2UpIHtcblx0XHRcdHZhbHVlLnJhbmdlID0gZG9jLmdldFdvcmRSYW5nZUF0UG9zaXRpb24ocG9zKTtcblx0XHR9XG5cdFx0aWYgKCF2YWx1ZS5yYW5nZSkge1xuXHRcdFx0dmFsdWUucmFuZ2UgPSBuZXcgUmFuZ2UocG9zLCBwb3MpO1xuXHRcdH1cblx0XHRjb25zdCBjb252ZXJ0ZWRIb3ZlcjogbGFuZ3VhZ2VzLkhvdmVyID0gdHlwZUNvbnZlcnQuSG92ZXIuZnJvbSh2YWx1ZSk7XG5cdFx0Y29uc3QgaWQgPSB0aGlzLl9ob3ZlckNvdW50ZXI7XG5cdFx0Ly8gQ2hlY2sgaWYgaG92ZXIgbWFwIGhhcyBtb3JlIHRoYW4gMTAgZWxlbWVudHMgYW5kIGlmIHllcywgcmVtb3ZlIG9sZGVzdCBmcm9tIHRoZSBtYXBcblx0XHRpZiAodGhpcy5faG92ZXJNYXAuc2l6ZSA9PT0gSG92ZXJBZGFwdGVyLkhPVkVSX01BUF9NQVhfU0laRSkge1xuXHRcdFx0Y29uc3QgbWluaW11bUlkID0gTWF0aC5taW4oLi4udGhpcy5faG92ZXJNYXAua2V5cygpKTtcblx0XHRcdHRoaXMuX2hvdmVyTWFwLmRlbGV0ZShtaW5pbXVtSWQpO1xuXHRcdH1cblx0XHR0aGlzLl9ob3Zlck1hcC5zZXQoaWQsIHZhbHVlKTtcblx0XHR0aGlzLl9ob3ZlckNvdW50ZXIgKz0gMTtcblx0XHRjb25zdCBob3ZlcjogZXh0SG9zdFByb3RvY29sLkhvdmVyV2l0aElkID0ge1xuXHRcdFx0Li4uY29udmVydGVkSG92ZXIsXG5cdFx0XHRpZFxuXHRcdH07XG5cdFx0cmV0dXJuIGhvdmVyO1xuXHR9XG5cblx0cmVsZWFzZUhvdmVyKGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9ob3Zlck1hcC5kZWxldGUoaWQpO1xuXHR9XG59XG5cbmNsYXNzIEV2YWx1YXRhYmxlRXhwcmVzc2lvbkFkYXB0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLkV2YWx1YXRhYmxlRXhwcmVzc2lvblByb3ZpZGVyLFxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVFdmFsdWF0YWJsZUV4cHJlc3Npb24ocmVzb3VyY2U6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRXZhbHVhdGFibGVFeHByZXNzaW9uIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUV2YWx1YXRhYmxlRXhwcmVzc2lvbihkb2MsIHBvcywgdG9rZW4pO1xuXHRcdGlmICh2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIHR5cGVDb252ZXJ0LkV2YWx1YXRhYmxlRXhwcmVzc2lvbi5mcm9tKHZhbHVlKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBJbmxpbmVWYWx1ZXNBZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5JbmxpbmVWYWx1ZXNQcm92aWRlcixcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlSW5saW5lVmFsdWVzKHJlc291cmNlOiBVUkksIHZpZXdQb3J0OiBJUmFuZ2UsIGNvbnRleHQ6IGV4dEhvc3RQcm90b2NvbC5JSW5saW5lVmFsdWVDb250ZXh0RHRvLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5JbmxpbmVWYWx1ZVtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVJbmxpbmVWYWx1ZXMoZG9jLCB0eXBlQ29udmVydC5SYW5nZS50byh2aWV3UG9ydCksIHR5cGVDb252ZXJ0LklubGluZVZhbHVlQ29udGV4dC50byhjb250ZXh0KSwgdG9rZW4pO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcChpdiA9PiB0eXBlQ29udmVydC5JbmxpbmVWYWx1ZS5mcm9tKGl2KSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuY2xhc3MgRG9jdW1lbnRIaWdobGlnaHRBZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cyhyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Eb2N1bWVudEhpZ2hsaWdodFtdIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cyhkb2MsIHBvcywgdG9rZW4pO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcCh0eXBlQ29udmVydC5Eb2N1bWVudEhpZ2hsaWdodC5mcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBNdWx0aURvY3VtZW50SGlnaGxpZ2h0QWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuTXVsdGlEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVNdWx0aURvY3VtZW50SGlnaGxpZ2h0cyhyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBvdGhlclJlc291cmNlczogVVJJW10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLk11bHRpRG9jdW1lbnRIaWdobGlnaHRbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3Qgb3RoZXJEb2N1bWVudHMgPSBvdGhlclJlc291cmNlcy5tYXAociA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHIpO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoJ0Vycm9yOiBVbmFibGUgdG8gcmV0cmlldmUgZG9jdW1lbnQgZnJvbSBVUkk6ICcgKyByICsgJy4gRXJyb3IgbWVzc2FnZTogJyArIGVycik7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkuZmlsdGVyKGRvYyA9PiBkb2MgIT09IHVuZGVmaW5lZCk7XG5cblx0XHRjb25zdCBwb3MgPSB0eXBlQ29udmVydC5Qb3NpdGlvbi50byhwb3NpdGlvbik7XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVNdWx0aURvY3VtZW50SGlnaGxpZ2h0cyhkb2MsIHBvcywgb3RoZXJEb2N1bWVudHMsIHRva2VuKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiB2YWx1ZS5tYXAodHlwZUNvbnZlcnQuTXVsdGlEb2N1bWVudEhpZ2hsaWdodC5mcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBMaW5rZWRFZGl0aW5nUmFuZ2VBZGFwdGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXJcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlTGlua2VkRWRpdGluZ1JhbmdlcyhyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5MaW5rZWRFZGl0aW5nUmFuZ2VzIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUxpbmtlZEVkaXRpbmdSYW5nZXMoZG9jLCBwb3MsIHRva2VuKTtcblx0XHRpZiAodmFsdWUgJiYgQXJyYXkuaXNBcnJheSh2YWx1ZS5yYW5nZXMpKSB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRyYW5nZXM6IGNvYWxlc2NlKHZhbHVlLnJhbmdlcy5tYXAodHlwZUNvbnZlcnQuUmFuZ2UuZnJvbSkpLFxuXHRcdFx0XHR3b3JkUGF0dGVybjogdmFsdWUud29yZFBhdHRlcm5cblx0XHRcdH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuY2xhc3MgUmVmZXJlbmNlQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuUmVmZXJlbmNlUHJvdmlkZXJcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlUmVmZXJlbmNlcyhyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjb250ZXh0OiBsYW5ndWFnZXMuUmVmZXJlbmNlQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTG9jYXRpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlUmVmZXJlbmNlcyhkb2MsIHBvcywgY29udGV4dCwgdG9rZW4pO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcCh0eXBlQ29udmVydC5sb2NhdGlvbi5mcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIEN1c3RvbUNvZGVBY3Rpb24gZXh0ZW5kcyBleHRIb3N0UHJvdG9jb2wuSUNvZGVBY3Rpb25EdG8ge1xuXHRfaXNTeW50aGV0aWM/OiBib29sZWFuO1xufVxuXG5jbGFzcyBDb2RlQWN0aW9uQWRhcHRlciB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IF9tYXhDb2RlQWN0aW9uc1BlckZpbGU6IG51bWJlciA9IDEwMDA7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2FjaGUgPSBuZXcgQ2FjaGU8dnNjb2RlLkNvZGVBY3Rpb24gfCB2c2NvZGUuQ29tbWFuZD4oJ0NvZGVBY3Rpb24nKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgTWFwPG51bWJlciwgRGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kczogQ29tbWFuZHNDb252ZXJ0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlhZ25vc3RpY3M6IEV4dEhvc3REaWFnbm9zdGljcyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLkNvZGVBY3Rpb25Qcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9hcGlEZXByZWNhdGlvbjogSUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZUNvZGVBY3Rpb25zKHJlc291cmNlOiBVUkksIHJhbmdlT3JTZWxlY3Rpb246IElSYW5nZSB8IElTZWxlY3Rpb24sIGNvbnRleHQ6IGxhbmd1YWdlcy5Db2RlQWN0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUNvZGVBY3Rpb25MaXN0RHRvIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHJhbiA9IFNlbGVjdGlvbi5pc0lTZWxlY3Rpb24ocmFuZ2VPclNlbGVjdGlvbilcblx0XHRcdD8gPHZzY29kZS5TZWxlY3Rpb24+dHlwZUNvbnZlcnQuU2VsZWN0aW9uLnRvKHJhbmdlT3JTZWxlY3Rpb24pXG5cdFx0XHQ6IDx2c2NvZGUuUmFuZ2U+dHlwZUNvbnZlcnQuUmFuZ2UudG8ocmFuZ2VPclNlbGVjdGlvbik7XG5cdFx0Y29uc3QgYWxsRGlhZ25vc3RpY3M6IHZzY29kZS5EaWFnbm9zdGljW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgZGlhZ25vc3RpYyBvZiB0aGlzLl9kaWFnbm9zdGljcy5nZXREaWFnbm9zdGljcyhyZXNvdXJjZSkpIHtcblx0XHRcdGlmIChyYW4uaW50ZXJzZWN0aW9uKGRpYWdub3N0aWMucmFuZ2UpKSB7XG5cdFx0XHRcdGNvbnN0IG5ld0xlbiA9IGFsbERpYWdub3N0aWNzLnB1c2goZGlhZ25vc3RpYyk7XG5cdFx0XHRcdGlmIChuZXdMZW4gPiBDb2RlQWN0aW9uQWRhcHRlci5fbWF4Q29kZUFjdGlvbnNQZXJGaWxlKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRjb25zdCBjb2RlQWN0aW9uQ29udGV4dDogdnNjb2RlLkNvZGVBY3Rpb25Db250ZXh0ID0ge1xuXHRcdFx0ZGlhZ25vc3RpY3M6IGFsbERpYWdub3N0aWNzLFxuXHRcdFx0b25seTogY29udGV4dC5vbmx5ID8gbmV3IENvZGVBY3Rpb25LaW5kKGNvbnRleHQub25seSkgOiB1bmRlZmluZWQsXG5cdFx0XHR0cmlnZ2VyS2luZDogdHlwZUNvbnZlcnQuQ29kZUFjdGlvblRyaWdnZXJLaW5kLnRvKGNvbnRleHQudHJpZ2dlciksXG5cdFx0fTtcblxuXHRcdGNvbnN0IGNvbW1hbmRzT3JBY3Rpb25zID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUNvZGVBY3Rpb25zKGRvYywgcmFuLCBjb2RlQWN0aW9uQ29udGV4dCwgdG9rZW4pO1xuXHRcdGlmICghaXNOb25FbXB0eUFycmF5KGNvbW1hbmRzT3JBY3Rpb25zKSB8fCB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBjYWNoZUlkID0gdGhpcy5fY2FjaGUuYWRkKGNvbW1hbmRzT3JBY3Rpb25zKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5zZXQoY2FjaGVJZCwgZGlzcG9zYWJsZXMpO1xuXHRcdGNvbnN0IGFjdGlvbnM6IEN1c3RvbUNvZGVBY3Rpb25bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgY29tbWFuZHNPckFjdGlvbnMubGVuZ3RoOyBpKyspIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IGNvbW1hbmRzT3JBY3Rpb25zW2ldO1xuXHRcdFx0aWYgKCFjYW5kaWRhdGUpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChDb2RlQWN0aW9uQWRhcHRlci5faXNDb21tYW5kKGNhbmRpZGF0ZSkgJiYgIShjYW5kaWRhdGUgaW5zdGFuY2VvZiBDb2RlQWN0aW9uKSkge1xuXHRcdFx0XHQvLyBvbGQgc2Nob29sOiBzeW50aGV0aWMgY29kZSBhY3Rpb25cblx0XHRcdFx0dGhpcy5fYXBpRGVwcmVjYXRpb24ucmVwb3J0KCdDb2RlQWN0aW9uUHJvdmlkZXIucHJvdmlkZUNvZGVBY3Rpb25zIC0gcmV0dXJuIGNvbW1hbmRzJywgdGhpcy5fZXh0ZW5zaW9uLFxuXHRcdFx0XHRcdGBSZXR1cm4gJ0NvZGVBY3Rpb24nIGluc3RhbmNlcyBpbnN0ZWFkLmApO1xuXG5cdFx0XHRcdGFjdGlvbnMucHVzaCh7XG5cdFx0XHRcdFx0X2lzU3ludGhldGljOiB0cnVlLFxuXHRcdFx0XHRcdHRpdGxlOiBjYW5kaWRhdGUudGl0bGUsXG5cdFx0XHRcdFx0Y29tbWFuZDogdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChjYW5kaWRhdGUsIGRpc3Bvc2FibGVzKSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjb25zdCB0b0NvbnZlcnQgPSBjYW5kaWRhdGUgYXMgdnNjb2RlLkNvZGVBY3Rpb247XG5cblx0XHRcdFx0Ly8gbmV3IHNjaG9vbDogY29udmVydCBjb2RlIGFjdGlvblxuXHRcdFx0XHRpZiAoY29kZUFjdGlvbkNvbnRleHQub25seSkge1xuXHRcdFx0XHRcdGlmICghdG9Db252ZXJ0LmtpbmQpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX0gLSBDb2RlIGFjdGlvbnMgb2Yga2luZCAnJHtjb2RlQWN0aW9uQ29udGV4dC5vbmx5LnZhbHVlfScgcmVxdWVzdGVkIGJ1dCByZXR1cm5lZCBjb2RlIGFjdGlvbiBkb2VzIG5vdCBoYXZlIGEgJ2tpbmQnLiBDb2RlIGFjdGlvbiB3aWxsIGJlIGRyb3BwZWQuIFBsZWFzZSBzZXQgJ0NvZGVBY3Rpb24ua2luZCcuYCk7XG5cdFx0XHRcdFx0fSBlbHNlIGlmICghY29kZUFjdGlvbkNvbnRleHQub25seS5jb250YWlucyh0b0NvbnZlcnQua2luZCkpIHtcblx0XHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX0gLSBDb2RlIGFjdGlvbnMgb2Yga2luZCAnJHtjb2RlQWN0aW9uQ29udGV4dC5vbmx5LnZhbHVlfScgcmVxdWVzdGVkIGJ1dCByZXR1cm5lZCBjb2RlIGFjdGlvbiBpcyBvZiBraW5kICcke3RvQ29udmVydC5raW5kLnZhbHVlfScuIENvZGUgYWN0aW9uIHdpbGwgYmUgZHJvcHBlZC4gUGxlYXNlIGNoZWNrICdDb2RlQWN0aW9uQ29udGV4dC5vbmx5JyB0byBvbmx5IHJldHVybiByZXF1ZXN0ZWQgY29kZSBhY3Rpb25zLmApO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIEVuc3VyZXMgdGhhdCB0aGlzIGlzIGVpdGhlciBhIFJhbmdlW10gb3IgYW4gZW1wdHkgYXJyYXkgc28gd2UgZG9uJ3QgZ2V0IEFycmF5PFJhbmdlIHwgdW5kZWZpbmVkPlxuXHRcdFx0XHRjb25zdCByYW5nZSA9IHRvQ29udmVydC5yYW5nZXMgPz8gW107XG5cblx0XHRcdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdFx0XHRjYWNoZUlkOiBbY2FjaGVJZCwgaV0sXG5cdFx0XHRcdFx0dGl0bGU6IHRvQ29udmVydC50aXRsZSxcblx0XHRcdFx0XHRjb21tYW5kOiB0b0NvbnZlcnQuY29tbWFuZCAmJiB0aGlzLl9jb21tYW5kcy50b0ludGVybmFsKHRvQ29udmVydC5jb21tYW5kLCBkaXNwb3NhYmxlcyksXG5cdFx0XHRcdFx0ZGlhZ25vc3RpY3M6IHRvQ29udmVydC5kaWFnbm9zdGljcyAmJiB0b0NvbnZlcnQuZGlhZ25vc3RpY3MubWFwKHR5cGVDb252ZXJ0LkRpYWdub3N0aWMuZnJvbSksXG5cdFx0XHRcdFx0ZWRpdDogdG9Db252ZXJ0LmVkaXQgJiYgdHlwZUNvbnZlcnQuV29ya3NwYWNlRWRpdC5mcm9tKHRvQ29udmVydC5lZGl0LCB1bmRlZmluZWQpLFxuXHRcdFx0XHRcdGtpbmQ6IHRvQ29udmVydC5raW5kICYmIHRvQ29udmVydC5raW5kLnZhbHVlLFxuXHRcdFx0XHRcdGlzUHJlZmVycmVkOiB0b0NvbnZlcnQuaXNQcmVmZXJyZWQsXG5cdFx0XHRcdFx0aXNBSTogaXNQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAnY29kZUFjdGlvbkFJJykgPyB0b0NvbnZlcnQuaXNBSSA6IGZhbHNlLFxuXHRcdFx0XHRcdHJhbmdlczogaXNQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAnY29kZUFjdGlvblJhbmdlcycpID8gY29hbGVzY2UocmFuZ2UubWFwKHR5cGVDb252ZXJ0LlJhbmdlLmZyb20pKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRkaXNhYmxlZDogdG9Db252ZXJ0LmRpc2FibGVkPy5yZWFzb25cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7IGNhY2hlSWQsIGFjdGlvbnMgfTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVDb2RlQWN0aW9uKGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBlZGl0PzogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VFZGl0RHRvOyBjb21tYW5kPzogZXh0SG9zdFByb3RvY29sLklDb21tYW5kRHRvIH0+IHtcblx0XHRjb25zdCBbc2Vzc2lvbklkLCBpdGVtSWRdID0gaWQ7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldChzZXNzaW9uSWQsIGl0ZW1JZCk7XG5cdFx0aWYgKCFpdGVtIHx8IENvZGVBY3Rpb25BZGFwdGVyLl9pc0NvbW1hbmQoaXRlbSkpIHtcblx0XHRcdHJldHVybiB7fTsgLy8gY29kZSBhY3Rpb25zIG9ubHkhXG5cdFx0fVxuXHRcdGlmICghdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUNvZGVBY3Rpb24pIHtcblx0XHRcdHJldHVybiB7fTsgLy8gdGhpcyBzaG91bGQgbm90IGhhcHBlbi4uLlxuXHRcdH1cblxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRJdGVtID0gKGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnJlc29sdmVDb2RlQWN0aW9uKGl0ZW0sIHRva2VuKSkgPz8gaXRlbTtcblxuXHRcdGxldCByZXNvbHZlZEVkaXQ6IGV4dEhvc3RQcm90b2NvbC5JV29ya3NwYWNlRWRpdER0byB8IHVuZGVmaW5lZDtcblx0XHRpZiAocmVzb2x2ZWRJdGVtLmVkaXQpIHtcblx0XHRcdHJlc29sdmVkRWRpdCA9IHR5cGVDb252ZXJ0LldvcmtzcGFjZUVkaXQuZnJvbShyZXNvbHZlZEl0ZW0uZWRpdCwgdW5kZWZpbmVkKTtcblx0XHR9XG5cblx0XHRsZXQgcmVzb2x2ZWRDb21tYW5kOiBleHRIb3N0UHJvdG9jb2wuSUNvbW1hbmREdG8gfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHJlc29sdmVkSXRlbS5jb21tYW5kKSB7XG5cdFx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IHRoaXMuX2Rpc3Bvc2FibGVzLmdldChzZXNzaW9uSWQpO1xuXHRcdFx0aWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRcdHJlc29sdmVkQ29tbWFuZCA9IHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwocmVzb2x2ZWRJdGVtLmNvbW1hbmQsIGRpc3Bvc2FibGVzKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4geyBlZGl0OiByZXNvbHZlZEVkaXQsIGNvbW1hbmQ6IHJlc29sdmVkQ29tbWFuZCB9O1xuXHR9XG5cblx0cmVsZWFzZUNvZGVBY3Rpb25zKGNhY2hlZElkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5nZXQoY2FjaGVkSWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGVsZXRlKGNhY2hlZElkKTtcblx0XHR0aGlzLl9jYWNoZS5kZWxldGUoY2FjaGVkSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lzQ29tbWFuZCh0aGluZzogYW55KTogdGhpbmcgaXMgdnNjb2RlLkNvbW1hbmQge1xuXHRcdHJldHVybiB0eXBlb2YgKDx2c2NvZGUuQ29tbWFuZD50aGluZykuY29tbWFuZCA9PT0gJ3N0cmluZycgJiYgdHlwZW9mICg8dnNjb2RlLkNvbW1hbmQ+dGhpbmcpLnRpdGxlID09PSAnc3RyaW5nJztcblx0fVxufVxuXG5jbGFzcyBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyIHtcblxuXHRwcml2YXRlIF9jYWNoZWRQcmVwYXJlPzogTWFwPHN0cmluZywgdnNjb2RlLkRhdGFUcmFuc2Zlckl0ZW0+O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRzQ2FjaGUgPSBuZXcgQ2FjaGU8dnNjb2RlLkRvY3VtZW50UGFzdGVFZGl0PignRG9jdW1lbnRQYXN0ZUVkaXQuZWRpdHMnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogZXh0SG9zdFByb3RvY29sLk1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9oYW5kbGU6IG51bWJlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0KSB7IH1cblxuXHRhc3luYyBwcmVwYXJlRG9jdW1lbnRQYXN0ZShyZXNvdXJjZTogVVJJLCByYW5nZXM6IElSYW5nZVtdLCBkYXRhVHJhbnNmZXJEdG86IGV4dEhvc3RQcm90b2NvbC5EYXRhVHJhbnNmZXJEVE8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLkRhdGFUcmFuc2ZlckRUTyB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICghdGhpcy5fcHJvdmlkZXIucHJlcGFyZURvY3VtZW50UGFzdGUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9jYWNoZWRQcmVwYXJlID0gdW5kZWZpbmVkO1xuXG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCB2c2NvZGVSYW5nZXMgPSByYW5nZXMubWFwKHJhbmdlID0+IHR5cGVDb252ZXJ0LlJhbmdlLnRvKHJhbmdlKSk7XG5cblx0XHRjb25zdCBkYXRhVHJhbnNmZXIgPSB0eXBlQ29udmVydC5EYXRhVHJhbnNmZXIudG9EYXRhVHJhbnNmZXIoZGF0YVRyYW5zZmVyRHRvLCAoKSA9PiB7XG5cdFx0XHR0aHJvdyBuZXcgTm90SW1wbGVtZW50ZWRFcnJvcigpO1xuXHRcdH0pO1xuXHRcdGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByZXBhcmVEb2N1bWVudFBhc3RlKGRvYywgdnNjb2RlUmFuZ2VzLCBkYXRhVHJhbnNmZXIsIHRva2VuKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBPbmx5IHNlbmQgYmFjayB2YWx1ZXMgdGhhdCBoYXZlIGJlZW4gYWRkZWQgdG8gdGhlIGRhdGEgdHJhbnNmZXJcblx0XHRjb25zdCBuZXdFbnRyaWVzID0gQXJyYXkuZnJvbShkYXRhVHJhbnNmZXIpLmZpbHRlcigoWywgdmFsdWVdKSA9PiAhKHZhbHVlIGluc3RhbmNlb2YgSW50ZXJuYWxEYXRhVHJhbnNmZXJJdGVtKSk7XG5cblx0XHQvLyBTdG9yZSBvZmYgb3JpZ2luYWwgZGF0YSB0cmFuc2ZlciBpdGVtcyBzbyB3ZSBjYW4gcmV0cmlldmUgdGhlbSBvbiBwYXN0ZVxuXHRcdGNvbnN0IG5ld0NhY2hlID0gbmV3IE1hcDxzdHJpbmcsIHZzY29kZS5EYXRhVHJhbnNmZXJJdGVtPigpO1xuXG5cdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCBQcm9taXNlLmFsbChBcnJheS5mcm9tKG5ld0VudHJpZXMsIGFzeW5jIChbbWltZSwgdmFsdWVdKSA9PiB7XG5cdFx0XHRjb25zdCBpZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdFx0bmV3Q2FjaGUuc2V0KGlkLCB2YWx1ZSk7XG5cdFx0XHRyZXR1cm4gW21pbWUsIGF3YWl0IHR5cGVDb252ZXJ0LkRhdGFUcmFuc2Zlckl0ZW0uZnJvbShtaW1lLCB2YWx1ZSwgaWQpXSBhcyBjb25zdDtcblx0XHR9KSk7XG5cblx0XHR0aGlzLl9jYWNoZWRQcmVwYXJlID0gbmV3Q2FjaGU7XG5cblx0XHRyZXR1cm4geyBpdGVtcyB9O1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZVBhc3RlRWRpdHMocmVxdWVzdElkOiBudW1iZXIsIHJlc291cmNlOiBVUkksIHJhbmdlczogSVJhbmdlW10sIGRhdGFUcmFuc2ZlckR0bzogZXh0SG9zdFByb3RvY29sLkRhdGFUcmFuc2ZlckRUTywgY29udGV4dDogZXh0SG9zdFByb3RvY29sLklEb2N1bWVudFBhc3RlQ29udGV4dER0bywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVBhc3RlRWRpdER0b1tdPiB7XG5cdFx0aWYgKCF0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRQYXN0ZUVkaXRzKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCB2c2NvZGVSYW5nZXMgPSByYW5nZXMubWFwKHJhbmdlID0+IHR5cGVDb252ZXJ0LlJhbmdlLnRvKHJhbmdlKSk7XG5cblx0XHRjb25zdCBpdGVtcyA9IGRhdGFUcmFuc2ZlckR0by5pdGVtcy5tYXAoKFttaW1lLCB2YWx1ZV0pOiBbc3RyaW5nLCB2c2NvZGUuRGF0YVRyYW5zZmVySXRlbV0gPT4ge1xuXHRcdFx0Y29uc3QgY2FjaGVkID0gdGhpcy5fY2FjaGVkUHJlcGFyZT8uZ2V0KHZhbHVlLmlkKTtcblx0XHRcdGlmIChjYWNoZWQpIHtcblx0XHRcdFx0cmV0dXJuIFttaW1lLCBjYWNoZWRdO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRtaW1lLFxuXHRcdFx0XHR0eXBlQ29udmVydC5EYXRhVHJhbnNmZXJJdGVtLnRvKG1pbWUsIHZhbHVlLCBhc3luYyBpZCA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIChhd2FpdCB0aGlzLl9wcm94eS4kcmVzb2x2ZVBhc3RlRmlsZURhdGEodGhpcy5faGFuZGxlLCByZXF1ZXN0SWQsIGlkKSkuYnVmZmVyO1xuXHRcdFx0XHR9KVxuXHRcdFx0XTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRhdGFUcmFuc2ZlciA9IG5ldyBEYXRhVHJhbnNmZXIoaXRlbXMpO1xuXG5cdFx0Y29uc3QgZWRpdHMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRQYXN0ZUVkaXRzKGRvYywgdnNjb2RlUmFuZ2VzLCBkYXRhVHJhbnNmZXIsIHtcblx0XHRcdG9ubHk6IGNvbnRleHQub25seSA/IG5ldyBEb2N1bWVudERyb3BPclBhc3RlRWRpdEtpbmQoY29udGV4dC5vbmx5KSA6IHVuZGVmaW5lZCxcblx0XHRcdHRyaWdnZXJLaW5kOiBjb250ZXh0LnRyaWdnZXJLaW5kLFxuXHRcdH0sIHRva2VuKTtcblx0XHRpZiAoIWVkaXRzIHx8IHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2FjaGVJZCA9IHRoaXMuX2VkaXRzQ2FjaGUuYWRkKGVkaXRzKTtcblxuXHRcdHJldHVybiBlZGl0cy5tYXAoKGVkaXQsIGkpOiBleHRIb3N0UHJvdG9jb2wuSVBhc3RlRWRpdER0byA9PiAoe1xuXHRcdFx0X2NhY2hlSWQ6IFtjYWNoZUlkLCBpXSxcblx0XHRcdHRpdGxlOiBlZGl0LnRpdGxlID8/IGxvY2FsaXplKCdkZWZhdWx0UGFzdGVMYWJlbCcsIFwiUGFzdGUgdXNpbmcgJ3swfScgZXh0ZW5zaW9uXCIsIHRoaXMuX2V4dGVuc2lvbi5kaXNwbGF5TmFtZSB8fCB0aGlzLl9leHRlbnNpb24ubmFtZSksXG5cdFx0XHRraW5kOiBlZGl0LmtpbmQsXG5cdFx0XHR5aWVsZFRvOiBlZGl0LnlpZWxkVG8/Lm1hcCh4ID0+IHgudmFsdWUpLFxuXHRcdFx0aW5zZXJ0VGV4dDogdHlwZW9mIGVkaXQuaW5zZXJ0VGV4dCA9PT0gJ3N0cmluZycgPyBlZGl0Lmluc2VydFRleHQgOiB7IHNuaXBwZXQ6IGVkaXQuaW5zZXJ0VGV4dC52YWx1ZSB9LFxuXHRcdFx0YWRkaXRpb25hbEVkaXQ6IGVkaXQuYWRkaXRpb25hbEVkaXQgPyB0eXBlQ29udmVydC5Xb3Jrc3BhY2VFZGl0LmZyb20oZWRpdC5hZGRpdGlvbmFsRWRpdCwgdW5kZWZpbmVkKSA6IHVuZGVmaW5lZCxcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlUGFzdGVFZGl0KGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBpbnNlcnRUZXh0Pzogc3RyaW5nIHwgdnNjb2RlLlNuaXBwZXRTdHJpbmc7IGFkZGl0aW9uYWxFZGl0PzogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VFZGl0RHRvIH0+IHtcblx0XHRjb25zdCBbc2Vzc2lvbklkLCBpdGVtSWRdID0gaWQ7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2VkaXRzQ2FjaGUuZ2V0KHNlc3Npb25JZCwgaXRlbUlkKTtcblx0XHRpZiAoIWl0ZW0gfHwgIXRoaXMuX3Byb3ZpZGVyLnJlc29sdmVEb2N1bWVudFBhc3RlRWRpdCkge1xuXHRcdFx0cmV0dXJuIHt9OyAvLyB0aGlzIHNob3VsZCBub3QgaGFwcGVuLi4uXG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRJdGVtID0gKGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnJlc29sdmVEb2N1bWVudFBhc3RlRWRpdChpdGVtLCB0b2tlbikpID8/IGl0ZW07XG5cdFx0cmV0dXJuIHtcblx0XHRcdGluc2VydFRleHQ6IHJlc29sdmVkSXRlbS5pbnNlcnRUZXh0LFxuXHRcdFx0YWRkaXRpb25hbEVkaXQ6IHJlc29sdmVkSXRlbS5hZGRpdGlvbmFsRWRpdCA/IHR5cGVDb252ZXJ0LldvcmtzcGFjZUVkaXQuZnJvbShyZXNvbHZlZEl0ZW0uYWRkaXRpb25hbEVkaXQsIHVuZGVmaW5lZCkgOiB1bmRlZmluZWRcblx0XHR9O1xuXHR9XG5cblx0cmVsZWFzZVBhc3RlRWRpdHMoaWQ6IG51bWJlcik6IGFueSB7XG5cdFx0dGhpcy5fZWRpdHNDYWNoZS5kZWxldGUoaWQpO1xuXHR9XG59XG5cbmNsYXNzIERvY3VtZW50Rm9ybWF0dGluZ0FkYXB0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLkRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVEb2N1bWVudEZvcm1hdHRpbmdFZGl0cyhyZXNvdXJjZTogVVJJLCBvcHRpb25zOiBsYW5ndWFnZXMuRm9ybWF0dGluZ09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlRleHRFZGl0W10gfCB1bmRlZmluZWQ+IHtcblxuXHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzKGRvY3VtZW50LCA8YW55Pm9wdGlvbnMsIHRva2VuKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiB2YWx1ZS5tYXAodHlwZUNvbnZlcnQuVGV4dEVkaXQuZnJvbSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cbn1cblxuY2xhc3MgUmFuZ2VGb3JtYXR0aW5nQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXJcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0cyhyZXNvdXJjZTogVVJJLCByYW5nZTogSVJhbmdlLCBvcHRpb25zOiBsYW5ndWFnZXMuRm9ybWF0dGluZ09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlRleHRFZGl0W10gfCB1bmRlZmluZWQ+IHtcblxuXHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCByYW4gPSB0eXBlQ29udmVydC5SYW5nZS50byhyYW5nZSk7XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVEb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRzKGRvY3VtZW50LCByYW4sIDxhbnk+b3B0aW9ucywgdG9rZW4pO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcCh0eXBlQ29udmVydC5UZXh0RWRpdC5mcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVEb2N1bWVudFJhbmdlc0Zvcm1hdHRpbmdFZGl0cyhyZXNvdXJjZTogVVJJLCByYW5nZXM6IElSYW5nZVtdLCBvcHRpb25zOiBsYW5ndWFnZXMuRm9ybWF0dGluZ09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlRleHRFZGl0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRhc3NlcnRUeXBlKHR5cGVvZiB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRSYW5nZXNGb3JtYXR0aW5nRWRpdHMgPT09ICdmdW5jdGlvbicsICdJTlZBTElEIGludm9jYXRpb24gb2YgYHByb3ZpZGVEb2N1bWVudFJhbmdlc0Zvcm1hdHRpbmdFZGl0c2AnKTtcblxuXHRcdGNvbnN0IGRvY3VtZW50ID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCBfcmFuZ2VzID0gPFJhbmdlW10+cmFuZ2VzLm1hcCh0eXBlQ29udmVydC5SYW5nZS50byk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRSYW5nZXNGb3JtYXR0aW5nRWRpdHMoZG9jdW1lbnQsIF9yYW5nZXMsIDxhbnk+b3B0aW9ucywgdG9rZW4pO1xuXHRcdGlmIChBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcCh0eXBlQ29udmVydC5UZXh0RWRpdC5mcm9tKTtcblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5jbGFzcyBPblR5cGVGb3JtYXR0aW5nQWRhcHRlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuT25UeXBlRm9ybWF0dGluZ0VkaXRQcm92aWRlclxuXHQpIHsgfVxuXG5cdGF1dG9Gb3JtYXRUcmlnZ2VyQ2hhcmFjdGVyczogc3RyaW5nW10gPSBbXTsgLy8gbm90IGhlcmVcblxuXHRhc3luYyBwcm92aWRlT25UeXBlRm9ybWF0dGluZ0VkaXRzKHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24sIGNoOiBzdHJpbmcsIG9wdGlvbnM6IGxhbmd1YWdlcy5Gb3JtYXR0aW5nT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0Y29uc3QgZG9jdW1lbnQgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZU9uVHlwZUZvcm1hdHRpbmdFZGl0cyhkb2N1bWVudCwgcG9zLCBjaCwgPGFueT5vcHRpb25zLCB0b2tlbik7XG5cdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRyZXR1cm4gdmFsdWUubWFwKHR5cGVDb252ZXJ0LlRleHRFZGl0LmZyb20pO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG59XG5cbmNsYXNzIE5hdmlnYXRlVHlwZUFkYXB0ZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IENhY2hlPHZzY29kZS5TeW1ib2xJbmZvcm1hdGlvbj4oJ1dvcmtzcGFjZVN5bWJvbHMnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoc2VhcmNoOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VTeW1ib2xzRHRvPiB7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlV29ya3NwYWNlU3ltYm9scyhzZWFyY2gsIHRva2VuKTtcblxuXHRcdGlmICghaXNOb25FbXB0eUFycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHsgc3ltYm9sczogW10gfTtcblx0XHR9XG5cblx0XHRjb25zdCBzaWQgPSB0aGlzLl9jYWNoZS5hZGQodmFsdWUpO1xuXHRcdGNvbnN0IHJlc3VsdDogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VTeW1ib2xzRHRvID0ge1xuXHRcdFx0Y2FjaGVJZDogc2lkLFxuXHRcdFx0c3ltYm9sczogW11cblx0XHR9O1xuXG5cdFx0Zm9yIChsZXQgaSA9IDA7IGkgPCB2YWx1ZS5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IHZhbHVlW2ldO1xuXHRcdFx0aWYgKCFpdGVtIHx8ICFpdGVtLm5hbWUpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdJTlZBTElEIFN5bWJvbEluZm9ybWF0aW9uJywgaXRlbSk7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0cmVzdWx0LnN5bWJvbHMucHVzaCh7XG5cdFx0XHRcdC4uLnR5cGVDb252ZXJ0LldvcmtzcGFjZVN5bWJvbC5mcm9tKGl0ZW0pLFxuXHRcdFx0XHRjYWNoZUlkOiBbc2lkLCBpXVxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVXb3Jrc3BhY2VTeW1ib2woc3ltYm9sOiBleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZVN5bWJvbER0bywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZVN5bWJvbER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZVdvcmtzcGFjZVN5bWJvbCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHN5bWJvbDtcblx0XHR9XG5cdFx0aWYgKCFzeW1ib2wuY2FjaGVJZCkge1xuXHRcdFx0cmV0dXJuIHN5bWJvbDtcblx0XHR9XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldCguLi5zeW1ib2wuY2FjaGVJZCk7XG5cdFx0aWYgKGl0ZW0pIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZVdvcmtzcGFjZVN5bWJvbChpdGVtLCB0b2tlbik7XG5cdFx0XHRyZXR1cm4gdmFsdWUgJiYgbWl4aW4oc3ltYm9sLCB0eXBlQ29udmVydC5Xb3Jrc3BhY2VTeW1ib2wuZnJvbSh2YWx1ZSksIHRydWUpO1xuXHRcdH1cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cmVsZWFzZVdvcmtzcGFjZVN5bWJvbHMoaWQ6IG51bWJlcik6IGFueSB7XG5cdFx0dGhpcy5fY2FjaGUuZGVsZXRlKGlkKTtcblx0fVxufVxuXG5jbGFzcyBSZW5hbWVBZGFwdGVyIHtcblxuXHRzdGF0aWMgc3VwcG9ydHNSZXNvbHZpbmcocHJvdmlkZXI6IHZzY29kZS5SZW5hbWVQcm92aWRlcik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0eXBlb2YgcHJvdmlkZXIucHJlcGFyZVJlbmFtZSA9PT0gJ2Z1bmN0aW9uJztcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLlJlbmFtZVByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZVJlbmFtZUVkaXRzKHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24sIG5ld05hbWU6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZUVkaXREdG8gJiBsYW5ndWFnZXMuUmVqZWN0aW9uIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVSZW5hbWVFZGl0cyhkb2MsIHBvcywgbmV3TmFtZSwgdG9rZW4pO1xuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHR5cGVDb252ZXJ0LldvcmtzcGFjZUVkaXQuZnJvbSh2YWx1ZSk7XG5cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnN0IHJlamVjdFJlYXNvbiA9IFJlbmFtZUFkYXB0ZXIuX2FzTWVzc2FnZShlcnIpO1xuXHRcdFx0aWYgKHJlamVjdFJlYXNvbikge1xuXHRcdFx0XHRyZXR1cm4geyByZWplY3RSZWFzb24sIGVkaXRzOiB1bmRlZmluZWQhIH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHQvLyBnZW5lcmljIGVycm9yXG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdDxleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZUVkaXREdG8+KGVycik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZVJlbmFtZUxvY2F0aW9uKHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8KGxhbmd1YWdlcy5SZW5hbWVMb2NhdGlvbiAmIGxhbmd1YWdlcy5SZWplY3Rpb24pIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9wcm92aWRlci5wcmVwYXJlUmVuYW1lICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHVuZGVmaW5lZCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCBwb3MgPSB0eXBlQ29udmVydC5Qb3NpdGlvbi50byhwb3NpdGlvbik7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgcmFuZ2VPckxvY2F0aW9uID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJlcGFyZVJlbmFtZShkb2MsIHBvcywgdG9rZW4pO1xuXG5cdFx0XHRsZXQgcmFuZ2U6IHZzY29kZS5SYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRcdGxldCB0ZXh0OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAoUmFuZ2UuaXNSYW5nZShyYW5nZU9yTG9jYXRpb24pKSB7XG5cdFx0XHRcdHJhbmdlID0gcmFuZ2VPckxvY2F0aW9uO1xuXHRcdFx0XHR0ZXh0ID0gZG9jLmdldFRleHQocmFuZ2VPckxvY2F0aW9uKTtcblxuXHRcdFx0fSBlbHNlIGlmIChpc09iamVjdChyYW5nZU9yTG9jYXRpb24pKSB7XG5cdFx0XHRcdHJhbmdlID0gcmFuZ2VPckxvY2F0aW9uLnJhbmdlO1xuXHRcdFx0XHR0ZXh0ID0gcmFuZ2VPckxvY2F0aW9uLnBsYWNlaG9sZGVyO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIXJhbmdlIHx8ICF0ZXh0KSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRpZiAocmFuZ2Uuc3RhcnQubGluZSA+IHBvcy5saW5lIHx8IHJhbmdlLmVuZC5saW5lIDwgcG9zLmxpbmUpIHtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS53YXJuKCdJTlZBTElEIHJlbmFtZSBsb2NhdGlvbjogcG9zaXRpb24gbGluZSBtdXN0IGJlIHdpdGhpbiByYW5nZSBzdGFydC9lbmQgbGluZXMnKTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7IHJhbmdlOiB0eXBlQ29udmVydC5SYW5nZS5mcm9tKHJhbmdlKSwgdGV4dCB9O1xuXG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zdCByZWplY3RSZWFzb24gPSBSZW5hbWVBZGFwdGVyLl9hc01lc3NhZ2UoZXJyKTtcblx0XHRcdGlmIChyZWplY3RSZWFzb24pIHtcblx0XHRcdFx0cmV0dXJuIHsgcmVqZWN0UmVhc29uLCByYW5nZTogdW5kZWZpbmVkISwgdGV4dDogdW5kZWZpbmVkISB9O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0PGFueT4oZXJyKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfYXNNZXNzYWdlKGVycjogYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIGVyciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBlcnI7XG5cdFx0fSBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiB0eXBlb2YgZXJyLm1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gZXJyLm1lc3NhZ2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIE5ld1N5bWJvbE5hbWVzQWRhcHRlciB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgbGFuZ3VhZ2VUcmlnZ2VyS2luZFRvVlNDb2RlVHJpZ2dlcktpbmQ6IFJlY29yZDxsYW5ndWFnZXMuTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLCB2c2NvZGUuTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kPiA9IHtcblx0XHRbbGFuZ3VhZ2VzLk5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZC5JbnZva2VdOiBOZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQuSW52b2tlLFxuXHRcdFtsYW5ndWFnZXMuTmV3U3ltYm9sTmFtZVRyaWdnZXJLaW5kLkF1dG9tYXRpY106IE5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZC5BdXRvbWF0aWMsXG5cdH07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuTmV3U3ltYm9sTmFtZXNQcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHsgfVxuXG5cdGFzeW5jIHN1cHBvcnRzQXV0b21hdGljTmV3U3ltYm9sTmFtZXNUcmlnZ2VyS2luZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvdmlkZXIuc3VwcG9ydHNBdXRvbWF0aWNUcmlnZ2VyS2luZDtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVOZXdTeW1ib2xOYW1lcyhyZXNvdXJjZTogVVJJLCByYW5nZTogSVJhbmdlLCB0cmlnZ2VyS2luZDogbGFuZ3VhZ2VzLk5ld1N5bWJvbE5hbWVUcmlnZ2VyS2luZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTmV3U3ltYm9sTmFtZVtdIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlJhbmdlLnRvKHJhbmdlKTtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBraW5kID0gTmV3U3ltYm9sTmFtZXNBZGFwdGVyLmxhbmd1YWdlVHJpZ2dlcktpbmRUb1ZTQ29kZVRyaWdnZXJLaW5kW3RyaWdnZXJLaW5kXTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZU5ld1N5bWJvbE5hbWVzKGRvYywgcG9zLCBraW5kLCB0b2tlbik7XG5cdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdmFsdWUubWFwKHYgPT5cblx0XHRcdFx0dHlwZW9mIHYgPT09ICdzdHJpbmcnIC8qIEB1bHVnYmVrbmE6IGZvciBiYWNrd2FyZCBjb21wYXRpYmlsaXR5IGJlY2F1c2UgYHZhbHVlYCB1c2VkIHRvIGJlIGp1c3QgYHN0cmluZ1tdYCAqL1xuXHRcdFx0XHRcdD8geyBuZXdTeW1ib2xOYW1lOiB2IH1cblx0XHRcdFx0XHQ6IHsgbmV3U3ltYm9sTmFtZTogdi5uZXdTeW1ib2xOYW1lLCB0YWdzOiB2LnRhZ3MgfVxuXHRcdFx0KTtcblx0XHR9IGNhdGNoIChlcnI6IHVua25vd24pIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoTmV3U3ltYm9sTmFtZXNBZGFwdGVyLl9hc01lc3NhZ2UoZXJyKSA/PyBKU09OLnN0cmluZ2lmeShlcnIsIG51bGwsICdcXHQnKSAvKiBAdWx1Z2Jla25hOiBhc3N1bWluZyBgZXJyYCBkb2Vzbid0IGhhdmUgY2lyY3VsYXIgcmVmZXJlbmNlcyB0aGF0IGNvdWxkIHJlc3VsdCBpbiBhbiBleGNlcHRpb24gd2hlbiBjb252ZXJ0aW5nIHRvIEpTT04gKi8pO1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHQvLyBAdWx1Z2Jla25hOiB0aGlzIG1ldGhvZCBpcyBhbHNvIGRlZmluZWQgaW4gUmVuYW1lQWRhcHRlciBidXQgc2VlbXMgT0sgdG8gYmUgZHVwbGljYXRlZFxuXHRwcml2YXRlIHN0YXRpYyBfYXNNZXNzYWdlKGVycjogYW55KTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIGVyciA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiBlcnI7XG5cdFx0fSBlbHNlIGlmIChlcnIgaW5zdGFuY2VvZiBFcnJvciAmJiB0eXBlb2YgZXJyLm1lc3NhZ2UgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRyZXR1cm4gZXJyLm1lc3NhZ2U7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIFNlbWFudGljVG9rZW5zUHJldmlvdXNSZXN1bHQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSByZXN1bHRJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdHJlYWRvbmx5IHRva2Vucz86IFVpbnQzMkFycmF5LFxuXHQpIHsgfVxufVxuXG50eXBlIFJlbGF4ZWRTZW1hbnRpY1Rva2VucyA9IHsgcmVhZG9ubHkgcmVzdWx0SWQ/OiBzdHJpbmc7IHJlYWRvbmx5IGRhdGE6IG51bWJlcltdIH07XG50eXBlIFJlbGF4ZWRTZW1hbnRpY1Rva2Vuc0VkaXQgPSB7IHJlYWRvbmx5IHN0YXJ0OiBudW1iZXI7IHJlYWRvbmx5IGRlbGV0ZUNvdW50OiBudW1iZXI7IHJlYWRvbmx5IGRhdGE/OiBudW1iZXJbXSB9O1xudHlwZSBSZWxheGVkU2VtYW50aWNUb2tlbnNFZGl0cyA9IHsgcmVhZG9ubHkgcmVzdWx0SWQ/OiBzdHJpbmc7IHJlYWRvbmx5IGVkaXRzOiBSZWxheGVkU2VtYW50aWNUb2tlbnNFZGl0W10gfTtcblxudHlwZSBQcm92aWRlZFNlbWFudGljVG9rZW5zID0gdnNjb2RlLlNlbWFudGljVG9rZW5zIHwgUmVsYXhlZFNlbWFudGljVG9rZW5zO1xudHlwZSBQcm92aWRlZFNlbWFudGljVG9rZW5zRWRpdHMgPSB2c2NvZGUuU2VtYW50aWNUb2tlbnNFZGl0cyB8IFJlbGF4ZWRTZW1hbnRpY1Rva2Vuc0VkaXRzO1xuXG5jbGFzcyBEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcHJldmlvdXNSZXN1bHRzOiBNYXA8bnVtYmVyLCBTZW1hbnRpY1Rva2Vuc1ByZXZpb3VzUmVzdWx0Pjtcblx0cHJpdmF0ZSBfbmV4dFJlc3VsdElkID0gMTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsXG5cdCkge1xuXHRcdHRoaXMuX3ByZXZpb3VzUmVzdWx0cyA9IG5ldyBNYXA8bnVtYmVyLCBTZW1hbnRpY1Rva2Vuc1ByZXZpb3VzUmVzdWx0PigpO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMocmVzb3VyY2U6IFVSSSwgcHJldmlvdXNSZXN1bHRJZDogbnVtYmVyLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFZTQnVmZmVyIHwgbnVsbD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcHJldmlvdXNSZXN1bHQgPSAocHJldmlvdXNSZXN1bHRJZCAhPT0gMCA/IHRoaXMuX3ByZXZpb3VzUmVzdWx0cy5nZXQocHJldmlvdXNSZXN1bHRJZCkgOiBudWxsKTtcblx0XHRsZXQgdmFsdWUgPSB0eXBlb2YgcHJldmlvdXNSZXN1bHQ/LnJlc3VsdElkID09PSAnc3RyaW5nJyAmJiB0eXBlb2YgdGhpcy5fcHJvdmlkZXIucHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnNFZGl0cyA9PT0gJ2Z1bmN0aW9uJ1xuXHRcdFx0PyBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0VkaXRzKGRvYywgcHJldmlvdXNSZXN1bHQucmVzdWx0SWQsIHRva2VuKVxuXHRcdFx0OiBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2Vucyhkb2MsIHRva2VuKTtcblxuXHRcdGlmIChwcmV2aW91c1Jlc3VsdCkge1xuXHRcdFx0dGhpcy5fcHJldmlvdXNSZXN1bHRzLmRlbGV0ZShwcmV2aW91c1Jlc3VsdElkKTtcblx0XHR9XG5cdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHRcdHZhbHVlID0gRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIuX2ZpeFByb3ZpZGVkU2VtYW50aWNUb2tlbnModmFsdWUpO1xuXHRcdHJldHVybiB0aGlzLl9zZW5kKERvY3VtZW50U2VtYW50aWNUb2tlbnNBZGFwdGVyLl9jb252ZXJ0VG9FZGl0cyhwcmV2aW91c1Jlc3VsdCwgdmFsdWUpLCB2YWx1ZSk7XG5cdH1cblxuXHRhc3luYyByZWxlYXNlRG9jdW1lbnRTZW1hbnRpY0NvbG9yaW5nKHNlbWFudGljQ29sb3JpbmdSZXN1bHRJZDogbnVtYmVyKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fcHJldmlvdXNSZXN1bHRzLmRlbGV0ZShzZW1hbnRpY0NvbG9yaW5nUmVzdWx0SWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2ZpeFByb3ZpZGVkU2VtYW50aWNUb2tlbnModjogUHJvdmlkZWRTZW1hbnRpY1Rva2VucyB8IFByb3ZpZGVkU2VtYW50aWNUb2tlbnNFZGl0cyk6IHZzY29kZS5TZW1hbnRpY1Rva2VucyB8IHZzY29kZS5TZW1hbnRpY1Rva2Vuc0VkaXRzIHtcblx0XHRpZiAoRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIuX2lzU2VtYW50aWNUb2tlbnModikpIHtcblx0XHRcdGlmIChEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlci5faXNDb3JyZWN0U2VtYW50aWNUb2tlbnModikpIHtcblx0XHRcdFx0cmV0dXJuIHY7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IFNlbWFudGljVG9rZW5zKG5ldyBVaW50MzJBcnJheSh2LmRhdGEpLCB2LnJlc3VsdElkKTtcblx0XHR9IGVsc2UgaWYgKERvY3VtZW50U2VtYW50aWNUb2tlbnNBZGFwdGVyLl9pc1NlbWFudGljVG9rZW5zRWRpdHModikpIHtcblx0XHRcdGlmIChEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlci5faXNDb3JyZWN0U2VtYW50aWNUb2tlbnNFZGl0cyh2KSkge1xuXHRcdFx0XHRyZXR1cm4gdjtcblx0XHRcdH1cblx0XHRcdHJldHVybiBuZXcgU2VtYW50aWNUb2tlbnNFZGl0cyh2LmVkaXRzLm1hcChlZGl0ID0+IG5ldyBTZW1hbnRpY1Rva2Vuc0VkaXQoZWRpdC5zdGFydCwgZWRpdC5kZWxldGVDb3VudCwgZWRpdC5kYXRhID8gbmV3IFVpbnQzMkFycmF5KGVkaXQuZGF0YSkgOiBlZGl0LmRhdGEpKSwgdi5yZXN1bHRJZCk7XG5cdFx0fVxuXHRcdHJldHVybiB2O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lzU2VtYW50aWNUb2tlbnModjogUHJvdmlkZWRTZW1hbnRpY1Rva2VucyB8IFByb3ZpZGVkU2VtYW50aWNUb2tlbnNFZGl0cyk6IHYgaXMgUHJvdmlkZWRTZW1hbnRpY1Rva2VucyB7XG5cdFx0cmV0dXJuIHYgJiYgISEoKHYgYXMgUHJvdmlkZWRTZW1hbnRpY1Rva2VucykuZGF0YSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfaXNDb3JyZWN0U2VtYW50aWNUb2tlbnModjogUHJvdmlkZWRTZW1hbnRpY1Rva2Vucyk6IHYgaXMgdnNjb2RlLlNlbWFudGljVG9rZW5zIHtcblx0XHRyZXR1cm4gKHYuZGF0YSBpbnN0YW5jZW9mIFVpbnQzMkFycmF5KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9pc1NlbWFudGljVG9rZW5zRWRpdHModjogUHJvdmlkZWRTZW1hbnRpY1Rva2VucyB8IFByb3ZpZGVkU2VtYW50aWNUb2tlbnNFZGl0cyk6IHYgaXMgUHJvdmlkZWRTZW1hbnRpY1Rva2Vuc0VkaXRzIHtcblx0XHRyZXR1cm4gdiAmJiBBcnJheS5pc0FycmF5KCh2IGFzIFByb3ZpZGVkU2VtYW50aWNUb2tlbnNFZGl0cykuZWRpdHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lzQ29ycmVjdFNlbWFudGljVG9rZW5zRWRpdHModjogUHJvdmlkZWRTZW1hbnRpY1Rva2Vuc0VkaXRzKTogdiBpcyB2c2NvZGUuU2VtYW50aWNUb2tlbnNFZGl0cyB7XG5cdFx0Zm9yIChjb25zdCBlZGl0IG9mIHYuZWRpdHMpIHtcblx0XHRcdGlmICghKGVkaXQuZGF0YSBpbnN0YW5jZW9mIFVpbnQzMkFycmF5KSkge1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2NvbnZlcnRUb0VkaXRzKHByZXZpb3VzUmVzdWx0OiBTZW1hbnRpY1Rva2Vuc1ByZXZpb3VzUmVzdWx0IHwgbnVsbCB8IHVuZGVmaW5lZCwgbmV3UmVzdWx0OiB2c2NvZGUuU2VtYW50aWNUb2tlbnMgfCB2c2NvZGUuU2VtYW50aWNUb2tlbnNFZGl0cyk6IHZzY29kZS5TZW1hbnRpY1Rva2VucyB8IHZzY29kZS5TZW1hbnRpY1Rva2Vuc0VkaXRzIHtcblx0XHRpZiAoIURvY3VtZW50U2VtYW50aWNUb2tlbnNBZGFwdGVyLl9pc1NlbWFudGljVG9rZW5zKG5ld1Jlc3VsdCkpIHtcblx0XHRcdHJldHVybiBuZXdSZXN1bHQ7XG5cdFx0fVxuXHRcdGlmICghcHJldmlvdXNSZXN1bHQgfHwgIXByZXZpb3VzUmVzdWx0LnRva2Vucykge1xuXHRcdFx0cmV0dXJuIG5ld1Jlc3VsdDtcblx0XHR9XG5cdFx0Y29uc3Qgb2xkRGF0YSA9IHByZXZpb3VzUmVzdWx0LnRva2Vucztcblx0XHRjb25zdCBvbGRMZW5ndGggPSBvbGREYXRhLmxlbmd0aDtcblx0XHRjb25zdCBuZXdEYXRhID0gbmV3UmVzdWx0LmRhdGE7XG5cdFx0Y29uc3QgbmV3TGVuZ3RoID0gbmV3RGF0YS5sZW5ndGg7XG5cblx0XHRsZXQgY29tbW9uUHJlZml4TGVuZ3RoID0gMDtcblx0XHRjb25zdCBtYXhDb21tb25QcmVmaXhMZW5ndGggPSBNYXRoLm1pbihvbGRMZW5ndGgsIG5ld0xlbmd0aCk7XG5cdFx0d2hpbGUgKGNvbW1vblByZWZpeExlbmd0aCA8IG1heENvbW1vblByZWZpeExlbmd0aCAmJiBvbGREYXRhW2NvbW1vblByZWZpeExlbmd0aF0gPT09IG5ld0RhdGFbY29tbW9uUHJlZml4TGVuZ3RoXSkge1xuXHRcdFx0Y29tbW9uUHJlZml4TGVuZ3RoKys7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbW1vblByZWZpeExlbmd0aCA9PT0gb2xkTGVuZ3RoICYmIGNvbW1vblByZWZpeExlbmd0aCA9PT0gbmV3TGVuZ3RoKSB7XG5cdFx0XHQvLyBjb21wbGV0ZSBvdmVybGFwIVxuXHRcdFx0cmV0dXJuIG5ldyBTZW1hbnRpY1Rva2Vuc0VkaXRzKFtdLCBuZXdSZXN1bHQucmVzdWx0SWQpO1xuXHRcdH1cblxuXHRcdGxldCBjb21tb25TdWZmaXhMZW5ndGggPSAwO1xuXHRcdGNvbnN0IG1heENvbW1vblN1ZmZpeExlbmd0aCA9IG1heENvbW1vblByZWZpeExlbmd0aCAtIGNvbW1vblByZWZpeExlbmd0aDtcblx0XHR3aGlsZSAoY29tbW9uU3VmZml4TGVuZ3RoIDwgbWF4Q29tbW9uU3VmZml4TGVuZ3RoICYmIG9sZERhdGFbb2xkTGVuZ3RoIC0gY29tbW9uU3VmZml4TGVuZ3RoIC0gMV0gPT09IG5ld0RhdGFbbmV3TGVuZ3RoIC0gY29tbW9uU3VmZml4TGVuZ3RoIC0gMV0pIHtcblx0XHRcdGNvbW1vblN1ZmZpeExlbmd0aCsrO1xuXHRcdH1cblxuXHRcdHJldHVybiBuZXcgU2VtYW50aWNUb2tlbnNFZGl0cyhbe1xuXHRcdFx0c3RhcnQ6IGNvbW1vblByZWZpeExlbmd0aCxcblx0XHRcdGRlbGV0ZUNvdW50OiAob2xkTGVuZ3RoIC0gY29tbW9uUHJlZml4TGVuZ3RoIC0gY29tbW9uU3VmZml4TGVuZ3RoKSxcblx0XHRcdGRhdGE6IG5ld0RhdGEuc3ViYXJyYXkoY29tbW9uUHJlZml4TGVuZ3RoLCBuZXdMZW5ndGggLSBjb21tb25TdWZmaXhMZW5ndGgpXG5cdFx0fV0sIG5ld1Jlc3VsdC5yZXN1bHRJZCk7XG5cdH1cblxuXHRwcml2YXRlIF9zZW5kKHZhbHVlOiB2c2NvZGUuU2VtYW50aWNUb2tlbnMgfCB2c2NvZGUuU2VtYW50aWNUb2tlbnNFZGl0cywgb3JpZ2luYWw6IHZzY29kZS5TZW1hbnRpY1Rva2VucyB8IHZzY29kZS5TZW1hbnRpY1Rva2Vuc0VkaXRzKTogVlNCdWZmZXIgfCBudWxsIHtcblx0XHRpZiAoRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIuX2lzU2VtYW50aWNUb2tlbnModmFsdWUpKSB7XG5cdFx0XHRjb25zdCBteUlkID0gdGhpcy5fbmV4dFJlc3VsdElkKys7XG5cdFx0XHR0aGlzLl9wcmV2aW91c1Jlc3VsdHMuc2V0KG15SWQsIG5ldyBTZW1hbnRpY1Rva2Vuc1ByZXZpb3VzUmVzdWx0KHZhbHVlLnJlc3VsdElkLCB2YWx1ZS5kYXRhKSk7XG5cdFx0XHRyZXR1cm4gZW5jb2RlU2VtYW50aWNUb2tlbnNEdG8oe1xuXHRcdFx0XHRpZDogbXlJZCxcblx0XHRcdFx0dHlwZTogJ2Z1bGwnLFxuXHRcdFx0XHRkYXRhOiB2YWx1ZS5kYXRhXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRpZiAoRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIuX2lzU2VtYW50aWNUb2tlbnNFZGl0cyh2YWx1ZSkpIHtcblx0XHRcdGNvbnN0IG15SWQgPSB0aGlzLl9uZXh0UmVzdWx0SWQrKztcblx0XHRcdGlmIChEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlci5faXNTZW1hbnRpY1Rva2VucyhvcmlnaW5hbCkpIHtcblx0XHRcdFx0Ly8gc3RvcmUgdGhlIG9yaWdpbmFsXG5cdFx0XHRcdHRoaXMuX3ByZXZpb3VzUmVzdWx0cy5zZXQobXlJZCwgbmV3IFNlbWFudGljVG9rZW5zUHJldmlvdXNSZXN1bHQob3JpZ2luYWwucmVzdWx0SWQsIG9yaWdpbmFsLmRhdGEpKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX3ByZXZpb3VzUmVzdWx0cy5zZXQobXlJZCwgbmV3IFNlbWFudGljVG9rZW5zUHJldmlvdXNSZXN1bHQodmFsdWUucmVzdWx0SWQpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBlbmNvZGVTZW1hbnRpY1Rva2Vuc0R0byh7XG5cdFx0XHRcdGlkOiBteUlkLFxuXHRcdFx0XHR0eXBlOiAnZGVsdGEnLFxuXHRcdFx0XHRkZWx0YXM6ICh2YWx1ZS5lZGl0cyB8fCBbXSkubWFwKGVkaXQgPT4gKHsgc3RhcnQ6IGVkaXQuc3RhcnQsIGRlbGV0ZUNvdW50OiBlZGl0LmRlbGV0ZUNvdW50LCBkYXRhOiBlZGl0LmRhdGEgfSkpXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbDtcblx0fVxufVxuXG5jbGFzcyBEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNBZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcixcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zKHJlc291cmNlOiBVUkksIHJhbmdlOiBJUmFuZ2UsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VlNCdWZmZXIgfCBudWxsPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnMoZG9jLCB0eXBlQ29udmVydC5SYW5nZS50byhyYW5nZSksIHRva2VuKTtcblx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gbnVsbDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3NlbmQodmFsdWUpO1xuXHR9XG5cblx0cHJpdmF0ZSBfc2VuZCh2YWx1ZTogdnNjb2RlLlNlbWFudGljVG9rZW5zKTogVlNCdWZmZXIge1xuXHRcdHJldHVybiBlbmNvZGVTZW1hbnRpY1Rva2Vuc0R0byh7XG5cdFx0XHRpZDogMCxcblx0XHRcdHR5cGU6ICdmdWxsJyxcblx0XHRcdGRhdGE6IHZhbHVlLmRhdGFcblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBDb21wbGV0aW9uc0FkYXB0ZXIge1xuXG5cdHN0YXRpYyBzdXBwb3J0c1Jlc29sdmluZyhwcm92aWRlcjogdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdHlwZW9mIHByb3ZpZGVyLnJlc29sdmVDb21wbGV0aW9uSXRlbSA9PT0gJ2Z1bmN0aW9uJztcblx0fVxuXG5cdHByaXZhdGUgX2NhY2hlID0gbmV3IENhY2hlPHZzY29kZS5Db21wbGV0aW9uSXRlbT4oJ0NvbXBsZXRpb25JdGVtJyk7XG5cdHByaXZhdGUgX2Rpc3Bvc2FibGVzID0gbmV3IE1hcDxudW1iZXIsIERpc3Bvc2FibGVTdG9yZT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHM6IENvbW1hbmRzQ29udmVydGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9hcGlEZXByZWNhdGlvbjogSUV4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZUNvbXBsZXRpb25JdGVtcyhyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjb250ZXh0OiBsYW5ndWFnZXMuQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklTdWdnZXN0UmVzdWx0RHRvIHwgdW5kZWZpbmVkPiB7XG5cblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHBvcyA9IHR5cGVDb252ZXJ0LlBvc2l0aW9uLnRvKHBvc2l0aW9uKTtcblxuXHRcdC8vIFRoZSBkZWZhdWx0IGluc2VydC9yZXBsYWNlIHJhbmdlcy4gSXQncyBpbXBvcnRhbnQgdG8gY29tcHV0ZSB0aGVtXG5cdFx0Ly8gYmVmb3JlIGFzeW5jaHJvbm91c2x5IGFza2luZyB0aGUgcHJvdmlkZXIgZm9yIGl0cyByZXN1bHRzLiBTZWVcblx0XHQvLyBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvODM0MDAjaXNzdWVjb21tZW50LTU0Njg1MTQyMVxuXHRcdGNvbnN0IHJlcGxhY2VSYW5nZSA9IGRvYy5nZXRXb3JkUmFuZ2VBdFBvc2l0aW9uKHBvcykgfHwgbmV3IFJhbmdlKHBvcywgcG9zKTtcblx0XHRjb25zdCBpbnNlcnRSYW5nZSA9IHJlcGxhY2VSYW5nZS53aXRoKHsgZW5kOiBwb3MgfSk7XG5cblx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRjb25zdCBpdGVtc09yTGlzdCA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVDb21wbGV0aW9uSXRlbXMoZG9jLCBwb3MsIHRva2VuLCB0eXBlQ29udmVydC5Db21wbGV0aW9uQ29udGV4dC50byhjb250ZXh0KSk7XG5cblx0XHRpZiAoIWl0ZW1zT3JMaXN0KSB7XG5cdFx0XHQvLyB1bmRlZmluZWQgYW5kIG51bGwgYXJlIHZhbGlkIHJlc3VsdHNcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHQvLyBjYW5jZWxsZWQgLT4gcmV0dXJuIHdpdGhvdXQgZnVydGhlciBhZG8sIGVzcCBubyBjYWNoaW5nXG5cdFx0XHQvLyBvZiByZXN1bHRzIGFzIHRoZXkgd2lsbCBsZWFrXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxpc3QgPSBBcnJheS5pc0FycmF5KGl0ZW1zT3JMaXN0KSA/IG5ldyBDb21wbGV0aW9uTGlzdChpdGVtc09yTGlzdCkgOiBpdGVtc09yTGlzdDtcblxuXHRcdC8vIGtlZXAgcmVzdWx0IGZvciBwcm92aWRlcnMgdGhhdCBzdXBwb3J0IHJlc29sdmluZ1xuXHRcdGNvbnN0IHBpZDogbnVtYmVyID0gQ29tcGxldGlvbnNBZGFwdGVyLnN1cHBvcnRzUmVzb2x2aW5nKHRoaXMuX3Byb3ZpZGVyKSA/IHRoaXMuX2NhY2hlLmFkZChsaXN0Lml0ZW1zKSA6IHRoaXMuX2NhY2hlLmFkZChbXSk7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuc2V0KHBpZCwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0Y29uc3QgY29tcGxldGlvbnM6IGV4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9bXSA9IFtdO1xuXHRcdGNvbnN0IHJlc3VsdDogZXh0SG9zdFByb3RvY29sLklTdWdnZXN0UmVzdWx0RHRvID0ge1xuXHRcdFx0eDogcGlkLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdFJlc3VsdER0b0ZpZWxkLmNvbXBsZXRpb25zXTogY29tcGxldGlvbnMsXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0UmVzdWx0RHRvRmllbGQuZGVmYXVsdFJhbmdlc106IHsgcmVwbGFjZTogdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShyZXBsYWNlUmFuZ2UpLCBpbnNlcnQ6IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20oaW5zZXJ0UmFuZ2UpIH0sXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0UmVzdWx0RHRvRmllbGQuaXNJbmNvbXBsZXRlXTogbGlzdC5pc0luY29tcGxldGUgfHwgdW5kZWZpbmVkLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdFJlc3VsdER0b0ZpZWxkLmR1cmF0aW9uXTogc3cuZWxhcHNlZCgpXG5cdFx0fTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgbGlzdC5pdGVtcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaXRlbSA9IGxpc3QuaXRlbXNbaV07XG5cdFx0XHQvLyBjaGVjayBmb3IgYmFkIGNvbXBsZXRpb24gaXRlbSBmaXJzdFxuXHRcdFx0Y29uc3QgZHRvID0gdGhpcy5fY29udmVydENvbXBsZXRpb25JdGVtKGl0ZW0sIFtwaWQsIGldLCBpbnNlcnRSYW5nZSwgcmVwbGFjZVJhbmdlKTtcblx0XHRcdGNvbXBsZXRpb25zLnB1c2goZHRvKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0YXN5bmMgcmVzb2x2ZUNvbXBsZXRpb25JdGVtKGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0byB8IHVuZGVmaW5lZD4ge1xuXG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9wcm92aWRlci5yZXNvbHZlQ29tcGxldGlvbkl0ZW0gIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldCguLi5pZCk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR0bzEgPSB0aGlzLl9jb252ZXJ0Q29tcGxldGlvbkl0ZW0oaXRlbSwgaWQpO1xuXG5cdFx0Y29uc3QgcmVzb2x2ZWRJdGVtID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUNvbXBsZXRpb25JdGVtKGl0ZW0sIHRva2VuKTtcblxuXHRcdGlmICghcmVzb2x2ZWRJdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGR0bzIgPSB0aGlzLl9jb252ZXJ0Q29tcGxldGlvbkl0ZW0ocmVzb2x2ZWRJdGVtLCBpZCk7XG5cblx0XHRpZiAoZHRvMVtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuaW5zZXJ0VGV4dF0gIT09IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmluc2VydFRleHRdXG5cdFx0XHR8fCBkdG8xW2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0UnVsZXNdICE9PSBkdG8yW2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0UnVsZXNdXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9hcGlEZXByZWNhdGlvbi5yZXBvcnQoJ0NvbXBsZXRpb25JdGVtLmluc2VydFRleHQnLCB0aGlzLl9leHRlbnNpb24sICdleHRlbnNpb24gTUFZIE5PVCBjaGFuZ2UgXFwnaW5zZXJ0VGV4dFxcJyBvZiBhIENvbXBsZXRpb25JdGVtIGR1cmluZyByZXNvbHZlJyk7XG5cdFx0fVxuXG5cdFx0aWYgKGR0bzFbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZGVudF0gIT09IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZGVudF1cblx0XHRcdHx8IGR0bzFbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZF0gIT09IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZF1cblx0XHRcdHx8ICFlcXVhbHMoZHRvMVtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuY29tbWFuZEFyZ3VtZW50c10sIGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRBcmd1bWVudHNdKVxuXHRcdCkge1xuXHRcdFx0dGhpcy5fYXBpRGVwcmVjYXRpb24ucmVwb3J0KCdDb21wbGV0aW9uSXRlbS5jb21tYW5kJywgdGhpcy5fZXh0ZW5zaW9uLCAnZXh0ZW5zaW9uIE1BWSBOT1QgY2hhbmdlIFxcJ2NvbW1hbmRcXCcgb2YgYSBDb21wbGV0aW9uSXRlbSBkdXJpbmcgcmVzb2x2ZScpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHQuLi5kdG8xLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5kb2N1bWVudGF0aW9uXTogZHRvMltleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuZG9jdW1lbnRhdGlvbl0sXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmRldGFpbF06IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmRldGFpbF0sXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmFkZGl0aW9uYWxUZXh0RWRpdHNdOiBkdG8yW2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5hZGRpdGlvbmFsVGV4dEVkaXRzXSxcblxuXHRcdFx0Ly8gKGZpc2h5KSBhc3luYyBpbnNlcnRUZXh0XG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmluc2VydFRleHRdOiBkdG8yW2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0XSxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuaW5zZXJ0VGV4dFJ1bGVzXTogZHRvMltleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuaW5zZXJ0VGV4dFJ1bGVzXSxcblxuXHRcdFx0Ly8gKGZpc2h5KSBhc3luYyBjb21tYW5kXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZGVudF06IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZGVudF0sXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZF06IGR0bzJbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZF0sXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRBcmd1bWVudHNdOiBkdG8yW2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21tYW5kQXJndW1lbnRzXSxcblx0XHR9O1xuXHR9XG5cblx0cmVsZWFzZUNvbXBsZXRpb25JdGVtcyhpZDogbnVtYmVyKTogYW55IHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5nZXQoaWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGVsZXRlKGlkKTtcblx0XHR0aGlzLl9jYWNoZS5kZWxldGUoaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udmVydENvbXBsZXRpb25JdGVtKGl0ZW06IHZzY29kZS5Db21wbGV0aW9uSXRlbSwgaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgZGVmYXVsdEluc2VydFJhbmdlPzogdnNjb2RlLlJhbmdlLCBkZWZhdWx0UmVwbGFjZVJhbmdlPzogdnNjb2RlLlJhbmdlKTogZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0byB7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IHRoaXMuX2Rpc3Bvc2FibGVzLmdldChpZFswXSk7XG5cdFx0aWYgKCFkaXNwb3NhYmxlcykge1xuXHRcdFx0dGhyb3cgRXJyb3IoJ0Rpc3Bvc2FibGVTdG9yZSBpcyBtaXNzaW5nLi4uJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29tbWFuZCA9IHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwoaXRlbS5jb21tYW5kLCBkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3QgcmVzdWx0OiBleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvID0ge1xuXHRcdFx0Ly9cblx0XHRcdHg6IGlkLFxuXHRcdFx0Ly9cblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQubGFiZWxdOiBpdGVtLmxhYmVsLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5raW5kXTogaXRlbS5raW5kICE9PSB1bmRlZmluZWQgPyB0eXBlQ29udmVydC5Db21wbGV0aW9uSXRlbUtpbmQuZnJvbShpdGVtLmtpbmQpIDogdW5kZWZpbmVkLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5raW5kTW9kaWZpZXJdOiBpdGVtLnRhZ3MgJiYgaXRlbS50YWdzLm1hcCh0eXBlQ29udmVydC5Db21wbGV0aW9uSXRlbVRhZy5mcm9tKSxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuZGV0YWlsXTogaXRlbS5kZXRhaWwsXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmRvY3VtZW50YXRpb25dOiB0eXBlb2YgaXRlbS5kb2N1bWVudGF0aW9uID09PSAndW5kZWZpbmVkJyA/IHVuZGVmaW5lZCA6IHR5cGVDb252ZXJ0Lk1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QoaXRlbS5kb2N1bWVudGF0aW9uKSxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuc29ydFRleHRdOiBpdGVtLnNvcnRUZXh0ICE9PSBpdGVtLmxhYmVsID8gaXRlbS5zb3J0VGV4dCA6IHVuZGVmaW5lZCxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuZmlsdGVyVGV4dF06IGl0ZW0uZmlsdGVyVGV4dCAhPT0gaXRlbS5sYWJlbCA/IGl0ZW0uZmlsdGVyVGV4dCA6IHVuZGVmaW5lZCxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQucHJlc2VsZWN0XTogaXRlbS5wcmVzZWxlY3QgfHwgdW5kZWZpbmVkLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0UnVsZXNdOiBpdGVtLmtlZXBXaGl0ZXNwYWNlID8gbGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtSW5zZXJ0VGV4dFJ1bGUuS2VlcFdoaXRlc3BhY2UgOiBsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1JbnNlcnRUZXh0UnVsZS5Ob25lLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21taXRDaGFyYWN0ZXJzXTogaXRlbS5jb21taXRDaGFyYWN0ZXJzPy5qb2luKCcnKSxcblx0XHRcdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuYWRkaXRpb25hbFRleHRFZGl0c106IGl0ZW0uYWRkaXRpb25hbFRleHRFZGl0cyAmJiBpdGVtLmFkZGl0aW9uYWxUZXh0RWRpdHMubWFwKHR5cGVDb252ZXJ0LlRleHRFZGl0LmZyb20pLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21tYW5kSWRlbnRdOiBjb21tYW5kPy4kaWRlbnQsXG5cdFx0XHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmNvbW1hbmRJZF06IGNvbW1hbmQ/LmlkLFxuXHRcdFx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5jb21tYW5kQXJndW1lbnRzXTogY29tbWFuZD8uJGlkZW50ID8gdW5kZWZpbmVkIDogY29tbWFuZD8uYXJndW1lbnRzLCAvLyBmaWxsZWQgaW4gb24gbWFpbiBzaWRlIGZyb20gJGlkZW50XG5cdFx0fTtcblxuXHRcdC8vICdpbnNlcnRUZXh0Jy1sb2dpY1xuXHRcdGlmIChpdGVtLnRleHRFZGl0KSB7XG5cdFx0XHR0aGlzLl9hcGlEZXByZWNhdGlvbi5yZXBvcnQoJ0NvbXBsZXRpb25JdGVtLnRleHRFZGl0JywgdGhpcy5fZXh0ZW5zaW9uLCBgVXNlICdDb21wbGV0aW9uSXRlbS5pbnNlcnRUZXh0JyBhbmQgJ0NvbXBsZXRpb25JdGVtLnJhbmdlJyBpbnN0ZWFkLmApO1xuXHRcdFx0cmVzdWx0W2V4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG9GaWVsZC5pbnNlcnRUZXh0XSA9IGl0ZW0udGV4dEVkaXQubmV3VGV4dDtcblxuXHRcdH0gZWxzZSBpZiAodHlwZW9mIGl0ZW0uaW5zZXJ0VGV4dCA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJlc3VsdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuaW5zZXJ0VGV4dF0gPSBpdGVtLmluc2VydFRleHQ7XG5cblx0XHR9IGVsc2UgaWYgKGl0ZW0uaW5zZXJ0VGV4dCBpbnN0YW5jZW9mIFNuaXBwZXRTdHJpbmcpIHtcblx0XHRcdHJlc3VsdFtleHRIb3N0UHJvdG9jb2wuSVN1Z2dlc3REYXRhRHRvRmllbGQuaW5zZXJ0VGV4dF0gPSBpdGVtLmluc2VydFRleHQudmFsdWU7XG5cdFx0XHRyZXN1bHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLmluc2VydFRleHRSdWxlc10hIHw9IGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUluc2VydFRleHRSdWxlLkluc2VydEFzU25pcHBldDtcblx0XHR9XG5cblx0XHQvLyAnb3ZlcndyaXRlW0JlZm9yZXxBZnRlcl0nLWxvZ2ljXG5cdFx0bGV0IHJhbmdlOiB2c2NvZGUuUmFuZ2UgfCB7IGluc2VydGluZzogdnNjb2RlLlJhbmdlOyByZXBsYWNpbmc6IHZzY29kZS5SYW5nZSB9IHwgdW5kZWZpbmVkO1xuXHRcdGlmIChpdGVtLnRleHRFZGl0KSB7XG5cdFx0XHRyYW5nZSA9IGl0ZW0udGV4dEVkaXQucmFuZ2U7XG5cdFx0fSBlbHNlIGlmIChpdGVtLnJhbmdlKSB7XG5cdFx0XHRyYW5nZSA9IGl0ZW0ucmFuZ2U7XG5cdFx0fVxuXG5cdFx0aWYgKFJhbmdlLmlzUmFuZ2UocmFuZ2UpKSB7XG5cdFx0XHQvLyBcIm9sZFwiIHJhbmdlXG5cdFx0XHRyZXN1bHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLnJhbmdlXSA9IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20ocmFuZ2UpO1xuXG5cdFx0fSBlbHNlIGlmIChyYW5nZSAmJiAoIWRlZmF1bHRJbnNlcnRSYW5nZT8uaXNFcXVhbChyYW5nZS5pbnNlcnRpbmcpIHx8ICFkZWZhdWx0UmVwbGFjZVJhbmdlPy5pc0VxdWFsKHJhbmdlLnJlcGxhY2luZykpKSB7XG5cdFx0XHQvLyBPTkxZIHNlbmQgcmFuZ2Ugd2hlbiBpdCdzIGRpZmZlcmVudCBmcm9tIHRoZSBkZWZhdWx0IHJhbmdlcyAoc2FmZSBiYW5kd2lkdGgpXG5cdFx0XHRyZXN1bHRbZXh0SG9zdFByb3RvY29sLklTdWdnZXN0RGF0YUR0b0ZpZWxkLnJhbmdlXSA9IHtcblx0XHRcdFx0aW5zZXJ0OiB0eXBlQ29udmVydC5SYW5nZS5mcm9tKHJhbmdlLmluc2VydGluZyksXG5cdFx0XHRcdHJlcGxhY2U6IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20ocmFuZ2UucmVwbGFjaW5nKVxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbmNsYXNzIElubGluZUNvbXBsZXRpb25BZGFwdGVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVmZXJlbmNlcyA9IG5ldyBSZWZlcmVuY2VNYXA8e1xuXHRcdGRpc3Bvc2UoKTogdm9pZDtcblx0XHRpdGVtczogcmVhZG9ubHkgdnNjb2RlLklubGluZUNvbXBsZXRpb25JdGVtW107XG5cdH0+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaXNBZGRpdGlvbnNQcm9wb3NlZEFwaUVuYWJsZWQgPSBpc1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGlzLl9leHRlbnNpb24sICdpbmxpbmVDb21wbGV0aW9uc0FkZGl0aW9ucycpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLklubGluZUNvbXBsZXRpb25JdGVtUHJvdmlkZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHM6IENvbW1hbmRzQ29udmVydGVyLFxuXHQpIHtcblx0fVxuXG5cdHB1YmxpYyBnZXQgc3VwcG9ydHNIYW5kbGVFdmVudHMoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGlzUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuX2V4dGVuc2lvbiwgJ2lubGluZUNvbXBsZXRpb25zQWRkaXRpb25zJylcblx0XHRcdCYmICh0eXBlb2YgdGhpcy5fcHJvdmlkZXIuaGFuZGxlRGlkU2hvd0NvbXBsZXRpb25JdGVtID09PSAnZnVuY3Rpb24nXG5cdFx0XHRcdHx8IHR5cGVvZiB0aGlzLl9wcm92aWRlci5oYW5kbGVEaWRQYXJ0aWFsbHlBY2NlcHRDb21wbGV0aW9uSXRlbSA9PT0gJ2Z1bmN0aW9uJ1xuXHRcdFx0XHR8fCB0eXBlb2YgdGhpcy5fcHJvdmlkZXIuaGFuZGxlRGlkUmVqZWN0Q29tcGxldGlvbkl0ZW0gPT09ICdmdW5jdGlvbidcblx0XHRcdCk7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGxhbmd1YWdlVHJpZ2dlcktpbmRUb1ZTQ29kZVRyaWdnZXJLaW5kOiBSZWNvcmQ8bGFuZ3VhZ2VzLklubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZCwgSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kPiA9IHtcblx0XHRbbGFuZ3VhZ2VzLklubGluZUNvbXBsZXRpb25UcmlnZ2VyS2luZC5BdXRvbWF0aWNdOiBJbmxpbmVDb21wbGV0aW9uVHJpZ2dlcktpbmQuQXV0b21hdGljLFxuXHRcdFtsYW5ndWFnZXMuSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLkV4cGxpY2l0XTogSW5saW5lQ29tcGxldGlvblRyaWdnZXJLaW5kLkludm9rZSxcblx0fTtcblxuXHRhc3luYyBwcm92aWRlSW5saW5lQ29tcGxldGlvbnMocmVzb3VyY2U6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLklubGluZUNvbXBsZXRpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JZGVudGlmaWFibGVJbmxpbmVDb21wbGV0aW9ucyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUlubGluZUNvbXBsZXRpb25JdGVtcyhkb2MsIHBvcywge1xuXHRcdFx0c2VsZWN0ZWRDb21wbGV0aW9uSW5mbzpcblx0XHRcdFx0Y29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvXG5cdFx0XHRcdFx0PyB7XG5cdFx0XHRcdFx0XHRyYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UudG8oY29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvLnJhbmdlKSxcblx0XHRcdFx0XHRcdHRleHQ6IGNvbnRleHQuc2VsZWN0ZWRTdWdnZXN0aW9uSW5mby50ZXh0XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0dHJpZ2dlcktpbmQ6IHRoaXMubGFuZ3VhZ2VUcmlnZ2VyS2luZFRvVlNDb2RlVHJpZ2dlcktpbmRbY29udGV4dC50cmlnZ2VyS2luZF0sXG5cdFx0XHRyZXF1ZXN0VXVpZDogY29udGV4dC5yZXF1ZXN0VXVpZCxcblx0XHR9LCB0b2tlbik7XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0Ly8gdW5kZWZpbmVkIGFuZCBudWxsIGFyZSB2YWxpZCByZXN1bHRzXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0Ly8gY2FuY2VsbGVkIC0+IHJldHVybiB3aXRob3V0IGZ1cnRoZXIgYWRvLCBlc3Agbm8gY2FjaGluZ1xuXHRcdFx0Ly8gb2YgcmVzdWx0cyBhcyB0aGV5IHdpbGwgbGVha1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBub3JtYWxpemVkUmVzdWx0ID0gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogcmVzdWx0Lml0ZW1zO1xuXHRcdGNvbnN0IGNvbW1hbmRzID0gdGhpcy5faXNBZGRpdGlvbnNQcm9wb3NlZEFwaUVuYWJsZWQgPyBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyBbXSA6IHJlc3VsdC5jb21tYW5kcyB8fCBbXSA6IFtdO1xuXHRcdGNvbnN0IGVuYWJsZUZvcndhcmRTdGFiaWxpdHkgPSB0aGlzLl9pc0FkZGl0aW9uc1Byb3Bvc2VkQXBpRW5hYmxlZCAmJiAhQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0LmVuYWJsZUZvcndhcmRTdGFiaWxpdHkgOiB1bmRlZmluZWQ7XG5cblx0XHRsZXQgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGlkID0gdGhpcy5fcmVmZXJlbmNlcy5jcmVhdGVSZWZlcmVuY2VJZCh7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmU/LmRpc3Bvc2UoKTtcblx0XHRcdH0sXG5cdFx0XHRpdGVtczogbm9ybWFsaXplZFJlc3VsdFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBpZCxcblx0XHRcdGl0ZW1zOiBub3JtYWxpemVkUmVzdWx0Lm1hcDxleHRIb3N0UHJvdG9jb2wuSWRlbnRpZmlhYmxlSW5saW5lQ29tcGxldGlvbj4oKGl0ZW0sIGlkeCkgPT4ge1xuXHRcdFx0XHRsZXQgY29tbWFuZDogbGFuZ3VhZ2VzLkNvbW1hbmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChpdGVtLmNvbW1hbmQpIHtcblx0XHRcdFx0XHRpZiAoIWRpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb21tYW5kID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChpdGVtLmNvbW1hbmQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgYWN0aW9uOiBsYW5ndWFnZXMuQ29tbWFuZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKGl0ZW0uYWN0aW9uKSB7XG5cdFx0XHRcdFx0aWYgKCFkaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YWN0aW9uID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChpdGVtLmFjdGlvbiwgZGlzcG9zYWJsZVN0b3JlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGluc2VydFRleHQgPSBpdGVtLmluc2VydFRleHQ7XG5cdFx0XHRcdHJldHVybiAoe1xuXHRcdFx0XHRcdGluc2VydFRleHQ6IHR5cGVvZiBpbnNlcnRUZXh0ID09PSAnc3RyaW5nJyA/IGluc2VydFRleHQgOiB7IHNuaXBwZXQ6IGluc2VydFRleHQudmFsdWUgfSxcblx0XHRcdFx0XHRmaWx0ZXJUZXh0OiBpdGVtLmZpbHRlclRleHQsXG5cdFx0XHRcdFx0cmFuZ2U6IGl0ZW0ucmFuZ2UgPyB0eXBlQ29udmVydC5SYW5nZS5mcm9tKGl0ZW0ucmFuZ2UpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHNob3dSYW5nZTogKHRoaXMuX2lzQWRkaXRpb25zUHJvcG9zZWRBcGlFbmFibGVkICYmIGl0ZW0uc2hvd1JhbmdlKSA/IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20oaXRlbS5zaG93UmFuZ2UpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGNvbW1hbmQsXG5cdFx0XHRcdFx0YWN0aW9uLFxuXHRcdFx0XHRcdGlkeDogaWR4LFxuXHRcdFx0XHRcdGNvbXBsZXRlQnJhY2tldFBhaXJzOiB0aGlzLl9pc0FkZGl0aW9uc1Byb3Bvc2VkQXBpRW5hYmxlZCA/IGl0ZW0uY29tcGxldGVCcmFja2V0UGFpcnMgOiBmYWxzZSxcblx0XHRcdFx0XHRpc0lubGluZUVkaXQ6IHRoaXMuX2lzQWRkaXRpb25zUHJvcG9zZWRBcGlFbmFibGVkID8gaXRlbS5pc0lubGluZUVkaXQgOiBmYWxzZSxcblx0XHRcdFx0XHRzaG93SW5saW5lRWRpdE1lbnU6IHRoaXMuX2lzQWRkaXRpb25zUHJvcG9zZWRBcGlFbmFibGVkID8gaXRlbS5zaG93SW5saW5lRWRpdE1lbnUgOiBmYWxzZSxcblx0XHRcdFx0XHR3YXJuaW5nOiAoaXRlbS53YXJuaW5nICYmIHRoaXMuX2lzQWRkaXRpb25zUHJvcG9zZWRBcGlFbmFibGVkKSA/IHtcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IHR5cGVDb252ZXJ0Lk1hcmtkb3duU3RyaW5nLmZyb20oaXRlbS53YXJuaW5nLm1lc3NhZ2UpLFxuXHRcdFx0XHRcdFx0aWNvbjogaXRlbS53YXJuaW5nLmljb24gPyB0eXBlQ29udmVydC5JY29uUGF0aC5mcm9tVGhlbWVJY29uKGl0ZW0ud2FybmluZy5pY29uKSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9IDogdW5kZWZpbmVkLFxuXHRcdFx0XHR9KTtcblx0XHRcdH0pLFxuXHRcdFx0Y29tbWFuZHM6IGNvbW1hbmRzLm1hcChjID0+IHtcblx0XHRcdFx0aWYgKCFkaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwoYywgZGlzcG9zYWJsZVN0b3JlKTtcblx0XHRcdH0pLFxuXHRcdFx0c3VwcHJlc3NTdWdnZXN0aW9uczogZmFsc2UsXG5cdFx0XHRlbmFibGVGb3J3YXJkU3RhYmlsaXR5LFxuXHRcdH07XG5cdH1cblxuXHRhc3luYyBwcm92aWRlSW5saW5lRWRpdHNGb3JSYW5nZShyZXNvdXJjZTogVVJJLCByYW5nZTogSVJhbmdlLCBjb250ZXh0OiBsYW5ndWFnZXMuSW5saW5lQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb25zIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl9wcm92aWRlci5wcm92aWRlSW5saW5lRWRpdHNGb3JSYW5nZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhpcy5fZXh0ZW5zaW9uLCAnaW5saW5lQ29tcGxldGlvbnNBZGRpdGlvbnMnKTtcblxuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgciA9IHR5cGVDb252ZXJ0LlJhbmdlLnRvKHJhbmdlKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVJbmxpbmVFZGl0c0ZvclJhbmdlKGRvYywgciwge1xuXHRcdFx0c2VsZWN0ZWRDb21wbGV0aW9uSW5mbzpcblx0XHRcdFx0Y29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvXG5cdFx0XHRcdFx0PyB7XG5cdFx0XHRcdFx0XHRyYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UudG8oY29udGV4dC5zZWxlY3RlZFN1Z2dlc3Rpb25JbmZvLnJhbmdlKSxcblx0XHRcdFx0XHRcdHRleHQ6IGNvbnRleHQuc2VsZWN0ZWRTdWdnZXN0aW9uSW5mby50ZXh0XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkLFxuXHRcdFx0dHJpZ2dlcktpbmQ6IHRoaXMubGFuZ3VhZ2VUcmlnZ2VyS2luZFRvVlNDb2RlVHJpZ2dlcktpbmRbY29udGV4dC50cmlnZ2VyS2luZF0sXG5cdFx0XHR1c2VyUHJvbXB0OiBjb250ZXh0LnVzZXJQcm9tcHQsXG5cdFx0XHRyZXF1ZXN0VXVpZDogY29udGV4dC5yZXF1ZXN0VXVpZCxcblx0XHR9LCB0b2tlbik7XG5cblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0Ly8gdW5kZWZpbmVkIGFuZCBudWxsIGFyZSB2YWxpZCByZXN1bHRzXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0Ly8gY2FuY2VsbGVkIC0+IHJldHVybiB3aXRob3V0IGZ1cnRoZXIgYWRvLCBlc3Agbm8gY2FjaGluZ1xuXHRcdFx0Ly8gb2YgcmVzdWx0cyBhcyB0aGV5IHdpbGwgbGVha1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBub3JtYWxpemVkUmVzdWx0ID0gQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0IDogcmVzdWx0Lml0ZW1zO1xuXHRcdGNvbnN0IGNvbW1hbmRzID0gdGhpcy5faXNBZGRpdGlvbnNQcm9wb3NlZEFwaUVuYWJsZWQgPyBBcnJheS5pc0FycmF5KHJlc3VsdCkgPyBbXSA6IHJlc3VsdC5jb21tYW5kcyB8fCBbXSA6IFtdO1xuXHRcdGNvbnN0IGVuYWJsZUZvcndhcmRTdGFiaWxpdHkgPSB0aGlzLl9pc0FkZGl0aW9uc1Byb3Bvc2VkQXBpRW5hYmxlZCAmJiAhQXJyYXkuaXNBcnJheShyZXN1bHQpID8gcmVzdWx0LmVuYWJsZUZvcndhcmRTdGFiaWxpdHkgOiB1bmRlZmluZWQ7XG5cblx0XHRsZXQgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGlkID0gdGhpcy5fcmVmZXJlbmNlcy5jcmVhdGVSZWZlcmVuY2VJZCh7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmU/LmRpc3Bvc2UoKTtcblx0XHRcdH0sXG5cdFx0XHRpdGVtczogbm9ybWFsaXplZFJlc3VsdFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHBpZCxcblx0XHRcdGl0ZW1zOiBub3JtYWxpemVkUmVzdWx0Lm1hcDxleHRIb3N0UHJvdG9jb2wuSWRlbnRpZmlhYmxlSW5saW5lQ29tcGxldGlvbj4oKGl0ZW0sIGlkeCkgPT4ge1xuXHRcdFx0XHRsZXQgY29tbWFuZDogbGFuZ3VhZ2VzLkNvbW1hbmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChpdGVtLmNvbW1hbmQpIHtcblx0XHRcdFx0XHRpZiAoIWRpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb21tYW5kID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChpdGVtLmNvbW1hbmQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRsZXQgYWN0aW9uOiBsYW5ndWFnZXMuQ29tbWFuZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0aWYgKGl0ZW0uYWN0aW9uKSB7XG5cdFx0XHRcdFx0aWYgKCFkaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRcdFx0XHRcdGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YWN0aW9uID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChpdGVtLmFjdGlvbiwgZGlzcG9zYWJsZVN0b3JlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IGluc2VydFRleHQgPSBpdGVtLmluc2VydFRleHQ7XG5cdFx0XHRcdHJldHVybiAoe1xuXHRcdFx0XHRcdGluc2VydFRleHQ6IHR5cGVvZiBpbnNlcnRUZXh0ID09PSAnc3RyaW5nJyA/IGluc2VydFRleHQgOiB7IHNuaXBwZXQ6IGluc2VydFRleHQudmFsdWUgfSxcblx0XHRcdFx0XHRmaWx0ZXJUZXh0OiBpdGVtLmZpbHRlclRleHQsXG5cdFx0XHRcdFx0cmFuZ2U6IGl0ZW0ucmFuZ2UgPyB0eXBlQ29udmVydC5SYW5nZS5mcm9tKGl0ZW0ucmFuZ2UpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGNvbW1hbmQsXG5cdFx0XHRcdFx0YWN0aW9uLFxuXHRcdFx0XHRcdGlkeDogaWR4LFxuXHRcdFx0XHRcdGNvbXBsZXRlQnJhY2tldFBhaXJzOiB0aGlzLl9pc0FkZGl0aW9uc1Byb3Bvc2VkQXBpRW5hYmxlZCA/IGl0ZW0uY29tcGxldGVCcmFja2V0UGFpcnMgOiBmYWxzZSxcblx0XHRcdFx0fSk7XG5cdFx0XHR9KSxcblx0XHRcdGNvbW1hbmRzOiBjb21tYW5kcy5tYXAoYyA9PiB7XG5cdFx0XHRcdGlmICghZGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiB0aGlzLl9jb21tYW5kcy50b0ludGVybmFsKGMsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0XHR9KSxcblx0XHRcdHN1cHByZXNzU3VnZ2VzdGlvbnM6IGZhbHNlLFxuXHRcdFx0ZW5hYmxlRm9yd2FyZFN0YWJpbGl0eSxcblx0XHR9O1xuXHR9XG5cblx0ZGlzcG9zZUNvbXBsZXRpb25zKHBpZDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX3JlZmVyZW5jZXMuZGlzcG9zZVJlZmVyZW5jZUlkKHBpZCk7XG5cdFx0ZGF0YT8uZGlzcG9zZSgpO1xuXHR9XG5cblx0aGFuZGxlRGlkU2hvd0NvbXBsZXRpb25JdGVtKHBpZDogbnVtYmVyLCBpZHg6IG51bWJlciwgdXBkYXRlZEluc2VydFRleHQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBsZXRpb25JdGVtID0gdGhpcy5fcmVmZXJlbmNlcy5nZXQocGlkKT8uaXRlbXNbaWR4XTtcblx0XHRpZiAoY29tcGxldGlvbkl0ZW0pIHtcblx0XHRcdGlmICh0aGlzLl9wcm92aWRlci5oYW5kbGVEaWRTaG93Q29tcGxldGlvbkl0ZW0gJiYgdGhpcy5faXNBZGRpdGlvbnNQcm9wb3NlZEFwaUVuYWJsZWQpIHtcblx0XHRcdFx0dGhpcy5fcHJvdmlkZXIuaGFuZGxlRGlkU2hvd0NvbXBsZXRpb25JdGVtKGNvbXBsZXRpb25JdGVtLCB1cGRhdGVkSW5zZXJ0VGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlUGFydGlhbEFjY2VwdChwaWQ6IG51bWJlciwgaWR4OiBudW1iZXIsIGFjY2VwdGVkQ2hhcmFjdGVyczogbnVtYmVyLCBpbmZvOiBsYW5ndWFnZXMuUGFydGlhbEFjY2VwdEluZm8pOiB2b2lkIHtcblx0XHRjb25zdCBjb21wbGV0aW9uSXRlbSA9IHRoaXMuX3JlZmVyZW5jZXMuZ2V0KHBpZCk/Lml0ZW1zW2lkeF07XG5cdFx0aWYgKGNvbXBsZXRpb25JdGVtKSB7XG5cdFx0XHRpZiAodGhpcy5fcHJvdmlkZXIuaGFuZGxlRGlkUGFydGlhbGx5QWNjZXB0Q29tcGxldGlvbkl0ZW0gJiYgdGhpcy5faXNBZGRpdGlvbnNQcm9wb3NlZEFwaUVuYWJsZWQpIHtcblx0XHRcdFx0dGhpcy5fcHJvdmlkZXIuaGFuZGxlRGlkUGFydGlhbGx5QWNjZXB0Q29tcGxldGlvbkl0ZW0oY29tcGxldGlvbkl0ZW0sIGFjY2VwdGVkQ2hhcmFjdGVycyk7XG5cdFx0XHRcdHRoaXMuX3Byb3ZpZGVyLmhhbmRsZURpZFBhcnRpYWxseUFjY2VwdENvbXBsZXRpb25JdGVtKGNvbXBsZXRpb25JdGVtLCB0eXBlQ29udmVydC5QYXJ0aWFsQWNjZXB0SW5mby50byhpbmZvKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aGFuZGxlUmVqZWN0aW9uKHBpZDogbnVtYmVyLCBpZHg6IG51bWJlcik6IHZvaWQge1xuXHRcdGNvbnN0IGNvbXBsZXRpb25JdGVtID0gdGhpcy5fcmVmZXJlbmNlcy5nZXQocGlkKT8uaXRlbXNbaWR4XTtcblx0XHRpZiAoY29tcGxldGlvbkl0ZW0pIHtcblx0XHRcdGlmICh0aGlzLl9wcm92aWRlci5oYW5kbGVEaWRSZWplY3RDb21wbGV0aW9uSXRlbSAmJiB0aGlzLl9pc0FkZGl0aW9uc1Byb3Bvc2VkQXBpRW5hYmxlZCkge1xuXHRcdFx0XHR0aGlzLl9wcm92aWRlci5oYW5kbGVEaWRSZWplY3RDb21wbGV0aW9uSXRlbShjb21wbGV0aW9uSXRlbSk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIElubGluZUVkaXRBZGFwdGVyIHtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVmZXJlbmNlcyA9IG5ldyBSZWZlcmVuY2VNYXA8e1xuXHRcdGRpc3Bvc2UoKTogdm9pZDtcblx0XHRpdGVtOiB2c2NvZGUuSW5saW5lRWRpdDtcblx0fT4oKTtcblxuXHRwcml2YXRlIGxhbmd1YWdlVHJpZ2dlcktpbmRUb1ZTQ29kZVRyaWdnZXJLaW5kOiBSZWNvcmQ8bGFuZ3VhZ2VzLklubGluZUVkaXRUcmlnZ2VyS2luZCwgSW5saW5lRWRpdFRyaWdnZXJLaW5kPiA9IHtcblx0XHRbbGFuZ3VhZ2VzLklubGluZUVkaXRUcmlnZ2VyS2luZC5BdXRvbWF0aWNdOiBJbmxpbmVFZGl0VHJpZ2dlcktpbmQuQXV0b21hdGljLFxuXHRcdFtsYW5ndWFnZXMuSW5saW5lRWRpdFRyaWdnZXJLaW5kLkludm9rZV06IElubGluZUVkaXRUcmlnZ2VyS2luZC5JbnZva2UsXG5cdH07XG5cblx0YXN5bmMgcHJvdmlkZUlubGluZUVkaXRzKHVyaTogVVJJLCBjb250ZXh0OiBsYW5ndWFnZXMuSUlubGluZUVkaXRDb250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JZGVudGlmaWFibGVJbmxpbmVFZGl0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHVyaSk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUlubGluZUVkaXQoZG9jLCB7XG5cdFx0XHR0cmlnZ2VyS2luZDogdGhpcy5sYW5ndWFnZVRyaWdnZXJLaW5kVG9WU0NvZGVUcmlnZ2VyS2luZFtjb250ZXh0LnRyaWdnZXJLaW5kXSxcblx0XHRcdHJlcXVlc3RVdWlkOiBjb250ZXh0LnJlcXVlc3RVdWlkLFxuXHRcdH0sIHRva2VuKTtcblxuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHQvLyB1bmRlZmluZWQgYW5kIG51bGwgYXJlIHZhbGlkIHJlc3VsdHNcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHQvLyBjYW5jZWxsZWQgLT4gcmV0dXJuIHdpdGhvdXQgZnVydGhlciBhZG8sIGVzcCBubyBjYWNoaW5nXG5cdFx0XHQvLyBvZiByZXN1bHRzIGFzIHRoZXkgd2lsbCBsZWFrXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRsZXQgZGlzcG9zYWJsZVN0b3JlOiBEaXNwb3NhYmxlU3RvcmUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcGlkID0gdGhpcy5fcmVmZXJlbmNlcy5jcmVhdGVSZWZlcmVuY2VJZCh7XG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmU/LmRpc3Bvc2UoKTtcblx0XHRcdH0sXG5cdFx0XHRpdGVtOiByZXN1bHRcblx0XHR9KTtcblxuXHRcdGxldCBhY2NlcHRDb21tYW5kOiBsYW5ndWFnZXMuQ29tbWFuZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAocmVzdWx0LmFjY2VwdGVkKSB7XG5cdFx0XHRpZiAoIWRpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR9XG5cdFx0XHRhY2NlcHRDb21tYW5kID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChyZXN1bHQuYWNjZXB0ZWQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0fVxuXHRcdGxldCByZWplY3RDb21tYW5kOiBsYW5ndWFnZXMuQ29tbWFuZCB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHRpZiAocmVzdWx0LnJlamVjdGVkKSB7XG5cdFx0XHRpZiAoIWRpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0XHRkaXNwb3NhYmxlU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHR9XG5cdFx0XHRyZWplY3RDb21tYW5kID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChyZXN1bHQucmVqZWN0ZWQsIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0fVxuXG5cdFx0bGV0IHNob3duQ29tbWFuZDogbGFuZ3VhZ2VzLkNvbW1hbmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHJlc3VsdC5zaG93bikge1xuXHRcdFx0aWYgKCFkaXNwb3NhYmxlU3RvcmUpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0fVxuXHRcdFx0c2hvd25Db21tYW5kID0gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChyZXN1bHQuc2hvd24sIGRpc3Bvc2FibGVTdG9yZSk7XG5cdFx0fVxuXG5cdFx0bGV0IGFjdGlvbjogbGFuZ3VhZ2VzLkNvbW1hbmQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHJlc3VsdC5hY3Rpb24pIHtcblx0XHRcdGlmICghZGlzcG9zYWJsZVN0b3JlKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVTdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdH1cblx0XHRcdGFjdGlvbiA9IHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwocmVzdWx0LmFjdGlvbiwgZGlzcG9zYWJsZVN0b3JlKTtcblx0XHR9XG5cblx0XHRpZiAoIWRpc3Bvc2FibGVTdG9yZSkge1xuXHRcdFx0ZGlzcG9zYWJsZVN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdH1cblx0XHRjb25zdCBsYW5nUmVzdWx0OiBleHRIb3N0UHJvdG9jb2wuSWRlbnRpZmlhYmxlSW5saW5lRWRpdCA9IHtcblx0XHRcdHBpZCxcblx0XHRcdHRleHQ6IHJlc3VsdC50ZXh0LFxuXHRcdFx0cmFuZ2U6IHR5cGVDb252ZXJ0LlJhbmdlLmZyb20ocmVzdWx0LnJhbmdlKSxcblx0XHRcdHNob3dSYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShyZXN1bHQuc2hvd1JhbmdlKSxcblx0XHRcdGFjY2VwdGVkOiBhY2NlcHRDb21tYW5kLFxuXHRcdFx0cmVqZWN0ZWQ6IHJlamVjdENvbW1hbmQsXG5cdFx0XHRzaG93bjogc2hvd25Db21tYW5kLFxuXHRcdFx0YWN0aW9uLFxuXHRcdFx0Y29tbWFuZHM6IHJlc3VsdC5jb21tYW5kcz8ubWFwKGMgPT4gdGhpcy5fY29tbWFuZHMudG9JbnRlcm5hbChjLCBkaXNwb3NhYmxlU3RvcmUpKSxcblx0XHR9O1xuXG5cdFx0cmV0dXJuIGxhbmdSZXN1bHQ7XG5cdH1cblxuXHRkaXNwb3NlRWRpdChwaWQ6IG51bWJlcikge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9yZWZlcmVuY2VzLmRpc3Bvc2VSZWZlcmVuY2VJZChwaWQpO1xuXHRcdGRhdGE/LmRpc3Bvc2UoKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5JbmxpbmVFZGl0UHJvdmlkZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHM6IENvbW1hbmRzQ29udmVydGVyLFxuXHQpIHtcblx0fVxufVxuXG5jbGFzcyBSZWZlcmVuY2VNYXA8VD4ge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZWZlcmVuY2VzID0gbmV3IE1hcDxudW1iZXIsIFQ+KCk7XG5cdHByaXZhdGUgX2lkUG9vbCA9IDE7XG5cblx0Y3JlYXRlUmVmZXJlbmNlSWQodmFsdWU6IFQpOiBudW1iZXIge1xuXHRcdGNvbnN0IGlkID0gdGhpcy5faWRQb29sKys7XG5cdFx0dGhpcy5fcmVmZXJlbmNlcy5zZXQoaWQsIHZhbHVlKTtcblx0XHRyZXR1cm4gaWQ7XG5cdH1cblxuXHRkaXNwb3NlUmVmZXJlbmNlSWQocmVmZXJlbmNlSWQ6IG51bWJlcik6IFQgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fcmVmZXJlbmNlcy5nZXQocmVmZXJlbmNlSWQpO1xuXHRcdHRoaXMuX3JlZmVyZW5jZXMuZGVsZXRlKHJlZmVyZW5jZUlkKTtcblx0XHRyZXR1cm4gdmFsdWU7XG5cdH1cblxuXHRnZXQocmVmZXJlbmNlSWQ6IG51bWJlcik6IFQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9yZWZlcmVuY2VzLmdldChyZWZlcmVuY2VJZCk7XG5cdH1cbn1cblxuY2xhc3MgU2lnbmF0dXJlSGVscEFkYXB0ZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IENhY2hlPHZzY29kZS5TaWduYXR1cmVIZWxwPignU2lnbmF0dXJlSGVscCcpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLlNpZ25hdHVyZUhlbHBQcm92aWRlcixcblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlU2lnbmF0dXJlSGVscChyZXNvdXJjZTogVVJJLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjb250ZXh0OiBleHRIb3N0UHJvdG9jb2wuSVNpZ25hdHVyZUhlbHBDb250ZXh0RHRvLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JU2lnbmF0dXJlSGVscER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRvYyA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXHRcdGNvbnN0IHZzY29kZUNvbnRleHQgPSB0aGlzLnJldml2ZUNvbnRleHQoY29udGV4dCk7XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVTaWduYXR1cmVIZWxwKGRvYywgcG9zLCB0b2tlbiwgdnNjb2RlQ29udGV4dCk7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRjb25zdCBpZCA9IHRoaXMuX2NhY2hlLmFkZChbdmFsdWVdKTtcblx0XHRcdHJldHVybiB7IC4uLnR5cGVDb252ZXJ0LlNpZ25hdHVyZUhlbHAuZnJvbSh2YWx1ZSksIGlkIH07XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHJldml2ZUNvbnRleHQoY29udGV4dDogZXh0SG9zdFByb3RvY29sLklTaWduYXR1cmVIZWxwQ29udGV4dER0byk6IHZzY29kZS5TaWduYXR1cmVIZWxwQ29udGV4dCB7XG5cdFx0bGV0IGFjdGl2ZVNpZ25hdHVyZUhlbHA6IHZzY29kZS5TaWduYXR1cmVIZWxwIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdGlmIChjb250ZXh0LmFjdGl2ZVNpZ25hdHVyZUhlbHApIHtcblx0XHRcdGNvbnN0IHJldml2ZWRTaWduYXR1cmVIZWxwID0gdHlwZUNvbnZlcnQuU2lnbmF0dXJlSGVscC50byhjb250ZXh0LmFjdGl2ZVNpZ25hdHVyZUhlbHApO1xuXHRcdFx0Y29uc3Qgc2F2ZWQgPSB0aGlzLl9jYWNoZS5nZXQoY29udGV4dC5hY3RpdmVTaWduYXR1cmVIZWxwLmlkLCAwKTtcblx0XHRcdGlmIChzYXZlZCkge1xuXHRcdFx0XHRhY3RpdmVTaWduYXR1cmVIZWxwID0gc2F2ZWQ7XG5cdFx0XHRcdGFjdGl2ZVNpZ25hdHVyZUhlbHAuYWN0aXZlU2lnbmF0dXJlID0gcmV2aXZlZFNpZ25hdHVyZUhlbHAuYWN0aXZlU2lnbmF0dXJlO1xuXHRcdFx0XHRhY3RpdmVTaWduYXR1cmVIZWxwLmFjdGl2ZVBhcmFtZXRlciA9IHJldml2ZWRTaWduYXR1cmVIZWxwLmFjdGl2ZVBhcmFtZXRlcjtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGFjdGl2ZVNpZ25hdHVyZUhlbHAgPSByZXZpdmVkU2lnbmF0dXJlSGVscDtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHsgLi4uY29udGV4dCwgYWN0aXZlU2lnbmF0dXJlSGVscCB9O1xuXHR9XG5cblx0cmVsZWFzZVNpZ25hdHVyZUhlbHAoaWQ6IG51bWJlcik6IGFueSB7XG5cdFx0dGhpcy5fY2FjaGUuZGVsZXRlKGlkKTtcblx0fVxufVxuXG5jbGFzcyBJbmxheUhpbnRzQWRhcHRlciB7XG5cblx0cHJpdmF0ZSBfY2FjaGUgPSBuZXcgQ2FjaGU8dnNjb2RlLklubGF5SGludD4oJ0lubGF5SGludHMnKTtcblx0cHJpdmF0ZSByZWFkb25seSBfZGlzcG9zYWJsZXMgPSBuZXcgTWFwPG51bWJlciwgRGlzcG9zYWJsZVN0b3JlPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kczogQ29tbWFuZHNDb252ZXJ0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5JbmxheUhpbnRzUHJvdmlkZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb25cblx0KSB7IH1cblxuXHRhc3luYyBwcm92aWRlSW5sYXlIaW50cyhyZXNvdXJjZTogVVJJLCByYW46IElSYW5nZSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUlubGF5SGludHNEdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHJhbmdlID0gdHlwZUNvbnZlcnQuUmFuZ2UudG8ocmFuKTtcblxuXHRcdGNvbnN0IGhpbnRzID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZUlubGF5SGludHMoZG9jLCByYW5nZSwgdG9rZW4pO1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShoaW50cykgfHwgaGludHMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHQvLyBiYWQgcmVzdWx0XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBbSW5sYXlIaW50c10gTk8gaW5sYXkgaGludHMgZnJvbSAnJHt0aGlzLl9leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX0nIGZvciByYW5nZSAke0pTT04uc3RyaW5naWZ5KHJhbil9YCk7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdC8vIGNhbmNlbGxlZCAtPiByZXR1cm4gd2l0aG91dCBmdXJ0aGVyIGFkbywgZXNwIG5vIGNhY2hpbmdcblx0XHRcdC8vIG9mIHJlc3VsdHMgYXMgdGhleSB3aWxsIGxlYWtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHBpZCA9IHRoaXMuX2NhY2hlLmFkZChoaW50cyk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuc2V0KHBpZCwgbmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRjb25zdCByZXN1bHQ6IGV4dEhvc3RQcm90b2NvbC5JSW5sYXlIaW50c0R0byA9IHsgaGludHM6IFtdLCBjYWNoZUlkOiBwaWQgfTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGhpbnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRpZiAodGhpcy5faXNWYWxpZElubGF5SGludChoaW50c1tpXSwgcmFuZ2UpKSB7XG5cdFx0XHRcdHJlc3VsdC5oaW50cy5wdXNoKHRoaXMuX2NvbnZlcnRJbmxheUhpbnQoaGludHNbaV0sIFtwaWQsIGldKSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFtJbmxheUhpbnRzXSAke3Jlc3VsdC5oaW50cy5sZW5ndGh9IGlubGF5IGhpbnRzIGZyb20gJyR7dGhpcy5fZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9JyBmb3IgcmFuZ2UgJHtKU09OLnN0cmluZ2lmeShyYW4pfWApO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlSW5sYXlIaW50KGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikge1xuXHRcdGlmICh0eXBlb2YgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUlubGF5SGludCAhPT0gJ2Z1bmN0aW9uJykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldCguLi5pZCk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBoaW50ID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucmVzb2x2ZUlubGF5SGludChpdGVtLCB0b2tlbik7XG5cdFx0aWYgKCFoaW50KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuX2lzVmFsaWRJbmxheUhpbnQoaGludCkpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9jb252ZXJ0SW5sYXlIaW50KGhpbnQsIGlkKTtcblx0fVxuXG5cdHJlbGVhc2VIaW50cyhpZDogbnVtYmVyKTogYW55IHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5nZXQoaWQpPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fZGlzcG9zYWJsZXMuZGVsZXRlKGlkKTtcblx0XHR0aGlzLl9jYWNoZS5kZWxldGUoaWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNWYWxpZElubGF5SGludChoaW50OiB2c2NvZGUuSW5sYXlIaW50LCByYW5nZT86IHZzY29kZS5SYW5nZSk6IGJvb2xlYW4ge1xuXHRcdGlmIChoaW50LmxhYmVsLmxlbmd0aCA9PT0gMCB8fCBBcnJheS5pc0FycmF5KGhpbnQubGFiZWwpICYmIGhpbnQubGFiZWwuZXZlcnkocGFydCA9PiBwYXJ0LnZhbHVlLmxlbmd0aCA9PT0gMCkpIHtcblx0XHRcdGNvbnNvbGUubG9nKCdJTlZBTElEIGlubGF5IGhpbnQsIGVtcHR5IGxhYmVsJywgaGludCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdGlmIChyYW5nZSAmJiAhcmFuZ2UuY29udGFpbnMoaGludC5wb3NpdGlvbikpIHtcblx0XHRcdC8vIGNvbnNvbGUubG9nKCdJTlZBTElEIGlubGF5IGhpbnQsIHBvc2l0aW9uIG91dHNpZGUgcmFuZ2UnLCByYW5nZSwgaGludCk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udmVydElubGF5SGludChoaW50OiB2c2NvZGUuSW5sYXlIaW50LCBpZDogZXh0SG9zdFByb3RvY29sLkNoYWluZWRDYWNoZUlkKTogZXh0SG9zdFByb3RvY29sLklJbmxheUhpbnREdG8ge1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSB0aGlzLl9kaXNwb3NhYmxlcy5nZXQoaWRbMF0pO1xuXHRcdGlmICghZGlzcG9zYWJsZXMpIHtcblx0XHRcdHRocm93IEVycm9yKCdEaXNwb3NhYmxlU3RvcmUgaXMgbWlzc2luZy4uLicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdDogZXh0SG9zdFByb3RvY29sLklJbmxheUhpbnREdG8gPSB7XG5cdFx0XHRsYWJlbDogJycsIC8vIGZpbGwtaW4gYmVsb3dcblx0XHRcdGNhY2hlSWQ6IGlkLFxuXHRcdFx0dG9vbHRpcDogdHlwZUNvbnZlcnQuTWFya2Rvd25TdHJpbmcuZnJvbVN0cmljdChoaW50LnRvb2x0aXApLFxuXHRcdFx0cG9zaXRpb246IHR5cGVDb252ZXJ0LlBvc2l0aW9uLmZyb20oaGludC5wb3NpdGlvbiksXG5cdFx0XHR0ZXh0RWRpdHM6IGhpbnQudGV4dEVkaXRzICYmIGhpbnQudGV4dEVkaXRzLm1hcCh0eXBlQ29udmVydC5UZXh0RWRpdC5mcm9tKSxcblx0XHRcdGtpbmQ6IGhpbnQua2luZCAmJiB0eXBlQ29udmVydC5JbmxheUhpbnRLaW5kLmZyb20oaGludC5raW5kKSxcblx0XHRcdHBhZGRpbmdMZWZ0OiBoaW50LnBhZGRpbmdMZWZ0LFxuXHRcdFx0cGFkZGluZ1JpZ2h0OiBoaW50LnBhZGRpbmdSaWdodCxcblx0XHR9O1xuXG5cdFx0aWYgKHR5cGVvZiBoaW50LmxhYmVsID09PSAnc3RyaW5nJykge1xuXHRcdFx0cmVzdWx0LmxhYmVsID0gaGludC5sYWJlbDtcblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgcGFydHM6IGxhbmd1YWdlcy5JbmxheUhpbnRMYWJlbFBhcnRbXSA9IFtdO1xuXHRcdFx0cmVzdWx0LmxhYmVsID0gcGFydHM7XG5cblx0XHRcdGZvciAoY29uc3QgcGFydCBvZiBoaW50LmxhYmVsKSB7XG5cdFx0XHRcdGlmICghcGFydC52YWx1ZSkge1xuXHRcdFx0XHRcdGNvbnNvbGUud2FybignSU5WQUxJRCBpbmxheSBoaW50LCBlbXB0eSBsYWJlbCBwYXJ0JywgdGhpcy5fZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWUpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IHBhcnQyOiBsYW5ndWFnZXMuSW5sYXlIaW50TGFiZWxQYXJ0ID0ge1xuXHRcdFx0XHRcdGxhYmVsOiBwYXJ0LnZhbHVlLFxuXHRcdFx0XHRcdHRvb2x0aXA6IHR5cGVDb252ZXJ0Lk1hcmtkb3duU3RyaW5nLmZyb21TdHJpY3QocGFydC50b29sdGlwKVxuXHRcdFx0XHR9O1xuXHRcdFx0XHRpZiAoTG9jYXRpb24uaXNMb2NhdGlvbihwYXJ0LmxvY2F0aW9uKSkge1xuXHRcdFx0XHRcdHBhcnQyLmxvY2F0aW9uID0gdHlwZUNvbnZlcnQubG9jYXRpb24uZnJvbShwYXJ0LmxvY2F0aW9uKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAocGFydC5jb21tYW5kKSB7XG5cdFx0XHRcdFx0cGFydDIuY29tbWFuZCA9IHRoaXMuX2NvbW1hbmRzLnRvSW50ZXJuYWwocGFydC5jb21tYW5kLCBkaXNwb3NhYmxlcyk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cGFydHMucHVzaChwYXJ0Mik7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cbn1cblxuY2xhc3MgTGlua1Byb3ZpZGVyQWRhcHRlciB7XG5cblx0cHJpdmF0ZSBfY2FjaGUgPSBuZXcgQ2FjaGU8dnNjb2RlLkRvY3VtZW50TGluaz4oJ0RvY3VtZW50TGluaycpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm92aWRlcjogdnNjb2RlLkRvY3VtZW50TGlua1Byb3ZpZGVyXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZUxpbmtzKHJlc291cmNlOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklMaW5rc0xpc3REdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXG5cdFx0Y29uc3QgbGlua3MgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRMaW5rcyhkb2MsIHRva2VuKTtcblx0XHRpZiAoIUFycmF5LmlzQXJyYXkobGlua3MpIHx8IGxpbmtzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0Ly8gYmFkIHJlc3VsdFxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHQvLyBjYW5jZWxsZWQgLT4gcmV0dXJuIHdpdGhvdXQgZnVydGhlciBhZG8sIGVzcCBubyBjYWNoaW5nXG5cdFx0XHQvLyBvZiByZXN1bHRzIGFzIHRoZXkgd2lsbCBsZWFrXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIHRoaXMuX3Byb3ZpZGVyLnJlc29sdmVEb2N1bWVudExpbmsgIT09ICdmdW5jdGlvbicpIHtcblx0XHRcdC8vIG5vIHJlc29sdmUgLT4gbm8gY2FjaGluZ1xuXHRcdFx0cmV0dXJuIHsgbGlua3M6IGxpbmtzLmZpbHRlcihMaW5rUHJvdmlkZXJBZGFwdGVyLl92YWxpZGF0ZUxpbmspLm1hcCh0eXBlQ29udmVydC5Eb2N1bWVudExpbmsuZnJvbSkgfTtcblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBjYWNoZSBsaW5rcyBmb3IgZnV0dXJlIHJlc29sdmluZ1xuXHRcdFx0Y29uc3QgcGlkID0gdGhpcy5fY2FjaGUuYWRkKGxpbmtzKTtcblx0XHRcdGNvbnN0IHJlc3VsdDogZXh0SG9zdFByb3RvY29sLklMaW5rc0xpc3REdG8gPSB7IGxpbmtzOiBbXSwgY2FjaGVJZDogcGlkIH07XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmtzLmxlbmd0aDsgaSsrKSB7XG5cblx0XHRcdFx0aWYgKCFMaW5rUHJvdmlkZXJBZGFwdGVyLl92YWxpZGF0ZUxpbmsobGlua3NbaV0pKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkdG86IGV4dEhvc3RQcm90b2NvbC5JTGlua0R0byA9IHR5cGVDb252ZXJ0LkRvY3VtZW50TGluay5mcm9tKGxpbmtzW2ldKTtcblx0XHRcdFx0ZHRvLmNhY2hlSWQgPSBbcGlkLCBpXTtcblx0XHRcdFx0cmVzdWx0LmxpbmtzLnB1c2goZHRvKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3ZhbGlkYXRlTGluayhsaW5rOiB2c2NvZGUuRG9jdW1lbnRMaW5rKTogYm9vbGVhbiB7XG5cdFx0aWYgKGxpbmsudGFyZ2V0ICYmIGxpbmsudGFyZ2V0LnBhdGgubGVuZ3RoID4gNTBfMDAwKSB7XG5cdFx0XHRjb25zb2xlLndhcm4oJ0RST1BQSU5HIGxpbmsgYmVjYXVzZSBpdCBpcyB0b28gbG9uZycpO1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGFzeW5jIHJlc29sdmVMaW5rKGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklMaW5rRHRvIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKHR5cGVvZiB0aGlzLl9wcm92aWRlci5yZXNvbHZlRG9jdW1lbnRMaW5rICE9PSAnZnVuY3Rpb24nKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBpdGVtID0gdGhpcy5fY2FjaGUuZ2V0KC4uLmlkKTtcblx0XHRpZiAoIWl0ZW0pIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IGxpbmsgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5yZXNvbHZlRG9jdW1lbnRMaW5rKGl0ZW0sIHRva2VuKTtcblx0XHRpZiAoIWxpbmsgfHwgIUxpbmtQcm92aWRlckFkYXB0ZXIuX3ZhbGlkYXRlTGluayhsaW5rKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHR5cGVDb252ZXJ0LkRvY3VtZW50TGluay5mcm9tKGxpbmspO1xuXHR9XG5cblx0cmVsZWFzZUxpbmtzKGlkOiBudW1iZXIpOiBhbnkge1xuXHRcdHRoaXMuX2NhY2hlLmRlbGV0ZShpZCk7XG5cdH1cbn1cblxuY2xhc3MgQ29sb3JQcm92aWRlckFkYXB0ZXIge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX2RvY3VtZW50czogRXh0SG9zdERvY3VtZW50cyxcblx0XHRwcml2YXRlIF9wcm92aWRlcjogdnNjb2RlLkRvY3VtZW50Q29sb3JQcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVDb2xvcnMocmVzb3VyY2U6IFVSSSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVJhd0NvbG9ySW5mb1tdPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHJlc291cmNlKTtcblx0XHRjb25zdCBjb2xvcnMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnRDb2xvcnMoZG9jLCB0b2tlbik7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KGNvbG9ycykpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgY29sb3JJbmZvczogZXh0SG9zdFByb3RvY29sLklSYXdDb2xvckluZm9bXSA9IGNvbG9ycy5tYXAoY2kgPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0Y29sb3I6IHR5cGVDb252ZXJ0LkNvbG9yLmZyb20oY2kuY29sb3IpLFxuXHRcdFx0XHRyYW5nZTogdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShjaS5yYW5nZSlcblx0XHRcdH07XG5cdFx0fSk7XG5cdFx0cmV0dXJuIGNvbG9ySW5mb3M7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlQ29sb3JQcmVzZW50YXRpb25zKHJlc291cmNlOiBVUkksIHJhdzogZXh0SG9zdFByb3RvY29sLklSYXdDb2xvckluZm8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLklDb2xvclByZXNlbnRhdGlvbltdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZG9jdW1lbnQgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHJhbmdlID0gdHlwZUNvbnZlcnQuUmFuZ2UudG8ocmF3LnJhbmdlKTtcblx0XHRjb25zdCBjb2xvciA9IHR5cGVDb252ZXJ0LkNvbG9yLnRvKHJhdy5jb2xvcik7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlQ29sb3JQcmVzZW50YXRpb25zKGNvbG9yLCB7IGRvY3VtZW50LCByYW5nZSB9LCB0b2tlbik7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHZhbHVlKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHZhbHVlLm1hcCh0eXBlQ29udmVydC5Db2xvclByZXNlbnRhdGlvbi5mcm9tKTtcblx0fVxufVxuXG5jbGFzcyBGb2xkaW5nUHJvdmlkZXJBZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSBfcHJvdmlkZXI6IHZzY29kZS5Gb2xkaW5nUmFuZ2VQcm92aWRlclxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVGb2xkaW5nUmFuZ2VzKHJlc291cmNlOiBVUkksIGNvbnRleHQ6IGxhbmd1YWdlcy5Gb2xkaW5nQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRm9sZGluZ1JhbmdlW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVzb3VyY2UpO1xuXHRcdGNvbnN0IHJhbmdlcyA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVGb2xkaW5nUmFuZ2VzKGRvYywgY29udGV4dCwgdG9rZW4pO1xuXHRcdGlmICghQXJyYXkuaXNBcnJheShyYW5nZXMpKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gcmFuZ2VzLm1hcCh0eXBlQ29udmVydC5Gb2xkaW5nUmFuZ2UuZnJvbSk7XG5cdH1cbn1cblxuY2xhc3MgU2VsZWN0aW9uUmFuZ2VBZGFwdGVyIHtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5TZWxlY3Rpb25SYW5nZVByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJvdmlkZVNlbGVjdGlvblJhbmdlcyhyZXNvdXJjZTogVVJJLCBwb3M6IElQb3NpdGlvbltdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5TZWxlY3Rpb25SYW5nZVtdW10+IHtcblx0XHRjb25zdCBkb2N1bWVudCA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXNvdXJjZSk7XG5cdFx0Y29uc3QgcG9zaXRpb25zID0gcG9zLm1hcCh0eXBlQ29udmVydC5Qb3NpdGlvbi50byk7XG5cblx0XHRjb25zdCBhbGxQcm92aWRlclJhbmdlcyA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVTZWxlY3Rpb25SYW5nZXMoZG9jdW1lbnQsIHBvc2l0aW9ucywgdG9rZW4pO1xuXHRcdGlmICghaXNOb25FbXB0eUFycmF5KGFsbFByb3ZpZGVyUmFuZ2VzKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRpZiAoYWxsUHJvdmlkZXJSYW5nZXMubGVuZ3RoICE9PSBwb3NpdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLndhcm4oJ0JBRCBzZWxlY3Rpb24gcmFuZ2VzLCBwcm92aWRlciBtdXN0IHJldHVybiByYW5nZXMgZm9yIGVhY2ggcG9zaXRpb24nKTtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0Y29uc3QgYWxsUmVzdWx0czogbGFuZ3VhZ2VzLlNlbGVjdGlvblJhbmdlW11bXSA9IFtdO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgcG9zaXRpb25zLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRjb25zdCBvbmVSZXN1bHQ6IGxhbmd1YWdlcy5TZWxlY3Rpb25SYW5nZVtdID0gW107XG5cdFx0XHRhbGxSZXN1bHRzLnB1c2gob25lUmVzdWx0KTtcblxuXHRcdFx0bGV0IGxhc3Q6IHZzY29kZS5Qb3NpdGlvbiB8IHZzY29kZS5SYW5nZSA9IHBvc2l0aW9uc1tpXTtcblx0XHRcdGxldCBzZWxlY3Rpb25SYW5nZSA9IGFsbFByb3ZpZGVyUmFuZ2VzW2ldO1xuXG5cdFx0XHR3aGlsZSAodHJ1ZSkge1xuXHRcdFx0XHRpZiAoIXNlbGVjdGlvblJhbmdlLnJhbmdlLmNvbnRhaW5zKGxhc3QpKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJTlZBTElEIHNlbGVjdGlvbiByYW5nZSwgbXVzdCBjb250YWluIHRoZSBwcmV2aW91cyByYW5nZScpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdG9uZVJlc3VsdC5wdXNoKHR5cGVDb252ZXJ0LlNlbGVjdGlvblJhbmdlLmZyb20oc2VsZWN0aW9uUmFuZ2UpKTtcblx0XHRcdFx0aWYgKCFzZWxlY3Rpb25SYW5nZS5wYXJlbnQpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0XHRsYXN0ID0gc2VsZWN0aW9uUmFuZ2UucmFuZ2U7XG5cdFx0XHRcdHNlbGVjdGlvblJhbmdlID0gc2VsZWN0aW9uUmFuZ2UucGFyZW50O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gYWxsUmVzdWx0cztcblx0fVxufVxuXG5jbGFzcyBDYWxsSGllcmFyY2h5QWRhcHRlciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaWRQb29sID0gbmV3IElkR2VuZXJhdG9yKCcnKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2FjaGUgPSBuZXcgTWFwPHN0cmluZywgTWFwPHN0cmluZywgdnNjb2RlLkNhbGxIaWVyYXJjaHlJdGVtPj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJvdmlkZXI6IHZzY29kZS5DYWxsSGllcmFyY2h5UHJvdmlkZXJcblx0KSB7IH1cblxuXHRhc3luYyBwcmVwYXJlU2Vzc2lvbih1cmk6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUNhbGxIaWVyYXJjaHlJdGVtRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkb2MgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQodXJpKTtcblx0XHRjb25zdCBwb3MgPSB0eXBlQ29udmVydC5Qb3NpdGlvbi50byhwb3NpdGlvbik7XG5cblx0XHRjb25zdCBpdGVtcyA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByZXBhcmVDYWxsSGllcmFyY2h5KGRvYywgcG9zLCB0b2tlbik7XG5cdFx0aWYgKCFpdGVtcykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBzZXNzaW9uSWQgPSB0aGlzLl9pZFBvb2wubmV4dElkKCk7XG5cdFx0dGhpcy5fY2FjaGUuc2V0KHNlc3Npb25JZCwgbmV3IE1hcCgpKTtcblxuXHRcdGlmIChBcnJheS5pc0FycmF5KGl0ZW1zKSkge1xuXHRcdFx0cmV0dXJuIGl0ZW1zLm1hcChpdGVtID0+IHRoaXMuX2NhY2hlQW5kQ29udmVydEl0ZW0oc2Vzc2lvbklkLCBpdGVtKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBbdGhpcy5fY2FjaGVBbmRDb252ZXJ0SXRlbShzZXNzaW9uSWQsIGl0ZW1zKV07XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgcHJvdmlkZUNhbGxzVG8oc2Vzc2lvbklkOiBzdHJpbmcsIGl0ZW1JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JSW5jb21pbmdDYWxsRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy5faXRlbUZyb21DYWNoZShzZXNzaW9uSWQsIGl0ZW1JZCk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ21pc3NpbmcgY2FsbCBoaWVyYXJjaHkgaXRlbScpO1xuXHRcdH1cblx0XHRjb25zdCBjYWxscyA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxscyhpdGVtLCB0b2tlbik7XG5cdFx0aWYgKCFjYWxscykge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIGNhbGxzLm1hcChjYWxsID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdGZyb206IHRoaXMuX2NhY2hlQW5kQ29udmVydEl0ZW0oc2Vzc2lvbklkLCBjYWxsLmZyb20pLFxuXHRcdFx0XHRmcm9tUmFuZ2VzOiBjYWxsLmZyb21SYW5nZXMubWFwKHIgPT4gdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShyKSlcblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBwcm92aWRlQ2FsbHNGcm9tKHNlc3Npb25JZDogc3RyaW5nLCBpdGVtSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSU91dGdvaW5nQ2FsbER0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2l0ZW1Gcm9tQ2FjaGUoc2Vzc2lvbklkLCBpdGVtSWQpO1xuXHRcdGlmICghaXRlbSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdtaXNzaW5nIGNhbGwgaGllcmFyY2h5IGl0ZW0nKTtcblx0XHR9XG5cdFx0Y29uc3QgY2FsbHMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlQ2FsbEhpZXJhcmNoeU91dGdvaW5nQ2FsbHMoaXRlbSwgdG9rZW4pO1xuXHRcdGlmICghY2FsbHMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBjYWxscy5tYXAoY2FsbCA9PiB7XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHR0bzogdGhpcy5fY2FjaGVBbmRDb252ZXJ0SXRlbShzZXNzaW9uSWQsIGNhbGwudG8pLFxuXHRcdFx0XHRmcm9tUmFuZ2VzOiBjYWxsLmZyb21SYW5nZXMubWFwKHIgPT4gdHlwZUNvbnZlcnQuUmFuZ2UuZnJvbShyKSlcblx0XHRcdH07XG5cdFx0fSk7XG5cdH1cblxuXHRyZWxlYXNlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX2NhY2hlLmRlbGV0ZShzZXNzaW9uSWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY2FjaGVBbmRDb252ZXJ0SXRlbShzZXNzaW9uSWQ6IHN0cmluZywgaXRlbTogdnNjb2RlLkNhbGxIaWVyYXJjaHlJdGVtKTogZXh0SG9zdFByb3RvY29sLklDYWxsSGllcmFyY2h5SXRlbUR0byB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcy5fY2FjaGUuZ2V0KHNlc3Npb25JZCkhO1xuXHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNhbGxIaWVyYXJjaHlJdGVtLmZyb20oaXRlbSwgc2Vzc2lvbklkLCBtYXAuc2l6ZS50b1N0cmluZygzNikpO1xuXHRcdG1hcC5zZXQoZHRvLl9pdGVtSWQsIGl0ZW0pO1xuXHRcdHJldHVybiBkdG87XG5cdH1cblxuXHRwcml2YXRlIF9pdGVtRnJvbUNhY2hlKHNlc3Npb25JZDogc3RyaW5nLCBpdGVtSWQ6IHN0cmluZyk6IHZzY29kZS5DYWxsSGllcmFyY2h5SXRlbSB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbWFwID0gdGhpcy5fY2FjaGUuZ2V0KHNlc3Npb25JZCk7XG5cdFx0cmV0dXJuIG1hcD8uZ2V0KGl0ZW1JZCk7XG5cdH1cbn1cblxuY2xhc3MgVHlwZUhpZXJhcmNoeUFkYXB0ZXIge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lkUG9vbCA9IG5ldyBJZEdlbmVyYXRvcignJyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIHZzY29kZS5UeXBlSGllcmFyY2h5SXRlbT4+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuVHlwZUhpZXJhcmNoeVByb3ZpZGVyXG5cdCkgeyB9XG5cblx0YXN5bmMgcHJlcGFyZVNlc3Npb24odXJpOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklUeXBlSGllcmFyY2h5SXRlbUR0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHVyaSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXG5cdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcmVwYXJlVHlwZUhpZXJhcmNoeShkb2MsIHBvcywgdG9rZW4pO1xuXHRcdGlmICghaXRlbXMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vzc2lvbklkID0gdGhpcy5faWRQb29sLm5leHRJZCgpO1xuXHRcdHRoaXMuX2NhY2hlLnNldChzZXNzaW9uSWQsIG5ldyBNYXAoKSk7XG5cblx0XHRpZiAoQXJyYXkuaXNBcnJheShpdGVtcykpIHtcblx0XHRcdHJldHVybiBpdGVtcy5tYXAoaXRlbSA9PiB0aGlzLl9jYWNoZUFuZENvbnZlcnRJdGVtKHNlc3Npb25JZCwgaXRlbSkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gW3RoaXMuX2NhY2hlQW5kQ29udmVydEl0ZW0oc2Vzc2lvbklkLCBpdGVtcyldO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVTdXBlcnR5cGVzKHNlc3Npb25JZDogc3RyaW5nLCBpdGVtSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVR5cGVIaWVyYXJjaHlJdGVtRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy5faXRlbUZyb21DYWNoZShzZXNzaW9uSWQsIGl0ZW1JZCk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ21pc3NpbmcgdHlwZSBoaWVyYXJjaHkgaXRlbScpO1xuXHRcdH1cblx0XHRjb25zdCBzdXBlcnR5cGVzID0gYXdhaXQgdGhpcy5fcHJvdmlkZXIucHJvdmlkZVR5cGVIaWVyYXJjaHlTdXBlcnR5cGVzKGl0ZW0sIHRva2VuKTtcblx0XHRpZiAoIXN1cGVydHlwZXMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlcnR5cGVzLm1hcChzdXBlcnR5cGUgPT4ge1xuXHRcdFx0cmV0dXJuIHRoaXMuX2NhY2hlQW5kQ29udmVydEl0ZW0oc2Vzc2lvbklkLCBzdXBlcnR5cGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZVN1YnR5cGVzKHNlc3Npb25JZDogc3RyaW5nLCBpdGVtSWQ6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVR5cGVIaWVyYXJjaHlJdGVtRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBpdGVtID0gdGhpcy5faXRlbUZyb21DYWNoZShzZXNzaW9uSWQsIGl0ZW1JZCk7XG5cdFx0aWYgKCFpdGVtKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ21pc3NpbmcgdHlwZSBoaWVyYXJjaHkgaXRlbScpO1xuXHRcdH1cblx0XHRjb25zdCBzdWJ0eXBlcyA9IGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnByb3ZpZGVUeXBlSGllcmFyY2h5U3VidHlwZXMoaXRlbSwgdG9rZW4pO1xuXHRcdGlmICghc3VidHlwZXMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdHJldHVybiBzdWJ0eXBlcy5tYXAoc3VidHlwZSA9PiB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2FjaGVBbmRDb252ZXJ0SXRlbShzZXNzaW9uSWQsIHN1YnR5cGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cmVsZWFzZVNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9jYWNoZS5kZWxldGUoc2Vzc2lvbklkKTtcblx0fVxuXG5cdHByaXZhdGUgX2NhY2hlQW5kQ29udmVydEl0ZW0oc2Vzc2lvbklkOiBzdHJpbmcsIGl0ZW06IHZzY29kZS5UeXBlSGllcmFyY2h5SXRlbSk6IGV4dEhvc3RQcm90b2NvbC5JVHlwZUhpZXJhcmNoeUl0ZW1EdG8ge1xuXHRcdGNvbnN0IG1hcCA9IHRoaXMuX2NhY2hlLmdldChzZXNzaW9uSWQpITtcblx0XHRjb25zdCBkdG8gPSB0eXBlQ29udmVydC5UeXBlSGllcmFyY2h5SXRlbS5mcm9tKGl0ZW0sIHNlc3Npb25JZCwgbWFwLnNpemUudG9TdHJpbmcoMzYpKTtcblx0XHRtYXAuc2V0KGR0by5faXRlbUlkLCBpdGVtKTtcblx0XHRyZXR1cm4gZHRvO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXRlbUZyb21DYWNoZShzZXNzaW9uSWQ6IHN0cmluZywgaXRlbUlkOiBzdHJpbmcpOiB2c2NvZGUuVHlwZUhpZXJhcmNoeUl0ZW0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG1hcCA9IHRoaXMuX2NhY2hlLmdldChzZXNzaW9uSWQpO1xuXHRcdHJldHVybiBtYXA/LmdldChpdGVtSWQpO1xuXHR9XG59XG5cbmNsYXNzIERvY3VtZW50RHJvcEVkaXRBZGFwdGVyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jYWNoZSA9IG5ldyBDYWNoZTx2c2NvZGUuRG9jdW1lbnREcm9wRWRpdD4oJ0RvY3VtZW50RHJvcEVkaXQnKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogZXh0SG9zdFByb3RvY29sLk1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzU2hhcGUsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2hhbmRsZTogbnVtYmVyLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHQpIHsgfVxuXG5cdGFzeW5jIHByb3ZpZGVEb2N1bWVudE9uRHJvcEVkaXRzKHJlcXVlc3RJZDogbnVtYmVyLCB1cmk6IFVSSSwgcG9zaXRpb246IElQb3NpdGlvbiwgZGF0YVRyYW5zZmVyRHRvOiBleHRIb3N0UHJvdG9jb2wuRGF0YVRyYW5zZmVyRFRPLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JRG9jdW1lbnREcm9wRWRpdER0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgZG9jID0gdGhpcy5fZG9jdW1lbnRzLmdldERvY3VtZW50KHVyaSk7XG5cdFx0Y29uc3QgcG9zID0gdHlwZUNvbnZlcnQuUG9zaXRpb24udG8ocG9zaXRpb24pO1xuXHRcdGNvbnN0IGRhdGFUcmFuc2ZlciA9IHR5cGVDb252ZXJ0LkRhdGFUcmFuc2Zlci50b0RhdGFUcmFuc2ZlcihkYXRhVHJhbnNmZXJEdG8sIGFzeW5jIChpZCkgPT4ge1xuXHRcdFx0cmV0dXJuIChhd2FpdCB0aGlzLl9wcm94eS4kcmVzb2x2ZURvY3VtZW50T25Ecm9wRmlsZURhdGEodGhpcy5faGFuZGxlLCByZXF1ZXN0SWQsIGlkKSkuYnVmZmVyO1xuXHRcdH0pO1xuXG5cdFx0Y29uc3QgZWRpdHMgPSBhd2FpdCB0aGlzLl9wcm92aWRlci5wcm92aWRlRG9jdW1lbnREcm9wRWRpdHMoZG9jLCBwb3MsIGRhdGFUcmFuc2ZlciwgdG9rZW4pO1xuXHRcdGlmICghZWRpdHMpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWRpdHNBcnJheSA9IGFzQXJyYXkoZWRpdHMpO1xuXHRcdGNvbnN0IGNhY2hlSWQgPSB0aGlzLl9jYWNoZS5hZGQoZWRpdHNBcnJheSk7XG5cblx0XHRyZXR1cm4gZWRpdHNBcnJheS5tYXAoKGVkaXQsIGkpOiBleHRIb3N0UHJvdG9jb2wuSURvY3VtZW50RHJvcEVkaXREdG8gPT4gKHtcblx0XHRcdF9jYWNoZUlkOiBbY2FjaGVJZCwgaV0sXG5cdFx0XHR0aXRsZTogZWRpdC50aXRsZSA/PyBsb2NhbGl6ZSgnZGVmYXVsdERyb3BMYWJlbCcsIFwiRHJvcCB1c2luZyAnezB9JyBleHRlbnNpb25cIiwgdGhpcy5fZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IHRoaXMuX2V4dGVuc2lvbi5uYW1lKSxcblx0XHRcdGtpbmQ6IGVkaXQua2luZD8udmFsdWUsXG5cdFx0XHR5aWVsZFRvOiBlZGl0LnlpZWxkVG8/Lm1hcCh4ID0+IHgudmFsdWUpLFxuXHRcdFx0aW5zZXJ0VGV4dDogdHlwZW9mIGVkaXQuaW5zZXJ0VGV4dCA9PT0gJ3N0cmluZycgPyBlZGl0Lmluc2VydFRleHQgOiB7IHNuaXBwZXQ6IGVkaXQuaW5zZXJ0VGV4dC52YWx1ZSB9LFxuXHRcdFx0YWRkaXRpb25hbEVkaXQ6IGVkaXQuYWRkaXRpb25hbEVkaXQgPyB0eXBlQ29udmVydC5Xb3Jrc3BhY2VFZGl0LmZyb20oZWRpdC5hZGRpdGlvbmFsRWRpdCwgdW5kZWZpbmVkKSA6IHVuZGVmaW5lZCxcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyByZXNvbHZlRHJvcEVkaXQoaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGFkZGl0aW9uYWxFZGl0PzogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VFZGl0RHRvIH0+IHtcblx0XHRjb25zdCBbc2Vzc2lvbklkLCBpdGVtSWRdID0gaWQ7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldChzZXNzaW9uSWQsIGl0ZW1JZCk7XG5cdFx0aWYgKCFpdGVtIHx8ICF0aGlzLl9wcm92aWRlci5yZXNvbHZlRG9jdW1lbnREcm9wRWRpdCkge1xuXHRcdFx0cmV0dXJuIHt9OyAvLyB0aGlzIHNob3VsZCBub3QgaGFwcGVuLi4uXG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzb2x2ZWRJdGVtID0gKGF3YWl0IHRoaXMuX3Byb3ZpZGVyLnJlc29sdmVEb2N1bWVudERyb3BFZGl0KGl0ZW0sIHRva2VuKSkgPz8gaXRlbTtcblx0XHRjb25zdCBhZGRpdGlvbmFsRWRpdCA9IHJlc29sdmVkSXRlbS5hZGRpdGlvbmFsRWRpdCA/IHR5cGVDb252ZXJ0LldvcmtzcGFjZUVkaXQuZnJvbShyZXNvbHZlZEl0ZW0uYWRkaXRpb25hbEVkaXQsIHVuZGVmaW5lZCkgOiB1bmRlZmluZWQ7XG5cdFx0cmV0dXJuIHsgYWRkaXRpb25hbEVkaXQgfTtcblx0fVxuXG5cdHJlbGVhc2VEcm9wRWRpdHMoaWQ6IG51bWJlcik6IGFueSB7XG5cdFx0dGhpcy5fY2FjaGUuZGVsZXRlKGlkKTtcblx0fVxufVxuXG50eXBlIEFkYXB0ZXIgPSBEb2N1bWVudFN5bWJvbEFkYXB0ZXIgfCBDb2RlTGVuc0FkYXB0ZXIgfCBEZWZpbml0aW9uQWRhcHRlciB8IEhvdmVyQWRhcHRlclxuXHR8IERvY3VtZW50SGlnaGxpZ2h0QWRhcHRlciB8IE11bHRpRG9jdW1lbnRIaWdobGlnaHRBZGFwdGVyIHwgUmVmZXJlbmNlQWRhcHRlciB8IENvZGVBY3Rpb25BZGFwdGVyXG5cdHwgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlciB8IERvY3VtZW50Rm9ybWF0dGluZ0FkYXB0ZXIgfCBSYW5nZUZvcm1hdHRpbmdBZGFwdGVyXG5cdHwgT25UeXBlRm9ybWF0dGluZ0FkYXB0ZXIgfCBOYXZpZ2F0ZVR5cGVBZGFwdGVyIHwgUmVuYW1lQWRhcHRlclxuXHR8IENvbXBsZXRpb25zQWRhcHRlciB8IFNpZ25hdHVyZUhlbHBBZGFwdGVyIHwgTGlua1Byb3ZpZGVyQWRhcHRlciB8IEltcGxlbWVudGF0aW9uQWRhcHRlclxuXHR8IFR5cGVEZWZpbml0aW9uQWRhcHRlciB8IENvbG9yUHJvdmlkZXJBZGFwdGVyIHwgRm9sZGluZ1Byb3ZpZGVyQWRhcHRlciB8IERlY2xhcmF0aW9uQWRhcHRlclxuXHR8IFNlbGVjdGlvblJhbmdlQWRhcHRlciB8IENhbGxIaWVyYXJjaHlBZGFwdGVyIHwgVHlwZUhpZXJhcmNoeUFkYXB0ZXJcblx0fCBEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlciB8IERvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc0FkYXB0ZXJcblx0fCBFdmFsdWF0YWJsZUV4cHJlc3Npb25BZGFwdGVyIHwgSW5saW5lVmFsdWVzQWRhcHRlclxuXHR8IExpbmtlZEVkaXRpbmdSYW5nZUFkYXB0ZXIgfCBJbmxheUhpbnRzQWRhcHRlciB8IElubGluZUNvbXBsZXRpb25BZGFwdGVyXG5cdHwgRG9jdW1lbnREcm9wRWRpdEFkYXB0ZXIgfCBOZXdTeW1ib2xOYW1lc0FkYXB0ZXIgfCBJbmxpbmVFZGl0QWRhcHRlcjtcblxuY2xhc3MgQWRhcHRlckRhdGEge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBhZGFwdGVyOiBBZGFwdGVyLFxuXHRcdHJlYWRvbmx5IGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcyBpbXBsZW1lbnRzIGV4dEhvc3RQcm90b2NvbC5FeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlc1NoYXBlIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfaGFuZGxlUG9vbDogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogZXh0SG9zdFByb3RvY29sLk1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FkYXB0ZXIgPSBuZXcgTWFwPG51bWJlciwgQWRhcHRlckRhdGE+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWFpbkNvbnRleHQ6IGV4dEhvc3RQcm90b2NvbC5JTWFpbkNvbnRleHQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfdXJpVHJhbnNmb3JtZXI6IElVUklUcmFuc2Zvcm1lcixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kb2N1bWVudHM6IEV4dEhvc3REb2N1bWVudHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfY29tbWFuZHM6IEV4dEhvc3RDb21tYW5kcyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9kaWFnbm9zdGljczogRXh0SG9zdERpYWdub3N0aWNzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2FwaURlcHJlY2F0aW9uOiBJRXh0SG9zdEFwaURlcHJlY2F0aW9uU2VydmljZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25UZWxlbWV0cnk6IElFeHRIb3N0VGVsZW1ldHJ5XG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoZXh0SG9zdFByb3RvY29sLk1haW5Db250ZXh0Lk1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzKTtcblx0fVxuXG5cblx0cHJpdmF0ZSBfdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogQXJyYXk8ZXh0SG9zdFByb3RvY29sLklEb2N1bWVudEZpbHRlckR0bz4ge1xuXHRcdHJldHVybiB0eXBlQ29udmVydC5Eb2N1bWVudFNlbGVjdG9yLmZyb20oc2VsZWN0b3IsIHRoaXMuX3VyaVRyYW5zZm9ybWVyLCBleHRlbnNpb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRlRGlzcG9zYWJsZShoYW5kbGU6IG51bWJlcik6IERpc3Bvc2FibGUge1xuXHRcdHJldHVybiBuZXcgRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9hZGFwdGVyLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXIoaGFuZGxlKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX25leHRIYW5kbGUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX2hhbmRsZVBvb2wrKztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3dpdGhBZGFwdGVyPEEsIFI+KFxuXHRcdGhhbmRsZTogbnVtYmVyLFxuXHRcdGN0b3I6IHsgbmV3KC4uLmFyZ3M6IGFueVtdKTogQSB9LFxuXHRcdGNhbGxiYWNrOiAoYWRhcHRlcjogQSwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pID0+IFByb21pc2U8Uj4sXG5cdFx0ZmFsbGJhY2tWYWx1ZTogUixcblx0XHR0b2tlblRvUmFjZUFnYWluc3Q6IENhbmNlbGxhdGlvblRva2VuIHwgdW5kZWZpbmVkLFxuXHRcdGRvTm90TG9nOiBib29sZWFuID0gZmFsc2Vcblx0KTogUHJvbWlzZTxSPiB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2FkYXB0ZXIuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFkYXRhIHx8ICEoZGF0YS5hZGFwdGVyIGluc3RhbmNlb2YgY3RvcikpIHtcblx0XHRcdHJldHVybiBmYWxsYmFja1ZhbHVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IHQxOiBudW1iZXIgPSBEYXRlLm5vdygpO1xuXHRcdGlmICghZG9Ob3RMb2cpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFske2RhdGEuZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9XSBJTlZPS0UgcHJvdmlkZXIgJyR7Y2FsbGJhY2sudG9TdHJpbmcoKS5yZXBsYWNlKC9bXFxyXFxuXS9nLCAnJyl9J2ApO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGNhbGxiYWNrKGRhdGEuYWRhcHRlciwgZGF0YS5leHRlbnNpb24pO1xuXG5cdFx0Ly8gbG9nZ2luZyx0cmFjaW5nXG5cdFx0UHJvbWlzZS5yZXNvbHZlKHJlc3VsdCkuY2F0Y2goZXJyID0+IHtcblx0XHRcdGlmICghaXNDYW5jZWxsYXRpb25FcnJvcihlcnIpKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoYFske2RhdGEuZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9XSBwcm92aWRlciBGQUlMRURgKTtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihlcnIpO1xuXG5cdFx0XHRcdHRoaXMuX2V4dGVuc2lvblRlbGVtZXRyeS5vbkV4dGVuc2lvbkVycm9yKGRhdGEuZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGVycik7XG5cdFx0XHR9XG5cdFx0fSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHRpZiAoIWRvTm90TG9nKSB7XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFske2RhdGEuZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWV9XSBwcm92aWRlciBET05FIGFmdGVyICR7RGF0ZS5ub3coKSAtIHQxfW1zYCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRpZiAoQ2FuY2VsbGF0aW9uVG9rZW4uaXNDYW5jZWxsYXRpb25Ub2tlbih0b2tlblRvUmFjZUFnYWluc3QpKSB7XG5cdFx0XHRyZXR1cm4gcmFjZUNhbmNlbGxhdGlvbkVycm9yKHJlc3VsdCwgdG9rZW5Ub1JhY2VBZ2FpbnN0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX2FkZE5ld0FkYXB0ZXIoYWRhcHRlcjogQWRhcHRlciwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pOiBudW1iZXIge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX25leHRIYW5kbGUoKTtcblx0XHR0aGlzLl9hZGFwdGVyLnNldChoYW5kbGUsIG5ldyBBZGFwdGVyRGF0YShhZGFwdGVyLCBleHRlbnNpb24pKTtcblx0XHRyZXR1cm4gaGFuZGxlO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2V4dExhYmVsKGV4dDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZXh0LmRpc3BsYXlOYW1lIHx8IGV4dC5uYW1lO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2V4dElkKGV4dDogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gZXh0LmlkZW50aWZpZXIudmFsdWU7XG5cdH1cblxuXHQvLyAtLS0gb3V0bGluZVxuXG5cdHJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50U3ltYm9sUHJvdmlkZXIsIG1ldGFkYXRhPzogdnNjb2RlLkRvY3VtZW50U3ltYm9sUHJvdmlkZXJNZXRhZGF0YSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBEb2N1bWVudFN5bWJvbEFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciksIGV4dGVuc2lvbik7XG5cdFx0Y29uc3QgZGlzcGxheU5hbWUgPSAobWV0YWRhdGEgJiYgbWV0YWRhdGEubGFiZWwpIHx8IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9leHRMYWJlbChleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pLCBkaXNwbGF5TmFtZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRG9jdW1lbnRTeW1ib2xbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIERvY3VtZW50U3ltYm9sQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVEb2N1bWVudFN5bWJvbHMoVVJJLnJldml2ZShyZXNvdXJjZSksIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gY29kZSBsZW5zXG5cblx0cmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuQ29kZUxlbnNQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9uZXh0SGFuZGxlKCk7XG5cdFx0Y29uc3QgZXZlbnRIYW5kbGUgPSB0eXBlb2YgcHJvdmlkZXIub25EaWRDaGFuZ2VDb2RlTGVuc2VzID09PSAnZnVuY3Rpb24nID8gdGhpcy5fbmV4dEhhbmRsZSgpIDogdW5kZWZpbmVkO1xuXG5cdFx0dGhpcy5fYWRhcHRlci5zZXQoaGFuZGxlLCBuZXcgQWRhcHRlckRhdGEobmV3IENvZGVMZW5zQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHRoaXMuX2NvbW1hbmRzLmNvbnZlcnRlciwgcHJvdmlkZXIsIGV4dGVuc2lvbiwgdGhpcy5fZXh0ZW5zaW9uVGVsZW1ldHJ5LCB0aGlzLl9sb2dTZXJ2aWNlKSwgZXh0ZW5zaW9uKSk7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyQ29kZUxlbnNTdXBwb3J0KGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgZXZlbnRIYW5kbGUpO1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cblx0XHRpZiAoZXZlbnRIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gcHJvdmlkZXIub25EaWRDaGFuZ2VDb2RlTGVuc2VzIShfID0+IHRoaXMuX3Byb3h5LiRlbWl0Q29kZUxlbnNFdmVudChldmVudEhhbmRsZSkpO1xuXHRcdFx0cmVzdWx0ID0gRGlzcG9zYWJsZS5mcm9tKHJlc3VsdCwgc3Vic2NyaXB0aW9uKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0JHByb3ZpZGVDb2RlTGVuc2VzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUNvZGVMZW5zTGlzdER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIENvZGVMZW5zQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVDb2RlTGVuc2VzKFVSSS5yZXZpdmUocmVzb3VyY2UpLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4sIHJlc291cmNlLnNjaGVtZSA9PT0gJ291dHB1dCcpO1xuXHR9XG5cblx0JHJlc29sdmVDb2RlTGVucyhoYW5kbGU6IG51bWJlciwgc3ltYm9sOiBleHRIb3N0UHJvdG9jb2wuSUNvZGVMZW5zRHRvLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JQ29kZUxlbnNEdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDb2RlTGVuc0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5yZXNvbHZlQ29kZUxlbnMoc3ltYm9sLCB0b2tlbiksIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0cnVlKTtcblx0fVxuXG5cdCRyZWxlYXNlQ29kZUxlbnNlcyhoYW5kbGU6IG51bWJlciwgY2FjaGVJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDb2RlTGVuc0FkYXB0ZXIsIGFkYXB0ZXIgPT4gUHJvbWlzZS5yZXNvbHZlKGFkYXB0ZXIucmVsZWFzZUNvZGVMZW5zZXMoY2FjaGVJZCkpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdH1cblxuXHQvLyAtLS0gZGVjbGFyYXRpb25cblxuXHRyZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRlZmluaXRpb25Qcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBEZWZpbml0aW9uQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEZWZpbml0aW9uU3VwcG9ydChoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZURlZmluaXRpb24oaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXT4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIERlZmluaXRpb25BZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZURlZmluaXRpb24oVVJJLnJldml2ZShyZXNvdXJjZSksIHBvc2l0aW9uLCB0b2tlbiksIFtdLCB0b2tlbik7XG5cdH1cblxuXHRyZWdpc3RlckRlY2xhcmF0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5EZWNsYXJhdGlvblByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IERlY2xhcmF0aW9uQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEZWNsYXJhdGlvblN1cHBvcnQoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVEZWNsYXJhdGlvbihoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHBvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkxvY2F0aW9uTGlua1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgRGVjbGFyYXRpb25BZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZURlY2xhcmF0aW9uKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBwb3NpdGlvbiwgdG9rZW4pLCBbXSwgdG9rZW4pO1xuXHR9XG5cblx0cmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuSW1wbGVtZW50YXRpb25Qcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBJbXBsZW1lbnRhdGlvbkFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVySW1wbGVtZW50YXRpb25TdXBwb3J0KGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlSW1wbGVtZW50YXRpb24oaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmtbXT4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIEltcGxlbWVudGF0aW9uQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVJbXBsZW1lbnRhdGlvbihVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIHRva2VuKSwgW10sIHRva2VuKTtcblx0fVxuXG5cdHJlZ2lzdGVyVHlwZURlZmluaXRpb25Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlR5cGVEZWZpbml0aW9uUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgVHlwZURlZmluaXRpb25BZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclR5cGVEZWZpbml0aW9uU3VwcG9ydChoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZVR5cGVEZWZpbml0aW9uKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcG9zaXRpb246IElQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTG9jYXRpb25MaW5rW10+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBUeXBlRGVmaW5pdGlvbkFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlVHlwZURlZmluaXRpb24oVVJJLnJldml2ZShyZXNvdXJjZSksIHBvc2l0aW9uLCB0b2tlbiksIFtdLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gZXh0cmEgaW5mb1xuXG5cdHJlZ2lzdGVySG92ZXJQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkhvdmVyUHJvdmlkZXIsIGV4dGVuc2lvbklkPzogRXh0ZW5zaW9uSWRlbnRpZmllcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBIb3ZlckFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVySG92ZXJQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZUhvdmVyKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcG9zaXRpb246IElQb3NpdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLkhvdmVyQ29udGV4dDx7IGlkOiBudW1iZXIgfT4gfCB1bmRlZmluZWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwpOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5Ib3ZlcldpdGhJZCB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIEhvdmVyQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVIb3ZlcihVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZUhvdmVyKGhhbmRsZTogbnVtYmVyLCBpZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBIb3ZlckFkYXB0ZXIsIGFkYXB0ZXIgPT4gUHJvbWlzZS5yZXNvbHZlKGFkYXB0ZXIucmVsZWFzZUhvdmVyKGlkKSksIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdC8vIC0tLSBkZWJ1ZyBob3ZlclxuXG5cdHJlZ2lzdGVyRXZhbHVhdGFibGVFeHByZXNzaW9uUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5FdmFsdWF0YWJsZUV4cHJlc3Npb25Qcm92aWRlciwgZXh0ZW5zaW9uSWQ/OiBFeHRlbnNpb25JZGVudGlmaWVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IEV2YWx1YXRhYmxlRXhwcmVzc2lvbkFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyRXZhbHVhdGFibGVFeHByZXNzaW9uUHJvdmlkZXIoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVFdmFsdWF0YWJsZUV4cHJlc3Npb24oaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5FdmFsdWF0YWJsZUV4cHJlc3Npb24gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBFdmFsdWF0YWJsZUV4cHJlc3Npb25BZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZUV2YWx1YXRhYmxlRXhwcmVzc2lvbihVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gZGVidWcgaW5saW5lIHZhbHVlc1xuXG5cdHJlZ2lzdGVySW5saW5lVmFsdWVzUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5JbmxpbmVWYWx1ZXNQcm92aWRlciwgZXh0ZW5zaW9uSWQ/OiBFeHRlbnNpb25JZGVudGlmaWVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXG5cdFx0Y29uc3QgZXZlbnRIYW5kbGUgPSB0eXBlb2YgcHJvdmlkZXIub25EaWRDaGFuZ2VJbmxpbmVWYWx1ZXMgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9uZXh0SGFuZGxlKCkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgSW5saW5lVmFsdWVzQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblxuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlcklubGluZVZhbHVlc1Byb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgZXZlbnRIYW5kbGUpO1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cblx0XHRpZiAoZXZlbnRIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3Qgc3Vic2NyaXB0aW9uID0gcHJvdmlkZXIub25EaWRDaGFuZ2VJbmxpbmVWYWx1ZXMhKF8gPT4gdGhpcy5fcHJveHkuJGVtaXRJbmxpbmVWYWx1ZXNFdmVudChldmVudEhhbmRsZSkpO1xuXHRcdFx0cmVzdWx0ID0gRGlzcG9zYWJsZS5mcm9tKHJlc3VsdCwgc3Vic2NyaXB0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdCRwcm92aWRlSW5saW5lVmFsdWVzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2U6IElSYW5nZSwgY29udGV4dDogZXh0SG9zdFByb3RvY29sLklJbmxpbmVWYWx1ZUNvbnRleHREdG8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLklubGluZVZhbHVlW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBJbmxpbmVWYWx1ZXNBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZUlubGluZVZhbHVlcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2UsIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gb2NjdXJyZW5jZXNcblxuXHRyZWdpc3RlckRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IERvY3VtZW50SGlnaGxpZ2h0QWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdHJlZ2lzdGVyTXVsdGlEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuTXVsdGlEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IE11bHRpRG9jdW1lbnRIaWdobGlnaHRBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIsIHRoaXMuX2xvZ1NlcnZpY2UpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3Rlck11bHRpRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHBvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLkRvY3VtZW50SGlnaGxpZ2h0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudEhpZ2hsaWdodEFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlRG9jdW1lbnRIaWdobGlnaHRzKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBwb3NpdGlvbiwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRwcm92aWRlTXVsdGlEb2N1bWVudEhpZ2hsaWdodHMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBvdGhlck1vZGVsczogVXJpQ29tcG9uZW50c1tdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5NdWx0aURvY3VtZW50SGlnaGxpZ2h0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBNdWx0aURvY3VtZW50SGlnaGxpZ2h0QWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVNdWx0aURvY3VtZW50SGlnaGxpZ2h0cyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIG90aGVyTW9kZWxzLm1hcChtb2RlbCA9PiBVUkkucmV2aXZlKG1vZGVsKSksIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gbGlua2VkIGVkaXRpbmdcblxuXHRyZWdpc3RlckxpbmtlZEVkaXRpbmdSYW5nZVByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuTGlua2VkRWRpdGluZ1JhbmdlUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgTGlua2VkRWRpdGluZ1JhbmdlQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJMaW5rZWRFZGl0aW5nUmFuZ2VQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZUxpbmtlZEVkaXRpbmdSYW5nZXMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JTGlua2VkRWRpdGluZ1Jhbmdlc0R0byB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIExpbmtlZEVkaXRpbmdSYW5nZUFkYXB0ZXIsIGFzeW5jIGFkYXB0ZXIgPT4ge1xuXHRcdFx0Y29uc3QgcmVzID0gYXdhaXQgYWRhcHRlci5wcm92aWRlTGlua2VkRWRpdGluZ1JhbmdlcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIHRva2VuKTtcblx0XHRcdGlmIChyZXMpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZXM6IHJlcy5yYW5nZXMsXG5cdFx0XHRcdFx0d29yZFBhdHRlcm46IHJlcy53b3JkUGF0dGVybiA/IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVSZWdFeHAocmVzLndvcmRQYXR0ZXJuKSA6IHVuZGVmaW5lZFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9LCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdC8vIC0tLSByZWZlcmVuY2VzXG5cblx0cmVnaXN0ZXJSZWZlcmVuY2VQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlJlZmVyZW5jZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IFJlZmVyZW5jZUFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyUmVmZXJlbmNlU3VwcG9ydChoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZVJlZmVyZW5jZXMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjb250ZXh0OiBsYW5ndWFnZXMuUmVmZXJlbmNlQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuTG9jYXRpb25bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIFJlZmVyZW5jZUFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlUmVmZXJlbmNlcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gY29kZSBhY3Rpb25zXG5cblx0cmVnaXN0ZXJDb2RlQWN0aW9uUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Db2RlQWN0aW9uUHJvdmlkZXIsIG1ldGFkYXRhPzogdnNjb2RlLkNvZGVBY3Rpb25Qcm92aWRlck1ldGFkYXRhKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IENvZGVBY3Rpb25BZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgdGhpcy5fY29tbWFuZHMuY29udmVydGVyLCB0aGlzLl9kaWFnbm9zdGljcywgcHJvdmlkZXIsIHRoaXMuX2xvZ1NlcnZpY2UsIGV4dGVuc2lvbiwgdGhpcy5fYXBpRGVwcmVjYXRpb24pLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckNvZGVBY3Rpb25TdXBwb3J0KGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwge1xuXHRcdFx0cHJvdmlkZWRLaW5kczogbWV0YWRhdGE/LnByb3ZpZGVkQ29kZUFjdGlvbktpbmRzPy5tYXAoa2luZCA9PiBraW5kLnZhbHVlKSxcblx0XHRcdGRvY3VtZW50YXRpb246IG1ldGFkYXRhPy5kb2N1bWVudGF0aW9uPy5tYXAoeCA9PiAoe1xuXHRcdFx0XHRraW5kOiB4LmtpbmQudmFsdWUsXG5cdFx0XHRcdGNvbW1hbmQ6IHRoaXMuX2NvbW1hbmRzLmNvbnZlcnRlci50b0ludGVybmFsKHguY29tbWFuZCwgc3RvcmUpLFxuXHRcdFx0fSkpXG5cdFx0fSwgRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX2V4dExhYmVsKGV4dGVuc2lvbiksIEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9leHRJZChleHRlbnNpb24pLCBCb29sZWFuKHByb3ZpZGVyLnJlc29sdmVDb2RlQWN0aW9uKSk7XG5cdFx0c3RvcmUuYWRkKHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKSk7XG5cdFx0cmV0dXJuIHN0b3JlO1xuXHR9XG5cblxuXHQkcHJvdmlkZUNvZGVBY3Rpb25zKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2VPclNlbGVjdGlvbjogSVJhbmdlIHwgSVNlbGVjdGlvbiwgY29udGV4dDogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25Db250ZXh0LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JQ29kZUFjdGlvbkxpc3REdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDb2RlQWN0aW9uQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVDb2RlQWN0aW9ucyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2VPclNlbGVjdGlvbiwgY29udGV4dCwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRyZXNvbHZlQ29kZUFjdGlvbihoYW5kbGU6IG51bWJlciwgaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGVkaXQ/OiBleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZUVkaXREdG87IGNvbW1hbmQ/OiBleHRIb3N0UHJvdG9jb2wuSUNvbW1hbmREdG8gfT4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIENvZGVBY3Rpb25BZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVzb2x2ZUNvZGVBY3Rpb24oaWQsIHRva2VuKSwge30sIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQkcmVsZWFzZUNvZGVBY3Rpb25zKGhhbmRsZTogbnVtYmVyLCBjYWNoZUlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIENvZGVBY3Rpb25BZGFwdGVyLCBhZGFwdGVyID0+IFByb21pc2UucmVzb2x2ZShhZGFwdGVyLnJlbGVhc2VDb2RlQWN0aW9ucyhjYWNoZUlkKSksIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdC8vIC0tLSBmb3JtYXR0aW5nXG5cblx0cmVnaXN0ZXJEb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgRG9jdW1lbnRGb3JtYXR0aW5nQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEb2N1bWVudEZvcm1hdHRpbmdTdXBwb3J0KGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGV4dGVuc2lvbi5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24ubmFtZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlRG9jdW1lbnRGb3JtYXR0aW5nRWRpdHMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBvcHRpb25zOiBsYW5ndWFnZXMuRm9ybWF0dGluZ09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlRleHRFZGl0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudEZvcm1hdHRpbmdBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBvcHRpb25zLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0cmVnaXN0ZXJEb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGNhbkZvcm1hdE11bHRpcGxlUmFuZ2VzID0gdHlwZW9mIHByb3ZpZGVyLnByb3ZpZGVEb2N1bWVudFJhbmdlc0Zvcm1hdHRpbmdFZGl0cyA9PT0gJ2Z1bmN0aW9uJztcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBSYW5nZUZvcm1hdHRpbmdBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclJhbmdlRm9ybWF0dGluZ1N1cHBvcnQoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pLCBleHRlbnNpb24uaWRlbnRpZmllciwgZXh0ZW5zaW9uLmRpc3BsYXlOYW1lIHx8IGV4dGVuc2lvbi5uYW1lLCBjYW5Gb3JtYXRNdWx0aXBsZVJhbmdlcyk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0cyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHJhbmdlOiBJUmFuZ2UsIG9wdGlvbnM6IGxhbmd1YWdlcy5Gb3JtYXR0aW5nT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIFJhbmdlRm9ybWF0dGluZ0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0cyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2UsIG9wdGlvbnMsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcHJvdmlkZURvY3VtZW50UmFuZ2VzRm9ybWF0dGluZ0VkaXRzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2VzOiBJUmFuZ2VbXSwgb3B0aW9uczogbGFuZ3VhZ2VzLkZvcm1hdHRpbmdPcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGxhbmd1YWdlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgUmFuZ2VGb3JtYXR0aW5nQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVEb2N1bWVudFJhbmdlc0Zvcm1hdHRpbmdFZGl0cyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2VzLCBvcHRpb25zLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0cmVnaXN0ZXJPblR5cGVGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuT25UeXBlRm9ybWF0dGluZ0VkaXRQcm92aWRlciwgdHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IE9uVHlwZUZvcm1hdHRpbmdBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3Rlck9uVHlwZUZvcm1hdHRpbmdTdXBwb3J0KGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgdHJpZ2dlckNoYXJhY3RlcnMsIGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVPblR5cGVGb3JtYXR0aW5nRWRpdHMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjaDogc3RyaW5nLCBvcHRpb25zOiBsYW5ndWFnZXMuRm9ybWF0dGluZ09wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlRleHRFZGl0W10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBPblR5cGVGb3JtYXR0aW5nQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVPblR5cGVGb3JtYXR0aW5nRWRpdHMoVVJJLnJldml2ZShyZXNvdXJjZSksIHBvc2l0aW9uLCBjaCwgb3B0aW9ucywgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdC8vIC0tLSBuYXZpZ2F0ZSB0eXBlc1xuXG5cdHJlZ2lzdGVyV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHByb3ZpZGVyOiB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgTmF2aWdhdGVUeXBlQWRhcHRlcihwcm92aWRlciwgdGhpcy5fbG9nU2VydmljZSksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyTmF2aWdhdGVUeXBlU3VwcG9ydChoYW5kbGUsIHR5cGVvZiBwcm92aWRlci5yZXNvbHZlV29ya3NwYWNlU3ltYm9sID09PSAnZnVuY3Rpb24nKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVXb3Jrc3BhY2VTeW1ib2xzKGhhbmRsZTogbnVtYmVyLCBzZWFyY2g6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZVN5bWJvbHNEdG8+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBOYXZpZ2F0ZVR5cGVBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoc2VhcmNoLCB0b2tlbiksIHsgc3ltYm9sczogW10gfSwgdG9rZW4pO1xuXHR9XG5cblx0JHJlc29sdmVXb3Jrc3BhY2VTeW1ib2woaGFuZGxlOiBudW1iZXIsIHN5bWJvbDogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VTeW1ib2xEdG8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VTeW1ib2xEdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBOYXZpZ2F0ZVR5cGVBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVzb2x2ZVdvcmtzcGFjZVN5bWJvbChzeW1ib2wsIHRva2VuKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0JHJlbGVhc2VXb3Jrc3BhY2VTeW1ib2xzKGhhbmRsZTogbnVtYmVyLCBpZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBOYXZpZ2F0ZVR5cGVBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVsZWFzZVdvcmtzcGFjZVN5bWJvbHMoaWQpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQvLyAtLS0gcmVuYW1lXG5cblx0cmVnaXN0ZXJSZW5hbWVQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLlJlbmFtZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IFJlbmFtZUFkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCBwcm92aWRlciwgdGhpcy5fbG9nU2VydmljZSksIGV4dGVuc2lvbik7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyUmVuYW1lU3VwcG9ydChoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksIFJlbmFtZUFkYXB0ZXIuc3VwcG9ydHNSZXNvbHZpbmcocHJvdmlkZXIpKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVSZW5hbWVFZGl0cyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHBvc2l0aW9uOiBJUG9zaXRpb24sIG5ld05hbWU6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVdvcmtzcGFjZUVkaXREdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBSZW5hbWVBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZVJlbmFtZUVkaXRzKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBwb3NpdGlvbiwgbmV3TmFtZSwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRyZXNvbHZlUmVuYW1lTG9jYXRpb24oaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVUkksIHBvc2l0aW9uOiBJUG9zaXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLlJlbmFtZUxvY2F0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgUmVuYW1lQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnJlc29sdmVSZW5hbWVMb2NhdGlvbihVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHRyZWdpc3Rlck5ld1N5bWJvbE5hbWVzUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5OZXdTeW1ib2xOYW1lc1Byb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IE5ld1N5bWJvbE5hbWVzQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyLCB0aGlzLl9sb2dTZXJ2aWNlKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJOZXdTeW1ib2xOYW1lc1Byb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRzdXBwb3J0c0F1dG9tYXRpY05ld1N5bWJvbE5hbWVzVHJpZ2dlcktpbmQoaGFuZGxlOiBudW1iZXIpOiBQcm9taXNlPGJvb2xlYW4gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoXG5cdFx0XHRoYW5kbGUsXG5cdFx0XHROZXdTeW1ib2xOYW1lc0FkYXB0ZXIsXG5cdFx0XHRhZGFwdGVyID0+IGFkYXB0ZXIuc3VwcG9ydHNBdXRvbWF0aWNOZXdTeW1ib2xOYW1lc1RyaWdnZXJLaW5kKCksXG5cdFx0XHRmYWxzZSxcblx0XHRcdHVuZGVmaW5lZFxuXHRcdCk7XG5cdH1cblxuXHQkcHJvdmlkZU5ld1N5bWJvbE5hbWVzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2U6IElSYW5nZSwgdHJpZ2dlcktpbmQ6IGxhbmd1YWdlcy5OZXdTeW1ib2xOYW1lVHJpZ2dlcktpbmQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLk5ld1N5bWJvbE5hbWVbXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIE5ld1N5bWJvbE5hbWVzQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVOZXdTeW1ib2xOYW1lcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2UsIHRyaWdnZXJLaW5kLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0Ly8jcmVnaW9uIHNlbWFudGljIGNvbG9yaW5nXG5cblx0cmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5Eb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIsIGxlZ2VuZDogdnNjb2RlLlNlbWFudGljVG9rZW5zTGVnZW5kKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IERvY3VtZW50U2VtYW50aWNUb2tlbnNBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdGNvbnN0IGV2ZW50SGFuZGxlID0gKHR5cGVvZiBwcm92aWRlci5vbkRpZENoYW5nZVNlbWFudGljVG9rZW5zID09PSAnZnVuY3Rpb24nID8gdGhpcy5fbmV4dEhhbmRsZSgpIDogdW5kZWZpbmVkKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEb2N1bWVudFNlbWFudGljVG9rZW5zUHJvdmlkZXIoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pLCBsZWdlbmQsIGV2ZW50SGFuZGxlKTtcblx0XHRsZXQgcmVzdWx0ID0gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXG5cdFx0aWYgKGV2ZW50SGFuZGxlKSB7XG5cdFx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBwcm92aWRlci5vbkRpZENoYW5nZVNlbWFudGljVG9rZW5zIShfID0+IHRoaXMuX3Byb3h5LiRlbWl0RG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0V2ZW50KGV2ZW50SGFuZGxlKSk7XG5cdFx0XHRyZXN1bHQgPSBEaXNwb3NhYmxlLmZyb20ocmVzdWx0LCBzdWJzY3JpcHRpb24pO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHQkcHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwcmV2aW91c1Jlc3VsdElkOiBudW1iZXIsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VlNCdWZmZXIgfCBudWxsPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgRG9jdW1lbnRTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2VucyhVUkkucmV2aXZlKHJlc291cmNlKSwgcHJldmlvdXNSZXN1bHRJZCwgdG9rZW4pLCBudWxsLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZURvY3VtZW50U2VtYW50aWNUb2tlbnMoaGFuZGxlOiBudW1iZXIsIHNlbWFudGljQ29sb3JpbmdSZXN1bHRJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudFNlbWFudGljVG9rZW5zQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnJlbGVhc2VEb2N1bWVudFNlbWFudGljQ29sb3Jpbmcoc2VtYW50aWNDb2xvcmluZ1Jlc3VsdElkKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0cmVnaXN0ZXJEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyLCBsZWdlbmQ6IHZzY29kZS5TZW1hbnRpY1Rva2Vuc0xlZ2VuZCk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnNBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckRvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc1Byb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgbGVnZW5kKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVEb2N1bWVudFJhbmdlU2VtYW50aWNUb2tlbnMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCByYW5nZTogSVJhbmdlLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPFZTQnVmZmVyIHwgbnVsbD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIERvY3VtZW50UmFuZ2VTZW1hbnRpY1Rva2Vuc0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zKFVSSS5yZXZpdmUocmVzb3VyY2UpLCByYW5nZSwgdG9rZW4pLCBudWxsLCB0b2tlbik7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyAtLS0gc3VnZ2VzdGlvblxuXG5cdHJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIsIHRyaWdnZXJDaGFyYWN0ZXJzOiBzdHJpbmdbXSk6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBDb21wbGV0aW9uc0FkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIsIHByb3ZpZGVyLCB0aGlzLl9hcGlEZXByZWNhdGlvbiwgZXh0ZW5zaW9uKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJDb21wbGV0aW9uc1Byb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgdHJpZ2dlckNoYXJhY3RlcnMsIENvbXBsZXRpb25zQWRhcHRlci5zdXBwb3J0c1Jlc29sdmluZyhwcm92aWRlciksIGV4dGVuc2lvbi5pZGVudGlmaWVyKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBjb250ZXh0OiBsYW5ndWFnZXMuQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklTdWdnZXN0UmVzdWx0RHRvIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgQ29tcGxldGlvbnNBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZUNvbXBsZXRpb25JdGVtcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVzb2x2ZUNvbXBsZXRpb25JdGVtKGhhbmRsZTogbnVtYmVyLCBpZDogZXh0SG9zdFByb3RvY29sLkNoYWluZWRDYWNoZUlkLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JU3VnZ2VzdERhdGFEdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDb21wbGV0aW9uc0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5yZXNvbHZlQ29tcGxldGlvbkl0ZW0oaWQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZUNvbXBsZXRpb25JdGVtcyhoYW5kbGU6IG51bWJlciwgaWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgQ29tcGxldGlvbnNBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVsZWFzZUNvbXBsZXRpb25JdGVtcyhpZCksIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdC8vIC0tLSBnaG9zdCB0ZXh0XG5cblx0cmVnaXN0ZXJJbmxpbmVDb21wbGV0aW9uc1Byb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuSW5saW5lQ29tcGxldGlvbkl0ZW1Qcm92aWRlciwgbWV0YWRhdGE6IHZzY29kZS5JbmxpbmVDb21wbGV0aW9uSXRlbVByb3ZpZGVyTWV0YWRhdGEgfCB1bmRlZmluZWQpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgYWRhcHRlciA9IG5ldyBJbmxpbmVDb21wbGV0aW9uQWRhcHRlcihleHRlbnNpb24sIHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIsIHRoaXMuX2NvbW1hbmRzLmNvbnZlcnRlcik7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihhZGFwdGVyLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlcklubGluZUNvbXBsZXRpb25zU3VwcG9ydChcblx0XHRcdGhhbmRsZSxcblx0XHRcdHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksXG5cdFx0XHRhZGFwdGVyLnN1cHBvcnRzSGFuZGxlRXZlbnRzLFxuXHRcdFx0RXh0ZW5zaW9uSWRlbnRpZmllci50b0tleShleHRlbnNpb24uaWRlbnRpZmllci52YWx1ZSksXG5cdFx0XHRtZXRhZGF0YT8ueWllbGRUbz8ubWFwKGV4dElkID0+IEV4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0SWQpKSB8fCBbXSxcblx0XHRcdG1ldGFkYXRhPy5kaXNwbGF5TmFtZSxcblx0XHRcdG1ldGFkYXRhPy5kZWJvdW5jZURlbGF5TXMsXG5cdFx0KTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVJbmxpbmVDb21wbGV0aW9ucyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHBvc2l0aW9uOiBJUG9zaXRpb24sIGNvbnRleHQ6IGxhbmd1YWdlcy5JbmxpbmVDb21wbGV0aW9uQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSWRlbnRpZmlhYmxlSW5saW5lQ29tcGxldGlvbnMgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBJbmxpbmVDb21wbGV0aW9uQWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVJbmxpbmVDb21wbGV0aW9ucyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcHJvdmlkZUlubGluZUVkaXRzRm9yUmFuZ2UoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCByYW5nZTogSVJhbmdlLCBjb250ZXh0OiBsYW5ndWFnZXMuSW5saW5lQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklkZW50aWZpYWJsZUlubGluZUNvbXBsZXRpb25zIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgSW5saW5lQ29tcGxldGlvbkFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlSW5saW5lRWRpdHNGb3JSYW5nZShVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2UsIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkaGFuZGxlSW5saW5lQ29tcGxldGlvbkRpZFNob3coaGFuZGxlOiBudW1iZXIsIHBpZDogbnVtYmVyLCBpZHg6IG51bWJlciwgdXBkYXRlZEluc2VydFRleHQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgSW5saW5lQ29tcGxldGlvbkFkYXB0ZXIsIGFzeW5jIGFkYXB0ZXIgPT4ge1xuXHRcdFx0YWRhcHRlci5oYW5kbGVEaWRTaG93Q29tcGxldGlvbkl0ZW0ocGlkLCBpZHgsIHVwZGF0ZWRJbnNlcnRUZXh0KTtcblx0XHR9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQkaGFuZGxlSW5saW5lQ29tcGxldGlvblBhcnRpYWxBY2NlcHQoaGFuZGxlOiBudW1iZXIsIHBpZDogbnVtYmVyLCBpZHg6IG51bWJlciwgYWNjZXB0ZWRDaGFyYWN0ZXJzOiBudW1iZXIsIGluZm86IGxhbmd1YWdlcy5QYXJ0aWFsQWNjZXB0SW5mbyk6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgSW5saW5lQ29tcGxldGlvbkFkYXB0ZXIsIGFzeW5jIGFkYXB0ZXIgPT4ge1xuXHRcdFx0YWRhcHRlci5oYW5kbGVQYXJ0aWFsQWNjZXB0KHBpZCwgaWR4LCBhY2NlcHRlZENoYXJhY3RlcnMsIGluZm8pO1xuXHRcdH0sIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdCRoYW5kbGVJbmxpbmVDb21wbGV0aW9uUmVqZWN0aW9uKGhhbmRsZTogbnVtYmVyLCBwaWQ6IG51bWJlciwgaWR4OiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIElubGluZUNvbXBsZXRpb25BZGFwdGVyLCBhc3luYyBhZGFwdGVyID0+IHtcblx0XHRcdGFkYXB0ZXIuaGFuZGxlUmVqZWN0aW9uKHBpZCwgaWR4KTtcblx0XHR9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQkZnJlZUlubGluZUNvbXBsZXRpb25zTGlzdChoYW5kbGU6IG51bWJlciwgcGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIElubGluZUNvbXBsZXRpb25BZGFwdGVyLCBhc3luYyBhZGFwdGVyID0+IHsgYWRhcHRlci5kaXNwb3NlQ29tcGxldGlvbnMocGlkKTsgfSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gLS0tIGlubGluZSBlZGl0XG5cblx0cmVnaXN0ZXJJbmxpbmVFZGl0UHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5JbmxpbmVFZGl0UHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgYWRhcHRlciA9IG5ldyBJbmxpbmVFZGl0QWRhcHRlcihleHRlbnNpb24sIHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIsIHRoaXMuX2NvbW1hbmRzLmNvbnZlcnRlcik7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihhZGFwdGVyLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlcklubGluZUVkaXRQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBwcm92aWRlci5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24ubmFtZSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlSW5saW5lRWRpdChoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIGNvbnRleHQ6IGxhbmd1YWdlcy5JSW5saW5lRWRpdENvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklkZW50aWZpYWJsZUlubGluZUVkaXQgfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBJbmxpbmVFZGl0QWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVJbmxpbmVFZGl0cyhVUkkucmV2aXZlKHJlc291cmNlKSwgY29udGV4dCwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRmcmVlSW5saW5lRWRpdChoYW5kbGU6IG51bWJlciwgcGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIElubGluZUVkaXRBZGFwdGVyLCBhc3luYyBhZGFwdGVyID0+IHsgYWRhcHRlci5kaXNwb3NlRWRpdChwaWQpOyB9LCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQvLyAtLS0gcGFyYW1ldGVyIGhpbnRzXG5cblx0cmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5TaWduYXR1cmVIZWxwUHJvdmlkZXIsIG1ldGFkYXRhT3JUcmlnZ2VyQ2hhcnM6IHN0cmluZ1tdIHwgdnNjb2RlLlNpZ25hdHVyZUhlbHBQcm92aWRlck1ldGFkYXRhKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IG1ldGFkYXRhOiBleHRIb3N0UHJvdG9jb2wuSVNpZ25hdHVyZUhlbHBQcm92aWRlck1ldGFkYXRhRHRvIHwgdW5kZWZpbmVkID0gQXJyYXkuaXNBcnJheShtZXRhZGF0YU9yVHJpZ2dlckNoYXJzKVxuXHRcdFx0PyB7IHRyaWdnZXJDaGFyYWN0ZXJzOiBtZXRhZGF0YU9yVHJpZ2dlckNoYXJzLCByZXRyaWdnZXJDaGFyYWN0ZXJzOiBbXSB9XG5cdFx0XHQ6IG1ldGFkYXRhT3JUcmlnZ2VyQ2hhcnM7XG5cblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBTaWduYXR1cmVIZWxwQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pLCBtZXRhZGF0YSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlU2lnbmF0dXJlSGVscChoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHBvc2l0aW9uOiBJUG9zaXRpb24sIGNvbnRleHQ6IGV4dEhvc3RQcm90b2NvbC5JU2lnbmF0dXJlSGVscENvbnRleHREdG8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklTaWduYXR1cmVIZWxwRHRvIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgU2lnbmF0dXJlSGVscEFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlU2lnbmF0dXJlSGVscChVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGNvbnRleHQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZVNpZ25hdHVyZUhlbHAoaGFuZGxlOiBudW1iZXIsIGlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIFNpZ25hdHVyZUhlbHBBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVsZWFzZVNpZ25hdHVyZUhlbHAoaWQpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQvLyAtLS0gaW5saW5lIGhpbnRzXG5cblx0cmVnaXN0ZXJJbmxheUhpbnRzUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5JbmxheUhpbnRzUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cblx0XHRjb25zdCBldmVudEhhbmRsZSA9IHR5cGVvZiBwcm92aWRlci5vbkRpZENoYW5nZUlubGF5SGludHMgPT09ICdmdW5jdGlvbicgPyB0aGlzLl9uZXh0SGFuZGxlKCkgOiB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgSW5sYXlIaW50c0FkYXB0ZXIodGhpcy5fZG9jdW1lbnRzLCB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIsIHByb3ZpZGVyLCB0aGlzLl9sb2dTZXJ2aWNlLCBleHRlbnNpb24pLCBleHRlbnNpb24pO1xuXG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVySW5sYXlIaW50c1Byb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwgdHlwZW9mIHByb3ZpZGVyLnJlc29sdmVJbmxheUhpbnQgPT09ICdmdW5jdGlvbicsIGV2ZW50SGFuZGxlLCBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5fZXh0TGFiZWwoZXh0ZW5zaW9uKSk7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblxuXHRcdGlmIChldmVudEhhbmRsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBwcm92aWRlci5vbkRpZENoYW5nZUlubGF5SGludHMhKHVyaSA9PiB0aGlzLl9wcm94eS4kZW1pdElubGF5SGludHNFdmVudChldmVudEhhbmRsZSkpO1xuXHRcdFx0cmVzdWx0ID0gRGlzcG9zYWJsZS5mcm9tKHJlc3VsdCwgc3Vic2NyaXB0aW9uKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdCRwcm92aWRlSW5sYXlIaW50cyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHJhbmdlOiBJUmFuZ2UsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklJbmxheUhpbnRzRHRvIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgSW5sYXlIaW50c0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlSW5sYXlIaW50cyhVUkkucmV2aXZlKHJlc291cmNlKSwgcmFuZ2UsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVzb2x2ZUlubGF5SGludChoYW5kbGU6IG51bWJlciwgaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUlubGF5SGludER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIElubGF5SGludHNBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVzb2x2ZUlubGF5SGludChpZCwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRyZWxlYXNlSW5sYXlIaW50cyhoYW5kbGU6IG51bWJlciwgaWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgSW5sYXlIaW50c0FkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5yZWxlYXNlSGludHMoaWQpLCB1bmRlZmluZWQsIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQvLyAtLS0gbGlua3NcblxuXHRyZWdpc3RlckRvY3VtZW50TGlua1Byb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRMaW5rUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fYWRkTmV3QWRhcHRlcihuZXcgTGlua1Byb3ZpZGVyQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksIHR5cGVvZiBwcm92aWRlci5yZXNvbHZlRG9jdW1lbnRMaW5rID09PSAnZnVuY3Rpb24nKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByb3ZpZGVEb2N1bWVudExpbmtzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUxpbmtzTGlzdER0byB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIExpbmtQcm92aWRlckFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlTGlua3MoVVJJLnJldml2ZShyZXNvdXJjZSksIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbiwgcmVzb3VyY2Uuc2NoZW1lID09PSAnb3V0cHV0Jyk7XG5cdH1cblxuXHQkcmVzb2x2ZURvY3VtZW50TGluayhoYW5kbGU6IG51bWJlciwgaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUxpbmtEdG8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBMaW5rUHJvdmlkZXJBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVzb2x2ZUxpbmsoaWQsIHRva2VuKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG5cblx0JHJlbGVhc2VEb2N1bWVudExpbmtzKGhhbmRsZTogbnVtYmVyLCBpZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBMaW5rUHJvdmlkZXJBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucmVsZWFzZUxpbmtzKGlkKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHRydWUpO1xuXHR9XG5cblx0cmVnaXN0ZXJDb2xvclByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnRDb2xvclByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IENvbG9yUHJvdmlkZXJBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckRvY3VtZW50Q29sb3JQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJvdmlkZURvY3VtZW50Q29sb3JzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVJhd0NvbG9ySW5mb1tdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgQ29sb3JQcm92aWRlckFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlQ29sb3JzKFVSSS5yZXZpdmUocmVzb3VyY2UpLCB0b2tlbiksIFtdLCB0b2tlbik7XG5cdH1cblxuXHQkcHJvdmlkZUNvbG9yUHJlc2VudGF0aW9ucyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIGNvbG9ySW5mbzogZXh0SG9zdFByb3RvY29sLklSYXdDb2xvckluZm8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8bGFuZ3VhZ2VzLklDb2xvclByZXNlbnRhdGlvbltdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgQ29sb3JQcm92aWRlckFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlQ29sb3JQcmVzZW50YXRpb25zKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBjb2xvckluZm8sIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHRyZWdpc3RlckZvbGRpbmdSYW5nZVByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRm9sZGluZ1JhbmdlUHJvdmlkZXIpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fbmV4dEhhbmRsZSgpO1xuXHRcdGNvbnN0IGV2ZW50SGFuZGxlID0gdHlwZW9mIHByb3ZpZGVyLm9uRGlkQ2hhbmdlRm9sZGluZ1JhbmdlcyA9PT0gJ2Z1bmN0aW9uJyA/IHRoaXMuX25leHRIYW5kbGUoKSA6IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX2FkYXB0ZXIuc2V0KGhhbmRsZSwgbmV3IEFkYXB0ZXJEYXRhKG5ldyBGb2xkaW5nUHJvdmlkZXJBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJGb2xkaW5nUmFuZ2VQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBldmVudEhhbmRsZSk7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblxuXHRcdGlmIChldmVudEhhbmRsZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzdWJzY3JpcHRpb24gPSBwcm92aWRlci5vbkRpZENoYW5nZUZvbGRpbmdSYW5nZXMhKCgpID0+IHRoaXMuX3Byb3h5LiRlbWl0Rm9sZGluZ1JhbmdlRXZlbnQoZXZlbnRIYW5kbGUpKTtcblx0XHRcdHJlc3VsdCA9IERpc3Bvc2FibGUuZnJvbShyZXN1bHQsIHN1YnNjcmlwdGlvbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdCRwcm92aWRlRm9sZGluZ1JhbmdlcyhoYW5kbGU6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIGNvbnRleHQ6IHZzY29kZS5Gb2xkaW5nQ29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuRm9sZGluZ1JhbmdlW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoXG5cdFx0XHRoYW5kbGUsXG5cdFx0XHRGb2xkaW5nUHJvdmlkZXJBZGFwdGVyLFxuXHRcdFx0KGFkYXB0ZXIpID0+XG5cdFx0XHRcdGFkYXB0ZXIucHJvdmlkZUZvbGRpbmdSYW5nZXMoVVJJLnJldml2ZShyZXNvdXJjZSksIGNvbnRleHQsIHRva2VuKSxcblx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdHRva2VuXG5cdFx0KTtcblx0fVxuXG5cdC8vIC0tLSBzbWFydCBzZWxlY3RcblxuXHRyZWdpc3RlclNlbGVjdGlvblJhbmdlUHJvdmlkZXIoZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHNlbGVjdG9yOiB2c2NvZGUuRG9jdW1lbnRTZWxlY3RvciwgcHJvdmlkZXI6IHZzY29kZS5TZWxlY3Rpb25SYW5nZVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IFNlbGVjdGlvblJhbmdlQWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyLCB0aGlzLl9sb2dTZXJ2aWNlKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSk7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlU2VsZWN0aW9uUmFuZ2VzKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcG9zaXRpb25zOiBJUG9zaXRpb25bXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxsYW5ndWFnZXMuU2VsZWN0aW9uUmFuZ2VbXVtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgU2VsZWN0aW9uUmFuZ2VBZGFwdGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJvdmlkZVNlbGVjdGlvblJhbmdlcyhVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb25zLCB0b2tlbiksIFtdLCB0b2tlbik7XG5cdH1cblxuXHQvLyAtLS0gY2FsbCBoaWVyYXJjaHlcblxuXHRyZWdpc3RlckNhbGxIaWVyYXJjaHlQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkNhbGxIaWVyYXJjaHlQcm92aWRlcik6IHZzY29kZS5EaXNwb3NhYmxlIHtcblx0XHRjb25zdCBoYW5kbGUgPSB0aGlzLl9hZGROZXdBZGFwdGVyKG5ldyBDYWxsSGllcmFyY2h5QWRhcHRlcih0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyKSwgZXh0ZW5zaW9uKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJDYWxsSGllcmFyY2h5UHJvdmlkZXIoaGFuZGxlLCB0aGlzLl90cmFuc2Zvcm1Eb2N1bWVudFNlbGVjdG9yKHNlbGVjdG9yLCBleHRlbnNpb24pKTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByZXBhcmVDYWxsSGllcmFyY2h5KGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcG9zaXRpb246IElQb3NpdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSUNhbGxIaWVyYXJjaHlJdGVtRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDYWxsSGllcmFyY2h5QWRhcHRlciwgYWRhcHRlciA9PiBQcm9taXNlLnJlc29sdmUoYWRhcHRlci5wcmVwYXJlU2Vzc2lvbihVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIHRva2VuKSksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0JHByb3ZpZGVDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxscyhoYW5kbGU6IG51bWJlciwgc2Vzc2lvbklkOiBzdHJpbmcsIGl0ZW1JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JSW5jb21pbmdDYWxsRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDYWxsSGllcmFyY2h5QWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVDYWxsc1RvKHNlc3Npb25JZCwgaXRlbUlkLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0JHByb3ZpZGVDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxscyhoYW5kbGU6IG51bWJlciwgc2Vzc2lvbklkOiBzdHJpbmcsIGl0ZW1JZDogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JT3V0Z29pbmdDYWxsRHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDYWxsSGllcmFyY2h5QWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVDYWxsc0Zyb20oc2Vzc2lvbklkLCBpdGVtSWQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZUNhbGxIaWVyYXJjaHkoaGFuZGxlOiBudW1iZXIsIHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBDYWxsSGllcmFyY2h5QWRhcHRlciwgYWRhcHRlciA9PiBQcm9taXNlLnJlc29sdmUoYWRhcHRlci5yZWxlYXNlU2Vzc2lvbihzZXNzaW9uSWQpKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gLS0tIHR5cGUgaGllcmFyY2h5XG5cdHJlZ2lzdGVyVHlwZUhpZXJhcmNoeVByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuVHlwZUhpZXJhcmNoeVByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2FkZE5ld0FkYXB0ZXIobmV3IFR5cGVIaWVyYXJjaHlBZGFwdGVyKHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIpLCBleHRlbnNpb24pO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclR5cGVIaWVyYXJjaHlQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbikpO1xuXHRcdHJldHVybiB0aGlzLl9jcmVhdGVEaXNwb3NhYmxlKGhhbmRsZSk7XG5cdH1cblxuXHQkcHJlcGFyZVR5cGVIaWVyYXJjaHkoaGFuZGxlOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5JVHlwZUhpZXJhcmNoeUl0ZW1EdG9bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB0aGlzLl93aXRoQWRhcHRlcihoYW5kbGUsIFR5cGVIaWVyYXJjaHlBZGFwdGVyLCBhZGFwdGVyID0+IFByb21pc2UucmVzb2x2ZShhZGFwdGVyLnByZXBhcmVTZXNzaW9uKFVSSS5yZXZpdmUocmVzb3VyY2UpLCBwb3NpdGlvbiwgdG9rZW4pKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcHJvdmlkZVR5cGVIaWVyYXJjaHlTdXBlcnR5cGVzKGhhbmRsZTogbnVtYmVyLCBzZXNzaW9uSWQ6IHN0cmluZywgaXRlbUlkOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklUeXBlSGllcmFyY2h5SXRlbUR0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgVHlwZUhpZXJhcmNoeUFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlU3VwZXJ0eXBlcyhzZXNzaW9uSWQsIGl0ZW1JZCwgdG9rZW4pLCB1bmRlZmluZWQsIHRva2VuKTtcblx0fVxuXG5cdCRwcm92aWRlVHlwZUhpZXJhcmNoeVN1YnR5cGVzKGhhbmRsZTogbnVtYmVyLCBzZXNzaW9uSWQ6IHN0cmluZywgaXRlbUlkOiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklUeXBlSGllcmFyY2h5SXRlbUR0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgVHlwZUhpZXJhcmNoeUFkYXB0ZXIsIGFkYXB0ZXIgPT4gYWRhcHRlci5wcm92aWRlU3VidHlwZXMoc2Vzc2lvbklkLCBpdGVtSWQsIHRva2VuKSwgdW5kZWZpbmVkLCB0b2tlbik7XG5cdH1cblxuXHQkcmVsZWFzZVR5cGVIaWVyYXJjaHkoaGFuZGxlOiBudW1iZXIsIHNlc3Npb25JZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBUeXBlSGllcmFyY2h5QWRhcHRlciwgYWRhcHRlciA9PiBQcm9taXNlLnJlc29sdmUoYWRhcHRlci5yZWxlYXNlU2Vzc2lvbihzZXNzaW9uSWQpKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gLS0tIERvY3VtZW50IG9uIGRyb3BcblxuXHRyZWdpc3RlckRvY3VtZW50T25Ecm9wRWRpdFByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBzZWxlY3RvcjogdnNjb2RlLkRvY3VtZW50U2VsZWN0b3IsIHByb3ZpZGVyOiB2c2NvZGUuRG9jdW1lbnREcm9wRWRpdFByb3ZpZGVyLCBtZXRhZGF0YT86IHZzY29kZS5Eb2N1bWVudERyb3BFZGl0UHJvdmlkZXJNZXRhZGF0YSkge1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX25leHRIYW5kbGUoKTtcblx0XHR0aGlzLl9hZGFwdGVyLnNldChoYW5kbGUsIG5ldyBBZGFwdGVyRGF0YShuZXcgRG9jdW1lbnREcm9wRWRpdEFkYXB0ZXIodGhpcy5fcHJveHksIHRoaXMuX2RvY3VtZW50cywgcHJvdmlkZXIsIGhhbmRsZSwgZXh0ZW5zaW9uKSwgZXh0ZW5zaW9uKSk7XG5cblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJEb2N1bWVudE9uRHJvcEVkaXRQcm92aWRlcihoYW5kbGUsIHRoaXMuX3RyYW5zZm9ybURvY3VtZW50U2VsZWN0b3Ioc2VsZWN0b3IsIGV4dGVuc2lvbiksIG1ldGFkYXRhID8ge1xuXHRcdFx0c3VwcG9ydHNSZXNvbHZlOiAhIXByb3ZpZGVyLnJlc29sdmVEb2N1bWVudERyb3BFZGl0LFxuXHRcdFx0ZHJvcE1pbWVUeXBlczogbWV0YWRhdGEuZHJvcE1pbWVUeXBlcyxcblx0XHRcdHByb3ZpZGVkRHJvcEtpbmRzOiBtZXRhZGF0YS5wcm92aWRlZERyb3BFZGl0S2luZHM/Lm1hcCh4ID0+IHgudmFsdWUpLFxuXHRcdH0gOiB1bmRlZmluZWQpO1xuXG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRwcm92aWRlRG9jdW1lbnRPbkRyb3BFZGl0cyhoYW5kbGU6IG51bWJlciwgcmVxdWVzdElkOiBudW1iZXIsIHJlc291cmNlOiBVcmlDb21wb25lbnRzLCBwb3NpdGlvbjogSVBvc2l0aW9uLCBkYXRhVHJhbnNmZXJEdG86IGV4dEhvc3RQcm90b2NvbC5EYXRhVHJhbnNmZXJEVE8sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8ZXh0SG9zdFByb3RvY29sLklEb2N1bWVudERyb3BFZGl0RHRvW10gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudERyb3BFZGl0QWRhcHRlciwgYWRhcHRlciA9PlxuXHRcdFx0UHJvbWlzZS5yZXNvbHZlKGFkYXB0ZXIucHJvdmlkZURvY3VtZW50T25Ecm9wRWRpdHMocmVxdWVzdElkLCBVUkkucmV2aXZlKHJlc291cmNlKSwgcG9zaXRpb24sIGRhdGFUcmFuc2ZlckR0bywgdG9rZW4pKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0JHJlc29sdmVEcm9wRWRpdChoYW5kbGU6IG51bWJlciwgaWQ6IGV4dEhvc3RQcm90b2NvbC5DaGFpbmVkQ2FjaGVJZCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGFkZGl0aW9uYWxFZGl0PzogZXh0SG9zdFByb3RvY29sLklXb3Jrc3BhY2VFZGl0RHRvIH0+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudERyb3BFZGl0QWRhcHRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnJlc29sdmVEcm9wRWRpdChpZCwgdG9rZW4pLCB7fSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdCRyZWxlYXNlRG9jdW1lbnRPbkRyb3BFZGl0cyhoYW5kbGU6IG51bWJlciwgY2FjaGVJZDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudERyb3BFZGl0QWRhcHRlciwgYWRhcHRlciA9PiBQcm9taXNlLnJlc29sdmUoYWRhcHRlci5yZWxlYXNlRHJvcEVkaXRzKGNhY2hlSWQpKSwgdW5kZWZpbmVkLCB1bmRlZmluZWQpO1xuXHR9XG5cblx0Ly8gLS0tIGNvcHkvcGFzdGUgYWN0aW9uc1xuXG5cdHJlZ2lzdGVyRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgc2VsZWN0b3I6IHZzY29kZS5Eb2N1bWVudFNlbGVjdG9yLCBwcm92aWRlcjogdnNjb2RlLkRvY3VtZW50UGFzdGVFZGl0UHJvdmlkZXIsIG1ldGFkYXRhOiB2c2NvZGUuRG9jdW1lbnRQYXN0ZVByb3ZpZGVyTWV0YWRhdGEpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fbmV4dEhhbmRsZSgpO1xuXHRcdHRoaXMuX2FkYXB0ZXIuc2V0KGhhbmRsZSwgbmV3IEFkYXB0ZXJEYXRhKG5ldyBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyKHRoaXMuX3Byb3h5LCB0aGlzLl9kb2N1bWVudHMsIHByb3ZpZGVyLCBoYW5kbGUsIGV4dGVuc2lvbiksIGV4dGVuc2lvbikpO1xuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlclBhc3RlRWRpdFByb3ZpZGVyKGhhbmRsZSwgdGhpcy5fdHJhbnNmb3JtRG9jdW1lbnRTZWxlY3RvcihzZWxlY3RvciwgZXh0ZW5zaW9uKSwge1xuXHRcdFx0c3VwcG9ydHNDb3B5OiAhIXByb3ZpZGVyLnByZXBhcmVEb2N1bWVudFBhc3RlLFxuXHRcdFx0c3VwcG9ydHNQYXN0ZTogISFwcm92aWRlci5wcm92aWRlRG9jdW1lbnRQYXN0ZUVkaXRzLFxuXHRcdFx0c3VwcG9ydHNSZXNvbHZlOiAhIXByb3ZpZGVyLnJlc29sdmVEb2N1bWVudFBhc3RlRWRpdCxcblx0XHRcdHByb3ZpZGVkUGFzdGVFZGl0S2luZHM6IG1ldGFkYXRhLnByb3ZpZGVkUGFzdGVFZGl0S2luZHM/Lm1hcCh4ID0+IHgudmFsdWUpLFxuXHRcdFx0Y29weU1pbWVUeXBlczogbWV0YWRhdGEuY29weU1pbWVUeXBlcyxcblx0XHRcdHBhc3RlTWltZVR5cGVzOiBtZXRhZGF0YS5wYXN0ZU1pbWVUeXBlcyxcblx0XHR9KTtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRlRGlzcG9zYWJsZShoYW5kbGUpO1xuXHR9XG5cblx0JHByZXBhcmVEb2N1bWVudFBhc3RlKGhhbmRsZTogbnVtYmVyLCByZXNvdXJjZTogVXJpQ29tcG9uZW50cywgcmFuZ2VzOiBJUmFuZ2VbXSwgZGF0YVRyYW5zZmVyOiBleHRIb3N0UHJvdG9jb2wuRGF0YVRyYW5zZmVyRFRPLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPGV4dEhvc3RQcm90b2NvbC5EYXRhVHJhbnNmZXJEVE8gfCB1bmRlZmluZWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5fd2l0aEFkYXB0ZXIoaGFuZGxlLCBEb2N1bWVudFBhc3RlRWRpdFByb3ZpZGVyLCBhZGFwdGVyID0+IGFkYXB0ZXIucHJlcGFyZURvY3VtZW50UGFzdGUoVVJJLnJldml2ZShyZXNvdXJjZSksIHJhbmdlcywgZGF0YVRyYW5zZmVyLCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0JHByb3ZpZGVQYXN0ZUVkaXRzKGhhbmRsZTogbnVtYmVyLCByZXF1ZXN0SWQ6IG51bWJlciwgcmVzb3VyY2U6IFVyaUNvbXBvbmVudHMsIHJhbmdlczogSVJhbmdlW10sIGRhdGFUcmFuc2ZlckR0bzogZXh0SG9zdFByb3RvY29sLkRhdGFUcmFuc2ZlckRUTywgY29udGV4dDogZXh0SG9zdFByb3RvY29sLklEb2N1bWVudFBhc3RlQ29udGV4dER0bywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxleHRIb3N0UHJvdG9jb2wuSVBhc3RlRWRpdER0b1tdIHwgdW5kZWZpbmVkPiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnByb3ZpZGVQYXN0ZUVkaXRzKHJlcXVlc3RJZCwgVVJJLnJldml2ZShyZXNvdXJjZSksIHJhbmdlcywgZGF0YVRyYW5zZmVyRHRvLCBjb250ZXh0LCB0b2tlbiksIHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG5cblx0JHJlc29sdmVQYXN0ZUVkaXQoaGFuZGxlOiBudW1iZXIsIGlkOiBleHRIb3N0UHJvdG9jb2wuQ2hhaW5lZENhY2hlSWQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8eyBhZGRpdGlvbmFsRWRpdD86IGV4dEhvc3RQcm90b2NvbC5JV29ya3NwYWNlRWRpdER0byB9PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlciwgYWRhcHRlciA9PiBhZGFwdGVyLnJlc29sdmVQYXN0ZUVkaXQoaWQsIHRva2VuKSwge30sIHVuZGVmaW5lZCk7XG5cdH1cblxuXHQkcmVsZWFzZVBhc3RlRWRpdHMoaGFuZGxlOiBudW1iZXIsIGNhY2hlSWQ6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX3dpdGhBZGFwdGVyKGhhbmRsZSwgRG9jdW1lbnRQYXN0ZUVkaXRQcm92aWRlciwgYWRhcHRlciA9PiBQcm9taXNlLnJlc29sdmUoYWRhcHRlci5yZWxlYXNlUGFzdGVFZGl0cyhjYWNoZUlkKSksIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdC8vIC0tLSBjb25maWd1cmF0aW9uXG5cblx0cHJpdmF0ZSBzdGF0aWMgX3NlcmlhbGl6ZVJlZ0V4cChyZWdFeHA6IFJlZ0V4cCk6IGV4dEhvc3RQcm90b2NvbC5JUmVnRXhwRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cGF0dGVybjogcmVnRXhwLnNvdXJjZSxcblx0XHRcdGZsYWdzOiByZWdFeHAuZmxhZ3MsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF9zZXJpYWxpemVJbmRlbnRhdGlvblJ1bGUoaW5kZW50YXRpb25SdWxlOiB2c2NvZGUuSW5kZW50YXRpb25SdWxlKTogZXh0SG9zdFByb3RvY29sLklJbmRlbnRhdGlvblJ1bGVEdG8ge1xuXHRcdHJldHVybiB7XG5cdFx0XHRkZWNyZWFzZUluZGVudFBhdHRlcm46IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVSZWdFeHAoaW5kZW50YXRpb25SdWxlLmRlY3JlYXNlSW5kZW50UGF0dGVybiksXG5cdFx0XHRpbmNyZWFzZUluZGVudFBhdHRlcm46IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVSZWdFeHAoaW5kZW50YXRpb25SdWxlLmluY3JlYXNlSW5kZW50UGF0dGVybiksXG5cdFx0XHRpbmRlbnROZXh0TGluZVBhdHRlcm46IGluZGVudGF0aW9uUnVsZS5pbmRlbnROZXh0TGluZVBhdHRlcm4gPyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5fc2VyaWFsaXplUmVnRXhwKGluZGVudGF0aW9uUnVsZS5pbmRlbnROZXh0TGluZVBhdHRlcm4pIDogdW5kZWZpbmVkLFxuXHRcdFx0dW5JbmRlbnRlZExpbmVQYXR0ZXJuOiBpbmRlbnRhdGlvblJ1bGUudW5JbmRlbnRlZExpbmVQYXR0ZXJuID8gRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX3NlcmlhbGl6ZVJlZ0V4cChpbmRlbnRhdGlvblJ1bGUudW5JbmRlbnRlZExpbmVQYXR0ZXJuKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3NlcmlhbGl6ZU9uRW50ZXJSdWxlKG9uRW50ZXJSdWxlOiB2c2NvZGUuT25FbnRlclJ1bGUpOiBleHRIb3N0UHJvdG9jb2wuSU9uRW50ZXJSdWxlRHRvIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0YmVmb3JlVGV4dDogRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX3NlcmlhbGl6ZVJlZ0V4cChvbkVudGVyUnVsZS5iZWZvcmVUZXh0KSxcblx0XHRcdGFmdGVyVGV4dDogb25FbnRlclJ1bGUuYWZ0ZXJUZXh0ID8gRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX3NlcmlhbGl6ZVJlZ0V4cChvbkVudGVyUnVsZS5hZnRlclRleHQpIDogdW5kZWZpbmVkLFxuXHRcdFx0cHJldmlvdXNMaW5lVGV4dDogb25FbnRlclJ1bGUucHJldmlvdXNMaW5lVGV4dCA/IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVSZWdFeHAob25FbnRlclJ1bGUucHJldmlvdXNMaW5lVGV4dCkgOiB1bmRlZmluZWQsXG5cdFx0XHRhY3Rpb246IG9uRW50ZXJSdWxlLmFjdGlvblxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2VyaWFsaXplT25FbnRlclJ1bGVzKG9uRW50ZXJSdWxlczogdnNjb2RlLk9uRW50ZXJSdWxlW10pOiBleHRIb3N0UHJvdG9jb2wuSU9uRW50ZXJSdWxlRHRvW10ge1xuXHRcdHJldHVybiBvbkVudGVyUnVsZXMubWFwKEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVPbkVudGVyUnVsZSk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfc2VyaWFsaXplQXV0b0Nsb3NpbmdQYWlyKGF1dG9DbG9zaW5nUGFpcjogdnNjb2RlLkF1dG9DbG9zaW5nUGFpcik6IElBdXRvQ2xvc2luZ1BhaXJDb25kaXRpb25hbCB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdG9wZW46IGF1dG9DbG9zaW5nUGFpci5vcGVuLFxuXHRcdFx0Y2xvc2U6IGF1dG9DbG9zaW5nUGFpci5jbG9zZSxcblx0XHRcdG5vdEluOiBhdXRvQ2xvc2luZ1BhaXIubm90SW4gPyBhdXRvQ2xvc2luZ1BhaXIubm90SW4ubWFwKHYgPT4gU3ludGF4VG9rZW5UeXBlLnRvU3RyaW5nKHYpKSA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3NlcmlhbGl6ZUF1dG9DbG9zaW5nUGFpcnMoYXV0b0Nsb3NpbmdQYWlyczogdnNjb2RlLkF1dG9DbG9zaW5nUGFpcltdKTogSUF1dG9DbG9zaW5nUGFpckNvbmRpdGlvbmFsW10ge1xuXHRcdHJldHVybiBhdXRvQ2xvc2luZ1BhaXJzLm1hcChFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5fc2VyaWFsaXplQXV0b0Nsb3NpbmdQYWlyKTtcblx0fVxuXG5cdHNldExhbmd1YWdlQ29uZmlndXJhdGlvbihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgbGFuZ3VhZ2VJZDogc3RyaW5nLCBjb25maWd1cmF0aW9uOiB2c2NvZGUuTGFuZ3VhZ2VDb25maWd1cmF0aW9uKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IHsgd29yZFBhdHRlcm4gfSA9IGNvbmZpZ3VyYXRpb247XG5cblx0XHQvLyBjaGVjayBmb3IgYSB2YWxpZCB3b3JkIHBhdHRlcm5cblx0XHRpZiAod29yZFBhdHRlcm4gJiYgcmVnRXhwTGVhZHNUb0VuZGxlc3NMb29wKHdvcmRQYXR0ZXJuKSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBJbnZhbGlkIGxhbmd1YWdlIGNvbmZpZ3VyYXRpb246IHdvcmRQYXR0ZXJuICcke3dvcmRQYXR0ZXJufScgaXMgbm90IGFsbG93ZWQgdG8gbWF0Y2ggdGhlIGVtcHR5IHN0cmluZy5gKTtcblx0XHR9XG5cblx0XHQvLyB3b3JkIGRlZmluaXRpb25cblx0XHRpZiAod29yZFBhdHRlcm4pIHtcblx0XHRcdHRoaXMuX2RvY3VtZW50cy5zZXRXb3JkRGVmaW5pdGlvbkZvcihsYW5ndWFnZUlkLCB3b3JkUGF0dGVybik7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2RvY3VtZW50cy5zZXRXb3JkRGVmaW5pdGlvbkZvcihsYW5ndWFnZUlkLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdGlmIChjb25maWd1cmF0aW9uLl9fZWxlY3RyaWNDaGFyYWN0ZXJTdXBwb3J0KSB7XG5cdFx0XHR0aGlzLl9hcGlEZXByZWNhdGlvbi5yZXBvcnQoJ0xhbmd1YWdlQ29uZmlndXJhdGlvbi5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydCcsIGV4dGVuc2lvbixcblx0XHRcdFx0YERvIG5vdCB1c2UuYCk7XG5cdFx0fVxuXG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24uX19jaGFyYWN0ZXJQYWlyU3VwcG9ydCkge1xuXHRcdFx0dGhpcy5fYXBpRGVwcmVjYXRpb24ucmVwb3J0KCdMYW5ndWFnZUNvbmZpZ3VyYXRpb24uX19jaGFyYWN0ZXJQYWlyU3VwcG9ydCcsIGV4dGVuc2lvbixcblx0XHRcdFx0YERvIG5vdCB1c2UuYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGFuZGxlID0gdGhpcy5fbmV4dEhhbmRsZSgpO1xuXHRcdGNvbnN0IHNlcmlhbGl6ZWRDb25maWd1cmF0aW9uOiBleHRIb3N0UHJvdG9jb2wuSUxhbmd1YWdlQ29uZmlndXJhdGlvbkR0byA9IHtcblx0XHRcdGNvbW1lbnRzOiBjb25maWd1cmF0aW9uLmNvbW1lbnRzLFxuXHRcdFx0YnJhY2tldHM6IGNvbmZpZ3VyYXRpb24uYnJhY2tldHMsXG5cdFx0XHR3b3JkUGF0dGVybjogY29uZmlndXJhdGlvbi53b3JkUGF0dGVybiA/IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVSZWdFeHAoY29uZmlndXJhdGlvbi53b3JkUGF0dGVybikgOiB1bmRlZmluZWQsXG5cdFx0XHRpbmRlbnRhdGlvblJ1bGVzOiBjb25maWd1cmF0aW9uLmluZGVudGF0aW9uUnVsZXMgPyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5fc2VyaWFsaXplSW5kZW50YXRpb25SdWxlKGNvbmZpZ3VyYXRpb24uaW5kZW50YXRpb25SdWxlcykgOiB1bmRlZmluZWQsXG5cdFx0XHRvbkVudGVyUnVsZXM6IGNvbmZpZ3VyYXRpb24ub25FbnRlclJ1bGVzID8gRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuX3NlcmlhbGl6ZU9uRW50ZXJSdWxlcyhjb25maWd1cmF0aW9uLm9uRW50ZXJSdWxlcykgOiB1bmRlZmluZWQsXG5cdFx0XHRfX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydDogY29uZmlndXJhdGlvbi5fX2VsZWN0cmljQ2hhcmFjdGVyU3VwcG9ydCxcblx0XHRcdF9fY2hhcmFjdGVyUGFpclN1cHBvcnQ6IGNvbmZpZ3VyYXRpb24uX19jaGFyYWN0ZXJQYWlyU3VwcG9ydCxcblx0XHRcdGF1dG9DbG9zaW5nUGFpcnM6IGNvbmZpZ3VyYXRpb24uYXV0b0Nsb3NpbmdQYWlycyA/IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLl9zZXJpYWxpemVBdXRvQ2xvc2luZ1BhaXJzKGNvbmZpZ3VyYXRpb24uYXV0b0Nsb3NpbmdQYWlycykgOiB1bmRlZmluZWQsXG5cdFx0fTtcblxuXHRcdHRoaXMuX3Byb3h5LiRzZXRMYW5ndWFnZUNvbmZpZ3VyYXRpb24oaGFuZGxlLCBsYW5ndWFnZUlkLCBzZXJpYWxpemVkQ29uZmlndXJhdGlvbik7XG5cdFx0cmV0dXJuIHRoaXMuX2NyZWF0ZURpc3Bvc2FibGUoaGFuZGxlKTtcblx0fVxuXG5cdCRzZXRXb3JkRGVmaW5pdGlvbnMod29yZERlZmluaXRpb25zOiBleHRIb3N0UHJvdG9jb2wuSUxhbmd1YWdlV29yZERlZmluaXRpb25EdG9bXSk6IHZvaWQge1xuXHRcdGZvciAoY29uc3Qgd29yZERlZmluaXRpb24gb2Ygd29yZERlZmluaXRpb25zKSB7XG5cdFx0XHR0aGlzLl9kb2N1bWVudHMuc2V0V29yZERlZmluaXRpb25Gb3Iod29yZERlZmluaXRpb24ubGFuZ3VhZ2VJZCwgbmV3IFJlZ0V4cCh3b3JkRGVmaW5pdGlvbi5yZWdleFNvdXJjZSwgd29yZERlZmluaXRpb24ucmVnZXhGbGFncykpO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBTUEsU0FBUyxTQUFTLFVBQVUsZ0JBQWdCLHVCQUF1QjtBQUNuRSxTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHFCQUFxQiwyQkFBMkI7QUFDekQsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxRQUFRLGFBQWE7QUFDOUIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUyxZQUFZLGdCQUFnQjtBQUNyQyxTQUFTLFdBQTBCO0FBRW5DLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsU0FBUyxtQkFBMkI7QUFDN0MsU0FBcUIsaUJBQWlCO0FBQ3RDLFlBQVksZUFBZTtBQUUzQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDJCQUFrRDtBQUUzRCxTQUFTLHlCQUF5Qiw0QkFBNEI7QUFDOUQsU0FBUyxhQUFhO0FBQ3RCLFlBQVkscUJBQXFCO0FBTWpDLFlBQVksaUJBQWlCO0FBQzdCLFNBQVMsWUFBWSxnQkFBZ0IsZ0JBQWdCLGNBQWMsWUFBWSw2QkFBNkIsZ0JBQWdCLDZCQUE2Qix1QkFBdUIsMEJBQTBCLFVBQVUsMEJBQTBCLE9BQU8sZ0JBQWdCLG9CQUFvQixxQkFBcUIsZUFBa0Ms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QUFrQyxZQUFvQixlQUFnRTtBQUM5SSxVQUFNLEVBQUUsWUFBWSxJQUFJO0FBR3hCLFFBQUksZUFBZSx5QkFBeUIsV0FBVyxHQUFHO0FBQ3pELFlBQU0sSUFBSSxNQUFNLGdEQUFnRCxXQUFXLDZDQUE2QztBQUFBLElBQ3pIO0FBR0EsUUFBSSxhQUFhO0FBQ2hCLFdBQUssV0FBVyxxQkFBcUIsWUFBWSxXQUFXO0FBQUEsSUFDN0QsT0FBTztBQUNOLFdBQUssV0FBVyxxQkFBcUIsWUFBWSxNQUFTO0FBQUEsSUFDM0Q7QUFFQSxRQUFJLGNBQWMsNEJBQTRCO0FBQzdDLFdBQUssZ0JBQWdCO0FBQUEsUUFBTztBQUFBLFFBQW9EO0FBQUEsUUFDL0U7QUFBQSxNQUFhO0FBQUEsSUFDZjtBQUVBLFFBQUksY0FBYyx3QkFBd0I7QUFDekMsV0FBSyxnQkFBZ0I7QUFBQSxRQUFPO0FBQUEsUUFBZ0Q7QUFBQSxRQUMzRTtBQUFBLE1BQWE7QUFBQSxJQUNmO0FBRUEsVUFBTSxTQUFTLEtBQUssWUFBWTtBQUNoQyxVQUFNLDBCQUFxRTtBQUFBLE1BQzFFLFVBQVUsY0FBYztBQUFBLE1BQ3hCLFVBQVUsY0FBYztBQUFBLE1BQ3hCLGFBQWEsY0FBYyxjQUFjLHlCQUF3QixpQkFBaUIsY0FBYyxXQUFXLElBQUk7QUFBQSxNQUMvRyxrQkFBa0IsY0FBYyxtQkFBbUIseUJBQXdCLDBCQUEwQixjQUFjLGdCQUFnQixJQUFJO0FBQUEsTUFDdkksY0FBYyxjQUFjLGVBQWUseUJBQXdCLHVCQUF1QixjQUFjLFlBQVksSUFBSTtBQUFBLE1BQ3hILDRCQUE0QixjQUFjO0FBQUEsTUFDMUMsd0JBQXdCLGNBQWM7QUFBQSxNQUN0QyxrQkFBa0IsY0FBYyxtQkFBbUIseUJBQXdCLDJCQUEyQixjQUFjLGdCQUFnQixJQUFJO0FBQUEsSUFDekk7QUFFQSxTQUFLLE9BQU8sMEJBQTBCLFFBQVEsWUFBWSx1QkFBdUI7QUFDakYsV0FBTyxLQUFLLGtCQUFrQixNQUFNO0FBQUEsRUFDckM7QUFBQSxFQUVBLG9CQUFvQixpQkFBcUU7QUFDeEYsZUFBVyxrQkFBa0IsaUJBQWlCO0FBQzdDLFdBQUssV0FBVyxxQkFBcUIsZUFBZSxZQUFZLElBQUksT0FBTyxlQUFlLGFBQWEsZUFBZSxVQUFVLENBQUM7QUFBQSxJQUNsSTtBQUFBLEVBQ0Q7QUFDRDtBQXYwQmEseUJBRUcsY0FBc0I7QUFGL0IsSUFBTSwwQkFBTjsiLAogICJuYW1lcyI6IFsicmVzIiwgImRvYyJdCn0K
