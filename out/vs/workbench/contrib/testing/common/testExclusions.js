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
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { MutableObservableValue } from "./observableValue.js";
import { StoredValue } from "./storedValue.js";
let TestExclusions = class extends Disposable {
  constructor(storageService) {
    super();
    this.storageService = storageService;
    this.excluded = this._register(
      MutableObservableValue.stored(new StoredValue({
        key: "excludedTestItems",
        scope: StorageScope.WORKSPACE,
        target: StorageTarget.MACHINE,
        serialization: {
          deserialize: (v) => new Set(JSON.parse(v)),
          serialize: (v) => JSON.stringify([...v])
        }
      }, this.storageService), /* @__PURE__ */ new Set())
    );
    /**
     * Event that fires when the excluded tests change.
     */
    this.onTestExclusionsChanged = this.excluded.onDidChange;
  }
  /**
   * Gets whether there's any excluded tests.
   */
  get hasAny() {
    return this.excluded.value.size > 0;
  }
  /**
   * Gets all excluded tests.
   */
  get all() {
    return this.excluded.value;
  }
  /**
   * Sets whether a test is excluded.
   */
  toggle(test, exclude) {
    if (exclude !== true && this.excluded.value.has(test.item.extId)) {
      this.excluded.value = new Set(Iterable.filter(this.excluded.value, (e) => e !== test.item.extId));
    } else if (exclude !== false && !this.excluded.value.has(test.item.extId)) {
      this.excluded.value = /* @__PURE__ */ new Set([...this.excluded.value, test.item.extId]);
    }
  }
  /**
   * Gets whether a test is excluded.
   */
  contains(test) {
    return this.excluded.value.has(test.item.extId);
  }
  /**
   * Removes all test exclusions.
   */
  clear() {
    this.excluded.value = /* @__PURE__ */ new Set();
  }
};
TestExclusions = __decorateClass([
  __decorateParam(0, IStorageService)
], TestExclusions);
export {
  TestExclusions
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi90ZXN0RXhjbHVzaW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBNdXRhYmxlT2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi9vYnNlcnZhYmxlVmFsdWUuanMnO1xuaW1wb3J0IHsgU3RvcmVkVmFsdWUgfSBmcm9tICcuL3N0b3JlZFZhbHVlLmpzJztcbmltcG9ydCB7IEludGVybmFsVGVzdEl0ZW0gfSBmcm9tICcuL3Rlc3RUeXBlcy5qcyc7XG5cbmV4cG9ydCBjbGFzcyBUZXN0RXhjbHVzaW9ucyBleHRlbmRzIERpc3Bvc2FibGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IGV4Y2x1ZGVkID0gdGhpcy5fcmVnaXN0ZXIoXG5cdFx0TXV0YWJsZU9ic2VydmFibGVWYWx1ZS5zdG9yZWQobmV3IFN0b3JlZFZhbHVlPFJlYWRvbmx5U2V0PHN0cmluZz4+KHtcblx0XHRcdGtleTogJ2V4Y2x1ZGVkVGVzdEl0ZW1zJyxcblx0XHRcdHNjb3BlOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLFxuXHRcdFx0dGFyZ2V0OiBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUsXG5cdFx0XHRzZXJpYWxpemF0aW9uOiB7XG5cdFx0XHRcdGRlc2VyaWFsaXplOiB2ID0+IG5ldyBTZXQoSlNPTi5wYXJzZSh2KSksXG5cdFx0XHRcdHNlcmlhbGl6ZTogdiA9PiBKU09OLnN0cmluZ2lmeShbLi4udl0pXG5cdFx0XHR9LFxuXHRcdH0sIHRoaXMuc3RvcmFnZVNlcnZpY2UpLCBuZXcgU2V0KCkpXG5cdCk7XG5cblx0Y29uc3RydWN0b3IoQElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEV2ZW50IHRoYXQgZmlyZXMgd2hlbiB0aGUgZXhjbHVkZWQgdGVzdHMgY2hhbmdlLlxuXHQgKi9cblx0cHVibGljIHJlYWRvbmx5IG9uVGVzdEV4Y2x1c2lvbnNDaGFuZ2VkOiBFdmVudDx1bmtub3duPiA9IHRoaXMuZXhjbHVkZWQub25EaWRDaGFuZ2U7XG5cblx0LyoqXG5cdCAqIEdldHMgd2hldGhlciB0aGVyZSdzIGFueSBleGNsdWRlZCB0ZXN0cy5cblx0ICovXG5cdHB1YmxpYyBnZXQgaGFzQW55KCkge1xuXHRcdHJldHVybiB0aGlzLmV4Y2x1ZGVkLnZhbHVlLnNpemUgPiAwO1xuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgYWxsIGV4Y2x1ZGVkIHRlc3RzLlxuXHQgKi9cblx0cHVibGljIGdldCBhbGwoKTogSXRlcmFibGU8c3RyaW5nPiB7XG5cdFx0cmV0dXJuIHRoaXMuZXhjbHVkZWQudmFsdWU7XG5cdH1cblxuXHQvKipcblx0ICogU2V0cyB3aGV0aGVyIGEgdGVzdCBpcyBleGNsdWRlZC5cblx0ICovXG5cdHB1YmxpYyB0b2dnbGUodGVzdDogSW50ZXJuYWxUZXN0SXRlbSwgZXhjbHVkZT86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAoZXhjbHVkZSAhPT0gdHJ1ZSAmJiB0aGlzLmV4Y2x1ZGVkLnZhbHVlLmhhcyh0ZXN0Lml0ZW0uZXh0SWQpKSB7XG5cdFx0XHR0aGlzLmV4Y2x1ZGVkLnZhbHVlID0gbmV3IFNldChJdGVyYWJsZS5maWx0ZXIodGhpcy5leGNsdWRlZC52YWx1ZSwgZSA9PiBlICE9PSB0ZXN0Lml0ZW0uZXh0SWQpKTtcblx0XHR9IGVsc2UgaWYgKGV4Y2x1ZGUgIT09IGZhbHNlICYmICF0aGlzLmV4Y2x1ZGVkLnZhbHVlLmhhcyh0ZXN0Lml0ZW0uZXh0SWQpKSB7XG5cdFx0XHR0aGlzLmV4Y2x1ZGVkLnZhbHVlID0gbmV3IFNldChbLi4udGhpcy5leGNsdWRlZC52YWx1ZSwgdGVzdC5pdGVtLmV4dElkXSk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEdldHMgd2hldGhlciBhIHRlc3QgaXMgZXhjbHVkZWQuXG5cdCAqL1xuXHRwdWJsaWMgY29udGFpbnModGVzdDogSW50ZXJuYWxUZXN0SXRlbSk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmV4Y2x1ZGVkLnZhbHVlLmhhcyh0ZXN0Lml0ZW0uZXh0SWQpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlbW92ZXMgYWxsIHRlc3QgZXhjbHVzaW9ucy5cblx0ICovXG5cdHB1YmxpYyBjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLmV4Y2x1ZGVkLnZhbHVlID0gbmV3IFNldCgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQU1BLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsbUJBQW1CO0FBR3JCLElBQU0saUJBQU4sY0FBNkIsV0FBVztBQUFBLEVBYTlDLFlBQThDLGdCQUFpQztBQUM5RSxVQUFNO0FBRHVDO0FBWjlDLFNBQWlCLFdBQVcsS0FBSztBQUFBLE1BQ2hDLHVCQUF1QixPQUFPLElBQUksWUFBaUM7QUFBQSxRQUNsRSxLQUFLO0FBQUEsUUFDTCxPQUFPLGFBQWE7QUFBQSxRQUNwQixRQUFRLGNBQWM7QUFBQSxRQUN0QixlQUFlO0FBQUEsVUFDZCxhQUFhLE9BQUssSUFBSSxJQUFJLEtBQUssTUFBTSxDQUFDLENBQUM7QUFBQSxVQUN2QyxXQUFXLE9BQUssS0FBSyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUM7QUFBQSxRQUN0QztBQUFBLE1BQ0QsR0FBRyxLQUFLLGNBQWMsR0FBRyxvQkFBSSxJQUFJLENBQUM7QUFBQSxJQUNuQztBQVNBO0FBQUE7QUFBQTtBQUFBLFNBQWdCLDBCQUEwQyxLQUFLLFNBQVM7QUFBQSxFQUx4RTtBQUFBO0FBQUE7QUFBQTtBQUFBLEVBVUEsSUFBVyxTQUFTO0FBQ25CLFdBQU8sS0FBSyxTQUFTLE1BQU0sT0FBTztBQUFBLEVBQ25DO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLQSxJQUFXLE1BQXdCO0FBQ2xDLFdBQU8sS0FBSyxTQUFTO0FBQUEsRUFDdEI7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtPLE9BQU8sTUFBd0IsU0FBeUI7QUFDOUQsUUFBSSxZQUFZLFFBQVEsS0FBSyxTQUFTLE1BQU0sSUFBSSxLQUFLLEtBQUssS0FBSyxHQUFHO0FBQ2pFLFdBQUssU0FBUyxRQUFRLElBQUksSUFBSSxTQUFTLE9BQU8sS0FBSyxTQUFTLE9BQU8sT0FBSyxNQUFNLEtBQUssS0FBSyxLQUFLLENBQUM7QUFBQSxJQUMvRixXQUFXLFlBQVksU0FBUyxDQUFDLEtBQUssU0FBUyxNQUFNLElBQUksS0FBSyxLQUFLLEtBQUssR0FBRztBQUMxRSxXQUFLLFNBQVMsUUFBUSxvQkFBSSxJQUFJLENBQUMsR0FBRyxLQUFLLFNBQVMsT0FBTyxLQUFLLEtBQUssS0FBSyxDQUFDO0FBQUEsSUFDeEU7QUFBQSxFQUNEO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLTyxTQUFTLE1BQWlDO0FBQ2hELFdBQU8sS0FBSyxTQUFTLE1BQU0sSUFBSSxLQUFLLEtBQUssS0FBSztBQUFBLEVBQy9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLTyxRQUFjO0FBQ3BCLFNBQUssU0FBUyxRQUFRLG9CQUFJLElBQUk7QUFBQSxFQUMvQjtBQUNEO0FBNURhLGlCQUFOO0FBQUEsRUFhTztBQUFBLEdBYkQ7IiwKICAibmFtZXMiOiBbXQp9Cg==
