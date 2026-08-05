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
import { localize, localize2 } from "../../../../nls.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { MenuId, MenuRegistry } from "../../../../platform/actions/common/actions.js";
import { CommandsRegistry } from "../../../../platform/commands/common/commands.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { IWorkbenchIssueService } from "./issue.js";
const OpenIssueReporterActionId = "workbench.action.openIssueReporter";
const OpenIssueReporterApiId = "vscode.openIssueReporter";
const OpenIssueReporterCommandMetadata = {
  description: "Open the issue reporter and optionally prefill part of the form.",
  args: [
    {
      name: "options",
      description: "Data to use to prefill the issue reporter with.",
      isOptional: true,
      schema: {
        oneOf: [
          {
            type: "string",
            description: "The extension id to preselect."
          },
          {
            type: "object",
            properties: {
              extensionId: {
                type: "string"
              },
              issueTitle: {
                type: "string"
              },
              issueBody: {
                type: "string"
              }
            }
          }
        ]
      }
    }
  ]
};
let BaseIssueContribution = class extends Disposable {
  constructor(productService, configurationService) {
    super();
    if (!configurationService.getValue("telemetry.feedback.enabled")) {
      this._register(CommandsRegistry.registerCommand({
        id: "workbench.action.openIssueReporter",
        handler: function(accessor) {
          const data = accessor.get(INotificationService);
          data.info("Feedback is disabled.");
        }
      }));
      return;
    }
    if (!productService.reportIssueUrl) {
      return;
    }
    this._register(CommandsRegistry.registerCommand({
      id: OpenIssueReporterActionId,
      handler: function(accessor, args) {
        const data = typeof args === "string" ? { extensionId: args } : Array.isArray(args) ? { extensionId: args[0] } : args ?? {};
        return accessor.get(IWorkbenchIssueService).openReporter(data);
      },
      metadata: OpenIssueReporterCommandMetadata
    }));
    this._register(CommandsRegistry.registerCommand({
      id: OpenIssueReporterApiId,
      handler: function(accessor, args) {
        const data = typeof args === "string" ? { extensionId: args } : Array.isArray(args) ? { extensionId: args[0] } : args ?? {};
        return accessor.get(IWorkbenchIssueService).openReporter(data);
      },
      metadata: OpenIssueReporterCommandMetadata
    }));
    const reportIssue = {
      id: OpenIssueReporterActionId,
      title: localize2({ key: "reportIssueInEnglish", comment: ['Translate this to "Report Issue in English" in all languages please!'] }, "Report Issue..."),
      category: Categories.Help
    };
    this._register(MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: reportIssue }));
    this._register(MenuRegistry.appendMenuItem(MenuId.MenubarHelpMenu, {
      group: "3_feedback",
      command: {
        id: OpenIssueReporterActionId,
        title: localize({ key: "miReportIssue", comment: ["&& denotes a mnemonic", 'Translate this to "Report Issue in English" in all languages please!'] }, "Report &&Issue")
      },
      order: 3
    }));
  }
};
BaseIssueContribution = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IConfigurationService)
], BaseIssueContribution);
export {
  BaseIssueContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9pc3N1ZS9jb21tb24vaXNzdWUuY29udHJpYnV0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSwgbG9jYWxpemUyIH0gZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElDb21tYW5kQWN0aW9uIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWN0aW9uL2NvbW1vbi9hY3Rpb24uanMnO1xuaW1wb3J0IHsgQ2F0ZWdvcmllcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbi9jb21tb24vYWN0aW9uQ29tbW9uQ2F0ZWdvcmllcy5qcyc7XG5pbXBvcnQgeyBNZW51SWQsIE1lbnVSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2FjdGlvbnMvY29tbW9uL2FjdGlvbnMuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNSZWdpc3RyeSwgSUNvbW1hbmRNZXRhZGF0YSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2NvbW1hbmRzL2NvbW1vbi9jb21tYW5kcy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IElzc3VlUmVwb3J0ZXJEYXRhLCBJV29ya2JlbmNoSXNzdWVTZXJ2aWNlIH0gZnJvbSAnLi9pc3N1ZS5qcyc7XG5cbmNvbnN0IE9wZW5Jc3N1ZVJlcG9ydGVyQWN0aW9uSWQgPSAnd29ya2JlbmNoLmFjdGlvbi5vcGVuSXNzdWVSZXBvcnRlcic7XG5jb25zdCBPcGVuSXNzdWVSZXBvcnRlckFwaUlkID0gJ3ZzY29kZS5vcGVuSXNzdWVSZXBvcnRlcic7XG5cbmNvbnN0IE9wZW5Jc3N1ZVJlcG9ydGVyQ29tbWFuZE1ldGFkYXRhOiBJQ29tbWFuZE1ldGFkYXRhID0ge1xuXHRkZXNjcmlwdGlvbjogJ09wZW4gdGhlIGlzc3VlIHJlcG9ydGVyIGFuZCBvcHRpb25hbGx5IHByZWZpbGwgcGFydCBvZiB0aGUgZm9ybS4nLFxuXHRhcmdzOiBbXG5cdFx0e1xuXHRcdFx0bmFtZTogJ29wdGlvbnMnLFxuXHRcdFx0ZGVzY3JpcHRpb246ICdEYXRhIHRvIHVzZSB0byBwcmVmaWxsIHRoZSBpc3N1ZSByZXBvcnRlciB3aXRoLicsXG5cdFx0XHRpc09wdGlvbmFsOiB0cnVlLFxuXHRcdFx0c2NoZW1hOiB7XG5cdFx0XHRcdG9uZU9mOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ1RoZSBleHRlbnNpb24gaWQgdG8gcHJlc2VsZWN0Lidcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRleHRlbnNpb25JZDoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGlzc3VlVGl0bGU6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRpc3N1ZUJvZHk6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9LFxuXHRdXG59O1xuXG5pbnRlcmZhY2UgT3Blbklzc3VlUmVwb3J0ZXJBcmdzIHtcblx0cmVhZG9ubHkgZXh0ZW5zaW9uSWQ/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGlzc3VlVGl0bGU/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGlzc3VlQm9keT86IHN0cmluZztcblx0cmVhZG9ubHkgZXh0ZW5zaW9uRGF0YT86IHN0cmluZztcbn1cblxuZXhwb3J0IGNsYXNzIEJhc2VJc3N1ZUNvbnRyaWJ1dGlvbiBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0QElQcm9kdWN0U2VydmljZSBwcm9kdWN0U2VydmljZTogSVByb2R1Y3RTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmICghY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8Ym9vbGVhbj4oJ3RlbGVtZXRyeS5mZWVkYmFjay5lbmFibGVkJykpIHtcblx0XHRcdHRoaXMuX3JlZ2lzdGVyKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLm9wZW5Jc3N1ZVJlcG9ydGVyJyxcblx0XHRcdFx0aGFuZGxlcjogZnVuY3Rpb24gKGFjY2Vzc29yKSB7XG5cdFx0XHRcdFx0Y29uc3QgZGF0YSA9IGFjY2Vzc29yLmdldChJTm90aWZpY2F0aW9uU2VydmljZSk7XG5cdFx0XHRcdFx0ZGF0YS5pbmZvKCdGZWVkYmFjayBpcyBkaXNhYmxlZC4nKTtcblxuXHRcdFx0XHR9LFxuXHRcdFx0fSkpO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGlmICghcHJvZHVjdFNlcnZpY2UucmVwb3J0SXNzdWVVcmwpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihDb21tYW5kc1JlZ2lzdHJ5LnJlZ2lzdGVyQ29tbWFuZCh7XG5cdFx0XHRpZDogT3Blbklzc3VlUmVwb3J0ZXJBY3Rpb25JZCxcblx0XHRcdGhhbmRsZXI6IGZ1bmN0aW9uIChhY2Nlc3NvciwgYXJncz86IHN0cmluZyB8IFtzdHJpbmddIHwgT3Blbklzc3VlUmVwb3J0ZXJBcmdzKSB7XG5cdFx0XHRcdGNvbnN0IGRhdGE6IFBhcnRpYWw8SXNzdWVSZXBvcnRlckRhdGE+ID1cblx0XHRcdFx0XHR0eXBlb2YgYXJncyA9PT0gJ3N0cmluZydcblx0XHRcdFx0XHRcdD8geyBleHRlbnNpb25JZDogYXJncyB9XG5cdFx0XHRcdFx0XHQ6IEFycmF5LmlzQXJyYXkoYXJncylcblx0XHRcdFx0XHRcdFx0PyB7IGV4dGVuc2lvbklkOiBhcmdzWzBdIH1cblx0XHRcdFx0XHRcdFx0OiBhcmdzID8/IHt9O1xuXG5cdFx0XHRcdHJldHVybiBhY2Nlc3Nvci5nZXQoSVdvcmtiZW5jaElzc3VlU2VydmljZSkub3BlblJlcG9ydGVyKGRhdGEpO1xuXHRcdFx0fSxcblx0XHRcdG1ldGFkYXRhOiBPcGVuSXNzdWVSZXBvcnRlckNvbW1hbmRNZXRhZGF0YVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKENvbW1hbmRzUmVnaXN0cnkucmVnaXN0ZXJDb21tYW5kKHtcblx0XHRcdGlkOiBPcGVuSXNzdWVSZXBvcnRlckFwaUlkLFxuXHRcdFx0aGFuZGxlcjogZnVuY3Rpb24gKGFjY2Vzc29yLCBhcmdzPzogc3RyaW5nIHwgW3N0cmluZ10gfCBPcGVuSXNzdWVSZXBvcnRlckFyZ3MpIHtcblx0XHRcdFx0Y29uc3QgZGF0YTogUGFydGlhbDxJc3N1ZVJlcG9ydGVyRGF0YT4gPVxuXHRcdFx0XHRcdHR5cGVvZiBhcmdzID09PSAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0PyB7IGV4dGVuc2lvbklkOiBhcmdzIH1cblx0XHRcdFx0XHRcdDogQXJyYXkuaXNBcnJheShhcmdzKVxuXHRcdFx0XHRcdFx0XHQ/IHsgZXh0ZW5zaW9uSWQ6IGFyZ3NbMF0gfVxuXHRcdFx0XHRcdFx0XHQ6IGFyZ3MgPz8ge307XG5cblx0XHRcdFx0cmV0dXJuIGFjY2Vzc29yLmdldChJV29ya2JlbmNoSXNzdWVTZXJ2aWNlKS5vcGVuUmVwb3J0ZXIoZGF0YSk7XG5cdFx0XHR9LFxuXHRcdFx0bWV0YWRhdGE6IE9wZW5Jc3N1ZVJlcG9ydGVyQ29tbWFuZE1ldGFkYXRhXG5cdFx0fSkpO1xuXG5cdFx0Y29uc3QgcmVwb3J0SXNzdWU6IElDb21tYW5kQWN0aW9uID0ge1xuXHRcdFx0aWQ6IE9wZW5Jc3N1ZVJlcG9ydGVyQWN0aW9uSWQsXG5cdFx0XHR0aXRsZTogbG9jYWxpemUyKHsga2V5OiAncmVwb3J0SXNzdWVJbkVuZ2xpc2gnLCBjb21tZW50OiBbJ1RyYW5zbGF0ZSB0aGlzIHRvIFwiUmVwb3J0IElzc3VlIGluIEVuZ2xpc2hcIiBpbiBhbGwgbGFuZ3VhZ2VzIHBsZWFzZSEnXSB9LCBcIlJlcG9ydCBJc3N1ZS4uLlwiKSxcblx0XHRcdGNhdGVnb3J5OiBDYXRlZ29yaWVzLkhlbHBcblx0XHR9O1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIoTWVudVJlZ2lzdHJ5LmFwcGVuZE1lbnVJdGVtKE1lbnVJZC5Db21tYW5kUGFsZXR0ZSwgeyBjb21tYW5kOiByZXBvcnRJc3N1ZSB9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihNZW51UmVnaXN0cnkuYXBwZW5kTWVudUl0ZW0oTWVudUlkLk1lbnViYXJIZWxwTWVudSwge1xuXHRcdFx0Z3JvdXA6ICczX2ZlZWRiYWNrJyxcblx0XHRcdGNvbW1hbmQ6IHtcblx0XHRcdFx0aWQ6IE9wZW5Jc3N1ZVJlcG9ydGVyQWN0aW9uSWQsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZSh7IGtleTogJ21pUmVwb3J0SXNzdWUnLCBjb21tZW50OiBbJyYmIGRlbm90ZXMgYSBtbmVtb25pYycsICdUcmFuc2xhdGUgdGhpcyB0byBcIlJlcG9ydCBJc3N1ZSBpbiBFbmdsaXNoXCIgaW4gYWxsIGxhbmd1YWdlcyBwbGVhc2UhJ10gfSwgXCJSZXBvcnQgJiZJc3N1ZVwiKVxuXHRcdFx0fSxcblx0XHRcdG9yZGVyOiAzXG5cdFx0fSkpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsVUFBVSxpQkFBaUI7QUFFcEMsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxRQUFRLG9CQUFvQjtBQUNyQyxTQUFTLHdCQUEwQztBQUNuRCxTQUFTLDZCQUE2QjtBQUN0QyxTQUFTLDRCQUE0QjtBQUNyQyxTQUFTLHVCQUF1QjtBQUVoQyxTQUE0Qiw4QkFBOEI7QUFFMUQsTUFBTSw0QkFBNEI7QUFDbEMsTUFBTSx5QkFBeUI7QUFFL0IsTUFB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
