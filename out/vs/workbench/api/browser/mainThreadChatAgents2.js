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
import { DeferredPromise } from "../../../base/common/async.js";
import { Emitter } from "../../../base/common/event.js";
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import { revive } from "../../../base/common/marshalling.js";
import { escapeRegExpCharacters } from "../../../base/common/strings.js";
import { ThemeIcon } from "../../../base/common/themables.js";
import { URI } from "../../../base/common/uri.js";
import { Range } from "../../../editor/common/core/range.js";
import { getWordAtText } from "../../../editor/common/core/wordHelper.js";
import { CompletionItemKind } from "../../../editor/common/languages.js";
import { ILanguageFeaturesService } from "../../../editor/common/services/languageFeatures.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { IInstantiationService } from "../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../platform/log/common/log.js";
import { IChatWidgetService } from "../../contrib/chat/browser/chat.js";
import { ChatInputPart } from "../../contrib/chat/browser/chatInputPart.js";
import { AddDynamicVariableAction } from "../../contrib/chat/browser/contrib/chatDynamicVariables.js";
import { IChatAgentService } from "../../contrib/chat/common/chatAgents.js";
import { IChatEditingService } from "../../contrib/chat/common/chatEditingService.js";
import { ChatRequestAgentPart } from "../../contrib/chat/common/chatParserTypes.js";
import { ChatRequestParser } from "../../contrib/chat/common/chatRequestParser.js";
import { IChatService } from "../../contrib/chat/common/chatService.js";
import { ChatAgentLocation } from "../../contrib/chat/common/constants.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IExtensionService } from "../../services/extensions/common/extensions.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { NotebookDto } from "./mainThreadNotebookDto.js";
class MainThreadChatTask {
  constructor(content) {
    this.content = content;
    this.kind = "progressTask";
    this.deferred = new DeferredPromise();
    this._onDidAddProgress = new Emitter();
    this.progress = [];
  }
  get onDidAddProgress() {
    return this._onDidAddProgress.event;
  }
  task() {
    return this.deferred.p;
  }
  isSettled() {
    return this.deferred.isSettled;
  }
  complete(v) {
    this.deferred.complete(v);
  }
  add(progress) {
    this.progress.push(progress);
    this._onDidAddProgress.fire(progress);
  }
}
let MainThreadChatAgents2 = class extends Disposable {
  constructor(extHostContext, _chatAgentService, _chatService, _chatEditingService, _languageFeaturesService, _chatWidgetService, _instantiationService, _logService, _extensionService) {
    super();
    this._chatAgentService = _chatAgentService;
    this._chatService = _chatService;
    this._chatEditingService = _chatEditingService;
    this._languageFeaturesService = _languageFeaturesService;
    this._chatWidgetService = _chatWidgetService;
    this._instantiationService = _instantiationService;
    this._logService = _logService;
    this._extensionService = _extensionService;
    this._agents = this._register(new DisposableMap());
    this._agentCompletionProviders = this._register(new DisposableMap());
    this._agentIdsToCompletionProviders = this._register(new DisposableMap());
    this._chatParticipantDetectionProviders = this._register(new DisposableMap());
    this._chatRelatedFilesProviders = this._register(new DisposableMap());
    this._pendingProgress = /* @__PURE__ */ new Map();
    this._responsePartHandlePool = 0;
    this._activeTasks = /* @__PURE__ */ new Map();
    this._unresolvedAnchors = /* @__PURE__ */ new Map();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostChatAgents2);
    this._register(this._chatService.onDidDisposeSession((e) => {
      this._proxy.$releaseSession(e.sessionId);
    }));
    this._register(this._chatService.onDidPerformUserAction((e) => {
      if (typeof e.agentId === "string") {
        for (const [handle, agent] of this._agents) {
          if (agent.id === e.agentId) {
            if (e.action.kind === "vote") {
              this._proxy.$acceptFeedback(handle, e.result ?? {}, e.action);
            } else {
              this._proxy.$acceptAction(handle, e.result || {}, e);
            }
            break;
          }
        }
      }
    }));
  }
  $unregisterAgent(handle) {
    this._agents.deleteAndDispose(handle);
  }
  $transferActiveChatSession(toWorkspace) {
    const widget = this._chatWidgetService.lastFocusedWidget;
    const sessionId = widget?.viewModel?.model.sessionId;
    if (!sessionId) {
      this._logService.error(`MainThreadChat#$transferActiveChatSession: No active chat session found`);
      return;
    }
    const inputValue = widget?.inputEditor.getValue() ?? "";
    const location = widget.location;
    const mode = widget.input.currentMode;
    this._chatService.transferChatSession({ sessionId, inputValue, location, mode }, URI.revive(toWorkspace));
  }
  async $registerAgent(handle, extension, id, metadata, dynamicProps) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const staticAgentRegistration = this._chatAgentService.getAgent(id, true);
    if (!staticAgentRegistration && !dynamicProps) {
      if (this._chatAgentService.getAgentsByName(id).length) {
        throw new Error(`chatParticipant must be declared with an ID in package.json. The "id" property may be missing! "${id}"`);
      }
      throw new Error(`chatParticipant must be declared in package.json: ${id}`);
    }
    const impl = {
      invoke: async (request, progress, history, token) => {
        this._pendingProgress.set(request.requestId, progress);
        try {
          return await this._proxy.$invokeAgent(handle, request, { history }, token) ?? {};
        } finally {
          this._pendingProgress.delete(request.requestId);
        }
      },
      setRequestPaused: (requestId, isPaused) => {
        this._proxy.$setRequestPaused(handle, requestId, isPaused);
      },
      provideFollowups: async (request, result, history, token) => {
        if (!this._agents.get(handle)?.hasFollowups) {
          return [];
        }
        return this._proxy.$provideFollowups(request, handle, result, { history }, token);
      },
      provideChatTitle: (history, token) => {
        return this._proxy.$provideChatTitle(handle, history, token);
      },
      provideSampleQuestions: (location, token) => {
        return this._proxy.$provideSampleQuestions(handle, location, token);
      }
    };
    let disposable;
    if (!staticAgentRegistration && dynamicProps) {
      const extensionDescription = this._extensionService.extensions.find((e) => ExtensionIdentifier.equals(e.identifier, extension));
      disposable = this._chatAgentService.registerDynamicAgent(
        {
          id,
          name: dynamicProps.name,
          description: dynamicProps.description,
          extensionId: extension,
          extensionDisplayName: extensionDescription?.displayName ?? extension.value,
          extensionPublisherId: extensionDescription?.publisher ?? "",
          publisherDisplayName: dynamicProps.publisherName,
          fullName: dynamicProps.fullName,
          metadata: revive(metadata),
          slashCommands: [],
          disambiguation: [],
          locations: [ChatAgentLocation.Panel]
          // TODO all dynamic participants are panel only?
        },
        impl
      );
    } else {
      disposable = this._chatAgentService.registerAgentImplementation(id, impl);
    }
    this._agents.set(handle, {
      id,
      extensionId: extension,
      dispose: disposable.dispose,
      hasFollowups: metadata.hasFollowups
    });
  }
  async $updateAgent(handle, metadataUpdate) {
    await this._extensionService.whenInstalledExtensionsRegistered();
    const data = this._agents.get(handle);
    if (!data) {
      this._logService.error(`MainThreadChatAgents2#$updateAgent: No agent with handle ${handle} registered`);
      return;
    }
    data.hasFollowups = metadataUpdate.hasFollowups;
    this._chatAgentService.updateAgent(data.id, revive(metadataUpdate));
  }
  async $handleProgressChunk(requestId, progress, responsePartHandle) {
    const revivedProgress = progress.kind === "notebookEdit" ? ChatNotebookEdit.fromChatEdit(revive(progress)) : revive(progress);
    if (revivedProgress.kind === "progressTask") {
      const handle = ++this._responsePartHandlePool;
      const responsePartId = `${requestId}_${handle}`;
      const task = new MainThreadChatTask(revivedProgress.content);
      this._activeTasks.set(responsePartId, task);
      this._pendingProgress.get(requestId)?.(task);
      return handle;
    } else if (responsePartHandle !== void 0) {
      const responsePartId = `${requestId}_${responsePartHandle}`;
      const task = this._activeTasks.get(responsePartId);
      switch (revivedProgress.kind) {
        case "progressTaskResult":
          if (task && revivedProgress.content) {
            task.complete(revivedProgress.content.value);
            this._activeTasks.delete(responsePartId);
          } else {
            task?.complete(void 0);
          }
          return responsePartHandle;
        case "warning":
        case "reference":
          task?.add(revivedProgress);
          return;
      }
    }
    if (revivedProgress.kind === "inlineReference" && revivedProgress.resolveId) {
      if (!this._unresolvedAnchors.has(requestId)) {
        this._unresolvedAnchors.set(requestId, /* @__PURE__ */ new Map());
      }
      this._unresolvedAnchors.get(requestId)?.set(revivedProgress.resolveId, revivedProgress);
    }
    this._pendingProgress.get(requestId)?.(revivedProgress);
  }
  $handleAnchorResolve(requestId, handle, resolveAnchor) {
    const anchor = this._unresolvedAnchors.get(requestId)?.get(handle);
    if (!anchor) {
      return;
    }
    this._unresolvedAnchors.get(requestId)?.delete(handle);
    if (resolveAnchor) {
      const revivedAnchor = revive(resolveAnchor);
      anchor.inlineReference = revivedAnchor.inlineReference;
    }
  }
  $registerAgentCompletionsProvider(handle, id, triggerCharacters) {
    const provide = async (query, token) => {
      const completions = await this._proxy.$invokeCompletionProvider(handle, query, token);
      return completions.map((c) => ({ ...c, icon: c.icon ? ThemeIcon.fromId(c.icon) : void 0 }));
    };
    this._agentIdsToCompletionProviders.set(id, this._chatAgentService.registerAgentCompletionProvider(id, provide));
    this._agentCompletionProviders.set(handle, this._languageFeaturesService.completionProvider.register({ scheme: ChatInputPart.INPUT_SCHEME, hasAccessToAllModels: true }, {
      _debugDisplayName: "chatAgentCompletions:" + handle,
      triggerCharacters,
      provideCompletionItems: async (model, position, _context, token) => {
        const widget = this._chatWidgetService.getWidgetByInputUri(model.uri);
        if (!widget || !widget.viewModel) {
          return;
        }
        const triggerCharsPart = triggerCharacters.map((c) => escapeRegExpCharacters(c)).join("");
        const wordRegex = new RegExp(`[${triggerCharsPart}]\\S*`, "g");
        const query = getWordAtText(position.column, wordRegex, model.getLineContent(position.lineNumber), 0)?.word ?? "";
        if (query && !triggerCharacters.some((c) => query.startsWith(c))) {
          return;
        }
        const parsedRequest = this._instantiationService.createInstance(ChatRequestParser).parseChatRequest(widget.viewModel.sessionId, model.getValue()).parts;
        const agentPart = parsedRequest.find((part) => part instanceof ChatRequestAgentPart);
        const thisAgentId = this._agents.get(handle)?.id;
        if (agentPart?.agent.id !== thisAgentId) {
          return;
        }
        const range = computeCompletionRanges(model, position, wordRegex);
        if (!range) {
          return null;
        }
        const result = await provide(query, token);
        const variableItems = result.map((v) => {
          const insertText = v.insertText ?? (typeof v.label === "string" ? v.label : v.label.label);
          const rangeAfterInsert = new Range(range.insert.startLineNumber, range.insert.startColumn, range.insert.endLineNumber, range.insert.startColumn + insertText.length);
          return {
            label: v.label,
            range,
            insertText: insertText + " ",
            kind: CompletionItemKind.Text,
            detail: v.detail,
            documentation: v.documentation,
            command: { id: AddDynamicVariableAction.ID, title: "", arguments: [{ id: v.id, widget, range: rangeAfterInsert, variableData: revive(v.value), command: v.command }] }
          };
        });
        return {
          suggestions: variableItems
        };
      }
    }));
  }
  $unregisterAgentCompletionsProvider(handle, id) {
    this._agentCompletionProviders.deleteAndDispose(handle);
    this._agentIdsToCompletionProviders.deleteAndDispose(id);
  }
  $registerChatParticipantDetectionProvider(handle) {
    this._chatParticipantDetectionProviders.set(handle, this._chatAgentService.registerChatParticipantDetectionProvider(
      handle,
      {
        provideParticipantDetection: async (request, history, options, token) => {
          return await this._proxy.$detectChatParticipant(handle, request, { history }, options, token);
        }
      }
    ));
  }
  $unregisterChatParticipantDetectionProvider(handle) {
    this._chatParticipantDetectionProviders.deleteAndDispose(handle);
  }
  $registerRelatedFilesProvider(handle, metadata) {
    this._chatRelatedFilesProviders.set(handle, this._chatEditingService.registerRelatedFilesProvider(handle, {
      description: metadata.description,
      provideRelatedFiles: async (request, token) => {
        return (await this._proxy.$provideRelatedFiles(handle, request, token))?.map((v) => ({ uri: URI.from(v.uri), description: v.description })) ?? [];
      }
    }));
  }
  $unregisterRelatedFilesProvider(handle) {
    this._chatRelatedFilesProviders.deleteAndDispose(handle);
  }
};
MainThreadChatAgents2 = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadChatAgents2),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IChatService),
  __decorateParam(3, IChatEditingService),
  __decorateParam(4, ILanguageFeaturesService),
  __decorateParam(5, IChatWidgetService),
  __decorateParam(6, IInstantiationService),
  __decorateParam(7, ILogService),
  __decorateParam(8, IExtensionService)
], MainThreadChatAgents2);
function computeCompletionRanges(model, position, reg) {
  const varWord = getWordAtText(position.column, reg, model.getLineContent(position.lineNumber), 0);
  if (!varWord && model.getWordUntilPosition(position).word) {
    return;
  }
  let insert;
  let replace;
  if (!varWord) {
    insert = replace = Range.fromPositions(position);
  } else {
    insert = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, position.column);
    replace = new Range(position.lineNumber, varWord.startColumn, position.lineNumber, varWord.endColumn);
  }
  return { insert, replace };
}
var ChatNotebookEdit;
((ChatNotebookEdit2) => {
  function fromChatEdit(part) {
    return {
      kind: "notebookEdit",
      uri: part.uri,
      done: part.done,
      edits: part.edits.map(NotebookDto.fromCellEditOperationDto)
    };
  }
  ChatNotebookEdit2.fromChatEdit = fromChatEdit;
})(ChatNotebookEdit || (ChatNotebookEdit = {}));
export {
  MainThreadChatAgents2,
  MainThreadChatTask
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZENoYXRBZ2VudHMyLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlTWFwLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBlc2NhcGVSZWdFeHBDaGFyYWN0ZXJzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc3RyaW5ncy5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IFBvc2l0aW9uIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3Bvc2l0aW9uLmpzJztcbmltcG9ydCB7IFJhbmdlIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9jb3JlL3JhbmdlLmpzJztcbmltcG9ydCB7IGdldFdvcmRBdFRleHQgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvd29yZEhlbHBlci5qcyc7XG5pbXBvcnQgeyBDb21wbGV0aW9uQ29udGV4dCwgQ29tcGxldGlvbkl0ZW0sIENvbXBsZXRpb25JdGVtS2luZCwgQ29tcGxldGlvbkxpc3QgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBJVGV4dE1vZGVsIH0gZnJvbSAnLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9tb2RlbC5qcyc7XG5pbXBvcnQgeyBJTGFuZ3VhZ2VGZWF0dXJlc1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL3NlcnZpY2VzL2xhbmd1YWdlRmVhdHVyZXMuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgSUluc3RhbnRpYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vaW5zdGFudGlhdGlvbi9jb21tb24vaW5zdGFudGlhdGlvbi5qcyc7XG5pbXBvcnQgeyBJTG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3BsYXRmb3JtL2xvZy9jb21tb24vbG9nLmpzJztcbmltcG9ydCB7IElDaGF0V2lkZ2V0U2VydmljZSB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXQuanMnO1xuaW1wb3J0IHsgQ2hhdElucHV0UGFydCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9icm93c2VyL2NoYXRJbnB1dFBhcnQuanMnO1xuaW1wb3J0IHsgQWRkRHluYW1pY1ZhcmlhYmxlQWN0aW9uLCBJQWRkRHluYW1pY1ZhcmlhYmxlQ29udGV4dCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9icm93c2VyL2NvbnRyaWIvY2hhdER5bmFtaWNWYXJpYWJsZXMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudEhpc3RvcnlFbnRyeSwgSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uLCBJQ2hhdEFnZW50UmVxdWVzdCwgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuLi8uLi9jb250cmliL2NoYXQvY29tbW9uL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSUNoYXRFZGl0aW5nU2VydmljZSwgSUNoYXRSZWxhdGVkRmlsZVByb3ZpZGVyTWV0YWRhdGEgfSBmcm9tICcuLi8uLi9jb250cmliL2NoYXQvY29tbW9uL2NoYXRFZGl0aW5nU2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0UmVxdWVzdEFnZW50UGFydCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRSZXF1ZXN0UGFyc2VyIH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0UmVxdWVzdFBhcnNlci5qcyc7XG5pbXBvcnQgeyBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2UsIElDaGF0Q29udGVudFJlZmVyZW5jZSwgSUNoYXRGb2xsb3d1cCwgSUNoYXROb3RlYm9va0VkaXQsIElDaGF0UHJvZ3Jlc3MsIElDaGF0U2VydmljZSwgSUNoYXRUYXNrLCBJQ2hhdFdhcm5pbmdNZXNzYWdlIH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IElFeHRIb3N0Q29udGV4dCwgZXh0SG9zdE5hbWVkQ3VzdG9tZXIgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRIb3N0Q3VzdG9tZXJzLmpzJztcbmltcG9ydCB7IElFeHRlbnNpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBEdG8gfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9wcm94eUlkZW50aWZpZXIuanMnO1xuaW1wb3J0IHsgRXh0SG9zdENoYXRBZ2VudHNTaGFwZTIsIEV4dEhvc3RDb250ZXh0LCBJQ2hhdE5vdGVib29rRWRpdER0bywgSUNoYXRQYXJ0aWNpcGFudE1ldGFkYXRhLCBJQ2hhdFByb2dyZXNzRHRvLCBJRHluYW1pY0NoYXRBZ2VudFByb3BzLCBJRXh0ZW5zaW9uQ2hhdEFnZW50TWV0YWRhdGEsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkQ2hhdEFnZW50c1NoYXBlMiB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IE5vdGVib29rRHRvIH0gZnJvbSAnLi9tYWluVGhyZWFkTm90ZWJvb2tEdG8uanMnO1xuXG5pbnRlcmZhY2UgQWdlbnREYXRhIHtcblx0ZGlzcG9zZTogKCkgPT4gdm9pZDtcblx0aWQ6IHN0cmluZztcblx0ZXh0ZW5zaW9uSWQ6IEV4dGVuc2lvbklkZW50aWZpZXI7XG5cdGhhc0ZvbGxvd3Vwcz86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkQ2hhdFRhc2sgaW1wbGVtZW50cyBJQ2hhdFRhc2sge1xuXHRwdWJsaWMgcmVhZG9ubHkga2luZCA9ICdwcm9ncmVzc1Rhc2snO1xuXG5cdHB1YmxpYyByZWFkb25seSBkZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8c3RyaW5nIHwgdm9pZD4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZEFkZFByb2dyZXNzID0gbmV3IEVtaXR0ZXI8SUNoYXRXYXJuaW5nTWVzc2FnZSB8IElDaGF0Q29udGVudFJlZmVyZW5jZT4oKTtcblx0cHVibGljIGdldCBvbkRpZEFkZFByb2dyZXNzKCk6IEV2ZW50PElDaGF0V2FybmluZ01lc3NhZ2UgfCBJQ2hhdENvbnRlbnRSZWZlcmVuY2U+IHsgcmV0dXJuIHRoaXMuX29uRGlkQWRkUHJvZ3Jlc3MuZXZlbnQ7IH1cblxuXHRwdWJsaWMgcmVhZG9ubHkgcHJvZ3Jlc3M6IChJQ2hhdFdhcm5pbmdNZXNzYWdlIHwgSUNoYXRDb250ZW50UmVmZXJlbmNlKVtdID0gW107XG5cblx0Y29uc3RydWN0b3IocHVibGljIGNvbnRlbnQ6IElNYXJrZG93blN0cmluZykgeyB9XG5cblx0dGFzaygpIHtcblx0XHRyZXR1cm4gdGhpcy5kZWZlcnJlZC5wO1xuXHR9XG5cblx0aXNTZXR0bGVkKCkge1xuXHRcdHJldHVybiB0aGlzLmRlZmVycmVkLmlzU2V0dGxlZDtcblx0fVxuXG5cdGNvbXBsZXRlKHY6IHN0cmluZyB8IHZvaWQpIHtcblx0XHR0aGlzLmRlZmVycmVkLmNvbXBsZXRlKHYpO1xuXHR9XG5cblx0YWRkKHByb2dyZXNzOiBJQ2hhdFdhcm5pbmdNZXNzYWdlIHwgSUNoYXRDb250ZW50UmVmZXJlbmNlKTogdm9pZCB7XG5cdFx0dGhpcy5wcm9ncmVzcy5wdXNoKHByb2dyZXNzKTtcblx0XHR0aGlzLl9vbkRpZEFkZFByb2dyZXNzLmZpcmUocHJvZ3Jlc3MpO1xuXHR9XG59XG5cbkBleHRIb3N0TmFtZWRDdXN0b21lcihNYWluQ29udGV4dC5NYWluVGhyZWFkQ2hhdEFnZW50czIpXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZENoYXRBZ2VudHMyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIE1haW5UaHJlYWRDaGF0QWdlbnRzU2hhcGUyIHtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hZ2VudHMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxudW1iZXIsIEFnZW50RGF0YT4oKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FnZW50Q29tcGxldGlvblByb3ZpZGVycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPG51bWJlciwgSURpc3Bvc2FibGU+KCkpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9hZ2VudElkc1RvQ29tcGxldGlvblByb3ZpZGVycyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZywgSURpc3Bvc2FibGU+KTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMgPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcDxudW1iZXIsIElEaXNwb3NhYmxlPigpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJzID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXA8bnVtYmVyLCBJRGlzcG9zYWJsZT4oKSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcGVuZGluZ1Byb2dyZXNzID0gbmV3IE1hcDxzdHJpbmcsIChwYXJ0OiBJQ2hhdFByb2dyZXNzKSA9PiB2b2lkPigpO1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdENoYXRBZ2VudHNTaGFwZTI7XG5cblx0cHJpdmF0ZSBfcmVzcG9uc2VQYXJ0SGFuZGxlUG9vbCA9IDA7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2FjdGl2ZVRhc2tzID0gbmV3IE1hcDxzdHJpbmcsIElDaGF0VGFzaz4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF91bnJlc29sdmVkQW5jaG9ycyA9IG5ldyBNYXA8LyogcmVxdWVzdElkICovc3RyaW5nLCBNYXA8LyogaWQgKi8gc3RyaW5nLCBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2U+PigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdGV4dEhvc3RDb250ZXh0OiBJRXh0SG9zdENvbnRleHQsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2NoYXRBZ2VudFNlcnZpY2U6IElDaGF0QWdlbnRTZXJ2aWNlLFxuXHRcdEBJQ2hhdFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFNlcnZpY2U6IElDaGF0U2VydmljZSxcblx0XHRASUNoYXRFZGl0aW5nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9jaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UsXG5cdFx0QElMYW5ndWFnZUZlYXR1cmVzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9sYW5ndWFnZUZlYXR1cmVzU2VydmljZTogSUxhbmd1YWdlRmVhdHVyZXNTZXJ2aWNlLFxuXHRcdEBJQ2hhdFdpZGdldFNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBfY2hhdFdpZGdldFNlcnZpY2U6IElDaGF0V2lkZ2V0U2VydmljZSxcblx0XHRASUluc3RhbnRpYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2luc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJRXh0ZW5zaW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IF9leHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblx0XHR0aGlzLl9wcm94eSA9IGV4dEhvc3RDb250ZXh0LmdldFByb3h5KEV4dEhvc3RDb250ZXh0LkV4dEhvc3RDaGF0QWdlbnRzMik7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9jaGF0U2VydmljZS5vbkRpZERpc3Bvc2VTZXNzaW9uKGUgPT4ge1xuXHRcdFx0dGhpcy5fcHJveHkuJHJlbGVhc2VTZXNzaW9uKGUuc2Vzc2lvbklkKTtcblx0XHR9KSk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5fY2hhdFNlcnZpY2Uub25EaWRQZXJmb3JtVXNlckFjdGlvbihlID0+IHtcblx0XHRcdGlmICh0eXBlb2YgZS5hZ2VudElkID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRmb3IgKGNvbnN0IFtoYW5kbGUsIGFnZW50XSBvZiB0aGlzLl9hZ2VudHMpIHtcblx0XHRcdFx0XHRpZiAoYWdlbnQuaWQgPT09IGUuYWdlbnRJZCkge1xuXHRcdFx0XHRcdFx0aWYgKGUuYWN0aW9uLmtpbmQgPT09ICd2b3RlJykge1xuXHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kYWNjZXB0RmVlZGJhY2soaGFuZGxlLCBlLnJlc3VsdCA/PyB7fSwgZS5hY3Rpb24pO1xuXHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJGFjY2VwdEFjdGlvbihoYW5kbGUsIGUucmVzdWx0IHx8IHt9LCBlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdH0pKTtcblx0fVxuXG5cdCR1bnJlZ2lzdGVyQWdlbnQoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9hZ2VudHMuZGVsZXRlQW5kRGlzcG9zZShoYW5kbGUpO1xuXHR9XG5cblx0JHRyYW5zZmVyQWN0aXZlQ2hhdFNlc3Npb24odG9Xb3Jrc3BhY2U6IFVyaUNvbXBvbmVudHMpOiB2b2lkIHtcblx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9jaGF0V2lkZ2V0U2VydmljZS5sYXN0Rm9jdXNlZFdpZGdldDtcblx0XHRjb25zdCBzZXNzaW9uSWQgPSB3aWRnZXQ/LnZpZXdNb2RlbD8ubW9kZWwuc2Vzc2lvbklkO1xuXHRcdGlmICghc2Vzc2lvbklkKSB7XG5cdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBNYWluVGhyZWFkQ2hhdCMkdHJhbnNmZXJBY3RpdmVDaGF0U2Vzc2lvbjogTm8gYWN0aXZlIGNoYXQgc2Vzc2lvbiBmb3VuZGApO1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGlucHV0VmFsdWUgPSB3aWRnZXQ/LmlucHV0RWRpdG9yLmdldFZhbHVlKCkgPz8gJyc7XG5cdFx0Y29uc3QgbG9jYXRpb24gPSB3aWRnZXQubG9jYXRpb247XG5cdFx0Y29uc3QgbW9kZSA9IHdpZGdldC5pbnB1dC5jdXJyZW50TW9kZTtcblx0XHR0aGlzLl9jaGF0U2VydmljZS50cmFuc2ZlckNoYXRTZXNzaW9uKHsgc2Vzc2lvbklkLCBpbnB1dFZhbHVlLCBsb2NhdGlvbiwgbW9kZSB9LCBVUkkucmV2aXZlKHRvV29ya3NwYWNlKSk7XG5cdH1cblxuXHRhc3luYyAkcmVnaXN0ZXJBZ2VudChoYW5kbGU6IG51bWJlciwgZXh0ZW5zaW9uOiBFeHRlbnNpb25JZGVudGlmaWVyLCBpZDogc3RyaW5nLCBtZXRhZGF0YTogSUV4dGVuc2lvbkNoYXRBZ2VudE1ldGFkYXRhLCBkeW5hbWljUHJvcHM6IElEeW5hbWljQ2hhdEFnZW50UHJvcHMgfCB1bmRlZmluZWQpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRhd2FpdCB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLndoZW5JbnN0YWxsZWRFeHRlbnNpb25zUmVnaXN0ZXJlZCgpO1xuXHRcdGNvbnN0IHN0YXRpY0FnZW50UmVnaXN0cmF0aW9uID0gdGhpcy5fY2hhdEFnZW50U2VydmljZS5nZXRBZ2VudChpZCwgdHJ1ZSk7XG5cdFx0aWYgKCFzdGF0aWNBZ2VudFJlZ2lzdHJhdGlvbiAmJiAhZHluYW1pY1Byb3BzKSB7XG5cdFx0XHRpZiAodGhpcy5fY2hhdEFnZW50U2VydmljZS5nZXRBZ2VudHNCeU5hbWUoaWQpLmxlbmd0aCkge1xuXHRcdFx0XHQvLyBMaWtlbHkgc29tZSBleHRlbnNpb24gYXV0aG9ycyB3aWxsIG5vdCBhZG9wdCB0aGUgbmV3IElELCBzbyBnaXZlIGEgaGludCBpZiB0aGV5IHJlZ2lzdGVyIGFcblx0XHRcdFx0Ly8gcGFydGljaXBhbnQgYnkgbmFtZSBpbnN0ZWFkIG9mIElELlxuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoYGNoYXRQYXJ0aWNpcGFudCBtdXN0IGJlIGRlY2xhcmVkIHdpdGggYW4gSUQgaW4gcGFja2FnZS5qc29uLiBUaGUgXCJpZFwiIHByb3BlcnR5IG1heSBiZSBtaXNzaW5nISBcIiR7aWR9XCJgKTtcblx0XHRcdH1cblxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBjaGF0UGFydGljaXBhbnQgbXVzdCBiZSBkZWNsYXJlZCBpbiBwYWNrYWdlLmpzb246ICR7aWR9YCk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaW1wbDogSUNoYXRBZ2VudEltcGxlbWVudGF0aW9uID0ge1xuXHRcdFx0aW52b2tlOiBhc3luYyAocmVxdWVzdCwgcHJvZ3Jlc3MsIGhpc3RvcnksIHRva2VuKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3BlbmRpbmdQcm9ncmVzcy5zZXQocmVxdWVzdC5yZXF1ZXN0SWQsIHByb2dyZXNzKTtcblx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5fcHJveHkuJGludm9rZUFnZW50KGhhbmRsZSwgcmVxdWVzdCwgeyBoaXN0b3J5IH0sIHRva2VuKSA/PyB7fTtcblx0XHRcdFx0fSBmaW5hbGx5IHtcblx0XHRcdFx0XHR0aGlzLl9wZW5kaW5nUHJvZ3Jlc3MuZGVsZXRlKHJlcXVlc3QucmVxdWVzdElkKTtcblx0XHRcdFx0fVxuXHRcdFx0fSxcblx0XHRcdHNldFJlcXVlc3RQYXVzZWQ6IChyZXF1ZXN0SWQsIGlzUGF1c2VkKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiRzZXRSZXF1ZXN0UGF1c2VkKGhhbmRsZSwgcmVxdWVzdElkLCBpc1BhdXNlZCk7XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZUZvbGxvd3VwczogYXN5bmMgKHJlcXVlc3QsIHJlc3VsdCwgaGlzdG9yeSwgdG9rZW4pOiBQcm9taXNlPElDaGF0Rm9sbG93dXBbXT4gPT4ge1xuXHRcdFx0XHRpZiAoIXRoaXMuX2FnZW50cy5nZXQoaGFuZGxlKT8uaGFzRm9sbG93dXBzKSB7XG5cdFx0XHRcdFx0cmV0dXJuIFtdO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHRoaXMuX3Byb3h5LiRwcm92aWRlRm9sbG93dXBzKHJlcXVlc3QsIGhhbmRsZSwgcmVzdWx0LCB7IGhpc3RvcnkgfSwgdG9rZW4pO1xuXHRcdFx0fSxcblx0XHRcdHByb3ZpZGVDaGF0VGl0bGU6IChoaXN0b3J5LCB0b2tlbikgPT4ge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5fcHJveHkuJHByb3ZpZGVDaGF0VGl0bGUoaGFuZGxlLCBoaXN0b3J5LCB0b2tlbik7XG5cdFx0XHR9LFxuXHRcdFx0cHJvdmlkZVNhbXBsZVF1ZXN0aW9uczogKGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiB0aGlzLl9wcm94eS4kcHJvdmlkZVNhbXBsZVF1ZXN0aW9ucyhoYW5kbGUsIGxvY2F0aW9uLCB0b2tlbik7XG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdGxldCBkaXNwb3NhYmxlOiBJRGlzcG9zYWJsZTtcblx0XHRpZiAoIXN0YXRpY0FnZW50UmVnaXN0cmF0aW9uICYmIGR5bmFtaWNQcm9wcykge1xuXHRcdFx0Y29uc3QgZXh0ZW5zaW9uRGVzY3JpcHRpb24gPSB0aGlzLl9leHRlbnNpb25TZXJ2aWNlLmV4dGVuc2lvbnMuZmluZChlID0+IEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGUuaWRlbnRpZmllciwgZXh0ZW5zaW9uKSk7XG5cdFx0XHRkaXNwb3NhYmxlID0gdGhpcy5fY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckR5bmFtaWNBZ2VudChcblx0XHRcdFx0e1xuXHRcdFx0XHRcdGlkLFxuXHRcdFx0XHRcdG5hbWU6IGR5bmFtaWNQcm9wcy5uYW1lLFxuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBkeW5hbWljUHJvcHMuZGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IGV4dGVuc2lvbixcblx0XHRcdFx0XHRleHRlbnNpb25EaXNwbGF5TmFtZTogZXh0ZW5zaW9uRGVzY3JpcHRpb24/LmRpc3BsYXlOYW1lID8/IGV4dGVuc2lvbi52YWx1ZSxcblx0XHRcdFx0XHRleHRlbnNpb25QdWJsaXNoZXJJZDogZXh0ZW5zaW9uRGVzY3JpcHRpb24/LnB1Ymxpc2hlciA/PyAnJyxcblx0XHRcdFx0XHRwdWJsaXNoZXJEaXNwbGF5TmFtZTogZHluYW1pY1Byb3BzLnB1Ymxpc2hlck5hbWUsXG5cdFx0XHRcdFx0ZnVsbE5hbWU6IGR5bmFtaWNQcm9wcy5mdWxsTmFtZSxcblx0XHRcdFx0XHRtZXRhZGF0YTogcmV2aXZlKG1ldGFkYXRhKSxcblx0XHRcdFx0XHRzbGFzaENvbW1hbmRzOiBbXSxcblx0XHRcdFx0XHRkaXNhbWJpZ3VhdGlvbjogW10sXG5cdFx0XHRcdFx0bG9jYXRpb25zOiBbQ2hhdEFnZW50TG9jYXRpb24uUGFuZWxdLCAvLyBUT0RPIGFsbCBkeW5hbWljIHBhcnRpY2lwYW50cyBhcmUgcGFuZWwgb25seT9cblx0XHRcdFx0fSxcblx0XHRcdFx0aW1wbCk7XG5cdFx0fSBlbHNlIHtcblx0XHRcdGRpc3Bvc2FibGUgPSB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyQWdlbnRJbXBsZW1lbnRhdGlvbihpZCwgaW1wbCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fYWdlbnRzLnNldChoYW5kbGUsIHtcblx0XHRcdGlkOiBpZCxcblx0XHRcdGV4dGVuc2lvbklkOiBleHRlbnNpb24sXG5cdFx0XHRkaXNwb3NlOiBkaXNwb3NhYmxlLmRpc3Bvc2UsXG5cdFx0XHRoYXNGb2xsb3d1cHM6IG1ldGFkYXRhLmhhc0ZvbGxvd3Vwc1xuXHRcdH0pO1xuXHR9XG5cblx0YXN5bmMgJHVwZGF0ZUFnZW50KGhhbmRsZTogbnVtYmVyLCBtZXRhZGF0YVVwZGF0ZTogSUV4dGVuc2lvbkNoYXRBZ2VudE1ldGFkYXRhKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0YXdhaXQgdGhpcy5fZXh0ZW5zaW9uU2VydmljZS53aGVuSW5zdGFsbGVkRXh0ZW5zaW9uc1JlZ2lzdGVyZWQoKTtcblx0XHRjb25zdCBkYXRhID0gdGhpcy5fYWdlbnRzLmdldChoYW5kbGUpO1xuXHRcdGlmICghZGF0YSkge1xuXHRcdFx0dGhpcy5fbG9nU2VydmljZS5lcnJvcihgTWFpblRocmVhZENoYXRBZ2VudHMyIyR1cGRhdGVBZ2VudDogTm8gYWdlbnQgd2l0aCBoYW5kbGUgJHtoYW5kbGV9IHJlZ2lzdGVyZWRgKTtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cdFx0ZGF0YS5oYXNGb2xsb3d1cHMgPSBtZXRhZGF0YVVwZGF0ZS5oYXNGb2xsb3d1cHM7XG5cdFx0dGhpcy5fY2hhdEFnZW50U2VydmljZS51cGRhdGVBZ2VudChkYXRhLmlkLCByZXZpdmUobWV0YWRhdGFVcGRhdGUpKTtcblx0fVxuXG5cdGFzeW5jICRoYW5kbGVQcm9ncmVzc0NodW5rKHJlcXVlc3RJZDogc3RyaW5nLCBwcm9ncmVzczogSUNoYXRQcm9ncmVzc0R0bywgcmVzcG9uc2VQYXJ0SGFuZGxlPzogbnVtYmVyKTogUHJvbWlzZTxudW1iZXIgfCB2b2lkPiB7XG5cdFx0Y29uc3QgcmV2aXZlZFByb2dyZXNzID0gcHJvZ3Jlc3Mua2luZCA9PT0gJ25vdGVib29rRWRpdCcgPyBDaGF0Tm90ZWJvb2tFZGl0LmZyb21DaGF0RWRpdChyZXZpdmUocHJvZ3Jlc3MpKSA6IHJldml2ZShwcm9ncmVzcykgYXMgSUNoYXRQcm9ncmVzcztcblx0XHRpZiAocmV2aXZlZFByb2dyZXNzLmtpbmQgPT09ICdwcm9ncmVzc1Rhc2snKSB7XG5cdFx0XHRjb25zdCBoYW5kbGUgPSArK3RoaXMuX3Jlc3BvbnNlUGFydEhhbmRsZVBvb2w7XG5cdFx0XHRjb25zdCByZXNwb25zZVBhcnRJZCA9IGAke3JlcXVlc3RJZH1fJHtoYW5kbGV9YDtcblx0XHRcdGNvbnN0IHRhc2sgPSBuZXcgTWFpblRocmVhZENoYXRUYXNrKHJldml2ZWRQcm9ncmVzcy5jb250ZW50KTtcblx0XHRcdHRoaXMuX2FjdGl2ZVRhc2tzLnNldChyZXNwb25zZVBhcnRJZCwgdGFzayk7XG5cdFx0XHR0aGlzLl9wZW5kaW5nUHJvZ3Jlc3MuZ2V0KHJlcXVlc3RJZCk/Lih0YXNrKTtcblx0XHRcdHJldHVybiBoYW5kbGU7XG5cdFx0fSBlbHNlIGlmIChyZXNwb25zZVBhcnRIYW5kbGUgIT09IHVuZGVmaW5lZCkge1xuXHRcdFx0Y29uc3QgcmVzcG9uc2VQYXJ0SWQgPSBgJHtyZXF1ZXN0SWR9XyR7cmVzcG9uc2VQYXJ0SGFuZGxlfWA7XG5cdFx0XHRjb25zdCB0YXNrID0gdGhpcy5fYWN0aXZlVGFza3MuZ2V0KHJlc3BvbnNlUGFydElkKTtcblx0XHRcdHN3aXRjaCAocmV2aXZlZFByb2dyZXNzLmtpbmQpIHtcblx0XHRcdFx0Y2FzZSAncHJvZ3Jlc3NUYXNrUmVzdWx0Jzpcblx0XHRcdFx0XHRpZiAodGFzayAmJiByZXZpdmVkUHJvZ3Jlc3MuY29udGVudCkge1xuXHRcdFx0XHRcdFx0dGFzay5jb21wbGV0ZShyZXZpdmVkUHJvZ3Jlc3MuY29udGVudC52YWx1ZSk7XG5cdFx0XHRcdFx0XHR0aGlzLl9hY3RpdmVUYXNrcy5kZWxldGUocmVzcG9uc2VQYXJ0SWQpO1xuXHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHR0YXNrPy5jb21wbGV0ZSh1bmRlZmluZWQpO1xuXHRcdFx0XHRcdH1cblx0XHRcdFx0XHRyZXR1cm4gcmVzcG9uc2VQYXJ0SGFuZGxlO1xuXHRcdFx0XHRjYXNlICd3YXJuaW5nJzpcblx0XHRcdFx0Y2FzZSAncmVmZXJlbmNlJzpcblx0XHRcdFx0XHR0YXNrPy5hZGQocmV2aXZlZFByb2dyZXNzKTtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHJldml2ZWRQcm9ncmVzcy5raW5kID09PSAnaW5saW5lUmVmZXJlbmNlJyAmJiByZXZpdmVkUHJvZ3Jlc3MucmVzb2x2ZUlkKSB7XG5cdFx0XHRpZiAoIXRoaXMuX3VucmVzb2x2ZWRBbmNob3JzLmhhcyhyZXF1ZXN0SWQpKSB7XG5cdFx0XHRcdHRoaXMuX3VucmVzb2x2ZWRBbmNob3JzLnNldChyZXF1ZXN0SWQsIG5ldyBNYXAoKSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl91bnJlc29sdmVkQW5jaG9ycy5nZXQocmVxdWVzdElkKT8uc2V0KHJldml2ZWRQcm9ncmVzcy5yZXNvbHZlSWQsIHJldml2ZWRQcm9ncmVzcyk7XG5cdFx0fVxuXG5cdFx0dGhpcy5fcGVuZGluZ1Byb2dyZXNzLmdldChyZXF1ZXN0SWQpPy4ocmV2aXZlZFByb2dyZXNzKTtcblx0fVxuXG5cdCRoYW5kbGVBbmNob3JSZXNvbHZlKHJlcXVlc3RJZDogc3RyaW5nLCBoYW5kbGU6IHN0cmluZywgcmVzb2x2ZUFuY2hvcjogRHRvPElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZT4gfCB1bmRlZmluZWQpOiB2b2lkIHtcblx0XHRjb25zdCBhbmNob3IgPSB0aGlzLl91bnJlc29sdmVkQW5jaG9ycy5nZXQocmVxdWVzdElkKT8uZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhbmNob3IpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHR0aGlzLl91bnJlc29sdmVkQW5jaG9ycy5nZXQocmVxdWVzdElkKT8uZGVsZXRlKGhhbmRsZSk7XG5cdFx0aWYgKHJlc29sdmVBbmNob3IpIHtcblx0XHRcdGNvbnN0IHJldml2ZWRBbmNob3IgPSByZXZpdmUocmVzb2x2ZUFuY2hvcikgYXMgSUNoYXRDb250ZW50SW5saW5lUmVmZXJlbmNlO1xuXHRcdFx0YW5jaG9yLmlubGluZVJlZmVyZW5jZSA9IHJldml2ZWRBbmNob3IuaW5saW5lUmVmZXJlbmNlO1xuXHRcdH1cblx0fVxuXG5cdCRyZWdpc3RlckFnZW50Q29tcGxldGlvbnNQcm92aWRlcihoYW5kbGU6IG51bWJlciwgaWQ6IHN0cmluZywgdHJpZ2dlckNoYXJhY3RlcnM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0Y29uc3QgcHJvdmlkZSA9IGFzeW5jIChxdWVyeTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pID0+IHtcblx0XHRcdGNvbnN0IGNvbXBsZXRpb25zID0gYXdhaXQgdGhpcy5fcHJveHkuJGludm9rZUNvbXBsZXRpb25Qcm92aWRlcihoYW5kbGUsIHF1ZXJ5LCB0b2tlbik7XG5cdFx0XHRyZXR1cm4gY29tcGxldGlvbnMubWFwKChjKSA9PiAoeyAuLi5jLCBpY29uOiBjLmljb24gPyBUaGVtZUljb24uZnJvbUlkKGMuaWNvbikgOiB1bmRlZmluZWQgfSkpO1xuXHRcdH07XG5cdFx0dGhpcy5fYWdlbnRJZHNUb0NvbXBsZXRpb25Qcm92aWRlcnMuc2V0KGlkLCB0aGlzLl9jaGF0QWdlbnRTZXJ2aWNlLnJlZ2lzdGVyQWdlbnRDb21wbGV0aW9uUHJvdmlkZXIoaWQsIHByb3ZpZGUpKTtcblxuXHRcdHRoaXMuX2FnZW50Q29tcGxldGlvblByb3ZpZGVycy5zZXQoaGFuZGxlLCB0aGlzLl9sYW5ndWFnZUZlYXR1cmVzU2VydmljZS5jb21wbGV0aW9uUHJvdmlkZXIucmVnaXN0ZXIoeyBzY2hlbWU6IENoYXRJbnB1dFBhcnQuSU5QVVRfU0NIRU1FLCBoYXNBY2Nlc3NUb0FsbE1vZGVsczogdHJ1ZSB9LCB7XG5cdFx0XHRfZGVidWdEaXNwbGF5TmFtZTogJ2NoYXRBZ2VudENvbXBsZXRpb25zOicgKyBoYW5kbGUsXG5cdFx0XHR0cmlnZ2VyQ2hhcmFjdGVycyxcblx0XHRcdHByb3ZpZGVDb21wbGV0aW9uSXRlbXM6IGFzeW5jIChtb2RlbDogSVRleHRNb2RlbCwgcG9zaXRpb246IFBvc2l0aW9uLCBfY29udGV4dDogQ29tcGxldGlvbkNvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbikgPT4ge1xuXHRcdFx0XHRjb25zdCB3aWRnZXQgPSB0aGlzLl9jaGF0V2lkZ2V0U2VydmljZS5nZXRXaWRnZXRCeUlucHV0VXJpKG1vZGVsLnVyaSk7XG5cdFx0XHRcdGlmICghd2lkZ2V0IHx8ICF3aWRnZXQudmlld01vZGVsKSB7XG5cdFx0XHRcdFx0cmV0dXJuO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgdHJpZ2dlckNoYXJzUGFydCA9IHRyaWdnZXJDaGFyYWN0ZXJzLm1hcChjID0+IGVzY2FwZVJlZ0V4cENoYXJhY3RlcnMoYykpLmpvaW4oJycpO1xuXHRcdFx0XHRjb25zdCB3b3JkUmVnZXggPSBuZXcgUmVnRXhwKGBbJHt0cmlnZ2VyQ2hhcnNQYXJ0fV1cXFxcUypgLCAnZycpO1xuXHRcdFx0XHRjb25zdCBxdWVyeSA9IGdldFdvcmRBdFRleHQocG9zaXRpb24uY29sdW1uLCB3b3JkUmVnZXgsIG1vZGVsLmdldExpbmVDb250ZW50KHBvc2l0aW9uLmxpbmVOdW1iZXIpLCAwKT8ud29yZCA/PyAnJztcblxuXHRcdFx0XHRpZiAocXVlcnkgJiYgIXRyaWdnZXJDaGFyYWN0ZXJzLnNvbWUoYyA9PiBxdWVyeS5zdGFydHNXaXRoKGMpKSkge1xuXHRcdFx0XHRcdHJldHVybjtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdGNvbnN0IHBhcnNlZFJlcXVlc3QgPSB0aGlzLl9pbnN0YW50aWF0aW9uU2VydmljZS5jcmVhdGVJbnN0YW5jZShDaGF0UmVxdWVzdFBhcnNlcikucGFyc2VDaGF0UmVxdWVzdCh3aWRnZXQudmlld01vZGVsLnNlc3Npb25JZCwgbW9kZWwuZ2V0VmFsdWUoKSkucGFydHM7XG5cdFx0XHRcdGNvbnN0IGFnZW50UGFydCA9IHBhcnNlZFJlcXVlc3QuZmluZCgocGFydCk6IHBhcnQgaXMgQ2hhdFJlcXVlc3RBZ2VudFBhcnQgPT4gcGFydCBpbnN0YW5jZW9mIENoYXRSZXF1ZXN0QWdlbnRQYXJ0KTtcblx0XHRcdFx0Y29uc3QgdGhpc0FnZW50SWQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk/LmlkO1xuXHRcdFx0XHRpZiAoYWdlbnRQYXJ0Py5hZ2VudC5pZCAhPT0gdGhpc0FnZW50SWQpIHtcblx0XHRcdFx0XHRyZXR1cm47XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRjb25zdCByYW5nZSA9IGNvbXB1dGVDb21wbGV0aW9uUmFuZ2VzKG1vZGVsLCBwb3NpdGlvbiwgd29yZFJlZ2V4KTtcblx0XHRcdFx0aWYgKCFyYW5nZSkge1xuXHRcdFx0XHRcdHJldHVybiBudWxsO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzdWx0ID0gYXdhaXQgcHJvdmlkZShxdWVyeSwgdG9rZW4pO1xuXHRcdFx0XHRjb25zdCB2YXJpYWJsZUl0ZW1zID0gcmVzdWx0Lm1hcCh2ID0+IHtcblx0XHRcdFx0XHRjb25zdCBpbnNlcnRUZXh0ID0gdi5pbnNlcnRUZXh0ID8/ICh0eXBlb2Ygdi5sYWJlbCA9PT0gJ3N0cmluZycgPyB2LmxhYmVsIDogdi5sYWJlbC5sYWJlbCk7XG5cdFx0XHRcdFx0Y29uc3QgcmFuZ2VBZnRlckluc2VydCA9IG5ldyBSYW5nZShyYW5nZS5pbnNlcnQuc3RhcnRMaW5lTnVtYmVyLCByYW5nZS5pbnNlcnQuc3RhcnRDb2x1bW4sIHJhbmdlLmluc2VydC5lbmRMaW5lTnVtYmVyLCByYW5nZS5pbnNlcnQuc3RhcnRDb2x1bW4gKyBpbnNlcnRUZXh0Lmxlbmd0aCk7XG5cdFx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRcdGxhYmVsOiB2LmxhYmVsLFxuXHRcdFx0XHRcdFx0cmFuZ2UsXG5cdFx0XHRcdFx0XHRpbnNlcnRUZXh0OiBpbnNlcnRUZXh0ICsgJyAnLFxuXHRcdFx0XHRcdFx0a2luZDogQ29tcGxldGlvbkl0ZW1LaW5kLlRleHQsXG5cdFx0XHRcdFx0XHRkZXRhaWw6IHYuZGV0YWlsLFxuXHRcdFx0XHRcdFx0ZG9jdW1lbnRhdGlvbjogdi5kb2N1bWVudGF0aW9uLFxuXHRcdFx0XHRcdFx0Y29tbWFuZDogeyBpZDogQWRkRHluYW1pY1ZhcmlhYmxlQWN0aW9uLklELCB0aXRsZTogJycsIGFyZ3VtZW50czogW3sgaWQ6IHYuaWQsIHdpZGdldCwgcmFuZ2U6IHJhbmdlQWZ0ZXJJbnNlcnQsIHZhcmlhYmxlRGF0YTogcmV2aXZlKHYudmFsdWUpIGFzIGFueSwgY29tbWFuZDogdi5jb21tYW5kIH0gc2F0aXNmaWVzIElBZGREeW5hbWljVmFyaWFibGVDb250ZXh0XSB9XG5cdFx0XHRcdFx0fSBzYXRpc2ZpZXMgQ29tcGxldGlvbkl0ZW07XG5cdFx0XHRcdH0pO1xuXG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0c3VnZ2VzdGlvbnM6IHZhcmlhYmxlSXRlbXNcblx0XHRcdFx0fSBzYXRpc2ZpZXMgQ29tcGxldGlvbkxpc3Q7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0JHVucmVnaXN0ZXJBZ2VudENvbXBsZXRpb25zUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIsIGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9hZ2VudENvbXBsZXRpb25Qcm92aWRlcnMuZGVsZXRlQW5kRGlzcG9zZShoYW5kbGUpO1xuXHRcdHRoaXMuX2FnZW50SWRzVG9Db21wbGV0aW9uUHJvdmlkZXJzLmRlbGV0ZUFuZERpc3Bvc2UoaWQpO1xuXHR9XG5cblx0JHJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoaGFuZGxlOiBudW1iZXIpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMuc2V0KGhhbmRsZSwgdGhpcy5fY2hhdEFnZW50U2VydmljZS5yZWdpc3RlckNoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVyKGhhbmRsZSxcblx0XHRcdHtcblx0XHRcdFx0cHJvdmlkZVBhcnRpY2lwYW50RGV0ZWN0aW9uOiBhc3luYyAocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIGhpc3Rvcnk6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlbXSwgb3B0aW9uczogeyBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247IHBhcnRpY2lwYW50czogSUNoYXRQYXJ0aWNpcGFudE1ldGFkYXRhW10gfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKSA9PiB7XG5cdFx0XHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuX3Byb3h5LiRkZXRlY3RDaGF0UGFydGljaXBhbnQoaGFuZGxlLCByZXF1ZXN0LCB7IGhpc3RvcnkgfSwgb3B0aW9ucywgdG9rZW4pO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0KSk7XG5cdH1cblxuXHQkdW5yZWdpc3RlckNoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyKTogdm9pZCB7XG5cdFx0dGhpcy5fY2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzLmRlbGV0ZUFuZERpc3Bvc2UoaGFuZGxlKTtcblx0fVxuXG5cdCRyZWdpc3RlclJlbGF0ZWRGaWxlc1Byb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBtZXRhZGF0YTogSUNoYXRSZWxhdGVkRmlsZVByb3ZpZGVyTWV0YWRhdGEpOiB2b2lkIHtcblx0XHR0aGlzLl9jaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXJzLnNldChoYW5kbGUsIHRoaXMuX2NoYXRFZGl0aW5nU2VydmljZS5yZWdpc3RlclJlbGF0ZWRGaWxlc1Byb3ZpZGVyKGhhbmRsZSwge1xuXHRcdFx0ZGVzY3JpcHRpb246IG1ldGFkYXRhLmRlc2NyaXB0aW9uLFxuXHRcdFx0cHJvdmlkZVJlbGF0ZWRGaWxlczogYXN5bmMgKHJlcXVlc3QsIHRva2VuKSA9PiB7XG5cdFx0XHRcdHJldHVybiAoYXdhaXQgdGhpcy5fcHJveHkuJHByb3ZpZGVSZWxhdGVkRmlsZXMoaGFuZGxlLCByZXF1ZXN0LCB0b2tlbikpPy5tYXAoKHYpID0+ICh7IHVyaTogVVJJLmZyb20odi51cmkpLCBkZXNjcmlwdGlvbjogdi5kZXNjcmlwdGlvbiB9KSkgPz8gW107XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0JHVucmVnaXN0ZXJSZWxhdGVkRmlsZXNQcm92aWRlcihoYW5kbGU6IG51bWJlcik6IHZvaWQge1xuXHRcdHRoaXMuX2NoYXRSZWxhdGVkRmlsZXNQcm92aWRlcnMuZGVsZXRlQW5kRGlzcG9zZShoYW5kbGUpO1xuXHR9XG59XG5cblxuZnVuY3Rpb24gY29tcHV0ZUNvbXBsZXRpb25SYW5nZXMobW9kZWw6IElUZXh0TW9kZWwsIHBvc2l0aW9uOiBQb3NpdGlvbiwgcmVnOiBSZWdFeHApOiB7IGluc2VydDogUmFuZ2U7IHJlcGxhY2U6IFJhbmdlIH0gfCB1bmRlZmluZWQge1xuXHRjb25zdCB2YXJXb3JkID0gZ2V0V29yZEF0VGV4dChwb3NpdGlvbi5jb2x1bW4sIHJlZywgbW9kZWwuZ2V0TGluZUNvbnRlbnQocG9zaXRpb24ubGluZU51bWJlciksIDApO1xuXHRpZiAoIXZhcldvcmQgJiYgbW9kZWwuZ2V0V29yZFVudGlsUG9zaXRpb24ocG9zaXRpb24pLndvcmQpIHtcblx0XHQvLyBpbnNpZGUgYSBcIm5vcm1hbFwiIHdvcmRcblx0XHRyZXR1cm47XG5cdH1cblxuXHRsZXQgaW5zZXJ0OiBSYW5nZTtcblx0bGV0IHJlcGxhY2U6IFJhbmdlO1xuXHRpZiAoIXZhcldvcmQpIHtcblx0XHRpbnNlcnQgPSByZXBsYWNlID0gUmFuZ2UuZnJvbVBvc2l0aW9ucyhwb3NpdGlvbik7XG5cdH0gZWxzZSB7XG5cdFx0aW5zZXJ0ID0gbmV3IFJhbmdlKHBvc2l0aW9uLmxpbmVOdW1iZXIsIHZhcldvcmQuc3RhcnRDb2x1bW4sIHBvc2l0aW9uLmxpbmVOdW1iZXIsIHBvc2l0aW9uLmNvbHVtbik7XG5cdFx0cmVwbGFjZSA9IG5ldyBSYW5nZShwb3NpdGlvbi5saW5lTnVtYmVyLCB2YXJXb3JkLnN0YXJ0Q29sdW1uLCBwb3NpdGlvbi5saW5lTnVtYmVyLCB2YXJXb3JkLmVuZENvbHVtbik7XG5cdH1cblxuXHRyZXR1cm4geyBpbnNlcnQsIHJlcGxhY2UgfTtcbn1cblxubmFtZXNwYWNlIENoYXROb3RlYm9va0VkaXQge1xuXHRleHBvcnQgZnVuY3Rpb24gZnJvbUNoYXRFZGl0KHBhcnQ6IElDaGF0Tm90ZWJvb2tFZGl0RHRvKTogSUNoYXROb3RlYm9va0VkaXQge1xuXHRcdHJldHVybiB7XG5cdFx0XHRraW5kOiAnbm90ZWJvb2tFZGl0Jyxcblx0XHRcdHVyaTogcGFydC51cmksXG5cdFx0XHRkb25lOiBwYXJ0LmRvbmUsXG5cdFx0XHRlZGl0czogcGFydC5lZGl0cy5tYXAoTm90ZWJvb2tEdG8uZnJvbUNlbGxFZGl0T3BlcmF0aW9uRHRvKVxuXHRcdH07XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyx1QkFBdUI7QUFFaEMsU0FBUyxlQUFzQjtBQUUvQixTQUFTLFlBQVkscUJBQWtDO0FBQ3ZELFNBQVMsY0FBYztBQUN2QixTQUFTLDhCQUE4QjtBQUN2QyxTQUFTLGlCQUFpQjtBQUMxQixTQUFTLFdBQTBCO0FBRW5DLFNBQVMsYUFBYTtBQUN0QixTQUFTLHFCQUFxQjtBQUM5QixTQUE0QywwQkFBMEM7QUFFdEYsU0FBUyxnQ0FBZ0M7QUFDekMsU0FBUywyQkFBMkI7QUFDcEMsU0FBUyw2QkFBNkI7QUFDdEMsU0FBUyxtQkFBbUI7QUFDNUIsU0FBUywwQkFBMEI7QUFDbkMsU0FBUyxxQkFBcUI7QUFDOUIsU0FBUyxnQ0FBNEQ7QUFDckUsU0FBOEUseUJBQXlCO0FBQ3ZHLFNBQVMsMkJBQTZEO0FBQ3RFLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMseUJBQXlCO0FBQ2xDLFNBQThHLG9CQUFvRDtBQUNsSyxTQUFTLHlCQUF5QjtBQUNsQyxTQUEwQiw0QkFBNEI7QUFDdEQsU0FBUyx5QkFBeUI7QUFFbEMsU0FBa0MsZ0JBQXVJLG1CQUErQztBQUN4TixTQUFTLG1CQUFtQjtBQVNyQixNQUFNLG1CQUF3QztBQUFBLEVBVXBELFlBQW1CLFNBQTBCO0FBQTFCO0FBVG5CLFNBQWdCLE9BQU87QUFFdkIsU0FBZ0IsV0FBVyxJQUFJLGdCQUErQjtBQUU5RCxTQUFpQixvQkFBb0IsSUFBSSxRQUFxRDtBQUc5RixTQUFn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
