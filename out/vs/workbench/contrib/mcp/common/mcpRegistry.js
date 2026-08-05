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
import { Emitter } from "../../../../base/common/event.js";
import { StringSHA1 } from "../../../../base/common/hash.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { derived, observableValue } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { localize } from "../../../../nls.js";
import { ConfigurationTarget } from "../../../../platform/configuration/common/configuration.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { observableMemento } from "../../../../platform/observable/common/observableMemento.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { IConfigurationResolverService } from "../../../services/configurationResolver/common/configurationResolver.js";
import { ConfigurationResolverExpression } from "../../../services/configurationResolver/common/configurationResolverExpression.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { McpRegistryInputStorage } from "./mcpRegistryInputStorage.js";
import { McpServerConnection } from "./mcpServerConnection.js";
import { LazyCollectionState } from "./mcpTypes.js";
const createTrustMemento = observableMemento({
  defaultValue: {},
  key: "mcp.trustedCollections"
});
const collectionPrefixLen = 3;
let McpRegistry = class extends Disposable {
  constructor(_instantiationService, _configurationResolverService, _dialogService, _storageService, _productService, _notificationService, _editorService) {
    super();
    this._instantiationService = _instantiationService;
    this._configurationResolverService = _configurationResolverService;
    this._dialogService = _dialogService;
    this._storageService = _storageService;
    this._productService = _productService;
    this._notificationService = _notificationService;
    this._editorService = _editorService;
    this._trustPrompts = /* @__PURE__ */ new Map();
    this._collections = observableValue("collections", []);
    this._delegates = [];
    this.collections = this._collections;
    this._collectionToPrefixes = this._collections.map((c) => {
      const hashes = c.map((collection) => {
        const sha = new StringSHA1();
        sha.update(collection.id);
        return { view: 0, hash: sha.digest(), collection };
      });
      const view = (h) => h.hash.slice(h.view, h.view + collectionPrefixLen);
      let collided = false;
      do {
        hashes.sort((a, b) => view(a).localeCompare(view(b)) || a.collection.id.localeCompare(b.collection.id));
        collided = false;
        for (let i = 1; i < hashes.length; i++) {
          const prev = hashes[i - 1];
          const curr = hashes[i];
          if (view(prev) === view(curr) && curr.view + collectionPrefixLen < curr.hash.length) {
            curr.view++;
            collided = true;
          }
        }
      } while (collided);
      return Object.fromEntries(hashes.map((h) => [h.collection.id, view(h) + "."]));
    });
    this._workspaceStorage = new Lazy(() => this._register(this._instantiationService.createInstance(McpRegistryInputStorage, StorageScope.WORKSPACE, StorageTarget.USER)));
    this._profileStorage = new Lazy(() => this._register(this._instantiationService.createInstance(McpRegistryInputStorage, StorageScope.PROFILE, StorageTarget.USER)));
    this._trustMemento = new Lazy(() => this._register(createTrustMemento(StorageScope.APPLICATION, StorageTarget.MACHINE, this._storageService)));
    this._lazyCollectionsToUpdate = /* @__PURE__ */ new Set();
    this._ongoingLazyActivations = observableValue(this, 0);
    this.lazyCollectionState = derived((reader) => {
      if (this._ongoingLazyActivations.read(reader) > 0) {
        return LazyCollectionState.LoadingUnknown;
      }
      const collections = this._collections.read(reader);
      return collections.some((c) => c.lazy && c.lazy.isCached === false) ? LazyCollectionState.HasUnknown : LazyCollectionState.AllKnown;
    });
    this._onDidChangeInputs = this._register(new Emitter());
    this.onDidChangeInputs = this._onDidChangeInputs.event;
  }
  get delegates() {
    return this._delegates;
  }
  registerDelegate(delegate) {
    this._delegates.push(delegate);
    this._delegates.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        const index = this._delegates.indexOf(delegate);
        if (index !== -1) {
          this._delegates.splice(index, 1);
        }
      }
    };
  }
  registerCollection(collection) {
    const currentCollections = this._collections.get();
    const toReplace = currentCollections.find((c) => c.lazy && c.id === collection.id);
    if (toReplace) {
      this._lazyCollectionsToUpdate.add(collection.id);
      this._collections.set(currentCollections.map((c) => c === toReplace ? collection : c), void 0);
    } else {
      this._collections.set([...currentCollections, collection], void 0);
    }
    return {
      dispose: () => {
        const currentCollections2 = this._collections.get();
        this._collections.set(currentCollections2.filter((c) => c !== collection), void 0);
      }
    };
  }
  collectionToolPrefix(collection) {
    return this._collectionToPrefixes.map((p) => p[collection.id] ?? "");
  }
  async discoverCollections() {
    const toDiscover = this._collections.get().filter((c) => c.lazy && !c.lazy.isCached);
    this._ongoingLazyActivations.set(this._ongoingLazyActivations.get() + 1, void 0);
    await Promise.all(toDiscover.map((c) => c.lazy?.load())).finally(() => {
      this._ongoingLazyActivations.set(this._ongoingLazyActivations.get() - 1, void 0);
    });
    const found = [];
    const current = this._collections.get();
    for (const collection of toDiscover) {
      const rec = current.find((c) => c.id === collection.id);
      if (!rec) {
      } else if (rec.lazy) {
        rec.lazy.removed?.();
      } else {
        found.push(rec);
      }
    }
    return found;
  }
  _getInputStorage(scope) {
    return scope === StorageScope.WORKSPACE ? this._workspaceStorage.value : this._profileStorage.value;
  }
  _getInputStorageInConfigTarget(configTarget) {
    return this._getInputStorage(
      configTarget === ConfigurationTarget.WORKSPACE || configTarget === ConfigurationTarget.WORKSPACE_FOLDER ? StorageScope.WORKSPACE : StorageScope.PROFILE
    );
  }
  async clearSavedInputs(scope, inputId) {
    const storage = this._getInputStorage(scope);
    if (inputId) {
      await storage.clear(inputId);
    } else {
      storage.clearAll();
    }
    this._onDidChangeInputs.fire();
  }
  async editSavedInput(inputId, folderData, configSection, target) {
    const storage = this._getInputStorageInConfigTarget(target);
    const expr = ConfigurationResolverExpression.parse(inputId);
    const stored = await storage.getMap();
    const previous = stored[inputId].value;
    await this._configurationResolverService.resolveWithInteraction(folderData, expr, configSection, previous ? { [inputId.slice(2, -1)]: previous } : {}, target);
    await this._updateStorageWithExpressionInputs(storage, expr);
  }
  getSavedInputs(scope) {
    return this._getInputStorage(scope).getMap();
  }
  resetTrust() {
    this._trustMemento.value.set({}, void 0);
  }
  getTrust(collectionRef) {
    return derived((reader) => {
      const collection = this._collections.read(reader).find((c) => c.id === collectionRef.id);
      if (!collection || collection.isTrustedByDefault) {
        return true;
      }
      const memento = this._trustMemento.value.read(reader);
      return memento.hasOwnProperty(collection.id) ? memento[collection.id] : void 0;
    });
  }
  _promptForTrust(collection) {
    let resultPromise = this._trustPrompts.get(collection.id);
    resultPromise ??= this._promptForTrustOpenDialog(collection).finally(() => {
      this._trustPrompts.delete(collection.id);
    });
    this._trustPrompts.set(collection.id, resultPromise);
    return resultPromise;
  }
  async _promptForTrustOpenDialog(collection) {
    const originURI = collection.presentation?.origin;
    const labelWithOrigin = originURI ? `[\`${basename(originURI)}\`](${originURI})` : collection.label;
    const result = await this._dialogService.prompt(
      {
        message: localize("trustTitleWithOrigin", "Trust MCP servers from {0}?", collection.label),
        custom: {
          markdownDetails: [{
            markdown: new MarkdownString(localize("mcp.trust.details", "{0} discovered Model Context Protocol servers from {1} (`{2}`). {0} can use their capabilities in Chat.\n\nDo you want to allow running MCP servers from {3}?", this._productService.nameShort, collection.label, collection.serverDefinitions.get().map((s) => s.label).join("`, `"), labelWithOrigin)),
            dismissOnLinkClick: true
          }]
        },
        buttons: [
          { label: localize("mcp.trust.yes", "Trust"), run: () => true },
          { label: localize("mcp.trust.no", "Do not trust"), run: () => false }
        ]
      }
    );
    return result.result;
  }
  async _updateStorageWithExpressionInputs(inputStorage, expr) {
    const secrets = {};
    const inputs = {};
    for (const [replacement, resolved] of expr.resolved()) {
      if (resolved.input?.type === "promptString" && resolved.input.password) {
        secrets[replacement.id] = resolved;
      } else {
        inputs[replacement.id] = resolved;
      }
    }
    inputStorage.setPlainText(inputs);
    await inputStorage.setSecrets(secrets);
    this._onDidChangeInputs.fire();
  }
  async _replaceVariablesInLaunch(definition, launch) {
    if (!definition.variableReplacement) {
      return launch;
    }
    const { section, target, folder } = definition.variableReplacement;
    const inputStorage = this._getInputStorageInConfigTarget(target);
    const previouslyStored = await inputStorage.getMap();
    const expr = ConfigurationResolverExpression.parse(launch);
    for (const replacement of expr.unresolved()) {
      if (previouslyStored.hasOwnProperty(replacement.id)) {
        expr.resolve(replacement, previouslyStored[replacement.id]);
      }
    }
    await this._configurationResolverService.resolveWithInteraction(folder, expr, section, void 0, target);
    await this._updateStorageWithExpressionInputs(inputStorage, expr);
    return await this._configurationResolverService.resolveAsync(folder, expr);
  }
  async resolveConnection({ collectionRef, definitionRef, forceTrust, logger }) {
    const collection = this._collections.get().find((c) => c.id === collectionRef.id);
    const definition = collection?.serverDefinitions.get().find((s) => s.id === definitionRef.id);
    if (!collection || !definition) {
      throw new Error(`Collection or definition not found for ${collectionRef.id} and ${definitionRef.id}`);
    }
    const delegate = this._delegates.find((d) => d.canStart(collection, definition));
    if (!delegate) {
      throw new Error("No delegate found that can handle the connection");
    }
    if (!collection.isTrustedByDefault) {
      const memento = this._trustMemento.value.get();
      const trusted = memento.hasOwnProperty(collection.id) ? memento[collection.id] : void 0;
      if (trusted) {
      } else if (trusted === void 0 || forceTrust) {
        const trustValue = await this._promptForTrust(collection);
        if (trustValue !== void 0) {
          this._trustMemento.value.set({ ...memento, [collection.id]: trustValue }, void 0);
        }
        if (!trustValue) {
          return;
        }
      } else {
        return void 0;
      }
    }
    let launch;
    try {
      launch = await this._replaceVariablesInLaunch(definition, definition.launch);
    } catch (e) {
      this._notificationService.notify({
        severity: Severity.Error,
        message: localize("mcp.launchError", "Error starting {0}: {1}", definition.label, String(e)),
        actions: {
          primary: collection.presentation?.origin && [
            {
              id: "mcp.launchError.openConfig",
              class: void 0,
              enabled: true,
              tooltip: "",
              label: localize("mcp.launchError.openConfig", "Open Configuration"),
              run: () => this._editorService.openEditor({
                resource: collection.presentation.origin,
                options: { selection: definition.presentation?.origin?.range }
              })
            }
          ]
        }
      });
      return;
    }
    return this._instantiationService.createInstance(
      McpServerConnection,
      collection,
      definition,
      delegate,
      launch,
      logger
    );
  }
};
McpRegistry = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IConfigurationResolverService),
  __decorateParam(2, IDialogService),
  __decorateParam(3, IStorageService),
  __decorateParam(4, IProductService),
  __decorateParam(5, INotificationService),
  __decorateParam(6, IEditorService)
], McpRegistry);
export {
  McpRegistry
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFJlZ2lzdHJ5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IFN0cmluZ1NIQTEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9oYXNoLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgZGVyaXZlZCwgSU9ic2VydmFibGUsIG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgYmFzZW5hbWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSURpYWxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kaWFsb2dzL2NvbW1vbi9kaWFsb2dzLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZU1lbWVudG8gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9vYnNlcnZhYmxlTWVtZW50by5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUZvbGRlckRhdGEgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2NvbmZpZ3VyYXRpb25SZXNvbHZlci9jb21tb24vY29uZmlndXJhdGlvblJlc29sdmVyLmpzJztcbmltcG9ydCB7IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24sIElSZXNvbHZlZFZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXJFeHByZXNzaW9uLmpzJztcbmltcG9ydCB7IElFZGl0b3JTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2NvbW1vbi9lZGl0b3JTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1jcFJlZ2lzdHJ5SW5wdXRTdG9yYWdlIH0gZnJvbSAnLi9tY3BSZWdpc3RyeUlucHV0U3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJTWNwSG9zdERlbGVnYXRlLCBJTWNwUmVnaXN0cnksIElNY3BSZXNvbHZlQ29ubmVjdGlvbk9wdGlvbnMgfSBmcm9tICcuL21jcFJlZ2lzdHJ5VHlwZXMuanMnO1xuaW1wb3J0IHsgTWNwU2VydmVyQ29ubmVjdGlvbiB9IGZyb20gJy4vbWNwU2VydmVyQ29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWNwU2VydmVyQ29ubmVjdGlvbiwgTGF6eUNvbGxlY3Rpb25TdGF0ZSwgTWNwQ29sbGVjdGlvbkRlZmluaXRpb24sIE1jcENvbGxlY3Rpb25SZWZlcmVuY2UsIE1jcFNlcnZlckRlZmluaXRpb24sIE1jcFNlcnZlckxhdW5jaCB9IGZyb20gJy4vbWNwVHlwZXMuanMnO1xuXG5jb25zdCBjcmVhdGVUcnVzdE1lbWVudG8gPSBvYnNlcnZhYmxlTWVtZW50bzxSZWFkb25seTxSZWNvcmQ8c3RyaW5nLCBib29sZWFuPj4+KHtcblx0ZGVmYXVsdFZhbHVlOiB7fSxcblx0a2V5OiAnbWNwLnRydXN0ZWRDb2xsZWN0aW9ucydcbn0pO1xuXG5jb25zdCBjb2xsZWN0aW9uUHJlZml4TGVuID0gMztcblxuZXhwb3J0IGNsYXNzIE1jcFJlZ2lzdHJ5IGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNY3BSZWdpc3RyeSB7XG5cdGRlY2xhcmUgcHVibGljIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90cnVzdFByb21wdHMgPSBuZXcgTWFwPC8qIGNvbGxlY3Rpb24gSUQgKi9zdHJpbmcsIFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29sbGVjdGlvbnMgPSBvYnNlcnZhYmxlVmFsdWU8cmVhZG9ubHkgTWNwQ29sbGVjdGlvbkRlZmluaXRpb25bXT4oJ2NvbGxlY3Rpb25zJywgW10pO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kZWxlZ2F0ZXM6IElNY3BIb3N0RGVsZWdhdGVbXSA9IFtdO1xuXHRwdWJsaWMgcmVhZG9ubHkgY29sbGVjdGlvbnM6IElPYnNlcnZhYmxlPHJlYWRvbmx5IE1jcENvbGxlY3Rpb25EZWZpbml0aW9uW10+ID0gdGhpcy5fY29sbGVjdGlvbnM7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY29sbGVjdGlvblRvUHJlZml4ZXMgPSB0aGlzLl9jb2xsZWN0aW9ucy5tYXAoYyA9PiB7XG5cdFx0Ly8gVGhpcyBjcmVhdGVzIHRvb2wgcHJlZml4ZXMgYmFzZWQgb24gYSBoYXNoIG9mIHRoZSBjb2xsZWN0aW9uIElELiBUaGlzIGlzXG5cdFx0Ly8gYSBzaG9ydCBwcmVmaXggYmVjYXVzZSB0b29sIG5hbWVzIHRoYXQgYXJlIHRvbyBsb25nIGNhbiBjYXVzZSBlcnJvcnMgKCMyNDM2MDIpLlxuXHRcdC8vIFNvIHdlIHRha2UgYSBoYXNoIChpbiBvcmRlciBmb3IgdG9vbHMgdG8gYmUgc3RhYmxlLCBiZWNhdXNlIHJhbmRvbWl6ZWRcblx0XHQvLyBuYW1lcyBjYW4gY2F1c2UgaGFsbGljaW5hdGlvbnMgaWYgcHJlc2VudCBpbiBoaXN0b3J5KSBhbmQgdGhlbiBhZGp1c3Rcblx0XHQvLyB0aGVtIGlmIHRoZXJlIGFyZSBhbnkgY29sbGlzaW9ucy5cblx0XHR0eXBlIENvbGxlY3Rpb25IYXNoID0geyB2aWV3OiBudW1iZXI7IGhhc2g6IHN0cmluZzsgY29sbGVjdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24gfTtcblxuXHRcdGNvbnN0IGhhc2hlcyA9IGMubWFwKChjb2xsZWN0aW9uKTogQ29sbGVjdGlvbkhhc2ggPT4ge1xuXHRcdFx0Y29uc3Qgc2hhID0gbmV3IFN0cmluZ1NIQTEoKTtcblx0XHRcdHNoYS51cGRhdGUoY29sbGVjdGlvbi5pZCk7XG5cdFx0XHRyZXR1cm4geyB2aWV3OiAwLCBoYXNoOiBzaGEuZGlnZXN0KCksIGNvbGxlY3Rpb24gfTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IHZpZXcgPSAoaDogQ29sbGVjdGlvbkhhc2gpID0+IGguaGFzaC5zbGljZShoLnZpZXcsIGgudmlldyArIGNvbGxlY3Rpb25QcmVmaXhMZW4pO1xuXG5cdFx0bGV0IGNvbGxpZGVkID0gZmFsc2U7XG5cdFx0ZG8ge1xuXHRcdFx0aGFzaGVzLnNvcnQoKGEsIGIpID0+IHZpZXcoYSkubG9jYWxlQ29tcGFyZSh2aWV3KGIpKSB8fCBhLmNvbGxlY3Rpb24uaWQubG9jYWxlQ29tcGFyZShiLmNvbGxlY3Rpb24uaWQpKTtcblx0XHRcdGNvbGxpZGVkID0gZmFsc2U7XG5cdFx0XHRmb3IgKGxldCBpID0gMTsgaSA8IGhhc2hlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRjb25zdCBwcmV2ID0gaGFzaGVzW2kgLSAxXTtcblx0XHRcdFx0Y29uc3QgY3VyciA9IGhhc2hlc1tpXTtcblx0XHRcdFx0aWYgKHZpZXcocHJldikgPT09IHZpZXcoY3VycikgJiYgY3Vyci52aWV3ICsgY29sbGVjdGlvblByZWZpeExlbiA8IGN1cnIuaGFzaC5sZW5ndGgpIHtcblx0XHRcdFx0XHRjdXJyLnZpZXcrKztcblx0XHRcdFx0XHRjb2xsaWRlZCA9IHRydWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IHdoaWxlIChjb2xsaWRlZCk7XG5cblx0XHRyZXR1cm4gT2JqZWN0LmZyb21FbnRyaWVzKGhhc2hlcy5tYXAoaCA9PiBbaC5jb2xsZWN0aW9uLmlkLCB2aWV3KGgpICsgJy4nXSkpO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VTdG9yYWdlID0gbmV3IExhenkoKCkgPT4gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTWNwUmVnaXN0cnlJbnB1dFN0b3JhZ2UsIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsIFN0b3JhZ2VUYXJnZXQuVVNFUikpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJvZmlsZVN0b3JhZ2UgPSBuZXcgTGF6eSgoKSA9PiB0aGlzLl9yZWdpc3Rlcih0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShNY3BSZWdpc3RyeUlucHV0U3RvcmFnZSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuVVNFUikpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF90cnVzdE1lbWVudG8gPSBuZXcgTGF6eSgoKSA9PiB0aGlzLl9yZWdpc3RlcihjcmVhdGVUcnVzdE1lbWVudG8oU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsIHRoaXMuX3N0b3JhZ2VTZXJ2aWNlKSkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9sYXp5Q29sbGVjdGlvbnNUb1VwZGF0ZSA9IG5ldyBTZXQ8LyogY29sbGVjdGlvbiBJRCovc3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbmdvaW5nTGF6eUFjdGl2YXRpb25zID0gb2JzZXJ2YWJsZVZhbHVlKHRoaXMsIDApO1xuXG5cdHB1YmxpYyByZWFkb25seSBsYXp5Q29sbGVjdGlvblN0YXRlID0gZGVyaXZlZChyZWFkZXIgPT4ge1xuXHRcdGlmICh0aGlzLl9vbmdvaW5nTGF6eUFjdGl2YXRpb25zLnJlYWQocmVhZGVyKSA+IDApIHtcblx0XHRcdHJldHVybiBMYXp5Q29sbGVjdGlvblN0YXRlLkxvYWRpbmdVbmtub3duO1xuXHRcdH1cblx0XHRjb25zdCBjb2xsZWN0aW9ucyA9IHRoaXMuX2NvbGxlY3Rpb25zLnJlYWQocmVhZGVyKTtcblx0XHRyZXR1cm4gY29sbGVjdGlvbnMuc29tZShjID0+IGMubGF6eSAmJiBjLmxhenkuaXNDYWNoZWQgPT09IGZhbHNlKSA/IExhenlDb2xsZWN0aW9uU3RhdGUuSGFzVW5rbm93biA6IExhenlDb2xsZWN0aW9uU3RhdGUuQWxsS25vd247XG5cdH0pO1xuXG5cdHB1YmxpYyBnZXQgZGVsZWdhdGVzKCk6IHJlYWRvbmx5IElNY3BIb3N0RGVsZWdhdGVbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlbGVnYXRlcztcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlSW5wdXRzID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZUlucHV0cyA9IHRoaXMuX29uRGlkQ2hhbmdlSW5wdXRzLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblJlc29sdmVyU2VydmljZTogSUNvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0fVxuXG5cdHB1YmxpYyByZWdpc3RlckRlbGVnYXRlKGRlbGVnYXRlOiBJTWNwSG9zdERlbGVnYXRlKTogSURpc3Bvc2FibGUge1xuXHRcdHRoaXMuX2RlbGVnYXRlcy5wdXNoKGRlbGVnYXRlKTtcblx0XHR0aGlzLl9kZWxlZ2F0ZXMuc29ydCgoYSwgYikgPT4gYi5wcmlvcml0eSAtIGEucHJpb3JpdHkpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0Y29uc3QgaW5kZXggPSB0aGlzLl9kZWxlZ2F0ZXMuaW5kZXhPZihkZWxlZ2F0ZSk7XG5cdFx0XHRcdGlmIChpbmRleCAhPT0gLTEpIHtcblx0XHRcdFx0XHR0aGlzLl9kZWxlZ2F0ZXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgcmVnaXN0ZXJDb2xsZWN0aW9uKGNvbGxlY3Rpb246IE1jcENvbGxlY3Rpb25EZWZpbml0aW9uKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGN1cnJlbnRDb2xsZWN0aW9ucyA9IHRoaXMuX2NvbGxlY3Rpb25zLmdldCgpO1xuXHRcdGNvbnN0IHRvUmVwbGFjZSA9IGN1cnJlbnRDb2xsZWN0aW9ucy5maW5kKGMgPT4gYy5sYXp5ICYmIGMuaWQgPT09IGNvbGxlY3Rpb24uaWQpO1xuXG5cdFx0Ly8gSW5jb21pbmcgY29sbGVjdGlvbnMgcmVwbGFjZSB0aGUgXCJsYXp5XCIgdmVyc2lvbnMuIFNlZSBgRXh0ZW5zaW9uTWNwRGlzY292ZXJ5YCBmb3IgYW4gZXhhbXBsZS5cblx0XHRpZiAodG9SZXBsYWNlKSB7XG5cdFx0XHR0aGlzLl9sYXp5Q29sbGVjdGlvbnNUb1VwZGF0ZS5hZGQoY29sbGVjdGlvbi5pZCk7XG5cdFx0XHR0aGlzLl9jb2xsZWN0aW9ucy5zZXQoY3VycmVudENvbGxlY3Rpb25zLm1hcChjID0+IGMgPT09IHRvUmVwbGFjZSA/IGNvbGxlY3Rpb24gOiBjKSwgdW5kZWZpbmVkKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fY29sbGVjdGlvbnMuc2V0KFsuLi5jdXJyZW50Q29sbGVjdGlvbnMsIGNvbGxlY3Rpb25dLCB1bmRlZmluZWQpO1xuXHRcdH1cblxuXHRcdHJldHVybiB7XG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IGN1cnJlbnRDb2xsZWN0aW9ucyA9IHRoaXMuX2NvbGxlY3Rpb25zLmdldCgpO1xuXHRcdFx0XHR0aGlzLl9jb2xsZWN0aW9ucy5zZXQoY3VycmVudENvbGxlY3Rpb25zLmZpbHRlcihjID0+IGMgIT09IGNvbGxlY3Rpb24pLCB1bmRlZmluZWQpO1xuXHRcdFx0fVxuXHRcdH07XG5cdH1cblxuXHRwdWJsaWMgY29sbGVjdGlvblRvb2xQcmVmaXgoY29sbGVjdGlvbjogTWNwQ29sbGVjdGlvblJlZmVyZW5jZSk6IElPYnNlcnZhYmxlPHN0cmluZz4ge1xuXHRcdHJldHVybiB0aGlzLl9jb2xsZWN0aW9uVG9QcmVmaXhlcy5tYXAocCA9PiBwW2NvbGxlY3Rpb24uaWRdID8/ICcnKTtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBkaXNjb3ZlckNvbGxlY3Rpb25zKCk6IFByb21pc2U8TWNwQ29sbGVjdGlvbkRlZmluaXRpb25bXT4ge1xuXHRcdGNvbnN0IHRvRGlzY292ZXIgPSB0aGlzLl9jb2xsZWN0aW9ucy5nZXQoKS5maWx0ZXIoYyA9PiBjLmxhenkgJiYgIWMubGF6eS5pc0NhY2hlZCk7XG5cblx0XHR0aGlzLl9vbmdvaW5nTGF6eUFjdGl2YXRpb25zLnNldCh0aGlzLl9vbmdvaW5nTGF6eUFjdGl2YXRpb25zLmdldCgpICsgMSwgdW5kZWZpbmVkKTtcblx0XHRhd2FpdCBQcm9taXNlLmFsbCh0b0Rpc2NvdmVyLm1hcChjID0+IGMubGF6eT8ubG9hZCgpKSkuZmluYWxseSgoKSA9PiB7XG5cdFx0XHR0aGlzLl9vbmdvaW5nTGF6eUFjdGl2YXRpb25zLnNldCh0aGlzLl9vbmdvaW5nTGF6eUFjdGl2YXRpb25zLmdldCgpIC0gMSwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGZvdW5kOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbltdID0gW107XG5cdFx0Y29uc3QgY3VycmVudCA9IHRoaXMuX2NvbGxlY3Rpb25zLmdldCgpO1xuXHRcdGZvciAoY29uc3QgY29sbGVjdGlvbiBvZiB0b0Rpc2NvdmVyKSB7XG5cdFx0XHRjb25zdCByZWMgPSBjdXJyZW50LmZpbmQoYyA9PiBjLmlkID09PSBjb2xsZWN0aW9uLmlkKTtcblx0XHRcdGlmICghcmVjKSB7XG5cdFx0XHRcdC8vIGlnbm9yZWRcblx0XHRcdH0gZWxzZSBpZiAocmVjLmxhenkpIHtcblx0XHRcdFx0cmVjLmxhenkucmVtb3ZlZD8uKCk7IC8vIGRpZCBub3QgZ2V0IHJlcGxhY2VkIGJ5IHRoZSBub24tbGF6eSB2ZXJzaW9uXG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3VuZC5wdXNoKHJlYyk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cblx0XHRyZXR1cm4gZm91bmQ7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRJbnB1dFN0b3JhZ2Uoc2NvcGU6IFN0b3JhZ2VTY29wZSk6IE1jcFJlZ2lzdHJ5SW5wdXRTdG9yYWdlIHtcblx0XHRyZXR1cm4gc2NvcGUgPT09IFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UgPyB0aGlzLl93b3Jrc3BhY2VTdG9yYWdlLnZhbHVlIDogdGhpcy5fcHJvZmlsZVN0b3JhZ2UudmFsdWU7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRJbnB1dFN0b3JhZ2VJbkNvbmZpZ1RhcmdldChjb25maWdUYXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQpOiBNY3BSZWdpc3RyeUlucHV0U3RvcmFnZSB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldElucHV0U3RvcmFnZShcblx0XHRcdGNvbmZpZ1RhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UgfHwgY29uZmlnVGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRV9GT0xERVJcblx0XHRcdFx0PyBTdG9yYWdlU2NvcGUuV09SS1NQQUNFXG5cdFx0XHRcdDogU3RvcmFnZVNjb3BlLlBST0ZJTEVcblx0XHQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGNsZWFyU2F2ZWRJbnB1dHMoc2NvcGU6IFN0b3JhZ2VTY29wZSwgaW5wdXRJZD86IHN0cmluZykge1xuXHRcdGNvbnN0IHN0b3JhZ2UgPSB0aGlzLl9nZXRJbnB1dFN0b3JhZ2Uoc2NvcGUpO1xuXHRcdGlmIChpbnB1dElkKSB7XG5cdFx0XHRhd2FpdCBzdG9yYWdlLmNsZWFyKGlucHV0SWQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzdG9yYWdlLmNsZWFyQWxsKCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnB1dHMuZmlyZSgpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIGVkaXRTYXZlZElucHV0KGlucHV0SWQ6IHN0cmluZywgZm9sZGVyRGF0YTogSVdvcmtzcGFjZUZvbGRlckRhdGEgfCB1bmRlZmluZWQsIGNvbmZpZ1NlY3Rpb246IHN0cmluZywgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0KTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc3RvcmFnZSA9IHRoaXMuX2dldElucHV0U3RvcmFnZUluQ29uZmlnVGFyZ2V0KHRhcmdldCk7XG5cdFx0Y29uc3QgZXhwciA9IENvbmZpZ3VyYXRpb25SZXNvbHZlckV4cHJlc3Npb24ucGFyc2UoaW5wdXRJZCk7XG5cblx0XHRjb25zdCBzdG9yZWQgPSBhd2FpdCBzdG9yYWdlLmdldE1hcCgpO1xuXHRcdGNvbnN0IHByZXZpb3VzID0gc3RvcmVkW2lucHV0SWRdLnZhbHVlO1xuXHRcdGF3YWl0IHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2ZVdpdGhJbnRlcmFjdGlvbihmb2xkZXJEYXRhLCBleHByLCBjb25maWdTZWN0aW9uLCBwcmV2aW91cyA/IHsgW2lucHV0SWQuc2xpY2UoMiwgLTEpXTogcHJldmlvdXMgfSA6IHt9LCB0YXJnZXQpO1xuXHRcdGF3YWl0IHRoaXMuX3VwZGF0ZVN0b3JhZ2VXaXRoRXhwcmVzc2lvbklucHV0cyhzdG9yYWdlLCBleHByKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRTYXZlZElucHV0cyhzY29wZTogU3RvcmFnZVNjb3BlKTogUHJvbWlzZTx7IFtpZDogc3RyaW5nXTogSVJlc29sdmVkVmFsdWUgfT4ge1xuXHRcdHJldHVybiB0aGlzLl9nZXRJbnB1dFN0b3JhZ2Uoc2NvcGUpLmdldE1hcCgpO1xuXHR9XG5cblx0cHVibGljIHJlc2V0VHJ1c3QoKTogdm9pZCB7XG5cdFx0dGhpcy5fdHJ1c3RNZW1lbnRvLnZhbHVlLnNldCh7fSwgdW5kZWZpbmVkKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUcnVzdChjb2xsZWN0aW9uUmVmOiBNY3BDb2xsZWN0aW9uUmVmZXJlbmNlKTogSU9ic2VydmFibGU8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiBkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBjb2xsZWN0aW9uID0gdGhpcy5fY29sbGVjdGlvbnMucmVhZChyZWFkZXIpLmZpbmQoYyA9PiBjLmlkID09PSBjb2xsZWN0aW9uUmVmLmlkKTtcblx0XHRcdGlmICghY29sbGVjdGlvbiB8fCBjb2xsZWN0aW9uLmlzVHJ1c3RlZEJ5RGVmYXVsdCkge1xuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbWVtZW50byA9IHRoaXMuX3RydXN0TWVtZW50by52YWx1ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRyZXR1cm4gbWVtZW50by5oYXNPd25Qcm9wZXJ0eShjb2xsZWN0aW9uLmlkKSA/IG1lbWVudG9bY29sbGVjdGlvbi5pZF0gOiB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9wcm9tcHRGb3JUcnVzdChjb2xsZWN0aW9uOiBNY3BDb2xsZWN0aW9uRGVmaW5pdGlvbik6IFByb21pc2U8Ym9vbGVhbiB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIENvbGxlY3QgYWxsIHRydXN0IHByb21wdHMgZm9yIGEgc2luZ2xlIGNvbmZpZyBzbyB0aGF0IGNvbmN1cnJlbnRseSB0cnlpbmcgdG8gc3RhcnQgTlxuXHRcdC8vIHNlcnZlcnMgaW4gYSBjb25maWcgZG9uJ3QgcmVzdWx0IGluIE4gZGlmZmVyZW50IGRpYWxvZ3Ncblx0XHRsZXQgcmVzdWx0UHJvbWlzZSA9IHRoaXMuX3RydXN0UHJvbXB0cy5nZXQoY29sbGVjdGlvbi5pZCk7XG5cdFx0cmVzdWx0UHJvbWlzZSA/Pz0gdGhpcy5fcHJvbXB0Rm9yVHJ1c3RPcGVuRGlhbG9nKGNvbGxlY3Rpb24pLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0dGhpcy5fdHJ1c3RQcm9tcHRzLmRlbGV0ZShjb2xsZWN0aW9uLmlkKTtcblx0XHR9KTtcblx0XHR0aGlzLl90cnVzdFByb21wdHMuc2V0KGNvbGxlY3Rpb24uaWQsIHJlc3VsdFByb21pc2UpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdFByb21pc2U7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9wcm9tcHRGb3JUcnVzdE9wZW5EaWFsb2coY29sbGVjdGlvbjogTWNwQ29sbGVjdGlvbkRlZmluaXRpb24pOiBQcm9taXNlPGJvb2xlYW4gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBvcmlnaW5VUkkgPSBjb2xsZWN0aW9uLnByZXNlbnRhdGlvbj8ub3JpZ2luO1xuXHRcdGNvbnN0IGxhYmVsV2l0aE9yaWdpbiA9IG9yaWdpblVSSSA/IGBbXFxgJHtiYXNlbmFtZShvcmlnaW5VUkkpfVxcYF0oJHtvcmlnaW5VUkl9KWAgOiBjb2xsZWN0aW9uLmxhYmVsO1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgdGhpcy5fZGlhbG9nU2VydmljZS5wcm9tcHQoXG5cdFx0XHR7XG5cdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKCd0cnVzdFRpdGxlV2l0aE9yaWdpbicsICdUcnVzdCBNQ1Agc2VydmVycyBmcm9tIHswfT8nLCBjb2xsZWN0aW9uLmxhYmVsKSxcblx0XHRcdFx0Y3VzdG9tOiB7XG5cdFx0XHRcdFx0bWFya2Rvd25EZXRhaWxzOiBbe1xuXHRcdFx0XHRcdFx0bWFya2Rvd246IG5ldyBNYXJrZG93blN0cmluZyhsb2NhbGl6ZSgnbWNwLnRydXN0LmRldGFpbHMnLCAnezB9IGRpc2NvdmVyZWQgTW9kZWwgQ29udGV4dCBQcm90b2NvbCBzZXJ2ZXJzIGZyb20gezF9IChgezJ9YCkuIHswfSBjYW4gdXNlIHRoZWlyIGNhcGFiaWxpdGllcyBpbiBDaGF0LlxcblxcbkRvIHlvdSB3YW50IHRvIGFsbG93IHJ1bm5pbmcgTUNQIHNlcnZlcnMgZnJvbSB7M30/JywgdGhpcy5fcHJvZHVjdFNlcnZpY2UubmFtZVNob3J0LCBjb2xsZWN0aW9uLmxhYmVsLCBjb2xsZWN0aW9uLnNlcnZlckRlZmluaXRpb25zLmdldCgpLm1hcChzID0+IHMubGFiZWwpLmpvaW4oJ2AsIGAnKSwgbGFiZWxXaXRoT3JpZ2luKSksXG5cdFx0XHRcdFx0XHRkaXNtaXNzT25MaW5rQ2xpY2s6IHRydWUsXG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSxcblx0XHRcdFx0YnV0dG9uczogW1xuXHRcdFx0XHRcdHsgbGFiZWw6IGxvY2FsaXplKCdtY3AudHJ1c3QueWVzJywgJ1RydXN0JyksIHJ1bjogKCkgPT4gdHJ1ZSB9LFxuXHRcdFx0XHRcdHsgbGFiZWw6IGxvY2FsaXplKCdtY3AudHJ1c3Qubm8nLCAnRG8gbm90IHRydXN0JyksIHJ1bjogKCkgPT4gZmFsc2UgfVxuXHRcdFx0XHRdLFxuXHRcdFx0fSxcblx0XHQpO1xuXG5cdFx0cmV0dXJuIHJlc3VsdC5yZXN1bHQ7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF91cGRhdGVTdG9yYWdlV2l0aEV4cHJlc3Npb25JbnB1dHMoaW5wdXRTdG9yYWdlOiBNY3BSZWdpc3RyeUlucHV0U3RvcmFnZSwgZXhwcjogQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbjx1bmtub3duPik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHNlY3JldHM6IFJlY29yZDxzdHJpbmcsIElSZXNvbHZlZFZhbHVlPiA9IHt9O1xuXHRcdGNvbnN0IGlucHV0czogUmVjb3JkPHN0cmluZywgSVJlc29sdmVkVmFsdWU+ID0ge307XG5cdFx0Zm9yIChjb25zdCBbcmVwbGFjZW1lbnQsIHJlc29sdmVkXSBvZiBleHByLnJlc29sdmVkKCkpIHtcblx0XHRcdGlmIChyZXNvbHZlZC5pbnB1dD8udHlwZSA9PT0gJ3Byb21wdFN0cmluZycgJiYgcmVzb2x2ZWQuaW5wdXQucGFzc3dvcmQpIHtcblx0XHRcdFx0c2VjcmV0c1tyZXBsYWNlbWVudC5pZF0gPSByZXNvbHZlZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGlucHV0c1tyZXBsYWNlbWVudC5pZF0gPSByZXNvbHZlZDtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpbnB1dFN0b3JhZ2Uuc2V0UGxhaW5UZXh0KGlucHV0cyk7XG5cdFx0YXdhaXQgaW5wdXRTdG9yYWdlLnNldFNlY3JldHMoc2VjcmV0cyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VJbnB1dHMuZmlyZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVwbGFjZVZhcmlhYmxlc0luTGF1bmNoKGRlZmluaXRpb246IE1jcFNlcnZlckRlZmluaXRpb24sIGxhdW5jaDogTWNwU2VydmVyTGF1bmNoKSB7XG5cdFx0aWYgKCFkZWZpbml0aW9uLnZhcmlhYmxlUmVwbGFjZW1lbnQpIHtcblx0XHRcdHJldHVybiBsYXVuY2g7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBzZWN0aW9uLCB0YXJnZXQsIGZvbGRlciB9ID0gZGVmaW5pdGlvbi52YXJpYWJsZVJlcGxhY2VtZW50O1xuXHRcdGNvbnN0IGlucHV0U3RvcmFnZSA9IHRoaXMuX2dldElucHV0U3RvcmFnZUluQ29uZmlnVGFyZ2V0KHRhcmdldCk7XG5cdFx0Y29uc3QgcHJldmlvdXNseVN0b3JlZCA9IGF3YWl0IGlucHV0U3RvcmFnZS5nZXRNYXAoKTtcblxuXHRcdC8vIHByZS1maWxsIHRoZSB2YXJpYWJsZXMgd2UgYWxyZWFkeSByZXNvbHZlZCB0byBhdm9pZCBleHRyYSBwcm9tcHRpbmdcblx0XHRjb25zdCBleHByID0gQ29uZmlndXJhdGlvblJlc29sdmVyRXhwcmVzc2lvbi5wYXJzZShsYXVuY2gpO1xuXHRcdGZvciAoY29uc3QgcmVwbGFjZW1lbnQgb2YgZXhwci51bnJlc29sdmVkKCkpIHtcblx0XHRcdGlmIChwcmV2aW91c2x5U3RvcmVkLmhhc093blByb3BlcnR5KHJlcGxhY2VtZW50LmlkKSkge1xuXHRcdFx0XHRleHByLnJlc29sdmUocmVwbGFjZW1lbnQsIHByZXZpb3VzbHlTdG9yZWRbcmVwbGFjZW1lbnQuaWRdKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyByZXNvbHZlIHZhcmlhYmxlcyByZXF1aXJpbmcgdXNlciBpbnB1dFxuXHRcdGF3YWl0IHRoaXMuX2NvbmZpZ3VyYXRpb25SZXNvbHZlclNlcnZpY2UucmVzb2x2ZVdpdGhJbnRlcmFjdGlvbihmb2xkZXIsIGV4cHIsIHNlY3Rpb24sIHVuZGVmaW5lZCwgdGFyZ2V0KTtcblxuXHRcdGF3YWl0IHRoaXMuX3VwZGF0ZVN0b3JhZ2VXaXRoRXhwcmVzc2lvbklucHV0cyhpbnB1dFN0b3JhZ2UsIGV4cHIpO1xuXG5cdFx0Ly8gcmVzb2x2ZSBvdGhlciBub24taW50ZXJhY3RpdmUgdmFyaWFibGVzLCByZXR1cm5pbmcgdGhlIGZpbmFsIG9iamVjdFxuXHRcdHJldHVybiBhd2FpdCB0aGlzLl9jb25maWd1cmF0aW9uUmVzb2x2ZXJTZXJ2aWNlLnJlc29sdmVBc3luYyhmb2xkZXIsIGV4cHIpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJlc29sdmVDb25uZWN0aW9uKHsgY29sbGVjdGlvblJlZiwgZGVmaW5pdGlvblJlZiwgZm9yY2VUcnVzdCwgbG9nZ2VyIH06IElNY3BSZXNvbHZlQ29ubmVjdGlvbk9wdGlvbnMpOiBQcm9taXNlPElNY3BTZXJ2ZXJDb25uZWN0aW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX2NvbGxlY3Rpb25zLmdldCgpLmZpbmQoYyA9PiBjLmlkID09PSBjb2xsZWN0aW9uUmVmLmlkKTtcblx0XHRjb25zdCBkZWZpbml0aW9uID0gY29sbGVjdGlvbj8uc2VydmVyRGVmaW5pdGlvbnMuZ2V0KCkuZmluZChzID0+IHMuaWQgPT09IGRlZmluaXRpb25SZWYuaWQpO1xuXHRcdGlmICghY29sbGVjdGlvbiB8fCAhZGVmaW5pdGlvbikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDb2xsZWN0aW9uIG9yIGRlZmluaXRpb24gbm90IGZvdW5kIGZvciAke2NvbGxlY3Rpb25SZWYuaWR9IGFuZCAke2RlZmluaXRpb25SZWYuaWR9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZGVsZWdhdGUgPSB0aGlzLl9kZWxlZ2F0ZXMuZmluZChkID0+IGQuY2FuU3RhcnQoY29sbGVjdGlvbiwgZGVmaW5pdGlvbikpO1xuXHRcdGlmICghZGVsZWdhdGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignTm8gZGVsZWdhdGUgZm91bmQgdGhhdCBjYW4gaGFuZGxlIHRoZSBjb25uZWN0aW9uJyk7XG5cdFx0fVxuXG5cdFx0aWYgKCFjb2xsZWN0aW9uLmlzVHJ1c3RlZEJ5RGVmYXVsdCkge1xuXHRcdFx0Y29uc3QgbWVtZW50byA9IHRoaXMuX3RydXN0TWVtZW50by52YWx1ZS5nZXQoKTtcblx0XHRcdGNvbnN0IHRydXN0ZWQgPSBtZW1lbnRvLmhhc093blByb3BlcnR5KGNvbGxlY3Rpb24uaWQpID8gbWVtZW50b1tjb2xsZWN0aW9uLmlkXSA6IHVuZGVmaW5lZDtcblxuXHRcdFx0aWYgKHRydXN0ZWQpIHtcblx0XHRcdFx0Ly8gY29udGludWVcblx0XHRcdH0gZWxzZSBpZiAodHJ1c3RlZCA9PT0gdW5kZWZpbmVkIHx8IGZvcmNlVHJ1c3QpIHtcblx0XHRcdFx0Y29uc3QgdHJ1c3RWYWx1ZSA9IGF3YWl0IHRoaXMuX3Byb21wdEZvclRydXN0KGNvbGxlY3Rpb24pO1xuXHRcdFx0XHRpZiAodHJ1c3RWYWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fdHJ1c3RNZW1lbnRvLnZhbHVlLnNldCh7IC4uLm1lbWVudG8sIFtjb2xsZWN0aW9uLmlkXTogdHJ1c3RWYWx1ZSB9LCB1bmRlZmluZWQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICghdHJ1c3RWYWx1ZSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIC8qKiB0cnVzdGVkID09PSBmYWxzZSAmJiAhZm9yY2VUcnVzdCAqLyB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0bGV0IGxhdW5jaDogTWNwU2VydmVyTGF1bmNoIHwgdW5kZWZpbmVkO1xuXHRcdHRyeSB7XG5cdFx0XHRsYXVuY2ggPSBhd2FpdCB0aGlzLl9yZXBsYWNlVmFyaWFibGVzSW5MYXVuY2goZGVmaW5pdGlvbiwgZGVmaW5pdGlvbi5sYXVuY2gpO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2Uubm90aWZ5KHtcblx0XHRcdFx0c2V2ZXJpdHk6IFNldmVyaXR5LkVycm9yLFxuXHRcdFx0XHRtZXNzYWdlOiBsb2NhbGl6ZSgnbWNwLmxhdW5jaEVycm9yJywgJ0Vycm9yIHN0YXJ0aW5nIHswfTogezF9JywgZGVmaW5pdGlvbi5sYWJlbCwgU3RyaW5nKGUpKSxcblx0XHRcdFx0YWN0aW9uczoge1xuXHRcdFx0XHRcdHByaW1hcnk6IGNvbGxlY3Rpb24ucHJlc2VudGF0aW9uPy5vcmlnaW4gJiYgW1xuXHRcdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0XHRpZDogJ21jcC5sYXVuY2hFcnJvci5vcGVuQ29uZmlnJyxcblx0XHRcdFx0XHRcdFx0Y2xhc3M6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRcdFx0ZW5hYmxlZDogdHJ1ZSxcblx0XHRcdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0XHRcdGxhYmVsOiBsb2NhbGl6ZSgnbWNwLmxhdW5jaEVycm9yLm9wZW5Db25maWcnLCAnT3BlbiBDb25maWd1cmF0aW9uJyksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5fZWRpdG9yU2VydmljZS5vcGVuRWRpdG9yKHtcblx0XHRcdFx0XHRcdFx0XHRyZXNvdXJjZTogY29sbGVjdGlvbi5wcmVzZW50YXRpb24hLm9yaWdpbixcblx0XHRcdFx0XHRcdFx0XHRvcHRpb25zOiB7IHNlbGVjdGlvbjogZGVmaW5pdGlvbi5wcmVzZW50YXRpb24/Lm9yaWdpbj8ucmFuZ2UgfVxuXHRcdFx0XHRcdFx0XHR9KSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRdXG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShcblx0XHRcdE1jcFNlcnZlckNvbm5lY3Rpb24sXG5cdFx0XHRjb2xsZWN0aW9uLFxuXHRcdFx0ZGVmaW5pdGlvbixcblx0XHRcdGRlbGVnYXRlLFxuXHRcdFx0bGF1bmNoLFxuXHRcdFx0bG9nZ2VyLFxuXHRcdCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsc0JBQXNCO0FBQy9C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
