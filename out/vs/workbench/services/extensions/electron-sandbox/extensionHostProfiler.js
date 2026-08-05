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
import { TernarySearchTree } from "../../../../base/common/ternarySearchTree.js";
import { IExtensionService } from "../common/extensions.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { IV8InspectProfilingService } from "../../../../platform/profiling/common/profiling.js";
import { createSingleCallFunction } from "../../../../base/common/functional.js";
let ExtensionHostProfiler = class {
  constructor(_host, _port, _extensionService, _profilingService) {
    this._host = _host;
    this._port = _port;
    this._extensionService = _extensionService;
    this._profilingService = _profilingService;
  }
  async start() {
    const id = await this._profilingService.startProfiling({ host: this._host, port: this._port });
    return {
      stop: createSingleCallFunction(async () => {
        const profile = await this._profilingService.stopProfiling(id);
        await this._extensionService.whenInstalledExtensionsRegistered();
        const extensions = this._extensionService.extensions;
        return this._distill(profile, extensions);
      })
    };
  }
  _distill(profile, extensions) {
    const searchTree = TernarySearchTree.forUris();
    for (const extension of extensions) {
      if (extension.extensionLocation.scheme === Schemas.file) {
        searchTree.set(URI.file(extension.extensionLocation.fsPath), extension);
      }
    }
    const nodes = profile.nodes;
    const idsToNodes = /* @__PURE__ */ new Map();
    const idsToSegmentId = /* @__PURE__ */ new Map();
    for (const node of nodes) {
      idsToNodes.set(node.id, node);
    }
    function visit(node, segmentId) {
      if (!segmentId) {
        switch (node.callFrame.functionName) {
          case "(root)":
            break;
          case "(program)":
            segmentId = "program";
            break;
          case "(garbage collector)":
            segmentId = "gc";
            break;
          default:
            segmentId = "self";
            break;
        }
      } else if (segmentId === "self" && node.callFrame.url) {
        let extension;
        try {
          extension = searchTree.findSubstr(URI.parse(node.callFrame.url));
        } catch {
        }
        if (extension) {
          segmentId = extension.identifier.value;
        }
      }
      idsToSegmentId.set(node.id, segmentId);
      if (node.children) {
        for (const child of node.children) {
          const childNode = idsToNodes.get(child);
          if (childNode) {
            visit(childNode, segmentId);
          }
        }
      }
    }
    visit(nodes[0], null);
    const samples = profile.samples || [];
    const timeDeltas = profile.timeDeltas || [];
    const distilledDeltas = [];
    const distilledIds = [];
    let currSegmentTime = 0;
    let currSegmentId;
    for (let i = 0; i < samples.length; i++) {
      const id = samples[i];
      const segmentId = idsToSegmentId.get(id);
      if (segmentId !== currSegmentId) {
        if (currSegmentId) {
          distilledIds.push(currSegmentId);
          distilledDeltas.push(currSegmentTime);
        }
        currSegmentId = segmentId ?? void 0;
        currSegmentTime = 0;
      }
      currSegmentTime += timeDeltas[i];
    }
    if (currSegmentId) {
      distilledIds.push(currSegmentId);
      distilledDeltas.push(currSegmentTime);
    }
    return {
      startTime: profile.startTime,
      endTime: profile.endTime,
      deltas: distilledDeltas,
      ids: distilledIds,
      data: profile,
      getAggregatedTimes: () => {
        const segmentsToTime = /* @__PURE__ */ new Map();
        for (let i = 0; i < distilledIds.length; i++) {
          const id = distilledIds[i];
          segmentsToTime.set(id, (segmentsToTime.get(id) || 0) + distilledDeltas[i]);
        }
        return segmentsToTime;
      }
    };
  }
};
ExtensionHostProfiler = __decorateClass([
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IV8InspectProfilingService)
], ExtensionHostProfiler);
export {
  ExtensionHostProfiler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9lbGVjdHJvbi1zYW5kYm94L2V4dGVuc2lvbkhvc3RQcm9maWxlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IFRlcm5hcnlTZWFyY2hUcmVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdGVybmFyeVNlYXJjaFRyZWUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkhvc3RQcm9maWxlLCBJRXh0ZW5zaW9uU2VydmljZSwgUHJvZmlsZVNlZ21lbnRJZCwgUHJvZmlsZVNlc3Npb24gfSBmcm9tICcuLi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFNjaGVtYXMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9uZXR3b3JrLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBJVjhJbnNwZWN0UHJvZmlsaW5nU2VydmljZSwgSVY4UHJvZmlsZSwgSVY4UHJvZmlsZU5vZGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9maWxpbmcvY29tbW9uL3Byb2ZpbGluZy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVTaW5nbGVDYWxsRnVuY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9mdW5jdGlvbmFsLmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbkhvc3RQcm9maWxlciB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaG9zdDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3BvcnQ6IG51bWJlcixcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElWOEluc3BlY3RQcm9maWxpbmdTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Byb2ZpbGluZ1NlcnZpY2U6IElWOEluc3BlY3RQcm9maWxpbmdTZXJ2aWNlLFxuXHQpIHtcblx0fVxuXG5cdHB1YmxpYyBhc3luYyBzdGFydCgpOiBQcm9taXNlPFByb2ZpbGVTZXNzaW9uPiB7XG5cblx0XHRjb25zdCBpZCA9IGF3YWl0IHRoaXMuX3Byb2ZpbGluZ1NlcnZpY2Uuc3RhcnRQcm9maWxpbmcoeyBob3N0OiB0aGlzLl9ob3N0LCBwb3J0OiB0aGlzLl9wb3J0IH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0b3A6IGNyZWF0ZVNpbmdsZUNhbGxGdW5jdGlvbihhc3luYyAoKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHByb2ZpbGUgPSBhd2FpdCB0aGlzLl9wcm9maWxpbmdTZXJ2aWNlLnN0b3BQcm9maWxpbmcoaWQpO1xuXHRcdFx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5fZXh0ZW5zaW9uU2VydmljZS5leHRlbnNpb25zO1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fZGlzdGlsbChwcm9maWxlLCBleHRlbnNpb25zKTtcblx0XHRcdH0pXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgX2Rpc3RpbGwocHJvZmlsZTogSVY4UHJvZmlsZSwgZXh0ZW5zaW9uczogcmVhZG9ubHkgSUV4dGVuc2lvbkRlc2NyaXB0aW9uW10pOiBJRXh0ZW5zaW9uSG9zdFByb2ZpbGUge1xuXHRcdGNvbnN0IHNlYXJjaFRyZWUgPSBUZXJuYXJ5U2VhcmNoVHJlZS5mb3JVcmlzPElFeHRlbnNpb25EZXNjcmlwdGlvbj4oKTtcblx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBleHRlbnNpb25zKSB7XG5cdFx0XHRpZiAoZXh0ZW5zaW9uLmV4dGVuc2lvbkxvY2F0aW9uLnNjaGVtZSA9PT0gU2NoZW1hcy5maWxlKSB7XG5cdFx0XHRcdHNlYXJjaFRyZWUuc2V0KFVSSS5maWxlKGV4dGVuc2lvbi5leHRlbnNpb25Mb2NhdGlvbi5mc1BhdGgpLCBleHRlbnNpb24pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IG5vZGVzID0gcHJvZmlsZS5ub2Rlcztcblx0XHRjb25zdCBpZHNUb05vZGVzID0gbmV3IE1hcDxudW1iZXIsIElWOFByb2ZpbGVOb2RlPigpO1xuXHRcdGNvbnN0IGlkc1RvU2VnbWVudElkID0gbmV3IE1hcDxudW1iZXIsIFByb2ZpbGVTZWdtZW50SWQgfCBudWxsPigpO1xuXHRcdGZvciAoY29uc3Qgbm9kZSBvZiBub2Rlcykge1xuXHRcdFx0aWRzVG9Ob2Rlcy5zZXQobm9kZS5pZCwgbm9kZSk7XG5cdFx0fVxuXG5cdFx0ZnVuY3Rpb24gdmlzaXQobm9kZTogSVY4UHJvZmlsZU5vZGUsIHNlZ21lbnRJZDogUHJvZmlsZVNlZ21lbnRJZCB8IG51bGwpIHtcblx0XHRcdGlmICghc2VnbWVudElkKSB7XG5cdFx0XHRcdHN3aXRjaCAobm9kZS5jYWxsRnJhbWUuZnVuY3Rpb25OYW1lKSB7XG5cdFx0XHRcdFx0Y2FzZSAnKHJvb3QpJzpcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgJyhwcm9ncmFtKSc6XG5cdFx0XHRcdFx0XHRzZWdtZW50SWQgPSAncHJvZ3JhbSc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlICcoZ2FyYmFnZSBjb2xsZWN0b3IpJzpcblx0XHRcdFx0XHRcdHNlZ21lbnRJZCA9ICdnYyc7XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRcdFx0c2VnbWVudElkID0gJ3NlbGYnO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSBpZiAoc2VnbWVudElkID09PSAnc2VsZicgJiYgbm9kZS5jYWxsRnJhbWUudXJsKSB7XG5cdFx0XHRcdGxldCBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiB8IHVuZGVmaW5lZDtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRleHRlbnNpb24gPSBzZWFyY2hUcmVlLmZpbmRTdWJzdHIoVVJJLnBhcnNlKG5vZGUuY2FsbEZyYW1lLnVybCkpO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoZXh0ZW5zaW9uKSB7XG5cdFx0XHRcdFx0c2VnbWVudElkID0gZXh0ZW5zaW9uLmlkZW50aWZpZXIudmFsdWU7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHRcdGlkc1RvU2VnbWVudElkLnNldChub2RlLmlkLCBzZWdtZW50SWQpO1xuXG5cdFx0XHRpZiAobm9kZS5jaGlsZHJlbikge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0XHRjb25zdCBjaGlsZE5vZGUgPSBpZHNUb05vZGVzLmdldChjaGlsZCk7XG5cdFx0XHRcdFx0aWYgKGNoaWxkTm9kZSkge1xuXHRcdFx0XHRcdFx0dmlzaXQoY2hpbGROb2RlLCBzZWdtZW50SWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR2aXNpdChub2Rlc1swXSwgbnVsbCk7XG5cblx0XHRjb25zdCBzYW1wbGVzID0gcHJvZmlsZS5zYW1wbGVzIHx8IFtdO1xuXHRcdGNvbnN0IHRpbWVEZWx0YXMgPSBwcm9maWxlLnRpbWVEZWx0YXMgfHwgW107XG5cdFx0Y29uc3QgZGlzdGlsbGVkRGVsdGFzOiBudW1iZXJbXSA9IFtdO1xuXHRcdGNvbnN0IGRpc3RpbGxlZElkczogUHJvZmlsZVNlZ21lbnRJZFtdID0gW107XG5cblx0XHRsZXQgY3VyclNlZ21lbnRUaW1lID0gMDtcblx0XHRsZXQgY3VyclNlZ21lbnRJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgc2FtcGxlcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0Y29uc3QgaWQgPSBzYW1wbGVzW2ldO1xuXHRcdFx0Y29uc3Qgc2VnbWVudElkID0gaWRzVG9TZWdtZW50SWQuZ2V0KGlkKTtcblx0XHRcdGlmIChzZWdtZW50SWQgIT09IGN1cnJTZWdtZW50SWQpIHtcblx0XHRcdFx0aWYgKGN1cnJTZWdtZW50SWQpIHtcblx0XHRcdFx0XHRkaXN0aWxsZWRJZHMucHVzaChjdXJyU2VnbWVudElkKTtcblx0XHRcdFx0XHRkaXN0aWxsZWREZWx0YXMucHVzaChjdXJyU2VnbWVudFRpbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGN1cnJTZWdtZW50SWQgPSBzZWdtZW50SWQgPz8gdW5kZWZpbmVkO1xuXHRcdFx0XHRjdXJyU2VnbWVudFRpbWUgPSAwO1xuXHRcdFx0fVxuXHRcdFx0Y3VyclNlZ21lbnRUaW1lICs9IHRpbWVEZWx0YXNbaV07XG5cdFx0fVxuXHRcdGlmIChjdXJyU2VnbWVudElkKSB7XG5cdFx0XHRkaXN0aWxsZWRJZHMucHVzaChjdXJyU2VnbWVudElkKTtcblx0XHRcdGRpc3RpbGxlZERlbHRhcy5wdXNoKGN1cnJTZWdtZW50VGltZSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHtcblx0XHRcdHN0YXJ0VGltZTogcHJvZmlsZS5zdGFydFRpbWUsXG5cdFx0XHRlbmRUaW1lOiBwcm9maWxlLmVuZFRpbWUsXG5cdFx0XHRkZWx0YXM6IGRpc3RpbGxlZERlbHRhcyxcblx0XHRcdGlkczogZGlzdGlsbGVkSWRzLFxuXHRcdFx0ZGF0YTogcHJvZmlsZSxcblx0XHRcdGdldEFnZ3JlZ2F0ZWRUaW1lczogKCkgPT4ge1xuXHRcdFx0XHRjb25zdCBzZWdtZW50c1RvVGltZSA9IG5ldyBNYXA8UHJvZmlsZVNlZ21lbnRJZCwgbnVtYmVyPigpO1xuXHRcdFx0XHRmb3IgKGxldCBpID0gMDsgaSA8IGRpc3RpbGxlZElkcy5sZW5ndGg7IGkrKykge1xuXHRcdFx0XHRcdGNvbnN0IGlkID0gZGlzdGlsbGVkSWRzW2ldO1xuXHRcdFx0XHRcdHNlZ21lbnRzVG9UaW1lLnNldChpZCwgKHNlZ21lbnRzVG9UaW1lLmdldChpZCkgfHwgMCkgKyBkaXN0aWxsZWREZWx0YXNbaV0pO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHJldHVybiBzZWdtZW50c1RvVGltZTtcblx0XHRcdH1cblx0XHR9O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMseUJBQXlCO0FBQ2xDLFNBQWdDLHlCQUEyRDtBQUUzRixTQUFTLGVBQWU7QUFDeEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsa0NBQThEO0FBQ3ZFLFNBQVMsZ0NBQWdDO0FBRWxDLElBQU0sd0JBQU4sTUFBNEI7QUFBQSxFQUVsQyxZQUNrQixPQUNBLE9BQ21CLG1CQUNTLG1CQUM1QztBQUpnQjtBQUNBO0FBQ21CO0FBQ1M7QUFBQSxFQUU5QztBQUFBLEVBRUEsTUFBYSxRQUFpQztBQUU3QyxVQUFNLEtBQUssTUFBTSxLQUFLLGtCQUFrQixlQUFlLEVBQUUs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
