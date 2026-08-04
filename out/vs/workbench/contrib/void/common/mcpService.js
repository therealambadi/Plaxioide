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
import { URI } from "../../../../base/common/uri.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IPathService } from "../../../services/path/common/pathService.js";
import { IEditorService } from "../../../services/editor/common/editorService.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { VSBuffer } from "../../../../base/common/buffer.js";
import { IMainProcessService } from "../../../../platform/ipc/common/mainProcessService.js";
import { Emitter } from "../../../../base/common/event.js";
import { IVoidSettingsService } from "./voidSettingsService.js";
const IMCPService = createDecorator("mcpConfigService");
const MCP_CONFIG_FILE_NAME = "mcp.json";
const MCP_CONFIG_SAMPLE = { mcpServers: {} };
const MCP_CONFIG_SAMPLE_STRING = JSON.stringify(MCP_CONFIG_SAMPLE, null, 2);
let MCPService = class extends Disposable {
  // private readonly _onLoadingServersChange = new Emitter<MCPServerEventLoadingParam>();
  // public readonly onLoadingServersChange = this._onLoadingServersChange.event;
  constructor(fileService, pathService, productService, editorService, mainProcessService, voidSettingsService) {
    super();
    this.fileService = fileService;
    this.pathService = pathService;
    this.productService = productService;
    this.editorService = editorService;
    this.mainProcessService = mainProcessService;
    this.voidSettingsService = voidSettingsService;
    // MCPChannel
    // list of MCP servers pulled from mcpChannel
    this.state = {
      mcpServerOfName: {},
      error: void 0
    };
    // Emitters for server events
    this._onDidChangeState = new Emitter();
    this.onDidChangeState = this._onDidChangeState.event;
    this._setMCPServerState = async (serverName, newServer) => {
      if (newServer === void 0) {
        const { [serverName]: removed, ...remainingServers } = this.state.mcpServerOfName;
        this.state = {
          ...this.state,
          mcpServerOfName: remainingServers
        };
      } else {
        this.state = {
          ...this.state,
          mcpServerOfName: {
            ...this.state.mcpServerOfName,
            [serverName]: newServer
          }
        };
      }
      this._onDidChangeState.fire();
    };
    this._setHasError = async (errMsg) => {
      this.state = {
        ...this.state,
        error: errMsg
      };
      this._onDidChangeState.fire();
    };
    this.channel = this.mainProcessService.getChannel("void-channel-mcp");
    const onEvent = (e) => {
      this._setMCPServerState(e.response.name, e.response.newServer);
    };
    this._register(this.channel.listen("onAdd_server")(onEvent));
    this._register(this.channel.listen("onUpdate_server")(onEvent));
    this._register(this.channel.listen("onDelete_server")(onEvent));
    this._initialize();
  }
  async _initialize() {
    try {
      await this.voidSettingsService.waitForInitState;
      const mcpConfigUri = await this._getMCPConfigFilePath();
      const fileExists = await this._configFileExists(mcpConfigUri);
      if (!fileExists) {
        await this._createMCPConfigFile(mcpConfigUri);
        console.log("MCP Config file created:", mcpConfigUri.toString());
      }
      await this._addMCPConfigFileWatcher();
      await this._refreshMCPServers();
    } catch (error) {
      console.error("Error initializing MCPService:", error);
    }
  }
  // Create the file/directory if it doesn't exist
  async _createMCPConfigFile(mcpConfigUri) {
    await this.fileService.createFile(mcpConfigUri.with({ path: mcpConfigUri.path }));
    const buffer = VSBuffer.fromString(MCP_CONFIG_SAMPLE_STRING);
    await this.fileService.writeFile(mcpConfigUri, buffer);
  }
  async _addMCPConfigFileWatcher() {
    const mcpConfigUri = await this._getMCPConfigFilePath();
    this._register(
      this.fileService.watch(mcpConfigUri)
    );
    this._register(this.fileService.onDidFilesChange(async (e) => {
      if (!e.contains(mcpConfigUri)) return;
      await this._refreshMCPServers();
    }));
  }
  // Client-side functions
  async revealMCPConfigFile() {
    try {
      const mcpConfigUri = await this._getMCPConfigFilePath();
      await this.editorService.openEditor({
        resource: mcpConfigUri,
        options: {
          pinned: true,
          revealIfOpened: true
        }
      });
    } catch (error) {
      console.error("Error opening MCP config file:", error);
    }
  }
  getMCPTools() {
    const allTools = [];
    for (const serverName in this.state.mcpServerOfName) {
      const server = this.state.mcpServerOfName[serverName];
      server.tools?.forEach((tool) => {
        allTools.push({
          description: tool.description || "",
          params: this._transformInputSchemaToParams(tool.inputSchema),
          name: tool.name,
          mcpServerName: serverName
        });
      });
    }
    if (allTools.length === 0) return void 0;
    return allTools;
  }
  _transformInputSchemaToParams(inputSchema) {
    if (!inputSchema || !inputSchema.properties) return {};
    const params = {};
    Object.keys(inputSchema.properties).forEach((paramName) => {
      const propertyValues = inputSchema.properties[paramName];
      if (typeof propertyValues !== "object") {
        console.warn(`Invalid property value for ${paramName}: expected object, got ${typeof propertyValues}`);
        return;
      }
      params[paramName] = {
        description: JSON.stringify(propertyValues.description || "", null, 2) || ""
      };
    });
    return params;
  }
  async _getMCPConfigFilePath() {
    const appName = this.productService.dataFolderName;
    const userHome = await this.pathService.userHome();
    const uri = URI.joinPath(userHome, appName, MCP_CONFIG_FILE_NAME);
    return uri;
  }
  async _configFileExists(mcpConfigUri) {
    try {
      await this.fileService.stat(mcpConfigUri);
      return true;
    } catch (error) {
      return false;
    }
  }
  async _parseMCPConfigFile() {
    const mcpConfigUri = await this._getMCPConfigFilePath();
    try {
      const fileContent = await this.fileService.readFile(mcpConfigUri);
      const contentString = fileContent.value.toString();
      const configFileJson = JSON.parse(contentString);
      if (!configFileJson.mcpServers) {
        throw new Error("Missing mcpServers property");
      }
      return configFileJson;
    } catch (error) {
      const fullError = `Error parsing MCP config file: ${error}`;
      this._setHasError(fullError);
      return null;
    }
  }
  // Handle server state changes
  async _refreshMCPServers() {
    this._setHasError(void 0);
    const newConfigFileJSON = await this._parseMCPConfigFile();
    if (!newConfigFileJSON) {
      console.log(`Not setting state: MCP config file not found`);
      return;
    }
    if (!newConfigFileJSON?.mcpServers) {
      console.log(`Not setting state: MCP config file did not have an 'mcpServers' field`);
      return;
    }
    const oldConfigFileNames = Object.keys(this.state.mcpServerOfName);
    const newConfigFileNames = Object.keys(newConfigFileJSON.mcpServers);
    const addedServerNames = newConfigFileNames.filter((serverName) => !oldConfigFileNames.includes(serverName));
    const removedServerNames = oldConfigFileNames.filter((serverName) => !newConfigFileNames.includes(serverName));
    const addedUserStateOfName = {};
    for (const name of addedServerNames) {
      addedUserStateOfName[name] = { isOn: true };
    }
    await this.voidSettingsService.addMCPUserStateOfNames(addedUserStateOfName);
    await this.voidSettingsService.removeMCPUserStateOfNames(removedServerNames);
    for (const serverName in newConfigFileJSON.mcpServers) {
      this._setMCPServerState(serverName, { status: "loading", tools: [] });
    }
    const updatedServerNames = Object.keys(newConfigFileJSON.mcpServers).filter((serverName) => !addedServerNames.includes(serverName) && !removedServerNames.includes(serverName));
    this.channel.call("refreshMCPServers", {
      mcpConfigFileJSON: newConfigFileJSON,
      addedServerNames,
      removedServerNames,
      updatedServerNames,
      userStateOfName: this.voidSettingsService.state.mcpUserStateOfName
    });
  }
  stringifyResult(result) {
    let toolResultStr;
    if (result.event === "text") {
      toolResultStr = result.text;
    } else if (result.event === "image") {
      toolResultStr = `[Image: ${result.image.mimeType}]`;
    } else if (result.event === "audio") {
      toolResultStr = `[Audio content]`;
    } else if (result.event === "resource") {
      toolResultStr = `[Resource content]`;
    } else {
      toolResultStr = JSON.stringify(result);
    }
    return toolResultStr;
  }
  // toggle MCP server and update isOn in void settings
  async toggleServerIsOn(serverName, isOn) {
    this._setMCPServerState(serverName, { status: "loading", tools: [] });
    await this.voidSettingsService.setMCPServerState(serverName, { isOn });
    this.channel.call("toggleMCPServer", { serverName, isOn });
  }
  async callMCPTool(toolData) {
    const result = await this.channel.call("callTool", toolData);
    if (result.event === "error") {
      throw new Error(`Error: ${result.text}`);
    }
    return { result };
  }
  // public getMCPToolFns(): MCPToolResultType {
  // 	const tools = this.getMCPTools();
  // 	const toolFns: MCPToolResultType = {};
  // 	tools.forEach((tool) => {
  // 		const name = tool.name;
  // 		// Define the tool call function
  // 		const toolFn = async (params: {
  // 			serverName: string,
  // 			toolName: string,
  // 			args: any
  // 		}) => {
  // 			const { serverName, toolName, args } = params;
  // 			const response = await this.callMCPTool({
  // 				serverName,
  // 				toolName,
  // 				params: args,
  // 			});
  // 			return { result: response }
  // 		};
  // 		toolFns[name] = toolFn;
  // 	});
  // 	return toolFns
  // }
};
MCPService = __decorateClass([
  __decorateParam(0, IFileService),
  __decorateParam(1, IPathService),
  __decorateParam(2, IProductService),
  __decorateParam(3, IEditorService),
  __decorateParam(4, IMainProcessService),
  __decorateParam(5, IVoidSettingsService)
], MCPService);
registerSingleton(IMCPService, MCPService, InstantiationType.Eager);
export {
  IMCPService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2NvbW1vbi9tY3BTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IDIwMjUgR2xhc3MgRGV2dG9vbHMsIEluYy4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgQXBhY2hlIExpY2Vuc2UsIFZlcnNpb24gMi4wLiBTZWUgTElDRU5TRS50eHQgZm9yIG1vcmUgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcmVnaXN0ZXJTaW5nbGV0b24sIEluc3RhbnRpYXRpb25UeXBlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBjcmVhdGVEZWNvcmF0b3IgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElGaWxlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2ZpbGVzL2NvbW1vbi9maWxlcy5qcyc7XG5pbXBvcnQgeyBJUGF0aFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9wYXRoL2NvbW1vbi9wYXRoU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRWRpdG9yU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2VkaXRvci9jb21tb24vZWRpdG9yU2VydmljZS5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBWU0J1ZmZlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2J1ZmZlci5qcyc7XG5pbXBvcnQgeyBJQ2hhbm5lbCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvcGFydHMvaXBjL2NvbW1vbi9pcGMuanMnO1xuaW1wb3J0IHsgSU1haW5Qcm9jZXNzU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2lwYy9jb21tb24vbWFpblByb2Nlc3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IE1DUFNlcnZlck9mTmFtZSwgTUNQQ29uZmlnRmlsZUpTT04sIE1DUFNlcnZlciwgTUNQVG9vbENhbGxQYXJhbXMsIFJhd01DUFRvb2xDYWxsLCBNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlIH0gZnJvbSAnLi9tY3BTZXJ2aWNlVHlwZXMuanMnO1xuaW1wb3J0IHsgRXZlbnQsIEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJbnRlcm5hbFRvb2xJbmZvIH0gZnJvbSAnLi9wcm9tcHQvcHJvbXB0cy5qcyc7XG5pbXBvcnQgeyBJVm9pZFNldHRpbmdzU2VydmljZSB9IGZyb20gJy4vdm9pZFNldHRpbmdzU2VydmljZS5qcyc7XG5pbXBvcnQgeyBNQ1BVc2VyU3RhdGVPZk5hbWUgfSBmcm9tICcuL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcblxuXG50eXBlIE1DUFNlcnZpY2VTdGF0ZSA9IHtcblx0bWNwU2VydmVyT2ZOYW1lOiBNQ1BTZXJ2ZXJPZk5hbWUsXG5cdGVycm9yOiBzdHJpbmcgfCB1bmRlZmluZWQsIC8vIGdsb2JhbCBwYXJzaW5nIGVycm9yXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSU1DUFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdHJldmVhbE1DUENvbmZpZ0ZpbGUoKTogUHJvbWlzZTx2b2lkPjtcblx0dG9nZ2xlU2VydmVySXNPbihzZXJ2ZXJOYW1lOiBzdHJpbmcsIGlzT246IGJvb2xlYW4pOiBQcm9taXNlPHZvaWQ+O1xuXG5cdHJlYWRvbmx5IHN0YXRlOiBNQ1BTZXJ2aWNlU3RhdGU7IC8vIE5PVCBwZXJzaXN0ZWRcblx0b25EaWRDaGFuZ2VTdGF0ZTogRXZlbnQ8dm9pZD47XG5cblx0Z2V0TUNQVG9vbHMoKTogSW50ZXJuYWxUb29sSW5mb1tdIHwgdW5kZWZpbmVkO1xuXHRjYWxsTUNQVG9vbCh0b29sRGF0YTogTUNQVG9vbENhbGxQYXJhbXMpOiBQcm9taXNlPHsgcmVzdWx0OiBSYXdNQ1BUb29sQ2FsbCB9Pjtcblx0c3RyaW5naWZ5UmVzdWx0KHJlc3VsdDogUmF3TUNQVG9vbENhbGwpOiBzdHJpbmdcbn1cblxuZXhwb3J0IGNvbnN0IElNQ1BTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElNQ1BTZXJ2aWNlPignbWNwQ29uZmlnU2VydmljZScpO1xuXG5cblxuY29uc3QgTUNQX0NPTkZJR19GSUxFX05BTUUgPSAnbWNwLmpzb24nO1xuY29uc3QgTUNQX0NPTkZJR19TQU1QTEUgPSB7IG1jcFNlcnZlcnM6IHt9IH1cbmNvbnN0IE1DUF9DT05GSUdfU0FNUExFX1NUUklORyA9IEpTT04uc3RyaW5naWZ5KE1DUF9DT05GSUdfU0FNUExFLCBudWxsLCAyKTtcblxuXG4vLyBleHBvcnQgaW50ZXJmYWNlIE1DUENhbGxUb29sT2ZUb29sTmFtZSB7XG4vLyBcdFt0b29sTmFtZTogc3RyaW5nXTogKHBhcmFtczogYW55KSA9PiBQcm9taXNlPHtcbi8vIFx0XHRyZXN1bHQ6IGFueSB8IFByb21pc2U8YW55Pixcbi8vIFx0XHRpbnRlcnJ1cHRUb29sPzogKCkgPT4gdm9pZFxuLy8gXHR9Pjtcbi8vIH1cblxuXG5jbGFzcyBNQ1BTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElNQ1BTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cblx0cHJpdmF0ZSByZWFkb25seSBjaGFubmVsOiBJQ2hhbm5lbCAvLyBNQ1BDaGFubmVsXG5cblx0Ly8gbGlzdCBvZiBNQ1Agc2VydmVycyBwdWxsZWQgZnJvbSBtY3BDaGFubmVsXG5cdHN0YXRlOiBNQ1BTZXJ2aWNlU3RhdGUgPSB7XG5cdFx0bWNwU2VydmVyT2ZOYW1lOiB7fSxcblx0XHRlcnJvcjogdW5kZWZpbmVkLFxuXHR9XG5cblx0Ly8gRW1pdHRlcnMgZm9yIHNlcnZlciBldmVudHNcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2VTdGF0ZSA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZENoYW5nZVN0YXRlID0gdGhpcy5fb25EaWRDaGFuZ2VTdGF0ZS5ldmVudDtcblxuXHQvLyBwcml2YXRlIHJlYWRvbmx5IF9vbkxvYWRpbmdTZXJ2ZXJzQ2hhbmdlID0gbmV3IEVtaXR0ZXI8TUNQU2VydmVyRXZlbnRMb2FkaW5nUGFyYW0+KCk7XG5cdC8vIHB1YmxpYyByZWFkb25seSBvbkxvYWRpbmdTZXJ2ZXJzQ2hhbmdlID0gdGhpcy5fb25Mb2FkaW5nU2VydmVyc0NoYW5nZS5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUZpbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASVBhdGhTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcGF0aFNlcnZpY2U6IElQYXRoU2VydmljZSxcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASUVkaXRvclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBlZGl0b3JTZXJ2aWNlOiBJRWRpdG9yU2VydmljZSxcblx0XHRASU1haW5Qcm9jZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IG1haW5Qcm9jZXNzU2VydmljZTogSU1haW5Qcm9jZXNzU2VydmljZSxcblx0XHRASVZvaWRTZXR0aW5nc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB2b2lkU2V0dGluZ3NTZXJ2aWNlOiBJVm9pZFNldHRpbmdzU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLmNoYW5uZWwgPSB0aGlzLm1haW5Qcm9jZXNzU2VydmljZS5nZXRDaGFubmVsKCd2b2lkLWNoYW5uZWwtbWNwJylcblxuXG5cdFx0Y29uc3Qgb25FdmVudCA9IChlOiBNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlKSA9PiB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygnR09UIEVWRU5UJywgZSlcblx0XHRcdHRoaXMuX3NldE1DUFNlcnZlclN0YXRlKGUucmVzcG9uc2UubmFtZSwgZS5yZXNwb25zZS5uZXdTZXJ2ZXIpXG5cdFx0fVxuXHRcdHRoaXMuX3JlZ2lzdGVyKCh0aGlzLmNoYW5uZWwubGlzdGVuKCdvbkFkZF9zZXJ2ZXInKSBzYXRpc2ZpZXMgRXZlbnQ8TUNQU2VydmVyRXZlbnRSZXNwb25zZT4pKG9uRXZlbnQpKTtcblx0XHR0aGlzLl9yZWdpc3RlcigodGhpcy5jaGFubmVsLmxpc3Rlbignb25VcGRhdGVfc2VydmVyJykgc2F0aXNmaWVzIEV2ZW50PE1DUFNlcnZlckV2ZW50UmVzcG9uc2U+KShvbkV2ZW50KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoKHRoaXMuY2hhbm5lbC5saXN0ZW4oJ29uRGVsZXRlX3NlcnZlcicpIHNhdGlzZmllcyBFdmVudDxNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlPikob25FdmVudCkpO1xuXG5cdFx0dGhpcy5faW5pdGlhbGl6ZSgpO1xuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF9pbml0aWFsaXplKCkge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLnZvaWRTZXR0aW5nc1NlcnZpY2Uud2FpdEZvckluaXRTdGF0ZTtcblxuXHRcdFx0Ly8gQ3JlYXRlIC5tY3BDb25maWcgaWYgaXQgZG9lc24ndCBleGlzdFxuXHRcdFx0Y29uc3QgbWNwQ29uZmlnVXJpID0gYXdhaXQgdGhpcy5fZ2V0TUNQQ29uZmlnRmlsZVBhdGgoKTtcblx0XHRcdGNvbnN0IGZpbGVFeGlzdHMgPSBhd2FpdCB0aGlzLl9jb25maWdGaWxlRXhpc3RzKG1jcENvbmZpZ1VyaSk7XG5cdFx0XHRpZiAoIWZpbGVFeGlzdHMpIHtcblx0XHRcdFx0YXdhaXQgdGhpcy5fY3JlYXRlTUNQQ29uZmlnRmlsZShtY3BDb25maWdVcmkpO1xuXHRcdFx0XHRjb25zb2xlLmxvZygnTUNQIENvbmZpZyBmaWxlIGNyZWF0ZWQ6JywgbWNwQ29uZmlnVXJpLnRvU3RyaW5nKCkpO1xuXHRcdFx0fVxuXHRcdFx0YXdhaXQgdGhpcy5fYWRkTUNQQ29uZmlnRmlsZVdhdGNoZXIoKTtcblx0XHRcdGF3YWl0IHRoaXMuX3JlZnJlc2hNQ1BTZXJ2ZXJzKCk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoJ0Vycm9yIGluaXRpYWxpemluZyBNQ1BTZXJ2aWNlOicsIGVycm9yKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXRNQ1BTZXJ2ZXJTdGF0ZSA9IGFzeW5jIChzZXJ2ZXJOYW1lOiBzdHJpbmcsIG5ld1NlcnZlcjogTUNQU2VydmVyIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0aWYgKG5ld1NlcnZlciA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHQvLyBSZW1vdmUgdGhlIHNlcnZlciBmcm9tIHRoZSBzdGF0ZVxuXHRcdFx0Y29uc3QgeyBbc2VydmVyTmFtZV06IHJlbW92ZWQsIC4uLnJlbWFpbmluZ1NlcnZlcnMgfSA9IHRoaXMuc3RhdGUubWNwU2VydmVyT2ZOYW1lO1xuXHRcdFx0dGhpcy5zdGF0ZSA9IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZSxcblx0XHRcdFx0bWNwU2VydmVyT2ZOYW1lOiByZW1haW5pbmdTZXJ2ZXJzXG5cdFx0XHR9XG5cdFx0fSBlbHNlIHtcblx0XHRcdC8vIEFkZCBvciB1cGRhdGUgdGhlIHNlcnZlclxuXHRcdFx0dGhpcy5zdGF0ZSA9IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZSxcblx0XHRcdFx0bWNwU2VydmVyT2ZOYW1lOiB7XG5cdFx0XHRcdFx0Li4udGhpcy5zdGF0ZS5tY3BTZXJ2ZXJPZk5hbWUsXG5cdFx0XHRcdFx0W3NlcnZlck5hbWVdOiBuZXdTZXJ2ZXJcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3NldEhhc0Vycm9yID0gYXN5bmMgKGVyck1zZzogc3RyaW5nIHwgdW5kZWZpbmVkKSA9PiB7XG5cdFx0dGhpcy5zdGF0ZSA9IHtcblx0XHRcdC4uLnRoaXMuc3RhdGUsXG5cdFx0XHRlcnJvcjogZXJyTXNnLFxuXHRcdH1cblx0XHR0aGlzLl9vbkRpZENoYW5nZVN0YXRlLmZpcmUoKTtcblx0fVxuXG5cdC8vIENyZWF0ZSB0aGUgZmlsZS9kaXJlY3RvcnkgaWYgaXQgZG9lc24ndCBleGlzdFxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVNQ1BDb25maWdGaWxlKG1jcENvbmZpZ1VyaTogVVJJKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5maWxlU2VydmljZS5jcmVhdGVGaWxlKG1jcENvbmZpZ1VyaS53aXRoKHsgcGF0aDogbWNwQ29uZmlnVXJpLnBhdGggfSkpO1xuXHRcdGNvbnN0IGJ1ZmZlciA9IFZTQnVmZmVyLmZyb21TdHJpbmcoTUNQX0NPTkZJR19TQU1QTEVfU1RSSU5HKTtcblx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLndyaXRlRmlsZShtY3BDb25maWdVcmksIGJ1ZmZlcik7XG5cdH1cblxuXG5cdHByaXZhdGUgYXN5bmMgX2FkZE1DUENvbmZpZ0ZpbGVXYXRjaGVyKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1jcENvbmZpZ1VyaSA9IGF3YWl0IHRoaXMuX2dldE1DUENvbmZpZ0ZpbGVQYXRoKCk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIoXG5cdFx0XHR0aGlzLmZpbGVTZXJ2aWNlLndhdGNoKG1jcENvbmZpZ1VyaSlcblx0XHQpXG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmZpbGVTZXJ2aWNlLm9uRGlkRmlsZXNDaGFuZ2UoYXN5bmMgZSA9PiB7XG5cdFx0XHRpZiAoIWUuY29udGFpbnMobWNwQ29uZmlnVXJpKSkgcmV0dXJuXG5cdFx0XHRhd2FpdCB0aGlzLl9yZWZyZXNoTUNQU2VydmVycygpO1xuXHRcdH0pKTtcblx0fVxuXG5cdC8vIENsaWVudC1zaWRlIGZ1bmN0aW9uc1xuXG5cdHB1YmxpYyBhc3luYyByZXZlYWxNQ1BDb25maWdGaWxlKCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBtY3BDb25maWdVcmkgPSBhd2FpdCB0aGlzLl9nZXRNQ1BDb25maWdGaWxlUGF0aCgpO1xuXHRcdFx0YXdhaXQgdGhpcy5lZGl0b3JTZXJ2aWNlLm9wZW5FZGl0b3Ioe1xuXHRcdFx0XHRyZXNvdXJjZTogbWNwQ29uZmlnVXJpLFxuXHRcdFx0XHRvcHRpb25zOiB7XG5cdFx0XHRcdFx0cGlubmVkOiB0cnVlLFxuXHRcdFx0XHRcdHJldmVhbElmT3BlbmVkOiB0cnVlLFxuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc29sZS5lcnJvcignRXJyb3Igb3BlbmluZyBNQ1AgY29uZmlnIGZpbGU6JywgZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBnZXRNQ1BUb29scygpOiBJbnRlcm5hbFRvb2xJbmZvW10gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGFsbFRvb2xzOiBJbnRlcm5hbFRvb2xJbmZvW10gPSBbXVxuXHRcdGZvciAoY29uc3Qgc2VydmVyTmFtZSBpbiB0aGlzLnN0YXRlLm1jcFNlcnZlck9mTmFtZSkge1xuXHRcdFx0Y29uc3Qgc2VydmVyID0gdGhpcy5zdGF0ZS5tY3BTZXJ2ZXJPZk5hbWVbc2VydmVyTmFtZV07XG5cdFx0XHRzZXJ2ZXIudG9vbHM/LmZvckVhY2godG9vbCA9PiB7XG5cdFx0XHRcdGFsbFRvb2xzLnB1c2goe1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiB0b29sLmRlc2NyaXB0aW9uIHx8ICcnLFxuXHRcdFx0XHRcdHBhcmFtczogdGhpcy5fdHJhbnNmb3JtSW5wdXRTY2hlbWFUb1BhcmFtcyh0b29sLmlucHV0U2NoZW1hKSxcblx0XHRcdFx0XHRuYW1lOiB0b29sLm5hbWUsXG5cdFx0XHRcdFx0bWNwU2VydmVyTmFtZTogc2VydmVyTmFtZSxcblx0XHRcdFx0fSlcblx0XHRcdH0pXG5cdFx0fVxuXHRcdGlmIChhbGxUb29scy5sZW5ndGggPT09IDApIHJldHVybiB1bmRlZmluZWRcblx0XHRyZXR1cm4gYWxsVG9vbHNcblx0fVxuXG5cdHByaXZhdGUgX3RyYW5zZm9ybUlucHV0U2NoZW1hVG9QYXJhbXMoaW5wdXRTY2hlbWE/OiBSZWNvcmQ8c3RyaW5nLCBhbnk+KTogeyBbcGFyYW1OYW1lOiBzdHJpbmddOiB7IGRlc2NyaXB0aW9uOiBzdHJpbmcgfSB9IHtcblxuXHRcdC8vIENoZWNrIGlmIGlucHV0U2NoZW1hIGlzIHZhbGlkXG5cdFx0aWYgKCFpbnB1dFNjaGVtYSB8fCAhaW5wdXRTY2hlbWEucHJvcGVydGllcykgcmV0dXJuIHt9O1xuXG5cdFx0Y29uc3QgcGFyYW1zOiB7IFtwYXJhbU5hbWU6IHN0cmluZ106IHsgZGVzY3JpcHRpb246IHN0cmluZyB9IH0gPSB7fTtcblx0XHRPYmplY3Qua2V5cyhpbnB1dFNjaGVtYS5wcm9wZXJ0aWVzKS5mb3JFYWNoKHBhcmFtTmFtZSA9PiB7XG5cdFx0XHRjb25zdCBwcm9wZXJ0eVZhbHVlcyA9IGlucHV0U2NoZW1hLnByb3BlcnRpZXNbcGFyYW1OYW1lXTtcblxuXHRcdFx0Ly8gQ2hlY2sgaWYgcHJvcGVydHlWYWx1ZXMgaXMgbm90IGFuIG9iamVjdFxuXHRcdFx0aWYgKHR5cGVvZiBwcm9wZXJ0eVZhbHVlcyAhPT0gJ29iamVjdCcpIHtcblx0XHRcdFx0Y29uc29sZS53YXJuKGBJbnZhbGlkIHByb3BlcnR5IHZhbHVlIGZvciAke3BhcmFtTmFtZX06IGV4cGVjdGVkIG9iamVjdCwgZ290ICR7dHlwZW9mIHByb3BlcnR5VmFsdWVzfWApO1xuXHRcdFx0XHRyZXR1cm47IC8vIGluIGZvckVhY2ggdGhlIHJldHVybiBpcyBlcXVpdmFsZW50IHRvIGNvbnRpbnVlXG5cdFx0XHR9XG5cblx0XHRcdC8vIEFkZCB0aGUgcGFyYW1ldGVyIHRvIHRoZSBwYXJhbXMgb2JqZWN0XG5cdFx0XHRwYXJhbXNbcGFyYW1OYW1lXSA9IHtcblx0XHRcdFx0ZGVzY3JpcHRpb246IEpTT04uc3RyaW5naWZ5KHByb3BlcnR5VmFsdWVzLmRlc2NyaXB0aW9uIHx8ICcnLCBudWxsLCAyKSB8fCAnJyxcblx0XHRcdH1cblx0XHR9KTtcblx0XHRyZXR1cm4gcGFyYW1zO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfZ2V0TUNQQ29uZmlnRmlsZVBhdGgoKTogUHJvbWlzZTxVUkk+IHtcblx0XHRjb25zdCBhcHBOYW1lID0gdGhpcy5wcm9kdWN0U2VydmljZS5kYXRhRm9sZGVyTmFtZVxuXHRcdGNvbnN0IHVzZXJIb21lID0gYXdhaXQgdGhpcy5wYXRoU2VydmljZS51c2VySG9tZSgpO1xuXHRcdGNvbnN0IHVyaSA9IFVSSS5qb2luUGF0aCh1c2VySG9tZSwgYXBwTmFtZSwgTUNQX0NPTkZJR19GSUxFX05BTUUpXG5cdFx0cmV0dXJuIHVyaVxuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBfY29uZmlnRmlsZUV4aXN0cyhtY3BDb25maWdVcmk6IFVSSSk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdHRyeSB7XG5cdFx0XHRhd2FpdCB0aGlzLmZpbGVTZXJ2aWNlLnN0YXQobWNwQ29uZmlnVXJpKTtcblx0XHRcdHJldHVybiB0cnVlO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF9wYXJzZU1DUENvbmZpZ0ZpbGUoKTogUHJvbWlzZTxNQ1BDb25maWdGaWxlSlNPTiB8IG51bGw+IHtcblx0XHRjb25zdCBtY3BDb25maWdVcmkgPSBhd2FpdCB0aGlzLl9nZXRNQ1BDb25maWdGaWxlUGF0aCgpO1xuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCBmaWxlQ29udGVudCA9IGF3YWl0IHRoaXMuZmlsZVNlcnZpY2UucmVhZEZpbGUobWNwQ29uZmlnVXJpKTtcblx0XHRcdGNvbnN0IGNvbnRlbnRTdHJpbmcgPSBmaWxlQ29udGVudC52YWx1ZS50b1N0cmluZygpO1xuXHRcdFx0Y29uc3QgY29uZmlnRmlsZUpzb24gPSBKU09OLnBhcnNlKGNvbnRlbnRTdHJpbmcpO1xuXHRcdFx0aWYgKCFjb25maWdGaWxlSnNvbi5tY3BTZXJ2ZXJzKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTWlzc2luZyBtY3BTZXJ2ZXJzIHByb3BlcnR5Jyk7XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gY29uZmlnRmlsZUpzb24gYXMgTUNQQ29uZmlnRmlsZUpTT047XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdGNvbnN0IGZ1bGxFcnJvciA9IGBFcnJvciBwYXJzaW5nIE1DUCBjb25maWcgZmlsZTogJHtlcnJvcn1gO1xuXHRcdFx0dGhpcy5fc2V0SGFzRXJyb3IoZnVsbEVycm9yKVxuXHRcdFx0cmV0dXJuIG51bGw7XG5cdFx0fVxuXHR9XG5cblxuXHQvLyBIYW5kbGUgc2VydmVyIHN0YXRlIGNoYW5nZXNcblx0cHJpdmF0ZSBhc3luYyBfcmVmcmVzaE1DUFNlcnZlcnMoKTogUHJvbWlzZTx2b2lkPiB7XG5cblx0XHR0aGlzLl9zZXRIYXNFcnJvcih1bmRlZmluZWQpXG5cblx0XHRjb25zdCBuZXdDb25maWdGaWxlSlNPTiA9IGF3YWl0IHRoaXMuX3BhcnNlTUNQQ29uZmlnRmlsZSgpO1xuXHRcdGlmICghbmV3Q29uZmlnRmlsZUpTT04pIHsgY29uc29sZS5sb2coYE5vdCBzZXR0aW5nIHN0YXRlOiBNQ1AgY29uZmlnIGZpbGUgbm90IGZvdW5kYCk7IHJldHVybiB9XG5cdFx0aWYgKCFuZXdDb25maWdGaWxlSlNPTj8ubWNwU2VydmVycykgeyBjb25zb2xlLmxvZyhgTm90IHNldHRpbmcgc3RhdGU6IE1DUCBjb25maWcgZmlsZSBkaWQgbm90IGhhdmUgYW4gJ21jcFNlcnZlcnMnIGZpZWxkYCk7IHJldHVybiB9XG5cblxuXHRcdGNvbnN0IG9sZENvbmZpZ0ZpbGVOYW1lcyA9IE9iamVjdC5rZXlzKHRoaXMuc3RhdGUubWNwU2VydmVyT2ZOYW1lKVxuXHRcdGNvbnN0IG5ld0NvbmZpZ0ZpbGVOYW1lcyA9IE9iamVjdC5rZXlzKG5ld0NvbmZpZ0ZpbGVKU09OLm1jcFNlcnZlcnMpXG5cblx0XHRjb25zdCBhZGRlZFNlcnZlck5hbWVzID0gbmV3Q29uZmlnRmlsZU5hbWVzLmZpbHRlcihzZXJ2ZXJOYW1lID0+ICFvbGRDb25maWdGaWxlTmFtZXMuaW5jbHVkZXMoc2VydmVyTmFtZSkpOyAvLyBpbiBuZXcgYW5kIG5vdCBpbiBvbGRcblx0XHRjb25zdCByZW1vdmVkU2VydmVyTmFtZXMgPSBvbGRDb25maWdGaWxlTmFtZXMuZmlsdGVyKHNlcnZlck5hbWUgPT4gIW5ld0NvbmZpZ0ZpbGVOYW1lcy5pbmNsdWRlcyhzZXJ2ZXJOYW1lKSk7IC8vIGluIG9sZCBhbmQgbm90IGluIG5ld1xuXG5cdFx0Ly8gc2V0IGlzT24gdG8gYW55IG5ldyBzZXJ2ZXJzIGluIHRoZSBjb25maWdcblx0XHRjb25zdCBhZGRlZFVzZXJTdGF0ZU9mTmFtZTogTUNQVXNlclN0YXRlT2ZOYW1lID0ge31cblx0XHRmb3IgKGNvbnN0IG5hbWUgb2YgYWRkZWRTZXJ2ZXJOYW1lcykgeyBhZGRlZFVzZXJTdGF0ZU9mTmFtZVtuYW1lXSA9IHsgaXNPbjogdHJ1ZSB9IH1cblx0XHRhd2FpdCB0aGlzLnZvaWRTZXR0aW5nc1NlcnZpY2UuYWRkTUNQVXNlclN0YXRlT2ZOYW1lcyhhZGRlZFVzZXJTdGF0ZU9mTmFtZSk7XG5cblx0XHQvLyBkZWxldGUgaXNPbiBmb3IgYW55IHNlcnZlcnMgdGhhdCBubyBsb25nZXIgc2hvdyB1cCBpbiB0aGUgY29uZmlnXG5cdFx0YXdhaXQgdGhpcy52b2lkU2V0dGluZ3NTZXJ2aWNlLnJlbW92ZU1DUFVzZXJTdGF0ZU9mTmFtZXMocmVtb3ZlZFNlcnZlck5hbWVzKTtcblxuXHRcdC8vIHNldCBhbGwgc2VydmVycyB0byBsb2FkaW5nXG5cdFx0Zm9yIChjb25zdCBzZXJ2ZXJOYW1lIGluIG5ld0NvbmZpZ0ZpbGVKU09OLm1jcFNlcnZlcnMpIHtcblx0XHRcdHRoaXMuX3NldE1DUFNlcnZlclN0YXRlKHNlcnZlck5hbWUsIHsgc3RhdHVzOiAnbG9hZGluZycsIHRvb2xzOiBbXSB9KVxuXHRcdH1cblx0XHRjb25zdCB1cGRhdGVkU2VydmVyTmFtZXMgPSBPYmplY3Qua2V5cyhuZXdDb25maWdGaWxlSlNPTi5tY3BTZXJ2ZXJzKS5maWx0ZXIoc2VydmVyTmFtZSA9PiAhYWRkZWRTZXJ2ZXJOYW1lcy5pbmNsdWRlcyhzZXJ2ZXJOYW1lKSAmJiAhcmVtb3ZlZFNlcnZlck5hbWVzLmluY2x1ZGVzKHNlcnZlck5hbWUpKVxuXG5cdFx0dGhpcy5jaGFubmVsLmNhbGwoJ3JlZnJlc2hNQ1BTZXJ2ZXJzJywge1xuXHRcdFx0bWNwQ29uZmlnRmlsZUpTT046IG5ld0NvbmZpZ0ZpbGVKU09OLFxuXHRcdFx0YWRkZWRTZXJ2ZXJOYW1lcyxcblx0XHRcdHJlbW92ZWRTZXJ2ZXJOYW1lcyxcblx0XHRcdHVwZGF0ZWRTZXJ2ZXJOYW1lcyxcblx0XHRcdHVzZXJTdGF0ZU9mTmFtZTogdGhpcy52b2lkU2V0dGluZ3NTZXJ2aWNlLnN0YXRlLm1jcFVzZXJTdGF0ZU9mTmFtZSxcblx0XHR9KVxuXHR9XG5cblx0c3RyaW5naWZ5UmVzdWx0KHJlc3VsdDogUmF3TUNQVG9vbENhbGwpOiBzdHJpbmcge1xuXHRcdGxldCB0b29sUmVzdWx0U3RyOiBzdHJpbmdcblx0XHRpZiAocmVzdWx0LmV2ZW50ID09PSAndGV4dCcpIHtcblx0XHRcdHRvb2xSZXN1bHRTdHIgPSByZXN1bHQudGV4dFxuXHRcdH0gZWxzZSBpZiAocmVzdWx0LmV2ZW50ID09PSAnaW1hZ2UnKSB7XG5cdFx0XHR0b29sUmVzdWx0U3RyID0gYFtJbWFnZTogJHtyZXN1bHQuaW1hZ2UubWltZVR5cGV9XWBcblx0XHR9IGVsc2UgaWYgKHJlc3VsdC5ldmVudCA9PT0gJ2F1ZGlvJykge1xuXHRcdFx0dG9vbFJlc3VsdFN0ciA9IGBbQXVkaW8gY29udGVudF1gXG5cdFx0fSBlbHNlIGlmIChyZXN1bHQuZXZlbnQgPT09ICdyZXNvdXJjZScpIHtcblx0XHRcdHRvb2xSZXN1bHRTdHIgPSBgW1Jlc291cmNlIGNvbnRlbnRdYFxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0b29sUmVzdWx0U3RyID0gSlNPTi5zdHJpbmdpZnkocmVzdWx0KVxuXHRcdH1cblx0XHRyZXR1cm4gdG9vbFJlc3VsdFN0clxuXHR9XG5cblx0Ly8gdG9nZ2xlIE1DUCBzZXJ2ZXIgYW5kIHVwZGF0ZSBpc09uIGluIHZvaWQgc2V0dGluZ3Ncblx0cHVibGljIGFzeW5jIHRvZ2dsZVNlcnZlcklzT24oc2VydmVyTmFtZTogc3RyaW5nLCBpc09uOiBib29sZWFuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5fc2V0TUNQU2VydmVyU3RhdGUoc2VydmVyTmFtZSwgeyBzdGF0dXM6ICdsb2FkaW5nJywgdG9vbHM6IFtdIH0pXG5cblx0XHRhd2FpdCB0aGlzLnZvaWRTZXR0aW5nc1NlcnZpY2Uuc2V0TUNQU2VydmVyU3RhdGUoc2VydmVyTmFtZSwgeyBpc09uIH0pO1xuXHRcdHRoaXMuY2hhbm5lbC5jYWxsKCd0b2dnbGVNQ1BTZXJ2ZXInLCB7IHNlcnZlck5hbWUsIGlzT24gfSlcblx0fVxuXG5cblx0cHVibGljIGFzeW5jIGNhbGxNQ1BUb29sKHRvb2xEYXRhOiBNQ1BUb29sQ2FsbFBhcmFtcyk6IFByb21pc2U8eyByZXN1bHQ6IFJhd01DUFRvb2xDYWxsIH0+IHtcblx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLmNoYW5uZWwuY2FsbDxSYXdNQ1BUb29sQ2FsbD4oJ2NhbGxUb29sJywgdG9vbERhdGEpO1xuXHRcdGlmIChyZXN1bHQuZXZlbnQgPT09ICdlcnJvcicpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRXJyb3I6ICR7cmVzdWx0LnRleHR9YClcblx0XHR9XG5cdFx0cmV0dXJuIHsgcmVzdWx0IH07XG5cdH1cblxuXHQvLyBwdWJsaWMgZ2V0TUNQVG9vbEZucygpOiBNQ1BUb29sUmVzdWx0VHlwZSB7XG5cdC8vIFx0Y29uc3QgdG9vbHMgPSB0aGlzLmdldE1DUFRvb2xzKCk7XG5cdC8vIFx0Y29uc3QgdG9vbEZuczogTUNQVG9vbFJlc3VsdFR5cGUgPSB7fTtcblxuXHQvLyBcdHRvb2xzLmZvckVhY2goKHRvb2wpID0+IHtcblx0Ly8gXHRcdGNvbnN0IG5hbWUgPSB0b29sLm5hbWU7XG5cdC8vIFx0XHQvLyBEZWZpbmUgdGhlIHRvb2wgY2FsbCBmdW5jdGlvblxuXHQvLyBcdFx0Y29uc3QgdG9vbEZuID0gYXN5bmMgKHBhcmFtczoge1xuXHQvLyBcdFx0XHRzZXJ2ZXJOYW1lOiBzdHJpbmcsXG5cdC8vIFx0XHRcdHRvb2xOYW1lOiBzdHJpbmcsXG5cdC8vIFx0XHRcdGFyZ3M6IGFueVxuXHQvLyBcdFx0fSkgPT4ge1xuXHQvLyBcdFx0XHRjb25zdCB7IHNlcnZlck5hbWUsIHRvb2xOYW1lLCBhcmdzIH0gPSBwYXJhbXM7XG5cdC8vIFx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5jYWxsTUNQVG9vbCh7XG5cdC8vIFx0XHRcdFx0c2VydmVyTmFtZSxcblx0Ly8gXHRcdFx0XHR0b29sTmFtZSxcblx0Ly8gXHRcdFx0XHRwYXJhbXM6IGFyZ3MsXG5cdC8vIFx0XHRcdH0pO1xuXHQvLyBcdFx0XHRyZXR1cm4geyByZXN1bHQ6IHJlc3BvbnNlIH1cblx0Ly8gXHRcdH07XG5cdC8vIFx0XHR0b29sRm5zW25hbWVdID0gdG9vbEZuO1xuXHQvLyBcdH0pO1xuXG5cdC8vIFx0cmV0dXJuIHRvb2xGbnNcblx0Ly8gfVxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJTUNQU2VydmljZSwgTUNQU2VydmljZSwgSW5zdGFudGlhdGlvblR5cGUuRWFnZXIpO1xuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLFdBQVc7QUFDcEIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxtQkFBbUIseUJBQXlCO0FBQ3JELFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsb0JBQW9CO0FBQzdCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsMkJBQTJCO0FBRXBDLFNBQWdCLGVBQWU7QUFFL0IsU0FBUyw0QkFBNEI7QUFzQjlCLE1BQU0sY0FBYyxnQkFBNkIsa0JBQWtCO0FBSTFFLE1BQU0sdUJBQXVCO0FBQzdCLE1BQU0sb0JBQW9CLEVBQUUsWUFBWSxDQUFDLEVBQUU7QUFDM0MsTUFBTSwyQkFBMkIsS0FBSyxVQUFVLG1CQUFtQixNQUFNLENBQUM7QUFXMUUsSUFBTSxhQUFOLGNBQXlCLFdBQWtDO0FBQUE7QUFBQTtBQUFBLEVBbUIxRCxZQUNnQyxhQUNBLGFBQ0csZ0JBQ0QsZUFDSyxvQkFDQyxxQkFDdEM7QUFDRCxVQUFNO0FBUHlCO0FBQ0E7QUFDRztBQUNEO0FBQ0s7QUFDQztBQWxCeEM7QUFBQTtBQUFBLGlCQUF5QjtBQUFBLE1BQ3hCLGlCQUFpQixDQUFDO0FBQUEsTUFDbEIsT0FBTztBQUFBLElBQ1I7QUFHQTtBQUFBLFNBQWlCLG9CQUFvQixJQUFJLFFBQWM7QUFDdkQsU0FBZ0IsbUJBQW1CLEtBQUssa0JBQWtCO0FBK0MxRCxTQUFpQixxQkFBcUIs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
