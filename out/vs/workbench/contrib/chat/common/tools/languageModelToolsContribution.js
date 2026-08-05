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
import { MarkdownString } from "../../../../../base/common/htmlContent.js";
import { Disposable, DisposableMap } from "../../../../../base/common/lifecycle.js";
import { joinPath } from "../../../../../base/common/resources.js";
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../../platform/extensions/common/extensions.js";
import { SyncDescriptor } from "../../../../../platform/instantiation/common/descriptors.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { IProductService } from "../../../../../platform/product/common/productService.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { Extensions } from "../../../../services/extensionManagement/common/extensionFeatures.js";
import { isProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { ILanguageModelToolsService } from "../languageModelToolsService.js";
import { toolsParametersSchemaSchemaId } from "./languageModelToolsParametersSchema.js";
const languageModelToolsExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "languageModelTools",
  activationEventsGenerator: (contributions, result) => {
    for (const contrib of contributions) {
      result.push(`onLanguageModelTool:${contrib.name}`);
    }
  },
  jsonSchema: {
    description: localize("vscode.extension.contributes.tools", "Contributes a tool that can be invoked by a language model in a chat session, or from a standalone command. Registered tools can be used by all extensions."),
    type: "array",
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{
        body: {
          name: "${1}",
          modelDescription: "${2}",
          inputSchema: {
            type: "object",
            properties: {
              "${3:name}": {
                type: "string",
                description: "${4:description}"
              }
            }
          }
        }
      }],
      required: ["name", "displayName", "modelDescription"],
      properties: {
        name: {
          description: localize("toolName", "A unique name for this tool. This name must be a globally unique identifier, and is also used as a name when presenting this tool to a language model."),
          type: "string",
          // [\\w-]+ is OpenAI's requirement for tool names
          pattern: "^(?!copilot_|vscode_)[\\w-]+$"
        },
        toolReferenceName: {
          markdownDescription: localize("toolName2", "If {0} is enabled for this tool, the user may use '#' with this name to invoke the tool in a query. Otherwise, the name is not required. Name must not contain whitespace.", "`canBeReferencedInPrompt`"),
          type: "string",
          pattern: "^[\\w-]+$"
        },
        displayName: {
          description: localize("toolDisplayName", "A human-readable name for this tool that may be used to describe it in the UI."),
          type: "string"
        },
        userDescription: {
          description: localize("toolUserDescription", "A description of this tool that may be shown to the user."),
          type: "string"
        },
        modelDescription: {
          description: localize("toolModelDescription", "A description of this tool that may be used by a language model to select it."),
          type: "string"
        },
        inputSchema: {
          description: localize("parametersSchema", "A JSON schema for the input this tool accepts. The input must be an object at the top level. A particular language model may not support all JSON schema features. See the documentation for the language model family you are using for more information."),
          $ref: toolsParametersSchemaSchemaId
        },
        canBeReferencedInPrompt: {
          markdownDescription: localize("canBeReferencedInPrompt", "If true, this tool shows up as an attachment that the user can add manually to their request. Chat participants will receive the tool in {0}.", "`ChatRequest#toolReferences`"),
          type: "boolean"
        },
        icon: {
          markdownDescription: localize("icon", "An icon that represents this tool. Either a file path, an object with file paths for dark and light themes, or a theme icon reference, like `$(zap)`"),
          anyOf: [
            {
              type: "string"
            },
            {
              type: "object",
              properties: {
                light: {
                  description: localize("icon.light", "Icon path when a light theme is used"),
                  type: "string"
                },
                dark: {
                  description: localize("icon.dark", "Icon path when a dark theme is used"),
                  type: "string"
                }
              }
            }
          ]
        },
        when: {
          markdownDescription: localize("condition", "Condition which must be true for this tool to be enabled. Note that a tool may still be invoked by another extension even when its `when` condition is false."),
          type: "string"
        },
        tags: {
          description: localize("toolTags", "A set of tags that roughly describe the tool's capabilities. A tool user may use these to filter the set of tools to just ones that are relevant for the task at hand, or they may want to pick a tag that can be used to identify just the tools contributed by this extension."),
          type: "array",
          items: {
            type: "string",
            pattern: "^(?!copilot_|vscode_)"
          }
        }
      }
    }
  }
});
function toToolKey(extensionIdentifier, toolName) {
  return `${extensionIdentifier.value}/${toolName}`;
}
const CopilotAgentModeTag = "vscode_editing";
let LanguageModelToolsExtensionPointHandler = class {
  constructor(languageModelToolsService, logService, productService) {
    this._registrationDisposables = new DisposableMap();
    languageModelToolsExtensionPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        for (const rawTool of extension.value) {
          if (!rawTool.name || !rawTool.modelDescription || !rawTool.displayName) {
            logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool without name, modelDescription, and displayName: ${JSON.stringify(rawTool)}`);
            continue;
          }
          if (!rawTool.name.match(/^[\w-]+$/)) {
            logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with invalid id: ${rawTool.name}. The id must match /^[\\w-]+$/.`);
            continue;
          }
          if (rawTool.canBeReferencedInPrompt && !rawTool.toolReferenceName) {
            logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with 'canBeReferencedInPrompt' set without a 'toolReferenceName': ${JSON.stringify(rawTool)}`);
            continue;
          }
          if ((rawTool.name.startsWith("copilot_") || rawTool.name.startsWith("vscode_")) && !isProposedApiEnabled(extension.description, "chatParticipantPrivate")) {
            logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with name starting with "vscode_" or "copilot_"`);
            continue;
          }
          if (rawTool.tags?.includes(CopilotAgentModeTag)) {
            if (!isProposedApiEnabled(extension.description, "languageModelToolsForAgent") && !isProposedApiEnabled(extension.description, "chatParticipantPrivate")) {
              logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with tag "${CopilotAgentModeTag}" without enabling 'languageModelToolsForAgent' proposal`);
              continue;
            }
          }
          if (rawTool.tags?.some((tag) => tag !== CopilotAgentModeTag && (tag.startsWith("copilot_") || tag.startsWith("vscode_"))) && !isProposedApiEnabled(extension.description, "chatParticipantPrivate")) {
            logService.error(`Extension '${extension.description.identifier.value}' CANNOT register tool with tags starting with "vscode_" or "copilot_"`);
            continue;
          }
          const rawIcon = rawTool.icon;
          let icon;
          if (typeof rawIcon === "string") {
            icon = ThemeIcon.fromString(rawIcon) ?? {
              dark: joinPath(extension.description.extensionLocation, rawIcon),
              light: joinPath(extension.description.extensionLocation, rawIcon)
            };
          } else if (rawIcon) {
            icon = {
              dark: joinPath(extension.description.extensionLocation, rawIcon.dark),
              light: joinPath(extension.description.extensionLocation, rawIcon.light)
            };
          }
          const isBuiltinTool = productService.defaultChatAgent?.chatExtensionId ? ExtensionIdentifier.equals(extension.description.identifier, productService.defaultChatAgent.chatExtensionId) : isProposedApiEnabled(extension.description, "chatParticipantPrivate");
          const tool = {
            ...rawTool,
            source: { type: "extension", extensionId: extension.description.identifier, isExternalTool: !isBuiltinTool },
            inputSchema: rawTool.inputSchema,
            id: rawTool.name,
            icon,
            when: rawTool.when ? ContextKeyExpr.deserialize(rawTool.when) : void 0,
            requiresConfirmation: !isBuiltinTool,
            alwaysDisplayInputOutput: !isBuiltinTool,
            supportsToolPicker: isBuiltinTool ? false : rawTool.canBeReferencedInPrompt
          };
          const disposable = languageModelToolsService.registerToolData(tool);
          this._registrationDisposables.set(toToolKey(extension.description.identifier, rawTool.name), disposable);
        }
      }
      for (const extension of delta.removed) {
        for (const tool of extension.value) {
          this._registrationDisposables.deleteAndDispose(toToolKey(extension.description.identifier, tool.name));
        }
      }
    });
  }
};
LanguageModelToolsExtensionPointHandler.ID = "workbench.contrib.toolsExtensionPointHandler";
LanguageModelToolsExtensionPointHandler = __decorateClass([
  __decorateParam(0, ILanguageModelToolsService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IProductService)
], LanguageModelToolsExtensionPointHandler);
class LanguageModelToolDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.languageModelTools;
  }
  render(manifest) {
    const contribs = manifest.contributes?.languageModelTools ?? [];
    if (!contribs.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      localize("toolTableName", "Name"),
      localize("toolTableDisplayName", "Display Name"),
      localize("toolTableDescription", "Description")
    ];
    const rows = contribs.map((t) => {
      return [
        new MarkdownString(`\`${t.name}\``),
        t.displayName,
        t.userDescription ?? t.modelDescription
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
  id: "languageModelTools",
  label: localize("langModelTools", "Language Model Tools"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(LanguageModelToolDataRenderer)
});
export {
  LanguageModelToolsExtensionPointHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi90b29scy9sYW5ndWFnZU1vZGVsVG9vbHNDb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IGpvaW5QYXRoIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBDb250ZXh0S2V5RXhwciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbnRleHRrZXkvY29tbW9uL2NvbnRleHRrZXkuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciwgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5LCBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIsIElSZW5kZXJlZERhdGEsIElSb3dEYXRhLCBJVGFibGVEYXRhIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgaXNQcm9wb3NlZEFwaUVuYWJsZWQgfSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCAqIGFzIGV4dGVuc2lvbnNSZWdpc3RyeSBmcm9tICcuLi8uLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIElUb29sRGF0YSB9IGZyb20gJy4uL2xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgdG9vbHNQYXJhbWV0ZXJzU2NoZW1hU2NoZW1hSWQgfSBmcm9tICcuL2xhbmd1YWdlTW9kZWxUb29sc1BhcmFtZXRlcnNTY2hlbWEuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElSYXdUb29sQ29udHJpYnV0aW9uIHtcblx0bmFtZTogc3RyaW5nO1xuXHRkaXNwbGF5TmFtZTogc3RyaW5nO1xuXHRtb2RlbERlc2NyaXB0aW9uOiBzdHJpbmc7XG5cdHRvb2xSZWZlcmVuY2VOYW1lPzogc3RyaW5nO1xuXHRpY29uPzogc3RyaW5nIHwgeyBsaWdodDogc3RyaW5nOyBkYXJrOiBzdHJpbmcgfTtcblx0d2hlbj86IHN0cmluZztcblx0dGFncz86IHN0cmluZ1tdO1xuXHR1c2VyRGVzY3JpcHRpb24/OiBzdHJpbmc7XG5cdGlucHV0U2NoZW1hPzogSUpTT05TY2hlbWE7XG5cdGNhbkJlUmVmZXJlbmNlZEluUHJvbXB0PzogYm9vbGVhbjtcbn1cblxuY29uc3QgbGFuZ3VhZ2VNb2RlbFRvb2xzRXh0ZW5zaW9uUG9pbnQgPSBleHRlbnNpb25zUmVnaXN0cnkuRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SVJhd1Rvb2xDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2xhbmd1YWdlTW9kZWxUb29scycsXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmlidXRpb25zOiBJUmF3VG9vbENvbnRyaWJ1dGlvbltdLCByZXN1bHQpID0+IHtcblx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgY29udHJpYnV0aW9ucykge1xuXHRcdFx0cmVzdWx0LnB1c2goYG9uTGFuZ3VhZ2VNb2RlbFRvb2w6JHtjb250cmliLm5hbWV9YCk7XG5cdFx0fVxuXHR9LFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLnRvb2xzJywgJ0NvbnRyaWJ1dGVzIGEgdG9vbCB0aGF0IGNhbiBiZSBpbnZva2VkIGJ5IGEgbGFuZ3VhZ2UgbW9kZWwgaW4gYSBjaGF0IHNlc3Npb24sIG9yIGZyb20gYSBzdGFuZGFsb25lIGNvbW1hbmQuIFJlZ2lzdGVyZWQgdG9vbHMgY2FuIGJlIHVzZWQgYnkgYWxsIGV4dGVuc2lvbnMuJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRpdGVtczoge1xuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7XG5cdFx0XHRcdGJvZHk6IHtcblx0XHRcdFx0XHRuYW1lOiAnJHsxfScsXG5cdFx0XHRcdFx0bW9kZWxEZXNjcmlwdGlvbjogJyR7Mn0nLFxuXHRcdFx0XHRcdGlucHV0U2NoZW1hOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0JyR7MzpuYW1lfSc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJyR7NDpkZXNjcmlwdGlvbn0nXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9XG5cdFx0XHR9XSxcblx0XHRcdHJlcXVpcmVkOiBbJ25hbWUnLCAnZGlzcGxheU5hbWUnLCAnbW9kZWxEZXNjcmlwdGlvbiddLFxuXHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRuYW1lOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0b29sTmFtZScsIFwiQSB1bmlxdWUgbmFtZSBmb3IgdGhpcyB0b29sLiBUaGlzIG5hbWUgbXVzdCBiZSBhIGdsb2JhbGx5IHVuaXF1ZSBpZGVudGlmaWVyLCBhbmQgaXMgYWxzbyB1c2VkIGFzIGEgbmFtZSB3aGVuIHByZXNlbnRpbmcgdGhpcyB0b29sIHRvIGEgbGFuZ3VhZ2UgbW9kZWwuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdC8vIFtcXFxcdy1dKyBpcyBPcGVuQUkncyByZXF1aXJlbWVudCBmb3IgdG9vbCBuYW1lc1xuXHRcdFx0XHRcdHBhdHRlcm46ICdeKD8hY29waWxvdF98dnNjb2RlXylbXFxcXHctXSskJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0b29sUmVmZXJlbmNlTmFtZToge1xuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCd0b29sTmFtZTInLCBcIklmIHswfSBpcyBlbmFibGVkIGZvciB0aGlzIHRvb2wsIHRoZSB1c2VyIG1heSB1c2UgJyMnIHdpdGggdGhpcyBuYW1lIHRvIGludm9rZSB0aGUgdG9vbCBpbiBhIHF1ZXJ5LiBPdGhlcndpc2UsIHRoZSBuYW1lIGlzIG5vdCByZXF1aXJlZC4gTmFtZSBtdXN0IG5vdCBjb250YWluIHdoaXRlc3BhY2UuXCIsICdgY2FuQmVSZWZlcmVuY2VkSW5Qcm9tcHRgJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0cGF0dGVybjogJ15bXFxcXHctXSskJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkaXNwbGF5TmFtZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndG9vbERpc3BsYXlOYW1lJywgXCJBIGh1bWFuLXJlYWRhYmxlIG5hbWUgZm9yIHRoaXMgdG9vbCB0aGF0IG1heSBiZSB1c2VkIHRvIGRlc2NyaWJlIGl0IGluIHRoZSBVSS5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0dXNlckRlc2NyaXB0aW9uOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd0b29sVXNlckRlc2NyaXB0aW9uJywgXCJBIGRlc2NyaXB0aW9uIG9mIHRoaXMgdG9vbCB0aGF0IG1heSBiZSBzaG93biB0byB0aGUgdXNlci5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0bW9kZWxEZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndG9vbE1vZGVsRGVzY3JpcHRpb24nLCBcIkEgZGVzY3JpcHRpb24gb2YgdGhpcyB0b29sIHRoYXQgbWF5IGJlIHVzZWQgYnkgYSBsYW5ndWFnZSBtb2RlbCB0byBzZWxlY3QgaXQuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGlucHV0U2NoZW1hOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdwYXJhbWV0ZXJzU2NoZW1hJywgXCJBIEpTT04gc2NoZW1hIGZvciB0aGUgaW5wdXQgdGhpcyB0b29sIGFjY2VwdHMuIFRoZSBpbnB1dCBtdXN0IGJlIGFuIG9iamVjdCBhdCB0aGUgdG9wIGxldmVsLiBBIHBhcnRpY3VsYXIgbGFuZ3VhZ2UgbW9kZWwgbWF5IG5vdCBzdXBwb3J0IGFsbCBKU09OIHNjaGVtYSBmZWF0dXJlcy4gU2VlIHRoZSBkb2N1bWVudGF0aW9uIGZvciB0aGUgbGFuZ3VhZ2UgbW9kZWwgZmFtaWx5IHlvdSBhcmUgdXNpbmcgZm9yIG1vcmUgaW5mb3JtYXRpb24uXCIpLFxuXHRcdFx0XHRcdCRyZWY6IHRvb2xzUGFyYW1ldGVyc1NjaGVtYVNjaGVtYUlkXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNhbkJlUmVmZXJlbmNlZEluUHJvbXB0OiB7XG5cdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ2NhbkJlUmVmZXJlbmNlZEluUHJvbXB0JywgXCJJZiB0cnVlLCB0aGlzIHRvb2wgc2hvd3MgdXAgYXMgYW4gYXR0YWNobWVudCB0aGF0IHRoZSB1c2VyIGNhbiBhZGQgbWFudWFsbHkgdG8gdGhlaXIgcmVxdWVzdC4gQ2hhdCBwYXJ0aWNpcGFudHMgd2lsbCByZWNlaXZlIHRoZSB0b29sIGluIHswfS5cIiwgJ2BDaGF0UmVxdWVzdCN0b29sUmVmZXJlbmNlc2AnKSxcblx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbidcblx0XHRcdFx0fSxcblx0XHRcdFx0aWNvbjoge1xuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdpY29uJywgXCJBbiBpY29uIHRoYXQgcmVwcmVzZW50cyB0aGlzIHRvb2wuIEVpdGhlciBhIGZpbGUgcGF0aCwgYW4gb2JqZWN0IHdpdGggZmlsZSBwYXRocyBmb3IgZGFyayBhbmQgbGlnaHQgdGhlbWVzLCBvciBhIHRoZW1lIGljb24gcmVmZXJlbmNlLCBsaWtlIGAkKHphcClgXCIpLFxuXHRcdFx0XHRcdGFueU9mOiBbe1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRsaWdodDoge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnaWNvbi5saWdodCcsICdJY29uIHBhdGggd2hlbiBhIGxpZ2h0IHRoZW1lIGlzIHVzZWQnKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRkYXJrOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdpY29uLmRhcmsnLCAnSWNvbiBwYXRoIHdoZW4gYSBkYXJrIHRoZW1lIGlzIHVzZWQnKSxcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSxcblx0XHRcdFx0d2hlbjoge1xuXHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdjb25kaXRpb24nLCBcIkNvbmRpdGlvbiB3aGljaCBtdXN0IGJlIHRydWUgZm9yIHRoaXMgdG9vbCB0byBiZSBlbmFibGVkLiBOb3RlIHRoYXQgYSB0b29sIG1heSBzdGlsbCBiZSBpbnZva2VkIGJ5IGFub3RoZXIgZXh0ZW5zaW9uIGV2ZW4gd2hlbiBpdHMgYHdoZW5gIGNvbmRpdGlvbiBpcyBmYWxzZS5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0dGFnczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgndG9vbFRhZ3MnLCBcIkEgc2V0IG9mIHRhZ3MgdGhhdCByb3VnaGx5IGRlc2NyaWJlIHRoZSB0b29sJ3MgY2FwYWJpbGl0aWVzLiBBIHRvb2wgdXNlciBtYXkgdXNlIHRoZXNlIHRvIGZpbHRlciB0aGUgc2V0IG9mIHRvb2xzIHRvIGp1c3Qgb25lcyB0aGF0IGFyZSByZWxldmFudCBmb3IgdGhlIHRhc2sgYXQgaGFuZCwgb3IgdGhleSBtYXkgd2FudCB0byBwaWNrIGEgdGFnIHRoYXQgY2FuIGJlIHVzZWQgdG8gaWRlbnRpZnkganVzdCB0aGUgdG9vbHMgY29udHJpYnV0ZWQgYnkgdGhpcyBleHRlbnNpb24uXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0cGF0dGVybjogJ14oPyFjb3BpbG90X3x2c2NvZGVfKSdcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5mdW5jdGlvbiB0b1Rvb2xLZXkoZXh0ZW5zaW9uSWRlbnRpZmllcjogRXh0ZW5zaW9uSWRlbnRpZmllciwgdG9vbE5hbWU6IHN0cmluZykge1xuXHRyZXR1cm4gYCR7ZXh0ZW5zaW9uSWRlbnRpZmllci52YWx1ZX0vJHt0b29sTmFtZX1gO1xufVxuXG5jb25zdCBDb3BpbG90QWdlbnRNb2RlVGFnID0gJ3ZzY29kZV9lZGl0aW5nJztcblxuZXhwb3J0IGNsYXNzIExhbmd1YWdlTW9kZWxUb29sc0V4dGVuc2lvblBvaW50SGFuZGxlciBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIudG9vbHNFeHRlbnNpb25Qb2ludEhhbmRsZXInO1xuXG5cdHByaXZhdGUgX3JlZ2lzdHJhdGlvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSBsYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlOiBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlXG5cdCkge1xuXHRcdGxhbmd1YWdlTW9kZWxUb29sc0V4dGVuc2lvblBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHJhd1Rvb2wgb2YgZXh0ZW5zaW9uLnZhbHVlKSB7XG5cdFx0XHRcdFx0aWYgKCFyYXdUb29sLm5hbWUgfHwgIXJhd1Rvb2wubW9kZWxEZXNjcmlwdGlvbiB8fCAhcmF3VG9vbC5kaXNwbGF5TmFtZSkge1xuXHRcdFx0XHRcdFx0bG9nU2VydmljZS5lcnJvcihgRXh0ZW5zaW9uICcke2V4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlfScgQ0FOTk9UIHJlZ2lzdGVyIHRvb2wgd2l0aG91dCBuYW1lLCBtb2RlbERlc2NyaXB0aW9uLCBhbmQgZGlzcGxheU5hbWU6ICR7SlNPTi5zdHJpbmdpZnkocmF3VG9vbCl9YCk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoIXJhd1Rvb2wubmFtZS5tYXRjaCgvXltcXHctXSskLykpIHtcblx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciB0b29sIHdpdGggaW52YWxpZCBpZDogJHtyYXdUb29sLm5hbWV9LiBUaGUgaWQgbXVzdCBtYXRjaCAvXltcXFxcdy1dKyQvLmApO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHJhd1Rvb2wuY2FuQmVSZWZlcmVuY2VkSW5Qcm9tcHQgJiYgIXJhd1Rvb2wudG9vbFJlZmVyZW5jZU5hbWUpIHtcblx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciB0b29sIHdpdGggJ2NhbkJlUmVmZXJlbmNlZEluUHJvbXB0JyBzZXQgd2l0aG91dCBhICd0b29sUmVmZXJlbmNlTmFtZSc6ICR7SlNPTi5zdHJpbmdpZnkocmF3VG9vbCl9YCk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAoKHJhd1Rvb2wubmFtZS5zdGFydHNXaXRoKCdjb3BpbG90XycpIHx8IHJhd1Rvb2wubmFtZS5zdGFydHNXaXRoKCd2c2NvZGVfJykpICYmICFpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJykpIHtcblx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciB0b29sIHdpdGggbmFtZSBzdGFydGluZyB3aXRoIFwidnNjb2RlX1wiIG9yIFwiY29waWxvdF9cImApO1xuXHRcdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHJhd1Rvb2wudGFncz8uaW5jbHVkZXMoQ29waWxvdEFnZW50TW9kZVRhZykpIHtcblx0XHRcdFx0XHRcdGlmICghaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLCAnbGFuZ3VhZ2VNb2RlbFRvb2xzRm9yQWdlbnQnKSAmJiAhaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpKSB7XG5cdFx0XHRcdFx0XHRcdGxvZ1NlcnZpY2UuZXJyb3IoYEV4dGVuc2lvbiAnJHtleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZX0nIENBTk5PVCByZWdpc3RlciB0b29sIHdpdGggdGFnIFwiJHtDb3BpbG90QWdlbnRNb2RlVGFnfVwiIHdpdGhvdXQgZW5hYmxpbmcgJ2xhbmd1YWdlTW9kZWxUb29sc0ZvckFnZW50JyBwcm9wb3NhbGApO1xuXHRcdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocmF3VG9vbC50YWdzPy5zb21lKHRhZyA9PiB0YWcgIT09IENvcGlsb3RBZ2VudE1vZGVUYWcgJiYgKHRhZy5zdGFydHNXaXRoKCdjb3BpbG90XycpIHx8IHRhZy5zdGFydHNXaXRoKCd2c2NvZGVfJykpKSAmJiAhaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpKSB7XG5cdFx0XHRcdFx0XHRsb2dTZXJ2aWNlLmVycm9yKGBFeHRlbnNpb24gJyR7ZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIudmFsdWV9JyBDQU5OT1QgcmVnaXN0ZXIgdG9vbCB3aXRoIHRhZ3Mgc3RhcnRpbmcgd2l0aCBcInZzY29kZV9cIiBvciBcImNvcGlsb3RfXCJgKTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHJhd0ljb24gPSByYXdUb29sLmljb247XG5cdFx0XHRcdFx0bGV0IGljb246IElUb29sRGF0YVsnaWNvbiddIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdGlmICh0eXBlb2YgcmF3SWNvbiA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdGljb24gPSBUaGVtZUljb24uZnJvbVN0cmluZyhyYXdJY29uKSA/PyB7XG5cdFx0XHRcdFx0XHRcdGRhcms6IGpvaW5QYXRoKGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5leHRlbnNpb25Mb2NhdGlvbiwgcmF3SWNvbiksXG5cdFx0XHRcdFx0XHRcdGxpZ2h0OiBqb2luUGF0aChleHRlbnNpb24uZGVzY3JpcHRpb24uZXh0ZW5zaW9uTG9jYXRpb24sIHJhd0ljb24pXG5cdFx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocmF3SWNvbikge1xuXHRcdFx0XHRcdFx0aWNvbiA9IHtcblx0XHRcdFx0XHRcdFx0ZGFyazogam9pblBhdGgoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLCByYXdJY29uLmRhcmspLFxuXHRcdFx0XHRcdFx0XHRsaWdodDogam9pblBhdGgoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmV4dGVuc2lvbkxvY2F0aW9uLCByYXdJY29uLmxpZ2h0KVxuXHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHQvLyBJZiBPU1MgYW5kIHRoZSBwcm9kdWN0Lmpzb24gaXMgbm90IHNldCB1cCwgZmFsbCBiYWNrIHRvIGNoZWNraW5nIGFwaSBwcm9wb3NhbFxuXHRcdFx0XHRcdGNvbnN0IGlzQnVpbHRpblRvb2wgPSBwcm9kdWN0U2VydmljZS5kZWZhdWx0Q2hhdEFnZW50Py5jaGF0RXh0ZW5zaW9uSWQgP1xuXHRcdFx0XHRcdFx0RXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIsIHByb2R1Y3RTZXJ2aWNlLmRlZmF1bHRDaGF0QWdlbnQuY2hhdEV4dGVuc2lvbklkKSA6XG5cdFx0XHRcdFx0XHRpc1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJyk7XG5cdFx0XHRcdFx0Y29uc3QgdG9vbDogSVRvb2xEYXRhID0ge1xuXHRcdFx0XHRcdFx0Li4ucmF3VG9vbCxcblx0XHRcdFx0XHRcdHNvdXJjZTogeyB0eXBlOiAnZXh0ZW5zaW9uJywgZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLCBpc0V4dGVybmFsVG9vbDogIWlzQnVpbHRpblRvb2wgfSxcblx0XHRcdFx0XHRcdGlucHV0U2NoZW1hOiByYXdUb29sLmlucHV0U2NoZW1hLFxuXHRcdFx0XHRcdFx0aWQ6IHJhd1Rvb2wubmFtZSxcblx0XHRcdFx0XHRcdGljb24sXG5cdFx0XHRcdFx0XHR3aGVuOiByYXdUb29sLndoZW4gPyBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShyYXdUb29sLndoZW4pIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cmVxdWlyZXNDb25maXJtYXRpb246ICFpc0J1aWx0aW5Ub29sLFxuXHRcdFx0XHRcdFx0YWx3YXlzRGlzcGxheUlucHV0T3V0cHV0OiAhaXNCdWlsdGluVG9vbCxcblx0XHRcdFx0XHRcdHN1cHBvcnRzVG9vbFBpY2tlcjogaXNCdWlsdGluVG9vbCA/XG5cdFx0XHRcdFx0XHRcdGZhbHNlIDpcblx0XHRcdFx0XHRcdFx0cmF3VG9vbC5jYW5CZVJlZmVyZW5jZWRJblByb21wdFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdFx0Y29uc3QgZGlzcG9zYWJsZSA9IGxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UucmVnaXN0ZXJUb29sRGF0YSh0b29sKTtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RyYXRpb25EaXNwb3NhYmxlcy5zZXQodG9Ub29sS2V5KGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLCByYXdUb29sLm5hbWUpLCBkaXNwb3NhYmxlKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5yZW1vdmVkKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgdG9vbCBvZiBleHRlbnNpb24udmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLl9yZWdpc3RyYXRpb25EaXNwb3NhYmxlcy5kZWxldGVBbmREaXNwb3NlKHRvVG9vbEtleShleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllciwgdG9vbC5uYW1lKSk7XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KTtcblx0fVxufVxuXG5jbGFzcyBMYW5ndWFnZU1vZGVsVG9vbERhdGFSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIge1xuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5sYW5ndWFnZU1vZGVsVG9vbHM7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbnRyaWJzID0gbWFuaWZlc3QuY29udHJpYnV0ZXM/Lmxhbmd1YWdlTW9kZWxUb29scyA/PyBbXTtcblx0XHRpZiAoIWNvbnRyaWJzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIHsgZGF0YTogeyBoZWFkZXJzOiBbXSwgcm93czogW10gfSwgZGlzcG9zZTogKCkgPT4geyB9IH07XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGVhZGVycyA9IFtcblx0XHRcdGxvY2FsaXplKCd0b29sVGFibGVOYW1lJywgXCJOYW1lXCIpLFxuXHRcdFx0bG9jYWxpemUoJ3Rvb2xUYWJsZURpc3BsYXlOYW1lJywgXCJEaXNwbGF5IE5hbWVcIiksXG5cdFx0XHRsb2NhbGl6ZSgndG9vbFRhYmxlRGVzY3JpcHRpb24nLCBcIkRlc2NyaXB0aW9uXCIpLFxuXHRcdF07XG5cblx0XHRjb25zdCByb3dzOiBJUm93RGF0YVtdW10gPSBjb250cmlicy5tYXAodCA9PiB7XG5cdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRuZXcgTWFya2Rvd25TdHJpbmcoYFxcYCR7dC5uYW1lfVxcYGApLFxuXHRcdFx0XHR0LmRpc3BsYXlOYW1lLFxuXHRcdFx0XHR0LnVzZXJEZXNjcmlwdGlvbiA/PyB0Lm1vZGVsRGVzY3JpcHRpb24sXG5cdFx0XHRdO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRhdGE6IHtcblx0XHRcdFx0aGVhZGVycyxcblx0XHRcdFx0cm93c1xuXHRcdFx0fSxcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgfVxuXHRcdH07XG5cdH1cbn1cblxuUmVnaXN0cnkuYXM8SUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnk+KEV4dGVuc2lvbnMuRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSkucmVnaXN0ZXJFeHRlbnNpb25GZWF0dXJlKHtcblx0aWQ6ICdsYW5ndWFnZU1vZGVsVG9vbHMnLFxuXHRsYWJlbDogbG9jYWxpemUoJ2xhbmdNb2RlbFRvb2xzJywgXCJMYW5ndWFnZSBNb2RlbCBUb29sc1wiKSxcblx0YWNjZXNzOiB7XG5cdFx0Y2FuVG9nZ2xlOiBmYWxzZVxuXHR9LFxuXHRyZW5kZXJlcjogbmV3IFN5bmNEZXNjcmlwdG9yKExhbmd1YWdlTW9kZWxUb29sRGF0YVJlbmRlcmVyKSxcbn0pO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHNCQUFzQjtBQUUvQixTQUFTLFlBQVkscUJBQXFCO0FBQzFDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCO0FBQzFCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQStDO0FBQ3hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsa0JBQW1IO0FBQzVILFNBQVMsNEJBQTRCO0FBQ3JDLFlBQVksd0JBQXdCO0FBQ3BDLFNBQVMsa0NBQTZDO0FBQ3RELFNBQVMscUNBQXFDO0FBZTlDLE1BQU0sbUNBQW1DLG1CQUFtQixtQkFBbUIsdUJBQStDO0FBQUEsRUFDN0gsZ0JBQWdCO0FBQUEsRUFDaEIsMkJBQTJCLENBQUMsZUFBdUMsV0FBVztBQUM3RSxlQUFXLFdBQVcsZUFBZTtBQUNwQyxhQUFPLEtBQUssdUJBQXVCLFFBQVEsSUFBSSxFQUFFO0FBQUEsSUFDbEQ7QUFBQSxFQUNEO0FBQUEsRUFDQSxZQUFZO0FBQUEsSUFDWCxhQUFhLFNBQVMsc0NBQXNDLDZKQUE2SjtBQUFBLElBQ3pOLE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNOLHNCQUFzQjtBQUFBLE1BQ3RCLE1BQU07QUFBQSxNQUNOLGlCQUFpQixDQUFDO0FBQUEsUUFDakIsTUFBTTtBQUFBLFVBQ0wsTUFBTTtBQUFBLFVBQ04sa0JBQWtCO0FBQUEsVUFDbEIsYUFBYTtBQUFBLFlBQ1osTUFBTTtBQUFBLFlBQ04sWUFBWTtBQUFBLGNBQ1gsYUFBYTtBQUFBLGdCQUNaLE1BQU07QUFBQSxnQkFDTixhQUFhO0FBQUEsY0FDZDtBQUFBLFlBQ0Q7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0QsQ0FB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
