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
import product from "../../../../platform/product/common/product.js";
import { Barrier } from "../../../../base/common/async.js";
import { CancellationToken, CancellationTokenSource } from "../../../../base/common/cancellation.js";
import { Emitter, Event } from "../../../../base/common/event.js";
import { Lazy } from "../../../../base/common/lazy.js";
import { Disposable } from "../../../../base/common/lifecycle.js";
import { localize } from "../../../../nls.js";
import { IConfigurationService } from "../../../../platform/configuration/common/configuration.js";
import { IContextKeyService } from "../../../../platform/contextkey/common/contextkey.js";
import { IDialogService } from "../../../../platform/dialogs/common/dialogs.js";
import { ExtensionIdentifier } from "../../../../platform/extensions/common/extensions.js";
import { createDecorator, IInstantiationService } from "../../../../platform/instantiation/common/instantiation.js";
import { ILogService } from "../../../../platform/log/common/log.js";
import { IProductService } from "../../../../platform/product/common/productService.js";
import { asText, IRequestService } from "../../../../platform/request/common/request.js";
import { IStorageService, StorageScope, StorageTarget } from "../../../../platform/storage/common/storage.js";
import { ITelemetryService, TelemetryLevel } from "../../../../platform/telemetry/common/telemetry.js";
import { IAuthenticationExtensionsService, IAuthenticationService } from "../../../services/authentication/common/authentication.js";
import { IWorkbenchExtensionEnablementService } from "../../../services/extensionManagement/common/extensionManagement.js";
import { IExtensionsWorkbenchService } from "../../extensions/common/extensions.js";
import { ChatContextKeys } from "./chatContextKeys.js";
import { IOpenerService } from "../../../../platform/opener/common/opener.js";
import { URI } from "../../../../base/common/uri.js";
import Severity from "../../../../base/common/severity.js";
import { IWorkbenchEnvironmentService } from "../../../services/environment/common/environmentService.js";
import { isWeb } from "../../../../base/common/platform.js";
import { ILifecycleService } from "../../../services/lifecycle/common/lifecycle.js";
const IChatEntitlementService = createDecorator("chatEntitlementService");
var ChatEntitlement = /* @__PURE__ */ ((ChatEntitlement2) => {
  ChatEntitlement2[ChatEntitlement2["Unknown"] = 1] = "Unknown";
  ChatEntitlement2[ChatEntitlement2["Unresolved"] = 2] = "Unresolved";
  ChatEntitlement2[ChatEntitlement2["Available"] = 3] = "Available";
  ChatEntitlement2[ChatEntitlement2["Unavailable"] = 4] = "Unavailable";
  ChatEntitlement2[ChatEntitlement2["Limited"] = 5] = "Limited";
  ChatEntitlement2[ChatEntitlement2["Pro"] = 6] = "Pro";
  return ChatEntitlement2;
})(ChatEntitlement || {});
var ChatSentiment = /* @__PURE__ */ ((ChatSentiment2) => {
  ChatSentiment2[ChatSentiment2["Standard"] = 1] = "Standard";
  ChatSentiment2[ChatSentiment2["Disabled"] = 2] = "Disabled";
  ChatSentiment2[ChatSentiment2["Installed"] = 3] = "Installed";
  return ChatSentiment2;
})(ChatSentiment || {});
const defaultChat = {
  extensionId: product.defaultChatAgent?.extensionId ?? "",
  chatExtensionId: product.defaultChatAgent?.chatExtensionId ?? "",
  upgradePlanUrl: product.defaultChatAgent?.upgradePlanUrl ?? "",
  providerId: product.defaultChatAgent?.providerId ?? "",
  enterpriseProviderId: product.defaultChatAgent?.enterpriseProviderId ?? "",
  providerScopes: product.defaultChatAgent?.providerScopes ?? [[]],
  entitlementUrl: product.defaultChatAgent?.entitlementUrl ?? "",
  entitlementSignupLimitedUrl: product.defaultChatAgent?.entitlementSignupLimitedUrl ?? "",
  completionsAdvancedSetting: product.defaultChatAgent?.completionsAdvancedSetting ?? "",
  chatQuotaExceededContext: product.defaultChatAgent?.chatQuotaExceededContext ?? "",
  completionsQuotaExceededContext: product.defaultChatAgent?.completionsQuotaExceededContext ?? ""
};
let ChatEntitlementService = class extends Disposable {
  constructor(instantiationService, productService, environmentService, contextKeyService) {
    super();
    this.contextKeyService = contextKeyService;
    //#endregion
    //#region --- Quotas
    this._onDidChangeQuotaExceeded = this._register(new Emitter());
    this.onDidChangeQuotaExceeded = this._onDidChangeQuotaExceeded.event;
    this._onDidChangeQuotaRemaining = this._register(new Emitter());
    this.onDidChangeQuotaRemaining = this._onDidChangeQuotaRemaining.event;
    this._quotas = { chatQuotaExceeded: false, completionsQuotaExceeded: false, quotaResetDate: void 0 };
    this.ExtensionQuotaContextKeys = {
      chatQuotaExceeded: defaultChat.chatQuotaExceededContext,
      completionsQuotaExceeded: defaultChat.completionsQuotaExceededContext
    };
    //#endregion
    //#region --- Sentiment
    this._onDidChangeSentiment = this._register(new Emitter());
    this.onDidChangeSentiment = this._onDidChangeSentiment.event;
    this.chatQuotaExceededContextKey = ChatContextKeys.chatQuotaExceeded.bindTo(this.contextKeyService);
    this.completionsQuotaExceededContextKey = ChatContextKeys.completionsQuotaExceeded.bindTo(this.contextKeyService);
    this.onDidChangeEntitlement = Event.map(
      Event.filter(
        this.contextKeyService.onDidChangeContext,
        (e) => e.affectsSome(/* @__PURE__ */ new Set([
          ChatContextKeys.Entitlement.pro.key,
          ChatContextKeys.Entitlement.limited.key,
          ChatContextKeys.Entitlement.canSignUp.key,
          ChatContextKeys.Entitlement.signedOut.key
        ])),
        this._store
      ),
      () => {
      },
      this._store
    );
    this.onDidChangeSentiment = Event.map(
      Event.filter(
        this.contextKeyService.onDidChangeContext,
        (e) => e.affectsSome(/* @__PURE__ */ new Set([
          ChatContextKeys.Setup.hidden.key,
          ChatContextKeys.Setup.installed.key
        ])),
        this._store
      ),
      () => {
      },
      this._store
    );
    if (!productService.defaultChatAgent || // needs product config
    isWeb && !environmentService.remoteAuthority) {
      ChatContextKeys.Setup.hidden.bindTo(this.contextKeyService).set(true);
      return;
    }
    const context = this.context = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementContext)));
    this.requests = new Lazy(() => this._register(instantiationService.createInstance(ChatEntitlementRequests, context.value, {
      clearQuotas: () => this.clearQuotas(),
      acceptQuotas: (quotas) => this.acceptQuotas(quotas)
    })));
    this.registerListeners();
  }
  get entitlement() {
    if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.pro.key) === true) {
      return 6 /* Pro */;
    } else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.limited.key) === true) {
      return 5 /* Limited */;
    } else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.canSignUp.key) === true) {
      return 3 /* Available */;
    } else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Entitlement.signedOut.key) === true) {
      return 1 /* Unknown */;
    }
    return 2 /* Unresolved */;
  }
  get quotas() {
    return this._quotas;
  }
  registerListeners() {
    const chatQuotaExceededSet = /* @__PURE__ */ new Set([this.ExtensionQuotaContextKeys.chatQuotaExceeded]);
    const completionsQuotaExceededSet = /* @__PURE__ */ new Set([this.ExtensionQuotaContextKeys.completionsQuotaExceeded]);
    this._register(this.contextKeyService.onDidChangeContext((e) => {
      let changed = false;
      if (e.affectsSome(chatQuotaExceededSet)) {
        const newChatQuotaExceeded = this.contextKeyService.getContextKeyValue(this.ExtensionQuotaContextKeys.chatQuotaExceeded);
        if (typeof newChatQuotaExceeded === "boolean" && newChatQuotaExceeded !== this._quotas.chatQuotaExceeded) {
          this._quotas = {
            ...this._quotas,
            chatQuotaExceeded: newChatQuotaExceeded
          };
          changed = true;
        }
      }
      if (e.affectsSome(completionsQuotaExceededSet)) {
        const newCompletionsQuotaExceeded = this.contextKeyService.getContextKeyValue(this.ExtensionQuotaContextKeys.completionsQuotaExceeded);
        if (typeof newCompletionsQuotaExceeded === "boolean" && newCompletionsQuotaExceeded !== this._quotas.completionsQuotaExceeded) {
          this._quotas = {
            ...this._quotas,
            completionsQuotaExceeded: newCompletionsQuotaExceeded
          };
          changed = true;
        }
      }
      if (changed) {
        this.updateContextKeys();
        this._onDidChangeQuotaExceeded.fire();
      }
    }));
  }
  acceptQuotas(quotas) {
    const oldQuota = this._quotas;
    this._quotas = quotas;
    this.updateContextKeys();
    if (oldQuota.chatQuotaExceeded !== this._quotas.chatQuotaExceeded || oldQuota.completionsQuotaExceeded !== this._quotas.completionsQuotaExceeded) {
      this._onDidChangeQuotaExceeded.fire();
    }
    if (oldQuota.chatRemaining !== this._quotas.chatRemaining || oldQuota.completionsRemaining !== this._quotas.completionsRemaining) {
      this._onDidChangeQuotaRemaining.fire();
    }
  }
  clearQuotas() {
    if (this.quotas.chatQuotaExceeded || this.quotas.completionsQuotaExceeded) {
      this.acceptQuotas({ chatQuotaExceeded: false, completionsQuotaExceeded: false, quotaResetDate: void 0 });
    }
  }
  updateContextKeys() {
    this.chatQuotaExceededContextKey.set(this._quotas.chatQuotaExceeded);
    this.completionsQuotaExceededContextKey.set(this._quotas.completionsQuotaExceeded);
  }
  get sentiment() {
    if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.installed.key) === true) {
      return 3 /* Installed */;
    } else if (this.contextKeyService.getContextKeyValue(ChatContextKeys.Setup.hidden.key) === true) {
      return 2 /* Disabled */;
    }
    return 1 /* Standard */;
  }
  //#endregion
  async update(token) {
    await this.requests?.value.forceResolveEntitlement(void 0, token);
  }
};
ChatEntitlementService = __decorateClass([
  __decorateParam(0, IInstantiationService),
  __decorateParam(1, IProductService),
  __decorateParam(2, IWorkbenchEnvironmentService),
  __decorateParam(3, IContextKeyService)
], ChatEntitlementService);
let ChatEntitlementRequests = class extends Disposable {
  constructor(context, chatQuotasAccessor, telemetryService, authenticationService, logService, requestService, dialogService, openerService, configurationService, authenticationExtensionsService, lifecycleService) {
    super();
    this.context = context;
    this.chatQuotasAccessor = chatQuotasAccessor;
    this.telemetryService = telemetryService;
    this.authenticationService = authenticationService;
    this.logService = logService;
    this.requestService = requestService;
    this.dialogService = dialogService;
    this.openerService = openerService;
    this.configurationService = configurationService;
    this.authenticationExtensionsService = authenticationExtensionsService;
    this.lifecycleService = lifecycleService;
    this.pendingResolveCts = new CancellationTokenSource();
    this.didResolveEntitlements = false;
    this.state = { entitlement: this.context.state.entitlement };
    this.registerListeners();
    this.resolve();
  }
  static providerId(configurationService) {
    if (configurationService.getValue(`${defaultChat.completionsAdvancedSetting}.authProvider`) === defaultChat.enterpriseProviderId) {
      return defaultChat.enterpriseProviderId;
    }
    return defaultChat.providerId;
  }
  registerListeners() {
    this._register(this.authenticationService.onDidChangeDeclaredProviders(() => this.resolve()));
    this._register(this.authenticationService.onDidChangeSessions((e) => {
      if (e.providerId === ChatEntitlementRequests.providerId(this.configurationService)) {
        this.resolve();
      }
    }));
    this._register(this.authenticationService.onDidRegisterAuthenticationProvider((e) => {
      if (e.id === ChatEntitlementRequests.providerId(this.configurationService)) {
        this.resolve();
      }
    }));
    this._register(this.authenticationService.onDidUnregisterAuthenticationProvider((e) => {
      if (e.id === ChatEntitlementRequests.providerId(this.configurationService)) {
        this.resolve();
      }
    }));
    this._register(this.context.onDidChange(() => {
      if (!this.context.state.installed || this.context.state.entitlement === 1 /* Unknown */) {
        this.state = { entitlement: this.state.entitlement, quotas: void 0 };
        this.chatQuotasAccessor.clearQuotas();
      }
    }));
  }
  async resolve() {
    this.pendingResolveCts.dispose(true);
    const cts = this.pendingResolveCts = new CancellationTokenSource();
    const session = await this.findMatchingProviderSession(cts.token);
    if (cts.token.isCancellationRequested) {
      return;
    }
    let state = void 0;
    if (session) {
      if (this.state.entitlement === 1 /* Unknown */) {
        state = { entitlement: 2 /* Unresolved */ };
      }
    } else {
      this.didResolveEntitlements = false;
      state = { entitlement: 1 /* Unknown */ };
    }
    if (state) {
      this.update(state);
    }
    if (session && !this.didResolveEntitlements) {
      await this.resolveEntitlement(session, cts.token);
    }
  }
  async findMatchingProviderSession(token) {
    const sessions = await this.doGetSessions(ChatEntitlementRequests.providerId(this.configurationService));
    if (token.isCancellationRequested) {
      return void 0;
    }
    for (const session of sessions) {
      for (const scopes of defaultChat.providerScopes) {
        if (this.scopesMatch(session.scopes, scopes)) {
          return session;
        }
      }
    }
    return void 0;
  }
  async doGetSessions(providerId) {
    try {
      return await this.authenticationService.getSessions(providerId);
    } catch (error) {
    }
    return [];
  }
  scopesMatch(scopes, expectedScopes) {
    return scopes.length === expectedScopes.length && expectedScopes.every((scope) => scopes.includes(scope));
  }
  async resolveEntitlement(session, token) {
    const entitlements = await this.doResolveEntitlement(session, token);
    if (typeof entitlements?.entitlement === "number" && !token.isCancellationRequested) {
      this.didResolveEntitlements = true;
      this.update(entitlements);
    }
    return entitlements;
  }
  async doResolveEntitlement(session, token) {
    if (ChatEntitlementRequests.providerId(this.configurationService) === defaultChat.enterpriseProviderId) {
      this.logService.trace("[chat entitlement]: enterprise provider, assuming Pro");
      return { entitlement: 6 /* Pro */ };
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    const response = await this.request(defaultChat.entitlementUrl, "GET", void 0, session, token);
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (!response) {
      this.logService.trace("[chat entitlement]: no response");
      return { entitlement: 2 /* Unresolved */ };
    }
    if (response.res.statusCode && response.res.statusCode !== 200) {
      this.logService.trace(`[chat entitlement]: unexpected status code ${response.res.statusCode}`);
      return response.res.statusCode === 401 || response.res.statusCode === 403 || response.res.statusCode === 404 ? {
        entitlement: 1 /* Unknown */
        /* treat as signed out */
      } : { entitlement: 2 /* Unresolved */ };
    }
    let responseText = null;
    try {
      responseText = await asText(response);
    } catch (error) {
    }
    if (token.isCancellationRequested) {
      return void 0;
    }
    if (!responseText) {
      this.logService.trace("[chat entitlement]: response has no content");
      return { entitlement: 2 /* Unresolved */ };
    }
    let entitlementsResponse;
    try {
      entitlementsResponse = JSON.parse(responseText);
      this.logService.trace(`[chat entitlement]: parsed result is ${JSON.stringify(entitlementsResponse)}`);
    } catch (err) {
      this.logService.trace(`[chat entitlement]: error parsing response (${err})`);
      return { entitlement: 2 /* Unresolved */ };
    }
    let entitlement;
    if (entitlementsResponse.access_type_sku === "free_limited_copilot") {
      entitlement = 5 /* Limited */;
    } else if (entitlementsResponse.can_signup_for_limited) {
      entitlement = 3 /* Available */;
    } else if (entitlementsResponse.chat_enabled) {
      entitlement = 6 /* Pro */;
    } else {
      entitlement = 4 /* Unavailable */;
    }
    const chatRemaining = entitlementsResponse.limited_user_quotas?.chat;
    const completionsRemaining = entitlementsResponse.limited_user_quotas?.completions;
    const entitlements = {
      entitlement,
      quotas: {
        chatTotal: entitlementsResponse.monthly_quotas?.chat,
        completionsTotal: entitlementsResponse.monthly_quotas?.completions,
        chatRemaining: typeof chatRemaining === "number" ? Math.max(0, chatRemaining) : void 0,
        completionsRemaining: typeof completionsRemaining === "number" ? Math.max(0, completionsRemaining) : void 0,
        resetDate: entitlementsResponse.limited_user_reset_date
      }
    };
    this.logService.trace(`[chat entitlement]: resolved to ${entitlements.entitlement}, quotas: ${JSON.stringify(entitlements.quotas)}`);
    this.telemetryService.publicLog2("chatInstallEntitlement", {
      entitlement: entitlements.entitlement,
      tid: entitlementsResponse.analytics_tracking_id,
      quotaChat: entitlementsResponse.limited_user_quotas?.chat,
      quotaCompletions: entitlementsResponse.limited_user_quotas?.completions,
      quotaResetDate: entitlementsResponse.limited_user_reset_date
    });
    return entitlements;
  }
  async request(url, type, body, session, token) {
    try {
      return await this.requestService.request({
        type,
        url,
        data: type === "POST" ? JSON.stringify(body) : void 0,
        disableCache: true,
        headers: {
          "Authorization": `Bearer ${session.accessToken}`
        }
      }, token);
    } catch (error) {
      if (!token.isCancellationRequested) {
        this.logService.error(`[chat entitlement] request: error ${error}`);
      }
      return void 0;
    }
  }
  update(state) {
    this.state = state;
    this.context.update({ entitlement: this.state.entitlement });
    if (state.quotas) {
      this.chatQuotasAccessor.acceptQuotas({
        chatQuotaExceeded: typeof state.quotas.chatRemaining === "number" ? state.quotas.chatRemaining <= 0 : false,
        completionsQuotaExceeded: typeof state.quotas.completionsRemaining === "number" ? state.quotas.completionsRemaining <= 0 : false,
        quotaResetDate: state.quotas.resetDate ? new Date(state.quotas.resetDate) : void 0,
        chatTotal: state.quotas.chatTotal,
        completionsTotal: state.quotas.completionsTotal,
        chatRemaining: state.quotas.chatRemaining,
        completionsRemaining: state.quotas.completionsRemaining
      });
    }
  }
  async forceResolveEntitlement(session, token = CancellationToken.None) {
    if (!session) {
      session = await this.findMatchingProviderSession(token);
    }
    if (!session) {
      return void 0;
    }
    return this.resolveEntitlement(session, token);
  }
  async signUpLimited(session) {
    const body = {
      restricted_telemetry: this.telemetryService.telemetryLevel === TelemetryLevel.NONE ? "disabled" : "enabled",
      public_code_suggestions: "enabled"
    };
    const response = await this.request(defaultChat.entitlementSignupLimitedUrl, "POST", body, session, CancellationToken.None);
    if (!response) {
      const retry = await this.onUnknownSignUpError(localize("signUpNoResponseError", "No response received."), "[chat entitlement] sign-up: no response");
      return retry ? this.signUpLimited(session) : { errorCode: 1 };
    }
    if (response.res.statusCode && response.res.statusCode !== 200) {
      if (response.res.statusCode === 422) {
        try {
          const responseText2 = await asText(response);
          if (responseText2) {
            const responseError = JSON.parse(responseText2);
            if (typeof responseError.message === "string" && responseError.message) {
              this.onUnprocessableSignUpError(`[chat entitlement] sign-up: unprocessable entity (${responseError.message})`, responseError.message);
              return { errorCode: response.res.statusCode };
            }
          }
        } catch (error) {
        }
      }
      const retry = await this.onUnknownSignUpError(localize("signUpUnexpectedStatusError", "Unexpected status code {0}.", response.res.statusCode), `[chat entitlement] sign-up: unexpected status code ${response.res.statusCode}`);
      return retry ? this.signUpLimited(session) : { errorCode: response.res.statusCode };
    }
    let responseText = null;
    try {
      responseText = await asText(response);
    } catch (error) {
    }
    if (!responseText) {
      const retry = await this.onUnknownSignUpError(localize("signUpNoResponseContentsError", "Response has no contents."), "[chat entitlement] sign-up: response has no content");
      return retry ? this.signUpLimited(session) : { errorCode: 2 };
    }
    let parsedResult = void 0;
    try {
      parsedResult = JSON.parse(responseText);
      this.logService.trace(`[chat entitlement] sign-up: response is ${responseText}`);
    } catch (err) {
      const retry = await this.onUnknownSignUpError(localize("signUpInvalidResponseError", "Invalid response contents."), `[chat entitlement] sign-up: error parsing response (${err})`);
      return retry ? this.signUpLimited(session) : { errorCode: 3 };
    }
    this.update({ entitlement: 5 /* Limited */ });
    return Boolean(parsedResult?.subscribed);
  }
  async onUnknownSignUpError(detail, logMessage) {
    this.logService.error(logMessage);
    if (!this.lifecycleService.willShutdown) {
      const { confirmed } = await this.dialogService.confirm({
        type: Severity.Error,
        message: localize("unknownSignUpError", "An error occurred while signing up for the Copilot Free plan. Would you like to try again?"),
        detail,
        primaryButton: localize("retry", "Retry")
      });
      return confirmed;
    }
    return false;
  }
  onUnprocessableSignUpError(logMessage, logDetails) {
    this.logService.error(logMessage);
    if (!this.lifecycleService.willShutdown) {
      this.dialogService.prompt({
        type: Severity.Error,
        message: localize("unprocessableSignUpError", "An error occurred while signing up for the Copilot Free plan."),
        detail: logDetails,
        buttons: [
          {
            label: localize("ok", "OK"),
            run: () => {
            }
          },
          {
            label: localize("learnMore", "Learn More"),
            run: () => this.openerService.open(URI.parse(defaultChat.upgradePlanUrl))
          }
        ]
      });
    }
  }
  async signIn() {
    const providerId = ChatEntitlementRequests.providerId(this.configurationService);
    const session = await this.authenticationService.createSession(providerId, defaultChat.providerScopes[0]);
    this.authenticationExtensionsService.updateAccountPreference(defaultChat.extensionId, providerId, session.account);
    this.authenticationExtensionsService.updateAccountPreference(defaultChat.chatExtensionId, providerId, session.account);
    const entitlements = await this.forceResolveEntitlement(session);
    return { session, entitlements };
  }
  dispose() {
    this.pendingResolveCts.dispose(true);
    super.dispose();
  }
};
ChatEntitlementRequests = __decorateClass([
  __decorateParam(2, ITelemetryService),
  __decorateParam(3, IAuthenticationService),
  __decorateParam(4, ILogService),
  __decorateParam(5, IRequestService),
  __decorateParam(6, IDialogService),
  __decorateParam(7, IOpenerService),
  __decorateParam(8, IConfigurationService),
  __decorateParam(9, IAuthenticationExtensionsService),
  __decorateParam(10, ILifecycleService)
], ChatEntitlementRequests);
let ChatEntitlementContext = class extends Disposable {
  constructor(contextKeyService, storageService, extensionEnablementService, logService, extensionsWorkbenchService) {
    super();
    this.storageService = storageService;
    this.extensionEnablementService = extensionEnablementService;
    this.logService = logService;
    this.extensionsWorkbenchService = extensionsWorkbenchService;
    this.suspendedState = void 0;
    this._onDidChange = this._register(new Emitter());
    this.onDidChange = this._onDidChange.event;
    this.updateBarrier = void 0;
    this.canSignUpContextKey = ChatContextKeys.Entitlement.canSignUp.bindTo(contextKeyService);
    this.signedOutContextKey = ChatContextKeys.Entitlement.signedOut.bindTo(contextKeyService);
    this.limitedContextKey = ChatContextKeys.Entitlement.limited.bindTo(contextKeyService);
    this.proContextKey = ChatContextKeys.Entitlement.pro.bindTo(contextKeyService);
    this.hiddenContext = ChatContextKeys.Setup.hidden.bindTo(contextKeyService);
    this.installedContext = ChatContextKeys.Setup.installed.bindTo(contextKeyService);
    this._state = this.storageService.getObject(ChatEntitlementContext.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, StorageScope.PROFILE) ?? { entitlement: 1 /* Unknown */ };
    this.checkExtensionInstallation();
    this.updateContextSync();
  }
  get state() {
    return this.suspendedState ?? this._state;
  }
  async checkExtensionInstallation() {
    await this.extensionsWorkbenchService.queryLocal();
    this._register(Event.runAndSubscribe(this.extensionsWorkbenchService.onChange, (e) => {
      if (e && !ExtensionIdentifier.equals(e.identifier.id, defaultChat.extensionId)) {
        return;
      }
      const defaultChatExtension = this.extensionsWorkbenchService.local.find((value) => ExtensionIdentifier.equals(value.identifier.id, defaultChat.extensionId));
      this.update({ installed: !!defaultChatExtension?.local && this.extensionEnablementService.isEnabled(defaultChatExtension.local) });
    }));
  }
  update(context) {
    this.logService.trace(`[chat entitlement context] update(): ${JSON.stringify(context)}`);
    if (typeof context.installed === "boolean") {
      this._state.installed = context.installed;
      if (context.installed) {
        context.hidden = false;
      }
    }
    if (typeof context.hidden === "boolean") {
      this._state.hidden = context.hidden;
    }
    if (typeof context.entitlement === "number") {
      this._state.entitlement = context.entitlement;
      if (this._state.entitlement === 5 /* Limited */ || this._state.entitlement === 6 /* Pro */) {
        this._state.registered = true;
      } else if (this._state.entitlement === 3 /* Available */) {
        this._state.registered = false;
      }
    }
    this.storageService.store(ChatEntitlementContext.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY, this._state, StorageScope.PROFILE, StorageTarget.MACHINE);
    return this.updateContext();
  }
  async updateContext() {
    await this.updateBarrier?.wait();
    this.updateContextSync();
  }
  updateContextSync() {
    this.logService.trace(`[chat entitlement context] updateContext(): ${JSON.stringify(this._state)}`);
    this.signedOutContextKey.set(this._state.entitlement === 1 /* Unknown */);
    this.canSignUpContextKey.set(this._state.entitlement === 3 /* Available */);
    this.limitedContextKey.set(this._state.entitlement === 5 /* Limited */);
    this.proContextKey.set(this._state.entitlement === 6 /* Pro */);
    this.hiddenContext.set(!!this._state.hidden);
    this.installedContext.set(!!this._state.installed);
    this._onDidChange.fire();
  }
  suspend() {
    this.suspendedState = { ...this._state };
    this.updateBarrier = new Barrier();
  }
  resume() {
    this.suspendedState = void 0;
    this.updateBarrier?.open();
    this.updateBarrier = void 0;
  }
};
ChatEntitlementContext.CHAT_ENTITLEMENT_CONTEXT_STORAGE_KEY = "chat.setupContext";
ChatEntitlementContext = __decorateClass([
  __decorateParam(0, IContextKeyService),
  __decorateParam(1, IStorageService),
  __decorateParam(2, IWorkbenchExtensionEnablementService),
  __decorateParam(3, ILogService),
  __decorateParam(4, IExtensionsWorkbenchService)
], ChatEntitlementContext);
export {
  ChatEntitlement,
  ChatEntitlementContext,
  ChatEntitlementRequests,
  ChatEntitlementService,
  ChatSentiment,
  IChatEntitlementService
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvY29udHJpYi9jaGF0L2NvbW1vbi9jaGF0RW50aXRsZW1lbnRTZXJ2aWNlLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHByb2R1Y3QgZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdC5qcyc7XG5pbXBvcnQgeyBCYXJyaWVyIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vYXN5bmMuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uVG9rZW4sIENhbmNlbGxhdGlvblRva2VuU291cmNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vY2FuY2VsbGF0aW9uLmpzJztcbmltcG9ydCB7IEVtaXR0ZXIsIEV2ZW50IH0gZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vZXZlbnQuanMnO1xuaW1wb3J0IHsgTGF6eSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xhenkuanMnO1xuaW1wb3J0IHsgRGlzcG9zYWJsZSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgeyBJUmVxdWVzdENvbnRleHQgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL3BhcnRzL3JlcXVlc3QvY29tbW9uL3JlcXVlc3QuanMnO1xuaW1wb3J0IHsgbG9jYWxpemUgfSBmcm9tICcuLi8uLi8uLi8uLi9ubHMuanMnO1xuaW1wb3J0IHsgSUNvbmZpZ3VyYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29uZmlndXJhdGlvbi9jb21tb24vY29uZmlndXJhdGlvbi5qcyc7XG5pbXBvcnQgeyBJQ29udGV4dEtleSwgSUNvbnRleHRLZXlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vY29udGV4dGtleS9jb21tb24vY29udGV4dGtleS5qcyc7XG5pbXBvcnQgeyBJRGlhbG9nU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2RpYWxvZ3MvY29tbW9uL2RpYWxvZ3MuanMnO1xuaW1wb3J0IHsgRXh0ZW5zaW9uSWRlbnRpZmllciB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL2V4dGVuc2lvbnMvY29tbW9uL2V4dGVuc2lvbnMuanMnO1xuaW1wb3J0IHsgY3JlYXRlRGVjb3JhdG9yLCBJSW5zdGFudGlhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9pbnN0YW50aWF0aW9uL2NvbW1vbi9pbnN0YW50aWF0aW9uLmpzJztcbmltcG9ydCB7IElMb2dTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vbG9nL2NvbW1vbi9sb2cuanMnO1xuaW1wb3J0IHsgSVByb2R1Y3RTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vcHJvZHVjdC9jb21tb24vcHJvZHVjdFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgYXNUZXh0LCBJUmVxdWVzdFNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS9yZXF1ZXN0L2NvbW1vbi9yZXF1ZXN0LmpzJztcbmltcG9ydCB7IElTdG9yYWdlU2VydmljZSwgU3RvcmFnZVNjb3BlLCBTdG9yYWdlVGFyZ2V0IH0gZnJvbSAnLi4vLi4vLi4vLi4vcGxhdGZvcm0vc3RvcmFnZS9jb21tb24vc3RvcmFnZS5qcyc7XG5pbXBvcnQgeyBJVGVsZW1ldHJ5U2VydmljZSwgVGVsZW1ldHJ5TGV2ZWwgfSBmcm9tICcuLi8uLi8uLi8uLi9wbGF0Zm9ybS90ZWxlbWV0cnkvY29tbW9uL3RlbGVtZXRyeS5qcyc7XG5pbXBvcnQgeyBBdXRoZW50aWNhdGlvblNlc3Npb24sIElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLCBJQXV0aGVudGljYXRpb25TZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vY29tbW9uL2F1dGhlbnRpY2F0aW9uLmpzJztcbmltcG9ydCB7IElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2V4dGVuc2lvbk1hbmFnZW1lbnQvY29tbW9uL2V4dGVuc2lvbk1hbmFnZW1lbnQuanMnO1xuaW1wb3J0IHsgSUV4dGVuc2lvbiwgSUV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vZXh0ZW5zaW9ucy9jb21tb24vZXh0ZW5zaW9ucy5qcyc7XG5pbXBvcnQgeyBDaGF0Q29udGV4dEtleXMgfSBmcm9tICcuL2NoYXRDb250ZXh0S2V5cy5qcyc7XG5pbXBvcnQgeyBJT3BlbmVyU2VydmljZSB9IGZyb20gJy4uLy4uLy4uLy4uL3BsYXRmb3JtL29wZW5lci9jb21tb24vb3BlbmVyLmpzJztcbmltcG9ydCB7IFVSSSB9IGZyb20gJy4uLy4uLy4uLy4uL2Jhc2UvY29tbW9uL3VyaS5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2Vudmlyb25tZW50L2NvbW1vbi9lbnZpcm9ubWVudFNlcnZpY2UuanMnO1xuaW1wb3J0IHsgaXNXZWIgfSBmcm9tICcuLi8uLi8uLi8uLi9iYXNlL2NvbW1vbi9wbGF0Zm9ybS5qcyc7XG5pbXBvcnQgeyBJTGlmZWN5Y2xlU2VydmljZSB9IGZyb20gJy4uLy4uLy4uL3NlcnZpY2VzL2xpZmVjeWNsZS9jb21tb24vbGlmZWN5Y2xlLmpzJztcblxuZXhwb3J0IGNvbnN0IElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlID0gY3JlYXRlRGVjb3JhdG9yPElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlPignY2hhdEVudGl0bGVtZW50U2VydmljZScpO1xuXG5leHBvcnQgZW51bSBDaGF0RW50aXRsZW1lbnQge1xuXHQvKiogU2lnbmVkIG91dCAqL1xuXHRVbmtub3duID0gMSxcblx0LyoqIFNpZ25lZCBpbiBidXQgbm90IHlldCByZXNvbHZlZCAqL1xuXHRVbnJlc29sdmVkLFxuXHQvKiogU2lnbmVkIGluIGFuZCBlbnRpdGxlZCB0byBMaW1pdGVkICovXG5cdEF2YWlsYWJsZSxcblx0LyoqIFNpZ25lZCBpbiBidXQgbm90IGVudGl0bGVkIHRvIExpbWl0ZWQgKi9cblx0VW5hdmFpbGFibGUsXG5cdC8qKiBTaWduZWQtdXAgdG8gTGltaXRlZCAqL1xuXHRMaW1pdGVkLFxuXHQvKiogU2lnbmVkLXVwIHRvIFBybyAqL1xuXHRQcm9cbn1cblxuZXhwb3J0IGVudW0gQ2hhdFNlbnRpbWVudCB7XG5cdC8qKiBPdXQgb2YgdGhlIGJveCB2YWx1ZSAqL1xuXHRTdGFuZGFyZCA9IDEsXG5cdC8qKiBFeHBsaWNpdGx5IGRpc2FibGVkL2hpZGRlbiBieSB1c2VyICovXG5cdERpc2FibGVkID0gMixcblx0LyoqIEV4dGVuc2lvbnMgaW5zdGFsbGVkICovXG5cdEluc3RhbGxlZCA9IDNcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdFF1b3RhcyB7XG5cdHJlYWRvbmx5IGNoYXRRdW90YUV4Y2VlZGVkOiBib29sZWFuO1xuXHRyZWFkb25seSBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IHF1b3RhUmVzZXREYXRlOiBEYXRlIHwgdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IGNoYXRUb3RhbD86IG51bWJlcjtcblx0cmVhZG9ubHkgY29tcGxldGlvbnNUb3RhbD86IG51bWJlcjtcblxuXHRyZWFkb25seSBjaGF0UmVtYWluaW5nPzogbnVtYmVyO1xuXHRyZWFkb25seSBjb21wbGV0aW9uc1JlbWFpbmluZz86IG51bWJlcjtcbn1cblxuZXhwb3J0IGludGVyZmFjZSBJQ2hhdEVudGl0bGVtZW50U2VydmljZSB7XG5cblx0X3NlcnZpY2VCcmFuZDogdW5kZWZpbmVkO1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlRW50aXRsZW1lbnQ6IEV2ZW50PHZvaWQ+O1xuXG5cdHJlYWRvbmx5IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQ7XG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VRdW90YUV4Y2VlZGVkOiBFdmVudDx2b2lkPjtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VRdW90YVJlbWFpbmluZzogRXZlbnQ8dm9pZD47XG5cblx0cmVhZG9ubHkgcXVvdGFzOiBJQ2hhdFF1b3RhcztcblxuXHR1cGRhdGUodG9rZW46IENhbmNlbGxhdGlvblRva2VuKTogUHJvbWlzZTx2b2lkPjtcblxuXHRyZWFkb25seSBvbkRpZENoYW5nZVNlbnRpbWVudDogRXZlbnQ8dm9pZD47XG5cblx0cmVhZG9ubHkgc2VudGltZW50OiBDaGF0U2VudGltZW50O1xufVxuXG4vLyNyZWdpb24gU2VydmljZSBJbXBsZW1lbnRhdGlvblxuXG5jb25zdCBkZWZhdWx0Q2hhdCA9IHtcblx0ZXh0ZW5zaW9uSWQ6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uZXh0ZW5zaW9uSWQgPz8gJycsXG5cdGNoYXRFeHRlbnNpb25JZDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5jaGF0RXh0ZW5zaW9uSWQgPz8gJycsXG5cdHVwZ3JhZGVQbGFuVXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnVwZ3JhZGVQbGFuVXJsID8/ICcnLFxuXHRwcm92aWRlcklkOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LnByb3ZpZGVySWQgPz8gJycsXG5cdGVudGVycHJpc2VQcm92aWRlcklkOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmVudGVycHJpc2VQcm92aWRlcklkID8/ICcnLFxuXHRwcm92aWRlclNjb3BlczogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5wcm92aWRlclNjb3BlcyA/PyBbW11dLFxuXHRlbnRpdGxlbWVudFVybDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5lbnRpdGxlbWVudFVybCA/PyAnJyxcblx0ZW50aXRsZW1lbnRTaWdudXBMaW1pdGVkVXJsOiBwcm9kdWN0LmRlZmF1bHRDaGF0QWdlbnQ/LmVudGl0bGVtZW50U2lnbnVwTGltaXRlZFVybCA/PyAnJyxcblx0Y29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmc6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY29tcGxldGlvbnNBZHZhbmNlZFNldHRpbmcgPz8gJycsXG5cdGNoYXRRdW90YUV4Y2VlZGVkQ29udGV4dDogcHJvZHVjdC5kZWZhdWx0Q2hhdEFnZW50Py5jaGF0UXVvdGFFeGNlZWRlZENvbnRleHQgPz8gJycsXG5cdGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZENvbnRleHQ6IHByb2R1Y3QuZGVmYXVsdENoYXRBZ2VudD8uY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkQ29udGV4dCA/PyAnJ1xufTtcblxuaW50ZXJmYWNlIElDaGF0UXVvdGFzQWNjZXNzb3Ige1xuXHRjbGVhclF1b3RhcygpOiB2b2lkO1xuXHRhY2NlcHRRdW90YXMocXVvdGFzOiBJQ2hhdFF1b3Rhcyk6IHZvaWQ7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIGV4dGVuZHMgRGlzcG9zYWJsZSBpbXBsZW1lbnRzIElDaGF0RW50aXRsZW1lbnRTZXJ2aWNlIHtcblxuXHRkZWNsYXJlIF9zZXJ2aWNlQnJhbmQ6IHVuZGVmaW5lZDtcblxuXHRyZWFkb25seSBjb250ZXh0OiBMYXp5PENoYXRFbnRpdGxlbWVudENvbnRleHQ+IHwgdW5kZWZpbmVkO1xuXHRyZWFkb25seSByZXF1ZXN0czogTGF6eTxDaGF0RW50aXRsZW1lbnRSZXF1ZXN0cz4gfCB1bmRlZmluZWQ7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0QElJbnN0YW50aWF0aW9uU2VydmljZSBpbnN0YW50aWF0aW9uU2VydmljZTogSUluc3RhbnRpYXRpb25TZXJ2aWNlLFxuXHRcdEBJUHJvZHVjdFNlcnZpY2UgcHJvZHVjdFNlcnZpY2U6IElQcm9kdWN0U2VydmljZSxcblx0XHRASVdvcmtiZW5jaEVudmlyb25tZW50U2VydmljZSBlbnZpcm9ubWVudFNlcnZpY2U6IElXb3JrYmVuY2hFbnZpcm9ubWVudFNlcnZpY2UsXG5cdFx0QElDb250ZXh0S2V5U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNoYXRRdW90YUV4Y2VlZGVkQ29udGV4dEtleSA9IENoYXRDb250ZXh0S2V5cy5jaGF0UXVvdGFFeGNlZWRlZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5jb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRDb250ZXh0S2V5ID0gQ2hhdENvbnRleHRLZXlzLmNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZC5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSk7XG5cblx0XHR0aGlzLm9uRGlkQ2hhbmdlRW50aXRsZW1lbnQgPSBFdmVudC5tYXAoXG5cdFx0XHRFdmVudC5maWx0ZXIoXG5cdFx0XHRcdHRoaXMuY29udGV4dEtleVNlcnZpY2Uub25EaWRDaGFuZ2VDb250ZXh0LCBlID0+IGUuYWZmZWN0c1NvbWUobmV3IFNldChbXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLkVudGl0bGVtZW50LnByby5rZXksXG5cdFx0XHRcdFx0Q2hhdENvbnRleHRLZXlzLkVudGl0bGVtZW50LmxpbWl0ZWQua2V5LFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5jYW5TaWduVXAua2V5LFxuXHRcdFx0XHRcdENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5zaWduZWRPdXQua2V5XG5cdFx0XHRcdF0pKSwgdGhpcy5fc3RvcmVcblx0XHRcdCksICgpID0+IHsgfSwgdGhpcy5fc3RvcmVcblx0XHQpO1xuXG5cdFx0dGhpcy5vbkRpZENoYW5nZVNlbnRpbWVudCA9IEV2ZW50Lm1hcChcblx0XHRcdEV2ZW50LmZpbHRlcihcblx0XHRcdFx0dGhpcy5jb250ZXh0S2V5U2VydmljZS5vbkRpZENoYW5nZUNvbnRleHQsIGUgPT4gZS5hZmZlY3RzU29tZShuZXcgU2V0KFtcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuU2V0dXAuaGlkZGVuLmtleSxcblx0XHRcdFx0XHRDaGF0Q29udGV4dEtleXMuU2V0dXAuaW5zdGFsbGVkLmtleVxuXHRcdFx0XHRdKSksIHRoaXMuX3N0b3JlXG5cdFx0XHQpLCAoKSA9PiB7IH0sIHRoaXMuX3N0b3JlXG5cdFx0KTtcblxuXHRcdGlmIChcblx0XHRcdCFwcm9kdWN0U2VydmljZS5kZWZhdWx0Q2hhdEFnZW50IHx8XHRcdFx0XHQvLyBuZWVkcyBwcm9kdWN0IGNvbmZpZ1xuXHRcdFx0KGlzV2ViICYmICFlbnZpcm9ubWVudFNlcnZpY2UucmVtb3RlQXV0aG9yaXR5KVx0Ly8gb25seSBlbmFibGVkIGxvY2FsbHkgb3IgYSByZW1vdGUgYmFja2VuZFxuXHRcdCkge1xuXHRcdFx0Q2hhdENvbnRleHRLZXlzLlNldHVwLmhpZGRlbi5iaW5kVG8odGhpcy5jb250ZXh0S2V5U2VydmljZSkuc2V0KHRydWUpOyAvLyBoaWRlIGNvcGlsb3QgVUlcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHRjb25zdCBjb250ZXh0ID0gdGhpcy5jb250ZXh0ID0gbmV3IExhenkoKCkgPT4gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVudGl0bGVtZW50Q29udGV4dCkpKTtcblx0XHR0aGlzLnJlcXVlc3RzID0gbmV3IExhenkoKCkgPT4gdGhpcy5fcmVnaXN0ZXIoaW5zdGFudGlhdGlvblNlcnZpY2UuY3JlYXRlSW5zdGFuY2UoQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMsIGNvbnRleHQudmFsdWUsIHtcblx0XHRcdGNsZWFyUXVvdGFzOiAoKSA9PiB0aGlzLmNsZWFyUXVvdGFzKCksXG5cdFx0XHRhY2NlcHRRdW90YXM6IHF1b3RhcyA9PiB0aGlzLmFjY2VwdFF1b3RhcyhxdW90YXMpXG5cdFx0fSkpKTtcblxuXHRcdHRoaXMucmVnaXN0ZXJMaXN0ZW5lcnMoKTtcblx0fVxuXG5cdC8vI3JlZ2lvbiAtLS0gRW50aXRsZW1lbnRzXG5cblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VFbnRpdGxlbWVudDogRXZlbnQ8dm9pZD47XG5cblx0Z2V0IGVudGl0bGVtZW50KCk6IENoYXRFbnRpdGxlbWVudCB7XG5cdFx0aWYgKHRoaXMuY29udGV4dEtleVNlcnZpY2UuZ2V0Q29udGV4dEtleVZhbHVlPGJvb2xlYW4+KENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5wcm8ua2V5KSA9PT0gdHJ1ZSkge1xuXHRcdFx0cmV0dXJuIENoYXRFbnRpdGxlbWVudC5Qcm87XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQubGltaXRlZC5rZXkpID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQ7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQuY2FuU2lnblVwLmtleSkgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBDaGF0RW50aXRsZW1lbnQuQXZhaWxhYmxlO1xuXHRcdH0gZWxzZSBpZiAodGhpcy5jb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0S2V5VmFsdWU8Ym9vbGVhbj4oQ2hhdENvbnRleHRLZXlzLkVudGl0bGVtZW50LnNpZ25lZE91dC5rZXkpID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gQ2hhdEVudGl0bGVtZW50LlVua25vd247XG5cdFx0fVxuXG5cdFx0cmV0dXJuIENoYXRFbnRpdGxlbWVudC5VbnJlc29sdmVkO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0Ly8jcmVnaW9uIC0tLSBRdW90YXNcblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZVF1b3RhRXhjZWVkZWQgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VRdW90YUV4Y2VlZGVkID0gdGhpcy5fb25EaWRDaGFuZ2VRdW90YUV4Y2VlZGVkLmV2ZW50O1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlUXVvdGFSZW1haW5pbmcgPSB0aGlzLl9yZWdpc3RlcihuZXcgRW1pdHRlcjx2b2lkPigpKTtcblx0cmVhZG9ubHkgb25EaWRDaGFuZ2VRdW90YVJlbWFpbmluZyA9IHRoaXMuX29uRGlkQ2hhbmdlUXVvdGFSZW1haW5pbmcuZXZlbnQ7XG5cblx0cHJpdmF0ZSBfcXVvdGFzOiBJQ2hhdFF1b3RhcyA9IHsgY2hhdFF1b3RhRXhjZWVkZWQ6IGZhbHNlLCBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQ6IGZhbHNlLCBxdW90YVJlc2V0RGF0ZTogdW5kZWZpbmVkIH07XG5cdGdldCBxdW90YXMoKSB7IHJldHVybiB0aGlzLl9xdW90YXM7IH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IGNoYXRRdW90YUV4Y2VlZGVkQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cblx0cHJpdmF0ZSBFeHRlbnNpb25RdW90YUNvbnRleHRLZXlzID0ge1xuXHRcdGNoYXRRdW90YUV4Y2VlZGVkOiBkZWZhdWx0Q2hhdC5jaGF0UXVvdGFFeGNlZWRlZENvbnRleHQsXG5cdFx0Y29tcGxldGlvbnNRdW90YUV4Y2VlZGVkOiBkZWZhdWx0Q2hhdC5jb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRDb250ZXh0LFxuXHR9O1xuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0Y29uc3QgY2hhdFF1b3RhRXhjZWVkZWRTZXQgPSBuZXcgU2V0KFt0aGlzLkV4dGVuc2lvblF1b3RhQ29udGV4dEtleXMuY2hhdFF1b3RhRXhjZWVkZWRdKTtcblx0XHRjb25zdCBjb21wbGV0aW9uc1F1b3RhRXhjZWVkZWRTZXQgPSBuZXcgU2V0KFt0aGlzLkV4dGVuc2lvblF1b3RhQ29udGV4dEtleXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkXSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLm9uRGlkQ2hhbmdlQ29udGV4dChlID0+IHtcblx0XHRcdGxldCBjaGFuZ2VkID0gZmFsc2U7XG5cdFx0XHRpZiAoZS5hZmZlY3RzU29tZShjaGF0UXVvdGFFeGNlZWRlZFNldCkpIHtcblx0XHRcdFx0Y29uc3QgbmV3Q2hhdFF1b3RhRXhjZWVkZWQgPSB0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPih0aGlzLkV4dGVuc2lvblF1b3RhQ29udGV4dEtleXMuY2hhdFF1b3RhRXhjZWVkZWQpO1xuXHRcdFx0XHRpZiAodHlwZW9mIG5ld0NoYXRRdW90YUV4Y2VlZGVkID09PSAnYm9vbGVhbicgJiYgbmV3Q2hhdFF1b3RhRXhjZWVkZWQgIT09IHRoaXMuX3F1b3Rhcy5jaGF0UXVvdGFFeGNlZWRlZCkge1xuXHRcdFx0XHRcdHRoaXMuX3F1b3RhcyA9IHtcblx0XHRcdFx0XHRcdC4uLnRoaXMuX3F1b3Rhcyxcblx0XHRcdFx0XHRcdGNoYXRRdW90YUV4Y2VlZGVkOiBuZXdDaGF0UXVvdGFFeGNlZWRlZCxcblx0XHRcdFx0XHR9O1xuXHRcdFx0XHRcdGNoYW5nZWQgPSB0cnVlO1xuXHRcdFx0XHR9XG5cdFx0XHR9XG5cblx0XHRcdGlmIChlLmFmZmVjdHNTb21lKGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZFNldCkpIHtcblx0XHRcdFx0Y29uc3QgbmV3Q29tcGxldGlvbnNRdW90YUV4Y2VlZGVkID0gdGhpcy5jb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0S2V5VmFsdWU8Ym9vbGVhbj4odGhpcy5FeHRlbnNpb25RdW90YUNvbnRleHRLZXlzLmNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCk7XG5cdFx0XHRcdGlmICh0eXBlb2YgbmV3Q29tcGxldGlvbnNRdW90YUV4Y2VlZGVkID09PSAnYm9vbGVhbicgJiYgbmV3Q29tcGxldGlvbnNRdW90YUV4Y2VlZGVkICE9PSB0aGlzLl9xdW90YXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkKSB7XG5cdFx0XHRcdFx0dGhpcy5fcXVvdGFzID0ge1xuXHRcdFx0XHRcdFx0Li4udGhpcy5fcXVvdGFzLFxuXHRcdFx0XHRcdFx0Y29tcGxldGlvbnNRdW90YUV4Y2VlZGVkOiBuZXdDb21wbGV0aW9uc1F1b3RhRXhjZWVkZWQsXG5cdFx0XHRcdFx0fTtcblx0XHRcdFx0XHRjaGFuZ2VkID0gdHJ1ZTtcblx0XHRcdFx0fVxuXHRcdFx0fVxuXG5cdFx0XHRpZiAoY2hhbmdlZCkge1xuXHRcdFx0XHR0aGlzLnVwZGF0ZUNvbnRleHRLZXlzKCk7XG5cdFx0XHRcdHRoaXMuX29uRGlkQ2hhbmdlUXVvdGFFeGNlZWRlZC5maXJlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXHR9XG5cblx0YWNjZXB0UXVvdGFzKHF1b3RhczogSUNoYXRRdW90YXMpOiB2b2lkIHtcblx0XHRjb25zdCBvbGRRdW90YSA9IHRoaXMuX3F1b3Rhcztcblx0XHR0aGlzLl9xdW90YXMgPSBxdW90YXM7XG5cdFx0dGhpcy51cGRhdGVDb250ZXh0S2V5cygpO1xuXG5cdFx0aWYgKFxuXHRcdFx0b2xkUXVvdGEuY2hhdFF1b3RhRXhjZWVkZWQgIT09IHRoaXMuX3F1b3Rhcy5jaGF0UXVvdGFFeGNlZWRlZCB8fFxuXHRcdFx0b2xkUXVvdGEuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkICE9PSB0aGlzLl9xdW90YXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVF1b3RhRXhjZWVkZWQuZmlyZSgpO1xuXHRcdH1cblxuXHRcdGlmIChcblx0XHRcdG9sZFF1b3RhLmNoYXRSZW1haW5pbmcgIT09IHRoaXMuX3F1b3Rhcy5jaGF0UmVtYWluaW5nIHx8XG5cdFx0XHRvbGRRdW90YS5jb21wbGV0aW9uc1JlbWFpbmluZyAhPT0gdGhpcy5fcXVvdGFzLmNvbXBsZXRpb25zUmVtYWluaW5nXG5cdFx0KSB7XG5cdFx0XHR0aGlzLl9vbkRpZENoYW5nZVF1b3RhUmVtYWluaW5nLmZpcmUoKTtcblx0XHR9XG5cdH1cblxuXHRjbGVhclF1b3RhcygpOiB2b2lkIHtcblx0XHRpZiAodGhpcy5xdW90YXMuY2hhdFF1b3RhRXhjZWVkZWQgfHwgdGhpcy5xdW90YXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkKSB7XG5cdFx0XHR0aGlzLmFjY2VwdFF1b3Rhcyh7IGNoYXRRdW90YUV4Y2VlZGVkOiBmYWxzZSwgY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkOiBmYWxzZSwgcXVvdGFSZXNldERhdGU6IHVuZGVmaW5lZCB9KTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIHVwZGF0ZUNvbnRleHRLZXlzKCk6IHZvaWQge1xuXHRcdHRoaXMuY2hhdFF1b3RhRXhjZWVkZWRDb250ZXh0S2V5LnNldCh0aGlzLl9xdW90YXMuY2hhdFF1b3RhRXhjZWVkZWQpO1xuXHRcdHRoaXMuY29tcGxldGlvbnNRdW90YUV4Y2VlZGVkQ29udGV4dEtleS5zZXQodGhpcy5fcXVvdGFzLmNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZCk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cblxuXHQvLyNyZWdpb24gLS0tIFNlbnRpbWVudFxuXG5cdHByaXZhdGUgcmVhZG9ubHkgX29uRGlkQ2hhbmdlU2VudGltZW50ID0gdGhpcy5fcmVnaXN0ZXIobmV3IEVtaXR0ZXI8dm9pZD4oKSk7XG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2VudGltZW50ID0gdGhpcy5fb25EaWRDaGFuZ2VTZW50aW1lbnQuZXZlbnQ7XG5cblx0Z2V0IHNlbnRpbWVudCgpOiBDaGF0U2VudGltZW50IHtcblx0XHRpZiAodGhpcy5jb250ZXh0S2V5U2VydmljZS5nZXRDb250ZXh0S2V5VmFsdWU8Ym9vbGVhbj4oQ2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZC5rZXkpID09PSB0cnVlKSB7XG5cdFx0XHRyZXR1cm4gQ2hhdFNlbnRpbWVudC5JbnN0YWxsZWQ7XG5cdFx0fSBlbHNlIGlmICh0aGlzLmNvbnRleHRLZXlTZXJ2aWNlLmdldENvbnRleHRLZXlWYWx1ZTxib29sZWFuPihDaGF0Q29udGV4dEtleXMuU2V0dXAuaGlkZGVuLmtleSkgPT09IHRydWUpIHtcblx0XHRcdHJldHVybiBDaGF0U2VudGltZW50LkRpc2FibGVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBDaGF0U2VudGltZW50LlN0YW5kYXJkO1xuXHR9XG5cblx0Ly8jZW5kcmVnaW9uXG5cblx0YXN5bmMgdXBkYXRlKHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMucmVxdWVzdHM/LnZhbHVlLmZvcmNlUmVzb2x2ZUVudGl0bGVtZW50KHVuZGVmaW5lZCwgdG9rZW4pO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQ2hhdCBFbnRpdGxlbWVudCBSZXF1ZXN0IFNlcnZpY2VcblxudHlwZSBFbnRpdGxlbWVudENsYXNzaWZpY2F0aW9uID0ge1xuXHR0aWQ6IHsgY2xhc3NpZmljYXRpb246ICdFbmRVc2VyUHNldWRvbnltaXplZEluZm9ybWF0aW9uJzsgcHVycG9zZTogJ0J1c2luZXNzSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgYW5vbnltaXplZCBhbmFseXRpY3MgaWQgcmV0dXJuZWQgYnkgdGhlIHNlcnZpY2UnOyBlbmRwb2ludDogJ0dvb2dsZUFuYWx5dGljc0lkJyB9O1xuXHRlbnRpdGxlbWVudDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ0ZsYWcgaW5kaWNhdGluZyB0aGUgY2hhdCBlbnRpdGxlbWVudCBzdGF0ZScgfTtcblx0cXVvdGFDaGF0OiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIG51bWJlciBvZiBjaGF0IGNvbXBsZXRpb25zIGF2YWlsYWJsZSB0byB0aGUgdXNlcicgfTtcblx0cXVvdGFDb21wbGV0aW9uczogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBudW1iZXIgb2YgY2hhdCBjb21wbGV0aW9ucyBhdmFpbGFibGUgdG8gdGhlIHVzZXInIH07XG5cdHF1b3RhUmVzZXREYXRlOiB7IGNsYXNzaWZpY2F0aW9uOiAnU3lzdGVtTWV0YURhdGEnOyBwdXJwb3NlOiAnRmVhdHVyZUluc2lnaHQnOyBjb21tZW50OiAnVGhlIGRhdGUgdGhlIHF1b3RhIHdpbGwgcmVzZXQnIH07XG5cdG93bmVyOiAnYnBhc2Vybyc7XG5cdGNvbW1lbnQ6ICdSZXBvcnRpbmcgY2hhdCBlbnRpdGxlbWVudHMnO1xufTtcblxudHlwZSBFbnRpdGxlbWVudEV2ZW50ID0ge1xuXHRlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50O1xuXHR0aWQ6IHN0cmluZztcblx0cXVvdGFDaGF0OiBudW1iZXIgfCB1bmRlZmluZWQ7XG5cdHF1b3RhQ29tcGxldGlvbnM6IG51bWJlciB8IHVuZGVmaW5lZDtcblx0cXVvdGFSZXNldERhdGU6IHN0cmluZyB8IHVuZGVmaW5lZDtcbn07XG5cbmludGVyZmFjZSBJRW50aXRsZW1lbnRzUmVzcG9uc2Uge1xuXHRyZWFkb25seSBhY2Nlc3NfdHlwZV9za3U6IHN0cmluZztcblx0cmVhZG9ubHkgYXNzaWduZWRfZGF0ZTogc3RyaW5nO1xuXHRyZWFkb25seSBjYW5fc2lnbnVwX2Zvcl9saW1pdGVkOiBib29sZWFuO1xuXHRyZWFkb25seSBjaGF0X2VuYWJsZWQ6IGJvb2xlYW47XG5cdHJlYWRvbmx5IGFuYWx5dGljc190cmFja2luZ19pZDogc3RyaW5nO1xuXHRyZWFkb25seSBsaW1pdGVkX3VzZXJfcXVvdGFzPzoge1xuXHRcdHJlYWRvbmx5IGNoYXQ6IG51bWJlcjtcblx0XHRyZWFkb25seSBjb21wbGV0aW9uczogbnVtYmVyO1xuXHR9O1xuXHRyZWFkb25seSBtb250aGx5X3F1b3Rhcz86IHtcblx0XHRyZWFkb25seSBjaGF0OiBudW1iZXI7XG5cdFx0cmVhZG9ubHkgY29tcGxldGlvbnM6IG51bWJlcjtcblx0fTtcblx0cmVhZG9ubHkgbGltaXRlZF91c2VyX3Jlc2V0X2RhdGU6IHN0cmluZztcbn1cblxuaW50ZXJmYWNlIElFbnRpdGxlbWVudHMge1xuXHRyZWFkb25seSBlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50O1xuXHRyZWFkb25seSBxdW90YXM/OiBJUXVvdGFzO1xufVxuXG5pbnRlcmZhY2UgSVF1b3RhcyB7XG5cdHJlYWRvbmx5IGNoYXRUb3RhbD86IG51bWJlcjtcblx0cmVhZG9ubHkgY29tcGxldGlvbnNUb3RhbD86IG51bWJlcjtcblxuXHRyZWFkb25seSBjaGF0UmVtYWluaW5nPzogbnVtYmVyO1xuXHRyZWFkb25seSBjb21wbGV0aW9uc1JlbWFpbmluZz86IG51bWJlcjtcblxuXHRyZWFkb25seSByZXNldERhdGU/OiBzdHJpbmc7XG59XG5cbmV4cG9ydCBjbGFzcyBDaGF0RW50aXRsZW1lbnRSZXF1ZXN0cyBleHRlbmRzIERpc3Bvc2FibGUge1xuXG5cdHN0YXRpYyBwcm92aWRlcklkKGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UpOiBzdHJpbmcge1xuXHRcdGlmIChjb25maWd1cmF0aW9uU2VydmljZS5nZXRWYWx1ZTxzdHJpbmcgfCB1bmRlZmluZWQ+KGAke2RlZmF1bHRDaGF0LmNvbXBsZXRpb25zQWR2YW5jZWRTZXR0aW5nfS5hdXRoUHJvdmlkZXJgKSA9PT0gZGVmYXVsdENoYXQuZW50ZXJwcmlzZVByb3ZpZGVySWQpIHtcblx0XHRcdHJldHVybiBkZWZhdWx0Q2hhdC5lbnRlcnByaXNlUHJvdmlkZXJJZDtcblx0XHR9XG5cblx0XHRyZXR1cm4gZGVmYXVsdENoYXQucHJvdmlkZXJJZDtcblx0fVxuXG5cdHByaXZhdGUgc3RhdGU6IElFbnRpdGxlbWVudHM7XG5cblx0cHJpdmF0ZSBwZW5kaW5nUmVzb2x2ZUN0cyA9IG5ldyBDYW5jZWxsYXRpb25Ub2tlblNvdXJjZSgpO1xuXHRwcml2YXRlIGRpZFJlc29sdmVFbnRpdGxlbWVudHMgPSBmYWxzZTtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRwcml2YXRlIHJlYWRvbmx5IGNvbnRleHQ6IENoYXRFbnRpdGxlbWVudENvbnRleHQsXG5cdFx0cHJpdmF0ZSByZWFkb25seSBjaGF0UXVvdGFzQWNjZXNzb3I6IElDaGF0UXVvdGFzQWNjZXNzb3IsXG5cdFx0QElUZWxlbWV0cnlTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgdGVsZW1ldHJ5U2VydmljZTogSVRlbGVtZXRyeVNlcnZpY2UsXG5cdFx0QElBdXRoZW50aWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXRoZW50aWNhdGlvblNlcnZpY2U6IElBdXRoZW50aWNhdGlvblNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElSZXF1ZXN0U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHJlcXVlc3RTZXJ2aWNlOiBJUmVxdWVzdFNlcnZpY2UsXG5cdFx0QElEaWFsb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgZGlhbG9nU2VydmljZTogSURpYWxvZ1NlcnZpY2UsXG5cdFx0QElPcGVuZXJTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgb3BlbmVyU2VydmljZTogSU9wZW5lclNlcnZpY2UsXG5cdFx0QElDb25maWd1cmF0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGNvbmZpZ3VyYXRpb25TZXJ2aWNlOiBJQ29uZmlndXJhdGlvblNlcnZpY2UsXG5cdFx0QElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZTogSUF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UsXG5cdFx0QElMaWZlY3ljbGVTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbGlmZWN5Y2xlU2VydmljZTogSUxpZmVjeWNsZVNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLnN0YXRlID0geyBlbnRpdGxlbWVudDogdGhpcy5jb250ZXh0LnN0YXRlLmVudGl0bGVtZW50IH07XG5cblx0XHR0aGlzLnJlZ2lzdGVyTGlzdGVuZXJzKCk7XG5cblx0XHR0aGlzLnJlc29sdmUoKTtcblx0fVxuXG5cdHByaXZhdGUgcmVnaXN0ZXJMaXN0ZW5lcnMoKTogdm9pZCB7XG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VEZWNsYXJlZFByb3ZpZGVycygoKSA9PiB0aGlzLnJlc29sdmUoKSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2Uub25EaWRDaGFuZ2VTZXNzaW9ucyhlID0+IHtcblx0XHRcdGlmIChlLnByb3ZpZGVySWQgPT09IENoYXRFbnRpdGxlbWVudFJlcXVlc3RzLnByb3ZpZGVySWQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdFx0dGhpcy5yZXNvbHZlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2Uub25EaWRSZWdpc3RlckF1dGhlbnRpY2F0aW9uUHJvdmlkZXIoZSA9PiB7XG5cdFx0XHRpZiAoZS5pZCA9PT0gQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMucHJvdmlkZXJJZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSkge1xuXHRcdFx0XHR0aGlzLnJlc29sdmUoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cblx0XHR0aGlzLl9yZWdpc3Rlcih0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5vbkRpZFVucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGUgPT4ge1xuXHRcdFx0aWYgKGUuaWQgPT09IENoYXRFbnRpdGxlbWVudFJlcXVlc3RzLnByb3ZpZGVySWQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpIHtcblx0XHRcdFx0dGhpcy5yZXNvbHZlKCk7XG5cdFx0XHR9XG5cdFx0fSkpO1xuXG5cdFx0dGhpcy5fcmVnaXN0ZXIodGhpcy5jb250ZXh0Lm9uRGlkQ2hhbmdlKCgpID0+IHtcblx0XHRcdGlmICghdGhpcy5jb250ZXh0LnN0YXRlLmluc3RhbGxlZCB8fCB0aGlzLmNvbnRleHQuc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duKSB7XG5cdFx0XHRcdC8vIFdoZW4gdGhlIGV4dGVuc2lvbiBpcyBub3QgaW5zdGFsbGVkIG9yIHRoZSB1c2VyIGlzIG5vdCBlbnRpdGxlZFxuXHRcdFx0XHQvLyBtYWtlIHN1cmUgdG8gY2xlYXIgcXVvdGFzIHNvIHRoYXQgYW55IGluZGljYXRvcnMgYXJlIGFsc28gZ29uZVxuXHRcdFx0XHR0aGlzLnN0YXRlID0geyBlbnRpdGxlbWVudDogdGhpcy5zdGF0ZS5lbnRpdGxlbWVudCwgcXVvdGFzOiB1bmRlZmluZWQgfTtcblx0XHRcdFx0dGhpcy5jaGF0UXVvdGFzQWNjZXNzb3IuY2xlYXJRdW90YXMoKTtcblx0XHRcdH1cblx0XHR9KSk7XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIHJlc29sdmUoKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0dGhpcy5wZW5kaW5nUmVzb2x2ZUN0cy5kaXNwb3NlKHRydWUpO1xuXHRcdGNvbnN0IGN0cyA9IHRoaXMucGVuZGluZ1Jlc29sdmVDdHMgPSBuZXcgQ2FuY2VsbGF0aW9uVG9rZW5Tb3VyY2UoKTtcblxuXHRcdGNvbnN0IHNlc3Npb24gPSBhd2FpdCB0aGlzLmZpbmRNYXRjaGluZ1Byb3ZpZGVyU2Vzc2lvbihjdHMudG9rZW4pO1xuXHRcdGlmIChjdHMudG9rZW4uaXNDYW5jZWxsYXRpb25SZXF1ZXN0ZWQpIHtcblx0XHRcdHJldHVybjtcblx0XHR9XG5cblx0XHQvLyBJbW1lZGlhdGVseSBzaWduYWwgd2hldGhlciB3ZSBoYXZlIGEgc2Vzc2lvbiBvciBub3Rcblx0XHRsZXQgc3RhdGU6IElFbnRpdGxlbWVudHMgfCB1bmRlZmluZWQgPSB1bmRlZmluZWQ7XG5cdFx0aWYgKHNlc3Npb24pIHtcblx0XHRcdC8vIERvIG5vdCBvdmVyd3JpdGUgYW55IHN0YXRlIHdlIGhhdmUgYWxyZWFkeVxuXHRcdFx0aWYgKHRoaXMuc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Vbmtub3duKSB7XG5cdFx0XHRcdHN0YXRlID0geyBlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50LlVucmVzb2x2ZWQgfTtcblx0XHRcdH1cblx0XHR9IGVsc2Uge1xuXHRcdFx0dGhpcy5kaWRSZXNvbHZlRW50aXRsZW1lbnRzID0gZmFsc2U7IC8vIHJlc2V0IHNvIHRoYXQgd2UgcmVzb2x2ZSBlbnRpdGxlbWVudHMgZnJlc2ggd2hlbiBzaWduZWQgaW4gYWdhaW5cblx0XHRcdHN0YXRlID0geyBlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50LlVua25vd24gfTtcblx0XHR9XG5cdFx0aWYgKHN0YXRlKSB7XG5cdFx0XHR0aGlzLnVwZGF0ZShzdGF0ZSk7XG5cdFx0fVxuXG5cdFx0aWYgKHNlc3Npb24gJiYgIXRoaXMuZGlkUmVzb2x2ZUVudGl0bGVtZW50cykge1xuXHRcdFx0Ly8gQWZ0ZXJ3YXJkcyByZXNvbHZlIGVudGl0bGVtZW50IHdpdGggYSBuZXR3b3JrIHJlcXVlc3Rcblx0XHRcdC8vIGJ1dCBvbmx5IHVubGVzcyBpdCB3YXMgbm90IGFscmVhZHkgcmVzb2x2ZWQgYmVmb3JlLlxuXHRcdFx0YXdhaXQgdGhpcy5yZXNvbHZlRW50aXRsZW1lbnQoc2Vzc2lvbiwgY3RzLnRva2VuKTtcblx0XHR9XG5cdH1cblxuXHRwcml2YXRlIGFzeW5jIGZpbmRNYXRjaGluZ1Byb3ZpZGVyU2Vzc2lvbih0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHNlc3Npb25zID0gYXdhaXQgdGhpcy5kb0dldFNlc3Npb25zKENoYXRFbnRpdGxlbWVudFJlcXVlc3RzLnByb3ZpZGVySWQodGhpcy5jb25maWd1cmF0aW9uU2VydmljZSkpO1xuXHRcdGlmICh0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0cmV0dXJuIHVuZGVmaW5lZDtcblx0XHR9XG5cblx0XHRmb3IgKGNvbnN0IHNlc3Npb24gb2Ygc2Vzc2lvbnMpIHtcblx0XHRcdGZvciAoY29uc3Qgc2NvcGVzIG9mIGRlZmF1bHRDaGF0LnByb3ZpZGVyU2NvcGVzKSB7XG5cdFx0XHRcdGlmICh0aGlzLnNjb3Blc01hdGNoKHNlc3Npb24uc2NvcGVzLCBzY29wZXMpKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHNlc3Npb247XG5cdFx0XHRcdH1cblx0XHRcdH1cblx0XHR9XG5cblx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0dldFNlc3Npb25zKHByb3ZpZGVySWQ6IHN0cmluZyk6IFByb21pc2U8cmVhZG9ubHkgQXV0aGVudGljYXRpb25TZXNzaW9uW10+IHtcblx0XHR0cnkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLmdldFNlc3Npb25zKHByb3ZpZGVySWQpO1xuXHRcdH0gY2F0Y2ggKGVycm9yKSB7XG5cdFx0XHQvLyBpZ25vcmUgLSBlcnJvcnMgY2FuIHRocm93IGlmIGEgcHJvdmlkZXIgaXMgbm90IHJlZ2lzdGVyZWRcblx0XHR9XG5cblx0XHRyZXR1cm4gW107XG5cdH1cblxuXHRwcml2YXRlIHNjb3Blc01hdGNoKHNjb3BlczogUmVhZG9ubHlBcnJheTxzdHJpbmc+LCBleHBlY3RlZFNjb3Blczogc3RyaW5nW10pOiBib29sZWFuIHtcblx0XHRyZXR1cm4gc2NvcGVzLmxlbmd0aCA9PT0gZXhwZWN0ZWRTY29wZXMubGVuZ3RoICYmIGV4cGVjdGVkU2NvcGVzLmV2ZXJ5KHNjb3BlID0+IHNjb3Blcy5pbmNsdWRlcyhzY29wZSkpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXNvbHZlRW50aXRsZW1lbnQoc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFbnRpdGxlbWVudHMgfCB1bmRlZmluZWQ+IHtcblx0XHRjb25zdCBlbnRpdGxlbWVudHMgPSBhd2FpdCB0aGlzLmRvUmVzb2x2ZUVudGl0bGVtZW50KHNlc3Npb24sIHRva2VuKTtcblx0XHRpZiAodHlwZW9mIGVudGl0bGVtZW50cz8uZW50aXRsZW1lbnQgPT09ICdudW1iZXInICYmICF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0dGhpcy5kaWRSZXNvbHZlRW50aXRsZW1lbnRzID0gdHJ1ZTtcblx0XHRcdHRoaXMudXBkYXRlKGVudGl0bGVtZW50cyk7XG5cdFx0fVxuXG5cdFx0cmV0dXJuIGVudGl0bGVtZW50cztcblx0fVxuXG5cdHByaXZhdGUgYXN5bmMgZG9SZXNvbHZlRW50aXRsZW1lbnQoc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElFbnRpdGxlbWVudHMgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMucHJvdmlkZXJJZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKSA9PT0gZGVmYXVsdENoYXQuZW50ZXJwcmlzZVByb3ZpZGVySWQpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2NoYXQgZW50aXRsZW1lbnRdOiBlbnRlcnByaXNlIHByb3ZpZGVyLCBhc3N1bWluZyBQcm8nKTtcblx0XHRcdHJldHVybiB7IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQuUHJvIH07XG5cdFx0fVxuXG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGNvbnN0IHJlc3BvbnNlID0gYXdhaXQgdGhpcy5yZXF1ZXN0KGRlZmF1bHRDaGF0LmVudGl0bGVtZW50VXJsLCAnR0VUJywgdW5kZWZpbmVkLCBzZXNzaW9uLCB0b2tlbik7XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghcmVzcG9uc2UpIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZSgnW2NoYXQgZW50aXRsZW1lbnRdOiBubyByZXNwb25zZScpO1xuXHRcdFx0cmV0dXJuIHsgZW50aXRsZW1lbnQ6IENoYXRFbnRpdGxlbWVudC5VbnJlc29sdmVkIH07XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlICYmIHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlICE9PSAyMDApIHtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2NoYXQgZW50aXRsZW1lbnRdOiB1bmV4cGVjdGVkIHN0YXR1cyBjb2RlICR7cmVzcG9uc2UucmVzLnN0YXR1c0NvZGV9YCk7XG5cdFx0XHRyZXR1cm4gKFxuXHRcdFx0XHRyZXNwb25zZS5yZXMuc3RhdHVzQ29kZSA9PT0gNDAxIHx8XG5cdFx0XHRcdHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlID09PSA0MDMgfHxcblx0XHRcdFx0cmVzcG9uc2UucmVzLnN0YXR1c0NvZGUgPT09IDQwNFxuXHRcdFx0KSA/IHsgZW50aXRsZW1lbnQ6IENoYXRFbnRpdGxlbWVudC5Vbmtub3duIC8qIHRyZWF0IGFzIHNpZ25lZCBvdXQgKi8gfSA6IHsgZW50aXRsZW1lbnQ6IENoYXRFbnRpdGxlbWVudC5VbnJlc29sdmVkIH07XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3BvbnNlVGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdHJlc3BvbnNlVGV4dCA9IGF3YWl0IGFzVGV4dChyZXNwb25zZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGlnbm9yZSAtIGhhbmRsZWQgYmVsb3dcblx0XHR9XG5cdFx0aWYgKHRva2VuLmlzQ2FuY2VsbGF0aW9uUmVxdWVzdGVkKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdGlmICghcmVzcG9uc2VUZXh0KSB7XG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoJ1tjaGF0IGVudGl0bGVtZW50XTogcmVzcG9uc2UgaGFzIG5vIGNvbnRlbnQnKTtcblx0XHRcdHJldHVybiB7IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQuVW5yZXNvbHZlZCB9O1xuXHRcdH1cblxuXHRcdGxldCBlbnRpdGxlbWVudHNSZXNwb25zZTogSUVudGl0bGVtZW50c1Jlc3BvbnNlO1xuXHRcdHRyeSB7XG5cdFx0XHRlbnRpdGxlbWVudHNSZXNwb25zZSA9IEpTT04ucGFyc2UocmVzcG9uc2VUZXh0KTtcblx0XHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2NoYXQgZW50aXRsZW1lbnRdOiBwYXJzZWQgcmVzdWx0IGlzICR7SlNPTi5zdHJpbmdpZnkoZW50aXRsZW1lbnRzUmVzcG9uc2UpfWApO1xuXHRcdH0gY2F0Y2ggKGVycikge1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbY2hhdCBlbnRpdGxlbWVudF06IGVycm9yIHBhcnNpbmcgcmVzcG9uc2UgKCR7ZXJyfSlgKTtcblx0XHRcdHJldHVybiB7IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQuVW5yZXNvbHZlZCB9O1xuXHRcdH1cblxuXHRcdGxldCBlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50O1xuXHRcdGlmIChlbnRpdGxlbWVudHNSZXNwb25zZS5hY2Nlc3NfdHlwZV9za3UgPT09ICdmcmVlX2xpbWl0ZWRfY29waWxvdCcpIHtcblx0XHRcdGVudGl0bGVtZW50ID0gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQ7XG5cdFx0fSBlbHNlIGlmIChlbnRpdGxlbWVudHNSZXNwb25zZS5jYW5fc2lnbnVwX2Zvcl9saW1pdGVkKSB7XG5cdFx0XHRlbnRpdGxlbWVudCA9IENoYXRFbnRpdGxlbWVudC5BdmFpbGFibGU7XG5cdFx0fSBlbHNlIGlmIChlbnRpdGxlbWVudHNSZXNwb25zZS5jaGF0X2VuYWJsZWQpIHtcblx0XHRcdGVudGl0bGVtZW50ID0gQ2hhdEVudGl0bGVtZW50LlBybztcblx0XHR9IGVsc2Uge1xuXHRcdFx0ZW50aXRsZW1lbnQgPSBDaGF0RW50aXRsZW1lbnQuVW5hdmFpbGFibGU7XG5cdFx0fVxuXG5cdFx0Y29uc3QgY2hhdFJlbWFpbmluZyA9IGVudGl0bGVtZW50c1Jlc3BvbnNlLmxpbWl0ZWRfdXNlcl9xdW90YXM/LmNoYXQ7XG5cdFx0Y29uc3QgY29tcGxldGlvbnNSZW1haW5pbmcgPSBlbnRpdGxlbWVudHNSZXNwb25zZS5saW1pdGVkX3VzZXJfcXVvdGFzPy5jb21wbGV0aW9ucztcblxuXHRcdGNvbnN0IGVudGl0bGVtZW50czogSUVudGl0bGVtZW50cyA9IHtcblx0XHRcdGVudGl0bGVtZW50LFxuXHRcdFx0cXVvdGFzOiB7XG5cdFx0XHRcdGNoYXRUb3RhbDogZW50aXRsZW1lbnRzUmVzcG9uc2UubW9udGhseV9xdW90YXM/LmNoYXQsXG5cdFx0XHRcdGNvbXBsZXRpb25zVG90YWw6IGVudGl0bGVtZW50c1Jlc3BvbnNlLm1vbnRobHlfcXVvdGFzPy5jb21wbGV0aW9ucyxcblx0XHRcdFx0Y2hhdFJlbWFpbmluZzogdHlwZW9mIGNoYXRSZW1haW5pbmcgPT09ICdudW1iZXInID8gTWF0aC5tYXgoMCwgY2hhdFJlbWFpbmluZykgOiB1bmRlZmluZWQsXG5cdFx0XHRcdGNvbXBsZXRpb25zUmVtYWluaW5nOiB0eXBlb2YgY29tcGxldGlvbnNSZW1haW5pbmcgPT09ICdudW1iZXInID8gTWF0aC5tYXgoMCwgY29tcGxldGlvbnNSZW1haW5pbmcpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRyZXNldERhdGU6IGVudGl0bGVtZW50c1Jlc3BvbnNlLmxpbWl0ZWRfdXNlcl9yZXNldF9kYXRlXG5cdFx0XHR9XG5cdFx0fTtcblxuXHRcdHRoaXMubG9nU2VydmljZS50cmFjZShgW2NoYXQgZW50aXRsZW1lbnRdOiByZXNvbHZlZCB0byAke2VudGl0bGVtZW50cy5lbnRpdGxlbWVudH0sIHF1b3RhczogJHtKU09OLnN0cmluZ2lmeShlbnRpdGxlbWVudHMucXVvdGFzKX1gKTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjxFbnRpdGxlbWVudEV2ZW50LCBFbnRpdGxlbWVudENsYXNzaWZpY2F0aW9uPignY2hhdEluc3RhbGxFbnRpdGxlbWVudCcsIHtcblx0XHRcdGVudGl0bGVtZW50OiBlbnRpdGxlbWVudHMuZW50aXRsZW1lbnQsXG5cdFx0XHR0aWQ6IGVudGl0bGVtZW50c1Jlc3BvbnNlLmFuYWx5dGljc190cmFja2luZ19pZCxcblx0XHRcdHF1b3RhQ2hhdDogZW50aXRsZW1lbnRzUmVzcG9uc2UubGltaXRlZF91c2VyX3F1b3Rhcz8uY2hhdCxcblx0XHRcdHF1b3RhQ29tcGxldGlvbnM6IGVudGl0bGVtZW50c1Jlc3BvbnNlLmxpbWl0ZWRfdXNlcl9xdW90YXM/LmNvbXBsZXRpb25zLFxuXHRcdFx0cXVvdGFSZXNldERhdGU6IGVudGl0bGVtZW50c1Jlc3BvbnNlLmxpbWl0ZWRfdXNlcl9yZXNldF9kYXRlXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gZW50aXRsZW1lbnRzO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyByZXF1ZXN0KHVybDogc3RyaW5nLCB0eXBlOiAnR0VUJywgYm9keTogdW5kZWZpbmVkLCBzZXNzaW9uOiBBdXRoZW50aWNhdGlvblNlc3Npb24sIHRva2VuOiBDYW5jZWxsYXRpb25Ub2tlbik6IFByb21pc2U8SVJlcXVlc3RDb250ZXh0IHwgdW5kZWZpbmVkPjtcblx0cHJpdmF0ZSBhc3luYyByZXF1ZXN0KHVybDogc3RyaW5nLCB0eXBlOiAnUE9TVCcsIGJvZHk6IG9iamVjdCwgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dCB8IHVuZGVmaW5lZD47XG5cdHByaXZhdGUgYXN5bmMgcmVxdWVzdCh1cmw6IHN0cmluZywgdHlwZTogJ0dFVCcgfCAnUE9TVCcsIGJvZHk6IG9iamVjdCB8IHVuZGVmaW5lZCwgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uLCB0b2tlbjogQ2FuY2VsbGF0aW9uVG9rZW4pOiBQcm9taXNlPElSZXF1ZXN0Q29udGV4dCB8IHVuZGVmaW5lZD4ge1xuXHRcdHRyeSB7XG5cdFx0XHRyZXR1cm4gYXdhaXQgdGhpcy5yZXF1ZXN0U2VydmljZS5yZXF1ZXN0KHtcblx0XHRcdFx0dHlwZSxcblx0XHRcdFx0dXJsLFxuXHRcdFx0XHRkYXRhOiB0eXBlID09PSAnUE9TVCcgPyBKU09OLnN0cmluZ2lmeShib2R5KSA6IHVuZGVmaW5lZCxcblx0XHRcdFx0ZGlzYWJsZUNhY2hlOiB0cnVlLFxuXHRcdFx0XHRoZWFkZXJzOiB7XG5cdFx0XHRcdFx0J0F1dGhvcml6YXRpb24nOiBgQmVhcmVyICR7c2Vzc2lvbi5hY2Nlc3NUb2tlbn1gXG5cdFx0XHRcdH1cblx0XHRcdH0sIHRva2VuKTtcblx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0aWYgKCF0b2tlbi5pc0NhbmNlbGxhdGlvblJlcXVlc3RlZCkge1xuXHRcdFx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IoYFtjaGF0IGVudGl0bGVtZW50XSByZXF1ZXN0OiBlcnJvciAke2Vycm9yfWApO1xuXHRcdFx0fVxuXG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0fVxuXG5cdHByaXZhdGUgdXBkYXRlKHN0YXRlOiBJRW50aXRsZW1lbnRzKTogdm9pZCB7XG5cdFx0dGhpcy5zdGF0ZSA9IHN0YXRlO1xuXG5cdFx0dGhpcy5jb250ZXh0LnVwZGF0ZSh7IGVudGl0bGVtZW50OiB0aGlzLnN0YXRlLmVudGl0bGVtZW50IH0pO1xuXG5cdFx0aWYgKHN0YXRlLnF1b3Rhcykge1xuXHRcdFx0dGhpcy5jaGF0UXVvdGFzQWNjZXNzb3IuYWNjZXB0UXVvdGFzKHtcblx0XHRcdFx0Y2hhdFF1b3RhRXhjZWVkZWQ6IHR5cGVvZiBzdGF0ZS5xdW90YXMuY2hhdFJlbWFpbmluZyA9PT0gJ251bWJlcicgPyBzdGF0ZS5xdW90YXMuY2hhdFJlbWFpbmluZyA8PSAwIDogZmFsc2UsXG5cdFx0XHRcdGNvbXBsZXRpb25zUXVvdGFFeGNlZWRlZDogdHlwZW9mIHN0YXRlLnF1b3Rhcy5jb21wbGV0aW9uc1JlbWFpbmluZyA9PT0gJ251bWJlcicgPyBzdGF0ZS5xdW90YXMuY29tcGxldGlvbnNSZW1haW5pbmcgPD0gMCA6IGZhbHNlLFxuXHRcdFx0XHRxdW90YVJlc2V0RGF0ZTogc3RhdGUucXVvdGFzLnJlc2V0RGF0ZSA/IG5ldyBEYXRlKHN0YXRlLnF1b3Rhcy5yZXNldERhdGUpIDogdW5kZWZpbmVkLFxuXHRcdFx0XHRjaGF0VG90YWw6IHN0YXRlLnF1b3Rhcy5jaGF0VG90YWwsXG5cdFx0XHRcdGNvbXBsZXRpb25zVG90YWw6IHN0YXRlLnF1b3Rhcy5jb21wbGV0aW9uc1RvdGFsLFxuXHRcdFx0XHRjaGF0UmVtYWluaW5nOiBzdGF0ZS5xdW90YXMuY2hhdFJlbWFpbmluZyxcblx0XHRcdFx0Y29tcGxldGlvbnNSZW1haW5pbmc6IHN0YXRlLnF1b3Rhcy5jb21wbGV0aW9uc1JlbWFpbmluZ1xuXHRcdFx0fSk7XG5cdFx0fVxuXHR9XG5cblx0YXN5bmMgZm9yY2VSZXNvbHZlRW50aXRsZW1lbnQoc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uIHwgdW5kZWZpbmVkLCB0b2tlbiA9IENhbmNlbGxhdGlvblRva2VuLk5vbmUpOiBQcm9taXNlPElFbnRpdGxlbWVudHMgfCB1bmRlZmluZWQ+IHtcblx0XHRpZiAoIXNlc3Npb24pIHtcblx0XHRcdHNlc3Npb24gPSBhd2FpdCB0aGlzLmZpbmRNYXRjaGluZ1Byb3ZpZGVyU2Vzc2lvbih0b2tlbik7XG5cdFx0fVxuXG5cdFx0aWYgKCFzZXNzaW9uKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblxuXHRcdHJldHVybiB0aGlzLnJlc29sdmVFbnRpdGxlbWVudChzZXNzaW9uLCB0b2tlbik7XG5cdH1cblxuXHRhc3luYyBzaWduVXBMaW1pdGVkKHNlc3Npb246IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbik6IFByb21pc2U8dHJ1ZSAvKiBzaWduZWQgdXAgKi8gfCBmYWxzZSAvKiBhbHJlYWR5IHNpZ25lZCB1cCAqLyB8IHsgZXJyb3JDb2RlOiBudW1iZXIgfSAvKiBlcnJvciAqLz4ge1xuXHRcdGNvbnN0IGJvZHkgPSB7XG5cdFx0XHRyZXN0cmljdGVkX3RlbGVtZXRyeTogdGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnRlbGVtZXRyeUxldmVsID09PSBUZWxlbWV0cnlMZXZlbC5OT05FID8gJ2Rpc2FibGVkJyA6ICdlbmFibGVkJyxcblx0XHRcdHB1YmxpY19jb2RlX3N1Z2dlc3Rpb25zOiAnZW5hYmxlZCdcblx0XHR9O1xuXG5cdFx0Y29uc3QgcmVzcG9uc2UgPSBhd2FpdCB0aGlzLnJlcXVlc3QoZGVmYXVsdENoYXQuZW50aXRsZW1lbnRTaWdudXBMaW1pdGVkVXJsLCAnUE9TVCcsIGJvZHksIHNlc3Npb24sIENhbmNlbGxhdGlvblRva2VuLk5vbmUpO1xuXHRcdGlmICghcmVzcG9uc2UpIHtcblx0XHRcdGNvbnN0IHJldHJ5ID0gYXdhaXQgdGhpcy5vblVua25vd25TaWduVXBFcnJvcihsb2NhbGl6ZSgnc2lnblVwTm9SZXNwb25zZUVycm9yJywgXCJObyByZXNwb25zZSByZWNlaXZlZC5cIiksICdbY2hhdCBlbnRpdGxlbWVudF0gc2lnbi11cDogbm8gcmVzcG9uc2UnKTtcblx0XHRcdHJldHVybiByZXRyeSA/IHRoaXMuc2lnblVwTGltaXRlZChzZXNzaW9uKSA6IHsgZXJyb3JDb2RlOiAxIH07XG5cdFx0fVxuXG5cdFx0aWYgKHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlICYmIHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlICE9PSAyMDApIHtcblx0XHRcdGlmIChyZXNwb25zZS5yZXMuc3RhdHVzQ29kZSA9PT0gNDIyKSB7XG5cdFx0XHRcdHRyeSB7XG5cdFx0XHRcdFx0Y29uc3QgcmVzcG9uc2VUZXh0ID0gYXdhaXQgYXNUZXh0KHJlc3BvbnNlKTtcblx0XHRcdFx0XHRpZiAocmVzcG9uc2VUZXh0KSB7XG5cdFx0XHRcdFx0XHRjb25zdCByZXNwb25zZUVycm9yOiB7IG1lc3NhZ2U6IHN0cmluZyB9ID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpO1xuXHRcdFx0XHRcdFx0aWYgKHR5cGVvZiByZXNwb25zZUVycm9yLm1lc3NhZ2UgPT09ICdzdHJpbmcnICYmIHJlc3BvbnNlRXJyb3IubWVzc2FnZSkge1xuXHRcdFx0XHRcdFx0XHR0aGlzLm9uVW5wcm9jZXNzYWJsZVNpZ25VcEVycm9yKGBbY2hhdCBlbnRpdGxlbWVudF0gc2lnbi11cDogdW5wcm9jZXNzYWJsZSBlbnRpdHkgKCR7cmVzcG9uc2VFcnJvci5tZXNzYWdlfSlgLCByZXNwb25zZUVycm9yLm1lc3NhZ2UpO1xuXHRcdFx0XHRcdFx0XHRyZXR1cm4geyBlcnJvckNvZGU6IHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlIH07XG5cdFx0XHRcdFx0XHR9XG5cdFx0XHRcdFx0fVxuXHRcdFx0XHR9IGNhdGNoIChlcnJvcikge1xuXHRcdFx0XHRcdC8vIGlnbm9yZSAtIGhhbmRsZWQgYmVsb3dcblx0XHRcdFx0fVxuXHRcdFx0fVxuXHRcdFx0Y29uc3QgcmV0cnkgPSBhd2FpdCB0aGlzLm9uVW5rbm93blNpZ25VcEVycm9yKGxvY2FsaXplKCdzaWduVXBVbmV4cGVjdGVkU3RhdHVzRXJyb3InLCBcIlVuZXhwZWN0ZWQgc3RhdHVzIGNvZGUgezB9LlwiLCByZXNwb25zZS5yZXMuc3RhdHVzQ29kZSksIGBbY2hhdCBlbnRpdGxlbWVudF0gc2lnbi11cDogdW5leHBlY3RlZCBzdGF0dXMgY29kZSAke3Jlc3BvbnNlLnJlcy5zdGF0dXNDb2RlfWApO1xuXHRcdFx0cmV0dXJuIHJldHJ5ID8gdGhpcy5zaWduVXBMaW1pdGVkKHNlc3Npb24pIDogeyBlcnJvckNvZGU6IHJlc3BvbnNlLnJlcy5zdGF0dXNDb2RlIH07XG5cdFx0fVxuXG5cdFx0bGV0IHJlc3BvbnNlVGV4dDogc3RyaW5nIHwgbnVsbCA9IG51bGw7XG5cdFx0dHJ5IHtcblx0XHRcdHJlc3BvbnNlVGV4dCA9IGF3YWl0IGFzVGV4dChyZXNwb25zZSk7XG5cdFx0fSBjYXRjaCAoZXJyb3IpIHtcblx0XHRcdC8vIGlnbm9yZSAtIGhhbmRsZWQgYmVsb3dcblx0XHR9XG5cblx0XHRpZiAoIXJlc3BvbnNlVGV4dCkge1xuXHRcdFx0Y29uc3QgcmV0cnkgPSBhd2FpdCB0aGlzLm9uVW5rbm93blNpZ25VcEVycm9yKGxvY2FsaXplKCdzaWduVXBOb1Jlc3BvbnNlQ29udGVudHNFcnJvcicsIFwiUmVzcG9uc2UgaGFzIG5vIGNvbnRlbnRzLlwiKSwgJ1tjaGF0IGVudGl0bGVtZW50XSBzaWduLXVwOiByZXNwb25zZSBoYXMgbm8gY29udGVudCcpO1xuXHRcdFx0cmV0dXJuIHJldHJ5ID8gdGhpcy5zaWduVXBMaW1pdGVkKHNlc3Npb24pIDogeyBlcnJvckNvZGU6IDIgfTtcblx0XHR9XG5cblx0XHRsZXQgcGFyc2VkUmVzdWx0OiB7IHN1YnNjcmliZWQ6IGJvb2xlYW4gfSB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblx0XHR0cnkge1xuXHRcdFx0cGFyc2VkUmVzdWx0ID0gSlNPTi5wYXJzZShyZXNwb25zZVRleHQpO1xuXHRcdFx0dGhpcy5sb2dTZXJ2aWNlLnRyYWNlKGBbY2hhdCBlbnRpdGxlbWVudF0gc2lnbi11cDogcmVzcG9uc2UgaXMgJHtyZXNwb25zZVRleHR9YCk7XG5cdFx0fSBjYXRjaCAoZXJyKSB7XG5cdFx0XHRjb25zdCByZXRyeSA9IGF3YWl0IHRoaXMub25Vbmtub3duU2lnblVwRXJyb3IobG9jYWxpemUoJ3NpZ25VcEludmFsaWRSZXNwb25zZUVycm9yJywgXCJJbnZhbGlkIHJlc3BvbnNlIGNvbnRlbnRzLlwiKSwgYFtjaGF0IGVudGl0bGVtZW50XSBzaWduLXVwOiBlcnJvciBwYXJzaW5nIHJlc3BvbnNlICgke2Vycn0pYCk7XG5cdFx0XHRyZXR1cm4gcmV0cnkgPyB0aGlzLnNpZ25VcExpbWl0ZWQoc2Vzc2lvbikgOiB7IGVycm9yQ29kZTogMyB9O1xuXHRcdH1cblxuXHRcdC8vIFdlIGhhdmUgbWFkZSBpdCB0aGlzIGZhciwgc28gdGhlIHVzZXIgZWl0aGVyIGRpZCBzaWduLXVwIG9yIHdhcyBzaWduZWQtdXAgYWxyZWFkeS5cblx0XHQvLyBUaGF0IGlzLCBiZWNhdXNlIHRoZSBlbmRwb2ludCB0aHJvd3MgaW4gYWxsIG90aGVyIGNhc2UgYWNjb3JkaW5nIHRvIFBhdHJpY2suXG5cdFx0dGhpcy51cGRhdGUoeyBlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQgfSk7XG5cblx0XHRyZXR1cm4gQm9vbGVhbihwYXJzZWRSZXN1bHQ/LnN1YnNjcmliZWQpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBvblVua25vd25TaWduVXBFcnJvcihkZXRhaWw6IHN0cmluZywgbG9nTWVzc2FnZTogc3RyaW5nKTogUHJvbWlzZTxib29sZWFuPiB7XG5cdFx0dGhpcy5sb2dTZXJ2aWNlLmVycm9yKGxvZ01lc3NhZ2UpO1xuXG5cdFx0aWYgKCF0aGlzLmxpZmVjeWNsZVNlcnZpY2Uud2lsbFNodXRkb3duKSB7XG5cdFx0XHRjb25zdCB7IGNvbmZpcm1lZCB9ID0gYXdhaXQgdGhpcy5kaWFsb2dTZXJ2aWNlLmNvbmZpcm0oe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3Vua25vd25TaWduVXBFcnJvcicsIFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2lnbmluZyB1cCBmb3IgdGhlIENvcGlsb3QgRnJlZSBwbGFuLiBXb3VsZCB5b3UgbGlrZSB0byB0cnkgYWdhaW4/XCIpLFxuXHRcdFx0XHRkZXRhaWwsXG5cdFx0XHRcdHByaW1hcnlCdXR0b246IGxvY2FsaXplKCdyZXRyeScsIFwiUmV0cnlcIilcblx0XHRcdH0pO1xuXG5cdFx0XHRyZXR1cm4gY29uZmlybWVkO1xuXHRcdH1cblxuXHRcdHJldHVybiBmYWxzZTtcblx0fVxuXG5cdHByaXZhdGUgb25VbnByb2Nlc3NhYmxlU2lnblVwRXJyb3IobG9nTWVzc2FnZTogc3RyaW5nLCBsb2dEZXRhaWxzOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UuZXJyb3IobG9nTWVzc2FnZSk7XG5cblx0XHRpZiAoIXRoaXMubGlmZWN5Y2xlU2VydmljZS53aWxsU2h1dGRvd24pIHtcblx0XHRcdHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0XHR0eXBlOiBTZXZlcml0eS5FcnJvcixcblx0XHRcdFx0bWVzc2FnZTogbG9jYWxpemUoJ3VucHJvY2Vzc2FibGVTaWduVXBFcnJvcicsIFwiQW4gZXJyb3Igb2NjdXJyZWQgd2hpbGUgc2lnbmluZyB1cCBmb3IgdGhlIENvcGlsb3QgRnJlZSBwbGFuLlwiKSxcblx0XHRcdFx0ZGV0YWlsOiBsb2dEZXRhaWxzLFxuXHRcdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdFx0e1xuXHRcdFx0XHRcdFx0bGFiZWw6IGxvY2FsaXplKCdvaycsIFwiT0tcIiksXG5cdFx0XHRcdFx0XHRydW46ICgpID0+IHsgLyogbm9vcCAqLyB9XG5cdFx0XHRcdFx0fSxcblx0XHRcdFx0XHR7XG5cdFx0XHRcdFx0XHRsYWJlbDogbG9jYWxpemUoJ2xlYXJuTW9yZScsIFwiTGVhcm4gTW9yZVwiKSxcblx0XHRcdFx0XHRcdHJ1bjogKCkgPT4gdGhpcy5vcGVuZXJTZXJ2aWNlLm9wZW4oVVJJLnBhcnNlKGRlZmF1bHRDaGF0LnVwZ3JhZGVQbGFuVXJsKSlcblx0XHRcdFx0XHR9XG5cdFx0XHRcdF1cblx0XHRcdH0pO1xuXHRcdH1cblx0fVxuXG5cdGFzeW5jIHNpZ25JbigpIHtcblx0XHRjb25zdCBwcm92aWRlcklkID0gQ2hhdEVudGl0bGVtZW50UmVxdWVzdHMucHJvdmlkZXJJZCh0aGlzLmNvbmZpZ3VyYXRpb25TZXJ2aWNlKTtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuY3JlYXRlU2Vzc2lvbihwcm92aWRlcklkLCBkZWZhdWx0Q2hhdC5wcm92aWRlclNjb3Blc1swXSk7XG5cblx0XHR0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UudXBkYXRlQWNjb3VudFByZWZlcmVuY2UoZGVmYXVsdENoYXQuZXh0ZW5zaW9uSWQsIHByb3ZpZGVySWQsIHNlc3Npb24uYWNjb3VudCk7XG5cdFx0dGhpcy5hdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLnVwZGF0ZUFjY291bnRQcmVmZXJlbmNlKGRlZmF1bHRDaGF0LmNoYXRFeHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50KTtcblxuXHRcdGNvbnN0IGVudGl0bGVtZW50cyA9IGF3YWl0IHRoaXMuZm9yY2VSZXNvbHZlRW50aXRsZW1lbnQoc2Vzc2lvbik7XG5cblx0XHRyZXR1cm4geyBzZXNzaW9uLCBlbnRpdGxlbWVudHMgfTtcblx0fVxuXG5cdG92ZXJyaWRlIGRpc3Bvc2UoKTogdm9pZCB7XG5cdFx0dGhpcy5wZW5kaW5nUmVzb2x2ZUN0cy5kaXNwb3NlKHRydWUpO1xuXG5cdFx0c3VwZXIuZGlzcG9zZSgpO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuXG4vLyNyZWdpb24gQ29udGV4dFxuXG5leHBvcnQgaW50ZXJmYWNlIElDaGF0RW50aXRsZW1lbnRDb250ZXh0U3RhdGUge1xuXHRlbnRpdGxlbWVudDogQ2hhdEVudGl0bGVtZW50O1xuXHRoaWRkZW4/OiBib29sZWFuO1xuXHRpbnN0YWxsZWQ/OiBib29sZWFuO1xuXHRyZWdpc3RlcmVkPzogYm9vbGVhbjtcbn1cblxuZXhwb3J0IGNsYXNzIENoYXRFbnRpdGxlbWVudENvbnRleHQgZXh0ZW5kcyBEaXNwb3NhYmxlIHtcblxuXHRwcml2YXRlIHN0YXRpYyByZWFkb25seSBDSEFUX0VOVElUTEVNRU5UX0NPTlRFWFRfU1RPUkFHRV9LRVkgPSAnY2hhdC5zZXR1cENvbnRleHQnO1xuXG5cdHByaXZhdGUgcmVhZG9ubHkgY2FuU2lnblVwQ29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgc2lnbmVkT3V0Q29udGV4dEtleTogSUNvbnRleHRLZXk8Ym9vbGVhbj47XG5cdHByaXZhdGUgcmVhZG9ubHkgbGltaXRlZENvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IHByb0NvbnRleHRLZXk6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGhpZGRlbkNvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXHRwcml2YXRlIHJlYWRvbmx5IGluc3RhbGxlZENvbnRleHQ6IElDb250ZXh0S2V5PGJvb2xlYW4+O1xuXG5cdHByaXZhdGUgX3N0YXRlOiBJQ2hhdEVudGl0bGVtZW50Q29udGV4dFN0YXRlO1xuXHRwcml2YXRlIHN1c3BlbmRlZFN0YXRlOiBJQ2hhdEVudGl0bGVtZW50Q29udGV4dFN0YXRlIHwgdW5kZWZpbmVkID0gdW5kZWZpbmVkO1xuXHRnZXQgc3RhdGUoKTogSUNoYXRFbnRpdGxlbWVudENvbnRleHRTdGF0ZSB7XG5cdFx0cmV0dXJuIHRoaXMuc3VzcGVuZGVkU3RhdGUgPz8gdGhpcy5fc3RhdGU7XG5cdH1cblxuXHRwcml2YXRlIHJlYWRvbmx5IF9vbkRpZENoYW5nZSA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBFbWl0dGVyPHZvaWQ+KCkpO1xuXHRyZWFkb25seSBvbkRpZENoYW5nZSA9IHRoaXMuX29uRGlkQ2hhbmdlLmV2ZW50O1xuXG5cdHByaXZhdGUgdXBkYXRlQmFycmllcjogQmFycmllciB8IHVuZGVmaW5lZCA9IHVuZGVmaW5lZDtcblxuXHRjb25zdHJ1Y3Rvcihcblx0XHRASUNvbnRleHRLZXlTZXJ2aWNlIGNvbnRleHRLZXlTZXJ2aWNlOiBJQ29udGV4dEtleVNlcnZpY2UsXG5cdFx0QElTdG9yYWdlU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IHN0b3JhZ2VTZXJ2aWNlOiBJU3RvcmFnZVNlcnZpY2UsXG5cdFx0QElXb3JrYmVuY2hFeHRlbnNpb25FbmFibGVtZW50U2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlOiBJV29ya2JlbmNoRXh0ZW5zaW9uRW5hYmxlbWVudFNlcnZpY2UsXG5cdFx0QElMb2dTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgbG9nU2VydmljZTogSUxvZ1NlcnZpY2UsXG5cdFx0QElFeHRlbnNpb25zV29ya2JlbmNoU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlOiBJRXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UsXG5cdCkge1xuXHRcdHN1cGVyKCk7XG5cblx0XHR0aGlzLmNhblNpZ25VcENvbnRleHRLZXkgPSBDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQuY2FuU2lnblVwLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5zaWduZWRPdXRDb250ZXh0S2V5ID0gQ2hhdENvbnRleHRLZXlzLkVudGl0bGVtZW50LnNpZ25lZE91dC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMubGltaXRlZENvbnRleHRLZXkgPSBDaGF0Q29udGV4dEtleXMuRW50aXRsZW1lbnQubGltaXRlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXHRcdHRoaXMucHJvQ29udGV4dEtleSA9IENoYXRDb250ZXh0S2V5cy5FbnRpdGxlbWVudC5wcm8uYmluZFRvKGNvbnRleHRLZXlTZXJ2aWNlKTtcblx0XHR0aGlzLmhpZGRlbkNvbnRleHQgPSBDaGF0Q29udGV4dEtleXMuU2V0dXAuaGlkZGVuLmJpbmRUbyhjb250ZXh0S2V5U2VydmljZSk7XG5cdFx0dGhpcy5pbnN0YWxsZWRDb250ZXh0ID0gQ2hhdENvbnRleHRLZXlzLlNldHVwLmluc3RhbGxlZC5iaW5kVG8oY29udGV4dEtleVNlcnZpY2UpO1xuXG5cdFx0dGhpcy5fc3RhdGUgPSB0aGlzLnN0b3JhZ2VTZXJ2aWNlLmdldE9iamVjdDxJQ2hhdEVudGl0bGVtZW50Q29udGV4dFN0YXRlPihDaGF0RW50aXRsZW1lbnRDb250ZXh0LkNIQVRfRU5USVRMRU1FTlRfQ09OVEVYVF9TVE9SQUdFX0tFWSwgU3RvcmFnZVNjb3BlLlBST0ZJTEUpID8/IHsgZW50aXRsZW1lbnQ6IENoYXRFbnRpdGxlbWVudC5Vbmtub3duIH07XG5cblx0XHR0aGlzLmNoZWNrRXh0ZW5zaW9uSW5zdGFsbGF0aW9uKCk7XG5cdFx0dGhpcy51cGRhdGVDb250ZXh0U3luYygpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjaGVja0V4dGVuc2lvbkluc3RhbGxhdGlvbigpOiBQcm9taXNlPHZvaWQ+IHtcblxuXHRcdC8vIEF3YWl0IGV4dGVuc2lvbnMgdG8gYmUgcmVhZHkgdG8gYmUgcXVlcmllZFxuXHRcdGF3YWl0IHRoaXMuZXh0ZW5zaW9uc1dvcmtiZW5jaFNlcnZpY2UucXVlcnlMb2NhbCgpO1xuXG5cdFx0Ly8gTGlzdGVuIHRvIGNoYW5nZSBhbmQgcHJvY2VzcyBleHRlbnNpb25zIG9uY2Vcblx0XHR0aGlzLl9yZWdpc3RlcihFdmVudC5ydW5BbmRTdWJzY3JpYmU8SUV4dGVuc2lvbiB8IHVuZGVmaW5lZD4odGhpcy5leHRlbnNpb25zV29ya2JlbmNoU2VydmljZS5vbkNoYW5nZSwgZSA9PiB7XG5cdFx0XHRpZiAoZSAmJiAhRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHMoZS5pZGVudGlmaWVyLmlkLCBkZWZhdWx0Q2hhdC5leHRlbnNpb25JZCkpIHtcblx0XHRcdFx0cmV0dXJuOyAvLyB1bnJlbGF0ZWQgZXZlbnRcblx0XHRcdH1cblxuXHRcdFx0Y29uc3QgZGVmYXVsdENoYXRFeHRlbnNpb24gPSB0aGlzLmV4dGVuc2lvbnNXb3JrYmVuY2hTZXJ2aWNlLmxvY2FsLmZpbmQodmFsdWUgPT4gRXh0ZW5zaW9uSWRlbnRpZmllci5lcXVhbHModmFsdWUuaWRlbnRpZmllci5pZCwgZGVmYXVsdENoYXQuZXh0ZW5zaW9uSWQpKTtcblx0XHRcdHRoaXMudXBkYXRlKHsgaW5zdGFsbGVkOiAhIWRlZmF1bHRDaGF0RXh0ZW5zaW9uPy5sb2NhbCAmJiB0aGlzLmV4dGVuc2lvbkVuYWJsZW1lbnRTZXJ2aWNlLmlzRW5hYmxlZChkZWZhdWx0Q2hhdEV4dGVuc2lvbi5sb2NhbCkgfSk7XG5cdFx0fSkpO1xuXHR9XG5cblx0dXBkYXRlKGNvbnRleHQ6IHsgaW5zdGFsbGVkOiBib29sZWFuIH0pOiBQcm9taXNlPHZvaWQ+O1xuXHR1cGRhdGUoY29udGV4dDogeyBoaWRkZW46IGJvb2xlYW4gfSk6IFByb21pc2U8dm9pZD47XG5cdHVwZGF0ZShjb250ZXh0OiB7IGVudGl0bGVtZW50OiBDaGF0RW50aXRsZW1lbnQgfSk6IFByb21pc2U8dm9pZD47XG5cdHVwZGF0ZShjb250ZXh0OiB7IGluc3RhbGxlZD86IGJvb2xlYW47IGhpZGRlbj86IGJvb2xlYW47IGVudGl0bGVtZW50PzogQ2hhdEVudGl0bGVtZW50IH0pOiBQcm9taXNlPHZvaWQ+IHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtjaGF0IGVudGl0bGVtZW50IGNvbnRleHRdIHVwZGF0ZSgpOiAke0pTT04uc3RyaW5naWZ5KGNvbnRleHQpfWApO1xuXG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0Lmluc3RhbGxlZCA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5pbnN0YWxsZWQgPSBjb250ZXh0Lmluc3RhbGxlZDtcblxuXHRcdFx0aWYgKGNvbnRleHQuaW5zdGFsbGVkKSB7XG5cdFx0XHRcdGNvbnRleHQuaGlkZGVuID0gZmFsc2U7IC8vIGFsbG93cyB0byBmYWxsYmFjayBpZiB0aGUgZXh0ZW5zaW9uIGlzIHVuaW5zdGFsbGVkXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0aWYgKHR5cGVvZiBjb250ZXh0LmhpZGRlbiA9PT0gJ2Jvb2xlYW4nKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5oaWRkZW4gPSBjb250ZXh0LmhpZGRlbjtcblx0XHR9XG5cblx0XHRpZiAodHlwZW9mIGNvbnRleHQuZW50aXRsZW1lbnQgPT09ICdudW1iZXInKSB7XG5cdFx0XHR0aGlzLl9zdGF0ZS5lbnRpdGxlbWVudCA9IGNvbnRleHQuZW50aXRsZW1lbnQ7XG5cblx0XHRcdGlmICh0aGlzLl9zdGF0ZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkxpbWl0ZWQgfHwgdGhpcy5fc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5Qcm8pIHtcblx0XHRcdFx0dGhpcy5fc3RhdGUucmVnaXN0ZXJlZCA9IHRydWU7XG5cdFx0XHR9IGVsc2UgaWYgKHRoaXMuX3N0YXRlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuQXZhaWxhYmxlKSB7XG5cdFx0XHRcdHRoaXMuX3N0YXRlLnJlZ2lzdGVyZWQgPSBmYWxzZTsgLy8gb25seSByZXNldCB3aGVuIHNpZ25lZC1pbiB1c2VyIGNhbiBzaWduLXVwIGZvciBsaW1pdGVkXG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0dGhpcy5zdG9yYWdlU2VydmljZS5zdG9yZShDaGF0RW50aXRsZW1lbnRDb250ZXh0LkNIQVRfRU5USVRMRU1FTlRfQ09OVEVYVF9TVE9SQUdFX0tFWSwgdGhpcy5fc3RhdGUsIFN0b3JhZ2VTY29wZS5QUk9GSUxFLCBTdG9yYWdlVGFyZ2V0Lk1BQ0hJTkUpO1xuXG5cdFx0cmV0dXJuIHRoaXMudXBkYXRlQ29udGV4dCgpO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyB1cGRhdGVDb250ZXh0KCk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMudXBkYXRlQmFycmllcj8ud2FpdCgpO1xuXG5cdFx0dGhpcy51cGRhdGVDb250ZXh0U3luYygpO1xuXHR9XG5cblx0cHJpdmF0ZSB1cGRhdGVDb250ZXh0U3luYygpOiB2b2lkIHtcblx0XHR0aGlzLmxvZ1NlcnZpY2UudHJhY2UoYFtjaGF0IGVudGl0bGVtZW50IGNvbnRleHRdIHVwZGF0ZUNvbnRleHQoKTogJHtKU09OLnN0cmluZ2lmeSh0aGlzLl9zdGF0ZSl9YCk7XG5cblx0XHR0aGlzLnNpZ25lZE91dENvbnRleHRLZXkuc2V0KHRoaXMuX3N0YXRlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuVW5rbm93bik7XG5cdFx0dGhpcy5jYW5TaWduVXBDb250ZXh0S2V5LnNldCh0aGlzLl9zdGF0ZS5lbnRpdGxlbWVudCA9PT0gQ2hhdEVudGl0bGVtZW50LkF2YWlsYWJsZSk7XG5cdFx0dGhpcy5saW1pdGVkQ29udGV4dEtleS5zZXQodGhpcy5fc3RhdGUuZW50aXRsZW1lbnQgPT09IENoYXRFbnRpdGxlbWVudC5MaW1pdGVkKTtcblx0XHR0aGlzLnByb0NvbnRleHRLZXkuc2V0KHRoaXMuX3N0YXRlLmVudGl0bGVtZW50ID09PSBDaGF0RW50aXRsZW1lbnQuUHJvKTtcblx0XHR0aGlzLmhpZGRlbkNvbnRleHQuc2V0KCEhdGhpcy5fc3RhdGUuaGlkZGVuKTtcblx0XHR0aGlzLmluc3RhbGxlZENvbnRleHQuc2V0KCEhdGhpcy5fc3RhdGUuaW5zdGFsbGVkKTtcblxuXHRcdHRoaXMuX29uRGlkQ2hhbmdlLmZpcmUoKTtcblx0fVxuXG5cdHN1c3BlbmQoKTogdm9pZCB7XG5cdFx0dGhpcy5zdXNwZW5kZWRTdGF0ZSA9IHsgLi4udGhpcy5fc3RhdGUgfTtcblx0XHR0aGlzLnVwZGF0ZUJhcnJpZXIgPSBuZXcgQmFycmllcigpO1xuXHR9XG5cblx0cmVzdW1lKCk6IHZvaWQge1xuXHRcdHRoaXMuc3VzcGVuZGVkU3RhdGUgPSB1bmRlZmluZWQ7XG5cdFx0dGhpcy51cGRhdGVCYXJyaWVyPy5vcGVuKCk7XG5cdFx0dGhpcy51cGRhdGVCYXJyaWVyID0gdW5kZWZpbmVkO1xuXHR9XG59XG5cbi8vI2VuZHJlZ2lvblxuIl0sCiAgIm1hcHBpbmdzIjogIjs7Ozs7Ozs7Ozs7QUFLQSxPQUFPLGFBQWE7QUFDcEIsU0FBUyxlQUFlO0FBQ3hCLFNBQVMsbUJBQW1CLCtCQUErQjtBQUMzRCxTQUFTLFNBQVMsYUFBYTtBQUMvQixTQUFTLFlBQVk7QUFDckIsU0FBUyxrQkFBa0I7QUFFM0IsU0FBUyxnQkFBZ0I7QUFDekIsU0FBUyw2QkFBNkI7QUFDdEMsU0FBc0IsMEJBQTBCO0FBQ2hELFNBQVMsc0JBQXNCO0FBQy9CLFNBQVMsMkJBQTJCO0FBQ3BDLFNBQVMsaUJBQWlCLDZCQUE2QjtBQUN2RCxTQUFTLG1CQUFtQjtBQUM1QixTQUFTLHVCQUF1QjtBQUNoQyxTQUFTLFFBQVEsdUJBQXVCO0FBQ3hD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LFdBQVcsTUFBTSx3Q0FBd0MsS0FBSyxVQUFVLE9BQU8sQ0FBQyxFQUFFO0FBRXZGLFFBQUksT0FBTyxRQUFRLGNBQWMsV0FBVztBQUMzQyxXQUFLLE9BQU8sWUFBWSxRQUFRO0FBRWhDLFVBQUksUUFBUSxXQUFXO0FBQ3RCLGdCQUFRLFNBQVM7QUFBQSxNQUNsQjtBQUFBLElBQ0Q7QUFFQSxRQUFJLE9BQU8sUUFBUSxXQUFXLFdBQVc7QUFDeEMsV0FBSyxPQUFPLFNBQVMsUUFBUTtBQUFBLElBQzlCO0FBRUEsUUFBSSxPQUFPLFFBQVEsZ0JBQWdCLFVBQVU7QUFDNUMsV0FBSyxPQUFPLGNBQWMsUUFBUTtBQUVsQyxVQUFJLEtBQUssT0FBTyxnQkFBZ0IsbUJBQTJCLEtBQUssT0FBTyxnQkFBZ0IsYUFBcUI7QUFDM0csYUFBSyxPQUFPLGFBQWE7QUFBQSxNQUMxQixXQUFXLEtBQUssT0FBTyxnQkFBZ0IsbUJBQTJCO0FBQ2pFLGFBQUssT0FBTyxhQUFhO0FBQUEsTUFDMUI7QUFBQSxJQUNEO0FBRUEsU0FBSyxlQUFlLE1BQU0sdUJBQXVCLHNDQUFzQyxLQUFLLFFBQVEsYUFBYSxTQUFTLGNBQWMsT0FBTztBQUUvSSxXQUFPLEtBQUssY0FBYztBQUFBLEVBQzNCO0FBQUEsRUFFQSxNQUFjLGdCQUErQjtBQUM1QyxVQUFNLEtBQUssZUFBZSxLQUFLO0FBRS9CLFNBQUssa0JBQWtCO0FBQUEsRUFDeEI7QUFBQSxFQUVRLG9CQUEwQjtBQUNqQyxTQUFLLFdBQVcsTUFBTSwrQ0FBK0MsS0FBSyxVQUFVLEtBQUssTUFBTSxDQUFDLEVBQUU7QUFFbEcsU0FBSyxvQkFBb0IsSUFBSSxLQUFLLE9BQU8sZ0JBQWdCLGVBQXVCO0FBQ2hGLFNBQUssb0JBQW9CLElBQUksS0FBSyxPQUFPLGdCQUFnQixpQkFBeUI7QUFDbEYsU0FBSyxrQkFBa0IsSUFBSSxLQUFLLE9BQU8sZ0JBQWdCLGVBQXVCO0FBQzlFLFNBQUssY0FBYyxJQUFJLEtBQUssT0FBTyxnQkFBZ0IsV0FBbUI7QUFDdEUsU0FBSyxjQUFjLElBQUksQ0FBQyxDQUFDLEtBQUssT0FBTyxNQUFNO0FBQzNDLFNBQUssaUJBQWlCLElBQUksQ0FBQyxDQUFDLEtBQUssT0FBTyxTQUFTO0FBRWpELFNBQUssYUFBYSxLQUFLO0FBQUEsRUFDeEI7QUFBQSxFQUVBLFVBQWdCO0FBQ2YsU0FBSyxpQkFBaUIsRUFBRSxHQUFHLEtBQUssT0FBTztBQUN2QyxTQUFLLGdCQUFnQixJQUFJLFFBQVE7QUFBQSxFQUNsQztBQUFBLEVBRUEsU0FBZTtBQUNkLFNBQUssaUJBQWlCO0FBQ3RCLFNBQUssZUFBZSxLQUFLO0FBQ3pCLFNBQUssZ0JBQWdCO0FBQUEsRUFDdEI7QUFDRDtBQTFIYSx1QkFFWSx1Q0FBdUM7QUFGbkQseUJBQU47QUFBQSxFQXVCSjtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQTNCVTsiLAogICJuYW1lcyI6IFsiQ2hhdEVudGl0bGVtZW50IiwgIkNoYXRTZW50aW1lbnQiLCAicmVzcG9uc2VUZXh0Il0KfQo=
