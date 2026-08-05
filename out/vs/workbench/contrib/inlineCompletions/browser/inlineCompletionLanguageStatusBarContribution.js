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
import { localize } from "../../../../nls.js";
import { createHotClass } from "../../../../base/common/hotReloadHelpers.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { autorunWithStore, derived } from "../../../../base/common/observable.js";
import { debouncedObservable } from "../../../../base/common/observableInternal/utils.js";
import Severity from "../../../../base/common/severity.js";
import { InlineCompletionsController } from "../../../../editor/contrib/inlineCompletions/browser/controller/inlineCompletionsController.js";
import { ILanguageStatusService } from "../../../services/languageStatus/common/languageStatusService.js";
import { observableCodeEditor } from "../../../../editor/browser/observableCodeEditor.js";
let InlineCompletionLanguageStatusBarContribution = class extends Disposable {
  constructor(_editor, _languageStatusService) {
    super();
    this._editor = _editor;
    this._languageStatusService = _languageStatusService;
    this._c = InlineCompletionsController.get(this._editor);
    this._state = derived(this, (reader) => {
      const model = this._c?.model.read(reader);
      if (!model) {
        return void 0;
      }
      if (!observableCodeEditor(this._editor).isFocused.read(reader)) {
        return void 0;
      }
      return {
        model,
        status: debouncedObservable(model.status, 300)
      };
    });
    this._register(autorunWithStore((reader, store) => {
      const state = this._state.read(reader);
      if (!state) {
        return;
      }
      const status = state.status.read(reader);
      const statusMap = {
        loading: { shortLabel: "", label: localize("inlineSuggestionLoading", "Loading..."), loading: true },
        ghostText: { shortLabel: "$(lightbulb)", label: "$(copilot) " + localize("inlineCompletionAvailable", "Inline completion available"), loading: false },
        inlineEdit: { shortLabel: "$(lightbulb-sparkle)", label: "$(copilot) " + localize("inlineEditAvailable", "Inline edit available"), loading: false },
        noSuggestion: { shortLabel: "$(circle-slash)", label: "$(copilot) " + localize("noInlineSuggestionAvailable", "No inline suggestion available"), loading: false }
      };
      InlineCompletionLanguageStatusBarContribution.languageStatusBarDisposables.forEach((d) => d.clear());
      InlineCompletionLanguageStatusBarContribution.languageStatusBarDisposables.add(store);
      store.add({
        dispose: () => InlineCompletionLanguageStatusBarContribution.languageStatusBarDisposables.delete(store)
      });
      store.add(this._languageStatusService.addStatus({
        accessibilityInfo: void 0,
        busy: statusMap[status].loading,
        command: void 0,
        detail: localize("inlineSuggestionsSmall", "Inline suggestions"),
        id: "inlineSuggestions",
        label: { value: statusMap[status].label, shortValue: statusMap[status].shortLabel },
        name: localize("inlineSuggestions", "Inline Suggestions"),
        selector: { pattern: state.model.textModel.uri.fsPath },
        severity: Severity.Info,
        source: "inlineSuggestions"
      }));
    }));
  }
};
InlineCompletionLanguageStatusBarContribution.hot = createHotClass(InlineCompletionLanguageStatusBarContribution);
InlineCompletionLanguageStatusBarContribution.Id = "vs.editor.contrib.inlineCompletionLanguageStatusBarContribution";
InlineCompletionLanguageStatusBarContribution.languageStatusBarDisposables = /* @__PURE__ */ new Set();
InlineCompletionLanguageStatusBarContribution = __decorateClass([
  __decorateParam(1, ILanguageStatusService)
], InlineCompletionLanguageStatusBarContribution);
export {
  InlineCompletionLanguageStatusBarContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL2lubGluZUNvbXBsZXRpb25MYW5ndWFnZVN0YXR1c0JhckNvbnRyaWJ1dGlvbi50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGNyZWF0ZUhvdENsYXNzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaG90UmVsb2FkSGVscGVycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bldpdGhTdG9yZSwgZGVyaXZlZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgZGVib3VuY2VkT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC91dGlscy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2lubGluZUNvbXBsZXRpb25zL2Jyb3dzZXIvY29udHJvbGxlci9pbmxpbmVDb21wbGV0aW9uc0NvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU3RhdHVzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xhbmd1YWdlU3RhdHVzL2NvbW1vbi9sYW5ndWFnZVN0YXR1c1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5cbmV4cG9ydCBjbGFzcyBJbmxpbmVDb21wbGV0aW9uTGFuZ3VhZ2VTdGF0dXNCYXJDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBob3QgPSBjcmVhdGVIb3RDbGFzcyhJbmxpbmVDb21wbGV0aW9uTGFuZ3VhZ2VTdGF0dXNCYXJDb250cmlidXRpb24pO1xuXG5cdHB1YmxpYyBzdGF0aWMgSWQgPSAndnMuZWRpdG9yLmNvbnRyaWIuaW5saW5lQ29tcGxldGlvbkxhbmd1YWdlU3RhdHVzQmFyQ29udHJpYnV0aW9uJztcblx0cHVibGljIHN0YXRpYyByZWFkb25seSBsYW5ndWFnZVN0YXR1c0JhckRpc3Bvc2FibGVzID0gbmV3IFNldDxEaXNwb3NhYmxlU3RvcmU+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYyA9IElubGluZUNvbXBsZXRpb25zQ29udHJvbGxlci5nZXQodGhpcy5fZWRpdG9yKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGF0ZSA9IGRlcml2ZWQodGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2M/Lm1vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIW1vZGVsKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRpZiAoIW9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuX2VkaXRvcikuaXNGb2N1c2VkLnJlYWQocmVhZGVyKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0bW9kZWwsXG5cdFx0XHRzdGF0dXM6IGRlYm91bmNlZE9ic2VydmFibGUobW9kZWwuc3RhdHVzLCAzMDApLFxuXHRcdH07XG5cdH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0QElMYW5ndWFnZVN0YXR1c1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlOiBJTGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoYXV0b3J1bldpdGhTdG9yZSgocmVhZGVyLCBzdG9yZSkgPT4ge1xuXHRcdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLl9zdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoIXN0YXRlKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc3RhdHVzID0gc3RhdGUuc3RhdHVzLnJlYWQocmVhZGVyKTtcblxuXHRcdFx0Y29uc3Qgc3RhdHVzTWFwOiBSZWNvcmQ8dHlwZW9mIHN0YXR1cywgeyBzaG9ydExhYmVsOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IGxvYWRpbmc6IGJvb2xlYW4gfT4gPSB7XG5cdFx0XHRcdGxvYWRpbmc6IHsgc2hvcnRMYWJlbDogJycsIGxhYmVsOiBsb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdGlvbkxvYWRpbmcnLCBcIkxvYWRpbmcuLi5cIiksIGxvYWRpbmc6IHRydWUsIH0sXG5cdFx0XHRcdGdob3N0VGV4dDogeyBzaG9ydExhYmVsOiAnJChsaWdodGJ1bGIpJywgbGFiZWw6ICckKGNvcGlsb3QpICcgKyBsb2NhbGl6ZSgnaW5saW5lQ29tcGxldGlvbkF2YWlsYWJsZScsIFwiSW5saW5lIGNvbXBsZXRpb24gYXZhaWxhYmxlXCIpLCBsb2FkaW5nOiBmYWxzZSwgfSxcblx0XHRcdFx0aW5saW5lRWRpdDogeyBzaG9ydExhYmVsOiAnJChsaWdodGJ1bGItc3BhcmtsZSknLCBsYWJlbDogJyQoY29waWxvdCkgJyArIGxvY2FsaXplKCdpbmxpbmVFZGl0QXZhaWxhYmxlJywgXCJJbmxpbmUgZWRpdCBhdmFpbGFibGVcIiksIGxvYWRpbmc6IGZhbHNlLCB9LFxuXHRcdFx0XHRub1N1Z2dlc3Rpb246IHsgc2hvcnRMYWJlbDogJyQoY2lyY2xlLXNsYXNoKScsIGxhYmVsOiAnJChjb3BpbG90KSAnICsgbG9jYWxpemUoJ25vSW5saW5lU3VnZ2VzdGlvbkF2YWlsYWJsZScsIFwiTm8gaW5saW5lIHN1Z2dlc3Rpb24gYXZhaWxhYmxlXCIpLCBsb2FkaW5nOiBmYWxzZSwgfSxcblx0XHRcdH07XG5cblx0XHRcdC8vIE1ha2Ugc3VyZSBwcmV2aW91cyBzdGF0dXMgaXMgY2xlYXJlZCBiZWZvcmUgdGhlIG5ldyBpcyByZWdpc3RlcmVkLiBUaGlzIHdvcmtzLCBidXQgaXMgYSBiaXQgaGFja3kuXG5cdFx0XHQvLyBUT0RPOiBVc2UgYSB3b3JrYmVuY2ggY29udHJpYnV0aW9uIHRvIGdldCBzaW5nbGV0b24gYmVoYXZpb3IuXG5cdFx0XHRJbmxpbmVDb21wbGV0aW9uTGFuZ3VhZ2VTdGF0dXNCYXJDb250cmlidXRpb24ubGFuZ3VhZ2VTdGF0dXNCYXJEaXNwb3NhYmxlcy5mb3JFYWNoKGQgPT4gZC5jbGVhcigpKTtcblxuXHRcdFx0SW5saW5lQ29tcGxldGlvbkxhbmd1YWdlU3RhdHVzQmFyQ29udHJpYnV0aW9uLmxhbmd1YWdlU3RhdHVzQmFyRGlzcG9zYWJsZXMuYWRkKHN0b3JlKTtcblx0XHRcdHN0b3JlLmFkZCh7XG5cdFx0XHRcdGRpc3Bvc2U6ICgpID0+IElubGluZUNvbXBsZXRpb25MYW5ndWFnZVN0YXR1c0JhckNvbnRyaWJ1dGlvbi5sYW5ndWFnZVN0YXR1c0JhckRpc3Bvc2FibGVzLmRlbGV0ZShzdG9yZSlcblx0XHRcdH0pO1xuXG5cdFx0XHRzdG9yZS5hZGQodGhpcy5fbGFuZ3VhZ2VTdGF0dXNTZXJ2aWNlLmFkZFN0YXR1cyh7XG5cdFx0XHRcdGFjY2Vzc2liaWxpdHlJbmZvOiB1bmRlZmluZWQsXG5cdFx0XHRcdGJ1c3k6IHN0YXR1c01hcFtzdGF0dXNdLmxvYWRpbmcsXG5cdFx0XHRcdGNvbW1hbmQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZGV0YWlsOiBsb2NhbGl6ZSgnaW5saW5lU3VnZ2VzdGlvbnNTbWFsbCcsIFwiSW5saW5lIHN1Z2dlc3Rpb25zXCIpLFxuXHRcdFx0XHRpZDogJ2lubGluZVN1Z2dlc3Rpb25zJyxcblx0XHRcdFx0bGFiZWw6IHsgdmFsdWU6IHN0YXR1c01hcFtzdGF0dXNdLmxhYmVsLCBzaG9ydFZhbHVlOiBzdGF0dXNNYXBbc3RhdHVzXS5zaG9ydExhYmVsIH0sXG5cdFx0XHRcdG5hbWU6IGxvY2FsaXplKCdpbmxpbmVTdWdnZXN0aW9ucycsIFwiSW5saW5lIFN1Z2dlc3Rpb25zXCIpLFxuXHRcdFx0XHRzZWxlY3RvcjogeyBwYXR0ZXJuOiBzdGF0ZS5tb2RlbC50ZXh0TW9kZWwudXJpLmZzUGF0aCB9LFxuXHRcdFx0XHRzZXZlcml0eTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0c291cmNlOiAnaW5saW5lU3VnZ2VzdGlvbnMnLFxuXHRcdFx0fSkpO1xuXHRcdH0pKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFtQztBQUM1QyxTQUFTLGtCQUFrQixlQUFlO0FBQzFDLFNBQVMsMkJBQTJCO0FBQ3BDLE9BQU8sY0FBYztBQUVyQixTQUFTLG1DQUFtQztBQUM1QyxTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDRCQUE0QjtBQUU5QixJQUFNLGdEQUFOLGNBQTRELFdBQVc7QUFBQSxFQXFCN0UsWUFDa0IsU0FDd0Isd0JBQ3hDO0FBQ0QsVUFBTTtBQUhXO0FBQ3dCO0FBakIxQyxTQUFpQixLQUFLLDRCQUE0QixJQUFJLEtBQUssT0FBTztBQUVsRSxTQUFpQixTQUFTLFFBQVEsTUFBTSxZQUFVO0FBQ2pELFlBQU0sUUFBUSxLQUFLLElBQUksTUFBTSxLQUFLLE1BQU07QUFDeEMsVUFBSSxDQUFDLE9BQU87QUFBRSxlQUFPO0FBQUEsTUFBVztBQUNoQyxVQUFJLENBQUMscUJBQXFCLEtBQUssT0FBTyxFQUFFLFVBQVUsS0FBSyxNQUFNLEdBQUc7QUFDL0QsZUFBTztBQUFBLE1BQ1I7QUFFQSxhQUFPO0FBQUEsUUFDTjtBQUFBLFFBQ0EsUUFBUSxvQkFBb0IsTUFBTSxRQUFRLEdBQUc7QUFBQSxNQUM5QztBQUFBLElBQ0QsQ0FBQztBQVFBLFNBQUssVUFBVSxpQkFBaUIsQ0FBQyxRQUFRLFVBQVU7QUFDbEQsWUFBTSxRQUFRLEtBQUssT0FBTyxLQUFLLE1BQU07QUFDckMsVUFBSSxDQUFDLE9BQU87QUFDWDtBQUFBLE1BQ0Q7QUFFQSxZQUFNLFNBQVMsTUFBTSxPQUFPLEtBQUssTUFBTTtBQUV2QyxZQUFNLFlBQTRGO0FBQUEsUUFDakcsU0FBUyxFQUFFLFlBQVksSUFBSSxPQUFPLFNBQVMsMkJBQTJCLFlBQVksR0FBRyxTQUFTLEtBQU07QUFBQSxRQUNwRyxXQUFXLEVBQUUsWUFBWSxnQkFBZ0IsT0FBTyxnQkFBZ0IsU0FBUyw2QkFBNkIsNkJBQTZCLEdBQUcsU0FBUyxNQUFPO0FBQUEsUUFDdEosWUFBWSxFQUFFLFlBQVksd0JBQXdCLE9BQU8sZ0JBQWdCLFNBQVMsdUJBQXVCLHVCQUF1QixHQUFHLFNBQVMsTUFBTztBQUFBLFFBQ25KLGNBQWMsRUFBRSxZQUFZLG1CQUFtQixPQUFPLGdCQUFnQixTQUFTLCtCQUErQixnQ0FBZ0MsR0FBRyxTQUFTLE1BQU87QUFBQSxNQUNsSztBQUlBLG9EQUE4Qyw2QkFBNkIsUUFBUSxPQUFLLEVBQUUsTUFBTSxDQUFDO0FBRWpHLG9EQUE4Qyw2QkFBNkIsSUFBSSxLQUFLO0FBQ3BGLFlBQU0sSUFBSTtBQUFBLFFBQ1QsU0FBUyxNQUFNLDhDQUE4Qyw2QkFBNkIsT0FBTyxLQUFLO0FBQUEsTUFDdkcsQ0FBQztBQUVELFlBQU0sSUFBSSxLQUFLLHVCQUF1QixVQUFVO0FBQUEsUUFDL0MsbUJBQW1CO0FBQUEsUUFDbkIsTUFBTSxVQUFVLE1BQU0sRUFBRTtBQUFBLFFBQ3hCLFNBQVM7QUFBQSxRQUNULFFBQVEsU0FBUywwQkFBMEIsb0JBQW9CO0FBQUEsUUFDL0QsSUFBSTtBQUFBLFFBQ0osT0FBTyxFQUFFLE9BQU8sVUFBVSxNQUFNLEVBQUUsT0FBTyxZQUFZLFVBQVUsTUFBTSxFQUFFLFdBQVc7QUFBQSxRQUNsRixNQUFNLFNBQVMscUJBQXFCLG9CQUFvQjtBQUFBLFFBQ3hELFVBQVUsRUFBRSxTQUFTLE1BQU0sTUFBTSxVQUFVLElBQUksT0FBTztBQUFBLFFBQ3RELFVBQVUsU0FBUztBQUFBLFFBQ25CLFFBQVE7QUFBQSxNQUNULENBQUMsQ0FBQztBQUFBLElBQ0gsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBakVhLDhDQUNXLE1BQU0sZUFBZSw2Q0FBNkM7QUFEN0UsOENBR0UsS0FBSztBQUhQLDhDQUlXLCtCQUErQixvQkFBSSxJQUFxQjtBQUpuRSxnREFBTjtBQUFBLEVBdUJKO0FBQUEsR0F2QlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
