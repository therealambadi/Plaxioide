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
import { timeout } from "../../../../base/common/async.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { INativeWorkbenchEnvironmentService } from "../../../services/environment/electron-sandbox/environmentService.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IUpdateService } from "../../../../platform/update/common/update.js";
import { INativeHostService } from "../../../../platform/native/common/native.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { ITimerService } from "../../../services/timer/browser/timerService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { URI } from "../../../../base/common/uri.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { IWorkspaceTrustManagementService } from "../../../../platform/workspace/common/workspaceTrust.js";
import { IPaneCompositePartService } from "../../../services/panecomposite/browser/panecomposite.js";
import { StartupTimings } from "../browser/startupTimings.js";
import { coalesce } from "../../../../base/common/arrays.js";
let NativeStartupTimings = class extends StartupTimings {
  constructor(_fileService, _timerService, _nativeHostService, editorService, paneCompositeService, _telemetryService, lifecycleService, updateService, _environmentService, _productService, workspaceTrustService) {
    super(editorService, paneCompositeService, lifecycleService, updateService, workspaceTrustService);
    this._fileService = _fileService;
    this._timerService = _timerService;
    this._nativeHostService = _nativeHostService;
    this._telemetryService = _telemetryService;
    this._environmentService = _environmentService;
    this._productService = _productService;
    this._report().catch(onUnexpectedError);
  }
  async _report() {
    const standardStartupError = await this._isStandardStartup();
    this._appendStartupTimes(standardStartupError).catch(onUnexpectedError);
  }
  async _appendStartupTimes(standardStartupError) {
    const appendTo = this._environmentService.args["prof-append-timers"];
    const durationMarkers = this._environmentService.args["prof-duration-markers"];
    const durationMarkersFile = this._environmentService.args["prof-duration-markers-file"];
    if (!appendTo && !durationMarkers) {
      return;
    }
    try {
      await Promise.all([
        this._timerService.whenReady(),
        timeout(15e3)
        // wait: cached data creation, telemetry sending
      ]);
      const perfBaseline = await this._timerService.perfBaseline;
      const heapStatistics = await this._resolveStartupHeapStatistics();
      if (heapStatistics) {
        this._telemetryLogHeapStatistics(heapStatistics);
      }
      if (appendTo) {
        const content = coalesce([
          this._timerService.startupMetrics.ellapsed,
          this._productService.nameShort,
          (this._productService.commit || "").slice(0, 10) || "0000000000",
          this._telemetryService.sessionId,
          standardStartupError === void 0 ? "standard_start" : `NO_standard_start : ${standardStartupError}`,
          `${String(perfBaseline).padStart(4, "0")}ms`,
          heapStatistics ? this._printStartupHeapStatistics(heapStatistics) : void 0
        ]).join("	") + "\n";
        await this._appendContent(URI.file(appendTo), content);
      }
      if (durationMarkers?.length) {
        const durations = [];
        for (const durationMarker of durationMarkers) {
          let duration = 0;
          if (durationMarker === "ellapsed") {
            duration = this._timerService.startupMetrics.ellapsed;
          } else if (durationMarker.indexOf("-") !== -1) {
            const markers = durationMarker.split("-");
            if (markers.length === 2) {
              duration = this._timerService.getDuration(markers[0], markers[1]);
            }
          }
          if (duration) {
            durations.push(durationMarker);
            durations.push(`${duration}`);
          }
        }
        const durationsContent = `${durations.join("	")}
`;
        if (durationMarkersFile) {
          await this._appendContent(URI.file(durationMarkersFile), durationsContent);
        } else {
          console.log(durationsContent);
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      this._nativeHostService.exit(0);
    }
  }
  async _isStandardStartup() {
    const windowCount = await this._nativeHostService.getWindowCount();
    if (windowCount !== 1) {
      return `Expected window count : 1, Actual : ${windowCount}`;
    }
    return super._isStandardStartup();
  }
  async _appendContent(file, content) {
    const chunks = [];
    if (await this._fileService.exists(file)) {
      chunks.push((await this._fileService.readFile(file)).value);
    }
    chunks.push(VSBuffer.fromString(content));
    await this._fileService.writeFile(file, VSBuffer.concat(chunks));
  }
  async _resolveStartupHeapStatistics() {
    if (!this._environmentService.args["enable-tracing"] || !this._environmentService.args["trace-startup-file"] || this._environmentService.args["trace-startup-format"] !== "json" || !this._environmentService.args["trace-startup-duration"]) {
      return void 0;
    }
    const windowProcessId = await this._nativeHostService.getProcessId();
    const used = performance.memory?.usedJSHeapSize ?? 0;
    let minorGCs = 0;
    let majorGCs = 0;
    let garbage = 0;
    let duration = 0;
    try {
      const traceContents = JSON.parse((await this._fileService.readFile(URI.file(this._environmentService.args["trace-startup-file"]))).value.toString());
      for (const event of traceContents.traceEvents) {
        if (event.pid !== windowProcessId) {
          continue;
        }
        switch (event.name) {
          // Major/Minor GC Events
          case "MinorGC":
            minorGCs++;
            break;
          case "MajorGC":
            majorGCs++;
            break;
          // GC Events that block the main thread
          // Refs: https://v8.dev/blog/trash-talk
          case "V8.GCFinalizeMC":
          case "V8.GCScavenger":
            duration += event.dur;
            break;
        }
        if (event.name === "MajorGC" || event.name === "MinorGC") {
          if (typeof event.args?.usedHeapSizeAfter === "number" && typeof event.args.usedHeapSizeBefore === "number") {
            garbage += event.args.usedHeapSizeBefore - event.args.usedHeapSizeAfter;
          }
        }
      }
      return { minorGCs, majorGCs, used, garbage, duration: Math.round(duration / 1e3) };
    } catch (error) {
      console.error(error);
    }
    return void 0;
  }
  _telemetryLogHeapStatistics({ used, garbage, majorGCs, minorGCs, duration }) {
    this._telemetryService.publicLog2("startupHeapStatistics", {
      heapUsed: used,
      heapGarbage: garbage,
      majorGCs,
      minorGCs,
      gcsDuration: duration
    });
  }
  _printStartupHeapStatistics({ used, garbage, majorGCs, minorGCs, duration }) {
    const MB = 1024 * 1024;
    return `Heap: ${Math.round(used / MB)}MB (used) ${Math.round(garbage / MB)}MB (garbage) ${majorGCs} (MajorGC) ${minorGCs} (MinorGC) ${duration}ms (GC duration)`;
  }
};
NativeStartupTimings = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, ITimerService),
  __decorateParam(2, INativeHostService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IPaneCompositePartService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, ILifecycleService),
  __decorateParam(7, IUpdateService),
  __decorateParam(8, INativeWorkbenchEnvironmentService),
  __decorateParam(9, IProductService),
  __decorateParam(10, IWorkspaceTrustManagementService)
], NativeStartupTimings);
export {
  NativeStartupTimings
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wZXJmb3JtYW5jZS9lbGVjdHJvbi1zYW5kYm94L3N0YXJ0dXBUaW1pbmdzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJTmF0aXZlV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvZWxlY3Ryb24tc2FuZGJveC9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RlbGVtZXRyeS9jb21tb24vdGVsZW1ldHJ5LmpzJztcbmltcG9ydCB7IElVcGRhdGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdXBkYXRlL2NvbW1vbi91cGRhdGUuanMnO1xuaW1wb3J0IHsgSU5hdGl2ZUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbmF0aXZlL2NvbW1vbi9uYXRpdmUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRpbWVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3RpbWVyL2Jyb3dzZXIvdGltZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgVlNCdWZmZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9idWZmZXIuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZVRydXN0TWFuYWdlbWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZVRydXN0LmpzJztcbmltcG9ydCB7IElQYW5lQ29tcG9zaXRlUGFydFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYW5lY29tcG9zaXRlL2Jyb3dzZXIvcGFuZWNvbXBvc2l0ZS5qcyc7XG5pbXBvcnQgeyBTdGFydHVwVGltaW5ncyB9IGZyb20gJy4uL2Jyb3dzZXIvc3RhcnR1cFRpbWluZ3MuanMnO1xuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuXG5pbnRlcmZhY2UgSVRyYWNpbmdEYXRhIHtcblx0cmVhZG9ubHkgYXJncz86IHtcblx0XHRyZWFkb25seSB1c2VkSGVhcFNpemVBZnRlcj86IG51bWJlcjtcblx0XHRyZWFkb25seSB1c2VkSGVhcFNpemVCZWZvcmU/OiBudW1iZXI7XG5cdH07XG5cdHJlYWRvbmx5IGR1cjogbnVtYmVyOyBcdC8vIGluIG1pY3Jvc2Vjb25kc1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XHQvLyBlLmcuIE1pbm9yR0Mgb3IgTWFqb3JHQ1xuXHRyZWFkb25seSBwaWQ6IG51bWJlcjtcbn1cblxuaW50ZXJmYWNlIElIZWFwU3RhdGlzdGljcyB7XG5cdHJlYWRvbmx5IHVzZWQ6IG51bWJlcjtcblx0cmVhZG9ubHkgZ2FyYmFnZTogbnVtYmVyO1xuXHRyZWFkb25seSBtYWpvckdDczogbnVtYmVyO1xuXHRyZWFkb25seSBtaW5vckdDczogbnVtYmVyO1xuXHRyZWFkb25seSBkdXJhdGlvbjogbnVtYmVyO1xufVxuXG5leHBvcnQgY2xhc3MgTmF0aXZlU3RhcnR1cFRpbWluZ3MgZXh0ZW5kcyBTdGFydHVwVGltaW5ncyBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVRpbWVyU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90aW1lclNlcnZpY2U6IElUaW1lclNlcnZpY2UsXG5cdFx0QElOYXRpdmVIb3N0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9uYXRpdmVIb3N0U2VydmljZTogSU5hdGl2ZUhvc3RTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSBwYW5lQ29tcG9zaXRlU2VydmljZTogSVBhbmVDb21wb3NpdGVQYXJ0U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIGxpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJVXBkYXRlU2VydmljZSB1cGRhdGVTZXJ2aWNlOiBJVXBkYXRlU2VydmljZSxcblx0XHRASU5hdGl2ZVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lbnZpcm9ubWVudFNlcnZpY2U6IElOYXRpdmVXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlVHJ1c3RNYW5hZ2VtZW50U2VydmljZSB3b3Jrc3BhY2VUcnVzdFNlcnZpY2U6IElXb3Jrc3BhY2VUcnVzdE1hbmFnZW1lbnRTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKGVkaXRvclNlcnZpY2UsIHBhbmVDb21wb3NpdGVTZXJ2aWNlLCBsaWZlY3ljbGVTZXJ2aWNlLCB1cGRhdGVTZXJ2aWNlLCB3b3Jrc3BhY2VUcnVzdFNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fcmVwb3J0KCkuY2F0Y2gob25VbmV4cGVjdGVkRXJyb3IpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcmVwb3J0KCkge1xuXHRcdGNvbnN0IHN0YW5kYXJkU3RhcnR1cEVycm9yID0gYXdhaXQgdGhpcy5faXNTdGFuZGFyZFN0YXJ0dXAoKTtcblx0XHR0aGlzLl9hcHBlbmRTdGFydHVwVGltZXMoc3RhbmRhcmRTdGFydHVwRXJyb3IpLmNhdGNoKG9uVW5leHBlY3RlZEVycm9yKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FwcGVuZFN0YXJ0dXBUaW1lcyhzdGFuZGFyZFN0YXJ0dXBFcnJvcjogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0Y29uc3QgYXBwZW5kVG8gPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sncHJvZi1hcHBlbmQtdGltZXJzJ107XG5cdFx0Y29uc3QgZHVyYXRpb25NYXJrZXJzID0gdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ3Byb2YtZHVyYXRpb24tbWFya2VycyddO1xuXHRcdGNvbnN0IGR1cmF0aW9uTWFya2Vyc0ZpbGUgPSB0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sncHJvZi1kdXJhdGlvbi1tYXJrZXJzLWZpbGUnXTtcblx0XHRpZiAoIWFwcGVuZFRvICYmICFkdXJhdGlvbk1hcmtlcnMpIHtcblx0XHRcdC8vIG5vdGhpbmcgdG8gZG9cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0cnkge1xuXHRcdFx0YXdhaXQgUHJvbWlzZS5hbGwoW1xuXHRcdFx0XHR0aGlzLl90aW1lclNlcnZpY2Uud2hlblJlYWR5KCksXG5cdFx0XHRcdHRpbWVvdXQoMTUwMDApLCAvLyB3YWl0OiBjYWNoZWQgZGF0YSBjcmVhdGlvbiwgdGVsZW1ldHJ5IHNlbmRpbmdcblx0XHRcdF0pO1xuXG5cdFx0XHRjb25zdCBwZXJmQmFzZWxpbmUgPSBhd2FpdCB0aGlzLl90aW1lclNlcnZpY2UucGVyZkJhc2VsaW5lO1xuXHRcdFx0Y29uc3QgaGVhcFN0YXRpc3RpY3MgPSBhd2FpdCB0aGlzLl9yZXNvbHZlU3RhcnR1cEhlYXBTdGF0aXN0aWNzKCk7XG5cdFx0XHRpZiAoaGVhcFN0YXRpc3RpY3MpIHtcblx0XHRcdFx0dGhpcy5fdGVsZW1ldHJ5TG9nSGVhcFN0YXRpc3RpY3MoaGVhcFN0YXRpc3RpY3MpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoYXBwZW5kVG8pIHtcblx0XHRcdFx0Y29uc3QgY29udGVudCA9IGNvYWxlc2NlKFtcblx0XHRcdFx0XHR0aGlzLl90aW1lclNlcnZpY2Uuc3RhcnR1cE1ldHJpY3MuZWxsYXBzZWQsXG5cdFx0XHRcdFx0dGhpcy5fcHJvZHVjdFNlcnZpY2UubmFtZVNob3J0LFxuXHRcdFx0XHRcdCh0aGlzLl9wcm9kdWN0U2VydmljZS5jb21taXQgfHwgJycpLnNsaWNlKDAsIDEwKSB8fCAnMDAwMDAwMDAwMCcsXG5cdFx0XHRcdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5zZXNzaW9uSWQsXG5cdFx0XHRcdFx0c3RhbmRhcmRTdGFydHVwRXJyb3IgPT09IHVuZGVmaW5lZCA/ICdzdGFuZGFyZF9zdGFydCcgOiBgTk9fc3RhbmRhcmRfc3RhcnQgOiAke3N0YW5kYXJkU3RhcnR1cEVycm9yfWAsXG5cdFx0XHRcdFx0YCR7U3RyaW5nKHBlcmZCYXNlbGluZSkucGFkU3RhcnQoNCwgJzAnKX1tc2AsXG5cdFx0XHRcdFx0aGVhcFN0YXRpc3RpY3MgPyB0aGlzLl9wcmludFN0YXJ0dXBIZWFwU3RhdGlzdGljcyhoZWFwU3RhdGlzdGljcykgOiB1bmRlZmluZWRcblx0XHRcdFx0XSkuam9pbignXFx0JykgKyAnXFxuJztcblx0XHRcdFx0YXdhaXQgdGhpcy5fYXBwZW5kQ29udGVudChVUkkuZmlsZShhcHBlbmRUbyksIGNvbnRlbnQpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAoZHVyYXRpb25NYXJrZXJzPy5sZW5ndGgpIHtcblx0XHRcdFx0Y29uc3QgZHVyYXRpb25zOiBzdHJpbmdbXSA9IFtdO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGR1cmF0aW9uTWFya2VyIG9mIGR1cmF0aW9uTWFya2Vycykge1xuXHRcdFx0XHRcdGxldCBkdXJhdGlvbjogbnVtYmVyID0gMDtcblx0XHRcdFx0XHRpZiAoZHVyYXRpb25NYXJrZXIgPT09ICdlbGxhcHNlZCcpIHtcblx0XHRcdFx0XHRcdGR1cmF0aW9uID0gdGhpcy5fdGltZXJTZXJ2aWNlLnN0YXJ0dXBNZXRyaWNzLmVsbGFwc2VkO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAoZHVyYXRpb25NYXJrZXIuaW5kZXhPZignLScpICE9PSAtMSkge1xuXHRcdFx0XHRcdFx0Y29uc3QgbWFya2VycyA9IGR1cmF0aW9uTWFya2VyLnNwbGl0KCctJyk7XG5cdFx0XHRcdFx0XHRpZiAobWFya2Vycy5sZW5ndGggPT09IDIpIHtcblx0XHRcdFx0XHRcdFx0ZHVyYXRpb24gPSB0aGlzLl90aW1lclNlcnZpY2UuZ2V0RHVyYXRpb24obWFya2Vyc1swXSwgbWFya2Vyc1sxXSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChkdXJhdGlvbikge1xuXHRcdFx0XHRcdFx0ZHVyYXRpb25zLnB1c2goZHVyYXRpb25NYXJrZXIpO1xuXHRcdFx0XHRcdFx0ZHVyYXRpb25zLnB1c2goYCR7ZHVyYXRpb259YCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgZHVyYXRpb25zQ29udGVudCA9IGAke2R1cmF0aW9ucy5qb2luKCdcXHQnKX1cXG5gO1xuXHRcdFx0XHRpZiAoZHVyYXRpb25NYXJrZXJzRmlsZSkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2FwcGVuZENvbnRlbnQoVVJJLmZpbGUoZHVyYXRpb25NYXJrZXJzRmlsZSksIGR1cmF0aW9uc0NvbnRlbnQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGNvbnNvbGUubG9nKGR1cmF0aW9uc0NvbnRlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoZXJyKTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dGhpcy5fbmF0aXZlSG9zdFNlcnZpY2UuZXhpdCgwKTtcblx0XHR9XG5cdH1cblxuXHRwcm90ZWN0ZWQgb3ZlcnJpZGUgYXN5bmMgX2lzU3RhbmRhcmRTdGFydHVwKCk6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3Qgd2luZG93Q291bnQgPSBhd2FpdCB0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5nZXRXaW5kb3dDb3VudCgpO1xuXHRcdGlmICh3aW5kb3dDb3VudCAhPT0gMSkge1xuXHRcdFx0cmV0dXJuIGBFeHBlY3RlZCB3aW5kb3cgY291bnQgOiAxLCBBY3R1YWwgOiAke3dpbmRvd0NvdW50fWA7XG5cdFx0fVxuXHRcdHJldHVybiBzdXBlci5faXNTdGFuZGFyZFN0YXJ0dXAoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2FwcGVuZENvbnRlbnQoZmlsZTogVVJJLCBjb250ZW50OiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjaHVua3M6IFZTQnVmZmVyW10gPSBbXTtcblx0XHRpZiAoYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UuZXhpc3RzKGZpbGUpKSB7XG5cdFx0XHRjaHVua3MucHVzaCgoYXdhaXQgdGhpcy5fZmlsZVNlcnZpY2UucmVhZEZpbGUoZmlsZSkpLnZhbHVlKTtcblx0XHR9XG5cdFx0Y2h1bmtzLnB1c2goVlNCdWZmZXIuZnJvbVN0cmluZyhjb250ZW50KSk7XG5cdFx0YXdhaXQgdGhpcy5fZmlsZVNlcnZpY2Uud3JpdGVGaWxlKGZpbGUsIFZTQnVmZmVyLmNvbmNhdChjaHVua3MpKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX3Jlc29sdmVTdGFydHVwSGVhcFN0YXRpc3RpY3MoKTogUHJvbWlzZTxJSGVhcFN0YXRpc3RpY3MgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoXG5cdFx0XHQhdGhpcy5fZW52aXJvbm1lbnRTZXJ2aWNlLmFyZ3NbJ2VuYWJsZS10cmFjaW5nJ10gfHxcblx0XHRcdCF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sndHJhY2Utc3RhcnR1cC1maWxlJ10gfHxcblx0XHRcdHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWyd0cmFjZS1zdGFydHVwLWZvcm1hdCddICE9PSAnanNvbicgfHxcblx0XHRcdCF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UuYXJnc1sndHJhY2Utc3RhcnR1cC1kdXJhdGlvbiddXG5cdFx0KSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkOyAvLyB1bmV4cGVjdGVkIGFyZ3VtZW50cyBmb3Igc3RhcnR1cCBoZWFwIHN0YXRpc3RpY3Ncblx0XHR9XG5cblx0XHRjb25zdCB3aW5kb3dQcm9jZXNzSWQgPSBhd2FpdCB0aGlzLl9uYXRpdmVIb3N0U2VydmljZS5nZXRQcm9jZXNzSWQoKTtcblx0XHRjb25zdCB1c2VkID0gKHBlcmZvcm1hbmNlIGFzIHVua25vd24gYXMgeyBtZW1vcnk/OiB7IHVzZWRKU0hlYXBTaXplPzogbnVtYmVyIH0gfSkubWVtb3J5Py51c2VkSlNIZWFwU2l6ZSA/PyAwOyAvLyBodHRwczovL2RldmVsb3Blci5tb3ppbGxhLm9yZy9lbi1VUy9kb2NzL1dlYi9BUEkvUGVyZm9ybWFuY2UvbWVtb3J5XG5cblx0XHRsZXQgbWlub3JHQ3MgPSAwO1xuXHRcdGxldCBtYWpvckdDcyA9IDA7XG5cdFx0bGV0IGdhcmJhZ2UgPSAwO1xuXHRcdGxldCBkdXJhdGlvbiA9IDA7XG5cblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdHJhY2VDb250ZW50czogeyB0cmFjZUV2ZW50czogSVRyYWNpbmdEYXRhW10gfSA9IEpTT04ucGFyc2UoKGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLnJlYWRGaWxlKFVSSS5maWxlKHRoaXMuX2Vudmlyb25tZW50U2VydmljZS5hcmdzWyd0cmFjZS1zdGFydHVwLWZpbGUnXSkpKS52YWx1ZS50b1N0cmluZygpKTtcblx0XHRcdGZvciAoY29uc3QgZXZlbnQgb2YgdHJhY2VDb250ZW50cy50cmFjZUV2ZW50cykge1xuXHRcdFx0XHRpZiAoZXZlbnQucGlkICE9PSB3aW5kb3dQcm9jZXNzSWQpIHtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHN3aXRjaCAoZXZlbnQubmFtZSkge1xuXG5cdFx0XHRcdFx0Ly8gTWFqb3IvTWlub3IgR0MgRXZlbnRzXG5cdFx0XHRcdFx0Y2FzZSAnTWlub3JHQyc6XG5cdFx0XHRcdFx0XHRtaW5vckdDcysrO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdFx0Y2FzZSAnTWFqb3JHQyc6XG5cdFx0XHRcdFx0XHRtYWpvckdDcysrO1xuXHRcdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0XHQvLyBHQyBFdmVudHMgdGhhdCBibG9jayB0aGUgbWFpbiB0aHJlYWRcblx0XHRcdFx0XHQvLyBSZWZzOiBodHRwczovL3Y4LmRldi9ibG9nL3RyYXNoLXRhbGtcblx0XHRcdFx0XHRjYXNlICdWOC5HQ0ZpbmFsaXplTUMnOlxuXHRcdFx0XHRcdGNhc2UgJ1Y4LkdDU2NhdmVuZ2VyJzpcblx0XHRcdFx0XHRcdGR1cmF0aW9uICs9IGV2ZW50LmR1cjtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKGV2ZW50Lm5hbWUgPT09ICdNYWpvckdDJyB8fCBldmVudC5uYW1lID09PSAnTWlub3JHQycpIHtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGV2ZW50LmFyZ3M/LnVzZWRIZWFwU2l6ZUFmdGVyID09PSAnbnVtYmVyJyAmJiB0eXBlb2YgZXZlbnQuYXJncy51c2VkSGVhcFNpemVCZWZvcmUgPT09ICdudW1iZXInKSB7XG5cdFx0XHRcdFx0XHRnYXJiYWdlICs9IChldmVudC5hcmdzLnVzZWRIZWFwU2l6ZUJlZm9yZSAtIGV2ZW50LmFyZ3MudXNlZEhlYXBTaXplQWZ0ZXIpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4geyBtaW5vckdDcywgbWFqb3JHQ3MsIHVzZWQsIGdhcmJhZ2UsIGR1cmF0aW9uOiBNYXRoLnJvdW5kKGR1cmF0aW9uIC8gMTAwMCkgfTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc29sZS5lcnJvcihlcnJvcik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByaXZhdGUgX3RlbGVtZXRyeUxvZ0hlYXBTdGF0aXN0aWNzKHsgdXNlZCwgZ2FyYmFnZSwgbWFqb3JHQ3MsIG1pbm9yR0NzLCBkdXJhdGlvbiB9OiBJSGVhcFN0YXRpc3RpY3MpOiB2b2lkIHtcblx0XHR0eXBlIFN0YXJ0dXBIZWFwU3RhdGlzdGljc0NsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0b3duZXI6ICdicGFzZXJvJztcblx0XHRcdGNvbW1lbnQ6ICdBbiBldmVudCB0aGF0IHJlcG9ydHMgc3RhcnR1cCBoZWFwIHN0YXRpc3RpY3MgZm9yIHBlcmZvcm1hbmNlIGFuYWx5c2lzLic7XG5cdFx0XHRoZWFwVXNlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ1VzZWQgaGVhcCcgfTtcblx0XHRcdGhlYXBHYXJiYWdlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnR2FyYmFnZSBoZWFwJyB9O1xuXHRcdFx0bWFqb3JHQ3M6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdNYWpvciBHQ3MgY291bnQnIH07XG5cdFx0XHRtaW5vckdDczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ1BlcmZvcm1hbmNlQW5kSGVhbHRoJzsgY29tbWVudDogJ01pbm9yIEdDcyBjb3VudCcgfTtcblx0XHRcdGdjc0R1cmF0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnR0NzIGR1cmF0aW9uJyB9O1xuXHRcdH07XG5cdFx0dHlwZSBTdGFydHVwSGVhcFN0YXRpc3RpY3NFdmVudCA9IHtcblx0XHRcdGhlYXBVc2VkOiBudW1iZXI7XG5cdFx0XHRoZWFwR2FyYmFnZTogbnVtYmVyO1xuXHRcdFx0bWFqb3JHQ3M6IG51bWJlcjtcblx0XHRcdG1pbm9yR0NzOiBudW1iZXI7XG5cdFx0XHRnY3NEdXJhdGlvbjogbnVtYmVyO1xuXHRcdH07XG5cdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPFN0YXJ0dXBIZWFwU3RhdGlzdGljc0V2ZW50LCBTdGFydHVwSGVhcFN0YXRpc3RpY3NDbGFzc2lmaWNhdGlvbj4oJ3N0YXJ0dXBIZWFwU3RhdGlzdGljcycsIHtcblx0XHRcdGhlYXBVc2VkOiB1c2VkLFxuXHRcdFx0aGVhcEdhcmJhZ2U6IGdhcmJhZ2UsXG5cdFx0XHRtYWpvckdDcyxcblx0XHRcdG1pbm9yR0NzLFxuXHRcdFx0Z2NzRHVyYXRpb246IGR1cmF0aW9uXG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9wcmludFN0YXJ0dXBIZWFwU3RhdGlzdGljcyh7IHVzZWQsIGdhcmJhZ2UsIG1ham9yR0NzLCBtaW5vckdDcywgZHVyYXRpb24gfTogSUhlYXBTdGF0aXN0aWNzKSB7XG5cdFx0Y29uc3QgTUIgPSAxMDI0ICogMTAyNDtcblx0XHRyZXR1cm4gYEhlYXA6ICR7TWF0aC5yb3VuZCh1c2VkIC8gTUIpfU1CICh1c2VkKSAke01hdGgucm91bmQoZ2FyYmFnZSAvIE1CKX1NQiAoZ2FyYmFnZSkgJHttYWpvckdDc30gKE1ham9yR0MpICR7bWlub3JHQ3N9IChNaW5vckdDKSAke2R1cmF0aW9ufW1zIChHQyBkdXJhdGlvbilgO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDBDQUEwQztBQUNuRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHFCQUFxQjtBQUM5QixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLFdBQVc7QUFDcEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyx3Q0FBd0M7QUFDakQsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFvQmxCLElBQU0sdUJBQU4sY0FBbUMsZUFBaUQ7QUFBQSxFQUUxRixZQUNnQyxjQUNDLGVBQ0ssb0JBQ3JCLGVBQ1csc0JBQ1MsbUJBQ2pCLGtCQUNILGVBQ3FDLHFCQUNuQixpQkFDQSx1QkFDakM7QUFDRCxVQUFNLGVBQWUsc0JBQXNCLGtCQUFrQixlQUFlLHFCQUFxQjtBQVpsRTtBQUNDO0FBQ0s7QUFHRDtBQUdpQjtBQUNuQjtBQUtsQyxTQUFLLFFBQVEsRUFBRSxNQUFNLGlCQUFpQjtBQUFBLEVBQ3ZDO0FBQUEsRUFFQSxNQUFjLFVBQVU7QUFDdkIsVUFBTSx1QkFBdUIsTUFBTSxLQUFLLG1CQUFtQjtBQUMzRCxTQUFLLG9CQUFvQixvQkFBb0IsRUFBRSxNQUFNLGlCQUFpQjtBQUFBLEVBQ3ZFO0FBQUEsRUFFQSxNQUFjLG9CQUFvQixzQkFBMEM7QUFDM0UsVUFBTSxXQUFXLEtBQUssb0JBQW9CLEtBQUssb0JBQW9CO0FBQ25FLFVBQU0sa0JBQWtCLEtBQUssb0JBQW9CLEtBQUssdUJBQXVCO0FBQzdFLFVBQU0sc0JBQXNCLEtBQUssb0JBQW9CLEtBQUssNEJBQTRCO0FBQ3RGLFFBQUksQ0FBQyxZQUFZLENBQUMsaUJBQWlCO0FBRWxDO0FBQUEsSUFDRDtBQUVBLFFBQUk7QUFDSCxZQUFNLFFBQVEsSUFBSTtBQUFBLFFBQ2pCLEtBQUssY0FBYyxVQUFVO0FBQUEsUUFDN0IsUUFBUSxJQUFLO0FBQUE7QUFBQSxNQUNkLENBQUM7QUFFRCxZQUFNLGVBQWUsTUFBTSxLQUFLLGNBQWM7QUFDOUMsWUFBTSxpQkFBaUIsTUFBTSxLQUFLLDhCQUE4QjtBQUNoRSxVQUFJLGdCQUFnQjtBQUNuQixhQUFLLDRCQUE0QixjQUFjO0FBQUEsTUFDaEQ7QUFFQSxVQUFJLFVBQVU7QUFDYixjQUFNLFVBQVUsU0FBUztBQUFBLFVBQ3hCLEtBQUssY0FBYyxlQUFlO0FBQUEsVUFDbEMsS0FBSyxnQkFBZ0I7QUFBQSxXQUNwQixLQUFLLGdCQUFnQixVQUFVLElBQUksTUFBTSxHQUFHLEVBQUUsS0FBSztBQUFBLFVBQ3BELEtBQUssa0JBQWtCO0FBQUEsVUFDdkIseUJBQXlCLFNBQVksbUJBQW1CLHVCQUF1QixvQkFBb0I7QUFBQSxVQUNuRyxHQUFHLE9BQU8sWUFBWSxFQUFFLFNBQVMsR0FBRyxHQUFHLENBQUM7QUFBQSxVQUN4QyxpQkFBaUIsS0FBSyw0QkFBNEIsY0FBYyxJQUFJO0FBQUEsUUFDckUsQ0FBQyxFQUFFLEtBQUssR0FBSSxJQUFJO0FBQ2hCLGNBQU0sS0FBSyxlQUFlLElBQUksS0FBSyxRQUFRLEdBQUcsT0FBTztBQUFBLE1BQ3REO0FBRUEsVUFBSSxpQkFBaUIsUUFBUTtBQUM1QixjQUFNLFlBQXNCLENBQUM7QUFDN0IsbUJBQVcsa0JBQWtCLGlCQUFpQjtBQUM3QyxjQUFJLFdBQW1CO0FBQ3ZCLGNBQUksbUJBQW1CLFlBQVk7QUFDbEMsdUJBQVcsS0FBSyxjQUFjLGVBQWU7QUFBQSxVQUM5QyxXQUFXLGVBQWUsUUFBUSxHQUFHLE1BQU0sSUFBSTtBQUM5QyxrQkFBTSxVQUFVLGVBQWUsTUFBTSxHQUFHO0FBQ3hDLGdCQUFJLFFBQVEsV0FBVyxHQUFHO0FBQ3pCLHlCQUFXLEtBQUssY0FBYyxZQUFZLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxDQUFDO0FBQUEsWUFDakU7QUFBQSxVQUNEO0FBQ0EsY0FBSSxVQUFVO0FBQ2Isc0JBQVUsS0FBSyxjQUFjO0FBQzdCLHNCQUFVLEtBQUssR0FBRyxRQUFRLEVBQUU7QUFBQSxVQUM3QjtBQUFBLFFBQ0Q7QUFFQSxjQUFNLG1CQUFtQixHQUFHLFVBQVUsS0FBSyxHQUFJLENBQUM7QUFBQTtBQUNoRCxZQUFJLHFCQUFxQjtBQUN4QixnQkFBTSxLQUFLLGVBQWUsSUFBSSxLQUFLLG1CQUFtQixHQUFHLGdCQUFnQjtBQUFBLFFBQzFFLE9BQU87QUFDTixrQkFBUSxJQUFJLGdCQUFnQjtBQUFBLFFBQzdCO0FBQUEsTUFDRDtBQUFBLElBRUQsU0FBUyxLQUFLO0FBQ2IsY0FBUSxNQUFNLEdBQUc7QUFBQSxJQUNsQixVQUFFO0FBQ0QsV0FBSyxtQkFBbUIsS0FBSyxDQUFDO0FBQUEsSUFDL0I7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUF5QixxQkFBa0Q7QUFDMUUsVUFBTSxjQUFjLE1BQU0sS0FBSyxtQkFBbUIsZUFBZTtBQUNqRSxRQUFJLGdCQUFnQixHQUFHO0FBQ3RCLGFBQU8sdUNBQXVDLFdBQVc7QUFBQSxJQUMxRDtBQUNBLFdBQU8sTUFBTSxtQkFBbUI7QUFBQSxFQUNqQztBQUFBLEVBRUEsTUFBYyxlQUFlLE1BQVcsU0FBZ0M7QUFDdkUsVUFBTSxTQUFxQixDQUFDO0FBQzVCLFFBQUksTUFBTSxLQUFLLGFBQWEsT0FBTyxJQUFJLEdBQUc7QUFDekMsYUFBTyxNQUFNLE1BQU0sS0FBSyxhQUFhLFNBQVMsSUFBSSxHQUFHLEtBQUs7QUFBQSxJQUMzRDtBQUNBLFdBQU8sS0FBSyxTQUFTLFdBQVcsT0FBTyxDQUFDO0FBQ3hDLFVBQU0sS0FBSyxhQUFhLFVBQVUsTUFBTSxTQUFTLE9BQU8sTUFBTSxDQUFDO0FBQUEsRUFDaEU7QUFBQSxFQUVBLE1BQWMsZ0NBQXNFO0FBQ25GLFFBQ0MsQ0FBQyxLQUFLLG9CQUFvQixLQUFLLGdCQUFnQixLQUMvQyxDQUFDLEtBQUssb0JBQW9CLEtBQUssb0JBQW9CLEtBQ25ELEtBQUssb0JBQW9CLEtBQUssc0JBQXNCLE1BQU0sVUFDMUQsQ0FBQyxLQUFLLG9CQUFvQixLQUFLLHdCQUF3QixHQUN0RDtBQUNELGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxrQkFBa0IsTUFBTSxLQUFLLG1CQUFtQixhQUFhO0FBQ25FLFVBQU0sT0FBUSxZQUFvRSxRQUFRLGtCQUFrQjtBQUU1RyxRQUFJLFdBQVc7QUFDZixRQUFJLFdBQVc7QUFDZixRQUFJLFVBQVU7QUFDZCxRQUFJLFdBQVc7QUFFZixRQUFJO0FBQ0gsWUFBTSxnQkFBaUQsS0FBSyxPQUFPLE1BQU0sS0FBSyxhQUFhLFNBQVMsSUFBSSxLQUFLLEtBQUssb0JBQW9CLEtBQUssb0JBQW9CLENBQUMsQ0FBQyxHQUFHLE1BQU0sU0FBUyxDQUFDO0FBQ3BMLGlCQUFXLFNBQVMsY0FBYyxhQUFhO0FBQzlDLFlBQUksTUFBTSxRQUFRLGlCQUFpQjtBQUNsQztBQUFBLFFBQ0Q7QUFFQSxnQkFBUSxNQUFNLE1BQU07QUFBQTtBQUFBLFVBR25CLEtBQUs7QUFDSjtBQUNBO0FBQUEsVUFDRCxLQUFLO0FBQ0o7QUFDQTtBQUFBO0FBQUE7QUFBQSxVQUlELEtBQUs7QUFBQSxVQUNMLEtBQUs7QUFDSix3QkFBWSxNQUFNO0FBQ2xCO0FBQUEsUUFDRjtBQUVBLFlBQUksTUFBTSxTQUFTLGFBQWEsTUFBTSxTQUFTLFdBQVc7QUFDekQsY0FBSSxPQUFPLE1BQU0sTUFBTSxzQkFBc0IsWUFBWSxPQUFPLE1BQU0sS0FBSyx1QkFBdUIsVUFBVTtBQUMzRyx1QkFBWSxNQUFNLEtBQUsscUJBQXFCLE1BQU0sS0FBSztBQUFBLFVBQ3hEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFFQSxhQUFPLEVBQUUsVUFBVSxVQUFVLE1BQU0sU0FBUyxVQUFVLEtBQUssTUFBTSxXQUFXLEdBQUksRUFBRTtBQUFBLElBQ25GLFNBQVMsT0FBTztBQUNmLGNBQVEsTUFBTSxLQUFLO0FBQUEsSUFDcEI7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRVEsNEJBQTRCLEVBQUUsTUFBTSxTQUFTLFVBQVUsVUFBVSxTQUFTLEdBQTBCO0FBaUIzRyxTQUFLLGtCQUFrQixXQUE0RSx5QkFBeUI7QUFBQSxNQUMzSCxVQUFVO0FBQUEsTUFDVixhQUFhO0FBQUEsTUFDYjtBQUFBLE1BQ0E7QUFBQSxNQUNBLGFBQWE7QUFBQSxJQUNkLENBQUM7QUFBQSxFQUNGO0FBQUEsRUFFUSw0QkFBNEIsRUFBRSxNQUFNLFNBQVMsVUFBVSxVQUFVLFNBQVMsR0FBb0I7QUFDckcsVUFBTSxLQUFLLE9BQU87QUFDbEIsV0FBTyxTQUFTLEtBQUssTUFBTSxPQUFPLEVBQUUsQ0FBQyxhQUFhLEtBQUssTUFBTSxVQUFVLEVBQUUsQ0FBQyxnQkFBZ0IsUUFBUSxjQUFjLFFBQVEsY0FBYyxRQUFRO0FBQUEsRUFDL0k7QUFDRDtBQXJNYSx1QkFBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FiVTsiLAogICJuYW1lcyI6IFtdCn0K
