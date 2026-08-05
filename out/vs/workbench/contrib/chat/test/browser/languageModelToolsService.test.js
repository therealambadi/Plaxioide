import * as assert from "assert";
import { CancellationToken } from "../../../../../base/common/cancellation.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { ContextKeyService } from "../../../../../platform/contextkey/browser/contextKeyService.js";
import { ContextKeyEqualsExpr, IContextKeyService } from "../../../../../platform/contextkey/common/contextkey.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
import { LanguageModelToolsService } from "../../browser/languageModelToolsService.js";
import { IChatService } from "../../common/chatService.js";
import { MockChatService } from "../common/mockChatService.js";
import { CancellationError, isCancellationError } from "../../../../../base/common/errors.js";
import { Barrier } from "../../../../../base/common/async.js";
suite("LanguageModelToolsService", () => {
  const store = ensureNoDisposablesAreLeakedInTestSuite();
  let contextKeyService;
  let service;
  let chatService;
  setup(() => {
    const instaService = workbenchInstantiationService({
      contextKeyService: () => store.add(new ContextKeyService(new TestConfigurationService()))
    }, store);
    contextKeyService = instaService.get(IContextKeyService);
    chatService = new MockChatService();
    instaService.stub(IChatService, chatService);
    service = store.add(instaService.createInstance(LanguageModelToolsService));
  });
  test("registerToolData", () => {
    const toolData = {
      id: "testTool",
      modelDescription: "Test Tool",
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    const disposable = service.registerToolData(toolData);
    assert.strictEqual(service.getTool("testTool")?.id, "testTool");
    disposable.dispose();
    assert.strictEqual(service.getTool("testTool"), void 0);
  });
  test("registerToolImplementation", () => {
    const toolData = {
      id: "testTool",
      modelDescription: "Test Tool",
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    store.add(service.registerToolData(toolData));
    const toolImpl = {
      invoke: async () => ({ content: [{ kind: "text", value: "result" }] })
    };
    store.add(service.registerToolImplementation("testTool", toolImpl));
    assert.strictEqual(service.getTool("testTool")?.id, "testTool");
  });
  test("getTools", () => {
    contextKeyService.createKey("testKey", true);
    const toolData1 = {
      id: "testTool1",
      modelDescription: "Test Tool 1",
      when: ContextKeyEqualsExpr.create("testKey", false),
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    const toolData2 = {
      id: "testTool2",
      modelDescription: "Test Tool 2",
      when: ContextKeyEqualsExpr.create("testKey", true),
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    const toolData3 = {
      id: "testTool3",
      modelDescription: "Test Tool 3",
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    store.add(service.registerToolData(toolData1));
    store.add(service.registerToolData(toolData2));
    store.add(service.registerToolData(toolData3));
    const tools = Array.from(service.getTools());
    assert.strictEqual(tools.length, 2);
    assert.strictEqual(tools[0].id, "testTool2");
    assert.strictEqual(tools[1].id, "testTool3");
  });
  test("invokeTool", async () => {
    const toolData = {
      id: "testTool",
      modelDescription: "Test Tool",
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    store.add(service.registerToolData(toolData));
    const toolImpl = {
      invoke: async (invocation) => {
        assert.strictEqual(invocation.callId, "1");
        assert.strictEqual(invocation.toolId, "testTool");
        assert.deepStrictEqual(invocation.parameters, { a: 1 });
        return { content: [{ kind: "text", value: "result" }] };
      }
    };
    store.add(service.registerToolImplementation("testTool", toolImpl));
    const dto = {
      callId: "1",
      toolId: "testTool",
      tokenBudget: 100,
      parameters: {
        a: 1
      },
      context: void 0
    };
    const result = await service.invokeTool(dto, async () => 0, CancellationToken.None);
    assert.strictEqual(result.content[0].value, "result");
  });
  test("cancel tool call", async () => {
    const toolData = {
      id: "testTool",
      modelDescription: "Test Tool",
      displayName: "Test Tool",
      source: { type: "internal" }
    };
    store.add(service.registerToolData(toolData));
    const toolBarrier = new Barrier();
    const toolImpl = {
      invoke: async (invocation, countTokens, cancelToken) => {
        assert.strictEqual(invocation.callId, "1");
        assert.strictEqual(invocation.toolId, "testTool");
        assert.deepStrictEqual(invocation.parameters, { a: 1 });
        await toolBarrier.wait();
        if (cancelToken.isCancellationRequested) {
          throw new CancellationError();
        } else {
          throw new Error("Tool call should be cancelled");
        }
      }
    };
    store.add(service.registerToolImplementation("testTool", toolImpl));
    const sessionId = "sessionId";
    const requestId = "requestId";
    const dto = {
      callId: "1",
      toolId: "testTool",
      tokenBudget: 100,
      parameters: {
        a: 1
      },
      context: {
        sessionId
      }
    };
    chatService.addSession({
      sessionId,
      getRequests: () => {
        return [{
          id: requestId
        }];
      },
      acceptResponseProgress: () => {
      }
    });
    const toolPromise = service.invokeTool(dto, async () => 0, CancellationToken.None);
    service.cancelToolCallsForRequest(requestId);
    toolBarrier.open();
    await assert.rejects(toolPromise, (err) => {
      return isCancellationError(err);
    }, "Expected tool call to be cancelled");
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L3Rlc3QvYnJvd3Nlci9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLnRlc3QudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBhc3NlcnQgZnJvbSAnYXNzZXJ0JztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvdGVzdC9jb21tb24vdXRpbHMuanMnO1xuaW1wb3J0IHsgVGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi90ZXN0L2NvbW1vbi90ZXN0Q29uZmlndXJhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2Jyb3dzZXIvY29udGV4dEtleVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUVxdWFsc0V4cHIsIElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgd29ya2JlbmNoSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi90ZXN0L2Jyb3dzZXIvd29ya2JlbmNoVGVzdFNlcnZpY2VzLmpzJztcbmltcG9ydCB7IExhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgfSBmcm9tICcuLi8uLi9icm93c2VyL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUNoYXRNb2RlbCB9IGZyb20gJy4uLy4uL2NvbW1vbi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSUNoYXRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vY29tbW9uL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElUb29sRGF0YSwgSVRvb2xJbXBsLCBJVG9vbEludm9jYXRpb24gfSBmcm9tICcuLi8uLi9jb21tb24vbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNb2NrQ2hhdFNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbW9ja0NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yLCBpc0NhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEJhcnJpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5cbnN1aXRlKCdMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlJywgKCkgPT4ge1xuXHRjb25zdCBzdG9yZSA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpO1xuXG5cdGxldCBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlO1xuXHRsZXQgc2VydmljZTogTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZTtcblx0bGV0IGNoYXRTZXJ2aWNlOiBNb2NrQ2hhdFNlcnZpY2U7XG5cblx0c2V0dXAoKCkgPT4ge1xuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlKHtcblx0XHRcdGNvbnRleHRLZXlTZXJ2aWNlOiAoKSA9PiBzdG9yZS5hZGQobmV3IENvbnRleHRLZXlTZXJ2aWNlKG5ldyBUZXN0Q29uZmlndXJhdGlvblNlcnZpY2UpKSxcblx0XHR9LCBzdG9yZSk7XG5cdFx0Y29udGV4dEtleVNlcnZpY2UgPSBpbnN0YVNlcnZpY2UuZ2V0KElDb250ZXh0S2V5U2VydmljZSk7XG5cdFx0Y2hhdFNlcnZpY2UgPSBuZXcgTW9ja0NoYXRTZXJ2aWNlKCk7XG5cdFx0aW5zdGFTZXJ2aWNlLnN0dWIoSUNoYXRTZXJ2aWNlLCBjaGF0U2VydmljZSk7XG5cdFx0c2VydmljZSA9IHN0b3JlLmFkZChpbnN0YVNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSkpO1xuXHR9KTtcblxuXHR0ZXN0KCdyZWdpc3RlclRvb2xEYXRhJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRvb2xEYXRhOiBJVG9vbERhdGEgPSB7XG5cdFx0XHRpZDogJ3Rlc3RUb29sJyxcblx0XHRcdG1vZGVsRGVzY3JpcHRpb246ICdUZXN0IFRvb2wnLFxuXHRcdFx0ZGlzcGxheU5hbWU6ICdUZXN0IFRvb2wnLFxuXHRcdFx0c291cmNlOiB7IHR5cGU6ICdpbnRlcm5hbCcgfSxcblx0XHR9O1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZSA9IHNlcnZpY2UucmVnaXN0ZXJUb29sRGF0YSh0b29sRGF0YSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0VG9vbCgndGVzdFRvb2wnKT8uaWQsICd0ZXN0VG9vbCcpO1xuXHRcdGRpc3Bvc2FibGUuZGlzcG9zZSgpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChzZXJ2aWNlLmdldFRvb2woJ3Rlc3RUb29sJyksIHVuZGVmaW5lZCk7XG5cdH0pO1xuXG5cdHRlc3QoJ3JlZ2lzdGVyVG9vbEltcGxlbWVudGF0aW9uJywgKCkgPT4ge1xuXHRcdGNvbnN0IHRvb2xEYXRhOiBJVG9vbERhdGEgPSB7XG5cdFx0XHRpZDogJ3Rlc3RUb29sJyxcblx0XHRcdG1vZGVsRGVzY3JpcHRpb246ICdUZXN0IFRvb2wnLFxuXHRcdFx0ZGlzcGxheU5hbWU6ICdUZXN0IFRvb2wnLFxuXHRcdFx0c291cmNlOiB7IHR5cGU6ICdpbnRlcm5hbCcgfSxcblx0XHR9O1xuXG5cdFx0c3RvcmUuYWRkKHNlcnZpY2UucmVnaXN0ZXJUb29sRGF0YSh0b29sRGF0YSkpO1xuXG5cdFx0Y29uc3QgdG9vbEltcGw6IElUb29sSW1wbCA9IHtcblx0XHRcdGludm9rZTogYXN5bmMgKCkgPT4gKHsgY29udGVudDogW3sga2luZDogJ3RleHQnLCB2YWx1ZTogJ3Jlc3VsdCcgfV0gfSksXG5cdFx0fTtcblxuXHRcdHN0b3JlLmFkZChzZXJ2aWNlLnJlZ2lzdGVyVG9vbEltcGxlbWVudGF0aW9uKCd0ZXN0VG9vbCcsIHRvb2xJbXBsKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHNlcnZpY2UuZ2V0VG9vbCgndGVzdFRvb2wnKT8uaWQsICd0ZXN0VG9vbCcpO1xuXHR9KTtcblxuXHR0ZXN0KCdnZXRUb29scycsICgpID0+IHtcblx0XHRjb250ZXh0S2V5U2VydmljZS5jcmVhdGVLZXkoJ3Rlc3RLZXknLCB0cnVlKTtcblx0XHRjb25zdCB0b29sRGF0YTE6IElUb29sRGF0YSA9IHtcblx0XHRcdGlkOiAndGVzdFRvb2wxJyxcblx0XHRcdG1vZGVsRGVzY3JpcHRpb246ICdUZXN0IFRvb2wgMScsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXF1YWxzRXhwci5jcmVhdGUoJ3Rlc3RLZXknLCBmYWxzZSksXG5cdFx0XHRkaXNwbGF5TmFtZTogJ1Rlc3QgVG9vbCcsXG5cdFx0XHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRcdH07XG5cblx0XHRjb25zdCB0b29sRGF0YTI6IElUb29sRGF0YSA9IHtcblx0XHRcdGlkOiAndGVzdFRvb2wyJyxcblx0XHRcdG1vZGVsRGVzY3JpcHRpb246ICdUZXN0IFRvb2wgMicsXG5cdFx0XHR3aGVuOiBDb250ZXh0S2V5RXF1YWxzRXhwci5jcmVhdGUoJ3Rlc3RLZXknLCB0cnVlKSxcblx0XHRcdGRpc3BsYXlOYW1lOiAnVGVzdCBUb29sJyxcblx0XHRcdHNvdXJjZTogeyB0eXBlOiAnaW50ZXJuYWwnIH0sXG5cdFx0fTtcblxuXHRcdGNvbnN0IHRvb2xEYXRhMzogSVRvb2xEYXRhID0ge1xuXHRcdFx0aWQ6ICd0ZXN0VG9vbDMnLFxuXHRcdFx0bW9kZWxEZXNjcmlwdGlvbjogJ1Rlc3QgVG9vbCAzJyxcblx0XHRcdGRpc3BsYXlOYW1lOiAnVGVzdCBUb29sJyxcblx0XHRcdHNvdXJjZTogeyB0eXBlOiAnaW50ZXJuYWwnIH0sXG5cdFx0fTtcblxuXHRcdHN0b3JlLmFkZChzZXJ2aWNlLnJlZ2lzdGVyVG9vbERhdGEodG9vbERhdGExKSk7XG5cdFx0c3RvcmUuYWRkKHNlcnZpY2UucmVnaXN0ZXJUb29sRGF0YSh0b29sRGF0YTIpKTtcblx0XHRzdG9yZS5hZGQoc2VydmljZS5yZWdpc3RlclRvb2xEYXRhKHRvb2xEYXRhMykpO1xuXG5cdFx0Y29uc3QgdG9vbHMgPSBBcnJheS5mcm9tKHNlcnZpY2UuZ2V0VG9vbHMoKSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xzLmxlbmd0aCwgMik7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xzWzBdLmlkLCAndGVzdFRvb2wyJyk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHRvb2xzWzFdLmlkLCAndGVzdFRvb2wzJyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2ludm9rZVRvb2wnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdG9vbERhdGE6IElUb29sRGF0YSA9IHtcblx0XHRcdGlkOiAndGVzdFRvb2wnLFxuXHRcdFx0bW9kZWxEZXNjcmlwdGlvbjogJ1Rlc3QgVG9vbCcsXG5cdFx0XHRkaXNwbGF5TmFtZTogJ1Rlc3QgVG9vbCcsXG5cdFx0XHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRcdH07XG5cblx0XHRzdG9yZS5hZGQoc2VydmljZS5yZWdpc3RlclRvb2xEYXRhKHRvb2xEYXRhKSk7XG5cblx0XHRjb25zdCB0b29sSW1wbDogSVRvb2xJbXBsID0ge1xuXHRcdFx0aW52b2tlOiBhc3luYyAoaW52b2NhdGlvbikgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW52b2NhdGlvbi5jYWxsSWQsICcxJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnZvY2F0aW9uLnRvb2xJZCwgJ3Rlc3RUb29sJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW52b2NhdGlvbi5wYXJhbWV0ZXJzLCB7IGE6IDEgfSk7XG5cdFx0XHRcdHJldHVybiB7IGNvbnRlbnQ6IFt7IGtpbmQ6ICd0ZXh0JywgdmFsdWU6ICdyZXN1bHQnIH1dIH07XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHN0b3JlLmFkZChzZXJ2aWNlLnJlZ2lzdGVyVG9vbEltcGxlbWVudGF0aW9uKCd0ZXN0VG9vbCcsIHRvb2xJbXBsKSk7XG5cblx0XHRjb25zdCBkdG86IElUb29sSW52b2NhdGlvbiA9IHtcblx0XHRcdGNhbGxJZDogJzEnLFxuXHRcdFx0dG9vbElkOiAndGVzdFRvb2wnLFxuXHRcdFx0dG9rZW5CdWRnZXQ6IDEwMCxcblx0XHRcdHBhcmFtZXRlcnM6IHtcblx0XHRcdFx0YTogMVxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHQ6IHVuZGVmaW5lZCxcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgc2VydmljZS5pbnZva2VUb29sKGR0bywgYXN5bmMgKCkgPT4gMCwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHJlc3VsdC5jb250ZW50WzBdLnZhbHVlLCAncmVzdWx0Jyk7XG5cdH0pO1xuXG5cdHRlc3QoJ2NhbmNlbCB0b29sIGNhbGwnLCBhc3luYyAoKSA9PiB7XG5cdFx0Y29uc3QgdG9vbERhdGE6IElUb29sRGF0YSA9IHtcblx0XHRcdGlkOiAndGVzdFRvb2wnLFxuXHRcdFx0bW9kZWxEZXNjcmlwdGlvbjogJ1Rlc3QgVG9vbCcsXG5cdFx0XHRkaXNwbGF5TmFtZTogJ1Rlc3QgVG9vbCcsXG5cdFx0XHRzb3VyY2U6IHsgdHlwZTogJ2ludGVybmFsJyB9LFxuXHRcdH07XG5cblx0XHRzdG9yZS5hZGQoc2VydmljZS5yZWdpc3RlclRvb2xEYXRhKHRvb2xEYXRhKSk7XG5cblx0XHRjb25zdCB0b29sQmFycmllciA9IG5ldyBCYXJyaWVyKCk7XG5cdFx0Y29uc3QgdG9vbEltcGw6IElUb29sSW1wbCA9IHtcblx0XHRcdGludm9rZTogYXN5bmMgKGludm9jYXRpb24sIGNvdW50VG9rZW5zLCBjYW5jZWxUb2tlbikgPT4ge1xuXHRcdFx0XHRhc3NlcnQuc3RyaWN0RXF1YWwoaW52b2NhdGlvbi5jYWxsSWQsICcxJyk7XG5cdFx0XHRcdGFzc2VydC5zdHJpY3RFcXVhbChpbnZvY2F0aW9uLnRvb2xJZCwgJ3Rlc3RUb29sJyk7XG5cdFx0XHRcdGFzc2VydC5kZWVwU3RyaWN0RXF1YWwoaW52b2NhdGlvbi5wYXJhbWV0ZXJzLCB7IGE6IDEgfSk7XG5cdFx0XHRcdGF3YWl0IHRvb2xCYXJyaWVyLndhaXQoKTtcblx0XHRcdFx0aWYgKGNhbmNlbFRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdUb29sIGNhbGwgc2hvdWxkIGJlIGNhbmNlbGxlZCcpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHN0b3JlLmFkZChzZXJ2aWNlLnJlZ2lzdGVyVG9vbEltcGxlbWVudGF0aW9uKCd0ZXN0VG9vbCcsIHRvb2xJbXBsKSk7XG5cblx0XHRjb25zdCBzZXNzaW9uSWQgPSAnc2Vzc2lvbklkJztcblx0XHRjb25zdCByZXF1ZXN0SWQgPSAncmVxdWVzdElkJztcblx0XHRjb25zdCBkdG86IElUb29sSW52b2NhdGlvbiA9IHtcblx0XHRcdGNhbGxJZDogJzEnLFxuXHRcdFx0dG9vbElkOiAndGVzdFRvb2wnLFxuXHRcdFx0dG9rZW5CdWRnZXQ6IDEwMCxcblx0XHRcdHBhcmFtZXRlcnM6IHtcblx0XHRcdFx0YTogMVxuXHRcdFx0fSxcblx0XHRcdGNvbnRleHQ6IHtcblx0XHRcdFx0c2Vzc2lvbklkXG5cdFx0XHR9LFxuXHRcdH07XG5cdFx0Y2hhdFNlcnZpY2UuYWRkU2Vzc2lvbih7XG5cdFx0XHRzZXNzaW9uSWQ6IHNlc3Npb25JZCxcblx0XHRcdGdldFJlcXVlc3RzOiAoKSA9PiB7XG5cdFx0XHRcdHJldHVybiBbe1xuXHRcdFx0XHRcdGlkOiByZXF1ZXN0SWRcblx0XHRcdFx0fV07XG5cdFx0XHR9LFxuXHRcdFx0YWNjZXB0UmVzcG9uc2VQcm9ncmVzczogKCkgPT4geyB9XG5cdFx0fSBhcyBhbnkgYXMgSUNoYXRNb2RlbCk7XG5cblx0XHRjb25zdCB0b29sUHJvbWlzZSA9IHNlcnZpY2UuaW52b2tlVG9vbChkdG8sIGFzeW5jICgpID0+IDAsIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdHNlcnZpY2UuY2FuY2VsVG9vbENhbGxzRm9yUmVxdWVzdChyZXF1ZXN0SWQpO1xuXHRcdHRvb2xCYXJyaWVyLm9wZW4oKTtcblx0XHRhd2FpdCBhc3NlcnQucmVqZWN0cyh0b29sUHJvbWlzZSwgZXJyID0+IHtcblx0XHRcdHJldHVybiBpc0NhbmNlbGxhdGlvbkVycm9yKGVycik7XG5cdFx0fSwgJ0V4cGVjdGVkIHRvb2wg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WTtBQUNwQyxVQUFNLFdBQXNCO0FBQUEsTUFDM0IsSUFBSTtBQUFBLE1BQ0osa0JBQWtCO0FBQUEsTUFDbEIsYUFBYTtBQUFBLE1BQ2IsUUFBUSxFQUFFLE1BQU0sV0FBVztBQUFBLElBQzVCO0FBRUEsVUFBTSxJQUFJLFFBQVEsaUJBQWlCLFFBQVEsQ0FBQztBQUU1QyxVQUFNLGNBQWMsSUFBSSxRQUFRO0FBQ2hDLFVBQU0sV0FBc0I7QUFBQSxNQUMzQixRQUFRLE9BQU8sWUFBWSxhQUFhLGdCQUFnQjtBQUN2RCxlQUFPLFlBQVksV0FBVyxRQUFRLEdBQUc7QUFDekMsZUFBTyxZQUFZLFdBQVcsUUFBUSxVQUFVO0FBQ2hELGVBQU8sZ0JBQWdCLFdBQVcsWUFBWSxFQUFFLEdBQUcsRUFBRSxDQUFDO0FBQ3RELGNBQU0sWUFBWSxLQUFLO0FBQ3ZCLFlBQUksWUFBWSx5QkFBeUI7QUFDeEMsZ0JBQU0sSUFBSSxrQkFBa0I7QUFBQSxRQUM3QixPQUFPO0FBQ04sZ0JBQU0sSUFBSSxNQUFNLCtCQUErQjtBQUFBLFFBQ2hEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLElBQUksUUFBUSwyQkFBMkIsWUFBWSxRQUFRLENBQUM7QUFFbEUsVUFBTSxZQUFZO0FBQ2xCLFVBQU0sWUFBWTtBQUNsQixVQUFNLE1BQXVCO0FBQUEsTUFDNUIsUUFBUTtBQUFBLE1BQ1IsUUFBUTtBQUFBLE1BQ1IsYUFBYTtBQUFBLE1BQ2IsWUFBWTtBQUFBLFFBQ1gsR0FBRztBQUFBLE1BQ0o7QUFBQSxNQUNBLFNBQVM7QUFBQSxRQUNSO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxnQkFBWSxXQUFXO0FBQUEsTUFDdEI7QUFBQSxNQUNBLGFBQWEsTUFBTTtBQUNsQixlQUFPLENBQUM7QUFBQSxVQUNQLElBQUk7QUFBQSxRQUNMLENBQUM7QUFBQSxNQUNGO0FBQUEsTUFDQSx3QkFBd0IsTUFBTTtBQUFBLE1BQUU7QUFBQSxJQUNqQyxDQUFzQjtBQUV0QixVQUFNLGNBQWMsUUFBUSxXQUFXLEtBQUssWUFBWSxHQUFHLGtCQUFrQixJQUFJO0FBQ2pGLFlBQVEsMEJBQTBCLFNBQVM7QUFDM0MsZ0JBQVksS0FBSztBQUNqQixVQUFNLE9BQU8sUUFBUSxhQUFhLFNBQU87QUFDeEMsYUFBTyxvQkFBb0IsR0FBRztBQUFBLElBQy9CLEdBQUcsb0NBQW9DO0FBQUEsRUFDeEMsQ0FBQztBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
