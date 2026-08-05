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
import { WorkbenchPhase, Extensions as WorkbenchExtensions, registerWorkbenchContribution2 } from "../../../common/contributions.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { LifecyclePhase } from "../../../services/lifecycle/common/lifecycle.js";
import { ILabelService } from "../../../../platform/label/common/label.js";
import { OperatingSystem, isWeb, OS } from "../../../../base/common/platform.js";
import { Schemas } from "../../../../base/common/network.js";
import { IRemoteAgentService } from "../../../services/remote/common/remoteAgentService.js";
import { ILoggerService } from "../../../../platform/log/common/log.js";
import { localize, localize2 } from "../../../../nls.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { Extensions as ConfigurationExtensions } from "../../../../platform/configuration/common/configurationRegistry.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IDialogService, IFileDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { Action2, registerAction2 } from "../../../../platform/actions/common/actions.js";
import { Categories } from "../../../../platform/action/common/actionCommonCategories.js";
import { PersistentConnection } from "../../../../platform/remote/common/remoteAgentConnection.js";
import { IDownloadService } from "../../../../platform/download/common/download.js";
import { DownloadServiceChannel } from "../../../../platform/download/common/downloadIpc.js";
import { RemoteLoggerChannelClient } from "../../../../platform/log/common/logIpc.js";
import { REMOTE_DEFAULT_IF_LOCAL_EXTENSIONS } from "../../../../platform/remote/common/remote.js";
import product from "../../../../platform/product/common/product.js";
const EXTENSION_IDENTIFIER_PATTERN = "([a-z0-9A-Z][a-z0-9-A-Z]*)\\.([a-z0-9A-Z][a-z0-9-A-Z]*)$";
let LabelContribution = class {
  constructor(labelService, remoteAgentService) {
    this.labelService = labelService;
    this.remoteAgentService = remoteAgentService;
    this.registerFormatters();
  }
  registerFormatters() {
    this.remoteAgentService.getEnvironment().then((remoteEnvironment) => {
      const os = remoteEnvironment?.os || OS;
      const formatting = {
        label: "${path}",
        separator: os === OperatingSystem.Windows ? "\\" : "/",
        tildify: os !== OperatingSystem.Windows,
        normalizeDriveLetter: os === OperatingSystem.Windows,
        workspaceSuffix: isWeb ? void 0 : Schemas.vscodeRemote
      };
      this.labelService.registerFormatter({
        scheme: Schemas.vscodeRemote,
        formatting
      });
      if (remoteEnvironment) {
        this.labelService.registerFormatter({
          scheme: Schemas.vscodeUserData,
          formatting
        });
      }
    });
  }
};
LabelContribution.ID = "workbench.contrib.remoteLabel";
LabelContribution = __decorateClass([
  __decorateParam(0, ILabelService),
  __decorateParam(1, IRemoteAgentService)
], LabelContribution);
let RemoteChannelsContribution = class extends Disposable {
  constructor(remoteAgentService, downloadService, loggerService) {
    super();
    const connection = remoteAgentService.getConnection();
    if (connection) {
      connection.registerChannel("download", new DownloadServiceChannel(downloadService));
      connection.withChannel("logger", async (channel) => this._register(new RemoteLoggerChannelClient(loggerService, channel)));
    }
  }
};
RemoteChannelsContribution = __decorateClass([
  __decorateParam(0, IRemoteAgentService),
  __decorateParam(1, IDownloadService),
  __decorateParam(2, ILoggerService)
], RemoteChannelsContribution);
let RemoteInvalidWorkspaceDetector = class extends Disposable {
  constructor(fileService, dialogService, environmentService, contextService, fileDialogService, remoteAgentService) {
    super();
    this.fileService = fileService;
    this.dialogService = dialogService;
    this.environmentService = environmentService;
    this.contextService = contextService;
    this.fileDialogService = fileDialogService;
    if (this.environmentService.remoteAuthority) {
      remoteAgentService.getEnvironment().then((remoteEnv) => {
        if (remoteEnv) {
          this.validateRemoteWorkspace();
        }
      });
    }
  }
  async validateRemoteWorkspace() {
    const workspace = this.contextService.getWorkspace();
    const workspaceUriToStat = workspace.configuration ?? workspace.folders.at(0)?.uri;
    if (!workspaceUriToStat) {
      return;
    }
    const exists = await this.fileService.exists(workspaceUriToStat);
    if (exists) {
      return;
    }
    const res = await this.dialogService.confirm({
      type: "warning",
      message: localize("invalidWorkspaceMessage", "Workspace does not exist"),
      detail: localize("invalidWorkspaceDetail", "Please select another workspace to open."),
      primaryButton: localize({ key: "invalidWorkspacePrimary", comment: ["&& denotes a mnemonic"] }, "&&Open Workspace...")
    });
    if (res.confirmed) {
      if (workspace.configuration) {
        return this.fileDialogService.pickWorkspaceAndOpen({});
      }
      return this.fileDialogService.pickFolderAndOpen({});
    }
  }
};
RemoteInvalidWorkspaceDetector.ID = "workbench.contrib.remoteInvalidWorkspaceDetector";
RemoteInvalidWorkspaceDetector = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IDialogService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IWorkspaceContextService),
  __decorateParam(4, IFileDialogService),
  __decorateParam(5, IRemoteAgentService)
], RemoteInvalidWorkspaceDetector);
const workbenchContributionsRegistry = Registry.as(WorkbenchExtensions.Workbench);
registerWorkbenchContribution2(LabelContribution.ID, LabelContribution, WorkbenchPhase.BlockStartup);
workbenchContributionsRegistry.registerWorkbenchContribution(RemoteChannelsContribution, LifecyclePhase.Restored);
registerWorkbenchContribution2(RemoteInvalidWorkspaceDetector.ID, RemoteInvalidWorkspaceDetector, WorkbenchPhase.BlockStartup);
const enableDiagnostics = true;
if (enableDiagnostics) {
  class TriggerReconnectAction extends Action2 {
    constructor() {
      super({
        id: "workbench.action.triggerReconnect",
        title: localize2("triggerReconnect", "Connection: Trigger Reconnect"),
        category: Categories.Developer,
        f1: true
      });
    }
    async run(accessor) {
      PersistentConnection.debugTriggerReconnection();
    }
  }
  class PauseSocketWriting extends Action2 {
    constructor() {
      super({
        id: "workbench.action.pauseSocketWriting",
        title: localize2("pauseSocketWriting", "Connection: Pause socket writing"),
        category: Categories.Developer,
        f1: true
      });
    }
    async run(accessor) {
      PersistentConnection.debugPauseSocketWriting();
    }
  }
  registerAction2(TriggerReconnectAction);
  registerAction2(PauseSocketWriting);
}
const extensionKindSchema = {
  type: "string",
  enum: [
    "ui",
    "workspace"
  ],
  enumDescriptions: [
    localize("ui", "UI extension kind. In a remote window, such extensions are enabled only when available on the local machine."),
    localize("workspace", "Workspace extension kind. In a remote window, such extensions are enabled only when available on the remote.")
  ]
};
Registry.as(ConfigurationExtensions.Configuration).registerConfiguration({
  id: "remote",
  title: localize("remote", "Remote"),
  type: "object",
  properties: {
    "remote.extensionKind": {
      type: "object",
      markdownDescription: localize("remote.extensionKind", "Override the kind of an extension. `ui` extensions are installed and run on the local machine while `workspace` extensions are run on the remote. By overriding an extension's default kind using this setting, you specify if that extension should be installed and enabled locally or remotely."),
      patternProperties: {
        [EXTENSION_IDENTIFIER_PATTERN]: {
          oneOf: [{ type: "array", items: extensionKindSchema }, extensionKindSchema],
          default: ["ui"]
        }
      },
      default: {
        "pub.name": ["ui"]
      }
    },
    "remote.restoreForwardedPorts": {
      type: "boolean",
      markdownDescription: localize("remote.restoreForwardedPorts", "Restores the ports you forwarded in a workspace."),
      default: true
    },
    "remote.autoForwardPorts": {
      type: "boolean",
      markdownDescription: localize("remote.autoForwardPorts", "When enabled, new running processes are detected and ports that they listen on are automatically forwarded. Disabling this setting will not prevent all ports from being forwarded. Even when disabled, extensions will still be able to cause ports to be forwarded, and opening some URLs will still cause ports to forwarded. Also see {0}.", "`#remote.autoForwardPortsSource#`"),
      default: true
    },
    "remote.autoForwardPortsSource": {
      type: "string",
      markdownDescription: localize("remote.autoForwardPortsSource", "Sets the source from which ports are automatically forwarded when {0} is true. When {0} is false, {1} will be used to find information about ports that have already been forwarded. On Windows and macOS remotes, the `process` and `hybrid` options have no effect and `output` will be used.", "`#remote.autoForwardPorts#`", "`#remote.autoForwardPortsSource#`"),
      enum: ["process", "output", "hybrid"],
      enumDescriptions: [
        localize("remote.autoForwardPortsSource.process", "Ports will be automatically forwarded when discovered by watching for processes that are started and include a port."),
        localize("remote.autoForwardPortsSource.output", 'Ports will be automatically forwarded when discovered by reading terminal and debug output. Not all processes that use ports will print to the integrated terminal or debug console, so some ports will be missed. Ports forwarded based on output will not be "un-forwarded" until reload or until the port is closed by the user in the Ports view.'),
        localize("remote.autoForwardPortsSource.hybrid", 'Ports will be automatically forwarded when discovered by reading terminal and debug output. Not all processes that use ports will print to the integrated terminal or debug console, so some ports will be missed. Ports will be "un-forwarded" by watching for processes that listen on that port to be terminated.')
      ],
      default: "process"
    },
    "remote.autoForwardPortsFallback": {
      type: "number",
      default: 20,
      markdownDescription: localize("remote.autoForwardPortFallback", "The number of auto forwarded ports that will trigger the switch from `process` to `hybrid` when automatically forwarding ports and `remote.autoForwardPortsSource` is set to `process` by default. Set to `0` to disable the fallback. When `remote.autoForwardPortsFallback` hasn't been configured, but `remote.autoForwardPortsSource` has, `remote.autoForwardPortsFallback` will be treated as though it's set to `0`.")
    },
    "remote.forwardOnOpen": {
      type: "boolean",
      description: localize("remote.forwardOnClick", "Controls whether local URLs with a port will be forwarded when opened from the terminal and the debug console."),
      default: true
    },
    // Consider making changes to extensions\configuration-editing\schemas\devContainer.schema.src.json
    // and extensions\configuration-editing\schemas\attachContainer.schema.json
    // to keep in sync with devcontainer.json schema.
    "remote.portsAttributes": {
      type: "object",
      patternProperties: {
        "(^\\d+(-\\d+)?$)|(.+)": {
          type: "object",
          description: localize("remote.portsAttributes.port", 'A port, range of ports (ex. "40000-55000"), host and port (ex. "db:1234"), or regular expression (ex. ".+\\\\/server.js").  For a port number or range, the attributes will apply to that port number or range of port numbers. Attributes which use a regular expression will apply to ports whose associated process command line matches the expression.'),
          properties: {
            "onAutoForward": {
              type: "string",
              enum: ["notify", "openBrowser", "openBrowserOnce", "openPreview", "silent", "ignore"],
              enumDescriptions: [
                localize("remote.portsAttributes.notify", "Shows a notification when a port is automatically forwarded."),
                localize("remote.portsAttributes.openBrowser", "Opens the browser when the port is automatically forwarded. Depending on your settings, this could open an embedded browser."),
                localize("remote.portsAttributes.openBrowserOnce", "Opens the browser when the port is automatically forwarded, but only the first time the port is forward during a session. Depending on your settings, this could open an embedded browser."),
                localize("remote.portsAttributes.openPreview", "Opens a preview in the same window when the port is automatically forwarded."),
                localize("remote.portsAttributes.silent", "Shows no notification and takes no action when this port is automatically forwarded."),
                localize("remote.portsAttributes.ignore", "This port will not be automatically forwarded.")
              ],
              description: localize("remote.portsAttributes.onForward", "Defines the action that occurs when the port is discovered for automatic forwarding"),
              default: "notify"
            },
            "elevateIfNeeded": {
              type: "boolean",
              description: localize("remote.portsAttributes.elevateIfNeeded", "Automatically prompt for elevation (if needed) when this port is forwarded. Elevate is required if the local port is a privileged port."),
              default: false
            },
            "label": {
              type: "string",
              description: localize("remote.portsAttributes.label", "Label that will be shown in the UI for this port."),
              default: localize("remote.portsAttributes.labelDefault", "Application")
            },
            "requireLocalPort": {
              type: "boolean",
              markdownDescription: localize("remote.portsAttributes.requireLocalPort", "When true, a modal dialog will show if the chosen local port isn't used for forwarding."),
              default: false
            },
            "protocol": {
              type: "string",
              enum: ["http", "https"],
              description: localize("remote.portsAttributes.protocol", "The protocol to use when forwarding this port.")
            }
          },
          default: {
            "label": localize("remote.portsAttributes.labelDefault", "Application"),
            "onAutoForward": "notify"
          }
        }
      },
      markdownDescription: localize("remote.portsAttributes", 'Set properties that are applied when a specific port number is forwarded. For example:\n\n```\n"3000": {\n  "label": "Application"\n},\n"40000-55000": {\n  "onAutoForward": "ignore"\n},\n".+\\\\/server.js": {\n "onAutoForward": "openPreview"\n}\n```'),
      defaultSnippets: [{ body: { "${1:3000}": { label: "${2:Application}", onAutoForward: "openPreview" } } }],
      errorMessage: localize("remote.portsAttributes.patternError", "Must be a port number, range of port numbers, or regular expression."),
      additionalProperties: false,
      default: {
        "443": {
          "protocol": "https"
        },
        "8443": {
          "protocol": "https"
        }
      }
    },
    "remote.otherPortsAttributes": {
      type: "object",
      properties: {
        "onAutoForward": {
          type: "string",
          enum: ["notify", "openBrowser", "openPreview", "silent", "ignore"],
          enumDescriptions: [
            localize("remote.portsAttributes.notify", "Shows a notification when a port is automatically forwarded."),
            localize("remote.portsAttributes.openBrowser", "Opens the browser when the port is automatically forwarded. Depending on your settings, this could open an embedded browser."),
            localize("remote.portsAttributes.openPreview", "Opens a preview in the same window when the port is automatically forwarded."),
            localize("remote.portsAttributes.silent", "Shows no notification and takes no action when this port is automatically forwarded."),
            localize("remote.portsAttributes.ignore", "This port will not be automatically forwarded.")
          ],
          description: localize("remote.portsAttributes.onForward", "Defines the action that occurs when the port is discovered for automatic forwarding"),
          default: "notify"
        },
        "elevateIfNeeded": {
          type: "boolean",
          description: localize("remote.portsAttributes.elevateIfNeeded", "Automatically prompt for elevation (if needed) when this port is forwarded. Elevate is required if the local port is a privileged port."),
          default: false
        },
        "label": {
          type: "string",
          description: localize("remote.portsAttributes.label", "Label that will be shown in the UI for this port."),
          default: localize("remote.portsAttributes.labelDefault", "Application")
        },
        "requireLocalPort": {
          type: "boolean",
          markdownDescription: localize("remote.portsAttributes.requireLocalPort", "When true, a modal dialog will show if the chosen local port isn't used for forwarding."),
          default: false
        },
        "protocol": {
          type: "string",
          enum: ["http", "https"],
          description: localize("remote.portsAttributes.protocol", "The protocol to use when forwarding this port.")
        }
      },
      defaultSnippets: [{ body: { onAutoForward: "ignore" } }],
      markdownDescription: localize("remote.portsAttributes.defaults", 'Set default properties that are applied to all ports that don\'t get properties from the setting {0}. For example:\n\n```\n{\n  "onAutoForward": "ignore"\n}\n```', "`#remote.portsAttributes#`"),
      additionalProperties: false
    },
    "remote.localPortHost": {
      type: "string",
      enum: ["localhost", "allInterfaces"],
      default: "localhost",
      description: localize("remote.localPortHost", "Specifies the local host name that will be used for port forwarding.")
    },
    [REMOTE_DEFAULT_IF_LOCAL_EXTENSIONS]: {
      type: "array",
      markdownDescription: localize("remote.defaultExtensionsIfInstalledLocally.markdownDescription", "List of extensions to install upon connection to a remote when already installed locally."),
      default: product?.remoteDefaultExtensionsIfInstalledLocally || [],
      items: {
        type: "string",
        pattern: EXTENSION_IDENTIFIER_PATTERN,
        patternErrorMessage: localize("remote.defaultExtensionsIfInstalledLocally.invalidFormat", 'Extension identifier must be in format "publisher.name".')
      }
    }
  }
});
export {
  LabelContribution
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9yZW1vdGUvY29tbW9uL3JlbW90ZS5jb250cmlidXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBJV29ya2JlbmNoQ29udHJpYnV0aW9uLCBJV29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5LCBXb3JrYmVuY2hQaGFzZSwgRXh0ZW5zaW9ucyBhcyBXb3JrYmVuY2hFeHRlbnNpb25zLCByZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbjIgfSBmcm9tICcuLi8uLi8uLi9jb21tb24vY29udHJpYnV0aW9ucy5qcyc7XG5pbXBvcnQgeyBSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlZ2lzdHJ5L2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBMaWZlY3ljbGVQaGFzZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElMYWJlbFNlcnZpY2UsIFJlc291cmNlTGFiZWxGb3JtYXR0aW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbGFiZWwvY29tbW9uL2xhYmVsLmpzJztcbmltcG9ydCB7IE9wZXJhdGluZ1N5c3RlbSwgaXNXZWIsIE9TIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgU2NoZW1hcyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL25ldHdvcmsuanMnO1xuaW1wb3J0IHsgSVJlbW90ZUFnZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL3JlbW90ZS9jb21tb24vcmVtb3RlQWdlbnRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IElMb2dnZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUsIGxvY2FsaXplMiB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb25maWd1cmF0aW9uUmVnaXN0cnksIEV4dGVuc2lvbnMgYXMgQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uUmVnaXN0cnkuanMnO1xuaW1wb3J0IHsgSUpTT05TY2hlbWEgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9qc29uU2NoZW1hLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSwgSUZpbGVEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvZW52aXJvbm1lbnQvY29tbW9uL2Vudmlyb25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBTZXJ2aWNlc0FjY2Vzc29yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3Rpb24yLCByZWdpc3RlckFjdGlvbjIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb25zL2NvbW1vbi9hY3Rpb25zLmpzJztcbmltcG9ydCB7IENhdGVnb3JpZXMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9hY3Rpb24vY29tbW9uL2FjdGlvbkNvbW1vbkNhdGVnb3JpZXMuanMnO1xuaW1wb3J0IHsgUGVyc2lzdGVudENvbm5lY3Rpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZUFnZW50Q29ubmVjdGlvbi5qcyc7XG5pbXBvcnQgeyBJRG93bmxvYWRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZG93bmxvYWQvY29tbW9uL2Rvd25sb2FkLmpzJztcbmltcG9ydCB7IERvd25sb2FkU2VydmljZUNoYW5uZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9kb3dubG9hZC9jb21tb24vZG93bmxvYWRJcGMuanMnO1xuaW1wb3J0IHsgUmVtb3RlTG9nZ2VyQ2hhbm5lbENsaWVudCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nSXBjLmpzJztcbmltcG9ydCB7IFJFTU9URV9ERUZBVUxUX0lGX0xPQ0FMX0VYVEVOU0lPTlMgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZW1vdGUvY29tbW9uL3JlbW90ZS5qcyc7XG5pbXBvcnQgcHJvZHVjdCBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0LmpzJztcblxuXG5jb25zdCBFWFRFTlNJT05fSURFTlRJRklFUl9QQVRURVJOID0gJyhbYS16MC05QS1aXVthLXowLTktQS1aXSopXFxcXC4oW2EtejAtOUEtWl1bYS16MC05LUEtWl0qKSQnO1xuXG5leHBvcnQgY2xhc3MgTGFiZWxDb250cmlidXRpb24gaW1wbGVtZW50cyBJV29ya2JlbmNoQ29udHJpYnV0aW9uIHtcblxuXHRzdGF0aWMgcmVhZG9ubHkgSUQgPSAnd29ya2JlbmNoLmNvbnRyaWIucmVtb3RlTGFiZWwnO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTGFiZWxTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGFiZWxTZXJ2aWNlOiBJTGFiZWxTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcmVtb3RlQWdlbnRTZXJ2aWNlOiBJUmVtb3RlQWdlbnRTZXJ2aWNlKSB7XG5cdFx0dGhpcy5yZWdpc3RlckZvcm1hdHRlcnMoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJGb3JtYXR0ZXJzKCk6IHZvaWQge1xuXHRcdHRoaXMucmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkudGhlbihyZW1vdGVFbnZpcm9ubWVudCA9PiB7XG5cdFx0XHRjb25zdCBvcyA9IHJlbW90ZUVudmlyb25tZW50Py5vcyB8fCBPUztcblx0XHRcdGNvbnN0IGZvcm1hdHRpbmc6IFJlc291cmNlTGFiZWxGb3JtYXR0aW5nID0ge1xuXHRcdFx0XHRsYWJlbDogJyR7cGF0aH0nLFxuXHRcdFx0XHRzZXBhcmF0b3I6IG9zID09PSBPcGVyYXRpbmdTeXN0ZW0uV2luZG93cyA/ICdcXFxcJyA6ICcvJyxcblx0XHRcdFx0dGlsZGlmeTogb3MgIT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLFxuXHRcdFx0XHRub3JtYWxpemVEcml2ZUxldHRlcjogb3MgPT09IE9wZXJhdGluZ1N5c3RlbS5XaW5kb3dzLFxuXHRcdFx0XHR3b3Jrc3BhY2VTdWZmaXg6IGlzV2ViID8gdW5kZWZpbmVkIDogU2NoZW1hcy52c2NvZGVSZW1vdGVcblx0XHRcdH07XG5cdFx0XHR0aGlzLmxhYmVsU2VydmljZS5yZWdpc3RlckZvcm1hdHRlcih7XG5cdFx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVSZW1vdGUsXG5cdFx0XHRcdGZvcm1hdHRpbmdcblx0XHRcdH0pO1xuXG5cdFx0XHRpZiAocmVtb3RlRW52aXJvbm1lbnQpIHtcblx0XHRcdFx0dGhpcy5sYWJlbFNlcnZpY2UucmVnaXN0ZXJGb3JtYXR0ZXIoe1xuXHRcdFx0XHRcdHNjaGVtZTogU2NoZW1hcy52c2NvZGVVc2VyRGF0YSxcblx0XHRcdFx0XHRmb3JtYXR0aW5nXG5cdFx0XHRcdH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmNsYXNzIFJlbW90ZUNoYW5uZWxzQ29udHJpYnV0aW9uIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZSxcblx0XHRASURvd25sb2FkU2VydmljZSBkb3dubG9hZFNlcnZpY2U6IElEb3dubG9hZFNlcnZpY2UsXG5cdFx0QElMb2dnZXJTZXJ2aWNlIGxvZ2dlclNlcnZpY2U6IElMb2dnZXJTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdGNvbnN0IGNvbm5lY3Rpb24gPSByZW1vdGVBZ2VudFNlcnZpY2UuZ2V0Q29ubmVjdGlvbigpO1xuXHRcdGlmIChjb25uZWN0aW9uKSB7XG5cdFx0XHRjb25uZWN0aW9uLnJlZ2lzdGVyQ2hhbm5lbCgnZG93bmxvYWQnLCBuZXcgRG93bmxvYWRTZXJ2aWNlQ2hhbm5lbChkb3dubG9hZFNlcnZpY2UpKTtcblx0XHRcdGNvbm5lY3Rpb24ud2l0aENoYW5uZWwoJ2xvZ2dlcicsIGFzeW5jIGNoYW5uZWwgPT4gdGhpcy5fcmVnaXN0ZXIobmV3IFJlbW90ZUxvZ2dlckNoYW5uZWxDbGllbnQobG9nZ2VyU2VydmljZSwgY2hhbm5lbCkpKTtcblx0XHR9XG5cdH1cbn1cblxuY2xhc3MgUmVtb3RlSW52YWxpZFdvcmtzcGFjZURldGVjdG9yIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElXb3JrYmVuY2hDb250cmlidXRpb24ge1xuXG5cdHN0YXRpYyByZWFkb25seSBJRCA9ICd3b3JrYmVuY2guY29udHJpYi5yZW1vdGVJbnZhbGlkV29ya3NwYWNlRGV0ZWN0b3InO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlU2VydmljZTogSUZpbGVTZXJ2aWNlLFxuXHRcdEBJRGlhbG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGRpYWxvZ1NlcnZpY2U6IElEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJRmlsZURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBmaWxlRGlhbG9nU2VydmljZTogSUZpbGVEaWFsb2dTZXJ2aWNlLFxuXHRcdEBJUmVtb3RlQWdlbnRTZXJ2aWNlIHJlbW90ZUFnZW50U2VydmljZTogSVJlbW90ZUFnZW50U2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gV2hlbiBjb25uZWN0ZWQgdG8gYSByZW1vdGUgd29ya3NwYWNlLCB3ZSBjdXJyZW50bHkgY2Fubm90XG5cdFx0Ly8gdmFsaWRhdGUgdGhhdCB0aGUgd29ya3NwYWNlIGV4aXN0cyBiZWZvcmUgYWN0dWFsbHkgb3BlbmluZ1xuXHRcdC8vIGl0LiBBcyBzdWNoLCB3ZSBuZWVkIHRvIGNoZWNrIG9uIHRoYXQgYWZ0ZXIgc3RhcnR1cCBhbmQgZ3VpZGVcblx0XHQvLyB0aGUgdXNlciB0byBhIHZhbGlkIHdvcmtzcGFjZS5cblx0XHQvLyAoc2VlIGh0dHBzOi8vZ2l0aHViLmNvbS9taWNyb3NvZnQvdnNjb2RlL2lzc3Vlcy8xMzM4NzIpXG5cdFx0aWYgKHRoaXMuZW52aXJvbm1lbnRTZXJ2aWNlLnJlbW90ZUF1dGhvcml0eSkge1xuXHRcdFx0cmVtb3RlQWdlbnRTZXJ2aWNlLmdldEVudmlyb25tZW50KCkudGhlbihyZW1vdGVFbnYgPT4ge1xuXHRcdFx0XHRpZiAocmVtb3RlRW52KSB7XG5cdFx0XHRcdFx0Ly8gd2UgdXNlIHRoZSBwcmVzZW5jZSBvZiBgcmVtb3RlRW52YCB0byBmaWd1cmUgb3V0XG5cdFx0XHRcdFx0Ly8gaWYgd2UgZ290IGEgaGVhbHRoeSByZW1vdGUgY29ubmVjdGlvblxuXHRcdFx0XHRcdC8vIChzZWUgaHR0cHM6Ly9naXRodWIuY29tL21pY3Jvc29mdC92c2NvZGUvaXNzdWVzLzEzNTMzMSlcblx0XHRcdFx0XHR0aGlzLnZhbGlkYXRlUmVtb3RlV29ya3NwYWNlKCk7XG5cdFx0XHRcdH1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgdmFsaWRhdGVSZW1vdGVXb3Jrc3BhY2UoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy5jb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRjb25zdCB3b3Jrc3BhY2VVcmlUb1N0YXQgPSB3b3Jrc3BhY2UuY29uZmlndXJhdGlvbiA/PyB3b3Jrc3BhY2UuZm9sZGVycy5hdCgwKT8udXJpO1xuXHRcdGlmICghd29ya3NwYWNlVXJpVG9TdGF0KSB7XG5cdFx0XHRyZXR1cm47IC8vIG9ubHkgd2hlbiBpbiB3b3Jrc3BhY2Vcblx0XHR9XG5cblx0XHRjb25zdCBleGlzdHMgPSBhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLmV4aXN0cyh3b3Jrc3BhY2VVcmlUb1N0YXQpO1xuXHRcdGlmIChleGlzdHMpIHtcblx0XHRcdHJldHVybjsgLy8gYWxsIGdvb2QhXG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0dHlwZTogJ3dhcm5pbmcnLFxuXHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ2ludmFsaWRXb3Jrc3BhY2VNZXNzYWdlJywgXCJXb3Jrc3BhY2UgZG9lcyBub3QgZXhpc3RcIiksXG5cdFx0XHRkZXRhaWw6IGxvY2FsaXplKCdpbnZhbGlkV29ya3NwYWNlRGV0YWlsJywgXCJQbGVhc2Ugc2VsZWN0IGFub3RoZXIgd29ya3NwYWNlIHRvIG9wZW4uXCIpLFxuXHRcdFx0cHJpbWFyeUJ1dHRvbjogbG9jYWxpemUoeyBrZXk6ICdpbnZhbGlkV29ya3NwYWNlUHJpbWFyeScsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJk9wZW4gV29ya3NwYWNlLi4uXCIpXG5cdFx0fSk7XG5cblx0XHRpZiAocmVzLmNvbmZpcm1lZCkge1xuXG5cdFx0XHQvLyBQaWNrIFdvcmtzcGFjZVxuXHRcdFx0aWYgKHdvcmtzcGFjZS5jb25maWd1cmF0aW9uKSB7XG5cdFx0XHRcdHJldHVybiB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnBpY2tXb3Jrc3BhY2VBbmRPcGVuKHt9KTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gUGljayBGb2xkZXJcblx0XHRcdHJldHVybiB0aGlzLmZpbGVEaWFsb2dTZXJ2aWNlLnBpY2tGb2xkZXJBbmRPcGVuKHt9KTtcblx0XHR9XG5cdH1cbn1cblxuY29uc3Qgd29ya2JlbmNoQ29udHJpYnV0aW9uc1JlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SVdvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeT4oV29ya2JlbmNoRXh0ZW5zaW9ucy5Xb3JrYmVuY2gpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKExhYmVsQ29udHJpYnV0aW9uLklELCBMYWJlbENvbnRyaWJ1dGlvbiwgV29ya2JlbmNoUGhhc2UuQmxvY2tTdGFydHVwKTtcbndvcmtiZW5jaENvbnRyaWJ1dGlvbnNSZWdpc3RyeS5yZWdpc3RlcldvcmtiZW5jaENvbnRyaWJ1dGlvbihSZW1vdGVDaGFubmVsc0NvbnRyaWJ1dGlvbiwgTGlmZWN5Y2xlUGhhc2UuUmVzdG9yZWQpO1xucmVnaXN0ZXJXb3JrYmVuY2hDb250cmlidXRpb24yKFJlbW90ZUludmFsaWRXb3Jrc3BhY2VEZXRlY3Rvci5JRCwgUmVtb3RlSW52YWxpZFdvcmtzcGFjZURldGVjdG9yLCBXb3JrYmVuY2hQaGFzZS5CbG9ja1N0YXJ0dXApO1xuXG5jb25zdCBlbmFibGVEaWFnbm9zdGljcyA9IHRydWU7XG5cbmlmIChlbmFibGVEaWFnbm9zdGljcykge1xuXHRjbGFzcyBUcmlnZ2VyUmVjb25uZWN0QWN0aW9uIGV4dGVuZHMgQWN0aW9uMiB7XG5cdFx0Y29uc3RydWN0b3IoKSB7XG5cdFx0XHRzdXBlcih7XG5cdFx0XHRcdGlkOiAnd29ya2JlbmNoLmFjdGlvbi50cmlnZ2VyUmVjb25uZWN0Jyxcblx0XHRcdFx0dGl0bGU6IGxvY2FsaXplMigndHJpZ2dlclJlY29ubmVjdCcsICdDb25uZWN0aW9uOiBUcmlnZ2VyIFJlY29ubmVjdCcpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRQZXJzaXN0ZW50Q29ubmVjdGlvbi5kZWJ1Z1RyaWdnZXJSZWNvbm5lY3Rpb24oKTtcblx0XHR9XG5cdH1cblxuXHRjbGFzcyBQYXVzZVNvY2tldFdyaXRpbmcgZXh0ZW5kcyBBY3Rpb24yIHtcblx0XHRjb25zdHJ1Y3RvcigpIHtcblx0XHRcdHN1cGVyKHtcblx0XHRcdFx0aWQ6ICd3b3JrYmVuY2guYWN0aW9uLnBhdXNlU29ja2V0V3JpdGluZycsXG5cdFx0XHRcdHRpdGxlOiBsb2NhbGl6ZTIoJ3BhdXNlU29ja2V0V3JpdGluZycsICdDb25uZWN0aW9uOiBQYXVzZSBzb2NrZXQgd3JpdGluZycpLFxuXHRcdFx0XHRjYXRlZ29yeTogQ2F0ZWdvcmllcy5EZXZlbG9wZXIsXG5cdFx0XHRcdGYxOiB0cnVlLFxuXHRcdFx0fSk7XG5cdFx0fVxuXG5cdFx0YXN5bmMgcnVuKGFjY2Vzc29yOiBTZXJ2aWNlc0FjY2Vzc29yKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0XHRQZXJzaXN0ZW50Q29ubmVjdGlvbi5kZWJ1Z1BhdXNlU29ja2V0V3JpdGluZygpO1xuXHRcdH1cblx0fVxuXG5cdHJlZ2lzdGVyQWN0aW9uMihUcmlnZ2VyUmVjb25uZWN0QWN0aW9uKTtcblx0cmVnaXN0ZXJBY3Rpb24yKFBhdXNlU29ja2V0V3JpdGluZyk7XG59XG5cbmNvbnN0IGV4dGVuc2lvbktpbmRTY2hlbWE6IElKU09OU2NoZW1hID0ge1xuXHR0eXBlOiAnc3RyaW5nJyxcblx0ZW51bTogW1xuXHRcdCd1aScsXG5cdFx0J3dvcmtzcGFjZSdcblx0XSxcblx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdGxvY2FsaXplKCd1aScsIFwiVUkgZXh0ZW5zaW9uIGtpbmQuIEluIGEgcmVtb3RlIHdpbmRvdywgc3VjaCBleHRlbnNpb25zIGFyZSBlbmFibGVkIG9ubHkgd2hlbiBhdmFpbGFibGUgb24gdGhlIGxvY2FsIG1hY2hpbmUuXCIpLFxuXHRcdGxvY2FsaXplKCd3b3Jrc3BhY2UnLCBcIldvcmtzcGFjZSBleHRlbnNpb24ga2luZC4gSW4gYSByZW1vdGUgd2luZG93LCBzdWNoIGV4dGVuc2lvbnMgYXJlIGVuYWJsZWQgb25seSB3aGVuIGF2YWlsYWJsZSBvbiB0aGUgcmVtb3RlLlwiKVxuXHRdLFxufTtcblxuUmVnaXN0cnkuYXM8SUNvbmZpZ3VyYXRpb25SZWdpc3RyeT4oQ29uZmlndXJhdGlvbkV4dGVuc2lvbnMuQ29uZmlndXJhdGlvbilcblx0LnJlZ2lzdGVyQ29uZmlndXJhdGlvbih7XG5cdFx0aWQ6ICdyZW1vdGUnLFxuXHRcdHRpdGxlOiBsb2NhbGl6ZSgncmVtb3RlJywgXCJSZW1vdGVcIiksXG5cdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0cHJvcGVydGllczoge1xuXHRcdFx0J3JlbW90ZS5leHRlbnNpb25LaW5kJzoge1xuXHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5leHRlbnNpb25LaW5kJywgXCJPdmVycmlkZSB0aGUga2luZCBvZiBhbiBleHRlbnNpb24uIGB1aWAgZXh0ZW5zaW9ucyBhcmUgaW5zdGFsbGVkIGFuZCBydW4gb24gdGhlIGxvY2FsIG1hY2hpbmUgd2hpbGUgYHdvcmtzcGFjZWAgZXh0ZW5zaW9ucyBhcmUgcnVuIG9uIHRoZSByZW1vdGUuIEJ5IG92ZXJyaWRpbmcgYW4gZXh0ZW5zaW9uJ3MgZGVmYXVsdCBraW5kIHVzaW5nIHRoaXMgc2V0dGluZywgeW91IHNwZWNpZnkgaWYgdGhhdCBleHRlbnNpb24gc2hvdWxkIGJlIGluc3RhbGxlZCBhbmQgZW5hYmxlZCBsb2NhbGx5IG9yIHJlbW90ZWx5LlwiKSxcblx0XHRcdFx0cGF0dGVyblByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRbRVhURU5TSU9OX0lERU5USUZJRVJfUEFUVEVSTl06IHtcblx0XHRcdFx0XHRcdG9uZU9mOiBbeyB0eXBlOiAnYXJyYXknLCBpdGVtczogZXh0ZW5zaW9uS2luZFNjaGVtYSB9LCBleHRlbnNpb25LaW5kU2NoZW1hXSxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6IFsndWknXSxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZWZhdWx0OiB7XG5cdFx0XHRcdFx0J3B1Yi5uYW1lJzogWyd1aSddXG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHQncmVtb3RlLnJlc3RvcmVGb3J3YXJkZWRQb3J0cyc6IHtcblx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLnJlc3RvcmVGb3J3YXJkZWRQb3J0cycsIFwiUmVzdG9yZXMgdGhlIHBvcnRzIHlvdSBmb3J3YXJkZWQgaW4gYSB3b3Jrc3BhY2UuXCIpLFxuXHRcdFx0XHRkZWZhdWx0OiB0cnVlXG5cdFx0XHR9LFxuXHRcdFx0J3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzJzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdG1hcmtkb3duRGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGUuYXV0b0ZvcndhcmRQb3J0cycsIFwiV2hlbiBlbmFibGVkLCBuZXcgcnVubmluZyBwcm9jZXNzZXMgYXJlIGRldGVjdGVkIGFuZCBwb3J0cyB0aGF0IHRoZXkgbGlzdGVuIG9uIGFyZSBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZC4gRGlzYWJsaW5nIHRoaXMgc2V0dGluZyB3aWxsIG5vdCBwcmV2ZW50IGFsbCBwb3J0cyBmcm9tIGJlaW5nIGZvcndhcmRlZC4gRXZlbiB3aGVuIGRpc2FibGVkLCBleHRlbnNpb25zIHdpbGwgc3RpbGwgYmUgYWJsZSB0byBjYXVzZSBwb3J0cyB0byBiZSBmb3J3YXJkZWQsIGFuZCBvcGVuaW5nIHNvbWUgVVJMcyB3aWxsIHN0aWxsIGNhdXNlIHBvcnRzIHRvIGZvcndhcmRlZC4gQWxzbyBzZWUgezB9LlwiLCAnYCNyZW1vdGUuYXV0b0ZvcndhcmRQb3J0c1NvdXJjZSNgJyksXG5cdFx0XHRcdGRlZmF1bHQ6IHRydWVcblx0XHRcdH0sXG5cdFx0XHQncmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2UnOiB7XG5cdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2UnLCBcIlNldHMgdGhlIHNvdXJjZSBmcm9tIHdoaWNoIHBvcnRzIGFyZSBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZCB3aGVuIHswfSBpcyB0cnVlLiBXaGVuIHswfSBpcyBmYWxzZSwgezF9IHdpbGwgYmUgdXNlZCB0byBmaW5kIGluZm9ybWF0aW9uIGFib3V0IHBvcnRzIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gZm9yd2FyZGVkLiBPbiBXaW5kb3dzIGFuZCBtYWNPUyByZW1vdGVzLCB0aGUgYHByb2Nlc3NgIGFuZCBgaHlicmlkYCBvcHRpb25zIGhhdmUgbm8gZWZmZWN0IGFuZCBgb3V0cHV0YCB3aWxsIGJlIHVzZWQuXCIsICdgI3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzI2AnLCAnYCNyZW1vdGUuYXV0b0ZvcndhcmRQb3J0c1NvdXJjZSNgJyksXG5cdFx0XHRcdGVudW06IFsncHJvY2VzcycsICdvdXRwdXQnLCAnaHlicmlkJ10sXG5cdFx0XHRcdGVudW1EZXNjcmlwdGlvbnM6IFtcblx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2UucHJvY2VzcycsIFwiUG9ydHMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZCB3aGVuIGRpc2NvdmVyZWQgYnkgd2F0Y2hpbmcgZm9yIHByb2Nlc3NlcyB0aGF0IGFyZSBzdGFydGVkIGFuZCBpbmNsdWRlIGEgcG9ydC5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzU291cmNlLm91dHB1dCcsIFwiUG9ydHMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZCB3aGVuIGRpc2NvdmVyZWQgYnkgcmVhZGluZyB0ZXJtaW5hbCBhbmQgZGVidWcgb3V0cHV0LiBOb3QgYWxsIHByb2Nlc3NlcyB0aGF0IHVzZSBwb3J0cyB3aWxsIHByaW50IHRvIHRoZSBpbnRlZ3JhdGVkIHRlcm1pbmFsIG9yIGRlYnVnIGNvbnNvbGUsIHNvIHNvbWUgcG9ydHMgd2lsbCBiZSBtaXNzZWQuIFBvcnRzIGZvcndhcmRlZCBiYXNlZCBvbiBvdXRwdXQgd2lsbCBub3QgYmUgXFxcInVuLWZvcndhcmRlZFxcXCIgdW50aWwgcmVsb2FkIG9yIHVudGlsIHRoZSBwb3J0IGlzIGNsb3NlZCBieSB0aGUgdXNlciBpbiB0aGUgUG9ydHMgdmlldy5cIiksXG5cdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzU291cmNlLmh5YnJpZCcsIFwiUG9ydHMgd2lsbCBiZSBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZCB3aGVuIGRpc2NvdmVyZWQgYnkgcmVhZGluZyB0ZXJtaW5hbCBhbmQgZGVidWcgb3V0cHV0LiBOb3QgYWxsIHByb2Nlc3NlcyB0aGF0IHVzZSBwb3J0cyB3aWxsIHByaW50IHRvIHRoZSBpbnRlZ3JhdGVkIHRlcm1pbmFsIG9yIGRlYnVnIGNvbnNvbGUsIHNvIHNvbWUgcG9ydHMgd2lsbCBiZSBtaXNzZWQuIFBvcnRzIHdpbGwgYmUgXFxcInVuLWZvcndhcmRlZFxcXCIgYnkgd2F0Y2hpbmcgZm9yIHByb2Nlc3NlcyB0aGF0IGxpc3RlbiBvbiB0aGF0IHBvcnQgdG8gYmUgdGVybWluYXRlZC5cIilcblx0XHRcdFx0XSxcblx0XHRcdFx0ZGVmYXVsdDogJ3Byb2Nlc3MnXG5cdFx0XHR9LFxuXHRcdFx0J3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRzRmFsbGJhY2snOiB7XG5cdFx0XHRcdHR5cGU6ICdudW1iZXInLFxuXHRcdFx0XHRkZWZhdWx0OiAyMCxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5hdXRvRm9yd2FyZFBvcnRGYWxsYmFjaycsIFwiVGhlIG51bWJlciBvZiBhdXRvIGZvcndhcmRlZCBwb3J0cyB0aGF0IHdpbGwgdHJpZ2dlciB0aGUgc3dpdGNoIGZyb20gYHByb2Nlc3NgIHRvIGBoeWJyaWRgIHdoZW4gYXV0b21hdGljYWxseSBmb3J3YXJkaW5nIHBvcnRzIGFuZCBgcmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNTb3VyY2VgIGlzIHNldCB0byBgcHJvY2Vzc2AgYnkgZGVmYXVsdC4gU2V0IHRvIGAwYCB0byBkaXNhYmxlIHRoZSBmYWxsYmFjay4gV2hlbiBgcmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNGYWxsYmFja2AgaGFzbid0IGJlZW4gY29uZmlndXJlZCwgYnV0IGByZW1vdGUuYXV0b0ZvcndhcmRQb3J0c1NvdXJjZWAgaGFzLCBgcmVtb3RlLmF1dG9Gb3J3YXJkUG9ydHNGYWxsYmFja2Agd2lsbCBiZSB0cmVhdGVkIGFzIHRob3VnaCBpdCdzIHNldCB0byBgMGAuXCIpXG5cdFx0XHR9LFxuXHRcdFx0J3JlbW90ZS5mb3J3YXJkT25PcGVuJzoge1xuXHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLmZvcndhcmRPbkNsaWNrJywgXCJDb250cm9scyB3aGV0aGVyIGxvY2FsIFVSTHMgd2l0aCBhIHBvcnQgd2lsbCBiZSBmb3J3YXJkZWQgd2hlbiBvcGVuZWQgZnJvbSB0aGUgdGVybWluYWwgYW5kIHRoZSBkZWJ1ZyBjb25zb2xlLlwiKSxcblx0XHRcdFx0ZGVmYXVsdDogdHJ1ZVxuXHRcdFx0fSxcblx0XHRcdC8vIENvbnNpZGVyIG1ha2luZyBjaGFuZ2VzIHRvIGV4dGVuc2lvbnNcXGNvbmZpZ3VyYXRpb24tZWRpdGluZ1xcc2NoZW1hc1xcZGV2Q29udGFpbmVyLnNjaGVtYS5zcmMuanNvblxuXHRcdFx0Ly8gYW5kIGV4dGVuc2lvbnNcXGNvbmZpZ3VyYXRpb24tZWRpdGluZ1xcc2NoZW1hc1xcYXR0YWNoQ29udGFpbmVyLnNjaGVtYS5qc29uXG5cdFx0XHQvLyB0byBrZWVwIGluIHN5bmMgd2l0aCBkZXZjb250YWluZXIuanNvbiBzY2hlbWEuXG5cdFx0XHQncmVtb3RlLnBvcnRzQXR0cmlidXRlcyc6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdHBhdHRlcm5Qcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0JyheXFxcXGQrKC1cXFxcZCspPyQpfCguKyknOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5wb3J0JywgXCJBIHBvcnQsIHJhbmdlIG9mIHBvcnRzIChleC4gXFxcIjQwMDAwLTU1MDAwXFxcIiksIGhvc3QgYW5kIHBvcnQgKGV4LiBcXFwiZGI6MTIzNFxcXCIpLCBvciByZWd1bGFyIGV4cHJlc3Npb24gKGV4LiBcXFwiLitcXFxcXFxcXC9zZXJ2ZXIuanNcXFwiKS4gIEZvciBhIHBvcnQgbnVtYmVyIG9yIHJhbmdlLCB0aGUgYXR0cmlidXRlcyB3aWxsIGFwcGx5IHRvIHRoYXQgcG9ydCBudW1iZXIgb3IgcmFuZ2Ugb2YgcG9ydCBudW1iZXJzLiBBdHRyaWJ1dGVzIHdoaWNoIHVzZSBhIHJlZ3VsYXIgZXhwcmVzc2lvbiB3aWxsIGFwcGx5IHRvIHBvcnRzIHdob3NlIGFzc29jaWF0ZWQgcHJvY2VzcyBjb21tYW5kIGxpbmUgbWF0Y2hlcyB0aGUgZXhwcmVzc2lvbi5cIiksXG5cdFx0XHRcdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdFx0XHRcdCdvbkF1dG9Gb3J3YXJkJzoge1xuXHRcdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRcdGVudW06IFsnbm90aWZ5JywgJ29wZW5Ccm93c2VyJywgJ29wZW5Ccm93c2VyT25jZScsICdvcGVuUHJldmlldycsICdzaWxlbnQnLCAnaWdub3JlJ10sXG5cdFx0XHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMubm90aWZ5JywgXCJTaG93cyBhIG5vdGlmaWNhdGlvbiB3aGVuIGEgcG9ydCBpcyBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5vcGVuQnJvd3NlcicsIFwiT3BlbnMgdGhlIGJyb3dzZXIgd2hlbiB0aGUgcG9ydCBpcyBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZC4gRGVwZW5kaW5nIG9uIHlvdXIgc2V0dGluZ3MsIHRoaXMgY291bGQgb3BlbiBhbiBlbWJlZGRlZCBicm93c2VyLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLm9wZW5Ccm93c2VyT25jZScsIFwiT3BlbnMgdGhlIGJyb3dzZXIgd2hlbiB0aGUgcG9ydCBpcyBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZCwgYnV0IG9ubHkgdGhlIGZpcnN0IHRpbWUgdGhlIHBvcnQgaXMgZm9yd2FyZCBkdXJpbmcgYSBzZXNzaW9uLiBEZXBlbmRpbmcgb24geW91ciBzZXR0aW5ncywgdGhpcyBjb3VsZCBvcGVuIGFuIGVtYmVkZGVkIGJyb3dzZXIuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMub3BlblByZXZpZXcnLCBcIk9wZW5zIGEgcHJldmlldyBpbiB0aGUgc2FtZSB3aW5kb3cgd2hlbiB0aGUgcG9ydCBpcyBhdXRvbWF0aWNhbGx5IGZvcndhcmRlZC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5zaWxlbnQnLCBcIlNob3dzIG5vIG5vdGlmaWNhdGlvbiBhbmQgdGFrZXMgbm8gYWN0aW9uIHdoZW4gdGhpcyBwb3J0IGlzIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLmlnbm9yZScsIFwiVGhpcyBwb3J0IHdpbGwgbm90IGJlIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLlwiKVxuXHRcdFx0XHRcdFx0XHRcdF0sXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLm9uRm9yd2FyZCcsIFwiRGVmaW5lcyB0aGUgYWN0aW9uIHRoYXQgb2NjdXJzIHdoZW4gdGhlIHBvcnQgaXMgZGlzY292ZXJlZCBmb3IgYXV0b21hdGljIGZvcndhcmRpbmdcIiksXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogJ25vdGlmeSdcblx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0J2VsZXZhdGVJZk5lZWRlZCc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLmVsZXZhdGVJZk5lZWRlZCcsIFwiQXV0b21hdGljYWxseSBwcm9tcHQgZm9yIGVsZXZhdGlvbiAoaWYgbmVlZGVkKSB3aGVuIHRoaXMgcG9ydCBpcyBmb3J3YXJkZWQuIEVsZXZhdGUgaXMgcmVxdWlyZWQgaWYgdGhlIGxvY2FsIHBvcnQgaXMgYSBwcml2aWxlZ2VkIHBvcnQuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCdsYWJlbCc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMubGFiZWwnLCBcIkxhYmVsIHRoYXQgd2lsbCBiZSBzaG93biBpbiB0aGUgVUkgZm9yIHRoaXMgcG9ydC5cIiksXG5cdFx0XHRcdFx0XHRcdFx0ZGVmYXVsdDogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMubGFiZWxEZWZhdWx0JywgXCJBcHBsaWNhdGlvblwiKVxuXHRcdFx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdFx0XHQncmVxdWlyZUxvY2FsUG9ydCc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnYm9vbGVhbicsXG5cdFx0XHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMucmVxdWlyZUxvY2FsUG9ydCcsIFwiV2hlbiB0cnVlLCBhIG1vZGFsIGRpYWxvZyB3aWxsIHNob3cgaWYgdGhlIGNob3NlbiBsb2NhbCBwb3J0IGlzbid0IHVzZWQgZm9yIGZvcndhcmRpbmcuXCIpLFxuXHRcdFx0XHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHRcdCdwcm90b2NvbCc6IHtcblx0XHRcdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdFx0XHRlbnVtOiBbJ2h0dHAnLCAnaHR0cHMnXSxcblx0XHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMucHJvdG9jb2wnLCBcIlRoZSBwcm90b2NvbCB0byB1c2Ugd2hlbiBmb3J3YXJkaW5nIHRoaXMgcG9ydC5cIilcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHRcdFx0J2xhYmVsJzogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMubGFiZWxEZWZhdWx0JywgXCJBcHBsaWNhdGlvblwiKSxcblx0XHRcdFx0XHRcdFx0J29uQXV0b0ZvcndhcmQnOiAnbm90aWZ5J1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fSxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMnLCBcIlNldCBwcm9wZXJ0aWVzIHRoYXQgYXJlIGFwcGxpZWQgd2hlbiBhIHNwZWNpZmljIHBvcnQgbnVtYmVyIGlzIGZvcndhcmRlZC4gRm9yIGV4YW1wbGU6XFxuXFxuYGBgXFxuXFxcIjMwMDBcXFwiOiB7XFxuICBcXFwibGFiZWxcXFwiOiBcXFwiQXBwbGljYXRpb25cXFwiXFxufSxcXG5cXFwiNDAwMDAtNTUwMDBcXFwiOiB7XFxuICBcXFwib25BdXRvRm9yd2FyZFxcXCI6IFxcXCJpZ25vcmVcXFwiXFxufSxcXG5cXFwiLitcXFxcXFxcXC9zZXJ2ZXIuanNcXFwiOiB7XFxuIFxcXCJvbkF1dG9Gb3J3YXJkXFxcIjogXFxcIm9wZW5QcmV2aWV3XFxcIlxcbn1cXG5gYGBcIiksXG5cdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyAnJHsxOjMwMDB9JzogeyBsYWJlbDogJyR7MjpBcHBsaWNhdGlvbn0nLCBvbkF1dG9Gb3J3YXJkOiAnb3BlblByZXZpZXcnIH0gfSB9XSxcblx0XHRcdFx0ZXJyb3JNZXNzYWdlOiBsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5wYXR0ZXJuRXJyb3InLCBcIk11c3QgYmUgYSBwb3J0IG51bWJlciwgcmFuZ2Ugb2YgcG9ydCBudW1iZXJzLCBvciByZWd1bGFyIGV4cHJlc3Npb24uXCIpLFxuXHRcdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHRcdGRlZmF1bHQ6IHtcblx0XHRcdFx0XHQnNDQzJzoge1xuXHRcdFx0XHRcdFx0J3Byb3RvY29sJzogJ2h0dHBzJ1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0Jzg0NDMnOiB7XG5cdFx0XHRcdFx0XHQncHJvdG9jb2wnOiAnaHR0cHMnXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHR9LFxuXHRcdFx0J3JlbW90ZS5vdGhlclBvcnRzQXR0cmlidXRlcyc6IHtcblx0XHRcdFx0dHlwZTogJ29iamVjdCcsXG5cdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHQnb25BdXRvRm9yd2FyZCc6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZW51bTogWydub3RpZnknLCAnb3BlbkJyb3dzZXInLCAnb3BlblByZXZpZXcnLCAnc2lsZW50JywgJ2lnbm9yZSddLFxuXHRcdFx0XHRcdFx0ZW51bURlc2NyaXB0aW9uczogW1xuXHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5ub3RpZnknLCBcIlNob3dzIGEgbm90aWZpY2F0aW9uIHdoZW4gYSBwb3J0IGlzIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMub3BlbkJyb3dzZXInLCBcIk9wZW5zIHRoZSBicm93c2VyIHdoZW4gdGhlIHBvcnQgaXMgYXV0b21hdGljYWxseSBmb3J3YXJkZWQuIERlcGVuZGluZyBvbiB5b3VyIHNldHRpbmdzLCB0aGlzIGNvdWxkIG9wZW4gYW4gZW1iZWRkZWQgYnJvd3Nlci5cIiksXG5cdFx0XHRcdFx0XHRcdGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLm9wZW5QcmV2aWV3JywgXCJPcGVucyBhIHByZXZpZXcgaW4gdGhlIHNhbWUgd2luZG93IHdoZW4gdGhlIHBvcnQgaXMgYXV0b21hdGljYWxseSBmb3J3YXJkZWQuXCIpLFxuXHRcdFx0XHRcdFx0XHRsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5zaWxlbnQnLCBcIlNob3dzIG5vIG5vdGlmaWNhdGlvbiBhbmQgdGFrZXMgbm8gYWN0aW9uIHdoZW4gdGhpcyBwb3J0IGlzIGF1dG9tYXRpY2FsbHkgZm9yd2FyZGVkLlwiKSxcblx0XHRcdFx0XHRcdFx0bG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMuaWdub3JlJywgXCJUaGlzIHBvcnQgd2lsbCBub3QgYmUgYXV0b21hdGljYWxseSBmb3J3YXJkZWQuXCIpXG5cdFx0XHRcdFx0XHRdLFxuXHRcdFx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLm9uRm9yd2FyZCcsIFwiRGVmaW5lcyB0aGUgYWN0aW9uIHRoYXQgb2NjdXJzIHdoZW4gdGhlIHBvcnQgaXMgZGlzY292ZXJlZCBmb3IgYXV0b21hdGljIGZvcndhcmRpbmdcIiksXG5cdFx0XHRcdFx0XHRkZWZhdWx0OiAnbm90aWZ5J1xuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0J2VsZXZhdGVJZk5lZWRlZCc6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdib29sZWFuJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5lbGV2YXRlSWZOZWVkZWQnLCBcIkF1dG9tYXRpY2FsbHkgcHJvbXB0IGZvciBlbGV2YXRpb24gKGlmIG5lZWRlZCkgd2hlbiB0aGlzIHBvcnQgaXMgZm9yd2FyZGVkLiBFbGV2YXRlIGlzIHJlcXVpcmVkIGlmIHRoZSBsb2NhbCBwb3J0IGlzIGEgcHJpdmlsZWdlZCBwb3J0LlwiKSxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6IGZhbHNlXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHQnbGFiZWwnOiB7XG5cdFx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5sYWJlbCcsIFwiTGFiZWwgdGhhdCB3aWxsIGJlIHNob3duIGluIHRoZSBVSSBmb3IgdGhpcyBwb3J0LlwiKSxcblx0XHRcdFx0XHRcdGRlZmF1bHQ6IGxvY2FsaXplKCdyZW1vdGUucG9ydHNBdHRyaWJ1dGVzLmxhYmVsRGVmYXVsdCcsIFwiQXBwbGljYXRpb25cIilcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdyZXF1aXJlTG9jYWxQb3J0Jzoge1xuXHRcdFx0XHRcdFx0dHlwZTogJ2Jvb2xlYW4nLFxuXHRcdFx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMucmVxdWlyZUxvY2FsUG9ydCcsIFwiV2hlbiB0cnVlLCBhIG1vZGFsIGRpYWxvZyB3aWxsIHNob3cgaWYgdGhlIGNob3NlbiBsb2NhbCBwb3J0IGlzbid0IHVzZWQgZm9yIGZvcndhcmRpbmcuXCIpLFxuXHRcdFx0XHRcdFx0ZGVmYXVsdDogZmFsc2Vcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdCdwcm90b2NvbCc6IHtcblx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0ZW51bTogWydodHRwJywgJ2h0dHBzJ10sXG5cdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5wb3J0c0F0dHJpYnV0ZXMucHJvdG9jb2wnLCBcIlRoZSBwcm90b2NvbCB0byB1c2Ugd2hlbiBmb3J3YXJkaW5nIHRoaXMgcG9ydC5cIilcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBvbkF1dG9Gb3J3YXJkOiAnaWdub3JlJyB9IH1dLFxuXHRcdFx0XHRtYXJrZG93bkRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgncmVtb3RlLnBvcnRzQXR0cmlidXRlcy5kZWZhdWx0cycsIFwiU2V0IGRlZmF1bHQgcHJvcGVydGllcyB0aGF0IGFyZSBhcHBsaWVkIHRvIGFsbCBwb3J0cyB0aGF0IGRvbid0IGdldCBwcm9wZXJ0aWVzIGZyb20gdGhlIHNldHRpbmcgezB9LiBGb3IgZXhhbXBsZTpcXG5cXG5gYGBcXG57XFxuICBcXFwib25BdXRvRm9yd2FyZFxcXCI6IFxcXCJpZ25vcmVcXFwiXFxufVxcbmBgYFwiLCAnYCNyZW1vdGUucG9ydHNBdHRyaWJ1dGVzI2AnKSxcblx0XHRcdFx0YWRkaXRpb25hbFByb3BlcnRpZXM6IGZhbHNlXG5cdFx0XHR9LFxuXHRcdFx0J3JlbW90ZS5sb2NhbFBvcnRIb3N0Jzoge1xuXHRcdFx0XHR0eXBlOiAnc3RyaW5nJyxcblx0XHRcdFx0ZW51bTogWydsb2NhbGhvc3QnLCAnYWxsSW50ZXJmYWNlcyddLFxuXHRcdFx0XHRkZWZhdWx0OiAnbG9jYWxob3N0Jyxcblx0XHRcdFx0ZGVzY3JpcHRpb246IGxvY2FsaXplKCdyZW1vdGUubG9jYWxQb3J0SG9zdCcsIFwiU3BlY2lmaWVzIHRoZSBsb2NhbCBob3N0IG5hbWUgdGhhdCB3aWxsIGJlIHVzZWQgZm9yIHBvcnQgZm9yd2FyZGluZy5cIilcblx0XHRcdH0sXG5cdFx0XHRbUkVNT1RFX0RFRkFVTFRfSUZfTE9DQUxfRVhURU5TSU9OU106IHtcblx0XHRcdFx0dHlwZTogJ2FycmF5Jyxcblx0XHRcdFx0bWFya2Rvd25EZXNjcmlwdGlvbjogbG9jYWxpemUoJ3JlbW90ZS5kZWZhdWx0RXh0ZW5zaW9uc0lmSW5zdGFsbGVkTG9jYWxseS5tYXJrZG93bkRlc2NyaXB0aW9uJywgJ0xpc3Qgb2YgZXh0ZW5zaW9ucyB0byBpbnN0YWxsIHVwb24gY29ubmVjdGlvbiB0byBhIHJlbW90ZSB3aGVuIGFscmVhZHkgaW5zdGFsbGVkIGxvY2FsbHkuJyksXG5cdFx0XHRcdGRlZmF1bHQ6IHByb2R1Y3Q/LnJlbW90ZURlZmF1bHRFeHRlbnNpb25zSWZJbnN0YWxsZWRMb2NhbGx5IHx8IFtdLFxuXHRcdFx0XHRpdGVtczoge1xuXHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdHBhdHRlcm46IEVYVEVOU0lPTl9JREVOVElGSUVSX1BBVFRFUk4sXG5cdFx0XHRcdFx0cGF0dGVybkVycm9yTWVzc2FnZTogbG9jYWxpemUoJ3JlbW90ZS5kZWZhdWx0RXh0ZW5zaW9uc0lmSW5zdGFsbGVkTG9jYWxseS5pbnZhbGlkRm9ybWF0JywgJ0V4dGVuc2lvbiBpZGVudGlmaWVyIG11c3QgYmUgaW4gZm9ybWF0IFwicHVibGlzaGVyLm5hbWVcIi4nKVxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdH1cblx0fSk7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQWtFLGdCQUFnQixjQUFjLHFCQUFxQixzQ0FBc0M7QUFDM0osU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxxQkFBOEM7QUFDdkQsU0FBUyxpQkFBaUIsT0FBTyxVQUFVO0FBQzNDLFNBQVMsZUFBZTtBQUN4QixTQUFTLDJCQUEyQjtBQUNwQyxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLFVBQVUsaUJBQWlCO0FBQ3BDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQWlDLGNBQWMsK0JBQStCO0FBRTlFLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsZ0JBQWdCLDBCQUEwQjtBQUNuRCxTQUFTLG9DQUFvQztBQUM3QyxTQUFTLGdDQUFnQztBQUV6QyxTQUFTLFNBQVMsdUJBQXVCO0FBQ3pDLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsOEJBQThCO0FBQ3ZDLFNBQVMsaUNBQWlDO0FBQzFDLFNBQVMsMENBQTBDO0FBQ25ELE9BQU8sYUFBYTtBQUdwQixNQUFNLCtCQUErQjtBQUU5QixJQUFNLG9CQUFOLE1BQTBEO0FBQUEsRUFJaEUsWUFDaUMsY0FDTSxvQkFBeUM7QUFEL0M7QUFDTTtBQUN0QyxTQUFLLG1CQUFtQjtBQUFBLEVBQ3pCO0FBQUEsRUFFUSxxQkFBMkI7QUFDbEMsU0FBSyxtQkFBbUIsZUFBZSxFQUFFLEtBQUssdUJBQXFCO0FBQ2xFLFlBQU0sS0FBSyxtQkFBbUIsTUFBTTtBQUNwQyxZQUFNLGFBQXNDO0FBQUEsUUFDM0MsT0FBTztBQUFBLFFBQ1AsV0FBVyxPQUFPLGdCQUFnQixVQUFVLE9BQU87QUFBQSxRQUNuRCxTQUFTLE9BQU8sZ0JBQWdCO0FBQUEsUUFDaEMsc0JBQXNCLE9BQU8sZ0JBQWdCO0FBQUEsUUFDN0MsaUJBQWlCLFFBQVEsU0FBWSxRQUFRO0FBQUEsTUFDOUM7QUFDQSxXQUFLLGFBQWEsa0JBQWtCO0FBQUEsUUFDbkMsUUFBUSxRQUFRO0FBQUEsUUFDaEI7QUFBQSxNQUNELENBQUM7QUFFRCxVQUFJLG1CQUFtQjtBQUN0QixhQUFLLGFBQWEsa0JBQWtCO0FBQUEsVUFDbkMsUUFBUSxRQUFRO0FBQUEsVUFDaEI7QUFBQSxRQUNELENBQUM7QUFBQSxNQUNGO0FBQUEsSUFDRCxDQUFDO0FBQUEsRUFDRjtBQUNEO0FBakNhLGtCQUVJLEtBQUs7QUFGVCxvQkFBTjtBQUFBLEVBS0o7QUFBQSxFQUNBO0FBQUEsR0FOVTtBQW1DYixJQUFNLDZCQUFOLGNBQXlDLFdBQTZDO0FBQUEsRUFFckYsWUFDc0Isb0JBQ0gsaUJBQ0YsZUFDZjtBQUNELFVBQU07QUFDTixVQUFNLGFBQWEsbUJBQW1CLGNBQWM7QUFDcEQsUUFBSSxZQUFZO0FBQ2YsaUJBQVcsZ0JBQWdCLFlBQVksSUFBSSx1QkFBdUIsZUFBZSxDQUFDO0FBQ2xGLGlCQUFXLFlBQVksVUFBVSxPQUFNLFlBQVcsS0FBSyxVQUFVLElBQUksMEJBQTBCLGVBQWUsT0FBTyxDQUFDLENBQUM7QUFBQSxJQUN4SDtBQUFBLEVBQ0Q7QUFDRDtBQWRNLDZCQUFOO0FBQUEsRUFHRztBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FMRztBQWdCTixJQUFNLGlDQUFOLGNBQTZDLFdBQTZDO0FBQUEsRUFJekYsWUFDZ0MsYUFDRSxlQUNjLG9CQUNKLGdCQUNOLG1CQUNoQixvQkFDcEI7QUFDRCxVQUFNO0FBUHlCO0FBQ0U7QUFDYztBQUNKO0FBQ047QUFVckMsUUFBSSxLQUFLLG1CQUFtQixpQkFBaUI7QUFDNUMseUJBQW1CLGVBQWUsRUFBRSxLQUFLLGVBQWE7QUFDckQsWUFBSSxXQUFXO0FBSWQsZUFBSyx3QkFBd0I7QUFBQSxRQUM5QjtBQUFBLE1BQ0QsQ0FBQztBQUFBLElBQ0Y7QUFBQSxFQUNEO0FBQUEsRUFFQSxNQUFjLDBCQUF5QztBQUN0RCxVQUFNLFlBQVksS0FBSyxlQUFlLGFBQWE7QUFDbkQsVUFBTSxxQkFBcUIsVUFBVSxpQkFBaUIsVUFBVSxRQUFRLEdBQUcsQ0FBQyxHQUFHO0FBQy9FLFFBQUksQ0FBQyxvQkFBb0I7QUFDeEI7QUFBQSxJQUNEO0FBRUEsVUFBTSxTQUFTLE1BQU0sS0FBSyxZQUFZLE9BQU8sa0JBQWtCO0FBQy9ELFFBQUksUUFBUTtBQUNYO0FBQUEsSUFDRDtBQUVBLFVBQU0sTUFBTSxNQUFNLEtBQUssY0FBYyxRQUFRO0FBQUEsTUFDNUMsTUFBTTtBQUFBLE1BQ04sU0FBUyxTQUFTLDJCQUEyQiwwQkFBMEI7QUFBQSxNQUN2RSxRQUFRLFNBQVMsMEJBQTBCLDBDQUEwQztBQUFBLE1BQ3JGLGVBQWUsU0FBUyxFQUFFLEtBQUssMkJBQTJCLFNBQVMsQ0FBQyx1QkFBdUIsRUFBRSxHQUFHLHFCQUFxQjtBQUFBLElBQ3RILENBQUM7QUFFRCxRQUFJLElBQUksV0FBVztBQUdsQixVQUFJLFVBQVUsZUFBZTtBQUM1QixlQUFPLEtBQUssa0JBQWtCLHFCQUFxQixDQUFDLENBQUM7QUFBQSxNQUN0RDtBQUdBLGFBQU8sS0FBSyxrQkFBa0Isa0JBQWtCLENBQUMsQ0FBQztBQUFBLElBQ25EO0FBQUEsRUFDRDtBQUNEO0FBN0RNLCtCQUVXLEtBQUs7QUFGaEIsaUNBQU47QUFBQSxFQUtHO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQVZHO0FBK0ROLE1BQU0saUNBQWlDLFNBQVMsR0FBb0Msb0JBQW9CLFNBQVM7QUFDakgsK0JBQStCLGtCQUFrQixJQUFJLG1CQUFtQixlQUFlLFlBQVk7QUFDbkcsK0JBQStCLDhCQUE4Qiw0QkFBNEIsZUFBZSxRQUFRO0FBQ2hILCtCQUErQiwrQkFBK0IsSUFBSSxnQ0FBZ0MsZUFBZSxZQUFZO0FBRTdILE1BQU0sb0JBQW9CO0FBRTFCLElBQUksbUJBQW1CO0FBQUEsRUFDdEIsTUFBTSwrQkFBK0IsUUFBUTtBQUFBLElBQzVDLGNBQWM7QUFDYixZQUFNO0FBQUEsUUFDTCxJQUFJO0FBQUEsUUFDSixPQUFPLFVBQVUsb0JBQW9CLCtCQUErQjtBQUFBLFFBQ3BFLFVBQVUsV0FBVztBQUFBLFFBQ3JCLElBQUk7QUFBQSxNQUNMLENBQUM7QUFBQSxJQUNGO0FBQUEsSUFFQSxNQUFNLElBQUksVUFBMkM7QUFDcEQsMkJBQXFCLHlCQUF5QjtBQUFBLElBQy9DO0FBQUEsRUFDRDtBQUFBLEVBRUEsTUFBTSwyQkFBMkIsUUFBUTtBQUFBLElBQ3hDLGNBQWM7QUFDYixZQUFNO0FBQUEsUUFDTCxJQUFJO0FBQUEsUUFDSixPQUFPLFVBQVUsc0JBQXNCLGtDQUFrQztBQUFBLFFBQ3pFLFVBQVUsV0FBVztBQUFBLFFBQ3JCLElBQUk7QUFBQSxNQUNMLENBQUM7QUFBQSxJQUNGO0FBQUEsSUFFQSxNQUFNLElBQUksVUFBMkM7QUFDcEQsMkJBQXFCLHdCQUF3QjtBQUFBLElBQzlDO0FBQUEsRUFDRDtBQUVBLGtCQUFnQixzQkFBc0I7QUFDdEMsa0JBQWdCLGtCQUFrQjtBQUNuQztBQUVBLE1BQU0sc0JBQW1DO0FBQUEsRUFDeEMsTUFBTTtBQUFBLEVBQ04sTUFBTTtBQUFBLElBQ0w7QUFBQSxJQUNBO0FBQUEsRUFDRDtBQUFBLEVBQ0Esa0JBQWtCO0FBQUEsSUFDakIsU0FBUyxNQUFNLDhHQUE4RztBQUFBLElBQzdILFNBQVMsYUFBYSw4R0FBOEc7QUFBQSxFQUNySTtBQUNEO0FBRUEsU0FBUyxHQUEyQix3QkFBd0IsYUFBYSxFQUN2RSxzQkFBc0I7QUFBQSxFQUN0QixJQUFJO0FBQUEsRUFDSixPQUFPLFNBQVMsVUFBVSxRQUFRO0FBQUEsRUFDbEMsTUFBTTtBQUFBLEVBQ04sWUFBWTtBQUFBLElBQ1gsd0JBQXdCO0FBQUEsTUFDdkIsTUFBTTtBQUFBLE1BQ04scUJBQXFCLFNBQVMsd0JBQXdCLG9TQUFvUztBQUFBLE1BQzFWLG1CQUFtQjtBQUFBLFFBQ2xCLENBQUMsNEJBQTRCLEdBQUc7QUFBQSxVQUMvQixPQUFPLENBQUMsRUFBRSxNQUFNLFNBQVMsT0FBTyxvQkFBb0IsR0FBRyxtQkFBbUI7QUFBQSxVQUMxRSxTQUFTLENBQUMsSUFBSTtBQUFBLFFBQ2Y7QUFBQSxNQUNEO0FBQUEsTUFDQSxTQUFTO0FBQUEsUUFDUixZQUFZLENBQUMsSUFBSTtBQUFBLE1BQ2xCO0FBQUEsSUFDRDtBQUFBLElBQ0EsZ0NBQWdDO0FBQUEsTUFDL0IsTUFBTTtBQUFBLE1BQ04scUJBQXFCLFNBQVMsZ0NBQWdDLGtEQUFrRDtBQUFBLE1BQ2hILFNBQVM7QUFBQSxJQUNWO0FBQUEsSUFDQSwyQkFBMkI7QUFBQSxNQUMxQixNQUFNO0FBQUEsTUFDTixxQkFBcUIsU0FBUywyQkFBMkIsa1ZBQWtWLG1DQUFtQztBQUFBLE1BQzlhLFNBQVM7QUFBQSxJQUNWO0FBQUEsSUFDQSxpQ0FBaUM7QUFBQSxNQUNoQyxNQUFNO0FBQUEsTUFDTixxQkFBcUIsU0FBUyxpQ0FBaUMsbVNBQW1TLCtCQUErQixtQ0FBbUM7QUFBQSxNQUNwYSxNQUFNLENBQUMsV0FBVyxVQUFVLFFBQVE7QUFBQSxNQUNwQyxrQkFBa0I7QUFBQSxRQUNqQixTQUFTLHlDQUF5QyxzSEFBc0g7QUFBQSxRQUN4SyxTQUFTLHdDQUF3Qyx1VkFBeVY7QUFBQSxRQUMxWSxTQUFTLHdDQUF3QyxzVEFBd1Q7QUFBQSxNQUMxVztBQUFBLE1BQ0EsU0FBUztBQUFBLElBQ1Y7QUFBQSxJQUNBLG1DQUFtQztBQUFBLE1BQ2xDLE1BQU07QUFBQSxNQUNOLFNBQVM7QUFBQSxNQUNULHFCQUFxQixTQUFTLGtDQUFrQyw2WkFBNlo7QUFBQSxJQUM5ZDtBQUFBLElBQ0Esd0JBQXdCO0FBQUEsTUFDdkIsTUFBTTtBQUFBLE1BQ04sYUFBYSxTQUFTLHlCQUF5QixnSEFBZ0g7QUFBQSxNQUMvSixTQUFTO0FBQUEsSUFDVjtBQUFBO0FBQUE7QUFBQTtBQUFBLElBSUEsMEJBQTBCO0FBQUEsTUFDekIsTUFBTTtBQUFBLE1BQ04sbUJBQW1CO0FBQUEsUUFDbEIseUJBQXlCO0FBQUEsVUFDeEIsTUFBTTtBQUFBLFVBQ04sYUFBYSxTQUFTLCtCQUErQiw2VkFBbVc7QUFBQSxVQUN4WixZQUFZO0FBQUEsWUFDWCxpQkFBaUI7QUFBQSxjQUNoQixNQUFNO0FBQUEsY0FDTixNQUFNLENBQUMsVUFBVSxlQUFlLG1CQUFtQixlQUFlLFVBQVUsUUFBUTtBQUFBLGNBQ3BGLGtCQUFrQjtBQUFBLGdCQUNqQixTQUFTLGlDQUFpQyw4REFBOEQ7QUFBQSxnQkFDeEcsU0FBUyxzQ0FBc0MsOEhBQThIO0FBQUEsZ0JBQzdLLFNBQVMsMENBQTBDLDRMQUE0TDtBQUFBLGdCQUMvTyxTQUFTLHNDQUFzQyw4RUFBOEU7QUFBQSxnQkFDN0gsU0FBUyxpQ0FBaUMsc0ZBQXNGO0FBQUEsZ0JBQ2hJLFNBQVMsaUNBQWlDLGdEQUFnRDtBQUFBLGNBQzNGO0FBQUEsY0FDQSxhQUFhLFNBQVMsb0NBQW9DLHFGQUFxRjtBQUFBLGNBQy9JLFNBQVM7QUFBQSxZQUNWO0FBQUEsWUFDQSxtQkFBbUI7QUFBQSxjQUNsQixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsMENBQTBDLHlJQUF5STtBQUFBLGNBQ3pNLFNBQVM7QUFBQSxZQUNWO0FBQUEsWUFDQSxTQUFTO0FBQUEsY0FDUixNQUFNO0FBQUEsY0FDTixhQUFhLFNBQVMsZ0NBQWdDLG1EQUFtRDtBQUFBLGNBQ3pHLFNBQVMsU0FBUyx1Q0FBdUMsYUFBYTtBQUFBLFlBQ3ZFO0FBQUEsWUFDQSxvQkFBb0I7QUFBQSxjQUNuQixNQUFNO0FBQUEsY0FDTixxQkFBcUIsU0FBUywyQ0FBMkMseUZBQXlGO0FBQUEsY0FDbEssU0FBUztBQUFBLFlBQ1Y7QUFBQSxZQUNBLFlBQVk7QUFBQSxjQUNYLE1BQU07QUFBQSxjQUNOLE1BQU0sQ0FBQyxRQUFRLE9BQU87QUFBQSxjQUN0QixhQUFhLFNBQVMsbUNBQW1DLGdEQUFnRDtBQUFBLFlBQzFHO0FBQUEsVUFDRDtBQUFBLFVBQ0EsU0FBUztBQUFBLFlBQ1IsU0FBUyxTQUFTLHVDQUF1QyxhQUFhO0FBQUEsWUFDdEUsaUJBQWlCO0FBQUEsVUFDbEI7QUFBQSxRQUNEO0FBQUEsTUFDRDtBQUFBLE1BQ0EscUJBQXFCLFNBQVMsMEJBQTBCLDJQQUE2UTtBQUFBLE1BQ3JVLGlCQUFpQixDQUFDLEVBQUUsTUFBTSxFQUFFLGFBQWEsRUFBRSxPQUFPLG9CQUFvQixlQUFlLGNBQWMsRUFBRSxFQUFFLENBQUM7QUFBQSxNQUN4RyxjQUFjLFNBQVMsdUNBQXVDLHNFQUFzRTtBQUFBLE1BQ3BJLHNCQUFzQjtBQUFBLE1BQ3RCLFNBQVM7QUFBQSxRQUNSLE9BQU87QUFBQSxVQUNOLFlBQVk7QUFBQSxRQUNiO0FBQUEsUUFDQSxRQUFRO0FBQUEsVUFDUCxZQUFZO0FBQUEsUUFDYjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQUEsSUFDQSwrQkFBK0I7QUFBQSxNQUM5QixNQUFNO0FBQUEsTUFDTixZQUFZO0FBQUEsUUFDWCxpQkFBaUI7QUFBQSxVQUNoQixNQUFNO0FBQUEsVUFDTixNQUFNLENBQUMsVUFBVSxlQUFlLGVBQWUsVUFBVSxRQUFRO0FBQUEsVUFDakUsa0JBQWtCO0FBQUEsWUFDakIsU0FBUyxpQ0FBaUMsOERBQThEO0FBQUEsWUFDeEcsU0FBUyxzQ0FBc0MsOEhBQThIO0FBQUEsWUFDN0ssU0FBUyxzQ0FBc0MsOEVBQThFO0FBQUEsWUFDN0gsU0FBUyxpQ0FBaUMsc0ZBQXNGO0FBQUEsWUFDaEksU0FBUyxpQ0FBaUMsZ0RBQWdEO0FBQUEsVUFDM0Y7QUFBQSxVQUNBLGFBQWEsU0FBUyxvQ0FBb0MscUZBQXFGO0FBQUEsVUFDL0ksU0FBUztBQUFBLFFBQ1Y7QUFBQSxRQUNBLG1CQUFtQjtBQUFBLFVBQ2xCLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUywwQ0FBMEMseUlBQXlJO0FBQUEsVUFDek0sU0FBUztBQUFBLFFBQ1Y7QUFBQSxRQUNBLFNBQVM7QUFBQSxVQUNSLE1BQU07QUFBQSxVQUNOLGFBQWEsU0FBUyxnQ0FBZ0MsbURBQW1EO0FBQUEsVUFDekcsU0FBUyxTQUFTLHVDQUF1QyxhQUFhO0FBQUEsUUFDdkU7QUFBQSxRQUNBLG9CQUFvQjtBQUFBLFVBQ25CLE1BQU07QUFBQSxVQUNOLHFCQUFxQixTQUFTLDJDQUEyQyx5RkFBeUY7QUFBQSxVQUNsSyxTQUFTO0FBQUEsUUFDVjtBQUFBLFFBQ0EsWUFBWTtBQUFBLFVBQ1gsTUFBTTtBQUFBLFVBQ04sTUFBTSxDQUFDLFFBQVEsT0FBTztBQUFBLFVBQ3RCLGFBQWEsU0FBUyxtQ0FBbUMsZ0RBQWdEO0FBQUEsUUFDMUc7QUFBQSxNQUNEO0FBQUEsTUFDQSxpQkFBaUIsQ0FBQyxFQUFFLE1BQU0sRUFBRSxlQUFlLFNBQVMsRUFBRSxDQUFDO0FBQUEsTUFDdkQscUJBQXFCLFNBQVMsbUNBQW1DLHFLQUF3Syw0QkFBNEI7QUFBQSxNQUNyUSxzQkFBc0I7QUFBQSxJQUN2QjtBQUFBLElBQ0Esd0JBQXdCO0FBQUEsTUFDdkIsTUFBTTtBQUFBLE1BQ04sTUFBTSxDQUFDLGFBQWEsZUFBZTtBQUFBLE1BQ25DLFNBQVM7QUFBQSxNQUNULGFBQWEsU0FBUyx3QkFBd0Isc0VBQXNFO0FBQUEsSUFDckg7QUFBQSxJQUNBLENBQUMsa0NBQWtDLEdBQUc7QUFBQSxNQUNyQyxNQUFNO0FBQUEsTUFDTixxQkFBcUIsU0FBUyxrRUFBa0UsMkZBQTJGO0FBQUEsTUFDM0wsU0FBUyxTQUFTLDZDQUE2QyxDQUFDO0FBQUEsTUFDaEUsT0FBTztBQUFBLFFBQ04sTUFBTTtBQUFBLFFBQ04sU0FBUztBQUFBLFFBQ1QscUJBQXFCLFNBQVMsNERBQTRELDBEQUEwRDtBQUFBLE1BQ3JKO0FBQUEsSUFDRDtBQUFBLEVBQ0Q7QUFDRCxDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
