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
import { binarySearch2, equals } from "../../../../base/common/arrays.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { compare } from "../../../../base/common/strings.js";
import { URI } from "../../../../base/common/uri.js";
import { Range } from "../../../common/core/range.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { isEqual } from "../../../../base/common/resources.js";
class MarkerCoordinate {
  constructor(marker, index, total) {
    this.marker = marker;
    this.index = index;
    this.total = total;
  }
}
let MarkerList = class {
  constructor(resourceFilter, _markerService, _configService) {
    this._markerService = _markerService;
    this._configService = _configService;
    this._onDidChange = new Emitter();
    this.onDidChange = this._onDidChange.event;
    this._dispoables = new DisposableStore();
    this._markers = [];
    this._nextIdx = -1;
    if (URI.isUri(resourceFilter)) {
      this._resourceFilter = (uri) => uri.toString() === resourceFilter.toString();
    } else if (resourceFilter) {
      this._resourceFilter = resourceFilter;
    }
    const compareOrder = this._configService.getValue("problems.sortOrder");
    const compareMarker = (a, b) => {
      let res = compare(a.resource.toString(), b.resource.toString());
      if (res === 0) {
        if (compareOrder === "position") {
          res = Range.compareRangesUsingStarts(a, b) || MarkerSeverity.compare(a.severity, b.severity);
        } else {
          res = MarkerSeverity.compare(a.severity, b.severity) || Range.compareRangesUsingStarts(a, b);
        }
      }
      return res;
    };
    const updateMarker = () => {
      let newMarkers = this._markerService.read({
        resource: URI.isUri(resourceFilter) ? resourceFilter : void 0,
        severities: MarkerSeverity.Error | MarkerSeverity.Warning | MarkerSeverity.Info
      });
      if (typeof resourceFilter === "function") {
        newMarkers = newMarkers.filter((m) => this._resourceFilter(m.resource));
      }
      newMarkers.sort(compareMarker);
      if (equals(
        newMarkers,
        this._markers,
        (a, b) => a.resource.toString() === b.resource.toString() && a.startLineNumber === b.startLineNumber && a.startColumn === b.startColumn && a.endLineNumber === b.endLineNumber && a.endColumn === b.endColumn && a.severity === b.severity && a.message === b.message
      )) {
        return false;
      }
      this._markers = newMarkers;
      return true;
    };
    updateMarker();
    this._dispoables.add(_markerService.onMarkerChanged((uris) => {
      if (!this._resourceFilter || uris.some((uri) => this._resourceFilter(uri))) {
        if (updateMarker()) {
          this._nextIdx = -1;
          this._onDidChange.fire();
        }
      }
    }));
  }
  dispose() {
    this._dispoables.dispose();
    this._onDidChange.dispose();
  }
  matches(uri) {
    if (!this._resourceFilter && !uri) {
      return true;
    }
    if (!this._resourceFilter || !uri) {
      return false;
    }
    return this._resourceFilter(uri);
  }
  get selected() {
    const marker = this._markers[this._nextIdx];
    return marker && new MarkerCoordinate(marker, this._nextIdx + 1, this._markers.length);
  }
  _initIdx(model, position, fwd) {
    let idx = this._markers.findIndex((marker) => isEqual(marker.resource, model.uri));
    if (idx < 0) {
      idx = binarySearch2(this._markers.length, (idx2) => compare(this._markers[idx2].resource.toString(), model.uri.toString()));
      if (idx < 0) {
        idx = ~idx;
      }
      if (fwd) {
        this._nextIdx = idx;
      } else {
        this._nextIdx = (this._markers.length + idx - 1) % this._markers.length;
      }
    } else {
      let found = false;
      let wentPast = false;
      for (let i = idx; i < this._markers.length; i++) {
        let range = Range.lift(this._markers[i]);
        if (range.isEmpty()) {
          const word = model.getWordAtPosition(range.getStartPosition());
          if (word) {
            range = new Range(range.startLineNumber, word.startColumn, range.startLineNumber, word.endColumn);
          }
        }
        if (position && (range.containsPosition(position) || position.isBeforeOrEqual(range.getStartPosition()))) {
          this._nextIdx = i;
          found = true;
          wentPast = !range.containsPosition(position);
          break;
        }
        if (this._markers[i].resource.toString() !== model.uri.toString()) {
          break;
        }
      }
      if (!found) {
        this._nextIdx = fwd ? 0 : this._markers.length - 1;
      } else if (wentPast && !fwd) {
        this._nextIdx -= 1;
      }
    }
    if (this._nextIdx < 0) {
      this._nextIdx = this._markers.length - 1;
    }
  }
  resetIndex() {
    this._nextIdx = -1;
  }
  move(fwd, model, position) {
    if (this._markers.length === 0) {
      return false;
    }
    const oldIdx = this._nextIdx;
    if (this._nextIdx === -1) {
      this._initIdx(model, position, fwd);
    } else if (fwd) {
      this._nextIdx = (this._nextIdx + 1) % this._markers.length;
    } else if (!fwd) {
      this._nextIdx = (this._nextIdx - 1 + this._markers.length) % this._markers.length;
    }
    if (oldIdx !== this._nextIdx) {
      return true;
    }
    return false;
  }
  find(uri, position) {
    let idx = this._markers.findIndex((marker) => marker.resource.toString() === uri.toString());
    if (idx < 0) {
      return void 0;
    }
    for (; idx < this._markers.length; idx++) {
      if (Range.containsPosition(this._markers[idx], position)) {
        return new MarkerCoordinate(this._markers[idx], idx + 1, this._markers.length);
      }
    }
    return void 0;
  }
};
MarkerList = __decorateClass([
  __decorateParam(1, IMarkerService),
  __decorateParam(2, IConfigurationService)
], MarkerList);
const IMarkerNavigationService = createDecorator("IMarkerNavigationService");
let MarkerNavigationService = class {
  constructor(_markerService, _configService) {
    this._markerService = _markerService;
    this._configService = _configService;
    this._provider = new LinkedList();
  }
  registerProvider(provider) {
    const remove = this._provider.unshift(provider);
    return toDisposable(() => remove());
  }
  getMarkerList(resource) {
    for (const provider of this._provider) {
      const result = provider.getMarkerList(resource);
      if (result) {
        return result;
      }
    }
    return new MarkerList(resource, this._markerService, this._configService);
  }
};
MarkerNavigationService = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, IConfigurationService)
], MarkerNavigationService);
registerSingleton(IMarkerNavigationService, MarkerNavigationService, InstantiationType.Delayed);
export {
  IMarkerNavigationService,
  MarkerCoordinate,
  MarkerList
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9nb3RvRXJyb3IvYnJvd3Nlci9tYXJrZXJOYXZpZ2F0aW9uU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGJpbmFyeVNlYXJjaDIsIGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBjb21wYXJlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUG9zaXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vbW9kZWwuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElNYXJrZXIsIElNYXJrZXJTZXJ2aWNlLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcblxuZXhwb3J0IGNsYXNzIE1hcmtlckNvb3JkaW5hdGUge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBtYXJrZXI6IElNYXJrZXIsXG5cdFx0cmVhZG9ubHkgaW5kZXg6IG51bWJlcixcblx0XHRyZWFkb25seSB0b3RhbDogbnVtYmVyXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBNYXJrZXJMaXN0IHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDx2b2lkPiA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Jlc291cmNlRmlsdGVyPzogKHVyaTogVVJJKSA9PiBib29sZWFuO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9kaXNwb2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHByaXZhdGUgX21hcmtlcnM6IElNYXJrZXJbXSA9IFtdO1xuXHRwcml2YXRlIF9uZXh0SWR4OiBudW1iZXIgPSAtMTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZXNvdXJjZUZpbHRlcjogVVJJIHwgKCh1cmk6IFVSSSkgPT4gYm9vbGVhbikgfCB1bmRlZmluZWQsXG5cdFx0QElNYXJrZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21hcmtlclNlcnZpY2U6IElNYXJrZXJTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlnU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRpZiAoVVJJLmlzVXJpKHJlc291cmNlRmlsdGVyKSkge1xuXHRcdFx0dGhpcy5fcmVzb3VyY2VGaWx0ZXIgPSB1cmkgPT4gdXJpLnRvU3RyaW5nKCkgPT09IHJlc291cmNlRmlsdGVyLnRvU3RyaW5nKCk7XG5cdFx0fSBlbHNlIGlmIChyZXNvdXJjZUZpbHRlcikge1xuXHRcdFx0dGhpcy5fcmVzb3VyY2VGaWx0ZXIgPSByZXNvdXJjZUZpbHRlcjtcblx0XHR9XG5cblx0XHRjb25zdCBjb21wYXJlT3JkZXIgPSB0aGlzLl9jb25maWdTZXJ2aWNlLmdldFZhbHVlPHN0cmluZz4oJ3Byb2JsZW1zLnNvcnRPcmRlcicpO1xuXHRcdGNvbnN0IGNvbXBhcmVNYXJrZXIgPSAoYTogSU1hcmtlciwgYjogSU1hcmtlcik6IG51bWJlciA9PiB7XG5cdFx0XHRsZXQgcmVzID0gY29tcGFyZShhLnJlc291cmNlLnRvU3RyaW5nKCksIGIucmVzb3VyY2UudG9TdHJpbmcoKSk7XG5cdFx0XHRpZiAocmVzID09PSAwKSB7XG5cdFx0XHRcdGlmIChjb21wYXJlT3JkZXIgPT09ICdwb3NpdGlvbicpIHtcblx0XHRcdFx0XHRyZXMgPSBSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMoYSwgYikgfHwgTWFya2VyU2V2ZXJpdHkuY29tcGFyZShhLnNldmVyaXR5LCBiLnNldmVyaXR5KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXMgPSBNYXJrZXJTZXZlcml0eS5jb21wYXJlKGEuc2V2ZXJpdHksIGIuc2V2ZXJpdHkpIHx8IFJhbmdlLmNvbXBhcmVSYW5nZXNVc2luZ1N0YXJ0cyhhLCBiKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHJlcztcblx0XHR9O1xuXG5cdFx0Y29uc3QgdXBkYXRlTWFya2VyID0gKCkgPT4ge1xuXHRcdFx0bGV0IG5ld01hcmtlcnMgPSB0aGlzLl9tYXJrZXJTZXJ2aWNlLnJlYWQoe1xuXHRcdFx0XHRyZXNvdXJjZTogVVJJLmlzVXJpKHJlc291cmNlRmlsdGVyKSA/IHJlc291cmNlRmlsdGVyIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRzZXZlcml0aWVzOiBNYXJrZXJTZXZlcml0eS5FcnJvciB8IE1hcmtlclNldmVyaXR5Lldhcm5pbmcgfCBNYXJrZXJTZXZlcml0eS5JbmZvXG5cdFx0XHR9KTtcblx0XHRcdGlmICh0eXBlb2YgcmVzb3VyY2VGaWx0ZXIgPT09ICdmdW5jdGlvbicpIHtcblx0XHRcdFx0bmV3TWFya2VycyA9IG5ld01hcmtlcnMuZmlsdGVyKG0gPT4gdGhpcy5fcmVzb3VyY2VGaWx0ZXIhKG0ucmVzb3VyY2UpKTtcblx0XHRcdH1cblx0XHRcdG5ld01hcmtlcnMuc29ydChjb21wYXJlTWFya2VyKTtcblxuXHRcdFx0aWYgKGVxdWFscyhuZXdNYXJrZXJzLCB0aGlzLl9tYXJrZXJzLCAoYSwgYikgPT5cblx0XHRcdFx0YS5yZXNvdXJjZS50b1N0cmluZygpID09PSBiLnJlc291cmNlLnRvU3RyaW5nKClcblx0XHRcdFx0JiYgYS5zdGFydExpbmVOdW1iZXIgPT09IGIuc3RhcnRMaW5lTnVtYmVyXG5cdFx0XHRcdCYmIGEuc3RhcnRDb2x1bW4gPT09IGIuc3RhcnRDb2x1bW5cblx0XHRcdFx0JiYgYS5lbmRMaW5lTnVtYmVyID09PSBiLmVuZExpbmVOdW1iZXJcblx0XHRcdFx0JiYgYS5lbmRDb2x1bW4gPT09IGIuZW5kQ29sdW1uXG5cdFx0XHRcdCYmIGEuc2V2ZXJpdHkgPT09IGIuc2V2ZXJpdHlcblx0XHRcdFx0JiYgYS5tZXNzYWdlID09PSBiLm1lc3NhZ2Vcblx0XHRcdCkpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHR0aGlzLl9tYXJrZXJzID0gbmV3TWFya2Vycztcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH07XG5cblx0XHR1cGRhdGVNYXJrZXIoKTtcblxuXHRcdHRoaXMuX2Rpc3BvYWJsZXMuYWRkKF9tYXJrZXJTZXJ2aWNlLm9uTWFya2VyQ2hhbmdlZCh1cmlzID0+IHtcblx0XHRcdGlmICghdGhpcy5fcmVzb3VyY2VGaWx0ZXIgfHwgdXJpcy5zb21lKHVyaSA9PiB0aGlzLl9yZXNvdXJjZUZpbHRlciEodXJpKSkpIHtcblx0XHRcdFx0aWYgKHVwZGF0ZU1hcmtlcigpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbmV4dElkeCA9IC0xO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5fZGlzcG9hYmxlcy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZGlzcG9zZSgpO1xuXHR9XG5cblx0bWF0Y2hlcyh1cmk6IFVSSSB8IHVuZGVmaW5lZCkge1xuXHRcdGlmICghdGhpcy5fcmVzb3VyY2VGaWx0ZXIgJiYgIXVyaSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdGlmICghdGhpcy5fcmVzb3VyY2VGaWx0ZXIgfHwgIXVyaSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fcmVzb3VyY2VGaWx0ZXIodXJpKTtcblx0fVxuXG5cdGdldCBzZWxlY3RlZCgpOiBNYXJrZXJDb29yZGluYXRlIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBtYXJrZXIgPSB0aGlzLl9tYXJrZXJzW3RoaXMuX25leHRJZHhdO1xuXHRcdHJldHVybiBtYXJrZXIgJiYgbmV3IE1hcmtlckNvb3JkaW5hdGUobWFya2VyLCB0aGlzLl9uZXh0SWR4ICsgMSwgdGhpcy5fbWFya2Vycy5sZW5ndGgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaW5pdElkeChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBmd2Q6IGJvb2xlYW4pOiB2b2lkIHtcblxuXHRcdGxldCBpZHggPSB0aGlzLl9tYXJrZXJzLmZpbmRJbmRleChtYXJrZXIgPT4gaXNFcXVhbChtYXJrZXIucmVzb3VyY2UsIG1vZGVsLnVyaSkpO1xuXHRcdGlmIChpZHggPCAwKSB7XG5cdFx0XHQvLyBpZ25vcmUgbW9kZWwsIHBvc2l0aW9uIGJlY2F1c2UgdGhpcyB3aWxsIGJlIGEgZGlmZmVyZW50IGZpbGVcblx0XHRcdGlkeCA9IGJpbmFyeVNlYXJjaDIodGhpcy5fbWFya2Vycy5sZW5ndGgsIGlkeCA9PiBjb21wYXJlKHRoaXMuX21hcmtlcnNbaWR4XS5yZXNvdXJjZS50b1N0cmluZygpLCBtb2RlbC51cmkudG9TdHJpbmcoKSkpO1xuXHRcdFx0aWYgKGlkeCA8IDApIHtcblx0XHRcdFx0aWR4ID0gfmlkeDtcblx0XHRcdH1cblx0XHRcdGlmIChmd2QpIHtcblx0XHRcdFx0dGhpcy5fbmV4dElkeCA9IGlkeDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHRoaXMuX25leHRJZHggPSAodGhpcy5fbWFya2Vycy5sZW5ndGggKyBpZHggLSAxKSAlIHRoaXMuX21hcmtlcnMubGVuZ3RoO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyBmaW5kIG1hcmtlciBmb3IgZmlsZVxuXHRcdFx0bGV0IGZvdW5kID0gZmFsc2U7XG5cdFx0XHRsZXQgd2VudFBhc3QgPSBmYWxzZTtcblx0XHRcdGZvciAobGV0IGkgPSBpZHg7IGkgPCB0aGlzLl9tYXJrZXJzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGxldCByYW5nZSA9IFJhbmdlLmxpZnQodGhpcy5fbWFya2Vyc1tpXSk7XG5cblx0XHRcdFx0aWYgKHJhbmdlLmlzRW1wdHkoKSkge1xuXHRcdFx0XHRcdGNvbnN0IHdvcmQgPSBtb2RlbC5nZXRXb3JkQXRQb3NpdGlvbihyYW5nZS5nZXRTdGFydFBvc2l0aW9uKCkpO1xuXHRcdFx0XHRcdGlmICh3b3JkKSB7XG5cdFx0XHRcdFx0XHRyYW5nZSA9IG5ldyBSYW5nZShyYW5nZS5zdGFydExpbmVOdW1iZXIsIHdvcmQuc3RhcnRDb2x1bW4sIHJhbmdlLnN0YXJ0TGluZU51bWJlciwgd29yZC5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGlmIChwb3NpdGlvbiAmJiAocmFuZ2UuY29udGFpbnNQb3NpdGlvbihwb3NpdGlvbikgfHwgcG9zaXRpb24uaXNCZWZvcmVPckVxdWFsKHJhbmdlLmdldFN0YXJ0UG9zaXRpb24oKSkpKSB7XG5cdFx0XHRcdFx0dGhpcy5fbmV4dElkeCA9IGk7XG5cdFx0XHRcdFx0Zm91bmQgPSB0cnVlO1xuXHRcdFx0XHRcdHdlbnRQYXN0ID0gIXJhbmdlLmNvbnRhaW5zUG9zaXRpb24ocG9zaXRpb24pO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRoaXMuX21hcmtlcnNbaV0ucmVzb3VyY2UudG9TdHJpbmcoKSAhPT0gbW9kZWwudXJpLnRvU3RyaW5nKCkpIHtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoIWZvdW5kKSB7XG5cdFx0XHRcdC8vIGFmdGVyIHRoZSBsYXN0IGNoYW5nZVxuXHRcdFx0XHR0aGlzLl9uZXh0SWR4ID0gZndkID8gMCA6IHRoaXMuX21hcmtlcnMubGVuZ3RoIC0gMTtcblx0XHRcdH0gZWxzZSBpZiAod2VudFBhc3QgJiYgIWZ3ZCkge1xuXHRcdFx0XHQvLyB3ZSB3ZW50IHBhc3QgYW5kIGhhdmUgdG8gZ28gb25lIGJhY2tcblx0XHRcdFx0dGhpcy5fbmV4dElkeCAtPSAxO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmICh0aGlzLl9uZXh0SWR4IDwgMCkge1xuXHRcdFx0dGhpcy5fbmV4dElkeCA9IHRoaXMuX21hcmtlcnMubGVuZ3RoIC0gMTtcblx0XHR9XG5cdH1cblxuXHRyZXNldEluZGV4KCkge1xuXHRcdHRoaXMuX25leHRJZHggPSAtMTtcblx0fVxuXG5cdG1vdmUoZndkOiBib29sZWFuLCBtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX21hcmtlcnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb2xkSWR4ID0gdGhpcy5fbmV4dElkeDtcblx0XHRpZiAodGhpcy5fbmV4dElkeCA9PT0gLTEpIHtcblx0XHRcdHRoaXMuX2luaXRJZHgobW9kZWwsIHBvc2l0aW9uLCBmd2QpO1xuXHRcdH0gZWxzZSBpZiAoZndkKSB7XG5cdFx0XHR0aGlzLl9uZXh0SWR4ID0gKHRoaXMuX25leHRJZHggKyAxKSAlIHRoaXMuX21hcmtlcnMubGVuZ3RoO1xuXHRcdH0gZWxzZSBpZiAoIWZ3ZCkge1xuXHRcdFx0dGhpcy5fbmV4dElkeCA9ICh0aGlzLl9uZXh0SWR4IC0gMSArIHRoaXMuX21hcmtlcnMubGVuZ3RoKSAlIHRoaXMuX21hcmtlcnMubGVuZ3RoO1xuXHRcdH1cblxuXHRcdGlmIChvbGRJZHggIT09IHRoaXMuX25leHRJZHgpIHtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH1cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRmaW5kKHVyaTogVVJJLCBwb3NpdGlvbjogUG9zaXRpb24pOiBNYXJrZXJDb29yZGluYXRlIHwgdW5kZWZpbmVkIHtcblx0XHRsZXQgaWR4ID0gdGhpcy5fbWFya2Vycy5maW5kSW5kZXgobWFya2VyID0+IG1hcmtlci5yZXNvdXJjZS50b1N0cmluZygpID09PSB1cmkudG9TdHJpbmcoKSk7XG5cdFx0aWYgKGlkeCA8IDApIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGZvciAoOyBpZHggPCB0aGlzLl9tYXJrZXJzLmxlbmd0aDsgaWR4KyspIHtcblx0XHRcdGlmIChSYW5nZS5jb250YWluc1Bvc2l0aW9uKHRoaXMuX21hcmtlcnNbaWR4XSwgcG9zaXRpb24pKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgTWFya2VyQ29vcmRpbmF0ZSh0aGlzLl9tYXJrZXJzW2lkeF0sIGlkeCArIDEsIHRoaXMuX21hcmtlcnMubGVuZ3RoKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgSU1hcmtlck5hdmlnYXRpb25TZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElNYXJrZXJOYXZpZ2F0aW9uU2VydmljZT4oJ0lNYXJrZXJOYXZpZ2F0aW9uU2VydmljZScpO1xuXG5leHBvcnQgaW50ZXJmYWNlIElNYXJrZXJOYXZpZ2F0aW9uU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0cmVnaXN0ZXJQcm92aWRlcihwcm92aWRlcjogSU1hcmtlckxpc3RQcm92aWRlcik6IElEaXNwb3NhYmxlO1xuXHRnZXRNYXJrZXJMaXN0KHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQpOiBNYXJrZXJMaXN0O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElNYXJrZXJMaXN0UHJvdmlkZXIge1xuXHRnZXRNYXJrZXJMaXN0KHJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQpOiBNYXJrZXJMaXN0IHwgdW5kZWZpbmVkO1xufVxuXG5jbGFzcyBNYXJrZXJOYXZpZ2F0aW9uU2VydmljZSBpbXBsZW1lbnRzIElNYXJrZXJOYXZpZ2F0aW9uU2VydmljZSwgSU1hcmtlckxpc3RQcm92aWRlciB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3ZpZGVyID0gbmV3IExpbmtlZExpc3Q8SU1hcmtlckxpc3RQcm92aWRlcj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb25maWdTZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkgeyB9XG5cblx0cmVnaXN0ZXJQcm92aWRlcihwcm92aWRlcjogSU1hcmtlckxpc3RQcm92aWRlcik6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCByZW1vdmUgPSB0aGlzLl9wcm92aWRlci51bnNoaWZ0KHByb3ZpZGVyKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHJlbW92ZSgpKTtcblx0fVxuXG5cdGdldE1hcmtlckxpc3QocmVzb3VyY2U6IFVSSSB8IHVuZGVmaW5lZCk6IE1hcmtlckxpc3Qge1xuXHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgdGhpcy5fcHJvdmlkZXIpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IHByb3ZpZGVyLmdldE1hcmtlckxpc3QocmVzb3VyY2UpO1xuXHRcdFx0aWYgKHJlc3VsdCkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBkZWZhdWx0XG5cdFx0cmV0dXJuIG5ldyBNYXJrZXJMaXN0KHJlc291cmNlLCB0aGlzLl9tYXJrZXJTZXJ2aWNlLCB0aGlzLl9jb25maWdTZXJ2aWNlKTtcblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJTWFya2VyTmF2aWdhdGlvblNlcnZpY2UsIE1hcmtlck5hdmlnYXRpb25TZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5EZWxheWVkKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlLGNBQWM7QUFDdEMsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGlCQUE4QixvQkFBb0I7QUFDM0QsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsV0FBVztBQUVwQixTQUFTLGFBQWE7QUFFdEIsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQWtCLGdCQUFnQixzQkFBc0I7QUFDeEQsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxlQUFlO0FBRWpCLE1BQU0saUJBQWlCO0FBQUEsRUFDN0IsWUFDVSxRQUNBLE9BQ0EsT0FDUjtBQUhRO0FBQ0E7QUFDQTtBQUFBLEVBQ047QUFDTDtBQUVPLElBQU0sYUFBTixNQUFpQjtBQUFBLEVBV3ZCLFlBQ0MsZ0JBQ2lDLGdCQUNPLGdCQUN2QztBQUZnQztBQUNPO0FBWnpDLFNBQWlCLGVBQWUsSUFBSSxRQUFjO0FBQ2xELFNBQVMsY0FBMkIsS0FBSyxhQUFhO0FBR3RELFNBQWlCLGNBQWMsSUFBSSxnQkFBZ0I7QUFFbkQsU0FBUSxXQUFzQixDQUFDO0FBQy9CLFNBQVEsV0FBbUI7QUFPMUIsUUFBSSxJQUFJLE1BQU0sY0FBYyxHQUFHO0FBQzlCLFdBQUssa0JBQWtCLFNBQU8sSUFBSSxTQUFTLE1BQU0sZUFBZSxTQUFTO0FBQUEsSUFDMUUsV0FBVyxnQkFBZ0I7QUFDMUIsV0FBSyxrQkFBa0I7QUFBQSxJQUN4QjtBQUVBLFVBQU0sZUFBZSxLQUFLLGVBQWUsU0FBaUIsb0JBQW9CO0FBQzlFLFVBQU0sZ0JBQWdCLENBQUMsR0FBWSxNQUF1QjtBQUN6RCxVQUFJ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
