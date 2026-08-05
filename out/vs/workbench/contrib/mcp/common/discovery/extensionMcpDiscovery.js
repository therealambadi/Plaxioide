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
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { observableValue } from "../../../../../base/common/observable.js";
import { isFalsyOrWhitespace } from "../../../../../base/common/strings.js";
import { localize } from "../../../../../nls.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../../platform/storage/common/storage.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { mcpActivationEvent, mcpContributionPoint } from "../mcpConfiguration.js";
import { IMcpRegistry } from "../mcpRegistryTypes.js";
import { extensionPrefixedIdentifier, McpServerDefinition } from "../mcpTypes.js";
const cacheKey = "mcp.extCachedServers";
const _mcpExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint(mcpContributionPoint);
let ExtensionMcpDiscovery = class extends Disposable {
  constructor(_mcpRegistry, storageService, _extensionService) {
    super();
    this._mcpRegistry = _mcpRegistry;
    this._extensionService = _extensionService;
    this._extensionCollectionIdsToPersist = /* @__PURE__ */ new Set();
    this.cachedServers = storageService.getObject(cacheKey, StorageScope.WORKSPACE, {});
    this._register(storageService.onWillSaveState(() => {
      let updated = false;
      for (const collectionId of this._extensionCollectionIdsToPersist) {
        const collection = this._mcpRegistry.collections.get().find((c) => c.id === collectionId);
        if (!collection || collection.lazy) {
          continue;
        }
        const defs = collection.serverDefinitions.get();
        if (defs) {
          updated = true;
          this.cachedServers[collectionId] = { servers: defs.map(McpServerDefinition.toSerialized) };
        }
      }
      if (updated) {
        storageService.store(cacheKey, this.cachedServers, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    }));
  }
  start() {
    const extensionCollections = this._register(new DisposableMap());
    this._register(_mcpExtensionPoint.setHandler((_extensions, delta) => {
      const { added, removed } = delta;
      for (const collections of removed) {
        for (const coll of collections.value) {
          extensionCollections.deleteAndDispose(extensionPrefixedIdentifier(collections.description.identifier, coll.id));
        }
      }
      for (const collections of added) {
        if (!ExtensionMcpDiscovery._validate(collections)) {
          continue;
        }
        for (const coll of collections.value) {
          const id = extensionPrefixedIdentifier(collections.description.identifier, coll.id);
          this._extensionCollectionIdsToPersist.add(id);
          const serverDefs = this.cachedServers.hasOwnProperty(id) ? this.cachedServers[id].servers : void 0;
          const dispo = this._mcpRegistry.registerCollection({
            id,
            label: coll.label,
            remoteAuthority: null,
            isTrustedByDefault: true,
            scope: StorageScope.WORKSPACE,
            serverDefinitions: observableValue(this, serverDefs?.map(McpServerDefinition.fromSerialized) || []),
            lazy: {
              isCached: !!serverDefs,
              load: () => this._activateExtensionServers(coll.id),
              removed: () => extensionCollections.deleteAndDispose(id)
            }
          });
          extensionCollections.set(id, dispo);
        }
      }
    }));
  }
  async _activateExtensionServers(collectionId) {
    await this._extensionService.activateByEvent(mcpActivationEvent(collectionId));
    await Promise.all(this._mcpRegistry.delegates.map((r) => r.waitForInitialProviderPromises()));
  }
  static _validate(user) {
    if (!Array.isArray(user.value)) {
      user.collector.error(localize("invalidData", "Expected an array of MCP collections"));
      return false;
    }
    for (const contribution of user.value) {
      if (typeof contribution.id !== "string" || isFalsyOrWhitespace(contribution.id)) {
        user.collector.error(localize("invalidId", "Expected 'id' to be a non-empty string."));
        return false;
      }
      if (typeof contribution.label !== "string" || isFalsyOrWhitespace(contribution.label)) {
        user.collector.error(localize("invalidLabel", "Expected 'label' to be a non-empty string."));
        return false;
      }
    }
    return true;
  }
};
ExtensionMcpDiscovery = __decorateClass([
  __decorateParam(0, IMcpRegistry),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IExtensionService)
], ExtensionMcpDiscovery);
export {
  ExtensionMcpDiscovery
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL2Rpc2NvdmVyeS9leHRlbnNpb25NY3BEaXNjb3ZlcnkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgaXNGYWxzeU9yV2hpdGVzcGFjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSU1jcENvbGxlY3Rpb25Db250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0ICogYXMgZXh0ZW5zaW9uc1JlZ2lzdHJ5IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBtY3BBY3RpdmF0aW9uRXZlbnQsIG1jcENvbnRyaWJ1dGlvblBvaW50IH0gZnJvbSAnLi4vbWNwQ29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWNwUmVnaXN0cnkgfSBmcm9tICcuLi9tY3BSZWdpc3RyeVR5cGVzLmpzJztcbmltcG9ydCB7IGV4dGVuc2lvblByZWZpeGVkSWRlbnRpZmllciwgTWNwU2VydmVyRGVmaW5pdGlvbiB9IGZyb20gJy4uL21jcFR5cGVzLmpzJztcbmltcG9ydCB7IElNY3BEaXNjb3ZlcnkgfSBmcm9tICcuL21jcERpc2NvdmVyeS5qcyc7XG5cbmNvbnN0IGNhY2hlS2V5ID0gJ21jcC5leHRDYWNoZWRTZXJ2ZXJzJztcblxuaW50ZXJmYWNlIElTZXJ2ZXJDYWNoZUVudHJ5IHtcblx0cmVhZG9ubHkgc2VydmVyczogcmVhZG9ubHkgTWNwU2VydmVyRGVmaW5pdGlvbi5TZXJpYWxpemVkW107XG59XG5cbmNvbnN0IF9tY3BFeHRlbnNpb25Qb2ludCA9IGV4dGVuc2lvbnNSZWdpc3RyeS5FeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludChtY3BDb250cmlidXRpb25Qb2ludCk7XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25NY3BEaXNjb3ZlcnkgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU1jcERpc2NvdmVyeSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbkNvbGxlY3Rpb25JZHNUb1BlcnNpc3QgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBjYWNoZWRTZXJ2ZXJzOiB7IFtjb2xsY2V0aW9uSWQ6IHN0cmluZ106IElTZXJ2ZXJDYWNoZUVudHJ5IH07XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElNY3BSZWdpc3RyeSBwcml2YXRlIHJlYWRvbmx5IF9tY3BSZWdpc3RyeTogSU1jcFJlZ2lzdHJ5LFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5jYWNoZWRTZXJ2ZXJzID0gc3RvcmFnZVNlcnZpY2UuZ2V0T2JqZWN0KGNhY2hlS2V5LCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCB7fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihzdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoKCkgPT4ge1xuXHRcdFx0bGV0IHVwZGF0ZWQgPSBmYWxzZTtcblx0XHRcdGZvciAoY29uc3QgY29sbGVjdGlvbklkIG9mIHRoaXMuX2V4dGVuc2lvbkNvbGxlY3Rpb25JZHNUb1BlcnNpc3QpIHtcblx0XHRcdFx0Y29uc3QgY29sbGVjdGlvbiA9IHRoaXMuX21jcFJlZ2lzdHJ5LmNvbGxlY3Rpb25zLmdldCgpLmZpbmQoYyA9PiBjLmlkID09PSBjb2xsZWN0aW9uSWQpO1xuXHRcdFx0XHRpZiAoIWNvbGxlY3Rpb24gfHwgY29sbGVjdGlvbi5sYXp5KSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCBkZWZzID0gY29sbGVjdGlvbi5zZXJ2ZXJEZWZpbml0aW9ucy5nZXQoKTtcblx0XHRcdFx0aWYgKGRlZnMpIHtcblx0XHRcdFx0XHR1cGRhdGVkID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmNhY2hlZFNlcnZlcnNbY29sbGVjdGlvbklkXSA9IHsgc2VydmVyczogZGVmcy5tYXAoTWNwU2VydmVyRGVmaW5pdGlvbi50b1NlcmlhbGl6ZWQpIH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKHVwZGF0ZWQpIHtcblx0XHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUoY2FjaGVLZXksIHRoaXMuY2FjaGVkU2VydmVycywgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwdWJsaWMgc3RhcnQoKTogdm9pZCB7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uQ29sbGVjdGlvbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxzdHJpbmc+KCkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9tY3BFeHRlbnNpb25Qb2ludC5zZXRIYW5kbGVyKChfZXh0ZW5zaW9ucywgZGVsdGEpID0+IHtcblx0XHRcdGNvbnN0IHsgYWRkZWQsIHJlbW92ZWQgfSA9IGRlbHRhO1xuXG5cdFx0XHRmb3IgKGNvbnN0IGNvbGxlY3Rpb25zIG9mIHJlbW92ZWQpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBjb2xsIG9mIGNvbGxlY3Rpb25zLnZhbHVlKSB7XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uQ29sbGVjdGlvbnMuZGVsZXRlQW5kRGlzcG9zZShleHRlbnNpb25QcmVmaXhlZElkZW50aWZpZXIoY29sbGVjdGlvbnMuZGVzY3JpcHRpb24uaWRlbnRpZmllciwgY29sbC5pZCkpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgY29sbGVjdGlvbnMgb2YgYWRkZWQpIHtcblxuXHRcdFx0XHRpZiAoIUV4dGVuc2lvbk1jcERpc2NvdmVyeS5fdmFsaWRhdGUoY29sbGVjdGlvbnMpKSB7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRmb3IgKGNvbnN0IGNvbGwgb2YgY29sbGVjdGlvbnMudmFsdWUpIHtcblx0XHRcdFx0XHRjb25zdCBpZCA9IGV4dGVuc2lvblByZWZpeGVkSWRlbnRpZmllcihjb2xsZWN0aW9ucy5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBjb2xsLmlkKTtcblx0XHRcdFx0XHR0aGlzLl9leHRlbnNpb25Db2xsZWN0aW9uSWRzVG9QZXJzaXN0LmFkZChpZCk7XG5cblx0XHRcdFx0XHRjb25zdCBzZXJ2ZXJEZWZzID0gdGhpcy5jYWNoZWRTZXJ2ZXJzLmhhc093blByb3BlcnR5KGlkKSA/IHRoaXMuY2FjaGVkU2VydmVyc1tpZF0uc2VydmVycyA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBkaXNwbyA9IHRoaXMuX21jcFJlZ2lzdHJ5LnJlZ2lzdGVyQ29sbGVjdGlvbih7XG5cdFx0XHRcdFx0XHRpZCxcblx0XHRcdFx0XHRcdGxhYmVsOiBjb2xsLmxhYmVsLFxuXHRcdFx0XHRcdFx0cmVtb3RlQXV0aG9yaXR5OiBudWxsLFxuXHRcdFx0XHRcdFx0aXNUcnVzdGVkQnlEZWZhdWx0OiB0cnVlLFxuXHRcdFx0XHRcdFx0c2NvcGU6IFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UsXG5cdFx0XHRcdFx0XHRzZXJ2ZXJEZWZpbml0aW9uczogb2JzZXJ2YWJsZVZhbHVlPE1jcFNlcnZlckRlZmluaXRpb25bXT4odGhpcywgc2VydmVyRGVmcz8ubWFwKE1jcFNlcnZlckRlZmluaXRpb24uZnJvbVNlcmlhbGl6ZWQpIHx8IFtdKSxcblx0XHRcdFx0XHRcdGxhenk6IHtcblx0XHRcdFx0XHRcdFx0aXNDYWNoZWQ6ICEhc2VydmVyRGVmcyxcblx0XHRcdFx0XHRcdFx0bG9hZDogKCkgPT4gdGhpcy5fYWN0aXZhdGVFeHRlbnNpb25TZXJ2ZXJzKGNvbGwuaWQpLFxuXHRcdFx0XHRcdFx0XHRyZW1vdmVkOiAoKSA9PiBleHRlbnNpb25Db2xsZWN0aW9ucy5kZWxldGVBbmREaXNwb3NlKGlkKSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblxuXHRcdFx0XHRcdGV4dGVuc2lvbkNvbGxlY3Rpb25zLnNldChpZCwgZGlzcG8pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfYWN0aXZhdGVFeHRlbnNpb25TZXJ2ZXJzKGNvbGxlY3Rpb25JZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQobWNwQWN0aXZhdGlvbkV2ZW50KGNvbGxlY3Rpb25JZCkpO1xuXHRcdGF3YWl0IFByb21pc2UuYWxsKHRoaXMuX21jcFJlZ2lzdHJ5LmRlbGVnYXRlc1xuXHRcdFx0Lm1hcChyID0+IHIud2FpdEZvckluaXRpYWxQcm92aWRlclByb21pc2VzKCkpKTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF92YWxpZGF0ZSh1c2VyOiBleHRlbnNpb25zUmVnaXN0cnkuSUV4dGVuc2lvblBvaW50VXNlcjxJTWNwQ29sbGVjdGlvbkNvbnRyaWJ1dGlvbltdPik6IGJvb2xlYW4ge1xuXG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHVzZXIudmFsdWUpKSB7XG5cdFx0XHR1c2VyLmNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnaW52YWxpZERhdGEnLCBcIkV4cGVjdGVkIGFuIGFycmF5IG9mIE1DUCBjb2xsZWN0aW9uc1wiKSk7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Zm9yIChjb25zdCBjb250cmlidXRpb24gb2YgdXNlci52YWx1ZSkge1xuXHRcdFx0aWYgKHR5cGVvZiBjb250cmlidXRpb24uaWQgIT09ICdzdHJpbmcnIHx8IGlzRmFsc3lPcldoaXRlc3BhY2UoY29udHJpYnV0aW9uLmlkKSkge1xuXHRcdFx0XHR1c2VyLmNvbGxlY3Rvci5lcnJvcihsb2NhbGl6ZSgnaW52YWxpZElkJywgXCJFeHBlY3RlZCAnaWQnIHRvIGJlIGEgbm9uLWVtcHR5IHN0cmluZy5cIikpO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRpZiAodHlwZW9mIGNvbnRyaWJ1dGlvbi5sYWJlbCAhPT0gJ3N0cmluZycgfHwgaXNGYWxzeU9yV2hpdGVzcGFjZShjb250cmlidXRpb24ubGFiZWwpKSB7XG5cdFx0XHRcdHVzZXIuY29sbGVjdG9yLmVycm9yKGxvY2FsaXplKCdpbnZhbGlkTGFiZWwnLCBcIkV4cGVjdGVkICdsYWJlbCcgdG8gYmUgYSBub24tZW1wdHkgc3RyaW5nLlwiKSk7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVkscUJBQXFCO0FBQzFDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFlBQVksd0JBQXdCO0FBQ3BDLFNBQVMsb0JBQW9CLDRCQUE0QjtBQUN6RCxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLDZCQUE2QiwyQkFBMkI7QUFHakUsTUFBTSxXQUFXO0FBTWpCLE1BQU0scUJBQXFCLG1CQUFtQixtQkFBbUIsdUJBQXVCLG9CQUFvQjtBQUVyRyxJQUFNLHdCQUFOLGNBQW9DLFdBQW9DO0FBQUEsRUFJOUUsWUFDZ0MsY0FDZCxnQkFDbUIsbUJBQ25DO0FBQ0QsVUFBTTtBQUp5QjtBQUVLO0FBTnJDLFNBQWlCLG1DQUFtQyxvQkFBSSxJQUFZO0FBU25FLFNBQUssZ0JBQWdCLGVBQWUsVUFBVSxVQUFVLGFBQWEsV0FBVyxDQUFDLENBQUM7QUFFbEYsU0FBSyxVQUFVLGVBQWUsZ0JBQWdCLE1BQU07QUFDbkQsVUFBSSxVQUFVO0FBQ2QsaUJBQVcsZ0JBQWdCLEtBQUss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
