import * as nls from "../../../../nls.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { NotebookEditorPriority } from "../common/notebookCommon.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const NotebookEditorContribution = Object.freeze({
  type: "type",
  displayName: "displayName",
  selector: "selector",
  priority: "priority"
});
const NotebookRendererContribution = Object.freeze({
  id: "id",
  displayName: "displayName",
  mimeTypes: "mimeTypes",
  entrypoint: "entrypoint",
  hardDependencies: "dependencies",
  optionalDependencies: "optionalDependencies",
  requiresMessaging: "requiresMessaging"
});
const NotebookPreloadContribution = Object.freeze({
  type: "type",
  entrypoint: "entrypoint",
  localResourceRoots: "localResourceRoots"
});
const notebookProviderContribution = {
  description: nls.localize("contributes.notebook.provider", "Contributes notebook document provider."),
  type: "array",
  defaultSnippets: [{ body: [{ type: "", displayName: "", "selector": [{ "filenamePattern": "" }] }] }],
  items: {
    type: "object",
    required: [
      NotebookEditorContribution.type,
      NotebookEditorContribution.displayName,
      NotebookEditorContribution.selector
    ],
    properties: {
      [NotebookEditorContribution.type]: {
        type: "string",
        description: nls.localize("contributes.notebook.provider.viewType", "Type of the notebook.")
      },
      [NotebookEditorContribution.displayName]: {
        type: "string",
        description: nls.localize("contributes.notebook.provider.displayName", "Human readable name of the notebook.")
      },
      [NotebookEditorContribution.selector]: {
        type: "array",
        description: nls.localize("contributes.notebook.provider.selector", "Set of globs that the notebook is for."),
        items: {
          type: "object",
          properties: {
            filenamePattern: {
              type: "string",
              description: nls.localize("contributes.notebook.provider.selector.filenamePattern", "Glob that the notebook is enabled for.")
            },
            excludeFileNamePattern: {
              type: "string",
              description: nls.localize("contributes.notebook.selector.provider.excludeFileNamePattern", "Glob that the notebook is disabled for.")
            }
          }
        }
      },
      [NotebookEditorContribution.priority]: {
        type: "string",
        markdownDeprecationMessage: nls.localize("contributes.priority", "Controls if the custom editor is enabled automatically when the user opens a file. This may be overridden by users using the `workbench.editorAssociations` setting."),
        enum: [
          NotebookEditorPriority.default,
          NotebookEditorPriority.option
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
const defaultRendererSnippet = Object.freeze({ id: "", displayName: "", mimeTypes: [""], entrypoint: "" });
const notebookRendererContribution = {
  description: nls.localize("contributes.notebook.renderer", "Contributes notebook output renderer provider."),
  type: "array",
  defaultSnippets: [{ body: [defaultRendererSnippet] }],
  items: {
    defaultSnippets: [{ body: defaultRendererSnippet }],
    allOf: [
      {
        type: "object",
        required: [
          NotebookRendererContribution.id,
          NotebookRendererContribution.displayName
        ],
        properties: {
          [NotebookRendererContribution.id]: {
            type: "string",
            description: nls.localize("contributes.notebook.renderer.viewType", "Unique identifier of the notebook output renderer.")
          },
          [NotebookRendererContribution.displayName]: {
            type: "string",
            description: nls.localize("contributes.notebook.renderer.displayName", "Human readable name of the notebook output renderer.")
          },
          [NotebookRendererContribution.hardDependencies]: {
            type: "array",
            uniqueItems: true,
            items: { type: "string" },
            markdownDescription: nls.localize("contributes.notebook.renderer.hardDependencies", "List of kernel dependencies the renderer requires. If any of the dependencies are present in the `NotebookKernel.preloads`, the renderer can be used.")
          },
          [NotebookRendererContribution.optionalDependencies]: {
            type: "array",
            uniqueItems: true,
            items: { type: "string" },
            markdownDescription: nls.localize("contributes.notebook.renderer.optionalDependencies", "List of soft kernel dependencies the renderer can make use of. If any of the dependencies are present in the `NotebookKernel.preloads`, the renderer will be preferred over renderers that don't interact with the kernel.")
          },
          [NotebookRendererContribution.requiresMessaging]: {
            default: "never",
            enum: [
              "always",
              "optional",
              "never"
            ],
            enumDescriptions: [
              nls.localize("contributes.notebook.renderer.requiresMessaging.always", "Messaging is required. The renderer will only be used when it's part of an extension that can be run in an extension host."),
              nls.localize("contributes.notebook.renderer.requiresMessaging.optional", "The renderer is better with messaging available, but it's not requried."),
              nls.localize("contributes.notebook.renderer.requiresMessaging.never", "The renderer does not require messaging.")
            ],
            description: nls.localize("contributes.notebook.renderer.requiresMessaging", "Defines how and if the renderer needs to communicate with an extension host, via `createRendererMessaging`. Renderers with stronger messaging requirements may not work in all environments.")
          }
        }
      },
      {
        oneOf: [
          {
            required: [
              NotebookRendererContribution.entrypoint,
              NotebookRendererContribution.mimeTypes
            ],
            properties: {
              [NotebookRendererContribution.mimeTypes]: {
                type: "array",
                description: nls.localize("contributes.notebook.selector", "Set of globs that the notebook is for."),
                items: {
                  type: "string"
                }
              },
              [NotebookRendererContribution.entrypoint]: {
                description: nls.localize("contributes.notebook.renderer.entrypoint", "File to load in the webview to render the extension."),
                type: "string"
              }
            }
          },
          {
            required: [
              NotebookRendererContribution.entrypoint
            ],
            properties: {
              [NotebookRendererContribution.entrypoint]: {
                description: nls.localize("contributes.notebook.renderer.entrypoint", "File to load in the webview to render the extension."),
                type: "object",
                required: ["extends", "path"],
                properties: {
                  extends: {
                    type: "string",
                    description: nls.localize("contributes.notebook.renderer.entrypoint.extends", "Existing renderer that this one extends.")
                  },
                  path: {
                    type: "string",
                    description: nls.localize("contributes.notebook.renderer.entrypoint", "File to load in the webview to render the extension.")
                  }
                }
              }
            }
          }
        ]
      }
    ]
  }
};
const notebookPreloadContribution = {
  description: nls.localize("contributes.preload.provider", "Contributes notebook preloads."),
  type: "array",
  defaultSnippets: [{ body: [{ type: "", entrypoint: "" }] }],
  items: {
    type: "object",
    required: [
      NotebookPreloadContribution.type,
      NotebookPreloadContribution.entrypoint
    ],
    properties: {
      [NotebookPreloadContribution.type]: {
        type: "string",
        description: nls.localize("contributes.preload.provider.viewType", "Type of the notebook.")
      },
      [NotebookPreloadContribution.entrypoint]: {
        type: "string",
        description: nls.localize("contributes.preload.entrypoint", "Path to file loaded in the webview.")
      },
      [NotebookPreloadContribution.localResourceRoots]: {
        type: "array",
        items: { type: "string" },
        description: nls.localize("contributes.preload.localResourceRoots", "Paths to additional resources that should be allowed in the webview.")
      }
    }
  }
};
const notebooksExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "notebooks",
  jsonSchema: notebookProviderContribution,
  activationEventsGenerator: (contribs, result) => {
    for (const contrib of contribs) {
      if (contrib.type) {
        result.push(`onNotebookSerializer:${contrib.type}`);
      }
    }
  }
});
const notebookRendererExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "notebookRenderer",
  jsonSchema: notebookRendererContribution,
  activationEventsGenerator: (contribs, result) => {
    for (const contrib of contribs) {
      if (contrib.id) {
        result.push(`onRenderer:${contrib.id}`);
      }
    }
  }
});
const notebookPreloadExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "notebookPreload",
  jsonSchema: notebookPreloadContribution
});
class NotebooksDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.notebooks;
  }
  render(manifest) {
    const contrib = manifest.contributes?.notebooks || [];
    if (!contrib.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("Notebook id", "ID"),
      nls.localize("Notebook name", "Name")
    ];
    const rows = contrib.sort((a, b) => a.type.localeCompare(b.type)).map((notebook) => {
      return [
        notebook.type,
        notebook.displayName
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
class NotebookRenderersDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.notebookRenderer;
  }
  render(manifest) {
    const contrib = manifest.contributes?.notebookRenderer || [];
    if (!contrib.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("Notebook renderer name", "Name"),
      nls.localize("Notebook mimetypes", "Mimetypes")
    ];
    const rows = contrib.sort((a, b) => a.displayName.localeCompare(b.displayName)).map((notebookRenderer) => {
      return [
        notebookRenderer.displayName,
        notebookRenderer.mimeTypes.join(",")
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
  id: "notebooks",
  label: nls.localize("notebooks", "Notebooks"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(NotebooksDataRenderer)
});
Registry.as(Extensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "notebookRenderer",
  label: nls.localize("notebookRenderer", "Notebook Renderers"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(NotebookRenderersDataRenderer)
});
export {
  notebookPreloadExtensionPoint,
  notebookRendererExtensionPoint,
  notebooksExtensionPoint
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9ub3RlYm9vay9icm93c2VyL25vdGVib29rRXh0ZW5zaW9uUG9pbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25zUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgTm90ZWJvb2tFZGl0b3JQcmlvcml0eSwgQ29udHJpYnV0ZWROb3RlYm9va1JlbmRlcmVyRW50cnlwb2ludCwgUmVuZGVyZXJNZXNzYWdpbmdTcGVjIH0gZnJvbSAnLi4vY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSVJlbmRlcmVkRGF0YSwgSVRhYmxlRGF0YSwgSVJvd0RhdGEsIElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5LCBFeHRlbnNpb25zIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuXG5jb25zdCBOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbiA9IE9iamVjdC5mcmVlemUoe1xuXHR0eXBlOiAndHlwZScsXG5cdGRpc3BsYXlOYW1lOiAnZGlzcGxheU5hbWUnLFxuXHRzZWxlY3RvcjogJ3NlbGVjdG9yJyxcblx0cHJpb3JpdHk6ICdwcmlvcml0eScsXG59KTtcblxuZXhwb3J0IGludGVyZmFjZSBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ge1xuXHRyZWFkb25seSBbTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24udHlwZV06IHN0cmluZztcblx0cmVhZG9ubHkgW05vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uLmRpc3BsYXlOYW1lXTogc3RyaW5nO1xuXHRyZWFkb25seSBbTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24uc2VsZWN0b3JdPzogcmVhZG9ubHkgeyBmaWxlbmFtZVBhdHRlcm4/OiBzdHJpbmc7IGV4Y2x1ZGVGaWxlTmFtZVBhdHRlcm4/OiBzdHJpbmcgfVtdO1xuXHRyZWFkb25seSBbTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ucHJpb3JpdHldPzogc3RyaW5nO1xufVxuXG5jb25zdCBOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uID0gT2JqZWN0LmZyZWV6ZSh7XG5cdGlkOiAnaWQnLFxuXHRkaXNwbGF5TmFtZTogJ2Rpc3BsYXlOYW1lJyxcblx0bWltZVR5cGVzOiAnbWltZVR5cGVzJyxcblx0ZW50cnlwb2ludDogJ2VudHJ5cG9pbnQnLFxuXHRoYXJkRGVwZW5kZW5jaWVzOiAnZGVwZW5kZW5jaWVzJyxcblx0b3B0aW9uYWxEZXBlbmRlbmNpZXM6ICdvcHRpb25hbERlcGVuZGVuY2llcycsXG5cdHJlcXVpcmVzTWVzc2FnaW5nOiAncmVxdWlyZXNNZXNzYWdpbmcnLFxufSk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU5vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24ge1xuXHRyZWFkb25seSBbTm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5pZF0/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmRpc3BsYXlOYW1lXTogc3RyaW5nO1xuXHRyZWFkb25seSBbTm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5taW1lVHlwZXNdPzogcmVhZG9ubHkgc3RyaW5nW107XG5cdHJlYWRvbmx5IFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmVudHJ5cG9pbnRdOiBDb250cmlidXRlZE5vdGVib29rUmVuZGVyZXJFbnRyeXBvaW50O1xuXHRyZWFkb25seSBbTm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5oYXJkRGVwZW5kZW5jaWVzXTogcmVhZG9ubHkgc3RyaW5nW107XG5cdHJlYWRvbmx5IFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLm9wdGlvbmFsRGVwZW5kZW5jaWVzXTogcmVhZG9ubHkgc3RyaW5nW107XG5cdHJlYWRvbmx5IFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLnJlcXVpcmVzTWVzc2FnaW5nXTogUmVuZGVyZXJNZXNzYWdpbmdTcGVjO1xufVxuXG5jb25zdCBOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24gPSBPYmplY3QuZnJlZXplKHtcblx0dHlwZTogJ3R5cGUnLFxuXHRlbnRyeXBvaW50OiAnZW50cnlwb2ludCcsXG5cdGxvY2FsUmVzb3VyY2VSb290czogJ2xvY2FsUmVzb3VyY2VSb290cycsXG59KTtcblxuaW50ZXJmYWNlIElOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24ge1xuXHRyZWFkb25seSBbTm90ZWJvb2tQcmVsb2FkQ29udHJpYnV0aW9uLnR5cGVdOiBzdHJpbmc7XG5cdHJlYWRvbmx5IFtOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24uZW50cnlwb2ludF06IHN0cmluZztcblx0cmVhZG9ubHkgW05vdGVib29rUHJlbG9hZENvbnRyaWJ1dGlvbi5sb2NhbFJlc291cmNlUm9vdHNdOiByZWFkb25seSBzdHJpbmdbXTtcbn1cblxuY29uc3Qgbm90ZWJvb2tQcm92aWRlckNvbnRyaWJ1dGlvbjogSUpTT05TY2hlbWEgPSB7XG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnByb3ZpZGVyJywgJ0NvbnRyaWJ1dGVzIG5vdGVib29rIGRvY3VtZW50IHByb3ZpZGVyLicpLFxuXHR0eXBlOiAnYXJyYXknLFxuXHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IFt7IHR5cGU6ICcnLCBkaXNwbGF5TmFtZTogJycsICdzZWxlY3Rvcic6IFt7ICdmaWxlbmFtZVBhdHRlcm4nOiAnJyB9XSB9XSB9XSxcblx0aXRlbXM6IHtcblx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRyZXF1aXJlZDogW1xuXHRcdFx0Tm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24udHlwZSxcblx0XHRcdE5vdGVib29rRWRpdG9yQ29udHJpYnV0aW9uLmRpc3BsYXlOYW1lLFxuXHRcdFx0Tm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24uc2VsZWN0b3IsXG5cdFx0XSxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRbTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24udHlwZV06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnByb3ZpZGVyLnZpZXdUeXBlJywgJ1R5cGUgb2YgdGhlIG5vdGVib29rLicpLFxuXHRcdFx0fSxcblx0XHRcdFtOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbi5kaXNwbGF5TmFtZV06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnByb3ZpZGVyLmRpc3BsYXlOYW1lJywgJ0h1bWFuIHJlYWRhYmxlIG5hbWUgb2YgdGhlIG5vdGVib29rLicpLFxuXHRcdFx0fSxcblx0XHRcdFtOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbi5zZWxlY3Rvcl06IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucHJvdmlkZXIuc2VsZWN0b3InLCAnU2V0IG9mIGdsb2JzIHRoYXQgdGhlIG5vdGVib29rIGlzIGZvci4nKSxcblx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRmaWxlbmFtZVBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnByb3ZpZGVyLnNlbGVjdG9yLmZpbGVuYW1lUGF0dGVybicsICdHbG9iIHRoYXQgdGhlIG5vdGVib29rIGlzIGVuYWJsZWQgZm9yLicpLFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGV4Y2x1ZGVGaWxlTmFtZVBhdHRlcm46IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnNlbGVjdG9yLnByb3ZpZGVyLmV4Y2x1ZGVGaWxlTmFtZVBhdHRlcm4nLCAnR2xvYiB0aGF0IHRoZSBub3RlYm9vayBpcyBkaXNhYmxlZCBmb3IuJylcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRbTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb24ucHJpb3JpdHldOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRtYXJrZG93bkRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5wcmlvcml0eScsICdDb250cm9scyBpZiB0aGUgY3VzdG9tIGVkaXRvciBpcyBlbmFibGVkIGF1dG9tYXRpY2FsbHkgd2hlbiB0aGUgdXNlciBvcGVucyBhIGZpbGUuIFRoaXMgbWF5IGJlIG92ZXJyaWRkZW4gYnkgdXNlcnMgdXNpbmcgdGhlIGB3b3JrYmVuY2guZWRpdG9yQXNzb2NpYXRpb25zYCBzZXR0aW5nLicpLFxuXHRcdFx0XHRlbnVtOiBbXG5cdFx0XHRcdFx0Tm90ZWJvb2tFZGl0b3JQcmlvcml0eS5kZWZhdWx0LFxuXHRcdFx0XHRcdE5vdGVib29rRWRpdG9yUHJpb3JpdHkub3B0aW9uLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnByaW9yaXR5LmRlZmF1bHQnLCAnVGhlIGVkaXRvciBpcyBhdXRvbWF0aWNhbGx5IHVzZWQgd2hlbiB0aGUgdXNlciBvcGVucyBhIHJlc291cmNlLCBwcm92aWRlZCB0aGF0IG5vIG90aGVyIGRlZmF1bHQgY3VzdG9tIGVkaXRvcnMgYXJlIHJlZ2lzdGVyZWQgZm9yIHRoYXQgcmVzb3VyY2UuJyksXG5cdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5wcmlvcml0eS5vcHRpb24nLCAnVGhlIGVkaXRvciBpcyBub3QgYXV0b21hdGljYWxseSB1c2VkIHdoZW4gdGhlIHVzZXIgb3BlbnMgYSByZXNvdXJjZSwgYnV0IGEgdXNlciBjYW4gc3dpdGNoIHRvIHRoZSBlZGl0b3IgdXNpbmcgdGhlIGBSZW9wZW4gV2l0aGAgY29tbWFuZC4nKSxcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVmYXVsdDogJ2RlZmF1bHQnXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59O1xuXG5jb25zdCBkZWZhdWx0UmVuZGVyZXJTbmlwcGV0ID0gT2JqZWN0LmZyZWV6ZSh7IGlkOiAnJywgZGlzcGxheU5hbWU6ICcnLCBtaW1lVHlwZXM6IFsnJ10sIGVudHJ5cG9pbnQ6ICcnIH0pO1xuXG5jb25zdCBub3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uOiBJSlNPTlNjaGVtYSA9IHtcblx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXInLCAnQ29udHJpYnV0ZXMgbm90ZWJvb2sgb3V0cHV0IHJlbmRlcmVyIHByb3ZpZGVyLicpLFxuXHR0eXBlOiAnYXJyYXknLFxuXHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IFtkZWZhdWx0UmVuZGVyZXJTbmlwcGV0XSB9XSxcblx0aXRlbXM6IHtcblx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IGRlZmF1bHRSZW5kZXJlclNuaXBwZXQgfV0sXG5cdFx0YWxsT2Y6IFtcblx0XHRcdHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdHJlcXVpcmVkOiBbXG5cdFx0XHRcdFx0Tm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5pZCxcblx0XHRcdFx0XHROb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRdLFxuXHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0W05vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24uaWRdOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnJlbmRlcmVyLnZpZXdUeXBlJywgJ1VuaXF1ZSBpZGVudGlmaWVyIG9mIHRoZSBub3RlYm9vayBvdXRwdXQgcmVuZGVyZXIuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRbTm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5kaXNwbGF5TmFtZV06IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIuZGlzcGxheU5hbWUnLCAnSHVtYW4gcmVhZGFibGUgbmFtZSBvZiB0aGUgbm90ZWJvb2sgb3V0cHV0IHJlbmRlcmVyLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0W05vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24uaGFyZERlcGVuZGVuY2llc106IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHR1bmlxdWVJdGVtczogdHJ1ZSxcblx0XHRcdFx0XHRcdGl0ZW1zOiB7IHR5cGU6ICdzdHJpbmcnIH0sXG5cdFx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnJlbmRlcmVyLmhhcmREZXBlbmRlbmNpZXMnLCAnTGlzdCBvZiBrZXJuZWwgZGVwZW5kZW5jaWVzIHRoZSByZW5kZXJlciByZXF1aXJlcy4gSWYgYW55IG9mIHRoZSBkZXBlbmRlbmNpZXMgYXJlIHByZXNlbnQgaW4gdGhlIGBOb3RlYm9va0tlcm5lbC5wcmVsb2Fkc2AsIHRoZSByZW5kZXJlciBjYW4gYmUgdXNlZC4nKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLm9wdGlvbmFsRGVwZW5kZW5jaWVzXToge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdHVuaXF1ZUl0ZW1zOiB0cnVlLFxuXHRcdFx0XHRcdFx0aXRlbXM6IHsgdHlwZTogJ3N0cmluZycgfSxcblx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIub3B0aW9uYWxEZXBlbmRlbmNpZXMnLCAnTGlzdCBvZiBzb2Z0IGtlcm5lbCBkZXBlbmRlbmNpZXMgdGhlIHJlbmRlcmVyIGNhbiBtYWtlIHVzZSBvZi4gSWYgYW55IG9mIHRoZSBkZXBlbmRlbmNpZXMgYXJlIHByZXNlbnQgaW4gdGhlIGBOb3RlYm9va0tlcm5lbC5wcmVsb2Fkc2AsIHRoZSByZW5kZXJlciB3aWxsIGJlIHByZWZlcnJlZCBvdmVyIHJlbmRlcmVycyB0aGF0IGRvblxcJ3QgaW50ZXJhY3Qgd2l0aCB0aGUga2VybmVsLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0W05vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24ucmVxdWlyZXNNZXNzYWdpbmddOiB7XG5cdFx0XHRcdFx0XHRkZWZhdWx0OiAnbmV2ZXInLFxuXHRcdFx0XHRcdFx0ZW51bTogW1xuXHRcdFx0XHRcdFx0XHQnYWx3YXlzJyxcblx0XHRcdFx0XHRcdFx0J29wdGlvbmFsJyxcblx0XHRcdFx0XHRcdFx0J25ldmVyJyxcblx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIucmVxdWlyZXNNZXNzYWdpbmcuYWx3YXlzJywgJ01lc3NhZ2luZyBpcyByZXF1aXJlZC4gVGhlIHJlbmRlcmVyIHdpbGwgb25seSBiZSB1c2VkIHdoZW4gaXRcXCdzIHBhcnQgb2YgYW4gZXh0ZW5zaW9uIHRoYXQgY2FuIGJlIHJ1biBpbiBhbiBleHRlbnNpb24gaG9zdC4nKSxcblx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5ub3RlYm9vay5yZW5kZXJlci5yZXF1aXJlc01lc3NhZ2luZy5vcHRpb25hbCcsICdUaGUgcmVuZGVyZXIgaXMgYmV0dGVyIHdpdGggbWVzc2FnaW5nIGF2YWlsYWJsZSwgYnV0IGl0XFwncyBub3QgcmVxdXJpZWQuJyksXG5cdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIucmVxdWlyZXNNZXNzYWdpbmcubmV2ZXInLCAnVGhlIHJlbmRlcmVyIGRvZXMgbm90IHJlcXVpcmUgbWVzc2FnaW5nLicpLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnJlbmRlcmVyLnJlcXVpcmVzTWVzc2FnaW5nJywgJ0RlZmluZXMgaG93IGFuZCBpZiB0aGUgcmVuZGVyZXIgbmVlZHMgdG8gY29tbXVuaWNhdGUgd2l0aCBhbiBleHRlbnNpb24gaG9zdCwgdmlhIGBjcmVhdGVSZW5kZXJlck1lc3NhZ2luZ2AuIFJlbmRlcmVycyB3aXRoIHN0cm9uZ2VyIG1lc3NhZ2luZyByZXF1aXJlbWVudHMgbWF5IG5vdCB3b3JrIGluIGFsbCBlbnZpcm9ubWVudHMuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHtcblx0XHRcdFx0b25lT2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogW1xuXHRcdFx0XHRcdFx0XHROb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmVudHJ5cG9pbnQsXG5cdFx0XHRcdFx0XHRcdE5vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24ubWltZVR5cGVzLFxuXHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0W05vdGVib29rUmVuZGVyZXJDb250cmlidXRpb24ubWltZVR5cGVzXToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2suc2VsZWN0b3InLCAnU2V0IG9mIGdsb2JzIHRoYXQgdGhlIG5vdGVib29rIGlzIGZvci4nKSxcblx0XHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFtOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmVudHJ5cG9pbnRdOiB7XG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIuZW50cnlwb2ludCcsICdGaWxlIHRvIGxvYWQgaW4gdGhlIHdlYnZpZXcgdG8gcmVuZGVyIHRoZSBleHRlbnNpb24uJyksXG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRyZXF1aXJlZDogW1xuXHRcdFx0XHRcdFx0XHROb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLmVudHJ5cG9pbnQsXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRbTm90ZWJvb2tSZW5kZXJlckNvbnRyaWJ1dGlvbi5lbnRyeXBvaW50XToge1xuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnJlbmRlcmVyLmVudHJ5cG9pbnQnLCAnRmlsZSB0byBsb2FkIGluIHRoZSB3ZWJ2aWV3IHRvIHJlbmRlciB0aGUgZXh0ZW5zaW9uLicpLFxuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ2V4dGVuZHMnLCAncGF0aCddLFxuXHRcdFx0XHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdGV4dGVuZHM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLm5vdGVib29rLnJlbmRlcmVyLmVudHJ5cG9pbnQuZXh0ZW5kcycsICdFeGlzdGluZyByZW5kZXJlciB0aGF0IHRoaXMgb25lIGV4dGVuZHMuJyksXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnY29udHJpYnV0ZXMubm90ZWJvb2sucmVuZGVyZXIuZW50cnlwb2ludCcsICdGaWxlIHRvIGxvYWQgaW4gdGhlIHdlYnZpZXcgdG8gcmVuZGVyIHRoZSBleHRlbnNpb24uJyksXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHRdXG5cdH1cbn07XG5cbmNvbnN0IG5vdGVib29rUHJlbG9hZENvbnRyaWJ1dGlvbjogSUpTT05TY2hlbWEgPSB7XG5cdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnByZWxvYWQucHJvdmlkZXInLCAnQ29udHJpYnV0ZXMgbm90ZWJvb2sgcHJlbG9hZHMuJyksXG5cdHR5cGU6ICdhcnJheScsXG5cdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogW3sgdHlwZTogJycsIGVudHJ5cG9pbnQ6ICcnIH1dIH1dLFxuXHRpdGVtczoge1xuXHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdHJlcXVpcmVkOiBbXG5cdFx0XHROb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24udHlwZSxcblx0XHRcdE5vdGVib29rUHJlbG9hZENvbnRyaWJ1dGlvbi5lbnRyeXBvaW50XG5cdFx0XSxcblx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRbTm90ZWJvb2tQcmVsb2FkQ29udHJpYnV0aW9uLnR5cGVdOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5wcmVsb2FkLnByb3ZpZGVyLnZpZXdUeXBlJywgJ1R5cGUgb2YgdGhlIG5vdGVib29rLicpLFxuXHRcdFx0fSxcblx0XHRcdFtOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24uZW50cnlwb2ludF06IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2NvbnRyaWJ1dGVzLnByZWxvYWQuZW50cnlwb2ludCcsICdQYXRoIHRvIGZpbGUgbG9hZGVkIGluIHRoZSB3ZWJ2aWV3LicpLFxuXHRcdFx0fSxcblx0XHRcdFtOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb24ubG9jYWxSZXNvdXJjZVJvb3RzXToge1xuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRpdGVtczogeyB0eXBlOiAnc3RyaW5nJyB9LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb250cmlidXRlcy5wcmVsb2FkLmxvY2FsUmVzb3VyY2VSb290cycsICdQYXRocyB0byBhZGRpdGlvbmFsIHJlc291cmNlcyB0aGF0IHNob3VsZCBiZSBhbGxvd2VkIGluIHRoZSB3ZWJ2aWV3LicpLFxuXHRcdFx0fSxcblx0XHR9XG5cdH1cbn07XG5cbmV4cG9ydCBjb25zdCBub3RlYm9va3NFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElOb3RlYm9va0VkaXRvckNvbnRyaWJ1dGlvbltdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnbm90ZWJvb2tzJyxcblx0anNvblNjaGVtYTogbm90ZWJvb2tQcm92aWRlckNvbnRyaWJ1dGlvbixcblx0YWN0aXZhdGlvbkV2ZW50c0dlbmVyYXRvcjogKGNvbnRyaWJzOiBJTm90ZWJvb2tFZGl0b3JDb250cmlidXRpb25bXSwgcmVzdWx0OiB7IHB1c2goaXRlbTogc3RyaW5nKTogdm9pZCB9KSA9PiB7XG5cdFx0Zm9yIChjb25zdCBjb250cmliIG9mIGNvbnRyaWJzKSB7XG5cdFx0XHRpZiAoY29udHJpYi50eXBlKSB7XG5cdFx0XHRcdHJlc3VsdC5wdXNoKGBvbk5vdGVib29rU2VyaWFsaXplcjoke2NvbnRyaWIudHlwZX1gKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cbn0pO1xuXG5leHBvcnQgY29uc3Qgbm90ZWJvb2tSZW5kZXJlckV4dGVuc2lvblBvaW50ID0gRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SU5vdGVib29rUmVuZGVyZXJDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ25vdGVib29rUmVuZGVyZXInLFxuXHRqc29uU2NoZW1hOiBub3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uLFxuXHRhY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yOiAoY29udHJpYnM6IElOb3RlYm9va1JlbmRlcmVyQ29udHJpYnV0aW9uW10sIHJlc3VsdDogeyBwdXNoKGl0ZW06IHN0cmluZyk6IHZvaWQgfSkgPT4ge1xuXHRcdGZvciAoY29uc3QgY29udHJpYiBvZiBjb250cmlicykge1xuXHRcdFx0aWYgKGNvbnRyaWIuaWQpIHtcblx0XHRcdFx0cmVzdWx0LnB1c2goYG9uUmVuZGVyZXI6JHtjb250cmliLmlkfWApO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbmV4cG9ydCBjb25zdCBub3RlYm9va1ByZWxvYWRFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElOb3RlYm9va1ByZWxvYWRDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ25vdGVib29rUHJlbG9hZCcsXG5cdGpzb25TY2hlbWE6IG5vdGVib29rUHJlbG9hZENvbnRyaWJ1dGlvbixcbn0pO1xuXG5jbGFzcyBOb3RlYm9va3NEYXRhUmVuZGVyZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUV4dGVuc2lvbkZlYXR1cmVUYWJsZVJlbmRlcmVyIHtcblxuXHRyZWFkb25seSB0eXBlID0gJ3RhYmxlJztcblxuXHRzaG91bGRSZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIW1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5ub3RlYm9va3M7XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbnRyaWIgPSBtYW5pZmVzdC5jb250cmlidXRlcz8ubm90ZWJvb2tzIHx8IFtdO1xuXHRcdGlmICghY29udHJpYi5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IHsgaGVhZGVyczogW10sIHJvd3M6IFtdIH0sIGRpc3Bvc2U6ICgpID0+IHsgfSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXG5cdFx0XHRubHMubG9jYWxpemUoJ05vdGVib29rIGlkJywgXCJJRFwiKSxcblx0XHRcdG5scy5sb2NhbGl6ZSgnTm90ZWJvb2sgbmFtZScsIFwiTmFtZVwiKSxcblx0XHRdO1xuXG5cdFx0Y29uc3Qgcm93czogSVJvd0RhdGFbXVtdID0gY29udHJpYlxuXHRcdFx0LnNvcnQoKGEsIGIpID0+IGEudHlwZS5sb2NhbGVDb21wYXJlKGIudHlwZSkpXG5cdFx0XHQubWFwKG5vdGVib29rID0+IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRub3RlYm9vay50eXBlLFxuXHRcdFx0XHRcdG5vdGVib29rLmRpc3BsYXlOYW1lXG5cdFx0XHRcdF07XG5cdFx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG59XG5cbmNsYXNzIE5vdGVib29rUmVuZGVyZXJzRGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdHlwZSA9ICd0YWJsZSc7XG5cblx0c2hvdWxkUmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFtYW5pZmVzdC5jb250cmlidXRlcz8ubm90ZWJvb2tSZW5kZXJlcjtcblx0fVxuXG5cdHJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogSVJlbmRlcmVkRGF0YTxJVGFibGVEYXRhPiB7XG5cdFx0Y29uc3QgY29udHJpYiA9IG1hbmlmZXN0LmNvbnRyaWJ1dGVzPy5ub3RlYm9va1JlbmRlcmVyIHx8IFtdO1xuXHRcdGlmICghY29udHJpYi5sZW5ndGgpIHtcblx0XHRcdHJldHVybiB7IGRhdGE6IHsgaGVhZGVyczogW10sIHJvd3M6IFtdIH0sIGRpc3Bvc2U6ICgpID0+IHsgfSB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGhlYWRlcnMgPSBbXG5cdFx0XHRubHMubG9jYWxpemUoJ05vdGVib29rIHJlbmRlcmVyIG5hbWUnLCBcIk5hbWVcIiksXG5cdFx0XHRubHMubG9jYWxpemUoJ05vdGVib29rIG1pbWV0eXBlcycsIFwiTWltZXR5cGVzXCIpLFxuXHRcdF07XG5cblx0XHRjb25zdCByb3dzOiBJUm93RGF0YVtdW10gPSBjb250cmliXG5cdFx0XHQuc29ydCgoYSwgYikgPT4gYS5kaXNwbGF5TmFtZS5sb2NhbGVDb21wYXJlKGIuZGlzcGxheU5hbWUpKVxuXHRcdFx0Lm1hcChub3RlYm9va1JlbmRlcmVyID0+IHtcblx0XHRcdFx0cmV0dXJuIFtcblx0XHRcdFx0XHRub3RlYm9va1JlbmRlcmVyLmRpc3BsYXlOYW1lLFxuXHRcdFx0XHRcdG5vdGVib29rUmVuZGVyZXIubWltZVR5cGVzLmpvaW4oJywnKVxuXHRcdFx0XHRdO1xuXHRcdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRoZWFkZXJzLFxuXHRcdFx0XHRyb3dzXG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5yZWdpc3RlckV4dGVuc2lvbkZlYXR1cmUoe1xuXHRpZDogJ25vdGVib29rcycsXG5cdGxhYmVsOiBubHMubG9jYWxpemUoJ25vdGVib29rcycsIFwiTm90ZWJvb2tzXCIpLFxuXHRhY2Nlc3M6IHtcblx0XHRjYW5Ub2dnbGU6IGZhbHNlXG5cdH0sXG5cdHJlbmRlcmVyOiBuZXcgU3luY0Rlc2NyaXB0b3IoTm90ZWJvb2tzRGF0YVJlbmRlcmVyKSxcbn0pO1xuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9ucy5FeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5KS5yZWdpc3RlckV4dGVuc2lvbkZlYXR1cmUoe1xuXHRpZDogJ25vdGVib29rUmVuZGVyZXInLFxuXHRsYWJlbDogbmxzLmxvY2FsaXplKCdub3RlYm9va1JlbmRlcmVyJywgXCJOb3RlYm9vayBSZW5kZXJlcnNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihOb3RlYm9va1JlbmRlcmVyc0RhdGFSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQU1BLFlBQVksU0FBUztBQUNyQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLDhCQUE0RjtBQUNyRyxTQUFTLGtCQUFrQjtBQUUzQixTQUFTLHNCQUFzQjtBQUMvQixTQUEwRyxrQkFBa0I7QUFDNUgsU0FBUyxnQkFBZ0I7QUFFekIsTUFBTSw2QkFBNkIsT0FBTyxPQUFPO0FBQUEsRUFDaEQsTUFBTTtBQUFBLEVBQ04sYUFBYTtBQUFBLEVBQ2IsVUFBVTtBQUFBLEVBQ1YsVUFBVTtBQUNYLENBQUM7QUFTRCxNQUFNLCtCQUErQixPQUFPLE9BQU87QUFBQSxFQUNsRCxJQUFJO0FBQUEsRUFDSixhQUFhO0FBQUEsRUFDYixXQUFXO0FBQUEsRUFDWCxZQUFZO0FBQUEsRUFDWixrQkFBa0I7QUFBQSxFQUNsQixzQkFBc0I7QUFBQSxFQUN0QixtQkFBbUI7QUFDcEIsQ0FBQztBQVlELE1BQU0sOEJBQThCLE9BQU8sT0FBTztBQUFBLEVBQ2pELE1BQU07QUFBQSxFQUNOLFlBQVk7QUFBQSxFQUNaLG9CQUFvQjtBQUNyQixDQUFDO0FBUUQsTUFBTSwrQkFBNEM7QUFBQSxFQUNqRCxhQUFhLElBQUksU0FBUyxpQ0FBaUMseUNBQXlDO0FBQUEsRUFDcEcsTUFBTTtBQUFBLEVBQ04saUJBQWlCLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRSxNQUFNLElBQUksYUFBYSxJQUFJLFlBQVksQ0FBQyxFQUFFLG1CQUFtQixHQUFHLENBQUMsRUFBRSxDQUFDLEVBQUUsQ0FBQztBQUFBLEVBQ3BHLE9BQU87QUFBQSxJQUNOLE1BQU07QUFBQSxJQUNOLFVBQVU7QUFBQSxNQUNULDJCQUEyQjtBQUFBLE1BQzNCLDJCQUEyQjtB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
