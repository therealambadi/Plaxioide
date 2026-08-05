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
import { localize } from "../../../../nls.js";
import { Emitter } from "../../../../base/common/event.js";
import { Disposable, DisposableStore } from "../../../../base/common/lifecycle.js";
import { rtrim } from "../../../../base/common/strings.js";
import { IContextKeyService, RawContextKey } from "../../../../platform/contextkey/common/contextkey.js";
import { createDecorator } from "../../../../platform/instantiation/common/instantiation.js";
import { IChatAgentService } from "./chatAgents.js";
import { chatAgentLeader, chatSubcommandLeader } from "./chatParserTypes.js";
import { ISpeechService, SpeechToTextStatus } from "../../speech/common/speechService.js";
const IVoiceChatService = createDecorator("voiceChatService");
var PhraseTextType = /* @__PURE__ */ ((PhraseTextType2) => {
  PhraseTextType2[PhraseTextType2["AGENT"] = 1] = "AGENT";
  PhraseTextType2[PhraseTextType2["COMMAND"] = 2] = "COMMAND";
  PhraseTextType2[PhraseTextType2["AGENT_AND_COMMAND"] = 3] = "AGENT_AND_COMMAND";
  return PhraseTextType2;
})(PhraseTextType || {});
const VoiceChatInProgress = new RawContextKey("voiceChatInProgress", false, { type: "boolean", description: localize("voiceChatInProgress", "A speech-to-text session is in progress for chat.") });
let VoiceChatService = class extends Disposable {
  constructor(speechService, chatAgentService, contextKeyService) {
    super();
    this.speechService = speechService;
    this.chatAgentService = chatAgentService;
    this.activeVoiceChatSessions = 0;
    this.voiceChatInProgress = VoiceChatInProgress.bindTo(contextKeyService);
  }
  createPhrases(model) {
    const phrases = /* @__PURE__ */ new Map();
    for (const agent of this.chatAgentService.getActivatedAgents()) {
      const agentPhrase = `${VoiceChatService.PHRASES_LOWER[VoiceChatService.AGENT_PREFIX]} ${VoiceChatService.CHAT_AGENT_ALIAS.get(agent.name) ?? agent.name}`.toLowerCase();
      phrases.set(agentPhrase, { agent: agent.name });
      for (const slashCommand of agent.slashCommands) {
        const slashCommandPhrase = `${VoiceChatService.PHRASES_LOWER[VoiceChatService.COMMAND_PREFIX]} ${slashCommand.name}`.toLowerCase();
        phrases.set(slashCommandPhrase, { agent: agent.name, command: slashCommand.name });
        const agentSlashCommandPhrase = `${agentPhrase} ${slashCommandPhrase}`.toLowerCase();
        phrases.set(agentSlashCommandPhrase, { agent: agent.name, command: slashCommand.name });
      }
    }
    return phrases;
  }
  toText(value, type) {
    switch (type) {
      case 1 /* AGENT */:
        return `${VoiceChatService.AGENT_PREFIX}${value.agent}`;
      case 2 /* COMMAND */:
        return `${VoiceChatService.COMMAND_PREFIX}${value.command}`;
      case 3 /* AGENT_AND_COMMAND */:
        return `${VoiceChatService.AGENT_PREFIX}${value.agent} ${VoiceChatService.COMMAND_PREFIX}${value.command}`;
    }
  }
  async createVoiceChatSession(token, options) {
    const disposables = new DisposableStore();
    const onSessionStoppedOrCanceled = (dispose) => {
      this.activeVoiceChatSessions = Math.max(0, this.activeVoiceChatSessions - 1);
      if (this.activeVoiceChatSessions === 0) {
        this.voiceChatInProgress.reset();
      }
      if (dispose) {
        disposables.dispose();
      }
    };
    disposables.add(token.onCancellationRequested(() => onSessionStoppedOrCanceled(true)));
    let detectedAgent = false;
    let detectedSlashCommand = false;
    const emitter = disposables.add(new Emitter());
    const session = await this.speechService.createSpeechToTextSession(token, "chat");
    if (token.isCancellationRequested) {
      onSessionStoppedOrCanceled(true);
    }
    const phrases = this.createPhrases(options.model);
    disposables.add(session.onDidChange((e) => {
      switch (e.status) {
        case SpeechToTextStatus.Recognizing:
        case SpeechToTextStatus.Recognized: {
          let massagedEvent = e;
          if (e.text) {
            const startsWithAgent = e.text.startsWith(VoiceChatService.PHRASES_UPPER[VoiceChatService.AGENT_PREFIX]) || e.text.startsWith(VoiceChatService.PHRASES_LOWER[VoiceChatService.AGENT_PREFIX]);
            const startsWithSlashCommand = e.text.startsWith(VoiceChatService.PHRASES_UPPER[VoiceChatService.COMMAND_PREFIX]) || e.text.startsWith(VoiceChatService.PHRASES_LOWER[VoiceChatService.COMMAND_PREFIX]);
            if (startsWithAgent || startsWithSlashCommand) {
              const originalWords = e.text.split(" ");
              let transformedWords;
              let waitingForInput = false;
              if (options.usesAgents && startsWithAgent && !detectedAgent && !detectedSlashCommand && originalWords.length >= 4) {
                const phrase = phrases.get(originalWords.slice(0, 4).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(phrase, 3 /* AGENT_AND_COMMAND */), ...originalWords.slice(4)];
                  waitingForInput = originalWords.length === 4;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedAgent = true;
                    detectedSlashCommand = true;
                  }
                }
              }
              if (options.usesAgents && startsWithAgent && !detectedAgent && !transformedWords && originalWords.length >= 2) {
                const phrase = phrases.get(originalWords.slice(0, 2).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(phrase, 1 /* AGENT */), ...originalWords.slice(2)];
                  waitingForInput = originalWords.length === 2;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedAgent = true;
                  }
                }
              }
              if (startsWithSlashCommand && !detectedSlashCommand && !transformedWords && originalWords.length >= 2) {
                const phrase = phrases.get(originalWords.slice(0, 2).map((word) => this.normalizeWord(word)).join(" "));
                if (phrase) {
                  transformedWords = [this.toText(
                    phrase,
                    options.usesAgents && !detectedAgent ? 3 /* AGENT_AND_COMMAND */ : (
                      // rewrite `/fix` to `@workspace /foo` in this case
                      2 /* COMMAND */
                    )
                    // when we have not yet detected an agent before
                  ), ...originalWords.slice(2)];
                  waitingForInput = originalWords.length === 2;
                  if (e.status === SpeechToTextStatus.Recognized) {
                    detectedSlashCommand = true;
                  }
                }
              }
              massagedEvent = {
                status: e.status,
                text: (transformedWords ?? originalWords).join(" "),
                waitingForInput
              };
            }
          }
          emitter.fire(massagedEvent);
          break;
        }
        case SpeechToTextStatus.Started:
          this.activeVoiceChatSessions++;
          this.voiceChatInProgress.set(true);
          emitter.fire(e);
          break;
        case SpeechToTextStatus.Stopped:
          onSessionStoppedOrCanceled(false);
          emitter.fire(e);
          break;
        case SpeechToTextStatus.Error:
          emitter.fire(e);
          break;
      }
    }));
    return {
      onDidChange: emitter.event
    };
  }
  normalizeWord(word) {
    word = rtrim(word, ".");
    word = rtrim(word, ",");
    word = rtrim(word, "?");
    return word.toLowerCase();
  }
};
VoiceChatService.AGENT_PREFIX = chatAgentLeader;
VoiceChatService.COMMAND_PREFIX = chatSubcommandLeader;
VoiceChatService.PHRASES_LOWER = {
  [VoiceChatService.AGENT_PREFIX]: "at",
  [VoiceChatService.COMMAND_PREFIX]: "slash"
};
VoiceChatService.PHRASES_UPPER = {
  [VoiceChatService.AGENT_PREFIX]: "At",
  [VoiceChatService.COMMAND_PREFIX]: "Slash"
};
VoiceChatService.CHAT_AGENT_ALIAS = /* @__PURE__ */ new Map([["vscode", "code"]]);
VoiceChatService = __decorateClass([
  __decorateParam(0, ISpeechService),
  __decorateParam(1, IChatAgentService),
  __decorateParam(2, IContextKeyService)
], VoiceChatService);
export {
  IVoiceChatService,
  VoiceChatInProgress,
  VoiceChatService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi92b2ljZUNoYXRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9jYW5jZWxsYXRpb24uanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBEaXNwb3NhYmxlLCBEaXNwb3NhYmxlU3RvcmUgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9saWZlY3ljbGUuanMnO1xuaW1wb3J0IHsgcnRyaW0gfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9zdHJpbmdzLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UsIFJhd0NvbnRleHRLZXkgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IGNyZWF0ZURlY29yYXRvciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2luc3RhbnRpYXRpb24vY29tbW9uL2luc3RhbnRpYXRpb24uanMnO1xuaW1wb3J0IHsgSUNoYXRBZ2VudFNlcnZpY2UgfSBmcm9tICcuL2NoYXRBZ2VudHMuanMnO1xuaW1wb3J0IHsgSUNoYXRNb2RlbCB9IGZyb20gJy4vY2hhdE1vZGVsLmpzJztcbmltcG9ydCB7IGNoYXRBZ2VudExlYWRlciwgY2hhdFN1YmNvbW1hbmRMZWFkZXIgfSBmcm9tICcuL2NoYXRQYXJzZXJUeXBlcy5qcyc7XG5pbXBvcnQgeyBJU3BlZWNoU2VydmljZSwgSVNwZWVjaFRvVGV4dEV2ZW50LCBTcGVlY2hUb1RleHRTdGF0dXMgfSBmcm9tICcuLi8uLi9zcGVlY2gvY29tbW9uL3NwZWVjaFNlcnZpY2UuanMnO1xuXG5leHBvcnQgY29uc3QgSVZvaWNlQ2hhdFNlcnZpY2UgPSBjcmVhdGVEZWNvcmF0b3I8SVZvaWNlQ2hhdFNlcnZpY2U+KCd2b2ljZUNoYXRTZXJ2aWNlJyk7XG5cbmV4cG9ydCBpbnRlcmZhY2UgSVZvaWNlQ2hhdFNlc3Npb25PcHRpb25zIHtcblx0cmVhZG9ubHkgdXNlc0FnZW50cz86IGJvb2xlYW47XG5cdHJlYWRvbmx5IG1vZGVsPzogSUNoYXRNb2RlbDtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVm9pY2VDaGF0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdC8qKlxuXHQgKiBTaW1pbGFyIHRvIGBJU3BlZWNoU2VydmljZS5jcmVhdGVTcGVlY2hUb1RleHRTZXNzaW9uYCwgYnV0IHdpdGhcblx0ICogc3VwcG9ydCBmb3IgYWdlbnQgcHJlZml4ZXMgYW5kIGNvbW1hbmQgcHJlZml4ZXMuIEZvciBleGFtcGxlLFxuXHQgKiBpZiB0aGUgdXNlciBzYXlzIFwiYXQgd29ya3NwYWNlIHNsYXNoIGZpeCB0aGlzIHByb2JsZW1cIiwgdGhlIHJlc3VsdFxuXHQgKiB3aWxsIGJlIFwiQHdvcmtzcGFjZSAvZml4IHRoaXMgcHJvYmxlbVwiLlxuXHQgKi9cblx0Y3JlYXRlVm9pY2VDaGF0U2Vzc2lvbih0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4sIG9wdGlvbnM6IElWb2ljZUNoYXRTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8SVZvaWNlQ2hhdFNlc3Npb24+O1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIElWb2ljZUNoYXRUZXh0RXZlbnQgZXh0ZW5kcyBJU3BlZWNoVG9UZXh0RXZlbnQge1xuXG5cdC8qKlxuXHQgKiBUaGlzIHByb3BlcnR5IHdpbGwgYmUgYHRydWVgIHdoZW4gdGhlIHRleHQgcmVjb2duaXplZFxuXHQgKiBzbyBmYXIgb25seSBjb25zaXN0cyBvZiBhZ2VudCBwcmVmaXhlcyAoYEB3b3Jrc3BhY2VgKVxuXHQgKiBhbmQvb3IgY29tbWFuZCBwcmVmaXhlcyAoYEB3b3Jrc3BhY2UgL2ZpeGApLlxuXHQgKi9cblx0cmVhZG9ubHkgd2FpdGluZ0ZvcklucHV0PzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJVm9pY2VDaGF0U2Vzc2lvbiB7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlOiBFdmVudDxJVm9pY2VDaGF0VGV4dEV2ZW50Pjtcbn1cblxuaW50ZXJmYWNlIElQaHJhc2VWYWx1ZSB7XG5cdHJlYWRvbmx5IGFnZW50OiBzdHJpbmc7XG5cdHJlYWRvbmx5IGNvbW1hbmQ/OiBzdHJpbmc7XG59XG5cbmVudW0gUGhyYXNlVGV4dFR5cGUge1xuXHRBR0VOVCA9IDEsXG5cdENPTU1BTkQgPSAyLFxuXHRBR0VOVF9BTkRfQ09NTUFORCA9IDNcbn1cblxuZXhwb3J0IGNvbnN0IFZvaWNlQ2hhdEluUHJvZ3Jlc3MgPSBuZXcgUmF3Q29udGV4dEtleTxib29sZWFuPigndm9pY2VDaGF0SW5Qcm9ncmVzcycsIGZhbHNlLCB7IHR5cGU6ICdib29sZWFuJywgZGVzY3JpcHRpb246IGxvY2FsaXplKCd2b2ljZUNoYXRJblByb2dyZXNzJywgXCJBIHNwZWVjaC10by10ZXh0IHNlc3Npb24gaXMgaW4gcHJvZ3Jlc3MgZm9yIGNoYXQuXCIpIH0pO1xuXG5leHBvcnQgY2xhc3MgVm9pY2VDaGF0U2VydmljZSBleHRlbmRzIERpc3Bvc2FibGUgaW1wbGVtZW50cyBJVm9pY2VDaGF0U2VydmljZSB7XG5cblx0cmVhZG9ubHkgX3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IEFHRU5UX1BSRUZJWCA9IGNoYXRBZ2VudExlYWRlcjtcblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgQ09NTUFORF9QUkVGSVggPSBjaGF0U3ViY29tbWFuZExlYWRlcjtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBQSFJBU0VTX0xPV0VSID0ge1xuXHRcdFt0aGlzLkFHRU5UX1BSRUZJWF06ICdhdCcsXG5cdFx0W3RoaXMuQ09NTUFORF9QUkVGSVhdOiAnc2xhc2gnXG5cdH07XG5cblx0cHJpdmF0ZSBzdGF0aWMgcmVhZG9ubHkgUEhSQVNFU19VUFBFUiA9IHtcblx0XHRbdGhpcy5BR0VOVF9QUkVGSVhdOiAnQXQnLFxuXHRcdFt0aGlzLkNPTU1BTkRfUFJFRklYXTogJ1NsYXNoJ1xuXHR9O1xuXG5cdHByaXZhdGUgc3RhdGljIHJlYWRvbmx5IENIQVRfQUdFTlRfQUxJQVMgPSBuZXcgTWFwPHN0cmluZywgc3RyaW5nPihbWyd2c2NvZGUnLCAnY29kZSddXSk7XG5cblx0cHJpdmF0ZSByZWFkb25seSB2b2ljZUNoYXRJblByb2dyZXNzOiBJQ29udGV4dEtleTxib29sZWFuPjtcblx0cHJpdmF0ZSBhY3RpdmVWb2ljZUNoYXRTZXNzaW9ucyA9IDA7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElTcGVlY2hTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgc3BlZWNoU2VydmljZTogSVNwZWVjaFNlcnZpY2UsXG5cdFx0QElDaGF0QWdlbnRTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY2hhdEFnZW50U2VydmljZTogSUNoYXRBZ2VudFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBjb250ZXh0S2V5U2VydmljZTogSUNvbnRleHRLZXlTZXJ2aWNlXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnZvaWNlQ2hhdEluUHJvZ3Jlc3MgPSBWb2ljZUNoYXRJblByb2dyZXNzLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdH1cblxuXHRwcml2YXRlIGNyZWF0ZVBocmFzZXMobW9kZWw/OiBJQ2hhdE1vZGVsKTogTWFwPHN0cmluZywgSVBocmFzZVZhbHVlPiB7XG5cdFx0Y29uc3QgcGhyYXNlcyA9IG5ldyBNYXA8c3RyaW5nLCBJUGhyYXNlVmFsdWU+KCk7XG5cblx0XHRmb3IgKGNvbnN0IGFnZW50IG9mIHRoaXMuY2hhdEFnZW50U2VydmljZS5nZXRBY3RpdmF0ZWRBZ2VudHMoKSkge1xuXHRcdFx0Y29uc3QgYWdlbnRQaHJhc2UgPSBgJHtWb2ljZUNoYXRTZXJ2aWNlLlBIUkFTRVNfTE9XRVJbVm9pY2VDaGF0U2VydmljZS5BR0VOVF9QUkVGSVhdfSAke1ZvaWNlQ2hhdFNlcnZpY2UuQ0hBVF9BR0VOVF9BTElBUy5nZXQoYWdlbnQubmFtZSkgPz8gYWdlbnQubmFtZX1gLnRvTG93ZXJDYXNlKCk7XG5cdFx0XHRwaHJhc2VzLnNldChhZ2VudFBocmFzZSwgeyBhZ2VudDogYWdlbnQubmFtZSB9KTtcblxuXHRcdFx0Zm9yIChjb25zdCBzbGFzaENvbW1hbmQgb2YgYWdlbnQuc2xhc2hDb21tYW5kcykge1xuXHRcdFx0XHRjb25zdCBzbGFzaENvbW1hbmRQaHJhc2UgPSBgJHtWb2ljZUNoYXRTZXJ2aWNlLlBIUkFTRVNfTE9XRVJbVm9pY2VDaGF0U2VydmljZS5DT01NQU5EX1BSRUZJWF19ICR7c2xhc2hDb21tYW5kLm5hbWV9YC50b0xvd2VyQ2FzZSgpO1xuXHRcdFx0XHRwaHJhc2VzLnNldChzbGFzaENvbW1hbmRQaHJhc2UsIHsgYWdlbnQ6IGFnZW50Lm5hbWUsIGNvbW1hbmQ6IHNsYXNoQ29tbWFuZC5uYW1lIH0pO1xuXG5cdFx0XHRcdGNvbnN0IGFnZW50U2xhc2hDb21tYW5kUGhyYXNlID0gYCR7YWdlbnRQaHJhc2V9ICR7c2xhc2hDb21tYW5kUGhyYXNlfWAudG9Mb3dlckNhc2UoKTtcblx0XHRcdFx0cGhyYXNlcy5zZXQoYWdlbnRTbGFzaENvbW1hbmRQaHJhc2UsIHsgYWdlbnQ6IGFnZW50Lm5hbWUsIGNvbW1hbmQ6IHNsYXNoQ29tbWFuZC5uYW1lIH0pO1xuXHRcdFx0fVxuXHRcdH1cblxuXHRcdHJldHVybiBwaHJhc2VzO1xuXHR9XG5cblx0cHJpdmF0ZSB0b1RleHQodmFsdWU6IElQaHJhc2VWYWx1ZSwgdHlwZTogUGhyYXNlVGV4dFR5cGUpOiBzdHJpbmcge1xuXHRcdHN3aXRjaCAodHlwZSkge1xuXHRcdFx0Y2FzZSBQaHJhc2VUZXh0VHlwZS5BR0VOVDpcblx0XHRcdFx0cmV0dXJuIGAke1ZvaWNlQ2hhdFNlcnZpY2UuQUdFTlRfUFJFRklYfSR7dmFsdWUuYWdlbnR9YDtcblx0XHRcdGNhc2UgUGhyYXNlVGV4dFR5cGUuQ09NTUFORDpcblx0XHRcdFx0cmV0dXJuIGAke1ZvaWNlQ2hhdFNlcnZpY2UuQ09NTUFORF9QUkVGSVh9JHt2YWx1ZS5jb21tYW5kfWA7XG5cdFx0XHRjYXNlIFBocmFzZVRleHRUeXBlLkFHRU5UX0FORF9DT01NQU5EOlxuXHRcdFx0XHRyZXR1cm4gYCR7Vm9pY2VDaGF0U2VydmljZS5BR0VOVF9QUkVGSVh9JHt2YWx1ZS5hZ2VudH0gJHtWb2ljZUNoYXRTZXJ2aWNlLkNPTU1BTkRfUFJFRklYfSR7dmFsdWUuY29tbWFuZH1gO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIGNyZWF0ZVZvaWNlQ2hhdFNlc3Npb24odG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBvcHRpb25zOiBJVm9pY2VDaGF0U2Vzc2lvbk9wdGlvbnMpOiBQcm9taXNlPElWb2ljZUNoYXRTZXNzaW9uPiB7XG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCA9IChkaXNwb3NlOiBib29sZWFuKSA9PiB7XG5cdFx0XHR0aGlzLmFjdGl2ZVZvaWNlQ2hhdFNlc3Npb25zID0gTWF0aC5tYXgoMCwgdGhpcy5hY3RpdmVWb2ljZUNoYXRTZXNzaW9ucyAtIDEpO1xuXHRcdFx0aWYgKHRoaXMuYWN0aXZlVm9pY2VDaGF0U2Vzc2lvbnMgPT09IDApIHtcblx0XHRcdFx0dGhpcy52b2ljZUNoYXRJblByb2dyZXNzLnJlc2V0KCk7XG5cdFx0XHR9XG5cblx0XHRcdGlmIChkaXNwb3NlKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKHRydWUpKSk7XG5cblx0XHRsZXQgZGV0ZWN0ZWRBZ2VudCA9IGZhbHNlO1xuXHRcdGxldCBkZXRlY3RlZFNsYXNoQ29tbWFuZCA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgZW1pdHRlciA9IGRpc3Bvc2FibGVzLmFkZChuZXcgRW1pdHRlcjxJVm9pY2VDaGF0VGV4dEV2ZW50PigpKTtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5zcGVlY2hTZXJ2aWNlLmNyZWF0ZVNwZWVjaFRvVGV4dFNlc3Npb24odG9rZW4sICdjaGF0Jyk7XG5cblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKHRydWUpO1xuXHRcdH1cblxuXHRcdGNvbnN0IHBocmFzZXMgPSB0aGlzLmNyZWF0ZVBocmFzZXMob3B0aW9ucy5tb2RlbCk7XG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24ub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRzd2l0Y2ggKGUuc3RhdHVzKSB7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlJlY29nbml6aW5nOlxuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkOiB7XG5cdFx0XHRcdFx0bGV0IG1hc3NhZ2VkRXZlbnQ6IElWb2ljZUNoYXRUZXh0RXZlbnQgPSBlO1xuXHRcdFx0XHRcdGlmIChlLnRleHQpIHtcblx0XHRcdFx0XHRcdGNvbnN0IHN0YXJ0c1dpdGhBZ2VudCA9IGUudGV4dC5zdGFydHNXaXRoKFZvaWNlQ2hhdFNlcnZpY2UuUEhSQVNFU19VUFBFUltWb2ljZUNoYXRTZXJ2aWNlLkFHRU5UX1BSRUZJWF0pIHx8IGUudGV4dC5zdGFydHNXaXRoKFZvaWNlQ2hhdFNlcnZpY2UuUEhSQVNFU19MT1dFUltWb2ljZUNoYXRTZXJ2aWNlLkFHRU5UX1BSRUZJWF0pO1xuXHRcdFx0XHRcdFx0Y29uc3Qgc3RhcnRzV2l0aFNsYXNoQ29tbWFuZCA9IGUudGV4dC5zdGFydHNXaXRoKFZvaWNlQ2hhdFNlcnZpY2UuUEhSQVNFU19VUFBFUltWb2ljZUNoYXRTZXJ2aWNlLkNPTU1BTkRfUFJFRklYXSkgfHwgZS50ZXh0LnN0YXJ0c1dpdGgoVm9pY2VDaGF0U2VydmljZS5QSFJBU0VTX0xPV0VSW1ZvaWNlQ2hhdFNlcnZpY2UuQ09NTUFORF9QUkVGSVhdKTtcblx0XHRcdFx0XHRcdGlmIChzdGFydHNXaXRoQWdlbnQgfHwgc3RhcnRzV2l0aFNsYXNoQ29tbWFuZCkge1xuXHRcdFx0XHRcdFx0XHRjb25zdCBvcmlnaW5hbFdvcmRzID0gZS50ZXh0LnNwbGl0KCcgJyk7XG5cdFx0XHRcdFx0XHRcdGxldCB0cmFuc2Zvcm1lZFdvcmRzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZDtcblxuXHRcdFx0XHRcdFx0XHRsZXQgd2FpdGluZ0ZvcklucHV0ID0gZmFsc2U7XG5cblx0XHRcdFx0XHRcdFx0Ly8gQ2hlY2sgZm9yIGFnZW50ICsgc2xhc2ggY29tbWFuZFxuXHRcdFx0XHRcdFx0XHRpZiAob3B0aW9ucy51c2VzQWdlbnRzICYmIHN0YXJ0c1dpdGhBZ2VudCAmJiAhZGV0ZWN0ZWRBZ2VudCAmJiAhZGV0ZWN0ZWRTbGFzaENvbW1hbmQgJiYgb3JpZ2luYWxXb3Jkcy5sZW5ndGggPj0gNCkge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHBocmFzZSA9IHBocmFzZXMuZ2V0KG9yaWdpbmFsV29yZHMuc2xpY2UoMCwgNCkubWFwKHdvcmQgPT4gdGhpcy5ub3JtYWxpemVXb3JkKHdvcmQpKS5qb2luKCcgJykpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChwaHJhc2UpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybWVkV29yZHMgPSBbdGhpcy50b1RleHQocGhyYXNlLCBQaHJhc2VUZXh0VHlwZS5BR0VOVF9BTkRfQ09NTUFORCksIC4uLm9yaWdpbmFsV29yZHMuc2xpY2UoNCldO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHR3YWl0aW5nRm9ySW5wdXQgPSBvcmlnaW5hbFdvcmRzLmxlbmd0aCA9PT0gNDtcblxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGUuc3RhdHVzID09PSBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXRlY3RlZEFnZW50ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdFx0ZGV0ZWN0ZWRTbGFzaENvbW1hbmQgPSB0cnVlO1xuXHRcdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0fVxuXG5cdFx0XHRcdFx0XHRcdC8vIENoZWNrIGZvciBhZ2VudCAoaWYgbm90IGRvbmUgYWxyZWFkeSlcblx0XHRcdFx0XHRcdFx0aWYgKG9wdGlvbnMudXNlc0FnZW50cyAmJiBzdGFydHNXaXRoQWdlbnQgJiYgIWRldGVjdGVkQWdlbnQgJiYgIXRyYW5zZm9ybWVkV29yZHMgJiYgb3JpZ2luYWxXb3Jkcy5sZW5ndGggPj0gMikge1xuXHRcdFx0XHRcdFx0XHRcdGNvbnN0IHBocmFzZSA9IHBocmFzZXMuZ2V0KG9yaWdpbmFsV29yZHMuc2xpY2UoMCwgMikubWFwKHdvcmQgPT4gdGhpcy5ub3JtYWxpemVXb3JkKHdvcmQpKS5qb2luKCcgJykpO1xuXHRcdFx0XHRcdFx0XHRcdGlmIChwaHJhc2UpIHtcblx0XHRcdFx0XHRcdFx0XHRcdHRyYW5zZm9ybWVkV29yZHMgPSBbdGhpcy50b1RleHQocGhyYXNlLCBQaHJhc2VUZXh0VHlwZS5BR0VOVCksIC4uLm9yaWdpbmFsV29yZHMuc2xpY2UoMildO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHR3YWl0aW5nRm9ySW5wdXQgPSBvcmlnaW5hbFdvcmRzLmxlbmd0aCA9PT0gMjtcblxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGUuc3RhdHVzID09PSBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXRlY3RlZEFnZW50ID0gdHJ1ZTtcblx0XHRcdFx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdH1cblxuXHRcdFx0XHRcdFx0XHQvLyBDaGVjayBmb3Igc2xhc2ggY29tbWFuZCAoaWYgbm90IGRvbmUgYWxyZWFkeSlcblx0XHRcdFx0XHRcdFx0aWYgKHN0YXJ0c1dpdGhTbGFzaENvbW1hbmQgJiYgIWRldGVjdGVkU2xhc2hDb21tYW5kICYmICF0cmFuc2Zvcm1lZFdvcmRzICYmIG9yaWdpbmFsV29yZHMubGVuZ3RoID49IDIpIHtcblx0XHRcdFx0XHRcdFx0XHRjb25zdCBwaHJhc2UgPSBwaHJhc2VzLmdldChvcmlnaW5hbFdvcmRzLnNsaWNlKDAsIDIpLm1hcCh3b3JkID0+IHRoaXMubm9ybWFsaXplV29yZCh3b3JkKSkuam9pbignICcpKTtcblx0XHRcdFx0XHRcdFx0XHRpZiAocGhyYXNlKSB7XG5cdFx0XHRcdFx0XHRcdFx0XHR0cmFuc2Zvcm1lZFdvcmRzID0gW3RoaXMudG9UZXh0KHBocmFzZSwgb3B0aW9ucy51c2VzQWdlbnRzICYmICFkZXRlY3RlZEFnZW50ID9cblx0XHRcdFx0XHRcdFx0XHRcdFx0UGhyYXNlVGV4dFR5cGUuQUdFTlRfQU5EX0NPTU1BTkQgOiBcdC8vIHJld3JpdGUgYC9maXhgIHRvIGBAd29ya3NwYWNlIC9mb29gIGluIHRoaXMgY2FzZVxuXHRcdFx0XHRcdFx0XHRcdFx0XHRQaHJhc2VUZXh0VHlwZS5DT01NQU5EXHRcdFx0XHQvLyB3aGVuIHdlIGhhdmUgbm90IHlldCBkZXRlY3RlZCBhbiBhZ2VudCBiZWZvcmVcblx0XHRcdFx0XHRcdFx0XHRcdCksIC4uLm9yaWdpbmFsV29yZHMuc2xpY2UoMildO1xuXG5cdFx0XHRcdFx0XHRcdFx0XHR3YWl0aW5nRm9ySW5wdXQgPSBvcmlnaW5hbFdvcmRzLmxlbmd0aCA9PT0gMjtcblxuXHRcdFx0XHRcdFx0XHRcdFx0aWYgKGUuc3RhdHVzID09PSBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXplZCkge1xuXHRcdFx0XHRcdFx0XHRcdFx0XHRkZXRlY3RlZFNsYXNoQ29tbWFuZCA9IHRydWU7XG5cdFx0XHRcdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0XHRcdFx0fVxuXHRcdFx0XHRcdFx0XHR9XG5cblx0XHRcdFx0XHRcdFx0bWFzc2FnZWRFdmVudCA9IHtcblx0XHRcdFx0XHRcdFx0XHRzdGF0dXM6IGUuc3RhdHVzLFxuXHRcdFx0XHRcdFx0XHRcdHRleHQ6ICh0cmFuc2Zvcm1lZFdvcmRzID8/IG9yaWdpbmFsV29yZHMpLmpvaW4oJyAnKSxcblx0XHRcdFx0XHRcdFx0XHR3YWl0aW5nRm9ySW5wdXRcblx0XHRcdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRcdH1cblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0ZW1pdHRlci5maXJlKG1hc3NhZ2VkRXZlbnQpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHR9XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlN0YXJ0ZWQ6XG5cdFx0XHRcdFx0dGhpcy5hY3RpdmVWb2ljZUNoYXRTZXNzaW9ucysrO1xuXHRcdFx0XHRcdHRoaXMudm9pY2VDaGF0SW5Qcm9ncmVzcy5zZXQodHJ1ZSk7XG5cdFx0XHRcdFx0ZW1pdHRlci5maXJlKGUpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5TdG9wcGVkOlxuXHRcdFx0XHRcdG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKGZhbHNlKTtcblx0XHRcdFx0XHRlbWl0dGVyLmZpcmUoZSk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLkVycm9yOlxuXHRcdFx0XHRcdGVtaXR0ZXIuZmlyZShlKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4ge1xuXHRcdFx0b25EaWRDaGFuZ2U6IGVtaXR0ZXIuZXZlbnRcblx0XHR9O1xuXHR9XG5cblx0cHJpdmF0ZSBub3JtYWxpemVXb3JkKHdvcmQ6IHN0cmluZyk6IHN0cmluZyB7XG5cdFx0d29yZCA9IHJ0cmltKHdvcmQsICcuJyk7XG5cdFx0d29yZCA9IHJ0cmltKHdvcmQsICcsJyk7XG5cdFx0d29yZCA9IHJ0cmltKHdvcmQsICc/Jyk7XG5cblx0XHRyZXR1cm4gd29yZC50b0xvd2VyQ2FzZSgpO1xuXHR9XG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBRXpCLFNBQVMsZUFBc0I7QUFDL0IsU0FBUyxZQUFZLHVCQUF1QjtBQUM1QyxTQUFTLGFBQWE7QUFDdEIsU0FBc0Isb0JBQW9CLHFCQUFxQjtBQUMvRCxTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLHlCQUF5QjtBQUVsQyxTQUFTLGlCQUFpQiw0QkFBNEI7QUFDdEQsU0FBUyxnQkFBb0MsMEJBQTBCO0FBRWhFLE1BQU0sb0JBQW9CLGdCQUFtQyxrQkFBa0I7QUF1Q3RGLElBQUssaUJBQUwsa0JBQUtBLG9CQUFMO0FBQ0MsRUFBQUEsZ0NBQUEsV0FBUSxLQUFSO0FBQ0EsRUFBQUEsZ0NBQUEsYUFB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
