import assert from "assert";
import { DeferredPromise } from "../../../../../base/common/async.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mockObject } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { DebugModel, ExceptionBreakpoint, FunctionBreakpoint } from "../../common/debugModel.js";
import { MockDebugStorage } from "./mockDebug.js";
import { TestStorageService } from "../../../../test/common/workbenchTestServices.js";
suite("DebugModel", () => {
  ensureNoDisposablesAreLeakedInTestSuite();
  suite("FunctionBreakpoint", () => {
    test("Id is saved", () => {
      const fbp = new FunctionBreakpoint({ name: "function", enabled: true, hitCondition: "hit condition", condition: "condition", logMessage: "log message" });
      const strigified = JSON.stringify(fbp);
      const parsed = JSON.parse(strigified);
      assert.equal(parsed.id, fbp.getId());
    });
  });
  suite("ExceptionBreakpoint", () => {
    test("Restored matches new", () => {
      const ebp = new ExceptionBreakpoint({
        conditionDescription: "condition description",
        description: "description",
        filter: "condition",
        label: "label",
        supportsCondition: true,
        enabled: true
      }, "id");
      const strigified = JSON.stringify(ebp);
      const parsed = JSON.parse(strigified);
      const newEbp = new ExceptionBreakpoint(parsed);
      assert.ok(ebp.matches(newEbp));
    });
  });
  suite("DebugModel", () => {
    test("refreshTopOfCallstack resolves all returned promises when called multiple times", async () => {
      const topFrameDeferred = new DeferredPromise();
      const wholeStackDeferred = new DeferredPromise();
      const fakeThread = mockObject()({
        session: { capabilities: { supportsDelayedStackTraceLoading: true } },
        getCallStack: () => [],
        getStaleCallStack: () => []
      });
      fakeThread.fetchCallStack.callsFake((levels) => {
        return levels === 1 ? topFrameDeferred.p : wholeStackDeferred.p;
      });
      fakeThread.getId.returns(1);
      const disposable = new DisposableStore();
      const storage = disposable.add(new TestStorageService());
      const model = new DebugModel(disposable.add(new MockDebugStorage(storage)), { isDirty: (e) => false }, void 0, new NullLogService());
      disposable.add(model);
      let top1Resolved = false;
      let whole1Resolved = false;
      let top2Resolved = false;
      let whole2Resolved = false;
      const result1 = model.refreshTopOfCallstack(fakeThread);
      result1.topCallStack.then(() => top1Resolved = true);
      result1.wholeCallStack.then(() => whole1Resolved = true);
      const result2 = model.refreshTopOfCallstack(fakeThread);
      result2.topCallStack.then(() => top2Resolved = true);
      result2.wholeCallStack.then(() => whole2Resolved = true);
      assert.ok(!top1Resolved);
      assert.ok(!whole1Resolved);
      assert.ok(!top2Resolved);
      assert.ok(!whole2Resolved);
      await topFrameDeferred.complete();
      await result1.topCallStack;
      await result2.topCallStack;
      assert.ok(!whole1Resolved);
      assert.ok(!whole2Resolved);
      await wholeStackDeferred.complete();
      await result1.wholeCallStack;
      await result2.wholeCallStack;
      disposable.dispose();
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy90ZXN0L2NvbW1vbi9kZWJ1Z01vZGVsLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbW9ja09iamVjdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgRGVidWdNb2RlbCwgRXhjZXB0aW9uQnJlYWtwb2ludCwgRnVuY3Rpb25CcmVha3BvaW50LCBUaHJlYWQgfSBmcm9tICcuLi8uLi9jb21tb24vZGVidWdNb2RlbC5qcyc7XG5pbXBvcnQgeyBNb2NrRGVidWdTdG9yYWdlIH0gZnJvbSAnLi9tb2NrRGVidWcuanMnO1xuaW1wb3J0IHsgVGVzdFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcblxuc3VpdGUoJ0RlYnVnTW9kZWwnLCAoKSA9PiB7XG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdGdW5jdGlvbkJyZWFrcG9pbnQnLCAoKSA9PiB7XG5cdFx0dGVzdCgnSWQgaXMgc2F2ZWQnLCAoKSA9PiB7XG5cdFx0XHRjb25zdCBmYnAgPSBuZXcgRnVuY3Rpb25CcmVha3BvaW50KHsgbmFtZTogJ2Z1bmN0aW9uJywgZW5hYmxlZDogdHJ1ZSwgaGl0Q29uZGl0aW9uOiAnaGl0IGNvbmRpdGlvbicsIGNvbmRpdGlvbjogJ2NvbmRpdGlvbicsIGxvZ01lc3NhZ2U6ICdsb2cgbWVzc2FnZScgfSk7XG5cdFx0XHRjb25zdCBzdHJpZ2lmaWVkID0gSlNPTi5zdHJpbmdpZnkoZmJwKTtcblx0XHRcdGNvbnN0IHBhcnNlZCA9IEpTT04ucGFyc2Uoc3RyaWdpZmllZCk7XG5cdFx0XHRhc3NlcnQuZXF1YWwocGFyc2VkLmlkLCBmYnAuZ2V0SWQoKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdFeGNlcHRpb25CcmVha3BvaW50JywgKCkgPT4ge1xuXHRcdHRlc3QoJ1Jlc3RvcmVkIG1hdGNoZXMgbmV3JywgKCkgPT4ge1xuXHRcdFx0Y29uc3QgZWJwID0gbmV3IEV4Y2VwdGlvbkJyZWFrcG9pbnQoe1xuXHRcdFx0XHRjb25kaXRpb25EZXNjcmlwdGlvbjogJ2NvbmRpdGlvbiBkZXNjcmlwdGlvbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiAnZGVzY3JpcHRpb24nLFxuXHRcdFx0XHRmaWx0ZXI6ICdjb25kaXRpb24nLFxuXHRcdFx0XHRsYWJlbDogJ2xhYmVsJyxcblx0XHRcdFx0c3VwcG9ydHNDb25kaXRpb246IHRydWUsXG5cdFx0XHRcdGVuYWJsZWQ6IHRydWUsXG5cdFx0XHR9LCAnaWQnKTtcblx0XHRcdGNvbnN0IHN0cmlnaWZpZWQgPSBKU09OLnN0cmluZ2lmeShlYnApO1xuXHRcdFx0Y29uc3QgcGFyc2VkID0gSlNPTi5wYXJzZShzdHJpZ2lmaWVkKTtcblx0XHRcdGNvbnN0IG5ld0VicCA9IG5ldyBFeGNlcHRpb25CcmVha3BvaW50KHBhcnNlZCk7XG5cdFx0XHRhc3NlcnQub2soZWJwLm1hdGNoZXMobmV3RWJwKSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdEZWJ1Z01vZGVsJywgKCkgPT4ge1xuXHRcdHRlc3QoJ3JlZnJlc2hUb3BPZkNhbGxzdGFjayByZXNvbHZlcyBhbGwgcmV0dXJuZWQgcHJvbWlzZXMgd2hlbiBjYWxsZWQgbXVsdGlwbGUgdGltZXMnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCB0b3BGcmFtZURlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0Y29uc3Qgd2hvbGVTdGFja0RlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHRcdFx0Y29uc3QgZmFrZVRocmVhZCA9IG1vY2tPYmplY3Q8VGhyZWFkPigpKHtcblx0XHRcdFx0c2Vzc2lvbjogeyBjYXBhYmlsaXRpZXM6IHsgc3VwcG9ydHNEZWxheWVkU3RhY2tUcmFjZUxvYWRpbmc6IHRydWUgfSB9IGFzIGFueSxcblx0XHRcdFx0Z2V0Q2FsbFN0YWNrOiAoKSA9PiBbXSxcblx0XHRcdFx0Z2V0U3RhbGVDYWxsU3RhY2s6ICgpID0+IFtdLFxuXHRcdFx0fSk7XG5cdFx0XHRmYWtlVGhyZWFkLmZldGNoQ2FsbFN0YWNrLmNhbGxzRmFrZSgobGV2ZWxzOiBudW1iZXIpID0+IHtcblx0XHRcdFx0cmV0dXJuIGxldmVscyA9PT0gMSA/IHRvcEZyYW1lRGVmZXJyZWQucCA6IHdob2xlU3RhY2tEZWZlcnJlZC5wO1xuXHRcdFx0fSk7XG5cdFx0XHRmYWtlVGhyZWFkLmdldElkLnJldHVybnMoMSk7XG5cblx0XHRcdGNvbnN0IGRpc3Bvc2FibGUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0XHRjb25zdCBzdG9yYWdlID0gZGlzcG9zYWJsZS5hZGQobmV3IFRlc3RTdG9yYWdlU2VydmljZSgpKTtcblx0XHRcdGNvbnN0IG1vZGVsID0gbmV3IERlYnVnTW9kZWwoZGlzcG9zYWJsZS5hZGQobmV3IE1vY2tEZWJ1Z1N0b3JhZ2Uoc3RvcmFnZSkpLCA8YW55PnsgaXNEaXJ0eTogKGU6IGFueSkgPT4gZmFsc2UgfSwgdW5kZWZpbmVkISwgbmV3IE51bGxMb2dTZXJ2aWNlKCkpO1xuXHRcdFx0ZGlzcG9zYWJsZS5hZGQobW9kZWwpO1xuXG5cdFx0XHRsZXQgdG9wMVJlc29sdmVkID0gZmFsc2U7XG5cdFx0XHRsZXQgd2hvbGUxUmVzb2x2ZWQgPSBmYWxzZTtcblx0XHRcdGxldCB0b3AyUmVzb2x2ZWQgPSBmYWxzZTtcblx0XHRcdGxldCB3aG9sZTJSZXNvbHZlZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgcmVzdWx0MSA9IG1vZGVsLnJlZnJlc2hUb3BPZkNhbGxzdGFjayhmYWtlVGhyZWFkIGFzIGFueSk7XG5cdFx0XHRyZXN1bHQxLnRvcENhbGxTdGFjay50aGVuKCgpID0+IHRvcDFSZXNvbHZlZCA9IHRydWUpO1xuXHRcdFx0cmVzdWx0MS53aG9sZUNhbGxTdGFjay50aGVuKCgpID0+IHdob2xlMVJlc29sdmVkID0gdHJ1ZSk7XG5cblx0XHRcdGNvbnN0IHJlc3VsdDIgPSBtb2RlbC5yZWZyZXNoVG9wT2ZDYWxsc3RhY2soZmFrZVRocmVhZCBhcyBhbnkpO1xuXHRcdFx0cmVzdWx0Mi50b3BDYWxsU3RhY2sudGhlbigoKSA9PiB0b3AyUmVzb2x2ZWQgPSB0cnVlKTtcblx0XHRcdHJlc3VsdDIud2hvbGVDYWxsU3RhY2sudGhlbigoKSA9PiB3aG9sZTJSZXNvbHZlZCA9IHRydWUpO1xuXG5cdFx0XHRhc3NlcnQub2soIXRvcDFSZXNvbHZlZCk7XG5cdFx0XHRhc3NlcnQub2soIXdob2xlMVJlc29sdmVkKTtcblx0XHRcdGFzc2VydC5vayghdG9wMlJlc29sdmVkKTtcblx0XHRcdGFzc2VydC5vayghd2hvbGUyUmVzb2x2ZWQpO1xuXG5cdFx0XHRhd2FpdCB0b3BGcmFtZURlZmVycmVkLmNvbXBsZXRlKCk7XG5cdFx0XHRhd2FpdCByZXN1bHQxLnRvcENhbGxTdGFjaztcblx0XHRcdGF3YWl0IHJlc3VsdDIudG9wQ2FsbFN0YWNrO1xuXHRcdFx0YXNzZXJ0Lm9rKCF3aG9sZTFSZXNvbHZlZCk7XG5cdFx0XHRhc3NlcnQub2soIXdob2xlMlJlc29sdmVkKTtcblxuXHRcdFx0YXdhaXQgd2hvbGVTdGFja0RlZmVycmVkLmNvbXBsZXRlKCk7XG5cdFx0XHRhd2FpdCByZXN1bHQxLndob2xlQ2FsbFN0YWNrO1xuXHRcdFx0YXdhaXQgcmVzdWx0Mi53aG9sZUNhbGxTdGFjaztcblxuXHRcdFx0ZGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cdFx0fSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxZQUFZLHFCQUFxQiwwQkFBa0M7QUFDNUUsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFFbkMsTUFBTSxjQUFjLE1BQU07QUFDekIsMENBQXdDO0FBRXhDLFFBQU0sc0JBQXNCLE1BQU07QUFDakMsU0FBSyxlQUFlLE1BQU07QUFDekIsWUFBTSxNQUFNLElBQUksbUJBQW1CLEVB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
