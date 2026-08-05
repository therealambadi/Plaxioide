import assert from "assert";
import { URI } from "../../../../base/common/uri.js";
import { DiagnosticCollection, ExtHostDiagnostics } from "../../common/extHostDiagnostics.js";
import { Diagnostic, DiagnosticSeverity, Range, DiagnosticRelatedInformation, Location } from "../../common/extHostTypes.js";
import { MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { mock } from "../../../../base/test/common/mock.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { NullLogService } from "../../../../platform/log/common/log.js";
import { nullExtensionDescription } from "../../../services/extensions/common/extensions.js";
import { ExtUri, extUri } from "../../../../base/common/resources.js";
import { runWithFakedTimers } from "../../../../base/test/common/timeTravelScheduler.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
suite("ExtHostDiagnostics", () => {
  class DiagnosticsShape extends mock() {
    $changeMany(owner, entries) {
    }
    $clear(owner) {
    }
  }
  const fileSystemInfoService = new class extends mock() {
    constructor() {
      super(...arguments);
      this.extUri = extUri;
    }
  }();
  const versionProvider = (uri) => {
    return void 0;
  };
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  test("disposeCheck", () => {
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    collection.dispose();
    collection.dispose();
    assert.throws(() => collection.name);
    assert.throws(() => collection.clear());
    assert.throws(() => collection.delete(URI.parse("aa:bb")));
    assert.throws(() => collection.forEach(() => {
    }));
    assert.throws(() => collection.get(URI.parse("aa:bb")));
    assert.throws(() => collection.has(URI.parse("aa:bb")));
    assert.throws(() => collection.set(URI.parse("aa:bb"), []));
    assert.throws(() => collection.set(URI.parse("aa:bb"), void 0));
  });
  test("diagnostic collection, forEach, clear, has", function() {
    let collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    assert.strictEqual(collection.name, "test");
    collection.dispose();
    assert.throws(() => collection.name);
    let c = 0;
    collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    collection.forEach(() => c++);
    assert.strictEqual(c, 0);
    collection.set(URI.parse("foo:bar"), [
      new Diagnostic(new Range(0, 0, 1, 1), "message-1"),
      new Diagnostic(new Range(0, 0, 1, 1), "message-2")
    ]);
    collection.forEach(() => c++);
    assert.strictEqual(c, 1);
    c = 0;
    collection.clear();
    collection.forEach(() => c++);
    assert.strictEqual(c, 0);
    collection.set(URI.parse("foo:bar1"), [
      new Diagnostic(new Range(0, 0, 1, 1), "message-1"),
      new Diagnostic(new Range(0, 0, 1, 1), "message-2")
    ]);
    collection.set(URI.parse("foo:bar2"), [
      new Diagnostic(new Range(0, 0, 1, 1), "message-1"),
      new Diagnostic(new Range(0, 0, 1, 1), "message-2")
    ]);
    collection.forEach(() => c++);
    assert.strictEqual(c, 2);
    assert.ok(collection.has(URI.parse("foo:bar1")));
    assert.ok(collection.has(URI.parse("foo:bar2")));
    assert.ok(!collection.has(URI.parse("foo:bar3")));
    collection.delete(URI.parse("foo:bar1"));
    assert.ok(!collection.has(URI.parse("foo:bar1")));
    collection.dispose();
  });
  test("diagnostic collection, immutable read", function() {
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    collection.set(URI.parse("foo:bar"), [
      new Diagnostic(new Range(0, 0, 1, 1), "message-1"),
      new Diagnostic(new Range(0, 0, 1, 1), "message-2")
    ]);
    let array = collection.get(URI.parse("foo:bar"));
    assert.throws(() => array.length = 0);
    assert.throws(() => array.pop());
    assert.throws(() => array[0] = new Diagnostic(new Range(0, 0, 0, 0), "evil"));
    collection.forEach((uri, array2) => {
      assert.throws(() => array2.length = 0);
      assert.throws(() => array2.pop());
      assert.throws(() => array2[0] = new Diagnostic(new Range(0, 0, 0, 0), "evil"));
    });
    array = collection.get(URI.parse("foo:bar"));
    assert.strictEqual(array.length, 2);
    collection.dispose();
  });
  test("diagnostics collection, set with dupliclated tuples", function() {
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    const uri = URI.parse("sc:hightower");
    collection.set([
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-1")]],
      [URI.parse("some:thing"), [new Diagnostic(new Range(0, 0, 1, 1), "something")]],
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-2")]]
    ]);
    let array = collection.get(uri);
    assert.strictEqual(array.length, 2);
    let [first, second] = array;
    assert.strictEqual(first.message, "message-1");
    assert.strictEqual(second.message, "message-2");
    collection.delete(uri);
    assert.ok(!collection.has(uri));
    collection.set([
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-1")]],
      [URI.parse("some:thing"), [new Diagnostic(new Range(0, 0, 1, 1), "something")]],
      [uri, void 0]
    ]);
    assert.ok(!collection.has(uri));
    collection.delete(uri);
    assert.ok(!collection.has(uri));
    collection.set([
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-1")]],
      [URI.parse("some:thing"), [new Diagnostic(new Range(0, 0, 1, 1), "something")]],
      [uri, void 0],
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-2")]],
      [uri, [new Diagnostic(new Range(0, 0, 0, 1), "message-3")]]
    ]);
    array = collection.get(uri);
    assert.strictEqual(array.length, 2);
    [first, second] = array;
    assert.strictEqual(first.message, "message-2");
    assert.strictEqual(second.message, "message-3");
    collection.dispose();
  });
  test("diagnostics collection, set tuple overrides, #11547", function() {
    let lastEntries;
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany(owner, entries) {
        lastEntries = entries;
        return super.$changeMany(owner, entries);
      }
    }(), new Emitter());
    const uri = URI.parse("sc:hightower");
    collection.set([[uri, [new Diagnostic(new Range(0, 0, 1, 1), "error")]]]);
    assert.strictEqual(collection.get(uri).length, 1);
    assert.strictEqual(collection.get(uri)[0].message, "error");
    assert.strictEqual(lastEntries.length, 1);
    const [[, data1]] = lastEntries;
    assert.strictEqual(data1.length, 1);
    assert.strictEqual(data1[0].message, "error");
    lastEntries = void 0;
    collection.set([[uri, [new Diagnostic(new Range(0, 0, 1, 1), "warning")]]]);
    assert.strictEqual(collection.get(uri).length, 1);
    assert.strictEqual(collection.get(uri)[0].message, "warning");
    assert.strictEqual(lastEntries.length, 1);
    const [[, data2]] = lastEntries;
    assert.strictEqual(data2.length, 1);
    assert.strictEqual(data2[0].message, "warning");
    lastEntries = void 0;
  });
  test("do send message when not making a change", function() {
    let changeCount = 0;
    let eventCount = 0;
    const emitter = new Emitter();
    store.add(emitter.event((_) => eventCount += 1));
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany() {
        changeCount += 1;
      }
    }(), emitter);
    const uri = URI.parse("sc:hightower");
    const diag = new Diagnostic(new Range(0, 0, 0, 1), "ffff");
    collection.set(uri, [diag]);
    assert.strictEqual(changeCount, 1);
    assert.strictEqual(eventCount, 1);
    collection.set(uri, [diag]);
    assert.strictEqual(changeCount, 2);
    assert.strictEqual(eventCount, 2);
  });
  test("diagnostics collection, tuples and undefined (small array), #15585", function() {
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    const uri = URI.parse("sc:hightower");
    const uri2 = URI.parse("sc:nomad");
    const diag = new Diagnostic(new Range(0, 0, 0, 1), "ffff");
    collection.set([
      [uri, [diag, diag, diag]],
      [uri, void 0],
      [uri, [diag]],
      [uri2, [diag, diag]],
      [uri2, void 0],
      [uri2, [diag]]
    ]);
    assert.strictEqual(collection.get(uri).length, 1);
    assert.strictEqual(collection.get(uri2).length, 1);
  });
  test("diagnostics collection, tuples and undefined (large array), #15585", function() {
    const collection = new DiagnosticCollection("test", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), new Emitter());
    const tuples = [];
    for (let i = 0; i < 500; i++) {
      const uri = URI.parse("sc:hightower#" + i);
      const diag = new Diagnostic(new Range(0, 0, 0, 1), i.toString());
      tuples.push([uri, [diag, diag, diag]]);
      tuples.push([uri, void 0]);
      tuples.push([uri, [diag]]);
    }
    collection.set(tuples);
    for (let i = 0; i < 500; i++) {
      const uri = URI.parse("sc:hightower#" + i);
      assert.strictEqual(collection.has(uri), true);
      assert.strictEqual(collection.get(uri).length, 1);
    }
  });
  test("diagnostic capping (max per file)", function() {
    let lastEntries;
    const collection = new DiagnosticCollection("test", "test", 100, 250, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany(owner, entries) {
        lastEntries = entries;
        return super.$changeMany(owner, entries);
      }
    }(), new Emitter());
    const uri = URI.parse("aa:bb");
    const diagnostics = [];
    for (let i = 0; i < 500; i++) {
      diagnostics.push(new Diagnostic(new Range(i, 0, i + 1, 0), `error#${i}`, i < 300 ? DiagnosticSeverity.Warning : DiagnosticSeverity.Error));
    }
    collection.set(uri, diagnostics);
    assert.strictEqual(collection.get(uri).length, 500);
    assert.strictEqual(lastEntries.length, 1);
    assert.strictEqual(lastEntries[0][1].length, 251);
    assert.strictEqual(lastEntries[0][1][0].severity, MarkerSeverity.Error);
    assert.strictEqual(lastEntries[0][1][200].severity, MarkerSeverity.Warning);
    assert.strictEqual(lastEntries[0][1][250].severity, MarkerSeverity.Info);
  });
  test("diagnostic capping (max files)", function() {
    let lastEntries;
    const collection = new DiagnosticCollection("test", "test", 2, 1, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany(owner, entries) {
        lastEntries = entries;
        return super.$changeMany(owner, entries);
      }
    }(), new Emitter());
    const diag = new Diagnostic(new Range(0, 0, 1, 1), "Hello");
    collection.set([
      [URI.parse("aa:bb1"), [diag]],
      [URI.parse("aa:bb2"), [diag]],
      [URI.parse("aa:bb3"), [diag]],
      [URI.parse("aa:bb4"), [diag]]
    ]);
    assert.strictEqual(lastEntries.length, 3);
  });
  test("diagnostic eventing", async function() {
    const emitter = new Emitter();
    const collection = new DiagnosticCollection("ddd", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), emitter);
    const diag1 = new Diagnostic(new Range(1, 1, 2, 3), "diag1");
    const diag2 = new Diagnostic(new Range(1, 1, 2, 3), "diag2");
    const diag3 = new Diagnostic(new Range(1, 1, 2, 3), "diag3");
    let p = Event.toPromise(emitter.event).then((a) => {
      assert.strictEqual(a.length, 1);
      assert.strictEqual(a[0].toString(), "aa:bb");
      assert.ok(URI.isUri(a[0]));
    });
    collection.set(URI.parse("aa:bb"), []);
    await p;
    p = Event.toPromise(emitter.event).then((e) => {
      assert.strictEqual(e.length, 2);
      assert.ok(URI.isUri(e[0]));
      assert.ok(URI.isUri(e[1]));
      assert.strictEqual(e[0].toString(), "aa:bb");
      assert.strictEqual(e[1].toString(), "aa:cc");
    });
    collection.set([
      [URI.parse("aa:bb"), [diag1]],
      [URI.parse("aa:cc"), [diag2, diag3]]
    ]);
    await p;
    p = Event.toPromise(emitter.event).then((e) => {
      assert.strictEqual(e.length, 2);
      assert.ok(URI.isUri(e[0]));
      assert.ok(URI.isUri(e[1]));
    });
    collection.clear();
    await p;
  });
  test("vscode.languages.onDidChangeDiagnostics Does Not Provide Document URI #49582", async function() {
    const emitter = new Emitter();
    const collection = new DiagnosticCollection("ddd", "test", 100, 100, versionProvider, extUri, new DiagnosticsShape(), emitter);
    const diag1 = new Diagnostic(new Range(1, 1, 2, 3), "diag1");
    collection.set(URI.parse("aa:bb"), [diag1]);
    let p = Event.toPromise(emitter.event).then((e) => {
      assert.strictEqual(e[0].toString(), "aa:bb");
    });
    collection.delete(URI.parse("aa:bb"));
    await p;
    collection.set(URI.parse("aa:bb"), [diag1]);
    p = Event.toPromise(emitter.event).then((e) => {
      assert.strictEqual(e[0].toString(), "aa:bb");
    });
    collection.set(URI.parse("aa:bb"), void 0);
    await p;
  });
  test("diagnostics with related information", function(done) {
    const collection = new DiagnosticCollection("ddd", "test", 100, 100, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany(owner, entries) {
        const [[, data]] = entries;
        assert.strictEqual(entries.length, 1);
        assert.strictEqual(data.length, 1);
        const [diag2] = data;
        assert.strictEqual(diag2.relatedInformation.length, 2);
        assert.strictEqual(diag2.relatedInformation[0].message, "more1");
        assert.strictEqual(diag2.relatedInformation[1].message, "more2");
        done();
      }
    }(), new Emitter());
    const diag = new Diagnostic(new Range(0, 0, 1, 1), "Foo");
    diag.relatedInformation = [
      new DiagnosticRelatedInformation(new Location(URI.parse("cc:dd"), new Range(0, 0, 0, 0)), "more1"),
      new DiagnosticRelatedInformation(new Location(URI.parse("cc:ee"), new Range(0, 0, 0, 0)), "more2")
    ];
    collection.set(URI.parse("aa:bb"), [diag]);
  });
  test("vscode.languages.getDiagnostics appears to return old diagnostics in some circumstances #54359", function() {
    const ownerHistory = [];
    const diags = new ExtHostDiagnostics(new class {
      getProxy(id) {
        return new class DiagnosticsShape {
          $clear(owner) {
            ownerHistory.push(owner);
          }
        }();
      }
      set() {
        return null;
      }
      dispose() {
      }
      assertRegistered() {
      }
      drain() {
        return void 0;
      }
    }(), new NullLogService(), fileSystemInfoService, new class extends mock() {
      getDocument() {
        return void 0;
      }
    }());
    const collection1 = diags.createDiagnosticCollection(nullExtensionDescription.identifier, "foo");
    const collection2 = diags.createDiagnosticCollection(nullExtensionDescription.identifier, "foo");
    collection1.clear();
    collection2.clear();
    assert.strictEqual(ownerHistory.length, 2);
    assert.strictEqual(ownerHistory[0], "foo");
    assert.strictEqual(ownerHistory[1], "foo0");
  });
  test("Error updating diagnostics from extension #60394", function() {
    let callCount = 0;
    const collection = new DiagnosticCollection("ddd", "test", 100, 100, versionProvider, extUri, new class extends DiagnosticsShape {
      $changeMany(owner, entries) {
        callCount += 1;
      }
    }(), new Emitter());
    const array = [];
    const diag1 = new Diagnostic(new Range(0, 0, 1, 1), "Foo");
    const diag2 = new Diagnostic(new Range(0, 0, 1, 1), "Bar");
    array.push(diag1, diag2);
    collection.set(URI.parse("test:me"), array);
    assert.strictEqual(callCount, 1);
    collection.set(URI.parse("test:me"), array);
    assert.strictEqual(callCount, 2);
    array.push(diag2);
    collection.set(URI.parse("test:me"), array);
    assert.strictEqual(callCount, 3);
  });
  test("Version id is set whenever possible", function() {
    const all = [];
    const collection = new DiagnosticCollection("ddd", "test", 100, 100, (uri) => {
      return 7;
    }, extUri, new class extends DiagnosticsShape {
      $changeMany(_owner, entries) {
        all.push(...entries);
      }
    }(), new Emitter());
    const array = [];
    const diag1 = new Diagnostic(new Range(0, 0, 1, 1), "Foo");
    const diag2 = new Diagnostic(new Range(0, 0, 1, 1), "Bar");
    array.push(diag1, diag2);
    collection.set(URI.parse("test:one"), array);
    collection.set(URI.parse("test:two"), [diag1]);
    collection.set(URI.parse("test:three"), [diag2]);
    const allVersions = all.map((tuple) => tuple[1].map((t) => t.modelVersionId)).flat();
    assert.deepStrictEqual(allVersions, [7, 7, 7, 7]);
  });
  test("Diagnostics created by tasks aren't accessible to extensions #47292", async function() {
    return runWithFakedTimers({}, async function() {
      const diags = new ExtHostDiagnostics(new class {
        getProxy(id) {
          return {};
        }
        set() {
          return null;
        }
        dispose() {
        }
        assertRegistered() {
        }
        drain() {
          return void 0;
        }
      }(), new NullLogService(), fileSystemInfoService, new class extends mock() {
        getDocument() {
          return void 0;
        }
      }());
      const uri = URI.parse("foo:bar");
      const data = [{
        message: "message",
        startLineNumber: 1,
        startColumn: 1,
        endLineNumber: 1,
        endColumn: 1,
        severity: MarkerSeverity.Info
      }];
      const p1 = Event.toPromise(diags.onDidChangeDiagnostics);
      diags.$acceptMarkersChange([[uri, data]]);
      await p1;
      assert.strictEqual(diags.getDiagnostics(uri).length, 1);
      const p2 = Event.toPromise(diags.onDidChangeDiagnostics);
      diags.$acceptMarkersChange([[uri, []]]);
      await p2;
      assert.strictEqual(diags.getDiagnostics(uri).length, 0);
    });
  });
  test("languages.getDiagnostics doesn't handle case insensitivity correctly #128198", function() {
    const diags = new ExtHostDiagnostics(new class {
      getProxy(id) {
        return new DiagnosticsShape();
      }
      set() {
        return null;
      }
      dispose() {
      }
      assertRegistered() {
      }
      drain() {
        return void 0;
      }
    }(), new NullLogService(), new class extends mock() {
      constructor() {
        super(...arguments);
        this.extUri = new ExtUri((uri) => uri.scheme === "insensitive");
      }
    }(), new class extends mock() {
      getDocument() {
        return void 0;
      }
    }());
    const col = diags.createDiagnosticCollection(nullExtensionDescription.identifier);
    const uriSensitive = URI.from({ scheme: "foo", path: "/SOME/path" });
    const uriSensitiveCaseB = uriSensitive.with({ path: uriSensitive.path.toUpperCase() });
    const uriInSensitive = URI.from({ scheme: "insensitive", path: "/SOME/path" });
    const uriInSensitiveUpper = uriInSensitive.with({ path: uriInSensitive.path.toUpperCase() });
    col.set(uriSensitive, [new Diagnostic(new Range(0, 0, 0, 0), "sensitive")]);
    col.set(uriInSensitive, [new Diagnostic(new Range(0, 0, 0, 0), "insensitive")]);
    assert.strictEqual(col.get(uriSensitive)?.length, 1);
    assert.strictEqual(col.get(uriSensitiveCaseB)?.length, 0);
    assert.strictEqual(col.get(uriInSensitive)?.length, 1);
    assert.strictEqual(col.get(uriInSensitiveUpper)?.length, 1);
    assert.strictEqual(diags.getDiagnostics(uriSensitive)?.length, 1);
    assert.strictEqual(diags.getDiagnostics(uriSensitiveCaseB)?.length, 0);
    assert.strictEqual(diags.getDiagnostics(uriInSensitive)?.length, 1);
    assert.strictEqual(diags.getDiagnostics(uriInSensitiveUpper)?.length, 1);
    const fromForEach = [];
    col.forEach((uri) => fromForEach.push(uri));
    assert.strictEqual(fromForEach.length, 2);
    assert.strictEqual(fromForEach[0].toString(), uriSensitive.toString());
    assert.strictEqual(fromForEach[1].toString(), uriInSensitive.toString());
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL3Rlc3QvYnJvd3Nlci9leHRIb3N0RGlhZ25vc3RpY3MudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IFVSSSwgVXJpQ29tcG9uZW50cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBEaWFnbm9zdGljQ29sbGVjdGlvbiwgRXh0SG9zdERpYWdub3N0aWNzIH0gZnJvbSAnLi4vLi4vY29tbW9uL2V4dEhvc3REaWFnbm9zdGljcy5qcyc7XG5pbXBvcnQgeyBEaWFnbm9zdGljLCBEaWFnbm9zdGljU2V2ZXJpdHksIFJhbmdlLCBEaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uLCBMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0VHlwZXMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZERpYWdub3N0aWNzU2hhcGUsIElNYWluQ29udGV4dCB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElNYXJrZXJEYXRhLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHR5cGUgKiBhcyB2c2NvZGUgZnJvbSAndnNjb2RlJztcbmltcG9ydCB7IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRXh0VXJpLCBleHRVcmkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgSUV4dEhvc3RGaWxlU3lzdGVtSW5mbyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RmlsZVN5c3RlbUluZm8uanMnO1xuaW1wb3J0IHsgcnVuV2l0aEZha2VkVGltZXJzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi90aW1lVHJhdmVsU2NoZWR1bGVyLmpzJztcbmltcG9ydCB7IElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycyB9IGZyb20gJy4uLy4uL2NvbW1vbi9leHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcblxuc3VpdGUoJ0V4dEhvc3REaWFnbm9zdGljcycsICgpID0+IHtcblxuXHRjbGFzcyBEaWFnbm9zdGljc1NoYXBlIGV4dGVuZHMgbW9jazxNYWluVGhyZWFkRGlhZ25vc3RpY3NTaGFwZT4oKSB7XG5cdFx0b3ZlcnJpZGUgJGNoYW5nZU1hbnkob3duZXI6IHN0cmluZywgZW50cmllczogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW10pOiB2b2lkIHtcblx0XHRcdC8vXG5cdFx0fVxuXHRcdG92ZXJyaWRlICRjbGVhcihvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHQvL1xuXHRcdH1cblx0fVxuXG5cdGNvbnN0IGZpbGVTeXN0ZW1JbmZvU2VydmljZSA9IG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RGaWxlU3lzdGVtSW5mbz4oKSB7XG5cdFx0b3ZlcnJpZGUgcmVhZG9ubHkgZXh0VXJpID0gZXh0VXJpO1xuXHR9O1xuXG5cdGNvbnN0IHZlcnNpb25Qcm92aWRlciA9ICh1cmk6IFVSSSk6IG51bWJlciB8IHVuZGVmaW5lZCA9PiB7XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fTtcblxuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHRlc3QoJ2Rpc3Bvc2VDaGVjaycsICgpID0+IHtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ3Rlc3QnLCAndGVzdCcsIDEwMCwgMTAwLCB2ZXJzaW9uUHJvdmlkZXIsIGV4dFVyaSwgbmV3IERpYWdub3N0aWNzU2hhcGUoKSwgbmV3IEVtaXR0ZXIoKSk7XG5cblx0XHRjb2xsZWN0aW9uLmRpc3Bvc2UoKTtcblx0XHRjb2xsZWN0aW9uLmRpc3Bvc2UoKTsgLy8gdGhhdCdzIE9LXG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBjb2xsZWN0aW9uLm5hbWUpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gY29sbGVjdGlvbi5jbGVhcigpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGNvbGxlY3Rpb24uZGVsZXRlKFVSSS5wYXJzZSgnYWE6YmInKSkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gY29sbGVjdGlvbi5mb3JFYWNoKCgpID0+IHsgfSkpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gY29sbGVjdGlvbi5nZXQoVVJJLnBhcnNlKCdhYTpiYicpKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBjb2xsZWN0aW9uLmhhcyhVUkkucGFyc2UoJ2FhOmJiJykpKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnYWE6YmInKSwgW10pKTtcblx0XHRhc3NlcnQudGhyb3dzKCgpID0+IGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnYWE6YmInKSwgdW5kZWZpbmVkISkpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2RpYWdub3N0aWMgY29sbGVjdGlvbiwgZm9yRWFjaCwgY2xlYXIsIGhhcycsIGZ1bmN0aW9uICgpIHtcblx0XHRsZXQgY29sbGVjdGlvbiA9IG5ldyBEaWFnbm9zdGljQ29sbGVjdGlvbigndGVzdCcsICd0ZXN0JywgMTAwLCAxMDAsIHZlcnNpb25Qcm92aWRlciwgZXh0VXJpLCBuZXcgRGlhZ25vc3RpY3NTaGFwZSgpLCBuZXcgRW1pdHRlcigpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sbGVjdGlvbi5uYW1lLCAndGVzdCcpO1xuXHRcdGNvbGxlY3Rpb24uZGlzcG9zZSgpO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gY29sbGVjdGlvbi5uYW1lKTtcblxuXHRcdGxldCBjID0gMDtcblx0XHRjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBEaWFnbm9zdGljc1NoYXBlKCksIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbGxlY3Rpb24uZm9yRWFjaCgoKSA9PiBjKyspO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjLCAwKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnZm9vOmJhcicpLCBbXG5cdFx0XHRuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdtZXNzYWdlLTEnKSxcblx0XHRcdG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ21lc3NhZ2UtMicpXG5cdFx0XSk7XG5cdFx0Y29sbGVjdGlvbi5mb3JFYWNoKCgpID0+IGMrKyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGMsIDEpO1xuXG5cdFx0YyA9IDA7XG5cdFx0Y29sbGVjdGlvbi5jbGVhcigpO1xuXHRcdGNvbGxlY3Rpb24uZm9yRWFjaCgoKSA9PiBjKyspO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjLCAwKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnZm9vOmJhcjEnKSwgW1xuXHRcdFx0bmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDEsIDEpLCAnbWVzc2FnZS0xJyksXG5cdFx0XHRuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdtZXNzYWdlLTInKVxuXHRcdF0pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnZm9vOmJhcjInKSwgW1xuXHRcdFx0bmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDEsIDEpLCAnbWVzc2FnZS0xJyksXG5cdFx0XHRuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdtZXNzYWdlLTInKVxuXHRcdF0pO1xuXHRcdGNvbGxlY3Rpb24uZm9yRWFjaCgoKSA9PiBjKyspO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjLCAyKTtcblxuXHRcdGFzc2VydC5vayhjb2xsZWN0aW9uLmhhcyhVUkkucGFyc2UoJ2ZvbzpiYXIxJykpKTtcblx0XHRhc3NlcnQub2soY29sbGVjdGlvbi5oYXMoVVJJLnBhcnNlKCdmb286YmFyMicpKSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb2xsZWN0aW9uLmhhcyhVUkkucGFyc2UoJ2ZvbzpiYXIzJykpKTtcblx0XHRjb2xsZWN0aW9uLmRlbGV0ZShVUkkucGFyc2UoJ2ZvbzpiYXIxJykpO1xuXHRcdGFzc2VydC5vayghY29sbGVjdGlvbi5oYXMoVVJJLnBhcnNlKCdmb286YmFyMScpKSk7XG5cblx0XHRjb2xsZWN0aW9uLmRpc3Bvc2UoKTtcblx0fSk7XG5cblx0dGVzdCgnZGlhZ25vc3RpYyBjb2xsZWN0aW9uLCBpbW11dGFibGUgcmVhZCcsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBEaWFnbm9zdGljc1NoYXBlKCksIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnZm9vOmJhcicpLCBbXG5cdFx0XHRuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdtZXNzYWdlLTEnKSxcblx0XHRcdG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ21lc3NhZ2UtMicpXG5cdFx0XSk7XG5cblx0XHRsZXQgYXJyYXkgPSBjb2xsZWN0aW9uLmdldChVUkkucGFyc2UoJ2ZvbzpiYXInKSkgYXMgRGlhZ25vc3RpY1tdO1xuXHRcdGFzc2VydC50aHJvd3MoKCkgPT4gYXJyYXkubGVuZ3RoID0gMCk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBhcnJheS5wb3AoKSk7XG5cdFx0YXNzZXJ0LnRocm93cygoKSA9PiBhcnJheVswXSA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAwKSwgJ2V2aWwnKSk7XG5cblx0XHRjb2xsZWN0aW9uLmZvckVhY2goKHVyaTogVVJJLCBhcnJheTogcmVhZG9ubHkgdnNjb2RlLkRpYWdub3N0aWNbXSk6IGFueSA9PiB7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IChhcnJheSBhcyBEaWFnbm9zdGljW10pLmxlbmd0aCA9IDApO1xuXHRcdFx0YXNzZXJ0LnRocm93cygoKSA9PiAoYXJyYXkgYXMgRGlhZ25vc3RpY1tdKS5wb3AoKSk7XG5cdFx0XHRhc3NlcnQudGhyb3dzKCgpID0+IChhcnJheSBhcyBEaWFnbm9zdGljW10pWzBdID0gbmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDAsIDApLCAnZXZpbCcpKTtcblx0XHR9KTtcblxuXHRcdGFycmF5ID0gY29sbGVjdGlvbi5nZXQoVVJJLnBhcnNlKCdmb286YmFyJykpIGFzIERpYWdub3N0aWNbXTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXJyYXkubGVuZ3RoLCAyKTtcblxuXHRcdGNvbGxlY3Rpb24uZGlzcG9zZSgpO1xuXHR9KTtcblxuXG5cdHRlc3QoJ2RpYWdub3N0aWNzIGNvbGxlY3Rpb24sIHNldCB3aXRoIGR1cGxpY2xhdGVkIHR1cGxlcycsIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBEaWFnbm9zdGljc1NoYXBlKCksIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyJyk7XG5cdFx0Y29sbGVjdGlvbi5zZXQoW1xuXHRcdFx0W3VyaSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAxKSwgJ21lc3NhZ2UtMScpXV0sXG5cdFx0XHRbVVJJLnBhcnNlKCdzb21lOnRoaW5nJyksIFtuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdzb21ldGhpbmcnKV1dLFxuXHRcdFx0W3VyaSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAxKSwgJ21lc3NhZ2UtMicpXV0sXG5cdFx0XSk7XG5cblx0XHRsZXQgYXJyYXkgPSBjb2xsZWN0aW9uLmdldCh1cmkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhcnJheS5sZW5ndGgsIDIpO1xuXHRcdGxldCBbZmlyc3QsIHNlY29uZF0gPSBhcnJheTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZmlyc3QubWVzc2FnZSwgJ21lc3NhZ2UtMScpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZWNvbmQubWVzc2FnZSwgJ21lc3NhZ2UtMicpO1xuXG5cdFx0Ly8gY2xlYXJcblx0XHRjb2xsZWN0aW9uLmRlbGV0ZSh1cmkpO1xuXHRcdGFzc2VydC5vayghY29sbGVjdGlvbi5oYXModXJpKSk7XG5cblx0XHQvLyBiYWQgdHVwbGUgY2xlYXJzIDEvMlxuXHRcdGNvbGxlY3Rpb24uc2V0KFtcblx0XHRcdFt1cmksIFtuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMCwgMSksICdtZXNzYWdlLTEnKV1dLFxuXHRcdFx0W1VSSS5wYXJzZSgnc29tZTp0aGluZycpLCBbbmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDEsIDEpLCAnc29tZXRoaW5nJyldXSxcblx0XHRcdFt1cmksIHVuZGVmaW5lZCFdXG5cdFx0XSk7XG5cdFx0YXNzZXJ0Lm9rKCFjb2xsZWN0aW9uLmhhcyh1cmkpKTtcblxuXHRcdC8vIGNsZWFyXG5cdFx0Y29sbGVjdGlvbi5kZWxldGUodXJpKTtcblx0XHRhc3NlcnQub2soIWNvbGxlY3Rpb24uaGFzKHVyaSkpO1xuXG5cdFx0Ly8gYmFkIHR1cGxlIGNsZWFycyAyLzJcblx0XHRjb2xsZWN0aW9uLnNldChbXG5cdFx0XHRbdXJpLCBbbmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDAsIDEpLCAnbWVzc2FnZS0xJyldXSxcblx0XHRcdFtVUkkucGFyc2UoJ3NvbWU6dGhpbmcnKSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ3NvbWV0aGluZycpXV0sXG5cdFx0XHRbdXJpLCB1bmRlZmluZWQhXSxcblx0XHRcdFt1cmksIFtuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMCwgMSksICdtZXNzYWdlLTInKV1dLFxuXHRcdFx0W3VyaSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAxKSwgJ21lc3NhZ2UtMycpXV0sXG5cdFx0XSk7XG5cblx0XHRhcnJheSA9IGNvbGxlY3Rpb24uZ2V0KHVyaSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFycmF5Lmxlbmd0aCwgMik7XG5cdFx0W2ZpcnN0LCBzZWNvbmRdID0gYXJyYXk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZpcnN0Lm1lc3NhZ2UsICdtZXNzYWdlLTInKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2Vjb25kLm1lc3NhZ2UsICdtZXNzYWdlLTMnKTtcblxuXHRcdGNvbGxlY3Rpb24uZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCdkaWFnbm9zdGljcyBjb2xsZWN0aW9uLCBzZXQgdHVwbGUgb3ZlcnJpZGVzLCAjMTE1NDcnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgbGFzdEVudHJpZXMhOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXTtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBjbGFzcyBleHRlbmRzIERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0b3ZlcnJpZGUgJGNoYW5nZU1hbnkob3duZXI6IHN0cmluZywgZW50cmllczogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW10pOiB2b2lkIHtcblx0XHRcdFx0bGFzdEVudHJpZXMgPSBlbnRyaWVzO1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuJGNoYW5nZU1hbnkob3duZXIsIGVudHJpZXMpO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyJyk7XG5cblx0XHRjb2xsZWN0aW9uLnNldChbW3VyaSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ2Vycm9yJyldXV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmdldCh1cmkpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uZ2V0KHVyaSlbMF0ubWVzc2FnZSwgJ2Vycm9yJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFbnRyaWVzLmxlbmd0aCwgMSk7XG5cdFx0Y29uc3QgW1ssIGRhdGExXV0gPSBsYXN0RW50cmllcztcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YTEubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGF0YTFbMF0ubWVzc2FnZSwgJ2Vycm9yJyk7XG5cdFx0bGFzdEVudHJpZXMgPSB1bmRlZmluZWQhO1xuXG5cdFx0Y29sbGVjdGlvbi5zZXQoW1t1cmksIFtuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICd3YXJuaW5nJyldXV0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmdldCh1cmkpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uZ2V0KHVyaSlbMF0ubWVzc2FnZSwgJ3dhcm5pbmcnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwobGFzdEVudHJpZXMubGVuZ3RoLCAxKTtcblx0XHRjb25zdCBbWywgZGF0YTJdXSA9IGxhc3RFbnRyaWVzO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhMi5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhMlswXS5tZXNzYWdlLCAnd2FybmluZycpO1xuXHRcdGxhc3RFbnRyaWVzID0gdW5kZWZpbmVkITtcblx0fSk7XG5cblx0dGVzdCgnZG8gc2VuZCBtZXNzYWdlIHdoZW4gbm90IG1ha2luZyBhIGNoYW5nZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGxldCBjaGFuZ2VDb3VudCA9IDA7XG5cdFx0bGV0IGV2ZW50Q291bnQgPSAwO1xuXG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPGFueT4oKTtcblx0XHRzdG9yZS5hZGQoZW1pdHRlci5ldmVudChfID0+IGV2ZW50Q291bnQgKz0gMSkpO1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ3Rlc3QnLCAndGVzdCcsIDEwMCwgMTAwLCB2ZXJzaW9uUHJvdmlkZXIsIGV4dFVyaSwgbmV3IGNsYXNzIGV4dGVuZHMgRGlhZ25vc3RpY3NTaGFwZSB7XG5cdFx0XHRvdmVycmlkZSAkY2hhbmdlTWFueSgpIHtcblx0XHRcdFx0Y2hhbmdlQ291bnQgKz0gMTtcblx0XHRcdH1cblx0XHR9LCBlbWl0dGVyKTtcblxuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyJyk7XG5cdFx0Y29uc3QgZGlhZyA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAxKSwgJ2ZmZmYnKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KHVyaSwgW2RpYWddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlQ291bnQsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAxKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KHVyaSwgW2RpYWddKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlQ291bnQsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudENvdW50LCAyKTtcblxuXHR9KTtcblxuXHR0ZXN0KCdkaWFnbm9zdGljcyBjb2xsZWN0aW9uLCB0dXBsZXMgYW5kIHVuZGVmaW5lZCAoc21hbGwgYXJyYXkpLCAjMTU1ODUnLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBEaWFnbm9zdGljc1NoYXBlKCksIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyJyk7XG5cdFx0Y29uc3QgdXJpMiA9IFVSSS5wYXJzZSgnc2M6bm9tYWQnKTtcblx0XHRjb25zdCBkaWFnID0gbmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDAsIDAsIDAsIDEpLCAnZmZmZicpO1xuXG5cdFx0Y29sbGVjdGlvbi5zZXQoW1xuXHRcdFx0W3VyaSwgW2RpYWcsIGRpYWcsIGRpYWddXSxcblx0XHRcdFt1cmksIHVuZGVmaW5lZCFdLFxuXHRcdFx0W3VyaSwgW2RpYWddXSxcblxuXHRcdFx0W3VyaTIsIFtkaWFnLCBkaWFnXV0sXG5cdFx0XHRbdXJpMiwgdW5kZWZpbmVkIV0sXG5cdFx0XHRbdXJpMiwgW2RpYWddXSxcblx0XHRdKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmdldCh1cmkpLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uZ2V0KHVyaTIpLmxlbmd0aCwgMSk7XG5cdH0pO1xuXG5cdHRlc3QoJ2RpYWdub3N0aWNzIGNvbGxlY3Rpb24sIHR1cGxlcyBhbmQgdW5kZWZpbmVkIChsYXJnZSBhcnJheSksICMxNTU4NScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ3Rlc3QnLCAndGVzdCcsIDEwMCwgMTAwLCB2ZXJzaW9uUHJvdmlkZXIsIGV4dFVyaSwgbmV3IERpYWdub3N0aWNzU2hhcGUoKSwgbmV3IEVtaXR0ZXIoKSk7XG5cdFx0Y29uc3QgdHVwbGVzOiBbVVJJLCBEaWFnbm9zdGljW11dW10gPSBbXTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNTAwOyBpKyspIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyIycgKyBpKTtcblx0XHRcdGNvbnN0IGRpYWcgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMCwgMSksIGkudG9TdHJpbmcoKSk7XG5cblx0XHRcdHR1cGxlcy5wdXNoKFt1cmksIFtkaWFnLCBkaWFnLCBkaWFnXV0pO1xuXHRcdFx0dHVwbGVzLnB1c2goW3VyaSwgdW5kZWZpbmVkIV0pO1xuXHRcdFx0dHVwbGVzLnB1c2goW3VyaSwgW2RpYWddXSk7XG5cdFx0fVxuXG5cdFx0Y29sbGVjdGlvbi5zZXQodHVwbGVzKTtcblxuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgNTAwOyBpKyspIHtcblx0XHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnc2M6aGlnaHRvd2VyIycgKyBpKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmhhcyh1cmkpLCB0cnVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChjb2xsZWN0aW9uLmdldCh1cmkpLmxlbmd0aCwgMSk7XG5cdFx0fVxuXHR9KTtcblxuXHR0ZXN0KCdkaWFnbm9zdGljIGNhcHBpbmcgKG1heCBwZXIgZmlsZSknLCBmdW5jdGlvbiAoKSB7XG5cblx0XHRsZXQgbGFzdEVudHJpZXMhOiBbVXJpQ29tcG9uZW50cywgSU1hcmtlckRhdGFbXV1bXTtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCd0ZXN0JywgJ3Rlc3QnLCAxMDAsIDI1MCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBjbGFzcyBleHRlbmRzIERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0b3ZlcnJpZGUgJGNoYW5nZU1hbnkob3duZXI6IHN0cmluZywgZW50cmllczogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW10pOiB2b2lkIHtcblx0XHRcdFx0bGFzdEVudHJpZXMgPSBlbnRyaWVzO1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuJGNoYW5nZU1hbnkob3duZXIsIGVudHJpZXMpO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBFbWl0dGVyKCkpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5wYXJzZSgnYWE6YmInKTtcblxuXHRcdGNvbnN0IGRpYWdub3N0aWNzOiBEaWFnbm9zdGljW10gPSBbXTtcblx0XHRmb3IgKGxldCBpID0gMDsgaSA8IDUwMDsgaSsrKSB7XG5cdFx0XHRkaWFnbm9zdGljcy5wdXNoKG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZShpLCAwLCBpICsgMSwgMCksIGBlcnJvciMke2l9YCwgaSA8IDMwMFxuXHRcdFx0XHQ/IERpYWdub3N0aWNTZXZlcml0eS5XYXJuaW5nXG5cdFx0XHRcdDogRGlhZ25vc3RpY1NldmVyaXR5LkVycm9yKSk7XG5cdFx0fVxuXG5cdFx0Y29sbGVjdGlvbi5zZXQodXJpLCBkaWFnbm9zdGljcyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbGxlY3Rpb24uZ2V0KHVyaSkubGVuZ3RoLCA1MDApO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0RW50cmllcy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0RW50cmllc1swXVsxXS5sZW5ndGgsIDI1MSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFbnRyaWVzWzBdWzFdWzBdLnNldmVyaXR5LCBNYXJrZXJTZXZlcml0eS5FcnJvcik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGxhc3RFbnRyaWVzWzBdWzFdWzIwMF0uc2V2ZXJpdHksIE1hcmtlclNldmVyaXR5Lldhcm5pbmcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0RW50cmllc1swXVsxXVsyNTBdLnNldmVyaXR5LCBNYXJrZXJTZXZlcml0eS5JbmZvKTtcblx0fSk7XG5cblx0dGVzdCgnZGlhZ25vc3RpYyBjYXBwaW5nIChtYXggZmlsZXMpJywgZnVuY3Rpb24gKCkge1xuXG5cdFx0bGV0IGxhc3RFbnRyaWVzITogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW107XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBEaWFnbm9zdGljQ29sbGVjdGlvbigndGVzdCcsICd0ZXN0JywgMiwgMSwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBjbGFzcyBleHRlbmRzIERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0b3ZlcnJpZGUgJGNoYW5nZU1hbnkob3duZXI6IHN0cmluZywgZW50cmllczogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW10pOiB2b2lkIHtcblx0XHRcdFx0bGFzdEVudHJpZXMgPSBlbnRyaWVzO1xuXHRcdFx0XHRyZXR1cm4gc3VwZXIuJGNoYW5nZU1hbnkob3duZXIsIGVudHJpZXMpO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBFbWl0dGVyKCkpO1xuXG5cdFx0Y29uc3QgZGlhZyA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ0hlbGxvJyk7XG5cblxuXHRcdGNvbGxlY3Rpb24uc2V0KFtcblx0XHRcdFtVUkkucGFyc2UoJ2FhOmJiMScpLCBbZGlhZ11dLFxuXHRcdFx0W1VSSS5wYXJzZSgnYWE6YmIyJyksIFtkaWFnXV0sXG5cdFx0XHRbVVJJLnBhcnNlKCdhYTpiYjMnKSwgW2RpYWddXSxcblx0XHRcdFtVUkkucGFyc2UoJ2FhOmJiNCcpLCBbZGlhZ11dLFxuXHRcdF0pO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChsYXN0RW50cmllcy5sZW5ndGgsIDMpOyAvLyBnb2VzIGFib3ZlIHRoZSBsaW1pdCBhbmQgdGhlbiBzdG9wc1xuXHR9KTtcblxuXHR0ZXN0KCdkaWFnbm9zdGljIGV2ZW50aW5nJywgYXN5bmMgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IGVtaXR0ZXIgPSBuZXcgRW1pdHRlcjxyZWFkb25seSBVUklbXT4oKTtcblx0XHRjb25zdCBjb2xsZWN0aW9uID0gbmV3IERpYWdub3N0aWNDb2xsZWN0aW9uKCdkZGQnLCAndGVzdCcsIDEwMCwgMTAwLCB2ZXJzaW9uUHJvdmlkZXIsIGV4dFVyaSwgbmV3IERpYWdub3N0aWNzU2hhcGUoKSwgZW1pdHRlcik7XG5cblx0XHRjb25zdCBkaWFnMSA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgxLCAxLCAyLCAzKSwgJ2RpYWcxJyk7XG5cdFx0Y29uc3QgZGlhZzIgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMSwgMSwgMiwgMyksICdkaWFnMicpO1xuXHRcdGNvbnN0IGRpYWczID0gbmV3IERpYWdub3N0aWMobmV3IFJhbmdlKDEsIDEsIDIsIDMpLCAnZGlhZzMnKTtcblxuXHRcdGxldCBwID0gRXZlbnQudG9Qcm9taXNlKGVtaXR0ZXIuZXZlbnQpLnRoZW4oYSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYS5sZW5ndGgsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGFbMF0udG9TdHJpbmcoKSwgJ2FhOmJiJyk7XG5cdFx0XHRhc3NlcnQub2soVVJJLmlzVXJpKGFbMF0pKTtcblx0XHR9KTtcblx0XHRjb2xsZWN0aW9uLnNldChVUkkucGFyc2UoJ2FhOmJiJyksIFtdKTtcblx0XHRhd2FpdCBwO1xuXG5cdFx0cCA9IEV2ZW50LnRvUHJvbWlzZShlbWl0dGVyLmV2ZW50KS50aGVuKGUgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGUubGVuZ3RoLCAyKTtcblx0XHRcdGFzc2VydC5vayhVUkkuaXNVcmkoZVswXSkpO1xuXHRcdFx0YXNzZXJ0Lm9rKFVSSS5pc1VyaShlWzFdKSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZVswXS50b1N0cmluZygpLCAnYWE6YmInKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlWzFdLnRvU3RyaW5nKCksICdhYTpjYycpO1xuXHRcdH0pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KFtcblx0XHRcdFtVUkkucGFyc2UoJ2FhOmJiJyksIFtkaWFnMV1dLFxuXHRcdFx0W1VSSS5wYXJzZSgnYWE6Y2MnKSwgW2RpYWcyLCBkaWFnM11dLFxuXHRcdF0pO1xuXHRcdGF3YWl0IHA7XG5cblx0XHRwID0gRXZlbnQudG9Qcm9taXNlKGVtaXR0ZXIuZXZlbnQpLnRoZW4oZSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZS5sZW5ndGgsIDIpO1xuXHRcdFx0YXNzZXJ0Lm9rKFVSSS5pc1VyaShlWzBdKSk7XG5cdFx0XHRhc3NlcnQub2soVVJJLmlzVXJpKGVbMV0pKTtcblx0XHR9KTtcblx0XHRjb2xsZWN0aW9uLmNsZWFyKCk7XG5cdFx0YXdhaXQgcDtcblx0fSk7XG5cblx0dGVzdCgndnNjb2RlLmxhbmd1YWdlcy5vbkRpZENoYW5nZURpYWdub3N0aWNzIERvZXMgTm90IFByb3ZpZGUgRG9jdW1lbnQgVVJJICM0OTU4MicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCBlbWl0dGVyID0gbmV3IEVtaXR0ZXI8cmVhZG9ubHkgVVJJW10+KCk7XG5cdFx0Y29uc3QgY29sbGVjdGlvbiA9IG5ldyBEaWFnbm9zdGljQ29sbGVjdGlvbignZGRkJywgJ3Rlc3QnLCAxMDAsIDEwMCwgdmVyc2lvblByb3ZpZGVyLCBleHRVcmksIG5ldyBEaWFnbm9zdGljc1NoYXBlKCksIGVtaXR0ZXIpO1xuXG5cdFx0Y29uc3QgZGlhZzEgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMSwgMSwgMiwgMyksICdkaWFnMScpO1xuXG5cdFx0Ly8gZGVsZXRlXG5cdFx0Y29sbGVjdGlvbi5zZXQoVVJJLnBhcnNlKCdhYTpiYicpLCBbZGlhZzFdKTtcblx0XHRsZXQgcCA9IEV2ZW50LnRvUHJvbWlzZShlbWl0dGVyLmV2ZW50KS50aGVuKGUgPT4ge1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGVbMF0udG9TdHJpbmcoKSwgJ2FhOmJiJyk7XG5cdFx0fSk7XG5cdFx0Y29sbGVjdGlvbi5kZWxldGUoVVJJLnBhcnNlKCdhYTpiYicpKTtcblx0XHRhd2FpdCBwO1xuXG5cdFx0Ly8gc2V0LT51bmRlZmluZWQgKGFzIGRlbGV0ZSlcblx0XHRjb2xsZWN0aW9uLnNldChVUkkucGFyc2UoJ2FhOmJiJyksIFtkaWFnMV0pO1xuXHRcdHAgPSBFdmVudC50b1Byb21pc2UoZW1pdHRlci5ldmVudCkudGhlbihlID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlWzBdLnRvU3RyaW5nKCksICdhYTpiYicpO1xuXHRcdH0pO1xuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgnYWE6YmInKSwgdW5kZWZpbmVkISk7XG5cdFx0YXdhaXQgcDtcblx0fSk7XG5cblx0dGVzdCgnZGlhZ25vc3RpY3Mgd2l0aCByZWxhdGVkIGluZm9ybWF0aW9uJywgZnVuY3Rpb24gKGRvbmUpIHtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ2RkZCcsICd0ZXN0JywgMTAwLCAxMDAsIHZlcnNpb25Qcm92aWRlciwgZXh0VXJpLCBuZXcgY2xhc3MgZXh0ZW5kcyBEaWFnbm9zdGljc1NoYXBlIHtcblx0XHRcdG92ZXJyaWRlICRjaGFuZ2VNYW55KG93bmVyOiBzdHJpbmcsIGVudHJpZXM6IFtVcmlDb21wb25lbnRzLCBJTWFya2VyRGF0YVtdXVtdKSB7XG5cblx0XHRcdFx0Y29uc3QgW1ssIGRhdGFdXSA9IGVudHJpZXM7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChlbnRyaWVzLmxlbmd0aCwgMSk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChkYXRhLmxlbmd0aCwgMSk7XG5cblx0XHRcdFx0Y29uc3QgW2RpYWddID0gZGF0YTtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpYWcucmVsYXRlZEluZm9ybWF0aW9uIS5sZW5ndGgsIDIpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZy5yZWxhdGVkSW5mb3JtYXRpb24hWzBdLm1lc3NhZ2UsICdtb3JlMScpO1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZy5yZWxhdGVkSW5mb3JtYXRpb24hWzFdLm1lc3NhZ2UsICdtb3JlMicpO1xuXHRcdFx0XHRkb25lKCk7XG5cdFx0XHR9XG5cdFx0fSwgbmV3IEVtaXR0ZXI8YW55PigpKTtcblxuXHRcdGNvbnN0IGRpYWcgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdGb28nKTtcblx0XHRkaWFnLnJlbGF0ZWRJbmZvcm1hdGlvbiA9IFtcblx0XHRcdG5ldyBEaWFnbm9zdGljUmVsYXRlZEluZm9ybWF0aW9uKG5ldyBMb2NhdGlvbihVUkkucGFyc2UoJ2NjOmRkJyksIG5ldyBSYW5nZSgwLCAwLCAwLCAwKSksICdtb3JlMScpLFxuXHRcdFx0bmV3IERpYWdub3N0aWNSZWxhdGVkSW5mb3JtYXRpb24obmV3IExvY2F0aW9uKFVSSS5wYXJzZSgnY2M6ZWUnKSwgbmV3IFJhbmdlKDAsIDAsIDAsIDApKSwgJ21vcmUyJylcblx0XHRdO1xuXG5cdFx0Y29sbGVjdGlvbi5zZXQoVVJJLnBhcnNlKCdhYTpiYicpLCBbZGlhZ10pO1xuXHR9KTtcblxuXHR0ZXN0KCd2c2NvZGUubGFuZ3VhZ2VzLmdldERpYWdub3N0aWNzIGFwcGVhcnMgdG8gcmV0dXJuIG9sZCBkaWFnbm9zdGljcyBpbiBzb21lIGNpcmN1bXN0YW5jZXMgIzU0MzU5JywgZnVuY3Rpb24gKCkge1xuXHRcdGNvbnN0IG93bmVySGlzdG9yeTogc3RyaW5nW10gPSBbXTtcblx0XHRjb25zdCBkaWFncyA9IG5ldyBFeHRIb3N0RGlhZ25vc3RpY3MobmV3IGNsYXNzIGltcGxlbWVudHMgSU1haW5Db250ZXh0IHtcblx0XHRcdGdldFByb3h5KGlkOiBhbnkpOiBhbnkge1xuXHRcdFx0XHRyZXR1cm4gbmV3IGNsYXNzIERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0XHRcdCRjbGVhcihvd25lcjogc3RyaW5nKTogdm9pZCB7XG5cdFx0XHRcdFx0XHRvd25lckhpc3RvcnkucHVzaChvd25lcik7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXHRcdFx0c2V0KCk6IGFueSB7XG5cdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0fVxuXHRcdFx0ZGlzcG9zZSgpIHsgfVxuXHRcdFx0YXNzZXJ0UmVnaXN0ZXJlZCgpOiB2b2lkIHtcblxuXHRcdFx0fVxuXHRcdFx0ZHJhaW4oKSB7XG5cdFx0XHRcdHJldHVybiB1bmRlZmluZWQhO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBOdWxsTG9nU2VydmljZSgpLCBmaWxlU3lzdGVtSW5mb1NlcnZpY2UsIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzPigpIHtcblx0XHRcdG92ZXJyaWRlIGdldERvY3VtZW50KCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29sbGVjdGlvbjEgPSBkaWFncy5jcmVhdGVEaWFnbm9zdGljQ29sbGVjdGlvbihudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllciwgJ2ZvbycpO1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24yID0gZGlhZ3MuY3JlYXRlRGlhZ25vc3RpY0NvbGxlY3Rpb24obnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsICdmb28nKTsgLy8gd2FybnMsIHVzZXMgYSBkaWZmZXJlbnQgb3duZXJcblxuXHRcdGNvbGxlY3Rpb24xLmNsZWFyKCk7XG5cdFx0Y29sbGVjdGlvbjIuY2xlYXIoKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChvd25lckhpc3RvcnkubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwob3duZXJIaXN0b3J5WzBdLCAnZm9vJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKG93bmVySGlzdG9yeVsxXSwgJ2ZvbzAnKTtcblx0fSk7XG5cblx0dGVzdCgnRXJyb3IgdXBkYXRpbmcgZGlhZ25vc3RpY3MgZnJvbSBleHRlbnNpb24gIzYwMzk0JywgZnVuY3Rpb24gKCkge1xuXHRcdGxldCBjYWxsQ291bnQgPSAwO1xuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ2RkZCcsICd0ZXN0JywgMTAwLCAxMDAsIHZlcnNpb25Qcm92aWRlciwgZXh0VXJpLCBuZXcgY2xhc3MgZXh0ZW5kcyBEaWFnbm9zdGljc1NoYXBlIHtcblx0XHRcdG92ZXJyaWRlICRjaGFuZ2VNYW55KG93bmVyOiBzdHJpbmcsIGVudHJpZXM6IFtVcmlDb21wb25lbnRzLCBJTWFya2VyRGF0YVtdXVtdKSB7XG5cdFx0XHRcdGNhbGxDb3VudCArPSAxO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBFbWl0dGVyPGFueT4oKSk7XG5cblx0XHRjb25zdCBhcnJheTogRGlhZ25vc3RpY1tdID0gW107XG5cdFx0Y29uc3QgZGlhZzEgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdGb28nKTtcblx0XHRjb25zdCBkaWFnMiA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ0JhcicpO1xuXG5cdFx0YXJyYXkucHVzaChkaWFnMSwgZGlhZzIpO1xuXG5cdFx0Y29sbGVjdGlvbi5zZXQoVVJJLnBhcnNlKCd0ZXN0Om1lJyksIGFycmF5KTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50LCAxKTtcblxuXHRcdGNvbGxlY3Rpb24uc2V0KFVSSS5wYXJzZSgndGVzdDptZScpLCBhcnJheSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhbGxDb3VudCwgMik7IC8vIGVxdWFsIGFycmF5XG5cblx0XHRhcnJheS5wdXNoKGRpYWcyKTtcblx0XHRjb2xsZWN0aW9uLnNldChVUkkucGFyc2UoJ3Rlc3Q6bWUnKSwgYXJyYXkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYWxsQ291bnQsIDMpOyAvLyBzYW1lIGJ1dCB1bi1lcXVhbCBhcnJheVxuXHR9KTtcblxuXHR0ZXN0KCdWZXJzaW9uIGlkIGlzIHNldCB3aGVuZXZlciBwb3NzaWJsZScsIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IGFsbDogW1VyaUNvbXBvbmVudHMsIElNYXJrZXJEYXRhW11dW10gPSBbXTtcblxuXHRcdGNvbnN0IGNvbGxlY3Rpb24gPSBuZXcgRGlhZ25vc3RpY0NvbGxlY3Rpb24oJ2RkZCcsICd0ZXN0JywgMTAwLCAxMDAsIHVyaSA9PiB7XG5cdFx0XHRyZXR1cm4gNztcblx0XHR9LCBleHRVcmksIG5ldyBjbGFzcyBleHRlbmRzIERpYWdub3N0aWNzU2hhcGUge1xuXHRcdFx0b3ZlcnJpZGUgJGNoYW5nZU1hbnkoX293bmVyOiBzdHJpbmcsIGVudHJpZXM6IFtVcmlDb21wb25lbnRzLCBJTWFya2VyRGF0YVtdXVtdKSB7XG5cdFx0XHRcdGFsbC5wdXNoKC4uLmVudHJpZXMpO1xuXHRcdFx0fVxuXHRcdH0sIG5ldyBFbWl0dGVyPGFueT4oKSk7XG5cblx0XHRjb25zdCBhcnJheTogRGlhZ25vc3RpY1tdID0gW107XG5cdFx0Y29uc3QgZGlhZzEgPSBuZXcgRGlhZ25vc3RpYyhuZXcgUmFuZ2UoMCwgMCwgMSwgMSksICdGb28nKTtcblx0XHRjb25zdCBkaWFnMiA9IG5ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAxLCAxKSwgJ0JhcicpO1xuXG5cdFx0YXJyYXkucHVzaChkaWFnMSwgZGlhZzIpO1xuXG5cdFx0Y29sbGVjdGlvbi5zZXQoVVJJLnBhcnNlKCd0ZXN0Om9uZScpLCBhcnJheSk7XG5cdFx0Y29sbGVjdGlvbi5zZXQoVVJJLnBhcnNlKCd0ZXN0OnR3bycpLCBbZGlhZzFdKTtcblx0XHRjb2xsZWN0aW9uLnNldChVUkkucGFyc2UoJ3Rlc3Q6dGhyZWUnKSwgW2RpYWcyXSk7XG5cblx0XHRjb25zdCBhbGxWZXJzaW9ucyA9IGFsbC5tYXAodHVwbGUgPT4gdHVwbGVbMV0ubWFwKHQgPT4gdC5tb2RlbFZlcnNpb25JZCkpLmZsYXQoKTtcblx0XHRhc3NlcnQuZGVlcFN0cmljdEVxdWFsKGFsbFZlcnNpb25zLCBbNywgNywgNywgN10pO1xuXHR9KTtcblxuXHR0ZXN0KCdEaWFnbm9zdGljcyBjcmVhdGVkIGJ5IHRhc2tzIGFyZW5cXCd0IGFjY2Vzc2libGUgdG8gZXh0ZW5zaW9ucyAjNDcyOTInLCBhc3luYyBmdW5jdGlvbiAoKSB7XG5cdFx0cmV0dXJuIHJ1bldpdGhGYWtlZFRpbWVycyh7fSwgYXN5bmMgZnVuY3Rpb24gKCkge1xuXG5cdFx0XHRjb25zdCBkaWFncyA9IG5ldyBFeHRIb3N0RGlhZ25vc3RpY3MobmV3IGNsYXNzIGltcGxlbWVudHMgSU1haW5Db250ZXh0IHtcblx0XHRcdFx0Z2V0UHJveHkoaWQ6IGFueSk6IGFueSB7XG5cdFx0XHRcdFx0cmV0dXJuIHt9O1xuXHRcdFx0XHR9XG5cdFx0XHRcdHNldCgpOiBhbnkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGRpc3Bvc2UoKSB7IH1cblx0XHRcdFx0YXNzZXJ0UmVnaXN0ZXJlZCgpOiB2b2lkIHtcblxuXHRcdFx0XHR9XG5cdFx0XHRcdGRyYWluKCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQhO1xuXHRcdFx0XHR9XG5cdFx0XHR9LCBuZXcgTnVsbExvZ1NlcnZpY2UoKSwgZmlsZVN5c3RlbUluZm9TZXJ2aWNlLCBuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElFeHRIb3N0RG9jdW1lbnRzQW5kRWRpdG9ycz4oKSB7XG5cdFx0XHRcdG92ZXJyaWRlIGdldERvY3VtZW50KCkge1xuXHRcdFx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXG5cblx0XHRcdC8vXG5cdFx0XHRjb25zdCB1cmkgPSBVUkkucGFyc2UoJ2ZvbzpiYXInKTtcblx0XHRcdGNvbnN0IGRhdGE6IElNYXJrZXJEYXRhW10gPSBbe1xuXHRcdFx0XHRtZXNzYWdlOiAnbWVzc2FnZScsXG5cdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogMSxcblx0XHRcdFx0c3RhcnRDb2x1bW46IDEsXG5cdFx0XHRcdGVuZExpbmVOdW1iZXI6IDEsXG5cdFx0XHRcdGVuZENvbHVtbjogMSxcblx0XHRcdFx0c2V2ZXJpdHk6IE1hcmtlclNldmVyaXR5LkluZm9cblx0XHRcdH1dO1xuXG5cdFx0XHRjb25zdCBwMSA9IEV2ZW50LnRvUHJvbWlzZShkaWFncy5vbkRpZENoYW5nZURpYWdub3N0aWNzKTtcblx0XHRcdGRpYWdzLiRhY2NlcHRNYXJrZXJzQ2hhbmdlKFtbdXJpLCBkYXRhXV0pO1xuXHRcdFx0YXdhaXQgcDE7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZ3MuZ2V0RGlhZ25vc3RpY3ModXJpKS5sZW5ndGgsIDEpO1xuXG5cdFx0XHRjb25zdCBwMiA9IEV2ZW50LnRvUHJvbWlzZShkaWFncy5vbkRpZENoYW5nZURpYWdub3N0aWNzKTtcblx0XHRcdGRpYWdzLiRhY2NlcHRNYXJrZXJzQ2hhbmdlKFtbdXJpLCBbXV1dKTtcblx0XHRcdGF3YWl0IHAyO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpYWdzLmdldERpYWdub3N0aWNzKHVyaSkubGVuZ3RoLCAwKTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnbGFuZ3VhZ2VzLmdldERpYWdub3N0aWNzIGRvZXNuXFwndCBoYW5kbGUgY2FzZSBpbnNlbnNpdGl2aXR5IGNvcnJlY3RseSAjMTI4MTk4JywgZnVuY3Rpb24gKCkge1xuXG5cdFx0Y29uc3QgZGlhZ3MgPSBuZXcgRXh0SG9zdERpYWdub3N0aWNzKG5ldyBjbGFzcyBpbXBsZW1lbnRzIElNYWluQ29udGV4dCB7XG5cdFx0XHRnZXRQcm94eShpZDogYW55KTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG5ldyBEaWFnbm9zdGljc1NoYXBlKCk7XG5cdFx0XHR9XG5cdFx0XHRzZXQoKTogYW55IHtcblx0XHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0XHR9XG5cdFx0XHRkaXNwb3NlKCkgeyB9XG5cdFx0XHRhc3NlcnRSZWdpc3RlcmVkKCk6IHZvaWQge1xuXG5cdFx0XHR9XG5cdFx0XHRkcmFpbigpIHtcblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZCE7XG5cdFx0XHR9XG5cdFx0fSwgbmV3IE51bGxMb2dTZXJ2aWNlKCksIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3RGaWxlU3lzdGVtSW5mbz4oKSB7XG5cblx0XHRcdG92ZXJyaWRlIHJlYWRvbmx5IGV4dFVyaSA9IG5ldyBFeHRVcmkodXJpID0+IHVyaS5zY2hlbWUgPT09ICdpbnNlbnNpdGl2ZScpO1xuXHRcdH0sIG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dEhvc3REb2N1bWVudHNBbmRFZGl0b3JzPigpIHtcblx0XHRcdG92ZXJyaWRlIGdldERvY3VtZW50KCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXHRcdH0pO1xuXG5cdFx0Y29uc3QgY29sID0gZGlhZ3MuY3JlYXRlRGlhZ25vc3RpY0NvbGxlY3Rpb24obnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIpO1xuXG5cdFx0Y29uc3QgdXJpU2Vuc2l0aXZlID0gVVJJLmZyb20oeyBzY2hlbWU6ICdmb28nLCBwYXRoOiAnL1NPTUUvcGF0aCcgfSk7XG5cdFx0Y29uc3QgdXJpU2Vuc2l0aXZlQ2FzZUIgPSB1cmlTZW5zaXRpdmUud2l0aCh7IHBhdGg6IHVyaVNlbnNpdGl2ZS5wYXRoLnRvVXBwZXJDYXNlKCkgfSk7XG5cblx0XHRjb25zdCB1cmlJblNlbnNpdGl2ZSA9IFVSSS5mcm9tKHsgc2NoZW1lOiAnaW5zZW5zaXRpdmUnLCBwYXRoOiAnL1NPTUUvcGF0aCcgfSk7XG5cdFx0Y29uc3QgdXJpSW5TZW5zaXRpdmVVcHBlciA9IHVyaUluU2Vuc2l0aXZlLndpdGgoeyBwYXRoOiB1cmlJblNlbnNpdGl2ZS5wYXRoLnRvVXBwZXJDYXNlKCkgfSk7XG5cblx0XHRjb2wuc2V0KHVyaVNlbnNpdGl2ZSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAwKSwgJ3NlbnNpdGl2ZScpXSk7XG5cdFx0Y29sLnNldCh1cmlJblNlbnNpdGl2ZSwgW25ldyBEaWFnbm9zdGljKG5ldyBSYW5nZSgwLCAwLCAwLCAwKSwgJ2luc2Vuc2l0aXZlJyldKTtcblxuXHRcdC8vIGNvbGxlY3Rpb24gaXRzZWxmIGhvbm91cnMgY2FzaW5nXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbC5nZXQodXJpU2Vuc2l0aXZlKT8ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sLmdldCh1cmlTZW5zaXRpdmVDYXNlQik/Lmxlbmd0aCwgMCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY29sLmdldCh1cmlJblNlbnNpdGl2ZSk/Lmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNvbC5nZXQodXJpSW5TZW5zaXRpdmVVcHBlcik/Lmxlbmd0aCwgMSk7XG5cblx0XHQvLyBsYW5ndWFnZXMuZ2V0RGlhZ25vc3RpY3MgaG9ub3VycyBjYXNpbmdcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZ3MuZ2V0RGlhZ25vc3RpY3ModXJpU2Vuc2l0aXZlKT8ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZ3MuZ2V0RGlhZ25vc3RpY3ModXJpU2Vuc2l0aXZlQ2FzZUIpPy5sZW5ndGgsIDApO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpYWdzLmdldERpYWdub3N0aWNzKHVyaUluU2Vuc2l0aXZlKT8ubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlhZ3MuZ2V0RGlhZ25vc3RpY3ModXJpSW5TZW5zaXRpdmVVcHBlcik/Lmxlbmd0aCwgMSk7XG5cblxuXHRcdGNvbnN0IGZyb21Gb3JFYWNoOiBVUklbXSA9IFtdO1xuXHRcdGNvbC5mb3JFYWNoKHVyaSA9PiBmcm9tRm9yRWFjaC5wdXNoKHVyaSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmcm9tRm9yRWFjaC5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChmcm9tRm9yRWFjaFswXS50b1N0cmluZygpLCB1cmlTZW5zaXRpdmUudG9TdHJpbmcoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGZyb21Gb3JFYWNoWzFdLnRvU3RyaW5nKCks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
