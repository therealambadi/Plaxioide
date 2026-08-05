import { isFalsyOrEmpty } from "../../../base/common/arrays.js";
import { Schemas, matchesSomeScheme } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import * as languages from "../../../editor/common/languages.js";
import { decodeSemanticTokensDto } from "../../../editor/common/services/semanticTokensDto.js";
import { validateWhenClauses } from "../../../platform/contextkey/common/contextkey.js";
import { ApiCommand, ApiCommandArgument, ApiCommandResult } from "./extHostCommands.js";
import * as typeConverters from "./extHostTypeConverters.js";
import * as types from "./extHostTypes.js";
const newCommands = [
  // -- document highlights
  new ApiCommand(
    "vscode.executeDocumentHighlights",
    "_executeDocumentHighlights",
    "Execute document highlight provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of DocumentHighlight-instances.", tryMapWith(typeConverters.DocumentHighlight.to))
  ),
  // -- document symbols
  new ApiCommand(
    "vscode.executeDocumentSymbolProvider",
    "_executeDocumentSymbolProvider",
    "Execute document symbol provider.",
    [ApiCommandArgument.Uri],
    new ApiCommandResult("A promise that resolves to an array of SymbolInformation and DocumentSymbol instances.", (value, apiArgs) => {
      if (isFalsyOrEmpty(value)) {
        return void 0;
      }
      class MergedInfo extends types.SymbolInformation {
        static to(symbol) {
          const res = new MergedInfo(
            symbol.name,
            typeConverters.SymbolKind.to(symbol.kind),
            symbol.containerName || "",
            new types.Location(apiArgs[0], typeConverters.Range.to(symbol.range))
          );
          res.detail = symbol.detail;
          res.range = res.location.range;
          res.selectionRange = typeConverters.Range.to(symbol.selectionRange);
          res.children = symbol.children ? symbol.children.map(MergedInfo.to) : [];
          return res;
        }
      }
      return value.map(MergedInfo.to);
    })
  ),
  // -- formatting
  new ApiCommand(
    "vscode.executeFormatDocumentProvider",
    "_executeFormatDocumentProvider",
    "Execute document format provider.",
    [ApiCommandArgument.Uri, new ApiCommandArgument("options", "Formatting options", (_) => true, (v) => v)],
    new ApiCommandResult("A promise that resolves to an array of TextEdits.", tryMapWith(typeConverters.TextEdit.to))
  ),
  new ApiCommand(
    "vscode.executeFormatRangeProvider",
    "_executeFormatRangeProvider",
    "Execute range format provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Range, new ApiCommandArgument("options", "Formatting options", (_) => true, (v) => v)],
    new ApiCommandResult("A promise that resolves to an array of TextEdits.", tryMapWith(typeConverters.TextEdit.to))
  ),
  new ApiCommand(
    "vscode.executeFormatOnTypeProvider",
    "_executeFormatOnTypeProvider",
    "Execute format on type provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position, new ApiCommandArgument("ch", "Trigger character", (v) => typeof v === "string", (v) => v), new ApiCommandArgument("options", "Formatting options", (_) => true, (v) => v)],
    new ApiCommandResult("A promise that resolves to an array of TextEdits.", tryMapWith(typeConverters.TextEdit.to))
  ),
  // -- go to symbol (definition, type definition, declaration, impl, references)
  new ApiCommand(
    "vscode.executeDefinitionProvider",
    "_executeDefinitionProvider",
    "Execute all definition providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.experimental.executeDefinitionProvider_recursive",
    "_executeDefinitionProvider_recursive",
    "Execute all definition providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.executeTypeDefinitionProvider",
    "_executeTypeDefinitionProvider",
    "Execute all type definition providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.experimental.executeTypeDefinitionProvider_recursive",
    "_executeTypeDefinitionProvider_recursive",
    "Execute all type definition providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.executeDeclarationProvider",
    "_executeDeclarationProvider",
    "Execute all declaration providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.experimental.executeDeclarationProvider_recursive",
    "_executeDeclarationProvider_recursive",
    "Execute all declaration providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.executeImplementationProvider",
    "_executeImplementationProvider",
    "Execute all implementation providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.experimental.executeImplementationProvider_recursive",
    "_executeImplementationProvider_recursive",
    "Execute all implementation providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location or LocationLink instances.", mapLocationOrLocationLink)
  ),
  new ApiCommand(
    "vscode.executeReferenceProvider",
    "_executeReferenceProvider",
    "Execute all reference providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location-instances.", tryMapWith(typeConverters.location.to))
  ),
  new ApiCommand(
    "vscode.experimental.executeReferenceProvider",
    "_executeReferenceProvider_recursive",
    "Execute all reference providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Location-instances.", tryMapWith(typeConverters.location.to))
  ),
  // -- hover
  new ApiCommand(
    "vscode.executeHoverProvider",
    "_executeHoverProvider",
    "Execute all hover providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Hover-instances.", tryMapWith(typeConverters.Hover.to))
  ),
  new ApiCommand(
    "vscode.experimental.executeHoverProvider_recursive",
    "_executeHoverProvider_recursive",
    "Execute all hover providers.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of Hover-instances.", tryMapWith(typeConverters.Hover.to))
  ),
  // -- selection range
  new ApiCommand(
    "vscode.executeSelectionRangeProvider",
    "_executeSelectionRangeProvider",
    "Execute selection range provider.",
    [ApiCommandArgument.Uri, new ApiCommandArgument("position", "A position in a text document", (v) => Array.isArray(v) && v.every((v2) => types.Position.isPosition(v2)), (v) => v.map(typeConverters.Position.from))],
    new ApiCommandResult("A promise that resolves to an array of ranges.", (result) => {
      return result.map((ranges) => {
        let node;
        for (const range of ranges.reverse()) {
          node = new types.SelectionRange(typeConverters.Range.to(range), node);
        }
        return node;
      });
    })
  ),
  // -- symbol search
  new ApiCommand(
    "vscode.executeWorkspaceSymbolProvider",
    "_executeWorkspaceSymbolProvider",
    "Execute all workspace symbol providers.",
    [ApiCommandArgument.String.with("query", "Search string")],
    new ApiCommandResult("A promise that resolves to an array of SymbolInformation-instances.", (value) => {
      return value.map(typeConverters.WorkspaceSymbol.to);
    })
  ),
  // --- call hierarchy
  new ApiCommand(
    "vscode.prepareCallHierarchy",
    "_executePrepareCallHierarchy",
    "Prepare call hierarchy at a position inside a document",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of CallHierarchyItem-instances", (v) => v.map(typeConverters.CallHierarchyItem.to))
  ),
  new ApiCommand(
    "vscode.provideIncomingCalls",
    "_executeProvideIncomingCalls",
    "Compute incoming calls for an item",
    [ApiCommandArgument.CallHierarchyItem],
    new ApiCommandResult("A promise that resolves to an array of CallHierarchyIncomingCall-instances", (v) => v.map(typeConverters.CallHierarchyIncomingCall.to))
  ),
  new ApiCommand(
    "vscode.provideOutgoingCalls",
    "_executeProvideOutgoingCalls",
    "Compute outgoing calls for an item",
    [ApiCommandArgument.CallHierarchyItem],
    new ApiCommandResult("A promise that resolves to an array of CallHierarchyOutgoingCall-instances", (v) => v.map(typeConverters.CallHierarchyOutgoingCall.to))
  ),
  // --- rename
  new ApiCommand(
    "vscode.prepareRename",
    "_executePrepareRename",
    "Execute the prepareRename of rename provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to a range and placeholder text.", (value) => {
      if (!value) {
        return void 0;
      }
      return {
        range: typeConverters.Range.to(value.range),
        placeholder: value.text
      };
    })
  ),
  new ApiCommand(
    "vscode.executeDocumentRenameProvider",
    "_executeDocumentRenameProvider",
    "Execute rename provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position, ApiCommandArgument.String.with("newName", "The new symbol name")],
    new ApiCommandResult("A promise that resolves to a WorkspaceEdit.", (value) => {
      if (!value) {
        return void 0;
      }
      if (value.rejectReason) {
        throw new Error(value.rejectReason);
      }
      return typeConverters.WorkspaceEdit.to(value);
    })
  ),
  // --- links
  new ApiCommand(
    "vscode.executeLinkProvider",
    "_executeLinkProvider",
    "Execute document link provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Number.with("linkResolveCount", "Number of links that should be resolved, only when links are unresolved.").optional()],
    new ApiCommandResult("A promise that resolves to an array of DocumentLink-instances.", (value) => value.map(typeConverters.DocumentLink.to))
  ),
  // --- semantic tokens
  new ApiCommand(
    "vscode.provideDocumentSemanticTokensLegend",
    "_provideDocumentSemanticTokensLegend",
    "Provide semantic tokens legend for a document",
    [ApiCommandArgument.Uri],
    new ApiCommandResult("A promise that resolves to SemanticTokensLegend.", (value) => {
      if (!value) {
        return void 0;
      }
      return new types.SemanticTokensLegend(value.tokenTypes, value.tokenModifiers);
    })
  ),
  new ApiCommand(
    "vscode.provideDocumentSemanticTokens",
    "_provideDocumentSemanticTokens",
    "Provide semantic tokens for a document",
    [ApiCommandArgument.Uri],
    new ApiCommandResult("A promise that resolves to SemanticTokens.", (value) => {
      if (!value) {
        return void 0;
      }
      const semanticTokensDto = decodeSemanticTokensDto(value);
      if (semanticTokensDto.type !== "full") {
        return void 0;
      }
      return new types.SemanticTokens(semanticTokensDto.data, void 0);
    })
  ),
  new ApiCommand(
    "vscode.provideDocumentRangeSemanticTokensLegend",
    "_provideDocumentRangeSemanticTokensLegend",
    "Provide semantic tokens legend for a document range",
    [ApiCommandArgument.Uri, ApiCommandArgument.Range.optional()],
    new ApiCommandResult("A promise that resolves to SemanticTokensLegend.", (value) => {
      if (!value) {
        return void 0;
      }
      return new types.SemanticTokensLegend(value.tokenTypes, value.tokenModifiers);
    })
  ),
  new ApiCommand(
    "vscode.provideDocumentRangeSemanticTokens",
    "_provideDocumentRangeSemanticTokens",
    "Provide semantic tokens for a document range",
    [ApiCommandArgument.Uri, ApiCommandArgument.Range],
    new ApiCommandResult("A promise that resolves to SemanticTokens.", (value) => {
      if (!value) {
        return void 0;
      }
      const semanticTokensDto = decodeSemanticTokensDto(value);
      if (semanticTokensDto.type !== "full") {
        return void 0;
      }
      return new types.SemanticTokens(semanticTokensDto.data, void 0);
    })
  ),
  // --- completions
  new ApiCommand(
    "vscode.executeCompletionItemProvider",
    "_executeCompletionItemProvider",
    "Execute completion item provider.",
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Position,
      ApiCommandArgument.String.with("triggerCharacter", "Trigger completion when the user types the character, like `,` or `(`").optional(),
      ApiCommandArgument.Number.with("itemResolveCount", "Number of completions to resolve (too large numbers slow down completions)").optional()
    ],
    new ApiCommandResult("A promise that resolves to a CompletionList-instance.", (value, _args, converter) => {
      if (!value) {
        return new types.CompletionList([]);
      }
      const items = value.suggestions.map((suggestion) => typeConverters.CompletionItem.to(suggestion, converter));
      return new types.CompletionList(items, value.incomplete);
    })
  ),
  // --- signature help
  new ApiCommand(
    "vscode.executeSignatureHelpProvider",
    "_executeSignatureHelpProvider",
    "Execute signature help provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position, ApiCommandArgument.String.with("triggerCharacter", "Trigger signature help when the user types the character, like `,` or `(`").optional()],
    new ApiCommandResult("A promise that resolves to SignatureHelp.", (value) => {
      if (value) {
        return typeConverters.SignatureHelp.to(value);
      }
      return void 0;
    })
  ),
  // --- code lens
  new ApiCommand(
    "vscode.executeCodeLensProvider",
    "_executeCodeLensProvider",
    "Execute code lens provider.",
    [ApiCommandArgument.Uri, ApiCommandArgument.Number.with("itemResolveCount", "Number of lenses that should be resolved and returned. Will only return resolved lenses, will impact performance)").optional()],
    new ApiCommandResult("A promise that resolves to an array of CodeLens-instances.", (value, _args, converter) => {
      return tryMapWith((item) => {
        return new types.CodeLens(typeConverters.Range.to(item.range), item.command && converter.fromInternal(item.command));
      })(value);
    })
  ),
  // --- code actions
  new ApiCommand(
    "vscode.executeCodeActionProvider",
    "_executeCodeActionProvider",
    "Execute code action provider.",
    [
      ApiCommandArgument.Uri,
      new ApiCommandArgument("rangeOrSelection", "Range in a text document. Some refactoring provider requires Selection object.", (v) => types.Range.isRange(v), (v) => types.Selection.isSelection(v) ? typeConverters.Selection.from(v) : typeConverters.Range.from(v)),
      ApiCommandArgument.String.with("kind", "Code action kind to return code actions for").optional(),
      ApiCommandArgument.Number.with("itemResolveCount", "Number of code actions to resolve (too large numbers slow down code actions)").optional()
    ],
    new ApiCommandResult("A promise that resolves to an array of Command-instances.", (value, _args, converter) => {
      return tryMapWith((codeAction) => {
        if (codeAction._isSynthetic) {
          if (!codeAction.command) {
            throw new Error("Synthetic code actions must have a command");
          }
          return converter.fromInternal(codeAction.command);
        } else {
          const ret = new types.CodeAction(
            codeAction.title,
            codeAction.kind ? new types.CodeActionKind(codeAction.kind) : void 0
          );
          if (codeAction.edit) {
            ret.edit = typeConverters.WorkspaceEdit.to(codeAction.edit);
          }
          if (codeAction.command) {
            ret.command = converter.fromInternal(codeAction.command);
          }
          ret.isPreferred = codeAction.isPreferred;
          return ret;
        }
      })(value);
    })
  ),
  // --- colors
  new ApiCommand(
    "vscode.executeDocumentColorProvider",
    "_executeDocumentColorProvider",
    "Execute document color provider.",
    [ApiCommandArgument.Uri],
    new ApiCommandResult("A promise that resolves to an array of ColorInformation objects.", (result) => {
      if (result) {
        return result.map((ci) => new types.ColorInformation(typeConverters.Range.to(ci.range), typeConverters.Color.to(ci.color)));
      }
      return [];
    })
  ),
  new ApiCommand(
    "vscode.executeColorPresentationProvider",
    "_executeColorPresentationProvider",
    "Execute color presentation provider.",
    [
      new ApiCommandArgument("color", "The color to show and insert", (v) => v instanceof types.Color, typeConverters.Color.from),
      new ApiCommandArgument("context", "Context object with uri and range", (_v) => true, (v) => ({ uri: v.uri, range: typeConverters.Range.from(v.range) }))
    ],
    new ApiCommandResult("A promise that resolves to an array of ColorPresentation objects.", (result) => {
      if (result) {
        return result.map(typeConverters.ColorPresentation.to);
      }
      return [];
    })
  ),
  // --- inline hints
  new ApiCommand(
    "vscode.executeInlayHintProvider",
    "_executeInlayHintProvider",
    "Execute inlay hints provider",
    [ApiCommandArgument.Uri, ApiCommandArgument.Range],
    new ApiCommandResult("A promise that resolves to an array of Inlay objects", (result, args, converter) => {
      return result.map(typeConverters.InlayHint.to.bind(void 0, converter));
    })
  ),
  // --- folding
  new ApiCommand(
    "vscode.executeFoldingRangeProvider",
    "_executeFoldingRangeProvider",
    "Execute folding range provider",
    [ApiCommandArgument.Uri],
    new ApiCommandResult("A promise that resolves to an array of FoldingRange objects", (result, args) => {
      if (result) {
        return result.map(typeConverters.FoldingRange.to);
      }
      return void 0;
    })
  ),
  // --- notebooks
  new ApiCommand(
    "vscode.resolveNotebookContentProviders",
    "_resolveNotebookContentProvider",
    "Resolve Notebook Content Providers",
    [
      // new ApiCommandArgument<string, string>('viewType', '', v => typeof v === 'string', v => v),
      // new ApiCommandArgument<string, string>('displayName', '', v => typeof v === 'string', v => v),
      // new ApiCommandArgument<object, object>('options', '', v => typeof v === 'object', v => v),
    ],
    new ApiCommandResult("A promise that resolves to an array of NotebookContentProvider static info objects.", tryMapWith((item) => {
      return {
        viewType: item.viewType,
        displayName: item.displayName,
        options: {
          transientOutputs: item.options.transientOutputs,
          transientCellMetadata: item.options.transientCellMetadata,
          transientDocumentMetadata: item.options.transientDocumentMetadata
        },
        filenamePattern: item.filenamePattern.map((pattern) => typeConverters.NotebookExclusiveDocumentPattern.to(pattern))
      };
    }))
  ),
  // --- debug support
  new ApiCommand(
    "vscode.executeInlineValueProvider",
    "_executeInlineValueProvider",
    "Execute inline value provider",
    [
      ApiCommandArgument.Uri,
      ApiCommandArgument.Range,
      new ApiCommandArgument("context", "An InlineValueContext", (v) => v && typeof v.frameId === "number" && v.stoppedLocation instanceof types.Range, (v) => typeConverters.InlineValueContext.from(v))
    ],
    new ApiCommandResult("A promise that resolves to an array of InlineValue objects", (result) => {
      return result.map(typeConverters.InlineValue.to);
    })
  ),
  // --- open'ish commands
  new ApiCommand(
    "vscode.open",
    "_workbench.open",
    "Opens the provided resource in the editor. Can be a text or binary file, or an http(s) URL. If you need more control over the options for opening a text file, use vscode.window.showTextDocument instead.",
    [
      new ApiCommandArgument("uriOrString", "Uri-instance or string (only http/https)", (v) => URI.isUri(v) || typeof v === "string" && matchesSomeScheme(v, Schemas.http, Schemas.https), (v) => v),
      new ApiCommandArgument(
        "columnOrOptions",
        "Either the column in which to open or editor options, see vscode.TextDocumentShowOptions",
        (v) => v === void 0 || typeof v === "number" || typeof v === "object",
        (v) => !v ? v : typeof v === "number" ? [typeConverters.ViewColumn.from(v), void 0] : [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)]
      ).optional(),
      ApiCommandArgument.String.with("label", "").optional()
    ],
    ApiCommandResult.Void
  ),
  new ApiCommand(
    "vscode.openWith",
    "_workbench.openWith",
    "Opens the provided resource with a specific editor.",
    [
      ApiCommandArgument.Uri.with("resource", "Resource to open"),
      ApiCommandArgument.String.with("viewId", "Custom editor view id. This should be the viewType string for custom editors or the notebookType string for notebooks. Use 'default' to use VS Code's default text editor"),
      new ApiCommandArgument(
        "columnOrOptions",
        "Either the column in which to open or editor options, see vscode.TextDocumentShowOptions",
        (v) => v === void 0 || typeof v === "number" || typeof v === "object",
        (v) => !v ? v : typeof v === "number" ? [typeConverters.ViewColumn.from(v), void 0] : [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)]
      ).optional()
    ],
    ApiCommandResult.Void
  ),
  new ApiCommand(
    "vscode.diff",
    "_workbench.diff",
    "Opens the provided resources in the diff editor to compare their contents.",
    [
      ApiCommandArgument.Uri.with("left", "Left-hand side resource of the diff editor"),
      ApiCommandArgument.Uri.with("right", "Right-hand side resource of the diff editor"),
      ApiCommandArgument.String.with("title", "Human readable title for the diff editor").optional(),
      new ApiCommandArgument(
        "columnOrOptions",
        "Either the column in which to open or editor options, see vscode.TextDocumentShowOptions",
        (v) => v === void 0 || typeof v === "object",
        (v) => v && [typeConverters.ViewColumn.from(v.viewColumn), typeConverters.TextEditorOpenOptions.from(v)]
      ).optional()
    ],
    ApiCommandResult.Void
  ),
  new ApiCommand(
    "vscode.changes",
    "_workbench.changes",
    "Opens a list of resources in the changes editor to compare their contents.",
    [
      ApiCommandArgument.String.with("title", "Human readable title for the changes editor"),
      new ApiCommandArgument(
        "resourceList",
        "List of resources to compare",
        (resources) => {
          for (const resource of resources) {
            if (resource.length !== 3) {
              return false;
            }
            const [label, left, right] = resource;
            if (!URI.isUri(label) || !URI.isUri(left) && left !== void 0 && left !== null || !URI.isUri(right) && right !== void 0 && right !== null) {
              return false;
            }
          }
          return true;
        },
        (v) => v
      )
    ],
    ApiCommandResult.Void
  ),
  // --- type hierarchy
  new ApiCommand(
    "vscode.prepareTypeHierarchy",
    "_executePrepareTypeHierarchy",
    "Prepare type hierarchy at a position inside a document",
    [ApiCommandArgument.Uri, ApiCommandArgument.Position],
    new ApiCommandResult("A promise that resolves to an array of TypeHierarchyItem-instances", (v) => v.map(typeConverters.TypeHierarchyItem.to))
  ),
  new ApiCommand(
    "vscode.provideSupertypes",
    "_executeProvideSupertypes",
    "Compute supertypes for an item",
    [ApiCommandArgument.TypeHierarchyItem],
    new ApiCommandResult("A promise that resolves to an array of TypeHierarchyItem-instances", (v) => v.map(typeConverters.TypeHierarchyItem.to))
  ),
  new ApiCommand(
    "vscode.provideSubtypes",
    "_executeProvideSubtypes",
    "Compute subtypes for an item",
    [ApiCommandArgument.TypeHierarchyItem],
    new ApiCommandResult("A promise that resolves to an array of TypeHierarchyItem-instances", (v) => v.map(typeConverters.TypeHierarchyItem.to))
  ),
  // --- testing
  new ApiCommand(
    "vscode.revealTestInExplorer",
    "_revealTestInExplorer",
    "Reveals a test instance in the explorer",
    [ApiCommandArgument.TestItem],
    ApiCommandResult.Void
  ),
  new ApiCommand(
    "vscode.startContinuousTestRun",
    "testing.startContinuousRunFromExtension",
    "Starts running the given tests with continuous run mode.",
    [ApiCommandArgument.TestProfile, ApiCommandArgument.Arr(ApiCommandArgument.TestItem)],
    ApiCommandResult.Void
  ),
  new ApiCommand(
    "vscode.stopContinuousTestRun",
    "testing.stopContinuousRunFromExtension",
    "Stops running the given tests with continuous run mode.",
    [ApiCommandArgument.Arr(ApiCommandArgument.TestItem)],
    ApiCommandResult.Void
  ),
  // --- continue edit session
  new ApiCommand(
    "vscode.experimental.editSession.continue",
    "_workbench.editSessions.actions.continueEditSession",
    "Continue the current edit session in a different workspace",
    [ApiCommandArgument.Uri.with("workspaceUri", "The target workspace to continue the current edit session in")],
    ApiCommandResult.Void
  ),
  // --- context keys
  new ApiCommand(
    "setContext",
    "_setContext",
    "Set a custom context key value that can be used in when clauses.",
    [
      ApiCommandArgument.String.with("name", "The context key name"),
      new ApiCommandArgument("value", "The context key value", () => true, (v) => v)
    ],
    ApiCommandResult.Void
  ),
  // --- inline chat
  new ApiCommand(
    "vscode.editorChat.start",
    "inlineChat.start",
    "Invoke a new editor chat session",
    [new ApiCommandArgument("Run arguments", "", (_v) => true, (v) => {
      if (!v) {
        return void 0;
      }
      return {
        initialRange: v.initialRange ? typeConverters.Range.from(v.initialRange) : void 0,
        initialSelection: types.Selection.isSelection(v.initialSelection) ? typeConverters.Selection.from(v.initialSelection) : void 0,
        message: v.message,
        autoSend: v.autoSend,
        position: v.position ? typeConverters.Position.from(v.position) : void 0
      };
    })],
    ApiCommandResult.Void
  )
];
class ExtHostApiCommands {
  static register(commands) {
    newCommands.forEach(commands.registerApiCommand, commands);
    this._registerValidateWhenClausesCommand(commands);
  }
  static _registerValidateWhenClausesCommand(commands) {
    commands.registerCommand(false, "_validateWhenClauses", validateWhenClauses);
  }
}
function tryMapWith(f) {
  return (value) => {
    if (Array.isArray(value)) {
      return value.map(f);
    }
    return void 0;
  };
}
function mapLocationOrLocationLink(values) {
  if (!Array.isArray(values)) {
    return void 0;
  }
  const result = [];
  for (const item of values) {
    if (languages.isLocationLink(item)) {
      result.push(typeConverters.DefinitionLink.to(item));
    } else {
      result.push(typeConverters.location.to(item));
    }
  }
  return result;
}
export {
  ExtHostApiCommands
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0QXBpQ29tbWFuZHMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpc0ZhbHN5T3JFbXB0eSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzLCBtYXRjaGVzU29tZVNjaGVtZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVNlbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9zZWxlY3Rpb24uanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IGRlY29kZVNlbWFudGljVG9rZW5zRHRvIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9zZW1hbnRpY1Rva2Vuc0R0by5qcyc7XG5pbXBvcnQgeyB2YWxpZGF0ZVdoZW5DbGF1c2VzIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJVGV4dEVkaXRvck9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9lZGl0b3IvY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJQ2FsbEhpZXJhcmNoeUl0ZW1EdG8sIElJbmNvbWluZ0NhbGxEdG8sIElJbmxpbmVWYWx1ZUNvbnRleHREdG8sIElPdXRnb2luZ0NhbGxEdG8sIElSYXdDb2xvckluZm8sIElUeXBlSGllcmFyY2h5SXRlbUR0bywgSVdvcmtzcGFjZUVkaXREdG8gfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgQXBpQ29tbWFuZCwgQXBpQ29tbWFuZEFyZ3VtZW50LCBBcGlDb21tYW5kUmVzdWx0LCBFeHRIb3N0Q29tbWFuZHMgfSBmcm9tICcuL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBDdXN0b21Db2RlQWN0aW9uIH0gZnJvbSAnLi9leHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlQ29udmVydGVycyBmcm9tICcuL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBUcmFuc2llbnRDZWxsTWV0YWRhdGEsIFRyYW5zaWVudERvY3VtZW50TWV0YWRhdGEgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgKiBhcyBzZWFyY2ggZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuXG4vLyNyZWdpb24gLS0tIE5FVyB3b3JsZFxuXG5jb25zdCBuZXdDb21tYW5kczogQXBpQ29tbWFuZFtdID0gW1xuXHQvLyAtLSBkb2N1bWVudCBoaWdobGlnaHRzXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZURvY3VtZW50SGlnaGxpZ2h0cycsICdfZXhlY3V0ZURvY3VtZW50SGlnaGxpZ2h0cycsICdFeGVjdXRlIGRvY3VtZW50IGhpZ2hsaWdodCBwcm92aWRlci4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5Eb2N1bWVudEhpZ2hsaWdodFtdLCB0eXBlcy5Eb2N1bWVudEhpZ2hsaWdodFtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgRG9jdW1lbnRIaWdobGlnaHQtaW5zdGFuY2VzLicsIHRyeU1hcFdpdGgodHlwZUNvbnZlcnRlcnMuRG9jdW1lbnRIaWdobGlnaHQudG8pKVxuXHQpLFxuXHQvLyAtLSBkb2N1bWVudCBzeW1ib2xzXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZURvY3VtZW50U3ltYm9sUHJvdmlkZXInLCAnX2V4ZWN1dGVEb2N1bWVudFN5bWJvbFByb3ZpZGVyJywgJ0V4ZWN1dGUgZG9jdW1lbnQgc3ltYm9sIHByb3ZpZGVyLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5Eb2N1bWVudFN5bWJvbFtdLCB2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb25bXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIFN5bWJvbEluZm9ybWF0aW9uIGFuZCBEb2N1bWVudFN5bWJvbCBpbnN0YW5jZXMuJywgKHZhbHVlLCBhcGlBcmdzKSA9PiB7XG5cblx0XHRcdGlmIChpc0ZhbHN5T3JFbXB0eSh2YWx1ZSkpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGNsYXNzIE1lcmdlZEluZm8gZXh0ZW5kcyB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbiBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudFN5bWJvbCB7XG5cdFx0XHRcdHN0YXRpYyB0byhzeW1ib2w6IGxhbmd1YWdlcy5Eb2N1bWVudFN5bWJvbCk6IE1lcmdlZEluZm8ge1xuXHRcdFx0XHRcdGNvbnN0IHJlcyA9IG5ldyBNZXJnZWRJbmZvKFxuXHRcdFx0XHRcdFx0c3ltYm9sLm5hbWUsXG5cdFx0XHRcdFx0XHR0eXBlQ29udmVydGVycy5TeW1ib2xLaW5kLnRvKHN5bWJvbC5raW5kKSxcblx0XHRcdFx0XHRcdHN5bWJvbC5jb250YWluZXJOYW1lIHx8ICcnLFxuXHRcdFx0XHRcdFx0bmV3IHR5cGVzLkxvY2F0aW9uKGFwaUFyZ3NbMF0sIHR5cGVDb252ZXJ0ZXJzLlJhbmdlLnRvKHN5bWJvbC5yYW5nZSkpXG5cdFx0XHRcdFx0KTtcblx0XHRcdFx0XHRyZXMuZGV0YWlsID0gc3ltYm9sLmRldGFpbDtcblx0XHRcdFx0XHRyZXMucmFuZ2UgPSByZXMubG9jYXRpb24ucmFuZ2U7XG5cdFx0XHRcdFx0cmVzLnNlbGVjdGlvblJhbmdlID0gdHlwZUNvbnZlcnRlcnMuUmFuZ2UudG8oc3ltYm9sLnNlbGVjdGlvblJhbmdlKTtcblx0XHRcdFx0XHRyZXMuY2hpbGRyZW4gPSBzeW1ib2wuY2hpbGRyZW4gPyBzeW1ib2wuY2hpbGRyZW4ubWFwKE1lcmdlZEluZm8udG8pIDogW107XG5cdFx0XHRcdFx0cmV0dXJuIHJlcztcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGRldGFpbCE6IHN0cmluZztcblx0XHRcdFx0cmFuZ2UhOiB2c2NvZGUuUmFuZ2U7XG5cdFx0XHRcdHNlbGVjdGlvblJhbmdlITogdnNjb2RlLlJhbmdlO1xuXHRcdFx0XHRjaGlsZHJlbiE6IHZzY29kZS5Eb2N1bWVudFN5bWJvbFtdO1xuXHRcdFx0XHRvdmVycmlkZSBjb250YWluZXJOYW1lITogc3RyaW5nO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHZhbHVlLm1hcChNZXJnZWRJbmZvLnRvKTtcblxuXHRcdH0pXG5cdCksXG5cdC8vIC0tIGZvcm1hdHRpbmdcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlRm9ybWF0RG9jdW1lbnRQcm92aWRlcicsICdfZXhlY3V0ZUZvcm1hdERvY3VtZW50UHJvdmlkZXInLCAnRXhlY3V0ZSBkb2N1bWVudCBmb3JtYXQgcHJvdmlkZXIuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgbmV3IEFwaUNvbW1hbmRBcmd1bWVudCgnb3B0aW9ucycsICdGb3JtYXR0aW5nIG9wdGlvbnMnLCBfID0+IHRydWUsIHYgPT4gdildLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5UZXh0RWRpdFtdLCB0eXBlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgVGV4dEVkaXRzLicsIHRyeU1hcFdpdGgodHlwZUNvbnZlcnRlcnMuVGV4dEVkaXQudG8pKVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVGb3JtYXRSYW5nZVByb3ZpZGVyJywgJ19leGVjdXRlRm9ybWF0UmFuZ2VQcm92aWRlcicsICdFeGVjdXRlIHJhbmdlIGZvcm1hdCBwcm92aWRlci4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUmFuZ2UsIG5ldyBBcGlDb21tYW5kQXJndW1lbnQoJ29wdGlvbnMnLCAnRm9ybWF0dGluZyBvcHRpb25zJywgXyA9PiB0cnVlLCB2ID0+IHYpXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuVGV4dEVkaXRbXSwgdHlwZXMuVGV4dEVkaXRbXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIFRleHRFZGl0cy4nLCB0cnlNYXBXaXRoKHR5cGVDb252ZXJ0ZXJzLlRleHRFZGl0LnRvKSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlRm9ybWF0T25UeXBlUHJvdmlkZXInLCAnX2V4ZWN1dGVGb3JtYXRPblR5cGVQcm92aWRlcicsICdFeGVjdXRlIGZvcm1hdCBvbiB0eXBlIHByb3ZpZGVyLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbiwgbmV3IEFwaUNvbW1hbmRBcmd1bWVudCgnY2gnLCAnVHJpZ2dlciBjaGFyYWN0ZXInLCB2ID0+IHR5cGVvZiB2ID09PSAnc3RyaW5nJywgdiA9PiB2KSwgbmV3IEFwaUNvbW1hbmRBcmd1bWVudCgnb3B0aW9ucycsICdGb3JtYXR0aW5nIG9wdGlvbnMnLCBfID0+IHRydWUsIHYgPT4gdildLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5UZXh0RWRpdFtdLCB0eXBlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgVGV4dEVkaXRzLicsIHRyeU1hcFdpdGgodHlwZUNvbnZlcnRlcnMuVGV4dEVkaXQudG8pKVxuXHQpLFxuXHQvLyAtLSBnbyB0byBzeW1ib2wgKGRlZmluaXRpb24sIHR5cGUgZGVmaW5pdGlvbiwgZGVjbGFyYXRpb24sIGltcGwsIHJlZmVyZW5jZXMpXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZURlZmluaXRpb25Qcm92aWRlcicsICdfZXhlY3V0ZURlZmluaXRpb25Qcm92aWRlcicsICdFeGVjdXRlIGFsbCBkZWZpbml0aW9uIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PChsYW5ndWFnZXMuTG9jYXRpb24gfCBsYW5ndWFnZXMuTG9jYXRpb25MaW5rKVtdLCAodHlwZXMuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTG9jYXRpb24gb3IgTG9jYXRpb25MaW5rIGluc3RhbmNlcy4nLCBtYXBMb2NhdGlvbk9yTG9jYXRpb25MaW5rKVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4cGVyaW1lbnRhbC5leGVjdXRlRGVmaW5pdGlvblByb3ZpZGVyX3JlY3Vyc2l2ZScsICdfZXhlY3V0ZURlZmluaXRpb25Qcm92aWRlcl9yZWN1cnNpdmUnLCAnRXhlY3V0ZSBhbGwgZGVmaW5pdGlvbiBwcm92aWRlcnMuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDwobGFuZ3VhZ2VzLkxvY2F0aW9uIHwgbGFuZ3VhZ2VzLkxvY2F0aW9uTGluaylbXSwgKHR5cGVzLkxvY2F0aW9uIHwgdnNjb2RlLkxvY2F0aW9uTGluaylbXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIExvY2F0aW9uIG9yIExvY2F0aW9uTGluayBpbnN0YW5jZXMuJywgbWFwTG9jYXRpb25PckxvY2F0aW9uTGluaylcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcicsICdfZXhlY3V0ZVR5cGVEZWZpbml0aW9uUHJvdmlkZXInLCAnRXhlY3V0ZSBhbGwgdHlwZSBkZWZpbml0aW9uIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PChsYW5ndWFnZXMuTG9jYXRpb24gfCBsYW5ndWFnZXMuTG9jYXRpb25MaW5rKVtdLCAodHlwZXMuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTG9jYXRpb24gb3IgTG9jYXRpb25MaW5rIGluc3RhbmNlcy4nLCBtYXBMb2NhdGlvbk9yTG9jYXRpb25MaW5rKVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4cGVyaW1lbnRhbC5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcl9yZWN1cnNpdmUnLCAnX2V4ZWN1dGVUeXBlRGVmaW5pdGlvblByb3ZpZGVyX3JlY3Vyc2l2ZScsICdFeGVjdXRlIGFsbCB0eXBlIGRlZmluaXRpb24gcHJvdmlkZXJzLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbl0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8KGxhbmd1YWdlcy5Mb2NhdGlvbiB8IGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmspW10sICh0eXBlcy5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBMb2NhdGlvbiBvciBMb2NhdGlvbkxpbmsgaW5zdGFuY2VzLicsIG1hcExvY2F0aW9uT3JMb2NhdGlvbkxpbmspXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZURlY2xhcmF0aW9uUHJvdmlkZXInLCAnX2V4ZWN1dGVEZWNsYXJhdGlvblByb3ZpZGVyJywgJ0V4ZWN1dGUgYWxsIGRlY2xhcmF0aW9uIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PChsYW5ndWFnZXMuTG9jYXRpb24gfCBsYW5ndWFnZXMuTG9jYXRpb25MaW5rKVtdLCAodHlwZXMuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTG9jYXRpb24gb3IgTG9jYXRpb25MaW5rIGluc3RhbmNlcy4nLCBtYXBMb2NhdGlvbk9yTG9jYXRpb25MaW5rKVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4cGVyaW1lbnRhbC5leGVjdXRlRGVjbGFyYXRpb25Qcm92aWRlcl9yZWN1cnNpdmUnLCAnX2V4ZWN1dGVEZWNsYXJhdGlvblByb3ZpZGVyX3JlY3Vyc2l2ZScsICdFeGVjdXRlIGFsbCBkZWNsYXJhdGlvbiBwcm92aWRlcnMuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDwobGFuZ3VhZ2VzLkxvY2F0aW9uIHwgbGFuZ3VhZ2VzLkxvY2F0aW9uTGluaylbXSwgKHR5cGVzLkxvY2F0aW9uIHwgdnNjb2RlLkxvY2F0aW9uTGluaylbXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIExvY2F0aW9uIG9yIExvY2F0aW9uTGluayBpbnN0YW5jZXMuJywgbWFwTG9jYXRpb25PckxvY2F0aW9uTGluaylcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlSW1wbGVtZW50YXRpb25Qcm92aWRlcicsICdfZXhlY3V0ZUltcGxlbWVudGF0aW9uUHJvdmlkZXInLCAnRXhlY3V0ZSBhbGwgaW1wbGVtZW50YXRpb24gcHJvdmlkZXJzLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbl0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8KGxhbmd1YWdlcy5Mb2NhdGlvbiB8IGxhbmd1YWdlcy5Mb2NhdGlvbkxpbmspW10sICh0eXBlcy5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBMb2NhdGlvbiBvciBMb2NhdGlvbkxpbmsgaW5zdGFuY2VzLicsIG1hcExvY2F0aW9uT3JMb2NhdGlvbkxpbmspXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhwZXJpbWVudGFsLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyX3JlY3Vyc2l2ZScsICdfZXhlY3V0ZUltcGxlbWVudGF0aW9uUHJvdmlkZXJfcmVjdXJzaXZlJywgJ0V4ZWN1dGUgYWxsIGltcGxlbWVudGF0aW9uIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PChsYW5ndWFnZXMuTG9jYXRpb24gfCBsYW5ndWFnZXMuTG9jYXRpb25MaW5rKVtdLCAodHlwZXMuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTG9jYXRpb24gb3IgTG9jYXRpb25MaW5rIGluc3RhbmNlcy4nLCBtYXBMb2NhdGlvbk9yTG9jYXRpb25MaW5rKVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVSZWZlcmVuY2VQcm92aWRlcicsICdfZXhlY3V0ZVJlZmVyZW5jZVByb3ZpZGVyJywgJ0V4ZWN1dGUgYWxsIHJlZmVyZW5jZSBwcm92aWRlcnMuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuTG9jYXRpb25bXSwgdHlwZXMuTG9jYXRpb25bXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIExvY2F0aW9uLWluc3RhbmNlcy4nLCB0cnlNYXBXaXRoKHR5cGVDb252ZXJ0ZXJzLmxvY2F0aW9uLnRvKSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leHBlcmltZW50YWwuZXhlY3V0ZVJlZmVyZW5jZVByb3ZpZGVyJywgJ19leGVjdXRlUmVmZXJlbmNlUHJvdmlkZXJfcmVjdXJzaXZlJywgJ0V4ZWN1dGUgYWxsIHJlZmVyZW5jZSBwcm92aWRlcnMuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuTG9jYXRpb25bXSwgdHlwZXMuTG9jYXRpb25bXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIExvY2F0aW9uLWluc3RhbmNlcy4nLCB0cnlNYXBXaXRoKHR5cGVDb252ZXJ0ZXJzLmxvY2F0aW9uLnRvKSlcblx0KSxcblx0Ly8gLS0gaG92ZXJcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlSG92ZXJQcm92aWRlcicsICdfZXhlY3V0ZUhvdmVyUHJvdmlkZXInLCAnRXhlY3V0ZSBhbGwgaG92ZXIgcHJvdmlkZXJzLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbl0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8bGFuZ3VhZ2VzLkhvdmVyW10sIHR5cGVzLkhvdmVyW10gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBIb3Zlci1pbnN0YW5jZXMuJywgdHJ5TWFwV2l0aCh0eXBlQ29udmVydGVycy5Ib3Zlci50bykpXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhwZXJpbWVudGFsLmV4ZWN1dGVIb3ZlclByb3ZpZGVyX3JlY3Vyc2l2ZScsICdfZXhlY3V0ZUhvdmVyUHJvdmlkZXJfcmVjdXJzaXZlJywgJ0V4ZWN1dGUgYWxsIGhvdmVyIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5Ib3ZlcltdLCB0eXBlcy5Ib3ZlcltdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgSG92ZXItaW5zdGFuY2VzLicsIHRyeU1hcFdpdGgodHlwZUNvbnZlcnRlcnMuSG92ZXIudG8pKVxuXHQpLFxuXHQvLyAtLSBzZWxlY3Rpb24gcmFuZ2Vcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlU2VsZWN0aW9uUmFuZ2VQcm92aWRlcicsICdfZXhlY3V0ZVNlbGVjdGlvblJhbmdlUHJvdmlkZXInLCAnRXhlY3V0ZSBzZWxlY3Rpb24gcmFuZ2UgcHJvdmlkZXIuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgbmV3IEFwaUNvbW1hbmRBcmd1bWVudDx0eXBlcy5Qb3NpdGlvbltdLCBJUG9zaXRpb25bXT4oJ3Bvc2l0aW9uJywgJ0EgcG9zaXRpb24gaW4gYSB0ZXh0IGRvY3VtZW50JywgdiA9PiBBcnJheS5pc0FycmF5KHYpICYmIHYuZXZlcnkodiA9PiB0eXBlcy5Qb3NpdGlvbi5pc1Bvc2l0aW9uKHYpKSwgdiA9PiB2Lm1hcCh0eXBlQ29udmVydGVycy5Qb3NpdGlvbi5mcm9tKSldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PElSYW5nZVtdW10sIHR5cGVzLlNlbGVjdGlvblJhbmdlW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiByYW5nZXMuJywgcmVzdWx0ID0+IHtcblx0XHRcdHJldHVybiByZXN1bHQubWFwKHJhbmdlcyA9PiB7XG5cdFx0XHRcdGxldCBub2RlOiB0eXBlcy5TZWxlY3Rpb25SYW5nZSB8IHVuZGVmaW5lZDtcblx0XHRcdFx0Zm9yIChjb25zdCByYW5nZSBvZiByYW5nZXMucmV2ZXJzZSgpKSB7XG5cdFx0XHRcdFx0bm9kZSA9IG5ldyB0eXBlcy5TZWxlY3Rpb25SYW5nZSh0eXBlQ29udmVydGVycy5SYW5nZS50byhyYW5nZSksIG5vZGUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBub2RlITtcblx0XHRcdH0pO1xuXHRcdH0pXG5cdCksXG5cdC8vIC0tIHN5bWJvbCBzZWFyY2hcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlV29ya3NwYWNlU3ltYm9sUHJvdmlkZXInLCAnX2V4ZWN1dGVXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcicsICdFeGVjdXRlIGFsbCB3b3Jrc3BhY2Ugc3ltYm9sIHByb3ZpZGVycy4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuU3RyaW5nLndpdGgoJ3F1ZXJ5JywgJ1NlYXJjaCBzdHJpbmcnKV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8c2VhcmNoLklXb3Jrc3BhY2VTeW1ib2xbXSwgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb25bXT4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIFN5bWJvbEluZm9ybWF0aW9uLWluc3RhbmNlcy4nLCB2YWx1ZSA9PiB7XG5cdFx0XHRyZXR1cm4gdmFsdWUubWFwKHR5cGVDb252ZXJ0ZXJzLldvcmtzcGFjZVN5bWJvbC50byk7XG5cdFx0fSlcblx0KSxcblx0Ly8gLS0tIGNhbGwgaGllcmFyY2h5XG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUucHJlcGFyZUNhbGxIaWVyYXJjaHknLCAnX2V4ZWN1dGVQcmVwYXJlQ2FsbEhpZXJhcmNoeScsICdQcmVwYXJlIGNhbGwgaGllcmFyY2h5IGF0IGEgcG9zaXRpb24gaW5zaWRlIGEgZG9jdW1lbnQnLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuUG9zaXRpb25dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PElDYWxsSGllcmFyY2h5SXRlbUR0b1tdLCB0eXBlcy5DYWxsSGllcmFyY2h5SXRlbVtdPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgQ2FsbEhpZXJhcmNoeUl0ZW0taW5zdGFuY2VzJywgdiA9PiB2Lm1hcCh0eXBlQ29udmVydGVycy5DYWxsSGllcmFyY2h5SXRlbS50bykpXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUucHJvdmlkZUluY29taW5nQ2FsbHMnLCAnX2V4ZWN1dGVQcm92aWRlSW5jb21pbmdDYWxscycsICdDb21wdXRlIGluY29taW5nIGNhbGxzIGZvciBhbiBpdGVtJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LkNhbGxIaWVyYXJjaHlJdGVtXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxJSW5jb21pbmdDYWxsRHRvW10sIHR5cGVzLkNhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGxbXT4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIENhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGwtaW5zdGFuY2VzJywgdiA9PiB2Lm1hcCh0eXBlQ29udmVydGVycy5DYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsLnRvKSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcm92aWRlT3V0Z29pbmdDYWxscycsICdfZXhlY3V0ZVByb3ZpZGVPdXRnb2luZ0NhbGxzJywgJ0NvbXB1dGUgb3V0Z29pbmcgY2FsbHMgZm9yIGFuIGl0ZW0nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuQ2FsbEhpZXJhcmNoeUl0ZW1dLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PElPdXRnb2luZ0NhbGxEdG9bXSwgdHlwZXMuQ2FsbEhpZXJhcmNoeU91dGdvaW5nQ2FsbFtdPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgQ2FsbEhpZXJhcmNoeU91dGdvaW5nQ2FsbC1pbnN0YW5jZXMnLCB2ID0+IHYubWFwKHR5cGVDb252ZXJ0ZXJzLkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGwudG8pKVxuXHQpLFxuXHQvLyAtLS0gcmVuYW1lXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUucHJlcGFyZVJlbmFtZScsICdfZXhlY3V0ZVByZXBhcmVSZW5hbWUnLCAnRXhlY3V0ZSB0aGUgcHJlcGFyZVJlbmFtZSBvZiByZW5hbWUgcHJvdmlkZXIuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuUmVuYW1lTG9jYXRpb24sIHsgcmFuZ2U6IHR5cGVzLlJhbmdlOyBwbGFjZWhvbGRlcjogc3RyaW5nIH0gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIHJhbmdlIGFuZCBwbGFjZWhvbGRlciB0ZXh0LicsIHZhbHVlID0+IHtcblx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiB0eXBlQ29udmVydGVycy5SYW5nZS50byh2YWx1ZS5yYW5nZSksXG5cdFx0XHRcdHBsYWNlaG9sZGVyOiB2YWx1ZS50ZXh0XG5cdFx0XHR9O1xuXHRcdH0pXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZURvY3VtZW50UmVuYW1lUHJvdmlkZXInLCAnX2V4ZWN1dGVEb2N1bWVudFJlbmFtZVByb3ZpZGVyJywgJ0V4ZWN1dGUgcmVuYW1lIHByb3ZpZGVyLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbiwgQXBpQ29tbWFuZEFyZ3VtZW50LlN0cmluZy53aXRoKCduZXdOYW1lJywgJ1RoZSBuZXcgc3ltYm9sIG5hbWUnKV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8SVdvcmtzcGFjZUVkaXREdG8gJiB7IHJlamVjdFJlYXNvbj86IHN0cmluZyB9LCB0eXBlcy5Xb3Jrc3BhY2VFZGl0IHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYSBXb3Jrc3BhY2VFZGl0LicsIHZhbHVlID0+IHtcblx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGlmICh2YWx1ZS5yZWplY3RSZWFzb24pIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKHZhbHVlLnJlamVjdFJlYXNvbik7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHlwZUNvbnZlcnRlcnMuV29ya3NwYWNlRWRpdC50byh2YWx1ZSk7XG5cdFx0fSlcblx0KSxcblx0Ly8gLS0tIGxpbmtzXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZUxpbmtQcm92aWRlcicsICdfZXhlY3V0ZUxpbmtQcm92aWRlcicsICdFeGVjdXRlIGRvY3VtZW50IGxpbmsgcHJvdmlkZXIuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50Lk51bWJlci53aXRoKCdsaW5rUmVzb2x2ZUNvdW50JywgJ051bWJlciBvZiBsaW5rcyB0aGF0IHNob3VsZCBiZSByZXNvbHZlZCwgb25seSB3aGVuIGxpbmtzIGFyZSB1bnJlc29sdmVkLicpLm9wdGlvbmFsKCldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5JTGlua1tdLCB2c2NvZGUuRG9jdW1lbnRMaW5rW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBEb2N1bWVudExpbmstaW5zdGFuY2VzLicsIHZhbHVlID0+IHZhbHVlLm1hcCh0eXBlQ29udmVydGVycy5Eb2N1bWVudExpbmsudG8pKVxuXHQpLFxuXHQvLyAtLS0gc2VtYW50aWMgdG9rZW5zXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUucHJvdmlkZURvY3VtZW50U2VtYW50aWNUb2tlbnNMZWdlbmQnLCAnX3Byb3ZpZGVEb2N1bWVudFNlbWFudGljVG9rZW5zTGVnZW5kJywgJ1Byb3ZpZGUgc2VtYW50aWMgdG9rZW5zIGxlZ2VuZCBmb3IgYSBkb2N1bWVudCcsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5TZW1hbnRpY1Rva2Vuc0xlZ2VuZCwgdHlwZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQgfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBTZW1hbnRpY1Rva2Vuc0xlZ2VuZC4nLCB2YWx1ZSA9PiB7XG5cdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlNlbWFudGljVG9rZW5zTGVnZW5kKHZhbHVlLnRva2VuVHlwZXMsIHZhbHVlLnRva2VuTW9kaWZpZXJzKTtcblx0XHR9KVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLnByb3ZpZGVEb2N1bWVudFNlbWFudGljVG9rZW5zJywgJ19wcm92aWRlRG9jdW1lbnRTZW1hbnRpY1Rva2VucycsICdQcm92aWRlIHNlbWFudGljIHRva2VucyBmb3IgYSBkb2N1bWVudCcsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PFZTQnVmZmVyLCB0eXBlcy5TZW1hbnRpY1Rva2VucyB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIFNlbWFudGljVG9rZW5zLicsIHZhbHVlID0+IHtcblx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHNlbWFudGljVG9rZW5zRHRvID0gZGVjb2RlU2VtYW50aWNUb2tlbnNEdG8odmFsdWUpO1xuXHRcdFx0aWYgKHNlbWFudGljVG9rZW5zRHRvLnR5cGUgIT09ICdmdWxsJykge1xuXHRcdFx0XHQvLyBvbmx5IGFjY2VwdGluZyBmdWxsIHNlbWFudGljIHRva2VucyBmcm9tIHByb3ZpZGVEb2N1bWVudFNlbWFudGljVG9rZW5zXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlNlbWFudGljVG9rZW5zKHNlbWFudGljVG9rZW5zRHRvLmRhdGEsIHVuZGVmaW5lZCk7XG5cdFx0fSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zTGVnZW5kJywgJ19wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zTGVnZW5kJywgJ1Byb3ZpZGUgc2VtYW50aWMgdG9rZW5zIGxlZ2VuZCBmb3IgYSBkb2N1bWVudCByYW5nZScsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5SYW5nZS5vcHRpb25hbCgpXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuU2VtYW50aWNUb2tlbnNMZWdlbmQsIHR5cGVzLlNlbWFudGljVG9rZW5zTGVnZW5kIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gU2VtYW50aWNUb2tlbnNMZWdlbmQuJywgdmFsdWUgPT4ge1xuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5TZW1hbnRpY1Rva2Vuc0xlZ2VuZCh2YWx1ZS50b2tlblR5cGVzLCB2YWx1ZS50b2tlbk1vZGlmaWVycyk7XG5cdFx0fSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zJywgJ19wcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zJywgJ1Byb3ZpZGUgc2VtYW50aWMgdG9rZW5zIGZvciBhIGRvY3VtZW50IHJhbmdlJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlJhbmdlXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxWU0J1ZmZlciwgdHlwZXMuU2VtYW50aWNUb2tlbnMgfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBTZW1hbnRpY1Rva2Vucy4nLCB2YWx1ZSA9PiB7XG5cdFx0XHRpZiAoIXZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBzZW1hbnRpY1Rva2Vuc0R0byA9IGRlY29kZVNlbWFudGljVG9rZW5zRHRvKHZhbHVlKTtcblx0XHRcdGlmIChzZW1hbnRpY1Rva2Vuc0R0by50eXBlICE9PSAnZnVsbCcpIHtcblx0XHRcdFx0Ly8gb25seSBhY2NlcHRpbmcgZnVsbCBzZW1hbnRpYyB0b2tlbnMgZnJvbSBwcm92aWRlRG9jdW1lbnRSYW5nZVNlbWFudGljVG9rZW5zXG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLlNlbWFudGljVG9rZW5zKHNlbWFudGljVG9rZW5zRHRvLmRhdGEsIHVuZGVmaW5lZCk7XG5cdFx0fSlcblx0KSxcblx0Ly8gLS0tIGNvbXBsZXRpb25zXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLCAnX2V4ZWN1dGVDb21wbGV0aW9uSXRlbVByb3ZpZGVyJywgJ0V4ZWN1dGUgY29tcGxldGlvbiBpdGVtIHByb3ZpZGVyLicsXG5cdFx0W1xuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlVyaSxcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbixcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5TdHJpbmcud2l0aCgndHJpZ2dlckNoYXJhY3RlcicsICdUcmlnZ2VyIGNvbXBsZXRpb24gd2hlbiB0aGUgdXNlciB0eXBlcyB0aGUgY2hhcmFjdGVyLCBsaWtlIGAsYCBvciBgKGAnKS5vcHRpb25hbCgpLFxuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50Lk51bWJlci53aXRoKCdpdGVtUmVzb2x2ZUNvdW50JywgJ051bWJlciBvZiBjb21wbGV0aW9ucyB0byByZXNvbHZlICh0b28gbGFyZ2UgbnVtYmVycyBzbG93IGRvd24gY29tcGxldGlvbnMpJykub3B0aW9uYWwoKVxuXHRcdF0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8bGFuZ3VhZ2VzLkNvbXBsZXRpb25MaXN0LCB2c2NvZGUuQ29tcGxldGlvbkxpc3Q+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhIENvbXBsZXRpb25MaXN0LWluc3RhbmNlLicsICh2YWx1ZSwgX2FyZ3MsIGNvbnZlcnRlcikgPT4ge1xuXHRcdFx0aWYgKCF2YWx1ZSkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbXBsZXRpb25MaXN0KFtdKTtcblx0XHRcdH1cblx0XHRcdGNvbnN0IGl0ZW1zID0gdmFsdWUuc3VnZ2VzdGlvbnMubWFwKHN1Z2dlc3Rpb24gPT4gdHlwZUNvbnZlcnRlcnMuQ29tcGxldGlvbkl0ZW0udG8oc3VnZ2VzdGlvbiwgY29udmVydGVyKSk7XG5cdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbXBsZXRpb25MaXN0KGl0ZW1zLCB2YWx1ZS5pbmNvbXBsZXRlKTtcblx0XHR9KVxuXHQpLFxuXHQvLyAtLS0gc2lnbmF0dXJlIGhlbHBcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlU2lnbmF0dXJlSGVscFByb3ZpZGVyJywgJ19leGVjdXRlU2lnbmF0dXJlSGVscFByb3ZpZGVyJywgJ0V4ZWN1dGUgc2lnbmF0dXJlIGhlbHAgcHJvdmlkZXIuJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaSwgQXBpQ29tbWFuZEFyZ3VtZW50LlBvc2l0aW9uLCBBcGlDb21tYW5kQXJndW1lbnQuU3RyaW5nLndpdGgoJ3RyaWdnZXJDaGFyYWN0ZXInLCAnVHJpZ2dlciBzaWduYXR1cmUgaGVscCB3aGVuIHRoZSB1c2VyIHR5cGVzIHRoZSBjaGFyYWN0ZXIsIGxpa2UgYCxgIG9yIGAoYCcpLm9wdGlvbmFsKCldLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwLCB2c2NvZGUuU2lnbmF0dXJlSGVscCB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIFNpZ25hdHVyZUhlbHAuJywgdmFsdWUgPT4ge1xuXHRcdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHRcdHJldHVybiB0eXBlQ29udmVydGVycy5TaWduYXR1cmVIZWxwLnRvKHZhbHVlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSlcblx0KSxcblx0Ly8gLS0tIGNvZGUgbGVuc1xuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVDb2RlTGVuc1Byb3ZpZGVyJywgJ19leGVjdXRlQ29kZUxlbnNQcm92aWRlcicsICdFeGVjdXRlIGNvZGUgbGVucyBwcm92aWRlci4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLCBBcGlDb21tYW5kQXJndW1lbnQuTnVtYmVyLndpdGgoJ2l0ZW1SZXNvbHZlQ291bnQnLCAnTnVtYmVyIG9mIGxlbnNlcyB0aGF0IHNob3VsZCBiZSByZXNvbHZlZCBhbmQgcmV0dXJuZWQuIFdpbGwgb25seSByZXR1cm4gcmVzb2x2ZWQgbGVuc2VzLCB3aWxsIGltcGFjdCBwZXJmb3JtYW5jZSknKS5vcHRpb25hbCgpXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuQ29kZUxlbnNbXSwgdnNjb2RlLkNvZGVMZW5zW10gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBDb2RlTGVucy1pbnN0YW5jZXMuJywgKHZhbHVlLCBfYXJncywgY29udmVydGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gdHJ5TWFwV2l0aDxsYW5ndWFnZXMuQ29kZUxlbnMsIHZzY29kZS5Db2RlTGVucz4oaXRlbSA9PiB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuQ29kZUxlbnModHlwZUNvbnZlcnRlcnMuUmFuZ2UudG8oaXRlbS5yYW5nZSksIGl0ZW0uY29tbWFuZCAmJiBjb252ZXJ0ZXIuZnJvbUludGVybmFsKGl0ZW0uY29tbWFuZCkpO1xuXHRcdFx0fSkodmFsdWUpO1xuXHRcdH0pXG5cdCksXG5cdC8vIC0tLSBjb2RlIGFjdGlvbnNcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgJ19leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgJ0V4ZWN1dGUgY29kZSBhY3Rpb24gcHJvdmlkZXIuJyxcblx0XHRbXG5cdFx0XHRBcGlDb21tYW5kQXJndW1lbnQuVXJpLFxuXHRcdFx0bmV3IEFwaUNvbW1hbmRBcmd1bWVudCgncmFuZ2VPclNlbGVjdGlvbicsICdSYW5nZSBpbiBhIHRleHQgZG9jdW1lbnQuIFNvbWUgcmVmYWN0b3JpbmcgcHJvdmlkZXIgcmVxdWlyZXMgU2VsZWN0aW9uIG9iamVjdC4nLCB2ID0+IHR5cGVzLlJhbmdlLmlzUmFuZ2UodiksIHYgPT4gdHlwZXMuU2VsZWN0aW9uLmlzU2VsZWN0aW9uKHYpID8gdHlwZUNvbnZlcnRlcnMuU2VsZWN0aW9uLmZyb20odikgOiB0eXBlQ29udmVydGVycy5SYW5nZS5mcm9tKHYpKSxcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5TdHJpbmcud2l0aCgna2luZCcsICdDb2RlIGFjdGlvbiBraW5kIHRvIHJldHVybiBjb2RlIGFjdGlvbnMgZm9yJykub3B0aW9uYWwoKSxcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5OdW1iZXIud2l0aCgnaXRlbVJlc29sdmVDb3VudCcsICdOdW1iZXIgb2YgY29kZSBhY3Rpb25zIHRvIHJlc29sdmUgKHRvbyBsYXJnZSBudW1iZXJzIHNsb3cgZG93biBjb2RlIGFjdGlvbnMpJykub3B0aW9uYWwoKVxuXHRcdF0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8Q3VzdG9tQ29kZUFjdGlvbltdLCAodnNjb2RlLkNvZGVBY3Rpb24gfCB2c2NvZGUuQ29tbWFuZCB8IHVuZGVmaW5lZClbXSB8IHVuZGVmaW5lZD4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIENvbW1hbmQtaW5zdGFuY2VzLicsICh2YWx1ZSwgX2FyZ3MsIGNvbnZlcnRlcikgPT4ge1xuXHRcdFx0cmV0dXJuIHRyeU1hcFdpdGg8Q3VzdG9tQ29kZUFjdGlvbiwgdnNjb2RlLkNvZGVBY3Rpb24gfCB2c2NvZGUuQ29tbWFuZCB8IHVuZGVmaW5lZD4oKGNvZGVBY3Rpb24pID0+IHtcblx0XHRcdFx0aWYgKGNvZGVBY3Rpb24uX2lzU3ludGhldGljKSB7XG5cdFx0XHRcdFx0aWYgKCFjb2RlQWN0aW9uLmNvbW1hbmQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignU3ludGhldGljIGNvZGUgYWN0aW9ucyBtdXN0IGhhdmUgYSBjb21tYW5kJyk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdHJldHVybiBjb252ZXJ0ZXIuZnJvbUludGVybmFsKGNvZGVBY3Rpb24uY29tbWFuZCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgcmV0ID0gbmV3IHR5cGVzLkNvZGVBY3Rpb24oXG5cdFx0XHRcdFx0XHRjb2RlQWN0aW9uLnRpdGxlLFxuXHRcdFx0XHRcdFx0Y29kZUFjdGlvbi5raW5kID8gbmV3IHR5cGVzLkNvZGVBY3Rpb25LaW5kKGNvZGVBY3Rpb24ua2luZCkgOiB1bmRlZmluZWRcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHRcdGlmIChjb2RlQWN0aW9uLmVkaXQpIHtcblx0XHRcdFx0XHRcdHJldC5lZGl0ID0gdHlwZUNvbnZlcnRlcnMuV29ya3NwYWNlRWRpdC50byhjb2RlQWN0aW9uLmVkaXQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRpZiAoY29kZUFjdGlvbi5jb21tYW5kKSB7XG5cdFx0XHRcdFx0XHRyZXQuY29tbWFuZCA9IGNvbnZlcnRlci5mcm9tSW50ZXJuYWwoY29kZUFjdGlvbi5jb21tYW5kKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0cmV0LmlzUHJlZmVycmVkID0gY29kZUFjdGlvbi5pc1ByZWZlcnJlZDtcblx0XHRcdFx0XHRyZXR1cm4gcmV0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KSh2YWx1ZSk7XG5cdFx0fSlcblx0KSxcblx0Ly8gLS0tIGNvbG9yc1xuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVEb2N1bWVudENvbG9yUHJvdmlkZXInLCAnX2V4ZWN1dGVEb2N1bWVudENvbG9yUHJvdmlkZXInLCAnRXhlY3V0ZSBkb2N1bWVudCBjb2xvciBwcm92aWRlci4nLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpXSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxJUmF3Q29sb3JJbmZvW10sIHZzY29kZS5Db2xvckluZm9ybWF0aW9uW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBDb2xvckluZm9ybWF0aW9uIG9iamVjdHMuJywgcmVzdWx0ID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdC5tYXAoY2kgPT4gbmV3IHR5cGVzLkNvbG9ySW5mb3JtYXRpb24odHlwZUNvbnZlcnRlcnMuUmFuZ2UudG8oY2kucmFuZ2UpLCB0eXBlQ29udmVydGVycy5Db2xvci50byhjaS5jb2xvcikpKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBbXTtcblx0XHR9KVxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVDb2xvclByZXNlbnRhdGlvblByb3ZpZGVyJywgJ19leGVjdXRlQ29sb3JQcmVzZW50YXRpb25Qcm92aWRlcicsICdFeGVjdXRlIGNvbG9yIHByZXNlbnRhdGlvbiBwcm92aWRlci4nLFxuXHRcdFtcblx0XHRcdG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8dHlwZXMuQ29sb3IsIFtudW1iZXIsIG51bWJlciwgbnVtYmVyLCBudW1iZXJdPignY29sb3InLCAnVGhlIGNvbG9yIHRvIHNob3cgYW5kIGluc2VydCcsIHYgPT4gdiBpbnN0YW5jZW9mIHR5cGVzLkNvbG9yLCB0eXBlQ29udmVydGVycy5Db2xvci5mcm9tKSxcblx0XHRcdG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8eyB1cmk6IFVSSTsgcmFuZ2U6IHR5cGVzLlJhbmdlIH0sIHsgdXJpOiBVUkk7IHJhbmdlOiBJUmFuZ2UgfT4oJ2NvbnRleHQnLCAnQ29udGV4dCBvYmplY3Qgd2l0aCB1cmkgYW5kIHJhbmdlJywgX3YgPT4gdHJ1ZSwgdiA9PiAoeyB1cmk6IHYudXJpLCByYW5nZTogdHlwZUNvbnZlcnRlcnMuUmFuZ2UuZnJvbSh2LnJhbmdlKSB9KSksXG5cdFx0XSxcblx0XHRuZXcgQXBpQ29tbWFuZFJlc3VsdDxsYW5ndWFnZXMuSUNvbG9yUHJlc2VudGF0aW9uW10sIHR5cGVzLkNvbG9yUHJlc2VudGF0aW9uW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBDb2xvclByZXNlbnRhdGlvbiBvYmplY3RzLicsIHJlc3VsdCA9PiB7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdHJldHVybiByZXN1bHQubWFwKHR5cGVDb252ZXJ0ZXJzLkNvbG9yUHJlc2VudGF0aW9uLnRvKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBbXTtcblx0XHR9KVxuXHQpLFxuXHQvLyAtLS0gaW5saW5lIGhpbnRzXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZUlubGF5SGludFByb3ZpZGVyJywgJ19leGVjdXRlSW5sYXlIaW50UHJvdmlkZXInLCAnRXhlY3V0ZSBpbmxheSBoaW50cyBwcm92aWRlcicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5SYW5nZV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8bGFuZ3VhZ2VzLklubGF5SGludFtdLCB2c2NvZGUuSW5sYXlIaW50W10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBJbmxheSBvYmplY3RzJywgKHJlc3VsdCwgYXJncywgY29udmVydGVyKSA9PiB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0Lm1hcCh0eXBlQ29udmVydGVycy5JbmxheUhpbnQudG8uYmluZCh1bmRlZmluZWQsIGNvbnZlcnRlcikpO1xuXHRcdH0pXG5cdCksXG5cdC8vIC0tLSBmb2xkaW5nXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUuZXhlY3V0ZUZvbGRpbmdSYW5nZVByb3ZpZGVyJywgJ19leGVjdXRlRm9sZGluZ1JhbmdlUHJvdmlkZXInLCAnRXhlY3V0ZSBmb2xkaW5nIHJhbmdlIHByb3ZpZGVyJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlVyaV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8bGFuZ3VhZ2VzLkZvbGRpbmdSYW5nZVtdIHwgdW5kZWZpbmVkLCB2c2NvZGUuRm9sZGluZ1JhbmdlW10gfCB1bmRlZmluZWQ+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBGb2xkaW5nUmFuZ2Ugb2JqZWN0cycsIChyZXN1bHQsIGFyZ3MpID0+IHtcblx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc3VsdC5tYXAodHlwZUNvbnZlcnRlcnMuRm9sZGluZ1JhbmdlLnRvKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fSlcblx0KSxcblxuXHQvLyAtLS0gbm90ZWJvb2tzXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUucmVzb2x2ZU5vdGVib29rQ29udGVudFByb3ZpZGVycycsICdfcmVzb2x2ZU5vdGVib29rQ29udGVudFByb3ZpZGVyJywgJ1Jlc29sdmUgTm90ZWJvb2sgQ29udGVudCBQcm92aWRlcnMnLFxuXHRcdFtcblx0XHRcdC8vIG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8c3RyaW5nLCBzdHJpbmc+KCd2aWV3VHlwZScsICcnLCB2ID0+IHR5cGVvZiB2ID09PSAnc3RyaW5nJywgdiA9PiB2KSxcblx0XHRcdC8vIG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8c3RyaW5nLCBzdHJpbmc+KCdkaXNwbGF5TmFtZScsICcnLCB2ID0+IHR5cGVvZiB2ID09PSAnc3RyaW5nJywgdiA9PiB2KSxcblx0XHRcdC8vIG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8b2JqZWN0LCBvYmplY3Q+KCdvcHRpb25zJywgJycsIHYgPT4gdHlwZW9mIHYgPT09ICdvYmplY3QnLCB2ID0+IHYpLFxuXHRcdF0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8e1xuXHRcdFx0dmlld1R5cGU6IHN0cmluZztcblx0XHRcdGRpc3BsYXlOYW1lOiBzdHJpbmc7XG5cdFx0XHRvcHRpb25zOiB7IHRyYW5zaWVudE91dHB1dHM6IGJvb2xlYW47IHRyYW5zaWVudENlbGxNZXRhZGF0YTogVHJhbnNpZW50Q2VsbE1ldGFkYXRhOyB0cmFuc2llbnREb2N1bWVudE1ldGFkYXRhOiBUcmFuc2llbnREb2N1bWVudE1ldGFkYXRhIH07XG5cdFx0XHRmaWxlbmFtZVBhdHRlcm46ICh2c2NvZGUuR2xvYlBhdHRlcm4gfCB7IGluY2x1ZGU6IHZzY29kZS5HbG9iUGF0dGVybjsgZXhjbHVkZTogdnNjb2RlLkdsb2JQYXR0ZXJuIH0pW107XG5cdFx0fVtdLCB7XG5cdFx0XHR2aWV3VHlwZTogc3RyaW5nO1xuXHRcdFx0ZGlzcGxheU5hbWU6IHN0cmluZztcblx0XHRcdGZpbGVuYW1lUGF0dGVybjogKHZzY29kZS5HbG9iUGF0dGVybiB8IHsgaW5jbHVkZTogdnNjb2RlLkdsb2JQYXR0ZXJuOyBleGNsdWRlOiB2c2NvZGUuR2xvYlBhdHRlcm4gfSlbXTtcblx0XHRcdG9wdGlvbnM6IHZzY29kZS5Ob3RlYm9va0RvY3VtZW50Q29udGVudE9wdGlvbnM7XG5cdFx0fVtdIHwgdW5kZWZpbmVkPignQSBwcm9taXNlIHRoYXQgcmVzb2x2ZXMgdG8gYW4gYXJyYXkgb2YgTm90ZWJvb2tDb250ZW50UHJvdmlkZXIgc3RhdGljIGluZm8gb2JqZWN0cy4nLCB0cnlNYXBXaXRoKGl0ZW0gPT4ge1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0dmlld1R5cGU6IGl0ZW0udmlld1R5cGUsXG5cdFx0XHRcdGRpc3BsYXlOYW1lOiBpdGVtLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0dHJhbnNpZW50T3V0cHV0czogaXRlbS5vcHRpb25zLnRyYW5zaWVudE91dHB1dHMsXG5cdFx0XHRcdFx0dHJhbnNpZW50Q2VsbE1ldGFkYXRhOiBpdGVtLm9wdGlvbnMudHJhbnNpZW50Q2VsbE1ldGFkYXRhLFxuXHRcdFx0XHRcdHRyYW5zaWVudERvY3VtZW50TWV0YWRhdGE6IGl0ZW0ub3B0aW9ucy50cmFuc2llbnREb2N1bWVudE1ldGFkYXRhXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGZpbGVuYW1lUGF0dGVybjogaXRlbS5maWxlbmFtZVBhdHRlcm4ubWFwKHBhdHRlcm4gPT4gdHlwZUNvbnZlcnRlcnMuTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudFBhdHRlcm4udG8ocGF0dGVybikpXG5cdFx0XHR9O1xuXHRcdH0pKVxuXHQpLFxuXHQvLyAtLS0gZGVidWcgc3VwcG9ydFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmV4ZWN1dGVJbmxpbmVWYWx1ZVByb3ZpZGVyJywgJ19leGVjdXRlSW5saW5lVmFsdWVQcm92aWRlcicsICdFeGVjdXRlIGlubGluZSB2YWx1ZSBwcm92aWRlcicsXG5cdFx0W1xuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlVyaSxcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5SYW5nZSxcblx0XHRcdG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8dHlwZXMuSW5saW5lVmFsdWVDb250ZXh0LCBJSW5saW5lVmFsdWVDb250ZXh0RHRvPignY29udGV4dCcsICdBbiBJbmxpbmVWYWx1ZUNvbnRleHQnLCB2ID0+IHYgJiYgdHlwZW9mIHYuZnJhbWVJZCA9PT0gJ251bWJlcicgJiYgdi5zdG9wcGVkTG9jYXRpb24gaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSwgdiA9PiB0eXBlQ29udmVydGVycy5JbmxpbmVWYWx1ZUNvbnRleHQuZnJvbSh2KSlcblx0XHRdLFxuXHRcdG5ldyBBcGlDb21tYW5kUmVzdWx0PGxhbmd1YWdlcy5JbmxpbmVWYWx1ZVtdLCB2c2NvZGUuSW5saW5lVmFsdWVbXT4oJ0EgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHRvIGFuIGFycmF5IG9mIElubGluZVZhbHVlIG9iamVjdHMnLCByZXN1bHQgPT4ge1xuXHRcdFx0cmV0dXJuIHJlc3VsdC5tYXAodHlwZUNvbnZlcnRlcnMuSW5saW5lVmFsdWUudG8pO1xuXHRcdH0pXG5cdCksXG5cdC8vIC0tLSBvcGVuJ2lzaCBjb21tYW5kc1xuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLm9wZW4nLCAnX3dvcmtiZW5jaC5vcGVuJywgJ09wZW5zIHRoZSBwcm92aWRlZCByZXNvdXJjZSBpbiB0aGUgZWRpdG9yLiBDYW4gYmUgYSB0ZXh0IG9yIGJpbmFyeSBmaWxlLCBvciBhbiBodHRwKHMpIFVSTC4gSWYgeW91IG5lZWQgbW9yZSBjb250cm9sIG92ZXIgdGhlIG9wdGlvbnMgZm9yIG9wZW5pbmcgYSB0ZXh0IGZpbGUsIHVzZSB2c2NvZGUud2luZG93LnNob3dUZXh0RG9jdW1lbnQgaW5zdGVhZC4nLFxuXHRcdFtcblx0XHRcdG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8VVJJIHwgc3RyaW5nPigndXJpT3JTdHJpbmcnLCAnVXJpLWluc3RhbmNlIG9yIHN0cmluZyAob25seSBodHRwL2h0dHBzKScsIHYgPT4gVVJJLmlzVXJpKHYpIHx8ICh0eXBlb2YgdiA9PT0gJ3N0cmluZycgJiYgbWF0Y2hlc1NvbWVTY2hlbWUodiwgU2NoZW1hcy5odHRwLCBTY2hlbWFzLmh0dHBzKSksIHYgPT4gdiksXG5cdFx0XHRuZXcgQXBpQ29tbWFuZEFyZ3VtZW50PHZzY29kZS5WaWV3Q29sdW1uIHwgdHlwZUNvbnZlcnRlcnMuVGV4dEVkaXRvck9wZW5PcHRpb25zIHwgdW5kZWZpbmVkLCBbdnNjb2RlLlZpZXdDb2x1bW4/LCBJVGV4dEVkaXRvck9wdGlvbnM/XSB8IHVuZGVmaW5lZD4oJ2NvbHVtbk9yT3B0aW9ucycsICdFaXRoZXIgdGhlIGNvbHVtbiBpbiB3aGljaCB0byBvcGVuIG9yIGVkaXRvciBvcHRpb25zLCBzZWUgdnNjb2RlLlRleHREb2N1bWVudFNob3dPcHRpb25zJyxcblx0XHRcdFx0diA9PiB2ID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHYgPT09ICdudW1iZXInIHx8IHR5cGVvZiB2ID09PSAnb2JqZWN0Jyxcblx0XHRcdFx0diA9PiAhdiA/IHYgOiB0eXBlb2YgdiA9PT0gJ251bWJlcicgPyBbdHlwZUNvbnZlcnRlcnMuVmlld0NvbHVtbi5mcm9tKHYpLCB1bmRlZmluZWRdIDogW3R5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4uZnJvbSh2LnZpZXdDb2x1bW4pLCB0eXBlQ29udmVydGVycy5UZXh0RWRpdG9yT3Blbk9wdGlvbnMuZnJvbSh2KV1cblx0XHRcdCkub3B0aW9uYWwoKSxcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5TdHJpbmcud2l0aCgnbGFiZWwnLCAnJykub3B0aW9uYWwoKVxuXHRcdF0sXG5cdFx0QXBpQ29tbWFuZFJlc3VsdC5Wb2lkXG5cdCksXG5cdG5ldyBBcGlDb21tYW5kKFxuXHRcdCd2c2NvZGUub3BlbldpdGgnLCAnX3dvcmtiZW5jaC5vcGVuV2l0aCcsICdPcGVucyB0aGUgcHJvdmlkZWQgcmVzb3VyY2Ugd2l0aCBhIHNwZWNpZmljIGVkaXRvci4nLFxuXHRcdFtcblx0XHRcdEFwaUNvbW1hbmRBcmd1bWVudC5Vcmkud2l0aCgncmVzb3VyY2UnLCAnUmVzb3VyY2UgdG8gb3BlbicpLFxuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlN0cmluZy53aXRoKCd2aWV3SWQnLCAnQ3VzdG9tIGVkaXRvciB2aWV3IGlkLiBUaGlzIHNob3VsZCBiZSB0aGUgdmlld1R5cGUgc3RyaW5nIGZvciBjdXN0b20gZWRpdG9ycyBvciB0aGUgbm90ZWJvb2tUeXBlIHN0cmluZyBmb3Igbm90ZWJvb2tzLiBVc2UgXFwnZGVmYXVsdFxcJyB0byB1c2UgVlMgQ29kZVxcJ3MgZGVmYXVsdCB0ZXh0IGVkaXRvcicpLFxuXHRcdFx0bmV3IEFwaUNvbW1hbmRBcmd1bWVudDx2c2NvZGUuVmlld0NvbHVtbiB8IHR5cGVDb252ZXJ0ZXJzLlRleHRFZGl0b3JPcGVuT3B0aW9ucyB8IHVuZGVmaW5lZCwgW3ZzY29kZS5WaWV3Q29sdW1uPywgSVRleHRFZGl0b3JPcHRpb25zP10gfCB1bmRlZmluZWQ+KCdjb2x1bW5Pck9wdGlvbnMnLCAnRWl0aGVyIHRoZSBjb2x1bW4gaW4gd2hpY2ggdG8gb3BlbiBvciBlZGl0b3Igb3B0aW9ucywgc2VlIHZzY29kZS5UZXh0RG9jdW1lbnRTaG93T3B0aW9ucycsXG5cdFx0XHRcdHYgPT4gdiA9PT0gdW5kZWZpbmVkIHx8IHR5cGVvZiB2ID09PSAnbnVtYmVyJyB8fCB0eXBlb2YgdiA9PT0gJ29iamVjdCcsXG5cdFx0XHRcdHYgPT4gIXYgPyB2IDogdHlwZW9mIHYgPT09ICdudW1iZXInID8gW3R5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4uZnJvbSh2KSwgdW5kZWZpbmVkXSA6IFt0eXBlQ29udmVydGVycy5WaWV3Q29sdW1uLmZyb20odi52aWV3Q29sdW1uKSwgdHlwZUNvbnZlcnRlcnMuVGV4dEVkaXRvck9wZW5PcHRpb25zLmZyb20odildLFxuXHRcdFx0KS5vcHRpb25hbCgpXG5cdFx0XSxcblx0XHRBcGlDb21tYW5kUmVzdWx0LlZvaWRcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5kaWZmJywgJ193b3JrYmVuY2guZGlmZicsICdPcGVucyB0aGUgcHJvdmlkZWQgcmVzb3VyY2VzIGluIHRoZSBkaWZmIGVkaXRvciB0byBjb21wYXJlIHRoZWlyIGNvbnRlbnRzLicsXG5cdFx0W1xuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlVyaS53aXRoKCdsZWZ0JywgJ0xlZnQtaGFuZCBzaWRlIHJlc291cmNlIG9mIHRoZSBkaWZmIGVkaXRvcicpLFxuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlVyaS53aXRoKCdyaWdodCcsICdSaWdodC1oYW5kIHNpZGUgcmVzb3VyY2Ugb2YgdGhlIGRpZmYgZWRpdG9yJyksXG5cdFx0XHRBcGlDb21tYW5kQXJndW1lbnQuU3RyaW5nLndpdGgoJ3RpdGxlJywgJ0h1bWFuIHJlYWRhYmxlIHRpdGxlIGZvciB0aGUgZGlmZiBlZGl0b3InKS5vcHRpb25hbCgpLFxuXHRcdFx0bmV3IEFwaUNvbW1hbmRBcmd1bWVudDx0eXBlQ29udmVydGVycy5UZXh0RWRpdG9yT3Blbk9wdGlvbnMgfCB1bmRlZmluZWQsIFtudW1iZXI/LCBJVGV4dEVkaXRvck9wdGlvbnM/XSB8IHVuZGVmaW5lZD4oJ2NvbHVtbk9yT3B0aW9ucycsICdFaXRoZXIgdGhlIGNvbHVtbiBpbiB3aGljaCB0byBvcGVuIG9yIGVkaXRvciBvcHRpb25zLCBzZWUgdnNjb2RlLlRleHREb2N1bWVudFNob3dPcHRpb25zJyxcblx0XHRcdFx0diA9PiB2ID09PSB1bmRlZmluZWQgfHwgdHlwZW9mIHYgPT09ICdvYmplY3QnLFxuXHRcdFx0XHR2ID0+IHYgJiYgW3R5cGVDb252ZXJ0ZXJzLlZpZXdDb2x1bW4uZnJvbSh2LnZpZXdDb2x1bW4pLCB0eXBlQ29udmVydGVycy5UZXh0RWRpdG9yT3Blbk9wdGlvbnMuZnJvbSh2KV1cblx0XHRcdCkub3B0aW9uYWwoKSxcblx0XHRdLFxuXHRcdEFwaUNvbW1hbmRSZXN1bHQuVm9pZFxuXHQpLFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmNoYW5nZXMnLCAnX3dvcmtiZW5jaC5jaGFuZ2VzJywgJ09wZW5zIGEgbGlzdCBvZiByZXNvdXJjZXMgaW4gdGhlIGNoYW5nZXMgZWRpdG9yIHRvIGNvbXBhcmUgdGhlaXIgY29udGVudHMuJyxcblx0XHRbXG5cdFx0XHRBcGlDb21tYW5kQXJndW1lbnQuU3RyaW5nLndpdGgoJ3RpdGxlJywgJ0h1bWFuIHJlYWRhYmxlIHRpdGxlIGZvciB0aGUgY2hhbmdlcyBlZGl0b3InKSxcblx0XHRcdG5ldyBBcGlDb21tYW5kQXJndW1lbnQ8W1VSSSwgVVJJPywgVVJJP11bXT4oJ3Jlc291cmNlTGlzdCcsICdMaXN0IG9mIHJlc291cmNlcyB0byBjb21wYXJlJyxcblx0XHRcdFx0cmVzb3VyY2VzID0+IHtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHJlc291cmNlIG9mIHJlc291cmNlcykge1xuXHRcdFx0XHRcdFx0aWYgKHJlc291cmNlLmxlbmd0aCAhPT0gMykge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdGNvbnN0IFtsYWJlbCwgbGVmdCwgcmlnaHRdID0gcmVzb3VyY2U7XG5cdFx0XHRcdFx0XHRpZiAoIVVSSS5pc1VyaShsYWJlbCkgfHxcblx0XHRcdFx0XHRcdFx0KCFVUkkuaXNVcmkobGVmdCkgJiYgbGVmdCAhPT0gdW5kZWZpbmVkICYmIGxlZnQgIT09IG51bGwpIHx8XG5cdFx0XHRcdFx0XHRcdCghVVJJLmlzVXJpKHJpZ2h0KSAmJiByaWdodCAhPT0gdW5kZWZpbmVkICYmIHJpZ2h0ICE9PSBudWxsKSkge1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHYgPT4gdilcblx0XHRdLFxuXHRcdEFwaUNvbW1hbmRSZXN1bHQuVm9pZFxuXHQpLFxuXHQvLyAtLS0gdHlwZSBoaWVyYXJjaHlcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcmVwYXJlVHlwZUhpZXJhcmNoeScsICdfZXhlY3V0ZVByZXBhcmVUeXBlSGllcmFyY2h5JywgJ1ByZXBhcmUgdHlwZSBoaWVyYXJjaHkgYXQgYSBwb3NpdGlvbiBpbnNpZGUgYSBkb2N1bWVudCcsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5VcmksIEFwaUNvbW1hbmRBcmd1bWVudC5Qb3NpdGlvbl0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8SVR5cGVIaWVyYXJjaHlJdGVtRHRvW10sIHR5cGVzLlR5cGVIaWVyYXJjaHlJdGVtW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBUeXBlSGllcmFyY2h5SXRlbS1pbnN0YW5jZXMnLCB2ID0+IHYubWFwKHR5cGVDb252ZXJ0ZXJzLlR5cGVIaWVyYXJjaHlJdGVtLnRvKSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcm92aWRlU3VwZXJ0eXBlcycsICdfZXhlY3V0ZVByb3ZpZGVTdXBlcnR5cGVzJywgJ0NvbXB1dGUgc3VwZXJ0eXBlcyBmb3IgYW4gaXRlbScsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5UeXBlSGllcmFyY2h5SXRlbV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8SVR5cGVIaWVyYXJjaHlJdGVtRHRvW10sIHR5cGVzLlR5cGVIaWVyYXJjaHlJdGVtW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBUeXBlSGllcmFyY2h5SXRlbS1pbnN0YW5jZXMnLCB2ID0+IHYubWFwKHR5cGVDb252ZXJ0ZXJzLlR5cGVIaWVyYXJjaHlJdGVtLnRvKSlcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5wcm92aWRlU3VidHlwZXMnLCAnX2V4ZWN1dGVQcm92aWRlU3VidHlwZXMnLCAnQ29tcHV0ZSBzdWJ0eXBlcyBmb3IgYW4gaXRlbScsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5UeXBlSGllcmFyY2h5SXRlbV0sXG5cdFx0bmV3IEFwaUNvbW1hbmRSZXN1bHQ8SVR5cGVIaWVyYXJjaHlJdGVtRHRvW10sIHR5cGVzLlR5cGVIaWVyYXJjaHlJdGVtW10+KCdBIHByb21pc2UgdGhhdCByZXNvbHZlcyB0byBhbiBhcnJheSBvZiBUeXBlSGllcmFyY2h5SXRlbS1pbnN0YW5jZXMnLCB2ID0+IHYubWFwKHR5cGVDb252ZXJ0ZXJzLlR5cGVIaWVyYXJjaHlJdGVtLnRvKSlcblx0KSxcblx0Ly8gLS0tIHRlc3Rpbmdcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5yZXZlYWxUZXN0SW5FeHBsb3JlcicsICdfcmV2ZWFsVGVzdEluRXhwbG9yZXInLCAnUmV2ZWFscyBhIHRlc3QgaW5zdGFuY2UgaW4gdGhlIGV4cGxvcmVyJyxcblx0XHRbQXBpQ29tbWFuZEFyZ3VtZW50LlRlc3RJdGVtXSxcblx0XHRBcGlDb21tYW5kUmVzdWx0LlZvaWRcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5zdGFydENvbnRpbnVvdXNUZXN0UnVuJywgJ3Rlc3Rpbmcuc3RhcnRDb250aW51b3VzUnVuRnJvbUV4dGVuc2lvbicsICdTdGFydHMgcnVubmluZyB0aGUgZ2l2ZW4gdGVzdHMgd2l0aCBjb250aW51b3VzIHJ1biBtb2RlLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5UZXN0UHJvZmlsZSwgQXBpQ29tbWFuZEFyZ3VtZW50LkFycihBcGlDb21tYW5kQXJndW1lbnQuVGVzdEl0ZW0pXSxcblx0XHRBcGlDb21tYW5kUmVzdWx0LlZvaWRcblx0KSxcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5zdG9wQ29udGludW91c1Rlc3RSdW4nLCAndGVzdGluZy5zdG9wQ29udGludW91c1J1bkZyb21FeHRlbnNpb24nLCAnU3RvcHMgcnVubmluZyB0aGUgZ2l2ZW4gdGVzdHMgd2l0aCBjb250aW51b3VzIHJ1biBtb2RlLicsXG5cdFx0W0FwaUNvbW1hbmRBcmd1bWVudC5BcnIoQXBpQ29tbWFuZEFyZ3VtZW50LlRlc3RJdGVtKV0sXG5cdFx0QXBpQ29tbWFuZFJlc3VsdC5Wb2lkXG5cdCksXG5cdC8vIC0tLSBjb250aW51ZSBlZGl0IHNlc3Npb25cblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3ZzY29kZS5leHBlcmltZW50YWwuZWRpdFNlc3Npb24uY29udGludWUnLCAnX3dvcmtiZW5jaC5lZGl0U2Vzc2lvbnMuYWN0aW9ucy5jb250aW51ZUVkaXRTZXNzaW9uJywgJ0NvbnRpbnVlIHRoZSBjdXJyZW50IGVkaXQgc2Vzc2lvbiBpbiBhIGRpZmZlcmVudCB3b3Jrc3BhY2UnLFxuXHRcdFtBcGlDb21tYW5kQXJndW1lbnQuVXJpLndpdGgoJ3dvcmtzcGFjZVVyaScsICdUaGUgdGFyZ2V0IHdvcmtzcGFjZSB0byBjb250aW51ZSB0aGUgY3VycmVudCBlZGl0IHNlc3Npb24gaW4nKV0sXG5cdFx0QXBpQ29tbWFuZFJlc3VsdC5Wb2lkXG5cdCksXG5cdC8vIC0tLSBjb250ZXh0IGtleXNcblx0bmV3IEFwaUNvbW1hbmQoXG5cdFx0J3NldENvbnRleHQnLCAnX3NldENvbnRleHQnLCAnU2V0IGEgY3VzdG9tIGNvbnRleHQga2V5IHZhbHVlIHRoYXQgY2FuIGJlIHVzZWQgaW4gd2hlbiBjbGF1c2VzLicsXG5cdFx0W1xuXHRcdFx0QXBpQ29tbWFuZEFyZ3VtZW50LlN0cmluZy53aXRoKCduYW1lJywgJ1RoZSBjb250ZXh0IGtleSBuYW1lJyksXG5cdFx0XHRuZXcgQXBpQ29tbWFuZEFyZ3VtZW50KCd2YWx1ZScsICdUaGUgY29udGV4dCBrZXkgdmFsdWUnLCAoKSA9PiB0cnVlLCB2ID0+IHYpLFxuXHRcdF0sXG5cdFx0QXBpQ29tbWFuZFJlc3VsdC5Wb2lkXG5cdCksXG5cdC8vIC0tLSBpbmxpbmUgY2hhdFxuXHRuZXcgQXBpQ29tbWFuZChcblx0XHQndnNjb2RlLmVkaXRvckNoYXQuc3RhcnQnLCAnaW5saW5lQ2hhdC5zdGFydCcsICdJbnZva2UgYSBuZXcgZWRpdG9yIGNoYXQgc2Vzc2lvbicsXG5cdFx0W25ldyBBcGlDb21tYW5kQXJndW1lbnQ8SW5saW5lQ2hhdEVkaXRvckFwaUFyZyB8IHVuZGVmaW5lZCwgSW5saW5lQ2hhdFJ1bk9wdGlvbnMgfCB1bmRlZmluZWQ+KCdSdW4gYXJndW1lbnRzJywgJycsIF92ID0+IHRydWUsIHYgPT4ge1xuXG5cdFx0XHRpZiAoIXYpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0aW5pdGlhbFJhbmdlOiB2LmluaXRpYWxSYW5nZSA/IHR5cGVDb252ZXJ0ZXJzLlJhbmdlLmZyb20odi5pbml0aWFsUmFuZ2UpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRpbml0aWFsU2VsZWN0aW9uOiB0eXBlcy5TZWxlY3Rpb24uaXNTZWxlY3Rpb24odi5pbml0aWFsU2VsZWN0aW9uKSA/IHR5cGVDb252ZXJ0ZXJzLlNlbGVjdGlvbi5mcm9tKHYuaW5pdGlhbFNlbGVjdGlvbikgOiB1bmRlZmluZWQsXG5cdFx0XHRcdG1lc3NhZ2U6IHYubWVzc2FnZSxcblx0XHRcdFx0YXV0b1NlbmQ6IHYuYXV0b1NlbmQsXG5cdFx0XHRcdHBvc2l0aW9uOiB2LnBvc2l0aW9uID8gdHlwZUNvbnZlcnRlcnMuUG9zaXRpb24uZnJvbSh2LnBvc2l0aW9uKSA6IHVuZGVmaW5lZCxcblx0XHRcdH07XG5cdFx0fSldLFxuXHRcdEFwaUNvbW1hbmRSZXN1bHQuVm9pZFxuXHQpXG5dO1xuXG50eXBlIElubGluZUNoYXRFZGl0b3JBcGlBcmcgPSB7XG5cdGluaXRpYWxSYW5nZT86IHZzY29kZS5SYW5nZTtcblx0aW5pdGlhbFNlbGVjdGlvbj86IHZzY29kZS5TZWxlY3Rpb247XG5cdG1lc3NhZ2U/OiBzdHJpbmc7XG5cdGF1dG9TZW5kPzogYm9vbGVhbjtcblx0cG9zaXRpb24/OiB2c2NvZGUuUG9zaXRpb247XG59O1xuXG50eXBlIElubGluZUNoYXRSdW5PcHRpb25zID0ge1xuXHRpbml0aWFsUmFuZ2U/OiBJUmFuZ2U7XG5cdGluaXRpYWxTZWxlY3Rpb24/OiBJU2VsZWN0aW9uO1xuXHRtZXNzYWdlPzogc3RyaW5nO1xuXHRhdXRvU2VuZD86IGJvb2xlYW47XG5cdHBvc2l0aW9uPzogSVBvc2l0aW9uO1xufTtcblxuLy8jZW5kcmVnaW9uXG5cblxuLy8jcmVnaW9uIE9MRCB3b3JsZFxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdEFwaUNvbW1hbmRzIHtcblxuXHRzdGF0aWMgcmVnaXN0ZXIoY29tbWFuZHM6IEV4dEhvc3RDb21tYW5kcykge1xuXG5cdFx0bmV3Q29tbWFuZHMuZm9yRWFjaChjb21tYW5kcy5yZWdpc3RlckFwaUNvbW1hbmQsIGNvbW1hbmRzKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyVmFsaWRhdGVXaGVuQ2xhdXNlc0NvbW1hbmQoY29tbWFuZHMpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlZ2lzdGVyVmFsaWRhdGVXaGVuQ2xhdXNlc0NvbW1hbmQoY29tbWFuZHM6IEV4dEhvc3RDb21tYW5kcykge1xuXHRcdGNvbW1hbmRzLnJlZ2lzdGVyQ29tbWFuZChmYWxzZSwgJ192YWxpZGF0ZVdoZW5DbGF1c2VzJywgdmFsaWRhdGVXaGVuQ2xhdXNlcyk7XG5cdH1cbn1cblxuZnVuY3Rpb24gdHJ5TWFwV2l0aDxULCBSPihmOiAoeDogVCkgPT4gUikge1xuXHRyZXR1cm4gKHZhbHVlOiBUW10pID0+IHtcblx0XHRpZiAoQXJyYXkuaXNBcnJheSh2YWx1ZSkpIHtcblx0XHRcdHJldHVybiB2YWx1ZS5tYXAoZik7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH07XG59XG5cbmZ1bmN0aW9uIG1hcExvY2F0aW9uT3JMb2NhdGlvbkxpbmsodmFsdWVzOiAobGFuZ3VhZ2VzLkxvY2F0aW9uIHwgbGFuZ3VhZ2VzLkxvY2F0aW9uTGluaylbXSk6ICh0eXBlcy5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10gfCB1bmRlZmluZWQge1xuXHRpZiAoIUFycmF5LmlzQXJyYXkodmFsdWVzKSkge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblx0Y29uc3QgcmVzdWx0OiAodHlwZXMuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdID0gW107XG5cdGZvciAoY29uc3QgaXRlbSBvZiB2YWx1ZXMpIHtcblx0XHRpZiAobGFuZ3VhZ2VzLmlzTG9jYXRpb25MaW5rKGl0ZW0pKSB7XG5cdFx0XHRyZXN1bHQucHVzaCh0eXBlQ29udmVydGVycy5EZWZpbml0aW9uTGluay50byhpdGVtKSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJlc3VsdC5wdXNoKHR5cGVDb252ZXJ0ZXJzLmxvY2F0aW9uLnRvKGl0ZW0pKTtcblx0XHR9XG5cdH1cblx0cmV0dXJuIHJlc3VsdDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsc0JBQXNCO0FBRS9CLFNBQVMsU0FBUyx5QkFBeUI7QUFDM0MsU0FBUyxXQUFXO0FBSXBCLFlBQVksZUFBZTtBQUMzQixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLDJCQUEyQjtBQUdwQyxTQUFTLFlBQVksb0JBQW9CLHdCQUF5QztBQUVsRixZQUFZLG9CQUFvQjtBQUNoQyxZQUFZLFdBQVc7QUFPdkIsTUFBTSxjQUE0QjtBQUFBO0FBQUEsRUFFakMsSUFBSTtBQUFBLElBQ0g7QUFBQSxJQUFvQztBQUFBLElBQThCO0FBQUEsSUFDbEUs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
