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
import { memoize } from "./decorators.js";
import { PathIterator } from "./ternarySearchTree.js";
import * as paths from "./path.js";
import { extUri as defaultExtUri } from "./resources.js";
import { URI } from "./uri.js";
class Node {
  constructor(uri, relativePath, context, element = void 0, parent = void 0) {
    this.uri = uri;
    this.relativePath = relativePath;
    this.context = context;
    this.element = element;
    this.parent = parent;
    this._children = /* @__PURE__ */ new Map();
  }
  get childrenCount() {
    return this._children.size;
  }
  get children() {
    return this._children.values();
  }
  get name() {
    return paths.posix.basename(this.relativePath);
  }
  get(path) {
    return this._children.get(path);
  }
  set(path, child) {
    this._children.set(path, child);
  }
  delete(path) {
    this._children.delete(path);
  }
  clear() {
    this._children.clear();
  }
}
__decorateClass([
  memoize
], Node.prototype, "name", 1);
function collect(node, result) {
  if (typeof node.element !== "undefined") {
    result.push(node.element);
  }
  for (const child of node.children) {
    collect(child, result);
  }
  return result;
}
class ResourceTree {
  constructor(context, rootURI = URI.file("/"), extUri = defaultExtUri) {
    this.extUri = extUri;
    this.root = new Node(rootURI, "", context);
  }
  static getRoot(node) {
    while (node.parent) {
      node = node.parent;
    }
    return node;
  }
  static collect(node) {
    return collect(node, []);
  }
  static isResourceNode(obj) {
    return obj instanceof Node;
  }
  add(uri, element) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    let node = this.root;
    let path = "";
    while (true) {
      const name = iterator.value();
      path = path + "/" + name;
      let child = node.get(name);
      if (!child) {
        child = new Node(
          this.extUri.joinPath(this.root.uri, path),
          path,
          this.root.context,
          iterator.hasNext() ? void 0 : element,
          node
        );
        node.set(name, child);
      } else if (!iterator.hasNext()) {
        child.element = element;
      }
      node = child;
      if (!iterator.hasNext()) {
        return;
      }
      iterator.next();
    }
  }
  delete(uri) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    return this._delete(this.root, iterator);
  }
  _delete(node, iterator) {
    const name = iterator.value();
    const child = node.get(name);
    if (!child) {
      return void 0;
    }
    if (iterator.hasNext()) {
      const result = this._delete(child, iterator.next());
      if (typeof result !== "undefined" && child.childrenCount === 0) {
        node.delete(name);
      }
      return result;
    }
    node.delete(name);
    return child.element;
  }
  clear() {
    this.root.clear();
  }
  getNode(uri) {
    const key = this.extUri.relativePath(this.root.uri, uri) || uri.path;
    const iterator = new PathIterator(false).reset(key);
    let node = this.root;
    while (true) {
      const name = iterator.value();
      const child = node.get(name);
      if (!child || !iterator.hasNext()) {
        return child;
      }
      node = child;
      iterator.next();
    }
  }
}
export {
  ResourceTree
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9iYXNlL2NvbW1vbi9yZXNvdXJjZVRyZWUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtZW1vaXplIH0gZnJvbSAnLi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IFBhdGhJdGVyYXRvciB9IGZyb20gJy4vdGVybmFyeVNlYXJjaFRyZWUuanMnO1xuaW1wb3J0ICogYXMgcGF0aHMgZnJvbSAnLi9wYXRoLmpzJztcbmltcG9ydCB7IGV4dFVyaSBhcyBkZWZhdWx0RXh0VXJpLCBJRXh0VXJpIH0gZnJvbSAnLi9yZXNvdXJjZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi91cmkuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElSZXNvdXJjZU5vZGU8VCwgQyA9IHZvaWQ+IHtcblx0cmVhZG9ubHkgdXJpOiBVUkk7XG5cdHJlYWRvbmx5IHJlbGF0aXZlUGF0aDogc3RyaW5nO1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGVsZW1lbnQ6IFQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNoaWxkcmVuOiBJdGVyYWJsZTxJUmVzb3VyY2VOb2RlPFQsIEM+Pjtcblx0cmVhZG9ubHkgY2hpbGRyZW5Db3VudDogbnVtYmVyO1xuXHRyZWFkb25seSBwYXJlbnQ6IElSZXNvdXJjZU5vZGU8VCwgQz4gfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNvbnRleHQ6IEM7XG5cdGdldChjaGlsZE5hbWU6IHN0cmluZyk6IElSZXNvdXJjZU5vZGU8VCwgQz4gfCB1bmRlZmluZWQ7XG59XG5cbmNsYXNzIE5vZGU8VCwgQz4gaW1wbGVtZW50cyBJUmVzb3VyY2VOb2RlPFQsIEM+IHtcblxuXHRwcml2YXRlIF9jaGlsZHJlbiA9IG5ldyBNYXA8c3RyaW5nLCBOb2RlPFQsIEM+PigpO1xuXG5cdGdldCBjaGlsZHJlbkNvdW50KCk6IG51bWJlciB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoaWxkcmVuLnNpemU7XG5cdH1cblxuXHRnZXQgY2hpbGRyZW4oKTogSXRlcmFibGU8Tm9kZTxULCBDPj4ge1xuXHRcdHJldHVybiB0aGlzLl9jaGlsZHJlbi52YWx1ZXMoKTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdGdldCBuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHBhdGhzLnBvc2l4LmJhc2VuYW1lKHRoaXMucmVsYXRpdmVQYXRoKTtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHJlYWRvbmx5IHVyaTogVVJJLFxuXHRcdHJlYWRvbmx5IHJlbGF0aXZlUGF0aDogc3RyaW5nLFxuXHRcdHJlYWRvbmx5IGNvbnRleHQ6IEMsXG5cdFx0cHVibGljIGVsZW1lbnQ6IFQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG5cdFx0cmVhZG9ubHkgcGFyZW50OiBJUmVzb3VyY2VOb2RlPFQsIEM+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkXG5cdCkgeyB9XG5cblx0Z2V0KHBhdGg6IHN0cmluZyk6IE5vZGU8VCwgQz4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jaGlsZHJlbi5nZXQocGF0aCk7XG5cdH1cblxuXHRzZXQocGF0aDogc3RyaW5nLCBjaGlsZDogTm9kZTxULCBDPik6IHZvaWQge1xuXHRcdHRoaXMuX2NoaWxkcmVuLnNldChwYXRoLCBjaGlsZCk7XG5cdH1cblxuXHRkZWxldGUocGF0aDogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fY2hpbGRyZW4uZGVsZXRlKHBhdGgpO1xuXHR9XG5cblx0Y2xlYXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fY2hpbGRyZW4uY2xlYXIoKTtcblx0fVxufVxuXG5mdW5jdGlvbiBjb2xsZWN0PFQsIEM+KG5vZGU6IElSZXNvdXJjZU5vZGU8VCwgQz4sIHJlc3VsdDogVFtdKTogVFtdIHtcblx0aWYgKHR5cGVvZiBub2RlLmVsZW1lbnQgIT09ICd1bmRlZmluZWQnKSB7XG5cdFx0cmVzdWx0LnB1c2gobm9kZS5lbGVtZW50KTtcblx0fVxuXG5cdGZvciAoY29uc3QgY2hpbGQgb2Ygbm9kZS5jaGlsZHJlbikge1xuXHRcdGNvbGxlY3QoY2hpbGQsIHJlc3VsdCk7XG5cdH1cblxuXHRyZXR1cm4gcmVzdWx0O1xufVxuXG5leHBvcnQgY2xhc3MgUmVzb3VyY2VUcmVlPFQgZXh0ZW5kcyBOb25OdWxsYWJsZTxhbnk+LCBDPiB7XG5cblx0cmVhZG9ubHkgcm9vdDogTm9kZTxULCBDPjtcblxuXHRzdGF0aWMgZ2V0Um9vdDxULCBDPihub2RlOiBJUmVzb3VyY2VOb2RlPFQsIEM+KTogSVJlc291cmNlTm9kZTxULCBDPiB7XG5cdFx0d2hpbGUgKG5vZGUucGFyZW50KSB7XG5cdFx0XHRub2RlID0gbm9kZS5wYXJlbnQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG5vZGU7XG5cdH1cblxuXHRzdGF0aWMgY29sbGVjdDxULCBDPihub2RlOiBJUmVzb3VyY2VOb2RlPFQsIEM+KTogVFtdIHtcblx0XHRyZXR1cm4gY29sbGVjdChub2RlLCBbXSk7XG5cdH1cblxuXHRzdGF0aWMgaXNSZXNvdXJjZU5vZGU8VCwgQz4ob2JqOiBhbnkpOiBvYmogaXMgSVJlc291cmNlTm9kZTxULCBDPiB7XG5cdFx0cmV0dXJuIG9iaiBpbnN0YW5jZW9mIE5vZGU7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihjb250ZXh0OiBDLCByb290VVJJOiBVUkkgPSBVUkkuZmlsZSgnLycpLCBwcml2YXRlIGV4dFVyaTogSUV4dFVyaSA9IGRlZmF1bHRFeHRVcmkpIHtcblx0XHR0aGlzLnJvb3QgPSBuZXcgTm9kZShyb290VVJJLCAnJywgY29udGV4dCk7XG5cdH1cblxuXHRhZGQodXJpOiBVUkksIGVsZW1lbnQ6IFQpOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSB0aGlzLmV4dFVyaS5yZWxhdGl2ZVBhdGgodGhpcy5yb290LnVyaSwgdXJpKSB8fCB1cmkucGF0aDtcblx0XHRjb25zdCBpdGVyYXRvciA9IG5ldyBQYXRoSXRlcmF0b3IoZmFsc2UpLnJlc2V0KGtleSk7XG5cdFx0bGV0IG5vZGUgPSB0aGlzLnJvb3Q7XG5cdFx0bGV0IHBhdGggPSAnJztcblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCBuYW1lID0gaXRlcmF0b3IudmFsdWUoKTtcblx0XHRcdHBhdGggPSBwYXRoICsgJy8nICsgbmFtZTtcblxuXHRcdFx0bGV0IGNoaWxkID0gbm9kZS5nZXQobmFtZSk7XG5cblx0XHRcdGlmICghY2hpbGQpIHtcblx0XHRcdFx0Y2hpbGQgPSBuZXcgTm9kZShcblx0XHRcdFx0XHR0aGlzLmV4dFVyaS5qb2luUGF0aCh0aGlzLnJvb3QudXJpLCBwYXRoKSxcblx0XHRcdFx0XHRwYXRoLFxuXHRcdFx0XHRcdHRoaXMucm9vdC5jb250ZXh0LFxuXHRcdFx0XHRcdGl0ZXJhdG9yLmhhc05leHQoKSA/IHVuZGVmaW5lZCA6IGVsZW1lbnQsXG5cdFx0XHRcdFx0bm9kZVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdG5vZGUuc2V0KG5hbWUsIGNoaWxkKTtcblx0XHRcdH0gZWxzZSBpZiAoIWl0ZXJhdG9yLmhhc05leHQoKSkge1xuXHRcdFx0XHRjaGlsZC5lbGVtZW50ID0gZWxlbWVudDtcblx0XHRcdH1cblxuXHRcdFx0bm9kZSA9IGNoaWxkO1xuXG5cdFx0XHRpZiAoIWl0ZXJhdG9yLmhhc05leHQoKSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGl0ZXJhdG9yLm5leHQoKTtcblx0XHR9XG5cdH1cblxuXHRkZWxldGUodXJpOiBVUkkpOiBUIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBrZXkgPSB0aGlzLmV4dFVyaS5yZWxhdGl2ZVBhdGgodGhpcy5yb290LnVyaSwgdXJpKSB8fCB1cmkucGF0aDtcblx0XHRjb25zdCBpdGVyYXRvciA9IG5ldyBQYXRoSXRlcmF0b3IoZmFsc2UpLnJlc2V0KGtleSk7XG5cdFx0cmV0dXJuIHRoaXMuX2RlbGV0ZSh0aGlzLnJvb3QsIGl0ZXJhdG9yKTtcblx0fVxuXG5cdHByaXZhdGUgX2RlbGV0ZShub2RlOiBOb2RlPFQsIEM+LCBpdGVyYXRvcjogUGF0aEl0ZXJhdG9yKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Y29uc3QgbmFtZSA9IGl0ZXJhdG9yLnZhbHVlKCk7XG5cdFx0Y29uc3QgY2hpbGQgPSBub2RlLmdldChuYW1lKTtcblxuXHRcdGlmICghY2hpbGQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0aWYgKGl0ZXJhdG9yLmhhc05leHQoKSkge1xuXHRcdFx0Y29uc3QgcmVzdWx0ID0gdGhpcy5fZGVsZXRlKGNoaWxkLCBpdGVyYXRvci5uZXh0KCkpO1xuXG5cdFx0XHRpZiAodHlwZW9mIHJlc3VsdCAhPT0gJ3VuZGVmaW5lZCcgJiYgY2hpbGQuY2hpbGRyZW5Db3VudCA9PT0gMCkge1xuXHRcdFx0XHRub2RlLmRlbGV0ZShuYW1lKTtcblx0XHRcdH1cblxuXHRcdFx0cmV0dXJuIHJlc3VsdDtcblx0XHR9XG5cblx0XHRub2RlLmRlbGV0ZShuYW1lKTtcblx0XHRyZXR1cm4gY2hpbGQuZWxlbWVudDtcblx0fVxuXG5cdGNsZWFyKCk6IHZvaWQge1xuXHRcdHRoaXMucm9vdC5jbGVhcigpO1xuXHR9XG5cblx0Z2V0Tm9kZSh1cmk6IFVSSSk6IElSZXNvdXJjZU5vZGU8VCwgQz4gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGtleSA9IHRoaXMuZXh0VXJpLnJlbGF0aXZlUGF0aCh0aGlzLnJvb3QudXJpLCB1cmkpIHx8IHVyaS5wYXRoO1xuXHRcdGNvbnN0IGl0ZXJhdG9yID0gbmV3IFBhdGhJdGVyYXRvcihmYWxzZSkucmVzZXQoa2V5KTtcblx0XHRsZXQgbm9kZSA9IHRoaXMucm9vdDtcblxuXHRcdHdoaWxlICh0cnVlKSB7XG5cdFx0XHRjb25zdCBuYW1lID0gaXRlcmF0b3IudmFsdWUoKTtcblx0XHRcdGNvbnN0IGNoaWxkID0gbm9kZS5nZXQobmFtZSk7XG5cblx0XHRcdGlmICghY2hpbGQgfHwgIWl0ZXJhdG9yLmhhc05leHQoKSkge1xuXHRcdFx0XHRyZXR1cm4gY2hpbGQ7XG5cdFx0XHR9XG5cblx0XHRcdG5vZGUgPSBjaGlsZDtcblx0XHRcdGl0ZXJhdG9yLm5leHQoKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyxvQkFBb0I7QUFDN0IsWUFBWSxXQUFXO0FBQ3ZCLFNBQVMsVUFBVSxxQkFBOEI7QUFDakQsU0FBUyxXQUFXO0FBY3BCLE1BQU0sS0FBMEM7QUFBQSxFQWlCL0MsWUFDVSxLQUNBLGNBQ0EsU0FDRixVQUF5QixRQUN2QixTQUEwQyxRQUNsRDtBQUxRO0FBQ0E7QUFDQTtBQUNGO0FBQ0U7QUFwQlYsU0FBUSxZQUFZLG9CQUFJLElBQXdCO0FBQUEsRUFxQjVDO0FBQUEsRUFuQkosSUFBSSxnQkFBd0I7QUFDM0IsV0FBTyxLQUFLLFVBQVU7QUFBQSxFQUN2QjtBQUFBLEVBRUEsSUFBSSxXQUFpQztBQUNwQyxXQUFPLEtBQUssVUFBVSxPQUFPO0FBQUEsRUFDOUI7QUFBQSxFQUdBLElBQUksT0FBZTtBQUNsQixXQUFPLE1BQU0sTUFBTSxTQUFTLEtBQUssWUFBWTtBQUFBLEVBQzlDO0FBQUEsRUFVQSxJQUFJLE1BQXND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
