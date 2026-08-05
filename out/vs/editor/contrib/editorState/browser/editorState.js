import * as strings from "../../../../base/common/strings.js";
import { Range } from "../../../common/core/range.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { EditorKeybindingCancellationTokenSource } from "./keybindingCancellation.js";
var CodeEditorStateFlag = /* @__PURE__ */ ((CodeEditorStateFlag2) => {
  CodeEditorStateFlag2[CodeEditorStateFlag2["Value"] = 1] = "Value";
  CodeEditorStateFlag2[CodeEditorStateFlag2["Selection"] = 2] = "Selection";
  CodeEditorStateFlag2[CodeEditorStateFlag2["Position"] = 4] = "Position";
  CodeEditorStateFlag2[CodeEditorStateFlag2["Scroll"] = 8] = "Scroll";
  return CodeEditorStateFlag2;
})(CodeEditorStateFlag || {});
class EditorState {
  constructor(editor, flags) {
    this.flags = flags;
    if ((this.flags & 1 /* Value */) !== 0) {
      const model = editor.getModel();
      this.modelVersionId = model ? strings.format("{0}#{1}", model.uri.toString(), model.getVersionId()) : null;
    } else {
      this.modelVersionId = null;
    }
    if ((this.flags & 4 /* Position */) !== 0) {
      this.position = editor.getPosition();
    } else {
      this.position = null;
    }
    if ((this.flags & 2 /* Selection */) !== 0) {
      this.selection = editor.getSelection();
    } else {
      this.selection = null;
    }
    if ((this.flags & 8 /* Scroll */) !== 0) {
      this.scrollLeft = editor.getScrollLeft();
      this.scrollTop = editor.getScrollTop();
    } else {
      this.scrollLeft = -1;
      this.scrollTop = -1;
    }
  }
  _equals(other) {
    if (!(other instanceof EditorState)) {
      return false;
    }
    const state = other;
    if (this.modelVersionId !== state.modelVersionId) {
      return false;
    }
    if (this.scrollLeft !== state.scrollLeft || this.scrollTop !== state.scrollTop) {
      return false;
    }
    if (!this.position && state.position || this.position && !state.position || this.position && state.position && !this.position.equals(state.position)) {
      return false;
    }
    if (!this.selection && state.selection || this.selection && !state.selection || this.selection && state.selection && !this.selection.equalsRange(state.selection)) {
      return false;
    }
    return true;
  }
  validate(editor) {
    return this._equals(new EditorState(editor, this.flags));
  }
}
class EditorStateCancellationTokenSource extends EditorKeybindingCancellationTokenSource {
  constructor(editor, flags, range, parent) {
    super(editor, parent);
    this._listener = new DisposableStore();
    if (flags & 4 /* Position */) {
      this._listener.add(editor.onDidChangeCursorPosition((e) => {
        if (!range || !Range.containsPosition(range, e.position)) {
          this.cancel();
        }
      }));
    }
    if (flags & 2 /* Selection */) {
      this._listener.add(editor.onDidChangeCursorSelection((e) => {
        if (!range || !Range.containsRange(range, e.selection)) {
          this.cancel();
        }
      }));
    }
    if (flags & 8 /* Scroll */) {
      this._listener.add(editor.onDidScrollChange((_) => this.cancel()));
    }
    if (flags & 1 /* Value */) {
      this._listener.add(editor.onDidChangeModel((_) => this.cancel()));
      this._listener.add(editor.onDidChangeModelContent((_) => this.cancel()));
    }
  }
  dispose() {
    this._listener.dispose();
    super.dispose();
  }
}
class TextModelCancellationTokenSource extends CancellationTokenSource {
  constructor(model, parent) {
    super(parent);
    this._listener = model.onDidChangeContent(() => this.cancel());
  }
  dispose() {
    this._listener.dispose();
    super.dispose();
  }
}
export {
  CodeEditorStateFlag,
  EditorState,
  EditorStateCancellationTokenSource,
  TextModelCancellationTokenSource
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9lZGl0b3JTdGF0ZS9icm93c2VyL2VkaXRvclN0YXRlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgc3RyaW5ncyBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElDb2RlRWRpdG9yLCBJQWN0aXZlQ29kZUVkaXRvciB9IGZyb20gJy4uLy4uLy4uL2Jyb3dzZXIvZWRpdG9yQnJvd3Nlci5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlLCBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSwgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSURpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IEVkaXRvcktleWJpbmRpbmdDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4va2V5YmluZGluZ0NhbmNlbGxhdGlvbi5qcyc7XG5cbmV4cG9ydCBjb25zdCBlbnVtIENvZGVFZGl0b3JTdGF0ZUZsYWcge1xuXHRWYWx1ZSA9IDEsXG5cdFNlbGVjdGlvbiA9IDIsXG5cdFBvc2l0aW9uID0gNCxcblx0U2Nyb2xsID0gOFxufVxuXG5leHBvcnQgY2xhc3MgRWRpdG9yU3RhdGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgZmxhZ3M6IG51bWJlcjtcblxuXHRwcml2YXRlIHJlYWRvbmx5IHBvc2l0aW9uOiBQb3NpdGlvbiB8IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2VsZWN0aW9uOiBSYW5nZSB8IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgbW9kZWxWZXJzaW9uSWQ6IHN0cmluZyB8IG51bGw7XG5cdHByaXZhdGUgcmVhZG9ubHkgc2Nyb2xsTGVmdDogbnVtYmVyO1xuXHRwcml2YXRlIHJlYWRvbmx5IHNjcm9sbFRvcDogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKGVkaXRvcjogSUNvZGVFZGl0b3IsIGZsYWdzOiBudW1iZXIpIHtcblx0XHR0aGlzLmZsYWdzID0gZmxhZ3M7XG5cblx0XHRpZiAoKHRoaXMuZmxhZ3MgJiBDb2RlRWRpdG9yU3RhdGVGbGFnLlZhbHVlKSAhPT0gMCkge1xuXHRcdFx0Y29uc3QgbW9kZWwgPSBlZGl0b3IuZ2V0TW9kZWwoKTtcblx0XHRcdHRoaXMubW9kZWxWZXJzaW9uSWQgPSBtb2RlbCA/IHN0cmluZ3MuZm9ybWF0KCd7MH0jezF9JywgbW9kZWwudXJpLnRvU3RyaW5nKCksIG1vZGVsLmdldFZlcnNpb25JZCgpKSA6IG51bGw7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubW9kZWxWZXJzaW9uSWQgPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoKHRoaXMuZmxhZ3MgJiBDb2RlRWRpdG9yU3RhdGVGbGFnLlBvc2l0aW9uKSAhPT0gMCkge1xuXHRcdFx0dGhpcy5wb3NpdGlvbiA9IGVkaXRvci5nZXRQb3NpdGlvbigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLnBvc2l0aW9uID0gbnVsbDtcblx0XHR9XG5cdFx0aWYgKCh0aGlzLmZsYWdzICYgQ29kZUVkaXRvclN0YXRlRmxhZy5TZWxlY3Rpb24pICE9PSAwKSB7XG5cdFx0XHR0aGlzLnNlbGVjdGlvbiA9IGVkaXRvci5nZXRTZWxlY3Rpb24oKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zZWxlY3Rpb24gPSBudWxsO1xuXHRcdH1cblx0XHRpZiAoKHRoaXMuZmxhZ3MgJiBDb2RlRWRpdG9yU3RhdGVGbGFnLlNjcm9sbCkgIT09IDApIHtcblx0XHRcdHRoaXMuc2Nyb2xsTGVmdCA9IGVkaXRvci5nZXRTY3JvbGxMZWZ0KCk7XG5cdFx0XHR0aGlzLnNjcm9sbFRvcCA9IGVkaXRvci5nZXRTY3JvbGxUb3AoKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5zY3JvbGxMZWZ0ID0gLTE7XG5cdFx0XHR0aGlzLnNjcm9sbFRvcCA9IC0xO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX2VxdWFscyhvdGhlcjogYW55KTogYm9vbGVhbiB7XG5cblx0XHRpZiAoIShvdGhlciBpbnN0YW5jZW9mIEVkaXRvclN0YXRlKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRjb25zdCBzdGF0ZSA9IDxFZGl0b3JTdGF0ZT5vdGhlcjtcblxuXHRcdGlmICh0aGlzLm1vZGVsVmVyc2lvbklkICE9PSBzdGF0ZS5tb2RlbFZlcnNpb25JZCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAodGhpcy5zY3JvbGxMZWZ0ICE9PSBzdGF0ZS5zY3JvbGxMZWZ0IHx8IHRoaXMuc2Nyb2xsVG9wICE9PSBzdGF0ZS5zY3JvbGxUb3ApIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0aWYgKCF0aGlzLnBvc2l0aW9uICYmIHN0YXRlLnBvc2l0aW9uIHx8IHRoaXMucG9zaXRpb24gJiYgIXN0YXRlLnBvc2l0aW9uIHx8IHRoaXMucG9zaXRpb24gJiYgc3RhdGUucG9zaXRpb24gJiYgIXRoaXMucG9zaXRpb24uZXF1YWxzKHN0YXRlLnBvc2l0aW9uKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIXRoaXMuc2VsZWN0aW9uICYmIHN0YXRlLnNlbGVjdGlvbiB8fCB0aGlzLnNlbGVjdGlvbiAmJiAhc3RhdGUuc2VsZWN0aW9uIHx8IHRoaXMuc2VsZWN0aW9uICYmIHN0YXRlLnNlbGVjdGlvbiAmJiAhdGhpcy5zZWxlY3Rpb24uZXF1YWxzUmFuZ2Uoc3RhdGUuc2VsZWN0aW9uKSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdHB1YmxpYyB2YWxpZGF0ZShlZGl0b3I6IElDb2RlRWRpdG9yKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2VxdWFscyhuZXcgRWRpdG9yU3RhdGUoZWRpdG9yLCB0aGlzLmZsYWdzKSk7XG5cdH1cbn1cblxuLyoqXG4gKiBBIGNhbmNlbGxhdGlvbiB0b2tlbiBzb3VyY2UgdGhhdCBjYW5jZWxzIHdoZW4gdGhlIGVkaXRvciBjaGFuZ2VzIGFzIGV4cHJlc3NlZFxuICogYnkgdGhlIHByb3ZpZGVkIGZsYWdzXG4gKiBAcGFyYW0gcmFuZ2UgSWYgcHJvdmlkZWQsIGNoYW5nZXMgaW4gcG9zaXRpb24gYW5kIHNlbGVjdGlvbiB3aXRoaW4gdGhpcyByYW5nZSB3aWxsIG5vdCB0cmlnZ2VyIGNhbmNlbGxhdGlvblxuICovXG5leHBvcnQgY2xhc3MgRWRpdG9yU3RhdGVDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSBleHRlbmRzIEVkaXRvcktleWJpbmRpbmdDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9saXN0ZW5lciA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRjb25zdHJ1Y3RvcihlZGl0b3I6IElBY3RpdmVDb2RlRWRpdG9yLCBmbGFnczogQ29kZUVkaXRvclN0YXRlRmxhZywgcmFuZ2U/OiBJUmFuZ2UsIHBhcmVudD86IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0c3VwZXIoZWRpdG9yLCBwYXJlbnQpO1xuXG5cdFx0aWYgKGZsYWdzICYgQ29kZUVkaXRvclN0YXRlRmxhZy5Qb3NpdGlvbikge1xuXHRcdFx0dGhpcy5fbGlzdGVuZXIuYWRkKGVkaXRvci5vbkRpZENoYW5nZUN1cnNvclBvc2l0aW9uKGUgPT4ge1xuXHRcdFx0XHRpZiAoIXJhbmdlIHx8ICFSYW5nZS5jb250YWluc1Bvc2l0aW9uKHJhbmdlLCBlLnBvc2l0aW9uKSkge1xuXHRcdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0aWYgKGZsYWdzICYgQ29kZUVkaXRvclN0YXRlRmxhZy5TZWxlY3Rpb24pIHtcblx0XHRcdHRoaXMuX2xpc3RlbmVyLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VDdXJzb3JTZWxlY3Rpb24oZSA9PiB7XG5cdFx0XHRcdGlmICghcmFuZ2UgfHwgIVJhbmdlLmNvbnRhaW5zUmFuZ2UocmFuZ2UsIGUuc2VsZWN0aW9uKSkge1xuXHRcdFx0XHRcdHRoaXMuY2FuY2VsKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdFx0aWYgKGZsYWdzICYgQ29kZUVkaXRvclN0YXRlRmxhZy5TY3JvbGwpIHtcblx0XHRcdHRoaXMuX2xpc3RlbmVyLmFkZChlZGl0b3Iub25EaWRTY3JvbGxDaGFuZ2UoXyA9PiB0aGlzLmNhbmNlbCgpKSk7XG5cdFx0fVxuXHRcdGlmIChmbGFncyAmIENvZGVFZGl0b3JTdGF0ZUZsYWcuVmFsdWUpIHtcblx0XHRcdHRoaXMuX2xpc3RlbmVyLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbChfID0+IHRoaXMuY2FuY2VsKCkpKTtcblx0XHRcdHRoaXMuX2xpc3RlbmVyLmFkZChlZGl0b3Iub25EaWRDaGFuZ2VNb2RlbENvbnRlbnQoXyA9PiB0aGlzLmNhbmNlbCgpKSk7XG5cdFx0fVxuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9saXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8qKlxuICogQSBjYW5jZWxsYXRpb24gdG9rZW4gc291cmNlIHRoYXQgY2FuY2VscyB3aGVuIHRoZSBwcm92aWRlZCBtb2RlbCBjaGFuZ2VzXG4gKi9cbmV4cG9ydCBjbGFzcyBUZXh0TW9kZWxDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSBleHRlbmRzIENhbmNlbGxhdGlvblRva2VuU291cmNlIGltcGxlbWVudHMgSURpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgX2xpc3RlbmVyOiBJRGlzcG9zYWJsZTtcblxuXHRjb25zdHJ1Y3Rvcihtb2RlbDogSVRleHRNb2RlbCwgcGFyZW50PzogQ2FuY2VsbGF0aW9uVG9rZW4pIHtcblx0XHRzdXBlcihwYXJlbnQpO1xuXHRcdHRoaXMuX2xpc3RlbmVyID0gbW9kZWwub25EaWRDaGFuZ2VDb250ZW50KCgpID0+IHRoaXMuY2FuY2VsKCkpO1xuXHR9XG5cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHR0aGlzLl9saXN0ZW5lci5kaXNwb3NlKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxZQUFZLGFBQWE7QUFHekIsU0FBUyxhQUFxQjtBQUM5QixTQUFTLCtCQUFrRDtBQUMzRCxTQUFzQix1QkFBdUI7QUFFN0MsU0FBUywrQ0FBK0M7QUFFakQsSUFBVyxzQkFBWCxrQkFBV0EseUJBQVg7QUFDTixFQUFBQSwwQ0FB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
