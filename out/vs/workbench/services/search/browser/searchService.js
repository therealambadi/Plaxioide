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
import { IModelService } from "../../../../editor/common/services/model.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IEditorService } from "../../editor/common/editorService.js";
import { IExtensionService } from "../../extensions/common/extensions.js";
import { ISearchService, SearchProviderType, TextSearchCompleteMessageType } from "../common/search.js";
import { SearchService } from "../common/searchService.js";
import { IUriIdentityService } from "../../../../platform/uriIdentity/common/uriIdentity.js";
import { logOnceWebWorkerWarning } from "../../../../base/common/worker/webWorker.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { createWebWorker } from "../../../../base/browser/webWorkerFactory.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { LocalFileSearchWorkerHost } from "../common/localFileSearchWorkerTypes.js";
import { memoize } from "../../../../base/common/decorators.js";
import { FileAccess, Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter } from "../../../../base/common/event.js";
import { localize } from "../../../../nls.js";
import { WebFileSystemAccess } from "../../../../platform/files/browser/webFileSystemAccess.js";
import { revive } from "../../../../base/common/marshalling.js";
let RemoteSearchService = class extends SearchService {
  constructor(modelService, editorService, telemetryService, logService, extensionService, fileService, instantiationService, uriIdentityService) {
    super(modelService, editorService, telemetryService, logService, extensionService, fileService, uriIdentityService);
    this.instantiationService = instantiationService;
    const searchProvider = this.instantiationService.createInstance(LocalFileSearchWorkerClient);
    this.registerSearchResultProvider(Schemas.file, SearchProviderType.file, searchProvider);
    this.registerSearchResultProvider(Schemas.file, SearchProviderType.text, searchProvider);
  }
};
RemoteSearchService = __decorateClass([
  __decorateParam(0, IModelService),
  __decorateParam(1, IEditorService),
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IExtensionService),
  __decorateParam(5, IFileService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, IUriIdentityService)
], RemoteSearchService);
let LocalFileSearchWorkerClient = class extends Disposable {
  constructor(fileService, uriIdentityService) {
    super();
    this.fileService = fileService;
    this.uriIdentityService = uriIdentityService;
    this._onDidReceiveTextSearchMatch = new Emitter();
    this.onDidReceiveTextSearchMatch = this._onDidReceiveTextSearchMatch.event;
    this.queryId = 0;
    this._worker = null;
  }
  async getAIName() {
    return void 0;
  }
  sendTextSearchMatch(match, queryId) {
    this._onDidReceiveTextSearchMatch.fire({ match, queryId });
  }
  get fileSystemProvider() {
    return this.fileService.getProvider(Schemas.file);
  }
  async cancelQuery(queryId) {
    const proxy = this._getOrCreateWorker().proxy;
    proxy.$cancelQuery(queryId);
  }
  async textSearch(query, onProgress, token) {
    try {
      const queryDisposables = new DisposableStore();
      const proxy = this._getOrCreateWorker().proxy;
      const results = [];
      let limitHit = false;
      await Promise.all(query.folderQueries.map(async (fq) => {
        const queryId = this.queryId++;
        queryDisposables.add(token?.onCancellationRequested((e) => this.cancelQuery(queryId)) || Disposable.None);
        const handle = await this.fileSystemProvider.getHandle(fq.folder);
        if (!handle || !WebFileSystemAccess.isFileSystemDirectoryHandle(handle)) {
          console.error("Could not get directory handle for ", fq);
          return;
        }
        const reviveMatch = (result2) => ({
          resource: URI.revive(result2.resource),
          results: revive(result2.results)
        });
        queryDisposables.add(this.onDidReceiveTextSearchMatch((e) => {
          if (e.queryId === queryId) {
            onProgress?.(reviveMatch(e.match));
          }
        }));
        const ignorePathCasing = this.uriIdentityService.extUri.ignorePathCasing(fq.folder);
        const folderResults = await proxy.$searchDirectory(handle, query, fq, ignorePathCasing, queryId);
        for (const folderResult of folderResults.results) {
          results.push(revive(folderResult));
        }
        if (folderResults.limitHit) {
          limitHit = true;
        }
      }));
      queryDisposables.dispose();
      const result = { messages: [], results, limitHit };
      return result;
    } catch (e) {
      console.error("Error performing web worker text search", e);
      return {
        results: [],
        messages: [{
          text: localize("errorSearchText", "Unable to search with Web Worker text searcher"),
          type: TextSearchCompleteMessageType.Warning
        }]
      };
    }
  }
  async fileSearch(query, token) {
    try {
      const queryDisposables = new DisposableStore();
      let limitHit = false;
      const proxy = this._getOrCreateWorker().proxy;
      const results = [];
      await Promise.all(query.folderQueries.map(async (fq) => {
        const queryId = this.queryId++;
        queryDisposables.add(token?.onCancellationRequested((e) => this.cancelQuery(queryId)) || Disposable.None);
        const handle = await this.fileSystemProvider.getHandle(fq.folder);
        if (!handle || !WebFileSystemAccess.isFileSystemDirectoryHandle(handle)) {
          console.error("Could not get directory handle for ", fq);
          return;
        }
        const caseSensitive = this.uriIdentityService.extUri.ignorePathCasing(fq.folder);
        const folderResults = await proxy.$listDirectory(handle, query, fq, caseSensitive, queryId);
        for (const folderResult of folderResults.results) {
          results.push({ resource: URI.joinPath(fq.folder, folderResult) });
        }
        if (folderResults.limitHit) {
          limitHit = true;
        }
      }));
      queryDisposables.dispose();
      const result = { messages: [], results, limitHit };
      return result;
    } catch (e) {
      console.error("Error performing web worker file search", e);
      return {
        results: [],
        messages: [{
          text: localize("errorSearchFile", "Unable to search with Web Worker file searcher"),
          type: TextSearchCompleteMessageType.Warning
        }]
      };
    }
  }
  async clearCache(cacheKey) {
    if (this.cache?.key === cacheKey) {
      this.cache = void 0;
    }
  }
  _getOrCreateWorker() {
    if (!this._worker) {
      try {
        this._worker = this._register(createWebWorker(
          FileAccess.asBrowserUri("vs/workbench/services/search/worker/localFileSearchMain.js"),
          "LocalFileSearchWorker"
        ));
        LocalFileSearchWorkerHost.setChannel(this._worker, {
          $sendTextSearchMatch: (match, queryId) => {
            return this.sendTextSearchMatch(match, queryId);
          }
        });
      } catch (err) {
        logOnceWebWorkerWarning(err);
        throw err;
      }
    }
    return this._worker;
  }
};
__decorateClass([
  memoize
], LocalFileSearchWorkerClient.prototype, "fileSystemProvider", 1);
LocalFileSearchWorkerClient = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IUriIdentityService)
], LocalFileSearchWorkerClient);
registerSingleton(ISearchService, RemoteSearchService, InstantiationType.Delayed);
export {
  LocalFileSearchWorkerClient,
  RemoteSearchService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL2Jyb3dzZXIvc2VhcmNoU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL21vZGVsLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUZpbGVNYXRjaCwgSUZpbGVRdWVyeSwgSVNlYXJjaENvbXBsZXRlLCBJU2VhcmNoUHJvZ3Jlc3NJdGVtLCBJU2VhcmNoUmVzdWx0UHJvdmlkZXIsIElTZWFyY2hTZXJ2aWNlLCBJVGV4dFF1ZXJ5LCBTZWFyY2hQcm92aWRlclR5cGUsIFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlIH0gZnJvbSAnLi4vY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBTZWFyY2hTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL3NlYXJjaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBJV2ViV29ya2VyQ2xpZW50LCBsb2dPbmNlV2ViV29ya2VyV2FybmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3dvcmtlci93ZWJXb3JrZXIuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGNyZWF0ZVdlYldvcmtlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci93ZWJXb3JrZXJGYWN0b3J5LmpzJztcbmltcG9ydCB7IEluc3RhbnRpYXRpb25UeXBlLCByZWdpc3RlclNpbmdsZXRvbiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUxvY2FsRmlsZVNlYXJjaFdvcmtlciwgTG9jYWxGaWxlU2VhcmNoV29ya2VySG9zdCB9IGZyb20gJy4uL2NvbW1vbi9sb2NhbEZpbGVTZWFyY2hXb3JrZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZGVjb3JhdG9ycy5qcyc7XG5pbXBvcnQgeyBIVE1MRmlsZVN5c3RlbVByb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvYnJvd3Nlci9odG1sRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IEZpbGVBY2Nlc3MsIFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IFdlYkZpbGVTeXN0ZW1BY2Nlc3MgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9icm93c2VyL3dlYkZpbGVTeXN0ZW1BY2Nlc3MuanMnO1xuaW1wb3J0IHsgcmV2aXZlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFyc2hhbGxpbmcuanMnO1xuXG5leHBvcnQgY2xhc3MgUmVtb3RlU2VhcmNoU2VydmljZSBleHRlbmRzIFNlYXJjaFNlcnZpY2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1vZGVsU2VydmljZSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25TZXJ2aWNlIGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASVVyaUlkZW50aXR5U2VydmljZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKG1vZGVsU2VydmljZSwgZWRpdG9yU2VydmljZSwgdGVsZW1ldHJ5U2VydmljZSwgbG9nU2VydmljZSwgZXh0ZW5zaW9uU2VydmljZSwgZmlsZVNlcnZpY2UsIHVyaUlkZW50aXR5U2VydmljZSk7XG5cdFx0Y29uc3Qgc2VhcmNoUHJvdmlkZXIgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKExvY2FsRmlsZVNlYXJjaFdvcmtlckNsaWVudCk7XG5cdFx0dGhpcy5yZWdpc3RlclNlYXJjaFJlc3VsdFByb3ZpZGVyKFNjaGVtYXMuZmlsZSwgU2VhcmNoUHJvdmlkZXJUeXBlLmZpbGUsIHNlYXJjaFByb3ZpZGVyKTtcblx0XHR0aGlzLnJlZ2lzdGVyU2VhcmNoUmVzdWx0UHJvdmlkZXIoU2NoZW1hcy5maWxlLCBTZWFyY2hQcm92aWRlclR5cGUudGV4dCwgc2VhcmNoUHJvdmlkZXIpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBMb2NhbEZpbGVTZWFyY2hXb3JrZXJDbGllbnQgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNlYXJjaFJlc3VsdFByb3ZpZGVyIHtcblxuXHRwcm90ZWN0ZWQgX3dvcmtlcjogSVdlYldvcmtlckNsaWVudDxJTG9jYWxGaWxlU2VhcmNoV29ya2VyPiB8IG51bGw7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWNlaXZlVGV4dFNlYXJjaE1hdGNoID0gbmV3IEVtaXR0ZXI8eyBtYXRjaDogSUZpbGVNYXRjaDxVcmlDb21wb25lbnRzPjsgcXVlcnlJZDogbnVtYmVyIH0+KCk7XG5cdHJlYWRvbmx5IG9uRGlkUmVjZWl2ZVRleHRTZWFyY2hNYXRjaDogRXZlbnQ8eyBtYXRjaDogSUZpbGVNYXRjaDxVcmlDb21wb25lbnRzPjsgcXVlcnlJZDogbnVtYmVyIH0+ID0gdGhpcy5fb25EaWRSZWNlaXZlVGV4dFNlYXJjaE1hdGNoLmV2ZW50O1xuXG5cdHByaXZhdGUgY2FjaGU6IHsga2V5OiBzdHJpbmc7IGNhY2hlOiBJU2VhcmNoQ29tcGxldGUgfSB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHF1ZXJ5SWQ6IG51bWJlciA9IDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElGaWxlU2VydmljZSBwcml2YXRlIGZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElVcmlJZGVudGl0eVNlcnZpY2UgcHJpdmF0ZSB1cmlJZGVudGl0eVNlcnZpY2U6IElVcmlJZGVudGl0eVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdFx0dGhpcy5fd29ya2VyID0gbnVsbDtcblx0fVxuXG5cdGFzeW5jIGdldEFJTmFtZSgpOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRzZW5kVGV4dFNlYXJjaE1hdGNoKG1hdGNoOiBJRmlsZU1hdGNoPFVyaUNvbXBvbmVudHM+LCBxdWVyeUlkOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9vbkRpZFJlY2VpdmVUZXh0U2VhcmNoTWF0Y2guZmlyZSh7IG1hdGNoLCBxdWVyeUlkIH0pO1xuXHR9XG5cblx0QG1lbW9pemVcblx0cHJpdmF0ZSBnZXQgZmlsZVN5c3RlbVByb3ZpZGVyKCk6IEhUTUxGaWxlU3lzdGVtUHJvdmlkZXIge1xuXHRcdHJldHVybiB0aGlzLmZpbGVTZXJ2aWNlLmdldFByb3ZpZGVyKFNjaGVtYXMuZmlsZSkgYXMgSFRNTEZpbGVTeXN0ZW1Qcm92aWRlcjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgY2FuY2VsUXVlcnkocXVlcnlJZDogbnVtYmVyKSB7XG5cdFx0Y29uc3QgcHJveHkgPSB0aGlzLl9nZXRPckNyZWF0ZVdvcmtlcigpLnByb3h5O1xuXHRcdHByb3h5LiRjYW5jZWxRdWVyeShxdWVyeUlkKTtcblx0fVxuXG5cdGFzeW5jIHRleHRTZWFyY2gocXVlcnk6IElUZXh0UXVlcnksIG9uUHJvZ3Jlc3M/OiAocDogSVNlYXJjaFByb2dyZXNzSXRlbSkgPT4gdm9pZCwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVNlYXJjaENvbXBsZXRlPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHF1ZXJ5RGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRcdGNvbnN0IHByb3h5ID0gdGhpcy5fZ2V0T3JDcmVhdGVXb3JrZXIoKS5wcm94eTtcblx0XHRcdGNvbnN0IHJlc3VsdHM6IElGaWxlTWF0Y2hbXSA9IFtdO1xuXG5cdFx0XHRsZXQgbGltaXRIaXQgPSBmYWxzZTtcblxuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocXVlcnkuZm9sZGVyUXVlcmllcy5tYXAoYXN5bmMgZnEgPT4ge1xuXHRcdFx0XHRjb25zdCBxdWVyeUlkID0gdGhpcy5xdWVyeUlkKys7XG5cdFx0XHRcdHF1ZXJ5RGlzcG9zYWJsZXMuYWRkKHRva2VuPy5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZChlID0+IHRoaXMuY2FuY2VsUXVlcnkocXVlcnlJZCkpIHx8IERpc3Bvc2FibGUuTm9uZSk7XG5cblx0XHRcdFx0Y29uc3QgaGFuZGxlOiBGaWxlU3lzdGVtSGFuZGxlIHwgdW5kZWZpbmVkID0gYXdhaXQgdGhpcy5maWxlU3lzdGVtUHJvdmlkZXIuZ2V0SGFuZGxlKGZxLmZvbGRlcik7XG5cdFx0XHRcdGlmICghaGFuZGxlIHx8ICFXZWJGaWxlU3lzdGVtQWNjZXNzLmlzRmlsZVN5c3RlbURpcmVjdG9yeUhhbmRsZShoYW5kbGUpKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignQ291bGQgbm90IGdldCBkaXJlY3RvcnkgaGFuZGxlIGZvciAnLCBmcSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZm9yY2UgcmVzb3VyY2UgdG8gcmV2aXZlIHVzaW5nIFVSSS5yZXZpdmUuXG5cdFx0XHRcdC8vIFRPRE8gQGFuZHJlYSBzZWUgd2h5IHdlIGNhbid0IGp1c3QgdXNlIGByZXZpdmUoKWAgYmVsb3cuIEZvciBzb21lIHJlYXNvbiwgKDxNYXJzaGFsbGVkT2JqZWN0Pm9iaikuJG1pZCB3YXMgdW5kZWZpbmVkIGZvciByZXN1bHQucmVzb3VyY2Vcblx0XHRcdFx0Y29uc3QgcmV2aXZlTWF0Y2ggPSAocmVzdWx0OiBJRmlsZU1hdGNoPFVyaUNvbXBvbmVudHM+KTogSUZpbGVNYXRjaCA9PiAoe1xuXHRcdFx0XHRcdHJlc291cmNlOiBVUkkucmV2aXZlKHJlc3VsdC5yZXNvdXJjZSksXG5cdFx0XHRcdFx0cmVzdWx0czogcmV2aXZlKHJlc3VsdC5yZXN1bHRzKVxuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRxdWVyeURpc3Bvc2FibGVzLmFkZCh0aGlzLm9uRGlkUmVjZWl2ZVRleHRTZWFyY2hNYXRjaChlID0+IHtcblx0XHRcdFx0XHRpZiAoZS5xdWVyeUlkID09PSBxdWVyeUlkKSB7XG5cdFx0XHRcdFx0XHRvblByb2dyZXNzPy4ocmV2aXZlTWF0Y2goZS5tYXRjaCkpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdGNvbnN0IGlnbm9yZVBhdGhDYXNpbmcgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaWdub3JlUGF0aENhc2luZyhmcS5mb2xkZXIpO1xuXHRcdFx0XHRjb25zdCBmb2xkZXJSZXN1bHRzID0gYXdhaXQgcHJveHkuJHNlYXJjaERpcmVjdG9yeShoYW5kbGUsIHF1ZXJ5LCBmcSwgaWdub3JlUGF0aENhc2luZywgcXVlcnlJZCk7XG5cdFx0XHRcdGZvciAoY29uc3QgZm9sZGVyUmVzdWx0IG9mIGZvbGRlclJlc3VsdHMucmVzdWx0cykge1xuXHRcdFx0XHRcdHJlc3VsdHMucHVzaChyZXZpdmUoZm9sZGVyUmVzdWx0KSk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAoZm9sZGVyUmVzdWx0cy5saW1pdEhpdCkge1xuXHRcdFx0XHRcdGxpbWl0SGl0ID0gdHJ1ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9KSk7XG5cblx0XHRcdHF1ZXJ5RGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0geyBtZXNzYWdlczogW10sIHJlc3VsdHMsIGxpbWl0SGl0IH07XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIHBlcmZvcm1pbmcgd2ViIHdvcmtlciB0ZXh0IHNlYXJjaCcsIGUpO1xuXHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0cmVzdWx0czogW10sXG5cdFx0XHRcdG1lc3NhZ2VzOiBbe1xuXHRcdFx0XHRcdHRleHQ6IGxvY2FsaXplKCdlcnJvclNlYXJjaFRleHQnLCBcIlVuYWJsZSB0byBzZWFyY2ggd2l0aCBXZWIgV29ya2VyIHRleHQgc2VhcmNoZXJcIiksIHR5cGU6IFRleHRTZWFyY2hDb21wbGV0ZU1lc3NhZ2VUeXBlLldhcm5pbmdcblx0XHRcdFx0fV0sXG5cdFx0XHR9O1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGZpbGVTZWFyY2gocXVlcnk6IElGaWxlUXVlcnksIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElTZWFyY2hDb21wbGV0ZT4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBxdWVyeURpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0bGV0IGxpbWl0SGl0ID0gZmFsc2U7XG5cblx0XHRcdGNvbnN0IHByb3h5ID0gdGhpcy5fZ2V0T3JDcmVhdGVXb3JrZXIoKS5wcm94eTtcblx0XHRcdGNvbnN0IHJlc3VsdHM6IElGaWxlTWF0Y2hbXSA9IFtdO1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwocXVlcnkuZm9sZGVyUXVlcmllcy5tYXAoYXN5bmMgZnEgPT4ge1xuXHRcdFx0XHRjb25zdCBxdWVyeUlkID0gdGhpcy5xdWVyeUlkKys7XG5cdFx0XHRcdHF1ZXJ5RGlzcG9zYWJsZXMuYWRkKHRva2VuPy5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZChlID0+IHRoaXMuY2FuY2VsUXVlcnkocXVlcnlJZCkpIHx8IERpc3Bvc2FibGUuTm9uZSk7XG5cblx0XHRcdFx0Y29uc3QgaGFuZGxlOiBGaWxlU3lzdGVtSGFuZGxlIHwgdW5kZWZpbmVkID0gYXdhaXQgdGhpcy5maWxlU3lzdGVtUHJvdmlkZXIuZ2V0SGFuZGxlKGZxLmZvbGRlcik7XG5cdFx0XHRcdGlmICghaGFuZGxlIHx8ICFXZWJGaWxlU3lzdGVtQWNjZXNzLmlzRmlsZVN5c3RlbURpcmVjdG9yeUhhbmRsZShoYW5kbGUpKSB7XG5cdFx0XHRcdFx0Y29uc29sZS5lcnJvcignQ291bGQgbm90IGdldCBkaXJlY3RvcnkgaGFuZGxlIGZvciAnLCBmcSk7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IGNhc2VTZW5zaXRpdmUgPSB0aGlzLnVyaUlkZW50aXR5U2VydmljZS5leHRVcmkuaWdub3JlUGF0aENhc2luZyhmcS5mb2xkZXIpO1xuXHRcdFx0XHRjb25zdCBmb2xkZXJSZXN1bHRzID0gYXdhaXQgcHJveHkuJGxpc3REaXJlY3RvcnkoaGFuZGxlLCBxdWVyeSwgZnEsIGNhc2VTZW5zaXRpdmUsIHF1ZXJ5SWQpO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGZvbGRlclJlc3VsdCBvZiBmb2xkZXJSZXN1bHRzLnJlc3VsdHMpIHtcblx0XHRcdFx0XHRyZXN1bHRzLnB1c2goeyByZXNvdXJjZTogVVJJLmpvaW5QYXRoKGZxLmZvbGRlciwgZm9sZGVyUmVzdWx0KSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZm9sZGVyUmVzdWx0cy5saW1pdEhpdCkgeyBsaW1pdEhpdCA9IHRydWU7IH1cblx0XHRcdH0pKTtcblxuXHRcdFx0cXVlcnlEaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdCA9IHsgbWVzc2FnZXM6IFtdLCByZXN1bHRzLCBsaW1pdEhpdCB9O1xuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRjb25zb2xlLmVycm9yKCdFcnJvciBwZXJmb3JtaW5nIHdlYiB3b3JrZXIgZmlsZSBzZWFyY2gnLCBlKTtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJlc3VsdHM6IFtdLFxuXHRcdFx0XHRtZXNzYWdlczogW3tcblx0XHRcdFx0XHR0ZXh0OiBsb2NhbGl6ZSgnZXJyb3JTZWFyY2hGaWxlJywgXCJVbmFibGUgdG8gc2VhcmNoIHdpdGggV2ViIFdvcmtlciBmaWxlIHNlYXJjaGVyXCIpLCB0eXBlOiBUZXh0U2VhcmNoQ29tcGxldGVNZXNzYWdlVHlwZS5XYXJuaW5nXG5cdFx0XHRcdH1dLFxuXHRcdFx0fTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyBjbGVhckNhY2hlKGNhY2hlS2V5OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy5jYWNoZT8ua2V5ID09PSBjYWNoZUtleSkgeyB0aGlzLmNhY2hlID0gdW5kZWZpbmVkOyB9XG5cdH1cblxuXHRwcml2YXRlIF9nZXRPckNyZWF0ZVdvcmtlcigpOiBJV2ViV29ya2VyQ2xpZW50PElMb2NhbEZpbGVTZWFyY2hXb3JrZXI+IHtcblx0XHRpZiAoIXRoaXMuX3dvcmtlcikge1xuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dGhpcy5fd29ya2VyID0gdGhpcy5fcmVnaXN0ZXIoY3JlYXRlV2ViV29ya2VyPElMb2NhbEZpbGVTZWFyY2hXb3JrZXI+KFxuXHRcdFx0XHRcdEZpbGVBY2Nlc3MuYXNCcm93c2VyVXJpKCd2cy93b3JrYmVuY2gvc2VydmljZXMvc2VhcmNoL3dvcmtlci9sb2NhbEZpbGVTZWFyY2hNYWluLmpzJyksXG5cdFx0XHRcdFx0J0xvY2FsRmlsZVNlYXJjaFdvcmtlcidcblx0XHRcdFx0KSk7XG5cdFx0XHRcdExvY2FsRmlsZVNlYXJjaFdvcmtlckhvc3Quc2V0Q2hhbm5lbCh0aGlzLl93b3JrZXIsIHtcblx0XHRcdFx0XHQkc2VuZFRleHRTZWFyY2hNYXRjaDogKG1hdGNoLCBxdWVyeUlkKSA9PiB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5zZW5kVGV4dFNlYXJjaE1hdGNoKG1hdGNoLCBxdWVyeUlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0pO1xuXHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdGxvZ09uY2VXZWJXb3JrZXJXYXJuaW5nKGVycik7XG5cdFx0XHRcdHRocm93IGVycjtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX3dvcmtlcjtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJU2VhcmNoU2VydmljZSwgUmVtb3RlU2VhcmNoU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMseUJBQXlCO0FBQ2xDLFNBQThGLGdCQUE0QixvQkFBb0IscUNBQXFDO0FBQ25MLFNBQVMscUJBQXFCO0FBQzlC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QUFBQSxRQUNEO0FBQ0EsY0FBTSxnQkFBZ0IsS0FBSyxtQkFBbUIsT0FBTyxpQkFBaUIsR0FBRyxNQUFNO0FBQy9FLGNBQU0sZ0JBQWdCLE1BQU0sTUFBTSxlQUFlLFFBQVEsT0FBTyxJQUFJLGVBQWUsT0FBTztBQUMxRixtQkFBVyxnQkFBZ0IsY0FBYyxTQUFTO0FBQ2pELGtCQUFRLEtBQUssRUFBRSxVQUFVLElBQUksU0FBUyxHQUFHLFFBQVEsWUFBWSxFQUFFLENBQUM7QUFBQSxRQUNqRTtBQUNBLFlBQUksY0FBYyxVQUFVO0FBQUUscUJBQVc7QUFBQSxRQUFNO0FBQUEsTUFDaEQsQ0FBQyxDQUFDO0FBRUYsdUJBQWlCLFFBQVE7QUFFekIsWUFBTSxTQUFTLEVBQUUsVUFBVSxDQUFDLEdBQUcsU0FBUyxTQUFTO0FBQ2pELGFBQU87QUFBQSxJQUNSLFNBQVMsR0FBRztBQUNYLGNBQVEsTUFBTSwyQ0FBMkMsQ0FBQztBQUMxRCxhQUFPO0FBQUEsUUFDTixTQUFTLENBQUM7QUFBQSxRQUNWLFVBQVUsQ0FBQztBQUFBLFVBQ1YsTUFBTSxTQUFTLG1CQUFtQixnREFBZ0Q7QUFBQSxVQUFHLE1BQU0sOEJBQThCO0FBQUEsUUFDMUgsQ0FBQztBQUFBLE1BQ0Y7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSxXQUFXLFVBQWlDO0FBQ2pELFFBQUksS0FBSyxPQUFPLFFBQVEsVUFBVTtBQUFFLFdBQUssUUFBUTtBQUFBLElBQVc7QUFBQSxFQUM3RDtBQUFBLEVBRVEscUJBQStEO0FBQ3RFLFFBQUksQ0FBQyxLQUFLLFNBQVM7QUFDbEIsVUFBSTtBQUNILGFBQUssVUFBVSxLQUFLLFVBQVU7QUFBQSxVQUM3QixXQUFXLGFBQWEsNERBQTREO0FBQUEsVUFDcEY7QUFBQSxRQUNELENBQUM7QUFDRCxrQ0FBMEIsV0FBVyxLQUFLLFNBQVM7QUFBQSxVQUNsRCxzQkFBc0IsQ0FBQyxPQUFPLFlBQVk7QUFDekMsbUJBQU8sS0FBSyxvQkFBb0IsT0FBTyxPQUFPO0FBQUEsVUFDL0M7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGLFNBQVMsS0FBSztBQUNiLGdDQUF3QixHQUFHO0FBQzNCLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUNBLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFDRDtBQWpJYTtBQUFBLEVBRFg7QUFBQSxHQTNCVyw0QkE0QkE7QUE1QkEsOEJBQU47QUFBQSxFQVlKO0FBQUEsRUFDQTtBQUFBLEdBYlU7QUErSmIsa0JBQWtCLGdCQUFnQixxQkFBcUIsa0JBQWtCLE9BQU87IiwKICAibmFtZXMiOiBbInJlc3VsdCJdCn0K
