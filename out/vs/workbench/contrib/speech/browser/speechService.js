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
import { CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Disposable, DisposableStore, toDisposable } from "../../../../base/common/lifecycle.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IHostService } from "../../../services/host/browser/host.js";
import { DeferredPromise } from "../../../../base/common/async.js";
import { HasSpeechProvider, SpeechToTextInProgress, KeywordRecognitionStatus, SpeechToTextStatus, speechLanguageConfigToLanguage, SPEECH_LANGUAGE_CONFIG, TextToSpeechInProgress, TextToSpeechStatus } from "../common/speechService.js";
import { ITelemetryService } from "../../../../platform/telemetry/common/telemetry.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { ExtensionsRegistry } from "../../../services/extensions/common/extensionsRegistry.js";
import { IExtensionService } from "../../../services/extensions/common/extensions.js";
const speechProvidersExtensionPoint = ExtensionsRegistry.registerExtensionPoint({
  extensionPoint: "speechProviders",
  jsonSchema: {
    description: localize("vscode.extension.contributes.speechProvider", "Contributes a Speech Provider"),
    type: "array",
    items: {
      additionalProperties: false,
      type: "object",
      defaultSnippets: [{ body: { name: "", description: "" } }],
      required: ["name"],
      properties: {
        name: {
          description: localize("speechProviderName", "Unique name for this Speech Provider."),
          type: "string"
        },
        description: {
          description: localize("speechProviderDescription", "A description of this Speech Provider, shown in the UI."),
          type: "string"
        }
      }
    }
  }
});
let SpeechService = class extends Disposable {
  constructor(logService, contextKeyService, hostService, telemetryService, configurationService, extensionService) {
    super();
    this.logService = logService;
    this.hostService = hostService;
    this.telemetryService = telemetryService;
    this.configurationService = configurationService;
    this.extensionService = extensionService;
    this._onDidChangeHasSpeechProvider = this._register(new Emitter());
    this.onDidChangeHasSpeechProvider = this._onDidChangeHasSpeechProvider.event;
    this.providers = /* @__PURE__ */ new Map();
    this.providerDescriptors = /* @__PURE__ */ new Map();
    //#region Speech to Text
    this._onDidStartSpeechToTextSession = this._register(new Emitter());
    this.onDidStartSpeechToTextSession = this._onDidStartSpeechToTextSession.event;
    this._onDidEndSpeechToTextSession = this._register(new Emitter());
    this.onDidEndSpeechToTextSession = this._onDidEndSpeechToTextSession.event;
    this.activeSpeechToTextSessions = 0;
    //#endregion
    //#region Text to Speech
    this._onDidStartTextToSpeechSession = this._register(new Emitter());
    this.onDidStartTextToSpeechSession = this._onDidStartTextToSpeechSession.event;
    this._onDidEndTextToSpeechSession = this._register(new Emitter());
    this.onDidEndTextToSpeechSession = this._onDidEndTextToSpeechSession.event;
    this.activeTextToSpeechSessions = 0;
    //#endregion
    //#region Keyword Recognition
    this._onDidStartKeywordRecognition = this._register(new Emitter());
    this.onDidStartKeywordRecognition = this._onDidStartKeywordRecognition.event;
    this._onDidEndKeywordRecognition = this._register(new Emitter());
    this.onDidEndKeywordRecognition = this._onDidEndKeywordRecognition.event;
    this.activeKeywordRecognitionSessions = 0;
    this.hasSpeechProviderContext = HasSpeechProvider.bindTo(contextKeyService);
    this.textToSpeechInProgress = TextToSpeechInProgress.bindTo(contextKeyService);
    this.speechToTextInProgress = SpeechToTextInProgress.bindTo(contextKeyService);
    this.handleAndRegisterSpeechExtensions();
  }
  get hasSpeechProvider() {
    return this.providerDescriptors.size > 0 || this.providers.size > 0;
  }
  handleAndRegisterSpeechExtensions() {
    speechProvidersExtensionPoint.setHandler((extensions, delta) => {
      const oldHasSpeechProvider = this.hasSpeechProvider;
      for (const extension of delta.removed) {
        for (const descriptor of extension.value) {
          this.providerDescriptors.delete(descriptor.name);
        }
      }
      for (const extension of delta.added) {
        for (const descriptor of extension.value) {
          this.providerDescriptors.set(descriptor.name, descriptor);
        }
      }
      if (oldHasSpeechProvider !== this.hasSpeechProvider) {
        this.handleHasSpeechProviderChange();
      }
    });
  }
  registerSpeechProvider(identifier, provider) {
    if (this.providers.has(identifier)) {
      throw new Error(`Speech provider with identifier ${identifier} is already registered.`);
    }
    const oldHasSpeechProvider = this.hasSpeechProvider;
    this.providers.set(identifier, provider);
    if (oldHasSpeechProvider !== this.hasSpeechProvider) {
      this.handleHasSpeechProviderChange();
    }
    return toDisposable(() => {
      const oldHasSpeechProvider2 = this.hasSpeechProvider;
      this.providers.delete(identifier);
      if (oldHasSpeechProvider2 !== this.hasSpeechProvider) {
        this.handleHasSpeechProviderChange();
      }
    });
  }
  handleHasSpeechProviderChange() {
    this.hasSpeechProviderContext.set(this.hasSpeechProvider);
    this._onDidChangeHasSpeechProvider.fire();
  }
  get hasActiveSpeechToTextSession() {
    return this.activeSpeechToTextSessions > 0;
  }
  async createSpeechToTextSession(token, context = "speech") {
    const provider = await this.getProvider();
    const language = speechLanguageConfigToLanguage(this.configurationService.getValue(SPEECH_LANGUAGE_CONFIG));
    const session = provider.createSpeechToTextSession(token, typeof language === "string" ? { language } : void 0);
    const sessionStart = Date.now();
    let sessionRecognized = false;
    let sessionError = false;
    let sessionContentLength = 0;
    const disposables = new DisposableStore();
    const onSessionStoppedOrCanceled = () => {
      this.activeSpeechToTextSessions = Math.max(0, this.activeSpeechToTextSessions - 1);
      if (!this.hasActiveSpeechToTextSession) {
        this.speechToTextInProgress.reset();
      }
      this._onDidEndSpeechToTextSession.fire();
      this.telemetryService.publicLog2("speechToTextSession", {
        context,
        sessionDuration: Date.now() - sessionStart,
        sessionRecognized,
        sessionError,
        sessionContentLength,
        sessionLanguage: language
      });
      disposables.dispose();
    };
    disposables.add(token.onCancellationRequested(() => onSessionStoppedOrCanceled()));
    if (token.isCancellationRequested) {
      onSessionStoppedOrCanceled();
    }
    disposables.add(session.onDidChange((e) => {
      switch (e.status) {
        case SpeechToTextStatus.Started:
          this.activeSpeechToTextSessions++;
          this.speechToTextInProgress.set(true);
          this._onDidStartSpeechToTextSession.fire();
          break;
        case SpeechToTextStatus.Recognizing:
          sessionRecognized = true;
          break;
        case SpeechToTextStatus.Recognized:
          if (typeof e.text === "string") {
            sessionContentLength += e.text.length;
          }
          break;
        case SpeechToTextStatus.Stopped:
          onSessionStoppedOrCanceled();
          break;
        case SpeechToTextStatus.Error:
          this.logService.error(`Speech provider error in speech to text session: ${e.text}`);
          sessionError = true;
          break;
      }
    }));
    return session;
  }
  async getProvider() {
    await this.extensionService.activateByEvent("onSpeech");
    const provider = Array.from(this.providers.values()).at(0);
    if (!provider) {
      throw new Error(`No Speech provider is registered.`);
    } else if (this.providers.size > 1) {
      this.logService.warn(`Multiple speech providers registered. Picking first one: ${provider.metadata.displayName}`);
    }
    return provider;
  }
  get hasActiveTextToSpeechSession() {
    return this.activeTextToSpeechSessions > 0;
  }
  async createTextToSpeechSession(token, context = "speech") {
    const provider = await this.getProvider();
    const language = speechLanguageConfigToLanguage(this.configurationService.getValue(SPEECH_LANGUAGE_CONFIG));
    const session = provider.createTextToSpeechSession(token, typeof language === "string" ? { language } : void 0);
    const sessionStart = Date.now();
    let sessionError = false;
    const disposables = new DisposableStore();
    const onSessionStoppedOrCanceled = (dispose) => {
      this.activeTextToSpeechSessions = Math.max(0, this.activeTextToSpeechSessions - 1);
      if (!this.hasActiveTextToSpeechSession) {
        this.textToSpeechInProgress.reset();
      }
      this._onDidEndTextToSpeechSession.fire();
      this.telemetryService.publicLog2("textToSpeechSession", {
        context,
        sessionDuration: Date.now() - sessionStart,
        sessionError,
        sessionLanguage: language
      });
      if (dispose) {
        disposables.dispose();
      }
    };
    disposables.add(token.onCancellationRequested(() => onSessionStoppedOrCanceled(true)));
    if (token.isCancellationRequested) {
      onSessionStoppedOrCanceled(true);
    }
    disposables.add(session.onDidChange((e) => {
      switch (e.status) {
        case TextToSpeechStatus.Started:
          this.activeTextToSpeechSessions++;
          this.textToSpeechInProgress.set(true);
          this._onDidStartTextToSpeechSession.fire();
          break;
        case TextToSpeechStatus.Stopped:
          onSessionStoppedOrCanceled(false);
          break;
        case TextToSpeechStatus.Error:
          this.logService.error(`Speech provider error in text to speech session: ${e.text}`);
          sessionError = true;
          break;
      }
    }));
    return session;
  }
  get hasActiveKeywordRecognition() {
    return this.activeKeywordRecognitionSessions > 0;
  }
  async recognizeKeyword(token) {
    const result = new DeferredPromise();
    const disposables = new DisposableStore();
    disposables.add(token.onCancellationRequested(() => {
      disposables.dispose();
      result.complete(KeywordRecognitionStatus.Canceled);
    }));
    const recognizeKeywordDisposables = disposables.add(new DisposableStore());
    let activeRecognizeKeywordSession = void 0;
    const recognizeKeyword = () => {
      recognizeKeywordDisposables.clear();
      const cts = new CancellationTokenSource(token);
      recognizeKeywordDisposables.add(toDisposable(() => cts.dispose(true)));
      const currentRecognizeKeywordSession = activeRecognizeKeywordSession = this.doRecognizeKeyword(cts.token).then((status2) => {
        if (currentRecognizeKeywordSession === activeRecognizeKeywordSession) {
          result.complete(status2);
        }
      }, (error) => {
        if (currentRecognizeKeywordSession === activeRecognizeKeywordSession) {
          result.error(error);
        }
      });
    };
    disposables.add(this.hostService.onDidChangeFocus((focused) => {
      if (!focused && activeRecognizeKeywordSession) {
        recognizeKeywordDisposables.clear();
        activeRecognizeKeywordSession = void 0;
      } else if (!activeRecognizeKeywordSession) {
        recognizeKeyword();
      }
    }));
    if (this.hostService.hasFocus) {
      recognizeKeyword();
    }
    let status;
    try {
      status = await result.p;
    } finally {
      disposables.dispose();
    }
    this.telemetryService.publicLog2("keywordRecognition", {
      keywordRecognized: status === KeywordRecognitionStatus.Recognized
    });
    return status;
  }
  async doRecognizeKeyword(token) {
    const provider = await this.getProvider();
    const session = provider.createKeywordRecognitionSession(token);
    this.activeKeywordRecognitionSessions++;
    this._onDidStartKeywordRecognition.fire();
    const disposables = new DisposableStore();
    const onSessionStoppedOrCanceled = () => {
      this.activeKeywordRecognitionSessions = Math.max(0, this.activeKeywordRecognitionSessions - 1);
      this._onDidEndKeywordRecognition.fire();
      disposables.dispose();
    };
    disposables.add(token.onCancellationRequested(() => onSessionStoppedOrCanceled()));
    if (token.isCancellationRequested) {
      onSessionStoppedOrCanceled();
    }
    disposables.add(session.onDidChange((e) => {
      if (e.status === KeywordRecognitionStatus.Stopped) {
        onSessionStoppedOrCanceled();
      }
    }));
    try {
      return (await Event.toPromise(session.onDidChange)).status;
    } finally {
      onSessionStoppedOrCanceled();
    }
  }
  //#endregion
};
SpeechService = __decorateClass([
  __decorateParam(0, ILogService),
  __decorateParam(1, IContextKeyService),
  __decorateParam(2, IHostService),
  __decorateParam(3, ITelemetryService),
  __decorateParam(4, IConfigurationService),
  __decorateParam(5, IExtensionService)
], SpeechService);
export {
  SpeechService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9zcGVlY2gvYnJvd3Nlci9zcGVlY2hTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZVN0b3JlLCBJRGlzcG9zYWJsZSwgdG9EaXNwb3NhYmxlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcbmltcG9ydCB7IElDb250ZXh0S2V5LCBJQ29udGV4dEtleVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb250ZXh0a2V5L2NvbW1vbi9jb250ZXh0a2V5LmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSUhvc3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvaG9zdC9icm93c2VyL2hvc3QuanMnO1xuaW1wb3J0IHsgRGVmZXJyZWRQcm9taXNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgSVNwZWVjaFNlcnZpY2UsIElTcGVlY2hQcm92aWRlciwgSGFzU3BlZWNoUHJvdmlkZXIsIElTcGVlY2hUb1RleHRTZXNzaW9uLCBTcGVlY2hUb1RleHRJblByb2dyZXNzLCBLZXl3b3JkUmVjb2duaXRpb25TdGF0dXMsIFNwZWVjaFRvVGV4dFN0YXR1cywgc3BlZWNoTGFuZ3VhZ2VDb25maWdUb0xhbmd1YWdlLCBTUEVFQ0hfTEFOR1VBR0VfQ09ORklHLCBJVGV4dFRvU3BlZWNoU2Vzc2lvbiwgVGV4dFRvU3BlZWNoSW5Qcm9ncmVzcywgVGV4dFRvU3BlZWNoU3RhdHVzIH0gZnJvbSAnLi4vY29tbW9uL3NwZWVjaFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgSVRlbGVtZXRyeVNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBJQ29uZmlndXJhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9jb25maWd1cmF0aW9uL2NvbW1vbi9jb25maWd1cmF0aW9uLmpzJztcbmltcG9ydCB7IEV4dGVuc2lvbnNSZWdpc3RyeSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnNSZWdpc3RyeS5qcyc7XG5pbXBvcnQgeyBJRXh0ZW5zaW9uU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuXG5leHBvcnQgaW50ZXJmYWNlIElTcGVlY2hQcm92aWRlckRlc2NyaXB0b3Ige1xuXHRyZWFkb25seSBuYW1lOiBzdHJpbmc7XG5cdHJlYWRvbmx5IGRlc2NyaXB0aW9uPzogc3RyaW5nO1xufVxuXG5jb25zdCBzcGVlY2hQcm92aWRlcnNFeHRlbnNpb25Qb2ludCA9IEV4dGVuc2lvbnNSZWdpc3RyeS5yZWdpc3RlckV4dGVuc2lvblBvaW50PElTcGVlY2hQcm92aWRlckRlc2NyaXB0b3JbXT4oe1xuXHRleHRlbnNpb25Qb2ludDogJ3NwZWVjaFByb3ZpZGVycycsXG5cdGpzb25TY2hlbWE6IHtcblx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3ZzY29kZS5leHRlbnNpb24uY29udHJpYnV0ZXMuc3BlZWNoUHJvdmlkZXInLCAnQ29udHJpYnV0ZXMgYSBTcGVlY2ggUHJvdmlkZXInKSxcblx0XHR0eXBlOiAnYXJyYXknLFxuXHRcdGl0ZW1zOiB7XG5cdFx0XHRhZGRpdGlvbmFsUHJvcGVydGllczogZmFsc2UsXG5cdFx0XHR0eXBlOiAnb2JqZWN0Jyxcblx0XHRcdGRlZmF1bHRTbmlwcGV0czogW3sgYm9keTogeyBuYW1lOiAnJywgZGVzY3JpcHRpb246ICcnIH0gfV0sXG5cdFx0XHRyZXF1aXJlZDogWyduYW1lJ10sXG5cdFx0XHRwcm9wZXJ0aWVzOiB7XG5cdFx0XHRcdG5hbWU6IHtcblx0XHRcdFx0XHRkZXNjcmlwdGlvbjogbG9jYWxpemUoJ3NwZWVjaFByb3ZpZGVyTmFtZScsIFwiVW5pcXVlIG5hbWUgZm9yIHRoaXMgU3BlZWNoIFByb3ZpZGVyLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9LFxuXHRcdFx0XHRkZXNjcmlwdGlvbjoge1xuXHRcdFx0XHRcdGRlc2NyaXB0aW9uOiBsb2NhbGl6ZSgnc3BlZWNoUHJvdmlkZXJEZXNjcmlwdGlvbicsIFwiQSBkZXNjcmlwdGlvbiBvZiB0aGlzIFNwZWVjaCBQcm92aWRlciwgc2hvd24gaW4gdGhlIFVJLlwiKSxcblx0XHRcdFx0XHR0eXBlOiAnc3RyaW5nJ1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cdFx0fVxuXHR9XG59KTtcblxuZXhwb3J0IGNsYXNzIFNwZWVjaFNlcnZpY2UgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSVNwZWVjaFNlcnZpY2Uge1xuXG5cdHJlYWRvbmx5IF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZUhhc1NwZWVjaFByb3ZpZGVyID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlSGFzU3BlZWNoUHJvdmlkZXIgPSB0aGlzLl9vbkRpZENoYW5nZUhhc1NwZWVjaFByb3ZpZGVyLmV2ZW50O1xuXG5cdGdldCBoYXNTcGVlY2hQcm92aWRlcigpIHsgcmV0dXJuIHRoaXMucHJvdmlkZXJEZXNjcmlwdG9ycy5zaXplID4gMCB8fCB0aGlzLnByb3ZpZGVycy5zaXplID4gMDsgfVxuXG5cdHByaXZhdGUgcmVhZG9ubHkgcHJvdmlkZXJzID0gbmV3IE1hcDxzdHJpbmcsIElTcGVlY2hQcm92aWRlcj4oKTtcblx0cHJpdmF0ZSByZWFkb25seSBwcm92aWRlckRlc2NyaXB0b3JzID0gbmV3IE1hcDxzdHJpbmcsIElTcGVlY2hQcm92aWRlckRlc2NyaXB0b3I+KCk7XG5cblx0cHJpdmF0ZSByZWFkb25seSBoYXNTcGVlY2hQcm92aWRlckNvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdGNvbnN0cnVjdG9yKFxuXHRcdEBJTG9nU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGxvZ1NlcnZpY2U6IElMb2dTZXJ2aWNlLFxuXHRcdEBJQ29udGV4dEtleVNlcnZpY2UgY29udGV4dEtleVNlcnZpY2U6IElDb250ZXh0S2V5U2VydmljZSxcblx0XHRASUhvc3RTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgaG9zdFNlcnZpY2U6IElIb3N0U2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASUNvbmZpZ3VyYXRpb25TZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgY29uZmlndXJhdGlvblNlcnZpY2U6IElDb25maWd1cmF0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXG5cdFx0dGhpcy5oYXNTcGVlY2hQcm92aWRlckNvbnRleHQgPSBIYXNTcGVlY2hQcm92aWRlci5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMudGV4dFRvU3BlZWNoSW5Qcm9ncmVzcyA9IFRleHRUb1NwZWVjaEluUHJvZ3Jlc3MuYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLnNwZWVjaFRvVGV4dEluUHJvZ3Jlc3MgPSBTcGVlY2hUb1RleHRJblByb2dyZXNzLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLmhhbmRsZUFuZFJlZ2lzdGVyU3BlZWNoRXh0ZW5zaW9ucygpO1xuXHR9XG5cblx0cHJpdmF0ZSBoYW5kbGVBbmRSZWdpc3RlclNwZWVjaEV4dGVuc2lvbnMoKTogdm9pZCB7XG5cdFx0c3BlZWNoUHJvdmlkZXJzRXh0ZW5zaW9uUG9pbnQuc2V0SGFuZGxlcigoZXh0ZW5zaW9ucywgZGVsdGEpID0+IHtcblx0XHRcdGNvbnN0IG9sZEhhc1NwZWVjaFByb3ZpZGVyID0gdGhpcy5oYXNTcGVlY2hQcm92aWRlcjtcblxuXHRcdFx0Zm9yIChjb25zdCBleHRlbnNpb24gb2YgZGVsdGEucmVtb3ZlZCkge1xuXHRcdFx0XHRmb3IgKGNvbnN0IGRlc2NyaXB0b3Igb2YgZXh0ZW5zaW9uLnZhbHVlKSB7XG5cdFx0XHRcdFx0dGhpcy5wcm92aWRlckRlc2NyaXB0b3JzLmRlbGV0ZShkZXNjcmlwdG9yLm5hbWUpO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGZvciAoY29uc3QgZXh0ZW5zaW9uIG9mIGRlbHRhLmFkZGVkKSB7XG5cdFx0XHRcdGZvciAoY29uc3QgZGVzY3JpcHRvciBvZiBleHRlbnNpb24udmFsdWUpIHtcblx0XHRcdFx0XHR0aGlzLnByb3ZpZGVyRGVzY3JpcHRvcnMuc2V0KGRlc2NyaXB0b3IubmFtZSwgZGVzY3JpcHRvcik7XG5cdFx0XHRcdH1cblx0XHRcdH1cblxuXHRcdFx0aWYgKG9sZEhhc1NwZWVjaFByb3ZpZGVyICE9PSB0aGlzLmhhc1NwZWVjaFByb3ZpZGVyKSB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlSGFzU3BlZWNoUHJvdmlkZXJDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHJlZ2lzdGVyU3BlZWNoUHJvdmlkZXIoaWRlbnRpZmllcjogc3RyaW5nLCBwcm92aWRlcjogSVNwZWVjaFByb3ZpZGVyKTogSURpc3Bvc2FibGUge1xuXHRcdGlmICh0aGlzLnByb3ZpZGVycy5oYXMoaWRlbnRpZmllcikpIHtcblx0XHRcdHRocm93IG5ldyBFcnJvcihgU3BlZWNoIHByb3ZpZGVyIHdpdGggaWRlbnRpZmllciAke2lkZW50aWZpZXJ9IGlzIGFscmVhZHkgcmVnaXN0ZXJlZC5gKTtcblx0XHR9XG5cblx0XHRjb25zdCBvbGRIYXNTcGVlY2hQcm92aWRlciA9IHRoaXMuaGFzU3BlZWNoUHJvdmlkZXI7XG5cblx0XHR0aGlzLnByb3ZpZGVycy5zZXQoaWRlbnRpZmllciwgcHJvdmlkZXIpO1xuXG5cdFx0aWYgKG9sZEhhc1NwZWVjaFByb3ZpZGVyICE9PSB0aGlzLmhhc1NwZWVjaFByb3ZpZGVyKSB7XG5cdFx0XHR0aGlzLmhhbmRsZUhhc1NwZWVjaFByb3ZpZGVyQ2hhbmdlKCk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIHRvRGlzcG9zYWJsZSgoKSA9PiB7XG5cdFx0XHRjb25zdCBvbGRIYXNTcGVlY2hQcm92aWRlciA9IHRoaXMuaGFzU3BlZWNoUHJvdmlkZXI7XG5cblx0XHRcdHRoaXMucHJvdmlkZXJzLmRlbGV0ZShpZGVudGlmaWVyKTtcblxuXHRcdFx0aWYgKG9sZEhhc1NwZWVjaFByb3ZpZGVyICE9PSB0aGlzLmhhc1NwZWVjaFByb3ZpZGVyKSB7XG5cdFx0XHRcdHRoaXMuaGFuZGxlSGFzU3BlZWNoUHJvdmlkZXJDaGFuZ2UoKTtcblx0XHRcdH1cblx0XHR9KTtcblx0fVxuXG5cdHByaXZhdGUgaGFuZGxlSGFzU3BlZWNoUHJvdmlkZXJDaGFuZ2UoKTogdm9pZCB7XG5cdFx0dGhpcy5oYXNTcGVlY2hQcm92aWRlckNvbnRleHQuc2V0KHRoaXMuaGFzU3BlZWNoUHJvdmlkZXIpO1xuXG5cdFx0dGhpcy5fb25EaWRDaGFuZ2VIYXNTcGVlY2hQcm92aWRlci5maXJlKCk7XG5cdH1cblxuXHQvLyNyZWdpb24gU3BlZWNoIHRvIFRleHRcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXJ0U3BlZWNoVG9UZXh0U2Vzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFN0YXJ0U3BlZWNoVG9UZXh0U2Vzc2lvbiA9IHRoaXMuX29uRGlkU3RhcnRTcGVlY2hUb1RleHRTZXNzaW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRW5kU3BlZWNoVG9UZXh0U2Vzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEVuZFNwZWVjaFRvVGV4dFNlc3Npb24gPSB0aGlzLl9vbkRpZEVuZFNwZWVjaFRvVGV4dFNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBhY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9ucyA9IDA7XG5cdGdldCBoYXNBY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9uKCkgeyByZXR1cm4gdGhpcy5hY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9ucyA+IDA7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHNwZWVjaFRvVGV4dEluUHJvZ3Jlc3M6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdGFzeW5jIGNyZWF0ZVNwZWVjaFRvVGV4dFNlc3Npb24odG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBjb250ZXh0OiBzdHJpbmcgPSAnc3BlZWNoJyk6IFByb21pc2U8SVNwZWVjaFRvVGV4dFNlc3Npb24+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMuZ2V0UHJvdmlkZXIoKTtcblxuXHRcdGNvbnN0IGxhbmd1YWdlID0gc3BlZWNoTGFuZ3VhZ2VDb25maWdUb0xhbmd1YWdlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8dW5rbm93bj4oU1BFRUNIX0xBTkdVQUdFX0NPTkZJRykpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBwcm92aWRlci5jcmVhdGVTcGVlY2hUb1RleHRTZXNzaW9uKHRva2VuLCB0eXBlb2YgbGFuZ3VhZ2UgPT09ICdzdHJpbmcnID8geyBsYW5ndWFnZSB9IDogdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IHNlc3Npb25TdGFydCA9IERhdGUubm93KCk7XG5cdFx0bGV0IHNlc3Npb25SZWNvZ25pemVkID0gZmFsc2U7XG5cdFx0bGV0IHNlc3Npb25FcnJvciA9IGZhbHNlO1xuXHRcdGxldCBzZXNzaW9uQ29udGVudExlbmd0aCA9IDA7XG5cblx0XHRjb25zdCBkaXNwb3NhYmxlcyA9IG5ldyBEaXNwb3NhYmxlU3RvcmUoKTtcblxuXHRcdGNvbnN0IG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkID0gKCkgPT4ge1xuXHRcdFx0dGhpcy5hY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9ucyA9IE1hdGgubWF4KDAsIHRoaXMuYWN0aXZlU3BlZWNoVG9UZXh0U2Vzc2lvbnMgLSAxKTtcblx0XHRcdGlmICghdGhpcy5oYXNBY3RpdmVTcGVlY2hUb1RleHRTZXNzaW9uKSB7XG5cdFx0XHRcdHRoaXMuc3BlZWNoVG9UZXh0SW5Qcm9ncmVzcy5yZXNldCgpO1xuXHRcdFx0fVxuXHRcdFx0dGhpcy5fb25EaWRFbmRTcGVlY2hUb1RleHRTZXNzaW9uLmZpcmUoKTtcblxuXHRcdFx0dHlwZSBTcGVlY2hUb1RleHRTZXNzaW9uQ2xhc3NpZmljYXRpb24gPSB7XG5cdFx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRcdGNvbW1lbnQ6ICdBbiBldmVudCB0aGF0IGZpcmVzIHdoZW4gYSBzcGVlY2ggdG8gdGV4dCBzZXNzaW9uIGlzIGNyZWF0ZWQnO1xuXHRcdFx0XHRjb250ZXh0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQ29udGV4dCBvZiB0aGUgc2Vzc2lvbi4nIH07XG5cdFx0XHRcdHNlc3Npb25EdXJhdGlvbjogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0R1cmF0aW9uIG9mIHRoZSBzZXNzaW9uLicgfTtcblx0XHRcdFx0c2Vzc2lvblJlY29nbml6ZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdJZiBzcGVlY2ggd2FzIHJlY29nbml6ZWQuJyB9O1xuXHRcdFx0XHRzZXNzaW9uRXJyb3I6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdJZiBzcGVlY2ggcmVzdWx0ZWQgaW4gZXJyb3IuJyB9O1xuXHRcdFx0XHRzZXNzaW9uQ29udGVudExlbmd0aDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0xlbmd0aCBvZiB0aGUgcmVjb2duaXplZCB0ZXh0LicgfTtcblx0XHRcdFx0c2Vzc2lvbkxhbmd1YWdlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnQ29uZmlndXJlZCBsYW5ndWFnZSBmb3IgdGhlIHNlc3Npb24uJyB9O1xuXHRcdFx0fTtcblx0XHRcdHR5cGUgU3BlZWNoVG9UZXh0U2Vzc2lvbkV2ZW50ID0ge1xuXHRcdFx0XHRjb250ZXh0OiBzdHJpbmc7XG5cdFx0XHRcdHNlc3Npb25EdXJhdGlvbjogbnVtYmVyO1xuXHRcdFx0XHRzZXNzaW9uUmVjb2duaXplZDogYm9vbGVhbjtcblx0XHRcdFx0c2Vzc2lvbkVycm9yOiBib29sZWFuO1xuXHRcdFx0XHRzZXNzaW9uQ29udGVudExlbmd0aDogbnVtYmVyO1xuXHRcdFx0XHRzZXNzaW9uTGFuZ3VhZ2U6IHN0cmluZztcblx0XHRcdH07XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxTcGVlY2hUb1RleHRTZXNzaW9uRXZlbnQsIFNwZWVjaFRvVGV4dFNlc3Npb25DbGFzc2lmaWNhdGlvbj4oJ3NwZWVjaFRvVGV4dFNlc3Npb24nLCB7XG5cdFx0XHRcdGNvbnRleHQsXG5cdFx0XHRcdHNlc3Npb25EdXJhdGlvbjogRGF0ZS5ub3coKSAtIHNlc3Npb25TdGFydCxcblx0XHRcdFx0c2Vzc2lvblJlY29nbml6ZWQsXG5cdFx0XHRcdHNlc3Npb25FcnJvcixcblx0XHRcdFx0c2Vzc2lvbkNvbnRlbnRMZW5ndGgsXG5cdFx0XHRcdHNlc3Npb25MYW5ndWFnZTogbGFuZ3VhZ2Vcblx0XHRcdH0pO1xuXG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fTtcblxuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiBvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCgpKSk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCgpO1xuXHRcdH1cblxuXHRcdGRpc3Bvc2FibGVzLmFkZChzZXNzaW9uLm9uRGlkQ2hhbmdlKGUgPT4ge1xuXHRcdFx0c3dpdGNoIChlLnN0YXR1cykge1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5TdGFydGVkOlxuXHRcdFx0XHRcdHRoaXMuYWN0aXZlU3BlZWNoVG9UZXh0U2Vzc2lvbnMrKztcblx0XHRcdFx0XHR0aGlzLnNwZWVjaFRvVGV4dEluUHJvZ3Jlc3Muc2V0KHRydWUpO1xuXHRcdFx0XHRcdHRoaXMuX29uRGlkU3RhcnRTcGVlY2hUb1RleHRTZXNzaW9uLmZpcmUoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTcGVlY2hUb1RleHRTdGF0dXMuUmVjb2duaXppbmc6XG5cdFx0XHRcdFx0c2Vzc2lvblJlY29nbml6ZWQgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFNwZWVjaFRvVGV4dFN0YXR1cy5SZWNvZ25pemVkOlxuXHRcdFx0XHRcdGlmICh0eXBlb2YgZS50ZXh0ID09PSAnc3RyaW5nJykge1xuXHRcdFx0XHRcdFx0c2Vzc2lvbkNvbnRlbnRMZW5ndGggKz0gZS50ZXh0Lmxlbmd0aDtcblx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgU3BlZWNoVG9UZXh0U3RhdHVzLlN0b3BwZWQ6XG5cdFx0XHRcdFx0b25TZXNzaW9uU3RvcHBlZE9yQ2FuY2VsZWQoKTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdFx0Y2FzZSBTcGVlY2hUb1RleHRTdGF0dXMuRXJyb3I6XG5cdFx0XHRcdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGBTcGVlY2ggcHJvdmlkZXIgZXJyb3IgaW4gc3BlZWNoIHRvIHRleHQgc2Vzc2lvbjogJHtlLnRleHR9YCk7XG5cdFx0XHRcdFx0c2Vzc2lvbkVycm9yID0gdHJ1ZTtcblx0XHRcdFx0XHRicmVhaztcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHRyZXR1cm4gc2Vzc2lvbjtcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZ2V0UHJvdmlkZXIoKTogUHJvbWlzZTxJU3BlZWNoUHJvdmlkZXI+IHtcblxuXHRcdC8vIFNlbmQgb3V0IGV4dGVuc2lvbiBhY3RpdmF0aW9uIHRvIGVuc3VyZSBwcm92aWRlcnMgY2FuIHJlZ2lzdGVyXG5cdFx0YXdhaXQgdGhpcy5leHRlbnNpb25TZXJ2aWNlLmFjdGl2YXRlQnlFdmVudCgnb25TcGVlY2gnKTtcblxuXHRcdGNvbnN0IHByb3ZpZGVyID0gQXJyYXkuZnJvbSh0aGlzLnByb3ZpZGVycy52YWx1ZXMoKSkuYXQoMCk7XG5cdFx0aWYgKCFwcm92aWRlcikge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKGBObyBTcGVlY2ggcHJvdmlkZXIgaXMgcmVnaXN0ZXJlZC5gKTtcblx0XHR9IGVsc2UgaWYgKHRoaXMucHJvdmlkZXJzLnNpemUgPiAxKSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgTXVsdGlwbGUgc3BlZWNoIHByb3ZpZGVycyByZWdpc3RlcmVkLiBQaWNraW5nIGZpcnN0IG9uZTogJHtwcm92aWRlci5tZXRhZGF0YS5kaXNwbGF5TmFtZX1gKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcHJvdmlkZXI7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gVGV4dCB0byBTcGVlY2hcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXJ0VGV4dFRvU3BlZWNoU2Vzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZFN0YXJ0VGV4dFRvU3BlZWNoU2Vzc2lvbiA9IHRoaXMuX29uRGlkU3RhcnRUZXh0VG9TcGVlY2hTZXNzaW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRW5kVGV4dFRvU3BlZWNoU2Vzc2lvbiA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZEVuZFRleHRUb1NwZWVjaFNlc3Npb24gPSB0aGlzLl9vbkRpZEVuZFRleHRUb1NwZWVjaFNlc3Npb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBhY3RpdmVUZXh0VG9TcGVlY2hTZXNzaW9ucyA9IDA7XG5cdGdldCBoYXNBY3RpdmVUZXh0VG9TcGVlY2hTZXNzaW9uKCkgeyByZXR1cm4gdGhpcy5hY3RpdmVUZXh0VG9TcGVlY2hTZXNzaW9ucyA+IDA7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IHRleHRUb1NwZWVjaEluUHJvZ3Jlc3M6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdGFzeW5jIGNyZWF0ZVRleHRUb1NwZWVjaFNlc3Npb24odG9rZW46IENhbmNlbGxhdGlvblRva2VuLCBjb250ZXh0OiBzdHJpbmcgPSAnc3BlZWNoJyk6IFByb21pc2U8SVRleHRUb1NwZWVjaFNlc3Npb24+IHtcblx0XHRjb25zdCBwcm92aWRlciA9IGF3YWl0IHRoaXMuZ2V0UHJvdmlkZXIoKTtcblxuXHRcdGNvbnN0IGxhbmd1YWdlID0gc3BlZWNoTGFuZ3VhZ2VDb25maWdUb0xhbmd1YWdlKHRoaXMuY29uZmlndXJhdGlvblNlcnZpY2UuZ2V0VmFsdWU8dW5rbm93bj4oU1BFRUNIX0xBTkdVQUdFX0NPTkZJRykpO1xuXHRcdGNvbnN0IHNlc3Npb24gPSBwcm92aWRlci5jcmVhdGVUZXh0VG9TcGVlY2hTZXNzaW9uKHRva2VuLCB0eXBlb2YgbGFuZ3VhZ2UgPT09ICdzdHJpbmcnID8geyBsYW5ndWFnZSB9IDogdW5kZWZpbmVkKTtcblxuXHRcdGNvbnN0IHNlc3Npb25TdGFydCA9IERhdGUubm93KCk7XG5cdFx0bGV0IHNlc3Npb25FcnJvciA9IGZhbHNlO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCA9IChkaXNwb3NlOiBib29sZWFuKSA9PiB7XG5cdFx0XHR0aGlzLmFjdGl2ZVRleHRUb1NwZWVjaFNlc3Npb25zID0gTWF0aC5tYXgoMCwgdGhpcy5hY3RpdmVUZXh0VG9TcGVlY2hTZXNzaW9ucyAtIDEpO1xuXHRcdFx0aWYgKCF0aGlzLmhhc0FjdGl2ZVRleHRUb1NwZWVjaFNlc3Npb24pIHtcblx0XHRcdFx0dGhpcy50ZXh0VG9TcGVlY2hJblByb2dyZXNzLnJlc2V0KCk7XG5cdFx0XHR9XG5cdFx0XHR0aGlzLl9vbkRpZEVuZFRleHRUb1NwZWVjaFNlc3Npb24uZmlyZSgpO1xuXG5cdFx0XHR0eXBlIFRleHRUb1NwZWVjaFNlc3Npb25DbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdFx0b3duZXI6ICdicGFzZXJvJztcblx0XHRcdFx0Y29tbWVudDogJ0FuIGV2ZW50IHRoYXQgZmlyZXMgd2hlbiBhIHRleHQgdG8gc3BlZWNoIHNlc3Npb24gaXMgY3JlYXRlZCc7XG5cdFx0XHRcdGNvbnRleHQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdDb250ZXh0IG9mIHRoZSBzZXNzaW9uLicgfTtcblx0XHRcdFx0c2Vzc2lvbkR1cmF0aW9uOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnRHVyYXRpb24gb2YgdGhlIHNlc3Npb24uJyB9O1xuXHRcdFx0XHRzZXNzaW9uRXJyb3I6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdJZiBzcGVlY2ggcmVzdWx0ZWQgaW4gZXJyb3IuJyB9O1xuXHRcdFx0XHRzZXNzaW9uTGFuZ3VhZ2U6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdDb25maWd1cmVkIGxhbmd1YWdlIGZvciB0aGUgc2Vzc2lvbi4nIH07XG5cdFx0XHR9O1xuXHRcdFx0dHlwZSBUZXh0VG9TcGVlY2hTZXNzaW9uRXZlbnQgPSB7XG5cdFx0XHRcdGNvbnRleHQ6IHN0cmluZztcblx0XHRcdFx0c2Vzc2lvbkR1cmF0aW9uOiBudW1iZXI7XG5cdFx0XHRcdHNlc3Npb25FcnJvcjogYm9vbGVhbjtcblx0XHRcdFx0c2Vzc2lvbkxhbmd1YWdlOiBzdHJpbmc7XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8VGV4dFRvU3BlZWNoU2Vzc2lvbkV2ZW50LCBUZXh0VG9TcGVlY2hTZXNzaW9uQ2xhc3NpZmljYXRpb24+KCd0ZXh0VG9TcGVlY2hTZXNzaW9uJywge1xuXHRcdFx0XHRjb250ZXh0LFxuXHRcdFx0XHRzZXNzaW9uRHVyYXRpb246IERhdGUubm93KCkgLSBzZXNzaW9uU3RhcnQsXG5cdFx0XHRcdHNlc3Npb25FcnJvcixcblx0XHRcdFx0c2Vzc2lvbkxhbmd1YWdlOiBsYW5ndWFnZVxuXHRcdFx0fSk7XG5cblx0XHRcdGlmIChkaXNwb3NlKSB7XG5cdFx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHRcdH1cblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKHRydWUpKSk7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCh0cnVlKTtcblx0XHR9XG5cblx0XHRkaXNwb3NhYmxlcy5hZGQoc2Vzc2lvbi5vbkRpZENoYW5nZShlID0+IHtcblx0XHRcdHN3aXRjaCAoZS5zdGF0dXMpIHtcblx0XHRcdFx0Y2FzZSBUZXh0VG9TcGVlY2hTdGF0dXMuU3RhcnRlZDpcblx0XHRcdFx0XHR0aGlzLmFjdGl2ZVRleHRUb1NwZWVjaFNlc3Npb25zKys7XG5cdFx0XHRcdFx0dGhpcy50ZXh0VG9TcGVlY2hJblByb2dyZXNzLnNldCh0cnVlKTtcblx0XHRcdFx0XHR0aGlzLl9vbkRpZFN0YXJ0VGV4dFRvU3BlZWNoU2Vzc2lvbi5maXJlKCk7XG5cdFx0XHRcdFx0YnJlYWs7XG5cdFx0XHRcdGNhc2UgVGV4dFRvU3BlZWNoU3RhdHVzLlN0b3BwZWQ6XG5cdFx0XHRcdFx0b25TZXNzaW9uU3RvcHBlZE9yQ2FuY2VsZWQoZmFsc2UpO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0XHRjYXNlIFRleHRUb1NwZWVjaFN0YXR1cy5FcnJvcjpcblx0XHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFNwZWVjaCBwcm92aWRlciBlcnJvciBpbiB0ZXh0IHRvIHNwZWVjaCBzZXNzaW9uOiAke2UudGV4dH1gKTtcblx0XHRcdFx0XHRzZXNzaW9uRXJyb3IgPSB0cnVlO1xuXHRcdFx0XHRcdGJyZWFrO1xuXHRcdFx0fVxuXHRcdH0pKTtcblxuXHRcdHJldHVybiBzZXNzaW9uO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIEtleXdvcmQgUmVjb2duaXRpb25cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZFN0YXJ0S2V5d29yZFJlY29nbml0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkU3RhcnRLZXl3b3JkUmVjb2duaXRpb24gPSB0aGlzLl9vbkRpZFN0YXJ0S2V5d29yZFJlY29nbml0aW9uLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkRW5kS2V5d29yZFJlY29nbml0aW9uID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkRW5kS2V5d29yZFJlY29nbml0aW9uID0gdGhpcy5fb25EaWRFbmRLZXl3b3JkUmVjb2duaXRpb24uZXZlbnQ7XG5cblx0cHJpdmF0ZSBhY3RpdmVLZXl3b3JkUmVjb2duaXRpb25TZXNzaW9ucyA9IDA7XG5cdGdldCBoYXNBY3RpdmVLZXl3b3JkUmVjb2duaXRpb24oKSB7IHJldHVybiB0aGlzLmFjdGl2ZUtleXdvcmRSZWNvZ25pdGlvblNlc3Npb25zID4gMDsgfVxuXG5cdGFzeW5jIHJlY29nbml6ZUtleXdvcmQodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTxLZXl3b3JkUmVjb2duaXRpb25TdGF0dXM+IHtcblx0XHRjb25zdCByZXN1bHQgPSBuZXcgRGVmZXJyZWRQcm9taXNlPEtleXdvcmRSZWNvZ25pdGlvblN0YXR1cz4oKTtcblxuXHRcdGNvbnN0IGRpc3Bvc2FibGVzID0gbmV3IERpc3Bvc2FibGVTdG9yZSgpO1xuXHRcdGRpc3Bvc2FibGVzLmFkZCh0b2tlbi5vbkNhbmNlbGxhdGlvblJlcXVlc3RlZCgoKSA9PiB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0XHRyZXN1bHQuY29tcGxldGUoS2V5d29yZFJlY29nbml0aW9uU3RhdHVzLkNhbmNlbGVkKTtcblx0XHR9KSk7XG5cblx0XHRjb25zdCByZWNvZ25pemVLZXl3b3JkRGlzcG9zYWJsZXMgPSBkaXNwb3NhYmxlcy5hZGQobmV3IERpc3Bvc2FibGVTdG9yZSgpKTtcblx0XHRsZXQgYWN0aXZlUmVjb2duaXplS2V5d29yZFNlc3Npb246IFByb21pc2U8dm9pZD4gfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0Y29uc3QgcmVjb2duaXplS2V5d29yZCA9ICgpID0+IHtcblx0XHRcdHJlY29nbml6ZUtleXdvcmREaXNwb3NhYmxlcy5jbGVhcigpO1xuXG5cdFx0XHRjb25zdCBjdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UodG9rZW4pO1xuXHRcdFx0cmVjb2duaXplS2V5d29yZERpc3Bvc2FibGVzLmFkZCh0b0Rpc3Bvc2FibGUoKCkgPT4gY3RzLmRpc3Bvc2UodHJ1ZSkpKTtcblx0XHRcdGNvbnN0IGN1cnJlbnRSZWNvZ25pemVLZXl3b3JkU2Vzc2lvbiA9IGFjdGl2ZVJlY29nbml6ZUtleXdvcmRTZXNzaW9uID0gdGhpcy5kb1JlY29nbml6ZUtleXdvcmQoY3RzLnRva2VuKS50aGVuKHN0YXR1cyA9PiB7XG5cdFx0XHRcdGlmIChjdXJyZW50UmVjb2duaXplS2V5d29yZFNlc3Npb24gPT09IGFjdGl2ZVJlY29nbml6ZUtleXdvcmRTZXNzaW9uKSB7XG5cdFx0XHRcdFx0cmVzdWx0LmNvbXBsZXRlKHN0YXR1cyk7XG5cdFx0XHRcdH1cblx0XHRcdH0sIGVycm9yID0+IHtcblx0XHRcdFx0aWYgKGN1cnJlbnRSZWNvZ25pemVLZXl3b3JkU2Vzc2lvbiA9PT0gYWN0aXZlUmVjb2duaXplS2V5d29yZFNlc3Npb24pIHtcblx0XHRcdFx0XHRyZXN1bHQuZXJyb3IoZXJyb3IpO1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRoaXMuaG9zdFNlcnZpY2Uub25EaWRDaGFuZ2VGb2N1cyhmb2N1c2VkID0+IHtcblx0XHRcdGlmICghZm9jdXNlZCAmJiBhY3RpdmVSZWNvZ25pemVLZXl3b3JkU2Vzc2lvbikge1xuXHRcdFx0XHRyZWNvZ25pemVLZXl3b3JkRGlzcG9zYWJsZXMuY2xlYXIoKTtcblx0XHRcdFx0YWN0aXZlUmVjb2duaXplS2V5d29yZFNlc3Npb24gPSB1bmRlZmluZWQ7XG5cdFx0XHR9IGVsc2UgaWYgKCFhY3RpdmVSZWNvZ25pemVLZXl3b3JkU2Vzc2lvbikge1xuXHRcdFx0XHRyZWNvZ25pemVLZXl3b3JkKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0aWYgKHRoaXMuaG9zdFNlcnZpY2UuaGFzRm9jdXMpIHtcblx0XHRcdHJlY29nbml6ZUtleXdvcmQoKTtcblx0XHR9XG5cblx0XHRsZXQgc3RhdHVzOiBLZXl3b3JkUmVjb2duaXRpb25TdGF0dXM7XG5cdFx0dHJ5IHtcblx0XHRcdHN0YXR1cyA9IGF3YWl0IHJlc3VsdC5wO1xuXHRcdH0gZmluYWxseSB7XG5cdFx0XHRkaXNwb3NhYmxlcy5kaXNwb3NlKCk7XG5cdFx0fVxuXG5cdFx0dHlwZSBLZXl3b3JkUmVjb2duaXRpb25DbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnYnBhc2Vybyc7XG5cdFx0XHRjb21tZW50OiAnQW4gZXZlbnQgdGhhdCBmaXJlcyB3aGVuIGEgc3BlZWNoIGtleXdvcmQgZGV0ZWN0aW9uIGlzIHN0YXJ0ZWQnO1xuXHRcdFx0a2V5d29yZFJlY29nbml6ZWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdJZiB0aGUga2V5d29yZCB3YXMgcmVjb2duaXplZC4nIH07XG5cdFx0fTtcblx0XHR0eXBlIEtleXdvcmRSZWNvZ25pdGlvbkV2ZW50ID0ge1xuXHRcdFx0a2V5d29yZFJlY29nbml6ZWQ6IGJvb2xlYW47XG5cdFx0fTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxLZXl3b3JkUmVjb2duaXRpb25FdmVudCwgS2V5d29yZFJlY29nbml0aW9uQ2xhc3NpZmljYXRpb24+KCdrZXl3b3JkUmVjb2duaXRpb24nLCB7XG5cdFx0XHRrZXl3b3JkUmVjb2duaXplZDogc3RhdHVzID09PSBLZXl3b3JkUmVjb2duaXRpb25TdGF0dXMuUmVjb2duaXplZFxuXHRcdH0pO1xuXG5cdFx0cmV0dXJuIHN0YXR1cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZWNvZ25pemVLZXl3b3JkKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8S2V5d29yZFJlY29nbml0aW9uU3RhdHVzPiB7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBhd2FpdCB0aGlzLmdldFByb3ZpZGVyKCk7XG5cblx0XHRjb25zdCBzZXNzaW9uID0gcHJvdmlkZXIuY3JlYXRlS2V5d29yZFJlY29nbml0aW9uU2Vzc2lvbih0b2tlbik7XG5cdFx0dGhpcy5hY3RpdmVLZXl3b3JkUmVjb2duaXRpb25TZXNzaW9ucysrO1xuXHRcdHRoaXMuX29uRGlkU3RhcnRLZXl3b3JkUmVjb2duaXRpb24uZmlyZSgpO1xuXG5cdFx0Y29uc3QgZGlzcG9zYWJsZXMgPSBuZXcgRGlzcG9zYWJsZVN0b3JlKCk7XG5cblx0XHRjb25zdCBvblNlc3Npb25TdG9wcGVkT3JDYW5jZWxlZCA9ICgpID0+IHtcblx0XHRcdHRoaXMuYWN0aXZlS2V5d29yZFJlY29nbml0aW9uU2Vzc2lvbnMgPSBNYXRoLm1heCgwLCB0aGlzLmFjdGl2ZUtleXdvcmRSZWNvZ25pdGlvblNlc3Npb25zIC0gMSk7XG5cdFx0XHR0aGlzLl9vbkRpZEVuZEtleXdvcmRSZWNvZ25pdGlvbi5maXJlKCk7XG5cblx0XHRcdGRpc3Bvc2FibGVzLmRpc3Bvc2UoKTtcblx0XHR9O1xuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHRva2VuLm9uQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKCgpID0+IG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKCkpKTtcblx0XHRpZiAodG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKCk7XG5cdFx0fVxuXG5cdFx0ZGlzcG9zYWJsZXMuYWRkKHNlc3Npb24ub25EaWRDaGFuZ2UoZSA9PiB7XG5cdFx0XHRpZiAoZS5zdGF0dXMgPT09IEtleXdvcmRSZWNvZ25pdGlvblN0YXR1cy5TdG9wcGVkKSB7XG5cdFx0XHRcdG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dHJ5IHtcblx0XHRcdHJldHVybiAoYXdhaXQgRXZlbnQudG9Qcm9taXNlKHNlc3Npb24ub25EaWRDaGFuZ2UpKS5zdGF0dXM7XG5cdFx0fSBmaW5hbGx5IHtcblx0XHRcdG9uU2Vzc2lvblN0b3BwZWRPckNhbmNlbGVkKCk7XG5cdFx0fVxuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG59XG4iXSwKICAibWFwcGluZ3MiOiAiOzs7Ozs7Ozs7OztBQUtBLFNBQVMsZ0JBQWdCO0FBQ3pCLFNBQTRCLCtCQUErQjtBQUMzRCxTQUFT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
