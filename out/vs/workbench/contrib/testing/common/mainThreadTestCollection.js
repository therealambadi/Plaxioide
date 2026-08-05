import { Emitter } from "../../../../base/common/event.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { LinkedList } from "../../../../base/common/linkedList.js";
import { ResourceMap } from "../../../../base/common/map.js";
import { AbstractIncrementalTestCollection, TestDiffOpType } from "./testTypes.js";
class MainThreadTestCollection extends AbstractIncrementalTestCollection {
  constructor(uriIdentityService, expandActual) {
    super(uriIdentityService);
    this.expandActual = expandActual;
    this.testsByUrl = new ResourceMap();
    this.busyProvidersChangeEmitter = new Emitter();
    this.expandPromises = /* @__PURE__ */ new WeakMap();
    this.onBusyProvidersChange = this.busyProvidersChangeEmitter.event;
    this.changeCollector = {
      add: (node) => {
        if (!node.item.uri) {
          return;
        }
        const s = this.testsByUrl.get(node.item.uri);
        if (!s) {
          this.testsByUrl.set(node.item.uri, /* @__PURE__ */ new Set([node]));
        } else {
          s.add(node);
        }
      },
      remove: (node) => {
        if (!node.item.uri) {
          return;
        }
        const s = this.testsByUrl.get(node.item.uri);
        if (!s) {
          return;
        }
        s.delete(node);
        if (s.size === 0) {
          this.testsByUrl.delete(node.item.uri);
        }
      }
    };
  }
  /**
   * @inheritdoc
   */
  get busyProviders() {
    return this.busyControllerCount;
  }
  /**
   * @inheritdoc
   */
  get rootItems() {
    return this.roots;
  }
  /**
   * @inheritdoc
   */
  get all() {
    return this.getIterator();
  }
  get rootIds() {
    return Iterable.map(this.roots.values(), (r) => r.item.extId);
  }
  /**
   * @inheritdoc
   */
  expand(testId, levels) {
    const test = this.items.get(testId);
    if (!test) {
      return Promise.resolve();
    }
    const existing = this.expandPromises.get(test);
    if (existing && existing.pendingLvl >= levels) {
      return existing.prom;
    }
    const prom = this.expandActual(test.item.extId, levels);
    const record = { doneLvl: existing ? existing.doneLvl : -1, pendingLvl: levels, prom };
    this.expandPromises.set(test, record);
    return prom.then(() => {
      record.doneLvl = levels;
    });
  }
  /**
   * @inheritdoc
   */
  getNodeById(id) {
    return this.items.get(id);
  }
  /**
   * @inheritdoc
   */
  getNodeByUrl(uri) {
    return this.testsByUrl.get(uri) || Iterable.empty();
  }
  /**
   * @inheritdoc
   */
  getReviverDiff() {
    const ops = [{ op: TestDiffOpType.IncrementPendingExtHosts, amount: this.pendingRootCount }];
    const queue = [this.rootIds];
    while (queue.length) {
      for (const child of queue.pop()) {
        const item = this.items.get(child);
        ops.push({
          op: TestDiffOpType.Add,
          item: {
            controllerId: item.controllerId,
            expand: item.expand,
            item: item.item
          }
        });
        queue.push(item.children);
      }
    }
    return ops;
  }
  /**
   * Applies the diff to the collection.
   */
  apply(diff) {
    const prevBusy = this.busyControllerCount;
    super.apply(diff);
    if (prevBusy !== this.busyControllerCount) {
      this.busyProvidersChangeEmitter.fire(this.busyControllerCount);
    }
  }
  /**
   * Clears everything from the collection, and returns a diff that applies
   * that action.
   */
  clear() {
    const ops = [];
    for (const root of this.roots) {
      ops.push({ op: TestDiffOpType.Remove, itemId: root.item.extId });
    }
    this.roots.clear();
    this.items.clear();
    return ops;
  }
  /**
   * @override
   */
  createItem(internal) {
    return { ...internal, children: /* @__PURE__ */ new Set() };
  }
  createChangeCollector() {
    return this.changeCollector;
  }
  *getIterator() {
    const queue = new LinkedList();
    queue.push(this.rootIds);
    while (queue.size > 0) {
      for (const id of queue.pop()) {
        const node = this.getNodeById(id);
        yield node;
        queue.push(node.children);
      }
    }
  }
}
export {
  MainThreadTestCollection
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXN0aW5nL2NvbW1vbi9tYWluVGhyZWFkVGVzdENvbGxlY3Rpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBMaW5rZWRMaXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlua2VkTGlzdC5qcyc7XG5pbXBvcnQgeyBSZXNvdXJjZU1hcCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgSU1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiB9IGZyb20gJy4vdGVzdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQWJzdHJhY3RJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uLCBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIsIEluY3JlbWVudGFsQ2hhbmdlQ29sbGVjdG9yLCBJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbSwgSW50ZXJuYWxUZXN0SXRlbSwgVGVzdERpZmZPcFR5cGUsIFRlc3RzRGlmZiB9IGZyb20gJy4vdGVzdFR5cGVzLmpzJztcblxuZXhwb3J0IGNsYXNzIE1haW5UaHJlYWRUZXN0Q29sbGVjdGlvbiBleHRlbmRzIEFic3RyYWN0SW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbjxJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbT4gaW1wbGVtZW50cyBJTWFpblRocmVhZFRlc3RDb2xsZWN0aW9uIHtcblx0cHJpdmF0ZSB0ZXN0c0J5VXJsID0gbmV3IFJlc291cmNlTWFwPFNldDxJbmNyZW1lbnRhbFRlc3RDb2xsZWN0aW9uSXRlbT4+KCk7XG5cblx0cHJpdmF0ZSBidXN5UHJvdmlkZXJzQ2hhbmdlRW1pdHRlciA9IG5ldyBFbWl0dGVyPG51bWJlcj4oKTtcblx0cHJpdmF0ZSBleHBhbmRQcm9taXNlcyA9IG5ldyBXZWFrTWFwPEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtLCB7XG5cdFx0cGVuZGluZ0x2bDogbnVtYmVyO1xuXHRcdGRvbmVMdmw6IG51bWJlcjtcblx0XHRwcm9tOiBQcm9taXNlPHZvaWQ+O1xuXHR9PigpO1xuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGdldCBidXN5UHJvdmlkZXJzKCkge1xuXHRcdHJldHVybiB0aGlzLmJ1c3lDb250cm9sbGVyQ291bnQ7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBnZXQgcm9vdEl0ZW1zKCkge1xuXHRcdHJldHVybiB0aGlzLnJvb3RzO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0IGFsbCgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRJdGVyYXRvcigpO1xuXHR9XG5cblx0cHVibGljIGdldCByb290SWRzKCkge1xuXHRcdHJldHVybiBJdGVyYWJsZS5tYXAodGhpcy5yb290cy52YWx1ZXMoKSwgciA9PiByLml0ZW0uZXh0SWQpO1xuXHR9XG5cblx0cHVibGljIHJlYWRvbmx5IG9uQnVzeVByb3ZpZGVyc0NoYW5nZSA9IHRoaXMuYnVzeVByb3ZpZGVyc0NoYW5nZUVtaXR0ZXIuZXZlbnQ7XG5cblx0Y29uc3RydWN0b3IodXJpSWRlbnRpdHlTZXJ2aWNlOiBJVGVzdFVyaUNhbm9uaWNhbGl6ZXIsIHByaXZhdGUgcmVhZG9ubHkgZXhwYW5kQWN0dWFsOiAoaWQ6IHN0cmluZywgbGV2ZWxzOiBudW1iZXIpID0+IFByb21pc2U8dm9pZD4pIHtcblx0XHRzdXBlcih1cmlJZGVudGl0eVNlcnZpY2UpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZXhwYW5kKHRlc3RJZDogc3RyaW5nLCBsZXZlbHM6IG51bWJlcik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IHRlc3QgPSB0aGlzLml0ZW1zLmdldCh0ZXN0SWQpO1xuXHRcdGlmICghdGVzdCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZSgpO1xuXHRcdH1cblxuXHRcdC8vIHNpbXBsZSBjYWNoZSB0byBhdm9pZCBkdXBsaWNhdGUvdW5uZWNlc3NhcnkgZXhwYW5zaW9uIGNhbGxzXG5cdFx0Y29uc3QgZXhpc3RpbmcgPSB0aGlzLmV4cGFuZFByb21pc2VzLmdldCh0ZXN0KTtcblx0XHRpZiAoZXhpc3RpbmcgJiYgZXhpc3RpbmcucGVuZGluZ0x2bCA+PSBsZXZlbHMpIHtcblx0XHRcdHJldHVybiBleGlzdGluZy5wcm9tO1xuXHRcdH1cblxuXHRcdGNvbnN0IHByb20gPSB0aGlzLmV4cGFuZEFjdHVhbCh0ZXN0Lml0ZW0uZXh0SWQsIGxldmVscyk7XG5cdFx0Y29uc3QgcmVjb3JkID0geyBkb25lTHZsOiBleGlzdGluZyA/IGV4aXN0aW5nLmRvbmVMdmwgOiAtMSwgcGVuZGluZ0x2bDogbGV2ZWxzLCBwcm9tIH07XG5cdFx0dGhpcy5leHBhbmRQcm9taXNlcy5zZXQodGVzdCwgcmVjb3JkKTtcblxuXHRcdHJldHVybiBwcm9tLnRoZW4oKCkgPT4ge1xuXHRcdFx0cmVjb3JkLmRvbmVMdmwgPSBsZXZlbHM7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQGluaGVyaXRkb2Ncblx0ICovXG5cdHB1YmxpYyBnZXROb2RlQnlJZChpZDogc3RyaW5nKSB7XG5cdFx0cmV0dXJuIHRoaXMuaXRlbXMuZ2V0KGlkKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBAaW5oZXJpdGRvY1xuXHQgKi9cblx0cHVibGljIGdldE5vZGVCeVVybCh1cmk6IFVSSSk6IEl0ZXJhYmxlPEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtPiB7XG5cdFx0cmV0dXJuIHRoaXMudGVzdHNCeVVybC5nZXQodXJpKSB8fCBJdGVyYWJsZS5lbXB0eSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIEBpbmhlcml0ZG9jXG5cdCAqL1xuXHRwdWJsaWMgZ2V0UmV2aXZlckRpZmYoKSB7XG5cdFx0Y29uc3Qgb3BzOiBUZXN0c0RpZmYgPSBbeyBvcDogVGVzdERpZmZPcFR5cGUuSW5jcmVtZW50UGVuZGluZ0V4dEhvc3RzLCBhbW91bnQ6IHRoaXMucGVuZGluZ1Jvb3RDb3VudCB9XTtcblxuXHRcdGNvbnN0IHF1ZXVlID0gW3RoaXMucm9vdElkc107XG5cdFx0d2hpbGUgKHF1ZXVlLmxlbmd0aCkge1xuXHRcdFx0Zm9yIChjb25zdCBjaGlsZCBvZiBxdWV1ZS5wb3AoKSEpIHtcblx0XHRcdFx0Y29uc3QgaXRlbSA9IHRoaXMuaXRlbXMuZ2V0KGNoaWxkKSE7XG5cdFx0XHRcdG9wcy5wdXNoKHtcblx0XHRcdFx0XHRvcDogVGVzdERpZmZPcFR5cGUuQWRkLFxuXHRcdFx0XHRcdGl0ZW06IHtcblx0XHRcdFx0XHRcdGNvbnRyb2xsZXJJZDogaXRlbS5jb250cm9sbGVySWQsXG5cdFx0XHRcdFx0XHRleHBhbmQ6IGl0ZW0uZXhwYW5kLFxuXHRcdFx0XHRcdFx0aXRlbTogaXRlbS5pdGVtLFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSk7XG5cdFx0XHRcdHF1ZXVlLnB1c2goaXRlbS5jaGlsZHJlbik7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIG9wcztcblx0fVxuXG5cdC8qKlxuXHQgKiBBcHBsaWVzIHRoZSBkaWZmIHRvIHRoZSBjb2xsZWN0aW9uLlxuXHQgKi9cblx0cHVibGljIG92ZXJyaWRlIGFwcGx5KGRpZmY6IFRlc3RzRGlmZikge1xuXHRcdGNvbnN0IHByZXZCdXN5ID0gdGhpcy5idXN5Q29udHJvbGxlckNvdW50O1xuXHRcdHN1cGVyLmFwcGx5KGRpZmYpO1xuXG5cdFx0aWYgKHByZXZCdXN5ICE9PSB0aGlzLmJ1c3lDb250cm9sbGVyQ291bnQpIHtcblx0XHRcdHRoaXMuYnVzeVByb3ZpZGVyc0NoYW5nZUVtaXR0ZXIuZmlyZSh0aGlzLmJ1c3lDb250cm9sbGVyQ291bnQpO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBDbGVhcnMgZXZlcnl0aGluZyBmcm9tIHRoZSBjb2xsZWN0aW9uLCBhbmQgcmV0dXJucyBhIGRpZmYgdGhhdCBhcHBsaWVzXG5cdCAqIHRoYXQgYWN0aW9uLlxuXHQgKi9cblx0cHVibGljIGNsZWFyKCkge1xuXHRcdGNvbnN0IG9wczogVGVzdHNEaWZmID0gW107XG5cdFx0Zm9yIChjb25zdCByb290IG9mIHRoaXMucm9vdHMpIHtcblx0XHRcdG9wcy5wdXNoKHsgb3A6IFRlc3REaWZmT3BUeXBlLlJlbW92ZSwgaXRlbUlkOiByb290Lml0ZW0uZXh0SWQgfSk7XG5cdFx0fVxuXG5cdFx0dGhpcy5yb290cy5jbGVhcigpO1xuXHRcdHRoaXMuaXRlbXMuY2xlYXIoKTtcblxuXHRcdHJldHVybiBvcHM7XG5cdH1cblxuXHQvKipcblx0ICogQG92ZXJyaWRlXG5cdCAqL1xuXHRwcm90ZWN0ZWQgY3JlYXRlSXRlbShpbnRlcm5hbDogSW50ZXJuYWxUZXN0SXRlbSk6IEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtIHtcblx0XHRyZXR1cm4geyAuLi5pbnRlcm5hbCwgY2hpbGRyZW46IG5ldyBTZXQoKSB9O1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBjaGFuZ2VDb2xsZWN0b3I6IEluY3JlbWVudGFsQ2hhbmdlQ29sbGVjdG9yPEluY3JlbWVudGFsVGVzdENvbGxlY3Rpb25JdGVtPiA9IHtcblx0XHRhZGQ6IG5vZGUgPT4ge1xuXHRcdFx0aWYgKCFub2RlLml0ZW0udXJpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcyA9IHRoaXMudGVzdHNCeVVybC5nZXQobm9kZS5pdGVtLnVyaSk7XG5cdFx0XHRpZiAoIXMpIHtcblx0XHRcdFx0dGhpcy50ZXN0c0J5VXJsLnNldChub2RlLml0ZW0udXJpLCBuZXcgU2V0KFtub2RlXSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0cy5hZGQobm9kZSk7XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRyZW1vdmU6IG5vZGUgPT4ge1xuXHRcdFx0aWYgKCFub2RlLml0ZW0udXJpKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgcyA9IHRoaXMudGVzdHNCeVVybC5nZXQobm9kZS5pdGVtLnVyaSk7XG5cdFx0XHRpZiAoIXMpIHtcblx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0fVxuXG5cdFx0XHRzLmRlbGV0ZShub2RlKTtcblx0XHRcdGlmIChzLnNpemUgPT09IDApIHtcblx0XHRcdFx0dGhpcy50ZXN0c0J5VXJsLmRlbGV0ZShub2RlLml0ZW0udXJpKTtcblx0XHRcdH1cblx0XHR9LFxuXHR9O1xuXG5cdHByb3RlY3RlZCBvdmVycmlkZSBjcmVhdGVDaGFuZ2VDb2xsZWN0b3IoKTogSW5jcmVtZW50YWxDaGFuZ2VDb2xsZWN0b3I8SW5jcmVtZW50YWxUZXN0Q29sbGVjdGlvbkl0ZW0+IHtcblx0XHRyZXR1cm4gdGhpcy5jaGFuZ2VDb2xsZWN0b3I7XG5cdH1cblxuXHRwcml2YXRlICpnZXRJdGVyYXRvcigpIHtcblx0XHRjb25zdCBxdWV1ZSA9IG5ldyBMaW5rZWRMaXN0PEl0ZXJhYmxlPHN0cmluZz4+KCk7XG5cdFx0cXVldWUucHVzaCh0aGlzLnJvb3RJZHMpO1xuXG5cdFx0d2hpbGUgKHF1ZXVlLnNpemUgPiAwKSB7XG5cdFx0XHRmb3IgKGNvbnN0IGlkIG9mIHF1ZXVlLnBvcCgpISkge1xuXHRcdFx0XHRjb25zdCBub2RlID0gdGhpcy5nZXROb2RlQnlJZChpZCkhO1xuXHRcdFx0XHR5aWVsZCBub2RlO1xuXHRcdFx0XHRxdWV1ZS5wdXNoKG5vZGUuY2hpbGRyZW4pO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CO0FBRzVCLFNBQVMsbUNBQXVJLHNCQUFpQztBQUUxSyxNQUFNLGlDQUFpQyxrQ0FBc0c7QUFBQSxFQXFDbkosWUFBWSxvQkFBNEQsY0FBNkQ7QUFDcEksVUFBTSxrQkFBa0I7QUFEK0M7QUFwQ3hFLFNBQVEsYUFBYSxJQUFJLFlBQWdEO0FBRXpFLFNBQVEsNkJBQTZCLElBQUksUUFBZ0I7QUFDekQsU0FBUSxpQkFBaUIsb0JBQUksUUFJMUI7QUEyQkgsU0FBZ0Isd0JBQXdCLEtBQUssMkJBQTJCO0FBd0d4RSxTQUFpQixrQkFBNkU7QUFBQSxNQUM3RixLQUFLLFVBQVE7QUFDWixZQUFJLENBQUMsS0FBSyxLQUFLLEtBQUs7QUFDbkI7QUFBQSxRQUNEO0FBRUEsY0FBTSxJQUFJLEtBQUssV0FBVyxJQUFJLEtBQUssS0FBSyxHQUFHO0FBQzNDLFlBQUksQ0FBQyxHQUFHO0FBQ1AsZUFBSyxXQUFXLElBQUksS0FBSyxLQUFLLEtBQUssb0JBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQUEsUUFDbkQsT0FBTztBQUNOLFlBQUUsSUFB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
