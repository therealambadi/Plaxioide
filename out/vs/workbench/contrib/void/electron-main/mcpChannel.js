import { Emitter } from "../../../../base/common/event.js";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { removeMCPToolNamePrefix } from "../common/mcpServiceTypes.js";
const getClientConfig = (serverName) => {
  return {
    name: `${serverName}-client`,
    version: "0.1.0"
    // debug: true,
  };
};
class MCPChannel {
  constructor() {
    this.infoOfClientId = {};
    this._refreshingServerNames = /* @__PURE__ */ new Set();
    // mcp emitters
    this.mcpEmitters = {
      serverEvent: {
        onAdd: new Emitter(),
        onUpdate: new Emitter(),
        onDelete: new Emitter()
      }
    };
  }
  // browser uses this to listen for changes
  listen(_, event) {
    if (event === "onAdd_server") return this.mcpEmitters.serverEvent.onAdd.event;
    else if (event === "onUpdate_server") return this.mcpEmitters.serverEvent.onUpdate.event;
    else if (event === "onDelete_server") return this.mcpEmitters.serverEvent.onDelete.event;
    else throw new Error(`Event not found: ${event}`);
  }
  // browser uses this to call (see this.channel.call() in mcpConfigService.ts for all usages)
  async call(_, command, params) {
    try {
      if (command === "refreshMCPServers") {
        await this._refreshMCPServers(params);
      } else if (command === "closeAllMCPServers") {
        await this._closeAllMCPServers();
      } else if (command === "toggleMCPServer") {
        await this._toggleMCPServer(params.serverName, params.isOn);
      } else if (command === "callTool") {
        const p = params;
        const response = await this._safeCallTool(p.serverName, p.toolName, p.params);
        return response;
      } else {
        throw new Error(`Void sendLLM: command "${command}" not recognized.`);
      }
    } catch (e) {
      console.error("mcp channel: Call Error:", e);
    }
  }
  // server functions
  async _refreshMCPServers(params) {
    const {
      mcpConfigFileJSON,
      userStateOfName,
      addedServerNames,
      removedServerNames,
      updatedServerNames
    } = params;
    const { mcpServers: mcpServersJSON } = mcpConfigFileJSON;
    const allChanges = [
      ...addedServerNames.map((n) => ({ serverName: n, type: "added" })),
      ...removedServerNames.map((n) => ({ serverName: n, type: "removed" })),
      ...updatedServerNames.map((n) => ({ serverName: n, type: "updated" }))
    ];
    await Promise.all(
      allChanges.map(async ({ serverName, type }) => {
        if (this._refreshingServerNames.has(serverName)) return;
        this._refreshingServerNames.add(serverName);
        const prevServer = this.infoOfClientId[serverName]?.mcpServer;
        if (type === "removed" || type === "updated") {
          await this._closeClient(serverName);
          delete this.infoOfClientId[serverName];
          this.mcpEmitters.serverEvent.onDelete.fire({ response: { prevServer, name: serverName } });
        }
        if (type === "added" || type === "updated") {
          const clientInfo = await this._createClient(mcpServersJSON[serverName], serverName, userStateOfName[serverName]?.isOn);
          this.infoOfClientId[serverName] = clientInfo;
          this.mcpEmitters.serverEvent.onAdd.fire({ response: { newServer: clientInfo.mcpServer, name: serverName } });
        }
      })
    );
    allChanges.forEach(({ serverName, type }) => {
      this._refreshingServerNames.delete(serverName);
    });
  }
  async _createClientUnsafe(server, serverName, isOn) {
    const clientConfig = getClientConfig(serverName);
    const client = new Client(clientConfig);
    let transport;
    let info;
    if (server.url) {
      try {
        transport = new StreamableHTTPClientTransport(server.url);
        await client.connect(transport);
        console.log(`Connected via HTTP to ${serverName}`);
        const { tools } = await client.listTools();
        const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }));
        info = {
          status: isOn ? "success" : "offline",
          tools: toolsWithUniqueName,
          command: server.url.toString()
        };
      } catch (httpErr) {
        console.warn(`HTTP failed for ${serverName}, trying SSE\u2026`, httpErr);
        transport = new SSEClientTransport(server.url);
        await client.connect(transport);
        const { tools } = await client.listTools();
        const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }));
        console.log(`Connected via SSE to ${serverName}`);
        info = {
          status: isOn ? "success" : "offline",
          tools: toolsWithUniqueName,
          command: server.url.toString()
        };
      }
    } else if (server.command) {
      transport = new StdioClientTransport({
        command: server.command,
        args: server.args,
        env: {
          ...server.env,
          ...process.env
        }
      });
      await client.connect(transport);
      const { tools } = await client.listTools();
      const toolsWithUniqueName = tools.map(({ name, ...rest }) => ({ name: this._addUniquePrefix(name), ...rest }));
      const fullCommand = `${server.command} ${server.args?.join(" ") || ""}`;
      info = {
        status: isOn ? "success" : "offline",
        tools: toolsWithUniqueName,
        command: fullCommand
      };
    } else {
      throw new Error(`No url or command for server ${serverName}`);
    }
    return { _client: client, mcpServerEntryJSON: server, mcpServer: info };
  }
  _addUniquePrefix(base) {
    return `${Math.random().toString(36).slice(2, 8)}_${base}`;
  }
  async _createClient(serverConfig, serverName, isOn = true) {
    try {
      const c = await this._createClientUnsafe(serverConfig, serverName, isOn);
      return c;
    } catch (err) {
      console.error(`\u274C Failed to connect to server "${serverName}":`, err);
      const fullCommand = !serverConfig.command ? "" : `${serverConfig.command} ${serverConfig.args?.join(" ") || ""}`;
      const c = { status: "error", error: err + "", command: fullCommand };
      return { mcpServerEntryJSON: serverConfig, mcpServer: c };
    }
  }
  async _closeAllMCPServers() {
    for (const serverName in this.infoOfClientId) {
      await this._closeClient(serverName);
      delete this.infoOfClientId[serverName];
    }
    console.log("Closed all MCP servers");
  }
  async _closeClient(serverName) {
    const info = this.infoOfClientId[serverName];
    if (!info) return;
    const { _client: client } = info;
    if (client) {
      await client.close();
    }
    console.log(`Closed MCP server ${serverName}`);
  }
  async _toggleMCPServer(serverName, isOn) {
    const prevServer = this.infoOfClientId[serverName]?.mcpServer;
    if (isOn) {
      const clientInfo = await this._createClientUnsafe(this.infoOfClientId[serverName].mcpServerEntryJSON, serverName, isOn);
      this.mcpEmitters.serverEvent.onUpdate.fire({
        response: {
          name: serverName,
          newServer: clientInfo.mcpServer,
          prevServer
        }
      });
    } else {
      this._closeClient(serverName);
      delete this.infoOfClientId[serverName]._client;
      this.mcpEmitters.serverEvent.onUpdate.fire({
        response: {
          name: serverName,
          newServer: {
            status: "offline",
            tools: [],
            command: "",
            // Explicitly set error to undefined to reset the error state
            error: void 0
          },
          prevServer
        }
      });
    }
  }
  // tool call functions
  async _callTool(serverName, toolName, params) {
    const server = this.infoOfClientId[serverName];
    if (!server) throw new Error(`Server ${serverName} not found`);
    const { _client: client } = server;
    if (!client) throw new Error(`Client for server ${serverName} not found`);
    const response = await client.callTool({
      name: removeMCPToolNamePrefix(toolName),
      arguments: params
    });
    const { content } = response;
    const returnValue = content[0];
    if (returnValue.type === "text") {
      if (response.isError) {
        throw new Error(`Tool call error: ${returnValue.text}`);
      }
      return {
        event: "text",
        text: returnValue.text,
        toolName,
        serverName
      };
    }
    throw new Error(`Tool call error: We don't support ${returnValue.type} tool response yet for tool ${toolName} on server ${serverName}`);
  }
  // tool call error wrapper
  async _safeCallTool(serverName, toolName, params) {
    try {
      const response = await this._callTool(serverName, toolName, params);
      return response;
    } catch (err) {
      let errorMessage;
      if (typeof err === "object" && err !== null && err["code"]) {
        const code = err.code;
        let codeDescription = "";
        if (code === -32700)
          codeDescription = "Parse Error";
        if (code === -32600)
          codeDescription = "Invalid Request";
        if (code === -32601)
          codeDescription = "Method Not Found";
        if (code === -32602)
          codeDescription = "Invalid Parameters";
        if (code === -32603)
          codeDescription = "Internal Error";
        errorMessage = `${codeDescription}. Full response:
${JSON.stringify(err, null, 2)}`;
      } else if (typeof err === "string") {
        errorMessage = err;
      } else {
        errorMessage = JSON.stringify(err, null, 2);
      }
      const fullErrorMessage = `\u274C Failed to call tool "${toolName}" on server "${serverName}": ${errorMessage}`;
      const errorResponse = {
        event: "error",
        text: fullErrorMessage,
        toolName,
        serverName
      };
      return errorResponse;
    }
  }
}
export {
  MCPChannel
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2VsZWN0cm9uLW1haW4vbWNwQ2hhbm5lbC50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAyMDI1IEdsYXNzIERldnRvb2xzLCBJbmMuIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIEFwYWNoZSBMaWNlbnNlLCBWZXJzaW9uIDIuMC4gU2VlIExJQ0VOU0UudHh0IGZvciBtb3JlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbi8vIHJlZ2lzdGVyZWQgaW4gYXBwLnRzXG4vLyBjYW4ndCBtYWtlIGEgc2VydmljZSByZXNwb25zaWJsZSBmb3IgdGhpcywgYmVjYXVzZSBpdCBuZWVkc1xuLy8gdG8gYmUgY29ubmVjdGVkIHRvIHRoZSBtYWluIHByb2Nlc3MgYW5kIG5vZGUgZGVwZW5kZW5jaWVzXG5cbmltcG9ydCB7IElTZXJ2ZXJDaGFubmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9wYXJ0cy9pcGMvY29tbW9uL2lwYy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IENsaWVudCB9IGZyb20gJ0Btb2RlbGNvbnRleHRwcm90b2NvbC9zZGsvY2xpZW50L2luZGV4LmpzJztcbmltcG9ydCB7IFN0ZGlvQ2xpZW50VHJhbnNwb3J0IH0gZnJvbSAnQG1vZGVsY29udGV4dHByb3RvY29sL3Nkay9jbGllbnQvc3RkaW8uanMnO1xuaW1wb3J0IHsgU3RyZWFtYWJsZUhUVFBDbGllbnRUcmFuc3BvcnQgfSBmcm9tICdAbW9kZWxjb250ZXh0cHJvdG9jb2wvc2RrL2NsaWVudC9zdHJlYW1hYmxlSHR0cC5qcyc7XG5pbXBvcnQgeyBTU0VDbGllbnRUcmFuc3BvcnQgfSBmcm9tICdAbW9kZWxjb250ZXh0cHJvdG9jb2wvc2RrL2NsaWVudC9zc2UuanMnO1xuaW1wb3J0IHsgTUNQQ29uZmlnRmlsZUpTT04sIE1DUENvbmZpZ0ZpbGVFbnRyeUpTT04sIE1DUFNlcnZlciwgUmF3TUNQVG9vbENhbGwsIE1DUFRvb2xFcnJvclJlc3BvbnNlLCBNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlLCBNQ1BUb29sQ2FsbFBhcmFtcywgcmVtb3ZlTUNQVG9vbE5hbWVQcmVmaXggfSBmcm9tICcuLi9jb21tb24vbWNwU2VydmljZVR5cGVzLmpzJztcbmltcG9ydCB7IFRyYW5zcG9ydCB9IGZyb20gJ0Btb2RlbGNvbnRleHRwcm90b2NvbC9zZGsvc2hhcmVkL3RyYW5zcG9ydC5qcyc7XG5pbXBvcnQgeyBDYWxsVG9vbFJlc3VsdCB9IGZyb20gJ0Btb2RlbGNvbnRleHRwcm90b2NvbC9zZGsvdHlwZXMuanMnO1xuaW1wb3J0IHsgTUNQVXNlclN0YXRlT2ZOYW1lIH0gZnJvbSAnLi4vY29tbW9uL3ZvaWRTZXR0aW5nc1R5cGVzLmpzJztcblxuY29uc3QgZ2V0Q2xpZW50Q29uZmlnID0gKHNlcnZlck5hbWU6IHN0cmluZykgPT4ge1xuXHRyZXR1cm4ge1xuXHRcdG5hbWU6IGAke3NlcnZlck5hbWV9LWNsaWVudGAsXG5cdFx0dmVyc2lvbjogJzAuMS4wJyxcblx0XHQvLyBkZWJ1ZzogdHJ1ZSxcblx0fVxufVxuXG50eXBlIE1DUFNlcnZlck5vbkVycm9yID0gTUNQU2VydmVyICYgeyBzdGF0dXM6IE9taXQ8TUNQU2VydmVyWydzdGF0dXMnXSwgJ2Vycm9yJz4gfVxudHlwZSBNQ1BTZXJ2ZXJFcnJvciA9IE1DUFNlcnZlciAmIHsgc3RhdHVzOiAnZXJyb3InIH1cblxuXG5cbnR5cGUgQ2xpZW50SW5mbyA9IHtcblx0X2NsaWVudDogQ2xpZW50LCAvLyBfY2xpZW50IGlzIHRoZSBjbGllbnQgdGhhdCBjb25uZWN0cyB3aXRoIGFuIG1jcCBjbGllbnQuIFdlJ3JlIGNhbGxpbmcgbWNwIGNsaWVudHMgXCJzZXJ2ZXJcIiBldmVyeXdoZXJlIGV4Y2VwdCBoZXJlIGZvciBuYW1pbmcgY29uc2lzdGVuY3kuXG5cdG1jcFNlcnZlckVudHJ5SlNPTjogTUNQQ29uZmlnRmlsZUVudHJ5SlNPTixcblx0bWNwU2VydmVyOiBNQ1BTZXJ2ZXJOb25FcnJvcixcbn0gfCB7XG5cdF9jbGllbnQ/OiB1bmRlZmluZWQsXG5cdG1jcFNlcnZlckVudHJ5SlNPTjogTUNQQ29uZmlnRmlsZUVudHJ5SlNPTixcblx0bWNwU2VydmVyOiBNQ1BTZXJ2ZXJFcnJvcixcbn1cblxudHlwZSBJbmZvT2ZDbGllbnRJZCA9IHtcblx0W2NsaWVudElkOiBzdHJpbmddOiBDbGllbnRJbmZvXG59XG5cbmV4cG9ydCBjbGFzcyBNQ1BDaGFubmVsIGltcGxlbWVudHMgSVNlcnZlckNoYW5uZWwge1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgaW5mb09mQ2xpZW50SWQ6IEluZm9PZkNsaWVudElkID0ge31cblx0cHJpdmF0ZSByZWFkb25seSBfcmVmcmVzaGluZ1NlcnZlck5hbWVzOiBTZXQ8c3RyaW5nPiA9IG5ldyBTZXQoKVxuXG5cdC8vIG1jcCBlbWl0dGVyc1xuXHRwcml2YXRlIHJlYWRvbmx5IG1jcEVtaXR0ZXJzID0ge1xuXHRcdHNlcnZlckV2ZW50OiB7XG5cdFx0XHRvbkFkZDogbmV3IEVtaXR0ZXI8TUNQU2VydmVyRXZlbnRSZXNwb25zZT4oKSxcblx0XHRcdG9uVXBkYXRlOiBuZXcgRW1pdHRlcjxNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlPigpLFxuXHRcdFx0b25EZWxldGU6IG5ldyBFbWl0dGVyPE1DUFNlcnZlckV2ZW50UmVzcG9uc2U+KCksXG5cdFx0fVxuXHR9IHNhdGlzZmllcyB7XG5cdFx0c2VydmVyRXZlbnQ6IHtcblx0XHRcdG9uQWRkOiBFbWl0dGVyPE1DUFNlcnZlckV2ZW50UmVzcG9uc2U+LFxuXHRcdFx0b25VcGRhdGU6IEVtaXR0ZXI8TUNQU2VydmVyRXZlbnRSZXNwb25zZT4sXG5cdFx0XHRvbkRlbGV0ZTogRW1pdHRlcjxNQ1BTZXJ2ZXJFdmVudFJlc3BvbnNlPixcblx0XHR9XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0KSB7IH1cblxuXHQvLyBicm93c2VyIHVzZXMgdGhpcyB0byBsaXN0ZW4gZm9yIGNoYW5nZXNcblx0bGlzdGVuKF86IHVua25vd24sIGV2ZW50OiBzdHJpbmcpOiBFdmVudDxhbnk+IHtcblxuXHRcdC8vIHNlcnZlciBldmVudHNcblx0XHRpZiAoZXZlbnQgPT09ICdvbkFkZF9zZXJ2ZXInKSByZXR1cm4gdGhpcy5tY3BFbWl0dGVycy5zZXJ2ZXJFdmVudC5vbkFkZC5ldmVudDtcblx0XHRlbHNlIGlmIChldmVudCA9PT0gJ29uVXBkYXRlX3NlcnZlcicpIHJldHVybiB0aGlzLm1jcEVtaXR0ZXJzLnNlcnZlckV2ZW50Lm9uVXBkYXRlLmV2ZW50O1xuXHRcdGVsc2UgaWYgKGV2ZW50ID09PSAnb25EZWxldGVfc2VydmVyJykgcmV0dXJuIHRoaXMubWNwRW1pdHRlcnMuc2VydmVyRXZlbnQub25EZWxldGUuZXZlbnQ7XG5cdFx0Ly8gZWxzZSBpZiAoZXZlbnQgPT09ICdvbkxvYWRpbmdfc2VydmVyJykgcmV0dXJuIHRoaXMubWNwRW1pdHRlcnMuc2VydmVyRXZlbnQub25DaGFuZ2VMb2FkaW5nLmV2ZW50O1xuXG5cdFx0Ly8gdG9vbCBjYWxsIGV2ZW50c1xuXG5cdFx0Ly8gaGFuZGxlIHVua25vd24gZXZlbnRzXG5cdFx0ZWxzZSB0aHJvdyBuZXcgRXJyb3IoYEV2ZW50IG5vdCBmb3VuZDogJHtldmVudH1gKTtcblx0fVxuXG5cdC8vIGJyb3dzZXIgdXNlcyB0aGlzIHRvIGNhbGwgKHNlZSB0aGlzLmNoYW5uZWwuY2FsbCgpIGluIG1jcENvbmZpZ1NlcnZpY2UudHMgZm9yIGFsbCB1c2FnZXMpXG5cdGFzeW5jIGNhbGwoXzogdW5rbm93biwgY29tbWFuZDogc3RyaW5nLCBwYXJhbXM6IGFueSk6IFByb21pc2U8YW55PiB7XG5cdFx0dHJ5IHtcblx0XHRcdGlmIChjb21tYW5kID09PSAncmVmcmVzaE1DUFNlcnZlcnMnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX3JlZnJlc2hNQ1BTZXJ2ZXJzKHBhcmFtcylcblx0XHRcdH1cblx0XHRcdGVsc2UgaWYgKGNvbW1hbmQgPT09ICdjbG9zZUFsbE1DUFNlcnZlcnMnKSB7XG5cdFx0XHRcdGF3YWl0IHRoaXMuX2Nsb3NlQWxsTUNQU2VydmVycygpXG5cdFx0XHR9XG5cdFx0XHRlbHNlIGlmIChjb21tYW5kID09PSAndG9nZ2xlTUNQU2VydmVyJykge1xuXHRcdFx0XHRhd2FpdCB0aGlzLl90b2dnbGVNQ1BTZXJ2ZXIocGFyYW1zLnNlcnZlck5hbWUsIHBhcmFtcy5pc09uKVxuXHRcdFx0fVxuXHRcdFx0ZWxzZSBpZiAoY29tbWFuZCA9PT0gJ2NhbGxUb29sJykge1xuXHRcdFx0XHRjb25zdCBwOiBNQ1BUb29sQ2FsbFBhcmFtcyA9IHBhcmFtc1xuXHRcdFx0XHRjb25zdCByZXNwb25zZSA9IGF3YWl0IHRoaXMuX3NhZmVDYWxsVG9vbChwLnNlcnZlck5hbWUsIHAudG9vbE5hbWUsIHAucGFyYW1zKVxuXHRcdFx0XHRyZXR1cm4gcmVzcG9uc2Vcblx0XHRcdH1cblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFZvaWQgc2VuZExMTTogY29tbWFuZCBcIiR7Y29tbWFuZH1cIiBub3QgcmVjb2duaXplZC5gKVxuXHRcdFx0fVxuXHRcdH1cblx0XHRjYXRjaCAoZSkge1xuXHRcdFx0Y29uc29sZS5lcnJvcignbWNwIGNoYW5uZWw6IENhbGwgRXJyb3I6JywgZSlcblx0XHR9XG5cdH1cblxuXHQvLyBzZXJ2ZXIgZnVuY3Rpb25zXG5cblxuXHRwcml2YXRlIGFzeW5jIF9yZWZyZXNoTUNQU2VydmVycyhwYXJhbXM6IHsgbWNwQ29uZmlnRmlsZUpTT046IE1DUENvbmZpZ0ZpbGVKU09OLCB1c2VyU3RhdGVPZk5hbWU6IE1DUFVzZXJTdGF0ZU9mTmFtZSwgYWRkZWRTZXJ2ZXJOYW1lczogc3RyaW5nW10sIHJlbW92ZWRTZXJ2ZXJOYW1lczogc3RyaW5nW10sIHVwZGF0ZWRTZXJ2ZXJOYW1lczogc3RyaW5nW10gfSkge1xuXG5cdFx0Y29uc3Qge1xuXHRcdFx0bWNwQ29uZmlnRmlsZUpTT04sXG5cdFx0XHR1c2VyU3RhdGVPZk5hbWUsXG5cdFx0XHRhZGRlZFNlcnZlck5hbWVzLFxuXHRcdFx0cmVtb3ZlZFNlcnZlck5hbWVzLFxuXHRcdFx0dXBkYXRlZFNlcnZlck5hbWVzLFxuXHRcdH0gPSBwYXJhbXNcblxuXHRcdGNvbnN0IHsgbWNwU2VydmVyczogbWNwU2VydmVyc0pTT04gfSA9IG1jcENvbmZpZ0ZpbGVKU09OXG5cblx0XHRjb25zdCBhbGxDaGFuZ2VzOiB7IHR5cGU6ICdhZGRlZCcgfCAncmVtb3ZlZCcgfCAndXBkYXRlZCcsIHNlcnZlck5hbWU6IHN0cmluZyB9W10gPSBbXG5cdFx0XHQuLi5hZGRlZFNlcnZlck5hbWVzLm1hcChuID0+ICh7IHNlcnZlck5hbWU6IG4sIHR5cGU6ICdhZGRlZCcgfSkgYXMgY29uc3QpLFxuXHRcdFx0Li4ucmVtb3ZlZFNlcnZlck5hbWVzLm1hcChuID0+ICh7IHNlcnZlck5hbWU6IG4sIHR5cGU6ICdyZW1vdmVkJyB9KSBhcyBjb25zdCksXG5cdFx0XHQuLi51cGRhdGVkU2VydmVyTmFtZXMubWFwKG4gPT4gKHsgc2VydmVyTmFtZTogbiwgdHlwZTogJ3VwZGF0ZWQnIH0pIGFzIGNvbnN0KSxcblx0XHRdXG5cblx0XHRhd2FpdCBQcm9taXNlLmFsbChcblx0XHRcdGFsbENoYW5nZXMubWFwKGFzeW5jICh7IHNlcnZlck5hbWUsIHR5cGUgfSkgPT4ge1xuXG5cdFx0XHRcdC8vIGNoZWNrIGlmIGFscmVhZHkgcmVmcmVzaGluZ1xuXHRcdFx0XHRpZiAodGhpcy5fcmVmcmVzaGluZ1NlcnZlck5hbWVzLmhhcyhzZXJ2ZXJOYW1lKSkgcmV0dXJuXG5cdFx0XHRcdHRoaXMuX3JlZnJlc2hpbmdTZXJ2ZXJOYW1lcy5hZGQoc2VydmVyTmFtZSlcblxuXHRcdFx0XHRjb25zdCBwcmV2U2VydmVyID0gdGhpcy5pbmZvT2ZDbGllbnRJZFtzZXJ2ZXJOYW1lXT8ubWNwU2VydmVyO1xuXG5cdFx0XHRcdC8vIGNsb3NlIGFuZCBkZWxldGUgdGhlIG9sZCBjbGllbnRcblx0XHRcdFx0aWYgKHR5cGUgPT09ICdyZW1vdmVkJyB8fCB0eXBlID09PSAndXBkYXRlZCcpIHtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLl9jbG9zZUNsaWVudChzZXJ2ZXJOYW1lKVxuXHRcdFx0XHRcdGRlbGV0ZSB0aGlzLmluZm9PZkNsaWVudElkW3NlcnZlck5hbWVdXG5cdFx0XHRcdFx0dGhpcy5tY3BFbWl0dGVycy5zZXJ2ZXJFdmVudC5vbkRlbGV0ZS5maXJlKHsgcmVzcG9uc2U6IHsgcHJldlNlcnZlciwgbmFtZTogc2VydmVyTmFtZSwgfSB9KVxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gY3JlYXRlIGEgbmV3IGNsaWVudFxuXHRcdFx0XHRpZiAodHlwZSA9PT0gJ2FkZGVkJyB8fCB0eXBlID09PSAndXBkYXRlZCcpIHtcblx0XHRcdFx0XHRjb25zdCBjbGllbnRJbmZvID0gYXdhaXQgdGhpcy5fY3JlYXRlQ2xpZW50KG1jcFNlcnZlcnNKU09OW3NlcnZlck5hbWVdLCBzZXJ2ZXJOYW1lLCB1c2VyU3RhdGVPZk5hbWVbc2VydmVyTmFtZV0/LmlzT24pXG5cdFx0XHRcdFx0dGhpcy5pbmZvT2ZDbGllbnRJZFtzZXJ2ZXJOYW1lXSA9IGNsaWVudEluZm9cblx0XHRcdFx0XHR0aGlzLm1jcEVtaXR0ZXJzLnNlcnZlckV2ZW50Lm9uQWRkLmZpcmUoeyByZXNwb25zZTogeyBuZXdTZXJ2ZXI6IGNsaWVudEluZm8ubWNwU2VydmVyLCBuYW1lOiBzZXJ2ZXJOYW1lLCB9IH0pXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0KVxuXG5cdFx0YWxsQ2hhbmdlcy5mb3JFYWNoKCh7IHNlcnZlck5hbWUsIHR5cGUgfSkgPT4ge1xuXHRcdFx0dGhpcy5fcmVmcmVzaGluZ1NlcnZlck5hbWVzLmRlbGV0ZShzZXJ2ZXJOYW1lKVxuXHRcdH0pXG5cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZUNsaWVudFVuc2FmZShzZXJ2ZXI6IE1DUENvbmZpZ0ZpbGVFbnRyeUpTT04sIHNlcnZlck5hbWU6IHN0cmluZywgaXNPbjogYm9vbGVhbik6IFByb21pc2U8Q2xpZW50SW5mbz4ge1xuXG5cdFx0Y29uc3QgY2xpZW50Q29uZmlnID0gZ2V0Q2xpZW50Q29uZmlnKHNlcnZlck5hbWUpXG5cdFx0Y29uc3QgY2xpZW50ID0gbmV3IENsaWVudChjbGllbnRDb25maWcpXG5cdFx0bGV0IHRyYW5zcG9ydDogVHJhbnNwb3J0O1xuXHRcdGxldCBpbmZvOiBNQ1BTZXJ2ZXJOb25FcnJvcjtcblxuXHRcdGlmIChzZXJ2ZXIudXJsKSB7XG5cdFx0XHQvLyBmaXJzdCB0cnkgSFRUUCwgZmFsbCBiYWNrIHRvIFNTRVxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0dHJhbnNwb3J0ID0gbmV3IFN0cmVhbWFibGVIVFRQQ2xpZW50VHJhbnNwb3J0KHNlcnZlci51cmwpO1xuXHRcdFx0XHRhd2FpdCBjbGllbnQuY29ubmVjdCh0cmFuc3BvcnQpO1xuXHRcdFx0XHRjb25zb2xlLmxvZyhgQ29ubmVjdGVkIHZpYSBIVFRQIHRvICR7c2VydmVyTmFtZX1gKTtcblx0XHRcdFx0Y29uc3QgeyB0b29scyB9ID0gYXdhaXQgY2xpZW50Lmxpc3RUb29scygpXG5cdFx0XHRcdGNvbnN0IHRvb2xzV2l0aFVuaXF1ZU5hbWUgPSB0b29scy5tYXAoKHsgbmFtZSwgLi4ucmVzdCB9KSA9PiAoeyBuYW1lOiB0aGlzLl9hZGRVbmlxdWVQcmVmaXgobmFtZSksIC4uLnJlc3QgfSkpXG5cdFx0XHRcdGluZm8gPSB7XG5cdFx0XHRcdFx0c3RhdHVzOiBpc09uID8gJ3N1Y2Nlc3MnIDogJ29mZmxpbmUnLFxuXHRcdFx0XHRcdHRvb2xzOiB0b29sc1dpdGhVbmlxdWVOYW1lLFxuXHRcdFx0XHRcdGNvbW1hbmQ6IHNlcnZlci51cmwudG9TdHJpbmcoKSxcblx0XHRcdFx0fVxuXHRcdFx0fSBjYXRjaCAoaHR0cEVycikge1xuXHRcdFx0XHRjb25zb2xlLndhcm4oYEhUVFAgZmFpbGVkIGZvciAke3NlcnZlck5hbWV9LCB0cnlpbmcgU1NFXHUyMDI2YCwgaHR0cEVycik7XG5cdFx0XHRcdHRyYW5zcG9ydCA9IG5ldyBTU0VDbGllbnRUcmFuc3BvcnQoc2VydmVyLnVybCk7XG5cdFx0XHRcdGF3YWl0IGNsaWVudC5jb25uZWN0KHRyYW5zcG9ydCk7XG5cdFx0XHRcdGNvbnN0IHsgdG9vbHMgfSA9IGF3YWl0IGNsaWVudC5saXN0VG9vbHMoKVxuXHRcdFx0XHRjb25zdCB0b29sc1dpdGhVbmlxdWVOYW1lID0gdG9vbHMubWFwKCh7IG5hbWUsIC4uLnJlc3QgfSkgPT4gKHsgbmFtZTogdGhpcy5fYWRkVW5pcXVlUHJlZml4KG5hbWUpLCAuLi5yZXN0IH0pKVxuXHRcdFx0XHRjb25zb2xlLmxvZyhgQ29ubmVjdGVkIHZpYSBTU0UgdG8gJHtzZXJ2ZXJOYW1lfWApO1xuXHRcdFx0XHRpbmZvID0ge1xuXHRcdFx0XHRcdHN0YXR1czogaXNPbiA/ICdzdWNjZXNzJyA6ICdvZmZsaW5lJyxcblx0XHRcdFx0XHR0b29sczogdG9vbHNXaXRoVW5pcXVlTmFtZSxcblx0XHRcdFx0XHRjb21tYW5kOiBzZXJ2ZXIudXJsLnRvU3RyaW5nKCksXG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9IGVsc2UgaWYgKHNlcnZlci5jb21tYW5kKSB7XG5cdFx0XHQvLyBjb25zb2xlLmxvZygnRU5WIERBVEE6ICcsIHNlcnZlci5lbnYpXG5cdFx0XHR0cmFuc3BvcnQgPSBuZXcgU3RkaW9DbGllbnRUcmFuc3BvcnQoe1xuXHRcdFx0XHRjb21tYW5kOiBzZXJ2ZXIuY29tbWFuZCxcblx0XHRcdFx0YXJnczogc2VydmVyLmFyZ3MsXG5cdFx0XHRcdGVudjoge1xuXHRcdFx0XHRcdC4uLnNlcnZlci5lbnYsXG5cdFx0XHRcdFx0Li4ucHJvY2Vzcy5lbnZcblx0XHRcdFx0fSBhcyBSZWNvcmQ8c3RyaW5nLCBzdHJpbmc+LFxuXHRcdFx0fSk7XG5cblx0XHRcdGF3YWl0IGNsaWVudC5jb25uZWN0KHRyYW5zcG9ydClcblxuXHRcdFx0Ly8gR2V0IHRoZSB0b29scyBmcm9tIHRoZSBzZXJ2ZXJcblx0XHRcdGNvbnN0IHsgdG9vbHMgfSA9IGF3YWl0IGNsaWVudC5saXN0VG9vbHMoKVxuXHRcdFx0Y29uc3QgdG9vbHNXaXRoVW5pcXVlTmFtZSA9IHRvb2xzLm1hcCgoeyBuYW1lLCAuLi5yZXN0IH0pID0+ICh7IG5hbWU6IHRoaXMuX2FkZFVuaXF1ZVByZWZpeChuYW1lKSwgLi4ucmVzdCB9KSlcblxuXHRcdFx0Ly8gQ3JlYXRlIGEgZnVsbCBjb21tYW5kIHN0cmluZyBmb3IgZGlzcGxheVxuXHRcdFx0Y29uc3QgZnVsbENvbW1hbmQgPSBgJHtzZXJ2ZXIuY29tbWFuZH0gJHtzZXJ2ZXIuYXJncz8uam9pbignICcpIHx8ICcnfWBcblxuXHRcdFx0Ly8gRm9ybWF0IHNlcnZlciBvYmplY3Rcblx0XHRcdGluZm8gPSB7XG5cdFx0XHRcdHN0YXR1czogaXNPbiA/ICdzdWNjZXNzJyA6ICdvZmZsaW5lJyxcblx0XHRcdFx0dG9vbHM6IHRvb2xzV2l0aFVuaXF1ZU5hbWUsXG5cdFx0XHRcdGNvbW1hbmQ6IGZ1bGxDb21tYW5kLFxuXHRcdFx0fVxuXG5cdFx0fSBlbHNlIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gdXJsIG9yIGNvbW1hbmQgZm9yIHNlcnZlciAke3NlcnZlck5hbWV9YCk7XG5cdFx0fVxuXG5cblx0XHRyZXR1cm4geyBfY2xpZW50OiBjbGllbnQsIG1jcFNlcnZlckVudHJ5SlNPTjogc2VydmVyLCBtY3BTZXJ2ZXI6IGluZm8gfVxuXHR9XG5cblx0cHJpdmF0ZSBfYWRkVW5pcXVlUHJlZml4KGJhc2U6IHN0cmluZykge1xuXHRcdHJldHVybiBgJHtNYXRoLnJhbmRvbSgpLnRvU3RyaW5nKDM2KS5zbGljZSgyLCA4KX1fJHtiYXNlfWA7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jcmVhdGVDbGllbnQoc2VydmVyQ29uZmlnOiBNQ1BDb25maWdGaWxlRW50cnlKU09OLCBzZXJ2ZXJOYW1lOiBzdHJpbmcsIGlzT24gPSB0cnVlKTogUHJvbWlzZTxDbGllbnRJbmZvPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IGM6IENsaWVudEluZm8gPSBhd2FpdCB0aGlzLl9jcmVhdGVDbGllbnRVbnNhZmUoc2VydmVyQ29uZmlnLCBzZXJ2ZXJOYW1lLCBpc09uKVxuXHRcdFx0cmV0dXJuIGNcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnNvbGUuZXJyb3IoYFx1Mjc0QyBGYWlsZWQgdG8gY29ubmVjdCB0byBzZXJ2ZXIgXCIke3NlcnZlck5hbWV9XCI6YCwgZXJyKVxuXHRcdFx0Y29uc3QgZnVsbENvbW1hbmQgPSAhc2VydmVyQ29uZmlnLmNvbW1hbmQgPyAnJyA6IGAke3NlcnZlckNvbmZpZy5jb21tYW5kfSAke3NlcnZlckNvbmZpZy5hcmdzPy5qb2luKCcgJykgfHwgJyd9YFxuXHRcdFx0Y29uc3QgYzogTUNQU2VydmVyRXJyb3IgPSB7IHN0YXR1czogJ2Vycm9yJywgZXJyb3I6IGVyciArICcnLCBjb21tYW5kOiBmdWxsQ29tbWFuZCwgfVxuXHRcdFx0cmV0dXJuIHsgbWNwU2VydmVyRW50cnlKU09OOiBzZXJ2ZXJDb25maWcsIG1jcFNlcnZlcjogYywgfVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2Nsb3NlQWxsTUNQU2VydmVycygpIHtcblx0XHRmb3IgKGNvbnN0IHNlcnZlck5hbWUgaW4gdGhpcy5pbmZvT2ZDbGllbnRJZCkge1xuXHRcdFx0YXdhaXQgdGhpcy5fY2xvc2VDbGllbnQoc2VydmVyTmFtZSlcblx0XHRcdGRlbGV0ZSB0aGlzLmluZm9PZkNsaWVudElkW3NlcnZlck5hbWVdXG5cdFx0fVxuXHRcdGNvbnNvbGUubG9nKCdDbG9zZWQgYWxsIE1DUCBzZXJ2ZXJzJyk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIF9jbG9zZUNsaWVudChzZXJ2ZXJOYW1lOiBzdHJpbmcpIHtcblx0XHRjb25zdCBpbmZvID0gdGhpcy5pbmZvT2ZDbGllbnRJZFtzZXJ2ZXJOYW1lXVxuXHRcdGlmICghaW5mbykgcmV0dXJuXG5cdFx0Y29uc3QgeyBfY2xpZW50OiBjbGllbnQgfSA9IGluZm9cblx0XHRpZiAoY2xpZW50KSB7XG5cdFx0XHRhd2FpdCBjbGllbnQuY2xvc2UoKVxuXHRcdH1cblx0XHRjb25zb2xlLmxvZyhgQ2xvc2VkIE1DUCBzZXJ2ZXIgJHtzZXJ2ZXJOYW1lfWApO1xuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF90b2dnbGVNQ1BTZXJ2ZXIoc2VydmVyTmFtZTogc3RyaW5nLCBpc09uOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgcHJldlNlcnZlciA9IHRoaXMuaW5mb09mQ2xpZW50SWRbc2VydmVyTmFtZV0/Lm1jcFNlcnZlclxuXHRcdC8vIEhhbmRsZSB0dXJuaW5nIG9uIHRoZSBzZXJ2ZXJcblx0XHRpZiAoaXNPbikge1xuXHRcdFx0Ly8gdGhpcy5tY3BFbWl0dGVycy5zZXJ2ZXJFdmVudC5vbkNoYW5nZUxvYWRpbmcuZmlyZShnZXRMb2FkaW5nU2VydmVyT2JqZWN0KHNlcnZlck5hbWUsIGlzT24pKVxuXHRcdFx0Y29uc3QgY2xpZW50SW5mbyA9IGF3YWl0IHRoaXMuX2NyZWF0ZUNsaWVudFVuc2FmZSh0aGlzLmluZm9PZkNsaWVudElkW3NlcnZlck5hbWVdLm1jcFNlcnZlckVudHJ5SlNPTiwgc2VydmVyTmFtZSwgaXNPbilcblx0XHRcdHRoaXMubWNwRW1pdHRlcnMuc2VydmVyRXZlbnQub25VcGRhdGUuZmlyZSh7XG5cdFx0XHRcdHJlc3BvbnNlOiB7XG5cdFx0XHRcdFx0bmFtZTogc2VydmVyTmFtZSxcblx0XHRcdFx0XHRuZXdTZXJ2ZXI6IGNsaWVudEluZm8ubWNwU2VydmVyLFxuXHRcdFx0XHRcdHByZXZTZXJ2ZXI6IHByZXZTZXJ2ZXIsXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fVxuXHRcdC8vIEhhbmRsZSB0dXJuaW5nIG9mZiB0aGUgc2VydmVyXG5cdFx0ZWxzZSB7XG5cdFx0XHQvLyB0aGlzLm1jcEVtaXR0ZXJzLnNlcnZlckV2ZW50Lm9uQ2hhbmdlTG9hZGluZy5maXJlKGdldExvYWRpbmdTZXJ2ZXJPYmplY3Qoc2VydmVyTmFtZSwgaXNPbikpXG5cdFx0XHR0aGlzLl9jbG9zZUNsaWVudChzZXJ2ZXJOYW1lKVxuXHRcdFx0ZGVsZXRlIHRoaXMuaW5mb09mQ2xpZW50SWRbc2VydmVyTmFtZV0uX2NsaWVudFxuXG5cdFx0XHR0aGlzLm1jcEVtaXR0ZXJzLnNlcnZlckV2ZW50Lm9uVXBkYXRlLmZpcmUoe1xuXHRcdFx0XHRyZXNwb25zZToge1xuXHRcdFx0XHRcdG5hbWU6IHNlcnZlck5hbWUsXG5cdFx0XHRcdFx0bmV3U2VydmVyOiB7XG5cdFx0XHRcdFx0XHRzdGF0dXM6ICdvZmZsaW5lJyxcblx0XHRcdFx0XHRcdHRvb2xzOiBbXSxcblx0XHRcdFx0XHRcdGNvbW1hbmQ6ICcnLFxuXHRcdFx0XHRcdFx0Ly8gRXhwbGljaXRseSBzZXQgZXJyb3IgdG8gdW5kZWZpbmVkIHRvIHJlc2V0IHRoZSBlcnJvciBzdGF0ZVxuXHRcdFx0XHRcdFx0ZXJyb3I6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHR9LFxuXHRcdFx0XHRcdHByZXZTZXJ2ZXI6IHByZXZTZXJ2ZXIsXG5cdFx0XHRcdH1cblx0XHRcdH0pXG5cdFx0fVxuXHR9XG5cblx0Ly8gdG9vbCBjYWxsIGZ1bmN0aW9uc1xuXG5cdHByaXZhdGUgYXN5bmMgX2NhbGxUb29sKHNlcnZlck5hbWU6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgcGFyYW1zOiBhbnkpOiBQcm9taXNlPFJhd01DUFRvb2xDYWxsPiB7XG5cdFx0Y29uc3Qgc2VydmVyID0gdGhpcy5pbmZvT2ZDbGllbnRJZFtzZXJ2ZXJOYW1lXVxuXHRcdGlmICghc2VydmVyKSB0aHJvdyBuZXcgRXJyb3IoYFNlcnZlciAke3NlcnZlck5hbWV9IG5vdCBmb3VuZGApXG5cdFx0Y29uc3QgeyBfY2xpZW50OiBjbGllbnQgfSA9IHNlcnZlclxuXHRcdGlmICghY2xpZW50KSB0aHJvdyBuZXcgRXJyb3IoYENsaWVudCBmb3Igc2VydmVyICR7c2VydmVyTmFtZX0gbm90IGZvdW5kYClcblxuXHRcdC8vIENhbGwgdGhlIHRvb2wgd2l0aCB0aGUgcHJvdmlkZWQgcGFyYW1ldGVyc1xuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgY2xpZW50LmNhbGxUb29sKHtcblx0XHRcdG5hbWU6IHJlbW92ZU1DUFRvb2xOYW1lUHJlZml4KHRvb2xOYW1lKSxcblx0XHRcdGFyZ3VtZW50czogcGFyYW1zXG5cdFx0fSlcblx0XHRjb25zdCB7IGNvbnRlbnQgfSA9IHJlc3BvbnNlIGFzIENhbGxUb29sUmVzdWx0XG5cdFx0Y29uc3QgcmV0dXJuVmFsdWUgPSBjb250ZW50WzBdXG5cblx0XHRpZiAocmV0dXJuVmFsdWUudHlwZSA9PT0gJ3RleHQnKSB7XG5cdFx0XHQvLyBoYW5kbGUgdGV4dCByZXNwb25zZVxuXG5cdFx0XHRpZiAocmVzcG9uc2UuaXNFcnJvcikge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRvb2wgY2FsbCBlcnJvcjogJHtyZXR1cm5WYWx1ZS50ZXh0fWApXG5cdFx0XHR9XG5cblx0XHRcdC8vIGhhbmRsZSBzdWNjZXNzXG5cdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRldmVudDogJ3RleHQnLFxuXHRcdFx0XHR0ZXh0OiByZXR1cm5WYWx1ZS50ZXh0LFxuXHRcdFx0XHR0b29sTmFtZSxcblx0XHRcdFx0c2VydmVyTmFtZSxcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBpZiAocmV0dXJuVmFsdWUudHlwZSA9PT0gJ2F1ZGlvJykge1xuXHRcdC8vIFx0Ly8gaGFuZGxlIGF1ZGlvIHJlc3BvbnNlXG5cdFx0Ly8gfVxuXG5cdFx0Ly8gaWYgKHJldHVyblZhbHVlLnR5cGUgPT09ICdpbWFnZScpIHtcblx0XHQvLyBcdC8vIGhhbmRsZSBpbWFnZSByZXNwb25zZVxuXHRcdC8vIH1cblxuXHRcdC8vIGlmIChyZXR1cm5WYWx1ZS50eXBlID09PSAncmVzb3VyY2UnKSB7XG5cdFx0Ly8gXHQvLyBoYW5kbGUgcmVzb3VyY2UgcmVzcG9uc2Vcblx0XHQvLyB9XG5cblx0XHR0aHJvdyBuZXcgRXJyb3IoYFRvb2wgY2FsbCBlcnJvcjogV2UgZG9uXFwndCBzdXBwb3J0ICR7cmV0dXJuVmFsdWUudHlwZX0gdG9vbCByZXNwb25zZSB5ZXQgZm9yIHRvb2wgJHt0b29sTmFtZX0gb24gc2VydmVyICR7c2VydmVyTmFtZX1gKVxuXHR9XG5cblx0Ly8gdG9vbCBjYWxsIGVycm9yIHdyYXBwZXJcblx0cHJpdmF0ZSBhc3luYyBfc2FmZUNhbGxUb29sKHNlcnZlck5hbWU6IHN0cmluZywgdG9vbE5hbWU6IHN0cmluZywgcGFyYW1zOiBhbnkpOiBQcm9taXNlPFJhd01DUFRvb2xDYWxsPiB7XG5cdFx0dHJ5IHtcblx0XHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5fY2FsbFRvb2woc2VydmVyTmFtZSwgdG9vbE5hbWUsIHBhcmFtcylcblx0XHRcdHJldHVybiByZXNwb25zZVxuXHRcdH0gY2F0Y2ggKGVycikge1xuXG5cdFx0XHRsZXQgZXJyb3JNZXNzYWdlOiBzdHJpbmc7XG5cblx0XHRcdGlmICh0eXBlb2YgZXJyID09PSAnb2JqZWN0JyAmJiBlcnIgIT09IG51bGwgJiYgZXJyWydjb2RlJ10pIHtcblx0XHRcdFx0Y29uc3QgY29kZSA9IGVyci5jb2RlXG5cdFx0XHRcdGxldCBjb2RlRGVzY3JpcHRpb24gPSAnJ1xuXHRcdFx0XHRpZiAoY29kZSA9PT0gLTMyNzAwKVxuXHRcdFx0XHRcdGNvZGVEZXNjcmlwdGlvbiA9ICdQYXJzZSBFcnJvcic7XG5cdFx0XHRcdGlmIChjb2RlID09PSAtMzI2MDApXG5cdFx0XHRcdFx0Y29kZURlc2NyaXB0aW9uID0gJ0ludmFsaWQgUmVxdWVzdCc7XG5cdFx0XHRcdGlmIChjb2RlID09PSAtMzI2MDEpXG5cdFx0XHRcdFx0Y29kZURlc2NyaXB0aW9uID0gJ01ldGhvZCBOb3QgRm91bmQnO1xuXHRcdFx0XHRpZiAoY29kZSA9PT0gLTMyNjAyKVxuXHRcdFx0XHRcdGNvZGVEZXNjcmlwdGlvbiA9ICdJbnZhbGlkIFBhcmFtZXRlcnMnO1xuXHRcdFx0XHRpZiAoY29kZSA9PT0gLTMyNjAzKVxuXHRcdFx0XHRcdGNvZGVEZXNjcmlwdGlvbiA9ICdJbnRlcm5hbCBFcnJvcic7XG5cdFx0XHRcdGVycm9yTWVzc2FnZSA9IGAke2NvZGVEZXNjcmlwdGlvbn0uIEZ1bGwgcmVzcG9uc2U6XFxuJHtKU09OLnN0cmluZ2lmeShlcnIsIG51bGwsIDIpfWBcblx0XHRcdH1cblx0XHRcdC8vIENoZWNrIGlmIGl0J3MgYW4gTUNQIGVycm9yIHdpdGggYSBjb2RlXG5cdFx0XHRlbHNlIGlmICh0eXBlb2YgZXJyID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHQvLyBTdHJpbmcgZXJyb3Jcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gZXJyO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gVW5rbm93biBlcnJvciBmb3JtYXRcblx0XHRcdFx0ZXJyb3JNZXNzYWdlID0gSlNPTi5zdHJpbmdpZnkoZXJyLCBudWxsLCAyKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZnVsbEVycm9yTWVzc2FnZSA9IGBcdTI3NEMgRmFpbGVkIHRvIGNhbGwgdG9vbCBcIiR7dG9vbE5hbWV9XCIgb24gc2VydmVyIFwiJHtzZXJ2ZXJOYW1lfVwiOiAke2Vycm9yTWVzc2FnZX1gO1xuXHRcdFx0Y29uc3QgZXJyb3JSZXNwb25zZTogTUNQVG9vbEVycm9yUmVzcG9uc2UgPSB7XG5cdFx0XHRcdGV2ZW50OiAnZXJyb3InLFxuXHRcdFx0XHR0ZXh0OiBmdWxsRXJyb3JNZXNzYWdlLFxuXHRcdFx0XHR0b29sTmFtZSxcblx0XHRcdFx0c2VydmVyTmFtZSxcblx0XHRcdH1cblx0XHRcdHJldHVybiBlcnJvclJlc3BvbnNlXG5cdFx0fVxuXHR9XG59XG5cblxuIl0sCiAgIm1hcHBpbmdzIjogIkFBVUEsU0FBUyxlQUFzQjtBQUMvQixTQUFTLGNBQWM7QUFDdkIsU0FBUyw0QkFBNEI7QUFDckMsU0FBUyxxQ0FBcUM7QUFDOUMsU0FBUywwQkFBMEI7QUFDbkMsU0FBZ0osK0JBQStCO0FBSy9LLE1BQU0sa0JBQWtCLENBQUMsZUFBdUI7QUFDL0MsU0FBTztBQUFBLElBQ04sTUFBTSxHQUFHLFVBQVU7QUFBQSxJQUNuQixTQUFTO0FBQUE7QUFBQSxFQUVWO0FBQ0Q7QUFxQk8sTUFBTSxXQUFxQztBQUFBLEVBb0JqRCxjQUNFO0FBbkJGLFNBQWlCLGlCQUFpQyxDQUFDO0FBQ25ELFNBQWlCLHlCQUFzQyxvQkFBSSxJQUFJO0FBRy9EO0FBQUEsU0FBaUIsY0FBYztBQUFBLE1BQzlCLGFBQWE7QUFBQSxRQUNaLE9BQU8sSUFBSSxRQUFnQztBQUFBLFFBQzNDLFVBQVUsSUFBSSxRQUFnQztBQUFBLFFBQzlDLFVBQVUsSUFBSSxRQUFnQztBQUFBLE1BQy9DO0FBQUEsSUFDRDtBQUFBLEVBU0k7QUFBQTtBQUFBLEVBR0osT0FBTyxHQUFZLE9BQTJCO0FBRzdDLFFBQUksVUFBVSxlQUFnQixRQUFPLEtBQUssWUFBWSxZQUFZLE1BQU07QUFBQSxhQUMvRCxVQUFVLGtCQUFtQixRQUFPLEtBQUssWUFBWSxZQUFZLFNBQVM7QUFBQSxhQUMxRSxVQUFVLGtCQUFtQixRQUFPLEtBQUssWUFBWSxZQUFZLFNBQVM7QUFBQSxRQU05RSxPQUFNLElBQUksTUFBTSxvQkFBb0IsS0FBSyxFQUFFO0FBQUEsRUFDakQ7QUFBQTtBQUFBLEVBR0EsTUFBTSxLQUFLLEdBQVksU0FBaUIsUUFBMkI7QUFDbEUsUUFBSTtBQUNILFVBQUksWUFBWSxxQkFBcUI7QUFDcEMsY0FBTSxLQUFLLG1CQUFtQixNQUFNO0FBQUEsTUFDckMsV0FDUyxZQUFZLHNCQUFzQjtBQUMx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QUFBLE1BQ3RDLFdBQVc7QUFBQSxJQUNaLENBQUM7QUFDRCxVQUFNLEVBQUUsUUFBUSxJQUFJO0FBQ3BCLFVBQU0sY0FBYyxRQUFRLENBQUM7QUFFN0IsUUFBSSxZQUFZLFNBQVMsUUFBUTtBQUdoQyxVQUFJLFNBQVMsU0FBUztBQUNyQixjQUFNLElBQUksTUFBTSxvQkFBb0IsWUFBWSxJQUFJLEVBQUU7QUFBQSxNQUN2RDtBQUdBLGFBQU87QUFBQSxRQUNOLE9BQU87QUFBQSxRQUNQLE1BQU0sWUFBWTtBQUFBLFFBQ2xCO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBY0EsVUFBTSxJQUFJLE1BQU0scUNBQXNDLFlBQVksSUFBSSwrQkFBK0IsUUFBUSxjQUFjLFVBQVUsRUFBRTtBQUFBLEVBQ3hJO0FBQUE7QUFBQSxFQUdBLE1BQWMsY0FBYyxZQUFvQixVQUFrQixRQUFzQztBQUN2RyxRQUFJO0FBQ0gsWUFBTSxXQUFXLE1BQU0sS0FBSyxVQUFVLFlBQVksVUFBVSxNQUFNO0FBQ2xFLGFBQU87QUFBQSxJQUNSLFNBQVMsS0FBSztBQUViLFVBQUk7QUFFSixVQUFJLE9BQU8sUUFBUSxZQUFZLFFBQVEsUUFBUSxJQUFJLE1BQU0sR0FBRztBQUMzRCxjQUFNLE9BQU8sSUFBSTtBQUNqQixZQUFJLGtCQUFrQjtBQUN0QixZQUFJLFNBQVM7QUFDWiw0QkFBa0I7QUFDbkIsWUFBSSxTQUFTO0FBQ1osNEJBQWtCO0FBQ25CLFlBQUksU0FBUztBQUNaLDRCQUFrQjtBQUNuQixZQUFJLFNBQVM7QUFDWiw0QkFBa0I7QUFDbkIsWUFBSSxTQUFTO0FBQ1osNEJBQWtCO0FBQ25CLHVCQUFlLEdBQUcsZUFBZTtBQUFBLEVBQXFCLEtBQUssVUFBVSxLQUFLLE1BQU0sQ0FBQyxDQUFDO0FBQUEsTUFDbkYsV0FFUyxPQUFPLFFBQVEsVUFBVTtBQUVqQyx1QkFBZTtBQUFBLE1BQ2hCLE9BQU87QUFFTix1QkFBZSxLQUFLLFVBQVUsS0FBSyxNQUFNLENBQUM7QUFBQSxNQUMzQztBQUVBLFlBQU0sbUJBQW1CLCtCQUEwQixRQUFRLGdCQUFnQixVQUFVLE1BQU0sWUFBWTtBQUN2RyxZQUFNLGdCQUFzQztBQUFBLFFBQzNDLE9BQU87QUFBQSxRQUNQLE1BQU07QUFBQSxRQUNOO0FBQUEsUUFDQTtBQUFBLE1BQ0Q7QUFDQSxhQUFPO0FBQUEsSUFDUjtBQUFBLEVBQ0Q7QUFDRDsiLAogICJuYW1lcyI6IFtdCn0K
