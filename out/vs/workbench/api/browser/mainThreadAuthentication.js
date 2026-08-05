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
import { Disposable, DisposableMap } from "../../../base/common/lifecycle.js";
import * as nls from "../../../nls.js";
import { extHostNamedCustomer } from "../../services/extensions/common/extHostCustomers.js";
import { IAuthenticationService, IAuthenticationExtensionsService, INTERNAL_AUTH_PROVIDER_PREFIX as INTERNAL_MODEL_AUTH_PROVIDER_PREFIX } from "../../services/authentication/common/authentication.js";
import { ExtHostContext, MainContext } from "../common/extHost.protocol.js";
import { IDialogService } from "../../../platform/dialogs/common/dialogs.js";
import Severity from "../../../base/common/severity.js";
import { INotificationService } from "../../../platform/notification/common/notification.js";
import { ActivationKind, IExtensionService } from "../../services/extensions/common/extensions.js";
import { ITelemetryService } from "../../../platform/telemetry/common/telemetry.js";
import { Emitter } from "../../../base/common/event.js";
import { IAuthenticationAccessService } from "../../services/authentication/browser/authenticationAccessService.js";
import { IAuthenticationUsageService } from "../../services/authentication/browser/authenticationUsageService.js";
import { getAuthenticationProviderActivationEvent } from "../../services/authentication/browser/authenticationService.js";
import { URI } from "../../../base/common/uri.js";
import { IOpenerService } from "../../../platform/opener/common/opener.js";
import { CancellationError } from "../../../base/common/errors.js";
import { ILogService } from "../../../platform/log/common/log.js";
class MainThreadAuthenticationProvider extends Disposable {
  constructor(_proxy, id, label, supportsMultipleAccounts, notificationService, onDidChangeSessionsEmitter) {
    super();
    this._proxy = _proxy;
    this.id = id;
    this.label = label;
    this.supportsMultipleAccounts = supportsMultipleAccounts;
    this.notificationService = notificationService;
    this.onDidChangeSessions = onDidChangeSessionsEmitter.event;
  }
  async getSessions(scopes, options) {
    return this._proxy.$getSessions(this.id, scopes, options);
  }
  createSession(scopes, options) {
    return this._proxy.$createSession(this.id, scopes, options);
  }
  async removeSession(sessionId) {
    await this._proxy.$removeSession(this.id, sessionId);
    this.notificationService.info(nls.localize("signedOut", "Successfully signed out."));
  }
}
let MainThreadAuthentication = class extends Disposable {
  constructor(extHostContext, authenticationService, authenticationExtensionsService, authenticationAccessService, authenticationUsageService, dialogService, notificationService, extensionService, telemetryService, openerService, logService) {
    super();
    this.authenticationService = authenticationService;
    this.authenticationExtensionsService = authenticationExtensionsService;
    this.authenticationAccessService = authenticationAccessService;
    this.authenticationUsageService = authenticationUsageService;
    this.dialogService = dialogService;
    this.notificationService = notificationService;
    this.extensionService = extensionService;
    this.telemetryService = telemetryService;
    this.openerService = openerService;
    this.logService = logService;
    this._registrations = this._register(new DisposableMap());
    this._sentProviderUsageEvents = /* @__PURE__ */ new Set();
    // TODO@TylerLeonhardt this is a temporary addition to telemetry to understand what extensions are overriding the client id.
    // We can use this telemetry to reach out to these extension authors and let them know that they many need configuration changes
    // due to the adoption of the Microsoft broker.
    // Remove this in a few iterations.
    this._sentClientIdUsageEvents = /* @__PURE__ */ new Set();
    this._proxy = extHostContext.getProxy(ExtHostContext.ExtHostAuthentication);
    this._register(this.authenticationService.onDidChangeSessions((e) => {
      this._proxy.$onDidChangeAuthenticationSessions(e.providerId, e.label);
    }));
    this._register(this.authenticationExtensionsService.onDidChangeAccountPreference((e) => {
      const providerInfo = this.authenticationService.getProvider(e.providerId);
      this._proxy.$onDidChangeAuthenticationSessions(providerInfo.id, providerInfo.label, e.extensionIds);
    }));
  }
  async $registerAuthenticationProvider(id, label, supportsMultipleAccounts) {
    if (!this.authenticationService.declaredProviders.find((p) => p.id === id)) {
      this.logService.warn(`Authentication provider ${id} was not declared in the Extension Manifest.`);
      this.telemetryService.publicLog2("authentication.providerNotDeclared", { id });
    }
    const emitter = new Emitter();
    this._registrations.set(id, emitter);
    const provider = new MainThreadAuthenticationProvider(this._proxy, id, label, supportsMultipleAccounts, this.notificationService, emitter);
    this.authenticationService.registerAuthenticationProvider(id, provider);
  }
  $unregisterAuthenticationProvider(id) {
    this._registrations.deleteAndDispose(id);
    this.authenticationService.unregisterAuthenticationProvider(id);
  }
  async $ensureProvider(id) {
    if (!this.authenticationService.isAuthenticationProviderRegistered(id)) {
      return await this.extensionService.activateByEvent(getAuthenticationProviderActivationEvent(id), ActivationKind.Immediate);
    }
  }
  $sendDidChangeSessions(providerId, event) {
    const obj = this._registrations.get(providerId);
    if (obj instanceof Emitter) {
      obj.fire(event);
    }
  }
  $removeSession(providerId, sessionId) {
    return this.authenticationService.removeSession(providerId, sessionId);
  }
  async loginPrompt(provider, extensionName, recreatingSession, options) {
    let message;
    if (provider.id.startsWith(INTERNAL_MODEL_AUTH_PROVIDER_PREFIX)) {
      message = nls.localize("confirmModelAccess", "The extension '{0}' wants to access the language models provided by {1}.", extensionName, provider.label);
    } else {
      message = recreatingSession ? nls.localize("confirmRelogin", "The extension '{0}' wants you to sign in again using {1}.", extensionName, provider.label) : nls.localize("confirmLogin", "The extension '{0}' wants to sign in using {1}.", extensionName, provider.label);
    }
    const buttons = [
      {
        label: nls.localize({ key: "allow", comment: ["&& denotes a mnemonic"] }, "&&Allow"),
        run() {
          return true;
        }
      }
    ];
    if (options?.learnMore) {
      buttons.push({
        label: nls.localize("learnMore", "Learn more"),
        run: async () => {
          const result2 = this.loginPrompt(provider, extensionName, recreatingSession, options);
          await this.openerService.open(URI.revive(options.learnMore), { allowCommands: true });
          return await result2;
        }
      });
    }
    const { result } = await this.dialogService.prompt({
      type: Severity.Info,
      message,
      buttons,
      detail: options?.detail,
      cancelButton: true
    });
    return result ?? false;
  }
  async continueWithIncorrectAccountPrompt(chosenAccountLabel, requestedAccountLabel) {
    const result = await this.dialogService.prompt({
      message: nls.localize("incorrectAccount", "Incorrect account detected"),
      detail: nls.localize("incorrectAccountDetail", "The chosen account, {0}, does not match the requested account, {1}.", chosenAccountLabel, requestedAccountLabel),
      type: Severity.Warning,
      cancelButton: true,
      buttons: [
        {
          label: nls.localize("keep", "Keep {0}", chosenAccountLabel),
          run: () => chosenAccountLabel
        },
        {
          label: nls.localize("loginWith", "Login with {0}", requestedAccountLabel),
          run: () => requestedAccountLabel
        }
      ]
    });
    if (!result.result) {
      throw new CancellationError();
    }
    return result.result === chosenAccountLabel;
  }
  async doGetSession(providerId, scopes, extensionId, extensionName, options) {
    const sessions = await this.authenticationService.getSessions(providerId, scopes, options.account, true);
    const provider = this.authenticationService.getProvider(providerId);
    if (options.forceNewSession && options.createIfNone) {
      throw new Error("Invalid combination of options. Please remove one of the following: forceNewSession, createIfNone");
    }
    if (options.forceNewSession && options.silent) {
      throw new Error("Invalid combination of options. Please remove one of the following: forceNewSession, silent");
    }
    if (options.createIfNone && options.silent) {
      throw new Error("Invalid combination of options. Please remove one of the following: createIfNone, silent");
    }
    if (options.clearSessionPreference) {
      this._removeAccountPreference(extensionId, providerId, scopes);
    }
    const matchingAccountPreferenceSession = (
      // If an account was passed in, that takes precedence over the account preference
      options.account ? sessions[0] : this._getAccountPreference(extensionId, providerId, scopes, sessions)
    );
    if (!options.forceNewSession && sessions.length) {
      if (matchingAccountPreferenceSession && this.authenticationAccessService.isAccessAllowed(providerId, matchingAccountPreferenceSession.account.label, extensionId)) {
        return matchingAccountPreferenceSession;
      }
      if (!provider.supportsMultipleAccounts && this.authenticationAccessService.isAccessAllowed(providerId, sessions[0].account.label, extensionId)) {
        return sessions[0];
      }
    }
    if (options.createIfNone || options.forceNewSession) {
      let uiOptions;
      if (typeof options.forceNewSession === "object") {
        uiOptions = options.forceNewSession;
      } else if (typeof options.createIfNone === "object") {
        uiOptions = options.createIfNone;
      }
      const recreatingSession = !!(options.forceNewSession && sessions.length);
      const isAllowed = await this.loginPrompt(provider, extensionName, recreatingSession, uiOptions);
      if (!isAllowed) {
        throw new Error("User did not consent to login.");
      }
      let session;
      if (sessions?.length && !options.forceNewSession) {
        session = provider.supportsMultipleAccounts && !options.account ? await this.authenticationExtensionsService.selectSession(providerId, extensionId, extensionName, scopes, sessions) : sessions[0];
      } else {
        const accountToCreate = options.account ?? matchingAccountPreferenceSession?.account;
        do {
          session = await this.authenticationService.createSession(providerId, scopes, { activateImmediate: true, account: accountToCreate });
        } while (accountToCreate && accountToCreate.label !== session.account.label && !await this.continueWithIncorrectAccountPrompt(session.account.label, accountToCreate.label));
      }
      this.authenticationAccessService.updateAllowedExtensions(providerId, session.account.label, [{ id: extensionId, name: extensionName, allowed: true }]);
      this._updateAccountPreference(extensionId, providerId, session);
      return session;
    }
    if (!matchingAccountPreferenceSession && !this.authenticationExtensionsService.getAccountPreference(extensionId, providerId)) {
      const validSession = sessions.find((session) => this.authenticationAccessService.isAccessAllowed(providerId, session.account.label, extensionId));
      if (validSession) {
        return validSession;
      }
    }
    if (!options.silent) {
      sessions.length ? this.authenticationExtensionsService.requestSessionAccess(providerId, extensionId, extensionName, scopes, sessions) : await this.authenticationExtensionsService.requestNewSession(providerId, scopes, extensionId, extensionName);
    }
    return void 0;
  }
  async $getSession(providerId, scopes, extensionId, extensionName, options) {
    this.sendClientIdUsageTelemetry(extensionId, providerId, scopes);
    const session = await this.doGetSession(providerId, scopes, extensionId, extensionName, options);
    if (session) {
      this.sendProviderUsageTelemetry(extensionId, providerId);
      this.authenticationUsageService.addAccountUsage(providerId, session.account.label, scopes, extensionId, extensionName);
    }
    return session;
  }
  async $getAccounts(providerId) {
    const accounts = await this.authenticationService.getAccounts(providerId);
    return accounts;
  }
  sendClientIdUsageTelemetry(extensionId, providerId, scopes) {
    const containsVSCodeClientIdScope = scopes.some((scope) => scope.startsWith("VSCODE_CLIENT_ID:"));
    const key = `${extensionId}|${providerId}|${containsVSCodeClientIdScope}`;
    if (this._sentClientIdUsageEvents.has(key)) {
      return;
    }
    this._sentClientIdUsageEvents.add(key);
    if (containsVSCodeClientIdScope) {
      this.telemetryService.publicLog2("authentication.clientIdUsage", { extensionId });
    }
  }
  sendProviderUsageTelemetry(extensionId, providerId) {
    const key = `${extensionId}|${providerId}`;
    if (this._sentProviderUsageEvents.has(key)) {
      return;
    }
    this._sentProviderUsageEvents.add(key);
    this.telemetryService.publicLog2("authentication.providerUsage", { providerId, extensionId });
  }
  //#region Account Preferences
  // TODO@TylerLeonhardt: Update this after a few iterations to no longer fallback to the session preference
  _getAccountPreference(extensionId, providerId, scopes, sessions) {
    if (sessions.length === 0) {
      return void 0;
    }
    const accountNamePreference = this.authenticationExtensionsService.getAccountPreference(extensionId, providerId);
    if (accountNamePreference) {
      const session = sessions.find((session2) => session2.account.label === accountNamePreference);
      return session;
    }
    const sessionIdPreference = this.authenticationExtensionsService.getSessionPreference(providerId, extensionId, scopes);
    if (sessionIdPreference) {
      const session = sessions.find((session2) => session2.id === sessionIdPreference);
      if (session) {
        this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
        return session;
      }
    }
    return void 0;
  }
  _updateAccountPreference(extensionId, providerId, session) {
    this.authenticationExtensionsService.updateAccountPreference(extensionId, providerId, session.account);
    this.authenticationExtensionsService.updateSessionPreference(providerId, extensionId, session);
  }
  _removeAccountPreference(extensionId, providerId, scopes) {
    this.authenticationExtensionsService.removeAccountPreference(extensionId, providerId);
    this.authenticationExtensionsService.removeSessionPreference(providerId, extensionId, scopes);
  }
  //#endregion
};
MainThreadAuthentication = __decorateClass([
  extHostNamedCustomer(MainContext.MainThreadAuthentication),
  __decorateParam(1, IAuthenticationService),
  __decorateParam(2, IAuthenticationExtensionsService),
  __decorateParam(3, IAuthenticationAccessService),
  __decorateParam(4, IAuthenticationUsageService),
  __decorateParam(5, IDialogService),
  __decorateParam(6, INotificationService),
  __decorateParam(7, IExtensionService),
  __decorateParam(8, ITelemetryService),
  __decorateParam(9, IOpenerService),
  __decorateParam(10, ILogService)
], MainThreadAuthentication);
export {
  MainThreadAuthentication,
  MainThreadAuthenticationProvider
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsiL1VzZXJzL2FtYmFkaS9EZXNrdG9wL3BsYy1tYWluL3NyYy92cy93b3JrYmVuY2gvYXBpL2Jyb3dzZXIvbWFpblRocmVhZEF1dGhlbnRpY2F0aW9uLnRzIl0sCiAgInNvdXJjZXNDb250ZW50IjogWyIvKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLVxuICogIENvcHlyaWdodCAoYykgTWljcm9zb2Z0IENvcnBvcmF0aW9uLiBBbGwgcmlnaHRzIHJlc2VydmVkLlxuICogIExpY2Vuc2VkIHVuZGVyIHRoZSBNSVQgTGljZW5zZS4gU2VlIExpY2Vuc2UudHh0IGluIHRoZSBwcm9qZWN0IHJvb3QgZm9yIGxpY2Vuc2UgaW5mb3JtYXRpb24uXG4gKi0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tKi9cblxuaW1wb3J0IHsgRGlzcG9zYWJsZSwgRGlzcG9zYWJsZU1hcCB9IGZyb20gJy4uLy4uLy4uL2Jhc2UvY29tbW9uL2xpZmVjeWNsZS5qcyc7XG5pbXBvcnQgKiBhcyBubHMgZnJvbSAnLi4vLi4vLi4vbmxzLmpzJztcbmltcG9ydCB7IGV4dEhvc3ROYW1lZEN1c3RvbWVyLCBJRXh0SG9zdENvbnRleHQgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRIb3N0Q3VzdG9tZXJzLmpzJztcbmltcG9ydCB7IElBdXRoZW50aWNhdGlvbkNyZWF0ZVNlc3Npb25PcHRpb25zLCBBdXRoZW50aWNhdGlvblNlc3Npb24sIEF1dGhlbnRpY2F0aW9uU2Vzc2lvbnNDaGFuZ2VFdmVudCwgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXIsIElBdXRoZW50aWNhdGlvblNlcnZpY2UsIElBdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLCBJTlRFUk5BTF9BVVRIX1BST1ZJREVSX1BSRUZJWCBhcyBJTlRFUk5BTF9NT0RFTF9BVVRIX1BST1ZJREVSX1BSRUZJWCwgQXV0aGVudGljYXRpb25TZXNzaW9uQWNjb3VudCwgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXJTZXNzaW9uT3B0aW9ucyB9IGZyb20gJy4uLy4uL3NlcnZpY2VzL2F1dGhlbnRpY2F0aW9uL2NvbW1vbi9hdXRoZW50aWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBFeHRIb3N0QXV0aGVudGljYXRpb25TaGFwZSwgRXh0SG9zdENvbnRleHQsIE1haW5Db250ZXh0LCBNYWluVGhyZWFkQXV0aGVudGljYXRpb25TaGFwZSB9IGZyb20gJy4uL2NvbW1vbi9leHRIb3N0LnByb3RvY29sLmpzJztcbmltcG9ydCB7IElEaWFsb2dTZXJ2aWNlLCBJUHJvbXB0QnV0dG9uIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vZGlhbG9ncy9jb21tb24vZGlhbG9ncy5qcyc7XG5pbXBvcnQgU2V2ZXJpdHkgZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vc2V2ZXJpdHkuanMnO1xuaW1wb3J0IHsgSU5vdGlmaWNhdGlvblNlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9ub3RpZmljYXRpb24vY29tbW9uL25vdGlmaWNhdGlvbi5qcyc7XG5pbXBvcnQgeyBBY3RpdmF0aW9uS2luZCwgSUV4dGVuc2lvblNlcnZpY2UgfSBmcm9tICcuLi8uLi9zZXJ2aWNlcy9leHRlbnNpb25zL2NvbW1vbi9leHRlbnNpb25zLmpzJztcbmltcG9ydCB7IElUZWxlbWV0cnlTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vdGVsZW1ldHJ5L2NvbW1vbi90ZWxlbWV0cnkuanMnO1xuaW1wb3J0IHsgRW1pdHRlciwgRXZlbnQgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9ldmVudC5qcyc7XG5pbXBvcnQgeyBJQXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UuanMnO1xuaW1wb3J0IHsgSUF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvblVzYWdlU2VydmljZS5qcyc7XG5pbXBvcnQgeyBnZXRBdXRoZW50aWNhdGlvblByb3ZpZGVyQWN0aXZhdGlvbkV2ZW50IH0gZnJvbSAnLi4vLi4vc2VydmljZXMvYXV0aGVudGljYXRpb24vYnJvd3Nlci9hdXRoZW50aWNhdGlvblNlcnZpY2UuanMnO1xuaW1wb3J0IHsgVVJJLCBVcmlDb21wb25lbnRzIH0gZnJvbSAnLi4vLi4vLi4vYmFzZS9jb21tb24vdXJpLmpzJztcbmltcG9ydCB7IElPcGVuZXJTZXJ2aWNlIH0gZnJvbSAnLi4vLi4vLi4vcGxhdGZvcm0vb3BlbmVyL2NvbW1vbi9vcGVuZXIuanMnO1xuaW1wb3J0IHsgQ2FuY2VsbGF0aW9uRXJyb3IgfSBmcm9tICcuLi8uLi8uLi9iYXNlL2NvbW1vbi9lcnJvcnMuanMnO1xuaW1wb3J0IHsgSUxvZ1NlcnZpY2UgfSBmcm9tICcuLi8uLi8uLi9wbGF0Zm9ybS9sb2cvY29tbW9uL2xvZy5qcyc7XG5cbmV4cG9ydCBpbnRlcmZhY2UgQXV0aGVudGljYXRpb25JbnRlcmFjdGl2ZU9wdGlvbnMge1xuXHRkZXRhaWw/OiBzdHJpbmc7XG5cdGxlYXJuTW9yZT86IFVyaUNvbXBvbmVudHM7XG5cdHNlc3Npb25Ub1JlY3JlYXRlPzogQXV0aGVudGljYXRpb25TZXNzaW9uO1xufVxuXG5leHBvcnQgaW50ZXJmYWNlIEF1dGhlbnRpY2F0aW9uR2V0U2Vzc2lvbk9wdGlvbnMge1xuXHRjbGVhclNlc3Npb25QcmVmZXJlbmNlPzogYm9vbGVhbjtcblx0Y3JlYXRlSWZOb25lPzogYm9vbGVhbiB8IEF1dGhlbnRpY2F0aW9uSW50ZXJhY3RpdmVPcHRpb25zO1xuXHRmb3JjZU5ld1Nlc3Npb24/OiBib29sZWFuIHwgQXV0aGVudGljYXRpb25JbnRlcmFjdGl2ZU9wdGlvbnM7XG5cdHNpbGVudD86IGJvb2xlYW47XG5cdGFjY291bnQ/OiBBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50O1xufVxuXG5leHBvcnQgY2xhc3MgTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uUHJvdmlkZXIgZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXIge1xuXG5cdHJlYWRvbmx5IG9uRGlkQ2hhbmdlU2Vzc2lvbnM6IEV2ZW50PEF1dGhlbnRpY2F0aW9uU2Vzc2lvbnNDaGFuZ2VFdmVudD47XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0cHJpdmF0ZSByZWFkb25seSBfcHJveHk6IEV4dEhvc3RBdXRoZW50aWNhdGlvblNoYXBlLFxuXHRcdHB1YmxpYyByZWFkb25seSBpZDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBsYWJlbDogc3RyaW5nLFxuXHRcdHB1YmxpYyByZWFkb25seSBzdXBwb3J0c011bHRpcGxlQWNjb3VudHM6IGJvb2xlYW4sXG5cdFx0cHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRvbkRpZENoYW5nZVNlc3Npb25zRW1pdHRlcjogRW1pdHRlcjxBdXRoZW50aWNhdGlvblNlc3Npb25zQ2hhbmdlRXZlbnQ+LFxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMub25EaWRDaGFuZ2VTZXNzaW9ucyA9IG9uRGlkQ2hhbmdlU2Vzc2lvbnNFbWl0dGVyLmV2ZW50O1xuXHR9XG5cblx0YXN5bmMgZ2V0U2Vzc2lvbnMoc2NvcGVzOiBzdHJpbmdbXSB8IHVuZGVmaW5lZCwgb3B0aW9uczogSUF1dGhlbnRpY2F0aW9uUHJvdmlkZXJTZXNzaW9uT3B0aW9ucykge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kZ2V0U2Vzc2lvbnModGhpcy5pZCwgc2NvcGVzLCBvcHRpb25zKTtcblx0fVxuXG5cdGNyZWF0ZVNlc3Npb24oc2NvcGVzOiBzdHJpbmdbXSwgb3B0aW9uczogSUF1dGhlbnRpY2F0aW9uQ3JlYXRlU2Vzc2lvbk9wdGlvbnMpOiBQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbj4ge1xuXHRcdHJldHVybiB0aGlzLl9wcm94eS4kY3JlYXRlU2Vzc2lvbih0aGlzLmlkLCBzY29wZXMsIG9wdGlvbnMpO1xuXHR9XG5cblx0YXN5bmMgcmVtb3ZlU2Vzc2lvbihzZXNzaW9uSWQ6IHN0cmluZyk6IFByb21pc2U8dm9pZD4ge1xuXHRcdGF3YWl0IHRoaXMuX3Byb3h5LiRyZW1vdmVTZXNzaW9uKHRoaXMuaWQsIHNlc3Npb25JZCk7XG5cdFx0dGhpcy5ub3RpZmljYXRpb25TZXJ2aWNlLmluZm8obmxzLmxvY2FsaXplKCdzaWduZWRPdXQnLCBcIlN1Y2Nlc3NmdWxseSBzaWduZWQgb3V0LlwiKSk7XG5cdH1cbn1cblxuQGV4dEhvc3ROYW1lZEN1c3RvbWVyKE1haW5Db250ZXh0Lk1haW5UaHJlYWRBdXRoZW50aWNhdGlvbilcbmV4cG9ydCBjbGFzcyBNYWluVGhyZWFkQXV0aGVudGljYXRpb24gZXh0ZW5kcyBEaXNwb3NhYmxlIGltcGxlbWVudHMgTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uU2hhcGUge1xuXHRwcml2YXRlIHJlYWRvbmx5IF9wcm94eTogRXh0SG9zdEF1dGhlbnRpY2F0aW9uU2hhcGU7XG5cblx0cHJpdmF0ZSByZWFkb25seSBfcmVnaXN0cmF0aW9ucyA9IHRoaXMuX3JlZ2lzdGVyKG5ldyBEaXNwb3NhYmxlTWFwPHN0cmluZz4oKSk7XG5cdHByaXZhdGUgX3NlbnRQcm92aWRlclVzYWdlRXZlbnRzID0gbmV3IFNldDxzdHJpbmc+KCk7XG5cblx0Y29uc3RydWN0b3IoXG5cdFx0ZXh0SG9zdENvbnRleHQ6IElFeHRIb3N0Q29udGV4dCxcblx0XHRASUF1dGhlbnRpY2F0aW9uU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uU2VydmljZTogSUF1dGhlbnRpY2F0aW9uU2VydmljZSxcblx0XHRASUF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBhdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlOiBJQXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZSxcblx0XHRASUF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZSBwcml2YXRlIHJlYWRvbmx5IGF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZTogSUF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZSxcblx0XHRASUF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlIHByaXZhdGUgcmVhZG9ubHkgYXV0aGVudGljYXRpb25Vc2FnZVNlcnZpY2U6IElBdXRoZW50aWNhdGlvblVzYWdlU2VydmljZSxcblx0XHRASURpYWxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBkaWFsb2dTZXJ2aWNlOiBJRGlhbG9nU2VydmljZSxcblx0XHRASU5vdGlmaWNhdGlvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBub3RpZmljYXRpb25TZXJ2aWNlOiBJTm90aWZpY2F0aW9uU2VydmljZSxcblx0XHRASUV4dGVuc2lvblNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBleHRlbnNpb25TZXJ2aWNlOiBJRXh0ZW5zaW9uU2VydmljZSxcblx0XHRASVRlbGVtZXRyeVNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSB0ZWxlbWV0cnlTZXJ2aWNlOiBJVGVsZW1ldHJ5U2VydmljZSxcblx0XHRASU9wZW5lclNlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBvcGVuZXJTZXJ2aWNlOiBJT3BlbmVyU2VydmljZSxcblx0XHRASUxvZ1NlcnZpY2UgcHJpdmF0ZSByZWFkb25seSBsb2dTZXJ2aWNlOiBJTG9nU2VydmljZVxuXHQpIHtcblx0XHRzdXBlcigpO1xuXHRcdHRoaXMuX3Byb3h5ID0gZXh0SG9zdENvbnRleHQuZ2V0UHJveHkoRXh0SG9zdENvbnRleHQuRXh0SG9zdEF1dGhlbnRpY2F0aW9uKTtcblxuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLm9uRGlkQ2hhbmdlU2Vzc2lvbnMoZSA9PiB7XG5cdFx0XHR0aGlzLl9wcm94eS4kb25EaWRDaGFuZ2VBdXRoZW50aWNhdGlvblNlc3Npb25zKGUucHJvdmlkZXJJZCwgZS5sYWJlbCk7XG5cdFx0fSkpO1xuXHRcdHRoaXMuX3JlZ2lzdGVyKHRoaXMuYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS5vbkRpZENoYW5nZUFjY291bnRQcmVmZXJlbmNlKGUgPT4ge1xuXHRcdFx0Y29uc3QgcHJvdmlkZXJJbmZvID0gdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIoZS5wcm92aWRlcklkKTtcblx0XHRcdHRoaXMuX3Byb3h5LiRvbkRpZENoYW5nZUF1dGhlbnRpY2F0aW9uU2Vzc2lvbnMocHJvdmlkZXJJbmZvLmlkLCBwcm92aWRlckluZm8ubGFiZWwsIGUuZXh0ZW5zaW9uSWRzKTtcblx0XHR9KSk7XG5cdH1cblxuXHRhc3luYyAkcmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGlkOiBzdHJpbmcsIGxhYmVsOiBzdHJpbmcsIHN1cHBvcnRzTXVsdGlwbGVBY2NvdW50czogYm9vbGVhbik6IFByb21pc2U8dm9pZD4ge1xuXHRcdGlmICghdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZGVjbGFyZWRQcm92aWRlcnMuZmluZChwID0+IHAuaWQgPT09IGlkKSkge1xuXHRcdFx0Ly8gSWYgdGVsZW1ldHJ5IHNob3dzIHRoYXQgdGhpcyBpcyBub3QgaGFwcGVuaW5nIG11Y2gsIHdlIGNhbiBpbnN0ZWFkIHRocm93IGFuIGVycm9yIGhlcmUuXG5cdFx0XHR0aGlzLmxvZ1NlcnZpY2Uud2FybihgQXV0aGVudGljYXRpb24gcHJvdmlkZXIgJHtpZH0gd2FzIG5vdCBkZWNsYXJlZCBpbiB0aGUgRXh0ZW5zaW9uIE1hbmlmZXN0LmApO1xuXHRcdFx0dHlwZSBBdXRoUHJvdmlkZXJOb3REZWNsYXJlZENsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ1R5bGVyTGVvbmhhcmR0Jztcblx0XHRcdFx0Y29tbWVudDogJ0FuIGF1dGhlbnRpY2F0aW9uIHByb3ZpZGVyIHdhcyBub3QgZGVjbGFyZWQgaW4gdGhlIEV4dGVuc2lvbiBNYW5pZmVzdC4nO1xuXHRcdFx0XHRpZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBwcm92aWRlciBpZC4nIH07XG5cdFx0XHR9O1xuXHRcdFx0dGhpcy50ZWxlbWV0cnlTZXJ2aWNlLnB1YmxpY0xvZzI8eyBpZDogc3RyaW5nIH0sIEF1dGhQcm92aWRlck5vdERlY2xhcmVkQ2xhc3NpZmljYXRpb24+KCdhdXRoZW50aWNhdGlvbi5wcm92aWRlck5vdERlY2xhcmVkJywgeyBpZCB9KTtcblx0XHR9XG5cdFx0Y29uc3QgZW1pdHRlciA9IG5ldyBFbWl0dGVyPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbnNDaGFuZ2VFdmVudD4oKTtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLnNldChpZCwgZW1pdHRlcik7XG5cdFx0Y29uc3QgcHJvdmlkZXIgPSBuZXcgTWFpblRocmVhZEF1dGhlbnRpY2F0aW9uUHJvdmlkZXIodGhpcy5fcHJveHksIGlkLCBsYWJlbCwgc3VwcG9ydHNNdWx0aXBsZUFjY291bnRzLCB0aGlzLm5vdGlmaWNhdGlvblNlcnZpY2UsIGVtaXR0ZXIpO1xuXHRcdHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLnJlZ2lzdGVyQXV0aGVudGljYXRpb25Qcm92aWRlcihpZCwgcHJvdmlkZXIpO1xuXHR9XG5cblx0JHVucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGlkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHR0aGlzLl9yZWdpc3RyYXRpb25zLmRlbGV0ZUFuZERpc3Bvc2UoaWQpO1xuXHRcdHRoaXMuYXV0aGVudGljYXRpb25TZXJ2aWNlLnVucmVnaXN0ZXJBdXRoZW50aWNhdGlvblByb3ZpZGVyKGlkKTtcblx0fVxuXG5cdGFzeW5jICRlbnN1cmVQcm92aWRlcihpZDogc3RyaW5nKTogUHJvbWlzZTx2b2lkPiB7XG5cdFx0aWYgKCF0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5pc0F1dGhlbnRpY2F0aW9uUHJvdmlkZXJSZWdpc3RlcmVkKGlkKSkge1xuXHRcdFx0cmV0dXJuIGF3YWl0IHRoaXMuZXh0ZW5zaW9uU2VydmljZS5hY3RpdmF0ZUJ5RXZlbnQoZ2V0QXV0aGVudGljYXRpb25Qcm92aWRlckFjdGl2YXRpb25FdmVudChpZCksIEFjdGl2YXRpb25LaW5kLkltbWVkaWF0ZSk7XG5cdFx0fVxuXHR9XG5cblx0JHNlbmREaWRDaGFuZ2VTZXNzaW9ucyhwcm92aWRlcklkOiBzdHJpbmcsIGV2ZW50OiBBdXRoZW50aWNhdGlvblNlc3Npb25zQ2hhbmdlRXZlbnQpOiB2b2lkIHtcblx0XHRjb25zdCBvYmogPSB0aGlzLl9yZWdpc3RyYXRpb25zLmdldChwcm92aWRlcklkKTtcblx0XHRpZiAob2JqIGluc3RhbmNlb2YgRW1pdHRlcikge1xuXHRcdFx0b2JqLmZpcmUoZXZlbnQpO1xuXHRcdH1cblx0fVxuXG5cdCRyZW1vdmVTZXNzaW9uKHByb3ZpZGVySWQ6IHN0cmluZywgc2Vzc2lvbklkOiBzdHJpbmcpOiBQcm9taXNlPHZvaWQ+IHtcblx0XHRyZXR1cm4gdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UucmVtb3ZlU2Vzc2lvbihwcm92aWRlcklkLCBzZXNzaW9uSWQpO1xuXHR9XG5cdHByaXZhdGUgYXN5bmMgbG9naW5Qcm9tcHQocHJvdmlkZXI6IElBdXRoZW50aWNhdGlvblByb3ZpZGVyLCBleHRlbnNpb25OYW1lOiBzdHJpbmcsIHJlY3JlYXRpbmdTZXNzaW9uOiBib29sZWFuLCBvcHRpb25zPzogQXV0aGVudGljYXRpb25JbnRlcmFjdGl2ZU9wdGlvbnMpOiBQcm9taXNlPGJvb2xlYW4+IHtcblx0XHRsZXQgbWVzc2FnZTogc3RyaW5nO1xuXG5cdFx0Ly8gQW4gaW50ZXJuYWwgcHJvdmlkZXIgaXMgYSBzcGVjaWFsIGNhc2Ugd2hpY2ggaXMgZm9yIG1vZGVsIGFjY2VzcyBvbmx5LlxuXHRcdGlmIChwcm92aWRlci5pZC5zdGFydHNXaXRoKElOVEVSTkFMX01PREVMX0FVVEhfUFJPVklERVJfUFJFRklYKSkge1xuXHRcdFx0bWVzc2FnZSA9IG5scy5sb2NhbGl6ZSgnY29uZmlybU1vZGVsQWNjZXNzJywgXCJUaGUgZXh0ZW5zaW9uICd7MH0nIHdhbnRzIHRvIGFjY2VzcyB0aGUgbGFuZ3VhZ2UgbW9kZWxzIHByb3ZpZGVkIGJ5IHsxfS5cIiwgZXh0ZW5zaW9uTmFtZSwgcHJvdmlkZXIubGFiZWwpO1xuXHRcdH0gZWxzZSB7XG5cdFx0XHRtZXNzYWdlID0gcmVjcmVhdGluZ1Nlc3Npb25cblx0XHRcdFx0PyBubHMubG9jYWxpemUoJ2NvbmZpcm1SZWxvZ2luJywgXCJUaGUgZXh0ZW5zaW9uICd7MH0nIHdhbnRzIHlvdSB0byBzaWduIGluIGFnYWluIHVzaW5nIHsxfS5cIiwgZXh0ZW5zaW9uTmFtZSwgcHJvdmlkZXIubGFiZWwpXG5cdFx0XHRcdDogbmxzLmxvY2FsaXplKCdjb25maXJtTG9naW4nLCBcIlRoZSBleHRlbnNpb24gJ3swfScgd2FudHMgdG8gc2lnbiBpbiB1c2luZyB7MX0uXCIsIGV4dGVuc2lvbk5hbWUsIHByb3ZpZGVyLmxhYmVsKTtcblx0XHR9XG5cblx0XHRjb25zdCBidXR0b25zOiBJUHJvbXB0QnV0dG9uPGJvb2xlYW4gfCB1bmRlZmluZWQ+W10gPSBbXG5cdFx0XHR7XG5cdFx0XHRcdGxhYmVsOiBubHMubG9jYWxpemUoeyBrZXk6ICdhbGxvdycsIGNvbW1lbnQ6IFsnJiYgZGVub3RlcyBhIG1uZW1vbmljJ10gfSwgXCImJkFsbG93XCIpLFxuXHRcdFx0XHRydW4oKSB7XG5cdFx0XHRcdFx0cmV0dXJuIHRydWU7XG5cdFx0XHRcdH0sXG5cdFx0XHR9XG5cdFx0XTtcblx0XHRpZiAob3B0aW9ucz8ubGVhcm5Nb3JlKSB7XG5cdFx0XHRidXR0b25zLnB1c2goe1xuXHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdsZWFybk1vcmUnLCBcIkxlYXJuIG1vcmVcIiksXG5cdFx0XHRcdHJ1bjogYXN5bmMgKCkgPT4ge1xuXHRcdFx0XHRcdGNvbnN0IHJlc3VsdCA9IHRoaXMubG9naW5Qcm9tcHQocHJvdmlkZXIsIGV4dGVuc2lvbk5hbWUsIHJlY3JlYXRpbmdTZXNzaW9uLCBvcHRpb25zKTtcblx0XHRcdFx0XHRhd2FpdCB0aGlzLm9wZW5lclNlcnZpY2Uub3BlbihVUkkucmV2aXZlKG9wdGlvbnMubGVhcm5Nb3JlISksIHsgYWxsb3dDb21tYW5kczogdHJ1ZSB9KTtcblx0XHRcdFx0XHRyZXR1cm4gYXdhaXQgcmVzdWx0O1xuXHRcdFx0XHR9XG5cdFx0XHR9KTtcblx0XHR9XG5cdFx0Y29uc3QgeyByZXN1bHQgfSA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0dHlwZTogU2V2ZXJpdHkuSW5mbyxcblx0XHRcdG1lc3NhZ2UsXG5cdFx0XHRidXR0b25zLFxuXHRcdFx0ZGV0YWlsOiBvcHRpb25zPy5kZXRhaWwsXG5cdFx0XHRjYW5jZWxCdXR0b246IHRydWUsXG5cdFx0fSk7XG5cblx0XHRyZXR1cm4gcmVzdWx0ID8/IGZhbHNlO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBjb250aW51ZVdpdGhJbmNvcnJlY3RBY2NvdW50UHJvbXB0KGNob3NlbkFjY291bnRMYWJlbDogc3RyaW5nLCByZXF1ZXN0ZWRBY2NvdW50TGFiZWw6IHN0cmluZyk6IFByb21pc2U8Ym9vbGVhbj4ge1xuXHRcdGNvbnN0IHJlc3VsdCA9IGF3YWl0IHRoaXMuZGlhbG9nU2VydmljZS5wcm9tcHQoe1xuXHRcdFx0bWVzc2FnZTogbmxzLmxvY2FsaXplKCdpbmNvcnJlY3RBY2NvdW50JywgXCJJbmNvcnJlY3QgYWNjb3VudCBkZXRlY3RlZFwiKSxcblx0XHRcdGRldGFpbDogbmxzLmxvY2FsaXplKCdpbmNvcnJlY3RBY2NvdW50RGV0YWlsJywgXCJUaGUgY2hvc2VuIGFjY291bnQsIHswfSwgZG9lcyBub3QgbWF0Y2ggdGhlIHJlcXVlc3RlZCBhY2NvdW50LCB7MX0uXCIsIGNob3NlbkFjY291bnRMYWJlbCwgcmVxdWVzdGVkQWNjb3VudExhYmVsKSxcblx0XHRcdHR5cGU6IFNldmVyaXR5Lldhcm5pbmcsXG5cdFx0XHRjYW5jZWxCdXR0b246IHRydWUsXG5cdFx0XHRidXR0b25zOiBbXG5cdFx0XHRcdHtcblx0XHRcdFx0XHRsYWJlbDogbmxzLmxvY2FsaXplKCdrZWVwJywgJ0tlZXAgezB9JywgY2hvc2VuQWNjb3VudExhYmVsKSxcblx0XHRcdFx0XHRydW46ICgpID0+IGNob3NlbkFjY291bnRMYWJlbFxuXHRcdFx0XHR9LFxuXHRcdFx0XHR7XG5cdFx0XHRcdFx0bGFiZWw6IG5scy5sb2NhbGl6ZSgnbG9naW5XaXRoJywgJ0xvZ2luIHdpdGggezB9JywgcmVxdWVzdGVkQWNjb3VudExhYmVsKSxcblx0XHRcdFx0XHRydW46ICgpID0+IHJlcXVlc3RlZEFjY291bnRMYWJlbFxuXHRcdFx0XHR9XG5cdFx0XHRdLFxuXHRcdH0pO1xuXG5cdFx0aWYgKCFyZXN1bHQucmVzdWx0KSB7XG5cdFx0XHR0aHJvdyBuZXcgQ2FuY2VsbGF0aW9uRXJyb3IoKTtcblx0XHR9XG5cblx0XHRyZXR1cm4gcmVzdWx0LnJlc3VsdCA9PT0gY2hvc2VuQWNjb3VudExhYmVsO1xuXHR9XG5cblx0cHJpdmF0ZSBhc3luYyBkb0dldFNlc3Npb24ocHJvdmlkZXJJZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdLCBleHRlbnNpb25JZDogc3RyaW5nLCBleHRlbnNpb25OYW1lOiBzdHJpbmcsIG9wdGlvbnM6IEF1dGhlbnRpY2F0aW9uR2V0U2Vzc2lvbk9wdGlvbnMpOiBQcm9taXNlPEF1dGhlbnRpY2F0aW9uU2Vzc2lvbiB8IHVuZGVmaW5lZD4ge1xuXHRcdGNvbnN0IHNlc3Npb25zID0gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0U2Vzc2lvbnMocHJvdmlkZXJJZCwgc2NvcGVzLCBvcHRpb25zLmFjY291bnQsIHRydWUpO1xuXHRcdGNvbnN0IHByb3ZpZGVyID0gdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0UHJvdmlkZXIocHJvdmlkZXJJZCk7XG5cblx0XHQvLyBFcnJvciBjYXNlc1xuXHRcdGlmIChvcHRpb25zLmZvcmNlTmV3U2Vzc2lvbiAmJiBvcHRpb25zLmNyZWF0ZUlmTm9uZSkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbWJpbmF0aW9uIG9mIG9wdGlvbnMuIFBsZWFzZSByZW1vdmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6IGZvcmNlTmV3U2Vzc2lvbiwgY3JlYXRlSWZOb25lJyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmZvcmNlTmV3U2Vzc2lvbiAmJiBvcHRpb25zLnNpbGVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbWJpbmF0aW9uIG9mIG9wdGlvbnMuIFBsZWFzZSByZW1vdmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6IGZvcmNlTmV3U2Vzc2lvbiwgc2lsZW50Jyk7XG5cdFx0fVxuXHRcdGlmIChvcHRpb25zLmNyZWF0ZUlmTm9uZSAmJiBvcHRpb25zLnNpbGVudCkge1xuXHRcdFx0dGhyb3cgbmV3IEVycm9yKCdJbnZhbGlkIGNvbWJpbmF0aW9uIG9mIG9wdGlvbnMuIFBsZWFzZSByZW1vdmUgb25lIG9mIHRoZSBmb2xsb3dpbmc6IGNyZWF0ZUlmTm9uZSwgc2lsZW50Jyk7XG5cdFx0fVxuXG5cdFx0aWYgKG9wdGlvbnMuY2xlYXJTZXNzaW9uUHJlZmVyZW5jZSkge1xuXHRcdFx0Ly8gQ2xlYXJpbmcgdGhlIHNlc3Npb24gcHJlZmVyZW5jZSBpcyB1c3VhbGx5IHBhaXJlZCB3aXRoIGNyZWF0ZUlmTm9uZSwgc28ganVzdCByZW1vdmUgdGhlIHByZWZlcmVuY2UgYW5kXG5cdFx0XHQvLyBkZWZlciB0byB0aGUgcmVzdCBvZiB0aGUgbG9naWMgaW4gdGhpcyBmdW5jdGlvbiB0byBjaG9vc2UgdGhlIHNlc3Npb24uXG5cdFx0XHR0aGlzLl9yZW1vdmVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2NvcGVzKTtcblx0XHR9XG5cblx0XHRjb25zdCBtYXRjaGluZ0FjY291bnRQcmVmZXJlbmNlU2Vzc2lvbiA9XG5cdFx0XHQvLyBJZiBhbiBhY2NvdW50IHdhcyBwYXNzZWQgaW4sIHRoYXQgdGFrZXMgcHJlY2VkZW5jZSBvdmVyIHRoZSBhY2NvdW50IHByZWZlcmVuY2Vcblx0XHRcdG9wdGlvbnMuYWNjb3VudFxuXHRcdFx0XHQvLyBXZSBvbmx5IHN1cHBvcnQgb25lIHNlc3Npb24gcGVyIGFjY291bnQgcGVyIHNldCBvZiBzY29wZXMgc28gZ3JhYiB0aGUgZmlyc3Qgb25lIGhlcmVcblx0XHRcdFx0PyBzZXNzaW9uc1swXVxuXHRcdFx0XHQ6IHRoaXMuX2dldEFjY291bnRQcmVmZXJlbmNlKGV4dGVuc2lvbklkLCBwcm92aWRlcklkLCBzY29wZXMsIHNlc3Npb25zKTtcblxuXHRcdC8vIENoZWNrIGlmIHRoZSBzZXNzaW9ucyB3ZSBoYXZlIGFyZSB2YWxpZFxuXHRcdGlmICghb3B0aW9ucy5mb3JjZU5ld1Nlc3Npb24gJiYgc2Vzc2lvbnMubGVuZ3RoKSB7XG5cdFx0XHQvLyBJZiB3ZSBoYXZlIGFuIGV4aXN0aW5nIHNlc3Npb24gcHJlZmVyZW5jZSwgdXNlIHRoYXQuIElmIG5vdCwgd2UnbGwgcmV0dXJuIGFueSB2YWxpZCBzZXNzaW9uIGF0IHRoZSBlbmQgb2YgdGhpcyBmdW5jdGlvbi5cblx0XHRcdGlmIChtYXRjaGluZ0FjY291bnRQcmVmZXJlbmNlU2Vzc2lvbiAmJiB0aGlzLmF1dGhlbnRpY2F0aW9uQWNjZXNzU2VydmljZS5pc0FjY2Vzc0FsbG93ZWQocHJvdmlkZXJJZCwgbWF0Y2hpbmdBY2NvdW50UHJlZmVyZW5jZVNlc3Npb24uYWNjb3VudC5sYWJlbCwgZXh0ZW5zaW9uSWQpKSB7XG5cdFx0XHRcdHJldHVybiBtYXRjaGluZ0FjY291bnRQcmVmZXJlbmNlU2Vzc2lvbjtcblx0XHRcdH1cblx0XHRcdC8vIElmIHdlIG9ubHkgaGF2ZSBvbmUgYWNjb3VudCBmb3IgYSBzaW5nbGUgYXV0aCBwcm92aWRlciwgbGV0cyBqdXN0IGNoZWNrIGlmIGl0J3MgYWxsb3dlZCBhbmQgcmV0dXJuIGl0IGlmIGl0IGlzLlxuXHRcdFx0aWYgKCFwcm92aWRlci5zdXBwb3J0c011bHRpcGxlQWNjb3VudHMgJiYgdGhpcy5hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UuaXNBY2Nlc3NBbGxvd2VkKHByb3ZpZGVySWQsIHNlc3Npb25zWzBdLmFjY291bnQubGFiZWwsIGV4dGVuc2lvbklkKSkge1xuXHRcdFx0XHRyZXR1cm4gc2Vzc2lvbnNbMF07XG5cdFx0XHR9XG5cdFx0fVxuXG5cdFx0Ly8gV2UgbWF5IG5lZWQgdG8gcHJvbXB0IGJlY2F1c2Ugd2UgZG9uJ3QgaGF2ZSBhIHZhbGlkIHNlc3Npb25cblx0XHQvLyBtb2RhbCBmbG93c1xuXHRcdGlmIChvcHRpb25zLmNyZWF0ZUlmTm9uZSB8fCBvcHRpb25zLmZvcmNlTmV3U2Vzc2lvbikge1xuXHRcdFx0bGV0IHVpT3B0aW9uczogQXV0aGVudGljYXRpb25JbnRlcmFjdGl2ZU9wdGlvbnMgfCB1bmRlZmluZWQ7XG5cdFx0XHRpZiAodHlwZW9mIG9wdGlvbnMuZm9yY2VOZXdTZXNzaW9uID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHR1aU9wdGlvbnMgPSBvcHRpb25zLmZvcmNlTmV3U2Vzc2lvbjtcblx0XHRcdH0gZWxzZSBpZiAodHlwZW9mIG9wdGlvbnMuY3JlYXRlSWZOb25lID09PSAnb2JqZWN0Jykge1xuXHRcdFx0XHR1aU9wdGlvbnMgPSBvcHRpb25zLmNyZWF0ZUlmTm9uZTtcblx0XHRcdH1cblxuXHRcdFx0Ly8gV2Ugb25seSB3YW50IHRvIHNob3cgdGhlIFwicmVjcmVhdGluZyBzZXNzaW9uXCIgcHJvbXB0IGlmIHdlIGFyZSB1c2luZyBmb3JjZU5ld1Nlc3Npb24gJiB0aGVyZSBhcmUgc2Vzc2lvbnNcblx0XHRcdC8vIHRoYXQgd2Ugd2lsbCBiZSBcImZvcmNpbmcgdGhyb3VnaFwiLlxuXHRcdFx0Y29uc3QgcmVjcmVhdGluZ1Nlc3Npb24gPSAhIShvcHRpb25zLmZvcmNlTmV3U2Vzc2lvbiAmJiBzZXNzaW9ucy5sZW5ndGgpO1xuXHRcdFx0Y29uc3QgaXNBbGxvd2VkID0gYXdhaXQgdGhpcy5sb2dpblByb21wdChwcm92aWRlciwgZXh0ZW5zaW9uTmFtZSwgcmVjcmVhdGluZ1Nlc3Npb24sIHVpT3B0aW9ucyk7XG5cdFx0XHRpZiAoIWlzQWxsb3dlZCkge1xuXHRcdFx0XHR0aHJvdyBuZXcgRXJyb3IoJ1VzZXIgZGlkIG5vdCBjb25zZW50IHRvIGxvZ2luLicpO1xuXHRcdFx0fVxuXG5cdFx0XHRsZXQgc2Vzc2lvbjogQXV0aGVudGljYXRpb25TZXNzaW9uO1xuXHRcdFx0aWYgKHNlc3Npb25zPy5sZW5ndGggJiYgIW9wdGlvbnMuZm9yY2VOZXdTZXNzaW9uKSB7XG5cdFx0XHRcdHNlc3Npb24gPSBwcm92aWRlci5zdXBwb3J0c011bHRpcGxlQWNjb3VudHMgJiYgIW9wdGlvbnMuYWNjb3VudFxuXHRcdFx0XHRcdD8gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLnNlbGVjdFNlc3Npb24ocHJvdmlkZXJJZCwgZXh0ZW5zaW9uSWQsIGV4dGVuc2lvbk5hbWUsIHNjb3Blcywgc2Vzc2lvbnMpXG5cdFx0XHRcdFx0OiBzZXNzaW9uc1swXTtcblx0XHRcdH0gZWxzZSB7XG5cdFx0XHRcdGNvbnN0IGFjY291bnRUb0NyZWF0ZTogQXV0aGVudGljYXRpb25TZXNzaW9uQWNjb3VudCB8IHVuZGVmaW5lZCA9IG9wdGlvbnMuYWNjb3VudCA/PyBtYXRjaGluZ0FjY291bnRQcmVmZXJlbmNlU2Vzc2lvbj8uYWNjb3VudDtcblx0XHRcdFx0ZG8ge1xuXHRcdFx0XHRcdHNlc3Npb24gPSBhd2FpdCB0aGlzLmF1dGhlbnRpY2F0aW9uU2VydmljZS5jcmVhdGVTZXNzaW9uKHByb3ZpZGVySWQsIHNjb3BlcywgeyBhY3RpdmF0ZUltbWVkaWF0ZTogdHJ1ZSwgYWNjb3VudDogYWNjb3VudFRvQ3JlYXRlIH0pO1xuXHRcdFx0XHR9IHdoaWxlIChcblx0XHRcdFx0XHRhY2NvdW50VG9DcmVhdGVcblx0XHRcdFx0XHQmJiBhY2NvdW50VG9DcmVhdGUubGFiZWwgIT09IHNlc3Npb24uYWNjb3VudC5sYWJlbFxuXHRcdFx0XHRcdCYmICFhd2FpdCB0aGlzLmNvbnRpbnVlV2l0aEluY29ycmVjdEFjY291bnRQcm9tcHQoc2Vzc2lvbi5hY2NvdW50LmxhYmVsLCBhY2NvdW50VG9DcmVhdGUubGFiZWwpXG5cdFx0XHRcdCk7XG5cdFx0XHR9XG5cblx0XHRcdHRoaXMuYXV0aGVudGljYXRpb25BY2Nlc3NTZXJ2aWNlLnVwZGF0ZUFsbG93ZWRFeHRlbnNpb25zKHByb3ZpZGVySWQsIHNlc3Npb24uYWNjb3VudC5sYWJlbCwgW3sgaWQ6IGV4dGVuc2lvbklkLCBuYW1lOiBleHRlbnNpb25OYW1lLCBhbGxvd2VkOiB0cnVlIH1dKTtcblx0XHRcdHRoaXMuX3VwZGF0ZUFjY291bnRQcmVmZXJlbmNlKGV4dGVuc2lvbklkLCBwcm92aWRlcklkLCBzZXNzaW9uKTtcblx0XHRcdHJldHVybiBzZXNzaW9uO1xuXHRcdH1cblxuXHRcdC8vIEZvciB0aGUgc2lsZW50IGZsb3dzLCBpZiB3ZSBoYXZlIGEgc2Vzc2lvbiBidXQgd2UgZG9uJ3QgaGF2ZSBhIHNlc3Npb24gcHJlZmVyZW5jZSwgd2UnbGwgcmV0dXJuIHRoZSBmaXJzdCBvbmUgdGhhdCBpcyB2YWxpZC5cblx0XHRpZiAoIW1hdGNoaW5nQWNjb3VudFByZWZlcmVuY2VTZXNzaW9uICYmICF0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UuZ2V0QWNjb3VudFByZWZlcmVuY2UoZXh0ZW5zaW9uSWQsIHByb3ZpZGVySWQpKSB7XG5cdFx0XHRjb25zdCB2YWxpZFNlc3Npb24gPSBzZXNzaW9ucy5maW5kKHNlc3Npb24gPT4gdGhpcy5hdXRoZW50aWNhdGlvbkFjY2Vzc1NlcnZpY2UuaXNBY2Nlc3NBbGxvd2VkKHByb3ZpZGVySWQsIHNlc3Npb24uYWNjb3VudC5sYWJlbCwgZXh0ZW5zaW9uSWQpKTtcblx0XHRcdGlmICh2YWxpZFNlc3Npb24pIHtcblx0XHRcdFx0cmV0dXJuIHZhbGlkU2Vzc2lvbjtcblx0XHRcdH1cblx0XHR9XG5cblx0XHQvLyBwYXNzaXZlIGZsb3dzIChzaWxlbnQgb3IgZGVmYXVsdClcblx0XHRpZiAoIW9wdGlvbnMuc2lsZW50KSB7XG5cdFx0XHQvLyBJZiB0aGVyZSBpcyBhIHBvdGVudGlhbCBzZXNzaW9uLCBidXQgdGhlIGV4dGVuc2lvbiBkb2Vzbid0IGhhdmUgYWNjZXNzIHRvIGl0LCB1c2UgdGhlIFwiZ3JhbnQgYWNjZXNzXCIgZmxvdyxcblx0XHRcdC8vIG90aGVyd2lzZSByZXF1ZXN0IGEgbmV3IG9uZS5cblx0XHRcdHNlc3Npb25zLmxlbmd0aFxuXHRcdFx0XHQ/IHRoaXMuYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS5yZXF1ZXN0U2Vzc2lvbkFjY2Vzcyhwcm92aWRlcklkLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSwgc2NvcGVzLCBzZXNzaW9ucylcblx0XHRcdFx0OiBhd2FpdCB0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UucmVxdWVzdE5ld1Nlc3Npb24ocHJvdmlkZXJJZCwgc2NvcGVzLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSk7XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRhc3luYyAkZ2V0U2Vzc2lvbihwcm92aWRlcklkOiBzdHJpbmcsIHNjb3Blczogc3RyaW5nW10sIGV4dGVuc2lvbklkOiBzdHJpbmcsIGV4dGVuc2lvbk5hbWU6IHN0cmluZywgb3B0aW9uczogQXV0aGVudGljYXRpb25HZXRTZXNzaW9uT3B0aW9ucyk6IFByb21pc2U8QXV0aGVudGljYXRpb25TZXNzaW9uIHwgdW5kZWZpbmVkPiB7XG5cdFx0dGhpcy5zZW5kQ2xpZW50SWRVc2FnZVRlbGVtZXRyeShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2NvcGVzKTtcblx0XHRjb25zdCBzZXNzaW9uID0gYXdhaXQgdGhpcy5kb0dldFNlc3Npb24ocHJvdmlkZXJJZCwgc2NvcGVzLCBleHRlbnNpb25JZCwgZXh0ZW5zaW9uTmFtZSwgb3B0aW9ucyk7XG5cblx0XHRpZiAoc2Vzc2lvbikge1xuXHRcdFx0dGhpcy5zZW5kUHJvdmlkZXJVc2FnZVRlbGVtZXRyeShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCk7XG5cdFx0XHR0aGlzLmF1dGhlbnRpY2F0aW9uVXNhZ2VTZXJ2aWNlLmFkZEFjY291bnRVc2FnZShwcm92aWRlcklkLCBzZXNzaW9uLmFjY291bnQubGFiZWwsIHNjb3BlcywgZXh0ZW5zaW9uSWQsIGV4dGVuc2lvbk5hbWUpO1xuXHRcdH1cblxuXHRcdHJldHVybiBzZXNzaW9uO1xuXHR9XG5cblx0YXN5bmMgJGdldEFjY291bnRzKHByb3ZpZGVySWQ6IHN0cmluZyk6IFByb21pc2U8UmVhZG9ubHlBcnJheTxBdXRoZW50aWNhdGlvblNlc3Npb25BY2NvdW50Pj4ge1xuXHRcdGNvbnN0IGFjY291bnRzID0gYXdhaXQgdGhpcy5hdXRoZW50aWNhdGlvblNlcnZpY2UuZ2V0QWNjb3VudHMocHJvdmlkZXJJZCk7XG5cdFx0cmV0dXJuIGFjY291bnRzO1xuXHR9XG5cblx0Ly8gVE9ET0BUeWxlckxlb25oYXJkdCB0aGlzIGlzIGEgdGVtcG9yYXJ5IGFkZGl0aW9uIHRvIHRlbGVtZXRyeSB0byB1bmRlcnN0YW5kIHdoYXQgZXh0ZW5zaW9ucyBhcmUgb3ZlcnJpZGluZyB0aGUgY2xpZW50IGlkLlxuXHQvLyBXZSBjYW4gdXNlIHRoaXMgdGVsZW1ldHJ5IHRvIHJlYWNoIG91dCB0byB0aGVzZSBleHRlbnNpb24gYXV0aG9ycyBhbmQgbGV0IHRoZW0ga25vdyB0aGF0IHRoZXkgbWFueSBuZWVkIGNvbmZpZ3VyYXRpb24gY2hhbmdlc1xuXHQvLyBkdWUgdG8gdGhlIGFkb3B0aW9uIG9mIHRoZSBNaWNyb3NvZnQgYnJva2VyLlxuXHQvLyBSZW1vdmUgdGhpcyBpbiBhIGZldyBpdGVyYXRpb25zLlxuXHRwcml2YXRlIF9zZW50Q2xpZW50SWRVc2FnZUV2ZW50cyA9IG5ldyBTZXQ8c3RyaW5nPigpO1xuXHRwcml2YXRlIHNlbmRDbGllbnRJZFVzYWdlVGVsZW1ldHJ5KGV4dGVuc2lvbklkOiBzdHJpbmcsIHByb3ZpZGVySWQ6IHN0cmluZywgc2NvcGVzOiBzdHJpbmdbXSk6IHZvaWQge1xuXHRcdGNvbnN0IGNvbnRhaW5zVlNDb2RlQ2xpZW50SWRTY29wZSA9IHNjb3Blcy5zb21lKHNjb3BlID0+IHNjb3BlLnN0YXJ0c1dpdGgoJ1ZTQ09ERV9DTElFTlRfSUQ6JykpO1xuXHRcdGNvbnN0IGtleSA9IGAke2V4dGVuc2lvbklkfXwke3Byb3ZpZGVySWR9fCR7Y29udGFpbnNWU0NvZGVDbGllbnRJZFNjb3BlfWA7XG5cdFx0aWYgKHRoaXMuX3NlbnRDbGllbnRJZFVzYWdlRXZlbnRzLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3NlbnRDbGllbnRJZFVzYWdlRXZlbnRzLmFkZChrZXkpO1xuXHRcdGlmIChjb250YWluc1ZTQ29kZUNsaWVudElkU2NvcGUpIHtcblx0XHRcdHR5cGUgQ2xpZW50SWRVc2FnZUNsYXNzaWZpY2F0aW9uID0ge1xuXHRcdFx0XHRvd25lcjogJ1R5bGVyTGVvbmhhcmR0Jztcblx0XHRcdFx0Y29tbWVudDogJ1VzZWQgdG8gc2VlIHdoaWNoIGV4dGVuc2lvbnMgYXJlIHVzaW5nIHRoZSBWU0NvZGUgY2xpZW50IGlkIG92ZXJyaWRlJztcblx0XHRcdFx0ZXh0ZW5zaW9uSWQ6IHsgY2xhc3NpZmljYXRpb246ICdTeXN0ZW1NZXRhRGF0YSc7IHB1cnBvc2U6ICdGZWF0dXJlSW5zaWdodCc7IGNvbW1lbnQ6ICdUaGUgZXh0ZW5zaW9uIGlkLicgfTtcblx0XHRcdH07XG5cdFx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjx7IGV4dGVuc2lvbklkOiBzdHJpbmcgfSwgQ2xpZW50SWRVc2FnZUNsYXNzaWZpY2F0aW9uPignYXV0aGVudGljYXRpb24uY2xpZW50SWRVc2FnZScsIHsgZXh0ZW5zaW9uSWQgfSk7XG5cdFx0fVxuXHR9XG5cblx0cHJpdmF0ZSBzZW5kUHJvdmlkZXJVc2FnZVRlbGVtZXRyeShleHRlbnNpb25JZDogc3RyaW5nLCBwcm92aWRlcklkOiBzdHJpbmcpOiB2b2lkIHtcblx0XHRjb25zdCBrZXkgPSBgJHtleHRlbnNpb25JZH18JHtwcm92aWRlcklkfWA7XG5cdFx0aWYgKHRoaXMuX3NlbnRQcm92aWRlclVzYWdlRXZlbnRzLmhhcyhrZXkpKSB7XG5cdFx0XHRyZXR1cm47XG5cdFx0fVxuXHRcdHRoaXMuX3NlbnRQcm92aWRlclVzYWdlRXZlbnRzLmFkZChrZXkpO1xuXHRcdHR5cGUgQXV0aFByb3ZpZGVyVXNhZ2VDbGFzc2lmaWNhdGlvbiA9IHtcblx0XHRcdG93bmVyOiAnVHlsZXJMZW9uaGFyZHQnO1xuXHRcdFx0Y29tbWVudDogJ1VzZWQgdG8gc2VlIHdoaWNoIGV4dGVuc2lvbnMgYXJlIHVzaW5nIHdoaWNoIHByb3ZpZGVycyc7XG5cdFx0XHRleHRlbnNpb25JZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBleHRlbnNpb24gaWQuJyB9O1xuXHRcdFx0cHJvdmlkZXJJZDogeyBjbGFzc2lmaWNhdGlvbjogJ1N5c3RlbU1ldGFEYXRhJzsgcHVycG9zZTogJ0ZlYXR1cmVJbnNpZ2h0JzsgY29tbWVudDogJ1RoZSBwcm92aWRlciBpZC4nIH07XG5cdFx0fTtcblx0XHR0aGlzLnRlbGVtZXRyeVNlcnZpY2UucHVibGljTG9nMjx7IGV4dGVuc2lvbklkOiBzdHJpbmc7IHByb3ZpZGVySWQ6IHN0cmluZyB9LCBBdXRoUHJvdmlkZXJVc2FnZUNsYXNzaWZpY2F0aW9uPignYXV0aGVudGljYXRpb24ucHJvdmlkZXJVc2FnZScsIHsgcHJvdmlkZXJJZCwgZXh0ZW5zaW9uSWQgfSk7XG5cdH1cblxuXHQvLyNyZWdpb24gQWNjb3VudCBQcmVmZXJlbmNlc1xuXHQvLyBUT0RPQFR5bGVyTGVvbmhhcmR0OiBVcGRhdGUgdGhpcyBhZnRlciBhIGZldyBpdGVyYXRpb25zIHRvIG5vIGxvbmdlciBmYWxsYmFjayB0byB0aGUgc2Vzc2lvbiBwcmVmZXJlbmNlXG5cblx0cHJpdmF0ZSBfZ2V0QWNjb3VudFByZWZlcmVuY2UoZXh0ZW5zaW9uSWQ6IHN0cmluZywgcHJvdmlkZXJJZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdLCBzZXNzaW9uczogUmVhZG9ubHlBcnJheTxBdXRoZW50aWNhdGlvblNlc3Npb24+KTogQXV0aGVudGljYXRpb25TZXNzaW9uIHwgdW5kZWZpbmVkIHtcblx0XHRpZiAoc2Vzc2lvbnMubGVuZ3RoID09PSAwKSB7XG5cdFx0XHRyZXR1cm4gdW5kZWZpbmVkO1xuXHRcdH1cblx0XHRjb25zdCBhY2NvdW50TmFtZVByZWZlcmVuY2UgPSB0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UuZ2V0QWNjb3VudFByZWZlcmVuY2UoZXh0ZW5zaW9uSWQsIHByb3ZpZGVySWQpO1xuXHRcdGlmIChhY2NvdW50TmFtZVByZWZlcmVuY2UpIHtcblx0XHRcdGNvbnN0IHNlc3Npb24gPSBzZXNzaW9ucy5maW5kKHNlc3Npb24gPT4gc2Vzc2lvbi5hY2NvdW50LmxhYmVsID09PSBhY2NvdW50TmFtZVByZWZlcmVuY2UpO1xuXHRcdFx0cmV0dXJuIHNlc3Npb247XG5cdFx0fVxuXG5cdFx0Y29uc3Qgc2Vzc2lvbklkUHJlZmVyZW5jZSA9IHRoaXMuYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS5nZXRTZXNzaW9uUHJlZmVyZW5jZShwcm92aWRlcklkLCBleHRlbnNpb25JZCwgc2NvcGVzKTtcblx0XHRpZiAoc2Vzc2lvbklkUHJlZmVyZW5jZSkge1xuXHRcdFx0Y29uc3Qgc2Vzc2lvbiA9IHNlc3Npb25zLmZpbmQoc2Vzc2lvbiA9PiBzZXNzaW9uLmlkID09PSBzZXNzaW9uSWRQcmVmZXJlbmNlKTtcblx0XHRcdGlmIChzZXNzaW9uKSB7XG5cdFx0XHRcdC8vIE1pZ3JhdGUgdGhlIHNlc3Npb24gcHJlZmVyZW5jZSB0byB0aGUgYWNjb3VudCBwcmVmZXJlbmNlXG5cdFx0XHRcdHRoaXMuYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS51cGRhdGVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50KTtcblx0XHRcdFx0cmV0dXJuIHNlc3Npb247XG5cdFx0XHR9XG5cdFx0fVxuXHRcdHJldHVybiB1bmRlZmluZWQ7XG5cdH1cblxuXHRwcml2YXRlIF91cGRhdGVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZDogc3RyaW5nLCBwcm92aWRlcklkOiBzdHJpbmcsIHNlc3Npb246IEF1dGhlbnRpY2F0aW9uU2Vzc2lvbik6IHZvaWQge1xuXHRcdHRoaXMuYXV0aGVudGljYXRpb25FeHRlbnNpb25zU2VydmljZS51cGRhdGVBY2NvdW50UHJlZmVyZW5jZShleHRlbnNpb25JZCwgcHJvdmlkZXJJZCwgc2Vzc2lvbi5hY2NvdW50KTtcblx0XHR0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UudXBkYXRlU2Vzc2lvblByZWZlcmVuY2UocHJvdmlkZXJJZCwgZXh0ZW5zaW9uSWQsIHNlc3Npb24pO1xuXHR9XG5cblx0cHJpdmF0ZSBfcmVtb3ZlQWNjb3VudFByZWZlcmVuY2UoZXh0ZW5zaW9uSWQ6IHN0cmluZywgcHJvdmlkZXJJZDogc3RyaW5nLCBzY29wZXM6IHN0cmluZ1tdKTogdm9pZCB7XG5cdFx0dGhpcy5hdXRoZW50aWNhdGlvbkV4dGVuc2lvbnNTZXJ2aWNlLnJlbW92ZUFjY291bnRQcmVmZXJlbmNlKGV4dGVuc2lvbklkLCBwcm92aWRlcklkKTtcblx0XHR0aGlzLmF1dGhlbnRpY2F0aW9uRXh0ZW5zaW9uc1NlcnZpY2UucmVtb3ZlU2Vzc2lvblByZWZlcmVuY2UocHJvdmlkZXJJZCwgZXh0ZW5zaW9uSWQsIHNjb3Blcyk7XG5cdH1cblxuXHQvLyNlbmRyZWdpb25cbn1cbiJdLAogICJtYXBwaW5ncyI6ICI7Ozs7Ozs7Ozs7O0FBS0EsU0FBUyxZQUFZLHFCQUFxQjtBQUMxQyxZQUFZLFNBQVM7QUFDckIsU0FBUyw0QkFBNkM7QUFDdEQsU0FBaUksd0JBQXdCLGtDQUFrQyxpQ0FBaUMsMkNBQWdIO0FBQzVVLFNBQXFDLGdCQUFnQixtQkFBa0Q7QUFDdkcsU0FBUyxzQkFBcUM7QUFDOUMsT0FBTyxjQUFjO0FBQ3JCLFNBQVMsNEJBQTRCO0FBQ3JDLFNBQVMsZ0JBQWdCLHlCQUF5QjtBQUNsRCxTQUFTLHlCQUF5QjtBQUNsQyxTQUFTLGVBQXNCO0FBQy9CLFNBQVMsb0NBQW9DO0FBQzdDLFNBQVMsbUNBQW1DO0FBQzVDLFNBQVMsZ0RBQWdEO0FBQ3pELFNBQVMsV0FBMEI7QUFDbkMsU0FBUyxzQkFBc0I7QUFDL0IsU0FBUyx5QkFBeUI7QUFDbEMsU0FBUyxtQkFBbUI7QUFnQnJCLE1BQU0seUNBQXlDLFdBQThDO0FBQUEsRUFJbkcsWUFDa0IsUUFDRCxJQUNBLE9BQ0EsMEJBQ0MscUJBQ2pCLDRCQUNDO0FBQ0QsVUFBTTtBQVBXO0FBQ0Q7QUFDQTtBQUNBO0FBQ0M7QUFJakIsU0FBSyxzQkFBc0IsMkJBQTJCO0FBQUEsRUFDdkQ7QUFBQSxFQUVBLE1BQU0sWUFBWSxRQUE4QixTQUFnRDtBQUMvRixXQUFPLEtBQUssT0FBTyxhQUFhLEtBQUssSUFBSSxRQUFRLE9BQU87QUFBQSxFQUN6RDtBQUFBLEVBRUEsY0FBYyxRQUFrQixTQUE4RTtBQUM3RyxXQUFPLEtBQUssT0FBTyxlQUFlLEtBQUssSUFBSSxRQUFRLE9BQU87QUFBQSxFQUMzRDtBQUFBLEVBRUEsTUFBTSxjQUFjLFdBQWtDO0FBQ3JELFVBQU0sS0FBSyxPQUFPLGVBQWUsS0FBSyxJQUFJLFNBQVM7QUFDbkQsU0FBSyxvQkFBb0IsS0FBSyxJQUFJLFNBQVMsYUFBYSwwQkFBMEIsQ0FBQztBQUFBLEVBQ3BGO0FBQ0Q7QUFHTyxJQUFNLDJCQUFOLGNBQXVDLFdBQW9EO0FBQUEsRUFNakcsWUFDQyxnQkFDeUMsdUJBQ1UsaUNBQ0osNkJBQ0QsNEJBQ2IsZUFDTSxxQkFDSCxrQkFDQSxrQkFDSCxlQUNILFlBQzdCO0FBQ0QsVUFBTTtBQVhtQztBQUNVO0FBQ0o7QUFDRDtBQUNiO0FBQ007QUFDSDtBQUNBO0FBQ0g7QUFDSDtBQWQvQixTQUFpQixpQkFBaUIsS0FBSyxVQUFVLElBQUksY0FBc0IsQ0FBQztBQUM1RSxTQUFRLDJCQUEyQixvQkFBSSxJQUFZO0FBMFBuRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFNBQVEsMkJBQTJCLG9CQUFJLElBQVk7QUExT2xELFNBQUssU0FBUyxlQUFlLFNBQVMsZUFBZSxxQkFBcUI7QUFFMUUsU0FBSyxVQUFVLEtBQUssc0JBQXNCLG9CQUFvQixPQUFLO0FBQ2xFLFdBQUssT0FBTyxtQ0FBbUMsRUFBRSxZQUFZLEVBQUUsS0FBSztBQUFBLElBQ3JFLENBQUMsQ0FBQztBQUNGLFNBQUssVUFBVSxLQUFLLGdDQUFnQyw2QkFBNkIsT0FBSztBQUNyRixZQUFNLGVBQWUsS0FBSyxzQkFBc0IsWUFBWSxFQUFFLFVBQVU7QUFDeEUsV0FBSyxPQUFPLG1DQUFtQyxhQUFhLElBQUksYUFBYSxPQUFPLEVBQUUsWUFBWTtBQUFBLElBQ25HLENBQUMsQ0FBQztBQUFBLEVBQ0g7QUFBQSxFQUVBLE1BQU0sZ0NBQWdDLElBQVksT0FBZSwwQkFBa0Q7QUFDbEgsUUFBSSxDQUFDLEtBQUssc0JBQXNCLGtCQUFrQixLQUFLLE9BQUssRUFBRSxPQUFPLEVBQUUsR0FBRztBQUV6RSxXQUFLLFdBQVcsS0FBSywyQkFBMkIsRUFBRSw4Q0FBOEM7QUFNaEcsV0FBSyxpQkFBaUIsV0FBa0Usc0NBQXNDLEVBQUUsR0FBRyxDQUFDO0FBQUEsSUFDckk7QUFDQSxVQUFNLFVBQVUsSUFBSSxRQUEyQztBQUMvRCxTQUFLLGVBQWUsSUFBSSxJQUFJLE9BQU87QUFDbkMsVUFBTSxXQUFXLElBQUksaUNBQWlDLEtBQUssUUFBUSxJQUFJLE9BQU8sMEJBQTBCLEtBQUsscUJBQXFCLE9BQU87QUFDekksU0FBSyxzQkFBc0IsK0JBQStCLElBQUksUUFBUTtBQUFBLEVBQ3ZFO0FBQUEsRUFFQSxrQ0FBa0MsSUFBa0I7QUFDbkQsU0FBSyxlQUFlLGlCQUFpQixFQUFFO0FBQ3ZDLFNBQUssc0JBQXNCLGlDQUFpQyxFQUFFO0FBQUEsRUFDL0Q7QUFBQSxFQUVBLE1BQU0sZ0JBQWdCLElBQTJCO0FBQ2hELFFBQUksQ0FBQyxLQUFLLHNCQUFzQixtQ0FBbUMsRUFBRSxHQUFHO0FBQ3ZFLGFBQU8sTUFBTSxLQUFLLGlCQUFpQixnQkFBZ0IseUNBQXlDLEVBQUUsR0FBRyxlQUFlLFNBQVM7QUFBQSxJQUMxSDtBQUFBLEVBQ0Q7QUFBQSxFQUVBLHVCQUF1QixZQUFvQixPQUFnRDtBQUMxRixVQUFNLE1BQU0sS0FBSyxlQUFlLElBQUksVUFBVTtBQUM5QyxRQUFJLGVBQWUsU0FBUztBQUMzQixVQUFJLEtBQUssS0FBSztBQUFBLElBQ2Y7QUFBQSxFQUNEO0FBQUEsRUFFQSxlQUFlLFlBQW9CLFdBQWtDO0FBQ3BFLFdBQU8sS0FBSyxzQkFBc0IsY0FBYyxZQUFZLFNBQVM7QUFBQSxFQUN0RTtBQUFBLEVBQ0EsTUFBYyxZQUFZLFVBQW1DLGVBQXVCLG1CQUE0QixTQUE4RDtBQUM3SyxRQUFJO0FBR0osUUFBSSxTQUFTLEdBQUcsV0FBVyxtQ0FBbUMsR0FBRztBQUNoRSxnQkFBVSxJQUFJLFNBQVMsc0JBQXNCLDRFQUE0RSxlQUFlLFNBQVMsS0FBSztBQUFBLElBQ3ZKLE9BQU87QUFDTixnQkFBVSxvQkFDUCxJQUFJLFNBQVMsa0JBQWtCLDZEQUE2RCxlQUFlLFNBQVMsS0FBSyxJQUN6SCxJQUFJLFNBQVMsZ0JBQWdCLG1EQUFtRCxlQUFlLFNBQVMsS0FBSztBQUFBLElBQ2pIO0FBRUEsVUFBTSxVQUFnRDtBQUFBLE1BQ3JEO0FBQUEsUUFDQyxPQUFPLElBQUksU0FBUyxFQUFFLEtBQUssU0FBUyxTQUFTLENBQUMsdUJBQXVCLEVBQUUsR0FBRyxTQUFTO0FBQUEsUUFDbkYsTUFBTTtBQUNMLGlCQUFPO0FBQUEsUUFDUjtBQUFBLE1BQ0Q7QUFBQSxJQUNEO0FBQ0EsUUFBSSxTQUFTLFdBQVc7QUFDdkIsY0FBUSxLQUFLO0FBQUEsUUFDWixPQUFPLElBQUksU0FBUyxhQUFhLFlBQVk7QUFBQSxRQUM3QyxLQUFLLFlBQVk7QUFDaEIsZ0JBQU1BLFVBQVMsS0FBSyxZQUFZLFVBQVUsZUFBZSxtQkFBbUIsT0FBTztBQUNuRixnQkFBTSxLQUFLLGNBQWMsS0FBSyxJQUFJLE9BQU8sUUFBUSxTQUFVLEdBQUcsRUFBRSxlQUFlLEtBQUssQ0FBQztBQUNyRixpQkFBTyxNQUFNQTtBQUFBLFFBQ2Q7QUFBQSxNQUNELENBQUM7QUFBQSxJQUNGO0FBQ0EsVUFBTSxFQUFFLE9BQU8sSUFBSSxNQUFNLEtBQUssY0FBYyxPQUFPO0FBQUEsTUFDbEQsTUFBTSxTQUFTO0FBQUEsTUFDZjtBQUFBLE1BQ0E7QUFBQSxNQUNBLFFBQVEsU0FBUztBQUFBLE1BQ2pCLGNBQWM7QUFBQSxJQUNmLENBQUM7QUFFRCxXQUFPLFVBQVU7QUFBQSxFQUNsQjtBQUFBLEVBRUEsTUFBYyxtQ0FBbUMsb0JBQTRCLHVCQUFpRDtBQUM3SCxVQUFNLFNBQVMsTUFBTSxLQUFLLGNBQWMsT0FBTztBQUFBLE1BQzlDLFNBQVMsSUFBSSxTQUFTLG9CQUFvQiw0QkFBNEI7QUFBQSxNQUN0RSxRQUFRLElBQUksU0FBUywwQkFBMEIsdUVBQXVFLG9CQUFvQixxQkFBcUI7QUFBQSxNQUMvSixNQUFNLFNBQVM7QUFBQSxNQUNmLGNBQWM7QUFBQSxNQUNkLFNBQVM7QUFBQSxRQUNSO0FBQUEsVUFDQyxPQUFPLElBQUksU0FBUyxRQUFRLFlBQVksa0JBQWtCO0FBQUEsVUFDMUQsS0FBSyxNQUFNO0FBQUEsUUFDWjtBQUFBLFFBQ0E7QUFBQSxVQUNDLE9BQU8sSUFBSSxTQUFTLGFBQWEsa0JBQWtCLHFCQUFxQjtBQUFBLFVBQ3hFLEtBQUssTUFBTTtBQUFBLFFBQ1o7QUFBQSxNQUNEO0FBQUEsSUFDRCxDQUFDO0FBRUQsUUFBSSxDQUFDLE9BQU8sUUFBUTtBQUNuQixZQUFNLElBQUksa0JBQWtCO0FBQUEsSUFDN0I7QUFFQSxXQUFPLE9BQU8sV0FBVztBQUFBLEVBQzFCO0FBQUEsRUFFQSxNQUFjLGFBQWEsWUFBb0IsUUFBa0IsYUFBcUIsZUFBdUIsU0FBc0Y7QUFDbE0sVUFBTSxXQUFXLE1BQU0sS0FBSyxzQkFBc0IsWUFBWSxZQUFZLFFBQVEsUUFBUSxTQUFTLElBQUk7QUFDdkcsVUFBTSxXQUFXLEtBQUssc0JBQXNCLFlBQVksVUFBVTtBQUdsRSxRQUFJLFFBQVEsbUJBQW1CLFFBQVEsY0FBYztBQUNwRCxZQUFNLElBQUksTUFBTSxtR0FBbUc7QUFBQSxJQUNwSDtBQUNBLFFBQUksUUFBUSxtQkFBbUIsUUFBUSxRQUFRO0FBQzlDLFlBQU0sSUFBSSxNQUFNLDZGQUE2RjtBQUFBLElBQzlHO0FBQ0EsUUFBSSxRQUFRLGdCQUFnQixRQUFRLFFBQVE7QUFDM0MsWUFBTSxJQUFJLE1BQU0sMEZBQTBGO0FBQUEsSUFDM0c7QUFFQSxRQUFJLFFBQVEsd0JBQXdCO0FBR25DLFdBQUsseUJBQXlCLGFBQWEsWUFBWSxNQUFNO0FBQUEsSUFDOUQ7QUFFQSxVQUFNO0FBQUE7QUFBQSxNQUVMLFFBQVEsVUFFTCxTQUFTLENBQUMsSUFDVixLQUFLLHNCQUFzQixhQUFhLFlBQVksUUFBUSxRQUFRO0FBQUE7QUFHeEUsUUFBSSxDQUFDLFFBQVEsbUJBQW1CLFNBQVMsUUFBUTtBQUVoRCxVQUFJLG9DQUFvQyxLQUFLLDRCQUE0QixnQkFBZ0IsWUFBWSxpQ0FBaUMsUUFBUSxPQUFPLFdBQVcsR0FBRztBQUNsSyxlQUFPO0FBQUEsTUFDUjtBQUVBLFVBQUksQ0FBQyxTQUFTLDRCQUE0QixLQUFLLDRCQUE0QixnQkFBZ0IsWUFBWSxTQUFTLENBQUMsRUFBRSxRQUFRLE9BQU8sV0FBVyxHQUFHO0FBQy9JLGVBQU8sU0FBUyxDQUFDO0FBQUEsTUFDbEI7QUFBQSxJQUNEO0FBSUEsUUFBSSxRQUFRLGdCQUFnQixRQUFRLGlCQUFpQjtBQUNwRCxVQUFJO0FBQ0osVUFBSSxPQUFPLFFBQVEsb0JBQW9CLFVBQVU7QUFDaEQsb0JBQVksUUFBUTtBQUFBLE1BQ3JCLFdBQVcsT0FBTyxRQUFRLGlCQUFpQixVQUFVO0FBQ3BELG9CQUFZLFFBQVE7QUFBQSxNQUNyQjtBQUlBLFlBQU0sb0JBQW9CLENBQUMsRUFBRSxRQUFRLG1CQUFtQixTQUFTO0FBQ2pFLFlBQU0sWUFBWSxNQUFNLEtBQUssWUFBWSxVQUFVLGVBQWUsbUJBQW1CLFNBQVM7QUFDOUYsVUFBSSxDQUFDLFdBQVc7QUFDZixjQUFNLElBQUksTUFBTSxnQ0FBZ0M7QUFBQSxNQUNqRDtBQUVBLFVBQUk7QUFDSixVQUFJLFVBQVUsVUFBVSxDQUFDLFFBQVEsaUJBQWlCO0FBQ2pELGtCQUFVLFNBQVMsNEJBQTRCLENBQUMsUUFBUSxVQUNyRCxNQUFNLEtBQUssZ0NBQWdDLGNBQWMsWUFBWSxhQUFhLGVBQWUsUUFBUSxRQUFRLElBQ2pILFNBQVMsQ0FBQztBQUFBLE1BQ2QsT0FBTztBQUNOLGNBQU0sa0JBQTRELFFBQVEsV0FBVyxrQ0FBa0M7QUFDdkgsV0FBRztBQUNGLG9CQUFVLE1BQU0sS0FBSyxzQkFBc0IsY0FBYyxZQUFZLFFBQVEsRUFBRSxtQkFBbUIsTUFBTSxTQUFTLGdCQUFnQixDQUFDO0FBQUEsUUFDbkksU0FDQyxtQkFDRyxnQkFBZ0IsVUFBVSxRQUFRLFFBQVEsU0FDMUMsQ0FBQyxNQUFNLEtBQUssbUNBQW1DLFFBQVEsUUFBUSxPQUFPLGdCQUFnQixLQUFLO0FBQUEsTUFFaEc7QUFFQSxXQUFLLDRCQUE0Qix3QkFBd0IsWUFBWSxRQUFRLFFBQVEsT0FBTyxDQUFDLEVBQUUsSUFBSSxhQUFhLE1BQU0sZUFBZSxTQUFTLEtBQUssQ0FBQyxDQUFDO0FBQ3JKLFdBQUsseUJBQXlCLGFBQWEsWUFBWSxPQUFPO0FBQzlELGFBQU87QUFBQSxJQUNSO0FBR0EsUUFBSSxDQUFDLG9DQUFvQyxDQUFDLEtBQUssZ0NBQWdDLHFCQUFxQixhQUFhLFVBQVUsR0FBRztBQUM3SCxZQUFNLGVBQWUsU0FBUyxLQUFLLGFBQVcsS0FBSyw0QkFBNEIsZ0JBQWdCLFlBQVksUUFBUSxRQUFRLE9BQU8sV0FBVyxDQUFDO0FBQzlJLFVBQUksY0FBYztBQUNqQixlQUFPO0FBQUEsTUFDUjtBQUFBLElBQ0Q7QUFHQSxRQUFJLENBQUMsUUFBUSxRQUFRO0FBR3BCLGVBQVMsU0FDTixLQUFLLGdDQUFnQyxxQkFBcUIsWUFBWSxhQUFhLGVBQWUsUUFBUSxRQUFRLElBQ2xILE1BQU0sS0FBSyxnQ0FBZ0Msa0JBQWtCLFlBQVksUUFBUSxhQUFhLGFBQWE7QUFBQSxJQUMvRztBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFNLFlBQVksWUFBb0IsUUFBa0IsYUFBcUIsZUFBdUIsU0FBc0Y7QUFDekwsU0FBSywyQkFBMkIsYUFBYSxZQUFZLE1BQU07QUFDL0QsVUFBTSxVQUFVLE1BQU0sS0FBSyxhQUFhLFlBQVksUUFBUSxhQUFhLGVBQWUsT0FBTztBQUUvRixRQUFJLFNBQVM7QUFDWixXQUFLLDJCQUEyQixhQUFhLFVBQVU7QUFDdkQsV0FBSywyQkFBMkIsZ0JBQWdCLFlBQVksUUFBUSxRQUFRLE9BQU8sUUFBUSxhQUFhLGFBQWE7QUFBQSxJQUN0SDtBQUVBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFQSxNQUFNLGFBQWEsWUFBMEU7QUFDNUYsVUFBTSxXQUFXLE1BQU0sS0FBSyxzQkFBc0IsWUFBWSxVQUFVO0FBQ3hFLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFPUSwyQkFBMkIsYUFBcUIsWUFBb0IsUUFBd0I7QUFDbkcsVUFBTSw4QkFBOEIsT0FBTyxLQUFLLFdBQVMsTUFBTSxXQUFXLG1CQUFtQixDQUFDO0FBQzlGLFVBQU0sTUFBTSxHQUFHLFdBQVcsSUFBSSxVQUFVLElBQUksMkJBQTJCO0FBQ3ZFLFFBQUksS0FBSyx5QkFBeUIsSUFBSSxHQUFHLEdBQUc7QUFDM0M7QUFBQSxJQUNEO0FBQ0EsU0FBSyx5QkFBeUIsSUFBSSxHQUFHO0FBQ3JDLFFBQUksNkJBQTZCO0FBTWhDLFdBQUssaUJBQWlCLFdBQWlFLGdDQUFnQyxFQUFFLFlBQVksQ0FBQztBQUFBLElBQ3ZJO0FBQUEsRUFDRDtBQUFBLEVBRVEsMkJBQTJCLGFBQXFCLFlBQTBCO0FBQ2pGLFVBQU0sTUFBTSxHQUFHLFdBQVcsSUFBSSxVQUFVO0FBQ3hDLFFBQUksS0FBSyx5QkFBeUIsSUFBSSxHQUFHLEdBQUc7QUFDM0M7QUFBQSxJQUNEO0FBQ0EsU0FBSyx5QkFBeUIsSUFBSSxHQUFHO0FBT3JDLFNBQUssaUJBQWlCLFdBQXlGLGdDQUFnQyxFQUFFLFlBQVksWUFBWSxDQUFDO0FBQUEsRUFDM0s7QUFBQTtBQUFBO0FBQUEsRUFLUSxzQkFBc0IsYUFBcUIsWUFBb0IsUUFBa0IsVUFBbUY7QUFDM0ssUUFBSSxTQUFTLFdBQVcsR0FBRztBQUMxQixhQUFPO0FBQUEsSUFDUjtBQUNBLFVBQU0sd0JBQXdCLEtBQUssZ0NBQWdDLHFCQUFxQixhQUFhLFVBQVU7QUFDL0csUUFBSSx1QkFBdUI7QUFDMUIsWUFBTSxVQUFVLFNBQVMsS0FBSyxDQUFBQyxhQUFXQSxTQUFRLFFBQVEsVUFBVSxxQkFBcUI7QUFDeEYsYUFBTztBQUFBLElBQ1I7QUFFQSxVQUFNLHNCQUFzQixLQUFLLGdDQUFnQyxxQkFBcUIsWUFBWSxhQUFhLE1BQU07QUFDckgsUUFBSSxxQkFBcUI7QUFDeEIsWUFBTSxVQUFVLFNBQVMsS0FBSyxDQUFBQSxhQUFXQSxTQUFRLE9BQU8sbUJBQW1CO0FBQzNFLFVBQUksU0FBUztBQUVaLGFBQUssZ0NBQWdDLHdCQUF3QixhQUFhLFlBQVksUUFBUSxPQUFPO0FBQ3JHLGVBQU87QUFBQSxNQUNSO0FBQUEsSUFDRDtBQUNBLFdBQU87QUFBQSxFQUNSO0FBQUEsRUFFUSx5QkFBeUIsYUFBcUIsWUFBb0IsU0FBc0M7QUFDL0csU0FBSyxnQ0FBZ0Msd0JBQXdCLGFBQWEsWUFBWSxRQUFRLE9BQU87QUFDckcsU0FBSyxnQ0FBZ0Msd0JBQXdCLFlBQVksYUFBYSxPQUFPO0FBQUEsRUFDOUY7QUFBQSxFQUVRLHlCQUF5QixhQUFxQixZQUFvQixRQUF3QjtBQUNqRyxTQUFLLGdDQUFnQyx3QkFBd0IsYUFBYSxVQUFVO0FBQ3BGLFNBQUssZ0NBQWdDLHdCQUF3QixZQUFZLGFBQWEsTUFBTTtBQUFBLEVBQzdGO0FBQUE7QUFHRDtBQW5VYSwyQkFBTjtBQUFBLEVBRE4scUJBQXFCLFlBQVksd0JBQXdCO0FBQUEsRUFTdkQ7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxFQUNBO0FBQUEsRUFDQTtBQUFBLEVBQ0E7QUFBQSxHQWpCVTsiLAogICJuYW1lcyI6IFsicmVzdWx0IiwgInNlc3Npb24iXQp9Cg==
