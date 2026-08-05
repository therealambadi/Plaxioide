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
import { ThemeIcon } from "../../../../../base/common/themables.js";
import { localize } from "../../../../../nls.js";
import { ContextKeyExpr } from "../../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../../platform/log/common/log.js";
import { Registry } from "../../../../../platform/registry/common/platform.js";
import { checkProposedApiEnabled } from "../../../../services/extensions/common/extensions.js";
import * as extensionsRegistry from "../../../../services/extensions/common/extensionsRegistry.js";
import { ChatViewsWelcomeExtensions } from "./chatViewsWelcome.js";
const chatViewsWelcomeExtensionPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "chatViewsWelcome",
  jsonSchema: {
    description: localize("vscode.extension.contributes.chatViewsWelcome", "Contributes a welcome message to a chat view"),
    type: "array",
    items: {
      additionalProperties: false,
      type: "object",
      properties: {
        icon: {
          type: "string",
          description: localize("chatViewsWelcome.icon", "The icon for the welcome message.")
        },
        title: {
          type: "string",
          description: localize("chatViewsWelcome.title", "The title of the welcome message.")
        },
        content: {
          type: "string",
          description: localize("chatViewsWelcome.content", "The content of the welcome message. The first command link will be rendered as a button.")
        },
        when: {
          type: "string",
          description: localize("chatViewsWelcome.when", "Condition when the welcome message is shown.")
        }
      }
    },
    required: ["icon", "title", "contents", "when"]
  }
});
let ChatViewsWelcomeHandler = class {
  constructor(logService) {
    this.logService = logService;
    chatViewsWelcomeExtensionPoint.setHandler((extensions, delta) => {
      for (const extension of delta.added) {
        for (const providerDescriptor of extension.value) {
          checkProposedApiEnabled(extension.description, "chatParticipantPrivate");
          const when = ContextKeyExpr.deserialize(providerDescriptor.when);
          if (!when) {
            this.logService.error(`Could not deserialize 'when' clause for chatViewsWelcome contribution: ${providerDescriptor.when}`);
            continue;
          }
          const descriptor = {
            ...providerDescriptor,
            when,
            icon: ThemeIcon.fromString(providerDescriptor.icon),
            content: new MarkdownString(providerDescriptor.content, { isTrusted: true })
            // private API with command links
          };
          Registry.as(ChatViewsWelcomeExtensions.ChatViewsWelcomeRegistry).register(descriptor);
        }
      }
    });
  }
};
ChatViewsWelcomeHandler.ID = "workbench.contrib.chatViewsWelcomeHandler";
ChatViewsWelcomeHandler = __decorateClass([
  __decorateParam(0, ILogService)
], ChatViewsWelcomeHandler);
export {
  ChatViewsWelcomeHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvdmlld3NXZWxjb21lL2NoYXRWaWV3c1dlbGNvbWVIYW5kbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2NvbW1vbi9jb250cmlidXRpb25zLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkIH0gZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgKiBhcyBleHRlbnNpb25zUmVnaXN0cnkgZnJvbSAnLi4vLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IENoYXRWaWV3c1dlbGNvbWVFeHRlbnNpb25zLCBJQ2hhdFZpZXdzV2VsY29tZUNvbnRyaWJ1dGlvblJlZ2lzdHJ5LCBJQ2hhdFZpZXdzV2VsY29tZURlc2NyaXB0b3IgfSBmcm9tICcuL2NoYXRWaWV3c1dlbGNvbWUuanMnO1xuXG5pbnRlcmZhY2UgSVJhd0NoYXRWaWV3c1dlbGNvbWVDb250cmlidXRpb24ge1xuXHRpY29uOiBzdHJpbmc7XG5cdHRpdGxlOiBzdHJpbmc7XG5cdGNvbnRlbnQ6IHN0cmluZztcblx0d2hlbjogc3RyaW5nO1xufVxuXG5jb25zdCBjaGF0Vmlld3NXZWxjb21lRXh0ZW5zaW9uUG9pbnQgPSBleHRlbnNpb25zUmVnaXN0cnkuRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SVJhd0NoYXRWaWV3c1dlbGNvbWVDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2NoYXRWaWV3c1dlbGNvbWUnLFxuXHRqc29uU2NoZW1hOiB7XG5cdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNoYXRWaWV3c1dlbGNvbWUnLCAnQ29udHJpYnV0ZXMgYSB3ZWxjb21lIG1lc3NhZ2UgdG8gYSBjaGF0IHZpZXcnKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0aWNvbjoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFZpZXdzV2VsY29tZS5pY29uJywgJ1RoZSBpY29uIGZvciB0aGUgd2VsY29tZSBtZXNzYWdlLicpLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR0aXRsZToge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFZpZXdzV2VsY29tZS50aXRsZScsICdUaGUgdGl0bGUgb2YgdGhlIHdlbGNvbWUgbWVzc2FnZS4nKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0Y29udGVudDoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFZpZXdzV2VsY29tZS5jb250ZW50JywgJ1RoZSBjb250ZW50IG9mIHRoZSB3ZWxjb21lIG1lc3NhZ2UuIFRoZSBmaXJzdCBjb21tYW5kIGxpbmsgd2lsbCBiZSByZW5kZXJlZCBhcyBhIGJ1dHRvbi4nKSxcblx0XHRcdFx0fSxcblx0XHRcdFx0d2hlbjoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnY2hhdFZpZXdzV2VsY29tZS53aGVuJywgJ0NvbmRpdGlvbiB3aGVuIHRoZSB3ZWxjb21lIG1lc3NhZ2UgaXMgc2hvd24uJyksXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHJlcXVpcmVkOiBbJ2ljb24nLCAndGl0bGUnLCAnY29udGVudHMnLCAnd2hlbiddLFxuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIENoYXRWaWV3c1dlbGNvbWVIYW5kbGVyIGltcGxlbWVudHMgSVdvcmtiZW5jaENvbnRyaWJ1dGlvbiB7XG5cblx0c3RhdGljIHJlYWRvbmx5IElEID0gJ3dvcmtiZW5jaC5jb250cmliLmNoYXRWaWV3c1dlbGNvbWVIYW5kbGVyJztcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0KSB7XG5cdFx0Y2hhdFZpZXdzV2VsY29tZUV4dGVuc2lvblBvaW50LnNldEhhbmRsZXIoKGV4dGVuc2lvbnMsIGRlbHRhKSA9PiB7XG5cdFx0XHRmb3IgKGNvbnN0IGV4dGVuc2lvbiBvZiBkZWx0YS5hZGRlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IHByb3ZpZGVyRGVzY3JpcHRvciBvZiBleHRlbnNpb24udmFsdWUpIHtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZChleHRlbnNpb24uZGVzY3JpcHRpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJyk7XG5cblx0XHRcdFx0XHRjb25zdCB3aGVuID0gQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUocHJvdmlkZXJEZXNjcmlwdG9yLndoZW4pO1xuXHRcdFx0XHRcdGlmICghd2hlbikge1xuXHRcdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDb3VsZCBub3QgZGVzZXJpYWxpemUgJ3doZW4nIGNsYXVzZSBmb3IgY2hhdFZpZXdzV2VsY29tZSBjb250cmlidXRpb246ICR7cHJvdmlkZXJEZXNjcmlwdG9yLndoZW59YCk7XG5cdFx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBkZXNjcmlwdG9yOiBJQ2hhdFZpZXdzV2VsY29tZURlc2NyaXB0b3IgPSB7XG5cdFx0XHRcdFx0XHQuLi5wcm92aWRlckRlc2NyaXB0b3IsXG5cdFx0XHRcdFx0XHR3aGVuLFxuXHRcdFx0XHRcdFx0aWNvbjogVGhlbWVJY29uLmZyb21TdHJpbmcocHJvdmlkZXJEZXNjcmlwdG9yLmljb24pLFxuXHRcdFx0XHRcdFx0Y29udGVudDogbmV3IE1hcmtkb3duU3RyaW5nKHByb3ZpZGVyRGVzY3JpcHRvci5jb250ZW50LCB7IGlzVHJ1c3RlZDogdHJ1ZSB9KSwgLy8gcHJpdmF0ZSBBUEkgd2l0aCBjb21tYW5kIGxpbmtzXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRSZWdpc3RyeS5hczxJQ2hhdFZpZXdzV2VsY29tZUNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihDaGF0Vmlld3NXZWxjb21lRXh0ZW5zaW9ucy5DaGF0Vmlld3NXZWxjb21lUmVnaXN0cnkpLnJlZ2lzdGVyKGRlc2NyaXB0b3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUywrQkFBK0I7QUFDeEMsWUFBWSx3QkFBd0I7QUFDcEMsU0FBUyxrQ0FBc0c7QUFTL0csTUFBTSxpQ0FBaUMsbUJBQW1CLG1CQUFtQix1QkFBMkQ7QUFBQSxFQUN2SSxnQkFBZ0I7QUFBQSxFQUNoQixZQUFZO0FBQUEsSUFDWCxhQUFhLFNBQVMsaURBQWlELDhDQUE4QztBQUFBLElBQ3JILE1BQU07QUFBQSxJQUNOLE9BQU87QUFBQSxNQUNOLHNCQUFzQjtBQUFBLE1BQ3RCLE1BQU07QUFBQSxNQUNOLFlBQVk7QUFBQSxRQUNYLE1BQU07QUFBQSxVQUNMLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUyx5QkFBeUIsbUNBQW1DO0FBQUEsUUFDbkY7QUFBQSxRQUNBLE9BQU87QUFBQSxVQUNOLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUywwQkFBMEIsbUNBQW1DO0FBQUEsUUFDcEY7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUyw0QkFBNEIsMEZBQTBGO0FBQUEsUUFDN0k7QUFBQSxRQUNBLE1BQU07QUFBQSxVQUNMLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUyx5QkFBeUIsOENBQThDO0FBQUEsUUFDOUY7QUFBQSxNQUNEO0FBQUEsSUFDRDtBQUFBLElBQ0EsVUFBVSxDQUFDLFFBQVEsU0FBUyxZQUFZLE1BQU07QUFBQSxFQUMvQztBQUNELENBQUM7QUFFTSxJQUFNLDBCQUFOLE1BQWdFO0FBQUEsRUFJdEUsWUFDK0IsWUFDN0I7QUFENkI7QUFFOUIsbUNBQStCLFdBQVcsQ0FBQyxZQUFZLFVBQVU7QUFDaEUsaUJBQVcsYUFBYSxNQUFNLE9BQU87QUFDcEMsbUJBQVcsc0JBQXNCLFVBQVUsT0FBTztBQUNqRCxrQ0FBd0IsVUFBVSxhQUFhLHdCQUF3QjtBQUV2RSxnQkFBTSxPQUFPLGVBQWUsWUFBWSxtQkFBbUIsSUFBSTtBQUMvRCxjQUFJLENBQUMsTUFBTTtBQUNWLGlCQUFLLFdBQVcsTUFBTSwwRUFBMEUsbUJBQW1CLElBQUksRUFBRTtBQUN6SDtBQUFBLFVBQ0Q7QUFFQSxnQkFBTSxhQUEwQztBQUFBLFlBQy9DLEdBQUc7QUFBQSxZQUNIO0FBQUEsWUFDQSxNQUFNLFVBQVUsV0FBVyxtQkFBbUIsSUFBSTtBQUFBLFlBQ2xELFNBQVMsSUFBSSxlQUFlLG1CQUFtQixTQUFTLEVBQUUsV0FBVyxLQUFLLENBQUM7QUFBQTtBQUFBLFVBQzVFO0FBQ0EsbUJBQVMsR0FBMEMsMkJBQTJCLHdCQUF3QixFQUFFLFNBQVMsVUFBVTtBQUFBLFFBQzVIO0FBQUEsTUFDRDtBQUFBLElBQ0QsQ0FBQztBQUFBLEVBQ0Y7QUFDRDtBQTdCYSx3QkFFSSxLQUFLO0FBRlQsMEJBQU47QUFBQSxFQUtKO0FBQUEsR0FMVTsiLAogICJuYW1lcyI6IFtdCn0K
