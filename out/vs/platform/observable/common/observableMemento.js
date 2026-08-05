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
import { strictEquals } from "../../../base/common/equals.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { ObservableValue } from "../../../base/common/observableInternal/base.js";
import { DebugNameData } from "../../../base/common/observableInternal/debugName.js";
import { IStorageService } from "../../storage/common/storage.js";
function observableMemento(opts) {
  return (scope, target, storageService) => {
    return new ObservableMemento(opts, scope, target, storageService);
  };
}
let ObservableMemento = class extends ObservableValue {
  constructor(opts, storageScope, storageTarget, storageService) {
    if (opts.defaultValue && typeof opts.defaultValue === "object") {
      opts.toStorage ??= (value) => JSON.stringify(value);
      opts.fromStorage ??= (value) => JSON.parse(value);
    }
    let initialValue = opts.defaultValue;
    const fromStorage = storageService.get(opts.key, storageScope);
    if (fromStorage !== void 0) {
      if (opts.fromStorage) {
        try {
          initialValue = opts.fromStorage(fromStorage);
        } catch {
          initialValue = opts.defaultValue;
        }
      }
    }
    super(new DebugNameData(void 0, `storage/${opts.key}`, void 0), initialValue, strictEquals);
    this._store = new DisposableStore();
    this._didChange = false;
    const didChange = storageService.onDidChangeValue(storageScope, opts.key, this._store);
    this._store.add(didChange((e) => {
      if (e.external && e.key === opts.key && !this._didChange) {
        this.set(opts.defaultValue, void 0);
      }
    }));
    this._store.add(storageService.onWillSaveState(() => {
      if (this._didChange) {
        this._didChange = false;
        const value = this.get();
        if (opts.toStorage) {
          storageService.store(opts.key, opts.toStorage(value), storageScope, storageTarget);
        } else {
          storageService.store(opts.key, String(value), storageScope, storageTarget);
        }
      }
    }));
  }
  _setValue(newValue) {
    super._setValue(newValue);
    this._didChange = true;
  }
  dispose() {
    this._store.dispose();
  }
};
ObservableMemento = __decorateClass([
  __decorateParam(3, IStorageService)
], ObservableMemento);
export {
  ObservableMemento,
  observableMemento
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9wbGF0Zm9ybS9vYnNlcnZhYmxlL2NvbW1vbi9vYnNlcnZhYmxlTWVtZW50by50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHN0cmljdEVxdWFscyB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2VxdWFscy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IE9ic2VydmFibGVWYWx1ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGVJbnRlcm5hbC9iYXNlLmpzJztcbmltcG9ydCB7IERlYnVnTmFtZURhdGEgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlSW50ZXJuYWwvZGVidWdOYW1lLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5cbmludGVyZmFjZSBJT2JzZXJ2YWJsZU1lbWVudG9PcHRzPFQ+IHtcblx0ZGVmYXVsdFZhbHVlOiBUO1xuXHRrZXk6IHN0cmluZztcblx0LyoqIFN0b3JhZ2Ugb3B0aW9ucywgZGVmYXVsdHMgdG8gSlNPTiBzdG9yYWdlIGlmIHRoZSBkZWZhdWx0VmFsdWUgaXMgYW4gb2JqZWN0ICovXG5cdHRvU3RvcmFnZT86ICh2YWx1ZTogVCkgPT4gc3RyaW5nO1xuXHRmcm9tU3RvcmFnZT86ICh2YWx1ZTogc3RyaW5nKSA9PiBUO1xufVxuXG4vKipcbiAqIERlZmluZXMgYW4gb2JzZXJ2YWJsZSBtZW1lbnRvLiBSZXR1cm5zIGEgZnVuY3Rpb24gdGhhdCBjYW4gYmUgY2FsbGVkIHdpdGhcbiAqIHRoZSBzcGVjaWZpYyBzdG9yYWdlIHNjb3BlLCB0YXJnZXQsIGFuZCBzZXJ2aWNlIHRvIHVzZSBpbiBhIGNsYXNzLlxuICpcbiAqIE5vdGUgdGhhdCB0aGUgcmV0dXJuZWQgT2JzZXJ2YWJsZSBpcyBhIGRpc3Bvc2FibGUsIGJlY2F1c2UgaXQgaW50ZXJhY3RzXG4gKiB3aXRoIHN0b3JhZ2Ugc2VydmljZSBldmVudHMsIGFuZCBtdXN0IGJlIHRyYWNrZWQgYXBwcm9wcmlhdGVseS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG9ic2VydmFibGVNZW1lbnRvPFQ+KG9wdHM6IElPYnNlcnZhYmxlTWVtZW50b09wdHM8VD4pIHtcblx0cmV0dXJuIChzY29wZTogU3RvcmFnZVNjb3BlLCB0YXJnZXQ6IFN0b3JhZ2VUYXJnZXQsIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpOiBPYnNlcnZhYmxlTWVtZW50bzxUPiA9PiB7XG5cdFx0cmV0dXJuIG5ldyBPYnNlcnZhYmxlTWVtZW50bzxUPihvcHRzLCBzY29wZSwgdGFyZ2V0LCBzdG9yYWdlU2VydmljZSk7XG5cdH07XG59XG5cbi8qKlxuICogQSB2YWx1ZSB0aGF0IGlzIHN0b3JlZCwgYW5kIGlzIGFsc28gb2JzZXJ2YWJsZS4gTm90ZTogVCBzaG91bGQgYmUgcmVhZG9ubHkuXG4gKi9cbmV4cG9ydCBjbGFzcyBPYnNlcnZhYmxlTWVtZW50bzxUPiBleHRlbmRzIE9ic2VydmFibGVWYWx1ZTxUPiBpbXBsZW1lbnRzIElEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSByZWFkb25seSBfc3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdHByaXZhdGUgX2RpZENoYW5nZSA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG9wdHM6IElPYnNlcnZhYmxlTWVtZW50b09wdHM8VD4sXG5cdFx0c3RvcmFnZVNjb3BlOiBTdG9yYWdlU2NvcGUsXG5cdFx0c3RvcmFnZVRhcmdldDogU3RvcmFnZVRhcmdldCxcblx0XHRASVN0b3JhZ2VTZXJ2aWNlIHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdGlmIChvcHRzLmRlZmF1bHRWYWx1ZSAmJiB0eXBlb2Ygb3B0cy5kZWZhdWx0VmFsdWUgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRvcHRzLnRvU3RvcmFnZSA/Pz0gKHZhbHVlOiBUKSA9PiBKU09OLnN0cmluZ2lmeSh2YWx1ZSk7XG5cdFx0XHRvcHRzLmZyb21TdG9yYWdlID8/PSAodmFsdWU6IHN0cmluZykgPT4gSlNPTi5wYXJzZSh2YWx1ZSk7XG5cdFx0fVxuXG5cdFx0bGV0IGluaXRpYWxWYWx1ZSA9IG9wdHMuZGVmYXVsdFZhbHVlO1xuXG5cdFx0Y29uc3QgZnJvbVN0b3JhZ2UgPSBzdG9yYWdlU2VydmljZS5nZXQob3B0cy5rZXksIHN0b3JhZ2VTY29wZSk7XG5cdFx0aWYgKGZyb21TdG9yYWdlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdGlmIChvcHRzLmZyb21TdG9yYWdlKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0aW5pdGlhbFZhbHVlID0gb3B0cy5mcm9tU3RvcmFnZShmcm9tU3RvcmFnZSk7XG5cdFx0XHRcdH0gY2F0Y2gge1xuXHRcdFx0XHRcdGluaXRpYWxWYWx1ZSA9IG9wdHMuZGVmYXVsdFZhbHVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0c3VwZXIobmV3IERlYnVnTmFtZURhdGEodW5kZWZpbmVkLCBgc3RvcmFnZS8ke29wdHMua2V5fWAsIHVuZGVmaW5lZCksIGluaXRpYWxWYWx1ZSwgc3RyaWN0RXF1YWxzKTtcblxuXHRcdGNvbnN0IGRpZENoYW5nZSA9IHN0b3JhZ2VTZXJ2aWNlLm9uRGlkQ2hhbmdlVmFsdWUoc3RvcmFnZVNjb3BlLCBvcHRzLmtleSwgdGhpcy5fc3RvcmUpO1xuXHRcdC8vIG9ubHkgdGFrZSBleHRlcm5hbCBjaGFuZ2VzIGlmIHRoZXJlIGFyZW4ndCBsb2NhbCBjaGFuZ2VzIHdlJ3ZlIG1hZGVcblx0XHR0aGlzLl9zdG9yZS5hZGQoZGlkQ2hhbmdlKChlKSA9PiB7XG5cdFx0XHRpZiAoZS5leHRlcm5hbCAmJiBlLmtleSA9PT0gb3B0cy5rZXkgJiYgIXRoaXMuX2RpZENoYW5nZSkge1xuXHRcdFx0XHR0aGlzLnNldChvcHRzLmRlZmF1bHRWYWx1ZSwgdW5kZWZpbmVkKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9zdG9yZS5hZGQoc3RvcmFnZVNlcnZpY2Uub25XaWxsU2F2ZVN0YXRlKCgpID0+IHtcblx0XHRcdGlmICh0aGlzLl9kaWRDaGFuZ2UpIHtcblx0XHRcdFx0dGhpcy5fZGlkQ2hhbmdlID0gZmFsc2U7XG5cdFx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5nZXQoKTtcblx0XHRcdFx0aWYgKG9wdHMudG9TdG9yYWdlKSB7XG5cdFx0XHRcdFx0c3RvcmFnZVNlcnZpY2Uuc3RvcmUob3B0cy5rZXksIG9wdHMudG9TdG9yYWdlKHZhbHVlKSwgc3RvcmFnZVNjb3BlLCBzdG9yYWdlVGFyZ2V0KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRzdG9yYWdlU2VydmljZS5zdG9yZShvcHRzLmtleSwgU3RyaW5nKHZhbHVlKSwgc3RvcmFnZVNjb3BlLCBzdG9yYWdlVGFyZ2V0KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBfc2V0VmFsdWUobmV3VmFsdWU6IFQpOiB2b2lkIHtcblx0XHRzdXBlci5fc2V0VmFsdWUobmV3VmFsdWUpO1xuXHRcdHRoaXMuX2RpZENoYW5nZSA9IHRydWU7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0b3JlLmRpc3Bvc2UoKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLG9CQUFvQjtBQUM3QixTQUFTLHVCQUFvQztBQUM3QyxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHFCQUFxQjtBQUM5QixTQUFTLHVCQUFvRDtBQWlCdEQsU0FBUyxrQkFBcUIsTUFBaUM7QUFDckUsU0FBTyxDQUFDLE9BQXFCLFFBQXVCLG1CQUEwRDtBQUM3RyxXQUFPLElBQUksa0JBQXFCLE1BQU0sT0FBTyxRQUFRLGNBQWM7QUFBQSxFQUNwRTtBQUNEO0FBS08sSUFBTSxvQkFBTixjQUFtQyxnQkFBMEM7QUFBQSxFQUluRixZQUNDLE1BQ0EsY0FDQSxlQUNpQixnQkFDaEI7QUFDRCxRQUFJLEtBQUssZ0JBQWdCLE9BQU8sS0FBSyxpQkFBaUIsVUFBVTtBQUMvRCxXQUFLLGNBQWMsQ0FBQyxVQUFhLEtBQUssVUFBVSxLQUFLO0FBQ3JELFdBQUssZ0JBQWdCLENBQUMsVUFBa0IsS0FBSyxNQUFNLEtBQUs7QUFBQSxJQUN6RDtBQUVBLFFBQUksZUFBZSxLQUFLO0FBRXhCLFVBQU0sY0FBYyxlQUFlLElBQUksS0FBSyxLQUFLLFlBQVk7QUFDN0QsUUFBSSxnQkFBZ0IsUUFBVztBQUM5QixVQUFJLEtBQUssYUFBYTtBQUNyQixZQUFJO0FBQ0gseUJBQWUsS0FBSyxZQUFZLFdBQVc7QUFBQSxRQUM1QyxRQUFRO0FBQ1AseUJBQWUsS0FBSztBQUFBLFFBQ3JCO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLElBQUksY0FBYyxRQUFXLFdBQVcsS0FBSyxHQUFHLElBQUksTUFBUyxHQUFHLGNBQWMsWUFBWTtBQTNCakcsU0FBaUIsU0FBUyxJQUFJLGdCQUFnQjtBQUM5QyxTQUFRLGFBQWE7QUE0QnBCLFVBQU0sWUFBWSxlQUFlLGlCQUFpQixjQUFjLEtBQUssS0FBSyxLQUFLLE1BQU07QUFFckYsU0FBSyxPQUFPLElBQUksVUFBVSxDQUFDLE1BQU07QUFDaEMsVUFBSSxFQUFFLFlBQVksRUFBRSxRQUFRLEtBQUssT0FBTyxDQUFDLEtBQUssWUFBWTtBQUN6RCxhQUFLLElBQUksS0FBSyxjQUFjLE1BQVM7QUFBQSxNQUN0QztBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBRUYsU0FBSyxPQUFPLElBQUksZUFBZSxnQkFBZ0IsTUFBTTtBQUNwRCxVQUFJLEtBQUssWUFBWTtBQUNwQixhQUFLLGFBQWE7QUFDbEIsY0FBTSxRQUFRLEtBQUssSUFBSTtBQUN2QixZQUFJLEtBQUssV0FBVztBQUNuQix5QkFBZSxNQUFNLEtBQUssS0FBSyxLQUFLLFVBQVUsS0FBSyxHQUFHLGNBQWMsYUFBYTtBQUFBLFFBQ2xGLE9BQU87QUFDTix5QkFBZSxNQUFNLEtBQUssS0FBSyxPQUFPLEtBQUssR0FBRyxjQUFjLGFBQWE7QUFBQSxRQUMxRTtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVtQixVQUFVLFVBQW1CO0FBQy9DLFVBQU0sVUFBVSxRQUFRO0FBQ3hCLFNBQUssYUFBYTtBQUFBLEVBQ25CO0FBQUEsRUFFQSxVQUFnQjtBQUNmLFNBQUssT0FBTyxRQUFRO0FBQUEsRUFDckI7QUFDRDtBQTNEYSxvQkFBTjtBQUFBLEVBUUo7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
