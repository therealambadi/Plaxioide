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
import { DisposableStore } from "../../../../../base/common/lifecycle.js";
import { URI } from "../../../../../base/common/uri.js";
import { TrackedRangeStickiness } from "../../../../../editor/common/model.js";
import { ModelDecorationOptions } from "../../../../../editor/common/model/textModel.js";
import { IModelService } from "../../../../../editor/common/services/model.js";
let RangeHighlightDecorations = class {
  constructor(_modelService) {
    this._modelService = _modelService;
    this._decorationId = null;
    this._model = null;
    this._modelDisposables = new DisposableStore();
  }
  removeHighlightRange() {
    if (this._model && this._decorationId) {
      const decorationId = this._decorationId;
      this._model.changeDecorations((accessor) => {
        accessor.removeDecoration(decorationId);
      });
    }
    this._decorationId = null;
  }
  highlightRange(resource, range, ownerId = 0) {
    let model;
    if (URI.isUri(resource)) {
      model = this._modelService.getModel(resource);
    } else {
      model = resource;
    }
    if (model) {
      this.doHighlightRange(model, range);
    }
  }
  doHighlightRange(model, range) {
    this.removeHighlightRange();
    model.changeDecorations((accessor) => {
      this._decorationId = accessor.addDecoration(range, RangeHighlightDecorations._RANGE_HIGHLIGHT_DECORATION);
    });
    this.setModel(model);
  }
  setModel(model) {
    if (this._model !== model) {
      this.clearModelListeners();
      this._model = model;
      this._modelDisposables.add(this._model.onDidChangeDecorations((e) => {
        this.clearModelListeners();
        this.removeHighlightRange();
        this._model = null;
      }));
      this._modelDisposables.add(this._model.onWillDispose(() => {
        this.clearModelListeners();
        this.removeHighlightRange();
        this._model = null;
      }));
    }
  }
  clearModelListeners() {
    this._modelDisposables.clear();
  }
  dispose() {
    if (this._model) {
      this.removeHighlightRange();
      this._model = null;
    }
    this._modelDisposables.dispose();
  }
};
RangeHighlightDecorations._RANGE_HIGHLIGHT_DECORATION = ModelDecorationOptions.register({
  description: "search-range-highlight",
  stickiness: TrackedRangeStickiness.NeverGrowsWhenTypingAtEdges,
  className: "rangeHighlight",
  isWholeLine: true
});
RangeHighlightDecorations = __decorateClass([
  __decorateParam(0, IModelService)
], RangeHighlightDecorations);
export {
  RangeHighlightDecorations
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvYnJvd3Nlci9zZWFyY2hUcmVlTW9kZWwvcmFuZ2VEZWNvcmF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWwsIFRyYWNrZWRSYW5nZVN0aWNraW5lc3MgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsLmpzJztcbmltcG9ydCB7IE1vZGVsRGVjb3JhdGlvbk9wdGlvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL21vZGVsL3RleHRNb2RlbC5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9yYW5nZS5qcyc7XG5cbi8qKlxuICogQ2FuIGFkZCBhIHJhbmdlIGhpZ2hsaWdodCBkZWNvcmF0aW9uIHRvIGEgbW9kZWwuXG4gKiBJdCB3aWxsIGF1dG9tYXRpY2FsbHkgcmVtb3ZlIGl0IHdoZW4gdGhlIG1vZGVsIGhhcyBpdHMgZGVjb3JhdGlvbnMgY2hhbmdlZC5cbiAqL1xuXG5leHBvcnQgY2xhc3MgUmFuZ2VIaWdobGlnaHREZWNvcmF0aW9ucyBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9kZWNvcmF0aW9uSWQ6IHN0cmluZyB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIF9tb2RlbDogSVRleHRNb2RlbCB8IG51bGwgPSBudWxsO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTW9kZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX21vZGVsU2VydmljZTogSU1vZGVsU2VydmljZVxuXHQpIHtcblx0fVxuXG5cdHJlbW92ZUhpZ2hsaWdodFJhbmdlKCkge1xuXHRcdGlmICh0aGlzLl9tb2RlbCAmJiB0aGlzLl9kZWNvcmF0aW9uSWQpIHtcblx0XHRcdGNvbnN0IGRlY29yYXRpb25JZCA9IHRoaXMuX2RlY29yYXRpb25JZDtcblx0XHRcdHRoaXMuX21vZGVsLmNoYW5nZURlY29yYXRpb25zKChhY2Nlc3NvcikgPT4ge1xuXHRcdFx0XHRhY2Nlc3Nvci5yZW1vdmVEZWNvcmF0aW9uKGRlY29yYXRpb25JZCk7XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0dGhpcy5fZGVjb3JhdGlvbklkID0gbnVsbDtcblx0fVxuXG5cdGhpZ2hsaWdodFJhbmdlKHJlc291cmNlOiBVUkkgfCBJVGV4dE1vZGVsLCByYW5nZTogUmFuZ2UsIG93bmVySWQ6IG51bWJlciA9IDApOiB2b2lkIHtcblx0XHRsZXQgbW9kZWw6IElUZXh0TW9kZWwgfCBudWxsO1xuXHRcdGlmIChVUkkuaXNVcmkocmVzb3VyY2UpKSB7XG5cdFx0XHRtb2RlbCA9IHRoaXMuX21vZGVsU2VydmljZS5nZXRNb2RlbChyZXNvdXJjZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdG1vZGVsID0gcmVzb3VyY2U7XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsKSB7XG5cdFx0XHR0aGlzLmRvSGlnaGxpZ2h0UmFuZ2UobW9kZWwsIHJhbmdlKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGRvSGlnaGxpZ2h0UmFuZ2UobW9kZWw6IElUZXh0TW9kZWwsIHJhbmdlOiBSYW5nZSkge1xuXHRcdHRoaXMucmVtb3ZlSGlnaGxpZ2h0UmFuZ2UoKTtcblx0XHRtb2RlbC5jaGFuZ2VEZWNvcmF0aW9ucygoYWNjZXNzb3IpID0+IHtcblx0XHRcdHRoaXMuX2RlY29yYXRpb25JZCA9IGFjY2Vzc29yLmFkZERlY29yYXRpb24ocmFuZ2UsIFJhbmdlSGlnaGxpZ2h0RGVjb3JhdGlvbnMuX1JBTkdFX0hJR0hMSUdIVF9ERUNPUkFUSU9OKTtcblx0XHR9KTtcblx0XHR0aGlzLnNldE1vZGVsKG1vZGVsKTtcblx0fVxuXG5cdHByaXZhdGUgc2V0TW9kZWwobW9kZWw6IElUZXh0TW9kZWwpIHtcblx0XHRpZiAodGhpcy5fbW9kZWwgIT09IG1vZGVsKSB7XG5cdFx0XHR0aGlzLmNsZWFyTW9kZWxMaXN0ZW5lcnMoKTtcblx0XHRcdHRoaXMuX21vZGVsID0gbW9kZWw7XG5cdFx0XHR0aGlzLl9tb2RlbERpc3Bvc2FibGVzLmFkZCh0aGlzLl9tb2RlbC5vbkRpZENoYW5nZURlY29yYXRpb25zKChlKSA9PiB7XG5cdFx0XHRcdHRoaXMuY2xlYXJNb2RlbExpc3RlbmVycygpO1xuXHRcdFx0XHR0aGlzLnJlbW92ZUhpZ2hsaWdodFJhbmdlKCk7XG5cdFx0XHRcdHRoaXMuX21vZGVsID0gbnVsbDtcblx0XHRcdH0pKTtcblx0XHRcdHRoaXMuX21vZGVsRGlzcG9zYWJsZXMuYWRkKHRoaXMuX21vZGVsLm9uV2lsbERpc3Bvc2UoKCkgPT4ge1xuXHRcdFx0XHR0aGlzLmNsZWFyTW9kZWxMaXN0ZW5lcnMoKTtcblx0XHRcdFx0dGhpcy5yZW1vdmVIaWdobGlnaHRSYW5nZSgpO1xuXHRcdFx0XHR0aGlzLl9tb2RlbCA9IG51bGw7XG5cdFx0XHR9KSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBjbGVhck1vZGVsTGlzdGVuZXJzKCkge1xuXHRcdHRoaXMuX21vZGVsRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0fVxuXG5cdGRpc3Bvc2UoKSB7XG5cdFx0aWYgKHRoaXMuX21vZGVsKSB7XG5cdFx0XHR0aGlzLnJlbW92ZUhpZ2hsaWdodFJhbmdlKCk7XG5cdFx0XHR0aGlzLl9tb2RlbCA9IG51bGw7XG5cdFx0fVxuXHRcdHRoaXMuX21vZGVsRGlzcG9zYWJsZXMuZGlzcG9zZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgX1JBTkdFX0hJR0hMSUdIVF9ERUNPUkFUSU9OID0gTW9kZWxEZWNvcmF0aW9uT3B0aW9ucy5yZWdpc3Rlcih7XG5cdFx0ZGVzY3JpcHRpb246ICdzZWFyY2gtcmFuZ2UtaGlnaGxpZ2h0Jyxcblx0XHRzdGlja2luZXNzOiBUcmFja2VkUmFuZ2VTdGlja2luZXNzLk5ldmVyR3Jvd3NXaGVuVHlwaW5nQXRFZGdlcyxcblx0XHRjbGFzc05hbWU6ICdyYW5nZUhpZ2hsaWdodCcsXG5cdFx0aXNXaG9sZUxpbmU6IHRydWVcblx0fSk7XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQXNCLHVCQUF1QjtBQUM3QyxTQUFTLFdBQVc7QUFDcEIsU0FBcUIsOEJBQThCO0FBQ25ELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMscUJBQXFCO0FBUXZCLElBQU0sNEJBQU4sTUFBdUQ7QUFBQSxFQU03RCxZQUNpQyxlQUMvQjtBQUQrQjtBQUxqQyxTQUFRLGdCQUErQjtBQUN2QyxTQUFRLFNBQTRCO0FBQ3BDLFNBQWlCLG9CQUFvQixJQUFJLGdCQUFnQjtBQUFBLEVBS3pEO0FBQUEsRUFFQSx1QkFBdUI7QUFDdEIsUUFBSSxLQUFLLFVBQVUsS0FBSyxlQUFlO0FBQ3RDLFlBQU0sZUFBZSxLQUFLO0FBQzFCLFdBQUssT0FBTyxrQkFBa0IsQ0FBQyxhQUFhO0FBQzNDLGlCQUFTLGlCQUFpQixZQUFZO0FBQUEsTUFDdkMsQ0FBQztBQUFBLElBQ0Y7QUFDQSxTQUFLLGdCQUFnQjtBQUFBLEVBQ3RCO0FBQUEsRUFFQSxlQUFlLFVBQTRCLE9BQWMsVUFBa0IsR0FBUztBQUNuRixRQUFJO0FBQ0osUUFBSSxJQUFJLE1BQU0sUUFBUSxHQUFHO0FBQ3hCLGNBQVEsS0FBSyxjQUFjLFNBQVMsUUFBUTtBQUFBLElBQzdDLE9BQU87QUFDTixjQUFRO0FBQUEsSUFDVDtBQUVBLFFBQUksT0FBTztBQUNWLFdBQUssaUJBQWlCLE9BQU8sS0FBSztBQUFBLElBQ25DO0FBQUEsRUFDRDtBQUFBLEVBRVEsaUJBQWlCLE9BQW1CLE9BQWM7QUFDekQsU0FBSyxxQkFBcUI7QUFDMUIsVUFBTSxrQkFBa0IsQ0FBQyxhQUFhO0FBQ3JDLFdBQUssZ0JBQWdCLFNBQVMsY0FBYyxPQUFPLDBCQUEwQiwyQkFBMkI7QUFBQSxJQUN6RyxDQUFDO0FBQ0QsU0FBSyxTQUFTLEtBQUs7QUFBQSxFQUNwQjtBQUFBLEVBRVEsU0FBUyxPQUFtQjtBQUNuQyxRQUFJLEtBQUssV0FBVyxPQUFPO0FBQzFCLFdBQUssb0JBQW9CO0FBQ3pCLFdBQUssU0FBUztBQUNkLFdBQUssa0JBQWtCLElBQUksS0FBSyxPQUFPLHVCQUF1QixDQUFDLE1BQU07QUFDcEUsYUFBSyxvQkFBb0I7QUFDekIsYUFBSyxxQkFBcUI7QUFDMUIsYUFBSyxTQUFTO0FBQUEsTUFDZixDQUFDLENBQUM7QUFDRixXQUFLLGtCQUFrQixJQUFJLEtBQUssT0FBTyxjQUFjLE1BQU07QUFDMUQsYUFBSyxvQkFBb0I7QUFDekIsYUFBSyxxQkFBcUI7QUFDMUIsYUFBSyxTQUFTO0FBQUEsTUFDZixDQUFDLENBQUM7QUFBQSxJQUNIO0FBQUEsRUFDRDtBQUFBLEVBRVEsc0JBQXNCO0FBQzdCLFNBQUssa0JBQWtCLE1BQU07QUFBQSxFQUM5QjtBQUFBLEVBRUEsVUFBVTtBQUNULFFBQUksS0FBSyxRQUFRO0FBQ2hCLFdBQUsscUJBQXFCO0FBQzFCLFdBQUssU0FBUztBQUFBLElBQ2Y7QUFDQSxTQUFLLGtCQUFrQixRQUFRO0FBQUEsRUFDaEM7QUFRRDtBQTdFYSwwQkF1RVksOEJBQThCLHVCQUF1QixTQUFTO0FBQUEsRUFDckYsYUFBYTtBQUFBLEVBQ2IsWUFBWSx1QkFBdUI7QUFBQSxFQUNuQyxXQUFXO0FBQUEsRUFDWCxhQUFhO0FBQ2QsQ0FBQztBQTVFVyw0QkFBTjtBQUFBLEVBT0o7QUFBQSxHQVBVOyIsCiAgIm5hbWVzIjogW10KfQo=
