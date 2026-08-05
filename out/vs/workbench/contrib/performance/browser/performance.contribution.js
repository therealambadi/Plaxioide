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
import { localize2 } from "../../../../nls.js";
import { registerAction2, Action2 } from "../../../../platform/actions/common/actions.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { Extensions, registerWorkbenchContribution2, WorkbenchPhase } from "../../../common/contributions.js";
import { EditorExtensions } from "../../../common/editor.js";
import { PerfviewContrib, PerfviewInput } from "./perfviewEditor.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { InstantiationService, Trace } from "../../../../platform/instantiation/common/instantiationService.js";
import { EventProfiling } from "../../../../base/common/event.js";
import { InputLatencyContrib } from "./inputLatencyContrib.js";
import { IEnvironmentService } from "../../../../platform/environment/common/environment.js";
import { GCBasedDisposableTracker, setDisposableTracker } from "../../../../base/common/lifecycle.js";
registerWorkbenchContribution2(
  PerfviewContrib.ID,
  PerfviewContrib,
  { lazy: true }
);
Registry.as(EditorExtensions.EditorFactory).registerEditorSerializer(
  PerfviewInput.Id,
  class {
    canSerialize() {
      return true;
    }
    serialize() {
      return "";
    }
    deserialize(instantiationService) {
      return instantiationService.createInstance(PerfviewInput);
    }
  }
);
registerAction2(class extends Action2 {
  constructor() {
    super({
      id: "perfview.show",
      title: localize2("show.label", "Startup Performance"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const editorService = accessor.get(IEditorService);
    const contrib = PerfviewContrib.get();
    return editorService.openEditor(contrib.getEditorInput(), { pinned: true });
  }
});
registerAction2(class PrintServiceCycles extends Action2 {
  constructor() {
    super({
      id: "perf.insta.printAsyncCycles",
      title: localize2("cycles", "Print Service Cycles"),
      category: Categories.Developer,
      f1: true
    });
  }
  run(accessor) {
    const instaService = accessor.get(IInstantiationService);
    if (instaService instanceof InstantiationService) {
      const cycle = instaService._globalGraph?.findCycleSlow();
      if (cycle) {
        console.warn(`CYCLE`, cycle);
      } else {
        console.warn(`YEAH, no more cycles`);
      }
    }
  }
});
registerAction2(class PrintServiceTraces extends Action2 {
  constructor() {
    super({
      id: "perf.insta.printTraces",
      title: localize2("insta.trace", "Print Service Traces"),
      category: Categories.Developer,
      f1: true
    });
  }
  run() {
    if (Trace.all.size === 0) {
      console.log("Enable via `instantiationService.ts#_enableAllTracing`");
      return;
    }
    for (const item of Trace.all) {
      console.log(item);
    }
  }
});
registerAction2(class PrintEventProfiling extends Action2 {
  constructor() {
    super({
      id: "perf.event.profiling",
      title: localize2("emitter", "Print Emitter Profiles"),
      category: Categories.Developer,
      f1: true
    });
  }
  run() {
    if (EventProfiling.all.size === 0) {
      console.log("USE `EmitterOptions._profName` to enable profiling");
      return;
    }
    for (const item of EventProfiling.all) {
      console.log(`${item.name}: ${item.invocationCount} invocations COST ${item.elapsedOverall}ms, ${item.listenerCount} listeners, avg cost is ${item.durations.reduce((a, b) => a + b, 0) / item.durations.length}ms`);
    }
  }
});
Registry.as(Extensions.Workbench).registerWorkbenchContribution(
  InputLatencyContrib,
  LifecyclePhase.Eventually
);
let DisposableTracking = class {
  constructor(envService) {
    if (!envService.isBuilt && !envService.extensionTestsLocationURI) {
      setDisposableTracker(new GCBasedDisposableTracker());
    }
  }
};
DisposableTracking.Id = "perf.disposableTracking";
DisposableTracking = __decorateClass([
  __decorateParam(0, IEnvironmentService)
], DisposableTracking);
registerWorkbenchContribution2(DisposableTracking.Id, DisposableTracking, WorkbenchPhase.Eventually);
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wZXJmb3JtYW5jZS9icm93c2VyL3BlcmZvcm1hbmNlLmNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyByZWdpc3RlckFjdGlvbjIsIEFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSwgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgTGlmZWN5Y2xlUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9saWZlY3ljbGUvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBDYXRlZ29yaWVzIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb25Db21tb25DYXRlZ29yaWVzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIHJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMiwgV29ya2JlbmNoUGhhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zLCBJRWRpdG9yU2VyaWFsaXplciwgSUVkaXRvckZhY3RvcnlSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9lZGl0b3IuanMnO1xuaW1wb3J0IHsgUGVyZnZpZXdDb250cmliLCBQZXJmdmlld0lucHV0IH0gZnJvbSAnLi9wZXJmdmlld0VkaXRvci5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uU2VydmljZSwgVHJhY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uU2VydmljZS5qcyc7XG5pbXBvcnQgeyBFdmVudFByb2ZpbGluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElucHV0TGF0ZW5jeUNvbnRyaWIgfSBmcm9tICcuL2lucHV0TGF0ZW5jeUNvbnRyaWIuanMnO1xuaW1wb3J0IHsgSUVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudC5qcyc7XG5pbXBvcnQgeyBHQ0Jhc2VkRGlzcG9zYWJsZVRyYWNrZXIsIHNldERpc3Bvc2FibGVUcmFja2VyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuLy8gLS0gc3RhcnR1cCBwZXJmb3JtYW5jZSB2aWV3XG5cbnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uMihcblx0UGVyZnZpZXdDb250cmliLklELFxuXHRQZXJmdmlld0NvbnRyaWIsXG5cdHsgbGF6eTogdHJ1ZSB9XG4pO1xuXG5SZWdpc3RyeS5hczxJRWRpdG9yRmFjdG9yeVJlZ2lzdHJ5PihFZGl0b3JFeHRlbnNpb25zLkVkaXRvckZhY3RvcnkpLnJlZ2lzdGVyRWRpdG9yU2VyaWFsaXplcihcblx0UGVyZnZpZXdJbnB1dC5JZCxcblx0Y2xhc3MgaW1wbGVtZW50cyBJRWRpdG9yU2VyaWFsaXplciB7XG5cdFx0Y2FuU2VyaWFsaXplKCk6IGJvb2xlYW4ge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXHRcdHNlcmlhbGl6ZSgpOiBzdHJpbmcge1xuXHRcdFx0cmV0dXJuICcnO1xuXHRcdH1cblx0XHRkZXNlcmlhbGl6ZShpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlKTogUGVyZnZpZXdJbnB1dCB7XG5cdFx0XHRyZXR1cm4gaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoUGVyZnZpZXdJbnB1dCk7XG5cdFx0fVxuXHR9XG4pO1xuXG5cbnJlZ2lzdGVyQWN0aW9uMihjbGFzcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAncGVyZnZpZXcuc2hvdycsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdzaG93LmxhYmVsJywgJ1N0YXJ0dXAgUGVyZm9ybWFuY2UnKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkRldmVsb3Blcixcblx0XHRcdGYxOiB0cnVlXG5cdFx0fSk7XG5cdH1cblxuXHRydW4oYWNjZXNzb3I6IFNlcnZpY2VzQWNjZXNzb3IpIHtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBjb250cmliID0gUGVyZnZpZXdDb250cmliLmdldCgpO1xuXHRcdHJldHVybiBlZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoY29udHJpYi5nZXRFZGl0b3JJbnB1dCgpLCB7IHBpbm5lZDogdHJ1ZSB9KTtcblx0fVxufSk7XG5cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFByaW50U2VydmljZUN5Y2xlcyBleHRlbmRzIEFjdGlvbjIge1xuXG5cdGNvbnN0cnVjdG9yKCkge1xuXHRcdHN1cGVyKHtcblx0XHRcdGlkOiAncGVyZi5pbnN0YS5wcmludEFzeW5jQ3ljbGVzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2N5Y2xlcycsICdQcmludCBTZXJ2aWNlIEN5Y2xlcycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bihhY2Nlc3NvcjogU2VydmljZXNBY2Nlc3Nvcikge1xuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXHRcdGlmIChpbnN0YVNlcnZpY2UgaW5zdGFuY2VvZiBJbnN0YW50aWF0aW9uU2VydmljZSkge1xuXHRcdFx0Y29uc3QgY3ljbGUgPSBpbnN0YVNlcnZpY2UuX2dsb2JhbEdyYXBoPy5maW5kQ3ljbGVTbG93KCk7XG5cdFx0XHRpZiAoY3ljbGUpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBDWUNMRWAsIGN5Y2xlKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnNvbGUud2FybihgWUVBSCwgbm8gbW9yZSBjeWNsZXNgKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5yZWdpc3RlckFjdGlvbjIoY2xhc3MgUHJpbnRTZXJ2aWNlVHJhY2VzIGV4dGVuZHMgQWN0aW9uMiB7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6ICdwZXJmLmluc3RhLnByaW50VHJhY2VzJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2luc3RhLnRyYWNlJywgJ1ByaW50IFNlcnZpY2UgVHJhY2VzJyksXG5cdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRmMTogdHJ1ZVxuXHRcdH0pO1xuXHR9XG5cblx0cnVuKCkge1xuXHRcdGlmIChUcmFjZS5hbGwuc2l6ZSA9PT0gMCkge1xuXHRcdFx0Y29uc29sZS5sb2coJ0VuYWJsZSB2aWEgYGluc3RhbnRpYXRpb25TZXJ2aWNlLnRzI19lbmFibGVBbGxUcmFjaW5nYCcpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGZvciAoY29uc3QgaXRlbSBvZiBUcmFjZS5hbGwpIHtcblx0XHRcdGNvbnNvbGUubG9nKGl0ZW0pO1xuXHRcdH1cblx0fVxufSk7XG5cblxucmVnaXN0ZXJBY3Rpb24yKGNsYXNzIFByaW50RXZlbnRQcm9maWxpbmcgZXh0ZW5kcyBBY3Rpb24yIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ3BlcmYuZXZlbnQucHJvZmlsaW5nJyxcblx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ2VtaXR0ZXInLCAnUHJpbnQgRW1pdHRlciBQcm9maWxlcycpLFxuXHRcdFx0Y2F0ZWdvcnk6IENhdGVnb3JpZXMuRGV2ZWxvcGVyLFxuXHRcdFx0ZjE6IHRydWVcblx0XHR9KTtcblx0fVxuXG5cdHJ1bigpOiB2b2lkIHtcblx0XHRpZiAoRXZlbnRQcm9maWxpbmcuYWxsLnNpemUgPT09IDApIHtcblx0XHRcdGNvbnNvbGUubG9nKCdVU0UgYEVtaXR0ZXJPcHRpb25zLl9wcm9mTmFtZWAgdG8gZW5hYmxlIHByb2ZpbGluZycpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRmb3IgKGNvbnN0IGl0ZW0gb2YgRXZlbnRQcm9maWxpbmcuYWxsKSB7XG5cdFx0XHRjb25zb2xlLmxvZyhgJHtpdGVtLm5hbWV9OiAke2l0ZW0uaW52b2NhdGlvbkNvdW50fSBpbnZvY2F0aW9ucyBDT1NUICR7aXRlbS5lbGFwc2VkT3ZlcmFsbH1tcywgJHtpdGVtLmxpc3RlbmVyQ291bnR9IGxpc3RlbmVycywgYXZnIGNvc3QgaXMgJHtpdGVtLmR1cmF0aW9ucy5yZWR1Y2UoKGEsIGIpID0+IGEgKyBiLCAwKSAvIGl0ZW0uZHVyYXRpb25zLmxlbmd0aH1tc2ApO1xuXHRcdH1cblx0fVxufSk7XG5cbi8vIC0tIGlucHV0IGxhdGVuY3lcblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpLnJlZ2lzdGVyV29ya2JlbmNoQ29udHJpYnV0aW9uKFxuXHRJbnB1dExhdGVuY3lDb250cmliLFxuXHRMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5XG4pO1xuXG5cbi8vIC0tIHRyYWNrIGxlYWtpbmcgZGlzcG9zYWJsZXMsIHRob3NlIHRoYXQgZ2V0IEdDJ2VkIGJlZm9yZSBoYXZpbmcgYmVlbiBkaXNwb3NlZFxuXG5cbmNsYXNzIERpc3Bvc2FibGVUcmFja2luZyB7XG5cdHN0YXRpYyByZWFkb25seSBJZCA9ICdwZXJmLmRpc3Bvc2FibGVUcmFja2luZyc7XG5cdGNvbnN0cnVjdG9yKEBJRW52aXJvbm1lbnRTZXJ2aWNlIGVudlNlcnZpY2U6IElFbnZpcm9ubWVudFNlcnZpY2UpIHtcblx0XHRpZiAoIWVudlNlcnZpY2UuaXNCdWlsdCAmJiAhZW52U2VydmljZS5leHRlbnNpb25UZXN0c0xvY2F0aW9uVVJJKSB7XG5cdFx0XHRzZXREaXNwb3NhYmxlVHJhY2tlcihuZXcgR0NCYXNlZERpc3Bvc2FibGVUcmFja2VyKCkpO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIoRGlzcG9zYWJsZVRyYWNraW5nLklkLCBEaXNwb3NhYmxlVHJhY2tp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
