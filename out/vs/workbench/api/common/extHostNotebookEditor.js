import { illegalArgument } from "../../../base/common/errors.js";
import * as extHostConverter from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
const _ExtHostNotebookEditor = class _ExtHostNotebookEditor {
  constructor(id, _proxy, notebookData, _visibleRanges, _selections, _viewColumn, viewType) {
    this.id = id;
    this._proxy = _proxy;
    this.notebookData = notebookData;
    this._visibleRanges = _visibleRanges;
    this._selections = _selections;
    this._viewColumn = _viewColumn;
    this.viewType = viewType;
    this._visible = false;
  }
  get apiEditor() {
    if (!this._editor) {
      const that = this;
      this._editor = {
        get notebook() {
          return that.notebookData.apiNotebook;
        },
        get selection() {
          return that._selections[0];
        },
        set selection(selection) {
          this.selections = [selection];
        },
        get selections() {
          return that._selections;
        },
        set selections(value) {
          if (!Array.isArray(value) || !value.every(extHostTypes.NotebookRange.isNotebookRange)) {
            throw illegalArgument("selections");
          }
          that._selections = value;
          that._trySetSelections(value);
        },
        get visibleRanges() {
          return that._visibleRanges;
        },
        revealRange(range, revealType) {
          that._proxy.$tryRevealRange(
            that.id,
            extHostConverter.NotebookRange.from(range),
            revealType ?? extHostTypes.NotebookEditorRevealType.Default
          );
        },
        get viewColumn() {
          return that._viewColumn;
        },
        get replOptions() {
          if (that.viewType === "repl") {
            return { appendIndex: this.notebook.cellCount - 1 };
          }
          return void 0;
        },
        [Symbol.for("debug.description")]() {
          return `NotebookEditor(${this.notebook.uri.toString()})`;
        }
      };
      _ExtHostNotebookEditor.apiEditorsToExtHost.set(this._editor, this);
    }
    return this._editor;
  }
  get visible() {
    return this._visible;
  }
  _acceptVisibility(value) {
    this._visible = value;
  }
  _acceptVisibleRanges(value) {
    this._visibleRanges = value;
  }
  _acceptSelections(selections) {
    this._selections = selections;
  }
  _trySetSelections(value) {
    this._proxy.$trySetSelections(this.id, value.map(extHostConverter.NotebookRange.from));
  }
  _acceptViewColumn(value) {
    this._viewColumn = value;
  }
};
_ExtHostNotebookEditor.apiEditorsToExtHost = /* @__PURE__ */ new WeakMap();
let ExtHostNotebookEditor = _ExtHostNotebookEditor;
export {
  ExtHostNotebookEditor
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Tm90ZWJvb2tFZGl0b3IudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBpbGxlZ2FsQXJndW1lbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgTWFpblRocmVhZE5vdGVib29rRWRpdG9yc1NoYXBlIH0gZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCAqIGFzIGV4dEhvc3RDb252ZXJ0ZXIgZnJvbSAnLi9leHRIb3N0VHlwZUNvbnZlcnRlcnMuanMnO1xuaW1wb3J0ICogYXMgZXh0SG9zdFR5cGVzIGZyb20gJy4vZXh0SG9zdFR5cGVzLmpzJztcbmltcG9ydCAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgRXh0SG9zdE5vdGVib29rRG9jdW1lbnQgfSBmcm9tICcuL2V4dEhvc3ROb3RlYm9va0RvY3VtZW50LmpzJztcblxuZXhwb3J0IGNsYXNzIEV4dEhvc3ROb3RlYm9va0VkaXRvciB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBhcGlFZGl0b3JzVG9FeHRIb3N0ID0gbmV3IFdlYWtNYXA8dnNjb2RlLk5vdGVib29rRWRpdG9yLCBFeHRIb3N0Tm90ZWJvb2tFZGl0b3I+KCk7XG5cblx0cHJpdmF0ZSBfdmlzaWJsZTogYm9vbGVhbiA9IGZhbHNlO1xuXG5cdHByaXZhdGUgX2VkaXRvcj86IHZzY29kZS5Ob3RlYm9va0VkaXRvcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRyZWFkb25seSBpZDogc3RyaW5nLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkTm90ZWJvb2tFZGl0b3JzU2hhcGUsXG5cdFx0cmVhZG9ubHkgbm90ZWJvb2tEYXRhOiBFeHRIb3N0Tm90ZWJvb2tEb2N1bWVudCxcblx0XHRwcml2YXRlIF92aXNpYmxlUmFuZ2VzOiB2c2NvZGUuTm90ZWJvb2tSYW5nZVtdLFxuXHRcdHByaXZhdGUgX3NlbGVjdGlvbnM6IHZzY29kZS5Ob3RlYm9va1JhbmdlW10sXG5cdFx0cHJpdmF0ZSBfdmlld0NvbHVtbjogdnNjb2RlLlZpZXdDb2x1bW4gfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSB2aWV3VHlwZTogc3RyaW5nXG5cdCkgeyB9XG5cblx0Z2V0IGFwaUVkaXRvcigpOiB2c2NvZGUuTm90ZWJvb2tFZGl0b3Ige1xuXHRcdGlmICghdGhpcy5fZWRpdG9yKSB7XG5cdFx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRcdHRoaXMuX2VkaXRvciA9IHtcblx0XHRcdFx0Z2V0IG5vdGVib29rKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Lm5vdGVib29rRGF0YS5hcGlOb3RlYm9vaztcblx0XHRcdFx0fSxcblx0XHRcdFx0Z2V0IHNlbGVjdGlvbigpIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhhdC5fc2VsZWN0aW9uc1swXTtcblx0XHRcdFx0fSxcblx0XHRcdFx0c2V0IHNlbGVjdGlvbihzZWxlY3Rpb246IHZzY29kZS5Ob3RlYm9va1JhbmdlKSB7XG5cdFx0XHRcdFx0dGhpcy5zZWxlY3Rpb25zID0gW3NlbGVjdGlvbl07XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCBzZWxlY3Rpb25zKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll9zZWxlY3Rpb25zO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzZXQgc2VsZWN0aW9ucyh2YWx1ZTogdnNjb2RlLk5vdGVib29rUmFuZ2VbXSkge1xuXHRcdFx0XHRcdGlmICghQXJyYXkuaXNBcnJheSh2YWx1ZSkgfHwgIXZhbHVlLmV2ZXJ5KGV4dEhvc3RUeXBlcy5Ob3RlYm9va1JhbmdlLmlzTm90ZWJvb2tSYW5nZSkpIHtcblx0XHRcdFx0XHRcdHRocm93IGlsbGVnYWxBcmd1bWVudCgnc2VsZWN0aW9ucycpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHR0aGF0Ll9zZWxlY3Rpb25zID0gdmFsdWU7XG5cdFx0XHRcdFx0dGhhdC5fdHJ5U2V0U2VsZWN0aW9ucyh2YWx1ZSk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCB2aXNpYmxlUmFuZ2VzKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll92aXNpYmxlUmFuZ2VzO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRyZXZlYWxSYW5nZShyYW5nZSwgcmV2ZWFsVHlwZSkge1xuXHRcdFx0XHRcdHRoYXQuX3Byb3h5LiR0cnlSZXZlYWxSYW5nZShcblx0XHRcdFx0XHRcdHRoYXQuaWQsXG5cdFx0XHRcdFx0XHRleHRIb3N0Q29udmVydGVyLk5vdGVib29rUmFuZ2UuZnJvbShyYW5nZSksXG5cdFx0XHRcdFx0XHRyZXZlYWxUeXBlID8/IGV4dEhvc3RUeXBlcy5Ob3RlYm9va0VkaXRvclJldmVhbFR5cGUuRGVmYXVsdFxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGdldCB2aWV3Q29sdW1uKCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGF0Ll92aWV3Q29sdW1uO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRnZXQgcmVwbE9wdGlvbnMoKSB7XG5cdFx0XHRcdFx0aWYgKHRoYXQudmlld1R5cGUgPT09ICdyZXBsJykge1xuXHRcdFx0XHRcdFx0cmV0dXJuIHsgYXBwZW5kSW5kZXg6IHRoaXMubm90ZWJvb2suY2VsbENvdW50IC0gMSB9O1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRbU3ltYm9sLmZvcignZGVidWcuZGVzY3JpcHRpb24nKV0oKSB7XG5cdFx0XHRcdFx0cmV0dXJuIGBOb3RlYm9va0VkaXRvcigke3RoaXMubm90ZWJvb2sudXJpLnRvU3RyaW5nKCl9KWA7XG5cdFx0XHRcdH1cblx0XHRcdH07XG5cblx0XHRcdEV4dEhvc3ROb3RlYm9va0VkaXRvci5hcGlFZGl0b3JzVG9FeHRIb3N0LnNldCh0aGlzLl9lZGl0b3IsIHRoaXMpO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZWRpdG9yO1xuXHR9XG5cblx0Z2V0IHZpc2libGUoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3Zpc2libGU7XG5cdH1cblxuXHRfYWNjZXB0VmlzaWJpbGl0eSh2YWx1ZTogYm9vbGVhbikge1xuXHRcdHRoaXMuX3Zpc2libGUgPSB2YWx1ZTtcblx0fVxuXG5cdF9hY2NlcHRWaXNpYmxlUmFuZ2VzKHZhbHVlOiB2c2NvZGUuTm90ZWJvb2tSYW5nZVtdKTogdm9pZCB7XG5cdFx0dGhpcy5fdmlzaWJsZVJhbmdlcyA9IHZhbHVlO1xuXHR9XG5cblx0X2FjY2VwdFNlbGVjdGlvbnMoc2VsZWN0aW9uczogdnNjb2RlLk5vdGVib29rUmFuZ2VbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3NlbGVjdGlvbnMgPSBzZWxlY3Rpb25zO1xuXHR9XG5cblx0cHJpdmF0ZSBfdHJ5U2V0U2VsZWN0aW9ucyh2YWx1ZTogdnNjb2RlLk5vdGVib29rUmFuZ2VbXSk6IHZvaWQge1xuXHRcdHRoaXMuX3Byb3h5LiR0cnlTZXRTZWxlY3Rpb25zKHRoaXMuaWQsIHZhbHVlLm1hcChleHRIb3N0Q29udmVydGVyLk5vdGVib29rUmFuZ2UuZnJvbSkpO1xuXHR9XG5cblx0X2FjY2VwdFZpZXdDb2x1bW4odmFsdWU6IHZzY29kZS5WaWV3Q29sdW1uIHwgdW5kZWZpbmVkKSB7XG5cdFx0dGhpcy5fdmlld0NvbHVtbiA9IHZhbHVlO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLHVCQUF1QjtBQUVoQyxZQUFZLHNCQUFzQjtBQUNsQyxZQUFZLGtCQUFrQjtBQUl2QixNQUFNLHlCQUFOLE1BQU0sdUJBQXNCO0FBQUEsRUFRbEMsWUFDVSxJQUNRLFFBQ1IsY0FDRCxnQkFDQSxhQUNBLGFBQ1MsVUFDaEI7QUFQUTtBQUNRO0FBQ1I7QUFDRDtBQUNBO0FBQ0E7QUFDUztBQVhsQixTQUFRLFdBQW9CO0FBQUEsRUFZeEI7QUFBQSxFQUVKLElBQUksWUFBbUM7QUFDdEMsUUFBSSxDQUFDLEtBQUssU0FBUztBQUNsQixZQUFNLE9BQU87QUFDYixXQUFLLFVBQVU7QUFBQSxRQUNkLElBQUksV0FBVztBQUNkLGlCQUFPLEtBQUssYUFBYTtBQUFBLFFBQzFCO0FBQUEsUUFDQSxJQUFJLFlBQVk7QUFDZixpQkFBTyxLQUFLLFlBQVksQ0FBQztBQUFBLFFBQzFCO0FBQUEsUUFDQSxJQUFJLFVBQVUsV0FBaUM7QUFDOUMsZUFBSyxhQUFhLENBQUMsU0FBUztBQUFBLFFBQzdCO0FBQUEsUUFDQSxJQUFJLGFBQWE7QUFDaEIsaUJBQU8sS0FBSztBQUFBLFFBQ2I7QUFBQSxRQUNBLElBQUksV0FBVyxPQUErQjtBQUM3QyxjQUFJLENBQUMsTUFBTSxRQUFRLEtBQUssS0FBSyxDQUFDLE1BQU0sTUFBTSxhQUFhLGNBQWMsZUFBZSxHQUFHO0FBQ3RGLGtCQUFNLGdCQUFnQixZQUFZO0FBQUEsVUFDbkM7QUFDQSxlQUFLLGNBQWM7QUFDbkIsZUFBSyxrQkFBa0IsS0FBSztBQUFBLFFBQzdCO0FBQUEsUUFDQSxJQUFJLGdCQUFnQjtBQUNuQixpQkFBTyxLQUFLO0FBQUEsUUFDYjtBQUFBLFFBQ0EsWUFBWSxPQUFPLFlBQVk7QUFDOUIsZUFBSyxPQUFPO0FBQUEsWUFDWCxLQUFLO0FBQUEsWUFDTCxpQkFBaUIsY0FBYyxLQUFLLEtBQUs7QUFBQSxZQUN6QyxjQUFjLGFBQWEseUJBQXlCO0FBQUEsVUFDckQ7QUFBQSxRQUNEO0FBQUEsUUFDQSxJQUFJLGFBQWE7QUFDaEIsaUJBQU8sS0FBSztBQUFBLFFBQ2I7QUFBQSxRQUNBLElBQUksY0FBYztBQUNqQixjQUFJLEtBQUssYUFBYSxRQUFRO0FBQzdCLG1CQUFPLEVBQUUsYUFBYSxLQUFLLFNBQVMsWUFBWSxFQUFFO0FBQUEsVUFDbkQ7QUFDQSxpQkFBTztBQUFBLFFBQ1I7QUFBQSxRQUNBLENBQUMsT0FBTyxJQUFJLG1CQUFtQixDQUFDLElBQUk7QUFDbkMsaUJBQU8sa0JBQWtCLEtBQUssU0FBUyxJQUFJLFNBQVMsQ0FBQztBQUFBLFFBQ3REO0FBQUEsTUFDRDtBQUVBLDZCQUFzQixvQkFBb0IsSUFBSSxLQUFLLFNBQVMsSUFBSTtBQUFBLElBQ2pFO0FBQ0EsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRUEsSUFBSSxVQUFtQjtBQUN0QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFQSxrQkFBa0IsT0FBZ0I7QUFDakMsU0FBSyxXQUFXO0FBQUEsRUFDakI7QUFBQSxFQUVBLHFCQUFxQixPQUFxQztBQUN6RCxTQUFLLGlCQUFpQjtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxrQkFBa0IsWUFBMEM7QUFDM0QsU0FBSyxjQUFjO0FBQUEsRUFDcEI7QUFBQSxFQUVRLGtCQUFrQixPQUFxQztBQUM5RCxTQUFLLE9BQU8sa0JBQWtCLEtBQUssSUFBSSxNQUFNLElBQUksaUJBQWlCLGNBQWMsSUFBSSxDQUFDO0FBQUEsRUFDdEY7QUFBQSxFQUVBLGtCQUFrQixPQUFzQztBQUN2RCxTQUFLLGNBQWM7QUFBQSxFQUNwQjtBQUNEO0FBN0ZhLHVCQUVXLHNCQUFzQixvQkFBSSxRQUFzRDtBQUZqRyxJQUFNLHdCQUFOOyIsCiAgIm5hbWVzIjogW10KfQo=
