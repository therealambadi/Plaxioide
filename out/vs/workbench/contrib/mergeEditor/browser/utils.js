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
import { ArrayQueue, CompareResult } from "../../../../base/common/arrays.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorunOpts } from "../../../../base/common/observable.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
function setStyle(element, style) {
  Object.entries(style).forEach(([key, value]) => {
    element.style.setProperty(key, toSize(value));
  });
}
function toSize(value) {
  return typeof value === "number" ? `${value}px` : value;
}
function applyObservableDecorations(editor, decorations) {
  const d = new DisposableStore();
  let decorationIds = [];
  d.add(autorunOpts({ debugName: () => `Apply decorations from ${decorations.debugName}` }, (reader) => {
    const d2 = decorations.read(reader);
    editor.changeDecorations((a) => {
      decorationIds = a.deltaDecorations(decorationIds, d2);
    });
  }));
  d.add({
    dispose: () => {
      editor.changeDecorations((a) => {
        decorationIds = a.deltaDecorations(decorationIds, []);
      });
    }
  });
  return d;
}
function* leftJoin(left, right, compare) {
  const rightQueue = new ArrayQueue(right);
  for (const leftElement of left) {
    rightQueue.takeWhile((rightElement) => CompareResult.isGreaterThan(compare(leftElement, rightElement)));
    const equals = rightQueue.takeWhile((rightElement) => CompareResult.isNeitherLessOrGreaterThan(compare(leftElement, rightElement)));
    yield { left: leftElement, rights: equals || [] };
  }
}
function* join(left, right, compare) {
  const rightQueue = new ArrayQueue(right);
  for (const leftElement of left) {
    const skipped = rightQueue.takeWhile((rightElement) => CompareResult.isGreaterThan(compare(leftElement, rightElement)));
    if (skipped) {
      yield { rights: skipped };
    }
    const equals = rightQueue.takeWhile((rightElement) => CompareResult.isNeitherLessOrGreaterThan(compare(leftElement, rightElement)));
    yield { left: leftElement, rights: equals || [] };
  }
}
function concatArrays(...arrays) {
  return [].concat(...arrays);
}
function elementAtOrUndefined(arr, index) {
  return arr[index];
}
function setFields(obj, fields) {
  return Object.assign(obj, fields);
}
function deepMerge(source1, source2) {
  const result = {};
  for (const key in source1) {
    result[key] = source1[key];
  }
  for (const key in source2) {
    const source2Value = source2[key];
    if (typeof result[key] === "object" && source2Value && typeof source2Value === "object") {
      result[key] = deepMerge(result[key], source2Value);
    } else {
      result[key] = source2Value;
    }
  }
  return result;
}
let PersistentStore = class {
  constructor(key, storageService) {
    this.key = key;
    this.storageService = storageService;
    this.hasValue = false;
    this.value = void 0;
  }
  get() {
    if (!this.hasValue) {
      const value = this.storageService.get(this.key, StorageScope.PROFILE);
      if (value !== void 0) {
        try {
          this.value = JSON.parse(value);
        } catch (e) {
          onUnexpectedError(e);
        }
      }
      this.hasValue = true;
    }
    return this.value;
  }
  set(newValue) {
    this.value = newValue;
    this.storageService.store(
      this.key,
      JSON.stringify(this.value),
      StorageScope.PROFILE,
      StorageTarget.USER
    );
  }
};
PersistentStore = __decorateClass([
  __decorateParam(1, IStorageService)
], PersistentStore);
export {
  PersistentStore,
  applyObservableDecorations,
  concatArrays,
  deepMerge,
  elementAtOrUndefined,
  join,
  leftJoin,
  setFields,
  setStyle
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tZXJnZUVkaXRvci9icm93c2VyL3V0aWxzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgQXJyYXlRdWV1ZSwgQ29tcGFyZVJlc3VsdCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUsIElEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBhdXRvcnVuT3B0cyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgQ29kZUVkaXRvcldpZGdldCB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL3dpZGdldC9jb2RlRWRpdG9yL2NvZGVFZGl0b3JXaWRnZXQuanMnO1xuaW1wb3J0IHsgSU1vZGVsRGVsdGFEZWNvcmF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gc2V0U3R5bGUoXG5cdGVsZW1lbnQ6IEhUTUxFbGVtZW50LFxuXHRzdHlsZToge1xuXHRcdHdpZHRoPzogbnVtYmVyIHwgc3RyaW5nO1xuXHRcdGhlaWdodD86IG51bWJlciB8IHN0cmluZztcblx0XHRsZWZ0PzogbnVtYmVyIHwgc3RyaW5nO1xuXHRcdHRvcD86IG51bWJlciB8IHN0cmluZztcblx0fVxuKTogdm9pZCB7XG5cdE9iamVjdC5lbnRyaWVzKHN0eWxlKS5mb3JFYWNoKChba2V5LCB2YWx1ZV0pID0+IHtcblx0XHRlbGVtZW50LnN0eWxlLnNldFByb3BlcnR5KGtleSwgdG9TaXplKHZhbHVlKSk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB0b1NpemUodmFsdWU6IG51bWJlciB8IHN0cmluZyk6IHN0cmluZyB7XG5cdHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdudW1iZXInID8gYCR7dmFsdWV9cHhgIDogdmFsdWU7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBhcHBseU9ic2VydmFibGVEZWNvcmF0aW9ucyhlZGl0b3I6IENvZGVFZGl0b3JXaWRnZXQsIGRlY29yYXRpb25zOiBJT2JzZXJ2YWJsZTxJTW9kZWxEZWx0YURlY29yYXRpb25bXT4pOiBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0IGQgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdGxldCBkZWNvcmF0aW9uSWRzOiBzdHJpbmdbXSA9IFtdO1xuXHRkLmFkZChhdXRvcnVuT3B0cyh7IGRlYnVnTmFtZTogKCkgPT4gYEFwcGx5IGRlY29yYXRpb25zIGZyb20gJHtkZWNvcmF0aW9ucy5kZWJ1Z05hbWV9YCB9LCByZWFkZXIgPT4ge1xuXHRcdGNvbnN0IGQgPSBkZWNvcmF0aW9ucy5yZWFkKHJlYWRlcik7XG5cdFx0ZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKGEgPT4ge1xuXHRcdFx0ZGVjb3JhdGlvbklkcyA9IGEuZGVsdGFEZWNvcmF0aW9ucyhkZWNvcmF0aW9uSWRzLCBkKTtcblx0XHR9KTtcblx0fSkpO1xuXHRkLmFkZCh7XG5cdFx0ZGlzcG9zZTogKCkgPT4ge1xuXHRcdFx0ZWRpdG9yLmNoYW5nZURlY29yYXRpb25zKGEgPT4ge1xuXHRcdFx0XHRkZWNvcmF0aW9uSWRzID0gYS5kZWx0YURlY29yYXRpb25zKGRlY29yYXRpb25JZHMsIFtdKTtcblx0XHRcdH0pO1xuXHRcdH1cblx0fSk7XG5cdHJldHVybiBkO1xufVxuXG5leHBvcnQgZnVuY3Rpb24qIGxlZnRKb2luPFRMZWZ0LCBUUmlnaHQ+KFxuXHRsZWZ0OiBJdGVyYWJsZTxUTGVmdD4sXG5cdHJpZ2h0OiByZWFkb25seSBUUmlnaHRbXSxcblx0Y29tcGFyZTogKGxlZnQ6IFRMZWZ0LCByaWdodDogVFJpZ2h0KSA9PiBDb21wYXJlUmVzdWx0LFxuKTogSXRlcmFibGVJdGVyYXRvcjx7IGxlZnQ6IFRMZWZ0OyByaWdodHM6IFRSaWdodFtdIH0+IHtcblx0Y29uc3QgcmlnaHRRdWV1ZSA9IG5ldyBBcnJheVF1ZXVlKHJpZ2h0KTtcblx0Zm9yIChjb25zdCBsZWZ0RWxlbWVudCBvZiBsZWZ0KSB7XG5cdFx0cmlnaHRRdWV1ZS50YWtlV2hpbGUocmlnaHRFbGVtZW50ID0+IENvbXBhcmVSZXN1bHQuaXNHcmVhdGVyVGhhbihjb21wYXJlKGxlZnRFbGVtZW50LCByaWdodEVsZW1lbnQpKSk7XG5cdFx0Y29uc3QgZXF1YWxzID0gcmlnaHRRdWV1ZS50YWtlV2hpbGUocmlnaHRFbGVtZW50ID0+IENvbXBhcmVSZXN1bHQuaXNOZWl0aGVyTGVzc09yR3JlYXRlclRoYW4oY29tcGFyZShsZWZ0RWxlbWVudCwgcmlnaHRFbGVtZW50KSkpO1xuXHRcdHlpZWxkIHsgbGVmdDogbGVmdEVsZW1lbnQsIHJpZ2h0czogZXF1YWxzIHx8IFtdIH07XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uKiBqb2luPFRMZWZ0LCBUUmlnaHQ+KFxuXHRsZWZ0OiBJdGVyYWJsZTxUTGVmdD4sXG5cdHJpZ2h0OiByZWFkb25seSBUUmlnaHRbXSxcblx0Y29tcGFyZTogKGxlZnQ6IFRMZWZ0LCByaWdodDogVFJpZ2h0KSA9PiBDb21wYXJlUmVzdWx0LFxuKTogSXRlcmFibGVJdGVyYXRvcjx7IGxlZnQ/OiBUTGVmdDsgcmlnaHRzOiBUUmlnaHRbXSB9PiB7XG5cdGNvbnN0IHJpZ2h0UXVldWUgPSBuZXcgQXJyYXlRdWV1ZShyaWdodCk7XG5cdGZvciAoY29uc3QgbGVmdEVsZW1lbnQgb2YgbGVmdCkge1xuXHRcdGNvbnN0IHNraXBwZWQgPSByaWdodFF1ZXVlLnRha2VXaGlsZShyaWdodEVsZW1lbnQgPT4gQ29tcGFyZVJlc3VsdC5pc0dyZWF0ZXJUaGFuKGNvbXBhcmUobGVmdEVsZW1lbnQsIHJpZ2h0RWxlbWVudCkpKTtcblx0XHRpZiAoc2tpcHBlZCkge1xuXHRcdFx0eWllbGQgeyByaWdodHM6IHNraXBwZWQgfTtcblx0XHR9XG5cdFx0Y29uc3QgZXF1YWxzID0gcmlnaHRRdWV1ZS50YWtlV2hpbGUocmlnaHRFbGVtZW50ID0+IENvbXBhcmVSZXN1bHQuaXNOZWl0aGVyTGVzc09yR3JlYXRlclRoYW4oY29tcGFyZShsZWZ0RWxlbWVudCwgcmlnaHRFbGVtZW50KSkpO1xuXHRcdHlpZWxkIHsgbGVmdDogbGVmdEVsZW1lbnQsIHJpZ2h0czogZXF1YWxzIHx8IFtdIH07XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbmNhdEFycmF5czxUQXJyIGV4dGVuZHMgYW55W10+KC4uLmFycmF5czogVEFycik6IFRBcnJbbnVtYmVyXVtudW1iZXJdW10ge1xuXHRyZXR1cm4gKFtdIGFzIGFueVtdKS5jb25jYXQoLi4uYXJyYXlzKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGVsZW1lbnRBdE9yVW5kZWZpbmVkPFQ+KGFycjogVFtdLCBpbmRleDogbnVtYmVyKTogVCB8IHVuZGVmaW5lZCB7XG5cdHJldHVybiBhcnJbaW5kZXhdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gc2V0RmllbGRzPFQgZXh0ZW5kcyB7fT4ob2JqOiBULCBmaWVsZHM6IFBhcnRpYWw8VD4pOiBUIHtcblx0cmV0dXJuIE9iamVjdC5hc3NpZ24ob2JqLCBmaWVsZHMpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZGVlcE1lcmdlPFQgZXh0ZW5kcyB7fT4oc291cmNlMTogVCwgc291cmNlMjogUGFydGlhbDxUPik6IFQge1xuXHRjb25zdCByZXN1bHQgPSB7fSBhcyBhbnkgYXMgVDtcblx0Zm9yIChjb25zdCBrZXkgaW4gc291cmNlMSkge1xuXHRcdHJlc3VsdFtrZXldID0gc291cmNlMVtrZXldO1xuXHR9XG5cdGZvciAoY29uc3Qga2V5IGluIHNvdXJjZTIpIHtcblx0XHRjb25zdCBzb3VyY2UyVmFsdWUgPSBzb3VyY2UyW2tleV07XG5cdFx0aWYgKHR5cGVvZiByZXN1bHRba2V5XSA9PT0gJ29iamVjdCcgJiYgc291cmNlMlZhbHVlICYmIHR5cGVvZiBzb3VyY2UyVmFsdWUgPT09ICdvYmplY3QnKSB7XG5cdFx0XHRyZXN1bHRba2V5XSA9IGRlZXBNZXJnZTxhbnk+KHJlc3VsdFtrZXldLCBzb3VyY2UyVmFsdWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHRba2V5XSA9IHNvdXJjZTJWYWx1ZSBhcyBhbnk7XG5cdFx0fVxuXHR9XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbmV4cG9ydCBjbGFzcyBQZXJzaXN0ZW50U3RvcmU8VD4ge1xuXHRwcml2YXRlIGhhc1ZhbHVlID0gZmFsc2U7XG5cdHByaXZhdGUgdmFsdWU6IFJlYWRvbmx5PFQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkga2V5OiBzdHJpbmcsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2Vcblx0KSB7IH1cblxuXHRwdWJsaWMgZ2V0KCk6IFJlYWRvbmx5PFQ+IHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoIXRoaXMuaGFzVmFsdWUpIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5zdG9yYWdlU2VydmljZS5nZXQodGhpcy5rZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFKTtcblx0XHRcdGlmICh2YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0dGhpcy52YWx1ZSA9IEpTT04ucGFyc2UodmFsdWUpIGFzIGFueTtcblx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHR0aGlzLmhhc1ZhbHVlID0gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy52YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBzZXQobmV3VmFsdWU6IFQgfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHR0aGlzLnZhbHVlID0gbmV3VmFsdWU7XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKFxuXHRcdFx0dGhpcy5rZXksXG5cdFx0XHRKU09OLnN0cmluZ2lmeSh0aGlzLnZhbHVlKSxcblx0XHRcdFN0b3JhZ2VTY29wZS5QUk9GSUxFLFxuXHRcdFx0U3RvcmFnZVRhcmdldC5VU0VSXG5cdFx0KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFlBQVkscUJBQXFCO0FBQzFDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsdUJBQW9DO0FBQzdDLFNBQXNCLG1CQUFtQjtBQUd6QyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUV0RCxTQUFTLFNBQ2YsU0FDQSxPQU1PO0FB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
