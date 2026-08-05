import assert from "assert";
import { CancellationToken, CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { Range } from "../../../../common/core/range.js";
import { SymbolKind } from "../../../../common/languages.js";
import { LanguageFeatureDebounceService } from "../../../../common/services/languageFeatureDebounce.js";
import { LanguageFeaturesService } from "../../../../common/services/languageFeaturesService.js";
import { IModelService } from "../../../../common/services/model.js";
import { createModelServices, createTextModel } from "../../../../test/common/testTextModel.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { MarkerSeverity } from "../../../../../platform/markers/common/markers.js";
import { OutlineElement, OutlineGroup, OutlineModel, OutlineModelService } from "../../browser/outlineModel.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("OutlineModel", function() {
  const disposables = new DisposableStore();
  const languageFeaturesService = new LanguageFeaturesService();
  teardown(function() {
    disposables.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("OutlineModel#create, cached", async function() {
    const insta = createModelServices(disposables);
    const modelService = insta.get(IModelService);
    const envService = new class extends mock() {
      constructor() {
        super(...arguments);
        this.isBuilt = true;
        this.isExtensionDevelopment = false;
      }
    }();
    const service = new OutlineModelService(languageFeaturesService, new LanguageFeatureDebounceService(new NullLogService(), envService), modelService);
    const model = createTextModel("foo", void 0, void 0, URI.file("/fome/path.foo"));
    let count = 0;
    const reg = languageFeaturesService.documentSymbolProvider.register({ pattern: "**/path.foo" }, {
      provideDocumentSymbols() {
        count += 1;
        return [];
      }
    });
    await service.getOrCreate(model, CancellationToken.None);
    assert.strictEqual(count, 1);
    await service.getOrCreate(model, CancellationToken.None);
    assert.strictEqual(count, 1);
    model.applyEdits([{ text: "XXX", range: new Range(1, 1, 1, 1) }]);
    await service.getOrCreate(model, CancellationToken.None);
    assert.strictEqual(count, 2);
    reg.dispose();
    model.dispose();
    service.dispose();
  });
  test("OutlineModel#create, cached/cancel", async function() {
    const insta = createModelServices(disposables);
    const modelService = insta.get(IModelService);
    const envService = new class extends mock() {
      constructor() {
        super(...arguments);
        this.isBuilt = true;
        this.isExtensionDevelopment = false;
      }
    }();
    const service = new OutlineModelService(languageFeaturesService, new LanguageFeatureDebounceService(new NullLogService(), envService), modelService);
    const model = createTextModel("foo", void 0, void 0, URI.file("/fome/path.foo"));
    let isCancelled = false;
    const reg = languageFeaturesService.documentSymbolProvider.register({ pattern: "**/path.foo" }, {
      provideDocumentSymbols(d, token) {
        return new Promise((resolve) => {
          const l = token.onCancellationRequested((_) => {
            isCancelled = true;
            resolve(null);
            l.dispose();
          });
        });
      }
    });
    assert.strictEqual(isCancelled, false);
    const s1 = new CancellationTokenSource();
    service.getOrCreate(model, s1.token);
    const s2 = new CancellationTokenSource();
    service.getOrCreate(model, s2.token);
    s1.cancel();
    assert.strictEqual(isCancelled, false);
    s2.cancel();
    assert.strictEqual(isCancelled, true);
    reg.dispose();
    model.dispose();
    service.dispose();
  });
  function fakeSymbolInformation(range, name = "foo") {
    return {
      name,
      detail: "fake",
      kind: SymbolKind.Boolean,
      tags: [],
      selectionRange: range,
      range
    };
  }
  function fakeMarker(range) {
    return { ...range, owner: "ffff", message: "test", severity: MarkerSeverity.Error, resource: null };
  }
  test("OutlineElement - updateMarker", function() {
    const e0 = new OutlineElement("foo1", null, fakeSymbolInformation(new Range(1, 1, 1, 10)));
    const e1 = new OutlineElement("foo2", null, fakeSymbolInformation(new Range(2, 1, 5, 1)));
    const e2 = new OutlineElement("foo3", null, fakeSymbolInformation(new Range(6, 1, 10, 10)));
    const group = new OutlineGroup("group", null, null, 1);
    group.children.set(e0.id, e0);
    group.children.set(e1.id, e1);
    group.children.set(e2.id, e2);
    const data = [fakeMarker(new Range(6, 1, 6, 7)), fakeMarker(new Range(1, 1, 1, 4)), fakeMarker(new Range(10, 2, 14, 1))];
    data.sort(Range.compareRangesUsingStarts);
    group.updateMarker(data);
    assert.strictEqual(data.length, 0);
    assert.strictEqual(e0.marker.count, 1);
    assert.strictEqual(e1.marker, void 0);
    assert.strictEqual(e2.marker.count, 2);
    group.updateMarker([]);
    assert.strictEqual(e0.marker, void 0);
    assert.strictEqual(e1.marker, void 0);
    assert.strictEqual(e2.marker, void 0);
  });
  test("OutlineElement - updateMarker, 2", function() {
    const p = new OutlineElement("A", null, fakeSymbolInformation(new Range(1, 1, 11, 1)));
    const c1 = new OutlineElement("A/B", null, fakeSymbolInformation(new Range(2, 4, 5, 4)));
    const c2 = new OutlineElement("A/C", null, fakeSymbolInformation(new Range(6, 4, 9, 4)));
    const group = new OutlineGroup("group", null, null, 1);
    group.children.set(p.id, p);
    p.children.set(c1.id, c1);
    p.children.set(c2.id, c2);
    let data = [
      fakeMarker(new Range(2, 4, 5, 4))
    ];
    group.updateMarker(data);
    assert.strictEqual(p.marker.count, 0);
    assert.strictEqual(c1.marker.count, 1);
    assert.strictEqual(c2.marker, void 0);
    data = [
      fakeMarker(new Range(2, 4, 5, 4)),
      fakeMarker(new Range(2, 6, 2, 8)),
      fakeMarker(new Range(7, 6, 7, 8))
    ];
    group.updateMarker(data);
    assert.strictEqual(p.marker.count, 0);
    assert.strictEqual(c1.marker.count, 2);
    assert.strictEqual(c2.marker.count, 1);
    data = [
      fakeMarker(new Range(1, 4, 1, 11)),
      fakeMarker(new Range(7, 6, 7, 8))
    ];
    group.updateMarker(data);
    assert.strictEqual(p.marker.count, 1);
    assert.strictEqual(c1.marker, void 0);
    assert.strictEqual(c2.marker.count, 1);
  });
  test("OutlineElement - updateMarker/multiple groups", function() {
    const model = new class extends OutlineModel {
      constructor() {
        super(null);
      }
      readyForTesting() {
        this._groups = this.children;
      }
    }();
    model.children.set("g1", new OutlineGroup("g1", model, null, 1));
    model.children.get("g1").children.set("c1", new OutlineElement("c1", model.children.get("g1"), fakeSymbolInformation(new Range(1, 1, 11, 1))));
    model.children.set("g2", new OutlineGroup("g2", model, null, 1));
    model.children.get("g2").children.set("c2", new OutlineElement("c2", model.children.get("g2"), fakeSymbolInformation(new Range(1, 1, 7, 1))));
    model.children.get("g2").children.get("c2").children.set("c2.1", new OutlineElement("c2.1", model.children.get("g2").children.get("c2"), fakeSymbolInformation(new Range(1, 3, 2, 19))));
    model.children.get("g2").children.get("c2").children.set("c2.2", new OutlineElement("c2.2", model.children.get("g2").children.get("c2"), fakeSymbolInformation(new Range(4, 1, 6, 10))));
    model.readyForTesting();
    const data = [
      fakeMarker(new Range(1, 1, 2, 8)),
      fakeMarker(new Range(6, 1, 6, 98))
    ];
    model.updateMarker(data);
    assert.strictEqual(model.children.get("g1").children.get("c1").marker.count, 2);
    assert.strictEqual(model.children.get("g2").children.get("c2").children.get("c2.1").marker.count, 1);
    assert.strictEqual(model.children.get("g2").children.get("c2").children.get("c2.2").marker.count, 1);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9kb2N1bWVudFN5bWJvbHMvdGVzdC9icm93c2VyL291dGxpbmVNb2RlbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBEb2N1bWVudFN5bWJvbCwgU3ltYm9sS2luZCB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgTGFuZ3VhZ2VGZWF0dXJlRGVib3VuY2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZURlYm91bmNlLmpzJztcbmltcG9ydCB7IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vc2VydmljZXMvbW9kZWwuanMnO1xuaW1wb3J0IHsgY3JlYXRlTW9kZWxTZXJ2aWNlcywgY3JlYXRlVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9jb21tb24vdGVzdFRleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBOdWxsTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElNYXJrZXIsIE1hcmtlclNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWFya2Vycy9jb21tb24vbWFya2Vycy5qcyc7XG5pbXBvcnQgeyBPdXRsaW5lRWxlbWVudCwgT3V0bGluZUdyb3VwLCBPdXRsaW5lTW9kZWwsIE91dGxpbmVNb2RlbFNlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL291dGxpbmVNb2RlbC5qcyc7XG5pbXBvcnQgeyBtb2NrIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi9tb2NrLmpzJztcbmltcG9ydCB7IElFbnZpcm9ubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdPdXRsaW5lTW9kZWwnLCBmdW5jdGlvbiAoKSB7XG5cblx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGNvbnN0IGxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlID0gbmV3IExhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlKCk7XG5cblx0dGVhcmRvd24oZnVuY3Rpb24gKCkge1xuXHRcdGRpc3Bvc2FibGVzLmNsZWFyKCk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ091dGxpbmVNb2RlbCNjcmVhdGUsIGNhY2hlZCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGluc3RhID0gY3JlYXRlTW9kZWxTZXJ2aWNlcyhkaXNwb3NhYmxlcyk7XG5cdFx0Y29uc3QgbW9kZWxTZXJ2aWNlID0gaW5zdGEuZ2V0KElNb2RlbFNlcnZpY2UpO1xuXHRcdGNvbnN0IGVudlNlcnZpY2UgPSBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFbnZpcm9ubWVudFNlcnZpY2U+KCkge1xuXHRcdFx0b3ZlcnJpZGUgaXNCdWlsdDogYm9vbGVhbiA9IHRydWU7XG5cdFx0XHRvdmVycmlkZSBpc0V4dGVuc2lvbkRldmVsb3BtZW50OiBib29sZWFuID0gZmFsc2U7XG5cdFx0fTtcblx0XHRjb25zdCBzZXJ2aWNlID0gbmV3IE91dGxpbmVNb2RlbFNlcnZpY2UobGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsIG5ldyBMYW5ndWFnZUZlYXR1cmVEZWJvdW5jZVNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCksIGVudlNlcnZpY2UpLCBtb2RlbFNlcnZpY2UpO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2ZvbycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkuZmlsZSgnL2ZvbWUvcGF0aC5mb28nKSk7XG5cdFx0bGV0IGNvdW50ID0gMDtcblx0XHRjb25zdCByZWcgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLnJlZ2lzdGVyKHsgcGF0dGVybjogJyoqL3BhdGguZm9vJyB9LCB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKCkge1xuXHRcdFx0XHRjb3VudCArPSAxO1xuXHRcdFx0XHRyZXR1cm4gW107XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmdldE9yQ3JlYXRlKG1vZGVsLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY291bnQsIDEpO1xuXG5cdFx0Ly8gY2FjaGVkXG5cdFx0YXdhaXQgc2VydmljZS5nZXRPckNyZWF0ZShtb2RlbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAxKTtcblxuXHRcdC8vIG5ldyB2ZXJzaW9uXG5cdFx0bW9kZWwuYXBwbHlFZGl0cyhbeyB0ZXh0OiAnWFhYJywgcmFuZ2U6IG5ldyBSYW5nZSgxLCAxLCAxLCAxKSB9XSk7XG5cdFx0YXdhaXQgc2VydmljZS5nZXRPckNyZWF0ZShtb2RlbCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvdW50LCAyKTtcblxuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdFx0bW9kZWwuZGlzcG9zZSgpO1xuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdPdXRsaW5lTW9kZWwjY3JlYXRlLCBjYWNoZWQvY2FuY2VsJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgaW5zdGEgPSBjcmVhdGVNb2RlbFNlcnZpY2VzKGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBtb2RlbFNlcnZpY2UgPSBpbnN0YS5nZXQoSU1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgZW52U2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUVudmlyb25tZW50U2VydmljZT4oKSB7XG5cdFx0XHRvdmVycmlkZSBpc0J1aWx0OiBib29sZWFuID0gdHJ1ZTtcblx0XHRcdG92ZXJyaWRlIGlzRXh0ZW5zaW9uRGV2ZWxvcG1lbnQ6IGJvb2xlYW4gPSBmYWxzZTtcblx0XHR9O1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBuZXcgT3V0bGluZU1vZGVsU2VydmljZShsYW5ndWFnZUZlYXR1cmVzU2VydmljZSwgbmV3IExhbmd1YWdlRmVhdHVyZURlYm91bmNlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSwgZW52U2VydmljZSksIG1vZGVsU2VydmljZSk7XG5cdFx0Y29uc3QgbW9kZWwgPSBjcmVhdGVUZXh0TW9kZWwoJ2ZvbycsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCBVUkkuZmlsZSgnL2ZvbWUvcGF0aC5mb28nKSk7XG5cdFx0bGV0IGlzQ2FuY2VsbGVkID0gZmFsc2U7XG5cblx0XHRjb25zdCByZWcgPSBsYW5ndWFnZUZlYXR1cmVzU2VydmljZS5kb2N1bWVudFN5bWJvbFByb3ZpZGVyLnJlZ2lzdGVyKHsgcGF0dGVybjogJyoqL3BhdGguZm9vJyB9LCB7XG5cdFx0XHRwcm92aWRlRG9jdW1lbnRTeW1ib2xzKGQsIHRva2VuKSB7XG5cdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRjb25zdCBsID0gdG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoXyA9PiB7XG5cdFx0XHRcdFx0XHRpc0NhbmNlbGxlZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRyZXNvbHZlKG51bGwpO1xuXHRcdFx0XHRcdFx0bC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzQ2FuY2VsbGVkLCBmYWxzZSk7XG5cdFx0Y29uc3QgczEgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRzZXJ2aWNlLmdldE9yQ3JlYXRlKG1vZGVsLCBzMS50b2tlbik7XG5cdFx0Y29uc3QgczIgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRzZXJ2aWNlLmdldE9yQ3JlYXRlKG1vZGVsLCBzMi50b2tlbik7XG5cblx0XHRzMS5jYW5jZWwoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNDYW5jZWxsZWQsIGZhbHNlKTtcblxuXHRcdHMyLmNhbmNlbCgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0NhbmNlbGxlZCwgdHJ1ZSk7XG5cblx0XHRyZWcuZGlzcG9zZSgpO1xuXHRcdG1vZGVsLmRpc3Bvc2UoKTtcblx0XHRzZXJ2aWNlLmRpc3Bvc2UoKTtcblxuXHR9KTtcblxuXHRmdW5jdGlvbiBmYWtlU3ltYm9sSW5mb3JtYXRpb24ocmFuZ2U6IFJhbmdlLCBuYW1lOiBzdHJpbmcgPSAnZm9vJyk6IERvY3VtZW50U3ltYm9sIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0bmFtZSxcblx0XHRcdGRldGFpbDogJ2Zha2UnLFxuXHRcdFx0a2luZDogU3ltYm9sS2luZC5Cb29sZWFuLFxuXHRcdFx0dGFnczogW10sXG5cdFx0XHRzZWxlY3Rpb25SYW5nZTogcmFuZ2UsXG5cdFx0XHRyYW5nZTogcmFuZ2Vcblx0XHR9O1xuXHR9XG5cblx0ZnVuY3Rpb24gZmFrZU1hcmtlcihyYW5nZTogUmFuZ2UpOiBJTWFya2VyIHtcblx0XHRyZXR1cm4geyAuLi5yYW5nZSwgb3duZXI6ICdmZmZmJywgbWVzc2FnZTogJ3Rlc3QnLCBzZXZlcml0eTogTWFya2VyU2V2ZXJpdHkuRXJyb3IsIHJlc291cmNlOiBudWxsISB9O1xuXHR9XG5cblx0dGVzdCgnT3V0bGluZUVsZW1lbnQgLSB1cGRhdGVNYXJrZXInLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBlMCA9IG5ldyBPdXRsaW5lRWxlbWVudCgnZm9vMScsIG51bGwhLCBmYWtlU3ltYm9sSW5mb3JtYXRpb24obmV3IFJhbmdlKDEsIDEsIDEsIDEwKSkpO1xuXHRcdGNvbnN0IGUxID0gbmV3IE91dGxpbmVFbGVtZW50KCdmb28yJywgbnVsbCEsIGZha2VTeW1ib2xJbmZvcm1hdGlvbihuZXcgUmFuZ2UoMiwgMSwgNSwgMSkpKTtcblx0XHRjb25zdCBlMiA9IG5ldyBPdXRsaW5lRWxlbWVudCgnZm9vMycsIG51bGwhLCBmYWtlU3ltYm9sSW5mb3JtYXRpb24obmV3IFJhbmdlKDYsIDEsIDEwLCAxMCkpKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gbmV3IE91dGxpbmVHcm91cCgnZ3JvdXAnLCBudWxsISwgbnVsbCEsIDEpO1xuXHRcdGdyb3VwLmNoaWxkcmVuLnNldChlMC5pZCwgZTApO1xuXHRcdGdyb3VwLmNoaWxkcmVuLnNldChlMS5pZCwgZTEpO1xuXHRcdGdyb3VwLmNoaWxkcmVuLnNldChlMi5pZCwgZTIpO1xuXG5cdFx0Y29uc3QgZGF0YSA9IFtmYWtlTWFya2VyKG5ldyBSYW5nZSg2LCAxLCA2LCA3KSksIGZha2VNYXJrZXIobmV3IFJhbmdlKDEsIDEsIDEsIDQpKSwgZmFrZU1hcmtlcihuZXcgUmFuZ2UoMTAsIDIsIDE0LCAxKSldO1xuXHRcdGRhdGEuc29ydChSYW5nZS5jb21wYXJlUmFuZ2VzVXNpbmdTdGFydHMpOyAvLyBtb2RlbCBkb2VzIHRoaXNcblxuXHRcdGdyb3VwLnVwZGF0ZU1hcmtlcihkYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YS5sZW5ndGgsIDApOyAvLyBhbGwgJ3N0b2xlbidcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZTAubWFya2VyIS5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUxLm1hcmtlciwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZTIubWFya2VyIS5jb3VudCwgMik7XG5cblx0XHRncm91cC51cGRhdGVNYXJrZXIoW10pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChlMC5tYXJrZXIsIHVuZGVmaW5lZCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUxLm1hcmtlciwgdW5kZWZpbmVkKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZTIubWFya2VyLCB1bmRlZmluZWQpO1xuXHR9KTtcblxuXHR0ZXN0KCdPdXRsaW5lRWxlbWVudCAtIHVwZGF0ZU1hcmtlciwgMicsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHAgPSBuZXcgT3V0bGluZUVsZW1lbnQoJ0EnLCBudWxsISwgZmFrZVN5bWJvbEluZm9ybWF0aW9uKG5ldyBSYW5nZSgxLCAxLCAxMSwgMSkpKTtcblx0XHRjb25zdCBjMSA9IG5ldyBPdXRsaW5lRWxlbWVudCgnQS9CJywgbnVsbCEsIGZha2VTeW1ib2xJbmZvcm1hdGlvbihuZXcgUmFuZ2UoMiwgNCwgNSwgNCkpKTtcblx0XHRjb25zdCBjMiA9IG5ldyBPdXRsaW5lRWxlbWVudCgnQS9DJywgbnVsbCEsIGZha2VTeW1ib2xJbmZvcm1hdGlvbihuZXcgUmFuZ2UoNiwgNCwgOSwgNCkpKTtcblxuXHRcdGNvbnN0IGdyb3VwID0gbmV3IE91dGxpbmVHcm91cCgnZ3JvdXAnLCBudWxsISwgbnVsbCEsIDEpO1xuXHRcdGdyb3VwLmNoaWxkcmVuLnNldChwLmlkLCBwKTtcblx0XHRwLmNoaWxkcmVuLnNldChjMS5pZCwgYzEpO1xuXHRcdHAuY2hpbGRyZW4uc2V0KGMyLmlkLCBjMik7XG5cblx0XHRsZXQgZGF0YSA9IFtcblx0XHRcdGZha2VNYXJrZXIobmV3IFJhbmdlKDIsIDQsIDUsIDQpKVxuXHRcdF07XG5cblx0XHRncm91cC51cGRhdGVNYXJrZXIoZGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHAubWFya2VyIS5jb3VudCwgMCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGMxLm1hcmtlciEuY291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjMi5tYXJrZXIsIHVuZGVmaW5lZCk7XG5cblx0XHRkYXRhID0gW1xuXHRcdFx0ZmFrZU1hcmtlcihuZXcgUmFuZ2UoMiwgNCwgNSwgNCkpLFxuXHRcdFx0ZmFrZU1hcmtlcihuZXcgUmFuZ2UoMiwgNiwgMiwgOCkpLFxuXHRcdFx0ZmFrZU1hcmtlcihuZXcgUmFuZ2UoNywgNiwgNywgOCkpLFxuXHRcdF07XG5cdFx0Z3JvdXAudXBkYXRlTWFya2VyKGRhdGEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwLm1hcmtlciEuY291bnQsIDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjMS5tYXJrZXIhLmNvdW50LCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYzIubWFya2VyIS5jb3VudCwgMSk7XG5cblx0XHRkYXRhID0gW1xuXHRcdFx0ZmFrZU1hcmtlcihuZXcgUmFuZ2UoMSwgNCwgMSwgMTEpKSxcblx0XHRcdGZha2VNYXJrZXIobmV3IFJhbmdlKDcsIDYsIDcsIDgpKSxcblx0XHRdO1xuXHRcdGdyb3VwLnVwZGF0ZU1hcmtlcihkYXRhKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocC5tYXJrZXIhLmNvdW50LCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYzEubWFya2VyLCB1bmRlZmluZWQpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjMi5tYXJrZXIhLmNvdW50LCAxKTtcblx0fSk7XG5cblx0dGVzdCgnT3V0bGluZUVsZW1lbnQgLSB1cGRhdGVNYXJrZXIvbXVsdGlwbGUgZ3JvdXBzJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBuZXcgY2xhc3MgZXh0ZW5kcyBPdXRsaW5lTW9kZWwge1xuXHRcdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRcdHN1cGVyKG51bGwhKTtcblx0XHRcdH1cblx0XHRcdHJlYWR5Rm9yVGVzdGluZygpIHtcblx0XHRcdFx0dGhpcy5fZ3JvdXBzID0gdGhpcy5jaGlsZHJlbiBhcyBhbnk7XG5cdFx0XHR9XG5cdFx0fTtcblx0XHRtb2RlbC5jaGlsZHJlbi5zZXQoJ2cxJywgbmV3IE91dGxpbmVHcm91cCgnZzEnLCBtb2RlbCwgbnVsbCEsIDEpKTtcblx0XHRtb2RlbC5jaGlsZHJlbi5nZXQoJ2cxJykhLmNoaWxkcmVuLnNldCgnYzEnLCBuZXcgT3V0bGluZUVsZW1lbnQoJ2MxJywgbW9kZWwuY2hpbGRyZW4uZ2V0KCdnMScpISwgZmFrZVN5bWJvbEluZm9ybWF0aW9uKG5ldyBSYW5nZSgxLCAxLCAxMSwgMSkpKSk7XG5cblx0XHRtb2RlbC5jaGlsZHJlbi5zZXQoJ2cyJywgbmV3IE91dGxpbmVHcm91cCgnZzInLCBtb2RlbCwgbnVsbCEsIDEpKTtcblx0XHRtb2RlbC5jaGlsZHJlbi5nZXQoJ2cyJykhLmNoaWxkcmVuLnNldCgnYzInLCBuZXcgT3V0bGluZUVsZW1lbnQoJ2MyJywgbW9kZWwuY2hpbGRyZW4uZ2V0KCdnMicpISwgZmFrZVN5bWJvbEluZm9ybWF0aW9uKG5ldyBSYW5nZSgxLCAxLCA3LCAxKSkpKTtcblx0XHRtb2RlbC5jaGlsZHJlbi5nZXQoJ2cyJykhLmNoaWxkcmVuLmdldCgnYzInKSEuY2hpbGRyZW4uc2V0KCdjMi4xJywgbmV3IE91dGxpbmVFbGVtZW50KCdjMi4xJywgbW9kZWwuY2hpbGRyZW4uZ2V0KCdnMicpIS5jaGlsZHJlbi5nZXQoJ2MyJykhLCBmYWtlU3ltYm9sSW5mb3JtYXRpb24obmV3IFJhbmdlKDEsIDMsIDIsIDE5KSkpKTtcblx0XHRtb2RlbC5jaGlsZHJlbi5nZXQoJ2cyJykhLmNoaWxkcmVuLmdldCgnYzInKSEuY2hpbGRyZW4uc2V0KCdjMi4yJywgbmV3IE91dGxpbmVFbGVtZW50KCdjMi4yJywgbW9kZWwuY2hpbGRyZW4uZ2V0KCdnMicpIS5jaGlsZHJlbi5nZXQoJ2MyJykhLCBmYWtlU3ltYm9sSW5mb3JtYXRpb24obmV3IFJhbmdlKDQsIDEsIDYsIDEwKSkpKTtcblxuXHRcdG1vZGVsLnJlYWR5Rm9yVGVzdGluZygpO1xuXG5cdFx0Y29uc3QgZGF0YSA9IFtcblx0XHRcdGZha2VNYXJrZXIobmV3IFJhbmdlKDEsIDEsIDIsIDgpKSxcblx0XHRcdGZha2VNYXJrZXIobmV3IFJhbmdlKDYsIDEsIDYsIDk4KSksXG5cdFx0XTtcblxuXHRcdG1vZGVsLnVwZGF0ZU1hcmtlcihkYXRhKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChtb2RlbC5jaGlsZHJlbi5nZXQoJ2cxJykhLmNoaWxkcmVuLmdldCgnYzEnKSEubWFya2VyIS5jb3VudCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmNoaWxkcmVuLmdldCgnZzInKSEuY2hpbGRyZW4uZ2V0KCdjMicpIS5jaGlsZHJlbi5nZXQoJ2MyLjEnKSEubWFya2VyIS5jb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG1vZGVsLmNoaWxkcmVuLmdldCgnZzInKSEuY2hpbGRyZW4uZ2V0KCdjMicpIS5jaGlsZHJlbi5nZXQoJ2MyLjInKSEubWFya2VyIS5jb3VudCwgMSk7XG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsYUFBYTtBQUN0QixTQUF5QixrQkFBa0I7QUFDM0MsU0FBUyxzQ0FBc0M7QUFDL0MsU0FBUywrQkFBK0I7QUFDeEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxxQkFBcUIsdUJBQXVCO0FBQ3JELFNBQVMsc0JBQXNCO0FBQy9CLFNBQWtCLHNCQUFzQjtBQUN4QyxTQUFTLGdCQUFnQixjQUFjLGNBQWMsMkJBQTJCO0FBQ2hGLFNBQVMsWUFBWTtBQUVyQixTQUFTLCtDQUErQztBQUV4RCxNQUFNLGdCQUFnQixXQUFZO0FBRWpDLFFBQU0sY0FBYyxJQUFJLGdCQUFnQjtBQUN4QyxRQUFNLDBCQUEwQixJQUFJLHdCQUF3QjtBQUU1RCxXQUFTLFdBQVk7QUFDcEIsZ0JBQVksTUFBTTtBQUFBLEVBQ25CLENBQUM7QUFFRCwwQ0FBd0M7QUFFeEMsT0FBSywrQkFBK0IsaUJBQWtCO0FBRXJELFVBQU0sUUFBUSxvQkFBb0IsV0FBVztBQUM3QyxVQUFNLGVBQWUsTUFBTSxJQUFJLGFB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
