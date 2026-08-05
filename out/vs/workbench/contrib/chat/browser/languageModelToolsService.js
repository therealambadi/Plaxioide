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
import { renderStringAsPlaintext } from "../../../../base/browser/markdownRenderer.js";
import { RunOnceScheduler } from "../../../../base/common/async.js";
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { CancellationError, isCancellationError } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable, DisposableStore, dispose, toDisposable } from "../../../../base/common/lifecycle.js";
import { LRUCache } from "../../../../base/common/map.js";
import { Schemas } from "../../../../base/common/network.js";
import { URI } from "../../../../base/common/uri.js";
import { localize } from "../../../../nls.js";
import { IAccessibilityService } from "../../../../platform/accessibility/common/accessibility.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import * as JSONContributionRegistry from "../../../../platform/jsonschemas/common/jsonContributionRegistry.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Registry } from "../../../../platform/registry/common/platform.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { ChatContextKeys } from "../common/chatContextKeys.js";
import { ChatToolInvocation } from "../common/chatProgressTypes/chatToolInvocation.js";
import { IChatService } from "../common/chatService.js";
import { ChatConfiguration } from "../common/constants.js";
import { stringifyPromptTsxPart } from "../common/languageModelToolsService.js";
const jsonSchemaRegistry = Registry.as(JSONContributionRegistry.Extensions.JSONContribution);
let LanguageModelToolsService = class extends Disposable {
  constructor(_instantiationService, _extensionService, _contextKeyService, _chatService, _dialogService, _telemetryService, _logService, _configurationService, _accessibilityService) {
    super();
    this._instantiationService = _instantiationService;
    this._extensionService = _extensionService;
    this._contextKeyService = _contextKeyService;
    this._chatService = _chatService;
    this._dialogService = _dialogService;
    this._telemetryService = _telemetryService;
    this._logService = _logService;
    this._configurationService = _configurationService;
    this._accessibilityService = _accessibilityService;
    this._onDidChangeTools = new Emitter();
    this.onDidChangeTools = this._onDidChangeTools.event;
    /** Throttle tools updates because it sends all tools and runs on context key updates */
    this._onDidChangeToolsScheduler = new RunOnceScheduler(() => this._onDidChangeTools.fire(), 750);
    this._tools = /* @__PURE__ */ new Map();
    this._toolContextKeys = /* @__PURE__ */ new Set();
    this._callsByRequestId = /* @__PURE__ */ new Map();
    this._memoryToolConfirmStore = /* @__PURE__ */ new Set();
    this._workspaceToolConfirmStore = new Lazy(() => this._register(this._instantiationService.createInstance(ToolConfirmStore, StorageScope.WORKSPACE)));
    this._profileToolConfirmStore = new Lazy(() => this._register(this._instantiationService.createInstance(ToolConfirmStore, StorageScope.PROFILE)));
    this._register(this._contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this._toolContextKeys)) {
        this._onDidChangeToolsScheduler.schedule();
      }
    }));
    this._register(this._configurationService.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration(ChatConfiguration.ExtensionToolsEnabled)) {
        this._onDidChangeToolsScheduler.schedule();
      }
    }));
    this._ctxToolsCount = ChatContextKeys.Tools.toolsCount.bindTo(_contextKeyService);
  }
  registerToolData(toolData) {
    if (this._tools.has(toolData.id)) {
      throw new Error(`Tool "${toolData.id}" is already registered.`);
    }
    this._tools.set(toolData.id, { data: toolData });
    this._ctxToolsCount.set(this._tools.size);
    this._onDidChangeToolsScheduler.schedule();
    toolData.when?.keys().forEach((key) => this._toolContextKeys.add(key));
    let store;
    if (toolData.inputSchema) {
      store = new DisposableStore();
      const schemaUrl = URI.from({ scheme: Schemas.vscode, authority: "schemas", path: `/lm/tool/${toolData.id}` }).toString();
      jsonSchemaRegistry.registerSchema(schemaUrl, toolData.inputSchema, store);
      store.add(jsonSchemaRegistry.registerSchemaAssociation(schemaUrl, `/lm/tool/${toolData.id}/tool_input.json`));
    }
    return toDisposable(() => {
      store?.dispose();
      this._tools.delete(toolData.id);
      this._ctxToolsCount.set(this._tools.size);
      this._refreshAllToolContextKeys();
      this._onDidChangeToolsScheduler.schedule();
    });
  }
  _refreshAllToolContextKeys() {
    this._toolContextKeys.clear();
    for (const tool of this._tools.values()) {
      tool.data.when?.keys().forEach((key) => this._toolContextKeys.add(key));
    }
  }
  registerToolImplementation(id, tool) {
    const entry = this._tools.get(id);
    if (!entry) {
      throw new Error(`Tool "${id}" was not contributed.`);
    }
    if (entry.impl) {
      throw new Error(`Tool "${id}" already has an implementation.`);
    }
    entry.impl = tool;
    return toDisposable(() => {
      entry.impl = void 0;
    });
  }
  getTools() {
    const toolDatas = Iterable.map(this._tools.values(), (i) => i.data);
    const extensionToolsEnabled = this._configurationService.getValue(ChatConfiguration.ExtensionToolsEnabled);
    return Iterable.filter(
      toolDatas,
      (toolData) => {
        const satisfiesWhenClause = !toolData.when || this._contextKeyService.contextMatchesRules(toolData.when);
        const satisfiesExternalToolCheck = toolData.source.type === "extension" && !extensionToolsEnabled ? !toolData.source.isExternalTool : true;
        return satisfiesWhenClause && satisfiesExternalToolCheck;
      }
    );
  }
  getTool(id) {
    return this._getToolEntry(id)?.data;
  }
  _getToolEntry(id) {
    const entry = this._tools.get(id);
    if (entry && (!entry.data.when || this._contextKeyService.contextMatchesRules(entry.data.when))) {
      return entry;
    } else {
      return void 0;
    }
  }
  getToolByName(name) {
    for (const toolData of this.getTools()) {
      if (toolData.toolReferenceName === name) {
        return toolData;
      }
    }
    return void 0;
  }
  setToolAutoConfirmation(toolId, scope, autoConfirm = true) {
    if (scope === "workspace") {
      this._workspaceToolConfirmStore.value.setAutoConfirm(toolId, autoConfirm);
    } else if (scope === "profile") {
      this._profileToolConfirmStore.value.setAutoConfirm(toolId, autoConfirm);
    } else {
      this._memoryToolConfirmStore.add(toolId);
    }
  }
  resetToolAutoConfirmation() {
    this._workspaceToolConfirmStore.value.reset();
    this._profileToolConfirmStore.value.reset();
    this._memoryToolConfirmStore.clear();
  }
  async invokeTool(dto, countTokens, token) {
    this._logService.trace(`[LanguageModelToolsService#invokeTool] Invoking tool ${dto.toolId} with parameters ${JSON.stringify(dto.parameters)}`);
    let tool = this._tools.get(dto.toolId);
    if (!tool) {
      throw new Error(`Tool ${dto.toolId} was not contributed`);
    }
    if (!tool.impl) {
      await this._extensionService.activateByEvent(`onLanguageModelTool:${dto.toolId}`);
      tool = this._tools.get(dto.toolId);
      if (!tool?.impl) {
        throw new Error(`Tool ${dto.toolId} does not have an implementation registered.`);
      }
    }
    let toolInvocation;
    let requestId;
    let store;
    let toolResult;
    try {
      if (dto.context) {
        store = new DisposableStore();
        const model = this._chatService.getSession(dto.context?.sessionId);
        if (!model) {
          throw new Error(`Tool called for unknown chat session`);
        }
        const request = model.getRequests().at(-1);
        requestId = request.id;
        dto.modelId = request.modelId;
        if (!this._callsByRequestId.has(requestId)) {
          this._callsByRequestId.set(requestId, []);
        }
        this._callsByRequestId.get(requestId).push(store);
        const source = new CancellationTokenSource();
        store.add(toDisposable(() => {
          source.dispose(true);
        }));
        store.add(token.onCancellationRequested(() => {
          toolInvocation?.confirmed.complete(false);
          source.cancel();
        }));
        store.add(source.token.onCancellationRequested(() => {
          toolInvocation?.confirmed.complete(false);
        }));
        token = source.token;
        const prepared = await this.prepareToolInvocation(tool, dto, token);
        toolInvocation = new ChatToolInvocation(prepared, tool.data, dto.callId);
        if (this.shouldAutoConfirm(tool.data.id, tool.data.runsInWorkspace)) {
          toolInvocation.confirmed.complete(true);
        }
        model.acceptResponseProgress(request, toolInvocation);
        if (prepared?.confirmationMessages) {
          this._accessibilityService.alert(localize("toolConfirmationMessage", "Action required: {0}", prepared.confirmationMessages.title));
          const userConfirmed = await toolInvocation.confirmed.p;
          if (!userConfirmed) {
            throw new CancellationError();
          }
          dto.toolSpecificData = toolInvocation?.toolSpecificData;
          if (dto.toolSpecificData?.kind === "input") {
            dto.parameters = dto.toolSpecificData.rawInput;
            dto.toolSpecificData = void 0;
          }
        }
      } else {
        const prepared = await this.prepareToolInvocation(tool, dto, token);
        if (prepared?.confirmationMessages) {
          const result = await this._dialogService.confirm({ message: prepared.confirmationMessages.title, detail: renderStringAsPlaintext(prepared.confirmationMessages.message) });
          if (!result.confirmed) {
            throw new CancellationError();
          }
        }
      }
      if (token.isCancellationRequested) {
        throw new CancellationError();
      }
      toolResult = await tool.impl.invoke(dto, countTokens, token);
      this.ensureToolDetails(dto, toolResult, tool.data);
      this._telemetryService.publicLog2(
        "languageModelToolInvoked",
        {
          result: "success",
          chatSessionId: dto.context?.sessionId,
          toolId: tool.data.id,
          toolExtensionId: tool.data.source.type === "extension" ? tool.data.source.extensionId.value : void 0,
          toolSourceKind: tool.data.source.type
        }
      );
      return toolResult;
    } catch (err) {
      const result = isCancellationError(err) ? "userCancelled" : "error";
      this._telemetryService.publicLog2(
        "languageModelToolInvoked",
        {
          result,
          chatSessionId: dto.context?.sessionId,
          toolId: tool.data.id,
          toolExtensionId: tool.data.source.type === "extension" ? tool.data.source.extensionId.value : void 0,
          toolSourceKind: tool.data.source.type
        }
      );
      this._logService.error(`[LanguageModelToolsService#invokeTool] Error from tool ${dto.toolId}: ${toErrorMessage(err)}. With parameters ${JSON.stringify(dto.parameters)}`);
      throw err;
    } finally {
      toolInvocation?.complete(toolResult);
      if (requestId && store) {
        this.cleanupCallDisposables(requestId, store);
      }
    }
  }
  async prepareToolInvocation(tool, dto, token) {
    let prepared = tool.impl.prepareToolInvocation ? await tool.impl.prepareToolInvocation(dto.parameters, token) : void 0;
    if (!prepared?.confirmationMessages && tool.data.requiresConfirmation && tool.data.source.type === "extension") {
      if (!prepared) {
        prepared = {};
      }
      const toolWarning = localize(
        "tool.warning",
        "{0} This tool is from the extension `{1}`. Please carefully review any requested actions.",
        "$(info)",
        tool.data.source.extensionId.value
      );
      prepared.confirmationMessages = {
        title: localize("msg.title", "Run {0}", `"${tool.data.displayName}"`),
        message: new MarkdownString((tool.data.userDescription ?? tool.data.modelDescription) + "\n\n" + toolWarning, { supportThemeIcons: true }),
        allowAutoConfirm: true
      };
    }
    if (prepared?.confirmationMessages) {
      if (prepared.toolSpecificData?.kind !== "terminal" && typeof prepared.confirmationMessages.allowAutoConfirm !== "boolean") {
        prepared.confirmationMessages.allowAutoConfirm = true;
      }
      if (!prepared.toolSpecificData && tool.data.alwaysDisplayInputOutput) {
        prepared.toolSpecificData = {
          kind: "input",
          rawInput: dto.parameters
        };
      }
    }
    return prepared;
  }
  ensureToolDetails(dto, toolResult, toolData) {
    if (!toolResult.toolResultDetails && toolData.alwaysDisplayInputOutput) {
      toolResult.toolResultDetails = {
        input: JSON.stringify(dto.parameters, void 0, 2),
        output: this.toolResultToString(toolResult)
      };
    }
  }
  toolResultToString(toolResult) {
    const strs = [];
    for (const part of toolResult.content) {
      if (part.kind === "text") {
        strs.push(part.value);
      } else if (part.kind === "promptTsx") {
        strs.push(stringifyPromptTsxPart(part));
      }
    }
    return strs.join("");
  }
  shouldAutoConfirm(toolId, runsInWorkspace) {
    if (this._workspaceToolConfirmStore.value.getAutoConfirm(toolId) || this._profileToolConfirmStore.value.getAutoConfirm(toolId) || this._memoryToolConfirmStore.has(toolId)) {
      return true;
    }
    const config = this._configurationService.inspect("chat.tools.autoApprove");
    let value = config.value ?? config.defaultValue;
    if (typeof runsInWorkspace === "boolean") {
      value = config.userLocalValue ?? config.applicationValue;
      if (runsInWorkspace) {
        value = config.workspaceValue ?? config.workspaceFolderValue ?? config.userRemoteValue ?? value;
      }
    }
    return value === true || typeof value === "object" && value.hasOwnProperty(toolId) && value[toolId] === true;
  }
  cleanupCallDisposables(requestId, store) {
    const disposables = this._callsByRequestId.get(requestId);
    if (disposables) {
      const index = disposables.indexOf(store);
      if (index > -1) {
        disposables.splice(index, 1);
      }
      if (disposables.length === 0) {
        this._callsByRequestId.delete(requestId);
      }
    }
    store.dispose();
  }
  cancelToolCallsForRequest(requestId) {
    const calls = this._callsByRequestId.get(requestId);
    if (calls) {
      calls.forEach((call) => call.dispose());
      this._callsByRequestId.delete(requestId);
    }
  }
  dispose() {
    super.dispose();
    this._callsByRequestId.forEach((calls) => dispose(calls));
    this._ctxToolsCount.reset();
  }
};
LanguageModelToolsService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IExtensionService),
  __decorateParam(2, IContextKeyService),
  __decorateParam(3, IChatService),
  __decorateParam(4, IDialogService),
  __decorateParam(5, ITelemetryService),
  __decorateParam(6, ILogService),
  __decorateParam(7, IConfigurationService),
  __decorateParam(8, IAccessibilityService)
], LanguageModelToolsService);
let ToolConfirmStore = class extends Disposable {
  constructor(_scope, storageService) {
    super();
    this._scope = _scope;
    this.storageService = storageService;
    this._autoConfirmTools = new LRUCache(100);
    this._didChange = false;
    const stored = storageService.getObject(ToolConfirmStore.STORED_KEY, this._scope);
    if (stored) {
      for (const key of stored) {
        this._autoConfirmTools.set(key, true);
      }
    }
    this._register(storageService.onWillSaveState(() => {
      if (this._didChange) {
        this.storageService.store(ToolConfirmStore.STORED_KEY, [...this._autoConfirmTools.keys()], this._scope, StorageTarget.MACHINE);
        this._didChange = false;
      }
    }));
  }
  reset() {
    this._autoConfirmTools.clear();
    this._didChange = true;
  }
  getAutoConfirm(toolId) {
    if (this._autoConfirmTools.get(toolId)) {
      this._didChange = true;
      return true;
    }
    return false;
  }
  setAutoConfirm(toolId, autoConfirm) {
    if (autoConfirm) {
      this._autoConfirmTools.set(toolId, true);
    } else {
      this._autoConfirmTools.delete(toolId);
    }
    this._didChange = true;
  }
};
ToolConfirmStore.STORED_KEY = "chat/autoconfirm";
ToolConfirmStore = __decorateClass([
  __decorateParam(1, IStorageService)
], ToolConfirmStore);
export {
  LanguageModelToolsService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2Jyb3dzZXIvbGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZS50cyJdLAogICJzb3VyY2VzQ29udGVudCI6IFsiLyotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgKGMpIE1pY3Jvc29mdCBDb3Jwb3JhdGlvbi4gQWxsIHJpZ2h0cyByZXNlcnZlZC5cbiAqICBMaWNlbnNlZCB1bmRlciB0aGUgTUlUIExpY2Vuc2UuIFNlZSBMaWNlbnNlLnR4dCBpbiB0aGUgcHJvamVjdCByb290IGZvciBsaWNlbnNlIGluZm9ybWF0aW9uLlxuICotLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLSovXG5cbmltcG9ydCB7IHJlbmRlclN0cmluZ0FzUGxhaW50ZXh0IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9icm93c2VyL21hcmtkb3duUmVuZGVyZXIuanMnO1xuaW1wb3J0IHsgUnVuT25jZVNjaGVkdWxlciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENhbmNlbGxhdGlvblRva2VuLCBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyB0b0Vycm9yTWVzc2FnZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9yTWVzc2FnZS5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25FcnJvciwgaXNDYW5jZWxsYXRpb25FcnJvciB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IExhenkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9sYXp5LmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVTdG9yZSwgZGlzcG9zZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBMUlVDYWNoZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcC5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUFjY2Vzc2liaWxpdHlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vYWNjZXNzaWJpbGl0eS9jb21tb24vYWNjZXNzaWJpbGl0eS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgeyBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCAqIGFzIEpTT05Db250cmlidXRpb25SZWdpc3RyeSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9qc29uc2NoZW1hcy9jb21tb24vanNvbkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgUmVnaXN0cnkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZWdpc3RyeS9jb21tb24vcGxhdGZvcm0uanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4uL2NvbW1vbi9jaGF0Q29udGV4dEtleXMuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGVsIH0gZnJvbSAnLi4vY29tbW9uL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0VG9vbEludm9jYXRpb24gfSBmcm9tICcuLi9jb21tb24vY2hhdFByb2dyZXNzVHlwZXMvY2hhdFRvb2xJbnZvY2F0aW9uLmpzJztcbmltcG9ydCB7IElDaGF0U2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0Q29uZmlndXJhdGlvbiB9IGZyb20gJy4uL2NvbW1vbi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ291bnRUb2tlbnNDYWxsYmFjaywgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UsIElQcmVwYXJlZFRvb2xJbnZvY2F0aW9uLCBJVG9vbERhdGEsIElUb29sSW1wbCwgSVRvb2xJbnZvY2F0aW9uLCBJVG9vbFJlc3VsdCwgc3RyaW5naWZ5UHJvbXB0VHN4UGFydCB9IGZyb20gJy4uL2NvbW1vbi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcblxuY29uc3QganNvblNjaGVtYVJlZ2lzdHJ5ID0gUmVnaXN0cnkuYXM8SlNPTkNvbnRyaWJ1dGlvblJlZ2lzdHJ5LklKU09OQ29udHJpYnV0aW9uUmVnaXN0cnk+KEpTT05Db250cmlidXRpb25SZWdpc3RyeS5FeHRlbnNpb25zLkpTT05Db250cmlidXRpb24pO1xuXG5pbnRlcmZhY2UgSVRvb2xFbnRyeSB7XG5cdGRhdGE6IElUb29sRGF0YTtcblx0aW1wbD86IElUb29sSW1wbDtcbn1cblxuZXhwb3J0IGNsYXNzIExhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VUb29scyA9IG5ldyBFbWl0dGVyPHZvaWQ+KCk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlVG9vbHMgPSB0aGlzLl9vbkRpZENoYW5nZVRvb2xzLmV2ZW50O1xuXG5cdC8qKiBUaHJvdHRsZSB0b29scyB1cGRhdGVzIGJlY2F1c2UgaXQgc2VuZHMgYWxsIHRvb2xzIGFuZCBydW5zIG9uIGNvbnRleHQga2V5IHVwZGF0ZXMgKi9cblx0cHJpdmF0ZSBfb25EaWRDaGFuZ2VUb29sc1NjaGVkdWxlciA9IG5ldyBSdW5PbmNlU2NoZWR1bGVyKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlVG9vbHMuZmlyZSgpLCA3NTApO1xuXG5cdHByaXZhdGUgX3Rvb2xzID0gbmV3IE1hcDxzdHJpbmcsIElUb29sRW50cnk+KCk7XG5cdHByaXZhdGUgX3Rvb2xDb250ZXh0S2V5cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jdHhUb29sc0NvdW50OiBJQ29udGV4dEtleTxudW1iZXI+O1xuXG5cdHByaXZhdGUgX2NhbGxzQnlSZXF1ZXN0SWQgPSBuZXcgTWFwPHN0cmluZywgSURpc3Bvc2FibGVbXT4oKTtcblxuXHRwcml2YXRlIF93b3Jrc3BhY2VUb29sQ29uZmlybVN0b3JlOiBMYXp5PFRvb2xDb25maXJtU3RvcmU+O1xuXHRwcml2YXRlIF9wcm9maWxlVG9vbENvbmZpcm1TdG9yZTogTGF6eTxUb29sQ29uZmlybVN0b3JlPjtcblx0cHJpdmF0ZSBfbWVtb3J5VG9vbENvbmZpcm1TdG9yZSA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfaW5zdGFudGlhdGlvblNlcnZpY2U6IElJbnN0YW50aWF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZXh0ZW5zaW9uU2VydmljZTogSUV4dGVuc2lvblNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3RlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElBY2Nlc3NpYmlsaXR5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9hY2Nlc3NpYmlsaXR5U2VydmljZTogSUFjY2Vzc2liaWxpdHlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLl93b3Jrc3BhY2VUb29sQ29uZmlybVN0b3JlID0gbmV3IExhenkoKCkgPT4gdGhpcy5fcmVnaXN0ZXIodGhpcy5faW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoVG9vbENvbmZpcm1TdG9yZSwgU3RvcmFnZVNjb3BlLldPUktTUEFDRSkpKTtcblx0XHR0aGlzLl9wcm9maWxlVG9vbENvbmZpcm1TdG9yZSA9IG5ldyBMYXp5KCgpID0+IHRoaXMuX3JlZ2lzdGVyKHRoaXMuX2luc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKFRvb2xDb25maXJtU3RvcmUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0KGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c1NvbWUodGhpcy5fdG9vbENvbnRleHRLZXlzKSkge1xuXHRcdFx0XHQvLyBOb3Qgd29ydGggaXQgdG8gY29tcHV0ZSBhIGRlbHRhIGhlcmUgdW5sZXNzIHdlIGhhdmUgbWFueSB0b29scyBjaGFuZ2luZyBvZnRlblxuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVRvb2xzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VDb25maWd1cmF0aW9uKGUgPT4ge1xuXHRcdFx0aWYgKGUuYWZmZWN0c0NvbmZpZ3VyYXRpb24oQ2hhdENvbmZpZ3VyYXRpb24uRXh0ZW5zaW9uVG9vbHNFbmFibGVkKSkge1xuXHRcdFx0XHR0aGlzLl9vbkRpZENoYW5nZVRvb2xzU2NoZWR1bGVyLnNjaGVkdWxlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fY3R4VG9vbHNDb3VudCA9IENoYXRDb250ZXh0S2V5cy5Ub29scy50b29sc0NvdW50LmJpbmRUbyhfY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0cmVnaXN0ZXJUb29sRGF0YSh0b29sRGF0YTogSVRvb2xEYXRhKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLl90b29scy5oYXModG9vbERhdGEuaWQpKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFRvb2wgXCIke3Rvb2xEYXRhLmlkfVwiIGlzIGFscmVhZHkgcmVnaXN0ZXJlZC5gKTtcblx0XHR9XG5cblx0XHR0aGlzLl90b29scy5zZXQodG9vbERhdGEuaWQsIHsgZGF0YTogdG9vbERhdGEgfSk7XG5cdFx0dGhpcy5fY3R4VG9vbHNDb3VudC5zZXQodGhpcy5fdG9vbHMuc2l6ZSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VUb29sc1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXG5cdFx0dG9vbERhdGEud2hlbj8ua2V5cygpLmZvckVhY2goa2V5ID0+IHRoaXMuX3Rvb2xDb250ZXh0S2V5cy5hZGQoa2V5KSk7XG5cblx0XHRsZXQgc3RvcmU6IERpc3Bvc2FibGVTdG9yZSB8IHVuZGVmaW5lZDtcblx0XHRpZiAodG9vbERhdGEuaW5wdXRTY2hlbWEpIHtcblx0XHRcdHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0Y29uc3Qgc2NoZW1hVXJsID0gVVJJLmZyb20oeyBzY2hlbWU6IFNjaGVtYXMudnNjb2RlLCBhdXRob3JpdHk6ICdzY2hlbWFzJywgcGF0aDogYC9sbS90b29sLyR7dG9vbERhdGEuaWR9YCB9KS50b1N0cmluZygpO1xuXHRcdFx0anNvblNjaGVtYVJlZ2lzdHJ5LnJlZ2lzdGVyU2NoZW1hKHNjaGVtYVVybCwgdG9vbERhdGEuaW5wdXRTY2hlbWEsIHN0b3JlKTtcblx0XHRcdHN0b3JlLmFkZChqc29uU2NoZW1hUmVnaXN0cnkucmVnaXN0ZXJTY2hlbWFBc3NvY2lhdGlvbihzY2hlbWFVcmwsIGAvbG0vdG9vbC8ke3Rvb2xEYXRhLmlkfS90b29sX2lucHV0Lmpzb25gKSk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRzdG9yZT8uZGlzcG9zZSgpO1xuXHRcdFx0dGhpcy5fdG9vbHMuZGVsZXRlKHRvb2xEYXRhLmlkKTtcblx0XHRcdHRoaXMuX2N0eFRvb2xzQ291bnQuc2V0KHRoaXMuX3Rvb2xzLnNpemUpO1xuXHRcdFx0dGhpcy5fcmVmcmVzaEFsbFRvb2xDb250ZXh0S2V5cygpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VUb29sc1NjaGVkdWxlci5zY2hlZHVsZSgpO1xuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVmcmVzaEFsbFRvb2xDb250ZXh0S2V5cygpIHtcblx0XHR0aGlzLl90b29sQ29udGV4dEtleXMuY2xlYXIoKTtcblx0XHRmb3IgKGNvbnN0IHRvb2wgb2YgdGhpcy5fdG9vbHMudmFsdWVzKCkpIHtcblx0XHRcdHRvb2wuZGF0YS53aGVuPy5rZXlzKCkuZm9yRWFjaChrZXkgPT4gdGhpcy5fdG9vbENvbnRleHRLZXlzLmFkZChrZXkpKTtcblx0XHR9XG5cdH1cblxuXHRyZWdpc3RlclRvb2xJbXBsZW1lbnRhdGlvbihpZDogc3RyaW5nLCB0b29sOiBJVG9vbEltcGwpOiBJRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgZW50cnkgPSB0aGlzLl90b29scy5nZXQoaWQpO1xuXHRcdGlmICghZW50cnkpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVG9vbCBcIiR7aWR9XCIgd2FzIG5vdCBjb250cmlidXRlZC5gKTtcblx0XHR9XG5cblx0XHRpZiAoZW50cnkuaW1wbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUb29sIFwiJHtpZH1cIiBhbHJlYWR5IGhhcyBhbiBpbXBsZW1lbnRhdGlvbi5gKTtcblx0XHR9XG5cblx0XHRlbnRyeS5pbXBsID0gdG9vbDtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdGVudHJ5LmltcGwgPSB1bmRlZmluZWQ7XG5cdFx0fSk7XG5cdH1cblxuXHRnZXRUb29scygpOiBJdGVyYWJsZTxSZWFkb25seTxJVG9vbERhdGE+PiB7XG5cdFx0Y29uc3QgdG9vbERhdGFzID0gSXRlcmFibGUubWFwKHRoaXMuX3Rvb2xzLnZhbHVlcygpLCBpID0+IGkuZGF0YSk7XG5cdFx0Y29uc3QgZXh0ZW5zaW9uVG9vbHNFbmFibGVkID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQ2hhdENvbmZpZ3VyYXRpb24uRXh0ZW5zaW9uVG9vbHNFbmFibGVkKTtcblx0XHRyZXR1cm4gSXRlcmFibGUuZmlsdGVyKFxuXHRcdFx0dG9vbERhdGFzLFxuXHRcdFx0dG9vbERhdGEgPT4ge1xuXHRcdFx0XHRjb25zdCBzYXRpc2ZpZXNXaGVuQ2xhdXNlID0gIXRvb2xEYXRhLndoZW4gfHwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyh0b29sRGF0YS53aGVuKTtcblx0XHRcdFx0Y29uc3Qgc2F0aXNmaWVzRXh0ZXJuYWxUb29sQ2hlY2sgPSB0b29sRGF0YS5zb3VyY2UudHlwZSA9PT0gJ2V4dGVuc2lvbicgJiYgIWV4dGVuc2lvblRvb2xzRW5hYmxlZCA/XG5cdFx0XHRcdFx0IXRvb2xEYXRhLnNvdXJjZS5pc0V4dGVybmFsVG9vbCA6XG5cdFx0XHRcdFx0dHJ1ZTtcblx0XHRcdFx0cmV0dXJuIHNhdGlzZmllc1doZW5DbGF1c2UgJiYgc2F0aXNmaWVzRXh0ZXJuYWxUb29sQ2hlY2s7XG5cdFx0XHR9KTtcblx0fVxuXG5cdGdldFRvb2woaWQ6IHN0cmluZyk6IElUb29sRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2dldFRvb2xFbnRyeShpZCk/LmRhdGE7XG5cdH1cblxuXHRwcml2YXRlIF9nZXRUb29sRW50cnkoaWQ6IHN0cmluZyk6IElUb29sRW50cnkgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fdG9vbHMuZ2V0KGlkKTtcblx0XHRpZiAoZW50cnkgJiYgKCFlbnRyeS5kYXRhLndoZW4gfHwgdGhpcy5fY29udGV4dEtleVNlcnZpY2UuY29udGV4dE1hdGNoZXNSdWxlcyhlbnRyeS5kYXRhLndoZW4pKSkge1xuXHRcdFx0cmV0dXJuIGVudHJ5O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdGdldFRvb2xCeU5hbWUobmFtZTogc3RyaW5nKTogSVRvb2xEYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRmb3IgKGNvbnN0IHRvb2xEYXRhIG9mIHRoaXMuZ2V0VG9vbHMoKSkge1xuXHRcdFx0aWYgKHRvb2xEYXRhLnRvb2xSZWZlcmVuY2VOYW1lID09PSBuYW1lKSB7XG5cdFx0XHRcdHJldHVybiB0b29sRGF0YTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldFRvb2xBdXRvQ29uZmlybWF0aW9uKHRvb2xJZDogc3RyaW5nLCBzY29wZTogJ3dvcmtzcGFjZScgfCAncHJvZmlsZScgfCAnbWVtb3J5JywgYXV0b0NvbmZpcm0gPSB0cnVlKTogdm9pZCB7XG5cdFx0aWYgKHNjb3BlID09PSAnd29ya3NwYWNlJykge1xuXHRcdFx0dGhpcy5fd29ya3NwYWNlVG9vbENvbmZpcm1TdG9yZS52YWx1ZS5zZXRBdXRvQ29uZmlybSh0b29sSWQsIGF1dG9Db25maXJtKTtcblx0XHR9IGVsc2UgaWYgKHNjb3BlID09PSAncHJvZmlsZScpIHtcblx0XHRcdHRoaXMuX3Byb2ZpbGVUb29sQ29uZmlybVN0b3JlLnZhbHVlLnNldEF1dG9Db25maXJtKHRvb2xJZCwgYXV0b0NvbmZpcm0pO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9tZW1vcnlUb29sQ29uZmlybVN0b3JlLmFkZCh0b29sSWQpO1xuXHRcdH1cblx0fVxuXG5cdHJlc2V0VG9vbEF1dG9Db25maXJtYXRpb24oKTogdm9pZCB7XG5cdFx0dGhpcy5fd29ya3NwYWNlVG9vbENvbmZpcm1TdG9yZS52YWx1ZS5yZXNldCgpO1xuXHRcdHRoaXMuX3Byb2ZpbGVUb29sQ29uZmlybVN0b3JlLnZhbHVlLnJlc2V0KCk7XG5cdFx0dGhpcy5fbWVtb3J5VG9vbENvbmZpcm1TdG9yZS5jbGVhcigpO1xuXHR9XG5cblx0YXN5bmMgaW52b2tlVG9vbChkdG86IElUb29sSW52b2NhdGlvbiwgY291bnRUb2tlbnM6IENvdW50VG9rZW5zQ2FsbGJhY2ssIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVRvb2xSZXN1bHQ+IHtcblx0XHR0aGlzLl9sb2dTZXJ2aWNlLnRyYWNlKGBbTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSNpbnZva2VUb29sXSBJbnZva2luZyB0b29sICR7ZHRvLnRvb2xJZH0gd2l0aCBwYXJhbWV0ZXJzICR7SlNPTi5zdHJpbmdpZnkoZHRvLnBhcmFtZXRlcnMpfWApO1xuXG5cdFx0Ly8gV2hlbiBpbnZva2luZyBhIHRvb2wsIGRvbid0IHZhbGlkYXRlIHRoZSBcIndoZW5cIiBjbGF1c2UuIEFuIGV4dGVuc2lvbiBtYXkgaGF2ZSBpbnZva2VkIGEgdG9vbCBqdXN0IGFzIGl0IHdhcyBiZWNvbWluZyBkaXNhYmxlZCwgYW5kIGp1c3QgbGV0IGl0IGdvIHRocm91Z2ggcmF0aGVyIHRoYW4gdGhyb3cgYW5kIGJyZWFrIHRoZSBjaGF0LlxuXHRcdGxldCB0b29sID0gdGhpcy5fdG9vbHMuZ2V0KGR0by50b29sSWQpO1xuXHRcdGlmICghdG9vbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUb29sICR7ZHRvLnRvb2xJZH0gd2FzIG5vdCBjb250cmlidXRlZGApO1xuXHRcdH1cblxuXHRcdGlmICghdG9vbC5pbXBsKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudChgb25MYW5ndWFnZU1vZGVsVG9vbDoke2R0by50b29sSWR9YCk7XG5cblx0XHRcdC8vIEV4dGVuc2lvbiBzaG91bGQgYWN0aXZhdGUgYW5kIHJlZ2lzdGVyIHRoZSB0b29sIGltcGxlbWVudGF0aW9uXG5cdFx0XHR0b29sID0gdGhpcy5fdG9vbHMuZ2V0KGR0by50b29sSWQpO1xuXHRcdFx0aWYgKCF0b29sPy5pbXBsKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVG9vbCAke2R0by50b29sSWR9IGRvZXMgbm90IGhhdmUgYW4gaW1wbGVtZW50YXRpb24gcmVnaXN0ZXJlZC5gKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBTaG9ydGN1dCB0byB3cml0ZSB0byB0aGUgbW9kZWwgZGlyZWN0bHkgaGVyZSwgYnV0IGNvdWxkIGNhbGwgYWxsIHRoZSB3YXkgYmFjayB0byB1c2UgdGhlIHJlYWwgc3RyZWFtLlxuXHRcdGxldCB0b29sSW52b2NhdGlvbjogQ2hhdFRvb2xJbnZvY2F0aW9uIHwgdW5kZWZpbmVkO1xuXG5cdFx0bGV0IHJlcXVlc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRcdGxldCBzdG9yZTogRGlzcG9zYWJsZVN0b3JlIHwgdW5kZWZpbmVkO1xuXHRcdGxldCB0b29sUmVzdWx0OiBJVG9vbFJlc3VsdCB8IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0aWYgKGR0by5jb250ZXh0KSB7XG5cdFx0XHRcdHN0b3JlID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX2NoYXRTZXJ2aWNlLmdldFNlc3Npb24oZHRvLmNvbnRleHQ/LnNlc3Npb25JZCkgYXMgQ2hhdE1vZGVsIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRcdFx0dGhyb3cgbmV3IEVycm9yKGBUb29sIGNhbGxlZCBmb3IgdW5rbm93biBjaGF0IHNlc3Npb25gKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSBtb2RlbC5nZXRSZXF1ZXN0cygpLmF0KC0xKSE7XG5cdFx0XHRcdHJlcXVlc3RJZCA9IHJlcXVlc3QuaWQ7XG5cdFx0XHRcdGR0by5tb2RlbElkID0gcmVxdWVzdC5tb2RlbElkO1xuXG5cdFx0XHRcdC8vIFJlcGxhY2UgdGhlIHRva2VuIHdpdGggYSBuZXcgdG9rZW4gdGhhdCB3ZSBjYW4gY2FuY2VsIHdoZW4gY2FuY2VsVG9vbENhbGxzRm9yUmVxdWVzdCBpcyBjYWxsZWRcblx0XHRcdFx0aWYgKCF0aGlzLl9jYWxsc0J5UmVxdWVzdElkLmhhcyhyZXF1ZXN0SWQpKSB7XG5cdFx0XHRcdFx0dGhpcy5fY2FsbHNCeVJlcXVlc3RJZC5zZXQocmVxdWVzdElkLCBbXSk7XG5cdFx0XHRcdH1cblx0XHRcdFx0dGhpcy5fY2FsbHNCeVJlcXVlc3RJZC5nZXQocmVxdWVzdElkKSEucHVzaChzdG9yZSk7XG5cblx0XHRcdFx0Y29uc3Qgc291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0XHRcdHN0b3JlLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0XHRcdHNvdXJjZS5kaXNwb3NlKHRydWUpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHN0b3JlLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRcdFx0dG9vbEludm9jYXRpb24/LmNvbmZpcm1lZC5jb21wbGV0ZShmYWxzZSk7XG5cdFx0XHRcdFx0c291cmNlLmNhbmNlbCgpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHN0b3JlLmFkZChzb3VyY2UudG9rZW4ub25DYW5jZWxsYXRpb25SZXF1ZXN0ZWQoKCkgPT4ge1xuXHRcdFx0XHRcdHRvb2xJbnZvY2F0aW9uPy5jb25maXJtZWQuY29tcGxldGUoZmFsc2UpO1xuXHRcdFx0XHR9KSk7XG5cdFx0XHRcdHRva2VuID0gc291cmNlLnRva2VuO1xuXG5cdFx0XHRcdGNvbnN0IHByZXBhcmVkID0gYXdhaXQgdGhpcy5wcmVwYXJlVG9vbEludm9jYXRpb24odG9vbCwgZHRvLCB0b2tlbik7XG5cdFx0XHRcdHRvb2xJbnZvY2F0aW9uID0gbmV3IENoYXRUb29sSW52b2NhdGlvbihwcmVwYXJlZCwgdG9vbC5kYXRhLCBkdG8uY2FsbElkKTtcblx0XHRcdFx0aWYgKHRoaXMuc2hvdWxkQXV0b0NvbmZpcm0odG9vbC5kYXRhLmlkLCB0b29sLmRhdGEucnVuc0luV29ya3NwYWNlKSkge1xuXHRcdFx0XHRcdHRvb2xJbnZvY2F0aW9uLmNvbmZpcm1lZC5jb21wbGV0ZSh0cnVlKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwgdG9vbEludm9jYXRpb24pO1xuXHRcdFx0XHRpZiAocHJlcGFyZWQ/LmNvbmZpcm1hdGlvbk1lc3NhZ2VzKSB7XG5cdFx0XHRcdFx0dGhpcy5fYWNjZXNzaWJpbGl0eVNlcnZpY2UuYWxlcnQobG9jYWxpemUoJ3Rvb2xDb25maXJtYXRpb25NZXNzYWdlJywgXCJBY3Rpb24gcmVxdWlyZWQ6IHswfVwiLCBwcmVwYXJlZC5jb25maXJtYXRpb25NZXNzYWdlcy50aXRsZSkpO1xuXHRcdFx0XHRcdGNvbnN0IHVzZXJDb25maXJtZWQgPSBhd2FpdCB0b29sSW52b2NhdGlvbi5jb25maXJtZWQucDtcblx0XHRcdFx0XHRpZiAoIXVzZXJDb25maXJtZWQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGR0by50b29sU3BlY2lmaWNEYXRhID0gdG9vbEludm9jYXRpb24/LnRvb2xTcGVjaWZpY0RhdGE7XG5cblx0XHRcdFx0XHRpZiAoZHRvLnRvb2xTcGVjaWZpY0RhdGE/LmtpbmQgPT09ICdpbnB1dCcpIHtcblx0XHRcdFx0XHRcdGR0by5wYXJhbWV0ZXJzID0gZHRvLnRvb2xTcGVjaWZpY0RhdGEucmF3SW5wdXQ7XG5cdFx0XHRcdFx0XHRkdG8udG9vbFNwZWNpZmljRGF0YSA9IHVuZGVmaW5lZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IHByZXBhcmVkID0gYXdhaXQgdGhpcy5wcmVwYXJlVG9vbEludm9jYXRpb24odG9vbCwgZHRvLCB0b2tlbik7XG5cdFx0XHRcdGlmIChwcmVwYXJlZD8uY29uZmlybWF0aW9uTWVzc2FnZXMpIHtcblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSBhd2FpdCB0aGlzLl9kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oeyBtZXNzYWdlOiBwcmVwYXJlZC5jb25maXJtYXRpb25NZXNzYWdlcy50aXRsZSwgZGV0YWlsOiByZW5kZXJTdHJpbmdBc1BsYWludGV4dChwcmVwYXJlZC5jb25maXJtYXRpb25NZXNzYWdlcy5tZXNzYWdlKSB9KTtcblx0XHRcdFx0XHRpZiAoIXJlc3VsdC5jb25maXJtZWQpIHtcblx0XHRcdFx0XHRcdHRocm93IG5ldyBDYW5jZWxsYXRpb25FcnJvcigpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdFx0dGhyb3cgbmV3IENhbmNlbGxhdGlvbkVycm9yKCk7XG5cdFx0XHR9XG5cblx0XHRcdHRvb2xSZXN1bHQgPSBhd2FpdCB0b29sLmltcGwuaW52b2tlKGR0bywgY291bnRUb2tlbnMsIHRva2VuKTtcblx0XHRcdHRoaXMuZW5zdXJlVG9vbERldGFpbHMoZHRvLCB0b29sUmVzdWx0LCB0b29sLmRhdGEpO1xuXG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8TGFuZ3VhZ2VNb2RlbFRvb2xJbnZva2VkRXZlbnQsIExhbmd1YWdlTW9kZWxUb29sSW52b2tlZENsYXNzaWZpY2F0aW9uPihcblx0XHRcdFx0J2xhbmd1YWdlTW9kZWxUb29sSW52b2tlZCcsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRyZXN1bHQ6ICdzdWNjZXNzJyxcblx0XHRcdFx0XHRjaGF0U2Vzc2lvbklkOiBkdG8uY29udGV4dD8uc2Vzc2lvbklkLFxuXHRcdFx0XHRcdHRvb2xJZDogdG9vbC5kYXRhLmlkLFxuXHRcdFx0XHRcdHRvb2xFeHRlbnNpb25JZDogdG9vbC5kYXRhLnNvdXJjZS50eXBlID09PSAnZXh0ZW5zaW9uJyA/IHRvb2wuZGF0YS5zb3VyY2UuZXh0ZW5zaW9uSWQudmFsdWUgOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dG9vbFNvdXJjZUtpbmQ6IHRvb2wuZGF0YS5zb3VyY2UudHlwZSxcblx0XHRcdFx0fSk7XG5cdFx0XHRyZXR1cm4gdG9vbFJlc3VsdDtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdGNvbnN0IHJlc3VsdCA9IGlzQ2FuY2VsbGF0aW9uRXJyb3IoZXJyKSA/ICd1c2VyQ2FuY2VsbGVkJyA6ICdlcnJvcic7XG5cdFx0XHR0aGlzLl90ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8TGFuZ3VhZ2VNb2RlbFRvb2xJbnZva2VkRXZlbnQsIExhbmd1YWdlTW9kZWxUb29sSW52b2tlZENsYXNzaWZpY2F0aW9uPihcblx0XHRcdFx0J2xhbmd1YWdlTW9kZWxUb29sSW52b2tlZCcsXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRyZXN1bHQsXG5cdFx0XHRcdFx0Y2hhdFNlc3Npb25JZDogZHRvLmNvbnRleHQ/LnNlc3Npb25JZCxcblx0XHRcdFx0XHR0b29sSWQ6IHRvb2wuZGF0YS5pZCxcblx0XHRcdFx0XHR0b29sRXh0ZW5zaW9uSWQ6IHRvb2wuZGF0YS5zb3VyY2UudHlwZSA9PT0gJ2V4dGVuc2lvbicgPyB0b29sLmRhdGEuc291cmNlLmV4dGVuc2lvbklkLnZhbHVlIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdHRvb2xTb3VyY2VLaW5kOiB0b29sLmRhdGEuc291cmNlLnR5cGUsXG5cdFx0XHRcdH0pO1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgW0xhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2UjaW52b2tlVG9vbF0gRXJyb3IgZnJvbSB0b29sICR7ZHRvLnRvb2xJZH06ICR7dG9FcnJvck1lc3NhZ2UoZXJyKX0uIFdpdGggcGFyYW1ldGVycyAke0pTT04uc3RyaW5naWZ5KGR0by5wYXJhbWV0ZXJzKX1gKTtcblx0XHRcdHRocm93IGVycjtcblx0XHR9IGZpbmFsbHkge1xuXHRcdFx0dG9vbEludm9jYXRpb24/LmNvbXBsZXRlKHRvb2xSZXN1bHQpO1xuXG5cdFx0XHRpZiAocmVxdWVzdElkICYmIHN0b3JlKSB7XG5cdFx0XHRcdHRoaXMuY2xlYW51cENhbGxEaXNwb3NhYmxlcyhyZXF1ZXN0SWQsIHN0b3JlKTtcblx0XHRcdH1cblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHByZXBhcmVUb29sSW52b2NhdGlvbih0b29sOiBJVG9vbEVudHJ5LCBkdG86IElUb29sSW52b2NhdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJUHJlcGFyZWRUb29sSW52b2NhdGlvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGxldCBwcmVwYXJlZCA9IHRvb2wuaW1wbCEucHJlcGFyZVRvb2xJbnZvY2F0aW9uID9cblx0XHRcdGF3YWl0IHRvb2wuaW1wbCEucHJlcGFyZVRvb2xJbnZvY2F0aW9uKGR0by5wYXJhbWV0ZXJzLCB0b2tlbilcblx0XHRcdDogdW5kZWZpbmVkO1xuXG5cdFx0aWYgKCFwcmVwYXJlZD8uY29uZmlybWF0aW9uTWVzc2FnZXMgJiYgdG9vbC5kYXRhLnJlcXVpcmVzQ29uZmlybWF0aW9uICYmIHRvb2wuZGF0YS5zb3VyY2UudHlwZSA9PT0gJ2V4dGVuc2lvbicpIHtcblx0XHRcdGlmICghcHJlcGFyZWQpIHtcblx0XHRcdFx0cHJlcGFyZWQgPSB7fTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgdG9vbFdhcm5pbmcgPSBsb2NhbGl6ZShcblx0XHRcdFx0J3Rvb2wud2FybmluZycsXG5cdFx0XHRcdFwiezB9IFRoaXMgdG9vbCBpcyBmcm9tIHRoZSBleHRlbnNpb24gYHsxfWAuIFBsZWFzZSBjYXJlZnVsbHkgcmV2aWV3IGFueSByZXF1ZXN0ZWQgYWN0aW9ucy5cIixcblx0XHRcdFx0JyQoaW5mbyknLFxuXHRcdFx0XHR0b29sLmRhdGEuc291cmNlLmV4dGVuc2lvbklkLnZhbHVlLFxuXHRcdFx0KTtcblx0XHRcdHByZXBhcmVkLmNvbmZpcm1hdGlvbk1lc3NhZ2VzID0ge1xuXHRcdFx0XHR0aXRsZTogbG9jYWxpemUoJ21zZy50aXRsZScsIFwiUnVuIHswfVwiLCBgXCIke3Rvb2wuZGF0YS5kaXNwbGF5TmFtZX1cImApLFxuXHRcdFx0XHRtZXNzYWdlOiBuZXcgTWFya2Rvd25TdHJpbmcoKHRvb2wuZGF0YS51c2VyRGVzY3JpcHRpb24gPz8gdG9vbC5kYXRhLm1vZGVsRGVzY3JpcHRpb24pICsgJ1xcblxcbicgKyB0b29sV2FybmluZywgeyBzdXBwb3J0VGhlbWVJY29uczogdHJ1ZSB9KSxcblx0XHRcdFx0YWxsb3dBdXRvQ29uZmlybTogdHJ1ZSxcblx0XHRcdH07XG5cdFx0fVxuXG5cdFx0aWYgKHByZXBhcmVkPy5jb25maXJtYXRpb25NZXNzYWdlcykge1xuXHRcdFx0aWYgKHByZXBhcmVkLnRvb2xTcGVjaWZpY0RhdGE/LmtpbmQgIT09ICd0ZXJtaW5hbCcgJiYgdHlwZW9mIHByZXBhcmVkLmNvbmZpcm1hdGlvbk1lc3NhZ2VzLmFsbG93QXV0b0NvbmZpcm0gIT09ICdib29sZWFuJykge1xuXHRcdFx0XHRwcmVwYXJlZC5jb25maXJtYXRpb25NZXNzYWdlcy5hbGxvd0F1dG9Db25maXJtID0gdHJ1ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKCFwcmVwYXJlZC50b29sU3BlY2lmaWNEYXRhICYmIHRvb2wuZGF0YS5hbHdheXNEaXNwbGF5SW5wdXRPdXRwdXQpIHtcblx0XHRcdFx0cHJlcGFyZWQudG9vbFNwZWNpZmljRGF0YSA9IHtcblx0XHRcdFx0XHRraW5kOiAnaW5wdXQnLFxuXHRcdFx0XHRcdHJhd0lucHV0OiBkdG8ucGFyYW1ldGVycyxcblx0XHRcdFx0fTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gcHJlcGFyZWQ7XG5cdH1cblxuXHRwcml2YXRlIGVuc3VyZVRvb2xEZXRhaWxzKGR0bzogSVRvb2xJbnZvY2F0aW9uLCB0b29sUmVzdWx0OiBJVG9vbFJlc3VsdCwgdG9vbERhdGE6IElUb29sRGF0YSk6IHZvaWQge1xuXHRcdGlmICghdG9vbFJlc3VsdC50b29sUmVzdWx0RGV0YWlscyAmJiB0b29sRGF0YS5hbHdheXNEaXNwbGF5SW5wdXRPdXRwdXQpIHtcblx0XHRcdHRvb2xSZXN1bHQudG9vbFJlc3VsdERldGFpbHMgPSB7XG5cdFx0XHRcdGlucHV0OiBKU09OLnN0cmluZ2lmeShkdG8ucGFyYW1ldGVycywgdW5kZWZpbmVkLCAyKSxcblx0XHRcdFx0b3V0cHV0OiB0aGlzLnRvb2xSZXN1bHRUb1N0cmluZyh0b29sUmVzdWx0KSxcblx0XHRcdH07XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSB0b29sUmVzdWx0VG9TdHJpbmcodG9vbFJlc3VsdDogSVRvb2xSZXN1bHQpOiBzdHJpbmcge1xuXHRcdGNvbnN0IHN0cnMgPSBbXTtcblx0XHRmb3IgKGNvbnN0IHBhcnQgb2YgdG9vbFJlc3VsdC5jb250ZW50KSB7XG5cdFx0XHRpZiAocGFydC5raW5kID09PSAndGV4dCcpIHtcblx0XHRcdFx0c3Rycy5wdXNoKHBhcnQudmFsdWUpO1xuXHRcdFx0fSBlbHNlIGlmIChwYXJ0LmtpbmQgPT09ICdwcm9tcHRUc3gnKSB7XG5cdFx0XHRcdHN0cnMucHVzaChzdHJpbmdpZnlQcm9tcHRUc3hQYXJ0KHBhcnQpKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHN0cnMuam9pbignJyk7XG5cdH1cblxuXHRwcml2YXRlIHNob3VsZEF1dG9Db25maXJtKHRvb2xJZDogc3RyaW5nLCBydW5zSW5Xb3Jrc3BhY2U6IGJvb2xlYW4gfCB1bmRlZmluZWQpOiBib29sZWFuIHtcblx0XHRpZiAodGhpcy5fd29ya3NwYWNlVG9vbENvbmZpcm1TdG9yZS52YWx1ZS5nZXRBdXRvQ29uZmlybSh0b29sSWQpIHx8IHRoaXMuX3Byb2ZpbGVUb29sQ29uZmlybVN0b3JlLnZhbHVlLmdldEF1dG9Db25maXJtKHRvb2xJZCkgfHwgdGhpcy5fbWVtb3J5VG9vbENvbmZpcm1TdG9yZS5oYXModG9vbElkKSkge1xuXHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY29uZmlnID0gdGhpcy5fY29uZmlndXJhdGlvblNlcnZpY2UuaW5zcGVjdDxib29sZWFuIHwgUmVjb3JkPHN0cmluZywgYm9vbGVhbj4+KCdjaGF0LnRvb2xzLmF1dG9BcHByb3ZlJyk7XG5cblx0XHQvLyBJZiB3ZSBrbm93IHRoZSB0b29sIHJ1bnMgYXQgYSBnbG9iYWwgbGV2ZWwsIG9ubHkgY29uc2lkZXIgdGhlIGdsb2JhbCBjb25maWcuXG5cdFx0Ly8gSWYgd2Uga25vdyB0aGUgdG9vbCBydW5zIGF0IGEgd29ya3NwYWNlIGxldmVsLCB1c2UgdGhvc2Ugc3BlY2lmaWMgc2V0dGluZ3Mgd2hlbiBhcHByb3ByaWF0ZS5cblx0XHRsZXQgdmFsdWUgPSBjb25maWcudmFsdWUgPz8gY29uZmlnLmRlZmF1bHRWYWx1ZTtcblx0XHRpZiAodHlwZW9mIHJ1bnNJbldvcmtzcGFjZSA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR2YWx1ZSA9IGNvbmZpZy51c2VyTG9jYWxWYWx1ZSA/PyBjb25maWcuYXBwbGljYXRpb25WYWx1ZTtcblx0XHRcdGlmIChydW5zSW5Xb3Jrc3BhY2UpIHtcblx0XHRcdFx0dmFsdWUgPSBjb25maWcud29ya3NwYWNlVmFsdWUgPz8gY29uZmlnLndvcmtzcGFjZUZvbGRlclZhbHVlID8/IGNvbmZpZy51c2VyUmVtb3RlVmFsdWUgPz8gdmFsdWU7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHZhbHVlID09PSB0cnVlIHx8ICh0eXBlb2YgdmFsdWUgPT09ICdvYmplY3QnICYmIHZhbHVlLmhhc093blByb3BlcnR5KHRvb2xJZCkgJiYgdmFsdWVbdG9vbElkXSA9PT0gdHJ1ZSk7XG5cdH1cblxuXHRwcml2YXRlIGNsZWFudXBDYWxsRGlzcG9zYWJsZXMocmVxdWVzdElkOiBzdHJpbmcsIHN0b3JlOiBEaXNwb3NhYmxlU3RvcmUpOiB2b2lkIHtcblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IHRoaXMuX2NhbGxzQnlSZXF1ZXN0SWQuZ2V0KHJlcXVlc3RJZCk7XG5cdFx0aWYgKGRpc3Bvc2FibGVzKSB7XG5cdFx0XHRjb25zdCBpbmRleCA9IGRpc3Bvc2FibGVzLmluZGV4T2Yoc3RvcmUpO1xuXHRcdFx0aWYgKGluZGV4ID4gLTEpIHtcblx0XHRcdFx0ZGlzcG9zYWJsZXMuc3BsaWNlKGluZGV4LCAxKTtcblx0XHRcdH1cblx0XHRcdGlmIChkaXNwb3NhYmxlcy5sZW5ndGggPT09IDApIHtcblx0XHRcdFx0dGhpcy5fY2FsbHNCeVJlcXVlc3RJZC5kZWxldGUocmVxdWVzdElkKTtcblx0XHRcdH1cblx0XHR9XG5cdFx0c3RvcmUuZGlzcG9zZSgpO1xuXHR9XG5cblx0Y2FuY2VsVG9vbENhbGxzRm9yUmVxdWVzdChyZXF1ZXN0SWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdGNvbnN0IGNhbGxzID0gdGhpcy5fY2FsbHNCeVJlcXVlc3RJZC5nZXQocmVxdWVzdElkKTtcblx0XHRpZiAoY2FsbHMpIHtcblx0XHRcdGNhbGxzLmZvckVhY2goY2FsbCA9PiBjYWxsLmRpc3Bvc2UoKSk7XG5cdFx0XHR0aGlzLl9jYWxsc0J5UmVxdWVzdElkLmRlbGV0ZShyZXF1ZXN0SWQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBvdmVycmlkZSBkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblxuXHRcdHRoaXMuX2NhbGxzQnlSZXF1ZXN0SWQuZm9yRWFjaChjYWxscyA9PiBkaXNwb3NlKGNhbGxzKSk7XG5cdFx0dGhpcy5fY3R4VG9vbHNDb3VudC5yZXNldCgpO1xuXHR9XG59XG5cbnR5cGUgTGFuZ3VhZ2VNb2RlbFRvb2xJbnZva2VkRXZlbnQgPSB7XG5cdHJlc3VsdDogJ3N1Y2Nlc3MnIHwgJ2Vycm9yJyB8ICd1c2VyQ2FuY2VsbGVkJztcblx0Y2hhdFNlc3Npb25JZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHR0b29sSWQ6IHN0cmluZztcblx0dG9vbEV4dGVuc2lvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHRvb2xTb3VyY2VLaW5kOiBzdHJpbmc7XG59O1xuXG50eXBlIExhbmd1YWdlTW9kZWxUb29sSW52b2tlZENsYXNzaWZpY2F0aW9uID0ge1xuXHRyZXN1bHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdXaGV0aGVyIGludm9raW5nIHRoZSBMYW5ndWFnZU1vZGVsVG9vbCByZXN1bHRlZCBpbiBhbiBlcnJvci4nIH07XG5cdGNoYXRTZXNzaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgSUQgb2YgdGhlIGNoYXQgc2Vzc2lvbiB0aGF0IHRoZSB0b29sIHdhcyB1c2VkIHdpdGhpbiwgaWYgYXBwbGljYWJsZS4nIH07XG5cdHRvb2xJZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBJRCBvZiB0aGUgdG9vbCB1c2VkLicgfTtcblx0dG9vbEV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiB0aGF0IGNvbnRyaWJ1dGVkIHRoZSB0b29sLicgfTtcblx0dG9vbFNvdXJjZUtpbmQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgc291cmNlIChtY3AvZXh0ZW5zaW9uL2ludGVybmFsKSBvZiB0aGUgdG9vbC4nIH07XG5cdG93bmVyOiAncm9ibG91cmVucyc7XG5cdGNvbW1lbnQ6ICdQcm92aWRlcyBpbnNpZ2h0IGludG8gdGhlIHVzYWdlIG9mIGxhbmd1YWdlIG1vZGVsIHRvb2xzLic7XG59O1xuXG5jbGFzcyBUb29sQ29uZmlybVN0b3JlIGV4dGVuZHMgRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IFNUT1JFRF9LRVkgPSAnY2hhdC9hdXRvY29uZmlybSc7XG5cblx0cHJpdmF0ZSBfYXV0b0NvbmZpcm1Ub29sczogTFJVQ2FjaGU8c3RyaW5nLCBib29sZWFuPiA9IG5ldyBMUlVDYWNoZTxzdHJpbmcsIGJvb2xlYW4+KDEwMCk7XG5cdHByaXZhdGUgX2RpZENoYW5nZSA9IGZhbHNlO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Njb3BlOiBTdG9yYWdlU2NvcGUsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBzdG9yZWQgPSBzdG9yYWdlU2VydmljZS5nZXRPYmplY3Q8c3RyaW5nW10+KFRvb2xDb25maXJtU3RvcmUuU1RPUkVEX0tFWSwgdGhpcy5fc2NvcGUpO1xuXHRcdGlmIChzdG9yZWQpIHtcblx0XHRcdGZvciAoY29uc3Qga2V5IG9mIHN0b3JlZCkge1xuXHRcdFx0XHR0aGlzLl9hdXRvQ29uZmlybVRvb2xzLnNldChrZXksIHRydWUpO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHN0b3JhZ2VTZXJ2aWNlLm9uV2lsbFNhdmVTdGF0ZSgoKSA9PiB7XG5cdFx0XHRpZiAodGhpcy5fZGlkQ2hhbmdlKSB7XG5cdFx0XHRcdHRoaXMuc3RvcmFnZVNlcnZpY2Uuc3RvcmUoVG9vbENvbmZpcm1TdG9yZS5TVE9SRURfS0VZLCBbLi4udGhpcy5fYXV0b0NvbmZpcm1Ub29scy5rZXlzKCldLCB0aGlzLl9zY29wZSwgU3RvcmFnZVRhcmdldC5NQUNISU5FKTtcblx0XHRcdFx0dGhpcy5fZGlkQ2hhbmdlID0gZmFsc2U7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIHJlc2V0KCkge1xuXHRcdHRoaXMuX2F1dG9Db25maXJtVG9vbHMuY2xlYXIoKTtcblx0XHR0aGlzLl9kaWRDaGFuZ2UgPSB0cnVlO1xuXHR9XG5cblx0cHVibGljIGdldEF1dG9Db25maXJtKHRvb2xJZDogc3RyaW5nKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMuX2F1dG9Db25maXJtVG9vbHMuZ2V0KHRvb2xJZCkpIHtcblx0XHRcdHRoaXMuX2RpZENoYW5nZSA9IHRydWU7XG5cdFx0XHRyZXR1cm4gdHJ1ZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZmFsc2U7XG5cdH1cblxuXHRwdWJsaWMgc2V0QXV0b0NvbmZpcm0odG9vbElkOiBzdHJpbmcsIGF1dG9Db25maXJtOiBib29sZWFuKTogdm9pZCB7XG5cdFx0aWYgKGF1dG9Db25maXJtKSB7XG5cdFx0XHR0aGlzLl9hdXRvQ29uZmlybVRvb2xzLnNldCh0b29sSWQsIHRydWUpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9hdXRvQ29uZmlybVRvb2xzLmRlbGV0ZSh0b29sSWQpO1xuXHRcdH1cblx0XHR0aGlz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
