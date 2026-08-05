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
import { Emitter } from "../../../../base/common/event.js";
import { hash } from "../../../../base/common/hash.js";
import { Disposable, dispose } from "../../../../base/common/lifecycle.js";
import * as marked from "../../../../base/common/marked/marked.js";
import { IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { annotateVulnerabilitiesInText } from "./annotations.js";
import { getFullyQualifiedId, IChatAgentNameService } from "./chatAgents.js";
import { ChatModelInitState } from "./chatModel.js";
import { countWords } from "./chatWordCounter.js";
function isRequestVM(item) {
  return !!item && typeof item === "object" && "message" in item;
}
function isResponseVM(item) {
  return !!item && typeof item.setVote !== "undefined";
}
let ChatViewModel = class extends Disposable {
  constructor(_model, codeBlockModelCollection, instantiationService) {
    super();
    this._model = _model;
    this.codeBlockModelCollection = codeBlockModelCollection;
    this.instantiationService = instantiationService;
    this._onDidDisposeModel = this._register(new Emitter());
    this.onDidDisposeModel = this._onDidDisposeModel.event;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this._items = [];
    this._inputPlaceholder = void 0;
    _model.getRequests().forEach((request, i) => {
      const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, request);
      this._items.push(requestModel);
      this.updateCodeBlockTextModels(requestModel);
      if (request.response) {
        this.onAddResponse(request.response);
      }
    });
    this._register(_model.onDidDispose(() => this._onDidDisposeModel.fire()));
    this._register(_model.onDidChange((e) => {
      if (e.kind === "addRequest") {
        const requestModel = this.instantiationService.createInstance(ChatRequestViewModel, e.request);
        this._items.push(requestModel);
        this.updateCodeBlockTextModels(requestModel);
        if (e.request.response) {
          this.onAddResponse(e.request.response);
        }
      } else if (e.kind === "addResponse") {
        this.onAddResponse(e.response);
      } else if (e.kind === "removeRequest") {
        const requestIdx = this._items.findIndex((item) => isRequestVM(item) && item.id === e.requestId);
        if (requestIdx >= 0) {
          this._items.splice(requestIdx, 1);
        }
        const responseIdx = e.responseId && this._items.findIndex((item) => isResponseVM(item) && item.id === e.responseId);
        if (typeof responseIdx === "number" && responseIdx >= 0) {
          const items = this._items.splice(responseIdx, 1);
          const item = items[0];
          if (item instanceof ChatResponseViewModel) {
            item.dispose();
          }
        }
      }
      const modelEventToVmEvent = e.kind === "addRequest" ? { kind: "addRequest" } : e.kind === "initialize" ? { kind: "initialize" } : e.kind === "setHidden" ? { kind: "setHidden" } : null;
      this._onDidChange.fire(modelEventToVmEvent);
    }));
  }
  get inputPlaceholder() {
    return this._inputPlaceholder;
  }
  get model() {
    return this._model;
  }
  setInputPlaceholder(text) {
    this._inputPlaceholder = text;
    this._onDidChange.fire({ kind: "changePlaceholder" });
  }
  resetInputPlaceholder() {
    this._inputPlaceholder = void 0;
    this._onDidChange.fire({ kind: "changePlaceholder" });
  }
  get sessionId() {
    return this._model.sessionId;
  }
  get requestInProgress() {
    return this._model.requestInProgress;
  }
  get requestPausibility() {
    return this._model.requestPausibility;
  }
  get initState() {
    return this._model.initState;
  }
  onAddResponse(responseModel) {
    const response = this.instantiationService.createInstance(ChatResponseViewModel, responseModel, this);
    this._register(response.onDidChange(() => {
      if (response.isComplete) {
        this.updateCodeBlockTextModels(response);
      }
      return this._onDidChange.fire(null);
    }));
    this._items.push(response);
    this.updateCodeBlockTextModels(response);
  }
  getItems() {
    return this._items.filter((item) => !item.shouldBeRemovedOnSend || item.shouldBeRemovedOnSend.afterUndoStop);
  }
  dispose() {
    super.dispose();
    dispose(this._items.filter((item) => item instanceof ChatResponseViewModel));
  }
  updateCodeBlockTextModels(model) {
    let content;
    if (isRequestVM(model)) {
      content = model.messageText;
    } else {
      content = annotateVulnerabilitiesInText(model.response.value).map((x) => x.content.value).join("");
    }
    let codeBlockIndex = 0;
    marked.walkTokens(marked.lexer(content), (token) => {
      if (token.type === "code") {
        const lang = token.lang || "";
        const text = token.text;
        this.codeBlockModelCollection.update(this._model.sessionId, model, codeBlockIndex++, { text, languageId: lang, isComplete: true });
      }
    });
  }
};
ChatViewModel = __decorateClass([
  __decorateParam(2, IInstantiationService)
], ChatViewModel);
class ChatRequestViewModel {
  constructor(_model) {
    this._model = _model;
  }
  get id() {
    return this._model.id;
  }
  get dataId() {
    return this.id + `_${ChatModelInitState[this._model.session.initState]}_${hash(this.variables)}_${hash(this.isComplete)}`;
  }
  get sessionId() {
    return this._model.session.sessionId;
  }
  get username() {
    return this._model.username;
  }
  get avatarIcon() {
    return this._model.avatarIconUri;
  }
  get message() {
    return this._model.message;
  }
  get messageText() {
    return this.message.text;
  }
  get attempt() {
    return this._model.attempt;
  }
  get variables() {
    return this._model.variableData.variables;
  }
  get contentReferences() {
    return this._model.response?.contentReferences;
  }
  get confirmation() {
    return this._model.confirmation;
  }
  get isComplete() {
    return this._model.response?.isComplete ?? false;
  }
  get isCompleteAddedRequest() {
    return this._model.isCompleteAddedRequest;
  }
  get shouldBeRemovedOnSend() {
    return this._model.shouldBeRemovedOnSend;
  }
  get slashCommand() {
    return this._model.response?.slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._model.response?.agentOrSlashCommandDetected ?? false;
  }
}
let ChatResponseViewModel = class extends Disposable {
  constructor(_model, _chatViewModel, logService, chatAgentNameService) {
    super();
    this._model = _model;
    this._chatViewModel = _chatViewModel;
    this.logService = logService;
    this.chatAgentNameService = chatAgentNameService;
    this._modelChangeCount = 0;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.renderData = void 0;
    this._vulnerabilitiesListExpanded = false;
    this._contentUpdateTimings = void 0;
    if (!_model.isComplete) {
      this._contentUpdateTimings = {
        totalTime: 0,
        lastUpdateTime: Date.now(),
        impliedWordLoadRate: 0,
        lastWordCount: 0
      };
    }
    this._register(_model.onDidChange(() => {
      if (this._contentUpdateTimings) {
        const now = Date.now();
        const wordCount = countWords(_model.entireResponse.getMarkdown());
        if (wordCount === this._contentUpdateTimings.lastWordCount) {
          this.trace("onDidChange", `Update- no new words`);
        } else {
          if (this._contentUpdateTimings.lastWordCount === 0) {
            this._contentUpdateTimings.lastUpdateTime = now;
          }
          const timeDiff = Math.min(now - this._contentUpdateTimings.lastUpdateTime, 1e3);
          const newTotalTime = Math.max(this._contentUpdateTimings.totalTime + timeDiff, 250);
          const impliedWordLoadRate = wordCount / (newTotalTime / 1e3);
          this.trace("onDidChange", `Update- got ${wordCount} words over last ${newTotalTime}ms = ${impliedWordLoadRate} words/s`);
          this._contentUpdateTimings = {
            totalTime: this._contentUpdateTimings.totalTime !== 0 || this.response.value.some((v) => v.kind === "markdownContent") ? newTotalTime : this._contentUpdateTimings.totalTime,
            lastUpdateTime: now,
            impliedWordLoadRate,
            lastWordCount: wordCount
          };
        }
      }
      this._modelChangeCount++;
      this._onDidChange.fire();
    }));
  }
  get model() {
    return this._model;
  }
  get id() {
    return this._model.id;
  }
  get dataId() {
    return this._model.id + `_${this._modelChangeCount}_${ChatModelInitState[this._model.session.initState]}` + (this.isLast ? "_last" : "");
  }
  get sessionId() {
    return this._model.session.sessionId;
  }
  get username() {
    if (this.agent) {
      const isAllowed = this.chatAgentNameService.getAgentNameRestriction(this.agent);
      if (isAllowed) {
        return this.agent.fullName || this.agent.name;
      } else {
        return getFullyQualifiedId(this.agent);
      }
    }
    return this._model.username;
  }
  get avatarIcon() {
    return this._model.avatarIcon;
  }
  get agent() {
    return this._model.agent;
  }
  get slashCommand() {
    return this._model.slashCommand;
  }
  get agentOrSlashCommandDetected() {
    return this._model.agentOrSlashCommandDetected;
  }
  get response() {
    return this._model.response;
  }
  get usedContext() {
    return this._model.usedContext;
  }
  get contentReferences() {
    return this._model.contentReferences;
  }
  get codeCitations() {
    return this._model.codeCitations;
  }
  get progressMessages() {
    return this._model.progressMessages;
  }
  get isComplete() {
    return this._model.isComplete;
  }
  get isCanceled() {
    return this._model.isCanceled;
  }
  get shouldBeRemovedOnSend() {
    return this._model.shouldBeRemovedOnSend;
  }
  get isCompleteAddedRequest() {
    return this._model.isCompleteAddedRequest;
  }
  get replyFollowups() {
    return this._model.followups?.filter((f) => f.kind === "reply");
  }
  get result() {
    return this._model.result;
  }
  get errorDetails() {
    return this.result?.errorDetails;
  }
  get vote() {
    return this._model.vote;
  }
  get voteDownReason() {
    return this._model.voteDownReason;
  }
  get requestId() {
    return this._model.requestId;
  }
  get isStale() {
    return this._model.isStale;
  }
  get isLast() {
    return this._chatViewModel.getItems().at(-1) === this;
  }
  get usedReferencesExpanded() {
    if (typeof this._usedReferencesExpanded === "boolean") {
      return this._usedReferencesExpanded;
    }
    return void 0;
  }
  set usedReferencesExpanded(v) {
    this._usedReferencesExpanded = v;
  }
  get vulnerabilitiesListExpanded() {
    return this._vulnerabilitiesListExpanded;
  }
  set vulnerabilitiesListExpanded(v) {
    this._vulnerabilitiesListExpanded = v;
  }
  get contentUpdateTimings() {
    return this._contentUpdateTimings;
  }
  get isPaused() {
    return this._model.isPaused;
  }
  trace(tag, message) {
    this.logService.trace(`ChatResponseViewModel#${tag}: ${message}`);
  }
  setVote(vote) {
    this._modelChangeCount++;
    this._model.setVote(vote);
  }
  setVoteDownReason(reason) {
    this._modelChangeCount++;
    this._model.setVoteDownReason(reason);
  }
  setEditApplied(edit, editCount) {
    this._modelChangeCount++;
    this._model.setEditApplied(edit, editCount);
  }
};
ChatResponseViewModel = __decorateClass([
  __decorateParam(2, ILogService),
  __decorateParam(3, IChatAgentNameService)
], ChatResponseViewModel);
export {
  ChatRequestViewModel,
  ChatResponseViewModel,
  ChatViewModel,
  isRequestVM,
  isResponseVM
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0Vmlld01vZGVsLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBoYXNoIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vaGFzaC5qcyc7XG5pbXBvcnQgeyBJTWFya2Rvd25TdHJpbmcgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9odG1sQ29udGVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBkaXNwb3NlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCAqIGFzIG1hcmtlZCBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9tYXJrZWQvbWFya2VkLmpzJztcbmltcG9ydCB7IElPYnNlcnZhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vb2JzZXJ2YWJsZS5qcyc7XG5pbXBvcnQgeyBUaGVtZUljb24gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi90aGVtYWJsZXMuanMnO1xuaW1wb3J0IHsgVVJJIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElJbnN0YW50aWF0aW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5pbXBvcnQgeyBhbm5vdGF0ZVZ1bG5lcmFiaWxpdGllc0luVGV4dCB9IGZyb20gJy4vYW5ub3RhdGlvbnMuanMnO1xuaW1wb3J0IHsgZ2V0RnVsbHlRdWFsaWZpZWRJZCwgSUNoYXRBZ2VudENvbW1hbmQsIElDaGF0QWdlbnREYXRhLCBJQ2hhdEFnZW50TmFtZVNlcnZpY2UsIElDaGF0QWdlbnRSZXN1bHQgfSBmcm9tICcuL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgQ2hhdE1vZGVsSW5pdFN0YXRlLCBDaGF0UGF1c2VTdGF0ZSwgSUNoYXRNb2RlbCwgSUNoYXRQcm9ncmVzc1JlbmRlcmFibGVSZXNwb25zZUNvbnRlbnQsIElDaGF0UmVxdWVzdERpc2FibGVtZW50LCBJQ2hhdFJlcXVlc3RNb2RlbCwgSUNoYXRSZXF1ZXN0VmFyaWFibGVFbnRyeSwgSUNoYXRSZXNwb25zZU1vZGVsLCBJQ2hhdFRleHRFZGl0R3JvdXAsIElSZXNwb25zZSB9IGZyb20gJy4vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IElQYXJzZWRDaGF0UmVxdWVzdCB9IGZyb20gJy4vY2hhdFBhcnNlclR5cGVzLmpzJztcbmltcG9ydCB7IENoYXRBZ2VudFZvdGVEaXJlY3Rpb24sIENoYXRBZ2VudFZvdGVEb3duUmVhc29uLCBJQ2hhdENvZGVDaXRhdGlvbiwgSUNoYXRDb250ZW50UmVmZXJlbmNlLCBJQ2hhdEZvbGxvd3VwLCBJQ2hhdFByb2dyZXNzTWVzc2FnZSwgSUNoYXRSZXNwb25zZUVycm9yRGV0YWlscywgSUNoYXRUYXNrLCBJQ2hhdFVzZWRDb250ZXh0IH0gZnJvbSAnLi9jaGF0U2VydmljZS5qcyc7XG5pbXBvcnQgeyBjb3VudFdvcmRzIH0gZnJvbSAnLi9jaGF0V29yZENvdW50ZXIuanMnO1xuaW1wb3J0IHsgQ29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uIH0gZnJvbSAnLi9jb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24uanMnO1xuXG5leHBvcnQgZnVuY3Rpb24gaXNSZXF1ZXN0Vk0oaXRlbTogdW5rbm93bik6IGl0ZW0gaXMgSUNoYXRSZXF1ZXN0Vmlld01vZGVsIHtcblx0cmV0dXJuICEhaXRlbSAmJiB0eXBlb2YgaXRlbSA9PT0gJ29iamVjdCcgJiYgJ21lc3NhZ2UnIGluIGl0ZW07XG59XG5cbmV4cG9ydCBmdW5jdGlvbiBpc1Jlc3BvbnNlVk0oaXRlbTogdW5rbm93bik6IGl0ZW0gaXMgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCB7XG5cdHJldHVybiAhIWl0ZW0gJiYgdHlwZW9mIChpdGVtIGFzIElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpLnNldFZvdGUgIT09ICd1bmRlZmluZWQnO1xufVxuXG5leHBvcnQgdHlwZSBJQ2hhdFZpZXdNb2RlbENoYW5nZUV2ZW50ID0gSUNoYXRBZGRSZXF1ZXN0RXZlbnQgfCBJQ2hhbmdlUGxhY2Vob2xkZXJFdmVudCB8IElDaGF0U2Vzc2lvbkluaXRFdmVudCB8IElDaGF0U2V0SGlkZGVuRXZlbnQgfCBudWxsO1xuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0QWRkUmVxdWVzdEV2ZW50IHtcblx0a2luZDogJ2FkZFJlcXVlc3QnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGFuZ2VQbGFjZWhvbGRlckV2ZW50IHtcblx0a2luZDogJ2NoYW5nZVBsYWNlaG9sZGVyJztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFNlc3Npb25Jbml0RXZlbnQge1xuXHRraW5kOiAnaW5pdGlhbGl6ZSc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRTZXRIaWRkZW5FdmVudCB7XG5cdGtpbmQ6ICdzZXRIaWRkZW4nO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0Vmlld01vZGVsIHtcblx0cmVhZG9ubHkgbW9kZWw6IElDaGF0TW9kZWw7XG5cdHJlYWRvbmx5IGluaXRTdGF0ZTogQ2hhdE1vZGVsSW5pdFN0YXRlO1xuXHRyZWFkb25seSBzZXNzaW9uSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgb25EaWREaXNwb3NlTW9kZWw6IEV2ZW50PHZvaWQ+O1xuXHRyZWFkb25seSBvbkRpZENoYW5nZTogRXZlbnQ8SUNoYXRWaWV3TW9kZWxDaGFuZ2VFdmVudD47XG5cdHJlYWRvbmx5IHJlcXVlc3RJblByb2dyZXNzOiBib29sZWFuO1xuXHRyZWFkb25seSByZXF1ZXN0UGF1c2liaWxpdHk6IENoYXRQYXVzZVN0YXRlO1xuXHRyZWFkb25seSBpbnB1dFBsYWNlaG9sZGVyPzogc3RyaW5nO1xuXHRnZXRJdGVtcygpOiAoSUNoYXRSZXF1ZXN0Vmlld01vZGVsIHwgSUNoYXRSZXNwb25zZVZpZXdNb2RlbClbXTtcblx0c2V0SW5wdXRQbGFjZWhvbGRlcih0ZXh0OiBzdHJpbmcpOiB2b2lkO1xuXHRyZXNldElucHV0UGxhY2Vob2xkZXIoKTogdm9pZDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlcXVlc3RWaWV3TW9kZWwge1xuXHRyZWFkb25seSBpZDogc3RyaW5nO1xuXHRyZWFkb25seSBzZXNzaW9uSWQ6IHN0cmluZztcblx0LyoqIFRoaXMgSUQgdXBkYXRlcyBldmVyeSB0aW1lIHRoZSB1bmRlcmx5aW5nIGRhdGEgY2hhbmdlcyAqL1xuXHRyZWFkb25seSBkYXRhSWQ6IHN0cmluZztcblx0cmVhZG9ubHkgdXNlcm5hbWU6IHN0cmluZztcblx0cmVhZG9ubHkgYXZhdGFySWNvbj86IFVSSSB8IFRoZW1lSWNvbjtcblx0cmVhZG9ubHkgbWVzc2FnZTogSVBhcnNlZENoYXRSZXF1ZXN0IHwgSUNoYXRGb2xsb3d1cDtcblx0cmVhZG9ubHkgbWVzc2FnZVRleHQ6IHN0cmluZztcblx0cmVhZG9ubHkgYXR0ZW1wdDogbnVtYmVyO1xuXHRyZWFkb25seSB2YXJpYWJsZXM6IElDaGF0UmVxdWVzdFZhcmlhYmxlRW50cnlbXTtcblx0Y3VycmVudFJlbmRlcmVkSGVpZ2h0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGNvbnRlbnRSZWZlcmVuY2VzPzogUmVhZG9ubHlBcnJheTxJQ2hhdENvbnRlbnRSZWZlcmVuY2U+O1xuXHRyZWFkb25seSBjb25maXJtYXRpb24/OiBzdHJpbmc7XG5cdHJlYWRvbmx5IHNob3VsZEJlUmVtb3ZlZE9uU2VuZDogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlzQ29tcGxldGU6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlzQ29tcGxldGVBZGRlZFJlcXVlc3Q6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHNsYXNoQ29tbWFuZDogSUNoYXRBZ2VudENvbW1hbmQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGFnZW50T3JTbGFzaENvbW1hbmREZXRlY3RlZDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlc3BvbnNlTWFya2Rvd25SZW5kZXJEYXRhIHtcblx0cmVuZGVyZWRXb3JkQ291bnQ6IG51bWJlcjtcblx0bGFzdFJlbmRlclRpbWU6IG51bWJlcjtcblx0aXNGdWxseVJlbmRlcmVkOiBib29sZWFuO1xuXHRvcmlnaW5hbE1hcmtkb3duOiBJTWFya2Rvd25TdHJpbmc7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZXNwb25zZU1hcmtkb3duUmVuZGVyRGF0YTIge1xuXHRyZW5kZXJlZFdvcmRDb3VudDogbnVtYmVyO1xuXHRsYXN0UmVuZGVyVGltZTogbnVtYmVyO1xuXHRpc0Z1bGx5UmVuZGVyZWQ6IGJvb2xlYW47XG5cdG9yaWdpbmFsTWFya2Rvd246IElNYXJrZG93blN0cmluZztcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFByb2dyZXNzTWVzc2FnZVJlbmRlckRhdGEge1xuXHRwcm9ncmVzc01lc3NhZ2U6IElDaGF0UHJvZ3Jlc3NNZXNzYWdlO1xuXG5cdC8qKlxuXHQgKiBJbmRpY2F0ZXMgd2hldGhlciB0aGlzIGlzIHBhcnQgb2YgYSBncm91cCBvZiBwcm9ncmVzcyBtZXNzYWdlcyB0aGF0IGFyZSBhdCB0aGUgZW5kIG9mIHRoZSByZXNwb25zZS5cblx0ICogKE5vdCB3aGV0aGVyIHRoaXMgcGFydGljdWxhciBpdGVtIGlzIHRoZSB2ZXJ5IGxhc3Qgb25lIGluIHRoZSByZXNwb25zZSkuXG5cdCAqIE5lZWQgdG8gcmUtcmVuZGVyIGFuZCBhZGQgdG8gcGFydHNUb1JlbmRlciB3aGVuIHRoaXMgY2hhbmdlcy5cblx0ICovXG5cdGlzQXRFbmRPZlJlc3BvbnNlOiBib29sZWFuO1xuXG5cdC8qKlxuXHQgKiBXaGV0aGVyIHRoaXMgcHJvZ3Jlc3MgbWVzc2FnZSB0aGUgdmVyeSBsYXN0IGl0ZW0gaW4gdGhlIHJlc3BvbnNlLlxuXHQgKiBOZWVkIHRvIHJlLXJlbmRlciB0byB1cGRhdGUgc3Bpbm5lciB2cyBjaGVjayB3aGVuIHRoaXMgY2hhbmdlcy5cblx0ICovXG5cdGlzTGFzdDogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFRhc2tSZW5kZXJEYXRhIHtcblx0dGFzazogSUNoYXRUYXNrO1xuXHRpc1NldHRsZWQ6IGJvb2xlYW47XG5cdHByb2dyZXNzTGVuZ3RoOiBudW1iZXI7XG59XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRSZXNwb25zZVJlbmRlckRhdGEge1xuXHRyZW5kZXJlZFBhcnRzOiBJQ2hhdFJlbmRlcmVyQ29udGVudFtdO1xuXG5cdHJlbmRlcmVkV29yZENvdW50OiBudW1iZXI7XG5cdGxhc3RSZW5kZXJUaW1lOiBudW1iZXI7XG59XG5cbi8qKlxuICogQ29udGVudCB0eXBlIGZvciByZWZlcmVuY2VzIHVzZWQgZHVyaW5nIHJlbmRlcmluZywgbm90IGluIHRoZSBtb2RlbFxuICovXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0UmVmZXJlbmNlcyB7XG5cdHJlZmVyZW5jZXM6IFJlYWRvbmx5QXJyYXk8SUNoYXRDb250ZW50UmVmZXJlbmNlPjtcblx0a2luZDogJ3JlZmVyZW5jZXMnO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0V29ya2luZ1Byb2dyZXNzIHtcblx0a2luZDogJ3dvcmtpbmcnO1xuXHRpc1BhdXNlZDogYm9vbGVhbjtcbn1cblxuLyoqXG4gKiBDb250ZW50IHR5cGUgZm9yIGNpdGF0aW9ucyB1c2VkIGR1cmluZyByZW5kZXJpbmcsIG5vdCBpbiB0aGUgbW9kZWxcbiAqL1xuZXhwb3J0IGludGVyZmFjZSBJQ2hhdENvZGVDaXRhdGlvbnMge1xuXHRjaXRhdGlvbnM6IFJlYWRvbmx5QXJyYXk8SUNoYXRDb2RlQ2l0YXRpb24+O1xuXHRraW5kOiAnY29kZUNpdGF0aW9ucyc7XG59XG5cbi8qKlxuICogVHlwZSBmb3IgY29udGVudCBwYXJ0cyByZW5kZXJlZCBieSBJQ2hhdExpc3RSZW5kZXJlclxuICovXG5leHBvcnQgdHlwZSBJQ2hhdFJlbmRlcmVyQ29udGVudCA9IElDaGF0UHJvZ3Jlc3NSZW5kZXJhYmxlUmVzcG9uc2VDb250ZW50IHwgSUNoYXRSZWZlcmVuY2VzIHwgSUNoYXRDb2RlQ2l0YXRpb25zIHwgSUNoYXRXb3JraW5nUHJvZ3Jlc3M7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSUNoYXRMaXZlVXBkYXRlRGF0YSB7XG5cdHRvdGFsVGltZTogbnVtYmVyO1xuXHRsYXN0VXBkYXRlVGltZTogbnVtYmVyO1xuXHRpbXBsaWVkV29yZExvYWRSYXRlOiBudW1iZXI7XG5cdGxhc3RXb3JkQ291bnQ6IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFJlc3BvbnNlVmlld01vZGVsIHtcblx0cmVhZG9ubHkgbW9kZWw6IElDaGF0UmVzcG9uc2VNb2RlbDtcblx0cmVhZG9ubHkgaWQ6IHN0cmluZztcblx0cmVhZG9ubHkgc2Vzc2lvbklkOiBzdHJpbmc7XG5cdC8qKiBUaGlzIElEIHVwZGF0ZXMgZXZlcnkgdGltZSB0aGUgdW5kZXJseWluZyBkYXRhIGNoYW5nZXMgKi9cblx0cmVhZG9ubHkgZGF0YUlkOiBzdHJpbmc7XG5cdC8qKiBUaGUgSUQgb2YgdGhlIGFzc29jaWF0ZWQgSUNoYXRSZXF1ZXN0Vmlld01vZGVsICovXG5cdHJlYWRvbmx5IHJlcXVlc3RJZDogc3RyaW5nO1xuXHRyZWFkb25seSB1c2VybmFtZTogc3RyaW5nO1xuXHRyZWFkb25seSBhdmF0YXJJY29uPzogVVJJIHwgVGhlbWVJY29uO1xuXHRyZWFkb25seSBhZ2VudD86IElDaGF0QWdlbnREYXRhO1xuXHRyZWFkb25seSBzbGFzaENvbW1hbmQ/OiBJQ2hhdEFnZW50Q29tbWFuZDtcblx0cmVhZG9ubHkgYWdlbnRPclNsYXNoQ29tbWFuZERldGVjdGVkOiBib29sZWFuO1xuXHRyZWFkb25seSByZXNwb25zZTogSVJlc3BvbnNlO1xuXHRyZWFkb25seSB1c2VkQ29udGV4dDogSUNoYXRVc2VkQ29udGV4dCB8IHVuZGVmaW5lZDtcblx0cmVhZG9ubHkgY29udGVudFJlZmVyZW5jZXM6IFJlYWRvbmx5QXJyYXk8SUNoYXRDb250ZW50UmVmZXJlbmNlPjtcblx0cmVhZG9ubHkgY29kZUNpdGF0aW9uczogUmVhZG9ubHlBcnJheTxJQ2hhdENvZGVDaXRhdGlvbj47XG5cdHJlYWRvbmx5IHByb2dyZXNzTWVzc2FnZXM6IFJlYWRvbmx5QXJyYXk8SUNoYXRQcm9ncmVzc01lc3NhZ2U+O1xuXHRyZWFkb25seSBpc0NvbXBsZXRlOiBib29sZWFuO1xuXHRyZWFkb25seSBpc0NhbmNlbGVkOiBib29sZWFuO1xuXHRyZWFkb25seSBpc1N0YWxlOiBib29sZWFuO1xuXHRyZWFkb25seSB2b3RlOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uIHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSB2b3RlRG93blJlYXNvbjogQ2hhdEFnZW50Vm90ZURvd25SZWFzb24gfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IHJlcGx5Rm9sbG93dXBzPzogSUNoYXRGb2xsb3d1cFtdO1xuXHRyZWFkb25seSBlcnJvckRldGFpbHM/OiBJQ2hhdFJlc3BvbnNlRXJyb3JEZXRhaWxzO1xuXHRyZWFkb25seSByZXN1bHQ/OiBJQ2hhdEFnZW50UmVzdWx0O1xuXHRyZWFkb25seSBjb250ZW50VXBkYXRlVGltaW5ncz86IElDaGF0TGl2ZVVwZGF0ZURhdGE7XG5cdHJlYWRvbmx5IHNob3VsZEJlUmVtb3ZlZE9uU2VuZDogSUNoYXRSZXF1ZXN0RGlzYWJsZW1lbnQgfCB1bmRlZmluZWQ7XG5cdHJlYWRvbmx5IGlzQ29tcGxldGVBZGRlZFJlcXVlc3Q6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGlzUGF1c2VkOiBJT2JzZXJ2YWJsZTxib29sZWFuPjtcblx0cmVuZGVyRGF0YT86IElDaGF0UmVzcG9uc2VSZW5kZXJEYXRhO1xuXHRjdXJyZW50UmVuZGVyZWRIZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0c2V0Vm90ZSh2b3RlOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uKTogdm9pZDtcblx0c2V0Vm90ZURvd25SZWFzb24ocmVhc29uOiBDaGF0QWdlbnRWb3RlRG93blJlYXNvbiB8IHVuZGVmaW5lZCk6IHZvaWQ7XG5cdHVzZWRSZWZlcmVuY2VzRXhwYW5kZWQ/OiBib29sZWFuO1xuXHR2dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQ6IGJvb2xlYW47XG5cdHNldEVkaXRBcHBsaWVkKGVkaXQ6IElDaGF0VGV4dEVkaXRHcm91cCwgZWRpdENvdW50OiBudW1iZXIpOiB2b2lkO1xufVxuXG5leHBvcnQgY2xhc3MgQ2hhdFZpZXdNb2RlbCBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJQ2hhdFZpZXdNb2RlbCB7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfb25EaWREaXNwb3NlTW9kZWwgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWREaXNwb3NlTW9kZWwgPSB0aGlzLl9vbkRpZERpc3Bvc2VNb2RlbC5ldmVudDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPElDaGF0Vmlld01vZGVsQ2hhbmdlRXZlbnQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX2l0ZW1zOiAoQ2hhdFJlcXVlc3RWaWV3TW9kZWwgfCBDaGF0UmVzcG9uc2VWaWV3TW9kZWwpW10gPSBbXTtcblxuXHRwcml2YXRlIF9pbnB1dFBsYWNlaG9sZGVyOiBzdHJpbmcgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGdldCBpbnB1dFBsYWNlaG9sZGVyKCk6IHN0cmluZyB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX2lucHV0UGxhY2Vob2xkZXI7XG5cdH1cblxuXHRnZXQgbW9kZWwoKTogSUNoYXRNb2RlbCB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsO1xuXHR9XG5cblx0c2V0SW5wdXRQbGFjZWhvbGRlcih0ZXh0OiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9pbnB1dFBsYWNlaG9sZGVyID0gdGV4dDtcblx0XHR0aGlzLl9vbkRpZENoYW5nZS5maXJlKHsga2luZDogJ2NoYW5nZVBsYWNlaG9sZGVyJyB9KTtcblx0fVxuXG5cdHJlc2V0SW5wdXRQbGFjZWhvbGRlcigpOiB2b2lkIHtcblx0XHR0aGlzLl9pbnB1dFBsYWNlaG9sZGVyID0gdW5kZWZpbmVkO1xuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoeyBraW5kOiAnY2hhbmdlUGxhY2Vob2xkZXInIH0pO1xuXHR9XG5cblx0Z2V0IHNlc3Npb25JZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuc2Vzc2lvbklkO1xuXHR9XG5cblx0Z2V0IHJlcXVlc3RJblByb2dyZXNzKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5yZXF1ZXN0SW5Qcm9ncmVzcztcblx0fVxuXG5cdGdldCByZXF1ZXN0UGF1c2liaWxpdHkoKTogQ2hhdFBhdXNlU3RhdGUge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5yZXF1ZXN0UGF1c2liaWxpdHk7XG5cdH1cblxuXHRnZXQgaW5pdFN0YXRlKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5pbml0U3RhdGU7XG5cdH1cblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSUNoYXRNb2RlbCxcblx0XHRwdWJsaWMgcmVhZG9ubHkgY29kZUJsb2NrTW9kZWxDb2xsZWN0aW9uOiBDb2RlQmxvY2tNb2RlbENvbGxlY3Rpb24sXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGluc3RhbnRpYXRpb25TZXJ2aWNlOiBJSW5zdGFudGlhdGlvblNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHRfbW9kZWwuZ2V0UmVxdWVzdHMoKS5mb3JFYWNoKChyZXF1ZXN0LCBpKSA9PiB7XG5cdFx0XHRjb25zdCByZXF1ZXN0TW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRSZXF1ZXN0Vmlld01vZGVsLCByZXF1ZXN0KTtcblx0XHRcdHRoaXMuX2l0ZW1zLnB1c2gocmVxdWVzdE1vZGVsKTtcblx0XHRcdHRoaXMudXBkYXRlQ29kZUJsb2NrVGV4dE1vZGVscyhyZXF1ZXN0TW9kZWwpO1xuXG5cdFx0XHRpZiAocmVxdWVzdC5yZXNwb25zZSkge1xuXHRcdFx0XHR0aGlzLm9uQWRkUmVzcG9uc2UocmVxdWVzdC5yZXNwb25zZSk7XG5cdFx0XHR9XG5cdFx0fSk7XG5cblx0XHR0aGlzLl9yZWdpc3RlcihfbW9kZWwub25EaWREaXNwb3NlKCgpID0+IHRoaXMuX29uRGlkRGlzcG9zZU1vZGVsLmZpcmUoKSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKF9tb2RlbC5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdGlmIChlLmtpbmQgPT09ICdhZGRSZXF1ZXN0Jykge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0TW9kZWwgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRSZXF1ZXN0Vmlld01vZGVsLCBlLnJlcXVlc3QpO1xuXHRcdFx0XHR0aGlzLl9pdGVtcy5wdXNoKHJlcXVlc3RNb2RlbCk7XG5cdFx0XHRcdHRoaXMudXBkYXRlQ29kZUJsb2NrVGV4dE1vZGVscyhyZXF1ZXN0TW9kZWwpO1xuXG5cdFx0XHRcdGlmIChlLnJlcXVlc3QucmVzcG9uc2UpIHtcblx0XHRcdFx0XHR0aGlzLm9uQWRkUmVzcG9uc2UoZS5yZXF1ZXN0LnJlc3BvbnNlKTtcblx0XHRcdFx0fVxuXHRcdFx0fSBlbHNlIGlmIChlLmtpbmQgPT09ICdhZGRSZXNwb25zZScpIHtcblx0XHRcdFx0dGhpcy5vbkFkZFJlc3BvbnNlKGUucmVzcG9uc2UpO1xuXHRcdFx0fSBlbHNlIGlmIChlLmtpbmQgPT09ICdyZW1vdmVSZXF1ZXN0Jykge1xuXHRcdFx0XHRjb25zdCByZXF1ZXN0SWR4ID0gdGhpcy5faXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXNSZXF1ZXN0Vk0oaXRlbSkgJiYgaXRlbS5pZCA9PT0gZS5yZXF1ZXN0SWQpO1xuXHRcdFx0XHRpZiAocmVxdWVzdElkeCA+PSAwKSB7XG5cdFx0XHRcdFx0dGhpcy5faXRlbXMuc3BsaWNlKHJlcXVlc3RJZHgsIDEpO1xuXHRcdFx0XHR9XG5cblx0XHRcdFx0Y29uc3QgcmVzcG9uc2VJZHggPSBlLnJlc3BvbnNlSWQgJiYgdGhpcy5faXRlbXMuZmluZEluZGV4KGl0ZW0gPT4gaXNSZXNwb25zZVZNKGl0ZW0pICYmIGl0ZW0uaWQgPT09IGUucmVzcG9uc2VJZCk7XG5cdFx0XHRcdGlmICh0eXBlb2YgcmVzcG9uc2VJZHggPT09ICdudW1iZXInICYmIHJlc3BvbnNlSWR4ID49IDApIHtcblx0XHRcdFx0XHRjb25zdCBpdGVtcyA9IHRoaXMuX2l0ZW1zLnNwbGljZShyZXNwb25zZUlkeCwgMSk7XG5cdFx0XHRcdFx0Y29uc3QgaXRlbSA9IGl0ZW1zWzBdO1xuXHRcdFx0XHRcdGlmIChpdGVtIGluc3RhbmNlb2YgQ2hhdFJlc3BvbnNlVmlld01vZGVsKSB7XG5cdFx0XHRcdFx0XHRpdGVtLmRpc3Bvc2UoKTtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgbW9kZWxFdmVudFRvVm1FdmVudDogSUNoYXRWaWV3TW9kZWxDaGFuZ2VFdmVudCA9XG5cdFx0XHRcdGUua2luZCA9PT0gJ2FkZFJlcXVlc3QnID8geyBraW5kOiAnYWRkUmVxdWVzdCcgfVxuXHRcdFx0XHRcdDogZS5raW5kID09PSAnaW5pdGlhbGl6ZScgPyB7IGtpbmQ6ICdpbml0aWFsaXplJyB9XG5cdFx0XHRcdFx0XHQ6IGUua2luZCA9PT0gJ3NldEhpZGRlbicgPyB7IGtpbmQ6ICdzZXRIaWRkZW4nIH1cblx0XHRcdFx0XHRcdFx0OiBudWxsO1xuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZShtb2RlbEV2ZW50VG9WbUV2ZW50KTtcblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIG9uQWRkUmVzcG9uc2UocmVzcG9uc2VNb2RlbDogSUNoYXRSZXNwb25zZU1vZGVsKSB7XG5cdFx0Y29uc3QgcmVzcG9uc2UgPSB0aGlzLmluc3RhbnRpYXRpb25TZXJ2aWNlLmNyZWF0ZUluc3RhbmNlKENoYXRSZXNwb25zZVZpZXdNb2RlbCwgcmVzcG9uc2VNb2RlbCwgdGhpcyk7XG5cdFx0dGhpcy5fcmVnaXN0ZXIocmVzcG9uc2Uub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0aWYgKHJlc3BvbnNlLmlzQ29tcGxldGUpIHtcblx0XHRcdFx0dGhpcy51cGRhdGVDb2RlQmxvY2tUZXh0TW9kZWxzKHJlc3BvbnNlKTtcblx0XHRcdH1cblx0XHRcdHJldHVybiB0aGlzLl9vbkRpZENoYW5nZS5maXJlKG51bGwpO1xuXHRcdH0pKTtcblx0XHR0aGlzLl9pdGVtcy5wdXNoKHJlc3BvbnNlKTtcblx0XHR0aGlzLnVwZGF0ZUNvZGVCbG9ja1RleHRNb2RlbHMocmVzcG9uc2UpO1xuXHR9XG5cblx0Z2V0SXRlbXMoKTogKElDaGF0UmVxdWVzdFZpZXdNb2RlbCB8IElDaGF0UmVzcG9uc2VWaWV3TW9kZWwpW10ge1xuXHRcdHJldHVybiB0aGlzLl9pdGVtcy5maWx0ZXIoKGl0ZW0pID0+ICFpdGVtLnNob3VsZEJlUmVtb3ZlZE9uU2VuZCB8fCBpdGVtLnNob3VsZEJlUmVtb3ZlZE9uU2VuZC5hZnRlclVuZG9TdG9wKTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKSB7XG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHRcdGRpc3Bvc2UodGhpcy5faXRlbXMuZmlsdGVyKChpdGVtKTogaXRlbSBpcyBDaGF0UmVzcG9uc2VWaWV3TW9kZWwgPT4gaXRlbSBpbnN0YW5jZW9mIENoYXRSZXNwb25zZVZpZXdNb2RlbCkpO1xuXHR9XG5cblx0dXBkYXRlQ29kZUJsb2NrVGV4dE1vZGVscyhtb2RlbDogSUNoYXRSZXF1ZXN0Vmlld01vZGVsIHwgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCkge1xuXHRcdGxldCBjb250ZW50OiBzdHJpbmc7XG5cdFx0aWYgKGlzUmVxdWVzdFZNKG1vZGVsKSkge1xuXHRcdFx0Y29udGVudCA9IG1vZGVsLm1lc3NhZ2VUZXh0O1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRjb250ZW50ID0gYW5ub3RhdGVWdWxuZXJhYmlsaXRpZXNJblRleHQobW9kZWwucmVzcG9uc2UudmFsdWUpLm1hcCh4ID0+IHguY29udGVudC52YWx1ZSkuam9pbignJyk7XG5cdFx0fVxuXG5cdFx0bGV0IGNvZGVCbG9ja0luZGV4ID0gMDtcblx0XHRtYXJrZWQud2Fsa1Rva2VucyhtYXJrZWQubGV4ZXIoY29udGVudCksIHRva2VuID0+IHtcblx0XHRcdGlmICh0b2tlbi50eXBlID09PSAnY29kZScpIHtcblx0XHRcdFx0Y29uc3QgbGFuZyA9IHRva2VuLmxhbmcgfHwgJyc7XG5cdFx0XHRcdGNvbnN0IHRleHQgPSB0b2tlbi50ZXh0O1xuXHRcdFx0XHR0aGlzLmNvZGVCbG9ja01vZGVsQ29sbGVjdGlvbi51cGRhdGUodGhpcy5fbW9kZWwuc2Vzc2lvbklkLCBtb2RlbCwgY29kZUJsb2NrSW5kZXgrKywgeyB0ZXh0LCBsYW5ndWFnZUlkOiBsYW5nLCBpc0NvbXBsZXRlOiB0cnVlIH0pO1xuXHRcdFx0fVxuXHRcdH0pO1xuXHR9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVxdWVzdFZpZXdNb2RlbCBpbXBsZW1lbnRzIElDaGF0UmVxdWVzdFZpZXdNb2RlbCB7XG5cdGdldCBpZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuaWQ7XG5cdH1cblxuXHRnZXQgZGF0YUlkKCkge1xuXHRcdHJldHVybiB0aGlzLmlkICsgYF8ke0NoYXRNb2RlbEluaXRTdGF0ZVt0aGlzLl9tb2RlbC5zZXNzaW9uLmluaXRTdGF0ZV19XyR7aGFzaCh0aGlzLnZhcmlhYmxlcyl9XyR7aGFzaCh0aGlzLmlzQ29tcGxldGUpfWA7XG5cdH1cblxuXHRnZXQgc2Vzc2lvbklkKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5zZXNzaW9uLnNlc3Npb25JZDtcblx0fVxuXG5cdGdldCB1c2VybmFtZSgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwudXNlcm5hbWU7XG5cdH1cblxuXHRnZXQgYXZhdGFySWNvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuYXZhdGFySWNvblVyaTtcblx0fVxuXG5cdGdldCBtZXNzYWdlKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5tZXNzYWdlO1xuXHR9XG5cblx0Z2V0IG1lc3NhZ2VUZXh0KCkge1xuXHRcdHJldHVybiB0aGlzLm1lc3NhZ2UudGV4dDtcblx0fVxuXG5cdGdldCBhdHRlbXB0KCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5hdHRlbXB0O1xuXHR9XG5cblx0Z2V0IHZhcmlhYmxlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwudmFyaWFibGVEYXRhLnZhcmlhYmxlcztcblx0fVxuXG5cdGdldCBjb250ZW50UmVmZXJlbmNlcygpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwucmVzcG9uc2U/LmNvbnRlbnRSZWZlcmVuY2VzO1xuXHR9XG5cblx0Z2V0IGNvbmZpcm1hdGlvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuY29uZmlybWF0aW9uO1xuXHR9XG5cblx0Z2V0IGlzQ29tcGxldGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnJlc3BvbnNlPy5pc0NvbXBsZXRlID8/IGZhbHNlO1xuXHR9XG5cblx0Z2V0IGlzQ29tcGxldGVBZGRlZFJlcXVlc3QoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLmlzQ29tcGxldGVBZGRlZFJlcXVlc3Q7XG5cdH1cblxuXHRnZXQgc2hvdWxkQmVSZW1vdmVkT25TZW5kKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5zaG91bGRCZVJlbW92ZWRPblNlbmQ7XG5cdH1cblxuXHRnZXQgc2xhc2hDb21tYW5kKCk6IElDaGF0QWdlbnRDb21tYW5kIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwucmVzcG9uc2U/LnNsYXNoQ29tbWFuZDtcblx0fVxuXG5cdGdldCBhZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQoKTogYm9vbGVhbiB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnJlc3BvbnNlPy5hZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQgPz8gZmFsc2U7XG5cdH1cblxuXHRjdXJyZW50UmVuZGVyZWRIZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9tb2RlbDogSUNoYXRSZXF1ZXN0TW9kZWwsXG5cdCkgeyB9XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0UmVzcG9uc2VWaWV3TW9kZWwgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUNoYXRSZXNwb25zZVZpZXdNb2RlbCB7XG5cdHByaXZhdGUgX21vZGVsQ2hhbmdlQ291bnQgPSAwO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlID0gdGhpcy5fb25EaWRDaGFuZ2UuZXZlbnQ7XG5cblx0Z2V0IG1vZGVsKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbDtcblx0fVxuXG5cdGdldCBpZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuaWQ7XG5cdH1cblxuXHRnZXQgZGF0YUlkKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5pZCArXG5cdFx0XHRgXyR7dGhpcy5fbW9kZWxDaGFuZ2VDb3VudH1gICtcblx0XHRcdGBfJHtDaGF0TW9kZWxJbml0U3RhdGVbdGhpcy5fbW9kZWwuc2Vzc2lvbi5pbml0U3RhdGVdfWAgK1xuXHRcdFx0KHRoaXMuaXNMYXN0ID8gJ19sYXN0JyA6ICcnKTtcblx0fVxuXG5cdGdldCBzZXNzaW9uSWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnNlc3Npb24uc2Vzc2lvbklkO1xuXHR9XG5cblx0Z2V0IHVzZXJuYW1lKCkge1xuXHRcdGlmICh0aGlzLmFnZW50KSB7XG5cdFx0XHRjb25zdCBpc0FsbG93ZWQgPSB0aGlzLmNoYXRBZ2VudE5hbWVTZXJ2aWNlLmdldEFnZW50TmFtZVJlc3RyaWN0aW9uKHRoaXMuYWdlbnQpO1xuXHRcdFx0aWYgKGlzQWxsb3dlZCkge1xuXHRcdFx0XHRyZXR1cm4gdGhpcy5hZ2VudC5mdWxsTmFtZSB8fCB0aGlzLmFnZW50Lm5hbWU7XG5cdFx0XHR9IGVsc2Uge1xuXHRcdFx0XHRyZXR1cm4gZ2V0RnVsbHlRdWFsaWZpZWRJZCh0aGlzLmFnZW50KTtcblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwudXNlcm5hbWU7XG5cdH1cblxuXHRnZXQgYXZhdGFySWNvbigpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuYXZhdGFySWNvbjtcblx0fVxuXG5cdGdldCBhZ2VudCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuYWdlbnQ7XG5cdH1cblxuXHRnZXQgc2xhc2hDb21tYW5kKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5zbGFzaENvbW1hbmQ7XG5cdH1cblxuXHRnZXQgYWdlbnRPclNsYXNoQ29tbWFuZERldGVjdGVkKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5hZ2VudE9yU2xhc2hDb21tYW5kRGV0ZWN0ZWQ7XG5cdH1cblxuXHRnZXQgcmVzcG9uc2UoKTogSVJlc3BvbnNlIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwucmVzcG9uc2U7XG5cdH1cblxuXHRnZXQgdXNlZENvbnRleHQoKTogSUNoYXRVc2VkQ29udGV4dCB8IHVuZGVmaW5lZCB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnVzZWRDb250ZXh0O1xuXHR9XG5cblx0Z2V0IGNvbnRlbnRSZWZlcmVuY2VzKCk6IFJlYWRvbmx5QXJyYXk8SUNoYXRDb250ZW50UmVmZXJlbmNlPiB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLmNvbnRlbnRSZWZlcmVuY2VzO1xuXHR9XG5cblx0Z2V0IGNvZGVDaXRhdGlvbnMoKTogUmVhZG9ubHlBcnJheTxJQ2hhdENvZGVDaXRhdGlvbj4ge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5jb2RlQ2l0YXRpb25zO1xuXHR9XG5cblx0Z2V0IHByb2dyZXNzTWVzc2FnZXMoKTogUmVhZG9ubHlBcnJheTxJQ2hhdFByb2dyZXNzTWVzc2FnZT4ge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5wcm9ncmVzc01lc3NhZ2VzO1xuXHR9XG5cblx0Z2V0IGlzQ29tcGxldGUoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLmlzQ29tcGxldGU7XG5cdH1cblxuXHRnZXQgaXNDYW5jZWxlZCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwuaXNDYW5jZWxlZDtcblx0fVxuXG5cdGdldCBzaG91bGRCZVJlbW92ZWRPblNlbmQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnNob3VsZEJlUmVtb3ZlZE9uU2VuZDtcblx0fVxuXG5cdGdldCBpc0NvbXBsZXRlQWRkZWRSZXF1ZXN0KCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5pc0NvbXBsZXRlQWRkZWRSZXF1ZXN0O1xuXHR9XG5cblx0Z2V0IHJlcGx5Rm9sbG93dXBzKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5mb2xsb3d1cHM/LmZpbHRlcigoZik6IGYgaXMgSUNoYXRGb2xsb3d1cCA9PiBmLmtpbmQgPT09ICdyZXBseScpO1xuXHR9XG5cblx0Z2V0IHJlc3VsdCgpIHtcblx0XHRyZXR1cm4gdGhpcy5fbW9kZWwucmVzdWx0O1xuXHR9XG5cblx0Z2V0IGVycm9yRGV0YWlscygpOiBJQ2hhdFJlc3BvbnNlRXJyb3JEZXRhaWxzIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5yZXN1bHQ/LmVycm9yRGV0YWlscztcblx0fVxuXG5cdGdldCB2b3RlKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC52b3RlO1xuXHR9XG5cblx0Z2V0IHZvdGVEb3duUmVhc29uKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC52b3RlRG93blJlYXNvbjtcblx0fVxuXG5cdGdldCByZXF1ZXN0SWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLnJlcXVlc3RJZDtcblx0fVxuXG5cdGdldCBpc1N0YWxlKCkge1xuXHRcdHJldHVybiB0aGlzLl9tb2RlbC5pc1N0YWxlO1xuXHR9XG5cblx0Z2V0IGlzTGFzdCgpOiBib29sZWFuIHtcblx0XHRyZXR1cm4gdGhpcy5fY2hhdFZpZXdNb2RlbC5nZXRJdGVtcygpLmF0KC0xKSA9PT0gdGhpcztcblx0fVxuXG5cdHJlbmRlckRhdGE6IElDaGF0UmVzcG9uc2VSZW5kZXJEYXRhIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRjdXJyZW50UmVuZGVyZWRIZWlnaHQ6IG51bWJlciB8IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIF91c2VkUmVmZXJlbmNlc0V4cGFuZGVkOiBib29sZWFuIHwgdW5kZWZpbmVkO1xuXHRnZXQgdXNlZFJlZmVyZW5jZXNFeHBhbmRlZCgpOiBib29sZWFuIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAodHlwZW9mIHRoaXMuX3VzZWRSZWZlcmVuY2VzRXhwYW5kZWQgPT09ICdib29sZWFuJykge1xuXHRcdFx0cmV0dXJuIHRoaXMuX3VzZWRSZWZlcmVuY2VzRXhwYW5kZWQ7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0fVxuXG5cdHNldCB1c2VkUmVmZXJlbmNlc0V4cGFuZGVkKHY6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl91c2VkUmVmZXJlbmNlc0V4cGFuZGVkID0gdjtcblx0fVxuXG5cdHByaXZhdGUgX3Z1bG5lcmFiaWxpdGllc0xpc3RFeHBhbmRlZDogYm9vbGVhbiA9IGZhbHNlO1xuXHRnZXQgdnVsbmVyYWJpbGl0aWVzTGlzdEV4cGFuZGVkKCk6IGJvb2xlYW4ge1xuXHRcdHJldHVybiB0aGlzLl92dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQ7XG5cdH1cblxuXHRzZXQgdnVsbmVyYWJpbGl0aWVzTGlzdEV4cGFuZGVkKHY6IGJvb2xlYW4pIHtcblx0XHR0aGlzLl92dWxuZXJhYmlsaXRpZXNMaXN0RXhwYW5kZWQgPSB2O1xuXHR9XG5cblx0cHJpdmF0ZSBfY29udGVudFVwZGF0ZVRpbWluZ3M6IElDaGF0TGl2ZVVwZGF0ZURhdGEgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdGdldCBjb250ZW50VXBkYXRlVGltaW5ncygpOiBJQ2hhdExpdmVVcGRhdGVEYXRhIHwgdW5kZWZpbmVkIHtcblx0XHRyZXR1cm4gdGhpcy5fY29udGVudFVwZGF0ZVRpbWluZ3M7XG5cdH1cblxuXHRnZXQgaXNQYXVzZWQoKSB7XG5cdFx0cmV0dXJuIHRoaXMuX21vZGVsLmlzUGF1c2VkO1xuXHR9XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfbW9kZWw6IElDaGF0UmVzcG9uc2VNb2RlbCxcblx0XHRwcml2YXRlIHJlYWRvbmx5IF9jaGF0Vmlld01vZGVsOiBJQ2hhdFZpZXdNb2RlbCxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZSxcblx0XHRASUNoYXRBZ2VudE5hbWVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50TmFtZVNlcnZpY2U6IElDaGF0QWdlbnROYW1lU2VydmljZSxcblx0KSB7XG5cdFx0c3VwZXIoKTtcblxuXHRcdGlmICghX21vZGVsLmlzQ29tcGxldGUpIHtcblx0XHRcdHRoaXMuX2NvbnRlbnRVcGRhdGVUaW1pbmdzID0ge1xuXHRcdFx0XHR0b3RhbFRpbWU6IDAsXG5cdFx0XHRcdGxhc3RVcGRhdGVUaW1lOiBEYXRlLm5vdygpLFxuXHRcdFx0XHRpbXBsaWVkV29yZExvYWRSYXRlOiAwLFxuXHRcdFx0XHRsYXN0V29yZENvdW50OiAwLFxuXHRcdFx0fTtcblx0XHR9XG5cblx0XHR0aGlzLl9yZWdpc3RlcihfbW9kZWwub25EaWRDaGFuZ2UoKCkgPT4ge1xuXHRcdFx0Ly8gVGhpcyBpcyBzZXQgd2hlbiB0aGUgcmVzcG9uc2UgaXMgbG9hZGluZywgYnV0IHRoZSBtb2RlbCBjYW4gY2hhbmdlIGxhdGVyIGZvciBvdGhlciByZWFzb25zXG5cdFx0XHRpZiAodGhpcy5fY29udGVudFVwZGF0ZVRpbWluZ3MpIHtcblx0XHRcdFx0Y29uc3Qgbm93ID0gRGF0ZS5ub3coKTtcblx0XHRcdFx0Y29uc3Qgd29yZENvdW50ID0gY291bnRXb3JkcyhfbW9kZWwuZW50aXJlUmVzcG9uc2UuZ2V0TWFya2Rvd24oKSk7XG5cblx0XHRcdFx0aWYgKHdvcmRDb3VudCA9PT0gdGhpcy5fY29udGVudFVwZGF0ZVRpbWluZ3MubGFzdFdvcmRDb3VudCkge1xuXHRcdFx0XHRcdHRoaXMudHJhY2UoJ29uRGlkQ2hhbmdlJywgYFVwZGF0ZS0gbm8gbmV3IHdvcmRzYCk7XG5cdFx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdFx0aWYgKHRoaXMuX2NvbnRlbnRVcGRhdGVUaW1pbmdzLmxhc3RXb3JkQ291bnQgPT09IDApIHtcblx0XHRcdFx0XHRcdHRoaXMuX2NvbnRlbnRVcGRhdGVUaW1pbmdzLmxhc3RVcGRhdGVUaW1lID0gbm93O1xuXHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdGNvbnN0IHRpbWVEaWZmID0gTWF0aC5taW4obm93IC0gdGhpcy5fY29udGVudFVwZGF0ZVRpbWluZ3MubGFzdFVwZGF0ZVRpbWUsIDEwMDApO1xuXHRcdFx0XHRcdGNvbnN0IG5ld1RvdGFsVGltZSA9IE1hdGgubWF4KHRoaXMuX2NvbnRlbnRVcGRhdGVUaW1pbmdzLnRvdGFsVGltZSArIHRpbWVEaWZmLCAyNTApO1xuXHRcdFx0XHRcdGNvbnN0IGltcGxpZWRXb3JkTG9hZFJhdGUgPSB3b3JkQ291bnQgLyAobmV3VG90YWxUaW1lIC8gMTAwMCk7XG5cdFx0XHRcdFx0dGhpcy50cmFjZSgnb25EaWRDaGFuZ2UnLCBgVXBkYXRlLSBnb3QgJHt3b3JkQ291bnR9IHdvcmRzIG92ZXIgbGFzdCAke25ld1RvdGFsVGltZX1tcyA9ICR7aW1wbGllZFdvcmRMb2FkUmF0ZX0gd29yZHMvc2ApO1xuXHRcdFx0XHRcdHRoaXMuX2NvbnRlbnRVcGRhdGVUaW1pbmdzID0ge1xuXHRcdFx0XHRcdFx0dG90YWxUaW1lOiB0aGlzLl9jb250ZW50VXBkYXRlVGltaW5ncy50b3RhbFRpbWUgIT09IDAgfHwgdGhpcy5yZXNwb25zZS52YWx1ZS5zb21lKHYgPT4gdi5raW5kID09PSAnbWFya2Rvd25Db250ZW50JykgP1xuXHRcdFx0XHRcdFx0XHRuZXdUb3RhbFRpbWUgOlxuXHRcdFx0XHRcdFx0XHR0aGlzLl9jb250ZW50VXBkYXRlVGltaW5ncy50b3RhbFRpbWUsXG5cdFx0XHRcdFx0XHRsYXN0VXBkYXRlVGltZTogbm93LFxuXHRcdFx0XHRcdFx0aW1wbGllZFdvcmRMb2FkUmF0ZSxcblx0XHRcdFx0XHRcdGxhc3RXb3JkQ291bnQ6IHdvcmRDb3VudFxuXHRcdFx0XHRcdH07XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0Ly8gbmV3IGRhdGEgLT4gbmV3IGlkLCBuZXcgY29udGVudCB0byByZW5kZXJcblx0XHRcdHRoaXMuX21vZGVsQ2hhbmdlQ291bnQrKztcblxuXHRcdFx0dGhpcy5fb25EaWRDaGFuZ2UuZmlyZSgpO1xuXHRcdH0pKTtcblx0fVxuXG5cdHByaXZhdGUgdHJhY2UodGFnOiBzdHJpbmcsIG1lc3NhZ2U6IHN0cmluZykge1xuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgQ2hhdFJlc3BvbnNlVmlld01vZGVsIyR7dGFnfTogJHttZXNzYWdlfWApO1xuXHR9XG5cblx0c2V0Vm90ZSh2b3RlOiBDaGF0QWdlbnRWb3RlRGlyZWN0aW9uKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxDaGFuZ2VDb3VudCsrO1xuXHRcdHRoaXMuX21vZGVsLnNldFZvdGUodm90ZSk7XG5cdH1cblxuXHRzZXRWb3RlRG93blJlYXNvbihyZWFzb246IENoYXRBZ2VudFZvdGVEb3duUmVhc29uIHwgdW5kZWZpbmVkKTogdm9pZCB7XG5cdFx0dGhpcy5fbW9kZWxDaGFuZ2VDb3VudCsrO1xuXHRcdHRoaXMuX21vZGVsLnNldFZvdGVEb3duUmVhc29uKHJlYXNvbik7XG5cdH1cblxuXHRzZXRFZGl0QXBwbGllZChlZGl0OiBJQ2hhdFRleHRFZGl0R3JvdXAsIGVkaXRDb3VudDogbnVtYmVyKSB7XG5cdFx0dGhpcy5fbW9kZWxDaGFuZ2VDb3VudCsrO1xuXHRcdHRoaXMuX21vZGVsLnNldEVkaXRBcHBsaWVkKGVkaXQsIGVkaXRDb3VudCk7XG5cdH1cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxlQUFzQjtBQUMvQixTQUFTLFlBQVk7QUFFckIsU0FBUyxZQUFZLGVBQWU7QUFDcEMsWUFBWSxZQUFZO0FBSXhCLFNBQVMsNkJBQTZC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
