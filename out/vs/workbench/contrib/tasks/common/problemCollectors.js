import { URI } from "../../../../base/common/uri.js";
import { Event, Emitter } from "../../../../base/common/event.js";
import { DisposableStore, Disposable } from "../../../../base/common/lifecycle.js";
import { createLineMatcher, ApplyToKind, getResource } from "./problemMatcher.js";
import { IMarkerData } from "../../../../platform/markers/common/markers.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { isWindows } from "../../../../base/common/platform.js";
var ProblemCollectorEventKind = /* @__PURE__ */ ((ProblemCollectorEventKind2) => {
  ProblemCollectorEventKind2["BackgroundProcessingBegins"] = "backgroundProcessingBegins";
  ProblemCollectorEventKind2["BackgroundProcessingEnds"] = "backgroundProcessingEnds";
  return ProblemCollectorEventKind2;
})(ProblemCollectorEventKind || {});
var IProblemCollectorEvent;
((IProblemCollectorEvent2) => {
  function create(kind) {
    return Object.freeze({ kind });
  }
  IProblemCollectorEvent2.create = create;
})(IProblemCollectorEvent || (IProblemCollectorEvent = {}));
class AbstractProblemCollector extends Disposable {
  constructor(problemMatchers, markerService, modelService, fileService) {
    super();
    this.problemMatchers = problemMatchers;
    this.markerService = markerService;
    this.modelService = modelService;
    this.modelListeners = new DisposableStore();
    this._onDidFindFirstMatch = new Emitter();
    this.onDidFindFirstMatch = this._onDidFindFirstMatch.event;
    this._onDidFindErrors = new Emitter();
    this.onDidFindErrors = this._onDidFindErrors.event;
    this._onDidRequestInvalidateLastMarker = new Emitter();
    this.onDidRequestInvalidateLastMarker = this._onDidRequestInvalidateLastMarker.event;
    this.matchers = /* @__PURE__ */ Object.create(null);
    this.bufferLength = 1;
    problemMatchers.map((elem) => createLineMatcher(elem, fileService)).forEach((matcher) => {
      const length = matcher.matchLength;
      if (length > this.bufferLength) {
        this.bufferLength = length;
      }
      let value = this.matchers[length];
      if (!value) {
        value = [];
        this.matchers[length] = value;
      }
      value.push(matcher);
    });
    this.buffer = [];
    this.activeMatcher = null;
    this._numberOfMatches = 0;
    this._maxMarkerSeverity = void 0;
    this.openModels = /* @__PURE__ */ Object.create(null);
    this.applyToByOwner = /* @__PURE__ */ new Map();
    for (const problemMatcher of problemMatchers) {
      const current = this.applyToByOwner.get(problemMatcher.owner);
      if (current === void 0) {
        this.applyToByOwner.set(problemMatcher.owner, problemMatcher.applyTo);
      } else {
        this.applyToByOwner.set(problemMatcher.owner, this.mergeApplyTo(current, problemMatcher.applyTo));
      }
    }
    this.resourcesToClean = /* @__PURE__ */ new Map();
    this.markers = /* @__PURE__ */ new Map();
    this.deliveredMarkers = /* @__PURE__ */ new Map();
    this._register(this.modelService.onModelAdded((model) => {
      this.openModels[model.uri.toString()] = true;
    }, this, this.modelListeners));
    this._register(this.modelService.onModelRemoved((model) => {
      delete this.openModels[model.uri.toString()];
    }, this, this.modelListeners));
    this.modelService.getModels().forEach((model) => this.openModels[model.uri.toString()] = true);
    this._onDidStateChange = new Emitter();
  }
  get onDidStateChange() {
    return this._onDidStateChange.event;
  }
  processLine(line) {
    if (this.tail) {
      const oldTail = this.tail;
      this.tail = oldTail.then(() => {
        return this.processLineInternal(line);
      });
    } else {
      this.tail = this.processLineInternal(line);
    }
  }
  dispose() {
    super.dispose();
    this.modelListeners.dispose();
  }
  get numberOfMatches() {
    return this._numberOfMatches;
  }
  get maxMarkerSeverity() {
    return this._maxMarkerSeverity;
  }
  tryFindMarker(line) {
    let result = null;
    if (this.activeMatcher) {
      result = this.activeMatcher.next(line);
      if (result) {
        this.captureMatch(result);
        return result;
      }
      this.clearBuffer();
      this.activeMatcher = null;
    }
    if (this.buffer.length < this.bufferLength) {
      this.buffer.push(line);
    } else {
      const end = this.buffer.length - 1;
      for (let i = 0; i < end; i++) {
        this.buffer[i] = this.buffer[i + 1];
      }
      this.buffer[end] = line;
    }
    result = this.tryMatchers();
    if (result) {
      this.clearBuffer();
    }
    return result;
  }
  async shouldApplyMatch(result) {
    switch (result.description.applyTo) {
      case ApplyToKind.allDocuments:
        return true;
      case ApplyToKind.openDocuments:
        return !!this.openModels[(await result.resource).toString()];
      case ApplyToKind.closedDocuments:
        return !this.openModels[(await result.resource).toString()];
      default:
        return true;
    }
  }
  mergeApplyTo(current, value) {
    if (current === value || current === ApplyToKind.allDocuments) {
      return current;
    }
    return ApplyToKind.allDocuments;
  }
  tryMatchers() {
    this.activeMatcher = null;
    const length = this.buffer.length;
    for (let startIndex = 0; startIndex < length; startIndex++) {
      const candidates = this.matchers[length - startIndex];
      if (!candidates) {
        continue;
      }
      for (const matcher of candidates) {
        const result = matcher.handle(this.buffer, startIndex);
        if (result.match) {
          this.captureMatch(result.match);
          if (result.continue) {
            this.activeMatcher = matcher;
          }
          return result.match;
        }
      }
    }
    return null;
  }
  captureMatch(match) {
    this._numberOfMatches++;
    if (this._maxMarkerSeverity === void 0 || match.marker.severity > this._maxMarkerSeverity) {
      this._maxMarkerSeverity = match.marker.severity;
    }
  }
  clearBuffer() {
    if (this.buffer.length > 0) {
      this.buffer = [];
    }
  }
  recordResourcesToClean(owner) {
    const resourceSetToClean = this.getResourceSetToClean(owner);
    this.markerService.read({ owner }).forEach((marker) => resourceSetToClean.set(marker.resource.toString(), marker.resource));
  }
  recordResourceToClean(owner, resource) {
    this.getResourceSetToClean(owner).set(resource.toString(), resource);
  }
  removeResourceToClean(owner, resource) {
    const resourceSet = this.resourcesToClean.get(owner);
    resourceSet?.delete(resource);
  }
  getResourceSetToClean(owner) {
    let result = this.resourcesToClean.get(owner);
    if (!result) {
      result = /* @__PURE__ */ new Map();
      this.resourcesToClean.set(owner, result);
    }
    return result;
  }
  cleanAllMarkers() {
    this.resourcesToClean.forEach((value, owner) => {
      this._cleanMarkers(owner, value);
    });
    this.resourcesToClean = /* @__PURE__ */ new Map();
  }
  cleanMarkers(owner) {
    const toClean = this.resourcesToClean.get(owner);
    if (toClean) {
      this._cleanMarkers(owner, toClean);
      this.resourcesToClean.delete(owner);
    }
  }
  _cleanMarkers(owner, toClean) {
    const uris = [];
    const applyTo = this.applyToByOwner.get(owner);
    toClean.forEach((uri, uriAsString) => {
      if (applyTo === ApplyToKind.allDocuments || applyTo === ApplyToKind.openDocuments && this.openModels[uriAsString] || applyTo === ApplyToKind.closedDocuments && !this.openModels[uriAsString]) {
        uris.push(uri);
      }
    });
    this.markerService.remove(owner, uris);
  }
  recordMarker(marker, owner, resourceAsString) {
    let markersPerOwner = this.markers.get(owner);
    if (!markersPerOwner) {
      markersPerOwner = /* @__PURE__ */ new Map();
      this.markers.set(owner, markersPerOwner);
    }
    let markersPerResource = markersPerOwner.get(resourceAsString);
    if (!markersPerResource) {
      markersPerResource = /* @__PURE__ */ new Map();
      markersPerOwner.set(resourceAsString, markersPerResource);
    }
    const key = IMarkerData.makeKeyOptionalMessage(marker, false);
    let existingMarker;
    if (!markersPerResource.has(key)) {
      markersPerResource.set(key, marker);
    } else if ((existingMarker = markersPerResource.get(key)) !== void 0 && existingMarker.message.length < marker.message.length && isWindows) {
      markersPerResource.set(key, marker);
    }
  }
  reportMarkers() {
    this.markers.forEach((markersPerOwner, owner) => {
      const deliveredMarkersPerOwner = this.getDeliveredMarkersPerOwner(owner);
      markersPerOwner.forEach((markers, resource) => {
        this.deliverMarkersPerOwnerAndResourceResolved(owner, resource, markers, deliveredMarkersPerOwner);
      });
    });
  }
  deliverMarkersPerOwnerAndResource(owner, resource) {
    const markersPerOwner = this.markers.get(owner);
    if (!markersPerOwner) {
      return;
    }
    const deliveredMarkersPerOwner = this.getDeliveredMarkersPerOwner(owner);
    const markersPerResource = markersPerOwner.get(resource);
    if (!markersPerResource) {
      return;
    }
    this.deliverMarkersPerOwnerAndResourceResolved(owner, resource, markersPerResource, deliveredMarkersPerOwner);
  }
  deliverMarkersPerOwnerAndResourceResolved(owner, resource, markers, reported) {
    if (markers.size !== reported.get(resource)) {
      const toSet = [];
      markers.forEach((value) => toSet.push(value));
      this.markerService.changeOne(owner, URI.parse(resource), toSet);
      reported.set(resource, markers.size);
    }
  }
  getDeliveredMarkersPerOwner(owner) {
    let result = this.deliveredMarkers.get(owner);
    if (!result) {
      result = /* @__PURE__ */ new Map();
      this.deliveredMarkers.set(owner, result);
    }
    return result;
  }
  cleanMarkerCaches() {
    this._numberOfMatches = 0;
    this._maxMarkerSeverity = void 0;
    this.markers.clear();
    this.deliveredMarkers.clear();
  }
  done() {
    this.reportMarkers();
    this.cleanAllMarkers();
  }
}
var ProblemHandlingStrategy = /* @__PURE__ */ ((ProblemHandlingStrategy2) => {
  ProblemHandlingStrategy2[ProblemHandlingStrategy2["Clean"] = 0] = "Clean";
  return ProblemHandlingStrategy2;
})(ProblemHandlingStrategy || {});
class StartStopProblemCollector extends AbstractProblemCollector {
  constructor(problemMatchers, markerService, modelService, _strategy = 0 /* Clean */, fileService) {
    super(problemMatchers, markerService, modelService, fileService);
    this._hasStarted = false;
    const ownerSet = /* @__PURE__ */ Object.create(null);
    problemMatchers.forEach((description) => ownerSet[description.owner] = true);
    this.owners = Object.keys(ownerSet);
    this.owners.forEach((owner) => {
      this.recordResourcesToClean(owner);
    });
  }
  async processLineInternal(line) {
    if (!this._hasStarted) {
      this._hasStarted = true;
      this._onDidStateChange.fire(IProblemCollectorEvent.create("backgroundProcessingBegins" /* BackgroundProcessingBegins */));
    }
    const markerMatch = this.tryFindMarker(line);
    if (!markerMatch) {
      return;
    }
    const owner = markerMatch.description.owner;
    const resource = await markerMatch.resource;
    const resourceAsString = resource.toString();
    this.removeResourceToClean(owner, resourceAsString);
    const shouldApplyMatch = await this.shouldApplyMatch(markerMatch);
    if (shouldApplyMatch) {
      this.recordMarker(markerMatch.marker, owner, resourceAsString);
      if (this.currentOwner !== owner || this.currentResource !== resourceAsString) {
        if (this.currentOwner && this.currentResource) {
          this.deliverMarkersPerOwnerAndResource(this.currentOwner, this.currentResource);
        }
        this.currentOwner = owner;
        this.currentResource = resourceAsString;
      }
    }
  }
}
class WatchingProblemCollector extends AbstractProblemCollector {
  constructor(problemMatchers, markerService, modelService, fileService) {
    super(problemMatchers, markerService, modelService, fileService);
    this.lines = [];
    this.beginPatterns = [];
    this.resetCurrentResource();
    this.backgroundPatterns = [];
    this._activeBackgroundMatchers = /* @__PURE__ */ new Set();
    this.problemMatchers.forEach((matcher) => {
      if (matcher.watching) {
        const key = generateUuid();
        this.backgroundPatterns.push({
          key,
          matcher,
          begin: matcher.watching.beginsPattern,
          end: matcher.watching.endsPattern
        });
        this.beginPatterns.push(matcher.watching.beginsPattern.regexp);
      }
    });
    this.modelListeners.add(this.modelService.onModelRemoved((modelEvent) => {
      let markerChanged = Event.debounce(
        this.markerService.onMarkerChanged,
        (last, e) => (last ?? []).concat(e),
        500,
        false,
        true
      )(async (markerEvent) => {
        if (!markerEvent || !markerEvent.includes(modelEvent.uri) || this.markerService.read({ resource: modelEvent.uri }).length !== 0) {
          return;
        }
        const oldLines = Array.from(this.lines);
        for (const line of oldLines) {
          await this.processLineInternal(line);
        }
      });
      this._register(markerChanged);
      setTimeout(() => {
        if (markerChanged) {
          const _markerChanged = markerChanged;
          markerChanged = void 0;
          _markerChanged.dispose();
        }
      }, 600);
    }));
  }
  aboutToStart() {
    for (const background of this.backgroundPatterns) {
      if (background.matcher.watching && background.matcher.watching.activeOnStart) {
        this._activeBackgroundMatchers.add(background.key);
        this._onDidStateChange.fire(IProblemCollectorEvent.create("backgroundProcessingBegins" /* BackgroundProcessingBegins */));
        this.recordResourcesToClean(background.matcher.owner);
      }
    }
  }
  async processLineInternal(line) {
    if (await this.tryBegin(line) || this.tryFinish(line)) {
      return;
    }
    this.lines.push(line);
    const markerMatch = this.tryFindMarker(line);
    if (!markerMatch) {
      return;
    }
    const resource = await markerMatch.resource;
    const owner = markerMatch.description.owner;
    const resourceAsString = resource.toString();
    this.removeResourceToClean(owner, resourceAsString);
    const shouldApplyMatch = await this.shouldApplyMatch(markerMatch);
    if (shouldApplyMatch) {
      this.recordMarker(markerMatch.marker, owner, resourceAsString);
      if (this.currentOwner !== owner || this.currentResource !== resourceAsString) {
        this.reportMarkersForCurrentResource();
        this.currentOwner = owner;
        this.currentResource = resourceAsString;
      }
    }
  }
  forceDelivery() {
    this.reportMarkersForCurrentResource();
  }
  async tryBegin(line) {
    let result = false;
    for (const background of this.backgroundPatterns) {
      const matches = background.begin.regexp.exec(line);
      if (matches) {
        if (this._activeBackgroundMatchers.has(background.key)) {
          continue;
        }
        this._activeBackgroundMatchers.add(background.key);
        result = true;
        this._onDidFindFirstMatch.fire();
        this.lines = [];
        this.lines.push(line);
        this._onDidStateChange.fire(IProblemCollectorEvent.create("backgroundProcessingBegins" /* BackgroundProcessingBegins */));
        this.cleanMarkerCaches();
        this.resetCurrentResource();
        const owner = background.matcher.owner;
        const file = matches[background.begin.file];
        if (file) {
          const resource = getResource(file, background.matcher);
          this.recordResourceToClean(owner, await resource);
        } else {
          this.recordResourcesToClean(owner);
        }
      }
    }
    return result;
  }
  tryFinish(line) {
    let result = false;
    for (const background of this.backgroundPatterns) {
      const matches = background.end.regexp.exec(line);
      if (matches) {
        if (this._numberOfMatches > 0) {
          this._onDidFindErrors.fire();
        } else {
          this._onDidRequestInvalidateLastMarker.fire();
        }
        if (this._activeBackgroundMatchers.has(background.key)) {
          this._activeBackgroundMatchers.delete(background.key);
          this.resetCurrentResource();
          this._onDidStateChange.fire(IProblemCollectorEvent.create("backgroundProcessingEnds" /* BackgroundProcessingEnds */));
          result = true;
          this.lines.push(line);
          const owner = background.matcher.owner;
          this.cleanMarkers(owner);
          this.cleanMarkerCaches();
        }
      }
    }
    return result;
  }
  resetCurrentResource() {
    this.reportMarkersForCurrentResource();
    this.currentOwner = void 0;
    this.currentResource = void 0;
  }
  reportMarkersForCurrentResource() {
    if (this.currentOwner && this.currentResource) {
      this.deliverMarkersPerOwnerAndResource(this.currentOwner, this.currentResource);
    }
  }
  done() {
    [...this.applyToByOwner.keys()].forEach((owner) => {
      this.recordResourcesToClean(owner);
    });
    super.done();
  }
  isWatching() {
    return this.backgroundPatterns.length > 0;
  }
}
export {
  AbstractProblemCollector,
  ProblemCollectorEventKind,
  ProblemHandlingStrategy,
  StartStopProblemCollector,
  WatchingProblemCollector
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90YXNrcy9jb21tb24vcHJvYmxlbUNvbGxlY3RvcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJU3RyaW5nRGljdGlvbmFyeSwgSU51bWJlckRpY3Rpb25hcnkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2xsZWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuaW1wb3J0IHsgSU1vZGVsU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuXG5pbXBvcnQgeyBJTGluZU1hdGNoZXIsIGNyZWF0ZUxpbmVNYXRjaGVyLCBQcm9ibGVtTWF0Y2hlciwgSVByb2JsZW1NYXRjaCwgQXBwbHlUb0tpbmQsIElXYXRjaGluZ1BhdHRlcm4sIGdldFJlc291cmNlIH0gZnJvbSAnLi9wcm9ibGVtTWF0Y2hlci5qcyc7XG5pbXBvcnQgeyBJTWFya2VyU2VydmljZSwgSU1hcmtlckRhdGEsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBnZW5lcmF0ZVV1aWQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91dWlkLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQge1xuXHRCYWNrZ3JvdW5kUHJvY2Vzc2luZ0JlZ2lucyA9ICdiYWNrZ3JvdW5kUHJvY2Vzc2luZ0JlZ2lucycsXG5cdEJhY2tncm91bmRQcm9jZXNzaW5nRW5kcyA9ICdiYWNrZ3JvdW5kUHJvY2Vzc2luZ0VuZHMnXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2JsZW1Db2xsZWN0b3JFdmVudCB7XG5cdGtpbmQ6IFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQ7XG59XG5cbm5hbWVzcGFjZSBJUHJvYmxlbUNvbGxlY3RvckV2ZW50IHtcblx0ZXhwb3J0IGZ1bmN0aW9uIGNyZWF0ZShraW5kOiBQcm9ibGVtQ29sbGVjdG9yRXZlbnRLaW5kKSB7XG5cdFx0cmV0dXJuIE9iamVjdC5mcmVlemUoeyBraW5kIH0pO1xuXHR9XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByb2JsZW1NYXRjaGVyIHtcblx0cHJvY2Vzc0xpbmUobGluZTogc3RyaW5nKTogdm9pZDtcbn1cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIEFic3RyYWN0UHJvYmxlbUNvbGxlY3RvciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cblx0cHJpdmF0ZSBtYXRjaGVyczogSU51bWJlckRpY3Rpb25hcnk8SUxpbmVNYXRjaGVyW10+O1xuXHRwcml2YXRlIGFjdGl2ZU1hdGNoZXI6IElMaW5lTWF0Y2hlciB8IG51bGw7XG5cdHByb3RlY3RlZCBfbnVtYmVyT2ZNYXRjaGVzOiBudW1iZXI7XG5cdHByaXZhdGUgX21heE1hcmtlclNldmVyaXR5PzogTWFya2VyU2V2ZXJpdHk7XG5cdHByaXZhdGUgYnVmZmVyOiBzdHJpbmdbXTtcblx0cHJpdmF0ZSBidWZmZXJMZW5ndGg6IG51bWJlcjtcblx0cHJpdmF0ZSBvcGVuTW9kZWxzOiBJU3RyaW5nRGljdGlvbmFyeTxib29sZWFuPjtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IG1vZGVsTGlzdGVuZXJzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIHRhaWw6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cblx0Ly8gW293bmVyXSAtPiBBcHBseVRvS2luZFxuXHRwcm90ZWN0ZWQgYXBwbHlUb0J5T3duZXI6IE1hcDxzdHJpbmcsIEFwcGx5VG9LaW5kPjtcblx0Ly8gW293bmVyXSAtPiBbcmVzb3VyY2VdIC0+IFVSSVxuXHRwcml2YXRlIHJlc291cmNlc1RvQ2xlYW46IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIFVSST4+O1xuXHQvLyBbb3duZXJdIC0+IFtyZXNvdXJjZV0gLT4gW21hcmtlcmtleV0gLT4gbWFya2VyRGF0YVxuXHRwcml2YXRlIG1hcmtlcnM6IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIElNYXJrZXJEYXRhPj4+O1xuXHQvLyBbb3duZXJdIC0+IFtyZXNvdXJjZV0gLT4gbnVtYmVyO1xuXHRwcml2YXRlIGRlbGl2ZXJlZE1hcmtlcnM6IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIG51bWJlcj4+O1xuXG5cdHByb3RlY3RlZCBfb25EaWRTdGF0ZUNoYW5nZTogRW1pdHRlcjxJUHJvYmxlbUNvbGxlY3RvckV2ZW50PjtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkRmluZEZpcnN0TWF0Y2ggPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZEZpbmRGaXJzdE1hdGNoID0gdGhpcy5fb25EaWRGaW5kRmlyc3RNYXRjaC5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkRmluZEVycm9ycyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkRmluZEVycm9ycyA9IHRoaXMuX29uRGlkRmluZEVycm9ycy5ldmVudDtcblxuXHRwcm90ZWN0ZWQgcmVhZG9ubHkgX29uRGlkUmVxdWVzdEludmFsaWRhdGVMYXN0TWFya2VyID0gbmV3IEVtaXR0ZXI8dm9pZD4oKTtcblx0cmVhZG9ubHkgb25EaWRSZXF1ZXN0SW52YWxpZGF0ZUxhc3RNYXJrZXIgPSB0aGlzLl9vbkRpZFJlcXVlc3RJbnZhbGlkYXRlTGFzdE1hcmtlci5ldmVudDtcblxuXHRjb25zdHJ1Y3RvcihwdWJsaWMgcmVhZG9ubHkgcHJvYmxlbU1hdGNoZXJzOiBQcm9ibGVtTWF0Y2hlcltdLCBwcm90ZWN0ZWQgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsIHByb3RlY3RlZCBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsIGZpbGVTZXJ2aWNlPzogSUZpbGVTZXJ2aWNlKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLm1hdGNoZXJzID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHR0aGlzLmJ1ZmZlckxlbmd0aCA9IDE7XG5cdFx0cHJvYmxlbU1hdGNoZXJzLm1hcChlbGVtID0+IGNyZWF0ZUxpbmVNYXRjaGVyKGVsZW0sIGZpbGVTZXJ2aWNlKSkuZm9yRWFjaCgobWF0Y2hlcikgPT4ge1xuXHRcdFx0Y29uc3QgbGVuZ3RoID0gbWF0Y2hlci5tYXRjaExlbmd0aDtcblx0XHRcdGlmIChsZW5ndGggPiB0aGlzLmJ1ZmZlckxlbmd0aCkge1xuXHRcdFx0XHR0aGlzLmJ1ZmZlckxlbmd0aCA9IGxlbmd0aDtcblx0XHRcdH1cblx0XHRcdGxldCB2YWx1ZSA9IHRoaXMubWF0Y2hlcnNbbGVuZ3RoXTtcblx0XHRcdGlmICghdmFsdWUpIHtcblx0XHRcdFx0dmFsdWUgPSBbXTtcblx0XHRcdFx0dGhpcy5tYXRjaGVyc1tsZW5ndGhdID0gdmFsdWU7XG5cdFx0XHR9XG5cdFx0XHR2YWx1ZS5wdXNoKG1hdGNoZXIpO1xuXHRcdH0pO1xuXHRcdHRoaXMuYnVmZmVyID0gW107XG5cdFx0dGhpcy5hY3RpdmVNYXRjaGVyID0gbnVsbDtcblx0XHR0aGlzLl9udW1iZXJPZk1hdGNoZXMgPSAwO1xuXHRcdHRoaXMuX21heE1hcmtlclNldmVyaXR5ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMub3Blbk1vZGVscyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0dGhpcy5hcHBseVRvQnlPd25lciA9IG5ldyBNYXA8c3RyaW5nLCBBcHBseVRvS2luZD4oKTtcblx0XHRmb3IgKGNvbnN0IHByb2JsZW1NYXRjaGVyIG9mIHByb2JsZW1NYXRjaGVycykge1xuXHRcdFx0Y29uc3QgY3VycmVudCA9IHRoaXMuYXBwbHlUb0J5T3duZXIuZ2V0KHByb2JsZW1NYXRjaGVyLm93bmVyKTtcblx0XHRcdGlmIChjdXJyZW50ID09PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0dGhpcy5hcHBseVRvQnlPd25lci5zZXQocHJvYmxlbU1hdGNoZXIub3duZXIsIHByb2JsZW1NYXRjaGVyLmFwcGx5VG8pO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5hcHBseVRvQnlPd25lci5zZXQocHJvYmxlbU1hdGNoZXIub3duZXIsIHRoaXMubWVyZ2VBcHBseVRvKGN1cnJlbnQsIHByb2JsZW1NYXRjaGVyLmFwcGx5VG8pKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5yZXNvdXJjZXNUb0NsZWFuID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIFVSST4+KCk7XG5cdFx0dGhpcy5tYXJrZXJzID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIElNYXJrZXJEYXRhPj4+KCk7XG5cdFx0dGhpcy5kZWxpdmVyZWRNYXJrZXJzID0gbmV3IE1hcDxzdHJpbmcsIE1hcDxzdHJpbmcsIG51bWJlcj4+KCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5tb2RlbFNlcnZpY2Uub25Nb2RlbEFkZGVkKChtb2RlbCkgPT4ge1xuXHRcdFx0dGhpcy5vcGVuTW9kZWxzW21vZGVsLnVyaS50b1N0cmluZygpXSA9IHRydWU7XG5cdFx0fSwgdGhpcywgdGhpcy5tb2RlbExpc3RlbmVycykpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubW9kZWxTZXJ2aWNlLm9uTW9kZWxSZW1vdmVkKChtb2RlbCkgPT4ge1xuXHRcdFx0ZGVsZXRlIHRoaXMub3Blbk1vZGVsc1ttb2RlbC51cmkudG9TdHJpbmcoKV07XG5cdFx0fSwgdGhpcywgdGhpcy5tb2RlbExpc3RlbmVycykpO1xuXHRcdHRoaXMubW9kZWxTZXJ2aWNlLmdldE1vZGVscygpLmZvckVhY2gobW9kZWwgPT4gdGhpcy5vcGVuTW9kZWxzW21vZGVsLnVyaS50b1N0cmluZygpXSA9IHRydWUpO1xuXG5cdFx0dGhpcy5fb25EaWRTdGF0ZUNoYW5nZSA9IG5ldyBFbWl0dGVyKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IG9uRGlkU3RhdGVDaGFuZ2UoKTogRXZlbnQ8SVByb2JsZW1Db2xsZWN0b3JFdmVudD4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0cHVibGljIHByb2Nlc3NMaW5lKGxpbmU6IHN0cmluZykge1xuXHRcdGlmICh0aGlzLnRhaWwpIHtcblx0XHRcdGNvbnN0IG9sZFRhaWwgPSB0aGlzLnRhaWw7XG5cdFx0XHR0aGlzLnRhaWwgPSBvbGRUYWlsLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5wcm9jZXNzTGluZUludGVybmFsKGxpbmUpO1xuXHRcdFx0fSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMudGFpbCA9IHRoaXMucHJvY2Vzc0xpbmVJbnRlcm5hbChsaW5lKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgYWJzdHJhY3QgcHJvY2Vzc0xpbmVJbnRlcm5hbChsaW5lOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCkge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLm1vZGVsTGlzdGVuZXJzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgbnVtYmVyT2ZNYXRjaGVzKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX251bWJlck9mTWF0Y2hlcztcblx0fVxuXG5cdHB1YmxpYyBnZXQgbWF4TWFya2VyU2V2ZXJpdHkoKTogTWFya2VyU2V2ZXJpdHkgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9tYXhNYXJrZXJTZXZlcml0eTtcblx0fVxuXG5cdHByb3RlY3RlZCB0cnlGaW5kTWFya2VyKGxpbmU6IHN0cmluZyk6IElQcm9ibGVtTWF0Y2ggfCBudWxsIHtcblx0XHRsZXQgcmVzdWx0OiBJUHJvYmxlbU1hdGNoIHwgbnVsbCA9IG51bGw7XG5cdFx0aWYgKHRoaXMuYWN0aXZlTWF0Y2hlcikge1xuXHRcdFx0cmVzdWx0ID0gdGhpcy5hY3RpdmVNYXRjaGVyLm5leHQobGluZSk7XG5cdFx0XHRpZiAocmVzdWx0KSB7XG5cdFx0XHRcdHRoaXMuY2FwdHVyZU1hdGNoKHJlc3VsdCk7XG5cdFx0XHRcdHJldHVybiByZXN1bHQ7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmNsZWFyQnVmZmVyKCk7XG5cdFx0XHR0aGlzLmFjdGl2ZU1hdGNoZXIgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAodGhpcy5idWZmZXIubGVuZ3RoIDwgdGhpcy5idWZmZXJMZW5ndGgpIHtcblx0XHRcdHRoaXMuYnVmZmVyLnB1c2gobGluZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGNvbnN0IGVuZCA9IHRoaXMuYnVmZmVyLmxlbmd0aCAtIDE7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGVuZDsgaSsrKSB7XG5cdFx0XHRcdHRoaXMuYnVmZmVyW2ldID0gdGhpcy5idWZmZXJbaSArIDFdO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5idWZmZXJbZW5kXSA9IGxpbmU7XG5cdFx0fVxuXG5cdFx0cmVzdWx0ID0gdGhpcy50cnlNYXRjaGVycygpO1xuXHRcdGlmIChyZXN1bHQpIHtcblx0XHRcdHRoaXMuY2xlYXJCdWZmZXIoKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBzaG91bGRBcHBseU1hdGNoKHJlc3VsdDogSVByb2JsZW1NYXRjaCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHN3aXRjaCAocmVzdWx0LmRlc2NyaXB0aW9uLmFwcGx5VG8pIHtcblx0XHRcdGNhc2UgQXBwbHlUb0tpbmQuYWxsRG9jdW1lbnRzOlxuXHRcdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHRcdGNhc2UgQXBwbHlUb0tpbmQub3BlbkRvY3VtZW50czpcblx0XHRcdFx0cmV0dXJuICEhdGhpcy5vcGVuTW9kZWxzWyhhd2FpdCByZXN1bHQucmVzb3VyY2UpLnRvU3RyaW5nKCldO1xuXHRcdFx0Y2FzZSBBcHBseVRvS2luZC5jbG9zZWREb2N1bWVudHM6XG5cdFx0XHRcdHJldHVybiAhdGhpcy5vcGVuTW9kZWxzWyhhd2FpdCByZXN1bHQucmVzb3VyY2UpLnRvU3RyaW5nKCldO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBtZXJnZUFwcGx5VG8oY3VycmVudDogQXBwbHlUb0tpbmQsIHZhbHVlOiBBcHBseVRvS2luZCk6IEFwcGx5VG9LaW5kIHtcblx0XHRpZiAoY3VycmVudCA9PT0gdmFsdWUgfHwgY3VycmVudCA9PT0gQXBwbHlUb0tpbmQuYWxsRG9jdW1lbnRzKSB7XG5cdFx0XHRyZXR1cm4gY3VycmVudDtcblx0XHR9XG5cdFx0cmV0dXJuIEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cztcblx0fVxuXG5cdHByaXZhdGUgdHJ5TWF0Y2hlcnMoKTogSVByb2JsZW1NYXRjaCB8IG51bGwge1xuXHRcdHRoaXMuYWN0aXZlTWF0Y2hlciA9IG51bGw7XG5cdFx0Y29uc3QgbGVuZ3RoID0gdGhpcy5idWZmZXIubGVuZ3RoO1xuXHRcdGZvciAobGV0IHN0YXJ0SW5kZXggPSAwOyBzdGFydEluZGV4IDwgbGVuZ3RoOyBzdGFydEluZGV4KyspIHtcblx0XHRcdGNvbnN0IGNhbmRpZGF0ZXMgPSB0aGlzLm1hdGNoZXJzW2xlbmd0aCAtIHN0YXJ0SW5kZXhdO1xuXHRcdFx0aWYgKCFjYW5kaWRhdGVzKSB7XG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXHRcdFx0Zm9yIChjb25zdCBtYXRjaGVyIG9mIGNhbmRpZGF0ZXMpIHtcblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gbWF0Y2hlci5oYW5kbGUodGhpcy5idWZmZXIsIHN0YXJ0SW5kZXgpO1xuXHRcdFx0XHRpZiAocmVzdWx0Lm1hdGNoKSB7XG5cdFx0XHRcdFx0dGhpcy5jYXB0dXJlTWF0Y2gocmVzdWx0Lm1hdGNoKTtcblx0XHRcdFx0XHRpZiAocmVzdWx0LmNvbnRpbnVlKSB7XG5cdFx0XHRcdFx0XHR0aGlzLmFjdGl2ZU1hdGNoZXIgPSBtYXRjaGVyO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzdWx0Lm1hdGNoO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBudWxsO1xuXHR9XG5cblx0cHJpdmF0ZSBjYXB0dXJlTWF0Y2gobWF0Y2g6IElQcm9ibGVtTWF0Y2gpOiB2b2lkIHtcblx0XHR0aGlzLl9udW1iZXJPZk1hdGNoZXMrKztcblx0XHRpZiAodGhpcy5fbWF4TWFya2VyU2V2ZXJpdHkgPT09IHVuZGVmaW5lZCB8fCBtYXRjaC5tYXJrZXIuc2V2ZXJpdHkgPiB0aGlzLl9tYXhNYXJrZXJTZXZlcml0eSkge1xuXHRcdFx0dGhpcy5fbWF4TWFya2VyU2V2ZXJpdHkgPSBtYXRjaC5tYXJrZXIuc2V2ZXJpdHk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhckJ1ZmZlcigpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5idWZmZXIubGVuZ3RoID4gMCkge1xuXHRcdFx0dGhpcy5idWZmZXIgPSBbXTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVjb3JkUmVzb3VyY2VzVG9DbGVhbihvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgcmVzb3VyY2VTZXRUb0NsZWFuID0gdGhpcy5nZXRSZXNvdXJjZVNldFRvQ2xlYW4ob3duZXIpO1xuXHRcdHRoaXMubWFya2VyU2VydmljZS5yZWFkKHsgb3duZXI6IG93bmVyIH0pLmZvckVhY2gobWFya2VyID0+IHJlc291cmNlU2V0VG9DbGVhbi5zZXQobWFya2VyLnJlc291cmNlLnRvU3RyaW5nKCksIG1hcmtlci5yZXNvdXJjZSkpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlY29yZFJlc291cmNlVG9DbGVhbihvd25lcjogc3RyaW5nLCByZXNvdXJjZTogVVJJKTogdm9pZCB7XG5cdFx0dGhpcy5nZXRSZXNvdXJjZVNldFRvQ2xlYW4ob3duZXIpLnNldChyZXNvdXJjZS50b1N0cmluZygpLCByZXNvdXJjZSk7XG5cdH1cblxuXHRwcm90ZWN0ZWQgcmVtb3ZlUmVzb3VyY2VUb0NsZWFuKG93bmVyOiBzdHJpbmcsIHJlc291cmNlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCByZXNvdXJjZVNldCA9IHRoaXMucmVzb3VyY2VzVG9DbGVhbi5nZXQob3duZXIpO1xuXHRcdHJlc291cmNlU2V0Py5kZWxldGUocmVzb3VyY2UpO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRSZXNvdXJjZVNldFRvQ2xlYW4ob3duZXI6IHN0cmluZyk6IE1hcDxzdHJpbmcsIFVSST4ge1xuXHRcdGxldCByZXN1bHQgPSB0aGlzLnJlc291cmNlc1RvQ2xlYW4uZ2V0KG93bmVyKTtcblx0XHRpZiAoIXJlc3VsdCkge1xuXHRcdFx0cmVzdWx0ID0gbmV3IE1hcDxzdHJpbmcsIFVSST4oKTtcblx0XHRcdHRoaXMucmVzb3VyY2VzVG9DbGVhbi5zZXQob3duZXIsIHJlc3VsdCk7XG5cdFx0fVxuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgY2xlYW5BbGxNYXJrZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMucmVzb3VyY2VzVG9DbGVhbi5mb3JFYWNoKCh2YWx1ZSwgb3duZXIpID0+IHtcblx0XHRcdHRoaXMuX2NsZWFuTWFya2Vycyhvd25lciwgdmFsdWUpO1xuXHRcdH0pO1xuXHRcdHRoaXMucmVzb3VyY2VzVG9DbGVhbiA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBVUkk+PigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIGNsZWFuTWFya2Vycyhvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgdG9DbGVhbiA9IHRoaXMucmVzb3VyY2VzVG9DbGVhbi5nZXQob3duZXIpO1xuXHRcdGlmICh0b0NsZWFuKSB7XG5cdFx0XHR0aGlzLl9jbGVhbk1hcmtlcnMob3duZXIsIHRvQ2xlYW4pO1xuXHRcdFx0dGhpcy5yZXNvdXJjZXNUb0NsZWFuLmRlbGV0ZShvd25lcik7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBfY2xlYW5NYXJrZXJzKG93bmVyOiBzdHJpbmcsIHRvQ2xlYW46IE1hcDxzdHJpbmcsIFVSST4pOiB2b2lkIHtcblx0XHRjb25zdCB1cmlzOiBVUklbXSA9IFtdO1xuXHRcdGNvbnN0IGFwcGx5VG8gPSB0aGlzLmFwcGx5VG9CeU93bmVyLmdldChvd25lcik7XG5cdFx0dG9DbGVhbi5mb3JFYWNoKCh1cmksIHVyaUFzU3RyaW5nKSA9PiB7XG5cdFx0XHRpZiAoXG5cdFx0XHRcdGFwcGx5VG8gPT09IEFwcGx5VG9LaW5kLmFsbERvY3VtZW50cyB8fFxuXHRcdFx0XHQoYXBwbHlUbyA9PT0gQXBwbHlUb0tpbmQub3BlbkRvY3VtZW50cyAmJiB0aGlzLm9wZW5Nb2RlbHNbdXJpQXNTdHJpbmddKSB8fFxuXHRcdFx0XHQoYXBwbHlUbyA9PT0gQXBwbHlUb0tpbmQuY2xvc2VkRG9jdW1lbnRzICYmICF0aGlzLm9wZW5Nb2RlbHNbdXJpQXNTdHJpbmddKVxuXHRcdFx0KSB7XG5cdFx0XHRcdHVyaXMucHVzaCh1cmkpO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHRcdHRoaXMubWFya2VyU2VydmljZS5yZW1vdmUob3duZXIsIHVyaXMpO1xuXHR9XG5cblx0cHJvdGVjdGVkIHJlY29yZE1hcmtlcihtYXJrZXI6IElNYXJrZXJEYXRhLCBvd25lcjogc3RyaW5nLCByZXNvdXJjZUFzU3RyaW5nOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRsZXQgbWFya2Vyc1Blck93bmVyID0gdGhpcy5tYXJrZXJzLmdldChvd25lcik7XG5cdFx0aWYgKCFtYXJrZXJzUGVyT3duZXIpIHtcblx0XHRcdG1hcmtlcnNQZXJPd25lciA9IG5ldyBNYXA8c3RyaW5nLCBNYXA8c3RyaW5nLCBJTWFya2VyRGF0YT4+KCk7XG5cdFx0XHR0aGlzLm1hcmtlcnMuc2V0KG93bmVyLCBtYXJrZXJzUGVyT3duZXIpO1xuXHRcdH1cblx0XHRsZXQgbWFya2Vyc1BlclJlc291cmNlID0gbWFya2Vyc1Blck93bmVyLmdldChyZXNvdXJjZUFzU3RyaW5nKTtcblx0XHRpZiAoIW1hcmtlcnNQZXJSZXNvdXJjZSkge1xuXHRcdFx0bWFya2Vyc1BlclJlc291cmNlID0gbmV3IE1hcDxzdHJpbmcsIElNYXJrZXJEYXRhPigpO1xuXHRcdFx0bWFya2Vyc1Blck93bmVyLnNldChyZXNvdXJjZUFzU3RyaW5nLCBtYXJrZXJzUGVyUmVzb3VyY2UpO1xuXHRcdH1cblx0XHRjb25zdCBrZXkgPSBJTWFya2VyRGF0YS5tYWtlS2V5T3B0aW9uYWxNZXNzYWdlKG1hcmtlciwgZmFsc2UpO1xuXHRcdGxldCBleGlzdGluZ01hcmtlcjtcblx0XHRpZiAoIW1hcmtlcnNQZXJSZXNvdXJjZS5oYXMoa2V5KSkge1xuXHRcdFx0bWFya2Vyc1BlclJlc291cmNlLnNldChrZXksIG1hcmtlcik7XG5cdFx0fSBlbHNlIGlmICgoKGV4aXN0aW5nTWFya2VyID0gbWFya2Vyc1BlclJlc291cmNlLmdldChrZXkpKSAhPT0gdW5kZWZpbmVkKSAmJiAoZXhpc3RpbmdNYXJrZXIubWVzc2FnZS5sZW5ndGggPCBtYXJrZXIubWVzc2FnZS5sZW5ndGgpICYmIGlzV2luZG93cykge1xuXHRcdFx0Ly8gTW9zdCBsaWtlbHkgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzc3NDc1XG5cdFx0XHQvLyBIZXVyaXN0aWMgZGljdGF0ZXMgdGhhdCB3aGVuIHRoZSBrZXkgaXMgdGhlIHNhbWUgYW5kIG1lc3NhZ2UgaXMgc21hbGxlciwgd2UgaGF2ZSBoaXQgdGhpcyBsaW1pdGF0aW9uLlxuXHRcdFx0bWFya2Vyc1BlclJlc291cmNlLnNldChrZXksIG1hcmtlcik7XG5cdFx0fVxuXHR9XG5cblx0cHJvdGVjdGVkIHJlcG9ydE1hcmtlcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5tYXJrZXJzLmZvckVhY2goKG1hcmtlcnNQZXJPd25lciwgb3duZXIpID0+IHtcblx0XHRcdGNvbnN0IGRlbGl2ZXJlZE1hcmtlcnNQZXJPd25lciA9IHRoaXMuZ2V0RGVsaXZlcmVkTWFya2Vyc1Blck93bmVyKG93bmVyKTtcblx0XHRcdG1hcmtlcnNQZXJPd25lci5mb3JFYWNoKChtYXJrZXJzLCByZXNvdXJjZSkgPT4ge1xuXHRcdFx0XHR0aGlzLmRlbGl2ZXJNYXJrZXJzUGVyT3duZXJBbmRSZXNvdXJjZVJlc29sdmVkKG93bmVyLCByZXNvdXJjZSwgbWFya2VycywgZGVsaXZlcmVkTWFya2Vyc1Blck93bmVyKTtcblx0XHRcdH0pO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJvdGVjdGVkIGRlbGl2ZXJNYXJrZXJzUGVyT3duZXJBbmRSZXNvdXJjZShvd25lcjogc3RyaW5nLCByZXNvdXJjZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgbWFya2Vyc1Blck93bmVyID0gdGhpcy5tYXJrZXJzLmdldChvd25lcik7XG5cdFx0aWYgKCFtYXJrZXJzUGVyT3duZXIpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0Y29uc3QgZGVsaXZlcmVkTWFya2Vyc1Blck93bmVyID0gdGhpcy5nZXREZWxpdmVyZWRNYXJrZXJzUGVyT3duZXIob3duZXIpO1xuXHRcdGNvbnN0IG1hcmtlcnNQZXJSZXNvdXJjZSA9IG1hcmtlcnNQZXJPd25lci5nZXQocmVzb3VyY2UpO1xuXHRcdGlmICghbWFya2Vyc1BlclJlc291cmNlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuZGVsaXZlck1hcmtlcnNQZXJPd25lckFuZFJlc291cmNlUmVzb2x2ZWQob3duZXIsIHJlc291cmNlLCBtYXJrZXJzUGVyUmVzb3VyY2UsIGRlbGl2ZXJlZE1hcmtlcnNQZXJPd25lcik7XG5cdH1cblxuXHRwcml2YXRlIGRlbGl2ZXJNYXJrZXJzUGVyT3duZXJBbmRSZXNvdXJjZVJlc29sdmVkKG93bmVyOiBzdHJpbmcsIHJlc291cmNlOiBzdHJpbmcsIG1hcmtlcnM6IE1hcDxzdHJpbmcsIElNYXJrZXJEYXRhPiwgcmVwb3J0ZWQ6IE1hcDxzdHJpbmcsIG51bWJlcj4pOiB2b2lkIHtcblx0XHRpZiAobWFya2Vycy5zaXplICE9PSByZXBvcnRlZC5nZXQocmVzb3VyY2UpKSB7XG5cdFx0XHRjb25zdCB0b1NldDogSU1hcmtlckRhdGFbXSA9IFtdO1xuXHRcdFx0bWFya2Vycy5mb3JFYWNoKHZhbHVlID0+IHRvU2V0LnB1c2godmFsdWUpKTtcblx0XHRcdHRoaXMubWFya2VyU2VydmljZS5jaGFuZ2VPbmUob3duZXIsIFVSSS5wYXJzZShyZXNvdXJjZSksIHRvU2V0KTtcblx0XHRcdHJlcG9ydGVkLnNldChyZXNvdXJjZSwgbWFya2Vycy5zaXplKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldERlbGl2ZXJlZE1hcmtlcnNQZXJPd25lcihvd25lcjogc3RyaW5nKTogTWFwPHN0cmluZywgbnVtYmVyPiB7XG5cdFx0bGV0IHJlc3VsdCA9IHRoaXMuZGVsaXZlcmVkTWFya2Vycy5nZXQob3duZXIpO1xuXHRcdGlmICghcmVzdWx0KSB7XG5cdFx0XHRyZXN1bHQgPSBuZXcgTWFwPHN0cmluZywgbnVtYmVyPigpO1xuXHRcdFx0dGhpcy5kZWxpdmVyZWRNYXJrZXJzLnNldChvd25lciwgcmVzdWx0KTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHByb3RlY3RlZCBjbGVhbk1hcmtlckNhY2hlcygpOiB2b2lkIHtcblx0XHR0aGlzLl9udW1iZXJPZk1hdGNoZXMgPSAwO1xuXHRcdHRoaXMuX21heE1hcmtlclNldmVyaXR5ID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMubWFya2Vycy5jbGVhcigpO1xuXHRcdHRoaXMuZGVsaXZlcmVkTWFya2Vycy5jbGVhcigpO1xuXHR9XG5cblx0cHVibGljIGRvbmUoKTogdm9pZCB7XG5cdFx0dGhpcy5yZXBvcnRNYXJrZXJzKCk7XG5cdFx0dGhpcy5jbGVhbkFsbE1hcmtlcnMoKTtcblx0fVxufVxuXG5leHBvcnQgY29uc3QgZW51bSBQcm9ibGVtSGFuZGxpbmdTdHJhdGVneSB7XG5cdENsZWFuXG59XG5cbmV4cG9ydCBjbGFzcyBTdGFydFN0b3BQcm9ibGVtQ29sbGVjdG9yIGV4dGVuZHMgQWJzdHJhY3RQcm9ibGVtQ29sbGVjdG9yIGltcGxlbWVudHMgSVByb2JsZW1NYXRjaGVyIHtcblx0cHJpdmF0ZSBvd25lcnM6IHN0cmluZ1tdO1xuXG5cdHByaXZhdGUgY3VycmVudE93bmVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY3VycmVudFJlc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfaGFzU3RhcnRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKHByb2JsZW1NYXRjaGVyczogUHJvYmxlbU1hdGNoZXJbXSwgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSwgX3N0cmF0ZWd5OiBQcm9ibGVtSGFuZGxpbmdTdHJhdGVneSA9IFByb2JsZW1IYW5kbGluZ1N0cmF0ZWd5LkNsZWFuLCBmaWxlU2VydmljZT86IElGaWxlU2VydmljZSkge1xuXHRcdHN1cGVyKHByb2JsZW1NYXRjaGVycywgbWFya2VyU2VydmljZSwgbW9kZWxTZXJ2aWNlLCBmaWxlU2VydmljZSk7XG5cdFx0Y29uc3Qgb3duZXJTZXQ6IHsgW2tleTogc3RyaW5nXTogYm9vbGVhbiB9ID0gT2JqZWN0LmNyZWF0ZShudWxsKTtcblx0XHRwcm9ibGVtTWF0Y2hlcnMuZm9yRWFjaChkZXNjcmlwdGlvbiA9PiBvd25lclNldFtkZXNjcmlwdGlvbi5vd25lcl0gPSB0cnVlKTtcblx0XHR0aGlzLm93bmVycyA9IE9iamVjdC5rZXlzKG93bmVyU2V0KTtcblx0XHR0aGlzLm93bmVycy5mb3JFYWNoKChvd25lcikgPT4ge1xuXHRcdFx0dGhpcy5yZWNvcmRSZXNvdXJjZXNUb0NsZWFuKG93bmVyKTtcblx0XHR9KTtcblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBwcm9jZXNzTGluZUludGVybmFsKGxpbmU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5faGFzU3RhcnRlZCkge1xuXHRcdFx0dGhpcy5faGFzU3RhcnRlZCA9IHRydWU7XG5cdFx0XHR0aGlzLl9vbkRpZFN0YXRlQ2hhbmdlLmZpcmUoSVByb2JsZW1Db2xsZWN0b3JFdmVudC5jcmVhdGUoUHJvYmxlbUNvbGxlY3RvckV2ZW50S2luZC5CYWNrZ3JvdW5kUHJvY2Vzc2luZ0JlZ2lucykpO1xuXHRcdH1cblx0XHRjb25zdCBtYXJrZXJNYXRjaCA9IHRoaXMudHJ5RmluZE1hcmtlcihsaW5lKTtcblx0XHRpZiAoIW1hcmtlck1hdGNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgb3duZXIgPSBtYXJrZXJNYXRjaC5kZXNjcmlwdGlvbi5vd25lcjtcblx0XHRjb25zdCByZXNvdXJjZSA9IGF3YWl0IG1hcmtlck1hdGNoLnJlc291cmNlO1xuXHRcdGNvbnN0IHJlc291cmNlQXNTdHJpbmcgPSByZXNvdXJjZS50b1N0cmluZygpO1xuXHRcdHRoaXMucmVtb3ZlUmVzb3VyY2VUb0NsZWFuKG93bmVyLCByZXNvdXJjZUFzU3RyaW5nKTtcblx0XHRjb25zdCBzaG91bGRBcHBseU1hdGNoID0gYXdhaXQgdGhpcy5zaG91bGRBcHBseU1hdGNoKG1hcmtlck1hdGNoKTtcblx0XHRpZiAoc2hvdWxkQXBwbHlNYXRjaCkge1xuXHRcdFx0dGhpcy5yZWNvcmRNYXJrZXIobWFya2VyTWF0Y2gubWFya2VyLCBvd25lciwgcmVzb3VyY2VBc1N0cmluZyk7XG5cdFx0XHRpZiAodGhpcy5jdXJyZW50T3duZXIgIT09IG93bmVyIHx8IHRoaXMuY3VycmVudFJlc291cmNlICE9PSByZXNvdXJjZUFzU3RyaW5nKSB7XG5cdFx0XHRcdGlmICh0aGlzLmN1cnJlbnRPd25lciAmJiB0aGlzLmN1cnJlbnRSZXNvdXJjZSkge1xuXHRcdFx0XHRcdHRoaXMuZGVsaXZlck1hcmtlcnNQZXJPd25lckFuZFJlc291cmNlKHRoaXMuY3VycmVudE93bmVyLCB0aGlzLmN1cnJlbnRSZXNvdXJjZSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5jdXJyZW50T3duZXIgPSBvd25lcjtcblx0XHRcdFx0dGhpcy5jdXJyZW50UmVzb3VyY2UgPSByZXNvdXJjZUFzU3RyaW5nO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuXG5pbnRlcmZhY2UgSUJhY2tncm91bmRQYXR0ZXJucyB7XG5cdGtleTogc3RyaW5nO1xuXHRtYXRjaGVyOiBQcm9ibGVtTWF0Y2hlcjtcblx0YmVnaW46IElXYXRjaGluZ1BhdHRlcm47XG5cdGVuZDogSVdhdGNoaW5nUGF0dGVybjtcbn1cblxuZXhwb3J0IGNsYXNzIFdhdGNoaW5nUHJvYmxlbUNvbGxlY3RvciBleHRlbmRzIEFic3RyYWN0UHJvYmxlbUNvbGxlY3RvciBpbXBsZW1lbnRzIElQcm9ibGVtTWF0Y2hlciB7XG5cblx0cHJpdmF0ZSBiYWNrZ3JvdW5kUGF0dGVybnM6IElCYWNrZ3JvdW5kUGF0dGVybnNbXTtcblxuXHQvLyB3b3JrYXJvdW5kIGZvciBodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvNDQwMThcblx0cHJpdmF0ZSBfYWN0aXZlQmFja2dyb3VuZE1hdGNoZXJzOiBTZXQ8c3RyaW5nPjtcblxuXHQvLyBDdXJyZW50IFN0YXRlXG5cdHByaXZhdGUgY3VycmVudE93bmVyOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgY3VycmVudFJlc291cmNlOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBsaW5lczogc3RyaW5nW10gPSBbXTtcblx0cHVibGljIGJlZ2luUGF0dGVybnM6IFJlZ0V4cFtdID0gW107XG5cdGNvbnN0cnVjdG9yKHByb2JsZW1NYXRjaGVyczogUHJvYmxlbU1hdGNoZXJbXSwgbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsIG1vZGVsU2VydmljZTogSU1vZGVsU2VydmljZSwgZmlsZVNlcnZpY2U/OiBJRmlsZVNlcnZpY2UpIHtcblx0XHRzdXBlcihwcm9ibGVtTWF0Y2hlcnMsIG1hcmtlclNlcnZpY2UsIG1vZGVsU2VydmljZSwgZmlsZVNlcnZpY2UpO1xuXHRcdHRoaXMucmVzZXRDdXJyZW50UmVzb3VyY2UoKTtcblx0XHR0aGlzLmJhY2tncm91bmRQYXR0ZXJucyA9IFtdO1xuXHRcdHRoaXMuX2FjdGl2ZUJhY2tncm91bmRNYXRjaGVycyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRcdHRoaXMucHJvYmxlbU1hdGNoZXJzLmZvckVhY2gobWF0Y2hlciA9PiB7XG5cdFx0XHRpZiAobWF0Y2hlci53YXRjaGluZykge1xuXHRcdFx0XHRjb25zdCBrZXk6IHN0cmluZyA9IGdlbmVyYXRlVXVpZCgpO1xuXHRcdFx0XHR0aGlzLmJhY2tncm91bmRQYXR0ZXJucy5wdXNoKHtcblx0XHRcdFx0XHRrZXksXG5cdFx0XHRcdFx0bWF0Y2hlcjogbWF0Y2hlcixcblx0XHRcdFx0XHRiZWdpbjogbWF0Y2hlci53YXRjaGluZy5iZWdpbnNQYXR0ZXJuLFxuXHRcdFx0XHRcdGVuZDogbWF0Y2hlci53YXRjaGluZy5lbmRzUGF0dGVyblxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dGhpcy5iZWdpblBhdHRlcm5zLnB1c2gobWF0Y2hlci53YXRjaGluZy5iZWdpbnNQYXR0ZXJuLnJlZ2V4cCk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLm1vZGVsTGlzdGVuZXJzLmFkZCh0aGlzLm1vZGVsU2VydmljZS5vbk1vZGVsUmVtb3ZlZChtb2RlbEV2ZW50ID0+IHtcblx0XHRcdGxldCBtYXJrZXJDaGFuZ2VkOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZCA9IEV2ZW50LmRlYm91bmNlKFxuXHRcdFx0XHR0aGlzLm1hcmtlclNlcnZpY2Uub25NYXJrZXJDaGFuZ2VkLFxuXHRcdFx0XHQobGFzdDogcmVhZG9ubHkgVVJJW10gfCB1bmRlZmluZWQsIGU6IHJlYWRvbmx5IFVSSVtdKSA9PiAobGFzdCA/PyBbXSkuY29uY2F0KGUpLFxuXHRcdFx0XHQ1MDAsXG5cdFx0XHRcdGZhbHNlLFxuXHRcdFx0XHR0cnVlXG5cdFx0XHQpKGFzeW5jIChtYXJrZXJFdmVudDogcmVhZG9ubHkgVVJJW10pID0+IHtcblx0XHRcdFx0aWYgKCFtYXJrZXJFdmVudCB8fCAhbWFya2VyRXZlbnQuaW5jbHVkZXMobW9kZWxFdmVudC51cmkpIHx8ICh0aGlzLm1hcmtlclNlcnZpY2UucmVhZCh7IHJlc291cmNlOiBtb2RlbEV2ZW50LnVyaSB9KS5sZW5ndGggIT09IDApKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNvbnN0IG9sZExpbmVzID0gQXJyYXkuZnJvbSh0aGlzLmxpbmVzKTtcblx0XHRcdFx0Zm9yIChjb25zdCBsaW5lIG9mIG9sZExpbmVzKSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5wcm9jZXNzTGluZUludGVybmFsKGxpbmUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0dGhpcy5fcmVnaXN0ZXIobWFya2VyQ2hhbmdlZCk7IC8vIEVuc3VyZXMgbWFya2VyQ2hhbmdlZCBpcyB0cmFja2VkIGFuZCBkaXNwb3NlZCBvZiBwcm9wZXJseVxuXG5cdFx0XHRzZXRUaW1lb3V0KCgpID0+IHtcblx0XHRcdFx0aWYgKG1hcmtlckNoYW5nZWQpIHtcblx0XHRcdFx0XHRjb25zdCBfbWFya2VyQ2hhbmdlZCA9IG1hcmtlckNoYW5nZWQ7XG5cdFx0XHRcdFx0bWFya2VyQ2hhbmdlZCA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRfbWFya2VyQ2hhbmdlZC5kaXNwb3NlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIDYwMCk7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIGFib3V0VG9TdGFydCgpOiB2b2lkIHtcblx0XHRmb3IgKGNvbnN0IGJhY2tncm91bmQgb2YgdGhpcy5iYWNrZ3JvdW5kUGF0dGVybnMpIHtcblx0XHRcdGlmIChiYWNrZ3JvdW5kLm1hdGNoZXIud2F0Y2hpbmcgJiYgYmFja2dyb3VuZC5tYXRjaGVyLndhdGNoaW5nLmFjdGl2ZU9uU3RhcnQpIHtcblx0XHRcdFx0dGhpcy5fYWN0aXZlQmFja2dyb3VuZE1hdGNoZXJzLmFkZChiYWNrZ3JvdW5kLmtleSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkU3RhdGVDaGFuZ2UuZmlyZShJUHJvYmxlbUNvbGxlY3RvckV2ZW50LmNyZWF0ZShQcm9ibGVtQ29sbGVjdG9yRXZlbnRLaW5kLkJhY2tncm91bmRQcm9jZXNzaW5nQmVnaW5zKSk7XG5cdFx0XHRcdHRoaXMucmVjb3JkUmVzb3VyY2VzVG9DbGVhbihiYWNrZ3JvdW5kLm1hdGNoZXIub3duZXIpO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBhc3luYyBwcm9jZXNzTGluZUludGVybmFsKGxpbmU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChhd2FpdCB0aGlzLnRyeUJlZ2luKGxpbmUpIHx8IHRoaXMudHJ5RmluaXNoKGxpbmUpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMubGluZXMucHVzaChsaW5lKTtcblx0XHRjb25zdCBtYXJrZXJNYXRjaCA9IHRoaXMudHJ5RmluZE1hcmtlcihsaW5lKTtcblx0XHRpZiAoIW1hcmtlck1hdGNoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGNvbnN0IHJlc291cmNlID0gYXdhaXQgbWFya2VyTWF0Y2gucmVzb3VyY2U7XG5cdFx0Y29uc3Qgb3duZXIgPSBtYXJrZXJNYXRjaC5kZXNjcmlwdGlvbi5vd25lcjtcblx0XHRjb25zdCByZXNvdXJjZUFzU3RyaW5nID0gcmVzb3VyY2UudG9TdHJpbmcoKTtcblx0XHR0aGlzLnJlbW92ZVJlc291cmNlVG9DbGVhbihvd25lciwgcmVzb3VyY2VBc1N0cmluZyk7XG5cdFx0Y29uc3Qgc2hvdWxkQXBwbHlNYXRjaCA9IGF3YWl0IHRoaXMuc2hvdWxkQXBwbHlNYXRjaChtYXJrZXJNYXRjaCk7XG5cdFx0aWYgKHNob3VsZEFwcGx5TWF0Y2gpIHtcblx0XHRcdHRoaXMucmVjb3JkTWFya2VyKG1hcmtlck1hdGNoLm1hcmtlciwgb3duZXIsIHJlc291cmNlQXNTdHJpbmcpO1xuXHRcdFx0aWYgKHRoaXMuY3VycmVudE93bmVyICE9PSBvd25lciB8fCB0aGlzLmN1cnJlbnRSZXNvdXJjZSAhPT0gcmVzb3VyY2VBc1N0cmluZykge1xuXHRcdFx0XHR0aGlzLnJlcG9ydE1hcmtlcnNGb3JDdXJyZW50UmVzb3VyY2UoKTtcblx0XHRcdFx0dGhpcy5jdXJyZW50T3duZXIgPSBvd25lcjtcblx0XHRcdFx0dGhpcy5jdXJyZW50UmVzb3VyY2UgPSByZXNvdXJjZUFzU3RyaW5nO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBmb3JjZURlbGl2ZXJ5KCk6IHZvaWQge1xuXHRcdHRoaXMucmVwb3J0TWFya2Vyc0ZvckN1cnJlbnRSZXNvdXJjZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB0cnlCZWdpbihsaW5lOiBzdHJpbmcpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRsZXQgcmVzdWx0ID0gZmFsc2U7XG5cdFx0Zm9yIChjb25zdCBiYWNrZ3JvdW5kIG9mIHRoaXMuYmFja2dyb3VuZFBhdHRlcm5zKSB7XG5cdFx0XHRjb25zdCBtYXRjaGVzID0gYmFja2dyb3VuZC5iZWdpbi5yZWdleHAuZXhlYyhsaW5lKTtcblx0XHRcdGlmIChtYXRjaGVzKSB7XG5cdFx0XHRcdGlmICh0aGlzLl9hY3RpdmVCYWNrZ3JvdW5kTWF0Y2hlcnMuaGFzKGJhY2tncm91bmQua2V5KSkge1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX2FjdGl2ZUJhY2tncm91bmRNYXRjaGVycy5hZGQoYmFja2dyb3VuZC5rZXkpO1xuXHRcdFx0XHRyZXN1bHQgPSB0cnVlO1xuXHRcdFx0XHR0aGlzLl9vbkRpZEZpbmRGaXJzdE1hdGNoLmZpcmUoKTtcblx0XHRcdFx0dGhpcy5saW5lcyA9IFtdO1xuXHRcdFx0XHR0aGlzLmxpbmVzLnB1c2gobGluZSk7XG5cdFx0XHRcdHRoaXMuX29uRGlkU3RhdGVDaGFuZ2UuZmlyZShJUHJvYmxlbUNvbGxlY3RvckV2ZW50LmNyZWF0ZShQcm9ibGVtQ29sbGVjdG9yRXZlbnRLaW5kLkJhY2tncm91bmRQcm9jZXNzaW5nQmVnaW5zKSk7XG5cdFx0XHRcdHRoaXMuY2xlYW5NYXJrZXJDYWNoZXMoKTtcblx0XHRcdFx0dGhpcy5yZXNldEN1cnJlbnRSZXNvdXJjZSgpO1xuXHRcdFx0XHRjb25zdCBvd25lciA9IGJhY2tncm91bmQubWF0Y2hlci5vd25lcjtcblx0XHRcdFx0Y29uc3QgZmlsZSA9IG1hdGNoZXNbYmFja2dyb3VuZC5iZWdpbi5maWxlIV07XG5cdFx0XHRcdGlmIChmaWxlKSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzb3VyY2UgPSBnZXRSZXNvdXJjZShmaWxlLCBiYWNrZ3JvdW5kLm1hdGNoZXIpO1xuXHRcdFx0XHRcdHRoaXMucmVjb3JkUmVzb3VyY2VUb0NsZWFuKG93bmVyLCBhd2FpdCByZXNvdXJjZSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5yZWNvcmRSZXNvdXJjZXNUb0NsZWFuKG93bmVyKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSB0cnlGaW5pc2gobGluZTogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0bGV0IHJlc3VsdCA9IGZhbHNlO1xuXHRcdGZvciAoY29uc3QgYmFja2dyb3VuZCBvZiB0aGlzLmJhY2tncm91bmRQYXR0ZXJucykge1xuXHRcdFx0Y29uc3QgbWF0Y2hlcyA9IGJhY2tncm91bmQuZW5kLnJlZ2V4cC5leGVjKGxpbmUpO1xuXHRcdFx0aWYgKG1hdGNoZXMpIHtcblx0XHRcdFx0aWYgKHRoaXMuX251bWJlck9mTWF0Y2hlcyA+IDApIHtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZEZpbmRFcnJvcnMuZmlyZSgpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkUmVxdWVzdEludmFsaWRhdGVMYXN0TWFya2VyLmZpcmUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAodGhpcy5fYWN0aXZlQmFja2dyb3VuZE1hdGNoZXJzLmhhcyhiYWNrZ3JvdW5kLmtleSkpIHtcblx0XHRcdFx0XHR0aGlzLl9hY3RpdmVCYWNrZ3JvdW5kTWF0Y2hlcnMuZGVsZXRlKGJhY2tncm91bmQua2V5KTtcblx0XHRcdFx0XHR0aGlzLnJlc2V0Q3VycmVudFJlc291cmNlKCk7XG5cdFx0XHRcdFx0dGhpcy5fb25EaWRTdGF0ZUNoYW5nZS5maXJlKElQcm9ibGVtQ29sbGVjdG9yRXZlbnQuY3JlYXRlKFByb2JsZW1Db2xsZWN0b3JFdmVudEtpbmQuQmFja2dyb3VuZFByb2Nlc3NpbmdFbmRzKSk7XG5cdFx0XHRcdFx0cmVzdWx0ID0gdHJ1ZTtcblx0XHRcdFx0XHR0aGlzLmxpbmVzLnB1c2gobGluZSk7XG5cdFx0XHRcdFx0Y29uc3Qgb3duZXIgPSBiYWNrZ3JvdW5kLm1hdGNoZXIub3duZXI7XG5cdFx0XHRcdFx0dGhpcy5jbGVhbk1hcmtlcnMob3duZXIpO1xuXHRcdFx0XHRcdHRoaXMuY2xlYW5NYXJrZXJDYWNoZXMoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHJpdmF0ZSByZXNldEN1cnJlbnRSZXNvdXJjZSgpOiB2b2lkIHtcblx0XHR0aGlzLnJlcG9ydE1hcmtlcnNGb3JDdXJyZW50UmVzb3VyY2UoKTtcblx0XHR0aGlzLmN1cnJlbnRPd25lciA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLmN1cnJlbnRSZXNvdXJjZSA9IHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgcmVwb3J0TWFya2Vyc0ZvckN1cnJlbnRSZXNvdXJjZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5jdXJyZW50T3duZXIgJiYgdGhpcy5jdXJyZW50UmVzb3VyY2UpIHtcblx0XHRcdHRoaXMuZGVsaXZlck1hcmtlcnNQZXJPd25lckFuZFJlc291cmNlKHRoaXMuY3VycmVudE93bmVyLCB0aGlzLmN1cnJlbnRSZXNvdXJjZSk7XG5cdFx0fVxuXHR9XG5cblx0cHVibGljIG92ZXJyaWRlIGRvbmUoKTogdm9pZCB7XG5cdFx0Wy4uLnRoaXMuYXBwbHlUb0J5T3duZXIua2V5cygpXS5mb3JFYWNoKG93bmVyID0+IHtcblx0XHRcdHRoaXMucmVjb3JkUmVzb3VyY2VzVG9DbGVhbihvd25lcik7XG5cdFx0fSk7XG5cdFx0c3VwZXIuZG9uZSgpO1xuXHR9XG5cblx0cHVibGljIGlzV2F0Y2hpbmcoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuYmFja2dyb3VuZFBhdHRlcm5zLmxlbmd0aCA+IDA7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFNBQVMsV0FBVztBQUNwQixTQUFTLE9BQU8sZUFBZTtBQUMvQixTQUFzQixpQkFBaUIsa0JBQWtCO0FBSXpELFNBQXVCLG1CQUFrRCxhQUErQixtQkFBbUI7QUFDM0gsU0FBeUIsbUJBQW1DO0FBQzVELFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsaUJBQWlCO0FBRW5CLElBQVcsNEJBQVgsa0JBQVdBLCtCQUFYO0FBQ04sRUFBQUEsMkJBQUEsZ0NBQTZCO0FBQzdCLEVBQUFBLDJCQUFBLDhCQUEyQjtBQUZWLFNBQUFBO0FBQUEsR0FBQTtBQVNsQixJQUFVO0FBQUEsQ0FBVixDQUFVQyw0QkFBVjtBQUNRLFdBQVMsT0FBTyxNQUFpQztBQUN2RCxXQUFPLE9BQU8sT0FBTyxFQUFFLEtBQUssQ0FBQztBQUFBLEVBQzlCO0FBRk8sRUFBQUEsd0JBQVM7QUFBQSxHQURQO0FBVUgsTUFBZSxpQ0FBaUMsV0FBa0M7QUFBQSxFQWdDeEYsWUFBNEIsaUJBQTZDLGVBQXlDLGNBQTZCLGFBQTRCO0FBQzFLLFVBQU07QUFEcUI7QUFBNkM7QUFBeUM7QUF2QmxILFNBQW1CLGlCQUFpQixJQUFJLGdCQUFnQjtBQWN4RCxTQUFtQix1QkFBdUIsSUFBSSxRQUFjO0FBQzVELFNBQVMsc0JBQXNCLEtBQUsscUJBQXFCO0FBRXpELFNBQW1CLG1CQUFtQixJQUFJLFFBQWM7QUFDeEQsU0FBUyxrQkFBa0IsS0FBSyxpQkFBaUI7QUFFakQsU0FBbUIsb0NBQW9DLElBQUksUUFBYztBQUN6RSxTQUFTLG1DQUFtQyxLQUFLLGtDQUFrQztBQUlsRixTQUFLLFdBQVcsdUJBQU8sT0FBTyxJQUFJO0FBQ2xDLFNBQUssZUFBZTtBQUNwQixvQkFBZ0IsSUFBSSxVQUFRLGtCQUFrQixNQUFNLFdBQVcsQ0FBQyxFQUFFLFFBQVEsQ0FBQyxZQUFZO0FBQ3RGLFlBQU0sU0FBUyxRQUFRO0FBQ3ZC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TUFBTSxRQUFRO0FBQUEsUUFDakQsT0FBTztBQUNOLGVBQUssdUJBQXVCLEtBQUs7QUFBQSxRQUNsQztBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFVBQVUsTUFBdUI7QUFDeEMsUUFBSSxTQUFTO0FBQ2IsZUFBVyxjQUFjLEtBQUssb0JBQW9CO0FBQ2pELFlBQU0sVUFBVSxXQUFXLElBQUksT0FBTyxLQUFLLElBQUk7QUFDL0MsVUFBSSxTQUFTO0FBQ1osWUFBSSxLQUFLLG1CQUFtQixHQUFHO0FBQzlCLGVBQUssaUJBQWlCLEtBQUs7QUFBQSxRQUM1QixPQUFPO0FBQ04sZUFBSyxrQ0FBa0MsS0FBSztBQUFBLFFBQzdDO0FBQ0EsWUFBSSxLQUFLLDBCQUEwQixJQUFJLFdBQVcsR0FBRyxHQUFHO0FBQ3ZELGVBQUssMEJBQTBCLE9BQU8sV0FBVyxHQUFHO0FBQ3BELGVBQUsscUJBQXFCO0FBQzFCLGVBQUssa0JBQWtCLEtBQUssdUJBQXVCLE9BQU8seURBQWtELENBQUM7QUFDN0csbUJBQVM7QUFDVCxlQUFLLE1BQU0sS0FBSyxJQUFJO0FBQ3BCLGdCQUFNLFFBQVEsV0FBVyxRQUFRO0FBQ2pDLGVBQUssYUFBYSxLQUFLO0FBQ3ZCLGVBQUssa0JBQWtCO0FBQUEsUUFDeEI7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx1QkFBNkI7QUFDcEMsU0FBSyxnQ0FBZ0M7QUFDckMsU0FBSyxlQUFlO0FBQ3BCLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLGtDQUF3QztBQUMvQyxRQUFJLEtBQUssZ0JBQWdCLEtBQUssaUJBQWlCO0FBQzlDLFdBQUssa0NBQWtDLEtBQUssY0FBYyxLQUFLLGVBQWU7QUFBQSxJQUMvRTtBQUFBLEVBQ0Q7QUFBQSxFQUVnQixPQUFhO0FBQzVCLEtBQUMsR0FBRyxLQUFLLGVBQWUsS0FBSyxDQUFDLEVBQUUsUUFBUSxXQUFTO0FBQ2hELFdBQUssdUJBQXVCLEtBQUs7QUFBQSxJQUNsQyxDQUFDO0FBQ0QsVUFBTSxLQUFLO0FBQUEsRUFDWjtBQUFBLEVBRU8sYUFBc0I7QUFDNUIsV0FBTyxLQUFLLG1CQUFtQixTQUFTO0FBQUEsRUFDekM7QUFDRDsiLAogICJuYW1lcyI6IFsiUHJvYmxlbUNvbGxlY3RvckV2ZW50S2luZCIsICJJUHJvYmxlbUNvbGxlY3RvckV2ZW50IiwgIlByb2JsZW1IYW5kbGluZ1N0cmF0ZWd5Il0KfQo=
