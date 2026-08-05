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
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions as WorkbenchExtensions } from "../../../common/contributions.js";
import { IStorageService, StorageScope } from "../../../../platform/storage/common/storage.js";
import { IBrowserWorkbenchEnvironmentService } from "../../../services/environment/browser/environmentService.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ICodeEditorService } from "../../../../editor/browser/services/codeEditorService.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { WelcomeWidget } from "./welcomeWidget.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { Extensions as ConfigurationExtensions, ConfigurationScope } from "../../../../platform/configuration/common/configurationRegistry.js";
import { localize } from "../../../../nls.js";
import { applicationConfigurationNodeBase } from "../../../common/configuration.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
const configurationKey = "workbench.welcome.experimental.dialog";
let WelcomeDialogContribution = class extends Disposable {
  constructor(storageService, environmentService, configurationService, contextService, codeEditorService, instantiationService, commandService, telemetryService, openerService, editorService) {
    super();
    this.isRendered = false;
    if (!storageService.isNew(StorageScope.APPLICATION)) {
      return;
    }
    const setting = configurationService.inspect(configurationKey);
    if (!setting.value) {
      return;
    }
    const welcomeDialog = environmentService.options?.welcomeDialog;
    if (!welcomeDialog) {
      return;
    }
    this._register(editorService.onDidActiveEditorChange(() => {
      if (!this.isRendered) {
        const codeEditor = codeEditorService.getActiveCodeEditor();
        if (codeEditor?.hasModel()) {
          const scheduler = new RunOnceScheduler(() => {
            const notificationsVisible = contextService.contextMatchesRules(ContextKeyExpr.deserialize("notificationCenterVisible")) || contextService.contextMatchesRules(ContextKeyExpr.deserialize("notificationToastsVisible"));
            if (codeEditor === codeEditorService.getActiveCodeEditor() && !notificationsVisible) {
              this.isRendered = true;
              const welcomeWidget = new WelcomeWidget(
                codeEditor,
                instantiationService,
                commandService,
                telemetryService,
                openerService
              );
              welcomeWidget.render(
                welcomeDialog.title,
                welcomeDialog.message,
                welcomeDialog.buttonText,
                welcomeDialog.buttonCommand
              );
            }
          }, 3e3);
          this._register(codeEditor.onDidChangeModelContent((e) => {
            if (!this.isRendered) {
              scheduler.schedule();
            }
          }));
        }
      }
    }));
  }
};
WelcomeDialogContribution = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IBrowserWorkbenchEnvironmentService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IContextKeyService),
  __decorateParam(4, ICodeEditorService),
  __decorateParam(5, IInstantiationService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, ITelemetryService),
  __decorateParam(8, IOpenerService),
  __decorateParam(9, IEditorService)
], WelcomeDialogContribution);
Registry.as(WorkbenchExtensions.Workbench).registerWorkbenchContribution(WelcomeDialogContribution, LifecyclePhase.Eventually);
const configurationRegistry = Registry.as(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
  ...applicationConfigurationNodeBase,
  properties: {
    "workbench.welcome.experimental.dialog": {
      scope: ConfigurationScope.APPLICATION,
      type: "boolean",
      default: false,
      tags: ["experimental"],
      description: localize("workbench.welcome.dialog", "When enabled, a welcome widget is shown in the editor")
    }
  }
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi93ZWxjb21lRGlhbG9nL2Jyb3dzZXIvd2VsY29tZURpYWxvZy5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMgYXMgV29ya2JlbmNoRXh0ZW5zaW9ucywgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeSwgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2Jyb3dzZXIvZW52aXJvbm1lbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJQ29kZUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9zZXJ2aWNlcy9jb2RlRWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElDb21tYW5kU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBXZWxjb21lV2lkZ2V0IH0gZnJvbSAnLi93ZWxjb21lV2lkZ2V0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSU9wZW5lclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9vcGVuZXIvY29tbW9uL29wZW5lci5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblJlZ2lzdHJ5LCBFeHRlbnNpb25zIGFzIENvbmZpZ3VyYXRpb25FeHRlbnNpb25zLCBDb25maWd1cmF0aW9uU2NvcGUgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgYXBwbGljYXRpb25Db25maWd1cmF0aW9uTm9kZUJhc2UgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBSdW5PbmNlU2NoZWR1bGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuXG5jb25zdCBjb25maWd1cmF0aW9uS2V5ID0gJ3dvcmtiZW5jaC53ZWxjb21lLmV4cGVyaW1lbnRhbC5kaWFsb2cnO1xuXG5jbGFzcyBXZWxjb21lRGlhbG9nQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHByaXZhdGUgaXNSZW5kZXJlZCA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2Ugc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASUJyb3dzZXJXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgZW52aXJvbm1lbnRTZXJ2aWNlOiBJQnJvd3NlcldvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ29kZUVkaXRvclNlcnZpY2UgY29kZUVkaXRvclNlcnZpY2U6IElDb2RlRWRpdG9yU2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElDb21tYW5kU2VydmljZSBjb21tYW5kU2VydmljZTogSUNvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2Ugb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElFZGl0b3JTZXJ2aWNlIGVkaXRvclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRpZiAoIXN0b3JhZ2VTZXJ2aWNlLmlzTmV3KFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTikpIHtcblx0XHRcdHJldHVybjsgLy8gZG8gbm90IHNob3cgaWYgdGhpcyBpcyBub3QgdGhlIGZpcnN0IHNlc3Npb25cblx0XHR9XG5cblx0XHRjb25zdCBzZXR0aW5nID0gY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxib29sZWFuPihjb25maWd1cmF0aW9uS2V5KTtcblx0XHRpZiAoIXNldHRpbmcudmFsdWUpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCB3ZWxjb21lRGlhbG9nID0gZW52aXJvbm1lbnRTZXJ2aWNlLm9wdGlvbnM/LndlbGNvbWVEaWFsb2c7XG5cdFx0aWYgKCF3ZWxjb21lRGlhbG9nKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoZWRpdG9yU2VydmljZS5vbkRpZEFjdGl2ZUVkaXRvckNoYW5nZSgoKSA9PiB7XG5cdFx0XHRpZiAoIXRoaXMuaXNSZW5kZXJlZCkge1xuXG5cdFx0XHRcdGNvbnN0IGNvZGVFZGl0b3IgPSBjb2RlRWRpdG9yU2VydmljZS5nZXRBY3RpdmVDb2RlRWRpdG9yKCk7XG5cdFx0XHRcdGlmIChjb2RlRWRpdG9yPy5oYXNNb2RlbCgpKSB7XG5cdFx0XHRcdFx0Y29uc3Qgc2NoZWR1bGVyID0gbmV3IFJ1bk9uY2VTY2hlZHVsZXIoKCkgPT4ge1xuXHRcdFx0XHRcdFx0Y29uc3Qgbm90aWZpY2F0aW9uc1Zpc2libGUgPSBjb250ZXh0U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKCdub3RpZmljYXRpb25DZW50ZXJWaXNpYmxlJykpIHx8XG5cdFx0XHRcdFx0XHRcdGNvbnRleHRTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoJ25vdGlmaWNhdGlvblRvYXN0c1Zpc2libGUnKSk7XG5cdFx0XHRcdFx0XHRpZiAoY29kZUVkaXRvciA9PT0gY29kZUVkaXRvclNlcnZpY2UuZ2V0QWN0aXZlQ29kZUVkaXRvcigpICYmICFub3RpZmljYXRpb25zVmlzaWJsZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLmlzUmVuZGVyZWQgPSB0cnVlO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IHdlbGNvbWVXaWRnZXQgPSBuZXcgV2VsY29tZVdpZGdldChcblx0XHRcdFx0XHRcdFx0XHRjb2RlRWRpdG9yLFxuXHRcdFx0XHRcdFx0XHRcdGluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdFx0XHRcdFx0XHRcdGNvbW1hbmRTZXJ2aWNlLFxuXHRcdFx0XHRcdFx0XHRcdHRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0XHRcdFx0XHRcdFx0b3BlbmVyU2VydmljZSk7XG5cblx0XHRcdFx0XHRcdFx0d2VsY29tZVdpZGdldC5yZW5kZXIod2VsY29tZURpYWxvZy50aXRsZSxcblx0XHRcdFx0XHRcdFx0XHR3ZWxjb21lRGlhbG9nLm1lc3NhZ2UsXG5cdFx0XHRcdFx0XHRcdFx0d2VsY29tZURpYWxvZy5idXR0b25UZXh0LFxuXHRcdFx0XHRcdFx0XHRcdHdlbGNvbWVEaWFsb2cuYnV0dG9uQ29tbWFuZCk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSwgMzAwMCk7XG5cblx0XHRcdFx0XHR0aGlzLl9yZWdpc3Rlcihjb2RlRWRpdG9yLm9uRGlkQ2hhbmdlTW9kZWxDb250ZW50KChlKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoIXRoaXMuaXNSZW5kZXJlZCkge1xuXHRcdFx0XHRcdFx0XHRzY2hlZHVsZXIuc2NoZWR1bGUoKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpXG5cdC5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihXZWxjb21lRGlhbG9nQ29udHJpYnV0aW9uLCBMaWZlY3ljbGVQaGFzZS5FdmVudHVhbGx5KTtcblxuY29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbik7XG5jb25maWd1cmF0aW9uUmVnaXN0cnkucmVnaXN0ZXJDb25maWd1cmF0aW9uKHtcblx0Li4uYXBwbGljYXRpb25Db25maWd1cmF0aW9uTm9kZUJhc2UsXG5cdHByb3BlcnRpZXM6IHtcblx0XHQnd29ya2JlbmNoLndlbGNvbWUuZXhwZXJpbWVudGFsLmRpYWxvZyc6IHtcblx0XHRcdHNjb3BlOiBDb25maWd1cmF0aW9uU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRkZWZhdWx0OiBmYWxzZSxcblx0XHRcdHRhZ3M6IFsnZXhwZXJpbWVudGFsJ10sXG5cdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3dvcmtiZW5jaC53ZWxjb21lLmRpYWxvZycsIFwiV2hlbiBlbmFibGVkLCBhIHdlbGNvbWUgd2lkZ2V0IGlzIHNob3duIGluIHRoZSBlZGl0b3JcIilcblx0XHR9XG5cdH1cbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGNBQWMsMkJBQW9GO0FBQzNHLFNBQVMsaUJBQWlCLG9CQUFvQjtBQUM5QyxTQUFTLDJDQUEyQztBQUNwRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGdCQUFnQiwwQkFBMEI7QUFDbkQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyx1QkFBdUI7QUFDaEMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBaUMsY0FBYyx5QkFBeUIsMEJBQTBCO0FBQ2xHLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsd0NBQXdDO0FBQ2pELFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsc0JBQXNCO0FBRS9CLE1BQU0sbUJBQW1CO0FBRXpCLElBQU0sNEJBQU4sY0FBd0MsV0FBNkM7QUFBQSxFQUlwRixZQUNrQixnQkFDb0Isb0JBQ2Qsc0JBQ0gsZ0JBQ0EsbUJBQ0csc0JBQ04sZ0JBQ0Usa0JBQ0gsZUFDQSxlQUNmO0FBQ0QsVUFBTTtBQWRQLFNBQVEsYUFBYTtBQWdCcEIsUUFBSSxDQUFDLGVBQWUsTUFBTSxhQUFhLFdBQVcsR0FBRztBQUNwRDtBQUFBLElBQ0Q7QUFFQSxVQUFNLFVBQVUscUJBQXFCLFFBQWlCLGdCQUFnQjtBQUN0RSxRQUFJLENBQUMsUUFBUSxPQUFPO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFVBQU0sZ0JBQWdCLG1CQUFtQixTQUFTO0FBQ2xELFFBQUksQ0FBQyxlQUFlO0FBQ25CO0FBQUEsSUFDRDtBQUVBLFNBQUssVUFBVSxjQUFjLHdCQUF3QixNQUFNO0FBQzFELFVBQUksQ0FBQyxLQUFLLFlBQVk7QUFFckIsY0FBTSxhQUFhLGtCQUFrQixvQkFBb0I7QUFDekQsWUFBSSxZQUFZLFNBQVMsR0FBRztBQUMzQixnQkFBTSxZQUFZLElBQUksaUJBQWlCLE1BQU07QUFDNUMsa0JBQU0sdUJBQXVCLGVBQWUsb0JBQW9CLGVBQWUsWUFBWSwyQkFBMkIsQ0FBQyxLQUN0SCxlQUFlLG9CQUFvQixlQUFlLFlBQVksMkJBQTJCLENBQUM7QUFDM0YsZ0JBQUksZUFBZSxrQkFBa0Isb0JBQW9CLEtBQUssQ0FBQyxzQkFBc0I7QUFDcEYsbUJBQUssYUFBYTtBQUVsQixvQkFBTSxnQkFBZ0IsSUFBSTtBQUFBLGdCQUN6QjtBQUFBLGdCQUNBO0FBQUEsZ0JBQ0E7QUFBQSxnQkFDQTtBQUFBLGdCQUNBO0FBQUEsY0FBYTtBQUVkLDRCQUFjO0FBQUEsZ0JBQU8sY0FBYztBQUFBLGdCQUNsQyxjQUFjO0FBQUEsZ0JBQ2QsY0FBYztBQUFBLGdCQUNkLGNBQWM7QUFBQSxjQUFhO0FBQUEsWUFDN0I7QUFBQSxVQUNELEdBQUcsR0FBSTtBQUVQLGVBQUssVUFBVSxXQUFXLHdCQUF3QixDQUFDLE1BQU07QUFDeEQsZ0JBQUksQ0FBQyxLQUFLLFlBQVk7QUFDckIsd0JBQVUsU0FBUztBQUFBLFlBQ3BCO0FBQUEsVUFDRCxDQUFDLENBQUM7QUFBQSxRQUNIO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQyxDQUFDO0FBQUEsRUFDSDtBQUNEO0FBbEVNLDRCQUFOO0FBQUEsRUFLRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZEc7QUFvRU4sU0FBUyxHQUFvQyxvQkFBb0IsU0FBUyxFQUN4RSw4QkFBOEIsMkJBQTJCLGVBQWUsVUFBVTtBQUVwRixNQUFNLHdCQUF3QixTQUFTLEdBQTJCLHdCQUF3QixhQUFhO0FBQ3ZHLHNCQUFzQixzQkFBc0I7QUFBQSxFQUMzQyxHQUFHO0FBQUEsRUFDSCxZQUFZO0FBQUEsSUFDWCx5Q0FBeUM7QUFBQSxNQUN4QyxPQUFPLG1CQUFtQjtBQUFBLE1BQzFCLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULE1BQU0sQ0FBQyxjQUFjO0FBQUEsTUFDckIsYUFBYSxTQUFTLDRCQUE0Qix1REFBdUQ7QUFBQSxJQUMxRztBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
