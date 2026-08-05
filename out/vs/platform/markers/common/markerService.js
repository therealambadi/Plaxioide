import { isFalsyOrEmpty, isNonEmptyArray } from "../../../base/common/arrays.js";
import { DebounceEmitter } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { toDisposable } from "../../../base/common/lifecycle.js";
import { ResourceMap, ResourceSet } from "../../../base/common/map.js";
import { Schemas } from "../../../base/common/network.js";
import { URI } from "../../../base/common/uri.js";
import { localize } from "../../../nls.js";
import { MarkerSeverity } from "./markers.js";
const unsupportedSchemas = /* @__PURE__ */ new Set([
  Schemas.inMemory,
  Schemas.vscodeSourceControl,
  Schemas.walkThrough,
  Schemas.walkThroughSnippet,
  Schemas.vscodeChatCodeBlock
]);
class DoubleResourceMap {
  constructor() {
    this._byResource = new ResourceMap();
    this._byOwner = /* @__PURE__ */ new Map();
  }
  set(resource, owner, value) {
    let ownerMap = this._byResource.get(resource);
    if (!ownerMap) {
      ownerMap = /* @__PURE__ */ new Map();
      this._byResource.set(resource, ownerMap);
    }
    ownerMap.set(owner, value);
    let resourceMap = this._byOwner.get(owner);
    if (!resourceMap) {
      resourceMap = new ResourceMap();
      this._byOwner.set(owner, resourceMap);
    }
    resourceMap.set(resource, value);
  }
  get(resource, owner) {
    const ownerMap = this._byResource.get(resource);
    return ownerMap?.get(owner);
  }
  delete(resource, owner) {
    let removedA = false;
    let removedB = false;
    const ownerMap = this._byResource.get(resource);
    if (ownerMap) {
      removedA = ownerMap.delete(owner);
    }
    const resourceMap = this._byOwner.get(owner);
    if (resourceMap) {
      removedB = resourceMap.delete(resource);
    }
    if (removedA !== removedB) {
      throw new Error("illegal state");
    }
    return removedA && removedB;
  }
  values(key) {
    if (typeof key === "string") {
      return this._byOwner.get(key)?.values() ?? Iterable.empty();
    }
    if (URI.isUri(key)) {
      return this._byResource.get(key)?.values() ?? Iterable.empty();
    }
    return Iterable.map(Iterable.concat(...this._byOwner.values()), (map) => map[1]);
  }
}
class MarkerStats {
  constructor(service) {
    this.errors = 0;
    this.infos = 0;
    this.warnings = 0;
    this.unknowns = 0;
    this._data = new ResourceMap();
    this._service = service;
    this._subscription = service.onMarkerChanged(this._update, this);
  }
  dispose() {
    this._subscription.dispose();
  }
  _update(resources) {
    for (const resource of resources) {
      const oldStats = this._data.get(resource);
      if (oldStats) {
        this._substract(oldStats);
      }
      const newStats = this._resourceStats(resource);
      this._add(newStats);
      this._data.set(resource, newStats);
    }
  }
  _resourceStats(resource) {
    const result = { errors: 0, warnings: 0, infos: 0, unknowns: 0 };
    if (unsupportedSchemas.has(resource.scheme)) {
      return result;
    }
    for (const { severity } of this._service.read({ resource })) {
      if (severity === MarkerSeverity.Error) {
        result.errors += 1;
      } else if (severity === MarkerSeverity.Warning) {
        result.warnings += 1;
      } else if (severity === MarkerSeverity.Info) {
        result.infos += 1;
      } else {
        result.unknowns += 1;
      }
    }
    return result;
  }
  _substract(op) {
    this.errors -= op.errors;
    this.warnings -= op.warnings;
    this.infos -= op.infos;
    this.unknowns -= op.unknowns;
  }
  _add(op) {
    this.errors += op.errors;
    this.warnings += op.warnings;
    this.infos += op.infos;
    this.unknowns += op.unknowns;
  }
}
class MarkerService {
  constructor() {
    this._onMarkerChanged = new DebounceEmitter({
      delay: 0,
      merge: MarkerService._merge
    });
    this.onMarkerChanged = this._onMarkerChanged.event;
    this._data = new DoubleResourceMap();
    this._stats = new MarkerStats(this);
    this._filteredResources = new ResourceMap();
  }
  dispose() {
    this._stats.dispose();
    this._onMarkerChanged.dispose();
  }
  getStatistics() {
    return this._stats;
  }
  remove(owner, resources) {
    for (const resource of resources || []) {
      this.changeOne(owner, resource, []);
    }
  }
  changeOne(owner, resource, markerData) {
    if (isFalsyOrEmpty(markerData)) {
      const removed = this._data.delete(resource, owner);
      if (removed) {
        this._onMarkerChanged.fire([resource]);
      }
    } else {
      const markers = [];
      for (const data of markerData) {
        const marker = MarkerService._toMarker(owner, resource, data);
        if (marker) {
          markers.push(marker);
        }
      }
      this._data.set(resource, owner, markers);
      this._onMarkerChanged.fire([resource]);
    }
  }
  installResourceFilter(resource, reason) {
    let reasons = this._filteredResources.get(resource);
    if (!reasons) {
      reasons = [];
      this._filteredResources.set(resource, reasons);
    }
    reasons.push(reason);
    this._onMarkerChanged.fire([resource]);
    return toDisposable(() => {
      const reasons2 = this._filteredResources.get(resource);
      if (!reasons2) {
        return;
      }
      const reasonIndex = reasons2.indexOf(reason);
      if (reasonIndex !== -1) {
        reasons2.splice(reasonIndex, 1);
        if (reasons2.length === 0) {
          this._filteredResources.delete(resource);
        }
        this._onMarkerChanged.fire([resource]);
      }
    });
  }
  static _toMarker(owner, resource, data) {
    let {
      code,
      severity,
      message,
      source,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
      relatedInformation,
      tags
    } = data;
    if (!message) {
      return void 0;
    }
    startLineNumber = startLineNumber > 0 ? startLineNumber : 1;
    startColumn = startColumn > 0 ? startColumn : 1;
    endLineNumber = endLineNumber >= startLineNumber ? endLineNumber : startLineNumber;
    endColumn = endColumn > 0 ? endColumn : startColumn;
    return {
      resource,
      owner,
      code,
      severity,
      message,
      source,
      startLineNumber,
      startColumn,
      endLineNumber,
      endColumn,
      relatedInformation,
      tags
    };
  }
  changeAll(owner, data) {
    const changes = [];
    const existing = this._data.values(owner);
    if (existing) {
      for (const data2 of existing) {
        const first = Iterable.first(data2);
        if (first) {
          changes.push(first.resource);
          this._data.delete(first.resource, owner);
        }
      }
    }
    if (isNonEmptyArray(data)) {
      const groups = new ResourceMap();
      for (const { resource, marker: markerData } of data) {
        const marker = MarkerService._toMarker(owner, resource, markerData);
        if (!marker) {
          continue;
        }
        const array = groups.get(resource);
        if (!array) {
          groups.set(resource, [marker]);
          changes.push(resource);
        } else {
          array.push(marker);
        }
      }
      for (const [resource, value] of groups) {
        this._data.set(resource, owner, value);
      }
    }
    if (changes.length > 0) {
      this._onMarkerChanged.fire(changes);
    }
  }
  /**
   * Creates an information marker for filtered resources
   */
  _createFilteredMarker(resource, reasons) {
    const message = reasons.length === 1 ? localize("filtered", 'Problems are paused because: "{0}"', reasons[0]) : localize("filtered.network", 'Problems are paused because: "{0}" and {1} more', reasons[0], reasons.length - 1);
    return {
      owner: "markersFilter",
      resource,
      severity: MarkerSeverity.Info,
      message,
      startLineNumber: 1,
      startColumn: 1,
      endLineNumber: 1,
      endColumn: 1
    };
  }
  read(filter = /* @__PURE__ */ Object.create(null)) {
    let { owner, resource, severities, take } = filter;
    if (!take || take < 0) {
      take = -1;
    }
    if (owner && resource) {
      const reasons = this._filteredResources.get(resource);
      if (reasons?.length) {
        const infoMarker = this._createFilteredMarker(resource, reasons);
        return [infoMarker];
      }
      const data = this._data.get(resource, owner);
      if (!data) {
        return [];
      }
      const result = [];
      for (const marker of data) {
        if (take > 0 && result.length === take) {
          break;
        }
        const reasons2 = this._filteredResources.get(resource);
        if (reasons2?.length) {
          result.push(this._createFilteredMarker(resource, reasons2));
        } else if (MarkerService._accept(marker, severities)) {
          result.push(marker);
        }
      }
      return result;
    } else {
      const iterable = !owner && !resource ? this._data.values() : this._data.values(resource ?? owner);
      const result = [];
      const filtered = new ResourceSet();
      for (const markers of iterable) {
        for (const data of markers) {
          if (filtered.has(data.resource)) {
            continue;
          }
          if (take > 0 && result.length === take) {
            break;
          }
          const reasons = this._filteredResources.get(data.resource);
          if (reasons?.length) {
            result.push(this._createFilteredMarker(data.resource, reasons));
            filtered.add(data.resource);
          } else if (MarkerService._accept(data, severities)) {
            result.push(data);
          }
        }
      }
      return result;
    }
  }
  static _accept(marker, severities) {
    return severities === void 0 || (severities & marker.severity) === marker.severity;
  }
  // --- event debounce logic
  static _merge(all) {
    const set = new ResourceMap();
    for (const array of all) {
      for (const item of array) {
        set.set(item, true);
      }
    }
    return Array.from(set.keys());
  }
}
export {
  MarkerService,
  unsupportedSchemas
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9tYXJrZXJzL2NvbW1vbi9tYXJrZXJTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgaXNGYWxzeU9yRW1wdHksIGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBEZWJvdW5jZUVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgUmVzb3VyY2VNYXAsIFJlc291cmNlU2V0IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyLCBJTWFya2VyRGF0YSwgSU1hcmtlclNlcnZpY2UsIElSZXNvdXJjZU1hcmtlciwgTWFya2VyU2V2ZXJpdHksIE1hcmtlclN0YXRpc3RpY3MgfSBmcm9tICcuL21hcmtlcnMuanMnO1xuXG5leHBvcnQgY29uc3QgdW5zdXBwb3J0ZWRTY2hlbWFzID0gbmV3IFNldChbXG5cdFNjaGVtYXMuaW5NZW1vcnksXG5cdFNjaGVtYXMudnNjb2RlU291cmNlQ29udHJvbCxcblx0U2NoZW1hcy53YWxrVGhyb3VnaCxcblx0U2NoZW1hcy53YWxrVGhyb3VnaFNuaXBwZXQsXG5cdFNjaGVtYXMudnNjb2RlQ2hhdENvZGVCbG9jayxcbl0pO1xuXG5jbGFzcyBEb3VibGVSZXNvdXJjZU1hcDxWPiB7XG5cblx0cHJpdmF0ZSBfYnlSZXNvdXJjZSA9IG5ldyBSZXNvdXJjZU1hcDxNYXA8c3RyaW5nLCBWPj4oKTtcblx0cHJpdmF0ZSBfYnlPd25lciA9IG5ldyBNYXA8c3RyaW5nLCBSZXNvdXJjZU1hcDxWPj4oKTtcblxuXHRzZXQocmVzb3VyY2U6IFVSSSwgb3duZXI6IHN0cmluZywgdmFsdWU6IFYpIHtcblx0XHRsZXQgb3duZXJNYXAgPSB0aGlzLl9ieVJlc291cmNlLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKCFvd25lck1hcCkge1xuXHRcdFx0b3duZXJNYXAgPSBuZXcgTWFwKCk7XG5cdFx0XHR0aGlzLl9ieVJlc291cmNlLnNldChyZXNvdXJjZSwgb3duZXJNYXApO1xuXHRcdH1cblx0XHRvd25lck1hcC5zZXQob3duZXIsIHZhbHVlKTtcblxuXHRcdGxldCByZXNvdXJjZU1hcCA9IHRoaXMuX2J5T3duZXIuZ2V0KG93bmVyKTtcblx0XHRpZiAoIXJlc291cmNlTWFwKSB7XG5cdFx0XHRyZXNvdXJjZU1hcCA9IG5ldyBSZXNvdXJjZU1hcCgpO1xuXHRcdFx0dGhpcy5fYnlPd25lci5zZXQob3duZXIsIHJlc291cmNlTWFwKTtcblx0XHR9XG5cdFx0cmVzb3VyY2VNYXAuc2V0KHJlc291cmNlLCB2YWx1ZSk7XG5cdH1cblxuXHRnZXQocmVzb3VyY2U6IFVSSSwgb3duZXI6IHN0cmluZyk6IFYgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IG93bmVyTWFwID0gdGhpcy5fYnlSZXNvdXJjZS5nZXQocmVzb3VyY2UpO1xuXHRcdHJldHVybiBvd25lck1hcD8uZ2V0KG93bmVyKTtcblx0fVxuXG5cdGRlbGV0ZShyZXNvdXJjZTogVVJJLCBvd25lcjogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0bGV0IHJlbW92ZWRBID0gZmFsc2U7XG5cdFx0bGV0IHJlbW92ZWRCID0gZmFsc2U7XG5cdFx0Y29uc3Qgb3duZXJNYXAgPSB0aGlzLl9ieVJlc291cmNlLmdldChyZXNvdXJjZSk7XG5cdFx0aWYgKG93bmVyTWFwKSB7XG5cdFx0XHRyZW1vdmVkQSA9IG93bmVyTWFwLmRlbGV0ZShvd25lcik7XG5cdFx0fVxuXHRcdGNvbnN0IHJlc291cmNlTWFwID0gdGhpcy5fYnlPd25lci5nZXQob3duZXIpO1xuXHRcdGlmIChyZXNvdXJjZU1hcCkge1xuXHRcdFx0cmVtb3ZlZEIgPSByZXNvdXJjZU1hcC5kZWxldGUocmVzb3VyY2UpO1xuXHRcdH1cblx0XHRpZiAocmVtb3ZlZEEgIT09IHJlbW92ZWRCKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ2lsbGVnYWwgc3RhdGUnKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlbW92ZWRBICYmIHJlbW92ZWRCO1xuXHR9XG5cblx0dmFsdWVzKGtleT86IFVSSSB8IHN0cmluZyk6IEl0ZXJhYmxlPFY+IHtcblx0XHRpZiAodHlwZW9mIGtleSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ieU93bmVyLmdldChrZXkpPy52YWx1ZXMoKSA/PyBJdGVyYWJsZS5lbXB0eSgpO1xuXHRcdH1cblx0XHRpZiAoVVJJLmlzVXJpKGtleSkpIHtcblx0XHRcdHJldHVybiB0aGlzLl9ieVJlc291cmNlLmdldChrZXkpPy52YWx1ZXMoKSA/PyBJdGVyYWJsZS5lbXB0eSgpO1xuXHRcdH1cblxuXHRcdHJldHVybiBJdGVyYWJsZS5tYXAoSXRlcmFibGUuY29uY2F0KC4uLnRoaXMuX2J5T3duZXIudmFsdWVzKCkpLCBtYXAgPT4gbWFwWzFdKTtcblx0fVxufVxuXG5jbGFzcyBNYXJrZXJTdGF0cyBpbXBsZW1lbnRzIE1hcmtlclN0YXRpc3RpY3Mge1xuXG5cdGVycm9yczogbnVtYmVyID0gMDtcblx0aW5mb3M6IG51bWJlciA9IDA7XG5cdHdhcm5pbmdzOiBudW1iZXIgPSAwO1xuXHR1bmtub3duczogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kYXRhID0gbmV3IFJlc291cmNlTWFwPE1hcmtlclN0YXRpc3RpY3M+KCk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX3NlcnZpY2U6IElNYXJrZXJTZXJ2aWNlO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9zdWJzY3JpcHRpb246IElEaXNwb3NhYmxlO1xuXG5cdGNvbnN0cnVjdG9yKHNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlKSB7XG5cdFx0dGhpcy5fc2VydmljZSA9IHNlcnZpY2U7XG5cdFx0dGhpcy5fc3Vic2NyaXB0aW9uID0gc2VydmljZS5vbk1hcmtlckNoYW5nZWQodGhpcy5fdXBkYXRlLCB0aGlzKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3Vic2NyaXB0aW9uLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZShyZXNvdXJjZXM6IHJlYWRvbmx5IFVSSVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMpIHtcblx0XHRcdGNvbnN0IG9sZFN0YXRzID0gdGhpcy5fZGF0YS5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKG9sZFN0YXRzKSB7XG5cdFx0XHRcdHRoaXMuX3N1YnN0cmFjdChvbGRTdGF0cyk7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBuZXdTdGF0cyA9IHRoaXMuX3Jlc291cmNlU3RhdHMocmVzb3VyY2UpO1xuXHRcdFx0dGhpcy5fYWRkKG5ld1N0YXRzKTtcblx0XHRcdHRoaXMuX2RhdGEuc2V0KHJlc291cmNlLCBuZXdTdGF0cyk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfcmVzb3VyY2VTdGF0cyhyZXNvdXJjZTogVVJJKTogTWFya2VyU3RhdGlzdGljcyB7XG5cdFx0Y29uc3QgcmVzdWx0OiBNYXJrZXJTdGF0aXN0aWNzID0geyBlcnJvcnM6IDAsIHdhcm5pbmdzOiAwLCBpbmZvczogMCwgdW5rbm93bnM6IDAgfTtcblxuXHRcdC8vIFRPRE8gdGhpcyBpcyBhIGhhY2tcblx0XHRpZiAodW5zdXBwb3J0ZWRTY2hlbWFzLmhhcyhyZXNvdXJjZS5zY2hlbWUpKSB7XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgeyBzZXZlcml0eSB9IG9mIHRoaXMuX3NlcnZpY2UucmVhZCh7IHJlc291cmNlIH0pKSB7XG5cdFx0XHRpZiAoc2V2ZXJpdHkgPT09IE1hcmtlclNldmVyaXR5LkVycm9yKSB7XG5cdFx0XHRcdHJlc3VsdC5lcnJvcnMgKz0gMTtcblx0XHRcdH0gZWxzZSBpZiAoc2V2ZXJpdHkgPT09IE1hcmtlclNldmVyaXR5Lldhcm5pbmcpIHtcblx0XHRcdFx0cmVzdWx0Lndhcm5pbmdzICs9IDE7XG5cdFx0XHR9IGVsc2UgaWYgKHNldmVyaXR5ID09PSBNYXJrZXJTZXZlcml0eS5JbmZvKSB7XG5cdFx0XHRcdHJlc3VsdC5pbmZvcyArPSAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cmVzdWx0LnVua25vd25zICs9IDE7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByaXZhdGUgX3N1YnN0cmFjdChvcDogTWFya2VyU3RhdGlzdGljcykge1xuXHRcdHRoaXMuZXJyb3JzIC09IG9wLmVycm9ycztcblx0XHR0aGlzLndhcm5pbmdzIC09IG9wLndhcm5pbmdzO1xuXHRcdHRoaXMuaW5mb3MgLT0gb3AuaW5mb3M7XG5cdFx0dGhpcy51bmtub3ducyAtPSBvcC51bmtub3ducztcblx0fVxuXG5cdHByaXZhdGUgX2FkZChvcDogTWFya2VyU3RhdGlzdGljcykge1xuXHRcdHRoaXMuZXJyb3JzICs9IG9wLmVycm9ycztcblx0XHR0aGlzLndhcm5pbmdzICs9IG9wLndhcm5pbmdzO1xuXHRcdHRoaXMuaW5mb3MgKz0gb3AuaW5mb3M7XG5cdFx0dGhpcy51bmtub3ducyArPSBvcC51bmtub3ducztcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgTWFya2VyU2VydmljZSBpbXBsZW1lbnRzIElNYXJrZXJTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbk1hcmtlckNoYW5nZWQgPSBuZXcgRGVib3VuY2VFbWl0dGVyPHJlYWRvbmx5IFVSSVtdPih7XG5cdFx0ZGVsYXk6IDAsXG5cdFx0bWVyZ2U6IE1hcmtlclNlcnZpY2UuX21lcmdlXG5cdH0pO1xuXG5cdHJlYWRvbmx5IG9uTWFya2VyQ2hhbmdlZCA9IHRoaXMuX29uTWFya2VyQ2hhbmdlZC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9kYXRhID0gbmV3IERvdWJsZVJlc291cmNlTWFwPElNYXJrZXJbXT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RhdHMgPSBuZXcgTWFya2VyU3RhdHModGhpcyk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZpbHRlcmVkUmVzb3VyY2VzID0gbmV3IFJlc291cmNlTWFwPHN0cmluZ1tdPigpO1xuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fc3RhdHMuZGlzcG9zZSgpO1xuXHRcdHRoaXMuX29uTWFya2VyQ2hhbmdlZC5kaXNwb3NlKCk7XG5cdH1cblxuXHRnZXRTdGF0aXN0aWNzKCk6IE1hcmtlclN0YXRpc3RpY3Mge1xuXHRcdHJldHVybiB0aGlzLl9zdGF0cztcblx0fVxuXG5cdHJlbW92ZShvd25lcjogc3RyaW5nLCByZXNvdXJjZXM6IFVSSVtdKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiByZXNvdXJjZXMgfHwgW10pIHtcblx0XHRcdHRoaXMuY2hhbmdlT25lKG93bmVyLCByZXNvdXJjZSwgW10pO1xuXHRcdH1cblx0fVxuXG5cdGNoYW5nZU9uZShvd25lcjogc3RyaW5nLCByZXNvdXJjZTogVVJJLCBtYXJrZXJEYXRhOiBJTWFya2VyRGF0YVtdKTogdm9pZCB7XG5cblx0XHRpZiAoaXNGYWxzeU9yRW1wdHkobWFya2VyRGF0YSkpIHtcblx0XHRcdC8vIHJlbW92ZSBtYXJrZXIgZm9yIHRoaXMgKG93bmVyLHJlc291cmNlKS10dXBsZVxuXHRcdFx0Y29uc3QgcmVtb3ZlZCA9IHRoaXMuX2RhdGEuZGVsZXRlKHJlc291cmNlLCBvd25lcik7XG5cdFx0XHRpZiAocmVtb3ZlZCkge1xuXHRcdFx0XHR0aGlzLl9vbk1hcmtlckNoYW5nZWQuZmlyZShbcmVzb3VyY2VdKTtcblx0XHRcdH1cblxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBpbnNlcnQgbWFya2VyIGZvciB0aGlzIChvd25lcixyZXNvdXJjZSktdHVwbGVcblx0XHRcdGNvbnN0IG1hcmtlcnM6IElNYXJrZXJbXSA9IFtdO1xuXHRcdFx0Zm9yIChjb25zdCBkYXRhIG9mIG1hcmtlckRhdGEpIHtcblx0XHRcdFx0Y29uc3QgbWFya2VyID0gTWFya2VyU2VydmljZS5fdG9NYXJrZXIob3duZXIsIHJlc291cmNlLCBkYXRhKTtcblx0XHRcdFx0aWYgKG1hcmtlcikge1xuXHRcdFx0XHRcdG1hcmtlcnMucHVzaChtYXJrZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9kYXRhLnNldChyZXNvdXJjZSwgb3duZXIsIG1hcmtlcnMpO1xuXHRcdFx0dGhpcy5fb25NYXJrZXJDaGFuZ2VkLmZpcmUoW3Jlc291cmNlXSk7XG5cdFx0fVxuXHR9XG5cblx0aW5zdGFsbFJlc291cmNlRmlsdGVyKHJlc291cmNlOiBVUkksIHJlYXNvbjogc3RyaW5nKTogSURpc3Bvc2FibGUge1xuXHRcdGxldCByZWFzb25zID0gdGhpcy5fZmlsdGVyZWRSZXNvdXJjZXMuZ2V0KHJlc291cmNlKTtcblxuXHRcdGlmICghcmVhc29ucykge1xuXHRcdFx0cmVhc29ucyA9IFtdO1xuXHRcdFx0dGhpcy5fZmlsdGVyZWRSZXNvdXJjZXMuc2V0KHJlc291cmNlLCByZWFzb25zKTtcblx0XHR9XG5cdFx0cmVhc29ucy5wdXNoKHJlYXNvbik7XG5cdFx0dGhpcy5fb25NYXJrZXJDaGFuZ2VkLmZpcmUoW3Jlc291cmNlXSk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGNvbnN0IHJlYXNvbnMgPSB0aGlzLl9maWx0ZXJlZFJlc291cmNlcy5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKCFyZWFzb25zKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdGNvbnN0IHJlYXNvbkluZGV4ID0gcmVhc29ucy5pbmRleE9mKHJlYXNvbik7XG5cdFx0XHRpZiAocmVhc29uSW5kZXggIT09IC0xKSB7XG5cdFx0XHRcdHJlYXNvbnMuc3BsaWNlKHJlYXNvbkluZGV4LCAxKTtcblx0XHRcdFx0aWYgKHJlYXNvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5fZmlsdGVyZWRSZXNvdXJjZXMuZGVsZXRlKHJlc291cmNlKTtcblx0XHRcdFx0fVxuXHRcdFx0XHR0aGlzLl9vbk1hcmtlckNoYW5nZWQuZmlyZShbcmVzb3VyY2VdKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGljIF90b01hcmtlcihvd25lcjogc3RyaW5nLCByZXNvdXJjZTogVVJJLCBkYXRhOiBJTWFya2VyRGF0YSk6IElNYXJrZXIgfCB1bmRlZmluZWQge1xuXHRcdGxldCB7XG5cdFx0XHRjb2RlLCBzZXZlcml0eSxcblx0XHRcdG1lc3NhZ2UsIHNvdXJjZSxcblx0XHRcdHN0YXJ0TGluZU51bWJlciwgc3RhcnRDb2x1bW4sIGVuZExpbmVOdW1iZXIsIGVuZENvbHVtbixcblx0XHRcdHJlbGF0ZWRJbmZvcm1hdGlvbixcblx0XHRcdHRhZ3MsXG5cdFx0fSA9IGRhdGE7XG5cblx0XHRpZiAoIW1lc3NhZ2UpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gc2FudGl6ZSBkYXRhXG5cdFx0c3RhcnRMaW5lTnVtYmVyID0gc3RhcnRMaW5lTnVtYmVyID4gMCA/IHN0YXJ0TGluZU51bWJlciA6IDE7XG5cdFx0c3RhcnRDb2x1bW4gPSBzdGFydENvbHVtbiA+IDAgPyBzdGFydENvbHVtbiA6IDE7XG5cdFx0ZW5kTGluZU51bWJlciA9IGVuZExpbmVOdW1iZXIgPj0gc3RhcnRMaW5lTnVtYmVyID8gZW5kTGluZU51bWJlciA6IHN0YXJ0TGluZU51bWJlcjtcblx0XHRlbmRDb2x1bW4gPSBlbmRDb2x1bW4gPiAwID8gZW5kQ29sdW1uIDogc3RhcnRDb2x1bW47XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzb3VyY2UsXG5cdFx0XHRvd25lcixcblx0XHRcdGNvZGUsXG5cdFx0XHRzZXZlcml0eSxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRzb3VyY2UsXG5cdFx0XHRzdGFydExpbmVOdW1iZXIsXG5cdFx0XHRzdGFydENvbHVtbixcblx0XHRcdGVuZExpbmVOdW1iZXIsXG5cdFx0XHRlbmRDb2x1bW4sXG5cdFx0XHRyZWxhdGVkSW5mb3JtYXRpb24sXG5cdFx0XHR0YWdzLFxuXHRcdH07XG5cdH1cblxuXHRjaGFuZ2VBbGwob3duZXI6IHN0cmluZywgZGF0YTogSVJlc291cmNlTWFya2VyW10pOiB2b2lkIHtcblx0XHRjb25zdCBjaGFuZ2VzOiBVUklbXSA9IFtdO1xuXG5cdFx0Ly8gcmVtb3ZlIG9sZCBtYXJrZXJcblx0XHRjb25zdCBleGlzdGluZyA9IHRoaXMuX2RhdGEudmFsdWVzKG93bmVyKTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdGZvciAoY29uc3QgZGF0YSBvZiBleGlzdGluZykge1xuXHRcdFx0XHRjb25zdCBmaXJzdCA9IEl0ZXJhYmxlLmZpcnN0KGRhdGEpO1xuXHRcdFx0XHRpZiAoZmlyc3QpIHtcblx0XHRcdFx0XHRjaGFuZ2VzLnB1c2goZmlyc3QucmVzb3VyY2UpO1xuXHRcdFx0XHRcdHRoaXMuX2RhdGEuZGVsZXRlKGZpcnN0LnJlc291cmNlLCBvd25lcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBhZGQgbmV3IG1hcmtlcnNcblx0XHRpZiAoaXNOb25FbXB0eUFycmF5KGRhdGEpKSB7XG5cblx0XHRcdC8vIGdyb3VwIGJ5IHJlc291cmNlXG5cdFx0XHRjb25zdCBncm91cHMgPSBuZXcgUmVzb3VyY2VNYXA8SU1hcmtlcltdPigpO1xuXHRcdFx0Zm9yIChjb25zdCB7IHJlc291cmNlLCBtYXJrZXI6IG1hcmtlckRhdGEgfSBvZiBkYXRhKSB7XG5cdFx0XHRcdGNvbnN0IG1hcmtlciA9IE1hcmtlclNlcnZpY2UuX3RvTWFya2VyKG93bmVyLCByZXNvdXJjZSwgbWFya2VyRGF0YSk7XG5cdFx0XHRcdGlmICghbWFya2VyKSB7XG5cdFx0XHRcdFx0Ly8gZmlsdGVyIGJhZCBtYXJrZXJzXG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgYXJyYXkgPSBncm91cHMuZ2V0KHJlc291cmNlKTtcblx0XHRcdFx0aWYgKCFhcnJheSkge1xuXHRcdFx0XHRcdGdyb3Vwcy5zZXQocmVzb3VyY2UsIFttYXJrZXJdKTtcblx0XHRcdFx0XHRjaGFuZ2VzLnB1c2gocmVzb3VyY2UpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGFycmF5LnB1c2gobWFya2VyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyBpbnNlcnQgYWxsXG5cdFx0XHRmb3IgKGNvbnN0IFtyZXNvdXJjZSwgdmFsdWVdIG9mIGdyb3Vwcykge1xuXHRcdFx0XHR0aGlzLl9kYXRhLnNldChyZXNvdXJjZSwgb3duZXIsIHZhbHVlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRpZiAoY2hhbmdlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHR0aGlzLl9vbk1hcmtlckNoYW5nZWQuZmlyZShjaGFuZ2VzKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogQ3JlYXRlcyBhbiBpbmZvcm1hdGlvbiBtYXJrZXIgZm9yIGZpbHRlcmVkIHJlc291cmNlc1xuXHQgKi9cblx0cHJpdmF0ZSBfY3JlYXRlRmlsdGVyZWRNYXJrZXIocmVzb3VyY2U6IFVSSSwgcmVhc29uczogc3RyaW5nW10pOiBJTWFya2VyIHtcblx0XHRjb25zdCBtZXNzYWdlID0gcmVhc29ucy5sZW5ndGggPT09IDFcblx0XHRcdD8gbG9jYWxpemUoJ2ZpbHRlcmVkJywgXCJQcm9ibGVtcyBhcmUgcGF1c2VkIGJlY2F1c2U6IFxcXCJ7MH1cXFwiXCIsIHJlYXNvbnNbMF0pXG5cdFx0XHQ6IGxvY2FsaXplKCdmaWx0ZXJlZC5uZXR3b3JrJywgXCJQcm9ibGVtcyBhcmUgcGF1c2VkIGJlY2F1c2U6IFxcXCJ7MH1cXFwiIGFuZCB7MX0gbW9yZVwiLCByZWFzb25zWzBdLCByZWFzb25zLmxlbmd0aCAtIDEpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdG93bmVyOiAnbWFya2Vyc0ZpbHRlcicsXG5cdFx0XHRyZXNvdXJjZSxcblx0XHRcdHNldmVyaXR5OiBNYXJrZXJTZXZlcml0eS5JbmZvLFxuXHRcdFx0bWVzc2FnZSxcblx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdHN0YXJ0Q29sdW1uOiAxLFxuXHRcdFx0ZW5kTGluZU51bWJlcjogMSxcblx0XHRcdGVuZENvbHVtbjogMSxcblx0XHR9O1xuXHR9XG5cblx0cmVhZChmaWx0ZXI6IHsgb3duZXI/OiBzdHJpbmc7IHJlc291cmNlPzogVVJJOyBzZXZlcml0aWVzPzogbnVtYmVyOyB0YWtlPzogbnVtYmVyIH0gPSBPYmplY3QuY3JlYXRlKG51bGwpKTogSU1hcmtlcltdIHtcblxuXHRcdGxldCB7IG93bmVyLCByZXNvdXJjZSwgc2V2ZXJpdGllcywgdGFrZSB9ID0gZmlsdGVyO1xuXG5cdFx0aWYgKCF0YWtlIHx8IHRha2UgPCAwKSB7XG5cdFx0XHR0YWtlID0gLTE7XG5cdFx0fVxuXG5cdFx0aWYgKG93bmVyICYmIHJlc291cmNlKSB7XG5cdFx0XHQvLyBleGFjdGx5IG9uZSBvd25lciBBTkQgcmVzb3VyY2Vcblx0XHRcdGNvbnN0IHJlYXNvbnMgPSB0aGlzLl9maWx0ZXJlZFJlc291cmNlcy5nZXQocmVzb3VyY2UpO1xuXHRcdFx0aWYgKHJlYXNvbnM/Lmxlbmd0aCkge1xuXHRcdFx0XHRjb25zdCBpbmZvTWFya2VyID0gdGhpcy5fY3JlYXRlRmlsdGVyZWRNYXJrZXIocmVzb3VyY2UsIHJlYXNvbnMpO1xuXHRcdFx0XHRyZXR1cm4gW2luZm9NYXJrZXJdO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBkYXRhID0gdGhpcy5fZGF0YS5nZXQocmVzb3VyY2UsIG93bmVyKTtcblx0XHRcdGlmICghZGF0YSkge1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogSU1hcmtlcltdID0gW107XG5cdFx0XHRmb3IgKGNvbnN0IG1hcmtlciBvZiBkYXRhKSB7XG5cdFx0XHRcdGlmICh0YWtlID4gMCAmJiByZXN1bHQubGVuZ3RoID09PSB0YWtlKSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgcmVhc29ucyA9IHRoaXMuX2ZpbHRlcmVkUmVzb3VyY2VzLmdldChyZXNvdXJjZSk7XG5cdFx0XHRcdGlmIChyZWFzb25zPy5sZW5ndGgpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaCh0aGlzLl9jcmVhdGVGaWx0ZXJlZE1hcmtlcihyZXNvdXJjZSwgcmVhc29ucykpO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoTWFya2VyU2VydmljZS5fYWNjZXB0KG1hcmtlciwgc2V2ZXJpdGllcykpIHtcblx0XHRcdFx0XHRyZXN1bHQucHVzaChtYXJrZXIpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIG9mIG9uZSByZXNvdXJjZSBPUiBvd25lclxuXHRcdFx0Y29uc3QgaXRlcmFibGUgPSAhb3duZXIgJiYgIXJlc291cmNlXG5cdFx0XHRcdD8gdGhpcy5fZGF0YS52YWx1ZXMoKVxuXHRcdFx0XHQ6IHRoaXMuX2RhdGEudmFsdWVzKHJlc291cmNlID8/IG93bmVyISk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogSU1hcmtlcltdID0gW107XG5cdFx0XHRjb25zdCBmaWx0ZXJlZCA9IG5ldyBSZXNvdXJjZVNldCgpO1xuXG5cdFx0XHRmb3IgKGNvbnN0IG1hcmtlcnMgb2YgaXRlcmFibGUpIHtcblx0XHRcdFx0Zm9yIChjb25zdCBkYXRhIG9mIG1hcmtlcnMpIHtcblx0XHRcdFx0XHRpZiAoZmlsdGVyZWQuaGFzKGRhdGEucmVzb3VyY2UpKSB7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0aWYgKHRha2UgPiAwICYmIHJlc3VsdC5sZW5ndGggPT09IHRha2UpIHtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCByZWFzb25zID0gdGhpcy5fZmlsdGVyZWRSZXNvdXJjZXMuZ2V0KGRhdGEucmVzb3VyY2UpO1xuXHRcdFx0XHRcdGlmIChyZWFzb25zPy5sZW5ndGgpIHtcblx0XHRcdFx0XHRcdHJlc3VsdC5wdXNoKHRoaXMuX2NyZWF0ZUZpbHRlcmVkTWFya2VyKGRhdGEucmVzb3VyY2UsIHJlYXNvbnMpKTtcblx0XHRcdFx0XHRcdGZpbHRlcmVkLmFkZChkYXRhLnJlc291cmNlKTtcblxuXHRcdFx0XHRcdH0gZWxzZSBpZiAoTWFya2VyU2VydmljZS5fYWNjZXB0KGRhdGEsIHNldmVyaXRpZXMpKSB7XG5cdFx0XHRcdFx0XHRyZXN1bHQucHVzaChkYXRhKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgX2FjY2VwdChtYXJrZXI6IElNYXJrZXIsIHNldmVyaXRpZXM/OiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gc2V2ZXJpdGllcyA9PT0gdW5kZWZpbmVkIHx8IChzZXZlcml0aWVzICYgbWFya2VyLnNldmVyaXR5KSA9PT0gbWFya2VyLnNldmVyaXR5O1xuXHR9XG5cblx0Ly8gLS0tIGV2ZW50IGRlYm91bmNlIGxvZ2ljXG5cblx0cHJpdmF0ZSBzdGF0aWMgX21lcmdlKGFsbDogKHJlYWRvbmx5IFVSSVtdKVtdKTogVVJJW10ge1xuXHRcdGNvbnN0IHNldCA9IG5ldyBSZXNvdXJjZU1hcDxib29sZWFuPigpO1xuXHRcdGZvciAoY29uc3QgYXJyYXkgb2YgYWxsKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgYXJyYXkpIHtcblx0XHRcdFx0c2V0LnNldChpdGVtLCB0cnVlKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIEFycmF5LmZyb20oc2V0LmtleXMoKSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZ0JBQWdCLHVCQUF1QjtBQUNoRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFzQixvQkFBb0I7QUFDMUMsU0FBUyxhQUFhLG1CQUFtQjtBQUN6QyxTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQWdFLHNCQUF3QztBQUVqRyxNQUFNLHFCQUFxQixvQkFBSSxJQUFJO0FBQUEsRUFDekMsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVBQ1IsUUFBUTtBQUFBLEVB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
