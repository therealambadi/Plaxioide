import assert from "assert";
import { DeferredPromise, timeout } from "../../../../base/common/async.js";
import { bufferToReadable, bufferToStream, VSBuffer } from "../../../../base/common/buffer.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { isEqual } from "../../../../base/common/resources.js";
import { consumeStream, newWriteableStream } from "../../../../base/common/stream.js";
import { URI } from "../../../../base/common/uri.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { FileSystemProviderCapabilities, FileType, isFileSystemWatcher, FileChangeType } from "../../common/files.js";
import { FileService } from "../../common/fileService.js";
import { NullFileSystemProvider } from "../common/nullFileSystemProvider.js";
import { NullLogService } from "../../../log/common/log.js";
suite("File Service", () => {
  const disposables = new DisposableStore();
  teardown(() => {
    disposables.clear();
  });
  test("provider registration", async () => {
    const service = disposables.add(new FileService(new NullLogService()));
    const resource = URI.parse("test://foo/bar");
    const provider = new NullFileSystemProvider();
    assert.strictEqual(await service.canHandleResource(resource), false);
    assert.strictEqual(service.hasProvider(resource), false);
    assert.strictEqual(service.getProvider(resource.scheme), void 0);
    const registrations = [];
    disposables.add(service.onDidChangeFileSystemProviderRegistrations((e) => {
      registrations.push(e);
    }));
    const capabilityChanges = [];
    disposables.add(service.onDidChangeFileSystemProviderCapabilities((e) => {
      capabilityChanges.push(e);
    }));
    let registrationDisposable;
    let callCount = 0;
    disposables.add(service.onWillActivateFileSystemProvider((e) => {
      callCount++;
      if (e.scheme === "test" && callCount === 1) {
        e.join(new Promise((resolve) => {
          registrationDisposable = service.registerProvider("test", provider);
          resolve();
        }));
      }
    }));
    assert.strictEqual(await service.canHandleResource(resource), true);
    assert.strictEqual(service.hasProvider(resource), true);
    assert.strictEqual(service.getProvider(resource.scheme), provider);
    assert.strictEqual(registrations.length, 1);
    assert.strictEqual(registrations[0].scheme, "test");
    assert.strictEqual(registrations[0].added, true);
    assert.ok(registrationDisposable);
    assert.strictEqual(capabilityChanges.length, 0);
    provider.setCapabilities(FileSystemProviderCapabilities.FileFolderCopy);
    assert.strictEqual(capabilityChanges.length, 1);
    provider.setCapabilities(FileSystemProviderCapabilities.Readonly);
    assert.strictEqual(capabilityChanges.length, 2);
    await service.activateProvider("test");
    assert.strictEqual(callCount, 2);
    assert.strictEqual(service.hasCapability(resource, FileSystemProviderCapabilities.Readonly), true);
    assert.strictEqual(service.hasCapability(resource, FileSystemProviderCapabilities.FileOpenReadWriteClose), false);
    registrationDisposable.dispose();
    assert.strictEqual(await service.canHandleResource(resource), false);
    assert.strictEqual(service.hasProvider(resource), false);
    assert.strictEqual(registrations.length, 2);
    assert.strictEqual(registrations[1].scheme, "test");
    assert.strictEqual(registrations[1].added, false);
  });
  test("watch", async () => {
    const service = disposables.add(new FileService(new NullLogService()));
    let disposeCounter = 0;
    disposables.add(service.registerProvider("test", new NullFileSystemProvider(() => {
      return toDisposable(() => {
        disposeCounter++;
      });
    })));
    await service.activateProvider("test");
    const resource1 = URI.parse("test://foo/bar1");
    const watcher1Disposable = service.watch(resource1);
    await timeout(0);
    assert.strictEqual(disposeCounter, 0);
    watcher1Disposable.dispose();
    assert.strictEqual(disposeCounter, 1);
    disposeCounter = 0;
    const resource2 = URI.parse("test://foo/bar2");
    const watcher2Disposable1 = service.watch(resource2);
    const watcher2Disposable2 = service.watch(resource2);
    const watcher2Disposable3 = service.watch(resource2);
    await timeout(0);
    assert.strictEqual(disposeCounter, 0);
    watcher2Disposable1.dispose();
    assert.strictEqual(disposeCounter, 0);
    watcher2Disposable2.dispose();
    assert.strictEqual(disposeCounter, 0);
    watcher2Disposable3.dispose();
    assert.strictEqual(disposeCounter, 1);
    disposeCounter = 0;
    const resource3 = URI.parse("test://foo/bar3");
    const watcher3Disposable1 = service.watch(resource3);
    const watcher3Disposable2 = service.watch(resource3, { recursive: true, excludes: [] });
    const watcher3Disposable3 = service.watch(resource3, { recursive: false, excludes: [], includes: [] });
    await timeout(0);
    assert.strictEqual(disposeCounter, 0);
    watcher3Disposable1.dispose();
    assert.strictEqual(disposeCounter, 1);
    watcher3Disposable2.dispose();
    assert.strictEqual(disposeCounter, 2);
    watcher3Disposable3.dispose();
    assert.strictEqual(disposeCounter, 3);
    service.dispose();
  });
  test("watch - with corelation", async () => {
    const service = disposables.add(new FileService(new NullLogService()));
    const provider = new class extends NullFileSystemProvider {
      constructor() {
        super(...arguments);
        this._testOnDidChangeFile = new Emitter();
        this.onDidChangeFile = this._testOnDidChangeFile.event;
      }
      fireFileChange(changes) {
        this._testOnDidChangeFile.fire(changes);
      }
    }();
    disposables.add(service.registerProvider("test", provider));
    await service.activateProvider("test");
    const globalEvents = [];
    disposables.add(service.onDidFilesChange((e) => {
      globalEvents.push(e);
    }));
    const watcher0 = disposables.add(service.watch(URI.parse("test://watch/folder1"), { recursive: true, excludes: [], includes: [] }));
    assert.strictEqual(isFileSystemWatcher(watcher0), false);
    const watcher1 = disposables.add(service.watch(URI.parse("test://watch/folder2"), { recursive: true, excludes: [], includes: [], correlationId: 100 }));
    assert.strictEqual(isFileSystemWatcher(watcher1), true);
    const watcher2 = disposables.add(service.watch(URI.parse("test://watch/folder3"), { recursive: true, excludes: [], includes: [], correlationId: 200 }));
    assert.strictEqual(isFileSystemWatcher(watcher2), true);
    const watcher1Events = [];
    disposables.add(watcher1.onDidChange((e) => {
      watcher1Events.push(e);
    }));
    const watcher2Events = [];
    disposables.add(watcher2.onDidChange((e) => {
      watcher2Events.push(e);
    }));
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder1"), type: FileChangeType.ADDED }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder2"), type: FileChangeType.ADDED, cId: 100 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder2"), type: FileChangeType.ADDED, cId: 100 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder3/file"), type: FileChangeType.UPDATED, cId: 200 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder3"), type: FileChangeType.UPDATED, cId: 200 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder4"), type: FileChangeType.ADDED, cId: 50 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder4"), type: FileChangeType.ADDED, cId: 60 }]);
    provider.fireFileChange([{ resource: URI.parse("test://watch/folder4"), type: FileChangeType.ADDED, cId: 70 }]);
    assert.strictEqual(globalEvents.length, 1);
    assert.strictEqual(watcher1Events.length, 2);
    assert.strictEqual(watcher2Events.length, 2);
  });
  test("error from readFile bubbles through (https://github.com/microsoft/vscode/issues/118060) - async", async () => {
    testReadErrorBubbles(true);
  });
  test("error from readFile bubbles through (https://github.com/microsoft/vscode/issues/118060)", async () => {
    testReadErrorBubbles(false);
  });
  async function testReadErrorBubbles(async) {
    const service = disposables.add(new FileService(new NullLogService()));
    const provider = new class extends NullFileSystemProvider {
      async stat(resource) {
        return {
          mtime: Date.now(),
          ctime: Date.now(),
          size: 100,
          type: FileType.File
        };
      }
      readFile(resource) {
        if (async) {
          return timeout(5, CancellationToken.None).then(() => {
            throw new Error("failed");
          });
        }
        throw new Error("failed");
      }
      open(resource, opts) {
        if (async) {
          return timeout(5, CancellationToken.None).then(() => {
            throw new Error("failed");
          });
        }
        throw new Error("failed");
      }
      readFileStream(resource, opts, token) {
        if (async) {
          const stream = newWriteableStream((chunk) => chunk[0]);
          timeout(5, CancellationToken.None).then(() => stream.error(new Error("failed")));
          return stream;
        }
        throw new Error("failed");
      }
    }();
    disposables.add(service.registerProvider("test", provider));
    for (const capabilities of [FileSystemProviderCapabilities.FileReadWrite, FileSystemProviderCapabilities.FileReadStream, FileSystemProviderCapabilities.FileOpenReadWriteClose]) {
      provider.setCapabilities(capabilities);
      let e1;
      try {
        await service.readFile(URI.parse("test://foo/bar"));
      } catch (error) {
        e1 = error;
      }
      assert.ok(e1);
      let e2;
      try {
        const stream = await service.readFileStream(URI.parse("test://foo/bar"));
        await consumeStream(stream.value, (chunk) => chunk[0]);
      } catch (error) {
        e2 = error;
      }
      assert.ok(e2);
    }
  }
  test("readFile/readFileStream supports cancellation (https://github.com/microsoft/vscode/issues/138805)", async () => {
    const service = disposables.add(new FileService(new NullLogService()));
    let readFileStreamReady = void 0;
    const provider = new class extends NullFileSystemProvider {
      async stat(resource) {
        return {
          mtime: Date.now(),
          ctime: Date.now(),
          size: 100,
          type: FileType.File
        };
      }
      readFileStream(resource, opts, token) {
        const stream = newWriteableStream((chunk) => chunk[0]);
        disposables.add(token.onCancellationRequested(() => {
          stream.error(new Error("Expected cancellation"));
          stream.end();
        }));
        readFileStreamReady.complete();
        return stream;
      }
    }();
    disposables.add(service.registerProvider("test", provider));
    provider.setCapabilities(FileSystemProviderCapabilities.FileReadStream);
    let e1;
    try {
      const cts = new CancellationTokenSource();
      readFileStreamReady = new DeferredPromise();
      const promise = service.readFile(URI.parse("test://foo/bar"), void 0, cts.token);
      await Promise.all([readFileStreamReady.p.then(() => cts.cancel()), promise]);
    } catch (error) {
      e1 = error;
    }
    assert.ok(e1);
    let e2;
    try {
      const cts = new CancellationTokenSource();
      readFileStreamReady = new DeferredPromise();
      const stream = await service.readFileStream(URI.parse("test://foo/bar"), void 0, cts.token);
      await Promise.all([readFileStreamReady.p.then(() => cts.cancel()), consumeStream(stream.value, (chunk) => chunk[0])]);
    } catch (error) {
      e2 = error;
    }
    assert.ok(e2);
  });
  test("enforced atomic read/write/delete", async () => {
    const service = disposables.add(new FileService(new NullLogService()));
    const atomicResource = URI.parse("test://foo/bar/atomic");
    const nonAtomicResource = URI.parse("test://foo/nonatomic");
    let atomicReadCounter = 0;
    let atomicWriteCounter = 0;
    let atomicDeleteCounter = 0;
    const provider = new class extends NullFileSystemProvider {
      async stat(resource) {
        return {
          type: FileType.File,
          ctime: Date.now(),
          mtime: Date.now(),
          size: 0
        };
      }
      async readFile(resource, opts) {
        if (opts?.atomic) {
          atomicReadCounter++;
        }
        return new Uint8Array();
      }
      readFileStream(resource, opts, token) {
        return newWriteableStream((chunk) => chunk[0]);
      }
      enforceAtomicReadFile(resource) {
        return isEqual(resource, atomicResource);
      }
      async writeFile(resource, content, opts) {
        if (opts.atomic) {
          atomicWriteCounter++;
        }
      }
      enforceAtomicWriteFile(resource) {
        return isEqual(resource, atomicResource) ? { postfix: ".tmp" } : false;
      }
      async delete(resource, opts) {
        if (opts.atomic) {
          atomicDeleteCounter++;
        }
      }
      enforceAtomicDelete(resource) {
        return isEqual(resource, atomicResource) ? { postfix: ".tmp" } : false;
      }
    }();
    provider.setCapabilities(
      FileSystemProviderCapabilities.FileReadWrite | FileSystemProviderCapabilities.FileOpenReadWriteClose | FileSystemProviderCapabilities.FileReadStream | FileSystemProviderCapabilities.FileAtomicRead | FileSystemProviderCapabilities.FileAtomicWrite | FileSystemProviderCapabilities.FileAtomicDelete
    );
    disposables.add(service.registerProvider("test", provider));
    await service.readFile(atomicResource);
    await service.readFile(nonAtomicResource);
    await service.readFileStream(atomicResource);
    await service.readFileStream(nonAtomicResource);
    await service.writeFile(atomicResource, VSBuffer.fromString(""));
    await service.writeFile(nonAtomicResource, VSBuffer.fromString(""));
    await service.writeFile(atomicResource, bufferToStream(VSBuffer.fromString("")));
    await service.writeFile(nonAtomicResource, bufferToStream(VSBuffer.fromString("")));
    await service.writeFile(atomicResource, bufferToReadable(VSBuffer.fromString("")));
    await service.writeFile(nonAtomicResource, bufferToReadable(VSBuffer.fromString("")));
    await service.del(atomicResource);
    await service.del(nonAtomicResource);
    assert.strictEqual(atomicReadCounter, 2);
    assert.strictEqual(atomicWriteCounter, 3);
    assert.strictEqual(atomicDeleteCounter, 1);
  });
  ensureNoDisposablesAreLeakedInTestSuite();
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9maWxlcy90ZXN0L2Jyb3dzZXIvZmlsZVNlcnZpY2UudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgdGltZW91dCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IGJ1ZmZlclRvUmVhZGFibGUsIGJ1ZmZlclRvU3RyZWFtLCBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgaXNFcXVhbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBjb25zdW1lU3RyZWFtLCBuZXdXcml0ZWFibGVTdHJlYW0sIFJlYWRhYmxlU3RyZWFtRXZlbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyZWFtLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IElGaWxlT3Blbk9wdGlvbnMsIElGaWxlUmVhZFN0cmVhbU9wdGlvbnMsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcywgRmlsZVR5cGUsIElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudCwgSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50LCBJU3RhdCwgSUZpbGVBdG9taWNSZWFkT3B0aW9ucywgSUZpbGVBdG9taWNXcml0ZU9wdGlvbnMsIElGaWxlQXRvbWljRGVsZXRlT3B0aW9ucywgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQXRvbWljUmVhZENhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY0RlbGV0ZUNhcGFiaWxpdHksIElGaWxlU3lzdGVtUHJvdmlkZXJXaXRoRmlsZUF0b21pY1dyaXRlQ2FwYWJpbGl0eSwgSUZpbGVBdG9taWNPcHRpb25zLCBJRmlsZUNoYW5nZSwgaXNGaWxlU3lzdGVtV2F0Y2hlciwgRmlsZUNoYW5nZXNFdmVudCwgRmlsZUNoYW5nZVR5cGUgfSBmcm9tICcuLi8uLi9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb21tb24vZmlsZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgTnVsbEZpbGVTeXN0ZW1Qcm92aWRlciB9IGZyb20gJy4uL2NvbW1vbi9udWxsRmlsZVN5c3RlbVByb3ZpZGVyLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuXG5zdWl0ZSgnRmlsZSBTZXJ2aWNlJywgKCkgPT4ge1xuXG5cdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdHRlYXJkb3duKCgpID0+IHtcblx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHR9KTtcblxuXHR0ZXN0KCdwcm92aWRlciByZWdpc3RyYXRpb24nLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3Qgc2VydmljZSA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRmlsZVNlcnZpY2UobmV3IE51bGxMb2dTZXJ2aWNlKCkpKTtcblx0XHRjb25zdCByZXNvdXJjZSA9IFVSSS5wYXJzZSgndGVzdDovL2Zvby9iYXInKTtcblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBOdWxsRmlsZVN5c3RlbVByb3ZpZGVyKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNQcm92aWRlcihyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5nZXRQcm92aWRlcihyZXNvdXJjZS5zY2hlbWUpLCB1bmRlZmluZWQpO1xuXG5cdFx0Y29uc3QgcmVnaXN0cmF0aW9uczogSUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbkV2ZW50W10gPSBbXTtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5vbkRpZENoYW5nZUZpbGVTeXN0ZW1Qcm92aWRlclJlZ2lzdHJhdGlvbnMoZSA9PiB7XG5cdFx0XHRyZWdpc3RyYXRpb25zLnB1c2goZSk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgY2FwYWJpbGl0eUNoYW5nZXM6IElGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXNDaGFuZ2VFdmVudFtdID0gW107XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRDaGFuZ2VGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMoZSA9PiB7XG5cdFx0XHRjYXBhYmlsaXR5Q2hhbmdlcy5wdXNoKGUpO1xuXHRcdH0pKTtcblxuXHRcdGxldCByZWdpc3RyYXRpb25EaXNwb3NhYmxlOiBJRGlzcG9zYWJsZSB8IHVuZGVmaW5lZDtcblx0XHRsZXQgY2FsbENvdW50ID0gMDtcblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5vbldpbGxBY3RpdmF0ZUZpbGVTeXN0ZW1Qcm92aWRlcihlID0+IHtcblx0XHRcdGNhbGxDb3VudCsrO1xuXG5cdFx0XHRpZiAoZS5zY2hlbWUgPT09ICd0ZXN0JyAmJiBjYWxsQ291bnQgPT09IDEpIHtcblx0XHRcdFx0ZS5qb2luKG5ldyBQcm9taXNlKHJlc29sdmUgPT4ge1xuXHRcdFx0XHRcdHJlZ2lzdHJhdGlvbkRpc3Bvc2FibGUgPSBzZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoJ3Rlc3QnLCBwcm92aWRlcik7XG5cblx0XHRcdFx0XHRyZXNvbHZlKCk7XG5cdFx0XHRcdH0pKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc1Byb3ZpZGVyKHJlc291cmNlKSwgdHJ1ZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0UHJvdmlkZXIocmVzb3VyY2Uuc2NoZW1lKSwgcHJvdmlkZXIpO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJhdGlvbnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVnaXN0cmF0aW9uc1swXS5zY2hlbWUsICd0ZXN0Jyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJhdGlvbnNbMF0uYWRkZWQsIHRydWUpO1xuXHRcdGFzc2VydC5vayhyZWdpc3RyYXRpb25EaXNwb3NhYmxlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChjYXBhYmlsaXR5Q2hhbmdlcy5sZW5ndGgsIDApO1xuXG5cdFx0cHJvdmlkZXIuc2V0Q2FwYWJpbGl0aWVzKEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlRm9sZGVyQ29weSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhcGFiaWxpdHlDaGFuZ2VzLmxlbmd0aCwgMSk7XG5cdFx0cHJvdmlkZXIuc2V0Q2FwYWJpbGl0aWVzKEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5SZWFkb25seSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNhcGFiaWxpdHlDaGFuZ2VzLmxlbmd0aCwgMik7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLmFjdGl2YXRlUHJvdmlkZXIoJ3Rlc3QnKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2FsbENvdW50LCAyKTsgLy8gYWN0aXZhdGlvbiBpcyBjYWxsZWQgYWdhaW5cblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0NhcGFiaWxpdHkocmVzb3VyY2UsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5SZWFkb25seSksIHRydWUpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmhhc0NhcGFiaWxpdHkocmVzb3VyY2UsIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlT3BlblJlYWRXcml0ZUNsb3NlKSwgZmFsc2UpO1xuXG5cdFx0cmVnaXN0cmF0aW9uRGlzcG9zYWJsZS5kaXNwb3NlKCk7XG5cblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoYXdhaXQgc2VydmljZS5jYW5IYW5kbGVSZXNvdXJjZShyZXNvdXJjZSksIGZhbHNlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS5oYXNQcm92aWRlcihyZXNvdXJjZSksIGZhbHNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyYXRpb25zLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlZ2lzdHJhdGlvbnNbMV0uc2NoZW1lLCAndGVzdCcpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZWdpc3RyYXRpb25zWzFdLmFkZGVkLCBmYWxzZSk7XG5cdH0pO1xuXG5cdHRlc3QoJ3dhdGNoJywgYXN5bmMgKCkgPT4ge1xuXHRcdGNvbnN0IHNlcnZpY2UgPSBkaXNwb3NhYmxlcy5hZGQobmV3IEZpbGVTZXJ2aWNlKG5ldyBOdWxsTG9nU2VydmljZSgpKSk7XG5cblx0XHRsZXQgZGlzcG9zZUNvdW50ZXIgPSAwO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoJ3Rlc3QnLCBuZXcgTnVsbEZpbGVTeXN0ZW1Qcm92aWRlcigoKSA9PiB7XG5cdFx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdFx0ZGlzcG9zZUNvdW50ZXIrKztcblx0XHRcdH0pO1xuXHRcdH0pKSk7XG5cdFx0YXdhaXQgc2VydmljZS5hY3RpdmF0ZVByb3ZpZGVyKCd0ZXN0Jyk7XG5cblx0XHRjb25zdCByZXNvdXJjZTEgPSBVUkkucGFyc2UoJ3Rlc3Q6Ly9mb28vYmFyMScpO1xuXHRcdGNvbnN0IHdhdGNoZXIxRGlzcG9zYWJsZSA9IHNlcnZpY2Uud2F0Y2gocmVzb3VyY2UxKTtcblxuXHRcdGF3YWl0IHRpbWVvdXQoMCk7IC8vIHNlcnZpY2Uud2F0Y2goKSBpcyBhc3luY1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXNwb3NlQ291bnRlciwgMCk7XG5cdFx0d2F0Y2hlcjFEaXNwb3NhYmxlLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlzcG9zZUNvdW50ZXIsIDEpO1xuXG5cdFx0ZGlzcG9zZUNvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IHJlc291cmNlMiA9IFVSSS5wYXJzZSgndGVzdDovL2Zvby9iYXIyJyk7XG5cdFx0Y29uc3Qgd2F0Y2hlcjJEaXNwb3NhYmxlMSA9IHNlcnZpY2Uud2F0Y2gocmVzb3VyY2UyKTtcblx0XHRjb25zdCB3YXRjaGVyMkRpc3Bvc2FibGUyID0gc2VydmljZS53YXRjaChyZXNvdXJjZTIpO1xuXHRcdGNvbnN0IHdhdGNoZXIyRGlzcG9zYWJsZTMgPSBzZXJ2aWNlLndhdGNoKHJlc291cmNlMik7XG5cblx0XHRhd2FpdCB0aW1lb3V0KDApOyAvLyBzZXJ2aWNlLndhdGNoKCkgaXMgYXN5bmNcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlzcG9zZUNvdW50ZXIsIDApO1xuXHRcdHdhdGNoZXIyRGlzcG9zYWJsZTEuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXNwb3NlQ291bnRlciwgMCk7XG5cdFx0d2F0Y2hlcjJEaXNwb3NhYmxlMi5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VDb3VudGVyLCAwKTtcblx0XHR3YXRjaGVyMkRpc3Bvc2FibGUzLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlzcG9zZUNvdW50ZXIsIDEpO1xuXG5cdFx0ZGlzcG9zZUNvdW50ZXIgPSAwO1xuXHRcdGNvbnN0IHJlc291cmNlMyA9IFVSSS5wYXJzZSgndGVzdDovL2Zvby9iYXIzJyk7XG5cdFx0Y29uc3Qgd2F0Y2hlcjNEaXNwb3NhYmxlMSA9IHNlcnZpY2Uud2F0Y2gocmVzb3VyY2UzKTtcblx0XHRjb25zdCB3YXRjaGVyM0Rpc3Bvc2FibGUyID0gc2VydmljZS53YXRjaChyZXNvdXJjZTMsIHsgcmVjdXJzaXZlOiB0cnVlLCBleGNsdWRlczogW10gfSk7XG5cdFx0Y29uc3Qgd2F0Y2hlcjNEaXNwb3NhYmxlMyA9IHNlcnZpY2Uud2F0Y2gocmVzb3VyY2UzLCB7IHJlY3Vyc2l2ZTogZmFsc2UsIGV4Y2x1ZGVzOiBbXSwgaW5jbHVkZXM6IFtdIH0pO1xuXG5cdFx0YXdhaXQgdGltZW91dCgwKTsgLy8gc2VydmljZS53YXRjaCgpIGlzIGFzeW5jXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VDb3VudGVyLCAwKTtcblx0XHR3YXRjaGVyM0Rpc3Bvc2FibGUxLmRpc3Bvc2UoKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZGlzcG9zZUNvdW50ZXIsIDEpO1xuXHRcdHdhdGNoZXIzRGlzcG9zYWJsZTIuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChkaXNwb3NlQ291bnRlciwgMik7XG5cdFx0d2F0Y2hlcjNEaXNwb3NhYmxlMy5kaXNwb3NlKCk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGRpc3Bvc2VDb3VudGVyLCAzKTtcblxuXHRcdHNlcnZpY2UuZGlzcG9zZSgpO1xuXHR9KTtcblxuXHR0ZXN0KCd3YXRjaCAtIHdpdGggY29yZWxhdGlvbicsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgY2xhc3MgZXh0ZW5kcyBOdWxsRmlsZVN5c3RlbVByb3ZpZGVyIHtcblx0XHRcdHByaXZhdGUgcmVhZG9ubHkgX3Rlc3RPbkRpZENoYW5nZUZpbGUgPSBuZXcgRW1pdHRlcjxyZWFkb25seSBJRmlsZUNoYW5nZVtdPigpO1xuXHRcdFx0b3ZlcnJpZGUgcmVhZG9ubHkgb25EaWRDaGFuZ2VGaWxlOiBFdmVudDxyZWFkb25seSBJRmlsZUNoYW5nZVtdPiA9IHRoaXMuX3Rlc3RPbkRpZENoYW5nZUZpbGUuZXZlbnQ7XG5cblx0XHRcdGZpcmVGaWxlQ2hhbmdlKGNoYW5nZXM6IHJlYWRvbmx5IElGaWxlQ2hhbmdlW10pIHtcblx0XHRcdFx0dGhpcy5fdGVzdE9uRGlkQ2hhbmdlRmlsZS5maXJlKGNoYW5nZXMpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoc2VydmljZS5yZWdpc3RlclByb3ZpZGVyKCd0ZXN0JywgcHJvdmlkZXIpKTtcblx0XHRhd2FpdCBzZXJ2aWNlLmFjdGl2YXRlUHJvdmlkZXIoJ3Rlc3QnKTtcblxuXHRcdGNvbnN0IGdsb2JhbEV2ZW50czogRmlsZUNoYW5nZXNFdmVudFtdID0gW107XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uub25EaWRGaWxlc0NoYW5nZShlID0+IHtcblx0XHRcdGdsb2JhbEV2ZW50cy5wdXNoKGUpO1xuXHRcdH0pKTtcblxuXHRcdGNvbnN0IHdhdGNoZXIwID0gZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uud2F0Y2goVVJJLnBhcnNlKCd0ZXN0Oi8vd2F0Y2gvZm9sZGVyMScpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogW10gfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbGVTeXN0ZW1XYXRjaGVyKHdhdGNoZXIwKSwgZmFsc2UpO1xuXHRcdGNvbnN0IHdhdGNoZXIxID0gZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2Uud2F0Y2goVVJJLnBhcnNlKCd0ZXN0Oi8vd2F0Y2gvZm9sZGVyMicpLCB7IHJlY3Vyc2l2ZTogdHJ1ZSwgZXhjbHVkZXM6IFtdLCBpbmNsdWRlczogW10sIGNvcnJlbGF0aW9uSWQ6IDEwMCB9KSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGlzRmlsZVN5c3RlbVdhdGNoZXIod2F0Y2hlcjEpLCB0cnVlKTtcblx0XHRjb25zdCB3YXRjaGVyMiA9IGRpc3Bvc2FibGVzLmFkZChzZXJ2aWNlLndhdGNoKFVSSS5wYXJzZSgndGVzdDovL3dhdGNoL2ZvbGRlcjMnKSwgeyByZWN1cnNpdmU6IHRydWUsIGV4Y2x1ZGVzOiBbXSwgaW5jbHVkZXM6IFtdLCBjb3JyZWxhdGlvbklkOiAyMDAgfSkpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChpc0ZpbGVTeXN0ZW1XYXRjaGVyKHdhdGNoZXIyKSwgdHJ1ZSk7XG5cblx0XHRjb25zdCB3YXRjaGVyMUV2ZW50czogRmlsZUNoYW5nZXNFdmVudFtdID0gW107XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdhdGNoZXIxLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0d2F0Y2hlcjFFdmVudHMucHVzaChlKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCB3YXRjaGVyMkV2ZW50czogRmlsZUNoYW5nZXNFdmVudFtdID0gW107XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHdhdGNoZXIyLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0d2F0Y2hlcjJFdmVudHMucHVzaChlKTtcblx0XHR9KSk7XG5cblx0XHRwcm92aWRlci5maXJlRmlsZUNoYW5nZShbeyByZXNvdXJjZTogVVJJLnBhcnNlKCd0ZXN0Oi8vd2F0Y2gvZm9sZGVyMScpLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCB9XSk7XG5cdFx0cHJvdmlkZXIuZmlyZUZpbGVDaGFuZ2UoW3sgcmVzb3VyY2U6IFVSSS5wYXJzZSgndGVzdDovL3dhdGNoL2ZvbGRlcjInKSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuQURERUQsIGNJZDogMTAwIH1dKTtcblx0XHRwcm92aWRlci5maXJlRmlsZUNoYW5nZShbeyByZXNvdXJjZTogVVJJLnBhcnNlKCd0ZXN0Oi8vd2F0Y2gvZm9sZGVyMicpLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCwgY0lkOiAxMDAgfV0pO1xuXHRcdHByb3ZpZGVyLmZpcmVGaWxlQ2hhbmdlKFt7IHJlc291cmNlOiBVUkkucGFyc2UoJ3Rlc3Q6Ly93YXRjaC9mb2xkZXIzL2ZpbGUnKSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuVVBEQVRFRCwgY0lkOiAyMDAgfV0pO1xuXHRcdHByb3ZpZGVyLmZpcmVGaWxlQ2hhbmdlKFt7IHJlc291cmNlOiBVUkkucGFyc2UoJ3Rlc3Q6Ly93YXRjaC9mb2xkZXIzJyksIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLlVQREFURUQsIGNJZDogMjAwIH1dKTtcblxuXHRcdHByb3ZpZGVyLmZpcmVGaWxlQ2hhbmdlKFt7IHJlc291cmNlOiBVUkkucGFyc2UoJ3Rlc3Q6Ly93YXRjaC9mb2xkZXI0JyksIHR5cGU6IEZpbGVDaGFuZ2VUeXBlLkFEREVELCBjSWQ6IDUwIH1dKTtcblx0XHRwcm92aWRlci5maXJlRmlsZUNoYW5nZShbeyByZXNvdXJjZTogVVJJLnBhcnNlKCd0ZXN0Oi8vd2F0Y2gvZm9sZGVyNCcpLCB0eXBlOiBGaWxlQ2hhbmdlVHlwZS5BRERFRCwgY0lkOiA2MCB9XSk7XG5cdFx0cHJvdmlkZXIuZmlyZUZpbGVDaGFuZ2UoW3sgcmVzb3VyY2U6IFVSSS5wYXJzZSgndGVzdDovL3dhdGNoL2ZvbGRlcjQnKSwgdHlwZTogRmlsZUNoYW5nZVR5cGUuQURERUQsIGNJZDogNzAgfV0pO1xuXG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGdsb2JhbEV2ZW50cy5sZW5ndGgsIDEpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3YXRjaGVyMUV2ZW50cy5sZW5ndGgsIDIpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbCh3YXRjaGVyMkV2ZW50cy5sZW5ndGgsIDIpO1xuXHR9KTtcblxuXHR0ZXN0KCdlcnJvciBmcm9tIHJlYWRGaWxlIGJ1YmJsZXMgdGhyb3VnaCAoaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzExODA2MCkgLSBhc3luYycsIGFzeW5jICgpID0+IHtcblx0XHR0ZXN0UmVhZEVycm9yQnViYmxlcyh0cnVlKTtcblx0fSk7XG5cblx0dGVzdCgnZXJyb3IgZnJvbSByZWFkRmlsZSBidWJibGVzIHRocm91Z2ggKGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMTgwNjApJywgYXN5bmMgKCkgPT4ge1xuXHRcdHRlc3RSZWFkRXJyb3JCdWJibGVzKGZhbHNlKTtcblx0fSk7XG5cblx0YXN5bmMgZnVuY3Rpb24gdGVzdFJlYWRFcnJvckJ1YmJsZXMoYXN5bmM6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBzZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgY2xhc3MgZXh0ZW5kcyBOdWxsRmlsZVN5c3RlbVByb3ZpZGVyIHtcblx0XHRcdG92ZXJyaWRlIGFzeW5jIHN0YXQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN0YXQ+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRjdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRzaXplOiAxMDAsXG5cdFx0XHRcdFx0dHlwZTogRmlsZVR5cGUuRmlsZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSByZWFkRmlsZShyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxVaW50OEFycmF5PiB7XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdHJldHVybiB0aW1lb3V0KDUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4oKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2ZhaWxlZCcpOyB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZmFpbGVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIG9wZW4ocmVzb3VyY2U6IFVSSSwgb3B0czogSUZpbGVPcGVuT3B0aW9ucyk6IFByb21pc2U8bnVtYmVyPiB7XG5cdFx0XHRcdGlmIChhc3luYykge1xuXHRcdFx0XHRcdHJldHVybiB0aW1lb3V0KDUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4oKCkgPT4geyB0aHJvdyBuZXcgRXJyb3IoJ2ZhaWxlZCcpOyB9KTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZmFpbGVkJyk7XG5cdFx0XHR9XG5cblx0XHRcdG92ZXJyaWRlIHJlYWRGaWxlU3RyZWFtKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlUmVhZFN0cmVhbU9wdGlvbnMsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFJlYWRhYmxlU3RyZWFtRXZlbnRzPFVpbnQ4QXJyYXk+IHtcblx0XHRcdFx0aWYgKGFzeW5jKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc3RyZWFtID0gbmV3V3JpdGVhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+KGNodW5rID0+IGNodW5rWzBdKTtcblx0XHRcdFx0XHR0aW1lb3V0KDUsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpLnRoZW4oKCkgPT4gc3RyZWFtLmVycm9yKG5ldyBFcnJvcignZmFpbGVkJykpKTtcblxuXHRcdFx0XHRcdHJldHVybiBzdHJlYW07XG5cblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignZmFpbGVkJyk7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXJ2aWNlLnJlZ2lzdGVyUHJvdmlkZXIoJ3Rlc3QnLCBwcm92aWRlcikpO1xuXG5cdFx0Zm9yIChjb25zdCBjYXBhYmlsaXRpZXMgb2YgW0ZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlUmVhZFdyaXRlLCBGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZVJlYWRTdHJlYW0sIEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlT3BlblJlYWRXcml0ZUNsb3NlXSkge1xuXHRcdFx0cHJvdmlkZXIuc2V0Q2FwYWJpbGl0aWVzKGNhcGFiaWxpdGllcyk7XG5cblx0XHRcdGxldCBlMTtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGF3YWl0IHNlcnZpY2UucmVhZEZpbGUoVVJJLnBhcnNlKCd0ZXN0Oi8vZm9vL2JhcicpKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGUxID0gZXJyb3I7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5vayhlMSk7XG5cblx0XHRcdGxldCBlMjtcblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHN0cmVhbSA9IGF3YWl0IHNlcnZpY2UucmVhZEZpbGVTdHJlYW0oVVJJLnBhcnNlKCd0ZXN0Oi8vZm9vL2JhcicpKTtcblx0XHRcdFx0YXdhaXQgY29uc3VtZVN0cmVhbShzdHJlYW0udmFsdWUsIGNodW5rID0+IGNodW5rWzBdKTtcblx0XHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRcdGUyID0gZXJyb3I7XG5cdFx0XHR9XG5cblx0XHRcdGFzc2VydC5vayhlMik7XG5cdFx0fVxuXHR9XG5cblx0dGVzdCgncmVhZEZpbGUvcmVhZEZpbGVTdHJlYW0gc3VwcG9ydHMgY2FuY2VsbGF0aW9uIChodHRwczovL2dpdGh1Yi5jb20vbWljcm9zb2Z0L3ZzY29kZS9pc3N1ZXMvMTM4ODA1KScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXG5cdFx0bGV0IHJlYWRGaWxlU3RyZWFtUmVhZHk6IERlZmVycmVkUHJvbWlzZTx2b2lkPiB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gbmV3IGNsYXNzIGV4dGVuZHMgTnVsbEZpbGVTeXN0ZW1Qcm92aWRlciB7XG5cblx0XHRcdG92ZXJyaWRlIGFzeW5jIHN0YXQocmVzb3VyY2U6IFVSSSk6IFByb21pc2U8SVN0YXQ+IHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRtdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRjdGltZTogRGF0ZS5ub3coKSxcblx0XHRcdFx0XHRzaXplOiAxMDAsXG5cdFx0XHRcdFx0dHlwZTogRmlsZVR5cGUuRmlsZVxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSByZWFkRmlsZVN0cmVhbShyZXNvdXJjZTogVVJJLCBvcHRzOiBJRmlsZVJlYWRTdHJlYW1PcHRpb25zLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBSZWFkYWJsZVN0cmVhbUV2ZW50czxVaW50OEFycmF5PiB7XG5cdFx0XHRcdGNvbnN0IHN0cmVhbSA9IG5ld1dyaXRlYWJsZVN0cmVhbTxVaW50OEFycmF5PihjaHVuayA9PiBjaHVua1swXSk7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0c3RyZWFtLmVycm9yKG5ldyBFcnJvcignRXhwZWN0ZWQgY2FuY2VsbGF0aW9uJykpO1xuXHRcdFx0XHRcdHN0cmVhbS5lbmQoKTtcblx0XHRcdFx0fSkpO1xuXG5cdFx0XHRcdHJlYWRGaWxlU3RyZWFtUmVhZHkhLmNvbXBsZXRlKCk7XG5cblx0XHRcdFx0cmV0dXJuIHN0cmVhbTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcigndGVzdCcsIHByb3ZpZGVyKSk7XG5cblx0XHRwcm92aWRlci5zZXRDYXBhYmlsaXRpZXMoRmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVSZWFkU3RyZWFtKTtcblxuXHRcdGxldCBlMTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgY3RzID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRyZWFkRmlsZVN0cmVhbVJlYWR5ID0gbmV3IERlZmVycmVkUHJvbWlzZSgpO1xuXHRcdFx0Y29uc3QgcHJvbWlzZSA9IHNlcnZpY2UucmVhZEZpbGUoVVJJLnBhcnNlKCd0ZXN0Oi8vZm9vL2JhcicpLCB1bmRlZmluZWQsIGN0cy50b2tlbik7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbcmVhZEZpbGVTdHJlYW1SZWFkeS5wLnRoZW4oKCkgPT4gY3RzLmNhbmNlbCgpKSwgcHJvbWlzZV0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRlMSA9IGVycm9yO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhlMSk7XG5cblx0XHRsZXQgZTI7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdFx0cmVhZEZpbGVTdHJlYW1SZWFkeSA9IG5ldyBEZWZlcnJlZFByb21pc2UoKTtcblx0XHRcdGNvbnN0IHN0cmVhbSA9IGF3YWl0IHNlcnZpY2UucmVhZEZpbGVTdHJlYW0oVVJJLnBhcnNlKCd0ZXN0Oi8vZm9vL2JhcicpLCB1bmRlZmluZWQsIGN0cy50b2tlbik7XG5cdFx0XHRhd2FpdCBQcm9taXNlLmFsbChbcmVhZEZpbGVTdHJlYW1SZWFkeS5wLnRoZW4oKCkgPT4gY3RzLmNhbmNlbCgpKSwgY29uc3VtZVN0cmVhbShzdHJlYW0udmFsdWUsIGNodW5rID0+IGNodW5rWzBdKV0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRlMiA9IGVycm9yO1xuXHRcdH1cblxuXHRcdGFzc2VydC5vayhlMik7XG5cdH0pO1xuXG5cdHRlc3QoJ2VuZm9yY2VkIGF0b21pYyByZWFkL3dyaXRlL2RlbGV0ZScsIGFzeW5jICgpID0+IHtcblx0XHRjb25zdCBzZXJ2aWNlID0gZGlzcG9zYWJsZXMuYWRkKG5ldyBGaWxlU2VydmljZShuZXcgTnVsbExvZ1NlcnZpY2UoKSkpO1xuXG5cdFx0Y29uc3QgYXRvbWljUmVzb3VyY2UgPSBVUkkucGFyc2UoJ3Rlc3Q6Ly9mb28vYmFyL2F0b21pYycpO1xuXHRcdGNvbnN0IG5vbkF0b21pY1Jlc291cmNlID0gVVJJLnBhcnNlKCd0ZXN0Oi8vZm9vL25vbmF0b21pYycpO1xuXG5cdFx0bGV0IGF0b21pY1JlYWRDb3VudGVyID0gMDtcblx0XHRsZXQgYXRvbWljV3JpdGVDb3VudGVyID0gMDtcblx0XHRsZXQgYXRvbWljRGVsZXRlQ291bnRlciA9IDA7XG5cblx0XHRjb25zdCBwcm92aWRlciA9IG5ldyBjbGFzcyBleHRlbmRzIE51bGxGaWxlU3lzdGVtUHJvdmlkZXIgaW1wbGVtZW50cyBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNSZWFkQ2FwYWJpbGl0eSwgSUZpbGVTeXN0ZW1Qcm92aWRlcldpdGhGaWxlQXRvbWljV3JpdGVDYXBhYmlsaXR5LCBJRmlsZVN5c3RlbVByb3ZpZGVyV2l0aEZpbGVBdG9taWNEZWxldGVDYXBhYmlsaXR5IHtcblxuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgc3RhdChyZXNvdXJjZTogVVJJKTogUHJvbWlzZTxJU3RhdD4ge1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHR5cGU6IEZpbGVUeXBlLkZpbGUsXG5cdFx0XHRcdFx0Y3RpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdFx0bXRpbWU6IERhdGUubm93KCksXG5cdFx0XHRcdFx0c2l6ZTogMFxuXHRcdFx0XHR9O1xuXHRcdFx0fVxuXG5cdFx0XHRvdmVycmlkZSBhc3luYyByZWFkRmlsZShyZXNvdXJjZTogVVJJLCBvcHRzPzogSUZpbGVBdG9taWNSZWFkT3B0aW9ucyk6IFByb21pc2U8VWludDhBcnJheT4ge1xuXHRcdFx0XHRpZiAob3B0cz8uYXRvbWljKSB7XG5cdFx0XHRcdFx0YXRvbWljUmVhZENvdW50ZXIrKztcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gbmV3IFVpbnQ4QXJyYXkoKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgcmVhZEZpbGVTdHJlYW0ocmVzb3VyY2U6IFVSSSwgb3B0czogSUZpbGVSZWFkU3RyZWFtT3B0aW9ucywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUmVhZGFibGVTdHJlYW1FdmVudHM8VWludDhBcnJheT4ge1xuXHRcdFx0XHRyZXR1cm4gbmV3V3JpdGVhYmxlU3RyZWFtPFVpbnQ4QXJyYXk+KGNodW5rID0+IGNodW5rWzBdKTtcblx0XHRcdH1cblxuXHRcdFx0ZW5mb3JjZUF0b21pY1JlYWRGaWxlKHJlc291cmNlOiBVUkkpOiBib29sZWFuIHtcblx0XHRcdFx0cmV0dXJuIGlzRXF1YWwocmVzb3VyY2UsIGF0b21pY1Jlc291cmNlKTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgd3JpdGVGaWxlKHJlc291cmNlOiBVUkksIGNvbnRlbnQ6IFVpbnQ4QXJyYXksIG9wdHM6IElGaWxlQXRvbWljV3JpdGVPcHRpb25zKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRcdGlmIChvcHRzLmF0b21pYykge1xuXHRcdFx0XHRcdGF0b21pY1dyaXRlQ291bnRlcisrO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGVuZm9yY2VBdG9taWNXcml0ZUZpbGUocmVzb3VyY2U6IFVSSSk6IElGaWxlQXRvbWljT3B0aW9ucyB8IGZhbHNlIHtcblx0XHRcdFx0cmV0dXJuIGlzRXF1YWwocmVzb3VyY2UsIGF0b21pY1Jlc291cmNlKSA/IHsgcG9zdGZpeDogJy50bXAnIH0gOiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0b3ZlcnJpZGUgYXN5bmMgZGVsZXRlKHJlc291cmNlOiBVUkksIG9wdHM6IElGaWxlQXRvbWljRGVsZXRlT3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdFx0XHRpZiAob3B0cy5hdG9taWMpIHtcblx0XHRcdFx0XHRhdG9taWNEZWxldGVDb3VudGVyKys7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0ZW5mb3JjZUF0b21pY0RlbGV0ZShyZXNvdXJjZTogVVJJKTogSUZpbGVBdG9taWNPcHRpb25zIHwgZmFsc2Uge1xuXHRcdFx0XHRyZXR1cm4gaXNFcXVhbChyZXNvdXJjZSwgYXRvbWljUmVzb3VyY2UpID8geyBwb3N0Zml4OiAnLnRtcCcgfSA6IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRwcm92aWRlci5zZXRDYXBhYmlsaXRpZXMoXG5cdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZVJlYWRXcml0ZSB8XG5cdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZU9wZW5SZWFkV3JpdGVDbG9zZSB8XG5cdFx0XHRGaWxlU3lzdGVtUHJvdmlkZXJDYXBhYmlsaXRpZXMuRmlsZVJlYWRTdHJlYW0gfFxuXHRcdFx0RmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVBdG9taWNSZWFkIHxcblx0XHRcdEZpbGVTeXN0ZW1Qcm92aWRlckNhcGFiaWxpdGllcy5GaWxlQXRvbWljV3JpdGUgfFxuXHRcdFx0RmlsZVN5c3RlbVByb3ZpZGVyQ2FwYWJpbGl0aWVzLkZpbGVBdG9taWNEZWxldGVcblx0XHQpO1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlcnZpY2UucmVnaXN0ZXJQcm92aWRlcigndGVzdCcsIHByb3ZpZGVyKSk7XG5cblx0XHRhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlKGF0b21pY1Jlc291cmNlKTtcblx0XHRhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlKG5vbkF0b21pY1Jlc291cmNlKTtcblx0XHRhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlU3RyZWFtKGF0b21pY1Jlc291cmNlKTtcblx0XHRhd2FpdCBzZXJ2aWNlLnJlYWRGaWxlU3RyZWFtKG5vbkF0b21pY1Jlc291cmNlKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGVGaWxlKGF0b21pY1Jlc291cmNlLCBWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKSk7XG5cdFx0YXdhaXQgc2VydmljZS53cml0ZUZpbGUobm9uQXRvbWljUmVzb3VyY2UsIFZTQnVmZmVyLmZyb21TdHJpbmcoJycpKTtcblxuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGVGaWxlKGF0b21pY1Jlc291cmNlLCBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKSkpO1xuXHRcdGF3YWl0IHNlcnZpY2Uud3JpdGVGaWxlKG5vbkF0b21pY1Jlc291cmNlLCBidWZmZXJUb1N0cmVhbShWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKSkpO1xuXG5cdFx0YXdhaXQgc2VydmljZS53cml0ZUZpbGUoYXRvbWljUmVzb3VyY2UsIGJ1ZmZlclRvUmVhZGFibGUoVlNCdWZmZXIuZnJvbVN0cmluZygnJykpKTtcblx0XHRhd2FpdCBzZXJ2aWNlLndyaXRlRmlsZShub25BdG9taWNSZXNvdXJjZSwgYnVmZmVyVG9SZWFkYWJsZShWU0J1ZmZlci5mcm9tU3RyaW5nKCcnKSkpO1xuXG5cdFx0YXdhaXQgc2VydmljZS5kZWwoYXRvbWljUmVzb3VyY2UpO1xuXHRcdGF3YWl0IHNlcnZpY2UuZGVsKG5vbkF0b21pY1Jlc291cmNlKTtcblxuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChhdG9taWNSZWFkQ291bnRlciwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF0b21pY1dyaXRlQ291bnRlciwgMyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGF0b21pY0RlbGV0ZUNvdW50ZXIsIDEpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMsaUJBQWlCLGVBQWU7QUFDekMsU0FBUyxrQkFBa0IsZ0JBQWdCLGdCQUFnQjtBQUMzRCxTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGlCQUE4QixvQkFBb0I7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZUFBZSwwQkFBZ0Q7QUFDeEUsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsK0NBQStDO0FBQ3hELFNBQW1ELGdDQUFnQyxVQUFxVyxxQkFBdUMsc0JBQXNCO0FBQ3JmLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sZ0JBQWdCLE1BQU07QUFFM0IsUUFBTSxjQUFjLElBQUksZ0JBQWdCO0FBRXhDLFdBQVMsTUFBTTtBQUNkLGdCQUFZLE1BQU07QUFBQSxFQUNuQixDQUFDO0FBRUQsT0FBSyx5QkFBeUIsWUFBWTtBQUN6QyxVQUFNLFVBQVUsWUFBWSxJQUFJLElBQUksWUFBWSxJ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
