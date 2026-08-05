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
import { localize } from "../../../nls.js";
import { MarkerSeverity } from "../../../platform/markers/common/markers.js";
import { URI } from "../../../base/common/uri.js";
import { MainContext } from "./extHost.protocol.js";
import { DiagnosticSeverity } from "./extHostTypes.js";
import * as converter from "./extHostTypeConverters.js";
import { Event, DebounceEmitter } from "../../../base/common/event.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { ResourceMap } from "../../../base/common/map.js";
import { IExtHostFileSystemInfo } from "./extHostFileSystemInfo.js";
class DiagnosticCollection {
  constructor(_name, _owner, _maxDiagnosticsTotal, _maxDiagnosticsPerFile, _modelVersionIdProvider, extUri, proxy, onDidChangeDiagnostics) {
    this._name = _name;
    this._owner = _owner;
    this._maxDiagnosticsTotal = _maxDiagnosticsTotal;
    this._maxDiagnosticsPerFile = _maxDiagnosticsPerFile;
    this._modelVersionIdProvider = _modelVersionIdProvider;
    this._isDisposed = false;
    this._maxDiagnosticsTotal = Math.max(_maxDiagnosticsPerFile, _maxDiagnosticsTotal);
    this.#data = new ResourceMap((uri) => extUri.getComparisonKey(uri));
    this.#proxy = proxy;
    this.#onDidChangeDiagnostics = onDidChangeDiagnostics;
  }
  #proxy;
  #onDidChangeDiagnostics;
  #data;
  dispose() {
    if (!this._isDisposed) {
      this.#onDidChangeDiagnostics.fire([...this.#data.keys()]);
      this.#proxy?.$clear(this._owner);
      this.#data.clear();
      this._isDisposed = true;
    }
  }
  get name() {
    this._checkDisposed();
    return this._name;
  }
  set(first, diagnostics) {
    if (!first) {
      this.clear();
      return;
    }
    this._checkDisposed();
    let toSync = [];
    if (URI.isUri(first)) {
      if (!diagnostics) {
        this.delete(first);
        return;
      }
      this.#data.set(first, diagnostics.slice());
      toSync = [first];
    } else if (Array.isArray(first)) {
      toSync = [];
      let lastUri;
      first = [...first].sort(DiagnosticCollection._compareIndexedTuplesByUri);
      for (const tuple of first) {
        const [uri, diagnostics2] = tuple;
        if (!lastUri || uri.toString() !== lastUri.toString()) {
          if (lastUri && this.#data.get(lastUri).length === 0) {
            this.#data.delete(lastUri);
          }
          lastUri = uri;
          toSync.push(uri);
          this.#data.set(uri, []);
        }
        if (!diagnostics2) {
          const currentDiagnostics = this.#data.get(uri);
          if (currentDiagnostics) {
            currentDiagnostics.length = 0;
          }
        } else {
          const currentDiagnostics = this.#data.get(uri);
          currentDiagnostics?.push(...diagnostics2);
        }
      }
    }
    this.#onDidChangeDiagnostics.fire(toSync);
    if (!this.#proxy) {
      return;
    }
    const entries = [];
    let totalMarkerCount = 0;
    for (const uri of toSync) {
      let marker = [];
      const diagnostics2 = this.#data.get(uri);
      if (diagnostics2) {
        if (diagnostics2.length > this._maxDiagnosticsPerFile) {
          marker = [];
          const order = [DiagnosticSeverity.Error, DiagnosticSeverity.Warning, DiagnosticSeverity.Information, DiagnosticSeverity.Hint];
          orderLoop: for (let i = 0; i < 4; i++) {
            for (const diagnostic of diagnostics2) {
              if (diagnostic.severity === order[i]) {
                const len = marker.push({ ...converter.Diagnostic.from(diagnostic), modelVersionId: this._modelVersionIdProvider(uri) });
                if (len === this._maxDiagnosticsPerFile) {
                  break orderLoop;
                }
              }
            }
          }
          marker.push({
            severity: MarkerSeverity.Info,
            message: localize({ key: "limitHit", comment: ["amount of errors/warning skipped due to limits"] }, "Not showing {0} further errors and warnings.", diagnostics2.length - this._maxDiagnosticsPerFile),
            startLineNumber: marker[marker.length - 1].startLineNumber,
            startColumn: marker[marker.length - 1].startColumn,
            endLineNumber: marker[marker.length - 1].endLineNumber,
            endColumn: marker[marker.length - 1].endColumn
          });
        } else {
          marker = diagnostics2.map((diag) => ({ ...converter.Diagnostic.from(diag), modelVersionId: this._modelVersionIdProvider(uri) }));
        }
      }
      entries.push([uri, marker]);
      totalMarkerCount += marker.length;
      if (totalMarkerCount > this._maxDiagnosticsTotal) {
        break;
      }
    }
    this.#proxy.$changeMany(this._owner, entries);
  }
  delete(uri) {
    this._checkDisposed();
    this.#onDidChangeDiagnostics.fire([uri]);
    this.#data.delete(uri);
    this.#proxy?.$changeMany(this._owner, [[uri, void 0]]);
  }
  clear() {
    this._checkDisposed();
    this.#onDidChangeDiagnostics.fire([...this.#data.keys()]);
    this.#data.clear();
    this.#proxy?.$clear(this._owner);
  }
  forEach(callback, thisArg) {
    this._checkDisposed();
    for (const [uri, values] of this) {
      callback.call(thisArg, uri, values, this);
    }
  }
  *[Symbol.iterator]() {
    this._checkDisposed();
    for (const uri of this.#data.keys()) {
      yield [uri, this.get(uri)];
    }
  }
  get(uri) {
    this._checkDisposed();
    const result = this.#data.get(uri);
    if (Array.isArray(result)) {
      return Object.freeze(result.slice(0));
    }
    return [];
  }
  has(uri) {
    this._checkDisposed();
    return Array.isArray(this.#data.get(uri));
  }
  _checkDisposed() {
    if (this._isDisposed) {
      throw new Error("illegal state - object is disposed");
    }
  }
  static _compareIndexedTuplesByUri(a, b) {
    if (a[0].toString() < b[0].toString()) {
      return -1;
    } else if (a[0].toString() > b[0].toString()) {
      return 1;
    } else {
      return 0;
    }
  }
}
let ExtHostDiagnostics = class {
  constructor(mainContext, _logService, _fileSystemInfoService, _extHostDocumentsAndEditors) {
    this._logService = _logService;
    this._fileSystemInfoService = _fileSystemInfoService;
    this._extHostDocumentsAndEditors = _extHostDocumentsAndEditors;
    this._collections = /* @__PURE__ */ new Map();
    this._onDidChangeDiagnostics = new DebounceEmitter({ merge: (all) => all.flat(), delay: 50 });
    this.onDidChangeDiagnostics = Event.map(this._onDidChangeDiagnostics.event, ExtHostDiagnostics._mapper);
    this._proxy = mainContext.getProxy(MainContext.MainThreadDiagnostics);
  }
  static _mapper(last) {
    const map = new ResourceMap();
    for (const uri of last) {
      map.set(uri, uri);
    }
    return { uris: Object.freeze(Array.from(map.values())) };
  }
  createDiagnosticCollection(extensionId, name) {
    const { _collections, _proxy, _onDidChangeDiagnostics, _logService, _fileSystemInfoService, _extHostDocumentsAndEditors } = this;
    const loggingProxy = new class {
      $changeMany(owner2, entries) {
        _proxy.$changeMany(owner2, entries);
        _logService.trace("[DiagnosticCollection] change many (extension, owner, uris)", extensionId.value, owner2, entries.length === 0 ? "CLEARING" : entries);
      }
      $clear(owner2) {
        _proxy.$clear(owner2);
        _logService.trace("[DiagnosticCollection] remove all (extension, owner)", extensionId.value, owner2);
      }
      dispose() {
        _proxy.dispose();
      }
    }();
    let owner;
    if (!name) {
      name = "_generated_diagnostic_collection_name_#" + ExtHostDiagnostics._idPool++;
      owner = name;
    } else if (!_collections.has(name)) {
      owner = name;
    } else {
      this._logService.warn(`DiagnosticCollection with name '${name}' does already exist.`);
      do {
        owner = name + ExtHostDiagnostics._idPool++;
      } while (_collections.has(owner));
    }
    const result = new class extends DiagnosticCollection {
      constructor() {
        super(
          name,
          owner,
          ExtHostDiagnostics._maxDiagnosticsTotal,
          ExtHostDiagnostics._maxDiagnosticsPerFile,
          (uri) => _extHostDocumentsAndEditors.getDocument(uri)?.version,
          _fileSystemInfoService.extUri,
          loggingProxy,
          _onDidChangeDiagnostics
        );
        _collections.set(owner, this);
      }
      dispose() {
        super.dispose();
        _collections.delete(owner);
      }
    }();
    return result;
  }
  getDiagnostics(resource) {
    if (resource) {
      return this._getDiagnostics(resource);
    } else {
      const index = /* @__PURE__ */ new Map();
      const res = [];
      for (const collection of this._collections.values()) {
        collection.forEach((uri, diagnostics) => {
          let idx = index.get(uri.toString());
          if (typeof idx === "undefined") {
            idx = res.length;
            index.set(uri.toString(), idx);
            res.push([uri, []]);
          }
          res[idx][1] = res[idx][1].concat(...diagnostics);
        });
      }
      return res;
    }
  }
  _getDiagnostics(resource) {
    let res = [];
    for (const collection of this._collections.values()) {
      if (collection.has(resource)) {
        res = res.concat(collection.get(resource));
      }
    }
    return res;
  }
  $acceptMarkersChange(data) {
    if (!this._mirrorCollection) {
      const name = "_generated_mirror";
      const collection = new DiagnosticCollection(
        name,
        name,
        Number.MAX_SAFE_INTEGER,
        Number.MAX_SAFE_INTEGER,
        // no limits because this collection is just a mirror of "sanitized" data
        (_uri) => void 0,
        this._fileSystemInfoService.extUri,
        void 0,
        this._onDidChangeDiagnostics
      );
      this._collections.set(name, collection);
      this._mirrorCollection = collection;
    }
    for (const [uri, markers] of data) {
      this._mirrorCollection.set(URI.revive(uri), markers.map(converter.Diagnostic.to));
    }
  }
};
ExtHostDiagnostics._idPool = 0;
ExtHostDiagnostics._maxDiagnosticsPerFile = 1e3;
ExtHostDiagnostics._maxDiagnosticsTotal = 1.1 * ExtHostDiagnostics._maxDiagnosticsPerFile;
ExtHostDiagnostics = __decorateClass([
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtHostFileSystemInfo)
], ExtHostDiagnostics);
export {
  DiagnosticCollection,
  ExtHostDiagnostics
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0RGlhZ25vc3RpY3MudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG4vKiBlc2xpbnQtZGlzYWJsZSBsb2NhbC9jb2RlLW5vLW5hdGl2ZS1wcml2YXRlICovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElNYXJrZXJEYXRhLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgeyBNYWluQ29udGV4dCwgTWFpblRocmVhZERpYWdub3N0aWNzU2hhcGUsIEV4dEhvc3REaWFnbm9zdGljc1NoYXBlLCBJTWFpbkNvbnRleHQgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgRGlhZ25vc3RpY1NldmVyaXR5IH0gZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0ICogYXMgY29udmVydGVyIGZyb20gJy4vZXh0SG9zdFR5cGVDb252ZXJ0ZXJzLmpzJztcbmltcG9ydCB7IEV2ZW50LCBFbWl0dGVyLCBEZWJvdW5jZUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IFJlc291cmNlTWFwIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFeHRIb3N0RmlsZVN5c3RlbUluZm8gfSBmcm9tICcuL2V4dEhvc3RGaWxlU3lzdGVtSW5mby5qcyc7XG5pbXBvcnQgeyBJRXh0VXJpIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIH0gZnJvbSAnLi9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBEaWFnbm9zdGljQ29sbGVjdGlvbiBpbXBsZW1lbnRzIHZzY29kZS5EaWFnbm9zdGljQ29sbGVjdGlvbiB7XG5cblx0cmVhZG9ubHkgI3Byb3h5OiBNYWluVGhyZWFkRGlhZ25vc3RpY3NTaGFwZSB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgI29uRGlkQ2hhbmdlRGlhZ25vc3RpY3M6IEVtaXR0ZXI8cmVhZG9ubHkgdnNjb2RlLlVyaVtdPjtcblx0cmVhZG9ubHkgI2RhdGE6IFJlc291cmNlTWFwPHZzY29kZS5EaWFnbm9zdGljW10+O1xuXG5cdHByaXZhdGUgX2lzRGlzcG9zZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9uYW1lOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfb3duZXI6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tYXhEaWFnbm9zdGljc1RvdGFsOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbWF4RGlhZ25vc3RpY3NQZXJGaWxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWxWZXJzaW9uSWRQcm92aWRlcjogKHVyaTogVVJJKSA9PiBudW1iZXIgfCB1bmRlZmluZWQsXG5cdFx0ZXh0VXJpOiBJRXh0VXJpLFxuXHRcdHByb3h5OiBNYWluVGhyZWFkRGlhZ25vc3RpY3NTaGFwZSB8IHVuZGVmaW5lZCxcblx0XHRvbkRpZENoYW5nZURpYWdub3N0aWNzOiBFbWl0dGVyPHJlYWRvbmx5IHZzY29kZS5VcmlbXT5cblx0KSB7XG5cdFx0dGhpcy5fbWF4RGlhZ25vc3RpY3NUb3RhbCA9IE1hdGgubWF4KF9tYXhEaWFnbm9zdGljc1BlckZpbGUsIF9tYXhEaWFnbm9zdGljc1RvdGFsKTtcblx0XHR0aGlzLiNkYXRhID0gbmV3IFJlc291cmNlTWFwKHVyaSA9PiBleHRVcmkuZ2V0Q29tcGFyaXNvbktleSh1cmkpKTtcblx0XHR0aGlzLiNwcm94eSA9IHByb3h5O1xuXHRcdHRoaXMuI29uRGlkQ2hhbmdlRGlhZ25vc3RpY3MgPSBvbkRpZENoYW5nZURpYWdub3N0aWNzO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHRpZiAoIXRoaXMuX2lzRGlzcG9zZWQpIHtcblx0XHRcdHRoaXMuI29uRGlkQ2hhbmdlRGlhZ25vc3RpY3MuZmlyZShbLi4udGhpcy4jZGF0YS5rZXlzKCldKTtcblx0XHRcdHRoaXMuI3Byb3h5Py4kY2xlYXIodGhpcy5fb3duZXIpO1xuXHRcdFx0dGhpcy4jZGF0YS5jbGVhcigpO1xuXHRcdFx0dGhpcy5faXNEaXNwb3NlZCA9IHRydWU7XG5cdFx0fVxuXHR9XG5cblx0Z2V0IG5hbWUoKTogc3RyaW5nIHtcblx0XHR0aGlzLl9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0cmV0dXJuIHRoaXMuX25hbWU7XG5cdH1cblxuXHRzZXQodXJpOiB2c2NvZGUuVXJpLCBkaWFnbm9zdGljczogUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz4pOiB2b2lkO1xuXHRzZXQoZW50cmllczogUmVhZG9ubHlBcnJheTxbdnNjb2RlLlVyaSwgUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz5dPik6IHZvaWQ7XG5cdHNldChmaXJzdDogdnNjb2RlLlVyaSB8IFJlYWRvbmx5QXJyYXk8W3ZzY29kZS5VcmksIFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+XT4sIGRpYWdub3N0aWNzPzogUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz4pIHtcblxuXHRcdGlmICghZmlyc3QpIHtcblx0XHRcdC8vIHRoaXMgc2V0LWNhbGwgaXMgYSBjbGVhci1jYWxsXG5cdFx0XHR0aGlzLmNsZWFyKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gdGhlIGFjdHVhbCBpbXBsZW1lbnRhdGlvbiBmb3IgI3NldFxuXG5cdFx0dGhpcy5fY2hlY2tEaXNwb3NlZCgpO1xuXHRcdGxldCB0b1N5bmM6IHZzY29kZS5VcmlbXSA9IFtdO1xuXG5cdFx0aWYgKFVSSS5pc1VyaShmaXJzdCkpIHtcblxuXHRcdFx0aWYgKCFkaWFnbm9zdGljcykge1xuXHRcdFx0XHQvLyByZW1vdmUgdGhpcyBlbnRyeVxuXHRcdFx0XHR0aGlzLmRlbGV0ZShmaXJzdCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Ly8gdXBkYXRlIHNpbmdsZSByb3dcblx0XHRcdHRoaXMuI2RhdGEuc2V0KGZpcnN0LCBkaWFnbm9zdGljcy5zbGljZSgpKTtcblx0XHRcdHRvU3luYyA9IFtmaXJzdF07XG5cblx0XHR9IGVsc2UgaWYgKEFycmF5LmlzQXJyYXkoZmlyc3QpKSB7XG5cdFx0XHQvLyB1cGRhdGUgbWFueSByb3dzXG5cdFx0XHR0b1N5bmMgPSBbXTtcblx0XHRcdGxldCBsYXN0VXJpOiB2c2NvZGUuVXJpIHwgdW5kZWZpbmVkO1xuXG5cdFx0XHQvLyBlbnN1cmUgc3RhYmxlLXNvcnRcblx0XHRcdGZpcnN0ID0gWy4uLmZpcnN0XS5zb3J0KERpYWdub3N0aWNDb2xsZWN0aW9uLl9jb21wYXJlSW5kZXhlZFR1cGxlc0J5VXJpKTtcblxuXHRcdFx0Zm9yIChjb25zdCB0dXBsZSBvZiBmaXJzdCkge1xuXHRcdFx0XHRjb25zdCBbdXJpLCBkaWFnbm9zdGljc10gPSB0dXBsZTtcblx0XHRcdFx0aWYgKCFsYXN0VXJpIHx8IHVyaS50b1N0cmluZygpICE9PSBsYXN0VXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRpZiAobGFzdFVyaSAmJiB0aGlzLiNkYXRhLmdldChsYXN0VXJpKSEubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0XHR0aGlzLiNkYXRhLmRlbGV0ZShsYXN0VXJpKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0bGFzdFVyaSA9IHVyaTtcblx0XHRcdFx0XHR0b1N5bmMucHVzaCh1cmkpO1xuXHRcdFx0XHRcdHRoaXMuI2RhdGEuc2V0KHVyaSwgW10pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKCFkaWFnbm9zdGljcykge1xuXHRcdFx0XHRcdC8vIFtVcmksIHVuZGVmaW5lZF0gbWVhbnMgY2xlYXIgdGhpc1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnREaWFnbm9zdGljcyA9IHRoaXMuI2RhdGEuZ2V0KHVyaSk7XG5cdFx0XHRcdFx0aWYgKGN1cnJlbnREaWFnbm9zdGljcykge1xuXHRcdFx0XHRcdFx0Y3VycmVudERpYWdub3N0aWNzLmxlbmd0aCA9IDA7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnN0IGN1cnJlbnREaWFnbm9zdGljcyA9IHRoaXMuI2RhdGEuZ2V0KHVyaSk7XG5cdFx0XHRcdFx0Y3VycmVudERpYWdub3N0aWNzPy5wdXNoKC4uLmRpYWdub3N0aWNzKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNlbmQgZXZlbnQgZm9yIGV4dGVuc2lvbnNcblx0XHR0aGlzLiNvbkRpZENoYW5nZURpYWdub3N0aWNzLmZpcmUodG9TeW5jKTtcblxuXHRcdC8vIGNvbXB1dGUgY2hhbmdlIGFuZCBzZW5kIHRvIG1haW4gc2lkZVxuXHRcdGlmICghdGhpcy4jcHJveHkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZW50cmllczogW1VSSSwgSU1hcmtlckRhdGFbXV1bXSA9IFtdO1xuXHRcdGxldCB0b3RhbE1hcmtlckNvdW50ID0gMDtcblx0XHRmb3IgKGNvbnN0IHVyaSBvZiB0b1N5bmMpIHtcblx0XHRcdGxldCBtYXJrZXI6IElNYXJrZXJEYXRhW10gPSBbXTtcblx0XHRcdGNvbnN0IGRpYWdub3N0aWNzID0gdGhpcy4jZGF0YS5nZXQodXJpKTtcblx0XHRcdGlmIChkaWFnbm9zdGljcykge1xuXG5cdFx0XHRcdC8vIG5vIG1vcmUgdGhhbiBOIGRpYWdub3N0aWNzIHBlciBmaWxlXG5cdFx0XHRcdGlmIChkaWFnbm9zdGljcy5sZW5ndGggPiB0aGlzLl9tYXhEaWFnbm9zdGljc1BlckZpbGUpIHtcblx0XHRcdFx0XHRtYXJrZXIgPSBbXTtcblx0XHRcdFx0XHRjb25zdCBvcmRlciA9IFtEaWFnbm9zdGljU2V2ZXJpdHkuRXJyb3IsIERpYWdub3N0aWNTZXZlcml0eS5XYXJuaW5nLCBEaWFnbm9zdGljU2V2ZXJpdHkuSW5mb3JtYXRpb24sIERpYWdub3N0aWNTZXZlcml0eS5IaW50XTtcblx0XHRcdFx0XHRvcmRlckxvb3A6IGZvciAobGV0IGkgPSAwOyBpIDwgNDsgaSsrKSB7XG5cdFx0XHRcdFx0XHRmb3IgKGNvbnN0IGRpYWdub3N0aWMgb2YgZGlhZ25vc3RpY3MpIHtcblx0XHRcdFx0XHRcdFx0aWYgKGRpYWdub3N0aWMuc2V2ZXJpdHkgPT09IG9yZGVyW2ldKSB7XG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgbGVuID0gbWFya2VyLnB1c2goeyAuLi5jb252ZXJ0ZXIuRGlhZ25vc3RpYy5mcm9tKGRpYWdub3N0aWMpLCBtb2RlbFZlcnNpb25JZDogdGhpcy5fbW9kZWxWZXJzaW9uSWRQcm92aWRlcih1cmkpIH0pO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChsZW4gPT09IHRoaXMuX21heERpYWdub3N0aWNzUGVyRmlsZSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0YnJlYWsgb3JkZXJMb29wO1xuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdC8vIGFkZCAnc2lnbmFsJyBtYXJrZXIgZm9yIHNob3dpbmcgb21pdHRlZCBlcnJvcnMvd2FybmluZ3Ncblx0XHRcdFx0XHRtYXJrZXIucHVzaCh7XG5cdFx0XHRcdFx0XHRzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0XHRcdG1lc3NhZ2U6IGxvY2FsaXplKHsga2V5OiAnbGltaXRIaXQnLCBjb21tZW50OiBbJ2Ftb3VudCBvZiBlcnJvcnMvd2FybmluZyBza2lwcGVkIGR1ZSB0byBsaW1pdHMnXSB9LCBcIk5vdCBzaG93aW5nIHswfSBmdXJ0aGVyIGVycm9ycyBhbmQgd2FybmluZ3MuXCIsIGRpYWdub3N0aWNzLmxlbmd0aCAtIHRoaXMuX21heERpYWdub3N0aWNzUGVyRmlsZSksXG5cdFx0XHRcdFx0XHRzdGFydExpbmVOdW1iZXI6IG1hcmtlclttYXJrZXIubGVuZ3RoIC0gMV0uc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IG1hcmtlclttYXJrZXIubGVuZ3RoIC0gMV0uc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRlbmRMaW5lTnVtYmVyOiBtYXJrZXJbbWFya2VyLmxlbmd0aCAtIDFdLmVuZExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRlbmRDb2x1bW46IG1hcmtlclttYXJrZXIubGVuZ3RoIC0gMV0uZW5kQ29sdW1uXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0bWFya2VyID0gZGlhZ25vc3RpY3MubWFwKGRpYWcgPT4gKHsgLi4uY29udmVydGVyLkRpYWdub3N0aWMuZnJvbShkaWFnKSwgbW9kZWxWZXJzaW9uSWQ6IHRoaXMuX21vZGVsVmVyc2lvbklkUHJvdmlkZXIodXJpKSB9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZW50cmllcy5wdXNoKFt1cmksIG1hcmtlcl0pO1xuXG5cdFx0XHR0b3RhbE1hcmtlckNvdW50ICs9IG1hcmtlci5sZW5ndGg7XG5cdFx0XHRpZiAodG90YWxNYXJrZXJDb3VudCA+IHRoaXMuX21heERpYWdub3N0aWNzVG90YWwpIHtcblx0XHRcdFx0Ly8gaWdub3JlIG1hcmtlcnMgdGhhdCBhcmUgYWJvdmUgdGhlIGxpbWl0XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLiNwcm94eS4kY2hhbmdlTWFueSh0aGlzLl9vd25lciwgZW50cmllcyk7XG5cdH1cblxuXHRkZWxldGUodXJpOiB2c2NvZGUuVXJpKTogdm9pZCB7XG5cdFx0dGhpcy5fY2hlY2tEaXNwb3NlZCgpO1xuXHRcdHRoaXMuI29uRGlkQ2hhbmdlRGlhZ25vc3RpY3MuZmlyZShbdXJpXSk7XG5cdFx0dGhpcy4jZGF0YS5kZWxldGUodXJpKTtcblx0XHR0aGlzLiNwcm94eT8uJGNoYW5nZU1hbnkodGhpcy5fb3duZXIsIFtbdXJpLCB1bmRlZmluZWRdXSk7XG5cdH1cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0dGhpcy4jb25EaWRDaGFuZ2VEaWFnbm9zdGljcy5maXJlKFsuLi50aGlzLiNkYXRhLmtleXMoKV0pO1xuXHRcdHRoaXMuI2RhdGEuY2xlYXIoKTtcblx0XHR0aGlzLiNwcm94eT8uJGNsZWFyKHRoaXMuX293bmVyKTtcblx0fVxuXG5cdGZvckVhY2goY2FsbGJhY2s6ICh1cmk6IFVSSSwgZGlhZ25vc3RpY3M6IFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+LCBjb2xsZWN0aW9uOiBEaWFnbm9zdGljQ29sbGVjdGlvbikgPT4gYW55LCB0aGlzQXJnPzogYW55KTogdm9pZCB7XG5cdFx0dGhpcy5fY2hlY2tEaXNwb3NlZCgpO1xuXHRcdGZvciAoY29uc3QgW3VyaSwgdmFsdWVzXSBvZiB0aGlzKSB7XG5cdFx0XHRjYWxsYmFjay5jYWxsKHRoaXNBcmcsIHVyaSwgdmFsdWVzLCB0aGlzKTtcblx0XHR9XG5cdH1cblxuXHQqW1N5bWJvbC5pdGVyYXRvcl0oKTogSXRlcmFibGVJdGVyYXRvcjxbdXJpOiB2c2NvZGUuVXJpLCBkaWFnbm9zdGljczogcmVhZG9ubHkgdnNjb2RlLkRpYWdub3N0aWNbXV0+IHtcblx0XHR0aGlzLl9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgdGhpcy4jZGF0YS5rZXlzKCkpIHtcblx0XHRcdHlpZWxkIFt1cmksIHRoaXMuZ2V0KHVyaSldO1xuXHRcdH1cblx0fVxuXG5cdGdldCh1cmk6IFVSSSk6IFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+IHtcblx0XHR0aGlzLl9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy4jZGF0YS5nZXQodXJpKTtcblx0XHRpZiAoQXJyYXkuaXNBcnJheShyZXN1bHQpKSB7XG5cdFx0XHRyZXR1cm4gT2JqZWN0LmZyZWV6ZShyZXN1bHQuc2xpY2UoMCkpO1xuXHRcdH1cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRoYXModXJpOiBVUkkpOiBib29sZWFuIHtcblx0XHR0aGlzLl9jaGVja0Rpc3Bvc2VkKCk7XG5cdFx0cmV0dXJuIEFycmF5LmlzQXJyYXkodGhpcy4jZGF0YS5nZXQodXJpKSk7XG5cdH1cblxuXHRwcml2YXRlIF9jaGVja0Rpc3Bvc2VkKCkge1xuXHRcdGlmICh0aGlzLl9pc0Rpc3Bvc2VkKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2lsbGVnYWwgc3RhdGUgLSBvYmplY3QgaXMgZGlzcG9zZWQnKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyBfY29tcGFyZUluZGV4ZWRUdXBsZXNCeVVyaShhOiBbdnNjb2RlLlVyaSwgcmVhZG9ubHkgdnNjb2RlLkRpYWdub3N0aWNbXV0sIGI6IFt2c2NvZGUuVXJpLCByZWFkb25seSB2c2NvZGUuRGlhZ25vc3RpY1tdXSk6IG51bWJlciB7XG5cdFx0aWYgKGFbMF0udG9TdHJpbmcoKSA8IGJbMF0udG9TdHJpbmcoKSkge1xuXHRcdFx0cmV0dXJuIC0xO1xuXHRcdH0gZWxzZSBpZiAoYVswXS50b1N0cmluZygpID4gYlswXS50b1N0cmluZygpKSB7XG5cdFx0XHRyZXR1cm4gMTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRIb3N0RGlhZ25vc3RpY3MgaW1wbGVtZW50cyBFeHRIb3N0RGlhZ25vc3RpY3NTaGFwZSB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2lkUG9vbDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX21heERpYWdub3N0aWNzUGVyRmlsZTogbnVtYmVyID0gMTAwMDtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX21heERpYWdub3N0aWNzVG90YWw6IG51bWJlciA9IDEuMSAqIHRoaXMuX21heERpYWdub3N0aWNzUGVyRmlsZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogTWFpblRocmVhZERpYWdub3N0aWNzU2hhcGU7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbGxlY3Rpb25zID0gbmV3IE1hcDxzdHJpbmcsIERpYWdub3N0aWNDb2xsZWN0aW9uPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZURpYWdub3N0aWNzID0gbmV3IERlYm91bmNlRW1pdHRlcjxyZWFkb25seSB2c2NvZGUuVXJpW10+KHsgbWVyZ2U6IGFsbCA9PiBhbGwuZmxhdCgpLCBkZWxheTogNTAgfSk7XG5cblx0c3RhdGljIF9tYXBwZXIobGFzdDogcmVhZG9ubHkgdnNjb2RlLlVyaVtdKTogeyB1cmlzOiByZWFkb25seSB2c2NvZGUuVXJpW10gfSB7XG5cdFx0Y29uc3QgbWFwID0gbmV3IFJlc291cmNlTWFwPHZzY29kZS5Vcmk+KCk7XG5cdFx0Zm9yIChjb25zdCB1cmkgb2YgbGFzdCkge1xuXHRcdFx0bWFwLnNldCh1cmksIHVyaSk7XG5cdFx0fVxuXHRcdHJldHVybiB7IHVyaXM6IE9iamVjdC5mcmVlemUoQXJyYXkuZnJvbShtYXAudmFsdWVzKCkpKSB9O1xuXHR9XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VEaWFnbm9zdGljczogRXZlbnQ8dnNjb2RlLkRpYWdub3N0aWNDaGFuZ2VFdmVudD4gPSBFdmVudC5tYXAodGhpcy5fb25EaWRDaGFuZ2VEaWFnbm9zdGljcy5ldmVudCwgRXh0SG9zdERpYWdub3N0aWNzLl9tYXBwZXIpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1haW5Db250ZXh0OiBJTWFpbkNvbnRleHQsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0SG9zdEZpbGVTeXN0ZW1JbmZvIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTeXN0ZW1JbmZvU2VydmljZTogSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9yczogRXh0SG9zdERvY3VtZW50c0FuZEVkaXRvcnMsXG5cdCkge1xuXHRcdHRoaXMuX3Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZERpYWdub3N0aWNzKTtcblx0fVxuXG5cdGNyZWF0ZURpYWdub3N0aWNDb2xsZWN0aW9uKGV4dGVuc2lvbklkOiBFeHRlbnNpb25JZGVudGlmaWVyLCBuYW1lPzogc3RyaW5nKTogdnNjb2RlLkRpYWdub3N0aWNDb2xsZWN0aW9uIHtcblxuXHRcdGNvbnN0IHsgX2NvbGxlY3Rpb25zLCBfcHJveHksIF9vbkRpZENoYW5nZURpYWdub3N0aWNzLCBfbG9nU2VydmljZSwgX2ZpbGVTeXN0ZW1JbmZvU2VydmljZSwgX2V4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzIH0gPSB0aGlzO1xuXG5cdFx0Y29uc3QgbG9nZ2luZ1Byb3h5ID0gbmV3IGNsYXNzIGltcGxlbWVudHMgTWFpblRocmVhZERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0JGNoYW5nZU1hbnkob3duZXI6IHN0cmluZywgZW50cmllczogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW10gfCB1bmRlZmluZWRdW10pOiB2b2lkIHtcblx0XHRcdFx0X3Byb3h5LiRjaGFuZ2VNYW55KG93bmVyLCBlbnRyaWVzKTtcblx0XHRcdFx0X2xvZ1NlcnZpY2UudHJhY2UoJ1tEaWFnbm9zdGljQ29sbGVjdGlvbl0gY2hhbmdlIG1hbnkgKGV4dGVuc2lvbiwgb3duZXIsIHVyaXMpJywgZXh0ZW5zaW9uSWQudmFsdWUsIG93bmVyLCBlbnRyaWVzLmxlbmd0aCA9PT0gMCA/ICdDTEVBUklORycgOiBlbnRyaWVzKTtcblx0XHRcdH1cblx0XHRcdCRjbGVhcihvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdF9wcm94eS4kY2xlYXIob3duZXIpO1xuXHRcdFx0XHRfbG9nU2VydmljZS50cmFjZSgnW0RpYWdub3N0aWNDb2xsZWN0aW9uXSByZW1vdmUgYWxsIChleHRlbnNpb24sIG93bmVyKScsIGV4dGVuc2lvbklkLnZhbHVlLCBvd25lcik7XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdFx0XHRfcHJveHkuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cblxuXHRcdGxldCBvd25lcjogc3RyaW5nO1xuXHRcdGlmICghbmFtZSkge1xuXHRcdFx0bmFtZSA9ICdfZ2VuZXJhdGVkX2RpYWdub3N0aWNfY29sbGVjdGlvbl9uYW1lXyMnICsgRXh0SG9zdERpYWdub3N0aWNzLl9pZFBvb2wrKztcblx0XHRcdG93bmVyID0gbmFtZTtcblx0XHR9IGVsc2UgaWYgKCFfY29sbGVjdGlvbnMuaGFzKG5hbWUpKSB7XG5cdFx0XHRvd25lciA9IG5hbWU7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgRGlhZ25vc3RpY0NvbGxlY3Rpb24gd2l0aCBuYW1lICcke25hbWV9JyBkb2VzIGFscmVhZHkgZXhpc3QuYCk7XG5cdFx0XHRkbyB7XG5cdFx0XHRcdG93bmVyID0gbmFtZSArIEV4dEhvc3REaWFnbm9zdGljcy5faWRQb29sKys7XG5cdFx0XHR9IHdoaWxlIChfY29sbGVjdGlvbnMuaGFzKG93bmVyKSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IGNsYXNzIGV4dGVuZHMgRGlhZ25vc3RpY0NvbGxlY3Rpb24ge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKFxuXHRcdFx0XHRcdG5hbWUhLCBvd25lcixcblx0XHRcdFx0XHRFeHRIb3N0RGlhZ25vc3RpY3MuX21heERpYWdub3N0aWNzVG90YWwsXG5cdFx0XHRcdFx0RXh0SG9zdERpYWdub3N0aWNzLl9tYXhEaWFnbm9zdGljc1BlckZpbGUsXG5cdFx0XHRcdFx0dXJpID0+IF9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy5nZXREb2N1bWVudCh1cmkpPy52ZXJzaW9uLFxuXHRcdFx0XHRcdF9maWxlU3lzdGVtSW5mb1NlcnZpY2UuZXh0VXJpLCBsb2dnaW5nUHJveHksIF9vbkRpZENoYW5nZURpYWdub3N0aWNzXG5cdFx0XHRcdCk7XG5cdFx0XHRcdF9jb2xsZWN0aW9ucy5zZXQob3duZXIsIHRoaXMpO1xuXHRcdFx0fVxuXHRcdFx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRcdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdFx0XHRfY29sbGVjdGlvbnMuZGVsZXRlKG93bmVyKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGdldERpYWdub3N0aWNzKHJlc291cmNlOiB2c2NvZGUuVXJpKTogUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz47XG5cdGdldERpYWdub3N0aWNzKCk6IFJlYWRvbmx5QXJyYXk8W3ZzY29kZS5VcmksIFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+XT47XG5cdGdldERpYWdub3N0aWNzKHJlc291cmNlPzogdnNjb2RlLlVyaSk6IFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+IHwgUmVhZG9ubHlBcnJheTxbdnNjb2RlLlVyaSwgUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz5dPjtcblx0Z2V0RGlhZ25vc3RpY3MocmVzb3VyY2U/OiB2c2NvZGUuVXJpKTogUmVhZG9ubHlBcnJheTx2c2NvZGUuRGlhZ25vc3RpYz4gfCBSZWFkb25seUFycmF5PFt2c2NvZGUuVXJpLCBSZWFkb25seUFycmF5PHZzY29kZS5EaWFnbm9zdGljPl0+IHtcblx0XHRpZiAocmVzb3VyY2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9nZXREaWFnbm9zdGljcyhyZXNvdXJjZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGluZGV4ID0gbmV3IE1hcDxzdHJpbmcsIG51bWJlcj4oKTtcblx0XHRcdGNvbnN0IHJlczogW3ZzY29kZS5VcmksIHZzY29kZS5EaWFnbm9zdGljW11dW10gPSBbXTtcblx0XHRcdGZvciAoY29uc3QgY29sbGVjdGlvbiBvZiB0aGlzLl9jb2xsZWN0aW9ucy52YWx1ZXMoKSkge1xuXHRcdFx0XHRjb2xsZWN0aW9uLmZvckVhY2goKHVyaSwgZGlhZ25vc3RpY3MpID0+IHtcblx0XHRcdFx0XHRsZXQgaWR4ID0gaW5kZXguZ2V0KHVyaS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGlkeCA9PT0gJ3VuZGVmaW5lZCcpIHtcblx0XHRcdFx0XHRcdGlkeCA9IHJlcy5sZW5ndGg7XG5cdFx0XHRcdFx0XHRpbmRleC5zZXQodXJpLnRvU3RyaW5nKCksIGlkeCk7XG5cdFx0XHRcdFx0XHRyZXMucHVzaChbdXJpLCBbXV0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXNbaWR4XVsxXSA9IHJlc1tpZHhdWzFdLmNvbmNhdCguLi5kaWFnbm9zdGljcyk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlcztcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIF9nZXREaWFnbm9zdGljcyhyZXNvdXJjZTogdnNjb2RlLlVyaSk6IFJlYWRvbmx5QXJyYXk8dnNjb2RlLkRpYWdub3N0aWM+IHtcblx0XHRsZXQgcmVzOiB2c2NvZGUuRGlhZ25vc3RpY1tdID0gW107XG5cdFx0Zm9yIChjb25zdCBjb2xsZWN0aW9uIG9mIHRoaXMuX2NvbGxlY3Rpb25zLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAoY29sbGVjdGlvbi5oYXMocmVzb3VyY2UpKSB7XG5cdFx0XHRcdHJlcyA9IHJlcy5jb25jYXQoY29sbGVjdGlvbi5nZXQocmVzb3VyY2UpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHJlcztcblx0fVxuXG5cdHByaXZhdGUgX21pcnJvckNvbGxlY3Rpb246IHZzY29kZS5EaWFnbm9zdGljQ29sbGVjdGlvbiB8IHVuZGVmaW5lZDtcblxuXHQkYWNjZXB0TWFya2Vyc0NoYW5nZShkYXRhOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXSk6IHZvaWQge1xuXG5cdFx0aWYgKCF0aGlzLl9taXJyb3JDb2xsZWN0aW9uKSB7XG5cdFx0XHRjb25zdCBuYW1lID0gJ19nZW5lcmF0ZWRfbWlycm9yJztcblx0XHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oXG5cdFx0XHRcdG5hbWUsIG5hbWUsXG5cdFx0XHRcdE51bWJlci5NQVhfU0FGRV9JTlRFR0VSLCBOdW1iZXIuTUFYX1NBRkVfSU5URUdFUiwgLy8gbm8gbGltaXRzIGJlY2F1c2UgdGhpcyBjb2xsZWN0aW9uIGlzIGp1c3QgYSBtaXJyb3Igb2YgXCJzYW5pdGl6ZWRcIiBkYXRhXG5cdFx0XHRcdF91cmkgPT4gdW5kZWZpbmVkLFxuXHRcdFx0XHR0aGlzLl9maWxlU3lzdGVtSW5mb1NlcnZpY2UuZXh0VXJpLCB1bmRlZmluZWQsIHRoaXMuX29uRGlkQ2hhbmdlRGlhZ25vc3RpY3Ncblx0XHRcdCk7XG5cdFx0XHR0aGlzLl9jb2xsZWN0aW9ucy5zZXQobmFtZSwgY29sbGVjdGlvbik7XG5cdFx0XHR0aGlzLl9taXJyb3JDb2xsZWN0aW9uID0gY29sbGVjdGlvbjtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IFt1cmksIG1hcmtlcnNdIG9mIGRhdGEpIHtcblx0XHRcdHRoaXMuX21pcnJvckNvbGxlY3Rpb24uc2V0KFVSSS5yZXZpdmUodXJpKSwgbWFya2Vycy5tYXAoY29udmVydGVyLkRpYWdub3N0aWMudG8pKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBT0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBc0Isc0JBQXNCO0FBQzVDLFNBQVMsV0FBMEI7QUFFbkMsU0FBUyxtQkFBc0Y7QUFDL0YsU0FBUywwQkFBMEI7QUFDbkMsWUFBWSxlQUFlO0FBQzNCLFNBQVMsT0FBZ0IsdUJBQXVCO0FBQ2hELFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsbUJBQW1CO0FBRTVCLFNBQVMsOEJBQThCO0FBSWhDLE1BQU0scUJBQTREO0FBQUEsRUFReEUsWUFDa0IsT0FDQSxRQUNBLHNCQUNBLHdCQUNBLHlCQUNqQixRQUNBLE9BQ0Esd0JBQ0M7QUFSZ0I7QUFDQTtBQUNBO0FBQ0E7QUFDQTtBQVBsQixTQUFRLGNBQWM7QUFZckIsU0FBSyx1QkFBdUIsS0FBSyxJQUFJLHdCQUF3QixvQkFBb0I7QUFDakYsU0FBSyxRQUFRLElBQUksWUFBWSxTQUFPLE9BQU8saUJBQWlC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
