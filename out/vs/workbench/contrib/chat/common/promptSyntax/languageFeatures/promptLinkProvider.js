var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __decorateClass = (decorators, target, key, kind) => {
  var result = kind > 1 ? void 0 : kind ? __getOwnPropDesc(target, key) : target;
  for (var i = decorators.length - 1, decorator; i >= 0; i--)
    if (decorator = decorators[i])
      result = (kind ? decorator(target, key, result) : decorator(result)) || result;
  if (kind && result) __defProp(target, key, result);
  return result;
};
var __decorateParam = (index, decorator) => (target, key) => decorator(target, key, index);
import { LANGUAGE_SELECTOR } from "../constants.js";
import { IPromptsService } from "../service/types.js";
import { assert } from "../../../../../../base/common/assert.js";
import { assertDefined } from "../../../../../../base/common/types.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { CancellationError } from "../../../../../../base/common/errors.js";
import { Registry } from "../../../../../../platform/registry/common/platform.js";
import { FolderReference, NotPromptFile } from "../../promptFileReferenceErrors.js";
import { LifecyclePhase } from "../../../../../services/lifecycle/common/lifecycle.js";
import { Extensions } from "../../../../../common/contributions.js";
import { ILanguageFeaturesService } from "../../../../../../editor/common/services/languageFeatures.js";
let PromptLinkProvider = class extends Disposable {
  constructor(promptsService, languageService) {
    super();
    this.promptsService = promptsService;
    this.languageService = languageService;
    this._register(this.languageService.linkProvider.register(LANGUAGE_SELECTOR, this));
  }
  /**
   * Provide list of links for the provided text model.
   */
  async provideLinks(model, token) {
    assert(
      !token.isCancellationRequested,
      new CancellationError()
    );
    const parser = this.promptsService.getSyntaxParserFor(model);
    assert(
      !parser.disposed,
      "Prompt parser must not be disposed."
    );
    const { references } = await parser.start().settled();
    assert(
      !token.isCancellationRequested,
      new CancellationError()
    );
    const links = references.filter((reference) => {
      const { errorCondition, linkRange } = reference;
      if (!errorCondition && linkRange) {
        return true;
      }
      if (errorCondition instanceof FolderReference) {
        return false;
      }
      return errorCondition instanceof NotPromptFile;
    }).map((reference) => {
      const { uri, linkRange } = reference;
      assertDefined(
        linkRange,
        "Link range must be defined."
      );
      return {
        range: linkRange,
        url: uri
      };
    });
    return {
      links
    };
  }
};
PromptLinkProvider = __decorateClass([
  __decorateParam(0, IPromptsService),
  __decorateParam(1, ILanguageFeaturesService)
], PromptLinkProvider);
Registry.as(Extensions.Workbench).registerWorkbenchContribution(PromptLinkProvider, LifecyclePhase.Eventually);
export {
  PromptLinkProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9wcm9tcHRTeW50YXgvbGFuZ3VhZ2VGZWF0dXJlcy9wcm9tcHRMaW5rUHJvdmlkZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBMQU5HVUFHRV9TRUxFQ1RPUiB9IGZyb20gJy4uL2NvbnN0YW50cy5qcyc7XG5pbXBvcnQgeyBJUHJvbXB0c1NlcnZpY2UgfSBmcm9tICcuLi9zZXJ2aWNlL3R5cGVzLmpzJztcbmltcG9ydCB7IGFzc2VydCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Fzc2VydC5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBhc3NlcnREZWZpbmVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBGb2xkZXJSZWZlcmVuY2UsIE5vdFByb21wdEZpbGUgfSBmcm9tICcuLi8uLi9wcm9tcHRGaWxlUmVmZXJlbmNlRXJyb3JzLmpzJztcbmltcG9ydCB7IExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUxpbmssIElMaW5rc0xpc3QsIExpbmtQcm92aWRlciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb25zUmVnaXN0cnksIEV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuXG4vKipcbiAqIFByb3ZpZGVzIGxpbmsgcmVmZXJlbmNlcyBmb3IgcHJvbXB0IGZpbGVzLlxuICovXG5leHBvcnQgY2xhc3MgUHJvbXB0TGlua1Byb3ZpZGVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIExpbmtQcm92aWRlciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUHJvbXB0c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcm9tcHRzU2VydmljZTogSVByb21wdHNTZXJ2aWNlLFxuXHRcdEBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmxpbmtQcm92aWRlci5yZWdpc3RlcihMQU5HVUFHRV9TRUxFQ1RPUiwgdGhpcykpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFByb3ZpZGUgbGlzdCBvZiBsaW5rcyBmb3IgdGhlIHByb3ZpZGVkIHRleHQgbW9kZWwuXG5cdCAqL1xuXHRwdWJsaWMgYXN5bmMgcHJvdmlkZUxpbmtzKFxuXHRcdG1vZGVsOiBJVGV4dE1vZGVsLFxuXHRcdHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbixcblx0KTogUHJvbWlzZTxJTGlua3NMaXN0PiB7XG5cdFx0YXNzZXJ0KFxuXHRcdFx0IXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkLFxuXHRcdFx0bmV3IENhbmNlbGxhdGlvbkVycm9yKCksXG5cdFx0KTtcblxuXHRcdGNvbnN0IHBhcnNlciA9IHRoaXMucHJvbXB0c1NlcnZpY2UuZ2V0U3ludGF4UGFyc2VyRm9yKG1vZGVsKTtcblx0XHRhc3NlcnQoXG5cdFx0XHQhcGFyc2VyLmRpc3Bvc2VkLFxuXHRcdFx0J1Byb21wdCBwYXJzZXIgbXVzdCBub3QgYmUgZGlzcG9zZWQuJyxcblx0XHQpO1xuXG5cdFx0Ly8gc3RhcnQgdGhlIHBhcnNlciBpbiBjYXNlIGl0IHdhcyBub3Qgc3RhcnRlZCB5ZXQsXG5cdFx0Ly8gYW5kIHdhaXQgZm9yIGl0IHRvIHNldHRsZSB0byBhIGZpbmFsIHJlc3VsdFxuXHRcdGNvbnN0IHsgcmVmZXJlbmNlcyB9ID0gYXdhaXQgcGFyc2VyXG5cdFx0XHQuc3RhcnQoKVxuXHRcdFx0LnNldHRsZWQoKTtcblxuXHRcdC8vIHZhbGlkYXRlIHRoYXQgdGhlIGNhbmNlbGxhdGlvbiB3YXMgbm90IHlldCByZXF1ZXN0ZWRcblx0XHRhc3NlcnQoXG5cdFx0XHQhdG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQsXG5cdFx0XHRuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKSxcblx0XHQpO1xuXG5cdFx0Ly8gZmlsdGVyIG91dCByZWZlcmVuY2VzIHRoYXQgYXJlIG5vdCB2YWxpZCBsaW5rc1xuXHRcdGNvbnN0IGxpbmtzOiBJTGlua1tdID0gcmVmZXJlbmNlc1xuXHRcdFx0LmZpbHRlcigocmVmZXJlbmNlKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHsgZXJyb3JDb25kaXRpb24sIGxpbmtSYW5nZSB9ID0gcmVmZXJlbmNlO1xuXHRcdFx0XHRpZiAoIWVycm9yQ29uZGl0aW9uICYmIGxpbmtSYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gZG9uJ3QgcHJvdmlkZSBsaW5rcyBmb3IgZm9sZGVyIHJlZmVyZW5jZXNcblx0XHRcdFx0aWYgKGVycm9yQ29uZGl0aW9uIGluc3RhbmNlb2YgRm9sZGVyUmVmZXJlbmNlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIGVycm9yQ29uZGl0aW9uIGluc3RhbmNlb2YgTm90UHJvbXB0RmlsZTtcblx0XHRcdH0pXG5cdFx0XHQubWFwKChyZWZlcmVuY2UpID0+IHtcblx0XHRcdFx0Y29uc3QgeyB1cmksIGxpbmtSYW5nZSB9ID0gcmVmZXJlbmNlO1xuXG5cdFx0XHRcdC8vIG11c3QgYWx3YXlzIGJlIHRydWUgYmVjYXVzZSBvZiB0aGUgZmlsdGVyIGFib3ZlXG5cdFx0XHRcdGFzc2VydERlZmluZWQoXG5cdFx0XHRcdFx0bGlua1JhbmdlLFxuXHRcdFx0XHRcdCdMaW5rIHJhbmdlIG11c3QgYmUgZGVmaW5lZC4nLFxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cmFuZ2U6IGxpbmtSYW5nZSxcblx0XHRcdFx0XHR1cmw6IHVyaSxcblx0XHRcdFx0fTtcblx0XHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGxpbmtzLFxuXHRcdH07XG5cdH1cbn1cblxuLy8gcmVnaXN0ZXIgdGhlIHByb3ZpZGVyIGFzIGEgd29ya2JlbmNoIGNvbnRyaWJ1dGlvblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihQcm9tcHRMaW5rUHJvdmlkZXIsIExpZmVjeWNsZVBoYXNlLkV2ZW50dWFsbHkpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGNBQWM7QUFFdkIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFFbEMsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQkFBaUIscUJBQXFCO0FBQy9DLFNBQVMsc0JBQXNCO0FBRS9CLFNBQTBDLGtCQUFrQjtBQUM1RCxTQUFTLGdDQUFnQztBQUtsQyxJQUFNLHFCQUFOLGNBQWlDLFdBQW1DO0FBQUEsRUFDMUUsWUFDbUMsZ0JBQ1MsaUJBQzFDO0FBQ0QsVUFBTTtBQUg0QjtBQUNTO0FBSTNDLFNBQUssVUFBVSxLQUFLLGdCQUFnQixhQUFhLFNBQVMsbUJBQW1CLElBQUksQ0FBQztBQUFBLEVBQ25GO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxNQUFhLGFBQ1osT0FDQSxPQUNzQjtBQUN0QjtBQUFBLE1BQ0MsQ0FBQyxNQUFNO0FBQUEsTUFDUCxJQUFJLGtCQUFrQjtBQUFBLElBQ3ZCO0FBRUEsVUFBTSxTQUFTLEtBQUssZUFBZSxtQkFBbUIsS0FBSztBQUMzRDtBQUFBLE1BQ0MsQ0FBQyxPQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFJQSxVQUFNLEVBQUUsV0FBVyxJQUFJLE1BQU0sT0FDM0IsTUFBTSxFQUNOLFFBQVE7QUFHVjtBQUFBLE1BQ0MsQ0FBQyxNQUFNO0FBQUEsTUFDUCxJQUFJLGtCQUFrQjtBQUFBLElBQ3ZCO0FBR0EsVUFBTSxRQUFpQixXQUNyQixPQUFPLENBQUMsY0FBYztBQUN0QixZQUFNLEVBQUUsZ0JBQWdCLFVBQVUsSUFBSTtBQUN0QyxVQUFJLENBQUMsa0JBQWtCLFdBQVc7QUFDakMsZUFBTztBQUFBLE1BQ1I7QUFHQSxVQUFJLDBCQUEwQixpQkFBaUI7QUFDOUMsZUFBTztBQUFBLE1BQ1I7QUFFQSxhQUFPLDBCQUEwQjtBQUFBLElBQ2xDLENBQUMsRUFDQSxJQUFJLENBQUMsY0FBYztBQUNuQixZQUFNLEVBQUUsS0FBSyxVQUFVLElBQUk7QUFHM0I7QUFBQSxRQUNDO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFFQSxhQUFPO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxLQUFLO0FBQUEsTUFDTjtBQUFBLElBQ0QsQ0FBQztBQUVGLFdBQU87QUFBQSxNQUNOO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQTFFYSxxQkFBTjtBQUFBLEVBRUo7QUFBQSxFQUNBO0FBQUEsR0FIVTtBQTZFYixTQUFTLEdBQW9DLFdBQVcsU0FBUyxFQUMvRCw4QkFBOEIsb0JBQW9CLGVBQWUsVUFBVTsiLAogICJuYW1lcyI6IFtdCn0K
