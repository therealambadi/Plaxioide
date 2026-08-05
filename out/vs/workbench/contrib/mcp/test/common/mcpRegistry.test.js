import * as assert from "assert";
import * as sinon from "sinon";
import { timeout } from "../../../../../base/common/async.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { upcast } from "../../../../../base/common/types.js";
import { URI } from "../../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { ConfigurationTarget } from "../../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../../platform/dialogs/common/dialogs.js";
import { ServiceCollection } from "../../../../../platform/instantiation/common/serviceCollection.js";
import { TestInstantiationService } from "../../../../../platform/instantiation/test/common/instantiationServiceMock.js";
import { ILoggerService, NullLogger } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { ISecretStorageService } from "../../../../../platform/secrets/common/secrets.js";
import { TestSecretStorageService } from "../../../../../platform/secrets/test/common/testSecretStorageService.js";
import { IStorageService, StorageScope } from "../../../../../platform/storage/common/storage.js";
import { IConfigurationResolverService } from "../../../../services/configurationResolver/common/configurationResolver.js";
import { IOutputService } from "../../../../services/output/common/output.js";
import { TestLoggerService, TestStorageService } from "../../../../test/common/workbenchTestServices.js";
import { McpRegistry } from "../../common/mcpRegistry.js";
import { LazyCollectionState, McpServerTransportType } from "../../common/mcpTypes.js";
import { TestMcpMessageTransport } from "./mcpRegistryTypes.js";
import { ConfigurationResolverExpression } from "../../../../services/configurationResolver/common/configurationResolverExpression.js";
class TestConfigurationResolverService {
  constructor() {
    this.interactiveCounter = 0;
    // Used to simulate stored/resolved variables
    this.resolvedVariables = /* @__PURE__ */ new Map();
    this.resolvedVariables.set("workspaceFolder", "/test/workspace");
    this.resolvedVariables.set("fileBasename", "test.txt");
  }
  resolveAsync(folder, value) {
    const parsed = ConfigurationResolverExpression.parse(value);
    for (const variable of parsed.unresolved()) {
      const resolved = this.resolvedVariables.get(variable.inner);
      if (resolved) {
        parsed.resolve(variable, resolved);
      }
    }
    return Promise.resolve(parsed.toObject());
  }
  resolveWithInteraction(folder, config, section, variables, target) {
    const parsed = ConfigurationResolverExpression.parse(config);
    const result = /* @__PURE__ */ new Map();
    result.set("input:testInteractive", `interactiveValue${this.interactiveCounter++}`);
    result.set("command:testCommand", `commandOutput${this.interactiveCounter++}}`);
    for (const [k, v] of result.entries()) {
      parsed.resolve({ id: "${" + k + "}" }, v);
    }
    return Promise.resolve(result);
  }
}
class TestMcpHostDelegate {
  constructor() {
    this.priority = 0;
  }
  canStart() {
    return true;
  }
  start() {
    return new TestMcpMessageTransport();
  }
  waitForInitialProviderPromises() {
    return Promise.resolve();
  }
}
class TestDialogService {
  constructor() {
    this._promptSpy = sinon.stub();
    this._promptSpy.callsFake(() => {
      return Promise.resolve({ result: this._promptResult });
    });
  }
  setPromptResult(result) {
    this._promptResult = result;
  }
  get promptSpy() {
    return this._promptSpy;
  }
  prompt(options) {
    return this._promptSpy(options);
  }
}
suite("Workbench - MCP - Registry", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let registry;
  let testStorageService;
  let testConfigResolverService;
  let testDialogService;
  let testCollection;
  let baseDefinition;
  let logger;
  setup(() => {
    testConfigResolverService = new TestConfigurationResolverService();
    testStorageService = store.add(new TestStorageService());
    testDialogService = new TestDialogService();
    const services = new ServiceCollection(
      [IConfigurationResolverService, testConfigResolverService],
      [IStorageService, testStorageService],
      [ISecretStorageService, new TestSecretStorageService()],
      [ILoggerService, store.add(new TestLoggerService())],
      [IOutputService, upcast({ showChannel: () => {
      } })],
      [IDialogService, testDialogService],
      [IProductService, {}]
    );
    logger = new NullLogger();
    const instaService = store.add(new TestInstantiationService(services));
    registry = store.add(instaService.createInstance(McpRegistry));
    testCollection = {
      id: "test-collection",
      label: "Test Collection",
      remoteAuthority: null,
      serverDefinitions: observableValue("serverDefs", []),
      isTrustedByDefault: true,
      scope: StorageScope.APPLICATION
    };
    baseDefinition = {
      id: "test-server",
      label: "Test Server",
      launch: {
        type: McpServerTransportType.Stdio,
        command: "test-command",
        args: [],
        env: {},
        envFile: void 0,
        cwd: URI.parse("file:///test")
      }
    };
  });
  test("registerCollection adds collection to registry", () => {
    const disposable = registry.registerCollection(testCollection);
    store.add(disposable);
    assert.strictEqual(registry.collections.get().length, 1);
    assert.strictEqual(registry.collections.get()[0], testCollection);
    disposable.dispose();
    assert.strictEqual(registry.collections.get().length, 0);
  });
  test("registerDelegate adds delegate to registry", () => {
    const delegate = new TestMcpHostDelegate();
    const disposable = registry.registerDelegate(delegate);
    store.add(disposable);
    assert.strictEqual(registry.delegates.length, 1);
    assert.strictEqual(registry.delegates[0], delegate);
    disposable.dispose();
    assert.strictEqual(registry.delegates.length, 0);
  });
  test("resolveConnection creates connection with resolved variables and memorizes them until cleared", async () => {
    const definition = {
      ...baseDefinition,
      launch: {
        type: McpServerTransportType.Stdio,
        command: "${workspaceFolder}/cmd",
        args: ["--file", "${fileBasename}"],
        env: {
          PATH: "${input:testInteractive}"
        },
        envFile: void 0,
        cwd: URI.parse("file:///test")
      },
      variableReplacement: {
        section: "mcp",
        target: ConfigurationTarget.WORKSPACE
      }
    };
    const delegate = new TestMcpHostDelegate();
    store.add(registry.registerDelegate(delegate));
    testCollection.serverDefinitions.set([definition], void 0);
    store.add(registry.registerCollection(testCollection));
    const connection = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger });
    assert.ok(connection);
    assert.strictEqual(connection.definition, definition);
    assert.strictEqual(connection.launchDefinition.command, "/test/workspace/cmd");
    assert.strictEqual(connection.launchDefinition.env.PATH, "interactiveValue0");
    connection.dispose();
    const connection2 = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger });
    assert.ok(connection2);
    assert.strictEqual(connection2.launchDefinition.env.PATH, "interactiveValue0");
    connection2.dispose();
    registry.clearSavedInputs(StorageScope.WORKSPACE);
    const connection3 = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger });
    assert.ok(connection3);
    assert.strictEqual(connection3.launchDefinition.env.PATH, "interactiveValue4");
    connection3.dispose();
  });
  suite("Trust Management", () => {
    setup(() => {
      const delegate = new TestMcpHostDelegate();
      store.add(registry.registerDelegate(delegate));
    });
    test("resolveConnection connects to server when trusted by default", async () => {
      const definition = { ...baseDefinition };
      store.add(registry.registerCollection(testCollection));
      testCollection.serverDefinitions.set([definition], void 0);
      const connection = await registry.resolveConnection({ collectionRef: testCollection, definitionRef: definition, logger });
      assert.ok(connection);
      assert.strictEqual(testDialogService.promptSpy.called, false);
      connection?.dispose();
    });
    test("resolveConnection prompts for confirmation when not trusted by default", async () => {
      const untrustedCollection = {
        ...testCollection,
        isTrustedByDefault: false
      };
      const definition = { ...baseDefinition };
      store.add(registry.registerCollection(untrustedCollection));
      testCollection.serverDefinitions.set([definition], void 0);
      testDialogService.setPromptResult(true);
      const connection = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.ok(connection);
      assert.strictEqual(testDialogService.promptSpy.called, true);
      connection?.dispose();
      testDialogService.promptSpy.resetHistory();
      const connection2 = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.ok(connection2);
      assert.strictEqual(testDialogService.promptSpy.called, false);
      connection2?.dispose();
    });
    test("resolveConnection returns undefined when user does not trust the server", async () => {
      const untrustedCollection = {
        ...testCollection,
        isTrustedByDefault: false
      };
      const definition = { ...baseDefinition };
      store.add(registry.registerCollection(untrustedCollection));
      testCollection.serverDefinitions.set([definition], void 0);
      testDialogService.setPromptResult(false);
      const connection = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.strictEqual(connection, void 0);
      assert.strictEqual(testDialogService.promptSpy.called, true);
      testDialogService.promptSpy.resetHistory();
      const connection2 = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.strictEqual(connection2, void 0);
      assert.strictEqual(testDialogService.promptSpy.called, false);
    });
    test("resolveConnection honors forceTrust parameter", async () => {
      const untrustedCollection = {
        ...testCollection,
        isTrustedByDefault: false
      };
      const definition = { ...baseDefinition };
      store.add(registry.registerCollection(untrustedCollection));
      testCollection.serverDefinitions.set([definition], void 0);
      testDialogService.setPromptResult(false);
      const connection1 = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.strictEqual(connection1, void 0);
      testDialogService.promptSpy.resetHistory();
      testDialogService.setPromptResult(true);
      const connection2 = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition,
        forceTrust: true
      });
      assert.ok(connection2);
      assert.strictEqual(testDialogService.promptSpy.called, true);
      connection2?.dispose();
      testDialogService.promptSpy.resetHistory();
      const connection3 = await registry.resolveConnection({
        logger,
        collectionRef: untrustedCollection,
        definitionRef: definition
      });
      assert.ok(connection3);
      assert.strictEqual(testDialogService.promptSpy.called, false);
      connection3?.dispose();
    });
  });
  suite("Lazy Collections", () => {
    let lazyCollection;
    let normalCollection;
    let removedCalled;
    setup(() => {
      removedCalled = false;
      lazyCollection = {
        ...testCollection,
        id: "lazy-collection",
        lazy: {
          isCached: false,
          load: () => Promise.resolve(),
          removed: () => {
            removedCalled = true;
          }
        }
      };
      normalCollection = {
        ...testCollection,
        id: "lazy-collection",
        serverDefinitions: observableValue("serverDefs", [baseDefinition])
      };
    });
    test("registers lazy collection", () => {
      const disposable = registry.registerCollection(lazyCollection);
      store.add(disposable);
      assert.strictEqual(registry.collections.get().length, 1);
      assert.strictEqual(registry.collections.get()[0], lazyCollection);
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.HasUnknown);
    });
    test("lazy collection is replaced by normal collection", () => {
      store.add(registry.registerCollection(lazyCollection));
      store.add(registry.registerCollection(normalCollection));
      const collections = registry.collections.get();
      assert.strictEqual(collections.length, 1);
      assert.strictEqual(collections[0], normalCollection);
      assert.strictEqual(collections[0].lazy, void 0);
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.AllKnown);
    });
    test("lazyCollectionState updates correctly during loading", async () => {
      lazyCollection = {
        ...lazyCollection,
        lazy: {
          ...lazyCollection.lazy,
          load: async () => {
            await timeout(0);
            store.add(registry.registerCollection(normalCollection));
            return Promise.resolve();
          }
        }
      };
      store.add(registry.registerCollection(lazyCollection));
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.HasUnknown);
      const loadingPromise = registry.discoverCollections();
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.LoadingUnknown);
      await loadingPromise;
      assert.strictEqual(registry.collections.get().length, 1);
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.AllKnown);
      assert.strictEqual(removedCalled, false);
    });
    test("removed callback is called when lazy collection is not replaced", async () => {
      store.add(registry.registerCollection(lazyCollection));
      await registry.discoverCollections();
      assert.strictEqual(removedCalled, true);
    });
    test("cached lazy collections are tracked correctly", () => {
      lazyCollection.lazy.isCached = true;
      store.add(registry.registerCollection(lazyCollection));
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.AllKnown);
      const uncachedLazy = {
        ...lazyCollection,
        id: "uncached-lazy",
        lazy: {
          ...lazyCollection.lazy,
          isCached: false
        }
      };
      store.add(registry.registerCollection(uncachedLazy));
      assert.strictEqual(registry.lazyCollectionState.get(), LazyCollectionState.HasUnknown);
    });
  });
  suite("Collection Tool Prefixes", () => {
    test("assigns unique prefixes to collections", () => {
      const collection1 = {
        id: "collection1",
        label: "Collection 1",
        remoteAuthority: null,
        serverDefinitions: observableValue("serverDefs", []),
        isTrustedByDefault: true,
        scope: StorageScope.APPLICATION
      };
      const collection2 = {
        id: "collection2",
        label: "Collection 2",
        remoteAuthority: null,
        serverDefinitions: observableValue("serverDefs", []),
        isTrustedByDefault: true,
        scope: StorageScope.APPLICATION
      };
      store.add(registry.registerCollection(collection1));
      store.add(registry.registerCollection(collection2));
      const prefix1 = registry.collectionToolPrefix(collection1).get();
      const prefix2 = registry.collectionToolPrefix(collection2).get();
      assert.notStrictEqual(prefix1, prefix2);
      assert.ok(/^[a-f0-9]{3}\.$/.test(prefix1));
      assert.ok(/^[a-f0-9]{3}\.$/.test(prefix2));
    });
    test("handles hash collisions by incrementing view", () => {
      const collection1 = {
        id: "potato",
        label: "Collection 1",
        remoteAuthority: null,
        serverDefinitions: observableValue("serverDefs", []),
        isTrustedByDefault: true,
        scope: StorageScope.APPLICATION
      };
      const collection2 = {
        id: "candidate_83048",
        label: "Collection 2",
        remoteAuthority: null,
        serverDefinitions: observableValue("serverDefs", []),
        isTrustedByDefault: true,
        scope: StorageScope.APPLICATION
      };
      store.add(registry.registerCollection(collection1));
      store.add(registry.registerCollection(collection2));
      const prefix1 = registry.collectionToolPrefix(collection1).get();
      const prefix2 = registry.collectionToolPrefix(collection2).get();
      assert.notStrictEqual(prefix1, prefix2);
      assert.ok(/^[a-f0-9]{3}\.$/.test(prefix1));
      assert.ok(/^[a-f0-9]{3}\.$/.test(prefix2));
    });
    test("prefix changes when collections change", () => {
      const collection1 = {
        id: "collection1",
        label: "Collection 1",
        remoteAuthority: null,
        serverDefinitions: observableValue("serverDefs", []),
        isTrustedByDefault: true,
        scope: StorageScope.APPLICATION
      };
      const disposable = registry.registerCollection(collection1);
      store.add(disposable);
      const prefix1 = registry.collectionToolPrefix(collection1).get();
      assert.ok(!!prefix1);
      disposable.dispose();
      const prefix2 = registry.collectionToolPrefix(collection1).get();
      assert.strictEqual(prefix2, "");
    });
    test("prefix is empty for unknown collections", () => {
      const unknownCollection = {
        id: "unknown",
        label: "Unknown"
      };
      const prefix = registry.collectionToolPrefix(unknownCollection).get();
      assert.strictEqual(prefix, "");
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvdGVzdC9jb21tb24vbWNwUmVnaXN0cnkudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0ICogYXMgc2lub24gZnJvbSAnc2lub24nO1xuaW1wb3J0IHsgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IElTZXR0YWJsZU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgdXBjYXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IFNlcnZpY2VDb2xsZWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vc2VydmljZUNvbGxlY3Rpb24uanMnO1xuaW1wb3J0IHsgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi90ZXN0L2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZU1vY2suanMnO1xuaW1wb3J0IHsgSUxvZ2dlciwgSUxvZ2dlclNlcnZpY2UsIE51bGxMb2dnZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU2VjcmV0U3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zZWNyZXRzL2NvbW1vbi9zZWNyZXRzLmpzJztcbmltcG9ydCB7IFRlc3RTZWNyZXRTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3NlY3JldHMvdGVzdC9jb21tb24vdGVzdFNlY3JldFN0b3JhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IElPdXRwdXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvb3V0cHV0L2NvbW1vbi9vdXRwdXQuanMnO1xuaW1wb3J0IHsgVGVzdExvZ2dlclNlcnZpY2UsIFRlc3RTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3Rlc3QvY29tbW9uL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5pbXBvcnQgeyBNY3BSZWdpc3RyeSB9IGZyb20gJy4uLy4uL2NvbW1vbi9tY3BSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJTWNwSG9zdERlbGVnYXRlLCBJTWNwTWVzc2FnZVRyYW5zcG9ydCB9IGZyb20gJy4uLy4uL2NvbW1vbi9tY3BSZWdpc3RyeVR5cGVzLmpzJztcbmltcG9ydCB7IE1jcFNlcnZlckNvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi9jb21tb24vbWNwU2VydmVyQ29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBMYXp5Q29sbGVjdGlvblN0YXRlLCBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbiwgTWNwQ29sbGVjdGlvblJlZmVyZW5jZSwgTWNwU2VydmVyRGVmaW5pdGlvbiwgTWNwU2VydmVyVHJhbnNwb3J0VHlwZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBUZXN0TWNwTWVzc2FnZVRyYW5zcG9ydCB9IGZyb20gJy4vbWNwUmVnaXN0cnlUeXBlcy5qcyc7XG5pbXBvcnQgeyBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLmpzJztcblxuY2xhc3MgVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgaW1wbGVtZW50cyBQYXJ0aWFsPElDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlPiB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgaW50ZXJhY3RpdmVDb3VudGVyID0gMDtcblxuXHQvLyBVc2VkIHRvIHNpbXVsYXRlIHN0b3JlZC9yZXNvbHZlZCB2YXJpYWJsZXNcblx0cHJpdmF0ZSByZWFkb25seSByZXNvbHZlZFZhcmlhYmxlcyA9IG5ldyBNYXA8c3RyaW5nLCBzdHJpbmc+KCk7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0Ly8gQWRkIHNvbWUgdGVzdCB2YXJpYWJsZXNcblx0XHR0aGlzLnJlc29sdmVkVmFyaWFibGVzLnNldCgnd29ya3NwYWNlRm9sZGVyJywgJy90ZXN0L3dvcmtzcGFjZScpO1xuXHRcdHRoaXMucmVzb2x2ZWRWYXJpYWJsZXMuc2V0KCdmaWxlQmFzZW5hbWUnLCAndGVzdC50eHQnKTtcblx0fVxuXG5cdHJlc29sdmVBc3luYyhmb2xkZXI6IGFueSwgdmFsdWU6IGFueSk6IFByb21pc2U8YW55PiB7XG5cdFx0Y29uc3QgcGFyc2VkID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZSh2YWx1ZSk7XG5cdFx0Zm9yIChjb25zdCB2YXJpYWJsZSBvZiBwYXJzZWQudW5yZXNvbHZlZCgpKSB7XG5cdFx0XHRjb25zdCByZXNvbHZlZCA9IHRoaXMucmVzb2x2ZWRWYXJpYWJsZXMuZ2V0KHZhcmlhYmxlLmlubmVyKTtcblx0XHRcdGlmIChyZXNvbHZlZCkge1xuXHRcdFx0XHRwYXJzZWQucmVzb2x2ZSh2YXJpYWJsZSwgcmVzb2x2ZWQpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUocGFyc2VkLnRvT2JqZWN0KCkpO1xuXHR9XG5cblx0cmVzb2x2ZVdpdGhJbnRlcmFjdGlvbihmb2xkZXI6IGFueSwgY29uZmlnOiBhbnksIHNlY3Rpb24/OiBzdHJpbmcsIHZhcmlhYmxlcz86IFJlY29yZDxzdHJpbmcsIHN0cmluZz4sIHRhcmdldD86IENvbmZpZ3VyYXRpb25UYXJnZXQpOiBQcm9taXNlPE1hcDxzdHJpbmcsIHN0cmluZz4gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBwYXJzZWQgPSBDb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLnBhcnNlKGNvbmZpZyk7XG5cdFx0Ly8gRm9yIHRlc3RpbmcsIHdlIHNpbXVsYXRlIGludGVyYWN0aW9uIGJ5IHJldHVybmluZyBhIG1hcCB3aXRoIHNvbWUgdmFyaWFibGVzXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIHN0cmluZz4oKTtcblx0XHRyZXN1bHQuc2V0KCdpbnB1dDp0ZXN0SW50ZXJhY3RpdmUnLCBgaW50ZXJhY3RpdmVWYWx1ZSR7dGhpcy5pbnRlcmFjdGl2ZUNvdW50ZXIrK31gKTtcblx0XHRyZXN1bHQuc2V0KCdjb21tYW5kOnRlc3RDb21tYW5kJywgYGNvbW1hbmRPdXRwdXQke3RoaXMuaW50ZXJhY3RpdmVDb3VudGVyKyt9fWApO1xuXG5cdFx0Ly8gSWYgdmFyaWFibGVzIGFyZSBwcm92aWRlZCwgaW5jbHVkZSB0aG9zZSB0b29cblx0XHRmb3IgKGNvbnN0IFtrLCB2XSBvZiByZXN1bHQuZW50cmllcygpKSB7XG5cdFx0XHRwYXJzZWQucmVzb2x2ZSh7IGlkOiAnJHsnICsgayArICd9JyB9IGFzIGFueSwgdik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShyZXN1bHQpO1xuXHR9XG59XG5cbmNsYXNzIFRlc3RNY3BIb3N0RGVsZWdhdGUgaW1wbGVtZW50cyBJTWNwSG9zdERlbGVnYXRlIHtcblx0cHJpb3JpdHkgPSAwO1xuXG5cdGNhblN0YXJ0KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0c3RhcnQoKTogSU1jcE1lc3NhZ2VUcmFuc3BvcnQge1xuXHRcdHJldHVybiBuZXcgVGVzdE1jcE1lc3NhZ2VUcmFuc3BvcnQoKTtcblx0fVxuXG5cdHdhaXRGb3JJbml0aWFsUHJvdmlkZXJQcm9taXNlcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKCk7XG5cdH1cbn1cblxuY2xhc3MgVGVzdERpYWxvZ1NlcnZpY2UgaW1wbGVtZW50cyBQYXJ0aWFsPElEaWFsb2dTZXJ2aWNlPiB7XG5cdGRlY2xhcmUgcmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgX3Byb21wdFJlc3VsdDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcHJvbXB0U3B5OiBzaW5vbi5TaW5vblN0dWI7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0dGhpcy5fcHJvbXB0U3B5ID0gc2lub24uc3R1YigpO1xuXHRcdHRoaXMuX3Byb21wdFNweS5jYWxsc0Zha2UoKCkgPT4ge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh7IHJlc3VsdDogdGhpcy5fcHJvbXB0UmVzdWx0IH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0c2V0UHJvbXB0UmVzdWx0KHJlc3VsdDogYm9vbGVhbiB8IHVuZGVmaW5lZCk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb21wdFJlc3VsdCA9IHJlc3VsdDtcblx0fVxuXG5cdGdldCBwcm9tcHRTcHkoKTogc2lub24uU2lub25TdHViIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvbXB0U3B5O1xuXHR9XG5cblx0cHJvbXB0KG9wdGlvbnM6IGFueSk6IFByb21pc2U8YW55PiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Byb21wdFNweShvcHRpb25zKTtcblx0fVxufVxuXG5zdWl0ZSgnV29ya2JlbmNoIC0gTUNQIC0gUmVnaXN0cnknLCAoKSA9PiB7XG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblx0bGV0IHJlZ2lzdHJ5OiBNY3BSZWdpc3RyeTtcblx0bGV0IHRlc3RTdG9yYWdlU2VydmljZTogVGVzdFN0b3JhZ2VTZXJ2aWNlO1xuXHRsZXQgdGVzdENvbmZpZ1Jlc29sdmVyU2VydmljZTogVGVzdENvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2U7XG5cdGxldCB0ZXN0RGlhbG9nU2VydmljZTogVGVzdERpYWxvZ1NlcnZpY2U7XG5cdGxldCB0ZXN0Q29sbGVjdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gJiB7IHNlcnZlckRlZmluaXRpb25zOiBJU2V0dGFibGVPYnNlcnZhYmxlPE1jcFNlcnZlckRlZmluaXRpb25bXT4gfTtcblx0bGV0IGJhc2VEZWZpbml0aW9uOiBNY3BTZXJ2ZXJEZWZpbml0aW9uO1xuXHRsZXQgbG9nZ2VyOiBJTG9nZ2VyO1xuXG5cdHNldHVwKCgpID0+IHtcblx0XHR0ZXN0Q29uZmlnUmVzb2x2ZXJTZXJ2aWNlID0gbmV3IFRlc3RDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlKCk7XG5cdFx0dGVzdFN0b3JhZ2VTZXJ2aWNlID0gc3RvcmUuYWRkKG5ldyBUZXN0U3RvcmFnZVNlcnZpY2UoKSk7XG5cdFx0dGVzdERpYWxvZ1NlcnZpY2UgPSBuZXcgVGVzdERpYWxvZ1NlcnZpY2UoKTtcblxuXHRcdGNvbnN0IHNlcnZpY2VzID0gbmV3IFNlcnZpY2VDb2xsZWN0aW9uKFxuXHRcdFx0W0lDb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLCB0ZXN0Q29uZmlnUmVzb2x2ZXJTZXJ2aWNlXSxcblx0XHRcdFtJU3RvcmFnZVNlcnZpY2UsIHRlc3RTdG9yYWdlU2VydmljZV0sXG5cdFx0XHRbSVNlY3JldFN0b3JhZ2VTZXJ2aWNlLCBuZXcgVGVzdFNlY3JldFN0b3JhZ2VTZXJ2aWNlKCldLFxuXHRcdFx0W0lMb2dnZXJTZXJ2aWNlLCBzdG9yZS5hZGQobmV3IFRlc3RMb2dnZXJTZXJ2aWNlKCkpXSxcblx0XHRcdFtJT3V0cHV0U2VydmljZSwgdXBjYXN0KHsgc2hvd0NoYW5uZWw6ICgpID0+IHsgfSB9KV0sXG5cdFx0XHRbSURpYWxvZ1NlcnZpY2UsIHRlc3REaWFsb2dTZXJ2aWNlXSxcblx0XHRcdFtJUHJvZHVjdFNlcnZpY2UsIHt9XSxcblx0XHQpO1xuXG5cdFx0bG9nZ2VyID0gbmV3IE51bGxMb2dnZXIoKTtcblxuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IHN0b3JlLmFkZChuZXcgVGVzdEluc3RhbnRpYXRpb25TZXJ2aWNlKHNlcnZpY2VzKSk7XG5cdFx0cmVnaXN0cnkgPSBzdG9yZS5hZGQoaW5zdGFTZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKE1jcFJlZ2lzdHJ5KSk7XG5cblx0XHQvLyBDcmVhdGUgdGVzdCBjb2xsZWN0aW9uIHRoYXQgY2FuIGJlIHJldXNlZFxuXHRcdHRlc3RDb2xsZWN0aW9uID0ge1xuXHRcdFx0aWQ6ICd0ZXN0LWNvbGxlY3Rpb24nLFxuXHRcdFx0bGFiZWw6ICdUZXN0IENvbGxlY3Rpb24nLFxuXHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBudWxsLFxuXHRcdFx0c2VydmVyRGVmaW5pdGlvbnM6IG9ic2VydmFibGVWYWx1ZSgnc2VydmVyRGVmcycsIFtdKSxcblx0XHRcdGlzVHJ1c3RlZEJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT05cblx0XHR9O1xuXG5cdFx0Ly8gQ3JlYXRlIGJhc2UgZGVmaW5pdGlvbiB0aGF0IGNhbiBiZSByZXVzZWRcblx0XHRiYXNlRGVmaW5pdGlvbiA9IHtcblx0XHRcdGlkOiAndGVzdC1zZXJ2ZXInLFxuXHRcdFx0bGFiZWw6ICdUZXN0IFNlcnZlcicsXG5cdFx0XHRsYXVuY2g6IHtcblx0XHRcdFx0dHlwZTogTWNwU2VydmVyVHJhbnNwb3J0VHlwZS5TdGRpbyxcblx0XHRcdFx0Y29tbWFuZDogJ3Rlc3QtY29tbWFuZCcsXG5cdFx0XHRcdGFyZ3M6IFtdLFxuXHRcdFx0XHRlbnY6IHt9LFxuXHRcdFx0XHRlbnZGaWxlOiB1bmRlZmluZWQsXG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKVxuXHRcdFx0fVxuXHRcdH07XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZ2lzdGVyQ29sbGVjdGlvbiBhZGRzIGNvbGxlY3Rpb24gdG8gcmVnaXN0cnknLCAoKSA9PiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbih0ZXN0Q29sbGVjdGlvbik7XG5cdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpWzBdLCB0ZXN0Q29sbGVjdGlvbik7XG5cblx0XHRkaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnaXN0cnkuY29sbGVjdGlvbnMuZ2V0KCkubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmVnaXN0ZXJEZWxlZ2F0ZSBhZGRzIGRlbGVnYXRlIHRvIHJlZ2lzdHJ5JywgKCkgPT4ge1xuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IFRlc3RNY3BIb3N0RGVsZWdhdGUoKTtcblx0XHRjb25zdCBkaXNwb3NhYmxlID0gcmVnaXN0cnkucmVnaXN0ZXJEZWxlZ2F0ZShkZWxlZ2F0ZSk7XG5cdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmRlbGVnYXRlcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyeS5kZWxlZ2F0ZXNbMF0sIGRlbGVnYXRlKTtcblxuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyeS5kZWxlZ2F0ZXMubGVuZ3RoLCAwKTtcblx0fSk7XG5cblx0dGVzdCgncmVzb2x2ZUNvbm5lY3Rpb24gY3JlYXRlcyBjb25uZWN0aW9uIHdpdGggcmVzb2x2ZWQgdmFyaWFibGVzIGFuZCBtZW1vcml6ZXMgdGhlbSB1bnRpbCBjbGVhcmVkJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IGRlZmluaXRpb246IE1jcFNlcnZlckRlZmluaXRpb24gPSB7XG5cdFx0XHQuLi5iYXNlRGVmaW5pdGlvbixcblx0XHRcdGxhdW5jaDoge1xuXHRcdFx0XHR0eXBlOiBNY3BTZXJ2ZXJUcmFuc3BvcnRUeXBlLlN0ZGlvLFxuXHRcdFx0XHRjb21tYW5kOiAnJHt3b3Jrc3BhY2VGb2xkZXJ9L2NtZCcsXG5cdFx0XHRcdGFyZ3M6IFsnLS1maWxlJywgJyR7ZmlsZUJhc2VuYW1lfSddLFxuXHRcdFx0XHRlbnY6IHtcblx0XHRcdFx0XHRQQVRIOiAnJHtpbnB1dDp0ZXN0SW50ZXJhY3RpdmV9J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlbnZGaWxlOiB1bmRlZmluZWQsXG5cdFx0XHRcdGN3ZDogVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QnKVxuXHRcdFx0fSxcblx0XHRcdHZhcmlhYmxlUmVwbGFjZW1lbnQ6IHtcblx0XHRcdFx0c2VjdGlvbjogJ21jcCcsXG5cdFx0XHRcdHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UsXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGNvbnN0IGRlbGVnYXRlID0gbmV3IFRlc3RNY3BIb3N0RGVsZWdhdGUoKTtcblx0XHRzdG9yZS5hZGQocmVnaXN0cnkucmVnaXN0ZXJEZWxlZ2F0ZShkZWxlZ2F0ZSkpO1xuXHRcdHRlc3RDb2xsZWN0aW9uLnNlcnZlckRlZmluaXRpb25zLnNldChbZGVmaW5pdGlvbl0sIHVuZGVmaW5lZCk7XG5cdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbih0ZXN0Q29sbGVjdGlvbikpO1xuXG5cdFx0Y29uc3QgY29ubmVjdGlvbiA9IGF3YWl0IHJlZ2lzdHJ5LnJlc29sdmVDb25uZWN0aW9uKHsgY29sbGVjdGlvblJlZjogdGVzdENvbGxlY3Rpb24sIGRlZmluaXRpb25SZWY6IGRlZmluaXRpb24sIGxvZ2dlciB9KSBhcyBNY3BTZXJ2ZXJDb25uZWN0aW9uO1xuXG5cdFx0YXNzZXJ0Lm9rKGNvbm5lY3Rpb24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb25uZWN0aW9uLmRlZmluaXRpb24sIGRlZmluaXRpb24pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29ubmVjdGlvbi5sYXVuY2hEZWZpbml0aW9uIGFzIGFueSkuY29tbWFuZCwgJy90ZXN0L3dvcmtzcGFjZS9jbWQnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoKGNvbm5lY3Rpb24ubGF1bmNoRGVmaW5pdGlvbiBhcyBhbnkpLmVudi5QQVRILCAnaW50ZXJhY3RpdmVWYWx1ZTAnKTtcblx0XHRjb25uZWN0aW9uLmRpc3Bvc2UoKTtcblxuXHRcdGNvbnN0IGNvbm5lY3Rpb24yID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oeyBjb2xsZWN0aW9uUmVmOiB0ZXN0Q29sbGVjdGlvbiwgZGVmaW5pdGlvblJlZjogZGVmaW5pdGlvbiwgbG9nZ2VyIH0pIGFzIE1jcFNlcnZlckNvbm5lY3Rpb247XG5cblx0XHRhc3NlcnQub2soY29ubmVjdGlvbjIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCgoY29ubmVjdGlvbjIubGF1bmNoRGVmaW5pdGlvbiBhcyBhbnkpLmVudi5QQVRILCAnaW50ZXJhY3RpdmVWYWx1ZTAnKTtcblx0XHRjb25uZWN0aW9uMi5kaXNwb3NlKCk7XG5cblx0XHRyZWdpc3RyeS5jbGVhclNhdmVkSW5wdXRzKFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpO1xuXG5cdFx0Y29uc3QgY29ubmVjdGlvbjMgPSBhd2FpdCByZWdpc3RyeS5yZXNvbHZlQ29ubmVjdGlvbih7IGNvbGxlY3Rpb25SZWY6IHRlc3RDb2xsZWN0aW9uLCBkZWZpbml0aW9uUmVmOiBkZWZpbml0aW9uLCBsb2dnZXIgfSkgYXMgTWNwU2VydmVyQ29ubmVjdGlvbjtcblxuXHRcdGFzc2VydC5vayhjb25uZWN0aW9uMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKChjb25uZWN0aW9uMy5sYXVuY2hEZWZpbml0aW9uIGFzIGFueSkuZW52LlBBVEgsICdpbnRlcmFjdGl2ZVZhbHVlNCcpO1xuXHRcdGNvbm5lY3Rpb24zLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0c3VpdGUoJ1RydXN0IE1hbmFnZW1lbnQnLCAoKSA9PiB7XG5cdFx0c2V0dXAoKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGVsZWdhdGUgPSBuZXcgVGVzdE1jcEhvc3REZWxlZ2F0ZSgpO1xuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyRGVsZWdhdGUoZGVsZWdhdGUpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3Jlc29sdmVDb25uZWN0aW9uIGNvbm5lY3RzIHRvIHNlcnZlciB3aGVuIHRydXN0ZWQgYnkgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGRlZmluaXRpb24gPSB7IC4uLmJhc2VEZWZpbml0aW9uIH07XG5cdFx0XHRzdG9yZS5hZGQocmVnaXN0cnkucmVnaXN0ZXJDb2xsZWN0aW9uKHRlc3RDb2xsZWN0aW9uKSk7XG5cdFx0XHR0ZXN0Q29sbGVjdGlvbi5zZXJ2ZXJEZWZpbml0aW9ucy5zZXQoW2RlZmluaXRpb25dLCB1bmRlZmluZWQpO1xuXG5cdFx0XHRjb25zdCBjb25uZWN0aW9uID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oeyBjb2xsZWN0aW9uUmVmOiB0ZXN0Q29sbGVjdGlvbiwgZGVmaW5pdGlvblJlZjogZGVmaW5pdGlvbiwgbG9nZ2VyIH0pO1xuXG5cdFx0XHRhc3NlcnQub2soY29ubmVjdGlvbik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0Y29ubmVjdGlvbj8uZGlzcG9zZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZUNvbm5lY3Rpb24gcHJvbXB0cyBmb3IgY29uZmlybWF0aW9uIHdoZW4gbm90IHRydXN0ZWQgYnkgZGVmYXVsdCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHVudHJ1c3RlZENvbGxlY3Rpb246IE1jcENvbGxlY3Rpb25EZWZpbml0aW9uID0ge1xuXHRcdFx0XHQuLi50ZXN0Q29sbGVjdGlvbixcblx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiBmYWxzZVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgZGVmaW5pdGlvbiA9IHsgLi4uYmFzZURlZmluaXRpb24gfTtcblx0XHRcdHN0b3JlLmFkZChyZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24odW50cnVzdGVkQ29sbGVjdGlvbikpO1xuXHRcdFx0dGVzdENvbGxlY3Rpb24uc2VydmVyRGVmaW5pdGlvbnMuc2V0KFtkZWZpbml0aW9uXSwgdW5kZWZpbmVkKTtcblxuXHRcdFx0dGVzdERpYWxvZ1NlcnZpY2Uuc2V0UHJvbXB0UmVzdWx0KHRydWUpO1xuXG5cdFx0XHRjb25zdCBjb25uZWN0aW9uID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oe1xuXHRcdFx0XHRsb2dnZXIsXG5cdFx0XHRcdGNvbGxlY3Rpb25SZWY6IHVudHJ1c3RlZENvbGxlY3Rpb24sXG5cdFx0XHRcdGRlZmluaXRpb25SZWY6IGRlZmluaXRpb25cblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQub2soY29ubmVjdGlvbik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LmNhbGxlZCwgdHJ1ZSk7XG5cdFx0XHRjb25uZWN0aW9uPy5kaXNwb3NlKCk7XG5cblx0XHRcdHRlc3REaWFsb2dTZXJ2aWNlLnByb21wdFNweS5yZXNldEhpc3RvcnkoKTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24yID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oe1xuXHRcdFx0XHRsb2dnZXIsXG5cdFx0XHRcdGNvbGxlY3Rpb25SZWY6IHVudHJ1c3RlZENvbGxlY3Rpb24sXG5cdFx0XHRcdGRlZmluaXRpb25SZWY6IGRlZmluaXRpb25cblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQub2soY29ubmVjdGlvbjIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3REaWFsb2dTZXJ2aWNlLnByb21wdFNweS5jYWxsZWQsIGZhbHNlKTtcblx0XHRcdGNvbm5lY3Rpb24yPy5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZXNvbHZlQ29ubmVjdGlvbiByZXR1cm5zIHVuZGVmaW5lZCB3aGVuIHVzZXIgZG9lcyBub3QgdHJ1c3QgdGhlIHNlcnZlcicsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IHVudHJ1c3RlZENvbGxlY3Rpb246IE1jcENvbGxlY3Rpb25EZWZpbml0aW9uID0ge1xuXHRcdFx0XHQuLi50ZXN0Q29sbGVjdGlvbixcblx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiBmYWxzZVxuXHRcdFx0fTtcblxuXHRcdFx0Y29uc3QgZGVmaW5pdGlvbiA9IHsgLi4uYmFzZURlZmluaXRpb24gfTtcblx0XHRcdHN0b3JlLmFkZChyZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24odW50cnVzdGVkQ29sbGVjdGlvbikpO1xuXHRcdFx0dGVzdENvbGxlY3Rpb24uc2VydmVyRGVmaW5pdGlvbnMuc2V0KFtkZWZpbml0aW9uXSwgdW5kZWZpbmVkKTtcblxuXHRcdFx0dGVzdERpYWxvZ1NlcnZpY2Uuc2V0UHJvbXB0UmVzdWx0KGZhbHNlKTtcblxuXHRcdFx0Y29uc3QgY29ubmVjdGlvbiA9IGF3YWl0IHJlZ2lzdHJ5LnJlc29sdmVDb25uZWN0aW9uKHtcblx0XHRcdFx0bG9nZ2VyLFxuXHRcdFx0XHRjb2xsZWN0aW9uUmVmOiB1bnRydXN0ZWRDb2xsZWN0aW9uLFxuXHRcdFx0XHRkZWZpbml0aW9uUmVmOiBkZWZpbml0aW9uXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24sIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LmNhbGxlZCwgdHJ1ZSk7XG5cblx0XHRcdHRlc3REaWFsb2dTZXJ2aWNlLnByb21wdFNweS5yZXNldEhpc3RvcnkoKTtcblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24yID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oe1xuXHRcdFx0XHRsb2dnZXIsXG5cdFx0XHRcdGNvbGxlY3Rpb25SZWY6IHVudHJ1c3RlZENvbGxlY3Rpb24sXG5cdFx0XHRcdGRlZmluaXRpb25SZWY6IGRlZmluaXRpb25cblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29ubmVjdGlvbjIsIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LmNhbGxlZCwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVzb2x2ZUNvbm5lY3Rpb24gaG9ub3JzIGZvcmNlVHJ1c3QgcGFyYW1ldGVyJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdW50cnVzdGVkQ29sbGVjdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gPSB7XG5cdFx0XHRcdC4uLnRlc3RDb2xsZWN0aW9uLFxuXHRcdFx0XHRpc1RydXN0ZWRCeURlZmF1bHQ6IGZhbHNlXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBkZWZpbml0aW9uID0geyAuLi5iYXNlRGVmaW5pdGlvbiB9O1xuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbih1bnRydXN0ZWRDb2xsZWN0aW9uKSk7XG5cdFx0XHR0ZXN0Q29sbGVjdGlvbi5zZXJ2ZXJEZWZpbml0aW9ucy5zZXQoW2RlZmluaXRpb25dLCB1bmRlZmluZWQpO1xuXG5cdFx0XHR0ZXN0RGlhbG9nU2VydmljZS5zZXRQcm9tcHRSZXN1bHQoZmFsc2UpO1xuXG5cdFx0XHRjb25zdCBjb25uZWN0aW9uMSA9IGF3YWl0IHJlZ2lzdHJ5LnJlc29sdmVDb25uZWN0aW9uKHtcblx0XHRcdFx0bG9nZ2VyLFxuXHRcdFx0XHRjb2xsZWN0aW9uUmVmOiB1bnRydXN0ZWRDb2xsZWN0aW9uLFxuXHRcdFx0XHRkZWZpbml0aW9uUmVmOiBkZWZpbml0aW9uXG5cdFx0XHR9KTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbm5lY3Rpb24xLCB1bmRlZmluZWQpO1xuXG5cdFx0XHR0ZXN0RGlhbG9nU2VydmljZS5wcm9tcHRTcHkucmVzZXRIaXN0b3J5KCk7XG5cdFx0XHR0ZXN0RGlhbG9nU2VydmljZS5zZXRQcm9tcHRSZXN1bHQodHJ1ZSk7XG5cblx0XHRcdGNvbnN0IGNvbm5lY3Rpb24yID0gYXdhaXQgcmVnaXN0cnkucmVzb2x2ZUNvbm5lY3Rpb24oe1xuXHRcdFx0XHRsb2dnZXIsXG5cdFx0XHRcdGNvbGxlY3Rpb25SZWY6IHVudHJ1c3RlZENvbGxlY3Rpb24sXG5cdFx0XHRcdGRlZmluaXRpb25SZWY6IGRlZmluaXRpb24sXG5cdFx0XHRcdGZvcmNlVHJ1c3Q6IHRydWVcblx0XHRcdH0pO1xuXG5cdFx0XHRhc3NlcnQub2soY29ubmVjdGlvbjIpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRlc3REaWFsb2dTZXJ2aWNlLnByb21wdFNweS5jYWxsZWQsIHRydWUpO1xuXHRcdFx0Y29ubmVjdGlvbjI/LmRpc3Bvc2UoKTtcblxuXHRcdFx0dGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LnJlc2V0SGlzdG9yeSgpO1xuXHRcdFx0Y29uc3QgY29ubmVjdGlvbjMgPSBhd2FpdCByZWdpc3RyeS5yZXNvbHZlQ29ubmVjdGlvbih7XG5cdFx0XHRcdGxvZ2dlcixcblx0XHRcdFx0Y29sbGVjdGlvblJlZjogdW50cnVzdGVkQ29sbGVjdGlvbixcblx0XHRcdFx0ZGVmaW5pdGlvblJlZjogZGVmaW5pdGlvblxuXHRcdFx0fSk7XG5cblx0XHRcdGFzc2VydC5vayhjb25uZWN0aW9uMyk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodGVzdERpYWxvZ1NlcnZpY2UucHJvbXB0U3B5LmNhbGxlZCwgZmFsc2UpO1xuXHRcdFx0Y29ubmVjdGlvbjM/LmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0xhenkgQ29sbGVjdGlvbnMnLCAoKSA9PiB7XG5cdFx0bGV0IGxhenlDb2xsZWN0aW9uOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbjtcblx0XHRsZXQgbm9ybWFsQ29sbGVjdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb247XG5cdFx0bGV0IHJlbW92ZWRDYWxsZWQ6IGJvb2xlYW47XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRyZW1vdmVkQ2FsbGVkID0gZmFsc2U7XG5cdFx0XHRsYXp5Q29sbGVjdGlvbiA9IHtcblx0XHRcdFx0Li4udGVzdENvbGxlY3Rpb24sXG5cdFx0XHRcdGlkOiAnbGF6eS1jb2xsZWN0aW9uJyxcblx0XHRcdFx0bGF6eToge1xuXHRcdFx0XHRcdGlzQ2FjaGVkOiBmYWxzZSxcblx0XHRcdFx0XHRsb2FkOiAoKSA9PiBQcm9taXNlLnJlc29sdmUoKSxcblx0XHRcdFx0XHRyZW1vdmVkOiAoKSA9PiB7IHJlbW92ZWRDYWxsZWQgPSB0cnVlOyB9XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHRub3JtYWxDb2xsZWN0aW9uID0ge1xuXHRcdFx0XHQuLi50ZXN0Q29sbGVjdGlvbixcblx0XHRcdFx0aWQ6ICdsYXp5LWNvbGxlY3Rpb24nLFxuXHRcdFx0XHRzZXJ2ZXJEZWZpbml0aW9uczogb2JzZXJ2YWJsZVZhbHVlKCdzZXJ2ZXJEZWZzJywgW2Jhc2VEZWZpbml0aW9uXSlcblx0XHRcdH07XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdyZWdpc3RlcnMgbGF6eSBjb2xsZWN0aW9uJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbihsYXp5Q29sbGVjdGlvbik7XG5cdFx0XHRzdG9yZS5hZGQoZGlzcG9zYWJsZSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyeS5jb2xsZWN0aW9ucy5nZXQoKS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpWzBdLCBsYXp5Q29sbGVjdGlvbik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnaXN0cnkubGF6eUNvbGxlY3Rpb25TdGF0ZS5nZXQoKSwgTGF6eUNvbGxlY3Rpb25TdGF0ZS5IYXNVbmtub3duKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2xhenkgY29sbGVjdGlvbiBpcyByZXBsYWNlZCBieSBub3JtYWwgY29sbGVjdGlvbicsICgpID0+IHtcblx0XHRcdHN0b3JlLmFkZChyZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24obGF6eUNvbGxlY3Rpb24pKTtcblx0XHRcdHN0b3JlLmFkZChyZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24obm9ybWFsQ29sbGVjdGlvbikpO1xuXG5cdFx0XHRjb25zdCBjb2xsZWN0aW9ucyA9IHJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb25zLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbnNbMF0sIG5vcm1hbENvbGxlY3Rpb24pO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb25zWzBdLmxhenksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnaXN0cnkubGF6eUNvbGxlY3Rpb25TdGF0ZS5nZXQoKSwgTGF6eUNvbGxlY3Rpb25TdGF0ZS5BbGxLbm93bik7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdsYXp5Q29sbGVjdGlvblN0YXRlIHVwZGF0ZXMgY29ycmVjdGx5IGR1cmluZyBsb2FkaW5nJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0bGF6eUNvbGxlY3Rpb24gPSB7XG5cdFx0XHRcdC4uLmxhenlDb2xsZWN0aW9uLFxuXHRcdFx0XHRsYXp5OiB7XG5cdFx0XHRcdFx0Li4ubGF6eUNvbGxlY3Rpb24ubGF6eSEsXG5cdFx0XHRcdFx0bG9hZDogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdFx0YXdhaXQgdGltZW91dCgwKTtcblx0XHRcdFx0XHRcdHN0b3JlLmFkZChyZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24obm9ybWFsQ29sbGVjdGlvbikpO1xuXHRcdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fTtcblxuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbihsYXp5Q29sbGVjdGlvbikpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmxhenlDb2xsZWN0aW9uU3RhdGUuZ2V0KCksIExhenlDb2xsZWN0aW9uU3RhdGUuSGFzVW5rbm93bik7XG5cblx0XHRcdGNvbnN0IGxvYWRpbmdQcm9taXNlID0gcmVnaXN0cnkuZGlzY292ZXJDb2xsZWN0aW9ucygpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmxhenlDb2xsZWN0aW9uU3RhdGUuZ2V0KCksIExhenlDb2xsZWN0aW9uU3RhdGUuTG9hZGluZ1Vua25vd24pO1xuXG5cdFx0XHRhd2FpdCBsb2FkaW5nUHJvbWlzZTtcblxuXHRcdFx0Ly8gVGhlIGNvbGxlY3Rpb24gd2Fzbid0IHJlcGxhY2VkLCBzbyBpdCBzaG91bGQgYmUgcmVtb3ZlZFxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpLmxlbmd0aCwgMSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnaXN0cnkubGF6eUNvbGxlY3Rpb25TdGF0ZS5nZXQoKSwgTGF6eUNvbGxlY3Rpb25TdGF0ZS5BbGxLbm93bik7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlZENhbGxlZCwgZmFsc2UpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncmVtb3ZlZCBjYWxsYmFjayBpcyBjYWxsZWQgd2hlbiBsYXp5IGNvbGxlY3Rpb24gaXMgbm90IHJlcGxhY2VkJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbihsYXp5Q29sbGVjdGlvbikpO1xuXHRcdFx0YXdhaXQgcmVnaXN0cnkuZGlzY292ZXJDb2xsZWN0aW9ucygpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVtb3ZlZENhbGxlZCwgdHJ1ZSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdjYWNoZWQgbGF6eSBjb2xsZWN0aW9ucyBhcmUgdHJhY2tlZCBjb3JyZWN0bHknLCAoKSA9PiB7XG5cdFx0XHRsYXp5Q29sbGVjdGlvbi5sYXp5IS5pc0NhY2hlZCA9IHRydWU7XG5cdFx0XHRzdG9yZS5hZGQocmVnaXN0cnkucmVnaXN0ZXJDb2xsZWN0aW9uKGxhenlDb2xsZWN0aW9uKSk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyeS5sYXp5Q29sbGVjdGlvblN0YXRlLmdldCgpLCBMYXp5Q29sbGVjdGlvblN0YXRlLkFsbEtub3duKTtcblxuXHRcdFx0Ly8gQWRkaW5nIGFuIHVuY2FjaGVkIGxhenkgY29sbGVjdGlvbiBjaGFuZ2VzIHRoZSBzdGF0ZVxuXHRcdFx0Y29uc3QgdW5jYWNoZWRMYXp5ID0ge1xuXHRcdFx0XHQuLi5sYXp5Q29sbGVjdGlvbixcblx0XHRcdFx0aWQ6ICd1bmNhY2hlZC1sYXp5Jyxcblx0XHRcdFx0bGF6eToge1xuXHRcdFx0XHRcdC4uLmxhenlDb2xsZWN0aW9uLmxhenkhLFxuXHRcdFx0XHRcdGlzQ2FjaGVkOiBmYWxzZVxuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbih1bmNhY2hlZExhenkpKTtcblxuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJ5LmxhenlDb2xsZWN0aW9uU3RhdGUuZ2V0KCksIExhenlDb2xsZWN0aW9uU3RhdGUuSGFzVW5rbm93bik7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdDb2xsZWN0aW9uIFRvb2wgUHJlZml4ZXMnLCAoKSA9PiB7XG5cdFx0dGVzdCgnYXNzaWducyB1bmlxdWUgcHJlZml4ZXMgdG8gY29sbGVjdGlvbnMnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBjb2xsZWN0aW9uMTogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gPSB7XG5cdFx0XHRcdGlkOiAnY29sbGVjdGlvbjEnLFxuXHRcdFx0XHRsYWJlbDogJ0NvbGxlY3Rpb24gMScsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogbnVsbCxcblx0XHRcdFx0c2VydmVyRGVmaW5pdGlvbnM6IG9ic2VydmFibGVWYWx1ZSgnc2VydmVyRGVmcycsIFtdKSxcblx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRzY29wZTogU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBjb2xsZWN0aW9uMjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gPSB7XG5cdFx0XHRcdGlkOiAnY29sbGVjdGlvbjInLFxuXHRcdFx0XHRsYWJlbDogJ0NvbGxlY3Rpb24gMicsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogbnVsbCxcblx0XHRcdFx0c2VydmVyRGVmaW5pdGlvbnM6IG9ic2VydmFibGVWYWx1ZSgnc2VydmVyRGVmcycsIFtdKSxcblx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRzY29wZTogU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9O1xuXG5cdFx0XHRzdG9yZS5hZGQocmVnaXN0cnkucmVnaXN0ZXJDb2xsZWN0aW9uKGNvbGxlY3Rpb24xKSk7XG5cdFx0XHRzdG9yZS5hZGQocmVnaXN0cnkucmVnaXN0ZXJDb2xsZWN0aW9uKGNvbGxlY3Rpb24yKSk7XG5cblx0XHRcdGNvbnN0IHByZWZpeDEgPSByZWdpc3RyeS5jb2xsZWN0aW9uVG9vbFByZWZpeChjb2xsZWN0aW9uMSkuZ2V0KCk7XG5cdFx0XHRjb25zdCBwcmVmaXgyID0gcmVnaXN0cnkuY29sbGVjdGlvblRvb2xQcmVmaXgoY29sbGVjdGlvbjIpLmdldCgpO1xuXG5cdFx0XHRhc3NlcnQubm90U3RyaWN0RXF1YWwocHJlZml4MSwgcHJlZml4Mik7XG5cdFx0XHRhc3NlcnQub2soL15bYS1mMC05XXszfVxcLiQvLnRlc3QocHJlZml4MSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKC9eW2EtZjAtOV17M31cXC4kLy50ZXN0KHByZWZpeDIpKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2hhbmRsZXMgaGFzaCBjb2xsaXNpb25zIGJ5IGluY3JlbWVudGluZyB2aWV3JywgKCkgPT4ge1xuXHRcdFx0Ly8gVGhlc2Ugc3RyaW5ncyBhcmUga25vd24gdG8gaGF2ZSBTSEExIGhhc2ggY29sbGlzaW9ucyBpbiB0aGVpciBmaXJzdCAzIGNoYXJhY3RlcnNcblx0XHRcdGNvbnN0IGNvbGxlY3Rpb24xOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbiA9IHtcblx0XHRcdFx0aWQ6ICdwb3RhdG8nLFxuXHRcdFx0XHRsYWJlbDogJ0NvbGxlY3Rpb24gMScsXG5cdFx0XHRcdHJlbW90ZUF1dGhvcml0eTogbnVsbCxcblx0XHRcdFx0c2VydmVyRGVmaW5pdGlvbnM6IG9ic2VydmFibGVWYWx1ZSgnc2VydmVyRGVmcycsIFtdKSxcblx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRzY29wZTogU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OXG5cdFx0XHR9O1xuXG5cdFx0XHRjb25zdCBjb2xsZWN0aW9uMjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gPSB7XG5cdFx0XHRcdGlkOiAnY2FuZGlkYXRlXzgzMDQ4Jyxcblx0XHRcdFx0bGFiZWw6ICdDb2xsZWN0aW9uIDInLFxuXHRcdFx0XHRyZW1vdGVBdXRob3JpdHk6IG51bGwsXG5cdFx0XHRcdHNlcnZlckRlZmluaXRpb25zOiBvYnNlcnZhYmxlVmFsdWUoJ3NlcnZlckRlZnMnLCBbXSksXG5cdFx0XHRcdGlzVHJ1c3RlZEJ5RGVmYXVsdDogdHJ1ZSxcblx0XHRcdFx0c2NvcGU6IFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTlxuXHRcdFx0fTtcblxuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbihjb2xsZWN0aW9uMSkpO1xuXHRcdFx0c3RvcmUuYWRkKHJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbihjb2xsZWN0aW9uMikpO1xuXG5cdFx0XHRjb25zdCBwcmVmaXgxID0gcmVnaXN0cnkuY29sbGVjdGlvblRvb2xQcmVmaXgoY29sbGVjdGlvbjEpLmdldCgpO1xuXHRcdFx0Y29uc3QgcHJlZml4MiA9IHJlZ2lzdHJ5LmNvbGxlY3Rpb25Ub29sUHJlZml4KGNvbGxlY3Rpb24yKS5nZXQoKTtcblxuXHRcdFx0YXNzZXJ0Lm5vdFN0cmljdEVxdWFsKHByZWZpeDEsIHByZWZpeDIpO1xuXHRcdFx0YXNzZXJ0Lm9rKC9eW2EtZjAtOV17M31cXC4kLy50ZXN0KHByZWZpeDEpKTtcblx0XHRcdGFzc2VydC5vaygvXlthLWYwLTldezN9XFwuJC8udGVzdChwcmVmaXgyKSk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdwcmVmaXggY2hhbmdlcyB3aGVuIGNvbGxlY3Rpb25zIGNoYW5nZScsICgpID0+IHtcblx0XHRcdGNvbnN0IGNvbGxlY3Rpb24xOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbiA9IHtcblx0XHRcdFx0aWQ6ICdjb2xsZWN0aW9uMScsXG5cdFx0XHRcdGxhYmVsOiAnQ29sbGVjdGlvbiAxJyxcblx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBudWxsLFxuXHRcdFx0XHRzZXJ2ZXJEZWZpbml0aW9uczogb2JzZXJ2YWJsZVZhbHVlKCdzZXJ2ZXJEZWZzJywgW10pLFxuXHRcdFx0XHRpc1RydXN0ZWRCeURlZmF1bHQ6IHRydWUsXG5cdFx0XHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT05cblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSByZWdpc3RyeS5yZWdpc3RlckNvbGxlY3Rpb24oY29sbGVjdGlvbjEpO1xuXHRcdFx0c3RvcmUuYWRkKGRpc3Bvc2FibGUpO1xuXG5cdFx0XHRjb25zdCBwcmVmaXgxID0gcmVnaXN0cnkuY29sbGVjdGlvblRvb2xQcmVmaXgoY29sbGVjdGlvbjEpLmdldCgpO1xuXHRcdFx0YXNzZXJ0Lm9rKCEhcHJlZml4MSk7XG5cblx0XHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXG5cdFx0XHRjb25zdCBwcmVmaXgyID0gcmVnaXN0cnkuY29sbGVjdGlvblRvb2xQcmVmaXgoY29sbGVjdGlvbjEpLmdldCgpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJlZml4MiwgJycpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgncHJlZml4IGlzIGVtcHR5IGZvciB1bmtub3duIGNvbGxlY3Rpb25zJywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgdW5rbm93bkNvbGxlY3Rpb246IE1jcENvbGxlY3Rpb25SZWZlcmVuY2UgPSB7XG5cdFx0XHRcdGlkOiAndW5rbm93bicsXG5cdFx0XHRcdGxhYmVsOiAnVW5rbm93bidcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHByZWZpeCA9IHJlZ2lzdHJ5LmNvbGxlY3Rpb25Ub29sUHJlZml4KHVua25vd25Db2xsZWN0aW9uKS5nZXQoKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcmVmaXgsICcnKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksWUFBWTtBQUN4QixZQUFZLFdBQVc7QUFDdkIsU0FBUyxlQUFlO0FBQ3hCLFNBQThCLHVCQUF1QjtBQUNyRCxTQUFTLGNBQWM7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
