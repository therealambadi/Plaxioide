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
import { autorunWithStore, observableFromEvent } from "../../../../base/common/observable.js";
import { registerDiffEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { EmbeddedDiffEditorWidget } from "../../../../editor/browser/widget/diffEditor/embeddedDiffEditorWidget.js";
import { ITextResourceConfigurationService } from "../../../../editor/common/services/textResourceConfiguration.js";
import { localize } from "../../../../nls.js";
import { AccessibleViewRegistry } from "../../../../platform/accessibility/browser/accessibleViewRegistry.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { FloatingEditorClickWidget } from "../../../browser/codeeditor.js";
import { Extensions } from "../../../common/configuration.js";
import { DiffEditorAccessibilityHelp } from "./diffEditorAccessibilityHelp.js";
let DiffEditorHelperContribution = class extends Disposable {
  constructor(_diffEditor, _instantiationService, _textResourceConfigurationService, _notificationService) {
    super();
    this._diffEditor = _diffEditor;
    this._instantiationService = _instantiationService;
    this._textResourceConfigurationService = _textResourceConfigurationService;
    this._notificationService = _notificationService;
    const isEmbeddedDiffEditor = this._diffEditor instanceof EmbeddedDiffEditorWidget;
    if (!isEmbeddedDiffEditor) {
      const computationResult = observableFromEvent(this, (e) => this._diffEditor.onDidUpdateDiff(e), () => (
        /** @description diffEditor.diffComputationResult */
        this._diffEditor.getDiffComputationResult()
      ));
      const onlyWhiteSpaceChange = computationResult.map((r) => r && !r.identical && r.changes2.length === 0);
      this._register(autorunWithStore((reader, store) => {
        if (onlyWhiteSpaceChange.read(reader)) {
          const helperWidget = store.add(this._instantiationService.createInstance(
            FloatingEditorClickWidget,
            this._diffEditor.getModifiedEditor(),
            localize("hintWhitespace", "Show Whitespace Differences"),
            null
          ));
          store.add(helperWidget.onClick(() => {
            this._textResourceConfigurationService.updateValue(this._diffEditor.getModel().modified.uri, "diffEditor.ignoreTrimWhitespace", false);
          }));
          helperWidget.render();
        }
      }));
      this._register(this._diffEditor.onDidUpdateDiff(() => {
        const diffComputationResult = this._diffEditor.getDiffComputationResult();
        if (diffComputationResult && diffComputationResult.quitEarly) {
          this._notificationService.prompt(
            Severity.Warning,
            localize("hintTimeout", "The diff algorithm was stopped early (after {0} ms.)", this._diffEditor.maxComputationTime),
            [{
              label: localize("removeTimeout", "Remove Limit"),
              run: () => {
                this._textResourceConfigurationService.updateValue(this._diffEditor.getModel().modified.uri, "diffEditor.maxComputationTime", 0);
              }
            }],
            {}
          );
        }
      }));
    }
  }
};
DiffEditorHelperContribution.ID = "editor.contrib.diffEditorHelper";
DiffEditorHelperContribution = __decorateClass([
  __decorateParam(1, IInstantiationService),
  __decorateParam(2, ITextResourceConfigurationService),
  __decorateParam(3, INotificationService)
], DiffEditorHelperContribution);
registerDiffEditorContribution(DiffEditorHelperContribution.ID, DiffEditorHelperContribution);
Registry.as(Extensions.ConfigurationMigration).registerConfigurationMigrations([{
  key: "diffEditor.experimental.collapseUnchangedRegions",
  migrateFn: (value, accessor) => {
    return [
      ["diffEditor.hideUnchangedRegions.enabled", { value }],
      ["diffEditor.experimental.collapseUnchangedRegions", { value: void 0 }]
    ];
  }
}]);
AccessibleViewRegistry.register(new DiffEditorAccessibilityHelp());
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvZGlmZkVkaXRvckhlbHBlci50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1bldpdGhTdG9yZSwgb2JzZXJ2YWJsZUZyb21FdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSURpZmZFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyRGlmZkVkaXRvckNvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9icm93c2VyL2VkaXRvckV4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRW1iZWRkZWREaWZmRWRpdG9yV2lkZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvd2lkZ2V0L2RpZmZFZGl0b3IvZW1iZWRkZWREaWZmRWRpdG9yV2lkZ2V0LmpzJztcbmltcG9ydCB7IElEaWZmRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSVRleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy90ZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEFjY2Vzc2libGVWaWV3UmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY2Nlc3NpYmlsaXR5L2Jyb3dzZXIvYWNjZXNzaWJsZVZpZXdSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlLCBTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL25vdGlmaWNhdGlvbi9jb21tb24vbm90aWZpY2F0aW9uLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEZsb2F0aW5nRWRpdG9yQ2xpY2tXaWRnZXQgfSBmcm9tICcuLi8uLi8uLi9icm93c2VyL2NvZGVlZGl0b3IuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25NaWdyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IERpZmZFZGl0b3JBY2Nlc3NpYmlsaXR5SGVscCB9IGZyb20gJy4vZGlmZkVkaXRvckFjY2Vzc2liaWxpdHlIZWxwLmpzJztcblxuY2xhc3MgRGlmZkVkaXRvckhlbHBlckNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRGlmZkVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgcmVhZG9ubHkgSUQgPSAnZWRpdG9yLmNvbnRyaWIuZGlmZkVkaXRvckhlbHBlcic7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlmZkVkaXRvcjogSURpZmZFZGl0b3IsXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9pbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdGV4dFJlc291cmNlQ29uZmlndXJhdGlvblNlcnZpY2U6IElUZXh0UmVzb3VyY2VDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBpc0VtYmVkZGVkRGlmZkVkaXRvciA9IHRoaXMuX2RpZmZFZGl0b3IgaW5zdGFuY2VvZiBFbWJlZGRlZERpZmZFZGl0b3JXaWRnZXQ7XG5cblx0XHRpZiAoIWlzRW1iZWRkZWREaWZmRWRpdG9yKSB7XG5cdFx0XHRjb25zdCBjb21wdXRhdGlvblJlc3VsdCA9IG9ic2VydmFibGVGcm9tRXZlbnQodGhpcywgZSA9PiB0aGlzLl9kaWZmRWRpdG9yLm9uRGlkVXBkYXRlRGlmZihlKSwgKCkgPT4gLyoqIEBkZXNjcmlwdGlvbiBkaWZmRWRpdG9yLmRpZmZDb21wdXRhdGlvblJlc3VsdCAqLyB0aGlzLl9kaWZmRWRpdG9yLmdldERpZmZDb21wdXRhdGlvblJlc3VsdCgpKTtcblx0XHRcdGNvbnN0IG9ubHlXaGl0ZVNwYWNlQ2hhbmdlID0gY29tcHV0YXRpb25SZXN1bHQubWFwKHIgPT4gciAmJiAhci5pZGVudGljYWwgJiYgci5jaGFuZ2VzMi5sZW5ndGggPT09IDApO1xuXG5cdFx0XHR0aGlzLl9yZWdpc3RlcihhdXRvcnVuV2l0aFN0b3JlKChyZWFkZXIsIHN0b3JlKSA9PiB7XG5cdFx0XHRcdC8qKiBAZGVzY3JpcHRpb24gdXBkYXRlIHN0YXRlICovXG5cdFx0XHRcdGlmIChvbmx5V2hpdGVTcGFjZUNoYW5nZS5yZWFkKHJlYWRlcikpIHtcblx0XHRcdFx0XHRjb25zdCBoZWxwZXJXaWRnZXQgPSBzdG9yZS5hZGQodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoXG5cdFx0XHRcdFx0XHRGbG9hdGluZ0VkaXRvckNsaWNrV2lkZ2V0LFxuXHRcdFx0XHRcdFx0dGhpcy5fZGlmZkVkaXRvci5nZXRNb2RpZmllZEVkaXRvcigpLFxuXHRcdFx0XHRcdFx0bG9jYWxpemUoJ2hpbnRXaGl0ZXNwYWNlJywgXCJTaG93IFdoaXRlc3BhY2UgRGlmZmVyZW5jZXNcIiksXG5cdFx0XHRcdFx0XHRudWxsXG5cdFx0XHRcdFx0KSk7XG5cdFx0XHRcdFx0c3RvcmUuYWRkKGhlbHBlcldpZGdldC5vbkNsaWNrKCgpID0+IHtcblx0XHRcdFx0XHRcdHRoaXMuX3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHRoaXMuX2RpZmZFZGl0b3IuZ2V0TW9kZWwoKSEubW9kaWZpZWQudXJpLCAnZGlmZkVkaXRvci5pZ25vcmVUcmltV2hpdGVzcGFjZScsIGZhbHNlKTtcblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdFx0aGVscGVyV2lkZ2V0LnJlbmRlcigpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KSk7XG5cblx0XHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2RpZmZFZGl0b3Iub25EaWRVcGRhdGVEaWZmKCgpID0+IHtcblx0XHRcdFx0Y29uc3QgZGlmZkNvbXB1dGF0aW9uUmVzdWx0ID0gdGhpcy5fZGlmZkVkaXRvci5nZXREaWZmQ29tcHV0YXRpb25SZXN1bHQoKTtcblxuXHRcdFx0XHRpZiAoZGlmZkNvbXB1dGF0aW9uUmVzdWx0ICYmIGRpZmZDb21wdXRhdGlvblJlc3VsdC5xdWl0RWFybHkpIHtcblx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLnByb21wdChcblx0XHRcdFx0XHRcdFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRcdFx0XHRsb2NhbGl6ZSgnaGludFRpbWVvdXQnLCBcIlRoZSBkaWZmIGFsZ29yaXRobSB3YXMgc3RvcHBlZCBlYXJseSAoYWZ0ZXIgezB9IG1zLilcIiwgdGhpcy5fZGlmZkVkaXRvci5tYXhDb21wdXRhdGlvblRpbWUpLFxuXHRcdFx0XHRcdFx0W3tcblx0XHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdyZW1vdmVUaW1lb3V0JywgXCJSZW1vdmUgTGltaXRcIiksXG5cdFx0XHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdHRoaXMuX3RleHRSZXNvdXJjZUNvbmZpZ3VyYXRpb25TZXJ2aWNlLnVwZGF0ZVZhbHVlKHRoaXMuX2RpZmZFZGl0b3IuZ2V0TW9kZWwoKSEubW9kaWZpZWQudXJpLCAnZGlmZkVkaXRvci5tYXhDb21wdXRhdGlvblRpbWUnLCAwKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0XHR7fVxuXHRcdFx0XHRcdCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pKTtcblx0XHR9XG5cdH1cbn1cblxucmVnaXN0ZXJEaWZmRWRpdG9yQ29udHJpYnV0aW9uKERpZmZFZGl0b3JIZWxwZXJDb250cmlidXRpb24uSUQsIERpZmZFZGl0b3JIZWxwZXJDb250cmlidXRpb24pO1xuXG5SZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvbk1pZ3JhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb25NaWdyYXRpb24pXG5cdC5yZWdpc3RlckNvbmZpZ3VyYXRpb25NaWdyYXRpb25zKFt7XG5cdFx0a2V5OiAnZGlmZkVkaXRvci5leHBlcmltZW50YWwuY29sbGFwc2VVbmNoYW5nZWRSZWdpb25zJyxcblx0XHRtaWdyYXRlRm46ICh2YWx1ZSwgYWNjZXNzb3IpID0+IHtcblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFsnZGlmZkVkaXRvci5oaWRlVW5jaGFuZ2VkUmVnaW9ucy5lbmFibGVkJywgeyB2YWx1ZSB9XSxcblx0XHRcdFx0WydkaWZmRWRpdG9yLmV4cGVyaW1lbnRhbC5jb2xsYXBzZVVuY2hhbmdlZFJlZ2lvbnMnLCB7IHZhbHVlOiB1bmRlZmluZWQgfV1cblx0XHRcdF07XG5cdFx0fVxuXHR9XSk7XG5BY2Nlc3NpYmxlVmlld1JlZ2lzdHJ5LnJlZ2lzdGVyKG5ldyBEaWZmRWRpdG9yQWNjZXNzaWJpbGl0eUhlbHAoKSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsa0JBQWtCLDJCQUEyQjtBQUV0RCxTQUFTLHNDQUFzQztBQUMvQyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLHlDQUF5QztBQUNsRCxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQixnQkFBZ0I7QUFDL0MsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxpQ0FBaUM7QUFDMUMsU0FBUyxrQkFBbUQ7QUFDNUQsU0FBUyxtQ0FBbUM7QUFFNUMsSUFBTSwrQkFBTixjQUEyQyxXQUE4QztBQUFBLEVBR3hGLFlBQ2tCLGFBQ3VCLHVCQUNZLG1DQUNiLHNCQUN0QztBQUNELFVBQU07QUFMVztBQUN1QjtBQUNZO0FBQ2I7QUFJdkMsVUFBTSx1QkFBdUIsS0FBSyx1QkFBdUI7QUFFekQsUUFBSSxDQUFDLHNCQUFzQjtBQUMxQixZQUFNLG9CQUFvQixvQkFBb0IsTUFBTSxPQUFLLEtBQUssWUFBWSxnQkFBZ0IsQ0FBQyxHQUFHO0FBQUE7QUFBQSxRQUEyRCxLQUFLLFlBQVkseUJBQXlCO0FBQUEsT0FBQztBQUNwTSxZQUFNLHVCQUF1QixrQkFBa0IsSUFBSSxPQUFLLEtBQUssQ0FBQyxFQUFFLGFBQWEsRUFBRSxTQUFTLFdBQVcsQ0FBQztBQUVwRyxXQUFLLFVBQVUsaUJBQWlCLENBQUMsUUFBUSxVQUFVO0FBRWxELFlBQUkscUJBQXFCLEtBQUssTUFBTSxHQUFHO0FBQ3RDLGdCQUFNLGVBQWUsTUFBTSxJQUFJLEtBQUssc0JBQXNCO0FBQUEsWUFDekQ7QUFBQSxZQUNBLEtBQUssWUFBWSxrQkFBa0I7QUFBQSxZQUNuQyxTQUFTLGtCQUFrQiw2QkFBNkI7QUFBQSxZQUN4RDtBQUFBLFVBQ0QsQ0FBQztBQUNELGdCQUFNLElBQUksYUFBYSxRQUFRLE1BQU07QUFDcEMsaUJBQUssa0NBQWtDLFlBQVksS0FBSyxZQUFZLFNBQVMsRUFBRyxTQUFTLEtBQUssbUNBQW1DLEtBQUs7QUFBQSxVQUN2SSxDQUFDLENBQUM7QUFDRix1QkFBYSxPQUFPO0FBQUEsUUFDckI7QUFBQSxNQUNELENBQUMsQ0FBQztBQUVGLFdBQUssVUFBVSxLQUFLLFlBQVksZ0JBQWdCLE1BQU07QUFDckQsY0FBTSx3QkFBd0IsS0FBSyxZQUFZLHlCQUF5QjtBQUV4RSxZQUFJLHlCQUF5QixzQkFBc0IsV0FBVztBQUM3RCxlQUFLLHFCQUFxQjtBQUFBLFlBQ3pCLFNBQVM7QUFBQSxZQUNULFNBQVMsZUFBZSx3REFBd0QsS0FBSyxZQUFZLGtCQUFrQjtBQUFBLFlBQ25ILENBQUM7QUFBQSxjQUNBLE9BQU8sU0FBUyxpQkFBaUIsY0FBYztBQUFBLGNBQy9DLEtBQUssTUFBTTtBQUNWLHFCQUFLLGtDQUFrQyxZQUFZLEtBQUssWUFBWSxTQUFTLEVBQUcsU0FBUyxLQUFLLGlDQUFpQyxDQUFDO0FBQUEsY0FDakk7QUFBQSxZQUNELENBQUM7QUFBQSxZQUNELENBQUM7QUFBQSxVQUNGO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FBQyxDQUFDO0FBQUEsSUFDSDtBQUFBLEVBQ0Q7QUFDRDtBQXBETSw2QkFDa0IsS0FBSztBQUR2QiwrQkFBTjtBQUFBLEVBS0c7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBUEc7QUFzRE4sK0JBQStCLDZCQUE2QixJQUFJLDRCQUE0QjtBQUU1RixTQUFTLEdBQW9DLFdBQVcsc0JBQXNCLEVBQzVFLGdDQUFnQyxDQUFDO0FBQUEsRUFDakMsS0FBSztBQUFBLEVBQ0wsV0FBVyxDQUFDLE9BQU8sYUFBYTtBQUMvQixXQUFPO0FBQUEsTUFDTixDQUFDLDJDQUEyQyxFQUFFLE1BQU0sQ0FBQztBQUFBLE1BQ3JELENBQUMsb0RBQW9ELEVBQUUsT0FBTyxPQUFVLENBQUM7QUFBQSxJQUMxRTtBQUFBLEVBQ0Q7QUFDRCxDQUFDLENBQUM7QUFDSCx1QkFBdUIsU0FBUyxJQUFJLDRCQUE0QixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
