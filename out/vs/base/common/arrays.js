import { findFirstIdxMonotonousOrArrLen } from "./arraysFind.js";
import { CancellationError } from "./errors.js";
function tail(arr) {
  if (arr.length === 0) {
    throw new Error("Invalid tail call");
  }
  return [arr.slice(0, arr.length - 1), arr[arr.length - 1]];
}
function equals(one, other, itemEquals = (a, b) => a === b) {
  if (one === other) {
    return true;
  }
  if (!one || !other) {
    return false;
  }
  if (one.length !== other.length) {
    return false;
  }
  for (let i = 0, len = one.length; i < len; i++) {
    if (!itemEquals(one[i], other[i])) {
      return false;
    }
  }
  return true;
}
function removeFastWithoutKeepingOrder(array, index2) {
  const last = array.length - 1;
  if (index2 < last) {
    array[index2] = array[last];
  }
  array.pop();
}
function binarySearch(array, key, comparator) {
  return binarySearch2(array.length, (i) => comparator(array[i], key));
}
function binarySearch2(length, compareToKey) {
  let low = 0, high = length - 1;
  while (low <= high) {
    const mid = (low + high) / 2 | 0;
    const comp = compareToKey(mid);
    if (comp < 0) {
      low = mid + 1;
    } else if (comp > 0) {
      high = mid - 1;
    } else {
      return mid;
    }
  }
  return -(low + 1);
}
function quickSelect(nth, data, compare) {
  nth = nth | 0;
  if (nth >= data.length) {
    throw new TypeError("invalid index");
  }
  const pivotValue = data[Math.floor(data.length * Math.random())];
  const lower = [];
  const higher = [];
  const pivots = [];
  for (const value of data) {
    const val = compare(value, pivotValue);
    if (val < 0) {
      lower.push(value);
    } else if (val > 0) {
      higher.push(value);
    } else {
      pivots.push(value);
    }
  }
  if (nth < lower.length) {
    return quickSelect(nth, lower, compare);
  } else if (nth < lower.length + pivots.length) {
    return pivots[0];
  } else {
    return quickSelect(nth - (lower.length + pivots.length), higher, compare);
  }
}
function groupBy(data, compare) {
  const result = [];
  let currentGroup = void 0;
  for (const element of data.slice(0).sort(compare)) {
    if (!currentGroup || compare(currentGroup[0], element) !== 0) {
      currentGroup = [element];
      result.push(currentGroup);
    } else {
      currentGroup.push(element);
    }
  }
  return result;
}
function* groupAdjacentBy(items, shouldBeGrouped) {
  let currentGroup;
  let last;
  for (const item of items) {
    if (last !== void 0 && shouldBeGrouped(last, item)) {
      currentGroup.push(item);
    } else {
      if (currentGroup) {
        yield currentGroup;
      }
      currentGroup = [item];
    }
    last = item;
  }
  if (currentGroup) {
    yield currentGroup;
  }
}
function forEachAdjacent(arr, f) {
  for (let i = 0; i <= arr.length; i++) {
    f(i === 0 ? void 0 : arr[i - 1], i === arr.length ? void 0 : arr[i]);
  }
}
function forEachWithNeighbors(arr, f) {
  for (let i = 0; i < arr.length; i++) {
    f(i === 0 ? void 0 : arr[i - 1], arr[i], i + 1 === arr.length ? void 0 : arr[i + 1]);
  }
}
function sortedDiff(before, after, compare) {
  const result = [];
  function pushSplice(start, deleteCount, toInsert) {
    if (deleteCount === 0 && toInsert.length === 0) {
      return;
    }
    const latest = result[result.length - 1];
    if (latest && latest.start + latest.deleteCount === start) {
      latest.deleteCount += deleteCount;
      latest.toInsert.push(...toInsert);
    } else {
      result.push({ start, deleteCount, toInsert });
    }
  }
  let beforeIdx = 0;
  let afterIdx = 0;
  while (true) {
    if (beforeIdx === before.length) {
      pushSplice(beforeIdx, 0, after.slice(afterIdx));
      break;
    }
    if (afterIdx === after.length) {
      pushSplice(beforeIdx, before.length - beforeIdx, []);
      break;
    }
    const beforeElement = before[beforeIdx];
    const afterElement = after[afterIdx];
    const n = compare(beforeElement, afterElement);
    if (n === 0) {
      beforeIdx += 1;
      afterIdx += 1;
    } else if (n < 0) {
      pushSplice(beforeIdx, 1, []);
      beforeIdx += 1;
    } else if (n > 0) {
      pushSplice(beforeIdx, 0, [afterElement]);
      afterIdx += 1;
    }
  }
  return result;
}
function delta(before, after, compare) {
  const splices = sortedDiff(before, after, compare);
  const removed = [];
  const added = [];
  for (const splice2 of splices) {
    removed.push(...before.slice(splice2.start, splice2.start + splice2.deleteCount));
    added.push(...splice2.toInsert);
  }
  return { removed, added };
}
function top(array, compare, n) {
  if (n === 0) {
    return [];
  }
  const result = array.slice(0, n).sort(compare);
  topStep(array, compare, result, n, array.length);
  return result;
}
function topAsync(array, compare, n, batch, token) {
  if (n === 0) {
    return Promise.resolve([]);
  }
  return new Promise((resolve, reject) => {
    (async () => {
      const o = array.length;
      const result = array.slice(0, n).sort(compare);
      for (let i = n, m = Math.min(n + batch, o); i < o; i = m, m = Math.min(m + batch, o)) {
        if (i > n) {
          await new Promise((resolve2) => setTimeout(resolve2));
        }
        if (token && token.isCancellationRequested) {
          throw new CancellationError();
        }
        topStep(array, compare, result, i, m);
      }
      return result;
    })().then(resolve, reject);
  });
}
function topStep(array, compare, result, i, m) {
  for (const n = result.length; i < m; i++) {
    const element = array[i];
    if (compare(element, result[n - 1]) < 0) {
      result.pop();
      const j = findFirstIdxMonotonousOrArrLen(result, (e) => compare(element, e) < 0);
      result.splice(j, 0, element);
    }
  }
}
function coalesce(array) {
  return array.filter((e) => !!e);
}
function coalesceInPlace(array) {
  let to = 0;
  for (let i = 0; i < array.length; i++) {
    if (!!array[i]) {
      array[to] = array[i];
      to += 1;
    }
  }
  array.length = to;
}
function move(array, from, to) {
  array.splice(to, 0, array.splice(from, 1)[0]);
}
function isFalsyOrEmpty(obj) {
  return !Array.isArray(obj) || obj.length === 0;
}
function isNonEmptyArray(obj) {
  return Array.isArray(obj) && obj.length > 0;
}
function distinct(array, keyFn = (value) => value) {
  const seen = /* @__PURE__ */ new Set();
  return array.filter((element) => {
    const key = keyFn(element);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
function uniqueFilter(keyFn) {
  const seen = /* @__PURE__ */ new Set();
  return (element) => {
    const key = keyFn(element);
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  };
}
function commonPrefixLength(one, other, equals2 = (a, b) => a === b) {
  let result = 0;
  for (let i = 0, len = Math.min(one.length, other.length); i < len && equals2(one[i], other[i]); i++) {
    result++;
  }
  return result;
}
function range(arg, to) {
  let from = typeof to === "number" ? arg : 0;
  if (typeof to === "number") {
    from = arg;
  } else {
    from = 0;
    to = arg;
  }
  const result = [];
  if (from <= to) {
    for (let i = from; i < to; i++) {
      result.push(i);
    }
  } else {
    for (let i = from; i > to; i--) {
      result.push(i);
    }
  }
  return result;
}
function index(array, indexer, mapper) {
  return array.reduce((r, t) => {
    r[indexer(t)] = mapper ? mapper(t) : t;
    return r;
  }, /* @__PURE__ */ Object.create(null));
}
function insert(array, element) {
  array.push(element);
  return () => remove(array, element);
}
function remove(array, element) {
  const index2 = array.indexOf(element);
  if (index2 > -1) {
    array.splice(index2, 1);
    return element;
  }
  return void 0;
}
function arrayInsert(target, insertIndex, insertArr) {
  const before = target.slice(0, insertIndex);
  const after = target.slice(insertIndex);
  return before.concat(insertArr, after);
}
function shuffle(array, _seed) {
  let rand;
  if (typeof _seed === "number") {
    let seed = _seed;
    rand = () => {
      const x = Math.sin(seed++) * 179426549;
      return x - Math.floor(x);
    };
  } else {
    rand = Math.random;
  }
  for (let i = array.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rand() * (i + 1));
    const temp = array[i];
    array[i] = array[j];
    array[j] = temp;
  }
}
function pushToStart(arr, value) {
  const index2 = arr.indexOf(value);
  if (index2 > -1) {
    arr.splice(index2, 1);
    arr.unshift(value);
  }
}
function pushToEnd(arr, value) {
  const index2 = arr.indexOf(value);
  if (index2 > -1) {
    arr.splice(index2, 1);
    arr.push(value);
  }
}
function pushMany(arr, items) {
  for (const item of items) {
    arr.push(item);
  }
}
function mapArrayOrNot(items, fn) {
  return Array.isArray(items) ? items.map(fn) : fn(items);
}
function asArray(x) {
  return Array.isArray(x) ? x : [x];
}
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function insertInto(array, start, newItems) {
  const startIdx = getActualStartIndex(array, start);
  const originalLength = array.length;
  const newItemsLength = newItems.length;
  array.length = originalLength + newItemsLength;
  for (let i = originalLength - 1; i >= startIdx; i--) {
    array[i + newItemsLength] = array[i];
  }
  for (let i = 0; i < newItemsLength; i++) {
    array[i + startIdx] = newItems[i];
  }
}
function splice(array, start, deleteCount, newItems) {
  const index2 = getActualStartIndex(array, start);
  let result = array.splice(index2, deleteCount);
  if (result === void 0) {
    result = [];
  }
  insertInto(array, index2, newItems);
  return result;
}
function getActualStartIndex(array, start) {
  return start < 0 ? Math.max(start + array.length, 0) : Math.min(start, array.length);
}
const pick = (key) => {
  return (obj) => {
    return obj[key];
  };
};
var CompareResult;
((CompareResult2) => {
  function isLessThan(result) {
    return result < 0;
  }
  CompareResult2.isLessThan = isLessThan;
  function isLessThanOrEqual(result) {
    return result <= 0;
  }
  CompareResult2.isLessThanOrEqual = isLessThanOrEqual;
  function isGreaterThan(result) {
    return result > 0;
  }
  CompareResult2.isGreaterThan = isGreaterThan;
  function isNeitherLessOrGreaterThan(result) {
    return result === 0;
  }
  CompareResult2.isNeitherLessOrGreaterThan = isNeitherLessOrGreaterThan;
  CompareResult2.greaterThan = 1;
  CompareResult2.lessThan = -1;
  CompareResult2.neitherLessOrGreaterThan = 0;
})(CompareResult || (CompareResult = {}));
function compareBy(selector, comparator) {
  return (a, b) => comparator(selector(a), selector(b));
}
function tieBreakComparators(...comparators) {
  return (item1, item2) => {
    for (const comparator of comparators) {
      const result = comparator(item1, item2);
      if (!CompareResult.isNeitherLessOrGreaterThan(result)) {
        return result;
      }
    }
    return CompareResult.neitherLessOrGreaterThan;
  };
}
const numberComparator = (a, b) => a - b;
const booleanComparator = (a, b) => numberComparator(a ? 1 : 0, b ? 1 : 0);
function reverseOrder(comparator) {
  return (a, b) => -comparator(a, b);
}
function compareUndefinedSmallest(comparator) {
  return (a, b) => {
    if (a === void 0) {
      return b === void 0 ? CompareResult.neitherLessOrGreaterThan : CompareResult.lessThan;
    } else if (b === void 0) {
      return CompareResult.greaterThan;
    }
    return comparator(a, b);
  };
}
class ArrayQueue {
  /**
   * Constructs a queue that is backed by the given array. Runtime is O(1).
  */
  constructor(items) {
    this.items = items;
    this.firstIdx = 0;
    this.lastIdx = this.items.length - 1;
  }
  get length() {
    return this.lastIdx - this.firstIdx + 1;
  }
  /**
   * Consumes elements from the beginning of the queue as long as the predicate returns true.
   * If no elements were consumed, `null` is returned. Has a runtime of O(result.length).
  */
  takeWhile(predicate) {
    let startIdx = this.firstIdx;
    while (startIdx < this.items.length && predicate(this.items[startIdx])) {
      startIdx++;
    }
    const result = startIdx === this.firstIdx ? null : this.items.slice(this.firstIdx, startIdx);
    this.firstIdx = startIdx;
    return result;
  }
  /**
   * Consumes elements from the end of the queue as long as the predicate returns true.
   * If no elements were consumed, `null` is returned.
   * The result has the same order as the underlying array!
  */
  takeFromEndWhile(predicate) {
    let endIdx = this.lastIdx;
    while (endIdx >= 0 && predicate(this.items[endIdx])) {
      endIdx--;
    }
    const result = endIdx === this.lastIdx ? null : this.items.slice(endIdx + 1, this.lastIdx + 1);
    this.lastIdx = endIdx;
    return result;
  }
  peek() {
    if (this.length === 0) {
      return void 0;
    }
    return this.items[this.firstIdx];
  }
  peekLast() {
    if (this.length === 0) {
      return void 0;
    }
    return this.items[this.lastIdx];
  }
  dequeue() {
    const result = this.items[this.firstIdx];
    this.firstIdx++;
    return result;
  }
  removeLast() {
    const result = this.items[this.lastIdx];
    this.lastIdx--;
    return result;
  }
  takeCount(count) {
    const result = this.items.slice(this.firstIdx, this.firstIdx + count);
    this.firstIdx += count;
    return result;
  }
}
const _CallbackIterable = class _CallbackIterable {
  constructor(iterate) {
    this.iterate = iterate;
  }
  forEach(handler) {
    this.iterate((item) => {
      handler(item);
      return true;
    });
  }
  toArray() {
    const result = [];
    this.iterate((item) => {
      result.push(item);
      return true;
    });
    return result;
  }
  filter(predicate) {
    return new _CallbackIterable((cb) => this.iterate((item) => predicate(item) ? cb(item) : true));
  }
  map(mapFn) {
    return new _CallbackIterable((cb) => this.iterate((item) => cb(mapFn(item))));
  }
  some(predicate) {
    let result = false;
    this.iterate((item) => {
      result = predicate(item);
      return !result;
    });
    return result;
  }
  findFirst(predicate) {
    let result;
    this.iterate((item) => {
      if (predicate(item)) {
        result = item;
        return false;
      }
      return true;
    });
    return result;
  }
  findLast(predicate) {
    let result;
    this.iterate((item) => {
      if (predicate(item)) {
        result = item;
      }
      return true;
    });
    return result;
  }
  findLastMaxBy(comparator) {
    let result;
    let first = true;
    this.iterate((item) => {
      if (first || CompareResult.isGreaterThan(comparator(item, result))) {
        first = false;
        result = item;
      }
      return true;
    });
    return result;
  }
};
_CallbackIterable.empty = new _CallbackIterable((_callback) => {
});
let CallbackIterable = _CallbackIterable;
class Permutation {
  constructor(_indexMap) {
    this._indexMap = _indexMap;
  }
  /**
   * Returns a permutation that sorts the given array according to the given compare function.
   */
  static createSortPermutation(arr, compareFn) {
    const sortIndices = Array.from(arr.keys()).sort((index1, index2) => compareFn(arr[index1], arr[index2]));
    return new Permutation(sortIndices);
  }
  /**
   * Returns a new array with the elements of the given array re-arranged according to this permutation.
   */
  apply(arr) {
    return arr.map((_, index2) => arr[this._indexMap[index2]]);
  }
  /**
   * Returns a new permutation that undoes the re-arrangement of this permutation.
  */
  inverse() {
    const inverseIndexMap = this._indexMap.slice();
    for (let i = 0; i < this._indexMap.length; i++) {
      inverseIndexMap[this._indexMap[i]] = i;
    }
    return new Permutation(inverseIndexMap);
  }
}
async function findAsync(array, predicate) {
  const results = await Promise.all(array.map(
    async (element, index2) => ({ element, ok: await predicate(element, index2) })
  ));
  return results.find((r) => r.ok)?.element;
}
export {
  ArrayQueue,
  CallbackIterable,
  CompareResult,
  Permutation,
  arrayInsert,
  asArray,
  binarySearch,
  binarySearch2,
  booleanComparator,
  coalesce,
  coalesceInPlace,
  commonPrefixLength,
  compareBy,
  compareUndefinedSmallest,
  delta,
  distinct,
  equals,
  findAsync,
  forEachAdjacent,
  forEachWithNeighbors,
  getRandomElement,
  groupAdjacentBy,
  groupBy,
  index,
  insert,
  insertInto,
  isFalsyOrEmpty,
  isNonEmptyArray,
  mapArrayOrNot,
  move,
  numberComparator,
  pick,
  pushMany,
  pushToEnd,
  pushToStart,
  quickSelect,
  range,
  remove,
  removeFastWithoutKeepingOrder,
  reverseOrder,
  shuffle,
  sortedDiff,
  splice,
  tail,
  tieBreakComparators,
  top,
  topAsync,
  uniqueFilter
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9hcnJheXMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBmaW5kRmlyc3RJZHhNb25vdG9ub3VzT3JBcnJMZW4gfSBmcm9tICcuL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4vZXJyb3JzLmpzJztcbmltcG9ydCB7IElTcGxpY2UgfSBmcm9tICcuL3NlcXVlbmNlLmpzJztcblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBsYXN0IGVudHJ5IGFuZCB0aGUgaW5pdGlhbCBOLTEgZW50cmllcyBvZiB0aGUgYXJyYXksIGFzIGEgdHVwbGUgb2YgW3Jlc3QsIGxhc3RdLlxuICpcbiAqIFRoZSBhcnJheSBtdXN0IGhhdmUgYXQgbGVhc3Qgb25lIGVsZW1lbnQuXG4gKlxuICogQHBhcmFtIGFyciBUaGUgaW5wdXQgYXJyYXlcbiAqIEByZXR1cm5zIEEgdHVwbGUgb2YgW3Jlc3QsIGxhc3RdIHdoZXJlIHJlc3QgaXMgYWxsIGJ1dCB0aGUgbGFzdCBlbGVtZW50IGFuZCBsYXN0IGlzIHRoZSBsYXN0IGVsZW1lbnRcbiAqIEB0aHJvd3MgRXJyb3IgaWYgdGhlIGFycmF5IGlzIGVtcHR5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0YWlsPFQ+KGFycjogVFtdKTogW1RbXSwgVF0ge1xuXHRpZiAoYXJyLmxlbmd0aCA9PT0gMCkge1xuXHRcdHRocm93IG5ldyBFcnJvcignSW52YWxpZCB0YWlsIGNhbGwnKTtcblx0fVxuXG5cdHJldHVybiBbYXJyLnNsaWNlKDAsIGFyci5sZW5ndGggLSAxKSwgYXJyW2Fyci5sZW5ndGggLSAxXV07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBlcXVhbHM8VD4ob25lOiBSZWFkb25seUFycmF5PFQ+IHwgdW5kZWZpbmVkLCBvdGhlcjogUmVhZG9ubHlBcnJheTxUPiB8IHVuZGVmaW5lZCwgaXRlbUVxdWFsczogKGE6IFQsIGI6IFQpID0+IGJvb2xlYW4gPSAoYSwgYikgPT4gYSA9PT0gYik6IGJvb2xlYW4ge1xuXHRpZiAob25lID09PSBvdGhlcikge1xuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0aWYgKCFvbmUgfHwgIW90aGVyKSB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cblx0aWYgKG9uZS5sZW5ndGggIT09IG90aGVyLmxlbmd0aCkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdGZvciAobGV0IGkgPSAwLCBsZW4gPSBvbmUubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRpZiAoIWl0ZW1FcXVhbHMob25lW2ldLCBvdGhlcltpXSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gdHJ1ZTtcbn1cblxuLyoqXG4gKiBSZW1vdmUgdGhlIGVsZW1lbnQgYXQgYGluZGV4YCBieSByZXBsYWNpbmcgaXQgd2l0aCB0aGUgbGFzdCBlbGVtZW50LiBUaGlzIGlzIGZhc3RlciB0aGFuIGBzcGxpY2VgXG4gKiBidXQgY2hhbmdlcyB0aGUgb3JkZXIgb2YgdGhlIGFycmF5XG4gKi9cbmV4cG9ydCBmdW5jdGlvbiByZW1vdmVGYXN0V2l0aG91dEtlZXBpbmdPcmRlcjxUPihhcnJheTogVFtdLCBpbmRleDogbnVtYmVyKSB7XG5cdGNvbnN0IGxhc3QgPSBhcnJheS5sZW5ndGggLSAxO1xuXHRpZiAoaW5kZXggPCBsYXN0KSB7XG5cdFx0YXJyYXlbaW5kZXhdID0gYXJyYXlbbGFzdF07XG5cdH1cblx0YXJyYXkucG9wKCk7XG59XG5cbi8qKlxuICogUGVyZm9ybXMgYSBiaW5hcnkgc2VhcmNoIGFsZ29yaXRobSBvdmVyIGEgc29ydGVkIGFycmF5LlxuICpcbiAqIEBwYXJhbSBhcnJheSBUaGUgYXJyYXkgYmVpbmcgc2VhcmNoZWQuXG4gKiBAcGFyYW0ga2V5IFRoZSB2YWx1ZSB3ZSBzZWFyY2ggZm9yLlxuICogQHBhcmFtIGNvbXBhcmF0b3IgQSBmdW5jdGlvbiB0aGF0IHRha2VzIHR3byBhcnJheSBlbGVtZW50cyBhbmQgcmV0dXJucyB6ZXJvXG4gKiAgIGlmIHRoZXkgYXJlIGVxdWFsLCBhIG5lZ2F0aXZlIG51bWJlciBpZiB0aGUgZmlyc3QgZWxlbWVudCBwcmVjZWRlcyB0aGVcbiAqICAgc2Vjb25kIG9uZSBpbiB0aGUgc29ydGluZyBvcmRlciwgb3IgYSBwb3NpdGl2ZSBudW1iZXIgaWYgdGhlIHNlY29uZCBlbGVtZW50XG4gKiAgIHByZWNlZGVzIHRoZSBmaXJzdCBvbmUuXG4gKiBAcmV0dXJuIFNlZSB7QGxpbmsgYmluYXJ5U2VhcmNoMn1cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGJpbmFyeVNlYXJjaDxUPihhcnJheTogUmVhZG9ubHlBcnJheTxUPiwga2V5OiBULCBjb21wYXJhdG9yOiAob3AxOiBULCBvcDI6IFQpID0+IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiBiaW5hcnlTZWFyY2gyKGFycmF5Lmxlbmd0aCwgaSA9PiBjb21wYXJhdG9yKGFycmF5W2ldLCBrZXkpKTtcbn1cblxuLyoqXG4gKiBQZXJmb3JtcyBhIGJpbmFyeSBzZWFyY2ggYWxnb3JpdGhtIG92ZXIgYSBzb3J0ZWQgY29sbGVjdGlvbi4gVXNlZnVsIGZvciBjYXNlc1xuICogd2hlbiB3ZSBuZWVkIHRvIHBlcmZvcm0gYSBiaW5hcnkgc2VhcmNoIG92ZXIgc29tZXRoaW5nIHRoYXQgaXNuJ3QgYWN0dWFsbHkgYW5cbiAqIGFycmF5LCBhbmQgY29udmVydGluZyBkYXRhIHRvIGFuIGFycmF5IHdvdWxkIGRlZmVhdCB0aGUgdXNlIG9mIGJpbmFyeSBzZWFyY2hcbiAqIGluIHRoZSBmaXJzdCBwbGFjZS5cbiAqXG4gKiBAcGFyYW0gbGVuZ3RoIFRoZSBjb2xsZWN0aW9uIGxlbmd0aC5cbiAqIEBwYXJhbSBjb21wYXJlVG9LZXkgQSBmdW5jdGlvbiB0aGF0IHRha2VzIGFuIGluZGV4IG9mIGFuIGVsZW1lbnQgaW4gdGhlXG4gKiAgIGNvbGxlY3Rpb24gYW5kIHJldHVybnMgemVybyBpZiB0aGUgdmFsdWUgYXQgdGhpcyBpbmRleCBpcyBlcXVhbCB0byB0aGVcbiAqICAgc2VhcmNoIGtleSwgYSBuZWdhdGl2ZSBudW1iZXIgaWYgdGhlIHZhbHVlIHByZWNlZGVzIHRoZSBzZWFyY2gga2V5IGluIHRoZVxuICogICBzb3J0aW5nIG9yZGVyLCBvciBhIHBvc2l0aXZlIG51bWJlciBpZiB0aGUgc2VhcmNoIGtleSBwcmVjZWRlcyB0aGUgdmFsdWUuXG4gKiBAcmV0dXJuIEEgbm9uLW5lZ2F0aXZlIGluZGV4IG9mIGFuIGVsZW1lbnQsIGlmIGZvdW5kLiBJZiBub3QgZm91bmQsIHRoZVxuICogICByZXN1bHQgaXMgLShuKzEpIChvciB+biwgdXNpbmcgYml0d2lzZSBub3RhdGlvbiksIHdoZXJlIG4gaXMgdGhlIGluZGV4XG4gKiAgIHdoZXJlIHRoZSBrZXkgc2hvdWxkIGJlIGluc2VydGVkIHRvIG1haW50YWluIHRoZSBzb3J0aW5nIG9yZGVyLlxuICovXG5leHBvcnQgZnVuY3Rpb24gYmluYXJ5U2VhcmNoMihsZW5ndGg6IG51bWJlciwgY29tcGFyZVRvS2V5OiAoaW5kZXg6IG51bWJlcikgPT4gbnVtYmVyKTogbnVtYmVyIHtcblx0bGV0IGxvdyA9IDAsXG5cdFx0aGlnaCA9IGxlbmd0aCAtIDE7XG5cblx0d2hpbGUgKGxvdyA8PSBoaWdoKSB7XG5cdFx0Y29uc3QgbWlkID0gKChsb3cgKyBoaWdoKSAvIDIpIHwgMDtcblx0XHRjb25zdCBjb21wID0gY29tcGFyZVRvS2V5KG1pZCk7XG5cdFx0aWYgKGNvbXAgPCAwKSB7XG5cdFx0XHRsb3cgPSBtaWQgKyAxO1xuXHRcdH0gZWxzZSBpZiAoY29tcCA+IDApIHtcblx0XHRcdGhpZ2ggPSBtaWQgLSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gbWlkO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gLShsb3cgKyAxKTtcbn1cblxudHlwZSBDb21wYXJlPFQ+ID0gKGE6IFQsIGI6IFQpID0+IG51bWJlcjtcblxuXG5leHBvcnQgZnVuY3Rpb24gcXVpY2tTZWxlY3Q8VD4obnRoOiBudW1iZXIsIGRhdGE6IFRbXSwgY29tcGFyZTogQ29tcGFyZTxUPik6IFQge1xuXG5cdG50aCA9IG50aCB8IDA7XG5cblx0aWYgKG50aCA+PSBkYXRhLmxlbmd0aCkge1xuXHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ2ludmFsaWQgaW5kZXgnKTtcblx0fVxuXG5cdGNvbnN0IHBpdm90VmFsdWUgPSBkYXRhW01hdGguZmxvb3IoZGF0YS5sZW5ndGggKiBNYXRoLnJhbmRvbSgpKV07XG5cdGNvbnN0IGxvd2VyOiBUW10gPSBbXTtcblx0Y29uc3QgaGlnaGVyOiBUW10gPSBbXTtcblx0Y29uc3QgcGl2b3RzOiBUW10gPSBbXTtcblxuXHRmb3IgKGNvbnN0IHZhbHVlIG9mIGRhdGEpIHtcblx0XHRjb25zdCB2YWwgPSBjb21wYXJlKHZhbHVlLCBwaXZvdFZhbHVlKTtcblx0XHRpZiAodmFsIDwgMCkge1xuXHRcdFx0bG93ZXIucHVzaCh2YWx1ZSk7XG5cdFx0fSBlbHNlIGlmICh2YWwgPiAwKSB7XG5cdFx0XHRoaWdoZXIucHVzaCh2YWx1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHBpdm90cy5wdXNoKHZhbHVlKTtcblx0XHR9XG5cdH1cblxuXHRpZiAobnRoIDwgbG93ZXIubGVuZ3RoKSB7XG5cdFx0cmV0dXJuIHF1aWNrU2VsZWN0KG50aCwgbG93ZXIsIGNvbXBhcmUpO1xuXHR9IGVsc2UgaWYgKG50aCA8IGxvd2VyLmxlbmd0aCArIHBpdm90cy5sZW5ndGgpIHtcblx0XHRyZXR1cm4gcGl2b3RzWzBdO1xuXHR9IGVsc2Uge1xuXHRcdHJldHVybiBxdWlja1NlbGVjdChudGggLSAobG93ZXIubGVuZ3RoICsgcGl2b3RzLmxlbmd0aCksIGhpZ2hlciwgY29tcGFyZSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdyb3VwQnk8VD4oZGF0YTogUmVhZG9ubHlBcnJheTxUPiwgY29tcGFyZTogKGE6IFQsIGI6IFQpID0+IG51bWJlcik6IFRbXVtdIHtcblx0Y29uc3QgcmVzdWx0OiBUW11bXSA9IFtdO1xuXHRsZXQgY3VycmVudEdyb3VwOiBUW10gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGZvciAoY29uc3QgZWxlbWVudCBvZiBkYXRhLnNsaWNlKDApLnNvcnQoY29tcGFyZSkpIHtcblx0XHRpZiAoIWN1cnJlbnRHcm91cCB8fCBjb21wYXJlKGN1cnJlbnRHcm91cFswXSwgZWxlbWVudCkgIT09IDApIHtcblx0XHRcdGN1cnJlbnRHcm91cCA9IFtlbGVtZW50XTtcblx0XHRcdHJlc3VsdC5wdXNoKGN1cnJlbnRHcm91cCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGN1cnJlbnRHcm91cC5wdXNoKGVsZW1lbnQpO1xuXHRcdH1cblx0fVxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFNwbGl0cyB0aGUgZ2l2ZW4gaXRlbXMgaW50byBhIGxpc3Qgb2YgKG5vbi1lbXB0eSkgZ3JvdXBzLlxuICogYHNob3VsZEJlR3JvdXBlZGAgaXMgdXNlZCB0byBkZWNpZGUgaWYgdHdvIGNvbnNlY3V0aXZlIGl0ZW1zIHNob3VsZCBiZSBpbiB0aGUgc2FtZSBncm91cC5cbiAqIFRoZSBvcmRlciBvZiB0aGUgaXRlbXMgaXMgcHJlc2VydmVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24qIGdyb3VwQWRqYWNlbnRCeTxUPihpdGVtczogSXRlcmFibGU8VD4sIHNob3VsZEJlR3JvdXBlZDogKGl0ZW0xOiBULCBpdGVtMjogVCkgPT4gYm9vbGVhbik6IEl0ZXJhYmxlPFRbXT4ge1xuXHRsZXQgY3VycmVudEdyb3VwOiBUW10gfCB1bmRlZmluZWQ7XG5cdGxldCBsYXN0OiBUIHwgdW5kZWZpbmVkO1xuXHRmb3IgKGNvbnN0IGl0ZW0gb2YgaXRlbXMpIHtcblx0XHRpZiAobGFzdCAhPT0gdW5kZWZpbmVkICYmIHNob3VsZEJlR3JvdXBlZChsYXN0LCBpdGVtKSkge1xuXHRcdFx0Y3VycmVudEdyb3VwIS5wdXNoKGl0ZW0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRpZiAoY3VycmVudEdyb3VwKSB7XG5cdFx0XHRcdHlpZWxkIGN1cnJlbnRHcm91cDtcblx0XHRcdH1cblx0XHRcdGN1cnJlbnRHcm91cCA9IFtpdGVtXTtcblx0XHR9XG5cdFx0bGFzdCA9IGl0ZW07XG5cdH1cblx0aWYgKGN1cnJlbnRHcm91cCkge1xuXHRcdHlpZWxkIGN1cnJlbnRHcm91cDtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gZm9yRWFjaEFkamFjZW50PFQ+KGFycjogVFtdLCBmOiAoaXRlbTE6IFQgfCB1bmRlZmluZWQsIGl0ZW0yOiBUIHwgdW5kZWZpbmVkKSA9PiB2b2lkKTogdm9pZCB7XG5cdGZvciAobGV0IGkgPSAwOyBpIDw9IGFyci5sZW5ndGg7IGkrKykge1xuXHRcdGYoaSA9PT0gMCA/IHVuZGVmaW5lZCA6IGFycltpIC0gMV0sIGkgPT09IGFyci5sZW5ndGggPyB1bmRlZmluZWQgOiBhcnJbaV0pO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBmb3JFYWNoV2l0aE5laWdoYm9yczxUPihhcnI6IFRbXSwgZjogKGJlZm9yZTogVCB8IHVuZGVmaW5lZCwgZWxlbWVudDogVCwgYWZ0ZXI6IFQgfCB1bmRlZmluZWQpID0+IHZvaWQpOiB2b2lkIHtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcnIubGVuZ3RoOyBpKyspIHtcblx0XHRmKGkgPT09IDAgPyB1bmRlZmluZWQgOiBhcnJbaSAtIDFdLCBhcnJbaV0sIGkgKyAxID09PSBhcnIubGVuZ3RoID8gdW5kZWZpbmVkIDogYXJyW2kgKyAxXSk7XG5cdH1cbn1cblxuaW50ZXJmYWNlIElNdXRhYmxlU3BsaWNlPFQ+IGV4dGVuZHMgSVNwbGljZTxUPiB7XG5cdHJlYWRvbmx5IHRvSW5zZXJ0OiBUW107XG5cdGRlbGV0ZUNvdW50OiBudW1iZXI7XG59XG5cbi8qKlxuICogRGlmZnMgdHdvICpzb3J0ZWQqIGFycmF5cyBhbmQgY29tcHV0ZXMgdGhlIHNwbGljZXMgd2hpY2ggYXBwbHkgdGhlIGRpZmYuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBzb3J0ZWREaWZmPFQ+KGJlZm9yZTogUmVhZG9ubHlBcnJheTxUPiwgYWZ0ZXI6IFJlYWRvbmx5QXJyYXk8VD4sIGNvbXBhcmU6IChhOiBULCBiOiBUKSA9PiBudW1iZXIpOiBJU3BsaWNlPFQ+W10ge1xuXHRjb25zdCByZXN1bHQ6IElNdXRhYmxlU3BsaWNlPFQ+W10gPSBbXTtcblxuXHRmdW5jdGlvbiBwdXNoU3BsaWNlKHN0YXJ0OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIHRvSW5zZXJ0OiBUW10pOiB2b2lkIHtcblx0XHRpZiAoZGVsZXRlQ291bnQgPT09IDAgJiYgdG9JbnNlcnQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbGF0ZXN0ID0gcmVzdWx0W3Jlc3VsdC5sZW5ndGggLSAxXTtcblxuXHRcdGlmIChsYXRlc3QgJiYgbGF0ZXN0LnN0YXJ0ICsgbGF0ZXN0LmRlbGV0ZUNvdW50ID09PSBzdGFydCkge1xuXHRcdFx0bGF0ZXN0LmRlbGV0ZUNvdW50ICs9IGRlbGV0ZUNvdW50O1xuXHRcdFx0bGF0ZXN0LnRvSW5zZXJ0LnB1c2goLi4udG9JbnNlcnQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXN1bHQucHVzaCh7IHN0YXJ0LCBkZWxldGVDb3VudCwgdG9JbnNlcnQgfSk7XG5cdFx0fVxuXHR9XG5cblx0bGV0IGJlZm9yZUlkeCA9IDA7XG5cdGxldCBhZnRlcklkeCA9IDA7XG5cblx0d2hpbGUgKHRydWUpIHtcblx0XHRpZiAoYmVmb3JlSWR4ID09PSBiZWZvcmUubGVuZ3RoKSB7XG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgMCwgYWZ0ZXIuc2xpY2UoYWZ0ZXJJZHgpKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblx0XHRpZiAoYWZ0ZXJJZHggPT09IGFmdGVyLmxlbmd0aCkge1xuXHRcdFx0cHVzaFNwbGljZShiZWZvcmVJZHgsIGJlZm9yZS5sZW5ndGggLSBiZWZvcmVJZHgsIFtdKTtcblx0XHRcdGJyZWFrO1xuXHRcdH1cblxuXHRcdGNvbnN0IGJlZm9yZUVsZW1lbnQgPSBiZWZvcmVbYmVmb3JlSWR4XTtcblx0XHRjb25zdCBhZnRlckVsZW1lbnQgPSBhZnRlclthZnRlcklkeF07XG5cdFx0Y29uc3QgbiA9IGNvbXBhcmUoYmVmb3JlRWxlbWVudCwgYWZ0ZXJFbGVtZW50KTtcblx0XHRpZiAobiA9PT0gMCkge1xuXHRcdFx0Ly8gZXF1YWxcblx0XHRcdGJlZm9yZUlkeCArPSAxO1xuXHRcdFx0YWZ0ZXJJZHggKz0gMTtcblx0XHR9IGVsc2UgaWYgKG4gPCAwKSB7XG5cdFx0XHQvLyBiZWZvcmVFbGVtZW50IGlzIHNtYWxsZXIgLT4gYmVmb3JlIGVsZW1lbnQgcmVtb3ZlZFxuXHRcdFx0cHVzaFNwbGljZShiZWZvcmVJZHgsIDEsIFtdKTtcblx0XHRcdGJlZm9yZUlkeCArPSAxO1xuXHRcdH0gZWxzZSBpZiAobiA+IDApIHtcblx0XHRcdC8vIGJlZm9yZUVsZW1lbnQgaXMgZ3JlYXRlciAtPiBhZnRlciBlbGVtZW50IGFkZGVkXG5cdFx0XHRwdXNoU3BsaWNlKGJlZm9yZUlkeCwgMCwgW2FmdGVyRWxlbWVudF0pO1xuXHRcdFx0YWZ0ZXJJZHggKz0gMTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG4vKipcbiAqIFRha2VzIHR3byAqc29ydGVkKiBhcnJheXMgYW5kIGNvbXB1dGVzIHRoZWlyIGRlbHRhIChyZW1vdmVkLCBhZGRlZCBlbGVtZW50cykuXG4gKiBGaW5pc2hlcyBpbiBgTWF0aC5taW4oYmVmb3JlLmxlbmd0aCwgYWZ0ZXIubGVuZ3RoKWAgc3RlcHMuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBkZWx0YTxUPihiZWZvcmU6IFJlYWRvbmx5QXJyYXk8VD4sIGFmdGVyOiBSZWFkb25seUFycmF5PFQ+LCBjb21wYXJlOiAoYTogVCwgYjogVCkgPT4gbnVtYmVyKTogeyByZW1vdmVkOiBUW107IGFkZGVkOiBUW10gfSB7XG5cdGNvbnN0IHNwbGljZXMgPSBzb3J0ZWREaWZmKGJlZm9yZSwgYWZ0ZXIsIGNvbXBhcmUpO1xuXHRjb25zdCByZW1vdmVkOiBUW10gPSBbXTtcblx0Y29uc3QgYWRkZWQ6IFRbXSA9IFtdO1xuXG5cdGZvciAoY29uc3Qgc3BsaWNlIG9mIHNwbGljZXMpIHtcblx0XHRyZW1vdmVkLnB1c2goLi4uYmVmb3JlLnNsaWNlKHNwbGljZS5zdGFydCwgc3BsaWNlLnN0YXJ0ICsgc3BsaWNlLmRlbGV0ZUNvdW50KSk7XG5cdFx0YWRkZWQucHVzaCguLi5zcGxpY2UudG9JbnNlcnQpO1xuXHR9XG5cblx0cmV0dXJuIHsgcmVtb3ZlZCwgYWRkZWQgfTtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSB0b3AgTiBlbGVtZW50cyBmcm9tIHRoZSBhcnJheS5cbiAqXG4gKiBGYXN0ZXIgdGhhbiBzb3J0aW5nIHRoZSBlbnRpcmUgYXJyYXkgd2hlbiB0aGUgYXJyYXkgaXMgYSBsb3QgbGFyZ2VyIHRoYW4gTi5cbiAqXG4gKiBAcGFyYW0gYXJyYXkgVGhlIHVuc29ydGVkIGFycmF5LlxuICogQHBhcmFtIGNvbXBhcmUgQSBzb3J0IGZ1bmN0aW9uIGZvciB0aGUgZWxlbWVudHMuXG4gKiBAcGFyYW0gbiBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHJldHVybi5cbiAqIEByZXR1cm4gVGhlIGZpcnN0IG4gZWxlbWVudHMgZnJvbSBhcnJheSB3aGVuIHNvcnRlZCB3aXRoIGNvbXBhcmUuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiB0b3A8VD4oYXJyYXk6IFJlYWRvbmx5QXJyYXk8VD4sIGNvbXBhcmU6IChhOiBULCBiOiBUKSA9PiBudW1iZXIsIG46IG51bWJlcik6IFRbXSB7XG5cdGlmIChuID09PSAwKSB7XG5cdFx0cmV0dXJuIFtdO1xuXHR9XG5cdGNvbnN0IHJlc3VsdCA9IGFycmF5LnNsaWNlKDAsIG4pLnNvcnQoY29tcGFyZSk7XG5cdHRvcFN0ZXAoYXJyYXksIGNvbXBhcmUsIHJlc3VsdCwgbiwgYXJyYXkubGVuZ3RoKTtcblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBBc3luY2hyb25vdXMgdmFyaWFudCBvZiBgdG9wKClgIGFsbG93aW5nIGZvciBzcGxpdHRpbmcgdXAgd29yayBpbiBiYXRjaGVzIGJldHdlZW4gd2hpY2ggdGhlIGV2ZW50IGxvb3AgY2FuIHJ1bi5cbiAqXG4gKiBSZXR1cm5zIHRoZSB0b3AgTiBlbGVtZW50cyBmcm9tIHRoZSBhcnJheS5cbiAqXG4gKiBGYXN0ZXIgdGhhbiBzb3J0aW5nIHRoZSBlbnRpcmUgYXJyYXkgd2hlbiB0aGUgYXJyYXkgaXMgYSBsb3QgbGFyZ2VyIHRoYW4gTi5cbiAqXG4gKiBAcGFyYW0gYXJyYXkgVGhlIHVuc29ydGVkIGFycmF5LlxuICogQHBhcmFtIGNvbXBhcmUgQSBzb3J0IGZ1bmN0aW9uIGZvciB0aGUgZWxlbWVudHMuXG4gKiBAcGFyYW0gbiBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHJldHVybi5cbiAqIEBwYXJhbSBiYXRjaCBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIGV4YW1pbmUgYmVmb3JlIHlpZWxkaW5nIHRvIHRoZSBldmVudCBsb29wLlxuICogQHJldHVybiBUaGUgZmlyc3QgbiBlbGVtZW50cyBmcm9tIGFycmF5IHdoZW4gc29ydGVkIHdpdGggY29tcGFyZS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHRvcEFzeW5jPFQ+KGFycmF5OiBUW10sIGNvbXBhcmU6IChhOiBULCBiOiBUKSA9PiBudW1iZXIsIG46IG51bWJlciwgYmF0Y2g6IG51bWJlciwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8VFtdPiB7XG5cdGlmIChuID09PSAwKSB7XG5cdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdH1cblxuXHRyZXR1cm4gbmV3IFByb21pc2UoKHJlc29sdmUsIHJlamVjdCkgPT4ge1xuXHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBvID0gYXJyYXkubGVuZ3RoO1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gYXJyYXkuc2xpY2UoMCwgbikuc29ydChjb21wYXJlKTtcblx0XHRcdGZvciAobGV0IGkgPSBuLCBtID0gTWF0aC5taW4obiArIGJhdGNoLCBvKTsgaSA8IG87IGkgPSBtLCBtID0gTWF0aC5taW4obSArIGJhdGNoLCBvKSkge1xuXHRcdFx0XHRpZiAoaSA+IG4pIHtcblx0XHRcdFx0XHRhd2FpdCBuZXcgUHJvbWlzZShyZXNvbHZlID0+IHNldFRpbWVvdXQocmVzb2x2ZSkpOyAvLyBhbnkgb3RoZXIgZGVsYXkgZnVuY3Rpb24gd291bGQgc3RhcnZlIEkvT1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmICh0b2tlbiAmJiB0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRvcFN0ZXAoYXJyYXksIGNvbXBhcmUsIHJlc3VsdCwgaSwgbSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdH0pKClcblx0XHRcdC50aGVuKHJlc29sdmUsIHJlamVjdCk7XG5cdH0pO1xufVxuXG5mdW5jdGlvbiB0b3BTdGVwPFQ+KGFycmF5OiBSZWFkb25seUFycmF5PFQ+LCBjb21wYXJlOiAoYTogVCwgYjogVCkgPT4gbnVtYmVyLCByZXN1bHQ6IFRbXSwgaTogbnVtYmVyLCBtOiBudW1iZXIpOiB2b2lkIHtcblx0Zm9yIChjb25zdCBuID0gcmVzdWx0Lmxlbmd0aDsgaSA8IG07IGkrKykge1xuXHRcdGNvbnN0IGVsZW1lbnQgPSBhcnJheVtpXTtcblx0XHRpZiAoY29tcGFyZShlbGVtZW50LCByZXN1bHRbbiAtIDFdKSA8IDApIHtcblx0XHRcdHJlc3VsdC5wb3AoKTtcblx0XHRcdGNvbnN0IGogPSBmaW5kRmlyc3RJZHhNb25vdG9ub3VzT3JBcnJMZW4ocmVzdWx0LCBlID0+IGNvbXBhcmUoZWxlbWVudCwgZSkgPCAwKTtcblx0XHRcdHJlc3VsdC5zcGxpY2UoaiwgMCwgZWxlbWVudCk7XG5cdFx0fVxuXHR9XG59XG5cbi8qKlxuICogQHJldHVybnMgTmV3IGFycmF5IHdpdGggYWxsIGZhbHN5IHZhbHVlcyByZW1vdmVkLiBUaGUgb3JpZ2luYWwgYXJyYXkgSVMgTk9UIG1vZGlmaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29hbGVzY2U8VD4oYXJyYXk6IFJlYWRvbmx5QXJyYXk8VCB8IHVuZGVmaW5lZCB8IG51bGw+KTogVFtdIHtcblx0cmV0dXJuIGFycmF5LmZpbHRlcigoZSk6IGUgaXMgVCA9PiAhIWUpO1xufVxuXG4vKipcbiAqIFJlbW92ZSBhbGwgZmFsc3kgdmFsdWVzIGZyb20gYGFycmF5YC4gVGhlIG9yaWdpbmFsIGFycmF5IElTIG1vZGlmaWVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gY29hbGVzY2VJblBsYWNlPFQ+KGFycmF5OiBBcnJheTxUIHwgdW5kZWZpbmVkIHwgbnVsbD4pOiBhc3NlcnRzIGFycmF5IGlzIEFycmF5PFQ+IHtcblx0bGV0IHRvID0gMDtcblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBhcnJheS5sZW5ndGg7IGkrKykge1xuXHRcdGlmICghIWFycmF5W2ldKSB7XG5cdFx0XHRhcnJheVt0b10gPSBhcnJheVtpXTtcblx0XHRcdHRvICs9IDE7XG5cdFx0fVxuXHR9XG5cdGFycmF5Lmxlbmd0aCA9IHRvO1xufVxuXG4vKipcbiAqIEBkZXByZWNhdGVkIFVzZSBgQXJyYXkuY29weVdpdGhpbmAgaW5zdGVhZFxuICovXG5leHBvcnQgZnVuY3Rpb24gbW92ZShhcnJheTogdW5rbm93bltdLCBmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiB2b2lkIHtcblx0YXJyYXkuc3BsaWNlKHRvLCAwLCBhcnJheS5zcGxpY2UoZnJvbSwgMSlbMF0pO1xufVxuXG4vKipcbiAqIEByZXR1cm5zIGZhbHNlIGlmIHRoZSBwcm92aWRlZCBvYmplY3QgaXMgYW4gYXJyYXkgYW5kIG5vdCBlbXB0eS5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGlzRmFsc3lPckVtcHR5KG9iajogYW55KTogYm9vbGVhbiB7XG5cdHJldHVybiAhQXJyYXkuaXNBcnJheShvYmopIHx8IG9iai5sZW5ndGggPT09IDA7XG59XG5cbi8qKlxuICogQHJldHVybnMgVHJ1ZSBpZiB0aGUgcHJvdmlkZWQgb2JqZWN0IGlzIGFuIGFycmF5IGFuZCBoYXMgYXQgbGVhc3Qgb25lIGVsZW1lbnQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBpc05vbkVtcHR5QXJyYXk8VD4ob2JqOiBUW10gfCB1bmRlZmluZWQgfCBudWxsKTogb2JqIGlzIFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBpc05vbkVtcHR5QXJyYXk8VD4ob2JqOiByZWFkb25seSBUW10gfCB1bmRlZmluZWQgfCBudWxsKTogb2JqIGlzIHJlYWRvbmx5IFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBpc05vbkVtcHR5QXJyYXk8VD4ob2JqOiBUW10gfCByZWFkb25seSBUW10gfCB1bmRlZmluZWQgfCBudWxsKTogb2JqIGlzIFRbXSB8IHJlYWRvbmx5IFRbXSB7XG5cdHJldHVybiBBcnJheS5pc0FycmF5KG9iaikgJiYgb2JqLmxlbmd0aCA+IDA7XG59XG5cbi8qKlxuICogUmVtb3ZlcyBkdXBsaWNhdGVzIGZyb20gdGhlIGdpdmVuIGFycmF5LiBUaGUgb3B0aW9uYWwga2V5Rm4gYWxsb3dzIHRvIHNwZWNpZnlcbiAqIGhvdyBlbGVtZW50cyBhcmUgY2hlY2tlZCBmb3IgZXF1YWxpdHkgYnkgcmV0dXJuaW5nIGFuIGFsdGVybmF0ZSB2YWx1ZSBmb3IgZWFjaC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGRpc3RpbmN0PFQ+KGFycmF5OiBSZWFkb25seUFycmF5PFQ+LCBrZXlGbjogKHZhbHVlOiBUKSA9PiB1bmtub3duID0gdmFsdWUgPT4gdmFsdWUpOiBUW10ge1xuXHRjb25zdCBzZWVuID0gbmV3IFNldDxhbnk+KCk7XG5cblx0cmV0dXJuIGFycmF5LmZpbHRlcihlbGVtZW50ID0+IHtcblx0XHRjb25zdCBrZXkgPSBrZXlGbiEoZWxlbWVudCk7XG5cdFx0aWYgKHNlZW4uaGFzKGtleSkpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0c2Vlbi5hZGQoa2V5KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fSk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiB1bmlxdWVGaWx0ZXI8VCwgUj4oa2V5Rm46ICh0OiBUKSA9PiBSKTogKHQ6IFQpID0+IGJvb2xlYW4ge1xuXHRjb25zdCBzZWVuID0gbmV3IFNldDxSPigpO1xuXG5cdHJldHVybiBlbGVtZW50ID0+IHtcblx0XHRjb25zdCBrZXkgPSBrZXlGbihlbGVtZW50KTtcblxuXHRcdGlmIChzZWVuLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0c2Vlbi5hZGQoa2V5KTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGNvbW1vblByZWZpeExlbmd0aDxUPihvbmU6IFJlYWRvbmx5QXJyYXk8VD4sIG90aGVyOiBSZWFkb25seUFycmF5PFQ+LCBlcXVhbHM6IChhOiBULCBiOiBUKSA9PiBib29sZWFuID0gKGEsIGIpID0+IGEgPT09IGIpOiBudW1iZXIge1xuXHRsZXQgcmVzdWx0ID0gMDtcblxuXHRmb3IgKGxldCBpID0gMCwgbGVuID0gTWF0aC5taW4ob25lLmxlbmd0aCwgb3RoZXIubGVuZ3RoKTsgaSA8IGxlbiAmJiBlcXVhbHMob25lW2ldLCBvdGhlcltpXSk7IGkrKykge1xuXHRcdHJlc3VsdCsrO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIHJhbmdlKHRvOiBudW1iZXIpOiBudW1iZXJbXTtcbmV4cG9ydCBmdW5jdGlvbiByYW5nZShmcm9tOiBudW1iZXIsIHRvOiBudW1iZXIpOiBudW1iZXJbXTtcbmV4cG9ydCBmdW5jdGlvbiByYW5nZShhcmc6IG51bWJlciwgdG8/OiBudW1iZXIpOiBudW1iZXJbXSB7XG5cdGxldCBmcm9tID0gdHlwZW9mIHRvID09PSAnbnVtYmVyJyA/IGFyZyA6IDA7XG5cblx0aWYgKHR5cGVvZiB0byA9PT0gJ251bWJlcicpIHtcblx0XHRmcm9tID0gYXJnO1xuXHR9IGVsc2Uge1xuXHRcdGZyb20gPSAwO1xuXHRcdHRvID0gYXJnO1xuXHR9XG5cblx0Y29uc3QgcmVzdWx0OiBudW1iZXJbXSA9IFtdO1xuXG5cdGlmIChmcm9tIDw9IHRvKSB7XG5cdFx0Zm9yIChsZXQgaSA9IGZyb207IGkgPCB0bzsgaSsrKSB7XG5cdFx0XHRyZXN1bHQucHVzaChpKTtcblx0XHR9XG5cdH0gZWxzZSB7XG5cdFx0Zm9yIChsZXQgaSA9IGZyb207IGkgPiB0bzsgaS0tKSB7XG5cdFx0XHRyZXN1bHQucHVzaChpKTtcblx0XHR9XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaW5kZXg8VD4oYXJyYXk6IFJlYWRvbmx5QXJyYXk8VD4sIGluZGV4ZXI6ICh0OiBUKSA9PiBzdHJpbmcpOiB7IFtrZXk6IHN0cmluZ106IFQgfTtcbmV4cG9ydCBmdW5jdGlvbiBpbmRleDxULCBSPihhcnJheTogUmVhZG9ubHlBcnJheTxUPiwgaW5kZXhlcjogKHQ6IFQpID0+IHN0cmluZywgbWFwcGVyOiAodDogVCkgPT4gUik6IHsgW2tleTogc3RyaW5nXTogUiB9O1xuZXhwb3J0IGZ1bmN0aW9uIGluZGV4PFQsIFI+KGFycmF5OiBSZWFkb25seUFycmF5PFQ+LCBpbmRleGVyOiAodDogVCkgPT4gc3RyaW5nLCBtYXBwZXI/OiAodDogVCkgPT4gUik6IHsgW2tleTogc3RyaW5nXTogUiB9IHtcblx0cmV0dXJuIGFycmF5LnJlZHVjZSgociwgdCkgPT4ge1xuXHRcdHJbaW5kZXhlcih0KV0gPSBtYXBwZXIgPyBtYXBwZXIodCkgOiB0O1xuXHRcdHJldHVybiByO1xuXHR9LCBPYmplY3QuY3JlYXRlKG51bGwpKTtcbn1cblxuLyoqXG4gKiBJbnNlcnRzIGFuIGVsZW1lbnQgaW50byBhbiBhcnJheS4gUmV0dXJucyBhIGZ1bmN0aW9uIHdoaWNoLCB3aGVuXG4gKiBjYWxsZWQsIHdpbGwgcmVtb3ZlIHRoYXQgZWxlbWVudCBmcm9tIHRoZSBhcnJheS5cbiAqXG4gKiBAZGVwcmVjYXRlZCBJbiBhbG1vc3QgYWxsIGNhc2VzLCB1c2UgYSBgU2V0PFQ+YCBpbnN0ZWFkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gaW5zZXJ0PFQ+KGFycmF5OiBUW10sIGVsZW1lbnQ6IFQpOiAoKSA9PiB2b2lkIHtcblx0YXJyYXkucHVzaChlbGVtZW50KTtcblxuXHRyZXR1cm4gKCkgPT4gcmVtb3ZlKGFycmF5LCBlbGVtZW50KTtcbn1cblxuLyoqXG4gKiBSZW1vdmVzIGFuIGVsZW1lbnQgZnJvbSBhbiBhcnJheSBpZiBpdCBjYW4gYmUgZm91bmQuXG4gKlxuICogQGRlcHJlY2F0ZWQgSW4gYWxtb3N0IGFsbCBjYXNlcywgdXNlIGEgYFNldDxUPmAgaW5zdGVhZC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHJlbW92ZTxUPihhcnJheTogVFtdLCBlbGVtZW50OiBUKTogVCB8IHVuZGVmaW5lZCB7XG5cdGNvbnN0IGluZGV4ID0gYXJyYXkuaW5kZXhPZihlbGVtZW50KTtcblx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRhcnJheS5zcGxpY2UoaW5kZXgsIDEpO1xuXG5cdFx0cmV0dXJuIGVsZW1lbnQ7XG5cdH1cblxuXHRyZXR1cm4gdW5kZWZpbmVkO1xufVxuXG4vKipcbiAqIEluc2VydCBgaW5zZXJ0QXJyYCBpbnNpZGUgYHRhcmdldGAgYXQgYGluc2VydEluZGV4YC5cbiAqIFBsZWFzZSBkb24ndCB0b3VjaCB1bmxlc3MgeW91IHVuZGVyc3RhbmQgaHR0cHM6Ly9qc3BlcmYuY29tL2luc2VydGluZy1hbi1hcnJheS13aXRoaW4tYW4tYXJyYXlcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGFycmF5SW5zZXJ0PFQ+KHRhcmdldDogVFtdLCBpbnNlcnRJbmRleDogbnVtYmVyLCBpbnNlcnRBcnI6IFRbXSk6IFRbXSB7XG5cdGNvbnN0IGJlZm9yZSA9IHRhcmdldC5zbGljZSgwLCBpbnNlcnRJbmRleCk7XG5cdGNvbnN0IGFmdGVyID0gdGFyZ2V0LnNsaWNlKGluc2VydEluZGV4KTtcblx0cmV0dXJuIGJlZm9yZS5jb25jYXQoaW5zZXJ0QXJyLCBhZnRlcik7XG59XG5cbi8qKlxuICogVXNlcyBGaXNoZXItWWF0ZXMgc2h1ZmZsZSB0byBzaHVmZmxlIHRoZSBnaXZlbiBhcnJheVxuICovXG5leHBvcnQgZnVuY3Rpb24gc2h1ZmZsZTxUPihhcnJheTogVFtdLCBfc2VlZD86IG51bWJlcik6IHZvaWQge1xuXHRsZXQgcmFuZDogKCkgPT4gbnVtYmVyO1xuXG5cdGlmICh0eXBlb2YgX3NlZWQgPT09ICdudW1iZXInKSB7XG5cdFx0bGV0IHNlZWQgPSBfc2VlZDtcblx0XHQvLyBTZWVkZWQgcmFuZG9tIG51bWJlciBnZW5lcmF0b3IgaW4gSlMuIE1vZGlmaWVkIGZyb206XG5cdFx0Ly8gaHR0cHM6Ly9zdGFja292ZXJmbG93LmNvbS9xdWVzdGlvbnMvNTIxMjk1L3NlZWRpbmctdGhlLXJhbmRvbS1udW1iZXItZ2VuZXJhdG9yLWluLWphdmFzY3JpcHRcblx0XHRyYW5kID0gKCkgPT4ge1xuXHRcdFx0Y29uc3QgeCA9IE1hdGguc2luKHNlZWQrKykgKiAxNzk0MjY1NDk7IC8vIHRocm93IGF3YXkgbW9zdCBzaWduaWZpY2FudCBkaWdpdHMgYW5kIHJlZHVjZSBhbnkgcG90ZW50aWFsIGJpYXNcblx0XHRcdHJldHVybiB4IC0gTWF0aC5mbG9vcih4KTtcblx0XHR9O1xuXHR9IGVsc2Uge1xuXHRcdHJhbmQgPSBNYXRoLnJhbmRvbTtcblx0fVxuXG5cdGZvciAobGV0IGkgPSBhcnJheS5sZW5ndGggLSAxOyBpID4gMDsgaSAtPSAxKSB7XG5cdFx0Y29uc3QgaiA9IE1hdGguZmxvb3IocmFuZCgpICogKGkgKyAxKSk7XG5cdFx0Y29uc3QgdGVtcCA9IGFycmF5W2ldO1xuXHRcdGFycmF5W2ldID0gYXJyYXlbal07XG5cdFx0YXJyYXlbal0gPSB0ZW1wO1xuXHR9XG59XG5cbi8qKlxuICogUHVzaGVzIGFuIGVsZW1lbnQgdG8gdGhlIHN0YXJ0IG9mIHRoZSBhcnJheSwgaWYgZm91bmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwdXNoVG9TdGFydDxUPihhcnI6IFRbXSwgdmFsdWU6IFQpOiB2b2lkIHtcblx0Y29uc3QgaW5kZXggPSBhcnIuaW5kZXhPZih2YWx1ZSk7XG5cblx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRhcnIuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRhcnIudW5zaGlmdCh2YWx1ZSk7XG5cdH1cbn1cblxuLyoqXG4gKiBQdXNoZXMgYW4gZWxlbWVudCB0byB0aGUgZW5kIG9mIHRoZSBhcnJheSwgaWYgZm91bmQuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBwdXNoVG9FbmQ8VD4oYXJyOiBUW10sIHZhbHVlOiBUKTogdm9pZCB7XG5cdGNvbnN0IGluZGV4ID0gYXJyLmluZGV4T2YodmFsdWUpO1xuXG5cdGlmIChpbmRleCA+IC0xKSB7XG5cdFx0YXJyLnNwbGljZShpbmRleCwgMSk7XG5cdFx0YXJyLnB1c2godmFsdWUpO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBwdXNoTWFueTxUPihhcnI6IFRbXSwgaXRlbXM6IFJlYWRvbmx5QXJyYXk8VD4pOiB2b2lkIHtcblx0Zm9yIChjb25zdCBpdGVtIG9mIGl0ZW1zKSB7XG5cdFx0YXJyLnB1c2goaXRlbSk7XG5cdH1cbn1cblxuZXhwb3J0IGZ1bmN0aW9uIG1hcEFycmF5T3JOb3Q8VCwgVT4oaXRlbXM6IFQgfCBUW10sIGZuOiAoXzogVCkgPT4gVSk6IFUgfCBVW10ge1xuXHRyZXR1cm4gQXJyYXkuaXNBcnJheShpdGVtcykgP1xuXHRcdGl0ZW1zLm1hcChmbikgOlxuXHRcdGZuKGl0ZW1zKTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGFzQXJyYXk8VD4oeDogVCB8IFRbXSk6IFRbXTtcbmV4cG9ydCBmdW5jdGlvbiBhc0FycmF5PFQ+KHg6IFQgfCByZWFkb25seSBUW10pOiByZWFkb25seSBUW107XG5leHBvcnQgZnVuY3Rpb24gYXNBcnJheTxUPih4OiBUIHwgVFtdKTogVFtdIHtcblx0cmV0dXJuIEFycmF5LmlzQXJyYXkoeCkgPyB4IDogW3hdO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gZ2V0UmFuZG9tRWxlbWVudDxUPihhcnI6IFRbXSk6IFQgfCB1bmRlZmluZWQge1xuXHRyZXR1cm4gYXJyW01hdGguZmxvb3IoTWF0aC5yYW5kb20oKSAqIGFyci5sZW5ndGgpXTtcbn1cblxuLyoqXG4gKiBJbnNlcnQgdGhlIG5ldyBpdGVtcyBpbiB0aGUgYXJyYXkuXG4gKiBAcGFyYW0gYXJyYXkgVGhlIG9yaWdpbmFsIGFycmF5LlxuICogQHBhcmFtIHN0YXJ0IFRoZSB6ZXJvLWJhc2VkIGxvY2F0aW9uIGluIHRoZSBhcnJheSBmcm9tIHdoaWNoIHRvIHN0YXJ0IGluc2VydGluZyBlbGVtZW50cy5cbiAqIEBwYXJhbSBuZXdJdGVtcyBUaGUgaXRlbXMgdG8gYmUgaW5zZXJ0ZWRcbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIGluc2VydEludG88VD4oYXJyYXk6IFRbXSwgc3RhcnQ6IG51bWJlciwgbmV3SXRlbXM6IFRbXSk6IHZvaWQge1xuXHRjb25zdCBzdGFydElkeCA9IGdldEFjdHVhbFN0YXJ0SW5kZXgoYXJyYXksIHN0YXJ0KTtcblx0Y29uc3Qgb3JpZ2luYWxMZW5ndGggPSBhcnJheS5sZW5ndGg7XG5cdGNvbnN0IG5ld0l0ZW1zTGVuZ3RoID0gbmV3SXRlbXMubGVuZ3RoO1xuXHRhcnJheS5sZW5ndGggPSBvcmlnaW5hbExlbmd0aCArIG5ld0l0ZW1zTGVuZ3RoO1xuXHQvLyBNb3ZlIHRoZSBpdGVtcyBhZnRlciB0aGUgc3RhcnQgaW5kZXgsIHN0YXJ0IGZyb20gdGhlIGVuZCBzbyB0aGF0IHdlIGRvbid0IG92ZXJ3cml0ZSBhbnkgdmFsdWUuXG5cdGZvciAobGV0IGkgPSBvcmlnaW5hbExlbmd0aCAtIDE7IGkgPj0gc3RhcnRJZHg7IGktLSkge1xuXHRcdGFycmF5W2kgKyBuZXdJdGVtc0xlbmd0aF0gPSBhcnJheVtpXTtcblx0fVxuXG5cdGZvciAobGV0IGkgPSAwOyBpIDwgbmV3SXRlbXNMZW5ndGg7IGkrKykge1xuXHRcdGFycmF5W2kgKyBzdGFydElkeF0gPSBuZXdJdGVtc1tpXTtcblx0fVxufVxuXG4vKipcbiAqIFJlbW92ZXMgZWxlbWVudHMgZnJvbSBhbiBhcnJheSBhbmQgaW5zZXJ0cyBuZXcgZWxlbWVudHMgaW4gdGhlaXIgcGxhY2UsIHJldHVybmluZyB0aGUgZGVsZXRlZCBlbGVtZW50cy4gQWx0ZXJuYXRpdmUgdG8gdGhlIG5hdGl2ZSBBcnJheS5zcGxpY2UgbWV0aG9kLCBpdFxuICogY2FuIG9ubHkgc3VwcG9ydCBsaW1pdGVkIG51bWJlciBvZiBpdGVtcyBkdWUgdG8gdGhlIG1heGltdW0gY2FsbCBzdGFjayBzaXplIGxpbWl0LlxuICogQHBhcmFtIGFycmF5IFRoZSBvcmlnaW5hbCBhcnJheS5cbiAqIEBwYXJhbSBzdGFydCBUaGUgemVyby1iYXNlZCBsb2NhdGlvbiBpbiB0aGUgYXJyYXkgZnJvbSB3aGljaCB0byBzdGFydCByZW1vdmluZyBlbGVtZW50cy5cbiAqIEBwYXJhbSBkZWxldGVDb3VudCBUaGUgbnVtYmVyIG9mIGVsZW1lbnRzIHRvIHJlbW92ZS5cbiAqIEByZXR1cm5zIEFuIGFycmF5IGNvbnRhaW5pbmcgdGhlIGVsZW1lbnRzIHRoYXQgd2VyZSBkZWxldGVkLlxuICovXG5leHBvcnQgZnVuY3Rpb24gc3BsaWNlPFQ+KGFycmF5OiBUW10sIHN0YXJ0OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIG5ld0l0ZW1zOiBUW10pOiBUW10ge1xuXHRjb25zdCBpbmRleCA9IGdldEFjdHVhbFN0YXJ0SW5kZXgoYXJyYXksIHN0YXJ0KTtcblx0bGV0IHJlc3VsdCA9IGFycmF5LnNwbGljZShpbmRleCwgZGVsZXRlQ291bnQpO1xuXHRpZiAocmVzdWx0ID09PSB1bmRlZmluZWQpIHtcblx0XHQvLyBzZWUgaHR0cHM6Ly9idWdzLndlYmtpdC5vcmcvc2hvd19idWcuY2dpP2lkPTI2MTE0MFxuXHRcdHJlc3VsdCA9IFtdO1xuXHR9XG5cdGluc2VydEludG8oYXJyYXksIGluZGV4LCBuZXdJdGVtcyk7XG5cdHJldHVybiByZXN1bHQ7XG59XG5cbi8qKlxuICogRGV0ZXJtaW5lIHRoZSBhY3R1YWwgc3RhcnQgaW5kZXggKHNhbWUgbG9naWMgYXMgdGhlIG5hdGl2ZSBzcGxpY2UoKSBvciBzbGljZSgpKVxuICogSWYgZ3JlYXRlciB0aGFuIHRoZSBsZW5ndGggb2YgdGhlIGFycmF5LCBzdGFydCB3aWxsIGJlIHNldCB0byB0aGUgbGVuZ3RoIG9mIHRoZSBhcnJheS4gSW4gdGhpcyBjYXNlLCBubyBlbGVtZW50IHdpbGwgYmUgZGVsZXRlZCBidXQgdGhlIG1ldGhvZCB3aWxsIGJlaGF2ZSBhcyBhbiBhZGRpbmcgZnVuY3Rpb24sIGFkZGluZyBhcyBtYW55IGVsZW1lbnQgYXMgaXRlbVtuKl0gcHJvdmlkZWQuXG4gKiBJZiBuZWdhdGl2ZSwgaXQgd2lsbCBiZWdpbiB0aGF0IG1hbnkgZWxlbWVudHMgZnJvbSB0aGUgZW5kIG9mIHRoZSBhcnJheS4gKEluIHRoaXMgY2FzZSwgdGhlIG9yaWdpbiAtMSwgbWVhbmluZyAtbiBpcyB0aGUgaW5kZXggb2YgdGhlIG50aCBsYXN0IGVsZW1lbnQsIGFuZCBpcyB0aGVyZWZvcmUgZXF1aXZhbGVudCB0byB0aGUgaW5kZXggb2YgYXJyYXkubGVuZ3RoIC0gbi4pIElmIGFycmF5Lmxlbmd0aCArIHN0YXJ0IGlzIGxlc3MgdGhhbiAwLCBpdCB3aWxsIGJlZ2luIGZyb20gaW5kZXggMC5cbiAqIEBwYXJhbSBhcnJheSBUaGUgdGFyZ2V0IGFycmF5LlxuICogQHBhcmFtIHN0YXJ0IFRoZSBvcGVyYXRpb24gaW5kZXguXG4gKi9cbmZ1bmN0aW9uIGdldEFjdHVhbFN0YXJ0SW5kZXg8VD4oYXJyYXk6IFRbXSwgc3RhcnQ6IG51bWJlcik6IG51bWJlciB7XG5cdHJldHVybiBzdGFydCA8IDAgPyBNYXRoLm1heChzdGFydCArIGFycmF5Lmxlbmd0aCwgMCkgOiBNYXRoLm1pbihzdGFydCwgYXJyYXkubGVuZ3RoKTtcbn1cblxuLyoqXG4gKiBVdGlsaXR5IHRoYXQgaGVscHMgdG8gcGljayBhIHByb3BlcnR5IGZyb20gYW4gb2JqZWN0LlxuICpcbiAqICMjIEV4YW1wbGVzXG4gKlxuICogYGBgdHlwZXNjcmlwdFxuICogaW50ZXJmYWNlIElPYmplY3QgPSB7XG4gKiAgIGE6IG51bWJlcixcbiAqICAgYjogc3RyaW5nLFxuICogfTtcbiAqXG4gKiBjb25zdCBsaXN0OiBJT2JqZWN0W10gPSBbXG4gKiAgIHsgYTogMSwgYjogJ2ZvbycgfSxcbiAqICAgeyBhOiAyLCBiOiAnYmFyJyB9LFxuICogXTtcbiAqXG4gKiBhc3NlcnQuZGVlcFN0cmljdEVxdWFsKFxuICogICBsaXN0Lm1hcChwaWNrKCdhJykpLFxuICogICBbMSwgMl0sXG4gKiApO1xuICogYGBgXG4gKi9cbmV4cG9ydCBjb25zdCBwaWNrID0gPFRPYmplY3QsIFRLZXlOYW1lIGV4dGVuZHMga2V5b2YgVE9iamVjdD4oXG5cdGtleTogVEtleU5hbWUsXG4pID0+IHtcblx0cmV0dXJuIChvYmo6IFRPYmplY3QpOiBUT2JqZWN0W1RLZXlOYW1lXSA9PiB7XG5cdFx0cmV0dXJuIG9ialtrZXldO1xuXHR9O1xufTtcblxuLyoqXG4gKiBXaGVuIGNvbXBhcmluZyB0d28gdmFsdWVzLFxuICogYSBuZWdhdGl2ZSBudW1iZXIgaW5kaWNhdGVzIHRoYXQgdGhlIGZpcnN0IHZhbHVlIGlzIGxlc3MgdGhhbiB0aGUgc2Vjb25kLFxuICogYSBwb3NpdGl2ZSBudW1iZXIgaW5kaWNhdGVzIHRoYXQgdGhlIGZpcnN0IHZhbHVlIGlzIGdyZWF0ZXIgdGhhbiB0aGUgc2Vjb25kLFxuICogYW5kIHplcm8gaW5kaWNhdGVzIHRoYXQgbmVpdGhlciBpcyB0aGUgY2FzZS5cbiovXG5leHBvcnQgdHlwZSBDb21wYXJlUmVzdWx0ID0gbnVtYmVyO1xuXG5leHBvcnQgbmFtZXNwYWNlIENvbXBhcmVSZXN1bHQge1xuXHRleHBvcnQgZnVuY3Rpb24gaXNMZXNzVGhhbihyZXN1bHQ6IENvbXBhcmVSZXN1bHQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmVzdWx0IDwgMDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc0xlc3NUaGFuT3JFcXVhbChyZXN1bHQ6IENvbXBhcmVSZXN1bHQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmVzdWx0IDw9IDA7XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gaXNHcmVhdGVyVGhhbihyZXN1bHQ6IENvbXBhcmVSZXN1bHQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmVzdWx0ID4gMDtcblx0fVxuXG5cdGV4cG9ydCBmdW5jdGlvbiBpc05laXRoZXJMZXNzT3JHcmVhdGVyVGhhbihyZXN1bHQ6IENvbXBhcmVSZXN1bHQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gcmVzdWx0ID09PSAwO1xuXHR9XG5cblx0ZXhwb3J0IGNvbnN0IGdyZWF0ZXJUaGFuID0gMTtcblx0ZXhwb3J0IGNvbnN0IGxlc3NUaGFuID0gLTE7XG5cdGV4cG9ydCBjb25zdCBuZWl0aGVyTGVzc09yR3JlYXRlclRoYW4gPSAwO1xufVxuXG4vKipcbiAqIEEgY29tcGFyYXRvciBgY2AgZGVmaW5lcyBhIHRvdGFsIG9yZGVyIGA8PWAgb24gYFRgIGFzIGZvbGxvd2luZzpcbiAqIGBjKGEsIGIpIDw9IDBgIGlmZiBgYWAgPD0gYGJgLlxuICogV2UgYWxzbyBoYXZlIGBjKGEsIGIpID09IDBgIGlmZiBgYyhiLCBhKSA9PSAwYC5cbiovXG5leHBvcnQgdHlwZSBDb21wYXJhdG9yPFQ+ID0gKGE6IFQsIGI6IFQpID0+IENvbXBhcmVSZXN1bHQ7XG5cbmV4cG9ydCBmdW5jdGlvbiBjb21wYXJlQnk8VEl0ZW0sIFRDb21wYXJlQnk+KHNlbGVjdG9yOiAoaXRlbTogVEl0ZW0pID0+IFRDb21wYXJlQnksIGNvbXBhcmF0b3I6IENvbXBhcmF0b3I8VENvbXBhcmVCeT4pOiBDb21wYXJhdG9yPFRJdGVtPiB7XG5cdHJldHVybiAoYSwgYikgPT4gY29tcGFyYXRvcihzZWxlY3RvcihhKSwgc2VsZWN0b3IoYikpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdGllQnJlYWtDb21wYXJhdG9yczxUSXRlbT4oLi4uY29tcGFyYXRvcnM6IENvbXBhcmF0b3I8VEl0ZW0+W10pOiBDb21wYXJhdG9yPFRJdGVtPiB7XG5cdHJldHVybiAoaXRlbTEsIGl0ZW0yKSA9PiB7XG5cdFx0Zm9yIChjb25zdCBjb21wYXJhdG9yIG9mIGNvbXBhcmF0b3JzKSB7XG5cdFx0XHRjb25zdCByZXN1bHQgPSBjb21wYXJhdG9yKGl0ZW0xLCBpdGVtMik7XG5cdFx0XHRpZiAoIUNvbXBhcmVSZXN1bHQuaXNOZWl0aGVyTGVzc09yR3JlYXRlclRoYW4ocmVzdWx0KSkge1xuXHRcdFx0XHRyZXR1cm4gcmVzdWx0O1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gQ29tcGFyZVJlc3VsdC5uZWl0aGVyTGVzc09yR3JlYXRlclRoYW47XG5cdH07XG59XG5cbi8qKlxuICogVGhlIG5hdHVyYWwgb3JkZXIgb24gbnVtYmVycy5cbiovXG5leHBvcnQgY29uc3QgbnVtYmVyQ29tcGFyYXRvcjogQ29tcGFyYXRvcjxudW1iZXI+ID0gKGEsIGIpID0+IGEgLSBiO1xuXG5leHBvcnQgY29uc3QgYm9vbGVhbkNvbXBhcmF0b3I6IENvbXBhcmF0b3I8Ym9vbGVhbj4gPSAoYSwgYikgPT4gbnVtYmVyQ29tcGFyYXRvcihhID8gMSA6IDAsIGIgPyAxIDogMCk7XG5cbmV4cG9ydCBmdW5jdGlvbiByZXZlcnNlT3JkZXI8VEl0ZW0+KGNvbXBhcmF0b3I6IENvbXBhcmF0b3I8VEl0ZW0+KTogQ29tcGFyYXRvcjxUSXRlbT4ge1xuXHRyZXR1cm4gKGEsIGIpID0+IC1jb21wYXJhdG9yKGEsIGIpO1xufVxuXG4vKipcbiAqIFJldHVybnMgYSBuZXcgY29tcGFyYXRvciB0aGF0IHRyZWF0cyBgdW5kZWZpbmVkYCBhcyB0aGUgc21hbGxlc3QgdmFsdWUuXG4gKiBBbGwgb3RoZXIgdmFsdWVzIGFyZSBjb21wYXJlZCB1c2luZyB0aGUgZ2l2ZW4gY29tcGFyYXRvci5cbiovXG5leHBvcnQgZnVuY3Rpb24gY29tcGFyZVVuZGVmaW5lZFNtYWxsZXN0PFQ+KGNvbXBhcmF0b3I6IENvbXBhcmF0b3I8VD4pOiBDb21wYXJhdG9yPFQgfCB1bmRlZmluZWQ+IHtcblx0cmV0dXJuIChhLCBiKSA9PiB7XG5cdFx0aWYgKGEgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIGIgPT09IHVuZGVmaW5lZCA/IENvbXBhcmVSZXN1bHQubmVpdGhlckxlc3NPckdyZWF0ZXJUaGFuIDogQ29tcGFyZVJlc3VsdC5sZXNzVGhhbjtcblx0XHR9IGVsc2UgaWYgKGIgPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0cmV0dXJuIENvbXBhcmVSZXN1bHQuZ3JlYXRlclRoYW47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbXBhcmF0b3IoYSwgYik7XG5cdH07XG59XG5cbmV4cG9ydCBjbGFzcyBBcnJheVF1ZXVlPFQ+IHtcblx0cHJpdmF0ZSBmaXJzdElkeCA9IDA7XG5cdHByaXZhdGUgbGFzdElkeCA9IHRoaXMuaXRlbXMubGVuZ3RoIC0gMTtcblxuXHQvKipcblx0ICogQ29uc3RydWN0cyBhIHF1ZXVlIHRoYXQgaXMgYmFja2VkIGJ5IHRoZSBnaXZlbiBhcnJheS4gUnVudGltZSBpcyBPKDEpLlxuXHQqL1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IGl0ZW1zOiByZWFkb25seSBUW10pIHsgfVxuXG5cdGdldCBsZW5ndGgoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5sYXN0SWR4IC0gdGhpcy5maXJzdElkeCArIDE7XG5cdH1cblxuXHQvKipcblx0ICogQ29uc3VtZXMgZWxlbWVudHMgZnJvbSB0aGUgYmVnaW5uaW5nIG9mIHRoZSBxdWV1ZSBhcyBsb25nIGFzIHRoZSBwcmVkaWNhdGUgcmV0dXJucyB0cnVlLlxuXHQgKiBJZiBubyBlbGVtZW50cyB3ZXJlIGNvbnN1bWVkLCBgbnVsbGAgaXMgcmV0dXJuZWQuIEhhcyBhIHJ1bnRpbWUgb2YgTyhyZXN1bHQubGVuZ3RoKS5cblx0Ki9cblx0dGFrZVdoaWxlKHByZWRpY2F0ZTogKHZhbHVlOiBUKSA9PiBib29sZWFuKTogVFtdIHwgbnVsbCB7XG5cdFx0Ly8gUChrKSA6PSBrIDw9IHRoaXMubGFzdElkeCAmJiBwcmVkaWNhdGUodGhpcy5pdGVtc1trXSlcblx0XHQvLyBGaW5kIHMgOj0gbWluIHsgayB8IGsgPj0gdGhpcy5maXJzdElkeCAmJiAhUChrKSB9IGFuZCByZXR1cm4gdGhpcy5kYXRhW3RoaXMuZmlyc3RJZHguLi5zKVxuXG5cdFx0bGV0IHN0YXJ0SWR4ID0gdGhpcy5maXJzdElkeDtcblx0XHR3aGlsZSAoc3RhcnRJZHggPCB0aGlzLml0ZW1zLmxlbmd0aCAmJiBwcmVkaWNhdGUodGhpcy5pdGVtc1tzdGFydElkeF0pKSB7XG5cdFx0XHRzdGFydElkeCsrO1xuXHRcdH1cblx0XHRjb25zdCByZXN1bHQgPSBzdGFydElkeCA9PT0gdGhpcy5maXJzdElkeCA/IG51bGwgOiB0aGlzLml0ZW1zLnNsaWNlKHRoaXMuZmlyc3RJZHgsIHN0YXJ0SWR4KTtcblx0XHR0aGlzLmZpcnN0SWR4ID0gc3RhcnRJZHg7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdC8qKlxuXHQgKiBDb25zdW1lcyBlbGVtZW50cyBmcm9tIHRoZSBlbmQgb2YgdGhlIHF1ZXVlIGFzIGxvbmcgYXMgdGhlIHByZWRpY2F0ZSByZXR1cm5zIHRydWUuXG5cdCAqIElmIG5vIGVsZW1lbnRzIHdlcmUgY29uc3VtZWQsIGBudWxsYCBpcyByZXR1cm5lZC5cblx0ICogVGhlIHJlc3VsdCBoYXMgdGhlIHNhbWUgb3JkZXIgYXMgdGhlIHVuZGVybHlpbmcgYXJyYXkhXG5cdCovXG5cdHRha2VGcm9tRW5kV2hpbGUocHJlZGljYXRlOiAodmFsdWU6IFQpID0+IGJvb2xlYW4pOiBUW10gfCBudWxsIHtcblx0XHQvLyBQKGspIDo9IHRoaXMuZmlyc3RJZHggPj0gayAmJiBwcmVkaWNhdGUodGhpcy5pdGVtc1trXSlcblx0XHQvLyBGaW5kIHMgOj0gbWF4IHsgayB8IGsgPD0gdGhpcy5sYXN0SWR4ICYmICFQKGspIH0gYW5kIHJldHVybiB0aGlzLmRhdGEocy4uLnRoaXMubGFzdElkeF1cblxuXHRcdGxldCBlbmRJZHggPSB0aGlzLmxhc3RJZHg7XG5cdFx0d2hpbGUgKGVuZElkeCA+PSAwICYmIHByZWRpY2F0ZSh0aGlzLml0ZW1zW2VuZElkeF0pKSB7XG5cdFx0XHRlbmRJZHgtLTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gZW5kSWR4ID09PSB0aGlzLmxhc3RJZHggPyBudWxsIDogdGhpcy5pdGVtcy5zbGljZShlbmRJZHggKyAxLCB0aGlzLmxhc3RJZHggKyAxKTtcblx0XHR0aGlzLmxhc3RJZHggPSBlbmRJZHg7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHBlZWsoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKHRoaXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5pdGVtc1t0aGlzLmZpcnN0SWR4XTtcblx0fVxuXG5cdHBlZWtMYXN0KCk6IFQgfCB1bmRlZmluZWQge1xuXHRcdGlmICh0aGlzLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXNbdGhpcy5sYXN0SWR4XTtcblx0fVxuXG5cdGRlcXVldWUoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5pdGVtc1t0aGlzLmZpcnN0SWR4XTtcblx0XHR0aGlzLmZpcnN0SWR4Kys7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHJlbW92ZUxhc3QoKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5pdGVtc1t0aGlzLmxhc3RJZHhdO1xuXHRcdHRoaXMubGFzdElkeC0tO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHR0YWtlQ291bnQoY291bnQ6IG51bWJlcik6IFRbXSB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5pdGVtcy5zbGljZSh0aGlzLmZpcnN0SWR4LCB0aGlzLmZpcnN0SWR4ICsgY291bnQpO1xuXHRcdHRoaXMuZmlyc3RJZHggKz0gY291bnQ7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxufVxuXG4vKipcbiAqIFRoaXMgY2xhc3MgaXMgZmFzdGVyIHRoYW4gYW4gaXRlcmF0b3IgYW5kIGFycmF5IGZvciBsYXp5IGNvbXB1dGVkIGRhdGEuXG4qL1xuZXhwb3J0IGNsYXNzIENhbGxiYWNrSXRlcmFibGU8VD4ge1xuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IGVtcHR5ID0gbmV3IENhbGxiYWNrSXRlcmFibGU8bmV2ZXI+KF9jYWxsYmFjayA9PiB7IH0pO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdC8qKlxuXHRcdCAqIENhbGxzIHRoZSBjYWxsYmFjayBmb3IgZXZlcnkgaXRlbS5cblx0XHQgKiBTdG9wcyB3aGVuIHRoZSBjYWxsYmFjayByZXR1cm5zIGZhbHNlLlxuXHRcdCovXG5cdFx0cHVibGljIHJlYWRvbmx5IGl0ZXJhdGU6IChjYWxsYmFjazogKGl0ZW06IFQpID0+IGJvb2xlYW4pID0+IHZvaWRcblx0KSB7XG5cdH1cblxuXHRmb3JFYWNoKGhhbmRsZXI6IChpdGVtOiBUKSA9PiB2b2lkKSB7XG5cdFx0dGhpcy5pdGVyYXRlKGl0ZW0gPT4geyBoYW5kbGVyKGl0ZW0pOyByZXR1cm4gdHJ1ZTsgfSk7XG5cdH1cblxuXHR0b0FycmF5KCk6IFRbXSB7XG5cdFx0Y29uc3QgcmVzdWx0OiBUW10gPSBbXTtcblx0XHR0aGlzLml0ZXJhdGUoaXRlbSA9PiB7IHJlc3VsdC5wdXNoKGl0ZW0pOyByZXR1cm4gdHJ1ZTsgfSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGZpbHRlcihwcmVkaWNhdGU6IChpdGVtOiBUKSA9PiBib29sZWFuKTogQ2FsbGJhY2tJdGVyYWJsZTxUPiB7XG5cdFx0cmV0dXJuIG5ldyBDYWxsYmFja0l0ZXJhYmxlKGNiID0+IHRoaXMuaXRlcmF0ZShpdGVtID0+IHByZWRpY2F0ZShpdGVtKSA/IGNiKGl0ZW0pIDogdHJ1ZSkpO1xuXHR9XG5cblx0bWFwPFRSZXN1bHQ+KG1hcEZuOiAoaXRlbTogVCkgPT4gVFJlc3VsdCk6IENhbGxiYWNrSXRlcmFibGU8VFJlc3VsdD4ge1xuXHRcdHJldHVybiBuZXcgQ2FsbGJhY2tJdGVyYWJsZTxUUmVzdWx0PihjYiA9PiB0aGlzLml0ZXJhdGUoaXRlbSA9PiBjYihtYXBGbihpdGVtKSkpKTtcblx0fVxuXG5cdHNvbWUocHJlZGljYXRlOiAoaXRlbTogVCkgPT4gYm9vbGVhbik6IGJvb2xlYW4ge1xuXHRcdGxldCByZXN1bHQgPSBmYWxzZTtcblx0XHR0aGlzLml0ZXJhdGUoaXRlbSA9PiB7IHJlc3VsdCA9IHByZWRpY2F0ZShpdGVtKTsgcmV0dXJuICFyZXN1bHQ7IH0pO1xuXHRcdHJldHVybiByZXN1bHQ7XG5cdH1cblxuXHRmaW5kRmlyc3QocHJlZGljYXRlOiAoaXRlbTogVCkgPT4gYm9vbGVhbik6IFQgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQ6IFQgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5pdGVyYXRlKGl0ZW0gPT4ge1xuXHRcdFx0aWYgKHByZWRpY2F0ZShpdGVtKSkge1xuXHRcdFx0XHRyZXN1bHQgPSBpdGVtO1xuXHRcdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0ZmluZExhc3QocHJlZGljYXRlOiAoaXRlbTogVCkgPT4gYm9vbGVhbik6IFQgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQ6IFQgfCB1bmRlZmluZWQ7XG5cdFx0dGhpcy5pdGVyYXRlKGl0ZW0gPT4ge1xuXHRcdFx0aWYgKHByZWRpY2F0ZShpdGVtKSkge1xuXHRcdFx0XHRyZXN1bHQgPSBpdGVtO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fSk7XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdGZpbmRMYXN0TWF4QnkoY29tcGFyYXRvcjogQ29tcGFyYXRvcjxUPik6IFQgfCB1bmRlZmluZWQge1xuXHRcdGxldCByZXN1bHQ6IFQgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGZpcnN0ID0gdHJ1ZTtcblx0XHR0aGlzLml0ZXJhdGUoaXRlbSA9PiB7XG5cdFx0XHRpZiAoZmlyc3QgfHwgQ29tcGFyZVJlc3VsdC5pc0dyZWF0ZXJUaGFuKGNvbXBhcmF0b3IoaXRlbSwgcmVzdWx0ISkpKSB7XG5cdFx0XHRcdGZpcnN0ID0gZmFsc2U7XG5cdFx0XHRcdHJlc3VsdCA9IGl0ZW07XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9KTtcblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG59XG5cbi8qKlxuICogUmVwcmVzZW50cyBhIHJlLWFycmFuZ2VtZW50IG9mIGl0ZW1zIGluIGFuIGFycmF5LlxuICovXG5leHBvcnQgY2xhc3MgUGVybXV0YXRpb24ge1xuXHRjb25zdHJ1Y3Rvcihwcml2YXRlIHJlYWRvbmx5IF9pbmRleE1hcDogcmVhZG9ubHkgbnVtYmVyW10pIHsgfVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgcGVybXV0YXRpb24gdGhhdCBzb3J0cyB0aGUgZ2l2ZW4gYXJyYXkgYWNjb3JkaW5nIHRvIHRoZSBnaXZlbiBjb21wYXJlIGZ1bmN0aW9uLlxuXHQgKi9cblx0cHVibGljIHN0YXRpYyBjcmVhdGVTb3J0UGVybXV0YXRpb248VD4oYXJyOiByZWFkb25seSBUW10sIGNvbXBhcmVGbjogKGE6IFQsIGI6IFQpID0+IG51bWJlcik6IFBlcm11dGF0aW9uIHtcblx0XHRjb25zdCBzb3J0SW5kaWNlcyA9IEFycmF5LmZyb20oYXJyLmtleXMoKSkuc29ydCgoaW5kZXgxLCBpbmRleDIpID0+IGNvbXBhcmVGbihhcnJbaW5kZXgxXSwgYXJyW2luZGV4Ml0pKTtcblx0XHRyZXR1cm4gbmV3IFBlcm11dGF0aW9uKHNvcnRJbmRpY2VzKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgbmV3IGFycmF5IHdpdGggdGhlIGVsZW1lbnRzIG9mIHRoZSBnaXZlbiBhcnJheSByZS1hcnJhbmdlZCBhY2NvcmRpbmcgdG8gdGhpcyBwZXJtdXRhdGlvbi5cblx0ICovXG5cdGFwcGx5PFQ+KGFycjogcmVhZG9ubHkgVFtdKTogVFtdIHtcblx0XHRyZXR1cm4gYXJyLm1hcCgoXywgaW5kZXgpID0+IGFyclt0aGlzLl9pbmRleE1hcFtpbmRleF1dKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIGEgbmV3IHBlcm11dGF0aW9uIHRoYXQgdW5kb2VzIHRoZSByZS1hcnJhbmdlbWVudCBvZiB0aGlzIHBlcm11dGF0aW9uLlxuXHQqL1xuXHRpbnZlcnNlKCk6IFBlcm11dGF0aW9uIHtcblx0XHRjb25zdCBpbnZlcnNlSW5kZXhNYXAgPSB0aGlzLl9pbmRleE1hcC5zbGljZSgpO1xuXHRcdGZvciAobGV0IGkgPSAwOyBpIDwgdGhpcy5faW5kZXhNYXAubGVuZ3RoOyBpKyspIHtcblx0XHRcdGludmVyc2VJbmRleE1hcFt0aGlzLl9pbmRleE1hcFtpXV0gPSBpO1xuXHRcdH1cblx0XHRyZXR1cm4gbmV3IFBlcm11dGF0aW9uKGludmVyc2VJbmRleE1hcCk7XG5cdH1cbn1cblxuLyoqXG4gKiBBc3luY2hyb25vdXMgdmFyaWFudCBvZiBgQXJyYXkuZmluZCgpYCwgcmV0dXJuaW5nIHRoZSBmaXJzdCBlbGVtZW50IGluXG4gKiB0aGUgYXJyYXkgZm9yIHdoaWNoIHRoZSBwcmVkaWNhdGUgcmV0dXJucyB0cnVlLlxuICpcbiAqIFRoaXMgaW1wbGVtZW50YXRpb24gZG9lcyBub3QgYmFpbCBlYXJseSBhbmQgd2FpdHMgZm9yIGFsbCBwcm9taXNlcyB0b1xuICogcmVzb2x2ZSBiZWZvcmUgcmV0dXJuaW5nLlxuICovXG5leHBvcnQgYXN5bmMgZnVuY3Rpb24gZmluZEFzeW5jPFQ+KGFycmF5OiByZWFkb25seSBUW10sIHByZWRpY2F0ZTogKGVsZW1lbnQ6IFQsIGluZGV4OiBudW1iZXIpID0+IFByb21pc2U8Ym9vbGVhbj4pOiBQcm9taXNlPFQgfCB1bmRlZmluZWQ+IHtcblx0Y29uc3QgcmVzdWx0cyA9IGF3YWl0IFByb21pc2UuYWxsKGFycmF5Lm1hcChcblx0XHRhc3luYyAoZWxlbWVudCwgaW5kZXgpID0+ICh7IGVsZW1lbnQsIG9rOiBhd2FpdCBwcmVkaWNhdGUoZWxlbWVudCwgaW5kZXgpIH0pXG5cdCkpO1xuXG5cdHJldHVybiByZXN1bHRzLmZpbmQociA9PiByLm9rKT8uZWxlbWVudDtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsc0NBQXNDO0FBRS9DLFNBQVMseUJBQXlCO0FBWTNCLFNBQVMsS0FBUSxLQUFvQjtBQUMzQyxNQUFJLElBQUksV0FBVyxHQUFHO0FBQ3JCLFVBQU0sSUFBSSxNQUFNLG1CQUFtQjtBQUFBLEVBQ3BDO0FBRUEsU0FBTyxDQUFDLElBQUksTUFBTSxHQUFHLElBQUksU0FBUyxDQUFDLEdBQUcsSUFBSSxJQUFJLFNBQVMsQ0FBQyxDQUFDO0FBQzFEO0FBRU8sU0FBUyxPQUFVLEtBQW1DLE9BQXFDLGFBQXNDLENBQUMsR0FBRyxNQUFNLE1BQU0sR0FBWTtBQUNuSyxNQUFJLFFBQVEsT0FBTztBQUNsQixXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksQ0FBQyxPQUFPLENBQUMsT0FBTztBQUNuQixXQUFPO0FBQUEsRUFDUjtBQUVBLE1BQUksSUFBSSxXQUFXLE1BQU0sUUFBUTtBQUNoQyxXQUFPO0FBQUEsRUFDUjtBQUVBLFdBQVMsSUFBSSxHQUFHLE1BQU0sSUFBSSxRQUFRLElBQUksS0FBSyxLQUFLO0FBQy9DLFFBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxHQUFHLE1BQU0sQ0FBQyxDQUFDLEdBQUc7QUFDbEMsYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBTU8sU0FBUyw4QkFBaUMsT0FBWUEsUUFBZTtBQUMzRSxRQUFNLE9BQU8sTUFBTSxTQUFTO0FBQzVCLE1BQUlBLFNBQVEsTUFBTTtBQUNqQixVQUFNQSxNQUFLLElBQUksTUFBTSxJQUFJO0FBQUEsRUFDMUI7QUFDQSxRQUFNLElBQUk7QUFDWDtBQWFPLFNBQVMsYUFBZ0IsT0FBeUIsS0FBUSxZQUFnRDtBQUNoSCxTQUFPLGNBQWMsTUFBTSxRQUFRLE9BQUssV0FBVyxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUM7QUFDbEU7QUFpQk8sU0FBUyxjQUFjLFFBQWdCLGNBQWlEO0FBQzlGLE1BQUksTUFBTSxHQUNULE9BQU8sU0FBUztBQUVqQixTQUFPLE9BQU8sTUFBTTtBQUNuQixVQUFNLE9BQVEsTUFBTSxRQUFRLElBQUs7QUFDakMsVUFBTSxPQUFPLGFBQWEsR0FBRztBQUM3QixRQUFJLE9BQU8sR0FBRztBQUNiLFlBQU0sTUFBTTtBQUFBLElBQ2IsV0FBVyxPQUFPLEdBQUc7QUFDcEIsYUFBTyxNQUFNO0FBQUEsSUFDZCxPQUFPO0FBQ04sYUFBTztBQUFBLElBQ1I7QUFBQSxFQUNEO0FBQ0EsU0FBTyxFQUFFLE1BQU07QUFDaEI7QUFLTyxTQUFTLFlBQWUsS0FBYSxNQUFXLFNBQXdCO0FBRTlFLFFBQU0sTUFBTTtBQUVaLE1BQUksT0FBTyxLQUFLLFFBQVE7QUFDdkIsVUFBTSxJQUFJLFVBQVUsZUFBZTtBQUFBLEVBQ3BDO0FBRUEsUUFBTSxhQUFhLEtBQUssS0FBSyxNQUFNLEtBQUssU0FBUyxLQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQy9ELFFBQU0sUUFBYSxDQUFDO0FBQ3BCLFFBQU0sU0FBYyxDQUFDO0FBQ3JCLFFBQU0sU0FBYyxDQUFDO0FBRXJCLGFBQVcsU0FBUyxNQUFNO0FBQ3pCLFVBQU0sTUFBTSxRQUFRLE9BQU8sVUFBVTtBQUNyQyxRQUFJLE1BQU0sR0FBRztBQUNaLFlBQU0sS0FBSyxLQUFLO0FBQUEsSUFDakIsV0FBVyxNQUFNLEdBQUc7QUFDbkIsYUFBTyxLQUFLLEtBQUs7QUFBQSxJQUNsQixPQUFPO0FBQ04sYUFBTyxLQUFLLEtBQUs7QUFBQSxJQUNsQjtBQUFBLEVBQ0Q7QUFFQSxNQUFJLE1BQU0sTUFBTSxRQUFRO0FBQ3ZCLFdBQU8sWUFBWSxLQUFLLE9BQU8sT0FBTztBQUFBLEVBQ3ZDLFdBQVcsTUFBTSxNQUFNLFNBQVMsT0FBTyxRQUFRO0FBQzlDLFdBQU8sT0FBTyxDQUFDO0FBQUEsRUFDaEIsT0FBTztBQUNOLFdBQU8sWUFBWSxPQUFPLE1BQU0sU0FBUyxPQUFPLFNBQVMsUUFBUSxPQUFPO0FBQUEsRUFDekU7QUFDRDtBQUVPLFNBQVMsUUFBVyxNQUF3QixTQUF3QztBQUMxRixRQUFNLFNBQWdCLENBQUM7QUFDdkIsTUFBSSxlQUFnQztBQUNwQyxhQUFXLFdBQVcsS0FBSyxNQUFNLENBQUMsRUFBRSxLQUFLLE9BQU8sR0FBRztBQUNsRCxRQUFJLENBQUMsZ0JBQWdCLFFBQVEsYUFBYSxDQUFDLEdBQUcsT0FBTyxNQUFNLEdBQUc7QUFDN0QscUJBQWUsQ0FBQyxPQUFPO0FBQ3ZCLGFBQU8sS0FBSyxZQUFZO0FBQUEsSUFDekIsT0FBTztBQUNOLG1CQUFhLEtBQUssT0FBTztBQUFBLElBQzFCO0FBQUEsRUFDRDtBQUNBLFNBQU87QUFDUjtBQU9PLFVBQVUsZ0JBQW1CLE9BQW9CLGlCQUFpRTtBQUN4SCxNQUFJO0FBQ0osTUFBSTtBQUNKLGFBQVcsUUFBUSxPQUFPO0FBQ3pCLFFBQUksU0FBUyxVQUFhLGdCQUFnQixNQUFNLElBQUksR0FBRztBQUN0RCxtQkFBYyxLQUFLLElBQUk7QUFBQSxJQUN4QixPQUFPO0FBQ04sVUFBSSxjQUFjO0FBQ2pCLGNBQU07QUFBQSxNQUNQO0FBQ0EscUJBQWUsQ0FBQyxJQUFJO0FBQUEsSUFDckI7QUFDQSxXQUFPO0FBQUEsRUFDUjtBQUNBLE1BQUksY0FBYztBQUNqQixVQUFNO0FBQUEsRUFDUDtBQUNEO0FBRU8sU0FBUyxnQkFBbUIsS0FBVSxHQUErRDtBQUMzRyxXQUFTLElBQUksR0FBRyxLQUFLLElBQUksUUFBUSxLQUFLO0FBQ3JDLE1BQUUsTUFBTSxJQUFJLFNBQVksSUFBSSxJQUFJLENBQUMsR0FBRyxNQUFNLElBQUksU0FBUyxTQUFZLElBQUksQ0FBQyxDQUFDO0FBQUEsRUFDMUU7QUFDRDtBQUVPLFNBQVMscUJBQXdCLEtBQVUsR0FBNEU7QUFDN0gsV0FBUyxJQUFJLEdBQUcsSUFBSSxJQUFJLFFBQVEsS0FBSztBQUNwQyxNQUFFLE1BQU0sSUFBSSxTQUFZLElBQUksSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLEdBQUcsSUFBSSxNQUFNLElBQUksU0FBUyxTQUFZLElBQUksSUFBSSxDQUFDLENBQUM7QUFBQSxFQUMxRjtBQUNEO0FBVU8sU0FBUyxXQUFjLFFBQTBCLE9BQXlCLFNBQStDO0FBQy9ILFFBQU0sU0FBOEIsQ0FBQztBQUVyQyxXQUFTLFdBQVcsT0FBZSxhQUFxQixVQUFxQjtBQUM1RSxRQUFJLGdCQUFnQixLQUFLLFNBQVMsV0FBVyxHQUFHO0FBQy9DO0FBQUEsSUFDRDtBQUVBLFVBQU0sU0FBUyxPQUFPLE9BQU8sU0FBUyxDQUFDO0FBRXZDLFFBQUksVUFBVSxPQUFPLFFBQVEsT0FBTyxnQkFBZ0IsT0FBTztBQUMxRCxhQUFPLGVBQWU7QUFDdEIsYUFBTyxTQUFTLEtBQUssR0FBRyxRQUFRO0FBQUEsSUFDakMsT0FBTztBQUNOLGFBQU8sS0FBSyxFQUFFLE9BQU8sYUFBYSxTQUFTLENBQUM7QUFBQSxJQUM3QztBQUFBLEVBQ0Q7QUFFQSxNQUFJLFlBQVk7QUFDaEIsTUFBSSxXQUFXO0FBRWYsU0FBTyxNQUFNO0FBQ1osUUFBSSxjQUFjLE9BQU8sUUFBUTtBQUNoQyxpQkFBVyxXQUFXLEdBQUcsTUFBTSxNQUFNLFFBQVEsQ0FBQztBQUM5QztBQUFBLElBQ0Q7QUFDQSxRQUFJLGFBQWEsTUFBTSxRQUFRO0FBQzlCLGlCQUFXLFdBQVcsT0FBTyxTQUFTLFdBQVcsQ0FBQyxDQUFDO0FBQ25EO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLE9BQU8sU0FBUztBQUN0QyxVQUFNLGVBQWUsTUFBTSxRQUFRO0FBQ25DLFVBQU0sSUFBSSxRQUFRLGVBQWUsWUFBWTtBQUM3QyxRQUFJLE1BQU0sR0FBRztBQUVaLG1CQUFhO0FBQ2Isa0JBQVk7QUFBQSxJQUNiLFdBQVcsSUFBSSxHQUFHO0FBRWpCLGlCQUFXLFdBQVcsR0FBRyxDQUFDLENBQUM7QUFDM0IsbUJBQWE7QUFBQSxJQUNkLFdBQVcsSUFBSSxHQUFHO0FBRWpCLGlCQUFXLFdBQVcsR0FBRyxDQUFDLFlBQVksQ0FBQztBQUN2QyxrQkFBWTtBQUFBLElBQ2I7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBTU8sU0FBUyxNQUFTLFFBQTBCLE9BQXlCLFNBQStEO0FBQzFJLFFBQU0sVUFBVSxXQUFXLFFBQVEsT0FBTyxPQUFPO0FBQ2pELFFBQU0sVUFBZSxDQUFDO0FBQ3RCLFFBQU0sUUFBYSxDQUFDO0FBRXBCLGFBQVdDLFdBQVUsU0FBUztBQUM3QixZQUFRLEtBQUssR0FBRyxPQUFPLE1BQU1BLFFBQU8sT0FBT0EsUUFBTyxRQUFRQSxRQUFPLFdBQVcsQ0FBQztBQUM3RSxVQUFNLEtBQUssR0FBR0EsUUFBTyxRQUFRO0FBQUEsRUFDOUI7QUFFQSxTQUFPLEVBQUUsU0FBUyxNQUFNO0FBQ3pCO0FBWU8sU0FBUyxJQUFPLE9BQXlCLFNBQWlDLEdBQWdCO0FBQ2hHLE1BQUksTUFBTSxHQUFHO0FBQ1osV0FBTyxDQUFDO0FBQUEsRUFDVDtBQUNBLFFBQU0sU0FBUyxNQUFNLE1BQU0sR0FBRyxDQUFDLEVBQUUsS0FBSyxPQUFPO0FBQzdDLFVBQVEsT0FBTyxTQUFTLFFBQVEsR0FBRyxNQUFNLE1BQU07QUFDL0MsU0FBTztBQUNSO0FBZU8sU0FBUyxTQUFZLE9BQVksU0FBaUMsR0FBVyxPQUFlLE9BQXlDO0FBQzNJLE1BQUksTUFBTSxHQUFHO0FBQ1osV0FBTyxRQUFRLFFBQVEsQ0FBQyxDQUFDO0FBQUEsRUFDMUI7QUFFQSxTQUFPLElBQUksUUFBUSxDQUFDLFNBQVMsV0FBVztBQUN2QyxLQUFDLFlBQVk7QUFDWixZQUFNLElBQUksTUFBTTtBQUNoQixZQUFNLFNBQVMsTUFBTSxNQUFNLEdBQUcsQ0FBQyxFQUFFLEtBQUssT0FBTztBQUM3QyxlQUFTLElBQUksR0FBRyxJQUFJLEtBQUssSUFBSSxJQUFJLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxLQUFLLElBQUksSUFBSSxPQUFPLENBQUMsR0FBRztBQUNyRixZQUFJLElBQUksR0FBRztBQUNWLGdCQUFNLElBQUksUUFBUSxDQUFBQyxhQUFXLFdBQVdBLFFBQU8sQ0FBQztBQUFBLFFBQ2pEO0FBQ0EsWUFBSSxTQUFTLE1BQU0seUJBQXlCO0FBQzNDLGdCQUFNLElBQUksa0JBQWtCO0FBQUEsUUFDN0I7QUFDQSxnQkFBUSxPQUFPLFNBQVMsUUFBUSxHQUFHLENBQUM7QUFBQSxNQUNyQztBQUNBLGFBQU87QUFBQSxJQUNSLEdBQUcsRUFDRCxLQUFLLFNBQVMsTUFBTTtBQUFBLEVBQ3ZCLENBQUM7QUFDRjtBQUVBLFNBQVMsUUFBVyxPQUF5QixTQUFpQyxRQUFhLEdBQVcsR0FBaUI7QUFDdEgsYUFBVyxJQUFJLE9BQU8sUUFBUSxJQUFJLEdBQUcsS0FBSztBQUN6QyxVQUFNLFVBQVUsTUFBTSxDQUFDO0FBQ3ZCLFFBQUksUUFBUSxTQUFTLE9BQU8sSUFBSSxDQUFDLENBQUMsSUFBSSxHQUFHO0FBQ3hDLGFBQU8sSUFBSTtBQUNYLFlBQU0sSUFBSSwrQkFBK0IsUUFBUSxPQUFLLFFBQVEsU0FBUyxDQUFDLElBQUksQ0FBQztBQUM3RSxhQUFPLE9BQU8sR0FBRyxHQUFHLE9BQU87QUFBQSxJQUM1QjtBQUFBLEVBQ0Q7QUFDRDtBQUtPLFNBQVMsU0FBWSxPQUFpRDtBQUM1RSxTQUFPLE1BQU0sT0FBTyxDQUFDLE1BQWMsQ0FBQyxDQUFDLENBQUM7QUFDdkM7QUFLTyxTQUFTLGdCQUFtQixPQUErRDtBQUNqRyxNQUFJLEtBQUs7QUFDVCxXQUFTLElBQUksR0FBRyxJQUFJLE1BQU0sUUFBUSxLQUFLO0FBQ3RDLFFBQUksQ0FBQyxDQUFDLE1BQU0sQ0FBQyxHQUFHO0FBQ2YsWUFBTSxFQUFFLElBQUksTUFBTSxDQUFDO0FBQ25CLFlBQU07QUFBQSxJQUNQO0FBQUEsRUFDRDtBQUNBLFFBQU0sU0FBUztBQUNoQjtBQUtPLFNBQVMsS0FBSyxPQUFrQixNQUFjLElBQWtCO0FBQ3RFLFFBQU0sT0FBTyxJQUFJLEdBQUcsTUFBTSxPQUFPLE1BQU0sQ0FBQyxFQUFFLENBQUMsQ0FBQztBQUM3QztBQUtPLFNBQVMsZUFBZSxLQUFtQjtBQUNqRCxTQUFPLENBQUMsTUFBTSxRQUFRLEdBQUcsS0FBSyxJQUFJLFdBQVc7QUFDOUM7QUFPTyxTQUFTLGdCQUFtQixLQUF1RTtBQUN6RyxTQUFPLE1BQU0sUUFBUSxHQUFHLEtBQUssSUFBSSxTQUFTO0FBQzNDO0FBTU8sU0FBUyxTQUFZLE9BQXlCLFFBQStCLFdBQVMsT0FBWTtBQUN4RyxRQUFNLE9BQU8sb0JBQUksSUFBUztBQUUxQixTQUFPLE1BQU0sT0FBTyxhQUFXO0FBQzlCLFVBQU0sTUFBTSxNQUFPLE9BQU87QUFDMUIsUUFBSSxLQUFLLElBQUksR0FBRyxHQUFHO0FBQ2xCLGFBQU87QUFBQSxJQUNSO0FBQ0EsU0FBSyxJQUFJLEdBQUc7QUFDWixXQUFPO0FBQUEsRUFDUixDQUFDO0FBQ0Y7QUFFTyxTQUFTLGFBQW1CLE9BQXVDO0FBQ3pFLFFBQU0sT0FBTyxvQkFBSSxJQUFPO0FBRXhCLFNBQU8sYUFBVztBQUNqQixVQUFNLE1BQU0sTUFBTSxPQUFPO0FBRXpCLFFBQUksS0FBSyxJQUFJLEdBQUcsR0FBRztBQUNsQixhQUFPO0FBQUEsSUFDUjtBQUVBLFNBQUssSUFBSSxHQUFHO0FBQ1osV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUVPLFNBQVMsbUJBQXNCLEtBQXVCLE9BQXlCQyxVQUFrQyxDQUFDLEdBQUcsTUFBTSxNQUFNLEdBQVc7QUFDbEosTUFBSSxTQUFTO0FBRWIsV0FBUyxJQUFJLEdBQUcsTUFBTSxLQUFLLElBQUksSUFBSSxRQUFRLE1BQU0sTUFBTSxHQUFHLElBQUksT0FBT0EsUUFBTyxJQUFJLENBQUMsR0FBRyxNQUFNLENBQUMsQ0FBQyxHQUFHLEtBQUs7QUFDbkc7QUFBQSxFQUNEO0FBRUEsU0FBTztBQUNSO0FBSU8sU0FBUyxNQUFNLEtBQWEsSUFBdUI7QUFDekQsTUFBSSxPQUFPLE9BQU8sT0FBTyxXQUFXLE1BQU07QUFFMUMsTUFBSSxPQUFPLE9BQU8sVUFBVTtBQUMzQixXQUFPO0FBQUEsRUFDUixPQUFPO0FBQ04sV0FBTztBQUNQLFNBQUs7QUFBQSxFQUNOO0FBRUEsUUFBTSxTQUFtQixDQUFDO0FBRTFCLE1BQUksUUFBUSxJQUFJO0FBQ2YsYUFBUyxJQUFJLE1BQU0sSUFBSSxJQUFJLEtBQUs7QUFDL0IsYUFBTyxLQUFLLENBQUM7QUFBQSxJQUNkO0FBQUEsRUFDRCxPQUFPO0FBQ04sYUFBUyxJQUFJLE1BQU0sSUFBSSxJQUFJLEtBQUs7QUFDL0IsYUFBTyxLQUFLLENBQUM7QUFBQSxJQUNkO0FBQUEsRUFDRDtBQUVBLFNBQU87QUFDUjtBQUlPLFNBQVMsTUFBWSxPQUF5QixTQUEyQixRQUE0QztBQUMzSCxTQUFPLE1BQU0sT0FBTyxDQUFDLEdBQUcsTUFBTTtBQUM3QixNQUFFLFFBQVEsQ0FBQyxDQUFDLElBQUksU0FBUyxPQUFPLENBQUMsSUFBSTtBQUNyQyxXQUFPO0FBQUEsRUFDUixHQUFHLHVCQUFPLE9BQU8sSUFBSSxDQUFDO0FBQ3ZCO0FBUU8sU0FBUyxPQUFVLE9BQVksU0FBd0I7QUFDN0QsUUFBTSxLQUFLLE9BQU87QUFFbEIsU0FBTyxNQUFNLE9BQU8sT0FBTyxPQUFPO0FBQ25DO0FBT08sU0FBUyxPQUFVLE9BQVksU0FBMkI7QUFDaEUsUUFBTUgsU0FBUSxNQUFNLFFBQVEsT0FBTztBQUNuQyxNQUFJQSxTQUFRLElBQUk7QUFDZixVQUFNLE9BQU9BLFFBQU8sQ0FBQztBQUVyQixXQUFPO0FBQUEsRUFDUjtBQUVBLFNBQU87QUFDUjtBQU1PLFNBQVMsWUFBZSxRQUFhLGFBQXFCLFdBQXFCO0FBQ3JGLFFBQU0sU0FBUyxPQUFPLE1BQU0sR0FBRyxXQUFXO0FBQzFDLFFBQU0sUUFBUSxPQUFPLE1BQU0sV0FBVztBQUN0QyxTQUFPLE9BQU8sT0FBTyxXQUFXLEtBQUs7QUFDdEM7QUFLTyxTQUFTLFFBQVcsT0FBWSxPQUFzQjtBQUM1RCxNQUFJO0FBRUosTUFBSSxPQUFPLFVBQVUsVUFBVTtBQUM5QixRQUFJLE9BQU87QUFHWCxXQUFPLE1BQU07QUFDWixZQUFNLElBQUksS0FBSyxJQUFJLE1BQU0sSUFBSTtBQUM3QixhQUFPLElBQUksS0FBSyxNQUFNLENBQUM7QUFBQSxJQUN4QjtBQUFBLEVBQ0QsT0FBTztBQUNOLFdBQU8sS0FBSztBQUFBLEVBQ2I7QUFFQSxXQUFTLElBQUksTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLEtBQUssR0FBRztBQUM3QyxVQUFNLElBQUksS0FBSyxNQUFNLEtBQUssS0FBSyxJQUFJLEVBQUU7QUFDckMsVUFBTSxPQUFPLE1BQU0sQ0FBQztBQUNwQixVQUFNLENBQUMsSUFBSSxNQUFNLENBQUM7QUFDbEIsVUFBTSxDQUFDLElBQUk7QUFBQSxFQUNaO0FBQ0Q7QUFLTyxTQUFTLFlBQWUsS0FBVSxPQUFnQjtBQUN4RCxRQUFNQSxTQUFRLElBQUksUUFBUSxLQUFLO0FBRS9CLE1BQUlBLFNBQVEsSUFBSTtBQUNmLFFBQUksT0FBT0EsUUFBTyxDQUFDO0FBQ25CLFFBQUksUUFBUSxLQUFLO0FBQUEsRUFDbEI7QUFDRDtBQUtPLFNBQVMsVUFBYSxLQUFVLE9BQWdCO0FBQ3RELFFBQU1BLFNBQVEsSUFBSSxRQUFRLEtBQUs7QUFFL0IsTUFBSUEsU0FBUSxJQUFJO0FBQ2YsUUFBSSxPQUFPQSxRQUFPLENBQUM7QUFDbkIsUUFBSSxLQUFLLEtBQUs7QUFBQSxFQUNmO0FBQ0Q7QUFFTyxTQUFTLFNBQVksS0FBVSxPQUErQjtBQUNwRSxhQUFXLFFBQVEsT0FBTztBQUN6QixRQUFJLEtBQUssSUFBSTtBQUFBLEVBQ2Q7QUFDRDtBQUVPLFNBQVMsY0FBb0IsT0FBZ0IsSUFBMEI7QUFDN0UsU0FBTyxNQUFNLFFBQVEsS0FBSyxJQUN6QixNQUFNLElBQUksRUFBRSxJQUNaLEdBQUcsS0FBSztBQUNWO0FBSU8sU0FBUyxRQUFXLEdBQWlCO0FBQzNDLFNBQU8sTUFBTSxRQUFRLENBQUMsSUFBSSxJQUFJLENBQUMsQ0FBQztBQUNqQztBQUVPLFNBQVMsaUJBQW9CLEtBQXlCO0FBQzVELFNBQU8sSUFBSSxLQUFLLE1BQU0sS0FBSyxPQUFPLElBQUksSUFBSSxNQUFNLENBQUM7QUFDbEQ7QUFRTyxTQUFTLFdBQWMsT0FBWSxPQUFlLFVBQXFCO0FBQzdFLFFBQU0sV0FBVyxvQkFBb0IsT0FBTyxLQUFLO0FBQ2pELFFBQU0saUJBQWlCLE1BQU07QUFDN0IsUUFBTSxpQkFBaUIsU0FBUztBQUNoQyxRQUFNLFNBQVMsaUJBQWlCO0FBRWhDLFdBQVMsSUFBSSxpQkFBaUIsR0FBRyxLQUFLLFVBQVUsS0FBSztBQUNwRCxVQUFNLElBQUksY0FBYyxJQUFJLE1BQU0sQ0FBQztBQUFBLEVBQ3BDO0FBRUEsV0FBUyxJQUFJLEdBQUcsSUFBSSxnQkFBZ0IsS0FBSztBQUN4QyxVQUFNLElBQUksUUFBUSxJQUFJLFNBQVMsQ0FBQztBQUFBLEVBQ2pDO0FBQ0Q7QUFVTyxTQUFTLE9BQVUsT0FBWSxPQUFlLGFBQXFCLFVBQW9CO0FBQzdGLFFBQU1BLFNBQVEsb0JBQW9CLE9BQU8sS0FBSztBQUM5QyxNQUFJLFNBQVMsTUFBTSxPQUFPQSxRQUFPLFdBQVc7QUFDNUMsTUFBSSxXQUFXLFFBQVc7QUFFekIsYUFBUyxDQUFDO0FBQUEsRUFDWDtBQUNBLGFBQVcsT0FBT0EsUUFBTyxRQUFRO0FBQ2pDLFNBQU87QUFDUjtBQVNBLFNBQVMsb0JBQXVCLE9BQVksT0FBdUI7QUFDbEUsU0FBTyxRQUFRLElBQUksS0FBSyxJQUFJLFFBQVEsTUFBTSxRQUFRLENBQUMsSUFBSSxLQUFLLElBQUksT0FBTyxNQUFNLE1BQU07QUFDcEY7QUF3Qk8sTUFBTSxPQUFPLENBQ25CLFFBQ0k7QUFDSixTQUFPLENBQUMsUUFBb0M7QUFDM0MsV0FBTyxJQUFJLEdBQUc7QUFBQSxFQUNmO0FBQ0Q7QUFVTyxJQUFVO0FBQUEsQ0FBVixDQUFVSSxtQkFBVjtBQUNDLFdBQVMsV0FBVyxRQUFnQztBQUMxRCxXQUFPLFNBQVM7QUFBQSxFQUNqQjtBQUZPLEVBQUFBLGVBQVM7QUFJVCxXQUFTLGtCQUFrQixRQUFnQztBQUNqRSxXQUFPLFVBQVU7QUFBQSxFQUNsQjtBQUZPLEVBQUFBLGVBQVM7QUFJVCxXQUFTLGNBQWMsUUFBZ0M7QUFDN0QsV0FBTyxTQUFTO0FBQUEsRUFDakI7QUFGTyxFQUFBQSxlQUFTO0FBSVQsV0FBUywyQkFBMkIsUUFBZ0M7QUFDMUUsV0FBTyxXQUFXO0FBQUEsRUFDbkI7QUFGTyxFQUFBQSxlQUFTO0FBSVQsRUFBTUEsZUFBQSxjQUFjO0FBQ3BCLEVBQU1BLGVBQUEsV0FBVztBQUNqQixFQUFNQSxlQUFBLDJCQUEyQjtBQUFBLEdBbkJ4QjtBQTZCVixTQUFTLFVBQTZCLFVBQXVDLFlBQXVEO0FBQzFJLFNBQU8sQ0FBQyxHQUFHLE1BQU0sV0FBVyxTQUFTLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztBQUNyRDtBQUVPLFNBQVMsdUJBQThCLGFBQXFEO0FBQ2xHLFNBQU8sQ0FBQyxPQUFPLFVBQVU7QUFDeEIsZUFBVyxjQUFjLGFBQWE7QUFDckMsWUFBTSxTQUFTLFdBQVcsT0FBTyxLQUFLO0FBQ3RDLFVBQUksQ0FBQyxjQUFjLDJCQUEyQixNQUFNLEdBQUc7QUFDdEQsZUFBTztBQUFBLE1BQ1I7QUFBQSxJQUNEO0FBQ0EsV0FBTyxjQUFjO0FBQUEsRUFDdEI7QUFDRDtBQUtPLE1BQU0sbUJBQXVDLENBQUMsR0FBRyxNQUFNLElBQUk7QUFFM0QsTUFBTSxvQkFBeUMsQ0FBQyxHQUFHLE1BQU0saUJBQWlCLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxDQUFDO0FBRTlGLFNBQVMsYUFBb0IsWUFBa0Q7QUFDckYsU0FBTyxDQUFDLEdBQUcsTUFBTSxDQUFDLFdBQVcsR0FBRyxDQUFDO0FBQ2xDO0FBTU8sU0FBUyx5QkFBNEIsWUFBc0Q7QUFDakcsU0FBTyxDQUFDLEdBQUcsTUFBTTtBQUNoQixRQUFJLE1BQU0sUUFBVztBQUNwQixhQUFPLE1BQU0sU0FBWSxjQUFjLDJCQUEyQixjQUFjO0FBQUEsSUFDakYsV0FBVyxNQUFNLFFBQVc7QUFDM0IsYUFBTyxjQUFjO0FBQUEsSUFDdEI7QUFFQSxXQUFPLFdBQVcsR0FBRyxDQUFDO0FBQUEsRUFDdkI7QUFDRDtBQUVPLE1BQU0sV0FBYztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBTzFCLFlBQTZCLE9BQXFCO0FBQXJCO0FBTjdCLFNBQVEsV0FBVztBQUNuQixTQUFRLFVBQVUsS0FBSyxNQUFNLFNBQVM7QUFBQSxFQUtjO0FBQUEsRUFFcEQsSUFBSSxTQUFpQjtBQUNwQixXQUFPLEtBQUssVUFBVSxLQUFLLFdBQVc7QUFBQSxFQUN2QztBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFNQSxVQUFVLFdBQThDO0FBSXZELFFBQUksV0FBVyxLQUFLO0FBQ3BCLFdBQU8sV0FBVyxLQUFLLE1BQU0sVUFBVSxVQUFVLEtBQUssTUFBTSxRQUFRLENBQUMsR0FBRztBQUN2RTtBQUFBLElBQ0Q7QUFDQSxVQUFNLFNBQVMsYUFBYSxLQUFLLFdBQVcsT0FBTyxLQUFLLE1BQU0sTUFBTSxLQUFLLFVBQVUsUUFBUTtBQUMzRixTQUFLLFdBQVc7QUFDaEIsV0FBTztBQUFBLEVBQ1I7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFPQSxpQkFBaUIsV0FBOEM7QUFJOUQsUUFBSSxTQUFTLEtBQUs7QUFDbEIsV0FBTyxVQUFVLEtBQUssVUFBVSxLQUFLLE1BQU0sTUFBTSxDQUFDLEdBQUc7QUFDcEQ7QUFBQSxJQUNEO0FBQ0EsVUFBTSxTQUFTLFdBQVcsS0FBSyxVQUFVLE9BQU8sS0FBSyxNQUFNLE1BQU0sU0FBUyxHQUFHLEtBQUssVUFBVSxDQUFDO0FBQzdGLFNBQUssVUFBVTtBQUNmLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFzQjtBQUNyQixRQUFJLEtBQUssV0FBVyxHQUFHO0FBQ3RCLGFBQU87QUFBQSxJQUNSO0FBQ0EsV0FBTyxLQUFLLE1BQU0sS0FBSyxRQUFRO0FBQUEsRUFDaEM7QUFBQSxFQUVBLFdBQTBCO0FBQ3pCLFFBQUksS0FBSyxXQUFXLEdBQUc7QUFDdEIsYUFBTztBQUFBLElBQ1I7QUFDQSxXQUFPLEtBQUssTUFBTSxLQUFLLE9BQU87QUFBQSxFQUMvQjtBQUFBLEVBRUEsVUFBeUI7QUFDeEIsVUFBTSxTQUFTLEtBQUssTUFBTSxLQUFLLFFBQVE7QUFDdkMsU0FBSztBQUNMLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxhQUE0QjtBQUMzQixVQUFNLFNBQVMsS0FBSyxNQUFNLEtBQUssT0FBTztBQUN0QyxTQUFLO0FBQ0wsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFVBQVUsT0FBb0I7QUFDN0IsVUFBTSxTQUFTLEtBQUssTUFBTSxNQUFNLEtBQUssVUFBVSxLQUFLLFdBQVcsS0FBSztBQUNwRSxTQUFLLFlBQVk7QUFDakIsV0FBTztBQUFBLEVBQ1I7QUFDRDtBQUtPLE1BQU0sb0JBQU4sTUFBTSxrQkFBb0I7QUFBQSxFQUdoQyxZQUtpQixTQUNmO0FBRGU7QUFBQSxFQUVqQjtBQUFBLEVBRUEsUUFBUSxTQUE0QjtBQUNuQyxTQUFLLFFBQVEsVUFBUTtBQUFFLGNBQVEsSUFBSTtBQUFHLGFBQU87QUFBQSxJQUFNLENBQUM7QUFBQSxFQUNyRDtBQUFBLEVBRUEsVUFBZTtBQUNkLFVBQU0sU0FBYyxDQUFDO0FBQ3JCLFNBQUssUUFBUSxVQUFRO0FBQUUsYUFBTyxLQUFLLElBQUk7QUFBRyxhQUFPO0FBQUEsSUFBTSxDQUFDO0FBQ3hELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFPLFdBQXNEO0FBQzVELFdBQU8sSUFBSSxrQkFBaUIsUUFBTSxLQUFLLFFBQVEsVUFBUSxVQUFVLElBQUksSUFBSSxHQUFHLElBQUksSUFBSSxJQUFJLENBQUM7QUFBQSxFQUMxRjtBQUFBLEVBRUEsSUFBYSxPQUF3RDtBQUNwRSxXQUFPLElBQUksa0JBQTBCLFFBQU0sS0FBSyxRQUFRLFVBQVEsR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUM7QUFBQSxFQUNqRjtBQUFBLEVBRUEsS0FBSyxXQUEwQztBQUM5QyxRQUFJLFNBQVM7QUFDYixTQUFLLFFBQVEsVUFBUTtBQUFFLGVBQVMsVUFBVSxJQUFJO0FBQUcsYUFBTyxDQUFDO0FBQUEsSUFBUSxDQUFDO0FBQ2xFLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxVQUFVLFdBQWdEO0FBQ3pELFFBQUk7QUFDSixTQUFLLFFBQVEsVUFBUTtBQUNwQixVQUFJLFVBQVUsSUFBSSxHQUFHO0FBQ3BCLGlCQUFTO0FBQ1QsZUFBTztBQUFBLE1BQ1I7QUFDQSxhQUFPO0FBQUEsSUFDUixDQUFDO0FBQ0QsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFNBQVMsV0FBZ0Q7QUFDeEQsUUFBSTtBQUNKLFNBQUssUUFBUSxVQUFRO0FBQ3BCLFVBQUksVUFBVSxJQUFJLEdBQUc7QUFDcEIsaUJBQVM7QUFBQSxNQUNWO0FBQ0EsYUFBTztBQUFBLElBQ1IsQ0FBQztBQUNELFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxjQUFjLFlBQTBDO0FBQ3ZELFFBQUk7QUFDSixRQUFJLFFBQVE7QUFDWixTQUFLLFFBQVEsVUFBUTtBQUNwQixVQUFJLFNBQVMsY0FBYyxjQUFjLFdBQVcsTUFBTSxNQUFPLENBQUMsR0FBRztBQUNwRSxnQkFBUTtBQUNSLGlCQUFTO0FBQUEsTUFDVjtBQUNBLGFBQU87QUFBQSxJQUNSLENBQUM7QUFDRCxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBdkVhLGtCQUNXLFFBQVEsSUFBSSxrQkFBd0IsZUFBYTtBQUFFLENBQUM7QUFEckUsSUFBTSxtQkFBTjtBQTRFQSxNQUFNLFlBQVk7QUFBQSxFQUN4QixZQUE2QixXQUE4QjtBQUE5QjtBQUFBLEVBQWdDO0FBQUE7QUFBQTtBQUFBO0FBQUEsRUFLN0QsT0FBYyxzQkFBeUIsS0FBbUIsV0FBZ0Q7QUFDekcsVUFBTSxjQUFjLE1BQU0sS0FBSyxJQUFJLEtBQUssQ0FBQyxFQUFFLEtBQUssQ0FBQyxRQUFRLFdBQVcsVUFBVSxJQUFJLE1BQU0sR0FBRyxJQUFJLE1BQU0sQ0FBQyxDQUFDO0FBQ3ZHLFdBQU8sSUFBSSxZQUFZLFdBQVc7QUFBQSxFQUNuQztBQUFBO0FBQUE7QUFBQTtBQUFBLEVBS0EsTUFBUyxLQUF3QjtBQUNoQyxXQUFPLElBQUksSUFBSSxDQUFDLEdBQUdKLFdBQVUsSUFBSSxLQUFLLFVBQVVBLE1BQUssQ0FBQyxDQUFDO0FBQUEsRUFDeEQ7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQUtBLFVBQXVCO0FBQ3RCLFVBQU0sa0JBQWtCLEtBQUssVUFBVSxNQUFNO0FBQzdDLGFBQVMsSUFBSSxHQUFHLElBQUksS0FBSyxVQUFVLFFBQVEsS0FBSztBQUMvQyxzQkFBZ0IsS0FBSyxVQUFVLENBQUMsQ0FBQyxJQUFJO0FBQUEsSUFDdEM7QUFDQSxXQUFPLElBQUksWUFBWSxlQUFlO0FBQUEsRUFDdkM7QUFDRDtBQVNBLGVBQXNCLFVBQWEsT0FBcUIsV0FBb0Y7QUFDM0ksUUFBTSxVQUFVLE1BQU0sUUFBUSxJQUFJLE1BQU07QUFBQSxJQUN2QyxPQUFPLFNBQVNBLFlBQVcsRUFBRSxTQUFTLElBQUksTUFBTSxVQUFVLFNBQVNBLE1BQUssRUFBRTtBQUFBLEVBQzNFLENBQUM7QUFFRCxTQUFPLFFBQVEsS0FBSyxPQUFLLEVBQUUsRUFBRSxHQUFHO0FBQ2pDOyIsCiAgIm5hbWVzIjogWyJpbmRleCIsICJzcGxpY2UiLCAicmVzb2x2ZSIsICJlcXVhbHMiLCAiQ29tcGFyZVJlc3VsdCJdCn0K
