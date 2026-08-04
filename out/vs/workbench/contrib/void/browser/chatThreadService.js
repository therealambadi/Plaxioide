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
import { Disposable } from "../../../../base/common/lifecycle.js";
import { registerSingleton, InstantiationType } from "../../../../platform/instantiation/common/extensions.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { URI } from "../../../../base/common/uri.js";
import { Emitter } from "../../../../base/common/event.js";
import { ILLMMessageService } from "../common/sendLLMMessageService.js";
import { chat_userMessageContent, isABuiltinToolName } from "../common/prompt/prompts.js";
import { getErrorMessage } from "../common/sendLLMMessageTypes.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { IVoidSettingsService } from "../common/voidSettingsService.js";
import { approvalTypeOfBuiltinToolName } from "../common/toolsServiceTypes.js";
import { IToolsService } from "./toolsService.js";
import { CancellationToken } from "../../../../base/common/cancellation.js";
import { ILanguageFeaturesService } from "../../../../editor/common/services/languageFeatures.js";
import { Position } from "../../../../editor/common/core/position.js";
import { IMetricsService } from "../common/metricsService.js";
import { shorten } from "../../../../base/common/labels.js";
import { IVoidModelService } from "../common/voidModelService.js";
import { findLast, findLastIdx } from "../../../../base/common/arraysFind.js";
import { IEditCodeService } from "./editCodeServiceInterface.js";
import { INotificationService, Severity } from "../../../../platform/notification/common/notification.js";
import { truncate } from "../../../../base/common/strings.js";
import { THREAD_STORAGE_KEY } from "../common/storageKeys.js";
import { IConvertToLLMMessageService } from "./convertToLLMMessageService.js";
import { timeout } from "../../../../base/common/async.js";
import { deepClone } from "../../../../base/common/objects.js";
import { IWorkspaceContextService } from "../../../../platform/workspace/common/workspace.js";
import { IDirectoryStrService } from "../common/directoryStrService.js";
import { IFileService } from "../../../../platform/files/common/files.js";
import { IMCPService } from "../common/mcpService.js";
import { IPlaxioGateService } from "./plaxioGateService.js";
const CHAT_RETRIES = 2;
const RETRY_DELAY = 2500;
const RATE_LIMIT_BASE_DELAY = 10000;
function isRateLimitError(error) {
  const msg = String(error?.message ?? error ?? '');
  return msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.includes('rate_limit') || msg.includes('Rate limit') || msg.includes('Too Many Requests');
}
const findStagingSelectionIndex = (currentSelections, newSelection) => {
  if (!currentSelections) return null;
  for (let i = 0; i < currentSelections.length; i += 1) {
    const s = currentSelections[i];
    if (s.uri.fsPath !== newSelection.uri.fsPath) continue;
    if (s.type === "File" && newSelection.type === "File") {
      return i;
    }
    if (s.type === "CodeSelection" && newSelection.type === "CodeSelection") {
      if (s.uri.fsPath !== newSelection.uri.fsPath) continue;
      const [oldStart, oldEnd] = s.range;
      const [newStart, newEnd] = newSelection.range;
      if (oldStart !== newStart || oldEnd !== newEnd) continue;
      return i;
    }
    if (s.type === "Folder" && newSelection.type === "Folder") {
      return i;
    }
  }
  return null;
};
const defaultMessageState = {
  stagingSelections: [],
  isBeingEdited: false
};
const newThreadObject = () => {
  const now = (/* @__PURE__ */ new Date()).toISOString();
  return {
    id: generateUuid(),
    createdAt: now,
    lastModified: now,
    messages: [],
    state: {
      currCheckpointIdx: null,
      stagingSelections: [],
      focusedMessageIdx: void 0,
      linksOfMessageIdx: {}
    },
    filesWithUserChanges: /* @__PURE__ */ new Set()
  };
};
const IChatThreadService = createDecorator("voidChatThreadService");
let ChatThreadService = class extends Disposable {
  // allThreads is persisted, currentThread is not
  // used in checkpointing
  // private readonly _userModifiedFilesToCheckInCheckpoints = new LRUCache<string, null>(50)
  constructor(_storageService, _voidModelService, _llmMessageService, _toolsService, _settingsService, _languageFeaturesService, _metricsService, _editCodeService, _notificationService, _convertToLLMMessagesService, _workspaceContextService, _directoryStringService, _fileService, _mcpService, _plaxioGateService) {
    super();
    this._storageService = _storageService;
    this._voidModelService = _voidModelService;
    this._llmMessageService = _llmMessageService;
    this._toolsService = _toolsService;
    this._settingsService = _settingsService;
    this._languageFeaturesService = _languageFeaturesService;
    this._metricsService = _metricsService;
    this._editCodeService = _editCodeService;
    this._notificationService = _notificationService;
    this._convertToLLMMessagesService = _convertToLLMMessagesService;
    this._workspaceContextService = _workspaceContextService;
    this._directoryStringService = _directoryStringService;
    this._fileService = _fileService;
    this._mcpService = _mcpService;
    this._plaxioGateService = _plaxioGateService;
    // this fires when the current thread changes at all (a switch of currentThread, or a message added to it, etc)
    this._onDidChangeCurrentThread = new Emitter();
    this.onDidChangeCurrentThread = this._onDidChangeCurrentThread.event;
    this._onDidChangeStreamState = new Emitter();
    this.onDidChangeStreamState = this._onDidChangeStreamState.event;
    this.streamState = {};
    this.dangerousSetState = (newState) => {
      this.state = newState;
      this._onDidChangeCurrentThread.fire();
    };
    this.resetState = () => {
      this.state = { allThreads: {}, currentThreadId: null };
      this.openNewThread();
      this._onDidChangeCurrentThread.fire();
    };
    // ---------- streaming ----------
    this._currentModelSelectionProps = () => {
      const featureName = "Chat";
      const modelSelection = this._settingsService.state.modelSelectionOfFeature[featureName];
      const modelSelectionOptions = modelSelection ? this._settingsService.state.optionsOfModelSelection[featureName][modelSelection.providerName]?.[modelSelection.modelName] : void 0;
      return { modelSelection, modelSelectionOptions };
    };
    this._swapOutLatestStreamingToolWithResult = (threadId, tool) => {
      const messages = this.state.allThreads[threadId]?.messages;
      if (!messages) return false;
      const lastMsg = messages[messages.length - 1];
      if (!lastMsg) return false;
      if (lastMsg.role === "tool" && lastMsg.type !== "invalid_params") {
        this._editMessageInThread(threadId, messages.length - 1, tool);
        return true;
      }
      return false;
    };
    this._updateLatestTool = (threadId, tool) => {
      const swapped = this._swapOutLatestStreamingToolWithResult(threadId, tool);
      if (swapped) return;
      this._addMessageToThread(threadId, tool);
    };
    this._computeMCPServerOfToolName = (toolName) => {
      return this._mcpService.getMCPTools()?.find((t) => t.name === toolName)?.mcpServerName;
    };
    this.toolErrMsgs = {
      rejected: "Tool call was rejected by the user.",
      interrupted: "Tool call was interrupted by the user.",
      errWhenStringifying: (error) => `Tool call succeeded, but there was an error stringifying the output.
${getErrorMessage(error)}`
    };
    // private readonly _currentlyRunningToolInterruptor: { [threadId: string]: (() => void) | undefined } = {}
    // returns true when the tool call is waiting for user approval
    this._runToolCall = async (threadId, toolName, toolId, mcpServerName, opts) => {
      let toolParams;
      let toolResult;
      let toolResultStr;
      const isBuiltInTool = isABuiltinToolName(toolName);
      if (!opts.preapproved) {
        try {
          if (isBuiltInTool) {
            const params = this._toolsService.validateParams[toolName](opts.unvalidatedToolParams);
            toolParams = params;
          } else {
            toolParams = opts.unvalidatedToolParams;
          }
        } catch (error) {
          const errorMessage = getErrorMessage(error);
          this._addMessageToThread(threadId, { role: "tool", type: "invalid_params", rawParams: opts.unvalidatedToolParams, result: null, name: toolName, content: errorMessage, id: toolId, mcpServerName });
          return {};
        }
        if (toolName === "edit_file") {
          this._addToolEditCheckpoint({ threadId, uri: toolParams.uri });
        }
        if (toolName === "rewrite_file") {
          this._addToolEditCheckpoint({ threadId, uri: toolParams.uri });
        }
        const approvalType = isBuiltInTool ? approvalTypeOfBuiltinToolName[toolName] : "MCP tools";
        if (approvalType) {
          const autoApprove = this._settingsService.state.globalSettings.autoApprove[approvalType];
          this._addMessageToThread(threadId, { role: "tool", type: "tool_request", content: "(Awaiting user permission...)", result: null, name: toolName, params: toolParams, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName });
          if (!autoApprove) {
            return { awaitingUserApproval: true };
          }
        }
      } else {
        toolParams = opts.validatedParams;
      }
      const runningTool = { role: "tool", type: "running_now", name: toolName, params: toolParams, content: "(value not received yet...)", result: null, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName };
      this._updateLatestTool(threadId, runningTool);
      let interrupted = false;
      let resolveInterruptor = () => {
      };
      const interruptorPromise = new Promise((res) => {
        resolveInterruptor = res;
      });
      try {
        this._setStreamState(threadId, { isRunning: "tool", interrupt: interruptorPromise, toolInfo: { toolName, toolParams, id: toolId, content: "interrupted...", rawParams: opts.unvalidatedToolParams, mcpServerName } });
        if (isBuiltInTool) {
          const { result, interruptTool } = await this._toolsService.callTool[toolName](toolParams);
          const interruptor = () => {
            interrupted = true;
            interruptTool?.();
          };
          resolveInterruptor(interruptor);
          toolResult = await result;
        } else {
          const mcpTools = this._mcpService.getMCPTools();
          const mcpTool = mcpTools?.find((t) => t.name === toolName);
          if (!mcpTool) {
            throw new Error(`MCP tool ${toolName} not found`);
          }
          resolveInterruptor(() => {
          });
          toolResult = (await this._mcpService.callMCPTool({
            serverName: mcpTool.mcpServerName ?? "unknown_mcp_server",
            toolName,
            params: toolParams
          })).result;
        }
        if (interrupted) {
          return { interrupted: true };
        }
      } catch (error) {
        resolveInterruptor(() => {
        });
        if (interrupted) {
          return { interrupted: true };
        }
        const errorMessage = getErrorMessage(error);
        this._updateLatestTool(threadId, { role: "tool", type: "tool_error", params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName });
        return {};
      }
      try {
        if (isBuiltInTool) {
          toolResultStr = this._toolsService.stringOfResult[toolName](toolParams, toolResult);
        } else {
          toolResultStr = this._mcpService.stringifyResult(toolResult);
        }
      } catch (error) {
        const errorMessage = this.toolErrMsgs.errWhenStringifying(error);
        this._updateLatestTool(threadId, { role: "tool", type: "tool_error", params: toolParams, result: errorMessage, name: toolName, content: errorMessage, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName });
        return {};
      }
      this._updateLatestTool(threadId, { role: "tool", type: "success", params: toolParams, result: toolResult, name: toolName, content: toolResultStr, id: toolId, rawParams: opts.unvalidatedToolParams, mcpServerName });
      return {};
    };
    this._getCheckpointInfo = (checkpointMessage, fsPath, opts) => {
      const voidFileSnapshot = checkpointMessage.voidFileSnapshotOfURI ? checkpointMessage.voidFileSnapshotOfURI[fsPath] ?? null : null;
      if (!opts.includeUserModifiedChanges) {
        return { voidFileSnapshot };
      }
      const userModifiedVoidFileSnapshot = fsPath in checkpointMessage.userModifications.voidFileSnapshotOfURI ? checkpointMessage.userModifications.voidFileSnapshotOfURI[fsPath] ?? null : null;
      return { voidFileSnapshot: userModifiedVoidFileSnapshot ?? voidFileSnapshot };
    };
    this._getCheckpointBeforeMessage = ({ threadId, messageIdx }) => {
      const thread = this.state.allThreads[threadId];
      if (!thread) return void 0;
      for (let i = messageIdx; i >= 0; i--) {
        const message = thread.messages[i];
        if (message.role === "checkpoint") {
          return [message, i];
        }
      }
      return void 0;
    };
    this.editUserMessageAndStreamResponse = async ({ userMessage, messageIdx, threadId }) => {
      const thread = this.state.allThreads[threadId];
      if (!thread) return;
      if (thread.messages?.[messageIdx]?.role !== "user") {
        throw new Error(`Error: editing a message with role !=='user'`);
      }
      const currSelns = thread.messages[messageIdx].state.stagingSelections || [];
      const slicedMessages = thread.messages.slice(0, messageIdx);
      this._setState({
        allThreads: {
          ...this.state.allThreads,
          [thread.id]: {
            ...thread,
            messages: slicedMessages
          }
        }
      });
      this._addUserMessageAndStreamResponse({ userMessage, _chatSelections: currSelns, threadId });
    };
    this.getRelativeStr = (uri) => {
      const isInside = this._workspaceContextService.isInsideWorkspace(uri);
      if (isInside) {
        const f = this._workspaceContextService.getWorkspace().folders.find((f2) => uri.fsPath.startsWith(f2.uri.fsPath));
        if (f) {
          return uri.fsPath.replace(f.uri.fsPath, "");
        } else {
          return void 0;
        }
      } else {
        return void 0;
      }
    };
    // gets the location of codespan link so the user can click on it
    this.generateCodespanLink = async ({ codespanStr: _codespanStr, threadId }) => {
      const functionOrMethodPattern = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
      const functionParensPattern = /^([^\s(]+)\([^)]*\)$/;
      let target = _codespanStr;
      let codespanType;
      if (target.includes(".") || target.includes("/")) {
        codespanType = "file-or-folder";
        target = _codespanStr;
      } else if (functionOrMethodPattern.test(target)) {
        codespanType = "function-or-class";
        target = _codespanStr;
      } else if (functionParensPattern.test(target)) {
        const match = target.match(functionParensPattern);
        if (match && match[1]) {
          codespanType = "function-or-class";
          target = match[1];
        } else {
          return null;
        }
      } else {
        return null;
      }
      const prevUris = this._getAllSeenFileURIs(threadId).reverse();
      if (codespanType === "file-or-folder") {
        const doesUriMatchTarget = (uri) => uri.path.includes(target);
        for (const [idx, uri] of prevUris.entries()) {
          if (doesUriMatchTarget(uri)) {
            const prevUriStrs = prevUris.map((uri2) => uri2.fsPath);
            const shortenedUriStrs = shorten(prevUriStrs);
            let displayText = shortenedUriStrs[idx];
            const ellipsisIdx = displayText.lastIndexOf("\u2026/");
            if (ellipsisIdx >= 0) {
              displayText = displayText.slice(ellipsisIdx + 2);
            }
            return { uri, displayText };
          }
        }
        let uris = [];
        try {
          const { result } = await this._toolsService.callTool["search_pathnames_only"]({ query: target, includePattern: null, pageNumber: 0 });
          const { uris: uris_ } = await result;
          uris = uris_;
        } catch (e) {
          return null;
        }
        for (const [idx, uri] of uris.entries()) {
          if (doesUriMatchTarget(uri)) {
            const prevUriStrs = prevUris.map((uri2) => uri2.fsPath);
            const shortenedUriStrs = shorten(prevUriStrs);
            let displayText = shortenedUriStrs[idx];
            const ellipsisIdx = displayText.lastIndexOf("\u2026/");
            if (ellipsisIdx >= 0) {
              displayText = displayText.slice(ellipsisIdx + 2);
            }
            return { uri, displayText };
          }
        }
      }
      if (codespanType === "function-or-class") {
        for (const uri of prevUris) {
          const modelRef = await this._voidModelService.getModelSafe(uri);
          const { model } = modelRef;
          if (!model) continue;
          const matches = model.findMatches(
            target,
            false,
            // searchOnlyEditableRange
            false,
            // isRegex
            true,
            // matchCase
            null,
            //' ',   // wordSeparators
            true
            // captureMatches
          );
          const firstThree = matches.slice(0, 3);
          for (const match of firstThree) {
            const position = new Position(match.range.startLineNumber, match.range.startColumn);
            const definitionProviders = this._languageFeaturesService.definitionProvider.ordered(model);
            for (const provider of definitionProviders) {
              const _definitions = await provider.provideDefinition(model, position, CancellationToken.None);
              if (!_definitions) continue;
              const definitions = Array.isArray(_definitions) ? _definitions : [_definitions];
              for (const definition of definitions) {
                return {
                  uri: definition.uri,
                  selection: {
                    startLineNumber: definition.range.startLineNumber,
                    startColumn: definition.range.startColumn,
                    endLineNumber: definition.range.endLineNumber,
                    endColumn: definition.range.endColumn
                  },
                  displayText: _codespanStr
                };
              }
            }
          }
        }
      }
      return null;
    };
    // closeCurrentStagingSelectionsInThread = () => {
    // 	const currThread = this.getCurrentThreadState()
    // 	// close all stagingSelections
    // 	const closedStagingSelections = currThread.stagingSelections.map(s => ({ ...s, state: { ...s.state, isOpened: false } }))
    // 	const newThread = currThread
    // 	newThread.stagingSelections = closedStagingSelections
    // 	this.setCurrentThreadState(newThread)
    // }
    // closeCurrentStagingSelectionsInMessage: IChatThreadService['closeCurrentStagingSelectionsInMessage'] = ({ messageIdx }) => {
    // 	const currMessage = this.getCurrentMessageState(messageIdx)
    // 	// close all stagingSelections
    // 	const closedStagingSelections = currMessage.stagingSelections.map(s => ({ ...s, state: { ...s.state, isOpened: false } }))
    // 	const newMessage = currMessage
    // 	newMessage.stagingSelections = closedStagingSelections
    // 	this.setCurrentMessageState(messageIdx, newMessage)
    // }
    this.getCurrentThreadState = () => {
      const currentThread = this.getCurrentThread();
      return currentThread.state;
    };
    this.setCurrentThreadState = (newState) => {
      this._setThreadState(this.state.currentThreadId, newState);
    };
    this.state = { allThreads: {}, currentThreadId: null };
    const readThreads = this._readAllThreads() || {};
    const allThreads = readThreads;
    this.state = {
      allThreads,
      currentThreadId: null
      // gets set in startNewThread()
    };
    this.openNewThread();
  }
  async focusCurrentChat() {
    const threadId = this.state.currentThreadId;
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const s = await thread.state.mountedInfo?.whenMounted;
    if (!this.isCurrentlyFocusingMessage()) {
      s?.textAreaRef.current?.focus();
    }
  }
  async blurCurrentChat() {
    const threadId = this.state.currentThreadId;
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const s = await thread.state.mountedInfo?.whenMounted;
    if (!this.isCurrentlyFocusingMessage()) {
      s?.textAreaRef.current?.blur();
    }
  }
  // !!! this is important for properly restoring URIs from storage
  // should probably re-use code from void/src/vs/base/common/marshalling.ts instead. but this is simple enough
  _convertThreadDataFromStorage(threadsStr) {
    return JSON.parse(threadsStr, (key, value) => {
      if (value && typeof value === "object" && value.$mid === 1) {
        return URI.from(value);
      }
      return value;
    });
  }
  _readAllThreads() {
    const threadsStr = this._storageService.get(THREAD_STORAGE_KEY, StorageScope.APPLICATION);
    if (!threadsStr) {
      return null;
    }
    const threads = this._convertThreadDataFromStorage(threadsStr);
    return threads;
  }
  _storeAllThreads(threads) {
    const serializedThreads = JSON.stringify(threads);
    this._storageService.store(
      THREAD_STORAGE_KEY,
      serializedThreads,
      StorageScope.APPLICATION,
      StorageTarget.USER
    );
  }
  // this should be the only place this.state = ... appears besides constructor
  _setState(state, doNotRefreshMountInfo) {
    const newState = {
      ...this.state,
      ...state
    };
    this.state = newState;
    this._onDidChangeCurrentThread.fire();
    const threadId = newState.currentThreadId;
    const streamState = this.streamState[threadId];
    if (streamState?.isRunning === void 0 && !streamState?.error) {
      const messages = newState.allThreads[threadId]?.messages;
      const lastMessage = messages && messages[messages.length - 1];
      if (lastMessage && lastMessage.role === "tool" && lastMessage.type === "tool_request")
        this._setStreamState(threadId, { isRunning: "awaiting_user" });
      if (lastMessage && lastMessage.role === "tool" && lastMessage.type === "running_now") {
        this._updateLatestTool(threadId, { role: "tool", type: "rejected", content: lastMessage.content, id: lastMessage.id, rawParams: lastMessage.rawParams, result: null, name: lastMessage.name, params: lastMessage.params, mcpServerName: lastMessage.mcpServerName });
      }
    }
    if (doNotRefreshMountInfo) return;
    let whenMountedResolver;
    const whenMountedPromise = new Promise((res) => whenMountedResolver = res);
    this._setThreadState(threadId, {
      mountedInfo: {
        whenMounted: whenMountedPromise,
        mountedIsResolvedRef: { current: false },
        _whenMountedResolver: (w) => {
          whenMountedResolver(w);
          const mountInfo = this.state.allThreads[threadId]?.state.mountedInfo;
          if (mountInfo) mountInfo.mountedIsResolvedRef.current = true;
        }
      }
    }, true);
  }
  _setStreamState(threadId, state) {
    this.streamState[threadId] = state;
    this._onDidChangeStreamState.fire({ threadId });
  }
  approveLatestToolRequest(threadId) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const lastMsg = thread.messages[thread.messages.length - 1];
    if (!(lastMsg.role === "tool" && lastMsg.type === "tool_request")) return;
    const callThisToolFirst = lastMsg;
    this._wrapRunAgentToNotify(
      this._runChatAgent({ callThisToolFirst, threadId, ...this._currentModelSelectionProps() }),
      threadId
    );
  }
  rejectLatestToolRequest(threadId) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const lastMsg = thread.messages[thread.messages.length - 1];
    let params;
    if (lastMsg.role === "tool" && lastMsg.type !== "invalid_params") {
      params = lastMsg.params;
    } else return;
    const { name, id, rawParams, mcpServerName } = lastMsg;
    const errorMessage = this.toolErrMsgs.rejected;
    this._updateLatestTool(threadId, { role: "tool", type: "rejected", params, name, content: errorMessage, result: null, id, rawParams, mcpServerName });
    this._setStreamState(threadId, void 0);
  }
  async abortRunning(threadId) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    if (this.streamState[threadId]?.isRunning === "LLM") {
      const { displayContentSoFar, reasoningSoFar, toolCallSoFar } = this.streamState[threadId].llmInfo;
      this._addMessageToThread(threadId, { role: "assistant", displayContent: displayContentSoFar, reasoning: reasoningSoFar, anthropicReasoning: null });
      if (toolCallSoFar) this._addMessageToThread(threadId, { role: "interrupted_streaming_tool", name: toolCallSoFar.name, mcpServerName: this._computeMCPServerOfToolName(toolCallSoFar.name) });
    } else if (this.streamState[threadId]?.isRunning === "tool") {
      const { toolName, toolParams, id, content: content_, rawParams, mcpServerName } = this.streamState[threadId].toolInfo;
      const content = content_ || this.toolErrMsgs.interrupted;
      this._updateLatestTool(threadId, { role: "tool", name: toolName, params: toolParams, id, content, rawParams, type: "rejected", result: null, mcpServerName });
    } else if (this.streamState[threadId]?.isRunning === "awaiting_user") {
      this.rejectLatestToolRequest(threadId);
    } else if (this.streamState[threadId]?.isRunning === "idle") {
    }
    this._addUserCheckpoint({ threadId });
    const interrupt = await this.streamState[threadId]?.interrupt;
    if (typeof interrupt === "function")
      interrupt();
    this._setStreamState(threadId, void 0);
  }
  async _runChatAgent({
    threadId,
    modelSelection,
    modelSelectionOptions,
    callThisToolFirst
  }) {
    let interruptedWhenIdle = false;
    const idleInterruptor = Promise.resolve(() => {
      interruptedWhenIdle = true;
    });
    const { chatMode } = this._settingsService.state.globalSettings;
    const { overridesOfModel } = this._settingsService.state;
    let nMessagesSent = 0;
    let shouldSendAnotherMessage = true;
    let isRunningWhenEnd = void 0;
    if (callThisToolFirst) {
      const { interrupted } = await this._runToolCall(threadId, callThisToolFirst.name, callThisToolFirst.id, callThisToolFirst.mcpServerName, { preapproved: true, unvalidatedToolParams: callThisToolFirst.rawParams, validatedParams: callThisToolFirst.params });
      if (interrupted) {
        this._setStreamState(threadId, void 0);
        this._addUserCheckpoint({ threadId });
      }
    }
    this._setStreamState(threadId, { isRunning: "idle", interrupt: "not_needed" });
    while (shouldSendAnotherMessage) {
      shouldSendAnotherMessage = false;
      isRunningWhenEnd = void 0;
      nMessagesSent += 1;
      this._setStreamState(threadId, { isRunning: "idle", interrupt: idleInterruptor });
      const chatMessages = this.state.allThreads[threadId]?.messages ?? [];
      const tPrepStart = performance.now();
      const { messages, separateSystemMessage } = await this._convertToLLMMessagesService.prepareLLMChatMessages({
        chatMessages,
        modelSelection,
        chatMode,
        isFollowUpTurn: nMessagesSent > 1,
      });
      const tPrepEnd = performance.now();
      console.log(`[Plaxio Perf] prepareLLMChatMessages: ${(tPrepEnd - tPrepStart).toFixed(0)}ms`);
      if (interruptedWhenIdle) {
        this._setStreamState(threadId, void 0);
        return;
      }
      let shouldRetryLLM = true;
      let nAttempts = 0;
      while (shouldRetryLLM) {
        shouldRetryLLM = false;
        nAttempts += 1;
        let resMessageIsDonePromise;
        const messageIsDonePromise = new Promise((res, rej) => {
          resMessageIsDonePromise = res;
        });
        const tLLMStart = performance.now();
        let tFirstToken = null;
        let tokenChunks = 0;
        const llmCancelToken = this._llmMessageService.sendLLMMessage({
          messagesType: "chatMessages",
          chatMode,
          messages,
          modelSelection,
          modelSelectionOptions,
          overridesOfModel,
          logging: { loggingName: `Chat - ${chatMode}`, loggingExtras: { threadId, nMessagesSent, chatMode } },
          separateSystemMessage,
          onText: ({ fullText, fullReasoning, toolCall: toolCall2 }) => {
            tokenChunks++;
            if (!tFirstToken) { tFirstToken = performance.now(); console.log(`[Plaxio Perf] Time to first token: ${(tFirstToken - tLLMStart).toFixed(0)}ms`); }
            this._setStreamState(threadId, { isRunning: "LLM", llmInfo: { displayContentSoFar: fullText, reasoningSoFar: fullReasoning, toolCallSoFar: toolCall2 ?? null }, interrupt: Promise.resolve(() => {
              if (llmCancelToken) this._llmMessageService.abort(llmCancelToken);
            }) });
          },
          onFinalMessage: async ({ fullText, fullReasoning, toolCall: toolCall2, anthropicReasoning, _geminiParts }) => {
            console.log(`[Plaxio Perf] Stream complete: ${tokenChunks} chunks, ${fullText.length} chars, total ${(performance.now() - tLLMStart).toFixed(0)}ms`);
            resMessageIsDonePromise({ type: "llmDone", toolCall: toolCall2, info: { fullText, fullReasoning, anthropicReasoning, geminiParts: _geminiParts } });
          },
          onError: async (error) => {
            resMessageIsDonePromise({ type: "llmError", error });
          },
          onAbort: () => {
            resMessageIsDonePromise({ type: "llmAborted" });
            this._metricsService.capture("Agent Loop Done (Aborted)", { nMessagesSent, chatMode });
          }
        });
        if (!llmCancelToken) {
          this._setStreamState(threadId, { isRunning: void 0, error: { message: "There was an unexpected error when sending your chat message.", fullError: null } });
          break;
        }
        this._setStreamState(threadId, { isRunning: "LLM", llmInfo: { displayContentSoFar: "", reasoningSoFar: "", toolCallSoFar: null }, interrupt: Promise.resolve(() => this._llmMessageService.abort(llmCancelToken)) });
        const llmRes = await messageIsDonePromise;
        if (this.streamState[threadId]?.isRunning !== "LLM") {
          return;
        }
        if (llmRes.type === "llmAborted") {
          this._setStreamState(threadId, void 0);
          return;
        } else if (llmRes.type === "llmError") {
          if (nAttempts < CHAT_RETRIES && !isRateLimitError(llmRes.error)) {
            shouldRetryLLM = true;
            const delay = RETRY_DELAY;
            this._setStreamState(threadId, { isRunning: "idle", interrupt: idleInterruptor });
            await timeout(delay);
            if (interruptedWhenIdle) {
              this._setStreamState(threadId, void 0);
              return;
            } else
              continue;
          } else {
            const { error } = llmRes;
            const { displayContentSoFar, reasoningSoFar, toolCallSoFar } = this.streamState[threadId].llmInfo;
            this._addMessageToThread(threadId, { role: "assistant", displayContent: displayContentSoFar, reasoning: reasoningSoFar, anthropicReasoning: null });
            if (toolCallSoFar) this._addMessageToThread(threadId, { role: "interrupted_streaming_tool", name: toolCallSoFar.name, mcpServerName: this._computeMCPServerOfToolName(toolCallSoFar.name) });
            this._setStreamState(threadId, { isRunning: void 0, error });
            this._addUserCheckpoint({ threadId });
            return;
          }
        }
        const { toolCall, info } = llmRes;
        this._addMessageToThread(threadId, { role: "assistant", displayContent: info.fullText, reasoning: info.fullReasoning, anthropicReasoning: info.anthropicReasoning, geminiParts: info.geminiParts });
        this._setStreamState(threadId, { isRunning: "idle", interrupt: "not_needed" });
        if (toolCall) {
          const mcpTools = this._mcpService.getMCPTools();
          const mcpTool = mcpTools?.find((t) => t.name === toolCall.name);
          const { awaitingUserApproval, interrupted } = await this._runToolCall(threadId, toolCall.name, toolCall.id, mcpTool?.mcpServerName, { preapproved: false, unvalidatedToolParams: toolCall.rawParams });
          if (interrupted) {
            this._setStreamState(threadId, void 0);
            return;
          }
          if (awaitingUserApproval) {
            isRunningWhenEnd = "awaiting_user";
          } else {
            shouldSendAnotherMessage = true;
          }
          this._setStreamState(threadId, { isRunning: "idle", interrupt: "not_needed" });
        }
      }
    }
    this._setStreamState(threadId, { isRunning: isRunningWhenEnd });
    if (!isRunningWhenEnd) this._addUserCheckpoint({ threadId });
    this._metricsService.capture("Agent Loop Done", { nMessagesSent, chatMode });
    if (!isRunningWhenEnd) { this._plaxioGateService.debitAICredit(); }
  }
  _addCheckpoint(threadId, checkpoint) {
    this._addMessageToThread(threadId, checkpoint);
  }
  _editMessageInThread(threadId, messageIdx, newMessage) {
    const { allThreads } = this.state;
    const oldThread = allThreads[threadId];
    if (!oldThread) return;
    const newThreads = {
      ...allThreads,
      [oldThread.id]: {
        ...oldThread,
        lastModified: (/* @__PURE__ */ new Date()).toISOString(),
        messages: [
          ...oldThread.messages.slice(0, messageIdx),
          newMessage,
          ...oldThread.messages.slice(messageIdx + 1, Infinity)
        ]
      }
    };
    this._storeAllThreads(newThreads);
    this._setState({ allThreads: newThreads });
  }
  _computeNewCheckpointInfo({ threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const lastCheckpointIdx = findLastIdx(thread.messages, (m) => m.role === "checkpoint") ?? -1;
    if (lastCheckpointIdx === -1) return;
    const voidFileSnapshotOfURI = {};
    const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: 0, hiIdx: lastCheckpointIdx }) ?? {};
    for (const fsPath in lastIdxOfURI ?? {}) {
      const { model } = this._voidModelService.getModelFromFsPath(fsPath);
      if (!model) continue;
      const checkpoint2 = thread.messages[lastIdxOfURI[fsPath]] || null;
      if (!checkpoint2) continue;
      if (checkpoint2.role !== "checkpoint") continue;
      const res = this._getCheckpointInfo(checkpoint2, fsPath, { includeUserModifiedChanges: false });
      if (!res) continue;
      const { voidFileSnapshot: oldVoidFileSnapshot } = res;
      const voidFileSnapshot = this._editCodeService.getVoidFileSnapshot(URI.file(fsPath));
      if (oldVoidFileSnapshot === voidFileSnapshot) continue;
      voidFileSnapshotOfURI[fsPath] = voidFileSnapshot;
    }
    return { voidFileSnapshotOfURI };
  }
  _addUserCheckpoint({ threadId }) {
    const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {};
    this._addCheckpoint(threadId, {
      role: "checkpoint",
      type: "user_edit",
      voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {},
      userModifications: { voidFileSnapshotOfURI: {} }
    });
  }
  // call this right after LLM edits a file
  _addToolEditCheckpoint({ threadId, uri }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const { model } = this._voidModelService.getModel(uri);
    if (!model) return;
    const diffAreasSnapshot = this._editCodeService.getVoidFileSnapshot(uri);
    this._addCheckpoint(threadId, {
      role: "checkpoint",
      type: "tool_edit",
      voidFileSnapshotOfURI: { [uri.fsPath]: diffAreasSnapshot },
      userModifications: { voidFileSnapshotOfURI: {} }
    });
  }
  _getCheckpointsBetween({ threadId, loIdx, hiIdx }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return { lastIdxOfURI: {} };
    const lastIdxOfURI = {};
    for (let i = loIdx; i <= hiIdx; i += 1) {
      const message = thread.messages[i];
      if (message?.role !== "checkpoint") continue;
      for (const fsPath in message.voidFileSnapshotOfURI) {
        lastIdxOfURI[fsPath] = i;
      }
    }
    return { lastIdxOfURI };
  }
  _readCurrentCheckpoint(threadId) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    const { currCheckpointIdx } = thread.state;
    if (currCheckpointIdx === null) return;
    const checkpoint = thread.messages[currCheckpointIdx];
    if (!checkpoint) return;
    if (checkpoint.role !== "checkpoint") return;
    return [checkpoint, currCheckpointIdx];
  }
  _addUserModificationsToCurrCheckpoint({ threadId }) {
    const { voidFileSnapshotOfURI } = this._computeNewCheckpointInfo({ threadId }) ?? {};
    const res = this._readCurrentCheckpoint(threadId);
    if (!res) return;
    const [checkpoint, checkpointIdx] = res;
    this._editMessageInThread(threadId, checkpointIdx, {
      ...checkpoint,
      userModifications: { voidFileSnapshotOfURI: voidFileSnapshotOfURI ?? {} }
    });
  }
  _makeUsStandOnCheckpoint({ threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    if (thread.state.currCheckpointIdx === null) {
      const lastMsg = thread.messages[thread.messages.length - 1];
      if (lastMsg?.role !== "checkpoint")
        this._addUserCheckpoint({ threadId });
      this._setThreadState(threadId, { currCheckpointIdx: thread.messages.length - 1 });
    }
  }
  jumpToCheckpointBeforeMessageIdx({ threadId, messageIdx, jumpToUserModified }) {
    this._makeUsStandOnCheckpoint({ threadId });
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    if (this.streamState[threadId]?.isRunning) return;
    const c = this._getCheckpointBeforeMessage({ threadId, messageIdx });
    if (c === void 0) return;
    const fromIdx = thread.state.currCheckpointIdx;
    if (fromIdx === null) return;
    const [_, toIdx] = c;
    if (toIdx === fromIdx) return;
    this._addUserModificationsToCurrCheckpoint({ threadId });
    if (toIdx < fromIdx) {
      const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: toIdx + 1, hiIdx: fromIdx });
      const idxes = function* () {
        for (let k = toIdx; k >= 0; k -= 1) {
          yield k;
        }
        for (let k = toIdx + 1; k < thread.messages.length; k += 1) {
          yield k;
        }
      };
      for (const fsPath in lastIdxOfURI) {
        for (const k of idxes()) {
          const message = thread.messages[k];
          if (message.role !== "checkpoint") continue;
          const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified });
          if (!res) continue;
          const { voidFileSnapshot } = res;
          if (!voidFileSnapshot) continue;
          this._editCodeService.restoreVoidFileSnapshot(URI.file(fsPath), voidFileSnapshot);
          break;
        }
      }
    }
    if (toIdx > fromIdx) {
      const { lastIdxOfURI } = this._getCheckpointsBetween({ threadId, loIdx: fromIdx + 1, hiIdx: toIdx });
      for (const fsPath in lastIdxOfURI) {
        for (let k = toIdx; k >= fromIdx + 1; k -= 1) {
          const message = thread.messages[k];
          if (message.role !== "checkpoint") continue;
          const res = this._getCheckpointInfo(message, fsPath, { includeUserModifiedChanges: jumpToUserModified });
          if (!res) continue;
          const { voidFileSnapshot } = res;
          if (!voidFileSnapshot) continue;
          this._editCodeService.restoreVoidFileSnapshot(URI.file(fsPath), voidFileSnapshot);
          break;
        }
      }
    }
    this._setThreadState(threadId, { currCheckpointIdx: toIdx });
  }
  _wrapRunAgentToNotify(p, threadId) {
    const notify = ({ error }) => {
      const thread = this.state.allThreads[threadId];
      if (!thread) return;
      const userMsg = findLast(thread.messages, (m) => m.role === "user");
      if (!userMsg) return;
      if (userMsg.role !== "user") return;
      const messageContent = truncate(userMsg.displayContent, 50, "...");
      this._notificationService.notify({
        severity: error ? Severity.Warning : Severity.Info,
        message: error ? `Error: ${error} ` : `A new Chat result is ready.`,
        source: messageContent,
        sticky: true,
        actions: {
          primary: [{
            id: "void.goToChat",
            enabled: true,
            label: `Jump to Chat`,
            tooltip: "",
            class: void 0,
            run: () => {
              this.switchToThread(threadId);
              this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then((m) => {
                m.scrollToBottom();
              });
            }
          }]
        }
      });
    };
    p.then(() => {
      if (threadId !== this.state.currentThreadId) notify({ error: null });
    }).catch((e) => {
      if (threadId !== this.state.currentThreadId) notify({ error: getErrorMessage(e) });
      throw e;
    });
  }
  dismissStreamError(threadId) {
    this._setStreamState(threadId, void 0);
  }
  async _addUserMessageAndStreamResponse({ userMessage, displayMessage, attachedFileMeta, _chatSelections, threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    if (this.streamState[threadId]?.isRunning) {
      await this.abortRunning(threadId);
    }
    if (thread.messages.length === 0) {
      this._addUserCheckpoint({ threadId });
    }
    const instructions = userMessage;
    const currSelns = _chatSelections ?? thread.state.stagingSelections;
    const userMessageContent = await chat_userMessageContent(instructions, currSelns, { directoryStrService: this._directoryStringService, fileService: this._fileService });
    const userHistoryElt = { role: "user", content: userMessageContent, displayContent: displayMessage ?? instructions, selections: currSelns, attachedFileMeta, state: defaultMessageState };
    this._addMessageToThread(threadId, userHistoryElt);
    this.state.allThreads[threadId]?.state.mountedInfo?.whenMounted.then((m) => {
      m.scrollToBottom();
    });
    const cached = this._plaxioGateService.cachedCredits;
    if (cached && cached.remaining <= 0) {
      await this._plaxioGateService.checkAICredit();
      this._addUserCheckpoint({ threadId });
      return;
    }
    this._plaxioGateService.checkAICredit();
    this._setThreadState(threadId, { currCheckpointIdx: null });
    this._wrapRunAgentToNotify(
      this._runChatAgent({ threadId, ...this._currentModelSelectionProps() }),
      threadId
    );
  }
  async addUserMessageAndStreamResponse({ userMessage, displayMessage, attachedFileMeta, _chatSelections, threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    if (thread.state.currCheckpointIdx !== null) {
      const checkpointIdx = thread.state.currCheckpointIdx;
      const newMessages = thread.messages.slice(0, checkpointIdx + 1);
      const newThreads = {
        ...this.state.allThreads,
        [threadId]: {
          ...thread,
          lastModified: (/* @__PURE__ */ new Date()).toISOString(),
          messages: newMessages
        }
      };
      this._storeAllThreads(newThreads);
      this._setState({ allThreads: newThreads });
    }
    await this._addUserMessageAndStreamResponse({ userMessage, displayMessage, attachedFileMeta, _chatSelections, threadId });
  }
  // ---------- the rest ----------
  _getAllSeenFileURIs(threadId) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return [];
    const fsPathsSet = /* @__PURE__ */ new Set();
    const uris = [];
    const addURI = (uri) => {
      if (!fsPathsSet.has(uri.fsPath)) uris.push(uri);
      fsPathsSet.add(uri.fsPath);
      uris.push(uri);
    };
    for (const m of thread.messages) {
      if (m.role === "user") {
        for (const sel of m.selections ?? []) {
          addURI(sel.uri);
        }
      } else if (m.role === "tool" && m.type === "success" && m.name === "read_file") {
        const params = m.params;
        addURI(params.uri);
      }
    }
    return uris;
  }
  getCodespanLink({ codespanStr, messageIdx, threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return void 0;
    const links = thread.state.linksOfMessageIdx?.[messageIdx];
    if (!links) return void 0;
    const link = links[codespanStr];
    return link;
  }
  async addCodespanLink({ newLinkText, newLinkLocation, messageIdx, threadId }) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    this._setState({
      allThreads: {
        ...this.state.allThreads,
        [threadId]: {
          ...thread,
          state: {
            ...thread.state,
            linksOfMessageIdx: {
              ...thread.state.linksOfMessageIdx,
              [messageIdx]: {
                ...thread.state.linksOfMessageIdx?.[messageIdx],
                [newLinkText]: newLinkLocation
              }
            }
          }
        }
      }
    });
  }
  getCurrentThread() {
    const state = this.state;
    const thread = state.allThreads[state.currentThreadId];
    if (!thread) throw new Error(`Current thread should never be undefined`);
    return thread;
  }
  getCurrentFocusedMessageIdx() {
    const thread = this.getCurrentThread();
    const focusedMessageIdx = thread.state.focusedMessageIdx;
    if (focusedMessageIdx === void 0) return;
    const focusedMessage = thread.messages[focusedMessageIdx];
    if (focusedMessage.role !== "user") return;
    if (!focusedMessage.state) return;
    return focusedMessageIdx;
  }
  isCurrentlyFocusingMessage() {
    return this.getCurrentFocusedMessageIdx() !== void 0;
  }
  switchToThread(threadId) {
    this._setState({ currentThreadId: threadId });
  }
  openNewThread() {
    const { allThreads: currentThreads } = this.state;
    for (const threadId in currentThreads) {
      if (currentThreads[threadId].messages.length === 0) {
        this.switchToThread(threadId);
        return;
      }
    }
    const newThread = newThreadObject();
    const newThreads = {
      ...currentThreads,
      [newThread.id]: newThread
    };
    this._storeAllThreads(newThreads);
    this._setState({ allThreads: newThreads, currentThreadId: newThread.id });
  }
  deleteThread(threadId) {
    const { allThreads: currentThreads } = this.state;
    const newThreads = { ...currentThreads };
    delete newThreads[threadId];
    this._storeAllThreads(newThreads);
    this._setState({ ...this.state, allThreads: newThreads });
  }
  duplicateThread(threadId) {
    const { allThreads: currentThreads } = this.state;
    const threadToDuplicate = currentThreads[threadId];
    if (!threadToDuplicate) return;
    const newThread = {
      ...deepClone(threadToDuplicate),
      id: generateUuid()
    };
    const newThreads = {
      ...currentThreads,
      [newThread.id]: newThread
    };
    this._storeAllThreads(newThreads);
    this._setState({ allThreads: newThreads });
  }
  _addMessageToThread(threadId, message) {
    const { allThreads } = this.state;
    const oldThread = allThreads[threadId];
    if (!oldThread) return;
    const newThreads = {
      ...allThreads,
      [oldThread.id]: {
        ...oldThread,
        lastModified: (/* @__PURE__ */ new Date()).toISOString(),
        messages: [
          ...oldThread.messages,
          message
        ]
      }
    };
    this._storeAllThreads(newThreads);
    this._setState({ allThreads: newThreads });
  }
  // sets the currently selected message (must be undefined if no message is selected)
  setCurrentlyFocusedMessageIdx(messageIdx) {
    const threadId = this.state.currentThreadId;
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    this._setState({
      allThreads: {
        ...this.state.allThreads,
        [threadId]: {
          ...thread,
          state: {
            ...thread.state,
            focusedMessageIdx: messageIdx
          }
        }
      }
    });
  }
  addNewStagingSelection(newSelection) {
    const focusedMessageIdx = this.getCurrentFocusedMessageIdx();
    let selections = [];
    let setSelections = (s) => {
    };
    if (focusedMessageIdx === void 0) {
      selections = this.getCurrentThreadState().stagingSelections;
      setSelections = (s) => this.setCurrentThreadState({ stagingSelections: s });
    } else {
      selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections;
      setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s });
    }
    const idx = findStagingSelectionIndex(selections, newSelection);
    if (idx !== null && idx !== -1) {
      setSelections([
        ...selections.slice(0, idx),
        newSelection,
        ...selections.slice(idx + 1, Infinity)
      ]);
    } else {
      setSelections([...selections ?? [], newSelection]);
    }
  }
  // Pops the staging selections from the current thread's state
  popStagingSelections(numPops) {
    numPops = numPops ?? 1;
    const focusedMessageIdx = this.getCurrentFocusedMessageIdx();
    let selections = [];
    let setSelections = (s) => {
    };
    if (focusedMessageIdx === void 0) {
      selections = this.getCurrentThreadState().stagingSelections;
      setSelections = (s) => this.setCurrentThreadState({ stagingSelections: s });
    } else {
      selections = this.getCurrentMessageState(focusedMessageIdx).stagingSelections;
      setSelections = (s) => this.setCurrentMessageState(focusedMessageIdx, { stagingSelections: s });
    }
    setSelections([
      ...selections.slice(0, selections.length - numPops)
    ]);
  }
  // set message.state
  _setCurrentMessageState(state, messageIdx) {
    const threadId = this.state.currentThreadId;
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    this._setState({
      allThreads: {
        ...this.state.allThreads,
        [threadId]: {
          ...thread,
          messages: thread.messages.map(
            (m, i) => i === messageIdx && m.role === "user" ? {
              ...m,
              state: {
                ...m.state,
                ...state
              }
            } : m
          )
        }
      }
    });
  }
  // set thread.state
  _setThreadState(threadId, state, doNotRefreshMountInfo) {
    const thread = this.state.allThreads[threadId];
    if (!thread) return;
    this._setState({
      allThreads: {
        ...this.state.allThreads,
        [thread.id]: {
          ...thread,
          state: {
            ...thread.state,
            ...state
          }
        }
      }
    }, doNotRefreshMountInfo);
  }
  // gets `staging` and `setStaging` of the currently focused element, given the index of the currently selected message (or undefined if no message is selected)
  getCurrentMessageState(messageIdx) {
    const currMessage = this.getCurrentThread()?.messages?.[messageIdx];
    if (!currMessage || currMessage.role !== "user") return defaultMessageState;
    return currMessage.state;
  }
  setCurrentMessageState(messageIdx, newState) {
    const currMessage = this.getCurrentThread()?.messages?.[messageIdx];
    if (!currMessage || currMessage.role !== "user") return;
    this._setCurrentMessageState(newState, messageIdx);
  }
};
ChatThreadService = __decorateClass([
  __decorateParam(0, IStorageService),
  __decorateParam(1, IVoidModelService),
  __decorateParam(2, ILLMMessageService),
  __decorateParam(3, IToolsService),
  __decorateParam(4, IVoidSettingsService),
  __decorateParam(5, ILanguageFeaturesService),
  __decorateParam(6, IMetricsService),
  __decorateParam(7, IEditCodeService),
  __decorateParam(8, INotificationService),
  __decorateParam(9, IConvertToLLMMessageService),
  __decorateParam(10, IWorkspaceContextService),
  __decorateParam(11, IDirectoryStrService),
  __decorateParam(12, IFileService),
  __decorateParam(13, IMCPService),
  __decorateParam(14, IPlaxioGateService)
], ChatThreadService);
registerSingleton(IChatThreadService, ChatThreadService, InstantiationType.Eager);
export {
  IChatThreadService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi92b2lkL2Jyb3dzZXIvY2hhdFRocmVhZFNlcnZpY2UudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS1cbiAqICBDb3B5cmlnaHQgMjAyNSBHbGFzcyBEZXZ0b29scywgSW5jLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBBcGFjaGUgTGljZW5zZSwgVmVyc2lvbiAyLjAuIFNlZSBMSUNFTlNFLnR4dCBmb3IgbW9yZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBEaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJlZ2lzdGVyU2luZ2xldG9uLCBJbnN0YW50aWF0aW9uVHlwZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJU3RvcmFnZVNlcnZpY2UsIFN0b3JhZ2VTY29wZSwgU3RvcmFnZVRhcmdldCB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3N0b3JhZ2UvY29tbW9uL3N0b3JhZ2UuanMnO1xuXG5pbXBvcnQgeyBVUkkgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi91cmkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTExNTWVzc2FnZVNlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vc2VuZExMTU1lc3NhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGNoYXRfdXNlck1lc3NhZ2VDb250ZW50LCBpc0FCdWlsdGluVG9vbE5hbWUgfSBmcm9tICcuLi9jb21tb24vcHJvbXB0L3Byb21wdHMuanMnO1xuaW1wb3J0IHsgQW50aHJvcGljUmVhc29uaW5nLCBnZXRFcnJvck1lc3NhZ2UsIFJhd1Rvb2xDYWxsT2JqLCBSYXdUb29sUGFyYW1zT2JqIH0gZnJvbSAnLi4vY29tbW9uL3NlbmRMTE1NZXNzYWdlVHlwZXMuanMnO1xuaW1wb3J0IHsgZ2VuZXJhdGVVdWlkIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXVpZC5qcyc7XG5pbXBvcnQgeyBGZWF0dXJlTmFtZSwgTW9kZWxTZWxlY3Rpb24sIE1vZGVsU2VsZWN0aW9uT3B0aW9ucyB9IGZyb20gJy4uL2NvbW1vbi92b2lkU2V0dGluZ3NUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVm9pZFNldHRpbmdzU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92b2lkU2V0dGluZ3NTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGFwcHJvdmFsVHlwZU9mQnVpbHRpblRvb2xOYW1lLCBCdWlsdGluVG9vbENhbGxQYXJhbXMsIFRvb2xDYWxsUGFyYW1zLCBUb29sTmFtZSwgVG9vbFJlc3VsdCB9IGZyb20gJy4uL2NvbW1vbi90b29sc1NlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBJVG9vbHNTZXJ2aWNlIH0gZnJvbSAnLi90b29sc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9zZXJ2aWNlcy9sYW5ndWFnZUZlYXR1cmVzLmpzJztcbmltcG9ydCB7IENoYXRNZXNzYWdlLCBDaGVja3BvaW50RW50cnksIENvZGVzcGFuTG9jYXRpb25MaW5rLCBTdGFnaW5nU2VsZWN0aW9uSXRlbSwgVG9vbE1lc3NhZ2UgfSBmcm9tICcuLi9jb21tb24vY2hhdFRocmVhZFNlcnZpY2VUeXBlcy5qcyc7XG5pbXBvcnQgeyBQb3NpdGlvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9wb3NpdGlvbi5qcyc7XG5pbXBvcnQgeyBJTWV0cmljc1NlcnZpY2UgfSBmcm9tICcuLi9jb21tb24vbWV0cmljc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgc2hvcnRlbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhYmVscy5qcyc7XG5pbXBvcnQgeyBJVm9pZE1vZGVsU2VydmljZSB9IGZyb20gJy4uL2NvbW1vbi92b2lkTW9kZWxTZXJ2aWNlLmpzJztcbmltcG9ydCB7IGZpbmRMYXN0LCBmaW5kTGFzdElkeCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5c0ZpbmQuanMnO1xuaW1wb3J0IHsgSUVkaXRDb2RlU2VydmljZSB9IGZyb20gJy4vZWRpdENvZGVTZXJ2aWNlSW50ZXJmYWNlLmpzJztcbmltcG9ydCB7IFZvaWRGaWxlU25hcHNob3QgfSBmcm9tICcuLi9jb21tb24vZWRpdENvZGVTZXJ2aWNlVHlwZXMuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UsIFNldmVyaXR5IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbm90aWZpY2F0aW9uL2NvbW1vbi9ub3RpZmljYXRpb24uanMnO1xuaW1wb3J0IHsgdHJ1bmNhdGUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IFRIUkVBRF9TVE9SQUdFX0tFWSB9IGZyb20gJy4uL2NvbW1vbi9zdG9yYWdlS2V5cy5qcyc7XG5pbXBvcnQgeyBJQ29udmVydFRvTExNTWVzc2FnZVNlcnZpY2UgfSBmcm9tICcuL2NvbnZlcnRUb0xMTU1lc3NhZ2VTZXJ2aWNlLmpzJztcbmltcG9ydCB7IHRpbWVvdXQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9hc3luYy5qcyc7XG5pbXBvcnQgeyBkZWVwQ2xvbmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElXb3Jrc3BhY2VDb250ZXh0U2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL3dvcmtzcGFjZS9jb21tb24vd29ya3NwYWNlLmpzJztcbmltcG9ydCB7IElEaXJlY3RvcnlTdHJTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL2RpcmVjdG9yeVN0clNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUZpbGVTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vZmlsZXMvY29tbW9uL2ZpbGVzLmpzJztcbmltcG9ydCB7IElNQ1BTZXJ2aWNlIH0gZnJvbSAnLi4vY29tbW9uL21jcFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgUmF3TUNQVG9vbENhbGwgfSBmcm9tICcuLi9jb21tb24vbWNwU2VydmljZVR5cGVzLmpzJztcblxuXG4vLyByZWxhdGVkIHRvIHJldHJ5aW5nIHdoZW4gTExNIG1lc3NhZ2UgaGFzIGVycm9yXG5jb25zdCBDSEFUX1JFVFJJRVMgPSAzXG5jb25zdCBSRVRSWV9ERUxBWSA9IDI1MDBcblxuXG5jb25zdCBmaW5kU3RhZ2luZ1NlbGVjdGlvbkluZGV4ID0gKGN1cnJlbnRTZWxlY3Rpb25zOiBTdGFnaW5nU2VsZWN0aW9uSXRlbVtdIHwgdW5kZWZpbmVkLCBuZXdTZWxlY3Rpb246IFN0YWdpbmdTZWxlY3Rpb25JdGVtKTogbnVtYmVyIHwgbnVsbCA9PiB7XG5cdGlmICghY3VycmVudFNlbGVjdGlvbnMpIHJldHVybiBudWxsXG5cblx0Zm9yIChsZXQgaSA9IDA7IGkgPCBjdXJyZW50U2VsZWN0aW9ucy5sZW5ndGg7IGkgKz0gMSkge1xuXHRcdGNvbnN0IHMgPSBjdXJyZW50U2VsZWN0aW9uc1tpXVxuXG5cdFx0aWYgKHMudXJpLmZzUGF0aCAhPT0gbmV3U2VsZWN0aW9uLnVyaS5mc1BhdGgpIGNvbnRpbnVlXG5cblx0XHRpZiAocy50eXBlID09PSAnRmlsZScgJiYgbmV3U2VsZWN0aW9uLnR5cGUgPT09ICdGaWxlJykge1xuXHRcdFx0cmV0dXJuIGlcblx0XHR9XG5cdFx0aWYgKHMudHlwZSA9PT0gJ0NvZGVTZWxlY3Rpb24nICYmIG5ld1NlbGVjdGlvbi50eXBlID09PSAnQ29kZVNlbGVjdGlvbicpIHtcblx0XHRcdGlmIChzLnVyaS5mc1BhdGggIT09IG5ld1NlbGVjdGlvbi51cmkuZnNQYXRoKSBjb250aW51ZVxuXHRcdFx0Ly8gaWYgdGhlcmUncyBhbnkgY29sbGlzaW9uIHJldHVybiB0cnVlXG5cdFx0XHRjb25zdCBbb2xkU3RhcnQsIG9sZEVuZF0gPSBzLnJhbmdlXG5cdFx0XHRjb25zdCBbbmV3U3RhcnQsIG5ld0VuZF0gPSBuZXdTZWxlY3Rpb24ucmFuZ2Vcblx0XHRcdGlmIChvbGRTdGFydCAhPT0gbmV3U3RhcnQgfHwgb2xkRW5kICE9PSBuZXdFbmQpIGNvbnRpbnVlXG5cdFx0XHRyZXR1cm4gaVxuXHRcdH1cblx0XHRpZiAocy50eXBlID09PSAnRm9sZGVyJyAmJiBuZXdTZWxlY3Rpb24udHlwZSA9PT0gJ0ZvbGRlcicpIHtcblx0XHRcdHJldHVybiBpXG5cdFx0fVxuXHR9XG5cdHJldHVybiBudWxsXG59XG5cblxuLypcblxuU3RvcmUgYSBjaGVja3BvaW50IG9mIGFsbCBcImJlZm9yZVwiIGZpbGVzIG9uIGVhY2ggeC5cbngncyBzaG93IHVwIGJlZm9yZSB1c2VyIG1lc3NhZ2VzIGFuZCBMTE0gZWRpdCB0b29sIGNhbGxzLlxuXG54ICAgICBBICAgICAgICAgIChlZGl0ZWQgQSAtPiBBJylcbiguLi4gdXNlciBtb2RpZmllZCBjaGFuZ2VzIC4uLilcblVzZXIgbWVzc2FnZVxuXG54ICAgICBBJyBCIEMgICAgIChlZGl0ZWQgQSctPkEnJywgQi0+QicsIEMtPkMnKVxuTExNIEVkaXRcbnhcbkxMTSBFZGl0XG54XG5MTE0gRWRpdFxuXG5cbklOVkFSSUFOVDpcbkEgY2hlY2twb2ludCBhcHBlYXJzIGJlZm9yZSBldmVyeSBMTE0gbWVzc2FnZSwgYW5kIGJlZm9yZSBldmVyeSB1c2VyIG1lc3NhZ2UgKGJlZm9yZSB1c2VyIHJlYWxseSBtZWFucyBkaXJlY3RseSBhZnRlciBMTE0gaXMgZG9uZSkuXG4qL1xuXG5cbnR5cGUgVXNlck1lc3NhZ2VUeXBlID0gQ2hhdE1lc3NhZ2UgJiB7IHJvbGU6ICd1c2VyJyB9XG50eXBlIFVzZXJNZXNzYWdlU3RhdGUgPSBVc2VyTWVzc2FnZVR5cGVbJ3N0YXRlJ11cbmNvbnN0IGRlZmF1bHRNZXNzYWdlU3RhdGU6IFVzZXJNZXNzYWdlU3RhdGUgPSB7XG5cdHN0YWdpbmdTZWxlY3Rpb25zOiBbXSxcblx0aXNCZWluZ0VkaXRlZDogZmFsc2UsXG59XG5cbi8vIGEgJ3RocmVhZCcgbWVhbnMgYSBjaGF0IG1lc3NhZ2UgaGlzdG9yeVxuXG50eXBlIFdoZW5Nb3VudGVkID0ge1xuXHR0ZXh0QXJlYVJlZjogeyBjdXJyZW50OiBIVE1MVGV4dEFyZWFFbGVtZW50IHwgbnVsbCB9OyAvLyB0aGUgdGV4dGFyZWEgdGhhdCB0aGlzIHRocmVhZCBoYXMsIGdldHMgc2V0IGluIFNpZGViYXJDaGF0XG5cdHNjcm9sbFRvQm90dG9tOiAoKSA9PiB2b2lkO1xufVxuXG5cblxuZXhwb3J0IHR5cGUgVGhyZWFkVHlwZSA9IHtcblx0aWQ6IHN0cmluZzsgLy8gc3RvcmUgdGhlIGlkIGhlcmUgdG9vXG5cdGNyZWF0ZWRBdDogc3RyaW5nOyAvLyBJU08gc3RyaW5nXG5cdGxhc3RNb2RpZmllZDogc3RyaW5nOyAvLyBJU08gc3RyaW5nXG5cblx0bWVzc2FnZXM6IENoYXRNZXNzYWdlW107XG5cdGZpbGVzV2l0aFVzZXJDaGFuZ2VzOiBTZXQ8c3RyaW5nPjtcblxuXHQvLyB0aGlzIGRvZXNuJ3QgbmVlZCB0byBnbyBpbiBhIHN0YXRlIG9iamVjdCwgYnV0IGZlZWxzIHJpZ2h0XG5cdHN0YXRlOiB7XG5cdFx0Y3VyckNoZWNrcG9pbnRJZHg6IG51bWJlciB8IG51bGw7IC8vIHRoZSBsYXRlc3QgY2hlY2twb2ludCB3ZSdyZSBhdCAobnVsbCBpZiBub3QgYXQgYSBwYXJ0aWN1bGFyIGNoZWNrcG9pbnQsIGxpa2UgaWYgdGhlIGNoYXQgaXMgc3RyZWFtaW5nLCBvciBjaGF0IGp1c3QgZmluaXNoZWQgYW5kIHdlIGhhdmVuJ3QgY2xpY2tlZCBvbiBhIGNoZWNrcHQpXG5cblx0XHRzdGFnaW5nU2VsZWN0aW9uczogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXTtcblx0XHRmb2N1c2VkTWVzc2FnZUlkeDogbnVtYmVyIHwgdW5kZWZpbmVkOyAvLyBpbmRleCBvZiB0aGUgdXNlciBtZXNzYWdlIHRoYXQgaXMgYmVpbmcgZWRpdGVkICh1bmRlZmluZWQgaWYgbm9uZSlcblxuXHRcdGxpbmtzT2ZNZXNzYWdlSWR4OiB7IC8vIGVnLiBsaW5rID0gbGlua3NPZk1lc3NhZ2VJZHhbNF1bJ1JhbmdlRnVuY3Rpb24nXVxuXHRcdFx0W21lc3NhZ2VJZHg6IG51bWJlcl06IHtcblx0XHRcdFx0W2NvZGVzcGFuTmFtZTogc3RyaW5nXTogQ29kZXNwYW5Mb2NhdGlvbkxpbmtcblx0XHRcdH1cblx0XHR9XG5cblxuXHRcdG1vdW50ZWRJbmZvPzoge1xuXHRcdFx0d2hlbk1vdW50ZWQ6IFByb21pc2U8V2hlbk1vdW50ZWQ+XG5cdFx0XHRfd2hlbk1vdW50ZWRSZXNvbHZlcjogKHJlczogV2hlbk1vdW50ZWQpID0+IHZvaWRcblx0XHRcdG1vdW50ZWRJc1Jlc29sdmVkUmVmOiB7IGN1cnJlbnQ6IGJvb2xlYW4gfTtcblx0XHR9XG5cblxuXHR9O1xufVxuXG50eXBlIENoYXRUaHJlYWRzID0ge1xuXHRbaWQ6IHN0cmluZ106IHVuZGVmaW5lZCB8IFRocmVhZFR5cGU7XG59XG5cblxuZXhwb3J0IHR5cGUgVGhyZWFkc1N0YXRlID0ge1xuXHRhbGxUaHJlYWRzOiBDaGF0VGhyZWFkcztcblx0Y3VycmVudFRocmVhZElkOiBzdHJpbmc7IC8vIGludGVuZGVkIGZvciBpbnRlcm5hbCB1c2Ugb25seVxufVxuXG5leHBvcnQgdHlwZSBJc1J1bm5pbmdUeXBlID1cblx0fCAnTExNJyAvLyB0aGUgTExNIGlzIGN1cnJlbnRseSBzdHJlYW1pbmdcblx0fCAndG9vbCcgLy8gd2hldGhlciBhIHRvb2wgaXMgY3VycmVudGx5IHJ1bm5pbmdcblx0fCAnYXdhaXRpbmdfdXNlcicgLy8gYXdhaXRpbmcgdXNlciBjYWxsXG5cdHwgJ2lkbGUnIC8vIG5vdGhpbmcgaXMgcnVubmluZyBub3csIGJ1dCB0aGUgY2hhdCBzaG91bGQgc3RpbGwgYXBwZWFyIGxpa2UgaXQncyBnb2luZyAodXNlZCBpbi1iZXR3ZWVuIGNhbGxzKVxuXHR8IHVuZGVmaW5lZFxuXG5leHBvcnQgdHlwZSBUaHJlYWRTdHJlYW1TdGF0ZSA9IHtcblx0W3RocmVhZElkOiBzdHJpbmddOiB1bmRlZmluZWQgfCB7XG5cdFx0aXNSdW5uaW5nOiB1bmRlZmluZWQ7XG5cdFx0ZXJyb3I/OiB7IG1lc3NhZ2U6IHN0cmluZywgZnVsbEVycm9yOiBFcnJvciB8IG51bGwsIH07XG5cdFx0bGxtSW5mbz86IHVuZGVmaW5lZDtcblx0XHR0b29sSW5mbz86IHVuZGVmaW5lZDtcblx0XHRpbnRlcnJ1cHQ/OiB1bmRlZmluZWQ7XG5cdH0gfCB7IC8vIGFuIGFzc2lzdGFudCBtZXNzYWdlIGlzIGJlaW5nIHdyaXR0ZW5cblx0XHRpc1J1bm5pbmc6ICdMTE0nO1xuXHRcdGVycm9yPzogdW5kZWZpbmVkO1xuXHRcdGxsbUluZm86IHtcblx0XHRcdGRpc3BsYXlDb250ZW50U29GYXI6IHN0cmluZztcblx0XHRcdHJlYXNvbmluZ1NvRmFyOiBzdHJpbmc7XG5cdFx0XHR0b29sQ2FsbFNvRmFyOiBSYXdUb29sQ2FsbE9iaiB8IG51bGw7XG5cdFx0fTtcblx0XHR0b29sSW5mbz86IHVuZGVmaW5lZDtcblx0XHRpbnRlcnJ1cHQ6IFByb21pc2U8KCkgPT4gdm9pZD47IC8vIGNhbGxpbmcgdGhpcyBzaG91bGQgaGF2ZSBubyBlZmZlY3Qgb24gc3RhdGUgLSB3b3VsZCBiZSB0b28gY29uZnVzaW5nLiBpdCBqdXN0IGNhbmNlbHMgdGhlIHRvb2xcblx0fSB8IHsgLy8gYSB0b29sIGlzIGJlaW5nIHJ1blxuXHRcdGlzUnVubmluZzogJ3Rvb2wnO1xuXHRcdGVycm9yPzogdW5kZWZpbmVkO1xuXHRcdGxsbUluZm8/OiB1bmRlZmluZWQ7XG5cdFx0dG9vbEluZm86IHtcblx0XHRcdHRvb2xOYW1lOiBUb29sTmFtZTtcblx0XHRcdHRvb2xQYXJhbXM6IFRvb2xDYWxsUGFyYW1zPFRvb2xOYW1lPjtcblx0XHRcdGlkOiBzdHJpbmc7XG5cdFx0XHRjb250ZW50OiBzdHJpbmc7XG5cdFx0XHRyYXdQYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmo7XG5cdFx0XHRtY3BTZXJ2ZXJOYW1lOiBzdHJpbmcgfCB1bmRlZmluZWQ7XG5cdFx0fTtcblx0XHRpbnRlcnJ1cHQ6IFByb21pc2U8KCkgPT4gdm9pZD47XG5cdH0gfCB7XG5cdFx0aXNSdW5uaW5nOiAnYXdhaXRpbmdfdXNlcic7XG5cdFx0ZXJyb3I/OiB1bmRlZmluZWQ7XG5cdFx0bGxtSW5mbz86IHVuZGVmaW5lZDtcblx0XHR0b29sSW5mbz86IHVuZGVmaW5lZDtcblx0XHRpbnRlcnJ1cHQ/OiB1bmRlZmluZWQ7XG5cdH0gfCB7XG5cdFx0aXNSdW5uaW5nOiAnaWRsZSc7XG5cdFx0ZXJyb3I/OiB1bmRlZmluZWQ7XG5cdFx0bGxtSW5mbz86IHVuZGVmaW5lZDtcblx0XHR0b29sSW5mbz86IHVuZGVmaW5lZDtcblx0XHRpbnRlcnJ1cHQ6ICdub3RfbmVlZGVkJyB8IFByb21pc2U8KCkgPT4gdm9pZD47IC8vIGNhbGxpbmcgdGhpcyBzaG91bGQgaGF2ZSBubyBlZmZlY3Qgb24gc3RhdGUgLSB3b3VsZCBiZSB0b28gY29uZnVzaW5nLiBpdCBqdXN0IGNhbmNlbHMgdGhlIHRvb2xcblx0fVxufVxuXG5jb25zdCBuZXdUaHJlYWRPYmplY3QgPSAoKSA9PiB7XG5cdGNvbnN0IG5vdyA9IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKVxuXHRyZXR1cm4ge1xuXHRcdGlkOiBnZW5lcmF0ZVV1aWQoKSxcblx0XHRjcmVhdGVkQXQ6IG5vdyxcblx0XHRsYXN0TW9kaWZpZWQ6IG5vdyxcblx0XHRtZXNzYWdlczogW10sXG5cdFx0c3RhdGU6IHtcblx0XHRcdGN1cnJDaGVja3BvaW50SWR4OiBudWxsLFxuXHRcdFx0c3RhZ2luZ1NlbGVjdGlvbnM6IFtdLFxuXHRcdFx0Zm9jdXNlZE1lc3NhZ2VJZHg6IHVuZGVmaW5lZCxcblx0XHRcdGxpbmtzT2ZNZXNzYWdlSWR4OiB7fSxcblx0XHR9LFxuXHRcdGZpbGVzV2l0aFVzZXJDaGFuZ2VzOiBuZXcgU2V0KClcblx0fSBzYXRpc2ZpZXMgVGhyZWFkVHlwZVxufVxuXG5cblxuXG5cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFRocmVhZFNlcnZpY2Uge1xuXHRyZWFkb25seSBfc2VydmljZUJyYW5kOiB1bmRlZmluZWQ7XG5cblx0cmVhZG9ubHkgc3RhdGU6IFRocmVhZHNTdGF0ZTtcblx0cmVhZG9ubHkgc3RyZWFtU3RhdGU6IFRocmVhZFN0cmVhbVN0YXRlOyAvLyBub3QgcGVyc2lzdGVudFxuXG5cdG9uRGlkQ2hhbmdlQ3VycmVudFRocmVhZDogRXZlbnQ8dm9pZD47XG5cdG9uRGlkQ2hhbmdlU3RyZWFtU3RhdGU6IEV2ZW50PHsgdGhyZWFkSWQ6IHN0cmluZyB9PlxuXG5cdGdldEN1cnJlbnRUaHJlYWQoKTogVGhyZWFkVHlwZTtcblx0b3Blbk5ld1RocmVhZCgpOiB2b2lkO1xuXHRzd2l0Y2hUb1RocmVhZCh0aHJlYWRJZDogc3RyaW5nKTogdm9pZDtcblxuXHQvLyB0aHJlYWQgc2VsZWN0b3Jcblx0ZGVsZXRlVGhyZWFkKHRocmVhZElkOiBzdHJpbmcpOiB2b2lkO1xuXHRkdXBsaWNhdGVUaHJlYWQodGhyZWFkSWQ6IHN0cmluZyk6IHZvaWQ7XG5cblx0Ly8gZXhwb3NlZCBnZXR0ZXJzL3NldHRlcnNcblx0Ly8gdGhlc2UgYWxsIGFwcGx5IHRvIGN1cnJlbnQgdGhyZWFkXG5cdGdldEN1cnJlbnRNZXNzYWdlU3RhdGU6IChtZXNzYWdlSWR4OiBudW1iZXIpID0+IFVzZXJNZXNzYWdlU3RhdGVcblx0c2V0Q3VycmVudE1lc3NhZ2VTdGF0ZTogKG1lc3NhZ2VJZHg6IG51bWJlciwgbmV3U3RhdGU6IFBhcnRpYWw8VXNlck1lc3NhZ2VTdGF0ZT4pID0+IHZvaWRcblx0Z2V0Q3VycmVudFRocmVhZFN0YXRlOiAoKSA9PiBUaHJlYWRUeXBlWydzdGF0ZSddXG5cdHNldEN1cnJlbnRUaHJlYWRTdGF0ZTogKG5ld1N0YXRlOiBQYXJ0aWFsPFRocmVhZFR5cGVbJ3N0YXRlJ10+KSA9PiB2b2lkXG5cblx0Ly8geW91IGNhbiBlZGl0IG11bHRpcGxlIG1lc3NhZ2VzIC0gdGhlIG9uZSB5b3UncmUgY3VycmVudGx5IGVkaXRpbmcgaXMgXCJmb2N1c2VkXCIsIGFuZCB3ZSBhZGQgaXRlbXMgdG8gdGhhdCBvbmUgd2hlbiB5b3UgcHJlc3MgY21kK0wuXG5cdGdldEN1cnJlbnRGb2N1c2VkTWVzc2FnZUlkeCgpOiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdGlzQ3VycmVudGx5Rm9jdXNpbmdNZXNzYWdlKCk6IGJvb2xlYW47XG5cdHNldEN1cnJlbnRseUZvY3VzZWRNZXNzYWdlSWR4KG1lc3NhZ2VJZHg6IG51bWJlciB8IHVuZGVmaW5lZCk6IHZvaWQ7XG5cblx0cG9wU3RhZ2luZ1NlbGVjdGlvbnMobnVtUG9wcz86IG51bWJlcik6IHZvaWQ7XG5cdGFkZE5ld1N0YWdpbmdTZWxlY3Rpb24obmV3U2VsZWN0aW9uOiBTdGFnaW5nU2VsZWN0aW9uSXRlbSk6IHZvaWQ7XG5cblx0ZGFuZ2Vyb3VzU2V0U3RhdGU6IChuZXdTdGF0ZTogVGhyZWFkc1N0YXRlKSA9PiB2b2lkO1xuXHRyZXNldFN0YXRlOiAoKSA9PiB2b2lkO1xuXG5cdC8vIC8vIGN1cnJlbnQgdGhyZWFkJ3Mgc3RhZ2luZyBzZWxlY3Rpb25zXG5cdC8vIGNsb3NlQ3VycmVudFN0YWdpbmdTZWxlY3Rpb25zSW5NZXNzYWdlKG9wdHM6IHsgbWVzc2FnZUlkeDogbnVtYmVyIH0pOiB2b2lkO1xuXHQvLyBjbG9zZUN1cnJlbnRTdGFnaW5nU2VsZWN0aW9uc0luVGhyZWFkKCk6IHZvaWQ7XG5cblx0Ly8gY29kZXNwYW4gbGlua3MgKGxpbmsgdG8gc3ltYm9scyBpbiB0aGUgbWFya2Rvd24pXG5cdGdldENvZGVzcGFuTGluayhvcHRzOiB7IGNvZGVzcGFuU3RyOiBzdHJpbmcsIG1lc3NhZ2VJZHg6IG51bWJlciwgdGhyZWFkSWQ6IHN0cmluZyB9KTogQ29kZXNwYW5Mb2NhdGlvbkxpbmsgfCB1bmRlZmluZWQ7XG5cdGFkZENvZGVzcGFuTGluayhvcHRzOiB7IG5ld0xpbmtUZXh0OiBzdHJpbmcsIG5ld0xpbmtMb2NhdGlvbjogQ29kZXNwYW5Mb2NhdGlvbkxpbmssIG1lc3NhZ2VJZHg6IG51bWJlciwgdGhyZWFkSWQ6IHN0cmluZyB9KTogdm9pZDtcblx0Z2VuZXJhdGVDb2Rlc3Bhbkxpbmsob3B0czogeyBjb2Rlc3BhblN0cjogc3RyaW5nLCB0aHJlYWRJZDogc3RyaW5nIH0pOiBQcm9taXNlPENvZGVzcGFuTG9jYXRpb25MaW5rPjtcblx0Z2V0UmVsYXRpdmVTdHIodXJpOiBVUkkpOiBzdHJpbmcgfCB1bmRlZmluZWRcblxuXHQvLyBlbnRyeSBwdHNcblx0YWJvcnRSdW5uaW5nKHRocmVhZElkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+O1xuXHRkaXNtaXNzU3RyZWFtRXJyb3IodGhyZWFkSWQ6IHN0cmluZyk6IHZvaWQ7XG5cblx0Ly8gY2FsbCB0byBlZGl0IGEgbWVzc2FnZVxuXHRlZGl0VXNlck1lc3NhZ2VBbmRTdHJlYW1SZXNwb25zZSh7IHVzZXJNZXNzYWdlLCBtZXNzYWdlSWR4LCB0aHJlYWRJZCB9OiB7IHVzZXJNZXNzYWdlOiBzdHJpbmcsIG1lc3NhZ2VJZHg6IG51bWJlciwgdGhyZWFkSWQ6IHN0cmluZyB9KTogUHJvbWlzZTx2b2lkPjtcblxuXHQvLyBjYWxsIHRvIGFkZCBhIG1lc3NhZ2Vcblx0YWRkVXNlck1lc3NhZ2VBbmRTdHJlYW1SZXNwb25zZSh7IHVzZXJNZXNzYWdlLCB0aHJlYWRJZCB9OiB7IHVzZXJNZXNzYWdlOiBzdHJpbmcsIHRocmVhZElkOiBzdHJpbmcgfSk6IFByb21pc2U8dm9pZD47XG5cblx0Ly8gYXBwcm92ZS9yZWplY3Rcblx0YXBwcm92ZUxhdGVzdFRvb2xSZXF1ZXN0KHRocmVhZElkOiBzdHJpbmcpOiB2b2lkO1xuXHRyZWplY3RMYXRlc3RUb29sUmVxdWVzdCh0aHJlYWRJZDogc3RyaW5nKTogdm9pZDtcblxuXHQvLyBqdW1wIHRvIGhpc3Rvcnlcblx0anVtcFRvQ2hlY2twb2ludEJlZm9yZU1lc3NhZ2VJZHgob3B0czogeyB0aHJlYWRJZDogc3RyaW5nLCBtZXNzYWdlSWR4OiBudW1iZXIsIGp1bXBUb1VzZXJNb2RpZmllZDogYm9vbGVhbiB9KTogdm9pZDtcblxuXHRmb2N1c0N1cnJlbnRDaGF0OiAoKSA9PiBQcm9taXNlPHZvaWQ+XG5cdGJsdXJDdXJyZW50Q2hhdDogKCkgPT4gUHJvbWlzZTx2b2lkPlxufVxuXG5leHBvcnQgY29uc3QgSUNoYXRUaHJlYWRTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElDaGF0VGhyZWFkU2VydmljZT4oJ3ZvaWRDaGF0VGhyZWFkU2VydmljZScpO1xuY2xhc3MgQ2hhdFRocmVhZFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRUaHJlYWRTZXJ2aWNlIHtcblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8vIHRoaXMgZmlyZXMgd2hlbiB0aGUgY3VycmVudCB0aHJlYWQgY2hhbmdlcyBhdCBhbGwgKGEgc3dpdGNoIG9mIGN1cnJlbnRUaHJlYWQsIG9yIGEgbWVzc2FnZSBhZGRlZCB0byBpdCwgZXRjKVxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUN1cnJlbnRUaHJlYWQgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZUN1cnJlbnRUaHJlYWQ6IEV2ZW50PHZvaWQ+ID0gdGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50VGhyZWFkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU3RyZWFtU3RhdGUgPSBuZXcgRW1pdHRlcjx7IHRocmVhZElkOiBzdHJpbmcgfT4oKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VTdHJlYW1TdGF0ZTogRXZlbnQ8eyB0aHJlYWRJZDogc3RyaW5nIH0+ID0gdGhpcy5fb25EaWRDaGFuZ2VTdHJlYW1TdGF0ZS5ldmVudDtcblxuXHRyZWFkb25seSBzdHJlYW1TdGF0ZTogVGhyZWFkU3RyZWFtU3RhdGUgPSB7fVxuXHRzdGF0ZTogVGhyZWFkc1N0YXRlIC8vIGFsbFRocmVhZHMgaXMgcGVyc2lzdGVkLCBjdXJyZW50VGhyZWFkIGlzIG5vdFxuXG5cdC8vIHVzZWQgaW4gY2hlY2twb2ludGluZ1xuXHQvLyBwcml2YXRlIHJlYWRvbmx5IF91c2VyTW9kaWZpZWRGaWxlc1RvQ2hlY2tJbkNoZWNrcG9pbnRzID0gbmV3IExSVUNhY2hlPHN0cmluZywgbnVsbD4oNTApXG5cblxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJU3RvcmFnZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc3RvcmFnZVNlcnZpY2U6IElTdG9yYWdlU2VydmljZSxcblx0XHRASVZvaWRNb2RlbFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfdm9pZE1vZGVsU2VydmljZTogSVZvaWRNb2RlbFNlcnZpY2UsXG5cdFx0QElMTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sbG1NZXNzYWdlU2VydmljZTogSUxMTU1lc3NhZ2VTZXJ2aWNlLFxuXHRcdEBJVG9vbHNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3Rvb2xzU2VydmljZTogSVRvb2xzU2VydmljZSxcblx0XHRASVZvaWRTZXR0aW5nc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfc2V0dGluZ3NTZXJ2aWNlOiBJVm9pZFNldHRpbmdzU2VydmljZSxcblx0XHRASUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlOiBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UsXG5cdFx0QElNZXRyaWNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9tZXRyaWNzU2VydmljZTogSU1ldHJpY3NTZXJ2aWNlLFxuXHRcdEBJRWRpdENvZGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2VkaXRDb2RlU2VydmljZTogSUVkaXRDb2RlU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbm90aWZpY2F0aW9uU2VydmljZTogSU5vdGlmaWNhdGlvblNlcnZpY2UsXG5cdFx0QElDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jb252ZXJ0VG9MTE1NZXNzYWdlc1NlcnZpY2U6IElDb252ZXJ0VG9MTE1NZXNzYWdlU2VydmljZSxcblx0XHRASVdvcmtzcGFjZUNvbnRleHRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlOiBJV29ya3NwYWNlQ29udGV4dFNlcnZpY2UsXG5cdFx0QElEaXJlY3RvcnlTdHJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2RpcmVjdG9yeVN0cmluZ1NlcnZpY2U6IElEaXJlY3RvcnlTdHJTZXJ2aWNlLFxuXHRcdEBJRmlsZVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfZmlsZVNlcnZpY2U6IElGaWxlU2VydmljZSxcblx0XHRASU1DUFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfbWNwU2VydmljZTogSU1DUFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKClcblx0XHR0aGlzLnN0YXRlID0geyBhbGxUaHJlYWRzOiB7fSwgY3VycmVudFRocmVhZElkOiBudWxsIGFzIHVua25vd24gYXMgc3RyaW5nIH0gLy8gZGVmYXVsdCBzdGF0ZVxuXG5cdFx0Y29uc3QgcmVhZFRocmVhZHMgPSB0aGlzLl9yZWFkQWxsVGhyZWFkcygpIHx8IHt9XG5cblx0XHRjb25zdCBhbGxUaHJlYWRzID0gcmVhZFRocmVhZHNcblx0XHR0aGlzLnN0YXRlID0ge1xuXHRcdFx0YWxsVGhyZWFkczogYWxsVGhyZWFkcyxcblx0XHRcdGN1cnJlbnRUaHJlYWRJZDogbnVsbCBhcyB1bmtub3duIGFzIHN0cmluZywgLy8gZ2V0cyBzZXQgaW4gc3RhcnROZXdUaHJlYWQoKVxuXHRcdH1cblxuXHRcdC8vIGFsd2F5cyBiZSBpbiBhIHRocmVhZFxuXHRcdHRoaXMub3Blbk5ld1RocmVhZCgpXG5cblxuXHRcdC8vIGtlZXAgdHJhY2sgb2YgdXNlci1tb2RpZmllZCBmaWxlc1xuXHRcdC8vIGNvbnN0IGRpc3Bvc2FibGVzT2ZNb2RlbElkOiB7IFttb2RlbElkOiBzdHJpbmddOiBJRGlzcG9zYWJsZVtdIH0gPSB7fVxuXHRcdC8vIHRoaXMuX3JlZ2lzdGVyKFxuXHRcdC8vIFx0dGhpcy5fbW9kZWxTZXJ2aWNlLm9uTW9kZWxBZGRlZChlID0+IHtcblx0XHQvLyBcdFx0aWYgKCEoZS5pZCBpbiBkaXNwb3NhYmxlc09mTW9kZWxJZCkpIGRpc3Bvc2FibGVzT2ZNb2RlbElkW2UuaWRdID0gW11cblx0XHQvLyBcdFx0ZGlzcG9zYWJsZXNPZk1vZGVsSWRbZS5pZF0ucHVzaChcblx0XHQvLyBcdFx0XHRlLm9uRGlkQ2hhbmdlQ29udGVudCgoKSA9PiB7IHRoaXMuX3VzZXJNb2RpZmllZEZpbGVzVG9DaGVja0luQ2hlY2twb2ludHMuc2V0KGUudXJpLmZzUGF0aCwgbnVsbCkgfSlcblx0XHQvLyBcdFx0KVxuXHRcdC8vIFx0fSlcblx0XHQvLyApXG5cdFx0Ly8gdGhpcy5fcmVnaXN0ZXIodGhpcy5fbW9kZWxTZXJ2aWNlLm9uTW9kZWxSZW1vdmVkKGUgPT4ge1xuXHRcdC8vIFx0aWYgKCEoZS5pZCBpbiBkaXNwb3NhYmxlc09mTW9kZWxJZCkpIHJldHVyblxuXHRcdC8vIFx0ZGlzcG9zYWJsZXNPZk1vZGVsSWRbZS5pZF0uZm9yRWFjaChkID0+IGQuZGlzcG9zZSgpKVxuXHRcdC8vIH0pKVxuXG5cdH1cblxuXHRhc3luYyBmb2N1c0N1cnJlbnRDaGF0KCkge1xuXHRcdGNvbnN0IHRocmVhZElkID0gdGhpcy5zdGF0ZS5jdXJyZW50VGhyZWFkSWRcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVyblxuXHRcdGNvbnN0IHMgPSBhd2FpdCB0aHJlYWQuc3RhdGUubW91bnRlZEluZm8/LndoZW5Nb3VudGVkXG5cdFx0aWYgKCF0aGlzLmlzQ3VycmVudGx5Rm9jdXNpbmdNZXNzYWdlKCkpIHtcblx0XHRcdHM/LnRleHRBcmVhUmVmLmN1cnJlbnQ/LmZvY3VzKClcblx0XHR9XG5cdH1cblx0YXN5bmMgYmx1ckN1cnJlbnRDaGF0KCkge1xuXHRcdGNvbnN0IHRocmVhZElkID0gdGhpcy5zdGF0ZS5jdXJyZW50VGhyZWFkSWRcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVyblxuXHRcdGNvbnN0IHMgPSBhd2FpdCB0aHJlYWQuc3RhdGUubW91bnRlZEluZm8/LndoZW5Nb3VudGVkXG5cdFx0aWYgKCF0aGlzLmlzQ3VycmVudGx5Rm9jdXNpbmdNZXNzYWdlKCkpIHtcblx0XHRcdHM/LnRleHRBcmVhUmVmLmN1cnJlbnQ/LmJsdXIoKVxuXHRcdH1cblx0fVxuXG5cblxuXHRkYW5nZXJvdXNTZXRTdGF0ZSA9IChuZXdTdGF0ZTogVGhyZWFkc1N0YXRlKSA9PiB7XG5cdFx0dGhpcy5zdGF0ZSA9IG5ld1N0YXRlXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50VGhyZWFkLmZpcmUoKVxuXHR9XG5cdHJlc2V0U3RhdGUgPSAoKSA9PiB7XG5cdFx0dGhpcy5zdGF0ZSA9IHsgYWxsVGhyZWFkczoge30sIGN1cnJlbnRUaHJlYWRJZDogbnVsbCBhcyB1bmtub3duIGFzIHN0cmluZyB9IC8vIHNlZSBjb25zdHJ1Y3RvclxuXHRcdHRoaXMub3Blbk5ld1RocmVhZCgpXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VDdXJyZW50VGhyZWFkLmZpcmUoKVxuXHR9XG5cblx0Ly8gISEhIHRoaXMgaXMgaW1wb3J0YW50IGZvciBwcm9wZXJseSByZXN0b3JpbmcgVVJJcyBmcm9tIHN0b3JhZ2Vcblx0Ly8gc2hvdWxkIHByb2JhYmx5IHJlLXVzZSBjb2RlIGZyb20gdm9pZC9zcmMvdnMvYmFzZS9jb21tb24vbWFyc2hhbGxpbmcudHMgaW5zdGVhZC4gYnV0IHRoaXMgaXMgc2ltcGxlIGVub3VnaFxuXHRwcml2YXRlIF9jb252ZXJ0VGhyZWFkRGF0YUZyb21TdG9yYWdlKHRocmVhZHNTdHI6IHN0cmluZyk6IENoYXRUaHJlYWRzIHtcblx0XHRyZXR1cm4gSlNPTi5wYXJzZSh0aHJlYWRzU3RyLCAoa2V5LCB2YWx1ZSkgPT4ge1xuXHRcdFx0aWYgKHZhbHVlICYmIHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgdmFsdWUuJG1pZCA9PT0gMSkgeyAvLyAkbWlkIGlzIHRoZSBNYXJzaGFsbGVkSWQuICRtaWQgPT09IDEgbWVhbnMgaXQgaXMgYSBVUklcblx0XHRcdFx0cmV0dXJuIFVSSS5mcm9tKHZhbHVlKTsgLy8gVE9ETyBVUkkucmV2aXZlIGluc3RlYWQgb2YgdGhpcz9cblx0XHRcdH1cblx0XHRcdHJldHVybiB2YWx1ZTtcblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgX3JlYWRBbGxUaHJlYWRzKCk6IENoYXRUaHJlYWRzIHwgbnVsbCB7XG5cdFx0Y29uc3QgdGhyZWFkc1N0ciA9IHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLmdldChUSFJFQURfU1RPUkFHRV9LRVksIFN0b3JhZ2VTY29wZS5BUFBMSUNBVElPTik7XG5cdFx0aWYgKCF0aHJlYWRzU3RyKSB7XG5cdFx0XHRyZXR1cm4gbnVsbFxuXHRcdH1cblx0XHRjb25zdCB0aHJlYWRzID0gdGhpcy5fY29udmVydFRocmVhZERhdGFGcm9tU3RvcmFnZSh0aHJlYWRzU3RyKTtcblxuXHRcdHJldHVybiB0aHJlYWRzXG5cdH1cblxuXHRwcml2YXRlIF9zdG9yZUFsbFRocmVhZHModGhyZWFkczogQ2hhdFRocmVhZHMpIHtcblx0XHRjb25zdCBzZXJpYWxpemVkVGhyZWFkcyA9IEpTT04uc3RyaW5naWZ5KHRocmVhZHMpO1xuXHRcdHRoaXMuX3N0b3JhZ2VTZXJ2aWNlLnN0b3JlKFxuXHRcdFx0VEhSRUFEX1NUT1JBR0VfS0VZLFxuXHRcdFx0c2VyaWFsaXplZFRocmVhZHMsXG5cdFx0XHRTdG9yYWdlU2NvcGUuQVBQTElDQVRJT04sXG5cdFx0XHRTdG9yYWdlVGFyZ2V0LlVTRVJcblx0XHQpO1xuXHR9XG5cblxuXHQvLyB0aGlzIHNob3VsZCBiZSB0aGUgb25seSBwbGFjZSB0aGlzLnN0YXRlID0gLi4uIGFwcGVhcnMgYmVzaWRlcyBjb25zdHJ1Y3RvclxuXHRwcml2YXRlIF9zZXRTdGF0ZShzdGF0ZTogUGFydGlhbDxUaHJlYWRzU3RhdGU+LCBkb05vdFJlZnJlc2hNb3VudEluZm8/OiBib29sZWFuKSB7XG5cdFx0Y29uc3QgbmV3U3RhdGUgPSB7XG5cdFx0XHQuLi50aGlzLnN0YXRlLFxuXHRcdFx0Li4uc3RhdGVcblx0XHR9XG5cblx0XHR0aGlzLnN0YXRlID0gbmV3U3RhdGVcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlQ3VycmVudFRocmVhZC5maXJlKClcblxuXG5cdFx0Ly8gaWYgd2UganVzdCBzd2l0Y2hlZCB0byBhIHRocmVhZCwgdXBkYXRlIGl0cyBjdXJyZW50IHN0cmVhbSBzdGF0ZSBpZiBpdCdzIG5vdCBzdHJlYW1pbmcgdG8gcG9zc2libHkgc3RyZWFtaW5nXG5cdFx0Y29uc3QgdGhyZWFkSWQgPSBuZXdTdGF0ZS5jdXJyZW50VGhyZWFkSWRcblx0XHRjb25zdCBzdHJlYW1TdGF0ZSA9IHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdXG5cdFx0aWYgKHN0cmVhbVN0YXRlPy5pc1J1bm5pbmcgPT09IHVuZGVmaW5lZCAmJiAhc3RyZWFtU3RhdGU/LmVycm9yKSB7XG5cblx0XHRcdC8vIHNldCBzdHJlYW1TdGF0ZVxuXHRcdFx0Y29uc3QgbWVzc2FnZXMgPSBuZXdTdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXT8ubWVzc2FnZXNcblx0XHRcdGNvbnN0IGxhc3RNZXNzYWdlID0gbWVzc2FnZXMgJiYgbWVzc2FnZXNbbWVzc2FnZXMubGVuZ3RoIC0gMV1cblx0XHRcdC8vIGlmIGF3YWl0aW5nIHVzZXIgYnV0IHN0cmVhbSBzdGF0ZSBkb2Vzbid0IGluZGljYXRlIGl0IChoYXBwZW5zIGlmIHJlc3RhcnQgVm9pZClcblx0XHRcdGlmIChsYXN0TWVzc2FnZSAmJiBsYXN0TWVzc2FnZS5yb2xlID09PSAndG9vbCcgJiYgbGFzdE1lc3NhZ2UudHlwZSA9PT0gJ3Rvb2xfcmVxdWVzdCcpXG5cdFx0XHRcdHRoaXMuX3NldFN0cmVhbVN0YXRlKHRocmVhZElkLCB7IGlzUnVubmluZzogJ2F3YWl0aW5nX3VzZXInLCB9KVxuXG5cdFx0XHQvLyBpZiBydW5uaW5nIG5vdyBidXQgc3RyZWFtIHN0YXRlIGRvZXNuJ3QgaW5kaWNhdGUgaXQgKGhhcHBlbnMgaWYgcmVzdGFydCBWb2lkKSwgY2FuY2VsIHRoYXQgbGFzdCB0b29sXG5cdFx0XHRpZiAobGFzdE1lc3NhZ2UgJiYgbGFzdE1lc3NhZ2Uucm9sZSA9PT0gJ3Rvb2wnICYmIGxhc3RNZXNzYWdlLnR5cGUgPT09ICdydW5uaW5nX25vdycpIHtcblxuXHRcdFx0XHR0aGlzLl91cGRhdGVMYXRlc3RUb29sKHRocmVhZElkLCB7IHJvbGU6ICd0b29sJywgdHlwZTogJ3JlamVjdGVkJywgY29udGVudDogbGFzdE1lc3NhZ2UuY29udGVudCwgaWQ6IGxhc3RNZXNzYWdlLmlkLCByYXdQYXJhbXM6IGxhc3RNZXNzYWdlLnJhd1BhcmFtcywgcmVzdWx0OiBudWxsLCBuYW1lOiBsYXN0TWVzc2FnZS5uYW1lLCBwYXJhbXM6IGxhc3RNZXNzYWdlLnBhcmFtcywgbWNwU2VydmVyTmFtZTogbGFzdE1lc3NhZ2UubWNwU2VydmVyTmFtZSB9KVxuXHRcdFx0fVxuXG5cdFx0fVxuXG5cblx0XHQvLyBpZiB3ZSBkaWQgbm90IGp1c3Qgc2V0IHRoZSBzdGF0ZSB0byB0cnVlLCBzZXQgbW91bnQgaW5mb1xuXHRcdGlmIChkb05vdFJlZnJlc2hNb3VudEluZm8pIHJldHVyblxuXG5cdFx0bGV0IHdoZW5Nb3VudGVkUmVzb2x2ZXI6ICh3OiBXaGVuTW91bnRlZCkgPT4gdm9pZFxuXHRcdGNvbnN0IHdoZW5Nb3VudGVkUHJvbWlzZSA9IG5ldyBQcm9taXNlPFdoZW5Nb3VudGVkPigocmVzKSA9PiB3aGVuTW91bnRlZFJlc29sdmVyID0gcmVzKVxuXG5cdFx0dGhpcy5fc2V0VGhyZWFkU3RhdGUodGhyZWFkSWQsIHtcblx0XHRcdG1vdW50ZWRJbmZvOiB7XG5cdFx0XHRcdHdoZW5Nb3VudGVkOiB3aGVuTW91bnRlZFByb21pc2UsXG5cdFx0XHRcdG1vdW50ZWRJc1Jlc29sdmVkUmVmOiB7IGN1cnJlbnQ6IGZhbHNlIH0sXG5cdFx0XHRcdF93aGVuTW91bnRlZFJlc29sdmVyOiAodzogV2hlbk1vdW50ZWQpID0+IHtcblx0XHRcdFx0XHR3aGVuTW91bnRlZFJlc29sdmVyKHcpXG5cdFx0XHRcdFx0Y29uc3QgbW91bnRJbmZvID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXT8uc3RhdGUubW91bnRlZEluZm9cblx0XHRcdFx0XHRpZiAobW91bnRJbmZvKSBtb3VudEluZm8ubW91bnRlZElzUmVzb2x2ZWRSZWYuY3VycmVudCA9IHRydWVcblx0XHRcdFx0fSxcblx0XHRcdH1cblx0XHR9LCB0cnVlKSAvLyBkbyBub3QgdHJpZ2dlciBhbiB1cGRhdGVcblxuXG5cblx0fVxuXG5cblx0cHJpdmF0ZSBfc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQ6IHN0cmluZywgc3RhdGU6IFRocmVhZFN0cmVhbVN0YXRlW3N0cmluZ10pIHtcblx0XHR0aGlzLnN0cmVhbVN0YXRlW3RocmVhZElkXSA9IHN0YXRlXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VTdHJlYW1TdGF0ZS5maXJlKHsgdGhyZWFkSWQgfSlcblx0fVxuXG5cblx0Ly8gLS0tLS0tLS0tLSBzdHJlYW1pbmcgLS0tLS0tLS0tLVxuXG5cblxuXHRwcml2YXRlIF9jdXJyZW50TW9kZWxTZWxlY3Rpb25Qcm9wcyA9ICgpID0+IHtcblx0XHQvLyB0aGVzZSBzZXR0aW5ncyBzaG91bGQgbm90IGNoYW5nZSB0aHJvdWdob3V0IHRoZSBsb29wIChlZyBhbnRocm9waWMgYnJlYWtzIGlmIHlvdSBjaGFuZ2UgaXRzIHRoaW5raW5nIG1vZGUgYW5kIGl0J3MgdXNpbmcgdG9vbHMpXG5cdFx0Y29uc3QgZmVhdHVyZU5hbWU6IEZlYXR1cmVOYW1lID0gJ0NoYXQnXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3Rpb24gPSB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUubW9kZWxTZWxlY3Rpb25PZkZlYXR1cmVbZmVhdHVyZU5hbWVdXG5cdFx0Y29uc3QgbW9kZWxTZWxlY3Rpb25PcHRpb25zID0gbW9kZWxTZWxlY3Rpb24gPyB0aGlzLl9zZXR0aW5nc1NlcnZpY2Uuc3RhdGUub3B0aW9uc09mTW9kZWxTZWxlY3Rpb25bZmVhdHVyZU5hbWVdW21vZGVsU2VsZWN0aW9uLnByb3ZpZGVyTmFtZV0/Llttb2RlbFNlbGVjdGlvbi5tb2RlbE5hbWVdIDogdW5kZWZpbmVkXG5cdFx0cmV0dXJuIHsgbW9kZWxTZWxlY3Rpb24sIG1vZGVsU2VsZWN0aW9uT3B0aW9ucyB9XG5cdH1cblxuXG5cblx0cHJpdmF0ZSBfc3dhcE91dExhdGVzdFN0cmVhbWluZ1Rvb2xXaXRoUmVzdWx0ID0gKHRocmVhZElkOiBzdHJpbmcsIHRvb2w6IENoYXRNZXNzYWdlICYgeyByb2xlOiAndG9vbCcgfSkgPT4ge1xuXHRcdGNvbnN0IG1lc3NhZ2VzID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXT8ubWVzc2FnZXNcblx0XHRpZiAoIW1lc3NhZ2VzKSByZXR1cm4gZmFsc2Vcblx0XHRjb25zdCBsYXN0TXNnID0gbWVzc2FnZXNbbWVzc2FnZXMubGVuZ3RoIC0gMV1cblx0XHRpZiAoIWxhc3RNc2cpIHJldHVybiBmYWxzZVxuXG5cdFx0aWYgKGxhc3RNc2cucm9sZSA9PT0gJ3Rvb2wnICYmIGxhc3RNc2cudHlwZSAhPT0gJ2ludmFsaWRfcGFyYW1zJykge1xuXHRcdFx0dGhpcy5fZWRpdE1lc3NhZ2VJblRocmVhZCh0aHJlYWRJZCwgbWVzc2FnZXMubGVuZ3RoIC0gMSwgdG9vbClcblx0XHRcdHJldHVybiB0cnVlXG5cdFx0fVxuXHRcdHJldHVybiBmYWxzZVxuXHR9XG5cdHByaXZhdGUgX3VwZGF0ZUxhdGVzdFRvb2wgPSAodGhyZWFkSWQ6IHN0cmluZywgdG9vbDogQ2hhdE1lc3NhZ2UgJiB7IHJvbGU6ICd0b29sJyB9KSA9PiB7XG5cdFx0Y29uc3Qgc3dhcHBlZCA9IHRoaXMuX3N3YXBPdXRMYXRlc3RTdHJlYW1pbmdUb29sV2l0aFJlc3VsdCh0aHJlYWRJZCwgdG9vbClcblx0XHRpZiAoc3dhcHBlZCkgcmV0dXJuXG5cdFx0dGhpcy5fYWRkTWVzc2FnZVRvVGhyZWFkKHRocmVhZElkLCB0b29sKVxuXHR9XG5cblx0YXBwcm92ZUxhdGVzdFRvb2xSZXF1ZXN0KHRocmVhZElkOiBzdHJpbmcpIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cblx0XHRjb25zdCBsYXN0TXNnID0gdGhyZWFkLm1lc3NhZ2VzW3RocmVhZC5tZXNzYWdlcy5sZW5ndGggLSAxXVxuXHRcdGlmICghKGxhc3RNc2cucm9sZSA9PT0gJ3Rvb2wnICYmIGxhc3RNc2cudHlwZSA9PT0gJ3Rvb2xfcmVxdWVzdCcpKSByZXR1cm4gLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuXG5cdFx0Y29uc3QgY2FsbFRoaXNUb29sRmlyc3Q6IFRvb2xNZXNzYWdlPFRvb2xOYW1lPiA9IGxhc3RNc2dcblxuXHRcdHRoaXMuX3dyYXBSdW5BZ2VudFRvTm90aWZ5KFxuXHRcdFx0dGhpcy5fcnVuQ2hhdEFnZW50KHsgY2FsbFRoaXNUb29sRmlyc3QsIHRocmVhZElkLCAuLi50aGlzLl9jdXJyZW50TW9kZWxTZWxlY3Rpb25Qcm9wcygpIH0pXG5cdFx0XHQsIHRocmVhZElkXG5cdFx0KVxuXHR9XG5cdHJlamVjdExhdGVzdFRvb2xSZXF1ZXN0KHRocmVhZElkOiBzdHJpbmcpIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cblx0XHRjb25zdCBsYXN0TXNnID0gdGhyZWFkLm1lc3NhZ2VzW3RocmVhZC5tZXNzYWdlcy5sZW5ndGggLSAxXVxuXG5cdFx0bGV0IHBhcmFtczogVG9vbENhbGxQYXJhbXM8VG9vbE5hbWU+XG5cdFx0aWYgKGxhc3RNc2cucm9sZSA9PT0gJ3Rvb2wnICYmIGxhc3RNc2cudHlwZSAhPT0gJ2ludmFsaWRfcGFyYW1zJykge1xuXHRcdFx0cGFyYW1zID0gbGFzdE1zZy5wYXJhbXNcblx0XHR9XG5cdFx0ZWxzZSByZXR1cm5cblxuXHRcdGNvbnN0IHsgbmFtZSwgaWQsIHJhd1BhcmFtcywgbWNwU2VydmVyTmFtZSB9ID0gbGFzdE1zZ1xuXG5cdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gdGhpcy50b29sRXJyTXNncy5yZWplY3RlZFxuXHRcdHRoaXMuX3VwZGF0ZUxhdGVzdFRvb2wodGhyZWFkSWQsIHsgcm9sZTogJ3Rvb2wnLCB0eXBlOiAncmVqZWN0ZWQnLCBwYXJhbXM6IHBhcmFtcywgbmFtZTogbmFtZSwgY29udGVudDogZXJyb3JNZXNzYWdlLCByZXN1bHQ6IG51bGwsIGlkLCByYXdQYXJhbXMsIG1jcFNlcnZlck5hbWUgfSlcblx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgdW5kZWZpbmVkKVxuXHR9XG5cblx0cHJpdmF0ZSBfY29tcHV0ZU1DUFNlcnZlck9mVG9vbE5hbWUgPSAodG9vbE5hbWU6IHN0cmluZykgPT4ge1xuXHRcdHJldHVybiB0aGlzLl9tY3BTZXJ2aWNlLmdldE1DUFRvb2xzKCk/LmZpbmQodCA9PiB0Lm5hbWUgPT09IHRvb2xOYW1lKT8ubWNwU2VydmVyTmFtZVxuXHR9XG5cblx0YXN5bmMgYWJvcnRSdW5uaW5nKHRocmVhZElkOiBzdHJpbmcpIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cblx0XHQvLyBhZGQgYXNzaXN0YW50IG1lc3NhZ2Vcblx0XHRpZiAodGhpcy5zdHJlYW1TdGF0ZVt0aHJlYWRJZF0/LmlzUnVubmluZyA9PT0gJ0xMTScpIHtcblx0XHRcdGNvbnN0IHsgZGlzcGxheUNvbnRlbnRTb0ZhciwgcmVhc29uaW5nU29GYXIsIHRvb2xDYWxsU29GYXIgfSA9IHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdLmxsbUluZm9cblx0XHRcdHRoaXMuX2FkZE1lc3NhZ2VUb1RocmVhZCh0aHJlYWRJZCwgeyByb2xlOiAnYXNzaXN0YW50JywgZGlzcGxheUNvbnRlbnQ6IGRpc3BsYXlDb250ZW50U29GYXIsIHJlYXNvbmluZzogcmVhc29uaW5nU29GYXIsIGFudGhyb3BpY1JlYXNvbmluZzogbnVsbCB9KVxuXHRcdFx0aWYgKHRvb2xDYWxsU29GYXIpIHRoaXMuX2FkZE1lc3NhZ2VUb1RocmVhZCh0aHJlYWRJZCwgeyByb2xlOiAnaW50ZXJydXB0ZWRfc3RyZWFtaW5nX3Rvb2wnLCBuYW1lOiB0b29sQ2FsbFNvRmFyLm5hbWUsIG1jcFNlcnZlck5hbWU6IHRoaXMuX2NvbXB1dGVNQ1BTZXJ2ZXJPZlRvb2xOYW1lKHRvb2xDYWxsU29GYXIubmFtZSkgfSlcblx0XHR9XG5cdFx0Ly8gYWRkIHRvb2wgdGhhdCdzIHJ1bm5pbmdcblx0XHRlbHNlIGlmICh0aGlzLnN0cmVhbVN0YXRlW3RocmVhZElkXT8uaXNSdW5uaW5nID09PSAndG9vbCcpIHtcblx0XHRcdGNvbnN0IHsgdG9vbE5hbWUsIHRvb2xQYXJhbXMsIGlkLCBjb250ZW50OiBjb250ZW50XywgcmF3UGFyYW1zLCBtY3BTZXJ2ZXJOYW1lIH0gPSB0aGlzLnN0cmVhbVN0YXRlW3RocmVhZElkXS50b29sSW5mb1xuXHRcdFx0Y29uc3QgY29udGVudCA9IGNvbnRlbnRfIHx8IHRoaXMudG9vbEVyck1zZ3MuaW50ZXJydXB0ZWRcblx0XHRcdHRoaXMuX3VwZGF0ZUxhdGVzdFRvb2wodGhyZWFkSWQsIHsgcm9sZTogJ3Rvb2wnLCBuYW1lOiB0b29sTmFtZSwgcGFyYW1zOiB0b29sUGFyYW1zLCBpZCwgY29udGVudCwgcmF3UGFyYW1zLCB0eXBlOiAncmVqZWN0ZWQnLCByZXN1bHQ6IG51bGwsIG1jcFNlcnZlck5hbWUgfSlcblx0XHR9XG5cdFx0Ly8gcmVqZWN0IHRoZSB0b29sIGZvciB0aGUgdXNlciBpZiByZWxldmFudFxuXHRcdGVsc2UgaWYgKHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdPy5pc1J1bm5pbmcgPT09ICdhd2FpdGluZ191c2VyJykge1xuXHRcdFx0dGhpcy5yZWplY3RMYXRlc3RUb29sUmVxdWVzdCh0aHJlYWRJZClcblx0XHR9XG5cdFx0ZWxzZSBpZiAodGhpcy5zdHJlYW1TdGF0ZVt0aHJlYWRJZF0/LmlzUnVubmluZyA9PT0gJ2lkbGUnKSB7XG5cdFx0XHQvLyBkbyBub3RoaW5nXG5cdFx0fVxuXG5cdFx0dGhpcy5fYWRkVXNlckNoZWNrcG9pbnQoeyB0aHJlYWRJZCB9KVxuXG5cdFx0Ly8gaW50ZXJydXB0IGFueSBlZmZlY3RzXG5cdFx0Y29uc3QgaW50ZXJydXB0ID0gYXdhaXQgdGhpcy5zdHJlYW1TdGF0ZVt0aHJlYWRJZF0/LmludGVycnVwdFxuXHRcdGlmICh0eXBlb2YgaW50ZXJydXB0ID09PSAnZnVuY3Rpb24nKVxuXHRcdFx0aW50ZXJydXB0KClcblxuXG5cdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHVuZGVmaW5lZClcblx0fVxuXG5cblxuXHRwcml2YXRlIHJlYWRvbmx5IHRvb2xFcnJNc2dzID0ge1xuXHRcdHJlamVjdGVkOiAnVG9vbCBjYWxsIHdhcyByZWplY3RlZCBieSB0aGUgdXNlci4nLFxuXHRcdGludGVycnVwdGVkOiAnVG9vbCBjYWxsIHdhcyBpbnRlcnJ1cHRlZCBieSB0aGUgdXNlci4nLFxuXHRcdGVycldoZW5TdHJpbmdpZnlpbmc6IChlcnJvcjogYW55KSA9PiBgVG9vbCBjYWxsIHN1Y2NlZWRlZCwgYnV0IHRoZXJlIHdhcyBhbiBlcnJvciBzdHJpbmdpZnlpbmcgdGhlIG91dHB1dC5cXG4ke2dldEVycm9yTWVzc2FnZShlcnJvcil9YFxuXHR9XG5cblxuXHQvLyBwcml2YXRlIHJlYWRvbmx5IF9jdXJyZW50bHlSdW5uaW5nVG9vbEludGVycnVwdG9yOiB7IFt0aHJlYWRJZDogc3RyaW5nXTogKCgpID0+IHZvaWQpIHwgdW5kZWZpbmVkIH0gPSB7fVxuXG5cblx0Ly8gcmV0dXJucyB0cnVlIHdoZW4gdGhlIHRvb2wgY2FsbCBpcyB3YWl0aW5nIGZvciB1c2VyIGFwcHJvdmFsXG5cdHByaXZhdGUgX3J1blRvb2xDYWxsID0gYXN5bmMgKFxuXHRcdHRocmVhZElkOiBzdHJpbmcsXG5cdFx0dG9vbE5hbWU6IFRvb2xOYW1lLFxuXHRcdHRvb2xJZDogc3RyaW5nLFxuXHRcdG1jcFNlcnZlck5hbWU6IHN0cmluZyB8IHVuZGVmaW5lZCxcblx0XHRvcHRzOiB7IHByZWFwcHJvdmVkOiB0cnVlLCB1bnZhbGlkYXRlZFRvb2xQYXJhbXM6IFJhd1Rvb2xQYXJhbXNPYmosIHZhbGlkYXRlZFBhcmFtczogVG9vbENhbGxQYXJhbXM8VG9vbE5hbWU+IH0gfCB7IHByZWFwcHJvdmVkOiBmYWxzZSwgdW52YWxpZGF0ZWRUb29sUGFyYW1zOiBSYXdUb29sUGFyYW1zT2JqIH0sXG5cdCk6IFByb21pc2U8eyBhd2FpdGluZ1VzZXJBcHByb3ZhbD86IGJvb2xlYW4sIGludGVycnVwdGVkPzogYm9vbGVhbiB9PiA9PiB7XG5cblx0XHQvLyBjb21wdXRlIHRoZXNlIGJlbG93XG5cdFx0bGV0IHRvb2xQYXJhbXM6IFRvb2xDYWxsUGFyYW1zPFRvb2xOYW1lPlxuXHRcdGxldCB0b29sUmVzdWx0OiBUb29sUmVzdWx0PFRvb2xOYW1lPlxuXHRcdGxldCB0b29sUmVzdWx0U3RyOiBzdHJpbmdcblxuXHRcdC8vIENoZWNrIGlmIGl0J3MgYSBidWlsdC1pbiB0b29sXG5cdFx0Y29uc3QgaXNCdWlsdEluVG9vbCA9IGlzQUJ1aWx0aW5Ub29sTmFtZSh0b29sTmFtZSlcblxuXG5cdFx0aWYgKCFvcHRzLnByZWFwcHJvdmVkKSB7IC8vIHNraXAgdGhpcyBpZiBwcmUtYXBwcm92ZWRcblx0XHRcdC8vIDEuIHZhbGlkYXRlIHRvb2wgcGFyYW1zXG5cdFx0XHR0cnkge1xuXHRcdFx0XHRpZiAoaXNCdWlsdEluVG9vbCkge1xuXHRcdFx0XHRcdGNvbnN0IHBhcmFtcyA9IHRoaXMuX3Rvb2xzU2VydmljZS52YWxpZGF0ZVBhcmFtc1t0b29sTmFtZV0ob3B0cy51bnZhbGlkYXRlZFRvb2xQYXJhbXMpXG5cdFx0XHRcdFx0dG9vbFBhcmFtcyA9IHBhcmFtc1xuXHRcdFx0XHR9XG5cdFx0XHRcdGVsc2Uge1xuXHRcdFx0XHRcdHRvb2xQYXJhbXMgPSBvcHRzLnVudmFsaWRhdGVkVG9vbFBhcmFtc1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHRjYXRjaCAoZXJyb3IpIHtcblx0XHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gZ2V0RXJyb3JNZXNzYWdlKGVycm9yKVxuXHRcdFx0XHR0aGlzLl9hZGRNZXNzYWdlVG9UaHJlYWQodGhyZWFkSWQsIHsgcm9sZTogJ3Rvb2wnLCB0eXBlOiAnaW52YWxpZF9wYXJhbXMnLCByYXdQYXJhbXM6IG9wdHMudW52YWxpZGF0ZWRUb29sUGFyYW1zLCByZXN1bHQ6IG51bGwsIG5hbWU6IHRvb2xOYW1lLCBjb250ZW50OiBlcnJvck1lc3NhZ2UsIGlkOiB0b29sSWQsIG1jcFNlcnZlck5hbWUgfSlcblx0XHRcdFx0cmV0dXJuIHt9XG5cdFx0XHR9XG5cdFx0XHQvLyBvbmNlIHZhbGlkYXRlZCwgYWRkIGNoZWNrcG9pbnQgZm9yIGVkaXRcblx0XHRcdGlmICh0b29sTmFtZSA9PT0gJ2VkaXRfZmlsZScpIHsgdGhpcy5fYWRkVG9vbEVkaXRDaGVja3BvaW50KHsgdGhyZWFkSWQsIHVyaTogKHRvb2xQYXJhbXMgYXMgQnVpbHRpblRvb2xDYWxsUGFyYW1zWydlZGl0X2ZpbGUnXSkudXJpIH0pIH1cblx0XHRcdGlmICh0b29sTmFtZSA9PT0gJ3Jld3JpdGVfZmlsZScpIHsgdGhpcy5fYWRkVG9vbEVkaXRDaGVja3BvaW50KHsgdGhyZWFkSWQsIHVyaTogKHRvb2xQYXJhbXMgYXMgQnVpbHRpblRvb2xDYWxsUGFyYW1zWydyZXdyaXRlX2ZpbGUnXSkudXJpIH0pIH1cblxuXHRcdFx0Ly8gMi4gaWYgdG9vbCByZXF1aXJlcyBhcHByb3ZhbCwgYnJlYWsgZnJvbSB0aGUgbG9vcCwgYXdhaXRpbmcgYXBwcm92YWxcblxuXHRcdFx0Y29uc3QgYXBwcm92YWxUeXBlID0gaXNCdWlsdEluVG9vbCA/IGFwcHJvdmFsVHlwZU9mQnVpbHRpblRvb2xOYW1lW3Rvb2xOYW1lXSA6ICdNQ1AgdG9vbHMnXG5cdFx0XHRpZiAoYXBwcm92YWxUeXBlKSB7XG5cdFx0XHRcdGNvbnN0IGF1dG9BcHByb3ZlID0gdGhpcy5fc2V0dGluZ3NTZXJ2aWNlLnN0YXRlLmdsb2JhbFNldHRpbmdzLmF1dG9BcHByb3ZlW2FwcHJvdmFsVHlwZV1cblx0XHRcdFx0Ly8gYWRkIGEgdG9vbF9yZXF1ZXN0IGJlY2F1c2Ugd2UgdXNlIGl0IGZvciBVSSBpZiBhIHRvb2wgaXMgbG9hZGluZyAodGhpcyBzaG91bGQgYmUgaW1wcm92ZWQgaW4gdGhlIGZ1dHVyZSlcblx0XHRcdFx0dGhpcy5fYWRkTWVzc2FnZVRvVGhyZWFkKHRocmVhZElkLCB7IHJvbGU6ICd0b29sJywgdHlwZTogJ3Rvb2xfcmVxdWVzdCcsIGNvbnRlbnQ6ICcoQXdhaXRpbmcgdXNlciBwZXJtaXNzaW9uLi4uKScsIHJlc3VsdDogbnVsbCwgbmFtZTogdG9vbE5hbWUsIHBhcmFtczogdG9vbFBhcmFtcywgaWQ6IHRvb2xJZCwgcmF3UGFyYW1zOiBvcHRzLnVudmFsaWRhdGVkVG9vbFBhcmFtcywgbWNwU2VydmVyTmFtZSB9KVxuXHRcdFx0XHRpZiAoIWF1dG9BcHByb3ZlKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHsgYXdhaXRpbmdVc2VyQXBwcm92YWw6IHRydWUgfVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0dG9vbFBhcmFtcyA9IG9wdHMudmFsaWRhdGVkUGFyYW1zXG5cdFx0fVxuXG5cblxuXG5cblxuXHRcdC8vIDMuIGNhbGwgdGhlIHRvb2xcblx0XHQvLyB0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgeyBpc1J1bm5pbmc6ICd0b29sJyB9LCAnbWVyZ2UnKVxuXHRcdGNvbnN0IHJ1bm5pbmdUb29sID0geyByb2xlOiAndG9vbCcsIHR5cGU6ICdydW5uaW5nX25vdycsIG5hbWU6IHRvb2xOYW1lLCBwYXJhbXM6IHRvb2xQYXJhbXMsIGNvbnRlbnQ6ICcodmFsdWUgbm90IHJlY2VpdmVkIHlldC4uLiknLCByZXN1bHQ6IG51bGwsIGlkOiB0b29sSWQsIHJhd1BhcmFtczogb3B0cy51bnZhbGlkYXRlZFRvb2xQYXJhbXMsIG1jcFNlcnZlck5hbWUgfSBhcyBjb25zdFxuXHRcdHRoaXMuX3VwZGF0ZUxhdGVzdFRvb2wodGhyZWFkSWQsIHJ1bm5pbmdUb29sKVxuXG5cblx0XHRsZXQgaW50ZXJydXB0ZWQgPSBmYWxzZVxuXHRcdGxldCByZXNvbHZlSW50ZXJydXB0b3I6IChyOiAoKSA9PiB2b2lkKSA9PiB2b2lkID0gKCkgPT4geyB9XG5cdFx0Y29uc3QgaW50ZXJydXB0b3JQcm9taXNlID0gbmV3IFByb21pc2U8KCkgPT4gdm9pZD4ocmVzID0+IHsgcmVzb2x2ZUludGVycnVwdG9yID0gcmVzIH0pXG5cdFx0dHJ5IHtcblxuXHRcdFx0Ly8gc2V0IHN0cmVhbSBzdGF0ZVxuXHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiAndG9vbCcsIGludGVycnVwdDogaW50ZXJydXB0b3JQcm9taXNlLCB0b29sSW5mbzogeyB0b29sTmFtZSwgdG9vbFBhcmFtcywgaWQ6IHRvb2xJZCwgY29udGVudDogJ2ludGVycnVwdGVkLi4uJywgcmF3UGFyYW1zOiBvcHRzLnVudmFsaWRhdGVkVG9vbFBhcmFtcywgbWNwU2VydmVyTmFtZSB9IH0pXG5cblx0XHRcdGlmIChpc0J1aWx0SW5Ub29sKSB7XG5cdFx0XHRcdGNvbnN0IHsgcmVzdWx0LCBpbnRlcnJ1cHRUb29sIH0gPSBhd2FpdCB0aGlzLl90b29sc1NlcnZpY2UuY2FsbFRvb2xbdG9vbE5hbWVdKHRvb2xQYXJhbXMgYXMgYW55KVxuXHRcdFx0XHRjb25zdCBpbnRlcnJ1cHRvciA9ICgpID0+IHsgaW50ZXJydXB0ZWQgPSB0cnVlOyBpbnRlcnJ1cHRUb29sPy4oKSB9XG5cdFx0XHRcdHJlc29sdmVJbnRlcnJ1cHRvcihpbnRlcnJ1cHRvcilcblxuXHRcdFx0XHR0b29sUmVzdWx0ID0gYXdhaXQgcmVzdWx0XG5cdFx0XHR9XG5cdFx0XHRlbHNlIHtcblx0XHRcdFx0Y29uc3QgbWNwVG9vbHMgPSB0aGlzLl9tY3BTZXJ2aWNlLmdldE1DUFRvb2xzKClcblx0XHRcdFx0Y29uc3QgbWNwVG9vbCA9IG1jcFRvb2xzPy5maW5kKHQgPT4gdC5uYW1lID09PSB0b29sTmFtZSlcblx0XHRcdFx0aWYgKCFtY3BUb29sKSB7IHRocm93IG5ldyBFcnJvcihgTUNQIHRvb2wgJHt0b29sTmFtZX0gbm90IGZvdW5kYCkgfVxuXG5cdFx0XHRcdHJlc29sdmVJbnRlcnJ1cHRvcigoKSA9PiB7IH0pXG5cblx0XHRcdFx0dG9vbFJlc3VsdCA9IChhd2FpdCB0aGlzLl9tY3BTZXJ2aWNlLmNhbGxNQ1BUb29sKHtcblx0XHRcdFx0XHRzZXJ2ZXJOYW1lOiBtY3BUb29sLm1jcFNlcnZlck5hbWUgPz8gJ3Vua25vd25fbWNwX3NlcnZlcicsXG5cdFx0XHRcdFx0dG9vbE5hbWU6IHRvb2xOYW1lLFxuXHRcdFx0XHRcdHBhcmFtczogdG9vbFBhcmFtc1xuXHRcdFx0XHR9KSkucmVzdWx0XG5cdFx0XHR9XG5cblx0XHRcdGlmIChpbnRlcnJ1cHRlZCkgeyByZXR1cm4geyBpbnRlcnJ1cHRlZDogdHJ1ZSB9IH0gLy8gdGhlIHRvb2wgcmVzdWx0IGlzIGFkZGVkIHdoZXJlIHdlIGludGVycnVwdCwgbm90IGhlcmVcblx0XHR9XG5cdFx0Y2F0Y2ggKGVycm9yKSB7XG5cdFx0XHRyZXNvbHZlSW50ZXJydXB0b3IoKCkgPT4geyB9KSAvLyByZXNvbHZlIGZvciB0aGUgc2FrZSBvZiBpdFxuXHRcdFx0aWYgKGludGVycnVwdGVkKSB7IHJldHVybiB7IGludGVycnVwdGVkOiB0cnVlIH0gfSAvLyB0aGUgdG9vbCByZXN1bHQgaXMgYWRkZWQgd2hlcmUgd2UgaW50ZXJydXB0LCBub3QgaGVyZVxuXG5cdFx0XHRjb25zdCBlcnJvck1lc3NhZ2UgPSBnZXRFcnJvck1lc3NhZ2UoZXJyb3IpXG5cdFx0XHR0aGlzLl91cGRhdGVMYXRlc3RUb29sKHRocmVhZElkLCB7IHJvbGU6ICd0b29sJywgdHlwZTogJ3Rvb2xfZXJyb3InLCBwYXJhbXM6IHRvb2xQYXJhbXMsIHJlc3VsdDogZXJyb3JNZXNzYWdlLCBuYW1lOiB0b29sTmFtZSwgY29udGVudDogZXJyb3JNZXNzYWdlLCBpZDogdG9vbElkLCByYXdQYXJhbXM6IG9wdHMudW52YWxpZGF0ZWRUb29sUGFyYW1zLCBtY3BTZXJ2ZXJOYW1lIH0pXG5cdFx0XHRyZXR1cm4ge31cblx0XHR9XG5cblx0XHQvLyA0LiBzdHJpbmdpZnkgdGhlIHJlc3VsdCB0byBnaXZlIHRvIHRoZSBMTE1cblx0XHR0cnkge1xuXHRcdFx0aWYgKGlzQnVpbHRJblRvb2wpIHtcblx0XHRcdFx0dG9vbFJlc3VsdFN0ciA9IHRoaXMuX3Rvb2xzU2VydmljZS5zdHJpbmdPZlJlc3VsdFt0b29sTmFtZV0odG9vbFBhcmFtcyBhcyBhbnksIHRvb2xSZXN1bHQgYXMgYW55KVxuXHRcdFx0fVxuXHRcdFx0Ly8gRm9yIE1DUCB0b29scywgaGFuZGxlIHRoZSByZXN1bHQgYmFzZWQgb24gaXRzIHR5cGVcblx0XHRcdGVsc2Uge1xuXHRcdFx0XHR0b29sUmVzdWx0U3RyID0gdGhpcy5fbWNwU2VydmljZS5zdHJpbmdpZnlSZXN1bHQodG9vbFJlc3VsdCBhcyBSYXdNQ1BUb29sQ2FsbClcblx0XHRcdH1cblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0Y29uc3QgZXJyb3JNZXNzYWdlID0gdGhpcy50b29sRXJyTXNncy5lcnJXaGVuU3RyaW5naWZ5aW5nKGVycm9yKVxuXHRcdFx0dGhpcy5fdXBkYXRlTGF0ZXN0VG9vbCh0aHJlYWRJZCwgeyByb2xlOiAndG9vbCcsIHR5cGU6ICd0b29sX2Vycm9yJywgcGFyYW1zOiB0b29sUGFyYW1zLCByZXN1bHQ6IGVycm9yTWVzc2FnZSwgbmFtZTogdG9vbE5hbWUsIGNvbnRlbnQ6IGVycm9yTWVzc2FnZSwgaWQ6IHRvb2xJZCwgcmF3UGFyYW1zOiBvcHRzLnVudmFsaWRhdGVkVG9vbFBhcmFtcywgbWNwU2VydmVyTmFtZSB9KVxuXHRcdFx0cmV0dXJuIHt9XG5cdFx0fVxuXG5cdFx0Ly8gNS4gYWRkIHRvIGhpc3RvcnkgYW5kIGtlZXAgZ29pbmdcblx0XHR0aGlzLl91cGRhdGVMYXRlc3RUb29sKHRocmVhZElkLCB7IHJvbGU6ICd0b29sJywgdHlwZTogJ3N1Y2Nlc3MnLCBwYXJhbXM6IHRvb2xQYXJhbXMsIHJlc3VsdDogdG9vbFJlc3VsdCwgbmFtZTogdG9vbE5hbWUsIGNvbnRlbnQ6IHRvb2xSZXN1bHRTdHIsIGlkOiB0b29sSWQsIHJhd1BhcmFtczogb3B0cy51bnZhbGlkYXRlZFRvb2xQYXJhbXMsIG1jcFNlcnZlck5hbWUgfSlcblx0XHRyZXR1cm4ge31cblx0fTtcblxuXG5cblxuXHRwcml2YXRlIGFzeW5jIF9ydW5DaGF0QWdlbnQoe1xuXHRcdHRocmVhZElkLFxuXHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdG1vZGVsU2VsZWN0aW9uT3B0aW9ucyxcblx0XHRjYWxsVGhpc1Rvb2xGaXJzdCxcblx0fToge1xuXHRcdHRocmVhZElkOiBzdHJpbmcsXG5cdFx0bW9kZWxTZWxlY3Rpb246IE1vZGVsU2VsZWN0aW9uIHwgbnVsbCxcblx0XHRtb2RlbFNlbGVjdGlvbk9wdGlvbnM6IE1vZGVsU2VsZWN0aW9uT3B0aW9ucyB8IHVuZGVmaW5lZCxcblxuXHRcdGNhbGxUaGlzVG9vbEZpcnN0PzogVG9vbE1lc3NhZ2U8VG9vbE5hbWU+ICYgeyB0eXBlOiAndG9vbF9yZXF1ZXN0JyB9XG5cdH0pIHtcblxuXG5cdFx0bGV0IGludGVycnVwdGVkV2hlbklkbGUgPSBmYWxzZVxuXHRcdGNvbnN0IGlkbGVJbnRlcnJ1cHRvciA9IFByb21pc2UucmVzb2x2ZSgoKSA9PiB7IGludGVycnVwdGVkV2hlbklkbGUgPSB0cnVlIH0pXG5cdFx0Ly8gX3J1blRvb2xDYWxsIGRvZXMgbm90IG5lZWQgc2V0U3RyZWFtU3RhdGUoe2lkbGV9KSBiZWZvcmUgaXQsIGJ1dCBpdCBuZWVkcyBpdCBhZnRlciBpdC4gKGhhbmRsZXMgaXRzIG93biBzZXRTdHJlYW1TdGF0ZSlcblxuXHRcdC8vIGFib3ZlIGp1c3QgZGVmaW5lcyBoZWxwZXJzLCBiZWxvdyBzdGFydHMgdGhlIGFjdHVhbCBmdW5jdGlvblxuXHRcdGNvbnN0IHsgY2hhdE1vZGUgfSA9IHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZS5nbG9iYWxTZXR0aW5ncyAvLyBzaG91bGQgbm90IGNoYW5nZSBhcyB3ZSBsb29wIGV2ZW4gaWYgdXNlciBjaGFuZ2VzIGl0LCBzbyBpdCBnb2VzIGhlcmVcblx0XHRjb25zdCB7IG92ZXJyaWRlc09mTW9kZWwgfSA9IHRoaXMuX3NldHRpbmdzU2VydmljZS5zdGF0ZVxuXG5cdFx0bGV0IG5NZXNzYWdlc1NlbnQgPSAwXG5cdFx0bGV0IHNob3VsZFNlbmRBbm90aGVyTWVzc2FnZSA9IHRydWVcblx0XHRsZXQgaXNSdW5uaW5nV2hlbkVuZDogSXNSdW5uaW5nVHlwZSA9IHVuZGVmaW5lZFxuXG5cdFx0Ly8gYmVmb3JlIGVudGVyIGxvb3AsIGNhbGwgdG9vbFxuXHRcdGlmIChjYWxsVGhpc1Rvb2xGaXJzdCkge1xuXHRcdFx0Y29uc3QgeyBpbnRlcnJ1cHRlZCB9ID0gYXdhaXQgdGhpcy5fcnVuVG9vbENhbGwodGhyZWFkSWQsIGNhbGxUaGlzVG9vbEZpcnN0Lm5hbWUsIGNhbGxUaGlzVG9vbEZpcnN0LmlkLCBjYWxsVGhpc1Rvb2xGaXJzdC5tY3BTZXJ2ZXJOYW1lLCB7IHByZWFwcHJvdmVkOiB0cnVlLCB1bnZhbGlkYXRlZFRvb2xQYXJhbXM6IGNhbGxUaGlzVG9vbEZpcnN0LnJhd1BhcmFtcywgdmFsaWRhdGVkUGFyYW1zOiBjYWxsVGhpc1Rvb2xGaXJzdC5wYXJhbXMgfSlcblx0XHRcdGlmIChpbnRlcnJ1cHRlZCkge1xuXHRcdFx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgdW5kZWZpbmVkKVxuXHRcdFx0XHR0aGlzLl9hZGRVc2VyQ2hlY2twb2ludCh7IHRocmVhZElkIH0pXG5cblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiAnaWRsZScsIGludGVycnVwdDogJ25vdF9uZWVkZWQnIH0pICAvLyBqdXN0IGRlY29yYXRpdmUsIGZvciBjbGFyaXR5XG5cblxuXHRcdC8vIHRvb2wgdXNlIGxvb3Bcblx0XHR3aGlsZSAoc2hvdWxkU2VuZEFub3RoZXJNZXNzYWdlKSB7XG5cdFx0XHQvLyBmYWxzZSBieSBkZWZhdWx0IGVhY2ggaXRlcmF0aW9uXG5cdFx0XHRzaG91bGRTZW5kQW5vdGhlck1lc3NhZ2UgPSBmYWxzZVxuXHRcdFx0aXNSdW5uaW5nV2hlbkVuZCA9IHVuZGVmaW5lZFxuXHRcdFx0bk1lc3NhZ2VzU2VudCArPSAxXG5cblx0XHRcdHRoaXMuX3NldFN0cmVhbVN0YXRlKHRocmVhZElkLCB7IGlzUnVubmluZzogJ2lkbGUnLCBpbnRlcnJ1cHQ6IGlkbGVJbnRlcnJ1cHRvciB9KVxuXG5cdFx0XHRjb25zdCBjaGF0TWVzc2FnZXMgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdPy5tZXNzYWdlcyA/PyBbXVxuXHRcdFx0Y29uc3QgeyBtZXNzYWdlcywgc2VwYXJhdGVTeXN0ZW1NZXNzYWdlIH0gPSBhd2FpdCB0aGlzLl9jb252ZXJ0VG9MTE1NZXNzYWdlc1NlcnZpY2UucHJlcGFyZUxMTUNoYXRNZXNzYWdlcyh7XG5cdFx0XHRcdGNoYXRNZXNzYWdlcyxcblx0XHRcdFx0bW9kZWxTZWxlY3Rpb24sXG5cdFx0XHRcdGNoYXRNb2RlXG5cdFx0XHR9KVxuXG5cdFx0XHRpZiAoaW50ZXJydXB0ZWRXaGVuSWRsZSkge1xuXHRcdFx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgdW5kZWZpbmVkKVxuXHRcdFx0XHRyZXR1cm5cblx0XHRcdH1cblxuXHRcdFx0bGV0IHNob3VsZFJldHJ5TExNID0gdHJ1ZVxuXHRcdFx0bGV0IG5BdHRlbXB0cyA9IDBcblx0XHRcdHdoaWxlIChzaG91bGRSZXRyeUxMTSkge1xuXHRcdFx0XHRzaG91bGRSZXRyeUxMTSA9IGZhbHNlXG5cdFx0XHRcdG5BdHRlbXB0cyArPSAxXG5cblx0XHRcdFx0dHlwZSBSZXNUeXBlcyA9XG5cdFx0XHRcdFx0fCB7IHR5cGU6ICdsbG1Eb25lJywgdG9vbENhbGw/OiBSYXdUb29sQ2FsbE9iaiwgaW5mbzogeyBmdWxsVGV4dDogc3RyaW5nLCBmdWxsUmVhc29uaW5nOiBzdHJpbmcsIGFudGhyb3BpY1JlYXNvbmluZzogQW50aHJvcGljUmVhc29uaW5nW10gfCBudWxsIH0gfVxuXHRcdFx0XHRcdHwgeyB0eXBlOiAnbGxtRXJyb3InLCBlcnJvcj86IHsgbWVzc2FnZTogc3RyaW5nOyBmdWxsRXJyb3I6IEVycm9yIHwgbnVsbDsgfSB9XG5cdFx0XHRcdFx0fCB7IHR5cGU6ICdsbG1BYm9ydGVkJyB9XG5cblx0XHRcdFx0bGV0IHJlc01lc3NhZ2VJc0RvbmVQcm9taXNlOiAocmVzOiBSZXNUeXBlcykgPT4gdm9pZCAvLyByZXNvbHZlcyB3aGVuIHVzZXIgYXBwcm92ZXMgdGhpcyB0b29sIHVzZSAob3IgaWYgdG9vbCBkb2Vzbid0IHJlcXVpcmUgYXBwcm92YWwpXG5cdFx0XHRcdGNvbnN0IG1lc3NhZ2VJc0RvbmVQcm9taXNlID0gbmV3IFByb21pc2U8UmVzVHlwZXM+KChyZXMsIHJlaikgPT4geyByZXNNZXNzYWdlSXNEb25lUHJvbWlzZSA9IHJlcyB9KVxuXG5cdFx0XHRcdGNvbnN0IGxsbUNhbmNlbFRva2VuID0gdGhpcy5fbGxtTWVzc2FnZVNlcnZpY2Uuc2VuZExMTU1lc3NhZ2Uoe1xuXHRcdFx0XHRcdG1lc3NhZ2VzVHlwZTogJ2NoYXRNZXNzYWdlcycsXG5cdFx0XHRcdFx0Y2hhdE1vZGUsXG5cdFx0XHRcdFx0bWVzc2FnZXM6IG1lc3NhZ2VzLFxuXHRcdFx0XHRcdG1vZGVsU2VsZWN0aW9uLFxuXHRcdFx0XHRcdG1vZGVsU2VsZWN0aW9uT3B0aW9ucyxcblx0XHRcdFx0XHRvdmVycmlkZXNPZk1vZGVsLFxuXHRcdFx0XHRcdGxvZ2dpbmc6IHsgbG9nZ2luZ05hbWU6IGBDaGF0IC0gJHtjaGF0TW9kZX1gLCBsb2dnaW5nRXh0cmFzOiB7IHRocmVhZElkLCBuTWVzc2FnZXNTZW50LCBjaGF0TW9kZSB9IH0sXG5cdFx0XHRcdFx0c2VwYXJhdGVTeXN0ZW1NZXNzYWdlOiBzZXBhcmF0ZVN5c3RlbU1lc3NhZ2UsXG5cdFx0XHRcdFx0b25UZXh0OiAoeyBmdWxsVGV4dCwgZnVsbFJlYXNvbmluZywgdG9vbENhbGwgfSkgPT4ge1xuXHRcdFx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiAnTExNJywgbGxtSW5mbzogeyBkaXNwbGF5Q29udGVudFNvRmFyOiBmdWxsVGV4dCwgcmVhc29uaW5nU29GYXI6IGZ1bGxSZWFzb25pbmcsIHRvb2xDYWxsU29GYXI6IHRvb2xDYWxsID8/IG51bGwgfSwgaW50ZXJydXB0OiBQcm9taXNlLnJlc29sdmUoKCkgPT4geyBpZiAobGxtQ2FuY2VsVG9rZW4pIHRoaXMuX2xsbU1lc3NhZ2VTZXJ2aWNlLmFib3J0KGxsbUNhbmNlbFRva2VuKSB9KSB9KVxuXHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0b25GaW5hbE1lc3NhZ2U6IGFzeW5jICh7IGZ1bGxUZXh0LCBmdWxsUmVhc29uaW5nLCB0b29sQ2FsbCwgYW50aHJvcGljUmVhc29uaW5nLCB9KSA9PiB7XG5cdFx0XHRcdFx0XHRyZXNNZXNzYWdlSXNEb25lUHJvbWlzZSh7IHR5cGU6ICdsbG1Eb25lJywgdG9vbENhbGwsIGluZm86IHsgZnVsbFRleHQsIGZ1bGxSZWFzb25pbmcsIGFudGhyb3BpY1JlYXNvbmluZyB9IH0pIC8vIHJlc29sdmUgd2l0aCB0b29sIGNhbGxzXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkVycm9yOiBhc3luYyAoZXJyb3IpID0+IHtcblx0XHRcdFx0XHRcdHJlc01lc3NhZ2VJc0RvbmVQcm9taXNlKHsgdHlwZTogJ2xsbUVycm9yJywgZXJyb3I6IGVycm9yIH0pXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRvbkFib3J0OiAoKSA9PiB7XG5cdFx0XHRcdFx0XHQvLyBzdG9wIHRoZSBsb29wIHRvIGZyZWUgdXAgdGhlIHByb21pc2UsIGJ1dCBkb24ndCBtb2RpZnkgc3RhdGUgKGFscmVhZHkgaGFuZGxlZCBieSB3aGF0ZXZlciBzdG9wcGVkIGl0KVxuXHRcdFx0XHRcdFx0cmVzTWVzc2FnZUlzRG9uZVByb21pc2UoeyB0eXBlOiAnbGxtQWJvcnRlZCcgfSlcblx0XHRcdFx0XHRcdHRoaXMuX21ldHJpY3NTZXJ2aWNlLmNhcHR1cmUoJ0FnZW50IExvb3AgRG9uZSAoQWJvcnRlZCknLCB7IG5NZXNzYWdlc1NlbnQsIGNoYXRNb2RlIH0pXG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0fSlcblxuXHRcdFx0XHQvLyBtYXJrIGFzIHN0cmVhbWluZ1xuXHRcdFx0XHRpZiAoIWxsbUNhbmNlbFRva2VuKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiB1bmRlZmluZWQsIGVycm9yOiB7IG1lc3NhZ2U6ICdUaGVyZSB3YXMgYW4gdW5leHBlY3RlZCBlcnJvciB3aGVuIHNlbmRpbmcgeW91ciBjaGF0IG1lc3NhZ2UuJywgZnVsbEVycm9yOiBudWxsIH0gfSlcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiAnTExNJywgbGxtSW5mbzogeyBkaXNwbGF5Q29udGVudFNvRmFyOiAnJywgcmVhc29uaW5nU29GYXI6ICcnLCB0b29sQ2FsbFNvRmFyOiBudWxsIH0sIGludGVycnVwdDogUHJvbWlzZS5yZXNvbHZlKCgpID0+IHRoaXMuX2xsbU1lc3NhZ2VTZXJ2aWNlLmFib3J0KGxsbUNhbmNlbFRva2VuKSkgfSlcblx0XHRcdFx0Y29uc3QgbGxtUmVzID0gYXdhaXQgbWVzc2FnZUlzRG9uZVByb21pc2UgLy8gd2FpdCBmb3IgbWVzc2FnZSB0byBjb21wbGV0ZVxuXG5cdFx0XHRcdC8vIGlmIHNvbWV0aGluZyBlbHNlIHN0YXJ0ZWQgcnVubmluZyBpbiB0aGUgbWVhbnRpbWVcblx0XHRcdFx0aWYgKHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdPy5pc1J1bm5pbmcgIT09ICdMTE0nKSB7XG5cdFx0XHRcdFx0Ly8gY29uc29sZS5sb2coJ0NoYXQgdGhyZWFkIGludGVycnVwdGVkIGJ5IGEgbmV3ZXIgY2hhdCB0aHJlYWQnLCB0aGlzLnN0cmVhbVN0YXRlW3RocmVhZElkXT8uaXNSdW5uaW5nKVxuXHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHR9XG5cblx0XHRcdFx0Ly8gbGxtIHJlcyBhYm9ydGVkXG5cdFx0XHRcdGlmIChsbG1SZXMudHlwZSA9PT0gJ2xsbUFib3J0ZWQnKSB7XG5cdFx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHVuZGVmaW5lZClcblx0XHRcdFx0XHRyZXR1cm5cblx0XHRcdFx0fVxuXHRcdFx0XHQvLyBsbG0gcmVzIGVycm9yXG5cdFx0XHRcdGVsc2UgaWYgKGxsbVJlcy50eXBlID09PSAnbGxtRXJyb3InKSB7XG5cdFx0XHRcdFx0Ly8gZXJyb3IsIHNob3VsZCByZXRyeVxuXHRcdFx0XHRcdGlmIChuQXR0ZW1wdHMgPCBDSEFUX1JFVFJJRVMpIHtcblx0XHRcdFx0XHRcdHNob3VsZFJldHJ5TExNID0gdHJ1ZVxuXHRcdFx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiAnaWRsZScsIGludGVycnVwdDogaWRsZUludGVycnVwdG9yIH0pXG5cdFx0XHRcdFx0XHRhd2FpdCB0aW1lb3V0KFJFVFJZX0RFTEFZKVxuXHRcdFx0XHRcdFx0aWYgKGludGVycnVwdGVkV2hlbklkbGUpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHVuZGVmaW5lZClcblx0XHRcdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRlbHNlXG5cdFx0XHRcdFx0XHRcdGNvbnRpbnVlIC8vIHJldHJ5XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdC8vIGVycm9yLCBidXQgdG9vIG1hbnkgYXR0ZW1wdHNcblx0XHRcdFx0XHRlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IHsgZXJyb3IgfSA9IGxsbVJlc1xuXHRcdFx0XHRcdFx0Y29uc3QgeyBkaXNwbGF5Q29udGVudFNvRmFyLCByZWFzb25pbmdTb0ZhciwgdG9vbENhbGxTb0ZhciB9ID0gdGhpcy5zdHJlYW1TdGF0ZVt0aHJlYWRJZF0ubGxtSW5mb1xuXHRcdFx0XHRcdFx0dGhpcy5fYWRkTWVzc2FnZVRvVGhyZWFkKHRocmVhZElkLCB7IHJvbGU6ICdhc3Npc3RhbnQnLCBkaXNwbGF5Q29udGVudDogZGlzcGxheUNvbnRlbnRTb0ZhciwgcmVhc29uaW5nOiByZWFzb25pbmdTb0ZhciwgYW50aHJvcGljUmVhc29uaW5nOiBudWxsIH0pXG5cdFx0XHRcdFx0XHRpZiAodG9vbENhbGxTb0ZhcikgdGhpcy5fYWRkTWVzc2FnZVRvVGhyZWFkKHRocmVhZElkLCB7IHJvbGU6ICdpbnRlcnJ1cHRlZF9zdHJlYW1pbmdfdG9vbCcsIG5hbWU6IHRvb2xDYWxsU29GYXIubmFtZSwgbWNwU2VydmVyTmFtZTogdGhpcy5fY29tcHV0ZU1DUFNlcnZlck9mVG9vbE5hbWUodG9vbENhbGxTb0Zhci5uYW1lKSB9KVxuXG5cdFx0XHRcdFx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgeyBpc1J1bm5pbmc6IHVuZGVmaW5lZCwgZXJyb3IgfSlcblx0XHRcdFx0XHRcdHRoaXMuX2FkZFVzZXJDaGVja3BvaW50KHsgdGhyZWFkSWQgfSlcblx0XHRcdFx0XHRcdHJldHVyblxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXG5cdFx0XHRcdC8vIGxsbSByZXMgc3VjY2Vzc1xuXHRcdFx0XHRjb25zdCB7IHRvb2xDYWxsLCBpbmZvIH0gPSBsbG1SZXNcblxuXHRcdFx0XHR0aGlzLl9hZGRNZXNzYWdlVG9UaHJlYWQodGhyZWFkSWQsIHsgcm9sZTogJ2Fzc2lzdGFudCcsIGRpc3BsYXlDb250ZW50OiBpbmZvLmZ1bGxUZXh0LCByZWFzb25pbmc6IGluZm8uZnVsbFJlYXNvbmluZywgYW50aHJvcGljUmVhc29uaW5nOiBpbmZvLmFudGhyb3BpY1JlYXNvbmluZyB9KVxuXG5cdFx0XHRcdHRoaXMuX3NldFN0cmVhbVN0YXRlKHRocmVhZElkLCB7IGlzUnVubmluZzogJ2lkbGUnLCBpbnRlcnJ1cHQ6ICdub3RfbmVlZGVkJyB9KSAvLyBqdXN0IGRlY29yYXRpdmUgZm9yIGNsYXJpdHlcblxuXHRcdFx0XHQvLyBjYWxsIHRvb2wgaWYgdGhlcmUgaXMgb25lXG5cdFx0XHRcdGlmICh0b29sQ2FsbCkge1xuXHRcdFx0XHRcdGNvbnN0IG1jcFRvb2xzID0gdGhpcy5fbWNwU2VydmljZS5nZXRNQ1BUb29scygpXG5cdFx0XHRcdFx0Y29uc3QgbWNwVG9vbCA9IG1jcFRvb2xzPy5maW5kKHQgPT4gdC5uYW1lID09PSB0b29sQ2FsbC5uYW1lKVxuXG5cdFx0XHRcdFx0Y29uc3QgeyBhd2FpdGluZ1VzZXJBcHByb3ZhbCwgaW50ZXJydXB0ZWQgfSA9IGF3YWl0IHRoaXMuX3J1blRvb2xDYWxsKHRocmVhZElkLCB0b29sQ2FsbC5uYW1lLCB0b29sQ2FsbC5pZCwgbWNwVG9vbD8ubWNwU2VydmVyTmFtZSwgeyBwcmVhcHByb3ZlZDogZmFsc2UsIHVudmFsaWRhdGVkVG9vbFBhcmFtczogdG9vbENhbGwucmF3UGFyYW1zIH0pXG5cdFx0XHRcdFx0aWYgKGludGVycnVwdGVkKSB7XG5cdFx0XHRcdFx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgdW5kZWZpbmVkKVxuXHRcdFx0XHRcdFx0cmV0dXJuXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHRcdGlmIChhd2FpdGluZ1VzZXJBcHByb3ZhbCkgeyBpc1J1bm5pbmdXaGVuRW5kID0gJ2F3YWl0aW5nX3VzZXInIH1cblx0XHRcdFx0XHRlbHNlIHsgc2hvdWxkU2VuZEFub3RoZXJNZXNzYWdlID0gdHJ1ZSB9XG5cblx0XHRcdFx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgeyBpc1J1bm5pbmc6ICdpZGxlJywgaW50ZXJydXB0OiAnbm90X25lZWRlZCcgfSkgLy8ganVzdCBkZWNvcmF0aXZlLCBmb3IgY2xhcml0eVxuXHRcdFx0XHR9XG5cblx0XHRcdH0gLy8gZW5kIHdoaWxlIChhdHRlbXB0cylcblx0XHR9IC8vIGVuZCB3aGlsZSAoc2VuZCBtZXNzYWdlKVxuXG5cdFx0Ly8gaWYgYXdhaXRpbmcgdXNlciBhcHByb3ZhbCwga2VlcCBpc1J1bm5pbmcgdHJ1ZSwgZWxzZSBlbmQgaXNSdW5uaW5nXG5cdFx0dGhpcy5fc2V0U3RyZWFtU3RhdGUodGhyZWFkSWQsIHsgaXNSdW5uaW5nOiBpc1J1bm5pbmdXaGVuRW5kIH0pXG5cblx0XHQvLyBhZGQgY2hlY2twb2ludCBiZWZvcmUgdGhlIG5leHQgdXNlciBtZXNzYWdlXG5cdFx0aWYgKCFpc1J1bm5pbmdXaGVuRW5kKSB0aGlzLl9hZGRVc2VyQ2hlY2twb2ludCh7IHRocmVhZElkIH0pXG5cblx0XHQvLyBjYXB0dXJlIG51bWJlciBvZiBtZXNzYWdlcyBzZW50XG5cdFx0dGhpcy5fbWV0cmljc1NlcnZpY2UuY2FwdHVyZSgnQWdlbnQgTG9vcCBEb25lJywgeyBuTWVzc2FnZXNTZW50LCBjaGF0TW9kZSB9KVxuXHR9XG5cblxuXHRwcml2YXRlIF9hZGRDaGVja3BvaW50KHRocmVhZElkOiBzdHJpbmcsIGNoZWNrcG9pbnQ6IENoZWNrcG9pbnRFbnRyeSkge1xuXHRcdHRoaXMuX2FkZE1lc3NhZ2VUb1RocmVhZCh0aHJlYWRJZCwgY2hlY2twb2ludClcblx0XHQvLyAvLyB1cGRhdGUgbGF0ZXN0IGNoZWNrcG9pbnQgaWR4IHRvIHRoZSBvbmUgd2UganVzdCBhZGRlZFxuXHRcdC8vIGNvbnN0IG5ld1RocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHQvLyBpZiAoIW5ld1RocmVhZCkgcmV0dXJuIC8vIHNob3VsZCBuZXZlciBoYXBwZW5cblx0XHQvLyBjb25zdCBjdXJyQ2hlY2twb2ludElkeCA9IG5ld1RocmVhZC5tZXNzYWdlcy5sZW5ndGggLSAxXG5cdFx0Ly8gdGhpcy5fc2V0VGhyZWFkU3RhdGUodGhyZWFkSWQsIHsgY3VyckNoZWNrcG9pbnRJZHg6IGN1cnJDaGVja3BvaW50SWR4IH0pXG5cdH1cblxuXG5cblx0cHJpdmF0ZSBfZWRpdE1lc3NhZ2VJblRocmVhZCh0aHJlYWRJZDogc3RyaW5nLCBtZXNzYWdlSWR4OiBudW1iZXIsIG5ld01lc3NhZ2U6IENoYXRNZXNzYWdlLCkge1xuXHRcdGNvbnN0IHsgYWxsVGhyZWFkcyB9ID0gdGhpcy5zdGF0ZVxuXHRcdGNvbnN0IG9sZFRocmVhZCA9IGFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCFvbGRUaHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cdFx0Ly8gdXBkYXRlIHN0YXRlIGFuZCBzdG9yZSBpdFxuXHRcdGNvbnN0IG5ld1RocmVhZHMgPSB7XG5cdFx0XHQuLi5hbGxUaHJlYWRzLFxuXHRcdFx0W29sZFRocmVhZC5pZF06IHtcblx0XHRcdFx0Li4ub2xkVGhyZWFkLFxuXHRcdFx0XHRsYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcblx0XHRcdFx0bWVzc2FnZXM6IFtcblx0XHRcdFx0XHQuLi5vbGRUaHJlYWQubWVzc2FnZXMuc2xpY2UoMCwgbWVzc2FnZUlkeCksXG5cdFx0XHRcdFx0bmV3TWVzc2FnZSxcblx0XHRcdFx0XHQuLi5vbGRUaHJlYWQubWVzc2FnZXMuc2xpY2UobWVzc2FnZUlkeCArIDEsIEluZmluaXR5KSxcblx0XHRcdFx0XSxcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fc3RvcmVBbGxUaHJlYWRzKG5ld1RocmVhZHMpXG5cdFx0dGhpcy5fc2V0U3RhdGUoeyBhbGxUaHJlYWRzOiBuZXdUaHJlYWRzIH0pIC8vIHRoZSBjdXJyZW50IHRocmVhZCBqdXN0IGNoYW5nZWQgKGl0IGhhZCBhIG1lc3NhZ2UgYWRkZWQgdG8gaXQpXG5cdH1cblxuXG5cdHByaXZhdGUgX2dldENoZWNrcG9pbnRJbmZvID0gKGNoZWNrcG9pbnRNZXNzYWdlOiBDaGF0TWVzc2FnZSAmIHsgcm9sZTogJ2NoZWNrcG9pbnQnIH0sIGZzUGF0aDogc3RyaW5nLCBvcHRzOiB7IGluY2x1ZGVVc2VyTW9kaWZpZWRDaGFuZ2VzOiBib29sZWFuIH0pID0+IHtcblx0XHRjb25zdCB2b2lkRmlsZVNuYXBzaG90ID0gY2hlY2twb2ludE1lc3NhZ2Uudm9pZEZpbGVTbmFwc2hvdE9mVVJJID8gY2hlY2twb2ludE1lc3NhZ2Uudm9pZEZpbGVTbmFwc2hvdE9mVVJJW2ZzUGF0aF0gPz8gbnVsbCA6IG51bGxcblx0XHRpZiAoIW9wdHMuaW5jbHVkZVVzZXJNb2RpZmllZENoYW5nZXMpIHsgcmV0dXJuIHsgdm9pZEZpbGVTbmFwc2hvdCwgfSB9XG5cblx0XHRjb25zdCB1c2VyTW9kaWZpZWRWb2lkRmlsZVNuYXBzaG90ID0gZnNQYXRoIGluIGNoZWNrcG9pbnRNZXNzYWdlLnVzZXJNb2RpZmljYXRpb25zLnZvaWRGaWxlU25hcHNob3RPZlVSSSA/IGNoZWNrcG9pbnRNZXNzYWdlLnVzZXJNb2RpZmljYXRpb25zLnZvaWRGaWxlU25hcHNob3RPZlVSSVtmc1BhdGhdID8/IG51bGwgOiBudWxsXG5cdFx0cmV0dXJuIHsgdm9pZEZpbGVTbmFwc2hvdDogdXNlck1vZGlmaWVkVm9pZEZpbGVTbmFwc2hvdCA/PyB2b2lkRmlsZVNuYXBzaG90LCB9XG5cdH1cblxuXHRwcml2YXRlIF9jb21wdXRlTmV3Q2hlY2twb2ludEluZm8oeyB0aHJlYWRJZCB9OiB7IHRocmVhZElkOiBzdHJpbmcgfSkge1xuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuXG5cblx0XHRjb25zdCBsYXN0Q2hlY2twb2ludElkeCA9IGZpbmRMYXN0SWR4KHRocmVhZC5tZXNzYWdlcywgKG0pID0+IG0ucm9sZSA9PT0gJ2NoZWNrcG9pbnQnKSA/PyAtMVxuXHRcdGlmIChsYXN0Q2hlY2twb2ludElkeCA9PT0gLTEpIHJldHVyblxuXG5cdFx0Y29uc3Qgdm9pZEZpbGVTbmFwc2hvdE9mVVJJOiB7IFtmc1BhdGg6IHN0cmluZ106IFZvaWRGaWxlU25hcHNob3QgfCB1bmRlZmluZWQgfSA9IHt9XG5cblx0XHQvLyBhZGQgYSBjaGFuZ2UgZm9yIGFsbCB0aGUgVVJJcyBpbiB0aGUgY2hlY2twb2ludCBoaXN0b3J5XG5cdFx0Y29uc3QgeyBsYXN0SWR4T2ZVUkkgfSA9IHRoaXMuX2dldENoZWNrcG9pbnRzQmV0d2Vlbih7IHRocmVhZElkLCBsb0lkeDogMCwgaGlJZHg6IGxhc3RDaGVja3BvaW50SWR4LCB9KSA/PyB7fVxuXHRcdGZvciAoY29uc3QgZnNQYXRoIGluIGxhc3RJZHhPZlVSSSA/PyB7fSkge1xuXHRcdFx0Y29uc3QgeyBtb2RlbCB9ID0gdGhpcy5fdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbEZyb21Gc1BhdGgoZnNQYXRoKVxuXHRcdFx0aWYgKCFtb2RlbCkgY29udGludWVcblx0XHRcdGNvbnN0IGNoZWNrcG9pbnQyID0gdGhyZWFkLm1lc3NhZ2VzW2xhc3RJZHhPZlVSSVtmc1BhdGhdXSB8fCBudWxsXG5cdFx0XHRpZiAoIWNoZWNrcG9pbnQyKSBjb250aW51ZVxuXHRcdFx0aWYgKGNoZWNrcG9pbnQyLnJvbGUgIT09ICdjaGVja3BvaW50JykgY29udGludWVcblx0XHRcdGNvbnN0IHJlcyA9IHRoaXMuX2dldENoZWNrcG9pbnRJbmZvKGNoZWNrcG9pbnQyLCBmc1BhdGgsIHsgaW5jbHVkZVVzZXJNb2RpZmllZENoYW5nZXM6IGZhbHNlIH0pXG5cdFx0XHRpZiAoIXJlcykgY29udGludWVcblx0XHRcdGNvbnN0IHsgdm9pZEZpbGVTbmFwc2hvdDogb2xkVm9pZEZpbGVTbmFwc2hvdCB9ID0gcmVzXG5cblx0XHRcdC8vIGlmIHRoZXJlIHdhcyBhbnkgY2hhbmdlIHRvIHRoZSBzdHIgb3IgZGlmZkFyZWFTbmFwc2hvdCwgdXBkYXRlLiByb3VnaCBhcHByb3hpbWF0aW9uIG9mIGVxdWFsaXR5LCBvbGREaWZmQXJlYXNTbmFwc2hvdCA9PT0gZGlmZkFyZWFzU25hcHNob3QgaXMgbm90IHBlcmZlY3Rcblx0XHRcdGNvbnN0IHZvaWRGaWxlU25hcHNob3QgPSB0aGlzLl9lZGl0Q29kZVNlcnZpY2UuZ2V0Vm9pZEZpbGVTbmFwc2hvdChVUkkuZmlsZShmc1BhdGgpKVxuXHRcdFx0aWYgKG9sZFZvaWRGaWxlU25hcHNob3QgPT09IHZvaWRGaWxlU25hcHNob3QpIGNvbnRpbnVlXG5cdFx0XHR2b2lkRmlsZVNuYXBzaG90T2ZVUklbZnNQYXRoXSA9IHZvaWRGaWxlU25hcHNob3Rcblx0XHR9XG5cblx0XHQvLyAvLyBhZGQgYSBjaGFuZ2UgZm9yIGFsbCB1c2VyLWVkaXRlZCBmaWxlcyAodGhhdCBhcmVuJ3QgaW4gdGhlIGhpc3RvcnkpXG5cdFx0Ly8gZm9yIChjb25zdCBmc1BhdGggb2YgdGhpcy5fdXNlck1vZGlmaWVkRmlsZXNUb0NoZWNrSW5DaGVja3BvaW50cy5rZXlzKCkpIHtcblx0XHQvLyBcdGlmIChmc1BhdGggaW4gbGFzdElkeE9mVVJJKSBjb250aW51ZSAvLyBpZiBhbHJlYWR5IHZpc2lzdGVkLCBkb24ndCB2aXNpdCBhZ2FpblxuXHRcdC8vIFx0Y29uc3QgeyBtb2RlbCB9ID0gdGhpcy5fdm9pZE1vZGVsU2VydmljZS5nZXRNb2RlbEZyb21Gc1BhdGgoZnNQYXRoKVxuXHRcdC8vIFx0aWYgKCFtb2RlbCkgY29udGludWVcblx0XHQvLyBcdGN1cnJTdHJPZkZzUGF0aFtmc1BhdGhdID0gbW9kZWwuZ2V0VmFsdWUoRW5kT2ZMaW5lUHJlZmVyZW5jZS5MRilcblx0XHQvLyB9XG5cblx0XHRyZXR1cm4geyB2b2lkRmlsZVNuYXBzaG90T2ZVUkkgfVxuXHR9XG5cblxuXHRwcml2YXRlIF9hZGRVc2VyQ2hlY2twb2ludCh7IHRocmVhZElkIH06IHsgdGhyZWFkSWQ6IHN0cmluZyB9KSB7XG5cdFx0Y29uc3QgeyB2b2lkRmlsZVNuYXBzaG90T2ZVUkkgfSA9IHRoaXMuX2NvbXB1dGVOZXdDaGVja3BvaW50SW5mbyh7IHRocmVhZElkIH0pID8/IHt9XG5cdFx0dGhpcy5fYWRkQ2hlY2twb2ludCh0aHJlYWRJZCwge1xuXHRcdFx0cm9sZTogJ2NoZWNrcG9pbnQnLFxuXHRcdFx0dHlwZTogJ3VzZXJfZWRpdCcsXG5cdFx0XHR2b2lkRmlsZVNuYXBzaG90T2ZVUkk6IHZvaWRGaWxlU25hcHNob3RPZlVSSSA/PyB7fSxcblx0XHRcdHVzZXJNb2RpZmljYXRpb25zOiB7IHZvaWRGaWxlU25hcHNob3RPZlVSSToge30sIH0sXG5cdFx0fSlcblx0fVxuXHQvLyBjYWxsIHRoaXMgcmlnaHQgYWZ0ZXIgTExNIGVkaXRzIGEgZmlsZVxuXHRwcml2YXRlIF9hZGRUb29sRWRpdENoZWNrcG9pbnQoeyB0aHJlYWRJZCwgdXJpLCB9OiB7IHRocmVhZElkOiBzdHJpbmcsIHVyaTogVVJJIH0pIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVyblxuXHRcdGNvbnN0IHsgbW9kZWwgfSA9IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWwodXJpKVxuXHRcdGlmICghbW9kZWwpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cdFx0Y29uc3QgZGlmZkFyZWFzU25hcHNob3QgPSB0aGlzLl9lZGl0Q29kZVNlcnZpY2UuZ2V0Vm9pZEZpbGVTbmFwc2hvdCh1cmkpXG5cdFx0dGhpcy5fYWRkQ2hlY2twb2ludCh0aHJlYWRJZCwge1xuXHRcdFx0cm9sZTogJ2NoZWNrcG9pbnQnLFxuXHRcdFx0dHlwZTogJ3Rvb2xfZWRpdCcsXG5cdFx0XHR2b2lkRmlsZVNuYXBzaG90T2ZVUkk6IHsgW3VyaS5mc1BhdGhdOiBkaWZmQXJlYXNTbmFwc2hvdCB9LFxuXHRcdFx0dXNlck1vZGlmaWNhdGlvbnM6IHsgdm9pZEZpbGVTbmFwc2hvdE9mVVJJOiB7fSB9LFxuXHRcdH0pXG5cdH1cblxuXG5cdHByaXZhdGUgX2dldENoZWNrcG9pbnRCZWZvcmVNZXNzYWdlID0gKHsgdGhyZWFkSWQsIG1lc3NhZ2VJZHggfTogeyB0aHJlYWRJZDogc3RyaW5nLCBtZXNzYWdlSWR4OiBudW1iZXIgfSk6IFtDaGVja3BvaW50RW50cnksIG51bWJlcl0gfCB1bmRlZmluZWQgPT4ge1xuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuIHVuZGVmaW5lZFxuXHRcdGZvciAobGV0IGkgPSBtZXNzYWdlSWR4OyBpID49IDA7IGktLSkge1xuXHRcdFx0Y29uc3QgbWVzc2FnZSA9IHRocmVhZC5tZXNzYWdlc1tpXVxuXHRcdFx0aWYgKG1lc3NhZ2Uucm9sZSA9PT0gJ2NoZWNrcG9pbnQnKSB7XG5cdFx0XHRcdHJldHVybiBbbWVzc2FnZSwgaV1cblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVuZGVmaW5lZFxuXHR9XG5cblx0cHJpdmF0ZSBfZ2V0Q2hlY2twb2ludHNCZXR3ZWVuKHsgdGhyZWFkSWQsIGxvSWR4LCBoaUlkeCB9OiB7IHRocmVhZElkOiBzdHJpbmcsIGxvSWR4OiBudW1iZXIsIGhpSWR4OiBudW1iZXIgfSkge1xuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuIHsgbGFzdElkeE9mVVJJOiB7fSB9IC8vIHNob3VsZCBuZXZlciBoYXBwZW5cblx0XHRjb25zdCBsYXN0SWR4T2ZVUkk6IHsgW2ZzUGF0aDogc3RyaW5nXTogbnVtYmVyIH0gPSB7fVxuXHRcdGZvciAobGV0IGkgPSBsb0lkeDsgaSA8PSBoaUlkeDsgaSArPSAxKSB7XG5cdFx0XHRjb25zdCBtZXNzYWdlID0gdGhyZWFkLm1lc3NhZ2VzW2ldXG5cdFx0XHRpZiAobWVzc2FnZT8ucm9sZSAhPT0gJ2NoZWNrcG9pbnQnKSBjb250aW51ZVxuXHRcdFx0Zm9yIChjb25zdCBmc1BhdGggaW4gbWVzc2FnZS52b2lkRmlsZVNuYXBzaG90T2ZVUkkpIHsgLy8gZG8gbm90IGluY2x1ZGUgdXNlck1vZGlmaWVkLmJlZm9yZVN0ck9mVVJJIGhlcmUsIGp1bXBpbmcgc2hvdWxkIG5vdCBpbmNsdWRlIHRob3NlIGNoYW5nZXNcblx0XHRcdFx0bGFzdElkeE9mVVJJW2ZzUGF0aF0gPSBpXG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB7IGxhc3RJZHhPZlVSSSB9XG5cdH1cblxuXHRwcml2YXRlIF9yZWFkQ3VycmVudENoZWNrcG9pbnQodGhyZWFkSWQ6IHN0cmluZyk6IFtDaGVja3BvaW50RW50cnksIG51bWJlcl0gfCB1bmRlZmluZWQge1xuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuXG5cblx0XHRjb25zdCB7IGN1cnJDaGVja3BvaW50SWR4IH0gPSB0aHJlYWQuc3RhdGVcblx0XHRpZiAoY3VyckNoZWNrcG9pbnRJZHggPT09IG51bGwpIHJldHVyblxuXG5cdFx0Y29uc3QgY2hlY2twb2ludCA9IHRocmVhZC5tZXNzYWdlc1tjdXJyQ2hlY2twb2ludElkeF1cblx0XHRpZiAoIWNoZWNrcG9pbnQpIHJldHVyblxuXHRcdGlmIChjaGVja3BvaW50LnJvbGUgIT09ICdjaGVja3BvaW50JykgcmV0dXJuXG5cdFx0cmV0dXJuIFtjaGVja3BvaW50LCBjdXJyQ2hlY2twb2ludElkeF1cblx0fVxuXHRwcml2YXRlIF9hZGRVc2VyTW9kaWZpY2F0aW9uc1RvQ3VyckNoZWNrcG9pbnQoeyB0aHJlYWRJZCB9OiB7IHRocmVhZElkOiBzdHJpbmcgfSkge1xuXHRcdGNvbnN0IHsgdm9pZEZpbGVTbmFwc2hvdE9mVVJJIH0gPSB0aGlzLl9jb21wdXRlTmV3Q2hlY2twb2ludEluZm8oeyB0aHJlYWRJZCB9KSA/PyB7fVxuXHRcdGNvbnN0IHJlcyA9IHRoaXMuX3JlYWRDdXJyZW50Q2hlY2twb2ludCh0aHJlYWRJZClcblx0XHRpZiAoIXJlcykgcmV0dXJuXG5cdFx0Y29uc3QgW2NoZWNrcG9pbnQsIGNoZWNrcG9pbnRJZHhdID0gcmVzXG5cdFx0dGhpcy5fZWRpdE1lc3NhZ2VJblRocmVhZCh0aHJlYWRJZCwgY2hlY2twb2ludElkeCwge1xuXHRcdFx0Li4uY2hlY2twb2ludCxcblx0XHRcdHVzZXJNb2RpZmljYXRpb25zOiB7IHZvaWRGaWxlU25hcHNob3RPZlVSSTogdm9pZEZpbGVTbmFwc2hvdE9mVVJJID8/IHt9LCB9LFxuXHRcdH0pXG5cdH1cblxuXG5cdHByaXZhdGUgX21ha2VVc1N0YW5kT25DaGVja3BvaW50KHsgdGhyZWFkSWQgfTogeyB0aHJlYWRJZDogc3RyaW5nIH0pIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVyblxuXHRcdGlmICh0aHJlYWQuc3RhdGUuY3VyckNoZWNrcG9pbnRJZHggPT09IG51bGwpIHtcblx0XHRcdGNvbnN0IGxhc3RNc2cgPSB0aHJlYWQubWVzc2FnZXNbdGhyZWFkLm1lc3NhZ2VzLmxlbmd0aCAtIDFdXG5cdFx0XHRpZiAobGFzdE1zZz8ucm9sZSAhPT0gJ2NoZWNrcG9pbnQnKVxuXHRcdFx0XHR0aGlzLl9hZGRVc2VyQ2hlY2twb2ludCh7IHRocmVhZElkIH0pXG5cdFx0XHR0aGlzLl9zZXRUaHJlYWRTdGF0ZSh0aHJlYWRJZCwgeyBjdXJyQ2hlY2twb2ludElkeDogdGhyZWFkLm1lc3NhZ2VzLmxlbmd0aCAtIDEgfSlcblx0XHR9XG5cdH1cblxuXHRqdW1wVG9DaGVja3BvaW50QmVmb3JlTWVzc2FnZUlkeCh7IHRocmVhZElkLCBtZXNzYWdlSWR4LCBqdW1wVG9Vc2VyTW9kaWZpZWQgfTogeyB0aHJlYWRJZDogc3RyaW5nLCBtZXNzYWdlSWR4OiBudW1iZXIsIGp1bXBUb1VzZXJNb2RpZmllZDogYm9vbGVhbiB9KSB7XG5cblx0XHQvLyBpZiBudWxsLCBhZGQgYSBuZXcgdGVtcCBjaGVja3BvaW50IHNvIHVzZXIgY2FuIGp1bXAgZm9yd2FyZCBhZ2FpblxuXHRcdHRoaXMuX21ha2VVc1N0YW5kT25DaGVja3BvaW50KHsgdGhyZWFkSWQgfSlcblxuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF1cblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuXG5cdFx0aWYgKHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdPy5pc1J1bm5pbmcpIHJldHVyblxuXG5cdFx0Y29uc3QgYyA9IHRoaXMuX2dldENoZWNrcG9pbnRCZWZvcmVNZXNzYWdlKHsgdGhyZWFkSWQsIG1lc3NhZ2VJZHggfSlcblx0XHRpZiAoYyA9PT0gdW5kZWZpbmVkKSByZXR1cm4gLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuXG5cdFx0Y29uc3QgZnJvbUlkeCA9IHRocmVhZC5zdGF0ZS5jdXJyQ2hlY2twb2ludElkeFxuXHRcdGlmIChmcm9tSWR4ID09PSBudWxsKSByZXR1cm4gLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuXG5cdFx0Y29uc3QgW18sIHRvSWR4XSA9IGNcblx0XHRpZiAodG9JZHggPT09IGZyb21JZHgpIHJldHVyblxuXG5cdFx0Ly8gY29uc29sZS5sb2coYGdvaW5nIGZyb20gJHtmcm9tSWR4fSB0byAke3RvSWR4fWApXG5cblx0XHQvLyB1cGRhdGUgdGhlIHVzZXIncyBjaGVja3BvaW50XG5cdFx0dGhpcy5fYWRkVXNlck1vZGlmaWNhdGlvbnNUb0N1cnJDaGVja3BvaW50KHsgdGhyZWFkSWQgfSlcblxuXHRcdC8qXG5pZiB1bmRvaW5nXG5cbkEsQixDIGFyZSBhbGwgZmlsZXMuXG54IG1lYW5zIGEgY2hlY2twb2ludCB3aGVyZSB0aGUgZmlsZSBjaGFuZ2VkLlxuXG5BIEIgQyBEIEUgRiBHIEggSVxuICB4IHggeCB4IHggICB4ICAgICAgICAgICA8LS0geW91IGNhbid0IGFsd2F5cyBnbyB1cCB0byBmaW5kIHRoZSBcImJlZm9yZVwiIHZlcnNpb247IHNvbWV0aW1lcyB5b3UgbmVlZCB0byBnbyBkb3duXG4gIHwgfCB8IHwgfCAgIHwgeFxuLS14LXwtfC18LXgtLS14LXwtLS0tLSAgICAgPC0tIHRvXG5cdHwgfCB8IHwgeCAgIHhcblx0fCB8IHggeCB8XG5cdHwgfCAgIHwgfFxuLS0tLXgtfC0tLXgteC0tLS0tLS0gICAgIDwtLSBmcm9tXG5cdCAgeFxuXG5XZSBuZWVkIHRvIHJldmVydCBhbnl0aGluZyB0aGF0IGhhcHBlbmVkIGJldHdlZW4gdG8rMSBhbmQgZnJvbS5cbioqV2UgZG8gdGhpcyBieSBmaW5kaW5nIHRoZSBsYXN0IHggZnJvbSAwLi4uYHRvYCBmb3IgZWFjaCBmaWxlIGFuZCBhcHBseWluZyB0aG9zZSBjb250ZW50cy4qKlxuV2Ugb25seSBuZWVkIHRvIGRvIGl0IGZvciBmaWxlcyB0aGF0IHdlcmUgZWRpdGVkIHNpbmNlIGB0b2AsIGllIGZpbGVzIGJldHdlZW4gdG8rMS4uLmZyb20uXG4qL1xuXHRcdGlmICh0b0lkeCA8IGZyb21JZHgpIHtcblx0XHRcdGNvbnN0IHsgbGFzdElkeE9mVVJJIH0gPSB0aGlzLl9nZXRDaGVja3BvaW50c0JldHdlZW4oeyB0aHJlYWRJZCwgbG9JZHg6IHRvSWR4ICsgMSwgaGlJZHg6IGZyb21JZHggfSlcblxuXHRcdFx0Y29uc3QgaWR4ZXMgPSBmdW5jdGlvbiogKCkge1xuXHRcdFx0XHRmb3IgKGxldCBrID0gdG9JZHg7IGsgPj0gMDsgayAtPSAxKSB7IC8vIGZpcnN0IGdvIHVwXG5cdFx0XHRcdFx0eWllbGQga1xuXHRcdFx0XHR9XG5cdFx0XHRcdGZvciAobGV0IGsgPSB0b0lkeCArIDE7IGsgPCB0aHJlYWQubWVzc2FnZXMubGVuZ3RoOyBrICs9IDEpIHsgLy8gdGhlbiBnbyBkb3duXG5cdFx0XHRcdFx0eWllbGQga1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZnNQYXRoIGluIGxhc3RJZHhPZlVSSSkge1xuXHRcdFx0XHQvLyBmaW5kIHRoZSBmaXJzdCBpbnN0YW5jZSBvZiB0aGlzIGZpbGUgc3RhcnRpbmcgYXQgdG9JZHggKGdvIHVwIHRvIGxhdGVzdCBmaWxlOyBpZiB0aGVyZSBpcyBub25lLCBnbyBkb3duKVxuXHRcdFx0XHRmb3IgKGNvbnN0IGsgb2YgaWR4ZXMoKSkge1xuXHRcdFx0XHRcdGNvbnN0IG1lc3NhZ2UgPSB0aHJlYWQubWVzc2FnZXNba11cblx0XHRcdFx0XHRpZiAobWVzc2FnZS5yb2xlICE9PSAnY2hlY2twb2ludCcpIGNvbnRpbnVlXG5cdFx0XHRcdFx0Y29uc3QgcmVzID0gdGhpcy5fZ2V0Q2hlY2twb2ludEluZm8obWVzc2FnZSwgZnNQYXRoLCB7IGluY2x1ZGVVc2VyTW9kaWZpZWRDaGFuZ2VzOiBqdW1wVG9Vc2VyTW9kaWZpZWQgfSlcblx0XHRcdFx0XHRpZiAoIXJlcykgY29udGludWVcblx0XHRcdFx0XHRjb25zdCB7IHZvaWRGaWxlU25hcHNob3QgfSA9IHJlc1xuXHRcdFx0XHRcdGlmICghdm9pZEZpbGVTbmFwc2hvdCkgY29udGludWVcblx0XHRcdFx0XHR0aGlzLl9lZGl0Q29kZVNlcnZpY2UucmVzdG9yZVZvaWRGaWxlU25hcHNob3QoVVJJLmZpbGUoZnNQYXRoKSwgdm9pZEZpbGVTbmFwc2hvdClcblx0XHRcdFx0XHRicmVha1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0LypcbmlmIHJlZG9pbmdcblxuQSBCIEMgRCBFIEYgRyBIIEkgSlxuICB4IHggeCB4IHggICB4ICAgICB4XG4gIHwgfCB8IHwgfCAgIHwgeCB4IHhcbi0teC18LXwtfC14LS0teC18LXwtLS0gICAgIDwtLSBmcm9tXG5cdHwgfCB8IHwgeCAgIHhcblx0fCB8IHggeCB8XG5cdHwgfCAgIHwgfFxuLS0tLXgtfC0tLXgteC0tLS0tfC0tLSAgICAgPC0tIHRvXG5cdCAgeCAgICAgICAgICAgeFxuXG5cbldlIG5lZWQgdG8gYXBwbHkgbGF0ZXN0IGNoYW5nZSBmb3IgYW55dGhpbmcgdGhhdCBoYXBwZW5lZCBiZXR3ZWVuIGZyb20rMSBhbmQgdG8uXG5XZSBvbmx5IG5lZWQgdG8gZG8gaXQgZm9yIGZpbGVzIHRoYXQgd2VyZSBlZGl0ZWQgc2luY2UgYGZyb21gLCBpZSBmaWxlcyBiZXR3ZWVuIGZyb20rMS4uLnRvLlxuKi9cblx0XHRpZiAodG9JZHggPiBmcm9tSWR4KSB7XG5cdFx0XHRjb25zdCB7IGxhc3RJZHhPZlVSSSB9ID0gdGhpcy5fZ2V0Q2hlY2twb2ludHNCZXR3ZWVuKHsgdGhyZWFkSWQsIGxvSWR4OiBmcm9tSWR4ICsgMSwgaGlJZHg6IHRvSWR4IH0pXG5cdFx0XHRmb3IgKGNvbnN0IGZzUGF0aCBpbiBsYXN0SWR4T2ZVUkkpIHtcblx0XHRcdFx0Ly8gYXBwbHkgbG93ZXN0IGRvd24gY29udGVudCBmb3IgZWFjaCB1cmlcblx0XHRcdFx0Zm9yIChsZXQgayA9IHRvSWR4OyBrID49IGZyb21JZHggKyAxOyBrIC09IDEpIHtcblx0XHRcdFx0XHRjb25zdCBtZXNzYWdlID0gdGhyZWFkLm1lc3NhZ2VzW2tdXG5cdFx0XHRcdFx0aWYgKG1lc3NhZ2Uucm9sZSAhPT0gJ2NoZWNrcG9pbnQnKSBjb250aW51ZVxuXHRcdFx0XHRcdGNvbnN0IHJlcyA9IHRoaXMuX2dldENoZWNrcG9pbnRJbmZvKG1lc3NhZ2UsIGZzUGF0aCwgeyBpbmNsdWRlVXNlck1vZGlmaWVkQ2hhbmdlczoganVtcFRvVXNlck1vZGlmaWVkIH0pXG5cdFx0XHRcdFx0aWYgKCFyZXMpIGNvbnRpbnVlXG5cdFx0XHRcdFx0Y29uc3QgeyB2b2lkRmlsZVNuYXBzaG90IH0gPSByZXNcblx0XHRcdFx0XHRpZiAoIXZvaWRGaWxlU25hcHNob3QpIGNvbnRpbnVlXG5cdFx0XHRcdFx0dGhpcy5fZWRpdENvZGVTZXJ2aWNlLnJlc3RvcmVWb2lkRmlsZVNuYXBzaG90KFVSSS5maWxlKGZzUGF0aCksIHZvaWRGaWxlU25hcHNob3QpXG5cdFx0XHRcdFx0YnJlYWtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHRoaXMuX3NldFRocmVhZFN0YXRlKHRocmVhZElkLCB7IGN1cnJDaGVja3BvaW50SWR4OiB0b0lkeCB9KVxuXHR9XG5cblxuXHRwcml2YXRlIF93cmFwUnVuQWdlbnRUb05vdGlmeShwOiBQcm9taXNlPHZvaWQ+LCB0aHJlYWRJZDogc3RyaW5nKSB7XG5cdFx0Y29uc3Qgbm90aWZ5ID0gKHsgZXJyb3IgfTogeyBlcnJvcjogc3RyaW5nIHwgbnVsbCB9KSA9PiB7XG5cdFx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0XHRpZiAoIXRocmVhZCkgcmV0dXJuXG5cdFx0XHRjb25zdCB1c2VyTXNnID0gZmluZExhc3QodGhyZWFkLm1lc3NhZ2VzLCBtID0+IG0ucm9sZSA9PT0gJ3VzZXInKVxuXHRcdFx0aWYgKCF1c2VyTXNnKSByZXR1cm5cblx0XHRcdGlmICh1c2VyTXNnLnJvbGUgIT09ICd1c2VyJykgcmV0dXJuXG5cdFx0XHRjb25zdCBtZXNzYWdlQ29udGVudCA9IHRydW5jYXRlKHVzZXJNc2cuZGlzcGxheUNvbnRlbnQsIDUwLCAnLi4uJylcblxuXHRcdFx0dGhpcy5fbm90aWZpY2F0aW9uU2VydmljZS5ub3RpZnkoe1xuXHRcdFx0XHRzZXZlcml0eTogZXJyb3IgPyBTZXZlcml0eS5XYXJuaW5nIDogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdFx0bWVzc2FnZTogZXJyb3IgPyBgRXJyb3I6ICR7ZXJyb3J9IGAgOiBgQSBuZXcgQ2hhdCByZXN1bHQgaXMgcmVhZHkuYCxcblx0XHRcdFx0c291cmNlOiBtZXNzYWdlQ29udGVudCxcblx0XHRcdFx0c3RpY2t5OiB0cnVlLFxuXHRcdFx0XHRhY3Rpb25zOiB7XG5cdFx0XHRcdFx0cHJpbWFyeTogW3tcblx0XHRcdFx0XHRcdGlkOiAndm9pZC5nb1RvQ2hhdCcsXG5cdFx0XHRcdFx0XHRlbmFibGVkOiB0cnVlLFxuXHRcdFx0XHRcdFx0bGFiZWw6IGBKdW1wIHRvIENoYXRgLFxuXHRcdFx0XHRcdFx0dG9vbHRpcDogJycsXG5cdFx0XHRcdFx0XHRjbGFzczogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdFx0cnVuOiAoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdHRoaXMuc3dpdGNoVG9UaHJlYWQodGhyZWFkSWQpXG5cdFx0XHRcdFx0XHRcdC8vIHNjcm9sbCB0byBib3R0b21cblx0XHRcdFx0XHRcdFx0dGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXT8uc3RhdGUubW91bnRlZEluZm8/LndoZW5Nb3VudGVkLnRoZW4obSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0bS5zY3JvbGxUb0JvdHRvbSgpXG5cdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fV1cblx0XHRcdFx0fSxcblx0XHRcdH0pXG5cdFx0fVxuXG5cdFx0cC50aGVuKCgpID0+IHtcblx0XHRcdGlmICh0aHJlYWRJZCAhPT0gdGhpcy5zdGF0ZS5jdXJyZW50VGhyZWFkSWQpIG5vdGlmeSh7IGVycm9yOiBudWxsIH0pXG5cdFx0fSkuY2F0Y2goKGUpID0+IHtcblx0XHRcdGlmICh0aHJlYWRJZCAhPT0gdGhpcy5zdGF0ZS5jdXJyZW50VGhyZWFkSWQpIG5vdGlmeSh7IGVycm9yOiBnZXRFcnJvck1lc3NhZ2UoZSkgfSlcblx0XHRcdHRocm93IGVcblx0XHR9KVxuXHR9XG5cblx0ZGlzbWlzc1N0cmVhbUVycm9yKHRocmVhZElkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXRTdHJlYW1TdGF0ZSh0aHJlYWRJZCwgdW5kZWZpbmVkKVxuXHR9XG5cblxuXHRwcml2YXRlIGFzeW5jIF9hZGRVc2VyTWVzc2FnZUFuZFN0cmVhbVJlc3BvbnNlKHsgdXNlck1lc3NhZ2UsIF9jaGF0U2VsZWN0aW9ucywgdGhyZWFkSWQgfTogeyB1c2VyTWVzc2FnZTogc3RyaW5nLCBfY2hhdFNlbGVjdGlvbnM/OiBTdGFnaW5nU2VsZWN0aW9uSXRlbVtdLCB0aHJlYWRJZDogc3RyaW5nIH0pIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cblx0XHQvLyBpbnRlcnJ1cHQgZXhpc3Rpbmcgc3RyZWFtXG5cdFx0aWYgKHRoaXMuc3RyZWFtU3RhdGVbdGhyZWFkSWRdPy5pc1J1bm5pbmcpIHtcblx0XHRcdGF3YWl0IHRoaXMuYWJvcnRSdW5uaW5nKHRocmVhZElkKVxuXHRcdH1cblxuXHRcdC8vIGFkZCBkdW1teSBiZWZvcmUgdGhpcyBtZXNzYWdlIHRvIGtlZXAgY2hlY2twb2ludCBiZWZvcmUgdXNlciBtZXNzYWdlIGlkZWEgY29uc2lzdGVudFxuXHRcdGlmICh0aHJlYWQubWVzc2FnZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHR0aGlzLl9hZGRVc2VyQ2hlY2twb2ludCh7IHRocmVhZElkIH0pXG5cdFx0fVxuXG5cblx0XHQvLyBhZGQgdXNlcidzIG1lc3NhZ2UgdG8gY2hhdCBoaXN0b3J5XG5cdFx0Y29uc3QgaW5zdHJ1Y3Rpb25zID0gdXNlck1lc3NhZ2Vcblx0XHRjb25zdCBjdXJyU2VsbnM6IFN0YWdpbmdTZWxlY3Rpb25JdGVtW10gPSBfY2hhdFNlbGVjdGlvbnMgPz8gdGhyZWFkLnN0YXRlLnN0YWdpbmdTZWxlY3Rpb25zXG5cblx0XHRjb25zdCB1c2VyTWVzc2FnZUNvbnRlbnQgPSBhd2FpdCBjaGF0X3VzZXJNZXNzYWdlQ29udGVudChpbnN0cnVjdGlvbnMsIGN1cnJTZWxucywgeyBkaXJlY3RvcnlTdHJTZXJ2aWNlOiB0aGlzLl9kaXJlY3RvcnlTdHJpbmdTZXJ2aWNlLCBmaWxlU2VydmljZTogdGhpcy5fZmlsZVNlcnZpY2UgfSkgLy8gdXNlciBtZXNzYWdlICsgbmFtZXMgb2YgZmlsZXMgKE5PVCBjb250ZW50KVxuXHRcdGNvbnN0IHVzZXJIaXN0b3J5RWx0OiBDaGF0TWVzc2FnZSA9IHsgcm9sZTogJ3VzZXInLCBjb250ZW50OiB1c2VyTWVzc2FnZUNvbnRlbnQsIGRpc3BsYXlDb250ZW50OiBpbnN0cnVjdGlvbnMsIHNlbGVjdGlvbnM6IGN1cnJTZWxucywgc3RhdGU6IGRlZmF1bHRNZXNzYWdlU3RhdGUgfVxuXHRcdHRoaXMuX2FkZE1lc3NhZ2VUb1RocmVhZCh0aHJlYWRJZCwgdXNlckhpc3RvcnlFbHQpXG5cblx0XHR0aGlzLl9zZXRUaHJlYWRTdGF0ZSh0aHJlYWRJZCwgeyBjdXJyQ2hlY2twb2ludElkeDogbnVsbCB9KSAvLyBubyBsb25nZXIgYXQgYSBjaGVja3BvaW50IGJlY2F1c2Ugc3RhcnRlZCBzdHJlYW1pbmdcblxuXHRcdHRoaXMuX3dyYXBSdW5BZ2VudFRvTm90aWZ5KFxuXHRcdFx0dGhpcy5fcnVuQ2hhdEFnZW50KHsgdGhyZWFkSWQsIC4uLnRoaXMuX2N1cnJlbnRNb2RlbFNlbGVjdGlvblByb3BzKCksIH0pLFxuXHRcdFx0dGhyZWFkSWQsXG5cdFx0KVxuXG5cdFx0Ly8gc2Nyb2xsIHRvIGJvdHRvbVxuXHRcdHRoaXMuc3RhdGUuYWxsVGhyZWFkc1t0aHJlYWRJZF0/LnN0YXRlLm1vdW50ZWRJbmZvPy53aGVuTW91bnRlZC50aGVuKG0gPT4ge1xuXHRcdFx0bS5zY3JvbGxUb0JvdHRvbSgpXG5cdFx0fSlcblx0fVxuXG5cblx0YXN5bmMgYWRkVXNlck1lc3NhZ2VBbmRTdHJlYW1SZXNwb25zZSh7IHVzZXJNZXNzYWdlLCBfY2hhdFNlbGVjdGlvbnMsIHRocmVhZElkIH06IHsgdXNlck1lc3NhZ2U6IHN0cmluZywgX2NoYXRTZWxlY3Rpb25zPzogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXSwgdGhyZWFkSWQ6IHN0cmluZyB9KSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXTtcblx0XHRpZiAoIXRocmVhZCkgcmV0dXJuXG5cblx0XHQvLyBpZiB0aGVyZSdzIGEgY3VycmVudCBjaGVja3BvaW50LCBkZWxldGUgYWxsIG1lc3NhZ2VzIGFmdGVyIGl0XG5cdFx0aWYgKHRocmVhZC5zdGF0ZS5jdXJyQ2hlY2twb2ludElkeCAhPT0gbnVsbCkge1xuXHRcdFx0Y29uc3QgY2hlY2twb2ludElkeCA9IHRocmVhZC5zdGF0ZS5jdXJyQ2hlY2twb2ludElkeDtcblx0XHRcdGNvbnN0IG5ld01lc3NhZ2VzID0gdGhyZWFkLm1lc3NhZ2VzLnNsaWNlKDAsIGNoZWNrcG9pbnRJZHggKyAxKTtcblxuXHRcdFx0Ly8gVXBkYXRlIHRoZSB0aHJlYWQgd2l0aCB0cnVuY2F0ZWQgbWVzc2FnZXNcblx0XHRcdGNvbnN0IG5ld1RocmVhZHMgPSB7XG5cdFx0XHRcdC4uLnRoaXMuc3RhdGUuYWxsVGhyZWFkcyxcblx0XHRcdFx0W3RocmVhZElkXToge1xuXHRcdFx0XHRcdC4uLnRocmVhZCxcblx0XHRcdFx0XHRsYXN0TW9kaWZpZWQ6IG5ldyBEYXRlKCkudG9JU09TdHJpbmcoKSxcblx0XHRcdFx0XHRtZXNzYWdlczogbmV3TWVzc2FnZXMsXG5cdFx0XHRcdH1cblx0XHRcdH07XG5cdFx0XHR0aGlzLl9zdG9yZUFsbFRocmVhZHMobmV3VGhyZWFkcyk7XG5cdFx0XHR0aGlzLl9zZXRTdGF0ZSh7IGFsbFRocmVhZHM6IG5ld1RocmVhZHMgfSk7XG5cdFx0fVxuXG5cdFx0Ly8gTm93IGNhbGwgdGhlIG9yaWdpbmFsIG1ldGhvZCB0byBhZGQgdGhlIHVzZXIgbWVzc2FnZSBhbmQgc3RyZWFtIHRoZSByZXNwb25zZVxuXHRcdGF3YWl0IHRoaXMuX2FkZFVzZXJNZXNzYWdlQW5kU3RyZWFtUmVzcG9uc2UoeyB1c2VyTWVzc2FnZSwgX2NoYXRTZWxlY3Rpb25zLCB0aHJlYWRJZCB9KTtcblxuXHR9XG5cblx0ZWRpdFVzZXJNZXNzYWdlQW5kU3RyZWFtUmVzcG9uc2U6IElDaGF0VGhyZWFkU2VydmljZVsnZWRpdFVzZXJNZXNzYWdlQW5kU3RyZWFtUmVzcG9uc2UnXSA9IGFzeW5jICh7IHVzZXJNZXNzYWdlLCBtZXNzYWdlSWR4LCB0aHJlYWRJZCB9KSA9PiB7XG5cblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiAvLyBzaG91bGQgbmV2ZXIgaGFwcGVuXG5cblx0XHRpZiAodGhyZWFkLm1lc3NhZ2VzPy5bbWVzc2FnZUlkeF0/LnJvbGUgIT09ICd1c2VyJykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBFcnJvcjogZWRpdGluZyBhIG1lc3NhZ2Ugd2l0aCByb2xlICE9PSd1c2VyJ2ApXG5cdFx0fVxuXG5cdFx0Ly8gZ2V0IHByZXYgYW5kIGN1cnIgc2VsZWN0aW9ucyBiZWZvcmUgY2xlYXJpbmcgdGhlIG1lc3NhZ2Vcblx0XHRjb25zdCBjdXJyU2VsbnMgPSB0aHJlYWQubWVzc2FnZXNbbWVzc2FnZUlkeF0uc3RhdGUuc3RhZ2luZ1NlbGVjdGlvbnMgfHwgW10gLy8gc3RhZ2luZyBzZWxlY3Rpb25zIGZvciB0aGUgZWRpdGVkIG1lc3NhZ2VcblxuXHRcdC8vIGNsZWFyIG1lc3NhZ2VzIHVwIHRvIHRoZSBpbmRleFxuXHRcdGNvbnN0IHNsaWNlZE1lc3NhZ2VzID0gdGhyZWFkLm1lc3NhZ2VzLnNsaWNlKDAsIG1lc3NhZ2VJZHgpXG5cdFx0dGhpcy5fc2V0U3RhdGUoe1xuXHRcdFx0YWxsVGhyZWFkczoge1xuXHRcdFx0XHQuLi50aGlzLnN0YXRlLmFsbFRocmVhZHMsXG5cdFx0XHRcdFt0aHJlYWQuaWRdOiB7XG5cdFx0XHRcdFx0Li4udGhyZWFkLFxuXHRcdFx0XHRcdG1lc3NhZ2VzOiBzbGljZWRNZXNzYWdlc1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fSlcblxuXHRcdC8vIHJlLWFkZCB0aGUgbWVzc2FnZSBhbmQgc3RyZWFtIGl0XG5cdFx0dGhpcy5fYWRkVXNlck1lc3NhZ2VBbmRTdHJlYW1SZXNwb25zZSh7IHVzZXJNZXNzYWdlLCBfY2hhdFNlbGVjdGlvbnM6IGN1cnJTZWxucywgdGhyZWFkSWQgfSlcblx0fVxuXG5cdC8vIC0tLS0tLS0tLS0gdGhlIHJlc3QgLS0tLS0tLS0tLVxuXG5cdHByaXZhdGUgX2dldEFsbFNlZW5GaWxlVVJJcyh0aHJlYWRJZDogc3RyaW5nKSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghdGhyZWFkKSByZXR1cm4gW11cblxuXHRcdGNvbnN0IGZzUGF0aHNTZXQgPSBuZXcgU2V0PHN0cmluZz4oKVxuXHRcdGNvbnN0IHVyaXM6IFVSSVtdID0gW11cblx0XHRjb25zdCBhZGRVUkkgPSAodXJpOiBVUkkpID0+IHtcblx0XHRcdGlmICghZnNQYXRoc1NldC5oYXModXJpLmZzUGF0aCkpIHVyaXMucHVzaCh1cmkpXG5cdFx0XHRmc1BhdGhzU2V0LmFkZCh1cmkuZnNQYXRoKVxuXHRcdFx0dXJpcy5wdXNoKHVyaSlcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IG0gb2YgdGhyZWFkLm1lc3NhZ2VzKSB7XG5cdFx0XHQvLyBVUklzIG9mIHVzZXIgc2VsZWN0aW9uc1xuXHRcdFx0aWYgKG0ucm9sZSA9PT0gJ3VzZXInKSB7XG5cdFx0XHRcdGZvciAoY29uc3Qgc2VsIG9mIG0uc2VsZWN0aW9ucyA/PyBbXSkge1xuXHRcdFx0XHRcdGFkZFVSSShzZWwudXJpKVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0XHQvLyBVUklzIG9mIGZpbGVzIHRoYXQgaGF2ZSBiZWVuIHJlYWRcblx0XHRcdGVsc2UgaWYgKG0ucm9sZSA9PT0gJ3Rvb2wnICYmIG0udHlwZSA9PT0gJ3N1Y2Nlc3MnICYmIG0ubmFtZSA9PT0gJ3JlYWRfZmlsZScpIHtcblx0XHRcdFx0Y29uc3QgcGFyYW1zID0gbS5wYXJhbXMgYXMgQnVpbHRpblRvb2xDYWxsUGFyYW1zWydyZWFkX2ZpbGUnXVxuXHRcdFx0XHRhZGRVUkkocGFyYW1zLnVyaSlcblx0XHRcdH1cblx0XHR9XG5cdFx0cmV0dXJuIHVyaXNcblx0fVxuXG5cblxuXHRnZXRSZWxhdGl2ZVN0ciA9ICh1cmk6IFVSSSkgPT4ge1xuXHRcdGNvbnN0IGlzSW5zaWRlID0gdGhpcy5fd29ya3NwYWNlQ29udGV4dFNlcnZpY2UuaXNJbnNpZGVXb3Jrc3BhY2UodXJpKVxuXHRcdGlmIChpc0luc2lkZSkge1xuXHRcdFx0Y29uc3QgZiA9IHRoaXMuX3dvcmtzcGFjZUNvbnRleHRTZXJ2aWNlLmdldFdvcmtzcGFjZSgpLmZvbGRlcnMuZmluZChmID0+IHVyaS5mc1BhdGguc3RhcnRzV2l0aChmLnVyaS5mc1BhdGgpKVxuXHRcdFx0aWYgKGYpIHsgcmV0dXJuIHVyaS5mc1BhdGgucmVwbGFjZShmLnVyaS5mc1BhdGgsICcnKSB9XG5cdFx0XHRlbHNlIHsgcmV0dXJuIHVuZGVmaW5lZCB9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZFxuXHRcdH1cblx0fVxuXG5cblx0Ly8gZ2V0cyB0aGUgbG9jYXRpb24gb2YgY29kZXNwYW4gbGluayBzbyB0aGUgdXNlciBjYW4gY2xpY2sgb24gaXRcblx0Z2VuZXJhdGVDb2Rlc3Bhbkxpbms6IElDaGF0VGhyZWFkU2VydmljZVsnZ2VuZXJhdGVDb2Rlc3BhbkxpbmsnXSA9IGFzeW5jICh7IGNvZGVzcGFuU3RyOiBfY29kZXNwYW5TdHIsIHRocmVhZElkIH0pID0+IHtcblxuXHRcdC8vIHByb2Nlc3MgY29kZXNwYW4gdG8gdW5kZXJzdGFuZCB3aGF0IHdlIGFyZSBzZWFyY2hpbmcgZm9yXG5cdFx0Ly8gVE9ETyBhY2NvdW50IGZvciBtb3JlIGNvbXBsaWNhdGVkIHBhdHRlcm5zIGVnIGBJVGV4dEVkaXRvclNlcnZpY2Uub3BlbkVkaXRvcigpYFxuXHRcdGNvbnN0IGZ1bmN0aW9uT3JNZXRob2RQYXR0ZXJuID0gL15bYS16QS1aXyRdW2EtekEtWjAtOV8kXSokLzsgLy8gYGZVbkN0MTBuX25hbWVgXG5cdFx0Y29uc3QgZnVuY3Rpb25QYXJlbnNQYXR0ZXJuID0gL14oW15cXHMoXSspXFwoW14pXSpcXCkkLzsgLy8gYGZ1bmN0aW9uTmFtZSggYXJncyApYFxuXG5cdFx0bGV0IHRhcmdldCA9IF9jb2Rlc3BhblN0ciAvLyB0aGUgc3RyaW5nIHRvIHNlYXJjaCBmb3Jcblx0XHRsZXQgY29kZXNwYW5UeXBlOiAnZmlsZS1vci1mb2xkZXInIHwgJ2Z1bmN0aW9uLW9yLWNsYXNzJ1xuXHRcdGlmICh0YXJnZXQuaW5jbHVkZXMoJy4nKSB8fCB0YXJnZXQuaW5jbHVkZXMoJy8nKSkge1xuXG5cdFx0XHRjb2Rlc3BhblR5cGUgPSAnZmlsZS1vci1mb2xkZXInXG5cdFx0XHR0YXJnZXQgPSBfY29kZXNwYW5TdHJcblxuXHRcdH0gZWxzZSBpZiAoZnVuY3Rpb25Pck1ldGhvZFBhdHRlcm4udGVzdCh0YXJnZXQpKSB7XG5cblx0XHRcdGNvZGVzcGFuVHlwZSA9ICdmdW5jdGlvbi1vci1jbGFzcydcblx0XHRcdHRhcmdldCA9IF9jb2Rlc3BhblN0clxuXG5cdFx0fSBlbHNlIGlmIChmdW5jdGlvblBhcmVuc1BhdHRlcm4udGVzdCh0YXJnZXQpKSB7XG5cdFx0XHRjb25zdCBtYXRjaCA9IHRhcmdldC5tYXRjaChmdW5jdGlvblBhcmVuc1BhdHRlcm4pXG5cdFx0XHRpZiAobWF0Y2ggJiYgbWF0Y2hbMV0pIHtcblxuXHRcdFx0XHRjb2Rlc3BhblR5cGUgPSAnZnVuY3Rpb24tb3ItY2xhc3MnXG5cdFx0XHRcdHRhcmdldCA9IG1hdGNoWzFdXG5cblx0XHRcdH1cblx0XHRcdGVsc2UgeyByZXR1cm4gbnVsbCB9XG5cdFx0fVxuXHRcdGVsc2Uge1xuXHRcdFx0cmV0dXJuIG51bGxcblx0XHR9XG5cblx0XHQvLyBnZXQgaGlzdG9yeSBvZiBhbGwgQUkgYW5kIHVzZXIgYWRkZWQgZmlsZXMgaW4gY29udmVyc2F0aW9uICsgc3RvcmUgaW4gcmV2ZXJzZSBvcmRlciAoTVJVKVxuXHRcdGNvbnN0IHByZXZVcmlzID0gdGhpcy5fZ2V0QWxsU2VlbkZpbGVVUklzKHRocmVhZElkKS5yZXZlcnNlKClcblxuXHRcdGlmIChjb2Rlc3BhblR5cGUgPT09ICdmaWxlLW9yLWZvbGRlcicpIHtcblx0XHRcdGNvbnN0IGRvZXNVcmlNYXRjaFRhcmdldCA9ICh1cmk6IFVSSSkgPT4gdXJpLnBhdGguaW5jbHVkZXModGFyZ2V0KVxuXG5cdFx0XHQvLyBjaGVjayBpZiBhbnkgcHJldkZpbGVzIGFyZSB0aGUgYHRhcmdldGBcblx0XHRcdGZvciAoY29uc3QgW2lkeCwgdXJpXSBvZiBwcmV2VXJpcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0aWYgKGRvZXNVcmlNYXRjaFRhcmdldCh1cmkpKSB7XG5cblx0XHRcdFx0XHQvLyBzaG9ydGVuIGl0XG5cblx0XHRcdFx0XHQvLyBUT0RPIG1ha2UgdGhpcyBsb2dpYyBtb3JlIGdlbmVyYWxcblx0XHRcdFx0XHRjb25zdCBwcmV2VXJpU3RycyA9IHByZXZVcmlzLm1hcCh1cmkgPT4gdXJpLmZzUGF0aClcblx0XHRcdFx0XHRjb25zdCBzaG9ydGVuZWRVcmlTdHJzID0gc2hvcnRlbihwcmV2VXJpU3Rycylcblx0XHRcdFx0XHRsZXQgZGlzcGxheVRleHQgPSBzaG9ydGVuZWRVcmlTdHJzW2lkeF1cblx0XHRcdFx0XHRjb25zdCBlbGxpcHNpc0lkeCA9IGRpc3BsYXlUZXh0Lmxhc3RJbmRleE9mKCdcdTIwMjYvJyk7XG5cdFx0XHRcdFx0aWYgKGVsbGlwc2lzSWR4ID49IDApIHtcblx0XHRcdFx0XHRcdGRpc3BsYXlUZXh0ID0gZGlzcGxheVRleHQuc2xpY2UoZWxsaXBzaXNJZHggKyAyKVxuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHJldHVybiB7IHVyaSwgZGlzcGxheVRleHQgfVxuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdC8vIGVsc2Ugc2VhcmNoIGNvZGViYXNlIGZvciBgdGFyZ2V0YFxuXHRcdFx0bGV0IHVyaXM6IFVSSVtdID0gW11cblx0XHRcdHRyeSB7XG5cdFx0XHRcdGNvbnN0IHsgcmVzdWx0IH0gPSBhd2FpdCB0aGlzLl90b29sc1NlcnZpY2UuY2FsbFRvb2xbJ3NlYXJjaF9wYXRobmFtZXNfb25seSddKHsgcXVlcnk6IHRhcmdldCwgaW5jbHVkZVBhdHRlcm46IG51bGwsIHBhZ2VOdW1iZXI6IDAgfSlcblx0XHRcdFx0Y29uc3QgeyB1cmlzOiB1cmlzXyB9ID0gYXdhaXQgcmVzdWx0XG5cdFx0XHRcdHVyaXMgPSB1cmlzX1xuXHRcdFx0fSBjYXRjaCAoZSkge1xuXHRcdFx0XHRyZXR1cm4gbnVsbFxuXHRcdFx0fVxuXG5cdFx0XHRmb3IgKGNvbnN0IFtpZHgsIHVyaV0gb2YgdXJpcy5lbnRyaWVzKCkpIHtcblx0XHRcdFx0aWYgKGRvZXNVcmlNYXRjaFRhcmdldCh1cmkpKSB7XG5cblx0XHRcdFx0XHQvLyBUT0RPIG1ha2UgdGhpcyBsb2dpYyBtb3JlIGdlbmVyYWxcblx0XHRcdFx0XHRjb25zdCBwcmV2VXJpU3RycyA9IHByZXZVcmlzLm1hcCh1cmkgPT4gdXJpLmZzUGF0aClcblx0XHRcdFx0XHRjb25zdCBzaG9ydGVuZWRVcmlTdHJzID0gc2hvcnRlbihwcmV2VXJpU3Rycylcblx0XHRcdFx0XHRsZXQgZGlzcGxheVRleHQgPSBzaG9ydGVuZWRVcmlTdHJzW2lkeF1cblx0XHRcdFx0XHRjb25zdCBlbGxpcHNpc0lkeCA9IGRpc3BsYXlUZXh0Lmxhc3RJbmRleE9mKCdcdTIwMjYvJyk7XG5cdFx0XHRcdFx0aWYgKGVsbGlwc2lzSWR4ID49IDApIHtcblx0XHRcdFx0XHRcdGRpc3BsYXlUZXh0ID0gZGlzcGxheVRleHQuc2xpY2UoZWxsaXBzaXNJZHggKyAyKVxuXHRcdFx0XHRcdH1cblxuXG5cdFx0XHRcdFx0cmV0dXJuIHsgdXJpLCBkaXNwbGF5VGV4dCB9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdH1cblxuXG5cdFx0aWYgKGNvZGVzcGFuVHlwZSA9PT0gJ2Z1bmN0aW9uLW9yLWNsYXNzJykge1xuXG5cblx0XHRcdC8vIGNoZWNrIGFsbCBwcmV2VXJpcyBmb3IgdGhlIHRhcmdldFxuXHRcdFx0Zm9yIChjb25zdCB1cmkgb2YgcHJldlVyaXMpIHtcblxuXHRcdFx0XHRjb25zdCBtb2RlbFJlZiA9IGF3YWl0IHRoaXMuX3ZvaWRNb2RlbFNlcnZpY2UuZ2V0TW9kZWxTYWZlKHVyaSlcblx0XHRcdFx0Y29uc3QgeyBtb2RlbCB9ID0gbW9kZWxSZWZcblx0XHRcdFx0aWYgKCFtb2RlbCkgY29udGludWVcblxuXHRcdFx0XHRjb25zdCBtYXRjaGVzID0gbW9kZWwuZmluZE1hdGNoZXMoXG5cdFx0XHRcdFx0dGFyZ2V0LFxuXHRcdFx0XHRcdGZhbHNlLCAvLyBzZWFyY2hPbmx5RWRpdGFibGVSYW5nZVxuXHRcdFx0XHRcdGZhbHNlLCAvLyBpc1JlZ2V4XG5cdFx0XHRcdFx0dHJ1ZSwgIC8vIG1hdGNoQ2FzZVxuXHRcdFx0XHRcdG51bGwsIC8vJyAnLCAgIC8vIHdvcmRTZXBhcmF0b3JzXG5cdFx0XHRcdFx0dHJ1ZSAgIC8vIGNhcHR1cmVNYXRjaGVzXG5cdFx0XHRcdCk7XG5cblx0XHRcdFx0Y29uc3QgZmlyc3RUaHJlZSA9IG1hdGNoZXMuc2xpY2UoMCwgMyk7XG5cblx0XHRcdFx0Ly8gdGFrZSBmaXJzdCAzIG9jY3VyZW5jZXMsIGF0dGVtcHQgdG8gZ290byBkZWZpbml0aW9uIG9uIHRoZW1cblx0XHRcdFx0Zm9yIChjb25zdCBtYXRjaCBvZiBmaXJzdFRocmVlKSB7XG5cdFx0XHRcdFx0Y29uc3QgcG9zaXRpb24gPSBuZXcgUG9zaXRpb24obWF0Y2gucmFuZ2Uuc3RhcnRMaW5lTnVtYmVyLCBtYXRjaC5yYW5nZS5zdGFydENvbHVtbik7XG5cdFx0XHRcdFx0Y29uc3QgZGVmaW5pdGlvblByb3ZpZGVycyA9IHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRlZmluaXRpb25Qcm92aWRlci5vcmRlcmVkKG1vZGVsKTtcblxuXHRcdFx0XHRcdGZvciAoY29uc3QgcHJvdmlkZXIgb2YgZGVmaW5pdGlvblByb3ZpZGVycykge1xuXG5cdFx0XHRcdFx0XHRjb25zdCBfZGVmaW5pdGlvbnMgPSBhd2FpdCBwcm92aWRlci5wcm92aWRlRGVmaW5pdGlvbihtb2RlbCwgcG9zaXRpb24sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXG5cdFx0XHRcdFx0XHRpZiAoIV9kZWZpbml0aW9ucykgY29udGludWU7XG5cblx0XHRcdFx0XHRcdGNvbnN0IGRlZmluaXRpb25zID0gQXJyYXkuaXNBcnJheShfZGVmaW5pdGlvbnMpID8gX2RlZmluaXRpb25zIDogW19kZWZpbml0aW9uc107XG5cblx0XHRcdFx0XHRcdGZvciAoY29uc3QgZGVmaW5pdGlvbiBvZiBkZWZpbml0aW9ucykge1xuXG5cdFx0XHRcdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0XHRcdFx0dXJpOiBkZWZpbml0aW9uLnVyaSxcblx0XHRcdFx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdFx0XHRcdHN0YXJ0TGluZU51bWJlcjogZGVmaW5pdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIsXG5cdFx0XHRcdFx0XHRcdFx0XHRzdGFydENvbHVtbjogZGVmaW5pdGlvbi5yYW5nZS5zdGFydENvbHVtbixcblx0XHRcdFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGRlZmluaXRpb24ucmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0XHRcdGVuZENvbHVtbjogZGVmaW5pdGlvbi5yYW5nZS5lbmRDb2x1bW4sXG5cdFx0XHRcdFx0XHRcdFx0fSxcblx0XHRcdFx0XHRcdFx0XHRkaXNwbGF5VGV4dDogX2NvZGVzcGFuU3RyLFxuXHRcdFx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0XHRcdC8vIGNvbnN0IGRlZk1vZGVsUmVmID0gYXdhaXQgdGhpcy5fdGV4dE1vZGVsU2VydmljZS5jcmVhdGVNb2RlbFJlZmVyZW5jZShkZWZpbml0aW9uLnVyaSk7XG5cdFx0XHRcdFx0XHRcdC8vIGNvbnN0IGRlZk1vZGVsID0gZGVmTW9kZWxSZWYub2JqZWN0LnRleHRFZGl0b3JNb2RlbDtcblxuXHRcdFx0XHRcdFx0XHQvLyB0cnkge1xuXHRcdFx0XHRcdFx0XHQvLyBcdGNvbnN0IHN5bWJvbFByb3ZpZGVycyA9IHRoaXMuX2xhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLmRvY3VtZW50U3ltYm9sUHJvdmlkZXIub3JkZXJlZChkZWZNb2RlbCk7XG5cblx0XHRcdFx0XHRcdFx0Ly8gXHRmb3IgKGNvbnN0IHN5bWJvbFByb3ZpZGVyIG9mIHN5bWJvbFByb3ZpZGVycykge1xuXHRcdFx0XHRcdFx0XHQvLyBcdFx0Y29uc3Qgc3ltYm9scyA9IGF3YWl0IHN5bWJvbFByb3ZpZGVyLnByb3ZpZGVEb2N1bWVudFN5bWJvbHMoXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdGRlZk1vZGVsLFxuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHRDYW5jZWxsYXRpb25Ub2tlbi5Ob25lXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHQpO1xuXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRpZiAoc3ltYm9scykge1xuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHRjb25zdCBzeW1ib2wgPSBzeW1ib2xzLmZpbmQocyA9PiB7XG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdFx0Y29uc3Qgc3ltYm9sUmFuZ2UgPSBzLnJhbmdlO1xuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHRcdHJldHVybiBzeW1ib2xSYW5nZS5zdGFydExpbmVOdW1iZXIgPD0gZGVmaW5pdGlvbi5yYW5nZS5zdGFydExpbmVOdW1iZXIgJiZcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdHN5bWJvbFJhbmdlLmVuZExpbmVOdW1iZXIgPj0gZGVmaW5pdGlvbi5yYW5nZS5lbmRMaW5lTnVtYmVyICYmXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdFx0XHQoc3ltYm9sUmFuZ2Uuc3RhcnRMaW5lTnVtYmVyICE9PSBkZWZpbml0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlciB8fCBzeW1ib2xSYW5nZS5zdGFydENvbHVtbiA8PSBkZWZpbml0aW9uLnJhbmdlLnN0YXJ0Q29sdW1uKSAmJlxuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHRcdFx0KHN5bWJvbFJhbmdlLmVuZExpbmVOdW1iZXIgIT09IGRlZmluaXRpb24ucmFuZ2UuZW5kTGluZU51bWJlciB8fCBzeW1ib2xSYW5nZS5lbmRDb2x1bW4gPj0gZGVmaW5pdGlvbi5yYW5nZS5lbmRDb2x1bW4pO1xuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHR9KTtcblxuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHQvLyBpZiB3ZSBnb3QgdG8gYSBjbGFzcy9mdW5jdGlvbiBnZXQgdGhlIGZ1bGwgcmFuZ2UgYW5kIHJldHVyblxuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHRpZiAoc3ltYm9sPy5raW5kID09PSBTeW1ib2xLaW5kLkZ1bmN0aW9uIHx8IHN5bWJvbD8ua2luZCA9PT0gU3ltYm9sS2luZC5NZXRob2QgfHwgc3ltYm9sPy5raW5kID09PSBTeW1ib2xLaW5kLkNsYXNzKSB7XG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdHVyaTogZGVmaW5pdGlvbi51cmksXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdFx0XHRzZWxlY3Rpb246IHtcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdFx0c3RhcnRMaW5lTnVtYmVyOiBkZWZpbml0aW9uLnJhbmdlLnN0YXJ0TGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdFx0c3RhcnRDb2x1bW46IGRlZmluaXRpb24ucmFuZ2Uuc3RhcnRDb2x1bW4sXG5cdFx0XHRcdFx0XHRcdC8vIFx0XHRcdFx0XHRcdGVuZExpbmVOdW1iZXI6IGRlZmluaXRpb24ucmFuZ2UuZW5kTGluZU51bWJlcixcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdFx0ZW5kQ29sdW1uOiBkZWZpbml0aW9uLnJhbmdlLmVuZENvbHVtbixcblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0Ly8gXHRcdFx0XHR9O1xuXHRcdFx0XHRcdFx0XHQvLyBcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdC8vIFx0XHR9XG5cdFx0XHRcdFx0XHRcdC8vIFx0fVxuXHRcdFx0XHRcdFx0XHQvLyB9IGZpbmFsbHkge1xuXHRcdFx0XHRcdFx0XHQvLyBcdGRlZk1vZGVsUmVmLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHRcdFx0Ly8gfVxuXHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHQvLyB1bmxpa2UgYWJvdmUgZG8gbm90IHNlYXJjaCBjb2RlYmFzZSAoZG9lc250IG1ha2Ugc2Vuc2UpXG5cblx0XHR9XG5cblx0XHRyZXR1cm4gbnVsbFxuXG5cdH1cblxuXHRnZXRDb2Rlc3BhbkxpbmsoeyBjb2Rlc3BhblN0ciwgbWVzc2FnZUlkeCwgdGhyZWFkSWQgfTogeyBjb2Rlc3BhblN0cjogc3RyaW5nLCBtZXNzYWdlSWR4OiBudW1iZXIsIHRocmVhZElkOiBzdHJpbmcgfSk6IENvZGVzcGFuTG9jYXRpb25MaW5rIHwgdW5kZWZpbmVkIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVybiB1bmRlZmluZWQ7XG5cblx0XHRjb25zdCBsaW5rcyA9IHRocmVhZC5zdGF0ZS5saW5rc09mTWVzc2FnZUlkeD8uW21lc3NhZ2VJZHhdXG5cdFx0aWYgKCFsaW5rcykgcmV0dXJuIHVuZGVmaW5lZDtcblxuXHRcdGNvbnN0IGxpbmsgPSBsaW5rc1tjb2Rlc3BhblN0cl1cblxuXHRcdHJldHVybiBsaW5rXG5cdH1cblxuXHRhc3luYyBhZGRDb2Rlc3BhbkxpbmsoeyBuZXdMaW5rVGV4dCwgbmV3TGlua0xvY2F0aW9uLCBtZXNzYWdlSWR4LCB0aHJlYWRJZCB9OiB7IG5ld0xpbmtUZXh0OiBzdHJpbmcsIG5ld0xpbmtMb2NhdGlvbjogQ29kZXNwYW5Mb2NhdGlvbkxpbmssIG1lc3NhZ2VJZHg6IG51bWJlciwgdGhyZWFkSWQ6IHN0cmluZyB9KSB7XG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghdGhyZWFkKSByZXR1cm5cblxuXHRcdHRoaXMuX3NldFN0YXRlKHtcblxuXHRcdFx0YWxsVGhyZWFkczoge1xuXHRcdFx0XHQuLi50aGlzLnN0YXRlLmFsbFRocmVhZHMsXG5cdFx0XHRcdFt0aHJlYWRJZF06IHtcblx0XHRcdFx0XHQuLi50aHJlYWQsXG5cdFx0XHRcdFx0c3RhdGU6IHtcblx0XHRcdFx0XHRcdC4uLnRocmVhZC5zdGF0ZSxcblx0XHRcdFx0XHRcdGxpbmtzT2ZNZXNzYWdlSWR4OiB7XG5cdFx0XHRcdFx0XHRcdC4uLnRocmVhZC5zdGF0ZS5saW5rc09mTWVzc2FnZUlkeCxcblx0XHRcdFx0XHRcdFx0W21lc3NhZ2VJZHhdOiB7XG5cdFx0XHRcdFx0XHRcdFx0Li4udGhyZWFkLnN0YXRlLmxpbmtzT2ZNZXNzYWdlSWR4Py5bbWVzc2FnZUlkeF0sXG5cdFx0XHRcdFx0XHRcdFx0W25ld0xpbmtUZXh0XTogbmV3TGlua0xvY2F0aW9uXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pXG5cdH1cblxuXG5cdGdldEN1cnJlbnRUaHJlYWQoKTogVGhyZWFkVHlwZSB7XG5cdFx0Y29uc3Qgc3RhdGUgPSB0aGlzLnN0YXRlXG5cdFx0Y29uc3QgdGhyZWFkID0gc3RhdGUuYWxsVGhyZWFkc1tzdGF0ZS5jdXJyZW50VGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHRocm93IG5ldyBFcnJvcihgQ3VycmVudCB0aHJlYWQgc2hvdWxkIG5ldmVyIGJlIHVuZGVmaW5lZGApXG5cdFx0cmV0dXJuIHRocmVhZFxuXHR9XG5cblx0Z2V0Q3VycmVudEZvY3VzZWRNZXNzYWdlSWR4KCkge1xuXHRcdGNvbnN0IHRocmVhZCA9IHRoaXMuZ2V0Q3VycmVudFRocmVhZCgpXG5cblx0XHQvLyBnZXQgdGhlIGZvY3VzZWRNZXNzYWdlSWR4XG5cdFx0Y29uc3QgZm9jdXNlZE1lc3NhZ2VJZHggPSB0aHJlYWQuc3RhdGUuZm9jdXNlZE1lc3NhZ2VJZHhcblx0XHRpZiAoZm9jdXNlZE1lc3NhZ2VJZHggPT09IHVuZGVmaW5lZCkgcmV0dXJuO1xuXG5cdFx0Ly8gY2hlY2sgdGhhdCB0aGUgbWVzc2FnZSBpcyBhY3R1YWxseSBiZWluZyBlZGl0ZWRcblx0XHRjb25zdCBmb2N1c2VkTWVzc2FnZSA9IHRocmVhZC5tZXNzYWdlc1tmb2N1c2VkTWVzc2FnZUlkeF1cblx0XHRpZiAoZm9jdXNlZE1lc3NhZ2Uucm9sZSAhPT0gJ3VzZXInKSByZXR1cm47XG5cdFx0aWYgKCFmb2N1c2VkTWVzc2FnZS5zdGF0ZSkgcmV0dXJuO1xuXG5cdFx0cmV0dXJuIGZvY3VzZWRNZXNzYWdlSWR4XG5cdH1cblxuXHRpc0N1cnJlbnRseUZvY3VzaW5nTWVzc2FnZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5nZXRDdXJyZW50Rm9jdXNlZE1lc3NhZ2VJZHgoKSAhPT0gdW5kZWZpbmVkXG5cdH1cblxuXHRzd2l0Y2hUb1RocmVhZCh0aHJlYWRJZDogc3RyaW5nKSB7XG5cdFx0dGhpcy5fc2V0U3RhdGUoeyBjdXJyZW50VGhyZWFkSWQ6IHRocmVhZElkIH0pXG5cdH1cblxuXG5cdG9wZW5OZXdUaHJlYWQoKSB7XG5cdFx0Ly8gaWYgYSB0aHJlYWQgd2l0aCAwIG1lc3NhZ2VzIGFscmVhZHkgZXhpc3RzLCBzd2l0Y2ggdG8gaXRcblx0XHRjb25zdCB7IGFsbFRocmVhZHM6IGN1cnJlbnRUaHJlYWRzIH0gPSB0aGlzLnN0YXRlXG5cdFx0Zm9yIChjb25zdCB0aHJlYWRJZCBpbiBjdXJyZW50VGhyZWFkcykge1xuXHRcdFx0aWYgKGN1cnJlbnRUaHJlYWRzW3RocmVhZElkXSEubWVzc2FnZXMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRcdC8vIHN3aXRjaCB0byB0aGUgZXhpc3RpbmcgZW1wdHkgdGhyZWFkIGFuZCBleGl0XG5cdFx0XHRcdHRoaXMuc3dpdGNoVG9UaHJlYWQodGhyZWFkSWQpXG5cdFx0XHRcdHJldHVyblxuXHRcdFx0fVxuXHRcdH1cblx0XHQvLyBvdGhlcndpc2UsIHN0YXJ0IGEgbmV3IHRocmVhZFxuXHRcdGNvbnN0IG5ld1RocmVhZCA9IG5ld1RocmVhZE9iamVjdCgpXG5cblx0XHQvLyB1cGRhdGUgc3RhdGVcblx0XHRjb25zdCBuZXdUaHJlYWRzOiBDaGF0VGhyZWFkcyA9IHtcblx0XHRcdC4uLmN1cnJlbnRUaHJlYWRzLFxuXHRcdFx0W25ld1RocmVhZC5pZF06IG5ld1RocmVhZFxuXHRcdH1cblx0XHR0aGlzLl9zdG9yZUFsbFRocmVhZHMobmV3VGhyZWFkcylcblx0XHR0aGlzLl9zZXRTdGF0ZSh7IGFsbFRocmVhZHM6IG5ld1RocmVhZHMsIGN1cnJlbnRUaHJlYWRJZDogbmV3VGhyZWFkLmlkIH0pXG5cdH1cblxuXG5cdGRlbGV0ZVRocmVhZCh0aHJlYWRJZDogc3RyaW5nKTogdm9pZCB7XG5cdFx0Y29uc3QgeyBhbGxUaHJlYWRzOiBjdXJyZW50VGhyZWFkcyB9ID0gdGhpcy5zdGF0ZVxuXG5cdFx0Ly8gZGVsZXRlIHRoZSB0aHJlYWRcblx0XHRjb25zdCBuZXdUaHJlYWRzID0geyAuLi5jdXJyZW50VGhyZWFkcyB9O1xuXHRcdGRlbGV0ZSBuZXdUaHJlYWRzW3RocmVhZElkXTtcblxuXHRcdC8vIHN0b3JlIHRoZSB1cGRhdGVkIHRocmVhZHNcblx0XHR0aGlzLl9zdG9yZUFsbFRocmVhZHMobmV3VGhyZWFkcyk7XG5cdFx0dGhpcy5fc2V0U3RhdGUoeyAuLi50aGlzLnN0YXRlLCBhbGxUaHJlYWRzOiBuZXdUaHJlYWRzIH0pXG5cdH1cblxuXHRkdXBsaWNhdGVUaHJlYWQodGhyZWFkSWQ6IHN0cmluZykge1xuXHRcdGNvbnN0IHsgYWxsVGhyZWFkczogY3VycmVudFRocmVhZHMgfSA9IHRoaXMuc3RhdGVcblx0XHRjb25zdCB0aHJlYWRUb0R1cGxpY2F0ZSA9IGN1cnJlbnRUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghdGhyZWFkVG9EdXBsaWNhdGUpIHJldHVyblxuXHRcdGNvbnN0IG5ld1RocmVhZCA9IHtcblx0XHRcdC4uLmRlZXBDbG9uZSh0aHJlYWRUb0R1cGxpY2F0ZSksXG5cdFx0XHRpZDogZ2VuZXJhdGVVdWlkKCksXG5cdFx0fVxuXHRcdGNvbnN0IG5ld1RocmVhZHMgPSB7XG5cdFx0XHQuLi5jdXJyZW50VGhyZWFkcyxcblx0XHRcdFtuZXdUaHJlYWQuaWRdOiBuZXdUaHJlYWQsXG5cdFx0fVxuXHRcdHRoaXMuX3N0b3JlQWxsVGhyZWFkcyhuZXdUaHJlYWRzKVxuXHRcdHRoaXMuX3NldFN0YXRlKHsgYWxsVGhyZWFkczogbmV3VGhyZWFkcyB9KVxuXHR9XG5cblxuXHRwcml2YXRlIF9hZGRNZXNzYWdlVG9UaHJlYWQodGhyZWFkSWQ6IHN0cmluZywgbWVzc2FnZTogQ2hhdE1lc3NhZ2UpIHtcblx0XHRjb25zdCB7IGFsbFRocmVhZHMgfSA9IHRoaXMuc3RhdGVcblx0XHRjb25zdCBvbGRUaHJlYWQgPSBhbGxUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghb2xkVGhyZWFkKSByZXR1cm4gLy8gc2hvdWxkIG5ldmVyIGhhcHBlblxuXHRcdC8vIHVwZGF0ZSBzdGF0ZSBhbmQgc3RvcmUgaXRcblx0XHRjb25zdCBuZXdUaHJlYWRzID0ge1xuXHRcdFx0Li4uYWxsVGhyZWFkcyxcblx0XHRcdFtvbGRUaHJlYWQuaWRdOiB7XG5cdFx0XHRcdC4uLm9sZFRocmVhZCxcblx0XHRcdFx0bGFzdE1vZGlmaWVkOiBuZXcgRGF0ZSgpLnRvSVNPU3RyaW5nKCksXG5cdFx0XHRcdG1lc3NhZ2VzOiBbXG5cdFx0XHRcdFx0Li4ub2xkVGhyZWFkLm1lc3NhZ2VzLFxuXHRcdFx0XHRcdG1lc3NhZ2Vcblx0XHRcdFx0XSxcblx0XHRcdH1cblx0XHR9XG5cdFx0dGhpcy5fc3RvcmVBbGxUaHJlYWRzKG5ld1RocmVhZHMpXG5cdFx0dGhpcy5fc2V0U3RhdGUoeyBhbGxUaHJlYWRzOiBuZXdUaHJlYWRzIH0pIC8vIHRoZSBjdXJyZW50IHRocmVhZCBqdXN0IGNoYW5nZWQgKGl0IGhhZCBhIG1lc3NhZ2UgYWRkZWQgdG8gaXQpXG5cdH1cblxuXHQvLyBzZXRzIHRoZSBjdXJyZW50bHkgc2VsZWN0ZWQgbWVzc2FnZSAobXVzdCBiZSB1bmRlZmluZWQgaWYgbm8gbWVzc2FnZSBpcyBzZWxlY3RlZClcblx0c2V0Q3VycmVudGx5Rm9jdXNlZE1lc3NhZ2VJZHgobWVzc2FnZUlkeDogbnVtYmVyIHwgdW5kZWZpbmVkKSB7XG5cblx0XHRjb25zdCB0aHJlYWRJZCA9IHRoaXMuc3RhdGUuY3VycmVudFRocmVhZElkXG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghdGhyZWFkKSByZXR1cm5cblxuXHRcdHRoaXMuX3NldFN0YXRlKHtcblx0XHRcdGFsbFRocmVhZHM6IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZS5hbGxUaHJlYWRzLFxuXHRcdFx0XHRbdGhyZWFkSWRdOiB7XG5cdFx0XHRcdFx0Li4udGhyZWFkLFxuXHRcdFx0XHRcdHN0YXRlOiB7XG5cdFx0XHRcdFx0XHQuLi50aHJlYWQuc3RhdGUsXG5cdFx0XHRcdFx0XHRmb2N1c2VkTWVzc2FnZUlkeDogbWVzc2FnZUlkeCxcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9KVxuXG5cdFx0Ly8gLy8gd2hlbiBjaGFuZ2UgZm9jdXNlZCBtZXNzYWdlIGlkeCwganVtcCAtIGRvIG5vdCBqdW1wIGJhY2sgd2hlbiBjbGljayBlZGl0LCB0b28gY29uZnVzaW5nLlxuXHRcdC8vIGlmIChtZXNzYWdlSWR4ICE9PSB1bmRlZmluZWQpXG5cdFx0Ly8gXHR0aGlzLmp1bXBUb0NoZWNrcG9pbnRCZWZvcmVNZXNzYWdlSWR4KHsgdGhyZWFkSWQsIG1lc3NhZ2VJZHgsIGp1bXBUb1VzZXJNb2RpZmllZDogdHJ1ZSB9KVxuXHR9XG5cblxuXHRhZGROZXdTdGFnaW5nU2VsZWN0aW9uKG5ld1NlbGVjdGlvbjogU3RhZ2luZ1NlbGVjdGlvbkl0ZW0pOiB2b2lkIHtcblxuXHRcdGNvbnN0IGZvY3VzZWRNZXNzYWdlSWR4ID0gdGhpcy5nZXRDdXJyZW50Rm9jdXNlZE1lc3NhZ2VJZHgoKVxuXG5cdFx0Ly8gc2V0IHRoZSBzZWxlY3Rpb25zIHRvIHRoZSBwcm9wZXIgdmFsdWVcblx0XHRsZXQgc2VsZWN0aW9uczogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXSA9IFtdXG5cdFx0bGV0IHNldFNlbGVjdGlvbnMgPSAoczogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXSkgPT4geyB9XG5cblx0XHRpZiAoZm9jdXNlZE1lc3NhZ2VJZHggPT09IHVuZGVmaW5lZCkge1xuXHRcdFx0c2VsZWN0aW9ucyA9IHRoaXMuZ2V0Q3VycmVudFRocmVhZFN0YXRlKCkuc3RhZ2luZ1NlbGVjdGlvbnNcblx0XHRcdHNldFNlbGVjdGlvbnMgPSAoczogU3RhZ2luZ1NlbGVjdGlvbkl0ZW1bXSkgPT4gdGhpcy5zZXRDdXJyZW50VGhyZWFkU3RhdGUoeyBzdGFnaW5nU2VsZWN0aW9uczogcyB9KVxuXHRcdH0gZWxzZSB7XG5cdFx0XHRzZWxlY3Rpb25zID0gdGhpcy5nZXRDdXJyZW50TWVzc2FnZVN0YXRlKGZvY3VzZWRNZXNzYWdlSWR4KS5zdGFnaW5nU2VsZWN0aW9uc1xuXHRcdFx0c2V0U2VsZWN0aW9ucyA9IChzKSA9PiB0aGlzLnNldEN1cnJlbnRNZXNzYWdlU3RhdGUoZm9jdXNlZE1lc3NhZ2VJZHgsIHsgc3RhZ2luZ1NlbGVjdGlvbnM6IHMgfSlcblx0XHR9XG5cblx0XHQvLyBpZiBtYXRjaGVzIHdpdGggZXhpc3Rpbmcgc2VsZWN0aW9uLCBvdmVyd3JpdGUgKHNpbmNlIHRleHQgbWF5IGNoYW5nZSlcblx0XHRjb25zdCBpZHggPSBmaW5kU3RhZ2luZ1NlbGVjdGlvbkluZGV4KHNlbGVjdGlvbnMsIG5ld1NlbGVjdGlvbilcblx0XHRpZiAoaWR4ICE9PSBudWxsICYmIGlkeCAhPT0gLTEpIHtcblx0XHRcdHNldFNlbGVjdGlvbnMoW1xuXHRcdFx0XHQuLi5zZWxlY3Rpb25zIS5zbGljZSgwLCBpZHgpLFxuXHRcdFx0XHRuZXdTZWxlY3Rpb24sXG5cdFx0XHRcdC4uLnNlbGVjdGlvbnMhLnNsaWNlKGlkeCArIDEsIEluZmluaXR5KVxuXHRcdFx0XSlcblx0XHR9XG5cdFx0Ly8gaWYgbm8gbWF0Y2gsIGFkZCBpdFxuXHRcdGVsc2Uge1xuXHRcdFx0c2V0U2VsZWN0aW9ucyhbLi4uKHNlbGVjdGlvbnMgPz8gW10pLCBuZXdTZWxlY3Rpb25dKVxuXHRcdH1cblx0fVxuXG5cblx0Ly8gUG9wcyB0aGUgc3RhZ2luZyBzZWxlY3Rpb25zIGZyb20gdGhlIGN1cnJlbnQgdGhyZWFkJ3Mgc3RhdGVcblx0cG9wU3RhZ2luZ1NlbGVjdGlvbnMobnVtUG9wczogbnVtYmVyKTogdm9pZCB7XG5cblx0XHRudW1Qb3BzID0gbnVtUG9wcyA/PyAxO1xuXG5cdFx0Y29uc3QgZm9jdXNlZE1lc3NhZ2VJZHggPSB0aGlzLmdldEN1cnJlbnRGb2N1c2VkTWVzc2FnZUlkeCgpXG5cblx0XHQvLyBzZXQgdGhlIHNlbGVjdGlvbnMgdG8gdGhlIHByb3BlciB2YWx1ZVxuXHRcdGxldCBzZWxlY3Rpb25zOiBTdGFnaW5nU2VsZWN0aW9uSXRlbVtdID0gW11cblx0XHRsZXQgc2V0U2VsZWN0aW9ucyA9IChzOiBTdGFnaW5nU2VsZWN0aW9uSXRlbVtdKSA9PiB7IH1cblxuXHRcdGlmIChmb2N1c2VkTWVzc2FnZUlkeCA9PT0gdW5kZWZpbmVkKSB7XG5cdFx0XHRzZWxlY3Rpb25zID0gdGhpcy5nZXRDdXJyZW50VGhyZWFkU3RhdGUoKS5zdGFnaW5nU2VsZWN0aW9uc1xuXHRcdFx0c2V0U2VsZWN0aW9ucyA9IChzOiBTdGFnaW5nU2VsZWN0aW9uSXRlbVtdKSA9PiB0aGlzLnNldEN1cnJlbnRUaHJlYWRTdGF0ZSh7IHN0YWdpbmdTZWxlY3Rpb25zOiBzIH0pXG5cdFx0fSBlbHNlIHtcblx0XHRcdHNlbGVjdGlvbnMgPSB0aGlzLmdldEN1cnJlbnRNZXNzYWdlU3RhdGUoZm9jdXNlZE1lc3NhZ2VJZHgpLnN0YWdpbmdTZWxlY3Rpb25zXG5cdFx0XHRzZXRTZWxlY3Rpb25zID0gKHMpID0+IHRoaXMuc2V0Q3VycmVudE1lc3NhZ2VTdGF0ZShmb2N1c2VkTWVzc2FnZUlkeCwgeyBzdGFnaW5nU2VsZWN0aW9uczogcyB9KVxuXHRcdH1cblxuXHRcdHNldFNlbGVjdGlvbnMoW1xuXHRcdFx0Li4uc2VsZWN0aW9ucy5zbGljZSgwLCBzZWxlY3Rpb25zLmxlbmd0aCAtIG51bVBvcHMpXG5cdFx0XSlcblxuXHR9XG5cblx0Ly8gc2V0IG1lc3NhZ2Uuc3RhdGVcblx0cHJpdmF0ZSBfc2V0Q3VycmVudE1lc3NhZ2VTdGF0ZShzdGF0ZTogUGFydGlhbDxVc2VyTWVzc2FnZVN0YXRlPiwgbWVzc2FnZUlkeDogbnVtYmVyKTogdm9pZCB7XG5cblx0XHRjb25zdCB0aHJlYWRJZCA9IHRoaXMuc3RhdGUuY3VycmVudFRocmVhZElkXG5cdFx0Y29uc3QgdGhyZWFkID0gdGhpcy5zdGF0ZS5hbGxUaHJlYWRzW3RocmVhZElkXVxuXHRcdGlmICghdGhyZWFkKSByZXR1cm5cblxuXHRcdHRoaXMuX3NldFN0YXRlKHtcblx0XHRcdGFsbFRocmVhZHM6IHtcblx0XHRcdFx0Li4udGhpcy5zdGF0ZS5hbGxUaHJlYWRzLFxuXHRcdFx0XHRbdGhyZWFkSWRdOiB7XG5cdFx0XHRcdFx0Li4udGhyZWFkLFxuXHRcdFx0XHRcdG1lc3NhZ2VzOiB0aHJlYWQubWVzc2FnZXMubWFwKChtLCBpKSA9PlxuXHRcdFx0XHRcdFx0aSA9PT0gbWVzc2FnZUlkeCAmJiBtLnJvbGUgPT09ICd1c2VyJyA/IHtcblx0XHRcdFx0XHRcdFx0Li4ubSxcblx0XHRcdFx0XHRcdFx0c3RhdGU6IHtcblx0XHRcdFx0XHRcdFx0XHQuLi5tLnN0YXRlLFxuXHRcdFx0XHRcdFx0XHRcdC4uLnN0YXRlXG5cdFx0XHRcdFx0XHRcdH0sXG5cdFx0XHRcdFx0XHR9IDogbVxuXHRcdFx0XHRcdClcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pXG5cblx0fVxuXG5cdC8vIHNldCB0aHJlYWQuc3RhdGVcblx0cHJpdmF0ZSBfc2V0VGhyZWFkU3RhdGUodGhyZWFkSWQ6IHN0cmluZywgc3RhdGU6IFBhcnRpYWw8VGhyZWFkVHlwZVsnc3RhdGUnXT4sIGRvTm90UmVmcmVzaE1vdW50SW5mbz86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRjb25zdCB0aHJlYWQgPSB0aGlzLnN0YXRlLmFsbFRocmVhZHNbdGhyZWFkSWRdXG5cdFx0aWYgKCF0aHJlYWQpIHJldHVyblxuXG5cdFx0dGhpcy5fc2V0U3RhdGUoe1xuXHRcdFx0YWxsVGhyZWFkczoge1xuXHRcdFx0XHQuLi50aGlzLnN0YXRlLmFsbFRocmVhZHMsXG5cdFx0XHRcdFt0aHJlYWQuaWRdOiB7XG5cdFx0XHRcdFx0Li4udGhyZWFkLFxuXHRcdFx0XHRcdHN0YXRlOiB7XG5cdFx0XHRcdFx0XHQuLi50aHJlYWQuc3RhdGUsXG5cdFx0XHRcdFx0XHQuLi5zdGF0ZVxuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0sIGRvTm90UmVmcmVzaE1vdW50SW5mbylcblxuXHR9XG5cblxuXHQvLyBjbG9zZUN1cnJlbnRTdGFnaW5nU2VsZWN0aW9uc0luVGhyZWFkID0gKCkgPT4ge1xuXHQvLyBcdGNvbnN0IGN1cnJUaHJlYWQgPSB0aGlzLmdldEN1cnJlbnRUaHJlYWRTdGF0ZSgpXG5cblx0Ly8gXHQvLyBjbG9zZSBhbGwgc3RhZ2luZ1NlbGVjdGlvbnNcblx0Ly8gXHRjb25zdCBjbG9zZWRTdGFnaW5nU2VsZWN0aW9ucyA9IGN1cnJUaHJlYWQuc3RhZ2luZ1NlbGVjdGlvbnMubWFwKHMgPT4gKHsgLi4ucywgc3RhdGU6IHsgLi4ucy5zdGF0ZSwgaXNPcGVuZWQ6IGZhbHNlIH0gfSkpXG5cblx0Ly8gXHRjb25zdCBuZXdUaHJlYWQgPSBjdXJyVGhyZWFkXG5cdC8vIFx0bmV3VGhyZWFkLnN0YWdpbmdTZWxlY3Rpb25zID0gY2xvc2VkU3RhZ2luZ1NlbGVjdGlvbnNcblxuXHQvLyBcdHRoaXMuc2V0Q3VycmVudFRocmVhZFN0YXRlKG5ld1RocmVhZClcblxuXHQvLyB9XG5cblx0Ly8gY2xvc2VDdXJyZW50U3RhZ2luZ1NlbGVjdGlvbnNJbk1lc3NhZ2U6IElDaGF0VGhyZWFkU2VydmljZVsnY2xvc2VDdXJyZW50U3RhZ2luZ1NlbGVjdGlvbnNJbk1lc3NhZ2UnXSA9ICh7IG1lc3NhZ2VJZHggfSkgPT4ge1xuXHQvLyBcdGNvbnN0IGN1cnJNZXNzYWdlID0gdGhpcy5nZXRDdXJyZW50TWVzc2FnZVN0YXRlKG1lc3NhZ2VJZHgpXG5cblx0Ly8gXHQvLyBjbG9zZSBhbGwgc3RhZ2luZ1NlbGVjdGlvbnNcblx0Ly8gXHRjb25zdCBjbG9zZWRTdGFnaW5nU2VsZWN0aW9ucyA9IGN1cnJNZXNzYWdlLnN0YWdpbmdTZWxlY3Rpb25zLm1hcChzID0+ICh7IC4uLnMsIHN0YXRlOiB7IC4uLnMuc3RhdGUsIGlzT3BlbmVkOiBmYWxzZSB9IH0pKVxuXG5cdC8vIFx0Y29uc3QgbmV3TWVzc2FnZSA9IGN1cnJNZXNzYWdlXG5cdC8vIFx0bmV3TWVzc2FnZS5zdGFnaW5nU2VsZWN0aW9ucyA9IGNsb3NlZFN0YWdpbmdTZWxlY3Rpb25zXG5cblx0Ly8gXHR0aGlzLnNldEN1cnJlbnRNZXNzYWdlU3RhdGUobWVzc2FnZUlkeCwgbmV3TWVzc2FnZSlcblxuXHQvLyB9XG5cblxuXG5cdGdldEN1cnJlbnRUaHJlYWRTdGF0ZSA9ICgpID0+IHtcblx0XHRjb25zdCBjdXJyZW50VGhyZWFkID0gdGhpcy5nZXRDdXJyZW50VGhyZWFkKClcblx0XHRyZXR1cm4gY3VycmVudFRocmVhZC5zdGF0ZVxuXHR9XG5cdHNldEN1cnJlbnRUaHJlYWRTdGF0ZSA9IChuZXdTdGF0ZTogUGFydGlhbDxUaHJlYWRUeXBlWydzdGF0ZSddPikgPT4ge1xuXHRcdHRoaXMuX3NldFRocmVhZFN0YXRlKHRoaXMuc3RhdGUuY3VycmVudFRocmVhZElkLCBuZXdTdGF0ZSlcblx0fVxuXG5cdC8vIGdldHMgYHN0YWdpbmdgIGFuZCBgc2V0U3RhZ2luZ2Agb2YgdGhlIGN1cnJlbnRseSBmb2N1c2VkIGVsZW1lbnQsIGdpdmVuIHRoZSBpbmRleCBvZiB0aGUgY3VycmVudGx5IHNlbGVjdGVkIG1lc3NhZ2UgKG9yIHVuZGVmaW5lZCBpZiBubyBtZXNzYWdlIGlzIHNlbGVjdGVkKVxuXG5cdGdldEN1cnJlbnRNZXNzYWdlU3RhdGUobWVzc2FnZUlkeDogbnVtYmVyKTogVXNlck1lc3NhZ2VTdGF0ZSB7XG5cdFx0Y29uc3QgY3Vyck1lc3NhZ2UgPSB0aGlzLmdldEN1cnJlbnRUaHJlYWQoKT8ubWVzc2FnZXM/LlttZXNzYWdlSWR4XVxuXHRcdGlmICghY3Vyck1lc3NhZ2UgfHwgY3Vyck1lc3NhZ2Uucm9sZSAhPT0gJ3VzZXInKSByZXR1cm4gZGVmYXVsdE1lc3NhZ2VTdGF0ZVxuXHRcdHJldHVybiBjdXJyTWVzc2FnZS5zdGF0ZVxuXHR9XG5cdHNldEN1cnJlbnRNZXNzYWdlU3RhdGUobWVzc2FnZUlkeDogbnVtYmVyLCBuZXdTdGF0ZTogUGFydGlhbDxVc2VyTWVzc2FnZVN0YXRlPikge1xuXHRcdGNvbnN0IGN1cnJNZXNzYWdlID0gdGhpcy5nZXRDdXJyZW50VGhyZWFkKCk/Lm1lc3NhZ2VzPy5bbWVzc2FnZUlkeF1cblx0XHRpZiAoIWN1cnJNZXNzYWdlIHx8IGN1cnJNZXNzYWdlLnJvbGUgIT09ICd1c2VyJykgcmV0dXJuXG5cdFx0dGhpcy5fc2V0Q3VycmVudE1lc3NhZ2VTdGF0ZShuZXdTdGF0ZSwgbWVzc2FnZUlkeClcblx0fVxuXG5cblxufVxuXG5yZWdpc3RlclNpbmdsZXRvbihJQ2hhdFRocmVhZFNlcnZpY2UsIENoYXRUaHJlYWRTZXJ2aWNlLCBJbnN0YW50aWF0aW9uVHlwZS5FYWdlcik7XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsa0JBQWtCO0FBQzNCLFNBQVMsbUJBQW1CLHlCQUF5QjtBQUNyRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLGlCQUFpQixjQUFjLHFCQUFxQjtBQUU3RCxTQUFTLFdBQVc7QUFDcEIsU0FBUyxlQUFzQjtBQUMvQixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLHlCQUF5QiwwQkFBMEI7QUFDNUQsU0FBNkIsdUJBQXlEO0FBQ3RGLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMscUNBQWtHO0FBQzNHLFNBQVMscUJBQXFCO0FBQzlCLFNBQVMseUJBQXlCO0FBQ2xDLFNBQVMsZ0NBQWdDO0FBRXpDLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQVMsdUJBQXVCO0FBQ2hDLFNBQVMsZUFBZTtBQUN4QixTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLFVBQVUsbUJBQW1CO0FBQ3RDLFNBQVMsd0JBQXdCO0FBRWpDLFNBQVMsc0JBQXNCLGdCQUFnQjtBQUMvQyxTQUFTLGdCQUFnQjtBQUN6QixTQUFTLDBCQUEwQjtBQUNuQyxTQUFTLG1DQUFtQztBQUM1QyxTQUFTLGVBQWU7QUFDeEIs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
