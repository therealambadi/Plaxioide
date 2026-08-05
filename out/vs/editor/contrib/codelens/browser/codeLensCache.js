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
import { Event } from "../../../../base/common/event.js";
import { LRUCache } from "../../../../base/common/map.js";
import { Range } from "../../../common/core/range.js";
import { CodeLensModel } from "./codelens.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget, WillSaveStateReason } from "../../../../platform/storage/common/storage.js";
import { mainWindow } from "../../../../base/browser/window.js";
import { runWhenWindowIdle } from "../../../../base/browser/dom.js";
const ICodeLensCache = createDecorator("ICodeLensCache");
class CacheItem {
  constructor(lineCount, data) {
    this.lineCount = lineCount;
    this.data = data;
  }
}
let CodeLensCache = class {
  constructor(storageService) {
    this._fakeProvider = new class {
      provideCodeLenses() {
        throw new Error("not supported");
      }
    }();
    this._cache = new LRUCache(20, 0.75);
    const oldkey = "codelens/cache";
    runWhenWindowIdle(mainWindow, () => storageService.remove(oldkey, StorageScope.WORKSPACE));
    const key = "codelens/cache2";
    const raw = storageService.get(key, StorageScope.WORKSPACE, "{}");
    this._deserialize(raw);
    const onWillSaveStateBecauseOfShutdown = Event.filter(storageService.onWillSaveState, (e) => e.reason === WillSaveStateReason.SHUTDOWN);
    Event.once(onWillSaveStateBecauseOfShutdown)((e) => {
      storageService.store(key, this._serialize(), StorageScope.WORKSPACE, StorageTarget.MACHINE);
    });
  }
  put(model, data) {
    const copyItems = data.lenses.map((item2) => {
      return {
        range: item2.symbol.range,
        command: item2.symbol.command && { id: "", title: item2.symbol.command?.title }
      };
    });
    const copyModel = new CodeLensModel();
    copyModel.add({ lenses: copyItems }, this._fakeProvider);
    const item = new CacheItem(model.getLineCount(), copyModel);
    this._cache.set(model.uri.toString(), item);
  }
  get(model) {
    const item = this._cache.get(model.uri.toString());
    return item && item.lineCount === model.getLineCount() ? item.data : void 0;
  }
  delete(model) {
    this._cache.delete(model.uri.toString());
  }
  // --- persistence
  _serialize() {
    const data = /* @__PURE__ */ Object.create(null);
    for (const [key, value] of this._cache) {
      const lines = /* @__PURE__ */ new Set();
      for (const d of value.data.lenses) {
        lines.add(d.symbol.range.startLineNumber);
      }
      data[key] = {
        lineCount: value.lineCount,
        lines: [...lines.values()]
      };
    }
    return JSON.stringify(data);
  }
  _deserialize(raw) {
    try {
      const data = JSON.parse(raw);
      for (const key in data) {
        const element = data[key];
        const lenses = [];
        for (const line of element.lines) {
          lenses.push({ range: new Range(line, 1, line, 11) });
        }
        const model = new CodeLensModel();
        model.add({ lenses }, this._fakeProvider);
        this._cache.set(key, new CacheItem(element.lineCount, model));
      }
    } catch {
    }
  }
};
CodeLensCache = __decorateClass([
  __decorateParam(0, IStorageService)
], CodeLensCache);
registerSingleton(ICodeLensCache, CodeLensCache, InstantiationType.Delayed);
export {
  CodeLensCache,
  ICodeLensCache
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29udHJpYi9jb2RlbGVucy9icm93c2VyL2NvZGVMZW5zQ2FjaGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IExSVUNhY2hlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbWFwLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgSVRleHRNb2RlbCB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBDb2RlTGVucywgQ29kZUxlbnNMaXN0LCBDb2RlTGVuc1Byb3ZpZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBDb2RlTGVuc01vZGVsIH0gZnJvbSAnLi9jb2RlbGVucy5qcyc7XG5pbXBvcnQgeyBJbnN0YW50aWF0aW9uVHlwZSwgcmVnaXN0ZXJTaW5nbGV0b24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQsIFdpbGxTYXZlU3RhdGVSZWFzb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IG1haW5XaW5kb3cgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvd2luZG93LmpzJztcbmltcG9ydCB7IHJ1bldoZW5XaW5kb3dJZGxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmV4cG9ydCBjb25zdCBJQ29kZUxlbnNDYWNoZSA9IGNyZWF0ZURlY29yYXRvcjxJQ29kZUxlbnNDYWNoZT4oJ0lDb2RlTGVuc0NhY2hlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvZGVMZW5zQ2FjaGUge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHB1dChtb2RlbDogSVRleHRNb2RlbCwgZGF0YTogQ29kZUxlbnNNb2RlbCk6IHZvaWQ7XG5cdGdldChtb2RlbDogSVRleHRNb2RlbCk6IENvZGVMZW5zTW9kZWwgfCB1bmRlZmluZWQ7XG5cdGRlbGV0ZShtb2RlbDogSVRleHRNb2RlbCk6IHZvaWQ7XG59XG5cbmludGVyZmFjZSBJU2VyaWFsaXplZENhY2hlRGF0YSB7XG5cdGxpbmVDb3VudDogbnVtYmVyO1xuXHRsaW5lczogbnVtYmVyW107XG59XG5cbmNsYXNzIENhY2hlSXRlbSB7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cmVhZG9ubHkgbGluZUNvdW50OiBudW1iZXIsXG5cdFx0cmVhZG9ubHkgZGF0YTogQ29kZUxlbnNNb2RlbFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgQ29kZUxlbnNDYWNoZSBpbXBsZW1lbnRzIElDb2RlTGVuc0NhY2hlIHtcblxuXHRkZWNsYXJlIHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9mYWtlUHJvdmlkZXIgPSBuZXcgY2xhc3MgaW1wbGVtZW50cyBDb2RlTGVuc1Byb3ZpZGVyIHtcblx0XHRwcm92aWRlQ29kZUxlbnNlcygpOiBDb2RlTGVuc0xpc3Qge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3Qgc3VwcG9ydGVkJyk7XG5cdFx0fVxuXHR9O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NhY2hlID0gbmV3IExSVUNhY2hlPHN0cmluZywgQ2FjaGVJdGVtPigyMCwgMC43NSk7XG5cblx0Y29uc3RydWN0b3IoQElTdG9yYWdlU2VydmljZSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlKSB7XG5cblx0XHQvLyByZW1vdmUgb2xkIGRhdGFcblx0XHRjb25zdCBvbGRrZXkgPSAnY29kZWxlbnMvY2FjaGUnO1xuXHRcdHJ1bldoZW5XaW5kb3dJZGxlKG1haW5XaW5kb3csICgpID0+IHN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShvbGRrZXksIFN0b3JhZ2VTY29wZS5XT1JLU1BBQ0UpKTtcblxuXHRcdC8vIHJlc3RvcmUgbGVucyBkYXRhIG9uIHN0YXJ0XG5cdFx0Y29uc3Qga2V5ID0gJ2NvZGVsZW5zL2NhY2hlMic7XG5cdFx0Y29uc3QgcmF3ID0gc3RvcmFnZVNlcnZpY2UuZ2V0KGtleSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSwgJ3t9Jyk7XG5cdFx0dGhpcy5fZGVzZXJpYWxpemUocmF3KTtcblxuXHRcdC8vIHN0b3JlIGxlbnMgZGF0YSBvbiBzaHV0ZG93blxuXHRcdGNvbnN0IG9uV2lsbFNhdmVTdGF0ZUJlY2F1c2VPZlNodXRkb3duID0gRXZlbnQuZmlsdGVyKHN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZSwgZSA9PiBlLnJlYXNvbiA9PT0gV2lsbFNhdmVTdGF0ZVJlYXNvbi5TSFVURE9XTik7XG5cdFx0RXZlbnQub25jZShvbldpbGxTYXZlU3RhdGVCZWNhdXNlT2ZTaHV0ZG93bikoZSA9PiB7XG5cdFx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShrZXksIHRoaXMuX3NlcmlhbGl6ZSgpLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHV0KG1vZGVsOiBJVGV4dE1vZGVsLCBkYXRhOiBDb2RlTGVuc01vZGVsKTogdm9pZCB7XG5cdFx0Ly8gY3JlYXRlIGEgY29weSBvZiB0aGUgbW9kZWwgdGhhdCBpcyB3aXRob3V0IGNvbW1hbmQtaWRzXG5cdFx0Ly8gYnV0IHdpdGggY29tYW5kLWxhYmVsc1xuXHRcdGNvbnN0IGNvcHlJdGVtcyA9IGRhdGEubGVuc2VzLm1hcCgoaXRlbSk6IENvZGVMZW5zID0+IHtcblx0XHRcdHJldHVybiB7XG5cdFx0XHRcdHJhbmdlOiBpdGVtLnN5bWJvbC5yYW5nZSxcblx0XHRcdFx0Y29tbWFuZDogaXRlbS5zeW1ib2wuY29tbWFuZCAmJiB7IGlkOiAnJywgdGl0bGU6IGl0ZW0uc3ltYm9sLmNvbW1hbmQ/LnRpdGxlIH0sXG5cdFx0XHR9O1xuXHRcdH0pO1xuXHRcdGNvbnN0IGNvcHlNb2RlbCA9IG5ldyBDb2RlTGVuc01vZGVsKCk7XG5cdFx0Y29weU1vZGVsLmFkZCh7IGxlbnNlczogY29weUl0ZW1zIH0sIHRoaXMuX2Zha2VQcm92aWRlcik7XG5cblx0XHRjb25zdCBpdGVtID0gbmV3IENhY2hlSXRlbShtb2RlbC5nZXRMaW5lQ291bnQoKSwgY29weU1vZGVsKTtcblx0XHR0aGlzLl9jYWNoZS5zZXQobW9kZWwudXJpLnRvU3RyaW5nKCksIGl0ZW0pO1xuXHR9XG5cblx0Z2V0KG1vZGVsOiBJVGV4dE1vZGVsKSB7XG5cdFx0Y29uc3QgaXRlbSA9IHRoaXMuX2NhY2hlLmdldChtb2RlbC51cmkudG9TdHJpbmcoKSk7XG5cdFx0cmV0dXJuIGl0ZW0gJiYgaXRlbS5saW5lQ291bnQgPT09IG1vZGVsLmdldExpbmVDb3VudCgpID8gaXRlbS5kYXRhIDogdW5kZWZpbmVkO1xuXHR9XG5cblx0ZGVsZXRlKG1vZGVsOiBJVGV4dE1vZGVsKTogdm9pZCB7XG5cdFx0dGhpcy5fY2FjaGUuZGVsZXRlKG1vZGVsLnVyaS50b1N0cmluZygpKTtcblx0fVxuXG5cdC8vIC0tLSBwZXJzaXN0ZW5jZVxuXG5cdHByaXZhdGUgX3NlcmlhbGl6ZSgpOiBzdHJpbmcge1xuXHRcdGNvbnN0IGRhdGE6IFJlY29yZDxzdHJpbmcsIElTZXJpYWxpemVkQ2FjaGVEYXRhPiA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5fY2FjaGUpIHtcblx0XHRcdGNvbnN0IGxpbmVzID0gbmV3IFNldDxudW1iZXI+KCk7XG5cdFx0XHRmb3IgKGNvbnN0IGQgb2YgdmFsdWUuZGF0YS5sZW5zZXMpIHtcblx0XHRcdFx0bGluZXMuYWRkKGQuc3ltYm9sLnJhbmdlLnN0YXJ0TGluZU51bWJlcik7XG5cdFx0XHR9XG5cdFx0XHRkYXRhW2tleV0gPSB7XG5cdFx0XHRcdGxpbmVDb3VudDogdmFsdWUubGluZUNvdW50LFxuXHRcdFx0XHRsaW5lczogWy4uLmxpbmVzLnZhbHVlcygpXVxuXHRcdFx0fTtcblx0XHR9XG5cdFx0cmV0dXJuIEpTT04uc3RyaW5naWZ5KGRhdGEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfZGVzZXJpYWxpemUocmF3OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgZGF0YTogUmVjb3JkPHN0cmluZywgSVNlcmlhbGl6ZWRDYWNoZURhdGE+ID0gSlNPTi5wYXJzZShyYXcpO1xuXHRcdFx0Zm9yIChjb25zdCBrZXkgaW4gZGF0YSkge1xuXHRcdFx0XHRjb25zdCBlbGVtZW50ID0gZGF0YVtrZXldO1xuXHRcdFx0XHRjb25zdCBsZW5zZXM6IENvZGVMZW5zW10gPSBbXTtcblx0XHRcdFx0Zm9yIChjb25zdCBsaW5lIG9mIGVsZW1lbnQubGluZXMpIHtcblx0XHRcdFx0XHRsZW5zZXMucHVzaCh7IHJhbmdlOiBuZXcgUmFuZ2UobGluZSwgMSwgbGluZSwgMTEpIH0pO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgbW9kZWwgPSBuZXcgQ29kZUxlbnNNb2RlbCgpO1xuXHRcdFx0XHRtb2RlbC5hZGQoeyBsZW5zZXMgfSwgdGhpcy5fZmFrZVByb3ZpZGVyKTtcblx0XHRcdFx0dGhpcy5fY2FjaGUuc2V0KGtleSwgbmV3IENhY2hlSXRlbShlbGVtZW50LmxpbmVDb3VudCwgbW9kZWwpKTtcblx0XHRcdH1cblx0XHR9IGNhdGNoIHtcblx0XHRcdC8vIGlnbm9yZS4uLlxuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJQ29kZUxlbnNDYWNoZSwgQ29kZUxlbnNDYWNoZSwgSW5zdGFudGlhdGlvblR5cGUuRGVsYXllZCk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsYUFBYTtBQUN0QixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGFBQWE7QUFHdEIsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsaUJBQWlCLGNBQWMsZUFBZSwyQkFBMkI7QUFDbEYsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyx5QkFBeUI7QUFFM0IsTUFBTSxpQkFBaUIsZ0JBQWdDLGdCQUFnQjtBQWM5RSxNQUFNLFVBQVU7QUFBQSxFQUVmLFlBQ1UsV0FDQSxNQUNSO0FBRlE7QUFDQTtBQUFBLEVBQ047QUFDTDtBQUVPLElBQU0sZ0JBQU4sTUFBOEM7QUFBQSxFQVlwRCxZQUE2QixnQkFBaUM7QUFSOUQsU0FBaUIsZ0JBQWdCLElBQUksTUFBa0M7QUFBQSxNQUN0RSxvQkFBa0M7QUFDakMsY0FBTSxJQUFJLE1BQU0sZUFBZTtBQUFBLE1BQ2hDO0FBQUEsSUFDRDtBQUVBLFNBQWlCLFNBQVMsSUFBSSxTQUE0QixJQUFJLElBQUk7QUFLakUsVUFBTSxTQUFTO0FBQ2Ysc0JBQWtCLFlBQVksTUFBTSxlQUFlLE9BQU8sUUFBUSxhQUFhLFNBQVMsQ0FBQztBQUd6RixVQUFNLE1BQU07QUFDWixVQUFNLE1BQU0sZUFBZSxJQUFJLEtBQUssYUFBYSxXQUFXLElBQUk7QUFDaEUsU0FBSyxhQUFhLEdBQUc7QUFHckIsVUFBTSxtQ0FBbUMsTUFBTSxPQUFPLGVBQWUsaUJBQWlCLE9BQUssRUFBRSxXQUFXLG9CQUFvQixRQUFRO0FBQ3BJLFVBQU0sS0FBSyxnQ0FBZ0MsRUFBRSxPQUFLO0FBQ2pELHFCQUFlLE1BQU0sS0FBSyxLQUFLLFdBQVcsR0FBRyxhQUFhLFdBQVcsY0FBYyxPQUFPO0FBQUEsSUFDM0YsQ0FBQztBQUFBLEVBQ0Y7QUFBQSxFQUVBLElBQUksT0FBbUIsTUFBMkI7QUFHakQsVUFBTSxZQUFZLEtBQUssT0FBTyxJQUFJLENBQUNBLFVBQW1CO0FBQ3JELGFBQU87QUFBQSxRQUNOLE9BQU9BLE1BQUssT0FBTztBQUFBLFFBQ25CLFNBQVNBLE1BQUssT0FBTyxXQUFXLEVBQUUsSUFBSSxJQUFJLE9BQU9BLE1BQUssT0FBTyxTQUFTLE1BQU07QUFBQSxNQUM3RTtBQUFBLElBQ0QsQ0FBQztBQUNELFVBQU0sWUFBWSxJQUFJLGNBQWM7QUFDcEMsY0FBVSxJQUFJLEVBQUUsUUFBUSxVQUFVLEdBQUcsS0FBSyxhQUFhO0FBRXZELFVBQU0sT0FBTyxJQUFJLFVBQVUsTUFBTSxhQUFhLEdBQUcsU0FBUztBQUMxRCxTQUFLLE9BQU8sSUFBSSxNQUFNLElBQUksU0FBUyxHQUFHLElBQUk7QUFBQSxFQUMzQztBQUFBLEVBRUEsSUFBSSxPQUFtQjtBQUN0QixVQUFNLE9BQU8sS0FBSyxPQUFPLElBQUksTUFBTSxJQUFJLFNBQVMsQ0FBQztBQUNqRCxXQUFPLFFBQVEsS0FBSyxjQUFjLE1BQU0sYUFBYSxJQUFJLEtBQUssT0FBTztBQUFBLEVBQ3RFO0FBQUEsRUFFQSxPQUFPLE9BQXlCO0FBQy9CLFNBQUssT0FBTyxPQUFPLE1BQU0sSUFBSSxTQUFTLENBQUM7QUFBQSxFQUN4QztBQUFBO0FBQUEsRUFJUSxhQUFxQjtBQUM1QixVQUFNLE9BQTZDLHVCQUFPLE9BQU8sSUFBSTtBQUNyRSxlQUFXLENBQUMsS0FBSyxLQUFLLEtBQUssS0FBSyxRQUFRO0FBQ3ZDLFlBQU0sUUFBUSxvQkFBSSxJQUFZO0FBQzlCLGlCQUFXLEtBQUssTUFBTSxLQUFLLFFBQVE7QUFDbEMsY0FBTSxJQUFJLEVBQUUsT0FBTyxNQUFNLGVBQWU7QUFBQSxNQUN6QztBQUNBLFdBQUssR0FBRyxJQUFJO0FBQUEsUUFDWCxXQUFXLE1BQU07QUFBQSxRQUNqQixPQUFPLENBQUMsR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUFBLE1BQzFCO0FBQUEsSUFDRDtBQUNBLFdBQU8sS0FBSyxVQUFVLElBQUk7QUFBQSxFQUMzQjtBQUFBLEVBRVEsYUFBYSxLQUFtQjtBQUN2QyxRQUFJO0FBQ0gsWUFBTSxPQUE2QyxLQUFLLE1BQU0sR0FBRztBQUNqRSxpQkFBVyxPQUFPLE1BQU07QUFDdkIsY0FBTSxVQUFVLEtBQUssR0FBRztBQUN4QixjQUFNLFNBQXFCLENBQUM7QUFDNUIsbUJBQVcsUUFBUSxRQUFRLE9BQU87QUFDakMsaUJBQU8sS0FBSyxFQUFFLE9BQU8sSUFBSSxNQUFNLE1BQU0sR0FBRyxNQUFNLEVBQUUsRUFBRSxDQUFDO0FBQUEsUUFDcEQ7QUFFQSxjQUFNLFFBQVEsSUFBSSxjQUFjO0FBQ2hDLGNBQU0sSUFBSSxFQUFFLE9BQU8sR0FBRyxLQUFLLGFBQWE7QUFDeEMsYUFBSyxPQUFPLElBQUksS0FBSyxJQUFJLFVBQVUsUUFBUSxXQUFXLEtBQUssQ0FBQztBQUFBLE1BQzdEO0FBQUEsSUFDRCxRQUFRO0FBQUEsSUFFUjtBQUFBLEVBQ0Q7QUFDRDtBQTFGYSxnQkFBTjtBQUFBLEVBWU87QUFBQSxHQVpEO0FBNEZiLGtCQUFrQixnQkFBZ0IsZUFBZSxrQkFBa0IsT0FBTzsiLAogICJuYW1lcyI6IFsiaXRlbSJdCn0K
