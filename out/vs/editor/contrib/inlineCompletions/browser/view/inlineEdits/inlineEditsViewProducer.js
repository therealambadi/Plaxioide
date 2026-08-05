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
import { createHotClass } from "../../../../../../base/common/hotReloadHelpers.js";
import { Disposable } from "../../../../../../base/common/lifecycle.js";
import { derived } from "../../../../../../base/common/observable.js";
import { IInstantiationService } from "../../../../../../platform/instantiation/common/instantiation.js";
import { observableCodeEditor } from "../../../../../browser/observableCodeEditor.js";
import { LineRange } from "../../../../../common/core/lineRange.js";
import { Range } from "../../../../../common/core/range.js";
import { SingleTextEdit, TextEdit } from "../../../../../common/core/textEdit.js";
import { TextModelText } from "../../../../../common/model/textModelText.js";
import { InlineEditWithChanges } from "./inlineEditWithChanges.js";
import { GhostTextIndicator, InlineEditHost, InlineEditModel } from "./inlineEditsModel.js";
import { InlineEditsView } from "./inlineEditsView.js";
import { InlineEditTabAction } from "./inlineEditsViewInterface.js";
let InlineEditsViewAndDiffProducer = class extends Disposable {
  constructor(_editor, _edit, _model, _focusIsInMenu, instantiationService) {
    super();
    this._editor = _editor;
    this._edit = _edit;
    this._model = _model;
    this._focusIsInMenu = _focusIsInMenu;
    this._inlineEdit = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      const inlineEdit = this._edit.read(reader);
      if (!inlineEdit) {
        return void 0;
      }
      const textModel = this._editor.getModel();
      if (!textModel) {
        return void 0;
      }
      const editOffset = model.inlineEditState.get()?.inlineCompletion.updatedEdit.read(reader);
      if (!editOffset) {
        return void 0;
      }
      const offsetEdits = model.inPartialAcceptFlow.read(reader) ? [editOffset.edits[0]] : editOffset.edits;
      const edits = offsetEdits.map((e) => {
        const innerEditRange = Range.fromPositions(
          textModel.getPositionAt(e.replaceRange.start),
          textModel.getPositionAt(e.replaceRange.endExclusive)
        );
        return new SingleTextEdit(innerEditRange, e.newText);
      });
      const diffEdits = new TextEdit(edits);
      const text = new TextModelText(textModel);
      return new InlineEditWithChanges(text, diffEdits, model.primaryPosition.get(), inlineEdit.commands, inlineEdit.inlineCompletion);
    });
    this._inlineEditModel = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      const edit = this._inlineEdit.read(reader);
      if (!edit) {
        return void 0;
      }
      const tabAction = derived(this, (reader2) => {
        if (this._editorObs.isFocused.read(reader2)) {
          if (model.tabShouldJumpToInlineEdit.read(reader2)) {
            return InlineEditTabAction.Jump;
          }
          if (model.tabShouldAcceptInlineEdit.read(reader2)) {
            return InlineEditTabAction.Accept;
          }
        }
        return InlineEditTabAction.Inactive;
      });
      return new InlineEditModel(model, edit, tabAction);
    });
    this._inlineEditHost = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      return new InlineEditHost(model);
    });
    this._ghostTextIndicator = derived(this, (reader) => {
      const model = this._model.read(reader);
      if (!model) {
        return void 0;
      }
      const state = model.inlineCompletionState.read(reader);
      if (!state) {
        return void 0;
      }
      const inlineCompletion = state.inlineCompletion;
      if (!inlineCompletion) {
        return void 0;
      }
      if (!inlineCompletion.sourceInlineCompletion.showInlineEditMenu) {
        return void 0;
      }
      const lineRange = LineRange.ofLength(state.primaryGhostText.lineNumber, 1);
      return new GhostTextIndicator(this._editor, model, lineRange, inlineCompletion);
    });
    this._editorObs = observableCodeEditor(this._editor);
    this._register(instantiationService.createInstance(InlineEditsView, this._editor, this._inlineEditHost, this._inlineEditModel, this._ghostTextIndicator, this._focusIsInMenu));
  }
};
// TODO: This class is no longer a diff producer. Rename it or get rid of it
InlineEditsViewAndDiffProducer.hot = createHotClass(InlineEditsViewAndDiffProducer);
InlineEditsViewAndDiffProducer = __decorateClass([
  __decorateParam(4, IInstantiationService)
], InlineEditsViewAndDiffProducer);
export {
  InlineEditsViewAndDiffProducer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9pbmxpbmVDb21wbGV0aW9ucy9icm93c2VyL3ZpZXcvaW5saW5lRWRpdHMvaW5saW5lRWRpdHNWaWV3UHJvZHVjZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVIb3RDbGFzcyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2hvdFJlbG9hZEhlbHBlcnMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBkZXJpdmVkLCBJT2JzZXJ2YWJsZSwgSVNldHRhYmxlT2JzZXJ2YWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBPYnNlcnZhYmxlQ29kZUVkaXRvciwgb2JzZXJ2YWJsZUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9icm93c2VyL29ic2VydmFibGVDb2RlRWRpdG9yLmpzJztcbmltcG9ydCB7IExpbmVSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL2xpbmVSYW5nZS5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IFNpbmdsZVRleHRFZGl0LCBUZXh0RWRpdCB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2NvbW1vbi9jb3JlL3RleHRFZGl0LmpzJztcbmltcG9ydCB7IFRleHRNb2RlbFRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9jb21tb24vbW9kZWwvdGV4dE1vZGVsVGV4dC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVDb21wbGV0aW9uc01vZGVsIH0gZnJvbSAnLi4vLi4vbW9kZWwvaW5saW5lQ29tcGxldGlvbnNNb2RlbC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVFZGl0IH0gZnJvbSAnLi4vLi4vbW9kZWwvaW5saW5lRWRpdC5qcyc7XG5pbXBvcnQgeyBJbmxpbmVFZGl0V2l0aENoYW5nZXMgfSBmcm9tICcuL2lubGluZUVkaXRXaXRoQ2hhbmdlcy5qcyc7XG5pbXBvcnQgeyBHaG9zdFRleHRJbmRpY2F0b3IsIElubGluZUVkaXRIb3N0LCBJbmxpbmVFZGl0TW9kZWwgfSBmcm9tICcuL2lubGluZUVkaXRzTW9kZWwuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdHNWaWV3IH0gZnJvbSAnLi9pbmxpbmVFZGl0c1ZpZXcuanMnO1xuaW1wb3J0IHsgSW5saW5lRWRpdFRhYkFjdGlvbiB9IGZyb20gJy4vaW5saW5lRWRpdHNWaWV3SW50ZXJmYWNlLmpzJztcblxuZXhwb3J0IGNsYXNzIElubGluZUVkaXRzVmlld0FuZERpZmZQcm9kdWNlciBleHRlbmRzIERpc3Bvc2FibGUgeyAvLyBUT0RPOiBUaGlzIGNsYXNzIGlzIG5vIGxvbmdlciBhIGRpZmYgcHJvZHVjZXIuIFJlbmFtZSBpdCBvciBnZXQgcmlkIG9mIGl0XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgaG90ID0gY3JlYXRlSG90Q2xhc3MoSW5saW5lRWRpdHNWaWV3QW5kRGlmZlByb2R1Y2VyKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JPYnM6IE9ic2VydmFibGVDb2RlRWRpdG9yO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2lubGluZUVkaXQgPSBkZXJpdmVkPElubGluZUVkaXRXaXRoQ2hhbmdlcyB8IHVuZGVmaW5lZD4odGhpcywgKHJlYWRlcikgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICghbW9kZWwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdGNvbnN0IGlubGluZUVkaXQgPSB0aGlzLl9lZGl0LnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIWlubGluZUVkaXQpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdGNvbnN0IHRleHRNb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghdGV4dE1vZGVsKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRcdGNvbnN0IGVkaXRPZmZzZXQgPSBtb2RlbC5pbmxpbmVFZGl0U3RhdGUuZ2V0KCk/LmlubGluZUNvbXBsZXRpb24udXBkYXRlZEVkaXQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghZWRpdE9mZnNldCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRjb25zdCBvZmZzZXRFZGl0cyA9IG1vZGVsLmluUGFydGlhbEFjY2VwdEZsb3cucmVhZChyZWFkZXIpID8gW2VkaXRPZmZzZXQuZWRpdHNbMF1dIDogZWRpdE9mZnNldC5lZGl0cztcblx0XHRjb25zdCBlZGl0cyA9IG9mZnNldEVkaXRzLm1hcChlID0+IHtcblx0XHRcdGNvbnN0IGlubmVyRWRpdFJhbmdlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhcblx0XHRcdFx0dGV4dE1vZGVsLmdldFBvc2l0aW9uQXQoZS5yZXBsYWNlUmFuZ2Uuc3RhcnQpLFxuXHRcdFx0XHR0ZXh0TW9kZWwuZ2V0UG9zaXRpb25BdChlLnJlcGxhY2VSYW5nZS5lbmRFeGNsdXNpdmUpXG5cdFx0XHQpO1xuXHRcdFx0cmV0dXJuIG5ldyBTaW5nbGVUZXh0RWRpdChpbm5lckVkaXRSYW5nZSwgZS5uZXdUZXh0KTtcblx0XHR9KTtcblxuXHRcdGNvbnN0IGRpZmZFZGl0cyA9IG5ldyBUZXh0RWRpdChlZGl0cyk7XG5cdFx0Y29uc3QgdGV4dCA9IG5ldyBUZXh0TW9kZWxUZXh0KHRleHRNb2RlbCk7XG5cblx0XHRyZXR1cm4gbmV3IElubGluZUVkaXRXaXRoQ2hhbmdlcyh0ZXh0LCBkaWZmRWRpdHMsIG1vZGVsLnByaW1hcnlQb3NpdGlvbi5nZXQoKSwgaW5saW5lRWRpdC5jb21tYW5kcywgaW5saW5lRWRpdC5pbmxpbmVDb21wbGV0aW9uKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lRWRpdE1vZGVsID0gZGVyaXZlZDxJbmxpbmVFZGl0TW9kZWwgfCB1bmRlZmluZWQ+KHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9tb2RlbC5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFtb2RlbCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0Y29uc3QgZWRpdCA9IHRoaXMuX2lubGluZUVkaXQucmVhZChyZWFkZXIpO1xuXHRcdGlmICghZWRpdCkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cblx0XHRjb25zdCB0YWJBY3Rpb24gPSBkZXJpdmVkPElubGluZUVkaXRUYWJBY3Rpb24+KHRoaXMsIHJlYWRlciA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZWRpdG9yT2JzLmlzRm9jdXNlZC5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0aWYgKG1vZGVsLnRhYlNob3VsZEp1bXBUb0lubGluZUVkaXQucmVhZChyZWFkZXIpKSB7IHJldHVybiBJbmxpbmVFZGl0VGFiQWN0aW9uLkp1bXA7IH1cblx0XHRcdFx0aWYgKG1vZGVsLnRhYlNob3VsZEFjY2VwdElubGluZUVkaXQucmVhZChyZWFkZXIpKSB7IHJldHVybiBJbmxpbmVFZGl0VGFiQWN0aW9uLkFjY2VwdDsgfVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIElubGluZUVkaXRUYWJBY3Rpb24uSW5hY3RpdmU7XG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gbmV3IElubGluZUVkaXRNb2RlbChtb2RlbCwgZWRpdCwgdGFiQWN0aW9uKTtcblx0fSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5saW5lRWRpdEhvc3QgPSBkZXJpdmVkPElubGluZUVkaXRIb3N0IHwgdW5kZWZpbmVkPih0aGlzLCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fbW9kZWwucmVhZChyZWFkZXIpO1xuXHRcdGlmICghbW9kZWwpIHsgcmV0dXJuIHVuZGVmaW5lZDsgfVxuXHRcdHJldHVybiBuZXcgSW5saW5lRWRpdEhvc3QobW9kZWwpO1xuXHR9KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9naG9zdFRleHRJbmRpY2F0b3IgPSBkZXJpdmVkPEdob3N0VGV4dEluZGljYXRvciB8IHVuZGVmaW5lZD4odGhpcywgcmVhZGVyID0+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX21vZGVsLnJlYWQocmVhZGVyKTtcblx0XHRpZiAoIW1vZGVsKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblx0XHRjb25zdCBzdGF0ZSA9IG1vZGVsLmlubGluZUNvbXBsZXRpb25TdGF0ZS5yZWFkKHJlYWRlcik7XG5cdFx0aWYgKCFzdGF0ZSkgeyByZXR1cm4gdW5kZWZpbmVkOyB9XG5cdFx0Y29uc3QgaW5saW5lQ29tcGxldGlvbiA9IHN0YXRlLmlubGluZUNvbXBsZXRpb247XG5cdFx0aWYgKCFpbmxpbmVDb21wbGV0aW9uKSB7IHJldHVybiB1bmRlZmluZWQ7IH1cblxuXHRcdGlmICghaW5saW5lQ29tcGxldGlvbi5zb3VyY2VJbmxpbmVDb21wbGV0aW9uLnNob3dJbmxpbmVFZGl0TWVudSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBsaW5lUmFuZ2UgPSBMaW5lUmFuZ2Uub2ZMZW5ndGgoc3RhdGUucHJpbWFyeUdob3N0VGV4dC5saW5lTnVtYmVyLCAxKTtcblxuXHRcdHJldHVybiBuZXcgR2hvc3RUZXh0SW5kaWNhdG9yKHRoaXMuX2VkaXRvciwgbW9kZWwsIGxpbmVSYW5nZSwgaW5saW5lQ29tcGxldGlvbik7XG5cdH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRvcjogSUNvZGVFZGl0b3IsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdDogSU9ic2VydmFibGU8SW5saW5lRWRpdCB8IHVuZGVmaW5lZD4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElPYnNlcnZhYmxlPElubGluZUNvbXBsZXRpb25zTW9kZWwgfCB1bmRlZmluZWQ+LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2ZvY3VzSXNJbk1lbnU6IElTZXR0YWJsZU9ic2VydmFibGU8Ym9vbGVhbj4sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fZWRpdG9yT2JzID0gb2JzZXJ2YWJsZUNvZGVFZGl0b3IodGhpcy5fZWRpdG9yKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKGluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKElubGluZUVkaXRzVmlldywgdGhpcy5fZWRpdG9yLCB0aGlzLl9pbmxpbmVFZGl0SG9zdCwgdGhpcy5faW5saW5lRWRpdE1vZGVsLCB0aGlzLl9naG9zdFRleHRJbmRpY2F0b3IsIHRoaXMuX2ZvY3VzSXNJbk1lbnUpKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGVBQWlEO0FBQzFELFNBQVMsNkJBQTZCO0FBRXRDLFNBQStCLDRCQUE0QjtBQUMzRCxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLGFBQWE7QUFDdEIsU0FBUyxnQkFBZ0IsZ0JBQWdCO0FBQ3pDLFNBQVMscUJBQXFCO0FBRzlCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsb0JBQW9CLGdCQUFnQix1QkFBdUI7QUFDcEUsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUywyQkFBMkI7QUFFN0IsSUFBTSxpQ0FBTixjQUE2QyxXQUFXO0FBQUEsRUF1RTlELFlBQ2tCLFNBQ0EsT0FDQSxRQUNBLGdCQUNNLHNCQUN0QjtBQUNELFVBQU07QUFOVztBQUNBO0FBQ0E7QUFDQTtBQXRFbEIsU0FBaUIsY0FBYyxRQUEyQyxNQUFNLENBQUMsV0FBVztBQUMzRixZQUFNLFFBQVEsS0FBSyxPQUFPLEtBQUssTUFBTTtBQUNyQyxVQUFJLENBQUMsT0FBTztBQUFFLGVBQU87QUFBQSxNQUFXO0FBQ2hDLFlBQU0sYUFBYSxLQUFLLE1BQU0sS0FBSyxNQUFNO0FBQ3pDLFVBQUksQ0FBQyxZQUFZO0FBQUUsZUFBTztBQUFBLE1BQVc7QUFDckMsWUFBTSxZQUFZLEtBQUssUUFBUSxTQUFTO0FBQ3hDLFVBQUksQ0FBQyxXQUFXO0FBQUUsZUFBTztBQUFBLE1BQVc7QUFFcEMsWUFBTSxhQUFhLE1BQU0sZ0JBQWdCLElBQUksR0FBRyxpQkFBaUIsWUFBWSxLQUFLLE1BQU07QUFDeEYsVUFBSSxDQUFDLFlBQVk7QUFBRSxlQUFPO0FBQUEsTUFBVztBQUVyQyxZQUFNLGNBQWMsTUFBTSxvQkFBb0IsS0FBSyxNQUFNLElBQUksQ0FBQyxXQUFXLE1BQU0sQ0FBQyxDQUFDLElB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
