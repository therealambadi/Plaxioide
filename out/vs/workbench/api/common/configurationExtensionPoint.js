import * as nls from "../../../nls.js";
import * as objects from "../../../base/common/objects.js";
import { Registry } from "../../../platform/registry/common/platform.js";
import { ExtensionsRegistry } from "../../services/extensions/common/extensionsRegistry.js";
import { Extensions, validateProperty, ConfigurationScope, OVERRIDE_PROPERTY_REGEX, configurationDefaultsSchemaId, getDefaultValue, getAllConfigurationProperties, parseScope } from "../../../platform/configuration/common/configurationRegistry.js";
import { Extensions as JSONExtensions } from "../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { workspaceSettingsSchemaId, launchSchemaId, tasksSchemaId, mcpSchemaId } from "../../services/configuration/common/configuration.js";
import { isObject, isUndefined } from "../../../base/common/types.js";
import { ExtensionIdentifierMap } from "../../../platform/extensions/common/extensions.js";
import { Extensions as ExtensionFeaturesExtensions } from "../../services/extensionManagement/common/extensionFeatures.js";
import { Disposable } from "../../../base/common/lifecycle.js";
import { SyncDescriptor } from "../../../platform/instantiation/common/descriptors.js";
import { MarkdownString } from "../../../base/common/htmlContent.js";
import product from "../../../platform/product/common/product.js";
const jsonRegistry = Registry.as(JSONExtensions.JSONContribution);
const configurationRegistry = Registry.as(Extensions.Configuration);
const configurationEntrySchema = {
  type: "object",
  defaultSnippets: [{ body: { title: "", properties: {} } }],
  properties: {
    title: {
      description: nls.localize("vscode.extension.contributes.configuration.title", "A title for the current category of settings. This label will be rendered in the Settings editor as a subheading. If the title is the same as the extension display name, then the category will be grouped under the main extension heading."),
      type: "string"
    },
    order: {
      description: nls.localize("vscode.extension.contributes.configuration.order", "When specified, gives the order of this category of settings relative to other categories."),
      type: "integer"
    },
    properties: {
      description: nls.localize("vscode.extension.contributes.configuration.properties", "Description of the configuration properties."),
      type: "object",
      propertyNames: {
        pattern: "\\S+",
        patternErrorMessage: nls.localize("vscode.extension.contributes.configuration.property.empty", "Property should not be empty.")
      },
      additionalProperties: {
        anyOf: [
          {
            title: nls.localize("vscode.extension.contributes.configuration.properties.schema", "Schema of the configuration property."),
            $ref: "http://json-schema.org/draft-07/schema#"
          },
          {
            type: "object",
            properties: {
              scope: {
                type: "string",
                enum: ["application", "machine", "window", "resource", "language-overridable", "machine-overridable"],
                default: "window",
                enumDescriptions: [
                  nls.localize("scope.application.description", "Configuration that can be configured only in the user settings."),
                  nls.localize("scope.machine.description", "Configuration that can be configured only in the user settings or only in the remote settings."),
                  nls.localize("scope.window.description", "Configuration that can be configured in the user, remote or workspace settings."),
                  nls.localize("scope.resource.description", "Configuration that can be configured in the user, remote, workspace or folder settings."),
                  nls.localize("scope.language-overridable.description", "Resource configuration that can be configured in language specific settings."),
                  nls.localize("scope.machine-overridable.description", "Machine configuration that can be configured also in workspace or folder settings.")
                ],
                markdownDescription: nls.localize("scope.description", "Scope in which the configuration is applicable. Available scopes are `application`, `machine`, `window`, `resource`, and `machine-overridable`.")
              },
              enumDescriptions: {
                type: "array",
                items: {
                  type: "string"
                },
                description: nls.localize("scope.enumDescriptions", "Descriptions for enum values")
              },
              markdownEnumDescriptions: {
                type: "array",
                items: {
                  type: "string"
                },
                description: nls.localize("scope.markdownEnumDescriptions", "Descriptions for enum values in the markdown format.")
              },
              enumItemLabels: {
                type: "array",
                items: {
                  type: "string"
                },
                markdownDescription: nls.localize("scope.enumItemLabels", "Labels for enum values to be displayed in the Settings editor. When specified, the {0} values still show after the labels, but less prominently.", "`enum`")
              },
              markdownDescription: {
                type: "string",
                description: nls.localize("scope.markdownDescription", "The description in the markdown format.")
              },
              deprecationMessage: {
                type: "string",
                description: nls.localize("scope.deprecationMessage", "If set, the property is marked as deprecated and the given message is shown as an explanation.")
              },
              markdownDeprecationMessage: {
                type: "string",
                description: nls.localize("scope.markdownDeprecationMessage", "If set, the property is marked as deprecated and the given message is shown as an explanation in the markdown format.")
              },
              editPresentation: {
                type: "string",
                enum: ["singlelineText", "multilineText"],
                enumDescriptions: [
                  nls.localize("scope.singlelineText.description", "The value will be shown in an inputbox."),
                  nls.localize("scope.multilineText.description", "The value will be shown in a textarea.")
                ],
                default: "singlelineText",
                description: nls.localize("scope.editPresentation", "When specified, controls the presentation format of the string setting.")
              },
              order: {
                type: "integer",
                description: nls.localize("scope.order", "When specified, gives the order of this setting relative to other settings within the same category. Settings with an order property will be placed before settings without this property set.")
              },
              ignoreSync: {
                type: "boolean",
                description: nls.localize("scope.ignoreSync", "When enabled, Settings Sync will not sync the user value of this configuration by default.")
              },
              tags: {
                type: "array",
                items: {
                  type: "string"
                },
                markdownDescription: nls.localize("scope.tags", "A list of categories under which to place the setting. The category can then be searched up in the Settings editor. For example, specifying the `experimental` tag allows one to find the setting by searching `@tag:experimental`.")
              }
            }
          }
        ]
      }
    }
  }
};
let _configDelta;
const defaultConfigurationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "configurationDefaults",
  jsonSchema: {
    $ref: configurationDefaultsSchemaId
  },
  canHandleResolver: true
});
defaultConfigurationExtPoint.setHandler((extensions, { added, removed }) => {
  if (_configDelta) {
    configurationRegistry.deltaConfiguration(_configDelta);
  }
  const configNow = _configDelta = {};
  queueMicrotask(() => {
    if (_configDelta === configNow) {
      configurationRegistry.deltaConfiguration(_configDelta);
      _configDelta = void 0;
    }
  });
  if (removed.length) {
    const removedDefaultConfigurations = removed.map((extension) => ({ overrides: objects.deepClone(extension.value), source: { id: extension.description.identifier.value, displayName: extension.description.displayName } }));
    _configDelta.removedDefaults = removedDefaultConfigurations;
  }
  if (added.length) {
    const registeredProperties = configurationRegistry.getConfigurationProperties();
    const allowedScopes = [ConfigurationScope.MACHINE_OVERRIDABLE, ConfigurationScope.WINDOW, ConfigurationScope.RESOURCE, ConfigurationScope.LANGUAGE_OVERRIDABLE];
    const addedDefaultConfigurations = added.map((extension) => {
      const overrides = objects.deepClone(extension.value);
      for (const key of Object.keys(overrides)) {
        const registeredPropertyScheme = registeredProperties[key];
        if (registeredPropertyScheme?.disallowConfigurationDefault) {
          extension.collector.warn(nls.localize("config.property.preventDefaultConfiguration.warning", "Cannot register configuration defaults for '{0}'. This setting does not allow contributing configuration defaults.", key));
          delete overrides[key];
          continue;
        }
        if (!OVERRIDE_PROPERTY_REGEX.test(key)) {
          if (registeredPropertyScheme?.scope && !allowedScopes.includes(registeredPropertyScheme.scope)) {
            extension.collector.warn(nls.localize("config.property.defaultConfiguration.warning", "Cannot register configuration defaults for '{0}'. Only defaults for machine-overridable, window, resource and language overridable scoped settings are supported.", key));
            delete overrides[key];
            continue;
          }
        }
      }
      return { overrides, source: { id: extension.description.identifier.value, displayName: extension.description.displayName } };
    });
    _configDelta.addedDefaults = addedDefaultConfigurations;
  }
});
const configurationExtPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "configuration",
  deps: [defaultConfigurationExtPoint],
  jsonSchema: {
    description: nls.localize("vscode.extension.contributes.configuration", "Contributes configuration settings."),
    oneOf: [
      configurationEntrySchema,
      {
        type: "array",
        items: configurationEntrySchema
      }
    ]
  },
  canHandleResolver: true
});
const extensionConfigurations = new ExtensionIdentifierMap();
configurationExtPoint.setHandler((extensions, { added, removed }) => {
  _configDelta ??= {};
  if (removed.length) {
    const removedConfigurations = [];
    for (const extension of removed) {
      removedConfigurations.push(...extensionConfigurations.get(extension.description.identifier) || []);
      extensionConfigurations.delete(extension.description.identifier);
    }
    _configDelta.removedConfigurations = removedConfigurations;
  }
  const seenProperties = /* @__PURE__ */ new Set();
  function handleConfiguration(node, extension) {
    const configuration = objects.deepClone(node);
    if (configuration.title && typeof configuration.title !== "string") {
      extension.collector.error(nls.localize("invalid.title", "'configuration.title' must be a string"));
    }
    validateProperties(configuration, extension);
    configuration.id = node.id || extension.description.identifier.value;
    configuration.extensionInfo = { id: extension.description.identifier.value, displayName: extension.description.displayName };
    configuration.restrictedProperties = extension.description.capabilities?.untrustedWorkspaces?.supported === "limited" ? extension.description.capabilities?.untrustedWorkspaces.restrictedConfigurations : void 0;
    configuration.title = configuration.title || extension.description.displayName || extension.description.identifier.value;
    return configuration;
  }
  function validateProperties(configuration, extension) {
    const properties = configuration.properties;
    const extensionConfigurationPolicy = product.extensionConfigurationPolicy;
    if (properties) {
      if (typeof properties !== "object") {
        extension.collector.error(nls.localize("invalid.properties", "'configuration.properties' must be an object"));
        configuration.properties = {};
      }
      for (const key in properties) {
        const propertyConfiguration = properties[key];
        const message = validateProperty(key, propertyConfiguration);
        if (message) {
          delete properties[key];
          extension.collector.warn(message);
          continue;
        }
        if (seenProperties.has(key)) {
          delete properties[key];
          extension.collector.warn(nls.localize("config.property.duplicate", "Cannot register '{0}'. This property is already registered.", key));
          continue;
        }
        if (!isObject(propertyConfiguration)) {
          delete properties[key];
          extension.collector.error(nls.localize("invalid.property", "configuration.properties property '{0}' must be an object", key));
          continue;
        }
        if (extensionConfigurationPolicy?.[key]) {
          propertyConfiguration.policy = extensionConfigurationPolicy?.[key];
        }
        seenProperties.add(key);
        propertyConfiguration.scope = propertyConfiguration.scope ? parseScope(propertyConfiguration.scope.toString()) : ConfigurationScope.WINDOW;
      }
    }
    const subNodes = configuration.allOf;
    if (subNodes) {
      extension.collector.error(nls.localize("invalid.allOf", "'configuration.allOf' is deprecated and should no longer be used. Instead, pass multiple configuration sections as an array to the 'configuration' contribution point."));
      for (const node of subNodes) {
        validateProperties(node, extension);
      }
    }
  }
  if (added.length) {
    const addedConfigurations = [];
    for (const extension of added) {
      const configurations = [];
      const value = extension.value;
      if (Array.isArray(value)) {
        value.forEach((v) => configurations.push(handleConfiguration(v, extension)));
      } else {
        configurations.push(handleConfiguration(value, extension));
      }
      extensionConfigurations.set(extension.description.identifier, configurations);
      addedConfigurations.push(...configurations);
    }
    _configDelta.addedConfigurations = addedConfigurations;
  }
  configurationRegistry.deltaConfiguration(_configDelta);
  _configDelta = void 0;
});
jsonRegistry.registerSchema("vscode://schemas/workspaceConfig", {
  allowComments: true,
  allowTrailingCommas: true,
  default: {
    folders: [
      {
        path: ""
      }
    ],
    settings: {}
  },
  required: ["folders"],
  properties: {
    "folders": {
      minItems: 0,
      uniqueItems: true,
      description: nls.localize("workspaceConfig.folders.description", "List of folders to be loaded in the workspace."),
      items: {
        type: "object",
        defaultSnippets: [{ body: { path: "$1" } }],
        oneOf: [{
          properties: {
            path: {
              type: "string",
              description: nls.localize("workspaceConfig.path.description", "A file path. e.g. `/root/folderA` or `./folderA` for a relative path that will be resolved against the location of the workspace file.")
            },
            name: {
              type: "string",
              description: nls.localize("workspaceConfig.name.description", "An optional name for the folder. ")
            }
          },
          required: ["path"]
        }, {
          properties: {
            uri: {
              type: "string",
              description: nls.localize("workspaceConfig.uri.description", "URI of the folder")
            },
            name: {
              type: "string",
              description: nls.localize("workspaceConfig.name.description", "An optional name for the folder. ")
            }
          },
          required: ["uri"]
        }]
      }
    },
    "settings": {
      type: "object",
      default: {},
      description: nls.localize("workspaceConfig.settings.description", "Workspace settings"),
      $ref: workspaceSettingsSchemaId
    },
    "launch": {
      type: "object",
      default: { configurations: [], compounds: [] },
      description: nls.localize("workspaceConfig.launch.description", "Workspace launch configurations"),
      $ref: launchSchemaId
    },
    "tasks": {
      type: "object",
      default: { version: "2.0.0", tasks: [] },
      description: nls.localize("workspaceConfig.tasks.description", "Workspace task configurations"),
      $ref: tasksSchemaId
    },
    "mcp": {
      type: "object",
      default: {
        inputs: [],
        servers: {
          "mcp-server-time": {
            command: "python",
            args: ["-m", "mcp_server_time", "--local-timezone=America/Los_Angeles"]
          }
        }
      },
      description: nls.localize("workspaceConfig.mcp.description", "Model Context Protocol server configurations"),
      $ref: mcpSchemaId
    },
    "extensions": {
      type: "object",
      default: {},
      description: nls.localize("workspaceConfig.extensions.description", "Workspace extensions"),
      $ref: "vscode://schemas/extensions"
    },
    "remoteAuthority": {
      type: "string",
      doNotSuggest: true,
      description: nls.localize("workspaceConfig.remoteAuthority", "The remote server where the workspace is located.")
    },
    "transient": {
      type: "boolean",
      doNotSuggest: true,
      description: nls.localize("workspaceConfig.transient", "A transient workspace will disappear when restarting or reloading.")
    }
  },
  errorMessage: nls.localize("unknownWorkspaceProperty", "Unknown workspace configuration property")
});
class SettingsTableRenderer extends Disposable {
  constructor() {
    super(...arguments);
    this.type = "table";
  }
  shouldRender(manifest) {
    return !!manifest.contributes?.configuration;
  }
  render(manifest) {
    const configuration = manifest.contributes?.configuration ? Array.isArray(manifest.contributes.configuration) ? manifest.contributes.configuration : [manifest.contributes.configuration] : [];
    const properties = getAllConfigurationProperties(configuration);
    const contrib = properties ? Object.keys(properties) : [];
    const headers = [nls.localize("setting name", "ID"), nls.localize("description", "Description"), nls.localize("default", "Default")];
    const rows = contrib.sort((a, b) => a.localeCompare(b)).map((key) => {
      return [
        new MarkdownString().appendMarkdown(`\`${key}\``),
        properties[key].markdownDescription ? new MarkdownString(properties[key].markdownDescription, false) : properties[key].description ?? "",
        new MarkdownString().appendCodeblock("json", JSON.stringify(isUndefined(properties[key].default) ? getDefaultValue(properties[key].type) : properties[key].default, null, 2))
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
Registry.as(ExtensionFeaturesExtensions.ExtensionFeaturesRegistry).registerExtensionFeature({
  id: "configuration",
  label: nls.localize("settings", "Settings"),
  access: {
    canToggle: false
  },
  renderer: new SyncDescriptor(SettingsTableRenderer)
});
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9jb25maWd1cmF0aW9uRXh0ZW5zaW9uUG9pbnQudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCAqIGFzIG9iamVjdHMgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vb2JqZWN0cy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uc1JlZ2lzdHJ5LCBJRXh0ZW5zaW9uUG9pbnRVc2VyIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uTm9kZSwgSUNvbmZpZ3VyYXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucywgdmFsaWRhdGVQcm9wZXJ0eSwgQ29uZmlndXJhdGlvblNjb3BlLCBPVkVSUklERV9QUk9QRVJUWV9SRUdFWCwgSUNvbmZpZ3VyYXRpb25EZWZhdWx0cywgY29uZmlndXJhdGlvbkRlZmF1bHRzU2NoZW1hSWQsIElDb25maWd1cmF0aW9uRGVsdGEsIGdldERlZmF1bHRWYWx1ZSwgZ2V0QWxsQ29uZmlndXJhdGlvblByb3BlcnRpZXMsIHBhcnNlU2NvcGUgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUpTT05Db250cmlidXRpb25SZWdpc3RyeSwgRXh0ZW5zaW9ucyBhcyBKU09ORXh0ZW5zaW9ucyB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2pzb25zY2hlbWFzL2NvbW1vbi9qc29uQ29udHJpYnV0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgd29ya3NwYWNlU2V0dGluZ3NTY2hlbWFJZCwgbGF1bmNoU2NoZW1hSWQsIHRhc2tzU2NoZW1hSWQsIG1jcFNjaGVtYUlkIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBpc09iamVjdCwgaXNVbmRlZmluZWQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90eXBlcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyTWFwLCBJRXh0ZW5zaW9uTWFuaWZlc3QgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElTdHJpbmdEaWN0aW9uYXJ5IH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY29sbGVjdGlvbnMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9ucyBhcyBFeHRlbnNpb25GZWF0dXJlc0V4dGVuc2lvbnMsIElFeHRlbnNpb25GZWF0dXJlVGFibGVSZW5kZXJlciwgSUV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnksIElSZW5kZXJlZERhdGEsIElSb3dEYXRhLCBJVGFibGVEYXRhIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9uTWFuYWdlbWVudC9jb21tb24vZXh0ZW5zaW9uRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBTeW5jRGVzY3JpcHRvciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2Rlc2NyaXB0b3JzLmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5cbmNvbnN0IGpzb25SZWdpc3RyeSA9IFJlZ2lzdHJ5LmFzPElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuY29uc3QgY29uZmlndXJhdGlvblJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oRXh0ZW5zaW9ucy5Db25maWd1cmF0aW9uKTtcblxuY29uc3QgY29uZmlndXJhdGlvbkVudHJ5U2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0dHlwZTogJ29iamVjdCcsXG5cdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyB0aXRsZTogJycsIHByb3BlcnRpZXM6IHt9IH0gfV0sXG5cdHByb3BlcnRpZXM6IHtcblx0XHR0aXRsZToge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5jb25maWd1cmF0aW9uLnRpdGxlJywgJ0EgdGl0bGUgZm9yIHRoZSBjdXJyZW50IGNhdGVnb3J5IG9mIHNldHRpbmdzLiBUaGlzIGxhYmVsIHdpbGwgYmUgcmVuZGVyZWQgaW4gdGhlIFNldHRpbmdzIGVkaXRvciBhcyBhIHN1YmhlYWRpbmcuIElmIHRoZSB0aXRsZSBpcyB0aGUgc2FtZSBhcyB0aGUgZXh0ZW5zaW9uIGRpc3BsYXkgbmFtZSwgdGhlbiB0aGUgY2F0ZWdvcnkgd2lsbCBiZSBncm91cGVkIHVuZGVyIHRoZSBtYWluIGV4dGVuc2lvbiBoZWFkaW5nLicpLFxuXHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHR9LFxuXHRcdG9yZGVyOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbmZpZ3VyYXRpb24ub3JkZXInLCAnV2hlbiBzcGVjaWZpZWQsIGdpdmVzIHRoZSBvcmRlciBvZiB0aGlzIGNhdGVnb3J5IG9mIHNldHRpbmdzIHJlbGF0aXZlIHRvIG90aGVyIGNhdGVnb3JpZXMuJyksXG5cdFx0XHR0eXBlOiAnaW50ZWdlcidcblx0XHR9LFxuXHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuY29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzJywgJ0Rlc2NyaXB0aW9uIG9mIHRoZSBjb25maWd1cmF0aW9uIHByb3BlcnRpZXMuJyksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdHByb3BlcnR5TmFtZXM6IHtcblx0XHRcdFx0cGF0dGVybjogJ1xcXFxTKycsXG5cdFx0XHRcdHBhdHRlcm5FcnJvck1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5jb25maWd1cmF0aW9uLnByb3BlcnR5LmVtcHR5JywgJ1Byb3BlcnR5IHNob3VsZCBub3QgYmUgZW1wdHkuJyksXG5cdFx0XHR9LFxuXHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IHtcblx0XHRcdFx0YW55T2Y6IFtcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHR0aXRsZTogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbmZpZ3VyYXRpb24ucHJvcGVydGllcy5zY2hlbWEnLCAnU2NoZW1hIG9mIHRoZSBjb25maWd1cmF0aW9uIHByb3BlcnR5LicpLFxuXHRcdFx0XHRcdFx0JHJlZjogJ2h0dHA6Ly9qc29uLXNjaGVtYS5vcmcvZHJhZnQtMDcvc2NoZW1hIydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0XHRzY29wZToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFsnYXBwbGljYXRpb24nLCAnbWFjaGluZScsICd3aW5kb3cnLCAncmVzb3VyY2UnLCAnbGFuZ3VhZ2Utb3ZlcnJpZGFibGUnLCAnbWFjaGluZS1vdmVycmlkYWJsZSddLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6ICd3aW5kb3cnLFxuXHRcdFx0XHRcdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NvcGUuYXBwbGljYXRpb24uZGVzY3JpcHRpb24nLCBcIkNvbmZpZ3VyYXRpb24gdGhhdCBjYW4gYmUgY29uZmlndXJlZCBvbmx5IGluIHRoZSB1c2VyIHNldHRpbmdzLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NvcGUubWFjaGluZS5kZXNjcmlwdGlvbicsIFwiQ29uZmlndXJhdGlvbiB0aGF0IGNhbiBiZSBjb25maWd1cmVkIG9ubHkgaW4gdGhlIHVzZXIgc2V0dGluZ3Mgb3Igb25seSBpbiB0aGUgcmVtb3RlIHNldHRpbmdzLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NvcGUud2luZG93LmRlc2NyaXB0aW9uJywgXCJDb25maWd1cmF0aW9uIHRoYXQgY2FuIGJlIGNvbmZpZ3VyZWQgaW4gdGhlIHVzZXIsIHJlbW90ZSBvciB3b3Jrc3BhY2Ugc2V0dGluZ3MuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY29wZS5yZXNvdXJjZS5kZXNjcmlwdGlvbicsIFwiQ29uZmlndXJhdGlvbiB0aGF0IGNhbiBiZSBjb25maWd1cmVkIGluIHRoZSB1c2VyLCByZW1vdGUsIHdvcmtzcGFjZSBvciBmb2xkZXIgc2V0dGluZ3MuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY29wZS5sYW5ndWFnZS1vdmVycmlkYWJsZS5kZXNjcmlwdGlvbicsIFwiUmVzb3VyY2UgY29uZmlndXJhdGlvbiB0aGF0IGNhbiBiZSBjb25maWd1cmVkIGluIGxhbmd1YWdlIHNwZWNpZmljIHNldHRpbmdzLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NvcGUubWFjaGluZS1vdmVycmlkYWJsZS5kZXNjcmlwdGlvbicsIFwiTWFjaGluZSBjb25maWd1cmF0aW9uIHRoYXQgY2FuIGJlIGNvbmZpZ3VyZWQgYWxzbyBpbiB3b3Jrc3BhY2Ugb3IgZm9sZGVyIHNldHRpbmdzLlwiKVxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5kZXNjcmlwdGlvbicsIFwiU2NvcGUgaW4gd2hpY2ggdGhlIGNvbmZpZ3VyYXRpb24gaXMgYXBwbGljYWJsZS4gQXZhaWxhYmxlIHNjb3BlcyBhcmUgYGFwcGxpY2F0aW9uYCwgYG1hY2hpbmVgLCBgd2luZG93YCwgYHJlc291cmNlYCwgYW5kIGBtYWNoaW5lLW92ZXJyaWRhYmxlYC5cIilcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NvcGUuZW51bURlc2NyaXB0aW9ucycsICdEZXNjcmlwdGlvbnMgZm9yIGVudW0gdmFsdWVzJylcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0bWFya2Rvd25FbnVtRGVzY3JpcHRpb25zOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5tYXJrZG93bkVudW1EZXNjcmlwdGlvbnMnLCAnRGVzY3JpcHRpb25zIGZvciBlbnVtIHZhbHVlcyBpbiB0aGUgbWFya2Rvd24gZm9ybWF0LicpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGVudW1JdGVtTGFiZWxzOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnc2NvcGUuZW51bUl0ZW1MYWJlbHMnLCAnTGFiZWxzIGZvciBlbnVtIHZhbHVlcyB0byBiZSBkaXNwbGF5ZWQgaW4gdGhlIFNldHRpbmdzIGVkaXRvci4gV2hlbiBzcGVjaWZpZWQsIHRoZSB7MH0gdmFsdWVzIHN0aWxsIHNob3cgYWZ0ZXIgdGhlIGxhYmVscywgYnV0IGxlc3MgcHJvbWluZW50bHkuJywgJ2BlbnVtYCcpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5tYXJrZG93bkRlc2NyaXB0aW9uJywgJ1RoZSBkZXNjcmlwdGlvbiBpbiB0aGUgbWFya2Rvd24gZm9ybWF0LicpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZToge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njb3BlLmRlcHJlY2F0aW9uTWVzc2FnZScsICdJZiBzZXQsIHRoZSBwcm9wZXJ0eSBpcyBtYXJrZWQgYXMgZGVwcmVjYXRlZCBhbmQgdGhlIGdpdmVuIG1lc3NhZ2UgaXMgc2hvd24gYXMgYW4gZXhwbGFuYXRpb24uJylcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXByZWNhdGlvbk1lc3NhZ2U6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5tYXJrZG93bkRlcHJlY2F0aW9uTWVzc2FnZScsICdJZiBzZXQsIHRoZSBwcm9wZXJ0eSBpcyBtYXJrZWQgYXMgZGVwcmVjYXRlZCBhbmQgdGhlIGdpdmVuIG1lc3NhZ2UgaXMgc2hvd24gYXMgYW4gZXhwbGFuYXRpb24gaW4gdGhlIG1hcmtkb3duIGZvcm1hdC4nKVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRlZGl0UHJlc2VudGF0aW9uOiB7XG5cdFx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdFx0ZW51bTogWydzaW5nbGVsaW5lVGV4dCcsICdtdWx0aWxpbmVUZXh0J10sXG5cdFx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCdzY29wZS5zaW5nbGVsaW5lVGV4dC5kZXNjcmlwdGlvbicsICdUaGUgdmFsdWUgd2lsbCBiZSBzaG93biBpbiBhbiBpbnB1dGJveC4nKSxcblx0XHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgnc2NvcGUubXVsdGlsaW5lVGV4dC5kZXNjcmlwdGlvbicsICdUaGUgdmFsdWUgd2lsbCBiZSBzaG93biBpbiBhIHRleHRhcmVhLicpXG5cdFx0XHRcdFx0XHRcdFx0XSxcblx0XHRcdFx0XHRcdFx0XHRkZWZhdWx0OiAnc2luZ2xlbGluZVRleHQnLFxuXHRcdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Njb3BlLmVkaXRQcmVzZW50YXRpb24nLCAnV2hlbiBzcGVjaWZpZWQsIGNvbnRyb2xzIHRoZSBwcmVzZW50YXRpb24gZm9ybWF0IG9mIHRoZSBzdHJpbmcgc2V0dGluZy4nKVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHRvcmRlcjoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdpbnRlZ2VyJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5vcmRlcicsICdXaGVuIHNwZWNpZmllZCwgZ2l2ZXMgdGhlIG9yZGVyIG9mIHRoaXMgc2V0dGluZyByZWxhdGl2ZSB0byBvdGhlciBzZXR0aW5ncyB3aXRoaW4gdGhlIHNhbWUgY2F0ZWdvcnkuIFNldHRpbmdzIHdpdGggYW4gb3JkZXIgcHJvcGVydHkgd2lsbCBiZSBwbGFjZWQgYmVmb3JlIHNldHRpbmdzIHdpdGhvdXQgdGhpcyBwcm9wZXJ0eSBzZXQuJylcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0aWdub3JlU3luYzoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS5pZ25vcmVTeW5jJywgJ1doZW4gZW5hYmxlZCwgU2V0dGluZ3MgU3luYyB3aWxsIG5vdCBzeW5jIHRoZSB1c2VyIHZhbHVlIG9mIHRoaXMgY29uZmlndXJhdGlvbiBieSBkZWZhdWx0LicpXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdHRhZ3M6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdzY29wZS50YWdzJywgJ0EgbGlzdCBvZiBjYXRlZ29yaWVzIHVuZGVyIHdoaWNoIHRvIHBsYWNlIHRoZSBzZXR0aW5nLiBUaGUgY2F0ZWdvcnkgY2FuIHRoZW4gYmUgc2VhcmNoZWQgdXAgaW4gdGhlIFNldHRpbmdzIGVkaXRvci4gRm9yIGV4YW1wbGUsIHNwZWNpZnlpbmcgdGhlIGBleHBlcmltZW50YWxgIHRhZyBhbGxvd3Mgb25lIHRvIGZpbmQgdGhlIHNldHRpbmcgYnkgc2VhcmNoaW5nIGBAdGFnOmV4cGVyaW1lbnRhbGAuJyksXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH1cblx0XHR9XG5cdH1cbn07XG5cbi8vIGJ1aWxkIHVwIGEgZGVsdGEgYWNyb3NzIHR3byBleHQgcG9pbnRzIGFuZCBvbmx5IGFwcGx5IGl0IG9uY2VcbmxldCBfY29uZmlnRGVsdGE6IElDb25maWd1cmF0aW9uRGVsdGEgfCB1bmRlZmluZWQ7XG5cblxuLy8gQkVHSU4gVlNDb2RlIGV4dGVuc2lvbiBwb2ludCBgY29uZmlndXJhdGlvbkRlZmF1bHRzYFxuY29uc3QgZGVmYXVsdENvbmZpZ3VyYXRpb25FeHRQb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElDb25maWd1cmF0aW9uTm9kZT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2NvbmZpZ3VyYXRpb25EZWZhdWx0cycsXG5cdGpzb25TY2hlbWE6IHtcblx0XHQkcmVmOiBjb25maWd1cmF0aW9uRGVmYXVsdHNTY2hlbWFJZCxcblx0fSxcblx0Y2FuSGFuZGxlUmVzb2x2ZXI6IHRydWVcbn0pO1xuZGVmYXVsdENvbmZpZ3VyYXRpb25FeHRQb2ludC5zZXRIYW5kbGVyKChleHRlbnNpb25zLCB7IGFkZGVkLCByZW1vdmVkIH0pID0+IHtcblxuXHRpZiAoX2NvbmZpZ0RlbHRhKSB7XG5cdFx0Ly8gSElHSExZIHVubGlrZWx5LCBidXQganVzdCBpbiBjYXNlXG5cdFx0Y29uZmlndXJhdGlvblJlZ2lzdHJ5LmRlbHRhQ29uZmlndXJhdGlvbihfY29uZmlnRGVsdGEpO1xuXHR9XG5cblx0Y29uc3QgY29uZmlnTm93ID0gX2NvbmZpZ0RlbHRhID0ge307XG5cdC8vIHNjaGVkdWxlIGEgSElHSExZIHVubGlrZWx5IHRhc2sgaW4gY2FzZSBvbmx5IHRoZSBkZWZhdWx0IGNvbmZpZ3VyYXRpb25zIEVYVCBwb2ludCBjaGFuZ2VzXG5cdHF1ZXVlTWljcm90YXNrKCgpID0+IHtcblx0XHRpZiAoX2NvbmZpZ0RlbHRhID09PSBjb25maWdOb3cpIHtcblx0XHRcdGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5kZWx0YUNvbmZpZ3VyYXRpb24oX2NvbmZpZ0RlbHRhKTtcblx0XHRcdF9jb25maWdEZWx0YSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cdH0pO1xuXG5cdGlmIChyZW1vdmVkLmxlbmd0aCkge1xuXHRcdGNvbnN0IHJlbW92ZWREZWZhdWx0Q29uZmlndXJhdGlvbnMgPSByZW1vdmVkLm1hcDxJQ29uZmlndXJhdGlvbkRlZmF1bHRzPihleHRlbnNpb24gPT4gKHsgb3ZlcnJpZGVzOiBvYmplY3RzLmRlZXBDbG9uZShleHRlbnNpb24udmFsdWUpLCBzb3VyY2U6IHsgaWQ6IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlLCBkaXNwbGF5TmFtZTogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmRpc3BsYXlOYW1lIH0gfSkpO1xuXHRcdF9jb25maWdEZWx0YS5yZW1vdmVkRGVmYXVsdHMgPSByZW1vdmVkRGVmYXVsdENvbmZpZ3VyYXRpb25zO1xuXHR9XG5cdGlmIChhZGRlZC5sZW5ndGgpIHtcblx0XHRjb25zdCByZWdpc3RlcmVkUHJvcGVydGllcyA9IGNvbmZpZ3VyYXRpb25SZWdpc3RyeS5nZXRDb25maWd1cmF0aW9uUHJvcGVydGllcygpO1xuXHRcdGNvbnN0IGFsbG93ZWRTY29wZXMgPSBbQ29uZmlndXJhdGlvblNjb3BlLk1BQ0hJTkVfT1ZFUlJJREFCTEUsIENvbmZpZ3VyYXRpb25TY29wZS5XSU5ET1csIENvbmZpZ3VyYXRpb25TY29wZS5SRVNPVVJDRSwgQ29uZmlndXJhdGlvblNjb3BlLkxBTkdVQUdFX09WRVJSSURBQkxFXTtcblx0XHRjb25zdCBhZGRlZERlZmF1bHRDb25maWd1cmF0aW9ucyA9IGFkZGVkLm1hcDxJQ29uZmlndXJhdGlvbkRlZmF1bHRzPihleHRlbnNpb24gPT4ge1xuXHRcdFx0Y29uc3Qgb3ZlcnJpZGVzOiBJU3RyaW5nRGljdGlvbmFyeTxhbnk+ID0gb2JqZWN0cy5kZWVwQ2xvbmUoZXh0ZW5zaW9uLnZhbHVlKTtcblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIE9iamVjdC5rZXlzKG92ZXJyaWRlcykpIHtcblx0XHRcdFx0Y29uc3QgcmVnaXN0ZXJlZFByb3BlcnR5U2NoZW1lID0gcmVnaXN0ZXJlZFByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0aWYgKHJlZ2lzdGVyZWRQcm9wZXJ0eVNjaGVtZT8uZGlzYWxsb3dDb25maWd1cmF0aW9uRGVmYXVsdCkge1xuXHRcdFx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3Iud2FybihubHMubG9jYWxpemUoJ2NvbmZpZy5wcm9wZXJ0eS5wcmV2ZW50RGVmYXVsdENvbmZpZ3VyYXRpb24ud2FybmluZycsIFwiQ2Fubm90IHJlZ2lzdGVyIGNvbmZpZ3VyYXRpb24gZGVmYXVsdHMgZm9yICd7MH0nLiBUaGlzIHNldHRpbmcgZG9lcyBub3QgYWxsb3cgY29udHJpYnV0aW5nIGNvbmZpZ3VyYXRpb24gZGVmYXVsdHMuXCIsIGtleSkpO1xuXHRcdFx0XHRcdGRlbGV0ZSBvdmVycmlkZXNba2V5XTtcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0fVxuXHRcdFx0XHRpZiAoIU9WRVJSSURFX1BST1BFUlRZX1JFR0VYLnRlc3Qoa2V5KSkge1xuXHRcdFx0XHRcdGlmIChyZWdpc3RlcmVkUHJvcGVydHlTY2hlbWU/LnNjb3BlICYmICFhbGxvd2VkU2NvcGVzLmluY2x1ZGVzKHJlZ2lzdGVyZWRQcm9wZXJ0eVNjaGVtZS5zY29wZSkpIHtcblx0XHRcdFx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3Iud2FybihubHMubG9jYWxpemUoJ2NvbmZpZy5wcm9wZXJ0eS5kZWZhdWx0Q29uZmlndXJhdGlvbi53YXJuaW5nJywgXCJDYW5ub3QgcmVnaXN0ZXIgY29uZmlndXJhdGlvbiBkZWZhdWx0cyBmb3IgJ3swfScuIE9ubHkgZGVmYXVsdHMgZm9yIG1hY2hpbmUtb3ZlcnJpZGFibGUsIHdpbmRvdywgcmVzb3VyY2UgYW5kIGxhbmd1YWdlIG92ZXJyaWRhYmxlIHNjb3BlZCBzZXR0aW5ncyBhcmUgc3VwcG9ydGVkLlwiLCBrZXkpKTtcblx0XHRcdFx0XHRcdGRlbGV0ZSBvdmVycmlkZXNba2V5XTtcblx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIHsgb3ZlcnJpZGVzLCBzb3VyY2U6IHsgaWQ6IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5pZGVudGlmaWVyLnZhbHVlLCBkaXNwbGF5TmFtZTogZXh0ZW5zaW9uLmRlc2NyaXB0aW9uLmRpc3BsYXlOYW1lIH0gfTtcblx0XHR9KTtcblx0XHRfY29uZmlnRGVsdGEuYWRkZWREZWZhdWx0cyA9IGFkZGVkRGVmYXVsdENvbmZpZ3VyYXRpb25zO1xuXHR9XG59KTtcbi8vIEVORCBWU0NvZGUgZXh0ZW5zaW9uIHBvaW50IGBjb25maWd1cmF0aW9uRGVmYXVsdHNgXG5cblxuLy8gQkVHSU4gVlNDb2RlIGV4dGVuc2lvbiBwb2ludCBgY29uZmlndXJhdGlvbmBcbmNvbnN0IGNvbmZpZ3VyYXRpb25FeHRQb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElDb25maWd1cmF0aW9uTm9kZT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ2NvbmZpZ3VyYXRpb24nLFxuXHRkZXBzOiBbZGVmYXVsdENvbmZpZ3VyYXRpb25FeHRQb2ludF0sXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNvbnRyaWJ1dGVzLmNvbmZpZ3VyYXRpb24nLCAnQ29udHJpYnV0ZXMgY29uZmlndXJhdGlvbiBzZXR0aW5ncy4nKSxcblx0XHRvbmVPZjogW1xuXHRcdFx0Y29uZmlndXJhdGlvbkVudHJ5U2NoZW1hLFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRpdGVtczogY29uZmlndXJhdGlvbkVudHJ5U2NoZW1hXG5cdFx0XHR9XG5cdFx0XVxuXHR9LFxuXHRjYW5IYW5kbGVSZXNvbHZlcjogdHJ1ZVxufSk7XG5cbmNvbnN0IGV4dGVuc2lvbkNvbmZpZ3VyYXRpb25zOiBFeHRlbnNpb25JZGVudGlmaWVyTWFwPElDb25maWd1cmF0aW9uTm9kZVtdPiA9IG5ldyBFeHRlbnNpb25JZGVudGlmaWVyTWFwPElDb25maWd1cmF0aW9uTm9kZVtdPigpO1xuXG5jb25maWd1cmF0aW9uRXh0UG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucywgeyBhZGRlZCwgcmVtb3ZlZCB9KSA9PiB7XG5cblx0Ly8gSElHSExZIHVubGlrZWx5IChvbmx5IGNvbmZpZ3VyYXRpb24gYnV0IG5vdCBkZWZhdWx0Q29uZmlndXJhdGlvbiBFWFQgcG9pbnQgY2hhbmdlcylcblx0X2NvbmZpZ0RlbHRhID8/PSB7fTtcblxuXHRpZiAocmVtb3ZlZC5sZW5ndGgpIHtcblx0XHRjb25zdCByZW1vdmVkQ29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uTm9kZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgcmVtb3ZlZCkge1xuXHRcdFx0cmVtb3ZlZENvbmZpZ3VyYXRpb25zLnB1c2goLi4uKGV4dGVuc2lvbkNvbmZpZ3VyYXRpb25zLmdldChleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllcikgfHwgW10pKTtcblx0XHRcdGV4dGVuc2lvbkNvbmZpZ3VyYXRpb25zLmRlbGV0ZShleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllcik7XG5cdFx0fVxuXHRcdF9jb25maWdEZWx0YS5yZW1vdmVkQ29uZmlndXJhdGlvbnMgPSByZW1vdmVkQ29uZmlndXJhdGlvbnM7XG5cdH1cblxuXHRjb25zdCBzZWVuUHJvcGVydGllcyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGZ1bmN0aW9uIGhhbmRsZUNvbmZpZ3VyYXRpb24obm9kZTogSUNvbmZpZ3VyYXRpb25Ob2RlLCBleHRlbnNpb246IElFeHRlbnNpb25Qb2ludFVzZXI8YW55Pik6IElDb25maWd1cmF0aW9uTm9kZSB7XG5cdFx0Y29uc3QgY29uZmlndXJhdGlvbiA9IG9iamVjdHMuZGVlcENsb25lKG5vZGUpO1xuXG5cdFx0aWYgKGNvbmZpZ3VyYXRpb24udGl0bGUgJiYgKHR5cGVvZiBjb25maWd1cmF0aW9uLnRpdGxlICE9PSAnc3RyaW5nJykpIHtcblx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnRpdGxlJywgXCInY29uZmlndXJhdGlvbi50aXRsZScgbXVzdCBiZSBhIHN0cmluZ1wiKSk7XG5cdFx0fVxuXG5cdFx0dmFsaWRhdGVQcm9wZXJ0aWVzKGNvbmZpZ3VyYXRpb24sIGV4dGVuc2lvbik7XG5cblx0XHRjb25maWd1cmF0aW9uLmlkID0gbm9kZS5pZCB8fCBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZTtcblx0XHRjb25maWd1cmF0aW9uLmV4dGVuc2lvbkluZm8gPSB7IGlkOiBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZSwgZGlzcGxheU5hbWU6IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5kaXNwbGF5TmFtZSB9O1xuXHRcdGNvbmZpZ3VyYXRpb24ucmVzdHJpY3RlZFByb3BlcnRpZXMgPSBleHRlbnNpb24uZGVzY3JpcHRpb24uY2FwYWJpbGl0aWVzPy51bnRydXN0ZWRXb3Jrc3BhY2VzPy5zdXBwb3J0ZWQgPT09ICdsaW1pdGVkJyA/IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5jYXBhYmlsaXRpZXM/LnVudHJ1c3RlZFdvcmtzcGFjZXMucmVzdHJpY3RlZENvbmZpZ3VyYXRpb25zIDogdW5kZWZpbmVkO1xuXHRcdGNvbmZpZ3VyYXRpb24udGl0bGUgPSBjb25maWd1cmF0aW9uLnRpdGxlIHx8IGV4dGVuc2lvbi5kZXNjcmlwdGlvbi5kaXNwbGF5TmFtZSB8fCBleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllci52YWx1ZTtcblx0XHRyZXR1cm4gY29uZmlndXJhdGlvbjtcblx0fVxuXG5cdGZ1bmN0aW9uIHZhbGlkYXRlUHJvcGVydGllcyhjb25maWd1cmF0aW9uOiBJQ29uZmlndXJhdGlvbk5vZGUsIGV4dGVuc2lvbjogSUV4dGVuc2lvblBvaW50VXNlcjxhbnk+KTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvcGVydGllcyA9IGNvbmZpZ3VyYXRpb24ucHJvcGVydGllcztcblx0XHRjb25zdCBleHRlbnNpb25Db25maWd1cmF0aW9uUG9saWN5ID0gcHJvZHVjdC5leHRlbnNpb25Db25maWd1cmF0aW9uUG9saWN5O1xuXHRcdGlmIChwcm9wZXJ0aWVzKSB7XG5cdFx0XHRpZiAodHlwZW9mIHByb3BlcnRpZXMgIT09ICdvYmplY3QnKSB7XG5cdFx0XHRcdGV4dGVuc2lvbi5jb2xsZWN0b3IuZXJyb3IobmxzLmxvY2FsaXplKCdpbnZhbGlkLnByb3BlcnRpZXMnLCBcIidjb25maWd1cmF0aW9uLnByb3BlcnRpZXMnIG11c3QgYmUgYW4gb2JqZWN0XCIpKTtcblx0XHRcdFx0Y29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzID0ge307XG5cdFx0XHR9XG5cdFx0XHRmb3IgKGNvbnN0IGtleSBpbiBwcm9wZXJ0aWVzKSB7XG5cdFx0XHRcdGNvbnN0IHByb3BlcnR5Q29uZmlndXJhdGlvbiA9IHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0Y29uc3QgbWVzc2FnZSA9IHZhbGlkYXRlUHJvcGVydHkoa2V5LCBwcm9wZXJ0eUNvbmZpZ3VyYXRpb24pO1xuXHRcdFx0XHRpZiAobWVzc2FnZSkge1xuXHRcdFx0XHRcdGRlbGV0ZSBwcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci53YXJuKG1lc3NhZ2UpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChzZWVuUHJvcGVydGllcy5oYXMoa2V5KSkge1xuXHRcdFx0XHRcdGRlbGV0ZSBwcm9wZXJ0aWVzW2tleV07XG5cdFx0XHRcdFx0ZXh0ZW5zaW9uLmNvbGxlY3Rvci53YXJuKG5scy5sb2NhbGl6ZSgnY29uZmlnLnByb3BlcnR5LmR1cGxpY2F0ZScsIFwiQ2Fubm90IHJlZ2lzdGVyICd7MH0nLiBUaGlzIHByb3BlcnR5IGlzIGFscmVhZHkgcmVnaXN0ZXJlZC5cIiwga2V5KSk7XG5cdFx0XHRcdFx0Y29udGludWU7XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKCFpc09iamVjdChwcm9wZXJ0eUNvbmZpZ3VyYXRpb24pKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHByb3BlcnRpZXNba2V5XTtcblx0XHRcdFx0XHRleHRlbnNpb24uY29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5wcm9wZXJ0eScsIFwiY29uZmlndXJhdGlvbi5wcm9wZXJ0aWVzIHByb3BlcnR5ICd7MH0nIG11c3QgYmUgYW4gb2JqZWN0XCIsIGtleSkpO1xuXHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGlmIChleHRlbnNpb25Db25maWd1cmF0aW9uUG9saWN5Py5ba2V5XSkge1xuXHRcdFx0XHRcdHByb3BlcnR5Q29uZmlndXJhdGlvbi5wb2xpY3kgPSBleHRlbnNpb25Db25maWd1cmF0aW9uUG9saWN5Py5ba2V5XTtcblx0XHRcdFx0fVxuXHRcdFx0XHRzZWVuUHJvcGVydGllcy5hZGQoa2V5KTtcblx0XHRcdFx0cHJvcGVydHlDb25maWd1cmF0aW9uLnNjb3BlID0gcHJvcGVydHlDb25maWd1cmF0aW9uLnNjb3BlID8gcGFyc2VTY29wZShwcm9wZXJ0eUNvbmZpZ3VyYXRpb24uc2NvcGUudG9TdHJpbmcoKSkgOiBDb25maWd1cmF0aW9uU2NvcGUuV0lORE9XO1xuXHRcdFx0fVxuXHRcdH1cblx0XHRjb25zdCBzdWJOb2RlcyA9IGNvbmZpZ3VyYXRpb24uYWxsT2Y7XG5cdFx0aWYgKHN1Yk5vZGVzKSB7XG5cdFx0XHRleHRlbnNpb24uY29sbGVjdG9yLmVycm9yKG5scy5sb2NhbGl6ZSgnaW52YWxpZC5hbGxPZicsIFwiJ2NvbmZpZ3VyYXRpb24uYWxsT2YnIGlzIGRlcHJlY2F0ZWQgYW5kIHNob3VsZCBubyBsb25nZXIgYmUgdXNlZC4gSW5zdGVhZCwgcGFzcyBtdWx0aXBsZSBjb25maWd1cmF0aW9uIHNlY3Rpb25zIGFzIGFuIGFycmF5IHRvIHRoZSAnY29uZmlndXJhdGlvbicgY29udHJpYnV0aW9uIHBvaW50LlwiKSk7XG5cdFx0XHRmb3IgKGNvbnN0IG5vZGUgb2Ygc3ViTm9kZXMpIHtcblx0XHRcdFx0dmFsaWRhdGVQcm9wZXJ0aWVzKG5vZGUsIGV4dGVuc2lvbik7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0aWYgKGFkZGVkLmxlbmd0aCkge1xuXHRcdGNvbnN0IGFkZGVkQ29uZmlndXJhdGlvbnM6IElDb25maWd1cmF0aW9uTm9kZVtdID0gW107XG5cdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgYWRkZWQpIHtcblx0XHRcdGNvbnN0IGNvbmZpZ3VyYXRpb25zOiBJQ29uZmlndXJhdGlvbk5vZGVbXSA9IFtdO1xuXHRcdFx0Y29uc3QgdmFsdWUgPSA8SUNvbmZpZ3VyYXRpb25Ob2RlIHwgSUNvbmZpZ3VyYXRpb25Ob2RlW10+ZXh0ZW5zaW9uLnZhbHVlO1xuXHRcdFx0aWYgKEFycmF5LmlzQXJyYXkodmFsdWUpKSB7XG5cdFx0XHRcdHZhbHVlLmZvckVhY2godiA9PiBjb25maWd1cmF0aW9ucy5wdXNoKGhhbmRsZUNvbmZpZ3VyYXRpb24odiwgZXh0ZW5zaW9uKSkpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Y29uZmlndXJhdGlvbnMucHVzaChoYW5kbGVDb25maWd1cmF0aW9uKHZhbHVlLCBleHRlbnNpb24pKTtcblx0XHRcdH1cblx0XHRcdGV4dGVuc2lvbkNvbmZpZ3VyYXRpb25zLnNldChleHRlbnNpb24uZGVzY3JpcHRpb24uaWRlbnRpZmllciwgY29uZmlndXJhdGlvbnMpO1xuXHRcdFx0YWRkZWRDb25maWd1cmF0aW9ucy5wdXNoKC4uLmNvbmZpZ3VyYXRpb25zKTtcblx0XHR9XG5cblx0XHRfY29uZmlnRGVsdGEuYWRkZWRDb25maWd1cmF0aW9ucyA9IGFkZGVkQ29uZmlndXJhdGlvbnM7XG5cdH1cblxuXHRjb25maWd1cmF0aW9uUmVnaXN0cnkuZGVsdGFDb25maWd1cmF0aW9uKF9jb25maWdEZWx0YSk7XG5cdF9jb25maWdEZWx0YSA9IHVuZGVmaW5lZDtcbn0pO1xuLy8gRU5EIFZTQ29kZSBleHRlbnNpb24gcG9pbnQgYGNvbmZpZ3VyYXRpb25gXG5cbmpzb25SZWdpc3RyeS5yZWdpc3RlclNjaGVtYSgndnNjb2RlOi8vc2NoZW1hcy93b3Jrc3BhY2VDb25maWcnLCB7XG5cdGFsbG93Q29tbWVudHM6IHRydWUsXG5cdGFsbG93VHJhaWxpbmdDb21tYXM6IHRydWUsXG5cdGRlZmF1bHQ6IHtcblx0XHRmb2xkZXJzOiBbXG5cdFx0XHR7XG5cdFx0XHRcdHBhdGg6ICcnXG5cdFx0XHR9XG5cdFx0XSxcblx0XHRzZXR0aW5nczoge1xuXHRcdH1cblx0fSxcblx0cmVxdWlyZWQ6IFsnZm9sZGVycyddLFxuXHRwcm9wZXJ0aWVzOiB7XG5cdFx0J2ZvbGRlcnMnOiB7XG5cdFx0XHRtaW5JdGVtczogMCxcblx0XHRcdHVuaXF1ZUl0ZW1zOiB0cnVlLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlQ29uZmlnLmZvbGRlcnMuZGVzY3JpcHRpb24nLCBcIkxpc3Qgb2YgZm9sZGVycyB0byBiZSBsb2FkZWQgaW4gdGhlIHdvcmtzcGFjZS5cIiksXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbeyBib2R5OiB7IHBhdGg6ICckMScgfSB9XSxcblx0XHRcdFx0b25lT2Y6IFt7XG5cdFx0XHRcdFx0cHJvcGVydGllczoge1xuXHRcdFx0XHRcdFx0cGF0aDoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlQ29uZmlnLnBhdGguZGVzY3JpcHRpb24nLCBcIkEgZmlsZSBwYXRoLiBlLmcuIGAvcm9vdC9mb2xkZXJBYCBvciBgLi9mb2xkZXJBYCBmb3IgYSByZWxhdGl2ZSBwYXRoIHRoYXQgd2lsbCBiZSByZXNvbHZlZCBhZ2FpbnN0IHRoZSBsb2NhdGlvbiBvZiB0aGUgd29ya3NwYWNlIGZpbGUuXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bmFtZToge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlQ29uZmlnLm5hbWUuZGVzY3JpcHRpb24nLCBcIkFuIG9wdGlvbmFsIG5hbWUgZm9yIHRoZSBmb2xkZXIuIFwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsncGF0aCddXG5cdFx0XHRcdH0sIHtcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHR1cmk6IHtcblx0XHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZUNvbmZpZy51cmkuZGVzY3JpcHRpb24nLCBcIlVSSSBvZiB0aGUgZm9sZGVyXCIpXG5cdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0bmFtZToge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnd29ya3NwYWNlQ29uZmlnLm5hbWUuZGVzY3JpcHRpb24nLCBcIkFuIG9wdGlvbmFsIG5hbWUgZm9yIHRoZSBmb2xkZXIuIFwiKVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsndXJpJ11cblx0XHRcdFx0fV1cblx0XHRcdH1cblx0XHR9LFxuXHRcdCdzZXR0aW5ncyc6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVmYXVsdDoge30sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd3b3Jrc3BhY2VDb25maWcuc2V0dGluZ3MuZGVzY3JpcHRpb24nLCBcIldvcmtzcGFjZSBzZXR0aW5nc1wiKSxcblx0XHRcdCRyZWY6IHdvcmtzcGFjZVNldHRpbmdzU2NoZW1hSWRcblx0XHR9LFxuXHRcdCdsYXVuY2gnOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHQ6IHsgY29uZmlndXJhdGlvbnM6IFtdLCBjb21wb3VuZHM6IFtdIH0sXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd3b3Jrc3BhY2VDb25maWcubGF1bmNoLmRlc2NyaXB0aW9uJywgXCJXb3Jrc3BhY2UgbGF1bmNoIGNvbmZpZ3VyYXRpb25zXCIpLFxuXHRcdFx0JHJlZjogbGF1bmNoU2NoZW1hSWRcblx0XHR9LFxuXHRcdCd0YXNrcyc6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVmYXVsdDogeyB2ZXJzaW9uOiAnMi4wLjAnLCB0YXNrczogW10gfSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZUNvbmZpZy50YXNrcy5kZXNjcmlwdGlvbicsIFwiV29ya3NwYWNlIHRhc2sgY29uZmlndXJhdGlvbnNcIiksXG5cdFx0XHQkcmVmOiB0YXNrc1NjaGVtYUlkXG5cdFx0fSxcblx0XHQnbWNwJzoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdGlucHV0czogW10sXG5cdFx0XHRcdHNlcnZlcnM6IHtcblx0XHRcdFx0XHQnbWNwLXNlcnZlci10aW1lJzoge1xuXHRcdFx0XHRcdFx0Y29tbWFuZDogJ3B5dGhvbicsXG5cdFx0XHRcdFx0XHRhcmdzOiBbJy1tJywgJ21jcF9zZXJ2ZXJfdGltZScsICctLWxvY2FsLXRpbWV6b25lPUFtZXJpY2EvTG9zX0FuZ2VsZXMnXVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZUNvbmZpZy5tY3AuZGVzY3JpcHRpb24nLCBcIk1vZGVsIENvbnRleHQgUHJvdG9jb2wgc2VydmVyIGNvbmZpZ3VyYXRpb25zXCIpLFxuXHRcdFx0JHJlZjogbWNwU2NoZW1hSWRcblx0XHR9LFxuXHRcdCdleHRlbnNpb25zJzoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRkZWZhdWx0OiB7fSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZUNvbmZpZy5leHRlbnNpb25zLmRlc2NyaXB0aW9uJywgXCJXb3Jrc3BhY2UgZXh0ZW5zaW9uc1wiKSxcblx0XHRcdCRyZWY6ICd2c2NvZGU6Ly9zY2hlbWFzL2V4dGVuc2lvbnMnXG5cdFx0fSxcblx0XHQncmVtb3RlQXV0aG9yaXR5Jzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkb05vdFN1Z2dlc3Q6IHRydWUsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd3b3Jrc3BhY2VDb25maWcucmVtb3RlQXV0aG9yaXR5JywgXCJUaGUgcmVtb3RlIHNlcnZlciB3aGVyZSB0aGUgd29ya3NwYWNlIGlzIGxvY2F0ZWQuXCIpLFxuXHRcdH0sXG5cdFx0J3RyYW5zaWVudCc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRvTm90U3VnZ2VzdDogdHJ1ZSxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3dvcmtzcGFjZUNvbmZpZy50cmFuc2llbnQnLCBcIkEgdHJhbnNpZW50IHdvcmtzcGFjZSB3aWxsIGRpc2FwcGVhciB3aGVuIHJlc3RhcnRpbmcgb3IgcmVsb2FkaW5nLlwiKSxcblx0XHR9XG5cdH0sXG5cdGVycm9yTWVzc2FnZTogbmxzLmxvY2FsaXplKCd1bmtub3duV29ya3NwYWNlUHJvcGVydHknLCBcIlVua25vd24gd29ya3NwYWNlIGNvbmZpZ3VyYXRpb24gcHJvcGVydHlcIilcbn0pO1xuXG5cbmNsYXNzIFNldHRpbmdzVGFibGVSZW5kZXJlciBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJRXh0ZW5zaW9uRmVhdHVyZVRhYmxlUmVuZGVyZXIge1xuXG5cdHJlYWRvbmx5IHR5cGUgPSAndGFibGUnO1xuXG5cdHNob3VsZFJlbmRlcihtYW5pZmVzdDogSUV4dGVuc2lvbk1hbmlmZXN0KTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuICEhbWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbmZpZ3VyYXRpb247XG5cdH1cblxuXHRyZW5kZXIobWFuaWZlc3Q6IElFeHRlbnNpb25NYW5pZmVzdCk6IElSZW5kZXJlZERhdGE8SVRhYmxlRGF0YT4ge1xuXHRcdGNvbnN0IGNvbmZpZ3VyYXRpb246IElDb25maWd1cmF0aW9uTm9kZVtdID0gbWFuaWZlc3QuY29udHJpYnV0ZXM/LmNvbmZpZ3VyYXRpb25cblx0XHRcdD8gQXJyYXkuaXNBcnJheShtYW5pZmVzdC5jb250cmlidXRlcy5jb25maWd1cmF0aW9uKSA/IG1hbmlmZXN0LmNvbnRyaWJ1dGVzLmNvbmZpZ3VyYXRpb24gOiBbbWFuaWZlc3QuY29udHJpYnV0ZXMuY29uZmlndXJhdGlvbl1cblx0XHRcdDogW107XG5cblx0XHRjb25zdCBwcm9wZXJ0aWVzID0gZ2V0QWxsQ29uZmlndXJhdGlvblByb3BlcnRpZXMoY29uZmlndXJhdGlvbik7XG5cblx0XHRjb25zdCBjb250cmliID0gcHJvcGVydGllcyA/IE9iamVjdC5rZXlzKHByb3BlcnRpZXMpIDogW107XG5cdFx0Y29uc3QgaGVhZGVycyA9IFtubHMubG9jYWxpemUoJ3NldHRpbmcgbmFtZScsIFwiSURcIiksIG5scy5sb2NhbGl6ZSgnZGVzY3JpcHRpb24nLCBcIkRlc2NyaXB0aW9uXCIpLCBubHMubG9jYWxpemUoJ2RlZmF1bHQnLCBcIkRlZmF1bHRcIildO1xuXHRcdGNvbnN0IHJvd3M6IElSb3dEYXRhW11bXSA9IGNvbnRyaWIuc29ydCgoYSwgYikgPT4gYS5sb2NhbGVDb21wYXJlKGIpKVxuXHRcdFx0Lm1hcChrZXkgPT4ge1xuXHRcdFx0XHRyZXR1cm4gW1xuXHRcdFx0XHRcdG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZE1hcmtkb3duKGBcXGAke2tleX1cXGBgKSxcblx0XHRcdFx0XHRwcm9wZXJ0aWVzW2tleV0ubWFya2Rvd25EZXNjcmlwdGlvbiA/IG5ldyBNYXJrZG93blN0cmluZyhwcm9wZXJ0aWVzW2tleV0ubWFya2Rvd25EZXNjcmlwdGlvbiwgZmFsc2UpIDogcHJvcGVydGllc1trZXldLmRlc2NyaXB0aW9uID8/ICcnLFxuXHRcdFx0XHRcdG5ldyBNYXJrZG93blN0cmluZygpLmFwcGVuZENvZGVibG9jaygnanNvbicsIEpTT04uc3RyaW5naWZ5KGlzVW5kZWZpbmVkKHByb3BlcnRpZXNba2V5XS5kZWZhdWx0KSA/IGdldERlZmF1bHRWYWx1ZShwcm9wZXJ0aWVzW2tleV0udHlwZSkgOiBwcm9wZXJ0aWVzW2tleV0uZGVmYXVsdCwgbnVsbCwgMikpLFxuXHRcdFx0XHRdO1xuXHRcdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0ZGF0YToge1xuXHRcdFx0XHRoZWFkZXJzLFxuXHRcdFx0XHRyb3dzXG5cdFx0XHR9LFxuXHRcdFx0ZGlzcG9zZTogKCkgPT4geyB9XG5cdFx0fTtcblx0fVxufVxuXG5SZWdpc3RyeS5hczxJRXh0ZW5zaW9uRmVhdHVyZXNSZWdpc3RyeT4oRXh0ZW5zaW9uRmVhdHVyZXNFeHRlbnNpb25zLkV4dGVuc2lvbkZlYXR1cmVzUmVnaXN0cnkpLnJlZ2lzdGVyRXh0ZW5zaW9uRmVhdHVyZSh7XG5cdGlkOiAnY29uZmlndXJhdGlvbicsXG5cdGxhYmVsOiBubHMubG9jYWxpemUoJ3NldHRpbmdzJywgXCJTZXR0aW5nc1wiKSxcblx0YWNjZXNzOiB7XG5cdFx0Y2FuVG9nZ2xlOiBmYWxzZVxuXHR9LFxuXHRyZW5kZXJlcjogbmV3IFN5bmNEZXNjcmlwdG9yKFNldHRpbmdzVGFibGVSZW5kZXJlciksXG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixZQUFZLGFBQWE7QUFDekIsU0FBUyxnQkFBZ0I7QUFFekIsU0FBUywwQkFBK0M7QUFDeEQsU0FBcUQsWUFBWSxrQkFBa0Isb0JBQW9CLHlCQUFpRCwrQkFBb0QsaUJBQWlCLCtCQUErQixrQkFBa0I7QUFDOVEsU0FBb0MsY0FBYyxzQkFBc0I7QUFDeEUsU0FBUywyQkFBMkIsZ0JBQWdCLGVBQWUsbUJBQW1CO0FBQ3RGLFNBQVMsVUFBVSxtQkFBbUI7QUFDdEMsU0FBUyw4QkFBa0Q7QUFFM0QsU0FBUyxjQUFjLG1DQUFvSTtBQUMzSixTQUFTLGtCQUFrQjtBQUMzQixTQUFTLHNCQUFzQjtBQUMvQixTQUFTLHNC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
