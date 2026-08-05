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
import { VSBuffer } from "../../../base/common/buffer.js";
import { CancellationToken } from "../../../base/common/cancellation.js";
import { Emitter } from "../../../base/common/event.js";
import { DisposableStore, dispose } from "../../../base/common/lifecycle.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { assertType } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { CommandsRegistry } from "../../../platform/commands/common/commands.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
import { INotebookCellStatusBarService } from "../../contrib/notebook/common/notebookCellStatusBarService.js";
import { INotebookService, SimpleNotebookProviderInfo } from "../../contrib/notebook/common/notebookService.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { SerializableObjectWithBuffers } from "../../services/extensions/common/proxyIdentifier.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { revive } from "../../../base/common/marshalling.js";
import { coalesce } from "../../../base/common/arrays.js";
let MainThreadNotebooks = class {
  constructor(extHostContext, _notebookService, _cellStatusBarService, _logService) {
    this._notebookService = _notebookService;
    this._cellStatusBarService = _cellStatusBarService;
    this._logService = _logService;
    this._disposables = new DisposableStore();
    this._notebookSerializer = /* @__PURE__ */ new Map();
    this._notebookCellStatusBarRegistrations = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostNotebook);
  }
  dispose() {
    this._disposables.dispose();
    dispose(this._notebookSerializer.values());
  }
  $registerNotebookSerializer(handle, extension, viewType, options, data) {
    const disposables = new DisposableStore();
    disposables.add(this._notebookService.registerNotebookSerializer(viewType, extension, {
      options,
      dataToNotebook: async (data2) => {
        const sw = new StopWatch();
        let result;
        if (data2.byteLength === 0 && viewType === "interactive") {
          result = NotebookDto.fromNotebookDataDto({ cells: [], metadata: {} });
        } else {
          const dto = await this._proxy.$dataToNotebook(handle, data2, CancellationToken.None);
          result = NotebookDto.fromNotebookDataDto(dto.value);
        }
        this._logService.trace(`[NotebookSerializer] dataToNotebook DONE after ${sw.elapsed()}ms`, {
          viewType,
          extensionId: extension.id.value
        });
        return result;
      },
      notebookToData: (data2) => {
        const sw = new StopWatch();
        const result = this._proxy.$notebookToData(handle, new SerializableObjectWithBuffers(NotebookDto.toNotebookDataDto(data2)), CancellationToken.None);
        this._logService.trace(`[NotebookSerializer] notebookToData DONE after ${sw.elapsed()}`, {
          viewType,
          extensionId: extension.id.value
        });
        return result;
      },
      save: async (uri, versionId, options2, token) => {
        const stat = await this._proxy.$saveNotebook(handle, uri, versionId, options2, token);
        return {
          ...stat,
          children: void 0,
          resource: uri
        };
      },
      searchInNotebooks: async (textQuery, token, allPriorityInfo) => {
        const contributedType = this._notebookService.getContributedNotebookType(viewType);
        if (!contributedType) {
          return { results: [], limitHit: false };
        }
        const fileNames = contributedType.selectors;
        const includes = fileNames.map((selector) => {
          const globPattern = selector.include || selector;
          return globPattern.toString();
        });
        if (!includes.length) {
          return {
            results: [],
            limitHit: false
          };
        }
        const thisPriorityInfo = coalesce([{ isFromSettings: false, filenamePatterns: includes }, ...allPriorityInfo.get(viewType) ?? []]);
        const otherEditorsPriorityInfo = Array.from(allPriorityInfo.keys()).flatMap((key) => {
          if (key !== viewType) {
            return allPriorityInfo.get(key) ?? [];
          }
          return [];
        });
        const searchComplete = await this._proxy.$searchInNotebooks(handle, textQuery, thisPriorityInfo, otherEditorsPriorityInfo, token);
        const revivedResults = searchComplete.results.map((result) => {
          const resource = URI.revive(result.resource);
          return {
            resource,
            cellResults: result.cellResults.map((e) => revive(e))
          };
        });
        return { results: revivedResults, limitHit: searchComplete.limitHit };
      }
    }));
    if (data) {
      disposables.add(this._notebookService.registerContributedNotebookType(viewType, data));
    }
    this._notebookSerializer.set(handle, disposables);
    this._logService.trace("[NotebookSerializer] registered notebook serializer", {
      viewType,
      extensionId: extension.id.value
    });
  }
  $unregisterNotebookSerializer(handle) {
    this._notebookSerializer.get(handle)?.dispose();
    this._notebookSerializer.delete(handle);
  }
  $emitCellStatusBarEvent(eventHandle) {
    const emitter = this._notebookCellStatusBarRegistrations.get(eventHandle);
    if (emitter instanceof Emitter) {
      emitter.fire(void 0);
    }
  }
  async $registerNotebookCellStatusBarItemProvider(handle, eventHandle, viewType) {
    const that = this;
    const provider = {
      async provideCellStatusBarItems(uri, index, token) {
        const result = await that._proxy.$provideNotebookCellStatusBarItems(handle, uri, index, token);
        return {
          items: result?.items ?? [],
          dispose() {
            if (result) {
              that._proxy.$releaseNotebookCellStatusBarItems(result.cacheId);
            }
          }
        };
      },
      viewType
    };
    if (typeof eventHandle === "number") {
      const emitter = new Emitter();
      this._notebookCellStatusBarRegistrations.set(eventHandle, emitter);
      provider.onDidChangeStatusBarItems = emitter.event;
    }
    const disposable = this._cellStatusBarService.registerCellStatusBarItemProvider(provider);
    this._notebookCellStatusBarRegistrations.set(handle, disposable);
  }
  async $unregisterNotebookCellStatusBarItemProvider(handle, eventHandle) {
    const unregisterThing = (handle2) => {
      const entry = this._notebookCellStatusBarRegistrations.get(handle2);
      if (entry) {
        this._notebookCellStatusBarRegistrations.get(handle2)?.dispose();
        this._notebookCellStatusBarRegistrations.delete(handle2);
      }
    };
    unregisterThing(handle);
    if (typeof eventHandle === "number") {
      unregisterThing(eventHandle);
    }
  }
};
MainThreadNotebooks = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadNotebook),
  __decorateParam(1, INotebookService),
  __decorateParam(2, INotebookCellStatusBarService),
  __decorateParam(3, ILogService)
], MainThreadNotebooks);
CommandsRegistry.registerCommand("_executeDataToNotebook", async (accessor, ...args) => {
  const [notebookType, bytes] = args;
  assertType(typeof notebookType === "string", "string");
  assertType(bytes instanceof VSBuffer, "VSBuffer");
  const notebookService = accessor.get(INotebookService);
  const info = await notebookService.withNotebookDataProvider(notebookType);
  if (!(info instanceof SimpleNotebookProviderInfo)) {
    return;
  }
  const dto = await info.serializer.dataToNotebook(bytes);
  return new SerializableObjectWithBuffers(NotebookDto.toNotebookDataDto(dto));
});
CommandsRegistry.registerCommand("_executeNotebookToData", async (accessor, ...args) => {
  const [notebookType, dto] = args;
  assertType(typeof notebookType === "string", "string");
  assertType(typeof dto === "object");
  const notebookService = accessor.get(INotebookService);
  const info = await notebookService.withNotebookDataProvider(notebookType);
  if (!(info instanceof SimpleNotebookProviderInfo)) {
    return;
  }
  const data = NotebookDto.fromNotebookDataDto(dto.value);
  const bytes = await info.serializer.notebookToData(data);
  return bytes;
});
export {
  MainThreadNotebooks
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZE5vdGVib29rLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgU3RvcFdhdGNoIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RvcHdhdGNoLmpzJztcbmltcG9ydCB7IGFzc2VydFR5cGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IE5vdGVib29rRHRvIH0gZnJvbSAnLi9tYWluVGhyZWFkTm90ZWJvb2tEdG8uanMnO1xuaW1wb3J0IHsgSU5vdGVib29rQ2VsbFN0YXR1c0JhclNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtUHJvdmlkZXIsIElOb3RlYm9va0NvbnRyaWJ1dGlvbkRhdGEsIElOb3RlYm9va0V4Y2x1c2l2ZURvY3VtZW50RmlsdGVyLCBOb3RlYm9va0RhdGEsIE5vdGVib29rRXh0ZW5zaW9uRGVzY3JpcHRpb24sIFRyYW5zaWVudE9wdGlvbnMgfSBmcm9tICcuLi8uLi9jb250cmliL25vdGVib29rL2NvbW1vbi9ub3RlYm9va0NvbW1vbi5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tTZXJ2aWNlLCBTaW1wbGVOb3RlYm9va1Byb3ZpZGVySW5mbyB9IGZyb20gJy4uLy4uL2NvbnRyaWIvbm90ZWJvb2svY29tbW9uL25vdGVib29rU2VydmljZS5qcyc7XG5pbXBvcnQgeyBleHRIb3N0TmFtZWRDdXN0b21lciwgSUV4dEhvc3RDb250ZXh0IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0SG9zdEN1c3RvbWVycy5qcyc7XG5pbXBvcnQgeyBTZXJpYWxpemFibGVPYmplY3RXaXRoQnVmZmVycyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL3Byb3h5SWRlbnRpZmllci5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0Q29udGV4dCwgRXh0SG9zdE5vdGVib29rU2hhcGUsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkTm90ZWJvb2tTaGFwZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElSZWxhdGl2ZVBhdHRlcm4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9nbG9iLmpzJztcbmltcG9ydCB7IHJldml2ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IElOb3RlYm9va0ZpbGVNYXRjaE5vTW9kZWwgfSBmcm9tICcuLi8uLi9jb250cmliL3NlYXJjaC9jb21tb24vc2VhcmNoTm90ZWJvb2tIZWxwZXJzLmpzJztcbmltcG9ydCB7IE5vdGVib29rUHJpb3JpdHlJbmZvIH0gZnJvbSAnLi4vLi4vY29udHJpYi9zZWFyY2gvY29tbW9uL3NlYXJjaC5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkTm90ZWJvb2spXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZE5vdGVib29rcyBpbXBsZW1lbnRzIE1haW5UaHJlYWROb3RlYm9va1NoYXBlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdE5vdGVib29rU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VyaWFsaXplciA9IG5ldyBNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfbm90ZWJvb2tDZWxsU3RhdHVzQmFyUmVnaXN0cmF0aW9ucyA9IG5ldyBNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZT4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRleHRIb3N0Q29udGV4dDogSUV4dEhvc3RDb250ZXh0LFxuXHRcdEBJTm90ZWJvb2tTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGVib29rU2VydmljZTogSU5vdGVib29rU2VydmljZSxcblx0XHRASU5vdGVib29rQ2VsbFN0YXR1c0JhclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2VsbFN0YXR1c0JhclNlcnZpY2U6IElOb3RlYm9va0NlbGxTdGF0dXNCYXJTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBleHRIb3N0Q29udGV4dC5nZXRQcm94eShFeHRIb3N0Q29udGV4dC5FeHRIb3N0Tm90ZWJvb2spO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0ZGlzcG9zZSh0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIudmFsdWVzKCkpO1xuXHR9XG5cblx0JHJlZ2lzdGVyTm90ZWJvb2tTZXJpYWxpemVyKGhhbmRsZTogbnVtYmVyLCBleHRlbnNpb246IE5vdGVib29rRXh0ZW5zaW9uRGVzY3JpcHRpb24sIHZpZXdUeXBlOiBzdHJpbmcsIG9wdGlvbnM6IFRyYW5zaWVudE9wdGlvbnMsIGRhdGE6IElOb3RlYm9va0NvbnRyaWJ1dGlvbkRhdGEgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLl9ub3RlYm9va1NlcnZpY2UucmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIodmlld1R5cGUsIGV4dGVuc2lvbiwge1xuXHRcdFx0b3B0aW9ucyxcblx0XHRcdGRhdGFUb05vdGVib29rOiBhc3luYyAoZGF0YTogVlNCdWZmZXIpOiBQcm9taXNlPE5vdGVib29rRGF0YT4gPT4ge1xuXHRcdFx0XHRjb25zdCBzdyA9IG5ldyBTdG9wV2F0Y2goKTtcblx0XHRcdFx0bGV0IHJlc3VsdDogTm90ZWJvb2tEYXRhO1xuXHRcdFx0XHRpZiAoZGF0YS5ieXRlTGVuZ3RoID09PSAwICYmIHZpZXdUeXBlID09PSAnaW50ZXJhY3RpdmUnKSB7XG5cdFx0XHRcdFx0Ly8gd2UgZG9uJ3Qgd2FudCBhbnkgc3RhcnRpbmcgY2VsbHMgZm9yIGFuIGVtcHR5IGludGVyYWN0aXZlIHdpbmRvdy5cblx0XHRcdFx0XHRyZXN1bHQgPSBOb3RlYm9va0R0by5mcm9tTm90ZWJvb2tEYXRhRHRvKHsgY2VsbHM6IFtdLCBtZXRhZGF0YToge30gfSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Y29uc3QgZHRvID0gYXdhaXQgdGhpcy5fcHJveHkuJGRhdGFUb05vdGVib29rKGhhbmRsZSwgZGF0YSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0XHRcdFx0cmVzdWx0ID0gTm90ZWJvb2tEdG8uZnJvbU5vdGVib29rRGF0YUR0byhkdG8udmFsdWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UudHJhY2UoYFtOb3RlYm9va1NlcmlhbGl6ZXJdIGRhdGFUb05vdGVib29rIERPTkUgYWZ0ZXIgJHtzdy5lbGFwc2VkKCl9bXNgLCB7XG5cdFx0XHRcdFx0dmlld1R5cGUsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZC52YWx1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0bm90ZWJvb2tUb0RhdGE6IChkYXRhOiBOb3RlYm9va0RhdGEpOiBQcm9taXNlPFZTQnVmZmVyPiA9PiB7XG5cdFx0XHRcdGNvbnN0IHN3ID0gbmV3IFN0b3BXYXRjaCgpO1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSB0aGlzLl9wcm94eS4kbm90ZWJvb2tUb0RhdGEoaGFuZGxlLCBuZXcgU2VyaWFsaXphYmxlT2JqZWN0V2l0aEJ1ZmZlcnMoTm90ZWJvb2tEdG8udG9Ob3RlYm9va0RhdGFEdG8oZGF0YSkpLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRcdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZShgW05vdGVib29rU2VyaWFsaXplcl0gbm90ZWJvb2tUb0RhdGEgRE9ORSBhZnRlciAke3N3LmVsYXBzZWQoKX1gLCB7XG5cdFx0XHRcdFx0dmlld1R5cGUsXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5pZC52YWx1ZSxcblx0XHRcdFx0fSk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9LFxuXHRcdFx0c2F2ZTogYXN5bmMgKHVyaSwgdmVyc2lvbklkLCBvcHRpb25zLCB0b2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCBzdGF0ID0gYXdhaXQgdGhpcy5fcHJveHkuJHNhdmVOb3RlYm9vayhoYW5kbGUsIHVyaSwgdmVyc2lvbklkLCBvcHRpb25zLCB0b2tlbik7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0Li4uc3RhdCxcblx0XHRcdFx0XHRjaGlsZHJlbjogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHJlc291cmNlOiB1cmlcblx0XHRcdFx0fTtcblx0XHRcdH0sXG5cdFx0XHRzZWFyY2hJbk5vdGVib29rczogYXN5bmMgKHRleHRRdWVyeSwgdG9rZW4sIGFsbFByaW9yaXR5SW5mbyk6IFByb21pc2U8eyByZXN1bHRzOiBJTm90ZWJvb2tGaWxlTWF0Y2hOb01vZGVsPFVSST5bXTsgbGltaXRIaXQ6IGJvb2xlYW4gfT4gPT4ge1xuXHRcdFx0XHRjb25zdCBjb250cmlidXRlZFR5cGUgPSB0aGlzLl9ub3RlYm9va1NlcnZpY2UuZ2V0Q29udHJpYnV0ZWROb3RlYm9va1R5cGUodmlld1R5cGUpO1xuXHRcdFx0XHRpZiAoIWNvbnRyaWJ1dGVkVHlwZSkge1xuXHRcdFx0XHRcdHJldHVybiB7IHJlc3VsdHM6IFtdLCBsaW1pdEhpdDogZmFsc2UgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRjb25zdCBmaWxlTmFtZXMgPSBjb250cmlidXRlZFR5cGUuc2VsZWN0b3JzO1xuXG5cdFx0XHRcdGNvbnN0IGluY2x1ZGVzID0gZmlsZU5hbWVzLm1hcCgoc2VsZWN0b3IpID0+IHtcblx0XHRcdFx0XHRjb25zdCBnbG9iUGF0dGVybiA9IChzZWxlY3RvciBhcyBJTm90ZWJvb2tFeGNsdXNpdmVEb2N1bWVudEZpbHRlcikuaW5jbHVkZSB8fCBzZWxlY3RvciBhcyBJUmVsYXRpdmVQYXR0ZXJuIHwgc3RyaW5nO1xuXHRcdFx0XHRcdHJldHVybiBnbG9iUGF0dGVybi50b1N0cmluZygpO1xuXHRcdFx0XHR9KTtcblxuXHRcdFx0XHRpZiAoIWluY2x1ZGVzLmxlbmd0aCkge1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRyZXN1bHRzOiBbXSwgbGltaXRIaXQ6IGZhbHNlXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHRoaXNQcmlvcml0eUluZm8gPSBjb2FsZXNjZTxOb3RlYm9va1ByaW9yaXR5SW5mbz4oW3sgaXNGcm9tU2V0dGluZ3M6IGZhbHNlLCBmaWxlbmFtZVBhdHRlcm5zOiBpbmNsdWRlcyB9LCAuLi5hbGxQcmlvcml0eUluZm8uZ2V0KHZpZXdUeXBlKSA/PyBbXV0pO1xuXHRcdFx0XHRjb25zdCBvdGhlckVkaXRvcnNQcmlvcml0eUluZm8gPSBBcnJheS5mcm9tKGFsbFByaW9yaXR5SW5mby5rZXlzKCkpXG5cdFx0XHRcdFx0LmZsYXRNYXAoa2V5ID0+IHtcblx0XHRcdFx0XHRcdGlmIChrZXkgIT09IHZpZXdUeXBlKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBhbGxQcmlvcml0eUluZm8uZ2V0KGtleSkgPz8gW107XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHRcdFx0fSk7XG5cblx0XHRcdFx0Y29uc3Qgc2VhcmNoQ29tcGxldGUgPSBhd2FpdCB0aGlzLl9wcm94eS4kc2VhcmNoSW5Ob3RlYm9va3MoaGFuZGxlLCB0ZXh0UXVlcnksIHRoaXNQcmlvcml0eUluZm8sIG90aGVyRWRpdG9yc1ByaW9yaXR5SW5mbywgdG9rZW4pO1xuXHRcdFx0XHRjb25zdCByZXZpdmVkUmVzdWx0czogSU5vdGVib29rRmlsZU1hdGNoTm9Nb2RlbDxVUkk+W10gPSBzZWFyY2hDb21wbGV0ZS5yZXN1bHRzLm1hcChyZXN1bHQgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHJlc291cmNlID0gVVJJLnJldml2ZShyZXN1bHQucmVzb3VyY2UpO1xuXHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZSxcblx0XHRcdFx0XHRcdGNlbGxSZXN1bHRzOiByZXN1bHQuY2VsbFJlc3VsdHMubWFwKGUgPT4gcmV2aXZlKGUpKVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH0pO1xuXHRcdFx0XHRyZXR1cm4geyByZXN1bHRzOiByZXZpdmVkUmVzdWx0cywgbGltaXRIaXQ6IHNlYXJjaENvbXBsZXRlLmxpbWl0SGl0IH07XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKGRhdGEpIHtcblx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0aGlzLl9ub3RlYm9va1NlcnZpY2UucmVnaXN0ZXJDb250cmlidXRlZE5vdGVib29rVHlwZSh2aWV3VHlwZSwgZGF0YSkpO1xuXHRcdH1cblx0XHR0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIuc2V0KGhhbmRsZSwgZGlzcG9zYWJsZXMpO1xuXG5cdFx0dGhpcy5fbG9nU2VydmljZS50cmFjZSgnW05vdGVib29rU2VyaWFsaXplcl0gcmVnaXN0ZXJlZCBub3RlYm9vayBzZXJpYWxpemVyJywge1xuXHRcdFx0dmlld1R5cGUsXG5cdFx0XHRleHRlbnNpb25JZDogZXh0ZW5zaW9uLmlkLnZhbHVlLFxuXHRcdH0pO1xuXHR9XG5cblx0JHVucmVnaXN0ZXJOb3RlYm9va1NlcmlhbGl6ZXIoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIuZ2V0KGhhbmRsZSk/LmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9ub3RlYm9va1NlcmlhbGl6ZXIuZGVsZXRlKGhhbmRsZSk7XG5cdH1cblxuXHQkZW1pdENlbGxTdGF0dXNCYXJFdmVudChldmVudEhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgZW1pdHRlciA9IHRoaXMuX25vdGVib29rQ2VsbFN0YXR1c0JhclJlZ2lzdHJhdGlvbnMuZ2V0KGV2ZW50SGFuZGxlKTtcblx0XHRpZiAoZW1pdHRlciBpbnN0YW5jZW9mIEVtaXR0ZXIpIHtcblx0XHRcdGVtaXR0ZXIuZmlyZSh1bmRlZmluZWQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jICRyZWdpc3Rlck5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1Qcm92aWRlcihoYW5kbGU6IG51bWJlciwgZXZlbnRIYW5kbGU6IG51bWJlciB8IHVuZGVmaW5lZCwgdmlld1R5cGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdGNvbnN0IHByb3ZpZGVyOiBJTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbVByb3ZpZGVyID0ge1xuXHRcdFx0YXN5bmMgcHJvdmlkZUNlbGxTdGF0dXNCYXJJdGVtcyh1cmk6IFVSSSwgaW5kZXg6IG51bWJlciwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoYXQuX3Byb3h5LiRwcm92aWRlTm90ZWJvb2tDZWxsU3RhdHVzQmFySXRlbXMoaGFuZGxlLCB1cmksIGluZGV4LCB0b2tlbik7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0aXRlbXM6IHJlc3VsdD8uaXRlbXMgPz8gW10sXG5cdFx0XHRcdFx0ZGlzcG9zZSgpIHtcblx0XHRcdFx0XHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdFx0XHRcdFx0dGhhdC5fcHJveHkuJHJlbGVhc2VOb3RlYm9va0NlbGxTdGF0dXNCYXJJdGVtcyhyZXN1bHQuY2FjaGVJZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fSxcblx0XHRcdHZpZXdUeXBlXG5cdFx0fTtcblxuXHRcdGlmICh0eXBlb2YgZXZlbnRIYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0XHRcdHRoaXMuX25vdGVib29rQ2VsbFN0YXR1c0JhclJlZ2lzdHJhdGlvbnMuc2V0KGV2ZW50SGFuZGxlLCBlbWl0dGVyKTtcblx0XHRcdHByb3ZpZGVyLm9uRGlkQ2hhbmdlU3RhdHVzQmFySXRlbXMgPSBlbWl0dGVyLmV2ZW50O1xuXHRcdH1cblxuXHRcdGNvbnN0IGRpc3Bvc2FibGUgPSB0aGlzLl9jZWxsU3RhdHVzQmFyU2VydmljZS5yZWdpc3RlckNlbGxTdGF0dXNCYXJJdGVtUHJvdmlkZXIocHJvdmlkZXIpO1xuXHRcdHRoaXMuX25vdGVib29rQ2VsbFN0YXR1c0JhclJlZ2lzdHJhdGlvbnMuc2V0KGhhbmRsZSwgZGlzcG9zYWJsZSk7XG5cdH1cblxuXHRhc3luYyAkdW5yZWdpc3Rlck5vdGVib29rQ2VsbFN0YXR1c0Jhckl0ZW1Qcm92aWRlcihoYW5kbGU6IG51bWJlciwgZXZlbnRIYW5kbGU6IG51bWJlciB8IHVuZGVmaW5lZCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHVucmVnaXN0ZXJUaGluZyA9IChoYW5kbGU6IG51bWJlcikgPT4ge1xuXHRcdFx0Y29uc3QgZW50cnkgPSB0aGlzLl9ub3RlYm9va0NlbGxTdGF0dXNCYXJSZWdpc3RyYXRpb25zLmdldChoYW5kbGUpO1xuXHRcdFx0aWYgKGVudHJ5KSB7XG5cdFx0XHRcdHRoaXMuX25vdGVib29rQ2VsbFN0YXR1c0JhclJlZ2lzdHJhdGlvbnMuZ2V0KGhhbmRsZSk/LmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5fbm90ZWJvb2tDZWxsU3RhdHVzQmFyUmVnaXN0cmF0aW9ucy5kZWxldGUoaGFuZGxlKTtcblx0XHRcdH1cblx0XHR9O1xuXHRcdHVucmVnaXN0ZXJUaGluZyhoYW5kbGUpO1xuXHRcdGlmICh0eXBlb2YgZXZlbnRIYW5kbGUgPT09ICdudW1iZXInKSB7XG5cdFx0XHR1bnJlZ2lzdGVyVGhpbmcoZXZlbnRIYW5kbGUpO1xuXHRcdH1cblx0fVxufVxuXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnX2V4ZWN1dGVEYXRhVG9Ob3RlYm9vaycsIGFzeW5jIChhY2Nlc3NvciwgLi4uYXJncykgPT4ge1xuXG5cdGNvbnN0IFtub3RlYm9va1R5cGUsIGJ5dGVzXSA9IGFyZ3M7XG5cdGFzc2VydFR5cGUodHlwZW9mIG5vdGVib29rVHlwZSA9PT0gJ3N0cmluZycsICdzdHJpbmcnKTtcblx0YXNzZXJ0VHlwZShieXRlcyBpbnN0YW5jZW9mIFZTQnVmZmVyLCAnVlNCdWZmZXInKTtcblxuXHRjb25zdCBub3RlYm9va1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSU5vdGVib29rU2VydmljZSk7XG5cdGNvbnN0IGluZm8gPSBhd2FpdCBub3RlYm9va1NlcnZpY2Uud2l0aE5vdGVib29rRGF0YVByb3ZpZGVyKG5vdGVib29rVHlwZSk7XG5cdGlmICghKGluZm8gaW5zdGFuY2VvZiBTaW1wbGVOb3RlYm9va1Byb3ZpZGVySW5mbykpIHtcblx0XHRyZXR1cm47XG5cdH1cblxuXHRjb25zdCBkdG8gPSBhd2FpdCBpbmZvLnNlcmlhbGl6ZXIuZGF0YVRvTm90ZWJvb2soYnl0ZXMpO1xuXHRyZXR1cm4gbmV3IFNlcmlhbGl6YWJsZU9iamVjdFdpdGhCdWZmZXJzKE5vdGVib29rRHRvLnRvTm90ZWJvb2tEYXRhRHRvKGR0bykpO1xufSk7XG5cbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKCdfZXhlY3V0ZU5vdGVib29rVG9EYXRhJywgYXN5bmMgKGFjY2Vzc29yLCAuLi5hcmdzKSA9PiB7XG5cblx0Y29uc3QgW25vdGVib29rVHlwZSwgZHRvXSA9IGFyZ3M7XG5cdGFzc2VydFR5cGUodHlwZW9mIG5vdGVib29rVHlwZSA9PT0gJ3N0cmluZycsICdzdHJpbmcnKTtcblx0YXNzZXJ0VHlwZSh0eXBlb2YgZHRvID09PSAnb2JqZWN0Jyk7XG5cblx0Y29uc3Qgbm90ZWJvb2tTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElOb3RlYm9va1NlcnZpY2UpO1xuXHRjb25zdCBpbmZvID0gYXdhaXQgbm90ZWJvb2tTZXJ2aWNlLndpdGhOb3RlYm9va0RhdGFQcm92aWRlcihub3RlYm9va1R5cGUpO1xuXHRpZiAoIShpbmZvIGluc3RhbmNlb2YgU2ltcGxlTm90ZWJvb2tQcm92aWRlckluZm8pKSB7XG5cdFx0cmV0dXJuO1xuXHR9XG5cblx0Y29uc3QgZGF0YSA9IE5vdGVib29rRHRvLmZyb21Ob3RlYm9va0RhdGFEdG8oZHRvLnZhbHVlKTtcblx0Y29uc3QgYnl0ZXMgPSBhd2FpdCBpbmZvLnNlcmlhbGl6ZXIubm90ZWJvb2tUb0RhdGEoZGF0YSk7XG5cdHJldHVybiBieXRlcztcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxpQkFBaUIsZUFBNEI7QUFDdEQsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMscUNBQXFDO0FBRTlDLFNBQVMsa0JBQWtCLGtDQUFrQztBQUM3RCxTQUFTLDRCQUE2QztBQUN0RCxTQUFTLHFDQUFxQztBQUM5QyxTQUFTLGdCQUFzQyxtQkFBNEM7QUFFM0YsU0FBUyxjQUFjO0FBR3ZCLFNBQVMsZ0JBQWdCO0FBR2xCLElBQU0sc0JBQU4sTUFBNkQ7QUFBQSxFQVFuRSxZQUNDLGdCQUNtQyxrQkFDYSx1QkFDbEIsYUFDN0I7QUFIa0M7QUFDYTtBQUNsQjtBQVYvQixTQUFp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
