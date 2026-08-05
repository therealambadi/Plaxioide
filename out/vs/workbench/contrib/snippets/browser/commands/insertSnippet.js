import { EditorContextKeys } from "../../../../../editor/common/editorContextKeys.js";
import { ILanguageService } from "../../../../../editor/common/languages/language.js";
import { SnippetController2 } from "../../../../../editor/contrib/snippet/browser/snippetController2.js";
import * as nls from "../../../../../nls.js";
import { IClipboardService } from "../../../../../platform/clipboard/common/clipboardService.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { SnippetEditorAction } from "./abstractSnippetsActions.js";
import { pickSnippet } from "../snippetPicker.js";
import { ISnippetsService } from "../snippets.js";
import { Snippet, SnippetSource } from "../snippetsFile.js";
const _Args = class _Args {
  constructor(snippet, name, langId) {
    this.snippet = snippet;
    this.name = name;
    this.langId = langId;
  }
  static fromUser(arg) {
    if (!arg || typeof arg !== "object") {
      return _Args._empty;
    }
    let { snippet, name, langId } = arg;
    if (typeof snippet !== "string") {
      snippet = void 0;
    }
    if (typeof name !== "string") {
      name = void 0;
    }
    if (typeof langId !== "string") {
      langId = void 0;
    }
    return new _Args(snippet, name, langId);
  }
};
_Args._empty = new _Args(void 0, void 0, void 0);
let Args = _Args;
class InsertSnippetAction extends SnippetEditorAction {
  constructor() {
    super({
      id: "editor.action.insertSnippet",
      title: nls.localize2("snippet.suggestions.label", "Insert Snippet"),
      f1: true,
      precondition: EditorContextKeys.writable,
      metadata: {
        description: `Insert Snippet`,
        args: [{
          name: "args",
          schema: {
            "type": "object",
            "properties": {
              "snippet": {
                "type": "string"
              },
              "langId": {
                "type": "string"
              },
              "name": {
                "type": "string"
              }
            }
          }
        }]
      }
    });
  }
  async runEditorCommand(accessor, editor, arg) {
    const languageService = accessor.get(ILanguageService);
    const snippetService = accessor.get(ISnippetsService);
    if (!editor.hasModel()) {
      return;
    }
    const clipboardService = accessor.get(IClipboardService);
    const instaService = accessor.get(IInstantiationService);
    const snippet = await new Promise((resolve, reject) => {
      const { lineNumber, column } = editor.getPosition();
      const { snippet: snippet2, name, langId } = Args.fromUser(arg);
      if (snippet2) {
        return resolve(new Snippet(
          false,
          [],
          "",
          "",
          "",
          snippet2,
          "",
          SnippetSource.User,
          `random/${Math.random()}`
        ));
      }
      let languageId;
      if (langId) {
        if (!languageService.isRegisteredLanguageId(langId)) {
          return resolve(void 0);
        }
        languageId = langId;
      } else {
        editor.getModel().tokenization.tokenizeIfCheap(lineNumber);
        languageId = editor.getModel().getLanguageIdAtPosition(lineNumber, column);
        if (!languageService.getLanguageName(languageId)) {
          languageId = editor.getModel().getLanguageId();
        }
      }
      if (name) {
        snippetService.getSnippets(languageId, { includeNoPrefixSnippets: true }).then((snippets) => snippets.find((snippet3) => snippet3.name === name)).then(resolve, reject);
      } else {
        resolve(instaService.invokeFunction(pickSnippet, languageId));
      }
    });
    if (!snippet) {
      return;
    }
    let clipboardText;
    if (snippet.needsClipboard) {
      clipboardText = await clipboardService.readText();
    }
    editor.focus();
    SnippetController2.get(editor)?.insert(snippet.codeSnippet, { clipboardText });
    snippetService.updateUsageTimestamp(snippet);
  }
}
export {
  InsertSnippetAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zbmlwcGV0cy9icm93c2VyL2NvbW1hbmRzL2luc2VydFNuaXBwZXQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckJyb3dzZXIuanMnO1xuaW1wb3J0IHsgU2VydmljZXNBY2Nlc3NvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRWRpdG9yQ29udGV4dEtleXMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2VkaXRvckNvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy9sYW5ndWFnZS5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0Q29udHJvbGxlcjIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29udHJpYi9zbmlwcGV0L2Jyb3dzZXIvc25pcHBldENvbnRyb2xsZXIyLmpzJztcbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNsaXBib2FyZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jbGlwYm9hcmQvY29tbW9uL2NsaXBib2FyZFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBTbmlwcGV0RWRpdG9yQWN0aW9uIH0gZnJvbSAnLi9hYnN0cmFjdFNuaXBwZXRzQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBwaWNrU25pcHBldCB9IGZyb20gJy4uL3NuaXBwZXRQaWNrZXIuanMnO1xuaW1wb3J0IHsgSVNuaXBwZXRzU2VydmljZSB9IGZyb20gJy4uL3NuaXBwZXRzLmpzJztcbmltcG9ydCB7IFNuaXBwZXQsIFNuaXBwZXRTb3VyY2UgfSBmcm9tICcuLi9zbmlwcGV0c0ZpbGUuanMnO1xuXG5jbGFzcyBBcmdzIHtcblxuXHRzdGF0aWMgZnJvbVVzZXIoYXJnOiBhbnkpOiBBcmdzIHtcblx0XHRpZiAoIWFyZyB8fCB0eXBlb2YgYXJnICE9PSAnb2JqZWN0Jykge1xuXHRcdFx0cmV0dXJuIEFyZ3MuX2VtcHR5O1xuXHRcdH1cblx0XHRsZXQgeyBzbmlwcGV0LCBuYW1lLCBsYW5nSWQgfSA9IGFyZztcblx0XHRpZiAodHlwZW9mIHNuaXBwZXQgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRzbmlwcGV0ID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIG5hbWUgIT09ICdzdHJpbmcnKSB7XG5cdFx0XHRuYW1lID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRpZiAodHlwZW9mIGxhbmdJZCAhPT0gJ3N0cmluZycpIHtcblx0XHRcdGxhbmdJZCA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIG5ldyBBcmdzKHNuaXBwZXQsIG5hbWUsIGxhbmdJZCk7XG5cdH1cblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBfZW1wdHkgPSBuZXcgQXJncyh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkKTtcblxuXHRwcml2YXRlIGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBzbmlwcGV0OiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0cHVibGljIHJlYWRvbmx5IG5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbGFuZ0lkOiBzdHJpbmcgfCB1bmRlZmluZWRcblx0KSB7IH1cbn1cblxuZXhwb3J0IGNsYXNzIEluc2VydFNuaXBwZXRBY3Rpb24gZXh0ZW5kcyBTbmlwcGV0RWRpdG9yQWN0aW9uIHtcblxuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcih7XG5cdFx0XHRpZDogJ2VkaXRvci5hY3Rpb24uaW5zZXJ0U25pcHBldCcsXG5cdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplMignc25pcHBldC5zdWdnZXN0aW9ucy5sYWJlbCcsIFwiSW5zZXJ0IFNuaXBwZXRcIiksXG5cdFx0XHRmMTogdHJ1ZSxcblx0XHRcdHByZWNvbmRpdGlvbjogRWRpdG9yQ29udGV4dEtleXMud3JpdGFibGUsXG5cdFx0XHRtZXRhZGF0YToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogYEluc2VydCBTbmlwcGV0YCxcblx0XHRcdFx0YXJnczogW3tcblx0XHRcdFx0XHRuYW1lOiAnYXJncycsXG5cdFx0XHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdFx0XHQndHlwZSc6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0J3Byb3BlcnRpZXMnOiB7XG5cdFx0XHRcdFx0XHRcdCdzbmlwcGV0Jzoge1xuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0J2xhbmdJZCc6IHtcblx0XHRcdFx0XHRcdFx0XHQndHlwZSc6ICdzdHJpbmcnLFxuXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCduYW1lJzoge1xuXHRcdFx0XHRcdFx0XHRcdCd0eXBlJzogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRhc3luYyBydW5FZGl0b3JDb21tYW5kKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yLCBlZGl0b3I6IElDb2RlRWRpdG9yLCBhcmc6IGFueSkge1xuXG5cdFx0Y29uc3QgbGFuZ3VhZ2VTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElMYW5ndWFnZVNlcnZpY2UpO1xuXHRcdGNvbnN0IHNuaXBwZXRTZXJ2aWNlID0gYWNjZXNzb3IuZ2V0KElTbmlwcGV0c1NlcnZpY2UpO1xuXG5cdFx0aWYgKCFlZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNsaXBib2FyZFNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNsaXBib2FyZFNlcnZpY2UpO1xuXHRcdGNvbnN0IGluc3RhU2VydmljZSA9IGFjY2Vzc29yLmdldChJSW5zdGFudGlhdGlvblNlcnZpY2UpO1xuXG5cdFx0Y29uc3Qgc25pcHBldCA9IGF3YWl0IG5ldyBQcm9taXNlPFNuaXBwZXQgfCB1bmRlZmluZWQ+KChyZXNvbHZlLCByZWplY3QpID0+IHtcblxuXHRcdFx0Y29uc3QgeyBsaW5lTnVtYmVyLCBjb2x1bW4gfSA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdFx0Y29uc3QgeyBzbmlwcGV0LCBuYW1lLCBsYW5nSWQgfSA9IEFyZ3MuZnJvbVVzZXIoYXJnKTtcblxuXHRcdFx0aWYgKHNuaXBwZXQpIHtcblx0XHRcdFx0cmV0dXJuIHJlc29sdmUobmV3IFNuaXBwZXQoXG5cdFx0XHRcdFx0ZmFsc2UsXG5cdFx0XHRcdFx0W10sXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0JycsXG5cdFx0XHRcdFx0c25pcHBldCxcblx0XHRcdFx0XHQnJyxcblx0XHRcdFx0XHRTbmlwcGV0U291cmNlLlVzZXIsXG5cdFx0XHRcdFx0YHJhbmRvbS8ke01hdGgucmFuZG9tKCl9YFxuXHRcdFx0XHQpKTtcblx0XHRcdH1cblxuXHRcdFx0bGV0IGxhbmd1YWdlSWQ6IHN0cmluZztcblx0XHRcdGlmIChsYW5nSWQpIHtcblx0XHRcdFx0aWYgKCFsYW5ndWFnZVNlcnZpY2UuaXNSZWdpc3RlcmVkTGFuZ3VhZ2VJZChsYW5nSWQpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHJlc29sdmUodW5kZWZpbmVkKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRsYW5ndWFnZUlkID0gbGFuZ0lkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0ZWRpdG9yLmdldE1vZGVsKCkudG9rZW5pemF0aW9uLnRva2VuaXplSWZDaGVhcChsaW5lTnVtYmVyKTtcblx0XHRcdFx0bGFuZ3VhZ2VJZCA9IGVkaXRvci5nZXRNb2RlbCgpLmdldExhbmd1YWdlSWRBdFBvc2l0aW9uKGxpbmVOdW1iZXIsIGNvbHVtbik7XG5cblx0XHRcdFx0Ly8gdmFsaWRhdGUgdGhlIGBsYW5ndWFnZUlkYCB0byBlbnN1cmUgdGhpcyBpcyBhIHVzZXJcblx0XHRcdFx0Ly8gZmFjaW5nIGxhbmd1YWdlIHdpdGggYSBuYW1lIGFuZCB0aGUgY2hhbmNlIHRvIGhhdmVcblx0XHRcdFx0Ly8gc25pcHBldHMsIGVsc2UgZmFsbCBiYWNrIHRvIHRoZSBvdXRlciBsYW5ndWFnZVxuXHRcdFx0XHRpZiAoIWxhbmd1YWdlU2VydmljZS5nZXRMYW5ndWFnZU5hbWUobGFuZ3VhZ2VJZCkpIHtcblx0XHRcdFx0XHRsYW5ndWFnZUlkID0gZWRpdG9yLmdldE1vZGVsKCkuZ2V0TGFuZ3VhZ2VJZCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChuYW1lKSB7XG5cdFx0XHRcdC8vIHRha2Ugc2VsZWN0ZWQgc25pcHBldFxuXHRcdFx0XHRzbmlwcGV0U2VydmljZS5nZXRTbmlwcGV0cyhsYW5ndWFnZUlkLCB7IGluY2x1ZGVOb1ByZWZpeFNuaXBwZXRzOiB0cnVlIH0pXG5cdFx0XHRcdFx0LnRoZW4oc25pcHBldHMgPT4gc25pcHBldHMuZmluZChzbmlwcGV0ID0+IHNuaXBwZXQubmFtZSA9PT0gbmFtZSkpXG5cdFx0XHRcdFx0LnRoZW4ocmVzb2x2ZSwgcmVqZWN0KTtcblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gbGV0IHVzZXIgcGljayBhIHNuaXBwZXRcblx0XHRcdFx0cmVzb2x2ZShpbnN0YVNlcnZpY2UuaW52b2tlRnVuY3Rpb24ocGlja1NuaXBwZXQsIGxhbmd1YWdlSWQpKTtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdGlmICghc25pcHBldCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRsZXQgY2xpcGJvYXJkVGV4dDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGlmIChzbmlwcGV0Lm5lZWRzQ2xpcGJvYXJkKSB7XG5cdFx0XHRjbGlwYm9hcmRUZXh0ID0gYXdhaXQgY2xpcGJvYXJkU2VydmljZS5yZWFkVGV4dCgpO1xuXHRcdH1cblx0XHRlZGl0b3IuZm9jdXMoKTtcblx0XHRTbmlwcGV0Q29udHJvbGxlcjIuZ2V0KGVkaXRvcik/Lmluc2VydChzbmlwcGV0LmNvZGVTbmlwcGV0LCB7IGNsaXBib2FyZFRleHQgfSk7XG5cdFx0c25pcHBldFNlcnZpY2UudXBkYXRlVXNhZ2VUaW1lc3RhbXAoc25pcHBldCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQU9BLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsMEJBQTBCO0FBQ25DLFlBQVksU0FBUztBQUNyQixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLG1CQUFtQjtBQUM1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
