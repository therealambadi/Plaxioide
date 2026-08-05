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
import { DeferredPromise } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { memoize } from "../../../../base/common/decorators.js";
import { toErrorMessage } from "../../../../base/common/errorMessage.js";
import { ErrorNoTelemetry } from "../../../../base/common/errors.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString } from "../../../../base/common/htmlContent.js";
import { Iterable } from "../../../../base/common/iterator.js";
import { Disposable, DisposableMap } from "../../../../base/common/lifecycle.js";
import { revive } from "../../../../base/common/marshalling.js";
import { StopWatch } from "../../../../base/common/stopwatch.js";
import { URI } from "../../../../base/common/uri.js";
import { isLocation } from "../../../../editor/common/languages.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { Progress } from "../../../../platform/progress/common/progress.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IWorkbenchAssignmentService } from "../../../services/assignment/common/assignmentService.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
import { IChatAgentService } from "./chatAgents.js";
import { ChatModel, ChatRequestModel, ChatRequestRemovalReason, normalizeSerializableChatData, toChatHistoryContent, updateRanges } from "./chatModel.js";
import { ChatRequestAgentPart, ChatRequestAgentSubcommandPart, ChatRequestSlashCommandPart, chatAgentLeader, chatSubcommandLeader, getPromptText } from "./chatParserTypes.js";
import { ChatRequestParser } from "./chatRequestParser.js";
import { ChatServiceTelemetry } from "./chatServiceTelemetry.js";
import { ChatSessionStore } from "./chatSessionStore.js";
import { IChatSlashCommandService } from "./chatSlashCommands.js";
import { IChatVariablesService } from "./chatVariables.js";
import { ChatAgentLocation, ChatConfiguration, ChatMode } from "./constants.js";
import { ChatMessageRole } from "./languageModels.js";
import { ILanguageModelToolsService } from "./languageModelToolsService.js";
const serializedChatKey = "interactive.sessions";
const globalChatKey = "chat.workspaceTransfer";
const SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS = 1e3 * 60;
const maxPersistedSessions = 25;
let CancellableRequest = class {
  constructor(cancellationTokenSource, requestId, toolsService) {
    this.cancellationTokenSource = cancellationTokenSource;
    this.requestId = requestId;
    this.toolsService = toolsService;
  }
  dispose() {
    this.cancellationTokenSource.dispose();
  }
  cancel() {
    if (this.requestId) {
      this.toolsService.cancelToolCallsForRequest(this.requestId);
    }
    this.cancellationTokenSource.cancel();
  }
};
CancellableRequest = __decorateClass([
  __decorateParam(2, ILanguageModelToolsService)
], CancellableRequest);
let ChatService = class extends Disposable {
  constructor(storageService, logService, extensionService, instantiationService, telemetryService, workspaceContextService, chatSlashCommandService, chatVariablesService, chatAgentService, configurationService, experimentService) {
    super();
    this.storageService = storageService;
    this.logService = logService;
    this.extensionService = extensionService;
    this.instantiationService = instantiationService;
    this.telemetryService = telemetryService;
    this.workspaceContextService = workspaceContextService;
    this.chatSlashCommandService = chatSlashCommandService;
    this.chatVariablesService = chatVariablesService;
    this.chatAgentService = chatAgentService;
    this.configurationService = configurationService;
    this.experimentService = experimentService;
    this._sessionModels = this._register(new DisposableMap());
    this._pendingRequests = this._register(new DisposableMap());
    /** Just for empty windows, need to enforce that a chat was deleted, even though other windows still have it */
    this._deletedChatIds = /* @__PURE__ */ new Set();
    this._onDidSubmitRequest = this._register(new Emitter());
    this.onDidSubmitRequest = this._onDidSubmitRequest.event;
    this._onDidPerformUserAction = this._register(new Emitter());
    this.onDidPerformUserAction = this._onDidPerformUserAction.event;
    this._onDidDisposeSession = this._register(new Emitter());
    this.onDidDisposeSession = this._onDidDisposeSession.event;
    this._sessionFollowupCancelTokens = this._register(new DisposableMap());
    this._chatServiceTelemetry = this.instantiationService.createInstance(ChatServiceTelemetry);
    const sessionData = storageService.get(serializedChatKey, this.isEmptyWindow ? StorageScope.APPLICATION : StorageScope.WORKSPACE, "");
    if (sessionData) {
      this._persistedSessions = this.deserializeChats(sessionData);
      const countsForLog = Object.keys(this._persistedSessions).length;
      if (countsForLog > 0) {
        this.trace("constructor", `Restored ${countsForLog} persisted sessions`);
      }
    } else {
      this._persistedSessions = {};
    }
    const transferredData = this.getTransferredSessionData();
    const transferredChat = transferredData?.chat;
    if (transferredChat) {
      this.trace("constructor", `Transferred session ${transferredChat.sessionId}`);
      this._persistedSessions[transferredChat.sessionId] = transferredChat;
      this._transferredSessionData = {
        sessionId: transferredChat.sessionId,
        inputValue: transferredData.inputValue,
        location: transferredData.location,
        mode: transferredData.mode
      };
    }
    this._chatSessionStore = this._register(this.instantiationService.createInstance(ChatSessionStore));
    if (this.useFileStorage) {
      this._chatSessionStore.migrateDataIfNeeded(() => this._persistedSessions);
    }
    this._register(storageService.onWillSaveState(() => this.saveState()));
  }
  get transferredSessionData() {
    return this._transferredSessionData;
  }
  get unifiedViewEnabled() {
    return !!this.configurationService.getValue(ChatConfiguration.UnifiedChatView);
  }
  get useFileStorage() {
    return this.configurationService.getValue(ChatConfiguration.UseFileStorage);
  }
  get isEmptyWindow() {
    const workspace = this.workspaceContextService.getWorkspace();
    return !workspace.configuration && workspace.folders.length === 0;
  }
  isEnabled(location) {
    return this.chatAgentService.getContributedDefaultAgent(location) !== void 0;
  }
  saveState() {
    const liveChats = Array.from(this._sessionModels.values()).filter((session) => session.initialLocation === ChatAgentLocation.Panel || session.initialLocation === ChatAgentLocation.EditingSession);
    if (this.useFileStorage) {
      this._chatSessionStore.storeSessions(liveChats);
    } else {
      if (this.isEmptyWindow) {
        this.syncEmptyWindowChats(liveChats);
      } else {
        let allSessions = liveChats;
        allSessions = allSessions.concat(
          Object.values(this._persistedSessions).filter((session) => !this._sessionModels.has(session.sessionId)).filter((session) => session.requests.length)
        );
        allSessions.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));
        let hasPersistedEditSession = false;
        allSessions = allSessions.filter((s) => {
          if (s.initialLocation === ChatAgentLocation.EditingSession) {
            if (hasPersistedEditSession) {
              return false;
            } else {
              hasPersistedEditSession = true;
              return true;
            }
          }
          return true;
        });
        allSessions = allSessions.slice(0, maxPersistedSessions);
        if (allSessions.length) {
          this.trace("onWillSaveState", `Persisting ${allSessions.length} sessions`);
        }
        const serialized = JSON.stringify(allSessions);
        if (allSessions.length) {
          this.trace("onWillSaveState", `Persisting ${serialized.length} chars`);
        }
        this.storageService.store(serializedChatKey, serialized, StorageScope.WORKSPACE, StorageTarget.MACHINE);
      }
    }
    this._deletedChatIds.clear();
  }
  syncEmptyWindowChats(thisWindowChats) {
    const sessionData = this.storageService.get(serializedChatKey, StorageScope.APPLICATION, "");
    const originalPersistedSessions = this._persistedSessions;
    let persistedSessions;
    if (sessionData) {
      persistedSessions = this.deserializeChats(sessionData);
      const countsForLog = Object.keys(persistedSessions).length;
      if (countsForLog > 0) {
        this.trace("constructor", `Restored ${countsForLog} persisted sessions`);
      }
    } else {
      persistedSessions = {};
    }
    this._deletedChatIds.forEach((id) => delete persistedSessions[id]);
    Object.values(originalPersistedSessions).forEach((session) => {
      const persistedSession = persistedSessions[session.sessionId];
      if (persistedSession && session.requests.length > persistedSession.requests.length) {
        persistedSessions[session.sessionId] = session;
      } else if (!persistedSession && session.isNew) {
        session.isNew = false;
        persistedSessions[session.sessionId] = session;
      }
    });
    this._persistedSessions = persistedSessions;
    const allSessions = { ...this._persistedSessions };
    for (const chat of thisWindowChats) {
      allSessions[chat.sessionId] = chat;
    }
    let sessionsList = Object.values(allSessions);
    sessionsList.sort((a, b) => (b.creationDate ?? 0) - (a.creationDate ?? 0));
    sessionsList = sessionsList.slice(0, maxPersistedSessions);
    const data = JSON.stringify(sessionsList);
    this.storageService.store(serializedChatKey, data, StorageScope.APPLICATION, StorageTarget.MACHINE);
  }
  notifyUserAction(action) {
    this._chatServiceTelemetry.notifyUserAction(action);
    this._onDidPerformUserAction.fire(action);
  }
  async setChatSessionTitle(sessionId, title) {
    const model = this._sessionModels.get(sessionId);
    if (model) {
      model.setCustomTitle(title);
      return;
    }
    if (this.useFileStorage) {
      await this._chatSessionStore.setSessionTitle(sessionId, title);
      return;
    }
    const session = this._persistedSessions[sessionId];
    if (session) {
      session.customTitle = title;
    }
  }
  trace(method, message) {
    if (message) {
      this.logService.trace(`ChatService#${method}: ${message}`);
    } else {
      this.logService.trace(`ChatService#${method}`);
    }
  }
  error(method, message) {
    this.logService.error(`ChatService#${method} ${message}`);
  }
  deserializeChats(sessionData) {
    try {
      const arrayOfSessions = revive(JSON.parse(sessionData));
      if (!Array.isArray(arrayOfSessions)) {
        throw new Error("Expected array");
      }
      const sessions = arrayOfSessions.reduce((acc, session) => {
        for (const request of session.requests) {
          if (Array.isArray(request.response)) {
            request.response = request.response.map((response) => {
              if (typeof response === "string") {
                return new MarkdownString(response);
              }
              return response;
            });
          } else if (typeof request.response === "string") {
            request.response = [new MarkdownString(request.response)];
          }
        }
        acc[session.sessionId] = normalizeSerializableChatData(session);
        return acc;
      }, {});
      return sessions;
    } catch (err) {
      this.error("deserializeChats", `Malformed session data: ${err}. [${sessionData.substring(0, 20)}${sessionData.length > 20 ? "..." : ""}]`);
      return {};
    }
  }
  getTransferredSessionData() {
    const data = this.storageService.getObject(globalChatKey, StorageScope.PROFILE, []);
    const workspaceUri = this.workspaceContextService.getWorkspace().folders[0]?.uri;
    if (!workspaceUri) {
      return;
    }
    const thisWorkspace = workspaceUri.toString();
    const currentTime = Date.now();
    const transferred = data.find((item) => URI.revive(item.toWorkspace).toString() === thisWorkspace && currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS);
    const filtered = data.filter((item) => URI.revive(item.toWorkspace).toString() !== thisWorkspace && currentTime - item.timestampInMilliseconds < SESSION_TRANSFER_EXPIRATION_IN_MILLISECONDS);
    this.storageService.store(globalChatKey, JSON.stringify(filtered), StorageScope.PROFILE, StorageTarget.MACHINE);
    return transferred;
  }
  /**
   * Returns an array of chat details for all persisted chat sessions that have at least one request.
   * Chat sessions that have already been loaded into the chat view are excluded from the result.
   * Imported chat sessions are also excluded from the result.
   */
  async getHistory() {
    if (this.useFileStorage) {
      const liveSessionItems2 = Array.from(this._sessionModels.values()).filter((session) => !session.isImported && (session.initialLocation !== ChatAgentLocation.EditingSession || this.unifiedViewEnabled)).map((session) => {
        const title = session.title || localize("newChat", "New Chat");
        return {
          sessionId: session.sessionId,
          title,
          lastMessageDate: session.lastMessageDate,
          isActive: true
        };
      });
      const index = await this._chatSessionStore.getIndex();
      const entries = Object.values(index).filter((entry) => !this._sessionModels.has(entry.sessionId) && !entry.isImported && !entry.isEmpty).map((entry) => ({
        ...entry,
        isActive: this._sessionModels.has(entry.sessionId)
      }));
      return [...liveSessionItems2, ...entries];
    }
    const persistedSessions = Object.values(this._persistedSessions).filter((session) => session.requests.length > 0).filter((session) => !this._sessionModels.has(session.sessionId));
    const persistedSessionItems = persistedSessions.filter((session) => !session.isImported && session.initialLocation !== ChatAgentLocation.EditingSession).map((session) => {
      const title = session.customTitle ?? ChatModel.getDefaultTitle(session.requests);
      return {
        sessionId: session.sessionId,
        title,
        lastMessageDate: session.lastMessageDate,
        isActive: false
      };
    });
    const liveSessionItems = Array.from(this._sessionModels.values()).filter((session) => !session.isImported && session.initialLocation !== ChatAgentLocation.EditingSession).map((session) => {
      const title = session.title || localize("newChat", "New Chat");
      return {
        sessionId: session.sessionId,
        title,
        lastMessageDate: session.lastMessageDate,
        isActive: true
      };
    });
    return [...liveSessionItems, ...persistedSessionItems];
  }
  async removeHistoryEntry(sessionId) {
    if (this.useFileStorage) {
      await this._chatSessionStore.deleteSession(sessionId);
      return;
    }
    if (this._persistedSessions[sessionId]) {
      this._deletedChatIds.add(sessionId);
      delete this._persistedSessions[sessionId];
      this.saveState();
    }
  }
  async clearAllHistoryEntries() {
    if (this.useFileStorage) {
      await this._chatSessionStore.clearAllSessions();
      return;
    }
    Object.values(this._persistedSessions).forEach((session) => this._deletedChatIds.add(session.sessionId));
    this._persistedSessions = {};
    this.saveState();
  }
  startSession(location, token, isGlobalEditingSession = true) {
    this.trace("startSession");
    return this._startSession(void 0, location, isGlobalEditingSession, token);
  }
  _startSession(someSessionHistory, location, isGlobalEditingSession, token) {
    const model = this.instantiationService.createInstance(ChatModel, someSessionHistory, location);
    if (location === ChatAgentLocation.EditingSession || this.unifiedViewEnabled && location === ChatAgentLocation.Panel) {
      model.startEditingSession(isGlobalEditingSession);
    }
    this._sessionModels.set(model.sessionId, model);
    this.initializeSession(model, token);
    return model;
  }
  async initializeSession(model, token) {
    try {
      this.trace("initializeSession", `Initialize session ${model.sessionId}`);
      model.startInitialize();
      await this.extensionService.whenInstalledExtensionsRegistered();
      const defaultAgentData = this.chatAgentService.getContributedDefaultAgent(model.initialLocation) ?? this.chatAgentService.getContributedDefaultAgent(ChatAgentLocation.Panel);
      if (!defaultAgentData) {
        throw new ErrorNoTelemetry("No default agent contributed");
      }
      if (this.configurationService.getValue("chat.setupFromDialog")) {
        this.extensionService.activateByEvent(`onChatParticipant:${defaultAgentData.id}`);
      } else {
        await this.extensionService.activateByEvent(`onChatParticipant:${defaultAgentData.id}`);
        const defaultAgent = this.chatAgentService.getActivatedAgents().find((agent) => agent.id === defaultAgentData.id);
        if (!defaultAgent) {
          throw new ErrorNoTelemetry("No default agent registered");
        }
      }
      model.initialize();
    } catch (err) {
      this.trace("startSession", `initializeSession failed: ${err}`);
      model.setInitializationError(err);
      this._sessionModels.deleteAndDispose(model.sessionId);
      this._onDidDisposeSession.fire({ sessionId: model.sessionId, reason: "initializationFailed" });
    }
  }
  getSession(sessionId) {
    return this._sessionModels.get(sessionId);
  }
  async getOrRestoreSession(sessionId) {
    this.trace("getOrRestoreSession", `sessionId: ${sessionId}`);
    const model = this._sessionModels.get(sessionId);
    if (model) {
      return model;
    }
    let sessionData;
    if (this.useFileStorage) {
      sessionData = revive(await this._chatSessionStore.readSession(sessionId));
    } else {
      sessionData = revive(this._persistedSessions[sessionId]);
    }
    if (!sessionData) {
      return void 0;
    }
    const session = this._startSession(sessionData, sessionData.initialLocation ?? ChatAgentLocation.Panel, true, CancellationToken.None);
    const isTransferred = this.transferredSessionData?.sessionId === sessionId;
    if (isTransferred) {
      this._transferredSessionData = void 0;
    }
    return session;
  }
  /**
   * This is really just for migrating data from the edit session location to the panel.
   */
  isPersistedSessionEmpty(sessionId) {
    const session = this._persistedSessions[sessionId];
    if (session) {
      return session.requests.length === 0;
    }
    return this._chatSessionStore.isSessionEmpty(sessionId);
  }
  loadSessionFromContent(data) {
    return this._startSession(data, data.initialLocation ?? ChatAgentLocation.Panel, true, CancellationToken.None);
  }
  async resendRequest(request, options) {
    const model = this._sessionModels.get(request.session.sessionId);
    if (!model && model !== request.session) {
      throw new Error(`Unknown session: ${request.session.sessionId}`);
    }
    await model.waitForInitialization();
    const cts = this._pendingRequests.get(request.session.sessionId);
    if (cts) {
      this.trace("resendRequest", `Session ${request.session.sessionId} already has a pending request, cancelling...`);
      cts.cancel();
    }
    const location = options?.location ?? model.initialLocation;
    const attempt = options?.attempt ?? 0;
    const enableCommandDetection = !options?.noCommandDetection;
    const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.mode);
    model.removeRequest(request.id, ChatRequestRemovalReason.Resend);
    const resendOptions = {
      ...options,
      locationData: request.locationData,
      attachedContext: request.attachedContext,
      hasInstructionAttachments: options?.hasInstructionAttachments ?? false
    };
    await this._sendRequestAsync(model, model.sessionId, request.message, attempt, enableCommandDetection, defaultAgent, location, resendOptions).responseCompletePromise;
  }
  async sendRequest(sessionId, request, options) {
    this.trace("sendRequest", `sessionId: ${sessionId}, message: ${request.substring(0, 20)}${request.length > 20 ? "[...]" : ""}}`);
    if (!request.trim() && options?.hasInstructionAttachments) {
      request = "Follow these instructions.";
    }
    if (!request.trim() && !options?.slashCommand && !options?.agentId && !options?.hasInstructionAttachments) {
      this.trace("sendRequest", "Rejected empty message");
      return;
    }
    const model = this._sessionModels.get(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    await model.waitForInitialization();
    if (this._pendingRequests.has(sessionId)) {
      this.trace("sendRequest", `Session ${sessionId} already has a pending request`);
      return;
    }
    const requests = model.getRequests();
    for (let i = requests.length - 1; i >= 0; i -= 1) {
      const request2 = requests[i];
      if (request2.shouldBeRemovedOnSend) {
        if (request2.shouldBeRemovedOnSend.afterUndoStop) {
          request2.response?.finalizeUndoState();
        } else {
          this.removeRequest(sessionId, request2.id);
        }
      }
    }
    const location = options?.location ?? model.initialLocation;
    const attempt = options?.attempt ?? 0;
    const defaultAgent = this.chatAgentService.getDefaultAgent(location, options?.mode);
    const parsedRequest = this.parseChatRequest(sessionId, request, location, options);
    const agent = parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart)?.agent ?? defaultAgent;
    const agentSlashCommandPart = parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
    return {
      ...this._sendRequestAsync(model, sessionId, parsedRequest, attempt, !options?.noCommandDetection, defaultAgent, location, options),
      agent,
      slashCommand: agentSlashCommandPart?.command
    };
  }
  parseChatRequest(sessionId, request, location, options) {
    let parserContext = options?.parserContext;
    if (options?.agentId) {
      const agent = this.chatAgentService.getAgent(options.agentId);
      if (!agent) {
        throw new Error(`Unknown agent: ${options.agentId}`);
      }
      parserContext = { selectedAgent: agent, mode: options.mode };
      const commandPart = options.slashCommand ? ` ${chatSubcommandLeader}${options.slashCommand}` : "";
      request = `${chatAgentLeader}${agent.name}${commandPart} ${request}`;
    }
    const parsedRequest = this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionId, request, location, parserContext);
    return parsedRequest;
  }
  refreshFollowupsCancellationToken(sessionId) {
    this._sessionFollowupCancelTokens.get(sessionId)?.cancel();
    const newTokenSource = new CancellationTokenSource();
    this._sessionFollowupCancelTokens.set(sessionId, newTokenSource);
    return newTokenSource.token;
  }
  _sendRequestAsync(model, sessionId, parsedRequest, attempt, enableCommandDetection, defaultAgent, location, options) {
    const followupsCancelToken = this.refreshFollowupsCancellationToken(sessionId);
    let request;
    const agentPart = "kind" in parsedRequest ? void 0 : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentPart);
    const agentSlashCommandPart = "kind" in parsedRequest ? void 0 : parsedRequest.parts.find((r) => r instanceof ChatRequestAgentSubcommandPart);
    const commandPart = "kind" in parsedRequest ? void 0 : parsedRequest.parts.find((r) => r instanceof ChatRequestSlashCommandPart);
    const requests = [...model.getRequests()];
    let gotProgress = false;
    const requestType = commandPart ? "slashCommand" : "string";
    const responseCreated = new DeferredPromise();
    let responseCreatedComplete = false;
    function completeResponseCreated() {
      if (!responseCreatedComplete && request?.response) {
        responseCreated.complete(request.response);
        responseCreatedComplete = true;
      }
    }
    const source = new CancellationTokenSource();
    const token = source.token;
    const sendRequestInternal = async () => {
      const progressCallback = (progress) => {
        if (token.isCancellationRequested) {
          return;
        }
        gotProgress = true;
        if (progress.kind === "markdownContent") {
          this.trace("sendRequest", `Provider returned progress for session ${model.sessionId}, ${progress.content.value.length} chars`);
        } else {
          this.trace("sendRequest", `Provider returned progress: ${JSON.stringify(progress)}`);
        }
        model.acceptResponseProgress(request, progress);
        completeResponseCreated();
      };
      let detectedAgent;
      let detectedCommand;
      const stopWatch = new StopWatch(false);
      const listener = token.onCancellationRequested(() => {
        this.trace("sendRequest", `Request for session ${model.sessionId} was cancelled`);
        this.telemetryService.publicLog2("interactiveSessionProviderInvoked", {
          timeToFirstProgress: void 0,
          // Normally timings happen inside the EH around the actual provider. For cancellation we can measure how long the user waited before cancelling
          totalTime: stopWatch.elapsed(),
          result: "cancelled",
          requestType,
          agent: detectedAgent?.id ?? agentPart?.agent.id ?? "",
          agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? "",
          slashCommand: agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command,
          chatSessionId: model.sessionId,
          location,
          citations: request?.response?.codeCitations.length ?? 0,
          numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? "").length,
          isParticipantDetected: !!detectedAgent,
          enableCommandDetection,
          attachmentKinds: this.attachmentKindsForTelemetry(request.variableData)
        });
        model.cancelRequest(request);
      });
      try {
        let rawResult;
        let agentOrCommandFollowups = void 0;
        let chatTitlePromise;
        if (agentPart || defaultAgent && !commandPart) {
          const prepareChatAgentRequest = async (agent2, command2, enableCommandDetection2, chatRequest, isParticipantDetected) => {
            const initVariableData = { variables: [] };
            request = chatRequest ?? model.addRequest(parsedRequest, initVariableData, attempt, agent2, command2, options?.confirmation, options?.locationData, options?.attachedContext, void 0, options?.userSelectedModelId);
            let variableData;
            let message;
            if (chatRequest) {
              variableData = chatRequest.variableData;
              message = getPromptText(request.message).message;
            } else {
              variableData = this.chatVariablesService.resolveVariables(parsedRequest, request.attachedContext);
              model.updateRequest(request, variableData);
              const promptTextResult = getPromptText(request.message);
              variableData = updateRanges(variableData, promptTextResult.diff);
              message = promptTextResult.message;
            }
            return {
              sessionId,
              requestId: request.id,
              agentId: agent2.id,
              message,
              command: command2?.name,
              variables: variableData,
              enableCommandDetection: enableCommandDetection2,
              isParticipantDetected,
              attempt,
              location,
              locationData: request.locationData,
              acceptedConfirmationData: options?.acceptedConfirmationData,
              rejectedConfirmationData: options?.rejectedConfirmationData,
              userSelectedModelId: options?.userSelectedModelId,
              userSelectedTools: options?.userSelectedTools
            };
          };
          if (this.configurationService.getValue("chat.detectParticipant.enabled") !== false && this.chatAgentService.hasChatParticipantDetectionProviders() && !agentPart && !commandPart && !agentSlashCommandPart && enableCommandDetection && options?.mode !== ChatMode.Agent && options?.mode !== ChatMode.Edit) {
            const defaultAgentHistory = this.getHistoryEntriesFromModel(requests, model.sessionId, location, defaultAgent.id);
            const chatAgentRequest = await prepareChatAgentRequest(defaultAgent, void 0, enableCommandDetection, void 0, false);
            const result = await this.chatAgentService.detectAgentOrCommand(chatAgentRequest, defaultAgentHistory, { location }, token);
            if (result && this.chatAgentService.getAgent(result.agent.id)?.locations?.includes(location)) {
              request.response?.setAgent(result.agent, result.command);
              detectedAgent = result.agent;
              detectedCommand = result.command;
            }
          }
          const agent = detectedAgent ?? agentPart?.agent ?? defaultAgent;
          const command = detectedCommand ?? agentSlashCommandPart?.command;
          await this.extensionService.activateByEvent(`onChatParticipant:${agent.id}`);
          await this.checkAgentAllowed(agent);
          const history = this.getHistoryEntriesFromModel(requests, model.sessionId, location, agent.id);
          const requestProps = await prepareChatAgentRequest(agent, command, enableCommandDetection, request, !!detectedAgent);
          const pendingRequest = this._pendingRequests.get(sessionId);
          if (pendingRequest && !pendingRequest.requestId) {
            pendingRequest.requestId = requestProps.requestId;
          }
          completeResponseCreated();
          const agentResult = await this.chatAgentService.invokeAgent(agent.id, requestProps, progressCallback, history, token);
          rawResult = agentResult;
          agentOrCommandFollowups = this.chatAgentService.getFollowups(agent.id, requestProps, agentResult, history, followupsCancelToken);
          chatTitlePromise = model.getRequests().length === 1 && !model.customTitle ? this.chatAgentService.getChatTitle(defaultAgent.id, this.getHistoryEntriesFromModel(model.getRequests(), model.sessionId, location, agent.id), CancellationToken.None) : void 0;
        } else if (commandPart && this.chatSlashCommandService.hasCommand(commandPart.slashCommand.command)) {
          request = model.addRequest(parsedRequest, { variables: [] }, attempt);
          completeResponseCreated();
          const history = [];
          for (const request2 of model.getRequests()) {
            if (!request2.response) {
              continue;
            }
            history.push({ role: ChatMessageRole.User, content: [{ type: "text", value: request2.message.text }] });
            history.push({ role: ChatMessageRole.Assistant, content: [{ type: "text", value: request2.response.response.toString() }] });
          }
          const message = parsedRequest.text;
          const commandResult = await this.chatSlashCommandService.executeCommand(commandPart.slashCommand.command, message.substring(commandPart.slashCommand.command.length + 1).trimStart(), new Progress((p) => {
            progressCallback(p);
          }), history, location, token);
          agentOrCommandFollowups = Promise.resolve(commandResult?.followUp);
          rawResult = {};
        } else {
          throw new Error(`Cannot handle request`);
        }
        if (token.isCancellationRequested) {
          return;
        } else {
          if (!rawResult) {
            this.trace("sendRequest", `Provider returned no response for session ${model.sessionId}`);
            rawResult = { errorDetails: { message: localize("emptyResponse", "Provider returned null response") } };
          }
          const result = rawResult.errorDetails?.responseIsFiltered ? "filtered" : rawResult.errorDetails && gotProgress ? "errorWithOutput" : rawResult.errorDetails ? "error" : "success";
          const commandForTelemetry = agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command;
          this.telemetryService.publicLog2("interactiveSessionProviderInvoked", {
            timeToFirstProgress: rawResult.timings?.firstProgress,
            totalTime: rawResult.timings?.totalElapsed,
            result,
            requestType,
            agent: detectedAgent?.id ?? agentPart?.agent.id ?? "",
            agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? "",
            slashCommand: commandForTelemetry,
            chatSessionId: model.sessionId,
            enableCommandDetection,
            isParticipantDetected: !!detectedAgent,
            location,
            citations: request.response?.codeCitations.length ?? 0,
            numCodeBlocks: getCodeBlocks(request.response?.response.toString() ?? "").length,
            attachmentKinds: this.attachmentKindsForTelemetry(request.variableData)
          });
          model.setResponse(request, rawResult);
          completeResponseCreated();
          this.trace("sendRequest", `Provider returned response for session ${model.sessionId}`);
          model.completeResponse(request);
          if (agentOrCommandFollowups) {
            agentOrCommandFollowups.then((followups) => {
              model.setFollowups(request, followups);
              this._chatServiceTelemetry.retrievedFollowups(agentPart?.agent.id ?? "", commandForTelemetry, followups?.length ?? 0);
            });
          }
          chatTitlePromise?.then((title) => {
            if (title) {
              model.setCustomTitle(title);
            }
          });
        }
      } catch (err) {
        const result = "error";
        this.telemetryService.publicLog2("interactiveSessionProviderInvoked", {
          timeToFirstProgress: void 0,
          totalTime: void 0,
          result,
          requestType,
          agent: detectedAgent?.id ?? agentPart?.agent.id ?? "",
          agentExtensionId: detectedAgent?.extensionId.value ?? agentPart?.agent.extensionId.value ?? "",
          slashCommand: agentSlashCommandPart ? agentSlashCommandPart.command.name : commandPart?.slashCommand.command,
          chatSessionId: model.sessionId,
          location,
          citations: 0,
          numCodeBlocks: 0,
          enableCommandDetection,
          isParticipantDetected: !!detectedAgent,
          attachmentKinds: this.attachmentKindsForTelemetry(request.variableData)
        });
        this.logService.error(`Error while handling chat request: ${toErrorMessage(err, true)}`);
        if (request) {
          const rawResult = { errorDetails: { message: err.message } };
          model.setResponse(request, rawResult);
          completeResponseCreated();
          model.completeResponse(request);
        }
      } finally {
        listener.dispose();
      }
    };
    const rawResponsePromise = sendRequestInternal();
    this._pendingRequests.set(model.sessionId, this.instantiationService.createInstance(CancellableRequest, source, void 0));
    rawResponsePromise.finally(() => {
      this._pendingRequests.deleteAndDispose(model.sessionId);
    });
    this._onDidSubmitRequest.fire({ chatSessionId: model.sessionId });
    return {
      responseCreatedPromise: responseCreated.p,
      responseCompletePromise: rawResponsePromise
    };
  }
  async checkAgentAllowed(agent) {
    if (agent.isToolsAgent) {
      const enabled = await this.experimentService.getTreatment("chatAgentEnabled");
      if (enabled === false) {
        throw new Error("Agent is currently disabled");
      }
    }
  }
  attachmentKindsForTelemetry(variableData) {
    return variableData.variables.map((v) => {
      if (v.kind === "implicit") {
        return "implicit";
      } else if (v.range) {
        if (v.isTool) {
          return "toolInPrompt";
        } else {
          return "fileInPrompt";
        }
      } else if (v.kind === "command") {
        return "command";
      } else if (v.kind === "symbol") {
        return "symbol";
      } else if (v.isImage) {
        return "image";
      } else if (v.isDirectory) {
        return "directory";
      } else if (v.isTool) {
        return "tool";
      } else {
        if (URI.isUri(v.value)) {
          return "file";
        } else if (isLocation(v.value)) {
          return "location";
        } else {
          return "otherAttachment";
        }
      }
    });
  }
  getHistoryEntriesFromModel(requests, sessionId, location, forAgentId) {
    const history = [];
    const agent = this.chatAgentService.getAgent(forAgentId);
    for (const request of requests) {
      if (!request.response) {
        continue;
      }
      if (forAgentId !== request.response.agent?.id && !agent?.isDefault) {
        continue;
      }
      const promptTextResult = getPromptText(request.message);
      const historyRequest = {
        sessionId,
        requestId: request.id,
        agentId: request.response.agent?.id ?? "",
        message: promptTextResult.message,
        command: request.response.slashCommand?.name,
        variables: updateRanges(request.variableData, promptTextResult.diff),
        // TODO bit of a hack
        location: ChatAgentLocation.Panel
      };
      history.push({ request: historyRequest, response: toChatHistoryContent(request.response.response.value), result: request.response.result ?? {} });
    }
    return history;
  }
  async removeRequest(sessionId, requestId) {
    const model = this._sessionModels.get(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    await model.waitForInitialization();
    const pendingRequest = this._pendingRequests.get(sessionId);
    if (pendingRequest?.requestId === requestId) {
      pendingRequest.cancel();
      this._pendingRequests.deleteAndDispose(sessionId);
    }
    model.removeRequest(requestId);
  }
  async adoptRequest(sessionId, request) {
    if (!(request instanceof ChatRequestModel)) {
      throw new TypeError("Can only adopt requests of type ChatRequestModel");
    }
    const target = this._sessionModels.get(sessionId);
    if (!target) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    await target.waitForInitialization();
    const oldOwner = request.session;
    target.adoptRequest(request);
    if (request.response && !request.response.isComplete) {
      const cts = this._pendingRequests.deleteAndLeak(oldOwner.sessionId);
      if (cts) {
        cts.requestId = request.id;
        this._pendingRequests.set(target.sessionId, cts);
      }
    }
  }
  async addCompleteRequest(sessionId, message, variableData, attempt, response) {
    this.trace("addCompleteRequest", `message: ${message}`);
    const model = this._sessionModels.get(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    await model.waitForInitialization();
    const parsedRequest = typeof message === "string" ? this.instantiationService.createInstance(ChatRequestParser).parseChatRequest(sessionId, message) : message;
    const request = model.addRequest(parsedRequest, variableData || { variables: [] }, attempt ?? 0, void 0, void 0, void 0, void 0, void 0, true);
    if (typeof response.message === "string") {
      model.acceptResponseProgress(request, { content: new MarkdownString(response.message), kind: "markdownContent" });
    } else {
      for (const part of response.message) {
        model.acceptResponseProgress(request, part, true);
      }
    }
    model.setResponse(request, response.result || {});
    if (response.followups !== void 0) {
      model.setFollowups(request, response.followups);
    }
    model.completeResponse(request);
  }
  cancelCurrentRequestForSession(sessionId) {
    this.trace("cancelCurrentRequestForSession", `sessionId: ${sessionId}`);
    this._pendingRequests.get(sessionId)?.cancel();
    this._pendingRequests.deleteAndDispose(sessionId);
  }
  async clearSession(sessionId) {
    this.trace("clearSession", `sessionId: ${sessionId}`);
    const model = this._sessionModels.get(sessionId);
    if (!model) {
      throw new Error(`Unknown session: ${sessionId}`);
    }
    if (model.initialLocation === ChatAgentLocation.Panel) {
      if (this.useFileStorage) {
        if (model.getRequests().length === 0) {
          await this._chatSessionStore.deleteSession(sessionId);
        } else {
          await this._chatSessionStore.storeSessions([model]);
        }
      } else {
        if (model.getRequests().length === 0) {
          delete this._persistedSessions[sessionId];
        } else {
          const sessionData = JSON.parse(JSON.stringify(model));
          sessionData.isNew = true;
          this._persistedSessions[sessionId] = sessionData;
        }
      }
    }
    this._sessionModels.deleteAndDispose(sessionId);
    this._pendingRequests.get(sessionId)?.cancel();
    this._pendingRequests.deleteAndDispose(sessionId);
    this._onDidDisposeSession.fire({ sessionId, reason: "cleared" });
  }
  hasSessions() {
    if (this.useFileStorage) {
      return this._chatSessionStore.hasSessions();
    } else {
      return Object.values(this._persistedSessions).length > 0;
    }
  }
  transferChatSession(transferredSessionData, toWorkspace) {
    const model = Iterable.find(this._sessionModels.values(), (model2) => model2.sessionId === transferredSessionData.sessionId);
    if (!model) {
      throw new Error(`Failed to transfer session. Unknown session ID: ${transferredSessionData.sessionId}`);
    }
    const existingRaw = this.storageService.getObject(globalChatKey, StorageScope.PROFILE, []);
    existingRaw.push({
      chat: model.toJSON(),
      timestampInMilliseconds: Date.now(),
      toWorkspace,
      inputValue: transferredSessionData.inputValue,
      location: transferredSessionData.location,
      mode: transferredSessionData.mode
    });
    this.storageService.store(globalChatKey, JSON.stringify(existingRaw), StorageScope.PROFILE, StorageTarget.MACHINE);
    this.trace("transferChatSession", `Transferred session ${model.sessionId} to workspace ${toWorkspace.toString()}`);
  }
  isEditingLocation(location) {
    return location === ChatAgentLocation.EditingSession || this.unifiedViewEnabled;
  }
  getChatStorageFolder() {
    return this._chatSessionStore.getChatStorageFolder();
  }
  logChatIndex() {
    this._chatSessionStore.logIndex();
  }
};
__decorateClass([
  memoize
], ChatService.prototype, "unifiedViewEnabled", 1);
__decorateClass([
  memoize
], ChatService.prototype, "useFileStorage", 1);
ChatService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, ILogService),
  __decorateParam(2, IExtensionService),
  __decorateParam(3, IInstantiationService),
  __decorateParam(4, ITelemetryService),
  __decorateParam(5, IWorkspaceContextService),
  __decorateParam(6, IChatSlashCommandService),
  __decorateParam(7, IChatVariablesService),
  __decorateParam(8, IChatAgentService),
  __decorateParam(9, IConfigurationService),
  __decorateParam(10, IWorkbenchAssignmentService)
], ChatService);
function getCodeBlocks(text) {
  const lines = text.split("\n");
  const codeBlockLanguages = [];
  let codeBlockState;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (codeBlockState) {
      if (new RegExp(`^\\s*${codeBlockState.delimiter}\\s*$`).test(line)) {
        codeBlockLanguages.push(codeBlockState.languageId);
        codeBlockState = void 0;
      }
    } else {
      const match = line.match(/^(\s*)(`{3,}|~{3,})(\w*)/);
      if (match) {
        codeBlockState = { delimiter: match[2], languageId: match[3] };
      }
    }
  }
  return codeBlockLanguages;
}
export {
  ChatService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZUltcGwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEZWZlcnJlZFByb21pc2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBDYW5jZWxsYXRpb25Ub2tlbiwgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgbWVtb2l6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2RlY29yYXRvcnMuanMnO1xuaW1wb3J0IHsgdG9FcnJvck1lc3NhZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvck1lc3NhZ2UuanMnO1xuaW1wb3J0IHsgRXJyb3JOb1RlbGVtZXRyeSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2Vycm9ycy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IE1hcmtkb3duU3RyaW5nIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaHRtbENvbnRlbnQuanMnO1xuaW1wb3J0IHsgSXRlcmFibGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9pdGVyYXRvci5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBTdG9wV2F0Y2ggfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdG9wd2F0Y2guanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGlzTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBsb2NhbGl6ZSB9IGZyb20gJy4uLy4uLy4uLy4uL25scy5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBQcm9ncmVzcyB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3Byb2dyZXNzL2NvbW1vbi9wcm9ncmVzcy5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS93b3Jrc3BhY2UvY29tbW9uL3dvcmtzcGFjZS5qcyc7XG5pbXBvcnQgeyBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9zZXJ2aWNlcy9hc3NpZ25tZW50L2NvbW1vbi9hc3NpZ25tZW50U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudCwgSUNoYXRBZ2VudENvbW1hbmQsIElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5LCBJQ2hhdEFnZW50UmVxdWVzdCwgSUNoYXRBZ2VudFJlc3VsdCwgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGVsLCBDaGF0UmVxdWVzdE1vZGVsLCBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24sIElDaGF0TW9kZWwsIElDaGF0UmVxdWVzdE1vZGVsLCBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEsIElDaGF0UmVzcG9uc2VNb2RlbCwgSUV4cG9ydGFibGVDaGF0RGF0YSwgSVNlcmlhbGl6YWJsZUNoYXREYXRhLCBJU2VyaWFsaXphYmxlQ2hhdERhdGFJbiwgSVNlcmlhbGl6YWJsZUNoYXRzRGF0YSwgbm9ybWFsaXplU2VyaWFsaXphYmxlQ2hhdERhdGEsIHRvQ2hhdEhpc3RvcnlDb250ZW50LCB1cGRhdGVSYW5nZXMgfSBmcm9tICcuL2NoYXRNb2RlbC5qcyc7XG5pbXBvcnQgeyBDaGF0UmVxdWVzdEFnZW50UGFydCwgQ2hhdFJlcXVlc3RBZ2VudFN1YmNvbW1hbmRQYXJ0LCBDaGF0UmVxdWVzdFNsYXNoQ29tbWFuZFBhcnQsIElQYXJzZWRDaGF0UmVxdWVzdCwgY2hhdEFnZW50TGVhZGVyLCBjaGF0U3ViY29tbWFuZExlYWRlciwgZ2V0UHJvbXB0VGV4dCB9IGZyb20gJy4vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRSZXF1ZXN0UGFyc2VyIH0gZnJvbSAnLi9jaGF0UmVxdWVzdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbXBsZXRlUmVzcG9uc2UsIElDaGF0RGV0YWlsLCBJQ2hhdEZvbGxvd3VwLCBJQ2hhdFByb2dyZXNzLCBJQ2hhdFNlbmRSZXF1ZXN0RGF0YSwgSUNoYXRTZW5kUmVxdWVzdE9wdGlvbnMsIElDaGF0U2VuZFJlcXVlc3RSZXNwb25zZVN0YXRlLCBJQ2hhdFNlcnZpY2UsIElDaGF0VHJhbnNmZXJyZWRTZXNzaW9uRGF0YSwgSUNoYXRVc2VyQWN0aW9uRXZlbnQgfSBmcm9tICcuL2NoYXRTZXJ2aWNlLmpzJztcbmltcG9ydCB7IENoYXRTZXJ2aWNlVGVsZW1ldHJ5IH0gZnJvbSAnLi9jaGF0U2VydmljZVRlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBDaGF0U2Vzc2lvblN0b3JlLCBJQ2hhdFRyYW5zZmVyMiB9IGZyb20gJy4vY2hhdFNlc3Npb25TdG9yZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgfSBmcm9tICcuL2NoYXRTbGFzaENvbW1hbmRzLmpzJztcbmltcG9ydCB7IElDaGF0VmFyaWFibGVzU2VydmljZSB9IGZyb20gJy4vY2hhdFZhcmlhYmxlcy5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiwgQ2hhdENvbmZpZ3VyYXRpb24sIENoYXRNb2RlIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuaW1wb3J0IHsgQ2hhdE1lc3NhZ2VSb2xlLCBJQ2hhdE1lc3NhZ2UgfSBmcm9tICcuL2xhbmd1YWdlTW9kZWxzLmpzJztcbmltcG9ydCB7IElMYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi9sYW5ndWFnZU1vZGVsVG9vbHNTZXJ2aWNlLmpzJztcblxuY29uc3Qgc2VyaWFsaXplZENoYXRLZXkgPSAnaW50ZXJhY3RpdmUuc2Vzc2lvbnMnO1xuXG5jb25zdCBnbG9iYWxDaGF0S2V5ID0gJ2NoYXQud29ya3NwYWNlVHJhbnNmZXInO1xuXG5jb25zdCBTRVNTSU9OX1RSQU5TRkVSX0VYUElSQVRJT05fSU5fTUlMTElTRUNPTkRTID0gMTAwMCAqIDYwO1xuXG50eXBlIENoYXRQcm92aWRlckludm9rZWRFdmVudCA9IHtcblx0dGltZVRvRmlyc3RQcm9ncmVzczogbnVtYmVyIHwgdW5kZWZpbmVkO1xuXHR0b3RhbFRpbWU6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cmVzdWx0OiAnc3VjY2VzcycgfCAnZXJyb3InIHwgJ2Vycm9yV2l0aE91dHB1dCcgfCAnY2FuY2VsbGVkJyB8ICdmaWx0ZXJlZCc7XG5cdHJlcXVlc3RUeXBlOiAnc3RyaW5nJyB8ICdmb2xsb3d1cCcgfCAnc2xhc2hDb21tYW5kJztcblx0Y2hhdFNlc3Npb25JZDogc3RyaW5nO1xuXHRhZ2VudDogc3RyaW5nO1xuXHRhZ2VudEV4dGVuc2lvbklkOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHNsYXNoQ29tbWFuZDogc3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247XG5cdGNpdGF0aW9uczogbnVtYmVyO1xuXHRudW1Db2RlQmxvY2tzOiBudW1iZXI7XG5cdGlzUGFydGljaXBhbnREZXRlY3RlZDogYm9vbGVhbjtcblx0ZW5hYmxlQ29tbWFuZERldGVjdGlvbjogYm9vbGVhbjtcblx0YXR0YWNobWVudEtpbmRzOiBzdHJpbmdbXTtcbn07XG5cbnR5cGUgQ2hhdFByb3ZpZGVySW52b2tlZENsYXNzaWZpY2F0aW9uID0ge1xuXHR0aW1lVG9GaXJzdFByb2dyZXNzOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnUGVyZm9ybWFuY2VBbmRIZWFsdGgnOyBjb21tZW50OiAnVGhlIHRpbWUgaW4gbWlsbGlzZWNvbmRzIGZyb20gaW52b2tpbmcgdGhlIHByb3ZpZGVyIHRvIGdldHRpbmcgdGhlIGZpcnN0IGRhdGEuJyB9O1xuXHR0b3RhbFRpbWU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdQZXJmb3JtYW5jZUFuZEhlYWx0aCc7IGNvbW1lbnQ6ICdUaGUgdG90YWwgdGltZSBpdCB0b29rIHRvIHJ1biB0aGUgcHJvdmlkZXJcXCdzIGBwcm92aWRlUmVzcG9uc2VXaXRoUHJvZ3Jlc3NgLicgfTtcblx0cmVzdWx0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnV2hldGhlciBpbnZva2luZyB0aGUgQ2hhdFByb3ZpZGVyIHJlc3VsdGVkIGluIGFuIGVycm9yLicgfTtcblx0cmVxdWVzdFR5cGU6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiByZXF1ZXN0IHRoYXQgdGhlIHVzZXIgbWFkZS4nIH07XG5cdGNoYXRTZXNzaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdBIHJhbmRvbSBJRCBmb3IgdGhlIHNlc3Npb24uJyB9O1xuXHRhZ2VudDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSB0eXBlIG9mIGFnZW50IHVzZWQuJyB9O1xuXHRhZ2VudEV4dGVuc2lvbklkOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGV4dGVuc2lvbiB0aGF0IGNvbnRyaWJ1dGVkIHRoZSBhZ2VudC4nIH07XG5cdHNsYXNoQ29tbWFuZD86IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgdHlwZSBvZiBzbGFzaENvbW1hbmQgdXNlZC4nIH07XG5cdGxvY2F0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGxvY2F0aW9uIGF0IHdoaWNoIGNoYXQgcmVxdWVzdCB3YXMgbWFkZS4nIH07XG5cdGNpdGF0aW9uczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgcHVibGljIGNvZGUgY2l0YXRpb25zIHRoYXQgd2VyZSByZXR1cm5lZCB3aXRoIHRoZSByZXNwb25zZS4nIH07XG5cdG51bUNvZGVCbG9ja3M6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgbnVtYmVyIG9mIGNvZGUgYmxvY2tzIGluIHRoZSByZXNwb25zZS4nIH07XG5cdGlzUGFydGljaXBhbnREZXRlY3RlZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgdGhlIHBhcnRpY2lwYW50IHdhcyBhdXRvbWF0aWNhbGx5IGRldGVjdGVkLicgfTtcblx0ZW5hYmxlQ29tbWFuZERldGVjdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1doZXRoZXIgcGFydGljaXBhdGlvbiBkZXRlY3Rpb24gd2FzIGRpc2FibGVkIGZvciB0aGlzIGludm9jYXRpb24uJyB9O1xuXHRhdHRhY2htZW50S2luZHM6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgdHlwZXMgb2YgdmFyaWFibGVzL2F0dGFjaG1lbnRzIHRoYXQgdGhlIHVzZXIgaW5jbHVkZWQgd2l0aCB0aGVpciBxdWVyeS4nIH07XG5cdG93bmVyOiAncm9ibG91cmVucyc7XG5cdGNvbW1lbnQ6ICdQcm92aWRlcyBpbnNpZ2h0IGludG8gdGhlIHBlcmZvcm1hbmNlIG9mIENoYXQgYWdlbnRzLic7XG59O1xuXG5jb25zdCBtYXhQZXJzaXN0ZWRTZXNzaW9ucyA9IDI1O1xuXG5jbGFzcyBDYW5jZWxsYWJsZVJlcXVlc3QgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBjYW5jZWxsYXRpb25Ub2tlblNvdXJjZTogQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UsXG5cdFx0cHVibGljIHJlcXVlc3RJZDogc3RyaW5nIHwgdW5kZWZpbmVkLFxuXHRcdEBJTGFuZ3VhZ2VNb2RlbFRvb2xzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRvb2xzU2VydmljZTogSUxhbmd1YWdlTW9kZWxUb29sc1NlcnZpY2Vcblx0KSB7IH1cblxuXHRkaXNwb3NlKCkge1xuXHRcdHRoaXMuY2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UuZGlzcG9zZSgpO1xuXHR9XG5cblx0Y2FuY2VsKCkge1xuXHRcdGlmICh0aGlzLnJlcXVlc3RJZCkge1xuXHRcdFx0dGhpcy50b29sc1NlcnZpY2UuY2FuY2VsVG9vbENhbGxzRm9yUmVxdWVzdCh0aGlzLnJlcXVlc3RJZCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5jYW5jZWxsYXRpb25Ub2tlblNvdXJjZS5jYW5jZWwoKTtcblx0fVxufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRTZXJ2aWNlIHtcblx0ZGVjbGFyZSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbk1vZGVscyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZywgQ2hhdE1vZGVsPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ1JlcXVlc3RzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8c3RyaW5nLCBDYW5jZWxsYWJsZVJlcXVlc3Q+KCkpO1xuXHRwcml2YXRlIF9wZXJzaXN0ZWRTZXNzaW9uczogSVNlcmlhbGl6YWJsZUNoYXRzRGF0YTtcblxuXHQvKiogSnVzdCBmb3IgZW1wdHkgd2luZG93cywgbmVlZCB0byBlbmZvcmNlIHRoYXQgYSBjaGF0IHdhcyBkZWxldGVkLCBldmVuIHRob3VnaCBvdGhlciB3aW5kb3dzIHN0aWxsIGhhdmUgaXQgKi9cblx0cHJpdmF0ZSBfZGVsZXRlZENoYXRJZHMgPSBuZXcgU2V0PHN0cmluZz4oKTtcblxuXHRwcml2YXRlIF90cmFuc2ZlcnJlZFNlc3Npb25EYXRhOiBJQ2hhdFRyYW5zZmVycmVkU2Vzc2lvbkRhdGEgfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgdHJhbnNmZXJyZWRTZXNzaW9uRGF0YSgpOiBJQ2hhdFRyYW5zZmVycmVkU2Vzc2lvbkRhdGEgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl90cmFuc2ZlcnJlZFNlc3Npb25EYXRhO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRTdWJtaXRSZXF1ZXN0ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8eyBjaGF0U2Vzc2lvbklkOiBzdHJpbmcgfT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFN1Ym1pdFJlcXVlc3Q6IEV2ZW50PHsgY2hhdFNlc3Npb25JZDogc3RyaW5nIH0+ID0gdGhpcy5fb25EaWRTdWJtaXRSZXF1ZXN0LmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkUGVyZm9ybVVzZXJBY3Rpb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxJQ2hhdFVzZXJBY3Rpb25FdmVudD4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZFBlcmZvcm1Vc2VyQWN0aW9uOiBFdmVudDxJQ2hhdFVzZXJBY3Rpb25FdmVudD4gPSB0aGlzLl9vbkRpZFBlcmZvcm1Vc2VyQWN0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZVNlc3Npb24gPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx7IHNlc3Npb25JZDogc3RyaW5nOyByZWFzb246ICdpbml0aWFsaXphdGlvbkZhaWxlZCcgfCAnY2xlYXJlZCcgfT4oKSk7XG5cdHB1YmxpYyByZWFkb25seSBvbkRpZERpc3Bvc2VTZXNzaW9uID0gdGhpcy5fb25EaWREaXNwb3NlU2Vzc2lvbi5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uRm9sbG93dXBDYW5jZWxUb2tlbnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxzdHJpbmcsIENhbmNlbGxhdGlvblRva2VuU291cmNlPigpKTtcblx0cHJpdmF0ZSByZWFkb25seSBfY2hhdFNlcnZpY2VUZWxlbWV0cnk6IENoYXRTZXJ2aWNlVGVsZW1ldHJ5O1xuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGF0U2Vzc2lvblN0b3JlOiBDaGF0U2Vzc2lvblN0b3JlO1xuXG5cdEBtZW1vaXplXG5cdHB1YmxpYyBnZXQgdW5pZmllZFZpZXdFbmFibGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiAhIXRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWUoQ2hhdENvbmZpZ3VyYXRpb24uVW5pZmllZENoYXRWaWV3KTtcblx0fVxuXG5cdEBtZW1vaXplXG5cdHByaXZhdGUgZ2V0IHVzZUZpbGVTdG9yYWdlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKENoYXRDb25maWd1cmF0aW9uLlVzZUZpbGVTdG9yYWdlKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0IGlzRW1wdHlXaW5kb3coKTogYm9vbGVhbiB7XG5cdFx0Y29uc3Qgd29ya3NwYWNlID0gdGhpcy53b3Jrc3BhY2VDb250ZXh0U2VydmljZS5nZXRXb3Jrc3BhY2UoKTtcblx0XHRyZXR1cm4gIXdvcmtzcGFjZS5jb25maWd1cmF0aW9uICYmIHdvcmtzcGFjZS5mb2xkZXJzLmxlbmd0aCA9PT0gMDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBzdG9yYWdlU2VydmljZTogSVN0b3JhZ2VTZXJ2aWNlLFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvblNlcnZpY2U6IElFeHRlbnNpb25TZXJ2aWNlLFxuXHRcdEBJSW5zdGFudGlhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJVGVsZW1ldHJ5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHRlbGVtZXRyeVNlcnZpY2U6IElUZWxlbWV0cnlTZXJ2aWNlLFxuXHRcdEBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB3b3Jrc3BhY2VDb250ZXh0U2VydmljZTogSVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNsYXNoQ29tbWFuZFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0U2xhc2hDb21tYW5kU2VydmljZTogSUNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFZhcmlhYmxlc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0VmFyaWFibGVzU2VydmljZTogSUNoYXRWYXJpYWJsZXNTZXJ2aWNlLFxuXHRcdEBJQ2hhdEFnZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJQ29uZmlndXJhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjb25maWd1cmF0aW9uU2VydmljZTogSUNvbmZpZ3VyYXRpb25TZXJ2aWNlLFxuXHRcdEBJV29ya2JlbmNoQXNzaWdubWVudFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHBlcmltZW50U2VydmljZTogSVdvcmtiZW5jaEFzc2lnbm1lbnRTZXJ2aWNlLFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5fY2hhdFNlcnZpY2VUZWxlbWV0cnkgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRTZXJ2aWNlVGVsZW1ldHJ5KTtcblxuXHRcdGNvbnN0IHNlc3Npb25EYXRhID0gc3RvcmFnZVNlcnZpY2UuZ2V0KHNlcmlhbGl6ZWRDaGF0S2V5LCB0aGlzLmlzRW1wdHlXaW5kb3cgPyBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04gOiBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCAnJyk7XG5cdFx0aWYgKHNlc3Npb25EYXRhKSB7XG5cdFx0XHR0aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucyA9IHRoaXMuZGVzZXJpYWxpemVDaGF0cyhzZXNzaW9uRGF0YSk7XG5cdFx0XHRjb25zdCBjb3VudHNGb3JMb2cgPSBPYmplY3Qua2V5cyh0aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucykubGVuZ3RoO1xuXHRcdFx0aWYgKGNvdW50c0ZvckxvZyA+IDApIHtcblx0XHRcdFx0dGhpcy50cmFjZSgnY29uc3RydWN0b3InLCBgUmVzdG9yZWQgJHtjb3VudHNGb3JMb2d9IHBlcnNpc3RlZCBzZXNzaW9uc2ApO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucyA9IHt9O1xuXHRcdH1cblxuXHRcdGNvbnN0IHRyYW5zZmVycmVkRGF0YSA9IHRoaXMuZ2V0VHJhbnNmZXJyZWRTZXNzaW9uRGF0YSgpO1xuXHRcdGNvbnN0IHRyYW5zZmVycmVkQ2hhdCA9IHRyYW5zZmVycmVkRGF0YT8uY2hhdDtcblx0XHRpZiAodHJhbnNmZXJyZWRDaGF0KSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdjb25zdHJ1Y3RvcicsIGBUcmFuc2ZlcnJlZCBzZXNzaW9uICR7dHJhbnNmZXJyZWRDaGF0LnNlc3Npb25JZH1gKTtcblx0XHRcdHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zW3RyYW5zZmVycmVkQ2hhdC5zZXNzaW9uSWRdID0gdHJhbnNmZXJyZWRDaGF0O1xuXHRcdFx0dGhpcy5fdHJhbnNmZXJyZWRTZXNzaW9uRGF0YSA9IHtcblx0XHRcdFx0c2Vzc2lvbklkOiB0cmFuc2ZlcnJlZENoYXQuc2Vzc2lvbklkLFxuXHRcdFx0XHRpbnB1dFZhbHVlOiB0cmFuc2ZlcnJlZERhdGEuaW5wdXRWYWx1ZSxcblx0XHRcdFx0bG9jYXRpb246IHRyYW5zZmVycmVkRGF0YS5sb2NhdGlvbixcblx0XHRcdFx0bW9kZTogdHJhbnNmZXJyZWREYXRhLm1vZGUsXG5cdFx0XHR9O1xuXHRcdH1cblxuXHRcdHRoaXMuX2NoYXRTZXNzaW9uU3RvcmUgPSB0aGlzLl9yZWdpc3Rlcih0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRTZXNzaW9uU3RvcmUpKTtcblx0XHRpZiAodGhpcy51c2VGaWxlU3RvcmFnZSkge1xuXHRcdFx0dGhpcy5fY2hhdFNlc3Npb25TdG9yZS5taWdyYXRlRGF0YUlmTmVlZGVkKCgpID0+IHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zKTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihzdG9yYWdlU2VydmljZS5vbldpbGxTYXZlU3RhdGUoKCkgPT4gdGhpcy5zYXZlU3RhdGUoKSkpO1xuXHR9XG5cblx0aXNFbmFibGVkKGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbik6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0Q29udHJpYnV0ZWREZWZhdWx0QWdlbnQobG9jYXRpb24pICE9PSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIHNhdmVTdGF0ZSgpOiB2b2lkIHtcblx0XHRjb25zdCBsaXZlQ2hhdHMgPSBBcnJheS5mcm9tKHRoaXMuX3Nlc3Npb25Nb2RlbHMudmFsdWVzKCkpXG5cdFx0XHQuZmlsdGVyKHNlc3Npb24gPT4gc2Vzc2lvbi5pbml0aWFsTG9jYXRpb24gPT09IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsIHx8IHNlc3Npb24uaW5pdGlhbExvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbik7XG5cblx0XHRpZiAodGhpcy51c2VGaWxlU3RvcmFnZSkge1xuXHRcdFx0dGhpcy5fY2hhdFNlc3Npb25TdG9yZS5zdG9yZVNlc3Npb25zKGxpdmVDaGF0cyk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGlmICh0aGlzLmlzRW1wdHlXaW5kb3cpIHtcblx0XHRcdFx0dGhpcy5zeW5jRW1wdHlXaW5kb3dDaGF0cyhsaXZlQ2hhdHMpO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0bGV0IGFsbFNlc3Npb25zOiAoQ2hhdE1vZGVsIHwgSVNlcmlhbGl6YWJsZUNoYXREYXRhKVtdID0gbGl2ZUNoYXRzO1xuXHRcdFx0XHRhbGxTZXNzaW9ucyA9IGFsbFNlc3Npb25zLmNvbmNhdChcblx0XHRcdFx0XHRPYmplY3QudmFsdWVzKHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zKVxuXHRcdFx0XHRcdFx0LmZpbHRlcihzZXNzaW9uID0+ICF0aGlzLl9zZXNzaW9uTW9kZWxzLmhhcyhzZXNzaW9uLnNlc3Npb25JZCkpXG5cdFx0XHRcdFx0XHQuZmlsdGVyKHNlc3Npb24gPT4gc2Vzc2lvbi5yZXF1ZXN0cy5sZW5ndGgpKTtcblx0XHRcdFx0YWxsU2Vzc2lvbnMuc29ydCgoYSwgYikgPT4gKGIuY3JlYXRpb25EYXRlID8/IDApIC0gKGEuY3JlYXRpb25EYXRlID8/IDApKTtcblxuXHRcdFx0XHQvLyBPbmx5IGtlZXAgb25lIHBlcnNpc3RlZCBlZGl0IHNlc3Npb24sIHRoZSBsYXRlc3Qgb25lLiBUaGlzIHdvdWxkIGJlIHRoZSBjdXJyZW50IG9uZSBpZiBpdCdzIGxpdmUuXG5cdFx0XHRcdC8vIE5vIHdheSB0byBrbm93IHdoZXRoZXIgaXQncyBjdXJyZW50bHkgbGl2ZSBvciBpZiBpdCBoYXMgYmVlbiBjbGVhcmVkIGFuZCB0aGVyZSBpcyBubyBjdXJyZW50IHNlc3Npb24uXG5cdFx0XHRcdC8vIEJ1dCBlbnN1cmUgdGhhdCB3ZSBkb24ndCBzdG9yZSBtdWx0aXBsZSBlZGl0IHNlc3Npb25zLlxuXHRcdFx0XHRsZXQgaGFzUGVyc2lzdGVkRWRpdFNlc3Npb24gPSBmYWxzZTtcblx0XHRcdFx0YWxsU2Vzc2lvbnMgPSBhbGxTZXNzaW9ucy5maWx0ZXIocyA9PiB7XG5cdFx0XHRcdFx0aWYgKHMuaW5pdGlhbExvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbikge1xuXHRcdFx0XHRcdFx0aWYgKGhhc1BlcnNpc3RlZEVkaXRTZXNzaW9uKSB7XG5cdFx0XHRcdFx0XHRcdHJldHVybiBmYWxzZTtcblx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdGhhc1BlcnNpc3RlZEVkaXRTZXNzaW9uID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdGFsbFNlc3Npb25zID0gYWxsU2Vzc2lvbnMuc2xpY2UoMCwgbWF4UGVyc2lzdGVkU2Vzc2lvbnMpO1xuXG5cdFx0XHRcdGlmIChhbGxTZXNzaW9ucy5sZW5ndGgpIHtcblx0XHRcdFx0XHR0aGlzLnRyYWNlKCdvbldpbGxTYXZlU3RhdGUnLCBgUGVyc2lzdGluZyAke2FsbFNlc3Npb25zLmxlbmd0aH0gc2Vzc2lvbnNgKTtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHNlcmlhbGl6ZWQgPSBKU09OLnN0cmluZ2lmeShhbGxTZXNzaW9ucyk7XG5cblx0XHRcdFx0aWYgKGFsbFNlc3Npb25zLmxlbmd0aCkge1xuXHRcdFx0XHRcdHRoaXMudHJhY2UoJ29uV2lsbFNhdmVTdGF0ZScsIGBQZXJzaXN0aW5nICR7c2VyaWFsaXplZC5sZW5ndGh9IGNoYXJzYCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKHNlcmlhbGl6ZWRDaGF0S2V5LCBzZXJpYWxpemVkLCBTdG9yYWdlU2NvcGUuV09SS1NQQUNFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHRcdFx0fVxuXG5cdFx0fVxuXG5cdFx0dGhpcy5fZGVsZXRlZENoYXRJZHMuY2xlYXIoKTtcblx0fVxuXG5cdHByaXZhdGUgc3luY0VtcHR5V2luZG93Q2hhdHModGhpc1dpbmRvd0NoYXRzOiBDaGF0TW9kZWxbXSk6IHZvaWQge1xuXHRcdC8vIE5vdGUtIGFuIHVuYXZvaWRhYmxlIHJhY2UgY29uZGl0aW9uIGV4aXN0cyBoZXJlLiBJZiB0aGVyZSBhcmUgbXVsdGlwbGUgZW1wdHkgd2luZG93cyBvcGVuLCBhbmQgdGhlIHVzZXIgcXVpdHMgdGhlIGFwcGxpY2F0aW9uLCB0aGVuIHRoZSBmb2N1c2VkXG5cdFx0Ly8gd2luZG93IG1heSBsb3NlIGFjdGl2ZSBjaGF0cywgYmVjYXVzZSBhbGwgd2luZG93cyBhcmUgcmVhZGluZyBhbmQgd3JpdGluZyB0byBzdG9yYWdlU2VydmljZSBhdCB0aGUgc2FtZSB0aW1lLiBUaGlzIGNhbid0IGJlIGZpeGVkIHdpdGhvdXQgc29tZVxuXHRcdC8vIGtpbmQgb2YgbG9ja2luZywgYnV0IGluIHJlYWxpdHksIHRoZSBmb2N1c2VkIHdpbmRvdyB3aWxsIGxpa2VseSBoYXZlIHJ1biBgc2F2ZVN0YXRlYCBhdCBzb21lIHBvaW50LCBsaWtlIG9uIGEgd2luZG93IGZvY3VzIGNoYW5nZSwgYW5kIGl0IHdpbGxcblx0XHQvLyBnZW5lcmFsbHkgYmUgZmluZS5cblx0XHRjb25zdCBzZXNzaW9uRGF0YSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0KHNlcmlhbGl6ZWRDaGF0S2V5LCBTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sICcnKTtcblxuXHRcdGNvbnN0IG9yaWdpbmFsUGVyc2lzdGVkU2Vzc2lvbnMgPSB0aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucztcblx0XHRsZXQgcGVyc2lzdGVkU2Vzc2lvbnM6IElTZXJpYWxpemFibGVDaGF0c0RhdGE7XG5cdFx0aWYgKHNlc3Npb25EYXRhKSB7XG5cdFx0XHRwZXJzaXN0ZWRTZXNzaW9ucyA9IHRoaXMuZGVzZXJpYWxpemVDaGF0cyhzZXNzaW9uRGF0YSk7XG5cdFx0XHRjb25zdCBjb3VudHNGb3JMb2cgPSBPYmplY3Qua2V5cyhwZXJzaXN0ZWRTZXNzaW9ucykubGVuZ3RoO1xuXHRcdFx0aWYgKGNvdW50c0ZvckxvZyA+IDApIHtcblx0XHRcdFx0dGhpcy50cmFjZSgnY29uc3RydWN0b3InLCBgUmVzdG9yZWQgJHtjb3VudHNGb3JMb2d9IHBlcnNpc3RlZCBzZXNzaW9uc2ApO1xuXHRcdFx0fVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRwZXJzaXN0ZWRTZXNzaW9ucyA9IHt9O1xuXHRcdH1cblxuXHRcdHRoaXMuX2RlbGV0ZWRDaGF0SWRzLmZvckVhY2goaWQgPT4gZGVsZXRlIHBlcnNpc3RlZFNlc3Npb25zW2lkXSk7XG5cblx0XHQvLyBIYXMgdGhlIGNoYXQgaW4gdGhpcyB3aW5kb3cgYmVlbiB1cGRhdGVkLCBhbmQgdGhlbiBjbG9zZWQ/IE92ZXJ3cml0ZSB0aGUgb2xkIHBlcnNpc3RlZCBjaGF0cy5cblx0XHRPYmplY3QudmFsdWVzKG9yaWdpbmFsUGVyc2lzdGVkU2Vzc2lvbnMpLmZvckVhY2goc2Vzc2lvbiA9PiB7XG5cdFx0XHRjb25zdCBwZXJzaXN0ZWRTZXNzaW9uID0gcGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbi5zZXNzaW9uSWRdO1xuXHRcdFx0aWYgKHBlcnNpc3RlZFNlc3Npb24gJiYgc2Vzc2lvbi5yZXF1ZXN0cy5sZW5ndGggPiBwZXJzaXN0ZWRTZXNzaW9uLnJlcXVlc3RzLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBXZSB3aWxsIGFkZCBhICdtb2RpZmllZCBkYXRlJyBhdCBzb21lIHBvaW50LCBidXQgY29tcGFyaW5nIHRoZSBudW1iZXIgb2YgcmVxdWVzdHMgaXMgZ29vZCBlbm91Z2hcblx0XHRcdFx0cGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbi5zZXNzaW9uSWRdID0gc2Vzc2lvbjtcblx0XHRcdH0gZWxzZSBpZiAoIXBlcnNpc3RlZFNlc3Npb24gJiYgc2Vzc2lvbi5pc05ldykge1xuXHRcdFx0XHQvLyBUaGlzIHNlc3Npb24gd2FzIGNyZWF0ZWQgaW4gdGhpcyB3aW5kb3csIGFuZCBoYXNuJ3QgYmVlbiBwZXJzaXN0ZWQgeWV0XG5cdFx0XHRcdHNlc3Npb24uaXNOZXcgPSBmYWxzZTtcblx0XHRcdFx0cGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbi5zZXNzaW9uSWRdID0gc2Vzc2lvbjtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zID0gcGVyc2lzdGVkU2Vzc2lvbnM7XG5cblx0XHQvLyBBZGQgdGhpcyB3aW5kb3cncyBhY3RpdmUgY2hhdCBtb2RlbHMgdG8gdGhlIHNldCB0byBwZXJzaXN0LlxuXHRcdC8vIEhhdmluZyB0aGUgc2FtZSBzZXNzaW9uIG9wZW4gaW4gdHdvIGVtcHR5IHdpbmRvd3MgYXQgdGhlIHNhbWUgdGltZSBjYW4gbGVhZCB0byBkYXRhIGxvc3MsIHRoaXMgaXMgYWNjZXB0YWJsZVxuXHRcdGNvbnN0IGFsbFNlc3Npb25zOiBSZWNvcmQ8c3RyaW5nLCBJU2VyaWFsaXphYmxlQ2hhdERhdGEgfCBDaGF0TW9kZWw+ID0geyAuLi50aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucyB9O1xuXHRcdGZvciAoY29uc3QgY2hhdCBvZiB0aGlzV2luZG93Q2hhdHMpIHtcblx0XHRcdGFsbFNlc3Npb25zW2NoYXQuc2Vzc2lvbklkXSA9IGNoYXQ7XG5cdFx0fVxuXG5cdFx0bGV0IHNlc3Npb25zTGlzdCA9IE9iamVjdC52YWx1ZXMoYWxsU2Vzc2lvbnMpO1xuXHRcdHNlc3Npb25zTGlzdC5zb3J0KChhLCBiKSA9PiAoYi5jcmVhdGlvbkRhdGUgPz8gMCkgLSAoYS5jcmVhdGlvbkRhdGUgPz8gMCkpO1xuXHRcdHNlc3Npb25zTGlzdCA9IHNlc3Npb25zTGlzdC5zbGljZSgwLCBtYXhQZXJzaXN0ZWRTZXNzaW9ucyk7XG5cdFx0Y29uc3QgZGF0YSA9IEpTT04uc3RyaW5naWZ5KHNlc3Npb25zTGlzdCk7XG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShzZXJpYWxpemVkQ2hhdEtleSwgZGF0YSwgU3RvcmFnZVNjb3BlLkFQUExJQ0FUSU9OLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXHR9XG5cblx0bm90aWZ5VXNlckFjdGlvbihhY3Rpb246IElDaGF0VXNlckFjdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0dGhpcy5fY2hhdFNlcnZpY2VUZWxlbWV0cnkubm90aWZ5VXNlckFjdGlvbihhY3Rpb24pO1xuXHRcdHRoaXMuX29uRGlkUGVyZm9ybVVzZXJBY3Rpb24uZmlyZShhY3Rpb24pO1xuXHR9XG5cblx0YXN5bmMgc2V0Q2hhdFNlc3Npb25UaXRsZShzZXNzaW9uSWQ6IHN0cmluZywgdGl0bGU6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fc2Vzc2lvbk1vZGVscy5nZXQoc2Vzc2lvbklkKTtcblx0XHRpZiAobW9kZWwpIHtcblx0XHRcdG1vZGVsLnNldEN1c3RvbVRpdGxlKHRpdGxlKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy51c2VGaWxlU3RvcmFnZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fY2hhdFNlc3Npb25TdG9yZS5zZXRTZXNzaW9uVGl0bGUoc2Vzc2lvbklkLCB0aXRsZSk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vzc2lvbiA9IHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zW3Nlc3Npb25JZF07XG5cdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdHNlc3Npb24uY3VzdG9tVGl0bGUgPSB0aXRsZTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHRyYWNlKG1ldGhvZDogc3RyaW5nLCBtZXNzYWdlPzogc3RyaW5nKTogdm9pZCB7XG5cdFx0aWYgKG1lc3NhZ2UpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgQ2hhdFNlcnZpY2UjJHttZXRob2R9OiAke21lc3NhZ2V9YCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgQ2hhdFNlcnZpY2UjJHttZXRob2R9YCk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBlcnJvcihtZXRob2Q6IHN0cmluZywgbWVzc2FnZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDaGF0U2VydmljZSMke21ldGhvZH0gJHttZXNzYWdlfWApO1xuXHR9XG5cblx0cHJpdmF0ZSBkZXNlcmlhbGl6ZUNoYXRzKHNlc3Npb25EYXRhOiBzdHJpbmcpOiBJU2VyaWFsaXphYmxlQ2hhdHNEYXRhIHtcblx0XHR0cnkge1xuXHRcdFx0Y29uc3QgYXJyYXlPZlNlc3Npb25zOiBJU2VyaWFsaXphYmxlQ2hhdERhdGFJbltdID0gcmV2aXZlKEpTT04ucGFyc2Uoc2Vzc2lvbkRhdGEpKTsgLy8gUmV2aXZlIHNlcmlhbGl6ZWQgVVJJcyBpbiBzZXNzaW9uIGRhdGFcblx0XHRcdGlmICghQXJyYXkuaXNBcnJheShhcnJheU9mU2Vzc2lvbnMpKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignRXhwZWN0ZWQgYXJyYXknKTtcblx0XHRcdH1cblxuXHRcdFx0Y29uc3Qgc2Vzc2lvbnMgPSBhcnJheU9mU2Vzc2lvbnMucmVkdWNlPElTZXJpYWxpemFibGVDaGF0c0RhdGE+KChhY2MsIHNlc3Npb24pID0+IHtcblx0XHRcdFx0Ly8gUmV2aXZlIHNlcmlhbGl6ZWQgbWFya2Rvd24gc3RyaW5ncyBpbiByZXNwb25zZSBkYXRhXG5cdFx0XHRcdGZvciAoY29uc3QgcmVxdWVzdCBvZiBzZXNzaW9uLnJlcXVlc3RzKSB7XG5cdFx0XHRcdFx0aWYgKEFycmF5LmlzQXJyYXkocmVxdWVzdC5yZXNwb25zZSkpIHtcblx0XHRcdFx0XHRcdHJlcXVlc3QucmVzcG9uc2UgPSByZXF1ZXN0LnJlc3BvbnNlLm1hcCgocmVzcG9uc2UpID0+IHtcblx0XHRcdFx0XHRcdFx0aWYgKHR5cGVvZiByZXNwb25zZSA9PT0gJ3N0cmluZycpIHtcblx0XHRcdFx0XHRcdFx0XHRyZXR1cm4gbmV3IE1hcmtkb3duU3RyaW5nKHJlc3BvbnNlKTtcblx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRyZXR1cm4gcmVzcG9uc2U7XG5cdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHR5cGVvZiByZXF1ZXN0LnJlc3BvbnNlID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0cmVxdWVzdC5yZXNwb25zZSA9IFtuZXcgTWFya2Rvd25TdHJpbmcocmVxdWVzdC5yZXNwb25zZSldO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdGFjY1tzZXNzaW9uLnNlc3Npb25JZF0gPSBub3JtYWxpemVTZXJpYWxpemFibGVDaGF0RGF0YShzZXNzaW9uKTtcblx0XHRcdFx0cmV0dXJuIGFjYztcblx0XHRcdH0sIHt9KTtcblx0XHRcdHJldHVybiBzZXNzaW9ucztcblx0XHR9IGNhdGNoIChlcnIpIHtcblx0XHRcdHRoaXMuZXJyb3IoJ2Rlc2VyaWFsaXplQ2hhdHMnLCBgTWFsZm9ybWVkIHNlc3Npb24gZGF0YTogJHtlcnJ9LiBbJHtzZXNzaW9uRGF0YS5zdWJzdHJpbmcoMCwgMjApfSR7c2Vzc2lvbkRhdGEubGVuZ3RoID4gMjAgPyAnLi4uJyA6ICcnfV1gKTtcblx0XHRcdHJldHVybiB7fTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldFRyYW5zZmVycmVkU2Vzc2lvbkRhdGEoKTogSUNoYXRUcmFuc2ZlcjIgfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IGRhdGE6IElDaGF0VHJhbnNmZXIyW10gPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdChnbG9iYWxDaGF0S2V5LCBTdG9yYWdlU2NvcGUuUFJPRklMRSwgW10pO1xuXHRcdGNvbnN0IHdvcmtzcGFjZVVyaSA9IHRoaXMud29ya3NwYWNlQ29udGV4dFNlcnZpY2UuZ2V0V29ya3NwYWNlKCkuZm9sZGVyc1swXT8udXJpO1xuXHRcdGlmICghd29ya3NwYWNlVXJpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgdGhpc1dvcmtzcGFjZSA9IHdvcmtzcGFjZVVyaS50b1N0cmluZygpO1xuXHRcdGNvbnN0IGN1cnJlbnRUaW1lID0gRGF0ZS5ub3coKTtcblx0XHQvLyBPbmx5IHVzZSB0cmFuc2ZlcnJlZCBkYXRhIGlmIGl0IHdhcyBjcmVhdGVkIHJlY2VudGx5XG5cdFx0Y29uc3QgdHJhbnNmZXJyZWQgPSBkYXRhLmZpbmQoaXRlbSA9PiBVUkkucmV2aXZlKGl0ZW0udG9Xb3Jrc3BhY2UpLnRvU3RyaW5nKCkgPT09IHRoaXNXb3Jrc3BhY2UgJiYgKGN1cnJlbnRUaW1lIC0gaXRlbS50aW1lc3RhbXBJbk1pbGxpc2Vjb25kcyA8IFNFU1NJT05fVFJBTlNGRVJfRVhQSVJBVElPTl9JTl9NSUxMSVNFQ09ORFMpKTtcblx0XHQvLyBLZWVwIGRhdGEgdGhhdCBpc24ndCBmb3IgdGhlIGN1cnJlbnQgd29ya3NwYWNlIGFuZCB0aGF0IGhhc24ndCBleHBpcmVkIHlldFxuXHRcdGNvbnN0IGZpbHRlcmVkID0gZGF0YS5maWx0ZXIoaXRlbSA9PiBVUkkucmV2aXZlKGl0ZW0udG9Xb3Jrc3BhY2UpLnRvU3RyaW5nKCkgIT09IHRoaXNXb3Jrc3BhY2UgJiYgKGN1cnJlbnRUaW1lIC0gaXRlbS50aW1lc3RhbXBJbk1pbGxpc2Vjb25kcyA8IFNFU1NJT05fVFJBTlNGRVJfRVhQSVJBVElPTl9JTl9NSUxMSVNFQ09ORFMpKTtcblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGdsb2JhbENoYXRLZXksIEpTT04uc3RyaW5naWZ5KGZpbHRlcmVkKSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0cmV0dXJuIHRyYW5zZmVycmVkO1xuXHR9XG5cblx0LyoqXG5cdCAqIFJldHVybnMgYW4gYXJyYXkgb2YgY2hhdCBkZXRhaWxzIGZvciBhbGwgcGVyc2lzdGVkIGNoYXQgc2Vzc2lvbnMgdGhhdCBoYXZlIGF0IGxlYXN0IG9uZSByZXF1ZXN0LlxuXHQgKiBDaGF0IHNlc3Npb25zIHRoYXQgaGF2ZSBhbHJlYWR5IGJlZW4gbG9hZGVkIGludG8gdGhlIGNoYXQgdmlldyBhcmUgZXhjbHVkZWQgZnJvbSB0aGUgcmVzdWx0LlxuXHQgKiBJbXBvcnRlZCBjaGF0IHNlc3Npb25zIGFyZSBhbHNvIGV4Y2x1ZGVkIGZyb20gdGhlIHJlc3VsdC5cblx0ICovXG5cdGFzeW5jIGdldEhpc3RvcnkoKTogUHJvbWlzZTxJQ2hhdERldGFpbFtdPiB7XG5cdFx0aWYgKHRoaXMudXNlRmlsZVN0b3JhZ2UpIHtcblx0XHRcdGNvbnN0IGxpdmVTZXNzaW9uSXRlbXMgPSBBcnJheS5mcm9tKHRoaXMuX3Nlc3Npb25Nb2RlbHMudmFsdWVzKCkpXG5cdFx0XHRcdC5maWx0ZXIoc2Vzc2lvbiA9PiAhc2Vzc2lvbi5pc0ltcG9ydGVkICYmIChzZXNzaW9uLmluaXRpYWxMb2NhdGlvbiAhPT0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24gfHwgdGhpcy51bmlmaWVkVmlld0VuYWJsZWQpKVxuXHRcdFx0XHQubWFwKHNlc3Npb24gPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHRpdGxlID0gc2Vzc2lvbi50aXRsZSB8fCBsb2NhbGl6ZSgnbmV3Q2hhdCcsIFwiTmV3IENoYXRcIik7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdHNlc3Npb25JZDogc2Vzc2lvbi5zZXNzaW9uSWQsXG5cdFx0XHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0XHRcdGxhc3RNZXNzYWdlRGF0ZTogc2Vzc2lvbi5sYXN0TWVzc2FnZURhdGUsXG5cdFx0XHRcdFx0XHRpc0FjdGl2ZTogdHJ1ZSxcblx0XHRcdFx0XHR9IHNhdGlzZmllcyBJQ2hhdERldGFpbDtcblx0XHRcdFx0fSk7XG5cblx0XHRcdGNvbnN0IGluZGV4ID0gYXdhaXQgdGhpcy5fY2hhdFNlc3Npb25TdG9yZS5nZXRJbmRleCgpO1xuXHRcdFx0Y29uc3QgZW50cmllcyA9IE9iamVjdC52YWx1ZXMoaW5kZXgpXG5cdFx0XHRcdC5maWx0ZXIoZW50cnkgPT4gIXRoaXMuX3Nlc3Npb25Nb2RlbHMuaGFzKGVudHJ5LnNlc3Npb25JZCkgJiYgIWVudHJ5LmlzSW1wb3J0ZWQgJiYgIWVudHJ5LmlzRW1wdHkpXG5cdFx0XHRcdC5tYXAoKGVudHJ5KTogSUNoYXREZXRhaWwgPT4gKHtcblx0XHRcdFx0XHQuLi5lbnRyeSxcblx0XHRcdFx0XHRpc0FjdGl2ZTogdGhpcy5fc2Vzc2lvbk1vZGVscy5oYXMoZW50cnkuc2Vzc2lvbklkKSxcblx0XHRcdFx0fSkpO1xuXHRcdFx0cmV0dXJuIFsuLi5saXZlU2Vzc2lvbkl0ZW1zLCAuLi5lbnRyaWVzXTtcblx0XHR9XG5cblx0XHRjb25zdCBwZXJzaXN0ZWRTZXNzaW9ucyA9IE9iamVjdC52YWx1ZXModGhpcy5fcGVyc2lzdGVkU2Vzc2lvbnMpXG5cdFx0XHQuZmlsdGVyKHNlc3Npb24gPT4gc2Vzc2lvbi5yZXF1ZXN0cy5sZW5ndGggPiAwKVxuXHRcdFx0LmZpbHRlcihzZXNzaW9uID0+ICF0aGlzLl9zZXNzaW9uTW9kZWxzLmhhcyhzZXNzaW9uLnNlc3Npb25JZCkpO1xuXG5cdFx0Y29uc3QgcGVyc2lzdGVkU2Vzc2lvbkl0ZW1zID0gcGVyc2lzdGVkU2Vzc2lvbnNcblx0XHRcdC5maWx0ZXIoc2Vzc2lvbiA9PiAhc2Vzc2lvbi5pc0ltcG9ydGVkICYmIHNlc3Npb24uaW5pdGlhbExvY2F0aW9uICE9PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbilcblx0XHRcdC5tYXAoc2Vzc2lvbiA9PiB7XG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gc2Vzc2lvbi5jdXN0b21UaXRsZSA/PyBDaGF0TW9kZWwuZ2V0RGVmYXVsdFRpdGxlKHNlc3Npb24ucmVxdWVzdHMpO1xuXHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdHNlc3Npb25JZDogc2Vzc2lvbi5zZXNzaW9uSWQsXG5cdFx0XHRcdFx0dGl0bGUsXG5cdFx0XHRcdFx0bGFzdE1lc3NhZ2VEYXRlOiBzZXNzaW9uLmxhc3RNZXNzYWdlRGF0ZSxcblx0XHRcdFx0XHRpc0FjdGl2ZTogZmFsc2UsXG5cdFx0XHRcdH0gc2F0aXNmaWVzIElDaGF0RGV0YWlsO1xuXHRcdFx0fSk7XG5cdFx0Y29uc3QgbGl2ZVNlc3Npb25JdGVtcyA9IEFycmF5LmZyb20odGhpcy5fc2Vzc2lvbk1vZGVscy52YWx1ZXMoKSlcblx0XHRcdC5maWx0ZXIoc2Vzc2lvbiA9PiAhc2Vzc2lvbi5pc0ltcG9ydGVkICYmIHNlc3Npb24uaW5pdGlhbExvY2F0aW9uICE9PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbilcblx0XHRcdC5tYXAoc2Vzc2lvbiA9PiB7XG5cdFx0XHRcdGNvbnN0IHRpdGxlID0gc2Vzc2lvbi50aXRsZSB8fCBsb2NhbGl6ZSgnbmV3Q2hhdCcsIFwiTmV3IENoYXRcIik7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c2Vzc2lvbklkOiBzZXNzaW9uLnNlc3Npb25JZCxcblx0XHRcdFx0XHR0aXRsZSxcblx0XHRcdFx0XHRsYXN0TWVzc2FnZURhdGU6IHNlc3Npb24ubGFzdE1lc3NhZ2VEYXRlLFxuXHRcdFx0XHRcdGlzQWN0aXZlOiB0cnVlLFxuXHRcdFx0XHR9IHNhdGlzZmllcyBJQ2hhdERldGFpbDtcblx0XHRcdH0pO1xuXHRcdHJldHVybiBbLi4ubGl2ZVNlc3Npb25JdGVtcywgLi4ucGVyc2lzdGVkU2Vzc2lvbkl0ZW1zXTtcblx0fVxuXG5cdGFzeW5jIHJlbW92ZUhpc3RvcnlFbnRyeShzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICh0aGlzLnVzZUZpbGVTdG9yYWdlKSB7XG5cdFx0XHRhd2FpdCB0aGlzLl9jaGF0U2Vzc2lvblN0b3JlLmRlbGV0ZVNlc3Npb24oc2Vzc2lvbklkKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRpZiAodGhpcy5fcGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbklkXSkge1xuXHRcdFx0dGhpcy5fZGVsZXRlZENoYXRJZHMuYWRkKHNlc3Npb25JZCk7XG5cdFx0XHRkZWxldGUgdGhpcy5fcGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbklkXTtcblx0XHRcdHRoaXMuc2F2ZVN0YXRlKCk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgY2xlYXJBbGxIaXN0b3J5RW50cmllcygpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRpZiAodGhpcy51c2VGaWxlU3RvcmFnZSkge1xuXHRcdFx0YXdhaXQgdGhpcy5fY2hhdFNlc3Npb25TdG9yZS5jbGVhckFsbFNlc3Npb25zKCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0T2JqZWN0LnZhbHVlcyh0aGlzLl9wZXJzaXN0ZWRTZXNzaW9ucykuZm9yRWFjaChzZXNzaW9uID0+IHRoaXMuX2RlbGV0ZWRDaGF0SWRzLmFkZChzZXNzaW9uLnNlc3Npb25JZCkpO1xuXHRcdHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zID0ge307XG5cdFx0dGhpcy5zYXZlU3RhdGUoKTtcblx0fVxuXG5cdHN0YXJ0U2Vzc2lvbihsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbiwgaXNHbG9iYWxFZGl0aW5nU2Vzc2lvbjogYm9vbGVhbiA9IHRydWUpOiBDaGF0TW9kZWwge1xuXHRcdHRoaXMudHJhY2UoJ3N0YXJ0U2Vzc2lvbicpO1xuXHRcdHJldHVybiB0aGlzLl9zdGFydFNlc3Npb24odW5kZWZpbmVkLCBsb2NhdGlvbiwgaXNHbG9iYWxFZGl0aW5nU2Vzc2lvbiwgdG9rZW4pO1xuXHR9XG5cblx0cHJpdmF0ZSBfc3RhcnRTZXNzaW9uKHNvbWVTZXNzaW9uSGlzdG9yeTogSUV4cG9ydGFibGVDaGF0RGF0YSB8IElTZXJpYWxpemFibGVDaGF0RGF0YSB8IHVuZGVmaW5lZCwgbG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uLCBpc0dsb2JhbEVkaXRpbmdTZXNzaW9uOiBib29sZWFuLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBDaGF0TW9kZWwge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0TW9kZWwsIHNvbWVTZXNzaW9uSGlzdG9yeSwgbG9jYXRpb24pO1xuXHRcdGlmIChsb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uRWRpdGluZ1Nlc3Npb24gfHwgKHRoaXMudW5pZmllZFZpZXdFbmFibGVkICYmIGxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCkpIHtcblx0XHRcdG1vZGVsLnN0YXJ0RWRpdGluZ1Nlc3Npb24oaXNHbG9iYWxFZGl0aW5nU2Vzc2lvbik7XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2Vzc2lvbk1vZGVscy5zZXQobW9kZWwuc2Vzc2lvbklkLCBtb2RlbCk7XG5cdFx0dGhpcy5pbml0aWFsaXplU2Vzc2lvbihtb2RlbCwgdG9rZW4pO1xuXHRcdHJldHVybiBtb2RlbDtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgaW5pdGlhbGl6ZVNlc3Npb24obW9kZWw6IENoYXRNb2RlbCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dHJ5IHtcblx0XHRcdHRoaXMudHJhY2UoJ2luaXRpYWxpemVTZXNzaW9uJywgYEluaXRpYWxpemUgc2Vzc2lvbiAke21vZGVsLnNlc3Npb25JZH1gKTtcblx0XHRcdG1vZGVsLnN0YXJ0SW5pdGlhbGl6ZSgpO1xuXG5cdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2Uud2hlbkluc3RhbGxlZEV4dGVuc2lvbnNSZWdpc3RlcmVkKCk7XG5cdFx0XHRjb25zdCBkZWZhdWx0QWdlbnREYXRhID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldENvbnRyaWJ1dGVkRGVmYXVsdEFnZW50KG1vZGVsLmluaXRpYWxMb2NhdGlvbikgPz8gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldENvbnRyaWJ1dGVkRGVmYXVsdEFnZW50KENoYXRBZ2VudExvY2F0aW9uLlBhbmVsKTtcblx0XHRcdGlmICghZGVmYXVsdEFnZW50RGF0YSkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3JOb1RlbGVtZXRyeSgnTm8gZGVmYXVsdCBhZ2VudCBjb250cmlidXRlZCcpO1xuXHRcdFx0fVxuXG5cdFx0XHRpZiAodGhpcy5jb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZSgnY2hhdC5zZXR1cEZyb21EaWFsb2cnKSkge1xuXHRcdFx0XHQvLyBBY3RpdmF0ZSB0aGUgZGVmYXVsdCBleHRlbnNpb24gcHJvdmlkZWQgYWdlbnQgYnV0IGRvIG5vdCB3YWl0XG5cdFx0XHRcdC8vIGZvciBpdCB0byBiZSByZWFkeSBzbyB0aGF0IHRoZSBzZXNzaW9uIGNhbiBiZSB1c2VkIGltbWVkaWF0ZWx5XG5cdFx0XHRcdC8vIHdpdGhvdXQgaGF2aW5nIHRvIHdhaXQgZm9yIHRoZSBhZ2VudCB0byBiZSByZWFkeS5cblx0XHRcdFx0dGhpcy5leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudChgb25DaGF0UGFydGljaXBhbnQ6JHtkZWZhdWx0QWdlbnREYXRhLmlkfWApO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0Ly8gTm8gc2V0dXAgcGFydGljaXBhbnQgdG8gZmFsbCBiYWNrIG9uLSB3YWl0IGZvciBleHRlbnNpb24gYWN0aXZhdGlvblxuXHRcdFx0XHRhd2FpdCB0aGlzLmV4dGVuc2lvblNlcnZpY2UuYWN0aXZhdGVCeUV2ZW50KGBvbkNoYXRQYXJ0aWNpcGFudDoke2RlZmF1bHRBZ2VudERhdGEuaWR9YCk7XG5cblx0XHRcdFx0Y29uc3QgZGVmYXVsdEFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFjdGl2YXRlZEFnZW50cygpLmZpbmQoYWdlbnQgPT4gYWdlbnQuaWQgPT09IGRlZmF1bHRBZ2VudERhdGEuaWQpO1xuXHRcdFx0XHRpZiAoIWRlZmF1bHRBZ2VudCkge1xuXHRcdFx0XHRcdHRocm93IG5ldyBFcnJvck5vVGVsZW1ldHJ5KCdObyBkZWZhdWx0IGFnZW50IHJlZ2lzdGVyZWQnKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRtb2RlbC5pbml0aWFsaXplKCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdzdGFydFNlc3Npb24nLCBgaW5pdGlhbGl6ZVNlc3Npb24gZmFpbGVkOiAke2Vycn1gKTtcblx0XHRcdG1vZGVsLnNldEluaXRpYWxpemF0aW9uRXJyb3IoZXJyKTtcblx0XHRcdHRoaXMuX3Nlc3Npb25Nb2RlbHMuZGVsZXRlQW5kRGlzcG9zZShtb2RlbC5zZXNzaW9uSWQpO1xuXHRcdFx0dGhpcy5fb25EaWREaXNwb3NlU2Vzc2lvbi5maXJlKHsgc2Vzc2lvbklkOiBtb2RlbC5zZXNzaW9uSWQsIHJlYXNvbjogJ2luaXRpYWxpemF0aW9uRmFpbGVkJyB9KTtcblx0XHR9XG5cdH1cblxuXHRnZXRTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogSUNoYXRNb2RlbCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX3Nlc3Npb25Nb2RlbHMuZ2V0KHNlc3Npb25JZCk7XG5cdH1cblxuXHRhc3luYyBnZXRPclJlc3RvcmVTZXNzaW9uKHNlc3Npb25JZDogc3RyaW5nKTogUHJvbWlzZTxDaGF0TW9kZWwgfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdnZXRPclJlc3RvcmVTZXNzaW9uJywgYHNlc3Npb25JZDogJHtzZXNzaW9uSWR9YCk7XG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9zZXNzaW9uTW9kZWxzLmdldChzZXNzaW9uSWQpO1xuXHRcdGlmIChtb2RlbCkge1xuXHRcdFx0cmV0dXJuIG1vZGVsO1xuXHRcdH1cblxuXHRcdGxldCBzZXNzaW9uRGF0YTogSVNlcmlhbGl6YWJsZUNoYXREYXRhIHwgdW5kZWZpbmVkO1xuXHRcdGlmICh0aGlzLnVzZUZpbGVTdG9yYWdlKSB7XG5cdFx0XHRzZXNzaW9uRGF0YSA9IHJldml2ZShhd2FpdCB0aGlzLl9jaGF0U2Vzc2lvblN0b3JlLnJlYWRTZXNzaW9uKHNlc3Npb25JZCkpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZXNzaW9uRGF0YSA9IHJldml2ZSh0aGlzLl9wZXJzaXN0ZWRTZXNzaW9uc1tzZXNzaW9uSWRdKTtcblx0XHR9XG5cblx0XHRpZiAoIXNlc3Npb25EYXRhKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHNlc3Npb24gPSB0aGlzLl9zdGFydFNlc3Npb24oc2Vzc2lvbkRhdGEsIHNlc3Npb25EYXRhLmluaXRpYWxMb2NhdGlvbiA/PyBDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCwgdHJ1ZSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSk7XG5cblx0XHRjb25zdCBpc1RyYW5zZmVycmVkID0gdGhpcy50cmFuc2ZlcnJlZFNlc3Npb25EYXRhPy5zZXNzaW9uSWQgPT09IHNlc3Npb25JZDtcblx0XHRpZiAoaXNUcmFuc2ZlcnJlZCkge1xuXHRcdFx0Ly8gVE9ET1xuXHRcdFx0Ly8gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLnRvZ2dsZVRvb2xzQWdlbnRNb2RlKHRoaXMudHJhbnNmZXJyZWRTZXNzaW9uRGF0YS50b29sc0FnZW50TW9kZUVuYWJsZWQpO1xuXHRcdFx0dGhpcy5fdHJhbnNmZXJyZWRTZXNzaW9uRGF0YSA9IHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gc2Vzc2lvbjtcblx0fVxuXG5cdC8qKlxuXHQgKiBUaGlzIGlzIHJlYWxseSBqdXN0IGZvciBtaWdyYXRpbmcgZGF0YSBmcm9tIHRoZSBlZGl0IHNlc3Npb24gbG9jYXRpb24gdG8gdGhlIHBhbmVsLlxuXHQgKi9cblx0aXNQZXJzaXN0ZWRTZXNzaW9uRW1wdHkoc2Vzc2lvbklkOiBzdHJpbmcpOiBib29sZWFuIHtcblx0XHRjb25zdCBzZXNzaW9uID0gdGhpcy5fcGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbklkXTtcblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0cmV0dXJuIHNlc3Npb24ucmVxdWVzdHMubGVuZ3RoID09PSAwO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9jaGF0U2Vzc2lvblN0b3JlLmlzU2Vzc2lvbkVtcHR5KHNlc3Npb25JZCk7XG5cdH1cblxuXHRsb2FkU2Vzc2lvbkZyb21Db250ZW50KGRhdGE6IElFeHBvcnRhYmxlQ2hhdERhdGEgfCBJU2VyaWFsaXphYmxlQ2hhdERhdGEpOiBJQ2hhdE1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fc3RhcnRTZXNzaW9uKGRhdGEsIGRhdGEuaW5pdGlhbExvY2F0aW9uID8/IENoYXRBZ2VudExvY2F0aW9uLlBhbmVsLCB0cnVlLCBDYW5jZWxsYXRpb25Ub2tlbi5Ob25lKTtcblx0fVxuXG5cdGFzeW5jIHJlc2VuZFJlcXVlc3QocmVxdWVzdDogSUNoYXRSZXF1ZXN0TW9kZWwsIG9wdGlvbnM/OiBJQ2hhdFNlbmRSZXF1ZXN0T3B0aW9ucyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fc2Vzc2lvbk1vZGVscy5nZXQocmVxdWVzdC5zZXNzaW9uLnNlc3Npb25JZCk7XG5cdFx0aWYgKCFtb2RlbCAmJiBtb2RlbCAhPT0gcmVxdWVzdC5zZXNzaW9uKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gc2Vzc2lvbjogJHtyZXF1ZXN0LnNlc3Npb24uc2Vzc2lvbklkfWApO1xuXHRcdH1cblxuXHRcdGF3YWl0IG1vZGVsLndhaXRGb3JJbml0aWFsaXphdGlvbigpO1xuXG5cdFx0Y29uc3QgY3RzID0gdGhpcy5fcGVuZGluZ1JlcXVlc3RzLmdldChyZXF1ZXN0LnNlc3Npb24uc2Vzc2lvbklkKTtcblx0XHRpZiAoY3RzKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdyZXNlbmRSZXF1ZXN0JywgYFNlc3Npb24gJHtyZXF1ZXN0LnNlc3Npb24uc2Vzc2lvbklkfSBhbHJlYWR5IGhhcyBhIHBlbmRpbmcgcmVxdWVzdCwgY2FuY2VsbGluZy4uLmApO1xuXHRcdFx0Y3RzLmNhbmNlbCgpO1xuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2F0aW9uID0gb3B0aW9ucz8ubG9jYXRpb24gPz8gbW9kZWwuaW5pdGlhbExvY2F0aW9uO1xuXHRcdGNvbnN0IGF0dGVtcHQgPSBvcHRpb25zPy5hdHRlbXB0ID8/IDA7XG5cdFx0Y29uc3QgZW5hYmxlQ29tbWFuZERldGVjdGlvbiA9ICFvcHRpb25zPy5ub0NvbW1hbmREZXRlY3Rpb247XG5cdFx0Y29uc3QgZGVmYXVsdEFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChsb2NhdGlvbiwgb3B0aW9ucz8ubW9kZSkhO1xuXG5cdFx0bW9kZWwucmVtb3ZlUmVxdWVzdChyZXF1ZXN0LmlkLCBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24uUmVzZW5kKTtcblxuXHRcdGNvbnN0IHJlc2VuZE9wdGlvbnM6IElDaGF0U2VuZFJlcXVlc3RPcHRpb25zID0ge1xuXHRcdFx0Li4ub3B0aW9ucyxcblx0XHRcdGxvY2F0aW9uRGF0YTogcmVxdWVzdC5sb2NhdGlvbkRhdGEsXG5cdFx0XHRhdHRhY2hlZENvbnRleHQ6IHJlcXVlc3QuYXR0YWNoZWRDb250ZXh0LFxuXHRcdFx0aGFzSW5zdHJ1Y3Rpb25BdHRhY2htZW50czogb3B0aW9ucz8uaGFzSW5zdHJ1Y3Rpb25BdHRhY2htZW50cyA/PyBmYWxzZSxcblx0XHR9O1xuXHRcdGF3YWl0IHRoaXMuX3NlbmRSZXF1ZXN0QXN5bmMobW9kZWwsIG1vZGVsLnNlc3Npb25JZCwgcmVxdWVzdC5tZXNzYWdlLCBhdHRlbXB0LCBlbmFibGVDb21tYW5kRGV0ZWN0aW9uLCBkZWZhdWx0QWdlbnQsIGxvY2F0aW9uLCByZXNlbmRPcHRpb25zKS5yZXNwb25zZUNvbXBsZXRlUHJvbWlzZTtcblx0fVxuXG5cdGFzeW5jIHNlbmRSZXF1ZXN0KHNlc3Npb25JZDogc3RyaW5nLCByZXF1ZXN0OiBzdHJpbmcsIG9wdGlvbnM/OiBJQ2hhdFNlbmRSZXF1ZXN0T3B0aW9ucyk6IFByb21pc2U8SUNoYXRTZW5kUmVxdWVzdERhdGEgfCB1bmRlZmluZWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdzZW5kUmVxdWVzdCcsIGBzZXNzaW9uSWQ6ICR7c2Vzc2lvbklkfSwgbWVzc2FnZTogJHtyZXF1ZXN0LnN1YnN0cmluZygwLCAyMCl9JHtyZXF1ZXN0Lmxlbmd0aCA+IDIwID8gJ1suLi5dJyA6ICcnfX1gKTtcblxuXHRcdC8vIGlmIHRleHQgaXMgbm90IHByb3ZpZGVkLCBidXQgY2hhdCBpbnB1dCBoYXMgYHByb21wdCBpbnN0cnVjdGlvbnNgXG5cdFx0Ly8gYXR0YWNoZWQsIHVzZSB0aGUgZGVmYXVsdCBwcm9tcHQgdGV4dCB0byBhdm9pZCBlbXB0eSBtZXNzYWdlc1xuXHRcdGlmICghcmVxdWVzdC50cmltKCkgJiYgb3B0aW9ucz8uaGFzSW5zdHJ1Y3Rpb25BdHRhY2htZW50cykge1xuXHRcdFx0cmVxdWVzdCA9ICdGb2xsb3cgdGhlc2UgaW5zdHJ1Y3Rpb25zLic7XG5cdFx0fVxuXG5cdFx0aWYgKCFyZXF1ZXN0LnRyaW0oKSAmJiAhb3B0aW9ucz8uc2xhc2hDb21tYW5kICYmICFvcHRpb25zPy5hZ2VudElkICYmICFvcHRpb25zPy5oYXNJbnN0cnVjdGlvbkF0dGFjaG1lbnRzKSB7XG5cdFx0XHR0aGlzLnRyYWNlKCdzZW5kUmVxdWVzdCcsICdSZWplY3RlZCBlbXB0eSBtZXNzYWdlJyk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9zZXNzaW9uTW9kZWxzLmdldChzZXNzaW9uSWQpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBzZXNzaW9uOiAke3Nlc3Npb25JZH1gKTtcblx0XHR9XG5cblx0XHRhd2FpdCBtb2RlbC53YWl0Rm9ySW5pdGlhbGl6YXRpb24oKTtcblxuXHRcdGlmICh0aGlzLl9wZW5kaW5nUmVxdWVzdHMuaGFzKHNlc3Npb25JZCkpIHtcblx0XHRcdHRoaXMudHJhY2UoJ3NlbmRSZXF1ZXN0JywgYFNlc3Npb24gJHtzZXNzaW9uSWR9IGFscmVhZHkgaGFzIGEgcGVuZGluZyByZXF1ZXN0YCk7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVxdWVzdHMgPSBtb2RlbC5nZXRSZXF1ZXN0cygpO1xuXHRcdGZvciAobGV0IGkgPSByZXF1ZXN0cy5sZW5ndGggLSAxOyBpID49IDA7IGkgLT0gMSkge1xuXHRcdFx0Y29uc3QgcmVxdWVzdCA9IHJlcXVlc3RzW2ldO1xuXHRcdFx0aWYgKHJlcXVlc3Quc2hvdWxkQmVSZW1vdmVkT25TZW5kKSB7XG5cdFx0XHRcdGlmIChyZXF1ZXN0LnNob3VsZEJlUmVtb3ZlZE9uU2VuZC5hZnRlclVuZG9TdG9wKSB7XG5cdFx0XHRcdFx0cmVxdWVzdC5yZXNwb25zZT8uZmluYWxpemVVbmRvU3RhdGUoKTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLnJlbW92ZVJlcXVlc3Qoc2Vzc2lvbklkLCByZXF1ZXN0LmlkKTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IGxvY2F0aW9uID0gb3B0aW9ucz8ubG9jYXRpb24gPz8gbW9kZWwuaW5pdGlhbExvY2F0aW9uO1xuXHRcdGNvbnN0IGF0dGVtcHQgPSBvcHRpb25zPy5hdHRlbXB0ID8/IDA7XG5cdFx0Y29uc3QgZGVmYXVsdEFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChsb2NhdGlvbiwgb3B0aW9ucz8ubW9kZSkhO1xuXG5cdFx0Y29uc3QgcGFyc2VkUmVxdWVzdCA9IHRoaXMucGFyc2VDaGF0UmVxdWVzdChzZXNzaW9uSWQsIHJlcXVlc3QsIGxvY2F0aW9uLCBvcHRpb25zKTtcblx0XHRjb25zdCBhZ2VudCA9IHBhcnNlZFJlcXVlc3QucGFydHMuZmluZCgocik6IHIgaXMgQ2hhdFJlcXVlc3RBZ2VudFBhcnQgPT4gciBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0KT8uYWdlbnQgPz8gZGVmYXVsdEFnZW50O1xuXHRcdGNvbnN0IGFnZW50U2xhc2hDb21tYW5kUGFydCA9IHBhcnNlZFJlcXVlc3QucGFydHMuZmluZCgocik6IHIgaXMgQ2hhdFJlcXVlc3RBZ2VudFN1YmNvbW1hbmRQYXJ0ID0+IHIgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQpO1xuXG5cdFx0Ly8gVGhpcyBtZXRob2QgaXMgb25seSByZXR1cm5pbmcgd2hldGhlciB0aGUgcmVxdWVzdCB3YXMgYWNjZXB0ZWQgLSBkb24ndCBibG9jayBvbiB0aGUgYWN0dWFsIHJlcXVlc3Rcblx0XHRyZXR1cm4ge1xuXHRcdFx0Li4udGhpcy5fc2VuZFJlcXVlc3RBc3luYyhtb2RlbCwgc2Vzc2lvbklkLCBwYXJzZWRSZXF1ZXN0LCBhdHRlbXB0LCAhb3B0aW9ucz8ubm9Db21tYW5kRGV0ZWN0aW9uLCBkZWZhdWx0QWdlbnQsIGxvY2F0aW9uLCBvcHRpb25zKSxcblx0XHRcdGFnZW50LFxuXHRcdFx0c2xhc2hDb21tYW5kOiBhZ2VudFNsYXNoQ29tbWFuZFBhcnQ/LmNvbW1hbmQsXG5cdFx0fTtcblx0fVxuXG5cdHByaXZhdGUgcGFyc2VDaGF0UmVxdWVzdChzZXNzaW9uSWQ6IHN0cmluZywgcmVxdWVzdDogc3RyaW5nLCBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24sIG9wdGlvbnM6IElDaGF0U2VuZFJlcXVlc3RPcHRpb25zIHwgdW5kZWZpbmVkKTogSVBhcnNlZENoYXRSZXF1ZXN0IHtcblx0XHRsZXQgcGFyc2VyQ29udGV4dCA9IG9wdGlvbnM/LnBhcnNlckNvbnRleHQ7XG5cdFx0aWYgKG9wdGlvbnM/LmFnZW50SWQpIHtcblx0XHRcdGNvbnN0IGFnZW50ID0gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KG9wdGlvbnMuYWdlbnRJZCk7XG5cdFx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBhZ2VudDogJHtvcHRpb25zLmFnZW50SWR9YCk7XG5cdFx0XHR9XG5cdFx0XHRwYXJzZXJDb250ZXh0ID0geyBzZWxlY3RlZEFnZW50OiBhZ2VudCwgbW9kZTogb3B0aW9ucy5tb2RlIH07XG5cdFx0XHRjb25zdCBjb21tYW5kUGFydCA9IG9wdGlvbnMuc2xhc2hDb21tYW5kID8gYCAke2NoYXRTdWJjb21tYW5kTGVhZGVyfSR7b3B0aW9ucy5zbGFzaENvbW1hbmR9YCA6ICcnO1xuXHRcdFx0cmVxdWVzdCA9IGAke2NoYXRBZ2VudExlYWRlcn0ke2FnZW50Lm5hbWV9JHtjb21tYW5kUGFydH0gJHtyZXF1ZXN0fWA7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcGFyc2VkUmVxdWVzdCA9IHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFJlcXVlc3RQYXJzZXIpLnBhcnNlQ2hhdFJlcXVlc3Qoc2Vzc2lvbklkLCByZXF1ZXN0LCBsb2NhdGlvbiwgcGFyc2VyQ29udGV4dCk7XG5cdFx0cmV0dXJuIHBhcnNlZFJlcXVlc3Q7XG5cdH1cblxuXHRwcml2YXRlIHJlZnJlc2hGb2xsb3d1cHNDYW5jZWxsYXRpb25Ub2tlbihzZXNzaW9uSWQ6IHN0cmluZyk6IENhbmNlbGxhdGlvblRva2VuIHtcblx0XHR0aGlzLl9zZXNzaW9uRm9sbG93dXBDYW5jZWxUb2tlbnMuZ2V0KHNlc3Npb25JZCk/LmNhbmNlbCgpO1xuXHRcdGNvbnN0IG5ld1Rva2VuU291cmNlID0gbmV3IENhbmNlbGxhdGlvblRva2VuU291cmNlKCk7XG5cdFx0dGhpcy5fc2Vzc2lvbkZvbGxvd3VwQ2FuY2VsVG9rZW5zLnNldChzZXNzaW9uSWQsIG5ld1Rva2VuU291cmNlKTtcblxuXHRcdHJldHVybiBuZXdUb2tlblNvdXJjZS50b2tlbjtcblx0fVxuXG5cdHByaXZhdGUgX3NlbmRSZXF1ZXN0QXN5bmMobW9kZWw6IENoYXRNb2RlbCwgc2Vzc2lvbklkOiBzdHJpbmcsIHBhcnNlZFJlcXVlc3Q6IElQYXJzZWRDaGF0UmVxdWVzdCwgYXR0ZW1wdDogbnVtYmVyLCBlbmFibGVDb21tYW5kRGV0ZWN0aW9uOiBib29sZWFuLCBkZWZhdWx0QWdlbnQ6IElDaGF0QWdlbnQsIGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgb3B0aW9ucz86IElDaGF0U2VuZFJlcXVlc3RPcHRpb25zKTogSUNoYXRTZW5kUmVxdWVzdFJlc3BvbnNlU3RhdGUge1xuXHRcdGNvbnN0IGZvbGxvd3Vwc0NhbmNlbFRva2VuID0gdGhpcy5yZWZyZXNoRm9sbG93dXBzQ2FuY2VsbGF0aW9uVG9rZW4oc2Vzc2lvbklkKTtcblx0XHRsZXQgcmVxdWVzdDogQ2hhdFJlcXVlc3RNb2RlbDtcblx0XHRjb25zdCBhZ2VudFBhcnQgPSAna2luZCcgaW4gcGFyc2VkUmVxdWVzdCA/IHVuZGVmaW5lZCA6IHBhcnNlZFJlcXVlc3QucGFydHMuZmluZCgocik6IHIgaXMgQ2hhdFJlcXVlc3RBZ2VudFBhcnQgPT4gciBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0KTtcblx0XHRjb25zdCBhZ2VudFNsYXNoQ29tbWFuZFBhcnQgPSAna2luZCcgaW4gcGFyc2VkUmVxdWVzdCA/IHVuZGVmaW5lZCA6IHBhcnNlZFJlcXVlc3QucGFydHMuZmluZCgocik6IHIgaXMgQ2hhdFJlcXVlc3RBZ2VudFN1YmNvbW1hbmRQYXJ0ID0+IHIgaW5zdGFuY2VvZiBDaGF0UmVxdWVzdEFnZW50U3ViY29tbWFuZFBhcnQpO1xuXHRcdGNvbnN0IGNvbW1hbmRQYXJ0ID0gJ2tpbmQnIGluIHBhcnNlZFJlcXVlc3QgPyB1bmRlZmluZWQgOiBwYXJzZWRSZXF1ZXN0LnBhcnRzLmZpbmQoKHIpOiByIGlzIENoYXRSZXF1ZXN0U2xhc2hDb21tYW5kUGFydCA9PiByIGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RTbGFzaENvbW1hbmRQYXJ0KTtcblx0XHRjb25zdCByZXF1ZXN0cyA9IFsuLi5tb2RlbC5nZXRSZXF1ZXN0cygpXTtcblxuXHRcdGxldCBnb3RQcm9ncmVzcyA9IGZhbHNlO1xuXHRcdGNvbnN0IHJlcXVlc3RUeXBlID0gY29tbWFuZFBhcnQgPyAnc2xhc2hDb21tYW5kJyA6ICdzdHJpbmcnO1xuXG5cdFx0Y29uc3QgcmVzcG9uc2VDcmVhdGVkID0gbmV3IERlZmVycmVkUHJvbWlzZTxJQ2hhdFJlc3BvbnNlTW9kZWw+KCk7XG5cdFx0bGV0IHJlc3BvbnNlQ3JlYXRlZENvbXBsZXRlID0gZmFsc2U7XG5cdFx0ZnVuY3Rpb24gY29tcGxldGVSZXNwb25zZUNyZWF0ZWQoKTogdm9pZCB7XG5cdFx0XHRpZiAoIXJlc3BvbnNlQ3JlYXRlZENvbXBsZXRlICYmIHJlcXVlc3Q/LnJlc3BvbnNlKSB7XG5cdFx0XHRcdHJlc3BvbnNlQ3JlYXRlZC5jb21wbGV0ZShyZXF1ZXN0LnJlc3BvbnNlKTtcblx0XHRcdFx0cmVzcG9uc2VDcmVhdGVkQ29tcGxldGUgPSB0cnVlO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdGNvbnN0IHNvdXJjZSA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRcdGNvbnN0IHRva2VuID0gc291cmNlLnRva2VuO1xuXHRcdGNvbnN0IHNlbmRSZXF1ZXN0SW50ZXJuYWwgPSBhc3luYyAoKSA9PiB7XG5cdFx0XHRjb25zdCBwcm9ncmVzc0NhbGxiYWNrID0gKHByb2dyZXNzOiBJQ2hhdFByb2dyZXNzKSA9PiB7XG5cdFx0XHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGdvdFByb2dyZXNzID0gdHJ1ZTtcblxuXHRcdFx0XHRpZiAocHJvZ3Jlc3Mua2luZCA9PT0gJ21hcmtkb3duQ29udGVudCcpIHtcblx0XHRcdFx0XHR0aGlzLnRyYWNlKCdzZW5kUmVxdWVzdCcsIGBQcm92aWRlciByZXR1cm5lZCBwcm9ncmVzcyBmb3Igc2Vzc2lvbiAke21vZGVsLnNlc3Npb25JZH0sICR7cHJvZ3Jlc3MuY29udGVudC52YWx1ZS5sZW5ndGh9IGNoYXJzYCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0dGhpcy50cmFjZSgnc2VuZFJlcXVlc3QnLCBgUHJvdmlkZXIgcmV0dXJuZWQgcHJvZ3Jlc3M6ICR7SlNPTi5zdHJpbmdpZnkocHJvZ3Jlc3MpfWApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCBwcm9ncmVzcyk7XG5cdFx0XHRcdGNvbXBsZXRlUmVzcG9uc2VDcmVhdGVkKCk7XG5cdFx0XHR9O1xuXG5cdFx0XHRsZXQgZGV0ZWN0ZWRBZ2VudDogSUNoYXRBZ2VudERhdGEgfCB1bmRlZmluZWQ7XG5cdFx0XHRsZXQgZGV0ZWN0ZWRDb21tYW5kOiBJQ2hhdEFnZW50Q29tbWFuZCB8IHVuZGVmaW5lZDtcblxuXHRcdFx0Y29uc3Qgc3RvcFdhdGNoID0gbmV3IFN0b3BXYXRjaChmYWxzZSk7XG5cdFx0XHRjb25zdCBsaXN0ZW5lciA9IHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IHtcblx0XHRcdFx0dGhpcy50cmFjZSgnc2VuZFJlcXVlc3QnLCBgUmVxdWVzdCBmb3Igc2Vzc2lvbiAke21vZGVsLnNlc3Npb25JZH0gd2FzIGNhbmNlbGxlZGApO1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxDaGF0UHJvdmlkZXJJbnZva2VkRXZlbnQsIENoYXRQcm92aWRlckludm9rZWRDbGFzc2lmaWNhdGlvbj4oJ2ludGVyYWN0aXZlU2Vzc2lvblByb3ZpZGVySW52b2tlZCcsIHtcblx0XHRcdFx0XHR0aW1lVG9GaXJzdFByb2dyZXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0Ly8gTm9ybWFsbHkgdGltaW5ncyBoYXBwZW4gaW5zaWRlIHRoZSBFSCBhcm91bmQgdGhlIGFjdHVhbCBwcm92aWRlci4gRm9yIGNhbmNlbGxhdGlvbiB3ZSBjYW4gbWVhc3VyZSBob3cgbG9uZyB0aGUgdXNlciB3YWl0ZWQgYmVmb3JlIGNhbmNlbGxpbmdcblx0XHRcdFx0XHR0b3RhbFRpbWU6IHN0b3BXYXRjaC5lbGFwc2VkKCksXG5cdFx0XHRcdFx0cmVzdWx0OiAnY2FuY2VsbGVkJyxcblx0XHRcdFx0XHRyZXF1ZXN0VHlwZSxcblx0XHRcdFx0XHRhZ2VudDogZGV0ZWN0ZWRBZ2VudD8uaWQgPz8gYWdlbnRQYXJ0Py5hZ2VudC5pZCA/PyAnJyxcblx0XHRcdFx0XHRhZ2VudEV4dGVuc2lvbklkOiBkZXRlY3RlZEFnZW50Py5leHRlbnNpb25JZC52YWx1ZSA/PyBhZ2VudFBhcnQ/LmFnZW50LmV4dGVuc2lvbklkLnZhbHVlID8/ICcnLFxuXHRcdFx0XHRcdHNsYXNoQ29tbWFuZDogYWdlbnRTbGFzaENvbW1hbmRQYXJ0ID8gYWdlbnRTbGFzaENvbW1hbmRQYXJ0LmNvbW1hbmQubmFtZSA6IGNvbW1hbmRQYXJ0Py5zbGFzaENvbW1hbmQuY29tbWFuZCxcblx0XHRcdFx0XHRjaGF0U2Vzc2lvbklkOiBtb2RlbC5zZXNzaW9uSWQsXG5cdFx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdFx0Y2l0YXRpb25zOiByZXF1ZXN0Py5yZXNwb25zZT8uY29kZUNpdGF0aW9ucy5sZW5ndGggPz8gMCxcblx0XHRcdFx0XHRudW1Db2RlQmxvY2tzOiBnZXRDb2RlQmxvY2tzKHJlcXVlc3QucmVzcG9uc2U/LnJlc3BvbnNlLnRvU3RyaW5nKCkgPz8gJycpLmxlbmd0aCxcblx0XHRcdFx0XHRpc1BhcnRpY2lwYW50RGV0ZWN0ZWQ6ICEhZGV0ZWN0ZWRBZ2VudCxcblx0XHRcdFx0XHRlbmFibGVDb21tYW5kRGV0ZWN0aW9uLFxuXHRcdFx0XHRcdGF0dGFjaG1lbnRLaW5kczogdGhpcy5hdHRhY2htZW50S2luZHNGb3JUZWxlbWV0cnkocmVxdWVzdC52YXJpYWJsZURhdGEpXG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdG1vZGVsLmNhbmNlbFJlcXVlc3QocmVxdWVzdCk7XG5cdFx0XHR9KTtcblxuXHRcdFx0dHJ5IHtcblx0XHRcdFx0bGV0IHJhd1Jlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCB8IG51bGwgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGxldCBhZ2VudE9yQ29tbWFuZEZvbGxvd3VwczogUHJvbWlzZTxJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRcdFx0XHRsZXQgY2hhdFRpdGxlUHJvbWlzZTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHwgdW5kZWZpbmVkO1xuXG5cdFx0XHRcdGlmIChhZ2VudFBhcnQgfHwgKGRlZmF1bHRBZ2VudCAmJiAhY29tbWFuZFBhcnQpKSB7XG5cdFx0XHRcdFx0Y29uc3QgcHJlcGFyZUNoYXRBZ2VudFJlcXVlc3QgPSBhc3luYyAoYWdlbnQ6IElDaGF0QWdlbnREYXRhLCBjb21tYW5kPzogSUNoYXRBZ2VudENvbW1hbmQsIGVuYWJsZUNvbW1hbmREZXRlY3Rpb24/OiBib29sZWFuLCBjaGF0UmVxdWVzdD86IENoYXRSZXF1ZXN0TW9kZWwsIGlzUGFydGljaXBhbnREZXRlY3RlZD86IGJvb2xlYW4pOiBQcm9taXNlPElDaGF0QWdlbnRSZXF1ZXN0PiA9PiB7XG5cdFx0XHRcdFx0XHRjb25zdCBpbml0VmFyaWFibGVEYXRhOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEgPSB7IHZhcmlhYmxlczogW10gfTtcblx0XHRcdFx0XHRcdHJlcXVlc3QgPSBjaGF0UmVxdWVzdCA/PyBtb2RlbC5hZGRSZXF1ZXN0KHBhcnNlZFJlcXVlc3QsIGluaXRWYXJpYWJsZURhdGEsIGF0dGVtcHQsIGFnZW50LCBjb21tYW5kLCBvcHRpb25zPy5jb25maXJtYXRpb24sIG9wdGlvbnM/LmxvY2F0aW9uRGF0YSwgb3B0aW9ucz8uYXR0YWNoZWRDb250ZXh0LCB1bmRlZmluZWQsIG9wdGlvbnM/LnVzZXJTZWxlY3RlZE1vZGVsSWQpO1xuXG5cdFx0XHRcdFx0XHRsZXQgdmFyaWFibGVEYXRhOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGE7XG5cdFx0XHRcdFx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXHRcdFx0XHRcdFx0aWYgKGNoYXRSZXF1ZXN0KSB7XG5cdFx0XHRcdFx0XHRcdHZhcmlhYmxlRGF0YSA9IGNoYXRSZXF1ZXN0LnZhcmlhYmxlRGF0YTtcblx0XHRcdFx0XHRcdFx0bWVzc2FnZSA9IGdldFByb21wdFRleHQocmVxdWVzdC5tZXNzYWdlKS5tZXNzYWdlO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dmFyaWFibGVEYXRhID0gdGhpcy5jaGF0VmFyaWFibGVzU2VydmljZS5yZXNvbHZlVmFyaWFibGVzKHBhcnNlZFJlcXVlc3QsIHJlcXVlc3QuYXR0YWNoZWRDb250ZXh0KTtcblx0XHRcdFx0XHRcdFx0bW9kZWwudXBkYXRlUmVxdWVzdChyZXF1ZXN0LCB2YXJpYWJsZURhdGEpO1xuXG5cdFx0XHRcdFx0XHRcdGNvbnN0IHByb21wdFRleHRSZXN1bHQgPSBnZXRQcm9tcHRUZXh0KHJlcXVlc3QubWVzc2FnZSk7XG5cdFx0XHRcdFx0XHRcdHZhcmlhYmxlRGF0YSA9IHVwZGF0ZVJhbmdlcyh2YXJpYWJsZURhdGEsIHByb21wdFRleHRSZXN1bHQuZGlmZik7IC8vIFRPRE8gYml0IG9mIGEgaGFja1xuXHRcdFx0XHRcdFx0XHRtZXNzYWdlID0gcHJvbXB0VGV4dFJlc3VsdC5tZXNzYWdlO1xuXHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRyZXR1cm4ge1xuXHRcdFx0XHRcdFx0XHRzZXNzaW9uSWQsXG5cdFx0XHRcdFx0XHRcdHJlcXVlc3RJZDogcmVxdWVzdC5pZCxcblx0XHRcdFx0XHRcdFx0YWdlbnRJZDogYWdlbnQuaWQsXG5cdFx0XHRcdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdFx0XHRcdGNvbW1hbmQ6IGNvbW1hbmQ/Lm5hbWUsXG5cdFx0XHRcdFx0XHRcdHZhcmlhYmxlczogdmFyaWFibGVEYXRhLFxuXHRcdFx0XHRcdFx0XHRlbmFibGVDb21tYW5kRGV0ZWN0aW9uLFxuXHRcdFx0XHRcdFx0XHRpc1BhcnRpY2lwYW50RGV0ZWN0ZWQsXG5cdFx0XHRcdFx0XHRcdGF0dGVtcHQsXG5cdFx0XHRcdFx0XHRcdGxvY2F0aW9uLFxuXHRcdFx0XHRcdFx0XHRsb2NhdGlvbkRhdGE6IHJlcXVlc3QubG9jYXRpb25EYXRhLFxuXHRcdFx0XHRcdFx0XHRhY2NlcHRlZENvbmZpcm1hdGlvbkRhdGE6IG9wdGlvbnM/LmFjY2VwdGVkQ29uZmlybWF0aW9uRGF0YSxcblx0XHRcdFx0XHRcdFx0cmVqZWN0ZWRDb25maXJtYXRpb25EYXRhOiBvcHRpb25zPy5yZWplY3RlZENvbmZpcm1hdGlvbkRhdGEsXG5cdFx0XHRcdFx0XHRcdHVzZXJTZWxlY3RlZE1vZGVsSWQ6IG9wdGlvbnM/LnVzZXJTZWxlY3RlZE1vZGVsSWQsXG5cdFx0XHRcdFx0XHRcdHVzZXJTZWxlY3RlZFRvb2xzOiBvcHRpb25zPy51c2VyU2VsZWN0ZWRUb29sc1xuXHRcdFx0XHRcdFx0fSBzYXRpc2ZpZXMgSUNoYXRBZ2VudFJlcXVlc3Q7XG5cdFx0XHRcdFx0fTtcblxuXHRcdFx0XHRcdGlmICh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlLmdldFZhbHVlKCdjaGF0LmRldGVjdFBhcnRpY2lwYW50LmVuYWJsZWQnKSAhPT0gZmFsc2UgJiYgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmhhc0NoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVycygpICYmICFhZ2VudFBhcnQgJiYgIWNvbW1hbmRQYXJ0ICYmICFhZ2VudFNsYXNoQ29tbWFuZFBhcnQgJiYgZW5hYmxlQ29tbWFuZERldGVjdGlvbiAmJiBvcHRpb25zPy5tb2RlICE9PSBDaGF0TW9kZS5BZ2VudCAmJiBvcHRpb25zPy5tb2RlICE9PSBDaGF0TW9kZS5FZGl0KSB7XG5cdFx0XHRcdFx0XHQvLyBXZSBoYXZlIG5vIGFnZW50IG9yIGNvbW1hbmQgdG8gc2NvcGUgaGlzdG9yeSB3aXRoLCBwYXNzIHRoZSBmdWxsIGhpc3RvcnkgdG8gdGhlIHBhcnRpY2lwYW50IGRldGVjdGlvbiBwcm92aWRlclxuXHRcdFx0XHRcdFx0Y29uc3QgZGVmYXVsdEFnZW50SGlzdG9yeSA9IHRoaXMuZ2V0SGlzdG9yeUVudHJpZXNGcm9tTW9kZWwocmVxdWVzdHMsIG1vZGVsLnNlc3Npb25JZCwgbG9jYXRpb24sIGRlZmF1bHRBZ2VudC5pZCk7XG5cblx0XHRcdFx0XHRcdC8vIFByZXBhcmUgdGhlIHJlcXVlc3Qgb2JqZWN0IHRoYXQgd2Ugd2lsbCBzZW5kIHRvIHRoZSBwYXJ0aWNpcGFudCBkZXRlY3Rpb24gcHJvdmlkZXJcblx0XHRcdFx0XHRcdGNvbnN0IGNoYXRBZ2VudFJlcXVlc3QgPSBhd2FpdCBwcmVwYXJlQ2hhdEFnZW50UmVxdWVzdChkZWZhdWx0QWdlbnQsIHVuZGVmaW5lZCwgZW5hYmxlQ29tbWFuZERldGVjdGlvbiwgdW5kZWZpbmVkLCBmYWxzZSk7XG5cblx0XHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuY2hhdEFnZW50U2VydmljZS5kZXRlY3RBZ2VudE9yQ29tbWFuZChjaGF0QWdlbnRSZXF1ZXN0LCBkZWZhdWx0QWdlbnRIaXN0b3J5LCB7IGxvY2F0aW9uIH0sIHRva2VuKTtcblx0XHRcdFx0XHRcdGlmIChyZXN1bHQgJiYgdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldEFnZW50KHJlc3VsdC5hZ2VudC5pZCk/LmxvY2F0aW9ucz8uaW5jbHVkZXMobG9jYXRpb24pKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFVwZGF0ZSB0aGUgcmVzcG9uc2UgaW4gdGhlIENoYXRNb2RlbCB0byByZWZsZWN0IHRoZSBkZXRlY3RlZCBhZ2VudCBhbmQgY29tbWFuZFxuXHRcdFx0XHRcdFx0XHRyZXF1ZXN0LnJlc3BvbnNlPy5zZXRBZ2VudChyZXN1bHQuYWdlbnQsIHJlc3VsdC5jb21tYW5kKTtcblx0XHRcdFx0XHRcdFx0ZGV0ZWN0ZWRBZ2VudCA9IHJlc3VsdC5hZ2VudDtcblx0XHRcdFx0XHRcdFx0ZGV0ZWN0ZWRDb21tYW5kID0gcmVzdWx0LmNvbW1hbmQ7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0Y29uc3QgYWdlbnQgPSAoZGV0ZWN0ZWRBZ2VudCA/PyBhZ2VudFBhcnQ/LmFnZW50ID8/IGRlZmF1bHRBZ2VudCkhO1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmQgPSBkZXRlY3RlZENvbW1hbmQgPz8gYWdlbnRTbGFzaENvbW1hbmRQYXJ0Py5jb21tYW5kO1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoYG9uQ2hhdFBhcnRpY2lwYW50OiR7YWdlbnQuaWR9YCk7XG5cdFx0XHRcdFx0YXdhaXQgdGhpcy5jaGVja0FnZW50QWxsb3dlZChhZ2VudCk7XG5cblx0XHRcdFx0XHQvLyBSZWNvbXB1dGUgaGlzdG9yeSBpbiBjYXNlIHRoZSBhZ2VudCBvciBjb21tYW5kIGNoYW5nZWRcblx0XHRcdFx0XHRjb25zdCBoaXN0b3J5ID0gdGhpcy5nZXRIaXN0b3J5RW50cmllc0Zyb21Nb2RlbChyZXF1ZXN0cywgbW9kZWwuc2Vzc2lvbklkLCBsb2NhdGlvbiwgYWdlbnQuaWQpO1xuXHRcdFx0XHRcdGNvbnN0IHJlcXVlc3RQcm9wcyA9IGF3YWl0IHByZXBhcmVDaGF0QWdlbnRSZXF1ZXN0KGFnZW50LCBjb21tYW5kLCBlbmFibGVDb21tYW5kRGV0ZWN0aW9uLCByZXF1ZXN0IC8qIFJldXNlIHRoZSByZXF1ZXN0IG9iamVjdCBpZiB3ZSBhbHJlYWR5IGNyZWF0ZWQgaXQgZm9yIHBhcnRpY2lwYW50IGRldGVjdGlvbiAqLywgISFkZXRlY3RlZEFnZW50KTtcblx0XHRcdFx0XHRjb25zdCBwZW5kaW5nUmVxdWVzdCA9IHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5nZXQoc2Vzc2lvbklkKTtcblx0XHRcdFx0XHRpZiAocGVuZGluZ1JlcXVlc3QgJiYgIXBlbmRpbmdSZXF1ZXN0LnJlcXVlc3RJZCkge1xuXHRcdFx0XHRcdFx0cGVuZGluZ1JlcXVlc3QucmVxdWVzdElkID0gcmVxdWVzdFByb3BzLnJlcXVlc3RJZDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0Y29tcGxldGVSZXNwb25zZUNyZWF0ZWQoKTtcblx0XHRcdFx0XHRjb25zdCBhZ2VudFJlc3VsdCA9IGF3YWl0IHRoaXMuY2hhdEFnZW50U2VydmljZS5pbnZva2VBZ2VudChhZ2VudC5pZCwgcmVxdWVzdFByb3BzLCBwcm9ncmVzc0NhbGxiYWNrLCBoaXN0b3J5LCB0b2tlbik7XG5cdFx0XHRcdFx0cmF3UmVzdWx0ID0gYWdlbnRSZXN1bHQ7XG5cdFx0XHRcdFx0YWdlbnRPckNvbW1hbmRGb2xsb3d1cHMgPSB0aGlzLmNoYXRBZ2VudFNlcnZpY2UuZ2V0Rm9sbG93dXBzKGFnZW50LmlkLCByZXF1ZXN0UHJvcHMsIGFnZW50UmVzdWx0LCBoaXN0b3J5LCBmb2xsb3d1cHNDYW5jZWxUb2tlbik7XG5cdFx0XHRcdFx0Y2hhdFRpdGxlUHJvbWlzZSA9IG1vZGVsLmdldFJlcXVlc3RzKCkubGVuZ3RoID09PSAxICYmICFtb2RlbC5jdXN0b21UaXRsZSA/IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXRDaGF0VGl0bGUoZGVmYXVsdEFnZW50LmlkLCB0aGlzLmdldEhpc3RvcnlFbnRyaWVzRnJvbU1vZGVsKG1vZGVsLmdldFJlcXVlc3RzKCksIG1vZGVsLnNlc3Npb25JZCwgbG9jYXRpb24sIGFnZW50LmlkKSwgQ2FuY2VsbGF0aW9uVG9rZW4uTm9uZSkgOiB1bmRlZmluZWQ7XG5cdFx0XHRcdH0gZWxzZSBpZiAoY29tbWFuZFBhcnQgJiYgdGhpcy5jaGF0U2xhc2hDb21tYW5kU2VydmljZS5oYXNDb21tYW5kKGNvbW1hbmRQYXJ0LnNsYXNoQ29tbWFuZC5jb21tYW5kKSkge1xuXHRcdFx0XHRcdHJlcXVlc3QgPSBtb2RlbC5hZGRSZXF1ZXN0KHBhcnNlZFJlcXVlc3QsIHsgdmFyaWFibGVzOiBbXSB9LCBhdHRlbXB0KTtcblx0XHRcdFx0XHRjb21wbGV0ZVJlc3BvbnNlQ3JlYXRlZCgpO1xuXHRcdFx0XHRcdC8vIGNvbnRyaWJ1dGVkIHNsYXNoIGNvbW1hbmRzXG5cdFx0XHRcdFx0Ly8gVE9ETzogc3BlbGwgdGhpcyBvdXQgaW4gdGhlIFVJXG5cdFx0XHRcdFx0Y29uc3QgaGlzdG9yeTogSUNoYXRNZXNzYWdlW10gPSBbXTtcblx0XHRcdFx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgbW9kZWwuZ2V0UmVxdWVzdHMoKSkge1xuXHRcdFx0XHRcdFx0aWYgKCFyZXF1ZXN0LnJlc3BvbnNlKSB7XG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0aGlzdG9yeS5wdXNoKHsgcm9sZTogQ2hhdE1lc3NhZ2VSb2xlLlVzZXIsIGNvbnRlbnQ6IFt7IHR5cGU6ICd0ZXh0JywgdmFsdWU6IHJlcXVlc3QubWVzc2FnZS50ZXh0IH1dIH0pO1xuXHRcdFx0XHRcdFx0aGlzdG9yeS5wdXNoKHsgcm9sZTogQ2hhdE1lc3NhZ2VSb2xlLkFzc2lzdGFudCwgY29udGVudDogW3sgdHlwZTogJ3RleHQnLCB2YWx1ZTogcmVxdWVzdC5yZXNwb25zZS5yZXNwb25zZS50b1N0cmluZygpIH1dIH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gcGFyc2VkUmVxdWVzdC50ZXh0O1xuXHRcdFx0XHRcdGNvbnN0IGNvbW1hbmRSZXN1bHQgPSBhd2FpdCB0aGlzLmNoYXRTbGFzaENvbW1hbmRTZXJ2aWNlLmV4ZWN1dGVDb21tYW5kKGNvbW1hbmRQYXJ0LnNsYXNoQ29tbWFuZC5jb21tYW5kLCBtZXNzYWdlLnN1YnN0cmluZyhjb21tYW5kUGFydC5zbGFzaENvbW1hbmQuY29tbWFuZC5sZW5ndGggKyAxKS50cmltU3RhcnQoKSwgbmV3IFByb2dyZXNzPElDaGF0UHJvZ3Jlc3M+KHAgPT4ge1xuXHRcdFx0XHRcdFx0cHJvZ3Jlc3NDYWxsYmFjayhwKTtcblx0XHRcdFx0XHR9KSwgaGlzdG9yeSwgbG9jYXRpb24sIHRva2VuKTtcblx0XHRcdFx0XHRhZ2VudE9yQ29tbWFuZEZvbGxvd3VwcyA9IFByb21pc2UucmVzb2x2ZShjb21tYW5kUmVzdWx0Py5mb2xsb3dVcCk7XG5cdFx0XHRcdFx0cmF3UmVzdWx0ID0ge307XG5cblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYENhbm5vdCBoYW5kbGUgcmVxdWVzdGApO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGlmICghcmF3UmVzdWx0KSB7XG5cdFx0XHRcdFx0XHR0aGlzLnRyYWNlKCdzZW5kUmVxdWVzdCcsIGBQcm92aWRlciByZXR1cm5lZCBubyByZXNwb25zZSBmb3Igc2Vzc2lvbiAke21vZGVsLnNlc3Npb25JZH1gKTtcblx0XHRcdFx0XHRcdHJhd1Jlc3VsdCA9IHsgZXJyb3JEZXRhaWxzOiB7IG1lc3NhZ2U6IGxvY2FsaXplKCdlbXB0eVJlc3BvbnNlJywgXCJQcm92aWRlciByZXR1cm5lZCBudWxsIHJlc3BvbnNlXCIpIH0gfTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCByZXN1bHQgPSByYXdSZXN1bHQuZXJyb3JEZXRhaWxzPy5yZXNwb25zZUlzRmlsdGVyZWQgPyAnZmlsdGVyZWQnIDpcblx0XHRcdFx0XHRcdHJhd1Jlc3VsdC5lcnJvckRldGFpbHMgJiYgZ290UHJvZ3Jlc3MgPyAnZXJyb3JXaXRoT3V0cHV0JyA6XG5cdFx0XHRcdFx0XHRcdHJhd1Jlc3VsdC5lcnJvckRldGFpbHMgPyAnZXJyb3InIDpcblx0XHRcdFx0XHRcdFx0XHQnc3VjY2Vzcyc7XG5cdFx0XHRcdFx0Y29uc3QgY29tbWFuZEZvclRlbGVtZXRyeSA9IGFnZW50U2xhc2hDb21tYW5kUGFydCA/IGFnZW50U2xhc2hDb21tYW5kUGFydC5jb21tYW5kLm5hbWUgOiBjb21tYW5kUGFydD8uc2xhc2hDb21tYW5kLmNvbW1hbmQ7XG5cdFx0XHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8Q2hhdFByb3ZpZGVySW52b2tlZEV2ZW50LCBDaGF0UHJvdmlkZXJJbnZva2VkQ2xhc3NpZmljYXRpb24+KCdpbnRlcmFjdGl2ZVNlc3Npb25Qcm92aWRlckludm9rZWQnLCB7XG5cdFx0XHRcdFx0XHR0aW1lVG9GaXJzdFByb2dyZXNzOiByYXdSZXN1bHQudGltaW5ncz8uZmlyc3RQcm9ncmVzcyxcblx0XHRcdFx0XHRcdHRvdGFsVGltZTogcmF3UmVzdWx0LnRpbWluZ3M/LnRvdGFsRWxhcHNlZCxcblx0XHRcdFx0XHRcdHJlc3VsdCxcblx0XHRcdFx0XHRcdHJlcXVlc3RUeXBlLFxuXHRcdFx0XHRcdFx0YWdlbnQ6IGRldGVjdGVkQWdlbnQ/LmlkID8/IGFnZW50UGFydD8uYWdlbnQuaWQgPz8gJycsXG5cdFx0XHRcdFx0XHRhZ2VudEV4dGVuc2lvbklkOiBkZXRlY3RlZEFnZW50Py5leHRlbnNpb25JZC52YWx1ZSA/PyBhZ2VudFBhcnQ/LmFnZW50LmV4dGVuc2lvbklkLnZhbHVlID8/ICcnLFxuXHRcdFx0XHRcdFx0c2xhc2hDb21tYW5kOiBjb21tYW5kRm9yVGVsZW1ldHJ5LFxuXHRcdFx0XHRcdFx0Y2hhdFNlc3Npb25JZDogbW9kZWwuc2Vzc2lvbklkLFxuXHRcdFx0XHRcdFx0ZW5hYmxlQ29tbWFuZERldGVjdGlvbixcblx0XHRcdFx0XHRcdGlzUGFydGljaXBhbnREZXRlY3RlZDogISFkZXRlY3RlZEFnZW50LFxuXHRcdFx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdFx0XHRjaXRhdGlvbnM6IHJlcXVlc3QucmVzcG9uc2U/LmNvZGVDaXRhdGlvbnMubGVuZ3RoID8/IDAsXG5cdFx0XHRcdFx0XHRudW1Db2RlQmxvY2tzOiBnZXRDb2RlQmxvY2tzKHJlcXVlc3QucmVzcG9uc2U/LnJlc3BvbnNlLnRvU3RyaW5nKCkgPz8gJycpLmxlbmd0aCxcblx0XHRcdFx0XHRcdGF0dGFjaG1lbnRLaW5kczogdGhpcy5hdHRhY2htZW50S2luZHNGb3JUZWxlbWV0cnkocmVxdWVzdC52YXJpYWJsZURhdGEpXG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdFx0bW9kZWwuc2V0UmVzcG9uc2UocmVxdWVzdCwgcmF3UmVzdWx0KTtcblx0XHRcdFx0XHRjb21wbGV0ZVJlc3BvbnNlQ3JlYXRlZCgpO1xuXHRcdFx0XHRcdHRoaXMudHJhY2UoJ3NlbmRSZXF1ZXN0JywgYFByb3ZpZGVyIHJldHVybmVkIHJlc3BvbnNlIGZvciBzZXNzaW9uICR7bW9kZWwuc2Vzc2lvbklkfWApO1xuXG5cdFx0XHRcdFx0bW9kZWwuY29tcGxldGVSZXNwb25zZShyZXF1ZXN0KTtcblx0XHRcdFx0XHRpZiAoYWdlbnRPckNvbW1hbmRGb2xsb3d1cHMpIHtcblx0XHRcdFx0XHRcdGFnZW50T3JDb21tYW5kRm9sbG93dXBzLnRoZW4oZm9sbG93dXBzID0+IHtcblx0XHRcdFx0XHRcdFx0bW9kZWwuc2V0Rm9sbG93dXBzKHJlcXVlc3QsIGZvbGxvd3Vwcyk7XG5cdFx0XHRcdFx0XHRcdHRoaXMuX2NoYXRTZXJ2aWNlVGVsZW1ldHJ5LnJldHJpZXZlZEZvbGxvd3VwcyhhZ2VudFBhcnQ/LmFnZW50LmlkID8/ICcnLCBjb21tYW5kRm9yVGVsZW1ldHJ5LCBmb2xsb3d1cHM/Lmxlbmd0aCA/PyAwKTtcblx0XHRcdFx0XHRcdH0pO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRjaGF0VGl0bGVQcm9taXNlPy50aGVuKHRpdGxlID0+IHtcblx0XHRcdFx0XHRcdGlmICh0aXRsZSkge1xuXHRcdFx0XHRcdFx0XHRtb2RlbC5zZXRDdXN0b21UaXRsZSh0aXRsZSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSk7XG5cdFx0XHRcdH1cblx0XHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0XHRjb25zdCByZXN1bHQgPSAnZXJyb3InO1xuXHRcdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxDaGF0UHJvdmlkZXJJbnZva2VkRXZlbnQsIENoYXRQcm92aWRlckludm9rZWRDbGFzc2lmaWNhdGlvbj4oJ2ludGVyYWN0aXZlU2Vzc2lvblByb3ZpZGVySW52b2tlZCcsIHtcblx0XHRcdFx0XHR0aW1lVG9GaXJzdFByb2dyZXNzOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0dG90YWxUaW1lOiB1bmRlZmluZWQsXG5cdFx0XHRcdFx0cmVzdWx0LFxuXHRcdFx0XHRcdHJlcXVlc3RUeXBlLFxuXHRcdFx0XHRcdGFnZW50OiBkZXRlY3RlZEFnZW50Py5pZCA/PyBhZ2VudFBhcnQ/LmFnZW50LmlkID8/ICcnLFxuXHRcdFx0XHRcdGFnZW50RXh0ZW5zaW9uSWQ6IGRldGVjdGVkQWdlbnQ/LmV4dGVuc2lvbklkLnZhbHVlID8/IGFnZW50UGFydD8uYWdlbnQuZXh0ZW5zaW9uSWQudmFsdWUgPz8gJycsXG5cdFx0XHRcdFx0c2xhc2hDb21tYW5kOiBhZ2VudFNsYXNoQ29tbWFuZFBhcnQgPyBhZ2VudFNsYXNoQ29tbWFuZFBhcnQuY29tbWFuZC5uYW1lIDogY29tbWFuZFBhcnQ/LnNsYXNoQ29tbWFuZC5jb21tYW5kLFxuXHRcdFx0XHRcdGNoYXRTZXNzaW9uSWQ6IG1vZGVsLnNlc3Npb25JZCxcblx0XHRcdFx0XHRsb2NhdGlvbixcblx0XHRcdFx0XHRjaXRhdGlvbnM6IDAsXG5cdFx0XHRcdFx0bnVtQ29kZUJsb2NrczogMCxcblx0XHRcdFx0XHRlbmFibGVDb21tYW5kRGV0ZWN0aW9uLFxuXHRcdFx0XHRcdGlzUGFydGljaXBhbnREZXRlY3RlZDogISFkZXRlY3RlZEFnZW50LFxuXHRcdFx0XHRcdGF0dGFjaG1lbnRLaW5kczogdGhpcy5hdHRhY2htZW50S2luZHNGb3JUZWxlbWV0cnkocmVxdWVzdC52YXJpYWJsZURhdGEpXG5cdFx0XHRcdH0pO1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYEVycm9yIHdoaWxlIGhhbmRsaW5nIGNoYXQgcmVxdWVzdDogJHt0b0Vycm9yTWVzc2FnZShlcnIsIHRydWUpfWApO1xuXHRcdFx0XHRpZiAocmVxdWVzdCkge1xuXHRcdFx0XHRcdGNvbnN0IHJhd1Jlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCA9IHsgZXJyb3JEZXRhaWxzOiB7IG1lc3NhZ2U6IGVyci5tZXNzYWdlIH0gfTtcblx0XHRcdFx0XHRtb2RlbC5zZXRSZXNwb25zZShyZXF1ZXN0LCByYXdSZXN1bHQpO1xuXHRcdFx0XHRcdGNvbXBsZXRlUmVzcG9uc2VDcmVhdGVkKCk7XG5cdFx0XHRcdFx0bW9kZWwuY29tcGxldGVSZXNwb25zZShyZXF1ZXN0KTtcblx0XHRcdFx0fVxuXHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0bGlzdGVuZXIuZGlzcG9zZSgpO1xuXHRcdFx0fVxuXHRcdH07XG5cdFx0Y29uc3QgcmF3UmVzcG9uc2VQcm9taXNlID0gc2VuZFJlcXVlc3RJbnRlcm5hbCgpO1xuXHRcdC8vIE5vdGUtIHJlcXVlc3RJZCBpcyBub3Qga25vd24gYXQgdGhpcyBwb2ludCwgYXNzaWduZWQgbGF0ZXJcblx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdHMuc2V0KG1vZGVsLnNlc3Npb25JZCwgdGhpcy5pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDYW5jZWxsYWJsZVJlcXVlc3QsIHNvdXJjZSwgdW5kZWZpbmVkKSk7XG5cdFx0cmF3UmVzcG9uc2VQcm9taXNlLmZpbmFsbHkoKCkgPT4ge1xuXHRcdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZUFuZERpc3Bvc2UobW9kZWwuc2Vzc2lvbklkKTtcblx0XHR9KTtcblx0XHR0aGlzLl9vbkRpZFN1Ym1pdFJlcXVlc3QuZmlyZSh7IGNoYXRTZXNzaW9uSWQ6IG1vZGVsLnNlc3Npb25JZCB9KTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0cmVzcG9uc2VDcmVhdGVkUHJvbWlzZTogcmVzcG9uc2VDcmVhdGVkLnAsXG5cdFx0XHRyZXNwb25zZUNvbXBsZXRlUHJvbWlzZTogcmF3UmVzcG9uc2VQcm9taXNlLFxuXHRcdH07XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGNoZWNrQWdlbnRBbGxvd2VkKGFnZW50OiBJQ2hhdEFnZW50RGF0YSk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmIChhZ2VudC5pc1Rvb2xzQWdlbnQpIHtcblx0XHRcdGNvbnN0IGVuYWJsZWQgPSBhd2FpdCB0aGlzLmV4cGVyaW1lbnRTZXJ2aWNlLmdldFRyZWF0bWVudDxib29sZWFuPignY2hhdEFnZW50RW5hYmxlZCcpO1xuXHRcdFx0aWYgKGVuYWJsZWQgPT09IGZhbHNlKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignQWdlbnQgaXMgY3VycmVudGx5IGRpc2FibGVkJyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBhdHRhY2htZW50S2luZHNGb3JUZWxlbWV0cnkodmFyaWFibGVEYXRhOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEpOiBzdHJpbmdbXSB7XG5cdFx0Ly8gVE9ETyB0aGlzIHNob3dzIHdoeSBhdHRhY2htZW50cyBzdGlsbCBoYXZlIHRvIGJlIGNsZWFuZWQgdXAgc29tZXdoYXRcblx0XHRyZXR1cm4gdmFyaWFibGVEYXRhLnZhcmlhYmxlcy5tYXAodiA9PiB7XG5cdFx0XHRpZiAodi5raW5kID09PSAnaW1wbGljaXQnKSB7XG5cdFx0XHRcdHJldHVybiAnaW1wbGljaXQnO1xuXHRcdFx0fSBlbHNlIGlmICh2LnJhbmdlKSB7XG5cdFx0XHRcdC8vICdyYW5nZScgaXMgcmFuZ2Ugd2l0aGluIHRoZSBwcm9tcHQgdGV4dFxuXHRcdFx0XHRpZiAodi5pc1Rvb2wpIHtcblx0XHRcdFx0XHRyZXR1cm4gJ3Rvb2xJblByb21wdCc7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0cmV0dXJuICdmaWxlSW5Qcm9tcHQnO1xuXHRcdFx0XHR9XG5cdFx0XHR9IGVsc2UgaWYgKHYua2luZCA9PT0gJ2NvbW1hbmQnKSB7XG5cdFx0XHRcdHJldHVybiAnY29tbWFuZCc7XG5cdFx0XHR9IGVsc2UgaWYgKHYua2luZCA9PT0gJ3N5bWJvbCcpIHtcblx0XHRcdFx0cmV0dXJuICdzeW1ib2wnO1xuXHRcdFx0fSBlbHNlIGlmICh2LmlzSW1hZ2UpIHtcblx0XHRcdFx0cmV0dXJuICdpbWFnZSc7XG5cdFx0XHR9IGVsc2UgaWYgKHYuaXNEaXJlY3RvcnkpIHtcblx0XHRcdFx0cmV0dXJuICdkaXJlY3RvcnknO1xuXHRcdFx0fSBlbHNlIGlmICh2LmlzVG9vbCkge1xuXHRcdFx0XHRyZXR1cm4gJ3Rvb2wnO1xuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKFVSSS5pc1VyaSh2LnZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiAnZmlsZSc7XG5cdFx0XHRcdH0gZWxzZSBpZiAoaXNMb2NhdGlvbih2LnZhbHVlKSkge1xuXHRcdFx0XHRcdHJldHVybiAnbG9jYXRpb24nO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHJldHVybiAnb3RoZXJBdHRhY2htZW50Jztcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXRIaXN0b3J5RW50cmllc0Zyb21Nb2RlbChyZXF1ZXN0czogSUNoYXRSZXF1ZXN0TW9kZWxbXSwgc2Vzc2lvbklkOiBzdHJpbmcsIGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgZm9yQWdlbnRJZDogc3RyaW5nKTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeVtdIHtcblx0XHRjb25zdCBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5W10gPSBbXTtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXRBZ2VudChmb3JBZ2VudElkKTtcblx0XHRmb3IgKGNvbnN0IHJlcXVlc3Qgb2YgcmVxdWVzdHMpIHtcblx0XHRcdGlmICghcmVxdWVzdC5yZXNwb25zZSkge1xuXHRcdFx0XHRjb250aW51ZTtcblx0XHRcdH1cblxuXHRcdFx0aWYgKGZvckFnZW50SWQgIT09IHJlcXVlc3QucmVzcG9uc2UuYWdlbnQ/LmlkICYmICFhZ2VudD8uaXNEZWZhdWx0KSB7XG5cdFx0XHRcdC8vIEFuIGFnZW50IG9ubHkgZ2V0cyB0byBzZWUgcmVxdWVzdHMgdGhhdCB3ZXJlIHNlbnQgdG8gdGhpcyBhZ2VudC5cblx0XHRcdFx0Ly8gVGhlIGRlZmF1bHQgYWdlbnQgKHRoZSB1bmRlZmluZWQgY2FzZSkgZ2V0cyB0byBzZWUgYWxsIG9mIHRoZW0uXG5cdFx0XHRcdGNvbnRpbnVlO1xuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBwcm9tcHRUZXh0UmVzdWx0ID0gZ2V0UHJvbXB0VGV4dChyZXF1ZXN0Lm1lc3NhZ2UpO1xuXHRcdFx0Y29uc3QgaGlzdG9yeVJlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0ID0ge1xuXHRcdFx0XHRzZXNzaW9uSWQ6IHNlc3Npb25JZCxcblx0XHRcdFx0cmVxdWVzdElkOiByZXF1ZXN0LmlkLFxuXHRcdFx0XHRhZ2VudElkOiByZXF1ZXN0LnJlc3BvbnNlLmFnZW50Py5pZCA/PyAnJyxcblx0XHRcdFx0bWVzc2FnZTogcHJvbXB0VGV4dFJlc3VsdC5tZXNzYWdlLFxuXHRcdFx0XHRjb21tYW5kOiByZXF1ZXN0LnJlc3BvbnNlLnNsYXNoQ29tbWFuZD8ubmFtZSxcblx0XHRcdFx0dmFyaWFibGVzOiB1cGRhdGVSYW5nZXMocmVxdWVzdC52YXJpYWJsZURhdGEsIHByb21wdFRleHRSZXN1bHQuZGlmZiksIC8vIFRPRE8gYml0IG9mIGEgaGFja1xuXHRcdFx0XHRsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24uUGFuZWxcblx0XHRcdH07XG5cdFx0XHRoaXN0b3J5LnB1c2goeyByZXF1ZXN0OiBoaXN0b3J5UmVxdWVzdCwgcmVzcG9uc2U6IHRvQ2hhdEhpc3RvcnlDb250ZW50KHJlcXVlc3QucmVzcG9uc2UucmVzcG9uc2UudmFsdWUpLCByZXN1bHQ6IHJlcXVlc3QucmVzcG9uc2UucmVzdWx0ID8/IHt9IH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiBoaXN0b3J5O1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlUmVxdWVzdChzZXNzaW9uSWQ6IHN0cmluZywgcmVxdWVzdElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRjb25zdCBtb2RlbCA9IHRoaXMuX3Nlc3Npb25Nb2RlbHMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0aWYgKCFtb2RlbCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBVbmtub3duIHNlc3Npb246ICR7c2Vzc2lvbklkfWApO1xuXHRcdH1cblxuXHRcdGF3YWl0IG1vZGVsLndhaXRGb3JJbml0aWFsaXphdGlvbigpO1xuXG5cdFx0Y29uc3QgcGVuZGluZ1JlcXVlc3QgPSB0aGlzLl9wZW5kaW5nUmVxdWVzdHMuZ2V0KHNlc3Npb25JZCk7XG5cdFx0aWYgKHBlbmRpbmdSZXF1ZXN0Py5yZXF1ZXN0SWQgPT09IHJlcXVlc3RJZCkge1xuXHRcdFx0cGVuZGluZ1JlcXVlc3QuY2FuY2VsKCk7XG5cdFx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdHMuZGVsZXRlQW5kRGlzcG9zZShzZXNzaW9uSWQpO1xuXHRcdH1cblxuXHRcdG1vZGVsLnJlbW92ZVJlcXVlc3QocmVxdWVzdElkKTtcblx0fVxuXG5cdGFzeW5jIGFkb3B0UmVxdWVzdChzZXNzaW9uSWQ6IHN0cmluZywgcmVxdWVzdDogSUNoYXRSZXF1ZXN0TW9kZWwpIHtcblx0XHRpZiAoIShyZXF1ZXN0IGluc3RhbmNlb2YgQ2hhdFJlcXVlc3RNb2RlbCkpIHtcblx0XHRcdHRocm93IG5ldyBUeXBlRXJyb3IoJ0NhbiBvbmx5IGFkb3B0IHJlcXVlc3RzIG9mIHR5cGUgQ2hhdFJlcXVlc3RNb2RlbCcpO1xuXHRcdH1cblx0XHRjb25zdCB0YXJnZXQgPSB0aGlzLl9zZXNzaW9uTW9kZWxzLmdldChzZXNzaW9uSWQpO1xuXHRcdGlmICghdGFyZ2V0KSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gc2Vzc2lvbjogJHtzZXNzaW9uSWR9YCk7XG5cdFx0fVxuXG5cdFx0YXdhaXQgdGFyZ2V0LndhaXRGb3JJbml0aWFsaXphdGlvbigpO1xuXG5cdFx0Y29uc3Qgb2xkT3duZXIgPSByZXF1ZXN0LnNlc3Npb247XG5cdFx0dGFyZ2V0LmFkb3B0UmVxdWVzdChyZXF1ZXN0KTtcblxuXHRcdGlmIChyZXF1ZXN0LnJlc3BvbnNlICYmICFyZXF1ZXN0LnJlc3BvbnNlLmlzQ29tcGxldGUpIHtcblx0XHRcdGNvbnN0IGN0cyA9IHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5kZWxldGVBbmRMZWFrKG9sZE93bmVyLnNlc3Npb25JZCk7XG5cdFx0XHRpZiAoY3RzKSB7XG5cdFx0XHRcdGN0cy5yZXF1ZXN0SWQgPSByZXF1ZXN0LmlkO1xuXHRcdFx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdHMuc2V0KHRhcmdldC5zZXNzaW9uSWQsIGN0cyk7XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgYWRkQ29tcGxldGVSZXF1ZXN0KHNlc3Npb25JZDogc3RyaW5nLCBtZXNzYWdlOiBJUGFyc2VkQ2hhdFJlcXVlc3QgfCBzdHJpbmcsIHZhcmlhYmxlRGF0YTogSUNoYXRSZXF1ZXN0VmFyaWFibGVEYXRhIHwgdW5kZWZpbmVkLCBhdHRlbXB0OiBudW1iZXIgfCB1bmRlZmluZWQsIHJlc3BvbnNlOiBJQ2hhdENvbXBsZXRlUmVzcG9uc2UpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLnRyYWNlKCdhZGRDb21wbGV0ZVJlcXVlc3QnLCBgbWVzc2FnZTogJHttZXNzYWdlfWApO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSB0aGlzLl9zZXNzaW9uTW9kZWxzLmdldChzZXNzaW9uSWQpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgVW5rbm93biBzZXNzaW9uOiAke3Nlc3Npb25JZH1gKTtcblx0XHR9XG5cblx0XHRhd2FpdCBtb2RlbC53YWl0Rm9ySW5pdGlhbGl6YXRpb24oKTtcblx0XHRjb25zdCBwYXJzZWRSZXF1ZXN0ID0gdHlwZW9mIG1lc3NhZ2UgPT09ICdzdHJpbmcnID9cblx0XHRcdHRoaXMuaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdFJlcXVlc3RQYXJzZXIpLnBhcnNlQ2hhdFJlcXVlc3Qoc2Vzc2lvbklkLCBtZXNzYWdlKSA6XG5cdFx0XHRtZXNzYWdlO1xuXHRcdGNvbnN0IHJlcXVlc3QgPSBtb2RlbC5hZGRSZXF1ZXN0KHBhcnNlZFJlcXVlc3QsIHZhcmlhYmxlRGF0YSB8fCB7IHZhcmlhYmxlczogW10gfSwgYXR0ZW1wdCA/PyAwLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdHJ1ZSk7XG5cdFx0aWYgKHR5cGVvZiByZXNwb25zZS5tZXNzYWdlID09PSAnc3RyaW5nJykge1xuXHRcdFx0Ly8gVE9ETyBpcyB0aGlzIHBvc3NpYmxlP1xuXHRcdFx0bW9kZWwuYWNjZXB0UmVzcG9uc2VQcm9ncmVzcyhyZXF1ZXN0LCB7IGNvbnRlbnQ6IG5ldyBNYXJrZG93blN0cmluZyhyZXNwb25zZS5tZXNzYWdlKSwga2luZDogJ21hcmtkb3duQ29udGVudCcgfSk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGZvciAoY29uc3QgcGFydCBvZiByZXNwb25zZS5tZXNzYWdlKSB7XG5cdFx0XHRcdG1vZGVsLmFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdCwgcGFydCwgdHJ1ZSk7XG5cdFx0XHR9XG5cdFx0fVxuXHRcdG1vZGVsLnNldFJlc3BvbnNlKHJlcXVlc3QsIHJlc3BvbnNlLnJlc3VsdCB8fCB7fSk7XG5cdFx0aWYgKHJlc3BvbnNlLmZvbGxvd3VwcyAhPT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRtb2RlbC5zZXRGb2xsb3d1cHMocmVxdWVzdCwgcmVzcG9uc2UuZm9sbG93dXBzKTtcblx0XHR9XG5cdFx0bW9kZWwuY29tcGxldGVSZXNwb25zZShyZXF1ZXN0KTtcblx0fVxuXG5cdGNhbmNlbEN1cnJlbnRSZXF1ZXN0Rm9yU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdHRoaXMudHJhY2UoJ2NhbmNlbEN1cnJlbnRSZXF1ZXN0Rm9yU2Vzc2lvbicsIGBzZXNzaW9uSWQ6ICR7c2Vzc2lvbklkfWApO1xuXHRcdHRoaXMuX3BlbmRpbmdSZXF1ZXN0cy5nZXQoc2Vzc2lvbklkKT8uY2FuY2VsKCk7XG5cdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmRlbGV0ZUFuZERpc3Bvc2Uoc2Vzc2lvbklkKTtcblx0fVxuXG5cdGFzeW5jIGNsZWFyU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdHRoaXMudHJhY2UoJ2NsZWFyU2Vzc2lvbicsIGBzZXNzaW9uSWQ6ICR7c2Vzc2lvbklkfWApO1xuXHRcdGNvbnN0IG1vZGVsID0gdGhpcy5fc2Vzc2lvbk1vZGVscy5nZXQoc2Vzc2lvbklkKTtcblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHR0aHJvdyBuZXcgRXJyb3IoYFVua25vd24gc2Vzc2lvbjogJHtzZXNzaW9uSWR9YCk7XG5cdFx0fVxuXG5cdFx0aWYgKG1vZGVsLmluaXRpYWxMb2NhdGlvbiA9PT0gQ2hhdEFnZW50TG9jYXRpb24uUGFuZWwpIHtcblx0XHRcdGlmICh0aGlzLnVzZUZpbGVTdG9yYWdlKSB7XG5cdFx0XHRcdGlmIChtb2RlbC5nZXRSZXF1ZXN0cygpLmxlbmd0aCA9PT0gMCkge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2NoYXRTZXNzaW9uU3RvcmUuZGVsZXRlU2Vzc2lvbihzZXNzaW9uSWQpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdGF3YWl0IHRoaXMuX2NoYXRTZXNzaW9uU3RvcmUuc3RvcmVTZXNzaW9ucyhbbW9kZWxdKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0aWYgKG1vZGVsLmdldFJlcXVlc3RzKCkubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdFx0ZGVsZXRlIHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zW3Nlc3Npb25JZF07XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0Ly8gVHVybiBhbGwgdGhlIHJlYWwgb2JqZWN0cyBpbnRvIGFjdHVhbCBKU09OLCBvdGhlcndpc2UsIGNhbGxpbmcgJ3Jldml2ZScgbWF5IGZhaWwgd2hlbiBpdCB0cmllcyB0b1xuXHRcdFx0XHRcdC8vIGFzc2lnbiB2YWx1ZXMgdG8gcHJvcGVydGllcyB0aGF0IGFyZSBnZXR0ZXJzLSBtaWNyb3NvZnQvdnNjb2RlLWNvcGlsb3QtcmVsZWFzZSMxMjMzXG5cdFx0XHRcdFx0Y29uc3Qgc2Vzc2lvbkRhdGE6IElTZXJpYWxpemFibGVDaGF0RGF0YSA9IEpTT04ucGFyc2UoSlNPTi5zdHJpbmdpZnkobW9kZWwpKTtcblx0XHRcdFx0XHRzZXNzaW9uRGF0YS5pc05ldyA9IHRydWU7XG5cdFx0XHRcdFx0dGhpcy5fcGVyc2lzdGVkU2Vzc2lvbnNbc2Vzc2lvbklkXSA9IHNlc3Npb25EYXRhO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5fc2Vzc2lvbk1vZGVscy5kZWxldGVBbmREaXNwb3NlKHNlc3Npb25JZCk7XG5cdFx0dGhpcy5fcGVuZGluZ1JlcXVlc3RzLmdldChzZXNzaW9uSWQpPy5jYW5jZWwoKTtcblx0XHR0aGlzLl9wZW5kaW5nUmVxdWVzdHMuZGVsZXRlQW5kRGlzcG9zZShzZXNzaW9uSWQpO1xuXHRcdHRoaXMuX29uRGlkRGlzcG9zZVNlc3Npb24uZmlyZSh7IHNlc3Npb25JZCwgcmVhc29uOiAnY2xlYXJlZCcgfSk7XG5cdH1cblxuXHRwdWJsaWMgaGFzU2Vzc2lvbnMoKTogYm9vbGVhbiB7XG5cdFx0aWYgKHRoaXMudXNlRmlsZVN0b3JhZ2UpIHtcblx0XHRcdHJldHVybiB0aGlzLl9jaGF0U2Vzc2lvblN0b3JlLmhhc1Nlc3Npb25zKCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdHJldHVybiBPYmplY3QudmFsdWVzKHRoaXMuX3BlcnNpc3RlZFNlc3Npb25zKS5sZW5ndGggPiAwO1xuXHRcdH1cblx0fVxuXG5cdHRyYW5zZmVyQ2hhdFNlc3Npb24odHJhbnNmZXJyZWRTZXNzaW9uRGF0YTogSUNoYXRUcmFuc2ZlcnJlZFNlc3Npb25EYXRhLCB0b1dvcmtzcGFjZTogVVJJKTogdm9pZCB7XG5cdFx0Y29uc3QgbW9kZWwgPSBJdGVyYWJsZS5maW5kKHRoaXMuX3Nlc3Npb25Nb2RlbHMudmFsdWVzKCksIG1vZGVsID0+IG1vZGVsLnNlc3Npb25JZCA9PT0gdHJhbnNmZXJyZWRTZXNzaW9uRGF0YS5zZXNzaW9uSWQpO1xuXHRcdGlmICghbW9kZWwpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgRmFpbGVkIHRvIHRyYW5zZmVyIHNlc3Npb24uIFVua25vd24gc2Vzc2lvbiBJRDogJHt0cmFuc2ZlcnJlZFNlc3Npb25EYXRhLnNlc3Npb25JZH1gKTtcblx0XHR9XG5cblx0XHRjb25zdCBleGlzdGluZ1JhdzogSUNoYXRUcmFuc2ZlcjJbXSA9IHRoaXMuc3RvcmFnZVNlcnZpY2UuZ2V0T2JqZWN0KGdsb2JhbENoYXRLZXksIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBbXSk7XG5cdFx0ZXhpc3RpbmdSYXcucHVzaCh7XG5cdFx0XHRjaGF0OiBtb2RlbC50b0pTT04oKSxcblx0XHRcdHRpbWVzdGFtcEluTWlsbGlzZWNvbmRzOiBEYXRlLm5vdygpLFxuXHRcdFx0dG9Xb3Jrc3BhY2U6IHRvV29ya3NwYWNlLFxuXHRcdFx0aW5wdXRWYWx1ZTogdHJhbnNmZXJyZWRTZXNzaW9uRGF0YS5pbnB1dFZhbHVlLFxuXHRcdFx0bG9jYXRpb246IHRyYW5zZmVycmVkU2Vzc2lvbkRhdGEubG9jYXRpb24sXG5cdFx0XHRtb2RlOiB0cmFuc2ZlcnJlZFNlc3Npb25EYXRhLm1vZGUsXG5cdFx0fSk7XG5cblx0XHR0aGlzLnN0b3JhZ2VTZXJ2aWNlLnN0b3JlKGdsb2JhbENoYXRLZXksIEpTT04uc3RyaW5naWZ5KGV4aXN0aW5nUmF3KSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUsIFN0b3JhZ2VUYXJnZXQuTUFDSElORSk7XG5cdFx0dGhpcy50cmFjZSgndHJhbnNmZXJDaGF0U2Vzc2lvbicsIGBUcmFuc2ZlcnJlZCBzZXNzaW9uICR7bW9kZWwuc2Vzc2lvbklkfSB0byB3b3Jrc3BhY2UgJHt0b1dvcmtzcGFjZS50b1N0cmluZygpfWApO1xuXHR9XG5cblx0aXNFZGl0aW5nTG9jYXRpb24obG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIGxvY2F0aW9uID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0aW5nU2Vzc2lvbiB8fCB0aGlzLnVuaWZpZWRWaWV3RW5hYmxlZDtcblx0fVxuXG5cdGdldENoYXRTdG9yYWdlRm9sZGVyKCk6IFVSSSB7XG5cdFx0cmV0dXJuIHRoaXMuX2NoYXRTZXNzaW9uU3RvcmUuZ2V0Q2hhdFN0b3JhZ2VGb2xkZXIoKTtcblx0fVxuXG5cdGxvZ0NoYXRJbmRleCgpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGF0U2Vzc2lvblN0b3JlLmxvZ0luZGV4KCk7XG5cdH1cbn1cblxuZnVuY3Rpb24gZ2V0Q29kZUJsb2Nrcyh0ZXh0OiBzdHJpbmcpOiBzdHJpbmdbXSB7XG5cdGNvbnN0IGxpbmVzID0gdGV4dC5zcGxpdCgnXFxuJyk7XG5cdGNvbnN0IGNvZGVCbG9ja0xhbmd1YWdlczogc3RyaW5nW10gPSBbXTtcblxuXHRsZXQgY29kZUJsb2NrU3RhdGU6IHVuZGVmaW5lZCB8IHsgcmVhZG9ubHkgZGVsaW1pdGVyOiBzdHJpbmc7IHJlYWRvbmx5IGxhbmd1YWdlSWQ6IHN0cmluZyB9O1xuXHRmb3IgKGxldCBpID0gMDsgaSA8IGxpbmVzLmxlbmd0aDsgaSsrKSB7XG5cdFx0Y29uc3QgbGluZSA9IGxpbmVzW2ldO1xuXG5cdFx0aWYgKGNvZGVCbG9ja1N0YXRlKSB7XG5cdFx0XHRpZiAobmV3IFJlZ0V4cChgXlxcXFxzKiR7Y29kZUJsb2NrU3RhdGUuZGVsaW1pdGVyfVxcXFxzKiRgKS50ZXN0KGxpbmUpKSB7XG5cdFx0XHRcdGNvZGVCbG9ja0xhbmd1YWdlcy5wdXNoKGNvZGVCbG9ja1N0YXRlLmxhbmd1YWdlSWQpO1xuXHRcdFx0XHRjb2RlQmxvY2tTdGF0ZSA9IHVuZGVmaW5lZDtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0Y29uc3QgbWF0Y2ggPSBsaW5lLm1hdGNoKC9eKFxccyopKGB7Myx9fH57Myx9KShcXHcqKS8pO1xuXHRcdFx0aWYgKG1hdGNoKSB7XG5cdFx0XHRcdGNvZGVCbG9ja1N0YXRlID0geyBkZWxpbWl0ZXI6IG1hdGNoWzJdLCBsYW5ndWFnZUlkOiBtYXRjaFszXSB9O1xuXHRcdFx0fVxuXHRcdH1cblx0fVxuXHRyZXR1cm4gY29kZUJsb2NrTGFuZ3VhZ2VzO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLG1CQUFtQiwrQkFBK0I7QUFDM0QsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZLHFCQUFrQztBQUN2RCxTQUFTLGNBQWM7QUFDdkIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsNkJBQTZCO0FBQ3RDLFNBQVMsbUJBQW1CO0FBQzVCLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsaUJBQWlCLGNBQWMscUJBQXFCO0FBQzdELFNBQVMseUJBQXlCO0FBQ2xDLFNB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
