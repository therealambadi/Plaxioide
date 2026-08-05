import { equals } from "../../../../base/common/arrays.js";
import { DeferredPromise, IntervalTimer } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { CancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { autorun } from "../../../../base/common/observable.js";
import { canLog, LogLevel } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { McpConnectionState, MpcResponseError } from "./mcpTypes.js";
import { MCP } from "./modelContextProtocol.js";
class McpServerRequestHandler extends Disposable {
  constructor(launch, logger) {
    super();
    this.launch = launch;
    this.logger = logger;
    this._nextRequestId = 1;
    this._pendingRequests = /* @__PURE__ */ new Map();
    this._hasAnnouncedRoots = false;
    this._roots = [];
    // Event emitters for server notifications
    this._onDidReceiveCancelledNotification = this._register(new Emitter());
    this.onDidReceiveCancelledNotification = this._onDidReceiveCancelledNotification.event;
    this._onDidReceiveProgressNotification = this._register(new Emitter());
    this.onDidReceiveProgressNotification = this._onDidReceiveProgressNotification.event;
    this._onDidChangeResourceList = this._register(new Emitter());
    this.onDidChangeResourceList = this._onDidChangeResourceList.event;
    this._onDidUpdateResource = this._register(new Emitter());
    this.onDidUpdateResource = this._onDidUpdateResource.event;
    this._onDidChangeToolList = this._register(new Emitter());
    this.onDidChangeToolList = this._onDidChangeToolList.event;
    this._onDidChangePromptList = this._register(new Emitter());
    this.onDidChangePromptList = this._onDidChangePromptList.event;
    this._register(launch.onDidReceiveMessage((message) => this.handleMessage(message)));
    this._register(autorun((reader) => {
      const state = launch.state.read(reader).state;
      if (state === McpConnectionState.Kind.Error || state === McpConnectionState.Kind.Stopped) {
        this.cancelAllRequests();
      }
    }));
  }
  set roots(roots) {
    if (!equals(this._roots, roots)) {
      this._roots = roots;
      if (this._hasAnnouncedRoots) {
        this.sendNotification({ method: "notifications/roots/list_changed" });
        this._hasAnnouncedRoots = false;
      }
    }
  }
  get capabilities() {
    return this._serverInit.capabilities;
  }
  /**
   * Connects to the MCP server and does the initialization handshake.
   * @throws MpcResponseError if the server fails to initialize.
   */
  static async create(instaService, launch, logger, token) {
    const mcp = new McpServerRequestHandler(launch, logger);
    const store = new DisposableStore();
    try {
      const timer = store.add(new IntervalTimer());
      timer.cancelAndSet(() => {
        logger.info("Waiting for server to respond to `initialize` request...");
      }, 5e3);
      await instaService.invokeFunction(async (accessor) => {
        const productService = accessor.get(IProductService);
        const initialized = await mcp.sendRequest({
          method: "initialize",
          params: {
            protocolVersion: MCP.LATEST_PROTOCOL_VERSION,
            capabilities: {
              roots: { listChanged: true }
            },
            clientInfo: {
              name: productService.nameLong,
              version: productService.version
            }
          }
        }, token);
        mcp._serverInit = initialized;
        mcp.sendNotification({
          method: "notifications/initialized"
        });
      });
      return mcp;
    } catch (e) {
      mcp.dispose();
      throw e;
    } finally {
      store.dispose();
    }
  }
  /**
   * Send a client request to the server and return the response.
   *
   * @param request The request to send
   * @param token Cancellation token
   * @param timeoutMs Optional timeout in milliseconds
   * @returns A promise that resolves with the response
   */
  async sendRequest(request, token = CancellationToken.None) {
    if (this._store.isDisposed) {
      return Promise.reject(new CancellationError());
    }
    const id = this._nextRequestId++;
    const jsonRpcRequest = {
      jsonrpc: MCP.JSONRPC_VERSION,
      id,
      ...request
    };
    const promise = new DeferredPromise();
    this._pendingRequests.set(id, { promise });
    const cancelListener = token.onCancellationRequested(() => {
      if (!promise.isSettled) {
        this._pendingRequests.delete(id);
        this.sendNotification({ method: "notifications/cancelled", params: { requestId: id } });
        promise.cancel();
      }
      cancelListener.dispose();
    });
    this.send(jsonRpcRequest);
    const ret = promise.p.finally(() => {
      cancelListener.dispose();
      this._pendingRequests.delete(id);
    });
    return ret;
  }
  send(mcp) {
    if (canLog(this.logger.getLevel(), LogLevel.Debug)) {
      this.logger.debug(`[editor -> server] ${JSON.stringify(mcp)}`);
    }
    this.launch.send(mcp);
  }
  /**
   * Handles paginated requests by making multiple requests until all items are retrieved.
   *
   * @param method The method name to call
   * @param getItems Function to extract the array of items from a result
   * @param initialParams Initial parameters
   * @param token Cancellation token
   * @returns Promise with all items combined
   */
  async sendRequestPaginated(method, getItems, initialParams, token = CancellationToken.None) {
    let allItems = [];
    let nextCursor = void 0;
    do {
      const params = {
        ...initialParams,
        cursor: nextCursor
      };
      const result = await this.sendRequest({ method, params }, token);
      allItems = allItems.concat(getItems(result));
      nextCursor = result.nextCursor;
    } while (nextCursor !== void 0 && !token.isCancellationRequested);
    return allItems;
  }
  sendNotification(notification) {
    this.send({ ...notification, jsonrpc: MCP.JSONRPC_VERSION });
  }
  /**
   * Handle incoming messages from the server
   */
  handleMessage(message) {
    if (canLog(this.logger.getLevel(), LogLevel.Debug)) {
      this.logger.debug(`[server <- editor] ${JSON.stringify(message)}`);
    }
    if ("id" in message) {
      if ("result" in message) {
        this.handleResult(message);
      } else if ("error" in message) {
        this.handleError(message);
      }
    }
    if ("method" in message) {
      if ("id" in message) {
        this.handleServerRequest(message);
      } else {
        this.handleServerNotification(message);
      }
    }
  }
  /**
   * Handle successful responses
   */
  handleResult(response) {
    const request = this._pendingRequests.get(response.id);
    if (request) {
      this._pendingRequests.delete(response.id);
      request.promise.complete(response.result);
    }
  }
  /**
   * Handle error responses
   */
  handleError(response) {
    const request = this._pendingRequests.get(response.id);
    if (request) {
      this._pendingRequests.delete(response.id);
      request.promise.error(new MpcResponseError(response.error.message, response.error.code, response.error.data));
    }
  }
  /**
   * Handle incoming server requests
   */
  handleServerRequest(request) {
    switch (request.method) {
      case "ping":
        return this.respondToRequest(request, this.handlePing(request));
      case "roots/list":
        return this.respondToRequest(request, this.handleRootsList(request));
      default: {
        const errorResponse = {
          jsonrpc: MCP.JSONRPC_VERSION,
          id: request.id,
          error: {
            code: MCP.METHOD_NOT_FOUND,
            message: `Method not found: ${request.method}`
          }
        };
        this.send(errorResponse);
        break;
      }
    }
  }
  /**
   * Handle incoming server notifications
   */
  handleServerNotification(request) {
    switch (request.method) {
      case "notifications/message":
        return this.handleLoggingNotification(request);
      case "notifications/cancelled":
        this._onDidReceiveCancelledNotification.fire(request);
        return this.handleCancelledNotification(request);
      case "notifications/progress":
        this._onDidReceiveProgressNotification.fire(request);
        return;
      case "notifications/resources/list_changed":
        this._onDidChangeResourceList.fire();
        return;
      case "notifications/resources/updated":
        this._onDidUpdateResource.fire(request);
        return;
      case "notifications/tools/list_changed":
        this._onDidChangeToolList.fire();
        return;
      case "notifications/prompts/list_changed":
        this._onDidChangePromptList.fire();
        return;
    }
  }
  handleCancelledNotification(request) {
    const pendingRequest = this._pendingRequests.get(request.params.requestId);
    if (pendingRequest) {
      this._pendingRequests.delete(request.params.requestId);
      pendingRequest.promise.cancel();
    }
  }
  handleLoggingNotification(request) {
    let contents = typeof request.params.data === "string" ? request.params.data : JSON.stringify(request.params.data);
    if (request.params.logger) {
      contents = `${request.params.logger}: ${contents}`;
    }
    switch (request.params?.level) {
      case "debug":
        this.logger.debug(contents);
        break;
      case "info":
      case "notice":
        this.logger.info(contents);
        break;
      case "warning":
        this.logger.warn(contents);
        break;
      case "error":
      case "critical":
      case "alert":
      case "emergency":
        this.logger.error(contents);
        break;
      default:
        this.logger.info(contents);
        break;
    }
  }
  /**
   * Send a generic response to a request
   */
  respondToRequest(request, result) {
    const response = {
      jsonrpc: MCP.JSONRPC_VERSION,
      id: request.id,
      result
    };
    this.send(response);
  }
  /**
   * Send a response to a ping request
   */
  handlePing(_request) {
    return {};
  }
  /**
   * Send a response to a roots/list request
   */
  handleRootsList(_request) {
    this._hasAnnouncedRoots = true;
    return { roots: this._roots };
  }
  cancelAllRequests() {
    this._pendingRequests.forEach((pending) => pending.promise.cancel());
    this._pendingRequests.clear();
  }
  dispose() {
    this.cancelAllRequests();
    super.dispose();
  }
  /**
   * Send an initialize request
   */
  initialize(params, token) {
    return this.sendRequest({ method: "initialize", params }, token);
  }
  /**
   * List available resources
   */
  listResources(params, token) {
    return this.sendRequestPaginated("resources/list", (result) => result.resources, params, token);
  }
  /**
   * Read a specific resource
   */
  readResource(params, token) {
    return this.sendRequest({ method: "resources/read", params }, token);
  }
  /**
   * List available resource templates
   */
  listResourceTemplates(params, token) {
    return this.sendRequestPaginated("resources/templates/list", (result) => result.resourceTemplates, params, token);
  }
  /**
   * Subscribe to resource updates
   */
  subscribe(params, token) {
    return this.sendRequest({ method: "resources/subscribe", params }, token);
  }
  /**
   * Unsubscribe from resource updates
   */
  unsubscribe(params, token) {
    return this.sendRequest({ method: "resources/unsubscribe", params }, token);
  }
  /**
   * List available prompts
   */
  listPrompts(params, token) {
    return this.sendRequestPaginated("prompts/list", (result) => result.prompts, params, token);
  }
  /**
   * Get a specific prompt
   */
  getPrompt(params, token) {
    return this.sendRequest({ method: "prompts/get", params }, token);
  }
  /**
   * List available tools
   */
  listTools(params, token) {
    return this.sendRequestPaginated("tools/list", (result) => result.tools, params, token);
  }
  /**
   * Call a specific tool
   */
  callTool(params, token) {
    return this.sendRequest({ method: "tools/call", params }, token);
  }
  /**
   * Set the logging level
   */
  setLevel(params, token) {
    return this.sendRequest({ method: "logging/setLevel", params }, token);
  }
  /**
   * Find completions for an argument
   */
  complete(params, token) {
    return this.sendRequest({ method: "completion/complete", params }, token);
  }
}
export {
  McpServerRequestHandler
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9tY3AvY29tbW9uL21jcFNlcnZlclJlcXVlc3RIYW5kbGVyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZXF1YWxzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSwgSW50ZXJ2YWxUaW1lciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvbkVycm9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JzLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgYXV0b3J1biB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL29ic2VydmFibGUuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBjYW5Mb2csIElMb2dnZXIsIExvZ0xldmVsIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSU1jcE1lc3NhZ2VUcmFuc3BvcnQgfSBmcm9tICcuL21jcFJlZ2lzdHJ5VHlwZXMuanMnO1xuaW1wb3J0IHsgTWNwQ29ubmVjdGlvblN0YXRlLCBNcGNSZXNwb25zZUVycm9yIH0gZnJvbSAnLi9tY3BUeXBlcy5qcyc7XG5pbXBvcnQgeyBNQ1AgfSBmcm9tICcuL21vZGVsQ29udGV4dFByb3RvY29sLmpzJztcblxuLyoqXG4gKiBNYXBzIHJlcXVlc3QgSURzIHRvIGhhbmRsZXJzLlxuICovXG5pbnRlcmZhY2UgUGVuZGluZ1JlcXVlc3Qge1xuXHRwcm9taXNlOiBEZWZlcnJlZFByb21pc2U8TUNQLlJlc3VsdD47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgTWNwUm9vdCB7XG5cdHVyaTogc3RyaW5nO1xuXHRuYW1lPzogc3RyaW5nO1xufVxuXG4vKipcbiAqIFJlcXVlc3QgaGFuZGxlciBmb3IgY29tbXVuaWNhdGluZyB3aXRoIGFuIE1DUCBzZXJ2ZXIuXG4gKlxuICogSGFuZGxlcyBzZW5kaW5nIHJlcXVlc3RzIGFuZCByZWNlaXZpbmcgcmVzcG9uc2VzLCB3aXRoIGF1dG9tYXRpY1xuICogaGFuZGxpbmcgb2YgcGluZyByZXF1ZXN0cyBhbmQgdHlwZWQgY2xpZW50IHJlcXVlc3QgbWV0aG9kcy5cbiAqL1xuZXhwb3J0IGNsYXNzIE1jcFNlcnZlclJlcXVlc3RIYW5kbGVyIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX25leHRSZXF1ZXN0SWQgPSAxO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wZW5kaW5nUmVxdWVzdHMgPSBuZXcgTWFwPE1DUC5SZXF1ZXN0SWQsIFBlbmRpbmdSZXF1ZXN0PigpO1xuXG5cdHByaXZhdGUgX2hhc0Fubm91bmNlZFJvb3RzID0gZmFsc2U7XG5cdHByaXZhdGUgX3Jvb3RzOiBNQ1AuUm9vdFtdID0gW107XG5cblx0cHVibGljIHNldCByb290cyhyb290czogTUNQLlJvb3RbXSkge1xuXHRcdGlmICghZXF1YWxzKHRoaXMuX3Jvb3RzLCByb290cykpIHtcblx0XHRcdHRoaXMuX3Jvb3RzID0gcm9vdHM7XG5cdFx0XHRpZiAodGhpcy5faGFzQW5ub3VuY2VkUm9vdHMpIHtcblx0XHRcdFx0dGhpcy5zZW5kTm90aWZpY2F0aW9uKHsgbWV0aG9kOiAnbm90aWZpY2F0aW9ucy9yb290cy9saXN0X2NoYW5nZWQnIH0pO1xuXHRcdFx0XHR0aGlzLl9oYXNBbm5vdW5jZWRSb290cyA9IGZhbHNlO1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3NlcnZlckluaXQhOiBNQ1AuSW5pdGlhbGl6ZVJlc3VsdDtcblx0cHVibGljIGdldCBjYXBhYmlsaXRpZXMoKTogTUNQLlNlcnZlckNhcGFiaWxpdGllcyB7XG5cdFx0cmV0dXJuIHRoaXMuX3NlcnZlckluaXQuY2FwYWJpbGl0aWVzO1xuXHR9XG5cblx0Ly8gRXZlbnQgZW1pdHRlcnMgZm9yIHNlcnZlciBub3RpZmljYXRpb25zXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUmVjZWl2ZUNhbmNlbGxlZE5vdGlmaWNhdGlvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPE1DUC5DYW5jZWxsZWROb3RpZmljYXRpb24+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlY2VpdmVDYW5jZWxsZWROb3RpZmljYXRpb24gPSB0aGlzLl9vbkRpZFJlY2VpdmVDYW5jZWxsZWROb3RpZmljYXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRSZWNlaXZlUHJvZ3Jlc3NOb3RpZmljYXRpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxNQ1AuUHJvZ3Jlc3NOb3RpZmljYXRpb24+KCkpO1xuXHRyZWFkb25seSBvbkRpZFJlY2VpdmVQcm9ncmVzc05vdGlmaWNhdGlvbiA9IHRoaXMuX29uRGlkUmVjZWl2ZVByb2dyZXNzTm90aWZpY2F0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUmVzb3VyY2VMaXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlUmVzb3VyY2VMaXN0ID0gdGhpcy5fb25EaWRDaGFuZ2VSZXNvdXJjZUxpc3QuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRVcGRhdGVSZXNvdXJjZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPE1DUC5SZXNvdXJjZVVwZGF0ZWROb3RpZmljYXRpb24+KCkpO1xuXHRyZWFkb25seSBvbkRpZFVwZGF0ZVJlc291cmNlID0gdGhpcy5fb25EaWRVcGRhdGVSZXNvdXJjZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVRvb2xMaXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVG9vbExpc3QgPSB0aGlzLl9vbkRpZENoYW5nZVRvb2xMaXN0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUHJvbXB0TGlzdCA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZVByb21wdExpc3QgPSB0aGlzLl9vbkRpZENoYW5nZVByb21wdExpc3QuZXZlbnQ7XG5cblx0LyoqXG5cdCAqIENvbm5lY3RzIHRvIHRoZSBNQ1Agc2VydmVyIGFuZCBkb2VzIHRoZSBpbml0aWFsaXphdGlvbiBoYW5kc2hha2UuXG5cdCAqIEB0aHJvd3MgTXBjUmVzcG9uc2VFcnJvciBpZiB0aGUgc2VydmVyIGZhaWxzIHRvIGluaXRpYWxpemUuXG5cdCAqL1xuXHRwdWJsaWMgc3RhdGljIGFzeW5jIGNyZWF0ZShpbnN0YVNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSwgbGF1bmNoOiBJTWNwTWVzc2FnZVRyYW5zcG9ydCwgbG9nZ2VyOiBJTG9nZ2VyLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0Y29uc3QgbWNwID0gbmV3IE1jcFNlcnZlclJlcXVlc3RIYW5kbGVyKGxhdW5jaCwgbG9nZ2VyKTtcblx0XHRjb25zdCBzdG9yZSA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgdGltZXIgPSBzdG9yZS5hZGQobmV3IEludGVydmFsVGltZXIoKSk7XG5cdFx0XHR0aW1lci5jYW5jZWxBbmRTZXQoKCkgPT4ge1xuXHRcdFx0XHRsb2dnZXIuaW5mbygnV2FpdGluZyBmb3Igc2VydmVyIHRvIHJlc3BvbmQgdG8gYGluaXRpYWxpemVgIHJlcXVlc3QuLi4nKTtcblx0XHRcdH0sIDUwMDApO1xuXG5cdFx0XHRhd2FpdCBpbnN0YVNlcnZpY2UuaW52b2tlRnVuY3Rpb24oYXN5bmMgYWNjZXNzb3IgPT4ge1xuXHRcdFx0XHRjb25zdCBwcm9kdWN0U2VydmljZSA9IGFjY2Vzc29yLmdldChJUHJvZHVjdFNlcnZpY2UpO1xuXHRcdFx0XHRjb25zdCBpbml0aWFsaXplZCA9IGF3YWl0IG1jcC5zZW5kUmVxdWVzdDxNQ1AuSW5pdGlhbGl6ZVJlcXVlc3QsIE1DUC5Jbml0aWFsaXplUmVzdWx0Pih7XG5cdFx0XHRcdFx0bWV0aG9kOiAnaW5pdGlhbGl6ZScsXG5cdFx0XHRcdFx0cGFyYW1zOiB7XG5cdFx0XHRcdFx0XHRwcm90b2NvbFZlcnNpb246IE1DUC5MQVRFU1RfUFJPVE9DT0xfVkVSU0lPTixcblx0XHRcdFx0XHRcdGNhcGFiaWxpdGllczoge1xuXHRcdFx0XHRcdFx0XHRyb290czogeyBsaXN0Q2hhbmdlZDogdHJ1ZSB9LFxuXHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdGNsaWVudEluZm86IHtcblx0XHRcdFx0XHRcdFx0bmFtZTogcHJvZHVjdFNlcnZpY2UubmFtZUxvbmcsXG5cdFx0XHRcdFx0XHRcdHZlcnNpb246IHByb2R1Y3RTZXJ2aWNlLnZlcnNpb24sXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9LCB0b2tlbik7XG5cblx0XHRcdFx0bWNwLl9zZXJ2ZXJJbml0ID0gaW5pdGlhbGl6ZWQ7XG5cblx0XHRcdFx0bWNwLnNlbmROb3RpZmljYXRpb248TUNQLkluaXRpYWxpemVkTm90aWZpY2F0aW9uPih7XG5cdFx0XHRcdFx0bWV0aG9kOiAnbm90aWZpY2F0aW9ucy9pbml0aWFsaXplZCdcblx0XHRcdFx0fSk7XG5cdFx0XHR9KTtcblxuXHRcdFx0cmV0dXJuIG1jcDtcblx0XHR9IGNhdGNoIChlKSB7XG5cdFx0XHRtY3AuZGlzcG9zZSgpO1xuXHRcdFx0dGhyb3cgZTtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdHByb3RlY3RlZCBjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGxhdW5jaDogSU1jcE1lc3NhZ2VUcmFuc3BvcnQsXG5cdFx0cHVibGljIHJlYWRvbmx5IGxvZ2dlcjogSUxvZ2dlcixcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9yZWdpc3RlcihsYXVuY2gub25EaWRSZWNlaXZlTWVzc2FnZShtZXNzYWdlID0+IHRoaXMuaGFuZGxlTWVzc2FnZShtZXNzYWdlKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKGF1dG9ydW4ocmVhZGVyID0+IHtcblx0XHRcdGNvbnN0IHN0YXRlID0gbGF1bmNoLnN0YXRlLnJlYWQocmVhZGVyKS5zdGF0ZTtcblx0XHRcdC8vIHRoZSBoYW5kbGVyIHdpbGwgZ2V0IGRpc3Bvc2VkIHdoZW4gdGhlIGxhdW5jaCBzdG9wcywgYnV0IGlmIHdlJ3JlIHN0aWxsXG5cdFx0XHQvLyBjcmVhdGUoKSdpbmcgd2UgbmVlZCB0byBtYWtlIHN1cmUgdG8gY2FuY2VsIHRoZSBpbml0aWFsaXplIHJlcXVlc3QuXG5cdFx0XHRpZiAoc3RhdGUgPT09IE1jcENvbm5lY3Rpb25TdGF0ZS5LaW5kLkVycm9yIHx8IHN0YXRlID09PSBNY3BDb25uZWN0aW9uU3RhdGUuS2luZC5TdG9wcGVkKSB7XG5cdFx0XHRcdHRoaXMuY2FuY2VsQWxsUmVxdWVzdHMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHQvKipcblx0ICogU2VuZCBhIGNsaWVudCByZXF1ZXN0IHRvIHRoZSBzZXJ2ZXIgYW5kIHJldHVybiB0aGUgcmVzcG9uc2UuXG5cdCAqXG5cdCAqIEBwYXJhbSByZXF1ZXN0IFRoZSByZXF1ZXN0IHRvIHNlbmRcblx0ICogQHBhcmFtIHRva2VuIENhbmNlbGxhdGlvbiB0b2tlblxuXHQgKiBAcGFyYW0gdGltZW91dE1zIE9wdGlvbmFsIHRpbWVvdXQgaW4gbWlsbGlzZWNvbmRzXG5cdCAqIEByZXR1cm5zIEEgcHJvbWlzZSB0aGF0IHJlc29sdmVzIHdpdGggdGhlIHJlc3BvbnNlXG5cdCAqL1xuXHRwcml2YXRlIGFzeW5jIHNlbmRSZXF1ZXN0PFQgZXh0ZW5kcyBNQ1AuQ2xpZW50UmVxdWVzdCwgUiBleHRlbmRzIE1DUC5TZXJ2ZXJSZXN1bHQ+KFxuXHRcdHJlcXVlc3Q6IFBpY2s8VCwgJ3BhcmFtcycgfCAnbWV0aG9kJz4sXG5cdFx0dG9rZW46IENhbmNlbGxhdGlvblRva2VuID0gQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZVxuXHQpOiBQcm9taXNlPFI+IHtcblx0XHRpZiAodGhpcy5fc3RvcmUuaXNEaXNwb3NlZCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBDYW5jZWxsYXRpb25FcnJvcigpKTtcblx0XHR9XG5cblx0XHRjb25zdCBpZCA9IHRoaXMuX25leHRSZXF1ZXN0SWQrKztcblxuXHRcdC8vIENyZWF0ZSB0aGUgZnVsbCBKU09OLVJQQyByZXF1ZXN0XG5cdFx0Y29uc3QganNvblJwY1JlcXVlc3Q6IE1DUC5KU09OUlBDUmVxdWVzdCA9IHtcblx0XHRcdGpzb25ycGM6IE1DUC5KU09OUlBDX1ZFUlNJT04sXG5cdFx0XHRpZCxcblx0XHRcdC4uLnJlcXVlc3Rcblx0XHR9O1xuXG5cdFx0Y29uc3QgcHJvbWlzZSA9IG5ldyBEZWZlcnJlZFByb21pc2U8TUNQLlNlcnZlclJlc3VsdD4oKTtcblx0XHQvLyBTdG9yZSB0aGUgcGVuZGluZyByZXF1ZXN0XG5cdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLnNldChpZCwgeyBwcm9taXNlIH0pO1xuXHRcdC8vIFNldCB1cCBjYW5jZWxsYXRpb25cblx0XHRjb25zdCBjYW5jZWxMaXN0ZW5lciA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdGlmICghcHJvbWlzZS5pc1NldHRsZWQpIHtcblx0XHRcdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShpZCk7XG5cdFx0XHRcdHRoaXMuc2VuZE5vdGlmaWNhdGlvbih7IG1ldGhvZDogJ25vdGlmaWNhdGlvbnMvY2FuY2VsbGVkJywgcGFyYW1zOiB7IHJlcXVlc3RJZDogaWQgfSB9KTtcblx0XHRcdFx0cHJvbWlzZS5jYW5jZWwoKTtcblx0XHRcdH1cblx0XHRcdGNhbmNlbExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHR9KTtcblxuXHRcdC8vIFNlbmQgdGhlIHJlcXVlc3Rcblx0XHR0aGlzLnNlbmQoanNvblJwY1JlcXVlc3QpO1xuXHRcdGNvbnN0IHJldCA9IHByb21pc2UucC5maW5hbGx5KCgpID0+IHtcblx0XHRcdGNhbmNlbExpc3RlbmVyLmRpc3Bvc2UoKTtcblx0XHRcdHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5kZWxldGUoaWQpO1xuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHJldCBhcyBQcm9taXNlPFI+O1xuXHR9XG5cblx0cHJpdmF0ZSBzZW5kKG1jcDogTUNQLkpTT05SUENNZXNzYWdlKSB7XG5cdFx0aWYgKGNhbkxvZyh0aGlzLmxvZ2dlci5nZXRMZXZlbCgpLCBMb2dMZXZlbC5EZWJ1ZykpIHsgLy8gYXZvaWQgYnVpbGRpbmcgdGhlIHN0cmluZyBpZiB3ZSBkb24ndCBuZWVkIHRvXG5cdFx0XHR0aGlzLmxvZ2dlci5kZWJ1ZyhgW2VkaXRvciAtPiBzZXJ2ZXJdICR7SlNPTi5zdHJpbmdpZnkobWNwKX1gKTtcblx0XHR9XG5cblx0XHR0aGlzLmxhdW5jaC5zZW5kKG1jcCk7XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlcyBwYWdpbmF0ZWQgcmVxdWVzdHMgYnkgbWFraW5nIG11bHRpcGxlIHJlcXVlc3RzIHVudGlsIGFsbCBpdGVtcyBhcmUgcmV0cmlldmVkLlxuXHQgKlxuXHQgKiBAcGFyYW0gbWV0aG9kIFRoZSBtZXRob2QgbmFtZSB0byBjYWxsXG5cdCAqIEBwYXJhbSBnZXRJdGVtcyBGdW5jdGlvbiB0byBleHRyYWN0IHRoZSBhcnJheSBvZiBpdGVtcyBmcm9tIGEgcmVzdWx0XG5cdCAqIEBwYXJhbSBpbml0aWFsUGFyYW1zIEluaXRpYWwgcGFyYW1ldGVyc1xuXHQgKiBAcGFyYW0gdG9rZW4gQ2FuY2VsbGF0aW9uIHRva2VuXG5cdCAqIEByZXR1cm5zIFByb21pc2Ugd2l0aCBhbGwgaXRlbXMgY29tYmluZWRcblx0ICovXG5cdHByaXZhdGUgYXN5bmMgc2VuZFJlcXVlc3RQYWdpbmF0ZWQ8VCBleHRlbmRzIE1DUC5QYWdpbmF0ZWRSZXF1ZXN0ICYgTUNQLkNsaWVudFJlcXVlc3QsIFIgZXh0ZW5kcyBNQ1AuUGFnaW5hdGVkUmVzdWx0LCBJPihtZXRob2Q6IFRbJ21ldGhvZCddLCBnZXRJdGVtczogKHJlc3VsdDogUikgPT4gSVtdLCBpbml0aWFsUGFyYW1zPzogT21pdDxUWydwYXJhbXMnXSwgJ2pzb25ycGMnIHwgJ2lkJz4sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPElbXT4ge1xuXHRcdGxldCBhbGxJdGVtczogSVtdID0gW107XG5cdFx0bGV0IG5leHRDdXJzb3I6IE1DUC5DdXJzb3IgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cblx0XHRkbyB7XG5cdFx0XHRjb25zdCBwYXJhbXM6IFRbJ3BhcmFtcyddID0ge1xuXHRcdFx0XHQuLi5pbml0aWFsUGFyYW1zLFxuXHRcdFx0XHRjdXJzb3I6IG5leHRDdXJzb3Jcblx0XHRcdH07XG5cblx0XHRcdGNvbnN0IHJlc3VsdDogUiA9IGF3YWl0IHRoaXMuc2VuZFJlcXVlc3Q8VCwgUj4oeyBtZXRob2QsIHBhcmFtcyB9LCB0b2tlbik7XG5cdFx0XHRhbGxJdGVtcyA9IGFsbEl0ZW1zLmNvbmNhdChnZXRJdGVtcyhyZXN1bHQpKTtcblx0XHRcdG5leHRDdXJzb3IgPSByZXN1bHQubmV4dEN1cnNvcjtcblx0XHR9IHdoaWxlIChuZXh0Q3Vyc29yICE9PSB1bmRlZmluZWQgJiYgIXRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKTtcblxuXHRcdHJldHVybiBhbGxJdGVtcztcblx0fVxuXG5cdHByaXZhdGUgc2VuZE5vdGlmaWNhdGlvbjxOIGV4dGVuZHMgTUNQLkNsaWVudE5vdGlmaWNhdGlvbj4obm90aWZpY2F0aW9uOiBOKTogdm9pZCB7XG5cdFx0dGhpcy5zZW5kKHsgLi4ubm90aWZpY2F0aW9uLCBqc29ucnBjOiBNQ1AuSlNPTlJQQ19WRVJTSU9OIH0pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBpbmNvbWluZyBtZXNzYWdlcyBmcm9tIHRoZSBzZXJ2ZXJcblx0ICovXG5cdHByaXZhdGUgaGFuZGxlTWVzc2FnZShtZXNzYWdlOiBNQ1AuSlNPTlJQQ01lc3NhZ2UpOiB2b2lkIHtcblx0XHRpZiAoY2FuTG9nKHRoaXMubG9nZ2VyLmdldExldmVsKCksIExvZ0xldmVsLkRlYnVnKSkgeyAvLyBhdm9pZCBidWlsZGluZyB0aGUgc3RyaW5nIGlmIHdlIGRvbid0IG5lZWQgdG9cblx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGBbc2VydmVyIDwtIGVkaXRvcl0gJHtKU09OLnN0cmluZ2lmeShtZXNzYWdlKX1gKTtcblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgcmVzcG9uc2VzIHRvIG91ciByZXF1ZXN0c1xuXHRcdGlmICgnaWQnIGluIG1lc3NhZ2UpIHtcblx0XHRcdGlmICgncmVzdWx0JyBpbiBtZXNzYWdlKSB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlUmVzdWx0KG1lc3NhZ2UpO1xuXHRcdFx0fSBlbHNlIGlmICgnZXJyb3InIGluIG1lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVFcnJvcihtZXNzYWdlKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBIYW5kbGUgcmVxdWVzdHMgZnJvbSB0aGUgc2VydmVyXG5cdFx0aWYgKCdtZXRob2QnIGluIG1lc3NhZ2UpIHtcblx0XHRcdGlmICgnaWQnIGluIG1lc3NhZ2UpIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVTZXJ2ZXJSZXF1ZXN0KG1lc3NhZ2UgYXMgTUNQLkpTT05SUENSZXF1ZXN0ICYgTUNQLlNlcnZlclJlcXVlc3QpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0dGhpcy5oYW5kbGVTZXJ2ZXJOb3RpZmljYXRpb24obWVzc2FnZSBhcyBNQ1AuSlNPTlJQQ05vdGlmaWNhdGlvbiAmIE1DUC5TZXJ2ZXJOb3RpZmljYXRpb24pO1xuXG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBzdWNjZXNzZnVsIHJlc3BvbnNlc1xuXHQgKi9cblx0cHJpdmF0ZSBoYW5kbGVSZXN1bHQocmVzcG9uc2U6IE1DUC5KU09OUlBDUmVzcG9uc2UpOiB2b2lkIHtcblx0XHRjb25zdCByZXF1ZXN0ID0gdGhpcy5fcGVuZGluZ1JlcXVlc3RzLmdldChyZXNwb25zZS5pZCk7XG5cdFx0aWYgKHJlcXVlc3QpIHtcblx0XHRcdHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5kZWxldGUocmVzcG9uc2UuaWQpO1xuXHRcdFx0cmVxdWVzdC5wcm9taXNlLmNvbXBsZXRlKHJlc3BvbnNlLnJlc3VsdCk7XG5cdFx0fVxuXHR9XG5cblx0LyoqXG5cdCAqIEhhbmRsZSBlcnJvciByZXNwb25zZXNcblx0ICovXG5cdHByaXZhdGUgaGFuZGxlRXJyb3IocmVzcG9uc2U6IE1DUC5KU09OUlBDRXJyb3IpOiB2b2lkIHtcblx0XHRjb25zdCByZXF1ZXN0ID0gdGhpcy5fcGVuZGluZ1JlcXVlc3RzLmdldChyZXNwb25zZS5pZCk7XG5cdFx0aWYgKHJlcXVlc3QpIHtcblx0XHRcdHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5kZWxldGUocmVzcG9uc2UuaWQpO1xuXHRcdFx0cmVxdWVzdC5wcm9taXNlLmVycm9yKG5ldyBNcGNSZXNwb25zZUVycm9yKHJlc3BvbnNlLmVycm9yLm1lc3NhZ2UsIHJlc3BvbnNlLmVycm9yLmNvZGUsIHJlc3BvbnNlLmVycm9yLmRhdGEpKTtcblx0XHR9XG5cdH1cblxuXHQvKipcblx0ICogSGFuZGxlIGluY29taW5nIHNlcnZlciByZXF1ZXN0c1xuXHQgKi9cblx0cHJpdmF0ZSBoYW5kbGVTZXJ2ZXJSZXF1ZXN0KHJlcXVlc3Q6IE1DUC5KU09OUlBDUmVxdWVzdCAmIE1DUC5TZXJ2ZXJSZXF1ZXN0KTogdm9pZCB7XG5cdFx0c3dpdGNoIChyZXF1ZXN0Lm1ldGhvZCkge1xuXHRcdFx0Y2FzZSAncGluZyc6XG5cdFx0XHRcdHJldHVybiB0aGlzLnJlc3BvbmRUb1JlcXVlc3QocmVxdWVzdCwgdGhpcy5oYW5kbGVQaW5nKHJlcXVlc3QpKTtcblx0XHRcdGNhc2UgJ3Jvb3RzL2xpc3QnOlxuXHRcdFx0XHRyZXR1cm4gdGhpcy5yZXNwb25kVG9SZXF1ZXN0KHJlcXVlc3QsIHRoaXMuaGFuZGxlUm9vdHNMaXN0KHJlcXVlc3QpKTtcblxuXHRcdFx0ZGVmYXVsdDoge1xuXHRcdFx0XHRjb25zdCBlcnJvclJlc3BvbnNlOiBNQ1AuSlNPTlJQQ0Vycm9yID0ge1xuXHRcdFx0XHRcdGpzb25ycGM6IE1DUC5KU09OUlBDX1ZFUlNJT04sXG5cdFx0XHRcdFx0aWQ6IHJlcXVlc3QuaWQsXG5cdFx0XHRcdFx0ZXJyb3I6IHtcblx0XHRcdFx0XHRcdGNvZGU6IE1DUC5NRVRIT0RfTk9UX0ZPVU5ELFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogYE1ldGhvZCBub3QgZm91bmQ6ICR7cmVxdWVzdC5tZXRob2R9YFxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fTtcblx0XHRcdFx0dGhpcy5zZW5kKGVycm9yUmVzcG9uc2UpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9XG5cdH1cblx0LyoqXG5cdCAqIEhhbmRsZSBpbmNvbWluZyBzZXJ2ZXIgbm90aWZpY2F0aW9uc1xuXHQgKi9cblx0cHJpdmF0ZSBoYW5kbGVTZXJ2ZXJOb3RpZmljYXRpb24ocmVxdWVzdDogTUNQLkpTT05SUENOb3RpZmljYXRpb24gJiBNQ1AuU2VydmVyTm90aWZpY2F0aW9uKTogdm9pZCB7XG5cdFx0c3dpdGNoIChyZXF1ZXN0Lm1ldGhvZCkge1xuXHRcdFx0Y2FzZSAnbm90aWZpY2F0aW9ucy9tZXNzYWdlJzpcblx0XHRcdFx0cmV0dXJuIHRoaXMuaGFuZGxlTG9nZ2luZ05vdGlmaWNhdGlvbihyZXF1ZXN0KTtcblx0XHRcdGNhc2UgJ25vdGlmaWNhdGlvbnMvY2FuY2VsbGVkJzpcblx0XHRcdFx0dGhpcy5fb25EaWRSZWNlaXZlQ2FuY2VsbGVkTm90aWZpY2F0aW9uLmZpcmUocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybiB0aGlzLmhhbmRsZUNhbmNlbGxlZE5vdGlmaWNhdGlvbihyZXF1ZXN0KTtcblx0XHRcdGNhc2UgJ25vdGlmaWNhdGlvbnMvcHJvZ3Jlc3MnOlxuXHRcdFx0XHR0aGlzLl9vbkRpZFJlY2VpdmVQcm9ncmVzc05vdGlmaWNhdGlvbi5maXJlKHJlcXVlc3QpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHRjYXNlICdub3RpZmljYXRpb25zL3Jlc291cmNlcy9saXN0X2NoYW5nZWQnOlxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVJlc291cmNlTGlzdC5maXJlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ25vdGlmaWNhdGlvbnMvcmVzb3VyY2VzL3VwZGF0ZWQnOlxuXHRcdFx0XHR0aGlzLl9vbkRpZFVwZGF0ZVJlc291cmNlLmZpcmUocmVxdWVzdCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ25vdGlmaWNhdGlvbnMvdG9vbHMvbGlzdF9jaGFuZ2VkJzpcblx0XHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUb29sTGlzdC5maXJlKCk7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdGNhc2UgJ25vdGlmaWNhdGlvbnMvcHJvbXB0cy9saXN0X2NoYW5nZWQnOlxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVByb21wdExpc3QuZmlyZSgpO1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVDYW5jZWxsZWROb3RpZmljYXRpb24ocmVxdWVzdDogTUNQLkNhbmNlbGxlZE5vdGlmaWNhdGlvbik6IHZvaWQge1xuXHRcdGNvbnN0IHBlbmRpbmdSZXF1ZXN0ID0gdGhpcy5fcGVuZGluZ1JlcXVlc3RzLmdldChyZXF1ZXN0LnBhcmFtcy5yZXF1ZXN0SWQpO1xuXHRcdGlmIChwZW5kaW5nUmVxdWVzdCkge1xuXHRcdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZShyZXF1ZXN0LnBhcmFtcy5yZXF1ZXN0SWQpO1xuXHRcdFx0cGVuZGluZ1JlcXVlc3QucHJvbWlzZS5jYW5jZWwoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGhhbmRsZUxvZ2dpbmdOb3RpZmljYXRpb24ocmVxdWVzdDogTUNQLkxvZ2dpbmdNZXNzYWdlTm90aWZpY2F0aW9uKTogdm9pZCB7XG5cdFx0bGV0IGNvbnRlbnRzID0gdHlwZW9mIHJlcXVlc3QucGFyYW1zLmRhdGEgPT09ICdzdHJpbmcnID8gcmVxdWVzdC5wYXJhbXMuZGF0YSA6IEpTT04uc3RyaW5naWZ5KHJlcXVlc3QucGFyYW1zLmRhdGEpO1xuXHRcdGlmIChyZXF1ZXN0LnBhcmFtcy5sb2dnZXIpIHtcblx0XHRcdGNvbnRlbnRzID0gYCR7cmVxdWVzdC5wYXJhbXMubG9nZ2VyfTogJHtjb250ZW50c31gO1xuXHRcdH1cblxuXHRcdHN3aXRjaCAocmVxdWVzdC5wYXJhbXM/LmxldmVsKSB7XG5cdFx0XHRjYXNlICdkZWJ1Zyc6XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmRlYnVnKGNvbnRlbnRzKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdpbmZvJzpcblx0XHRcdGNhc2UgJ25vdGljZSc6XG5cdFx0XHRcdHRoaXMubG9nZ2VyLmluZm8oY29udGVudHMpO1xuXHRcdFx0XHRicmVhaztcblx0XHRcdGNhc2UgJ3dhcm5pbmcnOlxuXHRcdFx0XHR0aGlzLmxvZ2dlci53YXJuKGNvbnRlbnRzKTtcblx0XHRcdFx0YnJlYWs7XG5cdFx0XHRjYXNlICdlcnJvcic6XG5cdFx0XHRjYXNlICdjcml0aWNhbCc6XG5cdFx0XHRjYXNlICdhbGVydCc6XG5cdFx0XHRjYXNlICdlbWVyZ2VuY3knOlxuXHRcdFx0XHR0aGlzLmxvZ2dlci5lcnJvcihjb250ZW50cyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0ZGVmYXVsdDpcblx0XHRcdFx0dGhpcy5sb2dnZXIuaW5mbyhjb250ZW50cyk7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdH1cblx0fVxuXG5cdC8qKlxuXHQgKiBTZW5kIGEgZ2VuZXJpYyByZXNwb25zZSB0byBhIHJlcXVlc3Rcblx0ICovXG5cdHByaXZhdGUgcmVzcG9uZFRvUmVxdWVzdChyZXF1ZXN0OiBNQ1AuSlNPTlJQQ1JlcXVlc3QsIHJlc3VsdDogTUNQLlJlc3VsdCk6IHZvaWQge1xuXHRcdGNvbnN0IHJlc3BvbnNlOiBNQ1AuSlNPTlJQQ1Jlc3BvbnNlID0ge1xuXHRcdFx0anNvbnJwYzogTUNQLkpTT05SUENfVkVSU0lPTixcblx0XHRcdGlkOiByZXF1ZXN0LmlkLFxuXHRcdFx0cmVzdWx0XG5cdFx0fTtcblx0XHR0aGlzLnNlbmQocmVzcG9uc2UpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYSByZXNwb25zZSB0byBhIHBpbmcgcmVxdWVzdFxuXHQgKi9cblx0cHJpdmF0ZSBoYW5kbGVQaW5nKF9yZXF1ZXN0OiBNQ1AuUGluZ1JlcXVlc3QpOiB7fSB7XG5cdFx0cmV0dXJuIHt9O1xuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYSByZXNwb25zZSB0byBhIHJvb3RzL2xpc3QgcmVxdWVzdFxuXHQgKi9cblx0cHJpdmF0ZSBoYW5kbGVSb290c0xpc3QoX3JlcXVlc3Q6IE1DUC5MaXN0Um9vdHNSZXF1ZXN0KTogTUNQLkxpc3RSb290c1Jlc3VsdCB7XG5cdFx0dGhpcy5faGFzQW5ub3VuY2VkUm9vdHMgPSB0cnVlO1xuXHRcdHJldHVybiB7IHJvb3RzOiB0aGlzLl9yb290cyB9O1xuXHR9XG5cblx0cHJpdmF0ZSBjYW5jZWxBbGxSZXF1ZXN0cygpIHtcblx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdHMuZm9yRWFjaChwZW5kaW5nID0+IHBlbmRpbmcucHJvbWlzZS5jYW5jZWwoKSk7XG5cdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmNsZWFyKCk7XG5cdH1cblxuXHRwdWJsaWMgb3ZlcnJpZGUgZGlzcG9zZSgpOiB2b2lkIHtcblx0XHR0aGlzLmNhbmNlbEFsbFJlcXVlc3RzKCk7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNlbmQgYW4gaW5pdGlhbGl6ZSByZXF1ZXN0XG5cdCAqL1xuXHRpbml0aWFsaXplKHBhcmFtczogTUNQLkluaXRpYWxpemVSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLkluaXRpYWxpemVSZXN1bHQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zZW5kUmVxdWVzdDxNQ1AuSW5pdGlhbGl6ZVJlcXVlc3QsIE1DUC5Jbml0aWFsaXplUmVzdWx0Pih7IG1ldGhvZDogJ2luaXRpYWxpemUnLCBwYXJhbXMgfSwgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIExpc3QgYXZhaWxhYmxlIHJlc291cmNlc1xuXHQgKi9cblx0bGlzdFJlc291cmNlcyhwYXJhbXM/OiBNQ1AuTGlzdFJlc291cmNlc1JlcXVlc3RbJ3BhcmFtcyddLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxNQ1AuUmVzb3VyY2VbXT4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRSZXF1ZXN0UGFnaW5hdGVkPE1DUC5MaXN0UmVzb3VyY2VzUmVxdWVzdCwgTUNQLkxpc3RSZXNvdXJjZXNSZXN1bHQsIE1DUC5SZXNvdXJjZT4oJ3Jlc291cmNlcy9saXN0JywgcmVzdWx0ID0+IHJlc3VsdC5yZXNvdXJjZXMsIHBhcmFtcywgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJlYWQgYSBzcGVjaWZpYyByZXNvdXJjZVxuXHQgKi9cblx0cmVhZFJlc291cmNlKHBhcmFtczogTUNQLlJlYWRSZXNvdXJjZVJlcXVlc3RbJ3BhcmFtcyddLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxNQ1AuUmVhZFJlc291cmNlUmVzdWx0PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2VuZFJlcXVlc3Q8TUNQLlJlYWRSZXNvdXJjZVJlcXVlc3QsIE1DUC5SZWFkUmVzb3VyY2VSZXN1bHQ+KHsgbWV0aG9kOiAncmVzb3VyY2VzL3JlYWQnLCBwYXJhbXMgfSwgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIExpc3QgYXZhaWxhYmxlIHJlc291cmNlIHRlbXBsYXRlc1xuXHQgKi9cblx0bGlzdFJlc291cmNlVGVtcGxhdGVzKHBhcmFtcz86IE1DUC5MaXN0UmVzb3VyY2VUZW1wbGF0ZXNSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLlJlc291cmNlVGVtcGxhdGVbXT4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRSZXF1ZXN0UGFnaW5hdGVkPE1DUC5MaXN0UmVzb3VyY2VUZW1wbGF0ZXNSZXF1ZXN0LCBNQ1AuTGlzdFJlc291cmNlVGVtcGxhdGVzUmVzdWx0LCBNQ1AuUmVzb3VyY2VUZW1wbGF0ZT4oJ3Jlc291cmNlcy90ZW1wbGF0ZXMvbGlzdCcsIHJlc3VsdCA9PiByZXN1bHQucmVzb3VyY2VUZW1wbGF0ZXMsIHBhcmFtcywgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFN1YnNjcmliZSB0byByZXNvdXJjZSB1cGRhdGVzXG5cdCAqL1xuXHRzdWJzY3JpYmUocGFyYW1zOiBNQ1AuU3Vic2NyaWJlUmVxdWVzdFsncGFyYW1zJ10sIHRva2VuPzogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPE1DUC5FbXB0eVJlc3VsdD4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRSZXF1ZXN0PE1DUC5TdWJzY3JpYmVSZXF1ZXN0LCBNQ1AuRW1wdHlSZXN1bHQ+KHsgbWV0aG9kOiAncmVzb3VyY2VzL3N1YnNjcmliZScsIHBhcmFtcyB9LCB0b2tlbik7XG5cdH1cblxuXHQvKipcblx0ICogVW5zdWJzY3JpYmUgZnJvbSByZXNvdXJjZSB1cGRhdGVzXG5cdCAqL1xuXHR1bnN1YnNjcmliZShwYXJhbXM6IE1DUC5VbnN1YnNjcmliZVJlcXVlc3RbJ3BhcmFtcyddLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxNQ1AuRW1wdHlSZXN1bHQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zZW5kUmVxdWVzdDxNQ1AuVW5zdWJzY3JpYmVSZXF1ZXN0LCBNQ1AuRW1wdHlSZXN1bHQ+KHsgbWV0aG9kOiAncmVzb3VyY2VzL3Vuc3Vic2NyaWJlJywgcGFyYW1zIH0sIHRva2VuKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMaXN0IGF2YWlsYWJsZSBwcm9tcHRzXG5cdCAqL1xuXHRsaXN0UHJvbXB0cyhwYXJhbXM/OiBNQ1AuTGlzdFByb21wdHNSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLlByb21wdFtdPiB7XG5cdFx0cmV0dXJuIHRoaXMuc2VuZFJlcXVlc3RQYWdpbmF0ZWQ8TUNQLkxpc3RQcm9tcHRzUmVxdWVzdCwgTUNQLkxpc3RQcm9tcHRzUmVzdWx0LCBNQ1AuUHJvbXB0PigncHJvbXB0cy9saXN0JywgcmVzdWx0ID0+IHJlc3VsdC5wcm9tcHRzLCBwYXJhbXMsIHRva2VuKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBHZXQgYSBzcGVjaWZpYyBwcm9tcHRcblx0ICovXG5cdGdldFByb21wdChwYXJhbXM6IE1DUC5HZXRQcm9tcHRSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLkdldFByb21wdFJlc3VsdD4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRSZXF1ZXN0PE1DUC5HZXRQcm9tcHRSZXF1ZXN0LCBNQ1AuR2V0UHJvbXB0UmVzdWx0Pih7IG1ldGhvZDogJ3Byb21wdHMvZ2V0JywgcGFyYW1zIH0sIHRva2VuKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBMaXN0IGF2YWlsYWJsZSB0b29sc1xuXHQgKi9cblx0bGlzdFRvb2xzKHBhcmFtcz86IE1DUC5MaXN0VG9vbHNSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLlRvb2xbXT4ge1xuXHRcdHJldHVybiB0aGlzLnNlbmRSZXF1ZXN0UGFnaW5hdGVkPE1DUC5MaXN0VG9vbHNSZXF1ZXN0LCBNQ1AuTGlzdFRvb2xzUmVzdWx0LCBNQ1AuVG9vbD4oJ3Rvb2xzL2xpc3QnLCByZXN1bHQgPT4gcmVzdWx0LnRvb2xzLCBwYXJhbXMsIHRva2VuKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBDYWxsIGEgc3BlY2lmaWMgdG9vbFxuXHQgKi9cblx0Y2FsbFRvb2wocGFyYW1zOiBNQ1AuQ2FsbFRvb2xSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLkNhbGxUb29sUmVzdWx0PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2VuZFJlcXVlc3Q8TUNQLkNhbGxUb29sUmVxdWVzdCwgTUNQLkNhbGxUb29sUmVzdWx0Pih7IG1ldGhvZDogJ3Rvb2xzL2NhbGwnLCBwYXJhbXMgfSwgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIFNldCB0aGUgbG9nZ2luZyBsZXZlbFxuXHQgKi9cblx0c2V0TGV2ZWwocGFyYW1zOiBNQ1AuU2V0TGV2ZWxSZXF1ZXN0WydwYXJhbXMnXSwgdG9rZW4/OiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8TUNQLkVtcHR5UmVzdWx0PiB7XG5cdFx0cmV0dXJuIHRoaXMuc2VuZFJlcXVlc3Q8TUNQLlNldExldmVsUmVxdWVzdCwgTUNQLkVtcHR5UmVzdWx0Pih7IG1ldGhvZDogJ2xvZ2dpbmcvc2V0TGV2ZWwnLCBwYXJhbXMgfSwgdG9rZW4pO1xuXHR9XG5cblx0LyoqXG5cdCAqIEZpbmQgY29tcGxldGlvbnMgZm9yIGFuIGFyZ3VtZW50XG5cdCAqL1xuXHRjb21wbGV0ZShwYXJhbXM6IE1DUC5Db21wbGV0ZVJlcXVlc3RbJ3BhcmFtcyddLCB0b2tlbj86IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxNQ1AuQ29tcGxldGVSZXN1bHQ+IHtcblx0XHRyZXR1cm4gdGhpcy5zZW5kUmVxdWVzdDxNQ1AuQ29tcGxldGVSZXF1ZXN0LCBNQ1AuQ29tcGxldGVSZXN1bHQ+KHsgbWV0aG9kOiAnY29tcGxldGlvbi9jb21wbGV0ZScsIHBhcmFtcyB9LCB0b2tlbik7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICJBQUtBLFNBQVMsY0FBYztBQUN2QixTQUFTLGlCQUFpQixxQkFBcUI7QUFDL0MsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsWUFBWSx1QkFBdUI7QUFDNUMsU0FBUyxlQUFlO0FBRXhCLFNB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
