import assert from "assert";
import * as sinon from "sinon";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../base/test/common/utils.js";
import { KnownStorageProvider } from "../../../encryption/common/encryptionService.js";
import { NullLogService } from "../../../log/common/log.js";
import { BaseSecretStorageService } from "../../common/secrets.js";
import { InMemoryStorageService } from "../../../storage/common/storage.js";
class TestEncryptionService {
  constructor() {
    this.encryptedPrefix = "encrypted+";
  }
  // prefix to simulate encryption
  setUsePlainTextEncryption() {
    return Promise.resolve();
  }
  getKeyStorageProvider() {
    return Promise.resolve(KnownStorageProvider.basicText);
  }
  encrypt(value) {
    return Promise.resolve(this.encryptedPrefix + value);
  }
  decrypt(value) {
    return Promise.resolve(value.substring(this.encryptedPrefix.length));
  }
  isEncryptionAvailable() {
    return Promise.resolve(true);
  }
}
class TestNoEncryptionService {
  setUsePlainTextEncryption() {
    throw new Error("Method not implemented.");
  }
  getKeyStorageProvider() {
    throw new Error("Method not implemented.");
  }
  encrypt(value) {
    throw new Error("Method not implemented.");
  }
  decrypt(value) {
    throw new Error("Method not implemented.");
  }
  isEncryptionAvailable() {
    return Promise.resolve(false);
  }
}
suite("secrets", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  suite("BaseSecretStorageService useInMemoryStorage=true", () => {
    let service;
    let spyEncryptionService;
    let sandbox;
    setup(() => {
      sandbox = sinon.createSandbox();
      spyEncryptionService = sandbox.spy(new TestEncryptionService());
      service = store.add(new BaseSecretStorageService(
        true,
        store.add(new InMemoryStorageService()),
        spyEncryptionService,
        store.add(new NullLogService())
      ));
    });
    teardown(() => {
      sandbox.restore();
    });
    test("type", async () => {
      assert.strictEqual(service.type, "unknown");
      await service.set("my-secret", "my-secret-value");
      assert.strictEqual(service.type, "in-memory");
    });
    test("set and get", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      await service.set(key, value);
      const result = await service.get(key);
      assert.strictEqual(result, value);
      assert.strictEqual(spyEncryptionService.encrypt.callCount, 0);
      assert.strictEqual(spyEncryptionService.decrypt.callCount, 0);
    });
    test("delete", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      await service.set(key, value);
      await service.delete(key);
      const result = await service.get(key);
      assert.strictEqual(result, void 0);
    });
    test("onDidChangeSecret", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      let eventFired = false;
      store.add(service.onDidChangeSecret((changedKey) => {
        assert.strictEqual(changedKey, key);
        eventFired = true;
      }));
      await service.set(key, value);
      assert.strictEqual(eventFired, true);
    });
  });
  suite("BaseSecretStorageService useInMemoryStorage=false", () => {
    let service;
    let spyEncryptionService;
    let sandbox;
    setup(() => {
      sandbox = sinon.createSandbox();
      spyEncryptionService = sandbox.spy(new TestEncryptionService());
      service = store.add(
        new BaseSecretStorageService(
          false,
          store.add(new InMemoryStorageService()),
          spyEncryptionService,
          store.add(new NullLogService())
        )
      );
    });
    teardown(() => {
      sandbox.restore();
    });
    test("type", async () => {
      assert.strictEqual(service.type, "unknown");
      await service.set("my-secret", "my-secret-value");
      assert.strictEqual(service.type, "persisted");
    });
    test("set and get", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      await service.set(key, value);
      const result = await service.get(key);
      assert.strictEqual(result, value);
      assert.strictEqual(spyEncryptionService.encrypt.callCount, 1);
      assert.strictEqual(spyEncryptionService.decrypt.callCount, 1);
    });
    test("delete", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      await service.set(key, value);
      await service.delete(key);
      const result = await service.get(key);
      assert.strictEqual(result, void 0);
    });
    test("onDidChangeSecret", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      let eventFired = false;
      store.add(service.onDidChangeSecret((changedKey) => {
        assert.strictEqual(changedKey, key);
        eventFired = true;
      }));
      await service.set(key, value);
      assert.strictEqual(eventFired, true);
    });
  });
  suite("BaseSecretStorageService useInMemoryStorage=false, encryption not available", () => {
    let service;
    let spyNoEncryptionService;
    let sandbox;
    setup(() => {
      sandbox = sinon.createSandbox();
      spyNoEncryptionService = sandbox.spy(new TestNoEncryptionService());
      service = store.add(
        new BaseSecretStorageService(
          false,
          store.add(new InMemoryStorageService()),
          spyNoEncryptionService,
          store.add(new NullLogService())
        )
      );
    });
    teardown(() => {
      sandbox.restore();
    });
    test("type", async () => {
      assert.strictEqual(service.type, "unknown");
      await service.set("my-secret", "my-secret-value");
      assert.strictEqual(service.type, "in-memory");
    });
    test("set and get", async () => {
      const key = "my-secret";
      const value = "my-secret-value";
      await service.set(key, value);
      const result = await service.get(key);
      assert.strictEqual(result, value);
      assert.strictEqual(spyNoEncryptionService.encrypt.callCount, 0);
      assert.strictEqual(spyNoEncryptionService.decrypt.callCount, 0);
    });
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9zZWNyZXRzL3Rlc3QvY29tbW9uL3NlY3JldHMudGVzdC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCAqIGFzIHNpbm9uIGZyb20gJ3Npbm9uJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgSUVuY3J5cHRpb25TZXJ2aWNlLCBLbm93blN0b3JhZ2VQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uL2VuY3J5cHRpb24vY29tbW9uL2VuY3J5cHRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL3NlY3JldHMuanMnO1xuaW1wb3J0IHsgSW5NZW1vcnlTdG9yYWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5jbGFzcyBUZXN0RW5jcnlwdGlvblNlcnZpY2UgaW1wbGVtZW50cyBJRW5jcnlwdGlvblNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHByaXZhdGUgZW5jcnlwdGVkUHJlZml4ID0gJ2VuY3J5cHRlZCsnOyAvLyBwcmVmaXggdG8gc2ltdWxhdGUgZW5jcnlwdGlvblxuXHRzZXRVc2VQbGFpblRleHRFbmNyeXB0aW9uKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcblx0fVxuXHRnZXRLZXlTdG9yYWdlUHJvdmlkZXIoKTogUHJvbWlzZTxLbm93blN0b3JhZ2VQcm92aWRlcj4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoS25vd25TdG9yYWdlUHJvdmlkZXIuYmFzaWNUZXh0KTtcblx0fVxuXHRlbmNyeXB0KHZhbHVlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZz4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5lbmNyeXB0ZWRQcmVmaXggKyB2YWx1ZSk7XG5cdH1cblx0ZGVjcnlwdCh2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHRyZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHZhbHVlLnN1YnN0cmluZyh0aGlzLmVuY3J5cHRlZFByZWZpeC5sZW5ndGgpKTtcblx0fVxuXHRpc0VuY3J5cHRpb25BdmFpbGFibGUoKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSh0cnVlKTtcblx0fVxufVxuXG5jbGFzcyBUZXN0Tm9FbmNyeXB0aW9uU2VydmljZSBpbXBsZW1lbnRzIElFbmNyeXB0aW9uU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0c2V0VXNlUGxhaW5UZXh0RW5jcnlwdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0Z2V0S2V5U3RvcmFnZVByb3ZpZGVyKCk6IFByb21pc2U8S25vd25TdG9yYWdlUHJvdmlkZXI+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0ZW5jcnlwdCh2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0ZGVjcnlwdCh2YWx1ZTogc3RyaW5nKTogUHJvbWlzZTxzdHJpbmc+IHtcblx0XHR0aHJvdyBuZXcgRXJyb3IoJ01ldGhvZCBub3QgaW1wbGVtZW50ZWQuJyk7XG5cdH1cblx0aXNFbmNyeXB0aW9uQXZhaWxhYmxlKCk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoZmFsc2UpO1xuXHR9XG59XG5cbnN1aXRlKCdzZWNyZXRzJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdHN1aXRlKCdCYXNlU2VjcmV0U3RvcmFnZVNlcnZpY2UgdXNlSW5NZW1vcnlTdG9yYWdlPXRydWUnLCAoKSA9PiB7XG5cdFx0bGV0IHNlcnZpY2U6IEJhc2VTZWNyZXRTdG9yYWdlU2VydmljZTtcblx0XHRsZXQgc3B5RW5jcnlwdGlvblNlcnZpY2U6IHNpbm9uLlNpbm9uU3BpZWRJbnN0YW5jZTxUZXN0RW5jcnlwdGlvblNlcnZpY2U+O1xuXHRcdGxldCBzYW5kYm94OiBzaW5vbi5TaW5vblNhbmRib3g7XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuXHRcdFx0c3B5RW5jcnlwdGlvblNlcnZpY2UgPSBzYW5kYm94LnNweShuZXcgVGVzdEVuY3J5cHRpb25TZXJ2aWNlKCkpO1xuXHRcdFx0c2VydmljZSA9IHN0b3JlLmFkZChuZXcgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlKFxuXHRcdFx0XHR0cnVlLFxuXHRcdFx0XHRzdG9yZS5hZGQobmV3IEluTWVtb3J5U3RvcmFnZVNlcnZpY2UoKSksXG5cdFx0XHRcdHNweUVuY3J5cHRpb25TZXJ2aWNlLFxuXHRcdFx0XHRzdG9yZS5hZGQobmV3IE51bGxMb2dTZXJ2aWNlKCkpXG5cdFx0XHQpKTtcblx0XHR9KTtcblxuXHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdHNhbmRib3gucmVzdG9yZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndHlwZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnR5cGUsICd1bmtub3duJyk7XG5cdFx0XHQvLyB0cmlnZ2VyIGxhenkgaW5pdGlhbGl6YXRpb25cblx0XHRcdGF3YWl0IHNlcnZpY2Uuc2V0KCdteS1zZWNyZXQnLCAnbXktc2VjcmV0LXZhbHVlJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnR5cGUsICdpbi1tZW1vcnknKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NldCBhbmQgZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qga2V5ID0gJ215LXNlY3JldCc7XG5cdFx0XHRjb25zdCB2YWx1ZSA9ICdteS1zZWNyZXQtdmFsdWUnO1xuXHRcdFx0YXdhaXQgc2VydmljZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLmdldChrZXkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgdmFsdWUpO1xuXG5cdFx0XHQvLyBBZGRpdGlvbmFsbHkgZW5zdXJlIHRoZSBlbmNyeXB0aW9uc2VydmljZSB3YXMgbm90IHVzZWRcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcHlFbmNyeXB0aW9uU2VydmljZS5lbmNyeXB0LmNhbGxDb3VudCwgMCk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3B5RW5jcnlwdGlvblNlcnZpY2UuZGVjcnlwdC5jYWxsQ291bnQsIDApO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnZGVsZXRlJywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qga2V5ID0gJ215LXNlY3JldCc7XG5cdFx0XHRjb25zdCB2YWx1ZSA9ICdteS1zZWNyZXQtdmFsdWUnO1xuXHRcdFx0YXdhaXQgc2VydmljZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLmRlbGV0ZShrZXkpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5nZXQoa2V5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdvbkRpZENoYW5nZVNlY3JldCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGtleSA9ICdteS1zZWNyZXQnO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSAnbXktc2VjcmV0LXZhbHVlJztcblx0XHRcdGxldCBldmVudEZpcmVkID0gZmFsc2U7XG5cdFx0XHRzdG9yZS5hZGQoc2VydmljZS5vbkRpZENoYW5nZVNlY3JldCgoY2hhbmdlZEtleSkgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoY2hhbmdlZEtleSwga2V5KTtcblx0XHRcdFx0ZXZlbnRGaXJlZCA9IHRydWU7XG5cdFx0XHR9KSk7XG5cdFx0XHRhd2FpdCBzZXJ2aWNlLnNldChrZXksIHZhbHVlKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChldmVudEZpcmVkLCB0cnVlKTtcblx0XHR9KTtcblx0fSk7XG5cblx0c3VpdGUoJ0Jhc2VTZWNyZXRTdG9yYWdlU2VydmljZSB1c2VJbk1lbW9yeVN0b3JhZ2U9ZmFsc2UnLCAoKSA9PiB7XG5cdFx0bGV0IHNlcnZpY2U6IEJhc2VTZWNyZXRTdG9yYWdlU2VydmljZTtcblx0XHRsZXQgc3B5RW5jcnlwdGlvblNlcnZpY2U6IHNpbm9uLlNpbm9uU3BpZWRJbnN0YW5jZTxUZXN0RW5jcnlwdGlvblNlcnZpY2U+O1xuXHRcdGxldCBzYW5kYm94OiBzaW5vbi5TaW5vblNhbmRib3g7XG5cblx0XHRzZXR1cCgoKSA9PiB7XG5cdFx0XHRzYW5kYm94ID0gc2lub24uY3JlYXRlU2FuZGJveCgpO1xuXHRcdFx0c3B5RW5jcnlwdGlvblNlcnZpY2UgPSBzYW5kYm94LnNweShuZXcgVGVzdEVuY3J5cHRpb25TZXJ2aWNlKCkpO1xuXHRcdFx0c2VydmljZSA9IHN0b3JlLmFkZChuZXcgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlKCkpLFxuXHRcdFx0XHRzcHlFbmNyeXB0aW9uU2VydmljZSxcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBOdWxsTG9nU2VydmljZSgpKSlcblx0XHRcdCk7XG5cdFx0fSk7XG5cblx0XHR0ZWFyZG93bigoKSA9PiB7XG5cdFx0XHRzYW5kYm94LnJlc3RvcmUoKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3R5cGUnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50eXBlLCAndW5rbm93bicpO1xuXHRcdFx0Ly8gdHJpZ2dlciBsYXp5IGluaXRpYWxpemF0aW9uXG5cdFx0XHRhd2FpdCBzZXJ2aWNlLnNldCgnbXktc2VjcmV0JywgJ215LXNlY3JldC12YWx1ZScpO1xuXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc2VydmljZS50eXBlLCAncGVyc2lzdGVkJyk7XG5cdFx0fSk7XG5cblx0XHR0ZXN0KCdzZXQgYW5kIGdldCcsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGtleSA9ICdteS1zZWNyZXQnO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSAnbXktc2VjcmV0LXZhbHVlJztcblx0XHRcdGF3YWl0IHNlcnZpY2Uuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5nZXQoa2V5KTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChyZXN1bHQsIHZhbHVlKTtcblxuXHRcdFx0Ly8gQWRkaXRpb25hbGx5IGVuc3VyZSB0aGUgZW5jcnlwdGlvbnNlcnZpY2Ugd2FzIG5vdCB1c2VkXG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoc3B5RW5jcnlwdGlvblNlcnZpY2UuZW5jcnlwdC5jYWxsQ291bnQsIDEpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNweUVuY3J5cHRpb25TZXJ2aWNlLmRlY3J5cHQuY2FsbENvdW50LCAxKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ2RlbGV0ZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGtleSA9ICdteS1zZWNyZXQnO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSAnbXktc2VjcmV0LXZhbHVlJztcblx0XHRcdGF3YWl0IHNlcnZpY2Uuc2V0KGtleSwgdmFsdWUpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5kZWxldGUoa2V5KTtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHNlcnZpY2UuZ2V0KGtleSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocmVzdWx0LCB1bmRlZmluZWQpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgnb25EaWRDaGFuZ2VTZWNyZXQnLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBrZXkgPSAnbXktc2VjcmV0Jztcblx0XHRcdGNvbnN0IHZhbHVlID0gJ215LXNlY3JldC12YWx1ZSc7XG5cdFx0XHRsZXQgZXZlbnRGaXJlZCA9IGZhbHNlO1xuXHRcdFx0c3RvcmUuYWRkKHNlcnZpY2Uub25EaWRDaGFuZ2VTZWNyZXQoKGNoYW5nZWRLZXkpID0+IHtcblx0XHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKGNoYW5nZWRLZXksIGtleSk7XG5cdFx0XHRcdGV2ZW50RmlyZWQgPSB0cnVlO1xuXHRcdFx0fSkpO1xuXHRcdFx0YXdhaXQgc2VydmljZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoZXZlbnRGaXJlZCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH0pO1xuXG5cdHN1aXRlKCdCYXNlU2VjcmV0U3RvcmFnZVNlcnZpY2UgdXNlSW5NZW1vcnlTdG9yYWdlPWZhbHNlLCBlbmNyeXB0aW9uIG5vdCBhdmFpbGFibGUnLCAoKSA9PiB7XG5cdFx0bGV0IHNlcnZpY2U6IEJhc2VTZWNyZXRTdG9yYWdlU2VydmljZTtcblx0XHRsZXQgc3B5Tm9FbmNyeXB0aW9uU2VydmljZTogc2lub24uU2lub25TcGllZEluc3RhbmNlPFRlc3RFbmNyeXB0aW9uU2VydmljZT47XG5cdFx0bGV0IHNhbmRib3g6IHNpbm9uLlNpbm9uU2FuZGJveDtcblxuXHRcdHNldHVwKCgpID0+IHtcblx0XHRcdHNhbmRib3ggPSBzaW5vbi5jcmVhdGVTYW5kYm94KCk7XG5cdFx0XHRzcHlOb0VuY3J5cHRpb25TZXJ2aWNlID0gc2FuZGJveC5zcHkobmV3IFRlc3ROb0VuY3J5cHRpb25TZXJ2aWNlKCkpO1xuXHRcdFx0c2VydmljZSA9IHN0b3JlLmFkZChuZXcgQmFzZVNlY3JldFN0b3JhZ2VTZXJ2aWNlKFxuXHRcdFx0XHRmYWxzZSxcblx0XHRcdFx0c3RvcmUuYWRkKG5ldyBJbk1lbW9yeVN0b3JhZ2VTZXJ2aWNlKCkpLFxuXHRcdFx0XHRzcHlOb0VuY3J5cHRpb25TZXJ2aWNlLFxuXHRcdFx0XHRzdG9yZS5hZGQobmV3IE51bGxMb2dTZXJ2aWNlKCkpKVxuXHRcdFx0KTtcblx0XHR9KTtcblxuXHRcdHRlYXJkb3duKCgpID0+IHtcblx0XHRcdHNhbmRib3gucmVzdG9yZSgpO1xuXHRcdH0pO1xuXG5cdFx0dGVzdCgndHlwZScsIGFzeW5jICgpID0+IHtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnR5cGUsICd1bmtub3duJyk7XG5cdFx0XHQvLyB0cmlnZ2VyIGxhenkgaW5pdGlhbGl6YXRpb25cblx0XHRcdGF3YWl0IHNlcnZpY2Uuc2V0KCdteS1zZWNyZXQnLCAnbXktc2VjcmV0LXZhbHVlJyk7XG5cblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLnR5cGUsICdpbi1tZW1vcnknKTtcblx0XHR9KTtcblxuXHRcdHRlc3QoJ3NldCBhbmQgZ2V0JywgYXN5bmMgKCkgPT4ge1xuXHRcdFx0Y29uc3Qga2V5ID0gJ215LXNlY3JldCc7XG5cdFx0XHRjb25zdCB2YWx1ZSA9ICdteS1zZWNyZXQtdmFsdWUnO1xuXHRcdFx0YXdhaXQgc2VydmljZS5zZXQoa2V5LCB2YWx1ZSk7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCBzZXJ2aWNlLmdldChrZXkpO1xuXHRcdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdCwgdmFsdWUpO1xuXG5cdFx0XHQvLyBBZGRpdGlvbmFsbHkgZW5zdXJlIHRoZSBlbmNyeXB0aW9uc2VydmljZSB3YXMgbm90IHVzZWRcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcHlOb0VuY3J5cHRpb25TZXJ2aWNlLmVuY3J5cHQuY2FsbENvdW50LCAwKTtcblx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChzcHlOb0VuY3J5cHRpb25TZXJ2aWNlLmRlY3J5cHQuY2FsbENvdW50LCAwKTtcblx0XHR9KTtcblx0fSk7XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixZQUFZLFdBQVc7QUFDdkIsU0FBUywrQ0FBK0M7QUFDeEQsU0FBNkIsNEJBQTRCO0FBQ3pELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0NBQWdDO0FBQ3pDLFNBQVMsOEJBQThCO0FBRXZDLE1BQU0sc0JBQW9EO0FBQUEsRUFBMUQ7QUFFQyxTQUFRLGtCQUFrQjtBQUFBO0FBQUE7QUFBQSxFQUMxQiw0QkFBMkM7QUFDMUMsV0FBTyxRQUFRLFFBQVE7QUFBQSxFQUN4QjtBQUFBLEVBQ0Esd0JBQXVEO0FBQ3RELFdBQU8sUUFBUSxRQUFRLHFCQUFxQixTQUFTO0FBQUEs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
