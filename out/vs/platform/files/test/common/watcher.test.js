import assert from "assert";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { isLinux, isWindows } from "../../../../base/common/platform.js";
import { isEqual } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { FileChangeFilter, FileChangesEvent, FileChangeType } from "../../common/files.js";
import { coalesceEvents, reviveFileChanges, parseWatcherPatterns, isFiltered } from "../../common/watcher.js";
class TestFileWatcher extends Disposable {
  constructor() {
    super();
    this._onDidFilesChange = this._register(new Emitter());
  }
  get onDidFilesChange() {
    return this._onDidFilesChange.event;
  }
  report(changes) {
    this.onRawFileEvents(changes);
  }
  onRawFileEvents(events) {
    const coalescedEvents = coalesceEvents(events);
    if (coalescedEvents.length > 0) {
      this._onDidFilesChange.fire({ raw: reviveFileChanges(coalescedEvents), event: this.toFileChangesEvent(coalescedEvents) });
    }
  }
  toFileChangesEvent(changes) {
    return new FileChangesEvent(reviveFileChanges(changes), !isLinux);
  }
}
var Path = /* @__PURE__ */ ((Path2) => {
  Path2[Path2["UNIX"] = 0] = "UNIX";
  Path2[Path2["WINDOWS"] = 1] = "WINDOWS";
  Path2[Path2["UNC"] = 2] = "UNC";
  return Path2;
})(Path || {});
suite("Watcher", () => {
  (isWindows ? test.skip : test)("parseWatcherPatterns - posix", () => {
    const path = "/users/data/src";
    let parsedPattern = parseWatcherPatterns(path, ["*.js"])[0];
    assert.strictEqual(parsedPattern("/users/data/src/foo.js"), true);
    assert.strictEqual(parsedPattern("/users/data/src/foo.ts"), false);
    assert.strictEqual(parsedPattern("/users/data/src/bar/foo.js"), false);
    parsedPattern = parseWatcherPatterns(path, ["/users/data/src/*.js"])[0];
    assert.strictEqual(parsedPattern("/users/data/src/foo.js"), true);
    assert.strictEqual(parsedPattern("/users/data/src/foo.ts"), false);
    assert.strictEqual(parsedPattern("/users/data/src/bar/foo.js"), false);
    parsedPattern = parseWatcherPatterns(path, ["/users/data/src/bar/*.js"])[0];
    assert.strictEqual(parsedPattern("/users/data/src/foo.js"), false);
    assert.strictEqual(parsedPattern("/users/data/src/foo.ts"), false);
    assert.strictEqual(parsedPattern("/users/data/src/bar/foo.js"), true);
    parsedPattern = parseWatcherPatterns(path, ["**/*.js"])[0];
    assert.strictEqual(parsedPattern("/users/data/src/foo.js"), true);
    assert.strictEqual(parsedPattern("/users/data/src/foo.ts"), false);
    assert.strictEqual(parsedPattern("/users/data/src/bar/foo.js"), true);
  });
  (!isWindows ? test.skip : test)("parseWatcherPatterns - windows", () => {
    const path = "c:\\users\\data\\src";
    let parsedPattern = parseWatcherPatterns(path, ["*.js"])[0];
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.js"), true);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.ts"), false);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\bar/foo.js"), false);
    parsedPattern = parseWatcherPatterns(path, ["c:\\users\\data\\src\\*.js"])[0];
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.js"), true);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.ts"), false);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\bar\\foo.js"), false);
    parsedPattern = parseWatcherPatterns(path, ["c:\\users\\data\\src\\bar/*.js"])[0];
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.js"), false);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.ts"), false);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\bar\\foo.js"), true);
    parsedPattern = parseWatcherPatterns(path, ["**/*.js"])[0];
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.js"), true);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\foo.ts"), false);
    assert.strictEqual(parsedPattern("c:\\users\\data\\src\\bar\\foo.js"), true);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
