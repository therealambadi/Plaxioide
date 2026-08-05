import { shuffle } from "./arrays.js";
import { CharCode } from "./charCode.js";
import { compare, compareIgnoreCase, compareSubstring, compareSubstringIgnoreCase } from "./strings.js";
class StringIterator {
  constructor() {
    this._value = "";
    this._pos = 0;
  }
  reset(key) {
    this._value = key;
    this._pos = 0;
    return this;
  }
  next() {
    this._pos += 1;
    return this;
  }
  hasNext() {
    return this._pos < this._value.length - 1;
  }
  cmp(a) {
    const aCode = a.charCodeAt(0);
    const thisCode = this._value.charCodeAt(this._pos);
    return aCode - thisCode;
  }
  value() {
    return this._value[this._pos];
  }
}
class ConfigKeysIterator {
  constructor(_caseSensitive = true) {
    this._caseSensitive = _caseSensitive;
  }
  reset(key) {
    this._value = key;
    this._from = 0;
    this._to = 0;
    return this.next();
  }
  hasNext() {
    return this._to < this._value.length;
  }
  next() {
    this._from = this._to;
    let justSeps = true;
    for (; this._to < this._value.length; this._to++) {
      const ch = this._value.charCodeAt(this._to);
      if (ch === CharCode.Period) {
        if (justSeps) {
          this._from++;
        } else {
          break;
        }
      } else {
        justSeps = false;
      }
    }
    return this;
  }
  cmp(a) {
    return this._caseSensitive ? compareSubstring(a, this._value, 0, a.length, this._from, this._to) : compareSubstringIgnoreCase(a, this._value, 0, a.length, this._from, this._to);
  }
  value() {
    return this._value.substring(this._from, this._to);
  }
}
class PathIterator {
  constructor(_splitOnBackslash = true, _caseSensitive = true) {
    this._splitOnBackslash = _splitOnBackslash;
    this._caseSensitive = _caseSensitive;
  }
  reset(key) {
    this._from = 0;
    this._to = 0;
    this._value = key;
    this._valueLen = key.length;
    for (let pos = key.length - 1; pos >= 0; pos--, this._valueLen--) {
      const ch = this._value.charCodeAt(pos);
      if (!(ch === CharCode.Slash || this._splitOnBackslash && ch === CharCode.Backslash)) {
        break;
      }
    }
    return this.next();
  }
  hasNext() {
    return this._to < this._valueLen;
  }
  next() {
    this._from = this._to;
    let justSeps = true;
    for (; this._to < this._valueLen; this._to++) {
      const ch = this._value.charCodeAt(this._to);
      if (ch === CharCode.Slash || this._splitOnBackslash && ch === CharCode.Backslash) {
        if (justSeps) {
          this._from++;
        } else {
          break;
        }
      } else {
        justSeps = false;
      }
    }
    return this;
  }
  cmp(a) {
    return this._caseSensitive ? compareSubstring(a, this._value, 0, a.length, this._from, this._to) : compareSubstringIgnoreCase(a, this._value, 0, a.length, this._from, this._to);
  }
  value() {
    return this._value.substring(this._from, this._to);
  }
}
var UriIteratorState = /* @__PURE__ */ ((UriIteratorState2) => {
  UriIteratorState2[UriIteratorState2["Scheme"] = 1] = "Scheme";
  UriIteratorState2[UriIteratorState2["Authority"] = 2] = "Authority";
  UriIteratorState2[UriIteratorState2["Path"] = 3] = "Path";
  UriIteratorState2[UriIteratorState2["Query"] = 4] = "Query";
  UriIteratorState2[UriIteratorState2["Fragment"] = 5] = "Fragment";
  return UriIteratorState2;
})(UriIteratorState || {});
class UriIterator {
  constructor(_ignorePathCasing, _ignoreQueryAndFragment) {
    this._ignorePathCasing = _ignorePathCasing;
    this._ignoreQueryAndFragment = _ignoreQueryAndFragment;
    this._states = [];
    this._stateIdx = 0;
  }
  reset(key) {
    this._value = key;
    this._states = [];
    if (this._value.scheme) {
      this._states.push(1 /* Scheme */);
    }
    if (this._value.authority) {
      this._states.push(2 /* Authority */);
    }
    if (this._value.path) {
      this._pathIterator = new PathIterator(false, !this._ignorePathCasing(key));
      this._pathIterator.reset(key.path);
      if (this._pathIterator.value()) {
        this._states.push(3 /* Path */);
      }
    }
    if (!this._ignoreQueryAndFragment(key)) {
      if (this._value.query) {
        this._states.push(4 /* Query */);
      }
      if (this._value.fragment) {
        this._states.push(5 /* Fragment */);
      }
    }
    this._stateIdx = 0;
    return this;
  }
  next() {
    if (this._states[this._stateIdx] === 3 /* Path */ && this._pathIterator.hasNext()) {
      this._pathIterator.next();
    } else {
      this._stateIdx += 1;
    }
    return this;
  }
  hasNext() {
    return this._states[this._stateIdx] === 3 /* Path */ && this._pathIterator.hasNext() || this._stateIdx < this._states.length - 1;
  }
  cmp(a) {
    if (this._states[this._stateIdx] === 1 /* Scheme */) {
      return compareIgnoreCase(a, this._value.scheme);
    } else if (this._states[this._stateIdx] === 2 /* Authority */) {
      return compareIgnoreCase(a, this._value.authority);
    } else if (this._states[this._stateIdx] === 3 /* Path */) {
      return this._pathIterator.cmp(a);
    } else if (this._states[this._stateIdx] === 4 /* Query */) {
      return compare(a, this._value.query);
    } else if (this._states[this._stateIdx] === 5 /* Fragment */) {
      return compare(a, this._value.fragment);
    }
    throw new Error();
  }
  value() {
    if (this._states[this._stateIdx] === 1 /* Scheme */) {
      return this._value.scheme;
    } else if (this._states[this._stateIdx] === 2 /* Authority */) {
      return this._value.authority;
    } else if (this._states[this._stateIdx] === 3 /* Path */) {
      return this._pathIterator.value();
    } else if (this._states[this._stateIdx] === 4 /* Query */) {
      return this._value.query;
    } else if (this._states[this._stateIdx] === 5 /* Fragment */) {
      return this._value.fragment;
    }
    throw new Error();
  }
}
const _Undef = class _Undef {
  static wrap(value) {
    return value === void 0 ? _Undef.Val : value;
  }
  static unwrap(value) {
    return value === _Undef.Val ? void 0 : value;
  }
};
_Undef.Val = Symbol("undefined_placeholder");
let Undef = _Undef;
class TernarySearchTreeNode {
  constructor() {
    this.height = 1;
  }
  isEmpty() {
    return !this.left && !this.mid && !this.right && this.value === void 0;
  }
  rotateLeft() {
    const tmp = this.right;
    this.right = tmp.left;
    tmp.left = this;
    this.updateHeight();
    tmp.updateHeight();
    return tmp;
  }
  rotateRight() {
    const tmp = this.left;
    this.left = tmp.right;
    tmp.right = this;
    this.updateHeight();
    tmp.updateHeight();
    return tmp;
  }
  updateHeight() {
    this.height = 1 + Math.max(this.heightLeft, this.heightRight);
  }
  balanceFactor() {
    return this.heightRight - this.heightLeft;
  }
  get heightLeft() {
    return this.left?.height ?? 0;
  }
  get heightRight() {
    return this.right?.height ?? 0;
  }
}
var Dir = /* @__PURE__ */ ((Dir2) => {
  Dir2[Dir2["Left"] = -1] = "Left";
  Dir2[Dir2["Mid"] = 0] = "Mid";
  Dir2[Dir2["Right"] = 1] = "Right";
  return Dir2;
})(Dir || {});
class TernarySearchTree {
  static forUris(ignorePathCasing = () => false, ignoreQueryAndFragment = () => false) {
    return new TernarySearchTree(new UriIterator(ignorePathCasing, ignoreQueryAndFragment));
  }
  static forPaths(ignorePathCasing = false) {
    return new TernarySearchTree(new PathIterator(void 0, !ignorePathCasing));
  }
  static forStrings() {
    return new TernarySearchTree(new StringIterator());
  }
  static forConfigKeys() {
    return new TernarySearchTree(new ConfigKeysIterator());
  }
  constructor(segments) {
    this._iter = segments;
  }
  clear() {
    this._root = void 0;
  }
  fill(values, keys) {
    if (keys) {
      const arr = keys.slice(0);
      shuffle(arr);
      for (const k of arr) {
        this.set(k, values);
      }
    } else {
      const arr = values.slice(0);
      shuffle(arr);
      for (const entry of arr) {
        this.set(entry[0], entry[1]);
      }
    }
  }
  set(key, element) {
    const iter = this._iter.reset(key);
    let node;
    if (!this._root) {
      this._root = new TernarySearchTreeNode();
      this._root.segment = iter.value();
    }
    const stack = [];
    node = this._root;
    while (true) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        if (!node.left) {
          node.left = new TernarySearchTreeNode();
          node.left.segment = iter.value();
        }
        stack.push([-1 /* Left */, node]);
        node = node.left;
      } else if (val < 0) {
        if (!node.right) {
          node.right = new TernarySearchTreeNode();
          node.right.segment = iter.value();
        }
        stack.push([1 /* Right */, node]);
        node = node.right;
      } else if (iter.hasNext()) {
        iter.next();
        if (!node.mid) {
          node.mid = new TernarySearchTreeNode();
          node.mid.segment = iter.value();
        }
        stack.push([0 /* Mid */, node]);
        node = node.mid;
      } else {
        break;
      }
    }
    const oldElement = Undef.unwrap(node.value);
    node.value = Undef.wrap(element);
    node.key = key;
    for (let i = stack.length - 1; i >= 0; i--) {
      const node2 = stack[i][1];
      node2.updateHeight();
      const bf = node2.balanceFactor();
      if (bf < -1 || bf > 1) {
        const d1 = stack[i][0];
        const d2 = stack[i + 1][0];
        if (d1 === 1 /* Right */ && d2 === 1 /* Right */) {
          stack[i][1] = node2.rotateLeft();
        } else if (d1 === -1 /* Left */ && d2 === -1 /* Left */) {
          stack[i][1] = node2.rotateRight();
        } else if (d1 === 1 /* Right */ && d2 === -1 /* Left */) {
          node2.right = stack[i + 1][1] = stack[i + 1][1].rotateRight();
          stack[i][1] = node2.rotateLeft();
        } else if (d1 === -1 /* Left */ && d2 === 1 /* Right */) {
          node2.left = stack[i + 1][1] = stack[i + 1][1].rotateLeft();
          stack[i][1] = node2.rotateRight();
        } else {
          throw new Error();
        }
        if (i > 0) {
          switch (stack[i - 1][0]) {
            case -1 /* Left */:
              stack[i - 1][1].left = stack[i][1];
              break;
            case 1 /* Right */:
              stack[i - 1][1].right = stack[i][1];
              break;
            case 0 /* Mid */:
              stack[i - 1][1].mid = stack[i][1];
              break;
          }
        } else {
          this._root = stack[0][1];
        }
      }
    }
    return oldElement;
  }
  get(key) {
    return Undef.unwrap(this._getNode(key)?.value);
  }
  _getNode(key) {
    const iter = this._iter.reset(key);
    let node = this._root;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        node = node.left;
      } else if (val < 0) {
        node = node.right;
      } else if (iter.hasNext()) {
        iter.next();
        node = node.mid;
      } else {
        break;
      }
    }
    return node;
  }
  has(key) {
    const node = this._getNode(key);
    return !(node?.value === void 0 && node?.mid === void 0);
  }
  delete(key) {
    return this._delete(key, false);
  }
  deleteSuperstr(key) {
    return this._delete(key, true);
  }
  _delete(key, superStr) {
    const iter = this._iter.reset(key);
    const stack = [];
    let node = this._root;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        stack.push([-1 /* Left */, node]);
        node = node.left;
      } else if (val < 0) {
        stack.push([1 /* Right */, node]);
        node = node.right;
      } else if (iter.hasNext()) {
        iter.next();
        stack.push([0 /* Mid */, node]);
        node = node.mid;
      } else {
        break;
      }
    }
    if (!node) {
      return;
    }
    if (superStr) {
      node.left = void 0;
      node.mid = void 0;
      node.right = void 0;
      node.height = 1;
    } else {
      node.key = void 0;
      node.value = void 0;
    }
    if (!node.mid && !node.value) {
      if (node.left && node.right) {
        const min = this._min(node.right);
        if (min.key) {
          const { key: key2, value, segment } = min;
          this._delete(min.key, false);
          node.key = key2;
          node.value = value;
          node.segment = segment;
        }
      } else {
        const newChild = node.left ?? node.right;
        if (stack.length > 0) {
          const [dir, parent] = stack[stack.length - 1];
          switch (dir) {
            case -1 /* Left */:
              parent.left = newChild;
              break;
            case 0 /* Mid */:
              parent.mid = newChild;
              break;
            case 1 /* Right */:
              parent.right = newChild;
              break;
          }
        } else {
          this._root = newChild;
        }
      }
    }
    for (let i = stack.length - 1; i >= 0; i--) {
      const node2 = stack[i][1];
      node2.updateHeight();
      const bf = node2.balanceFactor();
      if (bf > 1) {
        if (node2.right.balanceFactor() >= 0) {
          stack[i][1] = node2.rotateLeft();
        } else {
          node2.right = node2.right.rotateRight();
          stack[i][1] = node2.rotateLeft();
        }
      } else if (bf < -1) {
        if (node2.left.balanceFactor() <= 0) {
          stack[i][1] = node2.rotateRight();
        } else {
          node2.left = node2.left.rotateLeft();
          stack[i][1] = node2.rotateRight();
        }
      }
      if (i > 0) {
        switch (stack[i - 1][0]) {
          case -1 /* Left */:
            stack[i - 1][1].left = stack[i][1];
            break;
          case 1 /* Right */:
            stack[i - 1][1].right = stack[i][1];
            break;
          case 0 /* Mid */:
            stack[i - 1][1].mid = stack[i][1];
            break;
        }
      } else {
        this._root = stack[0][1];
      }
    }
  }
  _min(node) {
    while (node.left) {
      node = node.left;
    }
    return node;
  }
  findSubstr(key) {
    const iter = this._iter.reset(key);
    let node = this._root;
    let candidate = void 0;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        node = node.left;
      } else if (val < 0) {
        node = node.right;
      } else if (iter.hasNext()) {
        iter.next();
        candidate = Undef.unwrap(node.value) || candidate;
        node = node.mid;
      } else {
        break;
      }
    }
    return node && Undef.unwrap(node.value) || candidate;
  }
  findSuperstr(key) {
    return this._findSuperstrOrElement(key, false);
  }
  _findSuperstrOrElement(key, allowValue) {
    const iter = this._iter.reset(key);
    let node = this._root;
    while (node) {
      const val = iter.cmp(node.segment);
      if (val > 0) {
        node = node.left;
      } else if (val < 0) {
        node = node.right;
      } else if (iter.hasNext()) {
        iter.next();
        node = node.mid;
      } else {
        if (!node.mid) {
          if (allowValue) {
            return Undef.unwrap(node.value);
          } else {
            return void 0;
          }
        } else {
          return this._entries(node.mid);
        }
      }
    }
    return void 0;
  }
  hasElementOrSubtree(key) {
    return this._findSuperstrOrElement(key, true) !== void 0;
  }
  forEach(callback) {
    for (const [key, value] of this) {
      callback(value, key);
    }
  }
  *[Symbol.iterator]() {
    yield* this._entries(this._root);
  }
  _entries(node) {
    const result = [];
    this._dfsEntries(node, result);
    return result[Symbol.iterator]();
  }
  _dfsEntries(node, bucket) {
    if (!node) {
      return;
    }
    if (node.left) {
      this._dfsEntries(node.left, bucket);
    }
    if (node.value !== void 0) {
      bucket.push([node.key, Undef.unwrap(node.value)]);
    }
    if (node.mid) {
      this._dfsEntries(node.mid, bucket);
    }
    if (node.right) {
      this._dfsEntries(node.right, bucket);
    }
  }
  // for debug/testing
  _isBalanced() {
    const nodeIsBalanced = (node) => {
      if (!node) {
        return true;
      }
      const bf = node.balanceFactor();
      if (bf < -1 || bf > 1) {
        return false;
      }
      return nodeIsBalanced(node.left) && nodeIsBalanced(node.right);
    };
    return nodeIsBalanced(this._root);
  }
}
export {
  ConfigKeysIterator,
  PathIterator,
  StringIterator,
  TernarySearchTree,
  UriIterator
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi90ZXJuYXJ5U2VhcmNoVHJlZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHNodWZmbGUgfSBmcm9tICcuL2FycmF5cy5qcyc7XG5pbXBvcnQgeyBDaGFyQ29kZSB9IGZyb20gJy4vY2hhckNvZGUuanMnO1xuaW1wb3J0IHsgY29tcGFyZSwgY29tcGFyZUlnbm9yZUNhc2UsIGNvbXBhcmVTdWJzdHJpbmcsIGNvbXBhcmVTdWJzdHJpbmdJZ25vcmVDYXNlIH0gZnJvbSAnLi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4vdXJpLmpzJztcblxuZXhwb3J0IGludGVyZmFjZSBJS2V5SXRlcmF0b3I8Sz4ge1xuXHRyZXNldChrZXk6IEspOiB0aGlzO1xuXHRuZXh0KCk6IHRoaXM7XG5cblx0aGFzTmV4dCgpOiBib29sZWFuO1xuXHRjbXAoYTogc3RyaW5nKTogbnVtYmVyO1xuXHR2YWx1ZSgpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBTdHJpbmdJdGVyYXRvciBpbXBsZW1lbnRzIElLZXlJdGVyYXRvcjxzdHJpbmc+IHtcblxuXHRwcml2YXRlIF92YWx1ZTogc3RyaW5nID0gJyc7XG5cdHByaXZhdGUgX3BvczogbnVtYmVyID0gMDtcblxuXHRyZXNldChrZXk6IHN0cmluZyk6IHRoaXMge1xuXHRcdHRoaXMuX3ZhbHVlID0ga2V5O1xuXHRcdHRoaXMuX3BvcyA9IDA7XG5cdFx0cmV0dXJuIHRoaXM7XG5cdH1cblxuXHRuZXh0KCk6IHRoaXMge1xuXHRcdHRoaXMuX3BvcyArPSAxO1xuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0aGFzTmV4dCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcG9zIDwgdGhpcy5fdmFsdWUubGVuZ3RoIC0gMTtcblx0fVxuXG5cdGNtcChhOiBzdHJpbmcpOiBudW1iZXIge1xuXHRcdGNvbnN0IGFDb2RlID0gYS5jaGFyQ29kZUF0KDApO1xuXHRcdGNvbnN0IHRoaXNDb2RlID0gdGhpcy5fdmFsdWUuY2hhckNvZGVBdCh0aGlzLl9wb3MpO1xuXHRcdHJldHVybiBhQ29kZSAtIHRoaXNDb2RlO1xuXHR9XG5cblx0dmFsdWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fdmFsdWVbdGhpcy5fcG9zXTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ29uZmlnS2V5c0l0ZXJhdG9yIGltcGxlbWVudHMgSUtleUl0ZXJhdG9yPHN0cmluZz4ge1xuXG5cdHByaXZhdGUgX3ZhbHVlITogc3RyaW5nO1xuXHRwcml2YXRlIF9mcm9tITogbnVtYmVyO1xuXHRwcml2YXRlIF90byE6IG51bWJlcjtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jYXNlU2Vuc2l0aXZlOiBib29sZWFuID0gdHJ1ZVxuXHQpIHsgfVxuXG5cdHJlc2V0KGtleTogc3RyaW5nKTogdGhpcyB7XG5cdFx0dGhpcy5fdmFsdWUgPSBrZXk7XG5cdFx0dGhpcy5fZnJvbSA9IDA7XG5cdFx0dGhpcy5fdG8gPSAwO1xuXHRcdHJldHVybiB0aGlzLm5leHQoKTtcblx0fVxuXG5cdGhhc05leHQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX3RvIDwgdGhpcy5fdmFsdWUubGVuZ3RoO1xuXHR9XG5cblx0bmV4dCgpOiB0aGlzIHtcblx0XHQvLyB0aGlzLl9kYXRhID0ga2V5LnNwbGl0KC9bXFxcXC9dLykuZmlsdGVyKHMgPT4gISFzKTtcblx0XHR0aGlzLl9mcm9tID0gdGhpcy5fdG87XG5cdFx0bGV0IGp1c3RTZXBzID0gdHJ1ZTtcblx0XHRmb3IgKDsgdGhpcy5fdG8gPCB0aGlzLl92YWx1ZS5sZW5ndGg7IHRoaXMuX3RvKyspIHtcblx0XHRcdGNvbnN0IGNoID0gdGhpcy5fdmFsdWUuY2hhckNvZGVBdCh0aGlzLl90byk7XG5cdFx0XHRpZiAoY2ggPT09IENoYXJDb2RlLlBlcmlvZCkge1xuXHRcdFx0XHRpZiAoanVzdFNlcHMpIHtcblx0XHRcdFx0XHR0aGlzLl9mcm9tKys7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGp1c3RTZXBzID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0Y21wKGE6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2Nhc2VTZW5zaXRpdmVcblx0XHRcdD8gY29tcGFyZVN1YnN0cmluZyhhLCB0aGlzLl92YWx1ZSwgMCwgYS5sZW5ndGgsIHRoaXMuX2Zyb20sIHRoaXMuX3RvKVxuXHRcdFx0OiBjb21wYXJlU3Vic3RyaW5nSWdub3JlQ2FzZShhLCB0aGlzLl92YWx1ZSwgMCwgYS5sZW5ndGgsIHRoaXMuX2Zyb20sIHRoaXMuX3RvKTtcblx0fVxuXG5cdHZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbHVlLnN1YnN0cmluZyh0aGlzLl9mcm9tLCB0aGlzLl90byk7XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIFBhdGhJdGVyYXRvciBpbXBsZW1lbnRzIElLZXlJdGVyYXRvcjxzdHJpbmc+IHtcblxuXHRwcml2YXRlIF92YWx1ZSE6IHN0cmluZztcblx0cHJpdmF0ZSBfdmFsdWVMZW4hOiBudW1iZXI7XG5cdHByaXZhdGUgX2Zyb20hOiBudW1iZXI7XG5cdHByaXZhdGUgX3RvITogbnVtYmVyO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3NwbGl0T25CYWNrc2xhc2g6IGJvb2xlYW4gPSB0cnVlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2Nhc2VTZW5zaXRpdmU6IGJvb2xlYW4gPSB0cnVlXG5cdCkgeyB9XG5cblx0cmVzZXQoa2V5OiBzdHJpbmcpOiB0aGlzIHtcblx0XHR0aGlzLl9mcm9tID0gMDtcblx0XHR0aGlzLl90byA9IDA7XG5cdFx0dGhpcy5fdmFsdWUgPSBrZXk7XG5cdFx0dGhpcy5fdmFsdWVMZW4gPSBrZXkubGVuZ3RoO1xuXHRcdGZvciAobGV0IHBvcyA9IGtleS5sZW5ndGggLSAxOyBwb3MgPj0gMDsgcG9zLS0sIHRoaXMuX3ZhbHVlTGVuLS0pIHtcblx0XHRcdGNvbnN0IGNoID0gdGhpcy5fdmFsdWUuY2hhckNvZGVBdChwb3MpO1xuXHRcdFx0aWYgKCEoY2ggPT09IENoYXJDb2RlLlNsYXNoIHx8IHRoaXMuX3NwbGl0T25CYWNrc2xhc2ggJiYgY2ggPT09IENoYXJDb2RlLkJhY2tzbGFzaCkpIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMubmV4dCgpO1xuXHR9XG5cblx0aGFzTmV4dCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fdG8gPCB0aGlzLl92YWx1ZUxlbjtcblx0fVxuXG5cdG5leHQoKTogdGhpcyB7XG5cdFx0Ly8gdGhpcy5fZGF0YSA9IGtleS5zcGxpdCgvW1xcXFwvXS8pLmZpbHRlcihzID0+ICEhcyk7XG5cdFx0dGhpcy5fZnJvbSA9IHRoaXMuX3RvO1xuXHRcdGxldCBqdXN0U2VwcyA9IHRydWU7XG5cdFx0Zm9yICg7IHRoaXMuX3RvIDwgdGhpcy5fdmFsdWVMZW47IHRoaXMuX3RvKyspIHtcblx0XHRcdGNvbnN0IGNoID0gdGhpcy5fdmFsdWUuY2hhckNvZGVBdCh0aGlzLl90byk7XG5cdFx0XHRpZiAoY2ggPT09IENoYXJDb2RlLlNsYXNoIHx8IHRoaXMuX3NwbGl0T25CYWNrc2xhc2ggJiYgY2ggPT09IENoYXJDb2RlLkJhY2tzbGFzaCkge1xuXHRcdFx0XHRpZiAoanVzdFNlcHMpIHtcblx0XHRcdFx0XHR0aGlzLl9mcm9tKys7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGp1c3RTZXBzID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB0aGlzO1xuXHR9XG5cblx0Y21wKGE6IHN0cmluZyk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2Nhc2VTZW5zaXRpdmVcblx0XHRcdD8gY29tcGFyZVN1YnN0cmluZyhhLCB0aGlzLl92YWx1ZSwgMCwgYS5sZW5ndGgsIHRoaXMuX2Zyb20sIHRoaXMuX3RvKVxuXHRcdFx0OiBjb21wYXJlU3Vic3RyaW5nSWdub3JlQ2FzZShhLCB0aGlzLl92YWx1ZSwgMCwgYS5sZW5ndGgsIHRoaXMuX2Zyb20sIHRoaXMuX3RvKTtcblx0fVxuXG5cdHZhbHVlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhbHVlLnN1YnN0cmluZyh0aGlzLl9mcm9tLCB0aGlzLl90byk7XG5cdH1cbn1cblxuY29uc3QgZW51bSBVcmlJdGVyYXRvclN0YXRlIHtcblx0U2NoZW1lID0gMSwgQXV0aG9yaXR5ID0gMiwgUGF0aCA9IDMsIFF1ZXJ5ID0gNCwgRnJhZ21lbnQgPSA1XG59XG5cbmV4cG9ydCBjbGFzcyBVcmlJdGVyYXRvciBpbXBsZW1lbnRzIElLZXlJdGVyYXRvcjxVUkk+IHtcblxuXHRwcml2YXRlIF9wYXRoSXRlcmF0b3IhOiBQYXRoSXRlcmF0b3I7XG5cdHByaXZhdGUgX3ZhbHVlITogVVJJO1xuXHRwcml2YXRlIF9zdGF0ZXM6IFVyaUl0ZXJhdG9yU3RhdGVbXSA9IFtdO1xuXHRwcml2YXRlIF9zdGF0ZUlkeDogbnVtYmVyID0gMDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9pZ25vcmVQYXRoQ2FzaW5nOiAodXJpOiBVUkkpID0+IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaWdub3JlUXVlcnlBbmRGcmFnbWVudDogKHVyaTogVVJJKSA9PiBib29sZWFuKSB7IH1cblxuXHRyZXNldChrZXk6IFVSSSk6IHRoaXMge1xuXHRcdHRoaXMuX3ZhbHVlID0ga2V5O1xuXHRcdHRoaXMuX3N0YXRlcyA9IFtdO1xuXHRcdGlmICh0aGlzLl92YWx1ZS5zY2hlbWUpIHtcblx0XHRcdHRoaXMuX3N0YXRlcy5wdXNoKFVyaUl0ZXJhdG9yU3RhdGUuU2NoZW1lKTtcblx0XHR9XG5cdFx0aWYgKHRoaXMuX3ZhbHVlLmF1dGhvcml0eSkge1xuXHRcdFx0dGhpcy5fc3RhdGVzLnB1c2goVXJpSXRlcmF0b3JTdGF0ZS5BdXRob3JpdHkpO1xuXHRcdH1cblx0XHRpZiAodGhpcy5fdmFsdWUucGF0aCkge1xuXHRcdFx0dGhpcy5fcGF0aEl0ZXJhdG9yID0gbmV3IFBhdGhJdGVyYXRvcihmYWxzZSwgIXRoaXMuX2lnbm9yZVBhdGhDYXNpbmcoa2V5KSk7XG5cdFx0XHR0aGlzLl9wYXRoSXRlcmF0b3IucmVzZXQoa2V5LnBhdGgpO1xuXHRcdFx0aWYgKHRoaXMuX3BhdGhJdGVyYXRvci52YWx1ZSgpKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXRlcy5wdXNoKFVyaUl0ZXJhdG9yU3RhdGUuUGF0aCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGlmICghdGhpcy5faWdub3JlUXVlcnlBbmRGcmFnbWVudChrZXkpKSB7XG5cdFx0XHRpZiAodGhpcy5fdmFsdWUucXVlcnkpIHtcblx0XHRcdFx0dGhpcy5fc3RhdGVzLnB1c2goVXJpSXRlcmF0b3JTdGF0ZS5RdWVyeSk7XG5cdFx0XHR9XG5cdFx0XHRpZiAodGhpcy5fdmFsdWUuZnJhZ21lbnQpIHtcblx0XHRcdFx0dGhpcy5fc3RhdGVzLnB1c2goVXJpSXRlcmF0b3JTdGF0ZS5GcmFnbWVudCk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX3N0YXRlSWR4ID0gMDtcblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdG5leHQoKTogdGhpcyB7XG5cdFx0aWYgKHRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZUlkeF0gPT09IFVyaUl0ZXJhdG9yU3RhdGUuUGF0aCAmJiB0aGlzLl9wYXRoSXRlcmF0b3IuaGFzTmV4dCgpKSB7XG5cdFx0XHR0aGlzLl9wYXRoSXRlcmF0b3IubmV4dCgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9zdGF0ZUlkeCArPSAxO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGhhc05leHQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICh0aGlzLl9zdGF0ZXNbdGhpcy5fc3RhdGVJZHhdID09PSBVcmlJdGVyYXRvclN0YXRlLlBhdGggJiYgdGhpcy5fcGF0aEl0ZXJhdG9yLmhhc05leHQoKSlcblx0XHRcdHx8IHRoaXMuX3N0YXRlSWR4IDwgdGhpcy5fc3RhdGVzLmxlbmd0aCAtIDE7XG5cdH1cblxuXHRjbXAoYTogc3RyaW5nKTogbnVtYmVyIHtcblx0XHRpZiAodGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlSWR4XSA9PT0gVXJpSXRlcmF0b3JTdGF0ZS5TY2hlbWUpIHtcblx0XHRcdHJldHVybiBjb21wYXJlSWdub3JlQ2FzZShhLCB0aGlzLl92YWx1ZS5zY2hlbWUpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlSWR4XSA9PT0gVXJpSXRlcmF0b3JTdGF0ZS5BdXRob3JpdHkpIHtcblx0XHRcdHJldHVybiBjb21wYXJlSWdub3JlQ2FzZShhLCB0aGlzLl92YWx1ZS5hdXRob3JpdHkpO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlSWR4XSA9PT0gVXJpSXRlcmF0b3JTdGF0ZS5QYXRoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcGF0aEl0ZXJhdG9yLmNtcChhKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZUlkeF0gPT09IFVyaUl0ZXJhdG9yU3RhdGUuUXVlcnkpIHtcblx0XHRcdHJldHVybiBjb21wYXJlKGEsIHRoaXMuX3ZhbHVlLnF1ZXJ5KTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZUlkeF0gPT09IFVyaUl0ZXJhdG9yU3RhdGUuRnJhZ21lbnQpIHtcblx0XHRcdHJldHVybiBjb21wYXJlKGEsIHRoaXMuX3ZhbHVlLmZyYWdtZW50KTtcblx0XHR9XG5cdFx0dGhyb3cgbmV3IEVycm9yKCk7XG5cdH1cblxuXHR2YWx1ZSgpOiBzdHJpbmcge1xuXHRcdGlmICh0aGlzLl9zdGF0ZXNbdGhpcy5fc3RhdGVJZHhdID09PSBVcmlJdGVyYXRvclN0YXRlLlNjaGVtZSkge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3ZhbHVlLnNjaGVtZTtcblx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlc1t0aGlzLl9zdGF0ZUlkeF0gPT09IFVyaUl0ZXJhdG9yU3RhdGUuQXV0aG9yaXR5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWUuYXV0aG9yaXR5O1xuXHRcdH0gZWxzZSBpZiAodGhpcy5fc3RhdGVzW3RoaXMuX3N0YXRlSWR4XSA9PT0gVXJpSXRlcmF0b3JTdGF0ZS5QYXRoKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fcGF0aEl0ZXJhdG9yLnZhbHVlKCk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9zdGF0ZXNbdGhpcy5fc3RhdGVJZHhdID09PSBVcmlJdGVyYXRvclN0YXRlLlF1ZXJ5KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWUucXVlcnk7XG5cdFx0fSBlbHNlIGlmICh0aGlzLl9zdGF0ZXNbdGhpcy5fc3RhdGVJZHhdID09PSBVcmlJdGVyYXRvclN0YXRlLkZyYWdtZW50KSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fdmFsdWUuZnJhZ21lbnQ7XG5cdFx0fVxuXHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHR9XG59XG5cbmFic3RyYWN0IGNsYXNzIFVuZGVmIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgVmFsOiB1bmlxdWUgc3ltYm9sID0gU3ltYm9sKCd1bmRlZmluZWRfcGxhY2Vob2xkZXInKTtcblxuXHRzdGF0aWMgd3JhcDxWPih2YWx1ZTogViB8IHVuZGVmaW5lZCk6IFYgfCB0eXBlb2YgVW5kZWYuVmFsIHtcblx0XHRyZXR1cm4gdmFsdWUgPT09IHVuZGVmaW5lZCA/IFVuZGVmLlZhbCA6IHZhbHVlO1xuXHR9XG5cblx0c3RhdGljIHVud3JhcDxWPih2YWx1ZTogViB8IHR5cGVvZiBVbmRlZi5WYWwpOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdmFsdWUgPT09IFVuZGVmLlZhbCA/IHVuZGVmaW5lZCA6IHZhbHVlIGFzIFY7XG5cdH1cbn1cblxuY2xhc3MgVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+IHtcblx0aGVpZ2h0OiBudW1iZXIgPSAxO1xuXHRzZWdtZW50ITogc3RyaW5nO1xuXHR2YWx1ZTogViB8IHR5cGVvZiBVbmRlZi5WYWwgfCB1bmRlZmluZWQ7XG5cdGtleTogSyB8IHVuZGVmaW5lZDtcblx0bGVmdDogVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+IHwgdW5kZWZpbmVkO1xuXHRtaWQ6IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPiB8IHVuZGVmaW5lZDtcblx0cmlnaHQ6IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPiB8IHVuZGVmaW5lZDtcblxuXHRpc0VtcHR5KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhdGhpcy5sZWZ0ICYmICF0aGlzLm1pZCAmJiAhdGhpcy5yaWdodCAmJiB0aGlzLnZhbHVlID09PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRyb3RhdGVMZWZ0KCkge1xuXHRcdGNvbnN0IHRtcCA9IHRoaXMucmlnaHQhO1xuXHRcdHRoaXMucmlnaHQgPSB0bXAubGVmdDtcblx0XHR0bXAubGVmdCA9IHRoaXM7XG5cdFx0dGhpcy51cGRhdGVIZWlnaHQoKTtcblx0XHR0bXAudXBkYXRlSGVpZ2h0KCk7XG5cdFx0cmV0dXJuIHRtcDtcblx0fVxuXG5cdHJvdGF0ZVJpZ2h0KCkge1xuXHRcdGNvbnN0IHRtcCA9IHRoaXMubGVmdCE7XG5cdFx0dGhpcy5sZWZ0ID0gdG1wLnJpZ2h0O1xuXHRcdHRtcC5yaWdodCA9IHRoaXM7XG5cdFx0dGhpcy51cGRhdGVIZWlnaHQoKTtcblx0XHR0bXAudXBkYXRlSGVpZ2h0KCk7XG5cdFx0cmV0dXJuIHRtcDtcblx0fVxuXG5cdHVwZGF0ZUhlaWdodCgpIHtcblx0XHR0aGlzLmhlaWdodCA9IDEgKyBNYXRoLm1heCh0aGlzLmhlaWdodExlZnQsIHRoaXMuaGVpZ2h0UmlnaHQpO1xuXHR9XG5cblx0YmFsYW5jZUZhY3RvcigpIHtcblx0XHRyZXR1cm4gdGhpcy5oZWlnaHRSaWdodCAtIHRoaXMuaGVpZ2h0TGVmdDtcblx0fVxuXG5cdGdldCBoZWlnaHRMZWZ0KCkge1xuXHRcdHJldHVybiB0aGlzLmxlZnQ/LmhlaWdodCA/PyAwO1xuXHR9XG5cblx0Z2V0IGhlaWdodFJpZ2h0KCkge1xuXHRcdHJldHVybiB0aGlzLnJpZ2h0Py5oZWlnaHQgPz8gMDtcblx0fVxufVxuXG5jb25zdCBlbnVtIERpciB7XG5cdExlZnQgPSAtMSxcblx0TWlkID0gMCxcblx0UmlnaHQgPSAxXG59XG5cbmV4cG9ydCBjbGFzcyBUZXJuYXJ5U2VhcmNoVHJlZTxLLCBWPiB7XG5cblx0c3RhdGljIGZvclVyaXM8RT4oaWdub3JlUGF0aENhc2luZzogKGtleTogVVJJKSA9PiBib29sZWFuID0gKCkgPT4gZmFsc2UsIGlnbm9yZVF1ZXJ5QW5kRnJhZ21lbnQ6IChrZXk6IFVSSSkgPT4gYm9vbGVhbiA9ICgpID0+IGZhbHNlKTogVGVybmFyeVNlYXJjaFRyZWU8VVJJLCBFPiB7XG5cdFx0cmV0dXJuIG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxVUkksIEU+KG5ldyBVcmlJdGVyYXRvcihpZ25vcmVQYXRoQ2FzaW5nLCBpZ25vcmVRdWVyeUFuZEZyYWdtZW50KSk7XG5cdH1cblxuXHRzdGF0aWMgZm9yUGF0aHM8RT4oaWdub3JlUGF0aENhc2luZyA9IGZhbHNlKTogVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBFPiB7XG5cdFx0cmV0dXJuIG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIEU+KG5ldyBQYXRoSXRlcmF0b3IodW5kZWZpbmVkLCAhaWdub3JlUGF0aENhc2luZykpO1xuXHR9XG5cblx0c3RhdGljIGZvclN0cmluZ3M8RT4oKTogVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBFPiB7XG5cdFx0cmV0dXJuIG5ldyBUZXJuYXJ5U2VhcmNoVHJlZTxzdHJpbmcsIEU+KG5ldyBTdHJpbmdJdGVyYXRvcigpKTtcblx0fVxuXG5cdHN0YXRpYyBmb3JDb25maWdLZXlzPEU+KCk6IFRlcm5hcnlTZWFyY2hUcmVlPHN0cmluZywgRT4ge1xuXHRcdHJldHVybiBuZXcgVGVybmFyeVNlYXJjaFRyZWU8c3RyaW5nLCBFPihuZXcgQ29uZmlnS2V5c0l0ZXJhdG9yKCkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXRlcjogSUtleUl0ZXJhdG9yPEs+O1xuXHRwcml2YXRlIF9yb290OiBUZXJuYXJ5U2VhcmNoVHJlZU5vZGU8SywgVj4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3Ioc2VnbWVudHM6IElLZXlJdGVyYXRvcjxLPikge1xuXHRcdHRoaXMuX2l0ZXIgPSBzZWdtZW50cztcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Jvb3QgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHQvKipcblx0ICogRmlsbCB0aGUgdHJlZSB3aXRoIHRoZSBzYW1lIHZhbHVlIG9mIHRoZSBnaXZlbiBrZXlzXG5cdCAqL1xuXHRmaWxsKGVsZW1lbnQ6IFYsIGtleXM6IHJlYWRvbmx5IEtbXSk6IHZvaWQ7XG5cdC8qKlxuXHQgKiBGaWxsIHRoZSB0cmVlIHdpdGggZ2l2ZW4gW2tleSx2YWx1ZV0tdHVwbGVzXG5cdCAqL1xuXHRmaWxsKHZhbHVlczogcmVhZG9ubHkgW0ssIFZdW10pOiB2b2lkO1xuXHRmaWxsKHZhbHVlczogcmVhZG9ubHkgW0ssIFZdW10gfCBWLCBrZXlzPzogcmVhZG9ubHkgS1tdKTogdm9pZCB7XG5cdFx0aWYgKGtleXMpIHtcblx0XHRcdGNvbnN0IGFyciA9IGtleXMuc2xpY2UoMCk7XG5cdFx0XHRzaHVmZmxlKGFycik7XG5cdFx0XHRmb3IgKGNvbnN0IGsgb2YgYXJyKSB7XG5cdFx0XHRcdHRoaXMuc2V0KGssICg8Vj52YWx1ZXMpKTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgYXJyID0gKDxbSywgVl1bXT52YWx1ZXMpLnNsaWNlKDApO1xuXHRcdFx0c2h1ZmZsZShhcnIpO1xuXHRcdFx0Zm9yIChjb25zdCBlbnRyeSBvZiBhcnIpIHtcblx0XHRcdFx0dGhpcy5zZXQoZW50cnlbMF0sIGVudHJ5WzFdKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRzZXQoa2V5OiBLLCBlbGVtZW50OiBWKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgaXRlciA9IHRoaXMuX2l0ZXIucmVzZXQoa2V5KTtcblx0XHRsZXQgbm9kZTogVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+O1xuXG5cdFx0aWYgKCF0aGlzLl9yb290KSB7XG5cdFx0XHR0aGlzLl9yb290ID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPigpO1xuXHRcdFx0dGhpcy5fcm9vdC5zZWdtZW50ID0gaXRlci52YWx1ZSgpO1xuXHRcdH1cblx0XHRjb25zdCBzdGFjazogW0RpciwgVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+XVtdID0gW107XG5cblx0XHQvLyBmaW5kIGluc2VydF9ub2RlXG5cdFx0bm9kZSA9IHRoaXMuX3Jvb3Q7XG5cdFx0d2hpbGUgKHRydWUpIHtcblx0XHRcdGNvbnN0IHZhbCA9IGl0ZXIuY21wKG5vZGUuc2VnbWVudCk7XG5cdFx0XHRpZiAodmFsID4gMCkge1xuXHRcdFx0XHQvLyBsZWZ0XG5cdFx0XHRcdGlmICghbm9kZS5sZWZ0KSB7XG5cdFx0XHRcdFx0bm9kZS5sZWZ0ID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPigpO1xuXHRcdFx0XHRcdG5vZGUubGVmdC5zZWdtZW50ID0gaXRlci52YWx1ZSgpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHN0YWNrLnB1c2goW0Rpci5MZWZ0LCBub2RlXSk7XG5cdFx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cblx0XHRcdH0gZWxzZSBpZiAodmFsIDwgMCkge1xuXHRcdFx0XHQvLyByaWdodFxuXHRcdFx0XHRpZiAoIW5vZGUucmlnaHQpIHtcblx0XHRcdFx0XHRub2RlLnJpZ2h0ID0gbmV3IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPigpO1xuXHRcdFx0XHRcdG5vZGUucmlnaHQuc2VnbWVudCA9IGl0ZXIudmFsdWUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFjay5wdXNoKFtEaXIuUmlnaHQsIG5vZGVdKTtcblx0XHRcdFx0bm9kZSA9IG5vZGUucmlnaHQ7XG5cblx0XHRcdH0gZWxzZSBpZiAoaXRlci5oYXNOZXh0KCkpIHtcblx0XHRcdFx0Ly8gbWlkXG5cdFx0XHRcdGl0ZXIubmV4dCgpO1xuXHRcdFx0XHRpZiAoIW5vZGUubWlkKSB7XG5cdFx0XHRcdFx0bm9kZS5taWQgPSBuZXcgVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+KCk7XG5cdFx0XHRcdFx0bm9kZS5taWQuc2VnbWVudCA9IGl0ZXIudmFsdWUoKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzdGFjay5wdXNoKFtEaXIuTWlkLCBub2RlXSk7XG5cdFx0XHRcdG5vZGUgPSBub2RlLm1pZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNldCB2YWx1ZVxuXHRcdGNvbnN0IG9sZEVsZW1lbnQgPSBVbmRlZi51bndyYXAobm9kZS52YWx1ZSk7XG5cdFx0bm9kZS52YWx1ZSA9IFVuZGVmLndyYXAoZWxlbWVudCk7XG5cdFx0bm9kZS5rZXkgPSBrZXk7XG5cblx0XHQvLyBiYWxhbmNlXG5cdFx0Zm9yIChsZXQgaSA9IHN0YWNrLmxlbmd0aCAtIDE7IGkgPj0gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBub2RlID0gc3RhY2tbaV1bMV07XG5cblx0XHRcdG5vZGUudXBkYXRlSGVpZ2h0KCk7XG5cdFx0XHRjb25zdCBiZiA9IG5vZGUuYmFsYW5jZUZhY3RvcigpO1xuXG5cdFx0XHRpZiAoYmYgPCAtMSB8fCBiZiA+IDEpIHtcblx0XHRcdFx0Ly8gbmVlZHMgcm90YXRlXG5cdFx0XHRcdGNvbnN0IGQxID0gc3RhY2tbaV1bMF07XG5cdFx0XHRcdGNvbnN0IGQyID0gc3RhY2tbaSArIDFdWzBdO1xuXG5cdFx0XHRcdGlmIChkMSA9PT0gRGlyLlJpZ2h0ICYmIGQyID09PSBEaXIuUmlnaHQpIHtcblx0XHRcdFx0XHQvL3JpZ2h0LCByaWdodCAtPiByb3RhdGUgbGVmdFxuXHRcdFx0XHRcdHN0YWNrW2ldWzFdID0gbm9kZS5yb3RhdGVMZWZ0KCk7XG5cblx0XHRcdFx0fSBlbHNlIGlmIChkMSA9PT0gRGlyLkxlZnQgJiYgZDIgPT09IERpci5MZWZ0KSB7XG5cdFx0XHRcdFx0Ly8gbGVmdCwgbGVmdCAtPiByb3RhdGUgcmlnaHRcblx0XHRcdFx0XHRzdGFja1tpXVsxXSA9IG5vZGUucm90YXRlUmlnaHQoKTtcblxuXHRcdFx0XHR9IGVsc2UgaWYgKGQxID09PSBEaXIuUmlnaHQgJiYgZDIgPT09IERpci5MZWZ0KSB7XG5cdFx0XHRcdFx0Ly8gcmlnaHQsIGxlZnQgLT4gZG91YmxlIHJvdGF0ZSByaWdodCwgbGVmdFxuXHRcdFx0XHRcdG5vZGUucmlnaHQgPSBzdGFja1tpICsgMV1bMV0gPSBzdGFja1tpICsgMV1bMV0ucm90YXRlUmlnaHQoKTtcblx0XHRcdFx0XHRzdGFja1tpXVsxXSA9IG5vZGUucm90YXRlTGVmdCgpO1xuXG5cdFx0XHRcdH0gZWxzZSBpZiAoZDEgPT09IERpci5MZWZ0ICYmIGQyID09PSBEaXIuUmlnaHQpIHtcblx0XHRcdFx0XHQvLyBsZWZ0LCByaWdodCAtPiBkb3VibGUgcm90YXRlIGxlZnQsIHJpZ2h0XG5cdFx0XHRcdFx0bm9kZS5sZWZ0ID0gc3RhY2tbaSArIDFdWzFdID0gc3RhY2tbaSArIDFdWzFdLnJvdGF0ZUxlZnQoKTtcblx0XHRcdFx0XHRzdGFja1tpXVsxXSA9IG5vZGUucm90YXRlUmlnaHQoKTtcblxuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvcigpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gcGF0Y2ggcGF0aCB0byBwYXJlbnRcblx0XHRcdFx0aWYgKGkgPiAwKSB7XG5cdFx0XHRcdFx0c3dpdGNoIChzdGFja1tpIC0gMV1bMF0pIHtcblx0XHRcdFx0XHRcdGNhc2UgRGlyLkxlZnQ6XG5cdFx0XHRcdFx0XHRcdHN0YWNrW2kgLSAxXVsxXS5sZWZ0ID0gc3RhY2tbaV1bMV07XG5cdFx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdFx0Y2FzZSBEaXIuUmlnaHQ6XG5cdFx0XHRcdFx0XHRcdHN0YWNrW2kgLSAxXVsxXS5yaWdodCA9IHN0YWNrW2ldWzFdO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRcdGNhc2UgRGlyLk1pZDpcblx0XHRcdFx0XHRcdFx0c3RhY2tbaSAtIDFdWzFdLm1pZCA9IHN0YWNrW2ldWzFdO1xuXHRcdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fcm9vdCA9IHN0YWNrWzBdWzFdO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9sZEVsZW1lbnQ7XG5cdH1cblxuXHRnZXQoa2V5OiBLKTogViB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIFVuZGVmLnVud3JhcCh0aGlzLl9nZXROb2RlKGtleSk/LnZhbHVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2dldE5vZGUoa2V5OiBLKSB7XG5cdFx0Y29uc3QgaXRlciA9IHRoaXMuX2l0ZXIucmVzZXQoa2V5KTtcblx0XHRsZXQgbm9kZSA9IHRoaXMuX3Jvb3Q7XG5cdFx0d2hpbGUgKG5vZGUpIHtcblx0XHRcdGNvbnN0IHZhbCA9IGl0ZXIuY21wKG5vZGUuc2VnbWVudCk7XG5cdFx0XHRpZiAodmFsID4gMCkge1xuXHRcdFx0XHQvLyBsZWZ0XG5cdFx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbCA8IDApIHtcblx0XHRcdFx0Ly8gcmlnaHRcblx0XHRcdFx0bm9kZSA9IG5vZGUucmlnaHQ7XG5cdFx0XHR9IGVsc2UgaWYgKGl0ZXIuaGFzTmV4dCgpKSB7XG5cdFx0XHRcdC8vIG1pZFxuXHRcdFx0XHRpdGVyLm5leHQoKTtcblx0XHRcdFx0bm9kZSA9IG5vZGUubWlkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiBub2RlO1xuXHR9XG5cblx0aGFzKGtleTogSyk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IG5vZGUgPSB0aGlzLl9nZXROb2RlKGtleSk7XG5cdFx0cmV0dXJuICEobm9kZT8udmFsdWUgPT09IHVuZGVmaW5lZCAmJiBub2RlPy5taWQgPT09IHVuZGVmaW5lZCk7XG5cdH1cblxuXHRkZWxldGUoa2V5OiBLKTogdm9pZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlbGV0ZShrZXksIGZhbHNlKTtcblx0fVxuXG5cdGRlbGV0ZVN1cGVyc3RyKGtleTogSyk6IHZvaWQge1xuXHRcdHJldHVybiB0aGlzLl9kZWxldGUoa2V5LCB0cnVlKTtcblx0fVxuXG5cdHByaXZhdGUgX2RlbGV0ZShrZXk6IEssIHN1cGVyU3RyOiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgaXRlciA9IHRoaXMuX2l0ZXIucmVzZXQoa2V5KTtcblx0XHRjb25zdCBzdGFjazogW0RpciwgVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+XVtdID0gW107XG5cdFx0bGV0IG5vZGUgPSB0aGlzLl9yb290O1xuXG5cdFx0Ly8gZmluZCBub2RlXG5cdFx0d2hpbGUgKG5vZGUpIHtcblx0XHRcdGNvbnN0IHZhbCA9IGl0ZXIuY21wKG5vZGUuc2VnbWVudCk7XG5cdFx0XHRpZiAodmFsID4gMCkge1xuXHRcdFx0XHQvLyBsZWZ0XG5cdFx0XHRcdHN0YWNrLnB1c2goW0Rpci5MZWZ0LCBub2RlXSk7XG5cdFx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cdFx0XHR9IGVsc2UgaWYgKHZhbCA8IDApIHtcblx0XHRcdFx0Ly8gcmlnaHRcblx0XHRcdFx0c3RhY2sucHVzaChbRGlyLlJpZ2h0LCBub2RlXSk7XG5cdFx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0fSBlbHNlIGlmIChpdGVyLmhhc05leHQoKSkge1xuXHRcdFx0XHQvLyBtaWRcblx0XHRcdFx0aXRlci5uZXh0KCk7XG5cdFx0XHRcdHN0YWNrLnB1c2goW0Rpci5NaWQsIG5vZGVdKTtcblx0XHRcdFx0bm9kZSA9IG5vZGUubWlkO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHQvLyBub2RlIG5vdCBmb3VuZFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmIChzdXBlclN0cikge1xuXHRcdFx0Ly8gcmVtb3ZpbmcgY2hpbGRyZW4sIHJlc2V0IGhlaWdodFxuXHRcdFx0bm9kZS5sZWZ0ID0gdW5kZWZpbmVkO1xuXHRcdFx0bm9kZS5taWQgPSB1bmRlZmluZWQ7XG5cdFx0XHRub2RlLnJpZ2h0ID0gdW5kZWZpbmVkO1xuXHRcdFx0bm9kZS5oZWlnaHQgPSAxO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHQvLyByZW1vdmluZyBlbGVtZW50XG5cdFx0XHRub2RlLmtleSA9IHVuZGVmaW5lZDtcblx0XHRcdG5vZGUudmFsdWUgPSB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Ly8gQlNUIG5vZGUgcmVtb3ZhbFxuXHRcdGlmICghbm9kZS5taWQgJiYgIW5vZGUudmFsdWUpIHtcblx0XHRcdGlmIChub2RlLmxlZnQgJiYgbm9kZS5yaWdodCkge1xuXHRcdFx0XHQvLyBmdWxsIG5vZGVcblx0XHRcdFx0Ly8gcmVwbGFjZSBkZWxldGVkLW5vZGUgd2l0aCB0aGUgbWluLW5vZGUgb2YgdGhlIHJpZ2h0IGJyYW5jaC5cblx0XHRcdFx0Ly8gSWYgdGhlcmUgaXMgbm8gdHJ1ZSBtaW4tbm9kZSBsZWF2ZSB0aGluZ3MgYXMgdGhleSBhcmVcblx0XHRcdFx0Y29uc3QgbWluID0gdGhpcy5fbWluKG5vZGUucmlnaHQpO1xuXHRcdFx0XHRpZiAobWluLmtleSkge1xuXHRcdFx0XHRcdGNvbnN0IHsga2V5LCB2YWx1ZSwgc2VnbWVudCB9ID0gbWluO1xuXHRcdFx0XHRcdHRoaXMuX2RlbGV0ZShtaW4ua2V5LCBmYWxzZSk7XG5cdFx0XHRcdFx0bm9kZS5rZXkgPSBrZXk7XG5cdFx0XHRcdFx0bm9kZS52YWx1ZSA9IHZhbHVlO1xuXHRcdFx0XHRcdG5vZGUuc2VnbWVudCA9IHNlZ21lbnQ7XG5cdFx0XHRcdH1cblxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gZW1wdHkgb3IgaGFsZiBlbXB0eVxuXHRcdFx0XHRjb25zdCBuZXdDaGlsZCA9IG5vZGUubGVmdCA/PyBub2RlLnJpZ2h0O1xuXHRcdFx0XHRpZiAoc3RhY2subGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdGNvbnN0IFtkaXIsIHBhcmVudF0gPSBzdGFja1tzdGFjay5sZW5ndGggLSAxXTtcblx0XHRcdFx0XHRzd2l0Y2ggKGRpcikge1xuXHRcdFx0XHRcdFx0Y2FzZSBEaXIuTGVmdDogcGFyZW50LmxlZnQgPSBuZXdDaGlsZDsgYnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlIERpci5NaWQ6IHBhcmVudC5taWQgPSBuZXdDaGlsZDsgYnJlYWs7XG5cdFx0XHRcdFx0XHRjYXNlIERpci5SaWdodDogcGFyZW50LnJpZ2h0ID0gbmV3Q2hpbGQ7IGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9yb290ID0gbmV3Q2hpbGQ7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBBVkwgYmFsYW5jZVxuXHRcdGZvciAobGV0IGkgPSBzdGFjay5sZW5ndGggLSAxOyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3Qgbm9kZSA9IHN0YWNrW2ldWzFdO1xuXG5cdFx0XHRub2RlLnVwZGF0ZUhlaWdodCgpO1xuXHRcdFx0Y29uc3QgYmYgPSBub2RlLmJhbGFuY2VGYWN0b3IoKTtcblx0XHRcdGlmIChiZiA+IDEpIHtcblx0XHRcdFx0Ly8gcmlnaHQgaGVhdnlcblx0XHRcdFx0aWYgKG5vZGUucmlnaHQhLmJhbGFuY2VGYWN0b3IoKSA+PSAwKSB7XG5cdFx0XHRcdFx0Ly8gcmlnaHQsIHJpZ2h0IC0+IHJvdGF0ZSBsZWZ0XG5cdFx0XHRcdFx0c3RhY2tbaV1bMV0gPSBub2RlLnJvdGF0ZUxlZnQoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHQvLyByaWdodCwgbGVmdCAtPiBkb3VibGUgcm90YXRlXG5cdFx0XHRcdFx0bm9kZS5yaWdodCA9IG5vZGUucmlnaHQhLnJvdGF0ZVJpZ2h0KCk7XG5cdFx0XHRcdFx0c3RhY2tbaV1bMV0gPSBub2RlLnJvdGF0ZUxlZnQoKTtcblx0XHRcdFx0fVxuXG5cdFx0XHR9IGVsc2UgaWYgKGJmIDwgLTEpIHtcblx0XHRcdFx0Ly8gbGVmdCBoZWF2eVxuXHRcdFx0XHRpZiAobm9kZS5sZWZ0IS5iYWxhbmNlRmFjdG9yKCkgPD0gMCkge1xuXHRcdFx0XHRcdC8vIGxlZnQsIGxlZnQgLT4gcm90YXRlIHJpZ2h0XG5cdFx0XHRcdFx0c3RhY2tbaV1bMV0gPSBub2RlLnJvdGF0ZVJpZ2h0KCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gbGVmdCwgcmlnaHQgLT4gZG91YmxlIHJvdGF0ZVxuXHRcdFx0XHRcdG5vZGUubGVmdCA9IG5vZGUubGVmdCEucm90YXRlTGVmdCgpO1xuXHRcdFx0XHRcdHN0YWNrW2ldWzFdID0gbm9kZS5yb3RhdGVSaWdodCgpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIHBhdGNoIHBhdGggdG8gcGFyZW50XG5cdFx0XHRpZiAoaSA+IDApIHtcblx0XHRcdFx0c3dpdGNoIChzdGFja1tpIC0gMV1bMF0pIHtcblx0XHRcdFx0XHRjYXNlIERpci5MZWZ0OlxuXHRcdFx0XHRcdFx0c3RhY2tbaSAtIDFdWzFdLmxlZnQgPSBzdGFja1tpXVsxXTtcblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdGNhc2UgRGlyLlJpZ2h0OlxuXHRcdFx0XHRcdFx0c3RhY2tbaSAtIDFdWzFdLnJpZ2h0ID0gc3RhY2tbaV1bMV07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0XHRjYXNlIERpci5NaWQ6XG5cdFx0XHRcdFx0XHRzdGFja1tpIC0gMV1bMV0ubWlkID0gc3RhY2tbaV1bMV07XG5cdFx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fcm9vdCA9IHN0YWNrWzBdWzFdO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX21pbihub2RlOiBUZXJuYXJ5U2VhcmNoVHJlZU5vZGU8SywgVj4pOiBUZXJuYXJ5U2VhcmNoVHJlZU5vZGU8SywgVj4ge1xuXHRcdHdoaWxlIChub2RlLmxlZnQpIHtcblx0XHRcdG5vZGUgPSBub2RlLmxlZnQ7XG5cdFx0fVxuXHRcdHJldHVybiBub2RlO1xuXHR9XG5cblx0ZmluZFN1YnN0cihrZXk6IEspOiBWIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBpdGVyID0gdGhpcy5faXRlci5yZXNldChrZXkpO1xuXHRcdGxldCBub2RlID0gdGhpcy5fcm9vdDtcblx0XHRsZXQgY2FuZGlkYXRlOiBWIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdHdoaWxlIChub2RlKSB7XG5cdFx0XHRjb25zdCB2YWwgPSBpdGVyLmNtcChub2RlLnNlZ21lbnQpO1xuXHRcdFx0aWYgKHZhbCA+IDApIHtcblx0XHRcdFx0Ly8gbGVmdFxuXHRcdFx0XHRub2RlID0gbm9kZS5sZWZ0O1xuXHRcdFx0fSBlbHNlIGlmICh2YWwgPCAwKSB7XG5cdFx0XHRcdC8vIHJpZ2h0XG5cdFx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0fSBlbHNlIGlmIChpdGVyLmhhc05leHQoKSkge1xuXHRcdFx0XHQvLyBtaWRcblx0XHRcdFx0aXRlci5uZXh0KCk7XG5cdFx0XHRcdGNhbmRpZGF0ZSA9IFVuZGVmLnVud3JhcChub2RlLnZhbHVlKSB8fCBjYW5kaWRhdGU7XG5cdFx0XHRcdG5vZGUgPSBub2RlLm1pZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRyZXR1cm4gbm9kZSAmJiBVbmRlZi51bndyYXAobm9kZS52YWx1ZSkgfHwgY2FuZGlkYXRlO1xuXHR9XG5cblx0ZmluZFN1cGVyc3RyKGtleTogSyk6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRTdXBlcnN0ck9yRWxlbWVudChrZXksIGZhbHNlKTtcblx0fVxuXG5cdHByaXZhdGUgX2ZpbmRTdXBlcnN0ck9yRWxlbWVudChrZXk6IEssIGFsbG93VmFsdWU6IHRydWUpOiBJdGVyYWJsZUl0ZXJhdG9yPFtLLCBWXT4gfCBWIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9maW5kU3VwZXJzdHJPckVsZW1lbnQoa2V5OiBLLCBhbGxvd1ZhbHVlOiBmYWxzZSk6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfZmluZFN1cGVyc3RyT3JFbGVtZW50KGtleTogSywgYWxsb3dWYWx1ZTogYm9vbGVhbik6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB8IFYgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGl0ZXIgPSB0aGlzLl9pdGVyLnJlc2V0KGtleSk7XG5cdFx0bGV0IG5vZGUgPSB0aGlzLl9yb290O1xuXHRcdHdoaWxlIChub2RlKSB7XG5cdFx0XHRjb25zdCB2YWwgPSBpdGVyLmNtcChub2RlLnNlZ21lbnQpO1xuXHRcdFx0aWYgKHZhbCA+IDApIHtcblx0XHRcdFx0Ly8gbGVmdFxuXHRcdFx0XHRub2RlID0gbm9kZS5sZWZ0O1xuXHRcdFx0fSBlbHNlIGlmICh2YWwgPCAwKSB7XG5cdFx0XHRcdC8vIHJpZ2h0XG5cdFx0XHRcdG5vZGUgPSBub2RlLnJpZ2h0O1xuXHRcdFx0fSBlbHNlIGlmIChpdGVyLmhhc05leHQoKSkge1xuXHRcdFx0XHQvLyBtaWRcblx0XHRcdFx0aXRlci5uZXh0KCk7XG5cdFx0XHRcdG5vZGUgPSBub2RlLm1pZDtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIGNvbGxlY3Rcblx0XHRcdFx0aWYgKCFub2RlLm1pZCkge1xuXHRcdFx0XHRcdGlmIChhbGxvd1ZhbHVlKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gVW5kZWYudW53cmFwKG5vZGUudmFsdWUpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5fZW50cmllcyhub2RlLm1pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdGhhc0VsZW1lbnRPclN1YnRyZWUoa2V5OiBLKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZpbmRTdXBlcnN0ck9yRWxlbWVudChrZXksIHRydWUpICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRmb3JFYWNoKGNhbGxiYWNrOiAodmFsdWU6IFYsIGluZGV4OiBLKSA9PiB1bmtub3duKTogdm9pZCB7XG5cdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcykge1xuXHRcdFx0Y2FsbGJhY2sodmFsdWUsIGtleSk7XG5cdFx0fVxuXHR9XG5cblx0KltTeW1ib2wuaXRlcmF0b3JdKCk6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB7XG5cdFx0eWllbGQqIHRoaXMuX2VudHJpZXModGhpcy5fcm9vdCk7XG5cdH1cblxuXHRwcml2YXRlIF9lbnRyaWVzKG5vZGU6IFRlcm5hcnlTZWFyY2hUcmVlTm9kZTxLLCBWPiB8IHVuZGVmaW5lZCk6IEl0ZXJhYmxlSXRlcmF0b3I8W0ssIFZdPiB7XG5cdFx0Y29uc3QgcmVzdWx0OiBbSywgVl1bXSA9IFtdO1xuXHRcdHRoaXMuX2Rmc0VudHJpZXMobm9kZSwgcmVzdWx0KTtcblx0XHRyZXR1cm4gcmVzdWx0W1N5bWJvbC5pdGVyYXRvcl0oKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rmc0VudHJpZXMobm9kZTogVGVybmFyeVNlYXJjaFRyZWVOb2RlPEssIFY+IHwgdW5kZWZpbmVkLCBidWNrZXQ6IFtLLCBWXVtdKSB7XG5cdFx0Ly8gREZTXG5cdFx0aWYgKCFub2RlKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdGlmIChub2RlLmxlZnQpIHtcblx0XHRcdHRoaXMuX2Rmc0VudHJpZXMobm9kZS5sZWZ0LCBidWNrZXQpO1xuXHRcdH1cblx0XHRpZiAobm9kZS52YWx1ZSAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRidWNrZXQucHVzaChbbm9kZS5rZXkhLCBVbmRlZi51bndyYXAobm9kZS52YWx1ZSkhXSk7XG5cdFx0fVxuXHRcdGlmIChub2RlLm1pZCkge1xuXHRcdFx0dGhpcy5fZGZzRW50cmllcyhub2RlLm1pZCwgYnVja2V0KTtcblx0XHR9XG5cdFx0aWYgKG5vZGUucmlnaHQpIHtcblx0XHRcdHRoaXMuX2Rmc0VudHJpZXMobm9kZS5yaWdodCwgYnVja2V0KTtcblx0XHR9XG5cdH1cblxuXHQvLyBmb3IgZGVidWcvdGVzdGluZ1xuXHRfaXNCYWxhbmNlZCgpOiBib29sZWFuIHtcblx0XHRjb25zdCBub2RlSXNCYWxhbmNlZCA9IChub2RlOiBUZXJuYXJ5U2VhcmNoVHJlZU5vZGU8YW55LCBhbnk+IHwgdW5kZWZpbmVkKTogYm9vbGVhbiA9PiB7XG5cdFx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCBiZiA9IG5vZGUuYmFsYW5jZUZhY3RvcigpO1xuXHRcdFx0aWYgKGJmIDwgLTEgfHwgYmYgPiAxKSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdHJldHVybiBub2RlSXNCYWxhbmNlZChub2RlLmxlZnQpICYmIG5vZGVJc0JhbGFuY2VkKG5vZGUucmlnaHQpO1xuXHRcdH07XG5cdFx0cmV0dXJuIG5vZGVJc0JhbGFuY2VkKHRoaXMuX3Jvb3QpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxTQUFTLG1CQUFtQixrQkFBa0Isa0NBQWtDO0FBWWxGLE1BQU0sZUFBK0M7QUFBQSxFQUFyRDtBQUVOLFNBQVEsU0FBaUI7QUFDekIsU0FBUSxPQUFlO0FBQUE7QUFBQSxFQUV2QixNQUFNLEtBQW1CO0FBQ3hCLFNBQUssU0FBUztBQUNkLFNBQUssT0FBTztBQUNaLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxPQUFhO0FBQ1osU0FBSyxRQUFRO0FBQ2IsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVBLFVBQW1CO0FBQ2xCLFdBQU8sS0FBSyxPQUFPLEtBQUssT0FBTyxTQUFTO0FBQUEsRUFDekM7QUFBQSxFQUVBLElBQUksR0FBbUI7QUFDdEIsVUFBTSxRQUFRLEVBQUUsV0FBVyxDQUFDO0FBQzVCLFVBQU0sV0FBVyxLQUFLLE9BQU8sV0FBVyxLQUFLLElBQUk7QUFDakQsV0FBTyxRQUFRO0FBQUEsRUFDaEI7QUFBQSxFQUVBLFFBQWdCO0FBQ2YsV0FBTyxLQUFLLE9BQU8sS0FBSyxJQUFJO0FBQUEsRUFDN0I7QUFDRDtBQUVPLE1BQU0sbUJBQW1EO0FB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
