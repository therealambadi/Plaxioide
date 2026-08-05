import { Iterable } from "./iterator.js";
const unset = Symbol("unset");
class WellDefinedPrefixTree {
  constructor() {
    this.root = new Node();
    this._size = 0;
  }
  /** Tree size, not including the root. */
  get size() {
    return this._size;
  }
  /** Gets the top-level nodes of the tree */
  get nodes() {
    return this.root.children?.values() || Iterable.empty();
  }
  /** Gets the top-level nodes of the tree */
  get entries() {
    return this.root.children?.entries() || Iterable.empty();
  }
  /**
   * Inserts a new value in the prefix tree.
   * @param onNode - called for each node as we descend to the insertion point,
   * including the insertion point itself.
   */
  insert(key, value, onNode) {
    this.opNode(key, (n) => n._value = value, onNode);
  }
  /** Mutates a value in the prefix tree. */
  mutate(key, mutate) {
    this.opNode(key, (n) => n._value = mutate(n._value === unset ? void 0 : n._value));
  }
  /** Mutates nodes along the path in the prefix tree. */
  mutatePath(key, mutate) {
    this.opNode(key, () => {
    }, (n) => mutate(n));
  }
  /** Deletes a node from the prefix tree, returning the value it contained. */
  delete(key) {
    const path = this.getPathToKey(key);
    if (!path) {
      return;
    }
    let i = path.length - 1;
    const value = path[i].node._value;
    if (value === unset) {
      return;
    }
    this._size--;
    path[i].node._value = unset;
    for (; i > 0; i--) {
      const { node, part } = path[i];
      if (node.children?.size || node._value !== unset) {
        break;
      }
      path[i - 1].node.children.delete(part);
    }
    return value;
  }
  /** Deletes a subtree from the prefix tree, returning the values they contained. */
  *deleteRecursive(key) {
    const path = this.getPathToKey(key);
    if (!path) {
      return;
    }
    const subtree = path[path.length - 1].node;
    for (let i = path.length - 1; i > 0; i--) {
      const parent = path[i - 1];
      parent.node.children.delete(path[i].part);
      if (parent.node.children.size > 0 || parent.node._value !== unset) {
        break;
      }
    }
    for (const node of bfsIterate(subtree)) {
      if (node._value !== unset) {
        this._size--;
        yield node._value;
      }
    }
    if (subtree === this.root) {
      this.root._value = unset;
      this.root.children = void 0;
    }
  }
  /** Gets a value from the tree. */
  find(key) {
    let node = this.root;
    for (const segment of key) {
      const next = node.children?.get(segment);
      if (!next) {
        return void 0;
      }
      node = next;
    }
    return node._value === unset ? void 0 : node._value;
  }
  /** Gets whether the tree has the key, or a parent of the key, already inserted. */
  hasKeyOrParent(key) {
    let node = this.root;
    for (const segment of key) {
      const next = node.children?.get(segment);
      if (!next) {
        return false;
      }
      if (next._value !== unset) {
        return true;
      }
      node = next;
    }
    return false;
  }
  /** Gets whether the tree has the given key or any children. */
  hasKeyOrChildren(key) {
    let node = this.root;
    for (const segment of key) {
      const next = node.children?.get(segment);
      if (!next) {
        return false;
      }
      node = next;
    }
    return true;
  }
  /** Gets whether the tree has the given key. */
  hasKey(key) {
    let node = this.root;
    for (const segment of key) {
      const next = node.children?.get(segment);
      if (!next) {
        return false;
      }
      node = next;
    }
    return node._value !== unset;
  }
  getPathToKey(key) {
    const path = [{ part: "", node: this.root }];
    let i = 0;
    for (const part of key) {
      const node = path[i].node.children?.get(part);
      if (!node) {
        return;
      }
      path.push({ part, node });
      i++;
    }
    return path;
  }
  opNode(key, fn, onDescend) {
    let node = this.root;
    for (const part of key) {
      if (!node.children) {
        const next = new Node();
        node.children = /* @__PURE__ */ new Map([[part, next]]);
        node = next;
      } else if (!node.children.has(part)) {
        const next = new Node();
        node.children.set(part, next);
        node = next;
      } else {
        node = node.children.get(part);
      }
      onDescend?.(node);
    }
    const sizeBefore = node._value === unset ? 0 : 1;
    fn(node);
    const sizeAfter = node._value === unset ? 0 : 1;
    this._size += sizeAfter - sizeBefore;
  }
  /** Returns an iterable of the tree values in no defined order. */
  *values() {
    for (const { _value } of bfsIterate(this.root)) {
      if (_value !== unset) {
        yield _value;
      }
    }
  }
}
function* bfsIterate(root) {
  const stack = [root];
  while (stack.length > 0) {
    const node = stack.pop();
    yield node;
    if (node.children) {
      for (const child of node.children.values()) {
        stack.push(child);
      }
    }
  }
}
class Node {
  constructor() {
    this._value = unset;
  }
  get value() {
    return this._value === unset ? void 0 : this._value;
  }
  set value(value) {
    this._value = value === void 0 ? unset : value;
  }
}
export {
  WellDefinedPrefixTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9wcmVmaXhUcmVlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuL2l0ZXJhdG9yLmpzJztcblxuY29uc3QgdW5zZXQgPSBTeW1ib2woJ3Vuc2V0Jyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVByZWZpeFRyZWVOb2RlPFQ+IHtcblx0LyoqIFBvc3NpYmxlIGNoaWxkcmVuIG9mIHRoZSBub2RlLiAqL1xuXHRjaGlsZHJlbj86IFJlYWRvbmx5TWFwPHN0cmluZywgTm9kZTxUPj47XG5cblx0LyoqIFRoZSB2YWx1ZSBpZiBkYXRhIGV4aXN0cyBmb3IgdGhpcyBub2RlIGluIHRoZSB0cmVlLiBNdXRhYmxlLiAqL1xuXHR2YWx1ZTogVCB8IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBBIHNpbXBsZSBwcmVmaXggdHJlZSBpbXBsZW1lbnRhdGlvbiB3aGVyZSBhIHZhbHVlIGlzIHN0b3JlZCBiYXNlZCBvblxuICogd2VsbC1kZWZpbmVkIHByZWZpeCBzZWdtZW50cy5cbiAqL1xuZXhwb3J0IGNsYXNzIFdlbGxEZWZpbmVkUHJlZml4VHJlZTxWPiB7XG5cdHB1YmxpYyByZWFkb25seSByb290ID0gbmV3IE5vZGU8Vj4oKTtcblx0cHJpdmF0ZSBfc2l6ZSA9IDA7XG5cblx0LyoqIFRyZWUgc2l6ZSwgbm90IGluY2x1ZGluZyB0aGUgcm9vdC4gKi9cblx0cHVibGljIGdldCBzaXplKCkge1xuXHRcdHJldHVybiB0aGlzLl9zaXplO1xuXHR9XG5cblx0LyoqIEdldHMgdGhlIHRvcC1sZXZlbCBub2RlcyBvZiB0aGUgdHJlZSAqL1xuXHRwdWJsaWMgZ2V0IG5vZGVzKCk6IEl0ZXJhYmxlPElQcmVmaXhUcmVlTm9kZTxWPj4ge1xuXHRcdHJldHVybiB0aGlzLnJvb3QuY2hpbGRyZW4/LnZhbHVlcygpIHx8IEl0ZXJhYmxlLmVtcHR5KCk7XG5cdH1cblxuXHQvKiogR2V0cyB0aGUgdG9wLWxldmVsIG5vZGVzIG9mIHRoZSB0cmVlICovXG5cdHB1YmxpYyBnZXQgZW50cmllcygpOiBJdGVyYWJsZTxbc3RyaW5nLCBJUHJlZml4VHJlZU5vZGU8Vj5dPiB7XG5cdFx0cmV0dXJuIHRoaXMucm9vdC5jaGlsZHJlbj8uZW50cmllcygpIHx8IEl0ZXJhYmxlLmVtcHR5KCk7XG5cdH1cblxuXHQvKipcblx0ICogSW5zZXJ0cyBhIG5ldyB2YWx1ZSBpbiB0aGUgcHJlZml4IHRyZWUuXG5cdCAqIEBwYXJhbSBvbk5vZGUgLSBjYWxsZWQgZm9yIGVhY2ggbm9kZSBhcyB3ZSBkZXNjZW5kIHRvIHRoZSBpbnNlcnRpb24gcG9pbnQsXG5cdCAqIGluY2x1ZGluZyB0aGUgaW5zZXJ0aW9uIHBvaW50IGl0c2VsZi5cblx0ICovXG5cdGluc2VydChrZXk6IEl0ZXJhYmxlPHN0cmluZz4sIHZhbHVlOiBWLCBvbk5vZGU/OiAobjogSVByZWZpeFRyZWVOb2RlPFY+KSA9PiB2b2lkKTogdm9pZCB7XG5cdFx0dGhpcy5vcE5vZGUoa2V5LCBuID0+IG4uX3ZhbHVlID0gdmFsdWUsIG9uTm9kZSk7XG5cdH1cblxuXHQvKiogTXV0YXRlcyBhIHZhbHVlIGluIHRoZSBwcmVmaXggdHJlZS4gKi9cblx0bXV0YXRlKGtleTogSXRlcmFibGU8c3RyaW5nPiwgbXV0YXRlOiAodmFsdWU/OiBWKSA9PiBWKTogdm9pZCB7XG5cdFx0dGhpcy5vcE5vZGUoa2V5LCBuID0+IG4uX3ZhbHVlID0gbXV0YXRlKG4uX3ZhbHVlID09PSB1bnNldCA/IHVuZGVmaW5lZCA6IG4uX3ZhbHVlKSk7XG5cdH1cblxuXHQvKiogTXV0YXRlcyBub2RlcyBhbG9uZyB0aGUgcGF0aCBpbiB0aGUgcHJlZml4IHRyZWUuICovXG5cdG11dGF0ZVBhdGgoa2V5OiBJdGVyYWJsZTxzdHJpbmc+LCBtdXRhdGU6IChub2RlOiBJUHJlZml4VHJlZU5vZGU8Vj4pID0+IHZvaWQpOiB2b2lkIHtcblx0XHR0aGlzLm9wTm9kZShrZXksICgpID0+IHsgfSwgbiA9PiBtdXRhdGUobikpO1xuXHR9XG5cblx0LyoqIERlbGV0ZXMgYSBub2RlIGZyb20gdGhlIHByZWZpeCB0cmVlLCByZXR1cm5pbmcgdGhlIHZhbHVlIGl0IGNvbnRhaW5lZC4gKi9cblx0ZGVsZXRlKGtleTogSXRlcmFibGU8c3RyaW5nPik6IFYgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHBhdGggPSB0aGlzLmdldFBhdGhUb0tleShrZXkpO1xuXHRcdGlmICghcGF0aCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGxldCBpID0gcGF0aC5sZW5ndGggLSAxO1xuXHRcdGNvbnN0IHZhbHVlID0gcGF0aFtpXS5ub2RlLl92YWx1ZTtcblx0XHRpZiAodmFsdWUgPT09IHVuc2V0KSB7XG5cdFx0XHRyZXR1cm47IC8vIG5vdCBhY3R1YWxseSBhIHJlYWwgbm9kZVxuXHRcdH1cblxuXHRcdHRoaXMuX3NpemUtLTtcblx0XHRwYXRoW2ldLm5vZGUuX3ZhbHVlID0gdW5zZXQ7XG5cblx0XHRmb3IgKDsgaSA+IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgeyBub2RlLCBwYXJ0IH0gPSBwYXRoW2ldO1xuXHRcdFx0aWYgKG5vZGUuY2hpbGRyZW4/LnNpemUgfHwgbm9kZS5fdmFsdWUgIT09IHVuc2V0KSB7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXG5cdFx0XHRwYXRoW2kgLSAxXS5ub2RlLmNoaWxkcmVuIS5kZWxldGUocGFydCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZhbHVlO1xuXHR9XG5cblx0LyoqIERlbGV0ZXMgYSBzdWJ0cmVlIGZyb20gdGhlIHByZWZpeCB0cmVlLCByZXR1cm5pbmcgdGhlIHZhbHVlcyB0aGV5IGNvbnRhaW5lZC4gKi9cblx0KmRlbGV0ZVJlY3Vyc2l2ZShrZXk6IEl0ZXJhYmxlPHN0cmluZz4pOiBJdGVyYWJsZTxWPiB7XG5cdFx0Y29uc3QgcGF0aCA9IHRoaXMuZ2V0UGF0aFRvS2V5KGtleSk7XG5cdFx0aWYgKCFwYXRoKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3VidHJlZSA9IHBhdGhbcGF0aC5sZW5ndGggLSAxXS5ub2RlO1xuXG5cdFx0Ly8gaW1wb3J0YW50OiBydW4gdGhlIGRlbGV0aW9uIGJlZm9yZSB3ZSBzdGFydCB0byB5aWVsZCByZXN1bHRzLCBzbyB0aGF0XG5cdFx0Ly8gaXQgc3RpbGwgcnVucyBldmVuIGlmIHRoZSBjYWxsZXIgZG9lc24ndCBjb25zdW1lciB0aGUgaXRlcmF0b3Jcblx0XHRmb3IgKGxldCBpID0gcGF0aC5sZW5ndGggLSAxOyBpID4gMDsgaS0tKSB7XG5cdFx0XHRjb25zdCBwYXJlbnQgPSBwYXRoW2kgLSAxXTtcblx0XHRcdHBhcmVudC5ub2RlLmNoaWxkcmVuIS5kZWxldGUocGF0aFtpXS5wYXJ0KTtcblx0XHRcdGlmIChwYXJlbnQubm9kZS5jaGlsZHJlbiEuc2l6ZSA+IDAgfHwgcGFyZW50Lm5vZGUuX3ZhbHVlICE9PSB1bnNldCkge1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG5vZGUgb2YgYmZzSXRlcmF0ZShzdWJ0cmVlKSkge1xuXHRcdFx0aWYgKG5vZGUuX3ZhbHVlICE9PSB1bnNldCkge1xuXHRcdFx0XHR0aGlzLl9zaXplLS07XG5cdFx0XHRcdHlpZWxkIG5vZGUuX3ZhbHVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdC8vIHNwZWNpYWwgY2FzZSBmb3IgdGhlIHJvb3Qgbm90ZVxuXHRcdGlmIChzdWJ0cmVlID09PSB0aGlzLnJvb3QpIHtcblx0XHRcdHRoaXMucm9vdC5fdmFsdWUgPSB1bnNldDtcblx0XHRcdHRoaXMucm9vdC5jaGlsZHJlbiA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH1cblxuXHQvKiogR2V0cyBhIHZhbHVlIGZyb20gdGhlIHRyZWUuICovXG5cdGZpbmQoa2V5OiBJdGVyYWJsZTxzdHJpbmc+KTogViB8IHVuZGVmaW5lZCB7XG5cdFx0bGV0IG5vZGUgPSB0aGlzLnJvb3Q7XG5cdFx0Zm9yIChjb25zdCBzZWdtZW50IG9mIGtleSkge1xuXHRcdFx0Y29uc3QgbmV4dCA9IG5vZGUuY2hpbGRyZW4/LmdldChzZWdtZW50KTtcblx0XHRcdGlmICghbmV4dCkge1xuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gbmV4dDtcblx0XHR9XG5cblx0XHRyZXR1cm4gbm9kZS5fdmFsdWUgPT09IHVuc2V0ID8gdW5kZWZpbmVkIDogbm9kZS5fdmFsdWU7XG5cdH1cblxuXHQvKiogR2V0cyB3aGV0aGVyIHRoZSB0cmVlIGhhcyB0aGUga2V5LCBvciBhIHBhcmVudCBvZiB0aGUga2V5LCBhbHJlYWR5IGluc2VydGVkLiAqL1xuXHRoYXNLZXlPclBhcmVudChrZXk6IEl0ZXJhYmxlPHN0cmluZz4pOiBib29sZWFuIHtcblx0XHRsZXQgbm9kZSA9IHRoaXMucm9vdDtcblx0XHRmb3IgKGNvbnN0IHNlZ21lbnQgb2Yga2V5KSB7XG5cdFx0XHRjb25zdCBuZXh0ID0gbm9kZS5jaGlsZHJlbj8uZ2V0KHNlZ21lbnQpO1xuXHRcdFx0aWYgKCFuZXh0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblx0XHRcdGlmIChuZXh0Ll92YWx1ZSAhPT0gdW5zZXQpIHtcblx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHR9XG5cblx0XHRcdG5vZGUgPSBuZXh0O1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8qKiBHZXRzIHdoZXRoZXIgdGhlIHRyZWUgaGFzIHRoZSBnaXZlbiBrZXkgb3IgYW55IGNoaWxkcmVuLiAqL1xuXHRoYXNLZXlPckNoaWxkcmVuKGtleTogSXRlcmFibGU8c3RyaW5nPik6IGJvb2xlYW4ge1xuXHRcdGxldCBub2RlID0gdGhpcy5yb290O1xuXHRcdGZvciAoY29uc3Qgc2VnbWVudCBvZiBrZXkpIHtcblx0XHRcdGNvbnN0IG5leHQgPSBub2RlLmNoaWxkcmVuPy5nZXQoc2VnbWVudCk7XG5cdFx0XHRpZiAoIW5leHQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRub2RlID0gbmV4dDtcblx0XHR9XG5cblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdC8qKiBHZXRzIHdoZXRoZXIgdGhlIHRyZWUgaGFzIHRoZSBnaXZlbiBrZXkuICovXG5cdGhhc0tleShrZXk6IEl0ZXJhYmxlPHN0cmluZz4pOiBib29sZWFuIHtcblx0XHRsZXQgbm9kZSA9IHRoaXMucm9vdDtcblx0XHRmb3IgKGNvbnN0IHNlZ21lbnQgb2Yga2V5KSB7XG5cdFx0XHRjb25zdCBuZXh0ID0gbm9kZS5jaGlsZHJlbj8uZ2V0KHNlZ21lbnQpO1xuXHRcdFx0aWYgKCFuZXh0KSB7XG5cdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdH1cblxuXHRcdFx0bm9kZSA9IG5leHQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vZGUuX3ZhbHVlICE9PSB1bnNldDtcblx0fVxuXG5cdHByaXZhdGUgZ2V0UGF0aFRvS2V5KGtleTogSXRlcmFibGU8c3RyaW5nPikge1xuXHRcdGNvbnN0IHBhdGggPSBbeyBwYXJ0OiAnJywgbm9kZTogdGhpcy5yb290IH1dO1xuXHRcdGxldCBpID0gMDtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2Yga2V5KSB7XG5cdFx0XHRjb25zdCBub2RlID0gcGF0aFtpXS5ub2RlLmNoaWxkcmVuPy5nZXQocGFydCk7XG5cdFx0XHRpZiAoIW5vZGUpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyBub2RlIG5vdCBpbiB0cmVlXG5cdFx0XHR9XG5cblx0XHRcdHBhdGgucHVzaCh7IHBhcnQsIG5vZGUgfSk7XG5cdFx0XHRpKys7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHBhdGg7XG5cdH1cblxuXHRwcml2YXRlIG9wTm9kZShrZXk6IEl0ZXJhYmxlPHN0cmluZz4sIGZuOiAobm9kZTogTm9kZTxWPikgPT4gdm9pZCwgb25EZXNjZW5kPzogKG5vZGU6IE5vZGU8Vj4pID0+IHZvaWQpOiB2b2lkIHtcblx0XHRsZXQgbm9kZSA9IHRoaXMucm9vdDtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2Yga2V5KSB7XG5cdFx0XHRpZiAoIW5vZGUuY2hpbGRyZW4pIHtcblx0XHRcdFx0Y29uc3QgbmV4dCA9IG5ldyBOb2RlPFY+KCk7XG5cdFx0XHRcdG5vZGUuY2hpbGRyZW4gPSBuZXcgTWFwKFtbcGFydCwgbmV4dF1dKTtcblx0XHRcdFx0bm9kZSA9IG5leHQ7XG5cdFx0XHR9IGVsc2UgaWYgKCFub2RlLmNoaWxkcmVuLmhhcyhwYXJ0KSkge1xuXHRcdFx0XHRjb25zdCBuZXh0ID0gbmV3IE5vZGU8Vj4oKTtcblx0XHRcdFx0bm9kZS5jaGlsZHJlbi5zZXQocGFydCwgbmV4dCk7XG5cdFx0XHRcdG5vZGUgPSBuZXh0O1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bm9kZSA9IG5vZGUuY2hpbGRyZW4uZ2V0KHBhcnQpITtcblx0XHRcdH1cblx0XHRcdG9uRGVzY2VuZD8uKG5vZGUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNpemVCZWZvcmUgPSBub2RlLl92YWx1ZSA9PT0gdW5zZXQgPyAwIDogMTtcblx0XHRmbihub2RlKTtcblx0XHRjb25zdCBzaXplQWZ0ZXIgPSBub2RlLl92YWx1ZSA9PT0gdW5zZXQgPyAwIDogMTtcblx0XHR0aGlzLl9zaXplICs9IHNpemVBZnRlciAtIHNpemVCZWZvcmU7XG5cdH1cblxuXHQvKiogUmV0dXJucyBhbiBpdGVyYWJsZSBvZiB0aGUgdHJlZSB2YWx1ZXMgaW4gbm8gZGVmaW5lZCBvcmRlci4gKi9cblx0KnZhbHVlcygpIHtcblx0XHRmb3IgKGNvbnN0IHsgX3ZhbHVlIH0gb2YgYmZzSXRlcmF0ZSh0aGlzLnJvb3QpKSB7XG5cdFx0XHRpZiAoX3ZhbHVlICE9PSB1bnNldCkge1xuXHRcdFx0XHR5aWVsZCBfdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uKiBiZnNJdGVyYXRlPFQ+KHJvb3Q6IE5vZGU8VD4pOiBJdGVyYWJsZTxOb2RlPFQ+PiB7XG5cdGNvbnN0IHN0YWNrID0gW3Jvb3RdO1xuXHR3aGlsZSAoc3RhY2subGVuZ3RoID4gMCkge1xuXHRcdGNvbnN0IG5vZGUgPSBzdGFjay5wb3AoKSE7XG5cdFx0eWllbGQgbm9kZTtcblxuXHRcdGlmIChub2RlLmNoaWxkcmVuKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGNoaWxkIG9mIG5vZGUuY2hpbGRyZW4udmFsdWVzKCkpIHtcblx0XHRcdFx0c3RhY2sucHVzaChjaGlsZCk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59XG5cbmNsYXNzIE5vZGU8VD4gaW1wbGVtZW50cyBJUHJlZml4VHJlZU5vZGU8VD4ge1xuXHRwdWJsaWMgY2hpbGRyZW4/OiBNYXA8c3RyaW5nLCBOb2RlPFQ+PjtcblxuXHRwdWJsaWMgZ2V0IHZhbHVlKCkge1xuXHRcdHJldHVybiB0aGlzLl92YWx1ZSA9PT0gdW5zZXQgPyB1bmRlZmluZWQgOiB0aGlzLl92YWx1ZTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgdmFsdWUodmFsdWU6IFQgfCB1bmRlZmluZWQpIHtcblx0XHR0aGlzLl92YWx1ZSA9IHZhbHVlID09PSB1bmRlZmluZWQgPyB1bnNldCA6IHZhbHVlO1xuXHR9XG5cblx0cHVibGljIF92YWx1ZTogVCB8IHR5cGVvZiB1bnNldCA9IHVuc2V0O1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxnQkFBZ0I7QUFFekIsTUFBTSxRQUFRLE9BQU8sT0FBTztBQWNyQixNQUFNLHNCQUF5QjtBQUFBLEVBQS9CO0FBQ04sU0FBZ0IsT0FBTyxJQUFJLEtBQVE7QUFDbkMsU0FBUSxRQUFRO0FBQUE7QUFBQTtBQUFBLEVBR2hCLElBQVcsT0FBTztBQUNqQixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUE7QUFBQSxFQUdBLElBQVcsUUFBc0M7QUFDaEQsV0FBTyxLQUFLLEtBQUssVUFBVSxPQUFPLEtBQUssU0FBUyxNQUFNO0FBQUEsRUFDdkQ7QUFBQTtBQUFBLEVBR0EsSUFBVyxVQUFrRDtBQUM1RCxXQUFPLEtBQUssS0FBSyxVQUFVLFFBQVEsS0FBSyxTQUFTLE1BQU07QUFBQSxFQUN4RDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQSxFQU9BLE9BQU8sS0FBdUIsT0FBVSxRQUFnRDtBQUN2RixTQUFLLE9BQU8sS0FBSyxPQUFLLEVBQUUsU0FBUyxPQUFPLE1BQU07QUFBQSxFQUMvQztBQUFBO0FBQUEsRUFHQSxPQUFPLEtBQXVCLFFBQWdDO0FBQzdELFNBQUssT0FBTyxLQUFLLE9BQUssRUFBRSxTQUFTLE9BQU8sRUFBRSxXQUFXLFFBQVEsU0FBWSxFQUFFLE1BQU0sQ0FBQztBQUFBLEVBQ25GO0FBQUE7QUFBQSxFQUdBLFdBQVcsS0FBdUIsUUFBa0Q7QUFDbkYsU0FBSyxPQUFPLEtBQUssTUFBTTtBQUFBLElBQUUsR0FBRyxPQUFLLE9BQU8sQ0FBQyxDQUFDO0FBQUEsRUFDM0M7QUFBQTtBQUFBLEVBR0EsT0FBTyxLQUFzQztBQUM1QyxVQUFNLE9BQU8sS0FBSyxhQUFhLEdBQUc7QUFDbEMsUUFBSSxDQUFDLE1BQU07QUFDVjtBQUFBLElBQ0Q7QUFFQSxRQUFJLElBQUksS0FBSyxTQUFTO0FBQ3RCLFVBQU0sUUFBUSxLQUFLLENBQUMsRUFBRSxLQUFLO0FBQzNCLFFBQUksVUFBVSxPQUFPO0FBQ3BCO0FBQUEsSUFDRDtBQUVBLFNBQUs7QUFDTCxTQUFLLENBQUMsRUFBRSxLQUFLLFNBQVM7QUFFdEIsV0FBTyxJQUFJLEdBQUcsS0FBSztBQUNsQixZQUFNLEVBQUUsTUFBTSxLQUFLLElBQUksS0FBSyxDQUFDO0FBQzdCLFVBQUksS0FBSyxVQUFVLFFBQVEsS0FBSyxXQUFXLE9BQU87QUFDakQ7QUFBQSxNQUNEO0FBRUEsV0FBSyxJQUFJLENBQUMsRUFBRSxLQUFLLFNBQVUsT0FBTyxJQUFJO0FBQUEsSUFDdkM7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFHQSxDQUFDLGdCQUFnQixLQUFvQztBQUNwRCxVQUFNLE9BQU8sS0FBSyxhQUFhLEdBQUc7QUFDbEMsUUFBSSxDQUFDLE1BQU07QUFDVjtBQUFBLElBQ0Q7QUFFQSxVQUFNLFVBQVUsS0FBSyxLQUFLLFNBQVMsQ0FBQyxFQUFFO0FBSXRDLGFBQVMsSUFBSSxLQUFLLFNBQVMsR0FBRyxJQUFJLEdBQUcsS0FBSztBQUN6QyxZQUFNLFNBQVMsS0FBSyxJQUFJLENBQUM7QUFDekIsYUFBTyxLQUFLLFNBQVUsT0FBTyxLQUFLLENBQUMsRUFBRSxJQUFJO0FBQ3pDLFVBQUksT0FBTyxLQUFLLFNBQVUsT0FBTyxLQUFLLE9BQU8sS0FBSyxXQUFXLE9BQU87QUFDbkU7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUVBLGVBQVcsUUFBUSxXQUFXLE9BQU8sR0FBRztBQUN2QyxVQUFJLEtBQUssV0FBVyxPQUFPO0FBQzFCLGFBQUs7QUFDTCxjQUFNLEtBQUs7QUFBQSxNQUNaO0FBQUEsSUFDRDtBQUdBLFFBQUksWUFBWSxLQUFLLE1BQU07QUFDMUIsV0FBSyxLQUFLLFNBQVM7QUFDbkIsV0FBSyxLQUFLLFdBQVc7QUFBQSxJQUN0QjtBQUFBLEVBQ0Q7QUFBQTtBQUFBLEVBR0EsS0FBSyxLQUFzQztBQUMxQyxRQUFJLE9BQU8sS0FBSztBQUNoQixlQUFXLFdBQVcsS0FBSztBQUMxQixZQUFNLE9BQU8sS0FBSyxVQUFVLElBQUksT0FBTztBQUN2QyxVQUFJLENBQUMsTUFBTTtBQUNWLGVBQU87QUFBQSxNQUNSO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPLEtBQUssV0FBVyxRQUFRLFNBQVksS0FBSztBQUFBLEVBQ2pEO0FBQUE7QUFBQSxFQUdBLGVBQWUsS0FBZ0M7QUFDOUMsUUFBSSxPQUFPLEtBQUs7QUFDaEIsZUFBVyxXQUFXLEtBQUs7QUFDMUIsWUFBTSxPQUFPLEtBQUssVUFBVSxJQUFJLE9BQU87QUFDdkMsVUFBSSxDQUFDLE1BQU07QUFDVixlQUFPO0FBQUEsTUFDUjtBQUNBLFVBQUksS0FBSyxXQUFXLE9BQU87QUFDMUIsZUFBTztBQUFBLE1BQ1I7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUE7QUFBQSxFQUdBLGlCQUFpQixLQUFnQztBQUNoRCxRQUFJLE9BQU8sS0FBSztBQUNoQixlQUFXLFdBQVcsS0FBSztBQUMxQixZQUFNLE9BQU8sS0FBSyxVQUFVLElBQUksT0FBTztBQUN2QyxVQUFJLENBQUMsTUFBTTtBQUNWLGVBQU87QUFBQSxNQUNSO0FBRUEsYUFBTztBQUFBLElBQ1I7QUFFQSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFHQSxPQUFPLEtBQWdDO0FBQ3RDLFFBQUksT0FBTyxLQUFLO0FBQ2hCLGVBQVcsV0FBVyxLQUFLO0FBQzFCLFlBQU0sT0FBTyxLQUFLLFVBQVUsSUFBSSxPQUFPO0FBQ3ZDLFVBQUksQ0FBQyxNQUFNO0FBQ1YsZUFBTztBQUFBLE1BQ1I7QUFFQSxhQUFPO0FBQUEsSUFDUjtBQUVBLFdBQU8sS0FBSyxXQUFXO0FBQUEsRUFDeEI7QUFBQSxFQUVRLGFBQWEsS0FBdUI7QUFDM0MsVUFBTSxPQUFPLENBQUMsRUFBRSxNQUFNLElBQUksTUFBTSxLQUFLLEtBQUssQ0FBQztBQUMzQyxRQUFJLElBQUk7QUFDUixlQUFXLFFBQVEsS0FBSztBQUN2QixZQUFNLE9BQU8sS0FBSyxDQUFDLEVBQUUsS0FBSyxVQUFVLElBQUksSUFBSTtBQUM1QyxVQUFJLENBQUMsTUFBTTtBQUNWO0FBQUEsTUFDRDtBQUVBLFdBQUssS0FBSyxFQUFFLE1BQU0sS0FBSyxDQUFDO0FBQ3hCO0FBQUEsSUFDRDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSxPQUFPLEtBQXVCLElBQTZCLFdBQTJDO0FBQzdHLFFBQUksT0FBTyxLQUFLO0FBQ2hCLGVBQVcsUUFBUSxLQUFLO0FBQ3ZCLFVBQUksQ0FBQyxLQUFLLFVBQVU7QUFDbkIsY0FBTSxPQUFPLElBQUksS0FBUTtBQUN6QixhQUFLLFdBQVcsb0JBQUksSUFBSSxDQUFDLENBQUMsTUFBTSxJQUFJLENBQUMsQ0FBQztBQUN0QyxlQUFPO0FBQUEsTUFDUixXQUFXLENBQUMsS0FBSyxTQUFTLElBQUksSUFBSSxHQUFHO0FBQ3BDLGNBQU0sT0FBTyxJQUFJLEtBQVE7QUFDekIsYUFBSyxTQUFTLElBQUksTUFBTSxJQUFJO0FBQzVCLGVBQU87QUFBQSxNQUNSLE9BQU87QUFDTixlQUFPLEtBQUssU0FBUyxJQUFJLElBQUk7QUFBQSxNQUM5QjtBQUNBLGtCQUFZLElBQUk7QUFBQSxJQUNqQjtBQUVBLFVBQU0sYUFBYSxLQUFLLFdBQVcsUUFBUSxJQUFJO0FBQy9DLE9BQUcsSUFBSTtBQUNQLFVBQU0sWUFBWSxLQUFLLFdBQVcsUUFBUSxJQUFJO0FBQzlDLFNBQUssU0FBUyxZQUFZO0FBQUEsRUFDM0I7QUFBQTtBQUFBLEVBR0EsQ0FBQyxTQUFTO0FBQ1QsZUFBVyxFQUFFLE9BQU8sS0FBSyxXQUFXLEtBQUssSUFBSSxHQUFHO0FBQy9DLFVBQUksV0FBVyxPQUFPO0FBQ3JCLGNBQU07QUFBQSxNQUNQO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRDtBQUVBLFVBQVUsV0FBYyxNQUFrQztBQUN6RCxRQUFNLFFBQVEsQ0FBQyxJQUFJO0FBQ25CLFNBQU8sTUFBTSxTQUFTLEdBQUc7QUFDeEIsVUFBTSxPQUFPLE1BQU0sSUFBSTtBQUN2QixVQUFNO0FBRU4sUUFBSSxLQUFLLFVBQVU7QUFDbEIsaUJBQVcsU0FBUyxLQUFLLFNBQVMsT0FBTyxHQUFHO0FBQzNDLGNBQU0sS0FBSyxLQUFLO0FBQUEsTUFDakI7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUNEO0FBRUEsTUFBTSxLQUFzQztBQUFBLEVBQTVDO0FBV0MsU0FBTyxTQUEyQjtBQUFBO0FBQUEsRUFSbEMsSUFBVyxRQUFRO0FBQ2xCLFdBQU8sS0FBSyxXQUFXLFFBQVEsU0FBWSxLQUFLO0FBQUEsRUFDakQ7QUFBQSxFQUVBLElBQVcsTUFBTSxPQUFzQjtBQUN0QyxTQUFLLFNBQVMsVUFBVSxTQUFZLFFBQVE7QUFBQSxFQUM3QztBQUdEOyIsCiAgIm5hbWVzIjogW10KfQo=
