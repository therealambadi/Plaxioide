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
import { Action } from "../../../../base/common/actions.js";
import { URI } from "../../../../base/common/uri.js";
import { getIconClasses } from "../../../../editor/common/services/getIconClasses.js";
import { IModelService } from "../../../../editor/common/services/model.js";
import { ILanguageService } from "../../../../editor/common/languages/language.js";
import * as nls from "../../../../nls.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { IPreferencesService } from "../../../services/preferences/common/preferences.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { EditorExtensionsRegistry } from "../../../../editor/browser/editorExtensions.js";
import { MenuId, MenuRegistry, isIMenuItem } from "../../../../platform/actions/common/actions.js";
import { IKeybindingService } from "../../../../platform/keybinding/common/keybinding.js";
import { isLocalizedString } from "../../../../platform/action/common/action.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { KeybindingsRegistry } from "../../../../platform/keybinding/common/keybindingsRegistry.js";
let ConfigureLanguageBasedSettingsAction = class extends Action {
  constructor(id, label, modelService, languageService, quickInputService, preferencesService) {
    super(id, label);
    this.modelService = modelService;
    this.languageService = languageService;
    this.quickInputService = quickInputService;
    this.preferencesService = preferencesService;
  }
  async run() {
    const languages = this.languageService.getSortedRegisteredLanguageNames();
    const picks = languages.map(({ languageName, languageId }) => {
      const description = nls.localize("languageDescriptionConfigured", "({0})", languageId);
      let fakeResource;
      const extensions = this.languageService.getExtensions(languageId);
      if (extensions.length) {
        fakeResource = URI.file(extensions[0]);
      } else {
        const filenames = this.languageService.getFilenames(languageId);
        if (filenames.length) {
          fakeResource = URI.file(filenames[0]);
        }
      }
      return {
        label: languageName,
        iconClasses: getIconClasses(this.modelService, this.languageService, fakeResource),
        description
      };
    });
    await this.quickInputService.pick(picks, { placeHolder: nls.localize("pickLanguage", "Select Language") }).then((pick) => {
      if (pick) {
        const languageId = this.languageService.getLanguageIdByLanguageName(pick.label);
        if (typeof languageId === "string") {
          return this.preferencesService.openLanguageSpecificSettings(languageId);
        }
      }
      return void 0;
    });
  }
};
ConfigureLanguageBasedSettingsAction.ID = "workbench.action.configureLanguageBasedSettings";
ConfigureLanguageBasedSettingsAction.LABEL = nls.localize2("configureLanguageBasedSettings", "Configure Language Specific Settings...");
ConfigureLanguageBasedSettingsAction = __decorateClass([
  __decorateParam(2, IModelService),
  __decorateParam(3, ILanguageService),
  __decorateParam(4, IQuickInputService),
  __decorateParam(5, IPreferencesService)
], ConfigureLanguageBasedSettingsAction);
CommandsRegistry.registerCommand({
  id: "_getAllSettings",
  handler: () => {
    const configRegistry = Registry.as(Extensions.Configuration);
    const allSettings = configRegistry.getConfigurationProperties();
    return allSettings;
  }
});
CommandsRegistry.registerCommand("_getAllCommands", function(accessor, filterByPrecondition) {
  const keybindingService = accessor.get(IKeybindingService);
  const contextKeyService = accessor.get(IContextKeyService);
  const actions = [];
  for (const editorAction of EditorExtensionsRegistry.getEditorActions()) {
    const keybinding = keybindingService.lookupKeybinding(editorAction.id);
    if (filterByPrecondition && !contextKeyService.contextMatchesRules(editorAction.precondition)) {
      continue;
    }
    actions.push({
      command: editorAction.id,
      label: editorAction.label,
      description: isLocalizedString(editorAction.metadata?.description) ? editorAction.metadata.description.value : editorAction.metadata?.description,
      precondition: editorAction.precondition?.serialize(),
      keybinding: keybinding?.getLabel() ?? "Not set"
    });
  }
  for (const menuItem of MenuRegistry.getMenuItems(MenuId.CommandPalette)) {
    if (isIMenuItem(menuItem)) {
      if (filterByPrecondition && !contextKeyService.contextMatchesRules(menuItem.when)) {
        continue;
      }
      const title = typeof menuItem.command.title === "string" ? menuItem.command.title : menuItem.command.title.value;
      const category = menuItem.command.category ? typeof menuItem.command.category === "string" ? menuItem.command.category : menuItem.command.category.value : void 0;
      const label = category ? `${category}: ${title}` : title;
      const description = isLocalizedString(menuItem.command.metadata?.description) ? menuItem.command.metadata.description.value : menuItem.command.metadata?.description;
      const keybinding = keybindingService.lookupKeybinding(menuItem.command.id);
      actions.push({
        command: menuItem.command.id,
        label,
        description,
        precondition: menuItem.when?.serialize(),
        keybinding: keybinding?.getLabel() ?? "Not set"
      });
    }
  }
  for (const command of KeybindingsRegistry.getDefaultKeybindings()) {
    if (filterByPrecondition && !contextKeyService.contextMatchesRules(command.when ?? void 0)) {
      continue;
    }
    const keybinding = keybindingService.lookupKeybinding(command.command ?? "");
    if (!keybinding) {
      continue;
    }
    if (actions.some((a) => a.command === command.command)) {
      continue;
    }
    actions.push({
      command: command.command ?? "",
      label: command.command ?? "",
      keybinding: keybinding?.getLabel() ?? "Not set",
      precondition: command.when?.serialize()
    });
  }
  return actions;
});
export {
  ConfigureLanguageBasedSettingsAction
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9wcmVmZXJlbmNlcy9icm93c2VyL3ByZWZlcmVuY2VzQWN0aW9ucy50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IEFjdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdldEljb25DbGFzc2VzIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9nZXRJY29uQ2xhc3Nlcy5qcyc7XG5pbXBvcnQgeyBJTW9kZWxTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMvbGFuZ3VhZ2UuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJUXVpY2tJbnB1dFNlcnZpY2UsIElRdWlja1BpY2tJdGVtIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcXVpY2tpbnB1dC9jb21tb24vcXVpY2tJbnB1dC5qcyc7XG5pbXBvcnQgeyBJUHJlZmVyZW5jZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvcHJlZmVyZW5jZXMvY29tbW9uL3ByZWZlcmVuY2VzLmpzJztcbmltcG9ydCB7IENvbW1hbmRzUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbmZpZ3VyYXRpb24vY29tbW9uL2NvbmZpZ3VyYXRpb25SZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBFZGl0b3JFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvYnJvd3Nlci9lZGl0b3JFeHRlbnNpb25zLmpzJztcbmltcG9ydCB7IE1lbnVJZCwgTWVudVJlZ2lzdHJ5LCBpc0lNZW51SXRlbSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUtleWJpbmRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0va2V5YmluZGluZy9jb21tb24va2V5YmluZGluZy5qcyc7XG5pbXBvcnQgeyBpc0xvY2FsaXplZFN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgS2V5YmluZGluZ3NSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2tleWJpbmRpbmcvY29tbW9uL2tleWJpbmRpbmdzUmVnaXN0cnkuanMnO1xuXG5leHBvcnQgY2xhc3MgQ29uZmlndXJlTGFuZ3VhZ2VCYXNlZFNldHRpbmdzQWN0aW9uIGV4dGVuZHMgQWN0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmFjdGlvbi5jb25maWd1cmVMYW5ndWFnZUJhc2VkU2V0dGluZ3MnO1xuXHRzdGF0aWMgcmVhZG9ubHkgTEFCRUwgPSBubHMubG9jYWxpemUyKCdjb25maWd1cmVMYW5ndWFnZUJhc2VkU2V0dGluZ3MnLCBcIkNvbmZpZ3VyZSBMYW5ndWFnZSBTcGVjaWZpYyBTZXR0aW5ncy4uLlwiKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRpZDogc3RyaW5nLFxuXHRcdGxhYmVsOiBzdHJpbmcsXG5cdFx0QElNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBtb2RlbFNlcnZpY2U6IElNb2RlbFNlcnZpY2UsXG5cdFx0QElMYW5ndWFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsYW5ndWFnZVNlcnZpY2U6IElMYW5ndWFnZVNlcnZpY2UsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHF1aWNrSW5wdXRTZXJ2aWNlOiBJUXVpY2tJbnB1dFNlcnZpY2UsXG5cdFx0QElQcmVmZXJlbmNlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBwcmVmZXJlbmNlc1NlcnZpY2U6IElQcmVmZXJlbmNlc1NlcnZpY2Vcblx0KSB7XG5cdFx0c3VwZXIoaWQsIGxhYmVsKTtcblx0fVxuXG5cdG92ZXJyaWRlIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBsYW5ndWFnZXMgPSB0aGlzLmxhbmd1YWdlU2VydmljZS5nZXRTb3J0ZWRSZWdpc3RlcmVkTGFuZ3VhZ2VOYW1lcygpO1xuXHRcdGNvbnN0IHBpY2tzOiBJUXVpY2tQaWNrSXRlbVtdID0gbGFuZ3VhZ2VzLm1hcCgoeyBsYW5ndWFnZU5hbWUsIGxhbmd1YWdlSWQgfSk6IElRdWlja1BpY2tJdGVtID0+IHtcblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uOiBzdHJpbmcgPSBubHMubG9jYWxpemUoJ2xhbmd1YWdlRGVzY3JpcHRpb25Db25maWd1cmVkJywgXCIoezB9KVwiLCBsYW5ndWFnZUlkKTtcblx0XHRcdC8vIGNvbnN0cnVjdCBhIGZha2UgcmVzb3VyY2UgdG8gYmUgYWJsZSB0byBzaG93IG5pY2UgaWNvbnMgaWYgYW55XG5cdFx0XHRsZXQgZmFrZVJlc291cmNlOiBVUkkgfCB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBleHRlbnNpb25zID0gdGhpcy5sYW5ndWFnZVNlcnZpY2UuZ2V0RXh0ZW5zaW9ucyhsYW5ndWFnZUlkKTtcblx0XHRcdGlmIChleHRlbnNpb25zLmxlbmd0aCkge1xuXHRcdFx0XHRmYWtlUmVzb3VyY2UgPSBVUkkuZmlsZShleHRlbnNpb25zWzBdKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGZpbGVuYW1lcyA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldEZpbGVuYW1lcyhsYW5ndWFnZUlkKTtcblx0XHRcdFx0aWYgKGZpbGVuYW1lcy5sZW5ndGgpIHtcblx0XHRcdFx0XHRmYWtlUmVzb3VyY2UgPSBVUkkuZmlsZShmaWxlbmFtZXNbMF0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRsYWJlbDogbGFuZ3VhZ2VOYW1lLFxuXHRcdFx0XHRpY29uQ2xhc3NlczogZ2V0SWNvbkNsYXNzZXModGhpcy5tb2RlbFNlcnZpY2UsIHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLCBmYWtlUmVzb3VyY2UpLFxuXHRcdFx0XHRkZXNjcmlwdGlvblxuXHRcdFx0fTtcblx0XHR9KTtcblxuXHRcdGF3YWl0IHRoaXMucXVpY2tJbnB1dFNlcnZpY2UucGljayhwaWNrcywgeyBwbGFjZUhvbGRlcjogbmxzLmxvY2FsaXplKCdwaWNrTGFuZ3VhZ2UnLCBcIlNlbGVjdCBMYW5ndWFnZVwiKSB9KVxuXHRcdFx0LnRoZW4ocGljayA9PiB7XG5cdFx0XHRcdGlmIChwaWNrKSB7XG5cdFx0XHRcdFx0Y29uc3QgbGFuZ3VhZ2VJZCA9IHRoaXMubGFuZ3VhZ2VTZXJ2aWNlLmdldExhbmd1YWdlSWRCeUxhbmd1YWdlTmFtZShwaWNrLmxhYmVsKTtcblx0XHRcdFx0XHRpZiAodHlwZW9mIGxhbmd1YWdlSWQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wcmVmZXJlbmNlc1NlcnZpY2Uub3Blbkxhbmd1YWdlU3BlY2lmaWNTZXR0aW5ncyhsYW5ndWFnZUlkKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHRcdH0pO1xuXG5cdH1cbn1cblxuLy8gUmVnaXN0ZXIgYSBjb21tYW5kIHRoYXQgZ2V0cyBhbGwgc2V0dGluZ3NcbkNvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0aWQ6ICdfZ2V0QWxsU2V0dGluZ3MnLFxuXHRoYW5kbGVyOiAoKSA9PiB7XG5cdFx0Y29uc3QgY29uZmlnUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJQ29uZmlndXJhdGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkNvbmZpZ3VyYXRpb24pO1xuXHRcdGNvbnN0IGFsbFNldHRpbmdzID0gY29uZmlnUmVnaXN0cnkuZ2V0Q29uZmlndXJhdGlvblByb3BlcnRpZXMoKTtcblx0XHRyZXR1cm4gYWxsU2V0dGluZ3M7XG5cdH1cbn0pO1xuXG4vLyNyZWdpb24gLS0tIFJlZ2lzdGVyIGEgY29tbWFuZCB0byBnZXQgYWxsIGFjdGlvbnMgZnJvbSB0aGUgY29tbWFuZCBwYWxldHRlXG5Db21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCgnX2dldEFsbENvbW1hbmRzJywgZnVuY3Rpb24gKGFjY2Vzc29yLCBmaWx0ZXJCeVByZWNvbmRpdGlvbj86IGJvb2xlYW4pIHtcblx0Y29uc3Qga2V5YmluZGluZ1NlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUtleWJpbmRpbmdTZXJ2aWNlKTtcblx0Y29uc3QgY29udGV4dEtleVNlcnZpY2UgPSBhY2Nlc3Nvci5nZXQoSUNvbnRleHRLZXlTZXJ2aWNlKTtcblx0Y29uc3QgYWN0aW9uczogeyBjb21tYW5kOiBzdHJpbmc7IGxhYmVsOiBzdHJpbmc7IGtleWJpbmRpbmc6IHN0cmluZzsgZGVzY3JpcHRpb24/OiBzdHJpbmc7IHByZWNvbmRpdGlvbj86IHN0cmluZyB9W10gPSBbXTtcblx0Zm9yIChjb25zdCBlZGl0b3JBY3Rpb24gb2YgRWRpdG9yRXh0ZW5zaW9uc1JlZ2lzdHJ5LmdldEVkaXRvckFjdGlvbnMoKSkge1xuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGVkaXRvckFjdGlvbi5pZCk7XG5cdFx0aWYgKGZpbHRlckJ5UHJlY29uZGl0aW9uICYmICFjb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKGVkaXRvckFjdGlvbi5wcmVjb25kaXRpb24pKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNvbW1hbmQ6IGVkaXRvckFjdGlvbi5pZCxcblx0XHRcdGxhYmVsOiBlZGl0b3JBY3Rpb24ubGFiZWwsXG5cdFx0XHRkZXNjcmlwdGlvbjogaXNMb2NhbGl6ZWRTdHJpbmcoZWRpdG9yQWN0aW9uLm1ldGFkYXRhPy5kZXNjcmlwdGlvbikgPyBlZGl0b3JBY3Rpb24ubWV0YWRhdGEuZGVzY3JpcHRpb24udmFsdWUgOiBlZGl0b3JBY3Rpb24ubWV0YWRhdGE/LmRlc2NyaXB0aW9uLFxuXHRcdFx0cHJlY29uZGl0aW9uOiBlZGl0b3JBY3Rpb24ucHJlY29uZGl0aW9uPy5zZXJpYWxpemUoKSxcblx0XHRcdGtleWJpbmRpbmc6IGtleWJpbmRpbmc/LmdldExhYmVsKCkgPz8gJ05vdCBzZXQnXG5cdFx0fSk7XG5cdH1cblx0Zm9yIChjb25zdCBtZW51SXRlbSBvZiBNZW51UmVnaXN0cnkuZ2V0TWVudUl0ZW1zKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSkpIHtcblx0XHRpZiAoaXNJTWVudUl0ZW0obWVudUl0ZW0pKSB7XG5cdFx0XHRpZiAoZmlsdGVyQnlQcmVjb25kaXRpb24gJiYgIWNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMobWVudUl0ZW0ud2hlbikpIHtcblx0XHRcdFx0Y29udGludWU7XG5cdFx0XHR9XG5cdFx0XHRjb25zdCB0aXRsZSA9IHR5cGVvZiBtZW51SXRlbS5jb21tYW5kLnRpdGxlID09PSAnc3RyaW5nJyA/IG1lbnVJdGVtLmNvbW1hbmQudGl0bGUgOiBtZW51SXRlbS5jb21tYW5kLnRpdGxlLnZhbHVlO1xuXHRcdFx0Y29uc3QgY2F0ZWdvcnkgPSBtZW51SXRlbS5jb21tYW5kLmNhdGVnb3J5ID8gdHlwZW9mIG1lbnVJdGVtLmNvbW1hbmQuY2F0ZWdvcnkgPT09ICdzdHJpbmcnID8gbWVudUl0ZW0uY29tbWFuZC5jYXRlZ29yeSA6IG1lbnVJdGVtLmNvbW1hbmQuY2F0ZWdvcnkudmFsdWUgOiB1bmRlZmluZWQ7XG5cdFx0XHRjb25zdCBsYWJlbCA9IGNhdGVnb3J5ID8gYCR7Y2F0ZWdvcnl9OiAke3RpdGxlfWAgOiB0aXRsZTtcblx0XHRcdGNvbnN0IGRlc2NyaXB0aW9uID0gaXNMb2NhbGl6ZWRTdHJpbmcobWVudUl0ZW0uY29tbWFuZC5tZXRhZGF0YT8uZGVzY3JpcHRpb24pID8gbWVudUl0ZW0uY29tbWFuZC5tZXRhZGF0YS5kZXNjcmlwdGlvbi52YWx1ZSA6IG1lbnVJdGVtLmNvbW1hbmQubWV0YWRhdGE/LmRlc2NyaXB0aW9uO1xuXHRcdFx0Y29uc3Qga2V5YmluZGluZyA9IGtleWJpbmRpbmdTZXJ2aWNlLmxvb2t1cEtleWJpbmRpbmcobWVudUl0ZW0uY29tbWFuZC5pZCk7XG5cdFx0XHRhY3Rpb25zLnB1c2goe1xuXHRcdFx0XHRjb21tYW5kOiBtZW51SXRlbS5jb21tYW5kLmlkLFxuXHRcdFx0XHRsYWJlbCxcblx0XHRcdFx0ZGVzY3JpcHRpb24sXG5cdFx0XHRcdHByZWNvbmRpdGlvbjogbWVudUl0ZW0ud2hlbj8uc2VyaWFsaXplKCksXG5cdFx0XHRcdGtleWJpbmRpbmc6IGtleWJpbmRpbmc/LmdldExhYmVsKCkgPz8gJ05vdCBzZXQnXG5cdFx0XHR9KTtcblx0XHR9XG5cdH1cblx0Zm9yIChjb25zdCBjb21tYW5kIG9mIEtleWJpbmRpbmdzUmVnaXN0cnkuZ2V0RGVmYXVsdEtleWJpbmRpbmdzKCkpIHtcblx0XHRpZiAoZmlsdGVyQnlQcmVjb25kaXRpb24gJiYgIWNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoY29tbWFuZC53aGVuID8/IHVuZGVmaW5lZCkpIHtcblx0XHRcdGNvbnRpbnVlO1xuXHRcdH1cblxuXHRcdGNvbnN0IGtleWJpbmRpbmcgPSBrZXliaW5kaW5nU2VydmljZS5sb29rdXBLZXliaW5kaW5nKGNvbW1hbmQuY29tbWFuZCA/PyAnJyk7XG5cdFx0aWYgKCFrZXliaW5kaW5nKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cblx0XHRpZiAoYWN0aW9ucy5zb21lKGEgPT4gYS5jb21tYW5kID09PSBjb21tYW5kLmNvbW1hbmQpKSB7XG5cdFx0XHRjb250aW51ZTtcblx0XHR9XG5cdFx0YWN0aW9ucy5wdXNoKHtcblx0XHRcdGNvbW1hbmQ6IGNvbW1hbmQuY29tbWFuZCA/PyAnJyxcblx0XHRcdGxhYmVsOiBjb21tYW5kLmNvbW1hbmQgPz8gJycsXG5cdFx0XHRrZXliaW5kaW5nOiBrZXliaW5kaW5nPy5nZXRMYWJlbCgpID8/ICdOb3Qgc2V0Jyxcblx0XHRcdHByZWNvbmRpdGlvbjogY29tbWFuZC53aGVuPy5zZXJpYWxpemUoKVxuXHRcdH0pO1xuXHR9XG5cblx0cmV0dXJuIGFjdGlvbnM7XG59KTtcbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGNBQWM7QUFDdkIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMsd0JBQXdCO0FBQ2pDLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEwQztBQUNuRCxTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHdCQUF3QjtBQUNqQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLGtCQUEwQztBQUNuRCxTQUFTLGdDQUFnQztBQUN6QyxTQUFTLFFBQVEsY0FBYyxtQkFBbUI7QUFDbEQsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUywwQkFBMEI7QUFDbkMsU0FBUywyQkFBMkI7QUFFN0IsSUFBTSx1Q0FBTixjQUFtRCxPQUFPO0FBQUEsRUFLaEUsWUFDQyxJQUNBLE9BQ2dDLGNBQ0csaUJBQ0UsbUJBQ0Msb0JBQ3JDO0FBQ0QsVUFBTSxJQUFJLEtBQUs7QUFMaUI7QUFDRztBQUNFO0FBQ0M7QUFBQSxFQUd2QztBQUFBLEVBRUEsTUFBZSxNQUFxQjtBQUNuQyxVQUFNLFlBQVksS0FBSyxnQkFBZ0IsaUNBQWlDO0FBQ3hFLFVBQU0sUUFBMEIsVUFBVSxJQUFJLENBQUMsRUFBRSxjQUFjLFdBQVcsTUFBc0I7QUFDL0YsWUFBTSxjQUFzQixJQUFJLFNBQVMsaUNBQWlDLFNBQVMsVUFBVTtBQUU3RixVQUFJO0FBQ0osWUFBTSxhQUFhLEtBQUssZ0JBQWdCLGNBQWMsVUFBVTtBQUNoRSxVQUFJLFdBQVcsUUFBUTtBQUN0Qix1QkFBZSxJQUFJLEtBQUssV0FBVyxDQUFDLENBQUM7QUFBQSxNQUN0QyxPQUFPO0FBQ04sY0FBTSxZQUFZLEtBQUssZ0JBQWdCLGFBQWEsVUFBVTtBQUM5RCxZQUFJLFVBQVUsUUFBUTtBQUNyQix5QkFBZSxJQUFJLEtBQUssVUFBVSxDQUFDLENBQUM7QUFBQSxRQUNyQztBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsUUFDTixPQUFPO0FBQUEsUUFDUCxhQUFhLGVBQWUsS0FBSyxjQUFjLEtBQUssaUJBQWlCLFlBQVk7QUFBQSxRQUNqRjtBQUFBLE1BQ0Q7QUFBQSxJQUNELENBQUM7QUFFRCxVQUFNLEtBQUssa0JBQWtCLEtBQUssT0FBTyxFQUFFLGFBQWEsSUFBSSxTQUFTLGdCQUFnQixpQkFBaUIsRUFBRSxDQUFDLEVBQ3ZHLEtBQUssVUFBUTtBQUNiLFVBQUksTUFBTTtBQUNULGNBQU0sYUFBYSxLQUFLLGdCQUFnQiw0QkFBNEIsS0FBSyxLQUFLO0FBQzlFLFlBQUksT0FBTyxlQUFlLFVBQVU7QUFDbkMsaUJBQU8sS0FBSyxtQkFBbUIsNkJBQTZCLFVBQVU7QUFBQSxRQUN2RTtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUixDQUFDO0FBQUEsRUFFSDtBQUNEO0FBbERhLHFDQUVJLEtBQUs7QUFGVCxxQ0FHSSxRQUFRLElBQUksVUFBVSxrQ0FBa0MseUNBQXlDO0FBSHJHLHVDQUFOO0FBQUEsRUFRSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBWFU7QUFxRGIsaUJBQWlCLGdCQUFnQjtBQUFBLEVBQ2hDLElBQUk7QUFBQSxFQUNKLFNBQVMsTUFBTTtBQUNkLFVBQU0saUJBQWlCLFNBQVMsR0FBMkIsV0FBVyxhQUFhO0FBQ25GLFVBQU0sY0FBYyxlQUFlLDJCQUEyQjtBQUM5RCxXQUFPO0FBQUEsRUFDUjtBQUNELENBQUM7QUFHRCxpQkFBaUIsZ0JBQWdCLG1CQUFtQixTQUFVLFVBQVUsc0JBQWdDO0FBQ3ZHLFFBQU0sb0JBQW9CLFNBQVMsSUFBSSxrQkFBa0I7QUFDekQsUUFBTSxvQkFBb0IsU0FBUyxJQUFJLGtCQUFrQjtBQUN6RCxRQUFNLFVBQWlILENBQUM7QUFDeEgsYUFBVyxnQkFBZ0IseUJBQXlCLGlCQUFpQixHQUFHO0FBQ3ZFLFVBQU0sYUFBYSxrQkFBa0IsaUJBQWlCLGFBQWEsRUFBRTtBQUNyRSxRQUFJLHdCQUF3QixDQUFDLGtCQUFrQixvQkFBb0IsYUFBYSxZQUFZLEdBQUc7QUFDOUY7QUFBQSxJQUNEO0FBQ0EsWUFBUSxLQUFLO0FBQUEsTUFDWixTQUFTLGFBQWE7QUFBQSxNQUN0QixPQUFPLGFBQWE7QUFBQSxNQUNwQixhQUFhLGtCQUFrQixhQUFhLFVBQVUsV0FBVyxJQUFJLGFBQWEsU0FBUyxZQUFZLFFBQVEsYUFBYSxVQUFVO0FBQUEsTUFDdEksY0FBYyxhQUFhLGNBQWMsVUFBVTtBQUFBLE1BQ25ELFlBQVksWUFBWSxTQUFTLEtBQUs7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDRjtBQUNBLGFBQVcsWUFBWSxhQUFhLGFBQWEsT0FBTyxjQUFjLEdBQUc7QUFDeEUsUUFBSSxZQUFZLFFBQVEsR0FBRztBQUMxQixVQUFJLHdCQUF3QixDQUFDLGtCQUFrQixvQkFBb0IsU0FBUyxJQUFJLEdBQUc7QUFDbEY7QUFBQSxNQUNEO0FBQ0EsWUFBTSxRQUFRLE9BQU8sU0FBUyxRQUFRLFVBQVUsV0FBVyxTQUFTLFFBQVEsUUFBUSxTQUFTLFFBQVEsTUFBTTtBQUMzRyxZQUFNLFdBQVcsU0FBUyxRQUFRLFdBQVcsT0FBTyxTQUFTLFFBQVEsYUFBYSxXQUFXLFNBQVMsUUFBUSxXQUFXLFNBQVMsUUFBUSxTQUFTLFFBQVE7QUFDM0osWUFBTSxRQUFRLFdBQVcsR0FBRyxRQUFRLEtBQUssS0FBSyxLQUFLO0FBQ25ELFlBQU0sY0FBYyxrQkFBa0IsU0FBUyxRQUFRLFVBQVUsV0FBVyxJQUFJLFNBQVMsUUFBUSxTQUFTLFlBQVksUUFBUSxTQUFTLFFBQVEsVUFBVTtBQUN6SixZQUFNLGFBQWEsa0JBQWtCLGlCQUFpQixTQUFTLFFBQVEsRUFBRTtBQUN6RSxjQUFRLEtBQUs7QUFBQSxRQUNaLFNBQVMsU0FBUyxRQUFRO0FBQUEsUUFDMUI7QUFBQSxRQUNBO0FBQUEsUUFDQSxjQUFjLFNBQVMsTUFBTSxVQUFVO0FBQUEsUUFDdkMsWUFBWSxZQUFZLFNBQVMsS0FBSztBQUFBLE1BQ3ZDLENBQUM7QUFBQSxJQUNGO0FBQUEsRUFDRDtBQUNBLGFBQVcsV0FBVyxvQkFBb0Isc0JBQXNCLEdBQUc7QUFDbEUsUUFBSSx3QkFBd0IsQ0FBQyxrQkFBa0Isb0JBQW9CLFFBQVEsUUFBUSxNQUFTLEdBQUc7QUFDOUY7QUFBQSxJQUNEO0FBRUEsVUFBTSxhQUFhLGtCQUFrQixpQkFBaUIsUUFBUSxXQUFXLEVBQUU7QUFDM0UsUUFBSSxDQUFDLFlBQVk7QUFDaEI7QUFBQSxJQUNEO0FBRUEsUUFBSSxRQUFRLEtBQUssT0FBSyxFQUFFLFlBQVksUUFBUSxPQUFPLEdBQUc7QUFDckQ7QUFBQSxJQUNEO0FBQ0EsWUFBUSxLQUFLO0FBQUEsTUFDWixTQUFTLFFBQVEsV0FBVztBQUFBLE1BQzVCLE9BQU8sUUFBUSxXQUFXO0FBQUEsTUFDMUIsWUFBWSxZQUFZLFNBQVMsS0FBSztBQUFBLE1BQ3RDLGNBQWMsUUFBUSxNQUFNLFVBQVU7QUFBQSxJQUN2QyxDQUFDO0FBQUEsRUFDRjtBQUVBLFNBQU87QUFDUixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
