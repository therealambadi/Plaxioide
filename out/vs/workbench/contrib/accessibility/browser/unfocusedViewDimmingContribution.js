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
import { createStyleSheet } from "../../../../base/browser/domStylesheets.js";
import { Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { clamp } from "../../../../base/common/numbers.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { AccessibilityWorkbenchSettingId, ViewDimUnfocusedOpacityProperties } from "./accessibilityConfiguration.js";
let UnfocusedViewDimmingContribution = class extends Disposable {
  constructor(configurationService) {
    super();
    this._styleElementDisposables = void 0;
    this._register(toDisposable(() => this._removeStyleElement()));
    this._register(Event.runAndSubscribe(configurationService.onDidChangeConfiguration, (e) => {
      if (e && !e.affectsConfiguration(AccessibilityWorkbenchSettingId.DimUnfocusedEnabled) && !e.affectsConfiguration(AccessibilityWorkbenchSettingId.DimUnfocusedOpacity)) {
        return;
      }
      let cssTextContent = "";
      const enabled = ensureBoolean(configurationService.getValue(AccessibilityWorkbenchSettingId.DimUnfocusedEnabled), false);
      if (enabled) {
        const opacity = clamp(
          ensureNumber(configurationService.getValue(AccessibilityWorkbenchSettingId.DimUnfocusedOpacity), ViewDimUnfocusedOpacityProperties.Default),
          ViewDimUnfocusedOpacityProperties.Minimum,
          ViewDimUnfocusedOpacityProperties.Maximum
        );
        if (opacity !== 1) {
          const rules = /* @__PURE__ */ new Set();
          const filterRule = `filter: opacity(${opacity});`;
          rules.add(`.monaco-workbench .pane-body.integrated-terminal:not(:focus-within) .tabs-container { ${filterRule} }`);
          rules.add(`.monaco-workbench .pane-body.integrated-terminal .terminal-wrapper:not(:focus-within) { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .monaco-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .breadcrumbs-below-tabs { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .terminal-wrapper { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .settings-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .keybindings-editor { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .monaco-editor-pane-placeholder { ${filterRule} }`);
          rules.add(`.monaco-workbench .editor-instance:not(:focus-within) .gettingStartedContainer { ${filterRule} }`);
          cssTextContent = [...rules].join("\n");
        }
      }
      if (cssTextContent.length === 0) {
        this._removeStyleElement();
      } else {
        this._getStyleElement().textContent = cssTextContent;
      }
    }));
  }
  _getStyleElement() {
    if (!this._styleElement) {
      this._styleElementDisposables = new DisposableStore();
      this._styleElement = createStyleSheet(void 0, void 0, this._styleElementDisposables);
      this._styleElement.className = "accessibilityUnfocusedViewOpacity";
    }
    return this._styleElement;
  }
  _removeStyleElement() {
    this._styleElementDisposables?.dispose();
    this._styleElementDisposables = void 0;
    this._styleElement = void 0;
  }
};
UnfocusedViewDimmingContribution = __decorateClass([
  __decorateParam(0, IConfigurationService)
], UnfocusedViewDimmingContribution);
function ensureBoolean(value, defaultValue) {
  return typeof value === "boolean" ? value : defaultValue;
}
function ensureNumber(value, defaultValue) {
  return typeof value === "number" ? value : defaultValue;
}
export {
  UnfocusedViewDimmingContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvdW5mb2N1c2VkVmlld0RpbW1pbmdDb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBjcmVhdGVTdHlsZVNoZWV0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbVN0eWxlc2hlZXRzLmpzJztcbmltcG9ydCB7IEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCB0b0Rpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgY2xhbXAgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9udW1iZXJzLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQsIFZpZXdEaW1VbmZvY3VzZWRPcGFjaXR5UHJvcGVydGllcyB9IGZyb20gJy4vYWNjZXNzaWJpbGl0eUNvbmZpZ3VyYXRpb24uanMnO1xuXG5leHBvcnQgY2xhc3MgVW5mb2N1c2VkVmlld0RpbW1pbmdDb250cmlidXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHByaXZhdGUgX3N0eWxlRWxlbWVudD86IEhUTUxTdHlsZUVsZW1lbnQ7XG5cdHByaXZhdGUgX3N0eWxlRWxlbWVudERpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmUgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodG9EaXNwb3NhYmxlKCgpID0+IHRoaXMuX3JlbW92ZVN0eWxlRWxlbWVudCgpKSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmUoY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uLCBlID0+IHtcblx0XHRcdGlmIChlICYmICFlLmFmZmVjdHNDb25maWd1cmF0aW9uKEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuRGltVW5mb2N1c2VkRW5hYmxlZCkgJiYgIWUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQWNjZXNzaWJpbGl0eVdvcmtiZW5jaFNldHRpbmdJZC5EaW1VbmZvY3VzZWRPcGFjaXR5KSkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cblx0XHRcdGxldCBjc3NUZXh0Q29udGVudCA9ICcnO1xuXG5cdFx0XHRjb25zdCBlbmFibGVkID0gZW5zdXJlQm9vbGVhbihjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZShBY2Nlc3NpYmlsaXR5V29ya2JlbmNoU2V0dGluZ0lkLkRpbVVuZm9jdXNlZEVuYWJsZWQpLCBmYWxzZSk7XG5cdFx0XHRpZiAoZW5hYmxlZCkge1xuXHRcdFx0XHRjb25zdCBvcGFjaXR5ID0gY2xhbXAoXG5cdFx0XHRcdFx0ZW5zdXJlTnVtYmVyKGNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKEFjY2Vzc2liaWxpdHlXb3JrYmVuY2hTZXR0aW5nSWQuRGltVW5mb2N1c2VkT3BhY2l0eSksIFZpZXdEaW1VbmZvY3VzZWRPcGFjaXR5UHJvcGVydGllcy5EZWZhdWx0KSxcblx0XHRcdFx0XHRWaWV3RGltVW5mb2N1c2VkT3BhY2l0eVByb3BlcnRpZXMuTWluaW11bSxcblx0XHRcdFx0XHRWaWV3RGltVW5mb2N1c2VkT3BhY2l0eVByb3BlcnRpZXMuTWF4aW11bVxuXHRcdFx0XHQpO1xuXG5cdFx0XHRcdGlmIChvcGFjaXR5ICE9PSAxKSB7XG5cdFx0XHRcdFx0Ly8gVGhlc2UgZmlsdGVyIHJ1bGVzIGFyZSBtb3JlIHNwZWNpZmljIHRoYW4gbWF5IGJlIGV4cGVjdGVkIGFzIHRoZSBgZmlsdGVyYFxuXHRcdFx0XHRcdC8vIHJ1bGUgY2FuIGNhdXNlIHByb2JsZW1zIGlmIGl0J3MgdXNlZCBpbnNpZGUgdGhlIGVsZW1lbnQgbGlrZSBvbiBlZGl0b3IgaG92ZXJzXG5cdFx0XHRcdFx0Y29uc3QgcnVsZXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0XHRcdFx0XHRjb25zdCBmaWx0ZXJSdWxlID0gYGZpbHRlcjogb3BhY2l0eSgke29wYWNpdHl9KTtgO1xuXHRcdFx0XHRcdC8vIFRlcm1pbmFsIHRhYnNcblx0XHRcdFx0XHRydWxlcy5hZGQoYC5tb25hY28td29ya2JlbmNoIC5wYW5lLWJvZHkuaW50ZWdyYXRlZC10ZXJtaW5hbDpub3QoOmZvY3VzLXdpdGhpbikgLnRhYnMtY29udGFpbmVyIHsgJHtmaWx0ZXJSdWxlfSB9YCk7XG5cdFx0XHRcdFx0Ly8gVGVybWluYWxzXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAucGFuZS1ib2R5LmludGVncmF0ZWQtdGVybWluYWwgLnRlcm1pbmFsLXdyYXBwZXI6bm90KDpmb2N1cy13aXRoaW4pIHsgJHtmaWx0ZXJSdWxlfSB9YCk7XG5cdFx0XHRcdFx0Ly8gVGV4dCBlZGl0b3JzXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAuZWRpdG9yLWluc3RhbmNlOm5vdCg6Zm9jdXMtd2l0aGluKSAubW9uYWNvLWVkaXRvciB7ICR7ZmlsdGVyUnVsZX0gfWApO1xuXHRcdFx0XHRcdC8vIEJyZWFkY3J1bWJzXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAuZWRpdG9yLWluc3RhbmNlOm5vdCg6Zm9jdXMtd2l0aGluKSAuYnJlYWRjcnVtYnMtYmVsb3ctdGFicyB7ICR7ZmlsdGVyUnVsZX0gfWApO1xuXHRcdFx0XHRcdC8vIFRlcm1pbmFsIGVkaXRvcnNcblx0XHRcdFx0XHRydWxlcy5hZGQoYC5tb25hY28td29ya2JlbmNoIC5lZGl0b3ItaW5zdGFuY2U6bm90KDpmb2N1cy13aXRoaW4pIC50ZXJtaW5hbC13cmFwcGVyIHsgJHtmaWx0ZXJSdWxlfSB9YCk7XG5cdFx0XHRcdFx0Ly8gU2V0dGluZ3MgZWRpdG9yXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAuZWRpdG9yLWluc3RhbmNlOm5vdCg6Zm9jdXMtd2l0aGluKSAuc2V0dGluZ3MtZWRpdG9yIHsgJHtmaWx0ZXJSdWxlfSB9YCk7XG5cdFx0XHRcdFx0Ly8gS2V5YmluZGluZ3MgZWRpdG9yXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAuZWRpdG9yLWluc3RhbmNlOm5vdCg6Zm9jdXMtd2l0aGluKSAua2V5YmluZGluZ3MtZWRpdG9yIHsgJHtmaWx0ZXJSdWxlfSB9YCk7XG5cdFx0XHRcdFx0Ly8gRWRpdG9yIHBsYWNlaG9sZGVyIChlcnJvciBjYXNlKVxuXHRcdFx0XHRcdHJ1bGVzLmFkZChgLm1vbmFjby13b3JrYmVuY2ggLmVkaXRvci1pbnN0YW5jZTpub3QoOmZvY3VzLXdpdGhpbikgLm1vbmFjby1lZGl0b3ItcGFuZS1wbGFjZWhvbGRlciB7ICR7ZmlsdGVyUnVsZX0gfWApO1xuXHRcdFx0XHRcdC8vIFdlbGNvbWUgZWRpdG9yXG5cdFx0XHRcdFx0cnVsZXMuYWRkKGAubW9uYWNvLXdvcmtiZW5jaCAuZWRpdG9yLWluc3RhbmNlOm5vdCg6Zm9jdXMtd2l0aGluKSAuZ2V0dGluZ1N0YXJ0ZWRDb250YWluZXIgeyAke2ZpbHRlclJ1bGV9IH1gKTtcblx0XHRcdFx0XHRjc3NUZXh0Q29udGVudCA9IFsuLi5ydWxlc10uam9pbignXFxuJyk7XG5cdFx0XHRcdH1cblxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY3NzVGV4dENvbnRlbnQubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdHRoaXMuX3JlbW92ZVN0eWxlRWxlbWVudCgpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5fZ2V0U3R5bGVFbGVtZW50KCkudGV4dENvbnRlbnQgPSBjc3NUZXh0Q29udGVudDtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRTdHlsZUVsZW1lbnQoKTogSFRNTFN0eWxlRWxlbWVudCB7XG5cdFx0aWYgKCF0aGlzLl9zdHlsZUVsZW1lbnQpIHtcblx0XHRcdHRoaXMuX3N0eWxlRWxlbWVudERpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gY3JlYXRlU3R5bGVTaGVldCh1bmRlZmluZWQsIHVuZGVmaW5lZCwgdGhpcy5fc3R5bGVFbGVtZW50RGlzcG9zYWJsZXMpO1xuXHRcdFx0dGhpcy5fc3R5bGVFbGVtZW50LmNsYXNzTmFtZSA9ICdhY2Nlc3NpYmlsaXR5VW5mb2N1c2VkVmlld09wYWNpdHknO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fc3R5bGVFbGVtZW50O1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlU3R5bGVFbGVtZW50KCk6IHZvaWQge1xuXHRcdHRoaXMuX3N0eWxlRWxlbWVudERpc3Bvc2FibGVzPy5kaXNwb3NlKCk7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50RGlzcG9zYWJsZXMgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy5fc3R5bGVFbGVtZW50ID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cblxuZnVuY3Rpb24gZW5zdXJlQm9vbGVhbih2YWx1ZTogdW5rbm93biwgZGVmYXVsdFZhbHVlOiBib29sZWFuKTogYm9vbGVhbiB7XG5cdHJldHVybiB0eXBlb2YgdmFsdWUgPT09ICdib29sZWFuJyA/IHZhbHVlIDogZGVmYXVsdFZhbHVlO1xufVxuXG5mdW5jdGlvbiBlbnN1cmVOdW1iZXIodmFsdWU6IHVua25vd24sIGRlZmF1bHRWYWx1ZTogbnVtYmVyKTogbnVtYmVyIHtcblx0cmV0dXJuIHR5cGVvZiB2YWx1ZSA9PT0gJ251bWJlcicgPyB2YWx1ZSA6IGRlZmF1bHRWYWx1ZTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx3QkFBd0I7QUFDakMsU0FBUyxhQUFhO0FBQ3RCLFNBQVMsWUFBWSxpQkFBaUIsb0JBQW9CO0FBQzFELFNBQVMsYUFBYTtBQUN0QixTQUFTLDZCQUE2QjtBQUV0QyxTQUFTLGlDQUFpQyx5Q0FBeUM7QUFFNUUsSUFBTSxtQ0FBTixjQUErQyxXQUE2QztBQUFBLEVBSWxHLFlBQ3dCLHNCQUN0QjtBQUNELFVBQU07QUFMUCxTQUFRLDJCQUF3RDtBQU8vRCxTQUFLLFVBQVUsYUFBYSxNQUFNLEtBQUssb0JBQW9CLENBQUMsQ0FBQztBQUU3RCxTQUFLLFVBQVUsTUFBTSxnQkFBZ0IscUJBQXFCLDBCQUEwQixPQUFLO0FBQ3hGLFVBQUksS0FBSyxDQUFDLEVBQUUscUJBQXFCLGdDQUFnQyxtQkFBbUIsS0FBSyxDQUFDLEVBQUUscUJBQXFCLGdDQUFnQyxtQkFBbUIsR0FBRztBQUN0SztBQUFBLE1BQ0Q7QUFFQSxVQUFJLGlCQUFpQjtBQUVyQixZQUFNLFVBQVUsY0FBYyxxQkFBcUIsU0FBUyxnQ0FBZ0MsbUJBQW1CLEdBQUcsS0FBSztBQUN2SCxVQUFJLFNBQVM7QUFDWixjQUFNLFVBQVU7QUFBQSxVQUNmLGFBQWEscUJBQXFCLFNBQVMsZ0NBQWdDLG1CQUFtQixHQUFHLGtDQUFrQyxPQUFPO0FBQUEsVUFDMUksa0NBQWtDO0FBQUEsVUFDbEMsa0NBQWtDO0FBQUEsUUFDbkM7QUFFQSxZQUFJLFlBQVksR0FBRztBQUdsQixnQkFBTSxRQUFRLG9CQUFJLElBQVk7QUFDOUIsZ0JBQU0sYUFBYSxtQkFBbUIsT0FBTztBQUU3QyxnQkFBTSxJQUFJLHlGQUF5RixVQUFVLElBQUk7QUFFakgsZ0JBQU0sSUFBSSwyRkFBMkYsVUFBVSxJQUFJO0FBRW5ILGdCQUFNLElBQUksMEVBQTBFLFVBQVUsSUFBSTtBQUVsRyxnQkFBTSxJQUFJLG1GQUFtRixVQUFVLElBQUk7QUFFM0csZ0JBQU0sSUFBSSw2RUFBNkUsVUFBVSxJQUFJO0FBRXJHLGdCQUFNLElBQUksNEVBQTRFLFVBQVUsSUFBSTtBQUVwRyxnQkFBTSxJQUFJLCtFQUErRSxVQUFVLElBQUk7QUFFdkcsZ0JBQU0sSUFBSSwyRkFBMkYsVUFBVSxJQUFJO0FBRW5ILGdCQUFNLElBQUksb0ZBQW9GLFVBQVUsSUFBSTtBQUM1RywyQkFBaUIsQ0FBQyxHQUFHLEtBQUssRUFBRSxLQUFLLElBQUk7QUFBQSxRQUN0QztBQUFBLE1BRUQ7QUFFQSxVQUFJLGVBQWUsV0FBVyxHQUFHO0FBQ2hDLGFBQUssb0JBQW9CO0FBQUEsTUFDMUIsT0FBTztBQUNOLGFBQUssaUJBQWlCLEVBQUUsY0FBYztBQUFBLE1BQ3ZDO0FBQUEsSUFDRCxDQUFDLENBQUM7QUFBQSxFQUNIO0FBQUEsRUFFUSxtQkFBcUM7QUFDNUMsUUFBSSxDQUFDLEtBQUssZUFBZTtBQUN4QixXQUFLLDJCQUEyQixJQUFJLGdCQUFnQjtBQUNwRCxXQUFLLGdCQUFnQixpQkFBaUIsUUFBVyxRQUFXLEtBQUssd0JBQXdCO0FBQ3pGLFdBQUssY0FBYyxZQUFZO0FBQUEsSUFDaEM7QUFDQSxXQUFPLEtBQUs7QUFBQSxFQUNiO0FBQUEsRUFFUSxzQkFBNEI7QUFDbkMsU0FBSywwQkFBMEIsUUFBUTtBQUN2QyxTQUFLLDJCQUEyQjtBQUNoQyxTQUFLLGdCQUFnQjtBQUFBLEVBQ3RCO0FBQ0Q7QUE1RWEsbUNBQU47QUFBQSxFQUtKO0FBQUEsR0FMVTtBQStFYixTQUFTLGNBQWMsT0FBZ0IsY0FBZ0M7QUFDdEUsU0FBTyxPQUFPLFVBQVUsWUFBWSxRQUFRO0FBQzdDO0FBRUEsU0FBUyxhQUFhLE9BQWdCLGNBQThCO0FBQ25FLFNBQU8sT0FBTyxVQUFVLFdBQVcsUUFBUTtBQUM1QzsiLAogICJuYW1lcyI6IFtdCn0K
