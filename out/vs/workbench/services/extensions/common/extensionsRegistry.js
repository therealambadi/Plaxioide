import * as nls from "../../../../nls.js";
import { onUnexpectedError } from "../../../../base/common/errors.js";
import Severity from "../../../../base/common/severity.js";
import { EXTENSION_IDENTIFIER_PATTERN } from "../../../../platform/extensionManagement/common/extensionManagement.js";
import { Extensions } from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { EXTENSION_CATEGORIES, ExtensionIdentifierSet } from "../../../../platform/extensions/common/extensions.js";
import { productSchemaId } from "../../../../platform/product/common/productService.js";
import { ImplicitActivationEvents } from "../../../../platform/extensionManagement/common/implicitActivationEvents.js";
import { allApiProposals } from "../../../../platform/extensions/common/extensionsApiProposals.js";
const schemaRegistry = Registry.as(Extensions.JSONContribution);
class ExtensionMessageCollector {
  constructor(messageHandler, extension, extensionPointId) {
    this._messageHandler = messageHandler;
    this._extension = extension;
    this._extensionPointId = extensionPointId;
  }
  _msg(type, message) {
    this._messageHandler({
      type,
      message,
      extensionId: this._extension.identifier,
      extensionPointId: this._extensionPointId
    });
  }
  error(message) {
    this._msg(Severity.Error, message);
  }
  warn(message) {
    this._msg(Severity.Warning, message);
  }
  info(message) {
    this._msg(Severity.Info, message);
  }
}
class ExtensionPointUserDelta {
  constructor(added, removed) {
    this.added = added;
    this.removed = removed;
  }
  static _toSet(arr) {
    const result = new ExtensionIdentifierSet();
    for (let i = 0, len = arr.length; i < len; i++) {
      result.add(arr[i].description.identifier);
    }
    return result;
  }
  static compute(previous, current) {
    if (!previous || !previous.length) {
      return new ExtensionPointUserDelta(current, []);
    }
    if (!current || !current.length) {
      return new ExtensionPointUserDelta([], previous);
    }
    const previousSet = this._toSet(previous);
    const currentSet = this._toSet(current);
    const added = current.filter((user) => !previousSet.has(user.description.identifier));
    const removed = previous.filter((user) => !currentSet.has(user.description.identifier));
    return new ExtensionPointUserDelta(added, removed);
  }
}
class ExtensionPoint {
  constructor(name, defaultExtensionKind, canHandleResolver) {
    this.name = name;
    this.defaultExtensionKind = defaultExtensionKind;
    this.canHandleResolver = canHandleResolver;
    this._handler = null;
    this._users = null;
    this._delta = null;
  }
  setHandler(handler) {
    if (this._handler !== null) {
      throw new Error("Handler already set!");
    }
    this._handler = handler;
    this._handle();
    return {
      dispose: () => {
        this._handler = null;
      }
    };
  }
  acceptUsers(users) {
    this._delta = ExtensionPointUserDelta.compute(this._users, users);
    this._users = users;
    this._handle();
  }
  _handle() {
    if (this._handler === null || this._users === null || this._delta === null) {
      return;
    }
    try {
      this._handler(this._users, this._delta);
    } catch (err) {
      onUnexpectedError(err);
    }
  }
}
const extensionKindSchema = {
  type: "string",
  enum: [
    "ui",
    "workspace"
  ],
  enumDescriptions: [
    nls.localize("ui", "UI extension kind. In a remote window, such extensions are enabled only when available on the local machine."),
    nls.localize("workspace", "Workspace extension kind. In a remote window, such extensions are enabled only when available on the remote.")
  ]
};
const schemaId = "vscode://schemas/vscode-extensions";
const schema = {
  properties: {
    engines: {
      type: "object",
      description: nls.localize("vscode.extension.engines", "Engine compatibility."),
      properties: {
        "vscode": {
          type: "string",
          description: nls.localize("vscode.extension.engines.vscode", "For VS Code extensions, specifies the VS Code version that the extension is compatible with. Cannot be *. For example: ^0.10.5 indicates compatibility with a minimum VS Code version of 0.10.5."),
          default: "^1.22.0"
        }
      }
    },
    publisher: {
      description: nls.localize("vscode.extension.publisher", "The publisher of the VS Code extension."),
      type: "string"
    },
    displayName: {
      description: nls.localize("vscode.extension.displayName", "The display name for the extension used in the VS Code gallery."),
      type: "string"
    },
    categories: {
      description: nls.localize("vscode.extension.categories", "The categories used by the VS Code gallery to categorize the extension."),
      type: "array",
      uniqueItems: true,
      items: {
        oneOf: [
          {
            type: "string",
            enum: EXTENSION_CATEGORIES
          },
          {
            type: "string",
            const: "Languages",
            deprecationMessage: nls.localize("vscode.extension.category.languages.deprecated", "Use 'Programming  Languages' instead")
          }
        ]
      }
    },
    galleryBanner: {
      type: "object",
      description: nls.localize("vscode.extension.galleryBanner", "Banner used in the VS Code marketplace."),
      properties: {
        color: {
          description: nls.localize("vscode.extension.galleryBanner.color", "The banner color on the VS Code marketplace page header."),
          type: "string"
        },
        theme: {
          description: nls.localize("vscode.extension.galleryBanner.theme", "The color theme for the font used in the banner."),
          type: "string",
          enum: ["dark", "light"]
        }
      }
    },
    contributes: {
      description: nls.localize("vscode.extension.contributes", "All contributions of the VS Code extension represented by this package."),
      type: "object",
      properties: {
        // extensions will fill in
      },
      default: {}
    },
    preview: {
      type: "boolean",
      description: nls.localize("vscode.extension.preview", "Sets the extension to be flagged as a Preview in the Marketplace.")
    },
    enableProposedApi: {
      type: "boolean",
      deprecationMessage: nls.localize("vscode.extension.enableProposedApi.deprecated", "Use `enabledApiProposals` instead.")
    },
    enabledApiProposals: {
      markdownDescription: nls.localize("vscode.extension.enabledApiProposals", "Enable API proposals to try them out. Only valid **during development**. Extensions **cannot be published** with this property. For more details visit: https://code.visualstudio.com/api/advanced-topics/using-proposed-api"),
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        enum: Object.keys(allApiProposals).map((proposalName) => proposalName),
        markdownEnumDescriptions: Object.values(allApiProposals).map((value) => value.proposal)
      }
    },
    api: {
      markdownDescription: nls.localize("vscode.extension.api", "Describe the API provided by this extension. For more details visit: https://code.visualstudio.com/api/advanced-topics/remote-extensions#handling-dependencies-with-remote-extensions"),
      type: "string",
      enum: ["none"],
      enumDescriptions: [
        nls.localize("vscode.extension.api.none", "Give up entirely the ability to export any APIs. This allows other extensions that depend on this extension to run in a separate extension host process or in a remote machine.")
      ]
    },
    activationEvents: {
      description: nls.localize("vscode.extension.activationEvents", "Activation events for the VS Code extension."),
      type: "array",
      items: {
        type: "string",
        defaultSnippets: [
          {
            label: "onWebviewPanel",
            description: nls.localize("vscode.extension.activationEvents.onWebviewPanel", "An activation event emmited when a webview is loaded of a certain viewType"),
            body: "onWebviewPanel:viewType"
          },
          {
            label: "onLanguage",
            description: nls.localize("vscode.extension.activationEvents.onLanguage", "An activation event emitted whenever a file that resolves to the specified language gets opened."),
            body: "onLanguage:${1:languageId}"
          },
          {
            label: "onCommand",
            description: nls.localize("vscode.extension.activationEvents.onCommand", "An activation event emitted whenever the specified command gets invoked."),
            body: "onCommand:${2:commandId}"
          },
          {
            label: "onDebug",
            description: nls.localize("vscode.extension.activationEvents.onDebug", "An activation event emitted whenever a user is about to start debugging or about to setup debug configurations."),
            body: "onDebug"
          },
          {
            label: "onDebugInitialConfigurations",
            description: nls.localize("vscode.extension.activationEvents.onDebugInitialConfigurations", 'An activation event emitted whenever a "launch.json" needs to be created (and all provideDebugConfigurations methods need to be called).'),
            body: "onDebugInitialConfigurations"
          },
          {
            label: "onDebugDynamicConfigurations",
            description: nls.localize("vscode.extension.activationEvents.onDebugDynamicConfigurations", 'An activation event emitted whenever a list of all debug configurations needs to be created (and all provideDebugConfigurations methods for the "dynamic" scope need to be called).'),
            body: "onDebugDynamicConfigurations"
          },
          {
            label: "onDebugResolve",
            description: nls.localize("vscode.extension.activationEvents.onDebugResolve", "An activation event emitted whenever a debug session with the specific type is about to be launched (and a corresponding resolveDebugConfiguration method needs to be called)."),
            body: "onDebugResolve:${6:type}"
          },
          {
            label: "onDebugAdapterProtocolTracker",
            description: nls.localize("vscode.extension.activationEvents.onDebugAdapterProtocolTracker", "An activation event emitted whenever a debug session with the specific type is about to be launched and a debug protocol tracker might be needed."),
            body: "onDebugAdapterProtocolTracker:${6:type}"
          },
          {
            label: "workspaceContains",
            description: nls.localize("vscode.extension.activationEvents.workspaceContains", "An activation event emitted whenever a folder is opened that contains at least a file matching the specified glob pattern."),
            body: "workspaceContains:${4:filePattern}"
          },
          {
            label: "onStartupFinished",
            description: nls.localize("vscode.extension.activationEvents.onStartupFinished", "An activation event emitted after the start-up finished (after all `*` activated extensions have finished activating)."),
            body: "onStartupFinished"
          },
          {
            label: "onTaskType",
            description: nls.localize("vscode.extension.activationEvents.onTaskType", "An activation event emitted whenever tasks of a certain type need to be listed or resolved."),
            body: "onTaskType:${1:taskType}"
          },
          {
            label: "onFileSystem",
            description: nls.localize("vscode.extension.activationEvents.onFileSystem", "An activation event emitted whenever a file or folder is accessed with the given scheme."),
            body: "onFileSystem:${1:scheme}"
          },
          {
            label: "onEditSession",
            description: nls.localize("vscode.extension.activationEvents.onEditSession", "An activation event emitted whenever an edit session is accessed with the given scheme."),
            body: "onEditSession:${1:scheme}"
          },
          {
            label: "onSearch",
            description: nls.localize("vscode.extension.activationEvents.onSearch", "An activation event emitted whenever a search is started in the folder with the given scheme."),
            body: "onSearch:${7:scheme}"
          },
          {
            label: "onView",
            body: "onView:${5:viewId}",
            description: nls.localize("vscode.extension.activationEvents.onView", "An activation event emitted whenever the specified view is expanded.")
          },
          {
            label: "onUri",
            body: "onUri",
            description: nls.localize("vscode.extension.activationEvents.onUri", "An activation event emitted whenever a system-wide Uri directed towards this extension is open.")
          },
          {
            label: "onOpenExternalUri",
            body: "onOpenExternalUri",
            description: nls.localize("vscode.extension.activationEvents.onOpenExternalUri", "An activation event emitted whenever a external uri (such as an http or https link) is being opened.")
          },
          {
            label: "onCustomEditor",
            body: "onCustomEditor:${9:viewType}",
            description: nls.localize("vscode.extension.activationEvents.onCustomEditor", "An activation event emitted whenever the specified custom editor becomes visible.")
          },
          {
            label: "onNotebook",
            body: "onNotebook:${1:type}",
            description: nls.localize("vscode.extension.activationEvents.onNotebook", "An activation event emitted whenever the specified notebook document is opened.")
          },
          {
            label: "onAuthenticationRequest",
            body: "onAuthenticationRequest:${11:authenticationProviderId}",
            description: nls.localize("vscode.extension.activationEvents.onAuthenticationRequest", "An activation event emitted whenever sessions are requested from the specified authentication provider.")
          },
          {
            label: "onRenderer",
            description: nls.localize("vscode.extension.activationEvents.onRenderer", "An activation event emitted whenever a notebook output renderer is used."),
            body: "onRenderer:${11:rendererId}"
          },
          {
            label: "onTerminalProfile",
            body: "onTerminalProfile:${1:terminalId}",
            description: nls.localize("vscode.extension.activationEvents.onTerminalProfile", "An activation event emitted when a specific terminal profile is launched.")
          },
          {
            label: "onTerminalQuickFixRequest",
            body: "onTerminalQuickFixRequest:${1:quickFixId}",
            description: nls.localize("vscode.extension.activationEvents.onTerminalQuickFixRequest", "An activation event emitted when a command matches the selector associated with this ID")
          },
          {
            label: "onWalkthrough",
            body: "onWalkthrough:${1:walkthroughID}",
            description: nls.localize("vscode.extension.activationEvents.onWalkthrough", "An activation event emitted when a specified walkthrough is opened.")
          },
          {
            label: "onIssueReporterOpened",
            body: "onIssueReporterOpened",
            description: nls.localize("vscode.extension.activationEvents.onIssueReporterOpened", "An activation event emitted when the issue reporter is opened.")
          },
          {
            label: "onChatParticipant",
            body: "onChatParticipant:${1:participantId}",
            description: nls.localize("vscode.extension.activationEvents.onChatParticipant", "An activation event emitted when the specified chat participant is invoked.")
          },
          {
            label: "onLanguageModelTool",
            body: "onLanguageModelTool:${1:toolId}",
            description: nls.localize("vscode.extension.activationEvents.onLanguageModelTool", "An activation event emitted when the specified language model tool is invoked.")
          },
          {
            label: "onTerminalCompletionsRequested",
            body: "onTerminalCompletionsRequested",
            description: nls.localize("vscode.extension.activationEvents.onTerminalCompletionsRequested", "An activation event emitted when terminal completions are requested.")
          },
          {
            label: "onMcpCollection",
            description: nls.localize("vscode.extension.activationEvents.onMcpCollection", "An activation event emitted whenver a tool from the MCP server is requested."),
            body: "onMcpCollection:${2:collectionId}"
          },
          {
            label: "*",
            description: nls.localize("vscode.extension.activationEvents.star", "An activation event emitted on VS Code startup. To ensure a great end user experience, please use this activation event in your extension only when no other activation events combination works in your use-case."),
            body: "*"
          }
        ]
      }
    },
    badges: {
      type: "array",
      description: nls.localize("vscode.extension.badges", "Array of badges to display in the sidebar of the Marketplace's extension page."),
      items: {
        type: "object",
        required: ["url", "href", "description"],
        properties: {
          url: {
            type: "string",
            description: nls.localize("vscode.extension.badges.url", "Badge image URL.")
          },
          href: {
            type: "string",
            description: nls.localize("vscode.extension.badges.href", "Badge link.")
          },
          description: {
            type: "string",
            description: nls.localize("vscode.extension.badges.description", "Badge description.")
          }
        }
      }
    },
    markdown: {
      type: "string",
      description: nls.localize("vscode.extension.markdown", "Controls the Markdown rendering engine used in the Marketplace. Either github (default) or standard."),
      enum: ["github", "standard"],
      default: "github"
    },
    qna: {
      default: "marketplace",
      description: nls.localize("vscode.extension.qna", "Controls the Q&A link in the Marketplace. Set to marketplace to enable the default Marketplace Q & A site. Set to a string to provide the URL of a custom Q & A site. Set to false to disable Q & A altogether."),
      anyOf: [
        {
          type: ["string", "boolean"],
          enum: ["marketplace", false]
        },
        {
          type: "string"
        }
      ]
    },
    extensionDependencies: {
      description: nls.localize("vscode.extension.extensionDependencies", "Dependencies to other extensions. The identifier of an extension is always ${publisher}.${name}. For example: vscode.csharp."),
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        pattern: EXTENSION_IDENTIFIER_PATTERN
      }
    },
    extensionPack: {
      description: nls.localize("vscode.extension.contributes.extensionPack", "A set of extensions that can be installed together. The identifier of an extension is always ${publisher}.${name}. For example: vscode.csharp."),
      type: "array",
      uniqueItems: true,
      items: {
        type: "string",
        pattern: EXTENSION_IDENTIFIER_PATTERN
      }
    },
    extensionKind: {
      description: nls.localize("extensionKind", "Define the kind of an extension. `ui` extensions are installed and run on the local machine while `workspace` extensions run on the remote."),
      type: "array",
      items: extensionKindSchema,
      default: ["workspace"],
      defaultSnippets: [
        {
          body: ["ui"],
          description: nls.localize("extensionKind.ui", "Define an extension which can run only on the local machine when connected to remote window.")
        },
        {
          body: ["workspace"],
          description: nls.localize("extensionKind.workspace", "Define an extension which can run only on the remote machine when connected remote window.")
        },
        {
          body: ["ui", "workspace"],
          description: nls.localize("extensionKind.ui-workspace", "Define an extension which can run on either side, with a preference towards running on the local machine.")
        },
        {
          body: ["workspace", "ui"],
          description: nls.localize("extensionKind.workspace-ui", "Define an extension which can run on either side, with a preference towards running on the remote machine.")
        },
        {
          body: [],
          description: nls.localize("extensionKind.empty", "Define an extension which cannot run in a remote context, neither on the local, nor on the remote machine.")
        }
      ]
    },
    capabilities: {
      description: nls.localize("vscode.extension.capabilities", "Declare the set of supported capabilities by the extension."),
      type: "object",
      properties: {
        virtualWorkspaces: {
          description: nls.localize("vscode.extension.capabilities.virtualWorkspaces", "Declares whether the extension should be enabled in virtual workspaces. A virtual workspace is a workspace which is not backed by any on-disk resources. When false, this extension will be automatically disabled in virtual workspaces. Default is true."),
          type: ["boolean", "object"],
          defaultSnippets: [
            { label: "limited", body: { supported: "${1:limited}", description: "${2}" } },
            { label: "false", body: { supported: false, description: "${2}" } }
          ],
          default: true.valueOf,
          properties: {
            supported: {
              markdownDescription: nls.localize("vscode.extension.capabilities.virtualWorkspaces.supported", "Declares the level of support for virtual workspaces by the extension."),
              type: ["string", "boolean"],
              enum: ["limited", true, false],
              enumDescriptions: [
                nls.localize("vscode.extension.capabilities.virtualWorkspaces.supported.limited", "The extension will be enabled in virtual workspaces with some functionality disabled."),
                nls.localize("vscode.extension.capabilities.virtualWorkspaces.supported.true", "The extension will be enabled in virtual workspaces with all functionality enabled."),
                nls.localize("vscode.extension.capabilities.virtualWorkspaces.supported.false", "The extension will not be enabled in virtual workspaces.")
              ]
            },
            description: {
              type: "string",
              markdownDescription: nls.localize("vscode.extension.capabilities.virtualWorkspaces.description", "A description of how virtual workspaces affects the extensions behavior and why it is needed. This only applies when `supported` is not `true`.")
            }
          }
        },
        untrustedWorkspaces: {
          description: nls.localize("vscode.extension.capabilities.untrustedWorkspaces", "Declares how the extension should be handled in untrusted workspaces."),
          type: "object",
          required: ["supported"],
          defaultSnippets: [
            { body: { supported: "${1:limited}", description: "${2}" } }
          ],
          properties: {
            supported: {
              markdownDescription: nls.localize("vscode.extension.capabilities.untrustedWorkspaces.supported", "Declares the level of support for untrusted workspaces by the extension."),
              type: ["string", "boolean"],
              enum: ["limited", true, false],
              enumDescriptions: [
                nls.localize("vscode.extension.capabilities.untrustedWorkspaces.supported.limited", "The extension will be enabled in untrusted workspaces with some functionality disabled."),
                nls.localize("vscode.extension.capabilities.untrustedWorkspaces.supported.true", "The extension will be enabled in untrusted workspaces with all functionality enabled."),
                nls.localize("vscode.extension.capabilities.untrustedWorkspaces.supported.false", "The extension will not be enabled in untrusted workspaces.")
              ]
            },
            restrictedConfigurations: {
              description: nls.localize("vscode.extension.capabilities.untrustedWorkspaces.restrictedConfigurations", "A list of configuration keys contributed by the extension that should not use workspace values in untrusted workspaces."),
              type: "array",
              items: {
                type: "string"
              }
            },
            description: {
              type: "string",
              markdownDescription: nls.localize("vscode.extension.capabilities.untrustedWorkspaces.description", "A description of how workspace trust affects the extensions behavior and why it is needed. This only applies when `supported` is not `true`.")
            }
          }
        }
      }
    },
    sponsor: {
      description: nls.localize("vscode.extension.contributes.sponsor", "Specify the location from where users can sponsor your extension."),
      type: "object",
      defaultSnippets: [
        { body: { url: "${1:https:}" } }
      ],
      properties: {
        "url": {
          description: nls.localize("vscode.extension.contributes.sponsor.url", "URL from where users can sponsor your extension. It must be a valid URL with a HTTP or HTTPS protocol. Example value: https://github.com/sponsors/nvaccess"),
          type: "string"
        }
      }
    },
    scripts: {
      type: "object",
      properties: {
        "vscode:prepublish": {
          description: nls.localize("vscode.extension.scripts.prepublish", "Script executed before the package is published as a VS Code extension."),
          type: "string"
        },
        "vscode:uninstall": {
          description: nls.localize("vscode.extension.scripts.uninstall", "Uninstall hook for VS Code extension. Script that gets executed when the extension is completely uninstalled from VS Code which is when VS Code is restarted (shutdown and start) after the extension is uninstalled. Only Node scripts are supported."),
          type: "string"
        }
      }
    },
    icon: {
      type: "string",
      description: nls.localize("vscode.extension.icon", "The path to a 128x128 pixel icon.")
    },
    l10n: {
      type: "string",
      description: nls.localize({
        key: "vscode.extension.l10n",
        comment: [
          '{Locked="bundle.l10n._locale_.json"}',
          '{Locked="vscode.l10n API"}'
        ]
      }, "The relative path to a folder containing localization (bundle.l10n.*.json) files. Must be specified if you are using the vscode.l10n API.")
    },
    pricing: {
      type: "string",
      markdownDescription: nls.localize("vscode.extension.pricing", "The pricing information for the extension. Can be Free (default) or Trial. For more details visit: https://code.visualstudio.com/api/working-with-extensions/publishing-extension#extension-pricing-label"),
      enum: ["Free", "Trial"],
      default: "Free"
    }
  }
};
class ExtensionsRegistryImpl {
  constructor() {
    this._extensionPoints = /* @__PURE__ */ new Map();
  }
  registerExtensionPoint(desc) {
    if (this._extensionPoints.has(desc.extensionPoint)) {
      throw new Error("Duplicate extension point: " + desc.extensionPoint);
    }
    const result = new ExtensionPoint(desc.extensionPoint, desc.defaultExtensionKind, desc.canHandleResolver);
    this._extensionPoints.set(desc.extensionPoint, result);
    if (desc.activationEventsGenerator) {
      ImplicitActivationEvents.register(desc.extensionPoint, desc.activationEventsGenerator);
    }
    schema.properties["contributes"].properties[desc.extensionPoint] = desc.jsonSchema;
    schemaRegistry.registerSchema(schemaId, schema);
    return result;
  }
  getExtensionPoints() {
    return Array.from(this._extensionPoints.values());
  }
}
const PRExtensions = {
  ExtensionsRegistry: "ExtensionsRegistry"
};
Registry.add(PRExtensions.ExtensionsRegistry, new ExtensionsRegistryImpl());
const ExtensionsRegistry = Registry.as(PRExtensions.ExtensionsRegistry);
schemaRegistry.registerSchema(schemaId, schema);
schemaRegistry.registerSchema(productSchemaId, {
  properties: {
    extensionEnabledApiProposals: {
      description: nls.localize("product.extensionEnabledApiProposals", "API proposals that the respective extensions can freely use."),
      type: "object",
      properties: {},
      additionalProperties: {
        anyOf: [{
          type: "array",
          uniqueItems: true,
          items: {
            type: "string",
            enum: Object.keys(allApiProposals),
            markdownEnumDescriptions: Object.values(allApiProposals).map((value) => value.proposal)
          }
        }]
      }
    }
  }
});
export {
  ExtensionMessageCollector,
  ExtensionPoint,
  ExtensionPointUserDelta,
  ExtensionsRegistry,
  ExtensionsRegistryImpl,
  schema
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9uc1JlZ2lzdHJ5LnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0ICogYXMgbmxzIGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBvblVuZXhwZWN0ZWRFcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBJSlNPTlNjaGVtYSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25TY2hlbWEuanMnO1xuaW1wb3J0IFNldmVyaXR5IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3NldmVyaXR5LmpzJztcbmltcG9ydCB7IEVYVEVOU0lPTl9JREVOVElGSUVSX1BBVFRFUk4gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25NYW5hZ2VtZW50L2NvbW1vbi9leHRlbnNpb25NYW5hZ2VtZW50LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnMsIElKU09OQ29udHJpYnV0aW9uUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IFJlZ2lzdHJ5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcmVnaXN0cnkvY29tbW9uL3BsYXRmb3JtLmpzJztcbmltcG9ydCB7IElNZXNzYWdlIH0gZnJvbSAnLi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgRVhURU5TSU9OX0NBVEVHT1JJRVMsIEV4dGVuc2lvbklkZW50aWZpZXJTZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbktpbmQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9lbnZpcm9ubWVudC9jb21tb24vZW52aXJvbm1lbnQuanMnO1xuaW1wb3J0IHsgcHJvZHVjdFNjaGVtYUlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSW1wbGljaXRBY3RpdmF0aW9uRXZlbnRzLCBJQWN0aXZhdGlvbkV2ZW50c0dlbmVyYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2ltcGxpY2l0QWN0aXZhdGlvbkV2ZW50cy5qcyc7XG5pbXBvcnQgeyBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhbGxBcGlQcm9wb3NhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zQXBpUHJvcG9zYWxzLmpzJztcblxuY29uc3Qgc2NoZW1hUmVnaXN0cnkgPSBSZWdpc3RyeS5hczxJSlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5PihFeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3RvciB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfbWVzc2FnZUhhbmRsZXI6IChtc2c6IElNZXNzYWdlKSA9PiB2b2lkO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbjtcblx0cHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uUG9pbnRJZDogc3RyaW5nO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdG1lc3NhZ2VIYW5kbGVyOiAobXNnOiBJTWVzc2FnZSkgPT4gdm9pZCxcblx0XHRleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRleHRlbnNpb25Qb2ludElkOiBzdHJpbmdcblx0KSB7XG5cdFx0dGhpcy5fbWVzc2FnZUhhbmRsZXIgPSBtZXNzYWdlSGFuZGxlcjtcblx0XHR0aGlzLl9leHRlbnNpb24gPSBleHRlbnNpb247XG5cdFx0dGhpcy5fZXh0ZW5zaW9uUG9pbnRJZCA9IGV4dGVuc2lvblBvaW50SWQ7XG5cdH1cblxuXHRwcml2YXRlIF9tc2codHlwZTogU2V2ZXJpdHksIG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX21lc3NhZ2VIYW5kbGVyKHtcblx0XHRcdHR5cGU6IHR5cGUsXG5cdFx0XHRtZXNzYWdlOiBtZXNzYWdlLFxuXHRcdFx0ZXh0ZW5zaW9uSWQ6IHRoaXMuX2V4dGVuc2lvbi5pZGVudGlmaWVyLFxuXHRcdFx0ZXh0ZW5zaW9uUG9pbnRJZDogdGhpcy5fZXh0ZW5zaW9uUG9pbnRJZFxuXHRcdH0pO1xuXHR9XG5cblx0cHVibGljIGVycm9yKG1lc3NhZ2U6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMuX21zZyhTZXZlcml0eS5FcnJvciwgbWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgd2FybihtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9tc2coU2V2ZXJpdHkuV2FybmluZywgbWVzc2FnZSk7XG5cdH1cblxuXHRwdWJsaWMgaW5mbyhtZXNzYWdlOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9tc2coU2V2ZXJpdHkuSW5mbywgbWVzc2FnZSk7XG5cdH1cbn1cblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uUG9pbnRVc2VyPFQ+IHtcblx0ZGVzY3JpcHRpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbjtcblx0dmFsdWU6IFQ7XG5cdGNvbGxlY3RvcjogRXh0ZW5zaW9uTWVzc2FnZUNvbGxlY3Rvcjtcbn1cblxuZXhwb3J0IHR5cGUgSUV4dGVuc2lvblBvaW50SGFuZGxlcjxUPiA9IChleHRlbnNpb25zOiByZWFkb25seSBJRXh0ZW5zaW9uUG9pbnRVc2VyPFQ+W10sIGRlbHRhOiBFeHRlbnNpb25Qb2ludFVzZXJEZWx0YTxUPikgPT4gdm9pZDtcblxuZXhwb3J0IGludGVyZmFjZSBJRXh0ZW5zaW9uUG9pbnQ8VD4ge1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHNldEhhbmRsZXIoaGFuZGxlcjogSUV4dGVuc2lvblBvaW50SGFuZGxlcjxUPik6IElEaXNwb3NhYmxlO1xuXHRyZWFkb25seSBkZWZhdWx0RXh0ZW5zaW9uS2luZDogRXh0ZW5zaW9uS2luZFtdIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBjYW5IYW5kbGVSZXNvbHZlcj86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBFeHRlbnNpb25Qb2ludFVzZXJEZWx0YTxUPiB7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3RvU2V0PFQ+KGFycjogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxUPltdKTogRXh0ZW5zaW9uSWRlbnRpZmllclNldCB7XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEV4dGVuc2lvbklkZW50aWZpZXJTZXQoKTtcblx0XHRmb3IgKGxldCBpID0gMCwgbGVuID0gYXJyLmxlbmd0aDsgaSA8IGxlbjsgaSsrKSB7XG5cdFx0XHRyZXN1bHQuYWRkKGFycltpXS5kZXNjcmlwdGlvbi5pZGVudGlmaWVyKTtcblx0XHR9XG5cdFx0cmV0dXJuIHJlc3VsdDtcblx0fVxuXG5cdHB1YmxpYyBzdGF0aWMgY29tcHV0ZTxUPihwcmV2aW91czogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxUPltdIHwgbnVsbCwgY3VycmVudDogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxUPltdKTogRXh0ZW5zaW9uUG9pbnRVc2VyRGVsdGE8VD4ge1xuXHRcdGlmICghcHJldmlvdXMgfHwgIXByZXZpb3VzLmxlbmd0aCkge1xuXHRcdFx0cmV0dXJuIG5ldyBFeHRlbnNpb25Qb2ludFVzZXJEZWx0YTxUPihjdXJyZW50LCBbXSk7XG5cdFx0fVxuXHRcdGlmICghY3VycmVudCB8fCAhY3VycmVudC5sZW5ndGgpIHtcblx0XHRcdHJldHVybiBuZXcgRXh0ZW5zaW9uUG9pbnRVc2VyRGVsdGE8VD4oW10sIHByZXZpb3VzKTtcblx0XHR9XG5cblx0XHRjb25zdCBwcmV2aW91c1NldCA9IHRoaXMuX3RvU2V0KHByZXZpb3VzKTtcblx0XHRjb25zdCBjdXJyZW50U2V0ID0gdGhpcy5fdG9TZXQoY3VycmVudCk7XG5cblx0XHRjb25zdCBhZGRlZCA9IGN1cnJlbnQuZmlsdGVyKHVzZXIgPT4gIXByZXZpb3VzU2V0Lmhhcyh1c2VyLmRlc2NyaXB0aW9uLmlkZW50aWZpZXIpKTtcblx0XHRjb25zdCByZW1vdmVkID0gcHJldmlvdXMuZmlsdGVyKHVzZXIgPT4gIWN1cnJlbnRTZXQuaGFzKHVzZXIuZGVzY3JpcHRpb24uaWRlbnRpZmllcikpO1xuXG5cdFx0cmV0dXJuIG5ldyBFeHRlbnNpb25Qb2ludFVzZXJEZWx0YTxUPihhZGRlZCwgcmVtb3ZlZCk7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwdWJsaWMgcmVhZG9ubHkgYWRkZWQ6IHJlYWRvbmx5IElFeHRlbnNpb25Qb2ludFVzZXI8VD5bXSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVtb3ZlZDogcmVhZG9ubHkgSUV4dGVuc2lvblBvaW50VXNlcjxUPltdLFxuXHQpIHsgfVxufVxuXG5leHBvcnQgY2xhc3MgRXh0ZW5zaW9uUG9pbnQ8VD4gaW1wbGVtZW50cyBJRXh0ZW5zaW9uUG9pbnQ8VD4ge1xuXG5cdHB1YmxpYyByZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHB1YmxpYyByZWFkb25seSBkZWZhdWx0RXh0ZW5zaW9uS2luZDogRXh0ZW5zaW9uS2luZFtdIHwgdW5kZWZpbmVkO1xuXHRwdWJsaWMgcmVhZG9ubHkgY2FuSGFuZGxlUmVzb2x2ZXI/OiBib29sZWFuO1xuXG5cdHByaXZhdGUgX2hhbmRsZXI6IElFeHRlbnNpb25Qb2ludEhhbmRsZXI8VD4gfCBudWxsO1xuXHRwcml2YXRlIF91c2VyczogSUV4dGVuc2lvblBvaW50VXNlcjxUPltdIHwgbnVsbDtcblx0cHJpdmF0ZSBfZGVsdGE6IEV4dGVuc2lvblBvaW50VXNlckRlbHRhPFQ+IHwgbnVsbDtcblxuXHRjb25zdHJ1Y3RvcihuYW1lOiBzdHJpbmcsIGRlZmF1bHRFeHRlbnNpb25LaW5kOiBFeHRlbnNpb25LaW5kW10gfCB1bmRlZmluZWQsIGNhbkhhbmRsZVJlc29sdmVyPzogYm9vbGVhbikge1xuXHRcdHRoaXMubmFtZSA9IG5hbWU7XG5cdFx0dGhpcy5kZWZhdWx0RXh0ZW5zaW9uS2luZCA9IGRlZmF1bHRFeHRlbnNpb25LaW5kO1xuXHRcdHRoaXMuY2FuSGFuZGxlUmVzb2x2ZXIgPSBjYW5IYW5kbGVSZXNvbHZlcjtcblx0XHR0aGlzLl9oYW5kbGVyID0gbnVsbDtcblx0XHR0aGlzLl91c2VycyA9IG51bGw7XG5cdFx0dGhpcy5fZGVsdGEgPSBudWxsO1xuXHR9XG5cblx0c2V0SGFuZGxlcihoYW5kbGVyOiBJRXh0ZW5zaW9uUG9pbnRIYW5kbGVyPFQ+KTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLl9oYW5kbGVyICE9PSBudWxsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0hhbmRsZXIgYWxyZWFkeSBzZXQhJyk7XG5cdFx0fVxuXHRcdHRoaXMuX2hhbmRsZXIgPSBoYW5kbGVyO1xuXHRcdHRoaXMuX2hhbmRsZSgpO1xuXG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHtcblx0XHRcdFx0dGhpcy5faGFuZGxlciA9IG51bGw7XG5cdFx0XHR9XG5cdFx0fTtcblx0fVxuXG5cdGFjY2VwdFVzZXJzKHVzZXJzOiBJRXh0ZW5zaW9uUG9pbnRVc2VyPFQ+W10pOiB2b2lkIHtcblx0XHR0aGlzLl9kZWx0YSA9IEV4dGVuc2lvblBvaW50VXNlckRlbHRhLmNvbXB1dGUodGhpcy5fdXNlcnMsIHVzZXJzKTtcblx0XHR0aGlzLl91c2VycyA9IHVzZXJzO1xuXHRcdHRoaXMuX2hhbmRsZSgpO1xuXHR9XG5cblx0cHJpdmF0ZSBfaGFuZGxlKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLl9oYW5kbGVyID09PSBudWxsIHx8IHRoaXMuX3VzZXJzID09PSBudWxsIHx8IHRoaXMuX2RlbHRhID09PSBudWxsKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMuX2hhbmRsZXIodGhpcy5fdXNlcnMsIHRoaXMuX2RlbHRhKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdG9uVW5leHBlY3RlZEVycm9yKGVycik7XG5cdFx0fVxuXHR9XG59XG5cbmNvbnN0IGV4dGVuc2lvbktpbmRTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZW51bTogW1xuXHRcdCd1aScsXG5cdFx0J3dvcmtzcGFjZSdcblx0XSxcblx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdG5scy5sb2NhbGl6ZSgndWknLCBcIlVJIGV4dGVuc2lvbiBraW5kLiBJbiBhIHJlbW90ZSB3aW5kb3csIHN1Y2ggZXh0ZW5zaW9ucyBhcmUgZW5hYmxlZCBvbmx5IHdoZW4gYXZhaWxhYmxlIG9uIHRoZSBsb2NhbCBtYWNoaW5lLlwiKSxcblx0XHRubHMubG9jYWxpemUoJ3dvcmtzcGFjZScsIFwiV29ya3NwYWNlIGV4dGVuc2lvbiBraW5kLiBJbiBhIHJlbW90ZSB3aW5kb3csIHN1Y2ggZXh0ZW5zaW9ucyBhcmUgZW5hYmxlZCBvbmx5IHdoZW4gYXZhaWxhYmxlIG9uIHRoZSByZW1vdGUuXCIpLFxuXHRdLFxufTtcblxuY29uc3Qgc2NoZW1hSWQgPSAndnNjb2RlOi8vc2NoZW1hcy92c2NvZGUtZXh0ZW5zaW9ucyc7XG5leHBvcnQgY29uc3Qgc2NoZW1hOiBJSlNPTlNjaGVtYSA9IHtcblx0cHJvcGVydGllczoge1xuXHRcdGVuZ2luZXM6IHtcblx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5lbmdpbmVzJywgXCJFbmdpbmUgY29tcGF0aWJpbGl0eS5cIiksXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCd2c2NvZGUnOiB7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5lbmdpbmVzLnZzY29kZScsICdGb3IgVlMgQ29kZSBleHRlbnNpb25zLCBzcGVjaWZpZXMgdGhlIFZTIENvZGUgdmVyc2lvbiB0aGF0IHRoZSBleHRlbnNpb24gaXMgY29tcGF0aWJsZSB3aXRoLiBDYW5ub3QgYmUgKi4gRm9yIGV4YW1wbGU6IF4wLjEwLjUgaW5kaWNhdGVzIGNvbXBhdGliaWxpdHkgd2l0aCBhIG1pbmltdW0gVlMgQ29kZSB2ZXJzaW9uIG9mIDAuMTAuNS4nKSxcblx0XHRcdFx0XHRkZWZhdWx0OiAnXjEuMjIuMCcsXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHB1Ymxpc2hlcjoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5wdWJsaXNoZXInLCAnVGhlIHB1Ymxpc2hlciBvZiB0aGUgVlMgQ29kZSBleHRlbnNpb24uJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0ZGlzcGxheU5hbWU6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uZGlzcGxheU5hbWUnLCAnVGhlIGRpc3BsYXkgbmFtZSBmb3IgdGhlIGV4dGVuc2lvbiB1c2VkIGluIHRoZSBWUyBDb2RlIGdhbGxlcnkuJyksXG5cdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdH0sXG5cdFx0Y2F0ZWdvcmllczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXRlZ29yaWVzJywgJ1RoZSBjYXRlZ29yaWVzIHVzZWQgYnkgdGhlIFZTIENvZGUgZ2FsbGVyeSB0byBjYXRlZ29yaXplIHRoZSBleHRlbnNpb24uJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0dW5pcXVlSXRlbXM6IHRydWUsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHRvbmVPZjogW3tcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBFWFRFTlNJT05fQ0FURUdPUklFUyxcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdGNvbnN0OiAnTGFuZ3VhZ2VzJyxcblx0XHRcdFx0XHRkZXByZWNhdGlvbk1lc3NhZ2U6IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXRlZ29yeS5sYW5ndWFnZXMuZGVwcmVjYXRlZCcsICdVc2UgXFwnUHJvZ3JhbW1pbmcgIExhbmd1YWdlc1xcJyBpbnN0ZWFkJyksXG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRnYWxsZXJ5QmFubmVyOiB7XG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uZ2FsbGVyeUJhbm5lcicsICdCYW5uZXIgdXNlZCBpbiB0aGUgVlMgQ29kZSBtYXJrZXRwbGFjZS4nKSxcblx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0Y29sb3I6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmdhbGxlcnlCYW5uZXIuY29sb3InLCAnVGhlIGJhbm5lciBjb2xvciBvbiB0aGUgVlMgQ29kZSBtYXJrZXRwbGFjZSBwYWdlIGhlYWRlci4nKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHR0aGVtZToge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uZ2FsbGVyeUJhbm5lci50aGVtZScsICdUaGUgY29sb3IgdGhlbWUgZm9yIHRoZSBmb250IHVzZWQgaW4gdGhlIGJhbm5lci4nKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRlbnVtOiBbJ2RhcmsnLCAnbGlnaHQnXVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSxcblx0XHRjb250cmlidXRlczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcycsICdBbGwgY29udHJpYnV0aW9ucyBvZiB0aGUgVlMgQ29kZSBleHRlbnNpb24gcmVwcmVzZW50ZWQgYnkgdGhpcyBwYWNrYWdlLicpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdC8vIGV4dGVuc2lvbnMgd2lsbCBmaWxsIGluXG5cdFx0XHR9IGFzIGFueSBhcyB7IFtrZXk6IHN0cmluZ106IGFueSB9LFxuXHRcdFx0ZGVmYXVsdDoge31cblx0XHR9LFxuXHRcdHByZXZpZXc6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24ucHJldmlldycsICdTZXRzIHRoZSBleHRlbnNpb24gdG8gYmUgZmxhZ2dlZCBhcyBhIFByZXZpZXcgaW4gdGhlIE1hcmtldHBsYWNlLicpLFxuXHRcdH0sXG5cdFx0ZW5hYmxlUHJvcG9zZWRBcGk6IHtcblx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdGRlcHJlY2F0aW9uTWVzc2FnZTogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmVuYWJsZVByb3Bvc2VkQXBpLmRlcHJlY2F0ZWQnLCAnVXNlIGBlbmFibGVkQXBpUHJvcG9zYWxzYCBpbnN0ZWFkLicpLFxuXHRcdH0sXG5cdFx0ZW5hYmxlZEFwaVByb3Bvc2Fsczoge1xuXHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmVuYWJsZWRBcGlQcm9wb3NhbHMnLCAnRW5hYmxlIEFQSSBwcm9wb3NhbHMgdG8gdHJ5IHRoZW0gb3V0LiBPbmx5IHZhbGlkICoqZHVyaW5nIGRldmVsb3BtZW50KiouIEV4dGVuc2lvbnMgKipjYW5ub3QgYmUgcHVibGlzaGVkKiogd2l0aCB0aGlzIHByb3BlcnR5LiBGb3IgbW9yZSBkZXRhaWxzIHZpc2l0OiBodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9hcGkvYWR2YW5jZWQtdG9waWNzL3VzaW5nLXByb3Bvc2VkLWFwaScpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdHVuaXF1ZUl0ZW1zOiB0cnVlLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdGVudW06IE9iamVjdC5rZXlzKGFsbEFwaVByb3Bvc2FscykubWFwKHByb3Bvc2FsTmFtZSA9PiBwcm9wb3NhbE5hbWUpLFxuXHRcdFx0XHRtYXJrZG93bkVudW1EZXNjcmlwdGlvbnM6IE9iamVjdC52YWx1ZXMoYWxsQXBpUHJvcG9zYWxzKS5tYXAodmFsdWUgPT4gdmFsdWUucHJvcG9zYWwpXG5cdFx0XHR9XG5cdFx0fSxcblx0XHRhcGk6IHtcblx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hcGknLCAnRGVzY3JpYmUgdGhlIEFQSSBwcm92aWRlZCBieSB0aGlzIGV4dGVuc2lvbi4gRm9yIG1vcmUgZGV0YWlscyB2aXNpdDogaHR0cHM6Ly9jb2RlLnZpc3VhbHN0dWRpby5jb20vYXBpL2FkdmFuY2VkLXRvcGljcy9yZW1vdGUtZXh0ZW5zaW9ucyNoYW5kbGluZy1kZXBlbmRlbmNpZXMtd2l0aC1yZW1vdGUtZXh0ZW5zaW9ucycpLFxuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRlbnVtOiBbJ25vbmUnXSxcblx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0bmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFwaS5ub25lJywgXCJHaXZlIHVwIGVudGlyZWx5IHRoZSBhYmlsaXR5IHRvIGV4cG9ydCBhbnkgQVBJcy4gVGhpcyBhbGxvd3Mgb3RoZXIgZXh0ZW5zaW9ucyB0aGF0IGRlcGVuZCBvbiB0aGlzIGV4dGVuc2lvbiB0byBydW4gaW4gYSBzZXBhcmF0ZSBleHRlbnNpb24gaG9zdCBwcm9jZXNzIG9yIGluIGEgcmVtb3RlIG1hY2hpbmUuXCIpXG5cdFx0XHRdXG5cdFx0fSxcblx0XHRhY3RpdmF0aW9uRXZlbnRzOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMnLCAnQWN0aXZhdGlvbiBldmVudHMgZm9yIHRoZSBWUyBDb2RlIGV4dGVuc2lvbi4nKSxcblx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbldlYnZpZXdQYW5lbCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25XZWJ2aWV3UGFuZWwnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbW1pdGVkIHdoZW4gYSB3ZWJ2aWV3IGlzIGxvYWRlZCBvZiBhIGNlcnRhaW4gdmlld1R5cGUnKSxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbldlYnZpZXdQYW5lbDp2aWV3VHlwZSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25MYW5ndWFnZScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25MYW5ndWFnZScsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgYSBmaWxlIHRoYXQgcmVzb2x2ZXMgdG8gdGhlIHNwZWNpZmllZCBsYW5ndWFnZSBnZXRzIG9wZW5lZC4nKSxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkxhbmd1YWdlOiR7MTpsYW5ndWFnZUlkfSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25Db21tYW5kJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vbkNvbW1hbmQnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIHRoZSBzcGVjaWZpZWQgY29tbWFuZCBnZXRzIGludm9rZWQuJyksXG5cdFx0XHRcdFx0XHRib2R5OiAnb25Db21tYW5kOiR7Mjpjb21tYW5kSWR9J1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbkRlYnVnJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vbkRlYnVnJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBhIHVzZXIgaXMgYWJvdXQgdG8gc3RhcnQgZGVidWdnaW5nIG9yIGFib3V0IHRvIHNldHVwIGRlYnVnIGNvbmZpZ3VyYXRpb25zLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uRGVidWcnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uRGVidWdJbml0aWFsQ29uZmlndXJhdGlvbnMnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uRGVidWdJbml0aWFsQ29uZmlndXJhdGlvbnMnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIGEgXCJsYXVuY2guanNvblwiIG5lZWRzIHRvIGJlIGNyZWF0ZWQgKGFuZCBhbGwgcHJvdmlkZURlYnVnQ29uZmlndXJhdGlvbnMgbWV0aG9kcyBuZWVkIHRvIGJlIGNhbGxlZCkuJyksXG5cdFx0XHRcdFx0XHRib2R5OiAnb25EZWJ1Z0luaXRpYWxDb25maWd1cmF0aW9ucydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25EZWJ1Z0R5bmFtaWNDb25maWd1cmF0aW9ucycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25EZWJ1Z0R5bmFtaWNDb25maWd1cmF0aW9ucycsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgYSBsaXN0IG9mIGFsbCBkZWJ1ZyBjb25maWd1cmF0aW9ucyBuZWVkcyB0byBiZSBjcmVhdGVkIChhbmQgYWxsIHByb3ZpZGVEZWJ1Z0NvbmZpZ3VyYXRpb25zIG1ldGhvZHMgZm9yIHRoZSBcImR5bmFtaWNcIiBzY29wZSBuZWVkIHRvIGJlIGNhbGxlZCkuJyksXG5cdFx0XHRcdFx0XHRib2R5OiAnb25EZWJ1Z0R5bmFtaWNDb25maWd1cmF0aW9ucydcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25EZWJ1Z1Jlc29sdmUnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uRGVidWdSZXNvbHZlJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBhIGRlYnVnIHNlc3Npb24gd2l0aCB0aGUgc3BlY2lmaWMgdHlwZSBpcyBhYm91dCB0byBiZSBsYXVuY2hlZCAoYW5kIGEgY29ycmVzcG9uZGluZyByZXNvbHZlRGVidWdDb25maWd1cmF0aW9uIG1ldGhvZCBuZWVkcyB0byBiZSBjYWxsZWQpLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uRGVidWdSZXNvbHZlOiR7Njp0eXBlfSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25EZWJ1Z0FkYXB0ZXJQcm90b2NvbFRyYWNrZXInLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uRGVidWdBZGFwdGVyUHJvdG9jb2xUcmFja2VyJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBhIGRlYnVnIHNlc3Npb24gd2l0aCB0aGUgc3BlY2lmaWMgdHlwZSBpcyBhYm91dCB0byBiZSBsYXVuY2hlZCBhbmQgYSBkZWJ1ZyBwcm90b2NvbCB0cmFja2VyIG1pZ2h0IGJlIG5lZWRlZC4nKSxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkRlYnVnQWRhcHRlclByb3RvY29sVHJhY2tlcjokezY6dHlwZX0nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ3dvcmtzcGFjZUNvbnRhaW5zJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy53b3Jrc3BhY2VDb250YWlucycsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgYSBmb2xkZXIgaXMgb3BlbmVkIHRoYXQgY29udGFpbnMgYXQgbGVhc3QgYSBmaWxlIG1hdGNoaW5nIHRoZSBzcGVjaWZpZWQgZ2xvYiBwYXR0ZXJuLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ3dvcmtzcGFjZUNvbnRhaW5zOiR7NDpmaWxlUGF0dGVybn0nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uU3RhcnR1cEZpbmlzaGVkJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vblN0YXJ0dXBGaW5pc2hlZCcsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgYWZ0ZXIgdGhlIHN0YXJ0LXVwIGZpbmlzaGVkIChhZnRlciBhbGwgYCpgIGFjdGl2YXRlZCBleHRlbnNpb25zIGhhdmUgZmluaXNoZWQgYWN0aXZhdGluZykuJyksXG5cdFx0XHRcdFx0XHRib2R5OiAnb25TdGFydHVwRmluaXNoZWQnXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uVGFza1R5cGUnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uVGFza1R5cGUnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIHRhc2tzIG9mIGEgY2VydGFpbiB0eXBlIG5lZWQgdG8gYmUgbGlzdGVkIG9yIHJlc29sdmVkLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uVGFza1R5cGU6JHsxOnRhc2tUeXBlfSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25GaWxlU3lzdGVtJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vbkZpbGVTeXN0ZW0nLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIGEgZmlsZSBvciBmb2xkZXIgaXMgYWNjZXNzZWQgd2l0aCB0aGUgZ2l2ZW4gc2NoZW1lLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uRmlsZVN5c3RlbTokezE6c2NoZW1lfSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25FZGl0U2Vzc2lvbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25FZGl0U2Vzc2lvbicsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgYW4gZWRpdCBzZXNzaW9uIGlzIGFjY2Vzc2VkIHdpdGggdGhlIGdpdmVuIHNjaGVtZS4nKSxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkVkaXRTZXNzaW9uOiR7MTpzY2hlbWV9J1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvblNlYXJjaCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25TZWFyY2gnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIGEgc2VhcmNoIGlzIHN0YXJ0ZWQgaW4gdGhlIGZvbGRlciB3aXRoIHRoZSBnaXZlbiBzY2hlbWUuJyksXG5cdFx0XHRcdFx0XHRib2R5OiAnb25TZWFyY2g6JHs3OnNjaGVtZX0nXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uVmlldycsXG5cdFx0XHRcdFx0XHRib2R5OiAnb25WaWV3OiR7NTp2aWV3SWR9Jyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vblZpZXcnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW5ldmVyIHRoZSBzcGVjaWZpZWQgdmlldyBpcyBleHBhbmRlZC4nKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25VcmknLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uVXJpJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vblVyaScsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgYSBzeXN0ZW0td2lkZSBVcmkgZGlyZWN0ZWQgdG93YXJkcyB0aGlzIGV4dGVuc2lvbiBpcyBvcGVuLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbk9wZW5FeHRlcm5hbFVyaScsXG5cdFx0XHRcdFx0XHRib2R5OiAnb25PcGVuRXh0ZXJuYWxVcmknLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uT3BlbkV4dGVybmFsVXJpJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBhIGV4dGVybmFsIHVyaSAoc3VjaCBhcyBhbiBodHRwIG9yIGh0dHBzIGxpbmspIGlzIGJlaW5nIG9wZW5lZC4nKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25DdXN0b21FZGl0b3InLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uQ3VzdG9tRWRpdG9yOiR7OTp2aWV3VHlwZX0nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uQ3VzdG9tRWRpdG9yJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciB0aGUgc3BlY2lmaWVkIGN1c3RvbSBlZGl0b3IgYmVjb21lcyB2aXNpYmxlLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbk5vdGVib29rJyxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbk5vdGVib29rOiR7MTp0eXBlfScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25Ob3RlYm9vaycsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbmV2ZXIgdGhlIHNwZWNpZmllZCBub3RlYm9vayBkb2N1bWVudCBpcyBvcGVuZWQuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uQXV0aGVudGljYXRpb25SZXF1ZXN0Jyxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkF1dGhlbnRpY2F0aW9uUmVxdWVzdDokezExOmF1dGhlbnRpY2F0aW9uUHJvdmlkZXJJZH0nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uQXV0aGVudGljYXRpb25SZXF1ZXN0JywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBzZXNzaW9ucyBhcmUgcmVxdWVzdGVkIGZyb20gdGhlIHNwZWNpZmllZCBhdXRoZW50aWNhdGlvbiBwcm92aWRlci4nKVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvblJlbmRlcmVyJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vblJlbmRlcmVyJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuZXZlciBhIG5vdGVib29rIG91dHB1dCByZW5kZXJlciBpcyB1c2VkLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uUmVuZGVyZXI6JHsxMTpyZW5kZXJlcklkfSdcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25UZXJtaW5hbFByb2ZpbGUnLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uVGVybWluYWxQcm9maWxlOiR7MTp0ZXJtaW5hbElkfScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25UZXJtaW5hbFByb2ZpbGUnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW4gYSBzcGVjaWZpYyB0ZXJtaW5hbCBwcm9maWxlIGlzIGxhdW5jaGVkLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvblRlcm1pbmFsUXVpY2tGaXhSZXF1ZXN0Jyxcblx0XHRcdFx0XHRcdGJvZHk6ICdvblRlcm1pbmFsUXVpY2tGaXhSZXF1ZXN0OiR7MTpxdWlja0ZpeElkfScsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25UZXJtaW5hbFF1aWNrRml4UmVxdWVzdCcsICdBbiBhY3RpdmF0aW9uIGV2ZW50IGVtaXR0ZWQgd2hlbiBhIGNvbW1hbmQgbWF0Y2hlcyB0aGUgc2VsZWN0b3IgYXNzb2NpYXRlZCB3aXRoIHRoaXMgSUQnKSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHtcblx0XHRcdFx0XHRcdGxhYmVsOiAnb25XYWxrdGhyb3VnaCcsXG5cdFx0XHRcdFx0XHRib2R5OiAnb25XYWxrdGhyb3VnaDokezE6d2Fsa3Rocm91Z2hJRH0nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uV2Fsa3Rocm91Z2gnLCAnQW4gYWN0aXZhdGlvbiBldmVudCBlbWl0dGVkIHdoZW4gYSBzcGVjaWZpZWQgd2Fsa3Rocm91Z2ggaXMgb3BlbmVkLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbklzc3VlUmVwb3J0ZXJPcGVuZWQnLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uSXNzdWVSZXBvcnRlck9wZW5lZCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25Jc3N1ZVJlcG9ydGVyT3BlbmVkJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuIHRoZSBpc3N1ZSByZXBvcnRlciBpcyBvcGVuZWQuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uQ2hhdFBhcnRpY2lwYW50Jyxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkNoYXRQYXJ0aWNpcGFudDokezE6cGFydGljaXBhbnRJZH0nLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5hY3RpdmF0aW9uRXZlbnRzLm9uQ2hhdFBhcnRpY2lwYW50JywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuIHRoZSBzcGVjaWZpZWQgY2hhdCBwYXJ0aWNpcGFudCBpcyBpbnZva2VkLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvbkxhbmd1YWdlTW9kZWxUb29sJyxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbkxhbmd1YWdlTW9kZWxUb29sOiR7MTp0b29sSWR9Jyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5vbkxhbmd1YWdlTW9kZWxUb29sJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuIHRoZSBzcGVjaWZpZWQgbGFuZ3VhZ2UgbW9kZWwgdG9vbCBpcyBpbnZva2VkLicpLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICdvblRlcm1pbmFsQ29tcGxldGlvbnNSZXF1ZXN0ZWQnLFxuXHRcdFx0XHRcdFx0Ym9keTogJ29uVGVybWluYWxDb21wbGV0aW9uc1JlcXVlc3RlZCcsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25UZXJtaW5hbENvbXBsZXRpb25zUmVxdWVzdGVkJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVuIHRlcm1pbmFsIGNvbXBsZXRpb25zIGFyZSByZXF1ZXN0ZWQuJyksXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogJ29uTWNwQ29sbGVjdGlvbicsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmFjdGl2YXRpb25FdmVudHMub25NY3BDb2xsZWN0aW9uJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCB3aGVudmVyIGEgdG9vbCBmcm9tIHRoZSBNQ1Agc2VydmVyIGlzIHJlcXVlc3RlZC4nKSxcblx0XHRcdFx0XHRcdGJvZHk6ICdvbk1jcENvbGxlY3Rpb246JHsyOmNvbGxlY3Rpb25JZH0nLFxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6ICcqJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYWN0aXZhdGlvbkV2ZW50cy5zdGFyJywgJ0FuIGFjdGl2YXRpb24gZXZlbnQgZW1pdHRlZCBvbiBWUyBDb2RlIHN0YXJ0dXAuIFRvIGVuc3VyZSBhIGdyZWF0IGVuZCB1c2VyIGV4cGVyaWVuY2UsIHBsZWFzZSB1c2UgdGhpcyBhY3RpdmF0aW9uIGV2ZW50IGluIHlvdXIgZXh0ZW5zaW9uIG9ubHkgd2hlbiBubyBvdGhlciBhY3RpdmF0aW9uIGV2ZW50cyBjb21iaW5hdGlvbiB3b3JrcyBpbiB5b3VyIHVzZS1jYXNlLicpLFxuXHRcdFx0XHRcdFx0Ym9keTogJyonXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRdLFxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0YmFkZ2VzOiB7XG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5iYWRnZXMnLCAnQXJyYXkgb2YgYmFkZ2VzIHRvIGRpc3BsYXkgaW4gdGhlIHNpZGViYXIgb2YgdGhlIE1hcmtldHBsYWNlXFwncyBleHRlbnNpb24gcGFnZS4nKSxcblx0XHRcdGl0ZW1zOiB7XG5cdFx0XHRcdHR5cGU6ICdvYmplY3QnLFxuXHRcdFx0XHRyZXF1aXJlZDogWyd1cmwnLCAnaHJlZicsICdkZXNjcmlwdGlvbiddLFxuXHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0dXJsOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uYmFkZ2VzLnVybCcsICdCYWRnZSBpbWFnZSBVUkwuJylcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdGhyZWY6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5iYWRnZXMuaHJlZicsICdCYWRnZSBsaW5rLicpXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmJhZGdlcy5kZXNjcmlwdGlvbicsICdCYWRnZSBkZXNjcmlwdGlvbi4nKVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0bWFya2Rvd246IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5tYXJrZG93bicsIFwiQ29udHJvbHMgdGhlIE1hcmtkb3duIHJlbmRlcmluZyBlbmdpbmUgdXNlZCBpbiB0aGUgTWFya2V0cGxhY2UuIEVpdGhlciBnaXRodWIgKGRlZmF1bHQpIG9yIHN0YW5kYXJkLlwiKSxcblx0XHRcdGVudW06IFsnZ2l0aHViJywgJ3N0YW5kYXJkJ10sXG5cdFx0XHRkZWZhdWx0OiAnZ2l0aHViJ1xuXHRcdH0sXG5cdFx0cW5hOiB7XG5cdFx0XHRkZWZhdWx0OiAnbWFya2V0cGxhY2UnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5xbmEnLCBcIkNvbnRyb2xzIHRoZSBRJkEgbGluayBpbiB0aGUgTWFya2V0cGxhY2UuIFNldCB0byBtYXJrZXRwbGFjZSB0byBlbmFibGUgdGhlIGRlZmF1bHQgTWFya2V0cGxhY2UgUSAmIEEgc2l0ZS4gU2V0IHRvIGEgc3RyaW5nIHRvIHByb3ZpZGUgdGhlIFVSTCBvZiBhIGN1c3RvbSBRICYgQSBzaXRlLiBTZXQgdG8gZmFsc2UgdG8gZGlzYWJsZSBRICYgQSBhbHRvZ2V0aGVyLlwiKSxcblx0XHRcdGFueU9mOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHR0eXBlOiBbJ3N0cmluZycsICdib29sZWFuJ10sXG5cdFx0XHRcdFx0ZW51bTogWydtYXJrZXRwbGFjZScsIGZhbHNlXVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0XVxuXHRcdH0sXG5cdFx0ZXh0ZW5zaW9uRGVwZW5kZW5jaWVzOiB7XG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmV4dGVuc2lvbkRlcGVuZGVuY2llcycsICdEZXBlbmRlbmNpZXMgdG8gb3RoZXIgZXh0ZW5zaW9ucy4gVGhlIGlkZW50aWZpZXIgb2YgYW4gZXh0ZW5zaW9uIGlzIGFsd2F5cyAke3B1Ymxpc2hlcn0uJHtuYW1lfS4gRm9yIGV4YW1wbGU6IHZzY29kZS5jc2hhcnAuJyksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0dW5pcXVlSXRlbXM6IHRydWUsXG5cdFx0XHRpdGVtczoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0cGF0dGVybjogRVhURU5TSU9OX0lERU5USUZJRVJfUEFUVEVSTlxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0ZXh0ZW5zaW9uUGFjazoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5leHRlbnNpb25QYWNrJywgXCJBIHNldCBvZiBleHRlbnNpb25zIHRoYXQgY2FuIGJlIGluc3RhbGxlZCB0b2dldGhlci4gVGhlIGlkZW50aWZpZXIgb2YgYW4gZXh0ZW5zaW9uIGlzIGFsd2F5cyAke3B1Ymxpc2hlcn0uJHtuYW1lfS4gRm9yIGV4YW1wbGU6IHZzY29kZS5jc2hhcnAuXCIpLFxuXHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdHVuaXF1ZUl0ZW1zOiB0cnVlLFxuXHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRcdHBhdHRlcm46IEVYVEVOU0lPTl9JREVOVElGSUVSX1BBVFRFUk5cblx0XHRcdH1cblx0XHR9LFxuXHRcdGV4dGVuc2lvbktpbmQ6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4dGVuc2lvbktpbmQnLCBcIkRlZmluZSB0aGUga2luZCBvZiBhbiBleHRlbnNpb24uIGB1aWAgZXh0ZW5zaW9ucyBhcmUgaW5zdGFsbGVkIGFuZCBydW4gb24gdGhlIGxvY2FsIG1hY2hpbmUgd2hpbGUgYHdvcmtzcGFjZWAgZXh0ZW5zaW9ucyBydW4gb24gdGhlIHJlbW90ZS5cIiksXG5cdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0aXRlbXM6IGV4dGVuc2lvbktpbmRTY2hlbWEsXG5cdFx0XHRkZWZhdWx0OiBbJ3dvcmtzcGFjZSddLFxuXHRcdFx0ZGVmYXVsdFNuaXBwZXRzOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRib2R5OiBbJ3VpJ10sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uS2luZC51aScsIFwiRGVmaW5lIGFuIGV4dGVuc2lvbiB3aGljaCBjYW4gcnVuIG9ubHkgb24gdGhlIGxvY2FsIG1hY2hpbmUgd2hlbiBjb25uZWN0ZWQgdG8gcmVtb3RlIHdpbmRvdy5cIilcblx0XHRcdFx0fSxcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGJvZHk6IFsnd29ya3NwYWNlJ10sXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgnZXh0ZW5zaW9uS2luZC53b3Jrc3BhY2UnLCBcIkRlZmluZSBhbiBleHRlbnNpb24gd2hpY2ggY2FuIHJ1biBvbmx5IG9uIHRoZSByZW1vdGUgbWFjaGluZSB3aGVuIGNvbm5lY3RlZCByZW1vdGUgd2luZG93LlwiKVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0Ym9keTogWyd1aScsICd3b3Jrc3BhY2UnXSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleHRlbnNpb25LaW5kLnVpLXdvcmtzcGFjZScsIFwiRGVmaW5lIGFuIGV4dGVuc2lvbiB3aGljaCBjYW4gcnVuIG9uIGVpdGhlciBzaWRlLCB3aXRoIGEgcHJlZmVyZW5jZSB0b3dhcmRzIHJ1bm5pbmcgb24gdGhlIGxvY2FsIG1hY2hpbmUuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRib2R5OiBbJ3dvcmtzcGFjZScsICd1aSddLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ2V4dGVuc2lvbktpbmQud29ya3NwYWNlLXVpJywgXCJEZWZpbmUgYW4gZXh0ZW5zaW9uIHdoaWNoIGNhbiBydW4gb24gZWl0aGVyIHNpZGUsIHdpdGggYSBwcmVmZXJlbmNlIHRvd2FyZHMgcnVubmluZyBvbiB0aGUgcmVtb3RlIG1hY2hpbmUuXCIpXG5cdFx0XHRcdH0sXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRib2R5OiBbXSxcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCdleHRlbnNpb25LaW5kLmVtcHR5JywgXCJEZWZpbmUgYW4gZXh0ZW5zaW9uIHdoaWNoIGNhbm5vdCBydW4gaW4gYSByZW1vdGUgY29udGV4dCwgbmVpdGhlciBvbiB0aGUgbG9jYWwsIG5vciBvbiB0aGUgcmVtb3RlIG1hY2hpbmUuXCIpXG5cdFx0XHRcdH1cblx0XHRcdF1cblx0XHR9LFxuXHRcdGNhcGFiaWxpdGllczoge1xuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXBhYmlsaXRpZXMnLCBcIkRlY2xhcmUgdGhlIHNldCBvZiBzdXBwb3J0ZWQgY2FwYWJpbGl0aWVzIGJ5IHRoZSBleHRlbnNpb24uXCIpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdHZpcnR1YWxXb3Jrc3BhY2VzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXBhYmlsaXRpZXMudmlydHVhbFdvcmtzcGFjZXMnLCBcIkRlY2xhcmVzIHdoZXRoZXIgdGhlIGV4dGVuc2lvbiBzaG91bGQgYmUgZW5hYmxlZCBpbiB2aXJ0dWFsIHdvcmtzcGFjZXMuIEEgdmlydHVhbCB3b3Jrc3BhY2UgaXMgYSB3b3Jrc3BhY2Ugd2hpY2ggaXMgbm90IGJhY2tlZCBieSBhbnkgb24tZGlzayByZXNvdXJjZXMuIFdoZW4gZmFsc2UsIHRoaXMgZXh0ZW5zaW9uIHdpbGwgYmUgYXV0b21hdGljYWxseSBkaXNhYmxlZCBpbiB2aXJ0dWFsIHdvcmtzcGFjZXMuIERlZmF1bHQgaXMgdHJ1ZS5cIiksXG5cdFx0XHRcdFx0dHlwZTogWydib29sZWFuJywgJ29iamVjdCddLFxuXHRcdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW1xuXHRcdFx0XHRcdFx0eyBsYWJlbDogJ2xpbWl0ZWQnLCBib2R5OiB7IHN1cHBvcnRlZDogJyR7MTpsaW1pdGVkfScsIGRlc2NyaXB0aW9uOiAnJHsyfScgfSB9LFxuXHRcdFx0XHRcdFx0eyBsYWJlbDogJ2ZhbHNlJywgYm9keTogeyBzdXBwb3J0ZWQ6IGZhbHNlLCBkZXNjcmlwdGlvbjogJyR7Mn0nIH0gfSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdGRlZmF1bHQ6IHRydWUudmFsdWVPZixcblx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRzdXBwb3J0ZWQ6IHtcblx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy52aXJ0dWFsV29ya3NwYWNlcy5zdXBwb3J0ZWQnLCBcIkRlY2xhcmVzIHRoZSBsZXZlbCBvZiBzdXBwb3J0IGZvciB2aXJ0dWFsIHdvcmtzcGFjZXMgYnkgdGhlIGV4dGVuc2lvbi5cIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ2Jvb2xlYW4nXSxcblx0XHRcdFx0XHRcdFx0ZW51bTogWydsaW1pdGVkJywgdHJ1ZSwgZmFsc2VdLFxuXHRcdFx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy52aXJ0dWFsV29ya3NwYWNlcy5zdXBwb3J0ZWQubGltaXRlZCcsIFwiVGhlIGV4dGVuc2lvbiB3aWxsIGJlIGVuYWJsZWQgaW4gdmlydHVhbCB3b3Jrc3BhY2VzIHdpdGggc29tZSBmdW5jdGlvbmFsaXR5IGRpc2FibGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY2FwYWJpbGl0aWVzLnZpcnR1YWxXb3Jrc3BhY2VzLnN1cHBvcnRlZC50cnVlJywgXCJUaGUgZXh0ZW5zaW9uIHdpbGwgYmUgZW5hYmxlZCBpbiB2aXJ0dWFsIHdvcmtzcGFjZXMgd2l0aCBhbGwgZnVuY3Rpb25hbGl0eSBlbmFibGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY2FwYWJpbGl0aWVzLnZpcnR1YWxXb3Jrc3BhY2VzLnN1cHBvcnRlZC5mYWxzZScsIFwiVGhlIGV4dGVuc2lvbiB3aWxsIG5vdCBiZSBlbmFibGVkIGluIHZpcnR1YWwgd29ya3NwYWNlcy5cIiksXG5cdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy52aXJ0dWFsV29ya3NwYWNlcy5kZXNjcmlwdGlvbicsIFwiQSBkZXNjcmlwdGlvbiBvZiBob3cgdmlydHVhbCB3b3Jrc3BhY2VzIGFmZmVjdHMgdGhlIGV4dGVuc2lvbnMgYmVoYXZpb3IgYW5kIHdoeSBpdCBpcyBuZWVkZWQuIFRoaXMgb25seSBhcHBsaWVzIHdoZW4gYHN1cHBvcnRlZGAgaXMgbm90IGB0cnVlYC5cIiksXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LFxuXHRcdFx0XHR1bnRydXN0ZWRXb3Jrc3BhY2VzOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXBhYmlsaXRpZXMudW50cnVzdGVkV29ya3NwYWNlcycsICdEZWNsYXJlcyBob3cgdGhlIGV4dGVuc2lvbiBzaG91bGQgYmUgaGFuZGxlZCBpbiB1bnRydXN0ZWQgd29ya3NwYWNlcy4nKSxcblx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRyZXF1aXJlZDogWydzdXBwb3J0ZWQnXSxcblx0XHRcdFx0XHRkZWZhdWx0U25pcHBldHM6IFtcblx0XHRcdFx0XHRcdHsgYm9keTogeyBzdXBwb3J0ZWQ6ICckezE6bGltaXRlZH0nLCBkZXNjcmlwdGlvbjogJyR7Mn0nIH0gfSxcblx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdHN1cHBvcnRlZDoge1xuXHRcdFx0XHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY2FwYWJpbGl0aWVzLnVudHJ1c3RlZFdvcmtzcGFjZXMuc3VwcG9ydGVkJywgXCJEZWNsYXJlcyB0aGUgbGV2ZWwgb2Ygc3VwcG9ydCBmb3IgdW50cnVzdGVkIHdvcmtzcGFjZXMgYnkgdGhlIGV4dGVuc2lvbi5cIiksXG5cdFx0XHRcdFx0XHRcdHR5cGU6IFsnc3RyaW5nJywgJ2Jvb2xlYW4nXSxcblx0XHRcdFx0XHRcdFx0ZW51bTogWydsaW1pdGVkJywgdHJ1ZSwgZmFsc2VdLFxuXHRcdFx0XHRcdFx0XHRlbnVtRGVzY3JpcHRpb25zOiBbXG5cdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy51bnRydXN0ZWRXb3Jrc3BhY2VzLnN1cHBvcnRlZC5saW1pdGVkJywgXCJUaGUgZXh0ZW5zaW9uIHdpbGwgYmUgZW5hYmxlZCBpbiB1bnRydXN0ZWQgd29ya3NwYWNlcyB3aXRoIHNvbWUgZnVuY3Rpb25hbGl0eSBkaXNhYmxlZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0bmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy51bnRydXN0ZWRXb3Jrc3BhY2VzLnN1cHBvcnRlZC50cnVlJywgXCJUaGUgZXh0ZW5zaW9uIHdpbGwgYmUgZW5hYmxlZCBpbiB1bnRydXN0ZWQgd29ya3NwYWNlcyB3aXRoIGFsbCBmdW5jdGlvbmFsaXR5IGVuYWJsZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXBhYmlsaXRpZXMudW50cnVzdGVkV29ya3NwYWNlcy5zdXBwb3J0ZWQuZmFsc2UnLCBcIlRoZSBleHRlbnNpb24gd2lsbCBub3QgYmUgZW5hYmxlZCBpbiB1bnRydXN0ZWQgd29ya3NwYWNlcy5cIiksXG5cdFx0XHRcdFx0XHRcdF1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRyZXN0cmljdGVkQ29uZmlndXJhdGlvbnM6IHtcblx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jYXBhYmlsaXRpZXMudW50cnVzdGVkV29ya3NwYWNlcy5yZXN0cmljdGVkQ29uZmlndXJhdGlvbnMnLCBcIkEgbGlzdCBvZiBjb25maWd1cmF0aW9uIGtleXMgY29udHJpYnV0ZWQgYnkgdGhlIGV4dGVuc2lvbiB0aGF0IHNob3VsZCBub3QgdXNlIHdvcmtzcGFjZSB2YWx1ZXMgaW4gdW50cnVzdGVkIHdvcmtzcGFjZXMuXCIpLFxuXHRcdFx0XHRcdFx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdFx0XHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmNhcGFiaWxpdGllcy51bnRydXN0ZWRXb3Jrc3BhY2VzLmRlc2NyaXB0aW9uJywgXCJBIGRlc2NyaXB0aW9uIG9mIGhvdyB3b3Jrc3BhY2UgdHJ1c3QgYWZmZWN0cyB0aGUgZXh0ZW5zaW9ucyBiZWhhdmlvciBhbmQgd2h5IGl0IGlzIG5lZWRlZC4gVGhpcyBvbmx5IGFwcGxpZXMgd2hlbiBgc3VwcG9ydGVkYCBpcyBub3QgYHRydWVgLlwiKSxcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9LFxuXHRcdHNwb25zb3I6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuc3BvbnNvcicsIFwiU3BlY2lmeSB0aGUgbG9jYXRpb24gZnJvbSB3aGVyZSB1c2VycyBjYW4gc3BvbnNvciB5b3VyIGV4dGVuc2lvbi5cIiksXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW1xuXHRcdFx0XHR7IGJvZHk6IHsgdXJsOiAnJHsxOmh0dHBzOn0nIH0gfSxcblx0XHRcdF0sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCd1cmwnOiB7XG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSgndnNjb2RlLmV4dGVuc2lvbi5jb250cmlidXRlcy5zcG9uc29yLnVybCcsIFwiVVJMIGZyb20gd2hlcmUgdXNlcnMgY2FuIHNwb25zb3IgeW91ciBleHRlbnNpb24uIEl0IG11c3QgYmUgYSB2YWxpZCBVUkwgd2l0aCBhIEhUVFAgb3IgSFRUUFMgcHJvdG9jb2wuIEV4YW1wbGUgdmFsdWU6IGh0dHBzOi8vZ2l0aHViLmNvbS9zcG9uc29ycy9udmFjY2Vzc1wiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0c2NyaXB0czoge1xuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdCd2c2NvZGU6cHJlcHVibGlzaCc6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLnNjcmlwdHMucHJlcHVibGlzaCcsICdTY3JpcHQgZXhlY3V0ZWQgYmVmb3JlIHRoZSBwYWNrYWdlIGlzIHB1Ymxpc2hlZCBhcyBhIFZTIENvZGUgZXh0ZW5zaW9uLicpLFxuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnXG5cdFx0XHRcdH0sXG5cdFx0XHRcdCd2c2NvZGU6dW5pbnN0YWxsJzoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uc2NyaXB0cy51bmluc3RhbGwnLCAnVW5pbnN0YWxsIGhvb2sgZm9yIFZTIENvZGUgZXh0ZW5zaW9uLiBTY3JpcHQgdGhhdCBnZXRzIGV4ZWN1dGVkIHdoZW4gdGhlIGV4dGVuc2lvbiBpcyBjb21wbGV0ZWx5IHVuaW5zdGFsbGVkIGZyb20gVlMgQ29kZSB3aGljaCBpcyB3aGVuIFZTIENvZGUgaXMgcmVzdGFydGVkIChzaHV0ZG93biBhbmQgc3RhcnQpIGFmdGVyIHRoZSBleHRlbnNpb24gaXMgdW5pbnN0YWxsZWQuIE9ubHkgTm9kZSBzY3JpcHRzIGFyZSBzdXBwb3J0ZWQuJyksXG5cdFx0XHRcdFx0dHlwZTogJ3N0cmluZydcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sXG5cdFx0aWNvbjoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRkZXNjcmlwdGlvbjogbmxzLmxvY2FsaXplKCd2c2NvZGUuZXh0ZW5zaW9uLmljb24nLCAnVGhlIHBhdGggdG8gYSAxMjh4MTI4IHBpeGVsIGljb24uJylcblx0XHR9LFxuXHRcdGwxMG46IHtcblx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0ZGVzY3JpcHRpb246IG5scy5sb2NhbGl6ZSh7XG5cdFx0XHRcdGtleTogJ3ZzY29kZS5leHRlbnNpb24ubDEwbicsXG5cdFx0XHRcdGNvbW1lbnQ6IFtcblx0XHRcdFx0XHQne0xvY2tlZD1cImJ1bmRsZS5sMTBuLl9sb2NhbGVfLmpzb25cIn0nLFxuXHRcdFx0XHRcdCd7TG9ja2VkPVwidnNjb2RlLmwxMG4gQVBJXCJ9J1xuXHRcdFx0XHRdXG5cdFx0XHR9LCAnVGhlIHJlbGF0aXZlIHBhdGggdG8gYSBmb2xkZXIgY29udGFpbmluZyBsb2NhbGl6YXRpb24gKGJ1bmRsZS5sMTBuLiouanNvbikgZmlsZXMuIE11c3QgYmUgc3BlY2lmaWVkIGlmIHlvdSBhcmUgdXNpbmcgdGhlIHZzY29kZS5sMTBuIEFQSS4nKVxuXHRcdH0sXG5cdFx0cHJpY2luZzoge1xuXHRcdFx0dHlwZTogJ3N0cmluZycsXG5cdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24ucHJpY2luZycsICdUaGUgcHJpY2luZyBpbmZvcm1hdGlvbiBmb3IgdGhlIGV4dGVuc2lvbi4gQ2FuIGJlIEZyZWUgKGRlZmF1bHQpIG9yIFRyaWFsLiBGb3IgbW9yZSBkZXRhaWxzIHZpc2l0OiBodHRwczovL2NvZGUudmlzdWFsc3R1ZGlvLmNvbS9hcGkvd29ya2luZy13aXRoLWV4dGVuc2lvbnMvcHVibGlzaGluZy1leHRlbnNpb24jZXh0ZW5zaW9uLXByaWNpbmctbGFiZWwnKSxcblx0XHRcdGVudW06IFsnRnJlZScsICdUcmlhbCddLFxuXHRcdFx0ZGVmYXVsdDogJ0ZyZWUnXG5cdFx0fVxuXHR9XG59O1xuXG5leHBvcnQgdHlwZSByZW1vdmVBcnJheTxUPiA9IFQgZXh0ZW5kcyBBcnJheTxpbmZlciBYPiA/IFggOiBUO1xuXG5leHBvcnQgaW50ZXJmYWNlIElFeHRlbnNpb25Qb2ludERlc2NyaXB0b3I8VD4ge1xuXHRleHRlbnNpb25Qb2ludDogc3RyaW5nO1xuXHRkZXBzPzogSUV4dGVuc2lvblBvaW50PGFueT5bXTtcblx0anNvblNjaGVtYTogSUpTT05TY2hlbWE7XG5cdGRlZmF1bHRFeHRlbnNpb25LaW5kPzogRXh0ZW5zaW9uS2luZFtdO1xuXHRjYW5IYW5kbGVSZXNvbHZlcj86IGJvb2xlYW47XG5cdC8qKlxuXHQgKiBBIGZ1bmN0aW9uIHdoaWNoIHJ1bnMgYmVmb3JlIHRoZSBleHRlbnNpb24gcG9pbnQgaGFzIGJlZW4gdmFsaWRhdGVkIGFuZCB3aGljaFxuXHQgKiBzaG91bGQgY29sbGVjdCBhdXRvbWF0aWMgYWN0aXZhdGlvbiBldmVudHMgZnJvbSB0aGUgY29udHJpYnV0aW9uLlxuXHQgKi9cblx0YWN0aXZhdGlvbkV2ZW50c0dlbmVyYXRvcj86IElBY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yPHJlbW92ZUFycmF5PFQ+Pjtcbn1cblxuZXhwb3J0IGNsYXNzIEV4dGVuc2lvbnNSZWdpc3RyeUltcGwge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvblBvaW50cyA9IG5ldyBNYXA8c3RyaW5nLCBFeHRlbnNpb25Qb2ludDxhbnk+PigpO1xuXG5cdHB1YmxpYyByZWdpc3RlckV4dGVuc2lvblBvaW50PFQ+KGRlc2M6IElFeHRlbnNpb25Qb2ludERlc2NyaXB0b3I8VD4pOiBJRXh0ZW5zaW9uUG9pbnQ8VD4ge1xuXHRcdGlmICh0aGlzLl9leHRlbnNpb25Qb2ludHMuaGFzKGRlc2MuZXh0ZW5zaW9uUG9pbnQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0R1cGxpY2F0ZSBleHRlbnNpb24gcG9pbnQ6ICcgKyBkZXNjLmV4dGVuc2lvblBvaW50KTtcblx0XHR9XG5cdFx0Y29uc3QgcmVzdWx0ID0gbmV3IEV4dGVuc2lvblBvaW50PFQ+KGRlc2MuZXh0ZW5zaW9uUG9pbnQsIGRlc2MuZGVmYXVsdEV4dGVuc2lvbktpbmQsIGRlc2MuY2FuSGFuZGxlUmVzb2x2ZXIpO1xuXHRcdHRoaXMuX2V4dGVuc2lvblBvaW50cy5zZXQoZGVzYy5leHRlbnNpb25Qb2ludCwgcmVzdWx0KTtcblx0XHRpZiAoZGVzYy5hY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yKSB7XG5cdFx0XHRJbXBsaWNpdEFjdGl2YXRpb25FdmVudHMucmVnaXN0ZXIoZGVzYy5leHRlbnNpb25Qb2ludCwgZGVzYy5hY3RpdmF0aW9uRXZlbnRzR2VuZXJhdG9yKTtcblx0XHR9XG5cblx0XHRzY2hlbWEucHJvcGVydGllcyFbJ2NvbnRyaWJ1dGVzJ10ucHJvcGVydGllcyFbZGVzYy5leHRlbnNpb25Qb2ludF0gPSBkZXNjLmpzb25TY2hlbWE7XG5cdFx0c2NoZW1hUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWEoc2NoZW1hSWQsIHNjaGVtYSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldEV4dGVuc2lvblBvaW50cygpOiBFeHRlbnNpb25Qb2ludDxhbnk+W10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuX2V4dGVuc2lvblBvaW50cy52YWx1ZXMoKSk7XG5cdH1cbn1cblxuY29uc3QgUFJFeHRlbnNpb25zID0ge1xuXHRFeHRlbnNpb25zUmVnaXN0cnk6ICdFeHRlbnNpb25zUmVnaXN0cnknXG59O1xuUmVnaXN0cnkuYWRkKFBSRXh0ZW5zaW9ucy5FeHRlbnNpb25zUmVnaXN0cnksIG5ldyBFeHRlbnNpb25zUmVnaXN0cnlJbXBsKCkpO1xuZXhwb3J0IGNvbnN0IEV4dGVuc2lvbnNSZWdpc3RyeTogRXh0ZW5zaW9uc1JlZ2lzdHJ5SW1wbCA9IFJlZ2lzdHJ5LmFzKFBSRXh0ZW5zaW9ucy5FeHRlbnNpb25zUmVnaXN0cnkpO1xuXG5zY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYShzY2hlbWFJZCwgc2NoZW1hKTtcblxuXG5zY2hlbWFSZWdpc3RyeS5yZWdpc3RlclNjaGVtYShwcm9kdWN0U2NoZW1hSWQsIHtcblx0cHJvcGVydGllczoge1xuXHRcdGV4dGVuc2lvbkVuYWJsZWRBcGlQcm9wb3NhbHM6IHtcblx0XHRcdGRlc2NyaXB0aW9uOiBubHMubG9jYWxpemUoJ3Byb2R1Y3QuZXh0ZW5zaW9uRW5hYmxlZEFwaVByb3Bvc2FscycsIFwiQVBJIHByb3Bvc2FscyB0aGF0IHRoZSByZXNwZWN0aXZlIGV4dGVuc2lvbnMgY2FuIGZyZWVseSB1c2UuXCIpLFxuXHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRwcm9wZXJ0aWVzOiB7fSxcblx0XHRcdGFkZGl0aW9uYWxQcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdGFueU9mOiBbe1xuXHRcdFx0XHRcdHR5cGU6ICdhcnJheScsXG5cdFx0XHRcdFx0dW5pcXVlSXRlbXM6IHRydWUsXG5cdFx0XHRcdFx0aXRlbXM6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZW51bTogT2JqZWN0LmtleXMoYWxsQXBpUHJvcG9zYWxzKSxcblx0XHRcdFx0XHRcdG1hcmtkb3duRW51bURlc2NyaXB0aW9uczogT2JqZWN0LnZhbHVlcyhhbGxBcGlQcm9wb3NhbHMpLm1hcCh2YWx1ZSA9PiB2YWx1ZS5wcm9wb3NhbClcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1dXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFlBQVksU0FBUztBQUNyQixTQUFTLHlCQUF5QjtBQUVsQyxPQUFPLGNBQWM7QUFDckIsU0FBUyxvQ0FBb0M7QUFDN0MsU0FBUyxrQkFBNkM7QUFDdEQsU0FBUyxnQkFBZ0I7QUFFekIsU0FBZ0Msc0JBQXNCLDhCQUE4QjtBQUVwRixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGdDQUE0RDtBQUVyRSxTQUFTLHVCQUF1QjtBQUVoQyxNQUFNLGlCQUFpQixTQUFTLEdBQThCLFdBQVcsZ0JBQWdCO0FBRWxGLE1BQU0sMEJBQTBCO0FBQUEsRUFNdEMsWUFDQyxnQkFDQSxXQUNBLGtCQUNDO0FBQ0QsU0FBSyxrQkFBa0I7QUFDdkIsU0FBSyxhQUFhO0FBQ2xCLFNBQUssb0JBQW9CO0FBQUEsRUFDMUI7QUFBQSxFQUVRLEtBQUssTUFBZ0IsU0FBdUI7QUFDbkQsU0FBSyxnQkFBZ0I7QUFBQSxNQUNwQjtBQUFBLE1BQ0E7QUFBQSxNQUNBLGFBQWEsS0FBSyxXQUFXO0FBQUEsTUFDN0Isa0JBQWtCLEtB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
