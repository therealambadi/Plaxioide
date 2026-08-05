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
import { Emitter } from "../../../../../base/common/event.js";
import { Disposable } from "../../../../../base/common/lifecycle.js";
import { IExtensionService } from "../../../../services/extensions/common/extensions.js";
let NotebookRendererMessagingService = class extends Disposable {
  constructor(extensionService) {
    super();
    this.extensionService = extensionService;
    /**
     * Activation promises. Maps renderer IDs to a queue of messages that should
     * be sent once activation finishes, or undefined if activation is complete.
     */
    this.activations = /* @__PURE__ */ new Map();
    this.scopedMessaging = /* @__PURE__ */ new Map();
    this.postMessageEmitter = this._register(new Emitter());
    this.onShouldPostMessage = this.postMessageEmitter.event;
  }
  /** @inheritdoc */
  receiveMessage(editorId, rendererId, message) {
    if (editorId === void 0) {
      const sends = [...this.scopedMessaging.values()].map((e) => e.receiveMessageHandler?.(rendererId, message));
      return Promise.all(sends).then((s) => s.some((s2) => !!s2));
    }
    return this.scopedMessaging.get(editorId)?.receiveMessageHandler?.(rendererId, message) ?? Promise.resolve(false);
  }
  /** @inheritdoc */
  prepare(rendererId) {
    if (this.activations.has(rendererId)) {
      return;
    }
    const queue = [];
    this.activations.set(rendererId, queue);
    this.extensionService.activateByEvent(`onRenderer:${rendererId}`).then(() => {
      for (const message of queue) {
        this.postMessageEmitter.fire(message);
      }
      this.activations.set(rendererId, void 0);
    });
  }
  /** @inheritdoc */
  getScoped(editorId) {
    const existing = this.scopedMessaging.get(editorId);
    if (existing) {
      return existing;
    }
    const messaging = {
      postMessage: (rendererId, message) => this.postMessage(editorId, rendererId, message),
      dispose: () => this.scopedMessaging.delete(editorId)
    };
    this.scopedMessaging.set(editorId, messaging);
    return messaging;
  }
  postMessage(editorId, rendererId, message) {
    if (!this.activations.has(rendererId)) {
      this.prepare(rendererId);
    }
    const activation = this.activations.get(rendererId);
    const toSend = { rendererId, editorId, message };
    if (activation === void 0) {
      this.postMessageEmitter.fire(toSend);
    } else {
      activation.push(toSend);
    }
  }
};
NotebookRendererMessagingService = __decorateClass([
  __decorateParam(0, IExtensionService)
], NotebookRendererMessagingService);
export {
  NotebookRendererMessagingService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL3NlcnZpY2VzL25vdGVib29rUmVuZGVyZXJNZXNzYWdpbmdTZXJ2aWNlSW1wbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElOb3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nU2VydmljZSwgSVNjb3BlZFJlbmRlcmVyTWVzc2FnaW5nIH0gZnJvbSAnLi4vLi4vY29tbW9uL25vdGVib29rUmVuZGVyZXJNZXNzYWdpbmdTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5cbnR5cGUgTWVzc2FnZVRvU2VuZCA9IHsgZWRpdG9ySWQ6IHN0cmluZzsgcmVuZGVyZXJJZDogc3RyaW5nOyBtZXNzYWdlOiB1bmtub3duIH07XG5cbmV4cG9ydCBjbGFzcyBOb3RlYm9va1JlbmRlcmVyTWVzc2FnaW5nU2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJTm90ZWJvb2tSZW5kZXJlck1lc3NhZ2luZ1NlcnZpY2Uge1xuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblx0LyoqXG5cdCAqIEFjdGl2YXRpb24gcHJvbWlzZXMuIE1hcHMgcmVuZGVyZXIgSURzIHRvIGEgcXVldWUgb2YgbWVzc2FnZXMgdGhhdCBzaG91bGRcblx0ICogYmUgc2VudCBvbmNlIGFjdGl2YXRpb24gZmluaXNoZXMsIG9yIHVuZGVmaW5lZCBpZiBhY3RpdmF0aW9uIGlzIGNvbXBsZXRlLlxuXHQgKi9cblx0cHJpdmF0ZSByZWFkb25seSBhY3RpdmF0aW9ucyA9IG5ldyBNYXA8c3RyaW5nIC8qIHJlbmRlcmVySWQgKi8sIHVuZGVmaW5lZCB8IE1lc3NhZ2VUb1NlbmRbXT4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBzY29wZWRNZXNzYWdpbmcgPSBuZXcgTWFwPC8qIGVkaXRvcklkICovIHN0cmluZywgSVNjb3BlZFJlbmRlcmVyTWVzc2FnaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IHBvc3RNZXNzYWdlRW1pdHRlciA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPE1lc3NhZ2VUb1NlbmQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25TaG91bGRQb3N0TWVzc2FnZSA9IHRoaXMucG9zdE1lc3NhZ2VFbWl0dGVyLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cdH1cblxuXHQvKiogQGluaGVyaXRkb2MgKi9cblx0cHVibGljIHJlY2VpdmVNZXNzYWdlKGVkaXRvcklkOiBzdHJpbmcgfCB1bmRlZmluZWQsIHJlbmRlcmVySWQ6IHN0cmluZywgbWVzc2FnZTogdW5rbm93bik6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGlmIChlZGl0b3JJZCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRjb25zdCBzZW5kcyA9IFsuLi50aGlzLnNjb3BlZE1lc3NhZ2luZy52YWx1ZXMoKV0ubWFwKGUgPT4gZS5yZWNlaXZlTWVzc2FnZUhhbmRsZXI/LihyZW5kZXJlcklkLCBtZXNzYWdlKSk7XG5cdFx0XHRyZXR1cm4gUHJvbWlzZS5hbGwoc2VuZHMpLnRoZW4ocyA9PiBzLnNvbWUocyA9PiAhIXMpKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5zY29wZWRNZXNzYWdpbmcuZ2V0KGVkaXRvcklkKT8ucmVjZWl2ZU1lc3NhZ2VIYW5kbGVyPy4ocmVuZGVyZXJJZCwgbWVzc2FnZSkgPz8gUHJvbWlzZS5yZXNvbHZlKGZhbHNlKTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgcHJlcGFyZShyZW5kZXJlcklkOiBzdHJpbmcpIHtcblx0XHRpZiAodGhpcy5hY3RpdmF0aW9ucy5oYXMocmVuZGVyZXJJZCkpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBxdWV1ZTogTWVzc2FnZVRvU2VuZFtdID0gW107XG5cdFx0dGhpcy5hY3RpdmF0aW9ucy5zZXQocmVuZGVyZXJJZCwgcXVldWUpO1xuXG5cdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudChgb25SZW5kZXJlcjoke3JlbmRlcmVySWR9YCkudGhlbigoKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IG1lc3NhZ2Ugb2YgcXVldWUpIHtcblx0XHRcdFx0dGhpcy5wb3N0TWVzc2FnZUVtaXR0ZXIuZmlyZShtZXNzYWdlKTtcblx0XHRcdH1cblxuXHRcdFx0dGhpcy5hY3RpdmF0aW9ucy5zZXQocmVuZGVyZXJJZCwgdW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxuXG5cdC8qKiBAaW5oZXJpdGRvYyAqL1xuXHRwdWJsaWMgZ2V0U2NvcGVkKGVkaXRvcklkOiBzdHJpbmcpOiBJU2NvcGVkUmVuZGVyZXJNZXNzYWdpbmcge1xuXHRcdGNvbnN0IGV4aXN0aW5nID0gdGhpcy5zY29wZWRNZXNzYWdpbmcuZ2V0KGVkaXRvcklkKTtcblx0XHRpZiAoZXhpc3RpbmcpIHtcblx0XHRcdHJldHVybiBleGlzdGluZztcblx0XHR9XG5cblx0XHRjb25zdCBtZXNzYWdpbmc6IElTY29wZWRSZW5kZXJlck1lc3NhZ2luZyA9IHtcblx0XHRcdHBvc3RNZXNzYWdlOiAocmVuZGVyZXJJZCwgbWVzc2FnZSkgPT4gdGhpcy5wb3N0TWVzc2FnZShlZGl0b3JJZCwgcmVuZGVyZXJJZCwgbWVzc2FnZSksXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB0aGlzLnNjb3BlZE1lc3NhZ2luZy5kZWxldGUoZWRpdG9ySWQpLFxuXHRcdH07XG5cblx0XHR0aGlzLnNjb3BlZE1lc3NhZ2luZy5zZXQoZWRpdG9ySWQsIG1lc3NhZ2luZyk7XG5cdFx0cmV0dXJuIG1lc3NhZ2luZztcblx0fVxuXG5cdHByaXZhdGUgcG9zdE1lc3NhZ2UoZWRpdG9ySWQ6IHN0cmluZywgcmVuZGVyZXJJZDogc3RyaW5nLCBtZXNzYWdlOiB1bmtub3duKTogdm9pZCB7XG5cdFx0aWYgKCF0aGlzLmFjdGl2YXRpb25zLmhhcyhyZW5kZXJlcklkKSkge1xuXHRcdFx0dGhpcy5wcmVwYXJlKHJlbmRlcmVySWQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGFjdGl2YXRpb24gPSB0aGlzLmFjdGl2YXRpb25zLmdldChyZW5kZXJlcklkKTtcblx0XHRjb25zdCB0b1NlbmQgPSB7IHJlbmRlcmVySWQsIGVkaXRvcklkLCBtZXNzYWdlIH07XG5cdFx0aWYgKGFjdGl2YXRpb24gPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0dGhpcy5wb3N0TWVzc2FnZUVtaXR0ZXIuZmlyZSh0b1NlbmQpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRhY3RpdmF0aW9uLnB1c2godG9TZW5kKTtcblx0XHR9XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMseUJBQXlCO0FBSTNCLElBQU0sbUNBQU4sY0FBK0MsV0FBd0Q7QUFBQSxFQVc3RyxZQUNxQyxrQkFDbkM7QUFDRCxVQUFNO0FBRjhCO0FBTnJDO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FBaUIsY0FBYyxvQkFBSSxJQUEwRDtBQUM3RixTQUFpQixrQkFBa0Isb0JBQUksSUFBcUQ7QUFDNUYsU0FBaUIscUJBQXFCLEtBQUssVUFBVSxJQUFJLFFBQXVCLENBQUM7QUFDakYsU0FBZ0Isc0JBQXNCLEtBQUssbUJBQW1CO0FBQUEsRUFNOUQ7QUFBQTtBQUFBLEVBR08sZUFBZSxVQUE4QixZQUFvQixTQUFvQztBQUMzRyxRQUFJLGFBQWEsUUFBVztBQUMzQixZQUFNLFFBQVEsQ0FBQyxHQUFHLEtBQUssZ0JBQWdCLE9BQU8sQ0FBQyxFQUFFLElBQUksT0FBSyxFQUFFLHdCQUF3QixZQUFZLE9BQU8sQ0FBQztBQUN4RyxhQUFPLFFBQVEsSUFBSSxLQUFLLEVBQUUsS0FBSyxPQUFLLEVBQUUsS0FBSyxDQUFBQSxPQUFLLENBQUMsQ0FBQ0EsRUFBQyxDQUFDO0FBQUEsSUFDckQ7QUFFQSxXQUFPLEtBQUssZ0JBQWdCLElBQUksUUFBUSxHQUFHLHdCQUF3QixZQUFZLE9BQU8sS0FBSyxRQUFRLFFBQVEsS0FBSztBQUFBLEVBQ2pIO0FBQUE7QUFBQSxFQUdPLFFBQVEsWUFBb0I7QUFDbEMsUUFBSSxLQUFLLFlBQVksSUFBSSxVQUFVLEdBQUc7QUFDckM7QUFBQSxJQUNEO0FBRUEsVUFBTSxRQUF5QixDQUFDO0FBQ2hDLFNBQUssWUFBWSxJQUFJLFlBQVksS0FBSztBQUV0QyxTQUFLLGlCQUFpQixnQkFBZ0IsY0FBYyxVQUFVLEVBQUUsRUFBRSxLQUFLLE1BQU07QUFDNUUsaUJBQVcsV0FBVyxPQUFPO0FBQzVCLGFBQUssbUJBQW1CLEtBQUssT0FBTztBQUFBLE1BQ3JDO0FBRUEsV0FBSyxZQUFZLElBQUksWUFBWSxNQUFTO0FBQUEsSUFDM0MsQ0FBQztBQUFBLEVBQ0Y7QUFBQTtBQUFBLEVBR08sVUFBVSxVQUE0QztBQUM1RCxVQUFNLFdBQVcsS0FBSyxnQkFBZ0IsSUFBSSxRQUFRO0FBQ2xELFFBQUksVUFBVTtBQUNiLGFBQU87QUFBQSxJQUNSO0FBRUEsVUFBTSxZQUFzQztBQUFBLE1BQzNDLGFBQWEsQ0FBQyxZQUFZLFlBQVksS0FBSyxZQUFZLFVBQVUsWUFBWSxPQUFPO0FBQUEsTUFDcEYsU0FBUyxNQUFNLEtBQUssZ0JBQWdCLE9BQU8sUUFBUTtBQUFBLElBQ3BEO0FBRUEsU0FBSyxnQkFBZ0IsSUFBSSxVQUFVLFNBQVM7QUFDNUMsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUVRLFlBQVksVUFBa0IsWUFBb0IsU0FBd0I7QUFDakYsUUFBSSxDQUFDLEtBQUssWUFBWSxJQUFJLFVBQVUsR0FBRztBQUN0QyxXQUFLLFFBQVEsVUFBVTtBQUFBLElBQ3hCO0FBRUEsVUFBTSxhQUFhLEtBQUssWUFBWSxJQUFJLFVBQVU7QUFDbEQsVUFBTSxTQUFTLEVBQUUsWUFBWSxVQUFVLFFBQVE7QUFDL0MsUUFBSSxlQUFlLFFBQVc7QUFDN0IsV0FBSyxtQkFBbUIsS0FBSyxNQUFNO0FBQUEsSUFDcEMsT0FBTztBQUNOLGlCQUFXLEtBQUssTUFBTTtBQUFBLElBQ3ZCO0FBQUEsRUFDRDtBQUNEO0FBMUVhLG1DQUFOO0FBQUEsRUFZSjtBQUFBLEdBWlU7IiwKICAibmFtZXMiOiBbInMiXQp9Cg==
