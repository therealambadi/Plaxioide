import { coalesce } from "../../../../base/common/arrays.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import * as nls from "../../../../nls.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { CustomEditorPriority } from "./customEditor.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { languagesExtPoint } from "../../../services/language/common/languageService.js";
const Fields = Object.freeze({
  viewType: "viewType",
  displayName: "displayName",
  selector: "selector",
  priority: "priority"
});
const CustomEditorsContribution = {
  description: nls.localize("contributes.customEditors", "Contributed custom editors."),
  type: "array",
  defaultSnippets: [{
    body: [{
      [Fields.viewType]: "$1",
      [Fields.displayName]: "$2",
      [Fields.selector]: [{
        filenamePattern: "$3"
      }]
    }]
  }],
  items: {
    type: "object",
    required: [
      Fields.viewType,
      Fields.displayName,
      Fields.selector
    ],
    properties: {
      [Fields.viewType]: {
        type: "string",
        markdownDescription: nls.localize("contributes.viewType", "Identifier for the custom editor. This must be unique across all custom editors, so we recommend including your extension id as part of `viewType`. The `viewType` is used when registering custom editors with `vscode.registerCustomEditorProvider` and in the `onCustomEditor:${id}` [activation event](https://code.visualstudio.com/api/references/activation-events).")
      },
      [Fields.displayName]: {
        type: "string",
        description: nls.localize("contributes.displayName", "Human readable name of the custom editor. This is displayed to users when selecting which editor to use.")
      },
      [Fields.selector]: {
        type: "array",
        description: nls.localize("contributes.selector", "Set of globs that the custom editor is enabled for."),
        items: {
          type: "object",
          defaultSnippets: [{
            body: {
              filenamePattern: "$1"
            }
          }],
          properties: {
            filenamePattern: {
              type: "string",
              description: nls.localize("contributes.selector.filenamePattern", "Glob that the custom editor is enabled for.")
            }
          }
        }
      },
      [Fields.priority]: {
        type: "string",
        markdownDeprecationMessage: nls.localize("contributes.priority", "Controls if the custom editor is enabled automatically when the user opens a file. This may be overridden by users using the `workbench.editorAssociations` setting."),
        enum: [
          CustomEditorPriority.default,
          CustomEditorPriority.option
        ],
        markdownEnumDescriptions: [
          nls.localize("contributes.priority.default", "The editor is automatically used when the user opens a resource, provided that no other default custom editors are registered for that resource."),
          nls.localize("contributes.priority.option", "The editor is not automatically used when the user opens a resource, but a user can switch to the editor using the `Reopen With` command.")
        ],
        default: "default"
      }
    }
  }
};
const customEditorsExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "customEditors",
  deps: [languagesExtPoint],
  jsonSchema: CustomEditorsContribution,
  activationEventsGenerator: (contribs, result) => {
    for (const contrib of contribs) {
      const viewType = contrib[Fields.viewType];
      if (viewType) {
        result.push(`onCustomEditor:${viewType}`);
      }
    }
  }
});
class CustomEditorsDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.customEditors;
  }
  render(manifest) {
    const customEditors = manifest.contributes?.customEditors || [];
    if (!customEditors.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("customEditors view type", "View Type"),
      nls.localize("customEditors priority", "Priority"),
      nls.localize("customEditors filenamePattern", "Filename Pattern")
    ];
    const rows = customEditors.map((customEditor) => {
      return [
        customEditor.viewType,
        customEditor.priority ?? "",
        coalesce(customEditor.selector.map((x) => x.filenamePattern)).join(", ")
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
  id: "customEditors",
  label: nls.localize("customEditors", "Custom Editors"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(CustomEditorsDataRenderer)
});
export {
  customEditorsExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jdXN0b21FZGl0b3IvY29tbW9uL2V4dGVuc2lvblBvaW50LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgY29hbGVzY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXMuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IFN5bmNEZXNjcmlwdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZGVzY3JpcHRvcnMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgQ3VzdG9tRWRpdG9yUHJpb3JpdHksIEN1c3RvbUVkaXRvclNlbGVjdG9yIH0gZnJvbSAnLi9jdXN0b21FZGl0b3IuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucywgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyLCBJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeSwgSVJlbmRlcmVkRGF0YSwgSVJvd0RhdGEsIElUYWJsZURhdGEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25GZWF0dXJlcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgbGFuZ3VhZ2VzRXh0UG9pbnQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9sYW5ndWFnZS9jb21tb24vbGFuZ3VhZ2VTZXJ2aWNlLmpzJztcblxuY29uc3QgRmllbGRzID0gT2JqZWN0LmZyZWV6ZSh7XG5cdHZpZXdUeXBlOiAndmlld1R5cGUnLFxuXHRkaXNwbGF5TmFtZTogJ2Rpc3BsYXlOYW1lJyxcblx0c2VsZWN0b3I6ICdzZWxlY3RvcicsXG5cdHByaW9yaXR5OiAncHJpb3JpdHknLFxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUN1c3RvbUVkaXRvcnNFeHRlbnNpb25Qb2ludCB7XG5cdHJlYWRvbmx5IFtGaWVsZHMudmlld1R5cGVdOiBzdHJpbmc7XG5cdHJlYWRvbmx5IFtGaWVsZHMuZGlzcGxheU5hbWVdOiBzdHJpbmc7XG5cdHJlYWRvbmx5IFtGaWVsZHMuc2VsZWN0b3JdPzogcmVhZG9ubHkgQ3VzdG9tRWRpdG9yU2VsZWN0b3JbXTtcblx0cmVhZG9ubHkgW0ZpZWxkcy5wcmlvcml0eV0/OiBzdHJpbmc7XG59XG5cbmNvbnN0IEN1c3RvbUVkaXRvcnNDb250cmlidXRpb246IElKU09OU2NoZW1hID0ge1xuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5jdXN0b21FZGl0b3JzJywgJ0NvbnRyaWJ1dGVkIGN1c3RvbSBlZGl0b3JzLicpLFxuXHR0eXBlOiAnYXJyYXknLFxuXHRkZWZhdWx0U25pcHBldHM6IFt7XG5cdFx0Ym9keTogW3tcblx0XHRcdFtGaWVsZHMudmlld1R5cGVdOiAnJDEnLFxuXHRcdFx0W0ZpZWxkcy5kaXNwbGF5TmFtZV06ICckMicsXG5cdFx0XHRbRmllbGRzLnNlbGVjdG9yXTogW3tcblx0XHRcdFx0ZmlsZW5hbWVQYXR0ZXJuOiAnJDMnXG5cdFx0XHR9XSxcblx0XHR9XVxuXHR9XSxcblx0aXRlbXM6IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRyZXF1aXJlZDogW1xuXHRcdFx0RmllbGRzLnZpZXdUeXBlLFxuXHRcdFx0RmllbGRzLmRpc3BsYXlOYW1lLFxuXHRcdFx0RmllbGRzLnNlbGVjdG9yLFxuXHRcdF0sXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0W0ZpZWxkcy52aWV3VHlwZV06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMudmlld1R5cGUnLCAnSWRlbnRpZmllciBmb3IgdGhlIGN1c3RvbSBlZGl0b3IuIFRoaXMgbXVzdCBiZSB1bmlxdWUgYWNyb3NzIGFsbCBjdXN0b20gZWRpdG9ycywgc28gd2UgcmVjb21tZW5kIGluY2x1ZGluZyB5b3VyIGV4dGVuc2lvbiBpZCBhcyBwYXJ0IG9mIGB2aWV3VHlwZWAuIFRoZSBgdmlld1R5cGVgIGlzIHVzZWQgd2hlbiByZWdpc3RlcmluZyBjdXN0b20gZWRpdG9ycyB3aXRoIGB2c2NvZGUucmVnaXN0ZXJDdXN0b21FZGl0b3JQcm92aWRlcmAgYW5kIGluIHRoZSBgb25DdXN0b21FZGl0b3I6JHtpZH1gIFthY3RpdmF0aW9uIGV2ZW50XShodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9hcGkvcmVmZXJlbmNlcy9hY3RpdmF0aW9uLWV2ZW50cykuJyksXG5cdFx0XHR9LFxuXHRcdFx0W0ZpZWxkcy5kaXNwbGF5TmFtZV06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLmRpc3BsYXlOYW1lJywgJ0h1bWFuIHJlYWRhYmxlIG5hbWUgb2YgdGhlIGN1c3RvbSBlZGl0b3IuIFRoaXMgaXMgZGlzcGxheWVkIHRvIHVzZXJzIHdoZW4gc2VsZWN0aW5nIHdoaWNoIGVkaXRvciB0byB1c2UuJyksXG5cdFx0XHR9LFxuXHRcdFx0W0ZpZWxkcy5zZWxlY3Rvcl06IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMuc2VsZWN0b3InLCAnU2V0IG9mIGdsb2JzIHRoYXQgdGhlIGN1c3RvbSBlZGl0b3IgaXMgZW5hYmxlZCBmb3IuJyksXG5cdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbe1xuXHRcdFx0XHRcdFx0Ym9keToge1xuXHRcdFx0XHRcdFx0XHRmaWxlbmFtZVBhdHRlcm46ICckMScsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV0sXG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0ZmlsZW5hbWVQYXR0ZXJuOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5zZWxlY3Rvci5maWxlbmFtZVBhdHRlcm4nLCAnR2xvYiB0aGF0IHRoZSBjdXN0b20gZWRpdG9yIGlzIGVuYWJsZWQgZm9yLicpLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRbRmllbGRzLnByaW9yaXR5XToge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0bWFya2Rvd25EZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMucHJpb3JpdHknLCAnQ29udHJvbHMgaWYgdGhlIGN1c3RvbSBlZGl0b3IgaXMgZW5hYmxlZCBhdXRvbWF0aWNhbGx5IHdoZW4gdGhlIHVzZXIgb3BlbnMgYSBmaWxlLiBUaGlzIG1heSBiZSBvdmVycmlkZGVuIGJ5IHVzZXJzIHVzaW5nIHRoZSBgd29ya2JlbmNoLmVkaXRvckFzc29jaWF0aW9uc2Agc2V0dGluZy4nKSxcblx0XHRcdFx0ZW51bTogW1xuXHRcdFx0XHRcdEN1c3RvbUVkaXRvclByaW9yaXR5LmRlZmF1bHQsXG5cdFx0XHRcdFx0Q3VzdG9tRWRpdG9yUHJpb3JpdHkub3B0aW9uLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnByaW9yaXR5LmRlZmF1bHQnLCAnVGhlIGVkaXRvciBpcyBhdXRvbWF0aWNhbGx5IHVzZWQgd2hlbiB0aGUgdXNlciBvcGVucyBhIHJlc291cmNlLCBwcm92aWRlZCB0aGF0IG5vIG90aGVyIGRlZmF1bHQgY3VzdG9tIGVkaXRvcnMgYXJlIHJlZ2lzdGVyZWQgZm9yIHRoYXQgcmVzb3VyY2UuJyksXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5wcmlvcml0eS5vcHRpb24nLCAnVGhlIGVkaXRvciBpcyBub3QgYXV0b21hdGljYWxseSB1c2VkIHdoZW4gdGhlIHVzZXIgb3BlbnMgYSByZXNvdXJjZSwgYnV0IGEgdXNlciBjYW4gc3dpdGNoIHRvIHRoZSBlZGl0b3IgdXNpbmcgdGhlIGBSZW9wZW4gV2l0aGAgY29tbWFuZC4nKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVmYXVsdDogJ2RlZmF1bHQnXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG5leHBvcnQgY29uc3QgY3VzdG9tRWRpdG9yc0V4dGVuc2lvblBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SUN1c3RvbUVkaXRvcnNFeHRlbnNpb25Qb2ludFtdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnY3VzdG9tRWRpdG9ycycsXG5cdGRlcHM6IFtsYW5ndWFnZXNFeHRQb2ludF0sXG5cdGpzb25TY2hlbWE6IEN1c3RvbUVkaXRvcnNDb250cmlidXRpb24sXG5cdGFjdGl2YXRpb25FdmVudHNHZW5lcmF0b3I6IChjb250cmliczogSUN1c3RvbUVkaXRvcnNFeHRlbnNpb25Qb2ludFtdLCByZXN1bHQ6IHsgcHVzaChpdGVtOiBzdHJpbmcpOiB2b2lkIH0pID0+IHtcblx0XHRmb3IgKGNvbnN0IGNvbnRyaWIgb2YgY29udHJpYnMpIHtcblx0XHRcdGNvbnN0IHZpZXdUeXBlID0gY29udHJpYltGaWVsZHMudmlld1R5cGVdO1xuXHRcdFx0aWYgKHZpZXdUeXBlKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGBvbkN1c3RvbUVkaXRvcjoke3ZpZXdUeXBlfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fSxcbn0pO1xuXG5jbGFzcyBDdXN0b21FZGl0b3JzRGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdHlwZSA9ICd0YWJsZSc7XG5cblx0c2hvdWxkUmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFtYW5pZmVzdC5jb250cmlidXRlcz8uY3VzdG9tRWRpdG9ycztcblx0fVxuXG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxJVGFibGVEYXRhPiB7XG5cdFx0Y29uc3QgY3VzdG9tRWRpdG9ycyA9IG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5jdXN0b21FZGl0b3JzIHx8IFtdO1xuXHRcdGlmICghY3VzdG9tRWRpdG9ycy5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IHsgaGVhZGVyczogW10sIHJvd3M6IFtdIH0sIGRpc3Bvc2U6ICgpID0+IHsgfSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXG5cdFx0XHRubHMubG9jYWxpemUoJ2N1c3RvbUVkaXRvcnMgdmlldyB0eXBlJywgXCJWaWV3IFR5cGVcIiksXG5cdFx0XHRubHMubG9jYWxpemUoJ2N1c3RvbUVkaXRvcnMgcHJpb3JpdHknLCBcIlByaW9yaXR5XCIpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdjdXN0b21FZGl0b3JzIGZpbGVuYW1lUGF0dGVybicsIFwiRmlsZW5hbWUgUGF0dGVyblwiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gY3VzdG9tRWRpdG9yc1xuXHRcdFx0Lm1hcChjdXN0b21FZGl0b3IgPT4ge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdGN1c3RvbUVkaXRvci52aWV3VHlwZSxcblx0XHRcdFx0XHRjdXN0b21FZGl0b3IucHJpb3JpdHkgPz8gJycsXG5cdFx0XHRcdFx0Y29hbGVzY2UoY3VzdG9tRWRpdG9yLnNlbGVjdG9yLm1hcCh4ID0+IHguZmlsZW5hbWVQYXR0ZXJuKSkuam9pbignLCAnKVxuXHRcdFx0XHRdO1xuXHRcdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRoZWFkZXJzLFxuXHRcdFx0XHRyb3dzXG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5yZWdpc3RlckV4dGVuc2lvbkZlYXR1cmUoe1xuXHRpZDogJ2N1c3RvbUVkaXRvcnMnLFxuXHRsYWJlbDogbmxzLmxvY2FsaXplKCdjdXN0b21FZGl0b3JzJywgXCJDdXN0b20gRWRpdG9yc1wiKSxcblx0YWNjZXNzOiB7XG5cdFx0Y2FuVG9nZ2xlOiBmYWxzZVxuXHR9LFxuXHRyZW5kZXJlcjogbmV3IFN5bmNEZXNjcmlwdG9yKEN1c3RvbUVkaXRvcnNEYXRhUmVuZGVyZXIpLFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiQUFLQSxTQUFTLGdCQUFnQjtBQUV6QixTQUFTLGtCQUFrQjtBQUMzQixZQUFZLFNBQVM7QUFFckIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw0QkFBa0Q7QUFDM0QsU0FBUyxrQkFBbUg7QUFDNUgsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyx5QkFBeUI7QUFFbEMsTUFBTSxTQUFTLE9BQU8sT0FBTztBQUFBLEVBQzVCLFVBQVU7QUFBQSxFQUNWLGFBQWE7QUFBQSxFQUNiLFVBQVU7QUFBQSxFQUNWLFVBQVU7QUFDWCxDQUFDO0FBU0QsTUFBTSw0QkFBeUM7QUFBQSxFQUM5QyxhQUFhLElBQUksU0FBUyw2QkFBNkIsNkJBQTZCO0FBQUEsRUFDcEYsTUFBTTtBQUFBLEVBQ04saUJBQWlCLENBQUM7QUFBQSxJQUNqQixNQUFNLENBQUM7QUFBQSxNQUNOLENBQUMsT0FBTyxRQUFRLEdBQUc7QUFBQSxNQUNuQixDQUFDLE9BQU8sV0FBVyxHQUFHO0FBQUEsTUFDdEIsQ0FBQyxPQUFPLFFBQVEsR0FBRyxDQUFDO0FBQUEsUUFDbkIsaUJBQWlCO0FBQUEsTUFDbEIsQ0FBQztBQUFBLElBQ0YsQ0FBQztBQUFBLEVBQ0YsQ0FBQztBQUFBLEVBQ0QsT0FBTztBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sVUFBVTtBQUFBLE1BQ1QsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLE1BQ1AsT0FBTztBQUFBLElBQ1I7QUFBQSxJQUNBLFlBQVk7QUFBQSxNQUNYLENBQUMsT0FBTyxRQUFRLEdBQUc7QUFBQSxRQUNsQixNQUFNO0FBQUEsUUFDTixxQkFBcUIsSUFBSSxTQUFTLHdCQUF3Qiw2V0FBNlc7QUFBQSxNQUN4YTtBQUFBLE1BQ0EsQ0FBQyxPQUFPLFdBQVcsR0FBRztBQUFBLFFBQ3JCLE1BQU07QUFBQSxRQUNOLGFBQWEsSUFBSSxTQUFTLDJCQUEyQiwwR0FBMEc7QUFBQSxNQUNoSztBQUFBLE1BQ0EsQ0FBQyxPQUFPLFFBQVEsR0FBRztBQUFBLFFBQ2xCLE1BQU07QUFBQSxRQUNOLGFBQWEsSUFBSSxTQUFTLHdCQUF3QixxREFBcUQ7QUFBQSxRQUN2RyxPQUFPO0FBQUEsVUFDTixNQUFNO0FBQUEsVUFDTixpQkFBaUIsQ0FBQztBQUFBLFlBQ2pCLE1BQU07QUFBQSxjQUNMLGlCQUFpQjtBQUFBLFlBQ2xCO0FBQUEsVUFDRCxDQUFDO0FBQUEsVUFDRCxZQUFZO0FBQUEsWUFDWCxpQkFBaUI7QUFBQSxjQUNoQixNQUFNO0FBQUEsY0FDTixhQUFhLElBQUksU0FBUyx3Q0FBd0MsNkNBQTZDO0FBQUEsWUFDaEg7QUFBQSxVQUNEO0FBQUEsUUFDRDtBQUFBLE1BQ0Q7QUFBQSxNQUNBLENBQUMsT0FBTyxRQUFRLEdBQUc7QUFBQSxRQUNsQixNQUFNO0FBQUEsUUFDTiw0QkFBNEIsSUFBSSxTQUFTLHdCQUF3QixzS0FBc0s7QUFBQSxRQUN2TyxNQUFNO0FBQUEsVUFDTCxxQkFBcUI7QUFBQSxVQUNyQixxQkFBcUI7QUFBQSxRQUN0QjtBQUFBLFFBQ0EsMEJBQTBCO0FBQUEsVUFDekIsSUFBSSxTQUFTLGdDQUFnQyxrSkFBa0o7QUFBQSxVQUMvTCxJQUFJLFNBQVMsK0JBQStCLDJJQUEySTtBQUFBLFFBQ3hMO0FBQUEsUUFDQSxTQUFTO0FBQUEsTUFDVjtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQ0Q7QUFFTyxNQUFNLDhCQUE4QixtQkFBbUIsdUJBQXVEO0FBQUEsRUFDcEgsZ0JBQWdCO0FBQUEsRUFDaEIsTUFBTSxDQUFDLGlCQUFpQjtBQUFBLEVBQ3hCLFlBQVk7QUFBQSxFQUNaLDJCQUEyQixDQUFDLFVBQTBDLFdBQXlDO0FBQzlHLGVBQVcsV0FBVyxVQUFVO0FBQy9CLFlBQU0sV0FBVyxRQUFRLE9BQU8sUUFBUTtBQUN4QyxVQUFJLFVBQVU7QUFDYixlQUFPLEtBQUssa0JBQWtCLFFBQVEsRUFBRTtBQUFBLE1BQ3pDO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDO0FBRUQsTUFBTSxrQ0FBa0MsV0FBcUQ7QUFBQSxFQUE3RjtBQUFBO0FBRUMsU0FBUyxPQUFPO0FBQUE7QUFBQSxFQUVoQixhQUFhLFVBQXVDO0FBQ25ELFdBQU8sQ0FBQyxDQUFDLFNBQVMsYUFBYTtBQUFBLEVBQ2hDO0FBQUEsRUFFQSxPQUFPLFVBQXlEO0FBQy9ELFVBQU0sZ0JBQWdCLFNBQVMsYUFBYSxpQkFBaUIsQ0FBQztBQUM5RCxRQUFJLENBQUMsY0FBYyxRQUFRO0FBQzFCLGFBQU8sRUFBRSxNQUFNLEVBQUUsU0FBUyxDQUFDLEdBQUcsTUFBTSxDQUFDLEVBQUUsR0FBRyxTQUFTLE1BQU07QUFBQSxNQUFFLEVBQUU7QUFBQSxJQUM5RDtBQUVBLFVBQU0sVUFBVTtBQUFBLE1BQ2YsSUFBSSxTQUFTLDJCQUEyQixXQUFXO0FBQUEsTUFDbkQsSUFBSSxTQUFTLDBCQUEwQixVQUFVO0FBQUEsTUFDakQsSUFBSSxTQUFTLGlDQUFpQyxrQkFBa0I7QUFBQSxJQUNqRTtBQUVBLFVBQU0sT0FBcUIsY0FDekIsSUFBSSxrQkFBZ0I7QUFDcEIsYUFBTztBQUFBLFFBQ04sYUFBYTtBQUFBLFFBQ2IsYUFBYSxZQUFZO0FBQUEsUUFDekIsU0FBUyxhQUFhLFNBQVMsSUFBSSxPQUFLLEVBQUUsZUFBZSxDQUFDLEVBQUUsS0FBSyxJQUFJO0FBQUEsTUFDdEU7QUFBQSxJQUNELENBQUM7QUFFRixXQUFPO0FBQUEsTUFDTixNQUFNO0FBQUEsUUFDTDtBQUFBLFFBQ0E7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTLE1BQU07QUFBQSxNQUFFO0FBQUEsSUFDbEI7QUFBQSxFQUNEO0FBQ0Q7QUFFQSxTQUFTLEdBQStCLFdBQVcseUJBQXlCLEVBQUUseUJBQXlCO0FBQUEsRUFDdEcsSUFBSTtBQUFBLEVBQ0osT0FBTyxJQUFJLFNBQVMsaUJBQWlCLGdCQUFnQjtBQUFBLEVBQ3JELFFBQVE7QUFBQSxJQUNQLFdBQVc7QUFBQSxFQUNaO0FBQUEsRUFDQSxVQUFVLElBQUksZUFBZSx5QkFBeUI7QUFDdkQsQ0FBQzsiLAogICJuYW1lcyI6IFtdCn0K
