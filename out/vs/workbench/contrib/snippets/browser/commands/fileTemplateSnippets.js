import { groupBy, isFalsyOrEmpty } from "../../../../../base/common/arrays.js";
import { compare } from "../../../../../base/common/strings.js";
import { getCodeEditor } from "../../../../../editor/browser/editorBrowser.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import { localize, localize2 } from "../../../../../nls.js";
import { IQuickInputService } from "../../../../../platform/quickinput/common/quickInput.js";
import { SnippetsAction } from "./abstractSnippetsActions.js";
import { ISnippetsService } from "../snippets.js";
import { IEditorService } from "../../../../services/editor/common/editorService.js";
const _ApplyFileSnippetAction = class _ApplyFileSnippetAction extends SnippetsAction {
  constructor() {
    super({
      id: _ApplyFileSnippetAction.Id,
      title: localize2("label", "Fill File with Snippet"),
      f1: true
    });
  }
  async run(accessor) {
    const snippetService = accessor.get(ISnippetsService);
    const quickInputService = accessor.get(IQuickInputService);
    const editorService = accessor.get(IEditorService);
    const langService = accessor.get(ILanguageService);
    const editor = getCodeEditor(editorService.activeTextEditorControl);
    if (!editor || !editor.hasModel()) {
      return;
    }
    const snippets = await snippetService.getSnippets(void 0, { fileTemplateSnippets: true, noRecencySort: true, includeNoPrefixSnippets: true });
    if (snippets.length === 0) {
      return;
    }
    const selection = await this._pick(quickInputService, langService, snippets);
    if (!selection) {
      return;
    }
    if (editor.hasModel()) {
      SnippetController2.get(editor)?.apply([{
        range: editor.getModel().getFullModelRange(),
        template: selection.snippet.body
      }]);
      editor.getModel().setLanguage(langService.createById(selection.langId), _ApplyFileSnippetAction.Id);
      editor.focus();
    }
  }
  async _pick(quickInputService, langService, snippets) {
    const all = [];
    for (const snippet of snippets) {
      if (isFalsyOrEmpty(snippet.scopes)) {
        all.push({ langId: "", snippet });
      } else {
        for (const langId of snippet.scopes) {
          all.push({ langId, snippet });
        }
      }
    }
    const picks = [];
    const groups = groupBy(all, (a, b) => compare(a.langId, b.langId));
    for (const group of groups) {
      let first = true;
      for (const item of group) {
        if (first) {
          picks.push({
            type: "separator",
            label: langService.getLanguageName(item.langId) ?? item.langId
          });
          first = false;
        }
        picks.push({
          snippet: item,
          label: item.snippet.prefix || item.snippet.name,
          detail: item.snippet.description
        });
      }
    }
    const pick = await quickInputService.pick(picks, {
      placeHolder: localize("placeholder", "Select a snippet"),
      matchOnDetail: true
    });
    return pick?.snippet;
  }
};
_ApplyFileSnippetAction.Id = "workbench.action.populateFileFromSnippet";
let ApplyFileSnippetAction = _ApplyFileSnippetAction;
export {
  ApplyFileSnippetAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy9icm93c2VyL2NvbW1hbmRzL2ZpbGVUZW1wbGF0ZVNuaXBwZXRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZ3JvdXBCeSwgaXNGYWxzeU9yRW1wdHkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgY29tcGFyZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0cmluZ3MuanMnO1xuaW1wb3J0IHsgZ2V0Q29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzL2xhbmd1YWdlLmpzJztcbmltcG9ydCB7IFNuaXBwZXRDb250cm9sbGVyMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL3NuaXBwZXQvYnJvd3Nlci9zbmlwcGV0Q29udHJvbGxlcjIuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtLCBJUXVpY2tQaWNrU2VwYXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0c0FjdGlvbiB9IGZyb20gJy4vYWJzdHJhY3RTbmlwcGV0c0FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSVNuaXBwZXRzU2VydmljZSB9IGZyb20gJy4uL3NuaXBwZXRzLmpzJztcbmltcG9ydCB7IFNuaXBwZXQgfSBmcm9tICcuLi9zbmlwcGV0c0ZpbGUuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG5leHBvcnQgY2xhc3MgQXBwbHlGaWxlU25pcHBldEFjdGlvbiBleHRlbmRzIFNuaXBwZXRzQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5wb3B1bGF0ZUZpbGVGcm9tU25pcHBldCc7XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoe1xuXHRcdFx0aWQ6IEFwcGx5RmlsZVNuaXBwZXRBY3Rpb24uSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKCdsYWJlbCcsIFwiRmlsbCBGaWxlIHdpdGggU25pcHBldFwiKSxcblx0XHRcdGYxOiB0cnVlLFxuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgc25pcHBldFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVNuaXBwZXRzU2VydmljZSk7XG5cdFx0Y29uc3QgcXVpY2tJbnB1dFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSVF1aWNrSW5wdXRTZXJ2aWNlKTtcblx0XHRjb25zdCBlZGl0b3JTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElFZGl0b3JTZXJ2aWNlKTtcblx0XHRjb25zdCBsYW5nU2VydmljZSA9IGFjY2Vzc29yLmdldChJTGFuZ3VhZ2VTZXJ2aWNlKTtcblxuXHRcdGNvbnN0IGVkaXRvciA9IGdldENvZGVFZGl0b3IoZWRpdG9yU2VydmljZS5hY3RpdmVUZXh0RWRpdG9yQ29udHJvbCk7XG5cdFx0aWYgKCFlZGl0b3IgfHwgIWVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc25pcHBldHMgPSBhd2FpdCBzbmlwcGV0U2VydmljZS5nZXRTbmlwcGV0cyh1bmRlZmluZWQsIHsgZmlsZVRlbXBsYXRlU25pcHBldHM6IHRydWUsIG5vUmVjZW5jeVNvcnQ6IHRydWUsIGluY2x1ZGVOb1ByZWZpeFNuaXBwZXRzOiB0cnVlIH0pO1xuXHRcdGlmIChzbmlwcGV0cy5sZW5ndGggPT09IDApIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBzZWxlY3Rpb24gPSBhd2FpdCB0aGlzLl9waWNrKHF1aWNrSW5wdXRTZXJ2aWNlLCBsYW5nU2VydmljZSwgc25pcHBldHMpO1xuXHRcdGlmICghc2VsZWN0aW9uKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0aWYgKGVkaXRvci5oYXNNb2RlbCgpKSB7XG5cdFx0XHQvLyBhcHBseSBzbmlwcGV0IGVkaXQgLT4gcmVwbGFjZXMgZXZlcnl0aGluZ1xuXHRcdFx0U25pcHBldENvbnRyb2xsZXIyLmdldChlZGl0b3IpPy5hcHBseShbe1xuXHRcdFx0XHRyYW5nZTogZWRpdG9yLmdldE1vZGVsKCkuZ2V0RnVsbE1vZGVsUmFuZ2UoKSxcblx0XHRcdFx0dGVtcGxhdGU6IHNlbGVjdGlvbi5zbmlwcGV0LmJvZHlcblx0XHRcdH1dKTtcblxuXHRcdFx0Ly8gc2V0IGxhbmd1YWdlIGlmIHBvc3NpYmxlXG5cdFx0XHRlZGl0b3IuZ2V0TW9kZWwoKS5zZXRMYW5ndWFnZShsYW5nU2VydmljZS5jcmVhdGVCeUlkKHNlbGVjdGlvbi5sYW5nSWQpLCBBcHBseUZpbGVTbmlwcGV0QWN0aW9uLklkKTtcblxuXHRcdFx0ZWRpdG9yLmZvY3VzKCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfcGljayhxdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLCBsYW5nU2VydmljZTogSUxhbmd1YWdlU2VydmljZSwgc25pcHBldHM6IFNuaXBwZXRbXSkge1xuXG5cdFx0Ly8gc3ByZWFkIHNuaXBwZXQgb250byBlYWNoIGxhbmd1YWdlIGl0IHN1cHBvcnRzXG5cdFx0dHlwZSBTbmlwcGV0QW5kTGFuZ3VhZ2UgPSB7IGxhbmdJZDogc3RyaW5nOyBzbmlwcGV0OiBTbmlwcGV0IH07XG5cdFx0Y29uc3QgYWxsOiBTbmlwcGV0QW5kTGFuZ3VhZ2VbXSA9IFtdO1xuXHRcdGZvciAoY29uc3Qgc25pcHBldCBvZiBzbmlwcGV0cykge1xuXHRcdFx0aWYgKGlzRmFsc3lPckVtcHR5KHNuaXBwZXQuc2NvcGVzKSkge1xuXHRcdFx0XHRhbGwucHVzaCh7IGxhbmdJZDogJycsIHNuaXBwZXQgfSk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGxhbmdJZCBvZiBzbmlwcGV0LnNjb3Blcykge1xuXHRcdFx0XHRcdGFsbC5wdXNoKHsgbGFuZ0lkLCBzbmlwcGV0IH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dHlwZSBTbmlwcGV0QW5kTGFuZ3VhZ2VQaWNrID0gSVF1aWNrUGlja0l0ZW0gJiB7IHNuaXBwZXQ6IFNuaXBwZXRBbmRMYW5ndWFnZSB9O1xuXHRcdGNvbnN0IHBpY2tzOiAoU25pcHBldEFuZExhbmd1YWdlUGljayB8IElRdWlja1BpY2tTZXBhcmF0b3IpW10gPSBbXTtcblxuXHRcdGNvbnN0IGdyb3VwcyA9IGdyb3VwQnkoYWxsLCAoYSwgYikgPT4gY29tcGFyZShhLmxhbmdJZCwgYi5sYW5nSWQpKTtcblxuXHRcdGZvciAoY29uc3QgZ3JvdXAgb2YgZ3JvdXBzKSB7XG5cdFx0XHRsZXQgZmlyc3QgPSB0cnVlO1xuXHRcdFx0Zm9yIChjb25zdCBpdGVtIG9mIGdyb3VwKSB7XG5cblx0XHRcdFx0aWYgKGZpcnN0KSB7XG5cdFx0XHRcdFx0cGlja3MucHVzaCh7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc2VwYXJhdG9yJyxcblx0XHRcdFx0XHRcdGxhYmVsOiBsYW5nU2VydmljZS5nZXRMYW5ndWFnZU5hbWUoaXRlbS5sYW5nSWQpID8/IGl0ZW0ubGFuZ0lkXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0Zmlyc3QgPSBmYWxzZTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHBpY2tzLnB1c2goe1xuXHRcdFx0XHRcdHNuaXBwZXQ6IGl0ZW0sXG5cdFx0XHRcdFx0bGFiZWw6IGl0ZW0uc25pcHBldC5wcmVmaXggfHwgaXRlbS5zbmlwcGV0Lm5hbWUsXG5cdFx0XHRcdFx0ZGV0YWlsOiBpdGVtLnNuaXBwZXQuZGVzY3JpcHRpb25cblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGljayA9IGF3YWl0IHF1aWNrSW5wdXRTZXJ2aWNlLnBpY2socGlja3MsIHtcblx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgncGxhY2Vob2xkZXInLCAnU2VsZWN0IGEgc25pcHBldCcpLFxuXHRcdFx0bWF0Y2hPbkRldGFpbDogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdHJldHVybiBwaWNrPy5zbmlwcGV0O1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLFNBQVMsc0JBQXNCO0FBQ3hD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
