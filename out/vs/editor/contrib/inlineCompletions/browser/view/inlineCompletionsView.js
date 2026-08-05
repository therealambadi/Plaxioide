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
import { createStyleSheetFromObservable } from "../../../../../base/browser/dom.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { derived, mapObservableArrayCached, derivedDisposable, constObservable, derivedObservableWithCache } from "../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../platform/instantiation/common/instantiation.js";
import { observableCodeEditor } from "../../../../browser/observableCodeEditor.js";
import { EditorOption } from "../../../../common/config/editorOptions.js";
import { InlineCompletionsHintsWidget } from "../hintsWidget/inlineCompletionsHintsWidget.js";
import { convertItemsToStableObservables } from "../utils.js";
import { GhostTextView } from "./ghostText/ghostTextView.js";
import { InlineEditsViewAndDiffProducer } from "./inlineEdits/inlineEditsViewProducer.js";
let InlineCompletionsView = class extends Disposable {
  constructor(_editor, _model, _focusIsInMenu, _instantiationService) {
    super();
    this._editor = _editor;
    this._model = _model;
    this._focusIsInMenu = _focusIsInMenu;
    this._instantiationService = _instantiationService;
    this._ghostTexts = derived(this, (reader) => {
      const model = this._model.read(reader);
      return model?.ghostTexts.read(reader) ?? [];
    });
    this._stablizedGhostTexts = convertItemsToStableObservables(this._ghostTexts, this._store);
    this._editorObs = observableCodeEditor(this._editor);
    this._ghostTextWidgets = mapObservableArrayCached(
      this,
      this._stablizedGhostTexts,
      (ghostText, store) => derivedDisposable(
        (reader) => this._instantiationService.createInstance(
          GhostTextView.hot.read(reader),
          this._editor,
          {
            ghostText,
            warning: this._model.map((m, reader2) => {
              const warning = m?.warning?.read(reader2);
              return warning ? { icon: warning.icon } : void 0;
            }),
            minReservedLineCount: constObservable(0),
            targetTextModel: this._model.map((v) => v?.textModel)
          },
          this._editorObs.getOption(EditorOption.inlineSuggest).map((v) => ({ syntaxHighlightingEnabled: v.syntaxHighlightingEnabled })),
          false,
          false
        )
      ).recomputeInitiallyAndOnChange(store)
    ).recomputeInitiallyAndOnChange(this._store);
    this._inlineEdit = derived(this, (reader) => this._model.read(reader)?.inlineEditState.read(reader)?.inlineEdit);
    this._everHadInlineEdit = derivedObservableWithCache(this, (reader, last) => last || !!this._inlineEdit.read(reader) || !!this._model.read(reader)?.inlineCompletionState.read(reader)?.inlineCompletion?.sourceInlineCompletion.showInlineEditMenu);
    this._inlineEditWidget = derivedDisposable((reader) => {
      if (!this._everHadInlineEdit.read(reader)) {
        return void 0;
      }
      return this._instantiationService.createInstance(InlineEditsViewAndDiffProducer.hot.read(reader), this._editor, this._inlineEdit, this._model, this._focusIsInMenu);
    }).recomputeInitiallyAndOnChange(this._store);
    this._fontFamily = this._editorObs.getOption(EditorOption.inlineSuggest).map((val) => val.fontFamily);
    this._register(createStyleSheetFromObservable(derived((reader) => {
      const fontFamily = this._fontFamily.read(reader);
      if (fontFamily === "" || fontFamily === "default") {
        return "";
      }
      return `
.monaco-editor .ghost-text-decoration,
.monaco-editor .ghost-text-decoration-preview,
.monaco-editor .ghost-text {
	font-family: ${fontFamily};
}`;
    })));
    this._register(new InlineCompletionsHintsWidget(this._editor, this._model, this._instantiationService));
  }
  shouldShowHoverAtViewZone(viewZoneId) {
    return this._ghostTextWidgets.get()[0]?.get().ownsViewZone(viewZoneId) ?? false;
  }
};
InlineCompletionsView = __decorateClass([
  __decorateParam(3, IInstantiationService)
], InlineCompletionsView);
export {
  InlineCompletionsView
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lQ29tcGxldGlvbnNWaWV3LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY3JlYXRlU3R5bGVTaGVldEZyb21PYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGRlcml2ZWQsIG1hcE9ic2VydmFibGVBcnJheUNhY2hlZCwgZGVyaXZlZERpc3Bvc2FibGUsIGNvbnN0T2JzZXJ2YWJsZSwgZGVyaXZlZE9ic2VydmFibGVXaXRoQ2FjaGUsIElPYnNlcnZhYmxlLCBJU2V0dGFibGVPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IG9ic2VydmFibGVDb2RlRWRpdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYnJvd3Nlci9vYnNlcnZhYmxlQ29kZUVkaXRvci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNIaW50c1dpZGdldCB9IGZyb20gJy4uL2hpbnRzV2lkZ2V0L2lubGluZUNvbXBsZXRpb25zSGludHNXaWRnZXQuanMnO1xuaW1wb3J0IHsgSW5saW5lQ29tcGxldGlvbnNNb2RlbCB9IGZyb20gJy4uL21vZGVsL2lubGluZUNvbXBsZXRpb25zTW9kZWwuanMnO1xuaW1wb3J0IHsgY29udmVydEl0ZW1zVG9TdGFibGVPYnNlcnZhYmxlcyB9IGZyb20gJy4uL3V0aWxzLmpzJztcbmltcG9ydCB7IEdob3N0VGV4dFZpZXcgfSBmcm9tICcuL2dob3N0VGV4dC9naG9zdFRleHRWaWV3LmpzJztcbmltcG9ydCB7IElubGluZUVkaXRzVmlld0FuZERpZmZQcm9kdWNlciB9IGZyb20gJy4vaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3UHJvZHVjZXIuanMnO1xuXG5leHBvcnQgY2xhc3MgSW5saW5lQ29tcGxldGlvbnNWaWV3IGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2dob3N0VGV4dHMgPSBkZXJpdmVkKHRoaXMsIChyZWFkZXIpID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRyZXR1cm4gbW9kZWw/Lmdob3N0VGV4dHMucmVhZChyZWFkZXIpID8/IFtdO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zdGFibGl6ZWRHaG9zdFRleHRzID0gY29udmVydEl0ZW1zVG9TdGFibGVPYnNlcnZhYmxlcyh0aGlzLl9naG9zdFRleHRzLCB0aGlzLl9zdG9yZSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvck9icyA9IG9ic2VydmFibGVDb2RlRWRpdG9yKHRoaXMuX2VkaXRvcik7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfZ2hvc3RUZXh0V2lkZ2V0cyA9IG1hcE9ic2VydmFibGVBcnJheUNhY2hlZCh0aGlzLCB0aGlzLl9zdGFibGl6ZWRHaG9zdFRleHRzLCAoZ2hvc3RUZXh0LCBzdG9yZSkgPT4gZGVyaXZlZERpc3Bvc2FibGUoKHJlYWRlcikgPT4gdGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0R2hvc3RUZXh0Vmlldy5ob3QucmVhZChyZWFkZXIpLFxuXHRcdHRoaXMuX2VkaXRvcixcblx0XHR7XG5cdFx0XHRnaG9zdFRleHQ6IGdob3N0VGV4dCxcblx0XHRcdHdhcm5pbmc6IHRoaXMuX21vZGVsLm1hcCgobSwgcmVhZGVyKSA9PiB7XG5cdFx0XHRcdGNvbnN0IHdhcm5pbmcgPSBtPy53YXJuaW5nPy5yZWFkKHJlYWRlcik7XG5cdFx0XHRcdHJldHVybiB3YXJuaW5nID8geyBpY29uOiB3YXJuaW5nLmljb24gfSA6IHVuZGVmaW5lZDtcblx0XHRcdH0pLFxuXHRcdFx0bWluUmVzZXJ2ZWRMaW5lQ291bnQ6IGNvbnN0T2JzZXJ2YWJsZSgwKSxcblx0XHRcdHRhcmdldFRleHRNb2RlbDogdGhpcy5fbW9kZWwubWFwKHYgPT4gdj8udGV4dE1vZGVsKSxcblx0XHR9LFxuXHRcdHRoaXMuX2VkaXRvck9icy5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLmlubGluZVN1Z2dlc3QpLm1hcCh2ID0+ICh7IHN5bnRheEhpZ2hsaWdodGluZ0VuYWJsZWQ6IHYuc3ludGF4SGlnaGxpZ2h0aW5nRW5hYmxlZCB9KSksXG5cdFx0ZmFsc2UsXG5cdFx0ZmFsc2Vcblx0KVxuXHQpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHN0b3JlKVxuXHQpLnJlY29tcHV0ZUluaXRpYWxseUFuZE9uQ2hhbmdlKHRoaXMuX3N0b3JlKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbmxpbmVFZGl0ID0gZGVyaXZlZCh0aGlzLCByZWFkZXIgPT4gdGhpcy5fbW9kZWwucmVhZChyZWFkZXIpPy5pbmxpbmVFZGl0U3RhdGUucmVhZChyZWFkZXIpPy5pbmxpbmVFZGl0KTtcblx0cHJpdmF0ZSByZWFkb25seSBfZXZlckhhZElubGluZUVkaXQgPSBkZXJpdmVkT2JzZXJ2YWJsZVdpdGhDYWNoZTxib29sZWFuPih0aGlzLCAocmVhZGVyLCBsYXN0KSA9PiBsYXN0IHx8ICEhdGhpcy5faW5saW5lRWRpdC5yZWFkKHJlYWRlcikgfHwgISF0aGlzLl9tb2RlbC5yZWFkKHJlYWRlcik/LmlubGluZUNvbXBsZXRpb25TdGF0ZS5yZWFkKHJlYWRlcik/LmlubGluZUNvbXBsZXRpb24/LnNvdXJjZUlubGluZUNvbXBsZXRpb24uc2hvd0lubGluZUVkaXRNZW51KTtcblx0cHJvdGVjdGVkIHJlYWRvbmx5IF9pbmxpbmVFZGl0V2lkZ2V0ID0gZGVyaXZlZERpc3Bvc2FibGUocmVhZGVyID0+IHtcblx0XHRpZiAoIXRoaXMuX2V2ZXJIYWRJbmxpbmVFZGl0LnJlYWQocmVhZGVyKSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubGluZUVkaXRzVmlld0FuZERpZmZQcm9kdWNlci5ob3QucmVhZChyZWFkZXIpLCB0aGlzLl9lZGl0b3IsIHRoaXMuX2lubGluZUVkaXQsIHRoaXMuX21vZGVsLCB0aGlzLl9mb2N1c0lzSW5NZW51KTtcblx0fSlcblx0XHQucmVjb21wdXRlSW5pdGlhbGx5QW5kT25DaGFuZ2UodGhpcy5fc3RvcmUpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ZvbnRGYW1pbHkgPSB0aGlzLl9lZGl0b3JPYnMuZ2V0T3B0aW9uKEVkaXRvck9wdGlvbi5pbmxpbmVTdWdnZXN0KS5tYXAodmFsID0+IHZhbC5mb250RmFtaWx5KTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX21vZGVsOiBJT2JzZXJ2YWJsZTxJbmxpbmVDb21wbGV0aW9uc01vZGVsIHwgdW5kZWZpbmVkPixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9mb2N1c0lzSW5NZW51OiBJU2V0dGFibGVPYnNlcnZhYmxlPGJvb2xlYW4+LFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGNyZWF0ZVN0eWxlU2hlZXRGcm9tT2JzZXJ2YWJsZShkZXJpdmVkKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBmb250RmFtaWx5ID0gdGhpcy5fZm9udEZhbWlseS5yZWFkKHJlYWRlcik7XG5cdFx0XHRpZiAoZm9udEZhbWlseSA9PT0gJycgfHwgZm9udEZhbWlseSA9PT0gJ2RlZmF1bHQnKSB7IHJldHVybiAnJzsgfVxuXHRcdFx0cmV0dXJuIGBcbi5tb25hY28tZWRpdG9yIC5naG9zdC10ZXh0LWRlY29yYXRpb24sXG4ubW9uYWNvLWVkaXRvciAuZ2hvc3QtdGV4dC1kZWNvcmF0aW9uLXByZXZpZXcsXG4ubW9uYWNvLWVkaXRvciAuZ2hvc3QtdGV4dCB7XG5cdGZvbnQtZmFtaWx5OiAke2ZvbnRGYW1pbHl9O1xufWA7XG5cdFx0fSkpKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKG5ldyBJbmxpbmVDb21wbGV0aW9uc0hpbnRzV2lkZ2V0KHRoaXMuX2VkaXRvciwgdGhpcy5fbW9kZWwsIHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlKSk7XG5cdH1cblxuXHRwdWJsaWMgc2hvdWxkU2hvd0hvdmVyQXRWaWV3Wm9uZSh2aWV3Wm9uZUlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fZ2hvc3RUZXh0V2lkZ2V0cy5nZXQoKVswXT8uZ2V0KCkub3duc1ZpZXdab25lKHZpZXdab25lSWQpID8/IGZhbHNlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsc0NBQXNDO0FBQy9DLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsU0FBUywwQkFBMEIsbUJBQW1CLGlCQUFpQixrQ0FBb0U7QUFDcEosU0FBUyw2QkFBNkI7QUFFdEMsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxvQkFBb0I7QUFDN0IsU0FBUyxvQ0FBb0M7QUFFN0MsU0FBUyx1Q0FBdUM7QUFDaEQsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxzQ0FBc0M7QUFFeEMsSUFBTSx3QkFBTixjQUFvQyxXQUFXO0FBQUEsRUF3Q3JELFlBQ2tCLFNBQ0EsUUFDQSxnQkFDdUIsdUJBQ3ZDO0FBQ0QsVUFBTTtBQUxXO0FBQ0E7QUFDQTtBQUN1QjtBQTNDekMsU0FBaUIsY0FBYyxRQUFRLE1BQU0sQ0FBQyxXQUFXO0FBQ3hELFlBQU0sUUFBUSxLQUFLLE9BQU8sS0FBSyxNQUFNO0FBQ3JDLGFBQU8sT0FBTyxXQUFXLEtBQUssTUFBTSxLQUFLLENBQUM7QUFBQSxJQUMzQyxDQUFDO0FBRUQsU0FBaUIsdUJBQXVCLGdDQUFnQyxLQUFLLGFBQWEsS0FBSyxNQUFNO0FBQ3JHLFNBQWlCLGFBQWEscUJBQXFCLEtBQUssT0FBTztBQUUvRCxTQUFpQixvQkFBb0I7QUFBQSxNQUF5QjtBQUFBLE1BQU0sS0FBSztBQUFBLE1BQXNCLENBQUMsV0FBVyxVQUFVO0FBQUEsUUFBa0IsQ0FBQyxXQUFXLEtBQUssc0JBQXNCO0FBQUEsVUFDN0ssY0FBYyxJQUFJLEtBQUssTUFBTTtBQUFBLFVBQzdCLEtBQUs7QUFBQSxVQUNMO0FBQUEsWUFDQztBQUFBLFlBQ0EsU0FBUyxLQUFLLE9BQU8sSUFBSSxDQUFDLEdBQUdBLFlBQVc7QUFDdkMsb0JBQU0sVUFBVSxHQUFHLFNBQVMsS0FBS0EsT0FBTTtBQUN2QyxxQkFBTyxVQUFVLEVBQUUsTUFBTSxRQUFRLEtBQUssSUFBSTtBQUFBLFlBQzNDLENBQUM7QUFBQSxZQUNELHNCQUFzQixnQkFBZ0IsQ0FBQztBQUFBLFlBQ3ZDLGlCQUFpQixLQUFLLE9BQU8sSUFBSSxPQUFLLEdBQUcsU0FBUztBQUFBLFVBQ25EO0FBQUEsVUFDQSxLQUFLLFdBQVcsVUFBVSxhQUFhLGFBQWEsRUFBRSxJQUFJLFFBQU0sRUFBRSwyQkFBMkIsRUFBRSwwQkFBMEIsRUFBRTtBQUFBLFVBQzNIO0FBQUEsVUFDQTtBQUFBLFFBQ0Q7QUFBQSxNQUNBLEVBQUUsOEJBQThCLEtBQUs7QUFBQSxJQUNyQyxFQUFFLDhCQUE4QixLQUFLLE1BQU07QUFFM0MsU0FBaUIsY0FBYyxRQUFRLE1BQU0sWUFBVSxLQUFLLE9BQU8sS0FBSyxNQUFNLEdBQUcsZ0JBQWdCLEtBQUssTUFBTSxHQUFHLFVBQVU7QUFDekgsU0FBaUIscUJBQXFCLDJCQUFvQyxNQUFNLENBQUMsUUFBUSxTQUFTLFFBQVEsQ0FBQyxDQUFDLEtBQUssWUFBWSxLQUFLLE1BQU0sS0FBSyxDQUFDLENBQUMsS0FBSyxPQUFPLEtBQUssTUFBTSxHQUFHLHNCQUFzQixLQUFLLE1BQU0sR0FBRyxrQkFBa0IsdUJBQXVCLGtCQUFrQjtBQUN4USxTQUFtQixvQkFBb0Isa0JBQWtCLFlBQVU7QUFDbEUsVUFBSSxDQUFDLEtBQUssbUJBQW1CLEtBQUssTUFBTSxHQUFHO0FBQzFDLGVBQU87QUFBQSxNQUNSO0FBQ0EsYUFBTyxLQUFLLHNCQUFzQixlQUFlLCtCQUErQixJQUFJLEtBQUssTUFBTSxHQUFHLEtBQUssU0FBUyxLQUFLLGFBQWEsS0FBSyxRQUFRLEtBQUssY0FBYztBQUFBLElBQ25LLENBQUMsRUFDQyw4QkFBOEIsS0FBSyxNQUFNO0FBRTNDLFNBQWlCLGNBQWMsS0FBSyxXQUFXLFVBQVUsYUFBYSxhQUFhLEVBQUUsSUFBSSxTQUFPLElBQUksVUFBVTtBQVU3RyxTQUFLLFVBQVUsK0JBQStCLFFBQVEsWUFBVTtBQUMvRCxZQUFNLGFBQWEsS0FBSyxZQUFZLEtBQUssTUFBTTtBQUMvQyxVQUFJLGVBQWUsTUFBTSxlQUFlLFdBQVc7QUFBRSxlQUFPO0FBQUEsTUFBSTtBQUNoRSxhQUFPO0FBQUE7QUFBQTtBQUFBO0FBQUEsZ0JBSU0sVUFBVTtBQUFBO0FBQUEsSUFFeEIsQ0FBQyxDQUFDLENBQUM7QUFFSCxTQUFLLFVBQVUsSUFBSSw2QkFBNkIsS0FBSyxTQUFTLEtBQUssUUFBUSxLQUFLLHFCQUFxQixDQUFDO0FBQUEsRUFDdkc7QUFBQSxFQUVPLDBCQUEwQixZQUE2QjtBQUM3RCxXQUFPLEtBQUssa0JBQWtCLElBQUksRUFBRSxDQUFDLEdBQUcsSUFBSSxFQUFFLGFBQWEsVUFBVSxLQUFLO0FBQUEsRUFDM0U7QUFDRDtBQWpFYSx3QkFBTjtBQUFBLEVBNENKO0FBQUEsR0E1Q1U7IiwKICAibmFtZXMiOiBbInJlYWRlciJdCn0K
