import { Emitter } from "../../../base/common/event.js";
import { DisposableStore } from "../../../base/common/lifecycle.js";
import { asWebviewUri, webviewGenericCspSource } from "../../contrib/webview/common/webview.js";
class ExtHostEditorInsets {
  constructor(_proxy, _editors, _remoteInfo) {
    this._proxy = _proxy;
    this._editors = _editors;
    this._remoteInfo = _remoteInfo;
    this._handlePool = 0;
    this._disposables = new DisposableStore();
    this._insets = /* @__PURE__ */ new Map();
    this._disposables.add(_editors.onDidChangeVisibleTextEditors(() => {
      const visibleEditor = _editors.getVisibleTextEditors();
      for (const value of this._insets.values()) {
        if (visibleEditor.indexOf(value.editor) < 0) {
          value.inset.dispose();
        }
      }
    }));
  }
  dispose() {
    this._insets.forEach((value) => value.inset.dispose());
    this._disposables.dispose();
  }
  createWebviewEditorInset(editor, line, height, options, extension) {
    let apiEditor;
    for (const candidate of this._editors.getVisibleTextEditors(true)) {
      if (candidate.value === editor) {
        apiEditor = candidate;
        break;
      }
    }
    if (!apiEditor) {
      throw new Error("not a visible editor");
    }
    const that = this;
    const handle = this._handlePool++;
    const onDidReceiveMessage = new Emitter();
    const onDidDispose = new Emitter();
    const webview = new class {
      constructor() {
        this._html = "";
        this._options = /* @__PURE__ */ Object.create(null);
      }
      asWebviewUri(resource) {
        return asWebviewUri(resource, that._remoteInfo);
      }
      get cspSource() {
        return webviewGenericCspSource;
      }
      set options(value) {
        this._options = value;
        that._proxy.$setOptions(handle, value);
      }
      get options() {
        return this._options;
      }
      set html(value) {
        this._html = value;
        that._proxy.$setHtml(handle, value);
      }
      get html() {
        return this._html;
      }
      get onDidReceiveMessage() {
        return onDidReceiveMessage.event;
      }
      postMessage(message) {
        return that._proxy.$postMessage(handle, message);
      }
    }();
    const inset = new class {
      constructor() {
        this.editor = editor;
        this.line = line;
        this.height = height;
        this.webview = webview;
        this.onDidDispose = onDidDispose.event;
      }
      dispose() {
        if (that._insets.has(handle)) {
          that._insets.delete(handle);
          that._proxy.$disposeEditorInset(handle);
          onDidDispose.fire();
          onDidDispose.dispose();
          onDidReceiveMessage.dispose();
        }
      }
    }();
    this._proxy.$createEditorInset(handle, apiEditor.id, apiEditor.value.document.uri, line + 1, height, options || {}, extension.identifier, extension.extensionLocation);
    this._insets.set(handle, { editor, inset, onDidReceiveMessage });
    return inset;
  }
  $onDidDispose(handle) {
    const value = this._insets.get(handle);
    if (value) {
      value.inset.dispose();
    }
  }
  $onDidReceiveMessage(handle, message) {
    const value = this._insets.get(handle);
    value?.onDidReceiveMessage.fire(message);
  }
}
export {
  ExtHostEditorInsets
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q29kZUluc2V0cy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbkRlc2NyaXB0aW9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0VGV4dEVkaXRvciB9IGZyb20gJy4vZXh0SG9zdFRleHRFZGl0b3IuanMnO1xuaW1wb3J0IHsgRXh0SG9zdEVkaXRvcnMgfSBmcm9tICcuL2V4dEhvc3RUZXh0RWRpdG9ycy5qcyc7XG5pbXBvcnQgeyBhc1dlYnZpZXdVcmksIHdlYnZpZXdHZW5lcmljQ3NwU291cmNlLCBXZWJ2aWV3UmVtb3RlSW5mbyB9IGZyb20gJy4uLy4uL2NvbnRyaWIvd2Vidmlldy9jb21tb24vd2Vidmlldy5qcyc7XG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgRXh0SG9zdEVkaXRvckluc2V0c1NoYXBlLCBNYWluVGhyZWFkRWRpdG9ySW5zZXRzU2hhcGUgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuXG5leHBvcnQgY2xhc3MgRXh0SG9zdEVkaXRvckluc2V0cyBpbXBsZW1lbnRzIEV4dEhvc3RFZGl0b3JJbnNldHNTaGFwZSB7XG5cblx0cHJpdmF0ZSBfaGFuZGxlUG9vbCA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2Rpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRwcml2YXRlIF9pbnNldHMgPSBuZXcgTWFwPG51bWJlciwgeyBlZGl0b3I6IHZzY29kZS5UZXh0RWRpdG9yOyBpbnNldDogdnNjb2RlLldlYnZpZXdFZGl0b3JJbnNldDsgb25EaWRSZWNlaXZlTWVzc2FnZTogRW1pdHRlcjxhbnk+IH0+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRFZGl0b3JJbnNldHNTaGFwZSxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JzOiBFeHRIb3N0RWRpdG9ycyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9yZW1vdGVJbmZvOiBXZWJ2aWV3UmVtb3RlSW5mb1xuXHQpIHtcblxuXHRcdC8vIGRpc3Bvc2UgZWRpdG9yIGluc2V0IHdoZW5ldmVyIHRoZSBob3N0aW5nIGVkaXRvciBnb2VzIGF3YXlcblx0XHR0aGlzLl9kaXNwb3NhYmxlcy5hZGQoX2VkaXRvcnMub25EaWRDaGFuZ2VWaXNpYmxlVGV4dEVkaXRvcnMoKCkgPT4ge1xuXHRcdFx0Y29uc3QgdmlzaWJsZUVkaXRvciA9IF9lZGl0b3JzLmdldFZpc2libGVUZXh0RWRpdG9ycygpO1xuXHRcdFx0Zm9yIChjb25zdCB2YWx1ZSBvZiB0aGlzLl9pbnNldHMudmFsdWVzKCkpIHtcblx0XHRcdFx0aWYgKHZpc2libGVFZGl0b3IuaW5kZXhPZih2YWx1ZS5lZGl0b3IpIDwgMCkge1xuXHRcdFx0XHRcdHZhbHVlLmluc2V0LmRpc3Bvc2UoKTsgLy8gd2lsbCByZW1vdmUgZnJvbSBgdGhpcy5faW5zZXRzYFxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0ZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLl9pbnNldHMuZm9yRWFjaCh2YWx1ZSA9PiB2YWx1ZS5pbnNldC5kaXNwb3NlKCkpO1xuXHRcdHRoaXMuX2Rpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0fVxuXG5cdGNyZWF0ZVdlYnZpZXdFZGl0b3JJbnNldChlZGl0b3I6IHZzY29kZS5UZXh0RWRpdG9yLCBsaW5lOiBudW1iZXIsIGhlaWdodDogbnVtYmVyLCBvcHRpb25zOiB2c2NvZGUuV2Vidmlld09wdGlvbnMgfCB1bmRlZmluZWQsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogdnNjb2RlLldlYnZpZXdFZGl0b3JJbnNldCB7XG5cblx0XHRsZXQgYXBpRWRpdG9yOiBFeHRIb3N0VGV4dEVkaXRvciB8IHVuZGVmaW5lZDtcblx0XHRmb3IgKGNvbnN0IGNhbmRpZGF0ZSBvZiB0aGlzLl9lZGl0b3JzLmdldFZpc2libGVUZXh0RWRpdG9ycyh0cnVlKSkge1xuXHRcdFx0aWYgKGNhbmRpZGF0ZS52YWx1ZSA9PT0gZWRpdG9yKSB7XG5cdFx0XHRcdGFwaUVkaXRvciA9IDxFeHRIb3N0VGV4dEVkaXRvcj5jYW5kaWRhdGU7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRpZiAoIWFwaUVkaXRvcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdub3QgYSB2aXNpYmxlIGVkaXRvcicpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdGNvbnN0IGhhbmRsZSA9IHRoaXMuX2hhbmRsZVBvb2wrKztcblx0XHRjb25zdCBvbkRpZFJlY2VpdmVNZXNzYWdlID0gbmV3IEVtaXR0ZXI8YW55PigpO1xuXHRcdGNvbnN0IG9uRGlkRGlzcG9zZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cblx0XHRjb25zdCB3ZWJ2aWV3ID0gbmV3IGNsYXNzIGltcGxlbWVudHMgdnNjb2RlLldlYnZpZXcge1xuXG5cdFx0XHRwcml2YXRlIF9odG1sOiBzdHJpbmcgPSAnJztcblx0XHRcdHByaXZhdGUgX29wdGlvbnM6IHZzY29kZS5XZWJ2aWV3T3B0aW9ucyA9IE9iamVjdC5jcmVhdGUobnVsbCk7XG5cblx0XHRcdGFzV2Vidmlld1VyaShyZXNvdXJjZTogdnNjb2RlLlVyaSk6IHZzY29kZS5Vcmkge1xuXHRcdFx0XHRyZXR1cm4gYXNXZWJ2aWV3VXJpKHJlc291cmNlLCB0aGF0Ll9yZW1vdGVJbmZvKTtcblx0XHRcdH1cblxuXHRcdFx0Z2V0IGNzcFNvdXJjZSgpOiBzdHJpbmcge1xuXHRcdFx0XHRyZXR1cm4gd2Vidmlld0dlbmVyaWNDc3BTb3VyY2U7XG5cdFx0XHR9XG5cblx0XHRcdHNldCBvcHRpb25zKHZhbHVlOiB2c2NvZGUuV2Vidmlld09wdGlvbnMpIHtcblx0XHRcdFx0dGhpcy5fb3B0aW9ucyA9IHZhbHVlO1xuXHRcdFx0XHR0aGF0Ll9wcm94eS4kc2V0T3B0aW9ucyhoYW5kbGUsIHZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0Z2V0IG9wdGlvbnMoKTogdnNjb2RlLldlYnZpZXdPcHRpb25zIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX29wdGlvbnM7XG5cdFx0XHR9XG5cblx0XHRcdHNldCBodG1sKHZhbHVlOiBzdHJpbmcpIHtcblx0XHRcdFx0dGhpcy5faHRtbCA9IHZhbHVlO1xuXHRcdFx0XHR0aGF0Ll9wcm94eS4kc2V0SHRtbChoYW5kbGUsIHZhbHVlKTtcblx0XHRcdH1cblxuXHRcdFx0Z2V0IGh0bWwoKTogc3RyaW5nIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuX2h0bWw7XG5cdFx0XHR9XG5cblx0XHRcdGdldCBvbkRpZFJlY2VpdmVNZXNzYWdlKCk6IHZzY29kZS5FdmVudDxhbnk+IHtcblx0XHRcdFx0cmV0dXJuIG9uRGlkUmVjZWl2ZU1lc3NhZ2UuZXZlbnQ7XG5cdFx0XHR9XG5cblx0XHRcdHBvc3RNZXNzYWdlKG1lc3NhZ2U6IGFueSk6IFRoZW5hYmxlPGJvb2xlYW4+IHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3Byb3h5LiRwb3N0TWVzc2FnZShoYW5kbGUsIG1lc3NhZ2UpO1xuXHRcdFx0fVxuXHRcdH07XG5cblx0XHRjb25zdCBpbnNldCA9IG5ldyBjbGFzcyBpbXBsZW1lbnRzIHZzY29kZS5XZWJ2aWV3RWRpdG9ySW5zZXQge1xuXG5cdFx0XHRyZWFkb25seSBlZGl0b3I6IHZzY29kZS5UZXh0RWRpdG9yID0gZWRpdG9yO1xuXHRcdFx0cmVhZG9ubHkgbGluZTogbnVtYmVyID0gbGluZTtcblx0XHRcdHJlYWRvbmx5IGhlaWdodDogbnVtYmVyID0gaGVpZ2h0O1xuXHRcdFx0cmVhZG9ubHkgd2VidmlldzogdnNjb2RlLldlYnZpZXcgPSB3ZWJ2aWV3O1xuXHRcdFx0cmVhZG9ubHkgb25EaWREaXNwb3NlOiB2c2NvZGUuRXZlbnQ8dm9pZD4gPSBvbkRpZERpc3Bvc2UuZXZlbnQ7XG5cblx0XHRcdGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0XHRcdGlmICh0aGF0Ll9pbnNldHMuaGFzKGhhbmRsZSkpIHtcblx0XHRcdFx0XHR0aGF0Ll9pbnNldHMuZGVsZXRlKGhhbmRsZSk7XG5cdFx0XHRcdFx0dGhhdC5fcHJveHkuJGRpc3Bvc2VFZGl0b3JJbnNldChoYW5kbGUpO1xuXHRcdFx0XHRcdG9uRGlkRGlzcG9zZS5maXJlKCk7XG5cblx0XHRcdFx0XHQvLyBmaW5hbCBjbGVhbnVwXG5cdFx0XHRcdFx0b25EaWREaXNwb3NlLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRvbkRpZFJlY2VpdmVNZXNzYWdlLmRpc3Bvc2UoKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH07XG5cblx0XHR0aGlzLl9wcm94eS4kY3JlYXRlRWRpdG9ySW5zZXQoaGFuZGxlLCBhcGlFZGl0b3IuaWQsIGFwaUVkaXRvci52YWx1ZS5kb2N1bWVudC51cmksIGxpbmUgKyAxLCBoZWlnaHQsIG9wdGlvbnMgfHwge30sIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBleHRlbnNpb24uZXh0ZW5zaW9uTG9jYXRpb24pO1xuXHRcdHRoaXMuX2luc2V0cy5zZXQoaGFuZGxlLCB7IGVkaXRvciwgaW5zZXQsIG9uRGlkUmVjZWl2ZU1lc3NhZ2UgfSk7XG5cblx0XHRyZXR1cm4gaW5zZXQ7XG5cdH1cblxuXHQkb25EaWREaXNwb3NlKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0Y29uc3QgdmFsdWUgPSB0aGlzLl9pbnNldHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKHZhbHVlKSB7XG5cdFx0XHR2YWx1ZS5pbnNldC5kaXNwb3NlKCk7XG5cdFx0fVxuXHR9XG5cblx0JG9uRGlkUmVjZWl2ZU1lc3NhZ2UoaGFuZGxlOiBudW1iZXIsIG1lc3NhZ2U6IGFueSk6IHZvaWQge1xuXHRcdGNvbnN0IHZhbHVlID0gdGhpcy5faW5zZXRzLmdldChoYW5kbGUpO1xuXHRcdHZhbHVlPy5vbkRpZFJlY2VpdmVNZXNzYWdlLmZpcmUobWVzc2FnZSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsZUFBZTtBQUN4QixTQUFTLHVCQUF1QjtBQUloQyxTQUFTLGNBQWMsK0JBQWtEO0FBSWxFLE1BQU0sb0JBQXdEO0FBQUEsRUFNcEUsWUFDa0IsUUFDQSxVQUNBLGFBQ2hCO0FBSGdCO0FBQ0E7QUFDQTtBQVBsQixTQUFRLGNBQWM7QUFDdEIsU0FBaUIsZUFBZSxJQUFJLGdCQUFnQjtBQUNwRCxTQUFRLFVBQVUsb0JBQUksSUFBZ0g7QUFTckksU0FBSyxhQUFhLElBQUksU0FBUyw4QkFBOEIsTUFBTTtBQUNsRSxZQUFNLGdCQUFnQixTQUFTLHNCQUFzQjtBQUNyRCxpQkFBVyxTQUFTLEtBQUssUUFBUSxPQUFPLEdBQUc7QUFDMUMs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
