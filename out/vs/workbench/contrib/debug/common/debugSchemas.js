import * as extensionsRegistry from "../../../services/extensions/common/extensionsRegistry.js";
import * as nls from "../../../../nls.js";
import { launchSchemaId } from "../../../services/configuration/common/configuration.js";
import { inputsSchema } from "../../../services/configurationResolver/common/configurationResolverSchema.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Extensions } from "../../../services/extensionManagement/common/extensionFeatures.js";
import { SyncDescriptor } from "../../../../platform/instantiation/common/descriptors.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
const debuggersExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "debuggers",
  defaultExtensionKind: ["workspace"],
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.debuggers", "Contributes debug adapters."),
    type: "array",
    defaultSnippets: [{ body: [{ type: "" }] }],
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{ body: { type: "", program: "", runtime: "" } }],
      properties: {
        type: {
          description: nls.localize("vscode.extension.contributes.debuggers.type", "Unique identifier for this debug adapter."),
          type: "string"
        },
        label: {
          description: nls.localize("vscode.extension.contributes.debuggers.label", "Display name for this debug adapter."),
          type: "string"
        },
        program: {
          description: nls.localize("vscode.extension.contributes.debuggers.program", "Path to the debug adapter program. Path is either absolute or relative to the extension folder."),
          type: "string"
        },
        args: {
          description: nls.localize("vscode.extension.contributes.debuggers.args", "Optional arguments to pass to the adapter."),
          type: "array"
        },
        runtime: {
          description: nls.localize("vscode.extension.contributes.debuggers.runtime", "Optional runtime in case the program attribute is not an executable but requires a runtime."),
          type: "string"
        },
        runtimeArgs: {
          description: nls.localize("vscode.extension.contributes.debuggers.runtimeArgs", "Optional runtime arguments."),
          type: "array"
        },
        variables: {
          description: nls.localize("vscode.extension.contributes.debuggers.variables", "Mapping from interactive variables (e.g. ${action.pickProcess}) in `launch.json` to a command."),
          type: "object"
        },
        initialConfigurations: {
          description: nls.localize("vscode.extension.contributes.debuggers.initialConfigurations", "Configurations for generating the initial 'launch.json'."),
          type: ["array", "string"]
        },
        languages: {
          description: nls.localize("vscode.extension.contributes.debuggers.languages", 'List of languages for which the debug extension could be considered the "default debugger".'),
          type: "array"
        },
        configurationSnippets: {
          description: nls.localize("vscode.extension.contributes.debuggers.configurationSnippets", "Snippets for adding new configurations in 'launch.json'."),
          type: "array"
        },
        configurationAttributes: {
          description: nls.localize("vscode.extension.contributes.debuggers.configurationAttributes", "JSON schema configurations for validating 'launch.json'."),
          type: "object"
        },
        when: {
          description: nls.localize("vscode.extension.contributes.debuggers.when", "Condition which must be true to enable this type of debugger. Consider using 'shellExecutionSupported', 'virtualWorkspace', 'resourceScheme' or an extension-defined context key as appropriate for this."),
          type: "string",
          default: ""
        },
        hiddenWhen: {
          description: nls.localize("vscode.extension.contributes.debuggers.hiddenWhen", "When this condition is true, this debugger type is hidden from the debugger list, but is still enabled."),
          type: "string",
          default: ""
        },
        deprecated: {
          description: nls.localize("vscode.extension.contributes.debuggers.deprecated", "Optional message to mark this debug type as being deprecated."),
          type: "string",
          default: ""
        },
        windows: {
          description: nls.localize("vscode.extension.contributes.debuggers.windows", "Windows specific settings."),
          type: "object",
          properties: {
            runtime: {
              description: nls.localize("vscode.extension.contributes.debuggers.windows.runtime", "Runtime used for Windows."),
              type: "string"
            }
          }
        },
        osx: {
          description: nls.localize("vscode.extension.contributes.debuggers.osx", "macOS specific settings."),
          type: "object",
          properties: {
            runtime: {
              description: nls.localize("vscode.extension.contributes.debuggers.osx.runtime", "Runtime used for macOS."),
              type: "string"
            }
          }
        },
        linux: {
          description: nls.localize("vscode.extension.contributes.debuggers.linux", "Linux specific settings."),
          type: "object",
          properties: {
            runtime: {
              description: nls.localize("vscode.extension.contributes.debuggers.linux.runtime", "Runtime used for Linux."),
              type: "string"
            }
          }
        },
        strings: {
          description: nls.localize("vscode.extension.contributes.debuggers.strings", "UI strings contributed by this debug adapter."),
          type: "object",
          properties: {
            unverifiedBreakpoints: {
              description: nls.localize("vscode.extension.contributes.debuggers.strings.unverifiedBreakpoints", "When there are unverified breakpoints in a language supported by this debug adapter, this message will appear on the breakpoint hover and in the breakpoints view. Markdown and command links are supported."),
              type: "string"
            }
          }
        }
      }
    }
  }
});
const breakpointsExtPoint = extensionsRegistry.ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "breakpoints",
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.breakpoints", "Contributes breakpoints."),
    type: "array",
    defaultSnippets: [{ body: [{ language: "" }] }],
    items: {
      type: "object",
      additionalProperties: false,
      defaultSnippets: [{ body: { language: "" } }],
      properties: {
        language: {
          description: nls.localize("vscode.extension.contributes.breakpoints.language", "Allow breakpoints for this language."),
          type: "string"
        },
        when: {
          description: nls.localize("vscode.extension.contributes.breakpoints.when", "Condition which must be true to enable breakpoints in this language. Consider matching this to the debugger when clause as appropriate."),
          type: "string",
          default: ""
        }
      }
    }
  }
});
const presentationSchema = {
  type: "object",
  description: nls.localize("presentation", "Presentation options on how to show this configuration in the debug configuration dropdown and the command palette."),
  properties: {
    hidden: {
      type: "boolean",
      default: false,
      description: nls.localize("presentation.hidden", "Controls if this configuration should be shown in the configuration dropdown and the command palette.")
    },
    group: {
      type: "string",
      default: "",
      description: nls.localize("presentation.group", "Group that this configuration belongs to. Used for grouping and sorting in the configuration dropdown and the command palette.")
    },
    order: {
      type: "number",
      default: 1,
      description: nls.localize("presentation.order", "Order of this configuration within a group. Used for grouping and sorting in the configuration dropdown and the command palette.")
    }
  },
  default: {
    hidden: false,
    group: "",
    order: 1
  }
};
const defaultCompound = { name: "Compound", configurations: [] };
const launchSchema = {
  id: launchSchemaId,
  type: "object",
  title: nls.localize("app.launch.json.title", "Launch"),
  allowTrailingCommas: true,
  allowComments: true,
  required: [],
  default: { version: "0.2.0", configurations: [], compounds: [] },
  properties: {
    version: {
      type: "string",
      description: nls.localize("app.launch.json.version", "Version of this file format."),
      default: "0.2.0"
    },
    configurations: {
      type: "array",
      description: nls.localize("app.launch.json.configurations", "List of configurations. Add new configurations or edit existing ones by using IntelliSense."),
      items: {
        defaultSnippets: [],
        "type": "object",
        oneOf: []
      }
    },
    compounds: {
      type: "array",
      description: nls.localize("app.launch.json.compounds", "List of compounds. Each compound references multiple configurations which will get launched together."),
      items: {
        type: "object",
        required: ["name", "configurations"],
        properties: {
          name: {
            type: "string",
            description: nls.localize("app.launch.json.compound.name", "Name of compound. Appears in the launch configuration drop down menu.")
          },
          presentation: presentationSchema,
          configurations: {
            type: "array",
            default: [],
            items: {
              oneOf: [{
                enum: [],
                description: nls.localize("useUniqueNames", "Please use unique configuration names.")
              }, {
                type: "object",
                required: ["name"],
                properties: {
                  name: {
                    enum: [],
                    description: nls.localize("app.launch.json.compound.name", "Name of compound. Appears in the launch configuration drop down menu.")
                  },
                  folder: {
                    enum: [],
                    description: nls.localize("app.launch.json.compound.folder", "Name of folder in which the compound is located.")
                  }
                }
              }]
            },
            description: nls.localize("app.launch.json.compounds.configurations", "Names of configurations that will be started as part of this compound.")
          },
          stopAll: {
            type: "boolean",
            default: false,
            description: nls.localize("app.launch.json.compound.stopAll", "Controls whether manually terminating one session will stop all of the compound sessions.")
          },
          preLaunchTask: {
            type: "string",
            default: "",
            description: nls.localize("compoundPrelaunchTask", "Task to run before any of the compound configurations start.")
          }
        },
        default: defaultCompound
      },
      default: [
        defaultCompound
      ]
    },
    inputs: inputsSchema.definitions.inputs
  }
};
class DebuggersDataRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.debuggers;
  }
  render(manifest) {
    const contrib = manifest.contributes?.debuggers || [];
    if (!contrib.length) {
      return { data: { headers: [], rows: [] }, dispose: () => {
      } };
    }
    const headers = [
      nls.localize("debugger name", "Name"),
      nls.localize("debugger type", "Type")
    ];
    const rows = contrib.map((d) => {
      return [
        d.label ?? "",
        d.type
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
  id: "debuggers",
  label: nls.localize("debuggers", "Debuggers"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(DebuggersDataRenderer)
});
export {
  breakpointsExtPoint,
  debuggersExtPoint,
  launchSchema,
  presentationSchema
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9kZWJ1Zy9jb21tb24vZGVidWdTY2hlbWFzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgZXh0ZW5zaW9uc1JlZ2lzdHJ5IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IElEZWJ1Z2dlckNvbnRyaWJ1dGlvbiwgSUNvbXBvdW5kLCBJQnJlYWtwb2ludENvbnRyaWJ1dGlvbiB9IGZyb20gJy4vZGVidWcuanMnO1xuaW1wb3J0IHsgbGF1bmNoU2NoZW1hSWQgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElKU09OU2NoZW1hIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vanNvblNjaGVtYS5qcyc7XG5pbXBvcnQgeyBpbnB1dHNTY2hlbWEgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9jb25maWd1cmF0aW9uUmVzb2x2ZXIvY29tbW9uL2NvbmZpZ3VyYXRpb25SZXNvbHZlclNjaGVtYS5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnksIElSZW5kZXJlZERhdGEsIElSb3dEYXRhLCBJVGFibGVEYXRhIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbk1hbmlmZXN0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcblxuLy8gZGVidWdnZXJzIGV4dGVuc2lvbiBwb2ludFxuZXhwb3J0IGNvbnN0IGRlYnVnZ2Vyc0V4dFBvaW50ID0gZXh0ZW5zaW9uc1JlZ2lzdHJ5LkV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElEZWJ1Z2dlckNvbnRyaWJ1dGlvbltdPih7XG5cdGV4dGVuc2lvblBvaW50OiAnZGVidWdnZXJzJyxcblx0ZGVmYXVsdEV4dGVuc2lvbktpbmQ6IFsnd29ya3NwYWNlJ10sXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2VycycsICdDb250cmlidXRlcyBkZWJ1ZyBhZGFwdGVycy4nKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogW3sgdHlwZTogJycgfV0gfV0sXG5cdFx0aXRlbXM6IHtcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiBmYWxzZSxcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiB7IHR5cGU6ICcnLCBwcm9ncmFtOiAnJywgcnVudGltZTogJycgfSB9XSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0dHlwZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZGVidWdnZXJzLnR5cGUnLCBcIlVuaXF1ZSBpZGVudGlmaWVyIGZvciB0aGlzIGRlYnVnIGFkYXB0ZXIuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGxhYmVsOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMubGFiZWwnLCBcIkRpc3BsYXkgbmFtZSBmb3IgdGhpcyBkZWJ1ZyBhZGFwdGVyLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRwcm9ncmFtOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMucHJvZ3JhbScsIFwiUGF0aCB0byB0aGUgZGVidWcgYWRhcHRlciBwcm9ncmFtLiBQYXRoIGlzIGVpdGhlciBhYnNvbHV0ZSBvciByZWxhdGl2ZSB0byB0aGUgZXh0ZW5zaW9uIGZvbGRlci5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fSxcblx0XHRcdFx0YXJnczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZGVidWdnZXJzLmFyZ3MnLCBcIk9wdGlvbmFsIGFyZ3VtZW50cyB0byBwYXNzIHRvIHRoZSBhZGFwdGVyLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJ1bnRpbWU6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5ydW50aW1lJywgXCJPcHRpb25hbCBydW50aW1lIGluIGNhc2UgdGhlIHByb2dyYW0gYXR0cmlidXRlIGlzIG5vdCBhbiBleGVjdXRhYmxlIGJ1dCByZXF1aXJlcyBhIHJ1bnRpbWUuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHJ1bnRpbWVBcmdzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMucnVudGltZUFyZ3MnLCBcIk9wdGlvbmFsIHJ1bnRpbWUgYXJndW1lbnRzLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHZhcmlhYmxlczoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZGVidWdnZXJzLnZhcmlhYmxlcycsIFwiTWFwcGluZyBmcm9tIGludGVyYWN0aXZlIHZhcmlhYmxlcyAoZS5nLiAke2FjdGlvbi5waWNrUHJvY2Vzc30pIGluIGBsYXVuY2guanNvbmAgdG8gYSBjb21tYW5kLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRpbml0aWFsQ29uZmlndXJhdGlvbnM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5pbml0aWFsQ29uZmlndXJhdGlvbnMnLCBcIkNvbmZpZ3VyYXRpb25zIGZvciBnZW5lcmF0aW5nIHRoZSBpbml0aWFsIFxcJ2xhdW5jaC5qc29uXFwnLlwiKSxcblx0XHRcdFx0XHR0eXBlOiBbJ2FycmF5JywgJ3N0cmluZyddLFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRsYW5ndWFnZXM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5sYW5ndWFnZXMnLCBcIkxpc3Qgb2YgbGFuZ3VhZ2VzIGZvciB3aGljaCB0aGUgZGVidWcgZXh0ZW5zaW9uIGNvdWxkIGJlIGNvbnNpZGVyZWQgdGhlIFxcXCJkZWZhdWx0IGRlYnVnZ2VyXFxcIi5cIiksXG5cdFx0XHRcdFx0dHlwZTogJ2FycmF5J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb25maWd1cmF0aW9uU25pcHBldHM6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5jb25maWd1cmF0aW9uU25pcHBldHMnLCBcIlNuaXBwZXRzIGZvciBhZGRpbmcgbmV3IGNvbmZpZ3VyYXRpb25zIGluIFxcJ2xhdW5jaC5qc29uXFwnLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnYXJyYXknXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvbmZpZ3VyYXRpb25BdHRyaWJ1dGVzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMuY29uZmlndXJhdGlvbkF0dHJpYnV0ZXMnLCBcIkpTT04gc2NoZW1hIGNvbmZpZ3VyYXRpb25zIGZvciB2YWxpZGF0aW5nIFxcJ2xhdW5jaC5qc29uXFwnLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0J1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR3aGVuOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMud2hlbicsIFwiQ29uZGl0aW9uIHdoaWNoIG11c3QgYmUgdHJ1ZSB0byBlbmFibGUgdGhpcyB0eXBlIG9mIGRlYnVnZ2VyLiBDb25zaWRlciB1c2luZyAnc2hlbGxFeGVjdXRpb25TdXBwb3J0ZWQnLCAndmlydHVhbFdvcmtzcGFjZScsICdyZXNvdXJjZVNjaGVtZScgb3IgYW4gZXh0ZW5zaW9uLWRlZmluZWQgY29udGV4dCBrZXkgYXMgYXBwcm9wcmlhdGUgZm9yIHRoaXMuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGhpZGRlbldoZW46IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5oaWRkZW5XaGVuJywgXCJXaGVuIHRoaXMgY29uZGl0aW9uIGlzIHRydWUsIHRoaXMgZGVidWdnZXIgdHlwZSBpcyBoaWRkZW4gZnJvbSB0aGUgZGVidWdnZXIgbGlzdCwgYnV0IGlzIHN0aWxsIGVuYWJsZWQuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlcHJlY2F0ZWQ6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5kZXByZWNhdGVkJywgXCJPcHRpb25hbCBtZXNzYWdlIHRvIG1hcmsgdGhpcyBkZWJ1ZyB0eXBlIGFzIGJlaW5nIGRlcHJlY2F0ZWQuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGRlZmF1bHQ6ICcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdpbmRvd3M6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy53aW5kb3dzJywgXCJXaW5kb3dzIHNwZWNpZmljIHNldHRpbmdzLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRydW50aW1lOiB7XG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZGVidWdnZXJzLndpbmRvd3MucnVudGltZScsIFwiUnVudGltZSB1c2VkIGZvciBXaW5kb3dzLlwiKSxcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG9zeDoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuZGVidWdnZXJzLm9zeCcsIFwibWFjT1Mgc3BlY2lmaWMgc2V0dGluZ3MuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHJ1bnRpbWU6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMub3N4LnJ1bnRpbWUnLCBcIlJ1bnRpbWUgdXNlZCBmb3IgbWFjT1MuXCIpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0bGludXg6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5saW51eCcsIFwiTGludXggc3BlY2lmaWMgc2V0dGluZ3MuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHJ1bnRpbWU6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMubGludXgucnVudGltZScsIFwiUnVudGltZSB1c2VkIGZvciBMaW51eC5cIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHRzdHJpbmdzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5kZWJ1Z2dlcnMuc3RyaW5ncycsIFwiVUkgc3RyaW5ncyBjb250cmlidXRlZCBieSB0aGlzIGRlYnVnIGFkYXB0ZXIuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHVudmVyaWZpZWRCcmVha3BvaW50czoge1xuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmRlYnVnZ2Vycy5zdHJpbmdzLnVudmVyaWZpZWRCcmVha3BvaW50cycsIFwiV2hlbiB0aGVyZSBhcmUgdW52ZXJpZmllZCBicmVha3BvaW50cyBpbiBhIGxhbmd1YWdlIHN1cHBvcnRlZCBieSB0aGlzIGRlYnVnIGFkYXB0ZXIsIHRoaXMgbWVzc2FnZSB3aWxsIGFwcGVhciBvbiB0aGUgYnJlYWtwb2ludCBob3ZlciBhbmQgaW4gdGhlIGJyZWFrcG9pbnRzIHZpZXcuIE1hcmtkb3duIGFuZCBjb21tYW5kIGxpbmtzIGFyZSBzdXBwb3J0ZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxufSk7XG5cbi8vIGJyZWFrcG9pbnRzIGV4dGVuc2lvbiBwb2ludCAjOTAzN1xuZXhwb3J0IGNvbnN0IGJyZWFrcG9pbnRzRXh0UG9pbnQgPSBleHRlbnNpb25zUmVnaXN0cnkuRXh0ZW5zaW9uc1JlZ2lzdHJ5LnJlZ2lzdGVyRXh0ZW5zaW9uUG9pbnQ8SUJyZWFrcG9pbnRDb250cmlidXRpb25bXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2JyZWFrcG9pbnRzJyxcblx0anNvblNjaGVtYToge1xuXHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuYnJlYWtwb2ludHMnLCAnQ29udHJpYnV0ZXMgYnJlYWtwb2ludHMuJyksXG5cdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IFt7IGxhbmd1YWdlOiAnJyB9XSB9XSxcblx0XHRpdGVtczoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRkZWZhdWx0U25pcHBldHM6IFt7IGJvZHk6IHsgbGFuZ3VhZ2U6ICcnIH0gfV0sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGxhbmd1YWdlOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5icmVha3BvaW50cy5sYW5ndWFnZScsIFwiQWxsb3cgYnJlYWtwb2ludHMgZm9yIHRoaXMgbGFuZ3VhZ2UuXCIpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHdoZW46IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmJyZWFrcG9pbnRzLndoZW4nLCBcIkNvbmRpdGlvbiB3aGljaCBtdXN0IGJlIHRydWUgdG8gZW5hYmxlIGJyZWFrcG9pbnRzIGluIHRoaXMgbGFuZ3VhZ2UuIENvbnNpZGVyIG1hdGNoaW5nIHRoaXMgdG8gdGhlIGRlYnVnZ2VyIHdoZW4gY2xhdXNlIGFzIGFwcHJvcHJpYXRlLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRkZWZhdWx0OiAnJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuLy8gZGVidWcgZ2VuZXJhbCBzY2hlbWFcblxuZXhwb3J0IGNvbnN0IHByZXNlbnRhdGlvblNjaGVtYTogSUpTT05TY2hlbWEgPSB7XG5cdHR5cGU6ICdvYmplY3QnLFxuXHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwcmVzZW50YXRpb24nLCBcIlByZXNlbnRhdGlvbiBvcHRpb25zIG9uIGhvdyB0byBzaG93IHRoaXMgY29uZmlndXJhdGlvbiBpbiB0aGUgZGVidWcgY29uZmlndXJhdGlvbiBkcm9wZG93biBhbmQgdGhlIGNvbW1hbmQgcGFsZXR0ZS5cIiksXG5cdHByb3BlcnRpZXM6IHtcblx0XHRoaWRkZW46IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlZmF1bHQ6IGZhbHNlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncHJlc2VudGF0aW9uLmhpZGRlbicsIFwiQ29udHJvbHMgaWYgdGhpcyBjb25maWd1cmF0aW9uIHNob3VsZCBiZSBzaG93biBpbiB0aGUgY29uZmlndXJhdGlvbiBkcm9wZG93biBhbmQgdGhlIGNvbW1hbmQgcGFsZXR0ZS5cIilcblx0XHR9LFxuXHRcdGdyb3VwOiB7XG5cdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdGRlZmF1bHQ6ICcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgncHJlc2VudGF0aW9uLmdyb3VwJywgXCJHcm91cCB0aGF0IHRoaXMgY29uZmlndXJhdGlvbiBiZWxvbmdzIHRvLiBVc2VkIGZvciBncm91cGluZyBhbmQgc29ydGluZyBpbiB0aGUgY29uZmlndXJhdGlvbiBkcm9wZG93biBhbmQgdGhlIGNvbW1hbmQgcGFsZXR0ZS5cIilcblx0XHR9LFxuXHRcdG9yZGVyOiB7XG5cdFx0XHR0eXBlOiAnbnVtYmVyJyxcblx0XHRcdGRlZmF1bHQ6IDEsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdwcmVzZW50YXRpb24ub3JkZXInLCBcIk9yZGVyIG9mIHRoaXMgY29uZmlndXJhdGlvbiB3aXRoaW4gYSBncm91cC4gVXNlZCBmb3IgZ3JvdXBpbmcgYW5kIHNvcnRpbmcgaW4gdGhlIGNvbmZpZ3VyYXRpb24gZHJvcGRvd24gYW5kIHRoZSBjb21tYW5kIHBhbGV0dGUuXCIpXG5cdFx0fVxuXHR9LFxuXHRkZWZhdWx0OiB7XG5cdFx0aGlkZGVuOiBmYWxzZSxcblx0XHRncm91cDogJycsXG5cdFx0b3JkZXI6IDFcblx0fVxufTtcbmNvbnN0IGRlZmF1bHRDb21wb3VuZDogSUNvbXBvdW5kID0geyBuYW1lOiAnQ29tcG91bmQnLCBjb25maWd1cmF0aW9uczogW10gfTtcbmV4cG9ydCBjb25zdCBsYXVuY2hTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHRpZDogbGF1bmNoU2NoZW1hSWQsXG5cdHR5cGU6ICdvYmplY3QnLFxuXHR0aXRsZTogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24udGl0bGUnLCBcIkxhdW5jaFwiKSxcblx0YWxsb3dUcmFpbGluZ0NvbW1hczogdHJ1ZSxcblx0YWxsb3dDb21tZW50czogdHJ1ZSxcblx0cmVxdWlyZWQ6IFtdLFxuXHRkZWZhdWx0OiB7IHZlcnNpb246ICcwLjIuMCcsIGNvbmZpZ3VyYXRpb25zOiBbXSwgY29tcG91bmRzOiBbXSB9LFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0dmVyc2lvbjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24udmVyc2lvbicsIFwiVmVyc2lvbiBvZiB0aGlzIGZpbGUgZm9ybWF0LlwiKSxcblx0XHRcdGRlZmF1bHQ6ICcwLjIuMCdcblx0XHR9LFxuXHRcdGNvbmZpZ3VyYXRpb25zOiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYXBwLmxhdW5jaC5qc29uLmNvbmZpZ3VyYXRpb25zJywgXCJMaXN0IG9mIGNvbmZpZ3VyYXRpb25zLiBBZGQgbmV3IGNvbmZpZ3VyYXRpb25zIG9yIGVkaXQgZXhpc3Rpbmcgb25lcyBieSB1c2luZyBJbnRlbGxpU2Vuc2UuXCIpLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXSxcblx0XHRcdFx0J3R5cGUnOiAnb2JqZWN0Jyxcblx0XHRcdFx0b25lT2Y6IFtdXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjb21wb3VuZHM6IHtcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24uY29tcG91bmRzJywgXCJMaXN0IG9mIGNvbXBvdW5kcy4gRWFjaCBjb21wb3VuZCByZWZlcmVuY2VzIG11bHRpcGxlIGNvbmZpZ3VyYXRpb25zIHdoaWNoIHdpbGwgZ2V0IGxhdW5jaGVkIHRvZ2V0aGVyLlwiKSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRyZXF1aXJlZDogWyduYW1lJywgJ2NvbmZpZ3VyYXRpb25zJ10sXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRuYW1lOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2FwcC5sYXVuY2guanNvbi5jb21wb3VuZC5uYW1lJywgXCJOYW1lIG9mIGNvbXBvdW5kLiBBcHBlYXJzIGluIHRoZSBsYXVuY2ggY29uZmlndXJhdGlvbiBkcm9wIGRvd24gbWVudS5cIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHByZXNlbnRhdGlvbjogcHJlc2VudGF0aW9uU2NoZW1hLFxuXHRcdFx0XHRcdGNvbmZpZ3VyYXRpb25zOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogW10sXG5cdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRvbmVPZjogW3tcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbXSxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd1c2VVbmlxdWVOYW1lcycsIFwiUGxlYXNlIHVzZSB1bmlxdWUgY29uZmlndXJhdGlvbiBuYW1lcy5cIilcblx0XHRcdFx0XHRcdFx0fSwge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0XHRcdHJlcXVpcmVkOiBbJ25hbWUnXSxcblx0XHRcdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRuYW1lOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGVudW06IFtdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24uY29tcG91bmQubmFtZScsIFwiTmFtZSBvZiBjb21wb3VuZC4gQXBwZWFycyBpbiB0aGUgbGF1bmNoIGNvbmZpZ3VyYXRpb24gZHJvcCBkb3duIG1lbnUuXCIpXG5cdFx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdFx0Zm9sZGVyOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRcdGVudW06IFtdLFxuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24uY29tcG91bmQuZm9sZGVyJywgXCJOYW1lIG9mIGZvbGRlciBpbiB3aGljaCB0aGUgY29tcG91bmQgaXMgbG9jYXRlZC5cIilcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1dXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnYXBwLmxhdW5jaC5qc29uLmNvbXBvdW5kcy5jb25maWd1cmF0aW9ucycsIFwiTmFtZXMgb2YgY29uZmlndXJhdGlvbnMgdGhhdCB3aWxsIGJlIHN0YXJ0ZWQgYXMgcGFydCBvZiB0aGlzIGNvbXBvdW5kLlwiKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0c3RvcEFsbDoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2UsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdhcHAubGF1bmNoLmpzb24uY29tcG91bmQuc3RvcEFsbCcsIFwiQ29udHJvbHMgd2hldGhlciBtYW51YWxseSB0ZXJtaW5hdGluZyBvbmUgc2Vzc2lvbiB3aWxsIHN0b3AgYWxsIG9mIHRoZSBjb21wb3VuZCBzZXNzaW9ucy5cIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHByZUxhdW5jaFRhc2s6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogJycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdjb21wb3VuZFByZWxhdW5jaFRhc2snLCBcIlRhc2sgdG8gcnVuIGJlZm9yZSBhbnkgb2YgdGhlIGNvbXBvdW5kIGNvbmZpZ3VyYXRpb25zIHN0YXJ0LlwiKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0ZGVmYXVsdDogZGVmYXVsdENvbXBvdW5kXG5cdFx0XHR9LFxuXHRcdFx0ZGVmYXVsdDogW1xuXHRcdFx0XHRkZWZhdWx0Q29tcG91bmRcblx0XHRcdF1cblx0XHR9LFxuXHRcdGlucHV0czogaW5wdXRzU2NoZW1hLmRlZmluaXRpb25zIS5pbnB1dHNcblx0fVxufTtcblxuY2xhc3MgRGVidWdnZXJzRGF0YVJlbmRlcmVyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciB7XG5cblx0cmVhZG9ubHkgdHlwZSA9ICd0YWJsZSc7XG5cblx0c2hvdWxkUmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gISFtYW5pZmVzdC5jb250cmlidXRlcz8uZGVidWdnZXJzO1xuXHR9XG5cblx0cmVuZGVyKG1hbmlmZXN0OiBJRXh0ZW5zaW9uTWFuaWZlc3QpOiBJUmVuZGVyZWREYXRhPElUYWJsZURhdGE+IHtcblx0XHRjb25zdCBjb250cmliID0gbWFuaWZlc3QuY29udHJpYnV0ZXM/LmRlYnVnZ2VycyB8fCBbXTtcblx0XHRpZiAoIWNvbnRyaWIubGVuZ3RoKSB7XG5cdFx0XHRyZXR1cm4geyBkYXRhOiB7IGhlYWRlcnM6IFtdLCByb3dzOiBbXSB9LCBkaXNwb3NlOiAoKSA9PiB7IH0gfTtcblx0XHR9XG5cblx0XHRjb25zdCBoZWFkZXJzID0gW1xuXHRcdFx0bmxzLmxvY2FsaXplKCdkZWJ1Z2dlciBuYW1lJywgXCJOYW1lXCIpLFxuXHRcdFx0bmxzLmxvY2FsaXplKCdkZWJ1Z2dlciB0eXBlJywgXCJUeXBlXCIpLFxuXHRcdF07XG5cblx0XHRjb25zdCByb3dzOiBJUm93RGF0YVtdW10gPSBjb250cmliLm1hcChkID0+IHtcblx0XHRcdHJldHVybiBbXG5cdFx0XHRcdGQubGFiZWwgPz8gJycsXG5cdFx0XHRcdGQudHlwZVxuXHRcdFx0XTtcblx0XHR9KTtcblxuXHRcdHJldHVybiB7XG5cdFx0XHRkYXRhOiB7XG5cdFx0XHRcdGhlYWRlcnMsXG5cdFx0XHRcdHJvd3Ncblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlOiAoKSA9PiB7IH1cblx0XHR9O1xuXHR9XG59XG5cblJlZ2lzdHJ5LmFzPElFeHRlbnNpb25GZWF0dXJlc1JlZ2lzdHJ5PihFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAnZGVidWdnZXJzJyxcblx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnZGVidWdnZXJzJywgXCJEZWJ1Z2dlcnNcIiksXG5cdGFjY2Vzczoge1xuXHRcdGNhblRvZ2dsZTogZmFsc2Vcblx0fSxcblx0cmVuZGVyZXI6IG5ldyBTeW5jRGVzY3JpcHRvcihEZWJ1Z2dlcnNEYXRhUmVuZGVyZXIpLFxufSk7XG5cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksd0JBQXdCO0FBQ3BDLFlBQVksU0FBUztBQUVyQixTQUFTLHNCQUFzQjtBQUUvQixTQUFTLG9CQUFvQjtBQUM3QixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLGtCQUFtSDtBQUU1SCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGdCQUFnQjtBQUdsQixNQUFNLG9CQUFvQixtQkFBbUIsbUJBQW1CLHVCQUFnRDtBQUFBLEVBQ3RILGdCQUFnQjtBQUFBLEVBQ2hCLHNCQUFzQixDQUFDLFdBQVc7QUFBQSxFQUNsQyxZQUFZO0FBQUEsSUFDWCxhQUFhLElBQUksU0FBUywwQ0FBMEMsNkJBQTZCO0FBQUEsSUFDakcsTUFBTTtBQUFBLElBQ04saUJBQWlCLENBQUMsRUFBRSxNQUFNLENBQUMsRUFBRSxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7QUFBQSxJQUMxQyxPQUFPO0FBQUEsTUFDTixzQkFBc0I7QUFBQSxNQUN0QixNQUFNO0FBQUEsTUFDTixpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxNQUFNLElBQUksU0FBUyxJQUFJLFNBQVMsR0FBRyxFQUFFLENBQUM7QUFBQSxNQUNsRSxZQUFZO0FBQUEsUUFDWCxNQUFNO0FBQUEsVUFDTCxhQUFhLElBQUksU0FB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
