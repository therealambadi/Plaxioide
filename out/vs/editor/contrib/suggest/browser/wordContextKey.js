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
import { EditorOption } from "../../../common/config/editorOptions.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { localize } from "../../../../nls.js";
let WordContextKey = class {
  constructor(_editor, contextKeyService) {
    this._editor = _editor;
    this._enabled = false;
    this._ckAtEnd = WordContextKey.AtEnd.bindTo(contextKeyService);
    this._configListener = this._editor.onDidChangeConfiguration((e) => e.hasChanged(EditorOption.tabCompletion) && this._update());
    this._update();
  }
  dispose() {
    this._configListener.dispose();
    this._selectionListener?.dispose();
    this._ckAtEnd.reset();
  }
  _update() {
    const enabled = this._editor.getOption(EditorOption.tabCompletion) === "on";
    if (this._enabled === enabled) {
      return;
    }
    this._enabled = enabled;
    if (this._enabled) {
      const checkForWordEnd = () => {
        if (!this._editor.hasModel()) {
          this._ckAtEnd.set(false);
          return;
        }
        const model = this._editor.getModel();
        const selection = this._editor.getSelection();
        const word = model.getWordAtPosition(selection.getStartPosition());
        if (!word) {
          this._ckAtEnd.set(false);
          return;
        }
        this._ckAtEnd.set(word.endColumn === selection.getStartPosition().column && selection.getStartPosition().lineNumber === selection.getEndPosition().lineNumber);
      };
      this._selectionListener = this._editor.onDidChangeCursorSelection(checkForWordEnd);
      checkForWordEnd();
    } else if (this._selectionListener) {
      this._ckAtEnd.reset();
      this._selectionListener.dispose();
      this._selectionListener = void 0;
    }
  }
};
WordContextKey.AtEnd = new RawContextKey("atEndOfWord", false, { type: "boolean", description: localize("desc", "A context key that is true when at the end of a word. Note that this is only defined when tab-completions are enabled") });
WordContextKey = __decorateClass([
  __decorateParam(1, IContextKeyService)
], WordContextKey);
export {
  WordContextKey
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9zdWdnZXN0L2Jyb3dzZXIvd29yZENvbnRleHRLZXkudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBFZGl0b3JPcHRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbnRleHRLZXksIElDb250ZXh0S2V5U2VydmljZSwgUmF3Q29udGV4dEtleSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuXG5leHBvcnQgY2xhc3MgV29yZENvbnRleHRLZXkge1xuXG5cdHN0YXRpYyByZWFkb25seSBBdEVuZCA9IG5ldyBSYXdDb250ZXh0S2V5PGJvb2xlYW4+KCdhdEVuZE9mV29yZCcsIGZhbHNlLCB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCdkZXNjJywgXCJBIGNvbnRleHQga2V5IHRoYXQgaXMgdHJ1ZSB3aGVuIGF0IHRoZSBlbmQgb2YgYSB3b3JkLiBOb3RlIHRoYXQgdGhpcyBpcyBvbmx5IGRlZmluZWQgd2hlbiB0YWItY29tcGxldGlvbnMgYXJlIGVuYWJsZWRcIikgfSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2tBdEVuZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ0xpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblxuXHRwcml2YXRlIF9lbmFibGVkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX3NlbGVjdGlvbkxpc3RlbmVyPzogSURpc3Bvc2FibGU7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZWRpdG9yOiBJQ29kZUVkaXRvcixcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXG5cdFx0dGhpcy5fY2tBdEVuZCA9IFdvcmRDb250ZXh0S2V5LkF0RW5kLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fY29uZmlnTGlzdGVuZXIgPSB0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4gZS5oYXNDaGFuZ2VkKEVkaXRvck9wdGlvbi50YWJDb21wbGV0aW9uKSAmJiB0aGlzLl91cGRhdGUoKSk7XG5cdFx0dGhpcy5fdXBkYXRlKCk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX2NvbmZpZ0xpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR0aGlzLl9zZWxlY3Rpb25MaXN0ZW5lcj8uZGlzcG9zZSgpO1xuXHRcdHRoaXMuX2NrQXRFbmQucmVzZXQoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHQvLyBvbmx5IHVwZGF0ZSB0aGlzIHdoZW4gdGFiIGNvbXBsZXRpb25zIGFyZSBlbmFibGVkXG5cdFx0Y29uc3QgZW5hYmxlZCA9IHRoaXMuX2VkaXRvci5nZXRPcHRpb24oRWRpdG9yT3B0aW9uLnRhYkNvbXBsZXRpb24pID09PSAnb24nO1xuXHRcdGlmICh0aGlzLl9lbmFibGVkID09PSBlbmFibGVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX2VuYWJsZWQgPSBlbmFibGVkO1xuXG5cdFx0aWYgKHRoaXMuX2VuYWJsZWQpIHtcblx0XHRcdGNvbnN0IGNoZWNrRm9yV29yZEVuZCA9ICgpID0+IHtcblx0XHRcdFx0aWYgKCF0aGlzLl9lZGl0b3IuaGFzTW9kZWwoKSkge1xuXHRcdFx0XHRcdHRoaXMuX2NrQXRFbmQuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9lZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdFx0Y29uc3Qgc2VsZWN0aW9uID0gdGhpcy5fZWRpdG9yLmdldFNlbGVjdGlvbigpO1xuXHRcdFx0XHRjb25zdCB3b3JkID0gbW9kZWwuZ2V0V29yZEF0UG9zaXRpb24oc2VsZWN0aW9uLmdldFN0YXJ0UG9zaXRpb24oKSk7XG5cdFx0XHRcdGlmICghd29yZCkge1xuXHRcdFx0XHRcdHRoaXMuX2NrQXRFbmQuc2V0KGZhbHNlKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fY2tBdEVuZC5zZXQod29yZC5lbmRDb2x1bW4gPT09IHNlbGVjdGlvbi5nZXRTdGFydFBvc2l0aW9uKCkuY29sdW1uICYmIHNlbGVjdGlvbi5nZXRTdGFydFBvc2l0aW9uKCkubGluZU51bWJlciA9PT0gc2VsZWN0aW9uLmdldEVuZFBvc2l0aW9uKCkubGluZU51bWJlcik7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uTGlzdGVuZXIgPSB0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oY2hlY2tGb3JXb3JkRW5kKTtcblx0XHRcdGNoZWNrRm9yV29yZEVuZCgpO1xuXG5cdFx0fSBlbHNlIGlmICh0aGlzLl9zZWxlY3Rpb25MaXN0ZW5lcikge1xuXHRcdFx0dGhpcy5fY2tBdEVuZC5yZXNldCgpO1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uTGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fc2VsZWN0aW9uTGlzdGVuZXIgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU9BLFNBQVMsb0JBQW9CO0FBQzdCLFNBQXNCLG9CQUFvQixxQkFBcUI7QUFDL0QsU0FBUyxnQkFBZ0I7QUFFbEIsSUFBTSxpQkFBTixNQUFxQjtBQUFBLEVBVTNCLFlBQ2tCLFNBQ0csbUJBQ25CO0FBRmdCO0FBSmxCLFNBQVEsV0FBb0I7QUFRM0IsU0FBSyxXQUFXLGVBQWUsTUFBTSxPQUFPLGlCQUFpQjtBQUM3RCxTQUFLLGtCQUFrQixLQUFLLFFBQVEseUJBQXlCLE9BQUssRUFBRSxXQUFXLGFBQWEsYUFBYSxLQUFLLEtBQUssUUFBUSxDQUFDO0FBQzVILFNBQUssUUFBUTtBQUFBLEVBQ2Q7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxnQkFBZ0IsUUFBUTtBQUM3QixTQUFLLG9CQUFvQixRQUFRO0FBQ2pDLFNBQUssU0FBUyxNQUFNO0FBQUEsRUFDckI7QUFBQSxFQUVRLFVBQWdCO0FBRXZCLFVBQU0sVUFBVSxLQUFLLFFBQVEsVUFBVSxhQUFhLGFBQWEsTUFBTTtBQUN2RSxRQUFJLEtBQUssYUFBYSxTQUFTO0FBQzlCO0FBQUEsSUFDRDtBQUNBLFNBQUssV0FBVztBQUVoQixRQUFJLEtBQUssVUFBVTtBQUNsQixZQUFNLGtCQUFrQixNQUFNO0FBQzdCLFlBQUksQ0FBQyxLQUFLLFFBQVEsU0FBUyxHQUFHO0FBQzdCLGVBQUssU0FBUyxJQUFJLEtBQUs7QUFDdkI7QUFBQSxRQUNEO0FBQ0EsY0FBTSxRQUFRLEtBQUssUUFBUSxTQUFTO0FBQ3BDLGNBQU0sWUFBWSxLQUFLLFFBQVEsYUFBYTtBQUM1QyxjQUFNLE9BQU8sTUFBTSxrQkFBa0IsVUFBVSxpQkFBaUIsQ0FBQztBQUNqRSxZQUFJLENBQUMsTUFBTTtBQUNWLGVBQUssU0FBUyxJQUFJLEtBQUs7QUFDdkI7QUFBQSxRQUNEO0FBQ0EsYUFBSyxTQUFTLElBQUksS0FBSyxjQUFjLFVBQVUsaUJBQWlCLEVBQUUsVUFBVSxVQUFVLGlCQUFpQixFQUFFLGVBQWUsVUFBVSxlQUFlLEVBQUUsVUFBVTtBQUFBLE1BQzlKO0FBQ0EsV0FBSyxxQkFBcUIsS0FBSyxRQUFRLDJCQUEyQixlQUFlO0FBQ2pGLHNCQUFnQjtBQUFBLElBRWpCLFdBQVcsS0FBSyxvQkFBb0I7QUFDbkMsV0FBSyxTQUFTLE1BQU07QUFDcEIsV0FBSyxtQkFBbUIsUUFBUTtBQUNoQyxXQUFLLHFCQUFxQjtBQUFBLElBQzNCO0FBQUEsRUFDRDtBQUNEO0FBMURhLGVBRUksUUFBUSxJQUFJLGNBQXVCLGVBQWUsT0FBTyxFQUFFLE1BQU0sV0FBVyxhQUFhLFNBQVMsUUFBUSx1SEFBdUgsRUFBRSxDQUFDO0FBRnhPLGlCQUFOO0FBQUEsRUFZSjtBQUFBLEdBWlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