suite("Watcher Events Normalizer", () => {
  const disposables = new DisposableStore();
  teardown(() => {
    disposables.clear();
  });
  test("simple add/update/delete", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const added = URI.file("/users/data/src/added.txt");
    const updated = URI.file("/users/data/src/updated.txt");
    const deleted = URI.file("/users/data/src/deleted.txt");
    const raw = [
      { resource: added, type: FileChangeType.ADDED },
      { resource: updated, type: FileChangeType.UPDATED },
      { resource: deleted, type: FileChangeType.DELETED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 3);
      assert.ok(event.contains(added, FileChangeType.ADDED));
      assert.ok(event.contains(updated, FileChangeType.UPDATED));
      assert.ok(event.contains(deleted, FileChangeType.DELETED));
      done();
    }));
    watch.report(raw);
  });
  (isWindows ? [1 /* WINDOWS */, 2 /* UNC */] : [0 /* UNIX */]).forEach((path) => {
    test(`delete only reported for top level folder (${path})`, (done) => {
      const watch = disposables.add(new TestFileWatcher());
      const deletedFolderA = URI.file(path === 0 /* UNIX */ ? "/users/data/src/todelete1" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\todelete1" : "\\\\localhost\\users\\data\\src\\todelete1");
      const deletedFolderB = URI.file(path === 0 /* UNIX */ ? "/users/data/src/todelete2" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\todelete2" : "\\\\localhost\\users\\data\\src\\todelete2");
      const deletedFolderBF1 = URI.file(path === 0 /* UNIX */ ? "/users/data/src/todelete2/file.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\todelete2\\file.txt" : "\\\\localhost\\users\\data\\src\\todelete2\\file.txt");
      const deletedFolderBF2 = URI.file(path === 0 /* UNIX */ ? "/users/data/src/todelete2/more/test.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\todelete2\\more\\test.txt" : "\\\\localhost\\users\\data\\src\\todelete2\\more\\test.txt");
      const deletedFolderBF3 = URI.file(path === 0 /* UNIX */ ? "/users/data/src/todelete2/super/bar/foo.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\todelete2\\super\\bar\\foo.txt" : "\\\\localhost\\users\\data\\src\\todelete2\\super\\bar\\foo.txt");
      const deletedFileA = URI.file(path === 0 /* UNIX */ ? "/users/data/src/deleteme.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\deleteme.txt" : "\\\\localhost\\users\\data\\src\\deleteme.txt");
      const addedFile = URI.file(path === 0 /* UNIX */ ? "/users/data/src/added.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\added.txt" : "\\\\localhost\\users\\data\\src\\added.txt");
      const updatedFile = URI.file(path === 0 /* UNIX */ ? "/users/data/src/updated.txt" : path === 1 /* WINDOWS */ ? "C:\\users\\data\\src\\updated.txt" : "\\\\localhost\\users\\data\\src\\updated.txt");
      const raw = [
        { resource: deletedFolderA, type: FileChangeType.DELETED },
        { resource: deletedFolderB, type: FileChangeType.DELETED },
        { resource: deletedFolderBF1, type: FileChangeType.DELETED },
        { resource: deletedFolderBF2, type: FileChangeType.DELETED },
        { resource: deletedFolderBF3, type: FileChangeType.DELETED },
        { resource: deletedFileA, type: FileChangeType.DELETED },
        { resource: addedFile, type: FileChangeType.ADDED },
        { resource: updatedFile, type: FileChangeType.UPDATED }
      ];
      disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
        assert.ok(event);
        assert.strictEqual(raw2.length, 5);
        assert.ok(event.contains(deletedFolderA, FileChangeType.DELETED));
        assert.ok(event.contains(deletedFolderB, FileChangeType.DELETED));
        assert.ok(event.contains(deletedFileA, FileChangeType.DELETED));
        assert.ok(event.contains(addedFile, FileChangeType.ADDED));
        assert.ok(event.contains(updatedFile, FileChangeType.UPDATED));
        done();
      }));
      watch.report(raw);
    });
  });
  test("event coalescer: ignore CREATE followed by DELETE", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const created = URI.file("/users/data/src/related");
    const deleted = URI.file("/users/data/src/related");
    const unrelated = URI.file("/users/data/src/unrelated");
    const raw = [
      { resource: created, type: FileChangeType.ADDED },
      { resource: deleted, type: FileChangeType.DELETED },
      { resource: unrelated, type: FileChangeType.UPDATED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 1);
      assert.ok(event.contains(unrelated, FileChangeType.UPDATED));
      done();
    }));
    watch.report(raw);
  });
  test("event coalescer: flatten DELETE followed by CREATE into CHANGE", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const deleted = URI.file("/users/data/src/related");
    const created = URI.file("/users/data/src/related");
    const unrelated = URI.file("/users/data/src/unrelated");
    const raw = [
      { resource: deleted, type: FileChangeType.DELETED },
      { resource: created, type: FileChangeType.ADDED },
      { resource: unrelated, type: FileChangeType.UPDATED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 2);
      assert.ok(event.contains(deleted, FileChangeType.UPDATED));
      assert.ok(event.contains(unrelated, FileChangeType.UPDATED));
      done();
    }));
    watch.report(raw);
  });
  test("event coalescer: ignore UPDATE when CREATE received", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const created = URI.file("/users/data/src/related");
    const updated = URI.file("/users/data/src/related");
    const unrelated = URI.file("/users/data/src/unrelated");
    const raw = [
      { resource: created, type: FileChangeType.ADDED },
      { resource: updated, type: FileChangeType.UPDATED },
      { resource: unrelated, type: FileChangeType.UPDATED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 2);
      assert.ok(event.contains(created, FileChangeType.ADDED));
      assert.ok(!event.contains(created, FileChangeType.UPDATED));
      assert.ok(event.contains(unrelated, FileChangeType.UPDATED));
      done();
    }));
    watch.report(raw);
  });
  test("event coalescer: apply DELETE", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const updated = URI.file("/users/data/src/related");
    const updated2 = URI.file("/users/data/src/related");
    const deleted = URI.file("/users/data/src/related");
    const unrelated = URI.file("/users/data/src/unrelated");
    const raw = [
      { resource: updated, type: FileChangeType.UPDATED },
      { resource: updated2, type: FileChangeType.UPDATED },
      { resource: unrelated, type: FileChangeType.UPDATED },
      { resource: updated, type: FileChangeType.DELETED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 2);
      assert.ok(event.contains(deleted, FileChangeType.DELETED));
      assert.ok(!event.contains(updated, FileChangeType.UPDATED));
      assert.ok(event.contains(unrelated, FileChangeType.UPDATED));
      done();
    }));
    watch.report(raw);
  });
  test("event coalescer: track case renames", (done) => {
    const watch = disposables.add(new TestFileWatcher());
    const oldPath = URI.file("/users/data/src/added");
    const newPath = URI.file("/users/data/src/ADDED");
    const raw = [
      { resource: newPath, type: FileChangeType.ADDED },
      { resource: oldPath, type: FileChangeType.DELETED }
    ];
    disposables.add(watch.onDidFilesChange(({ event, raw: raw2 }) => {
      assert.ok(event);
      assert.strictEqual(raw2.length, 2);
      for (const r of raw2) {
        if (isEqual(r.resource, oldPath)) {
          assert.strictEqual(r.type, FileChangeType.DELETED);
        } else if (isEqual(r.resource, newPath)) {
          assert.strictEqual(r.type, FileChangeType.ADDED);
        } else {
          assert.fail();
        }
      }
      done();
    }));
    watch.report(raw);
  });
  test("event type filter", () => {
    const resource = URI.file("/users/data/src/related");
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, void 0), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, void 0), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, void 0), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, FileChangeFilter.UPDATED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, FileChangeFilter.UPDATED | FileChangeFilter.DELETED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, FileChangeFilter.ADDED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, FileChangeFilter.ADDED | FileChangeFilter.UPDATED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.ADDED }, FileChangeFilter.ADDED | FileChangeFilter.UPDATED | FileChangeFilter.DELETED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, FileChangeFilter.UPDATED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, FileChangeFilter.UPDATED | FileChangeFilter.ADDED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, FileChangeFilter.DELETED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, FileChangeFilter.DELETED | FileChangeFilter.UPDATED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.DELETED }, FileChangeFilter.ADDED | FileChangeFilter.DELETED | FileChangeFilter.UPDATED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, FileChangeFilter.ADDED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, FileChangeFilter.DELETED | FileChangeFilter.ADDED), true);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, FileChangeFilter.UPDATED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, FileChangeFilter.DELETED | FileChangeFilter.UPDATED), false);
    assert.strictEqual(isFiltered({ resource, type: FileChangeType.UPDATED }, FileChangeFilter.ADDED | FileChangeFilter.DELETED | FileChangeFilter.UPDATED), false);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy90ZXN0L2NvbW1vbi93YXRjaGVyLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBpc0xpbnV4LCBpc1dpbmRvd3MgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IEZpbGVDaGFuZ2VGaWx0ZXIsIEZpbGVDaGFuZ2VzRXZlbnQsIEZpbGVDaGFuZ2VUeXBlLCBJRmlsZUNoYW5nZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBjb2FsZXNjZUV2ZW50cywgcmV2aXZlRmlsZUNoYW5nZXMsIHBhcnNlV2F0Y2hlclBhdHRlcm5zLCBpc0ZpbHRlcmVkIH0gZnJvbSAnLi4vLi4vY29tbW9uL3dhdGNoZXIuanMnO1xuXG5jbGFzcyBUZXN0RmlsZVdhdGNoZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRGaWxlc0NoYW5nZTogRW1pdHRlcjx7IHJhdzogSUZpbGVDaGFuZ2VbXTsgZXZlbnQ6IEZpbGVDaGFuZ2VzRXZlbnQgfT47XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX29uRGlkRmlsZXNDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHJhdzogSUZpbGVDaGFuZ2VbXTsgZXZlbnQ6IEZpbGVDaGFuZ2VzRXZlbnQgfT4oKSk7XG5cdH1cblxuXHRnZXQgb25EaWRGaWxlc0NoYW5nZSgpOiBFdmVudDx7IHJhdzogSUZpbGVDaGFuZ2VbXTsgZXZlbnQ6IEZpbGVDaGFuZ2VzRXZlbnQgfT4ge1xuXHRcdHJldHVybiB0aGlzLl9vbkRpZEZpbGVzQ2hhbmdlLmV2ZW50O1xuXHR9XG5cblx0cmVwb3J0KGNoYW5nZXM6IElGaWxlQ2hhbmdlW10pOiB2b2lkIHtcblx0XHR0aGlzLm9uUmF3RmlsZUV2ZW50cyhjaGFuZ2VzKTtcblx0fVxuXG5cdHByaXZhdGUgb25SYXdGaWxlRXZlbnRzKGV2ZW50czogSUZpbGVDaGFuZ2VbXSk6IHZvaWQge1xuXG5cdFx0Ly8gQ29hbGVzY2Vcblx0XHRjb25zdCBjb2FsZXNjZWRFdmVudHMgPSBjb2FsZXNjZUV2ZW50cyhldmVudHMpO1xuXG5cdFx0Ly8gRW1pdCB0aHJvdWdoIGV2ZW50IGVtaXR0ZXJcblx0XHRpZiAoY29hbGVzY2VkRXZlbnRzLmxlbmd0aCA+IDApIHtcblx0XHRcdHRoaXMuX29uRGlkRmlsZXNDaGFuZ2UuZmlyZSh7IHJhdzogcmV2aXZlRmlsZUNoYW5nZXMoY29hbGVzY2VkRXZlbnRzKSwgZXZlbnQ6IHRoaXMudG9GaWxlQ2hhbmdlc0V2ZW50KGNvYWxlc2NlZEV2ZW50cykgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0b0ZpbGVDaGFuZ2VzRXZlbnQoY2hhbmdlczogSUZpbGVDaGFuZ2VbXSk6IEZpbGVDaGFuZ2VzRXZlbnQge1xuXHRcdHJldHVybiBuZXcgRmlsZUNoYW5nZXNFdmVudChyZXZpdmVGaWxlQ2hhbmdlcyhjaGFuZ2VzKSwgIWlzTGludXgpO1xuXHR9XG59XG5cbmVudW0gUGF0aCB7XG5cdFVOSVgsXG5cdFdJTkRPV1MsXG5cdFVOQ1xufVxuXG5zdWl0ZSgnV2F0Y2hlcicsICgpID0+IHtcblxuXHQoaXNXaW5kb3dzID8gdGVzdC5za2lwIDogdGVzdCkoJ3BhcnNlV2F0Y2hlclBhdHRlcm5zIC0gcG9zaXgnLCAoKSA9PiB7XG5cdFx0Y29uc3QgcGF0aCA9ICcvdXNlcnMvZGF0YS9zcmMnO1xuXHRcdGxldCBwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWycqLmpzJ10pWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJy91c2Vycy9kYXRhL3NyYy9mb28uanMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJy91c2Vycy9kYXRhL3NyYy9mb28udHMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCcvdXNlcnMvZGF0YS9zcmMvYmFyL2Zvby5qcycpLCBmYWxzZSk7XG5cblx0XHRwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWycvdXNlcnMvZGF0YS9zcmMvKi5qcyddKVswXTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCcvdXNlcnMvZGF0YS9zcmMvZm9vLmpzJyksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCcvdXNlcnMvZGF0YS9zcmMvZm9vLnRzJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignL3VzZXJzL2RhdGEvc3JjL2Jhci9mb28uanMnKSwgZmFsc2UpO1xuXG5cdFx0cGFyc2VkUGF0dGVybiA9IHBhcnNlV2F0Y2hlclBhdHRlcm5zKHBhdGgsIFsnL3VzZXJzL2RhdGEvc3JjL2Jhci8qLmpzJ10pWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJy91c2Vycy9kYXRhL3NyYy9mb28uanMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCcvdXNlcnMvZGF0YS9zcmMvZm9vLnRzJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignL3VzZXJzL2RhdGEvc3JjL2Jhci9mb28uanMnKSwgdHJ1ZSk7XG5cblx0XHRwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWycqKi8qLmpzJ10pWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJy91c2Vycy9kYXRhL3NyYy9mb28uanMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJy91c2Vycy9kYXRhL3NyYy9mb28udHMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCcvdXNlcnMvZGF0YS9zcmMvYmFyL2Zvby5qcycpLCB0cnVlKTtcblx0fSk7XG5cblx0KCFpc1dpbmRvd3MgPyB0ZXN0LnNraXAgOiB0ZXN0KSgncGFyc2VXYXRjaGVyUGF0dGVybnMgLSB3aW5kb3dzJywgKCkgPT4ge1xuXHRcdGNvbnN0IHBhdGggPSAnYzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmMnO1xuXHRcdGxldCBwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWycqLmpzJ10pWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJ2M6XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXGZvby5qcycpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignYzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcZm9vLnRzJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignYzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcYmFyL2Zvby5qcycpLCBmYWxzZSk7XG5cblx0XHRwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWydjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFwqLmpzJ10pWzBdO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJ2M6XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXGZvby5qcycpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignYzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcZm9vLnRzJyksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocGFyc2VkUGF0dGVybignYzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcYmFyXFxcXGZvby5qcycpLCBmYWxzZSk7XG5cblx0XHRwYXJzZWRQYXR0ZXJuID0gcGFyc2VXYXRjaGVyUGF0dGVybnMocGF0aCwgWydjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxiYXIvKi5qcyddKVswXTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCdjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxmb28uanMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCdjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxmb28udHMnKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCdjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxiYXJcXFxcZm9vLmpzJyksIHRydWUpO1xuXG5cdFx0cGFyc2VkUGF0dGVybiA9IHBhcnNlV2F0Y2hlclBhdHRlcm5zKHBhdGgsIFsnKiovKi5qcyddKVswXTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwYXJzZWRQYXR0ZXJuKCdjOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxmb28uanMnKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJ2M6XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXGZvby50cycpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHBhcnNlZFBhdHRlcm4oJ2M6XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXGJhclxcXFxmb28uanMnKSwgdHJ1ZSk7XG5cdH0pO1xuXG5cdGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xufSk7XG5cbnN1aXRlKCdXYXRjaGVyIEV2ZW50cyBOb3JtYWxpemVyJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdzaW1wbGUgYWRkL3VwZGF0ZS9kZWxldGUnLCBkb25lID0+IHtcblx0XHRjb25zdCB3YXRjaCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEZpbGVXYXRjaGVyKCkpO1xuXG5cdFx0Y29uc3QgYWRkZWQgPSBVUkkuZmlsZSgnL3VzZXJzL2RhdGEvc3JjL2FkZGVkLnR4dCcpO1xuXHRcdGNvbnN0IHVwZGF0ZWQgPSBVUkkuZmlsZSgnL3VzZXJzL2RhdGEvc3JjL3VwZGF0ZWQudHh0Jyk7XG5cdFx0Y29uc3QgZGVsZXRlZCA9IFVSSS5maWxlKCcvdXNlcnMvZGF0YS9zcmMvZGVsZXRlZC50eHQnKTtcblxuXHRcdGNvbnN0IHJhdzogSUZpbGVDaGFuZ2VbXSA9IFtcblx0XHRcdHsgcmVzb3VyY2U6IGFkZGVkLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogdXBkYXRlZCwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZCwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9LFxuXHRcdF07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQod2F0Y2gub25EaWRGaWxlc0NoYW5nZSgoeyBldmVudCwgcmF3IH0pID0+IHtcblx0XHRcdGFzc2VydC5vayhldmVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmF3Lmxlbmd0aCwgMyk7XG5cdFx0XHRhc3NlcnQub2soZXZlbnQuY29udGFpbnMoYWRkZWQsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKSk7XG5cdFx0XHRhc3NlcnQub2soZXZlbnQuY29udGFpbnModXBkYXRlZCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKGRlbGV0ZWQsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpKTtcblxuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pKTtcblxuXHRcdHdhdGNoLnJlcG9ydChyYXcpO1xuXHR9KTtcblxuXHQoaXNXaW5kb3dzID8gW1BhdGguV0lORE9XUywgUGF0aC5VTkNdIDogW1BhdGguVU5JWF0pLmZvckVhY2gocGF0aCA9PiB7XG5cdFx0dGVzdChgZGVsZXRlIG9ubHkgcmVwb3J0ZWQgZm9yIHRvcCBsZXZlbCBmb2xkZXIgKCR7cGF0aH0pYCwgZG9uZSA9PiB7XG5cdFx0XHRjb25zdCB3YXRjaCA9IGRpc3Bvc2FibGVzLmFkZChuZXcgVGVzdEZpbGVXYXRjaGVyKCkpO1xuXG5cdFx0XHRjb25zdCBkZWxldGVkRm9sZGVyQSA9IFVSSS5maWxlKHBhdGggPT09IFBhdGguVU5JWCA/ICcvdXNlcnMvZGF0YS9zcmMvdG9kZWxldGUxJyA6IHBhdGggPT09IFBhdGguV0lORE9XUyA/ICdDOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFx0b2RlbGV0ZTEnIDogJ1xcXFxcXFxcbG9jYWxob3N0XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXHRvZGVsZXRlMScpO1xuXHRcdFx0Y29uc3QgZGVsZXRlZEZvbGRlckIgPSBVUkkuZmlsZShwYXRoID09PSBQYXRoLlVOSVggPyAnL3VzZXJzL2RhdGEvc3JjL3RvZGVsZXRlMicgOiBwYXRoID09PSBQYXRoLldJTkRPV1MgPyAnQzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcdG9kZWxldGUyJyA6ICdcXFxcXFxcXGxvY2FsaG9zdFxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFx0b2RlbGV0ZTInKTtcblx0XHRcdGNvbnN0IGRlbGV0ZWRGb2xkZXJCRjEgPSBVUkkuZmlsZShwYXRoID09PSBQYXRoLlVOSVggPyAnL3VzZXJzL2RhdGEvc3JjL3RvZGVsZXRlMi9maWxlLnR4dCcgOiBwYXRoID09PSBQYXRoLldJTkRPV1MgPyAnQzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcdG9kZWxldGUyXFxcXGZpbGUudHh0JyA6ICdcXFxcXFxcXGxvY2FsaG9zdFxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFx0b2RlbGV0ZTJcXFxcZmlsZS50eHQnKTtcblx0XHRcdGNvbnN0IGRlbGV0ZWRGb2xkZXJCRjIgPSBVUkkuZmlsZShwYXRoID09PSBQYXRoLlVOSVggPyAnL3VzZXJzL2RhdGEvc3JjL3RvZGVsZXRlMi9tb3JlL3Rlc3QudHh0JyA6IHBhdGggPT09IFBhdGguV0lORE9XUyA/ICdDOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFx0b2RlbGV0ZTJcXFxcbW9yZVxcXFx0ZXN0LnR4dCcgOiAnXFxcXFxcXFxsb2NhbGhvc3RcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcdG9kZWxldGUyXFxcXG1vcmVcXFxcdGVzdC50eHQnKTtcblx0XHRcdGNvbnN0IGRlbGV0ZWRGb2xkZXJCRjMgPSBVUkkuZmlsZShwYXRoID09PSBQYXRoLlVOSVggPyAnL3VzZXJzL2RhdGEvc3JjL3RvZGVsZXRlMi9zdXBlci9iYXIvZm9vLnR4dCcgOiBwYXRoID09PSBQYXRoLldJTkRPV1MgPyAnQzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcdG9kZWxldGUyXFxcXHN1cGVyXFxcXGJhclxcXFxmb28udHh0JyA6ICdcXFxcXFxcXGxvY2FsaG9zdFxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFx0b2RlbGV0ZTJcXFxcc3VwZXJcXFxcYmFyXFxcXGZvby50eHQnKTtcblx0XHRcdGNvbnN0IGRlbGV0ZWRGaWxlQSA9IFVSSS5maWxlKHBhdGggPT09IFBhdGguVU5JWCA/ICcvdXNlcnMvZGF0YS9zcmMvZGVsZXRlbWUudHh0JyA6IHBhdGggPT09IFBhdGguV0lORE9XUyA/ICdDOlxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxkZWxldGVtZS50eHQnIDogJ1xcXFxcXFxcbG9jYWxob3N0XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXGRlbGV0ZW1lLnR4dCcpO1xuXG5cdFx0XHRjb25zdCBhZGRlZEZpbGUgPSBVUkkuZmlsZShwYXRoID09PSBQYXRoLlVOSVggPyAnL3VzZXJzL2RhdGEvc3JjL2FkZGVkLnR4dCcgOiBwYXRoID09PSBQYXRoLldJTkRPV1MgPyAnQzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcYWRkZWQudHh0JyA6ICdcXFxcXFxcXGxvY2FsaG9zdFxcXFx1c2Vyc1xcXFxkYXRhXFxcXHNyY1xcXFxhZGRlZC50eHQnKTtcblx0XHRcdGNvbnN0IHVwZGF0ZWRGaWxlID0gVVJJLmZpbGUocGF0aCA9PT0gUGF0aC5VTklYID8gJy91c2Vycy9kYXRhL3NyYy91cGRhdGVkLnR4dCcgOiBwYXRoID09PSBQYXRoLldJTkRPV1MgPyAnQzpcXFxcdXNlcnNcXFxcZGF0YVxcXFxzcmNcXFxcdXBkYXRlZC50eHQnIDogJ1xcXFxcXFxcbG9jYWxob3N0XFxcXHVzZXJzXFxcXGRhdGFcXFxcc3JjXFxcXHVwZGF0ZWQudHh0Jyk7XG5cblx0XHRcdGNvbnN0IHJhdzogSUZpbGVDaGFuZ2VbXSA9IFtcblx0XHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZEZvbGRlckEsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZEZvbGRlckIsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZEZvbGRlckJGMSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9LFxuXHRcdFx0XHR7IHJlc291cmNlOiBkZWxldGVkRm9sZGVyQkYyLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IGRlbGV0ZWRGb2xkZXJCRjMsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZEZpbGVBLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH0sXG5cdFx0XHRcdHsgcmVzb3VyY2U6IGFkZGVkRmlsZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuQURERUQgfSxcblx0XHRcdFx0eyByZXNvdXJjZTogdXBkYXRlZEZpbGUsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfVxuXHRcdFx0XTtcblxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKHdhdGNoLm9uRGlkRmlsZXNDaGFuZ2UoKHsgZXZlbnQsIHJhdyB9KSA9PiB7XG5cdFx0XHRcdGFzc2VydC5vayhldmVudCk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYXcubGVuZ3RoLCA1KTtcblxuXHRcdFx0XHRhc3NlcnQub2soZXZlbnQuY29udGFpbnMoZGVsZXRlZEZvbGRlckEsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKGRlbGV0ZWRGb2xkZXJCLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSk7XG5cdFx0XHRcdGFzc2VydC5vayhldmVudC5jb250YWlucyhkZWxldGVkRmlsZUEsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKGFkZGVkRmlsZSwgRmlsZUNoYW5nZVR5cGUuQURERUQpKTtcblx0XHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKHVwZGF0ZWRGaWxlLCBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEKSk7XG5cblx0XHRcdFx0ZG9uZSgpO1xuXHRcdFx0fSkpO1xuXG5cdFx0XHR3YXRjaC5yZXBvcnQocmF3KTtcblx0XHR9KTtcblx0fSk7XG5cblx0dGVzdCgnZXZlbnQgY29hbGVzY2VyOiBpZ25vcmUgQ1JFQVRFIGZvbGxvd2VkIGJ5IERFTEVURScsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHdhdGNoID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZVdhdGNoZXIoKSk7XG5cblx0XHRjb25zdCBjcmVhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cdFx0Y29uc3QgZGVsZXRlZCA9IFVSSS5maWxlKCcvdXNlcnMvZGF0YS9zcmMvcmVsYXRlZCcpO1xuXHRcdGNvbnN0IHVucmVsYXRlZCA9IFVSSS5maWxlKCcvdXNlcnMvZGF0YS9zcmMvdW5yZWxhdGVkJyk7XG5cblx0XHRjb25zdCByYXc6IElGaWxlQ2hhbmdlW10gPSBbXG5cdFx0XHR7IHJlc291cmNlOiBjcmVhdGVkLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogZGVsZXRlZCwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogdW5yZWxhdGVkLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEIH0sXG5cdFx0XTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh3YXRjaC5vbkRpZEZpbGVzQ2hhbmdlKCh7IGV2ZW50LCByYXcgfSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYXcubGVuZ3RoLCAxKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKHVucmVsYXRlZCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkpO1xuXG5cdFx0XHRkb25lKCk7XG5cdFx0fSkpO1xuXG5cdFx0d2F0Y2gucmVwb3J0KHJhdyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGNvYWxlc2NlcjogZmxhdHRlbiBERUxFVEUgZm9sbG93ZWQgYnkgQ1JFQVRFIGludG8gQ0hBTkdFJywgZG9uZSA9PiB7XG5cdFx0Y29uc3Qgd2F0Y2ggPSBkaXNwb3NhYmxlcy5hZGQobmV3IFRlc3RGaWxlV2F0Y2hlcigpKTtcblxuXHRcdGNvbnN0IGRlbGV0ZWQgPSBVUkkuZmlsZSgnL3VzZXJzL2RhdGEvc3JjL3JlbGF0ZWQnKTtcblx0XHRjb25zdCBjcmVhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cdFx0Y29uc3QgdW5yZWxhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy91bnJlbGF0ZWQnKTtcblxuXHRcdGNvbnN0IHJhdzogSUZpbGVDaGFuZ2VbXSA9IFtcblx0XHRcdHsgcmVzb3VyY2U6IGRlbGV0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSxcblx0XHRcdHsgcmVzb3VyY2U6IGNyZWF0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkFEREVEIH0sXG5cdFx0XHR7IHJlc291cmNlOiB1bnJlbGF0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfSxcblx0XHRdO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdhdGNoLm9uRGlkRmlsZXNDaGFuZ2UoKHsgZXZlbnQsIHJhdyB9KSA9PiB7XG5cdFx0XHRhc3NlcnQub2soZXZlbnQpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJhdy5sZW5ndGgsIDIpO1xuXG5cdFx0XHRhc3NlcnQub2soZXZlbnQuY29udGFpbnMoZGVsZXRlZCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkpO1xuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKHVucmVsYXRlZCwgRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCkpO1xuXG5cdFx0XHRkb25lKCk7XG5cdFx0fSkpO1xuXG5cdFx0d2F0Y2gucmVwb3J0KHJhdyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IGNvYWxlc2NlcjogaWdub3JlIFVQREFURSB3aGVuIENSRUFURSByZWNlaXZlZCcsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHdhdGNoID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZVdhdGNoZXIoKSk7XG5cblx0XHRjb25zdCBjcmVhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cdFx0Y29uc3QgdXBkYXRlZCA9IFVSSS5maWxlKCcvdXNlcnMvZGF0YS9zcmMvcmVsYXRlZCcpO1xuXHRcdGNvbnN0IHVucmVsYXRlZCA9IFVSSS5maWxlKCcvdXNlcnMvZGF0YS9zcmMvdW5yZWxhdGVkJyk7XG5cblx0XHRjb25zdCByYXc6IElGaWxlQ2hhbmdlW10gPSBbXG5cdFx0XHR7IHJlc291cmNlOiBjcmVhdGVkLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogdXBkYXRlZCwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogdW5yZWxhdGVkLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEIH0sXG5cdFx0XTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh3YXRjaC5vbkRpZEZpbGVzQ2hhbmdlKCh7IGV2ZW50LCByYXcgfSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYXcubGVuZ3RoLCAyKTtcblxuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50LmNvbnRhaW5zKGNyZWF0ZWQsIEZpbGVDaGFuZ2VUeXBlLkFEREVEKSk7XG5cdFx0XHRhc3NlcnQub2soIWV2ZW50LmNvbnRhaW5zKGNyZWF0ZWQsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpKTtcblx0XHRcdGFzc2VydC5vayhldmVudC5jb250YWlucyh1bnJlbGF0ZWQsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpKTtcblxuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pKTtcblxuXHRcdHdhdGNoLnJlcG9ydChyYXcpO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCBjb2FsZXNjZXI6IGFwcGx5IERFTEVURScsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHdhdGNoID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZVdhdGNoZXIoKSk7XG5cblx0XHRjb25zdCB1cGRhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cdFx0Y29uc3QgdXBkYXRlZDIgPSBVUkkuZmlsZSgnL3VzZXJzL2RhdGEvc3JjL3JlbGF0ZWQnKTtcblx0XHRjb25zdCBkZWxldGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cdFx0Y29uc3QgdW5yZWxhdGVkID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy91bnJlbGF0ZWQnKTtcblxuXHRcdGNvbnN0IHJhdzogSUZpbGVDaGFuZ2VbXSA9IFtcblx0XHRcdHsgcmVzb3VyY2U6IHVwZGF0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfSxcblx0XHRcdHsgcmVzb3VyY2U6IHVwZGF0ZWQyLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5VUERBVEVEIH0sXG5cdFx0XHR7IHJlc291cmNlOiB1bnJlbGF0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfSxcblx0XHRcdHsgcmVzb3VyY2U6IHVwZGF0ZWQsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfVxuXHRcdF07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQod2F0Y2gub25EaWRGaWxlc0NoYW5nZSgoeyBldmVudCwgcmF3IH0pID0+IHtcblx0XHRcdGFzc2VydC5vayhldmVudCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmF3Lmxlbmd0aCwgMik7XG5cblx0XHRcdGFzc2VydC5vayhldmVudC5jb250YWlucyhkZWxldGVkLCBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEKSk7XG5cdFx0XHRhc3NlcnQub2soIWV2ZW50LmNvbnRhaW5zKHVwZGF0ZWQsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpKTtcblx0XHRcdGFzc2VydC5vayhldmVudC5jb250YWlucyh1bnJlbGF0ZWQsIEZpbGVDaGFuZ2VUeXBlLlVQREFURUQpKTtcblxuXHRcdFx0ZG9uZSgpO1xuXHRcdH0pKTtcblxuXHRcdHdhdGNoLnJlcG9ydChyYXcpO1xuXHR9KTtcblxuXHR0ZXN0KCdldmVudCBjb2FsZXNjZXI6IHRyYWNrIGNhc2UgcmVuYW1lcycsIGRvbmUgPT4ge1xuXHRcdGNvbnN0IHdhdGNoID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBUZXN0RmlsZVdhdGNoZXIoKSk7XG5cblx0XHRjb25zdCBvbGRQYXRoID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9hZGRlZCcpO1xuXHRcdGNvbnN0IG5ld1BhdGggPSBVUkkuZmlsZSgnL3VzZXJzL2RhdGEvc3JjL0FEREVEJyk7XG5cblx0XHRjb25zdCByYXc6IElGaWxlQ2hhbmdlW10gPSBbXG5cdFx0XHR7IHJlc291cmNlOiBuZXdQYXRoLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LFxuXHRcdFx0eyByZXNvdXJjZTogb2xkUGF0aCwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9XG5cdFx0XTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh3YXRjaC5vbkRpZEZpbGVzQ2hhbmdlKCh7IGV2ZW50LCByYXcgfSkgPT4ge1xuXHRcdFx0YXNzZXJ0Lm9rKGV2ZW50KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyYXcubGVuZ3RoLCAyKTtcblxuXHRcdFx0Zm9yIChjb25zdCByIG9mIHJhdykge1xuXHRcdFx0XHRpZiAoaXNFcXVhbChyLnJlc291cmNlLCBvbGRQYXRoKSkge1xuXHRcdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyLnR5cGUsIEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQpO1xuXHRcdFx0XHR9IGVsc2UgaWYgKGlzRXF1YWwoci5yZXNvdXJjZSwgbmV3UGF0aCkpIHtcblx0XHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoci50eXBlLCBGaWxlQ2hhbmdlVHlwZS5BRERFRCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YXNzZXJ0LmZhaWwoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRkb25lKCk7XG5cdFx0fSkpO1xuXG5cdFx0d2F0Y2gucmVwb3J0KHJhdyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2V2ZW50IHR5cGUgZmlsdGVyJywgKCkgPT4ge1xuXHRcdGNvbnN0IHJlc291cmNlID0gVVJJLmZpbGUoJy91c2Vycy9kYXRhL3NyYy9yZWxhdGVkJyk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNGaWx0ZXJlZCh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LCB1bmRlZmluZWQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LCB1bmRlZmluZWQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9LCB1bmRlZmluZWQpLCBmYWxzZSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNGaWx0ZXJlZCh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNGaWx0ZXJlZCh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQgfCBGaWxlQ2hhbmdlRmlsdGVyLkRFTEVURUQpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkFEREVEIH0sIEZpbGVDaGFuZ2VGaWx0ZXIuQURERUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuQURERUQgfSwgRmlsZUNoYW5nZUZpbHRlci5BRERFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuVVBEQVRFRCksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNGaWx0ZXJlZCh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLkFEREVEIHwgRmlsZUNoYW5nZUZpbHRlci5VUERBVEVEIHwgRmlsZUNoYW5nZUZpbHRlci5ERUxFVEVEKSwgZmFsc2UpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuREVMRVRFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQpLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaXNGaWx0ZXJlZCh7IHJlc291cmNlLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5ERUxFVEVEIH0sIEZpbGVDaGFuZ2VGaWx0ZXIuVVBEQVRFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuQURERUQpLCB0cnVlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSwgRmlsZUNoYW5nZUZpbHRlci5ERUxFVEVEKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSwgRmlsZUNoYW5nZUZpbHRlci5ERUxFVEVEIHwgRmlsZUNoYW5nZUZpbHRlci5VUERBVEVEKSwgZmFsc2UpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkRFTEVURUQgfSwgRmlsZUNoYW5nZUZpbHRlci5BRERFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuREVMRVRFRCB8IEZpbGVDaGFuZ2VGaWx0ZXIuVVBEQVRFRCksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfSwgRmlsZUNoYW5nZUZpbHRlci5BRERFRCksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbHRlcmVkKHsgcmVzb3VyY2UsIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQgfSwgRmlsZUNoYW5nZUZpbHRlci5ERUxFVEVEIHwgRmlsZUNoYW5nZUZpbHRlci5BRERFRCksIHRydWUpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLkRFTEVURUQgfCBGaWxlQ2hhbmdlRmlsdGVyLlVQREFURUQpLCBmYWxzZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsdGVyZWQoeyByZXNvdXJjZSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCB9LCBGaWxlQ2hhbmdlRmlsdGVyLkFEREVEIHwgRmlsZUNoYW5nZUZpbHRlci5ERUxFVEVEIHwgRmlsZUNoYW5nZUZpbHRlci5VUERBVEVEKSwgZmFsc2UpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLFNBQVMsaUJBQWlCO0FBQ25DLFNBQVMsZUFBZTtBQUN4QixTQUFTLFdBQVc7QUFDcEIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBUyxrQkFBa0Isa0JBQWtCLHNCQUFtQztBQUNoRixTQUFTLGdCQUFnQixtQkFBbUIsc0JBQXNCLGtCQUFrQjtBQUVwRixNQUFNLHdCQUF3QixXQUFXO0FBQUEsRUFHeEMsY0FBYztBQUNiLFVBQU07QUFFTixTQUFLLG9CQUFvQixLQUFLLFVBQVUsSUFBSSxRQUF5RCxDQUFDO0FBQUEsRUFDdkc7QUFBQSxFQUVBLElBQUksbUJBQTJFO0FBQzlFLFdBQU8sS0FBSyxrQkFBa0I7QUFBQSxFQUMvQjtBQUFBLEVBRUEsT0FBTyxTQUE4QjtBQUNwQyxTQUFLLGdCQUFnQixPQUFPO0FBQUEsRUFDN0I7QUFBQSxFQUVRLGdCQUFnQixRQUE2QjtBQUdwRCxVQUFNLGtCQUFrQixlQUFlLE1BQU07QUFHN0MsUUFBSSxnQkFBZ0IsU0FBUyxHQUFHO0FBQy9CLFdBQUssa0JBQWtCLEtBQUss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
