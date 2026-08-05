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
import { DEFAULT_FONT_FAMILY } from "../../../../base/browser/fonts.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EDITOR_FONT_DEFAULTS } from "../../../../editor/common/config/editorOptions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import * as colorRegistry from "../../../../platform/theme/common/colorRegistry.js";
import { ColorScheme } from "../../../../platform/theme/common/theme.js";
import { IWorkbenchThemeService } from "../../../services/themes/common/workbenchThemeService.js";
let WebviewThemeDataProvider = class extends Disposable {
  constructor(_themeService, _configurationService) {
    super();
    this._themeService = _themeService;
    this._configurationService = _configurationService;
    this._cachedWebViewThemeData = void 0;
    this._onThemeDataChanged = this._register(new Emitter());
    this.onThemeDataChanged = this._onThemeDataChanged.event;
    this._register(this._themeService.onDidColorThemeChange(() => {
      this._reset();
    }));
    const webviewConfigurationKeys = ["editor.fontFamily", "editor.fontWeight", "editor.fontSize", "accessibility.underlineLinks"];
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (webviewConfigurationKeys.some((key) => e.affectsConfiguration(key))) {
        this._reset();
      }
    }));
  }
  getTheme() {
    return this._themeService.getColorTheme();
  }
  getWebviewThemeData() {
    if (!this._cachedWebViewThemeData) {
      const configuration = this._configurationService.getValue("editor");
      const editorFontFamily = configuration.fontFamily || EDITOR_FONT_DEFAULTS.fontFamily;
      const editorFontWeight = configuration.fontWeight || EDITOR_FONT_DEFAULTS.fontWeight;
      const editorFontSize = configuration.fontSize || EDITOR_FONT_DEFAULTS.fontSize;
      const linkUnderlines = this._configurationService.getValue("accessibility.underlineLinks");
      const theme = this._themeService.getColorTheme();
      const exportedColors = colorRegistry.getColorRegistry().getColors().reduce((colors, entry) => {
        const color = theme.getColor(entry.id);
        if (color) {
          colors["vscode-" + entry.id.replace(".", "-")] = color.toString();
        }
        return colors;
      }, {});
      const styles = {
        "vscode-font-family": DEFAULT_FONT_FAMILY,
        "vscode-font-weight": "normal",
        "vscode-font-size": "13px",
        "vscode-editor-font-family": editorFontFamily,
        "vscode-editor-font-weight": editorFontWeight,
        "vscode-editor-font-size": editorFontSize + "px",
        "text-link-decoration": linkUnderlines ? "underline" : "none",
        ...exportedColors
      };
      const activeTheme = ApiThemeClassName.fromTheme(theme);
      this._cachedWebViewThemeData = { styles, activeTheme, themeLabel: theme.label, themeId: theme.settingsId };
    }
    return this._cachedWebViewThemeData;
  }
  _reset() {
    this._cachedWebViewThemeData = void 0;
    this._onThemeDataChanged.fire();
  }
};
WebviewThemeDataProvider = __decorateClass([
  __decorateParam(0, IWorkbenchThemeService),
  __decorateParam(1, IConfigurationService)
], WebviewThemeDataProvider);
var ApiThemeClassName = /* @__PURE__ */ ((ApiThemeClassName2) => {
  ApiThemeClassName2["light"] = "vscode-light";
  ApiThemeClassName2["dark"] = "vscode-dark";
  ApiThemeClassName2["highContrast"] = "vscode-high-contrast";
  ApiThemeClassName2["highContrastLight"] = "vscode-high-contrast-light";
  return ApiThemeClassName2;
})(ApiThemeClassName || {});
((ApiThemeClassName2) => {
  function fromTheme(theme) {
    switch (theme.type) {
      case ColorScheme.LIGHT:
        return "vscode-light" /* light */;
      case ColorScheme.DARK:
        return "vscode-dark" /* dark */;
      case ColorScheme.HIGH_CONTRAST_DARK:
        return "vscode-high-contrast" /* highContrast */;
      case ColorScheme.HIGH_CONTRAST_LIGHT:
        return "vscode-high-contrast-light" /* highContrastLight */;
    }
  }
  ApiThemeClassName2.fromTheme = fromTheme;
})(ApiThemeClassName || (ApiThemeClassName = {}));
export {
  WebviewThemeDataProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWJ2aWV3L2Jyb3dzZXIvdGhlbWVpbmcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBERUZBVUxUX0ZPTlRfRkFNSUxZIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2ZvbnRzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEVESVRPUl9GT05UX0RFRkFVTFRTLCBJRWRpdG9yT3B0aW9ucyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29uZmlnL2VkaXRvck9wdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgKiBhcyBjb2xvclJlZ2lzdHJ5IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3RoZW1lL2NvbW1vbi9jb2xvclJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENvbG9yU2NoZW1lIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGhlbWUvY29tbW9uL3RoZW1lLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb2xvclRoZW1lLCBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvdGhlbWVzL2NvbW1vbi93b3JrYmVuY2hUaGVtZVNlcnZpY2UuanMnO1xuaW1wb3J0IHsgV2Vidmlld1N0eWxlcyB9IGZyb20gJy4vd2Vidmlldy5qcyc7XG5cbmludGVyZmFjZSBXZWJ2aWV3VGhlbWVEYXRhIHtcblx0cmVhZG9ubHkgYWN0aXZlVGhlbWU6IHN0cmluZztcblx0cmVhZG9ubHkgdGhlbWVMYWJlbDogc3RyaW5nO1xuXHRyZWFkb25seSB0aGVtZUlkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHN0eWxlczogUmVhZG9ubHk8V2Vidmlld1N0eWxlcz47XG59XG5cbmV4cG9ydCBjbGFzcyBXZWJ2aWV3VGhlbWVEYXRhUHJvdmlkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIF9jYWNoZWRXZWJWaWV3VGhlbWVEYXRhOiBXZWJ2aWV3VGhlbWVEYXRhIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uVGhlbWVEYXRhQ2hhbmdlZCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRwdWJsaWMgcmVhZG9ubHkgb25UaGVtZURhdGFDaGFuZ2VkID0gdGhpcy5fb25UaGVtZURhdGFDaGFuZ2VkLmV2ZW50O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJV29ya2JlbmNoVGhlbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RoZW1lU2VydmljZTogSVdvcmtiZW5jaFRoZW1lU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl90aGVtZVNlcnZpY2Uub25EaWRDb2xvclRoZW1lQ2hhbmdlKCgpID0+IHtcblx0XHRcdHRoaXMuX3Jlc2V0KCk7XG5cdFx0fSkpO1xuXG5cdFx0Y29uc3Qgd2Vidmlld0NvbmZpZ3VyYXRpb25LZXlzID0gWydlZGl0b3IuZm9udEZhbWlseScsICdlZGl0b3IuZm9udFdlaWdodCcsICdlZGl0b3IuZm9udFNpemUnLCAnYWNjZXNzaWJpbGl0eS51bmRlcmxpbmVMaW5rcyddO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlQ29uZmlndXJhdGlvbihlID0+IHtcblx0XHRcdGlmICh3ZWJ2aWV3Q29uZmlndXJhdGlvbktleXMuc29tZShrZXkgPT4gZS5hZmZlY3RzQ29uZmlndXJhdGlvbihrZXkpKSkge1xuXHRcdFx0XHR0aGlzLl9yZXNldCgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdHB1YmxpYyBnZXRUaGVtZSgpOiBJV29ya2JlbmNoQ29sb3JUaGVtZSB7XG5cdFx0cmV0dXJuIHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0V2Vidmlld1RoZW1lRGF0YSgpOiBXZWJ2aWV3VGhlbWVEYXRhIHtcblx0XHRpZiAoIXRoaXMuX2NhY2hlZFdlYlZpZXdUaGVtZURhdGEpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb24gPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxJRWRpdG9yT3B0aW9ucz4oJ2VkaXRvcicpO1xuXHRcdFx0Y29uc3QgZWRpdG9yRm9udEZhbWlseSA9IGNvbmZpZ3VyYXRpb24uZm9udEZhbWlseSB8fCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250RmFtaWx5O1xuXHRcdFx0Y29uc3QgZWRpdG9yRm9udFdlaWdodCA9IGNvbmZpZ3VyYXRpb24uZm9udFdlaWdodCB8fCBFRElUT1JfRk9OVF9ERUZBVUxUUy5mb250V2VpZ2h0O1xuXHRcdFx0Y29uc3QgZWRpdG9yRm9udFNpemUgPSBjb25maWd1cmF0aW9uLmZvbnRTaXplIHx8IEVESVRPUl9GT05UX0RFRkFVTFRTLmZvbnRTaXplO1xuXHRcdFx0Y29uc3QgbGlua1VuZGVybGluZXMgPSB0aGlzLl9jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnYWNjZXNzaWJpbGl0eS51bmRlcmxpbmVMaW5rcycpO1xuXG5cdFx0XHRjb25zdCB0aGVtZSA9IHRoaXMuX3RoZW1lU2VydmljZS5nZXRDb2xvclRoZW1lKCk7XG5cdFx0XHRjb25zdCBleHBvcnRlZENvbG9ycyA9IGNvbG9yUmVnaXN0cnkuZ2V0Q29sb3JSZWdpc3RyeSgpLmdldENvbG9ycygpLnJlZHVjZTxSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+PigoY29sb3JzLCBlbnRyeSkgPT4ge1xuXHRcdFx0XHRjb25zdCBjb2xvciA9IHRoZW1lLmdldENvbG9yKGVudHJ5LmlkKTtcblx0XHRcdFx0aWYgKGNvbG9yKSB7XG5cdFx0XHRcdFx0Y29sb3JzWyd2c2NvZGUtJyArIGVudHJ5LmlkLnJlcGxhY2UoJy4nLCAnLScpXSA9IGNvbG9yLnRvU3RyaW5nKCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGNvbG9ycztcblx0XHRcdH0sIHt9KTtcblxuXHRcdFx0Y29uc3Qgc3R5bGVzID0ge1xuXHRcdFx0XHQndnNjb2RlLWZvbnQtZmFtaWx5JzogREVGQVVMVF9GT05UX0ZBTUlMWSxcblx0XHRcdFx0J3ZzY29kZS1mb250LXdlaWdodCc6ICdub3JtYWwnLFxuXHRcdFx0XHQndnNjb2RlLWZvbnQtc2l6ZSc6ICcxM3B4Jyxcblx0XHRcdFx0J3ZzY29kZS1lZGl0b3ItZm9udC1mYW1pbHknOiBlZGl0b3JGb250RmFtaWx5LFxuXHRcdFx0XHQndnNjb2RlLWVkaXRvci1mb250LXdlaWdodCc6IGVkaXRvckZvbnRXZWlnaHQsXG5cdFx0XHRcdCd2c2NvZGUtZWRpdG9yLWZvbnQtc2l6ZSc6IGVkaXRvckZvbnRTaXplICsgJ3B4Jyxcblx0XHRcdFx0J3RleHQtbGluay1kZWNvcmF0aW9uJzogbGlua1VuZGVybGluZXMgPyAndW5kZXJsaW5lJyA6ICdub25lJyxcblx0XHRcdFx0Li4uZXhwb3J0ZWRDb2xvcnNcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IGFjdGl2ZVRoZW1lID0gQXBpVGhlbWVDbGFzc05hbWUuZnJvbVRoZW1lKHRoZW1lKTtcblx0XHRcdHRoaXMuX2NhY2hlZFdlYlZpZXdUaGVtZURhdGEgPSB7IHN0eWxlcywgYWN0aXZlVGhlbWUsIHRoZW1lTGFiZWw6IHRoZW1lLmxhYmVsLCB0aGVtZUlkOiB0aGVtZS5zZXR0aW5nc0lkIH07XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX2NhY2hlZFdlYlZpZXdUaGVtZURhdGE7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNldCgpIHtcblx0XHR0aGlzLl9jYWNoZWRXZWJWaWV3VGhlbWVEYXRhID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uVGhlbWVEYXRhQ2hhbmdlZC5maXJlKCk7XG5cdH1cbn1cblxuZW51bSBBcGlUaGVtZUNsYXNzTmFtZSB7XG5cdGxpZ2h0ID0gJ3ZzY29kZS1saWdodCcsXG5cdGRhcmsgPSAndnNjb2RlLWRhcmsnLFxuXHRoaWdoQ29udHJhc3QgPSAndnNjb2RlLWhpZ2gtY29udHJhc3QnLFxuXHRoaWdoQ29udHJhc3RMaWdodCA9ICd2c2NvZGUtaGlnaC1jb250cmFzdC1saWdodCcsXG59XG5cbm5hbWVzcGFjZSBBcGlUaGVtZUNsYXNzTmFtZSB7XG5cdGV4cG9ydCBmdW5jdGlvbiBmcm9tVGhlbWUodGhlbWU6IElXb3JrYmVuY2hDb2xvclRoZW1lKTogQXBpVGhlbWVDbGFzc05hbWUge1xuXHRcdHN3aXRjaCAodGhlbWUudHlwZSkge1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5MSUdIVDogcmV0dXJuIEFwaVRoZW1lQ2xhc3NOYW1lLmxpZ2h0O1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5EQVJLOiByZXR1cm4gQXBpVGhlbWVDbGFzc05hbWUuZGFyaztcblx0XHRcdGNhc2UgQ29sb3JTY2hlbWUuSElHSF9DT05UUkFTVF9EQVJLOiByZXR1cm4gQXBpVGhlbWVDbGFzc05hbWUuaGlnaENvbnRyYXN0O1xuXHRcdFx0Y2FzZSBDb2xvclNjaGVtZS5ISUdIX0NPTlRSQVNUX0xJR0hUOiByZXR1cm4gQXBpVGhlbWVDbGFzc05hbWUuaGlnaENvbnRyYXN0TGlnaHQ7XG5cdFx0fVxuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsZUFBZTtBQUN4QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLDRCQUE0QztBQUNyRCxTQUFTLDZCQUE2QjtBQUN0QyxZQUFZLG1CQUFtQjtBQUMvQixTQUFTLG1CQUFtQjtBQUM1QixTQUErQiw4QkFBOEI7QUFVdEQsSUFBTSwyQkFBTixjQUF1QyxXQUFXO0FBQUEsRUFPeEQsWUFDMEMsZUFDRCx1QkFDdkM7QUFDRCxVQUFNO0FBSG1DO0FBQ0Q7QUFQekMsU0FBUSwwQkFBd0Q7QUFFaEUsU0FBaUIsc0JBQXNCLEtBQUssVUFBVSxJQUFJLFFBQWMsQ0FBQztBQUN6RSxTQUFnQixxQkFBcUIsS0FBSyxvQkFBb0I7QUFRN0QsU0FBSyxVQUFVLEtBQUssY0FBYyxzQkFBc0IsTUFBTTtBQUM3RCxXQUFLLE9BQU87QUFBQSxJQUNiLENBQUMsQ0FBQztBQUVGLFVBQU0sMkJBQTJCLENBQUMscUJBQXFCLHFCQUFxQixtQkFBbUIsOEJBQThCO0FBQzdILFNBQUssVUFBVSxLQUFLLHNCQUFzQix5QkFBeUIsT0FBSztBQUN2RSxVQUFJLHlCQUF5QixLQUFLLFNBQU8sRUFBRSxxQkFBcUIsR0FBRyxDQUFDLEdBQUc7QUFDdEUsYUFBSyxPQUFPO0FBQUEsTUFDYjtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUFBLEVBRU8sV0FBaUM7QUFDdkMsV0FBTyxLQUFLLGNBQWMsY0FBYztBQUFBLEVBQ3pDO0FBQUEsRUFFTyxzQkFBd0M7QUFDOUMsUUFBSSxDQUFDLEtBQUsseUJBQXlCO0FBQ2xDLFlBQU0sZ0JBQWdCLEtBQUssc0JBQXNCLFNBQXlCLFFBQVE7QUFDbEYsWUFBTSxtQkFBbUIsY0FBYyxjQUFjLHFCQUFxQjtBQUMxRSxZQUFNLG1CQUFtQixjQUFjLGNBQWMscUJBQXFCO0FBQzFFLFlBQU0saUJBQWlCLGNBQWMsWUFBWSxxQkFBcUI7QUFDdEUsWUFBTSxpQkFBaUIsS0FBSyxzQkFBc0IsU0FBUyw4QkFBOEI7QUFFekYsWUFBTSxRQUFRLEtBQUssY0FBYyxjQUFjO0FBQy9DLFlBQU0saUJBQWlCLGNBQWMsaUJBQWlCLEVBQUUsVUFBVSxFQUFFLE9BQStCLENBQUMsUUFBUSxVQUFVO0FBQ3JILGNBQU0sUUFBUSxNQUFNLFNBQVMsTUFBTSxFQUFFO0FBQ3JDLFlBQUksT0FBTztBQUNWLGlCQUFPLFlBQVksTUFBTSxHQUFHLFFBQVEsS0FBSyxHQUFHLENBQUMsSUFBSSxNQUFNLFNBQVM7QUFBQSxRQUNqRTtBQUNBLGVBQU87QUFBQSxNQUNSLEdBQUcsQ0FBQyxDQUFDO0FBRUwsWUFBTSxTQUFTO0FBQUEsUUFDZCxzQkFBc0I7QUFBQSxRQUN0QixzQkFBc0I7QUFBQSxRQUN0QixvQkFBb0I7QUFBQSxRQUNwQiw2QkFBNkI7QUFBQSxRQUM3Qiw2QkFBNkI7QUFBQSxRQUM3QiwyQkFBMkIsaUJBQWlCO0FBQUEsUUFDNUMsd0JBQXdCLGlCQUFpQixjQUFjO0FBQUEsUUFDdkQsR0FBRztBQUFBLE1BQ0o7QUFFQSxZQUFNLGNBQWMsa0JBQWtCLFVBQVUsS0FBSztBQUNyRCxXQUFLLDBCQUEwQixFQUFFLFFBQVEsYUFBYSxZQUFZLE1BQU0sT0FBTyxTQUFTLE1BQU0sV0FBVztBQUFBLElBQzFHO0FBRUEsV0FBTyxLQUFLO0FBQUEsRUFDYjtBQUFBLEVBRVEsU0FBUztBQUNoQixTQUFLLDBCQUEwQjtBQUMvQixTQUFLLG9CQUFvQixLQUFLO0FBQUEsRUFDL0I7QUFDRDtBQXBFYSwyQkFBTjtBQUFBLEVBUUo7QUFBQSxFQUNBO0FBQUEsR0FUVTtBQXNFYixJQUFLLG9CQUFMLGtCQUFLQSx1QkFBTDtBQUNDLEVBQUFBLG1CQUFBLFdBQVE7QUFDUixFQUFBQSxtQkFBQSxVQUFPO0FBQ1AsRUFBQUEsbUJBQUEsa0JBQWU7QUFDZixFQUFBQSxtQkFBQSx1QkFBb0I7QUFKaEIsU0FBQUE7QUFBQSxHQUFBO0FBQUEsQ0FPTCxDQUFVQSx1QkFBVjtBQUNRLFdBQVMsVUFBVSxPQUFnRDtBQUN6RSxZQUFRLE1BQU0sTUFBTTtBQUFBLE1BQ25CLEtBQUssWUFBWTtBQUFPLGVBQU87QUFBQSxNQUMvQixLQUFLLFlBQVk7QUFBTSxlQUFPO0FBQUEsTUFDOUIsS0FBSyxZQUFZO0FBQW9CLGVBQU87QUFBQSxNQUM1QyxLQUFLLFlBQVk7QUFBcUIsZUFBTztBQUFBLElBQzlDO0FBQUEsRUFDRDtBQVBPLEVBQUFBLG1CQUFTO0FBQUEsR0FEUDsiLAogICJuYW1lcyI6IFsiQXBpVGhlbWVDbGFzc05hbWUiXQp9Cg==
