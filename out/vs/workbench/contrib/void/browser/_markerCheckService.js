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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { InstantiationType, registerSingleton } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IMarkerService, MarkerSeverity } from "../../../../platform/markers/common/markers.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { ITextModelService } from "../../../../editor/common/services/resolverService.js";
import { Range } from "../../../../editor/common/core/range.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CodeActionTriggerType } from "../../../../editor/common/languages.js";
import * as dom from "../../../../base/browser/dom.js";
const IMarkerCheckService = createDecorator("markerCheckService");
let MarkerCheckService = class extends Disposable {
  constructor(_markerService, _languageFeaturesService, _textModelService) {
    super();
    this._markerService = _markerService;
    this._languageFeaturesService = _languageFeaturesService;
    this._textModelService = _textModelService;
    const check = async () => {
      const allMarkers = this._markerService.read();
      const errors = allMarkers.filter((marker) => marker.severity === MarkerSeverity.Error);
      if (errors.length > 0) {
        for (const error of errors) {
          console.log(`----------------------------------------------`);
          console.log(`${error.resource.fsPath}: ${error.startLineNumber} ${error.message} ${error.severity}`);
          try {
            const modelReference = await this._textModelService.createModelReference(error.resource);
            const model = modelReference.object.textEditorModel;
            const range = new Range(
              error.startLineNumber,
              error.startColumn,
              error.endLineNumber,
              error.endColumn
            );
            const codeActionProvider = this._languageFeaturesService.codeActionProvider;
            const providers = codeActionProvider.ordered(model);
            if (providers.length > 0) {
              for (const provider of providers) {
                const context = {
                  trigger: CodeActionTriggerType.Invoke,
                  // keeping 'trigger' since it works
                  only: "quickfix"
                  // adding this to filter for quick fixes
                };
                const actions = await provider.provideCodeActions(
                  model,
                  range,
                  context,
                  CancellationToken.None
                );
                if (actions?.actions?.length) {
                  const quickFixes = actions.actions.filter((action) => action.isPreferred);
                  if (quickFixes.length > 0) {
                    console.log("Available Quick Fixes:");
                    quickFixes.forEach((action) => {
                      console.log(`- ${action.title}`);
                    });
                  }
                }
              }
            }
            modelReference.dispose();
          } catch (e) {
            console.error("Error getting quick fixes:", e);
          }
        }
      }
    };
    const { window } = dom.getActiveWindow();
    window.setInterval(check, 5e3);
  }
  fixErrorsInFiles(uris, contextSoFar) {
  }
  // private _onMarkersChanged = (changedResources: readonly URI[]): void => {
  // 	for (const resource of changedResources) {
  // 		const markers = this._markerService.read({ resource });
  // 		if (markers.length === 0) {
  // 			console.log(`${resource.fsPath}: No diagnostics`);
  // 			continue;
  // 		}
  // 		console.log(`Diagnostics for ${resource.fsPath}:`);
  // 		markers.forEach(marker => this._logMarker(marker));
  // 	}
  // };
};
MarkerCheckService = __decorateClass([
  __decorateParam(0, IMarkerService),
  __decorateParam(1, ILanguageFeaturesService),
  __decorateParam(2, ITextModelService)
], MarkerCheckService);
registerSingleton(IMarkerCheckService, MarkerCheckService, InstantiationType.Eager);
export {
  IMarkerCheckService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvX21hcmtlckNoZWNrU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAyMDI1IEdsYXNzIERldnRvb2xzLCBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMC4gU2VlIExJQ0VOU0UudHh0IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSW5zdGFudGlhdGlvblR5cGUsIHJlZ2lzdGVyU2luZ2xldG9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElNYXJrZXJTZXJ2aWNlLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IElUZXh0TW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9yZXNvbHZlclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgQ29kZUFjdGlvbkNvbnRleHQsIENvZGVBY3Rpb25UcmlnZ2VyVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vbGFuZ3VhZ2VzLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgKiBhcyBkb20gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL2RvbS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1hcmtlckNoZWNrU2VydmljZSB7XG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGNvbnN0IElNYXJrZXJDaGVja1NlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SU1hcmtlckNoZWNrU2VydmljZT4oJ21hcmtlckNoZWNrU2VydmljZScpO1xuXG5jbGFzcyBNYXJrZXJDaGVja1NlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSU1hcmtlckNoZWNrU2VydmljZSB7XG5cdF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASU1hcmtlclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWFya2VyU2VydmljZTogSU1hcmtlclNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJVGV4dE1vZGVsU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZXh0TW9kZWxTZXJ2aWNlOiBJVGV4dE1vZGVsU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHRjb25zdCBjaGVjayA9IGFzeW5jICgpID0+IHtcblx0XHRcdGNvbnN0IGFsbE1hcmtlcnMgPSB0aGlzLl9tYXJrZXJTZXJ2aWNlLnJlYWQoKTtcblx0XHRcdGNvbnN0IGVycm9ycyA9IGFsbE1hcmtlcnMuZmlsdGVyKG1hcmtlciA9PiBtYXJrZXIuc2V2ZXJpdHkgPT09IE1hcmtlclNldmVyaXR5LkVycm9yKTtcblxuXHRcdFx0aWYgKGVycm9ycy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZXJyb3Igb2YgZXJyb3JzKSB7XG5cblx0XHRcdFx0XHRjb25zb2xlLmxvZyhgLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLWApO1xuXG5cdFx0XHRcdFx0Y29uc29sZS5sb2coYCR7ZXJyb3IucmVzb3VyY2UuZnNQYXRofTogJHtlcnJvci5zdGFydExpbmVOdW1iZXJ9ICR7ZXJyb3IubWVzc2FnZX0gJHtlcnJvci5zZXZlcml0eX1gKTsgLy8gISBhbGwgZXJyb3JzIGluIHRoZSBmaWxlXG5cblx0XHRcdFx0XHR0cnkge1xuXHRcdFx0XHRcdFx0Ly8gR2V0IHRoZSB0ZXh0IG1vZGVsIGZvciB0aGUgZmlsZVxuXHRcdFx0XHRcdFx0Y29uc3QgbW9kZWxSZWZlcmVuY2UgPSBhd2FpdCB0aGlzLl90ZXh0TW9kZWxTZXJ2aWNlLmNyZWF0ZU1vZGVsUmVmZXJlbmNlKGVycm9yLnJlc291cmNlKTtcblx0XHRcdFx0XHRcdGNvbnN0IG1vZGVsID0gbW9kZWxSZWZlcmVuY2Uub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblxuXHRcdFx0XHRcdFx0Ly8gQ3JlYXRlIGEgcmFuZ2UgZnJvbSB0aGUgbWFya2VyXG5cdFx0XHRcdFx0XHRjb25zdCByYW5nZSA9IG5ldyBSYW5nZShcblx0XHRcdFx0XHRcdFx0ZXJyb3Iuc3RhcnRMaW5lTnVtYmVyLFxuXHRcdFx0XHRcdFx0XHRlcnJvci5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdFx0ZXJyb3IuZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0ZXJyb3IuZW5kQ29sdW1uXG5cdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHQvLyBHZXQgY29kZSBhY3Rpb24gcHJvdmlkZXJzIGZvciB0aGlzIG1vZGVsXG5cdFx0XHRcdFx0XHRjb25zdCBjb2RlQWN0aW9uUHJvdmlkZXIgPSB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb2RlQWN0aW9uUHJvdmlkZXI7XG5cdFx0XHRcdFx0XHRjb25zdCBwcm92aWRlcnMgPSBjb2RlQWN0aW9uUHJvdmlkZXIub3JkZXJlZChtb2RlbCk7XG5cblx0XHRcdFx0XHRcdGlmIChwcm92aWRlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0XHRcdFx0XHQvLyBSZXF1ZXN0IGNvZGUgYWN0aW9ucyBmcm9tIGVhY2ggcHJvdmlkZXJcblx0XHRcdFx0XHRcdFx0Zm9yIChjb25zdCBwcm92aWRlciBvZiBwcm92aWRlcnMpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBjb250ZXh0OiBDb2RlQWN0aW9uQ29udGV4dCA9IHtcblx0XHRcdFx0XHRcdFx0XHRcdHRyaWdnZXI6IENvZGVBY3Rpb25UcmlnZ2VyVHlwZS5JbnZva2UsIC8vIGtlZXBpbmcgJ3RyaWdnZXInIHNpbmNlIGl0IHdvcmtzXG5cdFx0XHRcdFx0XHRcdFx0XHRvbmx5OiAncXVpY2tmaXgnICAvLyBhZGRpbmcgdGhpcyB0byBmaWx0ZXIgZm9yIHF1aWNrIGZpeGVzXG5cdFx0XHRcdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGFjdGlvbnMgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlQ29kZUFjdGlvbnMoXG5cdFx0XHRcdFx0XHRcdFx0XHRtb2RlbCxcblx0XHRcdFx0XHRcdFx0XHRcdHJhbmdlLFxuXHRcdFx0XHRcdFx0XHRcdFx0Y29udGV4dCxcblx0XHRcdFx0XHRcdFx0XHRcdENhbmNlbGxhdGlvblRva2VuLk5vbmVcblx0XHRcdFx0XHRcdFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRcdFx0aWYgKGFjdGlvbnM/LmFjdGlvbnM/Lmxlbmd0aCkge1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCBxdWlja0ZpeGVzID0gYWN0aW9ucy5hY3Rpb25zLmZpbHRlcihhY3Rpb24gPT4gYWN0aW9uLmlzUHJlZmVycmVkKTsgIC8vICEgYWxsIHF1aWNrRml4ZXMgZm9yIHRoZSBlcnJvclxuXHRcdFx0XHRcdFx0XHRcdFx0Ly8gY29uc3QgcXVpY2tGaXhlc0ZvckltcG9ydHMgPSBhY3Rpb25zLmFjdGlvbnMuZmlsdGVyKGFjdGlvbiA9PiBhY3Rpb24uaXNQcmVmZXJyZWQgJiYgYWN0aW9uLnRpdGxlLmluY2x1ZGVzKCdpbXBvcnQnKSk7ICAvLyAhIGFsbCBwb3NzaWJsZSBpbXBvcnRzXG5cdFx0XHRcdFx0XHRcdFx0XHQvLyBxdWlja0ZpeGVzRm9ySW1wb3J0c1xuXG5cdFx0XHRcdFx0XHRcdFx0XHRpZiAocXVpY2tGaXhlcy5sZW5ndGggPiAwKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKCdBdmFpbGFibGUgUXVpY2sgRml4ZXM6Jyk7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdHF1aWNrRml4ZXMuZm9yRWFjaChhY3Rpb24gPT4ge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRcdGNvbnNvbGUubG9nKGAtICR7YWN0aW9uLnRpdGxlfWApO1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0Ly8gRGlzcG9zZSB0aGUgbW9kZWwgcmVmZXJlbmNlXG5cdFx0XHRcdFx0XHRtb2RlbFJlZmVyZW5jZS5kaXNwb3NlKCk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3IgZ2V0dGluZyBxdWljayBmaXhlczonLCBlKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdFx0Y29uc3QgeyB3aW5kb3cgfSA9IGRvbS5nZXRBY3RpdmVXaW5kb3coKVxuXHRcdHdpbmRvdy5zZXRJbnRlcnZhbChjaGVjaywgNTAwMCk7XG5cdH1cblxuXG5cblxuXHRmaXhFcnJvcnNJbkZpbGVzKHVyaXM6IFVSSVtdLCBjb250ZXh0U29GYXI6IFtdKSB7XG5cdFx0Ly8gY29uc3QgYWxsTWFya2VycyA9IHRoaXMuX21hcmtlclNlcnZpY2UucmVhZCgpO1xuXG5cblx0XHQvLyBjaGVjayBlcnJvcnMgaW4gZmlsZXNcblxuXG5cdFx0Ly8gZ2l2ZSBMTE0gZXJyb3JzIGluIGZpbGVzXG5cblxuXG5cdH1cblxuXHQvLyBwcml2YXRlIF9vbk1hcmtlcnNDaGFuZ2VkID0gKGNoYW5nZWRSZXNvdXJjZXM6IHJlYWRvbmx5IFVSSVtdKTogdm9pZCA9PiB7XG5cdC8vIFx0Zm9yIChjb25zdCByZXNvdXJjZSBvZiBjaGFuZ2VkUmVzb3VyY2VzKSB7XG5cdC8vIFx0XHRjb25zdCBtYXJrZXJzID0gdGhpcy5fbWFya2VyU2VydmljZS5yZWFkKHsgcmVzb3VyY2UgfSk7XG5cblx0Ly8gXHRcdGlmIChtYXJrZXJzLmxlbmd0aCA9PT0gMCkge1xuXHQvLyBcdFx0XHRjb25zb2xlLmxvZyhgJHtyZXNvdXJjZS5mc1BhdGh9OiBObyBkaWFnbm9zdGljc2ApO1xuXHQvLyBcdFx0XHRjb250aW51ZTtcblx0Ly8gXHRcdH1cblxuXHQvLyBcdFx0Y29uc29sZS5sb2coYERpYWdub3N0aWNzIGZvciAke3Jlc291cmNlLmZzUGF0aH06YCk7XG5cdC8vIFx0XHRtYXJrZXJzLmZvckVhY2gobWFya2VyID0+IHRoaXMuX2xvZ01hcmtlcihtYXJrZXIpKTtcblx0Ly8gXHR9XG5cdC8vIH07XG5cblxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJTWFya2VyQ2hlY2tTZXJ2aWNlLCBNYXJrZXJDaGVja1NlcnZpY2UsIEluc3RhbnRpYXRpb25UeXBlLkVhZ2VyKTtcbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCLHNCQUFzQjtBQUMvQyxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGFBQWE7QUFDdEIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBNEIsNkJBQTZCO0FBRXpELFlBQVksU0FBUztBQU1kLE1BQU0sc0JBQXNCLGdCQUFxQyxvQkFBb0I7QUFFNUYsSUFBTSxxQkFBTixjQUFpQyxXQUEwQztBQUFBLEVBRzFFLFlBQ2tDLGdCQUNVLDBCQUNQLG1CQUNuQztBQUNELFVBQU07QUFKMkI7QUFDVTtBQUNQO0FBR3BDLFVBQU0sUUFBUSxZQUFZO0FBQ3pCLFlBQU0sYUFBYSxLQUFLLGVBQWUsS0FBSztBQUM1QyxZQUFNLFNBQVMsV0FBVyxPQUFPLFlBQVUsT0FBTyxhQUFhLGVBQWUsS0FBSztBQUVuRixVQUFJLE9BQU8sU0FBUyxHQUFHO0FBQ3RCLG1CQUFXLFNBQVMsUUFBUTtBQUUzQixrQkFBUSxJQUFJLGdEQUFnRDtBQUU1RCxrQkFBUSxJQUFJLEdBQUcsTUFBTSxTQUFTLE1BQU0sS0FBSyxNQUFNLGVBQWUsSUFBSSxNQUFNLE9BQU8sSUFBSSxNQUFNLFFBQVEsRUFBRTtBQUVuRyxjQUFJO0FBRUgsa0JBQU0saUJBQWlCLE1BQU0sS0FBSyxrQkFBa0IscUJBQXFCLE1BQU0sUUFBUTtBQUN2RixrQkFBTSxRQUFRLGVBQWUsT0FBTztBQUdwQyxrQkFBTSxRQUFRLElBQUk7QUFBQSxjQUNqQixNQUFNO0FBQUEsY0FDTixNQUFNO0FBQUEsY0FDTixNQUFNO0FBQUEsY0FDTixNQUFNO0FBQUEsWUFDUDtBQUdBLGtCQUFNLHFCQUFxQixLQUFLLHlCQUF5QjtBQUN6RCxrQkFBTSxZQUFZLG1CQUFtQixRQUFRLEtBQUs7QUFFbEQsZ0JBQUksVUFBVSxTQUFTLEdBQUc7QUFFekIseUJBQVcsWUFBWSxXQUFXO0FBQ2pDLHNCQUFNLFVBQTZCO0FBQUEsa0JBQ2xDLFNBQVMsc0JBQXNCO0FBQUE7QUFBQSxrQkFDL0IsTUFBTTtBQUFBO0FBQUEsZ0JBQ1A7QUFFQSxzQkFBTSxVQUFVLE1BQU0sU0FBUztBQUFBLGtCQUM5QjtBQUFBLGtCQUNBO0FBQUEsa0JBQ0E7QUFBQSxrQkFDQSxrQkFBa0I7QUFBQSxnQkFDbkI7QUFFQSxvQkFBSSxTQUFTLFNBQVMsUUFBUTtBQUU3Qix3QkFBTSxhQUFhLFFBQVEsUUFBUSxPQUFPLFlBQVUsT0FBTyxXQUFXO0FBSXRFLHNCQUFJLFdBQVcsU0FBUyxHQUFHO0FBQzFCLDRCQUFRLElBQUksd0JBQXdCO0FBQ3BDLCtCQUFXLFFBQVEsWUFBVTtBQUM1Qiw4QkFBUSxJQUFJLEtBQUssT0FBTyxLQUFLLEVBQUU7QUFBQSxvQkFDaEMsQ0FBQztBQUFBLGtCQUNGO0FBQUEsZ0JBQ0Q7QUFBQSxjQUNEO0FBQUEsWUFDRDtBQUdBLDJCQUFlLFFBQVE7QUFBQSxVQUN4QixTQUFTLEdBQUc7QUFDWCxvQkFBUSxNQUFNLDhCQUE4QixDQUFDO0FBQUEsVUFDOUM7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFDQSxVQUFNLEVBQUUsT0FBTyxJQUFJLElBQUksZ0JBQWdCO0FBQ3ZDLFdBQU8sWUFBWSxPQUFPLEdBQUk7QUFBQSxFQUMvQjtBQUFBLEVBS0EsaUJBQWlCLE1BQWEsY0FBa0I7QUFBQSxFQVdoRDtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFBQTtBQUFBO0FBQUE7QUFpQkQ7QUEvR00scUJBQU47QUFBQSxFQUlHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQU5HO0FBaUhOLGtCQUFrQixxQkFBcUIsb0JBQW9CLGtCQUFrQixLQUFLOyIsCiAgIm5hbWVzIjogW10KfQo=
