import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../extensions/common/extensionsRegistry.js";
import { languagesExtPoint } from "../../language/common/languageService.js";
const grammarsExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "grammars",
  deps: [languagesExtPoint],
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.grammars", "Contributes textmate tokenizers."),
    type: "array",
    defaultSnippets: [{ body: [{ language: "${1:id}", scopeName: "source.${2:id}", path: "./syntaxes/${3:id}.tmLanguage." }] }],
    items: {
      type: "object",
      defaultSnippets: [{ body: { language: "${1:id}", scopeName: "source.${2:id}", path: "./syntaxes/${3:id}.tmLanguage." } }],
      properties: {
        language: {
          description: nls.localize("vscode.extension.contributes.grammars.language", "Language identifier for which this syntax is contributed to."),
          type: "string"
        },
        scopeName: {
          description: nls.localize("vscode.extension.contributes.grammars.scopeName", "Textmate scope name used by the tmLanguage file."),
          type: "string"
        },
        path: {
          description: nls.localize("vscode.extension.contributes.grammars.path", "Path of the tmLanguage file. The path is relative to the extension folder and typically starts with './syntaxes/'."),
          type: "string"
        },
        embeddedLanguages: {
          description: nls.localize("vscode.extension.contributes.grammars.embeddedLanguages", "A map of scope name to language id if this grammar contains embedded languages."),
          type: "object"
        },
        tokenTypes: {
          description: nls.localize("vscode.extension.contributes.grammars.tokenTypes", "A map of scope name to token types."),
          type: "object",
          additionalProperties: {
            enum: ["string", "comment", "other"]
          }
        },
        injectTo: {
          description: nls.localize("vscode.extension.contributes.grammars.injectTo", "List of language scope names to which this grammar is injected to."),
          type: "array",
          items: {
            type: "string"
          }
        },
        balancedBracketScopes: {
          description: nls.localize("vscode.extension.contributes.grammars.balancedBracketScopes", "Defines which scope names contain balanced brackets."),
          type: "array",
          items: {
            type: "string"
          },
          default: ["*"]
        },
        unbalancedBracketScopes: {
          description: nls.localize("vscode.extension.contributes.grammars.unbalancedBracketScopes", "Defines which scope names do not contain balanced brackets."),
          type: "array",
          items: {
            type: "string"
          },
          default: []
        }
      },
      required: ["scopeName", "path"]
    }
  }
});
export {
  grammarsExtPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvdGV4dE1hdGUvY29tbW9uL1RNR3JhbW1hcnMudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSwgSUV4dGVuc2lvblBvaW50IH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IGxhbmd1YWdlc0V4dFBvaW50IH0gZnJvbSAnLi4vLi4vbGFuZ3VhZ2UvY29tbW9uL2xhbmd1YWdlU2VydmljZS5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUVtYmVkZGVkTGFuZ3VhZ2VzTWFwIHtcblx0W3Njb3BlTmFtZTogc3RyaW5nXTogc3RyaW5nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIFRva2VuVHlwZXNDb250cmlidXRpb24ge1xuXHRbc2NvcGVOYW1lOiBzdHJpbmddOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVRNU3ludGF4RXh0ZW5zaW9uUG9pbnQge1xuXHRsYW5ndWFnZT86IHN0cmluZzsgLy8gdW5kZWZpbmVkIGlmIHRoZSBncmFtbWFyIGlzIG9ubHkgaW5jbHVkZWQgYnkgb3RoZXIgZ3JhbW1hcnNcblx0c2NvcGVOYW1lOiBzdHJpbmc7XG5cdHBhdGg6IHN0cmluZztcblx0ZW1iZWRkZWRMYW5ndWFnZXM6IElFbWJlZGRlZExhbmd1YWdlc01hcDtcblx0dG9rZW5UeXBlczogVG9rZW5UeXBlc0NvbnRyaWJ1dGlvbjtcblx0aW5qZWN0VG86IHN0cmluZ1tdO1xuXHRiYWxhbmNlZEJyYWNrZXRTY29wZXM6IHN0cmluZ1tdO1xuXHR1bmJhbGFuY2VkQnJhY2tldFNjb3Blczogc3RyaW5nW107XG59XG5cbmV4cG9ydCBjb25zdCBncmFtbWFyc0V4dFBvaW50OiBJRXh0ZW5zaW9uUG9pbnQ8SVRNU3ludGF4RXh0ZW5zaW9uUG9pbnRbXT4gPSBFeHRlbnNpb25zUmVnaXN0cnkucmVnaXN0ZXJFeHRlbnNpb25Qb2ludDxJVE1TeW50YXhFeHRlbnNpb25Qb2ludFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnZ3JhbW1hcnMnLFxuXHRkZXBzOiBbbGFuZ3VhZ2VzRXh0UG9pbnRdLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5ncmFtbWFycycsICdDb250cmlidXRlcyB0ZXh0bWF0ZSB0b2tlbml6ZXJzLicpLFxuXHRcdHR5cGU6ICdhcnJheScsXG5cdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiBbeyBsYW5ndWFnZTogJyR7MTppZH0nLCBzY29wZU5hbWU6ICdzb3VyY2UuJHsyOmlkfScsIHBhdGg6ICcuL3N5bnRheGVzLyR7MzppZH0udG1MYW5ndWFnZS4nIH1dIH1dLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBsYW5ndWFnZTogJyR7MTppZH0nLCBzY29wZU5hbWU6ICdzb3VyY2UuJHsyOmlkfScsIHBhdGg6ICcuL3N5bnRheGVzLyR7MzppZH0udG1MYW5ndWFnZS4nIH0gfV0sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGxhbmd1YWdlOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5ncmFtbWFycy5sYW5ndWFnZScsICdMYW5ndWFnZSBpZGVudGlmaWVyIGZvciB3aGljaCB0aGlzIHN5bnRheCBpcyBjb250cmlidXRlZCB0by4nKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRzY29wZU5hbWU6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmdyYW1tYXJzLnNjb3BlTmFtZScsICdUZXh0bWF0ZSBzY29wZSBuYW1lIHVzZWQgYnkgdGhlIHRtTGFuZ3VhZ2UgZmlsZS4nKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRwYXRoOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5ncmFtbWFycy5wYXRoJywgJ1BhdGggb2YgdGhlIHRtTGFuZ3VhZ2UgZmlsZS4gVGhlIHBhdGggaXMgcmVsYXRpdmUgdG8gdGhlIGV4dGVuc2lvbiBmb2xkZXIgYW5kIHR5cGljYWxseSBzdGFydHMgd2l0aCBcXCcuL3N5bnRheGVzL1xcJy4nKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRlbWJlZGRlZExhbmd1YWdlczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZ3JhbW1hcnMuZW1iZWRkZWRMYW5ndWFnZXMnLCAnQSBtYXAgb2Ygc2NvcGUgbmFtZSB0byBsYW5ndWFnZSBpZCBpZiB0aGlzIGdyYW1tYXIgY29udGFpbnMgZW1iZWRkZWQgbGFuZ3VhZ2VzLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRva2VuVHlwZXM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmdyYW1tYXJzLnRva2VuVHlwZXMnLCAnQSBtYXAgb2Ygc2NvcGUgbmFtZSB0byB0b2tlbiB0eXBlcy4nKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0ZW51bTogWydzdHJpbmcnLCAnY29tbWVudCcsICdvdGhlciddXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRpbmplY3RUbzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZ3JhbW1hcnMuaW5qZWN0VG8nLCAnTGlzdCBvZiBsYW5ndWFnZSBzY29wZSBuYW1lcyB0byB3aGljaCB0aGlzIGdyYW1tYXIgaXMgaW5qZWN0ZWQgdG8uJyksXG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGJhbGFuY2VkQnJhY2tldFNjb3Blczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZ3JhbW1hcnMuYmFsYW5jZWRCcmFja2V0U2NvcGVzJywgJ0RlZmluZXMgd2hpY2ggc2NvcGUgbmFtZXMgY29udGFpbiBiYWxhbmNlZCBicmFja2V0cy4nKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0ZGVmYXVsdDogWycqJ10sXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHVuYmFsYW5jZWRCcmFja2V0U2NvcGVzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5ncmFtbWFycy51bmJhbGFuY2VkQnJhY2tldFNjb3BlcycsICdEZWZpbmVzIHdoaWNoIHNjb3BlIG5hbWVzIGRvIG5vdCBjb250YWluIGJhbGFuY2VkIGJyYWNrZXRzLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkZWZhdWx0OiBbXSxcblx0XHRcdFx0fSxcblx0XHRcdH0sXG5cdFx0XHRyZXF1aXJlZDogWydzY29wZU5hbWUnLCAncGF0aCddXG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEyQztBQUNwRCxTQUFTLHlCQUF5QjtBQXFCM0IsTUFBTSxtQkFBK0QsbUJBQW1CLHVCQUFrRDtBQUFBLEVBQ2hKLGdCQUFnQjtBQUFBLEVBQ2hCLE1BQU0sQ0FBQyxpQkFBaUI7QUFBQSxFQUN4QixZQUFZO0FBQUEsSUFDWCxhQUFhLElBQUksU0FBUyx5Q0FBeUMsa0NBQWtDO0FBQUEsSUFDckcsTUFBTTtBQUFBLElBQ04saUJBQWlCLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRSxVQUFVLFdBQVcsV0FBVyxrQkFBa0IsTUFBTSxpQ0FBaUMsQ0FBQyxFQUFFLENBQUM7QUFBQSxJQUMxSCxPQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsTUFDTixpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxVQUFVLFdBQVcsV0FBVyxrQkFBa0IsTUFBTSxpQ0FBaUMsRUFBRSxDQUFDO0FBQUEsTUFDeEgsWUFBWTtBQUFBLFFBQ1gsVUFBVTtBQUFBLFVBQ1QsYUFBYSxJQUFJLFNBQVMsa0RBQWtELDhEQUE4RDtBQUFBLFVBQzFJLE1BQU07QUFBQSxRQUNQO0FBQUEsUUFDQSxXQUFXO0FBQUEsVUFDVixhQUFhLElBQUksU0FBUyxtREFBbUQsa0RBQWtEO0FBQUEsVUFDL0gsTUFBTTtBQUFBLFFBQ1A7QUFBQSxRQUNBLE1BQU07QUFBQSxVQUNMLGFBQWEsSUFBSSxTQUFTLDhDQUE4QyxvSEFBc0g7QUFBQSxVQUM5TCxNQUFNO0FBQUEsUUFDUDtBQUFBLFFBQ0EsbUJBQW1CO0FBQUEsVUFDbEIsYUFBYSxJQUFJLFNBQVMsMkRBQTJELGlGQUFpRjtBQUFBLFVBQ3RLLE1BQU07QUFBQSxRQUNQO0FBQUEsUUFDQSxZQUFZO0FBQUEsVUFDWCxhQUFhLElBQUksU0FBUyxvREFBb0QscUNBQXFDO0FBQUEsVUFDbkgsTUFBTTtBQUFBLFVBQ04sc0JBQXNCO0FBQUEsWUFDckIsTUFBTSxDQUFDLFVBQVUsV0FBVyxPQUFPO0FBQUEsVUFDcEM7QUFBQSxRQUNEO0FBQUEsUUFDQSxVQUFVO0FBQUEsVUFDVCxhQUFhLElBQUksU0FBUyxrREFBa0Qsb0VBQW9FO0FBQUEsVUFDaEosTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFlBQ04sTUFBTTtBQUFBLFVBQ1A7QUFBQSxRQUNEO0FBQUEsUUFDQSx1QkFBdUI7QUFBQSxVQUN0QixhQUFhLElBQUksU0FBUywrREFBK0Qsc0RBQXNEO0FBQUEsVUFDL0ksTUFBTTtBQUFBLFVBQ04sT0FBTztBQUFBLFlBQ04sTUFBTTtBQUFBLFVBQ1A7QUFBQSxVQUNBLFNBQVMsQ0FBQyxHQUFHO0FBQUEsUUFDZDtBQUFBLFFBQ0EseUJBQXlCO0FBQUEsVUFDeEIsYUFBYSxJQUFJLFNBQVMsaUVBQWlFLDZEQUE2RDtBQUFBLFVBQ3hKLE1BQU07QUFBQSxVQUNOLE9BQU87QUFBQSxZQUNOLE1BQU07QUFBQSxVQUNQO0FBQUEsVUFDQSxTQUFTLENBQUM7QUFBQSxRQUNYO0FBQUEsTUFDRDtBQUFBLE1BQ0EsVUFBVSxDQUFDLGFBQWEsTUFBTTtBQUFBLElBQy9CO0FBQUEsRUFDRDtBQUNELENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
