import assert from "assert";
import { AsyncIterableSource, DeferredPromise, timeout } from "../../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { NullLogService } from "../../../../../platform/log/common/log.js";
import { ChatMessageRole, languageModelExtensionPoint, LanguageModelsService } from "../../common/languageModels.js";
import { nullExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { ExtensionsRegistry } from "../../../../services/extensions/common/extensionsRegistry.js";
import { MockContextKeyService } from "../../../../../platform/keybinding/test/common/mockKeybindingService.js";
suite("LanguageModels", function() {
  let languageModels;
  const store = new DisposableStore();
  const activationEvents = /* @__PURE__ */ new Set();
  setup(function() {
    languageModels = new LanguageModelsService(
      new class extends mock() {
        activateByEvent(name) {
          activationEvents.add(name);
          return Promise.resolve();
        }
      }(),
      new NullLogService(),
      new MockContextKeyService()
    );
    const ext = ExtensionsRegistry.getExtensionPoints().find((e) => e.name === languageModelExtensionPoint.name);
    ext.acceptUsers([{
      description: { ...nullExtensionDescription, enabledApiProposals: ["chatProvider"] },
      value: { vendor: "test-vendor" },
      collector: null
    }]);
    store.add(languageModels.registerLanguageModelChat("1", {
      metadata: {
        extension: nullExtensionDescription.identifier,
        name: "Pretty Name",
        vendor: "test-vendor",
        family: "test-family",
        version: "test-version",
        id: "test-id",
        maxInputTokens: 100,
        maxOutputTokens: 100
      },
      sendChatRequest: async () => {
        throw new Error();
      },
      provideTokenCount: async () => {
        throw new Error();
      }
    }));
    store.add(languageModels.registerLanguageModelChat("12", {
      metadata: {
        extension: nullExtensionDescription.identifier,
        name: "Pretty Name",
        vendor: "test-vendor",
        family: "test2-family",
        version: "test2-version",
        id: "test-id",
        maxInputTokens: 100,
        maxOutputTokens: 100
      },
      sendChatRequest: async () => {
        throw new Error();
      },
      provideTokenCount: async () => {
        throw new Error();
      }
    }));
  });
  teardown(function() {
    languageModels.dispose();
    activationEvents.clear();
    store.clear();
  });
  ensureNoDisposablesAreLeakedInTestSuite();
  test("empty selector returns all", async function() {
    const result1 = await languageModels.selectLanguageModels({});
    assert.deepStrictEqual(result1.length, 2);
    assert.deepStrictEqual(result1[0], "1");
    assert.deepStrictEqual(result1[1], "12");
  });
  test("no warning that a matching model was not found #213716", async function() {
    const result1 = await languageModels.selectLanguageModels({ vendor: "test-vendor" });
    assert.deepStrictEqual(result1.length, 2);
    const result2 = await languageModels.selectLanguageModels({ vendor: "test-vendor", family: "FAKE" });
    assert.deepStrictEqual(result2.length, 0);
  });
  test("sendChatRequest returns a response-stream", async function() {
    store.add(languageModels.registerLanguageModelChat("actual", {
      metadata: {
        extension: nullExtensionDescription.identifier,
        name: "Pretty Name",
        vendor: "test-vendor",
        family: "actual-family",
        version: "actual-version",
        id: "actual-lm",
        maxInputTokens: 100,
        maxOutputTokens: 100
      },
      sendChatRequest: async (messages, _from, _options, token) => {
        const defer = new DeferredPromise();
        const stream = new AsyncIterableSource();
        (async () => {
          while (!token.isCancellationRequested) {
            stream.emitOne({ index: 0, part: { type: "text", value: Date.now().toString() } });
            await timeout(10);
          }
          defer.complete(void 0);
        })();
        return {
          stream: stream.asyncIterable,
          result: defer.p
        };
      },
      provideTokenCount: async () => {
        throw new Error();
      }
    }));
    const models = await languageModels.selectLanguageModels({ id: "actual-lm" });
    assert.ok(models.length === 1);
    const first = models[0];
    const cts = new CancellationTokenSource();
    const request = await languageModels.sendChatRequest(first, nullExtensionDescription.identifier, [{ role: ChatMessageRole.User, content: [{ type: "text", value: "hello" }] }], {}, cts.token);
    assert.ok(request);
    cts.dispose(true);
    await request.result;
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvY29tbW9uL2xhbmd1YWdlTW9kZWxzLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgYXNzZXJ0IGZyb20gJ2Fzc2VydCc7XG5pbXBvcnQgeyBBc3luY0l0ZXJhYmxlU291cmNlLCBEZWZlcnJlZFByb21pc2UsIHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgbW9jayB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vbW9jay5qcyc7XG5pbXBvcnQgeyBlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL3V0aWxzLmpzJztcbmltcG9ydCB7IE51bGxMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgQ2hhdE1lc3NhZ2VSb2xlLCBJQ2hhdFJlc3BvbnNlRnJhZ21lbnQsIGxhbmd1YWdlTW9kZWxFeHRlbnNpb25Qb2ludCwgTGFuZ3VhZ2VNb2RlbHNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2xhbmd1YWdlTW9kZWxzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBNb2NrQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9rZXliaW5kaW5nL3Rlc3QvY29tbW9uL21vY2tLZXliaW5kaW5nU2VydmljZS5qcyc7XG5cbnN1aXRlKCdMYW5ndWFnZU1vZGVscycsIGZ1bmN0aW9uICgpIHtcblxuXHRsZXQgbGFuZ3VhZ2VNb2RlbHM6IExhbmd1YWdlTW9kZWxzU2VydmljZTtcblxuXHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0Y29uc3QgYWN0aXZhdGlvbkV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdHNldHVwKGZ1bmN0aW9uICgpIHtcblxuXHRcdGxhbmd1YWdlTW9kZWxzID0gbmV3IExhbmd1YWdlTW9kZWxzU2VydmljZShcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dGVuc2lvblNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBhY3RpdmF0ZUJ5RXZlbnQobmFtZTogc3RyaW5nKSB7XG5cdFx0XHRcdFx0YWN0aXZhdGlvbkV2ZW50cy5hZGQobmFtZSk7XG5cdFx0XHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0bmV3IE51bGxMb2dTZXJ2aWNlKCksXG5cdFx0XHRuZXcgTW9ja0NvbnRleHRLZXlTZXJ2aWNlKClcblx0XHQpO1xuXG5cdFx0Y29uc3QgZXh0ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEV4dGVuc2lvblBvaW50cygpLmZpbmQoZSA9PiBlLm5hbWUgPT09IGxhbmd1YWdlTW9kZWxFeHRlbnNpb25Qb2ludC5uYW1lKSE7XG5cblx0XHRleHQuYWNjZXB0VXNlcnMoW3tcblx0XHRcdGRlc2NyaXB0aW9uOiB7IC4uLm51bGxFeHRlbnNpb25EZXNjcmlwdGlvbiwgZW5hYmxlZEFwaVByb3Bvc2FsczogWydjaGF0UHJvdmlkZXInXSB9LFxuXHRcdFx0dmFsdWU6IHsgdmVuZG9yOiAndGVzdC12ZW5kb3InIH0sXG5cdFx0XHRjb2xsZWN0b3I6IG51bGwhXG5cdFx0fV0pO1xuXG5cblx0XHRzdG9yZS5hZGQobGFuZ3VhZ2VNb2RlbHMucmVnaXN0ZXJMYW5ndWFnZU1vZGVsQ2hhdCgnMScsIHtcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGV4dGVuc2lvbjogbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsXG5cdFx0XHRcdG5hbWU6ICdQcmV0dHkgTmFtZScsXG5cdFx0XHRcdHZlbmRvcjogJ3Rlc3QtdmVuZG9yJyxcblx0XHRcdFx0ZmFtaWx5OiAndGVzdC1mYW1pbHknLFxuXHRcdFx0XHR2ZXJzaW9uOiAndGVzdC12ZXJzaW9uJyxcblx0XHRcdFx0aWQ6ICd0ZXN0LWlkJyxcblx0XHRcdFx0bWF4SW5wdXRUb2tlbnM6IDEwMCxcblx0XHRcdFx0bWF4T3V0cHV0VG9rZW5zOiAxMDAsXG5cdFx0XHR9LFxuXHRcdFx0c2VuZENoYXRSZXF1ZXN0OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0fSxcblx0XHRcdHByb3ZpZGVUb2tlbkNvdW50OiBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHN0b3JlLmFkZChsYW5ndWFnZU1vZGVscy5yZWdpc3Rlckxhbmd1YWdlTW9kZWxDaGF0KCcxMicsIHtcblx0XHRcdG1ldGFkYXRhOiB7XG5cdFx0XHRcdGV4dGVuc2lvbjogbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsXG5cdFx0XHRcdG5hbWU6ICdQcmV0dHkgTmFtZScsXG5cdFx0XHRcdHZlbmRvcjogJ3Rlc3QtdmVuZG9yJyxcblx0XHRcdFx0ZmFtaWx5OiAndGVzdDItZmFtaWx5Jyxcblx0XHRcdFx0dmVyc2lvbjogJ3Rlc3QyLXZlcnNpb24nLFxuXHRcdFx0XHRpZDogJ3Rlc3QtaWQnLFxuXHRcdFx0XHRtYXhJbnB1dFRva2VuczogMTAwLFxuXHRcdFx0XHRtYXhPdXRwdXRUb2tlbnM6IDEwMCxcblx0XHRcdH0sXG5cdFx0XHRzZW5kQ2hhdFJlcXVlc3Q6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZVRva2VuQ291bnQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9KTtcblxuXHR0ZWFyZG93bihmdW5jdGlvbiAoKSB7XG5cdFx0bGFuZ3VhZ2VNb2RlbHMuZGlzcG9zZSgpO1xuXHRcdGFjdGl2YXRpb25FdmVudHMuY2xlYXIoKTtcblx0XHRzdG9yZS5jbGVhcigpO1xuXHR9KTtcblxuXHRlbnN1cmVOb0Rpc3Bvc2FibGVzQXJlTGVha2VkSW5UZXN0U3VpdGUoKTtcblxuXHR0ZXN0KCdlbXB0eSBzZWxlY3RvciByZXR1cm5zIGFsbCcsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdGNvbnN0IHJlc3VsdDEgPSBhd2FpdCBsYW5ndWFnZU1vZGVscy5zZWxlY3RMYW5ndWFnZU1vZGVscyh7fSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQxLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQxWzBdLCAnMScpO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0MVsxXSwgJzEyJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ25vIHdhcm5pbmcgdGhhdCBhIG1hdGNoaW5nIG1vZGVsIHdhcyBub3QgZm91bmQgIzIxMzcxNicsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblx0XHRjb25zdCByZXN1bHQxID0gYXdhaXQgbGFuZ3VhZ2VNb2RlbHMuc2VsZWN0TGFuZ3VhZ2VNb2RlbHMoeyB2ZW5kb3I6ICd0ZXN0LXZlbmRvcicgfSk7XG5cdFx0YXNzZXJ0LmRlZXBTdHJpY3RFcXVhbChyZXN1bHQxLmxlbmd0aCwgMik7XG5cblx0XHRjb25zdCByZXN1bHQyID0gYXdhaXQgbGFuZ3VhZ2VNb2RlbHMuc2VsZWN0TGFuZ3VhZ2VNb2RlbHMoeyB2ZW5kb3I6ICd0ZXN0LXZlbmRvcicsIGZhbWlseTogJ0ZBS0UnIH0pO1xuXHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwocmVzdWx0Mi5sZW5ndGgsIDApO1xuXHR9KTtcblxuXHR0ZXN0KCdzZW5kQ2hhdFJlcXVlc3QgcmV0dXJucyBhIHJlc3BvbnNlLXN0cmVhbScsIGFzeW5jIGZ1bmN0aW9uICgpIHtcblxuXHRcdHN0b3JlLmFkZChsYW5ndWFnZU1vZGVscy5yZWdpc3Rlckxhbmd1YWdlTW9kZWxDaGF0KCdhY3R1YWwnLCB7XG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRleHRlbnNpb246IG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLFxuXHRcdFx0XHRuYW1lOiAnUHJldHR5IE5hbWUnLFxuXHRcdFx0XHR2ZW5kb3I6ICd0ZXN0LXZlbmRvcicsXG5cdFx0XHRcdGZhbWlseTogJ2FjdHVhbC1mYW1pbHknLFxuXHRcdFx0XHR2ZXJzaW9uOiAnYWN0dWFsLXZlcnNpb24nLFxuXHRcdFx0XHRpZDogJ2FjdHVhbC1sbScsXG5cdFx0XHRcdG1heElucHV0VG9rZW5zOiAxMDAsXG5cdFx0XHRcdG1heE91dHB1dFRva2VuczogMTAwLFxuXHRcdFx0fSxcblx0XHRcdHNlbmRDaGF0UmVxdWVzdDogYXN5bmMgKG1lc3NhZ2VzLCBfZnJvbSwgX29wdGlvbnMsIHRva2VuKSA9PiB7XG5cdFx0XHRcdC8vIGNvbnN0IG1lc3NhZ2UgPSBtZXNzYWdlcy5hdCgtMSk7XG5cblx0XHRcdFx0Y29uc3QgZGVmZXIgPSBuZXcgRGVmZXJyZWRQcm9taXNlKCk7XG5cdFx0XHRcdGNvbnN0IHN0cmVhbSA9IG5ldyBBc3luY0l0ZXJhYmxlU291cmNlPElDaGF0UmVzcG9uc2VGcmFnbWVudD4oKTtcblxuXHRcdFx0XHQoYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdHdoaWxlICghdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0XHRcdHN0cmVhbS5lbWl0T25lKHsgaW5kZXg6IDAsIHBhcnQ6IHsgdHlwZTogJ3RleHQnLCB2YWx1ZTogRGF0ZS5ub3coKS50b1N0cmluZygpIH0gfSk7XG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KDEwKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZGVmZXIuY29tcGxldGUodW5kZWZpbmVkKTtcblx0XHRcdFx0fSkoKTtcblxuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHN0cmVhbTogc3RyZWFtLmFzeW5jSXRlcmFibGUsXG5cdFx0XHRcdFx0cmVzdWx0OiBkZWZlci5wXG5cdFx0XHRcdH07XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZVRva2VuQ291bnQ6IGFzeW5jICgpID0+IHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgbW9kZWxzID0gYXdhaXQgbGFuZ3VhZ2VNb2RlbHMuc2VsZWN0TGFuZ3VhZ2VNb2RlbHMoeyBpZDogJ2FjdHVhbC1sbScgfSk7XG5cdFx0YXNzZXJ0Lm9rKG1vZGVscy5sZW5ndGggPT09IDEpO1xuXG5cdFx0Y29uc3QgZmlyc3QgPSBtb2RlbHNbMF07XG5cblx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGNvbnN0IHJlcXVlc3QgPSBhd2FpdCBsYW5ndWFnZU1vZGVscy5zZW5kQ2hhdFJlcXVlc3QoZmlyc3QsIG51bGxFeHRlbnNpb25EZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBbeyByb2xlOiBDaGF0TWVzc2FnZVJvbGUuVXNlciwgY29udGVudDogW3sgdHlwZTogJ3RleHQnLCB2YWx1ZTogJ2hlbGxvJyB9XSB9XSwge30sIGN0cy50b2tlbik7XG5cblx0XHRhc3NlcnQub2socmVxdWVzdCk7XG5cblx0XHRjdHMuZGlzcG9zZSh0cnVlKTtcblxuXHRcdGF3YWl0IHJlcXVlc3QucmVzdWx0O1xuXHR9KTtcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsT0FBTyxZQUFZO0FBQ25CLFNBQVMscUJBQXFCLGlCQUFpQixlQUFlO0FBQzlELFNBQVMsK0JBQStCO0FBQ3hDLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsWUFBWTtBQUNyQixTQUFTLCtDQUErQztBQUN4RCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGlCQUF3Qyw2QkFBNkIsNkJBQTZCO0FBQzNHLFNBQTRCLGdDQUFnQztBQUM1RCxTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDZCQUE2QjtBQUV0QyxNQUFNLGtCQUFrQixXQUFZO0FBRW5DLE1BQUk7QUFFSixRQUFNLFFBQVEsSUFBSSxnQkFBZ0I7QUFDbEMsUUFBTSxtQkFBbUIsb0JBQUksSUFBWTtBQUV6QyxRQUFNLFdBQVk7QUFFakIscUJBQWlCLElBQUk7QUFBQSxNQUNwQixJQUFJLGNBQWMsS0FB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
