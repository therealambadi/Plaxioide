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
import { mapFindFirst } from "../../../../base/common/arraysFind.js";
import { assertNever } from "../../../../base/common/assert.js";
import { disposableTimeout } from "../../../../base/common/async.js";
import { parse as parseJsonc } from "../../../../base/common/jsonc.js";
import { DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { basename } from "../../../../base/common/resources.js";
import { URI } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { localize } from "../../../../nls.js";
import { ICommandService } from "../../../../platform/commands/common/commands.js";
import { ConfigurationTarget, getConfigValueInTarget, IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { INotificationService } from "../../../../platform/notification/common/notification.js";
import { IQuickInputService } from "../../../../platform/quickinput/common/quickInput.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { EditorsOrder } from "../../../common/editor.js";
import { IJSONEditingService } from "../../../services/configuration/common/jsonEditing.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { mcpConfigurationSection, mcpStdioServerSchema } from "../common/mcpConfiguration.js";
import { IMcpRegistry } from "../common/mcpRegistryTypes.js";
import { McpServerOptionsCommand } from "./mcpCommands.js";
var AddConfigurationType = /* @__PURE__ */ ((AddConfigurationType2) => {
  AddConfigurationType2[AddConfigurationType2["Stdio"] = 0] = "Stdio";
  AddConfigurationType2[AddConfigurationType2["SSE"] = 1] = "SSE";
  AddConfigurationType2[AddConfigurationType2["NpmPackage"] = 2] = "NpmPackage";
  AddConfigurationType2[AddConfigurationType2["PipPackage"] = 3] = "PipPackage";
  AddConfigurationType2[AddConfigurationType2["DockerImage"] = 4] = "DockerImage";
  return AddConfigurationType2;
})(AddConfigurationType || {});
const assistedTypes = {
  [2 /* NpmPackage */]: {
    title: localize("mcp.npm.title", "Enter NPM Package Name"),
    placeholder: localize("mcp.npm.placeholder", "Package name (e.g., @org/package)"),
    pickLabel: localize("mcp.serverType.npm", "NPM Package"),
    pickDescription: localize("mcp.serverType.npm.description", "Install from an NPM package name")
  },
  [3 /* PipPackage */]: {
    title: localize("mcp.pip.title", "Enter Pip Package Name"),
    placeholder: localize("mcp.pip.placeholder", "Package name (e.g., package-name)"),
    pickLabel: localize("mcp.serverType.pip", "Pip Package"),
    pickDescription: localize("mcp.serverType.pip.description", "Install from a Pip package name")
  },
  [4 /* DockerImage */]: {
    title: localize("mcp.docker.title", "Enter Docker Image Name"),
    placeholder: localize("mcp.docker.placeholder", "Image name (e.g., mcp/imagename)"),
    pickLabel: localize("mcp.serverType.docker", "Docker Image"),
    pickDescription: localize("mcp.serverType.docker.description", "Install from a Docker image")
  }
};
var AddConfigurationCopilotCommand = /* @__PURE__ */ ((AddConfigurationCopilotCommand2) => {
  AddConfigurationCopilotCommand2["IsSupported"] = "github.copilot.chat.mcp.setup.check";
  AddConfigurationCopilotCommand2["ValidatePackage"] = "github.copilot.chat.mcp.setup.validatePackage";
  AddConfigurationCopilotCommand2["StartFlow"] = "github.copilot.chat.mcp.setup.flow";
  return AddConfigurationCopilotCommand2;
})(AddConfigurationCopilotCommand || {});
let McpAddConfigurationCommand = class {
  constructor(_explicitConfigUri, _quickInputService, _configurationService, _jsonEditingService, _workspaceService, _environmentService, _commandService, _mcpRegistry, _openerService, _editorService, _fileService, _notificationService, _telemetryService) {
    this._explicitConfigUri = _explicitConfigUri;
    this._quickInputService = _quickInputService;
    this._configurationService = _configurationService;
    this._jsonEditingService = _jsonEditingService;
    this._workspaceService = _workspaceService;
    this._environmentService = _environmentService;
    this._commandService = _commandService;
    this._mcpRegistry = _mcpRegistry;
    this._openerService = _openerService;
    this._editorService = _editorService;
    this._fileService = _fileService;
    this._notificationService = _notificationService;
    this._telemetryService = _telemetryService;
  }
  async getServerType() {
    const items = [
      { kind: 0 /* Stdio */, label: localize("mcp.serverType.command", "Command (stdio)"), description: localize("mcp.serverType.command.description", "Run a local command that implements the MCP protocol") },
      { kind: 1 /* SSE */, label: localize("mcp.serverType.http", "HTTP (server-sent events)"), description: localize("mcp.serverType.http.description", "Connect to a remote HTTP server that implements the MCP protocol") }
    ];
    let aiSupported;
    try {
      aiSupported = await this._commandService.executeCommand("github.copilot.chat.mcp.setup.check" /* IsSupported */);
    } catch {
    }
    if (aiSupported) {
      items.unshift({ type: "separator", label: localize("mcp.serverType.manual", "Manual Install") });
      items.push(
        { type: "separator", label: localize("mcp.serverType.copilot", "Model-Assisted") },
        ...Object.entries(assistedTypes).map(([type, { pickLabel, pickDescription }]) => ({
          kind: Number(type),
          label: pickLabel,
          description: pickDescription
        }))
      );
    }
    const result = await this._quickInputService.pick(items, {
      placeHolder: localize("mcp.serverType.placeholder", "Choose the type of MCP server to add")
    });
    return result?.kind;
  }
  async getStdioConfig() {
    const command = await this._quickInputService.input({
      title: localize("mcp.command.title", "Enter Command"),
      placeHolder: localize("mcp.command.placeholder", "Command to run (with optional arguments)"),
      ignoreFocusLost: true
    });
    if (!command) {
      return void 0;
    }
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType: "stdio"
    });
    const parts = command.match(/(?:[^\s"]+|"[^"]*")+/g);
    return {
      type: "stdio",
      command: parts[0].replace(/"/g, ""),
      args: parts.slice(1).map((arg) => arg.replace(/"/g, ""))
    };
  }
  async getSSEConfig() {
    const url = await this._quickInputService.input({
      title: localize("mcp.url.title", "Enter Server URL"),
      placeHolder: localize("mcp.url.placeholder", "URL of the MCP server (e.g., http://localhost:3000)"),
      ignoreFocusLost: true
    });
    if (!url) {
      return void 0;
    }
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType: "sse"
    });
    return {
      type: "sse",
      url
    };
  }
  async getServerId(suggestion = `my-mcp-server-${generateUuid().split("-")[0]}`) {
    const id = await this._quickInputService.input({
      title: localize("mcp.serverId.title", "Enter Server ID"),
      placeHolder: localize("mcp.serverId.placeholder", "Unique identifier for this server"),
      value: suggestion,
      ignoreFocusLost: true
    });
    return id;
  }
  async getConfigurationTarget() {
    const options = [
      { target: ConfigurationTarget.USER, label: localize("mcp.target.user", "User Settings"), description: localize("mcp.target.user.description", "Available in all workspaces") }
    ];
    if (!!this._environmentService.remoteAuthority) {
      options.push({ target: ConfigurationTarget.USER_REMOTE, label: localize("mcp.target.remote", "Remote Settings"), description: localize("mcp.target..remote.description", "Available on this remote machine") });
    }
    if (this._workspaceService.getWorkspace().folders.length > 0) {
      options.push({ target: ConfigurationTarget.WORKSPACE, label: localize("mcp.target.workspace", "Workspace Settings"), description: localize("mcp.target.workspace.description", "Available in this workspace") });
    }
    if (options.length === 1) {
      return options[0].target;
    }
    const targetPick = await this._quickInputService.pick(options, {
      title: localize("mcp.target.title", "Choose where to save the configuration")
    });
    return targetPick?.target;
  }
  async getAssistedConfig(type) {
    const packageName = await this._quickInputService.input({
      ignoreFocusLost: true,
      title: assistedTypes[type].title,
      placeHolder: assistedTypes[type].placeholder
    });
    if (!packageName) {
      return void 0;
    }
    let LoadAction;
    ((LoadAction2) => {
      LoadAction2["Retry"] = "retry";
      LoadAction2["Cancel"] = "cancel";
      LoadAction2["Allow"] = "allow";
    })(LoadAction || (LoadAction = {}));
    const loadingQuickPickStore = new DisposableStore();
    const loadingQuickPick = loadingQuickPickStore.add(this._quickInputService.createQuickPick());
    loadingQuickPick.title = localize("mcp.loading.title", "Loading package details...");
    loadingQuickPick.busy = true;
    loadingQuickPick.ignoreFocusOut = true;
    const packageType = this.getPackageType(type);
    this._telemetryService.publicLog2("mcp.addserver", {
      packageType
    });
    this._commandService.executeCommand(
      "github.copilot.chat.mcp.setup.validatePackage" /* ValidatePackage */,
      {
        type: packageType,
        name: packageName,
        targetConfig: {
          ...mcpStdioServerSchema,
          properties: {
            ...mcpStdioServerSchema.properties,
            name: {
              type: "string",
              description: "Suggested name of the server, alphanumeric and hyphen only"
            }
          },
          required: [...mcpStdioServerSchema.required || [], "name"]
        }
      }
    ).then((result) => {
      if (!result || result.state === "error") {
        loadingQuickPick.title = result?.error || "Unknown error loading package";
        loadingQuickPick.items = [{ id: "retry" /* Retry */, label: localize("mcp.error.retry", "Try a different package") }, { id: "cancel" /* Cancel */, label: localize("cancel", "Cancel") }];
      } else {
        loadingQuickPick.title = localize("mcp.confirmPublish", "Install {0} from {1}?", packageName, result.publisher);
        loadingQuickPick.items = [
          { id: "allow" /* Allow */, label: localize("allow", "Allow") },
          { id: "cancel" /* Cancel */, label: localize("cancel", "Cancel") }
        ];
      }
      loadingQuickPick.busy = false;
    });
    const loadingAction = await new Promise((resolve) => {
      loadingQuickPick.onDidAccept(() => resolve(loadingQuickPick.selectedItems[0]?.id));
      loadingQuickPick.onDidHide(() => resolve(void 0));
      loadingQuickPick.show();
    }).finally(() => loadingQuickPick.dispose());
    switch (loadingAction) {
      case "retry" /* Retry */:
        return this.getAssistedConfig(type);
      case "allow" /* Allow */:
        break;
      case "cancel" /* Cancel */:
      default:
        return void 0;
    }
    const configWithName = await this._commandService.executeCommand(
      "github.copilot.chat.mcp.setup.flow" /* StartFlow */,
      {
        name: packageName,
        type: packageType
      }
    );
    if (!configWithName) {
      return void 0;
    }
    const { name, ...config } = configWithName;
    return { name, config };
  }
  /** Shows the location of a server config once it's discovered. */
  showOnceDiscovered(name) {
    const store = new DisposableStore();
    store.add(autorun((reader) => {
      const colls = this._mcpRegistry.collections.read(reader);
      const match = mapFindFirst(colls, (collection) => mapFindFirst(
        collection.serverDefinitions.read(reader),
        (server) => server.label === name ? { server, collection } : void 0
      ));
      if (match) {
        if (match.collection.presentation?.origin) {
          this._openerService.openEditor({
            resource: match.collection.presentation.origin,
            options: {
              selection: match.server.presentation?.origin?.range,
              preserveFocus: true
            }
          });
        } else {
          this._commandService.executeCommand(McpServerOptionsCommand.id, name);
        }
        store.dispose();
      }
    }));
    store.add(disposableTimeout(() => store.dispose(), 5e3));
  }
  writeToUserSetting(name, config, target, inputs) {
    const settings = { ...getConfigValueInTarget(this._configurationService.inspect(mcpConfigurationSection), target) };
    settings.servers = { ...settings.servers, [name]: config };
    if (inputs) {
      settings.inputs = [...settings.inputs || [], ...inputs];
    }
    return this._configurationService.updateValue(mcpConfigurationSection, settings, target);
  }
  async run() {
    const serverType = await this.getServerType();
    if (serverType === void 0) {
      return;
    }
    let serverConfig;
    let suggestedName;
    switch (serverType) {
      case 0 /* Stdio */:
        serverConfig = await this.getStdioConfig();
        break;
      case 1 /* SSE */:
        serverConfig = await this.getSSEConfig();
        break;
      case 2 /* NpmPackage */:
      case 3 /* PipPackage */:
      case 4 /* DockerImage */: {
        const r = await this.getAssistedConfig(serverType);
        serverConfig = r?.config;
        suggestedName = r?.name;
        break;
      }
      default:
        assertNever(serverType);
    }
    if (!serverConfig) {
      return;
    }
    const serverId = await this.getServerId(suggestedName);
    if (!serverId) {
      return;
    }
    let target;
    const workspace = this._workspaceService.getWorkspace();
    if (!this._explicitConfigUri) {
      target = await this.getConfigurationTarget();
      if (!target) {
        return;
      }
    }
    const writeToUriDirect = this._explicitConfigUri ? URI.parse(this._explicitConfigUri) : target === ConfigurationTarget.WORKSPACE && workspace.folders.length === 1 ? URI.joinPath(workspace.folders[0].uri, ".vscode", "mcp.json") : void 0;
    if (writeToUriDirect) {
      await this._jsonEditingService.write(writeToUriDirect, [{
        path: ["servers", serverId],
        value: serverConfig
      }], true);
    } else {
      await this.writeToUserSetting(serverId, serverConfig, target);
    }
    const packageType = this.getPackageType(serverType);
    if (packageType) {
      this._telemetryService.publicLog2("mcp.addserver.completed", {
        packageType,
        serverType: serverConfig.type,
        target: target === ConfigurationTarget.WORKSPACE ? "workspace" : "user"
      });
    }
    this.showOnceDiscovered(serverId);
  }
  async pickForUrlHandler(resource, showIsPrimary = false) {
    const name = decodeURIComponent(basename(resource)).replace(/\.json$/, "");
    const placeHolder = localize("install.title", "Install MCP server {0}", name);
    const items = [
      { id: "install", label: localize("install.start", "Install Server"), description: localize("install.description", "Install in your user settings") },
      { id: "show", label: localize("install.show", "Show Configuration", name) },
      { id: "rename", label: localize("install.rename", 'Rename "{0}"', name) },
      { id: "cancel", label: localize("cancel", "Cancel") }
    ];
    if (showIsPrimary) {
      [items[0], items[1]] = [items[1], items[0]];
    }
    const pick = await this._quickInputService.pick(items, { placeHolder, ignoreFocusLost: true });
    const getEditors = () => this._editorService.getEditors(EditorsOrder.MOST_RECENTLY_ACTIVE).filter((e) => e.editor.resource?.toString() === resource.toString());
    switch (pick?.id) {
      case "show":
        await this._editorService.openEditor({ resource });
        break;
      case "install":
        await this._editorService.save(getEditors());
        try {
          const contents = await this._fileService.readFile(resource);
          const { inputs, ...config } = parseJsonc(contents.value.toString());
          await this.writeToUserSetting(name, config, ConfigurationTarget.USER_LOCAL, inputs);
          this._editorService.closeEditors(getEditors());
          this.showOnceDiscovered(name);
        } catch (e) {
          this._notificationService.error(localize("install.error", "Error installing MCP server {0}: {1}", name, e.message));
          await this._editorService.openEditor({ resource });
        }
        break;
      case "rename": {
        const newName = await this._quickInputService.input({ placeHolder: localize("install.newName", "Enter new name"), value: name });
        if (newName) {
          const newURI = resource.with({ path: `/${encodeURIComponent(newName)}.json` });
          await this._editorService.save(getEditors());
          await this._fileService.move(resource, newURI);
          return this.pickForUrlHandler(newURI, showIsPrimary);
        }
        break;
      }
    }
  }
  getPackageType(serverType) {
    switch (serverType) {
      case 2 /* NpmPackage */:
        return "npm";
      case 3 /* PipPackage */:
        return "pip";
      case 4 /* DockerImage */:
        return "docker";
      case 0 /* Stdio */:
        return "stdio";
      case 1 /* SSE */:
        return "sse";
      default:
        return void 0;
    }
  }
};
McpAddConfigurationCommand = __decorateClass([
  __decorateParam(1, IQuickInputService),
  __decorateParam(2, IConfigurationService),
  __decorateParam(3, IJSONEditingService),
  __decorateParam(4, IWorkspaceContextService),
  __decorateParam(5, IWorkbenchEnvironmentService),
  __decorateParam(6, ICommandService),
  __decorateParam(7, IMcpRegistry),
  __decorateParam(8, IEditorService),
  __decorateParam(9, IEditorService),
  __decorateParam(10, IFileService),
  __decorateParam(11, INotificationService),
  __decorateParam(12, ITelemetryService)
], McpAddConfigurationCommand);
export {
  McpAddConfigurationCommand
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvYnJvd3Nlci9tY3BDb21tYW5kc0FkZENvbmZpZ3VyYXRpb24udHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBtYXBGaW5kRmlyc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IGFzc2VydE5ldmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXNzZXJ0LmpzJztcbmltcG9ydCB7IGRpc3Bvc2FibGVUaW1lb3V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgcGFyc2UgYXMgcGFyc2VKc29uYyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2pzb25jLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGVTdG9yZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBhdXRvcnVuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBiYXNlbmFtZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3Jlc291cmNlcy5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb21tYW5kcy9jb21tb24vY29tbWFuZHMuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJhdGlvblRhcmdldCwgZ2V0Q29uZmlnVmFsdWVJblRhcmdldCwgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJRmlsZVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9maWxlcy9jb21tb24vZmlsZXMuanMnO1xuaW1wb3J0IHsgSU1jcENvbmZpZ3VyYXRpb24sIElNY3BDb25maWd1cmF0aW9uU1NFLCBNY3BDb25maWd1cmF0aW9uU2VydmVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbWNwL2NvbW1vbi9tY3BQbGF0Zm9ybVR5cGVzLmpzJztcbmltcG9ydCB7IElOb3RpZmljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgSVF1aWNrSW5wdXRTZXJ2aWNlLCBJUXVpY2tQaWNrSXRlbSwgUXVpY2tQaWNrSW5wdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9xdWlja2lucHV0L2NvbW1vbi9xdWlja0lucHV0LmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vd29ya3NwYWNlL2NvbW1vbi93b3Jrc3BhY2UuanMnO1xuaW1wb3J0IHsgRWRpdG9yc09yZGVyIH0gZnJvbSAnLi4vLi4vLi4vY29tbW9uL2VkaXRvci5qcyc7XG5pbXBvcnQgeyBJSlNPTkVkaXRpbmdTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvbi9jb21tb24vanNvbkVkaXRpbmcuanMnO1xuaW1wb3J0IHsgQ29uZmlndXJlZElucHV0IH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvY29uZmlndXJhdGlvblJlc29sdmVyL2NvbW1vbi9jb25maWd1cmF0aW9uUmVzb2x2ZXIuanMnO1xuaW1wb3J0IHsgSUVkaXRvclNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9lZGl0b3IvY29tbW9uL2VkaXRvclNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1jcENvbmZpZ3VyYXRpb25TdGRpbywgbWNwQ29uZmlndXJhdGlvblNlY3Rpb24sIG1jcFN0ZGlvU2VydmVyU2NoZW1hIH0gZnJvbSAnLi4vY29tbW9uL21jcENvbmZpZ3VyYXRpb24uanMnO1xuaW1wb3J0IHsgSU1jcFJlZ2lzdHJ5IH0gZnJvbSAnLi4vY29tbW9uL21jcFJlZ2lzdHJ5VHlwZXMuanMnO1xuaW1wb3J0IHsgTWNwU2VydmVyT3B0aW9uc0NvbW1hbmQgfSBmcm9tICcuL21jcENvbW1hbmRzLmpzJztcblxuY29uc3QgZW51bSBBZGRDb25maWd1cmF0aW9uVHlwZSB7XG5cdFN0ZGlvLFxuXHRTU0UsXG5cblx0TnBtUGFja2FnZSxcblx0UGlwUGFja2FnZSxcblx0RG9ja2VySW1hZ2UsXG59XG5cbnR5cGUgQXNzaXN0ZWRDb25maWd1cmF0aW9uVHlwZSA9IEFkZENvbmZpZ3VyYXRpb25UeXBlLk5wbVBhY2thZ2UgfCBBZGRDb25maWd1cmF0aW9uVHlwZS5QaXBQYWNrYWdlIHwgQWRkQ29uZmlndXJhdGlvblR5cGUuRG9ja2VySW1hZ2U7XG5cbmNvbnN0IGFzc2lzdGVkVHlwZXMgPSB7XG5cdFtBZGRDb25maWd1cmF0aW9uVHlwZS5OcG1QYWNrYWdlXToge1xuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWNwLm5wbS50aXRsZScsIFwiRW50ZXIgTlBNIFBhY2thZ2UgTmFtZVwiKSxcblx0XHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ21jcC5ucG0ucGxhY2Vob2xkZXInLCBcIlBhY2thZ2UgbmFtZSAoZS5nLiwgQG9yZy9wYWNrYWdlKVwiKSwgcGlja0xhYmVsOiBsb2NhbGl6ZSgnbWNwLnNlcnZlclR5cGUubnBtJywgXCJOUE0gUGFja2FnZVwiKSxcblx0XHRwaWNrRGVzY3JpcHRpb246IGxvY2FsaXplKCdtY3Auc2VydmVyVHlwZS5ucG0uZGVzY3JpcHRpb24nLCBcIkluc3RhbGwgZnJvbSBhbiBOUE0gcGFja2FnZSBuYW1lXCIpXG5cdH0sXG5cdFtBZGRDb25maWd1cmF0aW9uVHlwZS5QaXBQYWNrYWdlXToge1xuXHRcdHRpdGxlOiBsb2NhbGl6ZSgnbWNwLnBpcC50aXRsZScsIFwiRW50ZXIgUGlwIFBhY2thZ2UgTmFtZVwiKSxcblx0XHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ21jcC5waXAucGxhY2Vob2xkZXInLCBcIlBhY2thZ2UgbmFtZSAoZS5nLiwgcGFja2FnZS1uYW1lKVwiKSxcblx0XHRwaWNrTGFiZWw6IGxvY2FsaXplKCdtY3Auc2VydmVyVHlwZS5waXAnLCBcIlBpcCBQYWNrYWdlXCIpLFxuXHRcdHBpY2tEZXNjcmlwdGlvbjogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLnBpcC5kZXNjcmlwdGlvbicsIFwiSW5zdGFsbCBmcm9tIGEgUGlwIHBhY2thZ2UgbmFtZVwiKVxuXHR9LFxuXHRbQWRkQ29uZmlndXJhdGlvblR5cGUuRG9ja2VySW1hZ2VdOiB7XG5cdFx0dGl0bGU6IGxvY2FsaXplKCdtY3AuZG9ja2VyLnRpdGxlJywgXCJFbnRlciBEb2NrZXIgSW1hZ2UgTmFtZVwiKSxcblx0XHRwbGFjZWhvbGRlcjogbG9jYWxpemUoJ21jcC5kb2NrZXIucGxhY2Vob2xkZXInLCBcIkltYWdlIG5hbWUgKGUuZy4sIG1jcC9pbWFnZW5hbWUpXCIpLFxuXHRcdHBpY2tMYWJlbDogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLmRvY2tlcicsIFwiRG9ja2VyIEltYWdlXCIpLFxuXHRcdHBpY2tEZXNjcmlwdGlvbjogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLmRvY2tlci5kZXNjcmlwdGlvbicsIFwiSW5zdGFsbCBmcm9tIGEgRG9ja2VyIGltYWdlXCIpXG5cdH0sXG59O1xuXG5jb25zdCBlbnVtIEFkZENvbmZpZ3VyYXRpb25Db3BpbG90Q29tbWFuZCB7XG5cdC8qKiBSZXR1cm5zIHdoZXRoZXIgTUNQIGVuaGFuY2VkIHNldHVwIGlzIGVuYWJsZWQuICovXG5cdElzU3VwcG9ydGVkID0gJ2dpdGh1Yi5jb3BpbG90LmNoYXQubWNwLnNldHVwLmNoZWNrJyxcblxuXHQvKiogVGFrZXMgYW4gbnBtL3BpcCBwYWNrYWdlIG5hbWUsIHZhbGlkYXRlcyBpdHMgb3duZXIuICovXG5cdFZhbGlkYXRlUGFja2FnZSA9ICdnaXRodWIuY29waWxvdC5jaGF0Lm1jcC5zZXR1cC52YWxpZGF0ZVBhY2thZ2UnLFxuXG5cdC8qKiBSZXR1cm5zIHRoZSByZXNvbHZlZCBNQ1AgY29uZmlndXJhdGlvbi4gKi9cblx0U3RhcnRGbG93ID0gJ2dpdGh1Yi5jb3BpbG90LmNoYXQubWNwLnNldHVwLmZsb3cnLFxufVxuXG50eXBlIFZhbGlkYXRlUGFja2FnZVJlc3VsdCA9IHsgc3RhdGU6ICdvayc7IHB1Ymxpc2hlcjogc3RyaW5nIH0gfCB7IHN0YXRlOiAnZXJyb3InOyBlcnJvcjogc3RyaW5nIH07XG5cbnR5cGUgQWRkU2VydmVyRGF0YSA9IHtcblx0cGFja2FnZVR5cGU6IHN0cmluZztcbn07XG50eXBlIEFkZFNlcnZlckNsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2RpZ2l0YXJhbGQnO1xuXHRjb21tZW50OiAnR2VuZXJpYyBkZXRhaWxzIGZvciBhZGRpbmcgYSBuZXcgTUNQIHNlcnZlcic7XG5cdHBhY2thZ2VUeXBlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIHR5cGUgb2YgTUNQIHNlcnZlciBwYWNrYWdlJyB9O1xufTtcbnR5cGUgQWRkU2VydmVyQ29tcGxldGVkRGF0YSA9IHtcblx0cGFja2FnZVR5cGU6IHN0cmluZztcblx0c2VydmVyVHlwZTogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0YXJnZXQ6IHN0cmluZztcbn07XG50eXBlIEFkZFNlcnZlckNvbXBsZXRlZENsYXNzaWZpY2F0aW9uID0ge1xuXHRvd25lcjogJ2RpZ2l0YXJhbGQnO1xuXHRjb21tZW50OiAnR2VuZXJpYyBkZXRhaWxzIGZvciBzdWNjZXNzZnVsbHkgYWRkaW5nIG1vZGVsLWFzc2lzdGVkIE1DUCBzZXJ2ZXInO1xuXHRwYWNrYWdlVHlwZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB0eXBlIG9mIE1DUCBzZXJ2ZXIgcGFja2FnZScgfTtcblx0c2VydmVyVHlwZTogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB0eXBlIG9mIE1DUCBzZXJ2ZXInIH07XG5cdHRhcmdldDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB0YXJnZXQgb2YgdGhlIE1DUCBzZXJ2ZXIgY29uZmlndXJhdGlvbicgfTtcbn07XG5cbmV4cG9ydCBjbGFzcyBNY3BBZGRDb25maWd1cmF0aW9uQ29tbWFuZCB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4cGxpY2l0Q29uZmlnVXJpOiBzdHJpbmcgfCB1bmRlZmluZWQsXG5cdFx0QElRdWlja0lucHV0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9xdWlja0lucHV0U2VydmljZTogSVF1aWNrSW5wdXRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUpTT05FZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9qc29uRWRpdGluZ1NlcnZpY2U6IElKU09ORWRpdGluZ1NlcnZpY2UsXG5cdFx0QElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF93b3Jrc3BhY2VTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZW52aXJvbm1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRW52aXJvbm1lbnRTZXJ2aWNlLFxuXHRcdEBJQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY29tbWFuZFNlcnZpY2U6IElDb21tYW5kU2VydmljZSxcblx0XHRASU1jcFJlZ2lzdHJ5IHByaXZhdGUgcmVhZG9ubHkgX21jcFJlZ2lzdHJ5OiBJTWNwUmVnaXN0cnksXG5cdFx0QElFZGl0b3JTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX29wZW5lclNlcnZpY2U6IElFZGl0b3JTZXJ2aWNlLFxuXHRcdEBJRWRpdG9yU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9lZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2ZpbGVTZXJ2aWNlOiBJRmlsZVNlcnZpY2UsXG5cdFx0QElOb3RpZmljYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX25vdGlmaWNhdGlvblNlcnZpY2U6IElOb3RpZmljYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF90ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0KSB7IH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFNlcnZlclR5cGUoKTogUHJvbWlzZTxBZGRDb25maWd1cmF0aW9uVHlwZSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGl0ZW1zOiBRdWlja1BpY2tJbnB1dDx7IGtpbmQ6IEFkZENvbmZpZ3VyYXRpb25UeXBlIH0gJiBJUXVpY2tQaWNrSXRlbT5bXSA9IFtcblx0XHRcdHsga2luZDogQWRkQ29uZmlndXJhdGlvblR5cGUuU3RkaW8sIGxhYmVsOiBsb2NhbGl6ZSgnbWNwLnNlcnZlclR5cGUuY29tbWFuZCcsIFwiQ29tbWFuZCAoc3RkaW8pXCIpLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLmNvbW1hbmQuZGVzY3JpcHRpb24nLCBcIlJ1biBhIGxvY2FsIGNvbW1hbmQgdGhhdCBpbXBsZW1lbnRzIHRoZSBNQ1AgcHJvdG9jb2xcIikgfSxcblx0XHRcdHsga2luZDogQWRkQ29uZmlndXJhdGlvblR5cGUuU1NFLCBsYWJlbDogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLmh0dHAnLCBcIkhUVFAgKHNlcnZlci1zZW50IGV2ZW50cylcIiksIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWNwLnNlcnZlclR5cGUuaHR0cC5kZXNjcmlwdGlvbicsIFwiQ29ubmVjdCB0byBhIHJlbW90ZSBIVFRQIHNlcnZlciB0aGF0IGltcGxlbWVudHMgdGhlIE1DUCBwcm90b2NvbFwiKSB9XG5cdFx0XTtcblxuXHRcdGxldCBhaVN1cHBvcnRlZDogYm9vbGVhbiB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0YWlTdXBwb3J0ZWQgPSBhd2FpdCB0aGlzLl9jb21tYW5kU2VydmljZS5leGVjdXRlQ29tbWFuZDxib29sZWFuPihBZGRDb25maWd1cmF0aW9uQ29waWxvdENvbW1hbmQuSXNTdXBwb3J0ZWQpO1xuXHRcdH0gY2F0Y2gge1xuXHRcdFx0Ly8gaWdub3JlZFxuXHRcdH1cblxuXHRcdGlmIChhaVN1cHBvcnRlZCkge1xuXHRcdFx0aXRlbXMudW5zaGlmdCh7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLm1hbnVhbCcsIFwiTWFudWFsIEluc3RhbGxcIikgfSk7XG5cdFx0XHRpdGVtcy5wdXNoKFxuXHRcdFx0XHR7IHR5cGU6ICdzZXBhcmF0b3InLCBsYWJlbDogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLmNvcGlsb3QnLCBcIk1vZGVsLUFzc2lzdGVkXCIpIH0sXG5cdFx0XHRcdC4uLk9iamVjdC5lbnRyaWVzKGFzc2lzdGVkVHlwZXMpLm1hcCgoW3R5cGUsIHsgcGlja0xhYmVsLCBwaWNrRGVzY3JpcHRpb24gfV0pID0+ICh7XG5cdFx0XHRcdFx0a2luZDogTnVtYmVyKHR5cGUpIGFzIEFkZENvbmZpZ3VyYXRpb25UeXBlLFxuXHRcdFx0XHRcdGxhYmVsOiBwaWNrTGFiZWwsXG5cdFx0XHRcdFx0ZGVzY3JpcHRpb246IHBpY2tEZXNjcmlwdGlvbixcblx0XHRcdFx0fSkpXG5cdFx0XHQpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLnBpY2s8eyBraW5kOiBBZGRDb25maWd1cmF0aW9uVHlwZSB9ICYgSVF1aWNrUGlja0l0ZW0+KGl0ZW1zLCB7XG5cdFx0XHRwbGFjZUhvbGRlcjogbG9jYWxpemUoJ21jcC5zZXJ2ZXJUeXBlLnBsYWNlaG9sZGVyJywgXCJDaG9vc2UgdGhlIHR5cGUgb2YgTUNQIHNlcnZlciB0byBhZGRcIiksXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0Py5raW5kO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRTdGRpb0NvbmZpZygpOiBQcm9taXNlPElNY3BDb25maWd1cmF0aW9uU3RkaW8gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBjb21tYW5kID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtY3AuY29tbWFuZC50aXRsZScsIFwiRW50ZXIgQ29tbWFuZFwiKSxcblx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnbWNwLmNvbW1hbmQucGxhY2Vob2xkZXInLCBcIkNvbW1hbmQgdG8gcnVuICh3aXRoIG9wdGlvbmFsIGFyZ3VtZW50cylcIiksXG5cdFx0XHRpZ25vcmVGb2N1c0xvc3Q6IHRydWUsXG5cdFx0fSk7XG5cblx0XHRpZiAoIWNvbW1hbmQpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEFkZFNlcnZlckRhdGEsIEFkZFNlcnZlckNsYXNzaWZpY2F0aW9uPignbWNwLmFkZHNlcnZlcicsIHtcblx0XHRcdHBhY2thZ2VUeXBlOiAnc3RkaW8nXG5cdFx0fSk7XG5cblx0XHQvLyBTcGxpdCBjb21tYW5kIGludG8gY29tbWFuZCBhbmQgYXJncywgaGFuZGxpbmcgcXVvdGVzXG5cdFx0Y29uc3QgcGFydHMgPSBjb21tYW5kLm1hdGNoKC8oPzpbXlxcc1wiXSt8XCJbXlwiXSpcIikrL2cpITtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ3N0ZGlvJyxcblx0XHRcdGNvbW1hbmQ6IHBhcnRzWzBdLnJlcGxhY2UoL1wiL2csICcnKSxcblxuXHRcdFx0YXJnczogcGFydHMuc2xpY2UoMSkubWFwKGFyZyA9PiBhcmcucmVwbGFjZSgvXCIvZywgJycpKVxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGdldFNTRUNvbmZpZygpOiBQcm9taXNlPElNY3BDb25maWd1cmF0aW9uU1NFIHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgdXJsID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtY3AudXJsLnRpdGxlJywgXCJFbnRlciBTZXJ2ZXIgVVJMXCIpLFxuXHRcdFx0cGxhY2VIb2xkZXI6IGxvY2FsaXplKCdtY3AudXJsLnBsYWNlaG9sZGVyJywgXCJVUkwgb2YgdGhlIE1DUCBzZXJ2ZXIgKGUuZy4sIGh0dHA6Ly9sb2NhbGhvc3Q6MzAwMClcIiksXG5cdFx0XHRpZ25vcmVGb2N1c0xvc3Q6IHRydWUsXG5cdFx0fSk7XG5cblx0XHRpZiAoIXVybCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8QWRkU2VydmVyRGF0YSwgQWRkU2VydmVyQ2xhc3NpZmljYXRpb24+KCdtY3AuYWRkc2VydmVyJywge1xuXHRcdFx0cGFja2FnZVR5cGU6ICdzc2UnXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0dHlwZTogJ3NzZScsXG5cdFx0XHR1cmxcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRTZXJ2ZXJJZChzdWdnZXN0aW9uID0gYG15LW1jcC1zZXJ2ZXItJHtnZW5lcmF0ZVV1aWQoKS5zcGxpdCgnLScpWzBdfWApOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGlkID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuaW5wdXQoe1xuXHRcdFx0dGl0bGU6IGxvY2FsaXplKCdtY3Auc2VydmVySWQudGl0bGUnLCBcIkVudGVyIFNlcnZlciBJRFwiKSxcblx0XHRcdHBsYWNlSG9sZGVyOiBsb2NhbGl6ZSgnbWNwLnNlcnZlcklkLnBsYWNlaG9sZGVyJywgXCJVbmlxdWUgaWRlbnRpZmllciBmb3IgdGhpcyBzZXJ2ZXJcIiksXG5cdFx0XHR2YWx1ZTogc3VnZ2VzdGlvbixcblx0XHRcdGlnbm9yZUZvY3VzTG9zdDogdHJ1ZSxcblx0XHR9KTtcblxuXHRcdHJldHVybiBpZDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0Q29uZmlndXJhdGlvblRhcmdldCgpOiBQcm9taXNlPENvbmZpZ3VyYXRpb25UYXJnZXQgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBvcHRpb25zOiAoSVF1aWNrUGlja0l0ZW0gJiB7IHRhcmdldDogQ29uZmlndXJhdGlvblRhcmdldCB9KVtdID0gW1xuXHRcdFx0eyB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUiwgbGFiZWw6IGxvY2FsaXplKCdtY3AudGFyZ2V0LnVzZXInLCBcIlVzZXIgU2V0dGluZ3NcIiksIGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnbWNwLnRhcmdldC51c2VyLmRlc2NyaXB0aW9uJywgXCJBdmFpbGFibGUgaW4gYWxsIHdvcmtzcGFjZXNcIikgfVxuXHRcdF07XG5cblx0XHRpZiAoISF0aGlzLl9lbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KSB7XG5cdFx0XHRvcHRpb25zLnB1c2goeyB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9SRU1PVEUsIGxhYmVsOiBsb2NhbGl6ZSgnbWNwLnRhcmdldC5yZW1vdGUnLCBcIlJlbW90ZSBTZXR0aW5nc1wiKSwgZGVzY3JpcHRpb246IGxvY2FsaXplKCdtY3AudGFyZ2V0Li5yZW1vdGUuZGVzY3JpcHRpb24nLCBcIkF2YWlsYWJsZSBvbiB0aGlzIHJlbW90ZSBtYWNoaW5lXCIpIH0pO1xuXHRcdH1cblxuXHRcdGlmICh0aGlzLl93b3Jrc3BhY2VTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMubGVuZ3RoID4gMCkge1xuXHRcdFx0b3B0aW9ucy5wdXNoKHsgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSwgbGFiZWw6IGxvY2FsaXplKCdtY3AudGFyZ2V0LndvcmtzcGFjZScsIFwiV29ya3NwYWNlIFNldHRpbmdzXCIpLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ21jcC50YXJnZXQud29ya3NwYWNlLmRlc2NyaXB0aW9uJywgXCJBdmFpbGFibGUgaW4gdGhpcyB3b3Jrc3BhY2VcIikgfSk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMubGVuZ3RoID09PSAxKSB7XG5cdFx0XHRyZXR1cm4gb3B0aW9uc1swXS50YXJnZXQ7XG5cdFx0fVxuXG5cblx0XHRjb25zdCB0YXJnZXRQaWNrID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhvcHRpb25zLCB7XG5cdFx0XHR0aXRsZTogbG9jYWxpemUoJ21jcC50YXJnZXQudGl0bGUnLCBcIkNob29zZSB3aGVyZSB0byBzYXZlIHRoZSBjb25maWd1cmF0aW9uXCIpLFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHRhcmdldFBpY2s/LnRhcmdldDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0QXNzaXN0ZWRDb25maWcodHlwZTogQXNzaXN0ZWRDb25maWd1cmF0aW9uVHlwZSk6IFByb21pc2U8eyBuYW1lOiBzdHJpbmc7IGNvbmZpZzogTWNwQ29uZmlndXJhdGlvblNlcnZlciB9IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgcGFja2FnZU5hbWUgPSBhd2FpdCB0aGlzLl9xdWlja0lucHV0U2VydmljZS5pbnB1dCh7XG5cdFx0XHRpZ25vcmVGb2N1c0xvc3Q6IHRydWUsXG5cdFx0XHR0aXRsZTogYXNzaXN0ZWRUeXBlc1t0eXBlXS50aXRsZSxcblx0XHRcdHBsYWNlSG9sZGVyOiBhc3Npc3RlZFR5cGVzW3R5cGVdLnBsYWNlaG9sZGVyLFxuXHRcdH0pO1xuXG5cdFx0aWYgKCFwYWNrYWdlTmFtZSkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRjb25zdCBlbnVtIExvYWRBY3Rpb24ge1xuXHRcdFx0UmV0cnkgPSAncmV0cnknLFxuXHRcdFx0Q2FuY2VsID0gJ2NhbmNlbCcsXG5cdFx0XHRBbGxvdyA9ICdhbGxvdydcblx0XHR9XG5cblx0XHRjb25zdCBsb2FkaW5nUXVpY2tQaWNrU3RvcmUgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cdFx0Y29uc3QgbG9hZGluZ1F1aWNrUGljayA9IGxvYWRpbmdRdWlja1BpY2tTdG9yZS5hZGQodGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UuY3JlYXRlUXVpY2tQaWNrPElRdWlja1BpY2tJdGVtICYgeyBpZDogTG9hZEFjdGlvbiB9PigpKTtcblx0XHRsb2FkaW5nUXVpY2tQaWNrLnRpdGxlID0gbG9jYWxpemUoJ21jcC5sb2FkaW5nLnRpdGxlJywgXCJMb2FkaW5nIHBhY2thZ2UgZGV0YWlscy4uLlwiKTtcblx0XHRsb2FkaW5nUXVpY2tQaWNrLmJ1c3kgPSB0cnVlO1xuXHRcdGxvYWRpbmdRdWlja1BpY2suaWdub3JlRm9jdXNPdXQgPSB0cnVlO1xuXG5cdFx0Y29uc3QgcGFja2FnZVR5cGUgPSB0aGlzLmdldFBhY2thZ2VUeXBlKHR5cGUpO1xuXG5cdFx0dGhpcy5fdGVsZW1ldHJ5U2VydmljZS5wdWJsaWNMb2cyPEFkZFNlcnZlckRhdGEsIEFkZFNlcnZlckNsYXNzaWZpY2F0aW9uPignbWNwLmFkZHNlcnZlcicsIHtcblx0XHRcdHBhY2thZ2VUeXBlOiBwYWNrYWdlVHlwZSFcblx0XHR9KTtcblxuXHRcdHRoaXMuX2NvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kPFZhbGlkYXRlUGFja2FnZVJlc3VsdD4oXG5cdFx0XHRBZGRDb25maWd1cmF0aW9uQ29waWxvdENvbW1hbmQuVmFsaWRhdGVQYWNrYWdlLFxuXHRcdFx0e1xuXHRcdFx0XHR0eXBlOiBwYWNrYWdlVHlwZSxcblx0XHRcdFx0bmFtZTogcGFja2FnZU5hbWUsXG5cdFx0XHRcdHRhcmdldENvbmZpZzoge1xuXHRcdFx0XHRcdC4uLm1jcFN0ZGlvU2VydmVyU2NoZW1hLFxuXHRcdFx0XHRcdHByb3BlcnRpZXM6IHtcblx0XHRcdFx0XHRcdC4uLm1jcFN0ZGlvU2VydmVyU2NoZW1hLnByb3BlcnRpZXMsXG5cdFx0XHRcdFx0XHRuYW1lOiB7XG5cdFx0XHRcdFx0XHRcdHR5cGU6ICdzdHJpbmcnLFxuXHRcdFx0XHRcdFx0XHRkZXNjcmlwdGlvbjogJ1N1Z2dlc3RlZCBuYW1lIG9mIHRoZSBzZXJ2ZXIsIGFscGhhbnVtZXJpYyBhbmQgaHlwaGVuIG9ubHknLFxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0cmVxdWlyZWQ6IFsuLi4obWNwU3RkaW9TZXJ2ZXJTY2hlbWEucmVxdWlyZWQgfHwgW10pLCAnbmFtZSddLFxuXHRcdFx0XHR9LFxuXHRcdFx0fVxuXHRcdCkudGhlbihyZXN1bHQgPT4ge1xuXHRcdFx0aWYgKCFyZXN1bHQgfHwgcmVzdWx0LnN0YXRlID09PSAnZXJyb3InKSB7XG5cdFx0XHRcdGxvYWRpbmdRdWlja1BpY2sudGl0bGUgPSByZXN1bHQ/LmVycm9yIHx8ICdVbmtub3duIGVycm9yIGxvYWRpbmcgcGFja2FnZSc7XG5cdFx0XHRcdGxvYWRpbmdRdWlja1BpY2suaXRlbXMgPSBbeyBpZDogTG9hZEFjdGlvbi5SZXRyeSwgbGFiZWw6IGxvY2FsaXplKCdtY3AuZXJyb3IucmV0cnknLCAnVHJ5IGEgZGlmZmVyZW50IHBhY2thZ2UnKSB9LCB7IGlkOiBMb2FkQWN0aW9uLkNhbmNlbCwgbGFiZWw6IGxvY2FsaXplKCdjYW5jZWwnLCAnQ2FuY2VsJykgfV07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRsb2FkaW5nUXVpY2tQaWNrLnRpdGxlID0gbG9jYWxpemUoJ21jcC5jb25maXJtUHVibGlzaCcsICdJbnN0YWxsIHswfSBmcm9tIHsxfT8nLCBwYWNrYWdlTmFtZSwgcmVzdWx0LnB1Ymxpc2hlcik7XG5cdFx0XHRcdGxvYWRpbmdRdWlja1BpY2suaXRlbXMgPSBbXG5cdFx0XHRcdFx0eyBpZDogTG9hZEFjdGlvbi5BbGxvdywgbGFiZWw6IGxvY2FsaXplKCdhbGxvdycsIFwiQWxsb3dcIikgfSxcblx0XHRcdFx0XHR7IGlkOiBMb2FkQWN0aW9uLkNhbmNlbCwgbGFiZWw6IGxvY2FsaXplKCdjYW5jZWwnLCAnQ2FuY2VsJykgfVxuXHRcdFx0XHRdO1xuXHRcdFx0fVxuXHRcdFx0bG9hZGluZ1F1aWNrUGljay5idXN5ID0gZmFsc2U7XG5cdFx0fSk7XG5cblx0XHRjb25zdCBsb2FkaW5nQWN0aW9uID0gYXdhaXQgbmV3IFByb21pc2U8TG9hZEFjdGlvbiB8IHVuZGVmaW5lZD4ocmVzb2x2ZSA9PiB7XG5cdFx0XHRsb2FkaW5nUXVpY2tQaWNrLm9uRGlkQWNjZXB0KCgpID0+IHJlc29sdmUobG9hZGluZ1F1aWNrUGljay5zZWxlY3RlZEl0ZW1zWzBdPy5pZCkpO1xuXHRcdFx0bG9hZGluZ1F1aWNrUGljay5vbkRpZEhpZGUoKCkgPT4gcmVzb2x2ZSh1bmRlZmluZWQpKTtcblx0XHRcdGxvYWRpbmdRdWlja1BpY2suc2hvdygpO1xuXHRcdH0pLmZpbmFsbHkoKCkgPT4gbG9hZGluZ1F1aWNrUGljay5kaXNwb3NlKCkpO1xuXG5cdFx0c3dpdGNoIChsb2FkaW5nQWN0aW9uKSB7XG5cdFx0XHRjYXNlIExvYWRBY3Rpb24uUmV0cnk6XG5cdFx0XHRcdHJldHVybiB0aGlzLmdldEFzc2lzdGVkQ29uZmlnKHR5cGUpO1xuXHRcdFx0Y2FzZSBMb2FkQWN0aW9uLkFsbG93OlxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgTG9hZEFjdGlvbi5DYW5jZWw6XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbmZpZ1dpdGhOYW1lID0gYXdhaXQgdGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQ8TWNwQ29uZmlndXJhdGlvblNlcnZlciAmIHsgbmFtZTogc3RyaW5nIH0+KFxuXHRcdFx0QWRkQ29uZmlndXJhdGlvbkNvcGlsb3RDb21tYW5kLlN0YXJ0Rmxvdyxcblx0XHRcdHtcblx0XHRcdFx0bmFtZTogcGFja2FnZU5hbWUsXG5cdFx0XHRcdHR5cGU6IHBhY2thZ2VUeXBlXG5cdFx0XHR9XG5cdFx0KTtcblxuXHRcdGlmICghY29uZmlnV2l0aE5hbWUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyBuYW1lLCAuLi5jb25maWcgfSA9IGNvbmZpZ1dpdGhOYW1lO1xuXHRcdHJldHVybiB7IG5hbWUsIGNvbmZpZyB9O1xuXHR9XG5cblx0LyoqIFNob3dzIHRoZSBsb2NhdGlvbiBvZiBhIHNlcnZlciBjb25maWcgb25jZSBpdCdzIGRpc2NvdmVyZWQuICovXG5cdHByaXZhdGUgc2hvd09uY2VEaXNjb3ZlcmVkKG5hbWU6IHN0cmluZykge1xuXHRcdGNvbnN0IHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdHN0b3JlLmFkZChhdXRvcnVuKHJlYWRlciA9PiB7XG5cdFx0XHRjb25zdCBjb2xscyA9IHRoaXMuX21jcFJlZ2lzdHJ5LmNvbGxlY3Rpb25zLnJlYWQocmVhZGVyKTtcblx0XHRcdGNvbnN0IG1hdGNoID0gbWFwRmluZEZpcnN0KGNvbGxzLCBjb2xsZWN0aW9uID0+IG1hcEZpbmRGaXJzdChjb2xsZWN0aW9uLnNlcnZlckRlZmluaXRpb25zLnJlYWQocmVhZGVyKSxcblx0XHRcdFx0c2VydmVyID0+IHNlcnZlci5sYWJlbCA9PT0gbmFtZSA/IHsgc2VydmVyLCBjb2xsZWN0aW9uIH0gOiB1bmRlZmluZWQpKTtcblx0XHRcdGlmIChtYXRjaCkge1xuXHRcdFx0XHRpZiAobWF0Y2guY29sbGVjdGlvbi5wcmVzZW50YXRpb24/Lm9yaWdpbikge1xuXHRcdFx0XHRcdHRoaXMuX29wZW5lclNlcnZpY2Uub3BlbkVkaXRvcih7XG5cdFx0XHRcdFx0XHRyZXNvdXJjZTogbWF0Y2guY29sbGVjdGlvbi5wcmVzZW50YXRpb24ub3JpZ2luLFxuXHRcdFx0XHRcdFx0b3B0aW9uczoge1xuXHRcdFx0XHRcdFx0XHRzZWxlY3Rpb246IG1hdGNoLnNlcnZlci5wcmVzZW50YXRpb24/Lm9yaWdpbj8ucmFuZ2UsXG5cdFx0XHRcdFx0XHRcdHByZXNlcnZlRm9jdXM6IHRydWUsXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy5fY29tbWFuZFNlcnZpY2UuZXhlY3V0ZUNvbW1hbmQoTWNwU2VydmVyT3B0aW9uc0NvbW1hbmQuaWQsIG5hbWUpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHN0b3JlLmFkZChkaXNwb3NhYmxlVGltZW91dCgoKSA9PiBzdG9yZS5kaXNwb3NlKCksIDUwMDApKTtcblx0fVxuXG5cdHByaXZhdGUgd3JpdGVUb1VzZXJTZXR0aW5nKG5hbWU6IHN0cmluZywgY29uZmlnOiBNY3BDb25maWd1cmF0aW9uU2VydmVyLCB0YXJnZXQ6IENvbmZpZ3VyYXRpb25UYXJnZXQsIGlucHV0cz86IENvbmZpZ3VyZWRJbnB1dFtdKSB7XG5cdFx0Y29uc3Qgc2V0dGluZ3M6IElNY3BDb25maWd1cmF0aW9uID0geyAuLi5nZXRDb25maWdWYWx1ZUluVGFyZ2V0KHRoaXMuX2NvbmZpZ3VyYXRpb25TZXJ2aWNlLmluc3BlY3Q8SU1jcENvbmZpZ3VyYXRpb24+KG1jcENvbmZpZ3VyYXRpb25TZWN0aW9uKSwgdGFyZ2V0KSB9O1xuXHRcdHNldHRpbmdzLnNlcnZlcnMgPSB7IC4uLnNldHRpbmdzLnNlcnZlcnMsIFtuYW1lXTogY29uZmlnIH07XG5cdFx0aWYgKGlucHV0cykge1xuXHRcdFx0c2V0dGluZ3MuaW5wdXRzID0gWy4uLihzZXR0aW5ncy5pbnB1dHMgfHwgW10pLCAuLi5pbnB1dHNdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UudXBkYXRlVmFsdWUobWNwQ29uZmlndXJhdGlvblNlY3Rpb24sIHNldHRpbmdzLCB0YXJnZXQpO1xuXHR9XG5cblx0cHVibGljIGFzeW5jIHJ1bigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHQvLyBTdGVwIDE6IENob29zZSBzZXJ2ZXIgdHlwZVxuXHRcdGNvbnN0IHNlcnZlclR5cGUgPSBhd2FpdCB0aGlzLmdldFNlcnZlclR5cGUoKTtcblx0XHRpZiAoc2VydmVyVHlwZSA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCAyOiBHZXQgc2VydmVyIGRldGFpbHMgYmFzZWQgb24gdHlwZVxuXHRcdGxldCBzZXJ2ZXJDb25maWc6IE1jcENvbmZpZ3VyYXRpb25TZXJ2ZXIgfCB1bmRlZmluZWQ7XG5cdFx0bGV0IHN1Z2dlc3RlZE5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0XHRzd2l0Y2ggKHNlcnZlclR5cGUpIHtcblx0XHRcdGNhc2UgQWRkQ29uZmlndXJhdGlvblR5cGUuU3RkaW86XG5cdFx0XHRcdHNlcnZlckNvbmZpZyA9IGF3YWl0IHRoaXMuZ2V0U3RkaW9Db25maWcoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLlNTRTpcblx0XHRcdFx0c2VydmVyQ29uZmlnID0gYXdhaXQgdGhpcy5nZXRTU0VDb25maWcoKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLk5wbVBhY2thZ2U6XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLlBpcFBhY2thZ2U6XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLkRvY2tlckltYWdlOiB7XG5cdFx0XHRcdGNvbnN0IHIgPSBhd2FpdCB0aGlzLmdldEFzc2lzdGVkQ29uZmlnKHNlcnZlclR5cGUpO1xuXHRcdFx0XHRzZXJ2ZXJDb25maWcgPSByPy5jb25maWc7XG5cdFx0XHRcdHN1Z2dlc3RlZE5hbWUgPSByPy5uYW1lO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdGFzc2VydE5ldmVyKHNlcnZlclR5cGUpO1xuXHRcdH1cblxuXHRcdGlmICghc2VydmVyQ29uZmlnKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCAzOiBHZXQgc2VydmVyIElEXG5cdFx0Y29uc3Qgc2VydmVySWQgPSBhd2FpdCB0aGlzLmdldFNlcnZlcklkKHN1Z2dlc3RlZE5hbWUpO1xuXHRcdGlmICghc2VydmVySWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBTdGVwIDQ6IENob29zZSBjb25maWd1cmF0aW9uIHRhcmdldCBpZiBubyBjb25maWdVcmkgcHJvdmlkZWRcblx0XHRsZXQgdGFyZ2V0OiBDb25maWd1cmF0aW9uVGFyZ2V0IHwgdW5kZWZpbmVkO1xuXHRcdGNvbnN0IHdvcmtzcGFjZSA9IHRoaXMuX3dvcmtzcGFjZVNlcnZpY2UuZ2V0V29ya3NwYWNlKCk7XG5cdFx0aWYgKCF0aGlzLl9leHBsaWNpdENvbmZpZ1VyaSkge1xuXHRcdFx0dGFyZ2V0ID0gYXdhaXQgdGhpcy5nZXRDb25maWd1cmF0aW9uVGFyZ2V0KCk7XG5cdFx0XHRpZiAoIXRhcmdldCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gU3RlcCA1OiBVcGRhdGUgY29uZmlndXJhdGlvblxuXHRcdGNvbnN0IHdyaXRlVG9VcmlEaXJlY3QgPSB0aGlzLl9leHBsaWNpdENvbmZpZ1VyaVxuXHRcdFx0PyBVUkkucGFyc2UodGhpcy5fZXhwbGljaXRDb25maWdVcmkpXG5cdFx0XHQ6IHRhcmdldCA9PT0gQ29uZmlndXJhdGlvblRhcmdldC5XT1JLU1BBQ0UgJiYgd29ya3NwYWNlLmZvbGRlcnMubGVuZ3RoID09PSAxXG5cdFx0XHRcdD8gVVJJLmpvaW5QYXRoKHdvcmtzcGFjZS5mb2xkZXJzWzBdLnVyaSwgJy52c2NvZGUnLCAnbWNwLmpzb24nKVxuXHRcdFx0XHQ6IHVuZGVmaW5lZDtcblxuXHRcdGlmICh3cml0ZVRvVXJpRGlyZWN0KSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9qc29uRWRpdGluZ1NlcnZpY2Uud3JpdGUod3JpdGVUb1VyaURpcmVjdCwgW3tcblx0XHRcdFx0cGF0aDogWydzZXJ2ZXJzJywgc2VydmVySWRdLFxuXHRcdFx0XHR2YWx1ZTogc2VydmVyQ29uZmlnXG5cdFx0XHR9XSwgdHJ1ZSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGF3YWl0IHRoaXMud3JpdGVUb1VzZXJTZXR0aW5nKHNlcnZlcklkLCBzZXJ2ZXJDb25maWcsIHRhcmdldCEpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhY2thZ2VUeXBlID0gdGhpcy5nZXRQYWNrYWdlVHlwZShzZXJ2ZXJUeXBlKTtcblx0XHRpZiAocGFja2FnZVR5cGUpIHtcblx0XHRcdHRoaXMuX3RlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxBZGRTZXJ2ZXJDb21wbGV0ZWREYXRhLCBBZGRTZXJ2ZXJDb21wbGV0ZWRDbGFzc2lmaWNhdGlvbj4oJ21jcC5hZGRzZXJ2ZXIuY29tcGxldGVkJywge1xuXHRcdFx0XHRwYWNrYWdlVHlwZSxcblx0XHRcdFx0c2VydmVyVHlwZTogc2VydmVyQ29uZmlnLnR5cGUsXG5cdFx0XHRcdHRhcmdldDogdGFyZ2V0ID09PSBDb25maWd1cmF0aW9uVGFyZ2V0LldPUktTUEFDRSA/ICd3b3Jrc3BhY2UnIDogJ3VzZXInXG5cdFx0XHR9KTtcblx0XHR9XG5cblx0XHR0aGlzLnNob3dPbmNlRGlzY292ZXJlZChzZXJ2ZXJJZCk7XG5cdH1cblxuXHRwdWJsaWMgYXN5bmMgcGlja0ZvclVybEhhbmRsZXIocmVzb3VyY2U6IFVSSSwgc2hvd0lzUHJpbWFyeSA9IGZhbHNlKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0Y29uc3QgbmFtZSA9IGRlY29kZVVSSUNvbXBvbmVudChiYXNlbmFtZShyZXNvdXJjZSkpLnJlcGxhY2UoL1xcLmpzb24kLywgJycpO1xuXHRcdGNvbnN0IHBsYWNlSG9sZGVyID0gbG9jYWxpemUoJ2luc3RhbGwudGl0bGUnLCAnSW5zdGFsbCBNQ1Agc2VydmVyIHswfScsIG5hbWUpO1xuXG5cdFx0Y29uc3QgaXRlbXM6IElRdWlja1BpY2tJdGVtW10gPSBbXG5cdFx0XHR7IGlkOiAnaW5zdGFsbCcsIGxhYmVsOiBsb2NhbGl6ZSgnaW5zdGFsbC5zdGFydCcsICdJbnN0YWxsIFNlcnZlcicpLCBkZXNjcmlwdGlvbjogbG9jYWxpemUoJ2luc3RhbGwuZGVzY3JpcHRpb24nLCAnSW5zdGFsbCBpbiB5b3VyIHVzZXIgc2V0dGluZ3MnKSB9LFxuXHRcdFx0eyBpZDogJ3Nob3cnLCBsYWJlbDogbG9jYWxpemUoJ2luc3RhbGwuc2hvdycsICdTaG93IENvbmZpZ3VyYXRpb24nLCBuYW1lKSB9LFxuXHRcdFx0eyBpZDogJ3JlbmFtZScsIGxhYmVsOiBsb2NhbGl6ZSgnaW5zdGFsbC5yZW5hbWUnLCAnUmVuYW1lIFwiezB9XCInLCBuYW1lKSB9LFxuXHRcdFx0eyBpZDogJ2NhbmNlbCcsIGxhYmVsOiBsb2NhbGl6ZSgnY2FuY2VsJywgJ0NhbmNlbCcpIH0sXG5cdFx0XTtcblx0XHRpZiAoc2hvd0lzUHJpbWFyeSkge1xuXHRcdFx0W2l0ZW1zWzBdLCBpdGVtc1sxXV0gPSBbaXRlbXNbMV0sIGl0ZW1zWzBdXTtcblx0XHR9XG5cblx0XHRjb25zdCBwaWNrID0gYXdhaXQgdGhpcy5fcXVpY2tJbnB1dFNlcnZpY2UucGljayhpdGVtcywgeyBwbGFjZUhvbGRlciwgaWdub3JlRm9jdXNMb3N0OiB0cnVlIH0pO1xuXHRcdGNvbnN0IGdldEVkaXRvcnMgPSAoKSA9PiB0aGlzLl9lZGl0b3JTZXJ2aWNlLmdldEVkaXRvcnMoRWRpdG9yc09yZGVyLk1PU1RfUkVDRU5UTFlfQUNUSVZFKVxuXHRcdFx0LmZpbHRlcihlID0+IGUuZWRpdG9yLnJlc291cmNlPy50b1N0cmluZygpID09PSByZXNvdXJjZS50b1N0cmluZygpKTtcblxuXHRcdHN3aXRjaCAocGljaz8uaWQpIHtcblx0XHRcdGNhc2UgJ3Nob3cnOlxuXHRcdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZSB9KTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdpbnN0YWxsJzpcblx0XHRcdFx0YXdhaXQgdGhpcy5fZWRpdG9yU2VydmljZS5zYXZlKGdldEVkaXRvcnMoKSk7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgY29udGVudHMgPSBhd2FpdCB0aGlzLl9maWxlU2VydmljZS5yZWFkRmlsZShyZXNvdXJjZSk7XG5cdFx0XHRcdFx0Y29uc3QgeyBpbnB1dHMsIC4uLmNvbmZpZyB9OiBNY3BDb25maWd1cmF0aW9uU2VydmVyICYgeyBpbnB1dHM/OiBDb25maWd1cmVkSW5wdXRbXSB9ID0gcGFyc2VKc29uYyhjb250ZW50cy52YWx1ZS50b1N0cmluZygpKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLndyaXRlVG9Vc2VyU2V0dGluZyhuYW1lLCBjb25maWcsIENvbmZpZ3VyYXRpb25UYXJnZXQuVVNFUl9MT0NBTCwgaW5wdXRzKTtcblx0XHRcdFx0XHR0aGlzLl9lZGl0b3JTZXJ2aWNlLmNsb3NlRWRpdG9ycyhnZXRFZGl0b3JzKCkpO1xuXHRcdFx0XHRcdHRoaXMuc2hvd09uY2VEaXNjb3ZlcmVkKG5hbWUpO1xuXHRcdFx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5lcnJvcihsb2NhbGl6ZSgnaW5zdGFsbC5lcnJvcicsICdFcnJvciBpbnN0YWxsaW5nIE1DUCBzZXJ2ZXIgezB9OiB7MX0nLCBuYW1lLCBlLm1lc3NhZ2UpKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3IoeyByZXNvdXJjZSB9KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3JlbmFtZSc6IHtcblx0XHRcdFx0Y29uc3QgbmV3TmFtZSA9IGF3YWl0IHRoaXMuX3F1aWNrSW5wdXRTZXJ2aWNlLmlucHV0KHsgcGxhY2VIb2xkZXI6IGxvY2FsaXplKCdpbnN0YWxsLm5ld05hbWUnLCAnRW50ZXIgbmV3IG5hbWUnKSwgdmFsdWU6IG5hbWUgfSk7XG5cdFx0XHRcdGlmIChuZXdOYW1lKSB7XG5cdFx0XHRcdFx0Y29uc3QgbmV3VVJJID0gcmVzb3VyY2Uud2l0aCh7IHBhdGg6IGAvJHtlbmNvZGVVUklDb21wb25lbnQobmV3TmFtZSl9Lmpzb25gIH0pO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2VkaXRvclNlcnZpY2Uuc2F2ZShnZXRFZGl0b3JzKCkpO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2ZpbGVTZXJ2aWNlLm1vdmUocmVzb3VyY2UsIG5ld1VSSSk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXMucGlja0ZvclVybEhhbmRsZXIobmV3VVJJLCBzaG93SXNQcmltYXJ5KTtcblx0XHRcdFx0fVxuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFBhY2thZ2VUeXBlKHNlcnZlclR5cGU6IEFkZENvbmZpZ3VyYXRpb25UeXBlKTogc3RyaW5nIHwgdW5kZWZpbmVkIHtcblx0XHRzd2l0Y2ggKHNlcnZlclR5cGUpIHtcblx0XHRcdGNhc2UgQWRkQ29uZmlndXJhdGlvblR5cGUuTnBtUGFja2FnZTpcblx0XHRcdFx0cmV0dXJuICducG0nO1xuXHRcdFx0Y2FzZSBBZGRDb25maWd1cmF0aW9uVHlwZS5QaXBQYWNrYWdlOlxuXHRcdFx0XHRyZXR1cm4gJ3BpcCc7XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLkRvY2tlckltYWdlOlxuXHRcdFx0XHRyZXR1cm4gJ2RvY2tlcic7XG5cdFx0XHRjYXNlIEFkZENvbmZpZ3VyYXRpb25UeXBlLlN0ZGlvOlxuXHRcdFx0XHRyZXR1cm4gJ3N0ZGlvJztcblx0XHRcdGNhc2UgQWRkQ29uZmlndXJhdGlvblR5cGUuU1NFOlxuXHRcdFx0XHRyZXR1cm4gJ3NzZSc7XG5cdFx0XHRkZWZhdWx0OlxuXHRcdFx0XHRy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QUFDO0FBQ2xILGdCQUFNLEtBQUssZUFBZSxXQUFXLEVBQUUsU0FBUyxDQUFDO0FBQUEsUUFDbEQ7QUFDQTtBQUFBLE1BQ0QsS0FBSyxVQUFVO0FBQ2QsY0FBTSxVQUFVLE1BQU0sS0FBSyxtQkFBbUIsTUFBTSxFQUFFLGFBQWEsU0FBUyxtQkFBbUIsZ0JBQWdCLEdBQUcsT0FBTyxLQUFLLENBQUM7QUFDL0gsWUFBSSxTQUFTO0FBQ1osZ0JBQU0sU0FBUyxTQUFTLEtBQUssRUFBRSxNQUFNLElBQUksbUJBQW1CLE9BQU8sQ0FBQyxRQUFRLENBQUM7QUFDN0UsZ0JBQU0sS0FBSyxlQUFlLEtBQUssV0FBVyxDQUFDO0FBQzNDLGdCQUFNLEtBQUssYUFBYSxLQUFLLFVBQVUsTUFBTTtBQUM3QyxpQkFBTyxLQUFLLGtCQUFrQixRQUFRLGFBQWE7QUFBQSxRQUNwRDtBQUNBO0FBQUEsTUFDRDtBQUFBLElBQ0Q7QUFBQSxFQUNEO0FBQUEsRUFFUSxlQUFlLFlBQXNEO0FBQzVFLFlBQVEsWUFBWTtBQUFBLE1BQ25CLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1IsS0FBSztBQUNKLGVBQU87QUFBQSxNQUNSLEtBQUs7QUFDSixlQUFPO0FBQUEsTUFDUixLQUFLO0FBQ0osZUFBTztBQUFBLE1BQ1I7QUFDQyxlQUFPO0FBQUEsSUFDVDtBQUFBLEVBQ0Q7QUFDRDtBQWhaYSw2QkFBTjtBQUFBLEVBR0o7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEdBZFU7IiwKICAibmFtZXMiOiBbIkFkZENvbmZpZ3VyYXRpb25UeXBlIiwgIkFkZENvbmZpZ3VyYXRpb25Db3BpbG90Q29tbWFuZCIsICJMb2FkQWN0aW9uIl0KfQo=
