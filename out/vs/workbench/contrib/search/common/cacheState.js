import { defaultGenerator } from "../../../../base/common/idGenerator.js";
import { equals } from "../../../../base/common/objects.js";
var LoadingPhase = /* @__PURE__ */ ((LoadingPhase2) => {
  LoadingPhase2[LoadingPhase2["Created"] = 1] = "Created";
  LoadingPhase2[LoadingPhase2["Loading"] = 2] = "Loading";
  LoadingPhase2[LoadingPhase2["Loaded"] = 3] = "Loaded";
  LoadingPhase2[LoadingPhase2["Errored"] = 4] = "Errored";
  LoadingPhase2[LoadingPhase2["Disposed"] = 5] = "Disposed";
  return LoadingPhase2;
})(LoadingPhase || {});
class FileQueryCacheState {
  constructor(cacheQuery, loadFn, disposeFn, previousCacheState) {
    this.cacheQuery = cacheQuery;
    this.loadFn = loadFn;
    this.disposeFn = disposeFn;
    this.previousCacheState = previousCacheState;
    this._cacheKey = defaultGenerator.nextId();
    this.query = this.cacheQuery(this._cacheKey);
    this.loadingPhase = 1 /* Created */;
    if (this.previousCacheState) {
      const current = Object.assign({}, this.query, { cacheKey: null });
      const previous = Object.assign({}, this.previousCacheState.query, { cacheKey: null });
      if (!equals(current, previous)) {
        this.previousCacheState.dispose();
        this.previousCacheState = void 0;
      }
    }
  }
  get cacheKey() {
    if (this.loadingPhase === 3 /* Loaded */ || !this.previousCacheState) {
      return this._cacheKey;
    }
    return this.previousCacheState.cacheKey;
  }
  get isLoaded() {
    const isLoaded = this.loadingPhase === 3 /* Loaded */;
    return isLoaded || !this.previousCacheState ? isLoaded : this.previousCacheState.isLoaded;
  }
  get isUpdating() {
    const isUpdating = this.loadingPhase === 2 /* Loading */;
    return isUpdating || !this.previousCacheState ? isUpdating : this.previousCacheState.isUpdating;
  }
  load() {
    if (this.isUpdating) {
      return this;
    }
    this.loadingPhase = 2 /* Loading */;
    this.loadPromise = (async () => {
      try {
        await this.loadFn(this.query);
        this.loadingPhase = 3 /* Loaded */;
        if (this.previousCacheState) {
          this.previousCacheState.dispose();
          this.previousCacheState = void 0;
        }
      } catch (error) {
        this.loadingPhase = 4 /* Errored */;
        throw error;
      }
    })();
    return this;
  }
  dispose() {
    if (this.loadPromise) {
      (async () => {
        try {
          await this.loadPromise;
        } catch (error) {
        }
        this.loadingPhase = 5 /* Disposed */;
        this.disposeFn(this._cacheKey);
      })();
    } else {
      this.loadingPhase = 5 /* Disposed */;
    }
    if (this.previousCacheState) {
      this.previousCacheState.dispose();
      this.previousCacheState = void 0;
    }
  }
}
export {
  FileQueryCacheState
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zZWFyY2gvY29tbW9uL2NhY2hlU3RhdGUudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBkZWZhdWx0R2VuZXJhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaWRHZW5lcmF0b3IuanMnO1xuaW1wb3J0IHsgSUZpbGVRdWVyeSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3NlYXJjaC9jb21tb24vc2VhcmNoLmpzJztcbmltcG9ydCB7IGVxdWFscyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29iamVjdHMuanMnO1xuXG5lbnVtIExvYWRpbmdQaGFzZSB7XG5cdENyZWF0ZWQgPSAxLFxuXHRMb2FkaW5nID0gMixcblx0TG9hZGVkID0gMyxcblx0RXJyb3JlZCA9IDQsXG5cdERpc3Bvc2VkID0gNVxufVxuXG5leHBvcnQgY2xhc3MgRmlsZVF1ZXJ5Q2FjaGVTdGF0ZSB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfY2FjaGVLZXkgPSBkZWZhdWx0R2VuZXJhdG9yLm5leHRJZCgpO1xuXHRnZXQgY2FjaGVLZXkoKTogc3RyaW5nIHtcblx0XHRpZiAodGhpcy5sb2FkaW5nUGhhc2UgPT09IExvYWRpbmdQaGFzZS5Mb2FkZWQgfHwgIXRoaXMucHJldmlvdXNDYWNoZVN0YXRlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fY2FjaGVLZXk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMucHJldmlvdXNDYWNoZVN0YXRlLmNhY2hlS2V5O1xuXHR9XG5cblx0Z2V0IGlzTG9hZGVkKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGlzTG9hZGVkID0gdGhpcy5sb2FkaW5nUGhhc2UgPT09IExvYWRpbmdQaGFzZS5Mb2FkZWQ7XG5cblx0XHRyZXR1cm4gaXNMb2FkZWQgfHwgIXRoaXMucHJldmlvdXNDYWNoZVN0YXRlID8gaXNMb2FkZWQgOiB0aGlzLnByZXZpb3VzQ2FjaGVTdGF0ZS5pc0xvYWRlZDtcblx0fVxuXG5cdGdldCBpc1VwZGF0aW5nKCk6IGJvb2xlYW4ge1xuXHRcdGNvbnN0IGlzVXBkYXRpbmcgPSB0aGlzLmxvYWRpbmdQaGFzZSA9PT0gTG9hZGluZ1BoYXNlLkxvYWRpbmc7XG5cblx0XHRyZXR1cm4gaXNVcGRhdGluZyB8fCAhdGhpcy5wcmV2aW91c0NhY2hlU3RhdGUgPyBpc1VwZGF0aW5nIDogdGhpcy5wcmV2aW91c0NhY2hlU3RhdGUuaXNVcGRhdGluZztcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcXVlcnkgPSB0aGlzLmNhY2hlUXVlcnkodGhpcy5fY2FjaGVLZXkpO1xuXG5cdHByaXZhdGUgbG9hZGluZ1BoYXNlID0gTG9hZGluZ1BoYXNlLkNyZWF0ZWQ7XG5cdHByaXZhdGUgbG9hZFByb21pc2U6IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSBjYWNoZVF1ZXJ5OiAoY2FjaGVLZXk6IHN0cmluZykgPT4gSUZpbGVRdWVyeSxcblx0XHRwcml2YXRlIGxvYWRGbjogKHF1ZXJ5OiBJRmlsZVF1ZXJ5KSA9PiBQcm9taXNlPGFueT4sXG5cdFx0cHJpdmF0ZSBkaXNwb3NlRm46IChjYWNoZUtleTogc3RyaW5nKSA9PiBQcm9taXNlPHZvaWQ+LFxuXHRcdHByaXZhdGUgcHJldmlvdXNDYWNoZVN0YXRlOiBGaWxlUXVlcnlDYWNoZVN0YXRlIHwgdW5kZWZpbmVkXG5cdCkge1xuXHRcdGlmICh0aGlzLnByZXZpb3VzQ2FjaGVTdGF0ZSkge1xuXHRcdFx0Y29uc3QgY3VycmVudCA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucXVlcnksIHsgY2FjaGVLZXk6IG51bGwgfSk7XG5cdFx0XHRjb25zdCBwcmV2aW91cyA9IE9iamVjdC5hc3NpZ24oe30sIHRoaXMucHJldmlvdXNDYWNoZVN0YXRlLnF1ZXJ5LCB7IGNhY2hlS2V5OiBudWxsIH0pO1xuXHRcdFx0aWYgKCFlcXVhbHMoY3VycmVudCwgcHJldmlvdXMpKSB7XG5cdFx0XHRcdHRoaXMucHJldmlvdXNDYWNoZVN0YXRlLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhpcy5wcmV2aW91c0NhY2hlU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0bG9hZCgpOiBGaWxlUXVlcnlDYWNoZVN0YXRlIHtcblx0XHRpZiAodGhpcy5pc1VwZGF0aW5nKSB7XG5cdFx0XHRyZXR1cm4gdGhpcztcblx0XHR9XG5cblx0XHR0aGlzLmxvYWRpbmdQaGFzZSA9IExvYWRpbmdQaGFzZS5Mb2FkaW5nO1xuXG5cdFx0dGhpcy5sb2FkUHJvbWlzZSA9IChhc3luYyAoKSA9PiB7XG5cdFx0XHR0cnkge1xuXHRcdFx0XHRhd2FpdCB0aGlzLmxvYWRGbih0aGlzLnF1ZXJ5KTtcblxuXHRcdFx0XHR0aGlzLmxvYWRpbmdQaGFzZSA9IExvYWRpbmdQaGFzZS5Mb2FkZWQ7XG5cblx0XHRcdFx0aWYgKHRoaXMucHJldmlvdXNDYWNoZVN0YXRlKSB7XG5cdFx0XHRcdFx0dGhpcy5wcmV2aW91c0NhY2hlU3RhdGUuZGlzcG9zZSgpO1xuXHRcdFx0XHRcdHRoaXMucHJldmlvdXNDYWNoZVN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHR0aGlzLmxvYWRpbmdQaGFzZSA9IExvYWRpbmdQaGFzZS5FcnJvcmVkO1xuXG5cdFx0XHRcdHRocm93IGVycm9yO1xuXHRcdFx0fVxuXHRcdH0pKCk7XG5cblx0XHRyZXR1cm4gdGhpcztcblx0fVxuXG5cdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0aWYgKHRoaXMubG9hZFByb21pc2UpIHtcblx0XHRcdChhc3luYyAoKSA9PiB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5sb2FkUHJvbWlzZTtcblx0XHRcdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0XHQvLyBpZ25vcmVcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHRoaXMubG9hZGluZ1BoYXNlID0gTG9hZGluZ1BoYXNlLkRpc3Bvc2VkO1xuXHRcdFx0XHR0aGlzLmRpc3Bvc2VGbih0aGlzLl9jYWNoZUtleSk7XG5cdFx0XHR9KSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmxvYWRpbmdQaGFzZSA9IExvYWRpbmdQaGFzZS5EaXNwb3NlZDtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5wcmV2aW91c0NhY2hlU3RhdGUpIHtcblx0XHRcdHRoaXMucHJldmlvdXNDYWNoZVN0YXRlLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMucHJldmlvdXNDYWNoZVN0YXRlID0gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIkFBS0EsU0FBUyx3QkFBd0I7QUFFakMsU0FBUyxjQUFjO0FBRXZCLElBQUssZUFBTCxrQkFBS0Esa0JBQUw7QUFDQyxFQUFBQSw0QkFBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSw0QkFBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSw0QkFBQSxZQUFTLEtBQVQ7QUFDQSxFQUFBQSw0QkFBQSxhQUFVLEtBQVY7QUFDQSxFQUFBQSw0QkFBQSxjQUFXLEtBQVg7QUFMSSxTQUFBQTtBQUFBLEdBQUE7QUFRRSxNQUFNLG9CQUFvQjtBQUFBLEVBNEJoQyxZQUNTLFlBQ0EsUUFDQSxXQUNBLG9CQUNQO0FBSk87QUFDQTtBQUNBO0FBQ0E7QUE5QlQsU0FBaUIsWUFBWSxpQkFBaUIsT0FBTztBQXFCckQsU0FBaUIsUUFBUSxLQUFLLFdBQVcsS0FBSyxTQUFTO0FBRXZELFNBQVEsZUFBZTtBQVN0QixRQUFJLEtBQUssb0JBQW9CO0FBQzVCLFlBQU0sVUFBVSxPQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUssT0FBTyxFQUFFLFVBQVUsS0FBSyxDQUFDO0FBQ2hFLFlBQU0sV0FBVyxPQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUssbUJBQW1CLE9BQU8sRUFBRSxVQUFVLEtBQUssQ0FBQztBQUNwRixVQUFJLENBQUMsT0FBTyxTQUFTLFFBQVEsR0FBRztBQUMvQixhQUFLLG1CQUFtQixRQUFRO0FBQ2hDLGFBQUsscUJBQXFCO0FBQUEsTUFDM0I7QUFBQSxJQUNEO0FBQUEsRUFDRDtBQUFBLEVBdkNBLElBQUksV0FBbUI7QUFDdEIsUUFBSSxLQUFLLGlCQUFpQixrQkFBdUIsQ0FBQyxLQUFLLG9CQUFvQjtBQUMxRSxhQUFPLEtBQUs7QUFBQSxJQUNiO0FBRUEsV0FBTyxLQUFLLG1CQUFtQjtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxJQUFJLFdBQW9CO0FBQ3ZCLFVBQU0sV0FBVyxLQUFLLGlCQUFpQjtBQUV2QyxXQUFPLFlBQVksQ0FBQyxLQUFLLHFCQUFxQixXQUFXLEtBQUssbUJBQW1CO0FBQUEsRUFDbEY7QUFBQSxFQUVBLElBQUksYUFBc0I7QUFDekIsVUFBTSxhQUFhLEtBQUssaUJBQWlCO0FBRXpDLFdBQU8sY0FBYyxDQUFDLEtBQUsscUJBQXFCLGFBQWEsS0FBSyxtQkFBbUI7QUFBQSxFQUN0RjtBQUFBLEVBdUJBLE9BQTRCO0FBQzNCLFFBQUksS0FBSyxZQUFZO0FBQ3BCLGFBQU87QUFBQSxJQUNSO0FBRUEsU0FBSyxlQUFlO0FBRXBCLFNBQUssZUFBZSxZQUFZO0FBQy9CLFVBQUk7QUFDSCxjQUFNLEtBQUssT0FBTyxLQUFLLEtBQUs7QUFFNUIsYUFBSyxlQUFlO0FBRXBCLFlBQUksS0FBSyxvQkFBb0I7QUFDNUIsZUFBSyxtQkFBbUIsUUFBUTtBQUNoQyxlQUFLLHFCQUFxQjtBQUFBLFFBQzNCO0FBQUEsTUFDRCxTQUFTLE9BQU87QUFDZixhQUFLLGVBQWU7QUFFcEIsY0FBTTtBQUFBLE1BQ1A7QUFBQSxJQUNELEdBQUc7QUFFSCxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBRUEsVUFBZ0I7QUFDZixRQUFJLEtBQUssYUFBYTtBQUNyQixPQUFDLFlBQVk7QUFDWixZQUFJO0FBQ0gsZ0JBQU0sS0FBSztBQUFBLFFBQ1osU0FBUyxPQUFPO0FBQUEsUUFFaEI7QUFFQSxhQUFLLGVBQWU7QUFDcEIsYUFBSyxVQUFVLEtBQUssU0FBUztBQUFBLE1BQzlCLEdBQUc7QUFBQSxJQUNKLE9BQU87QUFDTixXQUFLLGVBQWU7QUFBQSxJQUNyQjtBQUVBLFFBQUksS0FBSyxvQkFBb0I7QUFDNUIsV0FBSyxtQkFBbUIsUUFBUTtBQUNoQyxXQUFLLHFCQUFxQjtBQUFBLElBQzNCO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogWyJMb2FkaW5nUGhhc2UiXQp9Cg==
