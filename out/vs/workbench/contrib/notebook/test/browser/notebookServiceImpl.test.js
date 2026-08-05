import assert from "assert";
import { Event } from "../../../../../base/common/event.js";
import { URI } from "../../../../../base/common/uri.js";
import { mock } from "../../../../../base/test/common/mock.js";
import { ensureNoDisposablesAreLeakedInTestSuite } from "../../../../../base/test/common/utils.js";
import { TestConfigurationService } from "../../../../../platform/configuration/test/common/testConfigurationService.js";
import { NotebookProviderInfoStore } from "../../browser/services/notebookServiceImpl.js";
import { NotebookProviderInfo } from "../../common/notebookProvider.js";
import { EditorResolverService } from "../../../../services/editor/browser/editorResolverService.js";
import { RegisteredEditorPriority } from "../../../../services/editor/common/editorResolverService.js";
import { nullExtensionDescription } from "../../../../services/extensions/common/extensions.js";
import { workbenchInstantiationService } from "../../../../test/browser/workbenchTestServices.js";
suite("NotebookProviderInfoStore", function() {
  const disposables = ensureNoDisposablesAreLeakedInTestSuite();
  test("Can't open untitled notebooks in test #119363", function() {
    const instantiationService = workbenchInstantiationService(void 0, disposables);
    const store = new NotebookProviderInfoStore(
      new class extends mock() {
        get() {
          return "";
        }
        store() {
        }
        getObject() {
          return {};
        }
      }(),
      new class extends mock() {
        constructor() {
          super(...arguments);
          this.onDidRegisterExtensions = Event.None;
        }
      }(),
      disposables.add(instantiationService.createInstance(EditorResolverService)),
      new TestConfigurationService(),
      new class extends mock() {
        constructor() {
          super(...arguments);
          this.onDidChangeScreenReaderOptimized = Event.None;
        }
      }(),
      instantiationService,
      new class extends mock() {
        hasProvider() {
          return true;
        }
      }(),
      new class extends mock() {
      }(),
      new class extends mock() {
      }()
    );
    disposables.add(store);
    const fooInfo = new NotebookProviderInfo({
      extension: nullExtensionDescription.identifier,
      id: "foo",
      displayName: "foo",
      selectors: [{ filenamePattern: "*.foo" }],
      priority: RegisteredEditorPriority.default,
      providerDisplayName: "foo"
    });
    const barInfo = new NotebookProviderInfo({
      extension: nullExtensionDescription.identifier,
      id: "bar",
      displayName: "bar",
      selectors: [{ filenamePattern: "*.bar" }],
      priority: RegisteredEditorPriority.default,
      providerDisplayName: "bar"
    });
    store.add(fooInfo);
    store.add(barInfo);
    assert.ok(store.get("foo"));
    assert.ok(store.get("bar"));
    assert.ok(!store.get("barfoo"));
    let providers = store.getContributedNotebook(URI.parse("file:///test/nb.foo"));
    assert.strictEqual(providers.length, 1);
    assert.strictEqual(providers[0] === fooInfo, true);
    providers = store.getContributedNotebook(URI.parse("file:///test/nb.bar"));
    assert.strictEqual(providers.length, 1);
    assert.strictEqual(providers[0] === barInfo, true);
    providers = store.getContributedNotebook(URI.parse("untitled:///Untitled-1"));
    assert.strictEqual(providers.length, 2);
    assert.strictEqual(providers[0] === fooInfo, true);
    assert.strictEqual(providers[1] === barInfo, true);
    providers = store.getContributedNotebook(URI.parse("untitled:///test/nb.bar"));
    assert.strictEqual(providers.length, 1);
    assert.strictEqual(providers[0] === barInfo, true);
  });
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay90ZXN0L2Jyb3dzZXIvbm90ZWJvb2tTZXJ2aWNlSW1wbC50ZXN0LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IGFzc2VydCBmcm9tICdhc3NlcnQnO1xuaW1wb3J0IHsgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IG1vY2sgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL3Rlc3QvY29tbW9uL21vY2suanMnO1xuaW1wb3J0IHsgZW5zdXJlTm9EaXNwb3NhYmxlc0FyZUxlYWtlZEluVGVzdFN1aXRlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS90ZXN0L2NvbW1vbi91dGlscy5qcyc7XG5pbXBvcnQgeyBJQWNjZXNzaWJpbGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2NvbW1vbi9hY2Nlc3NpYmlsaXR5LmpzJztcbmltcG9ydCB7IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vdGVzdC9jb21tb24vdGVzdENvbmZpZ3VyYXRpb25TZXJ2aWNlLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElVcmlJZGVudGl0eVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS91cmlJZGVudGl0eS9jb21tb24vdXJpSWRlbnRpdHkuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tQcm92aWRlckluZm9TdG9yZSB9IGZyb20gJy4uLy4uL2Jyb3dzZXIvc2VydmljZXMvbm90ZWJvb2tTZXJ2aWNlSW1wbC5qcyc7XG5pbXBvcnQgeyBJTm90ZWJvb2tFZGl0b3JNb2RlbFJlc29sdmVyU2VydmljZSB9IGZyb20gJy4uLy4uL2NvbW1vbi9ub3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE5vdGVib29rUHJvdmlkZXJJbmZvIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rUHJvdmlkZXIuanMnO1xuaW1wb3J0IHsgRWRpdG9yUmVzb2x2ZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZWRpdG9yL2Jyb3dzZXIvZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yUmVzb2x2ZXJTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlLCBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IHdvcmtiZW5jaEluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vdGVzdC9icm93c2VyL3dvcmtiZW5jaFRlc3RTZXJ2aWNlcy5qcyc7XG5cbnN1aXRlKCdOb3RlYm9va1Byb3ZpZGVySW5mb1N0b3JlJywgZnVuY3Rpb24gKCkge1xuXHRjb25zdCBkaXNwb3NhYmxlcyA9IGVuc3VyZU5vRGlzcG9zYWJsZXNBcmVMZWFrZWRJblRlc3RTdWl0ZSgpIGFzIFBpY2s8RGlzcG9zYWJsZVN0b3JlLCAnYWRkJz47XG5cblx0dGVzdCgnQ2FuXFwndCBvcGVuIHVudGl0bGVkIG5vdGVib29rcyBpbiB0ZXN0ICMxMTkzNjMnLCBmdW5jdGlvbiAoKSB7XG5cdFx0Y29uc3QgaW5zdGFudGlhdGlvblNlcnZpY2UgPSB3b3JrYmVuY2hJbnN0YW50aWF0aW9uU2VydmljZSh1bmRlZmluZWQsIGRpc3Bvc2FibGVzKTtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBOb3RlYm9va1Byb3ZpZGVySW5mb1N0b3JlKFxuXHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJU3RvcmFnZVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBnZXQoKSB7IHJldHVybiAnJzsgfVxuXHRcdFx0XHRvdmVycmlkZSBzdG9yZSgpIHsgfVxuXHRcdFx0XHRvdmVycmlkZSBnZXRPYmplY3QoKSB7IHJldHVybiB7fTsgfVxuXHRcdFx0fSxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SUV4dGVuc2lvblNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBvbkRpZFJlZ2lzdGVyRXh0ZW5zaW9ucyA9IEV2ZW50Lk5vbmU7XG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zYWJsZXMuYWRkKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKEVkaXRvclJlc29sdmVyU2VydmljZSkpLFxuXHRcdFx0bmV3IFRlc3RDb25maWd1cmF0aW9uU2VydmljZSgpLFxuXHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJQWNjZXNzaWJpbGl0eVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBvbkRpZENoYW5nZVNjcmVlblJlYWRlck9wdGltaXplZDogRXZlbnQ8dm9pZD4gPSBFdmVudC5Ob25lO1xuXHRcdFx0fSxcblx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdFx0bmV3IGNsYXNzIGV4dGVuZHMgbW9jazxJRmlsZVNlcnZpY2U+KCkge1xuXHRcdFx0XHRvdmVycmlkZSBoYXNQcm92aWRlcigpIHsgcmV0dXJuIHRydWU7IH1cblx0XHRcdH0sXG5cdFx0XHRuZXcgY2xhc3MgZXh0ZW5kcyBtb2NrPElOb3RlYm9va0VkaXRvck1vZGVsUmVzb2x2ZXJTZXJ2aWNlPigpIHsgfSxcblx0XHRcdG5ldyBjbGFzcyBleHRlbmRzIG1vY2s8SVVyaUlkZW50aXR5U2VydmljZT4oKSB7IH1cblx0XHQpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZChzdG9yZSk7XG5cblx0XHRjb25zdCBmb29JbmZvID0gbmV3IE5vdGVib29rUHJvdmlkZXJJbmZvKHtcblx0XHRcdGV4dGVuc2lvbjogbnVsbEV4dGVuc2lvbkRlc2NyaXB0aW9uLmlkZW50aWZpZXIsXG5cdFx0XHRpZDogJ2ZvbycsXG5cdFx0XHRkaXNwbGF5TmFtZTogJ2ZvbycsXG5cdFx0XHRzZWxlY3RvcnM6IFt7IGZpbGVuYW1lUGF0dGVybjogJyouZm9vJyB9XSxcblx0XHRcdHByaW9yaXR5OiBSZWdpc3RlcmVkRWRpdG9yUHJpb3JpdHkuZGVmYXVsdCxcblx0XHRcdHByb3ZpZGVyRGlzcGxheU5hbWU6ICdmb28nLFxuXHRcdH0pO1xuXHRcdGNvbnN0IGJhckluZm8gPSBuZXcgTm90ZWJvb2tQcm92aWRlckluZm8oe1xuXHRcdFx0ZXh0ZW5zaW9uOiBudWxsRXh0ZW5zaW9uRGVzY3JpcHRpb24uaWRlbnRpZmllcixcblx0XHRcdGlkOiAnYmFyJyxcblx0XHRcdGRpc3BsYXlOYW1lOiAnYmFyJyxcblx0XHRcdHNlbGVjdG9yczogW3sgZmlsZW5hbWVQYXR0ZXJuOiAnKi5iYXInIH1dLFxuXHRcdFx0cHJpb3JpdHk6IFJlZ2lzdGVyZWRFZGl0b3JQcmlvcml0eS5kZWZhdWx0LFxuXHRcdFx0cHJvdmlkZXJEaXNwbGF5TmFtZTogJ2JhcicsXG5cdFx0fSk7XG5cblx0XHRzdG9yZS5hZGQoZm9vSW5mbyk7XG5cdFx0c3RvcmUuYWRkKGJhckluZm8pO1xuXG5cdFx0YXNzZXJ0Lm9rKHN0b3JlLmdldCgnZm9vJykpO1xuXHRcdGFzc2VydC5vayhzdG9yZS5nZXQoJ2JhcicpKTtcblx0XHRhc3NlcnQub2soIXN0b3JlLmdldCgnYmFyZm9vJykpO1xuXG5cdFx0bGV0IHByb3ZpZGVycyA9IHN0b3JlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2soVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvbmIuZm9vJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm92aWRlcnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvdmlkZXJzWzBdID09PSBmb29JbmZvLCB0cnVlKTtcblxuXHRcdHByb3ZpZGVycyA9IHN0b3JlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2soVVJJLnBhcnNlKCdmaWxlOi8vL3Rlc3QvbmIuYmFyJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm92aWRlcnMubGVuZ3RoLCAxKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvdmlkZXJzWzBdID09PSBiYXJJbmZvLCB0cnVlKTtcblxuXHRcdHByb3ZpZGVycyA9IHN0b3JlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2soVVJJLnBhcnNlKCd1bnRpdGxlZDovLy9VbnRpdGxlZC0xJykpO1xuXHRcdGFzc2VydC5zdHJpY3RFcXVhbChwcm92aWRlcnMubGVuZ3RoLCAyKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvdmlkZXJzWzBdID09PSBmb29JbmZvLCB0cnVlKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvdmlkZXJzWzFdID09PSBiYXJJbmZvLCB0cnVlKTtcblxuXHRcdHByb3ZpZGVycyA9IHN0b3JlLmdldENvbnRyaWJ1dGVkTm90ZWJvb2soVVJJLnBhcnNlKCd1bnRpdGxlZDovLy90ZXN0L25iLmJhcicpKTtcblx0XHRhc3NlcnQuc3RyaWN0RXF1YWwocHJvdmlkZXJzLmxlbmd0aCwgMSk7XG5cdFx0YXNzZXJ0LnN0cmljdEVxdWFsKHByb3ZpZGVyc1swXSA9PT0gYmFySW5mbywgdHJ1ZSk7XG5cdH0pO1xuXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLE9BQU8sWUFBWTtBQUNuQixTQUFTLGFBQWE7QUFFdEIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsWUFBWTtBQUNyQixTQUFTLCtDQUErQztBQUV4RCxTQUFTLGdDQUFnQztBQUl6QyxTQUFTLGlDQUFpQztBQUUxQyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGdDQUFnQztBQUN6QyxTQUE0QixnQ0FBZ0M7QUFDNUQsU0FBUyxxQ0FBcUM7QUFFOUMsTUFBTSw2QkFBNkIsV0FBWTtBQUM5QyxRQUFNLGNBQWMsd0NBQXdDO0FBRTVELE9BQUssaURBQWtELFdBQVk7QUFDbEUsVUFBTSx1QkFBdUIsOEJBQThCLFFBQVcsV0FBVztBQUNqRixVQUFNLFFBQVEsSUFBSTtBQUFBLE1BQ2pCLElBQUksY0FBYyxLQUFzQixFQUFFO0FBQUEsUUFDaEMsTUFBTTtBQUFFLGlCQUFPO0FBQUEsUUFBSTtBQUFBLFFBQ25CLFFBQVE7QUFBQSxRQUFFO0FBQUEsUUFDVixZQUFZO0FBQUUsaUJBQU8sQ0FBQztBQUFBLFFBQUc7QUFBQSxN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
