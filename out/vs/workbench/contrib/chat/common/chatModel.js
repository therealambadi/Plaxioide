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
import { asArray } from "../../../../base/common/arrays.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { Codicon } from "../../../../base/common/codicons.js";
import { Emitter } from "../../../../base/common/event.js";
import { MarkdownString, isMarkdownString } from "../../../../base/common/htmlContent.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { revive } from "../../../../base/common/marshalling.js";
import { Schemas } from "../../../../base/common/network.js";
import { equals } from "../../../../base/common/objects.js";
import { ObservablePromise, observableValue } from "../../../../base/common/observable.js";
import { basename, isEqual } from "../../../../base/common/resources.js";
import { URI, isUriComponents } from "../../../../base/common/uri.js";
import { generateUuid } from "../../../../base/common/uuid.js";
import { OffsetRange } from "../../../../editor/common/core/offsetRange.js";
import { TextEdit } from "../../../../editor/common/languages.js";
import { localize } from "../../../../nls.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { CellUri } from "../../notebook/common/notebookCommon.js";
import { IChatAgentService, reviveSerializedAgent } from "./chatAgents.js";
import { IChatEditingService } from "./chatEditingService.js";
import { ChatRequestTextPart, reviveParsedChatRequest } from "./chatParserTypes.js";
import { isIUsedContext } from "./chatService.js";
import { ChatAgentLocation } from "./constants.js";
var IDiagnosticVariableEntryFilterData;
((IDiagnosticVariableEntryFilterData2) => {
  IDiagnosticVariableEntryFilterData2.icon = Codicon.error;
  function fromMarker(marker) {
    return {
      filterUri: marker.resource,
      owner: marker.owner,
      problemMessage: marker.message,
      filterRange: { startLineNumber: marker.startLineNumber, endLineNumber: marker.endLineNumber, startColumn: marker.startColumn, endColumn: marker.endColumn }
    };
  }
  IDiagnosticVariableEntryFilterData2.fromMarker = fromMarker;
  function toEntry(data) {
    return {
      id: id(data),
      name: label(data),
      icon: IDiagnosticVariableEntryFilterData2.icon,
      value: data,
      kind: "diagnostic",
      range: data.filterRange ? new OffsetRange(data.filterRange.startLineNumber, data.filterRange.endLineNumber) : void 0,
      ...data
    };
  }
  IDiagnosticVariableEntryFilterData2.toEntry = toEntry;
  function id(data) {
    return [data.filterUri, data.owner, data.filterSeverity, data.filterRange?.startLineNumber].join(":");
  }
  IDiagnosticVariableEntryFilterData2.id = id;
  function label(data) {
    let TrimThreshold;
    ((TrimThreshold2) => {
      TrimThreshold2[TrimThreshold2["MaxChars"] = 30] = "MaxChars";
      TrimThreshold2[TrimThreshold2["MaxSpaceLookback"] = 10] = "MaxSpaceLookback";
    })(TrimThreshold || (TrimThreshold = {}));
    if (data.problemMessage) {
      if (data.problemMessage.length < 30 /* MaxChars */) {
        return data.problemMessage;
      }
      const lastSpace = data.problemMessage.lastIndexOf(" ", 30 /* MaxChars */);
      if (lastSpace === -1 || lastSpace + 10 /* MaxSpaceLookback */ < 30 /* MaxChars */) {
        return data.problemMessage.substring(0, 30 /* MaxChars */) + "\u2026";
      }
      return data.problemMessage.substring(0, lastSpace) + "\u2026";
    }
    let labelStr = localize("chat.attachment.problems.all", "All Problems");
    if (data.filterUri) {
      labelStr = localize("chat.attachment.problems.inFile", "Problems in {0}", basename(data.filterUri));
    }
    return labelStr;
  }
  IDiagnosticVariableEntryFilterData2.label = label;
})(IDiagnosticVariableEntryFilterData || (IDiagnosticVariableEntryFilterData = {}));
function isImplicitVariableEntry(obj) {
  return obj.kind === "implicit";
}
function isPasteVariableEntry(obj) {
  return obj.kind === "paste";
}
function isImageVariableEntry(obj) {
  return obj.kind === "image";
}
function isDiagnosticsVariableEntry(obj) {
  return obj.kind === "diagnostic";
}
function isChatRequestVariableEntry(obj) {
  const entry = obj;
  return typeof entry === "object" && entry !== null && typeof entry.id === "string" && typeof entry.name === "string";
}
function isCellTextEditOperation(value) {
  const candidate = value;
  return !!candidate && !!candidate.edit && !!candidate.uri && URI.isUri(candidate.uri);
}
const nonHistoryKinds = /* @__PURE__ */ new Set(["toolInvocation", "toolInvocationSerialized"]);
function isChatProgressHistoryResponseContent(content) {
  return !nonHistoryKinds.has(content.kind);
}
function toChatHistoryContent(content) {
  return content.filter(isChatProgressHistoryResponseContent);
}
const defaultChatResponseModelChangeReason = { reason: "other" };
class ChatRequestModel {
  constructor(_session, message, _variableData, timestamp, _attempt = 0, _confirmation, _locationData, _attachedContext, isCompleteAddedRequest = false, modelId, restoredId) {
    this._session = _session;
    this.message = message;
    this._variableData = _variableData;
    this.timestamp = timestamp;
    this._attempt = _attempt;
    this._confirmation = _confirmation;
    this._locationData = _locationData;
    this._attachedContext = _attachedContext;
    this.isCompleteAddedRequest = isCompleteAddedRequest;
    this.modelId = modelId;
    this.id = restoredId ?? "request_" + generateUuid();
  }
  get session() {
    return this._session;
  }
  get username() {
    return this.session.requesterUsername;
  }
  get avatarIconUri() {
    return this.session.requesterAvatarIconUri;
  }
  get attempt() {
    return this._attempt;
  }
  get variableData() {
    return this._variableData;
  }
  set variableData(v) {
    this._variableData = v;
  }
  get confirmation() {
    return this._confirmation;
  }
  get locationData() {
    return this._locationData;
  }
  get attachedContext() {
    return this._attachedContext;
  }
  adoptTo(session) {
    this._session = session;
  }
}
class AbstractResponse {
  constructor(value) {
    /**
     * A stringified representation of response data which might be presented to a screenreader or used when copying a response.
     */
    this._responseRepr = "";
    /**
     * Just the markdown content of the response, used for determining the rendering rate of markdown
     */
    this._markdownContent = "";
    this._responseParts = value;
    this._updateRepr();
  }
  get value() {
    return this._responseParts;
  }
  toString() {
    return this._responseRepr;
  }
  /**
   * _Just_ the content of markdown parts in the response
   */
  getMarkdown() {
    return this._markdownContent;
  }
  _updateRepr() {
    this._responseRepr = this.partsToRepr(this._responseParts);
    this._markdownContent = this._responseParts.map((part) => {
      if (part.kind === "inlineReference") {
        return this.inlineRefToRepr(part);
      } else if (part.kind === "markdownContent" || part.kind === "markdownVuln") {
        return part.content.value;
      } else {
        return "";
      }
    }).filter((s) => s.length > 0).join("");
  }
  partsToRepr(parts) {
    const blocks = [];
    let currentBlockSegments = [];
    for (const part of parts) {
      let segment;
      switch (part.kind) {
        case "treeData":
        case "progressMessage":
        case "codeblockUri":
        case "toolInvocation":
        case "toolInvocationSerialized":
        case "undoStop":
          continue;
        case "inlineReference":
          segment = { text: this.inlineRefToRepr(part) };
          break;
        case "command":
          segment = { text: part.command.title, isBlock: true };
          break;
        case "textEditGroup":
        case "notebookEditGroup":
          segment = { text: localize("editsSummary", "Made changes."), isBlock: true };
          break;
        case "confirmation":
          segment = { text: `${part.title}
${part.message}`, isBlock: true };
          break;
        default:
          segment = { text: part.content.value };
          break;
      }
      if (segment.isBlock) {
        if (currentBlockSegments.length) {
          blocks.push(currentBlockSegments.join(""));
          currentBlockSegments = [];
        }
        blocks.push(segment.text);
      } else {
        currentBlockSegments.push(segment.text);
      }
    }
    if (currentBlockSegments.length) {
      blocks.push(currentBlockSegments.join(""));
    }
    return blocks.join("\n\n");
  }
  inlineRefToRepr(part) {
    if ("uri" in part.inlineReference) {
      return this.uriToRepr(part.inlineReference.uri);
    }
    return "name" in part.inlineReference ? "`" + part.inlineReference.name + "`" : this.uriToRepr(part.inlineReference);
  }
  uriToRepr(uri) {
    if (uri.scheme === Schemas.http || uri.scheme === Schemas.https) {
      return uri.toString(false);
    }
    return basename(uri);
  }
}
class ResponseView extends AbstractResponse {
  constructor(_response, undoStop) {
    const idx = _response.value.findIndex((v) => v.kind === "undoStop" && v.id === undoStop);
    super(idx === -1 ? _response.value.slice() : _response.value.slice(0, idx));
    this.undoStop = undoStop;
  }
}
class Response extends AbstractResponse {
  constructor(value) {
    super(asArray(value).map((v) => isMarkdownString(v) ? { content: v, kind: "markdownContent" } : "kind" in v ? v : { kind: "treeData", treeData: v }));
    this._onDidChangeValue = new Emitter();
    this._citations = [];
  }
  get onDidChangeValue() {
    return this._onDidChangeValue.event;
  }
  dispose() {
    this._onDidChangeValue.dispose();
  }
  clear() {
    this._responseParts = [];
    this._updateRepr(true);
  }
  updateContent(progress, quiet) {
    if (progress.kind === "markdownContent") {
      const lastResponsePart = this._responseParts.filter((p) => p.kind !== "textEditGroup").at(-1);
      if (!lastResponsePart || lastResponsePart.kind !== "markdownContent" || !canMergeMarkdownStrings(lastResponsePart.content, progress.content)) {
        this._responseParts.push(progress);
      } else {
        const idx = this._responseParts.indexOf(lastResponsePart);
        this._responseParts[idx] = { ...lastResponsePart, content: appendMarkdownString(lastResponsePart.content, progress.content) };
      }
      this._updateRepr(quiet);
    } else if (progress.kind === "textEdit" || progress.kind === "notebookEdit") {
      const useOldApproachForInlineNotebook = progress.uri.scheme === Schemas.vscodeNotebookCell && !this._responseParts.find((part) => part.kind === "notebookEditGroup");
      const notebookUri = useOldApproachForInlineNotebook ? void 0 : CellUri.parse(progress.uri)?.notebook;
      const uri = notebookUri ?? progress.uri;
      let found = false;
      const groupKind = progress.kind === "textEdit" && !notebookUri ? "textEditGroup" : "notebookEditGroup";
      const edits = groupKind === "textEditGroup" ? progress.edits : progress.edits.map((edit) => TextEdit.isTextEdit(edit) ? { uri: progress.uri, edit } : edit);
      for (let i = 0; !found && i < this._responseParts.length; i++) {
        const candidate = this._responseParts[i];
        if (candidate.kind === groupKind && !candidate.done && isEqual(candidate.uri, uri)) {
          candidate.edits.push(edits);
          candidate.done = progress.done;
          found = true;
        }
      }
      if (!found) {
        this._responseParts.push({
          kind: groupKind,
          uri,
          edits: groupKind === "textEditGroup" ? [edits] : edits,
          done: progress.done
        });
      }
      this._updateRepr(quiet);
    } else if (progress.kind === "progressTask") {
      const responsePosition = this._responseParts.push(progress) - 1;
      this._updateRepr(quiet);
      const disp = progress.onDidAddProgress(() => {
        this._updateRepr(false);
      });
      progress.task?.().then((content) => {
        disp.dispose();
        if (typeof content === "string") {
          this._responseParts[responsePosition].content = new MarkdownString(content);
        }
        this._updateRepr(false);
      });
    } else if (progress.kind === "toolInvocation") {
      if (progress.confirmationMessages) {
        progress.confirmed.p.then(() => {
          this._updateRepr(false);
        });
      }
      progress.isCompletePromise.then(() => {
        this._updateRepr(false);
      });
      this._responseParts.push(progress);
      this._updateRepr(quiet);
    } else {
      this._responseParts.push(progress);
      this._updateRepr(quiet);
    }
  }
  addCitation(citation) {
    this._citations.push(citation);
    this._updateRepr();
  }
  _updateRepr(quiet) {
    super._updateRepr();
    if (!this._onDidChangeValue) {
      return;
    }
    this._responseRepr += this._citations.length ? "\n\n" + getCodeCitationsMessage(this._citations) : "";
    if (!quiet) {
      this._onDidChangeValue.fire();
    }
  }
}
class ChatResponseModel extends Disposable {
  constructor(_response, _session, _agent, _slashCommand, requestId, _isComplete = false, _isCanceled = false, _vote, _voteDownReason, _result, followups, isCompleteAddedRequest = false, _shouldBeRemovedOnSend = void 0, restoredId) {
    super();
    this._session = _session;
    this._agent = _agent;
    this._slashCommand = _slashCommand;
    this.requestId = requestId;
    this._isComplete = _isComplete;
    this._isCanceled = _isCanceled;
    this._vote = _vote;
    this._voteDownReason = _voteDownReason;
    this._result = _result;
    this.isCompleteAddedRequest = isCompleteAddedRequest;
    this._shouldBeRemovedOnSend = _shouldBeRemovedOnSend;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._contentReferences = [];
    this._codeCitations = [];
    this._progressMessages = [];
    this._isStale = false;
    this._isPaused = observableValue("isPaused", false);
    this._isStale = Array.isArray(_response) && (_response.length !== 0 || isMarkdownString(_response) && _response.value.length !== 0);
    this._followups = followups ? [...followups] : void 0;
    this._response = this._register(new Response(_response));
    this._register(this._response.onDidChangeValue(() => this._onDidChange.fire(defaultChatResponseModelChangeReason)));
    this.id = restoredId ?? "response_" + generateUuid();
  }
  get session() {
    return this._session;
  }
  get shouldBeRemovedOnSend() {
    return this._shouldBeRemovedOnSend;
  }
  get isComplete() {
    return this._isComplete;
  }
  set shouldBeRemovedOnSend(disablement) {
    this._shouldBeRemovedOnSend = disablement;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  get isCanceled() {
    return this._isCanceled;
  }
  get vote() {
    return this._vote;
  }
  get voteDownReason() {
    return this._voteDownReason;
  }
  get followups() {
    return this._followups;
  }
  get entireResponse() {
    return this._finalizedResponse || this._response;
  }
  get result() {
    return this._result;
  }
  get username() {
    return this.session.responderUsername;
  }
  get avatarIcon() {
    return this.session.responderAvatarIcon;
  }
  get agent() {
    return this._agent;
  }
  get slashCommand() {
    return this._slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._agentOrSlashCommandDetected ?? false;
  }
  get usedContext() {
    return this._usedContext;
  }
  get contentReferences() {
    return Array.from(this._contentReferences);
  }
  get codeCitations() {
    return this._codeCitations;
  }
  get progressMessages() {
    return this._progressMessages;
  }
  get isStale() {
    return this._isStale;
  }
  get isPaused() {
    return this._isPaused;
  }
  get isPendingConfirmation() {
    return this._response.value.some((part) => part.kind === "toolInvocation" && part.isConfirmed === void 0 || part.kind === "confirmation" && part.isUsed === false);
  }
  get response() {
    const undoStop = this._shouldBeRemovedOnSend?.afterUndoStop;
    if (!undoStop) {
      return this._finalizedResponse || this._response;
    }
    if (this._responseView?.undoStop !== undoStop) {
      this._responseView = new ResponseView(this._response, undoStop);
    }
    return this._responseView;
  }
  /**
   * Apply a progress update to the actual response content.
   */
  updateContent(responsePart, quiet) {
    this.bufferWhenPaused(() => this._response.updateContent(responsePart, quiet));
  }
  /**
   * Adds an undo stop at the current position in the stream.
   */
  addUndoStop(undoStop) {
    this.bufferWhenPaused(() => {
      this._onDidChange.fire({ reason: "undoStop", id: undoStop.id });
      this._response.updateContent(undoStop, true);
    });
  }
  /**
   * Apply one of the progress updates that are not part of the actual response content.
   */
  applyReference(progress) {
    if (progress.kind === "usedContext") {
      this._usedContext = progress;
    } else if (progress.kind === "reference") {
      this._contentReferences.push(progress);
      this._onDidChange.fire(defaultChatResponseModelChangeReason);
    }
  }
  applyCodeCitation(progress) {
    this._codeCitations.push(progress);
    this._response.addCitation(progress);
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setAgent(agent, slashCommand) {
    this._agent = agent;
    this._slashCommand = slashCommand;
    this._agentOrSlashCommandDetected = !agent.isDefault || !!slashCommand;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setResult(result) {
    this._result = result;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  complete() {
    if (this._result?.errorDetails?.responseIsRedacted) {
      this._response.clear();
    }
    this._isComplete = true;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  cancel() {
    this._isComplete = true;
    this._isCanceled = true;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setFollowups(followups) {
    this._followups = followups;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setVote(vote) {
    this._vote = vote;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setVoteDownReason(reason) {
    this._voteDownReason = reason;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setEditApplied(edit, editCount) {
    if (!this.response.value.includes(edit)) {
      return false;
    }
    if (!edit.state) {
      return false;
    }
    edit.state.applied = editCount;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
    return true;
  }
  adoptTo(session) {
    this._session = session;
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
  }
  setPaused(isPause, tx) {
    this._isPaused.set(isPause, tx);
    this._onDidChange.fire(defaultChatResponseModelChangeReason);
    this.bufferedPauseContent?.forEach((f) => f());
    this.bufferedPauseContent = void 0;
  }
  finalizeUndoState() {
    this._finalizedResponse = this.response;
    this._responseView = void 0;
    this._shouldBeRemovedOnSend = void 0;
  }
  bufferWhenPaused(apply) {
    if (!this._isPaused.get()) {
      apply();
    } else {
      this.bufferedPauseContent ??= [];
      this.bufferedPauseContent.push(apply);
    }
  }
}
var ChatPauseState = /* @__PURE__ */ ((ChatPauseState2) => {
  ChatPauseState2[ChatPauseState2["NotPausable"] = 0] = "NotPausable";
  ChatPauseState2[ChatPauseState2["Paused"] = 1] = "Paused";
  ChatPauseState2[ChatPauseState2["Unpaused"] = 2] = "Unpaused";
  return ChatPauseState2;
})(ChatPauseState || {});
function normalizeSerializableChatData(raw) {
  normalizeOldFields(raw);
  if (!("version" in raw)) {
    return {
      version: 3,
      ...raw,
      lastMessageDate: raw.creationDate,
      customTitle: void 0
    };
  }
  if (raw.version === 2) {
    return {
      ...raw,
      version: 3,
      customTitle: raw.computedTitle
    };
  }
  return raw;
}
function normalizeOldFields(raw) {
  if (!raw.sessionId) {
    raw.sessionId = generateUuid();
  }
  if (!raw.creationDate) {
    raw.creationDate = getLastYearDate();
  }
  if ("version" in raw && (raw.version === 2 || raw.version === 3)) {
    if (!raw.lastMessageDate) {
      raw.lastMessageDate = getLastYearDate();
    }
  }
}
function getLastYearDate() {
  const lastYearDate = /* @__PURE__ */ new Date();
  lastYearDate.setFullYear(lastYearDate.getFullYear() - 1);
  return lastYearDate.getTime();
}
function isExportableSessionData(obj) {
  const data = obj;
  return typeof data === "object" && typeof data.requesterUsername === "string";
}
function isSerializableSessionData(obj) {
  const data = obj;
  return isExportableSessionData(obj) && typeof data.creationDate === "number" && typeof data.sessionId === "string" && obj.requests.every(
    (request) => !request.usedContext || isIUsedContext(request.usedContext)
  );
}
var ChatRequestRemovalReason = /* @__PURE__ */ ((ChatRequestRemovalReason2) => {
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Removal"] = 0] = "Removal";
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Resend"] = 1] = "Resend";
  ChatRequestRemovalReason2[ChatRequestRemovalReason2["Adoption"] = 2] = "Adoption";
  return ChatRequestRemovalReason2;
})(ChatRequestRemovalReason || {});
var ChatModelInitState = /* @__PURE__ */ ((ChatModelInitState2) => {
  ChatModelInitState2[ChatModelInitState2["Created"] = 0] = "Created";
  ChatModelInitState2[ChatModelInitState2["Initializing"] = 1] = "Initializing";
  ChatModelInitState2[ChatModelInitState2["Initialized"] = 2] = "Initialized";
  return ChatModelInitState2;
})(ChatModelInitState || {});
let ChatModel = class extends Disposable {
  constructor(initialData, _initialLocation, logService, chatAgentService, chatEditingService) {
    super();
    this.initialData = initialData;
    this._initialLocation = _initialLocation;
    this.logService = logService;
    this.chatAgentService = chatAgentService;
    this.chatEditingService = chatEditingService;
    this._onDidDispose = this._register(new Emitter());
    this.onDidDispose = this._onDidDispose.event;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._initState = 0 /* Created */;
    this._isInitializedDeferred = new DeferredPromise();
    this._isImported = false;
    this._checkpoint = void 0;
    const isValid = isSerializableSessionData(initialData);
    if (initialData && !isValid) {
      this.logService.warn(`ChatModel#constructor: Loaded malformed session data: ${JSON.stringify(initialData)}`);
    }
    this._isImported = !!initialData && !isValid || (initialData?.isImported ?? false);
    this._sessionId = isValid && initialData.sessionId || generateUuid();
    this._requests = initialData ? this._deserialize(initialData) : [];
    this._creationDate = isValid && initialData.creationDate || Date.now();
    this._lastMessageDate = isValid && initialData.lastMessageDate || this._creationDate;
    this._customTitle = isValid ? initialData.customTitle : void 0;
    this._initialRequesterAvatarIconUri = initialData?.requesterAvatarIconUri && URI.revive(initialData.requesterAvatarIconUri);
    this._initialResponderAvatarIconUri = isUriComponents(initialData?.responderAvatarIconUri) ? URI.revive(initialData.responderAvatarIconUri) : initialData?.responderAvatarIconUri;
  }
  static getDefaultTitle(requests) {
    const firstRequestMessage = requests.at(0)?.message ?? "";
    const message = typeof firstRequestMessage === "string" ? firstRequestMessage : firstRequestMessage.text;
    return message.split("\n")[0].substring(0, 50);
  }
  get sampleQuestions() {
    return this._sampleQuestions;
  }
  get sessionId() {
    return this._sessionId;
  }
  get requestInProgress() {
    const lastRequest = this.lastRequest;
    if (!lastRequest?.response) {
      return false;
    }
    if (lastRequest.response.isPendingConfirmation) {
      return false;
    }
    return !lastRequest.response.isComplete;
  }
  get requestPausibility() {
    const lastRequest = this.lastRequest;
    if (!lastRequest?.response?.agent || lastRequest.response.isComplete || lastRequest.response.isPendingConfirmation) {
      return 0 /* NotPausable */;
    }
    return lastRequest.response.isPaused.get() ? 1 /* Paused */ : 2 /* Unpaused */;
  }
  get hasRequests() {
    return this._requests.length > 0;
  }
  get lastRequest() {
    return this._requests.at(-1);
  }
  get creationDate() {
    return this._creationDate;
  }
  get lastMessageDate() {
    return this._lastMessageDate;
  }
  get _defaultAgent() {
    return this.chatAgentService.getDefaultAgent(ChatAgentLocation.Panel);
  }
  get requesterUsername() {
    return this._defaultAgent?.metadata.requester?.name ?? this.initialData?.requesterUsername ?? "";
  }
  get responderUsername() {
    return this._defaultAgent?.fullName ?? this.initialData?.responderUsername ?? "";
  }
  get requesterAvatarIconUri() {
    return this._defaultAgent?.metadata.requester?.icon ?? this._initialRequesterAvatarIconUri;
  }
  get responderAvatarIcon() {
    return this._defaultAgent?.metadata.themeIcon ?? this._initialResponderAvatarIconUri;
  }
  get initState() {
    return this._initState;
  }
  get isImported() {
    return this._isImported;
  }
  get customTitle() {
    return this._customTitle;
  }
  get title() {
    return this._customTitle || ChatModel.getDefaultTitle(this._requests);
  }
  get initialLocation() {
    return this._initialLocation;
  }
  get editingSessionObs() {
    return this._editingSession;
  }
  get editingSession() {
    return this._editingSession?.promiseResult.get()?.data;
  }
  startEditingSession(isGlobalEditingSession) {
    const editingSessionPromise = isGlobalEditingSession ? this.chatEditingService.startOrContinueGlobalEditingSession(this) : this.chatEditingService.createEditingSession(this);
    this._editingSession = new ObservablePromise(editingSessionPromise);
    this._editingSession.promise.then((editingSession) => this._store.isDisposed ? editingSession.dispose() : this._register(editingSession));
  }
  _deserialize(obj) {
    const requests = obj.requests;
    if (!Array.isArray(requests)) {
      this.logService.error(`Ignoring malformed session data: ${JSON.stringify(obj)}`);
      return [];
    }
    try {
      return requests.map((raw) => {
        const parsedRequest = typeof raw.message === "string" ? this.getParsedRequestFromString(raw.message) : reviveParsedChatRequest(raw.message);
        const variableData = this.reviveVariableData(raw.variableData);
        const request = new ChatRequestModel(this, parsedRequest, variableData, raw.timestamp ?? -1, void 0, void 0, void 0, void 0, void 0, void 0, raw.requestId);
        request.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
        if (raw.response || raw.result || raw.responseErrorDetails) {
          const agent = raw.agent && "metadata" in raw.agent ? (
            // Check for the new format, ignore entries in the old format
            reviveSerializedAgent(raw.agent)
          ) : void 0;
          const result = "responseErrorDetails" in raw ? (
            // eslint-disable-next-line local/code-no-dangerous-type-assertions
            { errorDetails: raw.responseErrorDetails }
          ) : raw.result;
          request.response = new ChatResponseModel(raw.response ?? [new MarkdownString(raw.response)], this, agent, raw.slashCommand, request.id, true, raw.isCanceled, raw.vote, raw.voteDownReason, result, raw.followups, void 0, void 0, raw.responseId);
          request.response.shouldBeRemovedOnSend = raw.isHidden ? { requestId: raw.requestId } : raw.shouldBeRemovedOnSend;
          if (raw.usedContext) {
            request.response.applyReference(revive(raw.usedContext));
          }
          raw.contentReferences?.forEach((r) => request.response.applyReference(revive(r)));
          raw.codeCitations?.forEach((c) => request.response.applyCodeCitation(revive(c)));
        }
        return request;
      });
    } catch (error) {
      this.logService.error("Failed to parse chat data", error);
      return [];
    }
  }
  reviveVariableData(raw) {
    const variableData = raw && Array.isArray(raw.variables) ? raw : { variables: [] };
    variableData.variables = variableData.variables.map((v) => {
      if (v && "values" in v && Array.isArray(v.values)) {
        return {
          id: v.id ?? "",
          name: v.name,
          value: v.values[0]?.value,
          range: v.range,
          modelDescription: v.modelDescription,
          references: v.references
        };
      } else {
        return v;
      }
    });
    return variableData;
  }
  getParsedRequestFromString(message) {
    const parts = [new ChatRequestTextPart(new OffsetRange(0, message.length), { startColumn: 1, startLineNumber: 1, endColumn: 1, endLineNumber: 1 }, message)];
    return {
      text: message,
      parts
    };
  }
  toggleLastRequestPaused(isPaused) {
    if (this.requestPausibility !== 0 /* NotPausable */ && this.lastRequest?.response?.agent) {
      const pausedValue = isPaused ?? !this.lastRequest.response.isPaused.get();
      this.lastRequest.response.setPaused(pausedValue);
      this.chatAgentService.setRequestPaused(this.lastRequest.response.agent.id, this.lastRequest.id, pausedValue);
      this._onDidChange.fire({ kind: "changedRequest", request: this.lastRequest });
    }
  }
  startInitialize() {
    if (this.initState !== 0 /* Created */) {
      throw new Error(`ChatModel is in the wrong state for startInitialize: ${ChatModelInitState[this.initState]}`);
    }
    this._initState = 1 /* Initializing */;
  }
  deinitialize() {
    this._initState = 0 /* Created */;
    this._isInitializedDeferred = new DeferredPromise();
  }
  initialize(sampleQuestions) {
    if (this.initState !== 1 /* Initializing */) {
      throw new Error(`ChatModel is in the wrong state for initialize: ${ChatModelInitState[this.initState]}`);
    }
    this._initState = 2 /* Initialized */;
    this._sampleQuestions = sampleQuestions;
    this._isInitializedDeferred.complete();
    this._onDidChange.fire({ kind: "initialize" });
  }
  setInitializationError(error) {
    if (this.initState !== 1 /* Initializing */) {
      throw new Error(`ChatModel is in the wrong state for setInitializationError: ${ChatModelInitState[this.initState]}`);
    }
    if (!this._isInitializedDeferred.isSettled) {
      this._isInitializedDeferred.error(error);
    }
  }
  waitForInitialization() {
    return this._isInitializedDeferred.p;
  }
  getRequests() {
    return this._requests;
  }
  get checkpoint() {
    return this._checkpoint;
  }
  setDisabledRequests(requestIds) {
    this._requests.forEach((request) => {
      const shouldBeRemovedOnSend = requestIds.find((r) => r.requestId === request.id);
      request.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
      if (request.response) {
        request.response.shouldBeRemovedOnSend = shouldBeRemovedOnSend;
      }
    });
    this._onDidChange.fire({
      kind: "setHidden",
      hiddenRequestIds: requestIds
    });
  }
  addRequest(message, variableData, attempt, chatAgent, slashCommand, confirmation, locationData, attachments, isCompleteAddedRequest, modelId) {
    const request = new ChatRequestModel(this, message, variableData, Date.now(), attempt, confirmation, locationData, attachments, isCompleteAddedRequest, modelId);
    request.response = new ChatResponseModel([], this, chatAgent, slashCommand, request.id, void 0, void 0, void 0, void 0, void 0, void 0, isCompleteAddedRequest);
    this._requests.push(request);
    this._lastMessageDate = Date.now();
    this._onDidChange.fire({ kind: "addRequest", request });
    return request;
  }
  setCustomTitle(title) {
    this._customTitle = title;
  }
  updateRequest(request, variableData) {
    request.variableData = variableData;
    this._onDidChange.fire({ kind: "changedRequest", request });
  }
  adoptRequest(request) {
    const oldOwner = request.session;
    const index = oldOwner._requests.findIndex((candidate) => candidate.id === request.id);
    if (index === -1) {
      return;
    }
    oldOwner._requests.splice(index, 1);
    request.adoptTo(this);
    request.response?.adoptTo(this);
    this._requests.push(request);
    oldOwner._onDidChange.fire({ kind: "removeRequest", requestId: request.id, responseId: request.response?.id, reason: 2 /* Adoption */ });
    this._onDidChange.fire({ kind: "addRequest", request });
  }
  acceptResponseProgress(request, progress, quiet) {
    if (!request.response) {
      request.response = new ChatResponseModel([], this, void 0, void 0, request.id);
    }
    if (request.response.isComplete) {
      throw new Error("acceptResponseProgress: Adding progress to a completed response");
    }
    if (progress.kind === "markdownContent" || progress.kind === "treeData" || progress.kind === "inlineReference" || progress.kind === "codeblockUri" || progress.kind === "markdownVuln" || progress.kind === "progressMessage" || progress.kind === "command" || progress.kind === "textEdit" || progress.kind === "notebookEdit" || progress.kind === "warning" || progress.kind === "progressTask" || progress.kind === "confirmation" || progress.kind === "toolInvocation") {
      request.response.updateContent(progress, quiet);
    } else if (progress.kind === "usedContext" || progress.kind === "reference") {
      request.response.applyReference(progress);
    } else if (progress.kind === "codeCitation") {
      request.response.applyCodeCitation(progress);
    } else if (progress.kind === "move") {
      this._onDidChange.fire({ kind: "move", target: progress.uri, range: progress.range });
    } else if (progress.kind === "undoStop") {
      request.response.addUndoStop(progress);
    } else {
      this.logService.error(`Couldn't handle progress: ${JSON.stringify(progress)}`);
    }
  }
  removeRequest(id, reason = 0 /* Removal */) {
    const index = this._requests.findIndex((request2) => request2.id === id);
    const request = this._requests[index];
    if (index !== -1) {
      this._onDidChange.fire({ kind: "removeRequest", requestId: request.id, responseId: request.response?.id, reason });
      this._requests.splice(index, 1);
      request.response?.dispose();
    }
  }
  cancelRequest(request) {
    if (request.response) {
      request.response.cancel();
    }
  }
  setResponse(request, result) {
    if (!request.response) {
      request.response = new ChatResponseModel([], this, void 0, void 0, request.id);
    }
    request.response.setResult(result);
  }
  completeResponse(request) {
    if (!request.response) {
      throw new Error("Call setResponse before completeResponse");
    }
    request.response.complete();
    this._onDidChange.fire({ kind: "completedRequest", request });
  }
  setFollowups(request, followups) {
    if (!request.response) {
      return;
    }
    request.response.setFollowups(followups);
  }
  setResponseModel(request, response) {
    request.response = response;
    this._onDidChange.fire({ kind: "addResponse", response });
  }
  toExport() {
    return {
      requesterUsername: this.requesterUsername,
      requesterAvatarIconUri: this.requesterAvatarIconUri,
      responderUsername: this.responderUsername,
      responderAvatarIconUri: this.responderAvatarIcon,
      initialLocation: this.initialLocation,
      requests: this._requests.map((r) => {
        const message = {
          ...r.message,
          parts: r.message.parts.map((p) => p && "toJSON" in p ? p.toJSON() : p)
        };
        const agent = r.response?.agent;
        const agentJson = agent && "toJSON" in agent ? agent.toJSON() : agent ? { ...agent } : void 0;
        return {
          requestId: r.id,
          message,
          variableData: r.variableData,
          response: r.response ? r.response.entireResponse.value.map((item) => {
            if (item.kind === "treeData") {
              return item.treeData;
            } else if (item.kind === "markdownContent") {
              return item.content;
            } else {
              return item;
            }
          }) : void 0,
          responseId: r.response?.id,
          shouldBeRemovedOnSend: r.shouldBeRemovedOnSend,
          result: r.response?.result,
          followups: r.response?.followups,
          isCanceled: r.response?.isCanceled,
          vote: r.response?.vote,
          voteDownReason: r.response?.voteDownReason,
          agent: agentJson,
          slashCommand: r.response?.slashCommand,
          usedContext: r.response?.usedContext,
          contentReferences: r.response?.contentReferences,
          codeCitations: r.response?.codeCitations,
          timestamp: r.timestamp
        };
      })
    };
  }
  toJSON() {
    return {
      version: 3,
      ...this.toExport(),
      sessionId: this.sessionId,
      creationDate: this._creationDate,
      isImported: this._isImported,
      lastMessageDate: this._lastMessageDate,
      customTitle: this._customTitle
    };
  }
  dispose() {
    this._requests.forEach((r) => r.response?.dispose());
    this._onDidDispose.fire();
    super.dispose();
  }
};
ChatModel = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, IChatAgentService),
  __decorateParam(4, IChatEditingService)
], ChatModel);
function updateRanges(variableData, diff) {
  return {
    variables: variableData.variables.map((v) => ({
      ...v,
      range: v.range && {
        start: v.range.start - diff,
        endExclusive: v.range.endExclusive - diff
      }
    }))
  };
}
function canMergeMarkdownStrings(md1, md2) {
  if (md1.baseUri && md2.baseUri) {
    const baseUriEquals = md1.baseUri.scheme === md2.baseUri.scheme && md1.baseUri.authority === md2.baseUri.authority && md1.baseUri.path === md2.baseUri.path && md1.baseUri.query === md2.baseUri.query && md1.baseUri.fragment === md2.baseUri.fragment;
    if (!baseUriEquals) {
      return false;
    }
  } else if (md1.baseUri || md2.baseUri) {
    return false;
  }
  return equals(md1.isTrusted, md2.isTrusted) && md1.supportHtml === md2.supportHtml && md1.supportThemeIcons === md2.supportThemeIcons;
}
function appendMarkdownString(md1, md2) {
  const appendedValue = typeof md2 === "string" ? md2 : md2.value;
  return {
    value: md1.value + appendedValue,
    isTrusted: md1.isTrusted,
    supportThemeIcons: md1.supportThemeIcons,
    supportHtml: md1.supportHtml,
    baseUri: md1.baseUri
  };
}
function getCodeCitationsMessage(citations) {
  if (citations.length === 0) {
    return "";
  }
  const licenseTypes = citations.reduce((set, c) => set.add(c.license), /* @__PURE__ */ new Set());
  const label = licenseTypes.size === 1 ? localize("codeCitation", "Similar code found with 1 license type", licenseTypes.size) : localize("codeCitations", "Similar code found with {0} license types", licenseTypes.size);
  return label;
}
export {
  ChatModel,
  ChatModelInitState,
  ChatPauseState,
  ChatRequestModel,
  ChatRequestRemovalReason,
  ChatResponseModel,
  IDiagnosticVariableEntryFilterData,
  Response,
  appendMarkdownString,
  canMergeMarkdownStrings,
  getCodeCitationsMessage,
  isCellTextEditOperation,
  isChatRequestVariableEntry,
  isDiagnosticsVariableEntry,
  isExportableSessionData,
  isImageVariableEntry,
  isImplicitVariableEntry,
  isPasteVariableEntry,
  isSerializableSessionData,
  normalizeSerializableChatData,
  toChatHistoryContent,
  updateRanges
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0TW9kZWwudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbIi8qLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tXG4gKiAgQ29weXJpZ2h0IChjKSBNaWNyb3NvZnQgQ29ycG9yYXRpb24uIEFsbCByaWdodHMgcmVzZXJ2ZWQuXG4gKiAgTGljZW5zZWQgdW5kZXIgdGhlIE1JVCBMaWNlbnNlLiBTZWUgTGljZW5zZS50eHQgaW4gdGhlIHByb2plY3Qgcm9vdCBmb3IgbGljZW5zZSBpbmZvcm1hdGlvbi5cbiAqLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0qL1xuXG5pbXBvcnQgeyBhc0FycmF5IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXJyYXlzLmpzJztcbmltcG9ydCB7IERlZmVycmVkUHJvbWlzZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2FzeW5jLmpzJztcbmltcG9ydCB7IENvZGljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jb2RpY29ucy5qcyc7XG5pbXBvcnQgeyBFbWl0dGVyLCBFdmVudCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2V2ZW50LmpzJztcbmltcG9ydCB7IElNYXJrZG93blN0cmluZywgTWFya2Rvd25TdHJpbmcsIGlzTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBJRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyByZXZpdmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJzaGFsbGluZy5qcyc7XG5pbXBvcnQgeyBTY2hlbWFzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbmV0d29yay5qcyc7XG5pbXBvcnQgeyBlcXVhbHMgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYmplY3RzLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlLCBJVHJhbnNhY3Rpb24sIE9ic2VydmFibGVQcm9taXNlLCBvYnNlcnZhYmxlVmFsdWUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9vYnNlcnZhYmxlLmpzJztcbmltcG9ydCB7IGJhc2VuYW1lLCBpc0VxdWFsIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vcmVzb3VyY2VzLmpzJztcbmltcG9ydCB7IFRoZW1lSWNvbiB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3RoZW1hYmxlcy5qcyc7XG5pbXBvcnQgeyBVUkksIFVyaUNvbXBvbmVudHMsIFVyaUR0bywgaXNVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IGdlbmVyYXRlVXVpZCB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3V1aWQuanMnO1xuaW1wb3J0IHsgSU9mZnNldFJhbmdlLCBPZmZzZXRSYW5nZSB9IGZyb20gJy4uLy4uLy4uLy4uL2VkaXRvci9jb21tb24vY29yZS9vZmZzZXRSYW5nZS5qcyc7XG5pbXBvcnQgeyBJUmFuZ2UgfSBmcm9tICcuLi8uLi8uLi8uLi9lZGl0b3IvY29tbW9uL2NvcmUvcmFuZ2UuanMnO1xuaW1wb3J0IHsgTG9jYXRpb24sIFN5bWJvbEtpbmQsIFRleHRFZGl0IH0gZnJvbSAnLi4vLi4vLi4vLi4vZWRpdG9yL2NvbW1vbi9sYW5ndWFnZXMuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBJTWFya2VyLCBNYXJrZXJTZXZlcml0eSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL21hcmtlcnMvY29tbW9uL21hcmtlcnMuanMnO1xuaW1wb3J0IHsgQ2VsbFVyaSwgSUNlbGxFZGl0T3BlcmF0aW9uIH0gZnJvbSAnLi4vLi4vbm90ZWJvb2svY29tbW9uL25vdGVib29rQ29tbW9uLmpzJztcbmltcG9ydCB7IElDaGF0QWdlbnRDb21tYW5kLCBJQ2hhdEFnZW50RGF0YSwgSUNoYXRBZ2VudFJlc3VsdCwgSUNoYXRBZ2VudFNlcnZpY2UsIHJldml2ZVNlcmlhbGl6ZWRBZ2VudCB9IGZyb20gJy4vY2hhdEFnZW50cy5qcyc7XG5pbXBvcnQgeyBJQ2hhdEVkaXRpbmdTZXJ2aWNlLCBJQ2hhdEVkaXRpbmdTZXNzaW9uIH0gZnJvbSAnLi9jaGF0RWRpdGluZ1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgQ2hhdFJlcXVlc3RUZXh0UGFydCwgSVBhcnNlZENoYXRSZXF1ZXN0LCByZXZpdmVQYXJzZWRDaGF0UmVxdWVzdCB9IGZyb20gJy4vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24sIENoYXRBZ2VudFZvdGVEb3duUmVhc29uLCBJQ2hhdEFnZW50TWFya2Rvd25Db250ZW50V2l0aFZ1bG5lcmFiaWxpdHksIElDaGF0Q29kZUNpdGF0aW9uLCBJQ2hhdENvbW1hbmRCdXR0b24sIElDaGF0Q29uZmlybWF0aW9uLCBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2UsIElDaGF0Q29udGVudFJlZmVyZW5jZSwgSUNoYXRGb2xsb3d1cCwgSUNoYXRMb2NhdGlvbkRhdGEsIElDaGF0TWFya2Rvd25Db250ZW50LCBJQ2hhdE5vdGVib29rRWRpdCwgSUNoYXRQcm9ncmVzcywgSUNoYXRQcm9ncmVzc01lc3NhZ2UsIElDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0LCBJQ2hhdFJlc3BvbnNlUHJvZ3Jlc3NGaWxlVHJlZURhdGEsIElDaGF0VGFzaywgSUNoYXRUZXh0RWRpdCwgSUNoYXRUb29sSW52b2NhdGlvbiwgSUNoYXRUb29sSW52b2NhdGlvblNlcmlhbGl6ZWQsIElDaGF0VHJlZURhdGEsIElDaGF0VW5kb1N0b3AsIElDaGF0VXNlZENvbnRleHQsIElDaGF0V2FybmluZ01lc3NhZ2UsIGlzSVVzZWRDb250ZXh0IH0gZnJvbSAnLi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBJQ2hhdFJlcXVlc3RWYXJpYWJsZVZhbHVlIH0gZnJvbSAnLi9jaGF0VmFyaWFibGVzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudExvY2F0aW9uIH0gZnJvbSAnLi9jb25zdGFudHMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElCYXNlQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IHtcblx0aWQ6IHN0cmluZztcblx0ZnVsbE5hbWU/OiBzdHJpbmc7XG5cdGljb24/OiBUaGVtZUljb247XG5cdG5hbWU6IHN0cmluZztcblx0bW9kZWxEZXNjcmlwdGlvbj86IHN0cmluZztcblx0cmFuZ2U/OiBJT2Zmc2V0UmFuZ2U7XG5cdHZhbHVlOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZVZhbHVlO1xuXHRyZWZlcmVuY2VzPzogSUNoYXRDb250ZW50UmVmZXJlbmNlW107XG5cdG1pbWVUeXBlPzogc3RyaW5nO1xuXG5cdC8vIFRPRE8gdGhlc2UgcmVwcmVzZW50IGRpZmZlcmVudCBraW5kcywgc2hvdWxkIGJlIGV4dHJhY3RlZCB0byBuZXcgaW50ZXJmYWNlcyB3aXRoIGtpbmQgdGFnc1xuXHRraW5kPzogbmV2ZXI7XG5cdGlzRmlsZT86IGJvb2xlYW47XG5cdGlzRGlyZWN0b3J5PzogYm9vbGVhbjtcblx0aXNUb29sPzogYm9vbGVhbjtcblx0aXNJbWFnZT86IGJvb2xlYW47XG5cdGlzT21pdHRlZD86IGJvb2xlYW47XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZXF1ZXN0SW1wbGljaXRWYXJpYWJsZUVudHJ5IGV4dGVuZHMgT21pdDxJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgJ2tpbmQnPiB7XG5cdHJlYWRvbmx5IGtpbmQ6ICdpbXBsaWNpdCc7XG5cdHJlYWRvbmx5IGlzRmlsZTogdHJ1ZTtcblx0cmVhZG9ubHkgdmFsdWU6IFVSSSB8IExvY2F0aW9uIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpc1NlbGVjdGlvbjogYm9vbGVhbjtcblx0ZW5hYmxlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlcXVlc3RQYXN0ZVZhcmlhYmxlRW50cnkgZXh0ZW5kcyBPbWl0PElCYXNlQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5LCAna2luZCc+IHtcblx0cmVhZG9ubHkga2luZDogJ3Bhc3RlJztcblx0Y29kZTogc3RyaW5nO1xuXHRsYW5ndWFnZTogc3RyaW5nO1xuXHRwYXN0ZWRMaW5lczogc3RyaW5nO1xuXG5cdC8vIFRoaXMgaXMgb25seSB1c2VkIGZvciBvbGQgc2VyaWFsaXplZCBkYXRhIGFuZCBzaG91bGQgYmUgcmVtb3ZlZCBvbmNlIHdlIG5vIGxvbmdlciBzdXBwb3J0IGl0XG5cdGZpbGVOYW1lOiBzdHJpbmc7XG5cblx0Ly8gVGhpcyBpcyBvbmx5IHVuZGVmaW5lZCBvbiBvbGQgc2VyaWFsaXplZCBkYXRhXG5cdGNvcGllZEZyb206IHtcblx0XHRyZWFkb25seSB1cmk6IFVSSTtcblx0XHRyZWFkb25seSByYW5nZTogSVJhbmdlO1xuXHR9IHwgdW5kZWZpbmVkO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTeW1ib2xWYXJpYWJsZUVudHJ5IGV4dGVuZHMgT21pdDxJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgJ2tpbmQnPiB7XG5cdHJlYWRvbmx5IGtpbmQ6ICdzeW1ib2wnO1xuXHRyZWFkb25seSB2YWx1ZTogTG9jYXRpb247XG5cdHJlYWRvbmx5IHN5bWJvbEtpbmQ6IFN5bWJvbEtpbmQ7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNvbW1hbmRSZXN1bHRWYXJpYWJsZUVudHJ5IGV4dGVuZHMgT21pdDxJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgJ2tpbmQnPiB7XG5cdHJlYWRvbmx5IGtpbmQ6ICdjb21tYW5kJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJSW1hZ2VWYXJpYWJsZUVudHJ5IGV4dGVuZHMgT21pdDxJQmFzZUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgJ2tpbmQnPiB7XG5cdHJlYWRvbmx5IGtpbmQ6ICdpbWFnZSc7XG5cdHJlYWRvbmx5IGlzUGFzdGVkPzogYm9vbGVhbjtcblx0cmVhZG9ubHkgaXNVUkw/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEge1xuXHRyZWFkb25seSBvd25lcj86IHN0cmluZztcblx0cmVhZG9ubHkgcHJvYmxlbU1lc3NhZ2U/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGZpbHRlclVyaT86IFVSSTtcblx0cmVhZG9ubHkgZmlsdGVyU2V2ZXJpdHk/OiBNYXJrZXJTZXZlcml0eTtcblx0cmVhZG9ubHkgZmlsdGVyUmFuZ2U/OiBJUmFuZ2U7XG59XG5cbmV4cG9ydCBuYW1lc3BhY2UgSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSB7XG5cdGV4cG9ydCBjb25zdCBpY29uID0gQ29kaWNvbi5lcnJvcjtcblxuXHRleHBvcnQgZnVuY3Rpb24gZnJvbU1hcmtlcihtYXJrZXI6IElNYXJrZXIpOiBJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlGaWx0ZXJEYXRhIHtcblx0XHRyZXR1cm4ge1xuXHRcdFx0ZmlsdGVyVXJpOiBtYXJrZXIucmVzb3VyY2UsXG5cdFx0XHRvd25lcjogbWFya2VyLm93bmVyLFxuXHRcdFx0cHJvYmxlbU1lc3NhZ2U6IG1hcmtlci5tZXNzYWdlLFxuXHRcdFx0ZmlsdGVyUmFuZ2U6IHsgc3RhcnRMaW5lTnVtYmVyOiBtYXJrZXIuc3RhcnRMaW5lTnVtYmVyLCBlbmRMaW5lTnVtYmVyOiBtYXJrZXIuZW5kTGluZU51bWJlciwgc3RhcnRDb2x1bW46IG1hcmtlci5zdGFydENvbHVtbiwgZW5kQ29sdW1uOiBtYXJrZXIuZW5kQ29sdW1uIH1cblx0XHR9O1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIHRvRW50cnkoZGF0YTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSk6IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdGlkOiBpZChkYXRhKSxcblx0XHRcdG5hbWU6IGxhYmVsKGRhdGEpLFxuXHRcdFx0aWNvbixcblx0XHRcdHZhbHVlOiBkYXRhLFxuXHRcdFx0a2luZDogJ2RpYWdub3N0aWMnIGFzIGNvbnN0LFxuXHRcdFx0cmFuZ2U6IGRhdGEuZmlsdGVyUmFuZ2UgPyBuZXcgT2Zmc2V0UmFuZ2UoZGF0YS5maWx0ZXJSYW5nZS5zdGFydExpbmVOdW1iZXIsIGRhdGEuZmlsdGVyUmFuZ2UuZW5kTGluZU51bWJlcikgOiB1bmRlZmluZWQsXG5cdFx0XHQuLi5kYXRhLFxuXHRcdH07XG5cdH1cblxuXHRleHBvcnQgZnVuY3Rpb24gaWQoZGF0YTogSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5RmlsdGVyRGF0YSkge1xuXHRcdHJldHVybiBbZGF0YS5maWx0ZXJVcmksIGRhdGEub3duZXIsIGRhdGEuZmlsdGVyU2V2ZXJpdHksIGRhdGEuZmlsdGVyUmFuZ2U/LnN0YXJ0TGluZU51bWJlcl0uam9pbignOicpO1xuXHR9XG5cblx0ZXhwb3J0IGZ1bmN0aW9uIGxhYmVsKGRhdGE6IElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEpIHtcblx0XHRjb25zdCBlbnVtIFRyaW1UaHJlc2hvbGQge1xuXHRcdFx0TWF4Q2hhcnMgPSAzMCxcblx0XHRcdE1heFNwYWNlTG9va2JhY2sgPSAxMCxcblx0XHR9XG5cdFx0aWYgKGRhdGEucHJvYmxlbU1lc3NhZ2UpIHtcblx0XHRcdGlmIChkYXRhLnByb2JsZW1NZXNzYWdlLmxlbmd0aCA8IFRyaW1UaHJlc2hvbGQuTWF4Q2hhcnMpIHtcblx0XHRcdFx0cmV0dXJuIGRhdGEucHJvYmxlbU1lc3NhZ2U7XG5cdFx0XHR9XG5cblx0XHRcdC8vIFRyaW0gdGhlIG1lc3NhZ2UsIG9uIGEgc3BhY2UgaWYgaXQgd291bGQgbm90IGxvc2UgdG9vIG11Y2hcblx0XHRcdC8vIGRhdGEgKE1heFNwYWNlTG9va2JhY2spIG9yIGp1c3QgYmxpbmRseSBvdGhlcndpc2UuXG5cdFx0XHRjb25zdCBsYXN0U3BhY2UgPSBkYXRhLnByb2JsZW1NZXNzYWdlLmxhc3RJbmRleE9mKCcgJywgVHJpbVRocmVzaG9sZC5NYXhDaGFycyk7XG5cdFx0XHRpZiAobGFzdFNwYWNlID09PSAtMSB8fCBsYXN0U3BhY2UgKyBUcmltVGhyZXNob2xkLk1heFNwYWNlTG9va2JhY2sgPCBUcmltVGhyZXNob2xkLk1heENoYXJzKSB7XG5cdFx0XHRcdHJldHVybiBkYXRhLnByb2JsZW1NZXNzYWdlLnN1YnN0cmluZygwLCBUcmltVGhyZXNob2xkLk1heENoYXJzKSArICdcdTIwMjYnO1xuXHRcdFx0fVxuXHRcdFx0cmV0dXJuIGRhdGEucHJvYmxlbU1lc3NhZ2Uuc3Vic3RyaW5nKDAsIGxhc3RTcGFjZSkgKyAnXHUyMDI2Jztcblx0XHR9XG5cdFx0bGV0IGxhYmVsU3RyID0gbG9jYWxpemUoJ2NoYXQuYXR0YWNobWVudC5wcm9ibGVtcy5hbGwnLCBcIkFsbCBQcm9ibGVtc1wiKTtcblx0XHRpZiAoZGF0YS5maWx0ZXJVcmkpIHtcblx0XHRcdGxhYmVsU3RyID0gbG9jYWxpemUoJ2NoYXQuYXR0YWNobWVudC5wcm9ibGVtcy5pbkZpbGUnLCBcIlByb2JsZW1zIGluIHswfVwiLCBiYXNlbmFtZShkYXRhLmZpbHRlclVyaSkpO1xuXHRcdH1cblxuXHRcdHJldHVybiBsYWJlbFN0cjtcblx0fVxufVxuXG5leHBvcnQgaW50ZXJmYWNlIElEaWFnbm9zdGljVmFyaWFibGVFbnRyeSBleHRlbmRzIE9taXQ8SUJhc2VDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnksICdraW5kJz4sIElEaWFnbm9zdGljVmFyaWFibGVFbnRyeUZpbHRlckRhdGEge1xuXHRyZWFkb25seSBraW5kOiAnZGlhZ25vc3RpYyc7XG59XG5cbmV4cG9ydCB0eXBlIElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkgPSBJQ2hhdFJlcXVlc3RJbXBsaWNpdFZhcmlhYmxlRW50cnkgfCBJQ2hhdFJlcXVlc3RQYXN0ZVZhcmlhYmxlRW50cnkgfCBJU3ltYm9sVmFyaWFibGVFbnRyeSB8IElDb21tYW5kUmVzdWx0VmFyaWFibGVFbnRyeSB8IElCYXNlQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5IHwgSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5IHwgSUltYWdlVmFyaWFibGVFbnRyeTtcblxuZXhwb3J0IGZ1bmN0aW9uIGlzSW1wbGljaXRWYXJpYWJsZUVudHJ5KG9iajogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSk6IG9iaiBpcyBJQ2hhdFJlcXVlc3RJbXBsaWNpdFZhcmlhYmxlRW50cnkge1xuXHRyZXR1cm4gb2JqLmtpbmQgPT09ICdpbXBsaWNpdCc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Bhc3RlVmFyaWFibGVFbnRyeShvYmo6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkpOiBvYmogaXMgSUNoYXRSZXF1ZXN0UGFzdGVWYXJpYWJsZUVudHJ5IHtcblx0cmV0dXJuIG9iai5raW5kID09PSAncGFzdGUnO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gaXNJbWFnZVZhcmlhYmxlRW50cnkob2JqOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5KTogb2JqIGlzIElJbWFnZVZhcmlhYmxlRW50cnkge1xuXHRyZXR1cm4gb2JqLmtpbmQgPT09ICdpbWFnZSc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0RpYWdub3N0aWNzVmFyaWFibGVFbnRyeShvYmo6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkpOiBvYmogaXMgSURpYWdub3N0aWNWYXJpYWJsZUVudHJ5IHtcblx0cmV0dXJuIG9iai5raW5kID09PSAnZGlhZ25vc3RpYyc7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeShvYmo6IHVua25vd24pOiBvYmogaXMgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSB7XG5cdGNvbnN0IGVudHJ5ID0gb2JqIGFzIElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnk7XG5cdHJldHVybiB0eXBlb2YgZW50cnkgPT09ICdvYmplY3QnICYmXG5cdFx0ZW50cnkgIT09IG51bGwgJiZcblx0XHR0eXBlb2YgZW50cnkuaWQgPT09ICdzdHJpbmcnICYmXG5cdFx0dHlwZW9mIGVudHJ5Lm5hbWUgPT09ICdzdHJpbmcnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0UmVxdWVzdFZhcmlhYmxlRGF0YSB7XG5cdHZhcmlhYmxlczogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0UmVxdWVzdE1vZGVsIHtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgdGltZXN0YW1wOiBudW1iZXI7XG5cdHJlYWRvbmx5IHVzZXJuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGF2YXRhckljb25Vcmk/OiBVUkk7XG5cdHJlYWRvbmx5IHNlc3Npb246IElDaGF0TW9kZWw7XG5cdHJlYWRvbmx5IG1lc3NhZ2U6IElQYXJzZWRDaGF0UmVxdWVzdDtcblx0cmVhZG9ubHkgYXR0ZW1wdDogbnVtYmVyO1xuXHRyZWFkb25seSB2YXJpYWJsZURhdGE6IElDaGF0UmVxdWVzdFZhcmlhYmxlRGF0YTtcblx0cmVhZG9ubHkgY29uZmlybWF0aW9uPzogc3RyaW5nO1xuXHRyZWFkb25seSBsb2NhdGlvbkRhdGE/OiBJQ2hhdExvY2F0aW9uRGF0YTtcblx0cmVhZG9ubHkgYXR0YWNoZWRDb250ZXh0PzogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdO1xuXHRyZWFkb25seSBpc0NvbXBsZXRlQWRkZWRSZXF1ZXN0OiBib29sZWFuO1xuXHRyZWFkb25seSByZXNwb25zZT86IElDaGF0UmVzcG9uc2VNb2RlbDtcblx0c2hvdWxkQmVSZW1vdmVkT25TZW5kOiBJQ2hhdFJlcXVlc3REaXNhYmxlbWVudCB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFRleHRFZGl0R3JvdXBTdGF0ZSB7XG5cdHNoYTE6IHN0cmluZztcblx0YXBwbGllZDogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0VGV4dEVkaXRHcm91cCB7XG5cdHVyaTogVVJJO1xuXHRlZGl0czogVGV4dEVkaXRbXVtdO1xuXHRzdGF0ZT86IElDaGF0VGV4dEVkaXRHcm91cFN0YXRlO1xuXHRraW5kOiAndGV4dEVkaXRHcm91cCc7XG5cdGRvbmU6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0NlbGxUZXh0RWRpdE9wZXJhdGlvbih2YWx1ZTogdW5rbm93bik6IHZhbHVlIGlzIElDZWxsVGV4dEVkaXRPcGVyYXRpb24ge1xuXHRjb25zdCBjYW5kaWRhdGUgPSB2YWx1ZSBhcyBJQ2VsbFRleHRFZGl0T3BlcmF0aW9uO1xuXHRyZXR1cm4gISFjYW5kaWRhdGUgJiYgISFjYW5kaWRhdGUuZWRpdCAmJiAhIWNhbmRpZGF0ZS51cmkgJiYgVVJJLmlzVXJpKGNhbmRpZGF0ZS51cmkpO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDZWxsVGV4dEVkaXRPcGVyYXRpb24ge1xuXHRlZGl0OiBUZXh0RWRpdDtcblx0dXJpOiBVUkk7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXROb3RlYm9va0VkaXRHcm91cCB7XG5cdHVyaTogVVJJO1xuXHRlZGl0czogKElDZWxsVGV4dEVkaXRPcGVyYXRpb24gfCBJQ2VsbEVkaXRPcGVyYXRpb24pW107XG5cdHN0YXRlPzogSUNoYXRUZXh0RWRpdEdyb3VwU3RhdGU7XG5cdGtpbmQ6ICdub3RlYm9va0VkaXRHcm91cCc7XG5cdGRvbmU6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG59XG5cbi8qKlxuICogUHJvZ3Jlc3Mga2luZHMgdGhhdCBhcmUgaW5jbHVkZWQgaW4gdGhlIGhpc3Rvcnkgb2YgYSByZXNwb25zZS5cbiAqIEV4Y2x1ZGVzIFwiaW50ZXJuYWxcIiB0eXBlcyB0aGF0IGFyZSBpbmNsdWRlZCBpbiBoaXN0b3J5LlxuICovXG5leHBvcnQgdHlwZSBJQ2hhdFByb2dyZXNzSGlzdG9yeVJlc3BvbnNlQ29udGVudCA9XG5cdHwgSUNoYXRNYXJrZG93bkNvbnRlbnRcblx0fCBJQ2hhdEFnZW50TWFya2Rvd25Db250ZW50V2l0aFZ1bG5lcmFiaWxpdHlcblx0fCBJQ2hhdFJlc3BvbnNlQ29kZWJsb2NrVXJpUGFydFxuXHR8IElDaGF0VHJlZURhdGFcblx0fCBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2Vcblx0fCBJQ2hhdFByb2dyZXNzTWVzc2FnZVxuXHR8IElDaGF0Q29tbWFuZEJ1dHRvblxuXHR8IElDaGF0V2FybmluZ01lc3NhZ2Vcblx0fCBJQ2hhdFRhc2tcblx0fCBJQ2hhdFRleHRFZGl0R3JvdXBcblx0fCBJQ2hhdE5vdGVib29rRWRpdEdyb3VwXG5cdHwgSUNoYXRDb25maXJtYXRpb247XG5cbi8qKlxuICogXCJOb3JtYWxcIiBwcm9ncmVzcyBraW5kcyB0aGF0IGFyZSByZW5kZXJlZCBhcyBwYXJ0cyBvZiB0aGUgc3RyZWFtIG9mIGNvbnRlbnQuXG4gKi9cbmV4cG9ydCB0eXBlIElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnQgPVxuXHR8IElDaGF0UHJvZ3Jlc3NIaXN0b3J5UmVzcG9uc2VDb250ZW50XG5cdHwgSUNoYXRUb29sSW52b2NhdGlvblxuXHR8IElDaGF0VG9vbEludm9jYXRpb25TZXJpYWxpemVkXG5cdHwgSUNoYXRVbmRvU3RvcDtcblxuY29uc3Qgbm9uSGlzdG9yeUtpbmRzID0gbmV3IFNldChbJ3Rvb2xJbnZvY2F0aW9uJywgJ3Rvb2xJbnZvY2F0aW9uU2VyaWFsaXplZCddKTtcbmZ1bmN0aW9uIGlzQ2hhdFByb2dyZXNzSGlzdG9yeVJlc3BvbnNlQ29udGVudChjb250ZW50OiBJQ2hhdFByb2dyZXNzUmVzcG9uc2VDb250ZW50KTogY29udGVudCBpcyBJQ2hhdFByb2dyZXNzSGlzdG9yeVJlc3BvbnNlQ29udGVudCB7XG5cdHJldHVybiAhbm9uSGlzdG9yeUtpbmRzLmhhcyhjb250ZW50LmtpbmQpO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gdG9DaGF0SGlzdG9yeUNvbnRlbnQoY29udGVudDogUmVhZG9ubHlBcnJheTxJQ2hhdFByb2dyZXNzUmVzcG9uc2VDb250ZW50Pik6IElDaGF0UHJvZ3Jlc3NIaXN0b3J5UmVzcG9uc2VDb250ZW50W10ge1xuXHRyZXR1cm4gY29udGVudC5maWx0ZXIoaXNDaGF0UHJvZ3Jlc3NIaXN0b3J5UmVzcG9uc2VDb250ZW50KTtcbn1cblxuZXhwb3J0IHR5cGUgSUNoYXRQcm9ncmVzc1JlbmRlcmFibGVSZXNwb25zZUNvbnRlbnQgPSBFeGNsdWRlPElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnQsIElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZSB8IElDaGF0QWdlbnRNYXJrZG93bkNvbnRlbnRXaXRoVnVsbmVyYWJpbGl0eSB8IElDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0PjtcblxuZXhwb3J0IGludGVyZmFjZSBJUmVzcG9uc2Uge1xuXHRyZWFkb25seSB2YWx1ZTogUmVhZG9ubHlBcnJheTxJQ2hhdFByb2dyZXNzUmVzcG9uc2VDb250ZW50Pjtcblx0Z2V0TWFya2Rvd24oKTogc3RyaW5nO1xuXHR0b1N0cmluZygpOiBzdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZXNwb25zZU1vZGVsIHtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uPjtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgcmVxdWVzdElkOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHVzZXJuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGF2YXRhckljb24/OiBUaGVtZUljb24gfCBVUkk7XG5cdHJlYWRvbmx5IHNlc3Npb246IElDaGF0TW9kZWw7XG5cdHJlYWRvbmx5IGFnZW50PzogSUNoYXRBZ2VudERhdGE7XG5cdHJlYWRvbmx5IHVzZWRDb250ZXh0OiBJQ2hhdFVzZWRDb250ZXh0IHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBjb250ZW50UmVmZXJlbmNlczogUmVhZG9ubHlBcnJheTxJQ2hhdENvbnRlbnRSZWZlcmVuY2U+O1xuXHRyZWFkb25seSBjb2RlQ2l0YXRpb25zOiBSZWFkb25seUFycmF5PElDaGF0Q29kZUNpdGF0aW9uPjtcblx0cmVhZG9ubHkgcHJvZ3Jlc3NNZXNzYWdlczogUmVhZG9ubHlBcnJheTxJQ2hhdFByb2dyZXNzTWVzc2FnZT47XG5cdHJlYWRvbmx5IHNsYXNoQ29tbWFuZD86IElDaGF0QWdlbnRDb21tYW5kO1xuXHRyZWFkb25seSBhZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQ6IGJvb2xlYW47XG5cdC8qKiBWaWV3IG9mIHRoZSByZXNwb25zZSBzaG93biB0byB0aGUgdXNlciwgbWF5IGhhdmUgcGFydHMgb21pdHRlZCBmcm9tIHVuZG8gc3RvcHMuICovXG5cdHJlYWRvbmx5IHJlc3BvbnNlOiBJUmVzcG9uc2U7XG5cdC8qKiBFbnRpcmUgcmVzcG9uc2UgZnJvbSB0aGUgbW9kZWwuICovXG5cdHJlYWRvbmx5IGVudGlyZVJlc3BvbnNlOiBJUmVzcG9uc2U7XG5cdHJlYWRvbmx5IGlzQ29tcGxldGU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlzQ2FuY2VsZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlzUGF1c2VkOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblx0cmVhZG9ubHkgaXNQZW5kaW5nQ29uZmlybWF0aW9uOiBib29sZWFuO1xuXHRyZWFkb25seSBzaG91bGRCZVJlbW92ZWRPblNlbmQ6IElDaGF0UmVxdWVzdERpc2FibGVtZW50IHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSBpc0NvbXBsZXRlQWRkZWRSZXF1ZXN0OiBib29sZWFuO1xuXHQvKiogQSBzdGFsZSByZXNwb25zZSBpcyBvbmUgdGhhdCBoYXMgYmVlbiBwZXJzaXN0ZWQgYW5kIHJlaHlkcmF0ZWQsIHNvIGUuZy4gQ29tbWFuZHMgdGhhdCBoYXZlIHRoZWlyIGFyZ3VtZW50cyBzdG9yZWQgaW4gdGhlIEVIIGFyZSBnb25lLiAqL1xuXHRyZWFkb25seSBpc1N0YWxlOiBib29sZWFuO1xuXHRyZWFkb25seSB2b3RlOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB2b3RlRG93blJlYXNvbjogQ2hhdEFnZW50Vm90ZURvd25SZWFzb24gfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGZvbGxvd3Vwcz86IElDaGF0Rm9sbG93dXBbXSB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgcmVzdWx0PzogSUNoYXRBZ2VudFJlc3VsdDtcblx0YWRkVW5kb1N0b3AodW5kb1N0b3A6IElDaGF0VW5kb1N0b3ApOiB2b2lkO1xuXHRzZXRWb3RlKHZvdGU6IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24pOiB2b2lkO1xuXHRzZXRWb3RlRG93blJlYXNvbihyZWFzb246IENoYXRBZ2VudFZvdGVEb3duUmVhc29uIHwgdW5kZWZpbmVkKTogdm9pZDtcblx0c2V0RWRpdEFwcGxpZWQoZWRpdDogSUNoYXRUZXh0RWRpdEdyb3VwLCBlZGl0Q291bnQ6IG51bWJlcik6IGJvb2xlYW47XG5cdHNldFBhdXNlZChpc1BhdXNlOiBib29sZWFuLCB0eD86IElUcmFuc2FjdGlvbik6IHZvaWQ7XG5cdC8qKlxuXHQgKiBBZG9wdHMgYW55IHBhcnRpYWxseS11bmRvIHtAbGluayByZXNwb25zZX0gYXMgdGhlIHtAbGluayBlbnRpcmVSZXNwb25zZX0uXG5cdCAqIE9ubHkgdmFsaWQgd2hlbiB7QGxpbmsgaXNDb21wbGV0ZX0uIFRoaXMgaXMgbmVlZGVkIGJlY2F1c2Ugb3RoZXJ3aXNlIGFuXG5cdCAqIHVuZG9uZSBhbmQgdGhlbiBkaXZlcmdlZCBzdGF0ZSB3b3VsZCBzdGFydCBzaG93aW5nIG9sZCBkYXRhIGJlY2F1c2UgdGhlXG5cdCAqIHVuZG8gc3RvcHMgd291bGQgbm8gbG9uZ2VyIGV4aXN0IGluIHRoZSBtb2RlbC5cblx0ICovXG5cdGZpbmFsaXplVW5kb1N0YXRlKCk6IHZvaWQ7XG59XG5cbmV4cG9ydCB0eXBlIENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uID1cblx0fCB7IHJlYXNvbjogJ290aGVyJyB9XG5cdHwgeyByZWFzb246ICd1bmRvU3RvcCc7IGlkOiBzdHJpbmcgfTtcblxuY29uc3QgZGVmYXVsdENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uOiBDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbiA9IHsgcmVhc29uOiAnb3RoZXInIH07XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVxdWVzdE1vZGVsIGltcGxlbWVudHMgSUNoYXRSZXF1ZXN0TW9kZWwge1xuXG5cdHB1YmxpYyByZXNwb25zZTogQ2hhdFJlc3BvbnNlTW9kZWwgfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cblx0cHVibGljIGdldCBzZXNzaW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9uO1xuXHR9XG5cblx0cHVibGljIHNob3VsZEJlUmVtb3ZlZE9uU2VuZDogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQgfCB1bmRlZmluZWQ7XG5cblx0cHVibGljIGdldCB1c2VybmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb24ucmVxdWVzdGVyVXNlcm5hbWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGF2YXRhckljb25VcmkoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zZXNzaW9uLnJlcXVlc3RlckF2YXRhckljb25Vcmk7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGF0dGVtcHQoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fYXR0ZW1wdDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdmFyaWFibGVEYXRhKCk6IElDaGF0UmVxdWVzdFZhcmlhYmxlRGF0YSB7XG5cdFx0cmV0dXJuIHRoaXMuX3ZhcmlhYmxlRGF0YTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgdmFyaWFibGVEYXRhKHY6IElDaGF0UmVxdWVzdFZhcmlhYmxlRGF0YSkge1xuXHRcdHRoaXMuX3ZhcmlhYmxlRGF0YSA9IHY7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGNvbmZpcm1hdGlvbigpOiBzdHJpbmcgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9jb25maXJtYXRpb247XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGxvY2F0aW9uRGF0YSgpOiBJQ2hhdExvY2F0aW9uRGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2xvY2F0aW9uRGF0YTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgYXR0YWNoZWRDb250ZXh0KCk6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2F0dGFjaGVkQ29udGV4dDtcblx0fVxuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdHByaXZhdGUgX3Nlc3Npb246IENoYXRNb2RlbCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbWVzc2FnZTogSVBhcnNlZENoYXRSZXF1ZXN0LFxuXHRcdHByaXZhdGUgX3ZhcmlhYmxlRGF0YTogSUNoYXRSZXF1ZXN0VmFyaWFibGVEYXRhLFxuXHRcdHB1YmxpYyByZWFkb25seSB0aW1lc3RhbXA6IG51bWJlcixcblx0XHRwcml2YXRlIF9hdHRlbXB0OiBudW1iZXIgPSAwLFxuXHRcdHByaXZhdGUgX2NvbmZpcm1hdGlvbj86IHN0cmluZyxcblx0XHRwcml2YXRlIF9sb2NhdGlvbkRhdGE/OiBJQ2hhdExvY2F0aW9uRGF0YSxcblx0XHRwcml2YXRlIF9hdHRhY2hlZENvbnRleHQ/OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5W10sXG5cdFx0cHVibGljIHJlYWRvbmx5IGlzQ29tcGxldGVBZGRlZFJlcXVlc3QgPSBmYWxzZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgbW9kZWxJZD86IHN0cmluZyxcblx0XHRyZXN0b3JlZElkPzogc3RyaW5nLFxuXHQpIHtcblx0XHR0aGlzLmlkID0gcmVzdG9yZWRJZCA/PyAncmVxdWVzdF8nICsgZ2VuZXJhdGVVdWlkKCk7XG5cdFx0Ly8gdGhpcy50aW1lc3RhbXAgPSBEYXRlLm5vdygpO1xuXHR9XG5cblx0YWRvcHRUbyhzZXNzaW9uOiBDaGF0TW9kZWwpIHtcblx0XHR0aGlzLl9zZXNzaW9uID0gc2Vzc2lvbjtcblx0fVxufVxuXG5jbGFzcyBBYnN0cmFjdFJlc3BvbnNlIGltcGxlbWVudHMgSVJlc3BvbnNlIHtcblx0cHJvdGVjdGVkIF9yZXNwb25zZVBhcnRzOiBJQ2hhdFByb2dyZXNzUmVzcG9uc2VDb250ZW50W107XG5cblx0LyoqXG5cdCAqIEEgc3RyaW5naWZpZWQgcmVwcmVzZW50YXRpb24gb2YgcmVzcG9uc2UgZGF0YSB3aGljaCBtaWdodCBiZSBwcmVzZW50ZWQgdG8gYSBzY3JlZW5yZWFkZXIgb3IgdXNlZCB3aGVuIGNvcHlpbmcgYSByZXNwb25zZS5cblx0ICovXG5cdHByb3RlY3RlZCBfcmVzcG9uc2VSZXByID0gJyc7XG5cblx0LyoqXG5cdCAqIEp1c3QgdGhlIG1hcmtkb3duIGNvbnRlbnQgb2YgdGhlIHJlc3BvbnNlLCB1c2VkIGZvciBkZXRlcm1pbmluZyB0aGUgcmVuZGVyaW5nIHJhdGUgb2YgbWFya2Rvd25cblx0ICovXG5cdHByb3RlY3RlZCBfbWFya2Rvd25Db250ZW50ID0gJyc7XG5cblx0Z2V0IHZhbHVlKCk6IElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnRbXSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc3BvbnNlUGFydHM7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcih2YWx1ZTogSUNoYXRQcm9ncmVzc1Jlc3BvbnNlQ29udGVudFtdKSB7XG5cdFx0dGhpcy5fcmVzcG9uc2VQYXJ0cyA9IHZhbHVlO1xuXHRcdHRoaXMuX3VwZGF0ZVJlcHIoKTtcblx0fVxuXG5cdHRvU3RyaW5nKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX3Jlc3BvbnNlUmVwcjtcblx0fVxuXG5cdC8qKlxuXHQgKiBfSnVzdF8gdGhlIGNvbnRlbnQgb2YgbWFya2Rvd24gcGFydHMgaW4gdGhlIHJlc3BvbnNlXG5cdCAqL1xuXHRnZXRNYXJrZG93bigpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9tYXJrZG93bkNvbnRlbnQ7XG5cdH1cblxuXHRwcm90ZWN0ZWQgX3VwZGF0ZVJlcHIoKSB7XG5cdFx0dGhpcy5fcmVzcG9uc2VSZXByID0gdGhpcy5wYXJ0c1RvUmVwcih0aGlzLl9yZXNwb25zZVBhcnRzKTtcblxuXHRcdHRoaXMuX21hcmtkb3duQ29udGVudCA9IHRoaXMuX3Jlc3BvbnNlUGFydHMubWFwKHBhcnQgPT4ge1xuXHRcdFx0aWYgKHBhcnQua2luZCA9PT0gJ2lubGluZVJlZmVyZW5jZScpIHtcblx0XHRcdFx0cmV0dXJuIHRoaXMuaW5saW5lUmVmVG9SZXByKHBhcnQpO1xuXHRcdFx0fSBlbHNlIGlmIChwYXJ0LmtpbmQgPT09ICdtYXJrZG93bkNvbnRlbnQnIHx8IHBhcnQua2luZCA9PT0gJ21hcmtkb3duVnVsbicpIHtcblx0XHRcdFx0cmV0dXJuIHBhcnQuY29udGVudC52YWx1ZTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdHJldHVybiAnJztcblx0XHRcdH1cblx0XHR9KVxuXHRcdFx0LmZpbHRlcihzID0+IHMubGVuZ3RoID4gMClcblx0XHRcdC5qb2luKCcnKTtcblx0fVxuXG5cdHByaXZhdGUgcGFydHNUb1JlcHIocGFydHM6IHJlYWRvbmx5IElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnRbXSk6IHN0cmluZyB7XG5cdFx0Y29uc3QgYmxvY2tzOiBzdHJpbmdbXSA9IFtdO1xuXHRcdGxldCBjdXJyZW50QmxvY2tTZWdtZW50czogc3RyaW5nW10gPSBbXTtcblxuXHRcdGZvciAoY29uc3QgcGFydCBvZiBwYXJ0cykge1xuXHRcdFx0bGV0IHNlZ21lbnQ6IHsgdGV4dDogc3RyaW5nOyBpc0Jsb2NrPzogYm9vbGVhbiB9IHwgdW5kZWZpbmVkO1xuXHRcdFx0c3dpdGNoIChwYXJ0LmtpbmQpIHtcblx0XHRcdFx0Y2FzZSAndHJlZURhdGEnOlxuXHRcdFx0XHRjYXNlICdwcm9ncmVzc01lc3NhZ2UnOlxuXHRcdFx0XHRjYXNlICdjb2RlYmxvY2tVcmknOlxuXHRcdFx0XHRjYXNlICd0b29sSW52b2NhdGlvbic6XG5cdFx0XHRcdGNhc2UgJ3Rvb2xJbnZvY2F0aW9uU2VyaWFsaXplZCc6XG5cdFx0XHRcdGNhc2UgJ3VuZG9TdG9wJzpcblx0XHRcdFx0XHQvLyBJZ25vcmVcblx0XHRcdFx0XHRjb250aW51ZTtcblx0XHRcdFx0Y2FzZSAnaW5saW5lUmVmZXJlbmNlJzpcblx0XHRcdFx0XHRzZWdtZW50ID0geyB0ZXh0OiB0aGlzLmlubGluZVJlZlRvUmVwcihwYXJ0KSB9O1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlICdjb21tYW5kJzpcblx0XHRcdFx0XHRzZWdtZW50ID0geyB0ZXh0OiBwYXJ0LmNvbW1hbmQudGl0bGUsIGlzQmxvY2s6IHRydWUgfTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSAndGV4dEVkaXRHcm91cCc6XG5cdFx0XHRcdGNhc2UgJ25vdGVib29rRWRpdEdyb3VwJzpcblx0XHRcdFx0XHRzZWdtZW50ID0geyB0ZXh0OiBsb2NhbGl6ZSgnZWRpdHNTdW1tYXJ5JywgXCJNYWRlIGNoYW5nZXMuXCIpLCBpc0Jsb2NrOiB0cnVlIH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgJ2NvbmZpcm1hdGlvbic6XG5cdFx0XHRcdFx0c2VnbWVudCA9IHsgdGV4dDogYCR7cGFydC50aXRsZX1cXG4ke3BhcnQubWVzc2FnZX1gLCBpc0Jsb2NrOiB0cnVlIH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGRlZmF1bHQ6XG5cdFx0XHRcdFx0c2VnbWVudCA9IHsgdGV4dDogcGFydC5jb250ZW50LnZhbHVlIH07XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChzZWdtZW50LmlzQmxvY2spIHtcblx0XHRcdFx0aWYgKGN1cnJlbnRCbG9ja1NlZ21lbnRzLmxlbmd0aCkge1xuXHRcdFx0XHRcdGJsb2Nrcy5wdXNoKGN1cnJlbnRCbG9ja1NlZ21lbnRzLmpvaW4oJycpKTtcblx0XHRcdFx0XHRjdXJyZW50QmxvY2tTZWdtZW50cyA9IFtdO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGJsb2Nrcy5wdXNoKHNlZ21lbnQudGV4dCk7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRjdXJyZW50QmxvY2tTZWdtZW50cy5wdXNoKHNlZ21lbnQudGV4dCk7XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKGN1cnJlbnRCbG9ja1NlZ21lbnRzLmxlbmd0aCkge1xuXHRcdFx0YmxvY2tzLnB1c2goY3VycmVudEJsb2NrU2VnbWVudHMuam9pbignJykpO1xuXHRcdH1cblxuXHRcdHJldHVybiBibG9ja3Muam9pbignXFxuXFxuJyk7XG5cdH1cblxuXHRwcml2YXRlIGlubGluZVJlZlRvUmVwcihwYXJ0OiBJQ2hhdENvbnRlbnRJbmxpbmVSZWZlcmVuY2UpIHtcblx0XHRpZiAoJ3VyaScgaW4gcGFydC5pbmxpbmVSZWZlcmVuY2UpIHtcblx0XHRcdHJldHVybiB0aGlzLnVyaVRvUmVwcihwYXJ0LmlubGluZVJlZmVyZW5jZS51cmkpO1xuXHRcdH1cblxuXHRcdHJldHVybiAnbmFtZScgaW4gcGFydC5pbmxpbmVSZWZlcmVuY2Vcblx0XHRcdD8gJ2AnICsgcGFydC5pbmxpbmVSZWZlcmVuY2UubmFtZSArICdgJ1xuXHRcdFx0OiB0aGlzLnVyaVRvUmVwcihwYXJ0LmlubGluZVJlZmVyZW5jZSk7XG5cdH1cblxuXHRwcml2YXRlIHVyaVRvUmVwcih1cmk6IFVSSSk6IHN0cmluZyB7XG5cdFx0aWYgKHVyaS5zY2hlbWUgPT09IFNjaGVtYXMuaHR0cCB8fCB1cmkuc2NoZW1lID09PSBTY2hlbWFzLmh0dHBzKSB7XG5cdFx0XHRyZXR1cm4gdXJpLnRvU3RyaW5nKGZhbHNlKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gYmFzZW5hbWUodXJpKTtcblx0fVxufVxuXG4vKiogQSB2aWV3IG9mIGEgc3Vic2V0IG9mIGEgcmVzcG9uc2UgKi9cbmNsYXNzIFJlc3BvbnNlVmlldyBleHRlbmRzIEFic3RyYWN0UmVzcG9uc2Uge1xuXHRjb25zdHJ1Y3Rvcihcblx0XHRfcmVzcG9uc2U6IElSZXNwb25zZSxcblx0XHRwdWJsaWMgcmVhZG9ubHkgdW5kb1N0b3A6IHN0cmluZyxcblx0KSB7XG5cdFx0Y29uc3QgaWR4ID0gX3Jlc3BvbnNlLnZhbHVlLmZpbmRJbmRleCh2ID0+IHYua2luZCA9PT0gJ3VuZG9TdG9wJyAmJiB2LmlkID09PSB1bmRvU3RvcCk7XG5cdFx0c3VwZXIoaWR4ID09PSAtMSA/IF9yZXNwb25zZS52YWx1ZS5zbGljZSgpIDogX3Jlc3BvbnNlLnZhbHVlLnNsaWNlKDAsIGlkeCkpO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBSZXNwb25zZSBleHRlbmRzIEFic3RyYWN0UmVzcG9uc2UgaW1wbGVtZW50cyBJRGlzcG9zYWJsZSB7XG5cdHByaXZhdGUgX29uRGlkQ2hhbmdlVmFsdWUgPSBuZXcgRW1pdHRlcjx2b2lkPigpO1xuXHRwdWJsaWMgZ2V0IG9uRGlkQ2hhbmdlVmFsdWUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZXZlbnQ7XG5cdH1cblxuXHRwcml2YXRlIF9jaXRhdGlvbnM6IElDaGF0Q29kZUNpdGF0aW9uW10gPSBbXTtcblxuXG5cdGNvbnN0cnVjdG9yKHZhbHVlOiBJTWFya2Rvd25TdHJpbmcgfCBSZWFkb25seUFycmF5PElNYXJrZG93blN0cmluZyB8IElDaGF0UmVzcG9uc2VQcm9ncmVzc0ZpbGVUcmVlRGF0YSB8IElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZSB8IElDaGF0QWdlbnRNYXJrZG93bkNvbnRlbnRXaXRoVnVsbmVyYWJpbGl0eSB8IElDaGF0UmVzcG9uc2VDb2RlYmxvY2tVcmlQYXJ0Pikge1xuXHRcdHN1cGVyKGFzQXJyYXkodmFsdWUpLm1hcCgodikgPT4gKGlzTWFya2Rvd25TdHJpbmcodikgP1xuXHRcdFx0eyBjb250ZW50OiB2LCBraW5kOiAnbWFya2Rvd25Db250ZW50JyB9IHNhdGlzZmllcyBJQ2hhdE1hcmtkb3duQ29udGVudCA6XG5cdFx0XHQna2luZCcgaW4gdiA/IHYgOiB7IGtpbmQ6ICd0cmVlRGF0YScsIHRyZWVEYXRhOiB2IH0pKSk7XG5cdH1cblxuXHRkaXNwb3NlKCk6IHZvaWQge1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlVmFsdWUuZGlzcG9zZSgpO1xuXHR9XG5cblxuXHRjbGVhcigpOiB2b2lkIHtcblx0XHR0aGlzLl9yZXNwb25zZVBhcnRzID0gW107XG5cdFx0dGhpcy5fdXBkYXRlUmVwcih0cnVlKTtcblx0fVxuXG5cdHVwZGF0ZUNvbnRlbnQocHJvZ3Jlc3M6IElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnQgfCBJQ2hhdFRleHRFZGl0IHwgSUNoYXROb3RlYm9va0VkaXQgfCBJQ2hhdFRhc2sgfCBJQ2hhdFVuZG9TdG9wLCBxdWlldD86IGJvb2xlYW4pOiB2b2lkIHtcblx0XHRpZiAocHJvZ3Jlc3Mua2luZCA9PT0gJ21hcmtkb3duQ29udGVudCcpIHtcblxuXHRcdFx0Ly8gbGFzdCByZXNwb25zZSB3aGljaCBpcyBOT1QgYSB0ZXh0IGVkaXQgZ3JvdXAgYmVjYXVzZSB3ZSBkbyB3YW50IHRvIHN1cHBvcnQgaGV0ZXJvZ2Vub3VzIHN0cmVhbWluZyBidXQgbm90IGhhdmVcblx0XHRcdC8vIHRoZSBNRCBiZSBjaG9wcGVkIHVwIGJ5IHRleHQgZWRpdCBncm91cHMgKGFuZCBsaWtlbHkgb3RoZXIgbm9uLXJlbmRlcmFibGUgcGFydHMpXG5cdFx0XHRjb25zdCBsYXN0UmVzcG9uc2VQYXJ0ID0gdGhpcy5fcmVzcG9uc2VQYXJ0c1xuXHRcdFx0XHQuZmlsdGVyKHAgPT4gcC5raW5kICE9PSAndGV4dEVkaXRHcm91cCcpXG5cdFx0XHRcdC5hdCgtMSk7XG5cblx0XHRcdGlmICghbGFzdFJlc3BvbnNlUGFydCB8fCBsYXN0UmVzcG9uc2VQYXJ0LmtpbmQgIT09ICdtYXJrZG93bkNvbnRlbnQnIHx8ICFjYW5NZXJnZU1hcmtkb3duU3RyaW5ncyhsYXN0UmVzcG9uc2VQYXJ0LmNvbnRlbnQsIHByb2dyZXNzLmNvbnRlbnQpKSB7XG5cdFx0XHRcdC8vIFRoZSBsYXN0IHBhcnQgY2FuJ3QgYmUgbWVyZ2VkIHdpdGgtIG5vdCBtYXJrZG93biwgb3IgbWFya2Rvd24gd2l0aCBkaWZmZXJlbnQgcGVybWlzc2lvbnNcblx0XHRcdFx0dGhpcy5fcmVzcG9uc2VQYXJ0cy5wdXNoKHByb2dyZXNzKTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdC8vIERvbid0IG1vZGlmeSB0aGUgY3VycmVudCBvYmplY3QsIHNpbmNlIGl0J3MgYmVpbmcgZGlmZmVkIGJ5IHRoZSByZW5kZXJlclxuXHRcdFx0XHRjb25zdCBpZHggPSB0aGlzLl9yZXNwb25zZVBhcnRzLmluZGV4T2YobGFzdFJlc3BvbnNlUGFydCk7XG5cdFx0XHRcdHRoaXMuX3Jlc3BvbnNlUGFydHNbaWR4XSA9IHsgLi4ubGFzdFJlc3BvbnNlUGFydCwgY29udGVudDogYXBwZW5kTWFya2Rvd25TdHJpbmcobGFzdFJlc3BvbnNlUGFydC5jb250ZW50LCBwcm9ncmVzcy5jb250ZW50KSB9O1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fdXBkYXRlUmVwcihxdWlldCk7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy5raW5kID09PSAndGV4dEVkaXQnIHx8IHByb2dyZXNzLmtpbmQgPT09ICdub3RlYm9va0VkaXQnKSB7XG5cdFx0XHQvLyBJZiB0aGUgcHJvZ3Jlc3MudXJpIGlzIGEgY2VsbCBVcmksIGl0cyBwb3NzaWJsZSBpdHMgcGFydCBvZiB0aGUgaW5saW5lIGNoYXQuXG5cdFx0XHQvLyBPbGQgYXBwcm9hY2ggb2Ygbm90ZWJvb2sgaW5saW5lIGNoYXQgd291bGQgbm90IHN0YXJ0IGFuZCBlbmQgd2l0aCBub3RlYm9vayBVcmksIHNvIHdlIG5lZWQgdG8gY2hlY2sgZm9yIG9sZCBhcHByb2FjaC5cblx0XHRcdGNvbnN0IHVzZU9sZEFwcHJvYWNoRm9ySW5saW5lTm90ZWJvb2sgPSBwcm9ncmVzcy51cmkuc2NoZW1lID09PSBTY2hlbWFzLnZzY29kZU5vdGVib29rQ2VsbCAmJiAhdGhpcy5fcmVzcG9uc2VQYXJ0cy5maW5kKHBhcnQgPT4gcGFydC5raW5kID09PSAnbm90ZWJvb2tFZGl0R3JvdXAnKTtcblx0XHRcdC8vIG1lcmdlIGVkaXRzIGZvciB0aGUgc2FtZSBmaWxlIG5vIG1hdHRlciB3aGVuIHRoZXkgY29tZSBpblxuXHRcdFx0Y29uc3Qgbm90ZWJvb2tVcmkgPSB1c2VPbGRBcHByb2FjaEZvcklubGluZU5vdGVib29rID8gdW5kZWZpbmVkIDogQ2VsbFVyaS5wYXJzZShwcm9ncmVzcy51cmkpPy5ub3RlYm9vaztcblx0XHRcdGNvbnN0IHVyaSA9IG5vdGVib29rVXJpID8/IHByb2dyZXNzLnVyaTtcblx0XHRcdGxldCBmb3VuZCA9IGZhbHNlO1xuXHRcdFx0Y29uc3QgZ3JvdXBLaW5kID0gcHJvZ3Jlc3Mua2luZCA9PT0gJ3RleHRFZGl0JyAmJiAhbm90ZWJvb2tVcmkgPyAndGV4dEVkaXRHcm91cCcgOiAnbm90ZWJvb2tFZGl0R3JvdXAnO1xuXHRcdFx0Y29uc3QgZWRpdHM6IGFueSA9IGdyb3VwS2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnID8gcHJvZ3Jlc3MuZWRpdHMgOiBwcm9ncmVzcy5lZGl0cy5tYXAoZWRpdCA9PiBUZXh0RWRpdC5pc1RleHRFZGl0KGVkaXQpID8geyB1cmk6IHByb2dyZXNzLnVyaSwgZWRpdCB9IDogZWRpdCk7XG5cdFx0XHRmb3IgKGxldCBpID0gMDsgIWZvdW5kICYmIGkgPCB0aGlzLl9yZXNwb25zZVBhcnRzLmxlbmd0aDsgaSsrKSB7XG5cdFx0XHRcdGNvbnN0IGNhbmRpZGF0ZSA9IHRoaXMuX3Jlc3BvbnNlUGFydHNbaV07XG5cdFx0XHRcdGlmIChjYW5kaWRhdGUua2luZCA9PT0gZ3JvdXBLaW5kICYmICFjYW5kaWRhdGUuZG9uZSAmJiBpc0VxdWFsKGNhbmRpZGF0ZS51cmksIHVyaSkpIHtcblx0XHRcdFx0XHRjYW5kaWRhdGUuZWRpdHMucHVzaChlZGl0cyk7XG5cdFx0XHRcdFx0Y2FuZGlkYXRlLmRvbmUgPSBwcm9ncmVzcy5kb25lO1xuXHRcdFx0XHRcdGZvdW5kID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0aWYgKCFmb3VuZCkge1xuXHRcdFx0XHR0aGlzLl9yZXNwb25zZVBhcnRzLnB1c2goe1xuXHRcdFx0XHRcdGtpbmQ6IGdyb3VwS2luZCxcblx0XHRcdFx0XHR1cmksXG5cdFx0XHRcdFx0ZWRpdHM6IGdyb3VwS2luZCA9PT0gJ3RleHRFZGl0R3JvdXAnID8gW2VkaXRzXSA6IGVkaXRzLFxuXHRcdFx0XHRcdGRvbmU6IHByb2dyZXNzLmRvbmVcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl91cGRhdGVSZXByKHF1aWV0KTtcblx0XHR9IGVsc2UgaWYgKHByb2dyZXNzLmtpbmQgPT09ICdwcm9ncmVzc1Rhc2snKSB7XG5cdFx0XHQvLyBBZGQgYSBuZXcgcmVzb2x2aW5nIHBhcnRcblx0XHRcdGNvbnN0IHJlc3BvbnNlUG9zaXRpb24gPSB0aGlzLl9yZXNwb25zZVBhcnRzLnB1c2gocHJvZ3Jlc3MpIC0gMTtcblx0XHRcdHRoaXMuX3VwZGF0ZVJlcHIocXVpZXQpO1xuXG5cdFx0XHRjb25zdCBkaXNwID0gcHJvZ3Jlc3Mub25EaWRBZGRQcm9ncmVzcygoKSA9PiB7XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVJlcHIoZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHRcdHByb2dyZXNzLnRhc2s/LigpLnRoZW4oKGNvbnRlbnQpID0+IHtcblx0XHRcdFx0Ly8gU3RvcCBsaXN0ZW5pbmcgZm9yIHByb2dyZXNzIHVwZGF0ZXMgb25jZSB0aGUgdGFzayBzZXR0bGVzXG5cdFx0XHRcdGRpc3AuZGlzcG9zZSgpO1xuXG5cdFx0XHRcdC8vIFJlcGxhY2UgdGhlIHJlc29sdmluZyBwYXJ0J3MgY29udGVudCB3aXRoIHRoZSByZXNvbHZlZCByZXNwb25zZVxuXHRcdFx0XHRpZiAodHlwZW9mIGNvbnRlbnQgPT09ICdzdHJpbmcnKSB7XG5cdFx0XHRcdFx0KHRoaXMuX3Jlc3BvbnNlUGFydHNbcmVzcG9uc2VQb3NpdGlvbl0gYXMgSUNoYXRUYXNrKS5jb250ZW50ID0gbmV3IE1hcmtkb3duU3RyaW5nKGNvbnRlbnQpO1xuXHRcdFx0XHR9XG5cdFx0XHRcdHRoaXMuX3VwZGF0ZVJlcHIoZmFsc2UpO1xuXHRcdFx0fSk7XG5cblx0XHR9IGVsc2UgaWYgKHByb2dyZXNzLmtpbmQgPT09ICd0b29sSW52b2NhdGlvbicpIHtcblx0XHRcdGlmIChwcm9ncmVzcy5jb25maXJtYXRpb25NZXNzYWdlcykge1xuXHRcdFx0XHRwcm9ncmVzcy5jb25maXJtZWQucC50aGVuKCgpID0+IHtcblx0XHRcdFx0XHR0aGlzLl91cGRhdGVSZXByKGZhbHNlKTtcblx0XHRcdFx0fSk7XG5cdFx0XHR9XG5cdFx0XHRwcm9ncmVzcy5pc0NvbXBsZXRlUHJvbWlzZS50aGVuKCgpID0+IHtcblx0XHRcdFx0dGhpcy5fdXBkYXRlUmVwcihmYWxzZSk7XG5cdFx0XHR9KTtcblx0XHRcdHRoaXMuX3Jlc3BvbnNlUGFydHMucHVzaChwcm9ncmVzcyk7XG5cdFx0XHR0aGlzLl91cGRhdGVSZXByKHF1aWV0KTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5fcmVzcG9uc2VQYXJ0cy5wdXNoKHByb2dyZXNzKTtcblx0XHRcdHRoaXMuX3VwZGF0ZVJlcHIocXVpZXQpO1xuXHRcdH1cblx0fVxuXG5cdHB1YmxpYyBhZGRDaXRhdGlvbihjaXRhdGlvbjogSUNoYXRDb2RlQ2l0YXRpb24pIHtcblx0XHR0aGlzLl9jaXRhdGlvbnMucHVzaChjaXRhdGlvbik7XG5cdFx0dGhpcy5fdXBkYXRlUmVwcigpO1xuXHR9XG5cblx0cHJvdGVjdGVkIG92ZXJyaWRlIF91cGRhdGVSZXByKHF1aWV0PzogYm9vbGVhbikge1xuXHRcdHN1cGVyLl91cGRhdGVSZXByKCk7XG5cdFx0aWYgKCF0aGlzLl9vbkRpZENoYW5nZVZhbHVlKSB7XG5cdFx0XHRyZXR1cm47IC8vIGNhbGxlZCBmcm9tIHBhcmVudCBjb25zdHJ1Y3RvclxuXHRcdH1cblxuXHRcdHRoaXMuX3Jlc3BvbnNlUmVwciArPSB0aGlzLl9jaXRhdGlvbnMubGVuZ3RoID8gJ1xcblxcbicgKyBnZXRDb2RlQ2l0YXRpb25zTWVzc2FnZSh0aGlzLl9jaXRhdGlvbnMpIDogJyc7XG5cblx0XHRpZiAoIXF1aWV0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVZhbHVlLmZpcmUoKTtcblx0XHR9XG5cdH1cbn1cblxuXG5leHBvcnQgY2xhc3MgQ2hhdFJlc3BvbnNlTW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRSZXNwb25zZU1vZGVsIHtcblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWRDaGFuZ2UgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjxDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbj4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0cHVibGljIHJlYWRvbmx5IGlkOiBzdHJpbmc7XG5cblx0cHVibGljIGdldCBzZXNzaW9uKCkge1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9uO1xuXHR9XG5cblx0cHVibGljIGdldCBzaG91bGRCZVJlbW92ZWRPblNlbmQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX3Nob3VsZEJlUmVtb3ZlZE9uU2VuZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNDb21wbGV0ZSgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNDb21wbGV0ZTtcblx0fVxuXG5cdHB1YmxpYyBzZXQgc2hvdWxkQmVSZW1vdmVkT25TZW5kKGRpc2FibGVtZW50OiBJQ2hhdFJlcXVlc3REaXNhYmxlbWVudCB8IHVuZGVmaW5lZCkge1xuXHRcdHRoaXMuX3Nob3VsZEJlUmVtb3ZlZE9uU2VuZCA9IGRpc2FibGVtZW50O1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZGVmYXVsdENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uKTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgaXNDYW5jZWxlZCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5faXNDYW5jZWxlZDtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdm90ZSgpOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdm90ZTtcblx0fVxuXG5cdHB1YmxpYyBnZXQgdm90ZURvd25SZWFzb24oKTogQ2hhdEFnZW50Vm90ZURvd25SZWFzb24gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl92b3RlRG93blJlYXNvbjtcblx0fVxuXG5cdHB1YmxpYyBnZXQgZm9sbG93dXBzKCk6IElDaGF0Rm9sbG93dXBbXSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2ZvbGxvd3Vwcztcblx0fVxuXG5cdHByaXZhdGUgX3Jlc3BvbnNlOiBSZXNwb25zZTtcblx0cHJpdmF0ZSBfZmluYWxpemVkUmVzcG9uc2U/OiBJUmVzcG9uc2U7XG5cdHB1YmxpYyBnZXQgZW50aXJlUmVzcG9uc2UoKTogSVJlc3BvbnNlIHtcblx0XHRyZXR1cm4gdGhpcy5fZmluYWxpemVkUmVzcG9uc2UgfHwgdGhpcy5fcmVzcG9uc2U7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IHJlc3VsdCgpOiBJQ2hhdEFnZW50UmVzdWx0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVzdWx0O1xuXHR9XG5cblx0cHVibGljIGdldCB1c2VybmFtZSgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLnNlc3Npb24ucmVzcG9uZGVyVXNlcm5hbWU7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGF2YXRhckljb24oKTogVGhlbWVJY29uIHwgVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5zZXNzaW9uLnJlc3BvbmRlckF2YXRhckljb247XG5cdH1cblxuXHRwcml2YXRlIF9mb2xsb3d1cHM/OiBJQ2hhdEZvbGxvd3VwW107XG5cblx0cHVibGljIGdldCBhZ2VudCgpOiBJQ2hhdEFnZW50RGF0YSB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2FnZW50O1xuXHR9XG5cblx0cHVibGljIGdldCBzbGFzaENvbW1hbmQoKTogSUNoYXRBZ2VudENvbW1hbmQgfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zbGFzaENvbW1hbmQ7XG5cdH1cblxuXHRwcml2YXRlIF9hZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQ6IGJvb2xlYW4gfCB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgYWdlbnRPclNsYXNoQ29tbWFuZERldGVjdGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9hZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQgPz8gZmFsc2U7XG5cdH1cblxuXHRwcml2YXRlIF91c2VkQ29udGV4dDogSUNoYXRVc2VkQ29udGV4dCB8IHVuZGVmaW5lZDtcblx0cHVibGljIGdldCB1c2VkQ29udGV4dCgpOiBJQ2hhdFVzZWRDb250ZXh0IHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fdXNlZENvbnRleHQ7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9jb250ZW50UmVmZXJlbmNlczogSUNoYXRDb250ZW50UmVmZXJlbmNlW10gPSBbXTtcblx0cHVibGljIGdldCBjb250ZW50UmVmZXJlbmNlcygpOiBSZWFkb25seUFycmF5PElDaGF0Q29udGVudFJlZmVyZW5jZT4ge1xuXHRcdHJldHVybiBBcnJheS5mcm9tKHRoaXMuX2NvbnRlbnRSZWZlcmVuY2VzKTtcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2NvZGVDaXRhdGlvbnM6IElDaGF0Q29kZUNpdGF0aW9uW10gPSBbXTtcblx0cHVibGljIGdldCBjb2RlQ2l0YXRpb25zKCk6IFJlYWRvbmx5QXJyYXk8SUNoYXRDb2RlQ2l0YXRpb24+IHtcblx0XHRyZXR1cm4gdGhpcy5fY29kZUNpdGF0aW9ucztcblx0fVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX3Byb2dyZXNzTWVzc2FnZXM6IElDaGF0UHJvZ3Jlc3NNZXNzYWdlW10gPSBbXTtcblx0cHVibGljIGdldCBwcm9ncmVzc01lc3NhZ2VzKCk6IFJlYWRvbmx5QXJyYXk8SUNoYXRQcm9ncmVzc01lc3NhZ2U+IHtcblx0XHRyZXR1cm4gdGhpcy5fcHJvZ3Jlc3NNZXNzYWdlcztcblx0fVxuXG5cdHByaXZhdGUgX2lzU3RhbGU6IGJvb2xlYW4gPSBmYWxzZTtcblx0cHVibGljIGdldCBpc1N0YWxlKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc1N0YWxlO1xuXHR9XG5cblx0cHJpdmF0ZSBfaXNQYXVzZWQgPSBvYnNlcnZhYmxlVmFsdWUoJ2lzUGF1c2VkJywgZmFsc2UpO1xuXHRwdWJsaWMgZ2V0IGlzUGF1c2VkKCk6IElPYnNlcnZhYmxlPGJvb2xlYW4+IHtcblx0XHRyZXR1cm4gdGhpcy5faXNQYXVzZWQ7XG5cdH1cblxuXHRwdWJsaWMgZ2V0IGlzUGVuZGluZ0NvbmZpcm1hdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVzcG9uc2UudmFsdWUuc29tZShwYXJ0ID0+XG5cdFx0XHRwYXJ0LmtpbmQgPT09ICd0b29sSW52b2NhdGlvbicgJiYgcGFydC5pc0NvbmZpcm1lZCA9PT0gdW5kZWZpbmVkXG5cdFx0XHR8fCBwYXJ0LmtpbmQgPT09ICdjb25maXJtYXRpb24nICYmIHBhcnQuaXNVc2VkID09PSBmYWxzZSk7XG5cdH1cblxuXHRwcml2YXRlIF9yZXNwb25zZVZpZXc/OiBSZXNwb25zZVZpZXc7XG5cdHB1YmxpYyBnZXQgcmVzcG9uc2UoKTogSVJlc3BvbnNlIHtcblx0XHRjb25zdCB1bmRvU3RvcCA9IHRoaXMuX3Nob3VsZEJlUmVtb3ZlZE9uU2VuZD8uYWZ0ZXJVbmRvU3RvcDtcblx0XHRpZiAoIXVuZG9TdG9wKSB7XG5cdFx0XHRyZXR1cm4gdGhpcy5fZmluYWxpemVkUmVzcG9uc2UgfHwgdGhpcy5fcmVzcG9uc2U7XG5cdFx0fVxuXG5cdFx0aWYgKHRoaXMuX3Jlc3BvbnNlVmlldz8udW5kb1N0b3AgIT09IHVuZG9TdG9wKSB7XG5cdFx0XHR0aGlzLl9yZXNwb25zZVZpZXcgPSBuZXcgUmVzcG9uc2VWaWV3KHRoaXMuX3Jlc3BvbnNlLCB1bmRvU3RvcCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRoaXMuX3Jlc3BvbnNlVmlldztcblx0fVxuXG5cdC8qKiBGdW5jdGlvbnMgcnVuIG9uY2UgdGhlIGNoYXQgcmVzcG9uc2UgaXMgdW5wYXVzZWQuICovXG5cdHByaXZhdGUgYnVmZmVyZWRQYXVzZUNvbnRlbnQ/OiAoKCkgPT4gdm9pZClbXTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRfcmVzcG9uc2U6IElNYXJrZG93blN0cmluZyB8IFJlYWRvbmx5QXJyYXk8SU1hcmtkb3duU3RyaW5nIHwgSUNoYXRSZXNwb25zZVByb2dyZXNzRmlsZVRyZWVEYXRhIHwgSUNoYXRDb250ZW50SW5saW5lUmVmZXJlbmNlIHwgSUNoYXRBZ2VudE1hcmtkb3duQ29udGVudFdpdGhWdWxuZXJhYmlsaXR5IHwgSUNoYXRSZXNwb25zZUNvZGVibG9ja1VyaVBhcnQ+LFxuXHRcdHByaXZhdGUgX3Nlc3Npb246IENoYXRNb2RlbCxcblx0XHRwcml2YXRlIF9hZ2VudDogSUNoYXRBZ2VudERhdGEgfCB1bmRlZmluZWQsXG5cdFx0cHJpdmF0ZSBfc2xhc2hDb21tYW5kOiBJQ2hhdEFnZW50Q29tbWFuZCB8IHVuZGVmaW5lZCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgcmVxdWVzdElkOiBzdHJpbmcsXG5cdFx0cHJpdmF0ZSBfaXNDb21wbGV0ZTogYm9vbGVhbiA9IGZhbHNlLFxuXHRcdHByaXZhdGUgX2lzQ2FuY2VsZWQgPSBmYWxzZSxcblx0XHRwcml2YXRlIF92b3RlPzogQ2hhdEFnZW50Vm90ZURpcmVjdGlvbixcblx0XHRwcml2YXRlIF92b3RlRG93blJlYXNvbj86IENoYXRBZ2VudFZvdGVEb3duUmVhc29uLFxuXHRcdHByaXZhdGUgX3Jlc3VsdD86IElDaGF0QWdlbnRSZXN1bHQsXG5cdFx0Zm9sbG93dXBzPzogUmVhZG9ubHlBcnJheTxJQ2hhdEZvbGxvd3VwPixcblx0XHRwdWJsaWMgcmVhZG9ubHkgaXNDb21wbGV0ZUFkZGVkUmVxdWVzdCA9IGZhbHNlLFxuXHRcdHByaXZhdGUgX3Nob3VsZEJlUmVtb3ZlZE9uU2VuZDogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQsXG5cdFx0cmVzdG9yZWRJZD86IHN0cmluZ1xuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0Ly8gSWYgd2UgYXJlIGNyZWF0aW5nIGEgcmVzcG9uc2Ugd2l0aCBzb21lIGV4aXN0aW5nIGNvbnRlbnQsIGNvbnNpZGVyIGl0IHN0YWxlXG5cdFx0dGhpcy5faXNTdGFsZSA9IEFycmF5LmlzQXJyYXkoX3Jlc3BvbnNlKSAmJiAoX3Jlc3BvbnNlLmxlbmd0aCAhPT0gMCB8fCBpc01hcmtkb3duU3RyaW5nKF9yZXNwb25zZSkgJiYgX3Jlc3BvbnNlLnZhbHVlLmxlbmd0aCAhPT0gMCk7XG5cblx0XHR0aGlzLl9mb2xsb3d1cHMgPSBmb2xsb3d1cHMgPyBbLi4uZm9sbG93dXBzXSA6IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9yZXNwb25zZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBSZXNwb25zZShfcmVzcG9uc2UpKTtcblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLl9yZXNwb25zZS5vbkRpZENoYW5nZVZhbHVlKCgpID0+IHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZGVmYXVsdENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uKSkpO1xuXHRcdHRoaXMuaWQgPSByZXN0b3JlZElkID8/ICdyZXNwb25zZV8nICsgZ2VuZXJhdGVVdWlkKCk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgYSBwcm9ncmVzcyB1cGRhdGUgdG8gdGhlIGFjdHVhbCByZXNwb25zZSBjb250ZW50LlxuXHQgKi9cblx0dXBkYXRlQ29udGVudChyZXNwb25zZVBhcnQ6IElDaGF0UHJvZ3Jlc3NSZXNwb25zZUNvbnRlbnQgfCBJQ2hhdFRleHRFZGl0IHwgSUNoYXROb3RlYm9va0VkaXQsIHF1aWV0PzogYm9vbGVhbikge1xuXHRcdHRoaXMuYnVmZmVyV2hlblBhdXNlZCgoKSA9PiB0aGlzLl9yZXNwb25zZS51cGRhdGVDb250ZW50KHJlc3BvbnNlUGFydCwgcXVpZXQpKTtcblx0fVxuXG5cdC8qKlxuXHQgKiBBZGRzIGFuIHVuZG8gc3RvcCBhdCB0aGUgY3VycmVudCBwb3NpdGlvbiBpbiB0aGUgc3RyZWFtLlxuXHQgKi9cblx0YWRkVW5kb1N0b3AodW5kb1N0b3A6IElDaGF0VW5kb1N0b3ApIHtcblx0XHR0aGlzLmJ1ZmZlcldoZW5QYXVzZWQoKCkgPT4ge1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IHJlYXNvbjogJ3VuZG9TdG9wJywgaWQ6IHVuZG9TdG9wLmlkIH0pO1xuXHRcdFx0dGhpcy5fcmVzcG9uc2UudXBkYXRlQ29udGVudCh1bmRvU3RvcCwgdHJ1ZSk7XG5cdFx0fSk7XG5cdH1cblxuXHQvKipcblx0ICogQXBwbHkgb25lIG9mIHRoZSBwcm9ncmVzcyB1cGRhdGVzIHRoYXQgYXJlIG5vdCBwYXJ0IG9mIHRoZSBhY3R1YWwgcmVzcG9uc2UgY29udGVudC5cblx0ICovXG5cdGFwcGx5UmVmZXJlbmNlKHByb2dyZXNzOiBJQ2hhdFVzZWRDb250ZXh0IHwgSUNoYXRDb250ZW50UmVmZXJlbmNlKSB7XG5cdFx0aWYgKHByb2dyZXNzLmtpbmQgPT09ICd1c2VkQ29udGV4dCcpIHtcblx0XHRcdHRoaXMuX3VzZWRDb250ZXh0ID0gcHJvZ3Jlc3M7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy5raW5kID09PSAncmVmZXJlbmNlJykge1xuXHRcdFx0dGhpcy5fY29udGVudFJlZmVyZW5jZXMucHVzaChwcm9ncmVzcyk7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGRlZmF1bHRDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbik7XG5cdFx0fVxuXHR9XG5cblx0YXBwbHlDb2RlQ2l0YXRpb24ocHJvZ3Jlc3M6IElDaGF0Q29kZUNpdGF0aW9uKSB7XG5cdFx0dGhpcy5fY29kZUNpdGF0aW9ucy5wdXNoKHByb2dyZXNzKTtcblx0XHR0aGlzLl9yZXNwb25zZS5hZGRDaXRhdGlvbihwcm9ncmVzcyk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShkZWZhdWx0Q2hhdFJlc3BvbnNlTW9kZWxDaGFuZ2VSZWFzb24pO1xuXHR9XG5cblx0c2V0QWdlbnQoYWdlbnQ6IElDaGF0QWdlbnREYXRhLCBzbGFzaENvbW1hbmQ/OiBJQ2hhdEFnZW50Q29tbWFuZCkge1xuXHRcdHRoaXMuX2FnZW50ID0gYWdlbnQ7XG5cdFx0dGhpcy5fc2xhc2hDb21tYW5kID0gc2xhc2hDb21tYW5kO1xuXHRcdHRoaXMuX2FnZW50T3JTbGFzaENvbW1hbmREZXRlY3RlZCA9ICFhZ2VudC5pc0RlZmF1bHQgfHwgISFzbGFzaENvbW1hbmQ7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShkZWZhdWx0Q2hhdFJlc3BvbnNlTW9kZWxDaGFuZ2VSZWFzb24pO1xuXHR9XG5cblx0c2V0UmVzdWx0KHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCk6IHZvaWQge1xuXHRcdHRoaXMuX3Jlc3VsdCA9IHJlc3VsdDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGRlZmF1bHRDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbik7XG5cdH1cblxuXHRjb21wbGV0ZSgpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5fcmVzdWx0Py5lcnJvckRldGFpbHM/LnJlc3BvbnNlSXNSZWRhY3RlZCkge1xuXHRcdFx0dGhpcy5fcmVzcG9uc2UuY2xlYXIoKTtcblx0XHR9XG5cblx0XHR0aGlzLl9pc0NvbXBsZXRlID0gdHJ1ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGRlZmF1bHRDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbik7XG5cdH1cblxuXHRjYW5jZWwoKTogdm9pZCB7XG5cdFx0dGhpcy5faXNDb21wbGV0ZSA9IHRydWU7XG5cdFx0dGhpcy5faXNDYW5jZWxlZCA9IHRydWU7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShkZWZhdWx0Q2hhdFJlc3BvbnNlTW9kZWxDaGFuZ2VSZWFzb24pO1xuXHR9XG5cblx0c2V0Rm9sbG93dXBzKGZvbGxvd3VwczogSUNoYXRGb2xsb3d1cFtdIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fZm9sbG93dXBzID0gZm9sbG93dXBzO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZGVmYXVsdENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uKTsgLy8gRmlyZSBzbyB0aGF0IGNvbW1hbmQgZm9sbG93dXBzIGdldCByZW5kZXJlZCBvbiB0aGUgcm93XG5cdH1cblxuXHRzZXRWb3RlKHZvdGU6IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24pOiB2b2lkIHtcblx0XHR0aGlzLl92b3RlID0gdm90ZTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGRlZmF1bHRDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbik7XG5cdH1cblxuXHRzZXRWb3RlRG93blJlYXNvbihyZWFzb246IENoYXRBZ2VudFZvdGVEb3duUmVhc29uIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fdm90ZURvd25SZWFzb24gPSByZWFzb247XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShkZWZhdWx0Q2hhdFJlc3BvbnNlTW9kZWxDaGFuZ2VSZWFzb24pO1xuXHR9XG5cblx0c2V0RWRpdEFwcGxpZWQoZWRpdDogSUNoYXRUZXh0RWRpdEdyb3VwLCBlZGl0Q291bnQ6IG51bWJlcik6IGJvb2xlYW4ge1xuXHRcdGlmICghdGhpcy5yZXNwb25zZS52YWx1ZS5pbmNsdWRlcyhlZGl0KSkge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0XHRpZiAoIWVkaXQuc3RhdGUpIHtcblx0XHRcdHJldHVybiBmYWxzZTtcblx0XHR9XG5cdFx0ZWRpdC5zdGF0ZS5hcHBsaWVkID0gZWRpdENvdW50OyAvLyBtdXN0IG5vdCBiZSBlZGl0LmVkaXRzLmxlbmd0aFxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoZGVmYXVsdENoYXRSZXNwb25zZU1vZGVsQ2hhbmdlUmVhc29uKTtcblx0XHRyZXR1cm4gdHJ1ZTtcblx0fVxuXG5cdGFkb3B0VG8oc2Vzc2lvbjogQ2hhdE1vZGVsKSB7XG5cdFx0dGhpcy5fc2Vzc2lvbiA9IHNlc3Npb247XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShkZWZhdWx0Q2hhdFJlc3BvbnNlTW9kZWxDaGFuZ2VSZWFzb24pO1xuXHR9XG5cblx0c2V0UGF1c2VkKGlzUGF1c2U6IGJvb2xlYW4sIHR4PzogSVRyYW5zYWN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5faXNQYXVzZWQuc2V0KGlzUGF1c2UsIHR4KTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKGRlZmF1bHRDaGF0UmVzcG9uc2VNb2RlbENoYW5nZVJlYXNvbik7XG5cblx0XHR0aGlzLmJ1ZmZlcmVkUGF1c2VDb250ZW50Py5mb3JFYWNoKGYgPT4gZigpKTtcblx0XHR0aGlzLmJ1ZmZlcmVkUGF1c2VDb250ZW50ID0gdW5kZWZpbmVkO1xuXHR9XG5cblx0ZmluYWxpemVVbmRvU3RhdGUoKTogdm9pZCB7XG5cdFx0dGhpcy5fZmluYWxpemVkUmVzcG9uc2UgPSB0aGlzLnJlc3BvbnNlO1xuXHRcdHRoaXMuX3Jlc3BvbnNlVmlldyA9IHVuZGVmaW5lZDtcblx0XHR0aGlzLl9zaG91bGRCZVJlbW92ZWRPblNlbmQgPSB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIGJ1ZmZlcldoZW5QYXVzZWQoYXBwbHk6ICgpID0+IHZvaWQpIHtcblx0XHRpZiAoIXRoaXMuX2lzUGF1c2VkLmdldCgpKSB7XG5cdFx0XHRhcHBseSgpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHR0aGlzLmJ1ZmZlcmVkUGF1c2VDb250ZW50ID8/PSBbXTtcblx0XHRcdHRoaXMuYnVmZmVyZWRQYXVzZUNvbnRlbnQucHVzaChhcHBseSk7XG5cdFx0fVxuXHR9XG59XG5cbmV4cG9ydCBjb25zdCBlbnVtIENoYXRQYXVzZVN0YXRlIHtcblx0Tm90UGF1c2FibGUsXG5cdFBhdXNlZCxcblx0VW5wYXVzZWQsXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQge1xuXHRyZXF1ZXN0SWQ6IHN0cmluZztcblx0YWZ0ZXJVbmRvU3RvcD86IHN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdE1vZGVsIHtcblx0cmVhZG9ubHkgb25EaWREaXNwb3NlOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2U6IEV2ZW50PElDaGF0Q2hhbmdlRXZlbnQ+O1xuXHRyZWFkb25seSBzZXNzaW9uSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgaW5pdFN0YXRlOiBDaGF0TW9kZWxJbml0U3RhdGU7XG5cdHJlYWRvbmx5IGluaXRpYWxMb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb247XG5cdHJlYWRvbmx5IHRpdGxlOiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNhbXBsZVF1ZXN0aW9uczogSUNoYXRGb2xsb3d1cFtdIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSByZXF1ZXN0SW5Qcm9ncmVzczogYm9vbGVhbjtcblx0cmVhZG9ubHkgcmVxdWVzdFBhdXNpYmlsaXR5OiBDaGF0UGF1c2VTdGF0ZTtcblx0cmVhZG9ubHkgaW5wdXRQbGFjZWhvbGRlcj86IHN0cmluZztcblx0cmVhZG9ubHkgZWRpdGluZ1Nlc3Npb25PYnM/OiBPYnNlcnZhYmxlUHJvbWlzZTxJQ2hhdEVkaXRpbmdTZXNzaW9uPiB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgZWRpdGluZ1Nlc3Npb24/OiBJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgdW5kZWZpbmVkO1xuXHR0b2dnbGVMYXN0UmVxdWVzdFBhdXNlZChwYXVzZWQ/OiBib29sZWFuKTogdm9pZDtcblx0LyoqXG5cdCAqIFNldHMgcmVxdWVzdHMgYXMgJ2Rpc2FibGVkJywgcmVtb3ZpbmcgdGhlbSBmcm9tIHRoZSBVSS4gSWYgYSByZXF1ZXN0IElEXG5cdCAqIGlzIGdpdmVuIHdpdGhvdXQgdW5kbyBzdG9wcywgaXQncyByZW1vdmVkIGVudGlyZWx5LiBJZiBhbiB1bmRvIHN0b3Bcblx0ICogaXMgZ2l2ZW4sIGFsbCBjb250ZW50IGFmdGVyIHRoYXQgc3RvcCBpcyByZW1vdmVkLlxuXHQgKi9cblx0c2V0RGlzYWJsZWRSZXF1ZXN0cyhyZXF1ZXN0SWRzOiBJQ2hhdFJlcXVlc3REaXNhYmxlbWVudFtdKTogdm9pZDtcblx0Z2V0UmVxdWVzdHMoKTogSUNoYXRSZXF1ZXN0TW9kZWxbXTtcblx0dG9FeHBvcnQoKTogSUV4cG9ydGFibGVDaGF0RGF0YTtcblx0dG9KU09OKCk6IElTZXJpYWxpemFibGVDaGF0RGF0YTtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VyaWFsaXphYmxlQ2hhdHNEYXRhIHtcblx0W3Nlc3Npb25JZDogc3RyaW5nXTogSVNlcmlhbGl6YWJsZUNoYXREYXRhO1xufVxuXG5leHBvcnQgdHlwZSBJU2VyaWFsaXphYmxlQ2hhdEFnZW50RGF0YSA9IFVyaUR0bzxJQ2hhdEFnZW50RGF0YT47XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlcmlhbGl6YWJsZUNoYXRSZXF1ZXN0RGF0YSB7XG5cdHJlcXVlc3RJZDogc3RyaW5nO1xuXHRtZXNzYWdlOiBzdHJpbmcgfCBJUGFyc2VkQ2hhdFJlcXVlc3Q7IC8vIHN0cmluZyA9PiBvbGQgZm9ybWF0XG5cdC8qKiBJcyByZWFsbHkgbGlrZSBcInByb21wdCBkYXRhXCIuIFRoaXMgaXMgdGhlIG1lc3NhZ2UgaW4gdGhlIGZvcm1hdCBpbiB3aGljaCB0aGUgYWdlbnQgZ2V0cyBpdCArIHZhcmlhYmxlIHZhbHVlcy4gKi9cblx0dmFyaWFibGVEYXRhOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGE7XG5cdHJlc3BvbnNlOiBSZWFkb25seUFycmF5PElNYXJrZG93blN0cmluZyB8IElDaGF0UmVzcG9uc2VQcm9ncmVzc0ZpbGVUcmVlRGF0YSB8IElDaGF0Q29udGVudElubGluZVJlZmVyZW5jZSB8IElDaGF0QWdlbnRNYXJrZG93bkNvbnRlbnRXaXRoVnVsbmVyYWJpbGl0eT4gfCB1bmRlZmluZWQ7XG5cblx0LyoqT2xkLCBwZXJzaXN0ZWQgbmFtZSBmb3Igc2hvdWxkQmVSZW1vdmVkT25TZW5kICovXG5cdGlzSGlkZGVuPzogYm9vbGVhbjtcblx0c2hvdWxkQmVSZW1vdmVkT25TZW5kPzogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQ7XG5cdHJlc3BvbnNlSWQ/OiBzdHJpbmc7XG5cdGFnZW50PzogSVNlcmlhbGl6YWJsZUNoYXRBZ2VudERhdGE7XG5cdHdvcmtpbmdTZXQ/OiBVcmlDb21wb25lbnRzW107XG5cdHNsYXNoQ29tbWFuZD86IElDaGF0QWdlbnRDb21tYW5kO1xuXHQvLyByZXNwb25zZUVycm9yRGV0YWlsczogSUNoYXRSZXNwb25zZUVycm9yRGV0YWlscyB8IHVuZGVmaW5lZDtcblx0cmVzdWx0PzogSUNoYXRBZ2VudFJlc3VsdDsgLy8gT3B0aW9uYWwgZm9yIGJhY2tjb21wYXRcblx0Zm9sbG93dXBzOiBSZWFkb25seUFycmF5PElDaGF0Rm9sbG93dXA+IHwgdW5kZWZpbmVkO1xuXHRpc0NhbmNlbGVkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHR2b3RlOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHR2b3RlRG93blJlYXNvbj86IENoYXRBZ2VudFZvdGVEb3duUmVhc29uO1xuXHQvKiogRm9yIGJhY2t3YXJkIGNvbXBhdDogc2hvdWxkIGJlIG9wdGlvbmFsICovXG5cdHVzZWRDb250ZXh0PzogSUNoYXRVc2VkQ29udGV4dDtcblx0Y29udGVudFJlZmVyZW5jZXM/OiBSZWFkb25seUFycmF5PElDaGF0Q29udGVudFJlZmVyZW5jZT47XG5cdGNvZGVDaXRhdGlvbnM/OiBSZWFkb25seUFycmF5PElDaGF0Q29kZUNpdGF0aW9uPjtcblx0dGltZXN0YW1wPzogbnVtYmVyO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElFeHBvcnRhYmxlQ2hhdERhdGEge1xuXHRpbml0aWFsTG9jYXRpb246IENoYXRBZ2VudExvY2F0aW9uIHwgdW5kZWZpbmVkO1xuXHRyZXF1ZXN0czogSVNlcmlhbGl6YWJsZUNoYXRSZXF1ZXN0RGF0YVtdO1xuXHRyZXF1ZXN0ZXJVc2VybmFtZTogc3RyaW5nO1xuXHRyZXNwb25kZXJVc2VybmFtZTogc3RyaW5nO1xuXHRyZXF1ZXN0ZXJBdmF0YXJJY29uVXJpOiBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkO1xuXHRyZXNwb25kZXJBdmF0YXJJY29uVXJpOiBUaGVtZUljb24gfCBVcmlDb21wb25lbnRzIHwgdW5kZWZpbmVkOyAvLyBLZWVwaW5nIFVyaSBuYW1lIGZvciBiYWNrY29tcGF0XG59XG5cbi8qXG5cdE5PVEU6IGV2ZXJ5IHRpbWUgdGhlIHNlcmlhbGl6ZWQgZGF0YSBmb3JtYXQgaXMgdXBkYXRlZCwgd2UgbmVlZCB0byBjcmVhdGUgYSBuZXcgaW50ZXJmYWNlLCBiZWNhdXNlIHdlIG1heSBuZWVkIHRvIGhhbmRsZSBhbnkgb2xkIGRhdGEgZm9ybWF0IHdoZW4gcGFyc2luZy5cbiovXG5cbmV4cG9ydCBpbnRlcmZhY2UgSVNlcmlhbGl6YWJsZUNoYXREYXRhMSBleHRlbmRzIElFeHBvcnRhYmxlQ2hhdERhdGEge1xuXHRzZXNzaW9uSWQ6IHN0cmluZztcblx0Y3JlYXRpb25EYXRlOiBudW1iZXI7XG5cdGlzSW1wb3J0ZWQ6IGJvb2xlYW47XG5cblx0LyoqIEluZGljYXRlcyB0aGF0IHRoaXMgc2Vzc2lvbiB3YXMgY3JlYXRlZCBpbiB0aGlzIHdpbmRvdy4gSXMgY2xlYXJlZCBhZnRlciB0aGUgY2hhdCBoYXMgYmVlbiB3cml0dGVuIHRvIHN0b3JhZ2Ugb25jZS4gTmVlZGVkIHRvIHN5bmMgY2hhdCBjcmVhdGlvbnMvZGVsZXRpb25zIGJldHdlZW4gZW1wdHkgd2luZG93cy4gKi9cblx0aXNOZXc/OiBib29sZWFuO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElTZXJpYWxpemFibGVDaGF0RGF0YTIgZXh0ZW5kcyBJU2VyaWFsaXphYmxlQ2hhdERhdGExIHtcblx0dmVyc2lvbjogMjtcblx0bGFzdE1lc3NhZ2VEYXRlOiBudW1iZXI7XG5cdGNvbXB1dGVkVGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJU2VyaWFsaXphYmxlQ2hhdERhdGEzIGV4dGVuZHMgT21pdDxJU2VyaWFsaXphYmxlQ2hhdERhdGEyLCAndmVyc2lvbicgfCAnY29tcHV0ZWRUaXRsZSc+IHtcblx0dmVyc2lvbjogMztcblx0Y3VzdG9tVGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn1cblxuLyoqXG4gKiBDaGF0IGRhdGEgdGhhdCBoYXMgYmVlbiBwYXJzZWQgYW5kIG5vcm1hbGl6ZWQgdG8gdGhlIGN1cnJlbnQgZm9ybWF0LlxuICovXG5leHBvcnQgdHlwZSBJU2VyaWFsaXphYmxlQ2hhdERhdGEgPSBJU2VyaWFsaXphYmxlQ2hhdERhdGEzO1xuXG4vKipcbiAqIENoYXQgZGF0YSB0aGF0IGhhcyBiZWVuIGxvYWRlZCBidXQgbm90IG5vcm1hbGl6ZWQsIGFuZCBjb3VsZCBiZSBhbnkgZm9ybWF0XG4gKi9cbmV4cG9ydCB0eXBlIElTZXJpYWxpemFibGVDaGF0RGF0YUluID0gSVNlcmlhbGl6YWJsZUNoYXREYXRhMSB8IElTZXJpYWxpemFibGVDaGF0RGF0YTIgfCBJU2VyaWFsaXphYmxlQ2hhdERhdGEzO1xuXG4vKipcbiAqIE5vcm1hbGl6ZSBjaGF0IGRhdGEgZnJvbSBzdG9yYWdlIHRvIHRoZSBjdXJyZW50IGZvcm1hdC5cbiAqIFRPRE8tIENoYXRNb2RlbCNfZGVzZXJpYWxpemUgYW5kIHJldml2ZVNlcmlhbGl6ZWRBZ2VudCBhbHNvIHN0aWxsIGRvIHNvbWUgbm9ybWFsaXphdGlvbiBhbmQgbWF5YmUgdGhhdCBzaG91bGQgYmUgZG9uZSBpbiBoZXJlIHRvby5cbiAqL1xuZXhwb3J0IGZ1bmN0aW9uIG5vcm1hbGl6ZVNlcmlhbGl6YWJsZUNoYXREYXRhKHJhdzogSVNlcmlhbGl6YWJsZUNoYXREYXRhSW4pOiBJU2VyaWFsaXphYmxlQ2hhdERhdGEge1xuXHRub3JtYWxpemVPbGRGaWVsZHMocmF3KTtcblxuXHRpZiAoISgndmVyc2lvbicgaW4gcmF3KSkge1xuXHRcdHJldHVybiB7XG5cdFx0XHR2ZXJzaW9uOiAzLFxuXHRcdFx0Li4ucmF3LFxuXHRcdFx0bGFzdE1lc3NhZ2VEYXRlOiByYXcuY3JlYXRpb25EYXRlLFxuXHRcdFx0Y3VzdG9tVGl0bGU6IHVuZGVmaW5lZCxcblx0XHR9O1xuXHR9XG5cblx0aWYgKHJhdy52ZXJzaW9uID09PSAyKSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdC4uLnJhdyxcblx0XHRcdHZlcnNpb246IDMsXG5cdFx0XHRjdXN0b21UaXRsZTogcmF3LmNvbXB1dGVkVGl0bGVcblx0XHR9O1xuXHR9XG5cblx0cmV0dXJuIHJhdztcbn1cblxuZnVuY3Rpb24gbm9ybWFsaXplT2xkRmllbGRzKHJhdzogSVNlcmlhbGl6YWJsZUNoYXREYXRhSW4pOiB2b2lkIHtcblx0Ly8gRmlsbCBpbiBmaWVsZHMgdGhhdCB2ZXJ5IG9sZCBjaGF0IGRhdGEgbWF5IGJlIG1pc3Npbmdcblx0aWYgKCFyYXcuc2Vzc2lvbklkKSB7XG5cdFx0cmF3LnNlc3Npb25JZCA9IGdlbmVyYXRlVXVpZCgpO1xuXHR9XG5cblx0aWYgKCFyYXcuY3JlYXRpb25EYXRlKSB7XG5cdFx0cmF3LmNyZWF0aW9uRGF0ZSA9IGdldExhc3RZZWFyRGF0ZSgpO1xuXHR9XG5cblx0aWYgKCd2ZXJzaW9uJyBpbiByYXcgJiYgKHJhdy52ZXJzaW9uID09PSAyIHx8IHJhdy52ZXJzaW9uID09PSAzKSkge1xuXHRcdGlmICghcmF3Lmxhc3RNZXNzYWdlRGF0ZSkge1xuXHRcdFx0Ly8gQSBidWcgbGVkIHRvIG5vdCBwb3J0aW5nIGNyZWF0aW9uRGF0ZSBwcm9wZXJseSwgYW5kIHRoYXQgd2FzIGNvcGllZCB0byBsYXN0TWVzc2FnZURhdGUsIHNvIGZpeCB0aGF0IHVwIGlmIG1pc3NpbmcuXG5cdFx0XHRyYXcubGFzdE1lc3NhZ2VEYXRlID0gZ2V0TGFzdFllYXJEYXRlKCk7XG5cdFx0fVxuXHR9XG59XG5cbmZ1bmN0aW9uIGdldExhc3RZZWFyRGF0ZSgpOiBudW1iZXIge1xuXHRjb25zdCBsYXN0WWVhckRhdGUgPSBuZXcgRGF0ZSgpO1xuXHRsYXN0WWVhckRhdGUuc2V0RnVsbFllYXIobGFzdFllYXJEYXRlLmdldEZ1bGxZZWFyKCkgLSAxKTtcblx0cmV0dXJuIGxhc3RZZWFyRGF0ZS5nZXRUaW1lKCk7XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc0V4cG9ydGFibGVTZXNzaW9uRGF0YShvYmo6IHVua25vd24pOiBvYmogaXMgSUV4cG9ydGFibGVDaGF0RGF0YSB7XG5cdGNvbnN0IGRhdGEgPSBvYmogYXMgSUV4cG9ydGFibGVDaGF0RGF0YTtcblx0cmV0dXJuIHR5cGVvZiBkYXRhID09PSAnb2JqZWN0JyAmJlxuXHRcdHR5cGVvZiBkYXRhLnJlcXVlc3RlclVzZXJuYW1lID09PSAnc3RyaW5nJztcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGlzU2VyaWFsaXphYmxlU2Vzc2lvbkRhdGEob2JqOiB1bmtub3duKTogb2JqIGlzIElTZXJpYWxpemFibGVDaGF0RGF0YSB7XG5cdGNvbnN0IGRhdGEgPSBvYmogYXMgSVNlcmlhbGl6YWJsZUNoYXREYXRhO1xuXHRyZXR1cm4gaXNFeHBvcnRhYmxlU2Vzc2lvbkRhdGEob2JqKSAmJlxuXHRcdHR5cGVvZiBkYXRhLmNyZWF0aW9uRGF0ZSA9PT0gJ251bWJlcicgJiZcblx0XHR0eXBlb2YgZGF0YS5zZXNzaW9uSWQgPT09ICdzdHJpbmcnICYmXG5cdFx0b2JqLnJlcXVlc3RzLmV2ZXJ5KChyZXF1ZXN0OiBJU2VyaWFsaXphYmxlQ2hhdFJlcXVlc3REYXRhKSA9PlxuXHRcdFx0IXJlcXVlc3QudXNlZENvbnRleHQgLyogZm9yIGJhY2t3YXJkIGNvbXBhdCBhbGxvdyBtaXNzaW5nIHVzZWRDb250ZXh0ICovIHx8IGlzSVVzZWRDb250ZXh0KHJlcXVlc3QudXNlZENvbnRleHQpXG5cdFx0KTtcbn1cblxuZXhwb3J0IHR5cGUgSUNoYXRDaGFuZ2VFdmVudCA9XG5cdHwgSUNoYXRJbml0RXZlbnRcblx0fCBJQ2hhdEFkZFJlcXVlc3RFdmVudCB8IElDaGF0Q2hhbmdlZFJlcXVlc3RFdmVudCB8IElDaGF0UmVtb3ZlUmVxdWVzdEV2ZW50XG5cdHwgSUNoYXRBZGRSZXNwb25zZUV2ZW50XG5cdHwgSUNoYXRTZXRBZ2VudEV2ZW50XG5cdHwgSUNoYXRNb3ZlRXZlbnRcblx0fCBJQ2hhdFNldEhpZGRlbkV2ZW50XG5cdHwgSUNoYXRDb21wbGV0ZWRSZXF1ZXN0RXZlbnRcblx0O1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWRkUmVxdWVzdEV2ZW50IHtcblx0a2luZDogJ2FkZFJlcXVlc3QnO1xuXHRyZXF1ZXN0OiBJQ2hhdFJlcXVlc3RNb2RlbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENoYW5nZWRSZXF1ZXN0RXZlbnQge1xuXHRraW5kOiAnY2hhbmdlZFJlcXVlc3QnO1xuXHRyZXF1ZXN0OiBJQ2hhdFJlcXVlc3RNb2RlbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENvbXBsZXRlZFJlcXVlc3RFdmVudCB7XG5cdGtpbmQ6ICdjb21wbGV0ZWRSZXF1ZXN0Jztcblx0cmVxdWVzdDogSUNoYXRSZXF1ZXN0TW9kZWw7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRBZGRSZXNwb25zZUV2ZW50IHtcblx0a2luZDogJ2FkZFJlc3BvbnNlJztcblx0cmVzcG9uc2U6IElDaGF0UmVzcG9uc2VNb2RlbDtcbn1cblxuZXhwb3J0IGNvbnN0IGVudW0gQ2hhdFJlcXVlc3RSZW1vdmFsUmVhc29uIHtcblx0LyoqXG5cdCAqIFwiTm9ybWFsXCIgcmVtb3ZlXG5cdCAqL1xuXHRSZW1vdmFsLFxuXG5cdC8qKlxuXHQgKiBSZW1vdmVkIGJlY2F1c2UgdGhlIHJlcXVlc3Qgd2lsbCBiZSByZXNlbnRcblx0ICovXG5cdFJlc2VuZCxcblxuXHQvKipcblx0ICogUmVtb3ZlIGJlY2F1c2UgdGhlIHJlcXVlc3QgaXMgbW92aW5nIHRvIGFub3RoZXIgbW9kZWxcblx0ICovXG5cdEFkb3B0aW9uXG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZW1vdmVSZXF1ZXN0RXZlbnQge1xuXHRraW5kOiAncmVtb3ZlUmVxdWVzdCc7XG5cdHJlcXVlc3RJZDogc3RyaW5nO1xuXHRyZXNwb25zZUlkPzogc3RyaW5nO1xuXHRyZWFzb246IENoYXRSZXF1ZXN0UmVtb3ZhbFJlYXNvbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFNldEhpZGRlbkV2ZW50IHtcblx0a2luZDogJ3NldEhpZGRlbic7XG5cdGhpZGRlblJlcXVlc3RJZHM6IHJlYWRvbmx5IElDaGF0UmVxdWVzdERpc2FibGVtZW50W107XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRNb3ZlRXZlbnQge1xuXHRraW5kOiAnbW92ZSc7XG5cdHRhcmdldDogVVJJO1xuXHRyYW5nZTogSVJhbmdlO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0U2V0QWdlbnRFdmVudCB7XG5cdGtpbmQ6ICdzZXRBZ2VudCc7XG5cdGFnZW50OiBJQ2hhdEFnZW50RGF0YTtcblx0Y29tbWFuZD86IElDaGF0QWdlbnRDb21tYW5kO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0SW5pdEV2ZW50IHtcblx0a2luZDogJ2luaXRpYWxpemUnO1xufVxuXG5leHBvcnQgZW51bSBDaGF0TW9kZWxJbml0U3RhdGUge1xuXHRDcmVhdGVkLFxuXHRJbml0aWFsaXppbmcsXG5cdEluaXRpYWxpemVkXG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRNb2RlbCB7XG5cdHN0YXRpYyBnZXREZWZhdWx0VGl0bGUocmVxdWVzdHM6IChJU2VyaWFsaXphYmxlQ2hhdFJlcXVlc3REYXRhIHwgSUNoYXRSZXF1ZXN0TW9kZWwpW10pOiBzdHJpbmcge1xuXHRcdGNvbnN0IGZpcnN0UmVxdWVzdE1lc3NhZ2UgPSByZXF1ZXN0cy5hdCgwKT8ubWVzc2FnZSA/PyAnJztcblx0XHRjb25zdCBtZXNzYWdlID0gdHlwZW9mIGZpcnN0UmVxdWVzdE1lc3NhZ2UgPT09ICdzdHJpbmcnID9cblx0XHRcdGZpcnN0UmVxdWVzdE1lc3NhZ2UgOlxuXHRcdFx0Zmlyc3RSZXF1ZXN0TWVzc2FnZS50ZXh0O1xuXHRcdHJldHVybiBtZXNzYWdlLnNwbGl0KCdcXG4nKVswXS5zdWJzdHJpbmcoMCwgNTApO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREaXNwb3NlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRGlzcG9zZSA9IHRoaXMuX29uRGlkRGlzcG9zZS5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDaGF0Q2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgX3JlcXVlc3RzOiBDaGF0UmVxdWVzdE1vZGVsW107XG5cdHByaXZhdGUgX2luaXRTdGF0ZTogQ2hhdE1vZGVsSW5pdFN0YXRlID0gQ2hhdE1vZGVsSW5pdFN0YXRlLkNyZWF0ZWQ7XG5cdHByaXZhdGUgX2lzSW5pdGlhbGl6ZWREZWZlcnJlZCA9IG5ldyBEZWZlcnJlZFByb21pc2U8dm9pZD4oKTtcblxuXHRwcml2YXRlIF9zYW1wbGVRdWVzdGlvbnM6IElDaGF0Rm9sbG93dXBbXSB8IHVuZGVmaW5lZDtcblx0Z2V0IHNhbXBsZVF1ZXN0aW9ucygpOiBJQ2hhdEZvbGxvd3VwW10gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9zYW1wbGVRdWVzdGlvbnM7XG5cdH1cblxuXHQvLyBUT0RPIHRvIGJlIGNsZWFyLCB0aGlzIGlzIG5vdCB0aGUgc2FtZSBhcyB0aGUgaWQgZnJvbSB0aGUgc2Vzc2lvbiBvYmplY3QsIHdoaWNoIGJlbG9uZ3MgdG8gdGhlIHByb3ZpZGVyLlxuXHQvLyBJdCdzIGVhc2llciB0byBiZSBhYmxlIHRvIGlkZW50aWZ5IHRoaXMgbW9kZWwgYmVmb3JlIGl0cyBhc3luYyBpbml0aWFsaXphdGlvbiBpcyBjb21wbGV0ZVxuXHRwcml2YXRlIF9zZXNzaW9uSWQ6IHN0cmluZztcblx0Z2V0IHNlc3Npb25JZCgpOiBzdHJpbmcge1xuXHRcdHJldHVybiB0aGlzLl9zZXNzaW9uSWQ7XG5cdH1cblxuXHRnZXQgcmVxdWVzdEluUHJvZ3Jlc3MoKTogYm9vbGVhbiB7XG5cdFx0Y29uc3QgbGFzdFJlcXVlc3QgPSB0aGlzLmxhc3RSZXF1ZXN0O1xuXHRcdGlmICghbGFzdFJlcXVlc3Q/LnJlc3BvbnNlKSB7XG5cdFx0XHRyZXR1cm4gZmFsc2U7XG5cdFx0fVxuXG5cdFx0aWYgKGxhc3RSZXF1ZXN0LnJlc3BvbnNlLmlzUGVuZGluZ0NvbmZpcm1hdGlvbikge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblxuXHRcdHJldHVybiAhbGFzdFJlcXVlc3QucmVzcG9uc2UuaXNDb21wbGV0ZTtcblx0fVxuXG5cdGdldCByZXF1ZXN0UGF1c2liaWxpdHkoKTogQ2hhdFBhdXNlU3RhdGUge1xuXHRcdGNvbnN0IGxhc3RSZXF1ZXN0ID0gdGhpcy5sYXN0UmVxdWVzdDtcblx0XHRpZiAoIWxhc3RSZXF1ZXN0Py5yZXNwb25zZT8uYWdlbnQgfHwgbGFzdFJlcXVlc3QucmVzcG9uc2UuaXNDb21wbGV0ZSB8fCBsYXN0UmVxdWVzdC5yZXNwb25zZS5pc1BlbmRpbmdDb25maXJtYXRpb24pIHtcblx0XHRcdHJldHVybiBDaGF0UGF1c2VTdGF0ZS5Ob3RQYXVzYWJsZTtcblx0XHR9XG5cblx0XHRyZXR1cm4gbGFzdFJlcXVlc3QucmVzcG9uc2UuaXNQYXVzZWQuZ2V0KCkgPyBDaGF0UGF1c2VTdGF0ZS5QYXVzZWQgOiBDaGF0UGF1c2VTdGF0ZS5VbnBhdXNlZDtcblx0fVxuXG5cdGdldCBoYXNSZXF1ZXN0cygpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVxdWVzdHMubGVuZ3RoID4gMDtcblx0fVxuXG5cdGdldCBsYXN0UmVxdWVzdCgpOiBDaGF0UmVxdWVzdE1vZGVsIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fcmVxdWVzdHMuYXQoLTEpO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3JlYXRpb25EYXRlOiBudW1iZXI7XG5cdGdldCBjcmVhdGlvbkRhdGUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fY3JlYXRpb25EYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBfbGFzdE1lc3NhZ2VEYXRlOiBudW1iZXI7XG5cdGdldCBsYXN0TWVzc2FnZURhdGUoKTogbnVtYmVyIHtcblx0XHRyZXR1cm4gdGhpcy5fbGFzdE1lc3NhZ2VEYXRlO1xuXHR9XG5cblx0cHJpdmF0ZSBnZXQgX2RlZmF1bHRBZ2VudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5jaGF0QWdlbnRTZXJ2aWNlLmdldERlZmF1bHRBZ2VudChDaGF0QWdlbnRMb2NhdGlvbi5QYW5lbCk7XG5cdH1cblxuXHRnZXQgcmVxdWVzdGVyVXNlcm5hbWUoKTogc3RyaW5nIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdEFnZW50Py5tZXRhZGF0YS5yZXF1ZXN0ZXI/Lm5hbWUgPz9cblx0XHRcdHRoaXMuaW5pdGlhbERhdGE/LnJlcXVlc3RlclVzZXJuYW1lID8/ICcnO1xuXHR9XG5cblx0Z2V0IHJlc3BvbmRlclVzZXJuYW1lKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2RlZmF1bHRBZ2VudD8uZnVsbE5hbWUgPz9cblx0XHRcdHRoaXMuaW5pdGlhbERhdGE/LnJlc3BvbmRlclVzZXJuYW1lID8/ICcnO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5pdGlhbFJlcXVlc3RlckF2YXRhckljb25Vcmk6IFVSSSB8IHVuZGVmaW5lZDtcblx0Z2V0IHJlcXVlc3RlckF2YXRhckljb25VcmkoKTogVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdEFnZW50Py5tZXRhZGF0YS5yZXF1ZXN0ZXI/Lmljb24gPz9cblx0XHRcdHRoaXMuX2luaXRpYWxSZXF1ZXN0ZXJBdmF0YXJJY29uVXJpO1xuXHR9XG5cblx0cHJpdmF0ZSByZWFkb25seSBfaW5pdGlhbFJlc3BvbmRlckF2YXRhckljb25Vcmk6IFRoZW1lSWNvbiB8IFVSSSB8IHVuZGVmaW5lZDtcblx0Z2V0IHJlc3BvbmRlckF2YXRhckljb24oKTogVGhlbWVJY29uIHwgVVJJIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZGVmYXVsdEFnZW50Py5tZXRhZGF0YS50aGVtZUljb24gPz9cblx0XHRcdHRoaXMuX2luaXRpYWxSZXNwb25kZXJBdmF0YXJJY29uVXJpO1xuXHR9XG5cblx0Z2V0IGluaXRTdGF0ZSgpOiBDaGF0TW9kZWxJbml0U3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl9pbml0U3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIF9pc0ltcG9ydGVkID0gZmFsc2U7XG5cdGdldCBpc0ltcG9ydGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9pc0ltcG9ydGVkO1xuXHR9XG5cblx0cHJpdmF0ZSBfY3VzdG9tVGl0bGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcblx0Z2V0IGN1c3RvbVRpdGxlKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1c3RvbVRpdGxlO1xuXHR9XG5cblx0Z2V0IHRpdGxlKCk6IHN0cmluZyB7XG5cdFx0cmV0dXJuIHRoaXMuX2N1c3RvbVRpdGxlIHx8IENoYXRNb2RlbC5nZXREZWZhdWx0VGl0bGUodGhpcy5fcmVxdWVzdHMpO1xuXHR9XG5cblx0Z2V0IGluaXRpYWxMb2NhdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5faW5pdGlhbExvY2F0aW9uO1xuXHR9XG5cblx0cHJpdmF0ZSBfZWRpdGluZ1Nlc3Npb246IE9ic2VydmFibGVQcm9taXNlPElDaGF0RWRpdGluZ1Nlc3Npb24+IHwgdW5kZWZpbmVkO1xuXHRnZXQgZWRpdGluZ1Nlc3Npb25PYnMoKTogT2JzZXJ2YWJsZVByb21pc2U8SUNoYXRFZGl0aW5nU2Vzc2lvbj4gfCB1bmRlZmluZWQge1xuXHRcdHJldHVybiB0aGlzLl9lZGl0aW5nU2Vzc2lvbjtcblx0fVxuXG5cdGdldCBlZGl0aW5nU2Vzc2lvbigpOiBJQ2hhdEVkaXRpbmdTZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fZWRpdGluZ1Nlc3Npb24/LnByb21pc2VSZXN1bHQuZ2V0KCk/LmRhdGE7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGluaXRpYWxEYXRhOiBJU2VyaWFsaXphYmxlQ2hhdERhdGEgfCBJRXhwb3J0YWJsZUNoYXREYXRhIHwgdW5kZWZpbmVkLFxuXHRcdHByaXZhdGUgcmVhZG9ubHkgX2luaXRpYWxMb2NhdGlvbjogQ2hhdEFnZW50TG9jYXRpb24sXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElDaGF0RWRpdGluZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBjaGF0RWRpdGluZ1NlcnZpY2U6IElDaGF0RWRpdGluZ1NlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRjb25zdCBpc1ZhbGlkID0gaXNTZXJpYWxpemFibGVTZXNzaW9uRGF0YShpbml0aWFsRGF0YSk7XG5cdFx0aWYgKGluaXRpYWxEYXRhICYmICFpc1ZhbGlkKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgQ2hhdE1vZGVsI2NvbnN0cnVjdG9yOiBMb2FkZWQgbWFsZm9ybWVkIHNlc3Npb24gZGF0YTogJHtKU09OLnN0cmluZ2lmeShpbml0aWFsRGF0YSl9YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faXNJbXBvcnRlZCA9ICghIWluaXRpYWxEYXRhICYmICFpc1ZhbGlkKSB8fCAoaW5pdGlhbERhdGE/LmlzSW1wb3J0ZWQgPz8gZmFsc2UpO1xuXHRcdHRoaXMuX3Nlc3Npb25JZCA9IChpc1ZhbGlkICYmIGluaXRpYWxEYXRhLnNlc3Npb25JZCkgfHwgZ2VuZXJhdGVVdWlkKCk7XG5cdFx0dGhpcy5fcmVxdWVzdHMgPSBpbml0aWFsRGF0YSA/IHRoaXMuX2Rlc2VyaWFsaXplKGluaXRpYWxEYXRhKSA6IFtdO1xuXHRcdHRoaXMuX2NyZWF0aW9uRGF0ZSA9IChpc1ZhbGlkICYmIGluaXRpYWxEYXRhLmNyZWF0aW9uRGF0ZSkgfHwgRGF0ZS5ub3coKTtcblx0XHR0aGlzLl9sYXN0TWVzc2FnZURhdGUgPSAoaXNWYWxpZCAmJiBpbml0aWFsRGF0YS5sYXN0TWVzc2FnZURhdGUpIHx8IHRoaXMuX2NyZWF0aW9uRGF0ZTtcblx0XHR0aGlzLl9jdXN0b21UaXRsZSA9IGlzVmFsaWQgPyBpbml0aWFsRGF0YS5jdXN0b21UaXRsZSA6IHVuZGVmaW5lZDtcblxuXHRcdHRoaXMuX2luaXRpYWxSZXF1ZXN0ZXJBdmF0YXJJY29uVXJpID0gaW5pdGlhbERhdGE/LnJlcXVlc3RlckF2YXRhckljb25VcmkgJiYgVVJJLnJldml2ZShpbml0aWFsRGF0YS5yZXF1ZXN0ZXJBdmF0YXJJY29uVXJpKTtcblx0XHR0aGlzLl9pbml0aWFsUmVzcG9uZGVyQXZhdGFySWNvblVyaSA9IGlzVXJpQ29tcG9uZW50cyhpbml0aWFsRGF0YT8ucmVzcG9uZGVyQXZhdGFySWNvblVyaSkgPyBVUkkucmV2aXZlKGluaXRpYWxEYXRhLnJlc3BvbmRlckF2YXRhckljb25VcmkpIDogaW5pdGlhbERhdGE/LnJlc3BvbmRlckF2YXRhckljb25Vcmk7XG5cdH1cblxuXHRzdGFydEVkaXRpbmdTZXNzaW9uKGlzR2xvYmFsRWRpdGluZ1Nlc3Npb24/OiBib29sZWFuKTogdm9pZCB7XG5cdFx0Y29uc3QgZWRpdGluZ1Nlc3Npb25Qcm9taXNlID0gaXNHbG9iYWxFZGl0aW5nU2Vzc2lvbiA/XG5cdFx0XHR0aGlzLmNoYXRFZGl0aW5nU2VydmljZS5zdGFydE9yQ29udGludWVHbG9iYWxFZGl0aW5nU2Vzc2lvbih0aGlzKSA6XG5cdFx0XHR0aGlzLmNoYXRFZGl0aW5nU2VydmljZS5jcmVhdGVFZGl0aW5nU2Vzc2lvbih0aGlzKTtcblx0XHR0aGlzLl9lZGl0aW5nU2Vzc2lvbiA9IG5ldyBPYnNlcnZhYmxlUHJvbWlzZShlZGl0aW5nU2Vzc2lvblByb21pc2UpO1xuXHRcdHRoaXMuX2VkaXRpbmdTZXNzaW9uLnByb21pc2UudGhlbihlZGl0aW5nU2Vzc2lvbiA9PiB0aGlzLl9zdG9yZS5pc0Rpc3Bvc2VkID8gZWRpdGluZ1Nlc3Npb24uZGlzcG9zZSgpIDogdGhpcy5fcmVnaXN0ZXIoZWRpdGluZ1Nlc3Npb24pKTtcblx0fVxuXG5cdHByaXZhdGUgX2Rlc2VyaWFsaXplKG9iajogSUV4cG9ydGFibGVDaGF0RGF0YSk6IENoYXRSZXF1ZXN0TW9kZWxbXSB7XG5cdFx0Y29uc3QgcmVxdWVzdHMgPSBvYmoucmVxdWVzdHM7XG5cdFx0aWYgKCFBcnJheS5pc0FycmF5KHJlcXVlc3RzKSkge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBJZ25vcmluZyBtYWxmb3JtZWQgc2Vzc2lvbiBkYXRhOiAke0pTT04uc3RyaW5naWZ5KG9iail9YCk7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiByZXF1ZXN0cy5tYXAoKHJhdzogSVNlcmlhbGl6YWJsZUNoYXRSZXF1ZXN0RGF0YSkgPT4ge1xuXHRcdFx0XHRjb25zdCBwYXJzZWRSZXF1ZXN0ID1cblx0XHRcdFx0XHR0eXBlb2YgcmF3Lm1lc3NhZ2UgPT09ICdzdHJpbmcnXG5cdFx0XHRcdFx0XHQ/IHRoaXMuZ2V0UGFyc2VkUmVxdWVzdEZyb21TdHJpbmcocmF3Lm1lc3NhZ2UpXG5cdFx0XHRcdFx0XHQ6IHJldml2ZVBhcnNlZENoYXRSZXF1ZXN0KHJhdy5tZXNzYWdlKTtcblxuXHRcdFx0XHQvLyBPbGQgbWVzc2FnZXMgZG9uJ3QgaGF2ZSB2YXJpYWJsZURhdGEsIG9yIGhhdmUgaXQgaW4gdGhlIHdyb25nIChub24tYXJyYXkpIHNoYXBlXG5cdFx0XHRcdGNvbnN0IHZhcmlhYmxlRGF0YTogSUNoYXRSZXF1ZXN0VmFyaWFibGVEYXRhID0gdGhpcy5yZXZpdmVWYXJpYWJsZURhdGEocmF3LnZhcmlhYmxlRGF0YSk7XG5cdFx0XHRcdGNvbnN0IHJlcXVlc3QgPSBuZXcgQ2hhdFJlcXVlc3RNb2RlbCh0aGlzLCBwYXJzZWRSZXF1ZXN0LCB2YXJpYWJsZURhdGEsIHJhdy50aW1lc3RhbXAgPz8gLTEsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHJhdy5yZXF1ZXN0SWQpO1xuXHRcdFx0XHRyZXF1ZXN0LnNob3VsZEJlUmVtb3ZlZE9uU2VuZCA9IHJhdy5pc0hpZGRlbiA/IHsgcmVxdWVzdElkOiByYXcucmVxdWVzdElkIH0gOiByYXcuc2hvdWxkQmVSZW1vdmVkT25TZW5kO1xuXHRcdFx0XHRpZiAocmF3LnJlc3BvbnNlIHx8IHJhdy5yZXN1bHQgfHwgKHJhdyBhcyBhbnkpLnJlc3BvbnNlRXJyb3JEZXRhaWxzKSB7XG5cdFx0XHRcdFx0Y29uc3QgYWdlbnQgPSAocmF3LmFnZW50ICYmICdtZXRhZGF0YScgaW4gcmF3LmFnZW50KSA/IC8vIENoZWNrIGZvciB0aGUgbmV3IGZvcm1hdCwgaWdub3JlIGVudHJpZXMgaW4gdGhlIG9sZCBmb3JtYXRcblx0XHRcdFx0XHRcdHJldml2ZVNlcmlhbGl6ZWRBZ2VudChyYXcuYWdlbnQpIDogdW5kZWZpbmVkO1xuXG5cdFx0XHRcdFx0Ly8gUG9ydCBlbnRyaWVzIGZyb20gb2xkIGZvcm1hdFxuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9ICdyZXNwb25zZUVycm9yRGV0YWlscycgaW4gcmF3ID9cblx0XHRcdFx0XHRcdC8vIGVzbGludC1kaXNhYmxlLW5leHQtbGluZSBsb2NhbC9jb2RlLW5vLWRhbmdlcm91cy10eXBlLWFzc2VydGlvbnNcblx0XHRcdFx0XHRcdHsgZXJyb3JEZXRhaWxzOiByYXcucmVzcG9uc2VFcnJvckRldGFpbHMgfSBhcyBJQ2hhdEFnZW50UmVzdWx0IDogcmF3LnJlc3VsdDtcblx0XHRcdFx0XHRyZXF1ZXN0LnJlc3BvbnNlID0gbmV3IENoYXRSZXNwb25zZU1vZGVsKHJhdy5yZXNwb25zZSA/PyBbbmV3IE1hcmtkb3duU3RyaW5nKHJhdy5yZXNwb25zZSldLCB0aGlzLCBhZ2VudCwgcmF3LnNsYXNoQ29tbWFuZCwgcmVxdWVzdC5pZCwgdHJ1ZSwgcmF3LmlzQ2FuY2VsZWQsIHJhdy52b3RlLCByYXcudm90ZURvd25SZWFzb24sIHJlc3VsdCwgcmF3LmZvbGxvd3VwcywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHJhdy5yZXNwb25zZUlkKTtcblx0XHRcdFx0XHRyZXF1ZXN0LnJlc3BvbnNlLnNob3VsZEJlUmVtb3ZlZE9uU2VuZCA9IHJhdy5pc0hpZGRlbiA/IHsgcmVxdWVzdElkOiByYXcucmVxdWVzdElkIH0gOiByYXcuc2hvdWxkQmVSZW1vdmVkT25TZW5kO1xuXHRcdFx0XHRcdGlmIChyYXcudXNlZENvbnRleHQpIHsgLy8gQHVsdWdiZWtuYTogaWYgdGhpcydzIGEgbmV3IHZzY29kZSBzZXNzaW9ucywgZG9jIHZlcnNpb25zIGFyZSBpbmNvcnJlY3QgYW55d2F5P1xuXHRcdFx0XHRcdFx0cmVxdWVzdC5yZXNwb25zZS5hcHBseVJlZmVyZW5jZShyZXZpdmUocmF3LnVzZWRDb250ZXh0KSk7XG5cdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0cmF3LmNvbnRlbnRSZWZlcmVuY2VzPy5mb3JFYWNoKHIgPT4gcmVxdWVzdC5yZXNwb25zZSEuYXBwbHlSZWZlcmVuY2UocmV2aXZlKHIpKSk7XG5cdFx0XHRcdFx0cmF3LmNvZGVDaXRhdGlvbnM/LmZvckVhY2goYyA9PiByZXF1ZXN0LnJlc3BvbnNlIS5hcHBseUNvZGVDaXRhdGlvbihyZXZpdmUoYykpKTtcblx0XHRcdFx0fVxuXHRcdFx0XHRyZXR1cm4gcmVxdWVzdDtcblx0XHRcdH0pO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoJ0ZhaWxlZCB0byBwYXJzZSBjaGF0IGRhdGEnLCBlcnJvcik7XG5cdFx0XHRyZXR1cm4gW107XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSByZXZpdmVWYXJpYWJsZURhdGEocmF3OiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEpOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEge1xuXHRcdGNvbnN0IHZhcmlhYmxlRGF0YSA9IHJhdyAmJiBBcnJheS5pc0FycmF5KHJhdy52YXJpYWJsZXMpXG5cdFx0XHQ/IHJhdyA6XG5cdFx0XHR7IHZhcmlhYmxlczogW10gfTtcblxuXHRcdHZhcmlhYmxlRGF0YS52YXJpYWJsZXMgPSB2YXJpYWJsZURhdGEudmFyaWFibGVzLm1hcDxJQ2hhdFJlcXVlc3RWYXJpYWJsZUVudHJ5Pigodik6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnkgPT4ge1xuXHRcdFx0Ly8gT2xkIHZhcmlhYmxlcyBmb3JtYXRcblx0XHRcdGlmICh2ICYmICd2YWx1ZXMnIGluIHYgJiYgQXJyYXkuaXNBcnJheSh2LnZhbHVlcykpIHtcblx0XHRcdFx0cmV0dXJuIHtcblx0XHRcdFx0XHRpZDogdi5pZCA/PyAnJyxcblx0XHRcdFx0XHRuYW1lOiB2Lm5hbWUsXG5cdFx0XHRcdFx0dmFsdWU6IHYudmFsdWVzWzBdPy52YWx1ZSxcblx0XHRcdFx0XHRyYW5nZTogdi5yYW5nZSxcblx0XHRcdFx0XHRtb2RlbERlc2NyaXB0aW9uOiB2Lm1vZGVsRGVzY3JpcHRpb24sXG5cdFx0XHRcdFx0cmVmZXJlbmNlczogdi5yZWZlcmVuY2VzXG5cdFx0XHRcdH07XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gdjtcblx0XHRcdH1cblx0XHR9KTtcblxuXHRcdHJldHVybiB2YXJpYWJsZURhdGE7XG5cdH1cblxuXHRwcml2YXRlIGdldFBhcnNlZFJlcXVlc3RGcm9tU3RyaW5nKG1lc3NhZ2U6IHN0cmluZyk6IElQYXJzZWRDaGF0UmVxdWVzdCB7XG5cdFx0Ly8gVE9ETyBUaGVzZSBvZmZzZXRzIHdvbid0IGJlIHVzZWQsIGJ1dCBjaGF0IHJlcGxpZXMgbmVlZCB0byBnbyB0aHJvdWdoIHRoZSBwYXJzZXIgYXMgd2VsbFxuXHRcdGNvbnN0IHBhcnRzID0gW25ldyBDaGF0UmVxdWVzdFRleHRQYXJ0KG5ldyBPZmZzZXRSYW5nZSgwLCBtZXNzYWdlLmxlbmd0aCksIHsgc3RhcnRDb2x1bW46IDEsIHN0YXJ0TGluZU51bWJlcjogMSwgZW5kQ29sdW1uOiAxLCBlbmRMaW5lTnVtYmVyOiAxIH0sIG1lc3NhZ2UpXTtcblx0XHRyZXR1cm4ge1xuXHRcdFx0dGV4dDogbWVzc2FnZSxcblx0XHRcdHBhcnRzXG5cdFx0fTtcblx0fVxuXG5cdHRvZ2dsZUxhc3RSZXF1ZXN0UGF1c2VkKGlzUGF1c2VkPzogYm9vbGVhbikge1xuXHRcdGlmICh0aGlzLnJlcXVlc3RQYXVzaWJpbGl0eSAhPT0gQ2hhdFBhdXNlU3RhdGUuTm90UGF1c2FibGUgJiYgdGhpcy5sYXN0UmVxdWVzdD8ucmVzcG9uc2U/LmFnZW50KSB7XG5cdFx0XHRjb25zdCBwYXVzZWRWYWx1ZSA9IGlzUGF1c2VkID8/ICF0aGlzLmxhc3RSZXF1ZXN0LnJlc3BvbnNlLmlzUGF1c2VkLmdldCgpO1xuXHRcdFx0dGhpcy5sYXN0UmVxdWVzdC5yZXNwb25zZS5zZXRQYXVzZWQocGF1c2VkVmFsdWUpO1xuXHRcdFx0dGhpcy5jaGF0QWdlbnRTZXJ2aWNlLnNldFJlcXVlc3RQYXVzZWQodGhpcy5sYXN0UmVxdWVzdC5yZXNwb25zZS5hZ2VudC5pZCwgdGhpcy5sYXN0UmVxdWVzdC5pZCwgcGF1c2VkVmFsdWUpO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGtpbmQ6ICdjaGFuZ2VkUmVxdWVzdCcsIHJlcXVlc3Q6IHRoaXMubGFzdFJlcXVlc3QgfSk7XG5cdFx0fVxuXHR9XG5cblx0c3RhcnRJbml0aWFsaXplKCk6IHZvaWQge1xuXHRcdGlmICh0aGlzLmluaXRTdGF0ZSAhPT0gQ2hhdE1vZGVsSW5pdFN0YXRlLkNyZWF0ZWQpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgQ2hhdE1vZGVsIGlzIGluIHRoZSB3cm9uZyBzdGF0ZSBmb3Igc3RhcnRJbml0aWFsaXplOiAke0NoYXRNb2RlbEluaXRTdGF0ZVt0aGlzLmluaXRTdGF0ZV19YCk7XG5cdFx0fVxuXHRcdHRoaXMuX2luaXRTdGF0ZSA9IENoYXRNb2RlbEluaXRTdGF0ZS5Jbml0aWFsaXppbmc7XG5cdH1cblxuXHRkZWluaXRpYWxpemUoKTogdm9pZCB7XG5cdFx0dGhpcy5faW5pdFN0YXRlID0gQ2hhdE1vZGVsSW5pdFN0YXRlLkNyZWF0ZWQ7XG5cdFx0dGhpcy5faXNJbml0aWFsaXplZERlZmVycmVkID0gbmV3IERlZmVycmVkUHJvbWlzZTx2b2lkPigpO1xuXHR9XG5cblx0aW5pdGlhbGl6ZShzYW1wbGVRdWVzdGlvbnM/OiBJQ2hhdEZvbGxvd3VwW10pOiB2b2lkIHtcblx0XHRpZiAodGhpcy5pbml0U3RhdGUgIT09IENoYXRNb2RlbEluaXRTdGF0ZS5Jbml0aWFsaXppbmcpIHtcblx0XHRcdC8vIE11c3QgY2FsbCBzdGFydEluaXRpYWxpemUgYmVmb3JlIGluaXRpYWxpemUsIGFuZCBvbmx5IGNhbGwgaXQgb25jZVxuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDaGF0TW9kZWwgaXMgaW4gdGhlIHdyb25nIHN0YXRlIGZvciBpbml0aWFsaXplOiAke0NoYXRNb2RlbEluaXRTdGF0ZVt0aGlzLmluaXRTdGF0ZV19YCk7XG5cdFx0fVxuXG5cdFx0dGhpcy5faW5pdFN0YXRlID0gQ2hhdE1vZGVsSW5pdFN0YXRlLkluaXRpYWxpemVkO1xuXHRcdHRoaXMuX3NhbXBsZVF1ZXN0aW9ucyA9IHNhbXBsZVF1ZXN0aW9ucztcblxuXHRcdHRoaXMuX2lzSW5pdGlhbGl6ZWREZWZlcnJlZC5jb21wbGV0ZSgpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBraW5kOiAnaW5pdGlhbGl6ZScgfSk7XG5cdH1cblxuXHRzZXRJbml0aWFsaXphdGlvbkVycm9yKGVycm9yOiBFcnJvcik6IHZvaWQge1xuXHRcdGlmICh0aGlzLmluaXRTdGF0ZSAhPT0gQ2hhdE1vZGVsSW5pdFN0YXRlLkluaXRpYWxpemluZykge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBDaGF0TW9kZWwgaXMgaW4gdGhlIHdyb25nIHN0YXRlIGZvciBzZXRJbml0aWFsaXphdGlvbkVycm9yOiAke0NoYXRNb2RlbEluaXRTdGF0ZVt0aGlzLmluaXRTdGF0ZV19YCk7XG5cdFx0fVxuXG5cdFx0aWYgKCF0aGlzLl9pc0luaXRpYWxpemVkRGVmZXJyZWQuaXNTZXR0bGVkKSB7XG5cdFx0XHR0aGlzLl9pc0luaXRpYWxpemVkRGVmZXJyZWQuZXJyb3IoZXJyb3IpO1xuXHRcdH1cblx0fVxuXG5cdHdhaXRGb3JJbml0aWFsaXphdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5faXNJbml0aWFsaXplZERlZmVycmVkLnA7XG5cdH1cblxuXHRnZXRSZXF1ZXN0cygpOiBDaGF0UmVxdWVzdE1vZGVsW10ge1xuXHRcdHJldHVybiB0aGlzLl9yZXF1ZXN0cztcblx0fVxuXG5cdHByaXZhdGUgX2NoZWNrcG9pbnQ6IENoYXRSZXF1ZXN0TW9kZWwgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdHB1YmxpYyBnZXQgY2hlY2twb2ludCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hlY2twb2ludDtcblx0fVxuXG5cdHNldERpc2FibGVkUmVxdWVzdHMocmVxdWVzdElkczogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnRbXSkge1xuXHRcdHRoaXMuX3JlcXVlc3RzLmZvckVhY2goKHJlcXVlc3QpID0+IHtcblx0XHRcdGNvbnN0IHNob3VsZEJlUmVtb3ZlZE9uU2VuZCA9IHJlcXVlc3RJZHMuZmluZChyID0+IHIucmVxdWVzdElkID09PSByZXF1ZXN0LmlkKTtcblx0XHRcdHJlcXVlc3Quc2hvdWxkQmVSZW1vdmVkT25TZW5kID0gc2hvdWxkQmVSZW1vdmVkT25TZW5kO1xuXHRcdFx0aWYgKHJlcXVlc3QucmVzcG9uc2UpIHtcblx0XHRcdFx0cmVxdWVzdC5yZXNwb25zZS5zaG91bGRCZVJlbW92ZWRPblNlbmQgPSBzaG91bGRCZVJlbW92ZWRPblNlbmQ7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHtcblx0XHRcdGtpbmQ6ICdzZXRIaWRkZW4nLFxuXHRcdFx0aGlkZGVuUmVxdWVzdElkczogcmVxdWVzdElkcyxcblx0XHR9KTtcblx0fVxuXG5cdGFkZFJlcXVlc3QobWVzc2FnZTogSVBhcnNlZENoYXRSZXF1ZXN0LCB2YXJpYWJsZURhdGE6IElDaGF0UmVxdWVzdFZhcmlhYmxlRGF0YSwgYXR0ZW1wdDogbnVtYmVyLCBjaGF0QWdlbnQ/OiBJQ2hhdEFnZW50RGF0YSwgc2xhc2hDb21tYW5kPzogSUNoYXRBZ2VudENvbW1hbmQsIGNvbmZpcm1hdGlvbj86IHN0cmluZywgbG9jYXRpb25EYXRhPzogSUNoYXRMb2NhdGlvbkRhdGEsIGF0dGFjaG1lbnRzPzogSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeVtdLCBpc0NvbXBsZXRlQWRkZWRSZXF1ZXN0PzogYm9vbGVhbiwgbW9kZWxJZD86IHN0cmluZyk6IENoYXRSZXF1ZXN0TW9kZWwge1xuXHRcdGNvbnN0IHJlcXVlc3QgPSBuZXcgQ2hhdFJlcXVlc3RNb2RlbCh0aGlzLCBtZXNzYWdlLCB2YXJpYWJsZURhdGEsIERhdGUubm93KCksIGF0dGVtcHQsIGNvbmZpcm1hdGlvbiwgbG9jYXRpb25EYXRhLCBhdHRhY2htZW50cywgaXNDb21wbGV0ZUFkZGVkUmVxdWVzdCwgbW9kZWxJZCk7XG5cdFx0cmVxdWVzdC5yZXNwb25zZSA9IG5ldyBDaGF0UmVzcG9uc2VNb2RlbChbXSwgdGhpcywgY2hhdEFnZW50LCBzbGFzaENvbW1hbmQsIHJlcXVlc3QuaWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHVuZGVmaW5lZCwgdW5kZWZpbmVkLCB1bmRlZmluZWQsIGlzQ29tcGxldGVBZGRlZFJlcXVlc3QpO1xuXG5cdFx0dGhpcy5fcmVxdWVzdHMucHVzaChyZXF1ZXN0KTtcblx0XHR0aGlzLl9sYXN0TWVzc2FnZURhdGUgPSBEYXRlLm5vdygpO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBraW5kOiAnYWRkUmVxdWVzdCcsIHJlcXVlc3QgfSk7XG5cdFx0cmV0dXJuIHJlcXVlc3Q7XG5cdH1cblxuXHRzZXRDdXN0b21UaXRsZSh0aXRsZTogc3RyaW5nKTogdm9pZCB7XG5cdFx0dGhpcy5fY3VzdG9tVGl0bGUgPSB0aXRsZTtcblx0fVxuXG5cdHVwZGF0ZVJlcXVlc3QocmVxdWVzdDogQ2hhdFJlcXVlc3RNb2RlbCwgdmFyaWFibGVEYXRhOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEpIHtcblx0XHRyZXF1ZXN0LnZhcmlhYmxlRGF0YSA9IHZhcmlhYmxlRGF0YTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsga2luZDogJ2NoYW5nZWRSZXF1ZXN0JywgcmVxdWVzdCB9KTtcblx0fVxuXG5cdGFkb3B0UmVxdWVzdChyZXF1ZXN0OiBDaGF0UmVxdWVzdE1vZGVsKTogdm9pZCB7XG5cdFx0Ly8gdGhpcyBkb2Vzbid0IHVzZSBgcmVtb3ZlUmVxdWVzdGAgYmVjYXVzZSBpdCBtdXN0IG5vdCBkaXNwb3NlIHRoZSByZXF1ZXN0IG9iamVjdFxuXHRcdGNvbnN0IG9sZE93bmVyID0gcmVxdWVzdC5zZXNzaW9uO1xuXHRcdGNvbnN0IGluZGV4ID0gb2xkT3duZXIuX3JlcXVlc3RzLmZpbmRJbmRleChjYW5kaWRhdGUgPT4gY2FuZGlkYXRlLmlkID09PSByZXF1ZXN0LmlkKTtcblxuXHRcdGlmIChpbmRleCA9PT0gLTEpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRvbGRPd25lci5fcmVxdWVzdHMuc3BsaWNlKGluZGV4LCAxKTtcblxuXHRcdHJlcXVlc3QuYWRvcHRUbyh0aGlzKTtcblx0XHRyZXF1ZXN0LnJlc3BvbnNlPy5hZG9wdFRvKHRoaXMpO1xuXHRcdHRoaXMuX3JlcXVlc3RzLnB1c2gocmVxdWVzdCk7XG5cblx0XHRvbGRPd25lci5fb25EaWRDaGFuZ2UuZmlyZSh7IGtpbmQ6ICdyZW1vdmVSZXF1ZXN0JywgcmVxdWVzdElkOiByZXF1ZXN0LmlkLCByZXNwb25zZUlkOiByZXF1ZXN0LnJlc3BvbnNlPy5pZCwgcmVhc29uOiBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24uQWRvcHRpb24gfSk7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGtpbmQ6ICdhZGRSZXF1ZXN0JywgcmVxdWVzdCB9KTtcblx0fVxuXG5cdGFjY2VwdFJlc3BvbnNlUHJvZ3Jlc3MocmVxdWVzdDogQ2hhdFJlcXVlc3RNb2RlbCwgcHJvZ3Jlc3M6IElDaGF0UHJvZ3Jlc3MsIHF1aWV0PzogYm9vbGVhbik6IHZvaWQge1xuXHRcdGlmICghcmVxdWVzdC5yZXNwb25zZSkge1xuXHRcdFx0cmVxdWVzdC5yZXNwb25zZSA9IG5ldyBDaGF0UmVzcG9uc2VNb2RlbChbXSwgdGhpcywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHJlcXVlc3QuaWQpO1xuXHRcdH1cblxuXHRcdGlmIChyZXF1ZXN0LnJlc3BvbnNlLmlzQ29tcGxldGUpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignYWNjZXB0UmVzcG9uc2VQcm9ncmVzczogQWRkaW5nIHByb2dyZXNzIHRvIGEgY29tcGxldGVkIHJlc3BvbnNlJyk7XG5cdFx0fVxuXG5cdFx0aWYgKHByb2dyZXNzLmtpbmQgPT09ICdtYXJrZG93bkNvbnRlbnQnIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAndHJlZURhdGEnIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAnaW5saW5lUmVmZXJlbmNlJyB8fFxuXHRcdFx0cHJvZ3Jlc3Mua2luZCA9PT0gJ2NvZGVibG9ja1VyaScgfHxcblx0XHRcdHByb2dyZXNzLmtpbmQgPT09ICdtYXJrZG93blZ1bG4nIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAncHJvZ3Jlc3NNZXNzYWdlJyB8fFxuXHRcdFx0cHJvZ3Jlc3Mua2luZCA9PT0gJ2NvbW1hbmQnIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAndGV4dEVkaXQnIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAnbm90ZWJvb2tFZGl0JyB8fFxuXHRcdFx0cHJvZ3Jlc3Mua2luZCA9PT0gJ3dhcm5pbmcnIHx8XG5cdFx0XHRwcm9ncmVzcy5raW5kID09PSAncHJvZ3Jlc3NUYXNrJyB8fFxuXHRcdFx0cHJvZ3Jlc3Mua2luZCA9PT0gJ2NvbmZpcm1hdGlvbicgfHxcblx0XHRcdHByb2dyZXNzLmtpbmQgPT09ICd0b29sSW52b2NhdGlvbidcblx0XHQpIHtcblx0XHRcdHJlcXVlc3QucmVzcG9uc2UudXBkYXRlQ29udGVudChwcm9ncmVzcywgcXVpZXQpO1xuXHRcdH0gZWxzZSBpZiAocHJvZ3Jlc3Mua2luZCA9PT0gJ3VzZWRDb250ZXh0JyB8fCBwcm9ncmVzcy5raW5kID09PSAncmVmZXJlbmNlJykge1xuXHRcdFx0cmVxdWVzdC5yZXNwb25zZS5hcHBseVJlZmVyZW5jZShwcm9ncmVzcyk7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy5raW5kID09PSAnY29kZUNpdGF0aW9uJykge1xuXHRcdFx0cmVxdWVzdC5yZXNwb25zZS5hcHBseUNvZGVDaXRhdGlvbihwcm9ncmVzcyk7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy5raW5kID09PSAnbW92ZScpIHtcblx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBraW5kOiAnbW92ZScsIHRhcmdldDogcHJvZ3Jlc3MudXJpLCByYW5nZTogcHJvZ3Jlc3MucmFuZ2UgfSk7XG5cdFx0fSBlbHNlIGlmIChwcm9ncmVzcy5raW5kID09PSAndW5kb1N0b3AnKSB7XG5cdFx0XHRyZXF1ZXN0LnJlc3BvbnNlLmFkZFVuZG9TdG9wKHByb2dyZXNzKTtcblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBDb3VsZG4ndCBoYW5kbGUgcHJvZ3Jlc3M6ICR7SlNPTi5zdHJpbmdpZnkocHJvZ3Jlc3MpfWApO1xuXHRcdH1cblx0fVxuXG5cdHJlbW92ZVJlcXVlc3QoaWQ6IHN0cmluZywgcmVhc29uOiBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24gPSBDaGF0UmVxdWVzdFJlbW92YWxSZWFzb24uUmVtb3ZhbCk6IHZvaWQge1xuXHRcdGNvbnN0IGluZGV4ID0gdGhpcy5fcmVxdWVzdHMuZmluZEluZGV4KHJlcXVlc3QgPT4gcmVxdWVzdC5pZCA9PT0gaWQpO1xuXHRcdGNvbnN0IHJlcXVlc3QgPSB0aGlzLl9yZXF1ZXN0c1tpbmRleF07XG5cblx0XHRpZiAoaW5kZXggIT09IC0xKSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsga2luZDogJ3JlbW92ZVJlcXVlc3QnLCByZXF1ZXN0SWQ6IHJlcXVlc3QuaWQsIHJlc3BvbnNlSWQ6IHJlcXVlc3QucmVzcG9uc2U/LmlkLCByZWFzb24gfSk7XG5cdFx0XHR0aGlzLl9yZXF1ZXN0cy5zcGxpY2UoaW5kZXgsIDEpO1xuXHRcdFx0cmVxdWVzdC5yZXNwb25zZT8uZGlzcG9zZSgpO1xuXHRcdH1cblx0fVxuXG5cdGNhbmNlbFJlcXVlc3QocmVxdWVzdDogQ2hhdFJlcXVlc3RNb2RlbCk6IHZvaWQge1xuXHRcdGlmIChyZXF1ZXN0LnJlc3BvbnNlKSB7XG5cdFx0XHRyZXF1ZXN0LnJlc3BvbnNlLmNhbmNlbCgpO1xuXHRcdH1cblx0fVxuXG5cdHNldFJlc3BvbnNlKHJlcXVlc3Q6IENoYXRSZXF1ZXN0TW9kZWwsIHJlc3VsdDogSUNoYXRBZ2VudFJlc3VsdCk6IHZvaWQge1xuXHRcdGlmICghcmVxdWVzdC5yZXNwb25zZSkge1xuXHRcdFx0cmVxdWVzdC5yZXNwb25zZSA9IG5ldyBDaGF0UmVzcG9uc2VNb2RlbChbXSwgdGhpcywgdW5kZWZpbmVkLCB1bmRlZmluZWQsIHJlcXVlc3QuaWQpO1xuXHRcdH1cblxuXHRcdHJlcXVlc3QucmVzcG9uc2Uuc2V0UmVzdWx0KHJlc3VsdCk7XG5cdH1cblxuXHRjb21wbGV0ZVJlc3BvbnNlKHJlcXVlc3Q6IENoYXRSZXF1ZXN0TW9kZWwpOiB2b2lkIHtcblx0XHRpZiAoIXJlcXVlc3QucmVzcG9uc2UpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcignQ2FsbCBzZXRSZXNwb25zZSBiZWZvcmUgY29tcGxldGVSZXNwb25zZScpO1xuXHRcdH1cblxuXHRcdHJlcXVlc3QucmVzcG9uc2UuY29tcGxldGUoKTtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsga2luZDogJ2NvbXBsZXRlZFJlcXVlc3QnLCByZXF1ZXN0IH0pO1xuXHR9XG5cblx0c2V0Rm9sbG93dXBzKHJlcXVlc3Q6IENoYXRSZXF1ZXN0TW9kZWwsIGZvbGxvd3VwczogSUNoYXRGb2xsb3d1cFtdIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0aWYgKCFyZXF1ZXN0LnJlc3BvbnNlKSB7XG5cdFx0XHQvLyBNYXliZSBzb21ldGhpbmcgd2VudCB3cm9uZz9cblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRyZXF1ZXN0LnJlc3BvbnNlLnNldEZvbGxvd3Vwcyhmb2xsb3d1cHMpO1xuXHR9XG5cblx0c2V0UmVzcG9uc2VNb2RlbChyZXF1ZXN0OiBDaGF0UmVxdWVzdE1vZGVsLCByZXNwb25zZTogQ2hhdFJlc3BvbnNlTW9kZWwpOiB2b2lkIHtcblx0XHRyZXF1ZXN0LnJlc3BvbnNlID0gcmVzcG9uc2U7XG5cdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSh7IGtpbmQ6ICdhZGRSZXNwb25zZScsIHJlc3BvbnNlIH0pO1xuXHR9XG5cblx0dG9FeHBvcnQoKTogSUV4cG9ydGFibGVDaGF0RGF0YSB7XG5cdFx0cmV0dXJuIHtcblx0XHRcdHJlcXVlc3RlclVzZXJuYW1lOiB0aGlzLnJlcXVlc3RlclVzZXJuYW1lLFxuXHRcdFx0cmVxdWVzdGVyQXZhdGFySWNvblVyaTogdGhpcy5yZXF1ZXN0ZXJBdmF0YXJJY29uVXJpLFxuXHRcdFx0cmVzcG9uZGVyVXNlcm5hbWU6IHRoaXMucmVzcG9uZGVyVXNlcm5hbWUsXG5cdFx0XHRyZXNwb25kZXJBdmF0YXJJY29uVXJpOiB0aGlzLnJlc3BvbmRlckF2YXRhckljb24sXG5cdFx0XHRpbml0aWFsTG9jYXRpb246IHRoaXMuaW5pdGlhbExvY2F0aW9uLFxuXHRcdFx0cmVxdWVzdHM6IHRoaXMuX3JlcXVlc3RzLm1hcCgocik6IElTZXJpYWxpemFibGVDaGF0UmVxdWVzdERhdGEgPT4ge1xuXHRcdFx0XHRjb25zdCBtZXNzYWdlID0ge1xuXHRcdFx0XHRcdC4uLnIubWVzc2FnZSxcblx0XHRcdFx0XHRwYXJ0czogci5tZXNzYWdlLnBhcnRzLm1hcChwID0+IHAgJiYgJ3RvSlNPTicgaW4gcCA/IChwLnRvSlNPTiBhcyBGdW5jdGlvbikoKSA6IHApXG5cdFx0XHRcdH07XG5cdFx0XHRcdGNvbnN0IGFnZW50ID0gci5yZXNwb25zZT8uYWdlbnQ7XG5cdFx0XHRcdGNvbnN0IGFnZW50SnNvbiA9IGFnZW50ICYmICd0b0pTT04nIGluIGFnZW50ID8gKGFnZW50LnRvSlNPTiBhcyBGdW5jdGlvbikoKSA6XG5cdFx0XHRcdFx0YWdlbnQgPyB7IC4uLmFnZW50IH0gOiB1bmRlZmluZWQ7XG5cdFx0XHRcdHJldHVybiB7XG5cdFx0XHRcdFx0cmVxdWVzdElkOiByLmlkLFxuXHRcdFx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRcdFx0dmFyaWFibGVEYXRhOiByLnZhcmlhYmxlRGF0YSxcblx0XHRcdFx0XHRyZXNwb25zZTogci5yZXNwb25zZSA/XG5cdFx0XHRcdFx0XHRyLnJlc3BvbnNlLmVudGlyZVJlc3BvbnNlLnZhbHVlLm1hcChpdGVtID0+IHtcblx0XHRcdFx0XHRcdFx0Ly8gS2VlcGluZyB0aGUgc2hhcGUgb2YgdGhlIHBlcnNpc3RlZCBkYXRhIHRoZSBzYW1lIGZvciBiYWNrIGNvbXBhdFxuXHRcdFx0XHRcdFx0XHRpZiAoaXRlbS5raW5kID09PSAndHJlZURhdGEnKSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0udHJlZURhdGE7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSBpZiAoaXRlbS5raW5kID09PSAnbWFya2Rvd25Db250ZW50Jykge1xuXHRcdFx0XHRcdFx0XHRcdHJldHVybiBpdGVtLmNvbnRlbnQ7XG5cdFx0XHRcdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0XHRcdFx0cmV0dXJuIGl0ZW0gYXMgYW55OyAvLyBUT0RPXG5cdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdH0pXG5cdFx0XHRcdFx0XHQ6IHVuZGVmaW5lZCxcblx0XHRcdFx0XHRyZXNwb25zZUlkOiByLnJlc3BvbnNlPy5pZCxcblx0XHRcdFx0XHRzaG91bGRCZVJlbW92ZWRPblNlbmQ6IHIuc2hvdWxkQmVSZW1vdmVkT25TZW5kLFxuXHRcdFx0XHRcdHJlc3VsdDogci5yZXNwb25zZT8ucmVzdWx0LFxuXHRcdFx0XHRcdGZvbGxvd3Vwczogci5yZXNwb25zZT8uZm9sbG93dXBzLFxuXHRcdFx0XHRcdGlzQ2FuY2VsZWQ6IHIucmVzcG9uc2U/LmlzQ2FuY2VsZWQsXG5cdFx0XHRcdFx0dm90ZTogci5yZXNwb25zZT8udm90ZSxcblx0XHRcdFx0XHR2b3RlRG93blJlYXNvbjogci5yZXNwb25zZT8udm90ZURvd25SZWFzb24sXG5cdFx0XHRcdFx0YWdlbnQ6IGFnZW50SnNvbixcblx0XHRcdFx0XHRzbGFzaENvbW1hbmQ6IHIucmVzcG9uc2U/LnNsYXNoQ29tbWFuZCxcblx0XHRcdFx0XHR1c2VkQ29udGV4dDogci5yZXNwb25zZT8udXNlZENvbnRleHQsXG5cdFx0XHRcdFx0Y29udGVudFJlZmVyZW5jZXM6IHIucmVzcG9uc2U/LmNvbnRlbnRSZWZlcmVuY2VzLFxuXHRcdFx0XHRcdGNvZGVDaXRhdGlvbnM6IHIucmVzcG9uc2U/LmNvZGVDaXRhdGlvbnMsXG5cdFx0XHRcdFx0dGltZXN0YW1wOiByLnRpbWVzdGFtcFxuXHRcdFx0XHR9O1xuXHRcdFx0fSksXG5cdFx0fTtcblx0fVxuXG5cdHRvSlNPTigpOiBJU2VyaWFsaXphYmxlQ2hhdERhdGEge1xuXHRcdHJldHVybiB7XG5cdFx0XHR2ZXJzaW9uOiAzLFxuXHRcdFx0Li4udGhpcy50b0V4cG9ydCgpLFxuXHRcdFx0c2Vzc2lvbklkOiB0aGlzLnNlc3Npb25JZCxcblx0XHRcdGNyZWF0aW9uRGF0ZTogdGhpcy5fY3JlYXRpb25EYXRlLFxuXHRcdFx0aXNJbXBvcnRlZDogdGhpcy5faXNJbXBvcnRlZCxcblx0XHRcdGxhc3RNZXNzYWdlRGF0ZTogdGhpcy5fbGFzdE1lc3NhZ2VEYXRlLFxuXHRcdFx0Y3VzdG9tVGl0bGU6IHRoaXMuX2N1c3RvbVRpdGxlXG5cdFx0fTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0dGhpcy5fcmVxdWVzdHMuZm9yRWFjaChyID0+IHIucmVzcG9uc2U/LmRpc3Bvc2UoKSk7XG5cdFx0dGhpcy5fb25EaWREaXNwb3NlLmZpcmUoKTtcblxuXHRcdHN1cGVyLmRpc3Bvc2UoKTtcblx0fVxufVxuXG5leHBvcnQgZnVuY3Rpb24gdXBkYXRlUmFuZ2VzKHZhcmlhYmxlRGF0YTogSUNoYXRSZXF1ZXN0VmFyaWFibGVEYXRhLCBkaWZmOiBudW1iZXIpOiBJQ2hhdFJlcXVlc3RWYXJpYWJsZURhdGEge1xuXHRyZXR1cm4ge1xuXHRcdHZhcmlhYmxlczogdmFyaWFibGVEYXRhLnZhcmlhYmxlcy5tYXAodiA9PiAoe1xuXHRcdFx0Li4udixcblx0XHRcdHJhbmdlOiB2LnJhbmdlICYmIHtcblx0XHRcdFx0c3RhcnQ6IHYucmFuZ2Uuc3RhcnQgLSBkaWZmLFxuXHRcdFx0XHRlbmRFeGNsdXNpdmU6IHYucmFuZ2UuZW5kRXhjbHVzaXZlIC0gZGlmZlxuXHRcdFx0fVxuXHRcdH0pKVxuXHR9O1xufVxuXG5leHBvcnQgZnVuY3Rpb24gY2FuTWVyZ2VNYXJrZG93blN0cmluZ3MobWQxOiBJTWFya2Rvd25TdHJpbmcsIG1kMjogSU1hcmtkb3duU3RyaW5nKTogYm9vbGVhbiB7XG5cdGlmIChtZDEuYmFzZVVyaSAmJiBtZDIuYmFzZVVyaSkge1xuXHRcdGNvbnN0IGJhc2VVcmlFcXVhbHMgPSBtZDEuYmFzZVVyaS5zY2hlbWUgPT09IG1kMi5iYXNlVXJpLnNjaGVtZVxuXHRcdFx0JiYgbWQxLmJhc2VVcmkuYXV0aG9yaXR5ID09PSBtZDIuYmFzZVVyaS5hdXRob3JpdHlcblx0XHRcdCYmIG1kMS5iYXNlVXJpLnBhdGggPT09IG1kMi5iYXNlVXJpLnBhdGhcblx0XHRcdCYmIG1kMS5iYXNlVXJpLnF1ZXJ5ID09PSBtZDIuYmFzZVVyaS5xdWVyeVxuXHRcdFx0JiYgbWQxLmJhc2VVcmkuZnJhZ21lbnQgPT09IG1kMi5iYXNlVXJpLmZyYWdtZW50O1xuXHRcdGlmICghYmFzZVVyaUVxdWFscykge1xuXHRcdFx0cmV0dXJuIGZhbHNlO1xuXHRcdH1cblx0fSBlbHNlIGlmIChtZDEuYmFzZVVyaSB8fCBtZDIuYmFzZVVyaSkge1xuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHJldHVybiBlcXVhbHMobWQxLmlzVHJ1c3RlZCwgbWQyLmlzVHJ1c3RlZCkgJiZcblx0XHRtZDEuc3VwcG9ydEh0bWwgPT09IG1kMi5zdXBwb3J0SHRtbCAmJlxuXHRcdG1kMS5zdXBwb3J0VGhlbWVJY29ucyA9PT0gbWQyLnN1cHBvcnRUaGVtZUljb25zO1xufVxuXG5leHBvcnQgZnVuY3Rpb24gYXBwZW5kTWFya2Rvd25TdHJpbmcobWQxOiBJTWFya2Rvd25TdHJpbmcsIG1kMjogSU1hcmtkb3duU3RyaW5nIHwgc3RyaW5nKTogSU1hcmtkb3duU3RyaW5nIHtcblx0Y29uc3QgYXBwZW5kZWRWYWx1ZSA9IHR5cGVvZiBtZDIgPT09ICdzdHJpbmcnID8gbWQyIDogbWQyLnZhbHVlO1xuXHRyZXR1cm4ge1xuXHRcdHZhbHVlOiBtZDEudmFsdWUgKyBhcHBlbmRlZFZhbHVlLFxuXHRcdGlzVHJ1c3RlZDogbWQxLmlzVHJ1c3RlZCxcblx0XHRzdXBwb3J0VGhlbWVJY29uczogbWQxLnN1cHBvcnRUaGVtZUljb25zLFxuXHRcdHN1cHBvcnRIdG1sOiBtZDEuc3VwcG9ydEh0bWwsXG5cdFx0YmFzZVVyaTogbWQxLmJhc2VVcmlcblx0fTtcbn1cblxuZXhwb3J0IGZ1bmN0aW9uIGdldENvZGVDaXRhdGlvbnNNZXNzYWdlKGNpdGF0aW9uczogUmVhZG9ubHlBcnJheTxJQ2hhdENvZGVDaXRhdGlvbj4pOiBzdHJpbmcge1xuXHRpZiAoY2l0YXRpb25zLmxlbmd0aCA9PT0gMCkge1xuXHRcdHJldHVybiAnJztcblx0fVxuXG5cdGNvbnN0IGxpY2Vuc2VUeXBlcyA9IGNpdGF0aW9ucy5yZWR1Y2UoKHNldCwgYykgPT4gc2V0LmFkZChjLmxpY2Vuc2UpLCBuZXcgU2V0PHN0cmluZz4oKSk7XG5cdGNvbnN0IGxhYmVsID0gbGljZW5zZVR5cGVzLnNpemUgPT09IDEgP1xuXHRcdGxvY2FsaXplKCdjb2RlQ2l0YXRpb24nLCBcIlNpbWlsYXIgY29kZSBmb3VuZCB3aXRoIDEgbGljZW5zZSB0eXBlXCIsIGxpY2Vuc2VUeXBlcy5zaXplKSA6XG5cdFx0bG9jYWxpemUoJ2NvZGVDaXRhdGlvbnMnLCBcIlNpbWlsYXIgY29kZSBmb3VuZCB3aXRoIHswfSBsaWNlbnNlIHR5cGVzXCIsIGxpY2Vuc2VUeXBlcy5zaXplKTtcblx0cmV0dXJuIGxhYmVsO1xufVxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxTQUFTLGVBQWU7QUFDeEIsU0FBUyx1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QUFBLEVBQ0QsV0FBVyxJQUFJLFdBQVcsSUFBSSxTQUFTO0FBQ3RDLFdBQU87QUFBQSxFQUNSO0FBRUEsU0FBTyxPQUFPLElBQUksV0FBVyxJQUFJLFNBQVMsS0FDekMsSUFBSSxnQkFBZ0IsSUFBSSxlQUN4QixJQUFJLHNCQUFzQixJQUFJO0FBQ2hDO0FBRU8sU0FBUyxxQkFBcUIsS0FBc0IsS0FBZ0Q7QUFDMUcsUUFBTSxnQkFBZ0IsT0FBTyxRQUFRLFdBQVcsTUFBTSxJQUFJO0FBQzFELFNBQU87QUFBQSxJQUNOLE9BQU8sSUFBSSxRQUFRO0FBQUEsSUFDbkIsV0FBVyxJQUFJO0FBQUEsSUFDZixtQkFBbUIsSUFBSTtBQUFBLElBQ3ZCLGFBQWEsSUFBSTtBQUFBLElBQ2pCLFNBQVMsSUFBSTtBQUFBLEVBQ2Q7QUFDRDtBQUVPLFNBQVMsd0JBQXdCLFdBQXFEO0FBQzVGLE1BQUksVUFBVSxXQUFXLEdBQUc7QUFDM0IsV0FBTztBQUFBLEVBQ1I7QUFFQSxRQUFNLGVBQWUsVUFBVSxPQUFPLENBQUMsS0FBSyxNQUFNLElBQUksSUFBSSxFQUFFLE9BQU8sR0FBRyxvQkFBSSxJQUFZLENBQUM7QUFDdkYsUUFBTSxRQUFRLGFBQWEsU0FBUyxJQUNuQyxTQUFTLGdCQUFnQiwwQ0FBMEMsYUFBYSxJQUFJLElBQ3BGLFNBQVMsaUJBQWlCLDZDQUE2QyxhQUFhLElBQUk7QUFDekYsU0FBTztBQUNSOyIsCiAgIm5hbWVzIjogWyJJRGlhZ25vc3RpY1ZhcmlhYmxlRW50cnlGaWx0ZXJEYXRhIiwgIlRyaW1UaHJlc2hvbGQiLCAiQ2hhdFBhdXNlU3RhdGUiLCAiQ2hhdFJlcXVlc3RSZW1vdmFsUmVhc29uIiwgIkNoYXRNb2RlbEluaXRTdGF0ZSIsICJyZXF1ZXN0Il0KfQo=
