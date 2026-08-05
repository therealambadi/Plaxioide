import { coalesce, isNonEmptyArray } from "../../../base/common/arrays.js";
import { raceCancellation } from "../../../base/common/async.js";
import { CancellationTokenSource } from "../../../base/common/cancellation.js";
import { toErrorMessage } from "../../../base/common/errorMessage.js";
import { Emitter } from "../../../base/common/event.js";
import { Iterable } from "../../../base/common/iterator.js";
import { Disposable, DisposableMap, DisposableStore, toDisposable } from "../../../base/common/lifecycle.js";
import { revive } from "../../../base/common/marshalling.js";
import { StopWatch } from "../../../base/common/stopwatch.js";
import { assertType } from "../../../base/common/types.js";
import { URI } from "../../../base/common/uri.js";
import { generateUuid } from "../../../base/common/uuid.js";
import { ExtensionIdentifier } from "../../../platform/extensions/common/extensions.js";
import { isChatViewTitleActionContext } from "../../contrib/chat/common/chatActions.js";
import { ChatAgentVoteDirection } from "../../contrib/chat/common/chatService.js";
import { ChatAgentLocation } from "../../contrib/chat/common/constants.js";
import { checkProposedApiEnabled, isProposedApiEnabled } from "../../services/extensions/common/extensions.js";
import { MainContext } from "./extHost.protocol.js";
import * as typeConvert from "./extHostTypeConverters.js";
import * as extHostTypes from "./extHostTypes.js";
class ChatAgentResponseStream {
  constructor(_extension, _request, _proxy, _commandsConverter, _sessionDisposables) {
    this._extension = _extension;
    this._request = _request;
    this._proxy = _proxy;
    this._commandsConverter = _commandsConverter;
    this._sessionDisposables = _sessionDisposables;
    this._stopWatch = StopWatch.create(false);
    this._isClosed = false;
  }
  close() {
    this._isClosed = true;
  }
  get timings() {
    return {
      firstProgress: this._firstProgress,
      totalElapsed: this._stopWatch.elapsed()
    };
  }
  get apiObject() {
    if (!this._apiObject) {
      let throwIfDone2 = function(source) {
        if (that._isClosed) {
          const err = new Error("Response stream has been closed");
          Error.captureStackTrace(err, source);
          throw err;
        }
      };
      var throwIfDone = throwIfDone2;
      const that = this;
      this._stopWatch.reset();
      const _report = (progress, task) => {
        if (typeof this._firstProgress === "undefined" && (progress.kind === "markdownContent" || progress.kind === "markdownVuln")) {
          this._firstProgress = this._stopWatch.elapsed();
        }
        if (task) {
          const progressReporterPromise = this._proxy.$handleProgressChunk(this._request.requestId, progress);
          const progressReporter = {
            report: (p) => {
              progressReporterPromise?.then((handle) => {
                if (handle) {
                  if (extHostTypes.MarkdownString.isMarkdownString(p.value)) {
                    this._proxy.$handleProgressChunk(this._request.requestId, typeConvert.ChatResponseWarningPart.from(p), handle);
                  } else {
                    this._proxy.$handleProgressChunk(this._request.requestId, typeConvert.ChatResponseReferencePart.from(p), handle);
                  }
                }
              });
            }
          };
          Promise.all([progressReporterPromise, task?.(progressReporter)]).then(([handle, res]) => {
            if (handle !== void 0) {
              this._proxy.$handleProgressChunk(this._request.requestId, typeConvert.ChatTaskResult.from(res), handle);
            }
          });
        } else {
          this._proxy.$handleProgressChunk(this._request.requestId, progress);
        }
      };
      this._apiObject = Object.freeze({
        markdown(value) {
          throwIfDone2(this.markdown);
          const part = new extHostTypes.ChatResponseMarkdownPart(value);
          const dto = typeConvert.ChatResponseMarkdownPart.from(part);
          _report(dto);
          return this;
        },
        markdownWithVulnerabilities(value, vulnerabilities) {
          throwIfDone2(this.markdown);
          if (vulnerabilities) {
            checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          }
          const part = new extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart(value, vulnerabilities);
          const dto = typeConvert.ChatResponseMarkdownWithVulnerabilitiesPart.from(part);
          _report(dto);
          return this;
        },
        codeblockUri(value, isEdit) {
          throwIfDone2(this.codeblockUri);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseCodeblockUriPart(value, isEdit);
          const dto = typeConvert.ChatResponseCodeblockUriPart.from(part);
          _report(dto);
          return this;
        },
        filetree(value, baseUri) {
          throwIfDone2(this.filetree);
          const part = new extHostTypes.ChatResponseFileTreePart(value, baseUri);
          const dto = typeConvert.ChatResponseFilesPart.from(part);
          _report(dto);
          return this;
        },
        anchor(value, title) {
          const part = new extHostTypes.ChatResponseAnchorPart(value, title);
          return this.push(part);
        },
        button(value) {
          throwIfDone2(this.anchor);
          const part = new extHostTypes.ChatResponseCommandButtonPart(value);
          const dto = typeConvert.ChatResponseCommandButtonPart.from(part, that._commandsConverter, that._sessionDisposables);
          _report(dto);
          return this;
        },
        progress(value, task) {
          throwIfDone2(this.progress);
          const part = new extHostTypes.ChatResponseProgressPart2(value, task);
          const dto = task ? typeConvert.ChatTask.from(part) : typeConvert.ChatResponseProgressPart.from(part);
          _report(dto, task);
          return this;
        },
        warning(value) {
          throwIfDone2(this.progress);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseWarningPart(value);
          const dto = typeConvert.ChatResponseWarningPart.from(part);
          _report(dto);
          return this;
        },
        reference(value, iconPath) {
          return this.reference2(value, iconPath);
        },
        reference2(value, iconPath, options) {
          throwIfDone2(this.reference);
          if (typeof value === "object" && "variableName" in value) {
            checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          }
          if (typeof value === "object" && "variableName" in value && !value.value) {
            const matchingVarData = that._request.variables.variables.find((v) => v.name === value.variableName);
            if (matchingVarData) {
              let references;
              if (matchingVarData.references?.length) {
                references = matchingVarData.references.map((r) => ({
                  kind: "reference",
                  reference: { variableName: value.variableName, value: r.reference }
                }));
              } else {
                const part = new extHostTypes.ChatResponseReferencePart(value, iconPath, options);
                const dto = typeConvert.ChatResponseReferencePart.from(part);
                references = [dto];
              }
              references.forEach((r) => _report(r));
              return this;
            } else {
            }
          } else {
            const part = new extHostTypes.ChatResponseReferencePart(value, iconPath, options);
            const dto = typeConvert.ChatResponseReferencePart.from(part);
            _report(dto);
          }
          return this;
        },
        codeCitation(value, license, snippet) {
          throwIfDone2(this.codeCitation);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseCodeCitationPart(value, license, snippet);
          const dto = typeConvert.ChatResponseCodeCitationPart.from(part);
          _report(dto);
        },
        textEdit(target, edits) {
          throwIfDone2(this.textEdit);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseTextEditPart(target, edits);
          part.isDone = edits === true ? true : void 0;
          const dto = typeConvert.ChatResponseTextEditPart.from(part);
          _report(dto);
          return this;
        },
        notebookEdit(target, edits) {
          throwIfDone2(this.notebookEdit);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseNotebookEditPart(target, edits);
          const dto = typeConvert.ChatResponseNotebookEditPart.from(part);
          _report(dto);
          return this;
        },
        confirmation(title, message, data, buttons) {
          throwIfDone2(this.confirmation);
          checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          const part = new extHostTypes.ChatResponseConfirmationPart(title, message, data, buttons);
          const dto = typeConvert.ChatResponseConfirmationPart.from(part);
          _report(dto);
          return this;
        },
        push(part) {
          throwIfDone2(this.push);
          if (part instanceof extHostTypes.ChatResponseTextEditPart || part instanceof extHostTypes.ChatResponseNotebookEditPart || part instanceof extHostTypes.ChatResponseMarkdownWithVulnerabilitiesPart || part instanceof extHostTypes.ChatResponseWarningPart || part instanceof extHostTypes.ChatResponseConfirmationPart || part instanceof extHostTypes.ChatResponseCodeCitationPart || part instanceof extHostTypes.ChatResponseMovePart || part instanceof extHostTypes.ChatResponseProgressPart2) {
            checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
          }
          if (part instanceof extHostTypes.ChatResponseReferencePart) {
            this.reference2(part.value, part.iconPath, part.options);
          } else if (part instanceof extHostTypes.ChatResponseProgressPart2) {
            const dto = part.task ? typeConvert.ChatTask.from(part) : typeConvert.ChatResponseProgressPart.from(part);
            _report(dto, part.task);
          } else if (part instanceof extHostTypes.ChatResponseAnchorPart) {
            const dto = typeConvert.ChatResponseAnchorPart.from(part);
            if (part.resolve) {
              checkProposedApiEnabled(that._extension, "chatParticipantAdditions");
              dto.resolveId = generateUuid();
              const cts = new CancellationTokenSource();
              part.resolve(cts.token).then(() => {
                const resolvedDto = typeConvert.ChatResponseAnchorPart.from(part);
                that._proxy.$handleAnchorResolve(that._request.requestId, dto.resolveId, resolvedDto);
              }).then(() => cts.dispose(), () => cts.dispose());
              that._sessionDisposables.add(toDisposable(() => cts.dispose(true)));
            }
            _report(dto);
          } else {
            const dto = typeConvert.ChatResponsePart.from(part, that._commandsConverter, that._sessionDisposables);
            _report(dto);
          }
          return this;
        }
      });
    }
    return this._apiObject;
  }
}
const _ExtHostChatAgents2 = class _ExtHostChatAgents2 extends Disposable {
  constructor(mainContext, _logService, _commands, _documents, _languageModels, _diagnostics, _tools) {
    super();
    this._logService = _logService;
    this._commands = _commands;
    this._documents = _documents;
    this._languageModels = _languageModels;
    this._diagnostics = _diagnostics;
    this._tools = _tools;
    this._agents = /* @__PURE__ */ new Map();
    this._participantDetectionProviders = /* @__PURE__ */ new Map();
    this._relatedFilesProviders = /* @__PURE__ */ new Map();
    this._sessionDisposables = this._register(new DisposableMap());
    this._completionDisposables = this._register(new DisposableMap());
    this._inFlightRequests = /* @__PURE__ */ new Set();
    this._onDidDisposeChatSession = this._register(new Emitter());
    this.onDidDisposeChatSession = this._onDidDisposeChatSession.event;
    this._proxy = mainContext.getProxy(MainContext.MainThreadChatAgents2);
    _commands.registerArgumentProcessor({
      processArgument: (arg) => {
        if (isChatViewTitleActionContext(arg)) {
          return null;
        }
        return arg;
      }
    });
  }
  transferActiveChat(newWorkspace) {
    this._proxy.$transferActiveChatSession(newWorkspace);
  }
  createChatAgent(extension, id, handler) {
    const handle = _ExtHostChatAgents2._idPool++;
    const agent = new ExtHostChatAgent(extension, id, this._proxy, handle, handler);
    this._agents.set(handle, agent);
    this._proxy.$registerAgent(handle, extension.identifier, id, {}, void 0);
    return agent.apiAgent;
  }
  createDynamicChatAgent(extension, id, dynamicProps, handler) {
    const handle = _ExtHostChatAgents2._idPool++;
    const agent = new ExtHostChatAgent(extension, id, this._proxy, handle, handler);
    this._agents.set(handle, agent);
    this._proxy.$registerAgent(handle, extension.identifier, id, { isSticky: true }, dynamicProps);
    return agent.apiAgent;
  }
  registerChatParticipantDetectionProvider(extension, provider) {
    const handle = _ExtHostChatAgents2._participantDetectionProviderIdPool++;
    this._participantDetectionProviders.set(handle, new ExtHostParticipantDetector(extension, provider));
    this._proxy.$registerChatParticipantDetectionProvider(handle);
    return toDisposable(() => {
      this._participantDetectionProviders.delete(handle);
      this._proxy.$unregisterChatParticipantDetectionProvider(handle);
    });
  }
  registerRelatedFilesProvider(extension, provider, metadata) {
    const handle = _ExtHostChatAgents2._relatedFilesProviderIdPool++;
    this._relatedFilesProviders.set(handle, new ExtHostRelatedFilesProvider(extension, provider));
    this._proxy.$registerRelatedFilesProvider(handle, metadata);
    return toDisposable(() => {
      this._relatedFilesProviders.delete(handle);
      this._proxy.$unregisterRelatedFilesProvider(handle);
    });
  }
  async $provideRelatedFiles(handle, request, token) {
    const provider = this._relatedFilesProviders.get(handle);
    if (!provider) {
      return Promise.resolve([]);
    }
    const extRequestDraft = typeConvert.ChatRequestDraft.to(request);
    return await provider.provider.provideRelatedFiles(extRequestDraft, token) ?? void 0;
  }
  async $detectChatParticipant(handle, requestDto, context, options, token) {
    const detector = this._participantDetectionProviders.get(handle);
    if (!detector) {
      return void 0;
    }
    const { request, location, history } = await this._createRequest(requestDto, context, detector.extension);
    const model = await this.getModelForRequest(request, detector.extension);
    const includeInteractionId = isProposedApiEnabled(detector.extension, "chatParticipantPrivate");
    const extRequest = typeConvert.ChatAgentRequest.to(includeInteractionId ? request : { ...request, requestId: "" }, location, model, this.getDiagnosticsWhenEnabled(detector.extension), this.getToolsForRequest(detector.extension, request));
    return detector.provider.provideParticipantDetection(
      extRequest,
      { history },
      { participants: options.participants, location: typeConvert.ChatLocation.to(options.location) },
      token
    );
  }
  async _createRequest(requestDto, context, extension) {
    const request = revive(requestDto);
    const convertedHistory = await this.prepareHistoryTurns(extension, request.agentId, context);
    let location;
    if (request.locationData?.type === ChatAgentLocation.Editor) {
      const document = this._documents.getDocument(request.locationData.document);
      location = new extHostTypes.ChatRequestEditorData(document, typeConvert.Selection.to(request.locationData.selection), typeConvert.Range.to(request.locationData.wholeRange));
    } else if (request.locationData?.type === ChatAgentLocation.Notebook) {
      const cell = this._documents.getDocument(request.locationData.sessionInputUri);
      location = new extHostTypes.ChatRequestNotebookData(cell);
    } else if (request.locationData?.type === ChatAgentLocation.Terminal) {
    }
    return { request, location, history: convertedHistory };
  }
  async getModelForRequest(request, extension) {
    let model;
    if (request.userSelectedModelId) {
      model = await this._languageModels.getLanguageModelByIdentifier(extension, request.userSelectedModelId);
    }
    if (!model) {
      model = await this._languageModels.getDefaultLanguageModel(extension);
      if (!model) {
        throw new Error("Language model unavailable");
      }
    }
    return model;
  }
  async $setRequestPaused(handle, requestId, isPaused) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return;
    }
    const inFlight = Iterable.find(this._inFlightRequests, (r) => r.requestId === requestId);
    if (!inFlight) {
      return;
    }
    agent.setChatRequestPauseState({ request: inFlight.extRequest, isPaused });
  }
  async $invokeAgent(handle, requestDto, context, token) {
    const agent = this._agents.get(handle);
    if (!agent) {
      throw new Error(`[CHAT](${handle}) CANNOT invoke agent because the agent is not registered`);
    }
    let stream;
    let inFlightRequest;
    try {
      const { request, location, history } = await this._createRequest(requestDto, context, agent.extension);
      let sessionDisposables = this._sessionDisposables.get(request.sessionId);
      if (!sessionDisposables) {
        sessionDisposables = new DisposableStore();
        this._sessionDisposables.set(request.sessionId, sessionDisposables);
      }
      stream = new ChatAgentResponseStream(agent.extension, request, this._proxy, this._commands.converter, sessionDisposables);
      const model = await this.getModelForRequest(request, agent.extension);
      const includeInteractionId = isProposedApiEnabled(agent.extension, "chatParticipantPrivate");
      const extRequest = typeConvert.ChatAgentRequest.to(
        includeInteractionId ? request : { ...request, requestId: "" },
        location,
        model,
        this.getDiagnosticsWhenEnabled(agent.extension),
        this.getToolsForRequest(agent.extension, request)
      );
      inFlightRequest = { requestId: requestDto.requestId, extRequest };
      this._inFlightRequests.add(inFlightRequest);
      const task = agent.invoke(
        extRequest,
        { history },
        stream.apiObject,
        token
      );
      return await raceCancellation(Promise.resolve(task).then((result) => {
        if (result?.metadata) {
          try {
            JSON.stringify(result.metadata);
          } catch (err) {
            const msg = `result.metadata MUST be JSON.stringify-able. Got error: ${err.message}`;
            this._logService.error(`[${agent.extension.identifier.value}] [@${agent.id}] ${msg}`, agent.extension);
            return { errorDetails: { message: msg }, timings: stream?.timings, nextQuestion: result.nextQuestion };
          }
        }
        let errorDetails;
        if (result?.errorDetails) {
          errorDetails = {
            ...result.errorDetails,
            responseIsIncomplete: true
          };
        }
        if (errorDetails?.responseIsRedacted || errorDetails?.isQuotaExceeded) {
          checkProposedApiEnabled(agent.extension, "chatParticipantPrivate");
        }
        return { errorDetails, timings: stream?.timings, metadata: result?.metadata, nextQuestion: result?.nextQuestion };
      }), token);
    } catch (e) {
      this._logService.error(e, agent.extension);
      if (e instanceof extHostTypes.LanguageModelError && e.cause) {
        e = e.cause;
      }
      const isQuotaExceeded = e instanceof Error && e.name === "ChatQuotaExceeded";
      return { errorDetails: { message: toErrorMessage(e), responseIsIncomplete: true, isQuotaExceeded } };
    } finally {
      if (inFlightRequest) {
        this._inFlightRequests.delete(inFlightRequest);
      }
      stream?.close();
    }
  }
  getDiagnosticsWhenEnabled(extension) {
    if (!isProposedApiEnabled(extension, "chatReferenceDiagnostic")) {
      return [];
    }
    return this._diagnostics.getDiagnostics();
  }
  getToolsForRequest(extension, request) {
    if (!isNonEmptyArray(request.userSelectedTools)) {
      return void 0;
    }
    const selector = new Set(request.userSelectedTools);
    return this._tools.getTools(extension).filter((candidate) => selector.has(candidate.name));
  }
  async prepareHistoryTurns(extension, agentId, context) {
    const res = [];
    for (const h of context.history) {
      const ehResult = typeConvert.ChatAgentResult.to(h.result);
      const result = agentId === h.request.agentId ? ehResult : { ...ehResult, metadata: void 0 };
      const varsWithoutTools = h.request.variables.variables.filter((v) => !v.isTool).map((v) => typeConvert.ChatPromptReference.to(v, this.getDiagnosticsWhenEnabled(extension)));
      const toolReferences = h.request.variables.variables.filter((v) => v.isTool).map(typeConvert.ChatLanguageModelToolReference.to);
      const turn = new extHostTypes.ChatRequestTurn(h.request.message, h.request.command, varsWithoutTools, h.request.agentId, toolReferences);
      res.push(turn);
      const parts = coalesce(h.response.map((r) => typeConvert.ChatResponsePart.toContent(r, this._commands.converter)));
      res.push(new extHostTypes.ChatResponseTurn(parts, result, h.request.agentId, h.request.command));
    }
    return res;
  }
  $releaseSession(sessionId) {
    this._sessionDisposables.deleteAndDispose(sessionId);
    this._onDidDisposeChatSession.fire(sessionId);
  }
  async $provideFollowups(requestDto, handle, result, context, token) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return Promise.resolve([]);
    }
    const request = revive(requestDto);
    const convertedHistory = await this.prepareHistoryTurns(agent.extension, agent.id, context);
    const ehResult = typeConvert.ChatAgentResult.to(result);
    return (await agent.provideFollowups(ehResult, { history: convertedHistory }, token)).filter((f) => {
      const isValid = !f.participant || Iterable.some(
        this._agents.values(),
        (a) => a.id === f.participant && ExtensionIdentifier.equals(a.extension.identifier, agent.extension.identifier)
      );
      if (!isValid) {
        this._logService.warn(`[@${agent.id}] ChatFollowup refers to an unknown participant: ${f.participant}`);
      }
      return isValid;
    }).map((f) => typeConvert.ChatFollowup.from(f, request));
  }
  $acceptFeedback(handle, result, voteAction) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return;
    }
    const ehResult = typeConvert.ChatAgentResult.to(result);
    let kind;
    switch (voteAction.direction) {
      case ChatAgentVoteDirection.Down:
        kind = extHostTypes.ChatResultFeedbackKind.Unhelpful;
        break;
      case ChatAgentVoteDirection.Up:
        kind = extHostTypes.ChatResultFeedbackKind.Helpful;
        break;
    }
    const feedback = {
      result: ehResult,
      kind,
      unhelpfulReason: isProposedApiEnabled(agent.extension, "chatParticipantAdditions") ? voteAction.reason : void 0
    };
    agent.acceptFeedback(Object.freeze(feedback));
  }
  $acceptAction(handle, result, event) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return;
    }
    if (event.action.kind === "vote") {
      return;
    }
    const ehAction = typeConvert.ChatAgentUserActionEvent.to(result, event, this._commands.converter);
    if (ehAction) {
      agent.acceptAction(Object.freeze(ehAction));
    }
  }
  async $invokeCompletionProvider(handle, query, token) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return [];
    }
    let disposables = this._completionDisposables.get(handle);
    if (disposables) {
      disposables.clear();
    } else {
      disposables = new DisposableStore();
      this._completionDisposables.set(handle, disposables);
    }
    const items = await agent.invokeCompletionProvider(query, token);
    return items.map((i) => typeConvert.ChatAgentCompletionItem.from(i, this._commands.converter, disposables));
  }
  async $provideChatTitle(handle, context, token) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return;
    }
    const history = await this.prepareHistoryTurns(agent.extension, agent.id, { history: context });
    return await agent.provideTitle({ history }, token);
  }
  async $provideSampleQuestions(handle, location, token) {
    const agent = this._agents.get(handle);
    if (!agent) {
      return;
    }
    return (await agent.provideSampleQuestions(typeConvert.ChatLocation.to(location), token)).map((f) => typeConvert.ChatFollowup.from(f, void 0));
  }
};
_ExtHostChatAgents2._idPool = 0;
_ExtHostChatAgents2._participantDetectionProviderIdPool = 0;
_ExtHostChatAgents2._relatedFilesProviderIdPool = 0;
let ExtHostChatAgents2 = _ExtHostChatAgents2;
class ExtHostParticipantDetector {
  constructor(extension, provider) {
    this.extension = extension;
    this.provider = provider;
  }
}
class ExtHostRelatedFilesProvider {
  constructor(extension, provider) {
    this.extension = extension;
    this.provider = provider;
  }
}
class ExtHostChatAgent {
  constructor(extension, id, _proxy, _handle, _requestHandler) {
    this.extension = extension;
    this.id = id;
    this._proxy = _proxy;
    this._handle = _handle;
    this._requestHandler = _requestHandler;
    this._onDidReceiveFeedback = new Emitter();
    this._onDidPerformAction = new Emitter();
    this._pauseStateEmitter = new Emitter();
  }
  acceptFeedback(feedback) {
    this._onDidReceiveFeedback.fire(feedback);
  }
  acceptAction(event) {
    this._onDidPerformAction.fire(event);
  }
  setChatRequestPauseState(pauseState) {
    this._pauseStateEmitter.fire(pauseState);
  }
  async invokeCompletionProvider(query, token) {
    if (!this._agentVariableProvider) {
      return [];
    }
    return await this._agentVariableProvider.provider.provideCompletionItems(query, token) ?? [];
  }
  async provideFollowups(result, context, token) {
    if (!this._followupProvider) {
      return [];
    }
    const followups = await this._followupProvider.provideFollowups(result, context, token);
    if (!followups) {
      return [];
    }
    return followups.filter((f) => !(f && "commandId" in f)).filter((f) => !(f && "message" in f));
  }
  async provideTitle(context, token) {
    if (!this._titleProvider) {
      return;
    }
    return await this._titleProvider.provideChatTitle(context, token) ?? void 0;
  }
  async provideSampleQuestions(location, token) {
    if (!this._welcomeMessageProvider || !this._welcomeMessageProvider.provideSampleQuestions) {
      return [];
    }
    const content = await this._welcomeMessageProvider.provideSampleQuestions(location, token);
    if (!content) {
      return [];
    }
    return content;
  }
  get apiAgent() {
    let disposed = false;
    let updateScheduled = false;
    const updateMetadataSoon = () => {
      if (disposed) {
        return;
      }
      if (updateScheduled) {
        return;
      }
      updateScheduled = true;
      queueMicrotask(() => {
        this._proxy.$updateAgent(this._handle, {
          icon: !this._iconPath ? void 0 : this._iconPath instanceof URI ? this._iconPath : "light" in this._iconPath ? this._iconPath.light : void 0,
          iconDark: !this._iconPath ? void 0 : "dark" in this._iconPath ? this._iconPath.dark : void 0,
          themeIcon: this._iconPath instanceof extHostTypes.ThemeIcon ? this._iconPath : void 0,
          hasFollowups: this._followupProvider !== void 0,
          helpTextPrefix: !this._helpTextPrefix || typeof this._helpTextPrefix === "string" ? this._helpTextPrefix : typeConvert.MarkdownString.from(this._helpTextPrefix),
          helpTextVariablesPrefix: !this._helpTextVariablesPrefix || typeof this._helpTextVariablesPrefix === "string" ? this._helpTextVariablesPrefix : typeConvert.MarkdownString.from(this._helpTextVariablesPrefix),
          helpTextPostfix: !this._helpTextPostfix || typeof this._helpTextPostfix === "string" ? this._helpTextPostfix : typeConvert.MarkdownString.from(this._helpTextPostfix),
          supportIssueReporting: this._supportIssueReporting,
          requester: this._requester,
          welcomeMessageContent: this._welcomeMessageContent && {
            ...this._welcomeMessageContent,
            message: typeConvert.MarkdownString.from(this._welcomeMessageContent.message)
          }
        });
        updateScheduled = false;
      });
    };
    const that = this;
    return {
      get id() {
        return that.id;
      },
      get iconPath() {
        return that._iconPath;
      },
      set iconPath(v) {
        that._iconPath = v;
        updateMetadataSoon();
      },
      get requestHandler() {
        return that._requestHandler;
      },
      set requestHandler(v) {
        assertType(typeof v === "function", "Invalid request handler");
        that._requestHandler = v;
      },
      get followupProvider() {
        return that._followupProvider;
      },
      set followupProvider(v) {
        that._followupProvider = v;
        updateMetadataSoon();
      },
      get helpTextPrefix() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._helpTextPrefix;
      },
      set helpTextPrefix(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._helpTextPrefix = v;
        updateMetadataSoon();
      },
      get helpTextVariablesPrefix() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._helpTextVariablesPrefix;
      },
      set helpTextVariablesPrefix(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._helpTextVariablesPrefix = v;
        updateMetadataSoon();
      },
      get helpTextPostfix() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._helpTextPostfix;
      },
      set helpTextPostfix(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._helpTextPostfix = v;
        updateMetadataSoon();
      },
      get supportIssueReporting() {
        checkProposedApiEnabled(that.extension, "chatParticipantPrivate");
        return that._supportIssueReporting;
      },
      set supportIssueReporting(v) {
        checkProposedApiEnabled(that.extension, "chatParticipantPrivate");
        that._supportIssueReporting = v;
        updateMetadataSoon();
      },
      get onDidReceiveFeedback() {
        return that._onDidReceiveFeedback.event;
      },
      set participantVariableProvider(v) {
        checkProposedApiEnabled(that.extension, "chatParticipantAdditions");
        that._agentVariableProvider = v;
        if (v) {
          if (!v.triggerCharacters.length) {
            throw new Error("triggerCharacters are required");
          }
          that._proxy.$registerAgentCompletionsProvider(that._handle, that.id, v.triggerCharacters);
        } else {
          that._proxy.$unregisterAgentCompletionsProvider(that._handle, that.id);
        }
      },
      get participantVariableProvider() {
        checkProposedApiEnabled(that.extension, "chatParticipantAdditions");
        return that._agentVariableProvider;
      },
      set welcomeMessageProvider(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._welcomeMessageProvider = v;
        updateMetadataSoon();
      },
      get welcomeMessageProvider() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._welcomeMessageProvider;
      },
      set welcomeMessageContent(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._welcomeMessageContent = v;
        updateMetadataSoon();
      },
      get welcomeMessageContent() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._welcomeMessageContent;
      },
      set titleProvider(v) {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        that._titleProvider = v;
        updateMetadataSoon();
      },
      get titleProvider() {
        checkProposedApiEnabled(that.extension, "defaultChatParticipant");
        return that._titleProvider;
      },
      get onDidChangePauseState() {
        checkProposedApiEnabled(that.extension, "chatParticipantAdditions");
        return that._pauseStateEmitter.event;
      },
      onDidPerformAction: !isProposedApiEnabled(this.extension, "chatParticipantAdditions") ? void 0 : this._onDidPerformAction.event,
      set requester(v) {
        that._requester = v;
        updateMetadataSoon();
      },
      get requester() {
        return that._requester;
      },
      dispose() {
        disposed = true;
        that._followupProvider = void 0;
        that._onDidReceiveFeedback.dispose();
        that._proxy.$unregisterAgent(that._handle);
      }
    };
  }
  invoke(request, context, response, token) {
    return this._requestHandler(request, context, response, token);
  }
}
export {
  ExtHostChatAgents2
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2NvbW1vbi9leHRIb3N0Q2hhdEFnZW50czIudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgdHlwZSAqIGFzIHZzY29kZSBmcm9tICd2c2NvZGUnO1xuaW1wb3J0IHsgY29hbGVzY2UsIGlzTm9uRW1wdHlBcnJheSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FycmF5cy5qcyc7XG5pbXBvcnQgeyByYWNlQ2FuY2VsbGF0aW9uIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IHRvRXJyb3JNZXNzYWdlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vZXJyb3JNZXNzYWdlLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJdGVyYWJsZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2l0ZXJhdG9yLmpzJztcbmltcG9ydCB7IERpc3Bvc2FibGUsIERpc3Bvc2FibGVNYXAsIERpc3Bvc2FibGVTdG9yZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IHJldml2ZSB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL21hcnNoYWxsaW5nLmpzJztcbmltcG9ydCB7IFN0b3BXYXRjaCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3N0b3B3YXRjaC5qcyc7XG5pbXBvcnQgeyBhc3NlcnRUeXBlIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdHlwZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgTG9jYXRpb24gfSBmcm9tICcuLi8uLi8uLi9lZGl0b3IvY29tbW9uL2xhbmd1YWdlcy5qcyc7XG5pbXBvcnQgeyBFeHRlbnNpb25JZGVudGlmaWVyLCBJRXh0ZW5zaW9uRGVzY3JpcHRpb24sIElSZWxheGVkRXh0ZW5zaW9uRGVzY3JpcHRpb24gfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgaXNDaGF0Vmlld1RpdGxlQWN0aW9uQ29udGV4dCB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vY2hhdEFjdGlvbnMuanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFJlcXVlc3QsIElDaGF0QWdlbnRSZXN1bHQsIElDaGF0QWdlbnRSZXN1bHRUaW1pbmdzIH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0QWdlbnRzLmpzJztcbmltcG9ydCB7IElDaGF0UmVsYXRlZEZpbGUsIElDaGF0UmVxdWVzdERyYWZ0IH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdEFnZW50Vm90ZURpcmVjdGlvbiwgSUNoYXRDb250ZW50UmVmZXJlbmNlLCBJQ2hhdEZvbGxvd3VwLCBJQ2hhdFJlc3BvbnNlRXJyb3JEZXRhaWxzLCBJQ2hhdFVzZXJBY3Rpb25FdmVudCwgSUNoYXRWb3RlQWN0aW9uIH0gZnJvbSAnLi4vLi4vY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBDaGF0QWdlbnRMb2NhdGlvbiB9IGZyb20gJy4uLy4uL2NvbnRyaWIvY2hhdC9jb21tb24vY29uc3RhbnRzLmpzJztcbmltcG9ydCB7IGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkLCBpc1Byb3Bvc2VkQXBpRW5hYmxlZCB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgRHRvIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvZXh0ZW5zaW9ucy9jb21tb24vcHJveHlJZGVudGlmaWVyLmpzJztcbmltcG9ydCB7IEV4dEhvc3RDaGF0QWdlbnRzU2hhcGUyLCBJQ2hhdEFnZW50Q29tcGxldGlvbkl0ZW0sIElDaGF0QWdlbnRIaXN0b3J5RW50cnlEdG8sIElDaGF0UHJvZ3Jlc3NEdG8sIElFeHRlbnNpb25DaGF0QWdlbnRNZXRhZGF0YSwgSU1haW5Db250ZXh0LCBNYWluQ29udGV4dCwgTWFpblRocmVhZENoYXRBZ2VudHNTaGFwZTIgfSBmcm9tICcuL2V4dEhvc3QucHJvdG9jb2wuanMnO1xuaW1wb3J0IHsgQ29tbWFuZHNDb252ZXJ0ZXIsIEV4dEhvc3RDb21tYW5kcyB9IGZyb20gJy4vZXh0SG9zdENvbW1hbmRzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REaWFnbm9zdGljcyB9IGZyb20gJy4vZXh0SG9zdERpYWdub3N0aWNzLmpzJztcbmltcG9ydCB7IEV4dEhvc3REb2N1bWVudHMgfSBmcm9tICcuL2V4dEhvc3REb2N1bWVudHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhbmd1YWdlTW9kZWxzIH0gZnJvbSAnLi9leHRIb3N0TGFuZ3VhZ2VNb2RlbHMuanMnO1xuaW1wb3J0IHsgRXh0SG9zdExhbmd1YWdlTW9kZWxUb29scyB9IGZyb20gJy4vZXh0SG9zdExhbmd1YWdlTW9kZWxUb29scy5qcyc7XG5pbXBvcnQgKiBhcyB0eXBlQ29udmVydCBmcm9tICcuL2V4dEhvc3RUeXBlQ29udmVydGVycy5qcyc7XG5pbXBvcnQgKiBhcyBleHRIb3N0VHlwZXMgZnJvbSAnLi9leHRIb3N0VHlwZXMuanMnO1xuXG5jbGFzcyBDaGF0QWdlbnRSZXNwb25zZVN0cmVhbSB7XG5cblx0cHJpdmF0ZSBfc3RvcFdhdGNoID0gU3RvcFdhdGNoLmNyZWF0ZShmYWxzZSk7XG5cdHByaXZhdGUgX2lzQ2xvc2VkOiBib29sZWFuID0gZmFsc2U7XG5cdHByaXZhdGUgX2ZpcnN0UHJvZ3Jlc3M6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfYXBpT2JqZWN0OiB2c2NvZGUuQ2hhdFJlc3BvbnNlU3RyZWFtIHwgdW5kZWZpbmVkO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2V4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3JlcXVlc3Q6IElDaGF0QWdlbnRSZXF1ZXN0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX3Byb3h5OiBNYWluVGhyZWFkQ2hhdEFnZW50c1NoYXBlMixcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jb21tYW5kc0NvbnZlcnRlcjogQ29tbWFuZHNDb252ZXJ0ZXIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfc2Vzc2lvbkRpc3Bvc2FibGVzOiBEaXNwb3NhYmxlU3RvcmVcblx0KSB7IH1cblxuXHRjbG9zZSgpIHtcblx0XHR0aGlzLl9pc0Nsb3NlZCA9IHRydWU7XG5cdH1cblxuXHRnZXQgdGltaW5ncygpOiBJQ2hhdEFnZW50UmVzdWx0VGltaW5ncyB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGZpcnN0UHJvZ3Jlc3M6IHRoaXMuX2ZpcnN0UHJvZ3Jlc3MsXG5cdFx0XHR0b3RhbEVsYXBzZWQ6IHRoaXMuX3N0b3BXYXRjaC5lbGFwc2VkKClcblx0XHR9O1xuXHR9XG5cblx0Z2V0IGFwaU9iamVjdCgpIHtcblxuXHRcdGlmICghdGhpcy5fYXBpT2JqZWN0KSB7XG5cblx0XHRcdGNvbnN0IHRoYXQgPSB0aGlzO1xuXHRcdFx0dGhpcy5fc3RvcFdhdGNoLnJlc2V0KCk7XG5cblx0XHRcdGZ1bmN0aW9uIHRocm93SWZEb25lKHNvdXJjZTogRnVuY3Rpb24gfCB1bmRlZmluZWQpIHtcblx0XHRcdFx0aWYgKHRoYXQuX2lzQ2xvc2VkKSB7XG5cdFx0XHRcdFx0Y29uc3QgZXJyID0gbmV3IEVycm9yKCdSZXNwb25zZSBzdHJlYW0gaGFzIGJlZW4gY2xvc2VkJyk7XG5cdFx0XHRcdFx0RXJyb3IuY2FwdHVyZVN0YWNrVHJhY2UoZXJyLCBzb3VyY2UpO1xuXHRcdFx0XHRcdHRocm93IGVycjtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRjb25zdCBfcmVwb3J0ID0gKHByb2dyZXNzOiBJQ2hhdFByb2dyZXNzRHRvLCB0YXNrPzogKHByb2dyZXNzOiB2c2NvZGUuUHJvZ3Jlc3M8dnNjb2RlLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IHwgdnNjb2RlLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQ+KSA9PiBUaGVuYWJsZTxzdHJpbmcgfCB2b2lkPikgPT4ge1xuXHRcdFx0XHQvLyBNZWFzdXJlIHRoZSB0aW1lIHRvIHRoZSBmaXJzdCBwcm9ncmVzcyB1cGRhdGUgd2l0aCByZWFsIG1hcmtkb3duIGNvbnRlbnRcblx0XHRcdFx0aWYgKHR5cGVvZiB0aGlzLl9maXJzdFByb2dyZXNzID09PSAndW5kZWZpbmVkJyAmJiAocHJvZ3Jlc3Mua2luZCA9PT0gJ21hcmtkb3duQ29udGVudCcgfHwgcHJvZ3Jlc3Mua2luZCA9PT0gJ21hcmtkb3duVnVsbicpKSB7XG5cdFx0XHRcdFx0dGhpcy5fZmlyc3RQcm9ncmVzcyA9IHRoaXMuX3N0b3BXYXRjaC5lbGFwc2VkKCk7XG5cdFx0XHRcdH1cblxuXHRcdFx0XHRpZiAodGFzaykge1xuXHRcdFx0XHRcdGNvbnN0IHByb2dyZXNzUmVwb3J0ZXJQcm9taXNlID0gdGhpcy5fcHJveHkuJGhhbmRsZVByb2dyZXNzQ2h1bmsodGhpcy5fcmVxdWVzdC5yZXF1ZXN0SWQsIHByb2dyZXNzKTtcblx0XHRcdFx0XHRjb25zdCBwcm9ncmVzc1JlcG9ydGVyID0ge1xuXHRcdFx0XHRcdFx0cmVwb3J0OiAocDogdnNjb2RlLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IHwgdnNjb2RlLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQpID0+IHtcblx0XHRcdFx0XHRcdFx0cHJvZ3Jlc3NSZXBvcnRlclByb21pc2U/LnRoZW4oKGhhbmRsZSkgPT4ge1xuXHRcdFx0XHRcdFx0XHRcdGlmIChoYW5kbGUpIHtcblx0XHRcdFx0XHRcdFx0XHRcdGlmIChleHRIb3N0VHlwZXMuTWFya2Rvd25TdHJpbmcuaXNNYXJrZG93blN0cmluZyhwLnZhbHVlKSkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHR0aGlzLl9wcm94eS4kaGFuZGxlUHJvZ3Jlc3NDaHVuayh0aGlzLl9yZXF1ZXN0LnJlcXVlc3RJZCwgdHlwZUNvbnZlcnQuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQuZnJvbSg8dnNjb2RlLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0PnApLCBoYW5kbGUpO1xuXHRcdFx0XHRcdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJGhhbmRsZVByb2dyZXNzQ2h1bmsodGhpcy5fcmVxdWVzdC5yZXF1ZXN0SWQsIHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQuZnJvbSg8dnNjb2RlLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQ+cCksIGhhbmRsZSk7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9KTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9O1xuXG5cdFx0XHRcdFx0UHJvbWlzZS5hbGwoW3Byb2dyZXNzUmVwb3J0ZXJQcm9taXNlLCB0YXNrPy4ocHJvZ3Jlc3NSZXBvcnRlcildKS50aGVuKChbaGFuZGxlLCByZXNdKSA9PiB7XG5cdFx0XHRcdFx0XHRpZiAoaGFuZGxlICE9PSB1bmRlZmluZWQpIHtcblx0XHRcdFx0XHRcdFx0dGhpcy5fcHJveHkuJGhhbmRsZVByb2dyZXNzQ2h1bmsodGhpcy5fcmVxdWVzdC5yZXF1ZXN0SWQsIHR5cGVDb252ZXJ0LkNoYXRUYXNrUmVzdWx0LmZyb20ocmVzKSwgaGFuZGxlKTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9KTtcblx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHR0aGlzLl9wcm94eS4kaGFuZGxlUHJvZ3Jlc3NDaHVuayh0aGlzLl9yZXF1ZXN0LnJlcXVlc3RJZCwgcHJvZ3Jlc3MpO1xuXHRcdFx0XHR9XG5cdFx0XHR9O1xuXG5cdFx0XHR0aGlzLl9hcGlPYmplY3QgPSBPYmplY3QuZnJlZXplPHZzY29kZS5DaGF0UmVzcG9uc2VTdHJlYW0+KHtcblx0XHRcdFx0bWFya2Rvd24odmFsdWUpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLm1hcmtkb3duKTtcblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93blBhcnQodmFsdWUpO1xuXHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZU1hcmtkb3duUGFydC5mcm9tKHBhcnQpO1xuXHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0bWFya2Rvd25XaXRoVnVsbmVyYWJpbGl0aWVzKHZhbHVlLCB2dWxuZXJhYmlsaXRpZXMpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLm1hcmtkb3duKTtcblx0XHRcdFx0XHRpZiAodnVsbmVyYWJpbGl0aWVzKSB7XG5cdFx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0Ll9leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0KHZhbHVlLCB2dWxuZXJhYmlsaXRpZXMpO1xuXHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZU1hcmtkb3duV2l0aFZ1bG5lcmFiaWxpdGllc1BhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRfcmVwb3J0KGR0byk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdGNvZGVibG9ja1VyaSh2YWx1ZSwgaXNFZGl0KSB7XG5cdFx0XHRcdFx0dGhyb3dJZkRvbmUodGhpcy5jb2RlYmxvY2tVcmkpO1xuXHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuX2V4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucycpO1xuXHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQodmFsdWUsIGlzRWRpdCk7XG5cdFx0XHRcdFx0Y29uc3QgZHRvID0gdHlwZUNvbnZlcnQuQ2hhdFJlc3BvbnNlQ29kZWJsb2NrVXJpUGFydC5mcm9tKHBhcnQpO1xuXHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0ZmlsZXRyZWUodmFsdWUsIGJhc2VVcmkpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLmZpbGV0cmVlKTtcblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VGaWxlVHJlZVBhcnQodmFsdWUsIGJhc2VVcmkpO1xuXHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZUZpbGVzUGFydC5mcm9tKHBhcnQpO1xuXHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0YW5jaG9yKHZhbHVlLCB0aXRsZT86IHN0cmluZykge1xuXHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUFuY2hvclBhcnQodmFsdWUsIHRpdGxlKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcy5wdXNoKHBhcnQpO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRidXR0b24odmFsdWUpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLmFuY2hvcik7XG5cdFx0XHRcdFx0Y29uc3QgcGFydCA9IG5ldyBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlQ29tbWFuZEJ1dHRvblBhcnQodmFsdWUpO1xuXHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZUNvbW1hbmRCdXR0b25QYXJ0LmZyb20ocGFydCwgdGhhdC5fY29tbWFuZHNDb252ZXJ0ZXIsIHRoYXQuX3Nlc3Npb25EaXNwb3NhYmxlcyk7XG5cdFx0XHRcdFx0X3JlcG9ydChkdG8pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRwcm9ncmVzcyh2YWx1ZSwgdGFzaz86ICgocHJvZ3Jlc3M6IHZzY29kZS5Qcm9ncmVzczx2c2NvZGUuQ2hhdFJlc3BvbnNlV2FybmluZ1BhcnQ+KSA9PiBUaGVuYWJsZTxzdHJpbmcgfCB2b2lkPikpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLnByb2dyZXNzKTtcblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQyKHZhbHVlLCB0YXNrKTtcblx0XHRcdFx0XHRjb25zdCBkdG8gPSB0YXNrID8gdHlwZUNvbnZlcnQuQ2hhdFRhc2suZnJvbShwYXJ0KSA6IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZVByb2dyZXNzUGFydC5mcm9tKHBhcnQpO1xuXHRcdFx0XHRcdF9yZXBvcnQoZHRvLCB0YXNrKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0d2FybmluZyh2YWx1ZSkge1xuXHRcdFx0XHRcdHRocm93SWZEb25lKHRoaXMucHJvZ3Jlc3MpO1xuXHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuX2V4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucycpO1xuXHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0KHZhbHVlKTtcblx0XHRcdFx0XHRjb25zdCBkdG8gPSB0eXBlQ29udmVydC5DaGF0UmVzcG9uc2VXYXJuaW5nUGFydC5mcm9tKHBhcnQpO1xuXHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVmZXJlbmNlKHZhbHVlLCBpY29uUGF0aCkge1xuXHRcdFx0XHRcdHJldHVybiB0aGlzLnJlZmVyZW5jZTIodmFsdWUsIGljb25QYXRoKTtcblx0XHRcdFx0fSxcblx0XHRcdFx0cmVmZXJlbmNlMih2YWx1ZSwgaWNvblBhdGgsIG9wdGlvbnMpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLnJlZmVyZW5jZSk7XG5cblx0XHRcdFx0XHRpZiAodHlwZW9mIHZhbHVlID09PSAnb2JqZWN0JyAmJiAndmFyaWFibGVOYW1lJyBpbiB2YWx1ZSkge1xuXHRcdFx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5fZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJyk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0aWYgKHR5cGVvZiB2YWx1ZSA9PT0gJ29iamVjdCcgJiYgJ3ZhcmlhYmxlTmFtZScgaW4gdmFsdWUgJiYgIXZhbHVlLnZhbHVlKSB7XG5cdFx0XHRcdFx0XHQvLyBUaGUgcGFydGljaXBhbnQgdXNlZCB0aGlzIHZhcmlhYmxlLiBEb2VzIHRoYXQgdmFyaWFibGUgaGF2ZSBhbnkgcmVmZXJlbmNlcyB0byBwdWxsIGluP1xuXHRcdFx0XHRcdFx0Y29uc3QgbWF0Y2hpbmdWYXJEYXRhID0gdGhhdC5fcmVxdWVzdC52YXJpYWJsZXMudmFyaWFibGVzLmZpbmQodiA9PiB2Lm5hbWUgPT09IHZhbHVlLnZhcmlhYmxlTmFtZSk7XG5cdFx0XHRcdFx0XHRpZiAobWF0Y2hpbmdWYXJEYXRhKSB7XG5cdFx0XHRcdFx0XHRcdGxldCByZWZlcmVuY2VzOiBEdG88SUNoYXRDb250ZW50UmVmZXJlbmNlPltdIHwgdW5kZWZpbmVkO1xuXHRcdFx0XHRcdFx0XHRpZiAobWF0Y2hpbmdWYXJEYXRhLnJlZmVyZW5jZXM/Lmxlbmd0aCkge1xuXHRcdFx0XHRcdFx0XHRcdHJlZmVyZW5jZXMgPSBtYXRjaGluZ1ZhckRhdGEucmVmZXJlbmNlcy5tYXAociA9PiAoe1xuXHRcdFx0XHRcdFx0XHRcdFx0a2luZDogJ3JlZmVyZW5jZScsXG5cdFx0XHRcdFx0XHRcdFx0XHRyZWZlcmVuY2U6IHsgdmFyaWFibGVOYW1lOiB2YWx1ZS52YXJpYWJsZU5hbWUsIHZhbHVlOiByLnJlZmVyZW5jZSBhcyBVUkkgfCBMb2NhdGlvbiB9XG5cdFx0XHRcdFx0XHRcdFx0fSBzYXRpc2ZpZXMgSUNoYXRDb250ZW50UmVmZXJlbmNlKSk7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0Ly8gUGFydGljaXBhbnQgc2VudCBhIHZhcmlhYmxlTmFtZSByZWZlcmVuY2UgYnV0IHRoZSB2YXJpYWJsZSBwcm9kdWNlZCBubyByZWZlcmVuY2VzLiBTaG93IHZhcmlhYmxlIHJlZmVyZW5jZSB3aXRoIG5vIHZhbHVlXG5cdFx0XHRcdFx0XHRcdFx0Y29uc3QgcGFydCA9IG5ldyBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlUmVmZXJlbmNlUGFydCh2YWx1ZSwgaWNvblBhdGgsIG9wdGlvbnMpO1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRcdFx0XHRyZWZlcmVuY2VzID0gW2R0b107XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHRyZWZlcmVuY2VzLmZvckVhY2gociA9PiBfcmVwb3J0KHIpKTtcblx0XHRcdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdFx0XHQvLyBTb21ldGhpbmcgd2VudCB3cm9uZy0gdGhhdCB2YXJpYWJsZSBkb2Vzbid0IGFjdHVhbGx5IGV4aXN0XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQodmFsdWUsIGljb25QYXRoLCBvcHRpb25zKTtcblx0XHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZVJlZmVyZW5jZVBhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdFx0Y29kZUNpdGF0aW9uKHZhbHVlOiB2c2NvZGUuVXJpLCBsaWNlbnNlOiBzdHJpbmcsIHNuaXBwZXQ6IHN0cmluZyk6IHZvaWQge1xuXHRcdFx0XHRcdHRocm93SWZEb25lKHRoaXMuY29kZUNpdGF0aW9uKTtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0Ll9leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblxuXHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUNvZGVDaXRhdGlvblBhcnQodmFsdWUsIGxpY2Vuc2UsIHNuaXBwZXQpO1xuXHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZUNvZGVDaXRhdGlvblBhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRfcmVwb3J0KGR0byk7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdHRleHRFZGl0KHRhcmdldCwgZWRpdHMpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLnRleHRFZGl0KTtcblx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0Ll9leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblxuXHRcdFx0XHRcdGNvbnN0IHBhcnQgPSBuZXcgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVRleHRFZGl0UGFydCh0YXJnZXQsIGVkaXRzKTtcblx0XHRcdFx0XHRwYXJ0LmlzRG9uZSA9IGVkaXRzID09PSB0cnVlID8gdHJ1ZSA6IHVuZGVmaW5lZDtcblx0XHRcdFx0XHRjb25zdCBkdG8gPSB0eXBlQ29udmVydC5DaGF0UmVzcG9uc2VUZXh0RWRpdFBhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRfcmVwb3J0KGR0byk7XG5cdFx0XHRcdFx0cmV0dXJuIHRoaXM7XG5cdFx0XHRcdH0sXG5cdFx0XHRcdG5vdGVib29rRWRpdCh0YXJnZXQsIGVkaXRzKSB7XG5cdFx0XHRcdFx0dGhyb3dJZkRvbmUodGhpcy5ub3RlYm9va0VkaXQpO1xuXHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuX2V4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucycpO1xuXG5cdFx0XHRcdFx0Y29uc3QgcGFydCA9IG5ldyBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydCh0YXJnZXQsIGVkaXRzKTtcblx0XHRcdFx0XHRjb25zdCBkdG8gPSB0eXBlQ29udmVydC5DaGF0UmVzcG9uc2VOb3RlYm9va0VkaXRQYXJ0LmZyb20ocGFydCk7XG5cdFx0XHRcdFx0X3JlcG9ydChkdG8pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRjb25maXJtYXRpb24odGl0bGUsIG1lc3NhZ2UsIGRhdGEsIGJ1dHRvbnMpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLmNvbmZpcm1hdGlvbik7XG5cdFx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5fZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJyk7XG5cblx0XHRcdFx0XHRjb25zdCBwYXJ0ID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0KHRpdGxlLCBtZXNzYWdlLCBkYXRhLCBidXR0b25zKTtcblx0XHRcdFx0XHRjb25zdCBkdG8gPSB0eXBlQ29udmVydC5DaGF0UmVzcG9uc2VDb25maXJtYXRpb25QYXJ0LmZyb20ocGFydCk7XG5cdFx0XHRcdFx0X3JlcG9ydChkdG8pO1xuXHRcdFx0XHRcdHJldHVybiB0aGlzO1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRwdXNoKHBhcnQpIHtcblx0XHRcdFx0XHR0aHJvd0lmRG9uZSh0aGlzLnB1c2gpO1xuXG5cdFx0XHRcdFx0aWYgKFxuXHRcdFx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VUZXh0RWRpdFBhcnQgfHxcblx0XHRcdFx0XHRcdHBhcnQgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlTm90ZWJvb2tFZGl0UGFydCB8fFxuXHRcdFx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VNYXJrZG93bldpdGhWdWxuZXJhYmlsaXRpZXNQYXJ0IHx8XG5cdFx0XHRcdFx0XHRwYXJ0IGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZVdhcm5pbmdQYXJ0IHx8XG5cdFx0XHRcdFx0XHRwYXJ0IGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLkNoYXRSZXNwb25zZUNvbmZpcm1hdGlvblBhcnQgfHxcblx0XHRcdFx0XHRcdHBhcnQgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlQ29kZUNpdGF0aW9uUGFydCB8fFxuXHRcdFx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VNb3ZlUGFydCB8fFxuXHRcdFx0XHRcdFx0cGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQyXG5cdFx0XHRcdFx0KSB7XG5cdFx0XHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0Ll9leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRpZiAocGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VSZWZlcmVuY2VQYXJ0KSB7XG5cdFx0XHRcdFx0XHQvLyBFbnN1cmUgdmFyaWFibGUgcmVmZXJlbmNlIHZhbHVlcyBnZXQgZml4ZWQgdXBcblx0XHRcdFx0XHRcdHRoaXMucmVmZXJlbmNlMihwYXJ0LnZhbHVlLCBwYXJ0Lmljb25QYXRoLCBwYXJ0Lm9wdGlvbnMpO1xuXHRcdFx0XHRcdH0gZWxzZSBpZiAocGFydCBpbnN0YW5jZW9mIGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VQcm9ncmVzc1BhcnQyKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBkdG8gPSBwYXJ0LnRhc2sgPyB0eXBlQ29udmVydC5DaGF0VGFzay5mcm9tKHBhcnQpIDogdHlwZUNvbnZlcnQuQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NQYXJ0LmZyb20ocGFydCk7XG5cdFx0XHRcdFx0XHRfcmVwb3J0KGR0bywgcGFydC50YXNrKTtcblx0XHRcdFx0XHR9IGVsc2UgaWYgKHBhcnQgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuQ2hhdFJlc3BvbnNlQW5jaG9yUGFydCkge1xuXHRcdFx0XHRcdFx0Y29uc3QgZHRvID0gdHlwZUNvbnZlcnQuQ2hhdFJlc3BvbnNlQW5jaG9yUGFydC5mcm9tKHBhcnQpO1xuXG5cdFx0XHRcdFx0XHRpZiAocGFydC5yZXNvbHZlKSB7XG5cdFx0XHRcdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuX2V4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucycpO1xuXG5cdFx0XHRcdFx0XHRcdGR0by5yZXNvbHZlSWQgPSBnZW5lcmF0ZVV1aWQoKTtcblxuXHRcdFx0XHRcdFx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblx0XHRcdFx0XHRcdFx0cGFydC5yZXNvbHZlKGN0cy50b2tlbilcblx0XHRcdFx0XHRcdFx0XHQudGhlbigoKSA9PiB7XG5cdFx0XHRcdFx0XHRcdFx0XHRjb25zdCByZXNvbHZlZER0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZUFuY2hvclBhcnQuZnJvbShwYXJ0KTtcblx0XHRcdFx0XHRcdFx0XHRcdHRoYXQuX3Byb3h5LiRoYW5kbGVBbmNob3JSZXNvbHZlKHRoYXQuX3JlcXVlc3QucmVxdWVzdElkLCBkdG8ucmVzb2x2ZUlkISwgcmVzb2x2ZWREdG8pO1xuXHRcdFx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHRcdFx0LnRoZW4oKCkgPT4gY3RzLmRpc3Bvc2UoKSwgKCkgPT4gY3RzLmRpc3Bvc2UoKSk7XG5cdFx0XHRcdFx0XHRcdHRoYXQuX3Nlc3Npb25EaXNwb3NhYmxlcy5hZGQodG9EaXNwb3NhYmxlKCgpID0+IGN0cy5kaXNwb3NlKHRydWUpKSk7XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRfcmVwb3J0KGR0byk7XG5cdFx0XHRcdFx0fSBlbHNlIHtcblx0XHRcdFx0XHRcdGNvbnN0IGR0byA9IHR5cGVDb252ZXJ0LkNoYXRSZXNwb25zZVBhcnQuZnJvbShwYXJ0LCB0aGF0Ll9jb21tYW5kc0NvbnZlcnRlciwgdGhhdC5fc2Vzc2lvbkRpc3Bvc2FibGVzKTtcblx0XHRcdFx0XHRcdF9yZXBvcnQoZHRvKTtcblx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRyZXR1cm4gdGhpcztcblx0XHRcdFx0fSxcblx0XHRcdH0pO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLl9hcGlPYmplY3Q7XG5cdH1cbn1cblxuaW50ZXJmYWNlIEluRmxpZ2h0Q2hhdFJlcXVlc3Qge1xuXHRyZXF1ZXN0SWQ6IHN0cmluZztcblx0ZXh0UmVxdWVzdDogdnNjb2RlLkNoYXRSZXF1ZXN0O1xufVxuXG5leHBvcnQgY2xhc3MgRXh0SG9zdENoYXRBZ2VudHMyIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIEV4dEhvc3RDaGF0QWdlbnRzU2hhcGUyIHtcblxuXHRwcml2YXRlIHN0YXRpYyBfaWRQb29sID0gMDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9hZ2VudHMgPSBuZXcgTWFwPG51bWJlciwgRXh0SG9zdENoYXRBZ2VudD4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IE1haW5UaHJlYWRDaGF0QWdlbnRzU2hhcGUyO1xuXG5cdHByaXZhdGUgc3RhdGljIF9wYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVySWRQb29sID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfcGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcnMgPSBuZXcgTWFwPG51bWJlciwgRXh0SG9zdFBhcnRpY2lwYW50RGV0ZWN0b3I+KCk7XG5cblx0cHJpdmF0ZSBzdGF0aWMgX3JlbGF0ZWRGaWxlc1Byb3ZpZGVySWRQb29sID0gMDtcblx0cHJpdmF0ZSByZWFkb25seSBfcmVsYXRlZEZpbGVzUHJvdmlkZXJzID0gbmV3IE1hcDxudW1iZXIsIEV4dEhvc3RSZWxhdGVkRmlsZXNQcm92aWRlcj4oKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9zZXNzaW9uRGlzcG9zYWJsZXM6IERpc3Bvc2FibGVNYXA8c3RyaW5nLCBEaXNwb3NhYmxlU3RvcmU+ID0gdGhpcy5fcmVnaXN0ZXIobmV3IERpc3Bvc2FibGVNYXAoKSk7XG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvbXBsZXRpb25EaXNwb3NhYmxlczogRGlzcG9zYWJsZU1hcDxudW1iZXIsIERpc3Bvc2FibGVTdG9yZT4gPSB0aGlzLl9yZWdpc3RlcihuZXcgRGlzcG9zYWJsZU1hcCgpKTtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9pbkZsaWdodFJlcXVlc3RzID0gbmV3IFNldDxJbkZsaWdodENoYXRSZXF1ZXN0PigpO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRGlzcG9zZUNoYXRTZXNzaW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8c3RyaW5nPigpKTtcblx0cmVhZG9ubHkgb25EaWREaXNwb3NlQ2hhdFNlc3Npb24gPSB0aGlzLl9vbkRpZERpc3Bvc2VDaGF0U2Vzc2lvbi5ldmVudDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRtYWluQ29udGV4dDogSU1haW5Db250ZXh0LFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2NvbW1hbmRzOiBFeHRIb3N0Q29tbWFuZHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZG9jdW1lbnRzOiBFeHRIb3N0RG9jdW1lbnRzLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2xhbmd1YWdlTW9kZWxzOiBFeHRIb3N0TGFuZ3VhZ2VNb2RlbHMsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfZGlhZ25vc3RpY3M6IEV4dEhvc3REaWFnbm9zdGljcyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF90b29sczogRXh0SG9zdExhbmd1YWdlTW9kZWxUb29sc1xuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gbWFpbkNvbnRleHQuZ2V0UHJveHkoTWFpbkNvbnRleHQuTWFpblRocmVhZENoYXRBZ2VudHMyKTtcblxuXHRcdF9jb21tYW5kcy5yZWdpc3RlckFyZ3VtZW50UHJvY2Vzc29yKHtcblx0XHRcdHByb2Nlc3NBcmd1bWVudDogKGFyZykgPT4ge1xuXHRcdFx0XHQvLyBEb24ndCBzZW5kIHRoaXMgYXJndW1lbnQgdG8gZXh0ZW5zaW9uIGNvbW1hbmRzXG5cdFx0XHRcdGlmIChpc0NoYXRWaWV3VGl0bGVBY3Rpb25Db250ZXh0KGFyZykpIHtcblx0XHRcdFx0XHRyZXR1cm4gbnVsbDtcblx0XHRcdFx0fVxuXG5cdFx0XHRcdHJldHVybiBhcmc7XG5cdFx0XHR9XG5cdFx0fSk7XG5cdH1cblxuXHR0cmFuc2ZlckFjdGl2ZUNoYXQobmV3V29ya3NwYWNlOiB2c2NvZGUuVXJpKTogdm9pZCB7XG5cdFx0dGhpcy5fcHJveHkuJHRyYW5zZmVyQWN0aXZlQ2hhdFNlc3Npb24obmV3V29ya3NwYWNlKTtcblx0fVxuXG5cdGNyZWF0ZUNoYXRBZ2VudChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgaGFuZGxlcjogdnNjb2RlLkNoYXRFeHRlbmRlZFJlcXVlc3RIYW5kbGVyKTogdnNjb2RlLkNoYXRQYXJ0aWNpcGFudCB7XG5cdFx0Y29uc3QgaGFuZGxlID0gRXh0SG9zdENoYXRBZ2VudHMyLl9pZFBvb2wrKztcblx0XHRjb25zdCBhZ2VudCA9IG5ldyBFeHRIb3N0Q2hhdEFnZW50KGV4dGVuc2lvbiwgaWQsIHRoaXMuX3Byb3h5LCBoYW5kbGUsIGhhbmRsZXIpO1xuXHRcdHRoaXMuX2FnZW50cy5zZXQoaGFuZGxlLCBhZ2VudCk7XG5cblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJBZ2VudChoYW5kbGUsIGV4dGVuc2lvbi5pZGVudGlmaWVyLCBpZCwge30sIHVuZGVmaW5lZCk7XG5cdFx0cmV0dXJuIGFnZW50LmFwaUFnZW50O1xuXHR9XG5cblx0Y3JlYXRlRHluYW1pY0NoYXRBZ2VudChleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgaWQ6IHN0cmluZywgZHluYW1pY1Byb3BzOiB2c2NvZGUuRHluYW1pY0NoYXRQYXJ0aWNpcGFudFByb3BzLCBoYW5kbGVyOiB2c2NvZGUuQ2hhdEV4dGVuZGVkUmVxdWVzdEhhbmRsZXIpOiB2c2NvZGUuQ2hhdFBhcnRpY2lwYW50IHtcblx0XHRjb25zdCBoYW5kbGUgPSBFeHRIb3N0Q2hhdEFnZW50czIuX2lkUG9vbCsrO1xuXHRcdGNvbnN0IGFnZW50ID0gbmV3IEV4dEhvc3RDaGF0QWdlbnQoZXh0ZW5zaW9uLCBpZCwgdGhpcy5fcHJveHksIGhhbmRsZSwgaGFuZGxlcik7XG5cdFx0dGhpcy5fYWdlbnRzLnNldChoYW5kbGUsIGFnZW50KTtcblxuXHRcdHRoaXMuX3Byb3h5LiRyZWdpc3RlckFnZW50KGhhbmRsZSwgZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGlkLCB7IGlzU3RpY2t5OiB0cnVlIH0gc2F0aXNmaWVzIElFeHRlbnNpb25DaGF0QWdlbnRNZXRhZGF0YSwgZHluYW1pY1Byb3BzKTtcblx0XHRyZXR1cm4gYWdlbnQuYXBpQWdlbnQ7XG5cdH1cblxuXHRyZWdpc3RlckNoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVyKGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCBwcm92aWRlcjogdnNjb2RlLkNoYXRQYXJ0aWNpcGFudERldGVjdGlvblByb3ZpZGVyKTogdnNjb2RlLkRpc3Bvc2FibGUge1xuXHRcdGNvbnN0IGhhbmRsZSA9IEV4dEhvc3RDaGF0QWdlbnRzMi5fcGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcklkUG9vbCsrO1xuXHRcdHRoaXMuX3BhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzLnNldChoYW5kbGUsIG5ldyBFeHRIb3N0UGFydGljaXBhbnREZXRlY3RvcihleHRlbnNpb24sIHByb3ZpZGVyKSk7XG5cdFx0dGhpcy5fcHJveHkuJHJlZ2lzdGVyQ2hhdFBhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXIoaGFuZGxlKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3BhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzLmRlbGV0ZShoYW5kbGUpO1xuXHRcdFx0dGhpcy5fcHJveHkuJHVucmVnaXN0ZXJDaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcihoYW5kbGUpO1xuXHRcdH0pO1xuXHR9XG5cblx0cmVnaXN0ZXJSZWxhdGVkRmlsZXNQcm92aWRlcihleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbiwgcHJvdmlkZXI6IHZzY29kZS5DaGF0UmVsYXRlZEZpbGVzUHJvdmlkZXIsIG1ldGFkYXRhOiB2c2NvZGUuQ2hhdFJlbGF0ZWRGaWxlc1Byb3ZpZGVyTWV0YWRhdGEpOiB2c2NvZGUuRGlzcG9zYWJsZSB7XG5cdFx0Y29uc3QgaGFuZGxlID0gRXh0SG9zdENoYXRBZ2VudHMyLl9yZWxhdGVkRmlsZXNQcm92aWRlcklkUG9vbCsrO1xuXHRcdHRoaXMuX3JlbGF0ZWRGaWxlc1Byb3ZpZGVycy5zZXQoaGFuZGxlLCBuZXcgRXh0SG9zdFJlbGF0ZWRGaWxlc1Byb3ZpZGVyKGV4dGVuc2lvbiwgcHJvdmlkZXIpKTtcblx0XHR0aGlzLl9wcm94eS4kcmVnaXN0ZXJSZWxhdGVkRmlsZXNQcm92aWRlcihoYW5kbGUsIG1ldGFkYXRhKTtcblx0XHRyZXR1cm4gdG9EaXNwb3NhYmxlKCgpID0+IHtcblx0XHRcdHRoaXMuX3JlbGF0ZWRGaWxlc1Byb3ZpZGVycy5kZWxldGUoaGFuZGxlKTtcblx0XHRcdHRoaXMuX3Byb3h5LiR1bnJlZ2lzdGVyUmVsYXRlZEZpbGVzUHJvdmlkZXIoaGFuZGxlKTtcblx0XHR9KTtcblx0fVxuXG5cdGFzeW5jICRwcm92aWRlUmVsYXRlZEZpbGVzKGhhbmRsZTogbnVtYmVyLCByZXF1ZXN0OiBJQ2hhdFJlcXVlc3REcmFmdCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxEdG88SUNoYXRSZWxhdGVkRmlsZT5bXSB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5fcmVsYXRlZEZpbGVzUHJvdmlkZXJzLmdldChoYW5kbGUpO1xuXHRcdGlmICghcHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBQcm9taXNlLnJlc29sdmUoW10pO1xuXHRcdH1cblxuXHRcdGNvbnN0IGV4dFJlcXVlc3REcmFmdCA9IHR5cGVDb252ZXJ0LkNoYXRSZXF1ZXN0RHJhZnQudG8ocmVxdWVzdCk7XG5cdFx0cmV0dXJuIGF3YWl0IHByb3ZpZGVyLnByb3ZpZGVyLnByb3ZpZGVSZWxhdGVkRmlsZXMoZXh0UmVxdWVzdERyYWZ0LCB0b2tlbikgPz8gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgJGRldGVjdENoYXRQYXJ0aWNpcGFudChoYW5kbGU6IG51bWJlciwgcmVxdWVzdER0bzogRHRvPElDaGF0QWdlbnRSZXF1ZXN0PiwgY29udGV4dDogeyBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5RHRvW10gfSwgb3B0aW9uczogeyBsb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247IHBhcnRpY2lwYW50cz86IHZzY29kZS5DaGF0UGFydGljaXBhbnRNZXRhZGF0YVtdIH0sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dnNjb2RlLkNoYXRQYXJ0aWNpcGFudERldGVjdGlvblJlc3VsdCB8IG51bGwgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBkZXRlY3RvciA9IHRoaXMuX3BhcnRpY2lwYW50RGV0ZWN0aW9uUHJvdmlkZXJzLmdldChoYW5kbGUpO1xuXHRcdGlmICghZGV0ZWN0b3IpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXG5cdFx0Y29uc3QgeyByZXF1ZXN0LCBsb2NhdGlvbiwgaGlzdG9yeSB9ID0gYXdhaXQgdGhpcy5fY3JlYXRlUmVxdWVzdChyZXF1ZXN0RHRvLCBjb250ZXh0LCBkZXRlY3Rvci5leHRlbnNpb24pO1xuXG5cdFx0Y29uc3QgbW9kZWwgPSBhd2FpdCB0aGlzLmdldE1vZGVsRm9yUmVxdWVzdChyZXF1ZXN0LCBkZXRlY3Rvci5leHRlbnNpb24pO1xuXHRcdGNvbnN0IGluY2x1ZGVJbnRlcmFjdGlvbklkID0gaXNQcm9wb3NlZEFwaUVuYWJsZWQoZGV0ZWN0b3IuZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpO1xuXHRcdGNvbnN0IGV4dFJlcXVlc3QgPSB0eXBlQ29udmVydC5DaGF0QWdlbnRSZXF1ZXN0LnRvKGluY2x1ZGVJbnRlcmFjdGlvbklkID8gcmVxdWVzdCA6IHsgLi4ucmVxdWVzdCwgcmVxdWVzdElkOiAnJyB9LCBsb2NhdGlvbiwgbW9kZWwsIHRoaXMuZ2V0RGlhZ25vc3RpY3NXaGVuRW5hYmxlZChkZXRlY3Rvci5leHRlbnNpb24pLCB0aGlzLmdldFRvb2xzRm9yUmVxdWVzdChkZXRlY3Rvci5leHRlbnNpb24sIHJlcXVlc3QpKTtcblxuXHRcdHJldHVybiBkZXRlY3Rvci5wcm92aWRlci5wcm92aWRlUGFydGljaXBhbnREZXRlY3Rpb24oXG5cdFx0XHRleHRSZXF1ZXN0LFxuXHRcdFx0eyBoaXN0b3J5IH0sXG5cdFx0XHR7IHBhcnRpY2lwYW50czogb3B0aW9ucy5wYXJ0aWNpcGFudHMsIGxvY2F0aW9uOiB0eXBlQ29udmVydC5DaGF0TG9jYXRpb24udG8ob3B0aW9ucy5sb2NhdGlvbikgfSxcblx0XHRcdHRva2VuXG5cdFx0KTtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgX2NyZWF0ZVJlcXVlc3QocmVxdWVzdER0bzogRHRvPElDaGF0QWdlbnRSZXF1ZXN0PiwgY29udGV4dDogeyBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5RHRvW10gfSwgZXh0ZW5zaW9uOiBJRXh0ZW5zaW9uRGVzY3JpcHRpb24pIHtcblx0XHRjb25zdCByZXF1ZXN0ID0gcmV2aXZlPElDaGF0QWdlbnRSZXF1ZXN0PihyZXF1ZXN0RHRvKTtcblx0XHRjb25zdCBjb252ZXJ0ZWRIaXN0b3J5ID0gYXdhaXQgdGhpcy5wcmVwYXJlSGlzdG9yeVR1cm5zKGV4dGVuc2lvbiwgcmVxdWVzdC5hZ2VudElkLCBjb250ZXh0KTtcblxuXHRcdC8vIGluLXBsYWNlIGNvbnZlcnRpbmcgZm9yIGxvY2F0aW9uLWRhdGFcblx0XHRsZXQgbG9jYXRpb246IHZzY29kZS5DaGF0UmVxdWVzdEVkaXRvckRhdGEgfCB2c2NvZGUuQ2hhdFJlcXVlc3ROb3RlYm9va0RhdGEgfCB1bmRlZmluZWQ7XG5cdFx0aWYgKHJlcXVlc3QubG9jYXRpb25EYXRhPy50eXBlID09PSBDaGF0QWdlbnRMb2NhdGlvbi5FZGl0b3IpIHtcblx0XHRcdC8vIGVkaXRvciBkYXRhXG5cdFx0XHRjb25zdCBkb2N1bWVudCA9IHRoaXMuX2RvY3VtZW50cy5nZXREb2N1bWVudChyZXF1ZXN0LmxvY2F0aW9uRGF0YS5kb2N1bWVudCk7XG5cdFx0XHRsb2NhdGlvbiA9IG5ldyBleHRIb3N0VHlwZXMuQ2hhdFJlcXVlc3RFZGl0b3JEYXRhKGRvY3VtZW50LCB0eXBlQ29udmVydC5TZWxlY3Rpb24udG8ocmVxdWVzdC5sb2NhdGlvbkRhdGEuc2VsZWN0aW9uKSwgdHlwZUNvbnZlcnQuUmFuZ2UudG8ocmVxdWVzdC5sb2NhdGlvbkRhdGEud2hvbGVSYW5nZSkpO1xuXG5cdFx0fSBlbHNlIGlmIChyZXF1ZXN0LmxvY2F0aW9uRGF0YT8udHlwZSA9PT0gQ2hhdEFnZW50TG9jYXRpb24uTm90ZWJvb2spIHtcblx0XHRcdC8vIG5vdGVib29rIGRhdGFcblx0XHRcdGNvbnN0IGNlbGwgPSB0aGlzLl9kb2N1bWVudHMuZ2V0RG9jdW1lbnQocmVxdWVzdC5sb2NhdGlvbkRhdGEuc2Vzc2lvbklucHV0VXJpKTtcblx0XHRcdGxvY2F0aW9uID0gbmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVxdWVzdE5vdGVib29rRGF0YShjZWxsKTtcblxuXHRcdH0gZWxzZSBpZiAocmVxdWVzdC5sb2NhdGlvbkRhdGE/LnR5cGUgPT09IENoYXRBZ2VudExvY2F0aW9uLlRlcm1pbmFsKSB7XG5cdFx0XHQvLyBUQkRcblx0XHR9XG5cblx0XHRyZXR1cm4geyByZXF1ZXN0LCBsb2NhdGlvbiwgaGlzdG9yeTogY29udmVydGVkSGlzdG9yeSB9O1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBnZXRNb2RlbEZvclJlcXVlc3QocmVxdWVzdDogSUNoYXRBZ2VudFJlcXVlc3QsIGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uKTogUHJvbWlzZTx2c2NvZGUuTGFuZ3VhZ2VNb2RlbENoYXQ+IHtcblx0XHRsZXQgbW9kZWw6IHZzY29kZS5MYW5ndWFnZU1vZGVsQ2hhdCB8IHVuZGVmaW5lZDtcblx0XHRpZiAocmVxdWVzdC51c2VyU2VsZWN0ZWRNb2RlbElkKSB7XG5cdFx0XHRtb2RlbCA9IGF3YWl0IHRoaXMuX2xhbmd1YWdlTW9kZWxzLmdldExhbmd1YWdlTW9kZWxCeUlkZW50aWZpZXIoZXh0ZW5zaW9uLCByZXF1ZXN0LnVzZXJTZWxlY3RlZE1vZGVsSWQpO1xuXHRcdH1cblx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRtb2RlbCA9IGF3YWl0IHRoaXMuX2xhbmd1YWdlTW9kZWxzLmdldERlZmF1bHRMYW5ndWFnZU1vZGVsKGV4dGVuc2lvbik7XG5cdFx0XHRpZiAoIW1vZGVsKSB7XG5cdFx0XHRcdHRocm93IG5ldyBFcnJvcignTGFuZ3VhZ2UgbW9kZWwgdW5hdmFpbGFibGUnKTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gbW9kZWw7XG5cdH1cblxuXHRhc3luYyAkc2V0UmVxdWVzdFBhdXNlZChoYW5kbGU6IG51bWJlciwgcmVxdWVzdElkOiBzdHJpbmcsIGlzUGF1c2VkOiBib29sZWFuKSB7XG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblxuXHRcdGNvbnN0IGluRmxpZ2h0ID0gSXRlcmFibGUuZmluZCh0aGlzLl9pbkZsaWdodFJlcXVlc3RzLCByID0+IHIucmVxdWVzdElkID09PSByZXF1ZXN0SWQpO1xuXHRcdGlmICghaW5GbGlnaHQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRhZ2VudC5zZXRDaGF0UmVxdWVzdFBhdXNlU3RhdGUoeyByZXF1ZXN0OiBpbkZsaWdodC5leHRSZXF1ZXN0LCBpc1BhdXNlZCB9KTtcblx0fVxuXG5cdGFzeW5jICRpbnZva2VBZ2VudChoYW5kbGU6IG51bWJlciwgcmVxdWVzdER0bzogRHRvPElDaGF0QWdlbnRSZXF1ZXN0PiwgY29udGV4dDogeyBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5RHRvW10gfSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEFnZW50UmVzdWx0IHwgdW5kZWZpbmVkPiB7XG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBbQ0hBVF0oJHtoYW5kbGV9KSBDQU5OT1QgaW52b2tlIGFnZW50IGJlY2F1c2UgdGhlIGFnZW50IGlzIG5vdCByZWdpc3RlcmVkYCk7XG5cdFx0fVxuXG5cdFx0bGV0IHN0cmVhbTogQ2hhdEFnZW50UmVzcG9uc2VTdHJlYW0gfCB1bmRlZmluZWQ7XG5cdFx0bGV0IGluRmxpZ2h0UmVxdWVzdDogSW5GbGlnaHRDaGF0UmVxdWVzdCB8IHVuZGVmaW5lZDtcblxuXHRcdHRyeSB7XG5cdFx0XHRjb25zdCB7IHJlcXVlc3QsIGxvY2F0aW9uLCBoaXN0b3J5IH0gPSBhd2FpdCB0aGlzLl9jcmVhdGVSZXF1ZXN0KHJlcXVlc3REdG8sIGNvbnRleHQsIGFnZW50LmV4dGVuc2lvbik7XG5cblx0XHRcdC8vIEluaXQgc2Vzc2lvbiBkaXNwb3NhYmxlc1xuXHRcdFx0bGV0IHNlc3Npb25EaXNwb3NhYmxlcyA9IHRoaXMuX3Nlc3Npb25EaXNwb3NhYmxlcy5nZXQocmVxdWVzdC5zZXNzaW9uSWQpO1xuXHRcdFx0aWYgKCFzZXNzaW9uRGlzcG9zYWJsZXMpIHtcblx0XHRcdFx0c2Vzc2lvbkRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdFx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuc2V0KHJlcXVlc3Quc2Vzc2lvbklkLCBzZXNzaW9uRGlzcG9zYWJsZXMpO1xuXHRcdFx0fVxuXG5cdFx0XHRzdHJlYW0gPSBuZXcgQ2hhdEFnZW50UmVzcG9uc2VTdHJlYW0oYWdlbnQuZXh0ZW5zaW9uLCByZXF1ZXN0LCB0aGlzLl9wcm94eSwgdGhpcy5fY29tbWFuZHMuY29udmVydGVyLCBzZXNzaW9uRGlzcG9zYWJsZXMpO1xuXG5cdFx0XHRjb25zdCBtb2RlbCA9IGF3YWl0IHRoaXMuZ2V0TW9kZWxGb3JSZXF1ZXN0KHJlcXVlc3QsIGFnZW50LmV4dGVuc2lvbik7XG5cdFx0XHRjb25zdCBpbmNsdWRlSW50ZXJhY3Rpb25JZCA9IGlzUHJvcG9zZWRBcGlFbmFibGVkKGFnZW50LmV4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudFByaXZhdGUnKTtcblx0XHRcdGNvbnN0IGV4dFJlcXVlc3QgPSB0eXBlQ29udmVydC5DaGF0QWdlbnRSZXF1ZXN0LnRvKFxuXHRcdFx0XHRpbmNsdWRlSW50ZXJhY3Rpb25JZCA/IHJlcXVlc3QgOiB7IC4uLnJlcXVlc3QsIHJlcXVlc3RJZDogJycgfSxcblx0XHRcdFx0bG9jYXRpb24sXG5cdFx0XHRcdG1vZGVsLFxuXHRcdFx0XHR0aGlzLmdldERpYWdub3N0aWNzV2hlbkVuYWJsZWQoYWdlbnQuZXh0ZW5zaW9uKSxcblx0XHRcdFx0dGhpcy5nZXRUb29sc0ZvclJlcXVlc3QoYWdlbnQuZXh0ZW5zaW9uLCByZXF1ZXN0KVxuXHRcdFx0KTtcblx0XHRcdGluRmxpZ2h0UmVxdWVzdCA9IHsgcmVxdWVzdElkOiByZXF1ZXN0RHRvLnJlcXVlc3RJZCwgZXh0UmVxdWVzdCB9O1xuXHRcdFx0dGhpcy5faW5GbGlnaHRSZXF1ZXN0cy5hZGQoaW5GbGlnaHRSZXF1ZXN0KTtcblxuXHRcdFx0Y29uc3QgdGFzayA9IGFnZW50Lmludm9rZShcblx0XHRcdFx0ZXh0UmVxdWVzdCxcblx0XHRcdFx0eyBoaXN0b3J5IH0sXG5cdFx0XHRcdHN0cmVhbS5hcGlPYmplY3QsXG5cdFx0XHRcdHRva2VuXG5cdFx0XHQpO1xuXG5cdFx0XHRyZXR1cm4gYXdhaXQgcmFjZUNhbmNlbGxhdGlvbihQcm9taXNlLnJlc29sdmUodGFzaykudGhlbigocmVzdWx0KSA9PiB7XG5cdFx0XHRcdGlmIChyZXN1bHQ/Lm1ldGFkYXRhKSB7XG5cdFx0XHRcdFx0dHJ5IHtcblx0XHRcdFx0XHRcdEpTT04uc3RyaW5naWZ5KHJlc3VsdC5tZXRhZGF0YSk7XG5cdFx0XHRcdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRcdFx0XHRjb25zdCBtc2cgPSBgcmVzdWx0Lm1ldGFkYXRhIE1VU1QgYmUgSlNPTi5zdHJpbmdpZnktYWJsZS4gR290IGVycm9yOiAke2Vyci5tZXNzYWdlfWA7XG5cdFx0XHRcdFx0XHR0aGlzLl9sb2dTZXJ2aWNlLmVycm9yKGBbJHthZ2VudC5leHRlbnNpb24uaWRlbnRpZmllci52YWx1ZX1dIFtAJHthZ2VudC5pZH1dICR7bXNnfWAsIGFnZW50LmV4dGVuc2lvbik7XG5cdFx0XHRcdFx0XHRyZXR1cm4geyBlcnJvckRldGFpbHM6IHsgbWVzc2FnZTogbXNnIH0sIHRpbWluZ3M6IHN0cmVhbT8udGltaW5ncywgbmV4dFF1ZXN0aW9uOiByZXN1bHQubmV4dFF1ZXN0aW9uIH07XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9XG5cdFx0XHRcdGxldCBlcnJvckRldGFpbHM6IElDaGF0UmVzcG9uc2VFcnJvckRldGFpbHMgfCB1bmRlZmluZWQ7XG5cdFx0XHRcdGlmIChyZXN1bHQ/LmVycm9yRGV0YWlscykge1xuXHRcdFx0XHRcdGVycm9yRGV0YWlscyA9IHtcblx0XHRcdFx0XHRcdC4uLnJlc3VsdC5lcnJvckRldGFpbHMsXG5cdFx0XHRcdFx0XHRyZXNwb25zZUlzSW5jb21wbGV0ZTogdHJ1ZVxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdFx0aWYgKGVycm9yRGV0YWlscz8ucmVzcG9uc2VJc1JlZGFjdGVkIHx8IGVycm9yRGV0YWlscz8uaXNRdW90YUV4Y2VlZGVkKSB7XG5cdFx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQoYWdlbnQuZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0cmV0dXJuIHsgZXJyb3JEZXRhaWxzLCB0aW1pbmdzOiBzdHJlYW0/LnRpbWluZ3MsIG1ldGFkYXRhOiByZXN1bHQ/Lm1ldGFkYXRhLCBuZXh0UXVlc3Rpb246IHJlc3VsdD8ubmV4dFF1ZXN0aW9uIH0gc2F0aXNmaWVzIElDaGF0QWdlbnRSZXN1bHQ7XG5cdFx0XHR9KSwgdG9rZW4pO1xuXHRcdH0gY2F0Y2ggKGUpIHtcblx0XHRcdHRoaXMuX2xvZ1NlcnZpY2UuZXJyb3IoZSwgYWdlbnQuZXh0ZW5zaW9uKTtcblxuXHRcdFx0aWYgKGUgaW5zdGFuY2VvZiBleHRIb3N0VHlwZXMuTGFuZ3VhZ2VNb2RlbEVycm9yICYmIGUuY2F1c2UpIHtcblx0XHRcdFx0ZSA9IGUuY2F1c2U7XG5cdFx0XHR9XG5cblx0XHRcdGNvbnN0IGlzUXVvdGFFeGNlZWRlZCA9IGUgaW5zdGFuY2VvZiBFcnJvciAmJiBlLm5hbWUgPT09ICdDaGF0UXVvdGFFeGNlZWRlZCc7XG5cdFx0XHRyZXR1cm4geyBlcnJvckRldGFpbHM6IHsgbWVzc2FnZTogdG9FcnJvck1lc3NhZ2UoZSksIHJlc3BvbnNlSXNJbmNvbXBsZXRlOiB0cnVlLCBpc1F1b3RhRXhjZWVkZWQgfSB9O1xuXG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdGlmIChpbkZsaWdodFJlcXVlc3QpIHtcblx0XHRcdFx0dGhpcy5faW5GbGlnaHRSZXF1ZXN0cy5kZWxldGUoaW5GbGlnaHRSZXF1ZXN0KTtcblx0XHRcdH1cblx0XHRcdHN0cmVhbT8uY2xvc2UoKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGdldERpYWdub3N0aWNzV2hlbkVuYWJsZWQoZXh0ZW5zaW9uOiBSZWFkb25seTxJUmVsYXhlZEV4dGVuc2lvbkRlc2NyaXB0aW9uPikge1xuXHRcdGlmICghaXNQcm9wb3NlZEFwaUVuYWJsZWQoZXh0ZW5zaW9uLCAnY2hhdFJlZmVyZW5jZURpYWdub3N0aWMnKSkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRyZXR1cm4gdGhpcy5fZGlhZ25vc3RpY3MuZ2V0RGlhZ25vc3RpY3MoKTtcblx0fVxuXG5cdHByaXZhdGUgZ2V0VG9vbHNGb3JSZXF1ZXN0KGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLCByZXF1ZXN0OiBEdG88SUNoYXRBZ2VudFJlcXVlc3Q+KSB7XG5cdFx0aWYgKCFpc05vbkVtcHR5QXJyYXkocmVxdWVzdC51c2VyU2VsZWN0ZWRUb29scykpIHtcblx0XHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdFx0fVxuXHRcdGNvbnN0IHNlbGVjdG9yID0gbmV3IFNldChyZXF1ZXN0LnVzZXJTZWxlY3RlZFRvb2xzKTtcblx0XHRyZXR1cm4gdGhpcy5fdG9vbHMuZ2V0VG9vbHMoZXh0ZW5zaW9uKS5maWx0ZXIoY2FuZGlkYXRlID0+IHNlbGVjdG9yLmhhcyhjYW5kaWRhdGUubmFtZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBwcmVwYXJlSGlzdG9yeVR1cm5zKGV4dGVuc2lvbjogUmVhZG9ubHk8SVJlbGF4ZWRFeHRlbnNpb25EZXNjcmlwdGlvbj4sIGFnZW50SWQ6IHN0cmluZywgY29udGV4dDogeyBoaXN0b3J5OiBJQ2hhdEFnZW50SGlzdG9yeUVudHJ5RHRvW10gfSk6IFByb21pc2U8KHZzY29kZS5DaGF0UmVxdWVzdFR1cm4gfCB2c2NvZGUuQ2hhdFJlc3BvbnNlVHVybilbXT4ge1xuXHRcdGNvbnN0IHJlczogKHZzY29kZS5DaGF0UmVxdWVzdFR1cm4gfCB2c2NvZGUuQ2hhdFJlc3BvbnNlVHVybilbXSA9IFtdO1xuXG5cdFx0Zm9yIChjb25zdCBoIG9mIGNvbnRleHQuaGlzdG9yeSkge1xuXHRcdFx0Y29uc3QgZWhSZXN1bHQgPSB0eXBlQ29udmVydC5DaGF0QWdlbnRSZXN1bHQudG8oaC5yZXN1bHQpO1xuXHRcdFx0Y29uc3QgcmVzdWx0OiB2c2NvZGUuQ2hhdFJlc3VsdCA9IGFnZW50SWQgPT09IGgucmVxdWVzdC5hZ2VudElkID9cblx0XHRcdFx0ZWhSZXN1bHQgOlxuXHRcdFx0XHR7IC4uLmVoUmVzdWx0LCBtZXRhZGF0YTogdW5kZWZpbmVkIH07XG5cblx0XHRcdC8vIFJFUVVFU1QgdHVyblxuXHRcdFx0Y29uc3QgdmFyc1dpdGhvdXRUb29scyA9IGgucmVxdWVzdC52YXJpYWJsZXMudmFyaWFibGVzXG5cdFx0XHRcdC5maWx0ZXIodiA9PiAhdi5pc1Rvb2wpXG5cdFx0XHRcdC5tYXAodiA9PiB0eXBlQ29udmVydC5DaGF0UHJvbXB0UmVmZXJlbmNlLnRvKHYsIHRoaXMuZ2V0RGlhZ25vc3RpY3NXaGVuRW5hYmxlZChleHRlbnNpb24pKSk7XG5cdFx0XHRjb25zdCB0b29sUmVmZXJlbmNlcyA9IGgucmVxdWVzdC52YXJpYWJsZXMudmFyaWFibGVzXG5cdFx0XHRcdC5maWx0ZXIodiA9PiB2LmlzVG9vbClcblx0XHRcdFx0Lm1hcCh0eXBlQ29udmVydC5DaGF0TGFuZ3VhZ2VNb2RlbFRvb2xSZWZlcmVuY2UudG8pO1xuXHRcdFx0Y29uc3QgdHVybiA9IG5ldyBleHRIb3N0VHlwZXMuQ2hhdFJlcXVlc3RUdXJuKGgucmVxdWVzdC5tZXNzYWdlLCBoLnJlcXVlc3QuY29tbWFuZCwgdmFyc1dpdGhvdXRUb29scywgaC5yZXF1ZXN0LmFnZW50SWQsIHRvb2xSZWZlcmVuY2VzKTtcblx0XHRcdHJlcy5wdXNoKHR1cm4pO1xuXG5cdFx0XHQvLyBSRVNQT05TRSB0dXJuXG5cdFx0XHRjb25zdCBwYXJ0cyA9IGNvYWxlc2NlKGgucmVzcG9uc2UubWFwKHIgPT4gdHlwZUNvbnZlcnQuQ2hhdFJlc3BvbnNlUGFydC50b0NvbnRlbnQociwgdGhpcy5fY29tbWFuZHMuY29udmVydGVyKSkpO1xuXHRcdFx0cmVzLnB1c2gobmV3IGV4dEhvc3RUeXBlcy5DaGF0UmVzcG9uc2VUdXJuKHBhcnRzLCByZXN1bHQsIGgucmVxdWVzdC5hZ2VudElkLCBoLnJlcXVlc3QuY29tbWFuZCkpO1xuXHRcdH1cblxuXHRcdHJldHVybiByZXM7XG5cdH1cblxuXHQkcmVsZWFzZVNlc3Npb24oc2Vzc2lvbklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9zZXNzaW9uRGlzcG9zYWJsZXMuZGVsZXRlQW5kRGlzcG9zZShzZXNzaW9uSWQpO1xuXHRcdHRoaXMuX29uRGlkRGlzcG9zZUNoYXRTZXNzaW9uLmZpcmUoc2Vzc2lvbklkKTtcblx0fVxuXG5cdGFzeW5jICRwcm92aWRlRm9sbG93dXBzKHJlcXVlc3REdG86IER0bzxJQ2hhdEFnZW50UmVxdWVzdD4sIGhhbmRsZTogbnVtYmVyLCByZXN1bHQ6IElDaGF0QWdlbnRSZXN1bHQsIGNvbnRleHQ6IHsgaGlzdG9yeTogSUNoYXRBZ2VudEhpc3RvcnlFbnRyeUR0b1tdIH0sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SUNoYXRGb2xsb3d1cFtdPiB7XG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0cmV0dXJuIFByb21pc2UucmVzb2x2ZShbXSk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgcmVxdWVzdCA9IHJldml2ZTxJQ2hhdEFnZW50UmVxdWVzdD4ocmVxdWVzdER0byk7XG5cdFx0Y29uc3QgY29udmVydGVkSGlzdG9yeSA9IGF3YWl0IHRoaXMucHJlcGFyZUhpc3RvcnlUdXJucyhhZ2VudC5leHRlbnNpb24sIGFnZW50LmlkLCBjb250ZXh0KTtcblxuXHRcdGNvbnN0IGVoUmVzdWx0ID0gdHlwZUNvbnZlcnQuQ2hhdEFnZW50UmVzdWx0LnRvKHJlc3VsdCk7XG5cdFx0cmV0dXJuIChhd2FpdCBhZ2VudC5wcm92aWRlRm9sbG93dXBzKGVoUmVzdWx0LCB7IGhpc3Rvcnk6IGNvbnZlcnRlZEhpc3RvcnkgfSwgdG9rZW4pKVxuXHRcdFx0LmZpbHRlcihmID0+IHtcblx0XHRcdFx0Ly8gVGhlIGZvbGxvd3VwIG11c3QgcmVmZXIgdG8gYSBwYXJ0aWNpcGFudCB0aGF0IGV4aXN0cyBmcm9tIHRoZSBzYW1lIGV4dGVuc2lvblxuXHRcdFx0XHRjb25zdCBpc1ZhbGlkID0gIWYucGFydGljaXBhbnQgfHwgSXRlcmFibGUuc29tZShcblx0XHRcdFx0XHR0aGlzLl9hZ2VudHMudmFsdWVzKCksXG5cdFx0XHRcdFx0YSA9PiBhLmlkID09PSBmLnBhcnRpY2lwYW50ICYmIEV4dGVuc2lvbklkZW50aWZpZXIuZXF1YWxzKGEuZXh0ZW5zaW9uLmlkZW50aWZpZXIsIGFnZW50LmV4dGVuc2lvbi5pZGVudGlmaWVyKSk7XG5cdFx0XHRcdGlmICghaXNWYWxpZCkge1xuXHRcdFx0XHRcdHRoaXMuX2xvZ1NlcnZpY2Uud2FybihgW0Ake2FnZW50LmlkfV0gQ2hhdEZvbGxvd3VwIHJlZmVycyB0byBhbiB1bmtub3duIHBhcnRpY2lwYW50OiAke2YucGFydGljaXBhbnR9YCk7XG5cdFx0XHRcdH1cblx0XHRcdFx0cmV0dXJuIGlzVmFsaWQ7XG5cdFx0XHR9KVxuXHRcdFx0Lm1hcChmID0+IHR5cGVDb252ZXJ0LkNoYXRGb2xsb3d1cC5mcm9tKGYsIHJlcXVlc3QpKTtcblx0fVxuXG5cdCRhY2NlcHRGZWVkYmFjayhoYW5kbGU6IG51bWJlciwgcmVzdWx0OiBJQ2hhdEFnZW50UmVzdWx0LCB2b3RlQWN0aW9uOiBJQ2hhdFZvdGVBY3Rpb24pOiB2b2lkIHtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuX2FnZW50cy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgZWhSZXN1bHQgPSB0eXBlQ29udmVydC5DaGF0QWdlbnRSZXN1bHQudG8ocmVzdWx0KTtcblx0XHRsZXQga2luZDogZXh0SG9zdFR5cGVzLkNoYXRSZXN1bHRGZWVkYmFja0tpbmQ7XG5cdFx0c3dpdGNoICh2b3RlQWN0aW9uLmRpcmVjdGlvbikge1xuXHRcdFx0Y2FzZSBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLkRvd246XG5cdFx0XHRcdGtpbmQgPSBleHRIb3N0VHlwZXMuQ2hhdFJlc3VsdEZlZWRiYWNrS2luZC5VbmhlbHBmdWw7XG5cdFx0XHRcdGJyZWFrO1xuXHRcdFx0Y2FzZSBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uLlVwOlxuXHRcdFx0XHRraW5kID0gZXh0SG9zdFR5cGVzLkNoYXRSZXN1bHRGZWVkYmFja0tpbmQuSGVscGZ1bDtcblx0XHRcdFx0YnJlYWs7XG5cdFx0fVxuXG5cdFx0Y29uc3QgZmVlZGJhY2s6IHZzY29kZS5DaGF0UmVzdWx0RmVlZGJhY2sgPSB7XG5cdFx0XHRyZXN1bHQ6IGVoUmVzdWx0LFxuXHRcdFx0a2luZCxcblx0XHRcdHVuaGVscGZ1bFJlYXNvbjogaXNQcm9wb3NlZEFwaUVuYWJsZWQoYWdlbnQuZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJykgPyB2b3RlQWN0aW9uLnJlYXNvbiA6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHRcdGFnZW50LmFjY2VwdEZlZWRiYWNrKE9iamVjdC5mcmVlemUoZmVlZGJhY2spKTtcblx0fVxuXG5cdCRhY2NlcHRBY3Rpb24oaGFuZGxlOiBudW1iZXIsIHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCwgZXZlbnQ6IElDaGF0VXNlckFjdGlvbkV2ZW50KTogdm9pZCB7XG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0cmV0dXJuO1xuXHRcdH1cblx0XHRpZiAoZXZlbnQuYWN0aW9uLmtpbmQgPT09ICd2b3RlJykge1xuXHRcdFx0Ly8gaGFuZGxlZCBieSAkYWNjZXB0RmVlZGJhY2tcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBlaEFjdGlvbiA9IHR5cGVDb252ZXJ0LkNoYXRBZ2VudFVzZXJBY3Rpb25FdmVudC50byhyZXN1bHQsIGV2ZW50LCB0aGlzLl9jb21tYW5kcy5jb252ZXJ0ZXIpO1xuXHRcdGlmIChlaEFjdGlvbikge1xuXHRcdFx0YWdlbnQuYWNjZXB0QWN0aW9uKE9iamVjdC5mcmVlemUoZWhBY3Rpb24pKTtcblx0XHR9XG5cdH1cblxuXHRhc3luYyAkaW52b2tlQ29tcGxldGlvblByb3ZpZGVyKGhhbmRsZTogbnVtYmVyLCBxdWVyeTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElDaGF0QWdlbnRDb21wbGV0aW9uSXRlbVtdPiB7XG5cdFx0Y29uc3QgYWdlbnQgPSB0aGlzLl9hZ2VudHMuZ2V0KGhhbmRsZSk7XG5cdFx0aWYgKCFhZ2VudCkge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblxuXHRcdGxldCBkaXNwb3NhYmxlcyA9IHRoaXMuX2NvbXBsZXRpb25EaXNwb3NhYmxlcy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoZGlzcG9zYWJsZXMpIHtcblx0XHRcdC8vIENsZWFyIGFueSBkaXNwb3NhYmxlcyBmcm9tIHRoZSBsYXN0IGludm9jYXRpb24gb2YgdGhpcyBjb21wbGV0aW9uIHByb3ZpZGVyXG5cdFx0XHRkaXNwb3NhYmxlcy5jbGVhcigpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblx0XHRcdHRoaXMuX2NvbXBsZXRpb25EaXNwb3NhYmxlcy5zZXQoaGFuZGxlLCBkaXNwb3NhYmxlcyk7XG5cdFx0fVxuXG5cdFx0Y29uc3QgaXRlbXMgPSBhd2FpdCBhZ2VudC5pbnZva2VDb21wbGV0aW9uUHJvdmlkZXIocXVlcnksIHRva2VuKTtcblxuXHRcdHJldHVybiBpdGVtcy5tYXAoKGkpID0+IHR5cGVDb252ZXJ0LkNoYXRBZ2VudENvbXBsZXRpb25JdGVtLmZyb20oaSwgdGhpcy5fY29tbWFuZHMuY29udmVydGVyLCBkaXNwb3NhYmxlcykpO1xuXHR9XG5cblx0YXN5bmMgJHByb3ZpZGVDaGF0VGl0bGUoaGFuZGxlOiBudW1iZXIsIGNvbnRleHQ6IElDaGF0QWdlbnRIaXN0b3J5RW50cnlEdG9bXSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxzdHJpbmcgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuX2FnZW50cy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0Y29uc3QgaGlzdG9yeSA9IGF3YWl0IHRoaXMucHJlcGFyZUhpc3RvcnlUdXJucyhhZ2VudC5leHRlbnNpb24sIGFnZW50LmlkLCB7IGhpc3Rvcnk6IGNvbnRleHQgfSk7XG5cdFx0cmV0dXJuIGF3YWl0IGFnZW50LnByb3ZpZGVUaXRsZSh7IGhpc3RvcnkgfSwgdG9rZW4pO1xuXHR9XG5cblx0YXN5bmMgJHByb3ZpZGVTYW1wbGVRdWVzdGlvbnMoaGFuZGxlOiBudW1iZXIsIGxvY2F0aW9uOiBDaGF0QWdlbnRMb2NhdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBhZ2VudCA9IHRoaXMuX2FnZW50cy5nZXQoaGFuZGxlKTtcblx0XHRpZiAoIWFnZW50KSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIChhd2FpdCBhZ2VudC5wcm92aWRlU2FtcGxlUXVlc3Rpb25zKHR5cGVDb252ZXJ0LkNoYXRMb2NhdGlvbi50byhsb2NhdGlvbiksIHRva2VuKSlcblx0XHRcdC5tYXAoZiA9PiB0eXBlQ29udmVydC5DaGF0Rm9sbG93dXAuZnJvbShmLCB1bmRlZmluZWQpKTtcblx0fVxufVxuXG5jbGFzcyBFeHRIb3N0UGFydGljaXBhbnREZXRlY3RvciB7XG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgcHJvdmlkZXI6IHZzY29kZS5DaGF0UGFydGljaXBhbnREZXRlY3Rpb25Qcm92aWRlcixcblx0KSB7IH1cbn1cblxuY2xhc3MgRXh0SG9zdFJlbGF0ZWRGaWxlc1Byb3ZpZGVyIHtcblx0Y29uc3RydWN0b3IoXG5cdFx0cHVibGljIHJlYWRvbmx5IGV4dGVuc2lvbjogSUV4dGVuc2lvbkRlc2NyaXB0aW9uLFxuXHRcdHB1YmxpYyByZWFkb25seSBwcm92aWRlcjogdnNjb2RlLkNoYXRSZWxhdGVkRmlsZXNQcm92aWRlcixcblx0KSB7IH1cbn1cblxuY2xhc3MgRXh0SG9zdENoYXRBZ2VudCB7XG5cblx0cHJpdmF0ZSBfZm9sbG93dXBQcm92aWRlcjogdnNjb2RlLkNoYXRGb2xsb3d1cFByb3ZpZGVyIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9pY29uUGF0aDogdnNjb2RlLlVyaSB8IHsgbGlnaHQ6IHZzY29kZS5Vcmk7IGRhcms6IHZzY29kZS5VcmkgfSB8IHZzY29kZS5UaGVtZUljb24gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2hlbHBUZXh0UHJlZml4OiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2hlbHBUZXh0VmFyaWFibGVzUHJlZml4OiBzdHJpbmcgfCB2c2NvZGUuTWFya2Rvd25TdHJpbmcgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2hlbHBUZXh0UG9zdGZpeDogc3RyaW5nIHwgdnNjb2RlLk1hcmtkb3duU3RyaW5nIHwgdW5kZWZpbmVkO1xuXHRwcml2YXRlIF9vbkRpZFJlY2VpdmVGZWVkYmFjayA9IG5ldyBFbWl0dGVyPHZzY29kZS5DaGF0UmVzdWx0RmVlZGJhY2s+KCk7XG5cdHByaXZhdGUgX29uRGlkUGVyZm9ybUFjdGlvbiA9IG5ldyBFbWl0dGVyPHZzY29kZS5DaGF0VXNlckFjdGlvbkV2ZW50PigpO1xuXHRwcml2YXRlIF9zdXBwb3J0SXNzdWVSZXBvcnRpbmc6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX2FnZW50VmFyaWFibGVQcm92aWRlcj86IHsgcHJvdmlkZXI6IHZzY29kZS5DaGF0UGFydGljaXBhbnRDb21wbGV0aW9uSXRlbVByb3ZpZGVyOyB0cmlnZ2VyQ2hhcmFjdGVyczogc3RyaW5nW10gfTtcblx0cHJpdmF0ZSBfd2VsY29tZU1lc3NhZ2VQcm92aWRlcj86IHZzY29kZS5DaGF0V2VsY29tZU1lc3NhZ2VQcm92aWRlciB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfd2VsY29tZU1lc3NhZ2VDb250ZW50PzogdnNjb2RlLkNoYXRXZWxjb21lTWVzc2FnZUNvbnRlbnQgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3RpdGxlUHJvdmlkZXI/OiB2c2NvZGUuQ2hhdFRpdGxlUHJvdmlkZXIgfCB1bmRlZmluZWQ7XG5cdHByaXZhdGUgX3JlcXVlc3RlcjogdnNjb2RlLkNoYXRSZXF1ZXN0ZXJJbmZvcm1hdGlvbiB8IHVuZGVmaW5lZDtcblx0cHJpdmF0ZSBfcGF1c2VTdGF0ZUVtaXR0ZXIgPSBuZXcgRW1pdHRlcjx2c2NvZGUuQ2hhdFBhcnRpY2lwYW50UGF1c2VTdGF0ZUV2ZW50PigpO1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHB1YmxpYyByZWFkb25seSBleHRlbnNpb246IElFeHRlbnNpb25EZXNjcmlwdGlvbixcblx0XHRwdWJsaWMgcmVhZG9ubHkgaWQ6IHN0cmluZyxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogTWFpblRocmVhZENoYXRBZ2VudHNTaGFwZTIsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfaGFuZGxlOiBudW1iZXIsXG5cdFx0cHJpdmF0ZSBfcmVxdWVzdEhhbmRsZXI6IHZzY29kZS5DaGF0RXh0ZW5kZWRSZXF1ZXN0SGFuZGxlcixcblx0KSB7IH1cblxuXHRhY2NlcHRGZWVkYmFjayhmZWVkYmFjazogdnNjb2RlLkNoYXRSZXN1bHRGZWVkYmFjaykge1xuXHRcdHRoaXMuX29uRGlkUmVjZWl2ZUZlZWRiYWNrLmZpcmUoZmVlZGJhY2spO1xuXHR9XG5cblx0YWNjZXB0QWN0aW9uKGV2ZW50OiB2c2NvZGUuQ2hhdFVzZXJBY3Rpb25FdmVudCkge1xuXHRcdHRoaXMuX29uRGlkUGVyZm9ybUFjdGlvbi5maXJlKGV2ZW50KTtcblx0fVxuXG5cdHNldENoYXRSZXF1ZXN0UGF1c2VTdGF0ZShwYXVzZVN0YXRlOiB2c2NvZGUuQ2hhdFBhcnRpY2lwYW50UGF1c2VTdGF0ZUV2ZW50KSB7XG5cdFx0dGhpcy5fcGF1c2VTdGF0ZUVtaXR0ZXIuZmlyZShwYXVzZVN0YXRlKTtcblx0fVxuXG5cdGFzeW5jIGludm9rZUNvbXBsZXRpb25Qcm92aWRlcihxdWVyeTogc3RyaW5nLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPHZzY29kZS5DaGF0Q29tcGxldGlvbkl0ZW1bXT4ge1xuXHRcdGlmICghdGhpcy5fYWdlbnRWYXJpYWJsZVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuX2FnZW50VmFyaWFibGVQcm92aWRlci5wcm92aWRlci5wcm92aWRlQ29tcGxldGlvbkl0ZW1zKHF1ZXJ5LCB0b2tlbikgPz8gW107XG5cdH1cblxuXHRhc3luYyBwcm92aWRlRm9sbG93dXBzKHJlc3VsdDogdnNjb2RlLkNoYXRSZXN1bHQsIGNvbnRleHQ6IHZzY29kZS5DaGF0Q29udGV4dCwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuQ2hhdEZvbGxvd3VwW10+IHtcblx0XHRpZiAoIXRoaXMuX2ZvbGxvd3VwUHJvdmlkZXIpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cblx0XHRjb25zdCBmb2xsb3d1cHMgPSBhd2FpdCB0aGlzLl9mb2xsb3d1cFByb3ZpZGVyLnByb3ZpZGVGb2xsb3d1cHMocmVzdWx0LCBjb250ZXh0LCB0b2tlbik7XG5cdFx0aWYgKCFmb2xsb3d1cHMpIHtcblx0XHRcdHJldHVybiBbXTtcblx0XHR9XG5cdFx0cmV0dXJuIGZvbGxvd3Vwc1xuXHRcdFx0Ly8gRmlsdGVyIG91dCBcImNvbW1hbmQgZm9sbG93dXBzXCIgZnJvbSBvbGRlciBwcm92aWRlcnNcblx0XHRcdC5maWx0ZXIoZiA9PiAhKGYgJiYgJ2NvbW1hbmRJZCcgaW4gZikpXG5cdFx0XHQvLyBGaWx0ZXIgb3V0IGZvbGxvd3VwcyBmcm9tIG9sZGVyIHByb3ZpZGVycyBiZWZvcmUgJ21lc3NhZ2UnIGNoYW5nZWQgdG8gJ3Byb21wdCdcblx0XHRcdC5maWx0ZXIoZiA9PiAhKGYgJiYgJ21lc3NhZ2UnIGluIGYpKTtcblx0fVxuXG5cdGFzeW5jIHByb3ZpZGVUaXRsZShjb250ZXh0OiB2c2NvZGUuQ2hhdENvbnRleHQsIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8c3RyaW5nIHwgdW5kZWZpbmVkPiB7XG5cdFx0aWYgKCF0aGlzLl90aXRsZVByb3ZpZGVyKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGF3YWl0IHRoaXMuX3RpdGxlUHJvdmlkZXIucHJvdmlkZUNoYXRUaXRsZShjb250ZXh0LCB0b2tlbikgPz8gdW5kZWZpbmVkO1xuXHR9XG5cblx0YXN5bmMgcHJvdmlkZVNhbXBsZVF1ZXN0aW9ucyhsb2NhdGlvbjogdnNjb2RlLkNoYXRMb2NhdGlvbiwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2c2NvZGUuQ2hhdEZvbGxvd3VwW10+IHtcblx0XHRpZiAoIXRoaXMuX3dlbGNvbWVNZXNzYWdlUHJvdmlkZXIgfHwgIXRoaXMuX3dlbGNvbWVNZXNzYWdlUHJvdmlkZXIucHJvdmlkZVNhbXBsZVF1ZXN0aW9ucykge1xuXHRcdFx0cmV0dXJuIFtdO1xuXHRcdH1cblx0XHRjb25zdCBjb250ZW50ID0gYXdhaXQgdGhpcy5fd2VsY29tZU1lc3NhZ2VQcm92aWRlci5wcm92aWRlU2FtcGxlUXVlc3Rpb25zKGxvY2F0aW9uLCB0b2tlbik7XG5cdFx0aWYgKCFjb250ZW50KSB7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGNvbnRlbnQ7XG5cdH1cblxuXHRnZXQgYXBpQWdlbnQoKTogdnNjb2RlLkNoYXRQYXJ0aWNpcGFudCB7XG5cdFx0bGV0IGRpc3Bvc2VkID0gZmFsc2U7XG5cdFx0bGV0IHVwZGF0ZVNjaGVkdWxlZCA9IGZhbHNlO1xuXHRcdGNvbnN0IHVwZGF0ZU1ldGFkYXRhU29vbiA9ICgpID0+IHtcblx0XHRcdGlmIChkaXNwb3NlZCkge1xuXHRcdFx0XHRyZXR1cm47XG5cdFx0XHR9XG5cdFx0XHRpZiAodXBkYXRlU2NoZWR1bGVkKSB7XG5cdFx0XHRcdHJldHVybjtcblx0XHRcdH1cblx0XHRcdHVwZGF0ZVNjaGVkdWxlZCA9IHRydWU7XG5cdFx0XHRxdWV1ZU1pY3JvdGFzaygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3Byb3h5LiR1cGRhdGVBZ2VudCh0aGlzLl9oYW5kbGUsIHtcblx0XHRcdFx0XHRpY29uOiAhdGhpcy5faWNvblBhdGggPyB1bmRlZmluZWQgOlxuXHRcdFx0XHRcdFx0dGhpcy5faWNvblBhdGggaW5zdGFuY2VvZiBVUkkgPyB0aGlzLl9pY29uUGF0aCA6XG5cdFx0XHRcdFx0XHRcdCdsaWdodCcgaW4gdGhpcy5faWNvblBhdGggPyB0aGlzLl9pY29uUGF0aC5saWdodCA6XG5cdFx0XHRcdFx0XHRcdFx0dW5kZWZpbmVkLFxuXHRcdFx0XHRcdGljb25EYXJrOiAhdGhpcy5faWNvblBhdGggPyB1bmRlZmluZWQgOlxuXHRcdFx0XHRcdFx0J2RhcmsnIGluIHRoaXMuX2ljb25QYXRoID8gdGhpcy5faWNvblBhdGguZGFyayA6XG5cdFx0XHRcdFx0XHRcdHVuZGVmaW5lZCxcblx0XHRcdFx0XHR0aGVtZUljb246IHRoaXMuX2ljb25QYXRoIGluc3RhbmNlb2YgZXh0SG9zdFR5cGVzLlRoZW1lSWNvbiA/IHRoaXMuX2ljb25QYXRoIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGhhc0ZvbGxvd3VwczogdGhpcy5fZm9sbG93dXBQcm92aWRlciAhPT0gdW5kZWZpbmVkLFxuXHRcdFx0XHRcdGhlbHBUZXh0UHJlZml4OiAoIXRoaXMuX2hlbHBUZXh0UHJlZml4IHx8IHR5cGVvZiB0aGlzLl9oZWxwVGV4dFByZWZpeCA9PT0gJ3N0cmluZycpID8gdGhpcy5faGVscFRleHRQcmVmaXggOiB0eXBlQ29udmVydC5NYXJrZG93blN0cmluZy5mcm9tKHRoaXMuX2hlbHBUZXh0UHJlZml4KSxcblx0XHRcdFx0XHRoZWxwVGV4dFZhcmlhYmxlc1ByZWZpeDogKCF0aGlzLl9oZWxwVGV4dFZhcmlhYmxlc1ByZWZpeCB8fCB0eXBlb2YgdGhpcy5faGVscFRleHRWYXJpYWJsZXNQcmVmaXggPT09ICdzdHJpbmcnKSA/IHRoaXMuX2hlbHBUZXh0VmFyaWFibGVzUHJlZml4IDogdHlwZUNvbnZlcnQuTWFya2Rvd25TdHJpbmcuZnJvbSh0aGlzLl9oZWxwVGV4dFZhcmlhYmxlc1ByZWZpeCksXG5cdFx0XHRcdFx0aGVscFRleHRQb3N0Zml4OiAoIXRoaXMuX2hlbHBUZXh0UG9zdGZpeCB8fCB0eXBlb2YgdGhpcy5faGVscFRleHRQb3N0Zml4ID09PSAnc3RyaW5nJykgPyB0aGlzLl9oZWxwVGV4dFBvc3RmaXggOiB0eXBlQ29udmVydC5NYXJrZG93blN0cmluZy5mcm9tKHRoaXMuX2hlbHBUZXh0UG9zdGZpeCksXG5cdFx0XHRcdFx0c3VwcG9ydElzc3VlUmVwb3J0aW5nOiB0aGlzLl9zdXBwb3J0SXNzdWVSZXBvcnRpbmcsXG5cdFx0XHRcdFx0cmVxdWVzdGVyOiB0aGlzLl9yZXF1ZXN0ZXIsXG5cdFx0XHRcdFx0d2VsY29tZU1lc3NhZ2VDb250ZW50OiB0aGlzLl93ZWxjb21lTWVzc2FnZUNvbnRlbnQgJiYge1xuXHRcdFx0XHRcdFx0Li4udGhpcy5fd2VsY29tZU1lc3NhZ2VDb250ZW50LFxuXHRcdFx0XHRcdFx0bWVzc2FnZTogdHlwZUNvbnZlcnQuTWFya2Rvd25TdHJpbmcuZnJvbSh0aGlzLl93ZWxjb21lTWVzc2FnZUNvbnRlbnQubWVzc2FnZSksXG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9KTtcblx0XHRcdFx0dXBkYXRlU2NoZWR1bGVkID0gZmFsc2U7XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0Y29uc3QgdGhhdCA9IHRoaXM7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGdldCBpZCgpIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuaWQ7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGljb25QYXRoKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5faWNvblBhdGg7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGljb25QYXRoKHYpIHtcblx0XHRcdFx0dGhhdC5faWNvblBhdGggPSB2O1xuXHRcdFx0XHR1cGRhdGVNZXRhZGF0YVNvb24oKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgcmVxdWVzdEhhbmRsZXIoKSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9yZXF1ZXN0SGFuZGxlcjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgcmVxdWVzdEhhbmRsZXIodikge1xuXHRcdFx0XHRhc3NlcnRUeXBlKHR5cGVvZiB2ID09PSAnZnVuY3Rpb24nLCAnSW52YWxpZCByZXF1ZXN0IGhhbmRsZXInKTtcblx0XHRcdFx0dGhhdC5fcmVxdWVzdEhhbmRsZXIgPSB2O1xuXHRcdFx0fSxcblx0XHRcdGdldCBmb2xsb3d1cFByb3ZpZGVyKCkge1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fZm9sbG93dXBQcm92aWRlcjtcblx0XHRcdH0sXG5cdFx0XHRzZXQgZm9sbG93dXBQcm92aWRlcih2KSB7XG5cdFx0XHRcdHRoYXQuX2ZvbGxvd3VwUHJvdmlkZXIgPSB2O1xuXHRcdFx0XHR1cGRhdGVNZXRhZGF0YVNvb24oKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgaGVscFRleHRQcmVmaXgoKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuZXh0ZW5zaW9uLCAnZGVmYXVsdENoYXRQYXJ0aWNpcGFudCcpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5faGVscFRleHRQcmVmaXg7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IGhlbHBUZXh0UHJlZml4KHYpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdkZWZhdWx0Q2hhdFBhcnRpY2lwYW50Jyk7XG5cdFx0XHRcdHRoYXQuX2hlbHBUZXh0UHJlZml4ID0gdjtcblx0XHRcdFx0dXBkYXRlTWV0YWRhdGFTb29uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IGhlbHBUZXh0VmFyaWFibGVzUHJlZml4KCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2RlZmF1bHRDaGF0UGFydGljaXBhbnQnKTtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX2hlbHBUZXh0VmFyaWFibGVzUHJlZml4O1xuXHRcdFx0fSxcblx0XHRcdHNldCBoZWxwVGV4dFZhcmlhYmxlc1ByZWZpeCh2KSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuZXh0ZW5zaW9uLCAnZGVmYXVsdENoYXRQYXJ0aWNpcGFudCcpO1xuXHRcdFx0XHR0aGF0Ll9oZWxwVGV4dFZhcmlhYmxlc1ByZWZpeCA9IHY7XG5cdFx0XHRcdHVwZGF0ZU1ldGFkYXRhU29vbigpO1xuXHRcdFx0fSxcblx0XHRcdGdldCBoZWxwVGV4dFBvc3RmaXgoKSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuZXh0ZW5zaW9uLCAnZGVmYXVsdENoYXRQYXJ0aWNpcGFudCcpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5faGVscFRleHRQb3N0Zml4O1xuXHRcdFx0fSxcblx0XHRcdHNldCBoZWxwVGV4dFBvc3RmaXgodikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2RlZmF1bHRDaGF0UGFydGljaXBhbnQnKTtcblx0XHRcdFx0dGhhdC5faGVscFRleHRQb3N0Zml4ID0gdjtcblx0XHRcdFx0dXBkYXRlTWV0YWRhdGFTb29uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHN1cHBvcnRJc3N1ZVJlcG9ydGluZygpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRQcml2YXRlJyk7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9zdXBwb3J0SXNzdWVSZXBvcnRpbmc7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHN1cHBvcnRJc3N1ZVJlcG9ydGluZyh2KSB7XG5cdFx0XHRcdGNoZWNrUHJvcG9zZWRBcGlFbmFibGVkKHRoYXQuZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50UHJpdmF0ZScpO1xuXHRcdFx0XHR0aGF0Ll9zdXBwb3J0SXNzdWVSZXBvcnRpbmcgPSB2O1xuXHRcdFx0XHR1cGRhdGVNZXRhZGF0YVNvb24oKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgb25EaWRSZWNlaXZlRmVlZGJhY2soKSB7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll9vbkRpZFJlY2VpdmVGZWVkYmFjay5ldmVudDtcblx0XHRcdH0sXG5cdFx0XHRzZXQgcGFydGljaXBhbnRWYXJpYWJsZVByb3ZpZGVyKHYpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblx0XHRcdFx0dGhhdC5fYWdlbnRWYXJpYWJsZVByb3ZpZGVyID0gdjtcblx0XHRcdFx0aWYgKHYpIHtcblx0XHRcdFx0XHRpZiAoIXYudHJpZ2dlckNoYXJhY3RlcnMubGVuZ3RoKSB7XG5cdFx0XHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ3RyaWdnZXJDaGFyYWN0ZXJzIGFyZSByZXF1aXJlZCcpO1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdHRoYXQuX3Byb3h5LiRyZWdpc3RlckFnZW50Q29tcGxldGlvbnNQcm92aWRlcih0aGF0Ll9oYW5kbGUsIHRoYXQuaWQsIHYudHJpZ2dlckNoYXJhY3RlcnMpO1xuXHRcdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRcdHRoYXQuX3Byb3h5LiR1bnJlZ2lzdGVyQWdlbnRDb21wbGV0aW9uc1Byb3ZpZGVyKHRoYXQuX2hhbmRsZSwgdGhhdC5pZCk7XG5cdFx0XHRcdH1cblx0XHRcdH0sXG5cdFx0XHRnZXQgcGFydGljaXBhbnRWYXJpYWJsZVByb3ZpZGVyKCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2NoYXRQYXJ0aWNpcGFudEFkZGl0aW9ucycpO1xuXHRcdFx0XHRyZXR1cm4gdGhhdC5fYWdlbnRWYXJpYWJsZVByb3ZpZGVyO1xuXHRcdFx0fSxcblx0XHRcdHNldCB3ZWxjb21lTWVzc2FnZVByb3ZpZGVyKHYpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdkZWZhdWx0Q2hhdFBhcnRpY2lwYW50Jyk7XG5cdFx0XHRcdHRoYXQuX3dlbGNvbWVNZXNzYWdlUHJvdmlkZXIgPSB2O1xuXHRcdFx0XHR1cGRhdGVNZXRhZGF0YVNvb24oKTtcblx0XHRcdH0sXG5cdFx0XHRnZXQgd2VsY29tZU1lc3NhZ2VQcm92aWRlcigpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdkZWZhdWx0Q2hhdFBhcnRpY2lwYW50Jyk7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll93ZWxjb21lTWVzc2FnZVByb3ZpZGVyO1xuXHRcdFx0fSxcblx0XHRcdHNldCB3ZWxjb21lTWVzc2FnZUNvbnRlbnQodikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2RlZmF1bHRDaGF0UGFydGljaXBhbnQnKTtcblx0XHRcdFx0dGhhdC5fd2VsY29tZU1lc3NhZ2VDb250ZW50ID0gdjtcblx0XHRcdFx0dXBkYXRlTWV0YWRhdGFTb29uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHdlbGNvbWVNZXNzYWdlQ29udGVudCgpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdkZWZhdWx0Q2hhdFBhcnRpY2lwYW50Jyk7XG5cdFx0XHRcdHJldHVybiB0aGF0Ll93ZWxjb21lTWVzc2FnZUNvbnRlbnQ7XG5cdFx0XHR9LFxuXHRcdFx0c2V0IHRpdGxlUHJvdmlkZXIodikge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2RlZmF1bHRDaGF0UGFydGljaXBhbnQnKTtcblx0XHRcdFx0dGhhdC5fdGl0bGVQcm92aWRlciA9IHY7XG5cdFx0XHRcdHVwZGF0ZU1ldGFkYXRhU29vbigpO1xuXHRcdFx0fSxcblx0XHRcdGdldCB0aXRsZVByb3ZpZGVyKCkge1xuXHRcdFx0XHRjaGVja1Byb3Bvc2VkQXBpRW5hYmxlZCh0aGF0LmV4dGVuc2lvbiwgJ2RlZmF1bHRDaGF0UGFydGljaXBhbnQnKTtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3RpdGxlUHJvdmlkZXI7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IG9uRGlkQ2hhbmdlUGF1c2VTdGF0ZSgpIHtcblx0XHRcdFx0Y2hlY2tQcm9wb3NlZEFwaUVuYWJsZWQodGhhdC5leHRlbnNpb24sICdjaGF0UGFydGljaXBhbnRBZGRpdGlvbnMnKTtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3BhdXNlU3RhdGVFbWl0dGVyLmV2ZW50O1xuXHRcdFx0fSxcblx0XHRcdG9uRGlkUGVyZm9ybUFjdGlvbjogIWlzUHJvcG9zZWRBcGlFbmFibGVkKHRoaXMuZXh0ZW5zaW9uLCAnY2hhdFBhcnRpY2lwYW50QWRkaXRpb25zJylcblx0XHRcdFx0PyB1bmRlZmluZWQhXG5cdFx0XHRcdDogdGhpcy5fb25EaWRQZXJmb3JtQWN0aW9uLmV2ZW50XG5cdFx0XHQsXG5cdFx0XHRzZXQgcmVxdWVzdGVyKHYpIHtcblx0XHRcdFx0dGhhdC5fcmVxdWVzdGVyID0gdjtcblx0XHRcdFx0dXBkYXRlTWV0YWRhdGFTb29uKCk7XG5cdFx0XHR9LFxuXHRcdFx0Z2V0IHJlcXVlc3RlcigpIHtcblx0XHRcdFx0cmV0dXJuIHRoYXQuX3JlcXVlc3Rlcjtcblx0XHRcdH0sXG5cdFx0XHRkaXNwb3NlKCkge1xuXHRcdFx0XHRkaXNwb3NlZCA9IHRydWU7XG5cdFx0XHRcdHRoYXQuX2ZvbGxvd3VwUHJvdmlkZXIgPSB1bmRlZmluZWQ7XG5cdFx0XHRcdHRoYXQuX29uRGlkUmVjZWl2ZUZlZWRiYWNrLmRpc3Bvc2UoKTtcblx0XHRcdFx0dGhhdC5fcHJveHkuJHVucmVnaXN0ZXJBZ2VudCh0aGF0Ll9oYW5kbGUpO1xuXHRcdFx0fSxcblx0XHR9IHNhdGlzZmllcyB2c2NvZGUuQ2hhdFBhcnRpY2lwYW50O1xuXHR9XG5cblx0aW52b2tlKHJlcXVlc3Q6IHZzY29kZS5DaGF0UmVxdWVzdCwgY29udGV4dDogdnNjb2RlLkNoYXRDb250ZXh0LCByZXNwb25zZTogdnNjb2RlLkNoYXRSZXNwb25zZVN0cmVhbSwgdG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogdnNjb2RlLlByb3ZpZGVyUmVzdWx0PHZzY29kZS5DaGF0UmVzdWx0IHwgdm9pZD4ge1xuXHRcdHJldHVybiB0aGlzLl9yZXF1ZXN0SGFuZGxlcihyZXF1ZXN0LCBjb250ZXh0LCByZXNwb25zZSwgdG9rZW4pO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiQUFNQSxTQUFTLFVBQVUsdUJBQXVCO0FBQzFDLFNBQVMsd0JBQXdCO0FBQ2pDLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFTLHNCQUFzQjtBQUMvQixTQUFTLGVBQWU7QUFDeEIsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyxZQUFZLGVBQWUsaUJBQWlCLG9CQUFvQjtBQUN6RSxTQUFTLGNBQWM7QUFDdkIsU0FBUyxpQkFBaUI7QUFDMUIsU0FBUyxrQkFBa0I7QUFDM0IsU0FBUyxXQUFXO0FBQ3BCLFNBQVMsb0JBQW9CO0FBRTdCLFNBQVMsMkJBQWdGO0FB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
