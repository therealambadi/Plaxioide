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
import { findLast } from "../../../../base/common/arraysFind.js";
import { timeout } from "../../../../base/common/async.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { Emitter } from "../../../../base/common/event.js";
import { isMarkdownString } from "../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable, toDisposable } from "../../../../base/common/lifecycle.js";
import { revive } from "../../../../base/common/marshalling.js";
import { observableValue } from "../../../../base/common/observable.js";
import { equalsIgnoreCase } from "../../../../base/common/strings.js";
import { ThemeIcon } from "../../../../base/common/themables.js";
import { ContextKeyExpr, IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asJson, IRequestService } from "../../../../platform/request/common/request.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ChatContextKeys } from "./chatContextKeys.js";
import { ChatAgentLocation, ChatMode } from "./constants.js";
function isChatWelcomeMessageContent(obj) {
  return obj && ThemeIcon.isThemeIcon(obj.icon) && typeof obj.title === "string" && isMarkdownString(obj.message);
}
const IChatAgentService = createDecorator("chatAgentService");
let ChatAgentService = class extends Disposable {
  constructor(contextKeyService) {
    super();
    this.contextKeyService = contextKeyService;
    this._agents = /* @__PURE__ */ new Map();
    this._onDidChangeAgents = new Emitter();
    this.onDidChangeAgents = this._onDidChangeAgents.event;
    this._agentsContextKeys = /* @__PURE__ */ new Set();
    this._chatParticipantDetectionProviders = /* @__PURE__ */ new Map();
    this._agentCompletionProviders = /* @__PURE__ */ new Map();
    this._hasDefaultAgent = ChatContextKeys.enabled.bindTo(this.contextKeyService);
    this._defaultAgentRegistered = ChatContextKeys.panelParticipantRegistered.bindTo(this.contextKeyService);
    this._editingAgentRegistered = ChatContextKeys.editingParticipantRegistered.bindTo(this.contextKeyService);
    this._register(contextKeyService.onDidChangeContext((e) => {
      if (e.affectsSome(this._agentsContextKeys)) {
        this._updateContextKeys();
      }
    }));
    this._hasToolsAgentContextKey = ChatContextKeys.Editing.hasToolsAgent.bindTo(contextKeyService);
  }
  registerAgent(id, data) {
    const existingAgent = this.getAgent(id);
    if (existingAgent) {
      throw new Error(`Agent already registered: ${JSON.stringify(id)}`);
    }
    const that = this;
    const commands = data.slashCommands;
    data = {
      ...data,
      get slashCommands() {
        return commands.filter((c) => !c.when || that.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(c.when)));
      }
    };
    const entry = { data };
    this._agents.set(id, entry);
    this._updateAgentsContextKeys();
    this._updateContextKeys();
    this._onDidChangeAgents.fire(void 0);
    return toDisposable(() => {
      this._agents.delete(id);
      this._updateAgentsContextKeys();
      this._updateContextKeys();
      this._onDidChangeAgents.fire(void 0);
    });
  }
  _updateAgentsContextKeys() {
    this._agentsContextKeys.clear();
    for (const agent of this._agents.values()) {
      if (agent.data.when) {
        const expr = ContextKeyExpr.deserialize(agent.data.when);
        for (const key of expr?.keys() || []) {
          this._agentsContextKeys.add(key);
        }
      }
    }
  }
  _updateContextKeys() {
    let editingAgentRegistered = false;
    let defaultAgentRegistered = false;
    let toolsAgentRegistered = false;
    for (const agent of this.getAgents()) {
      if (agent.isDefault && agent.locations.includes(ChatAgentLocation.EditingSession)) {
        editingAgentRegistered = true;
        if (agent.isToolsAgent) {
          toolsAgentRegistered = true;
        }
      } else if (agent.isDefault) {
        defaultAgentRegistered = true;
      }
    }
    this._editingAgentRegistered.set(editingAgentRegistered);
    this._defaultAgentRegistered.set(defaultAgentRegistered);
    if (toolsAgentRegistered !== this._hasToolsAgentContextKey.get()) {
      this._hasToolsAgentContextKey.set(toolsAgentRegistered);
      this._onDidChangeAgents.fire(this.getDefaultAgent(ChatAgentLocation.EditingSession));
    }
  }
  registerAgentImplementation(id, agentImpl) {
    const entry = this._agents.get(id);
    if (!entry) {
      throw new Error(`Unknown agent: ${JSON.stringify(id)}`);
    }
    if (entry.impl) {
      throw new Error(`Agent already has implementation: ${JSON.stringify(id)}`);
    }
    if (entry.data.isDefault) {
      this._hasDefaultAgent.set(true);
    }
    entry.impl = agentImpl;
    this._onDidChangeAgents.fire(new MergedChatAgent(entry.data, agentImpl));
    return toDisposable(() => {
      entry.impl = void 0;
      this._onDidChangeAgents.fire(void 0);
      if (entry.data.isDefault) {
        this._hasDefaultAgent.set(false);
      }
    });
  }
  registerDynamicAgent(data, agentImpl) {
    data.isDynamic = true;
    const agent = { data, impl: agentImpl };
    this._agents.set(data.id, agent);
    this._onDidChangeAgents.fire(new MergedChatAgent(data, agentImpl));
    return toDisposable(() => {
      this._agents.delete(data.id);
      this._onDidChangeAgents.fire(void 0);
    });
  }
  registerAgentCompletionProvider(id, provider) {
    this._agentCompletionProviders.set(id, provider);
    return {
      dispose: () => {
        this._agentCompletionProviders.delete(id);
      }
    };
  }
  async getAgentCompletionItems(id, query, token) {
    return await this._agentCompletionProviders.get(id)?.(query, token) ?? [];
  }
  updateAgent(id, updateMetadata) {
    const agent = this._agents.get(id);
    if (!agent?.impl) {
      throw new Error(`No activated agent with id ${JSON.stringify(id)} registered`);
    }
    agent.data.metadata = { ...agent.data.metadata, ...updateMetadata };
    this._onDidChangeAgents.fire(new MergedChatAgent(agent.data, agent.impl));
  }
  getDefaultAgent(location, mode) {
    if (mode === ChatMode.Edit || mode === ChatMode.Agent) {
      location = ChatAgentLocation.EditingSession;
    }
    return this._preferExtensionAgent(this.getActivatedAgents().filter((a) => {
      if (mode === ChatMode.Agent !== !!a.isToolsAgent) {
        return false;
      }
      return !!a.isDefault && a.locations.includes(location);
    }));
  }
  get hasToolsAgent() {
    return !!this._hasToolsAgentContextKey.get();
  }
  getContributedDefaultAgent(location) {
    return this._preferExtensionAgent(this.getAgents().filter((a) => !!a.isDefault && a.locations.includes(location)));
  }
  _preferExtensionAgent(agents) {
    return findLast(agents, (agent) => !agent.isCore) ?? agents.at(-1);
  }
  getAgent(id, includeDisabled = false) {
    if (!this._agentIsEnabled(id) && !includeDisabled) {
      return;
    }
    return this._agents.get(id)?.data;
  }
  _agentIsEnabled(idOrAgent) {
    const entry = typeof idOrAgent === "string" ? this._agents.get(idOrAgent) : idOrAgent;
    return !entry?.data.when || this.contextKeyService.contextMatchesRules(ContextKeyExpr.deserialize(entry.data.when));
  }
  getAgentByFullyQualifiedId(id) {
    const agent = Iterable.find(this._agents.values(), (a) => getFullyQualifiedId(a.data) === id)?.data;
    if (agent && !this._agentIsEnabled(agent.id)) {
      return;
    }
    return agent;
  }
  /**
   * Returns all agent datas that exist- static registered and dynamic ones.
   */
  getAgents() {
    return Array.from(this._agents.values()).map((entry) => entry.data).filter((a) => this._agentIsEnabled(a.id));
  }
  getActivatedAgents() {
    return Array.from(this._agents.values()).filter((a) => !!a.impl).filter((a) => this._agentIsEnabled(a.data.id)).map((a) => new MergedChatAgent(a.data, a.impl));
  }
  getAgentsByName(name) {
    return this._preferExtensionAgents(this.getAgents().filter((a) => a.name === name));
  }
  _preferExtensionAgents(agents) {
    const extensionAgents = agents.filter((a) => !a.isCore);
    return extensionAgents.length > 0 ? extensionAgents : agents;
  }
  agentHasDupeName(id) {
    const agent = this.getAgent(id);
    if (!agent) {
      return false;
    }
    return this.getAgentsByName(agent.name).filter((a) => a.extensionId.value !== agent.extensionId.value).length > 0;
  }
  async invokeAgent(id, request, progress, history, token) {
    const data = this._agents.get(id);
    if (!data?.impl) {
      throw new Error(`No activated agent with id "${id}"`);
    }
    return await data.impl.invoke(request, progress, history, token);
  }
  setRequestPaused(id, requestId, isPaused) {
    const data = this._agents.get(id);
    if (!data?.impl) {
      throw new Error(`No activated agent with id "${id}"`);
    }
    data.impl.setRequestPaused?.(requestId, isPaused);
  }
  async getFollowups(id, request, result, history, token) {
    const data = this._agents.get(id);
    if (!data?.impl) {
      throw new Error(`No activated agent with id "${id}"`);
    }
    if (!data.impl?.provideFollowups) {
      return [];
    }
    return data.impl.provideFollowups(request, result, history, token);
  }
  async getChatTitle(id, history, token) {
    const data = this._agents.get(id);
    if (!data?.impl) {
      throw new Error(`No activated agent with id "${id}"`);
    }
    if (!data.impl?.provideChatTitle) {
      return void 0;
    }
    return data.impl.provideChatTitle(history, token);
  }
  registerChatParticipantDetectionProvider(handle, provider) {
    this._chatParticipantDetectionProviders.set(handle, provider);
    return toDisposable(() => {
      this._chatParticipantDetectionProviders.delete(handle);
    });
  }
  hasChatParticipantDetectionProviders() {
    return this._chatParticipantDetectionProviders.size > 0;
  }
  async detectAgentOrCommand(request, history, options, token) {
    const provider = Iterable.first(this._chatParticipantDetectionProviders.values());
    if (!provider) {
      return;
    }
    const participants = this.getAgents().reduce((acc, a) => {
      if (a.locations.includes(options.location)) {
        acc.push({ participant: a.id, disambiguation: a.disambiguation ?? [] });
        for (const command2 of a.slashCommands) {
          acc.push({ participant: a.id, command: command2.name, disambiguation: command2.disambiguation ?? [] });
        }
      }
      return acc;
    }, []);
    const result = await provider.provideParticipantDetection(request, history, { ...options, participants }, token);
    if (!result) {
      return;
    }
    const agent = this.getAgent(result.participant);
    if (!agent) {
      return;
    }
    if (!result.command) {
      return { agent };
    }
    const command = agent?.slashCommands.find((c) => c.name === result.command);
    if (!command) {
      return;
    }
    return { agent, command };
  }
};
ChatAgentService.AGENT_LEADER = "@";
ChatAgentService = __decorateClass([
  __decorateParam(0, IContextKeyService)
], ChatAgentService);
class MergedChatAgent {
  constructor(data, impl) {
    this.data = data;
    this.impl = impl;
  }
  get id() {
    return this.data.id;
  }
  get name() {
    return this.data.name ?? "";
  }
  get fullName() {
    return this.data.fullName ?? "";
  }
  get description() {
    return this.data.description ?? "";
  }
  get extensionId() {
    return this.data.extensionId;
  }
  get extensionPublisherId() {
    return this.data.extensionPublisherId;
  }
  get extensionPublisherDisplayName() {
    return this.data.publisherDisplayName;
  }
  get extensionDisplayName() {
    return this.data.extensionDisplayName;
  }
  get isDefault() {
    return this.data.isDefault;
  }
  get isToolsAgent() {
    return this.data.isToolsAgent;
  }
  get isCore() {
    return this.data.isCore;
  }
  get metadata() {
    return this.data.metadata;
  }
  get slashCommands() {
    return this.data.slashCommands;
  }
  get locations() {
    return this.data.locations;
  }
  get disambiguation() {
    return this.data.disambiguation;
  }
  async invoke(request, progress, history, token) {
    return this.impl.invoke(request, progress, history, token);
  }
  setRequestPaused(requestId, isPaused) {
    if (this.impl.setRequestPaused) {
      this.impl.setRequestPaused(requestId, isPaused);
    }
  }
  async provideFollowups(request, result, history, token) {
    if (this.impl.provideFollowups) {
      return this.impl.provideFollowups(request, result, history, token);
    }
    return [];
  }
  provideWelcomeMessage(token) {
    if (this.impl.provideWelcomeMessage) {
      return this.impl.provideWelcomeMessage(token);
    }
    return void 0;
  }
  provideSampleQuestions(location, token) {
    if (this.impl.provideSampleQuestions) {
      return this.impl.provideSampleQuestions(location, token);
    }
    return void 0;
  }
  toJSON() {
    return this.data;
  }
}
const IChatAgentNameService = createDecorator("chatAgentNameService");
let ChatAgentNameService = class {
  constructor(productService, requestService, logService, storageService) {
    this.requestService = requestService;
    this.logService = logService;
    this.storageService = storageService;
    this.registry = observableValue(this, /* @__PURE__ */ Object.create(null));
    this.disposed = false;
    if (!productService.chatParticipantRegistry) {
      return;
    }
    this.url = productService.chatParticipantRegistry;
    const raw = storageService.get(ChatAgentNameService.StorageKey, StorageScope.APPLICATION);
    try {
      this.registry.set(JSON.parse(raw ?? "{}"), void 0);
    } catch (err) {
      storageService.remove(ChatAgentNameService.StorageKey, StorageScope.APPLICATION);
    }
    this.refresh();
  }
  refresh() {
    if (this.disposed) {
      return;
    }
    this.update().catch((err) => this.logService.warn("Failed to fetch chat participant registry", err)).then(() => timeout(5 * 60 * 1e3)).then(() => this.refresh());
  }
  async update() {
    const context = await this.requestService.request({ type: "GET", url: this.url }, CancellationToken.None);
    if (context.res.statusCode !== 200) {
      throw new Error("Could not get extensions report.");
    }
    const result = await asJson(context);
    if (!result || result.version !== 1) {
      throw new Error("Unexpected chat participant registry response.");
    }
    const registry = result.restrictedChatParticipants;
    this.registry.set(registry, void 0);
    this.storageService.store(ChatAgentNameService.StorageKey, JSON.stringify(registry), StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  /**
   * Returns true if the agent is allowed to use this name
   */
  getAgentNameRestriction(chatAgentData) {
    if (chatAgentData.isCore) {
      return true;
    }
    const nameAllowed = this.checkAgentNameRestriction(chatAgentData.name, chatAgentData).get();
    const fullNameAllowed = !chatAgentData.fullName || this.checkAgentNameRestriction(chatAgentData.fullName.replace(/\s/g, ""), chatAgentData).get();
    return nameAllowed && fullNameAllowed;
  }
  checkAgentNameRestriction(name, chatAgentData) {
    const allowList = this.registry.map((registry) => registry[name.toLowerCase()]);
    return allowList.map((allowList2) => {
      if (!allowList2) {
        return true;
      }
      return allowList2.some((id) => equalsIgnoreCase(id, id.includes(".") ? chatAgentData.extensionId.value : chatAgentData.extensionPublisherId));
    });
  }
  dispose() {
    this.disposed = true;
  }
};
ChatAgentNameService.StorageKey = "chat.participantNameRegistry";
ChatAgentNameService = __decorateClass([
  __decorateParam(0, IProductService),
  __decorateParam(1, IRequestService),
  __decorateParam(2, ILogService),
  __decorateParam(3, IStorageService)
], ChatAgentNameService);
function getFullyQualifiedId(chatAgentData) {
  return `${chatAgentData.extensionId.value}.${chatAgentData.id}`;
}
function reviveSerializedAgent(raw) {
  const agent = "name" in raw ? raw : {
    ...raw,
    name: raw.id
  };
  if (!("extensionPublisherId" in agent)) {
    agent.extensionPublisherId = agent.extensionPublisher ?? "";
  }
  if (!("extensionDisplayName" in agent)) {
    agent.extensionDisplayName = "";
  }
  if (!("extensionId" in agent)) {
    agent.extensionId = new ExtensionIdentifier("");
  }
  return revive(agent);
}
export {
  ChatAgentNameService,
  ChatAgentService,
  IChatAgentNameService,
  IChatAgentService,
  MergedChatAgent,
  getFullyQualifiedId,
  isChatWelcomeMessageContent,
  reviveSerializedAgent
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0QWdlbnRzLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgZmluZExhc3QgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hcnJheXNGaW5kLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2NhbmNlbGxhdGlvbi5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgaXNNYXJrZG93blN0cmluZyB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2h0bWxDb250ZW50LmpzJztcbmltcG9ydCB7IEl0ZXJhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaXRlcmF0b3IuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgSURpc3Bvc2FibGUsIHRvRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBJT2JzZXJ2YWJsZSwgb2JzZXJ2YWJsZVZhbHVlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBlcXVhbHNJZ25vcmVDYXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IENvbW1hbmQsIFByb3ZpZGVyUmVzdWx0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgQ29udGV4dEtleUV4cHIsIElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbklkZW50aWZpZXIgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJUHJvZHVjdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9wcm9kdWN0L2NvbW1vbi9wcm9kdWN0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBhc0pzb24sIElSZXF1ZXN0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgSVN0b3JhZ2VTZXJ2aWNlLCBTdG9yYWdlU2NvcGUsIFN0b3JhZ2VUYXJnZXQgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9zdG9yYWdlL2NvbW1vbi9zdG9yYWdlLmpzJztcbmltcG9ydCB7IENoYXRDb250ZXh0S2V5cyB9IGZyb20gJy4vY2hhdENvbnRleHRLZXlzLmpzJztcbmltcG9ydCB7IElDaGF0UHJvZ3Jlc3NIaXN0b3J5UmVzcG9uc2VDb250ZW50LCBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEsIElTZXJpYWxpemFibGVDaGF0QWdlbnREYXRhIH0gZnJvbSAnLi9jaGF0TW9kZWwuanMnO1xuaW1wb3J0IHsgSVJhd0NoYXRDb21tYW5kQ29udHJpYnV0aW9uIH0gZnJvbSAnLi9jaGF0UGFydGljaXBhbnRDb250cmliVHlwZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRGb2xsb3d1cCwgSUNoYXRMb2NhdGlvbkRhdGEsIElDaGF0UHJvZ3Jlc3MsIElDaGF0UmVzcG9uc2VFcnJvckRldGFpbHMsIElDaGF0VGFza0R0byB9IGZyb20gJy4vY2hhdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50TG9jYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG4vLyNyZWdpb24gYWdlbnQgc2VydmljZSwgY29tbWFuZHMgZXRjXG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRBZ2VudEhpc3RvcnlFbnRyeSB7XG5cdHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0O1xuXHRyZXNwb25zZTogUmVhZG9ubHlBcnJheTxJQ2hhdFByb2dyZXNzSGlzdG9yeVJlc3BvbnNlQ29udGVudCB8IElDaGF0VGFza0R0bz47XG5cdHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEFnZW50RGF0YSB7XG5cdGlkOiBzdHJpbmc7XG5cdG5hbWU6IHN0cmluZztcblx0ZnVsbE5hbWU/OiBzdHJpbmc7XG5cdGRlc2NyaXB0aW9uPzogc3RyaW5nO1xuXHQvKiogVGhpcyBpcyBzdHJpbmcsIG5vdCBDb250ZXh0S2V5RXhwcmVzc2lvbiwgYmVjYXVzZSBkZWFsaW5nIHdpdGggc2VyaWFsaXppbmcvZGVzZXJpYWxpemluZyBpcyBoYXJkIGFuZCBuZWVkIGEgYmV0dGVyIHBhdHRlcm4gZm9yIHRoaXMgKi9cblx0d2hlbj86IHN0cmluZztcblx0ZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXI7XG5cdGV4dGVuc2lvblB1Ymxpc2hlcklkOiBzdHJpbmc7XG5cdC8qKiBUaGlzIGlzIHRoZSBleHRlbnNpb24gcHVibGlzaGVyIGlkLCBvciwgaW4gdGhlIGNhc2Ugb2YgYSBkeW5hbWljYWxseSByZWdpc3RlcmVkIHBhcnRpY2lwYW50IChyZW1vdGUgYWdlbnQpLCB3aGF0ZXZlciBwdWJsaXNoZXIgbmFtZSB3ZSBoYXZlIGZvciBpdCAqL1xuXHRwdWJsaXNoZXJEaXNwbGF5TmFtZT86IHN0cmluZztcblx0ZXh0ZW5zaW9uRGlzcGxheU5hbWU6IHN0cmluZztcblx0LyoqIFRoZSBhZ2VudCBpbnZva2VkIHdoZW4gbm8gYWdlbnQgaXMgc3BlY2lmaWVkICovXG5cdGlzRGVmYXVsdD86IGJvb2xlYW47XG5cdC8qKiBUaGUgZGVmYXVsdCBhZ2VudCB3aGVuIFwiYWdlbnQtbW9kZVwiIGlzIGVuYWJsZWQgKi9cblx0aXNUb29sc0FnZW50PzogYm9vbGVhbjtcblx0LyoqIFRoaXMgYWdlbnQgaXMgbm90IGNvbnRyaWJ1dGVkIGluIHBhY2thZ2UuanNvbiwgYnV0IGlzIHJlZ2lzdGVyZWQgZHluYW1pY2FsbHkgKi9cblx0aXNEeW5hbWljPzogYm9vbGVhbjtcblx0LyoqIFRoaXMgYWdlbnQgaXMgY29udHJpYnV0ZWQgZnJvbSBjb3JlIGFuZCBub3QgZnJvbSBhbiBleHRlbnNpb24gKi9cblx0aXNDb3JlPzogYm9vbGVhbjtcblx0bWV0YWRhdGE6IElDaGF0QWdlbnRNZXRhZGF0YTtcblx0c2xhc2hDb21tYW5kczogSUNoYXRBZ2VudENvbW1hbmRbXTtcblx0bG9jYXRpb25zOiBDaGF0QWdlbnRMb2NhdGlvbltdO1xuXHRkaXNhbWJpZ3VhdGlvbjogeyBjYXRlZ29yeTogc3RyaW5nOyBkZXNjcmlwdGlvbjogc3RyaW5nOyBleGFtcGxlczogc3RyaW5nW10gfVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0V2VsY29tZU1lc3NhZ2VDb250ZW50IHtcblx0aWNvbjogVGhlbWVJY29uO1xuXHR0aXRsZTogc3RyaW5nO1xuXHRtZXNzYWdlOiBJTWFya2Rvd25TdHJpbmc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQob2JqOiBhbnkpOiBvYmogaXMgSUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQge1xuXHRyZXR1cm4gb2JqICYmXG5cdFx0VGhlbWVJY29uLmlzVGhlbWVJY29uKG9iai5pY29uKSAmJlxuXHRcdHR5cGVvZiBvYmoudGl0bGUgPT09ICdzdHJpbmcnICYmXG5cdFx0aXNNYXJrZG93blN0cmluZyhvYmoubWVzc2FnZSk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uIHtcblx0aW52b2tlKHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEFnZW50UmVzdWx0Pjtcblx0c2V0UmVxdWVzdFBhdXNlZD8ocmVxdWVzdElkOiBzdHJpbmcsIGlzUGF1c2VkOiBib29sZWFuKTogdm9pZDtcblx0cHJvdmlkZUZvbGxvd3Vwcz8ocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0Rm9sbG93dXBbXT47XG5cdHByb3ZpZGVXZWxjb21lTWVzc2FnZT8odG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvdmlkZXJSZXN1bHQ8SUNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQgfCB1bmRlZmluZWQ+O1xuXHRwcm92aWRlQ2hhdFRpdGxlPzogKGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD47XG5cdHByb3ZpZGVTYW1wbGVRdWVzdGlvbnM/KGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvdmlkZXJSZXN1bHQ8SUNoYXRGb2xsb3d1cFtdIHwgdW5kZWZpbmVkPjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUmVzdWx0IHtcblx0cGFydGljaXBhbnQ6IHN0cmluZztcblx0Y29tbWFuZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFBhcnRpY2lwYW50TWV0YWRhdGEge1xuXHRwYXJ0aWNpcGFudDogc3RyaW5nO1xuXHRjb21tYW5kPzogc3RyaW5nO1xuXHRkaXNhbWJpZ3VhdGlvbjogeyBjYXRlZ29yeTogc3RyaW5nOyBkZXNjcmlwdGlvbjogc3RyaW5nOyBleGFtcGxlczogc3RyaW5nW10gfVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlciB7XG5cdHByb3ZpZGVQYXJ0aWNpcGFudERldGVjdGlvbihyZXF1ZXN0OiBJQ2hhdEFnZW50UmVxdWVzdCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCBvcHRpb25zOiB7IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbjsgcGFydGljaXBhbnRzOiBJQ2hhdFBhcnRpY2lwYW50TWV0YWRhdGFbXSB9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0UGFydGljaXBhbnREZXRlY3Rpb25SZXN1bHQgfCBudWxsIHwgdW5kZWZpbmVkPjtcbn1cblxuZXhwb3J0IHR5cGUgSUNoYXRBZ2VudCA9IElDaGF0QWdlbnREYXRhICYgSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWdlbnRDb21tYW5kIGV4dGVuZHMgSVJhd0NoYXRDb21tYW5kQ29udHJpYnV0aW9uIHtcblx0Zm9sbG93dXBQbGFjZWhvbGRlcj86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlcXVlc3RlckluZm9ybWF0aW9uIHtcblx0bmFtZTogc3RyaW5nO1xuXG5cdC8qKlxuXHQgKiBBIGZ1bGwgVVJJIGZvciB0aGUgaWNvbiBvZiB0aGUgcmVxdWVzdGVyLlxuXHQgKi9cblx0aWNvbj86IFVSSTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEFnZW50TWV0YWRhdGEge1xuXHRoZWxwVGV4dFByZWZpeD86IHN0cmluZyB8IElNYXJrZG93blN0cmluZztcblx0aGVscFRleHRWYXJpYWJsZXNQcmVmaXg/OiBzdHJpbmcgfCBJTWFya2Rvd25TdHJpbmc7XG5cdGhlbHBUZXh0UG9zdGZpeD86IHN0cmluZyB8IElNYXJrZG93blN0cmluZztcblx0aWNvbj86IFVSSTtcblx0aWNvbkRhcms/OiBVUkk7XG5cdHRoZW1lSWNvbj86IFRoZW1lSWNvbjtcblx0c2FtcGxlUmVxdWVzdD86IHN0cmluZztcblx0c3VwcG9ydElzc3VlUmVwb3J0aW5nPzogYm9vbGVhbjtcblx0Zm9sbG93dXBQbGFjZWhvbGRlcj86IHN0cmluZztcblx0aXNTdGlja3k/OiBib29sZWFuO1xuXHRyZXF1ZXN0ZXI/OiBJQ2hhdFJlcXVlc3RlckluZm9ybWF0aW9uO1xuXHR3ZWxjb21lTWVzc2FnZUNvbnRlbnQ/OiBJQ2hhdFdlbGNvbWVNZXNzYWdlQ29udGVudDtcbn1cblxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWdlbnRSZXF1ZXN0IHtcblx0c2Vzc2lvbklkOiBzdHJpbmc7XG5cdHJlcXVlc3RJZDogc3RyaW5nO1xuXHRhZ2VudElkOiBzdHJpbmc7XG5cdGNvbW1hbmQ/OiBzdHJpbmc7XG5cdG1lc3NhZ2U6IHN0cmluZztcblx0YXR0ZW1wdD86IG51bWJlcjtcblx0ZW5hYmxlQ29tbWFuZERldGVjdGlvbj86IGJvb2xlYW47XG5cdGlzUGFydGljaXBhbnREZXRlY3RlZD86IGJvb2xlYW47XG5cdHZhcmlhYmxlczogSUNoYXRSZXF1ZXN0VmFyaWFibGVEYXRhO1xuXHRsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247XG5cdGxvY2F0aW9uRGF0YT86IElDaGF0TG9jYXRpb25EYXRhO1xuXHRhY2NlcHRlZENvbmZpcm1hdGlvbkRhdGE/OiBhbnlbXTtcblx0cmVqZWN0ZWRDb25maXJtYXRpb25EYXRhPzogYW55W107XG5cdHVzZXJTZWxlY3RlZE1vZGVsSWQ/OiBzdHJpbmc7XG5cdHVzZXJTZWxlY3RlZFRvb2xzPzogc3RyaW5nW107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRRdWVzdGlvbiB7XG5cdHJlYWRvbmx5IHByb21wdDogc3RyaW5nO1xuXHRyZWFkb25seSBwYXJ0aWNpcGFudD86IHN0cmluZztcblx0cmVhZG9ubHkgY29tbWFuZD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEFnZW50UmVzdWx0VGltaW5ncyB7XG5cdGZpcnN0UHJvZ3Jlc3M/OiBudW1iZXI7XG5cdHRvdGFsRWxhcHNlZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWdlbnRSZXN1bHQge1xuXHRlcnJvckRldGFpbHM/OiBJQ2hhdFJlc3BvbnNlRXJyb3JEZXRhaWxzO1xuXHR0aW1pbmdzPzogSUNoYXRBZ2VudFJlc3VsdFRpbWluZ3M7XG5cdC8qKiBFeHRyYSBwcm9wZXJ0aWVzIHRoYXQgdGhlIGFnZW50IGNhbiB1c2UgdG8gaWRlbnRpZnkgYSByZXN1bHQgKi9cblx0cmVhZG9ubHkgbWV0YWRhdGE/OiB7IHJlYWRvbmx5IFtrZXk6IHN0cmluZ106IGFueSB9O1xuXHRuZXh0UXVlc3Rpb24/OiBJQ2hhdFF1ZXN0aW9uO1xufVxuXG5leHBvcnQgY29uc3QgSUNoYXRBZ2VudFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SUNoYXRBZ2VudFNlcnZpY2U+KCdjaGF0QWdlbnRTZXJ2aWNlJyk7XG5cbmludGVyZmFjZSBJQ2hhdEFnZW50RW50cnkge1xuXHRkYXRhOiBJQ2hhdEFnZW50RGF0YTtcblx0aW1wbD86IElDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW0ge1xuXHRpZDogc3RyaW5nO1xuXHRuYW1lPzogc3RyaW5nO1xuXHRmdWxsTmFtZT86IHN0cmluZztcblx0aWNvbj86IFRoZW1lSWNvbjtcblx0dmFsdWU6IHVua25vd247XG5cdGNvbW1hbmQ/OiBDb21tYW5kO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWdlbnRTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXHQvKipcblx0ICogdW5kZWZpbmVkIHdoZW4gYW4gYWdlbnQgd2FzIHJlbW92ZWRcblx0ICovXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlQWdlbnRzOiBFdmVudDxJQ2hhdEFnZW50IHwgdW5kZWZpbmVkPjtcblx0cmVhZG9ubHkgaGFzVG9vbHNBZ2VudDogYm9vbGVhbjtcblx0cmVnaXN0ZXJBZ2VudChpZDogc3RyaW5nLCBkYXRhOiBJQ2hhdEFnZW50RGF0YSk6IElEaXNwb3NhYmxlO1xuXHRyZWdpc3RlckFnZW50SW1wbGVtZW50YXRpb24oaWQ6IHN0cmluZywgYWdlbnQ6IElDaGF0QWdlbnRJbXBsZW1lbnRhdGlvbik6IElEaXNwb3NhYmxlO1xuXHRyZWdpc3RlckR5bmFtaWNBZ2VudChkYXRhOiBJQ2hhdEFnZW50RGF0YSwgYWdlbnRJbXBsOiBJQ2hhdEFnZW50SW1wbGVtZW50YXRpb24pOiBJRGlzcG9zYWJsZTtcblx0cmVnaXN0ZXJBZ2VudENvbXBsZXRpb25Qcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogKHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW1bXT4pOiBJRGlzcG9zYWJsZTtcblx0Z2V0QWdlbnRDb21wbGV0aW9uSXRlbXMoaWQ6IHN0cmluZywgcXVlcnk6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW1bXT47XG5cdHJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHByb3ZpZGVyOiBJQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIpOiBJRGlzcG9zYWJsZTtcblx0ZGV0ZWN0QWdlbnRPckNvbW1hbmQocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgb3B0aW9uczogeyBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24gfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx7IGFnZW50OiBJQ2hhdEFnZW50RGF0YTsgY29tbWFuZD86IElDaGF0QWdlbnRDb21tYW5kIH0gfCB1bmRlZmluZWQ+O1xuXHRoYXNDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMoKTogYm9vbGVhbjtcblx0aW52b2tlQWdlbnQoYWdlbnQ6IHN0cmluZywgcmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHByb2dyZXNzOiAocGFydDogSUNoYXRQcm9ncmVzcykgPT4gdm9pZCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0QWdlbnRSZXN1bHQ+O1xuXHRzZXRSZXF1ZXN0UGF1c2VkKGFnZW50OiBzdHJpbmcsIHJlcXVlc3RJZDogc3RyaW5nLCBpc1BhdXNlZDogYm9vbGVhbik6IHZvaWQ7XG5cdGdldEZvbGxvd3VwcyhpZDogc3RyaW5nLCByZXF1ZXN0OiBJQ2hhdEFnZW50UmVxdWVzdCwgcmVzdWx0OiBJQ2hhdEFnZW50UmVzdWx0LCBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5W10sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUNoYXRGb2xsb3d1cFtdPjtcblx0Z2V0Q2hhdFRpdGxlKGlkOiBzdHJpbmcsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+O1xuXHRnZXRBZ2VudChpZDogc3RyaW5nLCBpbmNsdWRlRGlzYWJsZWQ/OiBib29sZWFuKTogSUNoYXRBZ2VudERhdGEgfCB1bmRlZmluZWQ7XG5cdGdldEFnZW50QnlGdWxseVF1YWxpZmllZElkKGlkOiBzdHJpbmcpOiBJQ2hhdEFnZW50RGF0YSB8IHVuZGVmaW5lZDtcblx0Z2V0QWdlbnRzKCk6IElDaGF0QWdlbnREYXRhW107XG5cdGdldEFjdGl2YXRlZEFnZW50cygpOiBBcnJheTxJQ2hhdEFnZW50Pjtcblx0Z2V0QWdlbnRzQnlOYW1lKG5hbWU6IHN0cmluZyk6IElDaGF0QWdlbnREYXRhW107XG5cdGFnZW50SGFzRHVwZU5hbWUoaWQ6IHN0cmluZyk6IGJvb2xlYW47XG5cblx0LyoqXG5cdCAqIEdldCB0aGUgZGVmYXVsdCBhZ2VudCAob25seSBpZiBhY3RpdmF0ZWQpXG5cdCAqL1xuXHRnZXREZWZhdWx0QWdlbnQobG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLCBtb2RlPzogQ2hhdE1vZGUpOiBJQ2hhdEFnZW50IHwgdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBHZXQgdGhlIGRlZmF1bHQgYWdlbnQgZGF0YSB0aGF0IGhhcyBiZWVuIGNvbnRyaWJ1dGVkIChtYXkgbm90IGJlIGFjdGl2YXRlZCB5ZXQpXG5cdCAqL1xuXHRnZXRDb250cmlidXRlZERlZmF1bHRBZ2VudChsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24pOiBJQ2hhdEFnZW50RGF0YSB8IHVuZGVmaW5lZDtcblx0dXBkYXRlQWdlbnQoaWQ6IHN0cmluZywgdXBkYXRlTWV0YWRhdGE6IElDaGF0QWdlbnRNZXRhZGF0YSk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0QWdlbnRTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDaGF0QWdlbnRTZXJ2aWNlIHtcblxuXHRwdWJsaWMgc3RhdGljIHJlYWRvbmx5IEFHRU5UX0xFQURFUiA9ICdAJztcblxuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF9hZ2VudHMgPSBuZXcgTWFwPHN0cmluZywgSUNoYXRBZ2VudEVudHJ5PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlQWdlbnRzID0gbmV3IEVtaXR0ZXI8SUNoYXRBZ2VudCB8IHVuZGVmaW5lZD4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VBZ2VudHM6IEV2ZW50PElDaGF0QWdlbnQgfCB1bmRlZmluZWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VBZ2VudHMuZXZlbnQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfYWdlbnRzQ29udGV4dEtleXMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfaGFzRGVmYXVsdEFnZW50OiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSByZWFkb25seSBfZGVmYXVsdEFnZW50UmVnaXN0ZXJlZDogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgX2VkaXRpbmdBZ2VudFJlZ2lzdGVyZWQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9oYXNUb29sc0FnZW50Q29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBfY2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzID0gbmV3IE1hcDxudW1iZXIsIElDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcj4oKTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9oYXNEZWZhdWx0QWdlbnQgPSBDaGF0Q29udGV4dEtleXMuZW5hYmxlZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fZGVmYXVsdEFnZW50UmVnaXN0ZXJlZCA9IENoYXRDb250ZXh0S2V5cy5wYW5lbFBhcnRpY2lwYW50UmVnaXN0ZXJlZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5fZWRpdGluZ0FnZW50UmVnaXN0ZXJlZCA9IENoYXRDb250ZXh0S2V5cy5lZGl0aW5nUGFydGljaXBhbnRSZWdpc3RlcmVkLmJpbmRUbyh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLl9yZWdpc3Rlcihjb250ZXh0S2V5U2VydmljZS5vbkRpZENoYW5nZUNvbnRleHQoKGUpID0+IHtcblx0XHRcdGlmIChlLmFmZmVjdHNTb21lKHRoaXMuX2FnZW50c0NvbnRleHRLZXlzKSkge1xuXHRcdFx0XHR0aGlzLl91cGRhdGVDb250ZXh0S2V5cygpO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHRoaXMuX2hhc1Rvb2xzQWdlbnRDb250ZXh0S2V5ID0gQ2hhdENvbnRleHRLZXlzLkVkaXRpbmcuaGFzVG9vbHNBZ2VudC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHR9XG5cblx0cmVnaXN0ZXJBZ2VudChpZDogc3RyaW5nLCBkYXRhOiBJQ2hhdEFnZW50RGF0YSk6IElEaXNwb3NhYmxlIHtcblx0XHRjb25zdCBleGlzdGluZ0FnZW50ID0gdGhpcy5nZXRBZ2VudChpZCk7XG5cdFx0aWYgKGV4aXN0aW5nQWdlbnQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQWdlbnQgYWxyZWFkeSByZWdpc3RlcmVkOiAke0pTT04uc3RyaW5naWZ5KGlkKX1gKTtcblx0XHR9XG5cblx0XHRjb25zdCB0aGF0ID0gdGhpcztcblx0XHRjb25zdCBjb21tYW5kcyA9IGRhdGEuc2xhc2hDb21tYW5kcztcblx0XHRkYXRhID0ge1xuXHRcdFx0Li4uZGF0YSxcblx0XHRcdGdldCBzbGFzaENvbW1hbmRzKCkge1xuXHRcdFx0XHRyZXR1cm4gY29tbWFuZHMuZmlsdGVyKGMgPT4gIWMud2hlbiB8fCB0aGF0LmNvbnRleHRLZXlTZXJ2aWNlLmNvbnRleHRNYXRjaGVzUnVsZXMoQ29udGV4dEtleUV4cHIuZGVzZXJpYWxpemUoYy53aGVuKSkpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgZW50cnkgPSB7IGRhdGEgfTtcblx0XHR0aGlzLl9hZ2VudHMuc2V0KGlkLCBlbnRyeSk7XG5cdFx0dGhpcy5fdXBkYXRlQWdlbnRzQ29udGV4dEtleXMoKTtcblx0XHR0aGlzLl91cGRhdGVDb250ZXh0S2V5cygpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQWdlbnRzLmZpcmUodW5kZWZpbmVkKTtcblxuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fYWdlbnRzLmRlbGV0ZShpZCk7XG5cdFx0XHR0aGlzLl91cGRhdGVBZ2VudHNDb250ZXh0S2V5cygpO1xuXHRcdFx0dGhpcy5fdXBkYXRlQ29udGV4dEtleXMoKTtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlQWdlbnRzLmZpcmUodW5kZWZpbmVkKTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUFnZW50c0NvbnRleHRLZXlzKCk6IHZvaWQge1xuXHRcdC8vIFVwZGF0ZSB0aGUgc2V0IG9mIGNvbnRleHQga2V5cyB1c2VkIGJ5IGFsbCBhZ2VudHNcblx0XHR0aGlzLl9hZ2VudHNDb250ZXh0S2V5cy5jbGVhcigpO1xuXHRcdGZvciAoY29uc3QgYWdlbnQgb2YgdGhpcy5fYWdlbnRzLnZhbHVlcygpKSB7XG5cdFx0XHRpZiAoYWdlbnQuZGF0YS53aGVuKSB7XG5cdFx0XHRcdGNvbnN0IGV4cHIgPSBDb250ZXh0S2V5RXhwci5kZXNlcmlhbGl6ZShhZ2VudC5kYXRhLndoZW4pO1xuXHRcdFx0XHRmb3IgKGNvbnN0IGtleSBvZiBleHByPy5rZXlzKCkgfHwgW10pIHtcblx0XHRcdFx0XHR0aGlzLl9hZ2VudHNDb250ZXh0S2V5cy5hZGQoa2V5KTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgX3VwZGF0ZUNvbnRleHRLZXlzKCk6IHZvaWQge1xuXHRcdGxldCBlZGl0aW5nQWdlbnRSZWdpc3RlcmVkID0gZmFsc2U7XG5cdFx0bGV0IGRlZmF1bHRBZ2VudFJlZ2lzdGVyZWQgPSBmYWxzZTtcblx0XHRsZXQgdG9vbHNBZ2VudFJlZ2lzdGVyZWQgPSBmYWxzZTtcblx0XHRmb3IgKGNvbnN0IGFnZW50IG9mIHRoaXMuZ2V0QWdlbnRzKCkpIHtcblx0XHRcdGlmIChhZ2VudC5pc0RlZmF1bHQgJiYgYWdlbnQubG9jYXRpb25zLmluY2x1ZGVzKENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKSkge1xuXHRcdFx0XHRlZGl0aW5nQWdlbnRSZWdpc3RlcmVkID0gdHJ1ZTtcblx0XHRcdFx0aWYgKGFnZW50LmlzVG9vbHNBZ2VudCkge1xuXHRcdFx0XHRcdHRvb2xzQWdlbnRSZWdpc3RlcmVkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChhZ2VudC5pc0RlZmF1bHQpIHtcblx0XHRcdFx0ZGVmYXVsdEFnZW50UmVnaXN0ZXJlZCA9IHRydWU7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHRoaXMuX2VkaXRpbmdBZ2VudFJlZ2lzdGVyZWQuc2V0KGVkaXRpbmdBZ2VudFJlZ2lzdGVyZWQpO1xuXHRcdHRoaXMuX2RlZmF1bHRBZ2VudFJlZ2lzdGVyZWQuc2V0KGRlZmF1bHRBZ2VudFJlZ2lzdGVyZWQpO1xuXHRcdGlmICh0b29sc0FnZW50UmVnaXN0ZXJlZCAhPT0gdGhpcy5faGFzVG9vbHNBZ2VudENvbnRleHRLZXkuZ2V0KCkpIHtcblx0XHRcdHRoaXMuX2hhc1Rvb2xzQWdlbnRDb250ZXh0S2V5LnNldCh0b29sc0FnZW50UmVnaXN0ZXJlZCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFnZW50cy5maXJlKHRoaXMuZ2V0RGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLkVkaXRpbmdTZXNzaW9uKSk7XG5cdFx0fVxuXHR9XG5cblx0cmVnaXN0ZXJBZ2VudEltcGxlbWVudGF0aW9uKGlkOiBzdHJpbmcsIGFnZW50SW1wbDogSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uKTogSURpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGVudHJ5ID0gdGhpcy5fYWdlbnRzLmdldChpZCk7XG5cdFx0aWYgKCFlbnRyeSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIGFnZW50OiAke0pTT04uc3RyaW5naWZ5KGlkKX1gKTtcblx0XHR9XG5cblx0XHRpZiAoZW50cnkuaW1wbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBBZ2VudCBhbHJlYWR5IGhhcyBpbXBsZW1lbnRhdGlvbjogJHtKU09OLnN0cmluZ2lmeShpZCl9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKGVudHJ5LmRhdGEuaXNEZWZhdWx0KSB7XG5cdFx0XHR0aGlzLl9oYXNEZWZhdWx0QWdlbnQuc2V0KHRydWUpO1xuXHRcdH1cblxuXHRcdGVudHJ5LmltcGwgPSBhZ2VudEltcGw7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VBZ2VudHMuZmlyZShuZXcgTWVyZ2VkQ2hhdEFnZW50KGVudHJ5LmRhdGEsIGFnZW50SW1wbCkpO1xuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRlbnRyeS5pbXBsID0gdW5kZWZpbmVkO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2VBZ2VudHMuZmlyZSh1bmRlZmluZWQpO1xuXG5cdFx0XHRpZiAoZW50cnkuZGF0YS5pc0RlZmF1bHQpIHtcblx0XHRcdFx0dGhpcy5faGFzRGVmYXVsdEFnZW50LnNldChmYWxzZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHRyZWdpc3RlckR5bmFtaWNBZ2VudChkYXRhOiBJQ2hhdEFnZW50RGF0YSwgYWdlbnRJbXBsOiBJQ2hhdEFnZW50SW1wbGVtZW50YXRpb24pOiBJRGlzcG9zYWJsZSB7XG5cdFx0ZGF0YS5pc0R5bmFtaWMgPSB0cnVlO1xuXHRcdGNvbnN0IGFnZW50ID0geyBkYXRhLCBpbXBsOiBhZ2VudEltcGwgfTtcblx0XHR0aGlzLl9hZ2VudHMuc2V0KGRhdGEuaWQsIGFnZW50KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUFnZW50cy5maXJlKG5ldyBNZXJnZWRDaGF0QWdlbnQoZGF0YSwgYWdlbnRJbXBsKSk7XG5cblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX2FnZW50cy5kZWxldGUoZGF0YS5pZCk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZUFnZW50cy5maXJlKHVuZGVmaW5lZCk7XG5cdFx0fSk7XG5cdH1cblxuXHRwcml2YXRlIF9hZ2VudENvbXBsZXRpb25Qcm92aWRlcnMgPSBuZXcgTWFwPHN0cmluZywgKHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW1bXT4+KCk7XG5cblx0cmVnaXN0ZXJBZ2VudENvbXBsZXRpb25Qcm92aWRlcihpZDogc3RyaW5nLCBwcm92aWRlcjogKHF1ZXJ5OiBzdHJpbmcsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4gUHJvbWlzZTxJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW1bXT4pIHtcblx0XHR0aGlzLl9hZ2VudENvbXBsZXRpb25Qcm92aWRlcnMuc2V0KGlkLCBwcm92aWRlcik7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGRpc3Bvc2U6ICgpID0+IHsgdGhpcy5fYWdlbnRDb21wbGV0aW9uUHJvdmlkZXJzLmRlbGV0ZShpZCk7IH1cblx0XHR9O1xuXHR9XG5cblx0YXN5bmMgZ2V0QWdlbnRDb21wbGV0aW9uSXRlbXMoaWQ6IHN0cmluZywgcXVlcnk6IHN0cmluZywgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSB7XG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuX2FnZW50Q29tcGxldGlvblByb3ZpZGVycy5nZXQoaWQpPy4ocXVlcnksIHRva2VuKSA/PyBbXTtcblx0fVxuXG5cdHVwZGF0ZUFnZW50KGlkOiBzdHJpbmcsIHVwZGF0ZU1ldGFkYXRhOiBJQ2hhdEFnZW50TWV0YWRhdGEpOiB2b2lkIHtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuX2FnZW50cy5nZXQoaWQpO1xuXHRcdGlmICghYWdlbnQ/LmltcGwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gYWN0aXZhdGVkIGFnZW50IHdpdGggaWQgJHtKU09OLnN0cmluZ2lmeShpZCl9IHJlZ2lzdGVyZWRgKTtcblx0XHR9XG5cdFx0YWdlbnQuZGF0YS5tZXRhZGF0YSA9IHsgLi4uYWdlbnQuZGF0YS5tZXRhZGF0YSwgLi4udXBkYXRlTWV0YWRhdGEgfTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZUFnZW50cy5maXJlKG5ldyBNZXJnZWRDaGF0QWdlbnQoYWdlbnQuZGF0YSwgYWdlbnQuaW1wbCkpO1xuXHR9XG5cblx0Z2V0RGVmYXVsdEFnZW50KGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgbW9kZT86IENoYXRNb2RlKTogSUNoYXRBZ2VudCB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKG1vZGUgPT09IENoYXRNb2RlLkVkaXQgfHwgbW9kZSA9PT0gQ2hhdE1vZGUuQWdlbnQpIHtcblx0XHRcdGxvY2F0aW9uID0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb247XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3ByZWZlckV4dGVuc2lvbkFnZW50KHRoaXMuZ2V0QWN0aXZhdGVkQWdlbnRzKCkuZmlsdGVyKGEgPT4ge1xuXHRcdFx0aWYgKChtb2RlID09PSBDaGF0TW9kZS5BZ2VudCkgIT09ICEhYS5pc1Rvb2xzQWdlbnQpIHtcblx0XHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gISFhLmlzRGVmYXVsdCAmJiBhLmxvY2F0aW9ucy5pbmNsdWRlcyhsb2NhdGlvbik7XG5cdFx0fSkpO1xuXHR9XG5cblx0cHVibGljIGdldCBoYXNUb29sc0FnZW50KCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuX2hhc1Rvb2xzQWdlbnRDb250ZXh0S2V5LmdldCgpO1xuXHR9XG5cblx0Z2V0Q29udHJpYnV0ZWREZWZhdWx0QWdlbnQobG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uKTogSUNoYXRBZ2VudERhdGEgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9wcmVmZXJFeHRlbnNpb25BZ2VudCh0aGlzLmdldEFnZW50cygpLmZpbHRlcihhID0+ICEhYS5pc0RlZmF1bHQgJiYgYS5sb2NhdGlvbnMuaW5jbHVkZXMobG9jYXRpb24pKSk7XG5cdH1cblxuXHRwcml2YXRlIF9wcmVmZXJFeHRlbnNpb25BZ2VudDxUIGV4dGVuZHMgSUNoYXRBZ2VudERhdGE+KGFnZW50czogVFtdKTogVCB8IHVuZGVmaW5lZCB7XG5cdFx0Ly8gV2UgcG90ZW50aWFsbHkgaGF2ZSBtdWx0aXBsZSBhZ2VudHMgb24gdGhlIHNhbWUgbG9jYXRpb24sXG5cdFx0Ly8gY29udHJpYnV0ZWQgZnJvbSBjb3JlIGFuZCBmcm9tIGV4dGVuc2lvbnMuXG5cdFx0Ly8gVGhpcyBtZXRob2Qgd2lsbCBwcmVmZXIgdGhlIGxhc3QgZXh0ZW5zaW9ucyBwcm92aWRlZCBhZ2VudFxuXHRcdC8vIGZhbGxpbmcgYmFjayB0byB0aGUgbGFzdCBjb3JlIGFnZW50IGlmIG5vIGV4dGVuc2lvbiBhZ2VudCBpcyBmb3VuZC5cblx0XHRyZXR1cm4gZmluZExhc3QoYWdlbnRzLCBhZ2VudCA9PiAhYWdlbnQuaXNDb3JlKSA/PyBhZ2VudHMuYXQoLTEpO1xuXHR9XG5cblx0Z2V0QWdlbnQoaWQ6IHN0cmluZywgaW5jbHVkZURpc2FibGVkID0gZmFsc2UpOiBJQ2hhdEFnZW50RGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0aWYgKCF0aGlzLl9hZ2VudElzRW5hYmxlZChpZCkgJiYgIWluY2x1ZGVEaXNhYmxlZCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hZ2VudHMuZ2V0KGlkKT8uZGF0YTtcblx0fVxuXG5cdHByaXZhdGUgX2FnZW50SXNFbmFibGVkKGlkT3JBZ2VudDogc3RyaW5nIHwgSUNoYXRBZ2VudEVudHJ5KTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgZW50cnkgPSB0eXBlb2YgaWRPckFnZW50ID09PSAnc3RyaW5nJyA/IHRoaXMuX2FnZW50cy5nZXQoaWRPckFnZW50KSA6IGlkT3JBZ2VudDtcblx0XHRyZXR1cm4gIWVudHJ5Py5kYXRhLndoZW4gfHwgdGhpcy5jb250ZXh0S2V5U2VydmljZS5jb250ZXh0TWF0Y2hlc1J1bGVzKENvbnRleHRLZXlFeHByLmRlc2VyaWFsaXplKGVudHJ5LmRhdGEud2hlbikpO1xuXHR9XG5cblx0Z2V0QWdlbnRCeUZ1bGx5UXVhbGlmaWVkSWQoaWQ6IHN0cmluZyk6IElDaGF0QWdlbnREYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCBhZ2VudCA9IEl0ZXJhYmxlLmZpbmQodGhpcy5fYWdlbnRzLnZhbHVlcygpLCBhID0+IGdldEZ1bGx5UXVhbGlmaWVkSWQoYS5kYXRhKSA9PT0gaWQpPy5kYXRhO1xuXHRcdGlmIChhZ2VudCAmJiAhdGhpcy5fYWdlbnRJc0VuYWJsZWQoYWdlbnQuaWQpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGFnZW50O1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYWxsIGFnZW50IGRhdGFzIHRoYXQgZXhpc3QtIHN0YXRpYyByZWdpc3RlcmVkIGFuZCBkeW5hbWljIG9uZXMuXG5cdCAqL1xuXHRnZXRBZ2VudHMoKTogSUNoYXRBZ2VudERhdGFbXSB7XG5cdFx0cmV0dXJuIEFycmF5LmZyb20odGhpcy5fYWdlbnRzLnZhbHVlcygpKVxuXHRcdFx0Lm1hcChlbnRyeSA9PiBlbnRyeS5kYXRhKVxuXHRcdFx0LmZpbHRlcihhID0+IHRoaXMuX2FnZW50SXNFbmFibGVkKGEuaWQpKTtcblx0fVxuXG5cdGdldEFjdGl2YXRlZEFnZW50cygpOiBJQ2hhdEFnZW50W10ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuX2FnZW50cy52YWx1ZXMoKSlcblx0XHRcdC5maWx0ZXIoYSA9PiAhIWEuaW1wbClcblx0XHRcdC5maWx0ZXIoYSA9PiB0aGlzLl9hZ2VudElzRW5hYmxlZChhLmRhdGEuaWQpKVxuXHRcdFx0Lm1hcChhID0+IG5ldyBNZXJnZWRDaGF0QWdlbnQoYS5kYXRhLCBhLmltcGwhKSk7XG5cdH1cblxuXHRnZXRBZ2VudHNCeU5hbWUobmFtZTogc3RyaW5nKTogSUNoYXRBZ2VudERhdGFbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ByZWZlckV4dGVuc2lvbkFnZW50cyh0aGlzLmdldEFnZW50cygpLmZpbHRlcihhID0+IGEubmFtZSA9PT0gbmFtZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBfcHJlZmVyRXh0ZW5zaW9uQWdlbnRzPFQgZXh0ZW5kcyBJQ2hhdEFnZW50RGF0YT4oYWdlbnRzOiBUW10pOiBUW10ge1xuXHRcdC8vIFdlIHBvdGVudGlhbGx5IGhhdmUgbXVsdGlwbGUgYWdlbnRzIG9uIHRoZSBzYW1lIGxvY2F0aW9uLFxuXHRcdC8vIGNvbnRyaWJ1dGVkIGZyb20gY29yZSBhbmQgZnJvbSBleHRlbnNpb25zLlxuXHRcdC8vIFRoaXMgbWV0aG9kIHdpbGwgcHJlZmVyIHRoZSBleHRlbnNpb25zIHByb3ZpZGVkIGFnZW50c1xuXHRcdC8vIGZhbGxpbmcgYmFjayB0byB0aGUgb3JpZ2luYWwgYWdlbnRzIGFycmF5IGV4dGVuc2lvbiBhZ2VudCBpcyBmb3VuZC5cblx0XHRjb25zdCBleHRlbnNpb25BZ2VudHMgPSBhZ2VudHMuZmlsdGVyKGEgPT4gIWEuaXNDb3JlKTtcblx0XHRyZXR1cm4gZXh0ZW5zaW9uQWdlbnRzLmxlbmd0aCA+IDAgPyBleHRlbnNpb25BZ2VudHMgOiBhZ2VudHM7XG5cdH1cblxuXHRhZ2VudEhhc0R1cGVOYW1lKGlkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuZ2V0QWdlbnQoaWQpO1xuXHRcdGlmICghYWdlbnQpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5nZXRBZ2VudHNCeU5hbWUoYWdlbnQubmFtZSlcblx0XHRcdC5maWx0ZXIoYSA9PiBhLmV4dGVuc2lvbklkLnZhbHVlICE9PSBhZ2VudC5leHRlbnNpb25JZC52YWx1ZSkubGVuZ3RoID4gMDtcblx0fVxuXG5cdGFzeW5jIGludm9rZUFnZW50KGlkOiBzdHJpbmcsIHJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LCBwcm9ncmVzczogKHBhcnQ6IElDaGF0UHJvZ3Jlc3MpID0+IHZvaWQsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEFnZW50UmVzdWx0PiB7XG5cdFx0Y29uc3QgZGF0YSA9IHRoaXMuX2FnZW50cy5nZXQoaWQpO1xuXHRcdGlmICghZGF0YT8uaW1wbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBhY3RpdmF0ZWQgYWdlbnQgd2l0aCBpZCBcIiR7aWR9XCJgKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYXdhaXQgZGF0YS5pbXBsLmludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pO1xuXHR9XG5cblx0c2V0UmVxdWVzdFBhdXNlZChpZDogc3RyaW5nLCByZXF1ZXN0SWQ6IHN0cmluZywgaXNQYXVzZWQ6IGJvb2xlYW4pIHtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fYWdlbnRzLmdldChpZCk7XG5cdFx0aWYgKCFkYXRhPy5pbXBsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYE5vIGFjdGl2YXRlZCBhZ2VudCB3aXRoIGlkIFwiJHtpZH1cImApO1xuXHRcdH1cblxuXHRcdGRhdGEuaW1wbC5zZXRSZXF1ZXN0UGF1c2VkPy4ocmVxdWVzdElkLCBpc1BhdXNlZCk7XG5cdH1cblxuXHRhc3luYyBnZXRGb2xsb3d1cHMoaWQ6IHN0cmluZywgcmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0Rm9sbG93dXBbXT4ge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9hZ2VudHMuZ2V0KGlkKTtcblx0XHRpZiAoIWRhdGE/LmltcGwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gYWN0aXZhdGVkIGFnZW50IHdpdGggaWQgXCIke2lkfVwiYCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFkYXRhLmltcGw/LnByb3ZpZGVGb2xsb3d1cHMpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGF0YS5pbXBsLnByb3ZpZGVGb2xsb3d1cHMocmVxdWVzdCwgcmVzdWx0LCBoaXN0b3J5LCB0b2tlbik7XG5cdH1cblxuXHRhc3luYyBnZXRDaGF0VGl0bGUoaWQ6IHN0cmluZywgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHN0cmluZyB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IGRhdGEgPSB0aGlzLl9hZ2VudHMuZ2V0KGlkKTtcblx0XHRpZiAoIWRhdGE/LmltcGwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgTm8gYWN0aXZhdGVkIGFnZW50IHdpdGggaWQgXCIke2lkfVwiYCk7XG5cdFx0fVxuXG5cdFx0aWYgKCFkYXRhLmltcGw/LnByb3ZpZGVDaGF0VGl0bGUpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGRhdGEuaW1wbC5wcm92aWRlQ2hhdFRpdGxlKGhpc3RvcnksIHRva2VuKTtcblx0fVxuXG5cdHJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIHByb3ZpZGVyOiBJQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIpIHtcblx0XHR0aGlzLl9jaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMuc2V0KGhhbmRsZSwgcHJvdmlkZXIpO1xuXHRcdHJldHVybiB0b0Rpc3Bvc2FibGUoKCkgPT4ge1xuXHRcdFx0dGhpcy5fY2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0aGFzQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzKCkge1xuXHRcdHJldHVybiB0aGlzLl9jaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMuc2l6ZSA+IDA7XG5cdH1cblxuXHRhc3luYyBkZXRlY3RBZ2VudE9yQ29tbWFuZChyZXF1ZXN0OiBJQ2hhdEFnZW50UmVxdWVzdCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCBvcHRpb25zOiB7IGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiB9LCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHsgYWdlbnQ6IElDaGF0QWdlbnREYXRhOyBjb21tYW5kPzogSUNoYXRBZ2VudENvbW1hbmQgfSB8IHVuZGVmaW5lZD4ge1xuXHRcdC8vIFRPRE9Aam95Y2VlcmhsIHNob3VsZCB3ZSBoYXZlIGEgc2VsZWN0b3IgdG8gYmUgYWJsZSB0byBuYXJyb3cgZG93biB3aGljaCBwcm92aWRlciB0byB1c2Vcblx0XHRjb25zdCBwcm92aWRlciA9IEl0ZXJhYmxlLmZpcnN0KHRoaXMuX2NoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVycy52YWx1ZXMoKSk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBhcnRpY2lwYW50cyA9IHRoaXMuZ2V0QWdlbnRzKCkucmVkdWNlPElDaGF0UGFydGljaXBhbnRNZXRhZGF0YVtdPigoYWNjLCBhKSA9PiB7XG5cdFx0XHRpZiAoYS5sb2NhdGlvbnMuaW5jbHVkZXMob3B0aW9ucy5sb2NhdGlvbikpIHtcblx0XHRcdFx0YWNjLnB1c2goeyBwYXJ0aWNpcGFudDogYS5pZCwgZGlzYW1iaWd1YXRpb246IGEuZGlzYW1iaWd1YXRpb24gPz8gW10gfSk7XG5cdFx0XHRcdGZvciAoY29uc3QgY29tbWFuZCBvZiBhLnNsYXNoQ29tbWFuZHMpIHtcblx0XHRcdFx0XHRhY2MucHVzaCh7IHBhcnRpY2lwYW50OiBhLmlkLCBjb21tYW5kOiBjb21tYW5kLm5hbWUsIGRpc2FtYmlndWF0aW9uOiBjb21tYW5kLmRpc2FtYmlndWF0aW9uID8/IFtdIH0pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRyZXR1cm4gYWNjO1xuXHRcdH0sIFtdKTtcblxuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVQYXJ0aWNpcGFudERldGVjdGlvbihyZXF1ZXN0LCBoaXN0b3J5LCB7IC4uLm9wdGlvbnMsIHBhcnRpY2lwYW50cyB9LCB0b2tlbik7XG5cdFx0aWYgKCFyZXN1bHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuZ2V0QWdlbnQocmVzdWx0LnBhcnRpY2lwYW50KTtcblx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHQvLyBDb3VsZG4ndCBmaW5kIGEgcGFydGljaXBhbnQgbWF0Y2hpbmcgdGhlIHBhcnRpY2lwYW50IGRldGVjdGlvbiByZXN1bHRcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAoIXJlc3VsdC5jb21tYW5kKSB7XG5cdFx0XHRyZXR1cm4geyBhZ2VudCB9O1xuXHRcdH1cblxuXHRcdGNvbnN0IGNvbW1hbmQgPSBhZ2VudD8uc2xhc2hDb21tYW5kcy5maW5kKGMgPT4gYy5uYW1lID09PSByZXN1bHQuY29tbWFuZCk7XG5cdFx0aWYgKCFjb21tYW5kKSB7XG5cdFx0XHQvLyBDb3VsZG4ndCBmaW5kIGEgc2xhc2ggY29tbWFuZCBtYXRjaGluZyB0aGUgcGFydGljaXBhbnQgZGV0ZWN0aW9uIHJlc3VsdFxuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHJldHVybiB7IGFnZW50LCBjb21tYW5kIH07XG5cdH1cbn1cblxuZXhwb3J0IGNsYXNzIE1lcmdlZENoYXRBZ2VudCBpbXBsZW1lbnRzIElDaGF0QWdlbnQge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGRhdGE6IElDaGF0QWdlbnREYXRhLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgaW1wbDogSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uXG5cdCkgeyB9XG5cdHdoZW4/OiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHB1Ymxpc2hlckRpc3BsYXlOYW1lPzogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRpc0R5bmFtaWM/OiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXG5cdGdldCBpZCgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5kYXRhLmlkOyB9XG5cdGdldCBuYW1lKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLmRhdGEubmFtZSA/PyAnJzsgfVxuXHRnZXQgZnVsbE5hbWUoKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuZGF0YS5mdWxsTmFtZSA/PyAnJzsgfVxuXHRnZXQgZGVzY3JpcHRpb24oKTogc3RyaW5nIHsgcmV0dXJuIHRoaXMuZGF0YS5kZXNjcmlwdGlvbiA/PyAnJzsgfVxuXHRnZXQgZXh0ZW5zaW9uSWQoKTogRXh0ZW5zaW9uSWRlbnRpZmllciB7IHJldHVybiB0aGlzLmRhdGEuZXh0ZW5zaW9uSWQ7IH1cblx0Z2V0IGV4dGVuc2lvblB1Ymxpc2hlcklkKCk6IHN0cmluZyB7IHJldHVybiB0aGlzLmRhdGEuZXh0ZW5zaW9uUHVibGlzaGVySWQ7IH1cblx0Z2V0IGV4dGVuc2lvblB1Ymxpc2hlckRpc3BsYXlOYW1lKCkgeyByZXR1cm4gdGhpcy5kYXRhLnB1Ymxpc2hlckRpc3BsYXlOYW1lOyB9XG5cdGdldCBleHRlbnNpb25EaXNwbGF5TmFtZSgpOiBzdHJpbmcgeyByZXR1cm4gdGhpcy5kYXRhLmV4dGVuc2lvbkRpc3BsYXlOYW1lOyB9XG5cdGdldCBpc0RlZmF1bHQoKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLmRhdGEuaXNEZWZhdWx0OyB9XG5cdGdldCBpc1Rvb2xzQWdlbnQoKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLmRhdGEuaXNUb29sc0FnZW50OyB9XG5cdGdldCBpc0NvcmUoKTogYm9vbGVhbiB8IHVuZGVmaW5lZCB7IHJldHVybiB0aGlzLmRhdGEuaXNDb3JlOyB9XG5cdGdldCBtZXRhZGF0YSgpOiBJQ2hhdEFnZW50TWV0YWRhdGEgeyByZXR1cm4gdGhpcy5kYXRhLm1ldGFkYXRhOyB9XG5cdGdldCBzbGFzaENvbW1hbmRzKCk6IElDaGF0QWdlbnRDb21tYW5kW10geyByZXR1cm4gdGhpcy5kYXRhLnNsYXNoQ29tbWFuZHM7IH1cblx0Z2V0IGxvY2F0aW9ucygpOiBDaGF0QWdlbnRMb2NhdGlvbltdIHsgcmV0dXJuIHRoaXMuZGF0YS5sb2NhdGlvbnM7IH1cblx0Z2V0IGRpc2FtYmlndWF0aW9uKCk6IHsgY2F0ZWdvcnk6IHN0cmluZzsgZGVzY3JpcHRpb246IHN0cmluZzsgZXhhbXBsZXM6IHN0cmluZ1tdIH1bXSB7IHJldHVybiB0aGlzLmRhdGEuZGlzYW1iaWd1YXRpb247IH1cblxuXHRhc3luYyBpbnZva2UocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHByb2dyZXNzOiAocGFydDogSUNoYXRQcm9ncmVzcykgPT4gdm9pZCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0QWdlbnRSZXN1bHQ+IHtcblx0XHRyZXR1cm4gdGhpcy5pbXBsLmludm9rZShyZXF1ZXN0LCBwcm9ncmVzcywgaGlzdG9yeSwgdG9rZW4pO1xuXHR9XG5cblx0c2V0UmVxdWVzdFBhdXNlZChyZXF1ZXN0SWQ6IHN0cmluZywgaXNQYXVzZWQ6IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pbXBsLnNldFJlcXVlc3RQYXVzZWQpIHtcblx0XHRcdHRoaXMuaW1wbC5zZXRSZXF1ZXN0UGF1c2VkKHJlcXVlc3RJZCwgaXNQYXVzZWQpO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVGb2xsb3d1cHMocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCwgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0Rm9sbG93dXBbXT4ge1xuXHRcdGlmICh0aGlzLmltcGwucHJvdmlkZUZvbGxvd3Vwcykge1xuXHRcdFx0cmV0dXJuIHRoaXMuaW1wbC5wcm92aWRlRm9sbG93dXBzKHJlcXVlc3QsIHJlc3VsdCwgaGlzdG9yeSwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiBbXTtcblx0fVxuXG5cdHByb3ZpZGVXZWxjb21lTWVzc2FnZSh0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm92aWRlclJlc3VsdDxJQ2hhdFdlbGNvbWVNZXNzYWdlQ29udGVudCB8IHVuZGVmaW5lZD4ge1xuXHRcdGlmICh0aGlzLmltcGwucHJvdmlkZVdlbGNvbWVNZXNzYWdlKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5pbXBsLnByb3ZpZGVXZWxjb21lTWVzc2FnZSh0b2tlbik7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHByb3ZpZGVTYW1wbGVRdWVzdGlvbnMobG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm92aWRlclJlc3VsdDxJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAodGhpcy5pbXBsLnByb3ZpZGVTYW1wbGVRdWVzdGlvbnMpIHtcblx0XHRcdHJldHVybiB0aGlzLmltcGwucHJvdmlkZVNhbXBsZVF1ZXN0aW9ucyhsb2NhdGlvbiwgdG9rZW4pO1xuXHRcdH1cblxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHR0b0pTT04oKTogSUNoYXRBZ2VudERhdGEge1xuXHRcdHJldHVybiB0aGlzLmRhdGE7XG5cdH1cbn1cblxuZXhwb3J0IGNvbnN0IElDaGF0QWdlbnROYW1lU2VydmljZSA9IGNyZWF0ZURlY29yYXRvcjxJQ2hhdEFnZW50TmFtZVNlcnZpY2U+KCdjaGF0QWdlbnROYW1lU2VydmljZScpO1xuXG50eXBlIElDaGF0UGFydGljaXBhbnRSZWdpc3RyeSA9IHsgW25hbWU6IHN0cmluZ106IHN0cmluZ1tdIH07XG5cbmludGVyZmFjZSBJQ2hhdFBhcnRpY2lwYW50UmVnaXN0cnlSZXNwb25zZSB7XG5cdHJlYWRvbmx5IHZlcnNpb246IG51bWJlcjtcblx0cmVhZG9ubHkgcmVzdHJpY3RlZENoYXRQYXJ0aWNpcGFudHM6IElDaGF0UGFydGljaXBhbnRSZWdpc3RyeTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEFnZW50TmFtZVNlcnZpY2Uge1xuXHRfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cdGdldEFnZW50TmFtZVJlc3RyaWN0aW9uKGNoYXRBZ2VudERhdGE6IElDaGF0QWdlbnREYXRhKTogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRBZ2VudE5hbWVTZXJ2aWNlIGltcGxlbWVudHMgSUNoYXRBZ2VudE5hbWVTZXJ2aWNlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBTdG9yYWdlS2V5ID0gJ2NoYXQucGFydGljaXBhbnROYW1lUmVnaXN0cnknO1xuXG5cdGRlY2xhcmUgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgdXJsITogc3RyaW5nO1xuXHRwcml2YXRlIHJlZ2lzdHJ5ID0gb2JzZXJ2YWJsZVZhbHVlPElDaGF0UGFydGljaXBhbnRSZWdpc3RyeT4odGhpcywgT2JqZWN0LmNyZWF0ZShudWxsKSk7XG5cdHByaXZhdGUgZGlzcG9zZWQgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASVByb2R1Y3RTZXJ2aWNlIHByb2R1Y3RTZXJ2aWNlOiBJUHJvZHVjdFNlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcXVlc3RTZXJ2aWNlOiBJUmVxdWVzdFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2Vcblx0KSB7XG5cdFx0aWYgKCFwcm9kdWN0U2VydmljZS5jaGF0UGFydGljaXBhbnRSZWdpc3RyeSkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdHRoaXMudXJsID0gcHJvZHVjdFNlcnZpY2UuY2hhdFBhcnRpY2lwYW50UmVnaXN0cnk7XG5cblx0XHRjb25zdCByYXcgPSBzdG9yYWdlU2VydmljZS5nZXQoQ2hhdEFnZW50TmFtZVNlcnZpY2UuU3RvcmFnZUtleSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OKTtcblxuXHRcdHRyeSB7XG5cdFx0XHR0aGlzLnJlZ2lzdHJ5LnNldChKU09OLnBhcnNlKHJhdyA/PyAne30nKSwgdW5kZWZpbmVkKTtcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHN0b3JhZ2VTZXJ2aWNlLnJlbW92ZShDaGF0QWdlbnROYW1lU2VydmljZS5TdG9yYWdlS2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04pO1xuXHRcdH1cblxuXHRcdHRoaXMucmVmcmVzaCgpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWZyZXNoKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmRpc3Bvc2VkKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0dGhpcy51cGRhdGUoKVxuXHRcdFx0LmNhdGNoKGVyciA9PiB0aGlzLmxvZ1NlcnZpY2Uud2FybignRmFpbGVkIHRvIGZldGNoIGNoYXQgcGFydGljaXBhbnQgcmVnaXN0cnknLCBlcnIpKVxuXHRcdFx0LnRoZW4oKCkgPT4gdGltZW91dCg1ICogNjAgKiAxMDAwKSkgLy8gZXZlcnkgNSBtaW51dGVzXG5cdFx0XHQudGhlbigoKSA9PiB0aGlzLnJlZnJlc2goKSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHVwZGF0ZSgpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBjb250ZXh0ID0gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHsgdHlwZTogJ0dFVCcsIHVybDogdGhpcy51cmwgfSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRpZiAoY29udGV4dC5yZXMuc3RhdHVzQ29kZSAhPT0gMjAwKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ0NvdWxkIG5vdCBnZXQgZXh0ZW5zaW9ucyByZXBvcnQuJyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgYXNKc29uPElDaGF0UGFydGljaXBhbnRSZWdpc3RyeVJlc3BvbnNlPihjb250ZXh0KTtcblxuXHRcdGlmICghcmVzdWx0IHx8IHJlc3VsdC52ZXJzaW9uICE9PSAxKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VuZXhwZWN0ZWQgY2hhdCBwYXJ0aWNpcGFudCByZWdpc3RyeSByZXNwb25zZS4nKTtcblx0XHR9XG5cblx0XHRjb25zdCByZWdpc3RyeSA9IHJlc3VsdC5yZXN0cmljdGVkQ2hhdFBhcnRpY2lwYW50cztcblx0XHR0aGlzLnJlZ2lzdHJ5LnNldChyZWdpc3RyeSwgdW5kZWZpbmVkKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKENoYXRBZ2VudE5hbWVTZXJ2aWNlLlN0b3JhZ2VLZXksIEpTT04uc3RyaW5naWZ5KHJlZ2lzdHJ5KSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgdHJ1ZSBpZiB0aGUgYWdlbnQgaXMgYWxsb3dlZCB0byB1c2UgdGhpcyBuYW1lXG5cdCAqL1xuXHRnZXRBZ2VudE5hbWVSZXN0cmljdGlvbihjaGF0QWdlbnREYXRhOiBJQ2hhdEFnZW50RGF0YSk6IGJvb2xlYW4ge1xuXHRcdGlmIChjaGF0QWdlbnREYXRhLmlzQ29yZSkge1xuXHRcdFx0cmV0dXJuIHRydWU7IC8vIGNvcmUgYWdlbnRzIGFyZSBhbHdheXMgYWxsb3dlZCB0byB1c2UgYW55IG5hbWVcblx0XHR9XG5cblx0XHQvLyBUT0RPIHdvdWxkIGxpa2UgdG8gdXNlIG9ic2VydmFibGVzIGhlcmUgYnV0IG5vdGhpbmcgdXNlcyBpdCBkb3duc3RyZWFtIGFuZCBJJ20gbm90IHN1cmUgaG93IHRvIGNvbWJpbmUgdGhlc2UgdHdvXG5cdFx0Y29uc3QgbmFtZUFsbG93ZWQgPSB0aGlzLmNoZWNrQWdlbnROYW1lUmVzdHJpY3Rpb24oY2hhdEFnZW50RGF0YS5uYW1lLCBjaGF0QWdlbnREYXRhKS5nZXQoKTtcblx0XHRjb25zdCBmdWxsTmFtZUFsbG93ZWQgPSAhY2hhdEFnZW50RGF0YS5mdWxsTmFtZSB8fCB0aGlzLmNoZWNrQWdlbnROYW1lUmVzdHJpY3Rpb24oY2hhdEFnZW50RGF0YS5mdWxsTmFtZS5yZXBsYWNlKC9cXHMvZywgJycpLCBjaGF0QWdlbnREYXRhKS5nZXQoKTtcblx0XHRyZXR1cm4gbmFtZUFsbG93ZWQgJiYgZnVsbE5hbWVBbGxvd2VkO1xuXHR9XG5cblx0cHJpdmF0ZSBjaGVja0FnZW50TmFtZVJlc3RyaWN0aW9uKG5hbWU6IHN0cmluZywgY2hhdEFnZW50RGF0YTogSUNoYXRBZ2VudERhdGEpOiBJT2JzZXJ2YWJsZTxib29sZWFuPiB7XG5cdFx0Ly8gUmVnaXN0cnkgaXMgYSBtYXAgb2YgbmFtZSB0byBhbiBhcnJheSBvZiBleHRlbnNpb24gcHVibGlzaGVyIElEcyBvciBleHRlbnNpb24gSURzIHRoYXQgYXJlIGFsbG93ZWQgdG8gdXNlIGl0LlxuXHRcdC8vIExvb2sgdXAgdGhlIGxpc3Qgb2YgZXh0ZW5zaW9ucyB0aGF0IGFyZSBhbGxvd2VkIHRvIHVzZSB0aGlzIG5hbWVcblx0XHRjb25zdCBhbGxvd0xpc3QgPSB0aGlzLnJlZ2lzdHJ5Lm1hcDxzdHJpbmdbXSB8IHVuZGVmaW5lZD4ocmVnaXN0cnkgPT4gcmVnaXN0cnlbbmFtZS50b0xvd2VyQ2FzZSgpXSk7XG5cdFx0cmV0dXJuIGFsbG93TGlzdC5tYXAoYWxsb3dMaXN0ID0+IHtcblx0XHRcdGlmICghYWxsb3dMaXN0KSB7XG5cdFx0XHRcdHJldHVybiB0cnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gYWxsb3dMaXN0LnNvbWUoaWQgPT4gZXF1YWxzSWdub3JlQ2FzZShpZCwgaWQuaW5jbHVkZXMoJy4nKSA/IGNoYXRBZ2VudERhdGEuZXh0ZW5zaW9uSWQudmFsdWUgOiBjaGF0QWdlbnREYXRhLmV4dGVuc2lvblB1Ymxpc2hlcklkKSk7XG5cdFx0fSk7XG5cdH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuZGlzcG9zZWQgPSB0cnVlO1xuXHR9XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBnZXRGdWxseVF1YWxpZmllZElkKGNoYXRBZ2VudERhdGE6IElDaGF0QWdlbnREYXRhKTogc3RyaW5nIHtcblx0cmV0dXJuIGAke2NoYXRBZ2VudERhdGEuZXh0ZW5zaW9uSWQudmFsdWV9LiR7Y2hhdEFnZW50RGF0YS5pZH1gO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gcmV2aXZlU2VyaWFsaXplZEFnZW50KHJhdzogSVNlcmlhbGl6YWJsZUNoYXRBZ2VudERhdGEpOiBJQ2hhdEFnZW50RGF0YSB7XG5cdGNvbnN0IGFnZW50ID0gJ25hbWUnIGluIHJhdyA/XG5cdFx0cmF3IDpcblx0XHR7XG5cdFx0XHQuLi4ocmF3IGFzIGFueSksXG5cdFx0XHRuYW1lOiAocmF3IGFzIGFueSkuaWQsXG5cdFx0fTtcblxuXHQvLyBGaWxsIGluIHJlcXVpcmVkIGZpZWxkcyB0aGF0IG1heSBiZSBtaXNzaW5nIGZyb20gb2xkIGRhdGFcblx0aWYgKCEoJ2V4dGVuc2lvblB1Ymxpc2hlcklkJyBpbiBhZ2VudCkpIHtcblx0XHRhZ2VudC5leHRlbnNpb25QdWJsaXNoZXJJZCA9IGFnZW50LmV4dGVuc2lvblB1Ymxpc2hlciA/PyAnJztcblx0fVxuXG5cdGlmICghKCdleHRlbnNpb25EaXNwbGF5TmFtZScgaW4gYWdlbnQpKSB7XG5cdFx0YWdlbnQuZXh0ZW5zaW9uRGlzcGxheU5hbWUgPSAnJztcblx0fVxuXG5cdGlmICghKCdleHRlbnNpb25JZCcgaW4gYWdlbnQpKSB7XG5cdFx0YWdlbnQuZXh0ZW5zaW9uSWQgPSBuZXcgRXh0ZW5zaW9uSWRlbnRpZmllcignJyk7XG5cdH1cblxuXHRyZXR1cm4gcmV2aXZlKGFnZW50KTtcbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMseUJBQXlCO0FBQ2xD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QUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsR0FkVTtBQThGTixTQUFTLG9CQUFvQixlQUF1QztBQUMxRSxTQUFPLEdBQUcsY0FBYyxZQUFZLEtBQUssSUFBSSxjQUFjLEVBQUU7QUFDOUQ7QUFFTyxTQUFTLHNCQUFzQixLQUFpRDtBQUN0RixRQUFNLFFBQVEsVUFBVSxNQUN2QixNQUNBO0FBQUEsSUFDQyxHQUFJO0FBQUEsSUFDSixNQUFPLElBQVk7QUFBQSxFQUNwQjtBQUdELE1BQUksRUFBRSwwQkFBMEIsUUFBUTtBQUN2QyxVQUFNLHVCQUF1QixNQUFNLHNCQUFzQjtBQUFBLEVBQzFEO0FBRUEsTUFBSSxFQUFFLDBCQUEwQixRQUFRO0FBQ3ZDLFVBQU0sdUJBQXVCO0FBQUEsRUFDOUI7QUFFQSxNQUFJLEVBQUUsaUJBQWlCLFFBQVE7QUFDOUIsVUFBTSxjQUFjLElBQUksb0JBQW9CLEVBQUU7QUFBQSxFQUMvQztBQUVBLFNBQU8sT0FBTyxLQUFLO0FBQ3BCOyIsCiAgIm5hbWVzIjogWyJjb21tYW5kIiwgImFsbG93TGlzdCJdCn0K
