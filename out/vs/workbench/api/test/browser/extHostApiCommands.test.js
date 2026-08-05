import "../../../../editor/contrib/codeAction/browser/codeAction.js";
import "../../../../editor/contrib/codelens/browser/codelens.js";
import "../../../../editor/contrib/colorPicker/browser/colorPickerContribution.js";
import "../../../../editor/contrib/format/browser/format.js";
import "../../../../editor/contrib/gotoSymbol/browser/goToCommands.js";
import "../../../../editor/contrib/documentSymbols/browser/documentSymbols.js";
import "../../../../editor/contrib/hover/browser/getHover.js";
import "../../../../editor/contrib/links/browser/getLinks.js";
import "../../../../editor/contrib/parameterHints/browser/provideSignatureHelp.js";
import "../../../../editor/contrib/smartSelect/browser/smartSelect.js";
import "../../../../editor/contrib/suggest/browser/suggest.js";
import "../../../../editor/contrib/rename/browser/rename.js";
import "../../../../editor/contrib/inlayHints/browser/inlayHintsController.js";
import assert from "assert";
import { setUnexpectedErrorHandler, errorHandler } from "../../../../base/common/errors.js";
import { URI } from "../../../../base/common/uri.js";
import { Event } from "../../../../base/common/event.js";
import * as types from "../../common/extHostTypes.js";
import { createTextModel } from "../../../../editor/test/common/testTextModel.js";
import { TestRPCProtocol } from "../common/testRPCProtocol.js";
import { MarkerService } from "../../../../platform/markers/common/markerService.js";
import { IMarkerService } from "../../../../platform/markers/common/markers.js";
import { ICommandService, CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ExtHostLanguageFeatures } from "../../common/extHostLanguageFeatures.js";
import { MainThreadLanguageFeatures } from "../../browser/mainThreadLanguageFeatures.js";
import { ExtHostApiCommands } from "../../common/extHostApiCommands.js";
import { ExtHostCommands } from "../../common/extHostCommands.js";
import { MainThreadCommands } from "../../browser/mainThreadCommands.js";
import { ExtHostDocuments } from "../../common/extHostDocuments.js";
import { ExtHostDocumentsAndEditors } from "../../common/extHostDocumentsAndEditors.js";
import { MainContext, ExtHostContext } from "../../common/extHost.protocol.js";
import { ExtHostDiagnostics } from "../../common/extHostDiagnostics.js";
import "../../../contrib/search/browser/search.contribution.js";
import { ILogService, NullLogService } from "../../../../platform/log/common/log.js";
import { nullExtensionDescription, IExtensionService } from "../../../services/extensions/common/extensions.js";
import { dispose, ImmortalReference } from "../../../../base/common/lifecycle.js";
import { IEditorWorkerService } from "../../../../editor/common/services/editorWorker.js";
import { mock } from "../../../../base/test/common/mock.js";
import { NullApiDeprecationService } from "../../common/extHostApiDeprecationService.js";
import { ServiceCollection } from "../../../../platform/instantiation/common/serviceCollection.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { URITransformerService } from "../../common/extHostUriTransformerService.js";
import { IOutlineModelService, OutlineModelService } from "../../../../editor/contrib/documentSymbols/browser/outlineModel.js";
import { ILanguageFeatureDebounceService, LanguageFeatureDebounceService } from "../../../../editor/common/services/languageFeatureDebounce.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { LanguageFeaturesService } from "../../../../editor/common/services/languageFeaturesService.js";
import { assertType } from "../../../../base/common/types.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { TestConfigurationService } from "../../../../platform/configuration/test/common/testConfigurationService.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { TestInstantiationService } from "../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { timeout } from "../../../../base/common/async.js";
function assertRejects(fn, message = "Expected rejection") {
  return fn().then(() => assert.ok(false, message), (_err) => assert.ok(true));
}
function isLocation(value) {
  const candidate = value;
  return candidate && candidate.uri instanceof URI && candidate.range instanceof types.Range;
}
suite("ExtHostLanguageFeatureCommands", function() {
  const defaultSelector = { scheme: "far" };
  let model;
  let insta;
  let rpcProtocol;
  let extHost;
  let mainThread;
  let commands;
  let disposables = [];
  let originalErrorHandler;
  suiteSetup(() => {
    model = createTextModel(
      [
        "This is the first line",
        "This is the second line",
        "This is the third line"
      ].join("\n"),
      void 0,
      void 0,
      URI.parse("far://testing/file.b")
    );
    originalErrorHandler = errorHandler.getUnexpectedErrorHandler();
    setUnexpectedErrorHandler(() => {
    });
    rpcProtocol = new TestRPCProtocol();
    const services = new ServiceCollection();
    services.set(IUriIdentityService, new class extends mock() {
      asCanonicalUri(uri) {
        return uri;
      }
    }());
    services.set(ILanguageFeaturesService, new SyncDescriptor(LanguageFeaturesService));
    services.set(IExtensionService, new class extends mock() {
      async activateByEvent() {
      }
      activationEventIsDone(activationEvent) {
        return true;
      }
    }());
    services.set(ICommandService, new SyncDescriptor(class extends mock() {
      executeCommand(id, ...args) {
        const command = CommandsRegistry.getCommands().get(id);
        if (!command) {
          return Promise.reject(new Error(id + " NOT known"));
        }
        const { handler } = command;
        return Promise.resolve(insta.invokeFunction(handler, ...args));
      }
    }));
    services.set(IEnvironmentService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.isBuilt = true;
        this.isExtensionDevelopment = false;
      }
    }());
    services.set(IMarkerService, new MarkerService());
    services.set(ILogService, new SyncDescriptor(NullLogService));
    services.set(ILanguageFeatureDebounceService, new SyncDescriptor(LanguageFeatureDebounceService));
    services.set(IModelService, new class extends mock() {
      constructor() {
        super(...arguments);
        this.onModelRemoved = Event.None;
      }
      getModel() {
        return model;
      }
    }());
    services.set(ITextModelService, new class extends mock() {
      async createModelReference() {
        return new ImmortalReference(new class extends mock() {
          constructor() {
            super(...arguments);
            this.textEditorModel = model;
          }
        }());
      }
    }());
    services.set(IEditorWorkerService, new class extends mock() {
      async computeMoreMinimalEdits(_uri, edits) {
        return edits || void 0;
      }
    }());
    services.set(ILanguageFeatureDebounceService, new SyncDescriptor(LanguageFeatureDebounceService));
    services.set(IOutlineModelService, new SyncDescriptor(OutlineModelService));
    services.set(IConfigurationService, new TestConfigurationService());
    insta = new TestInstantiationService(services);
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
    commands = new ExtHostCommands(rpcProtocol, new NullLogService(), new class extends mock() {
      onExtensionError() {
        return true;
      }
    }());
    rpcProtocol.set(ExtHostContext.ExtHostCommands, commands);
    rpcProtocol.set(MainContext.MainThreadCommands, insta.createInstance(MainThreadCommands, rpcProtocol));
    ExtHostApiCommands.register(commands);
    const diagnostics = new ExtHostDiagnostics(rpcProtocol, new NullLogService(), new class extends mock() {
    }(), extHostDocumentsAndEditors);
    rpcProtocol.set(ExtHostContext.ExtHostDiagnostics, diagnostics);
    extHost = new ExtHostLanguageFeatures(rpcProtocol, new URITransformerService(null), extHostDocuments, commands, diagnostics, new NullLogService(), NullApiDeprecationService, new class extends mock() {
      onExtensionError() {
        return true;
      }
    }());
    rpcProtocol.set(ExtHostContext.ExtHostLanguageFeatures, extHost);
    mainThread = rpcProtocol.set(MainContext.MainThreadLanguageFeatures, insta.createInstance(MainThreadLanguageFeatures, rpcProtocol));
    insta.get(IOutlineModelService);
    return rpcProtocol.sync();
  });
  suiteTeardown(() => {
    setUnexpectedErrorHandler(originalErrorHandler);
    model.dispose();
    mainThread.dispose();
    insta.get(IOutlineModelService).dispose();
    insta.dispose();
  });
  teardown(() => {
    disposables = dispose(disposables);
    return rpcProtocol.sync();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  function testApiCmd(name, fn) {
    test(name, async function() {
      await runWithFakedTimers({}, async () => {
        await fn();
        await timeout(1e4);
      });
    });
  }
  test("WorkspaceSymbols, invalid arguments", function() {
    const promises = [
      assertRejects(() => commands.executeCommand("vscode.executeWorkspaceSymbolProvider")),
      assertRejects(() => commands.executeCommand("vscode.executeWorkspaceSymbolProvider", null)),
      assertRejects(() => commands.executeCommand("vscode.executeWorkspaceSymbolProvider", void 0)),
      assertRejects(() => commands.executeCommand("vscode.executeWorkspaceSymbolProvider", true))
    ];
    return Promise.all(promises);
  });
  test("WorkspaceSymbols, back and forth", function() {
    disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
      provideWorkspaceSymbols(query) {
        return [
          new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse("far://testing/first")),
          new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse("far://testing/second"))
        ];
      }
    }));
    disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
      provideWorkspaceSymbols(query) {
        return [
          new types.SymbolInformation(query, types.SymbolKind.Array, new types.Range(0, 0, 1, 1), URI.parse("far://testing/first"))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeWorkspaceSymbolProvider", "testing").then((value) => {
        assert.strictEqual(value.length, 2);
        for (const info of value) {
          assert.strictEqual(info instanceof types.SymbolInformation, true);
          assert.strictEqual(info.name, "testing");
          assert.strictEqual(info.kind, types.SymbolKind.Array);
        }
      });
    });
  });
  test("executeWorkspaceSymbolProvider should accept empty string, #39522", async function() {
    disposables.push(extHost.registerWorkspaceSymbolProvider(nullExtensionDescription, {
      provideWorkspaceSymbols() {
        return [new types.SymbolInformation("hello", types.SymbolKind.Array, new types.Range(0, 0, 0, 0), URI.parse("foo:bar"))];
      }
    }));
    await rpcProtocol.sync();
    let symbols = await commands.executeCommand("vscode.executeWorkspaceSymbolProvider", "");
    assert.strictEqual(symbols.length, 1);
    await rpcProtocol.sync();
    symbols = await commands.executeCommand("vscode.executeWorkspaceSymbolProvider", "*");
    assert.strictEqual(symbols.length, 1);
  });
  test("executeFormatDocumentProvider, back and forth", async function() {
    disposables.push(extHost.registerDocumentFormattingEditProvider(nullExtensionDescription, defaultSelector, new class {
      provideDocumentFormattingEdits() {
        return [types.TextEdit.insert(new types.Position(0, 0), "42")];
      }
    }()));
    await rpcProtocol.sync();
    const edits = await commands.executeCommand("vscode.executeFormatDocumentProvider", model.uri);
    assert.strictEqual(edits.length, 1);
  });
  test("vscode.prepareRename", async function() {
    disposables.push(extHost.registerRenameProvider(nullExtensionDescription, defaultSelector, new class {
      prepareRename(document, position) {
        return {
          range: new types.Range(0, 12, 0, 24),
          placeholder: "foooPlaceholder"
        };
      }
      provideRenameEdits(document, position, newName) {
        const edit = new types.WorkspaceEdit();
        edit.insert(document.uri, position, newName);
        return edit;
      }
    }()));
    await rpcProtocol.sync();
    const data = await commands.executeCommand("vscode.prepareRename", model.uri, new types.Position(0, 12));
    assert.ok(data);
    assert.strictEqual(data.placeholder, "foooPlaceholder");
    assert.strictEqual(data.range.start.line, 0);
    assert.strictEqual(data.range.start.character, 12);
    assert.strictEqual(data.range.end.line, 0);
    assert.strictEqual(data.range.end.character, 24);
  });
  test("vscode.executeDocumentRenameProvider", async function() {
    disposables.push(extHost.registerRenameProvider(nullExtensionDescription, defaultSelector, new class {
      provideRenameEdits(document, position, newName) {
        const edit2 = new types.WorkspaceEdit();
        edit2.insert(document.uri, position, newName);
        return edit2;
      }
    }()));
    await rpcProtocol.sync();
    const edit = await commands.executeCommand("vscode.executeDocumentRenameProvider", model.uri, new types.Position(0, 12), "newNameOfThis");
    assert.ok(edit);
    assert.strictEqual(edit.has(model.uri), true);
    const textEdits = edit.get(model.uri);
    assert.strictEqual(textEdits.length, 1);
    assert.strictEqual(textEdits[0].newText, "newNameOfThis");
  });
  test("Definition, invalid arguments", function() {
    const promises = [
      assertRejects(() => commands.executeCommand("vscode.executeDefinitionProvider")),
      assertRejects(() => commands.executeCommand("vscode.executeDefinitionProvider", null)),
      assertRejects(() => commands.executeCommand("vscode.executeDefinitionProvider", void 0)),
      assertRejects(() => commands.executeCommand("vscode.executeDefinitionProvider", true, false))
    ];
    return Promise.all(promises);
  });
  test("Definition, back and forth", function() {
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return [
          new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(4, 0, 0, 0))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDefinitionProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 4);
        for (const v of values) {
          assert.ok(v.uri instanceof URI);
          assert.ok(v.range instanceof types.Range);
        }
      });
    });
  });
  test("Definition, back and forth (sorting & de-deduping)", function() {
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return new types.Location(URI.parse("file:///b"), new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return new types.Location(URI.parse("file:///b"), new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return [
          new types.Location(URI.parse("file:///a"), new types.Range(2, 0, 0, 0)),
          new types.Location(URI.parse("file:///c"), new types.Range(3, 0, 0, 0)),
          new types.Location(URI.parse("file:///d"), new types.Range(4, 0, 0, 0))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDefinitionProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 4);
        assert.strictEqual(values[0].uri.path, "/a");
        assert.strictEqual(values[1].uri.path, "/b");
        assert.strictEqual(values[2].uri.path, "/c");
        assert.strictEqual(values[3].uri.path, "/d");
      });
    });
  });
  test("Definition Link", () => {
    disposables.push(extHost.registerDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideDefinition(doc) {
        return [
          new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
          { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDefinitionProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 2);
        for (const v of values) {
          if (isLocation(v)) {
            assert.ok(v.uri instanceof URI);
            assert.ok(v.range instanceof types.Range);
          } else {
            assert.ok(v.targetUri instanceof URI);
            assert.ok(v.targetRange instanceof types.Range);
            assert.ok(v.targetSelectionRange instanceof types.Range);
            assert.ok(v.originSelectionRange instanceof types.Range);
          }
        }
      });
    });
  });
  test("Declaration, back and forth", function() {
    disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
      provideDeclaration(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
      provideDeclaration(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
      provideDeclaration(doc) {
        return [
          new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(4, 0, 0, 0))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDeclarationProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 4);
        for (const v of values) {
          assert.ok(v.uri instanceof URI);
          assert.ok(v.range instanceof types.Range);
        }
      });
    });
  });
  test("Declaration Link", () => {
    disposables.push(extHost.registerDeclarationProvider(nullExtensionDescription, defaultSelector, {
      provideDeclaration(doc) {
        return [
          new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
          { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDeclarationProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 2);
        for (const v of values) {
          if (isLocation(v)) {
            assert.ok(v.uri instanceof URI);
            assert.ok(v.range instanceof types.Range);
          } else {
            assert.ok(v.targetUri instanceof URI);
            assert.ok(v.targetRange instanceof types.Range);
            assert.ok(v.targetSelectionRange instanceof types.Range);
            assert.ok(v.originSelectionRange instanceof types.Range);
          }
        }
      });
    });
  });
  test("Type Definition, invalid arguments", function() {
    const promises = [
      assertRejects(() => commands.executeCommand("vscode.executeTypeDefinitionProvider")),
      assertRejects(() => commands.executeCommand("vscode.executeTypeDefinitionProvider", null)),
      assertRejects(() => commands.executeCommand("vscode.executeTypeDefinitionProvider", void 0)),
      assertRejects(() => commands.executeCommand("vscode.executeTypeDefinitionProvider", true, false))
    ];
    return Promise.all(promises);
  });
  test("Type Definition, back and forth", function() {
    disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideTypeDefinition(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideTypeDefinition(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideTypeDefinition(doc) {
        return [
          new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(4, 0, 0, 0))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeTypeDefinitionProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 4);
        for (const v of values) {
          assert.ok(v.uri instanceof URI);
          assert.ok(v.range instanceof types.Range);
        }
      });
    });
  });
  test("Type Definition Link", () => {
    disposables.push(extHost.registerTypeDefinitionProvider(nullExtensionDescription, defaultSelector, {
      provideTypeDefinition(doc) {
        return [
          new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
          { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeTypeDefinitionProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 2);
        for (const v of values) {
          if (isLocation(v)) {
            assert.ok(v.uri instanceof URI);
            assert.ok(v.range instanceof types.Range);
          } else {
            assert.ok(v.targetUri instanceof URI);
            assert.ok(v.targetRange instanceof types.Range);
            assert.ok(v.targetSelectionRange instanceof types.Range);
            assert.ok(v.originSelectionRange instanceof types.Range);
          }
        }
      });
    });
  });
  test("Implementation, invalid arguments", function() {
    const promises = [
      assertRejects(() => commands.executeCommand("vscode.executeImplementationProvider")),
      assertRejects(() => commands.executeCommand("vscode.executeImplementationProvider", null)),
      assertRejects(() => commands.executeCommand("vscode.executeImplementationProvider", void 0)),
      assertRejects(() => commands.executeCommand("vscode.executeImplementationProvider", true, false))
    ];
    return Promise.all(promises);
  });
  test("Implementation, back and forth", function() {
    disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
      provideImplementation(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
      provideImplementation(doc) {
        return new types.Location(doc.uri, new types.Range(1, 0, 0, 0));
      }
    }));
    disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
      provideImplementation(doc) {
        return [
          new types.Location(doc.uri, new types.Range(2, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(3, 0, 0, 0)),
          new types.Location(doc.uri, new types.Range(4, 0, 0, 0))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeImplementationProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 4);
        for (const v of values) {
          assert.ok(v.uri instanceof URI);
          assert.ok(v.range instanceof types.Range);
        }
      });
    });
  });
  test("Implementation Definition Link", () => {
    disposables.push(extHost.registerImplementationProvider(nullExtensionDescription, defaultSelector, {
      provideImplementation(doc) {
        return [
          new types.Location(doc.uri, new types.Range(0, 0, 0, 0)),
          { targetUri: doc.uri, targetRange: new types.Range(1, 0, 0, 0), targetSelectionRange: new types.Range(1, 1, 1, 1), originSelectionRange: new types.Range(2, 2, 2, 2) }
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeImplementationProvider", model.uri, new types.Position(0, 0)).then((values) => {
        assert.strictEqual(values.length, 2);
        for (const v of values) {
          if (isLocation(v)) {
            assert.ok(v.uri instanceof URI);
            assert.ok(v.range instanceof types.Range);
          } else {
            assert.ok(v.targetUri instanceof URI);
            assert.ok(v.targetRange instanceof types.Range);
            assert.ok(v.targetSelectionRange instanceof types.Range);
            assert.ok(v.originSelectionRange instanceof types.Range);
          }
        }
      });
    });
  });
  test("reference search, back and forth", function() {
    disposables.push(extHost.registerReferenceProvider(nullExtensionDescription, defaultSelector, {
      provideReferences() {
        return [
          new types.Location(URI.parse("some:uri/path"), new types.Range(0, 1, 0, 5))
        ];
      }
    }));
    return commands.executeCommand("vscode.executeReferenceProvider", model.uri, new types.Position(0, 0)).then((values) => {
      assert.strictEqual(values.length, 1);
      const [first] = values;
      assert.strictEqual(first.uri.toString(), "some:uri/path");
      assert.strictEqual(first.range.start.line, 0);
      assert.strictEqual(first.range.start.character, 1);
      assert.strictEqual(first.range.end.line, 0);
      assert.strictEqual(first.range.end.character, 5);
    });
  });
  test('"vscode.executeDocumentHighlights" API has stopped returning DocumentHighlight[]#200056', async function() {
    disposables.push(extHost.registerDocumentHighlightProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentHighlights() {
        return [
          new types.DocumentHighlight(new types.Range(0, 17, 0, 25), types.DocumentHighlightKind.Read)
        ];
      }
    }));
    await rpcProtocol.sync();
    return commands.executeCommand("vscode.executeDocumentHighlights", model.uri, new types.Position(0, 0)).then((values) => {
      assert.ok(Array.isArray(values));
      assert.strictEqual(values.length, 1);
      const [first] = values;
      assert.strictEqual(first.range.start.line, 0);
      assert.strictEqual(first.range.start.character, 17);
      assert.strictEqual(first.range.end.line, 0);
      assert.strictEqual(first.range.end.character, 25);
    });
  });
  test("Outline, back and forth", function() {
    disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentSymbols() {
        return [
          new types.SymbolInformation("testing1", types.SymbolKind.Enum, new types.Range(1, 0, 1, 0)),
          new types.SymbolInformation("testing2", types.SymbolKind.Enum, new types.Range(0, 1, 0, 3))
        ];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDocumentSymbolProvider", model.uri).then((values) => {
        assert.strictEqual(values.length, 2);
        const [first, second] = values;
        assert.strictEqual(first instanceof types.SymbolInformation, true);
        assert.strictEqual(second instanceof types.SymbolInformation, true);
        assert.strictEqual(first.name, "testing2");
        assert.strictEqual(second.name, "testing1");
      });
    });
  });
  test("vscode.executeDocumentSymbolProvider command only returns SymbolInformation[] rather than DocumentSymbol[] #57984", function() {
    disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentSymbols() {
        return [
          new types.SymbolInformation("SymbolInformation", types.SymbolKind.Enum, new types.Range(1, 0, 1, 0))
        ];
      }
    }));
    disposables.push(extHost.registerDocumentSymbolProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentSymbols() {
        const root = new types.DocumentSymbol("DocumentSymbol", "DocumentSymbol#detail", types.SymbolKind.Enum, new types.Range(1, 0, 1, 0), new types.Range(1, 0, 1, 0));
        root.children = [new types.DocumentSymbol("DocumentSymbol#child", "DocumentSymbol#detail#child", types.SymbolKind.Enum, new types.Range(1, 0, 1, 0), new types.Range(1, 0, 1, 0))];
        return [root];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDocumentSymbolProvider", model.uri).then((values) => {
        assert.strictEqual(values.length, 2);
        const [first, second] = values;
        assert.strictEqual(first instanceof types.SymbolInformation, true);
        assert.strictEqual(first instanceof types.DocumentSymbol, false);
        assert.strictEqual(second instanceof types.SymbolInformation, true);
        assert.strictEqual(first.name, "DocumentSymbol");
        assert.strictEqual(first.children.length, 1);
        assert.strictEqual(second.name, "SymbolInformation");
      });
    });
  });
  testApiCmd("triggerCharacter is null when completion provider is called programmatically #159914", async function() {
    let actualContext;
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems(_doc, _pos, _tok, context) {
        actualContext = context;
        return [];
      }
    }, []));
    await rpcProtocol.sync();
    await commands.executeCommand("vscode.executeCompletionItemProvider", model.uri, new types.Position(0, 4));
    assert.ok(actualContext);
    assert.deepStrictEqual(actualContext, { triggerKind: types.CompletionTriggerKind.Invoke, triggerCharacter: void 0 });
  });
  testApiCmd("Suggest, back and forth", async function() {
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        const a = new types.CompletionItem("item1");
        a.documentation = new types.MarkdownString("hello_md_string");
        const b = new types.CompletionItem("item2");
        b.textEdit = types.TextEdit.replace(new types.Range(0, 4, 0, 8), "foo");
        const c = new types.CompletionItem("item3");
        c.textEdit = types.TextEdit.replace(new types.Range(0, 1, 0, 6), "foobar");
        const d = new types.CompletionItem("item4");
        d.range = new types.Range(0, 1, 0, 4);
        d.insertText = new types.SnippetString("foo$0bar");
        return [a, b, c, d];
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand("vscode.executeCompletionItemProvider", model.uri, new types.Position(0, 4));
    assert.ok(list instanceof types.CompletionList);
    const values = list.items;
    assert.ok(Array.isArray(values));
    assert.strictEqual(values.length, 4);
    const [first, second, third, fourth] = values;
    assert.strictEqual(first.label, "item1");
    assert.strictEqual(first.textEdit, void 0);
    assert.ok(!types.Range.isRange(first.range));
    assert.strictEqual(first.documentation.value, "hello_md_string");
    assert.strictEqual(second.label, "item2");
    assert.strictEqual(second.textEdit.newText, "foo");
    assert.strictEqual(second.textEdit.range.start.line, 0);
    assert.strictEqual(second.textEdit.range.start.character, 4);
    assert.strictEqual(second.textEdit.range.end.line, 0);
    assert.strictEqual(second.textEdit.range.end.character, 8);
    assert.strictEqual(third.label, "item3");
    assert.strictEqual(third.textEdit.newText, "foobar");
    assert.strictEqual(third.textEdit.range.start.line, 0);
    assert.strictEqual(third.textEdit.range.start.character, 1);
    assert.strictEqual(third.textEdit.range.end.line, 0);
    assert.strictEqual(third.textEdit.range.end.character, 6);
    assert.strictEqual(fourth.label, "item4");
    assert.strictEqual(fourth.textEdit, void 0);
    const range = fourth.range;
    assert.ok(types.Range.isRange(range));
    assert.strictEqual(range.start.line, 0);
    assert.strictEqual(range.start.character, 1);
    assert.strictEqual(range.end.line, 0);
    assert.strictEqual(range.end.character, 4);
    assert.ok(fourth.insertText instanceof types.SnippetString);
    assert.strictEqual(fourth.insertText.value, "foo$0bar");
  });
  testApiCmd("Suggest, return CompletionList !array", async function() {
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        const a = new types.CompletionItem("item1");
        const b = new types.CompletionItem("item2");
        return new types.CompletionList([a, b], true);
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand("vscode.executeCompletionItemProvider", model.uri, new types.Position(0, 4));
    assert.ok(list instanceof types.CompletionList);
    assert.strictEqual(list.isIncomplete, true);
  });
  testApiCmd("Suggest, resolve completion items", async function() {
    let resolveCount = 0;
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        const a = new types.CompletionItem("item1");
        const b = new types.CompletionItem("item2");
        const c = new types.CompletionItem("item3");
        const d = new types.CompletionItem("item4");
        return new types.CompletionList([a, b, c, d], false);
      },
      resolveCompletionItem(item) {
        resolveCount += 1;
        return item;
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      model.uri,
      new types.Position(0, 4),
      void 0,
      2
      // maxItemsToResolve
    );
    assert.ok(list instanceof types.CompletionList);
    assert.strictEqual(resolveCount, 2);
  });
  testApiCmd('"vscode.executeCompletionItemProvider" doesnot return a preselect field #53749', async function() {
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        const a2 = new types.CompletionItem("item1");
        a2.preselect = true;
        const b2 = new types.CompletionItem("item2");
        const c2 = new types.CompletionItem("item3");
        c2.preselect = true;
        const d2 = new types.CompletionItem("item4");
        return new types.CompletionList([a2, b2, c2, d2], false);
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      model.uri,
      new types.Position(0, 4),
      void 0
    );
    assert.ok(list instanceof types.CompletionList);
    assert.strictEqual(list.items.length, 4);
    const [a, b, c, d] = list.items;
    assert.strictEqual(a.preselect, true);
    assert.strictEqual(b.preselect, void 0);
    assert.strictEqual(c.preselect, true);
    assert.strictEqual(d.preselect, void 0);
  });
  testApiCmd("executeCompletionItemProvider doesn't capture commitCharacters #58228", async function() {
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        const a2 = new types.CompletionItem("item1");
        a2.commitCharacters = ["a", "b"];
        const b2 = new types.CompletionItem("item2");
        return new types.CompletionList([a2, b2], false);
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      model.uri,
      new types.Position(0, 4),
      void 0
    );
    assert.ok(list instanceof types.CompletionList);
    assert.strictEqual(list.items.length, 2);
    const [a, b] = list.items;
    assert.deepStrictEqual(a.commitCharacters, ["a", "b"]);
    assert.strictEqual(b.commitCharacters, void 0);
  });
  testApiCmd("vscode.executeCompletionItemProvider returns the wrong CompletionItemKinds in insiders #95715", async function() {
    disposables.push(extHost.registerCompletionItemProvider(nullExtensionDescription, defaultSelector, {
      provideCompletionItems() {
        return [
          new types.CompletionItem("My Method", types.CompletionItemKind.Method),
          new types.CompletionItem("My Property", types.CompletionItemKind.Property)
        ];
      }
    }, []));
    await rpcProtocol.sync();
    const list = await commands.executeCommand(
      "vscode.executeCompletionItemProvider",
      model.uri,
      new types.Position(0, 4),
      void 0
    );
    assert.ok(list instanceof types.CompletionList);
    assert.strictEqual(list.items.length, 2);
    const [a, b] = list.items;
    assert.strictEqual(a.kind, types.CompletionItemKind.Method);
    assert.strictEqual(b.kind, types.CompletionItemKind.Property);
  });
  test("Parameter Hints, back and forth", async () => {
    disposables.push(extHost.registerSignatureHelpProvider(nullExtensionDescription, defaultSelector, new class {
      provideSignatureHelp(_document, _position, _token, context) {
        return {
          activeSignature: 0,
          activeParameter: 1,
          signatures: [
            {
              label: "abc",
              documentation: `${context.triggerKind === 1 ? "invoked" : "unknown"} ${context.triggerCharacter}`,
              parameters: []
            }
          ]
        };
      }
    }(), []));
    await rpcProtocol.sync();
    const firstValue = await commands.executeCommand("vscode.executeSignatureHelpProvider", model.uri, new types.Position(0, 1), ",");
    assert.strictEqual(firstValue.activeSignature, 0);
    assert.strictEqual(firstValue.activeParameter, 1);
    assert.strictEqual(firstValue.signatures.length, 1);
    assert.strictEqual(firstValue.signatures[0].label, "abc");
    assert.strictEqual(firstValue.signatures[0].documentation, "invoked ,");
  });
  testApiCmd("QuickFix, back and forth", function() {
    disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
      provideCodeActions() {
        return [{ command: "testing", title: "Title", arguments: [1, 2, true] }];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeCodeActionProvider", model.uri, new types.Range(0, 0, 1, 1)).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.title, "Title");
        assert.strictEqual(first.command, "testing");
        assert.deepStrictEqual(first.arguments, [1, 2, true]);
      });
    });
  });
  testApiCmd("vscode.executeCodeActionProvider results seem to be missing their `command` property #45124", function() {
    disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
      provideCodeActions(document, range) {
        return [{
          command: {
            arguments: [document, range],
            command: "command",
            title: "command_title"
          },
          kind: types.CodeActionKind.Empty.append("foo"),
          title: "title"
        }];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeCodeActionProvider", model.uri, new types.Range(0, 0, 1, 1)).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.ok(first.command);
        assert.strictEqual(first.command.command, "command");
        assert.strictEqual(first.command.title, "command_title");
        assert.strictEqual(first.kind.value, "foo");
        assert.strictEqual(first.title, "title");
      });
    });
  });
  testApiCmd("vscode.executeCodeActionProvider passes Range to provider although Selection is passed in #77997", function() {
    disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
      provideCodeActions(document, rangeOrSelection) {
        return [{
          command: {
            arguments: [document, rangeOrSelection],
            command: "command",
            title: "command_title"
          },
          kind: types.CodeActionKind.Empty.append("foo"),
          title: "title"
        }];
      }
    }));
    const selection = new types.Selection(0, 0, 1, 1);
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeCodeActionProvider", model.uri, selection).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.ok(first.command);
        assert.ok(first.command.arguments[1] instanceof types.Selection);
        assert.ok(first.command.arguments[1].isEqual(selection));
      });
    });
  });
  testApiCmd("vscode.executeCodeActionProvider results seem to be missing their `isPreferred` property #78098", function() {
    disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
      provideCodeActions(document, rangeOrSelection) {
        return [{
          command: {
            arguments: [document, rangeOrSelection],
            command: "command",
            title: "command_title"
          },
          kind: types.CodeActionKind.Empty.append("foo"),
          title: "title",
          isPreferred: true
        }];
      }
    }));
    const selection = new types.Selection(0, 0, 1, 1);
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeCodeActionProvider", model.uri, selection).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.isPreferred, true);
      });
    });
  });
  testApiCmd("resolving code action", async function() {
    let didCallResolve = 0;
    class MyAction extends types.CodeAction {
    }
    disposables.push(extHost.registerCodeActionProvider(nullExtensionDescription, defaultSelector, {
      provideCodeActions(document, rangeOrSelection) {
        return [new MyAction("title", types.CodeActionKind.Empty.append("foo"))];
      },
      resolveCodeAction(action) {
        assert.ok(action instanceof MyAction);
        didCallResolve += 1;
        action.title = "resolved title";
        action.edit = new types.WorkspaceEdit();
        return action;
      }
    }));
    const selection = new types.Selection(0, 0, 1, 1);
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeCodeActionProvider", model.uri, selection, void 0, 1e3);
    assert.strictEqual(didCallResolve, 1);
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.title, "title");
    assert.ok(first.edit);
  });
  testApiCmd("CodeLens, back and forth", function() {
    const complexArg = {
      foo() {
      },
      bar() {
      },
      big: extHost
    };
    disposables.push(extHost.registerCodeLensProvider(nullExtensionDescription, defaultSelector, {
      provideCodeLenses() {
        return [new types.CodeLens(new types.Range(0, 0, 1, 1), { title: "Title", command: "cmd", arguments: [1, true, complexArg] })];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeCodeLensProvider", model.uri).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.command.title, "Title");
        assert.strictEqual(first.command.command, "cmd");
        assert.strictEqual(first.command.arguments[0], 1);
        assert.strictEqual(first.command.arguments[1], true);
        assert.strictEqual(first.command.arguments[2], complexArg);
      });
    });
  });
  testApiCmd("CodeLens, resolve", async function() {
    let resolveCount = 0;
    disposables.push(extHost.registerCodeLensProvider(nullExtensionDescription, defaultSelector, {
      provideCodeLenses() {
        return [
          new types.CodeLens(new types.Range(0, 0, 1, 1)),
          new types.CodeLens(new types.Range(0, 0, 1, 1)),
          new types.CodeLens(new types.Range(0, 0, 1, 1)),
          new types.CodeLens(new types.Range(0, 0, 1, 1), { title: "Already resolved", command: "fff" })
        ];
      },
      resolveCodeLens(codeLens) {
        codeLens.command = { title: resolveCount.toString(), command: "resolved" };
        resolveCount += 1;
        return codeLens;
      }
    }));
    await rpcProtocol.sync();
    let value = await commands.executeCommand("vscode.executeCodeLensProvider", model.uri, 2);
    assert.strictEqual(value.length, 3);
    assert.strictEqual(resolveCount, 2);
    resolveCount = 0;
    value = await commands.executeCommand("vscode.executeCodeLensProvider", model.uri);
    assert.strictEqual(value.length, 4);
    assert.strictEqual(resolveCount, 0);
  });
  testApiCmd("Links, back and forth", function() {
    disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentLinks() {
        return [new types.DocumentLink(new types.Range(0, 0, 0, 20), URI.parse("foo:bar"))];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeLinkProvider", model.uri).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.target + "", "foo:bar");
        assert.strictEqual(first.range.start.line, 0);
        assert.strictEqual(first.range.start.character, 0);
        assert.strictEqual(first.range.end.line, 0);
        assert.strictEqual(first.range.end.character, 20);
      });
    });
  });
  testApiCmd("What's the condition for DocumentLink target to be undefined? #106308", async function() {
    disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentLinks() {
        return [new types.DocumentLink(new types.Range(0, 0, 0, 20), void 0)];
      },
      resolveDocumentLink(link) {
        link.target = URI.parse("foo:bar");
        return link;
      }
    }));
    await rpcProtocol.sync();
    const links1 = await commands.executeCommand("vscode.executeLinkProvider", model.uri);
    assert.strictEqual(links1.length, 1);
    assert.strictEqual(links1[0].target, void 0);
    const links2 = await commands.executeCommand("vscode.executeLinkProvider", model.uri, 1e3);
    assert.strictEqual(links2.length, 1);
    assert.strictEqual(links2[0].target.toString(), URI.parse("foo:bar").toString());
  });
  testApiCmd("DocumentLink[] vscode.executeLinkProvider returns lack tooltip #213970", async function() {
    disposables.push(extHost.registerDocumentLinkProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentLinks() {
        const link = new types.DocumentLink(new types.Range(0, 0, 0, 20), URI.parse("foo:bar"));
        link.tooltip = "Link Tooltip";
        return [link];
      }
    }));
    await rpcProtocol.sync();
    const links1 = await commands.executeCommand("vscode.executeLinkProvider", model.uri);
    assert.strictEqual(links1.length, 1);
    assert.strictEqual(links1[0].tooltip, "Link Tooltip");
  });
  test("Color provider", function() {
    disposables.push(extHost.registerColorProvider(nullExtensionDescription, defaultSelector, {
      provideDocumentColors() {
        return [new types.ColorInformation(new types.Range(0, 0, 0, 20), new types.Color(0.1, 0.2, 0.3, 0.4))];
      },
      provideColorPresentations() {
        const cp = new types.ColorPresentation("#ABC");
        cp.textEdit = types.TextEdit.replace(new types.Range(1, 0, 1, 20), "#ABC");
        cp.additionalTextEdits = [types.TextEdit.insert(new types.Position(2, 20), "*")];
        return [cp];
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeDocumentColorProvider", model.uri).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.color.red, 0.1);
        assert.strictEqual(first.color.green, 0.2);
        assert.strictEqual(first.color.blue, 0.3);
        assert.strictEqual(first.color.alpha, 0.4);
        assert.strictEqual(first.range.start.line, 0);
        assert.strictEqual(first.range.start.character, 0);
        assert.strictEqual(first.range.end.line, 0);
        assert.strictEqual(first.range.end.character, 20);
      });
    }).then(() => {
      const color = new types.Color(0.5, 0.6, 0.7, 0.8);
      const range = new types.Range(0, 0, 0, 20);
      return commands.executeCommand("vscode.executeColorPresentationProvider", color, { uri: model.uri, range }).then((value) => {
        assert.strictEqual(value.length, 1);
        const [first] = value;
        assert.strictEqual(first.label, "#ABC");
        assert.strictEqual(first.textEdit.newText, "#ABC");
        assert.strictEqual(first.textEdit.range.start.line, 1);
        assert.strictEqual(first.textEdit.range.start.character, 0);
        assert.strictEqual(first.textEdit.range.end.line, 1);
        assert.strictEqual(first.textEdit.range.end.character, 20);
        assert.strictEqual(first.additionalTextEdits.length, 1);
        assert.strictEqual(first.additionalTextEdits[0].range.start.line, 2);
        assert.strictEqual(first.additionalTextEdits[0].range.start.character, 20);
        assert.strictEqual(first.additionalTextEdits[0].range.end.line, 2);
        assert.strictEqual(first.additionalTextEdits[0].range.end.character, 20);
      });
    });
  });
  test('"TypeError: e.onCancellationRequested is not a function" calling hover provider in Insiders #54174', function() {
    disposables.push(extHost.registerHoverProvider(nullExtensionDescription, defaultSelector, {
      provideHover() {
        return new types.Hover("fofofofo");
      }
    }));
    return rpcProtocol.sync().then(() => {
      return commands.executeCommand("vscode.executeHoverProvider", model.uri, new types.Position(1, 1)).then((value) => {
        assert.strictEqual(value.length, 1);
        assert.strictEqual(value[0].contents.length, 1);
      });
    });
  });
  testApiCmd("Inlay Hints, back and forth", async function() {
    disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
      provideInlayHints() {
        return [new types.InlayHint(new types.Position(0, 1), "Foo")];
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeInlayHintProvider", model.uri, new types.Range(0, 0, 20, 20));
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.label, "Foo");
    assert.strictEqual(first.position.line, 0);
    assert.strictEqual(first.position.character, 1);
  });
  testApiCmd("Inline Hints, merge", async function() {
    disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
      provideInlayHints() {
        const part = new types.InlayHintLabelPart("Bar");
        part.tooltip = "part_tooltip";
        part.command = { command: "cmd", title: "part" };
        const hint = new types.InlayHint(new types.Position(10, 11), [part]);
        hint.tooltip = "hint_tooltip";
        hint.paddingLeft = true;
        hint.paddingRight = false;
        return [hint];
      }
    }));
    disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
      provideInlayHints() {
        const hint = new types.InlayHint(new types.Position(0, 1), "Foo", types.InlayHintKind.Parameter);
        hint.textEdits = [types.TextEdit.insert(new types.Position(0, 0), "Hello")];
        return [hint];
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeInlayHintProvider", model.uri, new types.Range(0, 0, 20, 20));
    assert.strictEqual(value.length, 2);
    const [first, second] = value;
    assert.strictEqual(first.label, "Foo");
    assert.strictEqual(first.position.line, 0);
    assert.strictEqual(first.position.character, 1);
    assert.strictEqual(first.textEdits?.length, 1);
    assert.strictEqual(first.textEdits[0].newText, "Hello");
    assert.strictEqual(second.position.line, 10);
    assert.strictEqual(second.position.character, 11);
    assert.strictEqual(second.paddingLeft, true);
    assert.strictEqual(second.paddingRight, false);
    assert.strictEqual(second.tooltip, "hint_tooltip");
    const label = second.label[0];
    assertType(label instanceof types.InlayHintLabelPart);
    assert.strictEqual(label.value, "Bar");
    assert.strictEqual(label.tooltip, "part_tooltip");
    assert.strictEqual(label.command?.command, "cmd");
    assert.strictEqual(label.command?.title, "part");
  });
  testApiCmd("Inline Hints, bad provider", async function() {
    disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
      provideInlayHints() {
        return [new types.InlayHint(new types.Position(0, 1), "Foo")];
      }
    }));
    disposables.push(extHost.registerInlayHintsProvider(nullExtensionDescription, defaultSelector, {
      provideInlayHints() {
        throw new Error();
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeInlayHintProvider", model.uri, new types.Range(0, 0, 20, 20));
    assert.strictEqual(value.length, 1);
    const [first] = value;
    assert.strictEqual(first.label, "Foo");
    assert.strictEqual(first.position.line, 0);
    assert.strictEqual(first.position.character, 1);
  });
  test("Selection Range, back and forth", async function() {
    disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
      provideSelectionRanges() {
        return [
          new types.SelectionRange(new types.Range(0, 10, 0, 18), new types.SelectionRange(new types.Range(0, 2, 0, 20)))
        ];
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeSelectionRangeProvider", model.uri, [new types.Position(0, 10)]);
    assert.strictEqual(value.length, 1);
    assert.ok(value[0].parent);
  });
  test("CallHierarchy, back and forth", async function() {
    disposables.push(extHost.registerCallHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
      prepareCallHierarchy(document, position) {
        return new types.CallHierarchyItem(types.SymbolKind.Constant, "ROOT", "ROOT", document.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0));
      }
      provideCallHierarchyIncomingCalls(item, token) {
        return [new types.CallHierarchyIncomingCall(
          new types.CallHierarchyItem(types.SymbolKind.Constant, "INCOMING", "INCOMING", item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0)),
          [new types.Range(0, 0, 0, 0)]
        )];
      }
      provideCallHierarchyOutgoingCalls(item, token) {
        return [new types.CallHierarchyOutgoingCall(
          new types.CallHierarchyItem(types.SymbolKind.Constant, "OUTGOING", "OUTGOING", item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0)),
          [new types.Range(0, 0, 0, 0)]
        )];
      }
    }()));
    await rpcProtocol.sync();
    const root = await commands.executeCommand("vscode.prepareCallHierarchy", model.uri, new types.Position(0, 0));
    assert.ok(Array.isArray(root));
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0].name, "ROOT");
    const incoming = await commands.executeCommand("vscode.provideIncomingCalls", root[0]);
    assert.strictEqual(incoming.length, 1);
    assert.strictEqual(incoming[0].from.name, "INCOMING");
    const outgoing = await commands.executeCommand("vscode.provideOutgoingCalls", root[0]);
    assert.strictEqual(outgoing.length, 1);
    assert.strictEqual(outgoing[0].to.name, "OUTGOING");
  });
  test("prepareCallHierarchy throws TypeError if clangd returns empty result #137415", async function() {
    disposables.push(extHost.registerCallHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
      prepareCallHierarchy(document, position) {
        return [];
      }
      provideCallHierarchyIncomingCalls(item, token) {
        return [];
      }
      provideCallHierarchyOutgoingCalls(item, token) {
        return [];
      }
    }()));
    await rpcProtocol.sync();
    const root = await commands.executeCommand("vscode.prepareCallHierarchy", model.uri, new types.Position(0, 0));
    assert.ok(Array.isArray(root));
    assert.strictEqual(root.length, 0);
  });
  test("TypeHierarchy, back and forth", async function() {
    disposables.push(extHost.registerTypeHierarchyProvider(nullExtensionDescription, defaultSelector, new class {
      prepareTypeHierarchy(document, position, token) {
        return [new types.TypeHierarchyItem(types.SymbolKind.Constant, "ROOT", "ROOT", document.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
      }
      provideTypeHierarchySupertypes(item, token) {
        return [new types.TypeHierarchyItem(types.SymbolKind.Constant, "SUPER", "SUPER", item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
      }
      provideTypeHierarchySubtypes(item, token) {
        return [new types.TypeHierarchyItem(types.SymbolKind.Constant, "SUB", "SUB", item.uri, new types.Range(0, 0, 0, 0), new types.Range(0, 0, 0, 0))];
      }
    }()));
    await rpcProtocol.sync();
    const root = await commands.executeCommand("vscode.prepareTypeHierarchy", model.uri, new types.Position(0, 0));
    assert.ok(Array.isArray(root));
    assert.strictEqual(root.length, 1);
    assert.strictEqual(root[0].name, "ROOT");
    const incoming = await commands.executeCommand("vscode.provideSupertypes", root[0]);
    assert.strictEqual(incoming.length, 1);
    assert.strictEqual(incoming[0].name, "SUPER");
    const outgoing = await commands.executeCommand("vscode.provideSubtypes", root[0]);
    assert.strictEqual(outgoing.length, 1);
    assert.strictEqual(outgoing[0].name, "SUB");
  });
  test("selectionRangeProvider on inner array always returns outer array #91852", async function() {
    disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
      provideSelectionRanges(_doc, positions) {
        const [first] = positions;
        return [
          new types.SelectionRange(new types.Range(first.line, first.character, first.line, first.character))
        ];
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand("vscode.executeSelectionRangeProvider", model.uri, [new types.Position(0, 10)]);
    assert.strictEqual(value.length, 1);
    assert.strictEqual(value[0].range.start.line, 0);
    assert.strictEqual(value[0].range.start.character, 10);
    assert.strictEqual(value[0].range.end.line, 0);
    assert.strictEqual(value[0].range.end.character, 10);
  });
  test("more element test of selectionRangeProvider on inner array always returns outer array #91852", async function() {
    disposables.push(extHost.registerSelectionRangeProvider(nullExtensionDescription, defaultSelector, {
      provideSelectionRanges(_doc, positions) {
        const [first, second] = positions;
        return [
          new types.SelectionRange(new types.Range(first.line, first.character, first.line, first.character)),
          new types.SelectionRange(new types.Range(second.line, second.character, second.line, second.character))
        ];
      }
    }));
    await rpcProtocol.sync();
    const value = await commands.executeCommand(
      "vscode.executeSelectionRangeProvider",
      model.uri,
      [new types.Position(0, 0), new types.Position(0, 10)]
    );
    assert.strictEqual(value.length, 2);
    assert.strictEqual(value[0].range.start.line, 0);
    assert.strictEqual(value[0].range.start.character, 0);
    assert.strictEqual(value[0].range.end.line, 0);
    assert.strictEqual(value[0].range.end.character, 0);
    assert.strictEqual(value[1].range.start.line, 0);
    assert.strictEqual(value[1].range.start.character, 10);
    assert.strictEqual(value[1].range.end.line, 0);
    assert.strictEqual(value[1].range.end.character, 10);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0QXBpQ29tbWFuZHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29kZUFjdGlvbi9icm93c2VyL2NvZGVBY3Rpb24uanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9jb2RlbGVucy9icm93c2VyL2NvZGVsZW5zLmpzJztcbmltcG9ydCAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvY29sb3JQaWNrZXIvYnJvd3Nlci9jb2xvclBpY2tlckNvbnRyaWJ1dGlvbi5qcyc7XG5pbXBvcnQgJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2Zvcm1hdC9icm93c2VyL2Zvcm1hdC5qcyc7XG5pbXBvcnQgJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2dvdG9TeW1ib2wvYnJvd3Nlci9nb1RvQ29tbWFuZHMuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9kb2N1bWVudFN5bWJvbHMvYnJvd3Nlci9kb2N1bWVudFN5bWJvbHMuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9ob3Zlci9icm93c2VyL2dldEhvdmVyLmpzJztcbmltcG9ydCAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvbGlua3MvYnJvd3Nlci9nZXRMaW5rcy5qcyc7XG5pbXBvcnQgJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3BhcmFtZXRlckhpbnRzL2Jyb3dzZXIvcHJvdmlkZVNpZ25hdHVyZUhlbHAuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbWFydFNlbGVjdC9icm93c2VyL3NtYXJ0U2VsZWN0LmpzJztcbmltcG9ydCAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvc3VnZ2VzdC9icm93c2VyL3N1Z2dlc3QuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9yZW5hbWUvYnJvd3Nlci9yZW5hbWUuanMnO1xuaW1wb3J0ICcuLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9pbmxheUhpbnRzL2Jyb3dzZXIvaW5sYXlIaW50c0NvbnRyb2xsZXIuanMnO1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyLCBlcnJvckhhbmRsZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0ICogYXMgdHlwZXMgZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RUeXBlcy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBUZXN0UlBDUHJvdG9jb2wgfSBmcm9tICcuLi9jb21tb24vdGVzdFJQQ1Byb3RvY29sLmpzJztcbmltcG9ydCB7IE1hcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UsIENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdExhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMgfSBmcm9tICcuLi8uLi9icm93c2VyL21haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IEV4dEhvc3RBcGlDb21tYW5kcyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0QXBpQ29tbWFuZHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENvbW1hbmRzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3RDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBNYWluVGhyZWFkQ29tbWFuZHMgfSBmcm9tICcuLi8uLi9icm93c2VyL21haW5UaHJlYWRDb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0RG9jdW1lbnRzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMuanMnO1xuaW1wb3J0IHsgTWFpbkNvbnRleHQsIEV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRXh0SG9zdERpYWdub3N0aWNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REaWFnbm9zdGljcy5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0ICcuLi8uLi8uLi9jb250cmliL3NlYXJjaC9icm93c2VyL3NlYXJjaC5jb250cmlidXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UsIE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgZGlzcG9zZSwgSW1tb3J0YWxSZWZlcmVuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvcldvcmtlclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2VkaXRvcldvcmtlci5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IE51bGxBcGlEZXByZWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdEFwaURlcHJlY2F0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlQ29sbGVjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL3NlcnZpY2VDb2xsZWN0aW9uLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgSVJlc29sdmVkVGV4dEVkaXRvck1vZGVsLCBJVGV4dE1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvcmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRIb3N0RmlsZVN5c3RlbUluZm8gfSBmcm9tICcuLi8uLi9jb21tb24vZXh0SG9zdEZpbGVTeXN0ZW1JbmZvLmpzJztcbmltcG9ydCB7IFVSSVRyYW5zZm9ybWVyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VXJpVHJhbnNmb3JtZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElPdXRsaW5lTW9kZWxTZXJ2aWNlLCBPdXRsaW5lTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZG9jdW1lbnRTeW1ib2xzL2Jyb3dzZXIvb3V0bGluZU1vZGVsLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UsIExhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2UuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJRXh0SG9zdFRlbGVtZXRyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL3Rlc3QvY29tbW9uL2luc3RhbnRpYXRpb25TZXJ2aWNlTW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IHJ1bldpdGhGYWtlZFRpbWVycyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdGltZVRyYXZlbFNjaGVkdWxlci5qcyc7XG5pbXBvcnQgeyB0aW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuXG5mdW5jdGlvbiBhc3NlcnRSZWplY3RzKGZuOiAoKSA9PiBQcm9taXNlPGFueT4sIG1lc3NhZ2U6IHN0cmluZyA9ICdFeHBlY3RlZCByZWplY3Rpb24nKSB7XG5cdHJldHVybiBmbigpLnRoZW4oKCkgPT4gYXNzZXJ0Lm9rKGZhbHNlLCBtZXNzYWdlKSwgX2VyciA9PiBhc3NlcnQub2sodHJ1ZSkpO1xufVxuXG5mdW5jdGlvbiBpc0xvY2F0aW9uKHZhbHVlOiB2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKTogdmFsdWUgaXMgdnNjb2RlLkxvY2F0aW9uIHtcblx0Y29uc3QgY2FuZGlkYXRlID0gdmFsdWUgYXMgdnNjb2RlLkxvY2F0aW9uO1xuXHRyZXR1cm4gY2FuZGlkYXRlICYmIGNhbmRpZGF0ZS51cmkgaW5zdGFuY2VvZiBVUkkgJiYgY2FuZGlkYXRlLnJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2U7XG59XG5cbnN1aXRlKCdFeHRIb3N0TGFuZ3VhZ2VGZWF0dXJlQ29tbWFuZHMnLCBmdW5jdGlvbiAoKSB7XG5cdGNvbnN0IGRlZmF1bHRTZWxlY3RvciA9IHsgc2NoZW1lOiAnZmFyJyB9O1xuXHRsZXQgbW9kZWw6IElUZXh0TW9kZWw7XG5cblx0bGV0IGluc3RhOiBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2U7XG5cdGxldCBycGNQcm90b2NvbDogVGVzdFJQQ1Byb3RvY29sO1xuXHRsZXQgZXh0SG9zdDogRXh0SG9zdExhbmd1YWdlRmVhdHVyZXM7XG5cdGxldCBtYWluVGhyZWFkOiBNYWluVGhyZWFkTGFuZ3VhZ2VGZWF0dXJlcztcblx0bGV0IGNvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHM7XG5cdGxldCBkaXNwb3NhYmxlczogdnNjb2RlLkRpc3Bvc2FibGVbXSA9IFtdO1xuXG5cdGxldCBvcmlnaW5hbEVycm9ySGFuZGxlcjogKGU6IGFueSkgPT4gYW55O1xuXG5cdHN1aXRlU2V0dXAoKCkgPT4ge1xuXHRcdG1vZGVsID0gY3JlYXRlVGV4dE1vZGVsKFxuXHRcdFx0W1xuXHRcdFx0XHQnVGhpcyBpcyB0aGUgZmlyc3QgbGluZScsXG5cdFx0XHRcdCdUaGlzIGlzIHRoZSBzZWNvbmQgbGluZScsXG5cdFx0XHRcdCdUaGlzIGlzIHRoZSB0aGlyZCBsaW5lJyxcblx0XHRcdF0uam9pbignXFxuJyksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHRVUkkucGFyc2UoJ2ZhcjovL3Rlc3RpbmcvZmlsZS5iJykpO1xuXHRcdG9yaWdpbmFsRXJyb3JIYW5kbGVyID0gZXJyb3JIYW5kbGVyLmdldFVuZXhwZWN0ZWRFcnJvckhhbmRsZXIoKTtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKCgpID0+IHsgfSk7XG5cblx0XHQvLyBVc2UgSUluc3RhbnRpYXRpb25TZXJ2aWNlIHRvIGdldCB0eXBlY2hlY2tpbmcgd2hlbiBpbnN0YW50aWF0aW5nXG5cdFx0cnBjUHJvdG9jb2wgPSBuZXcgVGVzdFJQQ1Byb3RvY29sKCk7XG5cdFx0Y29uc3Qgc2VydmljZXMgPSBuZXcgU2VydmljZUNvbGxlY3Rpb24oKTtcblx0XHRzZXJ2aWNlcy5zZXQoSVVyaUlkZW50aXR5U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVXJpSWRlbnRpdHlTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGFzQ2Fub25pY2FsVXJpKHVyaTogVVJJKTogVVJJIHtcblx0XHRcdFx0cmV0dXJuIHVyaTtcblx0XHRcdH1cblx0XHR9KTtcblx0XHRzZXJ2aWNlcy5zZXQoSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUV4dGVuc2lvblNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dGVuc2lvblNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgYWN0aXZhdGVCeUV2ZW50KCkge1xuXG5cdFx0XHR9XG5cdFx0XHRvdmVycmlkZSBhY3RpdmF0aW9uRXZlbnRJc0RvbmUoYWN0aXZhdGlvbkV2ZW50OiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0c2VydmljZXMuc2V0KElDb21tYW5kU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKGNsYXNzIGV4dGVuZHMgbW9jazxJQ29tbWFuZFNlcnZpY2U+KCkge1xuXG5cdFx0XHRvdmVycmlkZSBleGVjdXRlQ29tbWFuZChpZDogc3RyaW5nLCAuLi5hcmdzOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBjb21tYW5kID0gQ29tbWFuZHNSZWdpc3RyeS5nZXRDb21tYW5kcygpLmdldChpZCk7XG5cdFx0XHRcdGlmICghY29tbWFuZCkge1xuXHRcdFx0XHRcdHJldHVybiBQcm9taXNlLnJlamVjdChuZXcgRXJyb3IoaWQgKyAnIE5PVCBrbm93bicpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCB7IGhhbmRsZXIgfSA9IGNvbW1hbmQ7XG5cdFx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoaW5zdGEuaW52b2tlRnVuY3Rpb24oaGFuZGxlciwgLi4uYXJncykpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUVudmlyb25tZW50U2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRW52aXJvbm1lbnRTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGlzQnVpbHQ6IGJvb2xlYW4gPSB0cnVlO1xuXHRcdFx0b3ZlcnJpZGUgaXNFeHRlbnNpb25EZXZlbG9wbWVudDogYm9vbGVhbiA9IGZhbHNlO1xuXHRcdH0pO1xuXHRcdHNlcnZpY2VzLnNldChJTWFya2VyU2VydmljZSwgbmV3IE1hcmtlclNlcnZpY2UoKSk7XG5cdFx0c2VydmljZXMuc2V0KElMb2dTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTnVsbExvZ1NlcnZpY2UpKTtcblx0XHRzZXJ2aWNlcy5zZXQoSUxhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSwgbmV3IFN5bmNEZXNjcmlwdG9yKExhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJTW9kZWxTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElNb2RlbFNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgZ2V0TW9kZWwoKSB7IHJldHVybiBtb2RlbDsgfVxuXHRcdFx0b3ZlcnJpZGUgb25Nb2RlbFJlbW92ZWQgPSBFdmVudC5Ob25lO1xuXHRcdH0pO1xuXHRcdHNlcnZpY2VzLnNldChJVGV4dE1vZGVsU2VydmljZSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJVGV4dE1vZGVsU2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBhc3luYyBjcmVhdGVNb2RlbFJlZmVyZW5jZSgpIHtcblx0XHRcdFx0cmV0dXJuIG5ldyBJbW1vcnRhbFJlZmVyZW5jZTxJUmVzb2x2ZWRUZXh0RWRpdG9yTW9kZWw+KG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVJlc29sdmVkVGV4dEVkaXRvck1vZGVsPigpIHtcblx0XHRcdFx0XHRvdmVycmlkZSB0ZXh0RWRpdG9yTW9kZWwgPSBtb2RlbDtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0c2VydmljZXMuc2V0KElFZGl0b3JXb3JrZXJTZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFZGl0b3JXb3JrZXJTZXJ2aWNlPigpIHtcblx0XHRcdG92ZXJyaWRlIGFzeW5jIGNvbXB1dGVNb3JlTWluaW1hbEVkaXRzKF91cmk6IGFueSwgZWRpdHM6IGFueSkge1xuXHRcdFx0XHRyZXR1cm4gZWRpdHMgfHwgdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHNlcnZpY2VzLnNldChJTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlKSk7XG5cdFx0c2VydmljZXMuc2V0KElPdXRsaW5lTW9kZWxTZXJ2aWNlLCBuZXcgU3luY0Rlc2NyaXB0b3IoT3V0bGluZU1vZGVsU2VydmljZSkpO1xuXHRcdHNlcnZpY2VzLnNldChJQ29uZmlndXJhdGlvblNlcnZpY2UsIG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UoKSk7XG5cblx0XHRpbnN0YSA9IG5ldyBUZXN0SW5zdGFudGlhdGlvblNlcnZpY2Uoc2VydmljZXMpO1xuXG5cdFx0Y29uc3QgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMgPSBuZXcgRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMocnBjUHJvdG9jb2wsIG5ldyBOdWxsTG9nU2VydmljZSgpKTtcblx0XHRleHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy4kYWNjZXB0RG9jdW1lbnRzQW5kRWRpdG9yc0RlbHRhKHtcblx0XHRcdGFkZGVkRG9jdW1lbnRzOiBbe1xuXHRcdFx0XHRpc0RpcnR5OiBmYWxzZSxcblx0XHRcdFx0dmVyc2lvbklkOiBtb2RlbC5nZXRWZXJzaW9uSWQoKSxcblx0XHRcdFx0bGFuZ3VhZ2VJZDogbW9kZWwuZ2V0TGFuZ3VhZ2VJZCgpLFxuXHRcdFx0XHR1cmk6IG1vZGVsLnVyaSxcblx0XHRcdFx0bGluZXM6IG1vZGVsLmdldFZhbHVlKCkuc3BsaXQobW9kZWwuZ2V0RU9MKCkpLFxuXHRcdFx0XHRFT0w6IG1vZGVsLmdldEVPTCgpLFxuXHRcdFx0XHRlbmNvZGluZzogJ3V0ZjgnXG5cdFx0XHR9XVxuXHRcdH0pO1xuXHRcdGNvbnN0IGV4dEhvc3REb2N1bWVudHMgPSBuZXcgRXh0SG9zdERvY3VtZW50cyhycGNQcm90b2NvbCwgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpO1xuXHRcdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RG9jdW1lbnRzLCBleHRIb3N0RG9jdW1lbnRzKTtcblxuXHRcdGNvbW1hbmRzID0gbmV3IEV4dEhvc3RDb21tYW5kcyhycGNQcm90b2NvbCwgbmV3IE51bGxMb2dTZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RUZWxlbWV0cnk+KCkge1xuXHRcdFx0b3ZlcnJpZGUgb25FeHRlbnNpb25FcnJvcigpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RDb21tYW5kcywgY29tbWFuZHMpO1xuXHRcdHJwY1Byb3RvY29sLnNldChNYWluQ29udGV4dC5NYWluVGhyZWFkQ29tbWFuZHMsIGluc3RhLmNyZWF0ZUluc3RhbmNlKE1haW5UaHJlYWRDb21tYW5kcywgcnBjUHJvdG9jb2wpKTtcblx0XHRFeHRIb3N0QXBpQ29tbWFuZHMucmVnaXN0ZXIoY29tbWFuZHMpO1xuXG5cdFx0Y29uc3QgZGlhZ25vc3RpY3MgPSBuZXcgRXh0SG9zdERpYWdub3N0aWNzKHJwY1Byb3RvY29sLCBuZXcgTnVsbExvZ1NlcnZpY2UoKSwgbmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvPigpIHsgfSwgZXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMpO1xuXHRcdHJwY1Byb3RvY29sLnNldChFeHRIb3N0Q29udGV4dC5FeHRIb3N0RGlhZ25vc3RpY3MsIGRpYWdub3N0aWNzKTtcblxuXHRcdGV4dEhvc3QgPSBuZXcgRXh0SG9zdExhbmd1YWdlRmVhdHVyZXMocnBjUHJvdG9jb2wsIG5ldyBVUklUcmFuc2Zvcm1lclNlcnZpY2UobnVsbCksIGV4dEhvc3REb2N1bWVudHMsIGNvbW1hbmRzLCBkaWFnbm9zdGljcywgbmV3IE51bGxMb2dTZXJ2aWNlKCksIE51bGxBcGlEZXByZWNhdGlvblNlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RUZWxlbWV0cnk+KCkge1xuXHRcdFx0b3ZlcnJpZGUgb25FeHRlbnNpb25FcnJvcigpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdFx0cnBjUHJvdG9jb2wuc2V0KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RMYW5ndWFnZUZlYXR1cmVzLCBleHRIb3N0KTtcblxuXHRcdG1haW5UaHJlYWQgPSBycGNQcm90b2NvbC5zZXQoTWFpbkNvbnRleHQuTWFpblRocmVhZExhbmd1YWdlRmVhdHVyZXMsIGluc3RhLmNyZWF0ZUluc3RhbmNlKE1haW5UaHJlYWRMYW5ndWFnZUZlYXR1cmVzLCBycGNQcm90b2NvbCkpO1xuXG5cdFx0Ly8gZm9yY2VmdWxseSBjcmVhdGUgdGhlIG91dGxpbmUgc2VydmljZSBzbyB0aGF0IGBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGVgIGRvZXNuJ3QgYmFya1xuXHRcdGluc3RhLmdldChJT3V0bGluZU1vZGVsU2VydmljZSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpO1xuXHR9KTtcblxuXHRzdWl0ZVRlYXJkb3duKCgpID0+IHtcblx0XHRzZXRVbmV4cGVjdGVkRXJyb3JIYW5kbGVyKG9yaWdpbmFsRXJyb3JIYW5kbGVyKTtcblx0XHRtb2RlbC5kaXNwb3NlKCk7XG5cdFx0bWFpblRocmVhZC5kaXNwb3NlKCk7XG5cblx0XHQoPE91dGxpbmVNb2RlbFNlcnZpY2U+aW5zdGEuZ2V0KElPdXRsaW5lTW9kZWxTZXJ2aWNlKSkuZGlzcG9zZSgpO1xuXHRcdGluc3RhLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVhcmRvd24oKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzID0gZGlzcG9zZShkaXNwb3NhYmxlcyk7XG5cdFx0cmV0dXJuIHJwY1Byb3RvY29sLnN5bmMoKTtcblx0fSk7XG5cblx0ZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0Ly8gLS0tIHdvcmtzcGFjZSBzeW1ib2xzXG5cblx0ZnVuY3Rpb24gdGVzdEFwaUNtZChuYW1lOiBzdHJpbmcsIGZuOiAoKSA9PiBQcm9taXNlPGFueT4pIHtcblx0XHR0ZXN0KG5hbWUsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRcdGF3YWl0IHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRhd2FpdCBmbigpO1xuXHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwMDAwKTsgXHQvLyBBUEkgY29tbWFuZHMgZm9yIHRoaW5ncyB0aGF0IGFsbG93IGNvbW1hbmRzIGRpc3Bvc2UgdGhlaXIgcmVzdWx0IGRlbGF5LiBUaGlzIGlzIHRvIGJlIG5pY2Vcblx0XHRcdFx0Ly8gYmVjYXVzZSBvdGhlcndpc2UgcHJvcGVydGllcyBsaWtlIGNvbW1hbmQgYXJlIGRpc3Bvc2VkIHRvbyBlYXJseVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cblx0fVxuXG5cdHRlc3QoJ1dvcmtzcGFjZVN5bWJvbHMsIGludmFsaWQgYXJndW1lbnRzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByb21pc2VzID0gW1xuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcicpKSxcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlV29ya3NwYWNlU3ltYm9sUHJvdmlkZXInLCBudWxsKSksXG5cdFx0XHRhc3NlcnRSZWplY3RzKCgpID0+IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUuZXhlY3V0ZVdvcmtzcGFjZVN5bWJvbFByb3ZpZGVyJywgdW5kZWZpbmVkKSksXG5cdFx0XHRhc3NlcnRSZWplY3RzKCgpID0+IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUuZXhlY3V0ZVdvcmtzcGFjZVN5bWJvbFByb3ZpZGVyJywgdHJ1ZSkpXG5cdFx0XTtcblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHR9KTtcblxuXHR0ZXN0KCdXb3Jrc3BhY2VTeW1ib2xzLCBiYWNrIGFuZCBmb3J0aCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlcldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgPHZzY29kZS5Xb3Jrc3BhY2VTeW1ib2xQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlV29ya3NwYWNlU3ltYm9scyhxdWVyeSk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKHF1ZXJ5LCB0eXBlcy5TeW1ib2xLaW5kLkFycmF5LCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSksIFVSSS5wYXJzZSgnZmFyOi8vdGVzdGluZy9maXJzdCcpKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24ocXVlcnksIHR5cGVzLlN5bWJvbEtpbmQuQXJyYXksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSwgVVJJLnBhcnNlKCdmYXI6Ly90ZXN0aW5nL3NlY29uZCcpKVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlcldvcmtzcGFjZVN5bWJvbFByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgPHZzY29kZS5Xb3Jrc3BhY2VTeW1ib2xQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlV29ya3NwYWNlU3ltYm9scyhxdWVyeSk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKHF1ZXJ5LCB0eXBlcy5TeW1ib2xLaW5kLkFycmF5LCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSksIFVSSS5wYXJzZSgnZmFyOi8vdGVzdGluZy9maXJzdCcpKVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZVdvcmtzcGFjZVN5bWJvbFByb3ZpZGVyJywgJ3Rlc3RpbmcnKS50aGVuKHZhbHVlID0+IHtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAyKTsgLy8gZGUtZHVwZWRcblx0XHRcdFx0Zm9yIChjb25zdCBpbmZvIG9mIHZhbHVlKSB7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluZm8gaW5zdGFuY2VvZiB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbiwgdHJ1ZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluZm8ubmFtZSwgJ3Rlc3RpbmcnKTtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5mby5raW5kLCB0eXBlcy5TeW1ib2xLaW5kLkFycmF5KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V4ZWN1dGVXb3Jrc3BhY2VTeW1ib2xQcm92aWRlciBzaG91bGQgYWNjZXB0IGVtcHR5IHN0cmluZywgIzM5NTIyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyV29ya3NwYWNlU3ltYm9sUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCB7XG5cdFx0XHRwcm92aWRlV29ya3NwYWNlU3ltYm9scygpOiB2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb25bXSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLlN5bWJvbEluZm9ybWF0aW9uKCdoZWxsbycsIHR5cGVzLlN5bWJvbEtpbmQuQXJyYXksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSwgVVJJLnBhcnNlKCdmb286YmFyJykpIGFzIHZzY29kZS5TeW1ib2xJbmZvcm1hdGlvbl07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGxldCBzeW1ib2xzID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZVdvcmtzcGFjZVN5bWJvbFByb3ZpZGVyJywgJycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzeW1ib2xzLmxlbmd0aCwgMSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0c3ltYm9scyA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5TeW1ib2xJbmZvcm1hdGlvbltdPigndnNjb2RlLmV4ZWN1dGVXb3Jrc3BhY2VTeW1ib2xQcm92aWRlcicsICcqJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHN5bWJvbHMubGVuZ3RoLCAxKTtcblx0fSk7XG5cblx0Ly8gLS0tIGZvcm1hdHRpbmdcblx0dGVzdCgnZXhlY3V0ZUZvcm1hdERvY3VtZW50UHJvdmlkZXIsIGJhY2sgYW5kIGZvcnRoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuRG9jdW1lbnRGb3JtYXR0aW5nRWRpdFByb3ZpZGVyIHtcblx0XHRcdHByb3ZpZGVEb2N1bWVudEZvcm1hdHRpbmdFZGl0cygpIHtcblx0XHRcdFx0cmV0dXJuIFt0eXBlcy5UZXh0RWRpdC5pbnNlcnQobmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApLCAnNDInKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXHRcdGNvbnN0IGVkaXRzID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLlN5bWJvbEluZm9ybWF0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZUZvcm1hdERvY3VtZW50UHJvdmlkZXInLCBtb2RlbC51cmkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0cy5sZW5ndGgsIDEpO1xuXHR9KTtcblxuXG5cdC8vIC0tLSByZW5hbWVcblx0dGVzdCgndnNjb2RlLnByZXBhcmVSZW5hbWUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyUmVuYW1lUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5SZW5hbWVQcm92aWRlciB7XG5cblx0XHRcdHByZXBhcmVSZW5hbWUoZG9jdW1lbnQ6IHZzY29kZS5UZXh0RG9jdW1lbnQsIHBvc2l0aW9uOiB2c2NvZGUuUG9zaXRpb24pIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRyYW5nZTogbmV3IHR5cGVzLlJhbmdlKDAsIDEyLCAwLCAyNCksXG5cdFx0XHRcdFx0cGxhY2Vob2xkZXI6ICdmb29vUGxhY2Vob2xkZXInXG5cdFx0XHRcdH07XG5cdFx0XHR9XG5cblx0XHRcdHByb3ZpZGVSZW5hbWVFZGl0cyhkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgcG9zaXRpb246IHZzY29kZS5Qb3NpdGlvbiwgbmV3TmFtZTogc3RyaW5nKSB7XG5cdFx0XHRcdGNvbnN0IGVkaXQgPSBuZXcgdHlwZXMuV29ya3NwYWNlRWRpdCgpO1xuXHRcdFx0XHRlZGl0Lmluc2VydChkb2N1bWVudC51cmksIDx0eXBlcy5Qb3NpdGlvbj5wb3NpdGlvbiwgbmV3TmFtZSk7XG5cdFx0XHRcdHJldHVybiBlZGl0O1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IGRhdGEgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx7IHJhbmdlOiB2c2NvZGUuUmFuZ2U7IHBsYWNlaG9sZGVyOiBzdHJpbmcgfT4oJ3ZzY29kZS5wcmVwYXJlUmVuYW1lJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMTIpKTtcblxuXHRcdGFzc2VydC5vayhkYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YS5wbGFjZWhvbGRlciwgJ2Zvb29QbGFjZWhvbGRlcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhLnJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMTIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhLnJhbmdlLmVuZC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YS5yYW5nZS5lbmQuY2hhcmFjdGVyLCAyNCk7XG5cblx0fSk7XG5cblx0dGVzdCgndnNjb2RlLmV4ZWN1dGVEb2N1bWVudFJlbmFtZVByb3ZpZGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlclJlbmFtZVByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCBuZXcgY2xhc3MgaW1wbGVtZW50cyB2c2NvZGUuUmVuYW1lUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVJlbmFtZUVkaXRzKGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBwb3NpdGlvbjogdnNjb2RlLlBvc2l0aW9uLCBuZXdOYW1lOiBzdHJpbmcpIHtcblx0XHRcdFx0Y29uc3QgZWRpdCA9IG5ldyB0eXBlcy5Xb3Jrc3BhY2VFZGl0KCk7XG5cdFx0XHRcdGVkaXQuaW5zZXJ0KGRvY3VtZW50LnVyaSwgPHR5cGVzLlBvc2l0aW9uPnBvc2l0aW9uLCBuZXdOYW1lKTtcblx0XHRcdFx0cmV0dXJuIGVkaXQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXG5cdFx0Y29uc3QgZWRpdCA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Xb3Jrc3BhY2VFZGl0PigndnNjb2RlLmV4ZWN1dGVEb2N1bWVudFJlbmFtZVByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMTIpLCAnbmV3TmFtZU9mVGhpcycpO1xuXG5cdFx0YXNzZXJ0Lm9rKGVkaXQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlZGl0Lmhhcyhtb2RlbC51cmkpLCB0cnVlKTtcblx0XHRjb25zdCB0ZXh0RWRpdHMgPSBlZGl0LmdldChtb2RlbC51cmkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0ZXh0RWRpdHMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGV4dEVkaXRzWzBdLm5ld1RleHQsICduZXdOYW1lT2ZUaGlzJyk7XG5cdH0pO1xuXG5cdC8vIC0tLSBkZWZpbml0aW9uXG5cblx0dGVzdCgnRGVmaW5pdGlvbiwgaW52YWxpZCBhcmd1bWVudHMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgcHJvbWlzZXMgPSBbXG5cdFx0XHRhc3NlcnRSZWplY3RzKCgpID0+IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUuZXhlY3V0ZURlZmluaXRpb25Qcm92aWRlcicpKSxcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlRGVmaW5pdGlvblByb3ZpZGVyJywgbnVsbCkpLFxuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVEZWZpbml0aW9uUHJvdmlkZXInLCB1bmRlZmluZWQpKSxcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlRGVmaW5pdGlvblByb3ZpZGVyJywgdHJ1ZSwgZmFsc2UpKVxuXHRcdF07XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHR9KTtcblxuXHR0ZXN0KCdEZWZpbml0aW9uLCBiYWNrIGFuZCBmb3J0aCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKGRvYy51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHQvLyBkdXBsaWNhdGUgcmVzdWx0IHdpbGwgZ2V0IHJlbW92ZWRcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEZWZpbml0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuRGVmaW5pdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEZWZpbml0aW9uKGRvYzogYW55KTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDIsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDMsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDQsIDAsIDAsIDApKSxcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Mb2NhdGlvbltdPigndnNjb2RlLmV4ZWN1dGVEZWZpbml0aW9uUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgNCk7XG5cdFx0XHRcdGZvciAoY29uc3QgdiBvZiB2YWx1ZXMpIHtcblx0XHRcdFx0XHRhc3NlcnQub2sodi51cmkgaW5zdGFuY2VvZiBVUkkpO1xuXHRcdFx0XHRcdGFzc2VydC5vayh2LnJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblxuXHR0ZXN0KCdEZWZpbml0aW9uLCBiYWNrIGFuZCBmb3J0aCAoc29ydGluZyAmIGRlLWRlZHVwaW5nKScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKFVSSS5wYXJzZSgnZmlsZTovLy9iJyksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHQvLyBkdXBsaWNhdGUgcmVzdWx0IHdpbGwgZ2V0IHJlbW92ZWRcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihVUkkucGFyc2UoJ2ZpbGU6Ly8vYicpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEZWZpbml0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuRGVmaW5pdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEZWZpbml0aW9uKGRvYzogYW55KTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oVVJJLnBhcnNlKCdmaWxlOi8vL2EnKSwgbmV3IHR5cGVzLlJhbmdlKDIsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oVVJJLnBhcnNlKCdmaWxlOi8vL2MnKSwgbmV3IHR5cGVzLlJhbmdlKDMsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oVVJJLnBhcnNlKCdmaWxlOi8vL2QnKSwgbmV3IHR5cGVzLlJhbmdlKDQsIDAsIDAsIDApKSxcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Mb2NhdGlvbltdPigndnNjb2RlLmV4ZWN1dGVEZWZpbml0aW9uUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgNCk7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlc1swXS51cmkucGF0aCwgJy9hJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZXNbMV0udXJpLnBhdGgsICcvYicpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzWzJdLnVyaS5wYXRoLCAnL2MnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlc1szXS51cmkucGF0aCwgJy9kJyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGVmaW5pdGlvbiBMaW5rJywgKCkgPT4ge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWZpbml0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlZmluaXRpb24oZG9jOiBhbnkpOiAodnNjb2RlLkxvY2F0aW9uIHwgdnNjb2RlLkxvY2F0aW9uTGluaylbXSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bmV3IHR5cGVzLkxvY2F0aW9uKGRvYy51cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSksXG5cdFx0XHRcdFx0eyB0YXJnZXRVcmk6IGRvYy51cmksIHRhcmdldFJhbmdlOiBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCksIHRhcmdldFNlbGVjdGlvblJhbmdlOiBuZXcgdHlwZXMuUmFuZ2UoMSwgMSwgMSwgMSksIG9yaWdpblNlbGVjdGlvblJhbmdlOiBuZXcgdHlwZXMuUmFuZ2UoMiwgMiwgMiwgMikgfVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8KHZzY29kZS5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10+KCd2c2NvZGUuZXhlY3V0ZURlZmluaXRpb25Qcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKS50aGVuKHZhbHVlcyA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0Zm9yIChjb25zdCB2IG9mIHZhbHVlcykge1xuXHRcdFx0XHRcdGlmIChpc0xvY2F0aW9uKHYpKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi51cmkgaW5zdGFuY2VvZiBVUkkpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYucmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFVyaSBpbnN0YW5jZW9mIFVSSSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi50YXJnZXRSYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFNlbGVjdGlvblJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYub3JpZ2luU2VsZWN0aW9uUmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tIGRlY2xhcmF0aW9uXG5cblx0dGVzdCgnRGVjbGFyYXRpb24sIGJhY2sgYW5kIGZvcnRoJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWNsYXJhdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEZWNsYXJhdGlvbihkb2M6IGFueSk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDAsIDApKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRGVjbGFyYXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5EZWNsYXJhdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEZWNsYXJhdGlvbihkb2M6IGFueSk6IGFueSB7XG5cdFx0XHRcdC8vIGR1cGxpY2F0ZSByZXN1bHQgd2lsbCBnZXQgcmVtb3ZlZFxuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKGRvYy51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRlY2xhcmF0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuRGVjbGFyYXRpb25Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlRGVjbGFyYXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMiwgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMywgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoNCwgMCwgMCwgMCkpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkxvY2F0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZURlY2xhcmF0aW9uUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgNCk7XG5cdFx0XHRcdGZvciAoY29uc3QgdiBvZiB2YWx1ZXMpIHtcblx0XHRcdFx0XHRhc3NlcnQub2sodi51cmkgaW5zdGFuY2VvZiBVUkkpO1xuXHRcdFx0XHRcdGFzc2VydC5vayh2LnJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRGVjbGFyYXRpb24gTGluaycsICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEZWNsYXJhdGlvblByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkRlY2xhcmF0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURlY2xhcmF0aW9uKGRvYzogYW55KTogKHZzY29kZS5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10ge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdHsgdGFyZ2V0VXJpOiBkb2MudXJpLCB0YXJnZXRSYW5nZTogbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDAsIDApLCB0YXJnZXRTZWxlY3Rpb25SYW5nZTogbmV3IHR5cGVzLlJhbmdlKDEsIDEsIDEsIDEpLCBvcmlnaW5TZWxlY3Rpb25SYW5nZTogbmV3IHR5cGVzLlJhbmdlKDIsIDIsIDIsIDIpIH1cblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPCh2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdPigndnNjb2RlLmV4ZWN1dGVEZWNsYXJhdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHYgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdFx0aWYgKGlzTG9jYXRpb24odikpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnVyaSBpbnN0YW5jZW9mIFVSSSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi5yYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYudGFyZ2V0VXJpIGluc3RhbmNlb2YgVVJJKTtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYudGFyZ2V0U2VsZWN0aW9uUmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi5vcmlnaW5TZWxlY3Rpb25SYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0gdHlwZSBkZWZpbml0aW9uXG5cblx0dGVzdCgnVHlwZSBEZWZpbml0aW9uLCBpbnZhbGlkIGFyZ3VtZW50cycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBwcm9taXNlcyA9IFtcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcicpKSxcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcicsIG51bGwpKSxcblx0XHRcdGFzc2VydFJlamVjdHMoKCkgPT4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQoJ3ZzY29kZS5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcicsIHVuZGVmaW5lZCkpLFxuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVUeXBlRGVmaW5pdGlvblByb3ZpZGVyJywgdHJ1ZSwgZmFsc2UpKVxuXHRcdF07XG5cblx0XHRyZXR1cm4gUHJvbWlzZS5hbGwocHJvbWlzZXMpO1xuXHR9KTtcblxuXHR0ZXN0KCdUeXBlIERlZmluaXRpb24sIGJhY2sgYW5kIGZvcnRoJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyVHlwZURlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5UeXBlRGVmaW5pdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVUeXBlRGVmaW5pdGlvbihkb2M6IGFueSk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDAsIDApKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyVHlwZURlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5UeXBlRGVmaW5pdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVUeXBlRGVmaW5pdGlvbihkb2M6IGFueSk6IGFueSB7XG5cdFx0XHRcdC8vIGR1cGxpY2F0ZSByZXN1bHQgd2lsbCBnZXQgcmVtb3ZlZFxuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKGRvYy51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlclR5cGVEZWZpbml0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuVHlwZURlZmluaXRpb25Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlVHlwZURlZmluaXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMiwgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMywgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoNCwgMCwgMCwgMCkpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkxvY2F0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZVR5cGVEZWZpbml0aW9uUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgNCk7XG5cdFx0XHRcdGZvciAoY29uc3QgdiBvZiB2YWx1ZXMpIHtcblx0XHRcdFx0XHRhc3NlcnQub2sodi51cmkgaW5zdGFuY2VvZiBVUkkpO1xuXHRcdFx0XHRcdGFzc2VydC5vayh2LnJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnVHlwZSBEZWZpbml0aW9uIExpbmsnLCAoKSA9PiB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyVHlwZURlZmluaXRpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5UeXBlRGVmaW5pdGlvblByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVUeXBlRGVmaW5pdGlvbihkb2M6IGFueSk6ICh2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdIHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKSxcblx0XHRcdFx0XHR7IHRhcmdldFVyaTogZG9jLnVyaSwgdGFyZ2V0UmFuZ2U6IG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSwgdGFyZ2V0U2VsZWN0aW9uUmFuZ2U6IG5ldyB0eXBlcy5SYW5nZSgxLCAxLCAxLCAxKSwgb3JpZ2luU2VsZWN0aW9uUmFuZ2U6IG5ldyB0eXBlcy5SYW5nZSgyLCAyLCAyLCAyKSB9XG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJwY1Byb3RvY29sLnN5bmMoKS50aGVuKCgpID0+IHtcblx0XHRcdHJldHVybiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDwodnNjb2RlLkxvY2F0aW9uIHwgdnNjb2RlLkxvY2F0aW9uTGluaylbXT4oJ3ZzY29kZS5leGVjdXRlVHlwZURlZmluaXRpb25Qcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKS50aGVuKHZhbHVlcyA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZXMubGVuZ3RoLCAyKTtcblx0XHRcdFx0Zm9yIChjb25zdCB2IG9mIHZhbHVlcykge1xuXHRcdFx0XHRcdGlmIChpc0xvY2F0aW9uKHYpKSB7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi51cmkgaW5zdGFuY2VvZiBVUkkpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYucmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFVyaSBpbnN0YW5jZW9mIFVSSSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi50YXJnZXRSYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFNlbGVjdGlvblJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYub3JpZ2luU2VsZWN0aW9uUmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0Ly8gLS0tIGltcGxlbWVudGF0aW9uXG5cblx0dGVzdCgnSW1wbGVtZW50YXRpb24sIGludmFsaWQgYXJndW1lbnRzJywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IHByb21pc2VzID0gW1xuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyJykpLFxuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyJywgbnVsbCkpLFxuXHRcdFx0YXNzZXJ0UmVqZWN0cygoKSA9PiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZCgndnNjb2RlLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyJywgdW5kZWZpbmVkKSksXG5cdFx0XHRhc3NlcnRSZWplY3RzKCgpID0+IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kKCd2c2NvZGUuZXhlY3V0ZUltcGxlbWVudGF0aW9uUHJvdmlkZXInLCB0cnVlLCBmYWxzZSkpXG5cdFx0XTtcblxuXHRcdHJldHVybiBQcm9taXNlLmFsbChwcm9taXNlcyk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ltcGxlbWVudGF0aW9uLCBiYWNrIGFuZCBmb3J0aCcsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckltcGxlbWVudGF0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuSW1wbGVtZW50YXRpb25Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlSW1wbGVtZW50YXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkxvY2F0aW9uKGRvYy51cmksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckltcGxlbWVudGF0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuSW1wbGVtZW50YXRpb25Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlSW1wbGVtZW50YXRpb24oZG9jOiBhbnkpOiBhbnkge1xuXHRcdFx0XHQvLyBkdXBsaWNhdGUgcmVzdWx0IHdpbGwgZ2V0IHJlbW92ZWRcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMCwgMCkpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkltcGxlbWVudGF0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUltcGxlbWVudGF0aW9uKGRvYzogYW55KTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDIsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDMsIDAsIDAsIDApKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuTG9jYXRpb24oZG9jLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDQsIDAsIDAsIDApKSxcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Mb2NhdGlvbltdPigndnNjb2RlLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDQpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHYgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdFx0YXNzZXJ0Lm9rKHYudXJpIGluc3RhbmNlb2YgVVJJKTtcblx0XHRcdFx0XHRhc3NlcnQub2sodi5yYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ltcGxlbWVudGF0aW9uIERlZmluaXRpb24gTGluaycsICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJJbXBsZW1lbnRhdGlvblByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkltcGxlbWVudGF0aW9uUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUltcGxlbWVudGF0aW9uKGRvYzogYW55KTogKHZzY29kZS5Mb2NhdGlvbiB8IHZzY29kZS5Mb2NhdGlvbkxpbmspW10ge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5Mb2NhdGlvbihkb2MudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdHsgdGFyZ2V0VXJpOiBkb2MudXJpLCB0YXJnZXRSYW5nZTogbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDAsIDApLCB0YXJnZXRTZWxlY3Rpb25SYW5nZTogbmV3IHR5cGVzLlJhbmdlKDEsIDEsIDEsIDEpLCBvcmlnaW5TZWxlY3Rpb25SYW5nZTogbmV3IHR5cGVzLlJhbmdlKDIsIDIsIDIsIDIpIH1cblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPCh2c2NvZGUuTG9jYXRpb24gfCB2c2NvZGUuTG9jYXRpb25MaW5rKVtdPigndnNjb2RlLmV4ZWN1dGVJbXBsZW1lbnRhdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDIpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IHYgb2YgdmFsdWVzKSB7XG5cdFx0XHRcdFx0aWYgKGlzTG9jYXRpb24odikpIHtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnVyaSBpbnN0YW5jZW9mIFVSSSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi5yYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYudGFyZ2V0VXJpIGluc3RhbmNlb2YgVVJJKTtcblx0XHRcdFx0XHRcdGFzc2VydC5vayh2LnRhcmdldFJhbmdlIGluc3RhbmNlb2YgdHlwZXMuUmFuZ2UpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKHYudGFyZ2V0U2VsZWN0aW9uUmFuZ2UgaW5zdGFuY2VvZiB0eXBlcy5SYW5nZSk7XG5cdFx0XHRcdFx0XHRhc3NlcnQub2sodi5vcmlnaW5TZWxlY3Rpb25SYW5nZSBpbnN0YW5jZW9mIHR5cGVzLlJhbmdlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0gcmVmZXJlbmNlc1xuXG5cdHRlc3QoJ3JlZmVyZW5jZSBzZWFyY2gsIGJhY2sgYW5kIGZvcnRoJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyUmVmZXJlbmNlUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuUmVmZXJlbmNlUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZVJlZmVyZW5jZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bmV3IHR5cGVzLkxvY2F0aW9uKFVSSS5wYXJzZSgnc29tZTp1cmkvcGF0aCcpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMSwgMCwgNSkpXG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Mb2NhdGlvbltdPigndnNjb2RlLmV4ZWN1dGVSZWZlcmVuY2VQcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKS50aGVuKHZhbHVlcyA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgMSk7XG5cdFx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWVzO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnVyaS50b1N0cmluZygpLCAnc29tZTp1cmkvcGF0aCcpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLmVuZC5jaGFyYWN0ZXIsIDUpO1xuXHRcdH0pO1xuXHR9KTtcblxuXHQvLyAtLS0gZG9jdW1lbnQgaGlnaGxpZ2h0c1xuXG5cdHRlc3QoJ1widnNjb2RlLmV4ZWN1dGVEb2N1bWVudEhpZ2hsaWdodHNcIiBBUEkgaGFzIHN0b3BwZWQgcmV0dXJuaW5nIERvY3VtZW50SGlnaGxpZ2h0W10jMjAwMDU2JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudEhpZ2hsaWdodFByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkRvY3VtZW50SGlnaGxpZ2h0UHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURvY3VtZW50SGlnaGxpZ2h0cygpIHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuRG9jdW1lbnRIaWdobGlnaHQobmV3IHR5cGVzLlJhbmdlKDAsIDE3LCAwLCAyNSksIHR5cGVzLkRvY3VtZW50SGlnaGxpZ2h0S2luZC5SZWFkKVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdHJldHVybiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuRG9jdW1lbnRIaWdobGlnaHRbXT4oJ3ZzY29kZS5leGVjdXRlRG9jdW1lbnRIaWdobGlnaHRzJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpLnRoZW4odmFsdWVzID0+IHtcblx0XHRcdGFzc2VydC5vayhBcnJheS5pc0FycmF5KHZhbHVlcykpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDEpO1xuXHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlcztcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5zdGFydC5jaGFyYWN0ZXIsIDE3KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UuZW5kLmNoYXJhY3RlciwgMjUpO1xuXHRcdH0pO1xuXG5cdH0pO1xuXG5cdC8vIC0tLSBvdXRsaW5lXG5cblx0dGVzdCgnT3V0bGluZSwgYmFjayBhbmQgZm9ydGgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEb2N1bWVudFN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ3Rlc3RpbmcxJywgdHlwZXMuU3ltYm9sS2luZC5FbnVtLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMSwgMCkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5TeW1ib2xJbmZvcm1hdGlvbigndGVzdGluZzInLCB0eXBlcy5TeW1ib2xLaW5kLkVudW0sIG5ldyB0eXBlcy5SYW5nZSgwLCAxLCAwLCAzKSksXG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJwY1Byb3RvY29sLnN5bmMoKS50aGVuKCgpID0+IHtcblx0XHRcdHJldHVybiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuU3ltYm9sSW5mb3JtYXRpb25bXT4oJ3ZzY29kZS5leGVjdXRlRG9jdW1lbnRTeW1ib2xQcm92aWRlcicsIG1vZGVsLnVyaSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IHZhbHVlcztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0IGluc3RhbmNlb2YgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kIGluc3RhbmNlb2YgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QubmFtZSwgJ3Rlc3RpbmcyJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQubmFtZSwgJ3Rlc3RpbmcxJyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgndnNjb2RlLmV4ZWN1dGVEb2N1bWVudFN5bWJvbFByb3ZpZGVyIGNvbW1hbmQgb25seSByZXR1cm5zIFN5bWJvbEluZm9ybWF0aW9uW10gcmF0aGVyIHRoYW4gRG9jdW1lbnRTeW1ib2xbXSAjNTc5ODQnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRTeW1ib2xQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Eb2N1bWVudFN5bWJvbFByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVEb2N1bWVudFN5bWJvbHMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24oJ1N5bWJvbEluZm9ybWF0aW9uJywgdHlwZXMuU3ltYm9sS2luZC5FbnVtLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMSwgMCkpXG5cdFx0XHRcdF07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckRvY3VtZW50U3ltYm9sUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuRG9jdW1lbnRTeW1ib2xQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCk6IGFueSB7XG5cdFx0XHRcdGNvbnN0IHJvb3QgPSBuZXcgdHlwZXMuRG9jdW1lbnRTeW1ib2woJ0RvY3VtZW50U3ltYm9sJywgJ0RvY3VtZW50U3ltYm9sI2RldGFpbCcsIHR5cGVzLlN5bWJvbEtpbmQuRW51bSwgbmV3IHR5cGVzLlJhbmdlKDEsIDAsIDEsIDApLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMSwgMCkpO1xuXHRcdFx0XHRyb290LmNoaWxkcmVuID0gW25ldyB0eXBlcy5Eb2N1bWVudFN5bWJvbCgnRG9jdW1lbnRTeW1ib2wjY2hpbGQnLCAnRG9jdW1lbnRTeW1ib2wjZGV0YWlsI2NoaWxkJywgdHlwZXMuU3ltYm9sS2luZC5FbnVtLCBuZXcgdHlwZXMuUmFuZ2UoMSwgMCwgMSwgMCksIG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAxLCAwKSldO1xuXHRcdFx0XHRyZXR1cm4gW3Jvb3RdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8KHZzY29kZS5TeW1ib2xJbmZvcm1hdGlvbiAmIHZzY29kZS5Eb2N1bWVudFN5bWJvbClbXT4oJ3ZzY29kZS5leGVjdXRlRG9jdW1lbnRTeW1ib2xQcm92aWRlcicsIG1vZGVsLnVyaSkudGhlbih2YWx1ZXMgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVzLmxlbmd0aCwgMik7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kXSA9IHZhbHVlcztcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0IGluc3RhbmNlb2YgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QgaW5zdGFuY2VvZiB0eXBlcy5Eb2N1bWVudFN5bWJvbCwgZmFsc2UpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kIGluc3RhbmNlb2YgdHlwZXMuU3ltYm9sSW5mb3JtYXRpb24sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QubmFtZSwgJ0RvY3VtZW50U3ltYm9sJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jaGlsZHJlbi5sZW5ndGgsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLm5hbWUsICdTeW1ib2xJbmZvcm1hdGlvbicpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBzdWdnZXN0XG5cblx0dGVzdEFwaUNtZCgndHJpZ2dlckNoYXJhY3RlciBpcyBudWxsIHdoZW4gY29tcGxldGlvbiBwcm92aWRlciBpcyBjYWxsZWQgcHJvZ3JhbW1hdGljYWxseSAjMTU5OTE0JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGFjdHVhbENvbnRleHQ6IHZzY29kZS5Db21wbGV0aW9uQ29udGV4dCB8IHVuZGVmaW5lZDtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKF9kb2MsIF9wb3MsIF90b2ssIGNvbnRleHQpOiBhbnkge1xuXHRcdFx0XHRhY3R1YWxDb250ZXh0ID0gY29udGV4dDtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuQ29tcGxldGlvbkxpc3Q+KCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCA0KSk7XG5cblx0XHRhc3NlcnQub2soYWN0dWFsQ29udGV4dCk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChhY3R1YWxDb250ZXh0LCB7IHRyaWdnZXJLaW5kOiB0eXBlcy5Db21wbGV0aW9uVHJpZ2dlcktpbmQuSW52b2tlLCB0cmlnZ2VyQ2hhcmFjdGVyOiB1bmRlZmluZWQgfSk7XG5cblx0fSk7XG5cblx0dGVzdEFwaUNtZCgnU3VnZ2VzdCwgYmFjayBhbmQgZm9ydGgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcygpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBhID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKCdpdGVtMScpO1xuXHRcdFx0XHRhLmRvY3VtZW50YXRpb24gPSBuZXcgdHlwZXMuTWFya2Rvd25TdHJpbmcoJ2hlbGxvX21kX3N0cmluZycpO1xuXHRcdFx0XHRjb25zdCBiID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKCdpdGVtMicpO1xuXHRcdFx0XHRiLnRleHRFZGl0ID0gdHlwZXMuVGV4dEVkaXQucmVwbGFjZShuZXcgdHlwZXMuUmFuZ2UoMCwgNCwgMCwgOCksICdmb28nKTsgLy8gb3ZlcndpdGUgYWZ0ZXJcblx0XHRcdFx0Y29uc3QgYyA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTMnKTtcblx0XHRcdFx0Yy50ZXh0RWRpdCA9IHR5cGVzLlRleHRFZGl0LnJlcGxhY2UobmV3IHR5cGVzLlJhbmdlKDAsIDEsIDAsIDYpLCAnZm9vYmFyJyk7IC8vIG92ZXJ3aXRlIGJlZm9yZSAmIGFmdGVyXG5cblx0XHRcdFx0Ly8gc25pcHBldCBzdHJpbmchXG5cdFx0XHRcdGNvbnN0IGQgPSBuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ2l0ZW00Jyk7XG5cdFx0XHRcdGQucmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMCwgMSwgMCwgNCk7Ly8gb3ZlcndpdGUgYmVmb3JlXG5cdFx0XHRcdGQuaW5zZXJ0VGV4dCA9IG5ldyB0eXBlcy5TbmlwcGV0U3RyaW5nKCdmb28kMGJhcicpO1xuXHRcdFx0XHRyZXR1cm4gW2EsIGIsIGMsIGRdO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCBsaXN0ID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvbXBsZXRpb25MaXN0PigndnNjb2RlLmV4ZWN1dGVDb21wbGV0aW9uSXRlbVByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgNCkpO1xuXHRcdGFzc2VydC5vayhsaXN0IGluc3RhbmNlb2YgdHlwZXMuQ29tcGxldGlvbkxpc3QpO1xuXHRcdGNvbnN0IHZhbHVlcyA9IGxpc3QuaXRlbXM7XG5cdFx0YXNzZXJ0Lm9rKEFycmF5LmlzQXJyYXkodmFsdWVzKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlcy5sZW5ndGgsIDQpO1xuXHRcdGNvbnN0IFtmaXJzdCwgc2Vjb25kLCB0aGlyZCwgZm91cnRoXSA9IHZhbHVlcztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QubGFiZWwsICdpdGVtMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0RWRpdCwgdW5kZWZpbmVkKTsgLy8gbm8gdGV4dCBlZGl0LCBkZWZhdWx0IHJhbmdlc1xuXHRcdGFzc2VydC5vayghdHlwZXMuUmFuZ2UuaXNSYW5nZShmaXJzdC5yYW5nZSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPHR5cGVzLk1hcmtkb3duU3RyaW5nPmZpcnN0LmRvY3VtZW50YXRpb24pLnZhbHVlLCAnaGVsbG9fbWRfc3RyaW5nJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5sYWJlbCwgJ2l0ZW0yJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC50ZXh0RWRpdCEubmV3VGV4dCwgJ2ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQudGV4dEVkaXQhLnJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQudGV4dEVkaXQhLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgNCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC50ZXh0RWRpdCEucmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQudGV4dEVkaXQhLnJhbmdlLmVuZC5jaGFyYWN0ZXIsIDgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh0aGlyZC5sYWJlbCwgJ2l0ZW0zJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXJkLnRleHRFZGl0IS5uZXdUZXh0LCAnZm9vYmFyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXJkLnRleHRFZGl0IS5yYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGhpcmQudGV4dEVkaXQhLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXJkLnRleHRFZGl0IS5yYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRoaXJkLnRleHRFZGl0IS5yYW5nZS5lbmQuY2hhcmFjdGVyLCA2KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91cnRoLmxhYmVsLCAnaXRlbTQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZm91cnRoLnRleHRFZGl0LCB1bmRlZmluZWQpO1xuXHRcdGNvbnN0IHJhbmdlOiBhbnkgPSBmb3VydGgucmFuZ2UhO1xuXHRcdGFzc2VydC5vayh0eXBlcy5SYW5nZS5pc1JhbmdlKHJhbmdlKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLnN0YXJ0LmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5zdGFydC5jaGFyYWN0ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhbmdlLmVuZC5jaGFyYWN0ZXIsIDQpO1xuXHRcdGFzc2VydC5vayhmb3VydGguaW5zZXJ0VGV4dCBpbnN0YW5jZW9mIHR5cGVzLlNuaXBwZXRTdHJpbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoPHR5cGVzLlNuaXBwZXRTdHJpbmc+Zm91cnRoLmluc2VydFRleHQpLnZhbHVlLCAnZm9vJDBiYXInKTtcblxuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCdTdWdnZXN0LCByZXR1cm4gQ29tcGxldGlvbkxpc3QgIWFycmF5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Db21wbGV0aW9uSXRlbVByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0Y29uc3QgYSA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTEnKTtcblx0XHRcdFx0Y29uc3QgYiA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTInKTtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Db21wbGV0aW9uTGlzdCg8YW55PlthLCBiXSwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fSwgW10pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IGxpc3QgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuQ29tcGxldGlvbkxpc3Q+KCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCA0KSk7XG5cblx0XHRhc3NlcnQub2sobGlzdCBpbnN0YW5jZW9mIHR5cGVzLkNvbXBsZXRpb25MaXN0KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlzdC5pc0luY29tcGxldGUsIHRydWUpO1xuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCdTdWdnZXN0LCByZXNvbHZlIGNvbXBsZXRpb24gaXRlbXMnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblxuXHRcdGxldCByZXNvbHZlQ291bnQgPSAwO1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Db21wbGV0aW9uSXRlbVByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0Y29uc3QgYSA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTEnKTtcblx0XHRcdFx0Y29uc3QgYiA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTInKTtcblx0XHRcdFx0Y29uc3QgYyA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTMnKTtcblx0XHRcdFx0Y29uc3QgZCA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTQnKTtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5Db21wbGV0aW9uTGlzdChbYSwgYiwgYywgZF0sIGZhbHNlKTtcblx0XHRcdH0sXG5cdFx0XHRyZXNvbHZlQ29tcGxldGlvbkl0ZW0oaXRlbSkge1xuXHRcdFx0XHRyZXNvbHZlQ291bnQgKz0gMTtcblx0XHRcdFx0cmV0dXJuIGl0ZW07XG5cdFx0XHR9XG5cdFx0fSwgW10pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IGxpc3QgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuQ29tcGxldGlvbkxpc3Q+KFxuXHRcdFx0J3ZzY29kZS5leGVjdXRlQ29tcGxldGlvbkl0ZW1Qcm92aWRlcicsXG5cdFx0XHRtb2RlbC51cmksXG5cdFx0XHRuZXcgdHlwZXMuUG9zaXRpb24oMCwgNCksXG5cdFx0XHR1bmRlZmluZWQsXG5cdFx0XHQyIC8vIG1heEl0ZW1zVG9SZXNvbHZlXG5cdFx0KTtcblxuXHRcdGFzc2VydC5vayhsaXN0IGluc3RhbmNlb2YgdHlwZXMuQ29tcGxldGlvbkxpc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlQ291bnQsIDIpO1xuXG5cdH0pO1xuXG5cdHRlc3RBcGlDbWQoJ1widnNjb2RlLmV4ZWN1dGVDb21wbGV0aW9uSXRlbVByb3ZpZGVyXCIgZG9lc25vdCByZXR1cm4gYSBwcmVzZWxlY3QgZmllbGQgIzUzNzQ5JywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNvbXBsZXRpb25JdGVtUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuQ29tcGxldGlvbkl0ZW1Qcm92aWRlcj57XG5cdFx0XHRwcm92aWRlQ29tcGxldGlvbkl0ZW1zKCk6IGFueSB7XG5cdFx0XHRcdGNvbnN0IGEgPSBuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ2l0ZW0xJyk7XG5cdFx0XHRcdGEucHJlc2VsZWN0ID0gdHJ1ZTtcblx0XHRcdFx0Y29uc3QgYiA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTInKTtcblx0XHRcdFx0Y29uc3QgYyA9IG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnaXRlbTMnKTtcblx0XHRcdFx0Yy5wcmVzZWxlY3QgPSB0cnVlO1xuXHRcdFx0XHRjb25zdCBkID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKCdpdGVtNCcpO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbXBsZXRpb25MaXN0KFthLCBiLCBjLCBkXSwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCBsaXN0ID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvbXBsZXRpb25MaXN0Pihcblx0XHRcdCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLFxuXHRcdFx0bW9kZWwudXJpLFxuXHRcdFx0bmV3IHR5cGVzLlBvc2l0aW9uKDAsIDQpLFxuXHRcdFx0dW5kZWZpbmVkXG5cdFx0KTtcblxuXHRcdGFzc2VydC5vayhsaXN0IGluc3RhbmNlb2YgdHlwZXMuQ29tcGxldGlvbkxpc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0Lml0ZW1zLmxlbmd0aCwgNCk7XG5cblx0XHRjb25zdCBbYSwgYiwgYywgZF0gPSBsaXN0Lml0ZW1zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLnByZXNlbGVjdCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGIucHJlc2VsZWN0LCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjLnByZXNlbGVjdCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGQucHJlc2VsZWN0LCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCdleGVjdXRlQ29tcGxldGlvbkl0ZW1Qcm92aWRlciBkb2VzblxcJ3QgY2FwdHVyZSBjb21taXRDaGFyYWN0ZXJzICM1ODIyOCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJDb21wbGV0aW9uSXRlbVByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkNvbXBsZXRpb25JdGVtUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUNvbXBsZXRpb25JdGVtcygpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBhID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKCdpdGVtMScpO1xuXHRcdFx0XHRhLmNvbW1pdENoYXJhY3RlcnMgPSBbJ2EnLCAnYiddO1xuXHRcdFx0XHRjb25zdCBiID0gbmV3IHR5cGVzLkNvbXBsZXRpb25JdGVtKCdpdGVtMicpO1xuXHRcdFx0XHRyZXR1cm4gbmV3IHR5cGVzLkNvbXBsZXRpb25MaXN0KFthLCBiXSwgZmFsc2UpO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCBsaXN0ID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvbXBsZXRpb25MaXN0Pihcblx0XHRcdCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLFxuXHRcdFx0bW9kZWwudXJpLFxuXHRcdFx0bmV3IHR5cGVzLlBvc2l0aW9uKDAsIDQpLFxuXHRcdFx0dW5kZWZpbmVkXG5cdFx0KTtcblxuXHRcdGFzc2VydC5vayhsaXN0IGluc3RhbmNlb2YgdHlwZXMuQ29tcGxldGlvbkxpc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0Lml0ZW1zLmxlbmd0aCwgMik7XG5cblx0XHRjb25zdCBbYSwgYl0gPSBsaXN0Lml0ZW1zO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoYS5jb21taXRDaGFyYWN0ZXJzLCBbJ2EnLCAnYiddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYi5jb21taXRDaGFyYWN0ZXJzLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXIgcmV0dXJucyB0aGUgd3JvbmcgQ29tcGxldGlvbkl0ZW1LaW5kcyBpbiBpbnNpZGVycyAjOTU3MTUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyQ29tcGxldGlvbkl0ZW1Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Db21wbGV0aW9uSXRlbVByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRuZXcgdHlwZXMuQ29tcGxldGlvbkl0ZW0oJ015IE1ldGhvZCcsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5NZXRob2QpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Db21wbGV0aW9uSXRlbSgnTXkgUHJvcGVydHknLCB0eXBlcy5Db21wbGV0aW9uSXRlbUtpbmQuUHJvcGVydHkpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0sIFtdKSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCBsaXN0ID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvbXBsZXRpb25MaXN0Pihcblx0XHRcdCd2c2NvZGUuZXhlY3V0ZUNvbXBsZXRpb25JdGVtUHJvdmlkZXInLFxuXHRcdFx0bW9kZWwudXJpLFxuXHRcdFx0bmV3IHR5cGVzLlBvc2l0aW9uKDAsIDQpLFxuXHRcdFx0dW5kZWZpbmVkXG5cdFx0KTtcblxuXHRcdGFzc2VydC5vayhsaXN0IGluc3RhbmNlb2YgdHlwZXMuQ29tcGxldGlvbkxpc3QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaXN0Lml0ZW1zLmxlbmd0aCwgMik7XG5cblx0XHRjb25zdCBbYSwgYl0gPSBsaXN0Lml0ZW1zO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhLmtpbmQsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5NZXRob2QpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChiLmtpbmQsIHR5cGVzLkNvbXBsZXRpb25JdGVtS2luZC5Qcm9wZXJ0eSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBzaWduYXR1cmVIZWxwXG5cblx0dGVzdCgnUGFyYW1ldGVyIEhpbnRzLCBiYWNrIGFuZCBmb3J0aCcsIGFzeW5jICgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJTaWduYXR1cmVIZWxwUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5TaWduYXR1cmVIZWxwUHJvdmlkZXIge1xuXHRcdFx0cHJvdmlkZVNpZ25hdHVyZUhlbHAoX2RvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBfcG9zaXRpb246IHZzY29kZS5Qb3NpdGlvbiwgX3Rva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4sIGNvbnRleHQ6IHZzY29kZS5TaWduYXR1cmVIZWxwQ29udGV4dCk6IHZzY29kZS5TaWduYXR1cmVIZWxwIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRhY3RpdmVTaWduYXR1cmU6IDAsXG5cdFx0XHRcdFx0YWN0aXZlUGFyYW1ldGVyOiAxLFxuXHRcdFx0XHRcdHNpZ25hdHVyZXM6IFtcblx0XHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdFx0bGFiZWw6ICdhYmMnLFxuXHRcdFx0XHRcdFx0XHRkb2N1bWVudGF0aW9uOiBgJHtjb250ZXh0LnRyaWdnZXJLaW5kID09PSAxIC8qIHZzY29kZS5TaWduYXR1cmVIZWxwVHJpZ2dlcktpbmQuSW52b2tlICovID8gJ2ludm9rZWQnIDogJ3Vua25vd24nfSAke2NvbnRleHQudHJpZ2dlckNoYXJhY3Rlcn1gLFxuXHRcdFx0XHRcdFx0XHRwYXJhbWV0ZXJzOiBbXVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdF1cblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9LCBbXSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXG5cdFx0Y29uc3QgZmlyc3RWYWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5TaWduYXR1cmVIZWxwPigndnNjb2RlLmV4ZWN1dGVTaWduYXR1cmVIZWxwUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAxKSwgJywnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3RWYWx1ZS5hY3RpdmVTaWduYXR1cmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdFZhbHVlLmFjdGl2ZVBhcmFtZXRlciwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0VmFsdWUuc2lnbmF0dXJlcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdFZhbHVlLnNpZ25hdHVyZXNbMF0ubGFiZWwsICdhYmMnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3RWYWx1ZS5zaWduYXR1cmVzWzBdLmRvY3VtZW50YXRpb24sICdpbnZva2VkICwnKTtcblx0fSk7XG5cblx0Ly8gLS0tIHF1aWNrZml4XG5cblx0dGVzdEFwaUNtZCgnUXVpY2tGaXgsIGJhY2sgYW5kIGZvcnRoJywgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNvZGVBY3Rpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3Rvciwge1xuXHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKCk6IHZzY29kZS5Db21tYW5kW10ge1xuXHRcdFx0XHRyZXR1cm4gW3sgY29tbWFuZDogJ3Rlc3RpbmcnLCB0aXRsZTogJ1RpdGxlJywgYXJndW1lbnRzOiBbMSwgMiwgdHJ1ZV0gfV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJwY1Byb3RvY29sLnN5bmMoKS50aGVuKCgpID0+IHtcblx0XHRcdHJldHVybiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuQ29tbWFuZFtdPigndnNjb2RlLmV4ZWN1dGVDb2RlQWN0aW9uUHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAxLCAxKSkudGhlbih2YWx1ZSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdFx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWU7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50aXRsZSwgJ1RpdGxlJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kLCAndGVzdGluZycpO1xuXHRcdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGZpcnN0LmFyZ3VtZW50cywgWzEsIDIsIHRydWVdKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCd2c2NvZGUuZXhlY3V0ZUNvZGVBY3Rpb25Qcm92aWRlciByZXN1bHRzIHNlZW0gdG8gYmUgbWlzc2luZyB0aGVpciBgY29tbWFuZGAgcHJvcGVydHkgIzQ1MTI0JywgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNvZGVBY3Rpb25Qcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3Rvciwge1xuXHRcdFx0cHJvdmlkZUNvZGVBY3Rpb25zKGRvY3VtZW50LCByYW5nZSk6IHZzY29kZS5Db2RlQWN0aW9uW10ge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRhcmd1bWVudHM6IFtkb2N1bWVudCwgcmFuZ2VdLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ2NvbW1hbmQnLFxuXHRcdFx0XHRcdFx0dGl0bGU6ICdjb21tYW5kX3RpdGxlJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGtpbmQ6IHR5cGVzLkNvZGVBY3Rpb25LaW5kLkVtcHR5LmFwcGVuZCgnZm9vJyksXG5cdFx0XHRcdFx0dGl0bGU6ICd0aXRsZScsXG5cdFx0XHRcdH1dO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvZGVBY3Rpb25bXT4oJ3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdFx0XHRhc3NlcnQub2soZmlyc3QuY29tbWFuZCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kLmNvbW1hbmQsICdjb21tYW5kJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kLnRpdGxlLCAnY29tbWFuZF90aXRsZScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3Qua2luZCEudmFsdWUsICdmb28nKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRpdGxlLCAndGl0bGUnKTtcblxuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3RBcGlDbWQoJ3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyIHBhc3NlcyBSYW5nZSB0byBwcm92aWRlciBhbHRob3VnaCBTZWxlY3Rpb24gaXMgcGFzc2VkIGluICM3Nzk5NycsIGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJDb2RlQWN0aW9uUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIHtcblx0XHRcdHByb3ZpZGVDb2RlQWN0aW9ucyhkb2N1bWVudCwgcmFuZ2VPclNlbGVjdGlvbik6IHZzY29kZS5Db2RlQWN0aW9uW10ge1xuXHRcdFx0XHRyZXR1cm4gW3tcblx0XHRcdFx0XHRjb21tYW5kOiB7XG5cdFx0XHRcdFx0XHRhcmd1bWVudHM6IFtkb2N1bWVudCwgcmFuZ2VPclNlbGVjdGlvbl0sXG5cdFx0XHRcdFx0XHRjb21tYW5kOiAnY29tbWFuZCcsXG5cdFx0XHRcdFx0XHR0aXRsZTogJ2NvbW1hbmRfdGl0bGUnLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0a2luZDogdHlwZXMuQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdmb28nKSxcblx0XHRcdFx0XHR0aXRsZTogJ3RpdGxlJyxcblx0XHRcdFx0fV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gbmV3IHR5cGVzLlNlbGVjdGlvbigwLCAwLCAxLCAxKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvZGVBY3Rpb25bXT4oJ3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBzZWxlY3Rpb24pLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdFx0XHRhc3NlcnQub2soZmlyc3QuY29tbWFuZCk7XG5cdFx0XHRcdGFzc2VydC5vayhmaXJzdC5jb21tYW5kLmFyZ3VtZW50cyFbMV0gaW5zdGFuY2VvZiB0eXBlcy5TZWxlY3Rpb24pO1xuXHRcdFx0XHRhc3NlcnQub2soZmlyc3QuY29tbWFuZC5hcmd1bWVudHMhWzFdLmlzRXF1YWwoc2VsZWN0aW9uKSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdEFwaUNtZCgndnNjb2RlLmV4ZWN1dGVDb2RlQWN0aW9uUHJvdmlkZXIgcmVzdWx0cyBzZWVtIHRvIGJlIG1pc3NpbmcgdGhlaXIgYGlzUHJlZmVycmVkYCBwcm9wZXJ0eSAjNzgwOTgnLCBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyQ29kZUFjdGlvblByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlQ29kZUFjdGlvbnMoZG9jdW1lbnQsIHJhbmdlT3JTZWxlY3Rpb24pOiB2c2NvZGUuQ29kZUFjdGlvbltdIHtcblx0XHRcdFx0cmV0dXJuIFt7XG5cdFx0XHRcdFx0Y29tbWFuZDoge1xuXHRcdFx0XHRcdFx0YXJndW1lbnRzOiBbZG9jdW1lbnQsIHJhbmdlT3JTZWxlY3Rpb25dLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ2NvbW1hbmQnLFxuXHRcdFx0XHRcdFx0dGl0bGU6ICdjb21tYW5kX3RpdGxlJyxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGtpbmQ6IHR5cGVzLkNvZGVBY3Rpb25LaW5kLkVtcHR5LmFwcGVuZCgnZm9vJyksXG5cdFx0XHRcdFx0dGl0bGU6ICd0aXRsZScsXG5cdFx0XHRcdFx0aXNQcmVmZXJyZWQ6IHRydWVcblx0XHRcdFx0fV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gbmV3IHR5cGVzLlNlbGVjdGlvbigwLCAwLCAxLCAxKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvZGVBY3Rpb25bXT4oJ3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBzZWxlY3Rpb24pLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuaXNQcmVmZXJyZWQsIHRydWUpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3RBcGlDbWQoJ3Jlc29sdmluZyBjb2RlIGFjdGlvbicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBkaWRDYWxsUmVzb2x2ZSA9IDA7XG5cdFx0Y2xhc3MgTXlBY3Rpb24gZXh0ZW5kcyB0eXBlcy5Db2RlQWN0aW9uIHsgfVxuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyQ29kZUFjdGlvblByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCB7XG5cdFx0XHRwcm92aWRlQ29kZUFjdGlvbnMoZG9jdW1lbnQsIHJhbmdlT3JTZWxlY3Rpb24pOiB2c2NvZGUuQ29kZUFjdGlvbltdIHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgTXlBY3Rpb24oJ3RpdGxlJywgdHlwZXMuQ29kZUFjdGlvbktpbmQuRW1wdHkuYXBwZW5kKCdmb28nKSldO1xuXHRcdFx0fSxcblx0XHRcdHJlc29sdmVDb2RlQWN0aW9uKGFjdGlvbik6IHZzY29kZS5Db2RlQWN0aW9uIHtcblx0XHRcdFx0YXNzZXJ0Lm9rKGFjdGlvbiBpbnN0YW5jZW9mIE15QWN0aW9uKTtcblxuXHRcdFx0XHRkaWRDYWxsUmVzb2x2ZSArPSAxO1xuXHRcdFx0XHRhY3Rpb24udGl0bGUgPSAncmVzb2x2ZWQgdGl0bGUnO1xuXHRcdFx0XHRhY3Rpb24uZWRpdCA9IG5ldyB0eXBlcy5Xb3Jrc3BhY2VFZGl0KCk7XG5cdFx0XHRcdHJldHVybiBhY3Rpb247XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgc2VsZWN0aW9uID0gbmV3IHR5cGVzLlNlbGVjdGlvbigwLCAwLCAxLCAxKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvZGVBY3Rpb25bXT4oJ3ZzY29kZS5leGVjdXRlQ29kZUFjdGlvblByb3ZpZGVyJywgbW9kZWwudXJpLCBzZWxlY3Rpb24sIHVuZGVmaW5lZCwgMTAwMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpZENhbGxSZXNvbHZlLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblxuXHRcdGNvbnN0IFtmaXJzdF0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGl0bGUsICd0aXRsZScpOyAvLyBkb2VzIE5PVCBjaGFuZ2Vcblx0XHRhc3NlcnQub2soZmlyc3QuZWRpdCk7IC8vIGlzIHNldFxuXHR9KTtcblxuXHQvLyAtLS0gY29kZSBsZW5zXG5cblx0dGVzdEFwaUNtZCgnQ29kZUxlbnMsIGJhY2sgYW5kIGZvcnRoJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgY29tcGxleEFyZyA9IHtcblx0XHRcdGZvbygpIHsgfSxcblx0XHRcdGJhcigpIHsgfSxcblx0XHRcdGJpZzogZXh0SG9zdFxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJDb2RlTGVuc1Byb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkNvZGVMZW5zUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUNvZGVMZW5zZXMoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuQ29kZUxlbnMobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDEsIDEpLCB7IHRpdGxlOiAnVGl0bGUnLCBjb21tYW5kOiAnY21kJywgYXJndW1lbnRzOiBbMSwgdHJ1ZSwgY29tcGxleEFyZ10gfSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBycGNQcm90b2NvbC5zeW5jKCkudGhlbigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNvZGVMZW5zW10+KCd2c2NvZGUuZXhlY3V0ZUNvZGVMZW5zUHJvdmlkZXInLCBtb2RlbC51cmkpLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kIS50aXRsZSwgJ1RpdGxlJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kIS5jb21tYW5kLCAnY21kJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5jb21tYW5kIS5hcmd1bWVudHMhWzBdLCAxKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmNvbW1hbmQhLmFyZ3VtZW50cyFbMV0sIHRydWUpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuY29tbWFuZCEuYXJndW1lbnRzIVsyXSwgY29tcGxleEFyZyk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdEFwaUNtZCgnQ29kZUxlbnMsIHJlc29sdmUnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgcmVzb2x2ZUNvdW50ID0gMDtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNvZGVMZW5zUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuQ29kZUxlbnNQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlQ29kZUxlbnNlcygpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5Db2RlTGVucyhuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Db2RlTGVucyhuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Db2RlTGVucyhuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSkpLFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5Db2RlTGVucyhuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMSwgMSksIHsgdGl0bGU6ICdBbHJlYWR5IHJlc29sdmVkJywgY29tbWFuZDogJ2ZmZicgfSlcblx0XHRcdFx0XTtcblx0XHRcdH0sXG5cdFx0XHRyZXNvbHZlQ29kZUxlbnMoY29kZUxlbnM6IHR5cGVzLkNvZGVMZW5zKSB7XG5cdFx0XHRcdGNvZGVMZW5zLmNvbW1hbmQgPSB7IHRpdGxlOiByZXNvbHZlQ291bnQudG9TdHJpbmcoKSwgY29tbWFuZDogJ3Jlc29sdmVkJyB9O1xuXHRcdFx0XHRyZXNvbHZlQ291bnQgKz0gMTtcblx0XHRcdFx0cmV0dXJuIGNvZGVMZW5zO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGxldCB2YWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Db2RlTGVuc1tdPigndnNjb2RlLmV4ZWN1dGVDb2RlTGVuc1Byb3ZpZGVyJywgbW9kZWwudXJpLCAyKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDMpOyAvLyB0aGUgcmVzb2x2ZSBhcmd1bWVudCBkZWZpbmVzIHRoZSBudW1iZXIgb2YgcmVzdWx0cyBiZWluZyByZXR1cm5lZFxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlQ291bnQsIDIpO1xuXG5cdFx0cmVzb2x2ZUNvdW50ID0gMDtcblx0XHR2YWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Db2RlTGVuc1tdPigndnNjb2RlLmV4ZWN1dGVDb2RlTGVuc1Byb3ZpZGVyJywgbW9kZWwudXJpKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXNvbHZlQ291bnQsIDApO1xuXHR9KTtcblxuXHR0ZXN0QXBpQ21kKCdMaW5rcywgYmFjayBhbmQgZm9ydGgnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Eb2N1bWVudExpbmtQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRMaW5rcygpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5Eb2N1bWVudExpbmsobmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDIwKSwgVVJJLnBhcnNlKCdmb286YmFyJykpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Eb2N1bWVudExpbmtbXT4oJ3ZzY29kZS5leGVjdXRlTGlua1Byb3ZpZGVyJywgbW9kZWwudXJpKS50aGVuKHZhbHVlID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGNvbnN0IFtmaXJzdF0gPSB2YWx1ZTtcblxuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGFyZ2V0ICsgJycsICdmb286YmFyJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5lbmQuY2hhcmFjdGVyLCAyMCk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdEFwaUNtZCgnV2hhdFxcJ3MgdGhlIGNvbmRpdGlvbiBmb3IgRG9jdW1lbnRMaW5rIHRhcmdldCB0byBiZSB1bmRlZmluZWQ/ICMxMDYzMDgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyRG9jdW1lbnRMaW5rUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuRG9jdW1lbnRMaW5rUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZURvY3VtZW50TGlua3MoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuRG9jdW1lbnRMaW5rKG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAyMCksIHVuZGVmaW5lZCldO1xuXHRcdFx0fSxcblx0XHRcdHJlc29sdmVEb2N1bWVudExpbmsobGluaykge1xuXHRcdFx0XHRsaW5rLnRhcmdldCA9IFVSSS5wYXJzZSgnZm9vOmJhcicpO1xuXHRcdFx0XHRyZXR1cm4gbGluaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCBsaW5rczEgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuRG9jdW1lbnRMaW5rW10+KCd2c2NvZGUuZXhlY3V0ZUxpbmtQcm92aWRlcicsIG1vZGVsLnVyaSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmtzMS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5rczFbMF0udGFyZ2V0LCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgbGlua3MyID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkRvY3VtZW50TGlua1tdPigndnNjb2RlLmV4ZWN1dGVMaW5rUHJvdmlkZXInLCBtb2RlbC51cmksIDEwMDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsaW5rczIubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlua3MyWzBdLnRhcmdldCEudG9TdHJpbmcoKSwgVVJJLnBhcnNlKCdmb286YmFyJykudG9TdHJpbmcoKSk7XG5cblx0fSk7XG5cblx0dGVzdEFwaUNtZCgnRG9jdW1lbnRMaW5rW10gdnNjb2RlLmV4ZWN1dGVMaW5rUHJvdmlkZXIgcmV0dXJucyBsYWNrIHRvb2x0aXAgIzIxMzk3MCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJEb2N1bWVudExpbmtQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5Eb2N1bWVudExpbmtQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRMaW5rcygpOiBhbnkge1xuXHRcdFx0XHRjb25zdCBsaW5rID0gbmV3IHR5cGVzLkRvY3VtZW50TGluayhuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMjApLCBVUkkucGFyc2UoJ2ZvbzpiYXInKSk7XG5cdFx0XHRcdGxpbmsudG9vbHRpcCA9ICdMaW5rIFRvb2x0aXAnO1xuXHRcdFx0XHRyZXR1cm4gW2xpbmtdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IGxpbmtzMSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Eb2N1bWVudExpbmtbXT4oJ3ZzY29kZS5leGVjdXRlTGlua1Byb3ZpZGVyJywgbW9kZWwudXJpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGlua3MxLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxpbmtzMVswXS50b29sdGlwLCAnTGluayBUb29sdGlwJyk7XG5cdH0pO1xuXG5cblx0dGVzdCgnQ29sb3IgcHJvdmlkZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJDb2xvclByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkRvY3VtZW50Q29sb3JQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRDb2xvcnMoKTogdnNjb2RlLkNvbG9ySW5mb3JtYXRpb25bXSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkNvbG9ySW5mb3JtYXRpb24obmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDIwKSwgbmV3IHR5cGVzLkNvbG9yKDAuMSwgMC4yLCAwLjMsIDAuNCkpXTtcblx0XHRcdH0sXG5cdFx0XHRwcm92aWRlQ29sb3JQcmVzZW50YXRpb25zKCk6IHZzY29kZS5Db2xvclByZXNlbnRhdGlvbltdIHtcblx0XHRcdFx0Y29uc3QgY3AgPSBuZXcgdHlwZXMuQ29sb3JQcmVzZW50YXRpb24oJyNBQkMnKTtcblx0XHRcdFx0Y3AudGV4dEVkaXQgPSB0eXBlcy5UZXh0RWRpdC5yZXBsYWNlKG5ldyB0eXBlcy5SYW5nZSgxLCAwLCAxLCAyMCksICcjQUJDJyk7XG5cdFx0XHRcdGNwLmFkZGl0aW9uYWxUZXh0RWRpdHMgPSBbdHlwZXMuVGV4dEVkaXQuaW5zZXJ0KG5ldyB0eXBlcy5Qb3NpdGlvbigyLCAyMCksICcqJyldO1xuXHRcdFx0XHRyZXR1cm4gW2NwXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gcnBjUHJvdG9jb2wuc3luYygpLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Db2xvckluZm9ybWF0aW9uW10+KCd2c2NvZGUuZXhlY3V0ZURvY3VtZW50Q29sb3JQcm92aWRlcicsIG1vZGVsLnVyaSkudGhlbih2YWx1ZSA9PiB7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdFx0XHRjb25zdCBbZmlyc3RdID0gdmFsdWU7XG5cblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmNvbG9yLnJlZCwgMC4xKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmNvbG9yLmdyZWVuLCAwLjIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuY29sb3IuYmx1ZSwgMC4zKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmNvbG9yLmFscGhhLCAwLjQpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2Uuc3RhcnQubGluZSwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5yYW5nZS5zdGFydC5jaGFyYWN0ZXIsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucmFuZ2UuZW5kLmNoYXJhY3RlciwgMjApO1xuXHRcdFx0fSk7XG5cdFx0fSkudGhlbigoKSA9PiB7XG5cdFx0XHRjb25zdCBjb2xvciA9IG5ldyB0eXBlcy5Db2xvcigwLjUsIDAuNiwgMC43LCAwLjgpO1xuXHRcdFx0Y29uc3QgcmFuZ2UgPSBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMjApO1xuXHRcdFx0cmV0dXJuIGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5Db2xvclByZXNlbnRhdGlvbltdPigndnNjb2RlLmV4ZWN1dGVDb2xvclByZXNlbnRhdGlvblByb3ZpZGVyJywgY29sb3IsIHsgdXJpOiBtb2RlbC51cmksIHJhbmdlIH0pLnRoZW4odmFsdWUgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5sYWJlbCwgJyNBQkMnKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHRFZGl0IS5uZXdUZXh0LCAnI0FCQycpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGV4dEVkaXQhLnJhbmdlLnN0YXJ0LmxpbmUsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGV4dEVkaXQhLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0RWRpdCEucmFuZ2UuZW5kLmxpbmUsIDEpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QudGV4dEVkaXQhLnJhbmdlLmVuZC5jaGFyYWN0ZXIsIDIwKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmFkZGl0aW9uYWxUZXh0RWRpdHMhLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5hZGRpdGlvbmFsVGV4dEVkaXRzIVswXS5yYW5nZS5zdGFydC5saW5lLCAyKTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmFkZGl0aW9uYWxUZXh0RWRpdHMhWzBdLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMjApO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWRkaXRpb25hbFRleHRFZGl0cyFbMF0ucmFuZ2UuZW5kLmxpbmUsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QuYWRkaXRpb25hbFRleHRFZGl0cyFbMF0ucmFuZ2UuZW5kLmNoYXJhY3RlciwgMjApO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHRlc3QoJ1wiVHlwZUVycm9yOiBlLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkIGlzIG5vdCBhIGZ1bmN0aW9uXCIgY2FsbGluZyBob3ZlciBwcm92aWRlciBpbiBJbnNpZGVycyAjNTQxNzQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJIb3ZlclByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLkhvdmVyUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUhvdmVyKCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBuZXcgdHlwZXMuSG92ZXIoJ2ZvZm9mb2ZvJyk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0cmV0dXJuIHJwY1Byb3RvY29sLnN5bmMoKS50aGVuKCgpID0+IHtcblx0XHRcdHJldHVybiBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuSG92ZXJbXT4oJ3ZzY29kZS5leGVjdXRlSG92ZXJQcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDEsIDEpKS50aGVuKHZhbHVlID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZVswXS5jb250ZW50cy5sZW5ndGgsIDEpO1xuXHRcdFx0fSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdC8vIC0tLSBpbmxpbmUgaGludHNcblxuXHR0ZXN0QXBpQ21kKCdJbmxheSBIaW50cywgYmFjayBhbmQgZm9ydGgnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVySW5sYXlIaW50c1Byb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLklubGF5SGludHNQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlSW5sYXlIaW50cygpIHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuSW5sYXlIaW50KG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAxKSwgJ0ZvbycpXTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5JbmxheUhpbnRbXT4oJ3ZzY29kZS5leGVjdXRlSW5sYXlIaW50UHJvdmlkZXInLCBtb2RlbC51cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAyMCwgMjApKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblxuXHRcdGNvbnN0IFtmaXJzdF0gPSB2YWx1ZTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QubGFiZWwsICdGb28nKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucG9zaXRpb24ubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnBvc2l0aW9uLmNoYXJhY3RlciwgMSk7XG5cdH0pO1xuXG5cdHRlc3RBcGlDbWQoJ0lubGluZSBIaW50cywgbWVyZ2UnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVySW5sYXlIaW50c1Byb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLklubGF5SGludHNQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlSW5sYXlIaW50cygpIHtcblx0XHRcdFx0Y29uc3QgcGFydCA9IG5ldyB0eXBlcy5JbmxheUhpbnRMYWJlbFBhcnQoJ0JhcicpO1xuXHRcdFx0XHRwYXJ0LnRvb2x0aXAgPSAncGFydF90b29sdGlwJztcblx0XHRcdFx0cGFydC5jb21tYW5kID0geyBjb21tYW5kOiAnY21kJywgdGl0bGU6ICdwYXJ0JyB9O1xuXHRcdFx0XHRjb25zdCBoaW50ID0gbmV3IHR5cGVzLklubGF5SGludChuZXcgdHlwZXMuUG9zaXRpb24oMTAsIDExKSwgW3BhcnRdKTtcblx0XHRcdFx0aGludC50b29sdGlwID0gJ2hpbnRfdG9vbHRpcCc7XG5cdFx0XHRcdGhpbnQucGFkZGluZ0xlZnQgPSB0cnVlO1xuXHRcdFx0XHRoaW50LnBhZGRpbmdSaWdodCA9IGZhbHNlO1xuXHRcdFx0XHRyZXR1cm4gW2hpbnRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlcklubGF5SGludHNQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5JbmxheUhpbnRzUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUlubGF5SGludHMoKSB7XG5cdFx0XHRcdGNvbnN0IGhpbnQgPSBuZXcgdHlwZXMuSW5sYXlIaW50KG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAxKSwgJ0ZvbycsIHR5cGVzLklubGF5SGludEtpbmQuUGFyYW1ldGVyKTtcblx0XHRcdFx0aGludC50ZXh0RWRpdHMgPSBbdHlwZXMuVGV4dEVkaXQuaW5zZXJ0KG5ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSwgJ0hlbGxvJyldO1xuXHRcdFx0XHRyZXR1cm4gW2hpbnRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLklubGF5SGludFtdPigndnNjb2RlLmV4ZWN1dGVJbmxheUhpbnRQcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDIwLCAyMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDIpO1xuXG5cdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gdmFsdWU7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LmxhYmVsLCAnRm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnBvc2l0aW9uLmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5wb3NpdGlvbi5jaGFyYWN0ZXIsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC50ZXh0RWRpdHM/Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0LnRleHRFZGl0c1swXS5uZXdUZXh0LCAnSGVsbG8nKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQucG9zaXRpb24ubGluZSwgMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQucG9zaXRpb24uY2hhcmFjdGVyLCAxMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5wYWRkaW5nTGVmdCwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlY29uZC5wYWRkaW5nUmlnaHQsIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLnRvb2x0aXAsICdoaW50X3Rvb2x0aXAnKTtcblxuXHRcdGNvbnN0IGxhYmVsID0gKDx0eXBlcy5JbmxheUhpbnRMYWJlbFBhcnRbXT5zZWNvbmQubGFiZWwpWzBdO1xuXHRcdGFzc2VydFR5cGUobGFiZWwgaW5zdGFuY2VvZiB0eXBlcy5JbmxheUhpbnRMYWJlbFBhcnQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbC52YWx1ZSwgJ0JhcicpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYWJlbC50b29sdGlwLCAncGFydF90b29sdGlwJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhYmVsLmNvbW1hbmQ/LmNvbW1hbmQsICdjbWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFiZWwuY29tbWFuZD8udGl0bGUsICdwYXJ0Jyk7XG5cdH0pO1xuXG5cdHRlc3RBcGlDbWQoJ0lubGluZSBIaW50cywgYmFkIHByb3ZpZGVyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlcklubGF5SGludHNQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5JbmxheUhpbnRzUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUlubGF5SGludHMoKSB7XG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLklubGF5SGludChuZXcgdHlwZXMuUG9zaXRpb24oMCwgMSksICdGb28nKV07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlcklubGF5SGludHNQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5JbmxheUhpbnRzUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZUlubGF5SGludHMoKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IHZhbHVlID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLklubGF5SGludFtdPigndnNjb2RlLmV4ZWN1dGVJbmxheUhpbnRQcm92aWRlcicsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDIwLCAyMCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXG5cdFx0Y29uc3QgW2ZpcnN0XSA9IHZhbHVlO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5sYWJlbCwgJ0ZvbycpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmaXJzdC5wb3NpdGlvbi5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QucG9zaXRpb24uY2hhcmFjdGVyLCAxKTtcblx0fSk7XG5cblx0Ly8gLS0tIHNlbGVjdGlvbiByYW5nZXNcblxuXHR0ZXN0KCdTZWxlY3Rpb24gUmFuZ2UsIGJhY2sgYW5kIGZvcnRoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0ZGlzcG9zYWJsZXMucHVzaChleHRIb3N0LnJlZ2lzdGVyU2VsZWN0aW9uUmFuZ2VQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgPHZzY29kZS5TZWxlY3Rpb25SYW5nZVByb3ZpZGVyPntcblx0XHRcdHByb3ZpZGVTZWxlY3Rpb25SYW5nZXMoKSB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bmV3IHR5cGVzLlNlbGVjdGlvblJhbmdlKG5ldyB0eXBlcy5SYW5nZSgwLCAxMCwgMCwgMTgpLCBuZXcgdHlwZXMuU2VsZWN0aW9uUmFuZ2UobmV3IHR5cGVzLlJhbmdlKDAsIDIsIDAsIDIwKSkpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5TZWxlY3Rpb25SYW5nZVtdPigndnNjb2RlLmV4ZWN1dGVTZWxlY3Rpb25SYW5nZVByb3ZpZGVyJywgbW9kZWwudXJpLCBbbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDEwKV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5vayh2YWx1ZVswXS5wYXJlbnQpO1xuXHR9KTtcblxuXHQvLyAtLS0gY2FsbCBoaWVyYXJjaHlcblxuXHR0ZXN0KCdDYWxsSGllcmFyY2h5LCBiYWNrIGFuZCBmb3J0aCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNhbGxIaWVyYXJjaHlQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNhbGxIaWVyYXJjaHlQcm92aWRlciB7XG5cblx0XHRcdHByZXBhcmVDYWxsSGllcmFyY2h5KGRvY3VtZW50OiB2c2NvZGUuVGV4dERvY3VtZW50LCBwb3NpdGlvbjogdnNjb2RlLlBvc2l0aW9uLCk6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW0+IHtcblx0XHRcdFx0cmV0dXJuIG5ldyB0eXBlcy5DYWxsSGllcmFyY2h5SXRlbSh0eXBlcy5TeW1ib2xLaW5kLkNvbnN0YW50LCAnUk9PVCcsICdST09UJywgZG9jdW1lbnQudXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSk7XG5cdFx0XHR9XG5cblx0XHRcdHByb3ZpZGVDYWxsSGllcmFyY2h5SW5jb21pbmdDYWxscyhpdGVtOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW0sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLkNhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGxbXT4ge1xuXG5cdFx0XHRcdHJldHVybiBbbmV3IHR5cGVzLkNhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGwoXG5cdFx0XHRcdFx0bmV3IHR5cGVzLkNhbGxIaWVyYXJjaHlJdGVtKHR5cGVzLlN5bWJvbEtpbmQuQ29uc3RhbnQsICdJTkNPTUlORycsICdJTkNPTUlORycsIGl0ZW0udXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSksXG5cdFx0XHRcdFx0W25ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKV1cblx0XHRcdFx0KV07XG5cdFx0XHR9XG5cblx0XHRcdHByb3ZpZGVDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxscyhpdGVtOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW0sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGxbXT4ge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5DYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxsKFxuXHRcdFx0XHRcdG5ldyB0eXBlcy5DYWxsSGllcmFyY2h5SXRlbSh0eXBlcy5TeW1ib2xLaW5kLkNvbnN0YW50LCAnT1VUR09JTkcnLCAnT1VUR09JTkcnLCBpdGVtLnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCkpLFxuXHRcdFx0XHRcdFtuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCldXG5cdFx0XHRcdCldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IHJvb3QgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW1bXT4oJ3ZzY29kZS5wcmVwYXJlQ2FsbEhpZXJhcmNoeScsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKTtcblxuXHRcdGFzc2VydC5vayhBcnJheS5pc0FycmF5KHJvb3QpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290WzBdLm5hbWUsICdST09UJyk7XG5cblx0XHRjb25zdCBpbmNvbWluZyA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5DYWxsSGllcmFyY2h5SW5jb21pbmdDYWxsW10+KCd2c2NvZGUucHJvdmlkZUluY29taW5nQ2FsbHMnLCByb290WzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5jb21pbmcubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW5jb21pbmdbMF0uZnJvbS5uYW1lLCAnSU5DT01JTkcnKTtcblxuXHRcdGNvbnN0IG91dGdvaW5nID0gYXdhaXQgY29tbWFuZHMuZXhlY3V0ZUNvbW1hbmQ8dnNjb2RlLkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGxbXT4oJ3ZzY29kZS5wcm92aWRlT3V0Z29pbmdDYWxscycsIHJvb3RbMF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRnb2luZy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvdXRnb2luZ1swXS50by5uYW1lLCAnT1VUR09JTkcnKTtcblx0fSk7XG5cblx0dGVzdCgncHJlcGFyZUNhbGxIaWVyYXJjaHkgdGhyb3dzIFR5cGVFcnJvciBpZiBjbGFuZ2QgcmV0dXJucyBlbXB0eSByZXN1bHQgIzEzNzQxNScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlckNhbGxIaWVyYXJjaHlQcm92aWRlcihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGRlZmF1bHRTZWxlY3RvciwgbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLkNhbGxIaWVyYXJjaHlQcm92aWRlciB7XG5cdFx0XHRwcmVwYXJlQ2FsbEhpZXJhcmNoeShkb2N1bWVudDogdnNjb2RlLlRleHREb2N1bWVudCwgcG9zaXRpb246IHZzY29kZS5Qb3NpdGlvbiwpOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLkNhbGxIaWVyYXJjaHlJdGVtW10+IHtcblx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0fVxuXHRcdFx0cHJvdmlkZUNhbGxIaWVyYXJjaHlJbmNvbWluZ0NhbGxzKGl0ZW06IHZzY29kZS5DYWxsSGllcmFyY2h5SXRlbSwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuQ2FsbEhpZXJhcmNoeUluY29taW5nQ2FsbFtdPiB7XG5cdFx0XHRcdHJldHVybiBbXTtcblx0XHRcdH1cblx0XHRcdHByb3ZpZGVDYWxsSGllcmFyY2h5T3V0Z29pbmdDYWxscyhpdGVtOiB2c2NvZGUuQ2FsbEhpZXJhcmNoeUl0ZW0sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLkNhbGxIaWVyYXJjaHlPdXRnb2luZ0NhbGxbXT4ge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0YXdhaXQgcnBjUHJvdG9jb2wuc3luYygpO1xuXG5cdFx0Y29uc3Qgcm9vdCA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5DYWxsSGllcmFyY2h5SXRlbVtdPigndnNjb2RlLnByZXBhcmVDYWxsSGllcmFyY2h5JywgbW9kZWwudXJpLCBuZXcgdHlwZXMuUG9zaXRpb24oMCwgMCkpO1xuXG5cdFx0YXNzZXJ0Lm9rKEFycmF5LmlzQXJyYXkocm9vdCkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290Lmxlbmd0aCwgMCk7XG5cdH0pO1xuXG5cdC8vIC0tLSB0eXBlIGhpZXJhcmNoeVxuXG5cdHRlc3QoJ1R5cGVIaWVyYXJjaHksIGJhY2sgYW5kIGZvcnRoJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJUeXBlSGllcmFyY2h5UHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5UeXBlSGllcmFyY2h5UHJvdmlkZXIge1xuXHRcdFx0cHJlcGFyZVR5cGVIaWVyYXJjaHkoZG9jdW1lbnQ6IHZzY29kZS5UZXh0RG9jdW1lbnQsIHBvc2l0aW9uOiB2c2NvZGUuUG9zaXRpb24sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLlR5cGVIaWVyYXJjaHlJdGVtW10+IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVHlwZUhpZXJhcmNoeUl0ZW0odHlwZXMuU3ltYm9sS2luZC5Db25zdGFudCwgJ1JPT1QnLCAnUk9PVCcsIGRvY3VtZW50LnVyaSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCkpXTtcblx0XHRcdH1cblx0XHRcdHByb3ZpZGVUeXBlSGllcmFyY2h5U3VwZXJ0eXBlcyhpdGVtOiB2c2NvZGUuVHlwZUhpZXJhcmNoeUl0ZW0sIHRva2VuOiB2c2NvZGUuQ2FuY2VsbGF0aW9uVG9rZW4pOiB2c2NvZGUuUHJvdmlkZXJSZXN1bHQ8dnNjb2RlLlR5cGVIaWVyYXJjaHlJdGVtW10+IHtcblx0XHRcdFx0cmV0dXJuIFtuZXcgdHlwZXMuVHlwZUhpZXJhcmNoeUl0ZW0odHlwZXMuU3ltYm9sS2luZC5Db25zdGFudCwgJ1NVUEVSJywgJ1NVUEVSJywgaXRlbS51cmksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSwgbmV3IHR5cGVzLlJhbmdlKDAsIDAsIDAsIDApKV07XG5cdFx0XHR9XG5cdFx0XHRwcm92aWRlVHlwZUhpZXJhcmNoeVN1YnR5cGVzKGl0ZW06IHZzY29kZS5UeXBlSGllcmFyY2h5SXRlbSwgdG9rZW46IHZzY29kZS5DYW5jZWxsYXRpb25Ub2tlbik6IHZzY29kZS5Qcm92aWRlclJlc3VsdDx2c2NvZGUuVHlwZUhpZXJhcmNoeUl0ZW1bXT4ge1xuXHRcdFx0XHRyZXR1cm4gW25ldyB0eXBlcy5UeXBlSGllcmFyY2h5SXRlbSh0eXBlcy5TeW1ib2xLaW5kLkNvbnN0YW50LCAnU1VCJywgJ1NVQicsIGl0ZW0udXJpLCBuZXcgdHlwZXMuUmFuZ2UoMCwgMCwgMCwgMCksIG5ldyB0eXBlcy5SYW5nZSgwLCAwLCAwLCAwKSldO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblxuXHRcdGNvbnN0IHJvb3QgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuVHlwZUhpZXJhcmNoeUl0ZW1bXT4oJ3ZzY29kZS5wcmVwYXJlVHlwZUhpZXJhcmNoeScsIG1vZGVsLnVyaSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDApKTtcblxuXHRcdGFzc2VydC5vayhBcnJheS5pc0FycmF5KHJvb3QpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocm9vdC5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyb290WzBdLm5hbWUsICdST09UJyk7XG5cblx0XHRjb25zdCBpbmNvbWluZyA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5UeXBlSGllcmFyY2h5SXRlbVtdPigndnNjb2RlLnByb3ZpZGVTdXBlcnR5cGVzJywgcm9vdFswXSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluY29taW5nLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGluY29taW5nWzBdLm5hbWUsICdTVVBFUicpO1xuXG5cdFx0Y29uc3Qgb3V0Z29pbmcgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuVHlwZUhpZXJhcmNoeUl0ZW1bXT4oJ3ZzY29kZS5wcm92aWRlU3VidHlwZXMnLCByb290WzBdKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0Z29pbmcubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3V0Z29pbmdbMF0ubmFtZSwgJ1NVQicpO1xuXHR9KTtcblxuXHR0ZXN0KCdzZWxlY3Rpb25SYW5nZVByb3ZpZGVyIG9uIGlubmVyIGFycmF5IGFsd2F5cyByZXR1cm5zIG91dGVyIGFycmF5ICM5MTg1MicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGRpc3Bvc2FibGVzLnB1c2goZXh0SG9zdC5yZWdpc3RlclNlbGVjdGlvblJhbmdlUHJvdmlkZXIobnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLCBkZWZhdWx0U2VsZWN0b3IsIDx2c2NvZGUuU2VsZWN0aW9uUmFuZ2VQcm92aWRlcj57XG5cdFx0XHRwcm92aWRlU2VsZWN0aW9uUmFuZ2VzKF9kb2MsIHBvc2l0aW9ucykge1xuXHRcdFx0XHRjb25zdCBbZmlyc3RdID0gcG9zaXRpb25zO1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5TZWxlY3Rpb25SYW5nZShuZXcgdHlwZXMuUmFuZ2UoZmlyc3QubGluZSwgZmlyc3QuY2hhcmFjdGVyLCBmaXJzdC5saW5lLCBmaXJzdC5jaGFyYWN0ZXIpKSxcblx0XHRcdFx0XTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhd2FpdCBycGNQcm90b2NvbC5zeW5jKCk7XG5cdFx0Y29uc3QgdmFsdWUgPSBhd2FpdCBjb21tYW5kcy5leGVjdXRlQ29tbWFuZDx2c2NvZGUuU2VsZWN0aW9uUmFuZ2VbXT4oJ3ZzY29kZS5leGVjdXRlU2VsZWN0aW9uUmFuZ2VQcm92aWRlcicsIG1vZGVsLnVyaSwgW25ldyB0eXBlcy5Qb3NpdGlvbigwLCAxMCldKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWUubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVbMF0ucmFuZ2Uuc3RhcnQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlWzBdLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZVswXS5yYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlWzBdLnJhbmdlLmVuZC5jaGFyYWN0ZXIsIDEwKTtcblx0fSk7XG5cblx0dGVzdCgnbW9yZSBlbGVtZW50IHRlc3Qgb2Ygc2VsZWN0aW9uUmFuZ2VQcm92aWRlciBvbiBpbm5lciBhcnJheSBhbHdheXMgcmV0dXJucyBvdXRlciBhcnJheSAjOTE4NTInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRkaXNwb3NhYmxlcy5wdXNoKGV4dEhvc3QucmVnaXN0ZXJTZWxlY3Rpb25SYW5nZVByb3ZpZGVyKG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZGVmYXVsdFNlbGVjdG9yLCA8dnNjb2RlLlNlbGVjdGlvblJhbmdlUHJvdmlkZXI+e1xuXHRcdFx0cHJvdmlkZVNlbGVjdGlvblJhbmdlcyhfZG9jLCBwb3NpdGlvbnMpIHtcblx0XHRcdFx0Y29uc3QgW2ZpcnN0LCBzZWNvbmRdID0gcG9zaXRpb25zO1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyB0eXBlcy5TZWxlY3Rpb25SYW5nZShuZXcgdHlwZXMuUmFuZ2UoZmlyc3QubGluZSwgZmlyc3QuY2hhcmFjdGVyLCBmaXJzdC5saW5lLCBmaXJzdC5jaGFyYWN0ZXIpKSxcblx0XHRcdFx0XHRuZXcgdHlwZXMuU2VsZWN0aW9uUmFuZ2UobmV3IHR5cGVzLlJhbmdlKHNlY29uZC5saW5lLCBzZWNvbmQuY2hhcmFjdGVyLCBzZWNvbmQubGluZSwgc2Vjb25kLmNoYXJhY3RlcikpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdGF3YWl0IHJwY1Byb3RvY29sLnN5bmMoKTtcblx0XHRjb25zdCB2YWx1ZSA9IGF3YWl0IGNvbW1hbmRzLmV4ZWN1dGVDb21tYW5kPHZzY29kZS5TZWxlY3Rpb25SYW5nZVtdPihcblx0XHRcdCd2c2NvZGUuZXhlY3V0ZVNlbGVjdGlvblJhbmdlUHJvdmlkZXInLFxuXHRcdFx0bW9kZWwudXJpLFxuXHRcdFx0W25ldyB0eXBlcy5Qb3NpdGlvbigwLCAwKSwgbmV3IHR5cGVzLlBvc2l0aW9uKDAsIDEwKV1cblx0XHQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZS5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZVswXS5yYW5nZS5zdGFydC5saW5lLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVbMF0ucmFuZ2Uuc3RhcnQuY2hhcmFjdGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVbMF0ucmFuZ2UuZW5kLmxpbmUsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZVswXS5yYW5nZS5lbmQuY2hhcmFjdGVyLCAwKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodmFsdWVbMV0ucmFuZ2Uuc3RhcnQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlWzFdLnJhbmdlLnN0YXJ0LmNoYXJhY3RlciwgMTApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh2YWx1ZVsxXS5yYW5nZS5lbmQubGluZSwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHZhbHVlWzFdLnJhbmdlLmVuZC5jaGFyYWN0ZXIsIDEwKTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9B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QUMsRUFBRSxNQUFNLE1BQU0sTUFBTSxDQUFDO0FBQy9DLFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLE1BQU0sV0FBVyxDQUFDO0FBQ3BELFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLElBQUksTUFBTSxDQUFDO0FBQzdDLFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLElBQUksV0FBVyxDQUFDO0FBQ2xELFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLE1BQU0sTUFBTSxDQUFDO0FBQy9DLFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLE1BQU0sV0FBVyxFQUFFO0FBQ3JELFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLElBQUksTUFBTSxDQUFDO0FBQzdDLFdBQU8sWUFBWSxNQUFNLENBQUMsRUFBRSxNQUFNLElBQUksV0FBVyxFQUFFO0FBQUEsRUFDcEQsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbImVkaXQiLCAiYSIsICJiIiwgImMiLCAiZCJdCn0K
