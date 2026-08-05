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
import * as cssValue from "../../../../base/browser/cssValue.js";
import * as domStylesheets from "../../../../base/browser/domStylesheets.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ILifecycleService, LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
let WebviewIconManager = class extends Disposable {
  constructor(_lifecycleService, _configService) {
    super();
    this._lifecycleService = _lifecycleService;
    this._configService = _configService;
    this._icons = /* @__PURE__ */ new Map();
    this._register(this._configService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration("workbench.iconTheme")) {
        this.updateStyleSheet();
      }
    }));
  }
  dispose() {
    super.dispose();
    this._styleElement = void 0;
  }
  get styleElement() {
    if (!this._styleElement) {
      this._styleElement = domStylesheets.createStyleSheet(void 0, void 0, this._store);
      this._styleElement.className = "webview-icons";
    }
    return this._styleElement;
  }
  setIcons(webviewId, iconPath) {
    if (iconPath) {
      this._icons.set(webviewId, iconPath);
    } else {
      this._icons.delete(webviewId);
    }
    this.updateStyleSheet();
  }
  async updateStyleSheet() {
    await this._lifecycleService.when(LifecyclePhase.Starting);
    const cssRules = [];
    if (this._configService.getValue("workbench.iconTheme") !== null) {
      for (const [key, value] of this._icons) {
        const webviewSelector = `.show-file-icons .webview-${key}-name-file-icon::before`;
        try {
          cssRules.push(
            `.monaco-workbench.vs ${webviewSelector}, .monaco-workbench.hc-light ${webviewSelector} { content: ""; background-image: ${cssValue.asCSSUrl(value.light)}; }`,
            `.monaco-workbench.vs-dark ${webviewSelector}, .monaco-workbench.hc-black ${webviewSelector} { content: ""; background-image: ${cssValue.asCSSUrl(value.dark)}; }`
          );
        } catch {
        }
      }
    }
    this.styleElement.textContent = cssRules.join("\n");
  }
};
WebviewIconManager = __decorateClass([
  __decorateParam(0, ILifecycleService),
  __decorateParam(1, IConfigurationService)
], WebviewIconManager);
export {
  WebviewIconManager
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWJ2aWV3UGFuZWwvYnJvd3Nlci93ZWJ2aWV3SWNvbk1hbmFnZXIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBjc3NWYWx1ZSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2Jyb3dzZXIvY3NzVmFsdWUuanMnO1xuaW1wb3J0ICogYXMgZG9tU3R5bGVzaGVldHMgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSUxpZmVjeWNsZVNlcnZpY2UsIExpZmVjeWNsZVBoYXNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvbGlmZWN5Y2xlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIFdlYnZpZXdJY29ucyB7XG5cdHJlYWRvbmx5IGxpZ2h0OiBVUkk7XG5cdHJlYWRvbmx5IGRhcms6IFVSSTtcbn1cblxuZXhwb3J0IGNsYXNzIFdlYnZpZXdJY29uTWFuYWdlciBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2ljb25zID0gbmV3IE1hcDxzdHJpbmcsIFdlYnZpZXdJY29ucz4oKTtcblxuXHRwcml2YXRlIF9zdHlsZUVsZW1lbnQ6IEhUTUxTdHlsZUVsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xpZmVjeWNsZVNlcnZpY2U6IElMaWZlY3ljbGVTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlnU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ1NlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oJ3dvcmtiZW5jaC5pY29uVGhlbWUnKSkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZVN0eWxlU2hlZXQoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblx0b3ZlcnJpZGUgZGlzcG9zZSgpIHtcblx0XHRzdXBlci5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgc3R5bGVFbGVtZW50KCk6IEhUTUxTdHlsZUVsZW1lbnQge1xuXHRcdGlmICghdGhpcy5fc3R5bGVFbGVtZW50KSB7XG5cdFx0XHR0aGlzLl9zdHlsZUVsZW1lbnQgPSBkb21TdHlsZXNoZWV0cy5jcmVhdGVTdHlsZVNoZWV0KHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB0aGlzLl9zdG9yZSk7XG5cdFx0XHR0aGlzLl9zdHlsZUVsZW1lbnQuY2xhc3NOYW1lID0gJ3dlYnZpZXctaWNvbnMnO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc3R5bGVFbGVtZW50O1xuXHR9XG5cblx0cHVibGljIHNldEljb25zKFxuXHRcdHdlYnZpZXdJZDogc3RyaW5nLFxuXHRcdGljb25QYXRoOiBXZWJ2aWV3SWNvbnMgfCB1bmRlZmluZWQsXG5cdCkge1xuXHRcdGlmIChpY29uUGF0aCkge1xuXHRcdFx0dGhpcy5faWNvbnMuc2V0KHdlYnZpZXdJZCwgaWNvblBhdGgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9pY29ucy5kZWxldGUod2Vidmlld0lkKTtcblx0XHR9XG5cblx0XHR0aGlzLnVwZGF0ZVN0eWxlU2hlZXQoKTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdXBkYXRlU3R5bGVTaGVldCgpIHtcblx0XHRhd2FpdCB0aGlzLl9saWZlY3ljbGVTZXJ2aWNlLndoZW4oTGlmZWN5Y2xlUGhhc2UuU3RhcnRpbmcpO1xuXG5cdFx0Y29uc3QgY3NzUnVsZXM6IHN0cmluZ1tdID0gW107XG5cdFx0aWYgKHRoaXMuX2NvbmZpZ1NlcnZpY2UuZ2V0VmFsdWUoJ3dvcmtiZW5jaC5pY29uVGhlbWUnKSAhPT0gbnVsbCkge1xuXHRcdFx0Zm9yIChjb25zdCBba2V5LCB2YWx1ZV0gb2YgdGhpcy5faWNvbnMpIHtcblx0XHRcdFx0Y29uc3Qgd2Vidmlld1NlbGVjdG9yID0gYC5zaG93LWZpbGUtaWNvbnMgLndlYnZpZXctJHtrZXl9LW5hbWUtZmlsZS1pY29uOjpiZWZvcmVgO1xuXHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdGNzc1J1bGVzLnB1c2goXG5cdFx0XHRcdFx0XHRgLm1vbmFjby13b3JrYmVuY2gudnMgJHt3ZWJ2aWV3U2VsZWN0b3J9LCAubW9uYWNvLXdvcmtiZW5jaC5oYy1saWdodCAke3dlYnZpZXdTZWxlY3Rvcn0geyBjb250ZW50OiBcIlwiOyBiYWNrZ3JvdW5kLWltYWdlOiAke2Nzc1ZhbHVlLmFzQ1NTVXJsKHZhbHVlLmxpZ2h0KX07IH1gLFxuXHRcdFx0XHRcdFx0YC5tb25hY28td29ya2JlbmNoLnZzLWRhcmsgJHt3ZWJ2aWV3U2VsZWN0b3J9LCAubW9uYWNvLXdvcmtiZW5jaC5oYy1ibGFjayAke3dlYnZpZXdTZWxlY3Rvcn0geyBjb250ZW50OiBcIlwiOyBiYWNrZ3JvdW5kLWltYWdlOiAke2Nzc1ZhbHVlLmFzQ1NTVXJsKHZhbHVlLmRhcmspfTsgfWBcblx0XHRcdFx0XHQpO1xuXHRcdFx0XHR9IGNhdGNoIHtcblx0XHRcdFx0XHQvLyBub29wXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5zdHlsZUVsZW1lbnQudGV4dENvbnRlbnQgPSBjc3NSdWxlcy5qb2luKCdcXG4nKTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLGNBQWM7QUFDMUIsWUFBWSxvQkFBb0I7QUFDaEMsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUIsc0JBQXNCO0FBTzNDLElBQU0scUJBQU4sY0FBaUMsV0FBVztBQUFBLEVBTWxELFlBQ3FDLG1CQUNJLGdCQUN2QztBQUNELFVBQU07QUFIOEI7QUFDSTtBQU56QyxTQUFpQixTQUFTLG9CQUFJLElBQTBCO0FBU3ZELFNBQUssVUFBVSxLQUFLLGVBQWUseUJBQXlCLE9BQUs7QUFDaEUsVUFBSSxFQUFFLHFCQUFxQixxQkFBcUIsR0FBRztBQUNsRCxhQUFLLGlCQUFpQjtBQUFBLE1BQ3ZCO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFDUyxVQUFVO0FBQ2xCLFVBQU0sUUFBUTtBQUNkLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFBQSxFQUVBLElBQVksZUFBaUM7QUFDNUMsUUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QixXQUFLLGdCQUFnQixlQUFlLGlCQUFpQixRQUFXLFFBQVcsS0FBSyxNQUFNO0FBQ3RGLFdBQUssY0FBYyxZQUFZO0FBQUEsSUFDaEM7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFTyxTQUNOLFdBQ0EsVUFDQztBQUNELFFBQUksVUFBVTtBQUNiLFdBQUssT0FBTyxJQUFJLFdBQVcsUUFBUTtBQUFBLElBQ3BDLE9BQU87QUFDTixXQUFLLE9BQU8sT0FBTyxTQUFTO0FBQUEsSUFDN0I7QUFFQSxTQUFLLGlCQUFpQjtBQUFBLEVBQ3ZCO0FBQUEsRUFFQSxNQUFjLG1CQUFtQjtBQUNoQyxVQUFNLEtBQUssa0JBQWtCLEtBQUssZUFBZSxRQUFRO0FBRXpELFVBQU0sV0FBcUIsQ0FBQztBQUM1QixRQUFJLEtBQUssZUFBZSxTQUFTLHFCQUFxQixNQUFNLE1BQU07QUFDakUsaUJBQVcsQ0FBQyxLQUFLLEtBQUssS0FBSyxLQUFLLFFBQVE7QUFDdkMsY0FBTSxrQkFBa0IsNkJBQTZCLEdBQUc7QUFDeEQsWUFBSTtBQUNILG1CQUFTO0FBQUEsWUFDUix3QkFBd0IsZUFBZSxnQ0FBZ0MsZUFBZSxxQ0FBcUMsU0FBUyxTQUFTLE1BQU0sS0FBSyxDQUFDO0FBQUEsWUFDekosNkJBQTZCLGVBQWUsZ0NBQWdDLGVBQWUscUNBQXFDLFNBQVMsU0FBUyxNQUFNLElBQUksQ0FBQztBQUFBLFVBQzlKO0FBQUEsUUFDRCxRQUFRO0FBQUEsUUFFUjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsU0FBSyxhQUFhLGNBQWMsU0FBUyxLQUFLLElBQUk7QUFBQSxFQUNuRDtBQUNEO0FBOURhLHFCQUFOO0FBQUEsRUFPSjtBQUFBLEVBQ0E7QUFBQSxHQVJVOyIsCiAgIm5hbWVzIjogW10KfQo=
