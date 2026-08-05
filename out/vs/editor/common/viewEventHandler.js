import { Disposable } from "../../base/common/lifecycle.js";
import * as viewEvents from "./viewEvents.js";
class ViewEventHandler extends Disposable {
  constructor() {
    super();
    this._shouldRender = true;
  }
  shouldRender() {
    return this._shouldRender;
  }
  forceShouldRender() {
    this._shouldRender = true;
  }
  setShouldRender() {
    this._shouldRender = true;
  }
  onDidRender() {
    this._shouldRender = false;
  }
  // --- begin event handlers
  onCompositionStart(e) {
    return false;
  }
  onCompositionEnd(e) {
    return false;
  }
  onConfigurationChanged(e) {
    return false;
  }
  onCursorStateChanged(e) {
    return false;
  }
  onDecorationsChanged(e) {
    return false;
  }
  onFlushed(e) {
    return false;
  }
  onFocusChanged(e) {
    return false;
  }
  onLanguageConfigurationChanged(e) {
    return false;
  }
  onLineMappingChanged(e) {
    return false;
  }
  onLinesChanged(e) {
    return false;
  }
  onLinesDeleted(e) {
    return false;
  }
  onLinesInserted(e) {
    return false;
  }
  onRevealRangeRequest(e) {
    return false;
  }
  onScrollChanged(e) {
    return false;
  }
  onThemeChanged(e) {
    return false;
  }
  onTokensChanged(e) {
    return false;
  }
  onTokensColorsChanged(e) {
    return false;
  }
  onZonesChanged(e) {
    return false;
  }
  // --- end event handlers
  handleEvents(events) {
    let shouldRender = false;
    for (let i = 0, len = events.length; i < len; i++) {
      const e = events[i];
      switch (e.type) {
        case viewEvents.ViewEventType.ViewCompositionStart:
          if (this.onCompositionStart(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewCompositionEnd:
          if (this.onCompositionEnd(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewConfigurationChanged:
          if (this.onConfigurationChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewCursorStateChanged:
          if (this.onCursorStateChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewDecorationsChanged:
          if (this.onDecorationsChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewFlushed:
          if (this.onFlushed(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewFocusChanged:
          if (this.onFocusChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewLanguageConfigurationChanged:
          if (this.onLanguageConfigurationChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewLineMappingChanged:
          if (this.onLineMappingChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewLinesChanged:
          if (this.onLinesChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewLinesDeleted:
          if (this.onLinesDeleted(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewLinesInserted:
          if (this.onLinesInserted(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewRevealRangeRequest:
          if (this.onRevealRangeRequest(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewScrollChanged:
          if (this.onScrollChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewTokensChanged:
          if (this.onTokensChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewThemeChanged:
          if (this.onThemeChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewTokensColorsChanged:
          if (this.onTokensColorsChanged(e)) {
            shouldRender = true;
          }
          break;
        case viewEvents.ViewEventType.ViewZonesChanged:
          if (this.onZonesChanged(e)) {
            shouldRender = true;
          }
          break;
        default:
          console.info("View received unknown event: ");
          console.info(e);
      }
    }
    if (shouldRender) {
      this._shouldRender = true;
    }
  }
}
export {
  ViewEventHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy9lZGl0b3IvY29tbW9uL3ZpZXdFdmVudEhhbmRsZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIHZpZXdFdmVudHMgZnJvbSAnLi92aWV3RXZlbnRzLmpzJztcblxuZXhwb3J0IGNsYXNzIFZpZXdFdmVudEhhbmRsZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9zaG91bGRSZW5kZXI6IGJvb2xlYW47XG5cblx0Y29uc3RydWN0b3IoKSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9zaG91bGRSZW5kZXIgPSB0cnVlO1xuXHR9XG5cblx0cHVibGljIHNob3VsZFJlbmRlcigpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fc2hvdWxkUmVuZGVyO1xuXHR9XG5cblx0cHVibGljIGZvcmNlU2hvdWxkUmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nob3VsZFJlbmRlciA9IHRydWU7XG5cdH1cblxuXHRwcm90ZWN0ZWQgc2V0U2hvdWxkUmVuZGVyKCk6IHZvaWQge1xuXHRcdHRoaXMuX3Nob3VsZFJlbmRlciA9IHRydWU7XG5cdH1cblxuXHRwdWJsaWMgb25EaWRSZW5kZXIoKTogdm9pZCB7XG5cdFx0dGhpcy5fc2hvdWxkUmVuZGVyID0gZmFsc2U7XG5cdH1cblxuXHQvLyAtLS0gYmVnaW4gZXZlbnQgaGFuZGxlcnNcblxuXHRwdWJsaWMgb25Db21wb3NpdGlvblN0YXJ0KGU6IHZpZXdFdmVudHMuVmlld0NvbXBvc2l0aW9uU3RhcnRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25Db21wb3NpdGlvbkVuZChlOiB2aWV3RXZlbnRzLlZpZXdDb21wb3NpdGlvbkVuZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvbkNvbmZpZ3VyYXRpb25DaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0NvbmZpZ3VyYXRpb25DaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG9uQ3Vyc29yU3RhdGVDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0N1cnNvclN0YXRlQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvbkRlY29yYXRpb25zQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdEZWNvcmF0aW9uc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25GbHVzaGVkKGU6IHZpZXdFdmVudHMuVmlld0ZsdXNoZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25Gb2N1c0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3Rm9jdXNDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG9uTGFuZ3VhZ2VDb25maWd1cmF0aW9uQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdMYW5ndWFnZUNvbmZpZ3VyYXRpb25FdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25MaW5lTWFwcGluZ0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3TGluZU1hcHBpbmdDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG9uTGluZXNDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvbkxpbmVzRGVsZXRlZChlOiB2aWV3RXZlbnRzLlZpZXdMaW5lc0RlbGV0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25MaW5lc0luc2VydGVkKGU6IHZpZXdFdmVudHMuVmlld0xpbmVzSW5zZXJ0ZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXHRwdWJsaWMgb25SZXZlYWxSYW5nZVJlcXVlc3QoZTogdmlld0V2ZW50cy5WaWV3UmV2ZWFsUmFuZ2VSZXF1ZXN0RXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG9uU2Nyb2xsQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdTY3JvbGxDaGFuZ2VkRXZlbnQpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblx0cHVibGljIG9uVGhlbWVDaGFuZ2VkKGU6IHZpZXdFdmVudHMuVmlld1RoZW1lQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvblRva2Vuc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VG9rZW5zQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvblRva2Vuc0NvbG9yc0NoYW5nZWQoZTogdmlld0V2ZW50cy5WaWV3VG9rZW5zQ29sb3JzQ2hhbmdlZEV2ZW50KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGZhbHNlO1xuXHR9XG5cdHB1YmxpYyBvblpvbmVzQ2hhbmdlZChlOiB2aWV3RXZlbnRzLlZpZXdab25lc0NoYW5nZWRFdmVudCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdC8vIC0tLSBlbmQgZXZlbnQgaGFuZGxlcnNcblxuXHRwdWJsaWMgaGFuZGxlRXZlbnRzKGV2ZW50czogdmlld0V2ZW50cy5WaWV3RXZlbnRbXSk6IHZvaWQge1xuXG5cdFx0bGV0IHNob3VsZFJlbmRlciA9IGZhbHNlO1xuXG5cdFx0Zm9yIChsZXQgaSA9IDAsIGxlbiA9IGV2ZW50cy5sZW5ndGg7IGkgPCBsZW47IGkrKykge1xuXHRcdFx0Y29uc3QgZSA9IGV2ZW50c1tpXTtcblxuXHRcdFx0c3dpdGNoIChlLnR5cGUpIHtcblxuXHRcdFx0XHRjYXNlIHZpZXdFdmVudHMuVmlld0V2ZW50VHlwZS5WaWV3Q29tcG9zaXRpb25TdGFydDpcblx0XHRcdFx0XHRpZiAodGhpcy5vbkNvbXBvc2l0aW9uU3RhcnQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdDb21wb3NpdGlvbkVuZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vbkNvbXBvc2l0aW9uRW5kKGUpKSB7XG5cdFx0XHRcdFx0XHRzaG91bGRSZW5kZXIgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIHZpZXdFdmVudHMuVmlld0V2ZW50VHlwZS5WaWV3Q29uZmlndXJhdGlvbkNoYW5nZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25Db25maWd1cmF0aW9uQ2hhbmdlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld0N1cnNvclN0YXRlQ2hhbmdlZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vbkN1cnNvclN0YXRlQ2hhbmdlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld0RlY29yYXRpb25zQ2hhbmdlZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vbkRlY29yYXRpb25zQ2hhbmdlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld0ZsdXNoZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25GbHVzaGVkKGUpKSB7XG5cdFx0XHRcdFx0XHRzaG91bGRSZW5kZXIgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIHZpZXdFdmVudHMuVmlld0V2ZW50VHlwZS5WaWV3Rm9jdXNDaGFuZ2VkOlxuXHRcdFx0XHRcdGlmICh0aGlzLm9uRm9jdXNDaGFuZ2VkKGUpKSB7XG5cdFx0XHRcdFx0XHRzaG91bGRSZW5kZXIgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIHZpZXdFdmVudHMuVmlld0V2ZW50VHlwZS5WaWV3TGFuZ3VhZ2VDb25maWd1cmF0aW9uQ2hhbmdlZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vbkxhbmd1YWdlQ29uZmlndXJhdGlvbkNoYW5nZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdMaW5lTWFwcGluZ0NoYW5nZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25MaW5lTWFwcGluZ0NoYW5nZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdMaW5lc0NoYW5nZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25MaW5lc0NoYW5nZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdMaW5lc0RlbGV0ZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25MaW5lc0RlbGV0ZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdMaW5lc0luc2VydGVkOlxuXHRcdFx0XHRcdGlmICh0aGlzLm9uTGluZXNJbnNlcnRlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld1JldmVhbFJhbmdlUmVxdWVzdDpcblx0XHRcdFx0XHRpZiAodGhpcy5vblJldmVhbFJhbmdlUmVxdWVzdChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld1Njcm9sbENoYW5nZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25TY3JvbGxDaGFuZ2VkKGUpKSB7XG5cdFx0XHRcdFx0XHRzaG91bGRSZW5kZXIgPSB0cnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRicmVhaztcblxuXHRcdFx0XHRjYXNlIHZpZXdFdmVudHMuVmlld0V2ZW50VHlwZS5WaWV3VG9rZW5zQ2hhbmdlZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vblRva2Vuc0NoYW5nZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdUaGVtZUNoYW5nZWQ6XG5cdFx0XHRcdFx0aWYgKHRoaXMub25UaGVtZUNoYW5nZWQoZSkpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGJyZWFrO1xuXG5cdFx0XHRcdGNhc2Ugdmlld0V2ZW50cy5WaWV3RXZlbnRUeXBlLlZpZXdUb2tlbnNDb2xvcnNDaGFuZ2VkOlxuXHRcdFx0XHRcdGlmICh0aGlzLm9uVG9rZW5zQ29sb3JzQ2hhbmdlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0Y2FzZSB2aWV3RXZlbnRzLlZpZXdFdmVudFR5cGUuVmlld1pvbmVzQ2hhbmdlZDpcblx0XHRcdFx0XHRpZiAodGhpcy5vblpvbmVzQ2hhbmdlZChlKSkge1xuXHRcdFx0XHRcdFx0c2hvdWxkUmVuZGVyID0gdHJ1ZTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cblx0XHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0XHRjb25zb2xlLmluZm8oJ1ZpZXcgcmVjZWl2ZWQgdW5rbm93biBldmVudDogJyk7XG5cdFx0XHRcdFx0Y29uc29sZS5pbmZvKGUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGlmIChzaG91bGRSZW5kZXIpIHtcblx0XHRcdHRoaXMuX3Nob3VsZFJlbmRlciA9IHRydWU7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGtCQUFrQjtBQUMzQixZQUFZLGdCQUFnQjtBQUVyQixNQUFNLHlCQUF5QixXQUFXO0FBQUEsRUFJaEQsY0FBYztBQUNiLFVBQU07QUFDTixTQUFLLGdCQUFnQjtBQUFBLEVBQ3RCO0FBQUEsRUFFTyxlQUF3QjtBQUM5QixXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxvQkFBMEI7QUFDaEMsU0FBSyxnQkFBZ0I7QUFBQSxFQUN0QjtBQUFBLEVBRVUsa0JBQXdCO0FBQ2pDLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQSxFQUVPLGNBQW9CO0FBQzFCLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQTtBQUFBLEVBSU8sbUJBQW1CLEdBQWtEO0FBQzNFLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxpQkFBaUIsR0FBZ0Q7QUFDdkUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLHVCQUF1QixHQUFzRDtBQUNuRixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ08scUJBQXFCLEdBQW9EO0FBQy9FLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxxQkFBcUIsR0FBb0Q7QUFDL0UsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLFVBQVUsR0FBeUM7QUFDekQsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLGVBQWUsR0FBOEM7QUFDbkUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLCtCQUErQixHQUF1RDtBQUM1RixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ08scUJBQXFCLEdBQW9EO0FBQy9FLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxlQUFlLEdBQThDO0FBQ25FLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxlQUFlLEdBQThDO0FBQ25FLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxnQkFBZ0IsR0FBK0M7QUFDckUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLHFCQUFxQixHQUFvRDtBQUMvRSxXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ08sZ0JBQWdCLEdBQStDO0FBQ3JFLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxlQUFlLEdBQThDO0FBQ25FLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFDTyxnQkFBZ0IsR0FBK0M7QUFDckUsV0FBTztBQUFBLEVBQ1I7QUFBQSxFQUNPLHNCQUFzQixHQUFxRDtBQUNqRixXQUFPO0FBQUEsRUFDUjtBQUFBLEVBQ08sZUFBZSxHQUE4QztBQUNuRSxXQUFPO0FBQUEsRUFDUjtBQUFBO0FBQUEsRUFJTyxhQUFhLFFBQXNDO0FBRXpELFFBQUksZUFBZTtBQUVuQixhQUFTLElBQUksR0FBRyxNQUFNLE9BQU8sUUFBUSxJQUFJLEtBQUssS0FBSztBQUNsRCxZQUFNLElBQUksT0FBTyxDQUFDO0FBRWxCLGNBQVEsRUFBRSxNQUFNO0FBQUEsUUFFZixLQUFLLFdBQVcsY0FBYztBQUM3QixjQUFJLEtBQUssbUJBQW1CLENBQUMsR0FBRztBQUMvQiwyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxpQkFBaUIsQ0FBQyxHQUFHO0FBQzdCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLHVCQUF1QixDQUFDLEdBQUc7QUFDbkMsMkJBQWU7QUFBQSxVQUNoQjtBQUNBO0FBQUEsUUFFRCxLQUFLLFdBQVcsY0FBYztBQUM3QixjQUFJLEtBQUsscUJBQXFCLENBQUMsR0FBRztBQUNqQywyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxxQkFBcUIsQ0FBQyxHQUFHO0FBQ2pDLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLFVBQVUsQ0FBQyxHQUFHO0FBQ3RCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLGVBQWUsQ0FBQyxHQUFHO0FBQzNCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLCtCQUErQixDQUFDLEdBQUc7QUFDM0MsMkJBQWU7QUFBQSxVQUNoQjtBQUNBO0FBQUEsUUFFRCxLQUFLLFdBQVcsY0FBYztBQUM3QixjQUFJLEtBQUsscUJBQXFCLENBQUMsR0FBRztBQUNqQywyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxlQUFlLENBQUMsR0FBRztBQUMzQiwyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxlQUFlLENBQUMsR0FBRztBQUMzQiwyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxnQkFBZ0IsQ0FBQyxHQUFHO0FBQzVCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLHFCQUFxQixDQUFDLEdBQUc7QUFDakMsMkJBQWU7QUFBQSxVQUNoQjtBQUNBO0FBQUEsUUFFRCxLQUFLLFdBQVcsY0FBYztBQUM3QixjQUFJLEtBQUssZ0JBQWdCLENBQUMsR0FBRztBQUM1QiwyQkFBZTtBQUFBLFVBQ2hCO0FBQ0E7QUFBQSxRQUVELEtBQUssV0FBVyxjQUFjO0FBQzdCLGNBQUksS0FBSyxnQkFBZ0IsQ0FBQyxHQUFHO0FBQzVCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLGVBQWUsQ0FBQyxHQUFHO0FBQzNCLDJCQUFlO0FBQUEsVUFDaEI7QUFDQTtBQUFBLFFBRUQsS0FBSyxXQUFXLGNBQWM7QUFDN0IsY0FBSSxLQUFLLHNCQUFzQixDQUFDLEdBQUc7QUFDbEMsMkJBQWU7QUFBQSxVQUNoQjtBQUNBO0FBQUEsUUFFRCxLQUFLLFdBQVcsY0FBYztBQUM3QixjQUFJLEtBQUssZUFBZSxDQUFDLEdBQUc7QUFDM0IsMkJBQWU7QUFBQSxVQUNoQjtBQUNBO0FBQUEsUUFFRDtBQUNDLGtCQUFRLEtBQUssK0JBQStCO0FBQzVDLGtCQUFRLEtBQUssQ0FBQztBQUFBLE1BQ2hCO0FBQUEsSUFDRDtBQUVBLFFBQUksY0FBYztBQUNqQixXQUFLLGdCQUFnQjtBQUFBLElBQ3RCO0FBQUEsRUFDRDtBQUNEOyIsCiAgIm5hbWVzIjogW10KfQo=
