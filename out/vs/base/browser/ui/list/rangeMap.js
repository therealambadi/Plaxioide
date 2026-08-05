import { Range } from "../../../common/range.js";
function groupIntersect(range, groups) {
  const result = [];
  for (const r of groups) {
    if (range.start >= r.range.end) {
      continue;
    }
    if (range.end < r.range.start) {
      break;
    }
    const intersection = Range.intersect(range, r.range);
    if (Range.isEmpty(intersection)) {
      continue;
    }
    result.push({
      range: intersection,
      size: r.size
    });
  }
  return result;
}
function shift({ start, end }, much) {
  return { start: start + much, end: end + much };
}
function consolidate(groups) {
  const result = [];
  let previousGroup = null;
  for (const group of groups) {
    const start = group.range.start;
    const end = group.range.end;
    const size = group.size;
    if (previousGroup && size === previousGroup.size) {
      previousGroup.range.end = end;
      continue;
    }
    previousGroup = { range: { start, end }, size };
    result.push(previousGroup);
  }
  return result;
}
function concat(...groups) {
  return consolidate(groups.reduce((r, g) => r.concat(g), []));
}
class RangeMap {
  constructor(topPadding) {
    this.groups = [];
    this._size = 0;
    this._paddingTop = 0;
    this._paddingTop = topPadding ?? 0;
    this._size = this._paddingTop;
  }
  get paddingTop() {
    return this._paddingTop;
  }
  set paddingTop(paddingTop) {
    this._size = this._size + paddingTop - this._paddingTop;
    this._paddingTop = paddingTop;
  }
  splice(index, deleteCount, items = []) {
    const diff = items.length - deleteCount;
    const before = groupIntersect({ start: 0, end: index }, this.groups);
    const after = groupIntersect({ start: index + deleteCount, end: Number.POSITIVE_INFINITY }, this.groups).map((g) => ({ range: shift(g.range, diff), size: g.size }));
    const middle = items.map((item, i) => ({
      range: { start: index + i, end: index + i + 1 },
      size: item.size
    }));
    this.groups = concat(before, middle, after);
    this._size = this._paddingTop + this.groups.reduce((t, g) => t + g.size * (g.range.end - g.range.start), 0);
  }
  /**
   * Returns the number of items in the range map.
   */
  get count() {
    const len = this.groups.length;
    if (!len) {
      return 0;
    }
    return this.groups[len - 1].range.end;
  }
  /**
   * Returns the sum of the sizes of all items in the range map.
   */
  get size() {
    return this._size;
  }
  /**
   * Returns the index of the item at the given position.
   */
  indexAt(position) {
    if (position < 0) {
      return -1;
    }
    if (position < this._paddingTop) {
      return 0;
    }
    let index = 0;
    let size = this._paddingTop;
    for (const group of this.groups) {
      const count = group.range.end - group.range.start;
      const newSize = size + count * group.size;
      if (position < newSize) {
        return index + Math.floor((position - size) / group.size);
      }
      index += count;
      size = newSize;
    }
    return index;
  }
  /**
   * Returns the index of the item right after the item at the
   * index of the given position.
   */
  indexAfter(position) {
    return Math.min(this.indexAt(position) + 1, this.count);
  }
  /**
   * Returns the start position of the item at the given index.
   */
  positionAt(index) {
    if (index < 0) {
      return -1;
    }
    let position = 0;
    let count = 0;
    for (const group of this.groups) {
      const groupCount = group.range.end - group.range.start;
      const newCount = count + groupCount;
      if (index < newCount) {
        return this._paddingTop + position + (index - count) * group.size;
      }
      position += groupCount * group.size;
      count = newCount;
    }
    return -1;
  }
}
export {
  RangeMap,
  consolidate,
  groupIntersect,
  shift
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2Jyb3dzZXIvdWkvbGlzdC9yYW5nZU1hcC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IElSYW5nZSwgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vcmFuZ2UuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElJdGVtIHtcblx0c2l6ZTogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElSYW5nZWRHcm91cCB7XG5cdHJhbmdlOiBJUmFuZ2U7XG5cdHNpemU6IG51bWJlcjtcbn1cblxuLyoqXG4gKiBSZXR1cm5zIHRoZSBpbnRlcnNlY3Rpb24gYmV0d2VlbiBhIHJhbmdlZCBncm91cCBhbmQgYSByYW5nZS5cbiAqIFJldHVybnMgYFtdYCBpZiB0aGUgaW50ZXJzZWN0aW9uIGlzIGVtcHR5LlxuICovXG5leHBvcnQgZnVuY3Rpb24gZ3JvdXBJbnRlcnNlY3QocmFuZ2U6IElSYW5nZSwgZ3JvdXBzOiBJUmFuZ2VkR3JvdXBbXSk6IElSYW5nZWRHcm91cFtdIHtcblx0Y29uc3QgcmVzdWx0OiBJUmFuZ2VkR3JvdXBbXSA9IFtdO1xuXG5cdGZvciAoY29uc3QgciBvZiBncm91cHMpIHtcblx0XHRpZiAocmFuZ2Uuc3RhcnQgPj0gci5yYW5nZS5lbmQpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGlmIChyYW5nZS5lbmQgPCByLnJhbmdlLnN0YXJ0KSB7XG5cdFx0XHRicmVhaztcblx0XHR9XG5cblx0XHRjb25zdCBpbnRlcnNlY3Rpb24gPSBSYW5nZS5pbnRlcnNlY3QocmFuZ2UsIHIucmFuZ2UpO1xuXG5cdFx0aWYgKFJhbmdlLmlzRW1wdHkoaW50ZXJzZWN0aW9uKSkge1xuXHRcdFx0Y29udGludWU7XG5cdFx0fVxuXG5cdFx0cmVzdWx0LnB1c2goe1xuXHRcdFx0cmFuZ2U6IGludGVyc2VjdGlvbixcblx0XHRcdHNpemU6IHIuc2l6ZVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBTaGlmdHMgYSByYW5nZSBieSB0aGF0IGBtdWNoYC5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIHNoaWZ0KHsgc3RhcnQsIGVuZCB9OiBJUmFuZ2UsIG11Y2g6IG51bWJlcik6IElSYW5nZSB7XG5cdHJldHVybiB7IHN0YXJ0OiBzdGFydCArIG11Y2gsIGVuZDogZW5kICsgbXVjaCB9O1xufVxuXG4vKipcbiAqIENvbnNvbGlkYXRlcyBhIGNvbGxlY3Rpb24gb2YgcmFuZ2VkIGdyb3Vwcy5cbiAqXG4gKiBDb25zb2xpZGF0aW9uIGlzIHRoZSBwcm9jZXNzIG9mIG1lcmdpbmcgY29uc2VjdXRpdmUgcmFuZ2VkIGdyb3Vwc1xuICogdGhhdCBzaGFyZSB0aGUgc2FtZSBgc2l6ZWAuXG4gKi9cbmV4cG9ydCBmdW5jdGlvbiBjb25zb2xpZGF0ZShncm91cHM6IElSYW5nZWRHcm91cFtdKTogSVJhbmdlZEdyb3VwW10ge1xuXHRjb25zdCByZXN1bHQ6IElSYW5nZWRHcm91cFtdID0gW107XG5cdGxldCBwcmV2aW91c0dyb3VwOiBJUmFuZ2VkR3JvdXAgfCBudWxsID0gbnVsbDtcblxuXHRmb3IgKGNvbnN0IGdyb3VwIG9mIGdyb3Vwcykge1xuXHRcdGNvbnN0IHN0YXJ0ID0gZ3JvdXAucmFuZ2Uuc3RhcnQ7XG5cdFx0Y29uc3QgZW5kID0gZ3JvdXAucmFuZ2UuZW5kO1xuXHRcdGNvbnN0IHNpemUgPSBncm91cC5zaXplO1xuXG5cdFx0aWYgKHByZXZpb3VzR3JvdXAgJiYgc2l6ZSA9PT0gcHJldmlvdXNHcm91cC5zaXplKSB7XG5cdFx0XHRwcmV2aW91c0dyb3VwLnJhbmdlLmVuZCA9IGVuZDtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdHByZXZpb3VzR3JvdXAgPSB7IHJhbmdlOiB7IHN0YXJ0LCBlbmQgfSwgc2l6ZSB9O1xuXHRcdHJlc3VsdC5wdXNoKHByZXZpb3VzR3JvdXApO1xuXHR9XG5cblx0cmV0dXJuIHJlc3VsdDtcbn1cblxuLyoqXG4gKiBDb25jYXRlbmF0ZXMgc2V2ZXJhbCBjb2xsZWN0aW9ucyBvZiByYW5nZWQgZ3JvdXBzIGludG8gYSBzaW5nbGVcbiAqIGNvbGxlY3Rpb24uXG4gKi9cbmZ1bmN0aW9uIGNvbmNhdCguLi5ncm91cHM6IElSYW5nZWRHcm91cFtdW10pOiBJUmFuZ2VkR3JvdXBbXSB7XG5cdHJldHVybiBjb25zb2xpZGF0ZShncm91cHMucmVkdWNlKChyLCBnKSA9PiByLmNvbmNhdChnKSwgW10pKTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJUmFuZ2VNYXAge1xuXHRyZWFkb25seSBzaXplOiBudW1iZXI7XG5cdHJlYWRvbmx5IGNvdW50OiBudW1iZXI7XG5cdHBhZGRpbmdUb3A6IG51bWJlcjtcblx0c3BsaWNlKGluZGV4OiBudW1iZXIsIGRlbGV0ZUNvdW50OiBudW1iZXIsIGl0ZW1zPzogSUl0ZW1bXSk6IHZvaWQ7XG5cdGluZGV4QXQocG9zaXRpb246IG51bWJlcik6IG51bWJlcjtcblx0aW5kZXhBZnRlcihwb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyO1xuXHRwb3NpdGlvbkF0KGluZGV4OiBudW1iZXIpOiBudW1iZXI7XG59XG5cbmV4cG9ydCBjbGFzcyBSYW5nZU1hcCBpbXBsZW1lbnRzIElSYW5nZU1hcCB7XG5cblx0cHJpdmF0ZSBncm91cHM6IElSYW5nZWRHcm91cFtdID0gW107XG5cdHByaXZhdGUgX3NpemUgPSAwO1xuXHRwcml2YXRlIF9wYWRkaW5nVG9wID0gMDtcblxuXHRnZXQgcGFkZGluZ1RvcCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fcGFkZGluZ1RvcDtcblx0fVxuXG5cdHNldCBwYWRkaW5nVG9wKHBhZGRpbmdUb3A6IG51bWJlcikge1xuXHRcdHRoaXMuX3NpemUgPSB0aGlzLl9zaXplICsgcGFkZGluZ1RvcCAtIHRoaXMuX3BhZGRpbmdUb3A7XG5cdFx0dGhpcy5fcGFkZGluZ1RvcCA9IHBhZGRpbmdUb3A7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcih0b3BQYWRkaW5nPzogbnVtYmVyKSB7XG5cdFx0dGhpcy5fcGFkZGluZ1RvcCA9IHRvcFBhZGRpbmcgPz8gMDtcblx0XHR0aGlzLl9zaXplID0gdGhpcy5fcGFkZGluZ1RvcDtcblx0fVxuXG5cdHNwbGljZShpbmRleDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyLCBpdGVtczogSUl0ZW1bXSA9IFtdKTogdm9pZCB7XG5cdFx0Y29uc3QgZGlmZiA9IGl0ZW1zLmxlbmd0aCAtIGRlbGV0ZUNvdW50O1xuXHRcdGNvbnN0IGJlZm9yZSA9IGdyb3VwSW50ZXJzZWN0KHsgc3RhcnQ6IDAsIGVuZDogaW5kZXggfSwgdGhpcy5ncm91cHMpO1xuXHRcdGNvbnN0IGFmdGVyID0gZ3JvdXBJbnRlcnNlY3QoeyBzdGFydDogaW5kZXggKyBkZWxldGVDb3VudCwgZW5kOiBOdW1iZXIuUE9TSVRJVkVfSU5GSU5JVFkgfSwgdGhpcy5ncm91cHMpXG5cdFx0XHQubWFwPElSYW5nZWRHcm91cD4oZyA9PiAoeyByYW5nZTogc2hpZnQoZy5yYW5nZSwgZGlmZiksIHNpemU6IGcuc2l6ZSB9KSk7XG5cblx0XHRjb25zdCBtaWRkbGUgPSBpdGVtcy5tYXA8SVJhbmdlZEdyb3VwPigoaXRlbSwgaSkgPT4gKHtcblx0XHRcdHJhbmdlOiB7IHN0YXJ0OiBpbmRleCArIGksIGVuZDogaW5kZXggKyBpICsgMSB9LFxuXHRcdFx0c2l6ZTogaXRlbS5zaXplXG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5ncm91cHMgPSBjb25jYXQoYmVmb3JlLCBtaWRkbGUsIGFmdGVyKTtcblx0XHR0aGlzLl9zaXplID0gdGhpcy5fcGFkZGluZ1RvcCArIHRoaXMuZ3JvdXBzLnJlZHVjZSgodCwgZykgPT4gdCArIChnLnNpemUgKiAoZy5yYW5nZS5lbmQgLSBnLnJhbmdlLnN0YXJ0KSksIDApO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIG51bWJlciBvZiBpdGVtcyBpbiB0aGUgcmFuZ2UgbWFwLlxuXHQgKi9cblx0Z2V0IGNvdW50KCk6IG51bWJlciB7XG5cdFx0Y29uc3QgbGVuID0gdGhpcy5ncm91cHMubGVuZ3RoO1xuXG5cdFx0aWYgKCFsZW4pIHtcblx0XHRcdHJldHVybiAwO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLmdyb3Vwc1tsZW4gLSAxXS5yYW5nZS5lbmQ7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgc3VtIG9mIHRoZSBzaXplcyBvZiBhbGwgaXRlbXMgaW4gdGhlIHJhbmdlIG1hcC5cblx0ICovXG5cdGdldCBzaXplKCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX3NpemU7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgaW5kZXggb2YgdGhlIGl0ZW0gYXQgdGhlIGdpdmVuIHBvc2l0aW9uLlxuXHQgKi9cblx0aW5kZXhBdChwb3NpdGlvbjogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAocG9zaXRpb24gPCAwKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0aWYgKHBvc2l0aW9uIDwgdGhpcy5fcGFkZGluZ1RvcCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0bGV0IGluZGV4ID0gMDtcblx0XHRsZXQgc2l6ZSA9IHRoaXMuX3BhZGRpbmdUb3A7XG5cblx0XHRmb3IgKGNvbnN0IGdyb3VwIG9mIHRoaXMuZ3JvdXBzKSB7XG5cdFx0XHRjb25zdCBjb3VudCA9IGdyb3VwLnJhbmdlLmVuZCAtIGdyb3VwLnJhbmdlLnN0YXJ0O1xuXHRcdFx0Y29uc3QgbmV3U2l6ZSA9IHNpemUgKyAoY291bnQgKiBncm91cC5zaXplKTtcblxuXHRcdFx0aWYgKHBvc2l0aW9uIDwgbmV3U2l6ZSkge1xuXHRcdFx0XHRyZXR1cm4gaW5kZXggKyBNYXRoLmZsb29yKChwb3NpdGlvbiAtIHNpemUpIC8gZ3JvdXAuc2l6ZSk7XG5cdFx0XHR9XG5cblx0XHRcdGluZGV4ICs9IGNvdW50O1xuXHRcdFx0c2l6ZSA9IG5ld1NpemU7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGluZGV4O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdGhlIGluZGV4IG9mIHRoZSBpdGVtIHJpZ2h0IGFmdGVyIHRoZSBpdGVtIGF0IHRoZVxuXHQgKiBpbmRleCBvZiB0aGUgZ2l2ZW4gcG9zaXRpb24uXG5cdCAqL1xuXHRpbmRleEFmdGVyKHBvc2l0aW9uOiBudW1iZXIpOiBudW1iZXIge1xuXHRcdHJldHVybiBNYXRoLm1pbih0aGlzLmluZGV4QXQocG9zaXRpb24pICsgMSwgdGhpcy5jb3VudCk7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgc3RhcnQgcG9zaXRpb24gb2YgdGhlIGl0ZW0gYXQgdGhlIGdpdmVuIGluZGV4LlxuXHQgKi9cblx0cG9zaXRpb25BdChpbmRleDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHRpZiAoaW5kZXggPCAwKSB7XG5cdFx0XHRyZXR1cm4gLTE7XG5cdFx0fVxuXG5cdFx0bGV0IHBvc2l0aW9uID0gMDtcblx0XHRsZXQgY291bnQgPSAwO1xuXG5cdFx0Zm9yIChjb25zdCBncm91cCBvZiB0aGlzLmdyb3Vwcykge1xuXHRcdFx0Y29uc3QgZ3JvdXBDb3VudCA9IGdyb3VwLnJhbmdlLmVuZCAtIGdyb3VwLnJhbmdlLnN0YXJ0O1xuXHRcdFx0Y29uc3QgbmV3Q291bnQgPSBjb3VudCArIGdyb3VwQ291bnQ7XG5cblx0XHRcdGlmIChpbmRleCA8IG5ld0NvdW50KSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wYWRkaW5nVG9wICsgcG9zaXRpb24gKyAoKGluZGV4IC0gY291bnQpICogZ3JvdXAuc2l6ZSk7XG5cdFx0XHR9XG5cblx0XHRcdHBvc2l0aW9uICs9IGdyb3VwQ291bnQgKiBncm91cC5zaXplO1xuXHRcdFx0Y291bnQgPSBuZXdDb3VudDtcblx0XHR9XG5cblx0XHRyZXR1cm4gLTE7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQWlCLGFBQWE7QUFldkIsU0FBUyxlQUFlLE9BQWUsUUFBd0M7QUFDckYsUUFBTSxTQUF5QixDQUFDO0FBRWhDLGFBQVcsS0FBSyxRQUFRO0FBQ3ZCLFFBQUksTUFBTSxTQUFTLEVBQUUsTUFBTSxLQUFLO0FBQy9CO0FBQUEsSUFDRDtBQUVBLFFBQUksTUFBTSxNQUFNLEVBQUUsTUFBTSxPQUFPO0FBQzlCO0FBQUEsSUFDRDtBQUVBLFVBQU0sZUFBZSxNQUFNLFVBQVUsT0FBTyxFQUFFLEtBQUs7QUFFbkQsUUFBSSxNQUFNLFFBQVEsWUFBWSxHQUFHO0FBQ2hDO0FBQUEsSUFDRDtBQUVBLFdBQU8sS0FBSztBQUFBLE1BQ1gsT0FBTztBQUFBLE1BQ1AsTUFBTSxFQUFFO0FBQUEsSUFDVCxDQUFDO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDUjtBQUtPLFNBQVMsTUFBTSxFQUFFLE9BQU8sSUFBSSxHQUFXLE1BQXNCO0FBQ25FLFNBQU8sRUFBRSxPQUFPLFFBQVEsTUFBTSxLQUFLLE1BQU0sS0FBSztBQUMvQztBQVFPLFNBQVMsWUFBWSxRQUF3QztBQUNuRSxRQUFNLFNBQXlCLENBQUM7QUFDaEMsTUFBSSxnQkFBcUM7QUFFekMsYUFBVyxTQUFTLFFBQVE7QUFDM0IsVUFBTSxRQUFRLE1BQU0sTUFBTTtBQUMxQixVQUFNLE1BQU0sTUFBTSxNQUFNO0FBQ3hC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
