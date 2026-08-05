import { arrayInsert } from "../../../base/common/arrays.js";
import { toUint32 } from "../../../base/common/uint.js";
class PrefixSumComputer {
  constructor(values) {
    this.values = values;
    this.prefixSum = new Uint32Array(values.length);
    this.prefixSumValidIndex = new Int32Array(1);
    this.prefixSumValidIndex[0] = -1;
  }
  getCount() {
    return this.values.length;
  }
  insertValues(insertIndex, insertValues) {
    insertIndex = toUint32(insertIndex);
    const oldValues = this.values;
    const oldPrefixSum = this.prefixSum;
    const insertValuesLen = insertValues.length;
    if (insertValuesLen === 0) {
      return false;
    }
    this.values = new Uint32Array(oldValues.length + insertValuesLen);
    this.values.set(oldValues.subarray(0, insertIndex), 0);
    this.values.set(oldValues.subarray(insertIndex), insertIndex + insertValuesLen);
    this.values.set(insertValues, insertIndex);
    if (insertIndex - 1 < this.prefixSumValidIndex[0]) {
      this.prefixSumValidIndex[0] = insertIndex - 1;
    }
    this.prefixSum = new Uint32Array(this.values.length);
    if (this.prefixSumValidIndex[0] >= 0) {
      this.prefixSum.set(oldPrefixSum.subarray(0, this.prefixSumValidIndex[0] + 1));
    }
    return true;
  }
  setValue(index, value) {
    index = toUint32(index);
    value = toUint32(value);
    if (this.values[index] === value) {
      return false;
    }
    this.values[index] = value;
    if (index - 1 < this.prefixSumValidIndex[0]) {
      this.prefixSumValidIndex[0] = index - 1;
    }
    return true;
  }
  removeValues(startIndex, count) {
    startIndex = toUint32(startIndex);
    count = toUint32(count);
    const oldValues = this.values;
    const oldPrefixSum = this.prefixSum;
    if (startIndex >= oldValues.length) {
      return false;
    }
    const maxCount = oldValues.length - startIndex;
    if (count >= maxCount) {
      count = maxCount;
    }
    if (count === 0) {
      return false;
    }
    this.values = new Uint32Array(oldValues.length - count);
    this.values.set(oldValues.subarray(0, startIndex), 0);
    this.values.set(oldValues.subarray(startIndex + count), startIndex);
    this.prefixSum = new Uint32Array(this.values.length);
    if (startIndex - 1 < this.prefixSumValidIndex[0]) {
      this.prefixSumValidIndex[0] = startIndex - 1;
    }
    if (this.prefixSumValidIndex[0] >= 0) {
      this.prefixSum.set(oldPrefixSum.subarray(0, this.prefixSumValidIndex[0] + 1));
    }
    return true;
  }
  getTotalSum() {
    if (this.values.length === 0) {
      return 0;
    }
    return this._getPrefixSum(this.values.length - 1);
  }
  /**
   * Returns the sum of the first `index + 1` many items.
   * @returns `SUM(0 <= j <= index, values[j])`.
   */
  getPrefixSum(index) {
    if (index < 0) {
      return 0;
    }
    index = toUint32(index);
    return this._getPrefixSum(index);
  }
  _getPrefixSum(index) {
    if (index <= this.prefixSumValidIndex[0]) {
      return this.prefixSum[index];
    }
    let startIndex = this.prefixSumValidIndex[0] + 1;
    if (startIndex === 0) {
      this.prefixSum[0] = this.values[0];
      startIndex++;
    }
    if (index >= this.values.length) {
      index = this.values.length - 1;
    }
    for (let i = startIndex; i <= index; i++) {
      this.prefixSum[i] = this.prefixSum[i - 1] + this.values[i];
    }
    this.prefixSumValidIndex[0] = Math.max(this.prefixSumValidIndex[0], index);
    return this.prefixSum[index];
  }
  getIndexOf(sum) {
    sum = Math.floor(sum);
    this.getTotalSum();
    let low = 0;
    let high = this.values.length - 1;
    let mid = 0;
    let midStop = 0;
    let midStart = 0;
    while (low <= high) {
      mid = low + (high - low) / 2 | 0;
      midStop = this.prefixSum[mid];
      midStart = midStop - this.values[mid];
      if (sum < midStart) {
        high = mid - 1;
      } else if (sum >= midStop) {
        low = mid + 1;
      } else {
        break;
      }
    }
    return new PrefixSumIndexOfResult(mid, sum - midStart);
  }
}
class ConstantTimePrefixSumComputer {
  constructor(values) {
    this._values = values;
    this._isValid = false;
    this._validEndIndex = -1;
    this._prefixSum = [];
    this._indexBySum = [];
  }
  /**
   * @returns SUM(0 <= j < values.length, values[j])
   */
  getTotalSum() {
    this._ensureValid();
    return this._indexBySum.length;
  }
  /**
   * Returns the sum of the first `count` many items.
   * @returns `SUM(0 <= j < count, values[j])`.
   */
  getPrefixSum(count) {
    this._ensureValid();
    if (count === 0) {
      return 0;
    }
    return this._prefixSum[count - 1];
  }
  /**
   * @returns `result`, such that `getPrefixSum(result.index) + result.remainder = sum`
   */
  getIndexOf(sum) {
    this._ensureValid();
    const idx = this._indexBySum[sum];
    const viewLinesAbove = idx > 0 ? this._prefixSum[idx - 1] : 0;
    return new PrefixSumIndexOfResult(idx, sum - viewLinesAbove);
  }
  removeValues(start, deleteCount) {
    this._values.splice(start, deleteCount);
    this._invalidate(start);
  }
  insertValues(insertIndex, insertArr) {
    this._values = arrayInsert(this._values, insertIndex, insertArr);
    this._invalidate(insertIndex);
  }
  _invalidate(index) {
    this._isValid = false;
    this._validEndIndex = Math.min(this._validEndIndex, index - 1);
  }
  _ensureValid() {
    if (this._isValid) {
      return;
    }
    for (let i = this._validEndIndex + 1, len = this._values.length; i < len; i++) {
      const value = this._values[i];
      const sumAbove = i > 0 ? this._prefixSum[i - 1] : 0;
      this._prefixSum[i] = sumAbove + value;
      for (let j = 0; j < value; j++) {
        this._indexBySum[sumAbove + j] = i;
      }
    }
    this._prefixSum.length = this._values.length;
    this._indexBySum.length = this._prefixSum[this._prefixSum.length - 1];
    this._isValid = true;
    this._validEndIndex = this._values.length - 1;
  }
  setValue(index, value) {
    if (this._values[index] === value) {
      return;
    }
    this._values[index] = value;
    this._invalidate(index);
  }
}
class PrefixSumIndexOfResult {
  constructor(index, remainder) {
    this.index = index;
    this.remainder = remainder;
    this._prefixSumIndexOfResultBrand = void 0;
    this.index = index;
    this.remainder = remainder;
  }
}
export {
  ConstantTimePrefixSumComputer,
  PrefixSumComputer,
  PrefixSumIndexOfResult
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL21vZGVsL3ByZWZpeFN1bUNvbXB1dGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgYXJyYXlJbnNlcnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgdG9VaW50MzIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi91aW50LmpzJztcblxuZXhwb3J0IGNsYXNzIFByZWZpeFN1bUNvbXB1dGVyIHtcblxuXHQvKipcblx0ICogdmFsdWVzW2ldIGlzIHRoZSB2YWx1ZSBhdCBpbmRleCBpXG5cdCAqL1xuXHRwcml2YXRlIHZhbHVlczogVWludDMyQXJyYXk7XG5cblx0LyoqXG5cdCAqIHByZWZpeFN1bVtpXSA9IFNVTShoZWlnaHRzW2pdKSwgMCA8PSBqIDw9IGlcblx0ICovXG5cdHByaXZhdGUgcHJlZml4U3VtOiBVaW50MzJBcnJheTtcblxuXHQvKipcblx0ICogcHJlZml4U3VtW2ldLCAwIDw9IGkgPD0gcHJlZml4U3VtVmFsaWRJbmRleCBjYW4gYmUgdHJ1c3RlZFxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBwcmVmaXhTdW1WYWxpZEluZGV4OiBJbnQzMkFycmF5O1xuXG5cdGNvbnN0cnVjdG9yKHZhbHVlczogVWludDMyQXJyYXkpIHtcblx0XHR0aGlzLnZhbHVlcyA9IHZhbHVlcztcblx0XHR0aGlzLnByZWZpeFN1bSA9IG5ldyBVaW50MzJBcnJheSh2YWx1ZXMubGVuZ3RoKTtcblx0XHR0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXggPSBuZXcgSW50MzJBcnJheSgxKTtcblx0XHR0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0gPSAtMTtcblx0fVxuXG5cdHB1YmxpYyBnZXRDb3VudCgpOiBudW1iZXIge1xuXHRcdHJldHVybiB0aGlzLnZhbHVlcy5sZW5ndGg7XG5cdH1cblxuXHRwdWJsaWMgaW5zZXJ0VmFsdWVzKGluc2VydEluZGV4OiBudW1iZXIsIGluc2VydFZhbHVlczogVWludDMyQXJyYXkpOiBib29sZWFuIHtcblx0XHRpbnNlcnRJbmRleCA9IHRvVWludDMyKGluc2VydEluZGV4KTtcblx0XHRjb25zdCBvbGRWYWx1ZXMgPSB0aGlzLnZhbHVlcztcblx0XHRjb25zdCBvbGRQcmVmaXhTdW0gPSB0aGlzLnByZWZpeFN1bTtcblx0XHRjb25zdCBpbnNlcnRWYWx1ZXNMZW4gPSBpbnNlcnRWYWx1ZXMubGVuZ3RoO1xuXG5cdFx0aWYgKGluc2VydFZhbHVlc0xlbiA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsdWVzID0gbmV3IFVpbnQzMkFycmF5KG9sZFZhbHVlcy5sZW5ndGggKyBpbnNlcnRWYWx1ZXNMZW4pO1xuXHRcdHRoaXMudmFsdWVzLnNldChvbGRWYWx1ZXMuc3ViYXJyYXkoMCwgaW5zZXJ0SW5kZXgpLCAwKTtcblx0XHR0aGlzLnZhbHVlcy5zZXQob2xkVmFsdWVzLnN1YmFycmF5KGluc2VydEluZGV4KSwgaW5zZXJ0SW5kZXggKyBpbnNlcnRWYWx1ZXNMZW4pO1xuXHRcdHRoaXMudmFsdWVzLnNldChpbnNlcnRWYWx1ZXMsIGluc2VydEluZGV4KTtcblxuXHRcdGlmIChpbnNlcnRJbmRleCAtIDEgPCB0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0pIHtcblx0XHRcdHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSA9IGluc2VydEluZGV4IC0gMTtcblx0XHR9XG5cblx0XHR0aGlzLnByZWZpeFN1bSA9IG5ldyBVaW50MzJBcnJheSh0aGlzLnZhbHVlcy5sZW5ndGgpO1xuXHRcdGlmICh0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0gPj0gMCkge1xuXHRcdFx0dGhpcy5wcmVmaXhTdW0uc2V0KG9sZFByZWZpeFN1bS5zdWJhcnJheSgwLCB0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0gKyAxKSk7XG5cdFx0fVxuXHRcdHJldHVybiB0cnVlO1xuXHR9XG5cblx0cHVibGljIHNldFZhbHVlKGluZGV4OiBudW1iZXIsIHZhbHVlOiBudW1iZXIpOiBib29sZWFuIHtcblx0XHRpbmRleCA9IHRvVWludDMyKGluZGV4KTtcblx0XHR2YWx1ZSA9IHRvVWludDMyKHZhbHVlKTtcblxuXHRcdGlmICh0aGlzLnZhbHVlc1tpbmRleF0gPT09IHZhbHVlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHRcdHRoaXMudmFsdWVzW2luZGV4XSA9IHZhbHVlO1xuXHRcdGlmIChpbmRleCAtIDEgPCB0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0pIHtcblx0XHRcdHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSA9IGluZGV4IC0gMTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgcmVtb3ZlVmFsdWVzKHN0YXJ0SW5kZXg6IG51bWJlciwgY291bnQ6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdHN0YXJ0SW5kZXggPSB0b1VpbnQzMihzdGFydEluZGV4KTtcblx0XHRjb3VudCA9IHRvVWludDMyKGNvdW50KTtcblxuXHRcdGNvbnN0IG9sZFZhbHVlcyA9IHRoaXMudmFsdWVzO1xuXHRcdGNvbnN0IG9sZFByZWZpeFN1bSA9IHRoaXMucHJlZml4U3VtO1xuXG5cdFx0aWYgKHN0YXJ0SW5kZXggPj0gb2xkVmFsdWVzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdGNvbnN0IG1heENvdW50ID0gb2xkVmFsdWVzLmxlbmd0aCAtIHN0YXJ0SW5kZXg7XG5cdFx0aWYgKGNvdW50ID49IG1heENvdW50KSB7XG5cdFx0XHRjb3VudCA9IG1heENvdW50O1xuXHRcdH1cblxuXHRcdGlmIChjb3VudCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHRoaXMudmFsdWVzID0gbmV3IFVpbnQzMkFycmF5KG9sZFZhbHVlcy5sZW5ndGggLSBjb3VudCk7XG5cdFx0dGhpcy52YWx1ZXMuc2V0KG9sZFZhbHVlcy5zdWJhcnJheSgwLCBzdGFydEluZGV4KSwgMCk7XG5cdFx0dGhpcy52YWx1ZXMuc2V0KG9sZFZhbHVlcy5zdWJhcnJheShzdGFydEluZGV4ICsgY291bnQpLCBzdGFydEluZGV4KTtcblxuXHRcdHRoaXMucHJlZml4U3VtID0gbmV3IFVpbnQzMkFycmF5KHRoaXMudmFsdWVzLmxlbmd0aCk7XG5cdFx0aWYgKHN0YXJ0SW5kZXggLSAxIDwgdGhpcy5wcmVmaXhTdW1WYWxpZEluZGV4WzBdKSB7XG5cdFx0XHR0aGlzLnByZWZpeFN1bVZhbGlkSW5kZXhbMF0gPSBzdGFydEluZGV4IC0gMTtcblx0XHR9XG5cdFx0aWYgKHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSA+PSAwKSB7XG5cdFx0XHR0aGlzLnByZWZpeFN1bS5zZXQob2xkUHJlZml4U3VtLnN1YmFycmF5KDAsIHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSArIDEpKTtcblx0XHR9XG5cdFx0cmV0dXJuIHRydWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0VG90YWxTdW0oKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy52YWx1ZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gMDtcblx0XHR9XG5cdFx0cmV0dXJuIHRoaXMuX2dldFByZWZpeFN1bSh0aGlzLnZhbHVlcy5sZW5ndGggLSAxKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBSZXR1cm5zIHRoZSBzdW0gb2YgdGhlIGZpcnN0IGBpbmRleCArIDFgIG1hbnkgaXRlbXMuXG5cdCAqIEByZXR1cm5zIGBTVU0oMCA8PSBqIDw9IGluZGV4LCB2YWx1ZXNbal0pYC5cblx0ICovXG5cdHB1YmxpYyBnZXRQcmVmaXhTdW0oaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKGluZGV4IDwgMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXG5cdFx0aW5kZXggPSB0b1VpbnQzMihpbmRleCk7XG5cdFx0cmV0dXJuIHRoaXMuX2dldFByZWZpeFN1bShpbmRleCk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRQcmVmaXhTdW0oaW5kZXg6IG51bWJlcik6IG51bWJlciB7XG5cdFx0aWYgKGluZGV4IDw9IHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSkge1xuXHRcdFx0cmV0dXJuIHRoaXMucHJlZml4U3VtW2luZGV4XTtcblx0XHR9XG5cblx0XHRsZXQgc3RhcnRJbmRleCA9IHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSArIDE7XG5cdFx0aWYgKHN0YXJ0SW5kZXggPT09IDApIHtcblx0XHRcdHRoaXMucHJlZml4U3VtWzBdID0gdGhpcy52YWx1ZXNbMF07XG5cdFx0XHRzdGFydEluZGV4Kys7XG5cdFx0fVxuXG5cdFx0aWYgKGluZGV4ID49IHRoaXMudmFsdWVzLmxlbmd0aCkge1xuXHRcdFx0aW5kZXggPSB0aGlzLnZhbHVlcy5sZW5ndGggLSAxO1xuXHRcdH1cblxuXHRcdGZvciAobGV0IGkgPSBzdGFydEluZGV4OyBpIDw9IGluZGV4OyBpKyspIHtcblx0XHRcdHRoaXMucHJlZml4U3VtW2ldID0gdGhpcy5wcmVmaXhTdW1baSAtIDFdICsgdGhpcy52YWx1ZXNbaV07XG5cdFx0fVxuXHRcdHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSA9IE1hdGgubWF4KHRoaXMucHJlZml4U3VtVmFsaWRJbmRleFswXSwgaW5kZXgpO1xuXHRcdHJldHVybiB0aGlzLnByZWZpeFN1bVtpbmRleF07XG5cdH1cblxuXHRwdWJsaWMgZ2V0SW5kZXhPZihzdW06IG51bWJlcik6IFByZWZpeFN1bUluZGV4T2ZSZXN1bHQge1xuXHRcdHN1bSA9IE1hdGguZmxvb3Ioc3VtKTtcblxuXHRcdC8vIENvbXB1dGUgYWxsIHN1bXMgKHRvIGdldCBhIGZ1bGx5IHZhbGlkIHByZWZpeFN1bSlcblx0XHR0aGlzLmdldFRvdGFsU3VtKCk7XG5cblx0XHRsZXQgbG93ID0gMDtcblx0XHRsZXQgaGlnaCA9IHRoaXMudmFsdWVzLmxlbmd0aCAtIDE7XG5cdFx0bGV0IG1pZCA9IDA7XG5cdFx0bGV0IG1pZFN0b3AgPSAwO1xuXHRcdGxldCBtaWRTdGFydCA9IDA7XG5cblx0XHR3aGlsZSAobG93IDw9IGhpZ2gpIHtcblx0XHRcdG1pZCA9IGxvdyArICgoaGlnaCAtIGxvdykgLyAyKSB8IDA7XG5cblx0XHRcdG1pZFN0b3AgPSB0aGlzLnByZWZpeFN1bVttaWRdO1xuXHRcdFx0bWlkU3RhcnQgPSBtaWRTdG9wIC0gdGhpcy52YWx1ZXNbbWlkXTtcblxuXHRcdFx0aWYgKHN1bSA8IG1pZFN0YXJ0KSB7XG5cdFx0XHRcdGhpZ2ggPSBtaWQgLSAxO1xuXHRcdFx0fSBlbHNlIGlmIChzdW0gPj0gbWlkU3RvcCkge1xuXHRcdFx0XHRsb3cgPSBtaWQgKyAxO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5ldyBQcmVmaXhTdW1JbmRleE9mUmVzdWx0KG1pZCwgc3VtIC0gbWlkU3RhcnQpO1xuXHR9XG59XG5cbi8qKlxuICoge0BsaW5rIGdldEluZGV4T2Z9IGhhcyBhbiBhbW9ydGl6ZWQgcnVudGltZSBjb21wbGV4aXR5IG9mIE8oMSkuXG4gKlxuICogKHtAbGluayBQcmVmaXhTdW1Db21wdXRlci5nZXRJbmRleE9mfSBpcyBqdXN0ICBPKGxvZyBuKSlcbiovXG5leHBvcnQgY2xhc3MgQ29uc3RhbnRUaW1lUHJlZml4U3VtQ29tcHV0ZXIge1xuXHRwcml2YXRlIF92YWx1ZXM6IG51bWJlcltdO1xuXHRwcml2YXRlIF9pc1ZhbGlkOiBib29sZWFuO1xuXHRwcml2YXRlIF92YWxpZEVuZEluZGV4OiBudW1iZXI7XG5cblx0LyoqXG5cdCAqIF9wcmVmaXhTdW1baV0gPSBTVU0odmFsdWVzW2pdKSwgMCA8PSBqIDw9IGlcblx0ICovXG5cdHByaXZhdGUgX3ByZWZpeFN1bTogbnVtYmVyW107XG5cblx0LyoqXG5cdCAqIF9pbmRleEJ5U3VtW3N1bV0gPSBpZHggPT4gX3ByZWZpeFN1bVtpZHggLSAxXSA8PSBzdW0gPCBfcHJlZml4U3VtW2lkeF1cblx0Ki9cblx0cHJpdmF0ZSBfaW5kZXhCeVN1bTogbnVtYmVyW107XG5cblx0Y29uc3RydWN0b3IodmFsdWVzOiBudW1iZXJbXSkge1xuXHRcdHRoaXMuX3ZhbHVlcyA9IHZhbHVlcztcblx0XHR0aGlzLl9pc1ZhbGlkID0gZmFsc2U7XG5cdFx0dGhpcy5fdmFsaWRFbmRJbmRleCA9IC0xO1xuXHRcdHRoaXMuX3ByZWZpeFN1bSA9IFtdO1xuXHRcdHRoaXMuX2luZGV4QnlTdW0gPSBbXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyBTVU0oMCA8PSBqIDwgdmFsdWVzLmxlbmd0aCwgdmFsdWVzW2pdKVxuXHQgKi9cblx0cHVibGljIGdldFRvdGFsU3VtKCk6IG51bWJlciB7XG5cdFx0dGhpcy5fZW5zdXJlVmFsaWQoKTtcblx0XHRyZXR1cm4gdGhpcy5faW5kZXhCeVN1bS5sZW5ndGg7XG5cdH1cblxuXHQvKipcblx0ICogUmV0dXJucyB0aGUgc3VtIG9mIHRoZSBmaXJzdCBgY291bnRgIG1hbnkgaXRlbXMuXG5cdCAqIEByZXR1cm5zIGBTVU0oMCA8PSBqIDwgY291bnQsIHZhbHVlc1tqXSlgLlxuXHQgKi9cblx0cHVibGljIGdldFByZWZpeFN1bShjb3VudDogbnVtYmVyKTogbnVtYmVyIHtcblx0XHR0aGlzLl9lbnN1cmVWYWxpZCgpO1xuXHRcdGlmIChjb3VudCA9PT0gMCkge1xuXHRcdFx0cmV0dXJuIDA7XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzLl9wcmVmaXhTdW1bY291bnQgLSAxXTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAcmV0dXJucyBgcmVzdWx0YCwgc3VjaCB0aGF0IGBnZXRQcmVmaXhTdW0ocmVzdWx0LmluZGV4KSArIHJlc3VsdC5yZW1haW5kZXIgPSBzdW1gXG5cdCAqL1xuXHRwdWJsaWMgZ2V0SW5kZXhPZihzdW06IG51bWJlcik6IFByZWZpeFN1bUluZGV4T2ZSZXN1bHQge1xuXHRcdHRoaXMuX2Vuc3VyZVZhbGlkKCk7XG5cdFx0Y29uc3QgaWR4ID0gdGhpcy5faW5kZXhCeVN1bVtzdW1dO1xuXHRcdGNvbnN0IHZpZXdMaW5lc0Fib3ZlID0gaWR4ID4gMCA/IHRoaXMuX3ByZWZpeFN1bVtpZHggLSAxXSA6IDA7XG5cdFx0cmV0dXJuIG5ldyBQcmVmaXhTdW1JbmRleE9mUmVzdWx0KGlkeCwgc3VtIC0gdmlld0xpbmVzQWJvdmUpO1xuXHR9XG5cblx0cHVibGljIHJlbW92ZVZhbHVlcyhzdGFydDogbnVtYmVyLCBkZWxldGVDb3VudDogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fdmFsdWVzLnNwbGljZShzdGFydCwgZGVsZXRlQ291bnQpO1xuXHRcdHRoaXMuX2ludmFsaWRhdGUoc3RhcnQpO1xuXHR9XG5cblx0cHVibGljIGluc2VydFZhbHVlcyhpbnNlcnRJbmRleDogbnVtYmVyLCBpbnNlcnRBcnI6IG51bWJlcltdKTogdm9pZCB7XG5cdFx0dGhpcy5fdmFsdWVzID0gYXJyYXlJbnNlcnQodGhpcy5fdmFsdWVzLCBpbnNlcnRJbmRleCwgaW5zZXJ0QXJyKTtcblx0XHR0aGlzLl9pbnZhbGlkYXRlKGluc2VydEluZGV4KTtcblx0fVxuXG5cdHByaXZhdGUgX2ludmFsaWRhdGUoaW5kZXg6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2lzVmFsaWQgPSBmYWxzZTtcblx0XHR0aGlzLl92YWxpZEVuZEluZGV4ID0gTWF0aC5taW4odGhpcy5fdmFsaWRFbmRJbmRleCwgaW5kZXggLSAxKTtcblx0fVxuXG5cdHByaXZhdGUgX2Vuc3VyZVZhbGlkKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9pc1ZhbGlkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Zm9yIChsZXQgaSA9IHRoaXMuX3ZhbGlkRW5kSW5kZXggKyAxLCBsZW4gPSB0aGlzLl92YWx1ZXMubGVuZ3RoOyBpIDwgbGVuOyBpKyspIHtcblx0XHRcdGNvbnN0IHZhbHVlID0gdGhpcy5fdmFsdWVzW2ldO1xuXHRcdFx0Y29uc3Qgc3VtQWJvdmUgPSBpID4gMCA/IHRoaXMuX3ByZWZpeFN1bVtpIC0gMV0gOiAwO1xuXG5cdFx0XHR0aGlzLl9wcmVmaXhTdW1baV0gPSBzdW1BYm92ZSArIHZhbHVlO1xuXHRcdFx0Zm9yIChsZXQgaiA9IDA7IGogPCB2YWx1ZTsgaisrKSB7XG5cdFx0XHRcdHRoaXMuX2luZGV4QnlTdW1bc3VtQWJvdmUgKyBqXSA9IGk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gdHJpbSB0aGluZ3Ncblx0XHR0aGlzLl9wcmVmaXhTdW0ubGVuZ3RoID0gdGhpcy5fdmFsdWVzLmxlbmd0aDtcblx0XHR0aGlzLl9pbmRleEJ5U3VtLmxlbmd0aCA9IHRoaXMuX3ByZWZpeFN1bVt0aGlzLl9wcmVmaXhTdW0ubGVuZ3RoIC0gMV07XG5cblx0XHQvLyBtYXJrIGFzIHZhbGlkXG5cdFx0dGhpcy5faXNWYWxpZCA9IHRydWU7XG5cdFx0dGhpcy5fdmFsaWRFbmRJbmRleCA9IHRoaXMuX3ZhbHVlcy5sZW5ndGggLSAxO1xuXHR9XG5cblx0cHVibGljIHNldFZhbHVlKGluZGV4OiBudW1iZXIsIHZhbHVlOiBudW1iZXIpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fdmFsdWVzW2luZGV4XSA9PT0gdmFsdWUpIHtcblx0XHRcdC8vIG5vIGNoYW5nZVxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHR0aGlzLl92YWx1ZXNbaW5kZXhdID0gdmFsdWU7XG5cdFx0dGhpcy5faW52YWxpZGF0ZShpbmRleCk7XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgUHJlZml4U3VtSW5kZXhPZlJlc3VsdCB7XG5cdF9wcmVmaXhTdW1JbmRleE9mUmVzdWx0QnJhbmQ6IHZvaWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGluZGV4OiBudW1iZXIsXG5cdFx0cHVibGljIHJlYWRvbmx5IHJlbWFpbmRlcjogbnVtYmVyXG5cdCkge1xuXHRcdHRoaXMuaW5kZXggPSBpbmRleDtcblx0XHR0aGlzLnJlbWFpbmRlciA9IHJlbWFpbmRlcjtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxnQkFBZ0I7QUFFbEIsTUFBTSxrQkFBa0I7QUFBQSxFQWlCOUIsWUFBWSxRQUFxQjtBQUNoQyxTQUFLLFNBQVM7QUFDZCxTQUFLLFlBQVksSUFBSSxZQUFZLE9BQU8sTUFBTTtBQUM5QyxTQUFLLHNCQUFzQixJQUFJLFdBQVcsQ0FBQztBQUMzQyxTQUFLLG9CQUFvQixDQUFDLElBQUk7QUFBQSxFQUMvQjtBQUFBLEVBRU8sV0FBbUI7QUFDekIsV0FBTyxLQUFLLE9BQU87QUFBQSxFQUNwQjtBQUFBLEVBRU8sYUFBYSxhQUFxQixjQUFvQztBQUM1RSxrQkFBYyxTQUFTLFdBQVc7QUFDbEMsVUFBTSxZQUFZLEtBQUs7QUFDdkIsVUFBTSxlQUFlLEtBQUs7QUFDMUIsVUFBTSxrQkFBa0IsYUFBYTtBQUVyQyxRQUFJLG9CQUFvQixHQUFHO0FBQzFCLGFBQU87QUFBQSxJQUNSO0FBRUEsU0FBSyxTQUFTLElBQUksWUFBWSxVQUFVLFNBQVMsZUFBZTtBQUNoRSxTQUFLLE9BQU8sSUFBSSxVQUFVLFNBQVMsR0FBRyxXQUFXLEdB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
