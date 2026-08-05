import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { registerAction2 } from "../../../../platform/actions/common/actions.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { ClearDisplayLanguageAction, ConfigureDisplayLanguageAction } from "./localizationsActions.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
class BaseLocalizationWorkbenchContribution extends Disposable {
  constructor() {
    super();
    registerAction2(ConfigureDisplayLanguageAction);
    registerAction2(ClearDisplayLanguageAction);
    ExtensionsRegistry.registerExtensionPoint({
      extensionPoint: "localizations",
      defaultExtensionKind: ["ui", "workspace"],
      jsonSchema: {
        description: localize("vscode.extension.contributes.localizations", "Contributes localizations to the editor"),
        type: "array",
        default: [],
        items: {
          type: "object",
          required: ["languageId", "translations"],
          defaultSnippets: [{ body: { languageId: "", languageName: "", localizedLanguageName: "", translations: [{ id: "vscode", path: "" }] } }],
          properties: {
            languageId: {
              description: localize("vscode.extension.contributes.localizations.languageId", "Id of the language into which the display strings are translated."),
              type: "string"
            },
            languageName: {
              description: localize("vscode.extension.contributes.localizations.languageName", "Name of the language in English."),
              type: "string"
            },
            localizedLanguageName: {
              description: localize("vscode.extension.contributes.localizations.languageNameLocalized", "Name of the language in contributed language."),
              type: "string"
            },
            translations: {
              description: localize("vscode.extension.contributes.localizations.translations", "List of translations associated to the language."),
              type: "array",
              default: [{ id: "vscode", path: "" }],
              items: {
                type: "object",
                required: ["id", "path"],
                properties: {
                  id: {
                    type: "string",
                    description: localize("vscode.extension.contributes.localizations.translations.id", "Id of VS Code or Extension for which this translation is contributed to. Id of VS Code is always `vscode` and of extension should be in format `publisherId.extensionName`."),
                    pattern: "^((vscode)|([a-z0-9A-Z][a-z0-9A-Z-]*)\\.([a-z0-9A-Z][a-z0-9A-Z-]*))$",
                    patternErrorMessage: localize("vscode.extension.contributes.localizations.translations.id.pattern", "Id should be `vscode` or in format `publisherId.extensionName` for translating VS code or an extension respectively.")
                  },
                  path: {
                    type: "string",
                    description: localize("vscode.extension.contributes.localizations.translations.path", "A relative path to a file containing translations for the language.")
                  }
                },
                defaultSnippets: [{ body: { id: "", path: "" } }]
              }
            }
          }
        }
      }
    });
  }
}
class LocalizationsDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.localizations;
  }
  render(manifest) {
    const localizations = manifest.contributes?.localizations || [];
    if (!localizations.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("language id", "Language ID"),
      localize("localizations language name", "Language Name"),
      localize("localizations localized language name", "Language Name (Localized)")
    ];
    const rows = localizations.sort((a, b) => a.languageId.localeCompare(b.languageId)).map((localization) => {
      return [
        localization.languageId,
        localization.languageName ?? "",
        localization.localizedLanguageName ?? ""
      ];
    });
    return {
      data: {
        headers,
        rows
      },
      dispose: () => {
      }
    };
  }
}
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "localizations",
  label: localize("localizations", "Langauage Packs"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(LocalizationsDataRenderer)
});
export {
  BaseLocalizationWorkbenchContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9sb2NhbGl6YXRpb24vY29tbW9uL2xvY2FsaXphdGlvbi5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGxvY2FsaXplIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyQWN0aW9uMiB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hDb250cmlidXRpb24gfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBDbGVhckRpc3BsYXlMYW5ndWFnZUFjdGlvbiwgQ29uZmlndXJlRGlzcGxheUxhbmd1YWdlQWN0aW9uIH0gZnJvbSAnLi9sb2NhbGl6YXRpb25zQWN0aW9ucy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIsIElSZW5kZXJlZERhdGEsIElUYWJsZURhdGEsIElSb3dEYXRhLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSwgRXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbkZlYXR1cmVzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5cbmV4cG9ydCBjbGFzcyBCYXNlTG9jYWxpemF0aW9uV29ya2JlbmNoQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRjb25zdHJ1Y3RvcigpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gUmVnaXN0ZXIgYWN0aW9uIHRvIGNvbmZpZ3VyZSBsb2NhbGUgYW5kIHJlbGF0ZWQgc2V0dGluZ3Ncblx0XHRyZWdpc3RlckFjdGlvbjIoQ29uZmlndXJlRGlzcGxheUxhbmd1YWdlQWN0aW9uKTtcblx0XHRyZWdpc3RlckFjdGlvbjIoQ2xlYXJEaXNwbGF5TGFuZ3VhZ2VBY3Rpb24pO1xuXG5cdFx0RXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQoe1xuXHRcdFx0ZXh0ZW5zaW9uUG9pbnQ6ICdsb2NhbGl6YXRpb25zJyxcblx0XHRcdGRlZmF1bHRFeHRlbnNpb25LaW5kOiBbJ3VpJywgJ3dvcmtzcGFjZSddLFxuXHRcdFx0anNvblNjaGVtYToge1xuXHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubG9jYWxpemF0aW9ucycsIFwiQ29udHJpYnV0ZXMgbG9jYWxpemF0aW9ucyB0byB0aGUgZWRpdG9yXCIpLFxuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRkZWZhdWx0OiBbXSxcblx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRyZXF1aXJlZDogWydsYW5ndWFnZUlkJywgJ3RyYW5zbGF0aW9ucyddLFxuXHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBsYW5ndWFnZUlkOiAnJywgbGFuZ3VhZ2VOYW1lOiAnJywgbG9jYWxpemVkTGFuZ3VhZ2VOYW1lOiAnJywgdHJhbnNsYXRpb25zOiBbeyBpZDogJ3ZzY29kZScsIHBhdGg6ICcnIH1dIH0gfV0sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VJZDoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubG9jYWxpemF0aW9ucy5sYW5ndWFnZUlkJywgJ0lkIG9mIHRoZSBsYW5ndWFnZSBpbnRvIHdoaWNoIHRoZSBkaXNwbGF5IHN0cmluZ3MgYXJlIHRyYW5zbGF0ZWQuJyksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bGFuZ3VhZ2VOYW1lOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5sb2NhbGl6YXRpb25zLmxhbmd1YWdlTmFtZScsICdOYW1lIG9mIHRoZSBsYW5ndWFnZSBpbiBFbmdsaXNoLicpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGxvY2FsaXplZExhbmd1YWdlTmFtZToge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMubG9jYWxpemF0aW9ucy5sYW5ndWFnZU5hbWVMb2NhbGl6ZWQnLCAnTmFtZSBvZiB0aGUgbGFuZ3VhZ2UgaW4gY29udHJpYnV0ZWQgbGFuZ3VhZ2UuJyksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0dHJhbnNsYXRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5sb2NhbGl6YXRpb25zLnRyYW5zbGF0aW9ucycsICdMaXN0IG9mIHRyYW5zbGF0aW9ucyBhc3NvY2lhdGVkIHRvIHRoZSBsYW5ndWFnZS4nKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogW3sgaWQ6ICd2c2NvZGUnLCBwYXRoOiAnJyB9XSxcblx0XHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdFx0XHRyZXF1aXJlZDogWydpZCcsICdwYXRoJ10sXG5cdFx0XHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0aWQ6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5sb2NhbGl6YXRpb25zLnRyYW5zbGF0aW9ucy5pZCcsIFwiSWQgb2YgVlMgQ29kZSBvciBFeHRlbnNpb24gZm9yIHdoaWNoIHRoaXMgdHJhbnNsYXRpb24gaXMgY29udHJpYnV0ZWQgdG8uIElkIG9mIFZTIENvZGUgaXMgYWx3YXlzIGB2c2NvZGVgIGFuZCBvZiBleHRlbnNpb24gc2hvdWxkIGJlIGluIGZvcm1hdCBgcHVibGlzaGVySWQuZXh0ZW5zaW9uTmFtZWAuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRwYXR0ZXJuOiAnXigodnNjb2RlKXwoW2EtejAtOUEtWl1bYS16MC05QS1aLV0qKVxcXFwuKFthLXowLTlBLVpdW2EtejAtOUEtWi1dKikpJCcsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmxvY2FsaXphdGlvbnMudHJhbnNsYXRpb25zLmlkLnBhdHRlcm4nLCBcIklkIHNob3VsZCBiZSBgdnNjb2RlYCBvciBpbiBmb3JtYXQgYHB1Ymxpc2hlcklkLmV4dGVuc2lvbk5hbWVgIGZvciB0cmFuc2xhdGluZyBWUyBjb2RlIG9yIGFuIGV4dGVuc2lvbiByZXNwZWN0aXZlbHkuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmxvY2FsaXphdGlvbnMudHJhbnNsYXRpb25zLnBhdGgnLCBcIkEgcmVsYXRpdmUgcGF0aCB0byBhIGZpbGUgY29udGFpbmluZyB0cmFuc2xhdGlvbnMgZm9yIHRoZSBsYW5ndWFnZS5cIilcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBpZDogJycsIHBhdGg6ICcnIH0gfV0sXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cblxuY2xhc3MgTG9jYWxpemF0aW9uc0RhdGFSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIge1xuXG5cdHJlYWRvbmx5IHR5cGUgPSAndGFibGUnO1xuXG5cdHNob3VsZFJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhbWFuaWZlc3QuY29udHJpYnV0ZXM/LmxvY2FsaXphdGlvbnM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGxvY2FsaXphdGlvbnMgPSBtYW5pZmVzdC5jb250cmlidXRlcz8ubG9jYWxpemF0aW9ucyB8fCBbXTtcblx0XHRpZiAoIWxvY2FsaXphdGlvbnMubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBkYXRhOiB7IGhlYWRlcnM6IFtdLCByb3dzOiBbXSB9LCBkaXNwb3NlOiAoKSA9PiB7IH0gfTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXJzID0gW1xuXHRcdFx0bG9jYWxpemUoJ2xhbmd1YWdlIGlkJywgXCJMYW5ndWFnZSBJRFwiKSxcblx0XHRcdGxvY2FsaXplKCdsb2NhbGl6YXRpb25zIGxhbmd1YWdlIG5hbWUnLCBcIkxhbmd1YWdlIE5hbWVcIiksXG5cdFx0XHRsb2NhbGl6ZSgnbG9jYWxpemF0aW9ucyBsb2NhbGl6ZWQgbGFuZ3VhZ2UgbmFtZScsIFwiTGFuZ3VhZ2UgTmFtZSAoTG9jYWxpemVkKVwiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gbG9jYWxpemF0aW9uc1xuXHRcdFx0LnNvcnQoKGEsIGIpID0+IGEubGFuZ3VhZ2VJZC5sb2NhbGVDb21wYXJlKGIubGFuZ3VhZ2VJZCkpXG5cdFx0XHQubWFwKGxvY2FsaXphdGlvbiA9PiB7XG5cdFx0XHRcdHJldHVybiBbXG5cdFx0XHRcdFx0bG9jYWxpemF0aW9uLmxhbmd1YWdlSWQsXG5cdFx0XHRcdFx0bG9jYWxpemF0aW9uLmxhbmd1YWdlTmFtZSA/PyAnJyxcblx0XHRcdFx0XHRsb2NhbGl6YXRpb24ubG9jYWxpemVkTGFuZ3VhZ2VOYW1lID8/ICcnXG5cdFx0XHRcdF07XG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAnbG9jYWxpemF0aW9ucycsXG5cdGxhYmVsOiBsb2NhbGl6ZSgnbG9jYWxpemF0aW9ucycsIFwiTGFuZ2F1YWdlIFBhY2tzXCIpLFxuXHRhY2Nlc3M6IHtcblx0XHRjYW5Ub2dnbGU6IGZhbHNlXG5cdH0sXG5cdHJlbmRlcmVyOiBuZXcgU3luY0Rlc2NyaXB0b3IoTG9jYWxpemF0aW9uc0RhdGFSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBRWhDLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsNEJBQTRCLHNDQUFzQztBQUMzRSxTQUEwRyxrQkFBa0I7QUFDNUgsU0FBUywwQkFBMEI7QUFFNUIsTUFBTSw4Q0FBOEMsV0FBNkM7QUFBQSxFQUN2RyxjQUFjO0FBQ2IsVUFBTTtBQUdOLG9CQUFnQiw4QkFBOEI7QUFD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
