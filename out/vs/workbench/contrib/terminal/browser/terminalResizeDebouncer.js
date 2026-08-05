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
import { getWindow, runWhenWindowIdle } from "../../../../base/browser/dom.js";
import { debounce } from "../../../../base/common/decorators.js";
import { Disposable, MutableDisposable } from "../../../../base/common/lifecycle.js";
var Constants = /* @__PURE__ */ ((Constants2) => {
  Constants2[Constants2["StartDebouncingThreshold"] = 200] = "StartDebouncingThreshold";
  return Constants2;
})(Constants || {});
class TerminalResizeDebouncer extends Disposable {
  constructor(_isVisible, _getXterm, _resizeBothCallback, _resizeXCallback, _resizeYCallback) {
    super();
    this._isVisible = _isVisible;
    this._getXterm = _getXterm;
    this._resizeBothCallback = _resizeBothCallback;
    this._resizeXCallback = _resizeXCallback;
    this._resizeYCallback = _resizeYCallback;
    this._latestX = 0;
    this._latestY = 0;
    this._resizeXJob = this._register(new MutableDisposable());
    this._resizeYJob = this._register(new MutableDisposable());
  }
  async resize(cols, rows, immediate) {
    this._latestX = cols;
    this._latestY = rows;
    if (immediate || this._getXterm().raw.buffer.normal.length < 200 /* StartDebouncingThreshold */) {
      this._resizeXJob.clear();
      this._resizeYJob.clear();
      this._resizeBothCallback(cols, rows);
      return;
    }
    const win = getWindow(this._getXterm().raw.element);
    if (win && !this._isVisible()) {
      if (!this._resizeXJob.value) {
        this._resizeXJob.value = runWhenWindowIdle(win, async () => {
          this._resizeXCallback(this._latestX);
          this._resizeXJob.clear();
        });
      }
      if (!this._resizeYJob.value) {
        this._resizeYJob.value = runWhenWindowIdle(win, async () => {
          this._resizeYCallback(this._latestY);
          this._resizeYJob.clear();
        });
      }
      return;
    }
    this._resizeYCallback(rows);
    this._latestX = cols;
    this._debounceResizeX(cols);
  }
  flush() {
    if (this._resizeXJob.value || this._resizeYJob.value) {
      this._resizeXJob.clear();
      this._resizeYJob.clear();
      this._resizeBothCallback(this._latestX, this._latestY);
    }
  }
  _debounceResizeX(cols) {
    this._resizeXCallback(cols);
  }
}
__decorateClass([
  debounce(100)
], TerminalResizeDebouncer.prototype, "_debounceResizeX", 1);
export {
  TerminalResizeDebouncer
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi90ZXJtaW5hbC9icm93c2VyL3Rlcm1pbmFsUmVzaXplRGVib3VuY2VyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZ2V0V2luZG93LCBydW5XaGVuV2luZG93SWRsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvYnJvd3Nlci9kb20uanMnO1xuaW1wb3J0IHsgZGVib3VuY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9kZWNvcmF0b3JzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIE11dGFibGVEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB0eXBlIHsgWHRlcm1UZXJtaW5hbCB9IGZyb20gJy4veHRlcm0veHRlcm1UZXJtaW5hbC5qcyc7XG5cbmNvbnN0IGVudW0gQ29uc3RhbnRzIHtcblx0LyoqXG5cdCAqIFRoZSBfbm9ybWFsXyBidWZmZXIgbGVuZ3RoIHRocmVzaG9sZCBhdCB3aGljaCBwb2ludCByZXNpemluZyBzdGFydHMgYmVpbmcgZGVib3VuY2VkLlxuXHQgKi9cblx0U3RhcnREZWJvdW5jaW5nVGhyZXNob2xkID0gMjAwLFxufVxuXG5leHBvcnQgY2xhc3MgVGVybWluYWxSZXNpemVEZWJvdW5jZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblx0cHJpdmF0ZSBfbGF0ZXN0WDogbnVtYmVyID0gMDtcblx0cHJpdmF0ZSBfbGF0ZXN0WTogbnVtYmVyID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNpemVYSm9iID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9yZXNpemVZSm9iID0gdGhpcy5fcmVnaXN0ZXIobmV3IE11dGFibGVEaXNwb3NhYmxlKCkpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2lzVmlzaWJsZTogKCkgPT4gYm9vbGVhbixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9nZXRYdGVybTogKCkgPT4gWHRlcm1UZXJtaW5hbCB8IHVuZGVmaW5lZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZXNpemVCb3RoQ2FsbGJhY2s6IChjb2xzOiBudW1iZXIsIHJvd3M6IG51bWJlcikgPT4gdm9pZCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZXNpemVYQ2FsbGJhY2s6IChjb2xzOiBudW1iZXIpID0+IHZvaWQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcmVzaXplWUNhbGxiYWNrOiAocm93czogbnVtYmVyKSA9PiB2b2lkLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHR9XG5cblx0YXN5bmMgcmVzaXplKGNvbHM6IG51bWJlciwgcm93czogbnVtYmVyLCBpbW1lZGlhdGU6IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLl9sYXRlc3RYID0gY29scztcblx0XHR0aGlzLl9sYXRlc3RZID0gcm93cztcblxuXHRcdC8vIFJlc2l6ZSBpbW1lZGlhdGVseSBpZiByZXF1ZXN0ZWQgZXhwbGljaXRseSBvciBpZiB0aGUgYnVmZmVyIGlzIHNtYWxsXG5cdFx0aWYgKGltbWVkaWF0ZSB8fCB0aGlzLl9nZXRYdGVybSgpIS5yYXcuYnVmZmVyLm5vcm1hbC5sZW5ndGggPCBDb25zdGFudHMuU3RhcnREZWJvdW5jaW5nVGhyZXNob2xkKSB7XG5cdFx0XHR0aGlzLl9yZXNpemVYSm9iLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9yZXNpemVZSm9iLmNsZWFyKCk7XG5cdFx0XHR0aGlzLl9yZXNpemVCb3RoQ2FsbGJhY2soY29scywgcm93cyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gUmVzaXplIGluIGFuIGlkbGUgY2FsbGJhY2sgaWYgdGhlIHRlcm1pbmFsIGlzIG5vdCB2aXNpYmxlXG5cdFx0Y29uc3Qgd2luID0gZ2V0V2luZG93KHRoaXMuX2dldFh0ZXJtKCkhLnJhdy5lbGVtZW50KTtcblx0XHRpZiAod2luICYmICF0aGlzLl9pc1Zpc2libGUoKSkge1xuXHRcdFx0aWYgKCF0aGlzLl9yZXNpemVYSm9iLnZhbHVlKSB7XG5cdFx0XHRcdHRoaXMuX3Jlc2l6ZVhKb2IudmFsdWUgPSBydW5XaGVuV2luZG93SWRsZSh3aW4sIGFzeW5jICgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl9yZXNpemVYQ2FsbGJhY2sodGhpcy5fbGF0ZXN0WCk7XG5cdFx0XHRcdFx0dGhpcy5fcmVzaXplWEpvYi5jbGVhcigpO1xuXHRcdFx0XHR9KTtcblx0XHRcdH1cblx0XHRcdGlmICghdGhpcy5fcmVzaXplWUpvYi52YWx1ZSkge1xuXHRcdFx0XHR0aGlzLl9yZXNpemVZSm9iLnZhbHVlID0gcnVuV2hlbldpbmRvd0lkbGUod2luLCBhc3luYyAoKSA9PiB7XG5cdFx0XHRcdFx0dGhpcy5fcmVzaXplWUNhbGxiYWNrKHRoaXMuX2xhdGVzdFkpO1xuXHRcdFx0XHRcdHRoaXMuX3Jlc2l6ZVlKb2IuY2xlYXIoKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gVXBkYXRlIGRpbWVuc2lvbnMgaW5kZXBlbmRlbnRseSBhcyB2ZXJ0aWNhbCByZXNpemUgaXMgY2hlYXAgYW5kIGhvcml6b250YWwgcmVzaXplIGlzXG5cdFx0Ly8gZXhwZW5zaXZlIGR1ZSB0byByZWZsb3cuXG5cdFx0dGhpcy5fcmVzaXplWUNhbGxiYWNrKHJvd3MpO1xuXHRcdHRoaXMuX2xhdGVzdFggPSBjb2xzO1xuXHRcdHRoaXMuX2RlYm91bmNlUmVzaXplWChjb2xzKTtcblx0fVxuXG5cdGZsdXNoKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9yZXNpemVYSm9iLnZhbHVlIHx8IHRoaXMuX3Jlc2l6ZVlKb2IudmFsdWUpIHtcblx0XHRcdHRoaXMuX3Jlc2l6ZVhKb2IuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3Jlc2l6ZVlKb2IuY2xlYXIoKTtcblx0XHRcdHRoaXMuX3Jlc2l6ZUJvdGhDYWxsYmFjayh0aGlzLl9sYXRlc3RYLCB0aGlzLl9sYXRlc3RZKTtcblx0XHR9XG5cdH1cblxuXHRAZGVib3VuY2UoMTAwKVxuXHRwcml2YXRlIF9kZWJvdW5jZVJlc2l6ZVgoY29sczogbnVtYmVyKSB7XG5cdFx0dGhpcy5fcmVzaXplWENhbGxiYWNrKGNvbHMpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7O0FBS0EsU0FBUyxXQUFXLHlCQUF5QjtBQUM3QyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLFlBQVkseUJBQXlCO0FBRzlDLElBQVcsWUFBWCxrQkFBV0EsZUFBWDtBQUlDLEVBQUFBLHNCQUFBLDhCQUEyQixPQUEzQjtBQUpVLFNBQUFBO0FBQUEsR0FBQTtBQU9KLE1BQU0sZ0NBQWdDLFdBQVc7QUFBQSxFQU92RCxZQUNrQixZQUNBLFdBQ0EscUJBQ0Esa0JBQ0Esa0JBQ2hCO0FBQ0QsVUFBTTtBQU5XO0FBQ0E7QUFDQTtBQUNBO0FBQ0E7QUFYbEIsU0FBUSxXQUFtQjtBQUMzQixTQUFRLFdBQW1CO0FBRTNCLFNBQWlCLGNBQWMsS0FBSyxVQUFVLElBQUksa0JBQWtCLENBQUM7QUFDckUsU0FBaUIsY0FBYyxLQUFLLFVBQVUsSUFBSSxrQkFBa0IsQ0FBQztBQUFBLEVBVXJFO0FBQUEsRUFFQSxNQUFNLE9BQU8sTUFBYyxNQUFjLFdBQW1DO0FBQzNFLFNBQUssV0FBVztBQUNoQixTQUFLLFdBQVc7QUFHaEIsUUFBSSxhQUFhLEtBQUssVUFBVSxFQUFHLElBQUksT0FBTyxPQUFPLFNBQVMsb0NBQW9DO0FBQ2pHLFdBQUssWUFBWSxNQUFNO0FBQ3ZCLFdBQUssWUFBWSxNQUFNO0FBQ3ZCLFdBQUssb0JBQW9CLE1BQU0sSUFBSTtBQUNuQztBQUFBLElBQ0Q7QUFHQSxVQUFNLE1BQU0sVUFBVSxLQUFLLFVBQVUsRUFBRyxJQUFJLE9BQU87QUFDbkQsUUFBSSxPQUFPLENBQUMsS0FBSyxXQUFXLEdBQUc7QUFDOUIsVUFBSSxDQUFDLEtBQUssWUFBWSxPQUFPO0FBQzVCLGFBQUssWUFBWSxRQUFRLGtCQUFrQixLQUFLLFlBQVk7QUFDM0QsZUFBSyxpQkFBaUIsS0FBSyxRQUFRO0FBQ25DLGVBQUssWUFBWSxNQUFNO0FBQUEsUUFDeEIsQ0FBQztBQUFBLE1BQ0Y7QUFDQSxVQUFJLENBQUMsS0FBSyxZQUFZLE9BQU87QUFDNUIsYUFBSyxZQUFZLFFBQVEsa0JBQWtCLEtBQUssWUFBWTtBQUMzRCxlQUFLLGlCQUFpQixLQUFLLFFBQVE7QUFDbkMsZUFBSyxZQUFZLE1BQU07QUFBQSxRQUN4QixDQUFDO0FBQUEsTUFDRjtBQUNBO0FBQUEsSUFDRDtBQUlBLFNBQUssaUJBQWlCLElBQUk7QUFDMUIsU0FBSyxXQUFXO0FBQ2hCLFNBQUssaUJBQWlCLElBQUk7QUFBQSxFQUMzQjtBQUFBLEVBRUEsUUFBYztBQUNiLFFBQUksS0FBSyxZQUFZLFNBQVMsS0FBSyxZQUFZLE9BQU87QUFDckQsV0FBSyxZQUFZLE1BQU07QUFDdkIsV0FBSyxZQUFZLE1BQU07QUFDdkIsV0FBSyxvQkFBb0IsS0FBSyxVQUFVLEtBQUssUUFBUTtBQUFBLElBQ3REO0FBQUEsRUFDRDtBQUFBLEVBR1EsaUJBQWlCLE1BQWM7QUFDdEMsU0FBSyxpQkFBaUIsSUFBSTtBQUFBLEVBQzNCO0FBQ0Q7QUFIUztBQUFBLEVBRFAsU0FBUyxHQUFHO0FBQUEsR0E5REQsd0JBK0RKOyIsCiAgIm5hbWVzIjogWyJDb25zdGFudHMiXQp9Cg==
