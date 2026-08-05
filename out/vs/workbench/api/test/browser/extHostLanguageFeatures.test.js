import assert from "assert";
import { TestInstantiationService } from "../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { setUnexpectedErrorHandler, errorHandler } from "../../../../base/common/errors.js";
import { URI } from "../../../../base/common/uri.js";
import * as types from "../../common/extHostTypes.js";
import { createTextModel } from "../../../../editor/test/common/testTextModel.js";
import { Position as EditorPosition, Position } from "../../../../editor/common/core/position.js";
import { Range as EditorRange } from "../../../../editor/common/core/range.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { IMarkerService } from "../../../../platform/markers/common/markers.js";
import { MarkerService } from "../../../../platform/markers/common/markerService.js";
import { ExtHostLanguageFeatures } from "../../common/extHostLanguageFeatures.js";
import { MainThreadLanguageFeatures } from "../../browser/mainThreadLanguageFeatures.js";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { MainThreadCommands } from "../../browser/mainThreadCommands.js";
import { ExtHostDocuments } from "../../common/extHostDocuments.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import * as languages from "../../../../editor/common/languages.js";
import { getCodeLensModel } from "../../../../editor/contrib/codelens/browser/codelens.js";
import { getDefinitionsAtPosition, getImplementationsAtPosition, getTypeDefinitionsAtPosition, getDeclarationsAtPosition, getReferencesAtPosition } from "../../../../editor/contrib/gotoSymbol/browser/goToSymbol.js";
import { getHoversPromise } from "../../../../editor/contrib/hover/browser/getHover.js";
import { getOccurrencesAtPosition } from "../../../../editor/contrib/wordHighlighter/browser/wordHighlighter.js";
import { getCodeActions } from "../../../../editor/contrib/codeAction/browser/codeAction.js";
import { getWorkspaceSymbols } from "../../../contrib/search/common/search.js";
import { rename } from "../../../../editor/contrib/rename/browser/rename.js";
import { provideSignatureHelp } from "../../../../editor/contrib/parameterHints/browser/provideSignatureHelp.js";
import { provideSuggestionItems, CompletionOptions } from "../../../../editor/contrib/suggest/browser/suggest.js";
import { getDocumentFormattingEditsUntilResult, getDocumentRangeFormattingEditsUntilResult, getOnTypeFormattingEdits } from "../../../../editor/contrib/format/browser/format.js";
import { getLinks } from "../../../../editor/contrib/links/browser/getLinks.js";
import { MainContext, ExtHostContext } from "../../common/extHost.protocol.js";
import { ExtHostDiagnostics } from "../../common/extHostDiagnostics.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { EndOfLineSequence } from "../../../../editor/common/model.js";
import { getColors } from "../../../../editor/contrib/colorPicker/browser/color.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { nullExtensionDescription as defaultExtension } from "../../../services/extensions/common/extensions.js";
import { provideSelectionRanges } from "../../../../editor/contrib/smartSelect/browser/smartSelect.js";
import { mock } from "../../../../base/test/common/mock.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { NullApiDeprecationService } from "../../common/extHostApiDeprecationService.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { URITransformerService } from "../../common/extHostUriTransformerService.js";
import { OutlineModel } from "../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { LanguageFeaturesService } from "../../../../editor/common/services/languageFeaturesService.js";
import { CodeActionTriggerSource } from "../../../../editor/contrib/codeAction/common/types.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
suite("ExtHostLanguageFeatures", function() {
  const defaultSelector = { scheme: "far" };
  let model;
  let extHost;
  let mainThread;
  const disposables = new DisposableStore();
  let rpcProtocol;
  let languageFeaturesService;
  let originalErrorHandler;
  let instantiationService;
  setup(() => {
    model = createTextModel(
      [
        "This is the first line",
        "This is the second line",
        "This is the third line"
      ].join("\n"),
      void 0,
      void 0,
      URI.parse("far://testing/file.a")
    );
    rpcProtocol = new TestRPCProtocol();
    languageFeaturesService = new LanguageFeaturesService();
    let inst;
    {
      instantiationService = new TestInstantiationService();
      instantiationService.stub(IMarkerService, MarkerService);
      instantiationService.set(ILanguageFeaturesService, languageFeaturesService);
      instantiationService.set(IUriIdentityService, new class extends mock() {
        asCanonicalUri(uri) {
          return uri;
        }
      }());
      inst = instantiationService;
    }
    originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => {
    });
    const extHostDocumentsAndEditors = new ExtHostDocumentsAndEditors(rpcProtocol, new NullLogService());
    extHostDocumentsAndEditors.$acceptDocumentsAndEditorsDelta({
      addedDocuments: [{
        isDirty: false,
        versionId: model.getVersionId(),
        languageId: model.getLanguageId(),
        uri: model.uri,
        lines: model.getValue().split(model.getEOL()),
        EOL: model.getEOL(),
        encoding: "utf8"
      }]
    });
    const extHostDocuments = new ExtHostDocuments(rpcProtocol, extHostDocumentsAndEditors);
    rpcProtocol.set(ExtHostContext.ExtHostDocuments, extHostDocuments);
    const commands = new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
      onExtensionError() {
        return true;
      }
    }());
    rpcProtocol.set(ExtHostContext.ExtHostCommands, commands);
    rpcProtocol.set(MainContext.MainThreadCommands, disposables.add(inst.createInstance(MainThreadCommands, rpcProtocol)));
    const diagnostics = new ExtHostDiagnostics(rpcProtocol, new NullLogService(), new class extends mock() {
    }(), extHostDocumentsAndEditors);
    rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, diagnostics);
    extHost = new ExtHostLanguageFeatures(rpcProtocol, new URITransformerService(null), extHostDocuments, commands, diagnostics, new NullLogService(), NullApiDeprecationService, new class extends mock() {
      onExtensionError() {
        return true;
      }
    }());
    rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, extHost);
    mainThread = rpcProtocol.set(MainContext.MainThreadLanguageFeatures, disposables.add(inst.createInstance(MainThreadLanguageFeatures, rpcProtocol)));
  });
  teardown(() => {
    disposables.clear();
    setUnexpectedErrorHandler(originalErrorHandler);
    model.dispose();
    mainThread.dispose();
    instantiationService.dispose();
    return rpcProtocol.sync();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("DocumentSymbols, register/deregister", async () => {
    assert.strictEqual(languageFeaturesService.documentSymbolProvider.all(model).length, 0);
    const d1 = extHost.registerDocumentSymbolProvider(defaultExtension, defaultSelector, new class {
      provideDocumentSymbols() {
        return [];
      }
    }());
    await rpcProtocol.sync();
    assert.strictEqual(languageFeaturesService.documentSymbolProvider.all(model).length, 1);
    d1.dispose();
    return rpcProtocol.sync();
  });
  test("DocumentSymbols, evil provider", async () => {
    disposables.add(extHost.registerDocumentSymbolProvider(defaultExtension, defaultSelector, new class {
      provideDocumentSymbols() {
        throw new Error("evil document symbol provider");
      }
    }()));
    disposables.add(extHost.registerDocumentSymbolProvider(defaultExtension, defaultSelector, new class {
      provideDocumentSymbols() {
        return [new types.SymbolInformation("test", types.SymbolKind.Field, new types.Range(0, 0, 0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const value = (await OutlineModel.create(languageFeaturesService.documentSymbolProvider, model, CancellationToken.None)).asListOfDocumentSymbols();
    assert.strictEqual(value.length, 1);
  });
  test("DocumentSymbols, data conversion", async () => {
    disposables.add(extHost.registerDocumentSymbolProvider(defaultExtension, defaultSelector, new class {
      provideDocumentSymbols() {
        return [new types.SymbolInformation("test", types.SymbolKind.Field, new types.Range(0, 0, 0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const value = (await OutlineModel.create(languageFeaturesService.documentSymbolProvider, model, CancellationToken.None)).asListOfDocumentSymbols();
    assert.strictEqual(value.length, 1);
    const entry = value[0];
    assert.strictEqual(entry.name, "test");
    assert.deepStrictEqual(entry.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  });
  test("Quick Outline uses a not ideal sorting, #138502", async function() {
    const symbols = [
      { name: "containers", range: { startLineNumber: 1, startColumn: 1, endLineNumber: 4, endColumn: 26 } },
      { name: "container 0", range: { startLineNumber: 2, startColumn: 5, endLineNumber: 5, endColumn: 1 } },
      { name: "name", range: { startLineNumber: 2, startColumn: 5, endLineNumber: 2, endColumn: 16 } },
      { name: "ports", range: { startLineNumber: 3, startColumn: 5, endLineNumber: 5, endColumn: 1 } },
      { name: "ports 0", range: { startLineNumber: 4, startColumn: 9, endLineNumber: 4, endColumn: 26 } },
      { name: "containerPort", range: { startLineNumber: 4, startColumn: 9, endLineNumber: 4, endColumn: 26 } }
    ];
    disposables.add(extHost.registerDocumentSymbolProvider(defaultExtension, defaultSelector, {
      provideDocumentSymbols: (doc, token) => {
        return symbols.map((s) => {
          return new types.SymbolInformation(
            s.name,
            types.SymbolKind.Object,
            new types.Range(s.range.startLineNumber - 1, s.range.startColumn - 1, s.range.endLineNumber - 1, s.range.endColumn - 1)
          );
        });
      }
    }));
    await rpcProtocol.sync();
    const value = (await OutlineModel.create(languageFeaturesService.documentSymbolProvider, model, CancellationToken.None)).asListOfDocumentSymbols();
    assert.strictEqual(value.length, 6);
    assert.deepStrictEqual(value.map((s) => s.name), ["containers", "container 0", "name", "ports", "ports 0", "containerPort"]);
  });
  test("CodeLens, evil provider", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeLensProvider(defaultExtension, defaultSelector, new class {
        provideCodeLenses() {
          throw new Error("evil");
        }
      }()));
      disposables.add(extHost.registerCodeLensProvider(defaultExtension, defaultSelector, new class {
        provideCodeLenses() {
          return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
        }
      }()));
      await rpcProtocol.sync();
      const value = await getCodeLensModel(languageFeaturesService.codeLensProvider, model, CancellationToken.None);
      assert.strictEqual(value.lenses.length, 1);
      value.dispose();
    });
  });
  test("CodeLens, do not resolve a resolved lens", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeLensProvider(defaultExtension, defaultSelector, new class {
        provideCodeLenses() {
          return [new types.CodeLens(
            new types.Range(0, 0, 0, 0),
            { command: "id", title: "Title" }
          )];
        }
        resolveCodeLens() {
          assert.ok(false, "do not resolve");
        }
      }()));
      await rpcProtocol.sync();
      const value = await getCodeLensModel(languageFeaturesService.codeLensProvider, model, CancellationToken.None);
      assert.strictEqual(value.lenses.length, 1);
      const [data] = value.lenses;
      const symbol = await Promise.resolve(data.provider.resolveCodeLens(model, data.symbol, CancellationToken.None));
      assert.strictEqual(symbol.command.id, "id");
      assert.strictEqual(symbol.command.title, "Title");
      value.dispose();
    });
  });
  test("CodeLens, missing command", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeLensProvider(defaultExtension, defaultSelector, new class {
        provideCodeLenses() {
          return [new types.CodeLens(new types.Range(0, 0, 0, 0))];
        }
      }()));
      await rpcProtocol.sync();
      const value = await getCodeLensModel(languageFeaturesService.codeLensProvider, model, CancellationToken.None);
      assert.strictEqual(value.lenses.length, 1);
      const [data] = value.lenses;
      const symbol = await Promise.resolve(data.provider.resolveCodeLens(model, data.symbol, CancellationToken.None));
      assert.strictEqual(symbol, void 0);
      value.dispose();
    });
  });
  test("Definition, data conversion", async () => {
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [entry] = value;
    assert.deepStrictEqual(entry.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
    assert.strictEqual(entry.uri.toString(), model.uri.toString());
  });
  test("Definition, one or many", async () => {
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return [new types.Location(model.uri, new types.Range(1, 1, 1, 1))];
      }
    }()));
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return new types.Location(model.uri, new types.Range(2, 1, 1, 1));
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 2);
  });
  test("Definition, registration order", async () => {
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return [new types.Location(URI.parse("far://first"), new types.Range(2, 3, 4, 5))];
      }
    }()));
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return new types.Location(URI.parse("far://second"), new types.Range(1, 2, 3, 4));
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 2);
    assert.strictEqual(value[0].uri.authority, "second");
    assert.strictEqual(value[1].uri.authority, "first");
  });
  test("Definition, evil provider", async () => {
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        throw new Error("evil provider");
      }
    }()));
    disposables.add(extHost.registerDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideDefinition() {
        return new types.Location(model.uri, new types.Range(1, 1, 1, 1));
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDefinitionsAtPosition(languageFeaturesService.definitionProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
  });
  test("Declaration, data conversion", async () => {
    disposables.add(extHost.registerDeclarationProvider(defaultExtension, defaultSelector, new class {
      provideDeclaration() {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDeclarationsAtPosition(languageFeaturesService.declarationProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [entry] = value;
    assert.deepStrictEqual(entry.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
    assert.strictEqual(entry.uri.toString(), model.uri.toString());
  });
  test("Implementation, data conversion", async () => {
    disposables.add(extHost.registerImplementationProvider(defaultExtension, defaultSelector, new class {
      provideImplementation() {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getImplementationsAtPosition(languageFeaturesService.implementationProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [entry] = value;
    assert.deepStrictEqual(entry.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
    assert.strictEqual(entry.uri.toString(), model.uri.toString());
  });
  test("Type Definition, data conversion", async () => {
    disposables.add(extHost.registerTypeDefinitionProvider(defaultExtension, defaultSelector, new class {
      provideTypeDefinition() {
        return [new types.Location(model.uri, new types.Range(1, 2, 3, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getTypeDefinitionsAtPosition(languageFeaturesService.typeDefinitionProvider, model, new EditorPosition(1, 1), false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [entry] = value;
    assert.deepStrictEqual(entry.range, { startLineNumber: 2, startColumn: 3, endLineNumber: 4, endColumn: 5 });
    assert.strictEqual(entry.uri.toString(), model.uri.toString());
  });
  test("HoverProvider, word range at pos", async () => {
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        return new types.Hover("Hello");
      }
    }()));
    await rpcProtocol.sync();
    const hovers = await getHoversPromise(languageFeaturesService.hoverProvider, model, new EditorPosition(1, 1), CancellationToken.None);
    assert.strictEqual(hovers.length, 1);
    const [entry] = hovers;
    assert.deepStrictEqual(entry.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
  });
  test("HoverProvider, given range", async () => {
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        return new types.Hover("Hello", new types.Range(3, 0, 8, 7));
      }
    }()));
    await rpcProtocol.sync();
    const hovers = await getHoversPromise(languageFeaturesService.hoverProvider, model, new EditorPosition(1, 1), CancellationToken.None);
    assert.strictEqual(hovers.length, 1);
    const [entry] = hovers;
    assert.deepStrictEqual(entry.range, { startLineNumber: 4, startColumn: 1, endLineNumber: 9, endColumn: 8 });
  });
  test("HoverProvider, registration order", async () => {
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        return new types.Hover("registered first");
      }
    }()));
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        return new types.Hover("registered second");
      }
    }()));
    await rpcProtocol.sync();
    const value = await getHoversPromise(languageFeaturesService.hoverProvider, model, new EditorPosition(1, 1), CancellationToken.None);
    assert.strictEqual(value.length, 2);
    const [first, second] = value;
    assert.strictEqual(first.contents[0].value, "registered second");
    assert.strictEqual(second.contents[0].value, "registered first");
  });
  test("HoverProvider, evil provider", async () => {
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        throw new Error("evil");
      }
    }()));
    disposables.add(extHost.registerHoverProvider(defaultExtension, defaultSelector, new class {
      provideHover() {
        return new types.Hover("Hello");
      }
    }()));
    await rpcProtocol.sync();
    const hovers = await getHoversPromise(languageFeaturesService.hoverProvider, model, new EditorPosition(1, 1), CancellationToken.None);
    assert.strictEqual(hovers.length, 1);
  });
  test("Occurrences, data conversion", async () => {
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, defaultSelector, new class {
      provideDocumentHighlights() {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getOccurrencesAtPosition(languageFeaturesService.documentHighlightProvider, model, new EditorPosition(1, 2), CancellationToken.None);
    assert.strictEqual(value.size, 1);
    const [entry] = Array.from(value.values())[0];
    assert.deepStrictEqual(entry.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
    assert.strictEqual(entry.kind, languages.DocumentHighlightKind.Text);
  });
  test("Occurrences, order 1/2", async () => {
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, defaultSelector, new class {
      provideDocumentHighlights() {
        return void 0;
      }
    }()));
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, "*", new class {
      provideDocumentHighlights() {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getOccurrencesAtPosition(languageFeaturesService.documentHighlightProvider, model, new EditorPosition(1, 2), CancellationToken.None);
    assert.strictEqual(value.size, 1);
    const [entry] = Array.from(value.values())[0];
    assert.deepStrictEqual(entry.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 5 });
    assert.strictEqual(entry.kind, languages.DocumentHighlightKind.Text);
  });
  test("Occurrences, order 2/2", async () => {
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, defaultSelector, new class {
      provideDocumentHighlights() {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 2))];
      }
    }()));
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, "*", new class {
      provideDocumentHighlights() {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getOccurrencesAtPosition(languageFeaturesService.documentHighlightProvider, model, new EditorPosition(1, 2), CancellationToken.None);
    assert.strictEqual(value.size, 1);
    const [entry] = Array.from(value.values())[0];
    assert.deepStrictEqual(entry.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 3 });
    assert.strictEqual(entry.kind, languages.DocumentHighlightKind.Text);
  });
  test("Occurrences, evil provider", async () => {
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, defaultSelector, new class {
      provideDocumentHighlights() {
        throw new Error("evil");
      }
    }()));
    disposables.add(extHost.registerDocumentHighlightProvider(defaultExtension, defaultSelector, new class {
      provideDocumentHighlights() {
        return [new types.DocumentHighlight(new types.Range(0, 0, 0, 4))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getOccurrencesAtPosition(languageFeaturesService.documentHighlightProvider, model, new EditorPosition(1, 2), CancellationToken.None);
    assert.strictEqual(value.size, 1);
  });
  test("References, registration order", async () => {
    disposables.add(extHost.registerReferenceProvider(defaultExtension, defaultSelector, new class {
      provideReferences() {
        return [new types.Location(URI.parse("far://register/first"), new types.Range(0, 0, 0, 0))];
      }
    }()));
    disposables.add(extHost.registerReferenceProvider(defaultExtension, defaultSelector, new class {
      provideReferences() {
        return [new types.Location(URI.parse("far://register/second"), new types.Range(0, 0, 0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getReferencesAtPosition(languageFeaturesService.referenceProvider, model, new EditorPosition(1, 2), false, false, CancellationToken.None);
    assert.strictEqual(value.length, 2);
    const [first, second] = value;
    assert.strictEqual(first.uri.path, "/second");
    assert.strictEqual(second.uri.path, "/first");
  });
  test("References, data conversion", async () => {
    disposables.add(extHost.registerReferenceProvider(defaultExtension, defaultSelector, new class {
      provideReferences() {
        return [new types.Location(model.uri, new types.Position(0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getReferencesAtPosition(languageFeaturesService.referenceProvider, model, new EditorPosition(1, 2), false, false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [item] = value;
    assert.deepStrictEqual(item.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
    assert.strictEqual(item.uri.toString(), model.uri.toString());
  });
  test("References, evil provider", async () => {
    disposables.add(extHost.registerReferenceProvider(defaultExtension, defaultSelector, new class {
      provideReferences() {
        throw new Error("evil");
      }
    }()));
    disposables.add(extHost.registerReferenceProvider(defaultExtension, defaultSelector, new class {
      provideReferences() {
        return [new types.Location(model.uri, new types.Range(0, 0, 0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getReferencesAtPosition(languageFeaturesService.referenceProvider, model, new EditorPosition(1, 2), false, false, CancellationToken.None);
    assert.strictEqual(value.length, 1);
  });
  test("Quick Fix, command data conversion", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeActionProvider(defaultExtension, defaultSelector, {
        provideCodeActions() {
          return [
            { command: "test1", title: "Testing1" },
            { command: "test2", title: "Testing2" }
          ];
        }
      }));
      await rpcProtocol.sync();
      const value = await getCodeActions(languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), { type: languages.CodeActionTriggerType.Invoke, triggerAction: CodeActionTriggerSource.QuickFix }, Progress.None, CancellationToken.None);
      const { validActions: actions } = value;
      assert.strictEqual(actions.length, 2);
      const [first, second] = actions;
      assert.strictEqual(first.action.title, "Testing1");
      assert.strictEqual(first.action.command.id, "test1");
      assert.strictEqual(second.action.title, "Testing2");
      assert.strictEqual(second.action.command.id, "test2");
      value.dispose();
    });
  });
  test("Quick Fix, code action data conversion", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeActionProvider(defaultExtension, defaultSelector, {
        provideCodeActions() {
          return [
            {
              title: "Testing1",
              command: { title: "Testing1Command", command: "test1" },
              kind: types.CodeActionKind.Empty.append("test.scope")
            }
          ];
        }
      }));
      await rpcProtocol.sync();
      const value = await getCodeActions(languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), { type: languages.CodeActionTriggerType.Invoke, triggerAction: CodeActionTriggerSource.Default }, Progress.None, CancellationToken.None);
      const { validActions: actions } = value;
      assert.strictEqual(actions.length, 1);
      const [first] = actions;
      assert.strictEqual(first.action.title, "Testing1");
      assert.strictEqual(first.action.command.title, "Testing1Command");
      assert.strictEqual(first.action.command.id, "test1");
      assert.strictEqual(first.action.kind, "test.scope");
      value.dispose();
    });
  });
  test("Cannot read property 'id' of undefined, #29469", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeActionProvider(defaultExtension, defaultSelector, new class {
        provideCodeActions() {
          return [
            void 0,
            null,
            { command: "test", title: "Testing" }
          ];
        }
      }()));
      await rpcProtocol.sync();
      const value = await getCodeActions(languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), { type: languages.CodeActionTriggerType.Invoke, triggerAction: CodeActionTriggerSource.Default }, Progress.None, CancellationToken.None);
      const { validActions: actions } = value;
      assert.strictEqual(actions.length, 1);
      value.dispose();
    });
  });
  test("Quick Fix, evil provider", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCodeActionProvider(defaultExtension, defaultSelector, new class {
        provideCodeActions() {
          throw new Error("evil");
        }
      }()));
      disposables.add(extHost.registerCodeActionProvider(defaultExtension, defaultSelector, new class {
        provideCodeActions() {
          return [{ command: "test", title: "Testing" }];
        }
      }()));
      await rpcProtocol.sync();
      const value = await getCodeActions(languageFeaturesService.codeActionProvider, model, model.getFullModelRange(), { type: languages.CodeActionTriggerType.Invoke, triggerAction: CodeActionTriggerSource.QuickFix }, Progress.None, CancellationToken.None);
      const { validActions: actions } = value;
      assert.strictEqual(actions.length, 1);
      value.dispose();
    });
  });
  test("Navigate types, evil provider", async () => {
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        throw new Error("evil");
      }
    }()));
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("testing", types.SymbolKind.Array, new types.Range(0, 0, 1, 1))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getWorkspaceSymbols("");
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.symbol.name, "testing");
  });
  test("Navigate types, de-duplicate results", async () => {
    const uri = URI.from({ scheme: "foo", path: "/some/path" });
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("ONE", types.SymbolKind.Array, void 0, new types.Location(uri, new types.Range(0, 0, 1, 1)))];
      }
    }()));
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("ONE", types.SymbolKind.Array, void 0, new types.Location(uri, new types.Range(0, 0, 1, 1)))];
      }
    }()));
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("ONE", types.SymbolKind.Array, void 0, new types.Location(uri, void 0))];
      }
      resolveWorkspaceSymbol(a) {
        return a;
      }
    }()));
    disposables.add(extHost.registerWorkspaceSymbolProvider(defaultExtension, new class {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("ONE", types.SymbolKind.Struct, void 0, new types.Location(uri, new types.Range(0, 0, 1, 1)))];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getWorkspaceSymbols("");
    assert.strictEqual(value.length, 3);
  });
  test("Rename, evil provider 0/2", async () => {
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      provideRenameEdits() {
        throw new class Foo {
        }();
      }
    }()));
    await rpcProtocol.sync();
    try {
      await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
      throw Error();
    } catch (err) {
    }
  });
  test("Rename, evil provider 1/2", async () => {
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      provideRenameEdits() {
        throw Error("evil");
      }
    }()));
    await rpcProtocol.sync();
    const value = await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
    assert.strictEqual(value.rejectReason, "evil");
  });
  test("Rename, evil provider 2/2", async () => {
    disposables.add(extHost.registerRenameProvider(defaultExtension, "*", new class {
      provideRenameEdits() {
        throw Error("evil");
      }
    }()));
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      provideRenameEdits() {
        const edit = new types.WorkspaceEdit();
        edit.replace(model.uri, new types.Range(0, 0, 0, 0), "testing");
        return edit;
      }
    }()));
    await rpcProtocol.sync();
    const value = await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
    assert.strictEqual(value.edits.length, 1);
  });
  test("Rename, ordering", async () => {
    disposables.add(extHost.registerRenameProvider(defaultExtension, "*", new class {
      provideRenameEdits() {
        const edit = new types.WorkspaceEdit();
        edit.replace(model.uri, new types.Range(0, 0, 0, 0), "testing");
        edit.replace(model.uri, new types.Range(1, 0, 1, 0), "testing");
        return edit;
      }
    }()));
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      provideRenameEdits() {
        return;
      }
    }()));
    await rpcProtocol.sync();
    const value = await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
    assert.strictEqual(value.edits.length, 2);
  });
  test("Multiple RenameProviders don't respect all possible PrepareRename handlers 1/2, #98352", async function() {
    const called = [false, false, false, false];
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      prepareRename(document, position) {
        called[0] = true;
        const range = document.getWordRangeAtPosition(position);
        return range;
      }
      provideRenameEdits() {
        called[1] = true;
        return void 0;
      }
    }()));
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      prepareRename(document, position) {
        called[2] = true;
        return Promise.reject("Cannot rename this symbol2.");
      }
      provideRenameEdits() {
        called[3] = true;
        return void 0;
      }
    }()));
    await rpcProtocol.sync();
    await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
    assert.deepStrictEqual(called, [true, true, true, false]);
  });
  test("Multiple RenameProviders don't respect all possible PrepareRename handlers 2/2, #98352", async function() {
    const called = [false, false, false];
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      prepareRename(document, position) {
        called[0] = true;
        const range = document.getWordRangeAtPosition(position);
        return range;
      }
      provideRenameEdits() {
        called[1] = true;
        return void 0;
      }
    }()));
    disposables.add(extHost.registerRenameProvider(defaultExtension, defaultSelector, new class {
      provideRenameEdits(document, position, newName) {
        called[2] = true;
        return new types.WorkspaceEdit();
      }
    }()));
    await rpcProtocol.sync();
    await rename(languageFeaturesService.renameProvider, model, new EditorPosition(1, 1), "newName");
    assert.deepStrictEqual(called, [false, false, true]);
  });
  test("Parameter Hints, order", async () => {
    disposables.add(extHost.registerSignatureHelpProvider(defaultExtension, defaultSelector, new class {
      provideSignatureHelp() {
        return void 0;
      }
    }(), []));
    disposables.add(extHost.registerSignatureHelpProvider(defaultExtension, defaultSelector, new class {
      provideSignatureHelp() {
        return {
          signatures: [],
          activeParameter: 0,
          activeSignature: 0
        };
      }
    }(), []));
    await rpcProtocol.sync();
    const value = await provideSignatureHelp(languageFeaturesService.signatureHelpProvider, model, new EditorPosition(1, 1), { triggerKind: languages.SignatureHelpTriggerKind.Invoke, isRetrigger: false }, CancellationToken.None);
    assert.ok(value);
  });
  test("Parameter Hints, evil provider", async () => {
    disposables.add(extHost.registerSignatureHelpProvider(defaultExtension, defaultSelector, new class {
      provideSignatureHelp() {
        throw new Error("evil");
      }
    }(), []));
    await rpcProtocol.sync();
    const value = await provideSignatureHelp(languageFeaturesService.signatureHelpProvider, model, new EditorPosition(1, 1), { triggerKind: languages.SignatureHelpTriggerKind.Invoke, isRetrigger: false }, CancellationToken.None);
    assert.strictEqual(value, void 0);
  });
  test("Suggest, order 1/3", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, "*", new class {
        provideCompletionItems() {
          return [new types.CompletionItem("testing1")];
        }
      }(), []));
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return [new types.CompletionItem("testing2")];
        }
      }(), []));
      await rpcProtocol.sync();
      const value = await provideSuggestionItems(languageFeaturesService.completionProvider, model, new EditorPosition(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(languages.CompletionItemKind.Snippet)));
      assert.strictEqual(value.items.length, 1);
      assert.strictEqual(value.items[0].completion.insertText, "testing2");
      value.disposable.dispose();
    });
  });
  test("Suggest, order 2/3", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, "*", new class {
        provideCompletionItems() {
          return [new types.CompletionItem("weak-selector")];
        }
      }(), []));
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return [];
        }
      }(), []));
      await rpcProtocol.sync();
      const value = await provideSuggestionItems(languageFeaturesService.completionProvider, model, new EditorPosition(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(languages.CompletionItemKind.Snippet)));
      assert.strictEqual(value.items.length, 1);
      assert.strictEqual(value.items[0].completion.insertText, "weak-selector");
      value.disposable.dispose();
    });
  });
  test("Suggest, order 3/3", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return [new types.CompletionItem("strong-1")];
        }
      }(), []));
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return [new types.CompletionItem("strong-2")];
        }
      }(), []));
      await rpcProtocol.sync();
      const value = await provideSuggestionItems(languageFeaturesService.completionProvider, model, new EditorPosition(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(languages.CompletionItemKind.Snippet)));
      assert.strictEqual(value.items.length, 2);
      assert.strictEqual(value.items[0].completion.insertText, "strong-1");
      assert.strictEqual(value.items[1].completion.insertText, "strong-2");
      value.disposable.dispose();
    });
  });
  test("Suggest, evil provider", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          throw new Error("evil");
        }
      }(), []));
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return [new types.CompletionItem("testing")];
        }
      }(), []));
      await rpcProtocol.sync();
      const value = await provideSuggestionItems(languageFeaturesService.completionProvider, model, new EditorPosition(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(languages.CompletionItemKind.Snippet)));
      assert.strictEqual(value.items[0].container.incomplete, false);
      value.disposable.dispose();
    });
  });
  test("Suggest, CompletionList", async () => {
    return runWithFakedTimers({ useFakeTimers: true }, async () => {
      disposables.add(extHost.registerCompletionItemProvider(defaultExtension, defaultSelector, new class {
        provideCompletionItems() {
          return new types.CompletionList([new types.CompletionItem("hello")], true);
        }
      }(), []));
      await rpcProtocol.sync();
      await provideSuggestionItems(languageFeaturesService.completionProvider, model, new EditorPosition(1, 1), new CompletionOptions(void 0, (/* @__PURE__ */ new Set()).add(languages.CompletionItemKind.Snippet))).then((model2) => {
        assert.strictEqual(model2.items[0].container.incomplete, true);
        model2.disposable.dispose();
      });
    });
  });
  const NullWorkerService = new class extends mock() {
    computeMoreMinimalEdits(resource, edits) {
      return Promise.resolve(edits ?? void 0);
    }
  }();
  test("Format Doc, data conversion", async () => {
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), "testing"), types.TextEdit.setEndOfLine(types.EndOfLine.LF)];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDocumentFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
    assert.strictEqual(value.length, 2);
    const [first, second] = value;
    assert.strictEqual(first.text, "testing");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
    assert.strictEqual(second.eol, EndOfLineSequence.LF);
    assert.strictEqual(second.text, "");
    assert.deepStrictEqual(second.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  });
  test("Format Doc, evil provider", async () => {
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        throw new Error("evil");
      }
    }()));
    await rpcProtocol.sync();
    return getDocumentFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
  });
  test("Format Doc, order", async () => {
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return void 0;
      }
    }()));
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), "testing")];
      }
    }()));
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return void 0;
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDocumentFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.text, "testing");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  });
  test("Format Range, data conversion", async () => {
    disposables.add(extHost.registerDocumentRangeFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentRangeFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), "testing")];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDocumentRangeFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, new EditorRange(1, 1, 1, 1), { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.text, "testing");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  });
  test("Format Range, + format_doc", async () => {
    disposables.add(extHost.registerDocumentRangeFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentRangeFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), "range")];
      }
    }()));
    disposables.add(extHost.registerDocumentRangeFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentRangeFormattingEdits() {
        return [new types.TextEdit(new types.Range(2, 3, 4, 5), "range2")];
      }
    }()));
    disposables.add(extHost.registerDocumentFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 1, 1), "doc")];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getDocumentRangeFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, new EditorRange(1, 1, 1, 1), { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.text, "range2");
    assert.strictEqual(first.range.startLineNumber, 3);
    assert.strictEqual(first.range.startColumn, 4);
    assert.strictEqual(first.range.endLineNumber, 5);
    assert.strictEqual(first.range.endColumn, 6);
  });
  test("Format Range, evil provider", async () => {
    disposables.add(extHost.registerDocumentRangeFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideDocumentRangeFormattingEdits() {
        throw new Error("evil");
      }
    }()));
    await rpcProtocol.sync();
    return getDocumentRangeFormattingEditsUntilResult(NullWorkerService, languageFeaturesService, model, new EditorRange(1, 1, 1, 1), { insertSpaces: true, tabSize: 4 }, CancellationToken.None);
  });
  test("Format on Type, data conversion", async () => {
    disposables.add(extHost.registerOnTypeFormattingEditProvider(defaultExtension, defaultSelector, new class {
      provideOnTypeFormattingEdits() {
        return [new types.TextEdit(new types.Range(0, 0, 0, 0), arguments[2])];
      }
    }(), [";"]));
    await rpcProtocol.sync();
    const value = await getOnTypeFormattingEdits(NullWorkerService, languageFeaturesService, model, new EditorPosition(1, 1), ";", { insertSpaces: true, tabSize: 2 }, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.text, ";");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 1 });
  });
  test("Links, data conversion", async () => {
    disposables.add(extHost.registerDocumentLinkProvider(defaultExtension, defaultSelector, new class {
      provideDocumentLinks() {
        const link = new types.DocumentLink(new types.Range(0, 0, 1, 1), URI.parse("foo:bar#3"));
        link.tooltip = "tooltip";
        return [link];
      }
    }()));
    await rpcProtocol.sync();
    const { links } = disposables.add(await getLinks(languageFeaturesService.linkProvider, model, CancellationToken.None));
    assert.strictEqual(links.length, 1);
    const [first] = links;
    assert.strictEqual(first.url?.toString(), "foo:bar#3");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 2 });
    assert.strictEqual(first.tooltip, "tooltip");
  });
  test("Links, evil provider", async () => {
    disposables.add(extHost.registerDocumentLinkProvider(defaultExtension, defaultSelector, new class {
      provideDocumentLinks() {
        return [new types.DocumentLink(new types.Range(0, 0, 1, 1), URI.parse("foo:bar#3"))];
      }
    }()));
    disposables.add(extHost.registerDocumentLinkProvider(defaultExtension, defaultSelector, new class {
      provideDocumentLinks() {
        throw new Error();
      }
    }()));
    await rpcProtocol.sync();
    const { links } = disposables.add(await getLinks(languageFeaturesService.linkProvider, model, CancellationToken.None));
    assert.strictEqual(links.length, 1);
    const [first] = links;
    assert.strictEqual(first.url?.toString(), "foo:bar#3");
    assert.deepStrictEqual(first.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 2, endColumn: 2 });
  });
  test("Document colors, data conversion", async () => {
    disposables.add(extHost.registerColorProvider(defaultExtension, defaultSelector, new class {
      provideDocumentColors() {
        return [new types.ColorInformation(new types.Range(0, 0, 0, 20), new types.Color(0.1, 0.2, 0.3, 0.4))];
      }
      provideColorPresentations(color, context) {
        return [];
      }
    }()));
    await rpcProtocol.sync();
    const value = await getColors(languageFeaturesService.colorProvider, model, CancellationToken.None);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.deepStrictEqual(first.colorInfo.color, { red: 0.1, green: 0.2, blue: 0.3, alpha: 0.4 });
    assert.deepStrictEqual(first.colorInfo.range, { startLineNumber: 1, startColumn: 1, endLineNumber: 1, endColumn: 21 });
  });
  test("Selection Ranges, data conversion", async () => {
    disposables.add(extHost.registerSelectionRangeProvider(defaultExtension, defaultSelector, new class {
      provideSelectionRanges() {
        return [
          new types.SelectionRange(new types.Range(0, 10, 0, 18), new types.SelectionRange(new types.Range(0, 2, 0, 20)))
        ];
      }
    }()));
    await rpcProtocol.sync();
    provideSelectionRanges(languageFeaturesService.selectionRangeProvider, model, [new Position(1, 17)], { selectLeadingAndTrailingWhitespace: true, selectSubwords: true }, CancellationToken.None).then((ranges) => {
      assert.strictEqual(ranges.length, 1);
      assert.ok(ranges[0].length >= 2);
    });
  });
  test("Selection Ranges, bad data", async () => {
    try {
      const _a = new types.SelectionRange(
        new types.Range(0, 10, 0, 18),
        new types.SelectionRange(new types.Range(0, 11, 0, 18))
      );
      assert.ok(false, String(_a));
    } catch (err) {
      assert.ok(true);
    }
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgc2V0VW5leHBlY3RlZEVycm9ySGFuZGxlciwgZXJyb3JIYW5kbGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlcyBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCB7IGNyZWF0ZVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci90ZXN0L2NvbW1vbi90ZXN0VGV4dE1vZGVsLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIGFzIEVkaXRvclBvc2l0aW9uLCBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSBhcyBFZGl0b3JSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBUZXN0UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2VyU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcyB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvbWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbW1hbmRzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkQ29tbWFuZHMgfSBmcm9tICcuLi8uLi9icm93c2VyL21haW5UaHJlYWRDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnRzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuanMnO1xuaW1wb3J0ICogYXMgbGFuZ3VhZ2VzIGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IGdldENvZGVMZW5zTW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlbGVucy9icm93c2VyL2NvZGVsZW5zLmpzJztcbmltcG9ydCB7IGdldERlZmluaXRpb25zQXRQb3NpdGlvbiwgZ2V0SW1wbGVtZW50YXRpb25zQXRQb3NpdGlvbiwgZ2V0VHlwZURlZmluaXRpb25zQXRQb3NpdGlvbiwgZ2V0RGVjbGFyYXRpb25zQXRQb3NpdGlvbiwgZ2V0UmVmZXJlbmNlc0F0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9nb3RvU3ltYm9sL2Jyb3dzZXIvZ29Ub1N5bWJvbC5qcyc7XG5pbXBvcnQgeyBnZXRIb3ZlcnNQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvaG92ZXIvYnJvd3Nlci9nZXRIb3Zlci5qcyc7XG5pbXBvcnQgeyBnZXRPY2N1cnJlbmNlc0F0UG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi93b3JkSGlnaGxpZ2h0ZXIvYnJvd3Nlci93b3JkSGlnaGxpZ2h0ZXIuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUFjdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2Jyb3dzZXIvY29kZUFjdGlvbi5qcyc7XG5pbXBvcnQgeyBnZXRXb3Jrc3BhY2VTeW1ib2xzIH0gZnJvbSAnLi4vLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyByZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9yZW5hbWUvYnJvd3Nlci9yZW5hbWUuanMnO1xuaW1wb3J0IHsgcHJvdmlkZVNpZ25hdHVyZUhlbHAgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9wYXJhbWV0ZXJIaW50cy9icm93c2VyL3Byb3ZpZGVTaWduYXR1cmVIZWxwLmpzJztcbmltcG9ydCB7IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMsIENvbXBsZXRpb25PcHRpb25zIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3QuanMnO1xuaW1wb3J0IHsgZ2V0RG9jdW1lbnRGb3JtYXR0aW5nRWRpdHNVbnRpbFJlc3VsdCwgZ2V0RG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0c1VudGlsUmVzdWx0LCBnZXRPblR5cGVGb3JtYXR0aW5nRWRpdHMgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9mb3JtYXQvYnJvd3Nlci9mb3JtYXQuanMnO1xuaW1wb3J0IHsgZ2V0TGlua3MgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9saW5rcy9icm93c2VyL2dldExpbmtzLmpzJztcbmltcG9ydCB7IE1haW5Db250ZXh0LCBFeHRIb3N0Q29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEV4dEhvc3REaWFnbm9zdGljcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RGlhZ25vc3RpY3MuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgTnVsbExvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsLCBFbmRPZkxpbmVTZXF1ZW5jZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgZ2V0Q29sb3JzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29sb3JQaWNrZXIvYnJvd3Nlci9jb2xvci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24gYXMgZGVmYXVsdEV4dGVuc2lvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgcHJvdmlkZVNlbGVjdGlvblJhbmdlcyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NtYXJ0U2VsZWN0L2Jyb3dzZXIvc21hcnRTZWxlY3QuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yV29ya2VyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvZWRpdG9yV29ya2VyLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBOdWxsQXBpRGVwcmVjYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RBcGlEZXByZWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUHJvZ3Jlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9ncmVzcy9jb21tb24vcHJvZ3Jlc3MuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RmlsZVN5c3RlbUluZm8uanMnO1xuaW1wb3J0IHsgVVJJVHJhbnNmb3JtZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RVcmlUcmFuc2Zvcm1lclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgT3V0bGluZU1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZG9jdW1lbnRTeW1ib2xzL2Jyb3dzZXIvb3V0bGluZU1vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBMYW5ndWFnZUZlYXR1cmVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlQWN0aW9uL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBJVXJpSWRlbnRpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXJpSWRlbnRpdHkvY29tbW9uL3VyaUlkZW50aXR5LmpzJztcbmltcG9ydCB7IElFeHRIb3N0VGVsZW1ldHJ5IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuXG5zdWl0ZSgnRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMnLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZGVmYXVsdFNlbGVjdG9yID0geyBzY2hlbWU6ICdmYXInIH07XG5cdGxldCBtb2RlbDogSVRleHRNb2RlbDtcblx0bGV0IGV4dEhvc3Q6IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzO1xuXHRsZXQgbWFpblRocmVhZDogTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXM7XG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRsZXQgcnBjUHJvdG9jb2w6IFRlc3RSUENQcm90b2NvbDtcblx0bGV0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2U7XG5cdGxldCBvcmlnaW5hbEVycm9ySGFuZGxlcjogKGU6IGFueSkgPT4gYW55O1xuXHRsZXQgaW5zdGFudGlhdGlvblNlcnZpY2U6IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZTtcblxuXHRzZXR1cCgoKSA9PiB7XG5cblx0XHRtb2RlbCA9IGNyZWF0ZVRleHRNb2RlbChcblx0XHRcdFtcblx0XHRcdFx0J1RoaXMgaXMgdGhlIGZpcnN0IGxpbmUnLFxuXHRcdFx0XHQnVGhpcyBpcyB0aGUgc2Vjb25kIGxpbmUnLFxuXHRcdFx0XHQnVGhpcyBpcyB0aGUgdGhpcmQgbGluZScsXG5cdFx0XHRdLmpvaW4oJ1xcbicpLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0VVJJLnBhcnNlKCdmYXI6Ly90ZXN0aW5nL2ZpbGUuYScpKTtcblxuXHRcdHJwY1Byb3RvY29sID0gbmV3IFRlc3RSUENQcm90b2NvbCgpO1xuXG5cdFx0bGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgPSBuZXcgTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UoKTtcblxuXHRcdC8vIFVzZSBJSW5zdGFudGlhdGlvblNlcnZpY2UgdG8gZ2V0IHR5cGVjaGVja2luZyB3aGVuIGluc3RhbnRpYXRpbmdcblx0XHRsZXQgaW5zdDogSUluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRcdHtcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlID0gbmV3IFRlc3RJbnN0YW50aWF0aW9uU2VydmljZSgpO1xuXHRcdFx0aW5zdGFudGlhdGlvblNlcnZpY2Uuc3R1YihJTWFya2VyU2VydmljZSwgTWFya2VyU2VydmljZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSk7XG5cdFx0XHRpbnN0YW50aWF0aW9uU2VydmljZS5zZXQoSVVyaUlkZW50aXR5U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVXJpSWRlbnRpdHlTZXJ2aWNlPigpIHtcblx0XHRcdFx0b3ZlcnJpZGUgYXNDYW5vbmljYWxVcmkodXJpOiBVUkkpOiBVUkkge1xuXHRcdFx0XHRcdHJldHVybiB1cmk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0aW5zdCA9IGluc3RhbnRpYXRpb25TZXJ2aWNlO1xuXHRcdH1cblxuXHRcdG9yaWdpbmFsRXJyb3JIYW5kbGVyID0gZXJyb3JIYW5kbGVyLmdldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKTtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHRjb25zdCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyhycGNQcm90b2NvbCwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzLiRhY2NlcHREb2N1bWVudHNBbmRFZGl0b3JzRGVsdGEoe1xuXHRcdFx0YWRkZWREb2N1bWVudHM6IFt7XG5cdFx0XHRcdGlzRGlydHk6IGZhbHNlLFxuXHRcdFx0XHR2ZXJzaW9uSWQ6IG1vZGVsLmdldFZlcnNpb25JZCgpLFxuXHRcdFx0XHRsYW5ndWFnZUlkOiBtb2RlbC5nZXRMYW5ndWFnZUlkKCksXG5cdFx0XHRcdHVyaTogbW9kZWwudXJpLFxuXHRcdFx0XHRsaW5lczogbW9kZWwuZ2V0VmFsdWUoKS5zcGxpdChtb2RlbC5nZXRFT0woKSksXG5cdFx0XHRcdEVPTDogbW9kZWwuZ2V0RU9MKCksXG5cdFx0XHRcdGVuY29kaW5nOiAndXRmOCdcblx0XHRcdH1dXG5cdFx0fSk7XG5cdFx0Y29uc3QgZXh0SG9zdERvY3VtZW50cyA9IG5ldyBFeHRIb3N0RG9jdW1lbnRzKHJwY1Byb3RvY29sLCBleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyk7XG5cdFx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3REb2N1bWVudHMsIGV4dEhvc3REb2N1bWVudHMpO1xuXG5cdFx0Y29uc3QgY29tbWFuZHMgPSBuZXcgRXh0SG9zdENvbW1hbmRzKHJwY1Byb3RvY29sLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRXh0SG9zdFRlbGVtZXRyeT4oKSB7XG5cdFx0XHRvdmVycmlkZSBvbkV4dGVuc2lvbkVycm9yKCk6IGJvb2xlYW4ge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdENvbW1hbmRzLCBjb21tYW5kcyk7XG5cdFx0cnBjUHJvdG9jb2wuc2V0KE1haW5Db250ZXh0Lk1haW5UaHJlYWRDb21tYW5kcywgZGlzcG9zYWJsZXMuYWRkKGluc3QuY3JlYXRlSW5zdGFuY2UoTWFpblRocmVhZENvbW1hbmRzLCBycGNQcm90b2NvbCkpKTtcblxuXHRcdGNvbnN0IGRpYWdub3N0aWNzID0gbmV3IEV4dEhvc3REaWFnbm9zdGljcyhycGNQcm90b2NvbCwgbmV3IE51bGxMb2dTZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RGaWxlU3lzdGVtSW5mbz4oKSB7IH0sIGV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzKTtcblx0XHRycGNQcm90b2NvbC5zZXQoRXh0SG9zdENvbnRleHQuRXh0SG9zdERpYWdub3N0aWNzLCBkaWFnbm9zdGljcyk7XG5cblx0XHRleHRIb3N0ID0gbmV3IEV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzKHJwY1Byb3RvY29sLCBuZXcgVVJJVHJhbnNmb3JtZXJTZXJ2aWNlKG51bGwpLCBleHRIb3N0RG9jdW1lbnRzLCBjb21tYW5kcywgZGlhZ25vc3RpY3MsIG5ldyBOdWxsTG9nU2VydmljZSgpLCBOdWxsQXBpRGVwcmVjYXRpb25TZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0VGVsZW1ldHJ5PigpIHtcblx0XHRcdG92ZXJyaWRlIG9uRXh0ZW5zaW9uRXJyb3IoKTogYm9vbGVhbiB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlcywgZXh0SG9zdCk7XG5cblx0XHRtYWluVGhyZWFkID0gcnBjUHJvdG9jb2wuc2V0KE1haW5Db250ZXh0Lk1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLCBkaXNwb3NhYmxlcy5hZGQoaW5zdC5jcmVhdGVJbnN0YW5jZShNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcywgcnBjUHJvdG9jb2wpKSk7XG5cdH0pO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0c2V0VW5leHBlY3RlZEVycm9ySGFuZGxlcihvcmlnaW5hbEVycm9ySGFuZGxlcik7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdG1haW5UaHJlYWQuZGlzcG9zZSgpO1xuXHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLmRpc3Bvc2UoKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdC8vIC0tLSBvdXRsaW5lXG5cblx0dGVzdCgnRG9jdW1lbnRTeW1ib2xzLCByZWdpc3Rlci9kZXJlZ2lzdGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLmFsbChtb2RlbCkubGVuZ3RoLCAwKTtcblx0XHRjb25zdCBkMSA9IGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudFN5bWJvbFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50U3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50U3ltYm9scygpIHtcblx0XHRcdFx0cmV0dXJuIDx2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb25bXT5bXTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlci5hbGwobW9kZWwpLmxlbmd0aCwgMSk7XG5cdFx0ZDEuZGlzcG9zZSgpO1xuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0fSk7XG5cblx0dGVzdCgnRG9jdW1lbnRTeW1ib2xzLCBldmlsIHByb3ZpZGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudFN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdldmlsIGRvY3VtZW50IHN5bWJvbCBwcm92aWRlcicpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRTeW1ib2xQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKCd0ZXN0JywgdHlwZXMuU3ltYm9sS2luZC5GaWVsZCwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gKGF3YWl0IE91dGxpbmVNb2RlbC5jcmVhdGUobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlciwgbW9kZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKS5hc0xpc3RPZkRvY3VtZW50U3ltYm9scygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHR0ZXN0KCdEb2N1bWVudFN5bWJvbHMsIGRhdGEgY29udmVyc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRTeW1ib2xQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKCd0ZXN0JywgdHlwZXMuU3ltYm9sS2luZC5GaWVsZCwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gKGF3YWl0IE91dGxpbmVNb2RlbC5jcmVhdGUobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZG9jdW1lbnRTeW1ib2xQcm92aWRlciwgbW9kZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKS5hc0xpc3RPZkRvY3VtZW50U3ltYm9scygpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IGVudHJ5ID0gdmFsdWVbMF07XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5Lm5hbWUsICd0ZXN0Jyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlbnRyeS5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1F1aWNrIE91dGxpbmUgdXNlcyBhIG5vdCBpZGVhbCBzb3J0aW5nLCAjMTM4NTAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHN5bWJvbHMgPSBbXG5cdFx0XHR7IG5hbWU6ICdjb250YWluZXJzJywgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiAyNiB9IH0sXG5cdFx0XHR7IG5hbWU6ICdjb250YWluZXIgMCcsIHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDUsIGVuZExpbmVOdW1iZXI6IDUsIGVuZENvbHVtbjogMSB9IH0sXG5cdFx0XHR7IG5hbWU6ICduYW1lJywgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBzdGFydENvbHVtbjogNSwgZW5kTGluZU51bWJlcjogMiwgZW5kQ29sdW1uOiAxNiB9IH0sXG5cdFx0XHR7IG5hbWU6ICdwb3J0cycsIHJhbmdlOiB7IHN0YXJ0TGluZU51bWJlcjogMywgc3RhcnRDb2x1bW46IDUsIGVuZExpbmVOdW1iZXI6IDUsIGVuZENvbHVtbjogMSB9IH0sXG5cdFx0XHR7IG5hbWU6ICdwb3J0cyAwJywgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiA0LCBzdGFydENvbHVtbjogOSwgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiAyNiB9IH0sXG5cdFx0XHR7IG5hbWU6ICdjb250YWluZXJQb3J0JywgcmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiA0LCBzdGFydENvbHVtbjogOSwgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiAyNiB9IH1cblx0XHRdO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudFN5bWJvbFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3Rvciwge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50U3ltYm9sczogKGRvYywgdG9rZW4pOiBhbnkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gc3ltYm9scy5tYXAocyA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbihcblx0XHRcdFx0XHRcdHMubmFtZSxcblx0XHRcdFx0XHRcdHR5cGVzLlN5bWJvbEtpbmQuT2JqZWN0LFxuXHRcdFx0XHRcdFx0bmV3IHR5cGVzLlJhbmdlKHMucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyIC0gMSwgcy5yYW5nZS5zdGFydENvbHVtbiAtIDEsIHMucmFuZ2UuZW5kTGluZU51bWJlciAtIDEsIHMucmFuZ2UuZW5kQ29sdW1uIC0gMSlcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCB2YWx1ZSA9IChhd2FpdCBPdXRsaW5lTW9kZWwuY3JlYXRlKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIsIG1vZGVsLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSkuYXNMaXN0T2ZEb2N1bWVudFN5bWJvbHMoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDYpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwodmFsdWUubWFwKHMgPT4gcy5uYW1lKSwgWydjb250YWluZXJzJywgJ2NvbnRhaW5lciAwJywgJ25hbWUnLCAncG9ydHMnLCAncG9ydHMgMCcsICdjb250YWluZXJQb3J0J10pO1xuXHR9KTtcblxuXHQvLyAtLS0gY29kZSBsZW5zXG5cblx0dGVzdCgnQ29kZUxlbnMsIGV2aWwgcHJvdmlkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvZGVMZW5zUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29kZUxlbnNlcygpOiBhbnkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXZpbCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvZGVMZW5zUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29kZUxlbnNQcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb2RlTGVuc2VzKCkge1xuXHRcdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkNvZGVMZW5zKG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSldO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0Q29kZUxlbnNNb2RlbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlTGVuc1Byb3ZpZGVyLCBtb2RlbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuc2VzLmxlbmd0aCwgMSk7XG5cdFx0XHR2YWx1ZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NvZGVMZW5zLCBkbyBub3QgcmVzb2x2ZSBhIHJlc29sdmVkIGxlbnMnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvZGVMZW5zUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29kZUxlbnNlcygpOiBhbnkge1xuXHRcdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkNvZGVMZW5zKFxuXHRcdFx0XHRcdFx0bmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLFxuXHRcdFx0XHRcdFx0eyBjb21tYW5kOiAnaWQnLCB0aXRsZTogJ1RpdGxlJyB9KV07XG5cdFx0XHRcdH1cblx0XHRcdFx0cmVzb2x2ZUNvZGVMZW5zKCk6IGFueSB7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKGZhbHNlLCAnZG8gbm90IHJlc29sdmUnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldENvZGVMZW5zTW9kZWwobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUxlbnNQcm92aWRlciwgbW9kZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbnNlcy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgW2RhdGFdID0gdmFsdWUubGVuc2VzO1xuXHRcdFx0Y29uc3Qgc3ltYm9sID0gYXdhaXQgUHJvbWlzZS5yZXNvbHZlKGRhdGEucHJvdmlkZXIucmVzb2x2ZUNvZGVMZW5zIShtb2RlbCwgZGF0YS5zeW1ib2wsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzeW1ib2whLmNvbW1hbmQhLmlkLCAnaWQnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzeW1ib2whLmNvbW1hbmQhLnRpdGxlLCAnVGl0bGUnKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnQ29kZUxlbnMsIG1pc3NpbmcgY29tbWFuZCcsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvZGVMZW5zUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29kZUxlbnNQcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb2RlTGVuc2VzKCkge1xuXHRcdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkNvZGVMZW5zKG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSldO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0Q29kZUxlbnNNb2RlbChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlTGVuc1Byb3ZpZGVyLCBtb2RlbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuc2VzLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBbZGF0YV0gPSB2YWx1ZS5sZW5zZXM7XG5cdFx0XHRjb25zdCBzeW1ib2wgPSBhd2FpdCBQcm9taXNlLnJlc29sdmUoZGF0YS5wcm92aWRlci5yZXNvbHZlQ29kZUxlbnMhKG1vZGVsLCBkYXRhLnN5bWJvbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN5bWJvbCwgdW5kZWZpbmVkKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tIGRlZmluaXRpb25cblxuXHR0ZXN0KCdEZWZpbml0aW9uLCBkYXRhIGNvbnZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuTG9jYXRpb24obW9kZWwudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMiwgMywgNCkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXREZWZpbml0aW9uc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVmaW5pdGlvblByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCBmYWxzZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2VudHJ5XSA9IHZhbHVlO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZW50cnkucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBzdGFydENvbHVtbjogMywgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiA1IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeS51cmkudG9TdHJpbmcoKSwgbW9kZWwudXJpLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWZpbml0aW9uLCBvbmUgb3IgbWFueScsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRGVmaW5pdGlvblByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRlZmluaXRpb25Qcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRGVmaW5pdGlvbigpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Mb2NhdGlvbihtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAxLCAxLCAxKSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgyLCAxLCAxLCAxKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0RGVmaW5pdGlvbnNBdFBvc2l0aW9uKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRlZmluaXRpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgZmFsc2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWZpbml0aW9uLCByZWdpc3RyYXRpb24gb3JkZXInLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuTG9jYXRpb24oVVJJLnBhcnNlKCdmYXI6Ly9maXJzdCcpLCBuZXcgdHlwZXMuUmFuZ2UoMiwgMywgNCwgNSkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihVUkkucGFyc2UoJ2ZhcjovL3NlY29uZCcpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMiwgMywgNCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldERlZmluaXRpb25zQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kZWZpbml0aW9uUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIGZhbHNlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAyKTtcblx0XHQvLyBsZXQgW2ZpcnN0LCBzZWNvbmRdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlWzBdLnVyaS5hdXRob3JpdHksICdzZWNvbmQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVbMV0udXJpLmF1dGhvcml0eSwgJ2ZpcnN0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlZmluaXRpb24sIGV2aWwgcHJvdmlkZXInLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oKTogYW55IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdldmlsIHByb3ZpZGVyJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRGVmaW5pdGlvblByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRlZmluaXRpb25Qcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRGVmaW5pdGlvbigpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDEsIDEsIDEsIDEpKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXREZWZpbml0aW9uc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVmaW5pdGlvblByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCBmYWxzZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdC8vIC0tIGRlY2xhcmF0aW9uXG5cblx0dGVzdCgnRGVjbGFyYXRpb24sIGRhdGEgY29udmVyc2lvbicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5EZWNsYXJhdGlvblByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEZWNsYXJhdGlvbigpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Mb2NhdGlvbihtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAyLCAzLCA0KSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldERlY2xhcmF0aW9uc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuZGVjbGFyYXRpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgZmFsc2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtlbnRyeV0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVudHJ5LnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDMsIGVuZExpbmVOdW1iZXI6IDQsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnkudXJpLnRvU3RyaW5nKCksIG1vZGVsLnVyaS50b1N0cmluZygpKTtcblx0fSk7XG5cblx0Ly8gLS0tIGltcGxlbWVudGF0aW9uXG5cblx0dGVzdCgnSW1wbGVtZW50YXRpb24sIGRhdGEgY29udmVyc2lvbicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVySW1wbGVtZW50YXRpb25Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5JbXBsZW1lbnRhdGlvblByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVJbXBsZW1lbnRhdGlvbigpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Mb2NhdGlvbihtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAyLCAzLCA0KSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldEltcGxlbWVudGF0aW9uc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaW1wbGVtZW50YXRpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgZmFsc2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtlbnRyeV0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVudHJ5LnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMiwgc3RhcnRDb2x1bW46IDMsIGVuZExpbmVOdW1iZXI6IDQsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnkudXJpLnRvU3RyaW5nKCksIG1vZGVsLnVyaS50b1N0cmluZygpKTtcblx0fSk7XG5cblx0Ly8gLS0tIHR5cGUgZGVmaW5pdGlvblxuXG5cdHRlc3QoJ1R5cGUgRGVmaW5pdGlvbiwgZGF0YSBjb252ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJUeXBlRGVmaW5pdGlvblByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlR5cGVEZWZpbml0aW9uUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVR5cGVEZWZpbml0aW9uKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkxvY2F0aW9uKG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDEsIDIsIDMsIDQpKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0VHlwZURlZmluaXRpb25zQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS50eXBlRGVmaW5pdGlvblByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCBmYWxzZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2VudHJ5XSA9IHZhbHVlO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZW50cnkucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiAyLCBzdGFydENvbHVtbjogMywgZW5kTGluZU51bWJlcjogNCwgZW5kQ29sdW1uOiA1IH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyeS51cmkudG9TdHJpbmcoKSwgbW9kZWwudXJpLnRvU3RyaW5nKCkpO1xuXHR9KTtcblxuXHQvLyAtLS0gZXh0cmEgaW5mb1xuXG5cdHRlc3QoJ0hvdmVyUHJvdmlkZXIsIHdvcmQgcmFuZ2UgYXQgcG9zJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJIb3ZlclByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkhvdmVyUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZUhvdmVyKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuSG92ZXIoJ0hlbGxvJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IGhvdmVycyA9IGF3YWl0IGdldEhvdmVyc1Byb21pc2UobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaG92ZXJQcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvdmVycy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtlbnRyeV0gPSBob3ZlcnM7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlbnRyeS5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDUgfSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnSG92ZXJQcm92aWRlciwgZ2l2ZW4gcmFuZ2UnLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckhvdmVyUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuSG92ZXJQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlSG92ZXIoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Ib3ZlcignSGVsbG8nLCBuZXcgdHlwZXMuUmFuZ2UoMywgMCwgOCwgNykpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCBob3ZlcnMgPSBhd2FpdCBnZXRIb3ZlcnNQcm9taXNlKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmhvdmVyUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChob3ZlcnMubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZW50cnldID0gaG92ZXJzO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZW50cnkucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiA0LCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogOSwgZW5kQ29sdW1uOiA4IH0pO1xuXHR9KTtcblxuXG5cdHRlc3QoJ0hvdmVyUHJvdmlkZXIsIHJlZ2lzdHJhdGlvbiBvcmRlcicsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckhvdmVyUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuSG92ZXJQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlSG92ZXIoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Ib3ZlcigncmVnaXN0ZXJlZCBmaXJzdCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJIb3ZlclByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkhvdmVyUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZUhvdmVyKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuSG92ZXIoJ3JlZ2lzdGVyZWQgc2Vjb25kJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0SG92ZXJzUHJvbWlzZShsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5ob3ZlclByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAyKTtcblx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuY29udGVudHNbMF0udmFsdWUsICdyZWdpc3RlcmVkIHNlY29uZCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuY29udGVudHNbMF0udmFsdWUsICdyZWdpc3RlcmVkIGZpcnN0Jyk7XG5cdH0pO1xuXG5cblx0dGVzdCgnSG92ZXJQcm92aWRlciwgZXZpbCBwcm92aWRlcicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVySG92ZXJQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Ib3ZlclByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVIb3ZlcigpOiBhbnkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2V2aWwnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJIb3ZlclByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkhvdmVyUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZUhvdmVyKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuSG92ZXIoJ0hlbGxvJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IGhvdmVycyA9IGF3YWl0IGdldEhvdmVyc1Byb21pc2UobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuaG92ZXJQcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGhvdmVycy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXHQvLyAtLS0gb2NjdXJyZW5jZXNcblxuXHR0ZXN0KCdPY2N1cnJlbmNlcywgZGF0YSBjb252ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cygpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Eb2N1bWVudEhpZ2hsaWdodChuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgNCkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSAoYXdhaXQgZ2V0T2NjdXJyZW5jZXNBdFBvc2l0aW9uKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMiksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLnNpemUsIDEpO1xuXHRcdGNvbnN0IFtlbnRyeV0gPSBBcnJheS5mcm9tKHZhbHVlLnZhbHVlcygpKVswXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVudHJ5LnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnkua2luZCwgbGFuZ3VhZ2VzLkRvY3VtZW50SGlnaGxpZ2h0S2luZC5UZXh0KTtcblx0fSk7XG5cblx0dGVzdCgnT2NjdXJyZW5jZXMsIG9yZGVyIDEvMicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEhpZ2hsaWdodHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sICcqJywgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cygpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Eb2N1bWVudEhpZ2hsaWdodChuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgNCkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSAoYXdhaXQgZ2V0T2NjdXJyZW5jZXNBdFBvc2l0aW9uKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMiksIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLnNpemUsIDEpO1xuXHRcdGNvbnN0IFtlbnRyeV0gPSBBcnJheS5mcm9tKHZhbHVlLnZhbHVlcygpKVswXTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGVudHJ5LnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogNSB9KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZW50cnkua2luZCwgbGFuZ3VhZ2VzLkRvY3VtZW50SGlnaGxpZ2h0S2luZC5UZXh0KTtcblx0fSk7XG5cblx0dGVzdCgnT2NjdXJyZW5jZXMsIG9yZGVyIDIvMicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEhpZ2hsaWdodHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuRG9jdW1lbnRIaWdobGlnaHQobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDIpKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCAnKicsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEhpZ2hsaWdodHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuRG9jdW1lbnRIaWdobGlnaHQobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDQpKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gKGF3YWl0IGdldE9jY3VycmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDIpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5zaXplLCAxKTtcblx0XHRjb25zdCBbZW50cnldID0gQXJyYXkuZnJvbSh2YWx1ZS52YWx1ZXMoKSlbMF07XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChlbnRyeS5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDMgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVudHJ5LmtpbmQsIGxhbmd1YWdlcy5Eb2N1bWVudEhpZ2hsaWdodEtpbmQuVGV4dCk7XG5cdH0pO1xuXG5cdHRlc3QoJ09jY3VycmVuY2VzLCBldmlsIHByb3ZpZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cygpOiBhbnkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2V2aWwnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRIaWdobGlnaHRQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRIaWdobGlnaHRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkRvY3VtZW50SGlnaGxpZ2h0KG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCA0KSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldE9jY3VycmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDIpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUhLnNpemUsIDEpO1xuXHR9KTtcblxuXHQvLyAtLS0gcmVmZXJlbmNlc1xuXG5cdHRlc3QoJ1JlZmVyZW5jZXMsIHJlZ2lzdHJhdGlvbiBvcmRlcicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyUmVmZXJlbmNlUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuUmVmZXJlbmNlUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVJlZmVyZW5jZXMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuTG9jYXRpb24oVVJJLnBhcnNlKCdmYXI6Ly9yZWdpc3Rlci9maXJzdCcpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlZmVyZW5jZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlZmVyZW5jZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZWZlcmVuY2VzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkxvY2F0aW9uKFVSSS5wYXJzZSgnZmFyOi8vcmVnaXN0ZXIvc2Vjb25kJyksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldFJlZmVyZW5jZXNBdFBvc2l0aW9uKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlZmVyZW5jZVByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDIpLCBmYWxzZSwgZmFsc2UsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDIpO1xuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IHZhbHVlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC51cmkucGF0aCwgJy9zZWNvbmQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLnVyaS5wYXRoLCAnL2ZpcnN0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlZmVyZW5jZXMsIGRhdGEgY29udmVyc2lvbicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyUmVmZXJlbmNlUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuUmVmZXJlbmNlUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVJlZmVyZW5jZXMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuTG9jYXRpb24obW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXRSZWZlcmVuY2VzQXRQb3NpdGlvbihsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5yZWZlcmVuY2VQcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAyKSwgZmFsc2UsIGZhbHNlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbaXRlbV0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGl0ZW0ucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxIH0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpdGVtLnVyaS50b1N0cmluZygpLCBtb2RlbC51cmkudG9TdHJpbmcoKSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlZmVyZW5jZXMsIGV2aWwgcHJvdmlkZXInLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlZmVyZW5jZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlZmVyZW5jZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZWZlcmVuY2VzKCk6IGFueSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXZpbCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlZmVyZW5jZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlZmVyZW5jZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZWZlcmVuY2VzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkxvY2F0aW9uKG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0UmVmZXJlbmNlc0F0UG9zaXRpb24obGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVmZXJlbmNlUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMiksIGZhbHNlLCBmYWxzZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBxdWljayBmaXhcblxuXHR0ZXN0KCdRdWljayBGaXgsIGNvbW1hbmQgZGF0YSBjb252ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoeyB1c2VGYWtlVGltZXJzOiB0cnVlIH0sIGFzeW5jICgpID0+IHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyQ29kZUFjdGlvblByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3Rvciwge1xuXHRcdFx0XHRwcm92aWRlQ29kZUFjdGlvbnMoKTogdnNjb2RlLkNvbW1hbmRbXSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRcdHsgY29tbWFuZDogJ3Rlc3QxJywgdGl0bGU6ICdUZXN0aW5nMScgfSxcblx0XHRcdFx0XHRcdHsgY29tbWFuZDogJ3Rlc3QyJywgdGl0bGU6ICdUZXN0aW5nMicgfVxuXHRcdFx0XHRcdF07XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXRDb2RlQWN0aW9ucyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlQWN0aW9uUHJvdmlkZXIsIG1vZGVsLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB7IHR5cGU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5RdWlja0ZpeCB9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSB2YWx1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zLmxlbmd0aCwgMik7XG5cdFx0XHRjb25zdCBbZmlyc3QsIHNlY29uZF0gPSBhY3Rpb25zO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmFjdGlvbi50aXRsZSwgJ1Rlc3RpbmcxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWN0aW9uLmNvbW1hbmQhLmlkLCAndGVzdDEnKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuYWN0aW9uLnRpdGxlLCAnVGVzdGluZzInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQuYWN0aW9uLmNvbW1hbmQhLmlkLCAndGVzdDInKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnUXVpY2sgRml4LCBjb2RlIGFjdGlvbiBkYXRhIGNvbnZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb2RlQWN0aW9uUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCB7XG5cdFx0XHRcdHByb3ZpZGVDb2RlQWN0aW9ucygpOiB2c2NvZGUuQ29kZUFjdGlvbltdIHtcblx0XHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHR0aXRsZTogJ1Rlc3RpbmcxJyxcblx0XHRcdFx0XHRcdFx0Y29tbWFuZDogeyB0aXRsZTogJ1Rlc3RpbmcxQ29tbWFuZCcsIGNvbW1hbmQ6ICd0ZXN0MScgfSxcblx0XHRcdFx0XHRcdFx0a2luZDogdHlwZXMuQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCd0ZXN0LnNjb3BlJylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgZ2V0Q29kZUFjdGlvbnMobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29kZUFjdGlvblByb3ZpZGVyLCBtb2RlbCwgbW9kZWwuZ2V0RnVsbE1vZGVsUmFuZ2UoKSwgeyB0eXBlOiBsYW5ndWFnZXMuQ29kZUFjdGlvblRyaWdnZXJUeXBlLkludm9rZSwgdHJpZ2dlckFjdGlvbjogQ29kZUFjdGlvblRyaWdnZXJTb3VyY2UuRGVmYXVsdCB9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSB2YWx1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBbZmlyc3RdID0gYWN0aW9ucztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5hY3Rpb24udGl0bGUsICdUZXN0aW5nMScpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmFjdGlvbi5jb21tYW5kIS50aXRsZSwgJ1Rlc3RpbmcxQ29tbWFuZCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmFjdGlvbi5jb21tYW5kIS5pZCwgJ3Rlc3QxJyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWN0aW9uLmtpbmQsICd0ZXN0LnNjb3BlJyk7XG5cdFx0XHR2YWx1ZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cblx0dGVzdCgnQ2Fubm90IHJlYWQgcHJvcGVydHkgXFwnaWRcXCcgb2YgdW5kZWZpbmVkLCAjMjk0NjknLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb2RlQWN0aW9uUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29kZUFjdGlvblByb3ZpZGVyIHtcblx0XHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdG51bGwsXG5cdFx0XHRcdFx0XHR7IGNvbW1hbmQ6ICd0ZXN0JywgdGl0bGU6ICdUZXN0aW5nJyB9XG5cdFx0XHRcdFx0XTtcblx0XHRcdFx0fVxuXHRcdFx0fSkpO1xuXG5cdFx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldENvZGVBY3Rpb25zKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvZGVBY3Rpb25Qcm92aWRlciwgbW9kZWwsIG1vZGVsLmdldEZ1bGxNb2RlbFJhbmdlKCksIHsgdHlwZTogbGFuZ3VhZ2VzLkNvZGVBY3Rpb25UcmlnZ2VyVHlwZS5JbnZva2UsIHRyaWdnZXJBY3Rpb246IENvZGVBY3Rpb25UcmlnZ2VyU291cmNlLkRlZmF1bHQgfSwgUHJvZ3Jlc3MuTm9uZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRjb25zdCB7IHZhbGlkQWN0aW9uczogYWN0aW9ucyB9ID0gdmFsdWU7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYWN0aW9ucy5sZW5ndGgsIDEpO1xuXHRcdFx0dmFsdWUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdRdWljayBGaXgsIGV2aWwgcHJvdmlkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb2RlQWN0aW9uUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29kZUFjdGlvblByb3ZpZGVyIHtcblx0XHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKCk6IGFueSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdldmlsJyk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyQ29kZUFjdGlvblByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvZGVBY3Rpb25Qcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb2RlQWN0aW9ucygpOiBhbnkge1xuXHRcdFx0XHRcdHJldHVybiBbeyBjb21tYW5kOiAndGVzdCcsIHRpdGxlOiAnVGVzdGluZycgfV07XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblxuXHRcdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXRDb2RlQWN0aW9ucyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlQWN0aW9uUHJvdmlkZXIsIG1vZGVsLCBtb2RlbC5nZXRGdWxsTW9kZWxSYW5nZSgpLCB7IHR5cGU6IGxhbmd1YWdlcy5Db2RlQWN0aW9uVHJpZ2dlclR5cGUuSW52b2tlLCB0cmlnZ2VyQWN0aW9uOiBDb2RlQWN0aW9uVHJpZ2dlclNvdXJjZS5RdWlja0ZpeCB9LCBQcm9ncmVzcy5Ob25lLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdGNvbnN0IHsgdmFsaWRBY3Rpb25zOiBhY3Rpb25zIH0gPSB2YWx1ZTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChhY3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHR2YWx1ZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBuYXZpZ2F0ZSB0eXBlc1xuXG5cdHRlc3QoJ05hdmlnYXRlIHR5cGVzLCBldmlsIHByb3ZpZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdldmlsJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ3Rlc3RpbmcnLCB0eXBlcy5TeW1ib2xLaW5kLkFycmF5LCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXRXb3Jrc3BhY2VTeW1ib2xzKCcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnN5bWJvbC5uYW1lLCAndGVzdGluZycpO1xuXHR9KTtcblxuXHR0ZXN0KCdOYXZpZ2F0ZSB0eXBlcywgZGUtZHVwbGljYXRlIHJlc3VsdHMnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdXJpID0gVVJJLmZyb20oeyBzY2hlbWU6ICdmb28nLCBwYXRoOiAnL3NvbWUvcGF0aCcgfSk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ09ORScsIHR5cGVzLlN5bWJvbEtpbmQuQXJyYXksIHVuZGVmaW5lZCwgbmV3IHR5cGVzLkxvY2F0aW9uKHVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDEsIDEpKSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVXb3Jrc3BhY2VTeW1ib2xzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKCdPTkUnLCB0eXBlcy5TeW1ib2xLaW5kLkFycmF5LCB1bmRlZmluZWQsIG5ldyB0eXBlcy5Mb2NhdGlvbih1cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSkpXTsgLy8gZ2V0IGRlLWR1cGVkXG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ09ORScsIHR5cGVzLlN5bWJvbEtpbmQuQXJyYXksIHVuZGVmaW5lZCwgbmV3IHR5cGVzLkxvY2F0aW9uKHVyaSwgdW5kZWZpbmVkISkpXTsgLy8gTk8gZGVkdXBlIGJlY2F1c2Ugb2YgcmVzb2x2ZVxuXHRcdFx0fVxuXHRcdFx0cmVzb2x2ZVdvcmtzcGFjZVN5bWJvbChhOiB2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIGE7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVdvcmtzcGFjZVN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ09ORScsIHR5cGVzLlN5bWJvbEtpbmQuU3RydWN0LCB1bmRlZmluZWQsIG5ldyB0eXBlcy5Mb2NhdGlvbih1cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSkpXTsgLy8gTk8gZGVkdXBlIGJlY2F1c2Ugb2Yga2luZFxuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGdldFdvcmtzcGFjZVN5bWJvbHMoJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDMpO1xuXHR9KTtcblxuXHQvLyAtLS0gcmVuYW1lXG5cblx0dGVzdCgnUmVuYW1lLCBldmlsIHByb3ZpZGVyIDAvMicsIGFzeW5jICgpID0+IHtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyUmVuYW1lUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuUmVuYW1lUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVJlbmFtZUVkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHRocm93IG5ldyBjbGFzcyBGb28geyB9O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgcmVuYW1lKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCAnbmV3TmFtZScpO1xuXHRcdFx0dGhyb3cgRXJyb3IoKTtcblx0XHR9XG5cdFx0Y2F0Y2ggKGVycikge1xuXHRcdFx0Ly8gZXhwZWN0ZWRcblx0XHR9XG5cdH0pO1xuXG5cdHRlc3QoJ1JlbmFtZSwgZXZpbCBwcm92aWRlciAxLzInLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlbmFtZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlbmFtZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cygpOiBhbnkge1xuXHRcdFx0XHR0aHJvdyBFcnJvcignZXZpbCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHJlbmFtZShsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5yZW5hbWVQcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgJ25ld05hbWUnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUucmVqZWN0UmVhc29uLCAnZXZpbCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdSZW5hbWUsIGV2aWwgcHJvdmlkZXIgMi8yJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJSZW5hbWVQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCAnKicsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlUmVuYW1lRWRpdHMoKTogYW55IHtcblx0XHRcdFx0dGhyb3cgRXJyb3IoJ2V2aWwnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlbmFtZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlbmFtZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cygpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBlZGl0ID0gbmV3IHR5cGVzLldvcmtzcGFjZUVkaXQoKTtcblx0XHRcdFx0ZWRpdC5yZXBsYWNlKG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCAndGVzdGluZycpO1xuXHRcdFx0XHRyZXR1cm4gZWRpdDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCByZW5hbWUobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVuYW1lUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksICduZXdOYW1lJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmVkaXRzLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1JlbmFtZSwgb3JkZXJpbmcnLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlclJlbmFtZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sICcqJywgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlJlbmFtZVByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cygpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBlZGl0ID0gbmV3IHR5cGVzLldvcmtzcGFjZUVkaXQoKTtcblx0XHRcdFx0ZWRpdC5yZXBsYWNlKG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCAndGVzdGluZycpO1xuXHRcdFx0XHRlZGl0LnJlcGxhY2UobW9kZWwudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMSwgMCksICd0ZXN0aW5nJyk7XG5cdFx0XHRcdHJldHVybiBlZGl0O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyUmVuYW1lUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuUmVuYW1lUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVJlbmFtZUVkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCByZW5hbWUobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UucmVuYW1lUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksICduZXdOYW1lJyk7XG5cdFx0Ly8gbGVhc3QgcmVsZXZhbnQgcmVuYW1lIHByb3ZpZGVyXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmVkaXRzLmxlbmd0aCwgMik7XG5cdH0pO1xuXG5cdHRlc3QoJ011bHRpcGxlIFJlbmFtZVByb3ZpZGVycyBkb25cXCd0IHJlc3BlY3QgYWxsIHBvc3NpYmxlIFByZXBhcmVSZW5hbWUgaGFuZGxlcnMgMS8yLCAjOTgzNTInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBjYWxsZWQgPSBbZmFsc2UsIGZhbHNlLCBmYWxzZSwgZmFsc2VdO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJSZW5hbWVQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cdFx0XHRwcmVwYXJlUmVuYW1lKGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBwb3NpdGlvbjogdnNjb2RlLlBvc2l0aW9uLCk6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuUmFuZ2U+IHtcblx0XHRcdFx0Y2FsbGVkWzBdID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBkb2N1bWVudC5nZXRXb3JkUmFuZ2VBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdFx0cmV0dXJuIHJhbmdlO1xuXHRcdFx0fVxuXG5cdFx0XHRwcm92aWRlUmVuYW1lRWRpdHMoKTogdnNjb2RlLlByb3ZpZGVyUmVzdWx0PHZzY29kZS5Xb3Jrc3BhY2VFZGl0PiB7XG5cdFx0XHRcdGNhbGxlZFsxXSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJSZW5hbWVQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cdFx0XHRwcmVwYXJlUmVuYW1lKGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBwb3NpdGlvbjogdnNjb2RlLlBvc2l0aW9uLCk6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuUmFuZ2U+IHtcblx0XHRcdFx0Y2FsbGVkWzJdID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KCdDYW5ub3QgcmVuYW1lIHRoaXMgc3ltYm9sMi4nKTtcblx0XHRcdH1cblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cygpOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLldvcmtzcGFjZUVkaXQ+IHtcblx0XHRcdFx0Y2FsbGVkWzNdID0gdHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0YXdhaXQgcmVuYW1lKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCAnbmV3TmFtZScpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChjYWxsZWQsIFt0cnVlLCB0cnVlLCB0cnVlLCBmYWxzZV0pO1xuXHR9KTtcblxuXHR0ZXN0KCdNdWx0aXBsZSBSZW5hbWVQcm92aWRlcnMgZG9uXFwndCByZXNwZWN0IGFsbCBwb3NzaWJsZSBQcmVwYXJlUmVuYW1lIGhhbmRsZXJzIDIvMiwgIzk4MzUyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgY2FsbGVkID0gW2ZhbHNlLCBmYWxzZSwgZmFsc2VdO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJSZW5hbWVQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cdFx0XHRwcmVwYXJlUmVuYW1lKGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBwb3NpdGlvbjogdnNjb2RlLlBvc2l0aW9uLCk6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuUmFuZ2U+IHtcblx0XHRcdFx0Y2FsbGVkWzBdID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgcmFuZ2UgPSBkb2N1bWVudC5nZXRXb3JkUmFuZ2VBdFBvc2l0aW9uKHBvc2l0aW9uKTtcblx0XHRcdFx0cmV0dXJuIHJhbmdlO1xuXHRcdFx0fVxuXG5cdFx0XHRwcm92aWRlUmVuYW1lRWRpdHMoKTogdnNjb2RlLlByb3ZpZGVyUmVzdWx0PHZzY29kZS5Xb3Jrc3BhY2VFZGl0PiB7XG5cdFx0XHRcdGNhbGxlZFsxXSA9IHRydWU7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJSZW5hbWVQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cyhkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgcG9zaXRpb246IHZzY29kZS5Qb3NpdGlvbiwgbmV3TmFtZTogc3RyaW5nLCk6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuV29ya3NwYWNlRWRpdD4ge1xuXHRcdFx0XHRjYWxsZWRbMl0gPSB0cnVlO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLldvcmtzcGFjZUVkaXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0YXdhaXQgcmVuYW1lKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLnJlbmFtZVByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCAnbmV3TmFtZScpO1xuXG5cdFx0Ly8gZmlyc3QgcHJvdmlkZXIgaGFzIE5PIHByZXBhcmUgd2hpY2ggbWVhbnMgaXQgaXMgdGFrZW4gYnkgZGVmYXVsdFxuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoY2FsbGVkLCBbZmFsc2UsIGZhbHNlLCB0cnVlXSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBwYXJhbWV0ZXIgaGludHNcblxuXHR0ZXN0KCdQYXJhbWV0ZXIgSGludHMsIG9yZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVTaWduYXR1cmVIZWxwKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSwgW10pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyU2lnbmF0dXJlSGVscFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlNpZ25hdHVyZUhlbHBQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlU2lnbmF0dXJlSGVscCgpOiB2c2NvZGUuU2lnbmF0dXJlSGVscCB7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c2lnbmF0dXJlczogW10sXG5cdFx0XHRcdFx0YWN0aXZlUGFyYW1ldGVyOiAwLFxuXHRcdFx0XHRcdGFjdGl2ZVNpZ25hdHVyZTogMFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBwcm92aWRlU2lnbmF0dXJlSGVscChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zaWduYXR1cmVIZWxwUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIHsgdHJpZ2dlcktpbmQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQuSW52b2tlLCBpc1JldHJpZ2dlcjogZmFsc2UgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0Lm9rKHZhbHVlKTtcblx0fSk7XG5cblx0dGVzdCgnUGFyYW1ldGVyIEhpbnRzLCBldmlsIHByb3ZpZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuU2lnbmF0dXJlSGVscFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVTaWduYXR1cmVIZWxwKCk6IGFueSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXZpbCcpO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBwcm92aWRlU2lnbmF0dXJlSGVscChsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zaWduYXR1cmVIZWxwUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIHsgdHJpZ2dlcktpbmQ6IGxhbmd1YWdlcy5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQuSW52b2tlLCBpc1JldHJpZ2dlcjogZmFsc2UgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHQvLyAtLS0gc3VnZ2VzdGlvbnNcblxuXHR0ZXN0KCdTdWdnZXN0LCBvcmRlciAxLzMnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sICcqJywgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ3Rlc3RpbmcxJyldO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBbXSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgndGVzdGluZzInKV07XG5cdFx0XHRcdH1cblx0XHRcdH0sIFtdKSk7XG5cblx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgcHJvdmlkZVN1Z2dlc3Rpb25JdGVtcyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIG5ldyBDb21wbGV0aW9uT3B0aW9ucyh1bmRlZmluZWQsIG5ldyBTZXQ8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZD4oKS5hZGQobGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0KSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLml0ZW1zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUuaXRlbXNbMF0uY29tcGxldGlvbi5pbnNlcnRUZXh0LCAndGVzdGluZzInKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTdWdnZXN0LCBvcmRlciAyLzMnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sICcqJywgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ3dlYWstc2VsZWN0b3InKV07IC8vIHdlYWtlciBzZWxlY3RvciBidXQgcmVzdWx0XG5cdFx0XHRcdH1cblx0XHRcdH0sIFtdKSk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Db21wbGV0aW9uSXRlbVByb3ZpZGVyIHtcblx0XHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcygpOiBhbnkge1xuXHRcdFx0XHRcdHJldHVybiBbXTsgLy8gc3Ryb25nZXIgc2VsZWN0b3IgYnV0IG5vdCBhIGdvb2QgcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBbXSkpO1xuXG5cdFx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IHByb3ZpZGVTdWdnZXN0aW9uSXRlbXMobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29tcGxldGlvblByb3ZpZGVyLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCBuZXcgQ29tcGxldGlvbk9wdGlvbnModW5kZWZpbmVkLCBuZXcgU2V0PGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQ+KCkuYWRkKGxhbmd1YWdlcy5Db21wbGV0aW9uSXRlbUtpbmQuU25pcHBldCkpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5pdGVtcy5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLml0ZW1zWzBdLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCwgJ3dlYWstc2VsZWN0b3InKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTdWdnZXN0LCBvcmRlciAzLzMnLCBhc3luYyAoKSA9PiB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7IHVzZUZha2VUaW1lcnM6IHRydWUgfSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ3N0cm9uZy0xJyldO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBbXSkpO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnc3Ryb25nLTInKV07XG5cdFx0XHRcdH1cblx0XHRcdH0sIFtdKSk7XG5cblx0XHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgcHJvdmlkZVN1Z2dlc3Rpb25JdGVtcyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIsIG1vZGVsLCBuZXcgRWRpdG9yUG9zaXRpb24oMSwgMSksIG5ldyBDb21wbGV0aW9uT3B0aW9ucyh1bmRlZmluZWQsIG5ldyBTZXQ8bGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZD4oKS5hZGQobGFuZ3VhZ2VzLkNvbXBsZXRpb25JdGVtS2luZC5TbmlwcGV0KSkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLml0ZW1zLmxlbmd0aCwgMik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUuaXRlbXNbMF0uY29tcGxldGlvbi5pbnNlcnRUZXh0LCAnc3Ryb25nLTEnKTsgLy8gc29ydCBieSBsYWJlbFxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLml0ZW1zWzFdLmNvbXBsZXRpb24uaW5zZXJ0VGV4dCwgJ3N0cm9uZy0yJyk7XG5cdFx0XHR2YWx1ZS5kaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnU3VnZ2VzdCwgZXZpbCBwcm92aWRlcicsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2V2aWwnKTtcblx0XHRcdFx0fVxuXHRcdFx0fSwgW10pKTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXIge1xuXHRcdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ3Rlc3RpbmcnKV07XG5cdFx0XHRcdH1cblx0XHRcdH0sIFtdKSk7XG5cblxuXHRcdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgbmV3IENvbXBsZXRpb25PcHRpb25zKHVuZGVmaW5lZCwgbmV3IFNldDxsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kPigpLmFkZChsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQpKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUuaXRlbXNbMF0uY29udGFpbmVyLmluY29tcGxldGUsIGZhbHNlKTtcblx0XHRcdHZhbHVlLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTdWdnZXN0LCBDb21wbGV0aW9uTGlzdCcsIGFzeW5jICgpID0+IHtcblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHsgdXNlRmFrZVRpbWVyczogdHJ1ZSB9LCBhc3luYyAoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlciB7XG5cdFx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbXBsZXRpb25MaXN0KFs8YW55Pm5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaGVsbG8nKV0sIHRydWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBbXSkpO1xuXG5cdFx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0XHRhd2FpdCBwcm92aWRlU3VnZ2VzdGlvbkl0ZW1zKGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmNvbXBsZXRpb25Qcm92aWRlciwgbW9kZWwsIG5ldyBFZGl0b3JQb3NpdGlvbigxLCAxKSwgbmV3IENvbXBsZXRpb25PcHRpb25zKHVuZGVmaW5lZCwgbmV3IFNldDxsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kPigpLmFkZChsYW5ndWFnZXMuQ29tcGxldGlvbkl0ZW1LaW5kLlNuaXBwZXQpKSkudGhlbihtb2RlbCA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5pdGVtc1swXS5jb250YWluZXIuaW5jb21wbGV0ZSwgdHJ1ZSk7XG5cdFx0XHRcdG1vZGVsLmRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBmb3JtYXRcblxuXHRjb25zdCBOdWxsV29ya2VyU2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUVkaXRvcldvcmtlclNlcnZpY2U+KCkge1xuXHRcdG92ZXJyaWRlIGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKHJlc291cmNlOiBVUkksIGVkaXRzOiBsYW5ndWFnZXMuVGV4dEVkaXRbXSB8IG51bGwgfCB1bmRlZmluZWQpOiBQcm9taXNlPGxhbmd1YWdlcy5UZXh0RWRpdFtdIHwgdW5kZWZpbmVkPiB7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKGVkaXRzID8/IHVuZGVmaW5lZCk7XG5cdFx0fVxuXHR9O1xuXG5cdHRlc3QoJ0Zvcm1hdCBEb2MsIGRhdGEgY29udmVyc2lvbicsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlRleHRFZGl0KG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSwgJ3Rlc3RpbmcnKSwgdHlwZXMuVGV4dEVkaXQuc2V0RW5kT2ZMaW5lKHR5cGVzLkVuZE9mTGluZS5MRildO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IChhd2FpdCBnZXREb2N1bWVudEZvcm1hdHRpbmdFZGl0c1VudGlsUmVzdWx0KE51bGxXb3JrZXJTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWwsIHsgaW5zZXJ0U3BhY2VzOiB0cnVlLCB0YWJTaXplOiA0IH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMik7XG5cdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHQsICd0ZXN0aW5nJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5lb2wsIEVuZE9mTGluZVNlcXVlbmNlLkxGKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLnRleHQsICcnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlY29uZC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBEb2MsIGV2aWwgcHJvdmlkZXInLCBhc3luYyAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEZvcm1hdHRpbmdFZGl0cygpOiBhbnkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2V2aWwnKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0cmV0dXJuIGdldERvY3VtZW50Rm9ybWF0dGluZ0VkaXRzVW50aWxSZXN1bHQoTnVsbFdvcmtlclNlcnZpY2UsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbCwgeyBpbnNlcnRTcGFjZXM6IHRydWUsIHRhYlNpemU6IDQgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBEb2MsIG9yZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEZvcm1hdHRpbmdFZGl0cygpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRGb3JtYXR0aW5nRWRpdHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVGV4dEVkaXQobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCAndGVzdGluZycpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gKGF3YWl0IGdldERvY3VtZW50Rm9ybWF0dGluZ0VkaXRzVW50aWxSZXN1bHQoTnVsbFdvcmtlclNlcnZpY2UsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbCwgeyBpbnNlcnRTcGFjZXM6IHRydWUsIHRhYlNpemU6IDQgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHQsICd0ZXN0aW5nJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBSYW5nZSwgZGF0YSBjb252ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVGV4dEVkaXQobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCAndGVzdGluZycpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSAoYXdhaXQgZ2V0RG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0c1VudGlsUmVzdWx0KE51bGxXb3JrZXJTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWwsIG5ldyBFZGl0b3JSYW5nZSgxLCAxLCAxLCAxKSwgeyBpbnNlcnRTcGFjZXM6IHRydWUsIHRhYlNpemU6IDQgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHQsICd0ZXN0aW5nJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxLCBlbmRDb2x1bW46IDEgfSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBSYW5nZSwgKyBmb3JtYXRfZG9jJywgYXN5bmMgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVGV4dEVkaXQobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCAncmFuZ2UnKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVGV4dEVkaXQobmV3IHR5cGVzLlJhbmdlKDIsIDMsIDQsIDUpLCAncmFuZ2UyJyldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50Rm9ybWF0dGluZ0VkaXRQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudEZvcm1hdHRpbmdFZGl0UHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50Rm9ybWF0dGluZ0VkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlRleHRFZGl0KG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSwgJ2RvYycpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHZhbHVlID0gKGF3YWl0IGdldERvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdHNVbnRpbFJlc3VsdChOdWxsV29ya2VyU2VydmljZSwgbGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG1vZGVsLCBuZXcgRWRpdG9yUmFuZ2UoMSwgMSwgMSwgMSksIHsgaW5zZXJ0U3BhY2VzOiB0cnVlLCB0YWJTaXplOiA0IH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0LCAncmFuZ2UyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLnN0YXJ0TGluZU51bWJlciwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLnN0YXJ0Q29sdW1uLCA0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UuZW5kTGluZU51bWJlciwgNSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLmVuZENvbHVtbiwgNik7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBSYW5nZSwgZXZpbCBwcm92aWRlcicsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkRvY3VtZW50UmFuZ2VGb3JtYXR0aW5nRWRpdFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudFJhbmdlRm9ybWF0dGluZ0VkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZXZpbCcpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRyZXR1cm4gZ2V0RG9jdW1lbnRSYW5nZUZvcm1hdHRpbmdFZGl0c1VudGlsUmVzdWx0KE51bGxXb3JrZXJTZXJ2aWNlLCBsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbW9kZWwsIG5ldyBFZGl0b3JSYW5nZSgxLCAxLCAxLCAxKSwgeyBpbnNlcnRTcGFjZXM6IHRydWUsIHRhYlNpemU6IDQgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0Zvcm1hdCBvbiBUeXBlLCBkYXRhIGNvbnZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3Rlck9uVHlwZUZvcm1hdHRpbmdFZGl0UHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuT25UeXBlRm9ybWF0dGluZ0VkaXRQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlT25UeXBlRm9ybWF0dGluZ0VkaXRzKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlRleHRFZGl0KG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSwgYXJndW1lbnRzWzJdKV07XG5cdFx0XHR9XG5cdFx0fSwgWyc7J10pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IChhd2FpdCBnZXRPblR5cGVGb3JtYXR0aW5nRWRpdHMoTnVsbFdvcmtlclNlcnZpY2UsIGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBtb2RlbCwgbmV3IEVkaXRvclBvc2l0aW9uKDEsIDEpLCAnOycsIHsgaW5zZXJ0U3BhY2VzOiB0cnVlLCB0YWJTaXplOiAyIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0LCAnOycpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UsIHsgc3RhcnRMaW5lTnVtYmVyOiAxLCBzdGFydENvbHVtbjogMSwgZW5kTGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxIH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdMaW5rcywgZGF0YSBjb252ZXJzaW9uJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudExpbmtQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRMaW5rcygpIHtcblx0XHRcdFx0Y29uc3QgbGluayA9IG5ldyB0eXBlcy5Eb2N1bWVudExpbmsobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDEsIDEpLCBVUkkucGFyc2UoJ2ZvbzpiYXIjMycpKTtcblx0XHRcdFx0bGluay50b29sdGlwID0gJ3Rvb2x0aXAnO1xuXHRcdFx0XHRyZXR1cm4gW2xpbmtdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB7IGxpbmtzIH0gPSBkaXNwb3NhYmxlcy5hZGQoYXdhaXQgZ2V0TGlua3MobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UubGlua1Byb3ZpZGVyLCBtb2RlbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5rcy5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSBsaW5rcztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudXJsPy50b1N0cmluZygpLCAnZm9vOmJhciMzJyk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChmaXJzdC5yYW5nZSwgeyBzdGFydExpbmVOdW1iZXI6IDEsIHN0YXJ0Q29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAyLCBlbmRDb2x1bW46IDIgfSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRvb2x0aXAsICd0b29sdGlwJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0xpbmtzLCBldmlsIHByb3ZpZGVyJywgYXN5bmMgKCkgPT4ge1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihkZWZhdWx0RXh0ZW5zaW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5Eb2N1bWVudExpbmtQcm92aWRlciB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRMaW5rcygpIHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuRG9jdW1lbnRMaW5rKG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSwgVVJJLnBhcnNlKCdmb286YmFyIzMnKSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRMaW5rUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRMaW5rUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZURvY3VtZW50TGlua3MoKTogYW55IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IHsgbGlua3MgfSA9IGRpc3Bvc2FibGVzLmFkZChhd2FpdCBnZXRMaW5rcyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5saW5rUHJvdmlkZXIsIG1vZGVsLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmtzLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW2ZpcnN0XSA9IGxpbmtzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC51cmw/LnRvU3RyaW5nKCksICdmb286YmFyIzMnKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDIsIGVuZENvbHVtbjogMiB9KTtcblx0fSk7XG5cblx0dGVzdCgnRG9jdW1lbnQgY29sb3JzLCBkYXRhIGNvbnZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoZXh0SG9zdC5yZWdpc3RlckNvbG9yUHJvdmlkZXIoZGVmYXVsdEV4dGVuc2lvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRDb2xvclByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudENvbG9ycygpOiB2c2NvZGUuQ29sb3JJbmZvcm1hdGlvbltdIHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29sb3JJbmZvcm1hdGlvbihuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMjApLCBuZXcgdHlwZXMuQ29sb3IoMC4xLCAwLjIsIDAuMywgMC40KSldO1xuXHRcdFx0fVxuXHRcdFx0cHJvdmlkZUNvbG9yUHJlc2VudGF0aW9ucyhjb2xvcjogdnNjb2RlLkNvbG9yLCBjb250ZXh0OiB7IHJhbmdlOiB2c2NvZGUuUmFuZ2U7IGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50IH0pOiB2c2NvZGUuQ29sb3JQcmVzZW50YXRpb25bXSB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBnZXRDb2xvcnMobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UuY29sb3JQcm92aWRlciwgbW9kZWwsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdGNvbnN0IFtmaXJzdF0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LmNvbG9ySW5mby5jb2xvciwgeyByZWQ6IDAuMSwgZ3JlZW46IDAuMiwgYmx1ZTogMC4zLCBhbHBoYTogMC40IH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoZmlyc3QuY29sb3JJbmZvLnJhbmdlLCB7IHN0YXJ0TGluZU51bWJlcjogMSwgc3RhcnRDb2x1bW46IDEsIGVuZExpbmVOdW1iZXI6IDEsIGVuZENvbHVtbjogMjEgfSk7XG5cdH0pO1xuXG5cdC8vIC0tIHNlbGVjdGlvbiByYW5nZXNcblxuXHR0ZXN0KCdTZWxlY3Rpb24gUmFuZ2VzLCBkYXRhIGNvbnZlcnNpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKGV4dEhvc3QucmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKGRlZmF1bHRFeHRlbnNpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLlNlbGVjdGlvblJhbmdlUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVNlbGVjdGlvblJhbmdlcygpIHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuU2VsZWN0aW9uUmFuZ2UobmV3IHR5cGVzLlJhbmdlKDAsIDEwLCAwLCAxOCksIG5ldyB0eXBlcy5TZWxlY3Rpb25SYW5nZShuZXcgdHlwZXMuUmFuZ2UoMCwgMiwgMCwgMjApKSksXG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXG5cdFx0cHJvdmlkZVNlbGVjdGlvblJhbmdlcyhsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5zZWxlY3Rpb25SYW5nZVByb3ZpZGVyLCBtb2RlbCwgW25ldyBQb3NpdGlvbigxLCAxNyldLCB7IHNlbGVjdExlYWRpbmdBbmRUcmFpbGluZ1doaXRlc3BhY2U6IHRydWUsIHNlbGVjdFN1YndvcmRzOiB0cnVlIH0sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4ocmFuZ2VzID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZXMubGVuZ3RoLCAxKTtcblx0XHRcdGFzc2VydC5vayhyYW5nZXNbMF0ubGVuZ3RoID49IDIpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0KCdTZWxlY3Rpb24gUmFuZ2VzLCBiYWQgZGF0YScsIGFzeW5jICgpID0+IHtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBfYSA9IG5ldyB0eXBlcy5TZWxlY3Rpb25SYW5nZShuZXcgdHlwZXMuUmFuZ2UoMCwgMTAsIDAsIDE4KSxcblx0XHRcdFx0bmV3IHR5cGVzLlNlbGVjdGlvblJhbmdlKG5ldyB0eXBlcy5SYW5nZSgwLCAxMSwgMCwgMTgpKVxuXHRcdFx0KTtcblx0XHRcdGFzc2VydC5vayhmYWxzZSwgU3RyaW5nKF9hKSk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRhc3NlcnQub2sodHJ1ZSk7XG5cdFx0fVxuXG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywyQkFBMkIsb0JBQW9CO0FBQ3hELFNBQVMsV0FBVztBQUNwQixZQUFZLFdBQVc7QUFDdkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxZQUFZLGdCQUFnQixnQkFBZ0I7QUFDckQsU0FBUyxTQUFTLG1CQUFtQjtBQUNyQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLCtCQUErQjtBQUN4QyxTQUFTLGtDQUFrQztBQUMzQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGtDQUFrQztBQUMzQyxZQUFZLGVBQWU7QUFDM0IsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEIsOEJBQThCLDhCQUE4QiwyQkFBMkIsK0JBQStCO0FBQ3pKLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsY0FBYztBQUN2QixTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHdCQUF3Qix5QkFBeUI7QUFDMUQsU0FBUyx1Q0FBdUMsNENBQTRDLGdDQUFn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
