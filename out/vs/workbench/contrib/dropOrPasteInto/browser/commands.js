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
import { toAction } from "../../../../base/common/actions.js";
import { CopyPasteController, pasteAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/copyPasteController.js";
import { DropIntoEditorController, dropAsPreferenceConfig } from "../../../../editor/contrib/dropOrPasteInto/browser/dropIntoEditorController.js";
import { localize } from "../../../../nls.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
let DropOrPasteIntoCommands = class {
  constructor(_preferencesService) {
    this._preferencesService = _preferencesService;
    CopyPasteController.setConfigureDefaultAction(toAction({
      id: "workbench.action.configurePreferredPasteAction",
      label: localize("configureDefaultPaste.label", "Configure preferred paste action..."),
      run: () => this.configurePreferredPasteAction()
    }));
    DropIntoEditorController.setConfigureDefaultAction(toAction({
      id: "workbench.action.configurePreferredDropAction",
      label: localize("configureDefaultDrop.label", "Configure preferred drop action..."),
      run: () => this.configurePreferredDropAction()
    }));
  }
  configurePreferredPasteAction() {
    return this._preferencesService.openUserSettings({
      jsonEditor: true,
      revealSetting: { key: pasteAsPreferenceConfig, edit: true }
    });
  }
  configurePreferredDropAction() {
    return this._preferencesService.openUserSettings({
      jsonEditor: true,
      revealSetting: { key: dropAsPreferenceConfig, edit: true }
    });
  }
};
DropOrPasteIntoCommands.ID = "workbench.contrib.dropOrPasteInto";
DropOrPasteIntoCommands = __decorateClass([
  __decorateParam(0, IPreferencesService)
], DropOrPasteIntoCommands);
export {
  DropOrPasteIntoCommands
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kcm9wT3JQYXN0ZUludG8vYnJvd3Nlci9jb21tYW5kcy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHRvQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBDb3B5UGFzdGVDb250cm9sbGVyLCBwYXN0ZUFzUHJlZmVyZW5jZUNvbmZpZyB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb250cmliL2Ryb3BPclBhc3RlSW50by9icm93c2VyL2NvcHlQYXN0ZUNvbnRyb2xsZXIuanMnO1xuaW1wb3J0IHsgRHJvcEludG9FZGl0b3JDb250cm9sbGVyLCBkcm9wQXNQcmVmZXJlbmNlQ29uZmlnIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbnRyaWIvZHJvcE9yUGFzdGVJbnRvL2Jyb3dzZXIvZHJvcEludG9FZGl0b3JDb250cm9sbGVyLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcblxuZXhwb3J0IGNsYXNzIERyb3BPclBhc3RlSW50b0NvbW1hbmRzIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cdHB1YmxpYyBzdGF0aWMgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIuZHJvcE9yUGFzdGVJbnRvJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByZWZlcmVuY2VzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9wcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2Vcblx0KSB7XG5cdFx0Q29weVBhc3RlQ29udHJvbGxlci5zZXRDb25maWd1cmVEZWZhdWx0QWN0aW9uKHRvQWN0aW9uKHtcblx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi5jb25maWd1cmVQcmVmZXJyZWRQYXN0ZUFjdGlvbicsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NvbmZpZ3VyZURlZmF1bHRQYXN0ZS5sYWJlbCcsICdDb25maWd1cmUgcHJlZmVycmVkIHBhc3RlIGFjdGlvbi4uLicpLFxuXHRcdFx0cnVuOiAoKSA9PiB0aGlzLmNvbmZpZ3VyZVByZWZlcnJlZFBhc3RlQWN0aW9uKClcblx0XHR9KSk7XG5cblx0XHREcm9wSW50b0VkaXRvckNvbnRyb2xsZXIuc2V0Q29uZmlndXJlRGVmYXVsdEFjdGlvbih0b0FjdGlvbih7XG5cdFx0XHRpZDogJ3dvcmtiZW5jaC5hY3Rpb24uY29uZmlndXJlUHJlZmVycmVkRHJvcEFjdGlvbicsXG5cdFx0XHRsYWJlbDogbG9jYWxpemUoJ2NvbmZpZ3VyZURlZmF1bHREcm9wLmxhYmVsJywgJ0NvbmZpZ3VyZSBwcmVmZXJyZWQgZHJvcCBhY3Rpb24uLi4nKSxcblx0XHRcdHJ1bjogKCkgPT4gdGhpcy5jb25maWd1cmVQcmVmZXJyZWREcm9wQWN0aW9uKClcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGNvbmZpZ3VyZVByZWZlcnJlZFBhc3RlQWN0aW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9wcmVmZXJlbmNlc1NlcnZpY2Uub3BlblVzZXJTZXR0aW5ncyh7XG5cdFx0XHRqc29uRWRpdG9yOiB0cnVlLFxuXHRcdFx0cmV2ZWFsU2V0dGluZzogeyBrZXk6IHBhc3RlQXNQcmVmZXJlbmNlQ29uZmlnLCBlZGl0OiB0cnVlIH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgY29uZmlndXJlUHJlZmVycmVkRHJvcEFjdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fcHJlZmVyZW5jZXNTZXJ2aWNlLm9wZW5Vc2VyU2V0dGluZ3Moe1xuXHRcdFx0anNvbkVkaXRvcjogdHJ1ZSxcblx0XHRcdHJldmVhbFNldHRpbmc6IHsga2V5OiBkcm9wQXNQcmVmZXJlbmNlQ29uZmlnLCBlZGl0OiB0cnVlIH1cblx0XHR9KTtcblx0fVxufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLHFCQUFxQiwrQkFBK0I7QUFDN0QsU0FBUywwQkFBMEIsOEJBQThCO0FBQ2pFLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMkJBQTJCO0FBRTdCLElBQU0sMEJBQU4sTUFBZ0U7QUFBQSxFQUd0RSxZQUN1QyxxQkFDckM7QUFEcUM7QUFFdEMsd0JBQW9CLDBCQUEwQixTQUFTO0FBQUEsTUFDdEQsSUFBSTtBQUFBLE1BQ0osT0FBTyxTQUFTLCtCQUErQixxQ0FBcUM7QUFBQSxNQUNwRixLQUFLLE1BQU0sS0FBSyw4QkFBOEI7QUFBQSxJQUMvQyxDQUFDLENBQUM7QUFFRiw2QkFBeUIsMEJBQTBCLFNBQVM7QUFBQSxNQUMzRCxJQUFJO0FBQUEsTUFDSixPQUFPLFNBQVMsOEJBQThCLG9DQUFvQztBQUFBLE1BQ2xGLEtBQUssTUFBTSxLQUFLLDZCQUE2QjtBQUFBLElBQzlDLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVRLGdDQUFnQztBQUN2QyxXQUFPLEtBQUssb0JBQW9CLGlCQUFpQjtBQUFBLE1BQ2hELFlBQVk7QUFBQSxNQUNaLGVBQWUsRUFBRSxLQUFLLHlCQUF5QixNQUFNLEtBQUs7QUFBQSxJQUMzRCxDQUFDO0FBQUEsRUFDRjtBQUFBLEVBRVEsK0JBQStCO0FBQ3RDLFdBQU8sS0FBSyxvQkFBb0IsaUJBQWlCO0FBQUEsTUFDaEQsWUFBWTtBQUFBLE1BQ1osZUFBZSxFQUFFLEtBQUssd0JBQXdCLE1BQU0sS0FBSztBQUFBLElBQzFELENBQUM7QUFBQSxFQUNGO0FBQ0Q7QUFoQ2Esd0JBQ0UsS0FBSztBQURQLDBCQUFOO0FBQUEsRUFJSjtBQUFBLEdBSlU7IiwKICAibmFtZXMiOiBbXQp9Cg==
