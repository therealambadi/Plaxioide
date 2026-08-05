import assert from "assert";
import { DecorationsService } from "../../browser/decorationsService.js";
import { URI } from "../../../../../base/common/uri.js";
import { Event, Emitter } from "../../../../../base/common/event.js";
import * as resources from "../../../../../base/common/resources.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { TestThemeService } from "../../../../../platform/theme/test/common/testThemeService.js";
import { runWithFakedTimers } from "../../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
suite("DecorationsService", function() {
  let service;
  setup(function() {
    service = new DecorationsService(
      new class extends mock() {
        constructor() {
          super(...arguments);
          this.extUri = resources.extUri;
        }
      }(),
      new TestThemeService()
    );
  });
  teardown(function() {
    service.dispose();
  });
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("Async provider, async/evented result", function() {
    return runWithFakedTimers({}, async function() {
      const uri = URI.parse("foo:bar");
      let callCounter = 0;
      const reg = service.registerDecorationsProvider(new class {
        constructor() {
          this.label = "Test";
          this.onDidChange = Event.None;
        }
        provideDecorations(uri2) {
          callCounter += 1;
          return new Promise((resolve) => {
            setTimeout(() => resolve({
              color: "someBlue",
              tooltip: "T",
              strikethrough: true
            }));
          });
        }
      }());
      assert.strictEqual(service.getDecoration(uri, false), void 0);
      assert.strictEqual(callCounter, 1);
      const e = await Event.toPromise(service.onDidChangeDecorations);
      assert.strictEqual(e.affectsResource(uri), true);
      assert.deepStrictEqual(service.getDecoration(uri, false).tooltip, "T");
      assert.deepStrictEqual(service.getDecoration(uri, false).strikethrough, true);
      assert.strictEqual(callCounter, 1);
      reg.dispose();
    });
  });
  test("Sync provider, sync result", function() {
    const uri = URI.parse("foo:bar");
    let callCounter = 0;
    const reg = service.registerDecorationsProvider(new class {
      constructor() {
        this.label = "Test";
        this.onDidChange = Event.None;
      }
      provideDecorations(uri2) {
        callCounter += 1;
        return { color: "someBlue", tooltip: "Z" };
      }
    }());
    assert.deepStrictEqual(service.getDecoration(uri, false).tooltip, "Z");
    assert.deepStrictEqual(service.getDecoration(uri, false).strikethrough, false);
    assert.strictEqual(callCounter, 1);
    reg.dispose();
  });
  test("Clear decorations on provider dispose", async function() {
    return runWithFakedTimers({}, async function() {
      const uri = URI.parse("foo:bar");
      let callCounter = 0;
      const reg = service.registerDecorationsProvider(new class {
        constructor() {
          this.label = "Test";
          this.onDidChange = Event.None;
        }
        provideDecorations(uri2) {
          callCounter += 1;
          return { color: "someBlue", tooltip: "J" };
        }
      }());
      assert.deepStrictEqual(service.getDecoration(uri, false).tooltip, "J");
      assert.strictEqual(callCounter, 1);
      let didSeeEvent = false;
      const p = new Promise((resolve) => {
        const l = service.onDidChangeDecorations((e) => {
          assert.strictEqual(e.affectsResource(uri), true);
          assert.deepStrictEqual(service.getDecoration(uri, false), void 0);
          assert.strictEqual(callCounter, 1);
          didSeeEvent = true;
          l.dispose();
          resolve();
        });
      });
      reg.dispose();
      await p;
      assert.strictEqual(didSeeEvent, true);
    });
  });
  test("No default bubbling", function() {
    let reg = service.registerDecorationsProvider({
      label: "Test",
      onDidChange: Event.None,
      provideDecorations(uri) {
        return uri.path.match(/\.txt/) ? { tooltip: ".txt", weight: 17 } : void 0;
      }
    });
    const childUri = URI.parse("file:///some/path/some/file.txt");
    let deco = service.getDecoration(childUri, false);
    assert.strictEqual(deco.tooltip, ".txt");
    deco = service.getDecoration(childUri.with({ path: "some/path/" }), true);
    assert.strictEqual(deco, void 0);
    reg.dispose();
    reg = service.registerDecorationsProvider({
      label: "Test",
      onDidChange: Event.None,
      provideDecorations(uri) {
        return uri.path.match(/\.txt/) ? { tooltip: ".txt.bubble", weight: 71, bubble: true } : void 0;
      }
    });
    deco = service.getDecoration(childUri, false);
    assert.strictEqual(deco.tooltip, ".txt.bubble");
    deco = service.getDecoration(childUri.with({ path: "some/path/" }), true);
    assert.strictEqual(typeof deco.tooltip, "string");
    reg.dispose();
  });
  test("Decorations not showing up for second root folder #48502", async function() {
    let cancelCount = 0;
    let callCount = 0;
    const provider = new class {
      constructor() {
        this._onDidChange = new Emitter();
        this.onDidChange = this._onDidChange.event;
        this.label = "foo";
      }
      provideDecorations(uri2, token) {
        store.add(token.onCancellationRequested(() => {
          cancelCount += 1;
        }));
        return new Promise((resolve) => {
          callCount += 1;
          setTimeout(() => {
            resolve({ letter: "foo" });
          }, 10);
        });
      }
    }();
    const reg = service.registerDecorationsProvider(provider);
    const uri = URI.parse("foo://bar");
    const d1 = service.getDecoration(uri, false);
    provider._onDidChange.fire([uri]);
    const d2 = service.getDecoration(uri, false);
    assert.strictEqual(cancelCount, 1);
    assert.strictEqual(callCount, 2);
    d1?.dispose();
    d2?.dispose();
    reg.dispose();
  });
  test("Decorations not bubbling... #48745", function() {
    const reg = service.registerDecorationsProvider({
      label: "Test",
      onDidChange: Event.None,
      provideDecorations(uri) {
        if (uri.path.match(/hello$/)) {
          return { tooltip: "FOO", weight: 17, bubble: true };
        } else {
          return new Promise((_resolve) => {
          });
        }
      }
    });
    const data1 = service.getDecoration(URI.parse("a:b/"), true);
    assert.ok(!data1);
    const data2 = service.getDecoration(URI.parse("a:b/c.hello"), false);
    assert.ok(data2.tooltip);
    const data3 = service.getDecoration(URI.parse("a:b/"), true);
    assert.ok(data3);
    reg.dispose();
  });
  test("Folder decorations don't go away when file with problems is deleted #61919 (part1)", function() {
    const emitter = new Emitter();
    let gone = false;
    const reg = service.registerDecorationsProvider({
      label: "Test",
      onDidChange: emitter.event,
      provideDecorations(uri3) {
        if (!gone && uri3.path.match(/file.ts$/)) {
          return { tooltip: "FOO", weight: 17, bubble: true };
        }
        return void 0;
      }
    });
    const uri = URI.parse("foo:/folder/file.ts");
    const uri2 = URI.parse("foo:/folder/");
    let data = service.getDecoration(uri, true);
    assert.strictEqual(data.tooltip, "FOO");
    data = service.getDecoration(uri2, true);
    assert.ok(data.tooltip);
    gone = true;
    emitter.fire([uri]);
    data = service.getDecoration(uri, true);
    assert.strictEqual(data, void 0);
    data = service.getDecoration(uri2, true);
    assert.strictEqual(data, void 0);
    reg.dispose();
  });
  test("Folder decorations don't go away when file with problems is deleted #61919 (part2)", function() {
    return runWithFakedTimers({}, async function() {
      const emitter = new Emitter();
      let gone = false;
      const reg = service.registerDecorationsProvider({
        label: "Test",
        onDidChange: emitter.event,
        provideDecorations(uri3) {
          if (!gone && uri3.path.match(/file.ts$/)) {
            return { tooltip: "FOO", weight: 17, bubble: true };
          }
          return void 0;
        }
      });
      const uri = URI.parse("foo:/folder/file.ts");
      const uri2 = URI.parse("foo:/folder/");
      let data = service.getDecoration(uri, true);
      assert.strictEqual(data.tooltip, "FOO");
      data = service.getDecoration(uri2, true);
      assert.ok(data.tooltip);
      return new Promise((resolve, reject) => {
        const l = service.onDidChangeDecorations((e) => {
          l.dispose();
          try {
            assert.ok(e.affectsResource(uri));
            assert.ok(e.affectsResource(uri2));
            resolve();
            reg.dispose();
          } catch (err) {
            reject(err);
            reg.dispose();
          }
        });
        gone = true;
        emitter.fire([uri]);
      });
    });
  });
  test("FileDecorationProvider intermittently fails #133210", async function() {
    const invokeOrder = [];
    store.add(service.registerDecorationsProvider(new class {
      constructor() {
        this.label = "Provider-1";
        this.onDidChange = Event.None;
      }
      provideDecorations() {
        invokeOrder.push(this.label);
        return void 0;
      }
    }()));
    store.add(service.registerDecorationsProvider(new class {
      constructor() {
        this.label = "Provider-2";
        this.onDidChange = Event.None;
      }
      provideDecorations() {
        invokeOrder.push(this.label);
        return void 0;
      }
    }()));
    service.getDecoration(URI.parse("test://me/path"), false);
    assert.deepStrictEqual(invokeOrder, ["Provider-2", "Provider-1"]);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZGVjb3JhdGlvbnMvdGVzdC9icm93c2VyL2RlY29yYXRpb25zU2VydmljZS50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRGVjb3JhdGlvbnNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vYnJvd3Nlci9kZWNvcmF0aW9uc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSURlY29yYXRpb25zUHJvdmlkZXIsIElEZWNvcmF0aW9uRGF0YSB9IGZyb20gJy4uLy4uL2NvbW1vbi9kZWNvcmF0aW9ucy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgKiBhcyByZXNvdXJjZXMgZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgSVVyaUlkZW50aXR5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3VyaUlkZW50aXR5L2NvbW1vbi91cmlJZGVudGl0eS5qcyc7XG5pbXBvcnQgeyBUZXN0VGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvdGVzdC9jb21tb24vdGVzdFRoZW1lU2VydmljZS5qcyc7XG5pbXBvcnQgeyBydW5XaXRoRmFrZWRUaW1lcnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3RpbWVUcmF2ZWxTY2hlZHVsZXIuanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5cbnN1aXRlKCdEZWNvcmF0aW9uc1NlcnZpY2UnLCBmdW5jdGlvbiAoKSB7XG5cblx0bGV0IHNlcnZpY2U6IERlY29yYXRpb25zU2VydmljZTtcblxuXHRzZXR1cChmdW5jdGlvbiAoKSB7XG5cdFx0c2VydmljZSA9IG5ldyBEZWNvcmF0aW9uc1NlcnZpY2UoXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElVcmlJZGVudGl0eVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBleHRVcmkgPSByZXNvdXJjZXMuZXh0VXJpO1xuXHRcdFx0fSxcblx0XHRcdG5ldyBUZXN0VGhlbWVTZXJ2aWNlKClcblx0XHQpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihmdW5jdGlvbiAoKSB7XG5cdFx0c2VydmljZS5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdGNvbnN0IHN0b3JlID0gZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlKCk7XG5cblxuXHR0ZXN0KCdBc3luYyBwcm92aWRlciwgYXN5bmMvZXZlbnRlZCByZXN1bHQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRyZXR1cm4gcnVuV2l0aEZha2VkVGltZXJzKHt9LCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnZm9vOmJhcicpO1xuXHRcdFx0bGV0IGNhbGxDb3VudGVyID0gMDtcblxuXHRcdFx0Y29uc3QgcmVnID0gc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIobmV3IGNsYXNzIGltcGxlbWVudHMgSURlY29yYXRpb25zUHJvdmlkZXIge1xuXHRcdFx0XHRyZWFkb25seSBsYWJlbDogc3RyaW5nID0gJ1Rlc3QnO1xuXHRcdFx0XHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8cmVhZG9ubHkgVVJJW10+ID0gRXZlbnQuTm9uZTtcblx0XHRcdFx0cHJvdmlkZURlY29yYXRpb25zKHVyaTogVVJJKSB7XG5cdFx0XHRcdFx0Y2FsbENvdW50ZXIgKz0gMTtcblx0XHRcdFx0XHRyZXR1cm4gbmV3IFByb21pc2U8SURlY29yYXRpb25EYXRhPihyZXNvbHZlID0+IHtcblx0XHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4gcmVzb2x2ZSh7XG5cdFx0XHRcdFx0XHRcdGNvbG9yOiAnc29tZUJsdWUnLFxuXHRcdFx0XHRcdFx0XHR0b29sdGlwOiAnVCcsXG5cdFx0XHRcdFx0XHRcdHN0cmlrZXRocm91Z2g6IHRydWVcblx0XHRcdFx0XHRcdH0pKTtcblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fVxuXHRcdFx0fSk7XG5cblx0XHRcdC8vIHRyaWdnZXIgLT4gYXN5bmNcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmdldERlY29yYXRpb24odXJpLCBmYWxzZSksIHVuZGVmaW5lZCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50ZXIsIDEpO1xuXG5cdFx0XHQvLyBldmVudCB3aGVuIHJlc3VsdCBpcyBjb21wdXRlZFxuXHRcdFx0Y29uc3QgZSA9IGF3YWl0IEV2ZW50LnRvUHJvbWlzZShzZXJ2aWNlLm9uRGlkQ2hhbmdlRGVjb3JhdGlvbnMpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUuYWZmZWN0c1Jlc291cmNlKHVyaSksIHRydWUpO1xuXHRcdFx0Ly8gc3luYyByZXN1bHRcblx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaSwgZmFsc2UpIS50b29sdGlwLCAnVCcpO1xuXHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLmdldERlY29yYXRpb24odXJpLCBmYWxzZSkhLnN0cmlrZXRocm91Z2gsIHRydWUpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudGVyLCAxKTtcblxuXHRcdFx0cmVnLmRpc3Bvc2UoKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnU3luYyBwcm92aWRlciwgc3luYyByZXN1bHQnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ2ZvbzpiYXInKTtcblx0XHRsZXQgY2FsbENvdW50ZXIgPSAwO1xuXG5cdFx0Y29uc3QgcmVnID0gc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIobmV3IGNsYXNzIGltcGxlbWVudHMgSURlY29yYXRpb25zUHJvdmlkZXIge1xuXHRcdFx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyA9ICdUZXN0Jztcblx0XHRcdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxyZWFkb25seSBVUklbXT4gPSBFdmVudC5Ob25lO1xuXHRcdFx0cHJvdmlkZURlY29yYXRpb25zKHVyaTogVVJJKSB7XG5cdFx0XHRcdGNhbGxDb3VudGVyICs9IDE7XG5cdFx0XHRcdHJldHVybiB7IGNvbG9yOiAnc29tZUJsdWUnLCB0b29sdGlwOiAnWicgfTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdC8vIHRyaWdnZXIgLT4gc3luY1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaSwgZmFsc2UpIS50b29sdGlwLCAnWicpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaSwgZmFsc2UpIS5zdHJpa2V0aHJvdWdoLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudGVyLCAxKTtcblxuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0NsZWFyIGRlY29yYXRpb25zIG9uIHByb3ZpZGVyIGRpc3Bvc2UnLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ2ZvbzpiYXInKTtcblx0XHRcdGxldCBjYWxsQ291bnRlciA9IDA7XG5cblx0XHRcdGNvbnN0IHJlZyA9IHNlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKG5ldyBjbGFzcyBpbXBsZW1lbnRzIElEZWNvcmF0aW9uc1Byb3ZpZGVyIHtcblx0XHRcdFx0cmVhZG9ubHkgbGFiZWw6IHN0cmluZyA9ICdUZXN0Jztcblx0XHRcdFx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PHJlYWRvbmx5IFVSSVtdPiA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRcdHByb3ZpZGVEZWNvcmF0aW9ucyh1cmk6IFVSSSkge1xuXHRcdFx0XHRcdGNhbGxDb3VudGVyICs9IDE7XG5cdFx0XHRcdFx0cmV0dXJuIHsgY29sb3I6ICdzb21lQmx1ZScsIHRvb2x0aXA6ICdKJyB9O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Ly8gdHJpZ2dlciAtPiBzeW5jXG5cdFx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0RGVjb3JhdGlvbih1cmksIGZhbHNlKSEudG9vbHRpcCwgJ0onKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnRlciwgMSk7XG5cblx0XHRcdC8vIHVuLXJlZ2lzdGVyIC0+IGVuc3VyZSBnb29kIGV2ZW50XG5cdFx0XHRsZXQgZGlkU2VlRXZlbnQgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHAgPSBuZXcgUHJvbWlzZTx2b2lkPihyZXNvbHZlID0+IHtcblx0XHRcdFx0Y29uc3QgbCA9IHNlcnZpY2Uub25EaWRDaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5hZmZlY3RzUmVzb3VyY2UodXJpKSwgdHJ1ZSk7XG5cdFx0XHRcdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChzZXJ2aWNlLmdldERlY29yYXRpb24odXJpLCBmYWxzZSksIHVuZGVmaW5lZCk7XG5cdFx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudGVyLCAxKTtcblx0XHRcdFx0XHRkaWRTZWVFdmVudCA9IHRydWU7XG5cdFx0XHRcdFx0bC5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0cmVzb2x2ZSgpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH0pO1xuXHRcdFx0cmVnLmRpc3Bvc2UoKTsgLy8gd2lsbCBjbGVhciBhbGwgZGF0YVxuXHRcdFx0YXdhaXQgcDtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaWRTZWVFdmVudCwgdHJ1ZSk7XG5cblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnTm8gZGVmYXVsdCBidWJibGluZycsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCByZWcgPSBzZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvbnNQcm92aWRlcih7XG5cdFx0XHRsYWJlbDogJ1Rlc3QnLFxuXHRcdFx0b25EaWRDaGFuZ2U6IEV2ZW50Lk5vbmUsXG5cdFx0XHRwcm92aWRlRGVjb3JhdGlvbnModXJpOiBVUkkpIHtcblx0XHRcdFx0cmV0dXJuIHVyaS5wYXRoLm1hdGNoKC9cXC50eHQvKVxuXHRcdFx0XHRcdD8geyB0b29sdGlwOiAnLnR4dCcsIHdlaWdodDogMTcgfVxuXHRcdFx0XHRcdDogdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY2hpbGRVcmkgPSBVUkkucGFyc2UoJ2ZpbGU6Ly8vc29tZS9wYXRoL3NvbWUvZmlsZS50eHQnKTtcblxuXHRcdGxldCBkZWNvID0gc2VydmljZS5nZXREZWNvcmF0aW9uKGNoaWxkVXJpLCBmYWxzZSkhO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkZWNvLnRvb2x0aXAsICcudHh0Jyk7XG5cblx0XHRkZWNvID0gc2VydmljZS5nZXREZWNvcmF0aW9uKGNoaWxkVXJpLndpdGgoeyBwYXRoOiAnc29tZS9wYXRoLycgfSksIHRydWUpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGVjbywgdW5kZWZpbmVkKTtcblx0XHRyZWcuZGlzcG9zZSgpO1xuXG5cdFx0Ly8gYnViYmxlXG5cdFx0cmVnID0gc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIoe1xuXHRcdFx0bGFiZWw6ICdUZXN0Jyxcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudC5Ob25lLFxuXHRcdFx0cHJvdmlkZURlY29yYXRpb25zKHVyaTogVVJJKSB7XG5cdFx0XHRcdHJldHVybiB1cmkucGF0aC5tYXRjaCgvXFwudHh0Lylcblx0XHRcdFx0XHQ/IHsgdG9vbHRpcDogJy50eHQuYnViYmxlJywgd2VpZ2h0OiA3MSwgYnViYmxlOiB0cnVlIH1cblx0XHRcdFx0XHQ6IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGRlY28gPSBzZXJ2aWNlLmdldERlY29yYXRpb24oY2hpbGRVcmksIGZhbHNlKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRlY28udG9vbHRpcCwgJy50eHQuYnViYmxlJyk7XG5cblx0XHRkZWNvID0gc2VydmljZS5nZXREZWNvcmF0aW9uKGNoaWxkVXJpLndpdGgoeyBwYXRoOiAnc29tZS9wYXRoLycgfSksIHRydWUpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwodHlwZW9mIGRlY28udG9vbHRpcCwgJ3N0cmluZycpO1xuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0RlY29yYXRpb25zIG5vdCBzaG93aW5nIHVwIGZvciBzZWNvbmQgcm9vdCBmb2xkZXIgIzQ4NTAyJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGNhbmNlbENvdW50ID0gMDtcblx0XHRsZXQgY2FsbENvdW50ID0gMDtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IGNsYXNzIGltcGxlbWVudHMgSURlY29yYXRpb25zUHJvdmlkZXIge1xuXG5cdFx0XHRfb25EaWRDaGFuZ2UgPSBuZXcgRW1pdHRlcjxVUklbXT4oKTtcblx0XHRcdG9uRGlkQ2hhbmdlOiBFdmVudDxyZWFkb25seSBVUklbXT4gPSB0aGlzLl9vbkRpZENoYW5nZS5ldmVudDtcblxuXHRcdFx0bGFiZWw6IHN0cmluZyA9ICdmb28nO1xuXG5cdFx0XHRwcm92aWRlRGVjb3JhdGlvbnModXJpOiBVUkksIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SURlY29yYXRpb25EYXRhPiB7XG5cblx0XHRcdFx0c3RvcmUuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdFx0XHRjYW5jZWxDb3VudCArPSAxO1xuXHRcdFx0XHR9KSk7XG5cblx0XHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0XHRcdHNldFRpbWVvdXQoKCkgPT4ge1xuXHRcdFx0XHRcdFx0cmVzb2x2ZSh7IGxldHRlcjogJ2ZvbycgfSk7XG5cdFx0XHRcdFx0fSwgMTApO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVnID0gc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIocHJvdmlkZXIpO1xuXG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKCdmb286Ly9iYXInKTtcblx0XHRjb25zdCBkMSA9IHNlcnZpY2UuZ2V0RGVjb3JhdGlvbih1cmksIGZhbHNlKTtcblxuXHRcdHByb3ZpZGVyLl9vbkRpZENoYW5nZS5maXJlKFt1cmldKTtcblx0XHRjb25zdCBkMiA9IHNlcnZpY2UuZ2V0RGVjb3JhdGlvbih1cmksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYW5jZWxDb3VudCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMik7XG5cblx0XHRkMT8uZGlzcG9zZSgpO1xuXHRcdGQyPy5kaXNwb3NlKCk7XG5cdFx0cmVnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnRGVjb3JhdGlvbnMgbm90IGJ1YmJsaW5nLi4uICM0ODc0NScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJlZyA9IHNlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKHtcblx0XHRcdGxhYmVsOiAnVGVzdCcsXG5cdFx0XHRvbkRpZENoYW5nZTogRXZlbnQuTm9uZSxcblx0XHRcdHByb3ZpZGVEZWNvcmF0aW9ucyh1cmk6IFVSSSkge1xuXHRcdFx0XHRpZiAodXJpLnBhdGgubWF0Y2goL2hlbGxvJC8pKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgdG9vbHRpcDogJ0ZPTycsIHdlaWdodDogMTcsIGJ1YmJsZTogdHJ1ZSB9O1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiBuZXcgUHJvbWlzZTxJRGVjb3JhdGlvbkRhdGE+KF9yZXNvbHZlID0+IHsgfSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGNvbnN0IGRhdGExID0gc2VydmljZS5nZXREZWNvcmF0aW9uKFVSSS5wYXJzZSgnYTpiLycpLCB0cnVlKTtcblx0XHRhc3NlcnQub2soIWRhdGExKTtcblxuXHRcdGNvbnN0IGRhdGEyID0gc2VydmljZS5nZXREZWNvcmF0aW9uKFVSSS5wYXJzZSgnYTpiL2MuaGVsbG8nKSwgZmFsc2UpITtcblx0XHRhc3NlcnQub2soZGF0YTIudG9vbHRpcCk7XG5cblx0XHRjb25zdCBkYXRhMyA9IHNlcnZpY2UuZ2V0RGVjb3JhdGlvbihVUkkucGFyc2UoJ2E6Yi8nKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0Lm9rKGRhdGEzKTtcblxuXG5cdFx0cmVnLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnRm9sZGVyIGRlY29yYXRpb25zIGRvblxcJ3QgZ28gYXdheSB3aGVuIGZpbGUgd2l0aCBwcm9ibGVtcyBpcyBkZWxldGVkICM2MTkxOSAocGFydDEpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFVSSVtdPigpO1xuXHRcdGxldCBnb25lID0gZmFsc2U7XG5cdFx0Y29uc3QgcmVnID0gc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIoe1xuXHRcdFx0bGFiZWw6ICdUZXN0Jyxcblx0XHRcdG9uRGlkQ2hhbmdlOiBlbWl0dGVyLmV2ZW50LFxuXHRcdFx0cHJvdmlkZURlY29yYXRpb25zKHVyaTogVVJJKSB7XG5cdFx0XHRcdGlmICghZ29uZSAmJiB1cmkucGF0aC5tYXRjaCgvZmlsZS50cyQvKSkge1xuXHRcdFx0XHRcdHJldHVybiB7IHRvb2x0aXA6ICdGT08nLCB3ZWlnaHQ6IDE3LCBidWJibGU6IHRydWUgfTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKCdmb286L2ZvbGRlci9maWxlLnRzJyk7XG5cdFx0Y29uc3QgdXJpMiA9IFVSSS5wYXJzZSgnZm9vOi9mb2xkZXIvJyk7XG5cdFx0bGV0IGRhdGEgPSBzZXJ2aWNlLmdldERlY29yYXRpb24odXJpLCB0cnVlKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEudG9vbHRpcCwgJ0ZPTycpO1xuXG5cdFx0ZGF0YSA9IHNlcnZpY2UuZ2V0RGVjb3JhdGlvbih1cmkyLCB0cnVlKSE7XG5cdFx0YXNzZXJ0Lm9rKGRhdGEudG9vbHRpcCk7IC8vIGVtcGhhemllZCBpdGVtcy4uLlxuXG5cdFx0Z29uZSA9IHRydWU7XG5cdFx0ZW1pdHRlci5maXJlKFt1cmldKTtcblxuXHRcdGRhdGEgPSBzZXJ2aWNlLmdldERlY29yYXRpb24odXJpLCB0cnVlKSE7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEsIHVuZGVmaW5lZCk7XG5cblx0XHRkYXRhID0gc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaTIsIHRydWUpITtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YSwgdW5kZWZpbmVkKTtcblxuXHRcdHJlZy5kaXNwb3NlKCk7XG5cdH0pO1xuXG5cdHRlc3QoJ0ZvbGRlciBkZWNvcmF0aW9ucyBkb25cXCd0IGdvIGF3YXkgd2hlbiBmaWxlIHdpdGggcHJvYmxlbXMgaXMgZGVsZXRlZCAjNjE5MTkgKHBhcnQyKScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdHJldHVybiBydW5XaXRoRmFrZWRUaW1lcnMoe30sIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPFVSSVtdPigpO1xuXHRcdFx0bGV0IGdvbmUgPSBmYWxzZTtcblx0XHRcdGNvbnN0IHJlZyA9IHNlcnZpY2UucmVnaXN0ZXJEZWNvcmF0aW9uc1Byb3ZpZGVyKHtcblx0XHRcdFx0bGFiZWw6ICdUZXN0Jyxcblx0XHRcdFx0b25EaWRDaGFuZ2U6IGVtaXR0ZXIuZXZlbnQsXG5cdFx0XHRcdHByb3ZpZGVEZWNvcmF0aW9ucyh1cmk6IFVSSSkge1xuXHRcdFx0XHRcdGlmICghZ29uZSAmJiB1cmkucGF0aC5tYXRjaCgvZmlsZS50cyQvKSkge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgdG9vbHRpcDogJ0ZPTycsIHdlaWdodDogMTcsIGJ1YmJsZTogdHJ1ZSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblxuXHRcdFx0Y29uc3QgdXJpID0gVVJJLnBhcnNlKCdmb286L2ZvbGRlci9maWxlLnRzJyk7XG5cdFx0XHRjb25zdCB1cmkyID0gVVJJLnBhcnNlKCdmb286L2ZvbGRlci8nKTtcblx0XHRcdGxldCBkYXRhID0gc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaSwgdHJ1ZSkhO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRhdGEudG9vbHRpcCwgJ0ZPTycpO1xuXG5cdFx0XHRkYXRhID0gc2VydmljZS5nZXREZWNvcmF0aW9uKHVyaTIsIHRydWUpITtcblx0XHRcdGFzc2VydC5vayhkYXRhLnRvb2x0aXApOyAvLyBlbXBoYXppZWQgaXRlbXMuLi5cblxuXHRcdFx0cmV0dXJuIG5ldyBQcm9taXNlPHZvaWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblx0XHRcdFx0Y29uc3QgbCA9IHNlcnZpY2Uub25EaWRDaGFuZ2VEZWNvcmF0aW9ucyhlID0+IHtcblx0XHRcdFx0XHRsLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGUuYWZmZWN0c1Jlc291cmNlKHVyaSkpO1xuXHRcdFx0XHRcdFx0YXNzZXJ0Lm9rKGUuYWZmZWN0c1Jlc291cmNlKHVyaTIpKTtcblx0XHRcdFx0XHRcdHJlc29sdmUoKTtcblx0XHRcdFx0XHRcdHJlZy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRyZWplY3QoZXJyKTtcblx0XHRcdFx0XHRcdHJlZy5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0Z29uZSA9IHRydWU7XG5cdFx0XHRcdGVtaXR0ZXIuZmlyZShbdXJpXSk7XG5cdFx0XHR9KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnRmlsZURlY29yYXRpb25Qcm92aWRlciBpbnRlcm1pdHRlbnRseSBmYWlscyAjMTMzMjEwJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgaW52b2tlT3JkZXI6IHN0cmluZ1tdID0gW107XG5cblx0XHRzdG9yZS5hZGQoc2VydmljZS5yZWdpc3RlckRlY29yYXRpb25zUHJvdmlkZXIobmV3IGNsYXNzIHtcblx0XHRcdGxhYmVsID0gJ1Byb3ZpZGVyLTEnO1xuXHRcdFx0b25EaWRDaGFuZ2UgPSBFdmVudC5Ob25lO1xuXHRcdFx0cHJvdmlkZURlY29yYXRpb25zKCkge1xuXHRcdFx0XHRpbnZva2VPcmRlci5wdXNoKHRoaXMubGFiZWwpO1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHN0b3JlLmFkZChzZXJ2aWNlLnJlZ2lzdGVyRGVjb3JhdGlvbnNQcm92aWRlcihuZXcgY2xhc3Mge1xuXHRcdFx0bGFiZWwgPSAnUHJvdmlkZXItMic7XG5cdFx0XHRvbkRpZENoYW5nZSA9IEV2ZW50Lk5vbmU7XG5cdFx0XHRwcm92aWRlRGVjb3JhdGlvbnMoKSB7XG5cdFx0XHRcdGludm9rZU9yZGVyLnB1c2godGhpcy5sYWJlbCk7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0c2VydmljZS5nZXREZWNvcmF0aW9uKFVSSS5wYXJzZSgndGVzdDovL21lL3BhdGgnKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChpbnZva2VPcmRlciwgWydQcm92aWRlci0yJywgJ1Byb3ZpZGVyLTEnXSk7XG5cdH0pO1xufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxPQUFPLFlBQVk7QUFDbkIsU0FBUywwQkFBMEI7QUFFbkMsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsT0FBTyxlQUFlO0FBQy9CLFlBQVksZUFBZTtBQUUzQixTQUFTLFlBQVk7QUFFckIsU0FBUyx3QkFBd0I7QUFDakMsU0FBUywwQkFBMEI7QUFDbkMs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
