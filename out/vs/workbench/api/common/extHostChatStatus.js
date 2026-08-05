import * as extHostProtocol from "./extHost.protocol.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
class ExtHostChatStatus {
  constructor(mainContext) {
    this._items = /* @__PURE__ */ new Map();
    this._proxy = mainContext.getProxy(extHostProtocol.MainContext.MainThreadChatStatus);
  }
  createChatStatusItem(extension, id) {
    const internalId = asChatItemIdentifier(extension.identifier, id);
    if (this._items.has(internalId)) {
      throw new Error(`Chat status item '${id}' already exists`);
    }
    const state = {
      id: internalId,
      title: "",
      description: "",
      detail: ""
    };
    let disposed = false;
    let visible = false;
    const syncState = () => {
      if (disposed) {
        throw new Error("Chat status item is disposed");
      }
      if (!visible) {
        return;
      }
      this._proxy.$setEntry(id, state);
    };
    const item = Object.freeze({
      id,
      get title() {
        return state.title;
      },
      set title(value) {
        state.title = value;
        syncState();
      },
      get description() {
        return state.description;
      },
      set description(value) {
        state.description = value;
        syncState();
      },
      get detail() {
        return state.detail;
      },
      set detail(value) {
        state.detail = value;
        syncState();
      },
      show: () => {
        visible = true;
        syncState();
      },
      hide: () => {
        visible = false;
        this._proxy.$disposeEntry(id);
      },
      dispose: () => {
        disposed = true;
        this._proxy.$disposeEntry(id);
        this._items.delete(internalId);
      }
    });
    this._items.set(internalId, item);
    return item;
  }
}
function asChatItemIdentifier(extension, id) {
  return `${ExtensionIdentifier.toKey(extension)}.${id}`;
}
export {
  ExtHostChatStatus
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q2hhdFN0YXR1cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB0eXBlICogYXMgdnNjb2RlIGZyb20gJ3ZzY29kZSc7XG5pbXBvcnQgKiBhcyBleHRIb3N0UHJvdG9jb2wgZnJvbSAnLi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIsIElFeHRlbnNpb25EZXNjcmlwdGlvbiB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuXG5leHBvcnQgY2xhc3MgRXh0SG9zdENoYXRTdGF0dXMge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBleHRIb3N0UHJvdG9jb2wuTWFpblRocmVhZENoYXRTdGF0dXNTaGFwZTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pdGVtcyA9IG5ldyBNYXA8c3RyaW5nLCB2c2NvZGUuQ2hhdFN0YXR1c0l0ZW0+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0bWFpbkNvbnRleHQ6IGV4dEhvc3RQcm90b2NvbC5JTWFpbkNvbnRleHRcblx0KSB7XG5cdFx0dGhpcy5fcHJveHkgPSBtYWluQ29udGV4dC5nZXRQcm94eShleHRIb3N0UHJvdG9jb2wuTWFpbkNvbnRleHQuTWFpblRocmVhZENoYXRTdGF0dXMpO1xuXHR9XG5cblx0Y3JlYXRlQ2hhdFN0YXR1c0l0ZW0oZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIGlkOiBzdHJpbmcpOiB2c2NvZGUuQ2hhdFN0YXR1c0l0ZW0ge1xuXHRcdGNvbnN0IGludGVybmFsSWQgPSBhc0NoYXRJdGVtSWRlbnRpZmllcihleHRlbnNpb24uaWRlbnRpZmllciwgaWQpO1xuXHRcdGlmICh0aGlzLl9pdGVtcy5oYXMoaW50ZXJuYWxJZCkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2hhdCBzdGF0dXMgaXRlbSAnJHtpZH0nIGFscmVhZHkgZXhpc3RzYCk7XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc3RhdGU6IGV4dEhvc3RQcm90b2NvbC5DaGF0U3RhdHVzSXRlbUR0byA9IHtcblx0XHRcdGlkOiBpbnRlcm5hbElkLFxuXHRcdFx0dGl0bGU6ICcnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICcnLFxuXHRcdFx0ZGV0YWlsOiAnJyxcblx0XHR9O1xuXG5cdFx0bGV0IGRpc3Bvc2VkID0gZmFsc2U7XG5cdFx0bGV0IHZpc2libGUgPSBmYWxzZTtcblx0XHRjb25zdCBzeW5jU3RhdGUgPSAoKSA9PiB7XG5cdFx0XHRpZiAoZGlzcG9zZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKCdDaGF0IHN0YXR1cyBpdGVtIGlzIGRpc3Bvc2VkJyk7XG5cdFx0XHR9XG5cblx0XHRcdGlmICghdmlzaWJsZSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuX3Byb3h5LiRzZXRFbnRyeShpZCwgc3RhdGUpO1xuXHRcdH07XG5cblx0XHRjb25zdCBpdGVtID0gT2JqZWN0LmZyZWV6ZTx2c2NvZGUuQ2hhdFN0YXR1c0l0ZW0+KHtcblx0XHRcdGlkOiBpZCxcblxuXHRcdFx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7XG5cdFx0XHRcdHJldHVybiBzdGF0ZS50aXRsZTtcblx0XHRcdH0sXG5cdFx0XHRzZXQgdGl0bGUodmFsdWU6IHN0cmluZykge1xuXHRcdFx0XHRzdGF0ZS50aXRsZSA9IHZhbHVlO1xuXHRcdFx0XHRzeW5jU3RhdGUoKTtcblx0XHRcdH0sXG5cblx0XHRcdGdldCBkZXNjcmlwdGlvbigpOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gc3RhdGUuZGVzY3JpcHRpb247XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGRlc2NyaXB0aW9uKHZhbHVlOiBzdHJpbmcpIHtcblx0XHRcdFx0c3RhdGUuZGVzY3JpcHRpb24gPSB2YWx1ZTtcblx0XHRcdFx0c3luY1N0YXRlKCk7XG5cdFx0XHR9LFxuXG5cdFx0XHRnZXQgZGV0YWlsKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0XHRcdHJldHVybiBzdGF0ZS5kZXRhaWw7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGRldGFpbCh2YWx1ZTogc3RyaW5nIHwgdW5kZWZpbmVkKSB7XG5cdFx0XHRcdHN0YXRlLmRldGFpbCA9IHZhbHVlO1xuXHRcdFx0XHRzeW5jU3RhdGUoKTtcblx0XHRcdH0sXG5cblx0XHRcdHNob3c6ICgpID0+IHtcblx0XHRcdFx0dmlzaWJsZSA9IHRydWU7XG5cdFx0XHRcdHN5bmNTdGF0ZSgpO1xuXHRcdFx0fSxcblx0XHRcdGhpZGU6ICgpID0+IHtcblx0XHRcdFx0dmlzaWJsZSA9IGZhbHNlO1xuXHRcdFx0XHR0aGlzLl9wcm94eS4kZGlzcG9zZUVudHJ5KGlkKTtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7XG5cdFx0XHRcdGRpc3Bvc2VkID0gdHJ1ZTtcblx0XHRcdFx0dGhpcy5fcHJveHkuJGRpc3Bvc2VFbnRyeShpZCk7XG5cdFx0XHRcdHRoaXMuX2l0ZW1zLmRlbGV0ZShpbnRlcm5hbElkKTtcblx0XHRcdH0sXG5cdFx0fSk7XG5cblx0XHR0aGlzLl9pdGVtcy5zZXQoaW50ZXJuYWxJZCwgaXRlbSk7XG5cdFx0cmV0dXJuIGl0ZW07XG5cdH1cbn1cblxuZnVuY3Rpb24gYXNDaGF0SXRlbUlkZW50aWZpZXIoZXh0ZW5zaW9uOiBFeHRlbnNpb25JZGVudGlmaWVyLCBpZDogc3RyaW5nKTogc3RyaW5nIHtcblx0cmV0dXJuIGAke0V4dGVuc2lvbklkZW50aWZpZXIudG9LZXkoZXh0ZW5zaW9uKX0uJHtpZH1gO1xufVxuXG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxZQUFZLHFCQUFxQjtBQUNqQyxTQUFTLDJCQUFrRDtBQUVwRCxNQUFNLGtCQUFrQjtBQUFBLEVBTTlCLFlBQ0MsYUFDQztBQUpGLFNBQWlCLFNBQVMsb0JBQUksSUFBbUM7QUFLaEUsU0FBSyxTQUFTLFlBQVksU0FBUyxnQkFBZ0IsWUFBWSxvQkFBb0I7QUFBQSxFQUNwRjtBQUFBLEVBRUEscUJBQXFCLFdBQWtDLElBQW1DO0FBQ3pGLFVBQU0sYUFBYSxxQkFBcUIsVUFBVSxZQUFZLEVBQUU7QUFDaEUsUUFBSSxLQUFLLE9BQU8sSUFBSSxVQUFVLEdBQUc7QUFDaEMsWUFBTSxJQUFJLE1BQU0scUJBQXFCLEVBQUUsa0JBQWtCO0FBQUEsSUFDMUQ7QUFFQSxVQUFNLFFBQTJDO0FBQUEsTUFDaEQsSUFBSTtBQUFBLE1BQ0osT0FBTztBQUFBLE1BQ1AsYUFBYTtBQUFBLE1BQ2IsUUFBUTtBQUFBLElBQ1Q7QUFFQSxRQUFJLFdBQVc7QUFDZixRQUFJLFVBQVU7QUFDZCxVQUFNLFlBQVksTUFBTTtBQUN2QixVQUFJLFVBQVU7QUFDYixjQUFNLElBQUksTUFBTSw4QkFBOEI7QUFBQSxNQUMvQztBQUVBLFVBQUksQ0FBQyxTQUFTO0FBQ2I7QUFBQSxNQUNEO0FBRUEsV0FBSyxPQUFPLFVBQVUsSUFBSSxLQUFLO0FBQUEsSUFDaEM7QUFFQSxVQUFNLE9BQU8sT0FBTyxPQUE4QjtBQUFBLE1BQ2pEO0FBQUEsTUFFQSxJQUFJLFFBQWdCO0FBQ25CLGVBQU8sTUFBTTtBQUFBLE1BQ2Q7QUFBQSxNQUNBLElBQUksTUFBTSxPQUFlO0FBQ3hCLGNBQU0sUUFBUTtBQUNkLGtCQUFVO0FBQUEsTUFDWDtBQUFBLE1BRUEsSUFBSSxjQUFzQjtBQUN6QixlQUFPLE1BQU07QUFBQSxNQUNkO0FBQUEsTUFDQSxJQUFJLFlBQVksT0FBZTtBQUM5QixjQUFNLGNBQWM7QUFDcEIsa0JBQVU7QUFBQSxNQUNYO0FBQUEsTUFFQSxJQUFJLFNBQTZCO0FBQ2hDLGVBQU8sTUFBTTtBQUFBLE1BQ2Q7QUFBQSxNQUNBLElBQUksT0FBTyxPQUEyQjtBQUNyQyxjQUFNLFNBQVM7QUFDZixrQkFBVTtBQUFBLE1BQ1g7QUFBQSxNQUVBLE1BQU0sTUFBTTtBQUNYLGtCQUFVO0FBQ1Ysa0JBQVU7QUFBQSxNQUNYO0FBQUEsTUFDQSxNQUFNLE1BQU07QUFDWCxrQkFBVTtBQUNWLGFBQUssT0FBTyxjQUFjLEVBQUU7QUFBQSxNQUM3QjtBQUFBLE1BQ0EsU0FBUyxNQUFNO0FBQ2QsbUJBQVc7QUFDWCxhQUFLLE9BQU8sY0FBYyxFQUFFO0FBQzVCLGFBQUssT0FBTyxPQUFPLFVBQVU7QUFBQSxNQUM5QjtBQUFBLElBQ0QsQ0FBQztBQUVELFNBQUssT0FBTyxJQUFJLFlBQVksSUFBSTtBQUNoQyxXQUFPO0FBQUEsRUFDUjtBQUNEO0FBRUEsU0FBUyxxQkFBcUIsV0FBZ0MsSUFBb0I7QUFDakYsU0FBTyxHQUFHLG9CQUFvQixNQUFNLFNBQVMsQ0FBQyxJQUFJLEVBQUU7QUFDckQ7IiwKICAibmFtZXMiOiBbXQp9Cg==
