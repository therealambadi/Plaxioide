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
import * as nls from "../../../../nls.js";
import * as path from "../../../../base/common/path.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { EditorContributionInstantiation, registerEditorContribution } from "../../../../editor/browser/editorExtensions.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
let LargeFileOptimizationsWarner = class extends Disposable {
  constructor(_editor, _notificationService, _configurationService) {
    super();
    this._editor = _editor;
    this._notificationService = _notificationService;
    this._configurationService = _configurationService;
    this._register(this._editor.onDidChangeModel((e) => this._update()));
    this._update();
  }
  _update() {
    const model = this._editor.getModel();
    if (!model) {
      return;
    }
    if (model.isTooLargeForTokenization()) {
      const message = nls.localize(
        {
          key: "largeFile",
          comment: [
            "Variable 0 will be a file name."
          ]
        },
        "{0}: tokenization, wrapping, folding, codelens, word highlighting and sticky scroll have been turned off for this large file in order to reduce memory usage and avoid freezing or crashing.",
        path.basename(model.uri.path)
      );
      this._notificationService.prompt(Severity.Info, message, [
        {
          label: nls.localize("removeOptimizations", "Forcefully Enable Features"),
          run: () => {
            this._configurationService.updateValue(`editor.largeFileOptimizations`, false).then(() => {
              this._notificationService.info(nls.localize("reopenFilePrompt", "Please reopen file in order for this setting to take effect."));
            }, (err) => {
              this._notificationService.error(err);
            });
          }
        }
      ], { neverShowAgain: { id: "editor.contrib.largeFileOptimizationsWarner" } });
    }
  }
};
LargeFileOptimizationsWarner.ID = "editor.contrib.largeFileOptimizationsWarner";
LargeFileOptimizationsWarner = __decorateClass([
  __decorateParam(1, INotificationService),
  __decorateParam(2, IConfigurationService)
], LargeFileOptimizationsWarner);
registerEditorContribution(LargeFileOptimizationsWarner.ID, LargeFileOptimizationsWarner, EditorContributionInstantiation.AfterFirstRender);
export {
  LargeFileOptimizationsWarner
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jb2RlRWRpdG9yL2Jyb3dzZXIvbGFyZ2VGaWxlT3B0aW1pemF0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCAqIGFzIG5scyBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0ICogYXMgcGF0aCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wYXRoLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUNvZGVFZGl0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JCcm93c2VyLmpzJztcbmltcG9ydCB7IEVkaXRvckNvbnRyaWJ1dGlvbkluc3RhbnRpYXRpb24sIHJlZ2lzdGVyRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2Jyb3dzZXIvZWRpdG9yRXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yQ29udHJpYnV0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9lZGl0b3JDb21tb24uanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTm90aWZpY2F0aW9uU2VydmljZSwgU2V2ZXJpdHkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5cbi8qKlxuICogU2hvd3MgYSBtZXNzYWdlIHdoZW4gb3BlbmluZyBhIGxhcmdlIGZpbGUgd2hpY2ggaGFzIGJlZW4gbWVtb3J5IG9wdGltaXplZCAoYW5kIGZlYXR1cmVzIGRpc2FibGVkKS5cbiAqL1xuZXhwb3J0IGNsYXNzIExhcmdlRmlsZU9wdGltaXphdGlvbnNXYXJuZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUVkaXRvckNvbnRyaWJ1dGlvbiB7XG5cblx0cHVibGljIHN0YXRpYyByZWFkb25seSBJRCA9ICdlZGl0b3IuY29udHJpYi5sYXJnZUZpbGVPcHRpbWl6YXRpb25zV2FybmVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3I6IElDb2RlRWRpdG9yLFxuXHRcdEBJTm90aWZpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9ub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9lZGl0b3Iub25EaWRDaGFuZ2VNb2RlbCgoZSkgPT4gdGhpcy5fdXBkYXRlKCkpKTtcblx0XHR0aGlzLl91cGRhdGUoKTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2VkaXRvci5nZXRNb2RlbCgpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAobW9kZWwuaXNUb29MYXJnZUZvclRva2VuaXphdGlvbigpKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gbmxzLmxvY2FsaXplKFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0a2V5OiAnbGFyZ2VGaWxlJyxcblx0XHRcdFx0XHRjb21tZW50OiBbXG5cdFx0XHRcdFx0XHQnVmFyaWFibGUgMCB3aWxsIGJlIGEgZmlsZSBuYW1lLidcblx0XHRcdFx0XHRdXG5cdFx0XHRcdH0sXG5cdFx0XHRcdFwiezB9OiB0b2tlbml6YXRpb24sIHdyYXBwaW5nLCBmb2xkaW5nLCBjb2RlbGVucywgd29yZCBoaWdobGlnaHRpbmcgYW5kIHN0aWNreSBzY3JvbGwgaGF2ZSBiZWVuIHR1cm5lZCBvZmYgZm9yIHRoaXMgbGFyZ2UgZmlsZSBpbiBvcmRlciB0byByZWR1Y2UgbWVtb3J5IHVzYWdlIGFuZCBhdm9pZCBmcmVlemluZyBvciBjcmFzaGluZy5cIixcblx0XHRcdFx0cGF0aC5iYXNlbmFtZShtb2RlbC51cmkucGF0aClcblx0XHRcdCk7XG5cblx0XHRcdHRoaXMuX25vdGlmaWNhdGlvblNlcnZpY2UucHJvbXB0KFNldmVyaXR5LkluZm8sIG1lc3NhZ2UsIFtcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoJ3JlbW92ZU9wdGltaXphdGlvbnMnLCBcIkZvcmNlZnVsbHkgRW5hYmxlIEZlYXR1cmVzXCIpLFxuXHRcdFx0XHRcdHJ1bjogKCkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUoYGVkaXRvci5sYXJnZUZpbGVPcHRpbWl6YXRpb25zYCwgZmFsc2UpLnRoZW4oKCkgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdyZW9wZW5GaWxlUHJvbXB0JywgXCJQbGVhc2UgcmVvcGVuIGZpbGUgaW4gb3JkZXIgZm9yIHRoaXMgc2V0dGluZyB0byB0YWtlIGVmZmVjdC5cIikpO1xuXHRcdFx0XHRcdFx0fSwgKGVycikgPT4ge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9ub3RpZmljYXRpb25TZXJ2aWNlLmVycm9yKGVycik7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdF0sIHsgbmV2ZXJTaG93QWdhaW46IHsgaWQ6ICdlZGl0b3IuY29udHJpYi5sYXJnZUZpbGVPcHRpbWl6YXRpb25zV2FybmVyJyB9IH0pO1xuXHRcdH1cblx0fVxufVxuXG5yZWdpc3RlckVkaXRvckNvbnRyaWJ1dGlvbihMYXJnZUZpbGVPcHRpbWl6YXRpb25zV2FybmVyLklELCBMYXJnZUZpbGVPcHRpbWl6YXRpb25zV2FybmVyLCBFZGl0b3JDb250cmlidXRpb25JbnN0YW50aWF0aW9uLkFmdGVyRmlyc3RSZW5kZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxZQUFZLFNBQVM7QUFDckIsWUFBWSxVQUFVO0FBQ3RCLFNBQVMsa0JBQWtCO0FBRTNCLFNBQVMsaUNBQWlDLGtDQUFrQztBQUU1RSxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLHNCQUFzQixnQkFBZ0I7QUFLeEMsSUFBTSwrQkFBTixjQUEyQyxXQUEwQztBQUFBLEVBSTNGLFlBQ2tCLFNBQ3NCLHNCQUNDLHVCQUN2QztBQUNELFVBQU07QUFKVztBQUNzQjtBQUNDO0FBSXhDLFNBQUssVUFBVSxLQUFLLFFBQVEsaUJBQWlCLENBQUMsTUFBTSxLQUFLLFFBQVEsQ0FBQyxDQUFDO0FBQ25FLFNBQUssUUFBUTtBQUFBLEVBQ2Q7QUFBQSxFQUVRLFVBQWdCO0FBQ3ZCLFVBQU0sUUFBUSxLQUFLLFFBQVEsU0FBUztBQUNwQyxRQUFJLENBQUMsT0FBTztBQUNYO0FBQUEsSUFDRDtBQUVBLFFBQUksTUFBTSwwQkFBMEIsR0FBRztBQUN0QyxZQUFNLFVBQVUsSUFBSTtBQUFBLFFBQ25CO0FBQUEsVUFDQyxLQUFLO0FBQUEsVUFDTCxTQUFTO0FBQUEsWUFDUjtBQUFBLFVBQ0Q7QUFBQSxRQUNEO0FBQUEsUUFDQTtBQUFBLFFBQ0EsS0FBSyxTQUFTLE1BQU0sSUFBSSxJQUFJO0FBQUEsTUFDN0I7QUFFQSxXQUFLLHFCQUFxQixPQUFPLFNBQVMsTUFBTSxTQUFTO0FBQUEsUUFDeEQ7QUFBQSxVQUNDLE9BQU8sSUFBSSxTQUFTLHVCQUF1Qiw0QkFBNEI7QUFBQSxVQUN2RSxLQUFLLE1BQU07QUFDVixpQkFBSyxzQkFBc0IsWUFBWSxpQ0FBaUMsS0FBSyxFQUFFLEtBQUssTUFBTTtBQUN6RixtQkFBSyxxQkFBcUIsS0FBSyxJQUFJLFNBQVMsb0JBQW9CLDhEQUE4RCxDQUFDO0FBQUEsWUFDaEksR0FBRyxDQUFDLFFBQVE7QUFDWCxtQkFBSyxxQkFBcUIsTUFBTSxHQUFHO0FBQUEsWUFDcEMsQ0FBQztBQUFBLFVBQ0Y7QUFBQSxRQUNEO0FBQUEsTUFDRCxHQUFHLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSw4Q0FBOEMsRUFBRSxDQUFDO0FBQUEsSUFDN0U7QUFBQSxFQUNEO0FBQ0Q7QUEvQ2EsNkJBRVcsS0FBSztBQUZoQiwrQkFBTjtBQUFBLEVBTUo7QUFBQSxFQUNBO0FBQUEsR0FQVTtBQWlEYiwyQkFBMkIsNkJBQTZCLElBQUksOEJBQThCLGdDQUFnQyxnQkFBZ0I7IiwKICAibmFtZXMiOiBbXQp9Cg==
